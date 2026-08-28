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
    {
      id: "write-path",
      label: "Write path: strongly consistent",
      kind: "zone",
      x: 24,
      y: 304,
      w: 672,
      h: 208,
      detail: {
        what: "The only part of the system where being wrong is expensive: the idempotency insert, the conditional decrement and the row it lands on.",
        why: "Everything outside this box is a read path or a downstream effect and is allowed to be stale, retried or late. Inside it, the invariant is absolute: no booking is ever accepted above the published allowance, and every night of a stay commits or none does.",
        numbers: ["locks held ~2ms", "3.2M room-night decrements/day", "zero bookings above allowance is a hard SLO"],
        breaks:
          "Anything slow that leaks into this box multiplies lock hold time directly. A single network call inside the transaction drops the per-row ceiling from ~500 attempts/s to about 5/s.",
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "web / app / partner channel",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The browser, app or distribution partner that searches, then posts a booking with a client-generated idempotency key.",
        why: "It is drawn because it owns the retry. A dropped connection on POST /booking is invisible to the user, so the client retries, and the key it generates is the only thing that lets the server recognise the second attempt as the same intent.",
        numbers: ["43M searches/day against 1M bookings", "look-to-book ~2.5%"],
        breaks:
          "A client that generates a fresh key per retry defeats the whole dedupe scheme and books the same stay twice. The key belongs to the user's intent, not to the HTTP attempt.",
      },
    },
    {
      id: "search-svc",
      label: "Search service",
      sub: "60s cache on city + dates",
      kind: "service",
      x: 40,
      y: 120,
      w: 280,
      detail: {
        what: "Serves 'Paris, 3 nights, check-in Jan 10' from the search index, returning about 20 results in roughly 50ms.",
        why: "Search and booking have genuinely different consistency requirements, and separating them lets each scale on its own terms across a 400:1 read-to-write ratio without the read tier ever touching booking throughput.",
        numbers: ["~500/s average, ~4k/s peak", "70% cache hit leaves ~1.2k/s at the index", "~20 results in ~50ms"],
        breaks:
          "It answers 'plausibly available', never 'available'. Users occasionally click a room that has gone, which is friction rather than a correctness failure, and it is the price of never querying inventory from search.",
        choice: {
          pick: "Read a derived index, cache (city, date range, guests) for 60 seconds",
          instead: "Query the transactional inventory rows directly, or a read replica of them.",
          decider:
            "The read-to-write ratio. 43M searches against 1M bookings is 43:1, and adding hotel-detail and calendar views at roughly 10x search volume takes the effective load to 400:1. The cache key repeats heavily across users, so 60 seconds absorbs ~70% and leaves ~1.2k/s of the 4k/s peak reaching the index.",
          flips:
            "A small operator where the whole catalogue fits in one database. At 5k partner hotels the numbers land three to four orders of magnitude lower and a second store is pure operational cost.",
        },
      },
    },
    {
      id: "booking-svc",
      label: "Booking service",
      sub: "saga orchestrator",
      kind: "service",
      x: 40,
      y: 320,
      w: 280,
      detail: {
        what: "The orchestrator: takes the idempotency key, asks for the room-nights, then drives authorise, confirm and fan-out as separate persisted steps.",
        why: "Inventory, payment and notification each commit independently and each can fail on its own, so the coordination has to be an explicit state machine with compensations rather than one transaction spanning all three.",
        numbers: ["~12 bookings/s average, ~120/s peak", "5 saga steps, state persisted at every transition"],
        breaks:
          "It owns the window between a committed decrement and a confirmed booking. A crash after authorisation and before the booking write leaves a saga stranded, which is why the alert is on the age of the oldest non-terminal saga rather than on a queue depth.",
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
    {
      id: "idempotency",
      label: "Idempotency store",
      sub: "Postgres unique key + Redis",
      kind: "database",
      x: 440,
      y: 320,
      w: 240,
      detail: {
        what: "A durable (key, booking_id, state) table with a unique constraint on key, fronted by a cache for the fast path.",
        why: "A retried POST after a dropped connection is the most common source of duplicate reservations in production, and the only cheap way to recognise a retry is to let the database reject the second insert.",
        numbers: ["one row per booking attempt", "insert runs in the same transaction as the decrement"],
        breaks:
          "If the durable record is missing, a duplicate insert succeeds and the guest holds two confirmations for the same stay. The constraint is the guarantee; everything else is latency.",
        choice: {
          pick: "Unique constraint in the durable store, cache only as a read-through fast path",
          instead: "Keeping the dedupe record in Redis alone, or deduping on a natural key such as user plus dates.",
          decider:
            "What a cache failover costs. At 120 bookings/s peak, a 60-second failover is ~7,200 attempts with no dedupe guarantee, and a failover during a burst is exactly when clients are retrying. A store that can lose data gives you a probability rather than a guarantee.",
          flips:
            "Operations that are naturally idempotent, such as a pure cancellation by booking id, where a duplicate is already a no-op and the extra table earns nothing.",
        },
      },
    },
    {
      id: "inventory-svc",
      label: "Inventory service",
      sub: "one conditional UPDATE, sharded by hotel_id",
      kind: "service",
      x: 40,
      y: 420,
      w: 280,
      detail: {
        what: "Owns the smallest possible critical section: one statement that increments sold on every night of the stay where sold < allowance, and returns the dates it changed.",
        why: "Check and write in one statement means there is no read-then-write window and no application hop with the locks held open. Fewer rows back than nights is the availability check, and the rollback releases every row for free.",
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
      sub: "(hotel, room_type, date) -> sold, allowance",
      kind: "database",
      x: 440,
      y: 420,
      w: 240,
      detail: {
        what: "One row per bookable room-night, sharded by hotel_id, holding two independently owned counters plus price and restrictions.",
        why: "The two columns exist because two writers touch the row. The booking path owns sold and the nightly forecast job overwrites allowance, and neither has to read the other's value to write its own, which removes the read-modify-write race by construction.",
        numbers: ["5M hotels x 50 room types x 730 days = 182.5B rows", "~100B per row, ~18.25TB", "one touch every ~7,000 days on the mean row"],
        breaks:
          "Collapsing the two columns into a single available_count reintroduces the race: a job that runs at 02:00 and takes four minutes over a 500-hotel chain will occasionally resurrect inventory that was sold while it was thinking.",
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
    {
      id: "forecast-job",
      label: "Revenue forecast job",
      sub: "writes allowance nightly",
      kind: "service",
      x: 440,
      y: 520,
      w: 240,
      detail: {
        what: "A nightly job per property and room-type class that writes allowance as physical capacity plus a forecast-driven oversell. It never touches sold.",
        why: "Roughly one flexible booking in ten no-shows or cancels on the day, and an unsold room-night is revenue that never comes back. Overselling is the strategy; this job is what makes it a controlled number rather than an accident.",
        numbers: ["blended no-show ~10%", "critical fractile 200/(200+300) = 0.4", "120 rooms sold as 131, a 9% oversell"],
        breaks:
          "A stale or broken forecast writes an allowance far above policy, so the write path hard-clamps anything above physical x 1.2 and alerts rather than truncating silently. Classes below about 20 units get no oversell at all: with 8 suites the no-show mean is 0.8 and selling one extra walks a guest on 0.9^8 = 43% of nights.",
        choice: {
          pick: "Sell against a forecast allowance, enforced exactly by the transactional path",
          instead: "Put the physical room count in the row and never sell the 121st room.",
          decider:
            "Walk cost against nightly rate and class size. At $200 ADR and a ~$300 walk the critical fractile is 0.4, so a 120-room class oversells by 11 and recovers 11 x $200 = $2,200 a night against ~$270 of expected walk cost, roughly eight to one.",
          flips:
            "When units are not substitutable, so there is nothing to walk a guest into: unique listings, a 12-room boutique with no comparable property in town, or accessible and connecting rooms booked for a stated reason. Small classes too, where the arithmetic inverts.",
        },
      },
    },
    {
      id: "payment",
      label: "Payment provider",
      sub: "authorise now, capture later",
      kind: "external",
      x: 40,
      y: 560,
      w: 280,
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
      id: "bookings-table",
      label: "Bookings + saga state",
      sub: "status per step, partitioned by month",
      kind: "database",
      x: 440,
      y: 620,
      w: 240,
      detail: {
        what: "The reservation record and the saga's persisted state machine: INVENTORY_RESERVED, PaymentAuthorized, CONFIRMED, and the compensation states beside them.",
        why: "Five steps that each fail independently need state written at every transition, or a crashed orchestrator cannot tell what it already did. Compensations are keyed to (booking_id, step_id) and check the forward step is still applied, so re-running one is a no-op.",
        numbers: ["1M/day x 365 x 5 years = 1.825B rows, ~900GB", "row ~500B", "alert when the oldest non-terminal saga exceeds 60s"],
        breaks:
          "A naive release that runs sold = sold - 1 twice gives two rooms back, which is a silent undersell nobody notices until occupancy reports disagree. That is why compensations are keyed rather than blind.",
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
      id: "sweeper",
      label: "Expiry sweeper",
      sub: "leader-elected, 10 min hold",
      kind: "service",
      x: 440,
      y: 720,
      w: 240,
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
    {
      id: "notifications",
      label: "Notification + loyalty",
      sub: "retry queue, reconciled",
      kind: "queue",
      x: 40,
      y: 680,
      w: 280,
      detail: {
        what: "The downstream fan-out after CONFIRMED: confirmation email, loyalty accrual and any partner callbacks, all on a retry queue.",
        why: "The booking is already committed and durable by this point, so a missing email is not a lost booking. Never let email be how the user learns they booked: the reference number comes back on the confirmation response and is retrievable from the account.",
        numbers: ["fires after commit, never inside the ~2ms transaction", "1M confirmations/day"],
        breaks:
          "Loyalty accrual is the leg users actually notice missing, and a retry queue alone will not catch a silently dropped event, so it needs a reconciliation job rather than just retries.",
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
    {
      id: "search-index",
      label: "Search index",
      sub: "Elasticsearch, denormalised docs",
      kind: "database",
      x: 440,
      y: 120,
      w: 240,
      detail: {
        what: "A denormalised, eventually consistent copy of hotel documents with cached minimum prices and coarse availability, plus a geo index behind 'hotels within 5km'.",
        why: "It answers 'plausibly available' cheaply, and the booking path answers the real question authoritatively. It never touches the inventory table, which is what keeps a 4k/s peak read load off the write path entirely.",
        numbers: ["5M docs x ~5KB = 25GB primary, ~75GB with replica and analysis", "~10GB geo index", "sharded by city"],
        breaks:
          "It is allowed to be wrong and regularly is. The failure that actually hurts is out-of-order application, so events carry a monotonic log position and the indexer writes idempotently by key, or a slow partition regresses a document to an older state.",
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
      x: 440,
      y: 220,
      w: 240,
      detail: {
        what: "A stream of the transactional store's write log, denormalising hotel, price and availability changes into search documents.",
        why: "It is the only link between the two halves and it points one way: the transactional store feeds the index, never the reverse. Reading the write log means the index cannot miss a change that a dual write would drop.",
        numbers: ["cdc_lag_seconds under 5s p95", "alert on sustained lag above 30s", "chain-wide pushes of 500 hotels are normal"],
        breaks:
          "Lag spikes during a chain-wide inventory push, so results go stale and users see occasional NO_AVAILABILITY at the point of booking. Alerting on a spike rather than sustained lag trains people to ignore the page.",
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
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "search-svc",
      label: "search: city + dates",
      animated: true,
      detail: {
        what: "A search for a city, a date range and a guest count, hitting the cache first.",
        why: "This is where almost all of the traffic is: 43 searches for every booking, and around 400 reads per write once hotel-detail and calendar views are counted. Everything about the read path is shaped by that ratio.",
        numbers: ["~500/s average, ~4k/s peak", "~70% served from a 60-second cache"],
        breaks:
          "Sequential sweeps of a city and date grid are scrapers, not humans, and the same 60-second cache that makes search affordable also makes the scrape cheap for them.",
      },
    },
    {
      id: "e2",
      from: "search-svc",
      to: "search-index",
      label: "20 results, ~50ms",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The query into the denormalised index: geo filter, date filter, then ranking, returning about 20 hotel documents.",
        why: "Availability in the index is deliberately coarse. It exists to say 'plausibly available' so the result set is small and cheap, and the authoritative answer is deferred to the write path.",
        numbers: ["~1.2k/s reaching the index at peak", "~50ms per query"],
        breaks:
          "A stale document means the user clicks a room that has gone. That costs one NO_AVAILABILITY and a re-search, which is friction and not a correctness failure.",
      },
    },
    {
      id: "e3",
      from: "client",
      to: "booking-svc",
      label: "POST /booking + key",
      animated: true,
      fromSide: "right",
      toSide: "right",
      offset: 110,
      detail: {
        what: "The booking request carrying hotel, room type, check-in, check-out, guest and a client-generated idempotency key.",
        why: "The key is on the request rather than derived server-side because only the client knows that a retry after a dropped connection is the same intent as the attempt it never saw a response to.",
        numbers: ["~12/s average, ~120/s peak", "p99 under 5s is the SLO"],
        breaks:
          "This is the hop that silently duplicates. The response can be lost after the booking commits, so the client retries a booking that already exists and the server has to recognise it.",
      },
    },
    {
      id: "e4",
      from: "booking-svc",
      to: "idempotency",
      label: "insert key, unique index",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Inserting (idempotency_key, booking_id) under a unique constraint, in the same transaction as the decrement.",
        why: "A duplicate insert failing the constraint is how a retry is detected, and the handler returns the existing booking rather than starting a second one. Doing it in the same transaction means a rolled-back stay does not leave a key claimed.",
        numbers: ["cache hit on the fast path, constraint as the guarantee"],
        breaks:
          "If this record can be lost, the guarantee degrades to a probability, and it degrades exactly during a burst when retries are most likely.",
      },
    },
    {
      id: "e5",
      from: "booking-svc",
      to: "inventory-svc",
      label: "reserve 3 room-nights",
      animated: true,
      detail: {
        what: "The request to take every night of the stay: all of them or none.",
        why: "A three-night stay is three rows and a partial reservation is meaningless to a guest, so atomicity across the range is the contract this hop carries. Rate plan resolution happens before it, as a pure read against a price snapshot.",
        numbers: ["3.2 nights average", "3.2M decrements/day, ~37/s"],
        breaks:
          "Two UPDATEs over date sub-ranges for mixed rate plans are fine only while both still run in ascending date order; break that and the deadlock property goes with it.",
      },
    },
    {
      id: "e6",
      from: "inventory-svc",
      to: "inventory-table",
      label: "conditional UPDATE, ~2ms",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "UPDATE inventory SET sold = sold + 1 WHERE ... AND date >= ? AND date < ? AND sold < allowance RETURNING date.",
        why: "One statement rather than SELECT ... FOR UPDATE then UPDATE, because the two-round-trip version holds locks across an application hop, a garbage-collection pause and whatever else the service is doing.",
        numbers: ["locks held ~2ms including commit", "rowcount < nights means ROLLBACK", "~500 attempts/s per row"],
        breaks:
          "Ascending index order is what stops two overlapping stays deadlocking. It depends on the planner choosing an index scan, and a sequential scan on a small test table hides the property until the table is large.",
      },
    },
    {
      id: "e7",
      from: "forecast-job",
      to: "inventory-table",
      label: "writes allowance nightly",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The nightly overwrite of allowance from a demand and no-show forecast, touching one column and never reading sold.",
        why: "Column ownership is the whole point of this arrow. The job writes freely because it needs nothing from the booking path, so a four-minute run over a 500-hotel chain cannot race live bookings.",
        numbers: ["physical + 5 to 15% oversell", "hard clamp at physical x 1.2", "no oversell below ~20 units"],
        breaks:
          "A date whose cancellations in the last hour ran 5x above normal has a count that no longer reflects demand, so oversell is suppressed there until the forecast has seen the new data.",
      },
    },
    {
      id: "e8",
      from: "booking-svc",
      to: "bookings-table",
      label: "saga state + status",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Writing the booking row as INVENTORY_RESERVED in the inventory transaction, then persisting each saga transition through to CONFIRMED.",
        why: "State at every transition is what makes a crash recoverable: a resume worker replays from the last persisted step, and forward-step idempotency keys make re-running it safe.",
        numbers: ["5 transitions", "oldest non-terminal saga age is the alert"],
        breaks:
          "Modelling cancellation as the same transition as compensation is a common and expensive simplification. They converge on sold = sold - 1 and diverge on refund policy, notifications and pricing everywhere else.",
      },
    },
    {
      id: "e9",
      from: "booking-svc",
      to: "payment",
      label: "authorise, not capture",
      animated: true,
      fromSide: "left",
      toSide: "left",
      offset: 110,
      detail: {
        what: "The authorisation call, made after the inventory transaction has already committed.",
        why: "This is the arrow that must not be inside the transaction. Authorisation takes 200ms to 30 seconds, so holding row locks across it would drop a single row from ~500 attempts/s to about 5/s and pin a database connection per user staring at a card form.",
        numbers: ["200ms to 30s", "idempotency key = booking_id + ':auth'"],
        breaks:
          "If it fails, the compensation decrements sold on the same rows keyed to this booking id. If it succeeds after the sweeper has already released those rows, the confirm step voids it instead.",
      },
    },
    {
      id: "e10",
      from: "booking-svc",
      to: "notifications",
      label: "confirmation + loyalty",
      fromSide: "left",
      toSide: "left",
      offset: 190,
      detail: {
        what: "The post-confirmation fan-out: confirmation email, loyalty accrual and partner callbacks, emitted once the booking is CONFIRMED.",
        why: "These are downstream effects of a booking that is already durable, so they belong on a retry queue rather than in the critical path. The user learns their reference number from the response, not the email.",
        numbers: ["1M confirmations/day", "emitted after commit"],
        breaks:
          "Loyalty accrual is where a dropped event is actually noticed, and retries alone do not catch a silent drop, so it needs reconciliation.",
      },
    },
    {
      id: "e11",
      from: "inventory-table",
      to: "cdc",
      label: "WAL stream",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "The transactional store's write-ahead log being tailed for inserts and updates to hotels, prices and availability.",
        why: "Reading the log rather than dual-writing means the index inherits the transaction's durability: a change that committed cannot fail to be published, because publishing is downstream of the commit rather than beside it.",
        numbers: ["events carry a monotonic log position"],
        breaks:
          "Tailing the log ties the pipeline to the database's replication slots, and a stalled consumer holds WAL on the primary, so a dead indexer becomes a disk-space problem on the store it reads from.",
      },
    },
    {
      id: "e12",
      from: "cdc",
      to: "search-index",
      label: "reindex, <5s p95",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Denormalised hotel documents being written into the index, idempotently by key.",
        why: "This is the only arrow between the two halves of the system and it points one way. Search is allowed to be seconds behind precisely because the booking path re-checks, so a stale hit costs one NO_AVAILABILITY.",
        numbers: ["<5s p95 lag", "alert on sustained lag above 30s"],
        breaks:
          "Out-of-order application, not lag, is the real failure: without writing idempotently by key against a monotonic position, a slow partition can regress a document to an older state.",
      },
    },
    {
      id: "e13",
      from: "sweeper",
      to: "bookings-table",
      label: "scan INVENTORY_RESERVED",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Scanning for bookings still in INVENTORY_RESERVED past the 10-minute hold, oldest first.",
        why: "The reserved state is the observable form of an abandoned checkout, and it is the same state a crashed saga leaves behind, so one scan covers both.",
        numbers: ["10-minute threshold", "processed oldest-first on restart"],
        breaks:
          "If the sweeper stops, this count rises silently while bookings keep succeeding, so the alarm is on the age of the oldest reserved booking rather than on the sweeper's own uptime.",
      },
    },
    {
      id: "e14",
      from: "sweeper",
      to: "inventory-table",
      label: "release after 10 min",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 170,
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
