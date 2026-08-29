import type { Diagram } from "./types";

export const URL_SHORTENER: Diagram = {
  id: "url-shortener",
  title: "URL Shortener",
  question: "Design a URL Shortener (TinyURL, bit.ly)",
  sourceId: "patterns",
  itemId: 5,
  overview: {
    shape:
      "Two paths of wildly different size sharing one immutable row: a rare write that mints an alias and inserts it once, and a read 100 times heavier that the whole design tries to answer before it ever reaches the database.",
    beats: [
      "Start from the property, not the components. The mapping from alias to long URL never changes and is byte-identical for every reader on earth, so the redirect response itself is fully cacheable end to end. Every decision below is only about how far out you push it and what that costs you.",
      "Creation is the cheap half. Take an id from a generator that needs no coordination on the request path, Snowflake or a block of 1000 leased from a counter, encode it in base62, insert one row and return. Seven characters covers 62^7, about 3.5 trillion aliases, so there is no collision check and no read before the write.",
      "Reads are three layers, each one there to stop the request. The CDN answers about 95% of 120k reads/s at roughly 10ms, leaving 6k/s at origin. An in-memory cache holding three days of creations, about 75 GB, absorbs 99% of that, leaving roughly 60 reads/s at the alias store. That last number is the whole point of the architecture.",
      "The redirect status is a real fork, not a detail. A 302 with Cache-Control max-age=60 keeps the edge involved so clicks can be counted from CDN logs and a link can still be retracted. A 301 is cheaper still because the browser never asks again, and it destroys both of those properties permanently for anyone who already has the link.",
      "Analytics hang off the redirect on a dashed line. One click event of about 200B goes fire-and-forget onto a durable log, 24 MB/s steady and 200 MB/s at peak, and a consumer batches it into a columnar warehouse. The redirect never waits for it, and the pipeline is explicitly allowed to be down.",
      "What is left is the failure surface: a viral link that no edge has yet, which single-flight coalescing collapses from 100k identical reads to one per server; an enumeration scan of distinct 404s that coalescing cannot help and a 30-second negative cache can; and a takedown that origin can do instantly but the edge only honours after a purge.",
    ],
    crux:
      "Everything you do to make reads cheap makes them invisible. Pushing the redirect to the edge is what removes 95% of the load, and it is the same act that hides those clicks from your servers and puts a cached copy of a link you may need to retract on machines you no longer control.",
    numbers: [
      "100:1 read:write, 120k reads/s against 1.2k creates/s",
      "95% CDN hit leaves 6k/s at origin, 99% cache hit leaves ~60/s at the store",
      "62^7 = 3.5 trillion aliases in 7 characters, 10% used after ten years",
    ],
  },
  nodes: [
    // --- write path, left column ---
    {
      id: "creator",
      label: "Creator",
      sub: "POST /shorten, ~1.2k/s",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The client that creates a link: one POST with the long URL, an alias back, and it never returns for that alias again.",
        why: "It is drawn separately from the reader because the 100:1 gap between them is the entire design. At 1.2k creates/s against 120k reads/s the write path is a rounding error, which is why it is allowed to be synchronous, database-bound and completely uninteresting.",
        numbers: [
          "100M creates/day = ~1.2k/s",
          "each link averages 100 clicks over its life",
          "shorten p99 target 200ms",
        ],
        breaks:
          "A client retrying a failed shorten gets a brand new alias rather than the original one, because an id is minted per attempt and nothing dedupes on destination. Only the hash-the-URL scheme makes creation idempotent, and it costs you per-owner expiry and analytics.",
      },
    },
    {
      id: "write-api",
      label: "Write API",
      kind: "service",
      col: 1,
      row: 0,
      sub: "base62 id lease; safety check",
      detail: {
        what: "Takes the long URL, checks the destination's reputation, asks for an id, encodes it in base62 and performs a single insert with no collision check.",
        why: "Uniqueness comes from the generator rather than from the database, so there is no read before the write and creation is one round trip. It stays one box rather than a group of stages because the prose treats the whole write path as a rounding error next to the read path: ninety seconds of the interview, one service, one insert. Base62 is chosen over base64 because it needs neither percent-encoding for + and / nor = padding, and it double-click-selects as one token.",
        numbers: [
          "7 base62 chars = 62^7 = 3.5 x 10^12 aliases",
          "10% saturation after ten years of 100M/day",
          "an 8th character takes it to 62^8 = 218 trillion",
        ],
        breaks:
          "Custom aliases are the exception and the abuse vector. They take the one conditional insert in the design, an IF NOT EXISTS, and without a reserved-word list, required auth and a per-account quota users take /login, /admin and every brand name you did not think of.",
        choice: {
          pick: "base62 over an id from a coordination-free generator, inserted unconditionally",
          instead: "Random 7-character codes with a conditional insert to catch duplicates.",
          decider:
            "Whether an unlisted link has to be unguessable, and what a read before the write costs. At 1.2k creates/s the conditional insert is affordable; the retry rate is what matters and it equals occupancy, so at 10% saturation one create in ten retries and at 50% every other one does, by which point you are lengthening the code anyway.",
          flips:
            "When links are treated as secrets: shared documents, invite links, password resets. Counter-derived codes cannot deliver that at any length, because knowing one code tells you roughly where its neighbours are, so if the requirement exists at all it settles the fork on its own.",
        },
      },
    },

    // --- control plane and data tier, middle column ---
    {
      id: "takedown",
      label: "Takedown control",
      sub: "410 Gone + explicit CDN purge",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "Sets deleted_at at origin, drops the memory cache entry on the same write, and issues an explicit purge to the CDN for safety cases.",
        why: "Deletion propagates at the speed of the slowest cache holding a copy. Origin is instant and the edge would otherwise serve the old answer for the rest of its 60-second TTL, which for a live phishing link is an exploit rather than a stale cache. Afterwards the alias returns 410 Gone, not 404, so crawlers can tell removed from never-existed.",
        numbers: [
          "purge propagates across PoPs in seconds",
          "TTL bounds ordinary deletion at 60s",
          "takedown propagation alert above 30s",
        ],
        breaks:
          "A browser holding a cached 301 will not ask again until its max-age expires and there is no protocol mechanism to reach it. Deletion is best effort, and link previewers and archives have copied the destination anyway.",
        choice: {
          pick: "Explicit purge for safety takedowns, TTL expiry for everything else",
          instead: "Purge the CDN on every write, using it as the general invalidation mechanism.",
          decider:
            "Purge calls are billed individually and propagate in seconds; the 60-second TTL costs nothing and is fast enough for an ordinary edit. Paying per purge across 100M creates a day to save 60 seconds of staleness is the wrong trade.",
          flips:
            "Content with a legal removal deadline, where any staleness is a compliance failure and you pay per call to close the 60-second window.",
        },
      },
    },
    {
      id: "cache",
      label: "In-memory cache",
      sub: "Redis, 75 GB LRU, ~99% of origin reads",
      kind: "cache",
      col: 1,
      row: 1,
      detail: {
        what: "The hot alias to long_url working set in memory, LRU, positive TTL 1h and negative TTL 30s. It is a cache in the strict sense: every entry can be rebuilt from the alias store, so losing the whole tier costs latency and not data.",
        why: "Clicks concentrate on new links, so a link takes about 80% of its lifetime clicks in three days and the working set is just three days of creations. That is 300M aliases at about 250B each, so 75 GB, a handful of replicated nodes rather than a fleet, which is why this tier is cheap.",
        numbers: [
          "300M aliases x ~250B = 75 GB",
          "~6k reads/s in, ~60 reads/s out",
          "positive TTL 1h, negative TTL 30s",
        ],
        breaks:
          "Distinct 404s from an enumeration scan are guaranteed misses that coalescing cannot collapse, so the negative cache is the only thing standing between a scanner and the store. Keep its TTL well under the positive one, or a freshly created alias that was probed first will 404 for its own creator.",
        choice: {
          pick: "Replicated in-memory LRU cache, with tombstones for misses",
          instead: "No cache at all, letting the alias store absorb everything the edge misses.",
          decider:
            "6k/s of point reads is survivable for a partitioned store, but the working set is only 75 GB and the cache turns 6k/s into about 60/s, a 100x reduction for a few nodes. That spare headroom is what absorbs a viral link before any edge is warm.",
          flips:
            "When the alias corpus has no temporal concentration, so there is no small working set to hold and the cache only earns its keep on repeat hits inside a TTL.",
        },
      },
    },
    {
      id: "alias-store",
      label: "Alias store",
      sub: "hash(alias) partitioned, RF 3",
      kind: "database",
      col: 0,
      row: 1,
      detail: {
        what: "The durable alias to long_url table with created_by, expires_at and deleted_at, hash-partitioned and replicated three ways.",
        why: "It is ground truth for everything cached above it, and it is deliberately the quietest box in the diagram at about 60 reads/s in steady state. The entire cache hierarchy exists to keep that number where it is, which is why a step change in it is a pageable alert.",
        numbers: [
          "~60 reads/s steady, 1.2k writes/s",
          "365B rows at ten years, ~500B per row",
          "~180 TB logical, ~550 TB at RF 3",
        ],
        breaks:
          "Range partitioning by alias puts 100% of inserts on the newest partition, because generator-derived codes sort by creation time. It is a design-time decision that is expensive to undo, which is why it is worth volunteering before being asked.",
        choice: {
          pick: "Partition on hash(alias), never on alias range",
          instead: "Range partitioning by alias, which buys cheap ordered scans.",
          decider:
            "Insert distribution. Time-ordered aliases mean range partitioning sends every one of 1.2k inserts/s to a single partition while the other partitions idle. Hashing spreads consecutive aliases uniformly across all of them.",
          flips:
            "When the workload genuinely scans key ranges. This one does not: it is point lookups by exact key, and listing a single owner's links is served from an index on created_by instead.",
        },
      },
    },
    {
      id: "cold-archive",
      label: "Cold archive",
      sub: "columnar on object storage, ~8 GB/day",
      kind: "blob",
      col: 0,
      row: 2,
      detail: {
        what: "Links with no click in twelve months, rolled out of the hot tier into columnar files on object storage with a lookup index. A miss for an archived alias falls through the store's index to these files rather than 404ing.",
        why: "About 60% of links are never clicked again after a year, and they are 60% of a 365B-row table sitting on the fast storage that the 60 reads/s path depends on. Moving the dormant tail off it keeps the hot dataset a fraction of the logical size, and object storage is the only tier priced for data that is written once and almost never read.",
        numbers: [
          "60M rows/day archived, ~30 GB/day logical",
          "~4x columnar compression, so ~8 GB/day stored",
          "read only on the rare old-link lookup",
        ],
        breaks:
          "An archived alias is still a live link, so the rare lookup that lands here pays object-storage latency well outside the 100ms budget. It is survivable only because it is rare; if archived links start getting clicked in volume, the tiering policy is wrong and the rows have to come back.",
        choice: {
          pick: "Age dormant rows out to columnar files on object storage behind a lookup index",
          instead: "Keep all 365B rows on the hot partitioned store forever.",
          decider:
            "What fraction of the table earns its storage. 60% of rows get no click after twelve months, so at 500B a row that is over 100 TB logical of fast storage serving effectively no reads, against about 8 GB/day compressed on object storage.",
          flips:
            "When the corpus is small enough that the hot tier is not the cost driver, where a second storage tier and its index are complexity bought for nothing.",
        },
      },
    },

    // --- read path, right column ---
    {
      id: "clicker",
      label: "Clicker",
      sub: "GET /{alias}, 120k/s, ~1M/s peak",
      kind: "client",
      col: 3,
      row: 0,
      detail: {
        what: "Everyone who follows a short link: browsers, chat clients unfurling a preview, crawlers and security scanners.",
        why: "This is the traffic the system exists to serve and it is 100 times the write path, so every component below is positioned to answer it as early as possible. Peak is roughly 8x steady from diurnal concentration plus a handful of simultaneously viral links.",
        numbers: [
          "120k reads/s steady, ~1M/s peak",
          "peak is about 8x steady",
          "redirect p99 target under 100ms, 50ms at the edge",
        ],
        breaks:
          "Not all of it is human. Bots, link unfurlers and scanners fetch a link with nobody watching, which inflates click counts by an amount that varies by referrer and that deduping on IP plus user-agent only partly removes.",
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "302 + Cache-Control max-age=60",
      kind: "gateway",
      col: 3,
      row: 1,
      detail: {
        what: "The PoP network caching the redirect response itself, not the data behind it, and serving the large majority of clicks without your servers being involved. It is also where per-IP 404 rate limiting belongs, since an enumeration scan arrives through this same door.",
        why: "The redirect for a given alias is byte-identical for every user on earth, which is a rare property and the one that makes full edge caching possible at all. At a 95% hit rate it removes 114k of 120k reads/s before they can become anyone's problem.",
        numbers: [
          "~95% hit rate, ~10ms served from the edge",
          "max-age=60, so a 100k req/s link costs at most one origin fetch per PoP per minute",
          "hit-rate alert below 90% sustained",
        ],
        breaks:
          "A 302 is not cacheable by default under RFC 9111, so it must carry explicit freshness or the edge is decorative. The 60-second TTL is chosen from the takedown requirement, not the load one, and it simultaneously sets click-counting granularity.",
        choice: {
          pick: "302 with Cache-Control: public, max-age=60, clicks counted off the CDN log stream",
          instead: "301 permanent with a long max-age, hours to a year, and no per-click counting.",
          decider:
            "Whether click data and later editability are worth the load. A 60-second edge TTL already collapses a link taking 100k clicks/s down to one origin fetch per PoP per minute, so the load argument for 301 is mostly gone. What 301 actually buys is the clicks that never leave the browser: a user visiting a link 10 times sends 1 request instead of 10.",
          flips:
            "When the shortener is infrastructure rather than a product. DOIs, documentation links and QR codes printed on physical objects have destinations that genuinely never change, nobody is paying for click reports, and search engines pass link equity through a 301 but not a 302.",
        },
      },
    },
    {
      id: "redirect-svc",
      label: "Redirect service",
      kind: "serviceGroup",
      sub: "single-flight · resolve · emit",
      col: 2,
      row: 1,
      detail: {
        what: "The origin tier that answers the 5% the edge missed, on roughly 200 servers: a single-flight gate in front of a cache-then-store lookup, with the click event emitted on the way out.",
        why: "These are three stages of one request rather than three services. They deploy together, scale on the same signal, and a request that gets past the gate is already inside the process that resolves it, so drawing them as peers would claim an independence that does not exist. What the group as a whole exists for is not throughput but rarity: its job is to make sure a herd of identical misses becomes one read.",
        numbers: [
          "~6k reads/s at a 95% edge hit rate",
          "~30ms from cache, ~80ms from the store",
          "200 servers turn 100k identical misses into 200 reads",
        ],
        breaks:
          "A viral link no edge has yet: 100k requests arrive across the fleet in one second, every one misses and every one wants the same key. Everything inside this box is arranged around that second.",
        choice: {
          pick: "Lookup at origin app servers, with the edge caching the response rather than holding the data",
          instead: "Run the redirect at the edge, with the alias table replicated into an edge key-value store.",
          decider:
            "p99 on the cold-alias path against the per-invocation bill. A miss on the origin design costs a cross-continent round trip, roughly 150ms Sydney to us-east, against 5 to 10ms served entirely at the edge. At a 95% hit rate, 5% of 120k reads/s takes the slow path, and against an SLO of p99 under 100ms a 5% slow path fails outright.",
          flips:
            "Genuinely global traffic with a long tail, which describes this workload better than most. The cost is that an edge key-value store is eventually consistent, so a new link can 404 in a distant PoP for a few seconds and a takedown propagates on the same delay. The usual resolution is both, with the edge serving reads and origin remaining the write and purge authority.",
        },
      },
    },
    {
      id: "coalesce",
      label: "Single-flight gate",
      sub: "one in-flight read per alias",
      kind: "process",
      col: 2,
      row: 1,
      parent: "redirect-svc",
      detail: {
        what: "A per-server map of alias to in-flight future. A request that finds an entry already there waits on it instead of issuing its own read, and an entry inside the last 10% of its TTL is refreshed by one request while the rest keep serving the old value.",
        why: "It is the first stage rather than a lookup detail because it is what stands between a viral link and the store. 100,000 requests for one cold alias arrive across the fleet in a second; without this every one of them issues the same point query against the same partition. With 200 servers it becomes 200 reads.",
        numbers: [
          "100k identical misses collapse to ~200 reads",
          "early refresh inside the last 10% of the TTL",
          "per-server state, nothing shared, nothing to coordinate",
        ],
        breaks:
          "Coalescing only helps when the answer exists. An enumeration scan produces distinct keys, so nothing merges and every request goes straight through this gate to the tier behind it; that failure is the negative cache's to own, not this one's.",
        choice: {
          pick: "Per-server single-flight plus probabilistic early refresh",
          instead: "Let every miss issue its own read and size the store for the herd.",
          decider:
            "The arithmetic of one hot key: 100k req/s for an alias no edge has yet is 100k identical point queries on one partition, against 200 with a coalescing map that costs a hash map per server. Early refresh is what stops the herd re-forming at each 60-second TTL boundary.",
          flips:
            "When there are no hot keys, so misses are spread across the space and each one is genuinely a distinct read that coalescing can never merge.",
        },
      },
    },
    {
      id: "resolve",
      label: "Resolve and redirect",
      sub: "cache, then store, then 302",
      kind: "process",
      col: 2,
      row: 2,
      parent: "redirect-svc",
      detail: {
        what: "The lookup itself: memory cache first, alias store on a miss, back-fill on the way out, then a 302 carrying Location and Cache-Control: public, max-age=60 so the edge will cache it. A missing alias is written back as a tombstone; a deleted one answers 410 Gone.",
        why: "The three latency figures are the budget, and this stage decides which one a request pays: about 30ms answered from memory, about 80ms if it has to reach the store. The p99 target of 100ms is met only because the third case is rare, which is why the miss rate rather than the miss latency is the number to watch.",
        numbers: [
          "~99% of the 6k/s answered from memory",
          "~30ms from cache, ~80ms from the store",
          "positive TTL 1h, negative TTL 30s",
        ],
        breaks:
          "Caching a miss is the dangerous half. A tombstone TTL anywhere near the positive one would make a newly created alias 404 for its own creator, which is why 30 seconds is not a tuning knob.",
      },
    },
    {
      id: "emit",
      label: "Click emitter",
      sub: "fire-and-forget, bounded buffer",
      kind: "process",
      col: 2,
      row: 3,
      parent: "redirect-svc",
      detail: {
        what: "One click event of about 200B per origin-served redirect, pushed onto the log without waiting for an acknowledgement, buffered in a small bounded ring on the server if the broker is unreachable.",
        why: "The response is already on its way back to the client when this runs, which is what makes a 99.99% redirect SLO independent of a 99.9% analytics pipeline. It is a stage of the redirect rather than a separate service precisely because it must share the request's process and none of its guarantees.",
        numbers: [
          "~6k events/s from origin, ~200B each",
          "alias, ts, country, referrer, ua and ip hashes",
          "delivery target 99.9%, against 99.99% on redirects",
        ],
        breaks:
          "Fire-and-forget means the producer never learns about a failure. The bounded ring buffer is the only thing between a broker outage and silent loss, and it is deliberately small, so you cannot say afterwards how much you lost.",
        choice: {
          pick: "Fire-and-forget onto a durable log, with a bounded local ring buffer during an outage",
          instead: "Write the click synchronously on the redirect path.",
          decider:
            "1M clicks/s at peak. A synchronous write puts warehouse latency inside a p99 budget of 100ms and makes a 99.99% redirect SLO depend on an analytics pipeline that is only best effort.",
          flips:
            "When a click is a billable event, where dropping one is a revenue error and the write genuinely has to be acknowledged before the redirect is served.",
        },
      },
    },

    // --- analytics, bottom ---
    {
      id: "async-group",
      kind: "zone",
      label: "Async analytics, off the redirect path",
      detail: {
        what: "The click pipeline: edge-served clicks recovered from CDN logs, origin-served clicks fired onto a durable log, both landing in a columnar warehouse.",
        why: "It is drawn as a zone rather than a service because nothing in it deploys with anything else in it, and nothing in it is allowed to sit on a redirect. Redirects carry a 99.99% availability target and a p99 under 100ms; the whole of this box is best effort at a 99.9% delivery target and may be down.",
        numbers: [
          "1.04 x 10^10 click events/day",
          "24 MB/s steady, 200 MB/s at 1M clicks/s peak",
          "click pipeline lag alert above 60s",
        ],
        breaks:
          "Click counts are approximate and the error bar is not stateable: fire-and-forget loses whatever exceeds the local ring buffer, CDN log sampling is a vendor behaviour, and bots and link unfurlers inflate counts by an amount that varies by referrer.",
      },
    },
    {
      id: "kafka",
      label: "Click event log",
      sub: "Kafka, 24 MB/s steady",
      kind: "queue",
      col: 1,
      row: 2,
      parent: "async-group",
      detail: {
        what: "A durable partitioned log carrying every click event, from the origin producers and from the parsed CDN logs, retained long enough for a consumer to catch up after an outage.",
        why: "Two producers with completely different delivery characteristics have to converge somewhere before the warehouse, and the log is also the shock absorber: it takes a 1M/s burst at the write end and lets the consumer drain it in batches at whatever rate columnar writes allow.",
        numbers: [
          "~200B per event: alias, ts, country, referrer, ua and ip hashes",
          "24 MB/s steady, 200 MB/s at peak",
          "1.04 x 10^10 events/day",
        ],
        breaks:
          "A broker outage loses whatever overflows the bounded local ring buffer on each app server, and you cannot say how much, because the events that would have told you are the ones you lost.",
        choice: {
          pick: "A durable partitioned log between the redirect tier and the warehouse",
          instead: "Have the app servers and the log parser write click rows straight to the warehouse.",
          decider:
            "1M clicks/s at peak against warehouse ingest. The log absorbs the burst and lets one consumer write columnar files in batches; direct writes put warehouse availability and latency in front of a tier that is explicitly not allowed to care about either.",
          flips:
            "When the click rate is low enough that the warehouse's own streaming ingest keeps up, where a broker is a component to operate for no gain.",
        },
      },
    },
    {
      id: "cdn-logs",
      label: "CDN log stream",
      sub: "vendor-delivered, the ~95% origin never saw",
      kind: "external",
      col: 3,
      row: 2,
      parent: "async-group",
      detail: {
        what: "The CDN's own delivery logs, shipped on the vendor's schedule and parsed into click events for every redirect that was answered at the edge.",
        why: "Caching the redirect at the edge is precisely what makes those clicks invisible to your servers, so counting has to move to where the request was actually answered. This is why the 60-second TTL is a click-counting granularity as well as a takedown SLA. It is drawn as external because neither the sampling nor the delivery schedule is yours.",
        numbers: [
          "covers about 95% of all clicks",
          "delivered on a lag of minutes",
          "repeat clicks inside the 60s window are invisible to origin",
        ],
        breaks:
          "Log delivery lag is minutes and sampling of the long tail is a vendor behaviour rather than yours, which is one of the three independent reasons the click count has an error bar nobody can state.",
        choice: {
          pick: "Recover edge-served clicks from CDN logs",
          instead: "Disable edge caching for redirects so every click is counted at origin.",
          decider:
            "Origin load. Counting at origin means all 120k reads/s reach your servers instead of 6k/s, a 20x increase, in exchange for counts arriving seconds rather than minutes sooner.",
          flips:
            "When clicks are billed. A customer invoiced per click needs a reconciled counting path with its own durability guarantees, not vendor logs plus a fire-and-forget queue.",
        },
      },
    },
    {
      id: "warehouse",
      label: "Analytics warehouse",
      sub: "columnar, ~260 GB/day",
      kind: "database",
      col: 2,
      row: 2,
      parent: "async-group",
      detail: {
        what: "Columnar storage for click events, filled by a batching consumer and serving /api/{alias}/stats.",
        why: "Clicks are written once, read rarely and scanned in aggregate over highly repetitive columns, which is exactly the shape columnar storage is for. Dictionary and run-length encoding on country and the ua hash compresses about 8x, turning 2.1 TB/day raw into roughly 260 GB/day.",
        numbers: [
          "1.04 x 10^10 events/day",
          "2.1 TB/day raw, ~260 GB/day stored",
          "consumer lag alert above 60s sustained",
        ],
        breaks:
          "On sustained overload the consumer drops rather than backs up, because analytics is best effort and redirect availability is not. Sampling the long tail is another reason the counts are approximate.",
        choice: {
          pick: "Columnar warehouse fed by a batching consumer",
          instead: "Increment a click_count column on the alias row.",
          decider:
            "Write amplification and query shape. A counter on the row turns 1M clicks/s into 1M updates/s against the one store the entire design keeps at 60 reads/s, and it still cannot answer top countries or referrers.",
          flips:
            "When a running total is all anyone needs and the click rate is low enough that a periodic batched increment is both honest and cheap.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "creator",
      to: "write-api",
      label: "POST /shorten",
      detail: {
        what: "The create request: a long URL, optionally a custom alias and a TTL.",
        why: "It is the only synchronous, database-touching path in the system, and it can afford to be because it runs at about 1% of the read rate.",
        numbers: ["~1.2k/s", "p99 budget 200ms"],
        breaks:
          "A custom alias arrives on this same call and is the one create that can fail on conflict, so it needs an IF NOT EXISTS insert and a reserved-word list rather than the unconditional path.",
      },
    },
    {
      id: "e4",
      from: "write-api",
      to: "alias-store",
      label: "single insert",
      detail: {
        what: "The row itself: alias, long_url, owner, created_at and any expiry, written once and never updated.",
        why: "Immutability is what makes every cache downstream safe. If this row could change under readers, none of the edge or memory caching in the diagram would be sound without invalidation on every write.",
        numbers: ["1.2k inserts/s", "~500B per row"],
        breaks:
          "The partition key is decided here for good. Time-ordered aliases under range partitioning would put all 1.2k inserts/s onto one partition.",
      },
    },
    {
      id: "e5",
      from: "write-api",
      to: "cache",
      label: "warm on create",
      detail: {
        what: "Populating the memory cache with the mapping at creation time rather than waiting for the first reader to miss.",
        why: "New links are exactly the ones about to be clicked, since a link takes most of its lifetime clicks in its first three days. Seeding on write means the first click of a link that is about to go viral is already a cache hit.",
        numbers: ["adds 1.2k writes/s to a tier already doing 6k reads/s"],
        breaks:
          "It only warms the memory tier. The edge is still cold for that alias until the first request reaches a PoP, which is precisely the window a viral link exploits.",
      },
    },
    {
      id: "e6",
      from: "clicker",
      to: "cdn",
      label: "GET /{alias}",
      animated: true,
      detail: {
        what: "Every click in the system, arriving at the nearest PoP rather than at your infrastructure.",
        why: "This is the hot path and the reason the architecture exists. Terminating it as far from the database as possible is the single lever that makes 120k reads/s cheap.",
        numbers: ["120k/s steady, ~1M/s peak"],
        breaks:
          "An enumeration scan enters through this same door as a stream of distinct aliases, which is why per-IP 404 rate limiting belongs at the edge and not at origin.",
      },
    },
    {
      id: "e7",
      from: "cdn",
      to: "clicker",
      label: "302, ~95% of clicks, ~10ms",
      animated: true,
      offset: 70,
      detail: {
        what: "The cached redirect response returned straight from the PoP, with Location and a 60-second freshness header.",
        why: "This arrow is the design. The large majority of traffic completes here without touching a server you own, which is what lets the alias store sit at about 60 reads/s.",
        numbers: ["~95% of 120k reads/s", "~10ms observed", "max-age=60"],
        breaks:
          "These are the clicks your origin never sees, so they have to be recovered from CDN logs. Switch to 301 and the browser stops sending repeat requests at all, and those clicks become uncountable by any means.",
      },
    },
    {
      id: "e8",
      from: "cdn",
      to: "coalesce",
      label: "miss, ~6k/s",
      animated: true,
      detail: {
        what: "The 5% of requests the edge cannot answer: cold aliases and entries whose 60-second TTL has just lapsed. The response that comes back is what the PoP then caches for the next minute.",
        why: "The miss rate, not the miss latency, is the number to watch. A p99 of 100ms is met only because this path is rare, so a hit-rate regression is a latency incident rather than a cost one.",
        numbers: ["5% of 120k/s = ~6k/s", "alert if the hit rate drops below 90%"],
        breaks:
          "Synchronised TTL expiry sends every PoP back at the same instant for the hottest keys, which is why entries in the last 10% of their TTL are refreshed early by one request while the rest keep serving the old value.",
      },
    },
    {
      id: "e9",
      from: "coalesce",
      to: "resolve",
      label: "one read per key",
      animated: true,
      detail: {
        what: "The single request per alias per server that is allowed past the gate; every other request for that alias waits on its result.",
        why: "This is where a herd becomes a lookup. Everything downstream of this arrow is sized for 6k/s of distinct work, which only holds because duplicates were collapsed before it.",
        numbers: ["100k identical misses become ~200 reads across 200 servers"],
        breaks:
          "Distinct keys do not merge, so an enumeration scan passes through this arrow at full rate and the tombstones in the cache are the only thing that stops it.",
      },
    },
    {
      id: "e10",
      from: "resolve",
      to: "cache",
      label: "cache lookup",
      animated: true,
      detail: {
        what: "The memory lookup for alias to long_url, including tombstones for known-missing aliases.",
        why: "It answers about 99% of what gets past the edge, at roughly 30ms end to end, which is the difference between meeting the p99 target and depending on the database for it.",
        numbers: ["~6k/s in", "~30ms served from here"],
        breaks:
          "Simultaneous misses for the same key would each issue their own store read, which is why the coalescing gate sits in front of this call rather than behind it.",
      },
    },
    {
      id: "e11",
      from: "resolve",
      to: "alias-store",
      label: "miss, ~60/s",
      detail: {
        what: "The point read of last resort, one primary-key lookup on the hash-partitioned table.",
        why: "It is drawn thin on purpose: about 60 reads/s in steady state, and keeping it there is the justification for every layer above. This is also the path that costs about 80ms, so it is the only place the latency budget is at risk.",
        numbers: ["~60 reads/s", "~80ms end to end", "step-change alert on this rate"],
        breaks:
          "Distinct 404s bypass every protection above: they always miss and coalescing cannot merge them, so an enumeration scan lands here at full rate unless the misses are negatively cached.",
      },
    },
    {
      id: "e12",
      from: "alias-store",
      to: "cache",
      label: "back-fill on the way out",
      dashed: true,
      detail: {
        what: "The row written into the memory cache as the response passes back through the resolver, and pushed to the edge with the redirect.",
        why: "It makes a cold alias a one-time cost. The second request for the same alias is already warm, which is what stops a slowly-warming viral link from paying the 80ms store path repeatedly.",
        numbers: ["positive TTL 1h", "negative entries cached for 30s"],
        breaks:
          "Caching a miss is the dangerous half. A tombstone TTL anywhere near the positive one would make a newly created alias 404 for its own creator.",
      },
    },
    {
      id: "e13",
      from: "alias-store",
      to: "cold-archive",
      label: "no click in 12 months",
      dashed: true,
      detail: {
        what: "Dormant rows aged out of the hot partitioned store into columnar files on object storage, leaving an index entry behind so the alias still resolves.",
        why: "The hot tier is sized and priced for 60 reads/s against a working set of days, not for a decade of rows that will never be read again. Tiering is what keeps 365B rows from all living on the storage the redirect path depends on.",
        numbers: ["60M rows/day archived", "~30 GB/day logical, ~8 GB/day stored"],
        breaks:
          "The policy is a guess about the future: a link with no click for twelve months can still go viral, and when it does the first reader pays object-storage latency instead of 80ms.",
      },
    },
    {
      id: "e14",
      from: "resolve",
      to: "emit",
      label: "click event",
      dashed: true,
      detail: {
        what: "The resolved redirect handed to the emitter as an event of about 200B, after the response is already on its way.",
        why: "It is dashed because nothing on the redirect depends on it. The ordering is the point: respond, then record, so a broker outage costs analytics accuracy and never availability.",
        numbers: ["~6k events/s from origin", "~200B each"],
        breaks:
          "Only origin-served clicks pass down this arrow. The other 95% were answered at the edge and have to be recovered from the CDN's logs instead.",
      },
    },
    {
      id: "e15",
      from: "emit",
      to: "kafka",
      label: "~6k/s, no ack",
      dashed: true,
      detail: {
        what: "The event pushed onto the durable log without waiting for an acknowledgement.",
        why: "Waiting here would put broker latency inside a p99 budget of 100ms and make a 99.99% redirect SLO depend on a 99.9% pipeline, so the producer deliberately does not learn whether the write landed.",
        numbers: ["~6k events/s steady", "200 MB/s across the log at peak"],
        breaks:
          "Fire-and-forget means a broker outage is silent at the producer. The bounded local ring buffer is the only thing between that outage and lost events, and it is deliberately small.",
      },
    },
    {
      id: "e16",
      from: "cdn",
      to: "cdn-logs",
      label: "delivery logs",
      dashed: true,
      offset: 90,
      detail: {
        what: "The CDN's request logs for redirects it served itself, shipped out on the vendor's own schedule.",
        why: "It is the only record of about 95% of clicks, because those requests never touched your infrastructure. Edge caching buys the load reduction and hands you this as the bill.",
        numbers: ["~114k clicks/s of the 120k total", "lag of minutes"],
        breaks:
          "You do not control the sampling or the delivery schedule, so this arrow is the reason click totals are approximate rather than merely delayed.",
      },
    },
    {
      id: "e17",
      from: "cdn-logs",
      to: "kafka",
      label: "edge clicks, batched",
      dashed: true,
      detail: {
        what: "Parsed log lines joined onto the same event stream the origin-served clicks use.",
        why: "Two sources have to converge before the warehouse, or stats would need to union a real-time stream against a lagging log dump on every query. Merging here keeps the read side simple.",
        numbers: ["about 95% of events arrive down this arrow"],
        breaks:
          "The two sources have different delays, so any window shorter than the log lag is systematically incomplete and a dashboard reading it will show a dip that is not real.",
      },
    },
    {
      id: "e18",
      from: "kafka",
      to: "warehouse",
      label: "batched consumer",
      detail: {
        what: "The consumer draining the log in batches and writing columnar files.",
        why: "Batching is what makes 1M events/s affordable to store: per-event writes to a columnar format would defeat the encoding that gets 2.1 TB/day down to 260 GB.",
        numbers: ["1.04 x 10^10 events/day", "~8x compression"],
        breaks:
          "On sustained lag the consumer drops rather than backing up, which is a deliberate choice: analytics is best effort and redirect availability is not.",
      },
    },
    {
      id: "e19",
      from: "takedown",
      to: "cdn",
      label: "purge",
      dashed: true,
      detail: {
        what: "An explicit purge call for the alias, invalidating it across PoPs rather than waiting out the TTL.",
        why: "Without it, a link flagged as phishing keeps redirecting from the edge for up to 60 more seconds, which is a live exploit rather than a stale cache. Purges are billed per call, so this is reserved for safety cases.",
        numbers: ["propagates in seconds", "alert above 30s propagation"],
        breaks:
          "It reaches the edge and nothing beyond it. A browser that cached a 301 is unreachable, and archives and link previewers already copied the destination.",
      },
    },
    {
      id: "e20",
      from: "takedown",
      to: "alias-store",
      label: "deleted_at, then 410",
      dashed: true,
      offset: 130,
      detail: {
        what: "Setting deleted_at on the row and clearing the cache entry in the same write, after which the alias answers 410 Gone.",
        why: "Origin has to become correct first, or a purge just refills the edge with the same bad redirect. 410 rather than 404 tells crawlers and clients the difference between deliberately removed and never existed.",
        numbers: ["origin correct immediately", "edge correct within 60s, or seconds with a purge"],
        breaks:
          "The row is retained rather than deleted, because a hard delete would let the alias be reissued to somebody else and inherit its traffic.",
      },
    },
  ],
};
