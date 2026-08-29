import type { Diagram } from "./types";

export const ECOMMERCE: Diagram = {
  id: "ecommerce",
  title: "E-Commerce Platform",
  question: "Design an E-Commerce Platform (Catalog, Cart & Flash Sales)",
  sourceId: "patterns",
  itemId: 48,
  overview: {
    shape:
      "Two systems sharing one gateway: an enormous read path that is pure caching and never authoritative, and a small write path whose entire difficulty is one inventory counter under thousands of simultaneous writers.",
    beats: [
      "Two systems in one product, and the usual failure is designing them as one. At roughly 1,600 page views per order, browsing is a caching problem and buying is a contention problem, so they are wired to share only the gateway and nothing else.",
      "The read path is built never to reach the origin. The product page is split where volatility changes: a near-static shell of title, media and description cached at the CDN for five minutes, and a small price, stock band and promo fragment served from edge KV for fifteen seconds.",
      "Nothing on that read path is authoritative, and that is the rule rather than a compromise. Checkout re-prices and re-reserves against the source of truth, so a stale cache costs a re-quote and never a wrong charge. Never make cache invalidation load-bearing for money.",
      "The cart is durable and server-side, keyed by a cart_id cookie so guests get one too, but a cart line is deliberately not a reservation. It carries a price snapshot for display and nothing more, which keeps roughly 100 add-to-carts a second away from the inventory counters entirely.",
      "Reserving happens at checkout entry, the moment the shopper commits to paying. At 2.5% session conversion, reserving at add-to-cart makes 97.5% of holds expire unused, so effective sellable stock deflates by the abandonment rate and the site reports sold out with full warehouses.",
      "Inventory is 600M rows and about 40GB, so it fits in memory and is never a capacity problem, only a contention one. A classifier measures each SKU's reserve rate over a rolling 10 seconds and routes it into one of three lanes, and that classifier is the design.",
    ],
    crux:
      "The last unit of a doorbuster is a single row absorbing about 8,000 reserve attempts a second. Optimistic retry livelocks, because retries stack on top of fresh arrivals and goodput falls as load rises. A row lock is correct but sustains roughly 330 decrements a second, so its wait queue grows by about 7,670 every second, pins connections and starves SKUs nobody is fighting over. The escape is to stop applying one concurrency mechanism to all 200M SKUs.",
    numbers: [
      "~1,600 page views per order",
      "~8k reserve attempts/s on one SKU row",
      "600M inventory rows, ~40GB in memory",
    ],
  },
  nodes: [
    {
      id: "lanes-group",
      label: "Inventory lanes, chosen by heat",
      kind: "zone",
      detail: {
        what: "The three reserve implementations a SKU can be routed into, all of which produce the same artefact: a hold record with a TTL.",
        why: "Contention has to be made structural rather than accidental. One mechanism is wrong for either the long tail or the doorbuster, so the lane is a field on the counter record and every caller reads the lane and the count in one lookup.",
        numbers: ["cold under 50 reserves/s", "warm 50 to 1,000/s", "hot above 1,000/s"],
        breaks:
          "A lane change mid-flight is the one transition that can lose count, which is why demotion waits about 5 minutes while promotion takes a single window.",
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
        numbers: ["~15ms on a shell hit", "~25ms for /p/{sku}/live", "~90k PDP/s in the peak sale minute, 95% edge-served"],
        breaks:
          "A drop page not yet in cache turns T=0 into ~90k simultaneous origin misses, which is why drop pages are pre-pushed to every POP an hour ahead and misses are coalesced at the edge.",
        choice: {
          pick: "Split the page at the volatility boundary: shell cached 5 minutes, live fragment 15 seconds",
          instead: "Cache the whole rendered product page as one object with a short TTL.",
          decider:
            "How often the page must be invalidated against how much of it changes. A ~4KB page whose price moves would be evicted whole, so the effective TTL of the static 3KB collapses to the TTL of the 100B that actually moves. Splitting keeps the shell at 5 minutes and pays a second ~25ms request only for the volatile part.",
          flips:
            "Catalogues where price genuinely never moves within the shell TTL, for example fixed-price digital goods, where one object is simpler and saves the second round trip.",
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
        why: "It only ever sees CDN misses, so it is sized for correctness and freshness rather than for throughput. CDC rather than a nightly batch is what keeps the index trailing the catalogue by seconds, which is the difference between a search result being wrong and being stale.",
        numbers: ["200M SKUs, ~800GB, ~2.4TB at RF=3", "~900GB search index with replicas", "~8ms document read, ~120ms search"],
        breaks:
          "CDC lag on a price edit makes a price-sorted results page visibly wrong, so price is indexed as a coarse band for filtering and the exact number is hydrated from the edge KV.",
        choice: {
          pick: "Partitioned document store keyed by sku_id, OpenSearch index fed by CDC",
          instead: "A wide relational products table, with the search index rebuilt on a schedule.",
          decider:
            "Attribute heterogeneity across 200M SKUs. A mattress and a USB cable share almost no fields, so a wide table is mostly nulls, and the ~1KB attribute JSON per document has no fixed shape to normalise into. A scheduled rebuild also puts the index minutes to hours behind rather than seconds.",
          flips:
            "A narrow catalogue with a stable schema, roughly a single category with fixed attributes, where a relational table gives you real queries and constraints for free.",
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
        why: "Admission control is only useful before work has been admitted, so it sits here rather than in front of inventory. It is also the only thing the read and write paths share, which is what stops a saturated counter from touching browse.",
        numbers: ["admits ~2k/s of ~8k/s arrivals at T+0", "browse protected at 100x checkout load"],
        breaks:
          "Shedding by raw request rate throws away shoppers who already hold stock and a payment authorisation, wasting all three. The ladder must shed personalisation, then reviews, then reranking, then new checkout entries, and never browse or an in-flight checkout.",
        choice: {
          pick: "Waiting room with signed admission tokens at the gateway",
          instead: "Let everything through and rate limit at the inventory service.",
          decider:
            "Where the work has already been paid for. Rejecting at the inventory service means ~8k/s of requests have already consumed a TLS handshake, a cart read and a saga slot before being told no. Admitting ~2k/s at the edge shapes arrivals before any of that, and the consumer behind it is not the bottleneck anyway.",
          flips:
            "Unannounced spikes, where there is no sale object to attach a waiting room to and a burst detector plus lane promotion is the only reactive lever you have.",
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
        why: "A cart line is explicitly not a reservation, only a price snapshot for display. That is what keeps ~100 add-to-carts a second off the inventory counters entirely and lets the reserve happen once, at checkout entry, where the shopper has actually committed.",
        numbers: ["~1KB per cart, ~20M carts, ~20GB steady", "~100 add-to-cart/s", "~100GB over a sale weekend"],
        breaks:
          "Guest-to-account merge is where the complaints come from: union by SKU taking max(qty), not sum, because someone who added two on a phone and two on a laptop meant to buy two.",
        choice: {
          pick: "Durable server-side cart in a KV store, keyed by cart_id",
          instead: "A client-side cart in a cookie or local storage, sent up at checkout.",
          decider:
            "Cross-device continuity against a trivial storage bill. 20M live and abandoned carts at ~1KB is ~20GB, which is nothing, and in exchange the cart survives a device switch, a browser wipe and a sign-in. A client-side cart also arrives untrusted, so every line has to be re-validated anyway.",
          flips:
            "A pure guest storefront with no accounts and no cross-device story, where a signed client-side cart removes an entire service and its availability from the funnel.",
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
        numbers: ["~900ms end to end, ~700ms of it the provider", "~8 orders/s peak, ~800/s in a flash sale", "checkout p99 target < 1.5s"],
        breaks:
          "It is a shared dependency for every order, so its outage stops all purchasing while browse carries on. A crash between payment success and hold confirmation leaves orders stuck in PENDING until the reconciler queries the provider by idempotency key.",
        choice: {
          pick: "Orchestrated durable workflow, sharded by hash(order_id)",
          instead: "Choreographed services reacting to an order event stream.",
          decider:
            "Debuggability under a saga with 5 steps and 5 compensations. Choreography has no single place holding the state, so answering where an order is stuck means reconstructing it from event logs across services. Durable workflow state costs about 2 extra persisted writes per order at a peak of 800 orders/s, which is trivially affordable.",
          flips:
            "Two-step flows with no compensation logic, where an orchestrator is a service you run for nothing and events are genuinely simpler.",
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
        numbers: ["quoted_total plus a changes[] array", "accepted_total echoed on POST /orders", "absorb increases under 2% or GBP 1"],
        breaks:
          "A re-quote is structural rather than a bug, and no amount of presentation makes being shown GBP 40 and asked for GBP 43 pleasant. A spike in price_changed responses means edge KV TTLs and promo propagation are out of step.",
        choice: {
          pick: "Evaluate authoritatively at checkout and echo accepted_total back",
          instead: "A genuine price lock held for the duration of a browsing session.",
          decider:
            "Write amplification against the read rate. A real lock means one promotions-engine write per browsing session at ~2.8k page views a second, and it reopens the arbitrage of stacking locks taken before a promotion expired. Re-quoting costs a small explained delta on well under 0.5% of orders.",
          flips:
            "Low-traffic, high-value carts, for example B2B quoting, where a session is rare and expensive and a firm quote is the product rather than an optimisation.",
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
        what: "A single statement: UPDATE inventory SET available = available - :q WHERE sku = :s AND available >= :q, with the caller reading the affected row count rather than the data.",
        why: "Effectively the entire 200M-SKU catalogue lives here. There is no read followed by a write, no version column and no retry loop, so there is nothing that can livelock, and the hold row is written in the same transaction as the decrement.",
        numbers: ["under 50 reserves/s per SKU", "~3ms", "affects one row or zero"],
        breaks:
          "A decrement without its hold is stock that leaks until a reconciler notices, and a hold without its decrement is an oversell, which is why the pair is one transaction rather than two calls.",
        choice: {
          pick: "Conditional single-statement decrement",
          instead: "Optimistic concurrency on a version column, or SELECT ... FOR UPDATE.",
          decider:
            "Behaviour when contention does arrive. Optimistic control succeeds for one writer per round and forces the other ~7,999 to retry on top of fresh arrivals, so goodput falls as load rises. A row lock at a ~3ms critical section sustains ~330 decrements/s against 8,000 arrivals/s. A conditional update simply affects zero rows and rejects, with no queue to grow.",
          flips:
            "When the update needs to read the row first, for example tiered pricing computed from current stock, where you genuinely cannot express the decision as one predicate.",
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
        why: "It converts one row heading for lock contention into 32 rows that behave like cold ones, with no new infrastructure and no change to the request shape. Hashing the cart rather than the request means a client retry lands in the same bucket and cannot decrement twice.",
        numbers: ["50/s to 1,000/s per SKU", "per-row write rate falls 32x", "merge threshold at total_remaining < 2N = 64"],
        breaks:
          "The endgame. With 5 units left across 32 buckets, 27 are empty, so most buyers are told sold out while stock exists, which is underselling and therefore the expensive error.",
        choice: {
          pick: "32 bucket rows with a forced merge and promotion below 2N",
          instead: "Leave the SKU on one row until it crosses the hot threshold.",
          decider:
            "The gap between 50/s and 1,000/s, which is where most busy SKUs actually live. One row at 1,000/s is already past the ~330 decrements/s a lock sustains, while the queue lane's ~250ms p99 is a heavy price for a SKU that is merely busy. Bucketing cuts per-row rate 32x for the cost of an endgame you must design rather than discover.",
          flips:
            "Very low stock counts, where the SKU is in the bucket endgame from the moment it opens and should start in the queue lane instead.",
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
        why: "This is serialisation without waiting. Nobody holds a lock, and once the counter reaches zero the consumer short-circuits and rejects the entire remaining backlog at memory speed. A lock queue must be walked one critical section at a time; a log can be truncated in one pass.",
        numbers: ["~0.3ms append, ~50k decrements/s consumed", "consumer is 25x faster than the ~2k/s admitted", "clears ~100k queued messages in well under a second"],
        breaks:
          "A single-consumer failure domain. A standby replays from the last persisted offset, so grants already emitted are emitted twice, which is harmless only because the hold store is keyed on hold_id and a re-emitted grant overwrites rather than duplicating.",
        choice: {
          pick: "Per-SKU log with one consumer and a 50ms counter-plus-offset persist",
          instead: "A distributed lock or a pessimistic row lock on the hot SKU.",
          decider:
            "What happens after the stock runs out. A lock queue of 100k waiters must be walked at ~3ms each, which is roughly 5 minutes of pointless serialisation to tell everyone no. The log is truncated in one pass in under a second, and the append itself never blocks at ~0.3ms.",
          flips:
            "Small catalogues where a partition per SKU is affordable, at which point every SKU can live here and the classifier disappears.",
        },
      },
    },
    {
      id: "holds",
      sub: "in-memory, native TTL",
      kind: "database",
      label: "Counters + holds",
      col: 3,
      row: 3,
      detail: {
        what: "The counters themselves plus every hold record: hold_id, sku, qty, cart_id, expires_at and state, with a 15-minute TTL at checkout entry and 10 minutes on a drop. A per-SKU heat classifier runs on these same nodes, tracking a rolling 10-second reserve rate and writing the lane (cold, warm or hot) as a field on the counter record, so lane and count are always read in one lookup.",
        why: "Whichever lane granted it, a reserve produces exactly one artefact, so nothing about the lane leaks past this point and a single checkout saga can serve all three. A hold is a reservation, not a sale; only confirm makes it final. The classifier lives here rather than as a separate service because a network hop on the hot path would add latency and a second thing that can be stale about the SKU that matters most.",
        numbers: [
          "600M rows, ~40GB, fits in memory",
          "7.2M live holds at sale peak, ~600MB",
          "counter persisted every 50ms with its offset",
          "10s rolling window, promote in 1 window, demote after ~5 min",
        ],
        breaks:
          "Millions of holds expire in the same minute after a sale, and a sweeper that falls behind makes real stock invisible for minutes. Expiry runs on native TTL with keyspace events, with the sweeper as a reconciling backstop only. The classifier is also reactive, so an unannounced viral spike runs in the cold lane for its first few seconds; it fails safely since a losing conditional update affects zero rows, but those are exactly the seconds you wanted to sell in.",
        choice: {
          pick: "In-memory store with native TTL and keyspace-expiry events",
          instead: "A holds table with an expires_at column and a polling sweeper.",
          decider:
            "Expiry burst shape. After a sale, 7.2M holds reach their deadline within one window, and a polling scan over that many rows falls behind by minutes, during which stock that physically exists is unsellable. Native TTL fires per key and the reconciler only has to be idempotent against holds already released.",
          flips:
            "When the hold itself must be transactionally consistent with an order row in the same relational database, where losing the single transaction is worse than a slower sweep.",
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
        why: "Same-transaction dedupe is the whole point: a double-tapped Buy makes the second insert violate the constraint, so the original order is returned rather than a second charge being attempted. The key is generated once per checkout session and stored with the cart.",
        numbers: ["~1.5KB per order, ~150k orders/day", "~80GB/yr, ~250GB at RF=3", "hot for 18 months, then columnar archive for 7 years"],
        breaks:
          "The payment step is never acked to the client until the order row is durable, so a shard primary failing after capture turns a lost ack into an idempotent retry rather than a charge with no order behind it.",
        choice: {
          pick: "Relational shards with idempotency under a unique index in the order transaction",
          instead: "A separate idempotency service or cache in front of the order write.",
          decider:
            "Whether dedupe and commit can be torn apart. A separate service means two writes that can disagree, and the window between them is exactly where a retried request double-charges. At ~150k orders/day the whole table is ~80GB/yr, so there is no scale argument for splitting them.",
          flips:
            "When the idempotency check must span several services rather than one order write, at which point it needs its own store and its own reconciliation.",
        },
      },
    },
    {
      id: "payment",
      label: "Payment service",
      kind: "external",
      sub: "auth, capture, ledger, see #23",
      col: 0,
      row: 4,
      detail: {
        what: "The downstream that authorises and captures the charge. Out of scope here: question 23 owns the ambiguous-timeout problem and the double-entry ledger.",
        why: "It is drawn because it sets the constraints checkout answers to. It contributes about 700ms of a ~900ms checkout, it is the step that cannot be rolled back cheaply, and it is the only participant with its own rate limits.",
        numbers: ["~700ms of the ~900ms checkout", "800 orders/s in a flash sale can exceed a per-merchant limit"],
        breaks:
          "A provider throttling at 800 orders/s becomes a wall of 429s, so the step is bulkheaded with its own concurrency budget and bounded queue and spread across two providers with health-based routing.",
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
        numbers: ["cache hit ratio SLO >= 95% for shells", "80% for the live fragment"],
        breaks:
          "A cold cache at drop time makes this edge carry the full ~90k/s, which is why concurrent misses for one key are coalesced into a single origin fetch.",
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
        numbers: ["~8ms document read", "~120ms search including rerank", "~400ms p99 origin-miss budget"],
        breaks:
          "A catalogue partition being unavailable means misses cannot be rendered at all, so the CDN serves stale-if-error for up to 24 hours and degrades to a title-and-price page from the edge KV.",
      },
    },
    {
      id: "e3",
      from: "gateway",
      to: "cart",
      tier: "hot",
      label: "POST /cart/items",
      detail: {
        what: "An add-to-cart write reaching the cart service, carrying a cart_id cookie for a guest or a resolved user_id for a signed-in shopper.",
        why: "The gateway is the only thing the read and write columns share, and this is where they diverge. From here onwards nothing touches the caching path and nothing on the caching path can be slowed by it.",
        numbers: ["~100 add-to-cart/s", "~1.5 per session"],
        breaks:
          "This write must never reach inventory. Reserving here at 2.5% conversion would deflate sellable stock by the abandonment rate and report sold out with full warehouses.",
      },
    },
    {
      id: "e4",
      from: "cart",
      to: "saga",
      tier: "hot",
      label: "POST /checkout/session",
      detail: {
        what: "The cart read that opens a checkout, roughly 1KB of lines handed to the orchestrator.",
        why: "This is the commitment boundary. Everything before it is display state that can be lost cheaply, and everything after it has to be correct, which is exactly why the reserve lives on this side of the line rather than the other.",
        numbers: ["~1KB cart", "15% to 20% of holds wasted from here"],
        breaks:
          "A cart mixing a hot line and cold lines has no atomicity across them, so cold lines are reserved and held hostage while the hot ticket is outstanding.",
      },
    },
    {
      id: "e5",
      from: "saga",
      to: "pricing",
      tier: "hot",
      label: "authoritative re-quote",
      detail: {
        what: "Every line and every promotion re-evaluated against current rules, returning quoted_total and a changes[] array explaining each delta.",
        why: "The number the shopper saw on the product page came from a 15-second cache and is a cached opinion. This call makes the cache non-load-bearing for money, which is the only reason a stale fragment is acceptable at all.",
        numbers: ["price_changed rate SLO < 0.5%", "absorb increases under 2% or GBP 1"],
        breaks:
          "The delta is explained, not eliminated. A shopper shown GBP 40 and asked for GBP 43 is a real experience the design does not fix.",
      },
    },
    {
      id: "e7",
      to: "cold",
      tier: "hot",
      from: "saga",
      label: "cold: under 50/s",
      detail: {
        what: "Routing effectively the entire catalogue to a single conditional decrement.",
        why: "99.99% of reserves have no contention to resolve, and paying a queue's asynchronous experience for them would be a self-inflicted regression. The cheap path has to stay cheap or the lanes have made things worse.",
        numbers: ["~3ms synchronous", "the default for 200M SKUs"],
        breaks:
          "If the classifier is late, this lane absorbs a spike it was never sized for. It rejects rather than oversells, so the loss is sales, not correctness.",
      },
    },
    {
      id: "e8",
      to: "warm",
      tier: "hot",
      from: "saga",
      label: "warm: 50 to 1,000/s",
      detail: {
        what: "Routing a busy but not stampeded SKU to 32 bucket rows selected by hash(cart_id) % N.",
        why: "This band is where most genuinely popular SKUs sit, and neither neighbouring answer fits: one row is already past what a lock sustains, and the queue's ~250ms p99 is too heavy for a SKU that is merely busy.",
        numbers: ["per-row write rate cut 32x", "N = 32"],
        breaks:
          "Skewed hashing empties some buckets while stock remains elsewhere, which is monitored directly as a sold-out-with-stock counter whose SLO is zero.",
      },
    },
    {
      id: "e9",
      to: "hot",
      tier: "hot",
      from: "saga",
      label: "hot: 8k/s on one SKU",
      detail: {
        what: "Routing a doorbuster into its own stream partition, either reactively above 1,000 reserves/s or pre-classified hours before a scheduled drop.",
        why: "Scheduled sales bypass the reactive path entirely, which keeps the classifier's lag off the case that matters most. The lane exists so a hot SKU cannot borrow capacity from cold ones.",
        numbers: ["above 1,000 reserves/s", "~8k/s at T+0 on a doorbuster", "~90% rejected while stock lasts"],
        breaks:
          "It makes the reserve asynchronous, returning a ticket rather than an answer, which is the property a cart mixing lanes cannot reconcile.",
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
        why: "Writing both in one transaction is what makes the reserve safe to retry. Split them and a crash between the two either leaks stock or oversells, and neither is visible without a reconciler.",
        numbers: ["~3ms", "15-minute TTL at checkout entry"],
        breaks:
          "Nothing here bounds how many holds a single abusive client can take, so the rate limit has to live at the gateway rather than at the counter.",
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
        numbers: ["up to two fallbacks before rejecting", "steal takes a short lock on one row"],
        breaks:
          "The steal path locks the fullest bucket, so under extreme skew the lane degrades toward exactly the single-row contention it was built to avoid.",
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
        numbers: ["threshold at total_remaining < 2N = 64", "a genuine stall of tens of milliseconds"],
        breaks:
          "Take it under a distributed lock with a hard timeout, and fail closed into the queue lane on the last consistent total. Half-merged buckets are how you actually lose count.",
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
        why: "The hold_id is what makes replay safe. After a consumer failover, decrements applied in memory but not persisted are re-applied and grants re-emitted, and only a keyed hold store turns that duplicate into an overwrite instead of a second reservation.",
        numbers: ["p99 near 250ms, dominated by queue depth", "counter persisted every 50ms with its offset"],
        breaks:
          "Without hold_id keying, one request produces two hold records that are later released or confirmed independently, and the count drifts whichever way the timing favours.",
      },
    },
    {
      id: "e14",
      from: "saga",
      to: "orders",
      tier: "hot",
      label: "order + Idempotency-Key",
      detail: {
        what: "The PENDING order row and its idempotency key inserted in a single transaction under a unique index.",
        why: "This ordering is deliberate. The order must be durable before payment is acknowledged to the client, so a lost ack becomes an idempotent retry rather than a captured charge with no order behind it.",
        numbers: ["~1.5KB per order", "duplicate returns 409 with Retry-After"],
        breaks:
          "The key must be minted once per checkout session and stored with the cart. A fresh UUID per submit makes the whole scheme decorative.",
      },
    },
    {
      id: "e15",
      from: "saga",
      to: "payment",
      tier: "hot",
      label: "capture, see #23",
      detail: {
        what: "The charge step, called with the hold already taken and the order row already durable.",
        why: "It is the last irreversible step for a reason: every cheap thing that can fail has been tried first, so a failure here compensates by releasing holds rather than by refunding money.",
        numbers: ["~700ms of the ~900ms checkout", "bulkheaded concurrency budget"],
        breaks:
          "The hold TTL is refreshed to now plus the payment timeout plus margin before this call, or a hold can expire under a live authorisation and land the order in PAID_UNRESERVED.",
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
        numbers: ["reserve-to-confirm SLO >= 98%"],
        breaks:
          "A crash between payment success and this call leaves the order PENDING past 60s, and the reconciler must query the provider by idempotency key before deciding to confirm or compensate.",
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
        why: "An abandoned unit has to go back in front of the queue rather than being lost. During a drop the backlog is still draining, so a returned unit is sellable within milliseconds instead of at the next reconciliation.",
        numbers: ["15-minute TTL, 10 on a drop", "millions expire in the same minute after a sale"],
        breaks:
          "Native TTL gives weaker ordering than a scan, so the reconciler behind it must be idempotent against holds that were already released explicitly.",
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
        why: "Drawn as a control path because it carries an opinion rather than a fact. The projection exists so a product page can show a number without a round trip to a rules engine that is busy being authoritative for checkout.",
        numbers: ["15-second TTL", "stock band, never an exact count"],
        breaks:
          "Publishing an exact remaining count here rather than a band turns the fragment into a scraping oracle for a drop and makes every stale read look like a lie.",
      },
    },
  ],
};
