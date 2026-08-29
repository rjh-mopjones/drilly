import type { Diagram } from "./types";

export const TICKETMASTER: Diagram = {
  id: "ticketmaster",
  title: "Ticketmaster",
  question: "Design Ticketmaster (High-Demand Ticket Booking)",
  sourceId: "patterns",
  itemId: 49,
  overview: {
    shape:
      "A funnel with a dam at the top: 1.5M people arrive in ten seconds, get a cheap lottery token, then wait while a gate releases about 100 buyers a second.",
    forces: [
      {
        constraint: "1.5M arrivals in ~10s against 60k seats, a 25:1 crowd-to-seat ratio",
        decision: "Every arrival gets a lottery token with a random sort key, written to the sharded Queue token store, instead of one ordering writer",
        lights: ["clients", "token-svc", "queue-tokens", "e2", "e3"],
      },
      {
        constraint: "A per-user position lookup at this scale would be ~300k QPS of pure overhead",
        decision: "Waiting reads two identical shared objects off the CDN edge, so origin sees ~50 req/s regardless of crowd size",
        lights: ["cdn", "edge-publisher", "e1", "e13"],
      },
      {
        constraint: "60,000 seats at ~2.4 seats/order means only 25,000 orders can be in flight before inventory is gone",
        decision: "The Admission controller caps in-flow buyers at C = 25,000 and releases ~100/s by Little's law",
        lights: ["admission", "e5", "e7", "e17"],
      },
      {
        constraint: "Conflict rate climbs toward ~100% once 25,000 in-flow buyers chase the last 3,000 seats",
        decision: "Purchase API holds seats with one atomic conditional set per seat, acquired in ascending id to avoid deadlock",
        lights: ["purchase-api", "seat-state", "e8"],
      },
      {
        constraint: "60k seats sell out in ~7 minutes, but draining 1.5M at 100/s would take 4.2 hours",
        decision: "The Exhaustion projector tells ~97% of the queue sold out within 90 seconds, keeping a 2x safety margin",
        lights: ["exhaustion", "e11", "e12"],
      },
    ],
    naive: {
      text: "Let all 1.5M arrivals connect directly and race for seats: a live seat map pushed over WebSockets, with a database transaction serialising each hold. The seat race itself is trivial. One conditional write settles it in microseconds. The load that breaks this design is the crowd, not the seats. 1.5M TLS handshakes inside ten seconds exhaust load-balancer accept queues before a single seat sells, and every surviving connection pins memory in the tier you are trying to keep empty. A per-user position query at that scale is ~300k QPS of pure overhead. The Admission controller and CDN edge replace direct access with a metered gate: tokens issued cheaply, then the crowd waits on shared cached objects instead of live connections.",
      lights: ["admission", "cdn", "token-svc"],
    },
    beats: [
      {
        text: "Arrival is a lottery draw, not a queue. Every user gets a token carrying a random 64-bit sort key written to a sharded in-memory set: 150k writes/s across 16 shards with no counter and therefore no hotspot. A monotonic sequencer for strict first-come-first-served would be a single writer at exactly peak, with no headroom, and it would sell the show to whoever sits 3ms from the edge.",
        lights: ["clients", "token-svc", "queue-tokens", "e2", "e3"],
      },
      {
        text: "Waiting is free because nothing about it is per-user. The client polls two objects that are identical bytes for everyone: a 20-byte now_serving watermark on a 2s TTL and a 2-bit-per-seat bitmap, 5KB gzipped, republished once a second. Position is subtraction on the client. A per-user position endpoint would be 300k QPS of pure overhead; one shared object makes the origin see about 50 requests a second regardless of how many people showed up.",
        lights: ["cdn", "edge-publisher", "e1", "e13"],
      },
      {
        text: "Admission is sized from inventory rather than guessed. Cap in-flow buyers at C = 25,000, because 25,000 orders of 2.4 seats is 60,000 seats, exactly one venue held and no more. Little's law over a 240s mean session gives about 100 admissions/s. Refill the bucket from completions, never from a clock, or a slow payment provider drifts in-flow past the cap and admitted users arrive at a fully grey map.",
        lights: ["admission", "e5", "e7", "e17"],
      },
      {
        text: "The write race is the easy part and it happens behind the gate. A hold is a lease: a conditional set with a 600s expiry per seat, acquired in ascending seat id so overlapping multi-seat orders cannot deadlock. It is released with a compare-and-delete so a late rollback cannot free somebody else's seat. About 600 conditional sets a second per event. The loser gets a 409 carrying the seat's current status inline, so the client greys it without waiting for the next bitmap tick.",
        lights: ["purchase-api", "seat-state", "e8"],
      },
      {
        text: "Checkout is where money and inventory have to agree. Extend the seat key's expiry to cover the payment timeout and mark the hold committing, authorise rather than capture, and only flip held to sold in a synchronous database transaction. Holds themselves are written asynchronously to a durable log, which is what makes a cache failover a 30 to 60s freeze-rebuild-reopen rather than a double-sold seat.",
        lights: ["checkout", "payments", "orders-db", "e14", "e15", "e16"],
      },
      {
        text: "The terminal state is a first-class feature. 60k seats need roughly 42k admissions and go in about seven minutes, but draining 1.5M at 100/s would take 4.2 hours. About 97% of the queue must be told sold out inside 90 seconds. Keep 2x the projected exhaustion rank rather than 1x, because around 40% of holds never convert and those seats come back needing buyers who are still present.",
        lights: ["exhaustion", "e11", "e12"],
      },
    ],
    crux: {
      problem:
        "You win by keeping people out, not by making the write faster. The seat race is one conditional set, over in microseconds. The load is 1.5M browsers wanting a live picture of 60,000 seats.",
      handled:
        "Unlike an auction, whose deadline is the close and whose contention cannot be throttled, this deadline is the start of sale. Metering arrivals is available, and it is the whole design. The Admission controller caps concurrent buyers at what inventory can absorb. The Queue token service turns arrival into a cheap lottery rather than a race, and the CDN edge serves identical cached objects so waiting costs the origin almost nothing.",
    },
    numbers: [
      {
        value: "1.5M arrivals in ~10s against 60k seats: 25:1",
        explain: "The crowd-to-seat ratio that sets every other number in the system; only about 4% of arrivals can ever hold a seat.",
      },
      {
        value: "C = 25,000 in flow ÷ 240s session = ~100 admissions/s",
        explain: "Little's law applied to the admission cap: with a 240s mean session length, 25,000 concurrent buyers implies roughly 100 new admissions per second to keep the population steady.",
      },
      {
        value: "300k QPS of position polling collapses to ~50 origin req/s",
        explain: "What a naive per-user position endpoint would cost against what one shared, CDN-cached object actually costs the origin, a roughly 6,000x reduction.",
      },
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
        numbers: [
          { value: "~150k arrivals/s in, ~100 admissions/s out", explain: "The attenuation this zone performs: everything above the ratio is absorbed here rather than passed downstream." },
          { value: "1500:1 attenuation", explain: "The same ratio expressed as a single number, the compression factor that makes the rest of the system sized for the sustainable rate, not the spike." },
        ],
        breaks: {
          failure: "If the gate leaks, everything downstream fails at once: the seat store sees contention it was never admitted for and the origin sees traffic the CDN was supposed to absorb.",
          handled: "The admission cap and risk scoring both live in this one zone, so a bug here is the single place to look. The cap itself is defended by fail-open risk scoring that tightens per-identity limits rather than blocking admission outright.",
        },
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
        why: "It is drawn because its shape is the whole problem. Not a rate you can provision for, but a spike that reaches 150k new sessions a second and then decays, against inventory gone in seven minutes.",
        numbers: [
          { value: "1.5M arrivals in ~10s", explain: "The spike's total size and duration, the number every downstream tier is defended against." },
          { value: "~2.4 seats per order", explain: "The average order size, which converts a seat count directly into an order count and an in-flow admission cap." },
          { value: "25 buyers per seat", explain: "1.5M arrivals against 60k seats; the fraction of the crowd that can ever succeed." },
        ],
        breaks: {
          failure: "A meaningful share of these are funded, organised bots on residential proxies, indistinguishable from real users at the moment they arrive.",
          handled: "Risk scoring runs at token issue and again at admission, using fingerprint, ASN and identity-graph signals rather than trying to catch bots by request shape alone.",
        },
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
        why: "This is the only origin write the crowd makes. After it the client is entirely CDN-fed, so the tier must absorb the spike. It hands back something the client can reason about locally, not something it must come back and ask about.",
        numbers: [
          { value: "~150k tokens/s at the spike", explain: "The peak write rate this service has to absorb in the first seconds of an on-sale." },
          { value: "~64B per token, ~100MB per on-sale", explain: "The per-token footprint, multiplied out across a full 1.5M-arrival on-sale." },
          { value: "one sharded write, ~15ms", explain: "At ~150k tokens/s peak, 15ms per sharded write is what keeps a queue from forming behind it — slower and the spike backs up instead of draining." },
        ],
        breaks: {
          failure: "A shard failing during the spike silently drops a slice of arrivals.",
          handled: "The client retries against a different shard and simply redraws a key, which is harmless because the ordering is random by construction anyway.",
        },
        choice: {
          pick: "Random 64-bit sort key per token, a lottery draw at issue",
          instead: "A monotonic sequencer giving strict first-come-first-served order.",
          decider:
            "Inventory spans the first 0.4s of arrivals at 150k/s, and a cloud instance 3ms from the edge beats home broadband by 30 to 50ms, which is 4,500 to 7,500 positions. The entire allocation is decided inside a window where only network position varies. The sequencer is also a single writer topping out near 150k ops/s, exactly peak with zero headroom.",
          flips:
            "When inventory spans more than about a second of arrivals, say 60k seats at 5k arrivals/s. There human reaction spread dominates the purchasable advantage, and FCFS really is ordering people rather than ordering their ISPs. Also when the promoter puts FCFS in the contract.",
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
        what: "One leader per event popping the lowest sort key, re-scoring the token against fingerprint, ASN and identity-graph signals, then granting 15-minute purchase sessions at a rate derived from inventory.",
        why: "This is the component the question exists for. The purchase path only ever sees a few hundred concurrent buyers however many are outside. It is sized so even the worst case holds exactly one venue's worth of seats and no more. Risk scoring sits here, not at checkout, because rejecting a bot after it holds a seat has already cost that seat for ten minutes.",
        numbers: [
          { value: "C = 25,000 in flow", explain: "The hard cap on concurrent admitted buyers, derived from inventory rather than guessed." },
          { value: "25,000 x 2.4 = 60,000 seats", explain: "The cap multiplied by average order size lands exactly at total inventory, no more." },
          { value: "25,000 ÷ 240s ≈ ~100 admissions/s", explain: "Little's law: the steady-state admission rate that keeps the in-flow population at the cap." },
          { value: "~15% challenged, target ≥90% of inventory to humans", explain: "The risk-scoring outcome split, and the fairness target the whole gate is tuned against." },
        ],
        breaks: {
          failure: "The leader dying mid-on-sale stops admissions entirely, and a bot-heavy on-sale beats a dead one if risk scoring blocks hard.",
          handled: "Detection is the watermark going flat while queue depth is non-zero, and the new leader resumes from the persisted watermark. The risk lookup fails open, with per-identity caps tightened automatically to bound the damage.",
        },
        choice: {
          pick: "Token bucket refilled by completions, cap set by Little's law",
          instead: "A fixed admission schedule on a timer, or no gate at all with autoscaling behind it.",
          decider:
            "What happens when mean session time moves. Checkout is 2 to 6s with the payment provider dominating, so a provider slowdown doubles session time. A clock-driven gate then drifts in-flow past 25,000, and admission slots are spent on users who arrive at a fully grey map. Completion-driven refill self-tunes downward instead.",
          flips:
            "A staggered or unannounced release, where arrivals never exceed the serviceable rate and the queue is a smoothing buffer rather than a dam. There a gentle fixed rate is simpler and invisible to users.",
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
        numbers: [
          { value: "~600 CAS ops/s per event", explain: "The conditional-set rate one event's purchase traffic generates against seat state, well within what a single Redis shard absorbs." },
          { value: "hold p99 < 100ms", explain: "Fast enough to retry several times within a user's patience — that matters most near sell-out, when conflict on remaining seats climbs from under 15% toward 100%." },
          { value: "one SET NX ≈ 1.5ms", explain: "×~2.4 seats/order ≈ 3.6ms of real work per hold — most of the 100ms p99 budget is headroom for network and retry, not this operation." },
        ],
        breaks: {
          failure: "Near sell-out the conflict rate goes from under 15% to nearly 100%, because 25,000 in-flow buyers are clicking at 3,000 remaining seats.",
          handled: "No amount of freshness changes that ratio, so the endgame switches strategy entirely: best-available replaces free-pick clicking once the queue depth crosses a threshold.",
        },
        choice: {
          pick: "Server-side best-available as the default path, manual picking kept available",
          instead: "Pure manual seat selection with optimistic retry on conflict.",
          decider:
            "Key concentration. Everyone clicks the same twenty seats, so retry produces livelock: 500 clients race the same central row, one wins, 499 retry and collide again. Hashing the session id into a preference-list offset spreads 200 concurrent allocations over ~200 distinct keys instead of one.",
          flips:
            "Small or low-contention events, where free choice is the product and the conflict rate never leaves single digits, so taking the seat map away buys nothing.",
        },
      },
    },
    {
      id: "checkout",
      label: "Checkout",
      sub: "payment saga",
      kind: "service",
      col: 1,
      row: 4,
      detail: {
        what: "Extends the hold to cover the payment timeout, runs the payment saga, flips held to sold and emits ticket records with rotating barcode seeds.",
        why: "This is where money and inventory have to agree, and the ordering is the whole trick: the seat flip is the commit point, so nothing irreversible may happen before it. About 60% of admitted buyers get this far.",
        numbers: [
          { value: "2 to 6s, provider dominates", explain: "The typical checkout duration, almost entirely spent waiting on the payment provider rather than on this service's own logic." },
          { value: "EXPIRE 900 while committing", explain: "The hold's expiry is extended to 900 seconds once checkout begins, so a slow payment authorisation cannot outrun the original 600s lease." },
          { value: "~25k orders per on-sale", explain: "The typical order volume for a full sell-out, roughly matching 60k seats at ~2.4 seats/order." },
        ],
        breaks: {
          failure: "Authorisation can succeed after the hold expired and the seat was resold, which is an oversell incident with no clean unwind if the payment captured.",
          handled: "A late auth must be void-able, so the design keeps every authorisation reversible until the seat flip commits, and a captured payment for a resold seat triggers an automatic refund.",
        },
        choice: {
          pick: "Freeze the seat and extend the TTL on entering checkout, capture only after the flip",
          instead: "Let the 600s hold TTL run out naturally while payment is in flight.",
          decider:
            "The gap between the two timeouts. A 600s hold against a payment tail of 2 to 6s looks safe until the provider degrades, and then the seat releases mid-authorisation. EXPIRE 900 plus a committing marker closes the window; capture after commit means the only failure left is a void, not a refund.",
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
        numbers: [
          { value: "2 to 6s per checkout", explain: "The typical latency this hop adds, the dominant term in the ~240s mean session time used to size admissions." },
          { value: "its p99 tail sets the ~240s mean session time Little's law runs on", explain: "The provider's own tail latency, not this system's code, is the input that determines the sustainable admission rate." },
        ],
        breaks: {
          failure: "A provider slowdown inflates session time, collapses admission throughput and lengthens the queue.",
          handled: "The design responds by circuit-breaking the provider, extending hold TTLs and lowering the admission rate, rather than raising the concurrency cap to compensate.",
        },
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
        numbers: [
          { value: "~150,000:1 collapse ratio", explain: "This collapse is what turns 1.5M pollers into the ~100 req/s that actually reach origin below — the reason edge caching, not push, can serve the crowd." },
          { value: "~100 POPs, origin sees ~100 req/s", explain: "Roughly one request per point of presence per publish tick reaches the origin; everything else is served from edge cache." },
          { value: "~7.5GB/s edge egress", explain: "The bandwidth cost of serving 1.5M polling clients from the edge, the real bill this design incurs." },
        ],
        breaks: {
          failure: "A POP serving a stale bitmap past its TTL makes the map lie.",
          handled: "Clients fall back to a jittered direct fetch with a visible staleness banner, and conflicts from stale data are already handled by the 409 a hold attempt returns.",
        },
        choice: {
          pick: "Short-TTL micro-objects on a CDN, polled by the client",
          instead: "WebSockets pushing seat updates to every viewer.",
          decider:
            "Connection establishment. 1.5M TLS handshakes inside ten seconds exhausts load-balancer accept queues before a single seat is sold. Each surviving connection also pins memory in the tier you are trying to keep empty. Push becomes correct after the gate, at ~25,000 sessions rather than 1.5M.",
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
        numbers: [
          { value: "~100MB per on-sale", explain: "~6MB per shard across sixteen shards — trivial next to Redis's per-shard memory, so sharding here buys write parallelism, not storage headroom." },
          { value: "TTL 24h after on-sale opens", explain: "How long tokens are retained before automatic cleanup, well past the seven minutes a sell-out typically takes." },
          { value: "16 shards, no cross-shard write", explain: "The write parallelism this structure achieves, since a random score never has to coordinate across shards." },
        ],
        breaks: {
          failure: "Losing a shard loses a slice of entries.",
          handled: "This is survivable only because order is random by construction: a redrawn key is exactly as fair as the one it replaced, so the client simply retries.",
        },
        choice: {
          pick: "Redis sorted set with random scores, sharded by event",
          instead: "A durable log such as Kafka, one partition per event, consumed in order.",
          decider:
            "What the structure is asked to do. This is 150k inserts/s for ten seconds followed by ~100 pops/s, with entries worthless 24h later. A log gives ordering guarantees the random key already makes irrelevant, and pays durability cost for data whose loss mode is a user redrawing a token.",
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
        numbers: [
          { value: "~80B/seat, ~5MB per event", explain: "The per-seat footprint and one event's total, small enough to keep every live event resident in memory." },
          { value: "~50GB across ~10k live events", explain: "The fleet-wide memory footprint across every event with active inventory at once." },
          { value: "~100µs per operation", explain: "Three orders of magnitude under the purchase API's 100ms hold p99 — Redis itself is never the bottleneck; network and retry chatter is." },
        ],
        breaks: {
          failure: "A shard failure loses the last few hundred milliseconds of holds to async replication.",
          handled: "The protocol is freeze, rebuild from Postgres sold rows plus the ordered Kafka hold log, reopen in 30 to 60s, trading a brief pause for a guaranteed-correct rebuild.",
        },
        choice: {
          pick: "Redis as the hot truth, write-behind to Postgres, held to sold as a synchronous transaction",
          instead: "Postgres alone, with a unique partial index doing mutual exclusion and an expires_at predicate doing the lease.",
          decider:
            "Bitmap publishing cost across concurrent on-sales. One publish is a 60k-row snapshot; at ~200 active on-sales that is 12M rows/s of scanning purely to feed a read cache, plus a reaper competing on the same tables. Above roughly 20 simultaneous on-sales the in-memory copy stops being an optimisation.",
          flips:
            "A single-venue or single-promoter operator running a handful of on-sales at a time. One store has no reconciliation protocol and no window where Redis holds state Postgres has not seen.",
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
        numbers: [
          { value: "60k seats = 15KB raw, ~5KB gzipped", explain: "The full seat-status bitmap's size before and after compression, small enough to republish every second at scale." },
          { value: "~2.4MB geometry, cached 1y", explain: "The venue seat map's static geometry, published once and reused across every on-sale for that venue." },
          { value: "watermark ~20B, 2s TTL", explain: "The tiny global rank object, refreshed often enough that waiting clients see steady progress." },
        ],
        breaks: {
          failure: "Release-back storms happen when ~40% of holds expire together, flickering the map green and stampeding clicks onto the same freed seats.",
          handled: "The reap-to-publish delay is randomised over a few seconds, spreading the release across the publish window instead of letting it land in one visible burst.",
        },
        choice: {
          pick: "One shared snapshot republished on a fixed 1s tick",
          instead: "Per-client seat queries, or event-driven invalidation per seat change.",
          decider:
            "Read amplification. 1.5M clients wanting 60k seat states from origin is ~7.5GB/s, about 60 Gbps, and impossible; the same bytes as one cached object is ~100 origin req/s. Publishing at 250ms instead multiplies edge egress fourfold and moves the endgame wall by seconds rather than removing it.",
          flips:
            "Inventory small enough to fit in the response of a per-user query, or audiences small enough that the collapse ratio buys nothing, where freshness per client is cheap.",
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
        why: "The queue's most important output is a rejection. 60k seats need ~42k admissions and are gone in about seven minutes, while draining 1.5M at 100/s would take 4.2 hours. About 97% of the crowd is never getting in, and the only decision left is how fast you say so.",
        numbers: [
          { value: "~42k admissions to exhaust", explain: "The projected admission rank at which inventory runs out, computed from observed sell-through rather than assumed in advance." },
          { value: "~1.46M told sold out", explain: "The vast majority of the original crowd, who by construction can never hold a seat." },
          { value: "target: within 90s of on-sale", explain: "How quickly the design commits to telling most of the crowd the truth, rather than leaving them waiting on a false hope." },
        ],
        breaks: {
          failure: "Terminating too aggressively strands returned inventory: about 40% of holds do not convert, and those seats need buyers who are still present.",
          handled: "The projector keeps a 2x margin over the raw exhaustion estimate specifically to cover this non-conversion rate, rather than a refresh lottery among whoever happens to reload the page.",
        },
        choice: {
          pick: "Terminate beyond 2x the projected exhaustion rank, with a waitlist opt-in",
          instead: "Leave everyone in the queue with a countdown until inventory is genuinely zero.",
          decider:
            "Support load and honesty against retained coverage. At 1x margin the several thousand seats returned by expired holds leak to whoever is refreshing. At 1.5M retained you are keeping people waiting 4.2 hours for inventory that lasts seven minutes. 2x covers the ~40% non-conversion with a queue still drainable.",
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
        numbers: [
          { value: "~60k tickets per event", explain: "The full ticket count for a sold-out show, tiny by database standards despite the traffic that produced it." },
          { value: "~400B/order, ~200B/ticket", explain: "The per-row footprint for orders and tickets, the size that makes this store's total volume trivial." },
          { value: "~120GB/yr, ~360GB/yr at RF=3", explain: "Annual growth of the durable record across a full year of on-sales, tripled for replication." },
        ],
        breaks: {
          failure: "Oversold seats are the failure this store cannot self-repair; a seat cannot be un-sold once two orders reference it.",
          handled: "Reconciliation is the last line: oversold seats are counted daily against distinct (event_id, seat_id), and every non-zero day is a postmortem rather than a silent write-off.",
        },
        choice: {
          pick: "Postgres partitioned by event_id, with Kafka carrying the write-behind hold log",
          instead: "Writing orders and holds synchronously to Postgres on the hot path.",
          decider:
            "Which writes must be synchronous. Sold seats need RPO zero, and that is ~25k orders per on-sale, trivial. Holds are ~600/s per event of state a TTL may erase anyway. A synchronous commit for them buys durability nobody needs while adding latency to a p99 budgeted at 100ms.",
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
      step: 3,
      label: "poll two shared objects",
      detail: {
        what: "Every waiting client polling the now_serving watermark every 5s and the seat bitmap every 1s.",
        why: "This is where the traffic actually is. Both objects are identical bytes for all 1.5M viewers, so the volume terminates at the edge and the origin never learns how big the crowd was.",
        numbers: [
          { value: "~300k req/s for the watermark", explain: "The client-side polling load this design absorbs entirely at the edge, never reaching origin." },
          { value: "~50 origin req/s after collapse", explain: "What actually reaches the origin once edge caching collapses 1.5M identical requests into a handful per POP per tick." },
        ],
        breaks: {
          failure: "The bill, not an outage: ~7.5GB/s of edge egress, about 4.5TB over a ten-minute on-sale.",
          handled: "This cost is accepted as the price of keeping the origin untouched. One extra kilobyte on the bitmap is ~1.5GB per on-sale second, which is why the bitmap format is kept as compact as possible.",
        },
      },
    },
    {
      id: "e2",
      from: "clients",
      to: "token-svc",
      tier: "hot",
      step: 1,
      label: "join queue, ~150k/s",
      detail: {
        what: "The single origin write an unadmitted user makes, requesting a queue token.",
        why: "Everything after this is CDN-fed, so the write has to be cheap enough to survive the spike. It also has to be self-contained enough that the client never needs to come back and ask where it stands.",
        numbers: [
          { value: "~150k requests/s for ~10s", explain: "The peak write rate this endpoint must absorb during the arrival spike." },
          { value: "~15ms, one sharded write", explain: "At ~150k req/s peak, this per-write cost is what stays below queueing threshold — the write has to clear before the next arrival lands." },
        ],
        breaks: {
          failure: "This is the only moment the crowd can saturate the origin.",
          handled: "The response carries the sort key inline, so the client never needs to return for its position. A design that made the client ask again would turn 150k arrivals into 300k QPS of polling.",
        },
      },
    },
    {
      id: "e3",
      from: "token-svc",
      to: "queue-tokens",
      tier: "hot",
      step: 2,
      label: "ZADD random sort key",
      detail: {
        what: "Writing the token id into the event's sorted set with a random 64-bit score.",
        why: "Random scores are what make this shardable sixteen ways with zero coordination. A monotonic score would put every one of 150k writes a second through a single incrementing key.",
        numbers: [
          { value: "150k writes/s across 16 shards", explain: "The aggregate write rate, spread evenly because random scores never concentrate on one shard." },
          { value: "~64B per entry", explain: "150k writes/s × 64B ≈ 9.6MB/s aggregate — trivial payload volume, so shard count and random scoring bound throughput here, not entry size." },
        ],
        breaks: {
          failure: "Nothing here reads back per user, which is deliberate.",
          handled: "If anyone were to add a rank-lookup endpoint on top of this set, the 50 req/s origin load would become 300k QPS again. That endpoint is a constraint the design must never violate.",
        },
      },
    },
    {
      id: "e5",
      from: "queue-tokens",
      to: "admission",
      tier: "hot",
      step: 4,
      label: "lowest sort key first",
      detail: {
        what: "The gate popping the next token in ascending sort key order.",
        why: "This is the draw being resolved. Because the order was random at issue, popping in key order is a lottery result rather than a race result, and it costs nothing to compute.",
        numbers: [
          { value: "~100 pops/s", explain: "The steady-state rate the gate pops tokens, matching the Little's law admission rate." },
          { value: "one leader per event", explain: "A single elected process performs the pop, avoiding any coordination over who admits whom." },
        ],
        breaks: {
          failure: "Under-admitting wastes the scarcest resource in the system: an admission slot nobody uses.",
          handled: "Over-admitting on leader handover is treated as safe, since the cap is a soft bound; the design tolerates brief over-admission rather than risk stalling the gate entirely.",
        },
      },
    },
    {
      id: "e7",
      from: "admission",
      to: "purchase-api",
      tier: "hot",
      step: 5,
      label: "session, 15 min",
      detail: {
        what: "A granted purchase session moving the user from the waiting room into the seat map.",
        why: "This arrow is the boundary the whole design defends. Above it, unbounded arrivals against cached bytes; below it, at most 25,000 concurrent buyers against real inventory.",
        numbers: [
          { value: "≤ 25,000 in flow", explain: "The hard ceiling on concurrent sessions past this point, enforced by the admission cap upstream." },
          { value: "15-minute session TTL", explain: "How long an admitted session stays valid before it expires and its slot returns to the bucket." },
        ],
        breaks: {
          failure: "Admitting someone into an event with no purchasable seats spends the scarcest resource in the design on a user who cannot buy anything.",
          handled: "This is exactly what clock-driven refill produces, which is why refill is driven by completions instead: the gate self-limits to what inventory can actually support.",
        },
      },
    },
    {
      id: "e8",
      from: "purchase-api",
      to: "seat-state",
      fromSide: "right",
      toSide: "left",
      tier: "hot",
      step: 6,
      label: "SET NX EX 600",
      detail: {
        what: "The conditional set that actually decides who gets seat 118-C-7, one key per seat, ten-minute expiry.",
        why: "The famous race lives on this arrow and it is one operation: both writes land on the same shard, which runs them serially, one returns OK and one returns nil. No version compare, no retry loop.",
        numbers: [
          { value: "~1.5ms per set", explain: "600 CAS/s × 1.5ms is under one core's worth of work per event — contention here is about key concentration on hot seats, not raw throughput." },
          { value: "~600 CAS/s per event", explain: "The aggregate rate of these conditional operations across one busy event." },
          { value: "600s lease", explain: "How long a successful hold reserves the seat before it automatically expires and returns to inventory." },
        ],
        breaks: {
          failure: "Release must be a compare-and-delete, or a late rollback frees a seat that someone else has since legitimately taken.",
          handled: "Every release checks that the holder identity still matches before deleting the key, so a stale rollback can never clobber a newer, valid hold.",
        },
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
        why: "Reading everything on a tick is deliberately dumber than tracking deltas. The whole snapshot is 15KB raw, so there is nothing to gain from incremental publishing and a great deal to lose in correctness.",
        numbers: [
          { value: "60k seats, ~5KB gzipped", explain: "60k seats × 2 bits ≈ 15KB raw, gzipped to ~5KB — small enough to republish every second without the bitmap itself becoming the bottleneck." },
          { value: "publish age SLO p99 ≤ 2s", explain: "The freshness target for this snapshot, past which the map is considered stale." },
        ],
        breaks: {
          failure: "Publish age is the metric that matters here; beyond about two seconds the 409 rate climbs and the map stops feeling live.",
          handled: "This is monitored directly as an SLO rather than inferred from user complaints, so a slow publish pipeline is caught before it degrades the click-through rate visibly.",
        },
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
        numbers: [
          { value: "~20B object, 2s TTL", explain: "The tiny size and refresh cadence of the watermark, cheap enough to poll at 300k req/s without touching origin." },
          { value: "~50 origin req/s regardless of crowd size", explain: "What this shared object actually costs the origin, independent of how many clients are polling it." },
        ],
        breaks: {
          failure: "The client cannot be trusted with its own rank alone; a forged rank would let someone skip the queue.",
          handled: "The rank is signed into the token at issue and re-verified at the gate, so a client-side claim alone is never sufficient to gain admission.",
        },
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
        numbers: [
          { value: "60k seats in ~7 min", explain: "The observed pace of a sell-out, the raw signal the exhaustion projection is computed from." },
          { value: "~60% checkout completion", explain: "Only 6 in 10 admitted sessions convert — the other 4 release seats back, so the projection must net that leakage in or it stops the queue too early." },
        ],
        breaks: {
          failure: "A projection computed once at on-sale would terminate the wrong people, since terminations cannot be taken back.",
          handled: "Recomputing continuously from live sell-through means the projection tracks reality as release-backs and abandonment shift the true exhaustion point.",
        },
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
        why: "Telling 1.46M people they are out has to cost the same as telling them to wait. It travels as a number in an object already cached, rather than as 1.46M separate notifications.",
        numbers: [
          { value: "~1.46M terminated", explain: "The share of the original crowd told sold out, by construction the vast majority given the 25:1 crowd-to-seat ratio." },
          { value: "within 90s of on-sale", explain: "How quickly this termination decision reaches the crowd once the projector commits to it." },
        ],
        breaks: {
          failure: "A queue that quietly stalls generates more support load and worse press than an early honest no.",
          handled: "Slow honesty is treated as an SLO breach in its own right, not just a UX nicety, which is why the 90s target is monitored alongside the admission-rate SLOs.",
        },
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
        numbers: [
          { value: "~150,000:1 collapse", explain: "The same collapse ratio the CDN edge achieves, restated at the point where the publisher hands objects to it." },
          { value: "origin < 0.1% of client requests", explain: "~100 origin req/s against ~150k client req/s at peak is already under 0.1% — audience size stops being a cost variable once objects publish once per tick." },
        ],
        breaks: {
          failure: "One second of staleness is free early and vicious at the end: with 3,000 seats left against 25,000 buyers, nearly every click lands on a taken seat.",
          handled: "This is why the endgame switches to best-available rather than chasing ever-fresher publishing, since no realistic publish rate can outrun that contention ratio.",
        },
      },
    },
    {
      id: "e14",
      from: "purchase-api",
      to: "checkout",
      tier: "hot",
      step: 7,
      label: "hold, 10 min",
      detail: {
        what: "A confirmed all-or-nothing hold handed to the payment flow, with the price snapshotted onto it.",
        why: "Price is frozen at acquisition and honoured for the lease. A user who saw $150 on a one-second-stale map and finds $310 at checkout will correctly call it a bait-and-switch.",
        numbers: [
          { value: "600s hold", explain: "The initial lease duration handed to checkout before any extension for payment processing." },
          { value: "~2.4 seats per order", explain: "The average order size, which determines how many seat keys one checkout flow tracks together." },
        ],
        breaks: {
          failure: "About 40% of these never convert, and the seats they return arrive in bursts that can trigger a click stampede.",
          handled: "The edge publisher randomises the reap-to-publish delay for released holds specifically to spread these bursts out over a few seconds.",
        },
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
        numbers: [
          { value: "2 to 6s", explain: "The typical time this authorisation call takes, the dominant term in checkout latency." },
          { value: "TTL extended to 900s while committing", explain: "The hold's expiry is pushed out to cover this call, so a slow authorisation cannot expire the seat mid-flight." },
        ],
        breaks: {
          failure: "A late authorisation landing after the hold expired and the seat resold must be auto-voided.",
          handled: "If it had captured instead, it would be an oversell incident with an automatic refund and compensation, which is why capture is deliberately deferred past this point.",
        },
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
        numbers: [
          { value: "RPO zero for sold seats", explain: "No data loss is tolerated for this specific write, unlike holds, which a TTL is allowed to erase." },
          { value: "~25k orders per on-sale", explain: "The typical write volume this transaction handles across a full sell-out." },
        ],
        breaks: {
          failure: "If this write were made asynchronous to shave latency, a Redis rebuild could no longer distinguish a sold seat from a lost hold.",
          handled: "That distinction is the one failure the design exists to prevent, which is why this single write stays synchronous even though it costs latency everywhere else is spared.",
        },
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
        numbers: [
          { value: "cap C = 25,000", explain: "The target in-flow population this feedback loop is regulating toward." },
          { value: "in-flow SLO 0.8 to 1.05 of cap", explain: "The acceptable band the actual in-flow population is allowed to drift within before the refill rate is adjusted further." },
        ],
        breaks: {
          failure: "The admission rate is therefore variable, not a fixed number a countdown can promise.",
          handled: "This variability is surfaced directly in the wait estimate shown to users, rather than hidden behind a fixed countdown that would be wrong whenever the payment provider slows down.",
        },
      },
    },
  ],
};
