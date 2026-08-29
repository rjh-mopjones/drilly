import type { Diagram } from "./types";

export const RATE_LIMITER: Diagram = {
  id: "rate-limiter",
  title: "Rate Limiter",
  question: "Design a Rate Limiter",
  sourceId: "patterns",
  itemId: 1,
  overview: {
    shape:
      "A rate limiter is three decisions wrapped around one function call: what you count against, where the count lives, and what happens when that count is unreachable. The algorithm inside the call is the least interesting of them.",
    beats: [
      {
        text: "Every request enters the API gateway node, where the limiter runs as middleware. The first decision is the key: the Key builder turns the caller into (identity, scope) — identity is a user id, an API key or a caller IP; scope is a class of endpoints rather than one route. IP keying is cheap and runs before authentication, but a NAT gateway drops thousands of users into one bucket, so the key is the account wherever an authenticated identity exists.",
        lights: ["client", "gateway", "key-builder", "e1", "e2"],
      },
      {
        text: "The Rule matcher looks the key up against ~10k compiled rules held in the node's own memory: which algorithm, what limit, what window, and what to do when the counter store cannot be reached. The rule is data, not code, so it can change in the middle of an attack.",
        lights: ["rule-matcher", "e3"],
      },
      {
        text: "The second decision is where the count lives, and it is the real engineering. Two hundred nodes each enforcing 100 per minute permit 20,000 per minute, which is not a limit; dividing the limit by 200 gives each node half a request per window, which is not a promise you can keep. So one Sharded counter store, 16 Redis primaries — sized by the ~100k checks/s each primary can run, not by the 20GB of keys.",
        lights: ["counter-store", "e9"],
      },
      {
        text: "The check itself is one indivisible operation executed inside the store: the Atomic check-and-update sends a single script that reads the counter, decides, and writes, on a shard that runs one command at a time. Read 99 against a limit of 100 and write 100 from two nodes at once and you have allowed 101; at 1M req/s that interleaving is the normal case. The clock is read inside the script too, or 200 drifting node clocks give different verdicts for the same request.",
        lights: ["limiter-check", "counter-store", "e9"],
      },
      {
        text: "The third decision is what happens when the store cannot answer, and it is decided per limit. The Timeout + circuit breaker bounds the store call at 5ms inside a 10ms budget and trips after 5 consecutive timeouts. Then a commercial quota fails open onto coarse per-node counters and the request reaches the Protected backend, while the Risk gate in front of a venue-capped order session fails closed: thirty seconds of unmetered traffic is 0.001% of a month, thirty seconds of refusing everything is an outage.",
        lights: ["breaker", "backend", "risk-gate", "e4", "e13", "e16"],
      },
      {
        text: "Rules change without a deploy. The Rule config service writes the Rule store, then publishes one small message on the Invalidation channel; each node drops the named rule from its cache and refetches it lazily on the next request that needs it. A new rule runs in shadow mode for 24 hours before it enforces, because a bad rule reaches 200 nodes exactly as fast as a good one.",
        lights: ["config-service", "rule-store", "invalidation-bus", "e5", "e6", "e7", "e8"],
      },
      {
        text: "Rejection is a 429 with a jittered Retry-After, because a million clients handed the same retry instant all come back together. One decision in a hundred is written to the Sampled decision archive, which is where the over-allow rate and abuse forensics come from: the counters hold current state, never the rate that was actually served.",
        lights: ["decision-log", "e14", "e15"],
      },
    ],
    crux:
      "The shared counter that makes enforcement correct is also a dependency sitting in front of every request, so the limiter can become a bigger outage than the thing it protects. The resolution is not a better algorithm, it is a per-limit failure posture and a timeout small enough that a degraded store stays a degradation.",
    numbers: [
      "1M req/s peak across ~200 gateway nodes",
      "16 Redis primaries, sized by 100k checks/s not by 20GB",
      "5ms store timeout inside a 10ms p99 budget",
    ],
  },
  nodes: [
    // --- the enforcement fleet: one deployable, five stages ---------------
    {
      id: "gateway",
      label: "API gateway node",
      kind: "serviceGroup",
      sub: "×200, limiter in-process",
      expanded: true,
      col: 1,
      row: 0,
      detail: {
        what: "The stateless edge tier that terminates the request and runs the limiter as middleware. One deployable unit; the five stages inside it are phases of a single request, not five services.",
        why: "Rejecting at the edge is the point: a request stopped here never burns an app server or a database connection. Keeping all five stages in-process means the only remote call on the request path is the counter round trip, which is what makes a sub-10ms p99 overhead achievable at all across a 200 node fleet.",
        numbers: [
          "200 nodes x 5k req/s = 1M req/s",
          "1 remote call per request",
          "<10ms p99 added overhead",
        ],
        breaks:
          "Everything here is replicated 200 times, so a bug ships to the whole fleet at once and there is no canary between the limiter and the traffic it decides on. The characteristic crash is middleware OOM under sudden load, which shows as container restarts and p99 spikes.",
        choice: {
          pick: "Limiter as in-process middleware on the gateway",
          instead: "A dedicated rate-limiter service the gateway calls per request.",
          decider:
            "Hop count against a 10ms p99 budget. In-process, the only remote call is the counter round trip; a separate service adds a second network hop plus its own fleet to keep alive, which at 1M req/s is a million extra RPCs a second buying no accuracy the shared store did not already provide.",
          flips:
            "When many heterogeneous callers rather than one gateway fleet must share one enforcement point, or when the limiter has to ship on a different cadence from the gateway.",
        },
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "SDK, integration or browser",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "Everything making requests: browsers, server-side integrations and SDKs holding an API key.",
        why: "The whole rejection contract depends on it. Headers and Retry-After only change behaviour if the caller reads them, and a hostile caller is under no obligation to read anything.",
        numbers: ["1M req/s at peak", "~10B requests/day", "100M distinct identities"],
        breaks:
          "A million clients handed the same Retry-After retry in the same instant, re-trigger the limit at the next boundary and oscillate; jitter fixes the well-behaved SDK, which was never the problem.",
      },
    },
    {
      id: "key-builder",
      label: "Key builder",
      sub: "(identity, scope)",
      kind: "process",
      col: 1,
      row: 0,
      parent: "gateway",
      detail: {
        what: "Resolves the caller to an identity and the request to a scope, producing the single key everything downstream counts against.",
        why: "This is the first of the three decisions and it decides who is actually being limited. Scope is a class of endpoints rather than one route, because per-route keys multiply cardinality without changing what the limit protects.",
        numbers: ["100M identities", "50M DAU + ~10M API keys + ~40M caller IPs", "~200B of state per key"],
        breaks:
          "IP keying puts a NAT gateway's thousands of users in one bucket and IPv6 rotation walks straight around it, so the same key both over-throttles the innocent and under-throttles the attacker.",
        choice: {
          pick: "Key on user id or API key wherever an authenticated identity exists, scoped to a class of endpoints",
          instead: "Key on caller IP, which is cheap and works in front of authentication.",
          decider:
            "Bucket contamination against how early you can run. IP keying is pre-auth and free, but out of a 100M identity space a single CGNAT gateway shares one bucket across thousands of users; account keying gives per-account fairness at the cost of resolving identity first, so the limiter sits behind auth or reads a signed key.",
          flips:
            "Unauthenticated surfaces such as login, signup and password reset, where there is no account yet, so IP or device keying plus a coarse per-endpoint ceiling behind it is all you have.",
        },
      },
    },
    {
      id: "rule-matcher",
      label: "Rule matcher",
      sub: "local cache, ~10k compiled rules",
      kind: "process",
      col: 1,
      row: 1,
      parent: "gateway",
      detail: {
        what: "Matches (scope, identifier pattern, tier) to a rule carrying algorithm, limit, window, priority and the on-store-failure posture.",
        why: "Rules change while an attack is happening, so they are data rather than code. Tiering also lives here: the middleware joins user to tier from a cache resident in node memory alongside the compiled rules, so a plan upgrade is a cache invalidation rather than a rule rewrite and costs no extra hop.",
        numbers: ["~1000 endpoints x ~10 rules = 10k compiled rules", "~1KB per rule, ~10MB per node"],
        breaks:
          "A bad config push inverts a rule, so something that was 99% allow becomes 99% deny; the guard is allow-rate-by-rule alerting plus 24h of shadow mode before any new rule enforces.",
        choice: {
          pick: "Compiled rules cached in node memory, invalidated over pub/sub",
          instead: "Fetching the matching rule from the config service per request, or baking rules into the deploy.",
          decider:
            "10MB of compiled rules fits in every one of the 200 nodes, so a per-request fetch buys nothing and puts a second dependency on a 10ms hot path, while a deploy propagates in minutes when an attacker mid-attack needs propagation in under a second.",
          flips:
            "A small static rule set with no hot-reload requirement, where a deploy is an acceptable propagation channel and the control plane is one more thing to run for no benefit.",
        },
      },
    },
    {
      id: "limiter-check",
      label: "Atomic check-and-update",
      sub: "GCRA in one Lua script",
      kind: "process",
      col: 1,
      row: 2,
      parent: "gateway",
      detail: {
        what: "The one function everything lands on: given a key and the current time, return allow or deny and update the stored state, as a single script executed inside the store. The per-key counter and the coarse per-endpoint ceiling are both evaluated by that one script, so stacking them costs no second round trip.",
        why: "The unit of atomicity has to be the whole read, compute and write. A Redis shard runs commands and scripts one at a time on a single thread, so while the script runs nothing else on that shard can observe or modify the key, and that property is the entire correctness argument.",
        numbers: [
          "1 round trip per request, ~3 internal ops",
          "3M internal ops/s at peak",
          "tau = (B - 1) x T for a permitted burst of B",
        ],
        breaks:
          "A script bug that double-decrements is quietly wrong for months; it only shows as counter drift against the 1% sampled request count or as a billing reconciliation alert, never as an error.",
        choice: {
          pick: "GCRA over a single TAT field, evaluated by a Lua script with the clock read inside the store",
          instead: "Token bucket over two fields, or a read from the caller followed by a write.",
          decider:
            "Atomicity and whose clock. Read-then-write allows 101 against a limit of 100 whenever two of the hundreds of in-flight requests interleave; passing the gateway's own now means 200 NTP-drifted clocks give different verdicts for the same request. One field, one comparison, and the deny path yields the exact Retry-After instead of an estimate. Memory is not the argument: at ~200B per key the payload difference is invisible.",
          flips:
            "A store that serves one shard from several threads and cannot execute a script serially, where you need a compare-and-swap retry loop instead; or where token bucket's two operator-readable fields are worth more than the single compare.",
        },
      },
    },
    {
      id: "breaker",
      label: "Timeout + circuit breaker",
      kind: "process",
      sub: "5ms budget, local counters",
      col: 1,
      row: 3,
      parent: "gateway",
      detail: {
        what: "Bounds the store call at 5ms, trips after 5 consecutive timeouts, and then applies the rule's on-store-failure posture instead of the counter's verdict.",
        why: "This is the third decision, and the timeout is part of the design rather than an operational detail. With a 1s client-library default, each of a million requests a second blocks for a second during a partition, the gateway's connection budget is gone within the first tick, and a degraded store has become a total outage without ever returning an error.",
        numbers: [
          "5ms timeout inside a 10ms p99 budget",
          "trips after 5 consecutive timeouts",
          "page when fail_open_rate exceeds 0.1%",
        ],
        breaks:
          "The fail-open and fail-closed layers disagree during the same outage, so one client gets both verdicts and the platform reads as failing selectively rather than failing.",
        choice: {
          pick: "Fail open to coarse per-node counters for quota limits, fail closed for scarce-resource limits",
          instead: "One global posture, in practice fail open everywhere.",
          decider:
            "What the protected resource does at 10x nominal load. Thirty seconds of unmetered traffic is 30 of 2,592,000 seconds in a month, about 0.001% of volume, while failing closed for those same 30 seconds is a total API outage. Degrades gracefully means fail open; falls over, or breaks a rule with legal weight, means fail closed.",
          flips:
            "A platform with only one class of limit, where a per-limit posture is a field nobody sets correctly and one documented default is safer than two that contradict each other in front of the same client.",
        },
      },
    },

    // --- the counters -----------------------------------------------------
    {
      id: "counter-store",
      label: "Sharded counter store",
      kind: "cache",
      sub: "16 Redis primaries + replicas",
      col: 2,
      row: 2,
      detail: {
        what: "The authoritative counters, one key per (identity, scope), spread over 16 primaries and evicted by TTL at window length. In-memory and disposable by design: nothing here is a system of record.",
        why: "Every one of 200 gateway nodes needs the same view of a number changing a million times a second, and only one authoritative copy gives that. Single-threaded per-shard execution is also what makes the check script atomic, so the store choice and the correctness argument are the same choice.",
        numbers: [
          "16 primaries, ~1.25GB each",
          "~100k limiter checks/s per primary",
          "100M keys x ~200B = 20GB",
          "~160MB/s aggregate, 10MB/s per primary",
        ],
        breaks:
          "One hot key cannot be split by sharding: a single API key at 200k req/s puts twice a primary's ~100k/s ceiling on one shard, and every other key on that shard gets slow decisions as collateral.",
        choice: {
          pick: "Sharded in-memory store with server-side scripting, sized by throughput",
          instead: "A durable database, or a multi-threaded cache with client-side compare-and-swap.",
          decider:
            "Throughput sizes this cluster, not memory: 1M/s over a ~100k/s per-shard script ceiling is 10 primaries, rounded to 16 for headroom, where memory alone would have needed 6 at 20GB. Counters are ephemeral with TTL equal to the window, so durability buys nothing and would cost a write to disk on the hot path.",
          flips:
            "When the counter is also the billing record and has to survive a failover intact, at which point you are writing to a durable store on a completely different latency budget.",
        },
      },
    },

    // --- the control plane ------------------------------------------------
    {
      id: "config-service",
      label: "Rule config service",
      sub: "authoring API + shadow mode",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "The control plane for limits: validates and writes rules to the rule store, publishes an invalidation event per change, and runs a new rule in shadow mode for 24h before it enforces.",
        why: "Pushing a rule change through a deploy is too slow when an attacker is mid-attack. Separating the service from the store it writes to is what lets rule creation be refused while the last-known-good rules keep serving from 200 local caches.",
        numbers: ["<1s to reach all 200 nodes", "24h shadow mode before a rule enforces", "~10k compiled rules"],
        breaks:
          "If it is down there are no rule refreshes; nodes serve last-known-good from cache on a rule-cache-age alert, and rule creation is refused until it recovers.",
        choice: {
          pick: "A control-plane service off the request path, with shadow mode as a first-class state",
          instead: "Letting operators write the rule store directly, or shipping rules in the deploy artefact.",
          decider:
            "Blast radius of a bad rule. A rule that flips 99% allow to 99% deny reaches 200 nodes in under a second, which is exactly as fast as the fix and exactly as fast as the mistake, so the 24h shadow window has to be enforced by something that is not the person in a hurry.",
          flips:
            "Small or static rule sets where limits change quarterly, at which point a deploy is a perfectly good propagation channel and the control plane is pure operational cost.",
        },
      },
    },
    {
      id: "rule-store",
      label: "Rule store",
      sub: "transactional, RPO 0",
      kind: "database",
      col: 3,
      row: 1,
      detail: {
        what: "Source of truth for rules, keyed on (rule_id, scope, identifier_pattern, endpoint_pattern, algorithm, limit, window_sec, priority, on_store_failure), synchronously replicated.",
        why: "This is the one piece of durable state in the design. Counters are ephemeral and rebuild from traffic; rules do not, and losing them means the fleet enforces whatever 200 stale local caches happen to hold with no way to correct it.",
        numbers: ["~10k compiled rules, ~10MB total", "~1KB per rule", "synchronously replicated at RPO 0"],
        breaks:
          "It is small enough that nobody sizes it and nobody watches it, so the failure is a rule store that has been running unreplicated for months and is discovered during the restore.",
        choice: {
          pick: "A transactional database with synchronous replication",
          instead: "Keeping rules in the counter cluster, which is already there and already sharded.",
          decider:
            "Durability requirement and blast radius, not size. At 10MB the rule set fits anywhere, but the counter cluster is explicitly ephemeral with TTL eviction and no persistence, so putting rules there means a failover that is harmless for counters silently deletes the limits.",
          flips:
            "A single-tenant deployment with a handful of static rules, where a versioned file in the deploy artefact is both durable and auditable for free.",
        },
      },
    },
    {
      id: "invalidation-bus",
      label: "Invalidation channel",
      sub: "pub/sub fan-out to 200 nodes",
      kind: "queue",
      col: 2,
      row: 0,
      detail: {
        what: "The pub/sub channel carrying one small message per rule change to every gateway node, which drops the cached rule and refetches it lazily on the next request that needs it.",
        why: "Invalidate-then-refetch is what turns a rule change into a sub-second fleet-wide event without a redeploy and without 200 nodes polling the config service. It is a fan-out channel, not a work queue: messages are not durable and are not meant to be.",
        numbers: ["fan-out to ~200 subscribers", "~10 messages/day", "<1s end to end"],
        breaks:
          "If the channel is silent nobody notices, because stale rules still serve perfectly well; rule-cache-age is the only metric that shows this path has stopped working, and it is the metric people forget to alert on.",
        choice: {
          pick: "Fire-and-forget pub/sub with lazy refetch on the node",
          instead: "Each node polling the config service on an interval, or pushing the full rule body over the channel.",
          decider:
            "Freshness against load. A poll is only ever as fresh as its interval and 200 nodes polling a control-plane service is constant load for nothing; pushing the rule body makes the message the source of truth, so a dropped message leaves nodes permanently divergent, while a dropped invalidation only leaves them stale until the next one.",
          flips:
            "A fleet small enough that a 5 second poll is both fresh enough and cheaper than running a broker at all.",
        },
      },
    },

    // --- what the limit is protecting -------------------------------------
    {
      id: "backend",
      label: "Protected backend",
      sub: "app tier + connection pool",
      kind: "service",
      col: 0,
      row: 3,
      detail: {
        what: "The service the limit exists to protect, along with the finite resources behind it such as a fixed pool of database connections.",
        why: "It is the thing the third decision is really about. Whether it degrades or falls over at 10x nominal load is what settles fail open against fail closed, and that is a property of the backend, not of the limiter.",
        numbers: [
          "e.g. a fixed pool of 200 database connections",
          "100M identities x 100 req/min is six orders of magnitude above capacity",
        ],
        breaks:
          "Ten thousand tenants can each sit comfortably inside their limit and still take it down, and the limiter will report a healthy allow rate throughout.",
        choice: {
          pick: "Per-key limits plus a coarse per-endpoint ceiling as a backstop",
          instead: "Concurrency-based admission control that sheds by priority when backend latency degrades.",
          decider:
            "Per-key budgets sum to far past capacity, 100M identities at 100 req/min being six orders of magnitude above anything real, and the design only works because the simultaneously active set stays in a narrow band. The ceiling fires on total volume and cannot tell the tenant to shed from the tenant to protect.",
          flips:
            "At a market open or during a post-incident retry storm, when the narrow-band assumption breaks and the backend's own latency is the only signal that still means anything. That is the honest fix and this design does not have it.",
        },
      },
    },
    {
      id: "risk-gate",
      label: "Risk gate",
      sub: "fails closed, exact count",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "The same mechanism with the default inverted, sitting in front of something genuinely scarce: an order throttle ahead of a broker's exchange session capped by the venue.",
        why: "Exceeding this number does not degrade a backend, it gets the session disconnected by the venue, so the limiter must reject when it cannot verify the count. It also needs a real count rather than a statistical one, which rules out sub-counters and cross-node block reservation.",
        numbers: ["50 orders/s venue cap", "~0.005% of the quota cluster's load", "1 exact counter, no sub-counters"],
        breaks:
          "In this design it shares a cluster with the quota counters, so a single store outage produces fail-open and fail-closed behaviour at the same time. That is a known gap, not a property worth defending.",
        choice: {
          pick: "Fail closed, exact single-owner counter, its own store",
          instead: "Reuse the quota limiter's cluster and its fail-open posture, which is what this design does.",
          decider:
            "Failure domain. At 50 orders per second the throughput is trivial, so a separate store is almost free, while sharing the cluster serving 1M req/s of ordinary API traffic means the outage that trips the quota breaker also blinds the gate that must reject.",
          flips:
            "Before any real money sits behind it, one cluster is less operational surface; the sequencing argument is that the second store is worth building on the day the first risk gate goes in front of a live session.",
        },
      },
    },
    {
      id: "decision-log",
      label: "Sampled decision archive",
      sub: "1% sample, columnar on object store",
      kind: "blob",
      col: 2,
      row: 3,
      detail: {
        what: "A 1% sample of allow and deny decisions written as columnar files to object storage: identity, endpoint, decision, limit, remaining, timestamp, region and rule version.",
        why: "The over-allow metric cannot be computed from the counters themselves, because they hold current state rather than the rate actually served. This is also the only record that survives a window expiring, so abuse forensics has to come from here.",
        numbers: [
          "10k events/s at 1% of 1M req/s",
          "~300B per event, ~3MB/s",
          "~250GB/day, ~7.5TB at 30d retention",
          "alert when over_allow_rate exceeds 1.2x",
        ],
        breaks:
          "At 1% a rule misbehaving for one low-volume identity may never appear in the sample, so the archive answers aggregate questions well and single-customer questions badly.",
        choice: {
          pick: "1% sampling into columnar files on object storage",
          instead: "Log every decision, or derive over-allow from the counters.",
          decider:
            "Cost. Every decision at 1M req/s and ~300B each is 300MB/s and roughly 25TB a day; 1% is 3MB/s and ~250GB/day and still yields 10k events/s, which is ample for the aggregate. Deriving it from the counters is not an option at any price, since they never held the served rate.",
          flips:
            "Billing-grade quotas a customer will dispute, where the individual decision behind a charge has to exist in full and sampling makes the invoice unarguable in the wrong direction.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "key-builder",
      tier: "hot",
      label: "request",
      detail: {
        what: "Ordinary API traffic arriving at the edge, a million requests a second at peak.",
        why: "The limiter sits on this path rather than beside it, which is why its own latency and availability are design inputs rather than afterthoughts; everything downstream is spent in the 10ms this hop is allowed to add.",
        numbers: ["1M req/s peak, ~116k req/s average"],
        breaks:
          "A retry storm arrives here indistinguishable from real load, and it is exactly the traffic the limiter is least able to tell apart from a legitimate burst.",
      },
    },
    {
      id: "e2",
      from: "key-builder",
      to: "rule-matcher",
      tier: "hot",
      label: "(identity, scope)",
      detail: {
        what: "The composed key travelling to rule matching, carrying the identity and the endpoint class it is being counted against.",
        why: "The key is built before the rule is matched because the rule itself is keyed on scope, identifier pattern and user tier, so you cannot select a limit until you know who and what you are limiting. Keying on the account also requires auth to have already run, which is why the limiter sits behind authentication or reads a signed API key.",
        breaks:
          "Scope defined too finely explodes cardinality: per-route keys multiply the 100M identity space by the endpoint count without changing what the limit actually protects.",
      },
    },
    {
      id: "e3",
      from: "rule-matcher",
      to: "limiter-check",
      tier: "hot",
      label: "limit, window, posture",
      detail: {
        what: "The matched rule handed to the check: algorithm, limit, window length and the on-store-failure posture for this specific limit.",
        why: "The posture travels with the rule rather than being a global setting, which is what lets a quota limit fail open and a risk gate fail closed on the same node during the same outage.",
        breaks:
          "A rule with no explicit posture inherits a default, and the default being wrong for a scarce-resource limit is the failure that only shows up during the outage.",
      },
    },
    {
      id: "e4",
      from: "limiter-check",
      to: "breaker",
      tier: "hot",
      label: "verdict, or 5ms silence",
      detail: {
        what: "The store's answer, or the absence of one once the 5ms budget expires, arriving at the stage that owns the failure posture.",
        why: "Separating the check from the posture is deliberate even inside one process: the check is arithmetic and is either right or wrong, while the posture is a policy decision that differs per limit and has to be reviewable on its own.",
        numbers: ["breaker trips after 5 consecutive timeouts"],
        breaks:
          "A slow store that answers at 4.9ms never trips the breaker but eats half the request budget, which is a latency failure the fail-open metric does not catch.",
      },
    },
    {
      id: "e5",
      from: "rule-matcher",
      to: "config-service",
      tier: "control",
      label: "refetch on invalidate",
      detail: {
        what: "The lazy half of the control path: after an invalidation drops a cached entry, the next request needing that rule fetches the compiled version from the config service.",
        why: "No request data flows on this path and it runs at most once per rule change per node, not once per request, which is what makes it control rather than data. Refetching lazily rather than eagerly means a rule nobody is currently hitting costs nothing to invalidate.",
        numbers: ["~10MB of compiled rules per node", "≤1 fetch per rule per node per change"],
        breaks:
          "If the config service is unreachable at refetch time the node serves last-known-good, which is right, but it means a genuinely urgent rule change can silently fail to reach part of the fleet.",
      },
    },
    {
      id: "e6",
      from: "config-service",
      to: "invalidation-bus",
      tier: "control",
      label: "publish invalidation",
      detail: {
        what: "One small message per rule change, published the moment the write to the rule store commits.",
        why: "Publishing after the commit rather than before is what makes the refetch safe: a node that reacts instantly is guaranteed to read the new rule rather than race the write.",
        numbers: ["~10 messages/day", "0 messages before the store commit"],
        breaks:
          "If the publish fails after the commit succeeds, the rule store and the fleet diverge with no error anywhere; the reconciliation is the rule-cache-age metric, not this path.",
      },
    },
    {
      id: "e7",
      from: "invalidation-bus",
      to: "rule-matcher",
      tier: "control",
      label: "drop cached rule",
      detail: {
        what: "Fan-out of the invalidation to all ~200 gateway nodes, each dropping the named rule from its local compiled cache.",
        why: "This is the arrow that makes a rule change a sub-second event during an attack instead of a deploy that takes minutes. It carries the rule id rather than the rule body, so a dropped message costs staleness rather than divergence.",
        numbers: ["~200 subscribers", "<1s to propagate"],
        breaks:
          "If the channel is silent nobody notices, because stale rules still serve; the rule-cache-age metric is the only signal that this path has stopped working.",
      },
    },
    {
      id: "e8",
      from: "config-service",
      to: "rule-store",
      tier: "data",
      label: "reads / writes rules",
      detail: {
        what: "The authoring path: validated rule writes committed transactionally, and reads that serve the fleet's lazy refetches.",
        why: "The service and the store are separate because they fail differently. The store being down must refuse new rules; the service being down must not, on its own, stop the fleet enforcing what it already has.",
        numbers: ["~10k rules, ~10MB", "synchronous replication, RPO 0"],
        breaks:
          "A partial write of a multi-rule change leaves the fleet enforcing half a policy, which is why this is a transaction rather than a sequence of puts.",
      },
    },
    {
      id: "e9",
      from: "limiter-check",
      to: "counter-store",
      tier: "hot",
      label: "one atomic script",
      detail: {
        what: "The hot path: one round trip per request carrying the script hash, key and arguments, returning the verdict and the remaining allowance, bounded at 5ms.",
        why: "It is one call rather than a read followed by a write because the read, the compute and the write must be indivisible. The shard executes it single-threaded, so nothing else can observe or modify the key while it runs.",
        numbers: ["1M round trips/s", "~100B out, ~60B back", "~160MB/s aggregate", "5ms timeout"],
        breaks:
          "This is the arrow that turns a store degradation into a site outage if its timeout is the 1s that client libraries ship by default rather than the 5ms the budget allows.",
      },
    },
    {
      id: "e13",
      from: "breaker",
      to: "backend",
      tier: "hot",
      label: "allow",
      detail: {
        what: "The allowed request leaving the gateway for the service it was always trying to reach, with X-RateLimit headers attached to the eventual response.",
        why: "The overwhelming majority of traffic takes this arrow, which is why the whole design is optimised for the allow path costing one round trip rather than for making rejection elegant.",
        numbers: ["<10ms p99 of added overhead on this path"],
        breaks:
          "Every allowed request here was checked against a per-key budget, and those budgets sum to far more than the backend can serve, so a healthy allow rate is not evidence the backend is safe.",
      },
    },
    {
      id: "e14",
      to: "client",
      tier: "hot",
      label: "429 + Retry-After + jitter",
      from: "breaker",
      offset: 48,
      detail: {
        what: "The rejection travelling back: 429 with a jittered Retry-After and the X-RateLimit triple so the caller can self-throttle.",
        why: "This closes the loop, and the jitter is on it for a reason. Handing a million throttled clients the same retry instant means they all return together and re-trigger the limit at the next boundary.",
        numbers: ["retry_after = base + random(0, base/2)"],
        breaks:
          "It is advice, and the clients that matter ignore it; a hostile caller finds hammering cheaper than backing off because a 429 costs it less than the request it replaced.",
      },
    },
    {
      id: "e15",
      from: "breaker",
      to: "decision-log",
      tier: "control",
      label: "1% sample",
      detail: {
        what: "One decision in a hundred, allow or deny, emitted asynchronously to the archive with the rule version that produced it.",
        why: "It is off the hot path deliberately and it is sampled deliberately: full logging would be 300MB/s, and the questions it answers, over-allow rate and abuse forensics, are aggregate questions that a 1% sample answers just as well.",
        numbers: ["10k events/s", "~3MB/s, ~250GB/day"],
        breaks:
          "Sampling means a single misbehaving low-volume identity can be absent from the record entirely, so it is the wrong instrument for a per-customer dispute.",
      },
    },
    {
      id: "e16",
      from: "backend",
      to: "risk-gate",
      tier: "data",
      label: "order flow, 50/s cap",
      detail: {
        what: "The subset of allowed traffic that goes on to touch something genuinely scarce, passing a second limiter with the opposite failure default.",
        why: "It is a separate arrow and a separate service because the two limits are the same mechanism with inverted defaults, and pretending one component can hold both postures is how the contradiction ends up invisible in the design.",
        numbers: ["50 orders/s venue cap", "1 counter, exact"],
        breaks:
          "Exceeding the cap does not degrade anything gradually; the venue disconnects the session, so this is the one place where rejecting is cheaper than allowing.",
      },
    },
    {
      id: "e17",
      from: "risk-gate",
      to: "counter-store",
      tier: "control",
      label: "shares the quota cluster",
      offset: 40,
      detail: {
        what: "The gate's exact counter, which in this design lives on the same 16-primary cluster as the quota counters rather than on a store of its own.",
        why: "This is the known gap in the design rather than the intent. The intent is a dedicated store: at 50 orders per second the throughput is trivial, so a separate cluster costs almost nothing and buys an independent failure domain.",
        numbers: ["50 orders/s against 1M req/s on the same cluster", "1 shared failure domain"],
        breaks:
          "A single store outage produces fail-open and fail-closed behaviour at the same instant, so one client sees both verdicts and the platform reads as failing selectively rather than failing.",
      },
    },
  ],
};
