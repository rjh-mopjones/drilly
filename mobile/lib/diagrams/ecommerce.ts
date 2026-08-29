import type { Diagram } from "./types";

export const ECOMMERCE: Diagram = {
  id: "ecommerce",
  title: "E-Commerce Platform",
  question: "Design an E-Commerce Platform (Catalog, Cart & Flash Sales)",
  sourceId: "patterns",
  itemId: 48,
  overview: {
    shape:
      "Two systems sharing one gateway. An enormous read path is pure caching and never authoritative; a small write path's entire difficulty is one inventory counter under thousands of simultaneous writers.",
    forces: [
      {
        constraint: "~1,600 page views happen for every order, so browsing is a caching problem and buying is a contention problem",
        decision: "The read and write paths share only the gateway and nothing else, so a saturated counter can never touch browse",
        lights: ["gateway", "cdn", "saga"],
      },
      {
        constraint: "at 2.5% session conversion, reserving at add-to-cart would leave 97.5% of holds expiring unused",
        decision: "A cart line is only a price snapshot; the reserve happens once, at checkout entry, where the shopper has actually committed",
        lights: ["cart", "saga", "e4"],
      },
      {
        constraint: "the last unit of a doorbuster can face ~8,000 reserve attempts a second on a single row",
        decision: "A heat classifier routes each SKU into a cold, warm or hot lane by its measured reserve rate, rather than one mechanism for all 200M SKUs",
        lights: ["holds", "lanes-group", "cold", "warm", "hot"],
      },
      {
        constraint: "a row lock at ~3ms per critical section sustains only ~330 decrements/s against 8,000 arrivals/s",
        decision: "The hot lane serialises through a per-SKU append log with one consumer, so a backlog is truncated in one pass rather than walked",
        lights: ["hot", "e9", "e13"],
      },
      {
        constraint: "the page's cached price is up to 15s old, and a promotion depends on the whole cart, tax on an address",
        decision: "Checkout always re-prices authoritatively and echoes accepted_total, so a stale cache costs a re-quote, never a wrong charge",
        lights: ["pricing", "saga", "e5", "e18"],
      },
    ],
    naive: {
      text: "Reserve the item the moment it's added to the cart, so by checkout the stock is already theirs, with one row per SKU decremented by a plain UPDATE. At 2.5% session conversion, 97.5% of those holds expire unused. Effective sellable stock then deflates by the abandonment rate, and the site reports sold out with full warehouses. On a doorbuster the same single row also has to absorb roughly 8,000 reserve attempts a second. A row lock at a ~3ms critical section only sustains about 330 decrements a second, so the wait queue grows by roughly 7,670 every second. The design instead reserves once, at checkout entry, and routes each SKU into a cold, warm or hot lane by its measured contention.",
      lights: ["saga", "lanes-group"],
    },
    beats: [
      {
        text: "Two systems in one product, and the usual failure is designing them as one. At roughly 1,600 page views per order, browsing is a caching problem and buying is a contention problem, so they are wired to share only the gateway and nothing else.",
        lights: ["gateway", "cdn", "saga"],
      },
      {
        text: "The read path is built never to reach the origin. The product page is split where volatility changes. A near-static shell of title, media and description is cached at the CDN for five minutes. A small price, stock band and promo fragment is served from edge KV for fifteen seconds.",
        lights: ["cdn", "catalog", "e1", "e2"],
      },
      {
        text: "Nothing on that read path is authoritative, and that is the rule rather than a compromise. Checkout re-prices and re-reserves against the source of truth, so a stale cache costs a re-quote and never a wrong charge. Never make cache invalidation load-bearing for money.",
        lights: ["pricing", "saga", "e5", "e18"],
      },
      {
        text: "The cart is durable and server-side, keyed by a cart_id cookie so guests get one too, but a cart line is deliberately not a reservation. It carries a price snapshot for display and nothing more, which keeps roughly 100 add-to-carts a second away from the inventory counters entirely.",
        lights: ["cart", "e3", "e4"],
      },
      {
        text: "Reserving happens at checkout entry, the moment the shopper commits to paying. At 2.5% session conversion, reserving at add-to-cart makes 97.5% of holds expire unused. Effective sellable stock then deflates by the abandonment rate, and the site reports sold out with full warehouses.",
        lights: ["saga", "cart", "e4"],
      },
      {
        text: "Inventory is 600M rows and about 40GB, so it fits in memory and is never a capacity problem, only a contention one. A heat classifier that lives on the holds store measures each SKU's reserve rate over a rolling 10 seconds and routes it into one of three lanes. That classifier is the design.",
        lights: ["holds", "lanes-group", "cold", "warm", "hot", "e7", "e8", "e9"],
      },
    ],
    crux: {
      problem:
        "The last unit of a doorbuster is a single row absorbing about 8,000 reserve attempts a second. Optimistic retry livelocks, because retries stack on top of fresh arrivals and goodput falls as load rises.",
      handled:
        "A row lock is correct but sustains roughly 330 decrements a second, so its wait queue grows by about 7,670 every second. It pins connections and starves SKUs nobody is fighting over. The escape is to stop applying one concurrency mechanism to all 200M SKUs, and route each SKU into cold, warm or hot by its own measured contention.",
    },
    numbers: [
      {
        value: "~1,600 page views per order",
        explain: "The look-to-buy ratio the whole architecture is split around: almost all traffic is browsing, which is why it is built as pure caching sharing no machinery with checkout.",
      },
      {
        value: "~8k reserve attempts/s on one SKU row",
        explain: "The peak load a single doorbuster SKU can face at T+0, the figure that rules out a plain row lock or optimistic retry as the reserve mechanism.",
      },
      {
        value: "600M inventory rows, ~40GB in memory",
        explain: "The full size of the counter store across all 200M SKUs, small enough to keep entirely in memory, so contention rather than capacity is the only real problem.",
      },
    ],
  },
  nodes: [
    {
      id: "lanes-group",
      label: "Inventory lanes, chosen by heat",
      kind: "zone",
      detail: {
        what: "The three reserve implementations a SKU can be routed into, all of which produce the same artefact: a hold record with a TTL.",
        why: "Contention has to be made structural rather than accidental. One mechanism is wrong for either the long tail or the doorbuster. The lane is a field on the counter record, so every caller reads the lane and the count in one lookup.",
        numbers: [
          { value: "cold under 50 reserves/s", explain: "The default lane every SKU starts in, covering the overwhelming majority of the catalogue." },
          { value: "warm 50 to 1,000/s", explain: "The band where a SKU is busy but not yet stampeded." },
          { value: "hot above 1,000/s", explain: "The threshold above which a single row's contention forces the serialised log-based lane." },
        ],
        breaks: {
          failure: "A lane change mid-flight is the one transition that can lose count.",
          handled: "That is exactly why demotion waits about 5 minutes while promotion takes a single window, keeping transitions rare and deliberate rather than jittery.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN + edge KV",
      sub: "shell 5m TTL, live fragment 15s",
      kind: "database",
      col: 0,
      row: 0,
      detail: {
        what: "The whole read path: a pre-rendered product shell keyed by (sku, locale, currency) at the POP, plus a volatile price and stock fragment in an edge key-value store.",
        why: "At 1,600 page views per order the CDN is the main lever, and the split is what makes the page cacheable at all. Cache one document and a single price change invalidates title, media and description along with it.",
        numbers: [
          { value: "~15ms on a shell hit", explain: "Less than the ~25ms live-fragment fetch alone; at 1,600 page views per order this hop decides if the sale page survives traffic." },
          { value: "~25ms for /p/{sku}/live", explain: "The added cost of fetching the volatile price and stock fragment separately." },
          { value: "~90k PDP/s in the peak sale minute, 95% edge-served", explain: "The peak load this split is provisioned to absorb, almost entirely without reaching origin." },
        ],
        breaks: {
          failure: "A drop page not yet in cache turns T=0 into ~90k simultaneous origin misses.",
          handled: "That is why drop pages are pre-pushed to every POP an hour ahead, and any remaining misses are coalesced at the edge rather than each hitting origin independently.",
        },
        choice: {
          pick: "Split the page at the volatility boundary: shell cached 5 minutes, live fragment 15 seconds",
          instead: "Cache the whole rendered product page as one object with a short TTL.",
          decider:
            "How often the page must be invalidated against how much of it changes. A ~4KB page whose price moves would be evicted whole, so the effective TTL of the static 3KB collapses to the TTL of the 100B that actually moves.",
          flips: "Catalogues where price genuinely never moves within the shell TTL, for example fixed-price digital goods, where one object is simpler.",
        },
      },
    },
    {
      id: "catalog",
      kind: "database",
      sub: "doc store, OpenSearch via CDC",
      label: "Catalogue + search",
      col: 2,
      row: 0,
      detail: {
        what: "One ~4KB document per sku_id in a partitioned document store, with a denormalised ~1.5KB search doc per SKU in OpenSearch fed by change data capture.",
        why: "It only ever sees CDN misses, so it is sized for correctness and freshness rather than for throughput. CDC rather than a nightly batch is what keeps the index trailing the catalogue by seconds.",
        numbers: [
          { value: "200M SKUs, ~800GB, ~2.4TB at RF=3", explain: "The scale of the document store this catalogue lives in." },
          { value: "~900GB search index with replicas", explain: "200M SKUs x ~1.5KB is ~300GB raw; at RF=3 that's ~900GB, smaller than the 2.4TB doc store despite serving live queries." },
          { value: "~8ms document read, ~120ms search", explain: "The latency gap between a direct lookup and a full search query." },
        ],
        breaks: {
          failure: "CDC lag on a price edit makes a price-sorted results page visibly wrong.",
          handled: "Price is indexed as a coarse band for filtering instead, and the exact number is hydrated from the edge KV, so lag never produces a visibly wrong sort order.",
        },
        choice: {
          pick: "Partitioned document store keyed by sku_id, OpenSearch index fed by CDC",
          instead: "A wide relational products table, with the search index rebuilt on a schedule.",
          decider:
            "Attribute heterogeneity across 200M SKUs. A mattress and a USB cable share almost no fields, so a wide table is mostly nulls, and the attribute JSON per document has no fixed shape to normalise into.",
          flips: "A narrow catalogue with a stable schema, roughly a single category with fixed attributes, where a relational table gives you real queries for free.",
        },
      },
    },
    {
      id: "gateway",
      sub: "signed admission tokens",
      kind: "service",
      label: "Gateway + waiting room",
      col: 1,
      row: 0,
      detail: {
        what: "The single shared edge for both columns, carrying the waiting room that issues signed admission tokens during a drop and the graded load-shedding ladder.",
        why: "Admission control is only useful before work has been admitted, so it sits here rather than in front of inventory. It is also the only thing the read and write paths share.",
        numbers: [
          { value: "admits ~2k/s of ~8k/s arrivals at T+0", explain: "The shaping this tier applies at the exact moment demand spikes hardest." },
          { value: "browse protected at 100x checkout load", explain: "The headroom browse retains even while checkout is under extreme pressure." },
        ],
        breaks: {
          failure: "Shedding by raw request rate throws away shoppers who already hold stock and a payment authorisation, wasting all three.",
          handled: "The ladder must shed personalisation, then reviews, then reranking, then new checkout entries, and never browse or an in-flight checkout.",
        },
        choice: {
          pick: "Waiting room with signed admission tokens at the gateway",
          instead: "Let everything through and rate limit at the inventory service.",
          decider:
            "Where the work has already been paid for. Rejecting at the inventory service means ~8k/s of requests have already consumed a TLS handshake, a cart read and a saga slot before being told no.",
          flips: "Unannounced spikes, where there is no sale object to attach a waiting room to and a burst detector plus lane promotion is the only reactive lever you have.",
        },
      },
    },
    {
      id: "cart",
      label: "Cart service",
      sub: "KV keyed by cart_id, ~1KB",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "A durable server-side cart in a KV store. Guests get a cart_id cookie and the cart itself lives on the server, with a defined merge rule on login.",
        why: "A cart line is explicitly not a reservation, only a price snapshot for display. That is what keeps ~100 add-to-carts a second off the inventory counters entirely and lets the reserve happen once, at checkout entry.",
        numbers: [
          { value: "~1KB per cart, ~20M carts, ~20GB steady", explain: "The steady-state footprint of every live and recently-abandoned cart." },
          { value: "~100 add-to-cart/s", explain: "The write rate this service absorbs, entirely separate from the reserve path." },
          { value: "~100GB over a sale weekend", explain: "The peak footprint this store can grow to under heavy seasonal traffic." },
        ],
        breaks: {
          failure: "Guest-to-account merge is where the complaints come from.",
          handled: "Union by SKU takes max(qty), not sum, because someone who added two on a phone and two on a laptop meant to buy two, not four.",
        },
        choice: {
          pick: "Durable server-side cart in a KV store, keyed by cart_id",
          instead: "A client-side cart in a cookie or local storage, sent up at checkout.",
          decider:
            "Cross-device continuity against a trivial storage bill. 20M live and abandoned carts at ~1KB is ~20GB, nothing, and in exchange the cart survives a device switch, a browser wipe and a sign-in.",
          flips: "A pure guest storefront with no accounts and no cross-device story, where a signed client-side cart removes an entire service from the funnel.",
        },
      },
    },
    {
      id: "saga",
      label: "Checkout saga",
      kind: "service",
      sub: "durable workflow, compensating",
      col: 1,
      row: 2,
      detail: {
        what: "The orchestrator for one checkout: read cart, take holds, re-price, write the order and its idempotency key in one transaction, call payment, confirm the holds, emit the fulfilment event.",
        why: "The steps span services that cannot share a transaction, so each commits independently and each has a compensating undo. Orchestrated rather than choreographed so there is exactly one place to answer where order 12345 is stuck.",
        numbers: [
          { value: "~900ms end to end, ~700ms of it the provider", explain: "The full checkout latency budget, dominated by the external payment call." },
          { value: "~8 orders/s peak, ~800/s in a flash sale", explain: "The throughput range this orchestrator scales across between normal traffic and a doorbuster." },
          { value: "checkout p99 target < 1.5s", explain: "The published latency SLO this whole flow is held to." },
        ],
        breaks: {
          failure: "It is a shared dependency for every order, so its outage stops all purchasing while browse carries on.",
          handled: "A crash between payment success and hold confirmation leaves orders stuck in PENDING until the reconciler queries the provider by idempotency key, resolving it without losing the charge.",
        },
        choice: {
          pick: "Orchestrated durable workflow, sharded by hash(order_id)",
          instead: "Choreographed services reacting to an order event stream.",
          decider:
            "Debuggability under a saga with 5 steps and 5 compensations. Choreography has no single place holding the state, so answering where an order is stuck means reconstructing it from event logs.",
          flips: "Two-step flows with no compensation logic, where an orchestrator is a service you run for nothing and events are genuinely simpler.",
        },
      },
    },
    {
      id: "pricing",
      label: "Pricing + promotions",
      kind: "service",
      sub: "rules engine, authoritative",
      col: 0,
      row: 1,
      detail: {
        what: "A rules evaluator over (sku, market, customer segment, cart contents) that produces the quoted_total the shopper is asked to accept.",
        why: "The product page physically cannot hold the authoritative number, because a buy-three-get-one promotion depends on the rest of the cart and tax depends on an address. The page shows a cached opinion and this is the fact.",
        numbers: [
          { value: "quoted_total + 1 changes[] array of deltas", explain: "The two things this evaluator returns: the final number and an explanation of every difference from what was shown." },
          { value: "accepted_total echoed 1x on POST /orders", explain: "The single confirmation round trip that closes the loop with the shopper." },
          { value: "absorb increases under 2% or GBP 1", explain: "The threshold below which a small price movement is quietly honoured rather than surfaced as a re-quote." },
        ],
        breaks: {
          failure: "A re-quote is structural rather than a bug, and no amount of presentation makes being shown GBP 40 and asked for GBP 43 pleasant.",
          handled: "A spike in price_changed responses means edge KV TTLs and promo propagation are out of step, which is watched directly as a signal rather than dismissed as noise.",
        },
        choice: {
          pick: "Evaluate authoritatively at checkout and echo accepted_total back",
          instead: "A genuine price lock held for the duration of a browsing session.",
          decider:
            "Write amplification against the read rate. A real lock means one promotions-engine write per browsing session at ~2.8k page views a second, and it reopens the arbitrage of stacking locks before a promotion expires.",
          flips: "Low-traffic, high-value carts, for example B2B quoting, where a session is rare and expensive and a firm quote is the product.",
        },
      },
    },
    {
      id: "cold",
      label: "Cold lane",
      sub: "one conditional UPDATE, ~3ms",
      kind: "service",
      col: 2,
      row: 2,
      parent: "lanes-group",
      detail: {
        what: "A single statement: UPDATE inventory SET available = available - :q WHERE sku = :s AND available >= :q. The caller reads the affected row count rather than the data.",
        why: "Effectively the entire 200M-SKU catalogue lives here. There is no read followed by a write, no version column and no retry loop, so there is nothing that can livelock.",
        numbers: [
          { value: "under 50 reserves/s per SKU", explain: "The traffic ceiling this simple mechanism is designed to comfortably serve." },
          { value: "~3ms", explain: "The same critical section that caps a single hot row at ~330 decrements/s; fine under 50/s per SKU, why hot SKUs need a different lane." },
          { value: "affects one row or zero", explain: "The only two outcomes this statement can produce, with no ambiguous state in between." },
        ],
        breaks: {
          failure: "A decrement without its hold is stock that leaks until a reconciler notices, and a hold without its decrement is an oversell.",
          handled: "The pair is one transaction rather than two calls for exactly this reason, so the two facts can never disagree.",
        },
        choice: {
          pick: "Conditional single-statement decrement",
          instead: "Optimistic concurrency on a version column, or SELECT ... FOR UPDATE.",
          decider:
            "Behaviour when contention does arrive. Optimistic control succeeds for one writer per round and forces the other ~7,999 to retry on top of fresh arrivals, so goodput falls as load rises.",
          flips: "When the update needs to read the row first, for example tiered pricing computed from current stock, where you genuinely cannot express the decision as one predicate.",
        },
      },
    },
    {
      id: "warm",
      label: "Warm lane",
      sub: "N = 32 buckets, hash(cart_id)",
      kind: "service",
      col: 2,
      row: 3,
      parent: "lanes-group",
      detail: {
        what: "Stock split across 32 bucket rows, with each caller picking hash(cart_id) % N, probing the next bucket on an empty one and stealing from the fullest on a second failure.",
        why: "It converts one row heading for lock contention into 32 rows that behave like cold ones, with no new infrastructure and no change to the request shape. Hashing the cart rather than the request means a retry lands in the same bucket.",
        numbers: [
          { value: "50/s to 1,000/s per SKU", explain: "The band this lane is specifically tuned for." },
          { value: "per-row write rate falls 32x", explain: "The reduction bucketing achieves per individual row." },
          { value: "merge threshold at total_remaining < 2N = 64", explain: "The point at which this lane collapses back into the hot lane to avoid an undersell." },
        ],
        breaks: {
          failure: "The endgame. With 5 units left across 32 buckets, 27 are empty.",
          handled: "Most buyers are told sold out while stock exists, an undersell, which is why the merge threshold exists to catch it before it happens.",
        },
        choice: {
          pick: "32 bucket rows with a forced merge and promotion below 2N",
          instead: "Leave the SKU on one row until it crosses the hot threshold.",
          decider:
            "The gap between 50/s and 1,000/s, which is where most busy SKUs actually live. One row at 1,000/s is already past the ~330 decrements/s a lock sustains.",
          flips: "Very low stock counts, where the SKU is in the bucket endgame from the moment it opens and should start in the queue lane instead.",
        },
      },
    },
    {
      id: "hot",
      label: "Hot lane",
      sub: "per-SKU log, one consumer",
      kind: "queue",
      col: 2,
      row: 4,
      parent: "lanes-group",
      detail: {
        what: "Reserve attempts appended to a per-SKU stream partition and applied in arrival order by exactly one consumer against an in-memory counter, answered asynchronously over SSE.",
        why: "This is serialisation without waiting. Nobody holds a lock, and once the counter reaches zero the consumer short-circuits and rejects the entire remaining backlog at memory speed.",
        numbers: [
          { value: "~0.3ms append, ~50k decrements/s consumed", explain: "The throughput this single consumer is capable of, far beyond what a lock could sustain." },
          { value: "consumer is 25x faster than the ~2k/s admitted", explain: "The margin this design keeps against the gateway's own admission rate." },
          { value: "clears ~100k queued messages in well under a second", explain: "How quickly a fully sold-out backlog is drained once stock runs out." },
        ],
        breaks: {
          failure: "A single-consumer failure domain. A standby replays from the last persisted offset, so grants already emitted are emitted twice.",
          handled: "That is harmless only because the hold store is keyed on hold_id, and a re-emitted grant overwrites rather than duplicating.",
        },
        choice: {
          pick: "Per-SKU log with one consumer and a 50ms counter-plus-offset persist",
          instead: "A distributed lock or a pessimistic row lock on the hot SKU.",
          decider:
            "What happens after the stock runs out. A lock queue of 100k waiters must be walked at ~3ms each, roughly 5 minutes of pointless serialisation to tell everyone no.",
          flips: "Small catalogues where a partition per SKU is affordable, at which point every SKU can live here and the classifier disappears.",
        },
      },
    },
    {
      id: "holds",
      sub: "in-memory, TTL, heat classifier",
      kind: "database",
      label: "Counters + holds",
      col: 3,
      row: 3,
      detail: {
        what: "The counters themselves plus every hold record: hold_id, sku, qty, cart_id, expires_at and state, with a 15-minute TTL at checkout entry and 10 minutes on a drop. A per-SKU heat classifier runs on these same nodes.",
        why: "Whichever lane granted it, a reserve produces exactly one artefact, so nothing about the lane leaks past this point. A hold is a reservation, not a sale; only confirm makes it final. The classifier lives here rather than as a separate service because a network hop on the hot path would add latency.",
        numbers: [
          { value: "600M rows, ~40GB, fits in memory", explain: "The full size of the counter store, comfortably resident on this tier's memory." },
          { value: "7.2M live holds at sale peak, ~600MB", explain: "The peak in-flight state this store carries during a flash sale." },
          { value: "counter persisted every 50ms with its offset", explain: "How durability is achieved for the in-memory hot-lane counter." },
          { value: "10s rolling window, promote in 1 window, demote after ~5 min", explain: "The timing of the classifier's own lane decisions." },
        ],
        breaks: {
          failure: "Millions of holds expire in the same minute after a sale, and a sweeper that falls behind makes real stock invisible for minutes.",
          handled: "Expiry runs on native TTL with keyspace events, with the sweeper as a reconciling backstop only, rather than the primary release path.",
        },
        choice: {
          pick: "In-memory store with native TTL and keyspace-expiry events",
          instead: "A holds table with an expires_at column and a polling sweeper.",
          decider:
            "Expiry burst shape. After a sale, 7.2M holds reach their deadline within one window, and a polling scan over that many rows falls behind by minutes.",
          flips: "When the hold itself must be transactionally consistent with an order row in the same relational database.",
        },
      },
    },
    {
      id: "orders",
      label: "Order store",
      sub: "sharded by hash(order_id)",
      kind: "database",
      col: 0,
      row: 3,
      detail: {
        what: "The order rows themselves, with the Idempotency-Key written under a unique index in the same transaction as the order.",
        why: "Same-transaction dedupe is the whole point: a double-tapped Buy makes the second insert violate the constraint, so the original order is returned rather than a second charge being attempted.",
        numbers: [
          { value: "~1.5KB per order, ~150k orders/day", explain: "The typical order size and daily volume this store is sized against." },
          { value: "~80GB/yr, ~250GB at RF=3", explain: "The annual storage growth this order volume produces." },
          { value: "hot for 18 months, then columnar archive for 7 years", explain: "The retention tiering applied once orders age past active service." },
        ],
        breaks: {
          failure: "The payment step is never acked to the client until the order row is durable.",
          handled: "A shard primary failing after capture turns a lost ack into an idempotent retry rather than a charge with no order behind it.",
        },
        choice: {
          pick: "Relational shards with idempotency under a unique index in the order transaction",
          instead: "A separate idempotency service or cache in front of the order write.",
          decider:
            "Whether dedupe and commit can be torn apart. A separate service means two writes that can disagree, and the window between them is exactly where a retried request double-charges.",
          flips: "When the idempotency check must span several services rather than one order write, at which point it needs its own store and reconciliation.",
        },
      },
    },
    {
      id: "payment",
      label: "Payment service",
      kind: "external",
      sub: "auth, capture, ledger",
      col: 0,
      row: 4,
      detail: {
        what: "The downstream that authorises and captures the charge. The ambiguous-timeout problem and the double-entry ledger are that system's own concern, not checkout's.",
        why: "It is drawn because it sets the constraints checkout answers to. It contributes about 700ms of a ~900ms checkout, it is the step that cannot be rolled back cheaply, and it is the only participant with its own rate limits.",
        numbers: [
          { value: "~700ms of the ~900ms checkout", explain: "How much of the total checkout latency this single external call accounts for." },
          { value: "800 orders/s in a flash sale can exceed a per-merchant limit", explain: "The scale at which this provider's own rate limits become the binding constraint." },
        ],
        breaks: {
          failure: "A provider throttling at 800 orders/s becomes a wall of 429s.",
          handled: "The step is bulkheaded with its own concurrency budget and bounded queue, and spread across two providers with health-based routing to absorb exactly this failure.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "cdn",
      to: "gateway",
      tier: "data",
      label: "origin miss, ~5%",
      detail: {
        what: "The small fraction of product page and fragment requests that the POP cannot answer, travelling on to the origin.",
        why: "This edge is thin on purpose. Everything upstream exists to keep it under 5% of ~90k/s, because the origin is sized for misses rather than for traffic.",
        numbers: [
          { value: "cache hit ratio SLO >= 95% for shells", explain: "The published target this whole read-path design is held to for the near-static part of the page." },
          { value: "80% for the live fragment", explain: "The lower, still substantial, hit target for the much more volatile fragment." },
        ],
        breaks: {
          failure: "A cold cache at drop time makes this edge carry the full ~90k/s.",
          handled: "That is exactly why concurrent misses for one key are coalesced into a single origin fetch, rather than each request hitting origin independently.",
        },
      },
    },
    {
      id: "e2",
      from: "gateway",
      to: "catalog",
      tier: "data",
      label: "PDP + search render",
      detail: {
        what: "A miss being served: the document read by sku_id and rendered, or a search query fanned into the index.",
        why: "The origin is the only place that holds the truth about what a product is, and it is deliberately reached rarely. Search is a separate path from the PDP because BM25 plus reranking has nothing in common with a key lookup.",
        numbers: [
          { value: "~8ms document read", explain: "15x cheaper than the search path beside it, and both sit well inside the ~400ms p99 budget this hop is held to." },
          { value: "~120ms search including rerank", explain: "15x the document-read cost, but still leaves ~280ms of the ~400ms p99 budget for network and CDN retries above it." },
          { value: "~400ms p99 origin-miss budget", explain: "The overall latency ceiling this hop is held to even under load." },
        ],
        breaks: {
          failure: "A catalogue partition being unavailable means misses cannot be rendered at all.",
          handled: "The CDN serves stale-if-error for up to 24 hours and degrades to a title-and-price page from the edge KV, rather than showing an outright error.",
        },
      },
    },
    {
      id: "e3",
      from: "gateway",
      to: "cart",
      tier: "hot",
      step: 1,
      label: "POST /cart/items",
      detail: {
        what: "An add-to-cart write reaching the cart service, carrying a cart_id cookie for a guest or a resolved user_id for a signed-in shopper.",
        why: "The gateway is the only thing the read and write columns share, and this is where they diverge. From here onwards nothing touches the caching path and nothing on the caching path can be slowed by it.",
        numbers: [
          { value: "~100 add-to-cart/s", explain: "The steady rate this hop carries." },
          { value: "~1.5 per session", explain: "The typical number of add-to-cart events one shopping session generates." },
        ],
        breaks: {
          failure: "This write must never reach inventory.",
          handled: "Reserving here at 2.5% conversion would deflate sellable stock by the abandonment rate and report sold out with full warehouses, which is why the reserve is deferred to checkout entry.",
        },
      },
    },
    {
      id: "e4",
      from: "cart",
      to: "saga",
      tier: "hot",
      step: 2,
      label: "POST /checkout/session",
      detail: {
        what: "The cart read that opens a checkout, roughly 1KB of lines handed to the orchestrator.",
        why: "This is the commitment boundary. Everything before it is display state that can be lost cheaply, and everything after it has to be correct. That is exactly why the reserve lives on this side of the line.",
        numbers: [
          { value: "~1KB cart", explain: "The typical payload size handed to the orchestrator at this hop." },
          { value: "15% to 20% of holds wasted from here", explain: "The realistic abandonment rate even after reserving only at this later, more committed point." },
        ],
        breaks: {
          failure: "A cart mixing a hot line and cold lines has no atomicity across them.",
          handled: "Cold lines are reserved and held hostage while the hot ticket is outstanding, an accepted limitation of mixed-lane carts.",
        },
      },
    },
    {
      id: "e5",
      from: "saga",
      to: "pricing",
      tier: "hot",
      step: 3,
      label: "authoritative re-quote",
      detail: {
        what: "Every line and every promotion re-evaluated against current rules, returning quoted_total and a changes[] array explaining each delta.",
        why: "The number the shopper saw on the product page came from a 15-second cache and is a cached opinion. This call makes the cache non-load-bearing for money.",
        numbers: [
          { value: "price_changed rate SLO < 0.5%", explain: "The target rate for how often a re-quote actually surfaces a changed price to the shopper." },
          { value: "absorb increases under 2% or GBP 1", explain: "The threshold below which a small movement is quietly honoured instead of surfaced." },
        ],
        breaks: {
          failure: "The delta is explained, not eliminated.",
          handled: "A shopper shown GBP 40 and asked for GBP 43 is a real experience the design does not fix, only makes honest and explained rather than silent.",
        },
      },
    },
    {
      id: "e7",
      to: "cold",
      tier: "hot",
      step: 4,
      from: "saga",
      label: "cold: under 50/s",
      detail: {
        what: "Routing effectively the entire catalogue to a single conditional decrement.",
        why: "99.99% of reserves have no contention to resolve, and paying a queue's asynchronous experience for them would be a self-inflicted regression. The cheap path has to stay cheap.",
        numbers: [
          { value: "~3ms synchronous", explain: "~80x faster than the warm lane's ~250ms p99, why the cheap path stays synchronous for the 99.99% of reserves with no contention." },
          { value: "the default for 200M SKUs", explain: "The scope of the catalogue this lane serves by default." },
        ],
        breaks: {
          failure: "If the classifier is late, this lane absorbs a spike it was never sized for.",
          handled: "It rejects rather than oversells, so the loss is sales, not correctness, which is the acceptable failure mode of a reactive classifier.",
        },
      },
    },
    {
      id: "e8",
      to: "warm",
      tier: "hot",
      step: 5,
      from: "saga",
      label: "warm: 50 to 1,000/s",
      detail: {
        what: "Routing a busy but not stampeded SKU to 32 bucket rows selected by hash(cart_id) % N.",
        why: "This band is where most genuinely popular SKUs sit, and neither neighbouring answer fits. One row is already past what a lock sustains, and the queue's ~250ms p99 is too heavy for a SKU that is merely busy.",
        numbers: [
          { value: "per-row write rate cut 32x", explain: "The reduction bucketing achieves for a SKU routed through this lane." },
          { value: "N = 32", explain: "The bucket count this design uses." },
        ],
        breaks: {
          failure: "Skewed hashing empties some buckets while stock remains elsewhere.",
          handled: "This is monitored directly as a sold-out-with-stock counter whose SLO is zero, catching the skew before it becomes a pattern.",
        },
      },
    },
    {
      id: "e9",
      to: "hot",
      tier: "hot",
      step: 6,
      from: "saga",
      label: "hot: 8k/s on one SKU",
      detail: {
        what: "Routing a doorbuster into its own stream partition, either reactively above 1,000 reserves/s or pre-classified hours before a scheduled drop.",
        why: "Scheduled sales bypass the reactive path entirely, which keeps the classifier's lag off the case that matters most. The lane exists so a hot SKU cannot borrow capacity from cold ones.",
        numbers: [
          { value: "above 1,000 reserves/s", explain: "The reactive threshold that promotes a SKU into this lane." },
          { value: "~8k/s at T+0 on a doorbuster", explain: "The peak arrival rate this lane is specifically built to absorb." },
          { value: "~90% rejected while stock lasts", explain: "The realistic rejection rate during the initial rush on a genuinely scarce item." },
        ],
        breaks: {
          failure: "It makes the reserve asynchronous, returning a ticket rather than an answer.",
          handled: "That is the property a cart mixing lanes cannot reconcile, which is exactly why mixed-lane carts hold cold lines hostage rather than trying to unify the response shape.",
        },
      },
    },
    {
      id: "e10",
      from: "cold",
      to: "holds",
      tier: "data",
      label: "conditional update, 3ms",
      detail: {
        what: "The decrement and its hold row written together, returning a hold_id with a 15-minute TTL.",
        why: "Writing both in one transaction is what makes the reserve safe to retry. Split them and a crash between the two either leaks stock or oversells.",
        numbers: [
          { value: "~3ms", explain: "The same cost the decrement alone would take standalone; writing the hold atomically closes the crash window instead of adding latency." },
          { value: "15-minute TTL at checkout entry", explain: "The default lifetime this hold is granted." },
        ],
        breaks: {
          failure: "Nothing here bounds how many holds a single abusive client can take.",
          handled: "The rate limit has to live at the gateway rather than at the counter, since the counter itself has no notion of client identity.",
        },
      },
    },
    {
      id: "e11",
      from: "warm",
      to: "holds",
      tier: "data",
      label: "bucket grant to a hold",
      detail: {
        what: "A successful bucket decrement, after any next-bucket probe or steal-from-fullest, materialised as the same hold record the other lanes produce.",
        why: "The hold is the lane-independent artefact. Once it exists, the checkout saga has no idea which mechanism granted it, which is precisely what lets one saga serve all three lanes.",
        numbers: [
          { value: "up to two fallbacks before rejecting", explain: "The retry budget this lane allows before giving up on a bucket grant." },
          { value: "steal takes a short lock on one row", explain: "The one place this otherwise lock-free lane does briefly take a lock." },
        ],
        breaks: {
          failure: "The steal path locks the fullest bucket, so under extreme skew the lane degrades toward exactly the single-row contention it was built to avoid.",
          handled: "That degradation is bounded to the steal path alone, and the merge threshold catches the endgame before it becomes the dominant behaviour.",
        },
      },
    },
    {
      id: "e12",
      from: "warm",
      to: "hot",
      tier: "control",
      label: "merge when under 2N left",
      detail: {
        what: "A coordinator taking a brief exclusive window across all 32 rows, summing them into one, and promoting the SKU to the queue lane.",
        why: "The bucket endgame produces undersells, and an undersell costs about 1.7x an oversell. Collapsing the buckets before the tail of the stock is stranded is the whole reason the threshold exists.",
        numbers: [
          { value: "threshold at total_remaining < 2N = 64", explain: "The exact point at which this merge is triggered." },
          { value: "a genuine stall, typically 20-50ms", explain: "How long the brief exclusive window this merge requires actually lasts." },
        ],
        breaks: {
          failure: "Take it under a distributed lock with a hard timeout, and fail closed into the queue lane on the last consistent total.",
          handled: "Half-merged buckets are how you actually lose count, which is why this merge always resolves to a definite success or a safe fallback, never a partial state.",
        },
      },
    },
    {
      id: "e13",
      from: "hot",
      to: "holds",
      tier: "data",
      label: "granted, answered by SSE",
      detail: {
        what: "The single consumer decrementing the in-memory counter and emitting a grant carrying a hold_id, delivered to the waiting client over SSE.",
        why: "The hold_id is what makes replay safe. After a consumer failover, decrements applied in memory but not persisted are re-applied and grants re-emitted.",
        numbers: [
          { value: "p99 near 250ms, dominated by queue depth", explain: "The realistic latency this lane delivers under load, mostly waiting rather than processing time." },
          { value: "counter persisted every 50ms with its offset", explain: "How often this consumer checkpoints its state to survive a failover." },
        ],
        breaks: {
          failure: "Without hold_id keying, one request produces two hold records that are later released or confirmed independently.",
          handled: "The count drifts whichever way the timing favours, which is exactly why every grant is keyed on hold_id so a replay overwrites instead of duplicating.",
        },
      },
    },
    {
      id: "e14",
      from: "saga",
      to: "orders",
      tier: "hot",
      step: 7,
      label: "order + Idempotency-Key",
      detail: {
        what: "The PENDING order row and its idempotency key inserted in a single transaction under a unique index.",
        why: "This ordering is deliberate. The order must be durable before payment is acknowledged to the client, so a lost ack becomes an idempotent retry rather than a captured charge with no order behind it.",
        numbers: [
          { value: "~1.5KB per order", explain: "The typical size of this write." },
          { value: "duplicate returns 409 with Retry-After", explain: "The exact behaviour a repeated submission receives thanks to the unique index." },
        ],
        breaks: {
          failure: "The key must be minted once per checkout session and stored with the cart.",
          handled: "A fresh UUID per submit makes the whole scheme decorative, so key generation is tied to the session, never to the individual request.",
        },
      },
    },
    {
      id: "e15",
      from: "saga",
      to: "payment",
      tier: "hot",
      step: 8,
      label: "capture the charge",
      detail: {
        what: "The charge step, called with the hold already taken and the order row already durable.",
        why: "It is the last irreversible step for a reason. Every cheap thing that can fail has been tried first, so a failure here compensates by releasing holds rather than by refunding money.",
        numbers: [
          { value: "~700ms of the ~900ms checkout", explain: "How much of the total checkout latency this call accounts for." },
          { value: "bulkhead capped at 800 concurrent calls", explain: "The concurrency limit this call is bounded by to protect the rest of the system." },
        ],
        breaks: {
          failure: "The hold TTL is refreshed to now plus the payment timeout plus margin before this call.",
          handled: "Without that refresh, a hold can expire under a live authorisation and land the order in PAID_UNRESERVED, a state this refresh exists specifically to prevent.",
        },
      },
    },
    {
      id: "e16",
      from: "saga",
      to: "holds",
      tier: "control",
      label: "confirm(hold_id)",
      offset: 60,
      detail: {
        what: "Turning holds into allocations after payment succeeds. This is the only step that makes a sale final.",
        why: "Separating reserve from confirm is what lets the saga compensate. Everything before this can be undone by releasing a hold, and only here does stock stop being returnable by a timeout.",
        numbers: [{ value: "reserve-to-confirm SLO >= 98%", explain: "The published target for how reliably a reservation actually converts into a confirmed sale." }],
        breaks: {
          failure: "A crash between payment success and this call leaves the order PENDING past 60s.",
          handled: "The reconciler must query the provider by idempotency key before deciding to confirm or compensate, resolving the ambiguity without guessing.",
        },
      },
    },
    {
      id: "e17",
      from: "holds",
      to: "hot",
      tier: "control",
      label: "TTL expiry returns stock",
      detail: {
        what: "An expired or released hold adding its quantity back, which on a hot SKU means incrementing the consumer's in-memory counter.",
        why: "An abandoned unit has to go back in front of the queue rather than being lost. During a drop the backlog is still draining, so a returned unit is sellable within milliseconds.",
        numbers: [
          { value: "15-minute TTL, 10 on a drop", explain: "The two lifetimes this design uses depending on whether a drop is in progress." },
          { value: "millions expire in the same minute after a sale", explain: "The scale of the return burst this mechanism has to handle right after a sale ends." },
        ],
        breaks: {
          failure: "Native TTL gives weaker ordering than a scan.",
          handled: "The reconciler behind it must be idempotent against holds that were already released explicitly, so a re-processed expiry never double-returns stock.",
        },
      },
    },
    {
      id: "e18",
      from: "pricing",
      to: "cdn",
      tier: "control",
      label: "price fragment, 15s TTL",
      detail: {
        what: "A display-only projection of the rules store pushed into edge KV: price, stock band and promo badge, keyed by (sku_id, market).",
        why: "It is a control path because it carries an opinion rather than a fact. The projection exists so a product page can show a number without a round trip to a rules engine that is busy being authoritative for checkout.",
        numbers: [{ value: "15-second TTL", explain: "How fresh this projection is kept, balancing update cost against display accuracy." }],
        breaks: {
          failure: "Publishing an exact remaining count here rather than a band turns the fragment into a scraping oracle for a drop.",
          handled: "Every stale read looks like a lie in that case, which is why only a coarse stock band, never the exact count, is exposed on this path.",
        },
      },
    },
  ],
};
