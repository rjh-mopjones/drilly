import type { Diagram } from "./types";

export const PRICE_ALERTS: Diagram = {
  id: "price-alerts",
  title: "Price Alerts",
  question: "Design a Stock Price Notification System",
  sourceId: "patterns",
  itemId: 41,
  overview: {
    shape:
      "A predicate matching engine wearing a notification costume: ticks are routed by instrument into a stateful evaluator that already holds that instrument's rules sorted along the price axis, so a price move is a range query rather than a scan.",
    beats: [
      "The whole design is one inversion. The naive loop iterates rules and looks up prices, which costs one lookup per rule per poll and puts a hard floor under latency at the poll interval: 10M rules polled every minute is 167k price lookups a second and a 60-second worst case. Iterate ticks instead and look up rules.",
      "That inversion only pays if the lookup is local, so ticks and rule changes are co-partitioned on the same instrument_id key. A rule is about 500 bytes loaded, 10M rules is roughly 5GB, and across sixteen evaluator shards that is 310MB each, which fits in RAM alongside the window buffers. Co-partitioning is what makes the per-tick lookup a memory access rather than a network hop.",
      "Inside a shard the rules with a fixed numeric trigger live in a skip list sorted by trigger price, so a tick moving AAPL from 199.95 to 200.05 range-scans only the rules whose threshold lies in that sliver. That is O(log N + matched) instead of O(rules on the instrument), and it is the only thing standing between you and 100M comparisons a second when 500k rules sit on one name.",
      "Correctness is two details that cost nothing and are missed constantly. Fire on the crossing, not the level: prev < 200 <= now, so a rule fires once at the boundary and still fires when a gap open jumps clean over it. And guard the gap: after a checkpoint restore prev may be ten minutes stale, so treat the first tick after a gap as a reseed rather than one enormous move that fires every rule between the two prices.",
      "Delivery is deliberately not designed here. The pipeline is at-least-once and the dispatcher absorbs duplicates on {alert_id, arm_epoch}, where the epoch advances only on a genuine re-arm, so a replayed tick produces a fired event the dispatcher recognises and drops. Past that it hands off to the existing notification service, because 10M rules produce roughly 17 notifications a second in normal markets.",
    ],
    crux:
      "The partitioning that makes evaluation cheap also makes an instrument unsplittable. NVDA at earnings is 500k rules and 1,000 ticks a second on one process that cannot be spread, so the threshold index has to turn that scan into a range query before you resort to sub-sharding and give up the one-owner-per-instrument invariant.",
    numbers: [
      "10M rules x 500B = 5GB across 16 shards, 310MB each",
      "500k rules on the hottest instrument, 100M compares/s flat",
      "250k ticks/s sustained, 1M/s peak; ~17 fires/s, 10k/s burst",
    ],
  },
  nodes: [
    {
      id: "shard",
      label: "Evaluator shard",
      kind: "zone",
      detail: {
        what: "One stateful process owning a fixed set of instruments: their last prices, their threshold index and their window buffers, all in local memory.",
        why: "Everything upstream exists to put the right rules in the same process as the right ticks. Once that holds, evaluating a tick is a memory operation with no network call on the hot path, which is the only way 250k ticks/s is affordable.",
        numbers: ["16 shards, ~310MB of rule state each", "10-minute checkpoints, RTO under 90s"],
        breaks:
          "An instrument is the unit of ownership, so it cannot be split. One name with 500k rules and an earnings print needs five cores the partitioning model will not give it.",
        choice: {
          pick: "Co-partition rules and ticks on instrument_id, evaluate against local state",
          instead: "Stateless evaluators querying a shared low-latency store such as Redis or Aerospike per tick.",
          decider:
            "Total rule footprint against fleet RAM, and the per-tick latency budget. 10M rules at 500B is 5GB and fits in 16 shards; a shared store adds ~0.3ms per lookup, and 250k ticks/s of blocking lookups is 75 core-seconds of wait per wall second.",
          flips:
            "Rules outgrow RAM, roughly past 100M rules or 50GB, or rule churn is high enough that a 1s change-stream lag becomes a correctness problem for clients arming and disarming programmatically.",
        },
      },
    },
    {
      id: "exchanges",
      label: "Exchanges and vendors",
      sub: "two feeds, exchange_seq numbers",
      kind: "external",
      col: 1,
      row: 0,
      detail: {
        what: "The primary and secondary market-data vendors. The only part of this diagram nobody here operates.",
        why: "It is drawn because it sets the constraints the rest answers to: feeds disconnect, replay stale ticks, and disagree with each other on price for the same exchange sequence number.",
        numbers: ["50k tickable instruments", "~250k ticks/s sustained, ~1M/s in the first 60s after a US open"],
        breaks:
          "A vendor flickering a wrong price for one or two ticks fires phantom crossings, and a dispatched alert cannot be silently retracted.",
      },
    },
    {
      id: "gateway",
      label: "Market data gateway",
      sub: "dedupe on seq, binary encode, stamp ts",
      kind: "service",
      col: 0,
      row: 0,
      detail: {
        what: "Receives raw vendor feeds, deduplicates on (instrument_id, exchange_seq_no), normalises to one compact binary tick, stamps ingest time and publishes.",
        why: "Two vendors carry the same trade, so dedup has to happen before anything downstream counts it as a price move. The gateway is also the reliability boundary: it reconnects, pulls a snapshot, and marks the gap so the evaluator knows not to trust a jump across it.",
        numbers: ["~150B per tick serialised", "JSON is 3 to 4x larger, so 100 wasted bytes is 25MB/s at 250k ticks/s"],
        breaks:
          "A feed disconnect that is not marked as a gap looks downstream like a single enormous price move, which fires every rule between the two prices at once.",
        choice: {
          pick: "Dedupe on the exchange's own sequence number, one vendor primary for evaluation",
          instead: "Take whichever vendor's tick arrives first, or merge both by timestamp.",
          decider:
            "Vendor clocks disagree by milliseconds and the exchange sequence number does not. When they diverge on price by more than 0.5% beyond the known spread, suppress crossing fires until they reconverge; delaying an alert beats claiming a crossing that did not happen.",
          flips:
            "A single-vendor feed, or crypto venues with no shared sequence space, where dedup has to fall back to (instrument, price, timestamp) windows.",
        },
      },
    },
    {
      id: "tick-log",
      label: "Partitioned tick log",
      sub: "Kafka, key = instrument_id, 24h",
      kind: "queue",
      col: 0,
      row: 1,
      detail: {
        what: "A durable append-only stream keyed by instrument, so every tick for an instrument lands on one partition and therefore one evaluator.",
        why: "The partition key is the whole design decision made physical. It is also the replay surface: a crashed evaluator resumes from its checkpoint offset instead of losing market data, and compliance gets a same-day replay.",
        numbers: ["8.4B ticks/day, ~1.3TB logical", "~3.8TB/day at replication factor 3", "24h hot retention"],
        breaks:
          "Partition skew. One hot name pins a single partition, so that evaluator falls behind while the rest idle, and no amount of extra fleet helps.",
        choice: {
          pick: "Kafka partitioned by instrument_id, 24h retention",
          instead: "A work queue such as SQS with no ordering or replay, or direct RPC from the gateway to evaluators.",
          decider:
            "Whether an evaluator can rebuild after a crash. Cold start from Postgres alone takes minutes for 10M rules; checkpoint plus a delta replay off a 24h log brings RTO under 90 seconds. A queue gives you nothing to replay from once consumed.",
          flips:
            "Sub-second retention needs and no audit obligation, where a plain pub/sub bus is cheaper than 3.8TB/day of replicated SSD.",
        },
      },
    },
    {
      id: "evaluator",
      label: "Rule evaluator",
      sub: "Flink + RocksDB, last_price, gap guard",
      kind: "service",
      col: 0,
      row: 2,
      parent: "shard",
      detail: {
        what: "The stateful stream processor. Per instrument it holds last_price with its timestamp, updates it on every tick, and decides which of the two matchers below runs.",
        why: "This is where a level test becomes a crossing test. The comparison is prev < value <= now on the interval between two consecutive ticks, which fires exactly once at the boundary and still fires when a gap open skips the price level entirely.",
        numbers: ["~15k ticks/s per shard at 250k/s over 16", "tick-to-fire SLO p99 under 1s"],
        breaks:
          "A stale prev after a checkpoint restore. Without the gap guard the first tick back looks like one huge move and fires every rule between the two prices simultaneously.",
        choice: {
          pick: "Crossing test on the interval, with a gap guard that reseeds instead of firing",
          instead: "A level test, price >= value, evaluated per tick.",
          decider:
            "A level test refires on every subsequent tick above the threshold, so one crossing of $200 becomes an alert per tick for the rest of the session. It is the single most common wrong answer in this question and it costs one comparison to fix.",
          flips:
            "Never for user-facing alerts. A level test is only correct when the consumer is itself idempotent and wants current state rather than an event.",
        },
      },
    },
    {
      id: "threshold-idx",
      label: "Threshold index",
      sub: "skip list per instrument, sorted by price",
      kind: "database",
      col: 0,
      row: 3,
      parent: "shard",
      detail: {
        what: "Per instrument, the fixed-trigger rules held in a skip list ordered by trigger price. A tick range-scans [min(prev, now), max(prev, now)] and touches nothing else.",
        why: "This is the component the question exists to ask about. It converts 'scan every rule on NVDA' into 'read the rules sitting in this 0.01% sliver', which is single digits on an ordinary tick and only the crossed band on an 8% earnings jump.",
        numbers: ["O(log N + matched) per tick", "200 rules per instrument average, 500k on the hottest", "crossover versus a flat scan around 10k rules on one name"],
        breaks:
          "It only covers rules with a fixed point on the price axis, and it has to be maintained on every create, delete and re-arm while ticks are being evaluated against it.",
        choice: {
          pick: "A sorted structure per instrument, range-scanned on each tick",
          instead: "A flat list of the instrument's rules, scanned in full per tick.",
          decider:
            "The hottest single instrument. At 200 rules a flat scan is ~0.4us per tick and free; at 500k rules and 200 ticks/s it is 100M compares/s, a fully saturated core, and five cores during the 1,000 ticks/s of an earnings print.",
          flips:
            "No instrument accumulates more than a few thousand rules, or the mix is dominated by windowed rules the index cannot hold anyway, where you pay maintenance cost for a minority of the work.",
        },
      },
    },
    {
      id: "windowed",
      label: "Windowed rule scan",
      sub: "ring buffer of (ts, price), full scan",
      kind: "service",
      col: 0,
      row: 4,
      detail: {
        what: "Percent-change and volume-spike rules, scanned in full on every tick against one ring buffer of (ts, price) per instrument sized to the longest active window on it.",
        why: "'BTC drops 5% in 1h' has a trigger price that moves every second as the reference window rolls, so it has no fixed point on the price axis to sort by. One shared buffer per instrument rather than one per rule is what keeps the memory bounded.",
        numbers: ["one buffer per instrument, not per rule", "1-second OHLC bars for windows over 5 minutes"],
        breaks:
          "These are the real ceiling on a hot name. They escape the index entirely, so on an instrument with hundreds of thousands of them the threshold index makes the contrast worse rather than better.",
        choice: {
          pick: "One shared ring buffer per instrument, full scan of windowed rules",
          instead: "A per-rule window buffer, or recomputing each rule's implied trigger price into the sorted index once a second.",
          decider:
            "Memory against staleness. Per-rule buffers multiply by the rules on the instrument, up to 500k on one name. Folding windowed rules into the index would fix the scan but accepts a trigger price up to a second stale, and that error bound against volatility is the part nobody has pinned down.",
          flips:
            "When windowed rules dominate the mix on a hot instrument, at which point the second-stale index is worth the staleness because a full scan will not keep up at all.",
        },
      },
    },
    {
      id: "rule-store",
      label: "Alerts store",
      sub: "Postgres, source of truth, quotas",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "The transactional record of every rule: (alert_id, user_id, instrument_id, rule_type, rule_value, window_sec, state, arm_epoch, cooldown_sec, last_fired_at), indexed on user_id and on (instrument_id, state).",
        why: "The evaluator's copy is derived state that a crash can throw away, so something has to be authoritative for what the user asked for. The (instrument_id, state) index is what makes a cold bulk load by shard possible at all.",
        numbers: ["10M active rules, ~4M users at ~2.5 each", "quota: free tier 50, hard limit 500, plus a per-instrument cap"],
        breaks:
          "Rule abuse. A script parking thousands of alerts across every instrument defeats a per-instrument cap, so creation itself has to be rate-limited and anomalous fan-out flagged against the user's cohort.",
        choice: {
          pick: "Postgres as the single source of truth for rule CRUD",
          instead: "Treating the evaluator's local state as authoritative, with periodic snapshots.",
          decider:
            "10M rules is small for a relational store and rule CRUD is low rate, while a broker needs the rule snapshot as it stood at fire time for a 7-year audit. Derived state cannot answer a regulator.",
          flips:
            "Past roughly 100M rules, where the single-writer store becomes the bottleneck and rules move to a sharded store keyed the same way as the evaluators.",
        },
      },
    },
    {
      id: "rule-cdc",
      label: "Rule change stream",
      sub: "Debezium, co-partitioned by instrument",
      kind: "queue",
      col: 1,
      row: 2,
      detail: {
        what: "A change-data-capture topic carrying rule creates, deletes and re-arms, keyed by the same instrument_id as the tick log.",
        why: "Co-partitioning is the whole trick: a new AAPL alert has to land on the shard that already consumes AAPL ticks, or the evaluator would need a lookup it does not have. Same key, same partition, no coordination.",
        numbers: ["typically under 1s from commit to loaded on the shard", "alert CRUD held 'pending activation' until the shard confirms"],
        breaks:
          "Silent lag. If the change topic stalls, alert creation still returns 200 and the rule simply never fires, which no queue-depth alert on the tick path will show you.",
        choice: {
          pick: "CDC off the transactional store onto a co-partitioned topic",
          instead: "Dual-writing to Postgres and to the evaluator, or having the API call the owning shard directly.",
          decider:
            "A dual write has no transaction spanning both, so a crash between them leaves a rule that exists to the user and not to the evaluator. CDC is derived from the commit, so the ~1s lag is bounded and observable rather than a silent divergence.",
          flips:
            "Institutional clients arming and disarming rules programmatically inside a second, where the change-stream lag becomes a correctness problem and rules move to a shared store read on the tick path.",
        },
      },
    },
    {
      id: "fired-stream",
      label: "Fired-alerts stream",
      sub: "alerts.fired, at-least-once",
      kind: "queue",
      col: 0,
      row: 5,
      detail: {
        what: "The event emitted on a confirmed crossing: {alert_id, arm_epoch, user_id, instrument_id, triggered_at, trigger_price, exchange_seq_no, rule_snapshot}.",
        why: "It decouples evaluation from delivery so a provider outage cannot apply back pressure to the tick path. The arm_epoch rides on the event because that is what lets the dispatcher tell a replay from a genuine second crossing.",
        numbers: ["~17 fires/s average across the 8h window", "10k fires/s burst when an index drops 3% in ten seconds"],
        breaks:
          "The burst is 600x the average, so anything sized on the average collapses on exactly the market move users care most about.",
        choice: {
          pick: "At-least-once delivery with duplicates absorbed downstream",
          instead: "Transactional exactly-once from ingest through the stream processor to the sink.",
          decider:
            "The last hop. Push and email providers are plain HTTP with no transaction to enlist in, so the pipeline can be exactly-once and the user still gets two pushes, while transactional commits push checkpoint latency into the hundreds of milliseconds against a 5s budget.",
          flips:
            "When a fire triggers something non-idempotent such as a conditional order, at which point it is not a notification and belongs on the order path with its own guarantees.",
        },
      },
    },
    {
      id: "dispatcher",
      label: "Alert dispatcher",
      sub: "dedupe, prefs, quiet hours, state",
      kind: "service",
      col: 0,
      row: 6,
      detail: {
        what: "Consumes fired events, checks the idempotency key, applies user preferences and quiet hours, writes the audit record, moves the rule to FIRED or COOLDOWN, then hands off to the notification service.",
        why: "It is the seam between a market-data decision and a user-facing action. Everything that depends on the person rather than the price belongs here, which is why market hours are applied upstream by instrument and quiet hours are applied down here by user.",
        numbers: ["one Redis GET per fire, 17/s average", "hysteresis default 0.5% on equities, 1% on crypto"],
        breaks:
          "Thundering herd. 100k rules tripping in ten seconds forces per-channel rate limiting and smearing, which makes some users later than others on a move where seconds matter.",
        choice: {
          pick: "Dedupe at the dispatcher on {alert_id, arm_epoch}, with hysteresis and a dwell gate on re-arm",
          instead: "Relying on the evaluator's local FIRED flag alone.",
          decider:
            "The 10-minute checkpoint interval. Restore a checkpoint taken before the fire, replay up to 10 minutes of tick log, and the same fire is emitted with the rule back in ARMED, so the local flag protects nothing across exactly the failure it is meant to cover. The epoch only advances on a genuine re-arm, so two real fires still produce two distinct keys.",
          flips:
            "If the dedupe store is unavailable, fall back to a per-pod in-memory LRU sized wider than the checkpoint interval and accept higher duplicate risk rather than double-paging users.",
        },
      },
    },
    {
      id: "idem",
      label: "Idempotency cache",
      sub: "Redis, idem:{alert_id}:{arm_epoch}",
      kind: "database",
      col: 1,
      row: 6,
      detail: {
        what: "A short-TTL key-value store holding one key per specific arming of a specific rule, checked before the notification service is called.",
        why: "At-least-once through the pipeline means a replayed tick will re-emit a fire. This is the one place that difference gets collapsed, and it is cheap enough to sit on every fire.",
        numbers: ["TTL 1h", "17 GETs/s average, 10k/s at burst"],
        breaks:
          "If it is down, the choice is fail closed on push and email while still writing the in-app record, or accept duplicate sends. Failing closed and replaying afterwards is the right way round for a broker.",
        choice: {
          pick: "Redis with a 1h TTL keyed on {alert_id, arm_epoch}",
          instead: "A uniqueness constraint in the transactional store, or no dedupe at all.",
          decider:
            "The key is worthless an hour after the fire and is read on every dispatch, including a 10k/s burst. That is cache-shaped state; a durable unique index buys persistence nobody needs and adds a write to the fire path.",
          flips:
            "When the audit obligation extends to proving no duplicate was ever sent, where the suppression record itself becomes evidence and belongs in the durable audit rather than a cache.",
        },
      },
    },
    {
      id: "notify",
      label: "Notification service",
      sub: "reused, see Q7 for fan-out",
      kind: "service",
      col: 0,
      row: 7,
      detail: {
        what: "The existing per-channel delivery tier: push, email and SMS lanes with their own worker pools, retries and provider rate limits. Designed in question 7, consumed here.",
        why: "Ten million rules produce roughly 17 notifications a second in normal markets, which is an order of magnitude under what a general notification system is already built for. Redesigning it here is the classic way to answer the wrong question.",
        numbers: ["~17 sends/s average, 10k/s burst", "end-to-end SLO p99 under 5s, tick to provider acceptance"],
        breaks:
          "A provider outage delays delivery after evaluation was already correct, so the audit record has to be pinned to trigger time rather than delivery time, and the alert surfaced in-app immediately.",
        choice: {
          pick: "Reuse the existing notification system as a dependency",
          instead: "Build a delivery tier specific to price alerts.",
          decider:
            "Volume and novelty. 17 sends/s average is nothing, and nothing about a price alert makes its push token, retry policy or quiet-hours logic different from any other notification. The only price-specific requirement, dedupe on arm_epoch, is already handled one component upstream.",
          flips:
            "If alerts need a delivery guarantee the shared tier does not offer, such as a hard latency ceiling during the 10k/s burst that would otherwise be smeared alongside marketing sends.",
        },
      },
    },
    {
      id: "audit",
      label: "Fired-alert audit",
      sub: "columnar archive, 7 years",
      kind: "database",
      col: 1,
      row: 7,
      detail: {
        what: "An append-only record per fire: (alert_id, user_id, instrument_id, trigger_price, rule_snapshot, exchange_seq_no, triggered_at, delivered_at), partitioned by date.",
        why: "A regulator asks whether an alert correctly fired or correctly did not. The exchange sequence number lets them cross-reference the exchange's own feed, and the rule snapshot proves what the rule said then rather than what it says now.",
        numbers: ["MiFID II retention 7 years", "ticks compress ~8x columnar: ~160GB/day, ~410TB over 7 years"],
        breaks:
          "A failed archive write is a regulatory evidence gap, so fires buffer to a durable stream first and retention deletion is blocked until the sink has caught up.",
        choice: {
          pick: "Columnar files on object storage, dictionary and delta encoded, glacial after 90 days",
          instead: "Keeping fires in the transactional store, or in the hot tick log.",
          decider:
            "1.3TB/day of ticks logical and 7 years of retention. Dictionary encoding on instrument_id and delta encoding on price and timestamp gives roughly 8x, taking 410TB down to a number you can actually pay for.",
          flips:
            "No regulatory obligation, where 90 days in the operational store is enough for support tickets and the whole archive tier disappears.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "exchanges",
      to: "gateway",
      label: "two vendor feeds",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Raw market data arriving from the primary and secondary vendors, each carrying the exchange's own sequence number.",
        why: "Two feeds exist so a disconnect on one does not blind the system, and so a wrong price on one can be caught by comparison rather than believed. The cost is that everything after this point has to reconcile them.",
        numbers: ["~250k ticks/s sustained, ~1M/s peak"],
        breaks:
          "When the two diverge on price beyond 0.5% past the known spread, ticks are marked unreliable and crossing fires are suppressed until they reconverge.",
      },
    },
    {
      id: "e2",
      from: "gateway",
      to: "tick-log",
      label: "150B binary ticks",
      animated: true,
      detail: {
        what: "Normalised, deduplicated ticks published onto the durable log with an ingest timestamp attached.",
        why: "Encoding matters at this rate rather than being a micro-optimisation: JSON is 3 to 4 times larger, and 100 wasted bytes per tick is 25MB/s of pure overhead at 250k ticks/s.",
        numbers: ["~150B serialised", "8.4B ticks/day, ~1.3TB logical"],
        breaks:
          "If the gateway publishes across a feed gap without marking it, the evaluator computes a crossing over an interval that never really happened.",
      },
    },
    {
      id: "e3",
      from: "tick-log",
      to: "evaluator",
      label: "partition = instrument_id",
      animated: true,
      detail: {
        what: "Each evaluator consumes the partitions for the instruments it owns, so every AAPL tick reaches the process that already holds AAPL's rules.",
        why: "This is the arrow the entire design is built around. It is what makes rule lookup a local memory access instead of a network call, and it is also what makes a hot instrument unsplittable.",
        numbers: ["~15k ticks/s per shard across 16 shards"],
        breaks:
          "Consumer lag on one partition is the earliest hot-key signal, and it is a hard alert above a few seconds during market hours.",
      },
    },
    {
      id: "e4",
      from: "evaluator",
      to: "threshold-idx",
      label: "range-scan [prev, now]",
      animated: true,
      detail: {
        what: "The range query over rules whose trigger price lies between the previous tick and this one, followed by the half-open crossing test on each match.",
        why: "The bound on this operation is the bound on the whole system. Scanning the interval rather than the instrument is what makes an 8% jump touch only the rules in that band instead of all 500k on the name.",
        numbers: ["O(log N + matched)", "single-digit matches on an ordinary 0.01% move"],
        breaks:
          "A rule created or re-armed mid-scan mutates the structure while ticks are being evaluated against it, which is why the choice between skip list and balanced tree is about concurrent update cost rather than asymptotics.",
      },
    },
    {
      id: "e5",
      from: "evaluator",
      to: "windowed",
      label: "full scan, no index",
      fromSide: "right",
      toSide: "right",
      offset: 60,
      detail: {
        what: "The same tick passed over every windowed rule on the instrument, because none of them has a fixed threshold to look up.",
        why: "Drawn as a separate path deliberately: it is the half of the work the index does not cover, and on a hot instrument it is what saturates the core while the threshold rules cost nothing.",
        numbers: ["one shared ring buffer per instrument"],
        breaks:
          "This scan is O(windowed rules) per tick with no way to shrink it, so it sets the real ceiling on an instrument carrying hundreds of thousands of percent-change rules.",
      },
    },
    {
      id: "e6",
      from: "threshold-idx",
      to: "fired-stream",
      label: "crossing fires",
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "A matched rule that passed prev < value <= now, emitted as a fired event carrying its alert_id, arm_epoch and the triggering price and sequence number.",
        why: "The rule flips to FIRED in local state as this is emitted, so the next tick at a higher price does not refire it. The epoch travels with the event because local state does not survive a crash and the dispatcher needs to tell replay from reality.",
        numbers: ["~17 fires/s average"],
        breaks:
          "If the local flag flip and the emit are not done together, a crash between them produces either a lost alert or an unbounded refire.",
      },
    },
    {
      id: "e7",
      from: "windowed",
      to: "fired-stream",
      label: "% change fires",
      detail: {
        what: "Fires from percent-change and volume-spike rules, evaluated against the ring buffer rather than a threshold crossing.",
        why: "They join the same stream because everything downstream treats a fire identically. The distinction between an indexed and a scanned match matters only inside the shard, where it decides the CPU budget.",
        breaks:
          "A rolling window means the reference price moves continuously, so these rules flap harder than threshold rules and lean more heavily on the dwell gate downstream.",
      },
    },
    {
      id: "e8",
      from: "rule-store",
      to: "rule-cdc",
      label: "Debezium CDC",
      dashed: true,
      detail: {
        what: "Committed rule inserts, updates and deletes streamed off the write-ahead log onto the change topic.",
        why: "Deriving the stream from the commit rather than dual-writing means a rule that exists to the user always eventually exists to the evaluator. The lag is bounded and measurable; a dual-write divergence is neither.",
        numbers: ["change-topic lag alerted, target under 1s"],
        breaks:
          "If replication stalls, alert CRUD keeps succeeding while nothing new ever fires, which is why CRUD stays in 'pending activation' until the shard confirms the load.",
      },
    },
    {
      id: "e9",
      from: "rule-cdc",
      to: "threshold-idx",
      label: "create / delete / re-arm",
      dashed: true,
      toSide: "right",
      detail: {
        what: "Rule changes applied incrementally to the shard's in-memory index and windowed list.",
        why: "Because the topic is keyed by instrument_id, a new AAPL alert arrives at the shard already consuming AAPL ticks with no routing decision to make. Same key, same partition, no coordination.",
        numbers: ["typically under 1s from commit to armed"],
        breaks:
          "Cold start is the expensive case: rebuilding 10M rules from change-stream replay alone takes minutes, which is why periodic state snapshots plus delta replay exist.",
      },
    },
    {
      id: "e10",
      from: "fired-stream",
      to: "dispatcher",
      label: "alert_id + arm_epoch",
      animated: true,
      detail: {
        what: "Fired events consumed by the dispatcher, which is the first component that knows anything about the user rather than the instrument.",
        why: "The split is what lets evaluation stay at market-data latency while delivery absorbs provider slowness. Back pressure from a push provider must never reach the tick path.",
        numbers: ["17/s average, 10k/s on a 3% index drop"],
        breaks:
          "The 600x burst hits here first, so the dispatcher rate-limits per downstream channel and smears delivery over seconds, which makes some users later than others.",
      },
    },
    {
      id: "e11",
      from: "dispatcher",
      to: "idem",
      label: "idem:{alert_id}:{epoch}",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A check-and-set against the dedupe key before anything user-visible happens, dropping on hit.",
        why: "A pipeline that is at-least-once has to collapse duplicates somewhere, and this is the last point before an action that cannot be recalled. One GET is a cheap price for never double-paging a user.",
        numbers: ["one GET per fire", "TTL 1h"],
        breaks:
          "It must be a conditional insert rather than a read followed by a write, or two replayed events arriving in parallel both miss and both send.",
      },
    },
    {
      id: "e12",
      from: "dispatcher",
      to: "rule-store",
      label: "ARMED to FIRED",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 110,
      detail: {
        what: "The durable state transition for the rule, and on a cooldown rule the later re-arm that increments arm_epoch.",
        why: "The evaluator's local flag is fast and disposable; this write is what survives a shard rebuild. The epoch increments here rather than in the evaluator so that a re-arm is a committed fact rather than a local one.",
        numbers: ["hysteresis 0.5% equities, 1% crypto, before re-arming"],
        breaks:
          "Re-arming without a hysteresis margin or dwell gate means a price oscillating around the threshold fires on every cooldown cycle.",
      },
    },
    {
      id: "e13",
      from: "dispatcher",
      to: "notify",
      label: "deduped, prefs applied",
      detail: {
        what: "The hand-off to the shared notification system, by which point the decision to notify is final and only channel selection and pacing remain.",
        why: "Everything price-specific has already happened. Drawing this as one arrow into an existing dependency is the point: the delivery half is question 7's problem and answering it here means answering the wrong question.",
        numbers: ["end-to-end p99 under 5s, tick to provider acceptance"],
        breaks:
          "Provider outages land beyond this arrow, so the alert is surfaced in-app immediately rather than waiting on push, and the audit stays pinned to trigger time.",
      },
    },
    {
      id: "e14",
      from: "dispatcher",
      to: "audit",
      label: "fire + exchange_seq",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The compliance record written for every fire, including the rule as it stood at trigger time and the exchange sequence number that caused it.",
        why: "A broker has to be able to reconstruct the decision years later against the exchange's own audit feed. Recording the rule snapshot rather than a rule id is what makes that possible after the user edits or deletes the alert.",
        numbers: ["7 years retention", "every state transition logged with its causing event"],
        breaks:
          "The write happens before delivery is confirmed, so delivered_at is filled in later by webhook and a missing delivered_at is a delivery gap rather than an evaluation gap.",
      },
    },
  ],
};
