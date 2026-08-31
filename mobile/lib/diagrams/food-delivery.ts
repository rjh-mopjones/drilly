import type { Diagram } from "./types";

export const FOOD_DELIVERY: Diagram = {
  id: "food-delivery",
  title: "Food Delivery",
  question: "Design DoorDash (a Food Delivery Platform)",
  sourceId: "patterns",
  itemId: 62,
  overview: {
    shape:
      "A three-sided marketplace run as a control loop. Orders and couriers meet in a 10-second batch match that optimises predicted lateness, and the predictions are trained on what actually happened. Every party's app is a view of one order state machine.",
    forces: [
      {
        constraint: "Food is ready at a time nobody controls, with a prediction error of ~7 minutes",
        decision: "The Dispatch engine times assignment so the courier arrives near food-ready, and the Prediction service learns prep times from courier-arrival ground truth",
        lights: ["dispatch", "eta", "e12"],
      },
      {
        constraint: "Matching one order at a time to the nearest courier wastes the courier the next order needed",
        decision: "Dispatch matches each zone's orders and couriers in a 10-second batch, minimising total predicted lateness, including couriers who free up mid-batch",
        lights: ["dispatch", "e4", "e8"],
      },
      {
        constraint: "300k couriers ping every 5 seconds: 60k location updates a second, forever",
        decision: "Pings flow through the Location stream once and fan to two cheap consumers: the courier board for matching, and per-order tracking for the one customer watching",
        lights: ["loc", "tracker", "e7", "e9"],
      },
      {
        constraint: "A quoted 35 minutes is a promise made before the restaurant has even confirmed",
        decision: "Restaurant discovery quotes from live predictions plus a buffer, and a slammed kitchen widens its quote or pauses ordering rather than breaking promises",
        lights: ["search", "eta", "e10", "e11"],
      },
      {
        constraint: "3 independent parties can each fail after money has moved",
        decision: "The Order service owns one state machine with idempotent transitions; payment authorises at checkout and captures only on delivery",
        lights: ["order-svc", "order-db", "pay", "e2", "e13"],
      },
    ],
    naive: {
      text: "Treat it like ride-hailing: when an order is paid, assign the nearest free courier immediately. The courier drives 4 minutes and then stands in a queue for 11, because the food needed 15 more minutes and nearest-and-now ignores the kitchen entirely. Meanwhile the courier who would have been perfect for the next order, finishing a drop 2 minutes from that restaurant, was skipped for being busy. At ~12 orders a minute per zone at dinner, greedy immediate assignment measurably wastes courier-hours on restaurant queues and still delivers cold food. The fix is to stop matching people and start matching times: batch the zone every 10 seconds and assign against predicted food-ready and predicted arrival, not current distance.",
      lights: ["dispatch", "eta"],
    },
    beats: [
      {
        text: "A customer browses Restaurant discovery: nearby, open, and quoting a delivery estimate computed from live predictions, prep at this kitchen right now, drive time, courier supply. Checkout hits the Order service with an idempotency key, which authorises payment, writes the order's state machine row, and pushes the order to the Restaurant tablet for confirmation.",
        lights: ["eater", "search", "order-svc", "e1", "e10", "e9"],
      },
      {
        text: "The Order store holds one row per order and its transition log: placed, confirmed, preparing, ready, assigned, picked up, delivered, plus the exception states, cancelled and refunded. Every transition is idempotent and every party's app renders from this one machine, so the customer, the kitchen and the courier can disagree about nothing except the future.",
        lights: ["order-db", "e2"],
      },
      {
        text: "Confirmation starts the clock that matters: predicted food-ready. The Prediction service estimates prep from the restaurant's history, the time of day, and its live load, order count in the kitchen now. The prediction carries its uncertainty, and both numbers go to dispatch, because when to assign depends on how wrong the estimate might be.",
        lights: ["eta", "resto", "e3", "e12"],
      },
      {
        text: "The Dispatch engine runs each zone on a 10-second tick. It holds a courier board built from the Location stream: who is online, where, and, crucially, when they free up, a courier dropping off 3 minutes away is a candidate. Each tick matches the zone's unassigned orders against available-soon couriers, minimising total predicted lateness, and stacking two orders when one courier can serve both without breaking either promise.",
        lights: ["dispatch", "loc", "e4", "e8"],
      },
      {
        text: "Assignment is timed, not instant. The engine aims the courier's arrival at predicted food-ready. An order confirmed at 18:02 with food-ready 18:19 and a 6-minute drive is offered around 18:11 to the courier who fits best, not at 18:02 to whoever is nearest. An offer gives the courier 20 seconds to accept before cascading to the next candidate.",
        lights: ["dispatch", "courier", "e5"],
      },
      {
        text: "The Courier app pings the Location stream every 5 seconds, 60k updates a second fleet-wide. The stream feeds exactly two consumers. The courier board consumes everything, cheaply, into per-zone in-memory state. Tracking + push forwards only pings of couriers on active orders to the single customer watching each one, smoothed and snapped to roads, so 60k in becomes ~50k targeted out.",
        lights: ["courier", "loc", "tracker", "e6", "e7", "e9"],
      },
      {
        text: "Status flows back through the same machine: courier accepts, arrives, picks up, delivers, each an idempotent transition with a timestamp. Those timestamps are the training data. Courier-arrival versus food-ready is the prep-prediction error, measured on every order, which lets the Prediction service improve weekly without anyone labelling anything.",
        lights: ["courier", "order-svc", "eta", "e14", "e12"],
      },
      {
        text: "Delivery captures the payment that checkout only authorised, and the promise is scored: quoted 35, delivered in 33. The loop's health lives in two numbers: on-time rate against quotes, and courier minutes wasted waiting at restaurants. Every component above exists to move one of them without breaking the other.",
        lights: ["order-svc", "pay", "e13"],
      },
    ],
    crux: {
      problem:
        "Dispatch must commit a courier against a moment nobody controls: when the kitchen actually finishes. Assign early and couriers stand in queues, burning the supply the next orders need. Assign late and food dies under a heat lamp while a customer watches a stalled dot.",
      handled:
        "Timing over distance. Assignment is aimed at predicted food-ready minus predicted drive, re-evaluated every 10-second tick until a courier is en route. A kitchen running late slides its assignment later instead of stranding a courier. The prediction carries uncertainty, and dispatch pads by it. High-variance kitchens get couriers slightly late on purpose, because a waiting courier costs the marketplace more than a 2-minute-old handoff costs the meal. What remains: prep estimates are learned from noisy, partly self-reported kitchens, and a restaurant having an unusual night defeats the model. The 'slammed' throttle, the kitchen pausing intake, is the honest fallback, and it costs orders.",
    },
    numbers: [
      {
        value: "~2M orders/day, ~100/s at dinner peak",
        explain: "Concentrated in ~3 evening hours across ~500 city zones: ~12 orders a minute in a busy zone. That is why dispatch is per zone, and why a 10s batch holds only a handful of orders.",
      },
      {
        value: "60k location pings/s",
        explain: "300k online couriers at one ping per 5s. Written once to the stream, consumed twice; never written per ping to any database.",
      },
      {
        value: "prep ~15 min, error ~7 min",
        explain: "The uncertainty that shapes dispatch: with a 6-min drive, assignment timing matters more than courier choice, and the batch re-evaluates until someone is actually en route.",
      },
      {
        value: "10s dispatch tick per zone",
        explain: "Fast enough that assignment lag is noise against a 35-min promise; slow enough to batch, so the matcher chooses among couriers instead of grabbing the nearest.",
      },
      {
        value: "20s offer window, ~80% first-offer accept",
        explain: "A declined offer cascades to the next candidate; the tick's plan already priced the risk, so a decline costs seconds, not a re-plan.",
      },
    ],
  },
  nodes: [
    {
      id: "eater",
      label: "Customer app",
      kind: "client",
      sub: "browse, order, watch the dot",
      col: 0,
      row: 0,
      detail: {
        what: "The demand side: browse restaurants with live quotes, check out, then watch the order's state and the courier's dot until the doorbell.",
        why: "After checkout the app is pure output: every screen renders from the order state machine and the tracking feed. The customer can change nothing but a tip and a cancellation, which keeps the client thin and the truth server-side.",
        numbers: [
          { value: "~2M orders/day from ~20M sessions", explain: "A ~10% session-to-order rate; browsing load dominates ordering load 10 to 1." },
          { value: "~1 tracking watcher per active order", explain: "The fan-out shape: tracking is millions of 1:1 feeds, not one feed to millions." },
        ],
        breaks: {
          failure: "Checkout is tapped twice on a slow network and two orders hit the kitchen.",
          handled: "The cart carries an idempotency key; the second submit returns the first order. One meal, one charge, however flaky the network.",
        },
      },
    },
    {
      id: "order-svc",
      label: "Order service",
      kind: "service",
      sub: "owns the state machine",
      col: 1,
      row: 0,
      detail: {
        what: "The transaction script of the marketplace: validates checkout, authorises payment, drives the order through its states, and notifies each party as transitions land.",
        why: "Three parties act independently, so one component must own what an order is. Every transition is guarded, preparing cannot follow cancelled, idempotent on (order, transition), and timestamped, because those timestamps are both the customer's status screen and the prediction service's training data.",
        numbers: [
          { value: "~100 orders/s peak, ~8 transitions each", explain: "~800 state writes/s at dinner: comfortably one Postgres with room to shard by city if it ever is not." },
          { value: "2 money steps: auth, then capture", explain: "Authorise at checkout, capture at delivery: the money mirrors the state machine, and nothing is taken for food that never arrived." },
        ],
        breaks: {
          failure: "The restaurant confirms while the customer cancels: two valid transitions race.",
          handled: "Transitions serialise on the order row; the loser of the race gets the current state back and the apps reconcile. A cancel that loses to confirm becomes a cancellation request with its own rules, not a silent override.",
        },
        choice: {
          pick: "One explicit state machine with guarded, idempotent transitions",
          instead: "Each service updating order fields it cares about, status as a column.",
          decider:
            "Race count. Three parties x retries x notifications means every pair of writers eventually collides; a guarded machine turns each collision into a defined outcome. Field soup turns it into a support ticket. The transition log is also the audit trail refunds are argued from.",
          flips: "A single-restaurant ordering site, one party, no courier, where a status column genuinely is enough.",
        },
      },
    },
    {
      id: "resto",
      label: "Restaurant tablet",
      kind: "client",
      sub: "confirm, prep, mark ready",
      col: 2,
      row: 0,
      detail: {
        what: "The kitchen's terminal: new orders ring here, get confirmed with an initial prep estimate, and are marked ready when the bag is sealed.",
        why: "The kitchen is the least instrumented party and the biggest source of uncertainty, so the tablet asks for little and verifies what it can. Confirm and ready are the two taps that matter; ready timestamps are calibrated against courier pickup times because kitchens under pressure tap late.",
        numbers: [
          { value: "~1 min to confirm, or the order escalates", explain: "An unconfirmed order pages the restaurant by phone and then offers the customer a cancel; silence cannot strand a paid order." },
          { value: "self-reported ready is ~3 min optimistic", explain: "Measured against courier pickups; the prediction service learns the per-restaurant bias rather than trusting the tap." },
        ],
        breaks: {
          failure: "The tablet loses connectivity mid-service and the kitchen goes dark to the platform.",
          handled: "Orders in flight continue on predictions; new intake for the restaurant pauses after 2 missed heartbeats; the tablet reconciles its queue from the order store on reconnect. Dark kitchens take no new promises.",
        },
      },
    },
    {
      id: "pay",
      label: "Payment provider",
      kind: "external",
      sub: "auth, capture, refund",
      col: 3,
      row: 0,
      detail: {
        what: "The external processor: card authorisation at checkout, capture on delivery, refunds on the exception paths.",
        why: "Money is deliberately boring here: the platform's ledger problems are the payment-system design's subject, and this design consumes it through three idempotent calls tied to state transitions.",
        numbers: [
          { value: "auth ~200ms on the checkout path", explain: "The one external call the customer waits on; capture and refund run async off transitions." },
        ],
        breaks: {
          failure: "Capture fails after successful delivery, expired auth, card dead.",
          handled: "Delivery stands, the meal is not repossessed; capture retries with backoff, then dunning. The state machine records delivered-uncaptured explicitly, so finance sees it as a queue, not a mystery.",
        },
      },
    },
    {
      id: "tracker",
      label: "Tracking + push",
      kind: "service",
      sub: "per-order dot, smoothed",
      col: 0,
      row: 1,
      detail: {
        what: "The service that turns raw courier pings into each customer's live map: filter to active orders, smooth the track, snap to roads, push over the customer's connection.",
        why: "Tracking is emotionally load-bearing: the dot is why nobody phones support. It is also computationally cheap if shaped right: each active order has exactly one watcher, so this is ~50k targeted forwards a second, not a broadcast.",
        numbers: [
          { value: "~1.5M active orders at peak, 1 watcher each", explain: "A courier on a stacked pair feeds two watchers; the fan-out never exceeds the stack size." },
          { value: "~5s update cadence, ~30s ETA refresh", explain: "The dot moves per ping; the ETA recomputes less often because a twitchy ETA reads as broken." },
        ],
        breaks: {
          failure: "Urban-canyon GPS scatters pings across three blocks and the dot teleports.",
          handled: "A road-snapping filter carries velocity and heading; implausible jumps are discarded and the dot interpolates along the route. The customer sees a slightly delayed, believable dot rather than an honest chaotic one.",
        },
        choice: {
          pick: "Push per-order updates over the app's existing connection",
          instead: "The app polling an order-status endpoint every few seconds.",
          decider:
            "Freshness per request. ~1.5M active orders polling every 3s is ~500k requests/s, mostly answering 'no change'. Push sends only the ~300k/s of pings that actually moved a dot, over connections the apps already hold.",
          flips: "Low order volumes where polling's simplicity wins and the waste is a rounding error.",
        },
      },
    },
    {
      id: "order-db",
      label: "Order store",
      kind: "database",
      sub: "Postgres: rows + transition log",
      col: 1,
      row: 1,
      detail: {
        what: "The system of record: one row per order, a transition log per order, and the assignment linking order to courier.",
        why: "Everything renders from here and every dispute replays from here. The transition log's timestamps are doubly load-bearing: they drive customer status, and they are the labels the prediction service trains on. Transitions are therefore written even when nobody is watching the screen.",
        numbers: [
          { value: "~800 writes/s peak", explain: "Tiny for a relational store; the value is the guarantees, serialised transitions per row, not the throughput." },
          { value: "~2M orders/day, ~2KB each", explain: "~4GB/day with the log; retained for years because disputes, taxes and training all read history." },
        ],
        breaks: {
          failure: "A hot zone's reads, every app polling status, pile onto the primary.",
          handled: "Apps get push on transition, not polling, and status reads go to replicas with read-your-writes pinned only for the party that just acted. The primary spends itself on transitions.",
        },
        choice: {
          pick: "Relational store, transitions serialised per order row",
          instead: "An event-sourced log per order with materialised views.",
          decider:
            "The guard rules. Cancel-vs-confirm races need serialised, guarded writes, which is a transaction on a row. At ~800 writes/s the relational store does this natively; the event-sourced version rebuilds the same guarantee by hand.",
          flips: "Order volume 100x with cross-region writes, where a single primary becomes the constraint and the rebuild starts paying.",
        },
      },
    },
    {
      id: "dispatch",
      label: "Dispatch engine",
      kind: "service",
      sub: "10s batch match per zone",
      col: 2,
      row: 1,
      detail: {
        what: "The matcher: per zone, every 10 seconds, assign unassigned orders to couriers, minimising total predicted lateness. Candidates include couriers about to free up, and two orders stack when one courier can serve both without breaking either.",
        why: "Batching is what makes the choice real. In 10 seconds a busy zone accumulates 2 orders and frees 3 couriers, and the matcher picks the assignment a greedy loop cannot see. Timing is what makes it food-aware: offers go out when predicted arrival meets predicted food-ready, and until a courier is en route the plan re-evaluates every tick.",
        numbers: [
          { value: "~600 couriers, ~12 orders/min per busy zone", explain: "The per-zone problem is small, dozens by dozens, so optimal assignment runs in milliseconds; the cleverness is in the cost function, not the solver." },
          { value: "~15% of dinner orders stacked", explain: "Same restaurant or same direction within the promise; stacking is the single biggest courier-efficiency lever." },
        ],
        breaks: {
          failure: "A zone runs dry: orders arrive and no courier can reach food-ready in time.",
          handled: "The engine widens the search to neighbouring zones with a drive-time penalty, and raises the zone's quoted ETAs at discovery so new promises stay keepable. Past a threshold it pauses low-value intake. Supply incentives are the marketplace's lever, not this engine's.",
        },
        choice: {
          pick: "Zone-batched optimal assignment on predicted lateness",
          instead: "Greedy nearest-free-courier per order, assigned at payment.",
          decider:
            "Courier minutes. Greedy-at-checkout sends couriers to stand in restaurant queues for the full prep-prediction error, ~7 minutes of paid waiting per order, and blind-spots couriers finishing deliveries. The batch with future availability cuts waiting to ~2 minutes and lifts stacking from ~0 to ~15%.",
          flips: "Ride-hailing, where the passenger is ready the moment they book: nearest-and-now is then correct, and batching only adds latency.",
        },
      },
    },
    {
      id: "eta",
      label: "Prediction service",
      kind: "service",
      sub: "prep + drive + uncertainty",
      col: 3,
      row: 1,
      detail: {
        what: "The models behind every promise: prep time per restaurant given time and live load, drive time given traffic, each with an uncertainty band.",
        why: "Every important decision upstream is really a prediction consumer: discovery's quote, dispatch's timing, the customer's countdown. Predictions ship with variance because the consumers act on it differently: dispatch pads assignment timing by it, discovery pads the quote by it.",
        numbers: [
          { value: "prep ~15 min median, error ~7 min", explain: "Per-restaurant models cut error to ~4 min for well-observed kitchens; the long tail of quiet restaurants stays noisy." },
          { value: "~2M ground-truth pairs a day", explain: "Courier arrival vs food-ready is measured on every order; no labelling, just the state machine's log." },
        ],
        breaks: {
          failure: "A kitchen has an abnormal night, a party of 40, a fryer down, and the model confidently misses.",
          handled: "Live load features, orders in kitchen and confirm-to-ready drift tonight, pull predictions toward the anomaly within ~15 minutes, and the slammed throttle lets the restaurant pause intake. The first few orders of an anomaly are simply late; the model bounds how long the bleeding lasts, not whether it starts.",
        },
        choice: {
          pick: "Learned per-restaurant predictions with live-load features and variance",
          instead: "Static prep estimates entered by the restaurant at onboarding.",
          decider:
            "Static entries are wrong the day they are typed, kitchens estimate their calm-night selves, and drift monotonically worse. Learned prep on ~2M daily ground-truth measurements halves the error, and the variance output is what makes dispatch timing and honest quoting possible at all.",
          flips: "A tiny marketplace, tens of restaurants, where there is not enough data per kitchen to learn and a curated estimate plus a big buffer is honest.",
        },
      },
    },
    {
      id: "search",
      label: "Restaurant discovery",
      kind: "service",
      sub: "geo + open + honest quotes",
      col: 0,
      row: 2,
      detail: {
        what: "The browse surface: nearby restaurants filtered by open hours and delivery range, each carrying a live quote and a capacity state.",
        why: "The quote at browse time is the promise the rest of the system must keep, so discovery reads the same predictions dispatch uses, padded toward keepability. Capacity is a first-class state: a slammed kitchen quotes wider, then pauses, because declining an order beats breaking it.",
        numbers: [
          { value: "~2k browse requests/s peak", explain: "Geo query + hours + quote assembly, cached per (zone, restaurant) for ~30s; browsing is 10x ordering." },
          { value: "quote = prediction + buffer to ~90% keepable", explain: "The buffer is priced: wider quotes lose conversion, broken quotes lose customers; ~90% on-time is the tuned point." },
        ],
        breaks: {
          failure: "Stale cached quotes during a demand spike promise 35 minutes into a zone already running 55.",
          handled: "Zone pressure, unassigned orders per available courier, feeds a quote multiplier refreshed every 30s, and checkout re-validates the quote: a customer who lingered sees the honest new number before paying.",
        },
        choice: {
          pick: "Quotes assembled from the same predictions dispatch is judged by",
          instead: "A separate, simpler quoting heuristic owned by the discovery team.",
          decider:
            "One source of truth for the promise. Two estimators drift apart, and the gap between them is exactly the broken-promise rate: quoting from the dispatch-grade prediction plus a tuned buffer holds ~90% on-time by construction.",
          flips: "A marketplace so small that predictions barely beat a per-restaurant constant, where one number and a wide buffer is honest enough.",
        },
      },
    },
    {
      id: "loc",
      label: "Location stream",
      kind: "queue",
      sub: "60k pings/s, 2 consumers",
      col: 1,
      row: 2,
      detail: {
        what: "The firehose of courier positions: one append per ping, partitioned by zone, read by the courier board and the tracker.",
        why: "Location data is high-volume, low-value-per-point, and instantly stale, so it is never written to a database per ping. A stream with two in-memory consumers gets both uses of the data for one write path, and its retention is minutes because old positions are worthless.",
        numbers: [
          { value: "60k pings/s, ~100B each: ~6MB/s", explain: "Trivial bytes; the design point is the consumer shapes, not the volume." },
          { value: "~10 min retention", explain: "Enough to rebuild the courier board after a consumer restart; location history for disputes lives in per-order snapshots taken by the tracker." },
        ],
        breaks: {
          failure: "A courier's phone sleeps and pings stop while they drive on.",
          handled: "The board ages positions and widens their uncertainty rather than freezing them; a courier silent for 60s on an active order triggers an app wake push, then a call. Assignment never trusts a stale point as current.",
        },
        choice: {
          pick: "A short-retention stream with two in-memory consumers",
          instead: "Writing every ping into a courier-locations table and querying it.",
          decider:
            "Write amplification for instantly dead data. 60k row writes a second buy a table that is stale in 5 seconds and read two ways at most. One stream append feeds both consumers, and each holds only the state it needs in memory.",
          flips: "A small fleet, a few hundred couriers, where the table is trivially cheap and the stream is machinery.",
        },
      },
    },
    {
      id: "courier",
      label: "Courier app",
      kind: "client",
      sub: "pings, offers, status taps",
      col: 2,
      row: 2,
      detail: {
        what: "The supply side: streams location every 5s, receives offers with pickup, drop and expected pay, and taps the status transitions the whole system runs on.",
        why: "The courier is the only party paid by the tap, so the app is built for one-thumb honesty. Arrived, picked up, delivered: each a guarded transition whose timestamp becomes training data.",
        numbers: [
          { value: "20s offer window, ~80% first accept", explain: "Offers carry enough to decide, distance, pay, restaurant wait history; declines cascade within the tick's plan." },
          { value: "1 ping per 5s, batched on poor signal", explain: "The app buffers and back-fills pings through dead zones so the track is complete even when late." },
        ],
        breaks: {
          failure: "A courier accepts, drives toward pickup, then goes dark or abandons.",
          handled: "En-route progress is monitored against the route; stalled-and-silent past 3 minutes triggers contact, then reassignment of the order and an adjustment on the courier's record. The customer's dot degrades to a status message rather than a lie.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "eater",
      to: "order-svc",
      tier: "hot",
      step: 1,
      label: "checkout, idempotent",
      detail: {
        what: "The paid order: cart, address, quoted promise, idempotency key; payment authorises inline and the order row is created.",
        why: "This is the moment a browse becomes a promise. The quote is re-validated here so a stale browse cannot buy a broken commitment.",
        numbers: [{ value: "~100/s peak, ~400ms end-to-end", explain: "Dominated by the payment auth; everything after is async to the customer." }],
        breaks: {
          failure: "Auth succeeds but the order write fails, money held for no order.",
          handled: "Auth and order-create wrap in an outbox pattern: the auth is voided by a reconciler if no order row exists within a minute. The customer sees one failure, not a phantom charge.",
        },
      },
    },
    {
      id: "e2",
      from: "order-svc",
      to: "order-db",
      tier: "hot",
      step: 2,
      label: "guarded transitions",
      detail: {
        what: "Every state change written as a serialised, guarded transition on the order row, with its timestamp appended to the log.",
        why: "The single-writer-per-order rule is the system's concurrency model: three parties race, the row arbitrates, and each transition is idempotent so retries collapse.",
        numbers: [{ value: "~800 transitions/s at peak", explain: "8 per order across its life; the store's real job is the guarantees, not the volume." }],
        breaks: {
          failure: "A notification fires but the transition write rolled back, apps show a state that never was.",
          handled: "Notifications publish from the transition log after commit (an outbox), never from the service's intent, so what the apps hear is only ever what the store recorded.",
        },
      },
    },
    {
      id: "e3",
      from: "order-svc",
      to: "resto",
      tier: "hot",
      step: 3,
      label: "order → tablet, confirm",
      detail: {
        what: "The new order pushed to the kitchen's tablet; the confirm tap and later the ready tap come back as transitions.",
        why: "Confirmation is the kitchen accepting the promise, and it starts prep prediction. The 1-minute escalation exists because a paid order stranded on a silent tablet is the worst minute in the product.",
        numbers: [{ value: "~1 min confirm SLO", explain: "Then phone escalation, then customer-facing cancel with apology credit; silence has a bounded cost." }],
        breaks: {
          failure: "Tablet acks the push but the kitchen never saw it, volume down, screen off.",
          handled: "Unconfirmed orders re-ring with escalating sound and the escalation path assumes the human, not the network, is the failure. The metric watched is confirm time per restaurant, which also feeds its ranking in discovery.",
        },
      },
    },
    {
      id: "e4",
      from: "order-svc",
      to: "dispatch",
      tier: "hot",
      step: 4,
      label: "courier needed, ready_at",
      detail: {
        what: "The confirmed order entering the zone's dispatch pool with its predicted food-ready and the promise it must meet.",
        why: "Orders enter the pool at confirm, not at assignment time. The matcher therefore sees the zone's near future, everything needing a courier in the next 20 minutes, and can plan instead of react.",
        numbers: [{ value: "orders wait ~5-10 min in-pool by design", explain: "The gap between confirm and the timed offer is the whole point: it is when the choice space exists." }],
        breaks: {
          failure: "A prediction update moves food-ready earlier and the planned assignment is now too late.",
          handled: "Pool entries re-sort every tick with fresh predictions; a moved-up order jumps the plan and, at worst, is offered immediately with the lateness priced into which courier gets it.",
        },
      },
    },
    {
      id: "e5",
      from: "dispatch",
      to: "courier",
      tier: "hot",
      step: 5,
      label: "offer: 20s to accept",
      detail: {
        what: "The assignment offer pushed to the chosen courier: pickup, drop, expected wait, pay; accept starts the en-route leg.",
        why: "Couriers are contractors choosing work, so assignment is an offer with a deadline, and the matcher's plan pre-ranks fallbacks so a decline cascades in seconds without re-solving the zone.",
        numbers: [
          { value: "~80% first-offer accept", explain: "Offer quality is a health metric: falling accept rates mean the pay or the wait predictions have drifted from reality." },
        ],
        breaks: {
          failure: "The offer expires unanswered on a phone in a pocket.",
          handled: "Cascade to the next candidate at 20s; three unanswered offers marks the courier away and stops offering them, so sleeping phones do not eat assignment time.",
        },
      },
    },
    {
      id: "e6",
      from: "tracker",
      to: "eater",
      tier: "hot",
      step: 6,
      label: "live dot + countdown",
      detail: {
        what: "The customer's feed: order state, the smoothed courier dot once en route, and a countdown refreshed every ~30s.",
        why: "The dot is the support-call killer: a believable moving map answers where is my food before it is asked. It is pushed over the app's existing connection, one watcher per order.",
        numbers: [{ value: "~1.5M concurrent feeds at peak", explain: "Each ~1 message per 5s while en route: ~300k pushes/s fleet-wide, cheap fan-out because it is 1:1." }],
        breaks: {
          failure: "The countdown jumps upward, 12 minutes becomes 19, and trust breaks.",
          handled: "ETA updates are damped and one-way sticky within a window: small improvements show, regressions accumulate before showing. A real slip shows once, with a reason (kitchen running behind), rather than twitching.",
        },
      },
    },
    {
      id: "e7",
      from: "courier",
      to: "loc",
      tier: "data",
      label: "ping / 5s, batched",
      detail: {
        what: "The position stream: one small append per courier per 5 seconds, buffered through dead zones and back-filled late.",
        why: "One write path for all location uses; the app never talks to the board or the tracker directly, so consumers can change freely behind the stream.",
        numbers: [{ value: "60k appends/s, ~6MB/s", explain: "Partitioned by zone so each board consumer reads only its own city's slice." }],
        breaks: {
          failure: "Clock-skewed phones stamp pings in the wrong order.",
          handled: "Server receive time orders the stream; the phone's timestamps ride along for the smoothing filter but never define sequence.",
        },
      },
    },
    {
      id: "e8",
      from: "loc",
      to: "dispatch",
      tier: "data",
      label: "courier board feed",
      detail: {
        what: "The board consumer folding pings into per-zone in-memory state: position, heading, current task, predicted free-at.",
        why: "Free-at is the field that changes everything. A courier 3 minutes from finishing a drop near the restaurant beats a free courier 10 minutes away, and only the board knows it.",
        numbers: [{ value: "rebuildable in ~1 min from the stream", explain: "The board is soft state; a dispatch restart replays the last minutes of pings and assignments and is whole again." }],
        breaks: {
          failure: "Board and reality drift, a courier marked en route actually declined via a lost message.",
          handled: "Assignments are leases confirmed by the courier's accept transition in the order store; the board reconciles against the store every tick, and the store wins.",
        },
      },
    },
    {
      id: "e9",
      from: "loc",
      to: "tracker",
      tier: "data",
      label: "active-order pings only",
      detail: {
        what: "The tracker's filtered consumption: pings of couriers currently on orders, joined to their watcher.",
        why: "The filter is the economics: ~50k of 60k pings/s matter to exactly one customer each, and the rest matter to nobody but the board.",
        numbers: [{ value: "~50k forwards/s at dinner", explain: "One smoothed update per active courier per ping, routed to the order's single open feed." }],
        breaks: {
          failure: "A stacked courier's dot confuses the second customer, why is my food going the wrong way?",
          handled: "The feed for a stacked order shows leg-aware state, delivering another order first, 2 stops away, because an honest explanation beats an inexplicable dot.",
        },
      },
    },
    {
      id: "e10",
      from: "eater",
      to: "search",
      tier: "data",
      label: "browse nearby",
      detail: {
        what: "The discovery queries: geo radius, open now, ranked with quotes and capacity states attached.",
        why: "Ten browses per order means this path is cached hard, and the quote it shows is the number the whole backend will be held to.",
        numbers: [{ value: "~2k req/s peak, ~30s quote cache", explain: "Per (zone, restaurant) caching keeps prediction calls off the browse path." }],
        breaks: {
          failure: "A restaurant shows open but just closed early.",
          handled: "Tablet heartbeats gate the open flag: 2 missed beats flips discovery to unavailable, and checkout re-validates against the live flag either way.",
        },
      },
    },
    {
      id: "e11",
      from: "search",
      to: "eta",
      tier: "data",
      label: "quote inputs, cached 30s",
      detail: {
        what: "Discovery pulling prep and drive predictions plus zone pressure to assemble each restaurant's quoted window.",
        why: "The quote uses the same models dispatch will be judged by, plus a keepability buffer, so browse-time promises and dispatch-time reality share one source of truth.",
        numbers: [{ value: "buffered to ~90% on-time", explain: "The conversion-vs-lateness tuning point; the buffer is a business dial on top of an honest prediction." }],
        breaks: {
          failure: "Demand spikes between cache refreshes and quotes lag reality.",
          handled: "The zone-pressure multiplier refreshes on its own 30s clock independent of per-restaurant caches, so systemic lag is bounded to seconds even when per-restaurant data is cached.",
        },
      },
    },
    {
      id: "e12",
      from: "dispatch",
      to: "eta",
      tier: "data",
      label: "ready_at + variance",
      detail: {
        what: "Dispatch pulling fresh food-ready and drive predictions, with variance, for every tick's plan.",
        why: "The variance is not decoration: assignment timing pads by it, so a high-uncertainty kitchen gets its courier deliberately a touch late, trading seconds of food-wait against minutes of courier-wait.",
        numbers: [{ value: "re-predicted every 10s tick", explain: "Predictions move as live load moves; the plan follows them until a courier is committed." }],
        breaks: {
          failure: "The prediction service degrades and dispatch is blind.",
          handled: "Dispatch falls back to per-restaurant rolling medians computed locally from recent orders: cruder timing, wider buffers at discovery, and a banner metric that this mode is active.",
        },
      },
    },
    {
      id: "e13",
      from: "order-svc",
      to: "pay",
      tier: "data",
      label: "auth / capture / refund",
      detail: {
        what: "The three money calls, each idempotent, each tied to a state transition: auth at checkout, capture at delivered, refund on the exception paths.",
        why: "Tying money to transitions means the ledger and the state machine cannot tell different stories, and every refund argument replays from the transition log.",
        numbers: [{ value: "capture within ~5 min of delivery", explain: "Async with retries; the customer's statement matches the doorbell, not the batch job." }],
        breaks: {
          failure: "Refund issued while a late capture retry is in flight.",
          handled: "Money calls serialise per order through the same row lock as transitions, so the pair resolves in order and the log shows exactly which happened first.",
        },
      },
    },
    {
      id: "e14",
      from: "courier",
      to: "order-svc",
      tier: "data",
      label: "accept / pickup / deliver",
      detail: {
        what: "The courier's taps arriving as guarded transitions, each timestamped and idempotent.",
        why: "These timestamps are the marketplace's sensor network: arrival-vs-ready trains prep prediction, accept latency tunes offers, delivery time closes the promise loop, all from taps the courier makes anyway.",
        numbers: [{ value: "~2M arrival/ready pairs a day", explain: "The free training set that halves prep error for well-observed restaurants." }],
        breaks: {
          failure: "A courier taps delivered a block early to start the next offer sooner.",
          handled: "Delivered outside a geofence of the address flags the tap; repeated flags affect the courier's record, and the customer confirm (or complaint) closes the loop. Trust, but instrument.",
        },
      },
    },
  ],
  figures: {
    "timed-assignment": {
      title: "Assign to the food's clock, not the map's",
      nodes: [
        { id: "confirm", label: "18:02 confirmed", sub: "prep predicted 17 min", kind: "service", col: 0, row: 0 },
        {
          id: "pool",
          label: "In the zone pool",
          sub: "re-planned every 10s",
          kind: "queue",
          col: 0,
          row: 1,
          detail: {
            what: "The order waits, visible to every tick's plan, while its food-ready prediction moves with the kitchen's live load.",
            why: "Waiting in the pool is not delay: it is when the matcher still has choices. Commitment is deferred until timing demands it.",
          },
        },
        {
          id: "offer",
          label: "18:11 offer sent",
          sub: "to the courier who fits",
          kind: "service",
          col: 0,
          row: 2,
          detail: {
            what: "Offered so that predicted arrival ≈ predicted ready: a 6-min drive against an 18:19 food-ready.",
            why: "The chosen courier is often not the nearest one now, but the one whose current drop finishes near this restaurant in time.",
          },
        },
        {
          id: "meet",
          label: "18:18 courier arrives",
          sub: "bag sealed 18:19",
          kind: "client",
          col: 0,
          row: 3,
          detail: {
            what: "One minute of courier wait instead of nine; the food goes straight from pass to bag to road.",
            why: "The whole design's health compresses into this handoff: courier minutes wasted vs food minutes cooling.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "confirm", to: "pool", tier: "hot", step: 1, label: "enter with ready_at" },
        { id: "e2", from: "pool", to: "offer", tier: "hot", step: 2, label: "when timing demands" },
        { id: "e3", from: "offer", to: "meet", tier: "hot", step: 3, label: "arrival ≈ ready" },
      ],
    },
  },
};
