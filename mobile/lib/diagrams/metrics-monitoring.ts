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
      "Collection is a pull by default. The agent reads its target list from service discovery and scrapes every endpoint every 10 seconds, which puts the cadence under your control and turns a dead target into an observation (`up == 0`) rather than an ambiguous silence. A push gateway exists beside it, but as the explicit exception path for jobs that live shorter than a scrape interval or sit behind a boundary you cannot poll into.",
      "The write path is where the system defends itself, because the cost that matters is paid at series creation and not per sample. Five stages run cheapest first: relabel drops, a known-series hash lookup that at steady state hits for essentially every one of the 1M samples/s, then the per-metric budget, the per-tenant cap and a label-value heuristic. Only the miss path, a few thousand per second during a deploy, ever reaches the expensive checks.",
      "Storage is purpose-built and nothing like a row store. Timestamps arrive at a near-fixed cadence and values move slowly, so delta-of-delta on the timestamp and XOR on the float take a 16 byte sample down to about 1.5 bytes. Ingesters hold a head block in memory and a write-ahead log on local NVMe, seal a 2 hour block, and hand it to the compactor.",
      "Retention is three resolutions rather than one, because a year of 10 second data is 47TB against 131GB downsampled, a factor of 360. The compactor merges sealed blocks, deduplicates the redundant collector pair by (series, timestamp), rolls 10s into 1 minute and 1 hour, and ships everything to object storage where the whole cold tier costs under 10 dollars a month.",
      "The read side is two pools, not one. A query frontend routes by requested step size so a long range lands on a coarse tier, and it rejects a raw one year query outright instead of letting it time out. The alert evaluator gets its own reader pool against the hot tier, because 10,000 rules on a 30 second interval is roughly 330 evaluations per second, comparable to the entire dashboard load, and a capacity-planning query must never starve it.",
      "Alerting is a state machine plus a router. Each rule holds pending, firing and resolved state and only fires once the condition has held for its configured duration, then the router groups, silences and inhibits before anything reaches a person, because 200 pages for one database failure is the same as no pages at all.",
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
    {
      id: "ingest-zone",
      label: "Ingest tier: memory-bound, and where the system says no",
      kind: "group",
      x: 24,
      y: 204,
      w: 692,
      h: 218,
      detail: {
        what: "The limiter, the ingesters and their local hot tier: everything whose capacity is set by active series rather than by sample rate.",
        why: "Grouped because they share one ceiling. The head block holds an index entry and an open chunk per active series at 3 to 4KB each, so 10M series is 40GB of memory spread across the shards, and that number, not disk and not bandwidth, is what decides how much the system can accept.",
        numbers: ["10M active series", "3 to 4KB head memory each", "~40GB of head across 10 ingesters"],
        breaks:
          "Cardinality does not degrade gracefully past the ceiling: the ingester OOMs, write-ahead-log replay then takes minutes, and while a replica replays, alerting is reading from a shrunken quorum.",
      },
    },
    {
      id: "targets",
      label: "Services and hosts",
      sub: "10,000 hosts, ~1,000 series each",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "Instrumented processes exposing a metrics endpoint, plus node agents and containers on every host.",
        why: "Drawn explicitly because this is the part you do not control and it sets the whole constraint. The label sets on these metrics are written by application teams, and one deploy adding `user_id` decides your capacity, not any decision made inside the monitoring system.",
        numbers: ["10,000 hosts", "500 to 2,000 series per instrumented service", "10M active series total"],
        breaks:
          "A deploy ships a runaway label set and this one target's series count goes multiplicative, with no warning that anything changed except the counters downstream.",
      },
    },
    {
      id: "collector",
      label: "Collector / agent",
      sub: "scrape via service discovery, 10s",
      kind: "compute",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "An agent per host or pod that reads its target list from service discovery and pulls every endpoint on a fixed 10 second schedule, applying relabel rules before it forwards.",
        why: "Pulling puts the cadence under one owner instead of inheriting whatever each team configured, and it makes failure detection free: a target that does not answer is something the collector observed, so `up == 0` is a fact rather than an inference.",
        numbers: ["10s scrape interval", "1M samples/s steady, 3M peak", "~29MB/s on the wire after snappy"],
        breaks:
          "Anything that does not survive two scrape intervals is invisible to it. A 5 second cron or a function invocation is gone before the next poll and no tuning fixes that.",
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
    {
      id: "pushgw",
      label: "Push gateway",
      sub: "exception path, not the front door",
      kind: "compute",
      x: 440,
      y: 110,
      w: 260,
      detail: {
        what: "An authenticated ingest endpoint for anything scraping cannot reach: sub-interval jobs, client-side telemetry, workloads behind a network boundary.",
        why: "It exists because the pull default has a hole rather than because push is a second opinion. Keeping it explicitly the exception is what stops the service-discovery machinery and the liveness convention from having to be reinvented per team.",
        numbers: ["accepts what a 10s scrape cannot see", "bounded buffer, ~5 minutes of burst"],
        breaks:
          "Silence through this path means nothing, so every workload behind it needs its own explicit liveness signal, and the gateway inherits whatever rate producers choose rather than owning the cadence.",
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
      id: "limiter",
      label: "Cardinality limiter",
      sub: "5-stage drop pipeline, cheapest first",
      kind: "compute",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "Five stages before a sample touches storage: relabel drops, known-series lookup, per-metric series budget, per-tenant active-series cap, and a label-value cardinality heuristic.",
        why: "The whole design turns on this component. A sample costs 1.5 bytes and lands in a chunk that already exists; a series costs 3 to 4KB of ingester memory at creation and keeps costing it. Query-time limits cannot help, because the memory was spent on the write path before any query ran.",
        numbers: [
          "1M series per metric name, 2M active series per tenant",
          "steady-state hit rate near 100%, so the expensive stages run only on creation",
          "churn during a deploy: a few thousand new series per second",
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
      id: "ingesters",
      label: "Ingesters",
      sub: "head block + WAL, 1M series each, RF 3",
      kind: "compute",
      x: 40,
      y: 330,
      w: 280,
      detail: {
        what: "The sharded write tier. Each ingester owns roughly 1M active series in an in-memory head block with a write-ahead log, and seals a 2 hour immutable block on a fixed schedule.",
        why: "Sharded because the head block is the real capacity limit: 10M series at 4KB is 40GB, more than one node should hold. Replicated three ways because an ingester restart would otherwise be a hole in the data exactly when someone is reading it during an incident.",
        numbers: ["1M series per ingester, ~4GB of head", "10 ingesters, RF 3, 30 replicas", "blocks sealed every 2 hours"],
        breaks:
          "It OOMs on cardinality rather than on volume, and the recovery is slow: WAL replay takes minutes, and for that whole window alerting is reading from a shrunken quorum.",
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
    {
      id: "hot-tier",
      label: "Hot tier",
      sub: "local NVMe, 10s for 7 days",
      kind: "store",
      x: 440,
      y: 330,
      w: 260,
      detail: {
        what: "Raw 10 second resolution on local SSD alongside the WAL: Gorilla-compressed chunks plus an inverted postings index from label key-value pair to series id.",
        why: "This is the shape general-purpose stores get wrong. Samples arrive at a near-fixed cadence and values move slowly, so the encoding is the storage design, and every read is a time range over a label selector rather than a point lookup on a primary key.",
        numbers: ["16B raw down to ~1.5B per sample", "907GB compressed, ~3TB with RF 3", "postings ~150MB per replica set"],
        breaks:
          "It is the tier priced in SSD rather than in cents, so a retention argument here is a real capacity conversation, unlike the cold tier where nobody argues.",
        choice: {
          pick: "A purpose-built TSDB: delta-of-delta on timestamps, XOR on floats, inverted postings on labels",
          instead: "A row per sample in Postgres, or a wide-column store like Cassandra keyed by series and time bucket.",
          decider:
            "Compression and access shape together. A row store carries per-row overhead against a 16 byte payload while delta-of-delta plus XOR reaches 1.3 to 2 bytes, roughly a 10x difference at 1M inserts per second, and none of it survives an index built for point lookups when every query is a range scan over a label selector.",
          flips:
            "Low sample volume with rich relational queries over the same data, where a row store's joins and ad hoc SQL are worth more than a 10x storage factor on a small number.",
        },
      },
    },
    {
      id: "compactor",
      label: "Compactor + downsampler",
      sub: "merge, dedupe, roll up to 1m and 1h",
      kind: "compute",
      x: 40,
      y: 440,
      w: 280,
      detail: {
        what: "A background job that merges sealed 2 hour blocks, deduplicates the redundant collector pair by (series, timestamp) using the `cluster` and `replica` external labels, and produces 1 minute and 1 hour rollups.",
        why: "It exists so retention becomes a storage-cost question rather than a capacity-planning one. Dedup lives here rather than on the write path because samples are idempotent by timestamp, so a duplicate is a no-op and can be resolved lazily.",
        numbers: ["10s to 1m is 6x, 10s to 1h is 360x", "runs on sealed blocks, never on the head", "dedup key: (series, timestamp)"],
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
    {
      id: "object-store",
      label: "Object storage",
      sub: "warm 1m/90d, cold 1h/1y",
      kind: "store",
      x: 440,
      y: 440,
      w: 260,
      detail: {
        what: "Immutable time-ranged blocks at the coarser resolutions, read back through a store gateway that fans out across the blocks a query touches.",
        why: "Long retention on local disk is 47TB of raw per replica, which no node holds. Pushing sealed blocks to object storage turns the year of history into a bill rather than a cluster, and the bill is small enough that the cold tier is never the argument.",
        numbers: ["warm ~1.94TB, ~6TB at RF 3", "cold 131GB, ~400GB at RF 3", "under $10/month at $0.023/GB-month"],
        breaks:
          "An S3 outage stalls block uploads, so compactor retries pile up and ingesters keep flushing locally until someone notices local disk filling.",
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
      id: "query-frontend",
      label: "Query frontend",
      sub: "PromQL, routes by step size",
      kind: "compute",
      x: 40,
      y: 580,
      w: 280,
      detail: {
        what: "The read entry point for humans: parses the query, reads the requested step, picks a resolution tier, and fans out across recent data in the ingesters and historical blocks in object storage.",
        why: "Tier selection has to be automatic because nobody writing a dashboard panel knows which tier holds their range. Rejecting an impossible query is part of the job: a clear error beats a request that runs for two minutes and then times out.",
        numbers: ["~330 queries/s steady, ~10x during an incident", "p99 under 1s target", "1 year at 10s is 3.15M points per series"],
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
      id: "evaluator",
      label: "Alert evaluator",
      sub: "pending / firing / resolved, own pool",
      kind: "compute",
      x: 440,
      y: 580,
      w: 260,
      detail: {
        what: "Runs each rule on a fixed interval, holds per-rule state, and only emits once the condition has held for its configured `for` duration: pending, then firing, then resolved.",
        why: "Alerting is not a feature bolted onto dashboards, it is an independent reader of the same data with a different latency budget and a different failure mode. That is why it gets its own reader pool rather than queueing behind a human's ad hoc query.",
        numbers: ["10,000 rules on a 30s interval = ~330 evaluations/s", "`for: 5m` at 10s scrape holds across ~30 samples", "60s delivery budget from trigger"],
        breaks:
          "A rule that returns no data does not fire, so a tenant the limiter has silenced produces silence rather than an alert, and everyone reads silence as healthy.",
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
      id: "router",
      label: "Alert router",
      sub: "group, silence, inhibit",
      kind: "compute",
      x: 440,
      y: 690,
      w: 260,
      detail: {
        what: "Takes raw firings and applies three transformations before any human sees them: grouping by label set, silencing during declared maintenance, and inhibition of symptoms while a known cause is firing.",
        why: "The scarce resource on the delivery side is on-call attention. 200 pages for one database failure is the same as none, so collapsing them is not a nicety, it is what makes the alert mean anything at all.",
        numbers: ["100 pods on one database failure collapse to 1 notification", "inhibition: `db_down` mutes dependent `api_5xx`"],
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
      kind: "external",
      x: 40,
      y: 690,
      w: 280,
      detail: {
        what: "The human read path: panels refreshing on a fixed interval against the query frontend.",
        why: "Drawn as its own consumer because its load profile is the opposite of alerting's. It is bursty, driven by whoever is looking, and it spikes exactly when the alert path most needs the read capacity it would otherwise share.",
        numbers: ["1,000 engineers x 10 panels / 30s = ~330 queries/s", "roughly 10x that during a company-wide incident"],
        breaks:
          "A label rename makes a panel go silently blank, and a blank graph reads as a healthy service rather than as a broken query.",
      },
    },
    {
      id: "notify",
      label: "Paging + dead-man's-switch",
      sub: "third-party, outside your infrastructure",
      kind: "external",
      x: 440,
      y: 800,
      w: 260,
      detail: {
        what: "The delivery endpoint that actually wakes someone, plus a heartbeat that pages when the monitoring stack stops emitting.",
        why: "It has to terminate outside your own infrastructure, or the meta-monitor shares a failure domain with the thing it monitors and both go quiet together. A monitoring system that falls over is worse than none, because everyone reads silence as healthy.",
        numbers: ["100% of fired alerts delivered within 60s", "alerting fails over to the peer region in <5min"],
        breaks:
          "It only covers total silence. The self-concealing failures, a limiter dropping one tenant's series so their rules return no data, produce no heartbeat gap at all.",
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
      id: "e1",
      from: "targets",
      to: "collector",
      label: "scrape /metrics every 10s",
      animated: true,
      detail: {
        what: "The collector pulling the current value of every series a target exposes, on its own 10 second schedule.",
        why: "Pulling means the monitoring system owns the cadence for all 10,000 hosts rather than inheriting whatever each team configured, and the request either succeeds or it does not, which is itself the liveness signal.",
        numbers: ["10s interval", "~1,000 series per host", "1M samples/s across the fleet"],
        breaks:
          "A process that lives less than ~20s is never sampled twice and never produces a usable rate, so it is invisible on this edge no matter how the interval is tuned.",
      },
    },
    {
      id: "e2",
      from: "targets",
      to: "pushgw",
      label: "push: sub-interval jobs",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Samples sent by workloads the scraper cannot reach: jobs shorter than a scrape interval, client-side telemetry, anything behind a network boundary.",
        why: "This edge exists because the pull default has a hole, not because push is an alternative opinion. A 5 second cron is gone before the next poll, so its numbers have to arrive under their own steam or not at all.",
        numbers: ["covers what a 10s scrape structurally cannot see"],
        breaks:
          "Absence on this edge is ambiguous. Nothing distinguishes a job that had nothing to report from one that died, so each producer needs its own liveness signal.",
      },
    },
    {
      id: "e3",
      from: "collector",
      to: "limiter",
      label: "remote-write, ~29MB/s",
      animated: true,
      detail: {
        what: "Batched remote-write requests carrying the label set per series plus 16 bytes per sample, snappy-compressed.",
        why: "Drawn with its number because it is the axis people optimise and it is not the constraint. The whole firehose is a quarter of a 1GbE link, and the system still falls over when a deploy adds a label.",
        numbers: ["~116B per sample uncompressed, ~4x off with snappy", "~29MB/s, about 250Mbps", "remote-write 2.0 interns labels into a per-request symbol table"],
        breaks:
          "If the receiver returns 200 for a sample it dropped, the sender's queue never retries and never reports, so the rejection has to travel back along this edge as an error.",
      },
    },
    {
      id: "e4",
      from: "pushgw",
      to: "limiter",
      label: "forwarded samples",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Gateway-accepted samples entering the same write path as everything scraped.",
        why: "Push does not get to skip the limiter. Cardinality caps are per tenant and per metric regardless of how the sample arrived, and a gateway is exactly where an unbounded label set is most likely to appear.",
        numbers: ["same 1M per metric and 2M per tenant caps apply"],
        breaks:
          "The gateway inherits whatever rate its producers choose, so without a bounded buffer in front of this hop a retry storm upstream becomes an ingest spike downstream.",
      },
    },
    {
      id: "e5",
      from: "limiter",
      to: "ingesters",
      label: "accepted samples",
      animated: true,
      detail: {
        what: "Samples that cleared all five stages, appended to an existing series or indexed as a new one.",
        why: "At steady state essentially every sample on this edge belongs to a series that already exists, which is what makes a limiter affordable at 1M samples per second: the expensive checks run on creation, not per sample.",
        numbers: ["miss path only a few thousand per second during a deploy", "near-100% known-series hit rate at steady state"],
        breaks:
          "The new-series path is the expensive one, and it is driven by deploy cadence, a number nobody in the monitoring team controls.",
      },
    },
    {
      id: "e6",
      from: "limiter",
      to: "collector",
      label: "429 + counted drop",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "The rejection travelling back to the sender as an explicit HTTP error, with `metric_dropped_total{tenant, metric, reason}` incremented and attributed to the owning team.",
        why: "A silent limiter is worse than no limiter. The team sees a flat graph, concludes the service is idle, and files a bug against monitoring three weeks later, so the drop has to be both counted and visible to whoever caused it.",
        numbers: ["labels: tenant, metric, reason", "alert at 80% of the cap, before this edge fires"],
        breaks:
          "A rejected series is gone forever. If that label was the one that would have explained the incident, the limiter took the answer with it, and this edge is the only trace that it happened.",
      },
    },
    {
      id: "e7",
      from: "ingesters",
      to: "hot-tier",
      label: "WAL + sealed chunks",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The write-ahead log record and, on a fixed schedule, the sealed compressed chunk landing on local NVMe.",
        why: "The WAL is what makes an ingester restart survivable, and it is on local NVMe specifically so replay is measured in seconds rather than minutes when a replica comes back.",
        numbers: ["16B down to ~1.5B per sample", "~3TB across the tier at RF 3"],
        breaks:
          "Replay time scales with head size, so the same cardinality that OOMs the ingester also makes its recovery slow, and both happen during the incident.",
      },
    },
    {
      id: "e8",
      from: "ingesters",
      to: "compactor",
      label: "2h immutable blocks",
      detail: {
        what: "A sealed, time-ranged, immutable block handed off for merging and rollup.",
        why: "Sealing on a schedule is what lets the head block stay bounded and lets everything downstream treat history as immutable, which is the property the whole object-storage tier depends on.",
        numbers: ["one block every 2 hours per ingester", "head compaction is also what retires stale index entries"],
        breaks:
          "Head compaction is what releases the memory of retired series, so a deploy cadence rotating pod names faster than the 2 hour window makes memory a function of deploy frequency.",
      },
    },
    {
      id: "e9",
      from: "compactor",
      to: "object-store",
      label: "downsample 1m and 1h",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Merged, deduplicated and downsampled blocks uploaded at 1 minute and 1 hour resolution.",
        why: "This is the edge that makes a year of retention affordable: 47TB of raw against 131GB downsampled, and the cheapest possible answer to where long-term data lives.",
        numbers: ["360x fewer samples at 1h than at 10s", "~400GB cold at RF 3, under $10/month"],
        breaks:
          "It is one-way. Once the rollup is written and the raw block expires, the fine-grained shape of an old spike is unrecoverable.",
      },
    },
    {
      id: "e10",
      from: "query-frontend",
      to: "ingesters",
      label: "recent, from head block",
      fromSide: "left",
      toSide: "left",
      offset: 110,
      detail: {
        what: "Reading the last couple of hours of data, which lives in ingester memory rather than in any sealed block.",
        why: "The most-viewed data is the newest and it has not been written anywhere durable yet, so any query about the last two hours has to fan out to the write tier as well as the store.",
        numbers: ["covers the window since the last block seal, up to 2h"],
        breaks:
          "Reads land on the same nodes that are absorbing 1M samples per second, so a heavy query competes directly with ingestion for the tier that must not fall over.",
      },
    },
    {
      id: "e11",
      from: "query-frontend",
      to: "object-store",
      label: "historical, by step size",
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "A fan-out across historical blocks via the store gateway, at the resolution chosen from the query's requested step.",
        why: "Step-size routing is what stops a long range from becoming a raw scan. A 1 hour step reads the hourly tier and returns 8,760 points for a year rather than 3.15M per series.",
        numbers: ["ranges beyond 7 days route to 1m or 1h", "raw queries past hot retention are rejected outright"],
        breaks:
          "Churn defeats the routing. A year-long query fans out across blocks whose series sets are nearly disjoint, and downsampling shrank the samples without shrinking any of those indexes.",
      },
    },
    {
      id: "e12",
      from: "query-frontend",
      to: "dashboards",
      label: "~330 queries/s",
      animated: true,
      detail: {
        what: "Query results returned to refreshing panels.",
        why: "This is the load that spikes 10x during an incident, when everyone opens every dashboard at once, and it is the reason alerting is not allowed to depend on the same pool.",
        numbers: ["p99 under 1s target", "~330 queries/s steady, ~3,300 during a company-wide incident"],
        breaks:
          "A blank panel from a renamed label looks identical to a healthy service with no traffic, and nobody investigates a flat line.",
      },
    },
    {
      id: "e13",
      from: "evaluator",
      to: "hot-tier",
      label: "own reader pool",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Range queries over roughly a 5 minute window, one per rule per evaluation interval, served by a reader pool dedicated to alerting.",
        why: "The pool is separate because alert evaluation generates read load comparable to all of dashboards, and it must keep running precisely when human query load spikes. A slow query here also silently lengthens the effective hold and can reset pending state.",
        numbers: ["10,000 rules / 30s = ~330 evaluations/s", "each a range query over a 5 minute window"],
        breaks:
          "If this read path shares capacity with ad hoc queries, one capacity-planning question starves alerting during the incident it was meant to catch.",
      },
    },
    {
      id: "e14",
      from: "evaluator",
      to: "router",
      label: "firing after hold",
      animated: true,
      detail: {
        what: "A rule transitioning from pending to firing once its condition has held for the configured `for` duration, emitted with its label set.",
        why: "The hold is the whole point of this edge: it converts a momentarily true condition into one that has persisted long enough to be worth a human. Nothing crosses here on a single bad scrape.",
        numbers: ["`for: 5m` at 10s scrape means ~30 consecutive samples", "at a 30s evaluation interval that is 10 consecutive true evaluations"],
        breaks:
          "No-data is not a firing state, so a rule whose series the limiter dropped stays quiet, and the absence looks exactly like health.",
      },
    },
    {
      id: "e15",
      from: "router",
      to: "notify",
      label: "one grouped page",
      animated: true,
      detail: {
        what: "A grouped, silenced and inhibition-filtered notification delivered to a channel and, if it pages, to a human.",
        why: "Everything upstream of this edge exists to make what crosses it worth reading. One database failure enters the router as roughly 100 firings and leaves it as one notification.",
        numbers: ["100 firings collapse to 1 notification", "delivered within 60s of trigger"],
        breaks:
          "`alertmanager_notifications_failed_total` per receiver is the only thing that catches a delivery failure here, and a page that failed to deliver is indistinguishable from a quiet night.",
      },
    },
    {
      id: "e16",
      from: "evaluator",
      to: "notify",
      label: "dead-man's-switch beat",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 80,
      detail: {
        what: "A heartbeat emitted on a fixed cadence to a third-party monitor that pages when the beat stops.",
        why: "The alert evaluator cannot run on the TSDB it monitors, and the meta-monitor cannot run on your infrastructure either, or a full outage takes both down together and nobody is told.",
        numbers: ["terminates outside your infrastructure entirely", "backed by a second evaluator stack on an independent replica"],
        breaks:
          "It only detects total silence. Partial and self-concealing failures, such as one tenant's rules going to no-data, keep the heartbeat perfectly healthy.",
      },
    },
  ],
};
