import type { Diagram } from "./types";

export const MATCHING_ENGINE: Diagram = {
  id: "matching-engine",
  title: "Limit Order Book",
  question: "Design a Matching Engine / Limit Order Book",
  sourceId: "patterns",
  itemId: 42,
  overview: {
    shape:
      "This is the inside of the box the exchange design draws as one component: not gateways, risk and market data, but the memory layout of a single book, where a price is an array subscript, a level is a cache line, and every hot operation is O(1).",
    beats: [
      "Start by placing the boundary. The venue question already gives you sequenced events arriving at one single-threaded worker per instrument, so everything above this diagram is settled. What is left is the question that actually gets asked: what is the book made of, and what does one event touch.",
      "Three facts about the traffic decide the layout before any structure is chosen. Nearly every event lands at the best price or one level in from it, cancels outnumber fills by 10 to 20 to one, and an order's whole life is arrival, some partial fills, departure. Nothing in that asks for search.",
      "So the cancel path gets the structure, because it carries roughly 90% of a 2M msg/s peak. The gateway assigns a dense internal id, a flat slot table turns that id into a node with one array load, and an intrusive doubly linked list lets the node unlink itself from the middle of a queue without the container being consulted.",
      "The matching loop itself is a while loop with a min() in it. Read the best-price pointer, subscript the level array, take the FIFO head because that is time priority, fill min(incoming, resting), and stop when the incoming price no longer crosses. A sweep across two levels touches about four cache lines, and on an active symbol they are already in L1.",
      "The order types bend that loop rather than replace it. A limit remainder rests at the tail of its level and becomes new liquidity, market and IOC remainders are cancelled, and FOK is the only genuinely two-pass case because it must confirm the whole quantity is there before printing anything.",
      "The costs are honest and structural. The dense tick array is 486KB per book, which is fine for 500 hot symbols and 4.9GB for all 10,000, so the long tail stays on a tree. And a book cannot be threaded: splitting it reorders fills and destroys time priority, which is a correctness bug rather than a scaling lever.",
    ],
    crux:
      "Every instinct you have about making this faster is wrong in a specific way. You optimise the fill path when cancels are 90% of the traffic, and you reach for threads when a second writer inside one book silently reorders fills and breaks byte-identical replay.",
    numbers: [
      "cancels ~1.875M/s of a 2M msg/s peak",
      "7,600 ticks x 64B = 486KB per book",
      "a two-level sweep touches ~4 cache lines",
    ],
  },
  nodes: [
    {
      id: "book-group",
      label: "The book in memory",
      kind: "zone",
    },
    {
      id: "inbound",
      label: "Per-shard ring buffer",
      sub: "sequenced events, single writer",
      kind: "queue",
      col: 0,
      row: 0,
      detail: {
        what: "The bounded inbound queue for one matching core, holding new orders, cancels and replaces already stamped with a gap-free sequence number.",
        why: "Everything upstream of this box is the venue's problem and is already decided: events arrive totally ordered and routed by hash(instrumentId), so this book has exactly one writer for the life of the process. That single fact is what lets every structure below it be mutated with no synchronisation at all.",
        numbers: ["~2M msg/s venue peak", "200 msg/s per instrument on average", "bounded depth, explicit rejection"],
        breaks:
          "Under burst the queue is the thing that grows without bound if producers outrun the matcher, so it must reject with a busy code rather than silently drop or grow.",
        choice: {
          pick: "A pre-allocated Disruptor-style ring, one per shard, bounded with an explicit rejection policy",
          instead: "An ArrayBlockingQueue or any allocating unbounded queue per worker.",
          decider:
            "Steady-state allocation must be zero. At 2M msg/s an object per event is enough GC churn to blow a 5 to 20 microsecond p99 budget outright, and an unbounded queue converts a burst into unbounded latency instead of a visible rejection.",
          flips: "A low-rate venue where per-event allocation is invisible and the operational simplicity of a standard queue is worth more than the microseconds.",
        },
      },
    },
    {
      id: "dispatch",
      label: "Event dispatch",
      sub: "new / cancel / replace, price to tick",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The fork at the top of the worker loop: convert the price to an integer tick, then send a new order to the matching loop and a cancel straight to the slot table.",
        why: "The two paths have almost nothing in common. A new order arrives carrying its price so it knows exactly which level it belongs to; a cancel arrives carrying only an id and has to find a node that could be anywhere in any level. Separating them here is what lets the cancel path be one load rather than a search.",
        numbers: ["replace = cancel then insert, loses time priority", "integer ticks, never floats"],
        breaks:
          "A floating-point price is the single most common correctness bug in a first implementation: it makes replay diverge on a different CPU or compiler, and divergence in a matching engine is a regulatory incident.",
        choice: {
          pick: "Integer tick prices everywhere, converted once at dispatch",
          instead: "Carrying the decimal price as a double through the book.",
          decider:
            "Bit-identical replay. A $190 equity on a $0.01 tick is the integer 19000 and compares exactly; a double does not, and the same 2M events/s replayed on different hardware must produce byte-identical fills. Integers also make the level lookup a subtraction rather than a comparison.",
          flips: "Nothing here flips it. Even venues that ship a tree instead of an array keep prices as integer ticks, because the determinism argument is independent of the structure.",
        },
      },
    },
    {
      id: "match-loop",
      label: "Matching loop",
      sub: "while crosses: fill min(qty)",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "The inner loop: walk the opposite side from the best price, fill min(incoming, resting) against the oldest order at each level, and stop when the incoming price no longer crosses.",
        why: "This is the part everybody can write, and it is deliberately trivial: a subtraction and a comparison. The arithmetic is trivial precisely because the layout did the work, so the loop never searches, never compares prices in a tree, and never takes a lock. The trade always prints at the resting order's price, which is what makes an aggressive limit a ceiling rather than a bid.",
        numbers: ["typical marketable order touches 1-3 levels", "1-5M matches/s per single-threaded core", "5-20 microsecond wire-to-wire budget"],
        breaks:
          "A single hot symbol is bounded by one core and there is no fix inside this design. A dedicated shard, core pinning and zero allocation together buy maybe 3 to 5 times, not 100.",
        choice: {
          pick: "One thread per book, forever, with throughput coming from sharding across instruments",
          instead: "Parallelising a single book across cores, which is the first thing everyone reaches for.",
          decider:
            "Concurrent matching inside one book reorders fills and destroys time priority, so replay no longer agrees to the byte. You do not need it anyway: one core already does 1-5M matches/s against a 2M msg/s venue-wide peak spread over 16 to 64 shards.",
          flips: "Never for a single book. If one instrument genuinely exceeds a core, the honest answer is to change the product and list it on two independent books, accepting that there is no longer one price-time queue.",
        },
      },
    },
    {
      id: "stp",
      label: "Self-trade prevention",
      sub: "checked before the fill is emitted",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "A participant comparison between the incoming order and the specific resting order about to trade, applying cancel-newest, cancel-resting or decrement-both.",
        why: "It has to sit inside the inner loop because it compares two concrete orders, not two accounts in the abstract. Structurally the interesting part is what the policy does: it removes a resting order from the middle of a price level, which is exactly the operation the intrusive list already makes free.",
        numbers: ["one participant-id comparison per candidate fill", "STP groups, not just accounts"],
        breaks:
          "A spike in trigger rate usually means a misconfigured participant or a probing strategy rather than a bug, so the metric needs a baseline or it pages for the wrong reason.",
        choice: {
          pick: "In-loop check on the two orders, before any fill is emitted",
          instead: "Letting the trade print and busting it afterwards, or screening at the gateway on account pairs.",
          decider:
            "The check is a single id comparison of roughly a nanosecond against a 5 to 20 microsecond budget, so it is free where it belongs. Busting after the fact means un-printing a trade that market data has already published, and a gateway cannot see which specific resting order it will meet.",
          flips: "A venue with no STP rule at all, where the check is pure cost and the participants are expected to manage their own crossing.",
        },
      },
    },
    {
      id: "remainder",
      label: "Remainder handling",
      sub: "LIMIT rests, MARKET / IOC / FOK cancels",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "What happens to unfilled quantity when the loop stops: a limit DAY remainder rests and becomes new liquidity, everything else is cancelled.",
        why: "This is where the order types live, and they bend the loop rather than replace it. Resting is the step that closes the cycle, because today's remainder is the resting liquidity tomorrow's aggressive order fills against, which is also why the book is self-bounding rather than an unbounded queue.",
        numbers: ["FOK is the only two-pass case", "market orders need a collar of N ticks"],
        breaks:
          "A market order with no price collar sweeps a thin book to an absurd print, and the resulting trade is real money that somebody has to unwind.",
        choice: {
          pick: "One matching loop with per-TIF remainder handling, plus a read-only pre-pass for FOK",
          instead: "A separate matcher implementation per order type.",
          decider:
            "Only FOK genuinely needs two passes, and the pre-pass typically accumulates across 1-3 levels before deciding. The two passes are free here because the one thread that owns the book cannot be interrupted, so both observe identical state without any snapshot.",
          flips: "Pro-rata or auction venues, where the uncross really is a second algorithm over the same data and deserves its own implementation.",
        },
      },
    },
    {
      id: "outputs",
      label: "Fills and book deltas out",
      sub: "sequenced reports + latest-wins ticks",
      kind: "queue",
      col: 0,
      row: 2,
      detail: {
        what: "The two output streams: sequenced execution reports to both parties, and top-of-book plus incremental updates to market data subscribers.",
        why: "They are drawn as one box leaving the book but they have opposite consistency needs. An execution report is money and must be gap-detectable and exactly ordered; a market-data tick is a display artefact where only the newest snapshot matters and an intermediate one can be dropped with no loss.",
        numbers: ["125k fills/s at a 15:1 cancel ratio", "thousands of market-data subscribers"],
        breaks:
          "A slow market-data subscriber must never backpressure the matcher. If the publisher cannot conflate, a single lagging consumer starts adding microseconds to every fill in the venue.",
        choice: {
          pick: "Two separate paths: conflated latest-wins snapshot fanout, and a sequenced durable report stream",
          instead: "One reliable ordered stream carrying both.",
          decider:
            "Fanout ratio and tolerance. Reports go to exactly 2 parties per fill at 125k fills/s and must never lose one; ticks go to thousands of subscribers at up to the full tick rate and are worthless once superseded. Forcing the tick stream to be lossless makes the slowest of those thousands set the venue's latency.",
          flips: "A tiny venue with a handful of subscribers, where one stream is simpler and the fanout never justifies a second tier.",
        },
      },
    },
    {
      id: "slot-table",
      label: "Order id slot table",
      sub: "orders[internal_id] -> node",
      kind: "database",
      col: 2,
      row: 0,
      parent: "book-group",
      detail: {
        what: "A flat array sized to the per-session order cap, mapping the dense internal id the gateway assigned at admission straight to the order's node.",
        why: "This exists solely because cancels are the hot path, not the fill path. A cancel arrives with an id and nothing else, so without this table it is a search; with it, the lookup is one predictable array load and the removal is one unlink.",
        numbers: ["~1.875M cancels/s at peak", "~4ns array load vs ~100ns per cache miss", "order record 64-128B"],
        breaks:
          "The dense id space has to be assigned and recycled at the gateway. Externally assigned or sparse ids, such as multi-day GTC orders surviving a restart, need their own map to populate the table and you have paid the hash anyway.",
        choice: {
          pick: "A dense flat slot table keyed by an internal id assigned at the gateway",
          instead: "A hash map from client order id to node, which is what you write first.",
          decider:
            "Cancels are roughly 90% of the 2M msg/s peak, so anything on that path is paid on nine messages in ten. A hash lookup is typically two dependent cache misses at ~100ns against ~4ns for a predictable load, which is 2-4% of a 5 microsecond budget, and its probe length is data-dependent so it shows up as tail variance.",
          flips: "When the id space is external and sparse and you cannot control assignment, at which point the translation table costs you the hash you were trying to avoid.",
        },
      },
    },
    {
      id: "best-ptr",
      label: "Best-price pointer",
      sub: "one per side, nudges inward",
      kind: "database",
      col: 3,
      row: 0,
      parent: "book-group",
      detail: {
        what: "A single index per side holding the current best bid and best ask, advanced by one tick at a time when a level empties.",
        why: "Every event starts here, because nearly all of them land at the touch or one level in from it. Making the best price a pointer read rather than a search is what removes the last comparison from the hot path, and the walk when a level empties reads adjacent memory the prefetcher already has.",
        numbers: ["walk typically crosses 1-2 empty ticks", "best bid < best ask asserted after every apply"],
        breaks:
          "A crossed book left resting, best bid at or above best ask, is a correctness incident rather than a bug: it means a fill was skipped, and the instrument has to be halted and replayed against a reference model.",
        choice: {
          pick: "A moving pointer that nudges inward tick by tick",
          instead: "Re-deriving the best price with a scan, a binary search, or a separate heap of non-empty levels.",
          decider:
            "A binary search over a 7,600-level band is roughly 13 comparisons over cold cache lines, and a heap costs a log-n update on every insert and removal. The nudge is one or two sequential reads that are already in L1 on an active book, and it is paid only when a level actually empties.",
          flips: "Very sparse books where the best price can jump hundreds of empty ticks at a time, which is the same condition that pushes you off the array and onto a tree.",
        },
      },
    },
    {
      id: "level-array",
      label: "Price levels, indexed by tick",
      sub: "levels[(price - band_low) / tick]",
      kind: "database",
      col: 3,
      row: 1,
      parent: "book-group",
      detail: {
        what: "A flat array of level headers, one per tick in the instrument's band, each header being (price_tick, total_qty, head, tail, count) padded to exactly 64 bytes.",
        why: "A price becomes an array subscript, so there is no comparison and no tree walk anywhere in the match. The padding is deliberate rather than wasteful: two adjacent levels sharing a cache line means a write to one invalidates the other, and on a hot book you touch adjacent levels constantly.",
        numbers: ["7,600 ticks for a $190 equity at +/-20%", "7,600 x 64B = 486KB per book", "500 hot symbols = 243MB"],
        breaks:
          "It has no graceful answer to a price move outside its band. A limit-up move or a resumption after a long halt forces a reband, which is exactly the hot-path allocation the rest of the design forbids, so the instrument is paused at the moment volatility is highest.",
        choice: {
          pick: "A flat array of 64B level headers indexed by tick, for the instruments that matter",
          instead: "A sorted map of only the occupied levels, TreeMap<Price, Deque<Order>> or a skip list.",
          decider:
            "The number of ticks in the tradable band. 7,600 levels at 64B is 486KB, cheap enough to hold for the top 500 symbols at 243MB. An option on a $0.0001 tick over a $0 to $500 range is 5,000,000 levels at 320MB per contract, which is not. Rule of thumb: dense under ~100k ticks per book, tree above it.",
          flips: "Wide or sparse tick ranges, or a long tail of thinly traded symbols where most allocated headers would never hold an order. In practice you run both.",
        },
      },
    },
    {
      id: "fifo",
      label: "Intrusive FIFO per level",
      sub: "prev/next on the order record",
      kind: "database",
      col: 2,
      row: 1,
      parent: "book-group",
      detail: {
        what: "The queue of resting orders at one price, as a doubly linked list whose prev and next pointers live on the order record itself rather than in container nodes.",
        why: "Price-time priority falls out of the layout instead of being enforced by a comparator: append at the tail is arrival order, and the head is always the next order to fill. Intrusive rather than wrapped because an order must be able to unlink itself from the middle without the container being involved, which is what a cancel and a self-trade prevention both need.",
        numbers: ["O(1) append, O(1) remove from anywhere", "1e4-1e5 resting orders on a liquid symbol", "~12.8MB per hot book"],
        breaks:
          "Queue position becomes a real economic asset, so any rule that changes it, notably a replace losing time priority, is a product decision participants will litigate rather than an implementation detail.",
        choice: {
          pick: "Intrusive doubly linked list with strict price-time FIFO allocation",
          instead: "An ArrayDeque per level, or pro-rata allocation across the whole level.",
          decider:
            "A deque cannot remove from the middle in O(1), and 1.875M cancels/s do exactly that. Pro-rata is a venue rule rather than an engineering preference, but it costs the loop dearly: a level holding 2,000 resting orders means 2,000 pointer chases per fill instead of 1, plus rounding rules that must replay byte-identically.",
          flips: "Instruments where a few large participants would otherwise monopolise the front of the queue and quoting collapses. Most listed short-term interest-rate futures allocate pro-rata for exactly that reason.",
        },
      },
    },
    {
      id: "tree-tail",
      label: "Tree levels for the tail",
      sub: "TreeMap or skip list, per instrument",
      kind: "database",
      col: 3,
      row: 2,
      detail: {
        what: "The other implementation of the same interface: a sorted map keyed by price allocating only levels that actually hold orders, chosen per instrument at listing time.",
        why: "It is drawn outside the dense book because it is not a fallback you hope never fires, it is what most of the venue's 10,000 instruments actually run. The array buys the last few microseconds for symbols where microseconds are worth paying for; everything else gets correctness by construction and costs nothing when nobody trades it.",
        numbers: ["O(log P) is ~8 comparisons over a few hundred levels", "dense-banding all 10k books = 4.9GB", "structure chosen per instrument at listing"],
        breaks:
          "Two code paths and a structure choice made at listing time. Get the classification wrong and a symbol that becomes hot is stuck on the slow path until it is relisted.",
        choice: {
          pick: "A sorted map or skip list of occupied levels for the long tail",
          instead: "Dense tick arrays for every instrument, one code path everywhere.",
          decider:
            "Memory against occupancy. Dense-banding all 10,000 books costs 10,000 x 486KB = 4.9GB of mostly-empty headers, and an option chain on a $0.0001 tick is 320MB per contract on its own. A tree over a few hundred live levels is ~8 comparisons and allocates only what is used.",
          flips: "A venue listing a handful of dense, heavily traded instruments, where one array-only code path is simpler and the memory never bites.",
        },
      },
    },
    {
      id: "invariants",
      label: "Invariants and shadow model",
      sub: "asserted after every apply",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "Two assertions run inline after each applied event, that the book is not crossed and that quantity is conserved across the fill, plus a slow reference matcher run in shadow on the same input.",
        why: "The failures this design can produce are not crashes, they are quietly wrong trades, and a wrong trade surfaces weeks later as a regulatory incident rather than an alert. The assertions are a handful of comparisons against a 5 to 20 microsecond budget, which makes them cheap enough to leave on in production.",
        numbers: ["a handful of comparisons per apply", "replay must be bit-identical", "zero tolerated sequence gaps"],
        breaks:
          "Neither catches a wrong but self-consistent fill ordering. Only deterministic replay of a captured production log, asserting bit-identical output, closes that gap.",
        choice: {
          pick: "Inline invariant asserts left on in production, plus a continuous shadow comparison against a slow reference matcher",
          instead: "Catching it all offline with replay tests and property-based tests.",
          decider:
            "Detection latency. Replay tests find the bug after the trading day; an inline assert costs a handful of comparisons out of a 5 to 20 microsecond budget and halts the instrument before the next wrong fill prints. The shadow model is the strongest check because it is written to be obviously correct rather than fast.",
          flips: "Nothing sane flips the asserts off. The shadow model is the part you drop first if you cannot afford to maintain two matchers.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "inbound",
      to: "dispatch",
      label: "sequenced, one writer",
      animated: true,
      detail: {
        what: "Ordered events being taken off the ring one at a time by the single thread that owns this instrument's book.",
        why: "This arrow carries the whole safety argument. Nothing below it synchronises on anything, and that is only sound because events are stamped with a gap-free sequence number and routed by hash(instrumentId) to a fixed worker, so a book has exactly one writer for the life of the process.",
        numbers: ["gap-free sequence numbers", "same symbol always the same thread"],
        breaks:
          "A sequence gap or duplicate means the total order is broken, and matching past it would produce output nobody can reproduce. The correct response is to halt ingest, not to skip the gap.",
      },
    },
    {
      id: "e2",
      from: "dispatch",
      to: "slot-table",
      label: "cancel: ~90% of events",
      animated: true,
      detail: {
        what: "A cancel or replace carrying only an order id, resolved to its node by a single array subscript.",
        why: "This is the hot path, and drawing it as the wide arrow is the point of the whole diagram. Cancels outnumber fills 10 to 20 to one, so the design spends its structure here rather than on the matching loop everybody focuses on.",
        numbers: ["~1.875M/s at a 2M msg/s peak", "one subscript, no probe sequence"],
        breaks:
          "A cancel arriving after its order already filled must return TOO_LATE deterministically. That is free here because one thread owns the book, so the two events are already totally ordered and there is no race to lose.",
      },
    },
    {
      id: "e3",
      from: "slot-table",
      to: "fifo",
      tier: "data",
      label: "O(1) unlink from middle",
      offset: 70,
      detail: {
        what: "The node removing itself from its price level's queue using the prev and next pointers it carries.",
        why: "The order is somewhere in the middle of a queue that may hold thousands of entries, and the level header must not have to walk to find it. Because the pointers are on the order record, the removal is two stores and a decrement of the level's total, with the container never consulted.",
        numbers: ["two pointer stores per unlink", "level totals decremented in place"],
        breaks:
          "Forgetting to decrement the level's total_qty or count leaves a phantom size in published market data long after the order has gone, which is invisible until somebody trades against depth that does not exist.",
      },
    },
    {
      id: "e4",
      from: "dispatch",
      to: "match-loop",
      label: "new order: match",
      animated: true,
      detail: {
        what: "A new order entering the matching loop, already converted to an integer tick and knowing which side it will walk.",
        why: "A new order is the easy direction: it arrives carrying its price, so it goes straight to a known level with no lookup at all. The loop's only job is to decide how much of it trades before it either rests or is cancelled.",
        numbers: ["125k fills/s against 1.875M cancels/s"],
        breaks:
          "Validation has to have happened upstream. An order with an out-of-band price or a tick that does not exist in this instrument's array is an out-of-bounds access in the hottest loop in the venue.",
      },
    },
    {
      id: "e5",
      from: "match-loop",
      to: "best-ptr",
      label: "best opposite price",
      animated: true,
      detail: {
        what: "The loop reading where the opposite side currently starts, to test whether the incoming order crosses at all.",
        why: "This is the first read of every match and the reason the pointer exists. crosses(buy, ask) is buy.price >= ask_price, one comparison against a value already in a register, so an order that does not cross costs almost nothing before it goes off to rest.",
        numbers: ["one comparison to decide crossing"],
        breaks:
          "If the pointer is stale after a level emptied, the loop tries to fill against an empty level and either spins or, worse, leaves the book crossed.",
      },
    },
    {
      id: "e6",
      from: "best-ptr",
      to: "level-array",
      label: "tick subscript, no search",
      animated: true,
      detail: {
        what: "Turning the best price into a level header with one subtraction and one array index.",
        why: "This is the arrow the whole layout exists to make cheap. In a tree this hop is a walk of eight or more comparisons across pointer-chased nodes; here it is arithmetic, and the header it lands on is a single cache line that is already resident on an active symbol.",
        numbers: ["levels[(price - band_low) / tick_size]", "one 64B cache line per level"],
        breaks:
          "The subscript is unchecked on the hot path by design, so a price outside the band is memory corruption rather than an exception. The band check belongs upstream at validation.",
      },
    },
    {
      id: "e7",
      from: "level-array",
      to: "fifo",
      label: "head = oldest resting",
      animated: true,
      detail: {
        what: "Following the level header's head pointer to the oldest resting order at that price, which is the next one to fill.",
        why: "Time priority is not enforced by any comparator, it is just which end of the list you read from. Filling from the head and appending at the tail is the entire implementation of price-time priority, which is why the tie-break is unambiguous on replay.",
        numbers: ["FIFO head is always the next fill", "~4 cache lines for a two-level sweep"],
        breaks:
          "Pro-rata allocation replaces this single dereference with a walk of every order at the level, so a level of 2,000 orders costs 2,000 chases per fill instead of one.",
      },
    },
    {
      id: "e8",
      from: "fifo",
      to: "stp",
      label: "incoming vs resting head",
      detail: {
        what: "The two concrete orders about to trade being handed to the self-trade check.",
        why: "The check needs both specific orders, not just their accounts, which is why it cannot be hoisted out of the loop or pushed up to the gateway. If it fires, the resting order is removed from the middle of the level, which the intrusive list already makes O(1).",
        numbers: ["one participant-id comparison"],
        breaks:
          "Which policy applies, cancel-newest, cancel-resting or decrement-both, is a venue rule. Hardcoding one makes the engine wrong for the next instrument rather than subtly slow.",
      },
    },
    {
      id: "e9",
      from: "stp",
      to: "outputs",
      label: "fill at the resting price",
      animated: true,
      detail: {
        what: "An execution report per fill to both parties, plus the resulting change to the published top of book.",
        why: "The trade prints at the resting order's price and never the incoming one, which is what makes an aggressive limit a price ceiling rather than a bid. Both sides get a report because a fill is two obligations, and the maker and taker flags are what the clearing side downstream bills from.",
        numbers: ["125k fills/s at a 15:1 cancel ratio", "two reports per fill"],
        breaks:
          "Quantity must be conserved across the fill: what left the incoming order must equal what left the resting one. Anything else is money invented or destroyed and is caught by the invariant, not by a test.",
      },
    },
    {
      id: "e10",
      from: "match-loop",
      to: "remainder",
      label: "no longer crosses",
      detail: {
        what: "The exit from the loop, taken when the incoming order is exhausted or the next opposite level is no longer crossable.",
        why: "The loop deliberately knows nothing about order types; it stops on a price condition and hands whatever is left to the code that does. That separation is why adding IOC or FOK does not touch the matching code at all.",
        numbers: ["loop exits after 1-3 levels typically"],
        breaks:
          "Exiting with quantity remaining while the book still crosses is the crossed-book failure. Asserting best_bid < best_ask right here is what catches it in the same event rather than in the next audit.",
      },
    },
    {
      id: "e11",
      from: "remainder",
      to: "fifo",
      label: "rest: append at tail",
      animated: true,
      detail: {
        what: "A limit DAY remainder being appended to the tail of its own side's level, and registered in the slot table so it can later be cancelled.",
        why: "This arrow is what makes the system a book rather than a filter: the remainder becomes the liquidity the next aggressive order fills against. Appending at the tail rather than anywhere else is the whole of time priority for that order's life.",
        numbers: ["1e4-1e5 resting orders on a liquid symbol", "64-128B per order record"],
        breaks:
          "This is the only path that grows the book, and it is bounded because every resting order leaves on fill, cancel or expiry. Without per-participant order caps, one account can still inflate it deliberately.",
      },
    },
    {
      id: "e12",
      from: "remainder",
      to: "outputs",
      label: "IOC / FOK / market: cancel",
      detail: {
        what: "The cancel-remainder path: an acknowledgement that the unfilled quantity is gone rather than resting.",
        why: "Market, IOC and FOK have no price to rest at or no mandate to rest, so their leftovers are cancelled immediately. The client has to be told, in sequence, because the difference between resting and cancelled determines whether they need to send another order.",
        numbers: ["FOK rejects with zero fills if the pre-pass fails"],
        breaks:
          "A market order that swept a thin book emits a chain of fills at progressively worse prices before this point. The collar, not this arrow, is what prevents that.",
      },
    },
    {
      id: "e13",
      from: "level-array",
      to: "tree-tail",
      label: "sparse or wide tick bands",
      dashed: true,
      detail: {
        what: "The structure choice, made per instrument at listing time from its tick size and price band rather than at runtime.",
        why: "It is drawn as a control path because nothing flows along it during trading. It is the decision that says which implementation this instrument's book is, and real venues run both: dense bands for a hot list of a few hundred symbols, trees for the long tail.",
        numbers: ["dense under ~100k ticks per book", "10,000 dense books would cost 4.9GB"],
        breaks:
          "The decision is static. A symbol that becomes hot after listing keeps the slower structure, and a price move outside a dense band forces a halt to reband rather than a live switch.",
      },
    },
    {
      id: "e14",
      from: "fifo",
      to: "outputs",
      label: "ack or TOO_LATE",
      detail: {
        what: "The cancel path's own output: CANCELLED if the order was still resting, TOO_LATE if it had already filled, UNKNOWN if the id was never live.",
        why: "Nine events in ten end here rather than in a fill, so this is the reply the venue actually spends its time producing. The three-way answer matters to participants because TOO_LATE means they now hold a position they were trying to avoid.",
        numbers: ["~1.875M cancel replies/s at peak"],
        breaks:
          "The answer must be deterministic on replay. It is, because the cancel and the fill were already ordered by the sequencer, so there is no race whose outcome could differ the second time.",
      },
    },
    {
      id: "e15",
      from: "outputs",
      to: "invariants",
      label: "after each apply",
      dashed: true,
      detail: {
        what: "The post-apply check: assert the book is not crossed and quantity is conserved, and feed the same event to a shadow reference matcher.",
        why: "This class of bug does not crash anything. It leaves a slightly wrong book that keeps trading, so the only way to catch it in time is to check the invariants on the same event that broke them rather than in a nightly job.",
        numbers: ["a handful of comparisons per apply", "shadow model runs on identical input"],
        breaks:
          "A failed invariant is a correctness incident, not a retryable error. The response is to halt the instrument, snapshot, and replay against the reference model, which is deliberately more disruptive than continuing.",
      },
    },
  ],
};
