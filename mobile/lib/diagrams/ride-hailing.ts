import type { Diagram } from "./types";

export const RIDE_HAILING: Diagram = {
  id: "ride-hailing",
  title: "Ride Hailing",
  question: "Design Uber / Lyft (Ride Hailing)",
  sourceId: "patterns",
  itemId: 29,
  overview: {
    shape:
      "Two moving populations meet at a dispatcher, and the whole design is one conditional write: a location index nominates candidate drivers, a separate driver record adjudicates whether one is actually free, and the offer only leaves the building after the hold has been taken.",
    beats: [
      "Driver phones push a position every 4 seconds and the ingest tier forks each ping into two sinks that share nothing: an in-memory geo index holding one current position per driver behind a 10 second TTL, and an append-only history stream. Losing the index costs 10 seconds of positions and heals inside one ping cycle, which is why it can be disposable.",
      "A ride request reads that index for drivers within 2 km, roughly 50 of them after filtering on vehicle type and ping freshness, and ranks them by predicted arrival time from precomputed cell-to-cell travel-time tiles rather than by straight-line distance. The index is a candidate generator and is never asked whether a driver is free.",
      "Then the move the whole question is built around. Before any offer is sent, the dispatcher takes an exclusive lease on the top candidate: a conditional write on the driver record from available to offered, carrying the request id and an expiry 15 seconds out. Two dispatchers racing means one write wins and the loser falls through to its next candidate.",
      "Exclusivity is two-sided, because an expired lease lets a second driver be offered the same request and both may tap Accept. So the accept path is ordered: claim the trip row from REQUESTED to MATCHED first, then convert that driver's lease to assigned. The other order commits a driver to a trip somebody else already owns.",
      "Under a shortage it is the cascade, not the index, that burns the cluster: 2,700 unmatched requests walking all 50 candidates every 2 seconds is 4M conditional writes in a minute aimed at a few hundred hot keys. So the walk is capped at five attempts, the request then backs off and widens its radius by 50%, and NO_DRIVERS is a real terminal state rather than an error.",
      "After the match the trip is a state machine whose every transition is a compare-and-swap gated on the prior status, so a client retry cannot drag a completed trip backwards. Payment hangs off completion asynchronously under an idempotency key, because a declined card must never stop a driver taking their next ride.",
    ],
    crux:
      "A driver is scarce inventory that moves, declines and disappears, so assigning one is an exclusive allocation rather than a search result. Every hard property here falls out of that: the hold taken before the offer goes out, the expiry that returns it without a sweeper, the cascade to the next candidate, and the second claim on the request itself.",
    numbers: [
      "250k location pings/s at a 4 s cadence",
      "~50 candidates from a 2 km radius",
      "15 s lease, walk capped at 5 attempts",
      "~2,900 conditional writes/s globally",
    ],
  },
  nodes: [
    {
      id: "dispatch-worker",
      label: "Dispatch worker, per city",
      kind: "zone",
      detail: {
        what: "One stateless matching worker's whole job: rank the candidates, take a lease, push an offer, cascade when the lease fails.",
        why: "It is drawn as a boundary because nothing inside it survives a restart. Every piece of state that matters, the lease and the trip claim, lives in the two stores to the right, so a worker dying loses at most the offers in flight and those expire on their own.",
        numbers: ["one pool per city", "no state survives a restart", "15 s lease bounds the damage"],
        breaks:
          "Workers are interchangeable by design, so nothing stops two of them targeting the same driver; that race is pushed entirely onto the driver record's conditional write.",
      },
    },
    {
      id: "driver-app",
      label: "Driver app",
      sub: "WebSocket, 4 s ping, taps Accept",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The driver's phone: one long-lived socket carrying a position up every 4 seconds and dispatch offers back down.",
        why: "It is external because it is the one participant that can refuse. A driver may decline, go silent, background the app or take a fare from a competing platform, and every mechanism downstream exists to make those outcomes cheap rather than to prevent them.",
        numbers: ["~1M concurrent at peak", "~100 B per ping", "~70% offer accept rate"],
        breaks:
          "Mobile operating systems suspend GPS when the app loses focus, so a driver who is still working silently vanishes from the index and any offer already in flight dies at its 15 s expiry.",
      },
    },
    {
      id: "ingest",
      label: "Location ingest",
      sub: "stateful WS edge, 250k pings/s",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The socket tier that terminates driver connections and forks each ping into two independent sinks.",
        why: "Positions are high volume, low value and disposable while history is durable and cheap to lag, so the two paths are split at the earliest possible point. A broker outage then degrades reporting and cannot touch dispatch.",
        numbers: ["250k pings/s", "25 MB/s on the hot path", "~2.16 TB/day raw"],
        breaks:
          "A city whose fleet concentrates makes one shard hot, and a reconnecting phone that replays its buffered fixes as N messages rather than one amplifies exactly that spike.",
        choice: {
          pick: "Long-lived WebSockets terminated by a stateful edge tier",
          instead: "A plain HTTP POST per position update, and polling for offers.",
          decider:
            "Ping cadence against connection cost, and the fact that the channel is bidirectional. At 4 s per driver and ~1M concurrent drivers that is 250k requests/s, and the same channel has to carry an offer back down inside a sub 2 s time-to-first-offer budget. Polling for offers at that latency costs more than the sockets do.",
          flips:
            "A low-cadence tracking product reporting every few minutes with nothing pushed back, where the socket is pure operational cost and stateless HTTP is strictly simpler.",
        },
      },
    },
    {
      id: "rider-app",
      label: "Rider app",
      sub: "POST /ride/request, quoted token",
      kind: "external",
      col: 0,
      row: 2,
      detail: {
        what: "The rider's phone: submits pickup, dropoff, vehicle type and the price token it was quoted, then watches the trip.",
        why: "It is drawn apart from the driver side because the two populations are asymmetric. The rider initiates and waits, and nothing about a rider is scarce, so no part of this side ever needs an exclusive hold.",
        numbers: ["~1,200 requests/s at peak", "under 2 s to first offer", "~5 s median to accepted match"],
        breaks:
          "A rider who cancels while an offer is outstanding cannot revoke it in flight, so the cancellation has to be expressed as a failed claim on the trip row rather than as a message chasing the driver.",
      },
    },
    {
      id: "matcher",
      label: "Matching Service",
      sub: "radius, filter, score by ETA tile",
      kind: "service",
      col: 0,
      row: 3,
      parent: "dispatch-worker",
      detail: {
        what: "Stateless workers, one pool per city, turning a request into a ranked candidate list.",
        why: "Ranking by predicted arrival time rather than straight-line distance is the difference between a car 500 m away across a river and one 1.5 km away on the same road. Holding nothing durable means a worker can die mid-request without anyone reconciling anything.",
        numbers: ["~137 ids inside 2 km", "~50 after vehicle type and freshness filters", "scored on tiles, not live routing"],
        breaks:
          "If the ETA tile service is unreachable, scoring degrades to haversine and assignments get quietly worse, which shows up in pickup time rather than as an error.",
        choice: {
          pick: "Stateless per-city workers, any worker may attempt any driver",
          instead: "One single-writer dispatcher owning each geographic region, so the race cannot occur by construction.",
          decider:
            "How much traffic sits on region boundaries. A 10 km region inset by the 2 km catchment leaves 36 of its 100 km2 untouched, so 64% of the area is legitimately contested between two owners. Pushing that band down to 15% needs 50 km regions, which puts a whole metro on one thread. Symbols partition cleanly and geography does not.",
          flips:
            "A closed pool much larger than the catchment, such as an airport holding lot with a FIFO driver queue, where single-writer is strictly better because it also gives drivers a defensible ordering. Also any region switched to batched matching, where the solver is already a single writer.",
        },
      },
    },
    {
      id: "offer-loop",
      label: "Offer + cascade",
      sub: "5 attempts, 15 s lease, 2 s backoff",
      kind: "service",
      col: 0,
      row: 4,
      parent: "dispatch-worker",
      detail: {
        what: "The lease-then-offer loop: attempt a conditional hold on the top candidate, push the offer only if that write wins, move to the next candidate if it does not.",
        why: "Taking the hold before the offer leaves the building is the entire trick. Offer first and hold on accept, and two dispatchers offer the same car, both drivers drive to different pickups, and one rider watches a car approach and then turn away.",
        numbers: ["walk capped at 5, not ~50", "radius x1.5 and 2 s backoff on failure", "second offer only after 8 s of silence"],
        breaks:
          "Uncapped, an arena shortage is 2,700 requests x 50 candidates x 30 retries, roughly 67,000 conditional writes/s aimed at a few hundred hot keys against a useful global load of ~2,900/s.",
        choice: {
          pick: "Bounded walk of 5 with exponential backoff and a widening radius",
          instead: "Walk the whole candidate list, or broadcast the request to every nearby driver and take the first claim.",
          decider:
            "Write amplification during a shortage. Fifty attempts per request at an arena is 4M conditional writes in a minute; five attempts is 405,000 before the growing backoff interval takes another factor off it. Broadcast does not remove the race, it moves it, and it hands drivers the ability to cherry-pick.",
          flips:
            "Thin markets, and scheduled or freight-style work where a fast pickup is not the product. Letting drivers claim from a pool then costs almost no dispatch logic and the market control you give up is worth little.",
        },
      },
    },
    {
      id: "trip-fsm",
      label: "Trip Service",
      sub: "CAS gated on prior status",
      kind: "service",
      col: 0,
      row: 5,
      detail: {
        what: "The state machine moving a trip forward through REQUESTED, MATCHED, DRIVER_ENROUTE, ARRIVED, ON_TRIP, COMPLETED and PAID.",
        why: "It is also the second half of exclusivity. The request is itself a claimable resource, so when two drivers accept within milliseconds exactly one wins the trip row and the loser is released and shown an expired offer, which is what it looked like from their side anyway.",
        numbers: ["accept returns 409 already_matched on the losing side", "6 transitions on a normal trip", "NO_DRIVERS is terminal, not an error"],
        breaks:
          "Ordering the two accept writes the other way round commits a driver to a trip somebody else owns, and recovering means un-assigning a car that has already started moving.",
        choice: {
          pick: "Compare-and-swap on the expected prior status for every transition",
          instead: "Application-level validation of the transition, or a workflow engine holding trip state.",
          decider:
            "Where a duplicate gets rejected. Client retries and duplicate deliveries are routine at ~1,200 matches/s, and an application check is a read then a write with a window in the middle. A CAS pushes the rejection into the store where it is atomic, and hands you a rejected-transition counter per state pair to page on.",
          flips:
            "Trips with genuinely long-running human steps and compensations, where an orchestrator earns its operational cost. An on-demand ride finishes in about 25 minutes and never needs one.",
        },
      },
    },
    {
      id: "payment-saga",
      label: "Payment saga",
      sub: "async, idempotency key, retries",
      kind: "service",
      col: 0,
      row: 6,
      detail: {
        what: "The settlement path that runs after COMPLETED: authorise, capture, retry with backoff, and fall back to settling on the rider's next session.",
        why: "Completion never waits on payment. A gateway timeout inside the completion transition would hold the state machine open and strand a driver who has already stopped the car, turning a card problem into a supply outage.",
        numbers: ["PAYMENT_PENDING sits after COMPLETED", "settlement lag p99 target under 30 min", "one idempotency key per trip"],
        breaks:
          "Retries without a stable idempotency key double-charge riders, and the duplicate is invisible until a dispute arrives days later.",
        choice: {
          pick: "An asynchronous saga hung off the terminal trip transition",
          instead: "Charging inside the completion transition, so a trip is only complete once it is paid.",
          decider:
            "What a gateway 5xx costs. Cards decline at percentage-point rates, and a synchronous charge puts that failure rate straight onto driver availability; asynchronously it costs a retry queue and a 30 minute settlement lag. Q23 owns the ledger and double-entry mechanics.",
          flips:
            "Prepaid or wallet-funded rides where the money is already held, so capture is a local ledger write with no external gateway that can time out.",
        },
      },
    },
    {
      id: "history-bus",
      label: "History stream",
      sub: "Kafka, pings + transitions",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "An append-only log carrying every location ping and every trip transition to analytics, fraud detection, route replay and the surge job.",
        why: "The live path and the history path deliberately share nothing. Reporting is allowed to lag or break and dispatch is not, so coupling them would put a broker's availability directly onto the match path.",
        numbers: ["2.16 TB/day raw", "~430 GB/day at 5x columnar compression", "~25 TB for 24 h hot replay at RF 3"],
        breaks:
          "Consumer lag is invisible from the dispatch side: matching stays perfectly healthy while surge quietly prices off minute-old demand.",
        choice: {
          pick: "Kafka, partitioned by city",
          instead: "Writing pings straight into the durable trip store and reading history back out of it.",
          decider:
            "Write volume against value. 250k pings/s into a store that does conditional writes needs a large cluster and puts its latency on the match path, for data that is worthless 10 seconds later. The log absorbs it asynchronously while the live copy fits in ~100 MB of RAM.",
          flips:
            "A fleet small enough that the ping rate fits one database, where a single store is simpler to run than two and replay comes free with the rows.",
        },
      },
    },
    {
      id: "geo-index",
      label: "Live geo index",
      sub: "Redis Cluster by city, 10 s TTL",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "One current position per on-shift driver, keyed by city, answering everyone within radius r.",
        why: "It nominates and it never adjudicates. Being deliberately approximate and deliberately not durable is what lets it run 4 seconds stale without that mattering to correctness, and what lets it absorb the ping rate in memory.",
        numbers: ["~100 MB of current-position state globally", "a 2 km query returns ~50 in a couple of hundred microseconds", "10 s TTL evicts dead phones"],
        breaks:
          "It will happily nominate a driver who was assigned two seconds ago, which is precisely why availability is decided in the driver record instead.",
        choice: {
          pick: "In-memory sorted sets in Redis Cluster, sharded by city, entries expiring at 10 s",
          instead: "A durable geospatial index inside the primary database.",
          decider:
            "Cost of the write path. 250k pings/s at 100 B is 25 MB/s of writes each superseded within 4 seconds, and durability buys nothing because a lost index refills from live pings inside one ping cycle. The global working set is ~100 MB, so this is never the capacity problem. Q13 covers the indexing scheme itself.",
          flips:
            "When positions must be queryable historically as well as live, at which point you are building Q13's index properly and this becomes its serving tier rather than the whole store.",
        },
      },
    },
    {
      id: "eta-tiles",
      label: "ETA tile service",
      sub: "precomputed cell-to-cell times",
      kind: "external",
      col: 1,
      row: 3,
      detail: {
        what: "A lookup of expected travel time between two cells, consumed here rather than built here.",
        why: "Scoring 50 candidates with 50 live routing calls does not fit a sub 2 second budget, and a tile gets the ranking right to within the noise of traffic anyway. Q15 owns the routing engine behind it.",
        numbers: ["~50 lookups per request", "one memory read instead of a routing call"],
        breaks:
          "A tile timeout during scoring drops the ranking back to haversine, which produces worse pickups rather than an error anyone notices at request time.",
        choice: {
          pick: "Precomputed cell-to-cell travel-time tiles read at score time",
          instead: "A live routing call per candidate.",
          decider:
            "Latency budget against candidate count. Fifty routing calls inside a sub 2 s time-to-first-offer target leaves nothing for the lease and the push, and the ranking only has to separate candidates by tens of seconds, which a tile does.",
          flips:
            "Small candidate sets or high-value assignments, freight and scheduled pickups, where a handful of exact routes is affordable and the accuracy difference is worth paying for.",
        },
      },
    },
    {
      id: "driver-record",
      label: "Driver record",
      sub: "state + lease, per-key linearizable",
      kind: "database",
      col: 1,
      row: 4,
      detail: {
        what: "One row per driver holding state in offline, available, offered or assigned, plus the request id when offered and a lease expiry.",
        why: "It is the only thing in the system that decides whether a driver is free. Splitting it from the geo index is the central move of the whole design: the index may be 4 seconds stale because it only nominates, and this record adjudicates.",
        numbers: ["~2.4 conditional writes per match", "~2,900 writes/s globally", "15 s lease expiry"],
        breaks:
          "Under a shortage every dispatcher in a cell attempts the same handful of available rows, so the CAS failure ratio spikes and the cluster spends its CPU on contention rather than on matching.",
        choice: {
          pick: "Expiry as a predicate on the record, evaluated against the store's clock",
          instead: "A background sweeper that scans for expired leases and releases them.",
          decider:
            "How many writers exist at the moment of decision. A sweeper is a second writer racing the accept: it reads a lease expired at 15.0 s, decides to release, and the driver accepts in between. As a predicate there is exactly one writer, and the countdown the driver sees is cosmetic.",
          flips:
            "Stores with no conditional write at all, where you have no choice but to reconcile with a sweeper and accept the race window it opens.",
        },
      },
    },
    {
      id: "surge",
      label: "Surge pricing",
      sub: "60 s tumbling window per cell",
      kind: "service",
      col: 1,
      row: 5,
      detail: {
        what: "A streaming job computing a multiplier per cell from the ratio of requests to available drivers, written to a cache the pricing path reads at quote time.",
        why: "It is the fast lever on imbalance: price rations demand inside a minute where repositioning bonuses take five to fifteen. Neither creates supply, which is why the arena case still ends in a twenty minute wait.",
        numbers: ["recomputed every 60 s", "multiplier locked onto the trip at request time", "a 5 km reposition radius reaches 120 to 350 idle cars"],
        breaks:
          "If the job dies the cells go stale, and failing open to 1.0x is a revenue and supply event rather than graceful degradation, so it holds the last known value and alarms above 2 minutes of staleness.",
        choice: {
          pick: "A discrete multiplier ladder with asymmetric step-up and step-down thresholds",
          instead: "A continuous multiplier recomputed straight from the live supply and demand ratio.",
          decider:
            "Oscillation. A continuous value on a 60 s cadence makes a cell step up, pull cars in, step down, lose them and step up again, which is whiplash for drivers and looks arbitrary to riders. Snapping to a ladder with hysteresis costs precision nobody can perceive.",
          flips:
            "Jurisdictions that cap or ban surge, where the multiplier is pinned near 1.0x and supply-side incentives with a visible queue position become the only levers you have.",
        },
      },
    },
    {
      id: "trips",
      label: "Trips + history",
      sub: "~2 KB/trip, 7 year retention",
      kind: "database",
      col: 1,
      row: 6,
      detail: {
        what: "The durable trip row and its archive: status, both parties, the polyline, the locked surge, the fare and six timestamps.",
        why: "This is the money record, so it is the one thing that pays for consistency and retention. Fare disputes, tax and driver payouts all read it years after the car stopped.",
        numbers: ["~2 KB per trip", "20 GB/day at 10M rides", "~51 TB cold over 7 years"],
        breaks:
          "A trip stuck in a non-terminal state past its expected duration is invisible unless it is counted, which is why trips_stuck_count pages above 0.5% of in-flight trips.",
        choice: {
          pick: "Local-quorum writes in the city's own region, asynchronous cross-region replication",
          instead: "Synchronous multi-region replication of every trip transition.",
          decider:
            "Latency against RPO. Trips are city-local, so a local quorum keeps transitions off the cross-region path and still gives an RPO under 5 s; going synchronous adds tens of milliseconds to each of six transitions per trip to guard against losing a whole region. Cross-region traffic then stays under 5% of egress.",
          flips:
            "Regulated markets that require a synchronously replicated copy outside the serving region, where the added latency is not a choice you get to make.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "driver-app",
      to: "ingest",
      label: "loc ping / 4 s",
      animated: true,
      detail: {
        what: "A ~100 B Protobuf position carrying driver id, lat, lng, heading, speed, status and timestamp.",
        why: "The 4 second cadence is what makes the index good enough to dispatch from, and it is also where the entire write volume of the system comes from. Slower and the map lies about where cars are; faster buys precision nobody consumes.",
        numbers: ["250k pings/s globally", "25 MB/s aggregate", "~100 B each"],
        breaks:
          "A phone off cellular buffers its fixes, so reconnection has to send one message carrying the last N positions rather than N messages, or every network blip becomes a write spike.",
      },
    },
    {
      id: "e2",
      from: "ingest",
      to: "geo-index",
      label: "GEOADD, 10 s TTL",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Overwriting the driver's single current position in the city's in-memory index.",
        why: "One entry per driver rather than an append, because only the newest position can ever nominate a candidate. Writing it with a TTL means a phone that dies removes itself from candidacy with nothing sweeping anything.",
        numbers: ["one entry per on-shift driver", "10 s TTL", "under 50 ms p99 write target"],
        breaks:
          "A TTL much longer than the ping interval leaves ghosts in the index, and every ghost costs a wasted lease attempt on the match path.",
      },
    },
    {
      id: "e3",
      from: "ingest",
      to: "history-bus",
      label: "every ping, async",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The same ping, forked onto the durable log for analytics, fraud detection and route replay.",
        why: "The fork happens as early as possible so the two paths share no component downstream. Reporting is allowed to lag and dispatch is not, and this edge is what makes that separation structural rather than a promise.",
        numbers: ["~2.16 TB/day raw", "~430 GB/day compressed"],
        breaks:
          "It is fire and forget, so broker backpressure must be dropped rather than propagated; blocking here would put a reporting outage onto the dispatch path.",
      },
    },
    {
      id: "e4",
      from: "rider-app",
      to: "matcher",
      label: "POST /ride/request",
      animated: true,
      detail: {
        what: "A ride request carrying pickup, dropoff, vehicle type and the price token the rider was quoted.",
        why: "Carrying the quoted token rather than re-pricing on arrival is what stops the fare moving between the tap and the match. The rider accepted a number, and that number is what gets locked onto the trip.",
        numbers: ["~1,200 requests/s at peak", "under 2 s to first offer"],
        breaks:
          "Retries of this call must be idempotent on the request id, or a rider with a flaky connection creates two requests and consumes two drivers.",
      },
    },
    {
      id: "e5",
      from: "matcher",
      to: "geo-index",
      label: "radius query, 2 km",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A bounded radius scan of the city's geo index around the pickup point.",
        why: "It is deliberately a hint. Both the position and the cached status it returns are up to 4 seconds old, which is long enough for somebody else to have taken the driver, so nothing it says is treated as an availability answer.",
        numbers: ["~137 ids inside 2 km", "~50 after filtering", "a couple of hundred microseconds"],
        breaks:
          "Widening the radius during a shortage returns more candidates who are equally unavailable, so the scan is not the lever it looks like.",
      },
    },
    {
      id: "e6",
      from: "matcher",
      to: "eta-tiles",
      label: "cell-to-cell travel time",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Fifty travel-time lookups, one per surviving candidate, from precomputed tiles.",
        why: "Ranking by arrival time rather than distance is what stops the scorer picking a car 500 m away on the far side of a river. Tiles rather than live routing because 50 routing calls do not fit inside the budget.",
        numbers: ["~50 lookups per request", "sub 2 s budget for the whole match"],
        breaks:
          "On a tile timeout the ranking falls back to haversine and pickups quietly get worse, which is the right trade but shows up only in pickup-time metrics.",
      },
    },
    {
      id: "e7",
      from: "matcher",
      to: "offer-loop",
      label: "ranked, top 5 only",
      animated: true,
      detail: {
        what: "The ranked candidate list, truncated to the first five before any lease is attempted.",
        why: "Truncation here is the load-shedding decision. In a normal catchment the top candidate's lease succeeds almost always, so the other 45 exist only to be walked during a shortage, which is exactly when walking them is unaffordable.",
        numbers: ["5 attempts, not ~50", "0.43 extra offer rounds per match on average"],
        breaks:
          "Ties near the top have to be broken randomly, or 200 dispatchers in a cell all attempt the same top-ranked car and 199 of them fail.",
      },
    },
    {
      id: "e8",
      from: "offer-loop",
      to: "driver-record",
      label: "CAS available to offered",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The conditional write that takes the exclusive hold: available to offered, carrying the request id and an expiry 15 seconds out.",
        why: "This is the arrow the whole question is about. It happens before the offer is sent, so two dispatchers racing for the same car resolve it in the store rather than on the road, and the loser simply moves to its next candidate.",
        numbers: ["~2.4 of these per match", "~2,900/s globally", "15 s expiry"],
        breaks:
          "During a shortage this is where the CAS failure ratio spikes; sustained above roughly 20% the cell is short of cars and the bounded walk is doing real work.",
      },
    },
    {
      id: "e9",
      from: "offer-loop",
      to: "driver-app",
      label: "offer via WS, 15 s lease",
      dashed: true,
      animated: true,
      fromSide: "left",
      toSide: "left",
      offset: 100,
      detail: {
        what: "The offer pushed down the driver's existing socket: pickup, fare, ETA and the expiry timestamp.",
        why: "It is the only edge on this diagram that consumes something. Everything upstream is a repeatable read; once this is sent a driver has been committed to one rider and cannot be offered to anyone else until the lease resolves.",
        numbers: ["15 s to respond", "second offer only after 8 s of silence"],
        breaks:
          "A backgrounded or offline phone never sees it and the request waits out the full 15 seconds, which is the largest single term in time to match.",
      },
    },
    {
      id: "e10",
      from: "driver-app",
      to: "trip-fsm",
      label: "accept: claim trip row",
      fromSide: "right",
      toSide: "right",
      offset: 150,
      detail: {
        what: "The accept, which claims the trip row from REQUESTED to MATCHED with the driver attached.",
        why: "The request is a claimable resource too, because an expired lease can leave two drivers holding live offers for the same ride. Claiming the trip first means exactly one accept wins and the loser is released cleanly.",
        numbers: ["409 already_matched on the losing side", "~5 s median from request to accept"],
        breaks:
          "Doing this after the lease conversion instead of before it opens a window where a driver is committed to a trip somebody else owns, and unwinding that means recalling a car that is already moving.",
      },
    },
    {
      id: "e11",
      from: "trip-fsm",
      to: "driver-record",
      label: "then lease to assigned",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The second write of the accept path, converting that driver's lease from offered to assigned.",
        why: "It is strictly second. Only once the trip is claimed is it safe to commit the driver, and that ordering is what turns a simultaneous double accept into a clean loss for one side rather than a state to reconcile.",
        numbers: ["one write per successful match"],
        breaks:
          "If the driver went silent and the lease already expired this write fails, so the accept path has to be able to release the trip claim it just took.",
      },
    },
    {
      id: "e12",
      from: "trip-fsm",
      to: "trips",
      label: "CAS on prior status",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Each transition written as a compare-and-swap gated on the expected prior status.",
        why: "It puts rejection of duplicates in the store rather than in application code, so a retried client call trying to move a completed trip back to on-trip is refused atomically instead of by a check with a race in the middle.",
        numbers: ["6 transitions on a normal trip", "~2 KB per trip row"],
        breaks:
          "A rising rejected-transition counter for one state pair usually means a client retry bug rather than a race, so it pages rather than being absorbed silently.",
      },
    },
    {
      id: "e13",
      from: "trip-fsm",
      to: "surge",
      label: "surge locked on the trip",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the cell's current multiplier and copying it onto the trip at request time.",
        why: "The multiplier is copied rather than referenced so the price cannot move during the 90 seconds before the car arrives. The rider accepted a number, and the surge job recomputing 30 seconds later must not change it.",
        numbers: ["recomputed every 60 s", "held on the row as surge_locked"],
        breaks:
          "If the surge job is dead this read returns a stale multiplier, and failing open to 1.0x instead would be a revenue and supply event, so it holds the last value and alarms.",
      },
    },
    {
      id: "e14",
      from: "trip-fsm",
      to: "payment-saga",
      label: "on COMPLETED, async",
      detail: {
        what: "Handing a completed trip to settlement, after the terminal transition rather than inside it.",
        why: "The trip is finished when the car stops. Putting the gateway call inside the completion transition would let a card decline hold the state machine open and stop a driver taking their next ride.",
        numbers: ["settlement lag p99 target under 30 min"],
        breaks:
          "The handoff has to carry an idempotency key, because the retry path is exactly what makes a double charge possible in the first place.",
      },
    },
    {
      id: "e15",
      from: "trip-fsm",
      to: "history-bus",
      label: "state transitions",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "Every trip transition also appended to the history log.",
        why: "Analytics, fraud detection, driver payouts and the surge job all want the event stream rather than the current row, and none of them should be issuing reads against the store dispatch depends on.",
        numbers: ["6 transitions per trip", "~1,200 trips/s at peak"],
        breaks:
          "Consumer lag here is invisible from the dispatch side, so surge and reporting drift while matching looks perfectly healthy.",
      },
    },
    {
      id: "e16",
      from: "history-bus",
      to: "surge",
      label: "requests/cell, 60 s window",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "The surge job consuming the request stream, keyed by cell on a 60 second tumbling window.",
        why: "Demand is measured off the asynchronous path deliberately. Pricing wants a minute of history rather than an instant, and computing it on the hot path would put a streaming job's health onto match latency.",
        numbers: ["60 s tumbling window", "one multiplier per cell"],
        breaks:
          "If the newest write for a cell ages past 2 minutes the price is stale, which is the alarm rather than a silent reset to 1.0x.",
      },
    },
  ],
};
