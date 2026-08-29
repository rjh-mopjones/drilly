import type { Diagram } from "./types";

export const HOTEL_RESERVATION: Diagram = {
  id: "hotel-reservation",
  title: "Hotel Reservation",
  question: "Design a Hotel Reservation System",
  sourceId: "patterns",
  itemId: 19,
  overview: {
    shape:
      "Two subsystems with opposite needs: a search index allowed to be seconds wrong, and one counter per room-night that is not, wrapped in a saga since payment is too slow.",
    forces: [
      {
        constraint: "43M searches/day against 1M bookings is a ~400:1 read-to-write ratio once detail and calendar views are counted",
        decision: "Search reads a denormalised Search index kept seconds behind by change capture, never the live inventory rows",
        lights: ["search-svc", "search-index", "cdc"],
      },
      {
        constraint: "1M bookings/day touching 182.5B inventory rows means the mean row is touched once every ~57,000 days",
        decision: "Inventory rows use one conditional update per stay, locks held only ~2ms, rather than a queue or serialiser",
        lights: ["inventory-svc", "inventory-table", "e10"],
      },
      {
        constraint: "Card authorisation takes 200ms in the good case and 30 seconds in the bad one",
        decision: "Payment sits outside the inventory transaction, coordinated by a Saga orchestrator with compensating steps",
        lights: ["bk-saga", "payment", "e12"],
      },
      {
        constraint: "1M bookings/day means a retried POST after a dropped connection is the commonest source of duplicates",
        decision: "Every write takes an idempotency key stored under a unique constraint in Idempotency keys, not just a cache",
        lights: ["bk-dedupe", "idem-table", "e6"],
      },
      {
        constraint: "Allowance is a business parameter rewritten nightly with a 5 to 15 percent oversell, by a job that never reads sold",
        decision: "Inventory rows split sold and allowance into separate columns with separate owners",
        lights: ["inventory-table"],
      },
    ],
    naive: {
      text: "Give every physical room its own row and its own status, and lock that row whenever a booking or a nightly forecast job needs to touch it. Nobody actually books room 412, they book a standard king on the 14th. A per-unit calendar has to pick an arbitrary room at booking time instead of tracking a count. A forecast job rewriting availability and a booking incrementing it would then have to read each other's value to decide what to write. That read-modify-write race gets worse exactly when both run most often, at 02:00 across a whole chain. The Inventory rows design instead counts sold against allowance per (hotel, room_type, date), with the two counters owned by two writers that never read each other.",
      lights: ["inventory-table"],
    },
    beats: [
      {
        text: "Discovery and commitment are separated on purpose. Search reads a denormalised index of hotel documents with cached price ranges and coarse availability, refreshed from the transactional store by change capture and running a few seconds behind. That staleness is free, because the booking path re-checks against the authoritative rows and a stale hit costs one no-availability response.",
        lights: ["search-svc", "search-index", "cdc", "e-search-query", "e18"],
      },
      {
        text: "The whole write path hangs off one row shape: (hotel_id, room_type, date) holding sold and allowance. Nobody books room 412, they book a standard king on the 14th, so the state is a count rather than a per-unit calendar. A three-night stay touches three rows that must all move or none.",
        lights: ["inventory-table"],
      },
      {
        text: "The reservation is a single conditional update that increments sold on every night of the stay where sold is still under allowance, and returns the rows it changed. Fewer rows back than nights means roll the whole stay back. Check and write collapse into one statement, so the row locks live for about 2ms with no application hop inside them.",
        lights: ["inventory-svc", "inventory-table", "e10"],
      },
      {
        text: "Payment sits outside that transaction because authorisation takes 200ms in the good case and 30 seconds in the bad one. Inventory commits first with the booking marked as reserved. A saga then authorises the card, confirms and fans out notifications, with compensations keyed to (booking_id, step_id) and a sweeper that releases anything still reserved after 10 minutes.",
        lights: ["bk-saga", "payment", "bookings-table", "recovery-svc", "e12", "e13", "e21"],
      },
      {
        text: "Every write entry point takes an idempotency key stored under a unique constraint in the database. A retried POST after a dropped connection is the commonest source of duplicate bookings in production. A cache in front is a fast path only: a design whose dedupe store can lose data has a probability, not a guarantee.",
        lights: ["bk-dedupe", "idem-table", "e6"],
      },
      {
        text: "The ceiling the transaction enforces is not the room count. A nightly forecast job writes allowance as physical capacity plus a deliberate 5 to 15 percent oversell, and the booking path enforces it exactly while knowing nothing about the forecast. Separate columns with separate owners is what stops the two writers racing.",
        lights: ["inventory-table"],
      },
    ],
    crux: {
      problem:
        "The interesting number here is not QPS. At 1M bookings a day touching 182.5B inventory rows, the average row is touched once every ~57,000 days, so contention is a tail phenomenon and the database alone is enough.",
      handled:
        "The hard part is that the ceiling on the counter is a business parameter somebody else owns. The transactional path must enforce sold < allowance exactly, while a nightly forecast job rewrites allowance underneath it. Splitting the row into two independently owned columns is what stops the two writers racing, since neither has to read the other's value to write its own.",
    },
    numbers: [
      {
        value: "~1.75 x 10^-5 decrements per row per day",
        explain: "The mean contention rate on a single inventory row; low enough that a plain conditional update beats any queue or serialiser.",
      },
      {
        value: "~2ms locks, ~500 attempts/s per row",
        explain: "The lock hold time of one conditional update and the per-row throughput ceiling that follows from it.",
      },
      {
        value: "120 physical rooms sold as 131",
        explain: "A concrete oversell example: the forecast job's deliberate margin between physical capacity and the allowance the booking path enforces.",
      },
      {
        value: "3.2M room-night decrements/day",
        explain: "The total write volume across every inventory row, small enough that one Postgres shard per hotel absorbs it comfortably.",
      },
      {
        value: "zero bookings above allowance is a hard SLO",
        explain: "The one invariant the whole design bends around. Everything outside the ~2ms transaction is allowed to be stale, retried or late instead.",
      },
    ],
  },
  nodes: [
    // --- frames ---------------------------------------------------------
    {
      id: "booking-svc",
      label: "Booking service",
      sub: "one deployable, three stages",
      kind: "serviceGroup",
      col: 1,
      row: 1,
      detail: {
        what: "One service that dedupes the request, prices the stay and then drives the saga. The three stages inside it are stages of a single request, not three deployments.",
        why: "They are one box because there is no network hop between them and no independent scaling story. The same request thread inserts the idempotency key, resolves the rate plan and opens the transaction. Splitting them into peer services would add two hops to a path whose whole design goal is a ~2ms critical section.",
        numbers: [
          { value: "~12 bookings/s average, ~120/s peak", explain: "The request rate this whole service is provisioned for." },
          { value: "p99 under 5s is the SLO", explain: "The end-to-end latency target across all three stages plus the authorisation call." },
          { value: "5 persisted saga transitions", explain: "Each transition durable so a crashed orchestrator resumes from its last written state — why the alert watches the oldest non-terminal saga's age, not a queue depth." },
        ],
        breaks: {
          failure: "It owns the window between a committed decrement and a confirmed booking.",
          handled: "A crash inside that window leaves inventory consumed by a booking nobody is finishing. That is why the alert is the age of the oldest non-terminal saga, rather than a queue depth.",
        },
        choice: {
          pick: "One deployable running dedupe, pricing and saga orchestration as in-process stages",
          instead: "Three peer services, each independently deployed and scaled, talking to each other over the network.",
          decider:
            "The 2ms transaction budget against a network hop. Splitting the three stages into separate services adds 2 network hops inside a path budgeted at a ~2ms critical section, for zero independent-scaling benefit since all three see identical traffic.",
          flips: "When one stage's load genuinely diverges from the others, for example rate resolution becoming expensive enough to need its own fleet. Then the hop cost buys real independent scaling.",
        },
      },
    },
    {
      id: "txn",
      label: "One transaction: locks held ~2ms",
      kind: "zone",
      detail: {
        what: "The only part of the system where being wrong is expensive: the idempotency insert, the conditional decrement and the row it lands on, all committing together.",
        why: "Everything outside this frame is a read path, a downstream effect or a background job, and all of it is allowed to be stale, retried or late. Inside it the invariant is absolute. No booking is ever accepted above the published allowance, and every night of a stay commits or none does.",
        numbers: [
          { value: "locks held ~2ms including commit", explain: "The entire duration a row is unavailable to any other writer." },
          { value: "3.2M room-night decrements/day", explain: "The total write volume flowing through this one invariant, across every hotel." },
          { value: "zero bookings above allowance is a hard SLO", explain: "The one guarantee this frame exists purely to make true." },
        ],
        breaks: {
          failure: "Anything slow that leaks into this frame multiplies lock hold time directly.",
          handled: "One network call inside the transaction drops the per-row ceiling from ~500 attempts/s to about 5/s, which is why payment, notification and the cache are all drawn outside it.",
        },
      },
    },

    // --- discovery ------------------------------------------------------
    {
      id: "client",
      label: "Client",
      sub: "web / app / partner channel",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The browser, app or distribution partner that searches, then posts a booking with a client-generated idempotency key.",
        why: "It is drawn because it owns the retry. A dropped connection on POST /booking is invisible to the user, so the client retries. The key it generates is the only thing that lets the server recognise the second attempt as the same intent.",
        numbers: [
          { value: "43M searches/day against 1M bookings", explain: "The overall look-to-book scale that sets the read tier's sizing." },
          { value: "look-to-book ~2.5%", explain: "The conversion rate from a search to an actual booking." },
          { value: "one key per booking intent", explain: "The rule the client follows: the key is minted once at checkout and resent unchanged on every retry." },
        ],
        breaks: {
          failure: "A client that generates a fresh key per retry defeats the whole dedupe scheme and books the same stay twice.",
          handled: "The key belongs to the user's intent, not to the HTTP attempt, so client code is contractually required to reuse it across retries of the same checkout.",
        },
        choice: {
          pick: "A client-generated UUID minted when the user opens checkout, resent unchanged on every retry",
          instead: "Derive the key server-side from the request body, or let the client mint a new one per attempt.",
          decider:
            "Who can tell two requests apart. Only the client knows that the attempt it never saw a response to and the one it is sending now are the same intent. A server-side hash of the body cannot distinguish an intentional second identical booking from a retry of the first.",
          flips: "Machine channels with an exactly-once transport of their own, where the message id is already stable and a second key is duplicated state.",
        },
      },
    },
    {
      id: "search-svc",
      label: "Search service",
      sub: "geo + date filter, then rank",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "Serves 'Paris, 3 nights, check-in Jan 10' from the read side, returning about 20 results in roughly 50ms.",
        why: "Search and booking have genuinely different consistency requirements, and separating them lets each scale on its own terms. That is across a 400:1 read-to-write ratio, without the read tier ever touching booking throughput.",
        numbers: [
          { value: "~500/s average, ~4k/s peak", explain: "The request rate this service handles at average and peak." },
          { value: "~20 results in ~50ms", explain: "The typical response shape and latency for one query." },
          { value: "hotel-detail and calendar views add ~10x search volume", explain: "Additional read traffic beyond the search query itself, driving the effective 400:1 ratio." },
        ],
        breaks: {
          failure: "It answers 'plausibly available', never 'available'.",
          handled: "Users occasionally click a room that has gone, which is friction rather than a correctness failure. It is the price of never querying inventory from search.",
        },
        choice: {
          pick: "Read a derived index; never read the inventory rows",
          instead: "Query the transactional inventory rows directly, or a read replica of them.",
          decider:
            "The read-to-write ratio. 43M searches against 1M bookings is 43:1, and adding hotel-detail and calendar views at roughly 10x search volume takes the effective load to 400:1. A read tier that touches the write path puts that load on the rows the booking transaction locks.",
          flips: "A small operator where the whole catalogue fits in one database. At 5k partner hotels the numbers land three to four orders of magnitude lower and a second store is pure operational cost.",
        },
      },
    },
    {
      id: "search-index",
      label: "Search index",
      sub: "Elasticsearch, denormalised docs",
      kind: "database",
      col: 0,
      row: 2,
      detail: {
        what: "A denormalised, eventually consistent copy of hotel documents with cached minimum prices and coarse availability, sharded by city, plus a geo index behind 'hotels within 5km'. A Redis query cache keyed on (city, date range, guests) sits in front, holding rendered result pages for 60 seconds.",
        why: "It answers 'plausibly available' cheaply, and the booking path answers the real question authoritatively. It never touches the inventory table, which keeps a 4k/s peak read load off the write path entirely. The query cache absorbs most of that peak first, since the key repeats heavily: Sunday-evening planners search the same twenty cities for the same weekends. Losing the cache costs latency and index load, never correctness.",
        numbers: [
          { value: "5M docs x ~5KB = 25GB primary, ~75GB with replica and analysis", explain: "The index's storage footprint, small enough to serve entirely from memory-backed nodes." },
          { value: "~10GB geo index", explain: "The additional structure that answers proximity queries." },
          { value: "cache: ~70% hit rate, 60s TTL, 4k/s peak in vs ~1.2k/s reaching the index", explain: "How much of peak read traffic the query cache absorbs before the index ever sees it." },
        ],
        breaks: {
          failure: "It is allowed to be wrong and regularly is.",
          handled: "The failure that actually hurts is out-of-order application. Events carry a monotonic log position and documents write idempotently by key, so a slow partition cannot regress a document to an older state.",
        },
        choice: {
          pick: "A separate search index fed by change capture",
          instead: "Read replicas of the transactional store, or querying the inventory rows behind a cache.",
          decider:
            "Query shape as much as load. Free-text, geo and facet queries over 5M documents are not what a relational replica is for. At 400:1 reads to writes the read tier has to scale on its own terms without ever touching booking throughput.",
          flips: "A catalogue small enough to filter in the transactional store. There a second store is an extra pipeline, an extra failure mode and a lag metric to watch for no benefit.",
        },
      },
    },
    {
      id: "cdc",
      label: "Change capture",
      sub: "Debezium off the WAL",
      kind: "queue",
      col: 3,
      row: 2,
      detail: {
        what: "A durable stream of the transactional store's write log, carrying hotel, price and availability changes to be denormalised into search documents.",
        why: "It is the only link between the two halves and it points one way: the transactional store feeds the index, never the reverse. Reading the write log means the index cannot miss a change that a dual write would drop.",
        numbers: [
          { value: "cdc_lag_seconds under 5s p95", explain: "The freshness target this pipeline is held to." },
          { value: "alert on sustained lag above 30s", explain: "The threshold that pages an operator when the pipeline is genuinely falling behind." },
          { value: "chain-wide pushes of 500 hotels are normal", explain: "A routine burst this pipeline has to absorb without falling over." },
        ],
        breaks: {
          failure: "Lag spikes during a chain-wide inventory push, so results go stale and users see occasional NO_AVAILABILITY at the point of booking.",
          handled: "Tailing the log also ties the pipeline to the database's replication slots. A stalled consumer holds WAL on the primary, so a dead reader becomes a disk-space problem on the store it reads from.",
        },
        choice: {
          pick: "Log-based change capture from the database write-ahead log",
          instead: "Dual writes from the booking service, or a periodic full reindex.",
          decider:
            "Dual writes fail independently of the transaction and drop changes silently. A full reindex over 5M documents cannot hold a 5s p95 lag. Reading the log inherits the transaction's own durability for free.",
          flips: "A catalogue that changes rarely, where a nightly rebuild is simpler than operating a streaming pipeline and nobody notices the staleness.",
        },
      },
    },

    // --- booking service stages -----------------------------------------
    {
      id: "bk-dedupe",
      label: "Idempotency check",
      sub: "stage 1",
      kind: "process",
      col: 1,
      row: 1,
      parent: "booking-svc",
      detail: {
        what: "Takes the client's key, inserts it under a unique constraint and, on conflict, returns the booking that already exists instead of starting a second one.",
        why: "A retried POST after a dropped connection is the most common source of duplicate reservations in production. This is the only stage that can tell the difference between a retry and a second booking. The insert commits in the same transaction as the decrement.",
        numbers: [
          { value: "one row per booking attempt", explain: "The write cost this stage adds to every request." },
          { value: "~120 attempts/s at peak", explain: "The peak insert rate this table has to absorb." },
        ],
        breaks: {
          failure: "Returning the existing booking is only correct if the first attempt is finished.",
          handled: "A retry that arrives while the original is still mid-saga must return the in-progress state, rather than a confirmation nobody has earned yet.",
        },
        choice: {
          pick: "Dedupe on the client's key",
          instead: "Dedupe on a natural key: user plus hotel plus date range.",
          decider:
            "Whether a genuine second booking is legal. It is: a family books two rooms of the same type for the same nights in two requests, and a natural key would silently swallow the second one. The client's key distinguishes intent from repetition; a natural key cannot.",
          flips: "Operations that are naturally idempotent, such as cancellation by booking id, where a duplicate is already a no-op and the key earns nothing.",
        },
      },
    },
    {
      id: "bk-rates",
      label: "Rate plan resolver",
      sub: "stage 2",
      kind: "process",
      col: 1,
      row: 1,
      parent: "booking-svc",
      detail: {
        what: "Picks the cheapest legal combination of rate plans across the nights of the stay, as a pure read against a price snapshot, before any lock is taken.",
        why: "Real inventory is keyed by rate plan as well as date. A Friday-to-Sunday stay can legally book a flexible rate on night one and a prepaid rate on night two. Resolving that is a search over plans, and it has no business happening with rows locked. The capture policy travels with the resolved plan rather than being hard-coded here.",
        numbers: [
          { value: "pure read, zero locks held", explain: "Runs entirely before locks are taken, so plan resolution's search cost never multiplies the ~2ms hold time of the transaction that follows." },
          { value: "3.2 nights average", explain: "The typical stay length this stage has to resolve a plan combination across." },
        ],
        breaks: {
          failure: "Mixed plans mean two separate update statements over date sub-ranges, which is fine only while both still run in ascending date order.",
          handled: "Break that ordering and the deadlock property goes with it, so the two statements are generated in a fixed, tested sequence.",
        },
        choice: {
          pick: "Resolve the plan combination before the transaction, against a snapshot",
          instead: "Resolve inside the transaction so the price is guaranteed current, or let the client send the resolved plan.",
          decider:
            "Lock hold time again. Plan resolution is a search, not a lookup, and putting it inside the critical section turns a ~2ms transaction into whatever the pricing logic costs. A price that moved between snapshot and commit is caught by the price check at confirm, which is a re-quote rather than a correctness failure.",
          flips: "A single rate plan per room type, where there is nothing to resolve and this stage disappears into the write.",
        },
      },
    },
    {
      id: "bk-saga",
      label: "Saga orchestrator",
      sub: "stage 3",
      kind: "process",
      col: 1,
      row: 1,
      parent: "booking-svc",
      detail: {
        what: "Drives reserve, authorise, confirm and fan-out as separate persisted steps, with compensations keyed to (booking_id, step_id).",
        why: "Inventory, payment and notification each commit independently and each can fail on its own. The coordination has to be an explicit state machine, rather than one transaction spanning all three. Compensations are no-ops on retry.",
        numbers: [
          { value: "5 transitions, state written at every one", explain: "The full path a booking's state machine walks, each a durable recovery point." },
          { value: "alert when the oldest non-terminal saga exceeds 60s", explain: "The threshold that pages an operator when the state machine is stuck rather than progressing." },
        ],
        breaks: {
          failure: "Modelling cancellation as the same transition as compensation is a common and expensive simplification.",
          handled: "They converge on sold = sold - 1 and diverge on refund policy, notifications and pricing everywhere else, so the two paths are kept as separate transitions.",
        },
        choice: {
          pick: "Saga with compensating steps, payment outside the inventory transaction",
          instead: "A distributed transaction (two-phase commit) spanning inventory, payment and notification.",
          decider:
            "Payment providers do not participate in XA at all, so the option is not really available. A coordinator crash after prepare would hold inventory locks with no bound. The measured version is lock hold time: ~2ms with payment outside against 200ms to 30s with it inside.",
          flips: "When every participant is a database you own and none of the legs is a third-party network call. There a single transaction is simpler than a state machine plus compensations plus a sweeper.",
        },
      },
    },

    // --- idempotency ----------------------------------------------------
    {
      id: "idem-table",
      label: "Idempotency keys",
      sub: "Postgres, unique constraint",
      kind: "database",
      col: 1,
      row: 0,
      parent: "txn",
      detail: {
        what: "A durable (key, booking_id, state) table with a unique constraint on key, inserted in the same transaction as the decrement. A Redis read-through cache sits in front as a fast path only, answering 'have I seen this key' without a round trip here.",
        why: "The constraint is the guarantee. A duplicate insert failing is how a retry is detected. Doing it inside the transaction means a rolled-back stay does not leave a key claimed by a booking that never happened, since the insert and the decrement commit together. The cache is allowed to be lost because the guarantee lives in the constraint, not in Redis. It earns its place by absorbing the retry storm before it reaches the shard holding the inventory rows.",
        numbers: [
          { value: "1M rows/day", explain: "The daily write volume this table absorbs, one row per unique booking attempt." },
          { value: "0 rows returned means retry", explain: "The signal the handler uses to detect a duplicate attempt." },
          { value: "cache: ~120 lookups/s peak, TTL longer than the 10-minute hold", explain: "The read load the fast-path cache absorbs, and why its expiry outlasts the saga's own recovery window." },
        ],
        breaks: {
          failure: "If this record can be lost, the guarantee degrades to a probability, and it degrades exactly during a burst when retries are most likely.",
          handled: "The guest then holds two confirmations for the same stay, which is why the durable constraint, not the cache, carries the actual guarantee.",
        },
        choice: {
          pick: "Unique constraint in the durable store, cache only as a read-through fast path",
          instead: "Keeping the dedupe record in Redis alone.",
          decider:
            "What a cache failover costs. At 120 bookings/s peak, a 60-second failover is ~7,200 attempts with no dedupe guarantee, and a failover during a burst is exactly when clients are retrying. A store that can lose data gives you a probability rather than a guarantee.",
          flips: "Never, for this operation. The cheaper variants are all reachable by removing the cache, not by removing the constraint.",
        },
      },
    },

    // --- inventory ------------------------------------------------------
    {
      id: "inventory-svc",
      label: "Inventory service",
      sub: "sharded by hotel_id",
      kind: "service",
      col: 2,
      row: 1,
      parent: "txn",
      detail: {
        what: "Owns the smallest possible critical section: one statement that increments sold on every night of the stay where sold < allowance, and returns the dates it changed.",
        why: "It is a separate deployable from the booking service because every channel writes through it. Pooled inventory needs one arbiter per hotel, and sharding that arbiter by hotel_id gives a 500-property chain 500 independent write paths.",
        numbers: [
          { value: "~2ms including commit", explain: "The lock hold time for one conditional update, from statement start to commit." },
          { value: "~500 attempts/s per row", explain: "The per-row throughput ceiling that follows directly from the lock hold time." },
          { value: "3 rows for the average 3.2-night stay", explain: "How many rows one typical booking touches inside the same statement." },
        ],
        breaks: {
          failure: "Deadlock avoidance is an index-order property, not a convention.",
          handled: "The range predicate on the primary key forces an ascending scan, so two overlapping stays visit shared nights in the same order. On a small test table the planner may pick a sequential scan and hide the property until production.",
        },
        choice: {
          pick: "One conditional update per stay: increment sold where sold is under allowance, returning the changed dates",
          instead: "A row-locking read then a separate update, an optimistic version column with client retry, or a per-row single-writer queue.",
          decider:
            "Attempts per second on the hottest row against the single-row ceiling. Locks live ~2ms so a row absorbs ~500 attempts/s. The mean row sees ~1.75 x 10^-5 attempts a day and the worst real burst is ~8/s, which is 1.6% of the ceiling. A queue would add a tier, a failure mode and 10ms to 100% of bookings to help 0.001% of rows.",
          flips: "A store with no multi-row transaction. On a wide-column or document store you get single-item conditional writes only, so a multi-night stay needs N independent writes plus a hold record and a compensating cleanup. An explicit serialiser then stops being overhead and becomes the mechanism.",
        },
      },
    },
    {
      id: "inventory-table",
      label: "Inventory rows",
      sub: "(hotel, room_type, date) counts",
      kind: "database",
      col: 3,
      row: 1,
      parent: "txn",
      detail: {
        what: "One row per bookable room-night, sharded by hotel_id, holding two independently owned counters, sold and allowance, plus price and restrictions. A forecast job overwrites allowance nightly and never reads or writes sold.",
        why: "The two columns exist because two writers touch the row. The booking path owns sold and the nightly forecast job overwrites allowance, and neither has to read the other's value to write its own. That removes the read-modify-write race by construction. Overselling is a deliberate strategy, not an accident: roughly one flexible booking in ten no-shows or cancels. At a $200 ADR against a ~$300 walk cost the critical fractile is 0.4. A 120-room class oversold by 11 recovers ~$2,200 a night against ~$270 of expected walk cost.",
        numbers: [
          { value: "5M hotels x 50 room types x 730 days = 182.5B rows", explain: "The full addressable row space across the entire fleet." },
          { value: "~100B per row, ~18.25TB", explain: "The per-row size and resulting total storage footprint." },
          { value: "one touch every ~57,000 days on the mean row", explain: "How rarely any single row is actually contended, which is why contention is a tail phenomenon." },
          { value: "forecast: physical + 5-15% oversell, hard-clamped at physical x 1.2, none below ~20 units", explain: "The rule the nightly job applies, with a hard ceiling and a floor below which no oversell is applied at all." },
        ],
        breaks: {
          failure: "Collapsing the two columns into a single available_count reintroduces the race.",
          handled: "A job that runs at 02:00 and takes four minutes over a 500-hotel chain will occasionally resurrect inventory that was sold while it was thinking. A stale or broken forecast is caught by the hard clamp rather than trusted silently. Classes below about 20 units also get no oversell at all: with 8 suites the no-show mean is 0.8, and one extra sold walks a guest on 43% of nights.",
        },
        choice: {
          pick: "Sharded Postgres, primary key (hotel_id, room_type_id, date), sold and allowance as separate columns",
          instead: "A single available_count per row, or a per-unit calendar with a status per physical room.",
          decider:
            "Fungibility plus the two-writer problem. Rooms inside a class are interchangeable, so a count is the exact fit and permits deliberate oversell; a per-unit calendar cannot. Sharding by hotel_id gives high cardinality across 5M properties and a long tail that resists hotspots.",
          flips: "Unique units. An Airbnb-style listing has no second copy, so its calendar holds a per-night status rather than a count. Overselling it is a guest outside a locked door, not a priced business decision.",
        },
      },
    },

    // --- saga legs ------------------------------------------------------
    {
      id: "bookings-table",
      label: "Bookings + saga state",
      sub: "partitioned by month",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "The reservation record and the saga's persisted state machine: InventoryReserved, PaymentAuthorized, Confirmed, and the compensation states beside them.",
        why: "The row is inserted as INVENTORY_RESERVED inside the inventory transaction, and every later transition is written as it happens. Without state at every step a crashed orchestrator cannot tell what it already did.",
        numbers: [
          { value: "1M/day x 365 x 5 years = 1.825B rows, ~900GB", explain: "The five-year retention footprint at current booking volume." },
          { value: "row ~500B", explain: "× 1.825B rows over 5 years ≈ the ~900GB retention footprint this table holds — small per row, large only at full scale." },
          { value: "alert when the oldest non-terminal saga exceeds 60s", explain: "The signal that a booking's state machine has stalled." },
        ],
        breaks: {
          failure: "A naive release that runs sold = sold - 1 twice gives two rooms back, which is a silent undersell nobody notices until occupancy reports disagree.",
          handled: "That is why compensations are keyed to (booking_id, step_id) and check the forward step is still applied before undoing it.",
        },
        choice: {
          pick: "Saga state in the same transactional store as the booking, partitioned by month",
          instead: "An in-memory orchestrator, or a workflow engine holding the state externally.",
          decider:
            "Crash recovery and archival. State must be durable at every one of the 5 transitions, or a resume worker has nothing to replay from. Monthly partitions make archiving 1.825B rows a partition detach rather than a delete.",
          flips: "A much richer workflow surface, timers, human approval steps and long-running branches, where a dedicated engine earns its operational cost. Five linear steps do not.",
        },
      },
    },
    {
      id: "payment",
      label: "Payment provider",
      sub: "authorise now, capture later",
      kind: "external",
      col: 2,
      row: 2,
      detail: {
        what: "A third-party card network call made after inventory has committed: authorise the full stay, capture at check-in for flexible rates and immediately for prepaid ones.",
        why: "An authorisation holds funds without moving them and voids at zero cost, whereas a capture moves money and reversing it means a refund with a per-transaction fee and accounting noise. Holds survive about 7 days, which comfortably covers the saga. Capture timing is driven by the resolved rate plan, never hard-coded here.",
        numbers: [
          { value: "200ms good case, 30s bad case", explain: "The latency range this external call can take, the reason it lives outside the inventory transaction." },
          { value: "holds last ~7 days", explain: "The window an authorisation stays valid, far longer than the saga's own recovery windows need." },
        ],
        breaks: {
          failure: "It is the leg you do not control.",
          handled: "When the breaker is open the correct behaviour is to refuse new bookings outright, rather than reserve inventory that cannot be paid for and accumulate sagas stuck in INVENTORY_RESERVED.",
        },
        choice: {
          pick: "Authorise at booking, capture per rate plan, idempotency key of booking_id plus step",
          instead: "Capture immediately on every booking, or hold the card details and charge at the property.",
          decider:
            "The cost of undoing it. A void is free; a refund costs the per-transaction fee and creates reconciliation work, and the saga fails often enough for that difference to matter. The 7-day hold window is an order of magnitude longer than the saga needs.",
          flips: "Prepaid non-refundable rates, where capture at booking is the product. On a stay spanning mixed plans you authorise per segment, so cancelling part of it voids only that segment's hold.",
        },
      },
    },
    {
      id: "booking-events",
      label: "Booking events",
      sub: "retry queue, per-consumer",
      kind: "queue",
      col: 2,
      row: 3,
      detail: {
        what: "The durable topic the saga publishes to once a booking is confirmed, with an independent subscription per downstream consumer: a notification service and a loyalty service. Notification sends the confirmation email, text and partner callbacks, while loyalty credits points and reconciles against the bookings table.",
        why: "The booking is already committed by this point, so everything downstream is an effect rather than a step. Independent subscriptions mean a stalled loyalty consumer cannot delay confirmation emails, and each retries on its own clock. A missing email is a support ticket, not a lost booking, since the user already has their reference number from the HTTP response. A missed accrual is noticed only months later, which is why loyalty additionally reconciles against the bookings table instead of trusting the queue alone.",
        numbers: [
          { value: "1M confirmations/day, 1M accruals/day", explain: "The volume flowing to each independent consumer off this topic." },
          { value: "published after commit, never inside the ~2ms transaction", explain: "The ordering rule that keeps this publish from ever extending the critical section." },
          { value: "2 independent subscriptions, each with its own backpressure", explain: "The isolation model that stops one slow consumer from delaying another." },
        ],
        breaks: {
          failure: "Publishing after commit means the publish itself can be lost, so the queue is not a guarantee on its own.",
          handled: "Notifications cover a lost publish with a resend endpoint. Loyalty covers it by reconciling against the bookings table, which is the only check that closes the gap for a silently dropped accrual.",
        },
        choice: {
          pick: "Asynchronous fan-out on a retry queue after the booking commits",
          instead: "Sending the confirmation inside the booking transaction so the user cannot be told without it.",
          decider:
            "Lock hold time again. The critical section is ~2ms and an email or loyalty provider can stall for seconds. Putting either inside it trades a hard correctness invariant for a cosmetic one that a resend endpoint solves anyway.",
          flips: "Regulated confirmations that must be provably issued with the record, where the emission belongs in the same transaction as the write and the latency is accepted.",
        },
      },
    },

    // --- recovery -------------------------------------------------------
    {
      id: "recovery-svc",
      label: "Recovery workers",
      sub: "resume worker + sweeper",
      kind: "serviceGroup",
      col: 1,
      row: 3,
      detail: {
        what: "Two background jobs guarding against a stuck saga: a resume worker replaying forward from the last step, and a leader-elected sweeper releasing rooms still held after 10 minutes.",
        why: "Payment sits outside the inventory transaction, so there is a real window in which a crash or an abandoned checkout leaves room-nights consumed by a booking that never confirms. The resume worker's 60-second threshold races the sweeper's 10-minute one by design, so a process crash is normally recovered before the hold expires. When it is not, the confirm step re-checks state rather than trusting either job blindly.",
        numbers: [
          { value: "resume: 60s threshold, forward-step keys make replay a no-op", explain: "The resume worker's trigger and why replaying it twice is safe." },
          { value: "sweeper: 10-minute hold, releases oldest first, idempotent by booking id", explain: "The sweeper's trigger and ordering, and why running it twice on the same booking is also safe." },
          { value: "alert when the oldest non-terminal saga exceeds 60s", explain: "The shared alarm both jobs are ultimately racing to prevent from firing." },
        ],
        breaks: {
          failure: "The sweeper releasing rows for a booking whose authorisation later succeeds is a real race.",
          handled: "The confirm step must void that authorisation rather than confirm a booking with no inventory behind it. A blind decrement running twice gives two rooms back, which is why releases are keyed to (booking_id, step_id).",
        },
        choice: {
          pick: "Two separate background jobs, resume worker and sweeper, on deliberately different thresholds",
          instead: "One combined recovery job, or fold the same logic inline into the booking service.",
          decider:
            "The thresholds differ by an order of magnitude on purpose: resume fires at 60 seconds, the sweeper at 10 minutes. That 10x gap is what lets a normal process crash resolve itself before the sweeper ever releases inventory a paid authorisation is about to confirm.",
          flips: "A checkout fast enough to complete inside the request, where there is no stuck-saga window for either job to watch.",
        },
      },
    },
    {
      id: "resume-worker",
      label: "Resume worker",
      sub: "replays from last step",
      kind: "process",
      col: 1,
      row: 3,
      parent: "recovery-svc",
      detail: {
        what: "Picks up sagas that stopped mid-flight and replays them forward from the last persisted step.",
        why: "The dangerous crash is after the card is authorised and before the booking is written. Money is held, inventory is consumed, and nothing is driving the booking to a terminal state. Replaying forward completes it; letting the sweeper release it would throw away a paid-for stay. Forward-step idempotency keys make a replay a no-op rather than a double-charge.",
        numbers: [
          { value: "alert when the oldest non-terminal saga exceeds 60s", explain: "The signal that this worker is falling behind." },
          { value: "runs well inside the 10-minute hold", explain: "The margin this worker has before the sweeper would otherwise release the same rows." },
        ],
        breaks: {
          failure: "It races the sweeper by construction.",
          handled: "Its threshold is 60 seconds against the sweeper's 10 minutes so it normally wins. When it does not, the confirm step re-checks inventory state and voids the authorisation rather than confirming a booking with no rooms behind it.",
        },
        choice: {
          pick: "A separate worker replaying persisted steps, ahead of the sweeper's release window",
          instead: "In-process retry inside the orchestrator, or letting the sweeper release everything stuck and making the user rebook.",
          decider:
            "In-process retry dies with the process, and the failure being recovered from is the process dying. The sweeper alone is worse still: its 10-minute release window is 10x wider than a resumable crash needs. Every authorised, would-have-confirmed booking stuck in that gap gets its rooms released anyway, which shows up as a paid guest with no room.",
          flips: "A checkout fast enough to complete inside the request, where there is no window to crash in and no partial saga to resume.",
        },
      },
    },
    {
      id: "sweeper",
      label: "Expiry sweeper",
      sub: "leader-elected, 10 min hold",
      kind: "process",
      col: 1,
      row: 3,
      parent: "recovery-svc",
      detail: {
        what: "A leader-elected job that releases the room-nights of any booking still in INVENTORY_RESERVED after 10 minutes, oldest first.",
        why: "Payment sits outside the inventory transaction, so there is a real window in which room-nights are consumed by a booking that never confirms. Abandonment on a payment form runs roughly 20-30%, so without this every abandoned checkout removes a room-night from sale permanently.",
        numbers: [
          { value: "10-minute hold", explain: "The abandonment window this job waits out before releasing a reservation." },
          { value: "alert on count of INVENTORY_RESERVED older than 10 min", explain: "The metric that reveals when this job is falling behind its own release rate." },
        ],
        breaks: {
          failure: "It creates a race of its own: an authorisation can succeed after the sweeper has already released the rows.",
          handled: "The confirm step must re-check state and void the authorisation rather than confirm a booking with no inventory behind it.",
        },
        choice: {
          pick: "A leader-elected sweeper with its own liveness alarm, releases idempotent by booking id",
          instead: "A TTL on the reservation row, or no hold at all with inventory taken only at confirm.",
          decider:
            "This is a correctness component, not housekeeping. The metric is the age of the oldest non-terminal booking, and a rising floor above 10 minutes means the sweeper is losing. No hold at all means the price and the room can vanish mid-checkout, which is the failure the 10 minutes buys off.",
          flips: "A checkout fast enough to complete inside the request, where taking inventory only at confirm removes the sweeper, the compensation and the whole reserved window.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "search-svc",
      tier: "hot",
      step: 1,
      label: "search: city + dates",
      detail: {
        what: "A search for a city, a date range and a guest count.",
        why: "This is where almost all of the traffic is: 43 searches for every booking, and around 400 reads per write once hotel-detail and calendar views are counted. Everything about the read path is shaped by that ratio.",
        numbers: [
          { value: "~500/s average, ~4k/s peak", explain: "The request rate this edge carries at average and peak." },
          { value: "43M searches/day", explain: "The daily total against 1M bookings, the ratio the whole read path is designed around." },
        ],
        breaks: {
          failure: "Sequential sweeps of a city and date grid are scrapers, not humans.",
          handled: "The same cache that makes search affordable also makes the scrape cheap for them, so scrapers are handled by rate limiting rather than by the cache design itself.",
        },
      },
    },
    {
      id: "e-search-query",
      from: "search-svc",
      to: "search-index",
      tier: "hot",
      step: 2,
      label: "cache, then query on miss",
      detail: {
        what: "The query key (city, date range, guests) checked against a 60s read-through cache first. On a miss, a geo filter, date filter and rank run against the denormalised index, returning about 20 hotel documents.",
        why: "The cache key repeats heavily across users, so most of a peak is other people's identical searches. 60 seconds of staleness is invisible next to the change-capture lag already in front of it. Availability in the index itself is deliberately coarse: it exists to say 'plausibly available' cheaply, and the authoritative answer is deferred to the write path.",
        numbers: [
          { value: "~70% cache hit rate, 60s TTL", explain: "30% miss × 4k/s peak ≈ 1.2k/s reaching the index — exactly the residual load this store is sized for." },
          { value: "~1.2k/s of the 4k/s peak reaches the index", explain: "The residual load the index actually has to serve after the cache filters peak traffic." },
          { value: "~50ms per query", explain: "1.2k/s residual × 50ms ≈ 60 queries in flight at any instant — the concurrency the index sustains, not just per-query latency." },
        ],
        breaks: {
          failure: "A stale document means the user clicks a room that has gone.",
          handled: "That costs one NO_AVAILABILITY and a re-search — friction, not a correctness failure. Fixing it means querying the authoritative store on every search, at real transactional cost.",
        },
      },
    },
    {
      id: "e4",
      from: "client",
      to: "bk-dedupe",
      tier: "hot",
      step: 3,
      label: "POST /booking + key",
      detail: {
        what: "The booking request carrying hotel, room type, check-in, check-out, guest and a client-generated idempotency key.",
        why: "The key is on the request rather than derived server-side. Only the client knows that a retry after a dropped connection is the same intent as the attempt it never saw a response to.",
        numbers: [
          { value: "~12/s average, ~120/s peak", explain: "The request rate this edge carries at average and peak." },
          { value: "p99 under 5s is the SLO", explain: "The end-to-end latency target this whole path is held to." },
        ],
        breaks: {
          failure: "This is the hop that silently duplicates.",
          handled: "The response can be lost after the booking commits, so the client retries a booking that already exists and the server has to recognise it.",
        },
      },
    },
    {
      id: "e6",
      from: "bk-dedupe",
      to: "idem-table",
      tier: "data",
      label: "insert key, unique index",
      detail: {
        what: "Inserting (idempotency_key, booking_id) under a unique constraint, in the same transaction as the decrement.",
        why: "A duplicate insert failing the constraint is how a retry is detected, and the handler returns the existing booking rather than starting a second one. Doing it in the same transaction means a rolled-back stay does not leave a key claimed, and it commits together with the decrement.",
        numbers: [{ value: "0 rows inserted means retry", explain: "The signal that tells the handler this is a duplicate attempt." }],
        breaks: {
          failure: "If this record can be lost, the guarantee degrades to a probability.",
          handled: "It degrades exactly during a burst when retries are most likely, which is why the constraint lives in the durable store rather than a cache.",
        },
      },
    },
    {
      id: "e7",
      from: "bk-dedupe",
      to: "bk-rates",
      tier: "data",
      label: "not a retry: price it",
      detail: {
        what: "The in-process hand-off from dedupe to pricing, once the key is established as new.",
        why: "It is a function call on the same request thread, not a network hop, which is the whole reason these stages are one service. Anything crossing a wire here would be added latency inside the path whose budget is a ~2ms transaction plus an authorisation.",
        breaks: {
          failure: "Splitting this boundary into two deployments is the classic over-decomposition.",
          handled: "It buys nothing, and every failure between them creates a claimed key with no booking behind it, which is why the two stages stay in one process.",
        },
      },
    },
    {
      id: "e8",
      from: "bk-rates",
      to: "bk-saga",
      tier: "data",
      label: "cheapest legal combo",
      detail: {
        what: "The resolved plan-per-night handed to the orchestrator, with the capture policy that comes with it.",
        why: "Capture timing is a property of the rate plan, so the saga reads it here rather than hard-coding it: prepaid captures at booking, flexible captures at check-in.",
        numbers: [
          { value: "3.2 nights average", explain: "The typical stay length this handoff carries a resolved plan for." },
          { value: "one plan per night, possibly mixed", explain: "The granularity of the resolved combination this edge carries." },
        ],
        breaks: {
          failure: "A mixed-plan stay ends up as two separate update statements over date sub-ranges.",
          handled: "Both must still run in ascending date order or the deadlock property is lost across the plan boundary.",
        },
      },
    },
    {
      id: "e9",
      from: "bk-saga",
      to: "inventory-svc",
      tier: "hot",
      step: 4,
      label: "reserve 3 room-nights",
      detail: {
        what: "The request to take every night of the stay: all of them or none.",
        why: "A three-night stay is three rows and a partial reservation is meaningless to a guest, so atomicity across the range is the contract this hop carries.",
        numbers: [
          { value: "3.2 nights average", explain: "The typical number of rows this edge asks to reserve atomically." },
          { value: "3.2M decrements/day, ~37/s", explain: "The total volume and average rate flowing across this edge." },
        ],
        breaks: {
          failure: "Every channel reserves through this hop, which is what makes inventory pooled rather than pre-allocated.",
          handled: "Bypassing it for one channel reintroduces the stranded-allocation problem it exists to remove, so every channel is required to route through it.",
        },
      },
    },
    {
      id: "e10",
      from: "inventory-svc",
      to: "inventory-table",
      tier: "hot",
      step: 5,
      label: "conditional update, ~2ms",
      detail: {
        what: "One statement: increment sold by one for every night in the stay where sold is still under allowance, and return the dates it actually changed.",
        why: "One statement rather than a separate read-lock and update, because the two-round-trip version holds locks across an application hop, a garbage-collection pause and whatever else the service is doing. Fewer rows returned than nights in the stay rolls the whole thing back.",
        numbers: [
          { value: "locks held ~2ms including commit", explain: "The full duration this statement holds row locks." },
          { value: "~500 attempts/s per row", explain: "The throughput ceiling that follows from the lock hold time." },
        ],
        breaks: {
          failure: "Ascending index order is what stops two overlapping stays deadlocking.",
          handled: "It depends on the planner choosing an index scan, and a sequential scan on a small test table hides the property until the table is large.",
        },
      },
    },
    {
      id: "e12",
      from: "bk-saga",
      to: "payment",
      tier: "hot",
      step: 6,
      label: "authorise, not capture",
      detail: {
        what: "The authorisation call, made after the inventory transaction has already committed.",
        why: "This is the edge that must not be inside the transaction. Authorisation takes 200ms to 30 seconds. Holding row locks across it would drop a single row from ~500 attempts/s to about 5/s, and pin a database connection per user staring at a card form. Its own idempotency key is the booking id plus a fixed 'auth' suffix, so a retried authorisation call cannot double-charge.",
        numbers: [{ value: "200ms to 30s", explain: "The latency range this call can take, entirely outside the design's control." }],
        breaks: {
          failure: "If it fails, the compensation decrements sold on the same rows keyed to this booking id.",
          handled: "If it succeeds after the sweeper has already released those rows, the confirm step voids it instead of confirming a booking with no inventory behind it.",
        },
      },
    },
    {
      id: "e13",
      from: "bk-saga",
      to: "bookings-table",
      tier: "data",
      label: "saga state per step",
      detail: {
        what: "Writing the booking row as InventoryReserved inside the inventory transaction, then persisting each saga transition through to Confirmed.",
        why: "State at every transition is what makes a crash recoverable: a resume worker replays from the last persisted step, and forward-step idempotency keys make re-running it safe. The oldest non-terminal saga's age is the alert.",
        numbers: [{ value: "5 transitions", explain: "The full sequence of persisted states one booking passes through." }],
        breaks: {
          failure: "Modelling cancellation as the same transition as compensation is a common and expensive simplification.",
          handled: "They converge on sold = sold - 1 and diverge on refund policy, notifications and pricing everywhere else, so the two are kept distinct.",
        },
      },
    },
    {
      id: "e14",
      from: "bk-saga",
      to: "booking-events",
      tier: "data",
      label: "confirmed: fan out",
      detail: {
        what: "Publishing the confirmed booking once the card is authorised and the record is written.",
        why: "It is emitted after commit, deliberately, so nothing downstream can extend the critical section or fail a booking that has already happened.",
        numbers: [{ value: "1M/day", explain: "The daily volume of confirmed bookings this edge carries." }],
        breaks: {
          failure: "A publish after commit can itself be lost, and nothing in the queue can detect that.",
          handled: "The reconciliation on the loyalty side is what covers it, since that consumer checks the bookings table directly rather than trusting the queue alone.",
        },
      },
    },
    {
      id: "e17",
      from: "inventory-table",
      to: "cdc",
      tier: "control",
      label: "WAL stream",
      detail: {
        what: "The transactional store's write-ahead log being tailed for inserts and updates to hotels, prices and availability.",
        why: "Reading the log rather than dual-writing means the index inherits the transaction's durability. A change that committed cannot fail to be published, because publishing is downstream of the commit rather than beside it. Every event carries the monotonic log position it came from, so a consumer can always tell what it has already applied.",
        breaks: {
          failure: "Tailing the log ties the pipeline to the database's replication slots.",
          handled: "A stalled consumer holds WAL on the primary, so a dead reader becomes a disk-space problem on the store it reads from.",
        },
      },
    },
    {
      id: "e18",
      from: "cdc",
      to: "search-index",
      tier: "control",
      label: "reindex, <5s p95",
      detail: {
        what: "Denormalised hotel documents being written into the index, idempotently by key.",
        why: "This is the only arrow between the two halves of the system and it points one way. Search is allowed to be seconds behind precisely because the booking path re-checks, so a stale hit costs one NO_AVAILABILITY.",
        numbers: [
          { value: "<5s p95 lag", explain: "The freshness target this edge maintains under normal load." },
          { value: "alert on sustained lag above 30s", explain: "The threshold at which staleness stops being invisible and starts being paged." },
        ],
        breaks: {
          failure: "Out-of-order application, not lag, is the real failure.",
          handled: "Without writing idempotently by key against a monotonic position, a slow partition can regress a document to an older state.",
        },
      },
    },
    {
      id: "e19",
      from: "resume-worker",
      to: "bookings-table",
      tier: "control",
      label: "replay from last step",
      detail: {
        what: "Finding sagas that have been non-terminal for more than 60 seconds and driving them forward from the last state written.",
        why: "The steps are already persisted with forward-step keys, so replay is safe: re-authorising is a no-op against the same key, and re-confirming writes the same state.",
        numbers: [
          { value: "60-second threshold", explain: "The staleness this edge watches for before acting." },
          { value: "well inside the 10-minute hold", explain: "The margin this worker has before the sweeper would otherwise act on the same booking." },
        ],
        breaks: {
          failure: "Replaying a saga whose inventory the sweeper has already released must not confirm it.",
          handled: "The confirm step re-checks the reservation and voids the authorisation instead, rather than confirming a booking with no rooms behind it.",
        },
      },
    },
    {
      id: "e20",
      from: "sweeper",
      to: "bookings-table",
      tier: "control",
      label: "scan INVENTORY_RESERVED",
      detail: {
        what: "Scanning for bookings still in INVENTORY_RESERVED past the 10-minute hold, oldest first.",
        why: "The reserved state is the observable form of an abandoned checkout, and the sweeper is the only thing watching for it once the user has closed the tab. On restart it processes the oldest reservations first.",
        numbers: [{ value: "10-minute threshold", explain: "The abandonment window this edge's scan enforces." }],
        breaks: {
          failure: "If the sweeper stops, this count rises silently while bookings keep succeeding.",
          handled: "The alarm is on the age of the oldest reserved booking rather than on the sweeper's own uptime, so a silent stall is still caught.",
        },
      },
    },
    {
      id: "e21",
      from: "sweeper",
      to: "inventory-table",
      tier: "control",
      label: "release after 10 min",
      detail: {
        what: "Giving the room-nights back: sold = sold - 1 on the same rows, keyed to the booking id so it is a no-op if it runs twice.",
        why: "Without this arrow, every abandoned payment form permanently removes a room-night from sale, and abandonment runs at tens of percent. This is a correctness component, not housekeeping. The release is keyed to (booking_id, step_id) so it is a no-op if it ever runs twice.",
        breaks: {
          failure: "A blind decrement that runs twice gives two rooms back.",
          handled: "That is an undersell nobody notices until occupancy reports disagree with the ledger, which is why the release is idempotent by construction rather than relying on running only once.",
        },
      },
    },
  ],
  figures: {
    "sold-allowance": {
      title: "One shared column races; two owned columns don't",
      nodes: [
        { id: "booking-path", label: "Booking path", sub: "decrements the count", kind: "service", col: 0, row: 0 },
        { id: "forecast-job", label: "Forecast job", sub: "reads it, then overwrites", kind: "service", col: 1, row: 0 },
        {
          id: "sold",
          label: "sold",
          sub: "booking path only, no race",
          kind: "database",
          col: 0,
          row: 1,
          detail: {
            what: "A column written only by the booking path: incremented on confirmation, decremented only by compensations and cancellations.",
            why: "The booking path never reads allowance to decide what to write to sold, so it cannot race the forecast job's write.",
          },
        },
        {
          id: "allowance",
          label: "allowance",
          sub: "forecast job only, no race",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "A column written only by the nightly forecast job: physical capacity plus a deliberate oversell, simply overwritten.",
            why: "The forecast job never reads sold, so a slow forecast run can never silently resurrect or destroy inventory a live booking just changed.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "booking-path", to: "forecast-job", tier: "control", label: "share one count: race" },
        { id: "e2", from: "booking-path", to: "sold", tier: "hot", step: 1, label: "increments only" },
        { id: "e3", from: "forecast-job", to: "allowance", tier: "hot", step: 2, label: "overwrites only" },
      ],
    },
  },
};
