import type { Diagram } from "./types";

export const METRICS_MONITORING: Diagram = {
  id: "metrics-monitoring",
  title: "Metrics Monitoring",
  question: "Design a Metrics Monitoring & Alerting System",
  sourceId: "patterns",
  itemId: 17,
  overview: {
    shape:
      "One append-only time-series store with a write path allowed to say no, and two independent readers: dashboards for humans, and an evaluator that pages someone eventually.",
    forces: [
      {
        constraint: "A dead target and one with nothing to report look identical under push, but not under pull",
        decision: "Collection is a pull by default; the Collector scrapes every target on a fixed schedule, so up == 0 is an observation",
        lights: ["collector", "targets", "e2"],
      },
      {
        constraint: "A series costs 3 to 4KB of ingester memory at creation, a sample costs 1.5 bytes on disk",
        decision: "The Distributor runs five checks cheapest-first in one process, so the expensive checks pay only for the miss path",
        lights: ["write-path", "known-series", "e7", "e8"],
      },
      {
        constraint: "A year of 10-second data is 47TB against 131GB downsampled, a factor of 360",
        decision: "The Compactor rolls sealed blocks into three resolutions, so only the hot 7 days pays disk-tier prices",
        lights: ["compactor", "object-store", "e16"],
      },
      {
        constraint: "10,000 rules on a 30-second interval is ~330 evaluations/s, comparable to the entire dashboard load",
        decision: "The Alert evaluator gets its own reader pool against the ingesters, separate from the Query frontend",
        lights: ["evaluator", "query-frontend", "e21"],
      },
      {
        constraint: "1 evaluator running on the TSDB it monitors would go down with it and page nobody",
        decision: "The dead-man's-switch heartbeat and its second evaluator stack terminate outside this infrastructure entirely",
        lights: ["notify", "e24"],
      },
    ],
    naive: {
      text: "Accept every sample a team wants to send, store it forever at full resolution, and let a query touch however many series it needs. A sample only costs 1.5 bytes on disk, so nothing about ingest looks expensive from that angle. The real cost is a series, not a sample. A new label combination costs 3 to 4KB of ingester memory the moment it is created, and that memory is spent before any query or retention policy ever runs. A single deploy that adds a `user_id` label can turn 50,000 series into 500 million. The Distributor instead checks cardinality at write time, and the Compactor downsamples old data automatically, so cost is bounded going in rather than discovered going out.",
      lights: ["write-path", "compactor"],
    },
    beats: [
      {
        text: "Collection is a pull by default. The agent reads its target list from service discovery and scrapes every endpoint every 10 seconds, putting the cadence under your control. A dead target becomes an observation (`up == 0`) rather than an ambiguous silence. A push gateway exists beside it, but as the explicit exception path for jobs that live shorter than a scrape interval or sit behind a boundary you cannot poll into.",
        lights: ["targets", "collector", "pushgw", "e2", "e3"],
      },
      {
        text: "The write path is one service, not five. Inside it five stages run cheapest first with no network hop between them: relabel drops, a known-series hash lookup, the per-metric budget, the per-tenant cap and a label-value heuristic. The hash lookup hits for essentially every one of the 1M samples/s at steady state. Only the miss path, a few thousand per second during a deploy, ever reaches the expensive checks, the entire reason a limiter is affordable at this rate.",
        lights: ["write-path", "relabel", "known-series", "metric-budget", "tenant-cap", "label-guard"],
      },
      {
        text: "Storage is purpose-built and nothing like a row store. Timestamps arrive at a near-fixed cadence and values move slowly, so delta-of-delta on the timestamp and XOR on the float take a 16 byte sample down to about 1.5 bytes. Ingesters hold a head block in memory and a write-ahead log on local NVMe. They keep the 10 second tier on that disk for 7 days, and seal a 2 hour immutable block into object storage.",
        lights: ["ingesters", "e14"],
      },
      {
        text: "Retention is three resolutions rather than one, because a year of 10 second data is 47TB against 131GB downsampled, a factor of 360. A compactor reads the sealed blocks back out of object storage, merges them, deduplicates the redundant collector pair by (series, timestamp), and rolls 10s into 1 minute and 1 hour. It writes them back where the whole cold tier costs under 10 dollars a month.",
        lights: ["compactor", "object-store", "e15", "e16"],
      },
      {
        text: "The read side is two pools over two halves. A query frontend fans out across recent data still held by the ingesters and historical blocks behind a store gateway, routing by requested step size. A long range lands on a coarse tier, and it rejects a raw one year query outright instead of letting it time out. The alert evaluator gets its own reader pool against the ingesters, because 10,000 rules on a 30 second interval is roughly 330 evaluations per second. That is comparable to the entire dashboard load, and a capacity-planning query must never starve it.",
        lights: ["query-frontend", "evaluator", "ingesters", "e17", "e-historical", "e21"],
      },
      {
        text: "Alerting is a state machine plus a router. Each rule holds pending, firing and resolved state, and only fires once the condition has held for its configured duration. Then the router groups, silences and inhibits before anything reaches a person, because 200 pages for one database failure is the same as no pages at all.",
        lights: ["evaluator", "router", "notify", "e22", "e23"],
      },
    ],
    crux: {
      problem:
        "The system is priced per series, not per sample, and the label sets that create series are chosen by application teams rather than by you. A sample costs 1.5 bytes on disk; a series costs 3 to 4KB of ingester memory the moment it is created.",
      handled:
        "That is three orders of magnitude of asymmetry, which is why the control has to sit on the write path. By the time a query runs, the memory is already spent. Every cap in the design bounds concurrent series while doing nothing about churn. A label that rotates fully every deploy still holds flat under every cap, quietly filling the retention window with near-disjoint series sets.",
    },
    numbers: [
      {
        value: "10M active series, 1M samples/s steady, 3M peak",
        explain: "The baseline scale the whole ingest tier is provisioned against, at steady state and at peak.",
      },
      {
        value: "1.5B per sample vs 3 to 4KB per series",
        explain: "The asymmetry that drives the whole design: a sample is nearly free, a series is not, and the cost is paid once at creation regardless of how many samples follow.",
      },
      {
        value: "caps: 1M series per metric, 2M per tenant",
        explain: "The two blast-radius limits the write path enforces, bounding one bad metric and one bad tenant independently.",
      },
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
        why: "Drawn explicitly because this is the part the monitoring team does not control, and it sets the whole constraint. These are inside the trust boundary and on someone's pager, which is what makes the fix a conversation with a named team rather than a vendor ticket. The label sets on these metrics are written by application teams, and one deploy adding `user_id` decides your capacity.",
        numbers: [
          { value: "10,000 hosts", explain: "The scale of the fleet this whole design has to observe." },
          { value: "500 to 2,000 series per instrumented service once histogram buckets are counted", explain: "The typical per-service series count, driven mostly by histogram bucket expansion." },
          { value: "10M active series total", explain: "The resulting aggregate the ingest tier has to hold." },
        ],
        breaks: {
          failure: "A deploy ships a runaway label set and this one target's series count goes multiplicative.",
          handled: "There is no warning that anything changed except the counters downstream, which is why the write path, not this node, has to be where cardinality is actually stopped.",
        },
        choice: {
          pick: "Expose a pull-scrapeable /metrics endpoint from every process",
          instead: "Bundle a push SDK into every service that ships samples to a collector on its own schedule.",
          decider:
            "Who owns the cadence for 10,000 hosts. A pull endpoint costs one library and zero outbound network config. A push SDK means every host independently decides its own send interval and retry policy. The monitoring team then has to reconcile that after the fact rather than set it once.",
          flips: "A process that genuinely cannot be polled, behind a boundary or living shorter than a scrape interval. That is exactly the exception the push gateway exists to catch, rather than the default for all 10,000 hosts.",
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
          { value: "accepts what a 10s scrape structurally cannot see", explain: "The scope of this endpoint, deliberately narrow rather than a general-purpose alternative." },
          { value: "bounded buffer, ~5 minutes of burst", explain: "The headroom this gateway holds before it has to shed rather than queue." },
        ],
        breaks: {
          failure: "Silence through this path means nothing.",
          handled: "Every workload behind it needs its own explicit liveness signal, and the gateway inherits whatever rate producers choose rather than owning the cadence. Past the buffer the correct behaviour is to shed, not to queue.",
        },
        choice: {
          pick: "A gateway with real backpressure, used only for what cannot be scraped",
          instead: "Make push the front door for the whole fleet and delete the collector tier.",
          decider:
            "Where the liveness convention lives. Scraping gives you one `up` series per target for free across 10,000 hosts. Push makes liveness a per-team piece of work that has to be written 10,000 times and reviewed once per team. The gateway also inherits the producers' rate, so it needs a bounded buffer and a shed policy a scraper never needs.",
          flips: "Client-side or third-party telemetry, where there is nothing to poll at all, and any fleet that is mostly serverless or short-lived.",
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
        what: "An agent per host or pod, reading its target list from service discovery, the platform's own registry re-read continuously rather than at boot. It pulls every endpoint on a fixed 10 second schedule, applying relabel rules before it forwards.",
        why: "Pulling puts the cadence under one owner instead of inheriting whatever each team configured. It also makes failure detection free: a target that does not answer is something the collector observed, so `up == 0` is a fact rather than an inference. That only works because service discovery makes `up == 0` mean something. The registry says a target should have answered, the whole difference between an observed failure and an absence nobody can tell from a healthy idle service. It runs as a redundant pair per target, deduplicated later by the `cluster` and `replica` labels.",
        numbers: [
          { value: "10s scrape interval", explain: "The fixed cadence every target is polled on." },
          { value: "1M samples/s steady, 3M peak", explain: "The resulting aggregate ingest rate at average and peak." },
          { value: "~29MB/s on the wire after snappy, a quarter of a 1GbE link", explain: "The bandwidth this collection layer actually costs." },
          { value: "registry: 10,000 hosts, target list re-read on the order of every 30s", explain: "How often this agent refreshes its view of what it should be scraping." },
        ],
        breaks: {
          failure: "Anything that does not survive two scrape intervals is invisible to it.",
          handled: "A 5 second cron or a function invocation is gone before the next poll and no tuning fixes that. A target missing from the registry is never scraped and never produces `up == 0`, so registry staleness is the one failure the pull model cannot observe about itself.",
        },
        choice: {
          pick: "Scrape discoverable targets every 10s, with relabel rules applied at the agent",
          instead: "Push for everything: each process ships its own samples to a gateway on its own schedule and the collector tier disappears.",
          decider:
            "Whether targets are enumerable and outlive a couple of intervals. At 10s a process must survive ~20s to be sampled twice and ~30s to produce a usable rate. With scraping `up == 0` is an observation, while with push absence is ambiguous. Every pushed workload then needs its own liveness signal, and that work scales with the number of teams.",
          flips: "A mostly short-lived or serverless fleet, or a network that will not let a central collector reach the targets: customer-deployed agents, mobile clients, a partner's VPC. Most deployments run both, so the question is only which one is the default.",
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
        why: "Five stages of one request path, not five services: there is no network hop between them and no stage that scales or fails on its own. The ordering is the design rather than the deployment. A sample costs 1.5 bytes and lands in a chunk that already exists; a series costs 3 to 4KB of ingester memory at creation and keeps costing it. Query-time limits cannot help, because the memory was spent here before any query ran.",
        numbers: [
          { value: "1M samples/s steady, 3M peak, through one code path", explain: "The full ingest volume this service processes." },
          { value: "caps: 1M series per metric name, 2M active series per tenant", explain: "The two blast-radius limits this service enforces." },
          { value: "steady-state known-series hit rate near 100%", explain: "How rarely a sample actually reaches the expensive stages of this pipeline." },
          { value: "miss path: a few thousand new series per second during a deploy", explain: "At near-100% known-series hit rate, this trickle — not the 1M-3M/s sample rate — is what the expensive checks actually see; deploy cadence sets their cost, not traffic." },
        ],
        breaks: {
          failure: "It bounds concurrent series and does nothing about churn.",
          handled: "A pod name is bounded at 200 at any instant and produces ~158,000 distinct values over 13 months of twice-daily deploys. Active series holds flat and every cap stays green, even as long-range queries fan out across blocks whose series sets barely overlap.",
        },
        choice: {
          pick: "Refuse at ingest, with every drop counted under `metric_dropped_total{tenant, metric, reason}` and returned to the sender as an error",
          instead: "Accept every write and defend the read path instead: cap the series one query may touch and kill it when it exceeds its memory budget.",
          decider:
            "The series count the ingester tier can hold, which is a memory number and not a disk number. At 3 to 4KB of head per active series, 10 ingesters with 32GB each gives roughly 8 to 10M series of headroom. Past that the ingester OOMs and WAL replay takes minutes rather than degrading.",
          flips: "A storage engine that keeps its index on disk rather than in a head block, so the ceiling is disk and disk degrades gracefully. Also a single-tenant deployment, where the team that blows up cardinality is the team that gets paged and the feedback loop closes without enforcement.",
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
        why: "First because it is the only stage with no state and no lookup, so it is the cheapest place to delete work. It is also the only stage that can do anything about churn. Removing `pod` from a metric that only ever needed `deployment` prevents the series from being created at all, which no downstream cap can do. The same rules are also applied at the agent, so a drop can happen before the wire.",
        numbers: [
          { value: "one map lookup per sample, no state", explain: "The full cost of this stage per sample." },
          { value: "runs on all 1M samples/s", explain: "The volume this stage sees, unlike every stage below it." },
        ],
        breaks: {
          failure: "It is a config file nobody reviews with the cardinality budget in front of them.",
          handled: "The rule that would have saved you is usually written the week after the incident, which is why cardinality review is a standing practice rather than a one-time setup.",
        },
        choice: {
          pick: "Strip rotating identity labels (`pod`, `instance`, `container_id`, `replicaset`) from anything intended to be queried historically",
          instead: "Keep every identity label and let the caps downstream hold the line.",
          decider:
            "Cumulative series over the retention window rather than concurrent series. 200 pods at two deploys a day for 13 months is ~158,000 distinct values from one label, no two generations of which ever coexist. Every cap stays green while each sealed block carries its own index over a nearly disjoint series set.",
          flips: "Short retention, where cumulative and concurrent are close enough that churn never bites. The cost is real either way: once `pod` is stripped, 'which pod was the bad one' is unanswerable for any block that has rotated out of the hot tier.",
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
        why: "This is the stage that makes a limiter affordable at 1M samples per second. 10M series producing 1M samples/s means essentially every sample belongs to a series that already exists. The expensive checks below run at the churn rate, a few thousand a second during a deploy, near zero otherwise, rather than at the sample rate.",
        numbers: [
          { value: "near-100% hit rate at steady state", explain: "How often this stage resolves a sample without touching anything expensive." },
          { value: "miss path a few thousand per second during a deploy", explain: "10M series ÷ 1M samples/s means each series fires roughly once a second, so nearly every sample hits; deploy churn is the only thing that reaches the checks below." },
          { value: "a hit costs one hash and one map lookup", explain: "The full cost of the fast path this stage provides." },
        ],
        breaks: {
          failure: "The miss rate is set by deploy cadence, a number nobody on the monitoring team controls.",
          handled: "The expensive path is driven entirely by someone else's release schedule, which is why deploy frequency, not traffic, is the real input to this stage's cost.",
        },
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
        why: "It bounds the blast radius of one bad metric to that metric. Past roughly a million series a single `rate(metric[5m])` has to touch a million postings entries and stops being affordable. That matters most because alert rules run those queries 330 times a second.",
        numbers: [
          { value: "1M series per metric name, hard cap", explain: "The threshold this stage enforces." },
          { value: "`method`(5) x `status`(10) x `host`(1,000) = 50,000, which is fine", explain: "A legitimate metric's cardinality, comfortably under the cap." },
          { value: "the same metric plus `user_id` at 10,000 users = 500M, which is not", explain: "How one added label dimension turns a safe metric into one that trips this cap immediately." },
        ],
        breaks: {
          failure: "The cap fires on the metric, not on the label that caused it.",
          handled: "It tells the on-call that something exploded without telling them what to delete. That answer lives in a cardinality explorer over the head index, diffed against 24 hours ago.",
        },
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
        why: "It bounds the blast radius of one bad team to that team. 2M is 20% of the 10M the ingester tier can hold, so no tenant can consume more than a fifth of the head memory everyone shares. The error is the important half. A remote-write client that receives a 200 for a dropped sample never retries it and never tells anyone. Every drop is counted under `metric_dropped_total{tenant, metric, reason}`.",
        numbers: [
          { value: "2M active series per tenant, 20% of the 10M ceiling", explain: "The threshold this stage enforces and its share of total ingester capacity." },
          { value: "alert at 80% of the cap, before any drop starts", explain: "The early-warning threshold this stage's own monitoring fires at." },
        ],
        breaks: {
          failure: "A tenant sitting on its cap has rules that return no data, and a rule that returns no data does not fire.",
          handled: "The limiter converts a loud failure into silence for exactly the team it is throttling, which is why the 80% pre-alert exists to catch it before that happens.",
        },
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
        what: "The only stage that inspects values. A label key seeing more distinct values than its threshold in a rolling window is almost always a UUID, a request id, an email or a raw URL path.",
        why: "Stages 3 and 4 catch the explosion only after it has already cost a million series. This one catches the shape of the mistake, an unbounded value space on one key. It runs last because it is the only stage holding per-label-key state, against a threshold configurable per key.",
        numbers: [
          { value: "runs only on the miss path, never on the 1M samples/s", explain: "How rarely this stage is actually exercised." },
          { value: "a legitimate 50,000-customer dimension trips it identically", explain: "The false-positive case this heuristic cannot tell apart from a real leak." },
        ],
        breaks: {
          failure: "It has no way to tell a leak from a deliberately wide dimension.",
          handled: "Tuned tight it deletes a team's intentional metric, and tuned loose it catches nothing, which is why the response is a reversible warning rather than an immediate drop.",
        },
        choice: {
          pick: "Warn first, then drop at a per-label-key threshold a team can raise deliberately",
          instead: "Drop immediately on any label key past a single global threshold.",
          decider:
            "The false-positive rate, which is not small: a 50,000-customer dimension and a leaked `request_id` are indistinguishable by distinct-value count alone. A warning is reversible and a rejected series is not. It is gone, along with whatever it would have explained.",
          flips: "A multi-tenant deployment where one tenant's leak takes down every other tenant's alerting. There the cost of a wrong drop is one team's graph and the cost of a miss is everyone's pager.",
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
        what: "The sharded write tier, and the reader for everything recent. Each ingester owns roughly 1M active series in an in-memory head block with a write-ahead log, plus local NVMe holding Gorilla-compressed chunks at raw 10s resolution.",
        why: "Sharded because the head block is the real capacity limit: 10M series at 4KB is 40GB, more than one node should hold. Replicated three ways because an ingester restart would otherwise be a hole in the data exactly when someone is reading it during an incident. The disk is local NVMe specifically so WAL replay is measured in seconds. Delta-of-delta on timestamps plus XOR on floats is the storage design, not an add-on. Samples arrive at a near-fixed cadence and values move slowly, so a 16-byte sample compresses to about 1.5 bytes.",
        numbers: [
          { value: "1M series per ingester, ~4GB of head", explain: "The per-node capacity this shard size targets." },
          { value: "10 ingesters, RF 3, 30 replicas", explain: "The total shard and replica count across the tier." },
          { value: "blocks sealed every 2 hours", explain: "The cadence at which head data is committed to durable, immutable storage." },
          { value: "disk: 16B raw down to ~1.5B/sample, 907GB compressed, ~3TB at RF 3, postings ~150MB per replica set", explain: "The compression ratio and resulting footprint at replication." },
        ],
        breaks: {
          failure: "It OOMs on cardinality rather than on volume, and the recovery is slow.",
          handled: "WAL replay takes minutes, and for that whole window alerting is reading from a shrunken quorum. Reads also land on the same nodes absorbing 1M samples/s and compete directly with ingestion.",
        },
        choice: {
          pick: "Shard by series into 10 ingesters at 1M series each, replication factor 3",
          instead: "One large node holding the entire head block, or replication factor 1 with a fast restore from the WAL.",
          decider:
            "40GB of head memory for 10M series is more than one node should own. RF 1 means an OOM plus a multi-minute WAL replay is a gap in the data during the incident that caused it. RF 3 across 30 replicas keeps a quorum readable while one replays.",
          flips: "Under about 2M active series, where the head fits comfortably on one machine and a second node buys operational cost rather than headroom.",
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
          { value: "10,000 rules on a 30s interval = ~330 evaluations/s", explain: "The load this component's own read pool has to sustain." },
          { value: "`for: 5m` at a 10s scrape holds across ~30 samples", explain: "How much noise the standard hold duration filters out before a rule fires." },
          { value: "60s delivery budget from trigger", explain: "The end-to-end latency target from a rule firing to a human being notified." },
        ],
        breaks: {
          failure: "A rule that returns no data does not fire.",
          handled: "A tenant the write path has silenced produces silence rather than an alert, and everyone reads silence as healthy, which is the design's known blind spot.",
        },
        choice: {
          pick: "A separate evaluator with its own reader pool and a per-rule hold duration",
          instead: "Evaluate rules through the same querier pool that serves dashboards, and fire on the first true evaluation.",
          decider:
            "Alerting generates ~330 evaluations per second, comparable to the entire dashboard load, and dashboards spike 10x during exactly the incident when rules must keep running. On the hold: `for: 5m` at a 10s scrape means the condition held across roughly 30 samples, removing essentially all single-scrape noise, while `for: 30s` does not.",
          flips: "A deployment small enough that one pool serves both without contention, where a second pool is cost with no isolation benefit.",
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
        what: "The read entry point for humans. It parses the query, reads the requested step, picks a resolution tier, and fans out across recent data still held by the ingesters and historical blocks behind the store gateway.",
        why: "Tier selection has to be automatic because nobody writing a dashboard panel knows which tier holds their range. Rejecting an impossible query is part of the job: a clear error beats a request that runs for two minutes and then times out.",
        numbers: [
          { value: "~330 queries/s steady, ~10x during an incident", explain: "The load range this service is sized for." },
          { value: "p99 under 1s target", explain: "The target step-size routing protects — reject a doomed query at parse time rather than let it run past this budget and drag every other reader down." },
          { value: "1 year at 10s is 3.15M points per series against 8,760 hourly", explain: "The scale gap that makes step-size routing mandatory rather than optional." },
        ],
        breaks: {
          failure: "A long-range query saturates the store gateway.",
          handled: "Without step-size routing and its own pool separation, one capacity-planning question starves the 330 rule evaluations per second sharing the read path.",
        },
        choice: {
          pick: "Route by requested step, and reject raw range queries past the 7 day hot window",
          instead: "Always read the finest tier available and let the query planner sort it out at runtime.",
          decider:
            "1 year at 10s resolution is 3.15M points per series against 8,760 hourly. That query does not run slowly, it does not run at all. The choice is between an error at parse time and a timeout after two minutes of store-gateway load that also hurts everyone else.",
          flips: "Single-resolution deployments with short retention, where there is no coarser tier to route to and the planner has nothing to decide.",
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
        what: "Immutable time-ranged blocks: the 2 hour blocks the ingesters upload, and the merged, coarser blocks the compactor writes back in their place. A stateless store-gateway tier sits in front, index headers resident, resolving a selector to candidate blocks and fanning reads out across them.",
        why: "Long retention on local disk is 47TB of raw per replica, which no node holds. Pushing sealed blocks here turns the year of history into a bill rather than a cluster, and the bill is small enough that the cold tier is never the argument. Object storage itself has no index, so something has to hold the map from label selector to block, or a long-range query becomes a listing of a year of objects. Caching index headers is the difference between a warm map lookup and thousands of round trips per query.",
        numbers: [
          { value: "warm ~1.94TB, ~6TB at RF 3", explain: "The size of the 90-day minute-resolution tier." },
          { value: "cold 131GB, ~400GB at RF 3", explain: "The 360x-downsampled year the compactor produces from 47TB of raw 10s data — replicated 3x this is the whole cold tier, still under $10/month." },
          { value: "under $10/month at $0.023/GB-month", explain: "400GB × $0.023/GB ≈ $9.20/month — the storage bill was never the argument; the real cost is the ~eight interacting components this tier requires to operate." },
          { value: "a year of 2h blocks is 4,000+ objects to consider per query; postings ~150MB per replica set", explain: "The block count a long-range query has to fan out across." },
          { value: "a cold gateway after failover costs 10-15min of degraded query", explain: "The recovery cost while this tier's index headers rewarm." },
          { value: "cross-region replicated async, ~1min lag", explain: "The replication lag this tier's disaster-recovery story runs on." },
        ],
        breaks: {
          failure: "An S3 outage stalls block uploads, so compactor retries pile up.",
          handled: "Ingesters keep flushing locally until someone notices local disk filling, and a single long-range query saturating the gateway tier is the other side of the same failure mode.",
        },
        choice: {
          pick: "Sealed blocks in object storage with a store gateway fanning out across them",
          instead: "A sharded cluster holding the full retention on dense local disk.",
          decider:
            "Cost against component count. 400GB of cold tier at object-storage pricing is under $10/month against SSD for the same year, but it buys roughly eight interacting components to operate. A dense-local-disk engine reaching ~0.4B/sample rather than 1.5B moves the arithmetic another 4x in the other direction.",
          flips: "When staffing is the constraint. A component count you cannot fund is a permanent operational tax, and cheaper storage you cannot operate is not cheaper.",
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
        what: "A background job reading sealed 2 hour blocks back from object storage, merging and deduplicating them by a (series, timestamp) key, and writing back 1 minute and 1 hour rollups. It runs only on sealed blocks, never on the head.",
        why: "It exists so retention becomes a storage-cost question rather than a capacity-planning one. Dedup lives here rather than on the write path because samples are idempotent by timestamp. A duplicate is a no-op that can be resolved lazily, precisely the property an order-flow pipeline does not have.",
        numbers: [{ value: "10s to 1m is 6x, 10s to 1h is 360x", explain: "The compression this rollup produces at each downsampling step." }],
        breaks: {
          failure: "Downsampling is irreversible.",
          handled: "The honest form of the decision is whether anyone will ever need the exact shape of a 30 second spike from four months ago. After this job runs they cannot have it.",
        },
        choice: {
          pick: "Three resolutions: 10s for 7 days, 1 minute for 90 days, 1 hour for a year",
          instead: "One resolution forever: keep every raw sample for the full retention and spend the saved complexity on a denser engine and cheaper disk.",
          decider:
            "A year of 10s data is 47TB against 131GB downsampled, a factor of 360 (8,640 samples per day against 24). Then measure the query mix. If under 5% of queries reach beyond 7 days, downsampling costs nothing anyone notices.",
          flips: "Short retention, where 360x of a small number is still small. 30 days at 10s is 3.9TB, which one dense engine holds on local disk, and choosing that deletes the compactor, the downsampling jobs and the tier-selection logic outright.",
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
          { value: "100 pods on one database failure collapse to 1 notification", explain: "A concrete example of this router's collapsing effect." },
          { value: "inhibition: `db_down` mutes dependent `api_5xx`", explain: "An example rule this router applies to suppress a known symptom of an already-firing cause." },
        ],
        breaks: {
          failure: "Inhibition rules encode a dependency graph that nobody updates.",
          handled: "When the graph is wrong it suppresses the alert that was actually the cause, and the suppression is invisible, which is why the dependency graph needs a named owner.",
        },
        choice: {
          pick: "A router doing grouping, silencing and inhibition before delivery",
          instead: "Deliver every firing straight to its channel and let the on-call filter.",
          decider:
            "Fan-out during a real failure. One database going down fires an alert on every one of the roughly 100 dependent services, and an on-call taking 200 pages reads none of them. Grouping turns that into one notification with the same information.",
          flips: "A single team with a handful of rules, where the routing table is more configuration than the alerts are worth.",
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
          { value: "1,000 engineers x 10 panels / 30s = ~330 queries/s", explain: "The steady-state load this reader generates." },
          { value: "roughly 10x that during a company-wide incident", explain: "The peak this reader spikes to precisely when the alert path needs headroom most." },
          { value: "p99 under 1s target", explain: "The same budget the 330 alert evaluations/s share on this path — a slow dashboard panel and a slow alert rule are the same regression, not two." },
        ],
        breaks: {
          failure: "A label rename makes a panel go silently blank.",
          handled: "A blank graph reads as a healthy service rather than as a broken query, which is why panel queries need their own error visibility, not just data visibility.",
        },
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
          { value: "100% of fired alerts delivered within 60s", explain: "The delivery SLO this endpoint is held to." },
          { value: "alerting fails over to the peer region in <5min", explain: "The recovery target if the primary evaluator stack goes down." },
        ],
        breaks: {
          failure: "It only covers total silence.",
          handled: "Self-concealing failures, like the write path dropping one tenant's series so their rules return no data, produce no heartbeat gap at all. Only `alertmanager_notifications_failed_total` per receiver catches a delivery failure rather than a silence.",
        },
        choice: {
          pick: "Third-party paging with an external dead-man's-switch, and a second evaluator stack on an independent TSDB replica",
          instead: "Self-hosted notification plus a meta-alert evaluated by the same stack.",
          decider:
            "Shared failure domains. An evaluator running on the TSDB it monitors goes down with it and pages nobody, so the beat has to terminate somewhere you do not operate. Failover target is <5min for alerting, against 10 to 15min of degraded query while the store gateway warms.",
          flips: "Nothing sensible. This is the one place where paying for someone else's uptime is the entire point.",
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
      step: 1,
      label: "scrape /metrics every 10s",
      detail: {
        what: "The collector pulling the current value of every series a target exposes, on its own 10 second schedule.",
        why: "Pulling means the monitoring system owns the cadence for all 10,000 hosts, rather than inheriting whatever each team configured. The request either succeeds or it does not, which is itself the liveness signal.",
        numbers: [
          { value: "10s interval", explain: "The fixed cadence this edge runs on." },
          { value: "~1,000 series per host", explain: "The typical volume one scrape on this edge carries." },
          { value: "1M samples/s across the fleet", explain: "The aggregate this edge produces across every target." },
        ],
        breaks: {
          failure: "A process that lives less than ~20s is never sampled twice.",
          handled: "It never produces a usable rate, so it is invisible on this edge no matter how the interval is tuned.",
        },
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
        numbers: [{ value: "covers what a 10s scrape structurally cannot see", explain: "The scope this edge is deliberately limited to." }],
        breaks: {
          failure: "Absence on this edge is ambiguous.",
          handled: "Nothing distinguishes a job that had nothing to report from one that died, so each producer needs its own liveness signal on top of this edge.",
        },
      },
    },
    {
      id: "e4",
      from: "collector",
      to: "relabel",
      tier: "hot",
      step: 2,
      label: "remote-write, ~29MB/s",
      detail: {
        what: "Batched remote-write requests carrying the label set per series plus 16 bytes per sample, snappy-compressed.",
        why: "Drawn with its number because it is the axis people optimise and it is not the constraint. The whole firehose is a quarter of a 1GbE link, and the system still falls over when a deploy adds a label.",
        numbers: [
          { value: "~116B per sample uncompressed, ~4x off with snappy", explain: "The raw and compressed size of one sample on this edge." },
          { value: "~29MB/s, about 250Mbps", explain: "The resulting steady-state bandwidth this edge carries." },
          { value: "remote-write 2.0 interns labels into a per-request symbol table", explain: "The mechanism that keeps repeated label strings from inflating this edge's bandwidth further." },
        ],
        breaks: {
          failure: "If the receiver returns 200 for a sample it dropped, the sender's queue never retries and never reports.",
          handled: "The rejection has to travel back along this edge as an explicit error, which is why every drop returns a real status code rather than a silent 200.",
        },
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
        why: "Push does not get to skip the checks. Cardinality caps are per tenant and per metric regardless of how the sample arrived. A gateway carrying client-side telemetry is exactly where an unbounded label set is most likely to appear.",
        numbers: [{ value: "same 1M per metric and 2M per tenant caps apply", explain: "The enforcement this edge is subject to, identical to the scraped path." }],
        breaks: {
          failure: "The gateway inherits whatever rate its producers choose.",
          handled: "Without a bounded buffer in front of this hop, a retry storm upstream becomes an ingest spike downstream, which is why the gateway's own buffer exists.",
        },
      },
    },
    {
      id: "e6",
      from: "relabel",
      to: "known-series",
      tier: "hot",
      step: 3,
      label: "kept after drop rules",
      detail: {
        what: "Everything the static rule set did not delete or rewrite, moving to the series lookup in the same process.",
        why: "No network hop crosses here, the point of drawing these as stages rather than services. The ordering exists to put the cheapest test first, not to put a queue between two deployables.",
        numbers: [
          { value: "all 1M samples/s that survived stage 1", explain: "The volume this edge carries forward into the pipeline." },
          { value: "in-process, one function call", explain: "The actual cost of this hand-off." },
        ],
        breaks: {
          failure: "Whatever stage 1 failed to strip is now a label that will create series for the rest of the retention window.",
          handled: "No stage below can undo it, which is why relabel rules need review before rollout, not after an incident.",
        },
      },
    },
    {
      id: "e7",
      from: "known-series",
      to: "ingesters",
      tier: "hot",
      step: 4,
      label: "hit: append, ~100%",
      detail: {
        what: "The fast path: the series already exists, so the sample is appended to its open chunk and none of the remaining three stages runs.",
        why: "This is the edge nearly every sample takes, and it is why a limiter is affordable at 1M samples per second at all. The expensive checks are paid at series creation, which happens a few thousand times a second, not a million.",
        numbers: [
          { value: "near-100% of the 1M samples/s at steady state", explain: "Leaves only a few thousand series-creation events/s for the checks below — three orders of magnitude less than the 1M samples/s this edge itself carries." },
          { value: "one hash, one map lookup, one append", explain: "The full cost of this edge per sample." },
          { value: "1.5 bytes on disk once compressed", explain: "The eventual storage footprint of one sample crossing this edge." },
        ],
        breaks: {
          failure: "Nothing on this path is checked.",
          handled: "A series that got through creation once keeps costing its 3 to 4KB of head memory for as long as it stays active, whatever it turned out to be.",
        },
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
          { value: "a few thousand per second during a deploy", explain: "The typical rate on this edge during a rollout." },
          { value: "near zero at rest", explain: "The rate on this edge outside a deploy window." },
          { value: "each one costs an index entry, postings entries, an open chunk and a WAL record", explain: "The full set of structures one new series on this edge commits to." },
        ],
        breaks: {
          failure: "The rate on this edge is set by deploy cadence.",
          handled: "The load on the expensive path is a function of someone else's release schedule rather than of traffic, which is why deploy frequency is watched as a capacity signal.",
        },
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
        numbers: [
          { value: "1M series per metric name", explain: "The threshold this edge's predecessor stage enforced before allowing this series through." },
          { value: "checked once per new series, never per sample", explain: "The frequency this edge actually fires at." },
        ],
        breaks: {
          failure: "A metric under its cap can still be the one eating a tenant's entire budget.",
          handled: "Passing this edge says nothing about whether the series is affordable overall, which is exactly why the tenant cap runs next.",
        },
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
        numbers: [{ value: "2M active series per tenant, 20% of the 10M ceiling", explain: "The threshold cleared before a series reaches this edge." }],
        breaks: {
          failure: "A tenant well under its cap can still be leaking identity into a label.",
          handled: "The counters will not notice until the leak has grown into a million series, which is exactly what the label-value guard downstream exists to catch earlier.",
        },
      },
    },
    {
      id: "e11",
      from: "label-guard",
      to: "ingesters",
      tier: "hot",
      step: 5,
      label: "index new series",
      detail: {
        what: "The series cleared all five stages, so it is indexed: label set stored, postings entries written for every label key-value pair, a fresh chunk opened and a WAL record appended.",
        why: "This is where the money is actually spent. Every 3 to 4KB of head memory in the design is committed on this edge, and nothing downstream can give it back until head compaction retires the series. That same cost is then paid again in every sealed block the series appears in.",
        numbers: [
          { value: "3 to 4KB of ingester memory per series, at creation", explain: "The full memory commitment this edge makes per series." },
          { value: "a few thousand per second during a deploy", explain: "The rate this edge carries during a rollout." },
        ],
        breaks: {
          failure: "Head compaction is what releases the memory of retired series.",
          handled: "A deploy cadence rotating pod names faster than the 2 hour window makes memory a function of deploy frequency rather than of steady-state load.",
        },
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
        why: "A silent limiter is worse than no limiter. The team sees a flat graph, concludes the service is idle, and files a bug against monitoring three weeks later. The drop has to be both counted and visible to whoever caused it. A remote-write client that receives a 200 for a dropped sample never retries and never tells anyone.",
        numbers: [{ value: "alert at 80% of the cap, before this edge ever fires", explain: "The pre-warning this edge's own trigger condition is preceded by." }],
        breaks: {
          failure: "A rejected series is gone forever.",
          handled: "If that label was the one that would have explained the incident, the write path took the answer with it, and this edge is the only trace that it happened.",
        },
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
        why: "Sealing on a schedule is what lets the head block stay bounded and lets everything downstream treat history as immutable, the property the whole object-storage tier depends on. It also decouples retention from the size of any node, and head compaction is what retires stale index entries.",
        numbers: [
          { value: "one block every 2 hours per ingester", explain: "The cadence this edge fires at." },
          { value: "a year of 2h blocks is over 4,000 objects", explain: "The resulting object count a full year of retention accumulates." },
        ],
        breaks: {
          failure: "An object-storage outage stalls these uploads.",
          handled: "The ingesters keep flushing locally and local disk fills while everything else looks healthy, which is why upload lag is monitored as its own signal.",
        },
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
        why: "Compaction reads from object storage rather than from the ingesters on purpose. The head must never be touched by a background job competing with 1M samples/s, and a block is immutable, so the merge can run whenever there is capacity. It reads only sealed blocks, never the head, and dedups on a (series, timestamp) key via the `cluster` and `replica` labels.",
        breaks: {
          failure: "If the compactor falls behind, block count grows without bound.",
          handled: "Every long-range query pays for the fan-out across un-merged two-hour blocks, which is why compactor lag is a monitored SLO in its own right.",
        },
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
          { value: "360x fewer samples at 1h than at 10s", explain: "The compression ratio this edge's output achieves at the coldest tier." },
          { value: "~400GB cold at RF 3, under $10/month", explain: "The resulting storage cost of the year-long tier." },
          { value: "warm ~1.94TB, ~6TB at RF 3", explain: "The resulting storage cost of the 90-day tier." },
        ],
        breaks: {
          failure: "It is one-way.",
          handled: "Once the rollup is written and the raw block expires, the fine-grained shape of an old spike is unrecoverable, and downsampling shrinks samples without shrinking a single index.",
        },
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
        why: "The most-viewed data is the newest, and part of it has not been written anywhere durable yet. Any query about the recent past has to fan out to the write tier rather than to object storage.",
        numbers: [
          { value: "covers the last 7 days at 10s resolution", explain: "The window this edge serves." },
          { value: "up to 2h of it lives only in memory", explain: "The portion of that window that exists nowhere else yet." },
        ],
        breaks: {
          failure: "Reads land on the same nodes absorbing 1M samples per second.",
          handled: "A heavy query competes directly with ingestion for the tier that must not fall over, which is why this edge's traffic is watched as closely as write throughput.",
        },
      },
    },
    {
      id: "e-historical",
      from: "query-frontend",
      to: "object-store",
      tier: "data",
      label: "historical, by step size",
      detail: {
        what: "Anything older than the hot window, handed off at the resolution chosen from the query's requested step. It resolves through a store-gateway tier that keeps each block's index header resident and fans reads out across the candidate blocks.",
        why: "Step-size routing is what stops a long range from becoming a raw scan. A 1 hour step reads the hourly tier and returns 8,760 points for a year rather than 3.15M per series. A raw query past the 7 day window is rejected here outright rather than allowed to time out. Caching index headers rather than listing objects is the difference between a warm map lookup and thousands of round trips per query.",
        numbers: [
          { value: "ranges beyond 7 days route to 1m or 1h", explain: "The routing rule this edge applies." },
          { value: "a year-long selector considers 4,000+ candidate blocks", explain: "The fan-out one long-range query on this edge produces." },
        ],
        breaks: {
          failure: "Churn defeats the routing.",
          handled: "A year-long query fans out across blocks whose series sets are nearly disjoint. A cold gateway after a region failover has no resident headers either, the 10 to 15 minutes of degraded query the DR plan budgets for.",
        },
      },
    },
    {
      id: "e20",
      from: "query-frontend",
      to: "dashboards",
      tier: "hot",
      step: 6,
      label: "~330 queries/s",
      detail: {
        what: "Query results returned to refreshing browser panels.",
        why: "This is the load that spikes 10x during an incident, when everyone opens every dashboard at once. That is the reason alerting is not allowed to depend on the same pool.",
        numbers: [
          { value: "p99 under 1s target", explain: "The latency target this edge is held to." },
          { value: "~330 queries/s steady, ~3,300 during a company-wide incident", explain: "The load range this edge carries at rest and at peak." },
        ],
        breaks: {
          failure: "A blank panel from a renamed label looks identical to a healthy service with no traffic.",
          handled: "Nobody investigates a flat line, which is why label-rename changes need their own review process separate from dashboard rendering.",
        },
      },
    },
    {
      id: "e21",
      from: "evaluator",
      to: "ingesters",
      tier: "hot",
      step: 7,
      label: "own reader pool",
      offset: 60,
      detail: {
        what: "Range queries over roughly a 5 minute window, one per rule per evaluation interval. They are served by a reader pool dedicated to alerting, pointed at the same recent tier the dashboards read.",
        why: "The pool is separate because alert evaluation generates read load comparable to all of dashboards, and it must keep running precisely when human query load spikes. A slow query here also silently lengthens the effective hold and can reset pending state. Rule windows are always recent, so this path never reaches the store gateway.",
        numbers: [
          { value: "10,000 rules / 30s = ~330 evaluations/s", explain: "The rate this edge carries." },
          { value: "each a range query over a 5 minute window", explain: "The typical shape of one query on this edge." },
        ],
        breaks: {
          failure: "If this read path shares capacity with ad hoc queries, one capacity-planning question starves alerting.",
          handled: "That happens during the incident it was meant to catch, which is exactly why this pool is kept separate rather than shared for efficiency.",
        },
      },
    },
    {
      id: "e22",
      from: "evaluator",
      to: "router",
      tier: "hot",
      step: 8,
      label: "firing after hold",
      detail: {
        what: "A rule transitioning from pending to firing once its condition has held for the configured `for` duration, emitted with its label set.",
        why: "The hold is the whole point of this edge: it converts a momentarily true condition into one that has persisted long enough to be worth a human. Nothing crosses here on a single bad scrape.",
        numbers: [
          { value: "`for: 5m` at 10s scrape means ~30 consecutive samples", explain: "The evidence required before this edge fires." },
          { value: "at a 30s evaluation interval that is 10 consecutive true evaluations", explain: "The same requirement expressed in evaluation cycles rather than samples." },
        ],
        breaks: {
          failure: "No-data is not a firing state.",
          handled: "A rule whose series the write path dropped stays quiet, and the absence looks exactly like health, which is the same blind spot the dead-man's-switch exists to partially cover.",
        },
      },
    },
    {
      id: "e23",
      from: "router",
      to: "notify",
      tier: "hot",
      step: 9,
      label: "one grouped page",
      detail: {
        what: "A grouped, silenced and inhibition-filtered notification delivered to a channel and, if it pages, to a human.",
        why: "Everything upstream of this edge exists to make what crosses it worth reading. One database failure enters the router as roughly 100 firings and leaves it as one notification.",
        numbers: [
          { value: "100 firings collapse to 1 notification", explain: "The reduction this edge's upstream router applies before delivery." },
          { value: "delivered within 60s of trigger", explain: "The latency target this edge is held to." },
        ],
        breaks: {
          failure: "`alertmanager_notifications_failed_total` per receiver is the only thing that catches a delivery failure here.",
          handled: "A page that failed to deliver is indistinguishable from a quiet night without that counter, which is why it is watched as closely as the alerts themselves.",
        },
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
        what: "A heartbeat emitted on a fixed cadence to a third-party monitor that pages when the beat stops. It is backed by a second evaluator stack running against an independent TSDB replica in the peer region.",
        why: "The alert evaluator cannot run on the TSDB it monitors. The meta-monitor cannot run on your infrastructure either, or a full outage takes both down together and nobody is told. This beat terminates outside the monitoring infrastructure entirely.",
        numbers: [{ value: "alerting fails over to the peer region in <5min", explain: "The recovery target for this edge's backing evaluator stack." }],
        breaks: {
          failure: "It only detects total silence.",
          handled: "Partial and self-concealing failures, such as one tenant's rules going to no-data, keep the heartbeat perfectly healthy, which is the known limitation this mechanism accepts.",
        },
      },
    },
  ],
};
