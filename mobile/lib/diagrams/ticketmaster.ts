import type { Diagram } from "./types";

export const TICKETMASTER: Diagram = {
  id: "ticketmaster",
  title: "Ticketmaster",
  question: "Design Ticketmaster (High-Demand Ticket Booking)",
  sourceId: "patterns",
  itemId: 49,
  overview: {
    shape:
      "A funnel with a dam at the top: 1.5M people arrive in ten seconds, get a cheap lottery token, then wait outside on shared CDN objects while a gate releases about 100 buyers a second, so the seat-hold path never meets the crowd.",
    beats: [
      "Arrival is a lottery draw, not a queue. Every user gets a token carrying a random 64-bit sort key written to a sharded in-memory set: 150k writes/s across 16 shards with no counter and therefore no hotspot. A monotonic sequencer for strict first-come-first-served would be a single writer at exactly peak, with no headroom, and it would sell the show to whoever sits 3ms from the edge.",
      "Waiting is free because nothing about it is per-user. The client polls two objects that are identical bytes for everyone: a 20-byte now_serving watermark on a 2s TTL and a 2-bit-per-seat bitmap, 5KB gzipped, republished once a second. Position is subtraction on the client. A per-user position endpoint would be 300k QPS of pure overhead; one shared object makes the origin see about 50 requests a second regardless of how many people showed up.",
      "Admission is sized from inventory rather than guessed. Cap in-flow buyers at C = 25,000, because 25,000 orders of 2.4 seats is 60,000 seats, exactly one venue held and no more. Little's law over a 240s mean session gives about 100 admissions/s. Refill the bucket from completions, never from a clock, or a slow payment provider drifts in-flow past the cap and admitted users arrive at a fully grey map.",
      "The write race is the easy part and it happens behind the gate. A hold is a lease: SET NX EX 600 per seat, acquired in ascending seat id so overlapping multi-seat orders cannot deadlock, released with a compare-and-delete so a late rollback cannot free somebody else's seat. About 600 CAS/s per event. The loser gets a 409 carrying the seat's current status inline, so the client greys it without waiting for the next bitmap tick.",
      "Checkout is where money and inventory have to agree. Extend the seat key TTL to cover the payment timeout and mark the hold committing, authorise rather than capture, and only flip held to sold in a synchronous Postgres transaction. Holds themselves are write-behind through Kafka, which is what makes a Redis failover a 30 to 60s freeze-rebuild-reopen rather than a double-sold seat.",
      "The terminal state is a first-class feature. 60k seats need roughly 42k admissions and go in about seven minutes, but draining 1.5M at 100/s would take 4.2 hours, so about 97% of the queue must be told sold out inside 90 seconds. Keep 2x the projected exhaustion rank rather than 1x, because around 40% of holds never convert and those seats come back needing buyers who are still present.",
    ],
    crux:
      "You win by keeping people out, not by making the write faster. The seat race is one conditional set and it is over in microseconds; the load is 1.5M browsers wanting a live picture of 60,000 seats. Unlike an auction, whose deadline is the close and whose contention you cannot throttle, this deadline is the start of the sale, so metering arrivals is available and it is the whole design.",
    numbers: [
      "1.5M arrivals in ~10s against 60k seats: 25:1",
      "C = 25,000 in flow ÷ 240s session = ~100 admissions/s",
      "300k QPS of position polling collapses to ~50 origin req/s",
    ],
  },
  nodes: [
    {
      id: "gate-group",
      label: "Admission control",
      kind: "zone",
      detail: {
        what: "The metering tier: token issue, the token store, risk scoring and the gate that decides who is allowed to touch inventory at all.",
        why: "Arrival rate and serviceable rate differ by three orders of magnitude, so something has to buffer. Putting the buffer here, in cheap tokens and a rate-limited release, means every tier below it is sized for the sustainable rate rather than for the spike.",
        numbers: ["~150k arrivals/s in, ~100 admissions/s out", "1500:1 attenuation"],
        breaks:
          "If the gate leaks, everything downstream fails at once: the seat store sees contention it was never admitted for and the origin sees traffic the CDN was supposed to absorb.",
      },
    },
    {
      id: "clients",
      label: "1.5M clients",
      sub: "arrive in ~10s",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "Browsers and apps that all loaded the event page because the on-sale time was printed on a poster.",
        why: "It is drawn because its shape is the whole problem: not a rate you can provision for but a spike that reaches 150k new sessions a second and then decays, against inventory that is gone in seven minutes.",
        numbers: ["1.5M arrivals in ~10s", "~2.4 seats per order", "25 buyers per seat"],
        breaks:
          "A meaningful share of these are funded, organised bots on residential proxies, and they are indistinguishable from real users at the moment they arrive.",
      },
    },
    {
      id: "token-svc",
      label: "Queue token service",
      sub: "random 64-bit sort key",
      kind: "service",
      col: 0,
      row: 1,
      parent: "gate-group",
      detail: {
        what: "Issues one opaque token per arriving user, carrying a random 64-bit sort key and a risk score, then gets out of the way.",
        why: "This is the only origin write the crowd makes. After it the client is entirely CDN-fed, so the tier has to absorb the spike and hand back something the client can reason about locally rather than something it must come back and ask about.",
        numbers: ["~150k tokens/s at the spike", "~64B per token, ~100MB per on-sale", "one sharded write, ~15ms"],
        breaks:
          "A shard failing during the spike silently drops a slice of arrivals, which is why the client retries against a different shard and simply redraws a key.",
        choice: {
          pick: "Random 64-bit sort key per token, a lottery draw at issue",
          instead: "A monotonic sequencer giving strict first-come-first-served order.",
          decider:
            "Inventory spans the first 0.4s of arrivals at 150k/s, and a cloud instance 3ms from the edge beats home broadband by 30 to 50ms, which is 4,500 to 7,500 positions. The entire allocation is decided inside a window where only network position varies. The sequencer is also a single writer topping out near 150k ops/s, which is exactly peak with zero headroom.",
          flips:
            "When inventory spans more than about a second of arrivals, say 60k seats at 5k arrivals/s, human reaction spread dominates the purchasable advantage and FCFS really is ordering people rather than ordering their ISPs. Also when the promoter puts FCFS in the contract.",
        },
      },
    },
    {
      id: "admission",
      label: "Admission controller",
      sub: "token bucket, ~100 users/s",
      kind: "service",
      col: 1,
      row: 2,
      parent: "gate-group",
      detail: {
        what: "One leader per event popping the lowest sort key, re-scoring the token against fingerprint, ASN and identity-graph signals (challenge, allow or shadow-deny, never a hard block), and granting 15-minute purchase sessions at a rate derived from inventory.",
        why: "This is the component the question exists for. The purchase path is only ever allowed to see a few hundred concurrent buyers however many are outside, and the cap is chosen so that even in the worst case the in-flow crowd can hold exactly one venue's worth of seats and no more. Risk scoring sits at this gate, not at checkout, because rejecting a bot after it holds a seat has already cost the seat for ten minutes; a first, cheap pass already ran at token issue.",
        numbers: [
          "C = 25,000 in flow",
          "25,000 x 2.4 = 60,000 seats",
          "25,000 ÷ 240s ≈ ~100 admissions/s",
          "~15% challenged, target ≥90% of inventory to humans",
        ],
        breaks:
          "The leader dying mid-on-sale stops admissions entirely; detection is the watermark going flat while queue depth is non-zero, and the new leader resumes from the persisted watermark. The risk lookup is in the critical path of every admission, so it fails open: a bot-heavy on-sale beats a dead one, with per-identity caps tightened automatically to bound the damage.",
        choice: {
          pick: "Token bucket refilled by completions, cap set by Little's law",
          instead: "A fixed admission schedule on a timer, or no gate at all with autoscaling behind it.",
          decider:
            "What happens when mean session time moves. Checkout is 2 to 6s with the payment provider dominating, so a provider slowdown doubles session time; a clock-driven gate then drifts in-flow past 25,000, every seat ends up held, and admission slots are spent on users who arrive at a fully grey map. Completion-driven refill self-tunes downward instead.",
          flips:
            "A staggered or unannounced release, where arrivals never exceed the serviceable rate and the queue is a smoothing buffer rather than a dam, so a gentle fixed rate is simpler and invisible to users.",
        },
      },
    },
    {
      id: "purchase-api",
      label: "Purchase API",
      sub: "atomic hold, ascending seat ids",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "The seat-hold endpoint: sorts requested seat ids, conditionally sets each one, and rolls back the partial set on the first conflict.",
        why: "Holds are all-or-nothing because a half-held pair of adjacent seats is worthless to the buyer. Sorting ids before acquiring is what stops two overlapping multi-seat orders deadlocking on each other without any lock manager being involved.",
        numbers: ["~600 CAS ops/s per event", "hold p99 < 100ms", "one SET NX ≈ 1.5ms"],
        breaks:
          "Near sell-out the conflict rate goes from under 15% to nearly 100%, because 25,000 in-flow buyers are clicking at 3,000 remaining seats and no amount of freshness changes that ratio.",
        choice: {
          pick: "Server-side best-available as the default path, manual picking kept available",
          instead: "Pure manual seat selection with optimistic retry on conflict.",
          decider:
            "Key concentration. Everyone clicks the same twenty seats, so retry produces livelock: 500 clients CAS row 5 centre, one wins, 499 retry and collide again. Hashing the session id into a preference-list offset spreads 200 concurrent allocations over ~200 distinct keys instead of one.",
          flips:
            "Small or low-contention events, where free choice is the product and the conflict rate never leaves single digits, so taking the seat map away buys nothing.",
        },
      },
    },
    {
      id: "checkout",
      label: "Checkout",
      sub: "payment saga, see #23",
      kind: "service",
      col: 1,
      row: 4,
      detail: {
        what: "Extends the hold to cover the payment timeout, runs the payment saga, flips held to sold and emits ticket records with rotating barcode seeds.",
        why: "This is where money and inventory have to agree, and the ordering is the whole trick: the seat flip is the commit point, so nothing irreversible may happen before it. About 60% of admitted buyers get this far.",
        numbers: ["2 to 6s, provider dominates", "EXPIRE 900 while committing", "~25k orders per on-sale"],
        breaks:
          "Authorisation succeeding after the hold expired and the seat was resold. You must be able to void a late auth, because a captured payment for a seat somebody else is sitting in is an oversell incident with no clean unwind.",
        choice: {
          pick: "Freeze the seat and extend the TTL on entering checkout, capture only after the flip",
          instead: "Let the 600s hold TTL run out naturally while payment is in flight.",
          decider:
            "The gap between the two timeouts. A 600s hold against a payment tail of 2 to 6s looks safe until the provider degrades, and then the seat is released mid-authorisation. EXPIRE 900 plus a committing marker closes the window; capture after commit means the only failure left is a void, not a refund.",
          flips:
            "Payment methods that settle synchronously and cannot succeed late, where authorise-then-capture is ceremony and a single charge at the flip is simpler.",
        },
      },
    },
    {
      id: "payments",
      label: "Payment provider",
      sub: "authorise, capture on flip",
      kind: "external",
      col: 2,
      row: 4,
      detail: {
        what: "The third-party processor, outside the trust boundary and the slowest hop in the funnel.",
        why: "It is drawn because it controls the admission rate without knowing it. Mean session time is mostly this call, and Little's law turns its p99 straight into the rate at which the gate can release people.",
        numbers: ["2 to 6s per checkout", "the tail that sets mean session time"],
        breaks:
          "A provider slowdown inflates session time, collapses admission throughput and lengthens the queue. Circuit-break it, extend hold TTLs and lower the admission rate rather than raising the concurrency cap.",
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "waiting page, watermark, bitmap",
      kind: "database",
      col: 1,
      row: 0,
      detail: {
        what: "Serves the three objects the crowd actually consumes: the waiting page, the now_serving watermark and the seat-status bitmap.",
        why: "The single most load-bearing component in the design. Every object here is identical for all viewers, so request collapsing does the work for free, but only because the objects were deliberately made global rather than per-user.",
        numbers: ["~150,000:1 collapse ratio", "~100 POPs, origin sees ~100 req/s", "~7.5GB/s edge egress"],
        breaks:
          "A POP serving a stale bitmap past its TTL makes the map lie; clients fall back to a jittered direct fetch with a visible staleness banner, and conflicts are already handled by the 409 on hold.",
        choice: {
          pick: "Short-TTL micro-objects on a CDN, polled by the client",
          instead: "WebSockets pushing seat updates to every viewer.",
          decider:
            "Connection establishment. 1.5M TLS handshakes inside ten seconds exhausts load-balancer accept queues before a single seat is sold, and each surviving connection pins memory in the tier you are trying to keep empty. Push becomes correct after the gate, at ~25,000 sessions rather than 1.5M.",
          flips:
            "Once inside the gate, where hold countdowns and seat-taken invalidation genuinely want push and the connection count is four orders of magnitude smaller.",
        },
      },
    },
    {
      id: "queue-tokens",
      label: "Queue token store",
      sub: "Redis ZSET, sharded 16 ways",
      kind: "database",
      col: 1,
      row: 1,
      parent: "gate-group",
      detail: {
        what: "A sorted set per event, member = token id, score = the random sort key, sharded sixteen ways.",
        why: "The gate needs to pop in key order and nothing else needs to read this at all, because position is computed on the client. Random scores mean the writes spread perfectly and the ordering costs no coordination.",
        numbers: ["~100MB per on-sale", "TTL 24h after on-sale opens", "16 shards, no cross-shard write"],
        breaks:
          "Losing a shard loses a slice of entries, which is survivable only because order is random by construction: a redrawn key is exactly as fair as the one it replaced.",
        choice: {
          pick: "Redis sorted set with random scores, sharded by event",
          instead: "A durable log such as Kafka, one partition per event, consumed in order.",
          decider:
            "What the structure is asked to do. This is 150k inserts/s for ten seconds followed by ~100 pops/s, with entries that are worthless 24h later. A log gives ordering guarantees the random key already makes irrelevant, and pays durability cost for data whose loss mode is a user redrawing a token.",
          flips:
            "Strict FCFS in the contract, where arrival order is the product and an append-only log is the natural home for it, at the cost of a single-writer partition per event.",
        },
      },
    },
    {
      id: "seat-state",
      label: "Seat state",
      sub: "Redis, CAS plus native TTL",
      kind: "database",
      col: 2,
      row: 3,
      detail: {
        what: "The authoritative hot copy of every seat: key seat:{event}:{seat}, value holder session, expiry carried by the native key TTL.",
        why: "Hold acquisition, hold expiry and hold release each become one operation with no reaper and no scan. A hold is a lease with a business name, and the TTL is what makes an abandoned checkout return inventory automatically.",
        numbers: ["~80B/seat, ~5MB per event", "~50GB across ~10k live events", "~100µs per operation"],
        breaks:
          "A shard failure loses the last few hundred milliseconds of holds to async replication, so the protocol is freeze, rebuild from Postgres sold rows plus the ordered Kafka hold log, reopen in 30 to 60s.",
        choice: {
          pick: "Redis as the hot truth, write-behind to Postgres, held to sold as a synchronous transaction",
          instead: "Postgres alone, with a unique partial index doing mutual exclusion and an expires_at predicate doing the lease.",
          decider:
            "Bitmap publishing cost across concurrent on-sales. One publish is a 60k-row snapshot; at ~200 active on-sales that is 12M rows/s of scanning purely to feed a read cache, plus a reaper competing on the same tables. Above roughly 20 simultaneous on-sales the in-memory copy stops being an optimisation.",
          flips:
            "A single-venue or single-promoter operator running a handful of on-sales at a time. One store has no reconciliation protocol and no window where Redis holds state Postgres has not seen, and at ~600 CAS/s throughput was never the reason to split.",
        },
      },
    },
    {
      id: "edge-publisher",
      label: "Edge publisher",
      sub: "2 bits/seat, 5KB gzipped",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "Renders the whole event's seat status into one 2-bit-per-seat bitmap every second, and the now_serving watermark every couple of seconds, and pushes both to the edge.",
        why: "This is the inversion the design turns on: mutating state that 1.5M people want is published once as a shared artefact rather than queried 1.5M times. Immutable geometry is deliberately kept out of the tick and cached forever behind a versioned URL.",
        numbers: ["60k seats = 15KB raw, ~5KB gzipped", "~2.4MB geometry, cached 1y", "watermark ~20B, 2s TTL"],
        breaks:
          "Release-back storms: when ~40% of holds expire together the map flickers green and a click stampede lands on the same freed seats, so the reap-to-publish delay is randomised over a few seconds.",
        choice: {
          pick: "One shared snapshot republished on a fixed 1s tick",
          instead: "Per-client seat queries, or event-driven invalidation per seat change.",
          decider:
            "Read amplification. 1.5M clients wanting 60k seat states from origin is ~7.5GB/s, about 60 Gbps, and impossible; the same bytes as one cached object is ~100 origin req/s. Publishing at 250ms instead multiplies edge egress fourfold to ~30GB/s and moves the endgame wall by seconds rather than removing it.",
          flips:
            "Inventory small enough to fit in the response of a per-user query, or audiences small enough that the collapse ratio buys nothing, where freshness per client is cheap and staleness is not worth explaining.",
        },
      },
    },
    {
      id: "exhaustion",
      label: "Exhaustion projector",
      sub: "sold-out rank, 2x margin",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "Continuously projects the rank at which inventory runs out from observed sell-through, and terminates everyone beyond a safety multiple of it.",
        why: "The queue's most important output is a rejection. 60k seats need ~42k admissions and are gone in about seven minutes, while draining 1.5M at 100/s would take 4.2 hours, so 97% of the crowd is never getting in and the only decision left is how fast you say so.",
        numbers: ["~42k admissions to exhaust", "~1.46M told sold out", "target: within 90s of on-sale"],
        breaks:
          "Terminating too aggressively strands returned inventory: about 40% of holds do not convert, and those seats need buyers who are still present rather than a refresh lottery among whoever happens to be on the page.",
        choice: {
          pick: "Terminate beyond 2x the projected exhaustion rank, with a waitlist opt-in",
          instead: "Leave everyone in the queue with a countdown until inventory is genuinely zero.",
          decider:
            "Support load and honesty against retained coverage. At 1x margin the several thousand seats returned by expired holds leak to whoever is refreshing; at 1.5M retained you are keeping people waiting 4.2 hours for inventory that lasts seven minutes. 2x covers the ~40% non-conversion with a queue you can still drain.",
          flips:
            "Sales where inventory is not exhausted by the spike, so nobody needs terminating and a countdown is simply the truth.",
        },
      },
    },
    {
      id: "orders-db",
      label: "Orders and tickets",
      sub: "Postgres, partitioned by event",
      kind: "database",
      col: 3,
      row: 4,
      detail: {
        what: "The durable record: orders, tickets with rotating barcode seeds, and the append-only hold log arriving write-behind through Kafka.",
        why: "It is the source of truth that survives a Redis rebuild, and it is deliberately small. The difficulty here is arrival shape rather than volume, which is why the flip to sold is a synchronous transaction and everything else is asynchronous.",
        numbers: ["~60k tickets per event", "~400B/order, ~200B/ticket", "~120GB/yr, ~360GB/yr at RF=3"],
        breaks:
          "Reconciliation is the last line: oversold seats are counted daily against distinct (event_id, seat_id) and every non-zero day is a postmortem, because a seat cannot be un-sold.",
        choice: {
          pick: "Postgres partitioned by event_id, with Kafka carrying the write-behind hold log",
          instead: "Writing orders and holds synchronously to Postgres on the hot path.",
          decider:
            "Which writes must be synchronous. Sold seats need RPO zero, and that is ~25k orders per on-sale, trivial. Holds are ~600/s per event of state that a TTL may erase anyway, so paying a synchronous commit for them buys durability nobody needs while adding latency to a p99 budgeted at 100ms.",
          flips:
            "A single-store design where Redis is not the hot truth, at which point holds are rows and the log is redundant.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "clients",
      to: "cdn",
      tier: "hot",
      label: "poll two shared objects",
      detail: {
        what: "Every waiting client polling the now_serving watermark every 5s and the seat bitmap every 1s.",
        why: "It is drawn as the hot path because this is where the traffic actually is. Both objects are identical bytes for all 1.5M viewers, so the volume terminates at the edge and the origin never learns how big the crowd was.",
        numbers: ["~300k req/s for the watermark", "~50 origin req/s after collapse"],
        breaks:
          "The bill, not an outage: ~7.5GB/s of edge egress, about 4.5TB over a ten-minute on-sale, and one extra kilobyte on the bitmap is ~1.5GB per on-sale second.",
      },
    },
    {
      id: "e2",
      from: "clients",
      to: "token-svc",
      tier: "hot",
      label: "join queue, ~150k/s",
      detail: {
        what: "POST /event/{id}/queue, the one and only origin write an unadmitted user makes.",
        why: "Everything after this is CDN-fed, so the write has to be cheap enough to survive the spike and self-contained enough that the client never needs to come back and ask where it stands.",
        numbers: ["~150k requests/s for ~10s", "~15ms, one sharded write"],
        breaks:
          "This is the only moment the crowd can saturate the origin, which is why the response carries the sort key: any design that makes the client return for its position turns 150k arrivals into 300k QPS of polling.",
      },
    },
    {
      id: "e3",
      from: "token-svc",
      to: "queue-tokens",
      tier: "hot",
      label: "ZADD random sort key",
      detail: {
        what: "Writing the token id into the event's sorted set with a random 64-bit score.",
        why: "Random scores are what make this shardable sixteen ways with zero coordination. A monotonic score would put every one of 150k writes a second through a single incrementing key.",
        numbers: ["150k writes/s across 16 shards", "~64B per entry"],
        breaks:
          "Nothing here reads back per user. If anyone adds a rank lookup endpoint on top of this set, the 50 req/s origin becomes 300k QPS again.",
      },
    },
    {
      id: "e5",
      from: "queue-tokens",
      to: "admission",
      tier: "hot",
      label: "lowest sort key first",
      detail: {
        what: "The gate popping the next token in ascending sort key order.",
        why: "This is the draw being resolved. Because the order was random at issue, popping in key order is a lottery result rather than a race result, and it costs nothing to compute.",
        numbers: ["~100 pops/s", "one leader per event"],
        breaks:
          "If the leader over-admits on handover that is safe, because the cap is a soft bound; under-admitting is not, because admission slots are the scarcest resource in the system.",
      },
    },
    {
      id: "e7",
      from: "admission",
      to: "purchase-api",
      tier: "hot",
      label: "session, 15 min",
      detail: {
        what: "A granted purchase session moving the user from the waiting room into the seat map.",
        why: "This arrow is the boundary the whole design defends. Above it, unbounded arrivals against cached bytes; below it, at most 25,000 concurrent buyers against real inventory.",
        numbers: ["≤ 25,000 in flow", "15-minute session TTL"],
        breaks:
          "Admitting someone into an event with no purchasable seats spends the scarcest resource in the design on a user who cannot buy anything, which is exactly what clock-driven refill produces.",
      },
    },
    {
      id: "e8",
      from: "purchase-api",
      to: "seat-state",
      fromSide: "right",
      toSide: "left",
      tier: "hot",
      label: "SET NX EX 600",
      detail: {
        what: "The conditional set that actually decides who gets seat 118-C-7, one key per seat, ten-minute expiry.",
        why: "The famous race lives on this arrow and it is one operation: both writes land on the same shard, which runs them serially, one returns OK and one returns nil. No version compare, no retry loop.",
        numbers: ["~1.5ms per set", "~600 CAS/s per event", "600s lease"],
        breaks:
          "Release must be a compare-and-delete, or a late rollback frees a seat that someone else has since legitimately taken.",
      },
    },
    {
      id: "e9",
      from: "seat-state",
      to: "edge-publisher",
      tier: "data",
      label: "seat bitmap, 1 Hz",
      detail: {
        what: "The full status of all 60k seats read once a second and encoded at two bits each.",
        why: "Reading everything on a tick is deliberately dumber than tracking deltas: the whole snapshot is 15KB raw, so there is nothing to gain from incremental publishing and a great deal to lose in correctness.",
        numbers: ["60k seats, ~5KB gzipped", "publish age SLO p99 ≤ 2s"],
        breaks:
          "Publish age is the metric that matters here; beyond about two seconds the 409 rate climbs and the map stops feeling live.",
      },
    },
    {
      id: "e10",
      from: "admission",
      to: "edge-publisher",
      tier: "control",
      label: "now_serving watermark",
      detail: {
        what: "The single global rank the gate has reached, about 20 bytes, published for everyone to subtract against.",
        why: "This is the inversion of the position query. The client already knows its own rank because the token carried it, so one number for the whole crowd replaces a per-user lookup at 300k QPS.",
        numbers: ["~20B object, 2s TTL", "~50 origin req/s regardless of crowd size"],
        breaks:
          "The client cannot be trusted with its own rank alone, so the rank is signed into the token and re-verified at the gate.",
      },
    },
    {
      id: "e11",
      from: "seat-state",
      to: "exhaustion",
      tier: "control",
      label: "sell-through velocity",
      detail: {
        what: "Observed rate of seats moving to sold, feeding the projection of where the queue stops being winnable.",
        why: "The projection has to come from actual sell-through rather than a pre-computed estimate, because release-backs and checkout abandonment move the exhaustion point by thousands of ranks during the sale.",
        numbers: ["60k seats in ~7 min", "~60% checkout completion"],
        breaks:
          "A projection computed once at on-sale would terminate the wrong people, and terminations cannot be taken back.",
      },
    },
    {
      id: "e12",
      from: "exhaustion",
      to: "edge-publisher",
      tier: "control",
      label: "sold-out rank, 2x margin",
      offset: 80,
      detail: {
        what: "The termination rank published into the same shared object the crowd is already polling.",
        why: "Telling 1.46M people they are out has to cost the same as telling them to wait, which means it travels as a number in an object that was already cached rather than as 1.46M notifications.",
        numbers: ["~1.46M terminated", "within 90s of on-sale"],
        breaks:
          "A queue that quietly stalls generates more support load and worse press than an early honest no, so slow honesty is treated as an SLO breach.",
      },
    },
    {
      id: "e13",
      from: "edge-publisher",
      to: "cdn",
      tier: "control",
      label: "5KB gzipped, 1s TTL",
      offset: 100,
      detail: {
        what: "Both micro-objects pushed to the edge, where roughly 100 POPs fan them out to the whole crowd.",
        why: "This is the arrow that makes read load independent of audience size. Three million arrivals produce the same origin traffic as 1.5M, because the origin is serving one object per POP per tick either way.",
        numbers: ["~150,000:1 collapse", "origin < 0.1% of client requests"],
        breaks:
          "One second of staleness is free early and vicious at the end: with 3,000 seats left against 25,000 buyers nearly every click lands on a taken seat, which is why the endgame switches to best-available rather than chasing freshness.",
      },
    },
    {
      id: "e14",
      from: "purchase-api",
      to: "checkout",
      tier: "hot",
      label: "hold, 10 min",
      detail: {
        what: "A confirmed all-or-nothing hold handed to the payment flow, with the price snapshotted onto it.",
        why: "Price is frozen at acquisition and honoured for the lease, because a user who saw $150 on a one-second-stale map and finds $310 at checkout will correctly call it a bait-and-switch.",
        numbers: ["600s hold", "~2.4 seats per order"],
        breaks:
          "About 40% of these never convert, and the seats they return arrive in bursts that the publisher has to stagger or they trigger a click stampede.",
      },
    },
    {
      id: "e15",
      from: "checkout",
      to: "payments",
      tier: "data",
      label: "authorise, not capture",
      detail: {
        what: "An authorisation against the provider while the seat is frozen and marked committing.",
        why: "Authorise-not-capture keeps the irreversible step after the seat flip. Money can be voided; a seat that two people have tickets for cannot be un-sold, so the ordering is not negotiable.",
        numbers: ["2 to 6s", "TTL extended to 900s while committing"],
        breaks:
          "A late authorisation landing after the hold expired and the seat resold must be auto-voided; if it captured, it is an oversell incident with an automatic refund and compensation.",
      },
    },
    {
      id: "e16",
      from: "checkout",
      to: "orders-db",
      tier: "data",
      label: "held to sold + tickets",
      detail: {
        what: "The synchronous transaction that flips the seats to sold and writes order and ticket rows with barcode seeds.",
        why: "This is the commit point of the whole system. Everything else, including the hold log, is allowed to be asynchronous precisely because this one write is not.",
        numbers: ["RPO zero for sold seats", "~25k orders per on-sale"],
        breaks:
          "If this write is made asynchronous to shave latency, a Redis rebuild can no longer distinguish a sold seat from a lost hold, which is the one failure the design exists to prevent.",
      },
    },
    {
      id: "e17",
      from: "checkout",
      to: "admission",
      fromSide: "left",
      toSide: "left",
      tier: "control",
      label: "completions refill bucket",
      offset: 90,
      detail: {
        what: "Checkouts, abandonments and TTL expiries returning tokens to the admission bucket.",
        why: "It closes the control loop. The gate paces itself against what the funnel is actually completing, so when the payment provider slows down the admission rate falls with it instead of over-filling the purchase path.",
        numbers: ["cap C = 25,000", "in-flow SLO 0.8 to 1.05 of cap"],
        breaks:
          "The admission rate is therefore variable, which must be surfaced in the wait estimate rather than hidden behind a fixed countdown that will be wrong.",
      },
    },
  ],
};
