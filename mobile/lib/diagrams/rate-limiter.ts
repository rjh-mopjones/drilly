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
      "The first decision is the key. Identity plus scope, where identity is a user id, an API key or a caller IP, and scope is a class of endpoints rather than one route. IP keying is cheap and runs before authentication, but a NAT gateway drops thousands of users into one bucket, so key on the account wherever an authenticated identity exists.",
      "The second decision is where the count lives, and it is the real engineering. Two hundred gateway nodes each enforcing a 100 per minute limit permits 20,000 per minute, which is not a limit; dividing instead gives each node 0.5 requests per window, which is not a promise you can keep. So one shared store, sharded 16 ways because 1M req/s over a ~100k checks/s per-shard ceiling needs 10 primaries and you round up.",
      "The check itself has to be one indivisible operation executed inside the store. Read 99 against a limit of 100, decide allow, write 100, and meanwhile another node did the same and the key ends at 100 having allowed 101. At 1M req/s with a 0.5ms round trip that is the normal case, not a rare interleaving, and the clock has to be read inside the script too or 200 NTP-drifted nodes give different verdicts for the same request.",
      "The third decision is the failure posture, and it is per limit rather than global. Bound the store call at 5ms inside a 10ms budget, trip a breaker after 5 consecutive timeouts, then fail open to coarse local counters for a commercial quota and fail closed for anything guarding a scarce resource. Thirty seconds of unmetered traffic is 0.001% of a month; thirty seconds of failing closed is a total outage.",
      "Only then the algorithm, which is a thirty second discussion. GCRA, or token bucket which is the same semantics over two fields, for general APIs; sliding window counter where a boundary spike is what the downstream cannot absorb. Rejection returns 429 with Retry-After plus jitter, because a million clients handed the same backoff retry in the same instant.",
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
    {
      id: "limiter-group",
      label: "Limiter middleware (in-process)",
      kind: "group",
      x: 16,
      y: 196,
      w: 328,
      h: 424,
      detail: {
        what: "The three decisions, running as middleware inside every gateway node: build the key, match the rule, run the atomic check, and decide what to do when the store does not answer.",
        why: "Keeping all four steps in-process means the only remote call on the request path is the counter round trip, which is what makes a sub-10ms p99 overhead achievable at all across a 200 node fleet.",
        numbers: ["one remote call per request", "<10ms p99 added overhead"],
        breaks:
          "Everything here is replicated 200 times, so a bug ships to the whole fleet at once and there is no canary between the limiter and the traffic it decides on.",
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "SDK, integration or browser",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "Everything outside the trust boundary that makes requests: browsers, server-side integrations and SDKs holding an API key.",
        why: "It is drawn explicitly because the whole rejection contract depends on it. Headers and Retry-After only change behaviour if the caller reads them, and a hostile caller is under no obligation to read anything.",
        numbers: ["1M req/s at peak", "~10B requests/day", "100M distinct identities"],
        breaks:
          "A million clients handed the same Retry-After retry in the same instant, re-trigger the limit at the next boundary and oscillate; jitter fixes the well-behaved SDK, which was never the problem.",
      },
    },
    {
      id: "gateway",
      label: "API gateway node",
      sub: "~200 nodes, 5k req/s each",
      kind: "compute",
      x: 40,
      y: 100,
      w: 280,
      detail: {
        what: "The stateless edge tier that terminates the request and runs the limiter as middleware before anything downstream is touched.",
        why: "Rejecting at the edge is the point: a request stopped here never burns an app server or a database connection. The node count is also the number that settles the shared-store fork, so it belongs on the board early.",
        numbers: ["200 nodes x 5k req/s = 1M req/s", "<10ms p99 limiter overhead"],
        breaks:
          "Middleware OOM under sudden load, which shows up as container restarts and p99 spikes; it needs bounded per-identity memory and request-level timeouts so it sheds before the OOM killer fires.",
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
      id: "key-builder",
      label: "Key builder",
      sub: "(identity, scope)",
      kind: "compute",
      x: 40,
      y: 220,
      w: 280,
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
      id: "rule-lookup",
      label: "Rule matcher",
      sub: "local cache, ~10k compiled rules",
      kind: "compute",
      x: 40,
      y: 320,
      w: 280,
      detail: {
        what: "Matches (scope, identifier pattern, tier) to a rule carrying algorithm, limit, window, priority and the on-store-failure posture.",
        why: "Rules change while an attack is happening, so they are data rather than code. Tiering also lives here: joining a user to its tier from a fast cache makes a plan upgrade a cache invalidation instead of a rule rewrite.",
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
      kind: "compute",
      x: 40,
      y: 420,
      w: 280,
      detail: {
        what: "The one function everything lands on: given a key and the current time, return allow or deny and update the stored state, as a single script executed inside the store.",
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
      sub: "5ms budget, trips after 5 failures",
      kind: "compute",
      x: 40,
      y: 520,
      w: 280,
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
    {
      id: "backend",
      label: "Protected backend",
      sub: "app tier + connection pool",
      kind: "compute",
      x: 40,
      y: 680,
      w: 280,
      detail: {
        what: "The service the limit exists to protect, along with the finite resources behind it such as a fixed pool of database connections.",
        why: "It is on the diagram because it is the thing the third decision is really about. Whether it degrades or falls over at 10x nominal load is what settles fail open against fail closed, and that is a property of this box, not of the limiter.",
        numbers: ["e.g. a fixed pool of 200 database connections", "100M identities x 100 req/min is six orders of magnitude above capacity"],
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
      id: "config",
      label: "Rule config service",
      sub: "transactional store + pub/sub",
      kind: "store",
      x: 440,
      y: 320,
      w: 240,
      detail: {
        what: "Source of truth for rules, keyed on (rule_id, scope, identifier_pattern, endpoint_pattern, algorithm, limit, window, priority, on_store_failure), publishing invalidation events on a channel.",
        why: "Pushing a rule change through a deploy is too slow when an attacker is mid-attack. Nodes drop the cached rule on an invalidation event and refetch lazily, so a new rule reaches 200 nodes in under a second without a redeploy.",
        numbers: ["propagates in under a second", "~10k compiled rules, ~10MB", "rule store replicated at RPO 0"],
        breaks:
          "If it is down there are no rule refreshes; nodes serve last-known-good from cache on a rule-cache-age alert and rule creation is refused until it recovers.",
        choice: {
          pick: "Transactional config store with pub/sub invalidation and lazy refetch",
          instead: "Rules in the deploy artefact, or polled from a plain key-value store.",
          decider:
            "Propagation time under attack. Invalidate-then-refetch is under a second against minutes for a deploy, and a poll is only ever as fresh as its interval. The rule set is 10MB, small enough that the choice is entirely about latency of change, not about size.",
          flips:
            "Small or static rule sets where limits change quarterly, at which point a deploy is a perfectly good propagation channel and the control plane is pure operational cost.",
        },
      },
    },
    {
      id: "counter-store",
      label: "Sharded counter store",
      sub: "16 Redis primaries, TTL = window",
      kind: "store",
      x: 440,
      y: 420,
      w: 240,
      detail: {
        what: "The authoritative counters, one key per (identity, scope), spread over 16 primaries with a replica each and evicted by TTL at window length.",
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
    {
      id: "local-counters",
      label: "Per-node local counters",
      sub: "degraded mode, no hop",
      kind: "store",
      x: 440,
      y: 520,
      w: 240,
      detail: {
        what: "Coarse in-process counters each gateway node keeps, used when the breaker is open and available as the shape of the whole design when the round trip is unaffordable.",
        why: "Degrading to coarse local counting is materially better than degrading to no limiting at all, and it is the same mechanism as the block-reservation middle option: spend W tokens locally per round trip so the hop amortises without giving up a bound you can state.",
        numbers: [
          "200 nodes x 100/min = 20,000/min effective",
          "limit/N = 0.5 per node per minute",
          "usable when limit > 10 x N, so above ~2000 per window",
          "W = 20 bounds overshoot at N x W = 4,000",
        ],
        breaks:
          "As the primary mechanism they multiply the effective limit by the node count, so a 100 per minute limit becomes 20,000 per minute and is not a limit at all.",
        choice: {
          pick: "Local counters as the degraded fallback, plus block reservation of W tokens where the hop is unaffordable",
          instead: "Local counters as the primary mechanism, each node enforcing limit/N.",
          decider:
            "Fleet size against the limit. At 200 nodes, dividing a 100/min limit gives each node 0.5 requests per window, so any client not spreading perfectly is throttled to a fraction of what it was promised; reserving W = 20 tokens per round trip instead bounds worst-case overshoot at 4,000 rather than N x limit.",
          flips:
            "Fleet-wide protective ceilings where the limit is large relative to the fleet, since 500k req/s over 200 nodes is 2,500/s per node and the division is harmless, or a CDN edge where the nearest counter store is 80ms away.",
        },
      },
    },
    {
      id: "reject-429",
      label: "Reject path",
      sub: "429 + Retry-After + jitter",
      kind: "compute",
      x: 440,
      y: 620,
      w: 240,
      detail: {
        what: "Builds the rejection: 429 with Retry-After and X-RateLimit-{Limit,Remaining,Reset}, with the retry time jittered before it goes out.",
        why: "The rejection is a contract, not an error page. The GCRA deny path already yields the exact retry instant rather than a guess, and a wrong Retry-After is precisely what synchronises a million clients into retrying together at the next boundary.",
        numbers: ["retry_after = base + random(0, base/2)", "X-RateLimit headers on every response, not just 429s"],
        breaks:
          "A 429 is cheaper to serve than the request it replaced and cheaper for an attacker to receive, so the polite reply subsidises the hostile client it was meant to stop.",
        choice: {
          pick: "429 with headers and jittered Retry-After for the first burst, connection-level drop for a sustained offender",
          instead: "Always a clean 429, or always a connection-level drop.",
          decider:
            "Cost to the sender against debuggability. Jitter only fixes the well-behaved SDK, and at 1M req/s a 429 is cheaper to serve than the request it replaced and cheaper again for an attacker to receive, so only refusing at the connection level costs a hostile sender anything; that also removes the diagnosis for the paying customer who is merely misconfigured, which is where this design has the least to say.",
          flips:
            "APIs whose callers are all first-party or contractual, where every rejection has to be explainable and a support story about intermittent timeouts costs more than the abuse does.",
        },
      },
    },
    {
      id: "decision-log",
      label: "Sampled decision log",
      sub: "1% to columnar archive",
      kind: "store",
      x: 440,
      y: 720,
      w: 240,
      detail: {
        what: "A 1% sample of allow and deny decisions written to a columnar archive: identity, endpoint, decision, limit, remaining, timestamp, region and rule version.",
        why: "The over-allow metric cannot be computed from the counters themselves, because they hold current state rather than the rate actually served. This is also the only record that survives a window expiring, so abuse forensics has to come from here.",
        numbers: [
          "10k events/s at 1% of 1M req/s",
          "~300B per event, ~3MB/s",
          "~250GB/day, ~7.5TB at 30d retention",
          "alert when over_allow_rate exceeds 1.2x",
        ],
        breaks:
          "At 1% a rule misbehaving for one low-volume identity may never appear in the sample, so the log answers aggregate questions well and single-customer questions badly.",
        choice: {
          pick: "1% sampling into a columnar archive",
          instead: "Log every decision, or derive over-allow from the counters.",
          decider:
            "Cost. Every decision at 1M req/s and ~300B each is 300MB/s and roughly 25TB a day; 1% is 3MB/s and ~250GB/day and still yields 10k events/s, which is ample for the aggregate. Deriving it from the counters is not an option at any price, since they never held the served rate.",
          flips:
            "Billing-grade quotas a customer will dispute, where the individual decision behind a charge has to exist in full and sampling makes the invoice unarguable in the wrong direction.",
        },
      },
    },
    {
      id: "risk-gate",
      label: "Risk gate",
      sub: "fails closed, own store",
      kind: "compute",
      x: 440,
      y: 820,
      w: 240,
      detail: {
        what: "The same mechanism with the default inverted, sitting in front of something genuinely scarce: an order throttle ahead of a broker's exchange session capped by the venue.",
        why: "Exceeding this number does not degrade a backend, it gets the session disconnected by the venue, so the limiter must reject when it cannot verify the count. It also needs a real count rather than a statistical one, which rules out sub-counters and cross-node block reservation.",
        numbers: [
          "50 orders/s venue cap",
          "trivial throughput, so a dedicated store costs almost nothing",
          "fail_closed_rejects tracked separately from fail_open_rate",
        ],
        breaks:
          "Today it shares a cluster with the quota counters, so a single store outage produces fail-open and fail-closed behaviour at the same time. That is a known gap, not a design worth defending.",
        choice: {
          pick: "Fail closed, exact single-owner counter, its own store",
          instead: "Reuse the quota limiter's cluster and its fail-open posture.",
          decider:
            "Failure domain. At 50 orders per second the throughput is trivial, so a separate store is almost free, while sharing the cluster serving 1M req/s of ordinary API traffic means the outage that trips the quota breaker also blinds the gate that must reject.",
          flips:
            "Before any real money sits behind it, one cluster is less operational surface; the sequencing argument is that the second store is worth building on the day the first risk gate goes in front of a live session.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "gateway",
      label: "request",
      animated: true,
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
      from: "gateway",
      to: "key-builder",
      label: "identity resolved",
      detail: {
        what: "The request handing over its authenticated identity, or the absence of one, to the key builder.",
        why: "Ordering matters here: keying on the account requires auth to have already run, so the limiter sits behind authentication or reads a signed API key. Keying on IP is the only option available before that point.",
        breaks:
          "If auth is expensive and runs before the limiter, an attacker can burn auth capacity with requests the limiter would have rejected for free.",
      },
    },
    {
      id: "e3",
      from: "key-builder",
      to: "rule-lookup",
      label: "(identity, scope)",
      detail: {
        what: "The composed key travelling to rule matching, carrying the identity and the endpoint class it is being counted against.",
        why: "The key is built before the rule is matched because the rule itself is keyed on scope, identifier pattern and user tier, so you cannot select a limit until you know who and what you are limiting.",
        breaks:
          "Scope defined too finely explodes cardinality: per-route keys multiply the 100M identity space by the endpoint count without changing what the limit actually protects.",
      },
    },
    {
      id: "e4",
      from: "rule-lookup",
      to: "config",
      label: "invalidate + refetch",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The control path: invalidation events pushed down, and a lazy refetch of the compiled rule when a cached entry is dropped.",
        why: "Drawn as a control path because no request data flows on it. It exists so a rule change reaches 200 nodes in under a second during an attack, instead of waiting on a deploy.",
        numbers: ["~10MB of compiled rules per node", "under a second to propagate"],
        breaks:
          "If the channel is silent nobody notices, because stale rules still serve; the rule-cache-age metric is the only signal that this path has stopped working.",
      },
    },
    {
      id: "e5",
      from: "rule-lookup",
      to: "limiter-check",
      label: "limit, window, posture",
      detail: {
        what: "The matched rule handed to the check: algorithm, limit, window length and the on-store-failure posture for this specific limit.",
        why: "The posture travels with the rule rather than being a global setting, which is what lets a quota limit fail open and a risk gate fail closed on the same node during the same outage.",
        breaks:
          "A rule with no explicit posture inherits a default, and the default being wrong for a scarce-resource limit is the failure that only shows up during the outage.",
      },
    },
    {
      id: "e6",
      from: "limiter-check",
      to: "counter-store",
      label: "one atomic script, 5ms budget",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The hot path: one round trip per request carrying the script hash, key and arguments, returning the verdict and the remaining allowance.",
        why: "It is one call rather than a read followed by a write because the read, the compute and the write must be indivisible. The shard executes it single-threaded, so nothing else can observe or modify the key while it runs.",
        numbers: ["1M round trips/s", "~100B out, ~60B back", "~160MB/s aggregate"],
        breaks:
          "This is the arrow that turns a store degradation into a site outage if its timeout is the 1s that client libraries ship by default rather than the 5ms the budget allows.",
      },
    },
    {
      id: "e7",
      from: "limiter-check",
      to: "breaker",
      label: "verdict, or silence at 5ms",
      detail: {
        what: "The store's answer, or the absence of one once the 5ms budget expires, arriving at the component that owns the failure posture.",
        why: "Separating the check from the posture is deliberate: the check is arithmetic and is either right or wrong, while the posture is a policy decision that differs per limit and has to be reviewable on its own.",
        numbers: ["breaker trips after 5 consecutive timeouts"],
        breaks:
          "A slow store that answers at 4.9ms never trips the breaker but eats half the request budget, which is a latency failure the fail-open metric does not catch.",
      },
    },
    {
      id: "e8",
      from: "breaker",
      to: "local-counters",
      label: "degrade when open",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The degraded path taken while the breaker is open: coarse per-node counting instead of the shared authoritative count.",
        why: "Failing open should mean degrading to something rather than to nothing. Local counters over 200 nodes are a bad limit, but a bad limit during a 30 second failover is better than an unmetered edge.",
        numbers: ["200 nodes x limit as the worst case", "RTO 30s while the store fails over"],
        breaks:
          "The over-allow during this window is invisible in the counters and only recoverable from the 1% sampled decision log afterwards.",
      },
    },
    {
      id: "e9",
      from: "breaker",
      to: "backend",
      label: "allow",
      animated: true,
      detail: {
        what: "The allowed request continuing to the service it was always trying to reach, with X-RateLimit headers attached to the eventual response.",
        why: "The overwhelming majority of traffic takes this arrow, which is why the whole design is optimised for the allow path costing one round trip rather than for making rejection elegant.",
        numbers: ["<10ms p99 of added overhead on this path"],
        breaks:
          "Every allowed request here was checked against a per-key budget, and those budgets sum to far more than the backend can serve, so a healthy allow rate is not evidence the backend is safe.",
      },
    },
    {
      id: "e10",
      from: "breaker",
      to: "reject-429",
      label: "deny",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A denied request routed to the rejection path, carrying the exact retry instant the GCRA deny branch computed.",
        why: "Denial short-circuits before anything downstream is touched, which is the entire economic argument for the limiter: the rejected request costs a script execution rather than an app server and a database connection.",
        breaks:
          "The deny rate per rule is the signal that a config push went wrong, so this arrow needs a per-rule metric on it or a bad rule looks like a quiet day.",
      },
    },
    {
      id: "e11",
      from: "reject-429",
      to: "client",
      label: "429 + Retry-After",
      fromSide: "right",
      toSide: "right",
      offset: 120,
      detail: {
        what: "The rejection travelling back: 429 with a jittered Retry-After and the X-RateLimit triple so the caller can self-throttle.",
        why: "This closes the loop, and the jitter is on it for a reason. Handing a million throttled clients the same retry instant means they all return together and re-trigger the limit at the next boundary.",
        numbers: ["retry_after = base + random(0, base/2)"],
        breaks:
          "It is advice, and the clients that matter ignore it; a hostile caller finds hammering cheaper than backing off because a 429 costs it less than the request it replaced.",
      },
    },
    {
      id: "e12",
      from: "breaker",
      to: "decision-log",
      label: "1% sample",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      offset: 40,
      detail: {
        what: "One decision in a hundred, allow or deny, emitted asynchronously to the archive with the rule version that produced it.",
        why: "It is off the hot path deliberately and it is sampled deliberately: full logging would be 300MB/s, and the questions it answers, over-allow rate and abuse forensics, are aggregate questions that a 1% sample answers just as well.",
        numbers: ["10k events/s", "~3MB/s, ~250GB/day"],
        breaks:
          "Sampling means a single misbehaving low-volume identity can be absent from the record entirely, so it is the wrong instrument for a per-customer dispute.",
      },
    },
    {
      id: "e13",
      from: "backend",
      to: "risk-gate",
      label: "order flow, 50/s venue cap",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The subset of allowed traffic that goes on to touch something genuinely scarce, passing a second limiter with the opposite failure default.",
        why: "It is a separate arrow and a separate component because the two limits are the same mechanism with inverted defaults, and pretending one component can hold both postures is how the contradiction ends up invisible in the design.",
        numbers: ["50 orders/s venue cap", "no sub-counters and no block reservation on this path"],
        breaks:
          "Both limiters currently share one counter cluster, so a single outage waves quota traffic through while rejecting order flow, and the same client sees both verdicts.",
      },
    },
  ],
};
