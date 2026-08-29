import type { Diagram } from "./types";

export const HOTEL_RESERVATION: Diagram = {
  id: "hotel-reservation",
  title: "Hotel Reservation",
  question: "Design a Hotel Reservation System",
  sourceId: "patterns",
  itemId: 19,
  overview: {
    shape:
      "Two subsystems with opposite consistency requirements: a denormalised search index that is allowed to be seconds wrong, and one counter per room-night that is not, with a saga wrapped around the counter because payment is far too slow to sit inside a lock.",
    beats: [
      "Discovery and commitment are separated on purpose. Search reads a denormalised index of hotel documents with cached price ranges and coarse availability, refreshed from the transactional store by change capture and running a few seconds behind. That staleness is free, because the booking path re-checks against the authoritative rows and a stale hit costs one NO_AVAILABILITY.",
      "The whole write path hangs off one row shape: (hotel_id, room_type, date) holding sold and allowance. Nobody books room 412, they book a standard king on the 14th, so the state is a count rather than a per-unit calendar, and a three-night stay touches three rows that must all move or none.",
      "The reservation is a single conditional UPDATE that increments sold on every night of the stay where sold < allowance and returns the rows it changed. Fewer rows back than nights means roll the whole stay back. Check and write collapse into one statement, so the row locks live for about 2ms with no application hop inside them.",
      "Payment sits outside that transaction because authorisation takes 200ms in the good case and 30 seconds in the bad one. Inventory commits first with the booking marked INVENTORY_RESERVED, then a saga authorises the card, confirms and fans out notifications, with compensations keyed to (booking_id, step_id) and a sweeper that releases anything still reserved after 10 minutes.",
      "Every write entry point takes an idempotency key stored under a unique constraint in the database, because a retried POST after a dropped connection is the commonest source of duplicate bookings in production. A cache in front is a fast path only: a design whose dedupe store can lose data has a probability, not a guarantee.",
      "The ceiling the transaction enforces is not the room count. A nightly forecast job writes allowance as physical capacity plus a deliberate 5 to 15 percent oversell, and the booking path enforces it exactly while knowing nothing about the forecast. Separate columns with separate owners is what stops the two writers racing.",
    ],
    crux:
      "The interesting number here is not QPS. At 1M bookings a day the average inventory row is touched once every ~7,000 days, so contention is a tail phenomenon and the database alone is enough. The hard part is that the ceiling on the counter is a business parameter somebody else owns: the transactional path must enforce sold < allowance exactly, while a forecast job rewrites allowance underneath it, and the two must never race.",
    numbers: [
      "1.4 x 10^-4 decrements per row per day",
      "~2ms locks, ~500 attempts/s per row",
      "120 physical rooms sold as 131",
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
        why: "They are drawn as one box because there is no network hop between them and no independent scaling story: the same request thread inserts the idempotency key, resolves the rate plan and opens the transaction. Splitting them into peer services would add two hops to a path whose whole design goal is a ~2ms critical section.",
        numbers: ["~12 bookings/s average, ~120/s peak", "p99 under 5s is the SLO", "5 persisted saga transitions"],
        breaks:
          "It owns the window between a committed decrement and a confirmed booking. A crash inside that window leaves inventory consumed by a booking nobody is finishing, which is why the alert is the age of the oldest non-terminal saga rather than a queue depth.",
      },
    },
    {
      id: "txn",
      label: "One transaction: locks held ~2ms",
      kind: "zone",
      detail: {
        what: "The only part of the system where being wrong is expensive: the idempotency insert, the conditional decrement and the row it lands on, all committing together.",
        why: "Everything outside this frame is a read path, a downstream effect or a background job, and all of it is allowed to be stale, retried or late. Inside it the invariant is absolute: no booking is ever accepted above the published allowance, and every night of a stay commits or none does.",
        numbers: ["locks held ~2ms including commit", "3.2M room-night decrements/day", "zero bookings above allowance is a hard SLO"],
        breaks:
          "Anything slow that leaks into this frame multiplies lock hold time directly. One network call inside the transaction drops the per-row ceiling from ~500 attempts/s to about 5/s, which is why payment, notification and the cache are all drawn outside it.",
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
        why: "It is drawn because it owns the retry. A dropped connection on POST /booking is invisible to the user, so the client retries, and the key it generates is the only thing that lets the server recognise the second attempt as the same intent.",
        numbers: ["43M searches/day against 1M bookings", "look-to-book ~2.5%", "one key per booking intent"],
        breaks:
          "A client that generates a fresh key per retry defeats the whole dedupe scheme and books the same stay twice. The key belongs to the user's intent, not to the HTTP attempt.",
        choice: {
          pick: "A client-generated UUID minted when the user opens checkout, resent unchanged on every retry",
          instead: "Derive the key server-side from the request body, or let the client mint a new one per attempt.",
          decider:
            "Who can tell two requests apart. Only the client knows that the attempt it never saw a response to and the one it is sending now are the same intent; a server-side hash of the body cannot distinguish an intentional second identical booking from a retry of the first.",
          flips:
            "Machine channels with an exactly-once transport of their own, where the message id is already stable and a second key is duplicated state.",
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
        why: "Search and booking have genuinely different consistency requirements, and separating them lets each scale on its own terms across a 400:1 read-to-write ratio without the read tier ever touching booking throughput.",
        numbers: ["~500/s average, ~4k/s peak", "~20 results in ~50ms", "hotel-detail and calendar views add ~10x search volume"],
        breaks:
          "It answers 'plausibly available', never 'available'. Users occasionally click a room that has gone, which is friction rather than a correctness failure, and it is the price of never querying inventory from search.",
        choice: {
          pick: "Read a derived index; never read the inventory rows",
          instead: "Query the transactional inventory rows directly, or a read replica of them.",
          decider:
            "The read-to-write ratio. 43M searches against 1M bookings is 43:1, and adding hotel-detail and calendar views at roughly 10x search volume takes the effective load to 400:1. A read tier that touches the write path puts that load on the rows the booking transaction locks.",
          flips:
            "A small operator where the whole catalogue fits in one database. At 5k partner hotels the numbers land three to four orders of magnitude lower and a second store is pure operational cost.",
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
        what: "A denormalised, eventually consistent copy of hotel documents with cached minimum prices and coarse availability, plus a geo index behind 'hotels within 5km'. A Redis query cache keyed on (city, date range, guests) sits in front, holding rendered result pages for 60 seconds.",
        why: "It answers 'plausibly available' cheaply, and the booking path answers the real question authoritatively. It never touches the inventory table, which is what keeps a 4k/s peak read load off the write path entirely. The query cache absorbs most of that peak before it reaches the index at all: the key repeats heavily, since Sunday-evening planners search the same twenty cities for the same weekends, and losing the cache costs latency and index load, never correctness.",
        numbers: [
          "5M docs x ~5KB = 25GB primary, ~75GB with replica and analysis",
          "~10GB geo index",
          "sharded by city",
          "cache: ~70% hit rate, 60s TTL, 4k/s peak in vs ~1.2k/s reaching the index",
        ],
        breaks:
          "It is allowed to be wrong and regularly is. The failure that actually hurts is out-of-order application, so events carry a monotonic log position and documents are written idempotently by key, or a slow partition regresses a document to an older state.",
        choice: {
          pick: "A separate search index fed by change capture",
          instead: "Read replicas of the transactional store, or querying the inventory rows behind a cache.",
          decider:
            "Query shape as much as load. Free-text, geo and facet queries over 5M documents are not what a relational replica is for, and at 400:1 reads to writes the read tier has to scale on its own terms without ever touching booking throughput.",
          flips:
            "A catalogue small enough to filter in the transactional store, where a second store is an extra pipeline, an extra failure mode and a lag metric to watch for no benefit.",
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
        numbers: ["cdc_lag_seconds under 5s p95", "alert on sustained lag above 30s", "chain-wide pushes of 500 hotels are normal"],
        breaks:
          "Lag spikes during a chain-wide inventory push, so results go stale and users see occasional NO_AVAILABILITY at the point of booking. Tailing the log also ties the pipeline to the database's replication slots: a stalled consumer holds WAL on the primary, so a dead reader becomes a disk-space problem on the store it reads from.",
        choice: {
          pick: "Log-based change capture from the database write-ahead log",
          instead: "Dual writes from the booking service, or a periodic full reindex.",
          decider:
            "Dual writes fail independently of the transaction and drop changes silently; a full reindex over 5M documents cannot hold a 5s p95 lag. Reading the log inherits the transaction's own durability for free.",
          flips:
            "A catalogue that changes rarely, where a nightly rebuild is simpler than operating a streaming pipeline and nobody notices the staleness.",
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
        why: "A retried POST after a dropped connection is the most common source of duplicate reservations in production, and this is the only stage that can tell the difference between a retry and a second booking.",
        numbers: ["one row per booking attempt", "insert commits with the decrement", "~120 attempts/s at peak"],
        breaks:
          "Returning the existing booking is only correct if the first attempt is finished. A retry that arrives while the original is still mid-saga must return the in-progress state rather than a confirmation nobody has earned yet.",
        choice: {
          pick: "Dedupe on the client's key",
          instead: "Dedupe on a natural key: user plus hotel plus date range.",
          decider:
            "Whether a genuine second booking is legal. It is: a family books two rooms of the same type for the same nights in two requests, and a natural key would silently swallow the second one. The client's key distinguishes intent from repetition; a natural key cannot.",
          flips:
            "Operations that are naturally idempotent, such as cancellation by booking id, where a duplicate is already a no-op and the key earns nothing.",
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
        why: "Real inventory is keyed by rate plan as well as date, so a Friday-to-Sunday stay can legally book a flexible rate on night one and a prepaid rate on night two. Resolving that is a search over plans, and it has no business happening with rows locked.",
        numbers: ["pure read, zero locks held", "3.2 nights average", "capture policy comes from the resolved plan"],
        breaks:
          "Mixed plans mean two UPDATEs over date sub-ranges, which is fine only while both still run in ascending date order. Break that and the deadlock property goes with it.",
        choice: {
          pick: "Resolve the plan combination before the transaction, against a snapshot",
          instead: "Resolve inside the transaction so the price is guaranteed current, or let the client send the resolved plan.",
          decider:
            "Lock hold time again. Plan resolution is a search, not a lookup, and putting it inside the critical section turns a ~2ms transaction into whatever the pricing logic costs. A price that moved between snapshot and commit is caught by the price check at confirm, which is a re-quote rather than a correctness failure.",
          flips:
            "A single rate plan per room type, where there is nothing to resolve and this stage disappears into the write.",
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
        why: "Inventory, payment and notification each commit independently and each can fail on its own, so the coordination has to be an explicit state machine rather than one transaction spanning all three.",
        numbers: ["5 transitions, state written at every one", "alert when the oldest non-terminal saga exceeds 60s", "compensations are no-ops on retry"],
        breaks:
          "Modelling cancellation as the same transition as compensation is a common and expensive simplification. They converge on sold = sold - 1 and diverge on refund policy, notifications and pricing everywhere else.",
        choice: {
          pick: "Saga with compensating steps, payment outside the inventory transaction",
          instead: "A distributed transaction (two-phase commit) spanning inventory, payment and notification.",
          decider:
            "Payment providers do not participate in XA at all, so the option is not really available, and a coordinator crash after prepare would hold inventory locks with no bound. The measured version is lock hold time: ~2ms with payment outside against 200ms to 30s with it inside.",
          flips:
            "When every participant is a database you own and none of the legs is a third-party network call, where a single transaction is simpler than a state machine plus compensations plus a sweeper.",
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
        why: "The constraint is the guarantee. A duplicate insert failing is how a retry is detected, and doing it inside the transaction means a rolled-back stay does not leave a key claimed by a booking that never happened. The cache is allowed to be lost because the guarantee lives in the constraint, not in Redis; it earns its place by absorbing the retry storm itself before it reaches the shard holding the inventory rows.",
        numbers: ["1M rows/day", "insert and decrement commit together", "0 rows returned means retry", "cache: ~120 lookups/s peak, TTL longer than the 10-minute hold"],
        breaks:
          "If this record can be lost, the guarantee degrades to a probability, and it degrades exactly during a burst when retries are most likely. The guest then holds two confirmations for the same stay.",
        choice: {
          pick: "Unique constraint in the durable store, cache only as a read-through fast path",
          instead: "Keeping the dedupe record in Redis alone.",
          decider:
            "What a cache failover costs. At 120 bookings/s peak, a 60-second failover is ~7,200 attempts with no dedupe guarantee, and a failover during a burst is exactly when clients are retrying. A store that can lose data gives you a probability rather than a guarantee.",
          flips:
            "Never, for this operation. The cheaper variants are all reachable by removing the cache, not by removing the constraint.",
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
        numbers: ["~2ms including commit", "~500 attempts/s per row", "3 rows for the average 3.2-night stay"],
        breaks:
          "Deadlock avoidance is an index-order property, not a convention. The range predicate on the primary key forces an ascending scan, so two overlapping stays visit shared nights in the same order. On a small test table the planner may pick a sequential scan and hide the property until production.",
        choice: {
          pick: "Single conditional UPDATE ... WHERE sold < allowance RETURNING date",
          instead: "SELECT ... FOR UPDATE then UPDATE, an optimistic version column with client retry, or a per-row single-writer queue.",
          decider:
            "Attempts per second on the hottest row against the single-row ceiling. Locks live ~2ms so a row absorbs ~500 attempts/s; the mean row sees 1.4 x 10^-4 attempts a day and the worst real burst is ~8/s, which is 1.6% of the ceiling. A queue would add a tier, a failure mode and 10ms to 100% of bookings to help 0.001% of rows.",
          flips:
            "A store with no multi-row transaction. On a wide-column or document store you get single-item conditional writes only, so a multi-night stay needs N independent writes plus a hold record and a compensating cleanup, and an explicit serialiser stops being overhead and becomes the mechanism.",
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
        what: "One row per bookable room-night, sharded by hotel_id, holding two independently owned counters plus price and restrictions. allowance is overwritten nightly by a revenue forecast job, per property and room-type class, as physical capacity plus a demand-driven oversell; the job never reads or writes sold.",
        why: "The two columns exist because two writers touch the row. The booking path owns sold and the nightly forecast job overwrites allowance, and neither has to read the other's value to write its own, which removes the read-modify-write race by construction. Overselling is a deliberate strategy, not an accident: roughly one flexible booking in ten no-shows or cancels, and at a $200 ADR against a ~$300 walk cost the critical fractile is 0.4, so a 120-room class oversold by 11 recovers ~$2,200 a night against ~$270 of expected walk cost.",
        numbers: [
          "5M hotels x 50 room types x 730 days = 182.5B rows",
          "~100B per row, ~18.25TB",
          "one touch every ~7,000 days on the mean row",
          "forecast: physical + 5-15% oversell, hard-clamped at physical x 1.2, none below ~20 units",
        ],
        breaks:
          "Collapsing the two columns into a single available_count reintroduces the race: a job that runs at 02:00 and takes four minutes over a 500-hotel chain will occasionally resurrect inventory that was sold while it was thinking. A stale or broken forecast is caught by the hard clamp rather than trusted silently, and classes below about 20 units get no oversell at all: with 8 suites the no-show mean is 0.8 and one extra sold walks a guest on 43% of nights.",
        choice: {
          pick: "Sharded Postgres, primary key (hotel_id, room_type_id, date), sold and allowance as separate columns",
          instead: "A single available_count per row, or a per-unit calendar with a status per physical room.",
          decider:
            "Fungibility plus the two-writer problem. Rooms inside a class are interchangeable, so a count is the exact fit and permits deliberate oversell; a per-unit calendar cannot. Sharding by hotel_id gives high cardinality across 5M properties and a long tail that resists hotspots.",
          flips:
            "Unique units. An Airbnb-style listing has no second copy, so its calendar holds a per-night status rather than a count, and overselling it is a guest outside a locked door rather than a priced business decision.",
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
        what: "The reservation record and the saga's persisted state machine: INVENTORY_RESERVED, PaymentAuthorized, CONFIRMED, and the compensation states beside them.",
        why: "The row is inserted as INVENTORY_RESERVED inside the inventory transaction, and every later transition is written as it happens. Without state at every step a crashed orchestrator cannot tell what it already did.",
        numbers: ["1M/day x 365 x 5 years = 1.825B rows, ~900GB", "row ~500B", "alert when the oldest non-terminal saga exceeds 60s"],
        breaks:
          "A naive release that runs sold = sold - 1 twice gives two rooms back, which is a silent undersell nobody notices until occupancy reports disagree. That is why compensations are keyed to (booking_id, step_id) and check the forward step is still applied.",
        choice: {
          pick: "Saga state in the same transactional store as the booking, partitioned by month",
          instead: "An in-memory orchestrator, or a workflow engine holding the state externally.",
          decider:
            "Crash recovery and archival. State must be durable at every one of the 5 transitions or a resume worker has nothing to replay from; monthly partitions make archiving 1.825B rows a partition detach rather than a delete.",
          flips:
            "A much richer workflow surface, timers, human approval steps and long-running branches, where a dedicated engine earns its operational cost. Five linear steps do not.",
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
        why: "An authorisation holds funds without moving them and voids at zero cost, whereas a capture moves money and reversing it means a refund with a per-transaction fee and accounting noise. Holds survive about 7 days, which comfortably covers the saga.",
        numbers: ["200ms good case, 30s bad case", "holds last ~7 days", "capture driven by the rate plan, not hard-coded"],
        breaks:
          "It is the leg you do not control. When the breaker is open the correct behaviour is to refuse new bookings outright rather than reserve inventory that cannot be paid for and accumulate sagas stuck in INVENTORY_RESERVED.",
        choice: {
          pick: "Authorise at booking, capture per rate plan, idempotency key of booking_id plus step",
          instead: "Capture immediately on every booking, or hold the card details and charge at the property.",
          decider:
            "The cost of undoing it. A void is free; a refund costs the per-transaction fee and creates reconciliation work, and the saga fails often enough for that difference to matter. The 7-day hold window is an order of magnitude longer than the saga needs.",
          flips:
            "Prepaid non-refundable rates, where capture at booking is the product, and on a stay spanning mixed plans you authorise per segment so cancelling part of it voids only that segment's hold.",
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
        what: "The durable topic the saga publishes to once a booking is CONFIRMED, with an independent subscription per downstream consumer: a notification service that renders and sends the confirmation email, SMS and partner callbacks, and a loyalty service that credits points keyed by booking id and runs a periodic reconciliation sweep against the bookings table.",
        why: "The booking is already committed by this point, so everything downstream is an effect rather than a step. Independent subscriptions mean a stalled loyalty consumer cannot delay confirmation emails, and each retries on its own clock. The user already has their reference number from the HTTP response, so a missing email is a support ticket, not a lost booking; a missed accrual is noticed only months later, which is why loyalty additionally reconciles against the bookings table instead of trusting the queue alone.",
        numbers: [
          "1M confirmations/day, 1M accruals/day",
          "published after commit, never inside the ~2ms transaction",
          "per-consumer backpressure",
          "notification: best-effort with a resend endpoint; loyalty: event-driven plus reconciliation",
        ],
        breaks:
          "Publishing after commit means the publish itself can be lost, so the queue is not a guarantee on its own. Retries cannot recover an event that was never published: notifications cover that with a resend endpoint, loyalty covers it by reconciling against the bookings table, which is the only check that closes the gap for a silently dropped accrual.",
        choice: {
          pick: "Asynchronous fan-out on a retry queue after the booking commits",
          instead: "Sending the confirmation inside the booking transaction so the user cannot be told without it.",
          decider:
            "Lock hold time again. The critical section is ~2ms and an email or loyalty provider can stall for seconds, so putting either inside it trades a hard correctness invariant for a cosmetic one that a resend endpoint solves anyway.",
          flips:
            "Regulated confirmations that must be provably issued with the record, where the emission belongs in the same transaction as the write and the latency is accepted.",
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
        what: "Two background jobs that keep an abandoned or crashed saga from either stranding inventory forever or confirming with nothing behind it: a resume worker that replays a stalled saga forward from its last persisted step, and a leader-elected sweeper that releases room-nights still held after a 10-minute abandonment window.",
        why: "Payment sits outside the inventory transaction, so there is a real window in which a crash or an abandoned checkout leaves room-nights consumed by a booking that never confirms. The resume worker's 60-second threshold races the sweeper's 10-minute one by design, so a process crash is normally recovered before the hold expires; when it is not, the confirm step re-checks state rather than trusting either job blindly.",
        numbers: [
          "resume: 60s threshold, forward-step keys make replay a no-op",
          "sweeper: 10-minute hold, releases oldest first, idempotent by booking id",
          "alert when the oldest non-terminal saga exceeds 60s",
        ],
        breaks:
          "The sweeper releasing rows for a booking whose authorisation later succeeds is a real race; the confirm step must void that authorisation rather than confirm a booking with no inventory behind it. A blind decrement running twice gives two rooms back, which is why releases are keyed to (booking_id, step_id).",
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
        why: "The dangerous crash is after the card is authorised and before the booking is written: money is held, inventory is consumed, and nothing is driving the booking to a terminal state. Replaying forward completes it; letting the sweeper release it would throw away a paid-for stay.",
        numbers: ["alert when the oldest non-terminal saga exceeds 60s", "forward-step keys make replay a no-op", "runs well inside the 10-minute hold"],
        breaks:
          "It races the sweeper by construction. Its threshold is 60 seconds against the sweeper's 10 minutes so it normally wins, and when it does not, the confirm step re-checks inventory state and voids the authorisation rather than confirming a booking with no rooms behind it.",
        choice: {
          pick: "A separate worker replaying persisted steps, ahead of the sweeper's release window",
          instead: "In-process retry inside the orchestrator, or letting the sweeper release everything stuck and making the user rebook.",
          decider:
            "In-process retry dies with the process, and the failure being recovered from is the process dying. The sweeper alone is worse still: it releases inventory for bookings that were authorised and would have confirmed, which shows up as a paid guest with no room.",
          flips:
            "A checkout fast enough to complete inside the request, where there is no window to crash in and no partial saga to resume.",
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
        why: "Payment sits outside the inventory transaction, so there is a real window in which room-nights are consumed by a booking that never confirms. Abandonment on a payment form runs at tens of percent, so without this every abandoned checkout removes a room-night from sale permanently.",
        numbers: ["10-minute hold", "abandonment on payment forms in the tens of percent", "alert on count of INVENTORY_RESERVED older than 10 min"],
        breaks:
          "It creates a race of its own: an authorisation can succeed after the sweeper has released the rows, so the confirm step must re-check state and void the authorisation rather than confirm a booking with no inventory behind it.",
        choice: {
          pick: "A leader-elected sweeper with its own liveness alarm, releases idempotent by booking id",
          instead: "A TTL on the reservation row, or no hold at all with inventory taken only at confirm.",
          decider:
            "This is a correctness component, not housekeeping. The metric is the age of the oldest non-terminal booking, and a rising floor above 10 minutes means the sweeper is losing. No hold at all means the price and the room can vanish mid-checkout, which is the failure the 10 minutes buys off.",
          flips:
            "A checkout fast enough to complete inside the request, where taking inventory only at confirm removes the sweeper, the compensation and the whole reserved window.",
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
      label: "search: city + dates",
      detail: {
        what: "A search for a city, a date range and a guest count.",
        why: "This is where almost all of the traffic is: 43 searches for every booking, and around 400 reads per write once hotel-detail and calendar views are counted. Everything about the read path is shaped by that ratio.",
        numbers: ["~500/s average, ~4k/s peak", "43M searches/day"],
        breaks:
          "Sequential sweeps of a city and date grid are scrapers, not humans, and the same cache that makes search affordable also makes the scrape cheap for them.",
      },
    },
    {
      id: "e-search-query",
      from: "search-svc",
      to: "search-index",
      tier: "hot",
      label: "cache, then query on miss",
      detail: {
        what: "The query key (city, date range, guests) checked against a 60s read-through cache first; on a miss, a geo filter, date filter and rank against the denormalised index, returning about 20 hotel documents.",
        why: "The cache key repeats heavily across users, so most of a peak is other people's identical searches, and 60 seconds of staleness is invisible next to the change-capture lag already in front of it. Availability in the index itself is deliberately coarse: it exists to say 'plausibly available' cheaply, and the authoritative answer is deferred to the write path.",
        numbers: ["~70% cache hit rate, 60s TTL", "~1.2k/s of the 4k/s peak reaches the index", "~50ms per query"],
        breaks:
          "A stale document means the user clicks a room that has gone. That costs one NO_AVAILABILITY and a re-search, which is friction and not a correctness failure.",
      },
    },
    {
      id: "e4",
      from: "client",
      to: "bk-dedupe",
      tier: "hot",
      label: "POST /booking + key",
      detail: {
        what: "The booking request carrying hotel, room type, check-in, check-out, guest and a client-generated idempotency key.",
        why: "The key is on the request rather than derived server-side because only the client knows that a retry after a dropped connection is the same intent as the attempt it never saw a response to.",
        numbers: ["~12/s average, ~120/s peak", "p99 under 5s is the SLO"],
        breaks:
          "This is the hop that silently duplicates. The response can be lost after the booking commits, so the client retries a booking that already exists and the server has to recognise it.",
      },
    },
    {
      id: "e6",
      from: "bk-dedupe",
      to: "idem-table",
      tier: "data",
      label: "INSERT key, unique index",
      detail: {
        what: "Inserting (idempotency_key, booking_id) under a unique constraint, in the same transaction as the decrement.",
        why: "A duplicate insert failing the constraint is how a retry is detected, and the handler returns the existing booking rather than starting a second one. Doing it in the same transaction means a rolled-back stay does not leave a key claimed.",
        numbers: ["0 rows inserted means retry", "commits with the decrement"],
        breaks:
          "If this record can be lost, the guarantee degrades to a probability, and it degrades exactly during a burst when retries are most likely.",
      },
    },
    {
      id: "e7",
      from: "bk-dedupe",
      to: "bk-rates",
      label: "not a retry: price it",
      detail: {
        what: "The in-process hand-off from dedupe to pricing, once the key is established as new.",
        why: "It is a function call, not a network hop, which is the whole reason these stages are one service. Anything crossing a wire here would be added latency inside the path whose budget is a ~2ms transaction plus an authorisation.",
        numbers: ["no network hop", "same request thread"],
        breaks:
          "Splitting this boundary into two deployments is the classic over-decomposition: it buys nothing, and every failure between them creates a claimed key with no booking behind it.",
      },
    },
    {
      id: "e8",
      from: "bk-rates",
      to: "bk-saga",
      label: "cheapest legal combo",
      detail: {
        what: "The resolved plan-per-night handed to the orchestrator, with the capture policy that comes with it.",
        why: "Capture timing is a property of the rate plan, so the saga reads it here rather than hard-coding it: prepaid captures at booking, flexible captures at check-in.",
        numbers: ["3.2 nights average", "one plan per night, possibly mixed"],
        breaks:
          "A mixed-plan stay ends up as two UPDATEs over date sub-ranges. Both must still run in ascending date order or the deadlock property is lost across the plan boundary.",
      },
    },
    {
      id: "e9",
      from: "bk-saga",
      to: "inventory-svc",
      tier: "hot",
      label: "reserve 3 room-nights",
      detail: {
        what: "The request to take every night of the stay: all of them or none.",
        why: "A three-night stay is three rows and a partial reservation is meaningless to a guest, so atomicity across the range is the contract this hop carries.",
        numbers: ["3.2 nights average", "3.2M decrements/day, ~37/s"],
        breaks:
          "Every channel reserves through this hop, which is what makes inventory pooled rather than pre-allocated. Bypassing it for one channel reintroduces the stranded-allocation problem it exists to remove.",
      },
    },
    {
      id: "e10",
      from: "inventory-svc",
      to: "inventory-table",
      tier: "hot",
      label: "conditional UPDATE, ~2ms",
      detail: {
        what: "UPDATE inventory SET sold = sold + 1 WHERE ... AND date >= ? AND date < ? AND sold < allowance RETURNING date.",
        why: "One statement rather than SELECT ... FOR UPDATE then UPDATE, because the two-round-trip version holds locks across an application hop, a garbage-collection pause and whatever else the service is doing.",
        numbers: ["locks held ~2ms including commit", "rowcount < nights means ROLLBACK", "~500 attempts/s per row"],
        breaks:
          "Ascending index order is what stops two overlapping stays deadlocking. It depends on the planner choosing an index scan, and a sequential scan on a small test table hides the property until the table is large.",
      },
    },
    {
      id: "e12",
      from: "bk-saga",
      to: "payment",
      tier: "hot",
      label: "authorise, not capture",
      detail: {
        what: "The authorisation call, made after the inventory transaction has already committed.",
        why: "This is the arrow that must not be inside the transaction. Authorisation takes 200ms to 30 seconds, so holding row locks across it would drop a single row from ~500 attempts/s to about 5/s and pin a database connection per user staring at a card form.",
        numbers: ["200ms to 30s", "idempotency key = booking_id + ':auth'"],
        breaks:
          "If it fails, the compensation decrements sold on the same rows keyed to this booking id. If it succeeds after the sweeper has already released those rows, the confirm step voids it instead.",
      },
    },
    {
      id: "e13",
      from: "bk-saga",
      to: "bookings-table",
      tier: "data",
      label: "saga state per step",
      detail: {
        what: "Writing the booking row as INVENTORY_RESERVED inside the inventory transaction, then persisting each saga transition through to CONFIRMED.",
        why: "State at every transition is what makes a crash recoverable: a resume worker replays from the last persisted step, and forward-step idempotency keys make re-running it safe.",
        numbers: ["5 transitions", "oldest non-terminal saga age is the alert"],
        breaks:
          "Modelling cancellation as the same transition as compensation is a common and expensive simplification. They converge on sold = sold - 1 and diverge on refund policy, notifications and pricing everywhere else.",
      },
    },
    {
      id: "e14",
      from: "bk-saga",
      to: "booking-events",
      tier: "data",
      label: "CONFIRMED: fan out",
      detail: {
        what: "Publishing the confirmed booking once the card is authorised and the record is written.",
        why: "It is emitted after commit, deliberately, so nothing downstream can extend the critical section or fail a booking that has already happened.",
        numbers: ["1M/day", "published after commit"],
        breaks:
          "A publish after commit can itself be lost, and nothing in the queue can detect that. The reconciliation on the loyalty side is what covers it.",
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
        why: "Reading the log rather than dual-writing means the index inherits the transaction's durability: a change that committed cannot fail to be published, because publishing is downstream of the commit rather than beside it.",
        numbers: ["events carry a monotonic log position"],
        breaks:
          "Tailing the log ties the pipeline to the database's replication slots, and a stalled consumer holds WAL on the primary, so a dead reader becomes a disk-space problem on the store it reads from.",
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
        numbers: ["<5s p95 lag", "alert on sustained lag above 30s"],
        breaks:
          "Out-of-order application, not lag, is the real failure: without writing idempotently by key against a monotonic position, a slow partition can regress a document to an older state.",
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
        numbers: ["60-second threshold", "well inside the 10-minute hold"],
        breaks:
          "Replaying a saga whose inventory the sweeper has already released must not confirm it. The confirm step re-checks the reservation and voids the authorisation instead.",
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
        why: "The reserved state is the observable form of an abandoned checkout, and the sweeper is the only thing watching for it once the user has closed the tab.",
        numbers: ["10-minute threshold", "processed oldest-first on restart"],
        breaks:
          "If the sweeper stops, this count rises silently while bookings keep succeeding, so the alarm is on the age of the oldest reserved booking rather than on the sweeper's own uptime.",
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
        why: "Without this arrow, every abandoned payment form permanently removes a room-night from sale, and abandonment runs at tens of percent. This is a correctness component, not housekeeping.",
        numbers: ["release keyed to (booking_id, step_id)"],
        breaks:
          "A blind decrement that runs twice gives two rooms back, which is an undersell nobody notices until occupancy reports disagree with the ledger.",
      },
    },
  ],
};
