import type { Diagram } from "./types";

export const URL_SHORTENER: Diagram = {
  id: "url-shortener",
  title: "URL Shortener",
  question: "Design a URL Shortener (TinyURL, bit.ly)",
  sourceId: "patterns",
  itemId: 5,
  overview: {
    shape:
      "Two paths share one immutable row: a rare write that mints an alias, and a read 100 times heavier the design tries to answer before it reaches the database.",
    forces: [
      {
        constraint: "Read:write ratio is 100:1, 120k reads/s against 1.2k creates/s",
        decision: "The write path stays a single synchronous Write API and insert; every other layer exists for the read side",
        lights: ["creator", "write-api", "alias-store"],
      },
      {
        constraint: "The redirect response is byte-identical for every one of 120k reads/s on earth",
        decision: "The CDN edge caches the 302 itself, answering ~95% of reads before origin ever sees them",
        lights: ["cdn", "e6", "e7"],
      },
      {
        constraint: "A viral link can put 100k identical requests for one cold alias on the fleet in one second",
        decision: "The Single-flight gate coalesces duplicate in-flight reads for the same alias down to one per server",
        lights: ["coalesce", "e8", "e9"],
      },
      {
        constraint: "Links take ~80% of their lifetime clicks in their first three days, a working set of only ~75GB",
        decision: "The In-memory cache holds three days of creations, absorbing 99% of what reaches origin",
        lights: ["cache", "e10", "e11"],
      },
      {
        constraint: "Caching the redirect at the edge makes ~95% of clicks invisible to origin, recoverable only minutes later",
        decision: "Click analytics run entirely off the redirect path, recovered from CDN logs plus a fire-and-forget event log",
        lights: ["emit", "kafka", "cdn-logs", "warehouse"],
      },
    ],
    naive: {
      text: "Hash the destination URL and take the first 7 characters as the alias, checking the alias store for a collision on every single create. Serve every redirect straight from that same database, with no caching layer at all. The collision check is affordable at first, but the retry rate equals occupancy. At 10% of 3.5 trillion codes used, one create in ten already retries, and at 50% every other one does. The bigger break is on the read side. With no caching, the alias store, sized for ~1.2k writes/s, would have to absorb all 120k reads/s directly. That is two orders of magnitude past what one partitioned store can serve inside a 100ms budget. The Write API replaces the collision check with an unconditional insert from a coordination-free id generator. The CDN edge plus In-memory cache replace the direct database read with two layers that stop 99.95% of traffic before it reaches the store.",
      lights: ["write-api", "alias-store", "cdn", "cache"],
    },
    beats: [
      {
        text: "Start from the property, not the components. The mapping from alias to long URL never changes and is byte-identical for every reader on earth, so the redirect response itself is fully cacheable end to end. Every decision below is only about how far out you push it and what that costs you.",
        lights: ["alias-store", "cdn"],
      },
      {
        text: "Creation is the cheap half. Take an id from a generator that needs no coordination on the request path, Snowflake or a block of 1000 leased from a counter, and encode it in base62. Insert one row and return. Seven characters covers 62^7, about 3.5 trillion aliases, so there is no collision check and no read before the write.",
        lights: ["creator", "write-api", "alias-store", "e1", "e4"],
      },
      {
        text: "Reads are three layers, each one there to stop the request. The CDN answers about 95% of 120k reads/s at roughly 10ms, leaving 6k/s at origin. An in-memory cache holding three days of creations, about 75 GB, absorbs 99% of that, leaving roughly 60 reads/s at the alias store. That last number is the whole point of the architecture.",
        lights: ["cdn", "cache", "alias-store", "e7", "e8", "e10", "e11"],
      },
      {
        text: "The redirect status is a real fork, not a detail. A temporary redirect, cached for 60 seconds, keeps the edge involved so clicks can be counted from delivery logs and a link can still be retracted. A permanent redirect is cheaper still because the browser never asks again, and it destroys both of those properties permanently for anyone who already has the link.",
        lights: ["cdn", "e7"],
      },
      {
        text: "Analytics hang off the redirect asynchronously. One click event of about 200B goes fire-and-forget onto a durable log, 24 MB/s steady and 200 MB/s at peak, and a consumer batches it into a columnar warehouse. The redirect never waits for it, and the pipeline is explicitly allowed to be down.",
        lights: ["emit", "kafka", "warehouse", "e14", "e15", "e18"],
      },
      {
        text: "What is left is the failure surface: a viral link that no edge has yet, which single-flight coalescing collapses from 100k identical reads to one per server. An enumeration scan of distinct 404s is one that coalescing cannot help, and a 30-second negative cache can. A takedown is one that origin can do instantly, but the edge only honours it after a purge.",
        lights: ["coalesce", "cache", "takedown", "e9", "e19", "e20"],
      },
    ],
    crux: {
      problem:
        "Everything you do to make reads cheap makes them invisible. Pushing the redirect to the edge is what removes 95% of the load, and it is the same act that hides those clicks from your servers.",
      handled:
        "It also puts a cached copy of a link you may need to retract on machines you no longer control. Click analytics recovers what it can from CDN logs, delivered minutes late and only ~95% complete. Takedown accepts that an explicit purge reaches PoPs but never a browser that already cached a 301, so retraction is best effort past that point rather than guaranteed.",
    },
    numbers: [
      {
        value: "100:1 read:write, 120k reads/s against 1.2k creates/s",
        explain: "The traffic asymmetry that shapes every design decision: the write path is a rounding error, so the whole architecture optimises the read.",
      },
      {
        value: "95% CDN hit leaves 6k/s at origin, 99% cache hit leaves ~60/s at the store",
        explain: "The two-stage funnel: two multiplicative reductions turn 120k reads/s into 60 reads/s, a roughly 2,000x reduction end to end.",
      },
      {
        value: "62^7 = 3.5 trillion aliases in 7 characters, 10% used after ten years",
        explain: "The alias space at seven base62 characters against ten years of projected volume, leaving enough headroom that no collision handling is needed.",
      },
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
          { value: "100M creates/day = ~1.2k/s", explain: "The baseline write volume, small enough to be handled by a single synchronous service without batching." },
          { value: "each link averages 100 clicks over its life", explain: "The typical lifetime read amplification per created link, part of what produces the 100:1 traffic ratio." },
          { value: "shorten p99 target 200ms", explain: "2x the redirect path's 100ms p99 — affordable because, at 1.2k/s against 120k/s reads, this path is a rounding error in total load." },
        ],
        breaks: {
          failure: "A client retrying a failed shorten gets a brand new alias rather than the original one, because an id is minted per attempt and nothing dedupes on destination.",
          handled: "Only a hash-the-URL scheme makes creation idempotent, and it costs per-owner expiry and analytics, which is why this design accepts non-idempotent retries instead.",
        },
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
        why: "Uniqueness comes from the generator rather than from the database, so there is no read before the write and creation is one round trip. It stays one box rather than a group of stages because the write path genuinely is a rounding error next to the read path. Base62 is chosen over base64 because it needs neither percent-encoding for + and / nor = padding.",
        numbers: [
          { value: "7 base62 chars = 62^7 = 3.5 x 10^12 aliases", explain: "The alias space at seven characters, the figure that rules out any need for collision handling." },
          { value: "10% saturation after ten years of 100M/day", explain: "How much of the alias space is consumed over a realistic ten-year horizon at current volume." },
          { value: "an 8th character takes it to 62^8 = 218 trillion", explain: "The headroom one additional character buys, the lever available if projected volume grows." },
        ],
        breaks: {
          failure: "Custom aliases are the exception and the abuse vector. They take the one conditional insert in the design, an IF NOT EXISTS.",
          handled: "Without a reserved-word list, required auth and a per-account quota, users take /login, /admin and every brand name you did not think of. All three guards are mandatory on this one path.",
        },
        choice: {
          pick: "base62 over an id from a coordination-free generator, inserted unconditionally",
          instead: "Random 7-character codes with a conditional insert to catch duplicates.",
          decider:
            "Whether an unlisted link has to be unguessable, and what a read before the write costs. At 1.2k creates/s the conditional insert is affordable. The retry rate equals occupancy, so at 10% saturation one create in ten retries and at 50% every other one does.",
          flips:
            "When links are treated as secrets: shared documents, invite links, password resets. Counter-derived codes cannot deliver that at any length, because knowing one code tells you roughly where its neighbours are.",
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
        why: "Deletion propagates at the speed of the slowest cache holding a copy. Origin is instant; the edge would otherwise serve the old answer for the rest of its 60-second TTL. For a live phishing link that is an exploit rather than a stale cache. Afterwards the alias returns 410 Gone, not 404, so crawlers can tell removed from never-existed.",
        numbers: [
          { value: "purge propagates across PoPs in under 5 seconds", explain: "12x faster than the 60s ordinary TTL it exists to beat, with 6x margin before the 30s propagation alert below even fires." },
          { value: "TTL bounds ordinary deletion at 60s", explain: "The worst-case staleness for a non-emergency removal that relies on normal cache expiry instead of a purge." },
          { value: "takedown propagation alert above 30s", explain: "The monitoring threshold that catches a purge that is not completing as fast as expected." },
        ],
        breaks: {
          failure: "A browser holding a cached 301 will not ask again until its max-age expires and there is no protocol mechanism to reach it.",
          handled: "Deletion is accepted as best effort past the edge, since link previewers and archives have already copied the destination by the time a takedown fires.",
        },
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
      sub: "Redis, 75 GB LRU, ~99% of reads",
      kind: "cache",
      col: 1,
      row: 1,
      detail: {
        what: "The hot alias to long_url working set in memory, LRU, positive TTL 1h and negative TTL 30s. It is a cache in the strict sense: every entry can be rebuilt from the alias store, so losing the whole tier costs latency and not data.",
        why: "Clicks concentrate on new links, so a link takes about 80% of its lifetime clicks in three days and the working set is just three days of creations. That is 300M aliases at about 250B each, so 75 GB, a handful of replicated nodes rather than a fleet.",
        numbers: [
          { value: "300M aliases x ~250B = 75 GB", explain: "The full working-set size, derived from three days of creations at typical row size." },
          { value: "~6k reads/s in, ~60 reads/s out", explain: "The traffic this tier absorbs and what it passes through to the alias store, a 100x reduction." },
          { value: "positive TTL 1h, negative TTL 30s", explain: "Two different expiry windows for hits and misses, deliberately asymmetric to avoid masking a fresh alias as missing." },
        ],
        breaks: {
          failure: "Distinct 404s from an enumeration scan are guaranteed misses that coalescing cannot collapse.",
          handled: "The negative cache is the only thing standing between a scanner and the store. Its TTL is kept well under the positive one so a freshly created alias probed first does not 404 for its own creator.",
        },
        choice: {
          pick: "Replicated in-memory LRU cache, with tombstones for misses",
          instead: "No cache at all, letting the alias store absorb everything the edge misses.",
          decider:
            "6k/s of point reads is survivable for a partitioned store, but the working set is only 75 GB. The cache turns 6k/s into about 60/s, a 100x reduction for a few nodes. That spare headroom is what absorbs a viral link before any edge is warm.",
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
        why: "It is ground truth for everything cached above it, and it is deliberately the quietest tier in the whole system at about 60 reads/s in steady state. The entire cache hierarchy exists to keep that number where it is, which is why a step change in it is a pageable alert.",
        numbers: [
          { value: "~60 reads/s steady, 1.2k writes/s", explain: "The actual load this store carries, far below what a naive design without caching would generate." },
          { value: "365B rows at ten years, ~500B per row", explain: "The projected total table size at current volume over a decade." },
          { value: "~180 TB logical, ~550 TB at RF 3", explain: "The storage footprint this row count and size produce, tripled for replication." },
        ],
        breaks: {
          failure: "Range partitioning by alias puts 100% of inserts on the newest partition, because generator-derived codes sort by creation time.",
          handled: "It is a design-time decision that is expensive to undo, which is why hash partitioning is chosen from the start rather than discovered as a bottleneck later.",
        },
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
      sub: "columnar object storage, ~8 GB/day",
      kind: "blob",
      col: 0,
      row: 2,
      detail: {
        what: "Links with no click in twelve months, rolled out of the hot tier into columnar files on object storage with a lookup index. A miss for an archived alias falls through the store's index to these files rather than 404ing.",
        why: "About 60% of links are never clicked again after a year, and they are 60% of a 365B-row table sitting on the fast storage the 60 reads/s path depends on. Moving the dormant tail off it keeps the hot dataset a fraction of the logical size.",
        numbers: [
          { value: "60M rows/day archived, ~30 GB/day logical", explain: "The daily volume of rows aging out of the hot tier into cold storage." },
          { value: "~4x columnar compression, so ~8 GB/day stored", explain: "How much the archive's actual storage cost is reduced by columnar encoding." },
          { value: "well under 1% of lookups ever reach this tier", explain: "How rarely an archived alias is actually looked up, justifying the higher per-request latency this tier accepts." },
        ],
        breaks: {
          failure: "An archived alias is still a live link, so the rare lookup that lands here pays object-storage latency well outside the 100ms budget.",
          handled: "This is survivable only because it is rare. If archived links start getting clicked in volume, the tiering policy is treated as wrong and the rows are brought back.",
        },
        choice: {
          pick: "Age dormant rows out to columnar files on object storage behind a lookup index",
          instead: "Keep all 365B rows on the hot partitioned store forever.",
          decider:
            "What fraction of the table earns its storage. 60% of rows get no click after twelve months, so at 500B a row that is over 100 TB logical of fast storage serving effectively no reads. Against that: about 8 GB/day compressed on object storage.",
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
          { value: "120k reads/s steady, ~1M/s peak", explain: "The baseline and peak read load the entire architecture is provisioned around." },
          { value: "peak is about 8x steady", explain: "The multiple between typical and peak load, driven by diurnal patterns and occasional viral spikes." },
          { value: "redirect p99 target under 100ms, 50ms at the edge", explain: "The two latency budgets: end to end, and the tighter target when served entirely from cache." },
        ],
        breaks: {
          failure: "Not all of it is human. Bots, link unfurlers and scanners fetch a link with nobody watching.",
          handled: "This inflates click counts by an amount that varies by referrer, and deduping on IP plus user-agent only partly removes it, an accepted source of measurement noise.",
        },
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
          { value: "~95% hit rate, ~10ms served from the edge", explain: "The dominant fraction of traffic this tier resolves entirely on its own." },
          { value: "max-age=60, so a 100k req/s link costs at most one origin fetch per PoP per minute", explain: "How the freshness window bounds origin load even for an extremely hot single link." },
          { value: "hit-rate alert below 90% sustained", explain: "The monitoring threshold that flags a degradation in edge effectiveness before it becomes a latency incident." },
        ],
        breaks: {
          failure: "A 302 is not cacheable by default under RFC 9111, so it must carry explicit freshness or the edge is decorative.",
          handled: "The 60-second TTL is chosen from the takedown requirement, not the load one, and it simultaneously sets click-counting granularity.",
        },
        choice: {
          pick: "302 with Cache-Control: public, max-age=60, clicks counted off the CDN log stream",
          instead: "301 permanent with a long max-age, hours to a year, and no per-click counting.",
          decider:
            "Whether click data and later editability are worth the load. A 60-second edge TTL already collapses a link taking 100k clicks/s down to one origin fetch per PoP per minute, so the load argument for 301 is mostly gone. What 301 buys is clicks that never leave the browser at all.",
          flips:
            "When the shortener is infrastructure rather than a product. DOIs, documentation links and QR codes printed on physical objects have destinations that genuinely never change, and nobody is paying for click reports.",
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
        what: "The origin tier that answers the 5% the edge missed, on roughly 200 servers. A single-flight gate sits in front of a cache-then-store lookup, with the click event emitted on the way out.",
        why: "These are three stages of one request rather than three services. They deploy together, scale on the same signal, and a request that gets past the gate is already inside the process that resolves it. What the group as a whole exists for is not throughput but rarity: its job is to make sure a herd of identical misses becomes one read.",
        numbers: [
          { value: "~6k reads/s at a 95% edge hit rate", explain: "The load this tier absorbs, an order of magnitude below the total read rate." },
          { value: "~30ms from cache, ~80ms from the store", explain: "The two latency figures a request through this tier can incur, depending on whether the memory cache hits." },
          { value: "200 servers turn 100k identical misses into 200 reads", explain: "The effect of single-flight coalescing at fleet scale for one hot key." },
        ],
        breaks: {
          failure: "A viral link no edge has yet: 100k requests arrive across the fleet in one second, every one misses and every one wants the same key.",
          handled: "Everything inside this box is arranged around that second, which is why the single-flight gate is the first stage rather than an afterthought.",
        },
        choice: {
          pick: "Lookup at origin app servers, with the edge caching the response rather than holding the data",
          instead: "Run the redirect at the edge, with the alias table replicated into an edge key-value store.",
          decider:
            "p99 on the cold-alias path against the per-invocation bill. A miss on the origin design costs a cross-continent round trip, roughly 150ms Sydney to us-east, against 5 to 10ms served entirely at the edge. At a 95% hit rate, 5% of 120k reads/s takes the slow path.",
          flips:
            "Genuinely global traffic with a long tail, which describes this workload better than most. The cost is that an edge key-value store is eventually consistent, so a new link can 404 in a distant PoP for a few seconds.",
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
        what: "A per-server map of alias to in-flight future. A request that finds an entry already there waits on it instead of issuing its own read.",
        why: "It is the first stage rather than a lookup detail because it is what stands between a viral link and the store. 100,000 requests for one cold alias arrive across the fleet in a second; without this every one of them issues the same point query against the same partition. An entry inside the last 10% of its TTL is refreshed by one request while the rest keep serving the old value.",
        numbers: [
          { value: "100k identical misses collapse to ~200 reads", explain: "The effect of coalescing across a 200-server fleet, one read per server at most." },
          { value: "early refresh inside the last 10% of the TTL", explain: "The window in which one request proactively refreshes an entry, preventing the herd from re-forming at TTL expiry." },
          { value: "0 cross-server coordination, 0 shared state", explain: "This mechanism operates entirely per-server, with no distributed locking or shared cache required." },
        ],
        breaks: {
          failure: "Coalescing only helps when the answer exists. An enumeration scan produces distinct keys, so nothing merges.",
          handled: "Every request goes straight through this gate to the tier behind it; that failure is the negative cache's to own, not this one's.",
        },
        choice: {
          pick: "Per-server single-flight plus probabilistic early refresh",
          instead: "Let every miss issue its own read and size the store for the herd.",
          decider:
            "The arithmetic of one hot key: 100k req/s for an alias no edge has yet is 100k identical point queries on one partition. Against that: 200 reads, with a coalescing map that costs a hash map per server. Early refresh stops the herd re-forming at each TTL boundary.",
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
        what: "The lookup itself: memory cache first, alias store on a miss, back-fill on the way out. Then a 302 carrying Location and a 60-second cache header so the edge will cache it.",
        why: "The three latency figures are the budget, and this stage decides which one a request pays: about 30ms answered from memory, about 80ms if it has to reach the store. The p99 target of 100ms is met only because the third case is rare. A missing alias is written back as a tombstone; a deleted one answers 410 Gone.",
        numbers: [
          { value: "~99% of the 6k/s answered from memory", explain: "Only the remaining ~1% ever pays the ~80ms store hit, which is the only reason the ~100ms p99 target holds at all." },
          { value: "~30ms from cache, ~80ms from the store", explain: "The two latency outcomes a request can hit at this stage." },
          { value: "positive TTL 1h, negative TTL 30s", explain: "Restated here because this is the stage that writes both kinds of entry back to the cache." },
        ],
        breaks: {
          failure: "Caching a miss is the dangerous half.",
          handled: "A tombstone TTL anywhere near the positive one would make a newly created alias 404 for its own creator, which is why 30 seconds is not a tuning knob.",
        },
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
        what: "One click event of about 200B per origin-served redirect, pushed onto the log without waiting for an acknowledgement. It buffers in a small bounded ring on the server if the broker is unreachable.",
        why: "The response is already on its way back to the client when this runs, which is what makes a 99.99% redirect SLO independent of a 99.9% analytics pipeline. It is a stage of the redirect rather than a separate service precisely because it must share the request's process and none of its guarantees.",
        numbers: [
          { value: "~6k events/s from origin, ~200B each", explain: "The event volume and size this stage generates from origin-served traffic only." },
          { value: "6 fields per event: alias, ts, country, referrer, ua, ip hash", explain: "The full schema of one click event, kept deliberately minimal." },
          { value: "delivery target 99.9%, against 99.99% on redirects", explain: "The two different availability targets that make analytics explicitly a lower tier than the redirect itself." },
        ],
        breaks: {
          failure: "Fire-and-forget means the producer never learns about a failure.",
          handled: "The bounded ring buffer is the only thing between a broker outage and silent loss, and it is deliberately small, so the loss stays bounded rather than accumulating unboundedly.",
        },
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
        why: "This is a boundary rather than a service because nothing inside it deploys with anything outside it, and nothing in it is allowed to sit on a redirect. Redirects carry a 99.99% availability target and a p99 under 100ms; everything inside this boundary is best effort at a 99.9% delivery target and may be down.",
        numbers: [
          { value: "1.04 x 10^10 click events/day", explain: "The total daily event volume this whole pipeline has to absorb." },
          { value: "24 MB/s steady, 200 MB/s at 1M clicks/s peak", explain: "The byte rate this boundary handles at typical and peak load." },
          { value: "click pipeline lag alert above 60s", explain: "The freshness threshold monitored for this whole subsystem." },
        ],
        breaks: {
          failure: "Click counts are approximate and the error bar is not stateable.",
          handled: "Fire-and-forget loses whatever exceeds the local ring buffer, CDN log sampling is a vendor behaviour, and bots inflate counts by an amount that varies by referrer. These are three independent sources of imprecision the design accepts.",
        },
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
        why: "Two producers with completely different delivery characteristics have to converge somewhere before the warehouse. The log is also the shock absorber: it takes a 1M/s burst at the write end and lets the consumer drain it in batches.",
        numbers: [
          { value: "~200B per event: alias, ts, country, referrer, ua and ip hashes", explain: "The per-event footprint carried through this log." },
          { value: "24 MB/s steady, 200 MB/s at peak", explain: "The throughput this log has to sustain at typical and peak volumes." },
          { value: "1.04 x 10^10 events/day", explain: "The full daily event count flowing through this component." },
        ],
        breaks: {
          failure: "A broker outage loses whatever overflows the bounded local ring buffer on each app server.",
          handled: "You cannot say how much was lost, because the events that would have told you are the ones that were lost, an accepted blind spot of the fire-and-forget design.",
        },
        choice: {
          pick: "A durable partitioned log between the redirect tier and the warehouse",
          instead: "Have the app servers and the log parser write click rows straight to the warehouse.",
          decider:
            "1M clicks/s at peak against warehouse ingest. The log absorbs the burst and lets one consumer write columnar files in batches. Direct writes put warehouse availability and latency in front of a tier explicitly not allowed to care about either.",
          flips:
            "When the click rate is low enough that the warehouse's own streaming ingest keeps up, where a broker is a component to operate for no gain.",
        },
      },
    },
    {
      id: "cdn-logs",
      label: "CDN log stream",
      sub: "vendor logs, ~95% of clicks",
      kind: "external",
      col: 3,
      row: 2,
      parent: "async-group",
      detail: {
        what: "The CDN's own delivery logs, shipped on the vendor's schedule and parsed into click events for every redirect that was answered at the edge.",
        why: "Caching the redirect at the edge is precisely what makes those clicks invisible to your servers, so counting has to move to where the request was actually answered. This is why the 60-second TTL is a click-counting granularity as well as a takedown SLA.",
        numbers: [
          { value: "covers about 95% of all clicks", explain: "The other ~5%, origin-served clicks, arrive through the fire-and-forget emitter instead — two producers reconciled only once both land in the warehouse." },
          { value: "delivered on a lag of 5 to 15 minutes", explain: "The vendor-controlled delay before this data becomes available for processing." },
          { value: "repeat clicks inside the 60s window are invisible to origin", explain: "A specific undercounting mode: repeat visits within one edge TTL window are collapsed to a single served response." },
        ],
        breaks: {
          failure: "Log delivery lag is minutes and sampling of the long tail is a vendor behaviour rather than yours.",
          handled: "This is one of three independent reasons the click count has an error bar nobody can state precisely, an accepted limitation rather than something engineered around.",
        },
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
        why: "Clicks are written once, read rarely and scanned in aggregate over highly repetitive columns, which is exactly the shape columnar storage is for. Dictionary and run-length encoding on country and the ua hash compresses about 8x.",
        numbers: [
          { value: "1.04 x 10^10 events/day", explain: "The daily event volume this store ingests." },
          { value: "2.1 TB/day raw, ~260 GB/day stored", explain: "Raw event bytes against the compressed footprint this store actually keeps." },
          { value: "consumer lag alert above 60s sustained", explain: "The freshness threshold monitored for the batching consumer feeding this store." },
        ],
        breaks: {
          failure: "On sustained overload the consumer drops rather than backs up, because analytics is best effort and redirect availability is not.",
          handled: "Sampling the long tail under overload is an accepted degradation, another reason the counts are approximate rather than exact.",
        },
        choice: {
          pick: "Columnar warehouse fed by a batching consumer",
          instead: "Increment a click_count column on the alias row.",
          decider:
            "Write amplification and query shape. A counter on the row turns 1M clicks/s into 1M updates/s against the one store the entire design keeps at 60 reads/s. It also still cannot answer top countries or referrers.",
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
      tier: "data",
      label: "POST /shorten",
      detail: {
        what: "The create request: a long URL, optionally a custom alias and a TTL.",
        why: "It is the only synchronous, database-touching path in the system, and it can afford to be because it runs at about 1% of the read rate.",
        numbers: [
          { value: "~1.2k/s", explain: "The steady request rate this endpoint absorbs." },
          { value: "p99 budget 200ms", explain: "Twice the redirect path's 100ms p99 — affordable because this path runs at roughly 1% of the read rate." },
        ],
        breaks: {
          failure: "A custom alias arrives on this same call and is the one create that can fail on conflict.",
          handled: "It needs an IF NOT EXISTS insert and a reserved-word list rather than the unconditional path everything else uses.",
        },
      },
    },
    {
      id: "e4",
      from: "write-api",
      to: "alias-store",
      tier: "data",
      label: "single insert",
      detail: {
        what: "The row itself: alias, long_url, owner, created_at and any expiry, written once and never updated.",
        why: "Immutability is what makes every cache downstream safe. If this row could change under readers, none of the edge or memory caching upstream of it would be sound without invalidation on every write.",
        numbers: [
          { value: "1.2k inserts/s", explain: "The write rate this arrow carries, matching the creator's own request rate." },
          { value: "~500B per row", explain: "The row size that determines total store footprint at scale." },
        ],
        breaks: {
          failure: "The partition key is decided here for good.",
          handled: "Time-ordered aliases under range partitioning would put all 1.2k inserts/s onto one partition, which is why hash partitioning is chosen from the very first write.",
        },
      },
    },
    {
      id: "e5",
      from: "write-api",
      to: "cache",
      tier: "data",
      label: "warm on create",
      detail: {
        what: "Populating the memory cache with the mapping at creation time rather than waiting for the first reader to miss.",
        why: "New links are exactly the ones about to be clicked, since a link takes most of its lifetime clicks in its first three days. Seeding on write means the first click of a link that is about to go viral is already a cache hit.",
        numbers: [{ value: "adds 1.2k writes/s to a tier already doing 6k reads/s", explain: "The marginal load this warming step adds to the cache, small relative to its existing read traffic." }],
        breaks: {
          failure: "It only warms the memory tier.",
          handled: "The edge is still cold for that alias until the first request reaches a PoP, which is precisely the window a viral link exploits before any edge warms up.",
        },
      },
    },
    {
      id: "e6",
      from: "clicker",
      to: "cdn",
      tier: "hot",
      step: 1,
      label: "GET /{alias}",
      detail: {
        what: "Every click in the system, arriving at the nearest PoP rather than at your infrastructure.",
        why: "This is the hot path and the reason the architecture exists. Terminating it as far from the database as possible is the single lever that makes 120k reads/s cheap.",
        numbers: [{ value: "120k/s steady, ~1M/s peak", explain: "The full arrival rate this entry point has to accept." }],
        breaks: {
          failure: "An enumeration scan enters through this same door as a stream of distinct aliases.",
          handled: "Per-IP 404 rate limiting belongs at the edge and not at origin, precisely because this is the only chokepoint every request must pass through.",
        },
      },
    },
    {
      id: "e7",
      from: "cdn",
      to: "clicker",
      tier: "hot",
      step: 2,
      label: "302, ~95% of clicks, ~10ms",
      offset: 70,
      detail: {
        what: "The cached redirect response returned straight from the PoP, with Location and a 60-second freshness header.",
        why: "This arrow is the design. The large majority of traffic completes here without touching a server you own, which is what lets the alias store sit at about 60 reads/s.",
        numbers: [
          { value: "~95% of 120k reads/s", explain: "Terminating here is the first and biggest step of the funnel that eventually leaves the alias store at just ~60 reads/s." },
          { value: "~10ms observed", explain: "The typical latency for a click served entirely from cache." },
        ],
        breaks: {
          failure: "These are the clicks your origin never sees, so they have to be recovered from CDN logs.",
          handled: "Switch to 301 and the browser stops sending repeat requests at all, and those clicks become uncountable by any means, which is why this design deliberately stays on 302.",
        },
      },
    },
    {
      id: "e8",
      from: "cdn",
      to: "coalesce",
      tier: "hot",
      step: 3,
      label: "miss, ~6k/s",
      detail: {
        what: "The 5% of requests the edge cannot answer: cold aliases and entries whose 60-second TTL has just lapsed. The response that comes back is what the PoP then caches for the next minute.",
        why: "The miss rate, not the miss latency, is the number to watch. A p99 of 100ms is met only because this path is rare, so a hit-rate regression is a latency incident rather than a cost one.",
        numbers: [{ value: "5% of 120k/s = ~6k/s", explain: "Reduced again by resolve's ~99% cache-hit rate to just ~60/s reaching the alias store — the funnel's second multiplicative step." }],
        breaks: {
          failure: "Synchronised TTL expiry sends every PoP back at the same instant for the hottest keys.",
          handled: "Entries in the last 10% of their TTL are refreshed early by one request while the rest keep serving the old value, spreading the reload instead of concentrating it.",
        },
      },
    },
    {
      id: "e9",
      from: "coalesce",
      to: "resolve",
      tier: "hot",
      step: 4,
      label: "one read per key",
      detail: {
        what: "The single request per alias per server that is allowed past the gate; every other request for that alias waits on its result.",
        why: "This is where a herd becomes a lookup. Everything downstream of this arrow is sized for 6k/s of distinct work, which only holds because duplicates were collapsed before it.",
        numbers: [{ value: "100k identical misses become ~200 reads across 200 servers", explain: "The exact effect of coalescing at fleet scale for one very hot key." }],
        breaks: {
          failure: "Distinct keys do not merge, so an enumeration scan passes through this arrow at full rate.",
          handled: "The tombstones written into the cache are the only thing that stops that scan from reaching the store at full volume.",
        },
      },
    },
    {
      id: "e10",
      from: "resolve",
      to: "cache",
      tier: "hot",
      step: 5,
      label: "cache lookup",
      detail: {
        what: "The memory lookup for alias to long_url, including tombstones for known-missing aliases.",
        why: "It answers about 99% of what gets past the edge, at roughly 30ms end to end. That is the difference between meeting the p99 target and depending on the database for it.",
        numbers: [
          { value: "~6k/s in", explain: "The load this lookup absorbs, everything that passed the single-flight gate." },
          { value: "~30ms served from here", explain: "The typical latency when this lookup hits." },
        ],
        breaks: {
          failure: "Simultaneous misses for the same key would each issue their own store read.",
          handled: "The coalescing gate sits in front of this call rather than behind it specifically to prevent that, so a herd never reaches this lookup as duplicate misses.",
        },
      },
    },
    {
      id: "e11",
      from: "resolve",
      to: "alias-store",
      tier: "data",
      label: "miss, ~60/s",
      detail: {
        what: "The point read of last resort, one primary-key lookup on the hash-partitioned table.",
        why: "It is drawn thin on purpose: about 60 reads/s in steady state, and keeping it there is the justification for every layer above. This is also the path that costs about 80ms, so it is the only place the latency budget is at risk.",
        numbers: [
          { value: "~60 reads/s", explain: "The actual load reaching the alias store, the number every layer above exists to protect." },
          { value: "~80ms end to end", explain: "The latency this path pays, the slowest case in the whole redirect budget." },
        ],
        breaks: {
          failure: "Distinct 404s bypass every protection above: they always miss and coalescing cannot merge them.",
          handled: "An enumeration scan lands here at full rate unless the misses are negatively cached, which is why the negative TTL exists as this path's actual defence.",
        },
      },
    },
    {
      id: "e12",
      from: "alias-store",
      to: "cache",
      tier: "control",
      label: "back-fill on the way out",
      detail: {
        what: "The row written into the memory cache as the response passes back through the resolver, and pushed to the edge with the redirect.",
        why: "It makes a cold alias a one-time cost. The second request for the same alias is already warm, which is what stops a slowly-warming viral link from paying the 80ms store path repeatedly.",
        numbers: [
          { value: "positive TTL 1h", explain: "How long this back-filled entry stays valid before needing a refresh." },
          { value: "negative entries cached for 30s", explain: "The much shorter window for a miss, so a fresh alias is not stuck 404ing long." },
        ],
        breaks: {
          failure: "Caching a miss is the dangerous half.",
          handled: "A tombstone TTL anywhere near the positive one would make a newly created alias 404 for its own creator, which is why the two TTLs are kept far apart.",
        },
      },
    },
    {
      id: "e13",
      from: "alias-store",
      to: "cold-archive",
      tier: "control",
      label: "no click in 12 months",
      detail: {
        what: "Dormant rows aged out of the hot partitioned store into columnar files on object storage, leaving an index entry behind so the alias still resolves.",
        why: "The hot tier is sized and priced for 60 reads/s against a working set of days, not for a decade of rows that will never be read again. Tiering is what keeps 365B rows from all living on the storage the redirect path depends on.",
        numbers: [
          { value: "60M rows/day archived", explain: "The daily volume of rows crossing this arrow into the cold tier." },
          { value: "~30 GB/day logical, ~8 GB/day stored", explain: "60M rows/day × ~500B/row ≈ 30GB raw, compressed roughly 4x — the same columnar economics the click warehouse uses." },
        ],
        breaks: {
          failure: "The policy is a guess about the future: a link with no click for twelve months can still go viral.",
          handled: "When it does, the first reader pays object-storage latency instead of 80ms, an accepted rare-case cost of keeping the hot tier small.",
        },
      },
    },
    {
      id: "e14",
      from: "resolve",
      to: "emit",
      tier: "control",
      label: "click event",
      detail: {
        what: "The resolved redirect handed to the emitter as an event of about 200B, after the response is already on its way.",
        why: "Nothing on the redirect depends on it. The ordering is the point: respond, then record, so a broker outage costs analytics accuracy and never availability.",
        numbers: [
          { value: "~6k events/s from origin", explain: "The event volume this arrow generates, matching origin-served redirects." },
          { value: "~200B each", explain: "The per-event size handed off at this point." },
        ],
        breaks: {
          failure: "Only origin-served clicks pass down this arrow.",
          handled: "The other 95% were answered at the edge and have to be recovered from the CDN's logs instead, which is why this arrow alone cannot give a complete click count.",
        },
      },
    },
    {
      id: "e15",
      from: "emit",
      to: "kafka",
      tier: "control",
      label: "~6k/s, no ack",
      detail: {
        what: "The event pushed onto the durable log without waiting for an acknowledgement.",
        why: "Waiting here would put broker latency inside a p99 budget of 100ms, and make a 99.99% redirect SLO depend on a 99.9% pipeline. The producer deliberately does not learn whether the write landed.",
        numbers: [
          { value: "~6k events/s steady", explain: "The typical rate this arrow carries." },
          { value: "200 MB/s across the log at peak", explain: "The byte rate at peak traffic, well within the log's provisioned capacity." },
        ],
        breaks: {
          failure: "Fire-and-forget means a broker outage is silent at the producer.",
          handled: "The bounded local ring buffer is the only thing between that outage and lost events, and it is deliberately small, bounding the loss rather than eliminating it.",
        },
      },
    },
    {
      id: "e16",
      from: "cdn",
      to: "cdn-logs",
      tier: "control",
      label: "delivery logs",
      offset: 90,
      detail: {
        what: "The CDN's request logs for redirects it served itself, shipped out on the vendor's own schedule.",
        why: "It is the only record of about 95% of clicks, because those requests never touched your infrastructure. Edge caching buys the load reduction and hands you this as the bill.",
        numbers: [
          { value: "~114k clicks/s of the 120k total", explain: "120k × 95% = 114k/s — the volume this design can only ever see through a vendor's logs, 5 to 15 minutes after the fact." },
          { value: "lag of 5 to 15 minutes", explain: "The delay before this data becomes usable, controlled entirely by the vendor." },
        ],
        breaks: {
          failure: "You do not control the sampling or the delivery schedule.",
          handled: "This arrow is the reason click totals are approximate rather than merely delayed, an accepted limit of relying on a third party's logs.",
        },
      },
    },
    {
      id: "e17",
      from: "cdn-logs",
      to: "kafka",
      tier: "control",
      label: "edge clicks, batched",
      detail: {
        what: "Parsed log lines joined onto the same event stream the origin-served clicks use.",
        why: "Two sources have to converge before the warehouse, or stats would need to union a real-time stream against a lagging log dump on every query. Merging here keeps the read side simple.",
        numbers: [{ value: "about 95% of events arrive down this arrow", explain: "The remaining ~5% arrive in real time through the origin emitter instead — two sources with very different lag, which is why query windows must account for the slower one." }],
        breaks: {
          failure: "The two sources have different delays, so any window shorter than the log lag is systematically incomplete.",
          handled: "A dashboard reading a too-recent window will show a dip that is not real. Query windows are set with the log lag in mind rather than treated as instantly complete.",
        },
      },
    },
    {
      id: "e18",
      from: "kafka",
      to: "warehouse",
      tier: "data",
      label: "batched consumer",
      detail: {
        what: "The consumer draining the log in batches and writing columnar files.",
        why: "Batching is what makes 1M events/s affordable to store: per-event writes to a columnar format would defeat the encoding that gets 2.1 TB/day down to 260 GB.",
        numbers: [
          { value: "1.04 x 10^10 events/day", explain: "The full daily volume this consumer processes." },
          { value: "~8x compression", explain: "The reduction achieved by writing in batches with columnar encoding rather than per-event." },
        ],
        breaks: {
          failure: "On sustained lag the consumer drops rather than backing up.",
          handled: "This is a deliberate choice: analytics is best effort and redirect availability is not, so shedding load here never threatens the redirect path.",
        },
      },
    },
    {
      id: "e19",
      from: "takedown",
      to: "cdn",
      tier: "control",
      label: "purge",
      detail: {
        what: "An explicit purge call for the alias, invalidating it across PoPs rather than waiting out the TTL.",
        why: "Without it, a link flagged as phishing keeps redirecting from the edge for up to 60 more seconds, which is a live exploit rather than a stale cache. Purges are billed per call, so this is reserved for safety cases.",
        numbers: [
          { value: "propagates across PoPs in under 5 seconds", explain: "The speed of this operation, far faster than waiting for the ordinary edge TTL." },
          { value: "alert above 30s propagation", explain: "The monitoring threshold that catches a purge underperforming its normal speed." },
        ],
        breaks: {
          failure: "It reaches the edge and nothing beyond it.",
          handled: "A browser that cached a 301 is unreachable, and archives and link previewers already copied the destination, an accepted limit of what any purge mechanism can do.",
        },
      },
    },
    {
      id: "e20",
      from: "takedown",
      to: "alias-store",
      tier: "control",
      label: "deleted_at, then 410",
      offset: 130,
      detail: {
        what: "Setting deleted_at on the row and clearing the cache entry in the same write, after which the alias answers 410 Gone.",
        why: "Origin has to become correct first, or a purge just refills the edge with the same bad redirect. 410 rather than 404 tells crawlers and clients the difference between deliberately removed and never existed.",
        numbers: [
          { value: "origin correct with 0 propagation delay", explain: "This write takes effect immediately at the source of truth." },
          { value: "edge correct within 60s, or under 5s with a purge", explain: "The two possible timelines for the edge to catch up, depending on whether a purge is triggered." },
        ],
        breaks: {
          failure: "The row is retained rather than deleted.",
          handled: "A hard delete would let the alias be reissued to somebody else and inherit its traffic, so the row and its deleted_at marker are kept permanently instead.",
        },
      },
    },
  ],
};
