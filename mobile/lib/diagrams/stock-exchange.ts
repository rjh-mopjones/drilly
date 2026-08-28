import type { Diagram } from "./types";

export const STOCK_EXCHANGE: Diagram = {
  id: "stock-exchange",
  title: "Stock Exchange",
  question: "Design a Stock Exchange (Matching Engine)",
  sourceId: "patterns",
  itemId: 25,
  overview: {
    shape:
      "A venue is a machine for producing a verifiable total order: one thread decides what happened first, a durable log records that decision, and everything downstream is derived state replayed from it.",
    beats: [
      "The whole design follows from one placement decision, where the sequence number is assigned. Matching is the easy part. Put the ordering point in a single pinned thread and you buy an indisputable answer to what happened first, across symbols as well as within one, at the cost of a venue-wide ceiling of one core.",
      "Risk sits above the sequencer, never inside the engine. Gateways authenticate, decode and run max size, max notional, buying power and the kill switch before anything is sequenced, because a rejected order must never enter the official record and the engine must never need to un-match anything after the fact.",
      "Durability comes before visibility. A slot is not published to any matching engine until it is committed to the memory-mapped log and synchronously replicated to the second sequencer in the same rack, roughly 5 to 10μs. Reverse those two steps and a crash leaves a trade in the market data feed that is absent from the record.",
      "Matching engines read the log rather than receive traffic, one single-threaded engine per symbol holding sorted price levels with a FIFO queue at each level. Single threading is the correctness property, not a performance compromise: the engine is a pure function of its input, so the standby is a second reader rather than a replica to keep in sync.",
      "Outputs are reassembled by one output sequencer and leave over reliable multicast, so every subscriber receives the same bytes at the same instant and detects a gap by counting rather than by timing out. Fairness at the edge is physical, not logical, and that is the only kind you can actually demonstrate.",
      "The engineering budget goes on jitter, not throughput. C++ or Rust, pools preallocated at startup, nothing allocating on the hot path, cores isolated from the scheduler, kernel bypass at the NIC. A 50ms garbage collection pause during the open is not a latency regression, it is an outage.",
    ],
    crux:
      "Determinism only holds if the engine reads nothing but its log. No wall clock, no randomness, no allocator-dependent iteration order, no config push that bypasses the log. Break any one of those and replay, hot standby and the regulator's reconstruction all stop being the same mechanism, and you will not find out for months.",
    numbers: [
      "~1M msgs/s peak against a 1M to 5M sequencer ceiling",
      "single-digit μs in the engine, 10 to 100μs gateway to ack",
      "~10k symbols x ~2MB book state = ~20GB total",
    ],
  },
  nodes: [
    {
      id: "core-group",
      label: "Deterministic core: pinned cores, no allocation",
      kind: "zone",
      detail: {
        what: "The sequenced input log plus everything that is a pure function of it: the sequencer, the per-symbol matching engines and their in-memory books.",
        why: "Drawn as one zone because determinism is a property of the boundary, not of any single box. Inside it there is no clock, no randomness, no allocator influence and no external lookup, which is exactly what makes replay, standby failover and forensic reconstruction the same operation.",
        numbers: ["timers arrive as sequenced ticks every ~100μs", "reference data changes only by sequenced control message"],
        breaks:
          "One `now()` call or one config push that bypasses the log makes the core impure, and the failure is invisible until a replay months later disagrees with the day it is supposed to reproduce.",
      },
    },
    {
      id: "member-firms",
      label: "Member firms",
      sub: "banks, brokers, their routers",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The banks and brokers connected to the venue, sending new, cancel and modify messages over a binary session protocol.",
        why: "Drawn explicitly because they set the constraints the rest of the design answers to: the arrival rate at the open, the order-to-trade ratio, and the multi-leg trades this venue deliberately does not support natively.",
        numbers: ["~4B inbound msgs/day", "~80B binary frame per message", "40 inbound messages per executed trade"],
        breaks:
          "One hostile or broken firm sending malformed orders, refusing to consume execution reports or holding TCP windows open backs up gateway send queues and can affect other firms on shared infrastructure.",
      },
    },
    {
      id: "gateway",
      label: "Order gateway",
      sub: "decode, auth, pre-trade risk",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The entry point per member firm: wire-format decode, authentication, syntax validation and the 15c3-5 style pre-trade risk checks of max size, max notional, buying power and kill switch.",
        why: "Risk lives here, above the sequencer, because a rejected order must never enter the official record. Put it inside the engine and the input log contains messages that were never real trades, and the engine acquires a reason to un-match, which nothing downstream can survive.",
        numbers: ["10 to 100μs gateway to ack end to end", "kill switch cuts a firm in milliseconds", "per-firm quotas on rate, open orders and unread acks"],
        breaks:
          "Risk failing open. Bad orders reach the sequencer and are now part of the record, which is why the reject counter dropping to zero is a page and the system fails closed when the risk state is unhealthy.",
        choice: {
          pick: "FPGA for wire decode and the static risk checks, CPU for everything that changes",
          instead: "Decode and risk entirely on the CPU behind a kernel-bypass NIC.",
          decider:
            "How often the logic changes against what hardware buys. A wire format is fixed by specification and moves on a multi-year cycle, and hardware decode saves ~3μs on a 10 to 100μs budget, so it belongs in the FPGA. Max order size and max notional are equally static. Anything that reads mutable per-firm position stays on the CPU.",
          flips:
            "A venue whose risk rules are as static as its wire format, where the whole gate can go in hardware; or a low-rate venue where a few microseconds are irrelevant and one CPU code path is cheaper to operate.",
        },
      },
    },
    {
      id: "risk-state",
      label: "Per-firm risk state",
      sub: "positions, limits, verdict journal",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "Mutable per-firm position and buying-power state held local to the gateway, with every risk verdict journalled to a log separate from the sequenced input log.",
        why: "The verdict has to be recorded because it is the one input to the venue that is not reproducible: risk decisions read state that fills change, so recomputing them at replay time produces different rejects and therefore a different input log. Journalling the decision keeps a venue-level replay faithful.",
        numbers: ["read and updated inside the 10 to 100μs ack budget", "verdict log kept separate from the sequenced input log"],
        breaks:
          "The verdict log is only approximately interleaved with the input log, because rejects must never enter the official record. A faithful replay inherits that imprecision and can no longer answer the counterfactual of whether an order would be rejected under today's rules.",
        choice: {
          pick: "Risk state in gateway process memory, verdicts journalled to a separate log",
          instead: "A shared risk service the gateway calls per order, or recomputing verdicts at replay time.",
          decider:
            "The ack budget. Gateway to ack is 10 to 100μs end to end including the sequencer commit, and a network round trip to a shared service spends most of that before any matching happens. Local state is the only shape that fits, and journalling is what buys back the reproducibility that local mutable state costs you.",
          flips:
            "Firm limits that must be aggregated across gateways in real time, for example a house-wide notional cap, where a shared authority is the only correct answer and the latency has to be paid or the limit has to be split per gateway.",
        },
      },
    },
    {
      id: "sequencer",
      label: "Sequencer",
      sub: "single pinned thread, global seq",
      kind: "service",
      col: 0,
      row: 2,
      parent: "core-group",
      detail: {
        what: "One thread on one isolated core doing exactly three things per message: assign the next sequence number, copy the message into a preallocated slot, publish the slot index to readers.",
        why: "This is the only point in the venue where what happened first is decided, and once decided it is never revisited. It does no parsing and no business logic precisely so that the loop has no data-dependent branch and therefore no data-dependent latency.",
        numbers: ["1M to 5M msgs/s on tuned hardware", "~1M msgs/s peak inbound, 5x headroom", "~150k msgs/s intraday average"],
        breaks:
          "It is the venue-wide throughput ceiling and the single shared component. If it stalls or cannot fsync at line rate, the correct response is to backpressure gateways and fail to the standby, never to let matching proceed without a durable sequence assignment.",
        choice: {
          pick: "One global sequencer thread linearising every message, with a synchronous hot replica in the same rack",
          instead: "Shard the sequencer by symbol, each shard assigning its own numbers, with periodic global epoch messages to bound cross-shard skew.",
          decider:
            "Peak inbound against the single-thread ceiling. A tuned sequencer sustains 1M to 5M msgs/s and our peak is ~1M msgs/s, so one thread carries the venue with 5x headroom and there is no reason to buy the cross-symbol ordering loss. Basket trades and ETF arbitrage need that ordering.",
          flips:
            "Sustained peak above ~5M msgs/s, a large crypto or FX venue with thousands of independently active pairs, or a product set with no cross-instrument dependency. Above the ceiling it is the only option, and participants get an epoch-bounded skew of say 50μs instead of a total order.",
        },
      },
    },
    {
      id: "input-log",
      label: "Sequenced input log",
      sub: "mmap append, RDMA replica",
      kind: "queue",
      col: 1,
      row: 2,
      parent: "core-group",
      detail: {
        what: "The append-only memory-mapped journal of every sequenced message. It is the system of record; every other piece of state in the venue is derived from it.",
        why: "A slot is not visible to any engine until it is durable and replicated, because a trade that exists in the market data feed but not in the log cannot be unwound. Committing first means the worst case is an unacknowledged order, which the firm simply retries.",
        numbers: ["5 to 10μs to commit both copies", "~350GB/day raw, ~1TB/day replicated", "~7TB hot on local NVMe at 7-day retention"],
        breaks:
          "Anything that makes a snapshot load-bearing. Snapshots exist only to bound cold-start replay time, and the test is blunt: delete every snapshot and the venue must still reconstruct the day from the log alone.",
        choice: {
          pick: "Memory-mapped append-only log (Aeron Archive or Chronicle Queue) on NVMe, synchronous RDMA replica in the same rack",
          instead: "Kafka or another networked broker as the durable log.",
          decider:
            "Append latency inside the ack budget. Sub-microsecond append plus a 5 to 10μs commit across both copies fits a 10 to 100μs end-to-end path; a broker's millisecond-scale publish is two to three orders of magnitude above it. The log also has to be a shared-memory read for the engines, not a network subscription.",
          flips:
            "Any downstream consumer that is not latency critical, such as the archive, clearing feed or surveillance pipeline, where a broker's fan-out and retention tooling is worth far more than microseconds.",
        },
      },
    },
    {
      id: "matching",
      label: "Matching engines",
      sub: "one single thread per symbol",
      kind: "service",
      col: 0,
      row: 3,
      parent: "core-group",
      detail: {
        what: "One single-threaded engine per symbol, each consuming only its symbol's slice of the sequenced stream and applying the venue's priority rule to produce trades.",
        why: "Single threading is the correctness property, not a speed compromise. Two threads acquiring locks in different orders produce different outcomes on identical input, and a multi-threaded history cannot be replayed deterministically, which takes audit, standby failover and forensics down with it.",
        numbers: ["~500k ops/s per symbol on one core", "tier-1 symbols peak at ~50k/s, 10x headroom", "1 to 5μs tick to trade, single-digit μs inside the engine"],
        breaks:
          "Any unbounded pause on the hot path. A 50ms stop-the-world collection during the open on a tier-1 name is tens of thousands of orders of backlog, and the burst that follows distorts the arrival ordering that price-time priority depends on.",
        choice: {
          pick: "C++ or Rust on a pinned isolated core, every Order, Trade and buffer preallocated into pools at startup",
          instead: "A JVM engine with a low-pause collector, or moving the matching loop itself into an FPGA.",
          decider:
            "Pause behaviour and rule-change frequency. A 50ms collection at the open is an outage and even 1ms is severe against a single-digit μs target, so managed memory on the hot path is out. FPGA matching reaches under 1μs against 1 to 5μs on CPU, but a rule respin is weeks rather than days and a listed venue ships several matching-rule changes a year.",
          flips:
            "A frozen single-product ruleset with a genuine sub-microsecond target, which describes a proprietary venue or an FX ECN, where all-FPGA matching is the right call. If a JVM is mandated, off-heap structures with an enforced zero-allocation check under load.",
        },
      },
    },
    {
      id: "order-book",
      label: "Order book, per symbol",
      sub: "sorted levels, FIFO per level",
      kind: "database",
      col: 1,
      row: 3,
      parent: "core-group",
      detail: {
        what: "In-memory book per symbol: bids highest first, asks lowest first, sorted price levels with a FIFO queue of orders at each level.",
        why: "Price-time priority is a data-structure property here rather than a rule applied on top. Walking levels in order and popping the queue head is the matching algorithm, so the structure has to make the venue's stated priority the only thing it can physically do.",
        numbers: ["O(log P) level lookup, P ~10² to 10³", "~10ns of memory operations per match", "5k to 20k resting orders, ~100B each, ~2MB/symbol"],
        breaks:
          "Any container whose iteration order depends on pointer values or a seed orders fills differently on replay, which is why books use intrusive lists with explicit ordering and never iterate a hash map.",
        choice: {
          pick: "Red-black tree or skip list of price levels with an intrusive FIFO list at each level",
          instead: "A flat array indexed by tick, or a hash map from price to level.",
          decider:
            "Level count against determinism. P is typically hundreds, so O(log P) is ~10ns of memory operations and the tree costs nothing worth optimising away. A hash map is disqualified outright: its iteration order depends on the allocator and a replay would allocate fills differently.",
          flips:
            "A tick-constrained instrument with a hard price band, where a flat array indexed by tick offset is O(1) and cache-friendlier. Note the priority rule itself is a per-symbol config flag read at startup: pro-rata changes the allocation function, not the structure.",
        },
      },
    },
    {
      id: "standby",
      label: "Hot standby",
      sub: "second reader, same binary",
      kind: "service",
      col: 1,
      row: 4,
      detail: {
        what: "A second engine process on another host reading the same log and running the same binary, so it is doing identical work at the same rate rather than receiving state.",
        why: "Because the engine is a pure function of the log, failover has no state-migration step: detect, stop routing to the primary, start routing to the standby. This is the payoff for every determinism constraint imposed on the core.",
        numbers: ["within microseconds of the primary", "sub-second RTO inside the primary site", "failover blocked above a sequence-gap tolerance"],
        breaks:
          "A standby that falls materially behind is worse than no standby, because promoting it loses trades. The sequence-gap metric is the direct failover-readiness signal and it gates promotion.",
        choice: {
          pick: "A second reader of the same input log, running the same binary",
          instead: "State replication from primary to standby, or periodic snapshot shipping.",
          decider:
            "What has to move at failover. Log replay moves nothing, so recovery is a routing change and the gap is measured in microseconds; state replication makes the primary do work proportional to book size (~2MB per symbol) and reintroduces a divergence mode the whole design exists to avoid.",
          flips:
            "A cross-site standby, where the WAN round trip makes lockstep replay impossible. There you accept asynchronous shipping and a published non-zero recovery point objective instead of pretending the standby is current.",
        },
      },
    },
    {
      id: "failover-ctl",
      label: "Failover controller",
      sub: "quorum, fences before promoting",
      kind: "service",
      col: 1,
      row: 5,
      detail: {
        what: "A separate quorum-based controller that detects primary failure, revokes the old primary's ability to publish to the output sequencer, and only then promotes the standby.",
        why: "The takeover is trivial; detection is the entire problem. Two engines that both believe they are primary emit trades against the same sequence numbers with different order ids, and subscribers will have accepted both, which is worse than a halt because there is nothing to unwind to.",
        numbers: ["deliberate sub-second pause while fencing completes", "sub-second RTO within the primary site"],
        breaks:
          "It owns split brain. Fencing that does not actually revoke publish rights, or a quorum small enough to partition, converts a clean sub-second halt into an unrecoverable double-publish.",
        choice: {
          pick: "Quorum controller that fences first, accepting a sub-second halt",
          instead: "Heartbeat-driven automatic promotion by the standby itself.",
          decider:
            "The cost asymmetry between the two errors. One failure mode costs a bounded halt of under 1s, published to participants; the other is two engines emitting trades against the same sequence numbers, with no clean unwind and a 7-year audit trail that disagrees with itself. Buy the pause.",
          flips:
            "Systems whose output is idempotent and deduplicated by the receiver, where an optimistic promote costs a retry rather than a busted trade. Market data is not one of those, because subscribers have already acted on both streams.",
        },
      },
    },
    {
      id: "output-seq",
      label: "Output sequencer",
      sub: "one global stream out",
      kind: "service",
      col: 0,
      row: 4,
      detail: {
        what: "Reassembles the per-symbol output of every engine into one globally sequenced stream of execution reports and book deltas.",
        why: "It exists so subscribers detect a gap by counting rather than by timing out. Waiting for a message that never arrives is unbounded; noticing that sequence 4,271 followed 4,269 is immediate, and it is also the fence point the failover controller revokes.",
        numbers: ["~10M book-update events/s at peak", "~100M trades/day, ~200B per trade report", "~20GB/day of trade reports"],
        breaks:
          "It is a second shared serialisation point after the sequencer, so it inherits the same single-writer ceiling, and any backlog here shows up to participants as market data lag while matching itself looks healthy.",
        choice: {
          pick: "A single output sequencer numbering every outbound message",
          instead: "Each matching engine publishing its own independently numbered feed.",
          decider:
            "How a subscriber discovers loss. With ~10M events/s a dropped packet must be detectable in constant time, and one global counter gives that; per-engine numbering makes a subscriber track ~10k independent sequences and gives no cross-symbol consistency for anyone trading a basket.",
          flips:
            "Feeds partitioned so each subscriber takes exactly one symbol and cross-symbol consistency has no consumer, where per-engine publication removes the shared component entirely.",
        },
      },
    },
    {
      id: "md-publisher",
      label: "Market data publisher",
      sub: "reliable multicast + gap fill",
      kind: "service",
      col: 0,
      row: 5,
      detail: {
        what: "Publishes trade reports and book deltas over reliable multicast, with a dedicated gap-fill channel serving specific sequence ranges from a ring buffer of the last N seconds.",
        why: "One packet on the wire that the network fans out to every subscriber is the only mechanism that gets the same bytes to everyone at the same instant. Fairness here is physical rather than logical, which is the only form of it you can actually demonstrate.",
        numbers: ["~500MB/s peak egress, about 4Gbps", "~50B per book delta, ~10 deltas per aggressive order", "fits one 10GbE feed per channel with gap-fill headroom"],
        breaks:
          "Gap recovery during a fast market. A naive replay request over TCP adds variable latency exactly when it hurts most, so gap fill is rate limited per subscriber and a chronic requester gets a network investigation rather than unlimited retransmission.",
        choice: {
          pick: "Reliable multicast (Aeron, LBM or PIM-SM) with a separate gap-fill channel",
          instead: "TCP unicast fan-out to every subscriber.",
          decider:
            "Egress and simultaneity. At ~500MB/s the publisher would have to send 4Gbps per subscriber under unicast, and it would serialise delivery so whoever is served first has a real advantage. Multicast sends once and the network duplicates, so arrival is simultaneous by construction.",
          flips:
            "Subscribers outside the datacentre, where multicast is not routable and you fall back to TCP or websocket fan-out. Fairness then becomes a legal statement rather than a physical property, which is a different product.",
        },
      },
    },
    {
      id: "subscribers",
      label: "Market data subscribers",
      sub: "same rack, same bytes",
      kind: "external",
      col: 0,
      row: 6,
      detail: {
        what: "Market makers, brokers and vendors consuming the feed on subscriber NICs in the same data centre rack as the publisher.",
        why: "Drawn outside the trust boundary because their behaviour is not ours to control: they decide how fast they consume, whether they request gap fill, and how much of the arms race lands on our edge.",
        numbers: ["cable-length parity inside the co-location facility", "per-subscriber gap-fill rate limits"],
        breaks:
          "Fairness is provable per gateway, not per order. The sequencer's arrival order still encodes which gateway happened to be least loaded at that microsecond, a few hundred nanoseconds to a few microseconds of unobservable jitter, and a sophisticated participant will notice.",
      },
    },
    {
      id: "archive",
      label: "Archive and DR",
      sub: "columnar cold copy, async ship",
      kind: "database",
      col: 1,
      row: 6,
      detail: {
        what: "Asynchronous geographic shipping of the input log plus a compressed columnar archive held for the regulatory retention period.",
        why: "Retention under 17a-4 and CAT is cheap in bytes; the property worth paying for is that the retained artifact stays executable, so why did this trade happen at this price is answered by a rerun rather than by an argument.",
        numbers: ["~35GB/day at ~10x compression", "~62TB over 7 years, call it 100TB with erasure coding", "sub-second DR lag target, alert at 5s"],
        breaks:
          "The recovery point objective is non-zero across regions. On loss of the primary site the venue loses up to the lag window of orders, which is a deliberate trade published to participants rather than an oversight.",
        choice: {
          pick: "Tiered durability: synchronous only within the rack, asynchronous to the DR site",
          instead: "Synchronous replication to the geographic DR site before acknowledging an order.",
          decider:
            "The cross-region round trip is 10s of milliseconds against an engine budget of single-digit μs and a 10 to 100μs end-to-end ack, three orders of magnitude apart. Making every ack wait for it would end the venue's latency proposition to close a lag window already under 1s.",
          flips:
            "A mandate or jurisdiction requiring zero data loss across sites, where the round trip has to be paid and the venue's latency profile is redefined around it rather than optimised.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "member-firms",
      to: "gateway",
      label: "new / cancel / modify",
      animated: true,
      detail: {
        what: "Binary session traffic from member firms arriving on a kernel-bypass NIC: new orders, cancels and modifies.",
        why: "This is the only inbound path, and it is deliberately the noisiest one. Most of these messages are cancels and replaces rather than new orders, which is why the gateway tier is sized on message rate rather than on trade rate.",
        numbers: ["~4B msgs/day", "~1M msgs/s at the open and close", "40 inbound messages per executed trade"],
        breaks:
          "A firm that will not consume its execution reports backs up gateway send queues, so firms are pinned to gateways and quota'd on rate, open orders and unread acks.",
      },
    },
    {
      id: "e2",
      from: "gateway",
      to: "risk-state",
      label: "check + journal verdict",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading per-firm position and buying power to decide the order, and journalling the verdict whichever way it goes.",
        why: "The verdict is recorded rather than recomputed because the state it reads changes with fills. Without the journal, replaying a day against a different risk snapshot produces different rejects and therefore a different input log.",
        numbers: ["inside the 10 to 100μs ack budget", "verdicts kept out of the sequenced log"],
        breaks:
          "Faithful replay and counterfactual replay become two different artifacts here, and you have to pick which one you are building. A journalled verdict cannot answer whether today's rules would have rejected the order.",
      },
    },
    {
      id: "e3",
      from: "gateway",
      to: "sequencer",
      label: "survivors only",
      animated: true,
      detail: {
        what: "Orders that passed authentication, validation and risk being handed to the sequencer. Rejects never travel this arrow.",
        why: "This arrow is the placement decision the whole design turns on. Everything above it exists to keep bad input out of the record; everything below it exists to derive state from the record, and the record must contain no rejects.",
        numbers: ["~1M msgs/s peak crossing this boundary"],
        breaks:
          "If risk fails open, rejects cross here and are now part of the official record, at which point the engine would need a way to un-match, which no downstream consumer can survive.",
      },
    },
    {
      id: "e4",
      from: "sequencer",
      to: "input-log",
      label: "seq + append, commit both",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Assigning the sequence number, copying the message into a preallocated slot, fsyncing to NVMe behind a battery-backed cache and replicating synchronously over RDMA to the second sequencer.",
        why: "Durability before visibility. The slot index is not published to readers until both copies have it, so the worst case at a crash is an order that was never acknowledged rather than a trade that exists everywhere except the record.",
        numbers: ["5 to 10μs to commit both copies", "sub-microsecond append into the mapped slot"],
        breaks:
          "If the sequencer cannot fsync at line rate the correct response is to backpressure gateways, never to publish uncommitted slots to keep the engines fed.",
      },
    },
    {
      id: "e5",
      from: "input-log",
      to: "matching",
      label: "sequenced stream, per symbol",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Each engine reading its own symbol's slice of the committed stream out of shared memory, in strict sequence order.",
        why: "Engines read rather than receive, and that verb is the whole trick. A reader can be duplicated for free, which is why the hot standby is an extra consumer of this same arrow rather than a replica that has to be kept in sync.",
        numbers: ["tier-1 symbols ~50k/s, illiquid names ~10/s", "the AAPL engine never sees GOOG input"],
        breaks:
          "A hot symbol's engine saturating grows its own backlog of sequenced-but-unmatched orders. The per-symbol split contains the blast radius, so only that symbol degrades.",
      },
    },
    {
      id: "e6",
      from: "matching",
      to: "order-book",
      label: "walk levels, pop FIFO",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The match loop itself: while the best opposing price crosses the limit, fill against the head of that level's queue, decrement, remove depleted orders, then rest any remainder at its own price level.",
        why: "The book is drawn as the engine's private state rather than a shared store because it is derived, not durable. Nothing else may read or write it, which is what keeps the engine a pure function of its input.",
        numbers: ["O(log P) lookup plus O(1) FIFO pop", "~10ns of memory operations per match"],
        breaks:
          "A modify is implemented as cancel plus new precisely here, because keeping queue position across a price change would silently break time priority for everyone behind it.",
      },
    },
    {
      id: "e7",
      from: "input-log",
      to: "standby",
      label: "same log, same binary",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 100,
      detail: {
        what: "The standby consuming the identical committed stream on another host, at the same rate as the primary.",
        why: "This is why failover has no state-migration step. The standby is not behind and catching up; it is doing the same work concurrently, so promotion is a routing change rather than a recovery procedure.",
        numbers: ["within microseconds of the primary", "sequence gap is the readiness metric"],
        breaks:
          "If the gap grows past tolerance the standby is no longer promotable, and failover must be blocked rather than attempted, because promoting a lagging standby loses trades.",
      },
    },
    {
      id: "e8",
      from: "failover-ctl",
      to: "matching",
      label: "fence the old primary",
      dashed: true,
      detail: {
        what: "Revoking the suspected-dead primary's ability to publish to the output sequencer, before anything is promoted.",
        why: "Ordering matters more than speed. Fencing first turns the ambiguous case, a primary that is slow rather than dead, into a bounded halt instead of two engines emitting trades against the same sequence numbers.",
        numbers: ["deliberate sub-second pause while fencing completes"],
        breaks:
          "Fencing that does not actually revoke publish rights leaves a split brain that market data subscribers have already accepted, and there is nothing to unwind to.",
      },
    },
    {
      id: "e9",
      from: "failover-ctl",
      to: "standby",
      label: "promote after fence",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Promoting the standby to primary once the old primary is provably fenced, and redirecting gateway routing to it.",
        why: "The takeover itself is trivial because the log is the state. Putting promotion behind a quorum decision rather than a heartbeat is what stops two hosts reaching that conclusion independently.",
        numbers: ["sub-second RTO inside the primary site"],
        breaks:
          "A quorum small enough to partition can promote on both sides, which is exactly the failure the controller exists to prevent.",
      },
    },
    {
      id: "e10",
      from: "matching",
      to: "output-seq",
      label: "fills + book deltas",
      animated: true,
      detail: {
        what: "Execution reports and price-level deltas leaving each per-symbol engine for reassembly into one stream.",
        why: "Output is fanned back in because subscribers need one countable sequence, not ~10k of them. This is also the natural fence point: revoke an engine's right to publish here and it cannot affect the market even if it is still running.",
        numbers: ["~10 price-level deltas per aggressive order", "~10M book-update events/s at peak"],
        breaks:
          "Backlog here is invisible from the matching side. Match latency looks fine while participants see stale market data, so per-symbol backlog and output lag need separate alarms.",
      },
    },
    {
      id: "e11",
      from: "output-seq",
      to: "md-publisher",
      label: "one global sequence",
      animated: true,
      detail: {
        what: "The globally numbered outbound stream handed to the multicast publisher.",
        why: "Numbering happens before publication so that loss detection is a subtraction on the subscriber side. Detecting a gap by counting is immediate; detecting it by timing out is unbounded and useless in a fast market.",
        numbers: ["~500MB/s peak, about 4Gbps"],
        breaks:
          "Renumbering or reordering after this point would defeat the whole mechanism, which is why the publisher is a transport and never a transformer.",
      },
    },
    {
      id: "e12",
      from: "md-publisher",
      to: "subscribers",
      label: "reliable multicast",
      animated: true,
      detail: {
        what: "One packet on the wire, fanned out by the network so every subscriber NIC receives the same bytes at the same instant, plus gap fill on a separate channel.",
        why: "Simultaneity has to be a property of the transport rather than of the publisher's send loop. A unicast loop delivers to somebody first, and at these speeds first is worth money.",
        numbers: ["~50B per delta", "one 10GbE feed per channel with gap-fill headroom"],
        breaks:
          "A lossy subscriber hammering gap fill degrades the publisher for everyone, so recovery is rate limited per subscriber and chronic requesters get investigated rather than served.",
      },
    },
    {
      id: "e13",
      from: "output-seq",
      to: "gateway",
      label: "exec reports, TCP unicast",
      fromSide: "right",
      toSide: "right",
      offset: 200,
      detail: {
        what: "Execution reports and drop copies routed back to the originating member firm over its own TCP session, rather than over the multicast feed.",
        why: "The public feed and a firm's private fills are different products with different privacy and delivery requirements. A firm needs guaranteed, ordered delivery of its own reports, which is a unicast property, not a multicast one.",
        numbers: ["~100M trades/day of reports to route", "part of the 10 to 100μs order-to-ack path"],
        breaks:
          "A firm that stops reading its session backs this path up into gateway send queues, which is the specific reason unread-ack backlog is a quota'd and disconnectable condition.",
      },
    },
    {
      id: "e14",
      from: "input-log",
      to: "archive",
      label: "async ship, 7-year copy",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 260,
      detail: {
        what: "Asynchronous shipping of the committed log to the DR site and to a compressed columnar archive held for the regulatory retention period.",
        why: "It is asynchronous on purpose: making the ack wait for a cross-region round trip would add tens of milliseconds to a microsecond-scale path. The archive matters because replay is a product, used for forensics and for regression-testing rule changes, not only for recovery.",
        numbers: ["~350GB/day raw, ~35GB/day compressed", "sub-second lag target, alert at 5s", "~62TB over 7 years"],
        breaks:
          "Replay reproduces which trades happened and in what order, never how long each took. Latency regressions are invisible to an output diff, so the replay harness has to be paired with a separate benchmark on production-identical hardware.",
      },
    },
  ],
};
