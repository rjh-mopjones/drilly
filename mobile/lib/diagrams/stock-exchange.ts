import type { Diagram } from "./types";

export const STOCK_EXCHANGE: Diagram = {
  id: "stock-exchange",
  title: "Stock Exchange",
  question: "Design a Stock Exchange (Matching Engine)",
  sourceId: "patterns",
  itemId: 25,
  overview: {
    shape:
      "A venue is a machine for a verifiable total order: one thread decides what happened first, a log records it, and everything else replays from that log.",
    forces: [
      {
        constraint: "~1M msgs/s peak against a single thread's 1M to 5M msgs/s ceiling",
        decision: "Put the ordering point in one pinned thread, the Sequencer, and accept a venue-wide ceiling of one core",
        lights: ["sequencer", "core-group"],
      },
      {
        constraint: "~4B messages/day would become permanent the instant they reached the Sequencer, and none can be un-matched",
        decision: "Pre-trade risk runs above the Sequencer, in the Order gateway and Per-firm risk state, so only survivors get sequenced",
        lights: ["gateway", "risk-state", "sequencer", "e2", "e3"],
      },
      {
        constraint: "5 to 10μs separates a slot's append from its replication, and a crash inside that window must not lose a trade",
        decision: "The Sequencer commits a slot to the Sequenced input log, on both copies, before any Matching engine can read it",
        lights: ["sequencer", "input-log", "matching", "e4"],
      },
      {
        constraint: "Two threads can lock the same book in a different order and produce different fills from identical input",
        decision: "Each symbol gets one single-threaded Matching engine over its own Order book, so replay is deterministic",
        lights: ["matching", "order-book"],
      },
      {
        constraint: "~10M book-update events/s must reach every subscriber at the same instant, or fairness cannot be proven",
        decision: "One Output sequencer numbers everything, and the Market data publisher sends it once over reliable multicast",
        lights: ["output-seq", "md-publisher", "e11", "e12"],
      },
    ],
    naive: {
      text: "Store the order book as rows in a relational database, one row per resting order, and match inside a transaction: lock the best opposing price level, decrement its quantity, commit. A transaction with a row lock and an fsync'd commit runs at roughly 1,000 to 10,000 operations per second per instrument, because every match pays a disk-durable write. A single tier-1 symbol peaks at ~50,000 orders/s, so the naive design is already an order of magnitude short before matching logic even runs. Concurrent cancels and matches on the same price level also deadlock under two-phase locking, which a real order book hits constantly during a fast market. The Sequencer, the Sequenced input log and the single-threaded Matching engines replace the transaction. Durability moves to an append-only log written once per message, not once per lock, and the book becomes in-memory state, a pure function of that log.",
      lights: ["sequencer", "input-log", "matching", "order-book"],
    },
    beats: [
      {
        text: "The whole design follows from one placement decision: where the sequence number gets assigned. Matching is the easy part. Put the ordering point in a single pinned thread, the Sequencer, and you get an indisputable answer to what happened first, across symbols as well as within one. The cost is a venue-wide ceiling of one core.",
        lights: ["sequencer", "core-group"],
      },
      {
        text: "Risk sits above the Sequencer, never inside the Matching engines. The Order gateway authenticates, decodes and runs pre-trade checks: max size, max notional, buying power and a kill switch, a manual override that instantly stops a firm's traffic. A rejected order must never enter the official record, because the engine must never need to un-match a trade after the fact.",
        lights: ["gateway", "risk-state", "sequencer", "e2", "e3"],
      },
      {
        text: "Durability comes before visibility. A slot is not published to any Matching engine until it is committed to the Sequenced input log and replicated, roughly 5 to 10μs. Reverse those two steps and a crash leaves a trade in the market data feed that is absent from the record.",
        lights: ["sequencer", "input-log", "matching", "e4"],
      },
      {
        text: "Matching engines read the log rather than receive traffic. One single-threaded engine per symbol holds sorted price levels, each with a first-in-first-out queue of orders. Single threading is the correctness property, not a performance compromise: the engine is a pure function of its input. That is what lets the standby be a second reader instead of a replica kept in sync.",
        lights: ["matching", "order-book", "standby", "e5", "e7"],
      },
      {
        text: "Outputs are reassembled by one Output sequencer and leave over reliable multicast, a transport where one packet is duplicated onto every subscriber's wire by the network itself. Every subscriber receives the same bytes at the same instant, and detects a gap by counting a missing sequence number rather than by timing out. Fairness at the edge is physical, not logical, which is the only kind you can actually demonstrate.",
        lights: ["output-seq", "md-publisher", "subscribers", "e11", "e12"],
      },
      {
        text: "The engineering budget goes on jitter, unpredictable variation in how long the same operation takes, not on raw throughput. C++ or Rust, memory pools preallocated at startup, nothing allocating once trading opens, cores isolated from the OS scheduler. A 50ms garbage-collection pause during the open is not a latency regression; it is an outage.",
        lights: ["matching", "core-group"],
      },
      {
        text: "The engine-to-ack budget is 10 to 100μs end to end, covering gateway decode, the risk check, the Sequencer commit and the trip back. Single-digit microseconds of that is spent inside the Matching engine itself. The rest is network and the durability commit, which is why the log's commit latency is the number the whole hot path is sized against.",
        lights: ["gateway", "sequencer", "input-log", "matching", "e2", "e4"],
      },
    ],
    crux: {
      problem:
        "Determinism only holds if the Matching engine reads nothing but its log: no wall clock, no randomness, no allocator-dependent iteration order, no config push that bypasses the log.",
      handled:
        "The Deterministic core zone enforces this as a boundary rule, not a per-engine habit. Reference data changes only through a sequenced control message, and timers arrive as sequenced ticks rather than live clock reads. That is what makes replay, hot standby and forensic reconstruction the same mechanism instead of three that can silently disagree. Break the rule once and you will not find out for months, since a bypassing config push looks identical to a normal one until a disputed trade forces a replay.",
    },
    numbers: [
      {
        value: "~1M msgs/s peak against a 1M to 5M msgs/s sequencer ceiling",
        explain: "A tuned single-threaded sequencer sustains 1M to 5M msgs/s; the venue's ~1M msgs/s peak inbound leaves roughly 5x headroom on the one component nothing can be sharded across.",
      },
      {
        value: "single-digit μs in the engine, 10 to 100μs gateway to ack",
        explain: "The match itself is ~10ns of memory operations; almost the entire ack budget is the gateway risk check plus the log's 5 to 10μs durable commit, not the matching logic.",
      },
      {
        value: "~10k symbols × ~2MB book state = ~20GB total",
        explain: "Each symbol holds 5k to 20k resting orders at ~100B each; multiplied across roughly 10,000 listed symbols the entire venue's live book state fits in ~20GB of RAM.",
      },
    ],
  },
  nodes: [
    {
      id: "core-group",
      label: "Deterministic core: pinned cores, no allocation",
      kind: "zone",
      detail: {
        what: "The Sequenced input log plus everything that is a pure function of it: the Sequencer, the per-symbol Matching engines and their in-memory order books.",
        why: "Determinism is a property of a boundary, not of any single box. Inside it there is no clock, no randomness and no allocator influence, and reference data changes only by a sequenced control message rather than a live lookup. That is what makes replay, standby failover and forensic reconstruction the same operation instead of three that can drift apart.",
        numbers: [
          { value: "timers arrive as sequenced ticks every ~100μs", explain: "Even wall-clock time enters as a message through the log, so an engine's notion of \"now\" replays identically instead of depending on the machine it runs on." },
          { value: "0 wall-clock reads permitted inside the boundary", explain: "A hard rule, not a target: one direct clock read inside the zone is enough to make replay disagree with the day it reproduces." },
        ],
        breaks: {
          failure: "One `now()` call, or one config push that bypasses the log, makes the core impure. The failure is invisible until a replay months later disagrees with the day it should reproduce.",
          handled: "Builds are linted to reject direct time and randomness calls inside the zone's source tree. Every config change must arrive as a sequenced message, so it appears in the log that replay reads.",
        },
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
        why: "Drawn explicitly because they set the constraints the rest of the design answers to. That includes the arrival rate at the open, the ratio of orders to trades, and the multi-leg trades this venue does not support natively.",
        numbers: [
          { value: "~4B inbound msgs/day", explain: "Sustained across a trading day, dominated by cancels and replaces rather than new orders." },
          { value: "~80B binary frame per message", explain: "A fixed-width wire format chosen so decode cost is constant and predictable per message." },
          { value: "40 inbound messages per executed trade", explain: "Most traffic is cancel and modify chatter around an order before it ever fills, which is why the gateway is sized on message rate, not trade rate." },
        ],
        breaks: {
          failure: "One hostile or broken firm sending malformed orders, refusing to consume execution reports, or holding TCP windows open can back up gateway send queues.",
          handled: "Firms are pinned to specific gateways and quota'd on rate, open orders and unread acknowledgements, so one firm's backlog is contained to its own gateway rather than spreading venue-wide.",
        },
      },
    },
    {
      id: "gateway",
      label: "Order gateway",
      sub: "decode, auth, pre-trade risk",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The entry point per member firm: wire-format decode, authentication, syntax validation and pre-trade risk checks of max size, max notional, buying power and a kill switch.",
        why: "Risk lives here, above the Sequencer, because a rejected order must never enter the official record. Put it inside the engine instead and the log would contain messages that were never real trades. The engine would then need a reason to un-match, which nothing downstream can survive.",
        numbers: [
          { value: "10 to 100μs gateway to ack end to end", explain: "The whole round trip: decode, risk check, sequencer commit, and the acknowledgement back to the firm." },
          { value: "kill switch takes effect on the next message, under 100μs", explain: "A manual override that stops a firm's traffic; because it is checked per message rather than polled, its latency is the same as one ordinary ack." },
          { value: "3 per-firm quotas: rate, open orders, unread acks", explain: "The three counters that let a gateway throttle or disconnect a misbehaving firm without touching anyone else's traffic." },
        ],
        breaks: {
          failure: "Risk failing open: a bad order reaches the Sequencer and becomes part of the permanent record, which nothing downstream can undo.",
          handled: "The reject counter dropping to zero pages on-call, and the gateway fails closed whenever its risk state is unhealthy, refusing new orders rather than guessing.",
        },
        choice: {
          pick: "FPGA for wire decode and the static risk checks, CPU for everything that changes",
          instead: "Decode and risk entirely on the CPU behind a kernel-bypass NIC, a network card that skips the operating system's stack to shave microseconds.",
          decider:
            "How often the logic changes against what hardware buys. A wire format is fixed by specification and moves on a multi-year cycle. Hardware decode saves ~3μs on a 10 to 100μs budget, so it belongs in the FPGA, a chip reprogrammed for a fixed task rather than running general code. Max order size and max notional are equally static; anything reading mutable per-firm position stays on the CPU.",
          flips:
            "A venue whose risk rules are as static as its wire format, where the whole gate can go in hardware. Or a low-rate venue where a few microseconds are irrelevant and one CPU code path is cheaper to operate.",
        },
      },
    },
    {
      id: "risk-state",
      label: "Per-firm risk state",
      sub: "positions, limits, verdict journal",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "Mutable per-firm position and buying-power state held local to the gateway, with every risk verdict journalled to a log separate from the sequenced input log.",
        why: "The verdict is recorded because it is not reproducible: risk decisions read state that changes with fills. Recomputing them at replay time would produce different rejects and therefore a different input log. Journalling the decision keeps a venue-level replay faithful.",
        numbers: [
          { value: "read and updated inside the 10 to 100μs ack budget", explain: "The risk check has to complete inside the same window as the gateway's overall ack latency, since it is on the hot path, not a side lookup." },
          { value: "2 logs kept separate: verdicts and sequenced input", explain: "Verdicts, including rejects, are journalled on their own log because rejects must never appear in the venue's official sequenced record." },
        ],
        breaks: {
          failure: "The verdict log is only approximately interleaved with the sequenced input log, because rejects must never enter the official record.",
          handled: "A faithful replay of the day's actual decisions is possible from the verdict journal. It cannot answer whether today's rules would reject the same order, which needs risk recomputed against a different state snapshot.",
        },
        choice: {
          pick: "Risk state in gateway process memory, verdicts journalled to a separate log",
          instead: "A shared risk service the gateway calls per order, or recomputing verdicts at replay time.",
          decider:
            "The ack budget. Gateway to ack is 10 to 100μs end to end including the Sequencer commit, and a round trip to a shared service spends most of that before matching happens. Local state is the only shape that fits.",
          flips:
            "Firm limits that must be aggregated across gateways in real time, such as a house-wide notional cap. There a shared authority is the only correct answer, and the latency has to be paid or the limit split per gateway.",
        },
      },
    },
    {
      id: "sequencer",
      label: "Sequencer",
      sub: "single pinned thread, global seq",
      kind: "service",
      col: 1,
      row: 1,
      parent: "core-group",
      detail: {
        what: "One thread on one isolated core doing exactly three things per message: assign the next sequence number, copy the message into a preallocated slot, publish the slot index to readers.",
        why: "This is the only point in the venue where what happened first is decided, and once decided it is never revisited. It does no parsing and no business logic, precisely so the loop has no data-dependent branch and therefore no data-dependent latency.",
        numbers: [
          { value: "1M to 5M msgs/s on tuned hardware", explain: "The throughput ceiling of one pinned thread doing only sequence assignment, slot copy and publish; nothing else runs on this core." },
          { value: "~1M msgs/s peak inbound, 5x headroom", explain: "The venue's actual peak sits well inside the sequencer's ceiling, leaving margin for growth without resharding." },
          { value: "~150k msgs/s intraday average", explain: "The open and close dominate; most of the trading day runs at roughly a seventh of peak load." },
        ],
        breaks: {
          failure: "It is the venue-wide throughput ceiling and the single shared component: if it stalls or cannot fsync at line rate, every symbol's ordering stalls with it.",
          handled: "The correct response is to backpressure gateways and fail over to the standby, never to let matching proceed without a durable sequence assignment.",
        },
        choice: {
          pick: "One global sequencer thread linearising every message, with a synchronous hot replica in the same rack",
          instead: "Shard the sequencer by symbol, each shard assigning its own numbers, with periodic global epoch messages to bound cross-shard skew.",
          decider:
            "Peak inbound against the single-thread ceiling. A tuned sequencer sustains 1M to 5M msgs/s and peak is ~1M msgs/s, so one thread carries the venue with 5x headroom. There is no reason to buy the cross-symbol ordering loss that sharding costs, and basket trades and ETF arbitrage need that ordering.",
          flips:
            "Sustained peak above ~5M msgs/s: a large crypto or FX venue with thousands of independently active pairs, or a product set with no cross-instrument dependency. There, participants accept an epoch-bounded skew of roughly 50μs instead of a total order.",
        },
      },
    },
    {
      id: "input-log",
      label: "Sequenced input log",
      kind: "queue",
      col: 2,
      row: 1,
      parent: "core-group",
      sub: "mmap append, RDMA replica, DR ship",
      detail: {
        what: "The append-only memory-mapped journal of every sequenced message. It is the system of record; every other piece of state in the venue is derived from it.",
        why: "A slot is not visible to any engine until it is durable and replicated. A trade that exists in the market data feed but not in the log cannot be unwound. Committing first means the worst case is an unacknowledged order, which the firm simply retries.",
        numbers: [
          { value: "5 to 10μs to commit both copies", explain: "The append plus the synchronous replication of one slot to the mirrored copy over RDMA, direct memory-to-memory transfer between hosts that skips the CPU." },
          { value: "~350GB/day raw, ~1TB/day replicated", explain: "The raw sequenced traffic for a full trading day, tripled by replication and mirroring for durability." },
          { value: "~7TB hot on local NVMe at 7-day retention", explain: "A week of raw log kept on fast local storage so replay and standby catch-up never wait on a network fetch." },
        ],
        breaks: {
          failure: "Anything that makes a snapshot load-bearing rather than an optimisation would defeat the log's purpose as the sole source of truth.",
          handled: "Snapshots exist only to bound cold-start replay time, and the test is blunt: delete every snapshot and the venue must still reconstruct the day from the log alone.",
        },
        choice: {
          pick: "Memory-mapped append-only log (Aeron Archive or Chronicle Queue) on NVMe, synchronous RDMA replica in the same rack",
          instead: "Kafka or another networked broker as the durable log.",
          decider:
            "Append latency inside the ack budget. Sub-microsecond append plus a 5 to 10μs commit across both copies fits a 10 to 100μs end-to-end path. A broker's millisecond-scale publish is two to three orders of magnitude above it.",
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
      col: 1,
      row: 2,
      parent: "core-group",
      detail: {
        what: "One single-threaded engine per symbol, each consuming only its symbol's slice of the sequenced stream and applying the venue's priority rule to produce trades.",
        why: "Single threading is the correctness property, not a speed compromise. Two threads acquiring locks in different orders can produce different outcomes on identical input. A multi-threaded history cannot be replayed deterministically, which takes audit, standby failover and forensics down with it.",
        numbers: [
          { value: "~500k ops/s per symbol on one core", explain: "The throughput a single pinned core sustains doing nothing but book updates for one instrument, with no allocation and no lock contention." },
          { value: "tier-1 symbols peak at ~50k/s, 10x headroom", explain: "The busiest listed names run at roughly a tenth of one engine's ceiling, so per-symbol throughput is never the bottleneck." },
          { value: "1 to 5μs tick to trade, single-digit μs inside the engine", explain: "The time from an order landing in the log to a produced trade; almost all of it is the match loop itself, not overhead." },
        ],
        breaks: {
          failure: "Any unbounded pause on the hot path: a 50ms stop-the-world garbage-collection pause during the open on a tier-1 name is tens of thousands of orders of backlog.",
          handled: "The engine runs in a language with no managed heap on the hot path, with every buffer preallocated at startup. The pause class that causes this failure cannot occur by construction.",
        },
        choice: {
          pick: "C++ or Rust on a pinned isolated core, every order, trade and buffer preallocated into pools at startup",
          instead: "A JVM engine with a low-pause collector, or moving the matching loop itself into an FPGA.",
          decider:
            "Pause behaviour and rule-change frequency. A 50ms collection at the open is an outage, and even 1ms is severe against a single-digit μs target, so managed memory on the hot path is out. FPGA matching reaches under 1μs against 1 to 5μs on CPU, but a rule respin takes weeks rather than days.",
          flips:
            "A frozen single-product ruleset with a genuine sub-microsecond target, such as a proprietary venue or an FX ECN, where all-FPGA matching is the right call.",
        },
      },
    },
    {
      id: "order-book",
      label: "Order book, per symbol",
      sub: "sorted levels, FIFO per level",
      kind: "database",
      col: 2,
      row: 2,
      parent: "core-group",
      detail: {
        what: "In-memory book per symbol: bids highest first, asks lowest first, sorted price levels with a first-in-first-out queue of orders at each level.",
        why: "Price-time priority is a data-structure property here rather than a rule applied on top. Walking levels in order and popping the queue head is the matching algorithm, so the structure has to make the venue's stated priority the only thing it can physically do.",
        numbers: [
          { value: "O(log P) level lookup, P ~10² to 10³", explain: "P in the hundreds makes log P a handful of comparisons, ~10ns total — cheap enough that a tree costs nothing worth optimising away against a flat array." },
          { value: "~10ns of memory operations per match", explain: "A level lookup plus a FIFO pop, entirely in cache, with no allocation and no lock." },
          { value: "5k to 20k resting orders, ~100B each, ~2MB/symbol", explain: "The typical live book size per instrument; multiplied across ~10,000 symbols this is the ~20GB total venue book state." },
        ],
        breaks: {
          failure: "Any container whose iteration order depends on pointer values or a random seed orders fills differently on replay, breaking the determinism the whole core depends on.",
          handled: "Books use intrusive lists with an explicit, insertion-order sequence and never iterate a hash map, so the same input always produces the same fill order.",
        },
        choice: {
          pick: "Red-black tree or skip list of price levels with an intrusive FIFO list at each level",
          instead: "A flat array indexed by tick, or a hash map from price to level.",
          decider:
            "Level count against determinism. P is typically hundreds, so O(log P) is ~10ns of memory operations and the tree costs nothing worth optimising away. A hash map is disqualified outright, because its iteration order depends on the allocator and a replay would allocate fills differently.",
          flips:
            "A tick-constrained instrument with a hard price band, where a flat array indexed by tick offset is O(1) and cache-friendlier. The priority rule itself is a per-symbol config flag read at startup, so switching to pro-rata allocation changes the allocation function, not the structure.",
        },
      },
    },
    {
      id: "standby",
      label: "Hot standby",
      sub: "second reader, same binary",
      kind: "service",
      col: 3,
      row: 1,
      detail: {
        what: "A second engine process on another host, reading the same log and running the same binary. It does identical work at the same rate rather than receiving replicated state.",
        why: "Because the engine is a pure function of the log, failover has no state-migration step: detect, stop routing to the primary, start routing to the standby. This is the payoff for every determinism constraint imposed on the core.",
        numbers: [
          { value: "trails the primary by under 5μs", explain: "Both processes read the same committed log at line rate, so the standby's book state is only microseconds behind the primary's at any instant." },
          { value: "RTO under 1s inside the primary site", explain: "Recovery time objective: the target time from detecting a failed primary to the standby serving traffic, dominated by fencing, not by catching up." },
          { value: "failover blocked once the gap exceeds 1ms of lag", explain: "A hard gate: past this threshold the standby is judged too far behind to promote safely, and promotion is refused rather than attempted." },
        ],
        breaks: {
          failure: "A standby that falls materially behind is worse than no standby, because promoting it loses trades that landed only on the primary.",
          handled: "The sequence-gap metric is the direct failover-readiness signal, and it gates promotion: past 1ms of lag the standby cannot be promoted until it catches back up.",
        },
        choice: {
          pick: "A second reader of the same input log, running the same binary",
          instead: "State replication from primary to standby, or periodic snapshot shipping.",
          decider:
            "What has to move at failover. Log replay moves nothing, so recovery is a routing change measured in microseconds. State replication makes the primary do work proportional to book size, ~2MB per symbol, and reintroduces a divergence mode the whole design exists to avoid.",
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
      col: 3,
      row: 2,
      detail: {
        what: "A separate quorum-based controller that detects primary failure, revokes the old primary's ability to publish to the Output sequencer, and only then promotes the standby.",
        why: "The takeover itself is trivial; detection is the entire problem. Two engines that both believe they are primary emit trades against the same sequence numbers with different order ids, and subscribers will have accepted both.",
        numbers: [
          { value: "deliberate pause under 1s while fencing completes", explain: "The controller chooses to halt briefly rather than promote instantly, because fencing the old primary first is what rules out a double publish." },
          { value: "RTO under 1s within the primary site", explain: "The full detect, fence, promote cycle target, dominated by the deliberate fencing pause rather than by any data movement." },
        ],
        breaks: {
          failure: "It owns split brain: fencing that does not actually revoke publish rights, or a quorum small enough to partition, converts a clean sub-second halt into an unrecoverable double-publish.",
          handled: "Promotion requires a quorum decision and confirmed revocation of the old primary's publish rights, so no single host can conclude on its own that it should become primary.",
        },
        choice: {
          pick: "Quorum controller that fences first, accepting a sub-second halt",
          instead: "Heartbeat-driven automatic promotion by the standby itself.",
          decider:
            "The cost asymmetry between the two errors. One failure mode costs a bounded halt of under 1s, published to participants. The other is two engines emitting trades against the same sequence numbers, with no clean unwind and an audit trail that disagrees with itself. Buy the pause.",
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
      col: 1,
      row: 3,
      detail: {
        what: "Reassembles the per-symbol output of every engine into one globally sequenced stream of execution reports and book deltas.",
        why: "It exists so subscribers detect a gap by counting rather than by timing out. Waiting for a message that never arrives is unbounded; noticing that sequence 4,271 followed 4,269 is immediate, and it is also the fence point the failover controller revokes.",
        numbers: [
          { value: "~10M book-update events/s at peak", explain: "The combined rate of price-level changes across every symbol's engine, funnelled through this one reassembly point." },
          { value: "~100M trades/day, ~200B per trade report", explain: "The daily volume of executed trades, each carrying enough fields to reconstruct the execution independently of the book." },
          { value: "~20GB/day of trade reports", explain: "100M trades × ~200B; small next to the ~500MB/s peak egress of book deltas, which dominate output volume." },
        ],
        breaks: {
          failure: "It is a second shared serialisation point after the Sequencer, so it inherits the same single-writer ceiling. Any backlog here shows up as market data lag while matching itself looks healthy.",
          handled: "Output lag and per-symbol matching backlog are alarmed separately, so a healthy Matching engine does not mask a struggling Output sequencer.",
        },
        choice: {
          pick: "A single output sequencer numbering every outbound message",
          instead: "Each matching engine publishing its own independently numbered feed.",
          decider:
            "How a subscriber discovers loss. With ~10M events/s a dropped packet must be detectable in constant time, and one global counter gives that. Per-engine numbering makes a subscriber track ~10k independent sequences with no cross-symbol consistency for a basket trader.",
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
      col: 2,
      row: 3,
      detail: {
        what: "Publishes trade reports and book deltas over reliable multicast, with a dedicated gap-fill channel serving specific sequence ranges from a ring buffer of the last few seconds.",
        why: "One packet on the wire that the network fans out to every subscriber is the only mechanism that gets the same bytes to everyone at the same instant. Fairness here is physical rather than logical, the only form of it you can actually demonstrate.",
        numbers: [
          { value: "~500MB/s peak egress, about 4Gbps", explain: "The publisher's outbound rate at peak, which fits within one high-speed link because multicast sends the data once regardless of subscriber count." },
          { value: "~50B per book delta, ~10 deltas per aggressive order", explain: "One order that crosses several price levels produces several small delta messages rather than one large one." },
          { value: "fits one 10GbE feed per channel with gap-fill headroom", explain: "Peak egress plus retransmission traffic stays comfortably under one 10-gigabit link's capacity per multicast channel." },
        ],
        breaks: {
          failure: "Gap recovery during a fast market: a naive replay request over TCP adds variable latency exactly when it hurts most.",
          handled: "Gap fill is rate limited per subscriber, and a chronic requester gets a network investigation rather than unlimited retransmission, so one struggling subscriber cannot degrade service for everyone else.",
        },
        choice: {
          pick: "Reliable multicast (Aeron, LBM or PIM-SM) with a separate gap-fill channel",
          instead: "TCP unicast fan-out to every subscriber.",
          decider:
            "Egress and simultaneity. At ~500MB/s the publisher would have to send 4Gbps per subscriber under unicast, and it would serialise delivery so whoever is served first has a real advantage. Multicast sends once and the network duplicates, so arrival is simultaneous by construction.",
          flips:
            "Subscribers outside the data centre, where multicast is not routable and you fall back to TCP or websocket fan-out. Fairness then becomes a legal statement rather than a physical property, a different product.",
        },
      },
    },
    {
      id: "subscribers",
      label: "Market data subscribers",
      sub: "same rack, same bytes",
      kind: "external",
      col: 3,
      row: 3,
      detail: {
        what: "Market makers, brokers and vendors consuming the feed on subscriber network cards in the same data centre rack as the publisher.",
        why: "Drawn outside the trust boundary because their behaviour is not ours to control. They decide how fast they consume, whether they request gap fill, and how much of the arms race lands on our edge.",
        numbers: [
          { value: "cable-length parity within single-digit metres inside the co-location facility", explain: "Subscribers pay for equal cable runs so no one gets a physical distance advantage inside the same facility." },
          { value: "gap-fill capped at 1 request/s per subscriber", explain: "A per-subscriber ceiling on retransmission requests, so one lossy connection cannot flood the publisher's gap-fill channel." },
        ],
        breaks: {
          failure: "Fairness is provable per gateway, not per order: the Sequencer's arrival order still encodes which gateway happened to be least loaded at that microsecond.",
          handled: "This is disclosed rather than hidden. The residual jitter is a few hundred nanoseconds to a few microseconds, published as a known property of the venue. Eliminating it would mean serialising gateway ingestion, reintroducing the throughput ceiling the gateway tier exists to avoid.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "member-firms",
      to: "gateway",
      tier: "hot",
      step: 1,
      label: "new / cancel / modify",
      detail: {
        what: "Binary session traffic from member firms arriving on a kernel-bypass NIC: new orders, cancels and modifies.",
        why: "This is the only inbound path, and it is deliberately the noisiest one. Most of these messages are cancels and replaces rather than new orders, which is why the gateway tier is sized on message rate rather than on trade rate.",
        numbers: [
          { value: "~4B msgs/day", explain: "The full day's inbound traffic across all connected member firms." },
          { value: "~1M msgs/s at the open and close", explain: "Peak arrival rate, roughly seven times the intraday average." },
          { value: "40 inbound messages per executed trade", explain: "Only 1 in 40 inbound messages is a trade — the other 39 are cancels and modifies that never reach the sequenced record but still cost gateway capacity." },
        ],
        breaks: {
          failure: "A firm that will not consume its execution reports backs up gateway send queues.",
          handled: "Firms are pinned to gateways and quota'd on rate, open orders and unread acks, so a backed-up firm gets throttled or disconnected before it affects anyone else.",
        },
      },
    },
    {
      id: "e2",
      from: "gateway",
      to: "risk-state",
      tier: "control",
      label: "check + journal verdict",
      detail: {
        what: "Reading per-firm position and buying power to decide the order, and journalling the verdict whichever way it goes.",
        why: "The verdict is recorded rather than recomputed because the state it reads changes with fills. Without the journal, replaying a day against a different risk snapshot produces different rejects and therefore a different input log.",
        numbers: [
          { value: "inside the 10 to 100μs ack budget", explain: "The risk check has to finish within the same window as the overall gateway-to-ack latency, since it sits on the hot path." },
          { value: "0 verdicts appear in the sequenced input log", explain: "Rejects are journalled separately and never touch the venue's official record, by design." },
        ],
        breaks: {
          failure: "Faithful replay and counterfactual replay become two different artifacts here, and a journalled verdict cannot answer whether today's rules would have rejected the order.",
          handled: "The design accepts this rather than fixing it: the verdict journal only ever supports replaying what actually happened. Answering the counterfactual would need risk recomputed at replay time against a snapshot, which is exactly the non-reproducibility the journal exists to avoid.",
        },
      },
    },
    {
      id: "e3",
      from: "gateway",
      to: "sequencer",
      tier: "hot",
      step: 2,
      label: "survivors only",
      detail: {
        what: "Orders that passed authentication, validation and risk being handed to the sequencer. Rejects never travel this arrow.",
        why: "This arrow is the placement decision the whole design turns on. Everything above it exists to keep bad input out of the record; everything below it exists to derive state from the record, and the record must contain no rejects.",
        numbers: [{ value: "~1M msgs/s peak crossing this boundary", explain: "Only orders that survived risk reach the sequencer; this is the load the single-thread sequencer ceiling has to absorb." }],
        breaks: {
          failure: "If risk fails open, rejects cross here and become part of the official record. The engine would then need a way to un-match, which no downstream consumer can survive.",
          handled: "The gateway fails closed whenever its risk state is unhealthy, rather than letting orders through unchecked. A reject rate dropping to zero pages on-call as a symptom of the failure mode.",
        },
      },
    },
    {
      id: "e4",
      from: "sequencer",
      to: "input-log",
      tier: "hot",
      step: 3,
      label: "seq + append, commit both",
      detail: {
        what: "Assigning the sequence number, copying the message into a preallocated slot, fsyncing to NVMe behind a battery-backed cache and replicating synchronously over RDMA to the log's mirrored copy.",
        why: "Durability before visibility. The slot index is not published to readers until both copies have it. The worst case at a crash is then an unacknowledged order, not a trade missing from the record.",
        numbers: [
          { value: "5 to 10μs to commit both copies", explain: "The synchronous replication step that both the local and mirrored copy must complete before the slot is visible to any reader." },
          { value: "under 1μs to append into the mapped slot", explain: "The local write alone, before waiting on the mirror; the bulk of the 5 to 10μs is the network round trip to the replica." },
        ],
        breaks: {
          failure: "If the sequencer cannot fsync at line rate, publishing uncommitted slots to keep engines fed would break the durability guarantee.",
          handled: "The correct response is to backpressure gateways instead: slow the intake rather than ever let an engine read a slot that is not yet durable on both copies.",
        },
      },
    },
    {
      id: "e5",
      from: "input-log",
      to: "matching",
      tier: "hot",
      step: 4,
      label: "sequenced stream, per symbol",
      detail: {
        what: "Each engine reading its own symbol's slice of the committed stream out of shared memory, in strict sequence order.",
        why: "Engines read rather than receive, and that verb is the whole trick. A reader can be duplicated for free. That is why the hot standby is an extra consumer of this same arrow, not a replica kept in sync.",
        numbers: [
          { value: "tier-1 symbols ~50k/s, illiquid names ~10/s", explain: "The traffic range one engine's read has to cover; both extremes fit comfortably inside its ~500k ops/s ceiling." },
          { value: "1 symbol per engine, 0 cross-symbol reads", explain: "Each engine's read is filtered to its own symbol, so one symbol's engine never sees another symbol's input at all." },
        ],
        breaks: {
          failure: "A hot symbol's engine saturating grows its own backlog of sequenced-but-unmatched orders.",
          handled: "The per-symbol split contains the blast radius: only that one symbol degrades, since no engine's read depends on another engine keeping up.",
        },
      },
    },
    {
      id: "e6",
      from: "matching",
      to: "order-book",
      tier: "data",
      label: "walk levels, pop FIFO",
      detail: {
        what: "The match loop itself: while the best opposing price crosses the limit, fill against the head of that level's queue. Decrement, remove depleted orders, then rest any remainder at its own price level.",
        why: "The book is the engine's private state rather than a shared store because it is derived, not durable. Nothing else may read or write it, which is what keeps the engine a pure function of its input.",
        numbers: [
          { value: "O(log P) lookup plus O(1) FIFO pop", explain: "One tree lookup to find the price level, then a constant-time pop of the queue head at that level." },
          { value: "~10ns of memory operations per match", explain: "The entire cost of one fill, entirely in cache and lock-free within the single owning thread." },
        ],
        breaks: {
          failure: "A modify is implemented as cancel plus new, precisely here, because keeping queue position across a price change would silently break time priority for everyone behind it.",
          handled: "Treating every modify as an atomic cancel-then-new inside the same match loop iteration guarantees the order re-enters at the back of its new price level. No special-case code path can get this wrong.",
        },
      },
    },
    {
      id: "e7",
      from: "input-log",
      to: "standby",
      tier: "control",
      label: "same log, same binary",
      offset: 100,
      detail: {
        what: "The standby consuming the identical committed stream on another host, at the same rate as the primary.",
        why: "This is why failover has no state-migration step. The standby is not behind and catching up; it is doing the same work concurrently, so promotion is a routing change rather than a recovery procedure.",
        numbers: [
          { value: "trails the primary by under 5μs", explain: "Reading the same log at the same line rate keeps the standby's derived state microseconds, not seconds, behind." },
          { value: "readiness gates at a gap tolerance of 1ms of lag", explain: "The threshold past which the failover controller refuses to promote the standby, because it is judged too far behind." },
        ],
        breaks: {
          failure: "If the gap grows past tolerance the standby is no longer promotable, and failover must be blocked rather than attempted.",
          handled: "Promoting a lagging standby would lose trades that only reached the primary, so the controller checks the gap metric before every promotion and refuses when it exceeds the threshold.",
        },
      },
    },
    {
      id: "e8",
      from: "failover-ctl",
      to: "matching",
      tier: "control",
      label: "fence the old primary",
      detail: {
        what: "Revoking the suspected-dead primary's ability to publish to the output sequencer, before anything is promoted.",
        why: "Ordering matters more than speed. Fencing first turns the ambiguous case, a primary that is slow rather than dead, into a bounded halt instead of two engines emitting trades against the same sequence numbers.",
        numbers: [{ value: "deliberate pause under 1s while fencing completes", explain: "The controller accepts this pause on purpose, because it is the price of ruling out a double publish before promoting." }],
        breaks: {
          failure: "Fencing that does not actually revoke publish rights leaves a split brain that market data subscribers have already accepted, with nothing to unwind to.",
          handled: "Fencing is confirmed, not assumed: the controller waits for acknowledgement that the old primary's publish path is revoked before it proceeds to promotion.",
        },
      },
    },
    {
      id: "e9",
      from: "failover-ctl",
      to: "standby",
      tier: "control",
      label: "promote after fence",
      detail: {
        what: "Promoting the standby to primary once the old primary is provably fenced, and redirecting gateway routing to it.",
        why: "The takeover itself is trivial because the log is the state. Putting promotion behind a quorum decision rather than a heartbeat is what stops two hosts reaching that conclusion independently.",
        numbers: [{ value: "RTO under 1s inside the primary site", explain: "The recovery time objective for the full fence-then-promote sequence within one site." }],
        breaks: {
          failure: "A quorum small enough to partition can promote on both sides, which is exactly the failure the controller exists to prevent.",
          handled: "The quorum size is chosen so no network partition can leave two disjoint groups each believing they hold a majority, which is the standard defence against a promotion race.",
        },
      },
    },
    {
      id: "e10",
      from: "matching",
      to: "output-seq",
      tier: "hot",
      step: 5,
      label: "fills + book deltas",
      detail: {
        what: "Execution reports and price-level deltas leaving each per-symbol engine for reassembly into one stream.",
        why: "Output is fanned back in because subscribers need one countable sequence, not ~10,000 of them. This is also the natural fence point: revoke an engine's right to publish here and it cannot affect the market even if it is still running.",
        numbers: [
          { value: "~10 price-level deltas per aggressive order", explain: "One order crossing several price levels produces several small delta messages on its way out." },
          { value: "~10M book-update events/s at peak", explain: "The combined rate across every symbol's engine feeding into this single reassembly point." },
        ],
        breaks: {
          failure: "Backlog here is invisible from the matching side: match latency looks fine while participants see stale market data.",
          handled: "Per-symbol matching backlog and output lag are alarmed as two separate metrics, so a healthy engine cannot mask a struggling output stage.",
        },
      },
    },
    {
      id: "e11",
      from: "output-seq",
      to: "md-publisher",
      tier: "hot",
      step: 6,
      label: "one global sequence",
      detail: {
        what: "The globally numbered outbound stream handed to the multicast publisher.",
        why: "Numbering happens before publication so that loss detection is a subtraction on the subscriber side. Detecting a gap by counting is immediate; detecting it by timing out is unbounded and useless in a fast market.",
        numbers: [{ value: "~500MB/s peak, about 4Gbps", explain: "~10M book-update events/s × ~50B/delta ≈ 500MB/s — this rate is why the venue publishes one global sequence rather than one stream per symbol." }],
        breaks: {
          failure: "Renumbering or reordering after this point would defeat the whole loss-detection mechanism.",
          handled: "The publisher is built as a pure transport that forwards the numbered stream unchanged, never a transformer, so the sequence numbers subscribers see are exactly the ones assigned here.",
        },
      },
    },
    {
      id: "e12",
      from: "md-publisher",
      to: "subscribers",
      tier: "hot",
      step: 7,
      label: "reliable multicast",
      detail: {
        what: "One packet on the wire, fanned out by the network so every subscriber NIC receives the same bytes at the same instant, plus gap fill on a separate channel.",
        why: "Simultaneity has to be a property of the transport rather than of the publisher's send loop. A unicast loop delivers to somebody first, and at these speeds first is worth money.",
        numbers: [
          { value: "~50B per delta", explain: "×~10M events/s ≈ 500MB/s, ~4Gbps — comfortably inside the single 10GbE feed with gap-fill headroom the next number reserves for this channel." },
          { value: "one 10GbE feed per channel with gap-fill headroom", explain: "Peak egress plus retransmission traffic stays inside a single 10-gigabit link per channel." },
        ],
        breaks: {
          failure: "A lossy subscriber hammering gap fill degrades the publisher for everyone.",
          handled: "Recovery is rate limited per subscriber, and chronic requesters get investigated rather than served unlimited retransmission, so one bad connection cannot starve the channel.",
        },
      },
    },
    {
      id: "e13",
      from: "output-seq",
      to: "gateway",
      tier: "data",
      label: "exec reports, TCP unicast",
      offset: 200,
      detail: {
        what: "Execution reports and drop copies routed back to the originating member firm over its own TCP session, rather than over the multicast feed.",
        why: "The public feed and a firm's private fills are different products with different privacy and delivery requirements. A firm needs guaranteed, ordered delivery of its own reports, which is a unicast property, not a multicast one.",
        numbers: [{ value: "~100M trades/day of reports to route", explain: "Every executed trade generates a report routed back to its originating firm over this path." }],
        breaks: {
          failure: "A firm that stops reading its session backs this path up into gateway send queues.",
          handled: "Unread-ack backlog is one of the three per-firm quotas, so a firm ignoring its execution reports gets throttled or disconnected before its backlog affects the gateway.",
        },
      },
    },
  ],
};
