import type { Diagram } from "./types";

export const AD_CLICK_AGGREGATION: Diagram = {
  id: "ad-click-aggregation",
  title: "Ad Click Aggregation",
  question: "Design Ad Click Event Aggregation",
  sourceId: "patterns",
  itemId: 18,
  overview: {
    shape:
      "One durable log with two readers off it: a fast provisional branch that feeds dashboards in under a minute, and a slow authoritative branch that recomputes the same numbers from an immutable archive and is the only thing billing is allowed to read.",
    beats: [
      "Everything starts with a log, not a database. Clicks append to a Kafka topic partitioned by ad_id before anything aggregates them, so the raw events are the source of truth and every number downstream is derived and disposable. Partitioning by ad_id also puts a retry on the same partition as the original, which is what makes dedup local.",
      "The stream job keys by ad, drops any click_id it has seen in the last 10 minutes, and buckets by event time into one-minute tumbling windows. Event time rather than arrival time because a phone that was offline for twenty minutes must still count in the minute the human clicked, and at a day boundary arrival time puts the click on the wrong invoice.",
      "Watermarks decide when a window is done, and lateness has three tiers: on time, inside the 5-minute allowed lateness where the window reopens and re-emits, and later than that where the event goes to a side-output topic rather than being dropped. Each one of those events is money, so nothing is discarded in the stream.",
      "The sink writes absolute values under the primary key (ad_id, ts_minute, run_id) rather than incrementing a counter. That single choice is where exactly-once actually comes from: a checkpoint restore that replays a few seconds is a no-op by construction, so the sink needs no transaction at all.",
      "The same raw events also land as Parquet on object storage, and a nightly Spark job re-reads the whole day, deduplicates it exactly, joins the fraud verdicts that have settled since, and overwrites the streaming rows with a higher run_id. Dashboards read the stream, billing reads the recompute, and the difference between them is published rather than hidden.",
    ],
    crux:
      "Two implementations of the same arithmetic will drift, and this design detects the drift rather than preventing it. The recompute is authoritative because we declared it so, not because anything proves it right, so the engineering that matters is making the difference between the two numbers explainable per ad decile instead of arguing about a network total.",
    numbers: [
      "10B events/day, 500k/s peak",
      "1-minute windows, 5-minute allowed lateness",
      "465TB of hot log vs 31TB of Parquet for a billing month",
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
        why: "It exists to restate history, not to be faster. The moment an aggregate is billed you need somewhere for a correction to live that a replay cannot express: an exact whole-day dedup rather than a bounded 10-minute one, and fraud verdicts that settled days after the click. Everything inside this boundary is reproducible from raw events years later, which is the property an invoice needs and the stream does not have.",
        numbers: ["T+1 authoritative totals, within 0.01%", "31-day restatement window", "5TB of Parquet input per full-day pass"],
        breaks:
          "It cannot post into a closed billing period. A correction found after the invoice ships becomes an adjustment and a credit memo — an accounting event, not a data update — and anything older than 7 days on the late topic is discarded outright.",
      },
    },
    {
      id: "stream-group",
      label: "Flink aggregator",
      sub: "one job: dedup, window, sink",
      kind: "serviceGroup",
      col: 1,
      row: 3,
      detail: {
        what: "One Flink job. The three stages inside it are chained operators in a single dataflow sharing one keyed state backend and one checkpoint barrier, not three services with topics between them.",
        why: "keyBy(ad_id) once, then dedup, window and sink all run on the same key on the same task, so the dedup lookup is a local state read and the window aggregate never leaves the node. The chaining is also what makes the exactly-once story work: operator state and Kafka offsets sit under one barrier and are therefore checkpointed together.",
        numbers: ["parallelism 10, sized on the dedup budget", "115k events/s average, 500k peak", "one checkpoint barrier across all three stages"],
        breaks:
          "Because it is one deployment, a hot ad that saturates the window operator backpressures dedup and the source read of that partition too. You cannot scale one stage without the others, and the global watermark is the minimum across partitions, so one lagging task freezes window emission for every other ad.",
        choice: {
          pick: "One chained Flink job, all three operators in the same task slot",
          instead: "A service per stage with a topic between each, so each scales and deploys on its own.",
          decider:
            "The per-event cost of a hop at 500k events/s. Three intermediate topics mean three extra durable writes per event and three more places where state and offsets can diverge; chaining keeps dedup, windowing and the sink under one checkpoint barrier, which is the only reason state and offsets can be written atomically at all.",
          flips:
            "A stage with a genuinely different scaling profile or release cadence — model inference is the case here, which is exactly why fraud scoring is a separate consumer rather than a fourth operator in this job.",
        },
      },
    },

    // --- ingest spine -------------------------------------------------------
    {
      id: "client",
      label: "Ad clicks",
      sub: "browser / mobile SDK, stamps click_id",
      kind: "client",
      col: 1,
      row: 0,
      detail: {
        what: "The browser or mobile SDK that fires the click and generates the click_id it reuses verbatim on every retry.",
        why: "The idempotency key has to come from the client or it is useless: a server-generated id makes each retry a fresh event, so a duplicate becomes a fact rather than something detectable. Mobile SDKs also buffer across connectivity gaps, which is where the entire lateness problem comes from.",
        numbers: ["1.5B billable clicks/day", "measured duplicate rate 0.2%", "mobile p99.9 lateness 22 min"],
        breaks:
          "A client bug that regenerates click_id per retry collapses the dedup hit rate to zero, and the online path cannot recover it. The day is corrected at T+1 against a secondary key of (user_id, ad_id, ts rounded to 1s).",
        choice: {
          pick: "Client-generated UUIDv7 click_id, reused on retry",
          instead: "An id minted by the ingest tier on arrival.",
          decider:
            "Whether a retry is recognisable at all. A server-side id gives every one of the 0.2% duplicates a distinct identity, so nothing downstream can collapse them. UUIDv7 (RFC 9562) is also time-ordered, so the 16B id sorts usefully in the Parquet archive and carries a coarse event time even when the explicit timestamp field is corrupt.",
          flips:
            "Server-to-server integrations where the caller cannot be trusted to generate ids and a signed request hash serves the same purpose.",
        },
      },
    },
    {
      id: "click-api",
      label: "Click API",
      sub: "stateless, layer-1 blocks inline",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "The stateless ingest tier: validate the event, apply the deterministic fraud blocklists, append to the log, return 204.",
        why: "Ingest has to stay available and cheap while everything expensive happens downstream. Only the deterministic checks run here, because they are the only layer with a near-zero false-positive rate and therefore the only one that can afford to sit in the availability path of every click.",
        numbers: ["500k events/s peak, 115k average", "layer-1 checks under 2ms", "rejects claimed times >24h in the future"],
        breaks:
          "A viral campaign overruns the tier and 503s clicks that never reach the log at all. Nothing downstream can replay an event that was never written, which is why this is the one place where losing traffic is unrecoverable.",
        choice: {
          pick: "Thin stateless append, deterministic checks only",
          instead: "Score every click against the fraud model synchronously before accepting it.",
          decider:
            "Model inference at 500k events/s needs a fleet sized for peak and puts a model rollback inside the availability path of click ingestion, to buy 1 to 5 seconds of latency. Layer one costs under 2ms and stays inline; layers two to four run as an async consumer, which is fast enough for the stream and irrelevant to the recompute.",
          flips:
            "Formats where a click spends budget irreversibly at request time, so a verdict arriving 5 seconds later is a verdict arriving too late.",
        },
      },
    },
    {
      id: "kafka",
      label: "Kafka topic",
      sub: "partitioned by ad_id, 7d retention",
      kind: "queue",
      col: 1,
      row: 2,
      detail: {
        what: "The durable, ordered, replayable log every click lands in before anything computes on it. It is the source of truth; every aggregate is derived and disposable.",
        why: "Partitioning by ad_id does two jobs at once: it co-locates all events for one ad so aggregation is local and needs no shuffle, and it lands a retry on the same partition as the original, which is what makes dedup possible in keyed state rather than through an external lookup.",
        numbers: ["10B events/day, 500B per event", "5TB/day raw", "7d x RF=3 = 105TB"],
        breaks:
          "Partition skew. A Super Bowl ad at 50k clicks/s pins one partition at 100x the rest, and because the global watermark is the minimum across partitions, that one lagging task freezes window emission for every other ad in the system.",
        choice: {
          pick: "Kafka partitioned by ad_id, 7-day hot retention",
          instead: "Round-robin or hash(click_id) partitioning, which balances load perfectly.",
          decider:
            "Dedup lives in keyed state, so both copies of one click must reach the same key; round-robin balances better and silently double counts. Retention is sized on the retry tail and recovery rather than the dispute window, because 31 days hot is 5TB x 31 x RF=3 = 465TB at roughly $37k/month against 31TB of Parquet at roughly $700/month.",
          flips:
            "Tiered log storage (KIP-405, production-ready in Kafka 3.9) puts old segments on object storage and kills the cost half of that argument, though not the part about fraud verdicts that settle days after the click.",
        },
      },
    },

    // --- stages inside the Flink job ---------------------------------------
    {
      id: "dedup",
      label: "Dedup by click_id",
      sub: "keyed state, 10-minute TTL",
      kind: "process",
      col: 1,
      row: 3,
      parent: "stream-group",
      detail: {
        what: "A per-key set of click_ids seen in the last 10 minutes, held in the same state backend as the window; a repeat is dropped before it ever reaches the aggregate.",
        why: "Because the topic is keyed by ad_id and a retry carries the same ad_id, both copies of a click reach the same key. That makes the check a local state read with a TTL rather than an external lookup or a shuffle, which is the only version of dedup that survives 500k events/s.",
        numbers: ["retry tail p99.9 = 8 min, TTL set at 10", "500k/s x 600s = 300M ids in flight", "24B per entry = 7.2GB fleet-wide, <1GB per task"],
        breaks:
          "It is bounded and therefore incomplete, so the whole-day dedup in the recompute is needed either way. It is also coupled to how you shard a hot ad: sub-key by (ad_id, hash(user_id) % 10) and retries stay co-located; sub-key round-robin or by hash(click_id) and the two copies of one click land on different shards, each counting it once.",
        choice: {
          pick: "Online dedup in a bounded 10-minute window",
          instead: "At-least-once end to end, leaving the exact whole-day dedup to the nightly recompute.",
          decider:
            "The window's memory cost against what acts on the streaming number. 300M ids at 24B is 7.2GB across the fleet, under 1GB per task, which is cheap; without it the stream runs 0.2% high, comfortably inside the published band, and the invoice is untouched because the invoice comes from the recompute. Budget pacing settles it: a broken retry loop that turns 0.2% duplicates into 30% for an hour auto-pauses campaigns that still had budget, and no nightly correction un-pauses an ad that already missed its auctions.",
          flips:
            "A display-only streaming number with nothing irreversible reading it, where a 26-hour lag on the corrected figure genuinely costs nothing.",
        },
      },
    },
    {
      id: "window",
      label: "1-min tumbling window",
      sub: "event time, 5-min allowed lateness",
      kind: "process",
      col: 1,
      row: 5,
      parent: "stream-group",
      detail: {
        what: "Buckets each surviving event into a one-minute event-time window per ad and emits count plus an HLL sketch when the watermark passes the window end, re-emitting if a late event reopens it.",
        why: "Event time rather than arrival time, because a phone offline for twenty minutes must still count in the minute the human clicked. The watermark is the maximum observed event time minus 30 seconds of out-of-orderness, taken as the minimum across partitions so the slowest partition governs progress.",
        numbers: ["watermark = max event time - 30s", "5 minutes allowed lateness, then side output", "HLL 2,048 registers, ~2KB, 2.3% error"],
        breaks:
          "A hot ad saturates one task and its window state balloons until checkpoints start failing. The other failure is silent: an idle partition stops advancing the watermark, so windows stop closing and the output rate flatlines in a way indistinguishable from an ad that stopped receiving clicks. Only an arrival-time counter alongside tells those two apart.",
        choice: {
          pick: "Event-time tumbling windows with watermarks and 5-minute allowed lateness",
          instead: "Processing-time windows that bucket on arrival, with no watermark and no retractions.",
          decider:
            "The measured mass of lateness beyond one window width. Roughly 3% of mobile events at 60% mobile share is 180M events/day landing more than 60s late, and with mean lateness around 40s the fraction crossing midnight is 40/86,400 = 0.046%, about 700k clicks/day or $350k of revenue on the wrong invoice.",
          flips:
            "When nothing downstream cares which minute an event belongs to. Run arrival-time counters alongside regardless, because they are the only way to tell a stalled watermark from genuinely quiet traffic.",
        },
      },
    },
    {
      id: "sink",
      label: "Absolute-upsert sink",
      sub: "writes run_id 0, no transaction",
      kind: "process",
      col: 1,
      row: 6,
      parent: "stream-group",
      detail: {
        what: "Writes each closed window as an absolute value under (ad_id, ts_minute, run_id 0), including the re-emission when a late event reopens a window.",
        why: "This stage is where exactly-once actually comes from. Writing the window's total rather than a delta makes a checkpoint restore that replays a few seconds a no-op by construction, so the sink needs no transaction and a re-emitted correction needs no retraction protocol.",
        numbers: ["~1B minute-rows/day", "row payload ~50B, 50GB/day", "dashboard sees the click within about a minute"],
        breaks:
          "Any consumer that treats these writes as increments reintroduces double counting at exactly the point the design removed it. The merge operator downstream of a sub-keyed hot ad is the one that gets this wrong in practice, because summing shards looks like addition.",
        choice: {
          pick: "SET count = the window total, keyed on (ad_id, ts_minute, run_id)",
          instead: "SET count = count + delta, or a two-phase-commit transactional sink.",
          decider:
            "What a replay does. An increment double counts on any checkpoint restore and no amount of transactional plumbing upstream saves you; an absolute write is idempotent for free. Two-phase-commit sinks exist and work, but they are a heavier and more fragile way to buy a property the shape of the write already gives you.",
          flips:
            "A sink that cannot express an upsert at all, or an aggregate that is genuinely unbounded and cannot be restated as a total per key.",
        },
      },
    },

    // --- stream-side state --------------------------------------------------
    {
      id: "rocksdb",
      label: "RocksDB state backend",
      sub: "local NVMe, task-owned",
      kind: "cache",
      col: 0,
      row: 3,
      detail: {
        what: "Window aggregates, per-key dedup sets and HLL sketches on the task's own local NVMe. Not shared, not replicated, and not a system of record.",
        why: "State across millions of keys plus 10 minutes of click_ids does not fit on heap, and an external store would add a network round trip at 500k events/s for a check that is already node-local. It is deliberately losable: the log plus the last checkpoint rebuild it, which is exactly why the source of truth is the log and not this.",
        numbers: ["300M ids at 24B = 7.2GB fleet-wide", "under 1GB per task at parallelism 10", "HLL ~2KB per key"],
        breaks:
          "Losing the node loses it, and the recovery cost is the distance back to the last good checkpoint. The operational symptom is dashboard lag while the task replays, not an obvious storage error, so it is usually diagnosed from the wrong end.",
        choice: {
          pick: "RocksDB on local NVMe",
          instead: "Heap state, or an external store such as Redis holding the dedup set.",
          decider:
            "State size against per-event cost. 500k/s x 600s = 300M click_ids at 24B is 7.2GB across the fleet before window state and sketches, well past comfortable heap; an external set would add a round trip per event for a lookup the ad_id partitioning already made local.",
          flips:
            "Small key spaces that fit in heap, where RocksDB's serialisation cost on every state access is pure overhead.",
        },
      },
    },
    {
      id: "checkpoints",
      label: "Checkpoint store",
      sub: "S3, state + offsets atomic",
      kind: "blob",
      col: 0,
      row: 5,
      detail: {
        what: "Incremental snapshots of operator state written atomically together with the Kafka offsets that produced it, to object storage, with a cross-region replica.",
        why: "State and offsets must be written together or recovery is inconsistent: offsets ahead of state loses events, state ahead of offsets replays them. That atomicity is what lets the sink get away with no transaction, so this is a load-bearing part of the exactly-once claim rather than a backup.",
        numbers: ["incremental deltas only, not full snapshots", "two consecutive failures pages", "manual savepoint before any risky deploy"],
        breaks:
          "Repeated failures on a hot task mean each restart replays from further back, so the symptom is a growing catch-up burst rather than an error. It is also the only clean rollback point: without a savepoint, backing out a bad deploy means replaying from whatever checkpoint happened to land.",
        choice: {
          pick: "Incremental checkpoints to object storage, replicated cross-region",
          instead: "Full snapshots, or checkpoints kept on local disk beside the state.",
          decider:
            "Snapshot size against checkpoint interval. Full snapshots of multi-gigabyte per-task state cannot complete often enough to keep restart replay short, and local checkpoints die with the node that held the state they were protecting. Deltas keep the interval short, which is what bounds how far a restart replays.",
          flips:
            "Small state where a full snapshot is fast enough and incremental checkpointing's compaction and file-count overhead is not worth managing.",
        },
      },
    },

    // --- fraud branch -------------------------------------------------------
    {
      id: "fraud",
      label: "Fraud scoring consumer",
      sub: "async layers 2-4, flags not blocks",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "A parallel consumer group off the same topic running per-IP and per-device velocity limits, behavioural signals and a model score, then writing a verdict keyed by click_id. Layer one, the deterministic blocklists, is not here — it runs inline in the Click API.",
        why: "Fraud is flagged, not blocked, because the error costs are asymmetric: a false positive denies an advertiser a genuine customer they never learn about, while a false negative costs one click the recompute refunds. Blocking makes the expensive error the silent one. Reading the log again rather than chaining onto the aggregator also means a model rollback or a scoring backlog cannot stall window emission.",
        numbers: ["verdict within 1 to 5s of the click", ">10 clicks/min from one IP on one ad", "flagged but unrefunded is 1-3% of gross"],
        breaks:
          "Reported revenue is systematically overstated by the flagged-but-not-yet-refunded amount, so finance carries a reserve against it and the gross number on the dashboard is never the number that gets collected.",
        choice: {
          pick: "Async scoring off the same topic, verdict applied in the recompute",
          instead: "Blocking suspicious clicks at ingest so they never enter the aggregate.",
          decider:
            "Which error you can afford to make silently. Everything above the deterministic layer has a non-trivial false-positive rate, and a blocked genuine click is invisible to everyone, whereas a fraudulent click that is billed shows up as a 1-3% deduction the advertiser gets back at T+1.",
          flips:
            "Deterministic signals only, such as datacentre ASN ranges and known-bad user agents, whose false-positive rate is near zero and which therefore run inline in the Click API.",
        },
      },
    },
    {
      id: "fraud-flags",
      label: "fraud_flags store",
      sub: "(click_id, layer, score, verdict_ts)",
      kind: "database",
      col: 3,
      row: 1,
      detail: {
        what: "The durable verdict record: one row per flagged click carrying which layer fired, the reason, the score and when the verdict settled.",
        why: "The recompute joins verdicts that settled days after the click, so a verdict has to outlive both the window it belonged to and the scoring run that produced it. Held only in the scoring consumer, it is gone by the time the invoice is computed, and this is the second of the two things a replay of the raw log cannot express.",
        numbers: ["1-3% of gross flagged and later refunded", "verdict lands 1 to 5s after the click, joined at T+1", "retained across the 31-day dispute window"],
        breaks:
          "fraud_flag_rate has to be monitored per layer per advertiser rather than in aggregate: a model that drifts moves the deduction with no code change, and in the network total that looks exactly like a fraud wave.",
        choice: {
          pick: "Persist the verdict keyed by click_id",
          instead: "Re-score the day's clicks inside the recompute and keep no verdict store.",
          decider:
            "Reproducibility of an invoice. A re-score at T+1 runs today's model over yesterday's clicks, so the same day recomputed twice can produce two different fraud deductions and no dispute is answerable. Storing the verdict makes the deduction a dated fact rather than a function of whatever model is deployed when you ask.",
          flips:
            "Purely deterministic rules with no model, where the verdict is a pure function of the event and re-deriving it costs less than storing 1-3% of 10B events a day.",
        },
      },
    },

    // --- correction path ----------------------------------------------------
    {
      id: "archive",
      label: "S3 Parquet archive",
      sub: "immutable, partitioned by dt/hour",
      kind: "blob",
      col: 2,
      row: 2,
      parent: "corr-zone",
      detail: {
        what: "Every raw event written once as compressed columnar files partitioned by date and hour, immutable and retained for years.",
        why: "The aggregate is what changes, not the events: a fraud verdict settles, a rounding rule is corrected, an attribution window is redefined. Keeping events immutable and aggregates disposable makes each of those a recompute rather than a migration, and the archive has to outlive the log because the dispute window is a billing month while the log is sized at 7 days for replay.",
        numbers: ["5TB/day raw, ~5x ZSTD, 1TB/day stored", "365TB/year per copy", "reproducible for 7 years"],
        breaks:
          "It is only as good as what was written to it: an ingest-tier 503 never reaches the log and therefore never reaches here. A sink that silently falls behind or skips a partition is worse, because the gap is invisible until a recompute months later produces a total that is quietly low.",
        choice: {
          pick: "Parquet with ZSTD on object storage",
          instead: "Extending hot-log retention and treating replay as the only correction path.",
          decider:
            "A 31-day restatement window on the hot log is 5TB x 31 x RF=3 = 465TB, roughly $37k/month at $0.08/GB-month; the same span as columnar files is 31TB, roughly $700/month at $0.023/GB-month. Paying 50x on storage to avoid a second codebase is not a trade anyone makes.",
          flips:
            "Numbers that are never billed, where a single streaming path and a short retention are genuinely enough and the second implementation is pure cost.",
        },
      },
    },
    {
      id: "late-topic",
      label: "late-clicks side topic",
      sub: "beyond 5-min allowed lateness",
      kind: "queue",
      col: 2,
      row: 4,
      parent: "corr-zone",
      detail: {
        what: "The side output carrying events that arrive after their window's allowed lateness has expired, consumed by the recompute rather than dropped by the stream.",
        why: "Tiering lateness is what keeps window state bounded while still giving the long tail somewhere to land. Holding every window open for the mobile p99.9 would be absurd, and dropping the tail is not an option when each event is a billable click.",
        numbers: ["~180M events/day arrive >60s late", "mobile p99.9 = 22 min", "0.002% of events land past 7 days"],
        breaks:
          "The recompute cannot post to a closed billing period, so events older than 7 days are discarded. That is a silent discard of billable money, and the honest claim is 'nothing is dropped inside 7 days' rather than the stronger version advertisers are told.",
        choice: {
          pick: "Side-output topic feeding the batch recompute",
          instead: "Extending allowed lateness far enough to absorb the whole tail in the stream.",
          decider:
            "Allowed lateness holds every window open for its full duration, so covering the mobile p99.9 of 22 minutes instead of 5 multiplies open-window state roughly 4x to catch events that the T+1 recompute corrects anyway.",
          flips:
            "When there is no batch path at all, in which case allowed lateness is the only correction mechanism you have and it has to cover the measured tail.",
        },
      },
    },
    {
      id: "spark",
      label: "Nightly recompute",
      sub: "Spark, exact dedup, run_id 2",
      kind: "service",
      col: 3,
      row: 6,
      parent: "corr-zone",
      detail: {
        what: "A Spark job over three inputs — the day's archive, the previous day's tail and the late topic — that deduplicates the whole day exactly, joins settled fraud verdicts, and emits an absolute value for every key it touches. Hourly passes write run_id 1 for freshness; the full-day pass after midnight writes run_id 2, which is the run billing reads.",
        why: "It exists to restate history, not to be faster. Replay cannot express the two things it does: an exact whole-day dedup rather than a bounded 10-minute one, and a join against verdicts that settled days after the click. It is authoritative by declaration rather than by construction, which is a real weakness and the reason the drift monitor exists.",
        numbers: ["5TB of input per full-day pass", "T+1, within 0.01%", "recomputes a whole day, not a delta"],
        breaks:
          "It OOMs on 5TB of input and misses the T+1 SLA, and the whole-day exact dedup is the large shuffle that goes first. The answer is repartitioning by date and ad prefix and merging incremental hourly passes, not a bigger cluster. It also checks billing_period state before writing, or someone eventually fixes a bug and changes last quarter's revenue.",
        choice: {
          pick: "A second batch implementation over the immutable archive",
          instead: "Stream-only, with every correction expressed as a replay through a new version of the same job.",
          decider:
            "How far back you must restate against what that retention costs: disputes and tax restatements reach a full billing month, which is 465TB of replicated hot log against 31TB of columnar files. The recompute also does work replay cannot, and the honest price is two codebases whose 0.3% disagreements you now investigate forever.",
          flips:
            "Advisory numbers, or a tiered log where old segments already live on object storage and every correction genuinely is the same code over the same events.",
        },
      },
    },
    {
      id: "billing",
      label: "Billing system",
      sub: "T+1 invoicing, reads run_id 2 only",
      kind: "service",
      col: 3,
      row: 7,
      parent: "corr-zone",
      detail: {
        what: "The invoicing system, which reads recomputed rows only and never the streaming ones, and which owns the billing_period state the recompute checks before writing.",
        why: "The stream is provisional by design and an invoice cannot be. Drawing the arrow into billing from the batch branch alone is the entire point of the split: the number someone can dispute has to be the one computed from the immutable archive.",
        numbers: ["T+1 invoicing", "$0.50 blended cost per click", "~$700M/day of gross ad revenue"],
        breaks:
          "A recompute that lands after the invoice ships must not rewrite a billed total. It checks billing_period state, posts an adjustment against an open period and issues a credit memo, or historical revenue changes with no accounting entry behind it.",
        choice: {
          pick: "Invoice from run_id 2, with closed periods frozen",
          instead: "Invoice from the streaming rows and true up the difference nightly.",
          decider:
            "The streaming number carries a 0.2% duplicate rate plus the lateness tail, so it can sit 3% off on the freshest minute. Billing off it turns every one of those into a credit memo instead of a number that was right the first time, and a changed historical total is an accounting event, not a data update.",
          flips:
            "Prepaid or hard budget-capped products where the charge is explicitly provisional and reconciliation is expected as part of the product.",
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
      row: 7,
      detail: {
        what: "The served columnar store where both branches meet: one row per (ad_id, ts_minute) per run, holding count, HLL sketch, fraud_count, run_id and computed_at, with the read path taking the highest run_id per key.",
        why: "Taking max(run_id) makes the correction invisible to the reader — the same query returns the streaming number today and the recomputed one tomorrow with no client change. The streaming row is never deleted, because the difference between run 0 and run 2 is the drift metric and overwriting in place destroys the evidence.",
        numbers: ["1B minute-rows/day at 50B = 50GB/day", "12 q/s average, ~1k q/s peak", "agg_day 250MB/day, ~90GB a year"],
        breaks:
          "Merge backlog. When minute rows arrive faster than parts merge, parts_to_merge climbs and query latency degrades; the fix is pre-aggregating to a coarser grain before the write rather than scaling the store.",
        choice: {
          pick: "Columnar OLAP holding every run side by side",
          instead: "A KV store of counters, or one row per key overwritten in place by the latest run.",
          decider:
            "The read shape and the audit shape at once. ~1k q/s peak over 1B minute-rows/day is a range-scan problem rather than a point lookup, and keeping run 0 beside run 2 is what makes a dispute answerable at all; a store that overwrites in place saves 50GB/day and destroys the only evidence you have.",
          flips:
            "Pure point-lookup counters at very high write rates with no analytical queries and no audit requirement, where a KV store with its own idempotency keys is simpler to run.",
        },
      },
    },
    {
      id: "dashboards",
      label: "Advertiser dashboards",
      sub: "under 1 min freshness, published bands",
      kind: "client",
      col: 0,
      row: 8,
      detail: {
        what: "Roughly 1M advertisers reading their own ads out of agg_minute in a browser, plus top-N served from the daily rollup.",
        why: "Dashboards read the stream and not the recompute, because a number that is 3% low for one minute and within 0.5% an hour later is worth far more to someone optimising a campaign than a number that is exact 26 hours after the fact.",
        numbers: ["freshest closed minute within 3%", "older than 10 min within 0.5%", "5% of 1M advertisers open one daily"],
        breaks:
          "A stalled watermark flatlines the chart in a way indistinguishable from an ad receiving no clicks, and the advertiser reads it as the latter. Scheduled reports also cluster at the top of the hour at roughly 100x the mean, so the store behind this is sized for a burst that lasts seconds.",
        choice: {
          pick: "Serve streaming rows with accuracy bands published per freshness tier",
          instead: "Show only reconciled numbers, so every figure on screen is final.",
          decider:
            "T+1 rows are within 0.01% but 26 hours old; the streaming rows are within 3% on the freshest minute and 0.5% past 10 minutes. Hiding the fresh number to protect exactness costs an advertiser a day of pacing decisions to save them a 3% error they were told about.",
          flips:
            "When the only consumer is finance, where a provisional number on the same screen as an invoiced one is a liability rather than a feature.",
        },
      },
    },
    {
      id: "drift",
      label: "Drift monitor",
      sub: "run 0 vs run 2, per ad decile",
      kind: "service",
      col: 0,
      row: 9,
      detail: {
        what: "A job that diffs the streaming run against the recomputed run key by key and publishes the distribution of the difference rather than its total.",
        why: "Two implementations of one piece of arithmetic will drift, and this architecture detects drift rather than preventing it. Publishing the difference is what turns an advertiser saying 'your number is 0.3% low' from an escalation into a band somebody already agreed to.",
        numbers: ["target under 1% before reconciliation", "T+1 within 0.01%", "alerted per ad decile"],
        breaks:
          "Alerting on the network total hides two ads that are each 5% wrong in opposite directions, which is exactly the shape a real aggregation bug has. It also cannot see timing: a recompute reproduces which clicks counted and where, never how long anything took, so a latency regression is invisible to an output diff.",
        choice: {
          pick: "Diff the two runs and alert on the shape of the distribution",
          instead: "Generate both engines from a single definition so they cannot disagree.",
          decider:
            "One definition works for counts and sums and breaks on anything stateful, and 2 of our measures are: HLL distinct users and sessionised attribution. So the fork is what a 0.3% gap costs to investigate. Lateness-shaped drift is one-directional, batch higher, and concentrated in the last minutes of the day; a bug clusters on a dimension or goes both ways, and only the 10-decile distribution separates them.",
          flips:
            "Pipelines whose aggregates are genuinely stateless sums, where a shared definition removes the drift by construction and this job with it.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "click-api",
      label: "click_id stamped by client",
      detail: {
        what: "The click event itself: click_id, ad_id, user_id, event_ts, ip and user agent, retried with the same click_id on failure.",
        why: "The retry semantics of this one hop are the whole dedup story. Because the id is generated before the request and reused, a retry is recognisable rather than being a second click, which is what lets every later stage collapse it.",
        numbers: ["500B per event", "retry tail p99.9 = 8 min"],
        breaks:
          "A client clock can be wrong, so the ingest tier records its own receipt time alongside the claimed one and rejects anything more than 24 hours in the future.",
      },
    },
    {
      id: "e2",
      from: "click-api",
      to: "kafka",
      label: "append, key = ad_id",
      animated: true,
      detail: {
        what: "The validated click appended to the partition that owns its ad_id, acknowledged before the API returns 204.",
        why: "Nothing computes on a click until it is durable. Writing to the log first is what makes every downstream number recomputable, and it decouples ingest availability from the availability of any aggregation engine.",
        numbers: ["99.9% durably logged within 1s", "500k events/s peak"],
        breaks:
          "If the API acknowledges before the append is durable, a broker failure loses clicks that the client believes were delivered and will never retry.",
      },
    },
    {
      id: "e3",
      from: "kafka",
      to: "dedup",
      label: "keyBy ad_id, no shuffle",
      animated: true,
      detail: {
        what: "The hot path: every event streaming into the job's first operator, already partitioned by the key it will be grouped on.",
        why: "Because the log is keyed by ad_id, the consumer's grouping is free. No shuffle, no repartition, and both copies of a retried click reach the same task, which is what allows dedup to be a local state lookup rather than a distributed one.",
        numbers: ["115k events/s average, 500k peak", "parallelism 10 per the dedup budget"],
        breaks:
          "Adding partitions to scale rehashes keys and can move a hot ad onto an already-hot task, so partition count and stream parallelism have to be raised together and the distribution checked afterwards.",
      },
    },
    {
      id: "e4",
      from: "kafka",
      to: "fraud",
      label: "parallel consumer group",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A second consumer group reading the same events for velocity, behavioural and model-based fraud scoring.",
        why: "Fraud detection is off the critical path deliberately. Reading the log again rather than chaining onto the aggregator means a model rollback or a scoring backlog cannot stall window emission or click ingestion.",
        numbers: ["verdict lands 1 to 5s after the click"],
        breaks:
          "The two consumers can diverge in lag, so a verdict may arrive after the window it belongs to has already been emitted; that is precisely why the verdict is applied in the recompute rather than in the stream.",
      },
    },
    {
      id: "e5",
      from: "kafka",
      to: "archive",
      label: "raw events, Parquet",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A sink writing the raw events, unaggregated, to compressed columnar files partitioned by date and hour.",
        why: "This is the branch that makes the correction path possible at all. The archive has to outlive the log, because the dispute window is a billing month and the log is sized at 7 days for replay and recovery, not for restatement.",
        numbers: ["1TB/day after ~5x compression", "7-day log against 7-year archive"],
        breaks:
          "If this sink silently falls behind or skips a partition, the gap is invisible until a recompute months later produces a total that is quietly low.",
      },
    },
    {
      id: "e6",
      from: "fraud",
      to: "fraud-flags",
      label: "verdict keyed by click_id",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "One row per flagged click: which layer fired, the reason, the score and the settle time.",
        why: "The verdict has to become a dated fact rather than a transient signal, because the thing that consumes it runs a day later and a dispute about it can arrive a month later.",
        numbers: ["1-3% of gross flagged", "written 1 to 5s after the click"],
        breaks:
          "A backlog here delays verdicts past the nightly join, so those clicks stay billable for another day and the correction lands in the following period's adjustment rather than the invoice.",
      },
    },
    {
      id: "e7",
      from: "dedup",
      to: "window",
      label: "unseen click_ids only",
      animated: true,
      detail: {
        what: "The surviving events, one per click_id within the 10-minute TTL, handed to the windowing operator on the same task.",
        why: "Dropping repeats before windowing rather than after is what keeps the correction cheap: a duplicate that reaches the aggregate has to be subtracted out later, and the re-emission would have to be retracted downstream.",
        numbers: ["0.2% dropped as repeats", "in-process, no network hop"],
        breaks:
          "If the dedup TTL is shortened below the measured 8-minute retry tail, repeats start slipping through and the stream drifts high in a way that only shows up against the recompute a day later.",
      },
    },
    {
      id: "e8",
      from: "window",
      to: "sink",
      label: "closed window totals",
      animated: true,
      detail: {
        what: "The count and HLL sketch for a (ad_id, ts_minute) bucket, emitted when the watermark passes the window end and again on every in-lateness correction.",
        why: "The window emits a total rather than a delta, which is the property the sink depends on. Corrections travel as a new total for the same key, so nothing downstream needs to understand retraction.",
        numbers: ["~1B emissions/day", "re-emits inside 5 minutes of lateness"],
        breaks:
          "A re-emission that arrives out of order with the original would overwrite a corrected value with a stale one; ordering per key is preserved because both come from the same task, and losing that ordering is what sub-keying a hot ad risks.",
      },
    },
    {
      id: "e9",
      from: "window",
      to: "rocksdb",
      label: "window + dedup state",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Open window aggregates, HLL sketches and the dedup operator's TTL'd click_id sets, all held in the one keyed state backend the chained operators share.",
        why: "Sharing one backend is what makes dedup and windowing a single recoverable unit. Two state stores would mean two recovery points, and a restart could restore a window whose dedup set had already forgotten the ids that fed it.",
        numbers: ["<1GB per task at parallelism 10", "7.2GB of dedup entries fleet-wide"],
        breaks:
          "Uncontrolled growth is the failure here, not corruption: without the 10-minute TTL on dedup entries the set grows without bound and the task OOMs long before the window state does.",
      },
    },
    {
      id: "e10",
      from: "rocksdb",
      to: "checkpoints",
      label: "incremental, with offsets",
      dashed: true,
      detail: {
        what: "Changed RocksDB files plus the Kafka offsets that produced them, written as one atomic checkpoint to object storage.",
        why: "State and offsets must land together or recovery is inconsistent: offsets ahead of state loses events, state ahead of offsets replays them. Atomicity here is exactly what makes the absolute-write sink sufficient for exactly-once.",
        numbers: ["deltas only, not full snapshots", "two consecutive failures pages"],
        breaks:
          "Checkpoints failing repeatedly means each restart replays from further back, so the operational symptom is a growing catch-up burst rather than an obvious storage error.",
      },
    },
    {
      id: "e11",
      from: "window",
      to: "late-topic",
      label: "past 5-min lateness",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Events whose event time falls outside their window's allowed lateness, routed to a side output instead of being discarded.",
        why: "Dropping them is theft in one direction, and holding every window open long enough to catch a 22-minute mobile tail is unaffordable state. The side output is what lets the stream stay bounded while the tail is still counted somewhere.",
        numbers: ["5 minutes allowed lateness", "~180M events/day land >60s late"],
        breaks:
          "The rate and age distribution on this topic is a monitored signal: a spike means either a client regression or a stalled watermark, and the two need opposite responses.",
      },
    },
    {
      id: "e12",
      from: "sink",
      to: "clickhouse",
      label: "absolute upsert, run_id 0",
      animated: true,
      fromSide: "left",
      toSide: "top",
      detail: {
        what: "Each closed window written as an absolute value under (ad_id, ts_minute, run_id 0), including re-emissions when a late event reopens the window.",
        why: "Writing the total rather than a delta is the difference between exactly-once and nearly-once. A replay after a checkpoint restore writes the same value twice and changes nothing, so the sink needs no transaction and a re-emitted correction needs no retraction protocol.",
        numbers: ["~1B minute-rows/day", "dashboard sees the click within about a minute"],
        breaks:
          "Insert rate is the constraint, not correctness: minute rows arriving faster than parts merge back up the store's merge queue, and the fix is a coarser write grain rather than a bigger cluster.",
      },
    },
    {
      id: "e13",
      from: "clickhouse",
      to: "dashboards",
      label: "agg_minute reads",
      animated: true,
      detail: {
        what: "Advertiser dashboard queries against the highest run_id per key, plus top-N served from the daily rollup.",
        why: "The read path taking max(run_id) is what makes the correction invisible to the reader: the same query returns the streaming number today and the recomputed one tomorrow with no client change.",
        numbers: ["12 q/s average, ~1k q/s peak at the top of the hour"],
        breaks:
          "Scheduled reports cluster at the top of the hour at roughly 100x the mean, so the store is sized for a burst that lasts seconds and idles the rest of the time.",
      },
    },
    {
      id: "e14",
      from: "clickhouse",
      to: "drift",
      label: "run 0 vs run 2",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 60,
      detail: {
        what: "A key-by-key diff of the streaming rows against the recomputed rows for the same day, read out of the same table.",
        why: "The streaming row is deliberately never deleted, so this diff has something to compare against. Overwriting in place would destroy the only evidence available when an advertiser disputes a number.",
        numbers: ["target under 1% before reconciliation", "distribution per ad decile"],
        breaks:
          "Lateness-shaped drift and a genuine bug look identical in the total, so this read has to be per key: a bug clusters on a dimension or points both ways, while lateness is one-directional with batch higher.",
      },
    },
    {
      id: "e15",
      from: "archive",
      to: "spark",
      label: "whole day, exact dedup",
      fromSide: "right",
      toSide: "top",
      detail: {
        what: "The full day of raw Parquet re-read from scratch so the aggregation is recomputed rather than adjusted.",
        why: "Recomputing from raw is what makes a three-week-old aggregation bug fixable: the corrected logic runs over the same immutable input and produces a new run, so nothing has to be patched or reversed in place.",
        numbers: ["5TB of input per full-day pass", "dedup over the whole day, not a 10-minute window"],
        breaks:
          "A whole-day exact dedup is a large shuffle, and it is the step that OOMs first when a day's volume grows faster than the cluster.",
      },
    },
    {
      id: "e16",
      from: "late-topic",
      to: "spark",
      label: "late tail",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The very-late events consumed as one of the recompute's three inputs, alongside the day's archive and the previous day's tail.",
        why: "This is where the events the stream could not place finally get counted into the right minute, which is the reason the side output exists rather than a dead-letter queue nobody reads.",
        numbers: ["consumed by the full-day pass after midnight"],
        breaks:
          "Anything on this topic older than 7 days is discarded, because the recompute cannot post into a closed billing period, and that discard is silent.",
      },
    },
    {
      id: "e17",
      from: "fraud-flags",
      to: "spark",
      label: "settled verdicts",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 80,
      detail: {
        what: "Fraud verdicts joined into the recompute by click_id so flagged clicks are removed from billable totals.",
        why: "Verdicts settle after the click, sometimes days after, which is work a replay of the original event stream cannot express. It is one of the two reasons the batch path is not just a slower copy of the stream.",
        numbers: ["1-3% of gross flagged and refunded"],
        breaks:
          "A model that drifts moves this deduction without anyone changing code, which is why fraud_flag_rate is monitored per layer per advertiser rather than in aggregate.",
      },
    },
    {
      id: "e18",
      from: "spark",
      to: "clickhouse",
      label: "overwrite, run_id 2",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Absolute values written under a higher run_id for every key the recompute touched, leaving the streaming rows in place.",
        why: "Writing a new run rather than mutating the old one keeps the read path simple (take max run_id), makes the recompute itself replayable, and preserves the difference that the drift monitor and any dispute both depend on.",
        numbers: ["hourly pass run_id 1, full day run_id 2"],
        breaks:
          "If the recompute wrote in place, a bug in the batch job would destroy the streaming evidence it is supposed to be checked against, and there would be nothing left to diff.",
      },
    },
    {
      id: "e19",
      from: "spark",
      to: "billing",
      label: "billable totals, T+1",
      detail: {
        what: "The recomputed, deduplicated, fraud-adjusted totals handed to invoicing, which reads nothing else.",
        why: "This is the arrow that justifies the whole right-hand branch. Billing reads one source, and that source is the one derived from immutable events, so any invoice can be reproduced from raw data years later.",
        numbers: ["T+1 within 0.01%", "$0.50 blended per click"],
        breaks:
          "Once this fires for a period, the period is closed. A later correction has to arrive as an adjustment plus a credit memo against an open period, not as a rewrite of a number that has already been invoiced.",
      },
    },
  ],
};
