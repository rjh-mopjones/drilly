import type { Diagram } from "./types";

export const MARKET_DATA_INGEST: Diagram = {
  id: "market-data-ingest",
  title: "Market Data Ingest",
  question: "Design a High-Throughput Market Data Ingest Pipeline",
  sourceId: "patterns",
  itemId: 43,
  overview: {
    shape:
      "Fan in, sequence, fan out, plus one rule about what you are allowed to drop: venue feeds converge on a single writer stamping one total order, then split by instrument.",
    forces: [
      {
        constraint: "At 2M msg/s, one blocked reader fills the kernel buffer and packets vanish with no error",
        decision: "Feed handlers do nothing but drain the socket and decode; every slower stage runs off a separate, bounded ring",
        lights: ["feed-handlers", "edge-group", "e6"],
      },
      {
        constraint: "A per-message allocation at 2M msg/s means a GC pause queues hundreds of thousands of messages",
        decision: "The Normaliser decodes into pre-allocated pooled structs, never fresh objects, on the hot path",
        lights: ["normaliser", "e8"],
      },
      {
        constraint: "Two near-simultaneous events need one deterministic answer for which came first, with no lock",
        decision: "A single Sequencer thread assigns the next number and claims a slot, the only source of total order",
        lights: ["sequencer", "ordered-ring", "e9"],
      },
      {
        constraint: "Round-robin dispatch across shards would interleave one instrument's book across consumers",
        decision: "Fan-out hashes on instrumentId, so a book always lands on the same shard in sequence order",
        lights: ["dispatch", "shards", "e14"],
      },
      {
        constraint: "Cancels outnumber fills 10-20x, and even 1 silently dropped order is unacceptable",
        decision: "Conflation replaces stale ticks on a lagging shard, while order flow gets backpressure or an explicit reject",
        lights: ["conflation", "order-gateway", "e12", "e15"],
      },
    ],
    naive: {
      text: "Give every inbound feed its own independent consumer that reads, parses, and pushes events straight into a shared queue, each assigning its own timestamp as the ordering key. Two venues quoting the same instrument within microseconds would then race to be first in the queue. Wall-clock timestamps from different machines cannot settle which event actually happened first. Reading and parsing on the same thread that drains the socket also has a cost. The moment parsing gets slow, the kernel receive buffer for that feed fills and silently drops packets. The Sequencer instead is the single thread that assigns the total order. Feed handlers do nothing but drain the socket, with every slower stage pushed off onto its own bounded ring.",
      lights: ["sequencer", "feed-handlers"],
    },
    beats: [
      {
        text: "The edge is deliberately stupid. One thin handler per inbound stream does nothing but drain the socket and decode the venue's frame. The moment a reader blocks on downstream work the kernel receive buffer fills, and on UDP multicast that is silent packet loss at the worst possible place.",
        lights: ["edge-group", "feed-handlers", "e1"],
      },
      {
        text: "Normalisation is where three protocols become one. FIX, an ITCH-style binary and a proprietary frame all decode into the same fixed canonical event, into pre-allocated structs rather than fresh objects. A per-message allocation at 2M msg/s is a garbage collection pause, and a pause blows a microsecond budget.",
        lights: ["normaliser", "e6", "e8"],
      },
      {
        text: "The sequencer is the whole correctness claim. A single writer assigns the next monotonic number and writes a pre-allocated slot, giving one gap-free total order across every instrument without a lock. A journal is the source of truth for replay. One writer is the mechanism, not a compromise.",
        lights: ["sequencer", "ordered-ring", "journal", "e9", "e10"],
      },
      {
        text: "Fan out is partitioning, never load balancing. Dispatch by hash(instrumentId) so a book always lands on the same consumer in sequence order. Round-robin would interleave one book across shards and destroy the only ordering guarantee that downstream matching depends on.",
        lights: ["dispatch", "shards", "e14"],
      },
      {
        text: "Overload is decided per message class, not per system. A tick is a snapshot you overwrite, so a lagging consumer gets conflation: the latest tick per instrument replacing the stale one. An order is state that accumulates and can never be silently dropped, so it gets slowed at the producer or an explicit busy reject instead. Every buffer between stages is bounded, so overload has a defined outcome rather than an out-of-memory.",
        lights: ["conflation", "order-gateway", "e12", "e15"],
      },
      {
        text: "What actually gets drilled is the hole in the feed. The venue's own per-feed sequence is the only thing that makes loss visible. The recovery ladder runs fastest first: the redundant B copy in tens of microseconds, a retransmit request at 5 to 50 ms, then a snapshot refresh for anything unbounded. Affected instruments are marked stale and unpublishable while the gap is open.",
        lights: ["gap-arb", "venue-feeds", "e2", "e3", "e4"],
      },
    ],
    crux: {
      problem:
        "You have to classify traffic before you size any buffer. Under overload the question is not how deep the queue is, it is which messages are state you overwrite and which are state you accumulate.",
      handled:
        "Get that split wrong and the pipeline either loses trades or dies of memory exhaustion, and no amount of tuning rescues either. Conflation handles the overwrite half by replacing stale ticks with the freshest one. Order flow gets backpressure or an explicit reject instead, since it can never be silently dropped.",
    },
    numbers: [
      {
        value: "2M msg/s planning peak across ~10k instruments",
        explain: "The peak the whole pipeline is provisioned against, and the instrument count fan-out has to spread it across.",
      },
      {
        value: "~32B packed binary: 64 MB/s, versus 300-500 MB/s as JSON",
        explain: "The bandwidth cost of the wire format choice at the planning peak, a 6-10x difference for the same event stream.",
      },
      {
        value: "B copy fills a gap in tens of µs; retransmit costs 5-50 ms",
        explain: "The two rungs of the recovery ladder and the latency gap between them, which is why redundant multicast is the first line of defence.",
      },
    ],
  },
  nodes: [
    {
      id: "edge-group",
      kind: "zone",
      label: "Ingest edge (must never block)",
      detail: {
        what: "The per-stream handlers plus the gap and arbitration logic that watches the venue's own sequence numbers on every feed.",
        why: "It is one zone because everything inside it is bound by a single rule: no work here may ever stall the socket drain. Business logic, gap repair and staleness decisions all run off the drain path, so the kernel buffer stays empty even when the rest of the pipeline is saturated.",
        numbers: [
          { value: "one handler per inbound stream, pinned to a core", explain: "The isolation model that keeps one slow feed from ever affecting another." },
          { value: "reorder buffer 1024 slots x 64B = 64KB per feed", explain: "The memory cost of holding out-of-order messages until a gap resolves or times out." },
        ],
        breaks: {
          failure: "Any blocking call that creeps into a handler, a lock, a log format, a metrics allocation.",
          handled: "That turns backpressure into dropped multicast packets that nothing upstream will ever tell you about, which is why handlers are audited to stay allocation-free and lock-free.",
        },
      },
    },
    {
      id: "venue-feeds",
      label: "Venue feeds",
      sub: "FIX, ITCH binary, proprietary",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The venues themselves, each publishing a tick firehose as two identical multicast copies on separate network paths, plus a per-feed monotonic sequence number on every message. Each venue also runs its own repair endpoints: a retransmit request-response service for a missing sequence range, and a periodic full-state snapshot channel.",
        why: "Drawn explicitly because it sets every constraint downstream answers to: a different wire protocol per venue, an arrival rate you do not control, a transport that never reports loss. The repair endpoints belong to somebody else too, which is why both are rate limited and capped.",
        numbers: [
          { value: "2M msg/s planning peak at open, close and on news", explain: "The peak arrival rate this pipeline has to absorb from the venues combined." },
          { value: "top 10 symbols carry 30-40% of all traffic", explain: "The skew in the traffic distribution, which is why per-instrument routing has to plan for hot books." },
          { value: "~24-40B per packed canonical tick", explain: "The size range one venue tick occupies once decoded into the canonical event shape." },
          { value: "retransmit round trip 5-50 ms; snapshot interval 1-30 s", explain: "Three to four orders of magnitude slower than the redundant B copy's tens-of-µs arrival, which is why arbitration is the first line of defense and retransmit only the fallback." },
        ],
        breaks: {
          failure: "The venue's sequence number is arrival order at our NIC, not the order the markets actually moved.",
          handled: "Two venues quoting the same instrument are ranked by path length, and nothing in this pipeline can fix that. A venue-wide burst also means every participant hits the recovery service at once, exactly when it is slowest.",
        },
      },
    },
    {
      id: "order-gateway",
      label: "Order entry gateway",
      sub: "per-participant credit quotas",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The control-plane path for order flow: submit_order and cancel_order arrive here, are counted against a per-participant quota, and either enter the pipeline or are rejected explicitly.",
        why: "Order flow is the traffic class that may never be silently dropped, so its admission has to be rationed somewhere. Every request is answered accepted, rejected or told busy. Counting at the edge means one participant's cancel-and-replace storm is rejected before it consumes shard capacity, rather than after it has already filled a ring the market data path shares.",
        numbers: [{ value: "orderflow.nack_rate should sit at zero", explain: "The healthy operating value for this metric; any sustained non-zero reading is a paged alert." }],
        breaks: {
          failure: "Sustained order-flow overload has no graceful answer.",
          handled: "Backpressure penalises everyone on that producer connection and a reject is a visible failure to a paying client. Buffering only relocates the failure and makes it bigger.",
        },
        choice: {
          pick: "Per-participant message credits at the gateway, with a documented busy reject code",
          instead: "One shared bounded queue in front of the shards, buffering whoever arrives.",
          decider:
            "Blast radius under a single participant's burst. A shared queue at 2^20 slots absorbs about 0.5s of a 2M msg/s burst and then rejects everybody, including the quiet participants. Per-participant credits reject only the one client whose burst caused it, and keep the gateway thin because it counts rather than parses.",
          flips: "A venue with a handful of trusted internal producers, where quota accounting costs more than it saves and a single bounded queue is honest enough.",
        },
      },
    },
    {
      id: "feed-handlers",
      label: "Feed handlers",
      sub: "one per stream, drain only",
      kind: "service",
      col: 0,
      row: 1,
      parent: "edge-group",
      detail: {
        what: "One thin process or thread per inbound stream. Its entire job is to pull packets off the socket as fast as they arrive and hand them to a bounded per-stream ring.",
        why: "The reader must never block on downstream work. On TCP a slow reader becomes backpressure onto the sender. On UDP multicast the kernel receive buffer fills and packets are dropped with no error anywhere, corrupting the feed view exactly when the market is busiest. Handlers are pinned to cores and busy-poll rather than block on the socket.",
        numbers: [{ value: "~50-80 MB/s binary ingress at 2M msg/s", explain: "The per-feed bandwidth these handlers absorb at the planning peak." }],
        breaks: {
          failure: "A handler process dying takes one feed dark, and the symptom is a message rate that falls to zero rather than an error.",
          handled: "The per-feed heartbeat is what catches it, and gap detection replays the missed range once the handler restarts.",
        },
        choice: {
          pick: "Binary UDP multicast for the tick firehose, kept separate from the control plane",
          instead: "gRPC server-streaming over HTTP/2 for both the firehose and the service feeds.",
          decider:
            "Egress multiplication and tail latency. One multicast publish at 2M msg/s and 32 bytes is 64 MB/s no matter how many consumers subscribe. Unicast to 20 consumers is 1280 MB/s, past 10 GbE line rate. TCP also head-of-line blocks, so one lost segment stalls everything behind it for a retransmit round trip of 100-200 µs against a p99 budget of tens of µs.",
          flips: "Consumers in the single digits, or any cloud deployment, since multicast is not natively available inside most VPCs. If the budget is milliseconds the head-of-line cost vanishes into the noise and the reliable stream deletes this whole gap subsystem.",
        },
      },
    },
    {
      id: "gap-arb",
      label: "Arbitration + gap detect",
      sub: "dual-feed dedup, expected counter",
      kind: "service",
      col: 0,
      row: 2,
      parent: "edge-group",
      detail: {
        what: "Per feed, an expected counter over the venue's sequence plus a small reorder buffer. It keeps whichever of the A or B copies lands first, discards the duplicate, and starts a timer when a message arrives above expected.",
        why: "Multicast will never report a loss, so the venue's own per-feed number is the only evidence a packet went missing. A gap is often just reordering, which is why the timer exists at all rather than firing a retransmit on the first out-of-order message.",
        numbers: [
          { value: "reorder buffer 1024 slots x 64B = 64KB per feed", explain: "The buffer capacity held per feed for messages that arrive out of order." },
          { value: "gap timer 5-10 ms colocated", explain: "The wait period before an unresolved gap escalates to a retransmit request." },
          { value: "B copy typically arrives within tens of µs, well under the 5-50ms retransmit", explain: "How much faster the redundant copy resolves a gap compared to the fallback." },
        ],
        breaks: {
          failure: "Too aggressive a timer floods the venue's recovery service at precisely the moment every other participant is doing the same.",
          handled: "Too slow a timer and the instrument sits stale and unpublishable for longer than it needed to, so the timer is tuned against both failure modes together.",
        },
        choice: {
          pick: "Subscribe to both redundant multicast copies and arbitrate, with retransmit as the second line",
          instead: "Subscribe to one copy, detect gaps, and request a retransmit whenever one appears.",
          decider:
            "Recovery latency against hardware cost. Arbitration hides any loss confined to one path within the arrival spread between copies, tens of µs, with no round trip at all. A retransmit costs 5-50 ms during which the instrument is unpublishable. The price is 2x ingress, another 64 MB/s and roughly one more core per feed.",
          flips: "When the second path is not genuinely independent, same switch or same AZ, so arbitration buys nothing. At one gap per hour with 20 ms recovery that is 0.0006% stale time, which nobody funds a second NIC to remove.",
        },
      },
    },
    {
      id: "normaliser",
      label: "Normaliser",
      sub: "decode into pooled structs",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "Per-venue decoders that turn every wire format into one fixed canonical event: seq, instrument_id, kind, venue, side, price, quantity, source_ts, ingest_ts.",
        why: "Three protocols cannot each be understood by the sequencer and the shards, so the variability is absorbed once, here. Carrying both timestamps is deliberate: source_ts is the venue's clock, ingest_ts is ours, and consumers reasoning about cross-venue causality need both.",
        numbers: [
          { value: "~24-40B packed per canonical event", explain: "Versus 150-250B as JSON for the same tick — packing keeps bandwidth 6-10x lower, which is what keeps the hot path allocation-free at 2M msg/s." },
          { value: "zero steady-state allocation on the hot path", explain: "The design constraint that removes GC pauses from this stage's latency profile entirely." },
        ],
        breaks: {
          failure: "A fresh object per message is a garbage collection pause.",
          handled: "A pause of even a few milliseconds is hundreds of thousands of queued messages at 2M msg/s, which is why decode targets pre-allocated structs instead.",
        },
        choice: {
          pick: "Allocation-free decode into pooled fixed-size structs, packed binary",
          instead: "JSON or a self-describing format decoded into fresh objects per message.",
          decider:
            "Bytes and pause time. The same tick is ~32B packed and 150-250B as JSON, so 64 MB/s becomes 300-500 MB/s. That 6-10x bandwidth and parse-cost penalty comes before counting the allocation churn a per-message object graph creates.",
          flips: "The control plane, where the rate is low and human-legible payloads with real tooling are worth far more than the bytes they cost.",
        },
      },
    },
    {
      id: "sequencer",
      label: "Sequencer",
      sub: "single writer, assign seq",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "One thread that does exactly three things per event: increment the sequence, write it into a claimed ring slot, and append it to the journal.",
        why: "This is the point where many streams become one ordered stream, and one writer is what makes that order deterministic without a lock or a CAS. It also has to do nothing else: no parsing, no risk checks, no formatted logging, because every microsecond spent here comes straight off the venue's throughput ceiling.",
        numbers: [
          { value: "LMAX published 6M+ msg/s on 2011 commodity hardware", explain: "A published reference point for how fast a single-writer sequencer can run." },
          { value: "~3x headroom against a 2M msg/s peak", explain: "The margin this design keeps between measured capability and the planning peak." },
        ],
        breaks: {
          failure: "It is a single-writer ceiling by construction, so a saturated sequencer has no incremental fix.",
          handled: "At 80% of one core doing only those three things, the only move left is sharding the whole pipeline by instrument range.",
        },
        choice: {
          pick: "One global sequencer per pipeline, giving a total order across every instrument",
          instead: "Sequence independently inside each instrument shard and never claim a global order.",
          decider:
            "Measured headroom against the actual peak. A stage that only assigns a number and writes a pre-allocated slot sustains millions of ops per second on one core. Against a 2M msg/s planning peak that is about 3x headroom, so the global order is effectively free. Below roughly 2x, stop relying on it.",
          flips: "Peak above half the single-writer ceiling, a deployment already spanning machines so no one writer sees every event, or audit rules requiring each shard to be independently recoverable. The cost is losing the answer to 'what did the venue look like at sequence N', which is the first thing a basket order asks.",
        },
      },
    },
    {
      id: "ordered-ring",
      label: "Ordered ring",
      sub: "2^20 slots, pre-allocated",
      kind: "queue",
      col: 1,
      row: 3,
      detail: {
        what: "The single totally ordered event log as a power-of-two ring buffer with a producer cursor and per-consumer cursors, every slot pre-allocated at startup.",
        why: "It decouples the socket drain from the shards without letting that decoupling become unbounded. Consumers batch-drain everything available in one go, which amortises per-message cost and is a large part of how this shape reaches millions of messages a second on modest hardware.",
        numbers: [
          { value: "2^20 slots x 64B = 64 MB per ring", explain: "2^20 × 64B = 64MB — small enough to stay cache-friendly while still absorbing ~0.5s of a 2M msg/s burst before it fills." },
          { value: "absorbs ~0.5s of a 2M msg/s burst", explain: "How much buffering headroom this ring provides before it fills." },
          { value: "warn at 50% depth, ~250 ms of headroom", explain: "The alert threshold this ring is watched against before it becomes critical." },
        ],
        breaks: {
          failure: "It is bounded on purpose, so a sustained overload reaches capacity.",
          handled: "The conflation-or-backpressure rule has to be correct at that point. Make it unbounded and the failure simply moves from a defined drop to an out-of-memory.",
        },
        choice: {
          pick: "A single-writer shared-memory ring inside one process",
          instead: "A durable partitioned log such as Kafka in the middle of the pipeline.",
          decider:
            "The latency floor. Ring hand-off is sub-microsecond with no copy, no syscall and no allocation, against a p99 budget of tens of µs. A network hop plus a disk commit per message puts the floor in milliseconds, three orders of magnitude past budget.",
          flips: "When consumers are many, heterogeneous and owned by other teams, or when the latency budget is seconds. Then the durable log's replay, independent offsets and free consumer onboarding are worth far more than the microseconds.",
        },
      },
    },
    {
      id: "journal",
      label: "Journal + snapshots",
      sub: "sequential append, snapshot 30s",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "The sequenced log persisted by sequential append, plus periodic snapshots of consumer state each labelled with the sequence it is current as of.",
        why: "The log, not any in-memory buffer, is the source of truth. Recovery is loading the newest snapshot and replaying forward from its sequence. A hot standby does exactly that continuously, so failover is a promotion rather than a cold rebuild.",
        numbers: [
          { value: "snapshot every 30s bounds replay to 30s", explain: "The cadence that caps how much log a recovering consumer has to replay." },
          { value: "RPO zero for anything journalled before ack", explain: "The durability guarantee this store provides once a write is acknowledged." },
          { value: "RTO within the ~30s replay bound", explain: "The recovery time this design commits to, directly derived from the snapshot cadence." },
        ],
        breaks: {
          failure: "Replay is only useful if it is deterministic, and determinism is a discipline.",
          handled: "One wall-clock read, one hash-map iteration or one branch on arrival timing on the processing path, and a replay silently stops reproducing the day it is meant to reconstruct.",
        },
        choice: {
          pick: "Memory-mapped sequential append, with snapshots every 30 seconds",
          instead: "A relational database or a replicated broker as the durable record.",
          decider:
            "Cost per event on the sequencer thread. This is a pure append at up to 2M events/s on the one thread that must not stall. A transactional write per event is orders of magnitude too slow and puts a query planner on the hot path. Snapshot cadence then buys back replay time: 30s cadence, at most 30s to replay.",
          flips: "When other teams need arbitrary historical replay with schemas and offsets, where a real log service is worth the hop that a memory-mapped file will not give you.",
        },
      },
    },
    {
      id: "dispatch",
      label: "Fan-out",
      sub: "hash(instrumentId) % shards",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "Reads the ordered ring and routes each event to the consumer shard that owns its instrument, preserving the sequence order it was stamped with.",
        why: "Ordering only has to hold within a book and books are independent, so hashing the instrument turns the guarantee into linear parallelism. This is also where the overload decision is taken, per message, by looking at the event kind rather than at the system as a whole.",
        numbers: [
          { value: "2M / 1e4 = 200 msg/s per instrument on average", explain: "The average per-instrument load once the peak is spread across the instrument set." },
          { value: "distribution heavily skewed, top 10 take 30-40%", explain: "The concentration that makes average load a misleading planning number on its own." },
        ],
        breaks: {
          failure: "Skew, not spread.",
          handled: "One hot instrument's stream cannot be split without breaking its order, so a whale book is bounded by a single consumer no matter how many shards you add.",
        },
        choice: {
          pick: "Partition by hash(instrumentId), with shards assigned by measured load",
          instead: "Round-robin load balancing across consumers, or least-loaded dispatch.",
          decider:
            "The ordering guarantee itself. Round-robin interleaves one book across N consumers and destroys per-instrument order, which the deterministic matching core downstream depends on absolutely. Hashing keeps the guarantee and still gives near-linear scale across ~10k instruments; the residual problem is skew, which you solve by assignment, not by spraying.",
          flips: "Stateless edges such as feed-handler gateways or market-data publishers, which carry no per-instrument ordering and should load-balance normally.",
        },
      },
    },
    {
      id: "conflation",
      label: "Conflation map",
      sub: "instrument -> latest tick slot",
      kind: "database",
      col: 2,
      row: 4,
      detail: {
        what: "One slot per instrument holding the latest unconsumed tick, so a new tick for an instrument overwrites the previous queued one instead of joining a queue behind it.",
        why: "A tick is a stateless snapshot, so nobody needs the price from 3 ms ago when a newer one is already waiting. This is the entire mechanism by which the pipeline sheds load without losing anything that matters, and it is why the tick path can be lossy at all.",
        numbers: [{ value: "one slot per instrument, ~10k slots", explain: "The fixed size of this structure, independent of how far behind a shard falls." }],
        breaks: {
          failure: "It owns exactly one rule and must never be widened.",
          handled: "An order or cancel placed in this map is a lost trade, because conflation means overwriting state that was meant to accumulate.",
        },
        choice: {
          pick: "A per-instrument latest-value slot for TICK events only",
          instead: "A deeper bounded queue per shard that drops the oldest when full.",
          decider:
            "Which message you lose when it fills. Dropping the oldest discards the price closest to the current one and keeps stale intermediates. Overwriting discards the stale intermediates and keeps the freshest, which is the only tick anyone will act on. Bounded at ~10k slots either way.",
          flips: "Consumers that need every intermediate tick, tape reconstruction or surveillance for example, which must read the journal rather than the conflated live stream.",
        },
      },
    },
    {
      id: "shards",
      label: "Per-instrument shards",
      sub: "one consumer per instrument set",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "The per-instrument consumers, each draining its own cursor in batches and applying events for its instruments strictly in sequence order.",
        why: "Shared-nothing per book is what makes the pipeline parallel without coordination: no shard needs a lock, and no shard's lag can reorder another's stream. Each also carries the per-instrument stale flag, which has to be visible in what it publishes. Lag is measured as the producer cursor minus the consumer cursor, and the hottest books get dedicated cores with NUMA-local memory.",
        breaks: {
          failure: "A lagging shard must never propagate back to the socket drain.",
          handled: "Its ticks conflate and its order flow backpressures at the producer instead, but the edge keeps draining regardless of how far behind any one shard falls.",
        },
        choice: {
          pick: "Single-threaded consumer per shard, batch-draining the ring",
          instead: "A thread pool per shard working the same instrument set concurrently.",
          decider:
            "Determinism against throughput. Concurrent workers on one book reintroduce exactly the ambiguity the single-writer sequencer paid to remove, and no lock scheme restores byte-identical replay. Batching recovers the speed instead: one shard draining in batches carries its share of 2M msg/s comfortably, and an average instrument is only 200 msg/s.",
          flips: "Genuinely commutative per-instrument work such as computing independent analytics, where order does not affect the result and parallelism is free.",
        },
      },
    },
    {
      id: "matching-cores",
      label: "Matching cores",
      sub: "downstream sink, one per shard",
      kind: "external",
      col: 3,
      row: 4,
      detail: {
        what: "The per-instrument matching engines, which take ordered events from this pipeline and turn them into executed trades. This is where the pipeline's responsibility ends.",
        why: "It is the boundary because it is what makes every guarantee upstream non-negotiable. A matching core is a deterministic function of its input, so a reordered or dropped message here is not an estimate that gets corrected later, it is a wrong trade.",
        numbers: [{ value: "one core per shard, single threaded", explain: "The deployment shape this sink expects to receive events from, one strictly ordered stream per book." }],
        breaks: {
          failure: "It has no defence of its own.",
          handled: "If this pipeline hands it a book it silently repaired or an event out of order, the core will match against it and produce an execution nobody can undo.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "venue-feeds",
      to: "feed-handlers",
      tier: "hot",
      step: 1,
      label: "A and B multicast copies",
      detail: {
        what: "The tick firehose arriving as two identical multicast streams on separate groups over separate network paths.",
        why: "Two copies exist so that loss confined to one path costs nothing: the handler keeps whichever copy of a given feed sequence lands first. It is the cheapest rung of the recovery ladder because there is no request and no round trip.",
        numbers: [
          { value: "~50-80 MB/s binary ingress at 2M msg/s", explain: "The per-feed bandwidth this edge carries at peak." },
          { value: "2x ingress and one extra core per feed", explain: "The standing price of arbitration: double bandwidth and a core per feed, paid on every message so ordinary single-path loss never reaches the 5-50ms retransmit fallback." },
        ],
        breaks: {
          failure: "If both paths share a switch, a NIC or an AZ, the copies fail together.",
          handled: "The redundancy is imaginary while you still pay twice for it, which is why the two paths are audited for genuine independence.",
        },
      },
    },
    {
      id: "e2",
      from: "feed-handlers",
      to: "gap-arb",
      tier: "control",
      label: "feed_seq per message",
      detail: {
        what: "Every decoded message's venue sequence number handed to the arbitration and gap logic, alongside the main path.",
        why: "Gap detection runs on the venue's sequence space, not ours: theirs can have holes and ours cannot. Keeping this off the drain path is deliberate, because deciding what is missing must never be allowed to slow down reading the socket.",
        numbers: [
          { value: "one expected counter per feed", explain: "The state this edge maintains to detect a gap." },
          { value: "1024-slot reorder buffer", explain: "The buffering capacity backing this edge's gap logic." },
        ],
        breaks: {
          failure: "A duplicate below expected is dropped.",
          handled: "A venue that resets or wraps its sequence looks exactly like a flood of duplicates, and silently stalls the feed unless that case is explicitly handled.",
        },
      },
    },
    {
      id: "e3",
      from: "gap-arb",
      to: "venue-feeds",
      tier: "control",
      label: "retransmit request",
      detail: {
        what: "A request for a specific missing sequence range, sent once the gap timer expires and the B copy has not filled the hole.",
        why: "The timer exists because most apparent gaps are reordering, and firing on the first out-of-order message means requesting packets that were about to arrive anyway.",
        numbers: [
          { value: "timer 5-10 ms colocated", explain: "The wait before this edge fires a request." },
          { value: "round trip plus queue: 5-50 ms", explain: "The typical latency this edge costs once triggered." },
        ],
        breaks: {
          failure: "A venue-wide burst makes every participant request at once.",
          handled: "The recovery service is at its slowest exactly when the largest number of people need it, which is a load pattern the venue's own rate limiting is meant to survive.",
        },
      },
    },
    {
      id: "e4",
      from: "venue-feeds",
      to: "gap-arb",
      tier: "control",
      label: "range or snapshot",
      detail: {
        what: "The repair coming back: either the resent messages for the missing range, or a full per-instrument snapshot labelled with the sequence it is current as of.",
        why: "Two different rungs for two different sizes of hole. Retransmit is right for tens of messages; only the snapshot recovers an unbounded gap, and taking it means discarding every buffered incremental at or below its sequence. Venues cap both the resend size and the request rate on this channel.",
        numbers: [{ value: "snapshot interval 1-30 s", explain: "How often the venue's own snapshot channel refreshes." }],
        breaks: {
          failure: "Failing to discard buffered incrementals at or below the snapshot sequence double-applies them.",
          handled: "That corrupts the book more quietly than the gap did, which is why the discard step is mandatory whenever a snapshot arrives.",
        },
      },
    },
    {
      id: "e5",
      from: "gap-arb",
      to: "normaliser",
      tier: "data",
      label: "repaired, in feed order",
      detail: {
        what: "Arbitrated and gap-repaired messages rejoining the main path, in the venue's own sequence order.",
        why: "Repair has to complete before the event is stamped with our internal sequence. Our sequence is gap-free by construction and cannot have a hole reserved in it for a message that has not arrived yet.",
        numbers: [{ value: "drains up to 1024 buffered slots on each fill", explain: "The batch size this edge can release at once when a gap resolves." }],
        breaks: {
          failure: "A fill that arrives after the pipeline gave up leaves the buffered successors stranded.",
          handled: "That is why the reorder buffer is sized for the largest plausible burst behind a hole, rather than the average one.",
        },
      },
    },
    {
      id: "e6",
      from: "feed-handlers",
      to: "normaliser",
      tier: "hot",
      step: 2,
      label: "raw frames, bounded ring",
      detail: {
        what: "Decoded venue frames moving from the drain thread into normalisation over a bounded per-stream ring.",
        why: "The ring is what decouples the socket from everything slower without letting the decoupling become unbounded, sized for burst rather than average throughput. It is bounded so that a stalled normaliser produces a defined outcome rather than growing memory until the process dies.",
        breaks: {
          failure: "If the handler ever waits on a full ring instead of shedding, the block propagates to the socket.",
          handled: "The kernel buffer starts dropping multicast packets, which is why the handler always sheds rather than blocks on a full ring.",
        },
      },
    },
    {
      id: "e7",
      from: "order-gateway",
      to: "normaliser",
      tier: "data",
      label: "order / cancel, lossless",
      detail: {
        what: "Accepted order flow joining the same canonical path as market data, so both classes end up in one sequence space.",
        why: "Order flow and ticks must be totally ordered against each other, because an order matching against a book depends on which ticks preceded it. They share the path but never the overload policy.",
        numbers: [{ value: "cancels dominate order flow 10-20x fills", explain: "The typical composition of order flow this edge carries." }],
        breaks: {
          failure: "Any code path that treats these events like ticks, conflation especially.",
          handled: "That silently loses a trade rather than shedding a redundant snapshot, which is why order flow is architecturally kept out of the conflation path.",
        },
      },
    },
    {
      id: "e8",
      from: "normaliser",
      to: "sequencer",
      tier: "hot",
      step: 3,
      label: "canonical events",
      detail: {
        what: "One uniform event shape arriving at the single writer, with source_ts already attached and ingest_ts stamped.",
        why: "The sequencer must be able to do its three operations without looking inside the event. Every field it would otherwise have to parse is resolved upstream, because parsing on that thread comes straight off the venue's throughput ceiling.",
        numbers: [{ value: "fixed-size packed struct, ~32B", explain: "Within the 24-40B canonical range, small and fixed so the sequencer's claim-and-stamp loop never branches on event shape or size." }],
        breaks: {
          failure: "Anything left undecoded here, an optional field or a variable-length tail.",
          handled: "That becomes work on the one thread that must stay at almost zero work per message, so the normaliser resolves everything before it reaches this edge.",
        },
      },
    },
    {
      id: "e9",
      from: "sequencer",
      to: "ordered-ring",
      fromSide: "bottom",
      toSide: "top",
      tier: "hot",
      step: 4,
      label: "seq stamped, claim slot",
      detail: {
        what: "The event written into a claimed ring slot carrying its monotonic sequence number, after which consumers advance their own cursors independently.",
        why: "Single writer means claiming a slot needs no lock and no CAS contention, and it removes any ambiguity about which of two near-simultaneous events came first. That decision is made exactly once here and inherited as fact by everything downstream.",
        numbers: [{ value: "hand-off in under 1µs, no copy", explain: "Sub-microsecond and copy-free, which is why this single-writer step still clears the sequencer's ~3x headroom over the 2M msg/s planning peak." }],
        breaks: {
          failure: "This pipeline has no second chance at ordering.",
          handled: "Get it wrong here and every consumer, replay and audit inherits the wrong answer with no way to detect it. This edge is the single most scrutinised step in the design for that reason.",
        },
      },
    },
    {
      id: "e10",
      from: "sequencer",
      to: "journal",
      tier: "data",
      label: "sequential append",
      detail: {
        what: "Each sequenced event appended to the durable log, in sequence order, on the same thread that assigned the number.",
        why: "The journal is the source of truth for both replay and the hot standby. It has to be written by the writer that owns the order, or the durable record and the published order could diverge.",
        numbers: [
          { value: "append at up to 2M events/s", explain: "The write rate this edge sustains at the planning peak." },
          { value: "RPO zero for anything journalled before ack", explain: "The durability this edge provides once a write is acknowledged." },
        ],
        breaks: {
          failure: "Any per-event work here that is not a pure sequential append, an fsync per message or an index update.",
          handled: "That becomes the pipeline's real throughput ceiling rather than the sequencer itself, which is why this append is kept strictly minimal.",
        },
      },
    },
    {
      id: "e11",
      from: "ordered-ring",
      to: "dispatch",
      tier: "hot",
      step: 5,
      label: "batched drain",
      detail: {
        what: "The dispatcher taking everything available on the ring in one pass rather than one message at a time.",
        why: "Batching is where most of the throughput comes from. The per-message cost of cursor reads and cache misses is amortised across the whole batch, and the batch size grows automatically exactly when the system is busiest.",
        numbers: [{ value: "ring depth alarms at 50%, ~250 ms of headroom at peak", explain: "The threshold and remaining runway this edge is monitored against." }],
        breaks: {
          failure: "Queue depth here should sit near zero in steady state.",
          handled: "A depth that stays high means the shards are the bottleneck and the overload rule is about to be exercised.",
        },
      },
    },
    {
      id: "e12",
      from: "dispatch",
      to: "conflation",
      tier: "data",
      label: "TICK, shard behind",
      detail: {
        what: "A market-data tick diverted into the per-instrument latest-value slot when its target shard cannot keep up.",
        why: "This is the overwrite half of the rule. Ticks are state you replace, so the correct response to a lagging consumer is to bin the stale intermediates and keep the freshest, not to queue deeper. The conflation rate per instrument is the metric that tracks it, and it rises under load by design.",
        breaks: {
          failure: "A conflation rate that spikes is the early warning that a shard is falling behind.",
          handled: "It is the only signal you get before the ring depth alarm fires, so conflation rate is watched as a leading indicator rather than an afterthought.",
        },
      },
    },
    {
      id: "e13",
      from: "conflation",
      to: "shards",
      tier: "data",
      label: "latest tick only",
      detail: {
        what: "The freshest tick per instrument delivered when the shard is ready to take it, with the intermediates already discarded.",
        why: "The consumer sees a correct current price and never a backlog of prices nobody will act on. Load sheds without any message class that matters being touched.",
        numbers: [{ value: "one slot per instrument", explain: "The granularity this edge delivers at, regardless of how many intermediate ticks were discarded." }],
        breaks: {
          failure: "Anything downstream that needs every intermediate tick, tape reconstruction or surveillance.",
          handled: "That cannot use this stream, and has to read the journal instead, since this edge only ever carries the latest value.",
        },
      },
    },
    {
      id: "e14",
      from: "dispatch",
      to: "shards",
      tier: "hot",
      step: 6,
      label: "hash(instrumentId) % N",
      detail: {
        what: "The main fan-out: each event routed to the single shard owning its instrument, in the sequence order it was stamped with. It carries the per-instrument stale flag set upstream whenever a gap on that feed is still open.",
        why: "Partitioning rather than balancing. Ordering only has to hold within a book, so the same instrument always landing on the same consumer turns one total order into N independent ordered streams with no coordination. The stale flag rides in the event itself, because a book known to be missing messages is worse than no book.",
        numbers: [
          { value: "~10k instruments across the shard set", explain: "The partitioning space this hash function spreads events across." },
          { value: "200 msg/s per instrument average, heavily skewed", explain: "The typical per-instrument rate this edge carries, though the top instruments run far hotter." },
          { value: "staleness is per instrument, never global across ~10k", explain: "The scoping rule that keeps one instrument's gap from blinding every other book on this edge." },
        ],
        breaks: {
          failure: "Rebalancing shards moves instruments between consumers, and an event in flight during the move can arrive at the new owner behind one the old owner already applied.",
          handled: "Making staleness global for convenience would also blind the other 9,999 instruments over a hole in one symbol, a far larger outage than the gap itself.",
        },
      },
    },
    {
      id: "e15",
      from: "dispatch",
      to: "order-gateway",
      tier: "control",
      label: "busy: backpressure",
      detail: {
        what: "The accumulate half of the rule: order flow that cannot be absorbed causes the producer to be slowed or the client to be rejected explicitly, never silently dropped.",
        why: "An order is state that accumulates, so the sender has to learn that it did not make it. An explicit reject is a visible failure a client can handle; a silent drop is a trade that both sides believe happened differently. The nack rate alerts on any sustained non-zero value.",
        breaks: {
          failure: "Backpressure penalises everyone sharing that producer connection.",
          handled: "That is why the quota lives per participant at the gateway rather than as one global valve, isolating one client's burst from every other.",
        },
      },
    },
    {
      id: "e17",
      from: "journal",
      to: "shards",
      fromSide: "right",
      toSide: "top",
      tier: "control",
      label: "replay from snapshot seq",
      detail: {
        what: "Recovery: a restarted or promoted consumer loads its newest snapshot and replays the sequenced log forward from that snapshot's sequence number.",
        why: "Snapshot plus log is the entire recovery story, and it is the same mechanism a hot standby runs continuously, which is why failover is a promotion rather than a rebuild. Sequential replay reads far faster than line rate.",
        numbers: [{ value: "at most 30s of replay at a 30s snapshot cadence", explain: "The worst-case replay duration this edge is bounded to." }],
        breaks: {
          failure: "Replay only reproduces the original if the processing path is deterministic.",
          handled: "A byte-for-byte replay equality check belongs in CI, since determinism regressions stay silent until the day you actually need to recover.",
        },
      },
    },
    {
      id: "e18",
      from: "shards",
      to: "matching-cores",
      tier: "hot",
      step: 7,
      label: "in seq order, to matching",
      detail: {
        what: "The hand-off that ends this pipeline: ordered per-instrument events delivered to the matching core that owns that book.",
        why: "This boundary exists on purpose. Everything upstream exists to make this one delivery safe: gap-free, in order, and flagged if the book behind it is not trustworthy.",
        numbers: [{ value: "p99 ingest to dispatch in tens of µs", explain: "The end-to-end latency budget this edge represents the final step of." }],
        breaks: {
          failure: "Order flow arriving for a stale instrument must be rejected here rather than matched.",
          handled: "Matching against a book you know is incomplete produces an execution nobody can undo, which is why the stale flag is checked at this final boundary.",
        },
      },
    },
  ],
  figures: {
    "shard-by-book": {
      title: "Round-robin scatters a book; hashing keeps it on one shard",
      nodes: [
        { id: "log", label: "Log order", sub: "A1 · B1 · A2 · C1 · A3", kind: "queue", col: 0, row: 0 },
        { id: "rr", label: "Round-robin", sub: "spread evenly", kind: "service", col: 0, row: 1 },
        {
          id: "rr-out",
          label: "A scatters: 0, 1, 2",
          sub: "no shard holds A's order",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "A's events land on three different shards in arrival order.",
            why: "Nothing downstream can rebuild A's true order without collecting every shard's output and merging it again, which defeats sequencing in the first place.",
          },
        },
        { id: "hash", label: "hash(instrumentId)", sub: "route by book", kind: "service", col: 0, row: 2 },
        {
          id: "hash-out",
          label: "A stays on shard 0",
          sub: "A1, A2, A3 in order",
          kind: "database",
          col: 1,
          row: 2,
          detail: {
            what: "Every event for instrument A always lands on the same shard, in the sequence order it was stamped.",
            why: "Ordering only has to hold inside a book, and books are independent, so this turns one global guarantee into many small ones with zero cross-shard coordination.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "log", to: "rr", tier: "hot", step: 1, label: "dispatched" },
        { id: "e2", from: "rr", to: "rr-out", tier: "hot", step: 2, label: "even spread" },
        { id: "e3", from: "log", to: "hash", tier: "data", label: "same log" },
        { id: "e4", from: "hash", to: "hash-out", tier: "hot", step: 3, label: "keeps book together" },
      ],
    },
    "tick-vs-order": {
      title: "A tick overwrites its slot; an order queues, then backs off",
      nodes: [
        { id: "new-tick", label: "New tick", sub: "e.g. 187.08", kind: "external", col: 0, row: 0 },
        {
          id: "slot",
          label: "Conflation slot",
          sub: "1 per instrument, latest only",
          kind: "cache",
          col: 1,
          row: 0,
          detail: {
            what: "One slot per instrument, holding only the freshest unconsumed tick.",
            why: "A tick is a fact about right now; the old value is worthless the moment a new one exists, so overwriting is free and bounded — nothing is ever queued.",
          },
        },
        { id: "new-order", label: "New order", sub: "intent to trade", kind: "external", col: 0, row: 1 },
        { id: "order-q", label: "Order queue", sub: "bounded, FIFO", kind: "queue", col: 1, row: 1 },
        {
          id: "backoff",
          label: "Slow producer, or NACK",
          sub: "busy — never a silent drop",
          kind: "service",
          col: 1,
          row: 2,
          detail: {
            what: "Once the bounded order queue fills, the producer is slowed or told explicitly the system is busy.",
            why: "An order is a fact about intent, and intent does not expire because the system is busy — it can never vanish without telling anyone.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "new-tick", to: "slot", tier: "hot", step: 1, label: "overwrites in place" },
        { id: "e2", from: "new-order", to: "order-q", tier: "hot", step: 2, label: "enqueues" },
        { id: "e3", from: "order-q", to: "backoff", tier: "hot", step: 3, label: "queue full" },
      ],
    },
  },
};
