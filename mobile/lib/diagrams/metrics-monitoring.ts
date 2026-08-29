import type { Diagram } from "./types";

export const METRICS_MONITORING: Diagram = {
  id: "metrics-monitoring",
  title: "Metrics Monitoring",
  question: "Design a Metrics Monitoring & Alerting System",
  sourceId: "patterns",
  itemId: 17,
  overview: {
    shape:
      "One append-only time-series store with a write path that is allowed to say no, and two independent readers hanging off it: humans looking at dashboards, and an evaluator that pages someone when a number stays bad long enough to matter.",
    beats: [
      {
        text: "Collection is a pull by default. The agent reads its target list from service discovery and scrapes every endpoint every 10 seconds, which puts the cadence under your control and turns a dead target into an observation (`up == 0`) rather than an ambiguous silence. A push gateway exists beside it, but as the explicit exception path for jobs that live shorter than a scrape interval or sit behind a boundary you cannot poll into.",
        lights: ["targets", "collector", "pushgw", "e2", "e3"],
      },
      {
        text: "The write path is one service, not five. Inside it five stages run cheapest first with no network hop between them: relabel drops, a known-series hash lookup that at steady state hits for essentially every one of the 1M samples/s, then the per-metric budget, the per-tenant cap and a label-value heuristic. Only the miss path, a few thousand per second during a deploy, ever reaches the expensive checks, and that is the entire reason a limiter is affordable at this rate.",
        lights: ["write-path", "relabel", "known-series", "metric-budget", "tenant-cap", "label-guard"],
      },
      {
        text: "Storage is purpose-built and nothing like a row store. Timestamps arrive at a near-fixed cadence and values move slowly, so delta-of-delta on the timestamp and XOR on the float take a 16 byte sample down to about 1.5 bytes. Ingesters hold a head block in memory and a write-ahead log on local NVMe, keep the 10 second tier on that disk for 7 days, and seal a 2 hour immutable block into object storage.",
        lights: ["ingesters", "e14"],
      },
      {
        text: "Retention is three resolutions rather than one, because a year of 10 second data is 47TB against 131GB downsampled, a factor of 360. A compactor reads the sealed blocks back out of object storage, merges them, deduplicates the redundant collector pair by (series, timestamp), rolls 10s into 1 minute and 1 hour, and writes them back where the whole cold tier costs under 10 dollars a month.",
        lights: ["compactor", "object-store", "e15", "e16"],
      },
      {
        text: "The read side is two pools over two halves. A query frontend fans out across recent data still held by the ingesters and historical blocks behind a store gateway, routing by requested step size so a long range lands on a coarse tier, and it rejects a raw one year query outright instead of letting it time out. The alert evaluator gets its own reader pool against the ingesters, because 10,000 rules on a 30 second interval is roughly 330 evaluations per second, comparable to the entire dashboard load, and a capacity-planning query must never starve it.",
        lights: ["query-frontend", "evaluator", "ingesters", "e17", "e-historical", "e21"],
      },
      {
        text: "Alerting is a state machine plus a router. Each rule holds pending, firing and resolved state and only fires once the condition has held for its configured duration, then the router groups, silences and inhibits before anything reaches a person, because 200 pages for one database failure is the same as no pages at all.",
        lights: ["evaluator", "router", "notify", "e22", "e23"],
      },
    ],
    crux:
      "The system is priced per series, not per sample, and the label sets that create series are chosen by application teams rather than by you. A sample costs 1.5 bytes on disk; a series costs 3 to 4KB of ingester memory the moment it is created. That is three orders of magnitude of asymmetry, which is why the control has to sit on the write path: by the time a query runs, the memory is already spent. And every cap in the design bounds concurrent series while doing nothing about churn.",
    numbers: [
      "10M active series, 1M samples/s steady, 3M peak",
      "1.5B per sample vs 3 to 4KB per series",
      "caps: 1M series per metric, 2M per tenant",
    ],
  },
  nodes: [
    // --- collection ---
    {
      id: "targets",
      label: "Services and hosts",
      sub: "10,000 hosts, ~1,000 series each",
      kind: "service",
      col: 0,
      row: 0,
      detail: {
        what: "Our own instrumented processes exposing a metrics endpoint, plus a node agent and containers on every host.",
        why: "Drawn explicitly because this is the part the monitoring team does not control and it sets the whole constraint. These are inside the trust boundary and on someone's pager, which is exactly what makes the fix a conversation with a named team rather than a vendor ticket: the label sets on these metrics are written by application teams, and one deploy adding `user_id` decides your capacity.",
        numbers: [
          "10,000 hosts",
          "500 to 2,000 series per instrumented service once histogram buckets are counted",
          "10M active series total",
        ],
        breaks:
          "A deploy ships a runaway label set and this one target's series count goes multiplicative, with no warning that anything changed except the counters downstream.",
        choice: {
          pick: "Expose a pull-scrapeable /metrics endpoint from every process",
          instead: "Bundle a push SDK into every service that ships samples to a collector on its own schedule.",
          decider:
            "Who owns the cadence for 10,000 hosts. A pull endpoint costs one library and zero outbound network config; a push SDK means every one of those hosts independently decides its own send interval and retry policy, which the monitoring team then has to reconcile after the fact rather than set once.",
          flips:
            "A process that genuinely cannot be polled, behind a boundary or living shorter than a scrape interval, which is exactly the exception the push gateway exists to catch rather than the default for all 10,000 hosts.",
        },
      },
    },
    {
      id: "pushgw",
      label: "Push gateway",
      sub: "exception path, not the door",
      kind: "gateway",
      col: 0,
      row: 1,
      detail: {
        what: "An authenticated ingest endpoint that terminates, rate-limits and forwards what scraping cannot reach: sub-interval jobs, client-side telemetry, workloads behind a network boundary.",
        why: "It exists because the pull default has a hole rather than because push is a second opinion. Keeping it explicitly the exception is what stops the service-discovery machinery and the liveness convention from having to be reinvented per team.",
        numbers: [
          "accepts what a 10s scrape structurally cannot see",
          "bounded buffer, ~5 minutes of burst",
        ],
        breaks:
          "Silence through this path means nothing, so every workload behind it needs its own explicit liveness signal, and the gateway inherits whatever rate producers choose rather than owning the cadence. Past the buffer the correct behaviour is to shed, not to queue.",
        choice: {
          pick: "A gateway with real backpressure, used only for what cannot be scraped",
          instead: "Make push the front door for the whole fleet and delete the collector tier.",
          decider:
            "Where the liveness convention lives. Scraping gives you one `up` series per target for free across 10,000 hosts; push makes liveness a per-team piece of work that has to be written 10,000 times and reviewed once per team. The gateway also inherits the producers' rate, so it needs a bounded buffer and a shed policy that a scraper never needs.",
          flips:
            "Client-side or third-party telemetry, where there is nothing to poll at all, and any fleet that is mostly serverless or short-lived.",
        },
      },
    },
    {
      id: "collector",
      label: "Collector / agent",
      sub: "service discovery, 10s",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "An agent per host or pod that reads its target list from service discovery — the platform's own registry, re-read continuously rather than at boot — and pulls every endpoint on a fixed 10 second schedule, applying relabel rules before it forwards.",
        why: "Pulling puts the cadence under one owner instead of inheriting whatever each team configured, and it makes failure detection free: a target that does not answer is something the collector observed, so `up == 0` is a fact rather than an inference. That only works because service discovery makes `up == 0` mean something: the collector knows a target should have answered because the registry said so, which is the whole difference between an observed failure and an absence nobody can distinguish from a healthy idle service. It runs as a redundant pair per target, deduplicated later by the `cluster` and `replica` labels.",
        numbers: [
          "10s scrape interval",
          "1M samples/s steady, 3M peak",
          "~29MB/s on the wire after snappy, a quarter of a 1GbE link",
          "registry: 10,000 hosts, target list re-read on the order of every 30s",
        ],
        breaks:
          "Anything that does not survive two scrape intervals is invisible to it. A 5 second cron or a function invocation is gone before the next poll and no tuning fixes that. A target missing from the registry is never scraped and never produces `up == 0`, so it is invisible rather than down — registry staleness is the one failure the pull model cannot observe about itself.",
        choice: {
          pick: "Scrape discoverable targets every 10s, with relabel rules applied at the agent",
          instead: "Push for everything: each process ships its own samples to a gateway on its own schedule and the collector tier disappears.",
          decider:
            "Whether targets are enumerable and outlive a couple of intervals. At 10s a process must survive ~20s to be sampled twice and ~30s to produce a usable rate. The second half is failure detection: with scraping `up == 0` is an observation, while with push absence is ambiguous, so every pushed workload needs its own liveness signal and that work scales with the number of teams.",
          flips:
            "A mostly short-lived or serverless fleet, or a network that will not let a central collector reach the targets: customer-deployed agents, mobile clients, a partner's VPC. Most deployments run both, so the question is only which one is the default.",
        },
      },
    },

    // --- the write path: one service, five stages ---
    {
      id: "write-path",
      label: "Distributor",
      sub: "five checks, cheapest first",
      kind: "serviceGroup",
      col: 1,
      row: 2,
      detail: {
        what: "One deployable write service in front of the ingesters. Every sample, scraped or pushed, passes the same five stages in the same process: relabel drops, a known-series hash lookup, the per-metric budget, the per-tenant cap, and a label-value heuristic.",
        why: "Five stages of one request path, not five services: there is no network hop between them and no stage that scales or fails on its own, so the ordering is the design rather than the deployment. And the whole system turns on this component. A sample costs 1.5 bytes and lands in a chunk that already exists; a series costs 3 to 4KB of ingester memory at creation and keeps costing it. Query-time limits cannot help, because the memory was spent here before any query ran.",
        numbers: [
          "1M samples/s steady, 3M peak, through one code path",
          "caps: 1M series per metric name, 2M active series per tenant",
          "steady-state known-series hit rate near 100%",
          "miss path: a few thousand new series per second during a deploy",
        ],
        breaks:
          "It bounds concurrent series and does nothing about churn. A pod name is bounded at 200 at any instant and produces ~158,000 distinct values over 13 months of twice-daily deploys, so active series holds flat, every cap stays green, and long-range queries still fan out across blocks whose series sets barely overlap.",
        choice: {
          pick: "Refuse at ingest, with every drop counted under `metric_dropped_total{tenant, metric, reason}` and returned to the sender as an error",
          instead: "Accept every write and defend the read path instead: cap the series one query may touch and kill it when it exceeds its memory budget.",
          decider:
            "The series count the ingester tier can hold, which is a memory number and not a disk number. At 3 to 4KB of head per active series, 10 ingesters with 32GB each gives roughly 8 to 10M series of headroom, and past that the ingester OOMs and WAL replay takes minutes rather than degrading.",
          flips:
            "A storage engine that keeps its index on disk rather than in a head block, so the ceiling is disk and disk degrades gracefully. Also a single-tenant deployment, where the team that blows up cardinality is the team that gets paged and the feedback loop closes without enforcement.",
        },
      },
    },
    {
      id: "relabel",
      label: "1. Relabel drop",
      sub: "static rules, one map lookup",
      kind: "process",
      col: 1,
      row: 2,
      parent: "write-path",
      detail: {
        what: "A static rule set applied before anything else: drop this metric entirely, strip this label from every metric, keep only this allowlist for this job.",
        why: "First because it is the only stage with no state and no lookup, so it is the cheapest place to delete work. It is also the only stage that can do anything about churn: removing `pod` from a metric that only ever needed `deployment` prevents the series from being created at all, which no downstream cap can do. The same rules are also applied at the agent, so a drop can happen before the wire.",
        numbers: [
          "one map lookup per sample, no state",
          "runs on all 1M samples/s",
        ],
        breaks:
          "It is a config file nobody reviews with the cardinality budget in front of them, so the rule that would have saved you is usually written the week after the incident.",
        choice: {
          pick: "Strip rotating identity labels (`pod`, `instance`, `container_id`, `replicaset`) from anything intended to be queried historically",
          instead: "Keep every identity label and let the caps downstream hold the line.",
          decider:
            "Cumulative series over the retention window rather than concurrent series. 200 pods at two deploys a day for 13 months is ~158,000 distinct values from one label, no two generations of which ever coexist, so every cap stays green while each sealed block carries its own index over a nearly disjoint series set.",
          flips:
            "Short retention, where cumulative and concurrent are close enough that churn never bites. The cost is real either way: once `pod` is stripped, 'which pod was the bad one' is unanswerable for any block that has rotated out of the hot tier, which is exactly the post-incident question.",
        },
      },
    },
    {
      id: "known-series",
      label: "2. Known series?",
      sub: "hash the label set, hits ~100%",
      kind: "process",
      col: 1,
      row: 2,
      parent: "write-path",
      detail: {
        what: "Hash the full label set and look up the series id. A hit skips every remaining stage and appends straight to that series' open chunk.",
        why: "This is the stage that makes a limiter affordable at 1M samples per second. 10M series producing 1M samples/s means essentially every sample belongs to a series that already exists, so the expensive checks below run at the churn rate — a few thousand a second during a deploy, near zero otherwise — rather than at the sample rate.",
        numbers: [
          "near-100% hit rate at steady state",
          "miss path a few thousand per second during a deploy",
          "a hit costs one hash and one map lookup",
        ],
        breaks:
          "The miss rate is set by deploy cadence, a number nobody on the monitoring team controls, so the expensive path is driven entirely by someone else's release schedule.",
      },
    },
    {
      id: "metric-budget",
      label: "3. Per-metric budget",
      sub: "reject past 1M series per metric",
      kind: "process",
      col: 1,
      row: 2,
      parent: "write-path",
      detail: {
        what: "Reject the new series if its `metric_name` already holds 1M distinct label combinations.",
        why: "It bounds the blast radius of one bad metric to that metric. Past roughly a million series a single `rate(metric[5m])` has to touch a million postings entries and stops being affordable, and that matters most because alert rules run those queries 330 times a second.",
        numbers: [
          "1M series per metric name, hard cap",
          "`method`(5) x `status`(10) x `host`(1,000) = 50,000, which is fine",
          "the same metric plus `user_id` at 10,000 users = 500M, which is not",
        ],
        breaks:
          "The cap fires on the metric, not on the label that caused it, so it tells the on-call that something exploded without telling them what to delete. That answer lives in a cardinality explorer over the head index, diffed against 24 hours ago.",
      },
    },
    {
      id: "tenant-cap",
      label: "4. Per-tenant cap",
      sub: "2M active series, 429 to sender",
      kind: "process",
      col: 1,
      row: 2,
      parent: "write-path",
      detail: {
        what: "Reject if the tenant is already at 2M active series, and return an explicit HTTP error rather than dropping quietly.",
        why: "It bounds the blast radius of one bad team to that team: 2M is 20% of the 10M the ingester tier can hold, so no tenant can consume more than a fifth of the head memory everyone shares. The error is the important half — a remote-write client that receives a 200 for a dropped sample never retries it and never tells anyone. Every drop is counted under `metric_dropped_total{tenant, metric, reason}`.",
        numbers: [
          "2M active series per tenant, 20% of the 10M ceiling",
          "alert at 80% of the cap, before any drop starts",
        ],
        breaks:
          "A tenant sitting on its cap has rules that return no data, and a rule that returns no data does not fire, so the limiter converts a loud failure into silence for exactly the team it is throttling.",
      },
    },
    {
      id: "label-guard",
      label: "5. Label-value guard",
      sub: "heuristic: UUID or PII leak",
      kind: "process",
      col: 1,
      row: 2,
      parent: "write-path",
      detail: {
        what: "The only stage that inspects values: a label key that has seen more distinct values than its threshold in a rolling window is almost always a UUID, a request id, an email address or a raw URL path.",
        why: "Stages 3 and 4 catch the explosion only after it has already cost a million series. This one catches the shape of the mistake — an unbounded value space on one key — and it is last because it is the only stage that has to hold per-label-key state, against a threshold configurable per label key.",
        numbers: [
          "runs only on the miss path, never on the 1M samples/s",
          "a legitimate 50,000-customer dimension trips it identically",
        ],
        breaks:
          "It has no way to tell a leak from a deliberately wide dimension, so tuned tight it deletes a team's intentional metric and tuned loose it catches nothing.",
        choice: {
          pick: "Warn first, then drop at a per-label-key threshold a team can raise deliberately",
          instead: "Drop immediately on any label key past a single global threshold.",
          decider:
            "The false-positive rate, which is not small: a 50,000-customer dimension and a leaked `request_id` are indistinguishable by distinct-value count alone. A warning is reversible and a rejected series is not — it is gone, along with whatever it would have explained.",
          flips:
            "A multi-tenant deployment where one tenant's leak takes down every other tenant's alerting. There the cost of a wrong drop is one team's graph and the cost of a miss is everyone's pager.",
        },
      },
    },

    // --- the tier whose ceiling is memory ---
    {
      id: "ingesters",
      label: "Ingesters",
      sub: "head block + WAL, RF 3",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "The sharded write tier, and the reader for everything recent. Each ingester owns roughly 1M active series in an in-memory head block with a write-ahead log, and its own local NVMe: the WAL plus Gorilla-compressed chunks at raw 10 second resolution, with an inverted postings index from label key-value pair to series id. Nothing reads that disk directly except the ingester that owns it, which serves every query over the 7-day hot window and seals a 2 hour immutable block on a fixed schedule.",
        why: "Sharded because the head block is the real capacity limit: 10M series at 4KB is 40GB, more than one node should hold. Replicated three ways because an ingester restart would otherwise be a hole in the data exactly when someone is reading it during an incident. The disk is local NVMe specifically so WAL replay is measured in seconds, and delta-of-delta on timestamps plus XOR on floats is the storage design, not an add-on: samples arrive at a near-fixed cadence and values move slowly, so a 16-byte sample compresses to about 1.5 bytes and every read is a time range over a label selector rather than a point lookup.",
        numbers: [
          "1M series per ingester, ~4GB of head",
          "10 ingesters, RF 3, 30 replicas",
          "blocks sealed every 2 hours",
          "disk: 16B raw down to ~1.5B/sample, 907GB compressed, ~3TB at RF 3, postings ~150MB per replica set",
        ],
        breaks:
          "It OOMs on cardinality rather than on volume, and the recovery is slow: WAL replay takes minutes, and for that whole window alerting is reading from a shrunken quorum. Reads land on the same nodes absorbing 1M samples/s, so a heavy query competes directly with ingestion. The disk tier is priced in SSD rather than in cents, so its retention argument is a real capacity conversation unlike the cold tier.",
        choice: {
          pick: "Shard by series into 10 ingesters at 1M series each, replication factor 3",
          instead: "One large node holding the entire head block, or replication factor 1 with a fast restore from the WAL.",
          decider:
            "40GB of head memory for 10M series is more than one node should own, and RF 1 means an OOM plus a multi-minute WAL replay is a gap in the data during the incident that caused it. RF 3 across 30 replicas keeps a quorum readable while one replays.",
          flips:
            "Under about 2M active series, where the head fits comfortably on one machine and a second node buys operational cost rather than headroom.",
        },
      },
    },

    // --- read paths ---
    {
      id: "evaluator",
      label: "Alert evaluator",
      sub: "pending/firing/resolved",
      kind: "service",
      col: 0,
      row: 3,
      detail: {
        what: "Runs each rule on a fixed interval, holds per-rule state, and only emits once the condition has held for its configured `for` duration: pending, then firing, then resolved.",
        why: "Alerting is not a feature bolted onto dashboards, it is an independent reader of the same data with a different latency budget and a different failure mode. That is why it gets its own reader pool rather than queueing behind a human's ad hoc query.",
        numbers: [
          "10,000 rules on a 30s interval = ~330 evaluations/s",
          "`for: 5m` at a 10s scrape holds across ~30 samples",
          "60s delivery budget from trigger",
        ],
        breaks:
          "A rule that returns no data does not fire, so a tenant the write path has silenced produces silence rather than an alert, and everyone reads silence as healthy.",
        choice: {
          pick: "A separate evaluator with its own reader pool and a per-rule hold duration",
          instead: "Evaluate rules through the same querier pool that serves dashboards, and fire on the first true evaluation.",
          decider:
            "Alerting generates ~330 evaluations per second, comparable to the entire dashboard load, and dashboards spike 10x during exactly the incident when rules must keep running. On the hold: `for: 5m` at a 10s scrape means the condition held across roughly 30 samples, which removes essentially all single-scrape noise, and `for: 30s` does not.",
          flips:
            "A deployment small enough that one pool serves both without contention, where a second pool is cost with no isolation benefit.",
        },
      },
    },
    {
      id: "query-frontend",
      label: "Query frontend",
      sub: "PromQL, routes by step size",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "The read entry point for humans: parses the query, reads the requested step, picks a resolution tier, and fans out across recent data still held by the ingesters and historical blocks behind the store gateway.",
        why: "Tier selection has to be automatic because nobody writing a dashboard panel knows which tier holds their range. Rejecting an impossible query is part of the job: a clear error beats a request that runs for two minutes and then times out.",
        numbers: [
          "~330 queries/s steady, ~10x during an incident",
          "p99 under 1s target",
          "1 year at 10s is 3.15M points per series against 8,760 hourly",
        ],
        breaks:
          "A long-range query saturates the store gateway. Without step-size routing and its own pool separation, one capacity-planning question starves the 330 rule evaluations per second sharing the read path.",
        choice: {
          pick: "Route by requested step, and reject raw range queries past the 7 day hot window",
          instead: "Always read the finest tier available and let the query planner sort it out at runtime.",
          decider:
            "1 year at 10s resolution is 3.15M points per series against 8,760 hourly. That query does not run slowly, it does not run at all, so the choice is between an error at parse time and a timeout after two minutes of store-gateway load that also hurts everyone else.",
          flips:
            "Single-resolution deployments with short retention, where there is no coarser tier to route to and the planner has nothing to decide.",
        },
      },
    },
    {
      id: "object-store",
      label: "Object storage",
      sub: "warm 1m/90d, cold 1h/1y",
      kind: "blob",
      col: 3,
      row: 3,
      detail: {
        what: "Immutable time-ranged blocks: the 2 hour blocks the ingesters upload, and the merged, deduplicated, coarser blocks the compactor writes back in their place. A stateless store-gateway tier sits in front of every read, keeping each block's index header resident so it can resolve a label selector to the blocks that could contain it without listing objects, fan the reads out across them, and return one copy per (series, timestamp).",
        why: "Long retention on local disk is 47TB of raw per replica, which no node holds. Pushing sealed blocks here turns the year of history into a bill rather than a cluster, and the bill is small enough that the cold tier is never the argument. Object storage itself has no index, so something has to hold the map from label selector to block or a long-range query becomes a listing of a year of objects; caching index headers is the difference between a warm map lookup and thousands of object-storage round trips per query. This is also the last place the redundant collector pair is made invisible, so a `rate()` is not silently doubled after a failover.",
        numbers: [
          "warm ~1.94TB, ~6TB at RF 3",
          "cold 131GB, ~400GB at RF 3",
          "under $10/month at $0.023/GB-month",
          "a year of 2h blocks is 4,000+ objects to consider per query; postings ~150MB per replica set",
          "a cold gateway after failover costs 10-15min of degraded query",
          "cross-region replicated async, ~1min lag",
        ],
        breaks:
          "An S3 outage stalls block uploads, so compactor retries pile up and ingesters keep flushing locally until someone notices local disk filling. A single long-range query saturates the gateway tier: a year-long selector fans out across blocks whose series sets are nearly disjoint, and downsampling shrank the samples without shrinking any of those indexes.",
        choice: {
          pick: "Sealed blocks in object storage with a store gateway fanning out across them",
          instead: "A sharded cluster holding the full retention on dense local disk.",
          decider:
            "Cost against component count. 400GB of cold tier at object-storage pricing is under $10/month against SSD for the same year, but it buys roughly eight interacting components to operate. A dense-local-disk engine reaching ~0.4B/sample rather than 1.5B moves the arithmetic another 4x in the other direction.",
          flips:
            "When staffing is the constraint. A component count you cannot fund is a permanent operational tax, and cheaper storage you cannot operate is not cheaper.",
        },
      },
    },
    {
      id: "compactor",
      label: "Compactor + downsampler",
      sub: "merge, dedupe, roll up",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "A background job that reads sealed 2 hour blocks back out of object storage, merges them, deduplicates the redundant collector pair by a (series, timestamp) key using the `cluster` and `replica` external labels, produces 1 minute and 1 hour rollups, and writes them back. It runs only on sealed blocks, never on the head.",
        why: "It exists so retention becomes a storage-cost question rather than a capacity-planning one. Dedup lives here rather than on the write path because samples are idempotent by timestamp, so a duplicate is a no-op and can be resolved lazily — which is precisely the property an order-flow pipeline does not have.",
        numbers: [
          "10s to 1m is 6x, 10s to 1h is 360x",
        ],
        breaks:
          "Downsampling is irreversible. The honest form of the decision is whether anyone will ever need the exact shape of a 30 second spike from four months ago, because after this job runs they cannot have it.",
        choice: {
          pick: "Three resolutions: 10s for 7 days, 1 minute for 90 days, 1 hour for a year",
          instead: "One resolution forever: keep every raw sample for the full retention and spend the saved complexity on a denser engine and cheaper disk.",
          decider:
            "A year of 10s data is 47TB against 131GB downsampled, a factor of 360 (8,640 samples per day against 24). Then measure the query mix: if under 5% of queries reach beyond 7 days, downsampling costs nothing anyone notices.",
          flips:
            "Short retention, where 360x of a small number is still small. 30 days at 10s is 3.9TB, which one dense engine holds on local disk, and choosing that deletes the compactor, the downsampling jobs and the tier-selection logic outright.",
        },
      },
    },

    // --- delivery ---
    {
      id: "router",
      label: "Alert router",
      sub: "group, silence, inhibit",
      kind: "service",
      col: 0,
      row: 4,
      // Nudged 20px right of the evaluator/notify column so the dead-man's-switch
      // edge has a clear lane down the outside instead of hugging this box's border.
      detail: {
        what: "Takes raw firings and applies three transformations before any human sees them: grouping by label set, silencing during declared maintenance, and inhibition of symptoms while a known cause is firing.",
        why: "The scarce resource on the delivery side is on-call attention. 200 pages for one database failure is the same as none, so collapsing them is not a nicety, it is what makes the alert mean anything at all.",
        numbers: [
          "100 pods on one database failure collapse to 1 notification",
          "inhibition: `db_down` mutes dependent `api_5xx`",
        ],
        breaks:
          "Inhibition rules encode a dependency graph that nobody updates. When the graph is wrong it suppresses the alert that was actually the cause, and the suppression is invisible.",
        choice: {
          pick: "A router doing grouping, silencing and inhibition before delivery",
          instead: "Deliver every firing straight to its channel and let the on-call filter.",
          decider:
            "Fan-out during a real failure. One database going down fires an alert on every one of the roughly 100 dependent services, and an on-call taking 200 pages reads none of them. Grouping turns that into one notification with the same information.",
          flips:
            "A single team with a handful of rules, where the routing table is more configuration than the alerts are worth.",
        },
      },
    },
    {
      id: "dashboards",
      label: "Dashboards",
      sub: "1,000 engineers, 30s refresh",
      kind: "client",
      col: 2,
      row: 4,
      detail: {
        what: "The human read path: browser panels refreshing on a fixed interval against the query frontend.",
        why: "It is its own consumer because its load profile is the opposite of alerting's. It is bursty, driven by whoever is looking, and it spikes exactly when the alert path most needs the read capacity it would otherwise share.",
        numbers: [
          "1,000 engineers x 10 panels / 30s = ~330 queries/s",
          "roughly 10x that during a company-wide incident",
          "p99 under 1s target",
        ],
        breaks:
          "A label rename makes a panel go silently blank, and a blank graph reads as a healthy service rather than as a broken query.",
      },
    },
    {
      id: "notify",
      label: "Paging + heartbeat",
      sub: "third-party, outside infra",
      kind: "external",
      col: 1,
      row: 4,
      detail: {
        what: "The delivery endpoint that actually wakes someone, plus a heartbeat that pages when the monitoring stack stops emitting.",
        why: "It has to terminate outside your own infrastructure, or the meta-monitor shares a failure domain with the thing it monitors and both go quiet together. A monitoring system that falls over is worse than none, because everyone reads silence as healthy.",
        numbers: [
          "100% of fired alerts delivered within 60s",
          "alerting fails over to the peer region in <5min",
        ],
        breaks:
          "It only covers total silence. The self-concealing failures — the write path dropping one tenant's series so their rules return no data — produce no heartbeat gap at all. `alertmanager_notifications_failed_total` per receiver is the only counter that catches a delivery failure rather than a silence.",
        choice: {
          pick: "Third-party paging with an external dead-man's-switch, and a second evaluator stack on an independent TSDB replica",
          instead: "Self-hosted notification plus a meta-alert evaluated by the same stack.",
          decider:
            "Shared failure domains. An evaluator running on the TSDB it monitors goes down with it and pages nobody, so the beat has to terminate somewhere you do not operate. Failover target is <5min for alerting, against 10 to 15min of degraded query while the store gateway warms.",
          flips:
            "Nothing sensible. This is the one place where paying for someone else's uptime is the entire point.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e2",
      from: "targets",
      to: "collector",
      tier: "hot",
      label: "scrape /metrics every 10s",
      detail: {
        what: "The collector pulling the current value of every series a target exposes, on its own 10 second schedule.",
        why: "Pulling means the monitoring system owns the cadence for all 10,000 hosts rather than inheriting whatever each team configured, and the request either succeeds or it does not, which is itself the liveness signal.",
        numbers: ["10s interval", "~1,000 series per host", "1M samples/s across the fleet"],
        breaks:
          "A process that lives less than ~20s is never sampled twice and never produces a usable rate, so it is invisible on this edge no matter how the interval is tuned.",
      },
    },
    {
      id: "e3",
      from: "targets",
      to: "pushgw",
      tier: "data",
      label: "push: sub-interval jobs",
      detail: {
        what: "Samples sent by workloads the scraper cannot reach: jobs shorter than a scrape interval, client-side telemetry, anything behind a network boundary.",
        why: "This edge exists because the pull default has a hole, not because push is an alternative opinion. A 5 second cron is gone before the next poll, so its numbers have to arrive under their own steam or not at all.",
        numbers: ["covers what a 10s scrape structurally cannot see"],
        breaks:
          "Absence on this edge is ambiguous. Nothing distinguishes a job that had nothing to report from one that died, so each producer needs its own liveness signal.",
      },
    },
    {
      id: "e4",
      from: "collector",
      to: "relabel",
      tier: "hot",
      label: "remote-write, ~29MB/s",
      detail: {
        what: "Batched remote-write requests carrying the label set per series plus 16 bytes per sample, snappy-compressed.",
        why: "Drawn with its number because it is the axis people optimise and it is not the constraint. The whole firehose is a quarter of a 1GbE link, and the system still falls over when a deploy adds a label.",
        numbers: [
          "~116B per sample uncompressed, ~4x off with snappy",
          "~29MB/s, about 250Mbps",
          "remote-write 2.0 interns labels into a per-request symbol table",
        ],
        breaks:
          "If the receiver returns 200 for a sample it dropped, the sender's queue never retries and never reports, so the rejection has to travel back along this edge as an error.",
      },
    },
    {
      id: "e5",
      from: "pushgw",
      to: "relabel",
      tier: "data",
      label: "forwarded samples",
      detail: {
        what: "Gateway-accepted samples entering the same write path as everything scraped, at the same first stage.",
        why: "Push does not get to skip the checks. Cardinality caps are per tenant and per metric regardless of how the sample arrived, and a gateway carrying client-side telemetry is exactly where an unbounded label set is most likely to appear.",
        numbers: ["same 1M per metric and 2M per tenant caps apply"],
        breaks:
          "The gateway inherits whatever rate its producers choose, so without a bounded buffer in front of this hop a retry storm upstream becomes an ingest spike downstream.",
      },
    },
    {
      id: "e6",
      from: "relabel",
      to: "known-series",
      tier: "hot",
      label: "kept after drop rules",
      detail: {
        what: "Everything the static rule set did not delete or rewrite, moving to the series lookup in the same process.",
        why: "No network hop crosses here, which is the point of drawing these as stages rather than services: the ordering exists to put the cheapest test first, not to put a queue between two deployables.",
        numbers: ["all 1M samples/s that survived stage 1", "in-process, one function call"],
        breaks:
          "Whatever stage 1 failed to strip is now a label that will create series for the rest of the retention window, and no stage below can undo it.",
      },
    },
    {
      id: "e7",
      from: "known-series",
      to: "ingesters",
      tier: "hot",
      label: "hit: append, ~100%",
      detail: {
        what: "The fast path: the series already exists, so the sample is appended to its open chunk and none of the remaining three stages runs.",
        why: "This is the edge nearly every sample takes, and it is why a limiter is affordable at 1M samples per second at all. The expensive checks are paid at series creation, which happens a few thousand times a second, not a million.",
        numbers: [
          "near-100% of the 1M samples/s at steady state",
          "one hash, one map lookup, one append",
          "1.5 bytes on disk once compressed",
        ],
        breaks:
          "Nothing on this path is checked, so a series that got through creation once keeps costing its 3 to 4KB of head memory for as long as it stays active, whatever it turned out to be.",
      },
    },
    {
      id: "e8",
      from: "known-series",
      to: "metric-budget",
      tier: "data",
      label: "miss: new series",
      detail: {
        what: "The lookup missed, so this is a series that does not exist yet and is about to cost 3 to 4KB of ingester memory.",
        why: "Everything below this point is on the expensive path and only ever runs here. Separating the two is the whole trick: the cheap decision is made a million times a second and the expensive one only when a label set is genuinely new.",
        numbers: [
          "a few thousand per second during a deploy",
          "near zero at rest",
          "each one costs an index entry, postings entries, an open chunk and a WAL record",
        ],
        breaks:
          "The rate on this edge is set by deploy cadence, so the load on the expensive path is a function of someone else's release schedule rather than of traffic.",
      },
    },
    {
      id: "e9",
      from: "metric-budget",
      to: "tenant-cap",
      tier: "data",
      label: "under 1M per metric",
      detail: {
        what: "The new series' metric name still has room under its million-series budget, so the check moves on to who is paying for it.",
        why: "Two different blast radii in sequence. The metric budget bounds one bad metric; the tenant cap bounds one bad team. A single mislabelled deploy usually trips the first, and a team steadily growing its label sets trips the second.",
        numbers: ["1M series per metric name", "checked once per new series, never per sample"],
        breaks:
          "A metric under its cap can still be the one eating a tenant's entire budget, so passing here says nothing about whether the series is affordable.",
      },
    },
    {
      id: "e10",
      from: "tenant-cap",
      to: "label-guard",
      tier: "data",
      label: "under 2M per tenant",
      detail: {
        what: "The tenant is still under its 2M active-series cap, so the last check looks at what the label values actually contain.",
        why: "Both caps above are counting. This is the only stage that asks whether the shape of the data is a mistake, and it runs last because it is the only one holding per-label-key state.",
        numbers: ["2M active series per tenant, 20% of the 10M ceiling"],
        breaks:
          "A tenant well under its cap can still be leaking identity into a label; the counters will not notice until the leak has grown into a million series.",
      },
    },
    {
      id: "e11",
      from: "label-guard",
      to: "ingesters",
      tier: "hot",
      label: "index new series",
      detail: {
        what: "The series cleared all five stages, so it is indexed: label set stored, postings entries written for every label key-value pair, a fresh chunk opened and a WAL record appended.",
        why: "This is where the money is actually spent. Every 3 to 4KB of head memory in the design is committed on this edge, and nothing downstream can give it back until head compaction retires the series. That same cost is then paid again in every sealed block the series appears in.",
        numbers: [
          "3 to 4KB of ingester memory per series, at creation",
          "a few thousand per second during a deploy",
        ],
        breaks:
          "Head compaction is what releases the memory of retired series, so a deploy cadence rotating pod names faster than the 2 hour window makes memory a function of deploy frequency.",
      },
    },
    {
      id: "e12",
      from: "tenant-cap",
      to: "collector",
      tier: "control",
      label: "429 + counted drop",
      offset: 40,
      detail: {
        what: "The rejection travelling back to the sender as an explicit HTTP error, with `metric_dropped_total{tenant, metric, reason}` incremented and attributed to the owning team, labelled by tenant, metric and reason. Stages 3 and 5 count their drops the same way.",
        why: "A silent limiter is worse than no limiter. The team sees a flat graph, concludes the service is idle, and files a bug against monitoring three weeks later, so the drop has to be both counted and visible to whoever caused it. A remote-write client that receives a 200 for a dropped sample never retries and never tells anyone.",
        numbers: [
          "alert at 80% of the cap, before this edge ever fires",
        ],
        breaks:
          "A rejected series is gone forever. If that label was the one that would have explained the incident, the write path took the answer with it, and this edge is the only trace that it happened.",
      },
    },
    {
      id: "e14",
      from: "ingesters",
      to: "object-store",
      tier: "data",
      label: "2h immutable blocks",
      detail: {
        what: "A sealed, time-ranged, immutable block uploaded to object storage every two hours per ingester.",
        why: "Sealing on a schedule is what lets the head block stay bounded and lets everything downstream treat history as immutable, which is the property the whole object-storage tier depends on. It also decouples retention from the size of any node, and head compaction is what retires stale index entries.",
        numbers: [
          "one block every 2 hours per ingester",
          "a year of 2h blocks is over 4,000 objects",
        ],
        breaks:
          "An object-storage outage stalls these uploads, so the ingesters keep flushing locally and local disk fills while everything else looks healthy.",
      },
    },
    {
      id: "e15",
      from: "object-store",
      to: "compactor",
      tier: "data",
      label: "sealed blocks in",
      detail: {
        what: "The compactor reading back the raw 2 hour blocks the ingesters uploaded, together with the redundant copy the second collector produced.",
        why: "Compaction reads from object storage rather than from the ingesters on purpose: the head must never be touched by a background job competing with 1M samples/s, and a block is immutable, so the merge can run whenever there is capacity. It reads only sealed blocks, never the head, and dedups on a (series, timestamp) key via the `cluster` and `replica` labels.",
        breaks:
          "If the compactor falls behind, block count grows without bound and every long-range query pays for the fan-out across un-merged two-hour blocks.",
      },
    },
    {
      id: "e16",
      from: "compactor",
      to: "object-store",
      tier: "data",
      label: "merged, 1m and 1h out",
      detail: {
        what: "Merged, deduplicated and downsampled blocks written back at 1 minute and 1 hour resolution, replacing the raw blocks once they age out of the hot window.",
        why: "This is the edge that makes a year of retention affordable: 47TB of raw against 131GB downsampled, and the cheapest possible answer to where long-term data lives.",
        numbers: [
          "360x fewer samples at 1h than at 10s",
          "~400GB cold at RF 3, under $10/month",
          "warm ~1.94TB, ~6TB at RF 3",
        ],
        breaks:
          "It is one-way. Once the rollup is written and the raw block expires, the fine-grained shape of an old spike is unrecoverable, and downsampling shrinks samples without shrinking a single index.",
      },
    },
    {
      id: "e17",
      from: "query-frontend",
      to: "ingesters",
      tier: "data",
      label: "recent, from the hot tier",
      detail: {
        what: "Reading the raw 10 second window: the last couple of hours still in head memory, plus the 7 day hot tier on the ingester's own disk.",
        why: "The most-viewed data is the newest and part of it has not been written anywhere durable yet, so any query about the recent past has to fan out to the write tier rather than to object storage.",
        numbers: ["covers the last 7 days at 10s resolution", "up to 2h of it lives only in memory"],
        breaks:
          "Reads land on the same nodes absorbing 1M samples per second, so a heavy query competes directly with ingestion for the tier that must not fall over.",
      },
    },
    {
      id: "e-historical",
      from: "query-frontend",
      to: "object-store",
      tier: "data",
      label: "historical, by step size",
      detail: {
        what: "Anything older than the hot window, handed off at the resolution chosen from the query's requested step, resolved through a store-gateway tier that keeps each block's index header resident and fans reads out across the candidate blocks.",
        why: "Step-size routing is what stops a long range from becoming a raw scan. A 1 hour step reads the hourly tier and returns 8,760 points for a year rather than 3.15M per series, and a raw query past the 7 day window is rejected here outright rather than allowed to time out. Caching index headers rather than listing objects is the difference between a warm map lookup and thousands of object-storage round trips per query.",
        numbers: [
          "ranges beyond 7 days route to 1m or 1h",
          "a year-long selector considers 4,000+ candidate blocks",
        ],
        breaks:
          "Churn defeats the routing. A year-long query fans out across blocks whose series sets are nearly disjoint, and no amount of step-size selection shrinks those indexes. A cold gateway after a region failover has no resident headers, which is the 10 to 15 minutes of degraded query the DR plan budgets for.",
      },
    },
    {
      id: "e20",
      from: "query-frontend",
      to: "dashboards",
      tier: "hot",
      label: "~330 queries/s",
      detail: {
        what: "Query results returned to refreshing browser panels.",
        why: "This is the load that spikes 10x during an incident, when everyone opens every dashboard at once, and it is the reason alerting is not allowed to depend on the same pool.",
        numbers: [
          "p99 under 1s target",
          "~330 queries/s steady, ~3,300 during a company-wide incident",
        ],
        breaks:
          "A blank panel from a renamed label looks identical to a healthy service with no traffic, and nobody investigates a flat line.",
      },
    },
    {
      id: "e21",
      from: "evaluator",
      to: "ingesters",
      tier: "hot",
      label: "own reader pool",
      offset: 60,
      detail: {
        what: "Range queries over roughly a 5 minute window, one per rule per evaluation interval, served by a reader pool dedicated to alerting and pointed at the same recent tier the dashboards read.",
        why: "The pool is separate because alert evaluation generates read load comparable to all of dashboards, and it must keep running precisely when human query load spikes. A slow query here also silently lengthens the effective hold and can reset pending state. Rule windows are always recent, so this path never reaches the store gateway.",
        numbers: [
          "10,000 rules / 30s = ~330 evaluations/s",
          "each a range query over a 5 minute window",
        ],
        breaks:
          "If this read path shares capacity with ad hoc queries, one capacity-planning question starves alerting during the incident it was meant to catch.",
      },
    },
    {
      id: "e22",
      from: "evaluator",
      to: "router",
      tier: "hot",
      label: "firing after hold",
      detail: {
        what: "A rule transitioning from pending to firing once its condition has held for the configured `for` duration, emitted with its label set.",
        why: "The hold is the whole point of this edge: it converts a momentarily true condition into one that has persisted long enough to be worth a human. Nothing crosses here on a single bad scrape.",
        numbers: [
          "`for: 5m` at 10s scrape means ~30 consecutive samples",
          "at a 30s evaluation interval that is 10 consecutive true evaluations",
        ],
        breaks:
          "No-data is not a firing state, so a rule whose series the write path dropped stays quiet, and the absence looks exactly like health.",
      },
    },
    {
      id: "e23",
      from: "router",
      to: "notify",
      tier: "hot",
      label: "one grouped page",
      detail: {
        what: "A grouped, silenced and inhibition-filtered notification delivered to a channel and, if it pages, to a human.",
        why: "Everything upstream of this edge exists to make what crosses it worth reading. One database failure enters the router as roughly 100 firings and leaves it as one notification.",
        numbers: ["100 firings collapse to 1 notification", "delivered within 60s of trigger"],
        breaks:
          "`alertmanager_notifications_failed_total` per receiver is the only thing that catches a delivery failure here, and a page that failed to deliver is indistinguishable from a quiet night.",
      },
    },
    {
      id: "e24",
      from: "evaluator",
      to: "notify",
      tier: "control",
      label: "dead-man's-switch beat",
      offset: 80,
      detail: {
        what: "A heartbeat emitted on a fixed cadence to a third-party monitor that pages when the beat stops, backed by a second evaluator stack running against an independent TSDB replica in the peer region.",
        why: "The alert evaluator cannot run on the TSDB it monitors, and the meta-monitor cannot run on your infrastructure either, or a full outage takes both down together and nobody is told. This beat terminates outside the monitoring infrastructure entirely.",
        numbers: [
          "alerting fails over to the peer region in <5min",
        ],
        breaks:
          "It only detects total silence. Partial and self-concealing failures, such as one tenant's rules going to no-data, keep the heartbeat perfectly healthy.",
      },
    },
  ],
};
