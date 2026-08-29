import type { Diagram } from "./types";

export const AD_CLICK_AGGREGATION: Diagram = {
  id: "ad-click-aggregation",
  title: "Ad Click Aggregation",
  question: "Design Ad Click Event Aggregation",
  sourceId: "patterns",
  itemId: 18,
  overview: {
    shape:
      "One durable log feeds two readers: a fast branch giving dashboards a provisional number within a minute, and a slow branch recomputing totals from an immutable archive for billing.",
    forces: [
      {
        constraint: "~75k events/s peak, with a measured 0.2% duplicate rate from client retries",
        decision: "Dedup runs as a local keyed-state lookup inside the Flink aggregator, on the same task as the window, never an external store",
        lights: ["dedup", "kafka", "e3"],
      },
      {
        constraint: "mobile clients land at p99.9 = 22 minutes late against 1-minute windows",
        decision: "Lateness is tiered: the 1-min tumbling window itself reopens for 5 minutes, then the late-clicks side topic carries the rest to the recompute",
        lights: ["window", "late-topic", "e11"],
      },
      {
        constraint: "a 31-day dispute window would cost ~70TB of replicated hot log against ~4.7TB of Parquet",
        decision: "Every event also lands in the S3 Parquet archive, and Billing system reads only the Nightly recompute over it, never the stream",
        lights: ["archive", "spark", "billing", "e5", "e19"],
      },
      {
        constraint: "fraud signals above the deterministic layer carry a real false-positive rate, at ~75k events/s",
        decision: "The Fraud scoring consumer runs async off the same log, and its verdicts join the recompute instead of blocking ingest",
        lights: ["fraud", "spark", "e4", "e17"],
      },
      {
        constraint: "the streaming number and the recompute differ by up to 3% on the freshest minute",
        decision: "The Drift monitor diffs run 0 against run 2 key by key and publishes the gap instead of a network total",
        lights: ["clickhouse", "drift", "e14"],
      },
    ],
    naive: {
      text: "Increment a counter per (ad_id, minute) directly in a database as clicks arrive, and read that counter for both the dashboard and the invoice. At ~75k events/s peak a naive increment has no source of truth to replay from. A lost or duplicated increment is unrecoverable, and the measured 0.2% duplicate rate becomes a permanent overcount nothing can check. The design puts a durable log, the Kafka topic, in front of every count. It writes absolute totals through the Absolute-upsert sink instead of increments, so a duplicate or a replay is detected and undone.",
      lights: ["kafka", "sink"],
    },
    beats: [
      {
        text: "Everything starts with a log, not a database. Clicks append to a Kafka topic partitioned by ad_id before anything aggregates them, so the raw events are the source of truth and every number downstream is derived and disposable. Partitioning by ad_id also puts a retry on the same partition as the original, which is what makes dedup local.",
        lights: ["client", "click-api", "kafka", "e1", "e2"],
      },
      {
        text: "The stream job keys by ad, drops any click_id it has seen in the last 10 minutes, and buckets by event time into one-minute tumbling windows. It uses event time rather than arrival time, because a phone that was offline for twenty minutes must still count in the minute the human clicked. At a day boundary, arrival time would put the click on the wrong invoice.",
        lights: ["stream-group", "dedup", "window", "e3", "e7"],
      },
      {
        text: "Watermarks decide when a window is done. Lateness has three tiers: on time, inside the 5-minute allowed lateness where the window reopens and re-emits, and later than that where the event goes to a side-output topic. Each one of those events is money, so nothing is discarded in the stream itself.",
        lights: ["window", "late-topic", "e11"],
      },
      {
        text: "The sink writes absolute values under the primary key (ad_id, ts_minute, run_id) rather than incrementing a counter. That single choice is where exactly-once actually comes from: a checkpoint restore that replays a few seconds is a no-op by construction, so the sink needs no transaction at all.",
        lights: ["sink", "e8", "e12"],
      },
      {
        text: "The same raw events also land as Parquet on object storage. A nightly Spark job re-reads the whole day, deduplicates it exactly, joins the fraud verdicts that have settled since, and overwrites the streaming rows with a higher run_id. Dashboards read the stream, billing reads the recompute, and the difference between them is published rather than hidden.",
        lights: ["archive", "spark", "fraud", "clickhouse", "dashboards", "billing", "drift", "e5", "e15", "e17", "e18", "e13", "e19", "e14"],
      },
    ],
    crux: {
      problem:
        "Two implementations of the same arithmetic will drift. The stream and the Nightly recompute compute the same totals from the same raw events, through different code paths, and nothing proves either one right.",
      handled:
        "The design does not try to prevent the drift. It makes the drift visible instead. The Drift monitor diffs every key between the two runs and publishes the distribution of the difference per ad decile. The recompute is declared authoritative by policy, not by proof, so a genuine bug still has to be found by a human reading the published gap.",
    },
    numbers: [
      {
        value: "1.5B events/day, ~75k/s peak",
        explain:
          "1.5B ÷ 86,400s ≈ 17k/s average. Peak traffic runs roughly 4.4× that at ~75k/s, which is what the ingest tier and the Flink parallelism are both sized against.",
      },
      {
        value: "1-minute windows, 5-minute allowed lateness",
        explain:
          "Windows close on a 1-minute grain, granular enough for pacing decisions. 5 minutes of allowed lateness covers most of the retry and network tail before an event falls back to the side topic.",
      },
      {
        value: "~70TB of hot log vs ~4.7TB of Parquet for a billing month",
        explain:
          "31 days of hot retention at 750GB/day with RF=3 is ~70TB. The same 31 days as compressed columnar files is ~4.7TB, about 15x smaller, which is why disputes read the archive instead of extended log retention.",
      },
    ],
  },
  nodes: [
    // --- frames -------------------------------------------------------------
    {
      id: "corr-zone",
      label: "Authoritative path",
      kind: "zone",
      detail: {
        what: "The slow branch: the immutable archive, the very-late tail, the recompute that restates a whole day, and the one consumer allowed to read it.",
        why: "It exists to restate history, not to be faster. The moment an aggregate is billed you need somewhere a correction can live that a replay cannot express. That means an exact whole-day dedup rather than a bounded 10-minute one, and fraud verdicts that settled days after the click. Everything inside this boundary is reproducible from raw events years later, which is the property an invoice needs and the stream does not have.",
        numbers: [
          {
            value: "T+1 authoritative totals, within 0.01%",
            explain: "The nightly recompute finishes the day after the events and matches a from-scratch exact recount to within 0.01%, the bar billing is held to.",
          },
          {
            value: "31-day restatement window",
            explain: "Disputes and tax restatements can reach back a full billing month, which is why a correction reads the Parquet archive rather than the 7-day hot log.",
          },
          {
            value: "750GB of Parquet input per full-day pass",
            explain: "One day of raw clicks compressed with ZSTD. The recompute re-reads all of it rather than a delta, so every run is reproducible from the same immutable input.",
          },
        ],
        breaks: {
          failure: "It cannot post into a closed billing period once an invoice has already shipped for it.",
          handled:
            "A correction found after the invoice ships becomes an adjustment and a credit memo, an accounting event rather than a data update. Anything older than 7 days on the late topic is discarded, the accepted cost of a bounded correction window.",
        },
      },
    },
    {
      id: "stream-group",
      label: "Flink aggregator",
      sub: "one job: dedup, window, sink",
      kind: "serviceGroup",
      col: 0,
      row: 3,
      detail: {
        what: "One Flink job. The three stages inside it are chained operators sharing one keyed state backend and one checkpoint barrier, not three services with topics between them.",
        why: "keyBy(ad_id) runs once, then dedup, window and sink all run on the same key on the same task. The dedup lookup is a local state read, and the window aggregate never leaves the node. Chaining is also what makes exactly-once work: operator state and Kafka offsets sit under one barrier, so they are checkpointed together. That atomicity is what lets the sink get away with no transaction at all. Local RocksDB state is deliberately losable, because the log plus the last checkpoint rebuild it.",
        numbers: [
          { value: "parallelism 10, sized on the dedup budget", explain: "Ten parallel tasks split the 75k/s peak, each holding its own slice of dedup state in local RocksDB." },
          { value: "~17k events/s average, ~75k peak", explain: "The same daily and peak rates the whole pipeline is sized against, entering this one chained job." },
          {
            value: "RocksDB: ~1.1GB dedup entries fleet-wide, ~110MB per task",
            explain: "45M in-flight click_ids at 24B each is ~1.1GB across 10 tasks, about 110MB of local disk state per task.",
          },
        ],
        breaks: {
          failure:
            "Because it is one deployment, a hot ad that saturates the window operator backpressures dedup and the source read of that partition too. The global watermark is the minimum across partitions, so one lagging task freezes window emission for every other ad.",
          handled:
            "Losing a task's local RocksDB loses only that task's state, and recovery replays from the last checkpoint. Repeated checkpoint failures on a hot task mean each restart replays from further back, so the symptom is dashboard lag rather than an obvious storage error.",
        },
        choice: {
          pick: "One chained Flink job, all three operators in the same task slot",
          instead: "A service per stage with a topic between each, so each scales and deploys on its own.",
          decider:
            "The per-event cost of a hop at ~75k events/s. Three intermediate topics mean three extra durable writes per event and three more places where state and offsets can diverge. Chaining keeps dedup, windowing and the sink under one checkpoint barrier, the only reason state and offsets can be written atomically at all.",
          flips:
            "A stage with a genuinely different scaling profile or release cadence. Model inference is that case here, which is exactly why fraud scoring is a separate consumer rather than a fourth operator in this job.",
        },
      },
    },

    // --- ingest spine -------------------------------------------------------
    {
      id: "client",
      label: "Ad clicks",
      sub: "browser / mobile SDK",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The browser or mobile SDK that fires the click and generates the click_id it reuses verbatim on every retry.",
        why: "The idempotency key has to come from the client or it is useless. A server-generated id makes each retry a fresh event, so a duplicate becomes a fact rather than something detectable. Mobile SDKs also buffer across connectivity gaps, which is where the entire lateness problem comes from.",
        numbers: [
          { value: "1.5B click events/day", explain: "The daily volume every downstream stage, from partition count to archive size, is sized against." },
          { value: "measured duplicate rate 0.2%", explain: "1.5B/day x 0.2% ≈ 3M duplicate events/day the dedup stage must catch without discarding a genuine second click." },
          { value: "mobile p99.9 lateness 22 min", explain: "How late the slowest 0.1% of mobile events arrive after the human clicked, which sets the allowed-lateness tiers." },
        ],
        breaks: {
          failure: "A client bug that regenerates click_id per retry collapses the dedup hit rate to zero, and the online path cannot recover it.",
          handled:
            "The day is corrected at T+1 against a secondary key of (user_id, ad_id, ts rounded to 1 second), which the nightly recompute can apply even when click_id itself is unreliable.",
        },
        choice: {
          pick: "Client-generated UUIDv7 click_id, reused on retry",
          instead: "An id minted by the ingest tier on arrival.",
          decider:
            "Whether a retry is recognisable at all. A server-side id gives every one of the 0.2% duplicates a distinct identity, so nothing downstream can collapse them. UUIDv7 is also time-ordered, so the 16-byte id sorts usefully in the Parquet archive.",
          flips:
            "Server-to-server integrations where the caller cannot be trusted to generate ids, and a signed request hash serves the same purpose.",
        },
      },
    },
    {
      id: "click-api",
      label: "Click API",
      sub: "stateless, layer-1 blocks inline",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The stateless ingest tier: validate the event, apply the deterministic fraud blocklists, append to the log, return 204.",
        why: "Ingest has to stay available and cheap while everything expensive happens downstream. Only the deterministic checks run here, because they are the only layer with a near-zero false-positive rate. That is the only kind that can afford to sit in the availability path of every click.",
        numbers: [
          { value: "~75k events/s peak, ~17k average", explain: "The write rate this stateless tier is fleet-sized to absorb without ever queueing a click." },
          { value: "layer-1 checks under 2ms", explain: "The deterministic blocklist lookup, cheap enough to stay inline on every request." },
          { value: "rejects claimed times >24h in the future", explain: "A sanity bound against a broken client clock, applied before the event is durable." },
        ],
        breaks: {
          failure: "A viral campaign overruns the tier and 503s clicks that never reach the log at all.",
          handled:
            "Nothing downstream can replay an event that was never written. That is why this is the one place in the system where losing traffic is unrecoverable, and it is over-provisioned for spikes rather than autoscaled reactively.",
        },
        choice: {
          pick: "Thin stateless append, deterministic checks only",
          instead: "Score every click against the fraud model synchronously before accepting it.",
          decider:
            "Model inference at ~75k events/s needs a fleet sized for peak, and puts a model rollback inside the availability path of ingestion to buy 1 to 5 seconds of latency. Layer one costs under 2ms and stays inline; the rest run async and are fast enough for the stream.",
          flips: "Formats where a click spends budget irreversibly at request time, so a verdict arriving 5 seconds later is a verdict arriving too late.",
        },
      },
    },
    {
      id: "kafka",
      label: "Kafka topic",
      sub: "partitioned by ad_id, 7d",
      kind: "queue",
      col: 0,
      row: 2,
      detail: {
        what: "The durable, ordered, replayable log every click lands in before anything computes on it: the source of truth, with every aggregate downstream derived and disposable.",
        why: "Partitioning by ad_id does two jobs at once. It co-locates all events for one ad so aggregation is local and needs no shuffle. It also lands a retry on the same partition as the original, which is what makes dedup possible in keyed state rather than an external lookup.",
        numbers: [
          { value: "1.5B events/day, 500B per event", explain: "Daily volume times per-event size gives the raw bytes every downstream storage tier is sized from." },
          { value: "750GB/day raw", explain: "1.5B events × 500B; the write volume the topic and its replicas absorb each day." },
          { value: "7d x RF=3 = ~16TB", explain: "7 days of hot retention at 750GB/day with 3 replicas, sized for replay and recovery rather than for disputes." },
        ],
        breaks: {
          failure: "Partition skew: a Super Bowl ad at 50k clicks/s pins one partition at 100x the rest.",
          handled:
            "The global watermark is the minimum across partitions, so that one lagging task freezes window emission for every other ad. The fix is resharding the hot key.",
        },
        choice: {
          pick: "Kafka partitioned by ad_id, 7-day hot retention",
          instead: "Round-robin or hash(click_id) partitioning, which balances load perfectly.",
          decider:
            "Dedup lives in keyed state, so both copies of one click must reach the same key. Round-robin balances better and silently double counts. Retention is sized on the retry tail and recovery, not the dispute window: 31 days hot is ~70TB against ~4.7TB of Parquet.",
          flips:
            "Tiered log storage puts old segments on object storage and removes the cost side of that argument, though not the part about fraud verdicts that settle days after the click.",
        },
      },
    },

    // --- stages inside the Flink job ---------------------------------------
    {
      id: "dedup",
      label: "Dedup by click_id",
      sub: "keyed state, 10-minute TTL",
      kind: "process",
      col: 0,
      row: 3,
      parent: "stream-group",
      detail: {
        what: "A per-key set of click_ids seen in the last 10 minutes, held in the same state backend as the window; a repeat is dropped before it reaches the aggregate.",
        why: "Because the topic is keyed by ad_id and a retry carries the same ad_id, both copies of a click reach the same key. That makes the check a local state read with a TTL rather than an external lookup or a shuffle, the only version of dedup that survives ~75k events/s.",
        numbers: [
          { value: "retry tail p99.9 = 8 min, TTL set at 10", explain: "The TTL is set above the measured retry tail so a genuine retry still finds its original in state." },
          { value: "75k/s x 600s = 45M ids in flight", explain: "Peak rate times the 10-minute TTL window, the worst-case number of click_ids held live at once." },
          { value: "24B per entry = ~1.1GB fleet-wide, ~110MB per task", explain: "45M ids at 24B each, split across 10 parallel tasks, is cheap enough to keep entirely in local state." },
        ],
        breaks: {
          failure: "It is bounded and therefore incomplete, so the whole-day dedup in the recompute is needed either way.",
          handled:
            "The exact whole-day dedup runs in the Nightly recompute over the immutable archive. Sub-keying a hot ad by (ad_id, hash(user_id) % 10) keeps retries co-located; sub-keying round-robin instead would let two copies of one click land on different shards and each count once.",
        },
        choice: {
          pick: "Online dedup in a bounded 10-minute window",
          instead: "At-least-once end to end, leaving the exact whole-day dedup to the nightly recompute.",
          decider:
            "The window's memory cost against what acts on the streaming number. 45M ids at 24B is ~1.1GB across the fleet, cheap. Without it the stream runs 0.2% high, comfortably inside the published error band since the invoice comes from the recompute.",
          flips: "A display-only streaming number with nothing irreversible reading it, where a 26-hour lag on the corrected figure genuinely costs nothing.",
        },
      },
    },
    {
      id: "window",
      label: "1-min tumbling window",
      sub: "event time, 5-min lateness",
      kind: "process",
      col: 0,
      row: 3,
      parent: "stream-group",
      detail: {
        what: "Buckets each surviving event into a one-minute event-time window per ad, and emits count plus an HLL sketch when the watermark passes the window end, re-emitting on a late reopen.",
        why: "It uses event time rather than arrival time, because a phone offline for twenty minutes must still count in the minute the human clicked. A watermark is a marker saying no earlier event time is still expected; here it is the maximum observed event time minus 30 seconds, taken as the minimum across partitions.",
        numbers: [
          { value: "watermark = max event time - 30s", explain: "The out-of-orderness budget: any event more than 30s behind the newest seen is treated as late." },
          { value: "5 minutes allowed lateness, then side output", explain: "How long a closed window stays reopenable before the remaining tail is routed elsewhere instead." },
          { value: "HLL 2,048 registers, ~2KB, 2.3% error", explain: "The HyperLogLog sketch size per window, trading a small counting error for a fixed, tiny memory footprint." },
        ],
        breaks: {
          failure:
            "A hot ad saturates one task and its window state balloons until checkpoints start failing. A quieter failure: an idle partition stops advancing the watermark, so windows stop closing, indistinguishable from an ad that stopped receiving clicks.",
          handled:
            "An arrival-time counter runs alongside the event-time one specifically to tell those two apart, since only it keeps moving when the watermark stalls. Hot-task state growth is handled by resharding the offending partition.",
        },
        choice: {
          pick: "Event-time tumbling windows with watermarks and 5-minute allowed lateness",
          instead: "Processing-time windows that bucket on arrival, with no watermark and no retractions.",
          decider:
            "The measured mass of lateness beyond one window width. Roughly 3% of mobile events land more than 60s late. At a mean lateness around 40s, about 700k clicks/day cross the midnight boundary and would land on the wrong invoice under arrival time.",
          flips: "When nothing downstream cares which minute an event belongs to, though arrival-time counters still run alongside to catch a stalled watermark.",
        },
      },
    },
    {
      id: "sink",
      label: "Absolute-upsert sink",
      sub: "writes run_id 0, no transaction",
      kind: "process",
      col: 0,
      row: 3,
      parent: "stream-group",
      detail: {
        what: "Writes each closed window as an absolute value under (ad_id, ts_minute, run_id 0), including the re-emission when a late event reopens a window.",
        why: "This stage is where exactly-once actually comes from. Writing the window's total rather than a delta makes a checkpoint restore that replays a few seconds a no-op by construction. The sink needs no transaction, and a re-emitted correction needs no retraction protocol.",
        numbers: [
          { value: "~1B minute-rows/day", explain: "One row per (ad_id, minute) closed each day, across every active ad." },
          { value: "row payload ~50B, 50GB/day", explain: "1B rows at ~50B each, the write volume ClickHouse absorbs from the streaming branch alone." },
          { value: "dashboard sees the click within ~1 minute", explain: "The end-to-end delay from a click landing to it showing up in agg_minute." },
        ],
        breaks: {
          failure: "Any consumer that treats these writes as increments reintroduces double counting at exactly the point the design removed it.",
          handled:
            "The merge operator downstream of a sub-keyed hot ad is where this bug appears in practice, because summing shards looks like addition. Every reader of agg_minute is written to expect an absolute value, not a delta, to keep that mistake from recurring.",
        },
        choice: {
          pick: "SET count = the window total, keyed on (ad_id, ts_minute, run_id)",
          instead: "SET count = count + delta, or a two-phase-commit transactional sink.",
          decider:
            "What a replay does. An increment double counts on any checkpoint restore, and no amount of transactional plumbing upstream saves you. An absolute write is idempotent for free, and 2PC sinks buy the same property at a heavier, more fragile cost.",
          flips: "A sink that cannot express an upsert at all, or an aggregate that is genuinely unbounded and cannot be restated as a total per key.",
        },
      },
    },

    // --- fraud branch -------------------------------------------------------
    {
      id: "fraud",
      label: "Fraud scoring consumer",
      sub: "async layers 2-4, flags",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "A parallel consumer group off the same topic running per-IP and per-device velocity limits, behavioural signals and a model score, then writing a verdict keyed by click_id.",
        why: "Fraud is flagged, not blocked, because the error costs are asymmetric. A false positive denies an advertiser a genuine customer they never learn about, while a false negative costs one click the recompute refunds. Reading the log again, rather than chaining onto the aggregator, means a model rollback or a scoring backlog cannot stall window emission.",
        numbers: [
          { value: "verdict within 1 to 5s of the click", explain: "How long after ingest a scored verdict is available to join, well inside the 1-minute dashboard latency." },
          { value: ">10 clicks/min from one IP on one ad", explain: "One of the velocity thresholds layer two applies, tuned against measured legitimate traffic." },
          { value: "flagged but unrefunded is 1-3% of gross", explain: "The window between a click being billed and its fraud verdict being applied, carried as a finance reserve." },
          { value: "verdict store retained across the 31-day dispute window", explain: "Verdicts are kept as long as a dispute can reach back, since the recompute joins them up to a day later and a dispute later still." },
        ],
        breaks: {
          failure: "Reported revenue is systematically overstated by the flagged-but-not-yet-refunded amount.",
          handled:
            "Finance carries a reserve against that amount, so the gross dashboard number is never the number collected. fraud_flag_rate is monitored per layer per advertiser instead of in aggregate. A drifting model moves the deduction with no code change, and in aggregate that looks like a fraud wave.",
        },
        choice: {
          pick: "Async scoring off the same topic, verdict applied in the recompute",
          instead: "Blocking suspicious clicks at ingest so they never enter the aggregate.",
          decider:
            "Which error you can afford to make silently. Everything above the deterministic layer has a non-trivial false-positive rate, and a blocked genuine click is invisible to everyone. A fraudulent click that is billed instead shows up as a 1-3% deduction refunded at T+1.",
          flips: "Deterministic signals only, such as datacentre ASN ranges and known-bad user agents, whose false-positive rate is near zero and which run inline in the Click API.",
        },
      },
    },

    // --- correction path ----------------------------------------------------
    {
      id: "archive",
      label: "S3 Parquet archive",
      sub: "immutable, by dt/hour",
      kind: "blob",
      col: 1,
      row: 1,
      parent: "corr-zone",
      detail: {
        what: "Every raw event written once as compressed columnar files partitioned by date and hour, immutable and retained for years.",
        why: "The aggregate is what changes, not the events: a fraud verdict settles, a rounding rule is corrected, an attribution window is redefined. Keeping events immutable and aggregates disposable makes each of those a recompute rather than a migration. The archive has to outlive the log because the dispute window is a billing month.",
        numbers: [
          { value: "750GB/day raw, ~5x ZSTD, 150GB/day stored", explain: "Compression brings the daily write down from 750GB raw to 150GB stored, the number the archive's growth is budgeted against." },
          { value: "~55TB/year per copy", explain: "150GB/day compounded over a year, the storage footprint that makes years of retention affordable." },
          { value: "reproducible for 7 years", explain: "How long a click can still be recomputed from raw data, matching typical tax and audit retention requirements." },
        ],
        breaks: {
          failure: "It is only as good as what was written to it: an ingest-tier 503 never reaches the log and therefore never reaches here.",
          handled:
            "A sink that silently falls behind or skips a partition is the worse case: the gap is invisible until a recompute months later produces a quietly low total. Archive-lag alerting exists specifically to catch that first.",
        },
        choice: {
          pick: "Parquet with ZSTD on object storage",
          instead: "Extending hot-log retention and treating replay as the only correction path.",
          decider:
            "A 31-day restatement window on the hot log is ~70TB at roughly $5.6k/month; the same span as columnar files is ~4.7TB, roughly $110/month. Paying 50x on storage to avoid a second codebase is not a trade anyone makes.",
          flips: "Numbers that are never billed, where a single streaming path and a short retention are genuinely enough and the second implementation is pure cost.",
        },
      },
    },
    {
      id: "late-topic",
      label: "late-clicks side topic",
      sub: "beyond 5-min allowed lateness",
      kind: "queue",
      col: 1,
      row: 3,
      parent: "corr-zone",
      detail: {
        what: "The side output carrying events that arrive after their window's allowed lateness has expired, consumed by the recompute rather than dropped by the stream.",
        why: "Tiering lateness is what keeps window state bounded while still giving the long tail somewhere to land. Holding every window open for the mobile p99.9 would be absurd, and dropping the tail is not an option when each event is a billable click.",
        numbers: [
          { value: "~27M events/day arrive >60s late", explain: "The mass of events landing past one window width, the tail this side topic exists to carry." },
          { value: "mobile p99.9 = 22 min", explain: "The lateness this topic has to absorb without holding the window itself open that long." },
          { value: "0.002% of events land past 7 days", explain: "The sliver of traffic old enough to fall outside even the correction window, discarded rather than counted." },
        ],
        breaks: {
          failure: "The recompute cannot post to a closed billing period, so events older than 7 days are discarded, a silent discard of billable money.",
          handled:
            "The honest claim is 'nothing is dropped inside 7 days' rather than a stronger version. That boundary is published so advertisers know the correction window's actual limit, not an unbounded one.",
        },
        choice: {
          pick: "Side-output topic feeding the batch recompute",
          instead: "Extending allowed lateness far enough to absorb the whole tail in the stream.",
          decider:
            "Allowed lateness holds every window open for its full duration. Covering the mobile p99.9 of 22 minutes instead of 5 multiplies open-window state roughly 4x, to catch events the T+1 recompute corrects anyway.",
          flips: "When there is no batch path at all, in which case allowed lateness is the only correction mechanism you have and it has to cover the measured tail.",
        },
      },
    },
    {
      id: "spark",
      label: "Nightly recompute",
      sub: "Spark, exact dedup, run_id 2",
      kind: "service",
      col: 2,
      row: 2,
      parent: "corr-zone",
      detail: {
        what: "A Spark job over three inputs, the day's archive, the previous day's tail and the late topic, that deduplicates the whole day exactly and joins settled fraud verdicts.",
        why: "It exists to restate history, not to be faster. Replay cannot express the two things it does: an exact whole-day dedup rather than a bounded 10-minute one, and a join against verdicts that settled days after the click. It is authoritative by declaration, not by construction, which is why the drift monitor exists.",
        numbers: [
          { value: "750GB of input per full-day pass", explain: "One day of raw Parquet, reprocessed from scratch rather than as a delta from the previous run." },
          { value: "T+1, within 0.01%", explain: "It finishes the day after and matches a from-scratch exact recount to within 0.01%." },
          { value: "100% of the day recomputed, not a delta", explain: "Every key for the day is rewritten, so a bug fix or a settled verdict never has to be reconciled against a partial prior run." },
        ],
        breaks: {
          failure: "It can OOM on 750GB of input and miss the T+1 SLA, with the whole-day exact dedup as the shuffle that goes first.",
          handled:
            "The fix is repartitioning by date and ad prefix and merging incremental hourly passes, not a bigger cluster. It also checks billing_period state before writing, so a late-arriving fix cannot silently rewrite a period that already invoiced.",
        },
        choice: {
          pick: "A second batch implementation over the immutable archive",
          instead: "Stream-only, with every correction expressed as a replay through a new version of the same job.",
          decider:
            "How far back a restatement must reach against what that retention costs. Disputes and tax restatements reach a full billing month: ~70TB of replicated hot log against ~4.7TB of columnar files. The recompute also does work replay cannot, at the price of two codebases you now watch for drift.",
          flips: "Advisory numbers, or a tiered log where old segments already live on object storage and every correction genuinely is the same code over the same events.",
        },
      },
    },
    {
      id: "billing",
      label: "Billing system",
      sub: "T+1 invoicing, run_id 2 only",
      kind: "service",
      col: 2,
      row: 3,
      parent: "corr-zone",
      detail: {
        what: "The invoicing system, which reads recomputed rows only and never the streaming ones, and which owns the billing_period state the recompute checks before writing.",
        why: "The stream is provisional by design and an invoice cannot be. Drawing the arrow into billing from the batch branch alone is the entire point of the split. The number someone can dispute has to be the one computed from the immutable archive.",
        numbers: [
          { value: "T+1 invoicing", explain: "Invoices are cut the day after the events they cover, once the nightly recompute has finished." },
          { value: "$0.50 blended cost per click", explain: "The average price billed per click across the ad mix, the unit every accuracy percentage translates into real money against." },
          { value: "~$700M/day of gross ad revenue", explain: "The scale of daily billing, which is why a 0.3% drift between the two runs is worth investigating rather than ignoring." },
        ],
        breaks: {
          failure: "A recompute that lands after the invoice ships must not rewrite a billed total.",
          handled:
            "It checks billing_period state, then posts an adjustment against an open period and issues a credit memo, rather than silently changing historical revenue with no accounting entry behind it.",
        },
        choice: {
          pick: "Invoice from run_id 2, with closed periods frozen",
          instead: "Invoice from the streaming rows and true up the difference nightly.",
          decider:
            "The streaming number carries a 0.2% duplicate rate plus the lateness tail, so it can sit 3% off on the freshest minute. Billing off it turns every one of those into a credit memo instead of a number that was right the first time.",
          flips: "Prepaid or hard budget-capped products where the charge is explicitly provisional and reconciliation is expected as part of the product.",
        },
      },
    },

    // --- served store and its readers ---------------------------------------
    {
      id: "clickhouse",
      label: "ClickHouse agg_minute",
      sub: "PK (ad_id, ts_minute, run_id)",
      kind: "database",
      col: 0,
      row: 4,
      detail: {
        what: "The served columnar store where both branches meet: one row per (ad_id, ts_minute) per run, with the read path taking the highest run_id per key.",
        why: "Taking max(run_id) makes the correction invisible to the reader: the same query returns the streaming number today and the recomputed one tomorrow with no client change. The streaming row is never deleted, because the difference between run 0 and run 2 is the drift metric, and overwriting in place destroys the evidence.",
        numbers: [
          { value: "1B minute-rows/day at 50B = 50GB/day", explain: "The daily write volume the store absorbs from the streaming branch alone, before the nightly overwrite adds run 2." },
          { value: "12 q/s average, ~1k q/s peak", explain: "The read rate dashboards and reports drive against this table across the day, with sharp bursts at report time." },
          { value: "agg_day 250MB/day, ~90GB a year", explain: "A coarser daily rollup kept alongside agg_minute for reports that do not need minute granularity." },
        ],
        breaks: {
          failure: "A merge backlog: when minute rows arrive faster than parts merge, parts_to_merge climbs and query latency degrades.",
          handled:
            "The fix is pre-aggregating to a coarser grain before the write, not scaling the store, since the store's own merge throughput is what is saturating rather than its capacity.",
        },
        choice: {
          pick: "Columnar OLAP holding every run side by side",
          instead: "A KV store of counters, or one row per key overwritten in place by the latest run.",
          decider:
            "The read shape and the audit shape at once. ~1k q/s peak over 1B minute-rows/day is a range-scan problem rather than a point lookup, and keeping run 0 beside run 2 is what makes a dispute answerable at all.",
          flips: "Pure point-lookup counters at very high write rates with no analytical queries and no audit requirement, where a KV store is simpler to run.",
        },
      },
    },
    {
      id: "dashboards",
      label: "Advertiser dashboards",
      sub: "under 1 min, published bands",
      kind: "client",
      col: 1,
      row: 4,
      detail: {
        what: "Roughly 1M advertisers reading their own ads out of agg_minute in a browser, plus top-N served from the daily rollup.",
        why: "Dashboards read the stream and not the recompute. A number that is 3% low for one minute, then within 0.5% an hour later, is worth more to someone pacing a live campaign. A number that is exact 26 hours later is worth far less.",
        numbers: [
          { value: "freshest closed minute within 3%", explain: "The published accuracy band on the newest data point, driven by the sketch's counting error and the dedup window's incompleteness." },
          { value: "older than 10 min within 0.5%", explain: "Accuracy tightens once late-arriving events have mostly settled into the closed windows they belong to." },
          { value: "5% of 1M advertisers open one daily", explain: "1M x 5% = 50k daily active readers; the read tier is provisioned for that concurrency, not the full 1M advertiser base." },
        ],
        breaks: {
          failure: "A stalled watermark flatlines the chart in a way indistinguishable from an ad receiving no clicks, and the advertiser reads it as the latter.",
          handled:
            "An arrival-time counter runs alongside the event-time one and is the only thing that keeps moving when a watermark stalls. It is what an on-call engineer checks to tell the two apart.",
        },
        choice: {
          pick: "Serve streaming rows with accuracy bands published per freshness tier",
          instead: "Show only reconciled numbers, so every figure on screen is final.",
          decider:
            "T+1 rows are within 0.01% but 26 hours old; the streaming rows are within 3% on the freshest minute and 0.5% past 10 minutes. Hiding the fresh number to protect exactness costs an advertiser a day of pacing decisions to save a 3% error they were told about.",
          flips: "When the only consumer is finance, where a provisional number on the same screen as an invoiced one is a liability rather than a feature.",
        },
      },
    },
    {
      id: "drift",
      label: "Drift monitor",
      sub: "run 0 vs run 2, per ad decile",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "A job that diffs the streaming run against the recomputed run key by key and publishes the distribution of the difference rather than its total.",
        why: "Two implementations of one piece of arithmetic will drift, and this architecture detects drift rather than preventing it. Publishing the difference turns an advertiser saying 'your number is 0.3% low' from an escalation into a band somebody already agreed to.",
        numbers: [
          { value: "target under 1% before reconciliation", explain: "The threshold the network-total drift is expected to stay under before it triggers an investigation." },
          { value: "T+1 within 0.01%", explain: "The accuracy the recomputed side is held to, the number the streaming side is measured against." },
          { value: "alerted across 10 deciles per ad", explain: "The drift is bucketed by ad size into 10 deciles, so a small cohort of ads being badly wrong is not averaged away." },
        ],
        breaks: {
          failure: "Alerting on the network total hides two ads that are each 5% wrong in opposite directions, exactly the shape a real aggregation bug has.",
          handled:
            "The per-decile breakdown is what surfaces that shape. A bug clusters on a dimension or points both ways, while lateness-shaped drift is one-directional and concentrated near the end of the day.",
        },
        choice: {
          pick: "Diff the two runs and alert on the shape of the distribution",
          instead: "Generate both engines from a single shared definition so they cannot disagree.",
          decider:
            "One shared definition works for counts and sums, but breaks on anything stateful, and two of our measures are stateful: HLL distinct users and sessionised attribution. So the fork is what a 0.3% gap costs to investigate, against a single definition that cannot express those two measures at all.",
          flips: "Pipelines whose aggregates are genuinely stateless sums, where a shared definition removes the drift by construction and this job with it.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "click-api",
      tier: "hot",
      step: 1,
      label: "click_id stamped by client",
      detail: {
        what: "The click event itself: click_id, ad_id, user_id, event_ts, ip and user agent, retried with the same click_id on failure.",
        why: "The retry semantics of this one hop are the whole dedup story. Because the id is generated before the request and reused, a retry is recognisable rather than being a second click, which is what lets every later stage collapse it.",
        numbers: [
          { value: "500B per event", explain: "The payload size per click event on the wire, the figure the archive and stream storage estimates are built from." },
          { value: "retry tail p99.9 = 8 min", explain: "How long after the original a retry can still arrive, which sets the dedup TTL above it." },
        ],
        breaks: {
          failure: "A client clock can be wrong, so a claimed timestamp far in the future would poison the event-time watermark if trusted blindly.",
          handled: "The ingest tier records its own receipt time alongside the claimed one and rejects anything more than 24 hours in the future, before it ever reaches the log.",
        },
      },
    },
    {
      id: "e2",
      from: "click-api",
      to: "kafka",
      tier: "hot",
      step: 2,
      label: "append, key = ad_id",
      detail: {
        what: "The validated click appended to the partition that owns its ad_id, acknowledged before the API returns 204.",
        why: "Nothing computes on a click until it is durable. Writing to the log first is what makes every downstream number recomputable, and it decouples ingest availability from the availability of any aggregation engine.",
        numbers: [
          { value: "99.9% durably logged within 1s", explain: "The write-acknowledgement latency the ingest tier holds itself to before returning success to the client." },
          { value: "~75k events/s peak", explain: "The append rate the topic and its partitions are provisioned for at peak traffic." },
        ],
        breaks: {
          failure: "If the API acknowledges before the append is durable, a broker failure loses clicks the client believes were delivered.",
          handled: "The client will never retry a click it believes succeeded, so the API only returns 204 after the broker has durably acknowledged the write, closing that gap.",
        },
      },
    },
    {
      id: "e3",
      from: "kafka",
      to: "dedup",
      tier: "hot",
      step: 3,
      label: "keyBy ad_id, no shuffle",
      detail: {
        what: "The hot path: every event streaming into the job's first operator, already partitioned by the key it will be grouped on.",
        why: "Because the log is keyed by ad_id, the consumer's grouping is free: no shuffle, no repartition. Both copies of a retried click reach the same task, which is what allows dedup to be a local state lookup rather than a distributed one.",
        numbers: [
          { value: "~17k events/s average, ~75k peak", explain: "The consumption rate each of the 10 parallel tasks shares, entering the dedup stage directly from the partitioned log." },
          { value: "parallelism 10 per the dedup budget", explain: "The task count chosen so per-task dedup state stays comfortably under 1GB even at peak." },
        ],
        breaks: {
          failure: "Adding partitions to scale rehashes keys and can move a hot ad onto an already-hot task.",
          handled: "Partition count and stream parallelism have to be raised together, with the resulting distribution checked afterwards rather than assumed even after a resize.",
        },
      },
    },
    {
      id: "e4",
      from: "kafka",
      to: "fraud",
      tier: "data",
      label: "parallel consumer group",
      detail: {
        what: "A second consumer group reading the same events for velocity, behavioural and model-based fraud scoring.",
        why: "Fraud detection is off the critical path deliberately. Reading the log again rather than chaining onto the aggregator means a model rollback or a scoring backlog cannot stall window emission or click ingestion.",
        numbers: [{ value: "verdict lands 1 to 5s after the click", explain: "The scoring latency this independent consumer runs at, decoupled from the streaming aggregator's own clock." }],
        breaks: {
          failure: "The two consumers can diverge in lag, so a verdict may arrive after the window it belongs to has already been emitted.",
          handled: "That is precisely why the verdict is applied in the recompute rather than in the stream. A late verdict is simply joined the next night instead of blocking anything live.",
        },
      },
    },
    {
      id: "e5",
      from: "kafka",
      to: "archive",
      tier: "data",
      label: "raw events, Parquet",
      detail: {
        what: "A sink writing the raw events, unaggregated, to compressed columnar files partitioned by date and hour.",
        why: "This is the branch that makes the correction path possible at all. The archive has to outlive the log, because the dispute window is a billing month and the log is sized at 7 days for replay and recovery, not for restatement.",
        numbers: [
          { value: "150GB/day after ~5x compression", explain: "The daily bytes landed to object storage once ZSTD compression is applied to the raw stream." },
          { value: "7-day log against 7-year archive", explain: "The retention gap between the hot log, sized for recovery, and the archive, sized for years of audit." },
        ],
        breaks: {
          failure: "If this sink silently falls behind or skips a partition, the gap is invisible until much later.",
          handled: "A recompute months after the fact would produce a total that is quietly low. Archive lag is monitored as its own alert instead, so it is caught before a mismatched recompute finds it.",
        },
      },
    },
    {
      id: "e7",
      from: "dedup",
      to: "window",
      tier: "hot",
      step: 4,
      label: "unseen click_ids only",
      detail: {
        what: "The surviving events, one per click_id within the 10-minute TTL, handed to the windowing operator on the same task.",
        why: "Dropping repeats before windowing rather than after is what keeps the correction cheap. A duplicate that reaches the aggregate has to be subtracted out later, and the re-emission would have to be retracted downstream.",
        numbers: [
          { value: "0.2% dropped as repeats", explain: "The measured duplicate rate removed at this stage, matching the retry rate observed at the client." },
          { value: "0 network hops, in-process", explain: "Because dedup and window are chained operators on the same task, this handoff is a function call, not a network write." },
        ],
        breaks: {
          failure: "If the dedup TTL is shortened below the measured 8-minute retry tail, repeats start slipping through.",
          handled: "The stream drifts high in a way that only shows up against the recompute a day later. The TTL is kept above the measured tail with margin, rather than tuned down for memory.",
        },
      },
    },
    {
      id: "e8",
      from: "window",
      to: "sink",
      tier: "hot",
      step: 5,
      label: "closed window totals",
      detail: {
        what: "The count and HLL sketch for a (ad_id, ts_minute) bucket, emitted when the watermark passes the window end and again on every in-lateness correction.",
        why: "The window emits a total rather than a delta, which is the property the sink depends on. Corrections travel as a new total for the same key, so nothing downstream needs to understand retraction.",
        numbers: [
          { value: "~1B emissions/day", explain: "One emission per closed (ad_id, minute) bucket across the day, plus re-emissions from late corrections." },
          { value: "re-emits inside 5 minutes of lateness", explain: "The window reopens and re-emits only within its allowed-lateness budget, after which the late-clicks side topic takes over." },
        ],
        breaks: {
          failure: "A re-emission that arrives out of order with the original would overwrite a corrected value with a stale one.",
          handled: "Ordering per key is preserved because both emissions come from the same task, and losing that ordering is exactly what sub-keying a hot ad risks if done carelessly.",
        },
      },
    },
    {
      id: "e11",
      from: "window",
      to: "late-topic",
      tier: "control",
      label: "past 5-min lateness",
      detail: {
        what: "Events whose event time falls outside their window's allowed lateness, routed to a side output instead of being discarded.",
        why: "Dropping them is theft in one direction, and holding every window open long enough to catch a 22-minute mobile tail is unaffordable state. The side output lets the stream stay bounded while the tail is still counted somewhere.",
        numbers: [
          { value: "5 minutes allowed lateness", explain: "The threshold past which an event is routed here instead of reopening its original window." },
          { value: "~27M events/day land >60s late", explain: "The mass of traffic that is late enough to matter, most of which still lands inside the 5-minute window and only a fraction reaches this side topic." },
        ],
        breaks: {
          failure: "A spike on this topic can mean either a client regression or a stalled watermark, and the two need opposite responses.",
          handled: "The rate and age distribution on this topic is a monitored signal specifically so an on-call engineer can tell a genuine traffic surge from a stuck watermark before reacting.",
        },
      },
    },
    {
      id: "e12",
      from: "sink",
      to: "clickhouse",
      tier: "hot",
      step: 6,
      label: "absolute upsert, run_id 0",
      detail: {
        what: "Each closed window written as an absolute value under (ad_id, ts_minute, run_id 0), including re-emissions when a late event reopens the window.",
        why: "Writing the total rather than a delta is the difference between exactly-once and nearly-once. A replay after a checkpoint restore writes the same value twice and changes nothing, so the sink needs no transaction.",
        numbers: [
          { value: "~1B minute-rows/day", explain: "The write rate this hot edge carries into ClickHouse, one row per closed window." },
          { value: "dashboard sees the click within ~1 minute", explain: "The end-to-end freshness this write path delivers, from click to a queryable row." },
        ],
        breaks: {
          failure: "Insert rate is the constraint, not correctness: minute rows arriving faster than parts merge back up the store's merge queue.",
          handled: "The fix is a coarser write grain rather than a bigger cluster, since the bottleneck is ClickHouse's own background merge throughput, not this write path's rate.",
        },
      },
    },
    {
      id: "e13",
      from: "clickhouse",
      to: "dashboards",
      tier: "hot",
      step: 7,
      label: "agg_minute reads",
      detail: {
        what: "Advertiser dashboard queries against the highest run_id per key, plus top-N served from the daily rollup.",
        why: "The read path taking max(run_id) is what makes the correction invisible to the reader. The same query returns the streaming number today and the recomputed one tomorrow, with no client change.",
        numbers: [{ value: "12 q/s average, ~1k q/s peak at the top of the hour", explain: "The read load this hot edge serves, dominated by scheduled reports firing at a shared clock boundary." }],
        breaks: {
          failure: "Scheduled reports cluster at the top of the hour at roughly 100x the mean.",
          handled: "The store is sized for a burst that lasts seconds and idles the rest of the time, rather than provisioned for the average and left to degrade at the peak.",
        },
      },
    },
    {
      id: "e14",
      from: "clickhouse",
      to: "drift",
      tier: "control",
      label: "run 0 vs run 2",
      offset: 60,
      detail: {
        what: "A key-by-key diff of the streaming rows against the recomputed rows for the same day, read out of the same table.",
        why: "The streaming row is deliberately never deleted, so this diff has something to compare against. Overwriting in place would destroy the only evidence available when an advertiser disputes a number.",
        numbers: [
          { value: "target under 1% before reconciliation", explain: "The network-total drift threshold the monitor is tuned to alert below." },
          { value: "distribution across 10 deciles", explain: "The diff is bucketed by ad-size decile rather than summed, so a small cohort being badly wrong is not hidden by averaging." },
        ],
        breaks: {
          failure: "Lateness-shaped drift and a genuine bug look identical in the total, so this read has to be per key.",
          handled: "A bug clusters on a dimension or points both ways, while lateness is one-directional with batch running higher, which is exactly what the per-decile breakdown is built to distinguish.",
        },
      },
    },
    {
      id: "e15",
      from: "archive",
      to: "spark",
      tier: "data",
      label: "whole day, exact dedup",
      detail: {
        what: "The full day of raw Parquet re-read from scratch so the aggregation is recomputed rather than adjusted.",
        why: "Recomputing from raw is what makes a three-week-old aggregation bug fixable. The corrected logic runs over the same immutable input and produces a new run, so nothing has to be patched or reversed in place.",
        numbers: [
          { value: "750GB of input per full-day pass", explain: "The exact volume repartitioned by date and ad prefix before the shuffle; growth outpacing the cluster is what triggers the OOM this stage is watched for." },
          { value: "dedup over the whole day, not a 10-minute window", explain: "The exact dedup this pass performs, closing the gap the streaming side's bounded TTL leaves open." },
        ],
        breaks: {
          failure: "A whole-day exact dedup is a large shuffle, and it is the step that OOMs first when a day's volume grows faster than the cluster.",
          handled: "Repartitioning by date and ad prefix spreads that shuffle evenly, which is the fix applied before reaching for a bigger cluster.",
        },
      },
    },
    {
      id: "e16",
      from: "late-topic",
      to: "spark",
      tier: "data",
      label: "late tail",
      detail: {
        what: "The very-late events consumed as one of the recompute's three inputs, alongside the day's archive and the previous day's tail.",
        why: "This is where the events the stream could not place finally get counted into the right minute. That is the reason the side output exists, rather than a dead-letter queue nobody reads.",
        numbers: [{ value: "1 full-day pass, run after midnight", explain: "The recompute runs once nightly, consuming everything the late topic has accumulated for the day." }],
        breaks: {
          failure: "Anything on this topic older than 7 days is discarded, because the recompute cannot post into a closed billing period.",
          handled: "That discard is silent by design and is the accepted cost of a bounded correction window, published as a limit rather than treated as a bug to fix.",
        },
      },
    },
    {
      id: "e17",
      to: "spark",
      tier: "data",
      from: "fraud",
      label: "settled verdicts",
      offset: 80,
      detail: {
        what: "Fraud verdicts joined into the recompute by click_id so flagged clicks are removed from billable totals.",
        why: "Verdicts settle after the click, sometimes days after, which is work a replay of the original event stream cannot express. It is one of the two reasons the batch path is not just a slower copy of the stream.",
        numbers: [{ value: "1-3% of gross flagged and refunded", explain: "This is exactly the amount every pre-recompute number, dashboards and real-time billing, overstates revenue by until this T+1 pass corrects it." }],
        breaks: {
          failure: "A model that drifts moves this deduction without anyone changing code.",
          handled: "fraud_flag_rate is monitored per layer per advertiser rather than in aggregate, which is what surfaces a drifting model instead of it looking like a fraud wave.",
        },
      },
    },
    {
      id: "e18",
      from: "spark",
      to: "clickhouse",
      tier: "hot",
      step: 8,
      label: "overwrite, run_id 2",
      detail: {
        what: "Absolute values written under a higher run_id for every key the recompute touched, leaving the streaming rows in place.",
        why: "Writing a new run rather than mutating the old one keeps the read path simple: take the max run_id. It also makes the recompute itself replayable, and preserves the difference the drift monitor and any dispute depend on.",
        numbers: [{ value: "hourly pass run_id 1, full day run_id 2", explain: "Two recompute cadences write two run ids, with the full-day pass at run_id 2 the one billing reads." }],
        breaks: {
          failure: "If the recompute wrote in place, a bug in the batch job would destroy the streaming evidence it is supposed to be checked against.",
          handled: "Writing a new run_id instead means there would be nothing left to diff if it overwrote in place, which is exactly why every run is additive rather than destructive.",
        },
      },
    },
    {
      id: "e19",
      from: "spark",
      to: "billing",
      tier: "hot",
      step: 9,
      label: "billable totals, T+1",
      detail: {
        what: "The recomputed, deduplicated, fraud-adjusted totals handed to invoicing, which reads nothing else.",
        why: "This is the arrow that justifies the whole right-hand branch. Billing reads one source, and that source is the one derived from immutable events, so any invoice can be reproduced from raw data years later.",
        numbers: [
          { value: "T+1 within 0.01%", explain: "The accuracy bar the totals crossing this edge are held to before an invoice is cut." },
          { value: "$0.50 blended per click", explain: "The average revenue per click these totals convert into on the invoice." },
        ],
        breaks: {
          failure: "Once this fires for a period, the period is closed.",
          handled: "A later correction has to arrive as an adjustment plus a credit memo against an open period, not as a rewrite of a number that has already been invoiced.",
        },
      },
    },
  ],
  figures: {
    "sub-key": {
      title: "Round-robin double-counts; sub-key by user_id does not",
      nodes: [
        {
          id: "rr-retries",
          label: "Round-robin: retries of X",
          sub: "click_id X, user U, 2 copies",
          kind: "client",
          col: 0,
          row: 0,
        },
        {
          id: "rr-shards",
          label: "2 shards count X",
          sub: "double counted",
          kind: "database",
          col: 0,
          row: 1,
          detail: {
            what: "Round-robin spreads a retry's two copies across different shards, each with its own dedup state.",
            why: "Neither shard's keyed state knows the other exists, so both copies of the same click get counted.",
          },
        },
        {
          id: "uk-retries",
          label: "Sub-key by user_id",
          sub: "retries of X, both carry user U",
          kind: "client",
          col: 1,
          row: 0,
        },
        {
          id: "uk-shard",
          label: "shard = hash(U)",
          sub: "counts X once",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "Sub-keying by hash(user_id) sends every retry of one click to the same shard, because user_id is identical across retries.",
            why: "Dedup stays correct because both copies land in one shard's keyed state, and the ad's load still spreads across N shards by user.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "rr-retries", to: "rr-shards", tier: "control", label: "split across shards" },
        { id: "e2", from: "uk-retries", to: "uk-shard", tier: "hot", step: 1, label: "same shard, both copies" },
      ],
    },
    restatement: {
      title: "A recompute posts an adjustment, never a rewrite",
      nodes: [
        { id: "run0", label: "run_id 0", sub: "stream, first pass", kind: "service", col: 0, row: 0 },
        { id: "invoiced", label: "Period invoiced", sub: "closed, billed to advertiser", kind: "external", col: 1, row: 0 },
        {
          id: "run2",
          label: "run_id 2",
          sub: "nightly recompute, corrected",
          kind: "service",
          col: 0,
          row: 1,
          detail: {
            what: "A full recompute over the immutable archive, written as a new numbered run rather than overwriting run_id 0.",
            why: "Keeping the old run intact means the served table's history is never silently rewritten; only a new run supersedes it going forward.",
          },
        },
        { id: "bugfound", label: "Bug found", sub: "3 weeks later", kind: "external", col: 1, row: 1 },
        {
          id: "adjustment",
          label: "Adjustment",
          sub: "credit or charge, own record",
          kind: "database",
          col: 0,
          row: 2,
          detail: {
            what: "A credit or charge posted against the affected advertisers once a corrected run disagrees with an already-invoiced total.",
            why: "A number that has already been invoiced is an accounting fact. Changing it needs a recorded adjustment, not a silent update.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "run0", to: "run2", tier: "hot", step: 1, label: "superseded by correction" },
        { id: "e2", from: "bugfound", to: "run2", tier: "data", label: "triggers recompute" },
        { id: "e3", from: "run2", to: "adjustment", tier: "hot", step: 2, label: "corrected total" },
        { id: "e4", from: "invoiced", to: "adjustment", tier: "control", label: "never rewritten in place" },
      ],
    },
  },
};
