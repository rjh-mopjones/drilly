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
    {
      id: "async-group",
      label: "Async analytics, never on the redirect path",
      kind: "group",
      x: 384,
      y: 444,
      w: 652,
      h: 228,
      detail: {
        what: "The click pipeline: edge-served clicks recovered from CDN logs, origin-served clicks fired onto a durable log, both landing in a columnar warehouse.",
        why: "It is drawn as a separate zone because nothing inside it is allowed to sit on a redirect. Redirects carry a 99.99% availability target and a p99 under 100ms; the whole of this box is best effort at a 99.9% delivery target and may be down.",
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
      id: "creator",
      label: "Creator",
      sub: "POST /shorten, ~1.2k/s",
      kind: "external",
      x: 40,
      y: 0,
      w: 260,
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
      sub: "base62 encode, one unconditional insert",
      kind: "compute",
      x: 40,
      y: 110,
      w: 260,
      detail: {
        what: "Takes the long URL, asks for an id, encodes it in base62 and performs a single insert with no collision check.",
        why: "Uniqueness comes from the generator rather than from the database, so there is no read before the write and creation is one round trip. Base62 is chosen over base64 because it needs neither percent-encoding for + and / nor = padding, and it double-click-selects as one token.",
        numbers: [
          "7 base62 chars = 62^7 = 3.5 x 10^12 aliases",
          "10% saturation after ten years of 100M/day",
          "an 8th character takes it to 62^8 = 218 trillion",
        ],
        breaks:
          "Custom aliases are the exception and the abuse vector: without a reserved-word list, required auth and a per-account quota, users take /login, /admin and every brand name you did not think of.",
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
    {
      id: "id-gen",
      label: "ID generator",
      sub: "Snowflake, or a 1000-id lease",
      kind: "compute",
      x: 40,
      y: 220,
      w: 260,
      detail: {
        what: "Hands out unique ids with nothing to coordinate on the request path: Snowflake as in Q4, or a block of 1000 ids leased from a central counter at startup.",
        why: "If the generator has to be consulted per insert it becomes the write path's ceiling and its single point of failure. Leasing amortises the counter away, and gaps in the alias space from an unused block cost nothing because 90% of the space is still free after a decade.",
        numbers: [
          "blocks of 1000 ids, one counter op per 1000 inserts",
          "a central auto-increment caps out at a few thousand inserts/s",
          "at most one in-flight block lost per failover",
        ],
        breaks:
          "Its ids are time-ordered, so the aliases are too. That is harmless for lookups and fatal for partitioning, which is exactly the trap the alias store has to be designed around.",
        choice: {
          pick: "Snowflake, or a 1000-id block leased from an HA counter",
          instead: "A single centralised auto-increment column consulted per insert.",
          decider:
            "Where the write ceiling sits. A central counter caps around a few thousand inserts/s and takes every write down with it; a 1000-id lease cuts counter traffic 1000x and loses at most 1000 unused ids on a failover.",
          flips:
            "Below a few hundred creates/s, where a database sequence is one less service to operate and there is no ceiling worth engineering around.",
        },
      },
    },
    {
      id: "safety",
      label: "Safety check",
      sub: "Safe Browsing + internal blocklist",
      kind: "external",
      x: 40,
      y: 330,
      w: 260,
      detail: {
        what: "A reputation call on the destination before the alias is issued, plus a periodic re-scan of stored URLs against newly flagged domains.",
        why: "A shortener launders its destination, so it is a phishing delivery mechanism unless something inspects what it points at. Create time is the only moment you have full control, because after that the link is in the wild and removal is best effort.",
        numbers: [
          "one call per create, ~1.2k/s",
          "re-scan catches domains flagged after creation",
          "shorten p99 budget 200ms including this hop",
        ],
        breaks:
          "When the validator is unavailable, shorten requests block on it. Serve the cached verdict, flag the URL for re-check on recovery, and never let this dependency touch the redirect path.",
        choice: {
          pick: "Synchronous check before the alias is issued, cached verdict as the fallback",
          instead: "Issue the alias immediately and scan asynchronously, relying on takedown afterwards.",
          decider:
            "How long a known-bad link is live. Synchronous adds one external dependency to a 1.2k/s path with a 200ms budget; asynchronous returns the link first and then needs a CDN purge to catch it, which is minutes of exposure plus a billed purge call per incident.",
          flips:
            "When the abuse rate is low and create latency is the product, where an interstitial preview page in front of poor-reputation destinations is a better trade than blocking on a third party.",
        },
      },
    },
    {
      id: "cache",
      label: "In-memory cache",
      sub: "Redis, 75 GB LRU, ~99% of origin reads",
      kind: "store",
      x: 400,
      y: 150,
      w: 260,
      detail: {
        what: "The hot alias to long_url working set in memory, LRU, positive TTL 1h and negative TTL 30s.",
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
      kind: "store",
      x: 400,
      y: 290,
      w: 260,
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
      id: "clicker",
      label: "Clicker",
      sub: "GET /{alias}, 120k/s, ~1M/s peak",
      kind: "external",
      x: 760,
      y: 0,
      w: 260,
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
      kind: "compute",
      x: 760,
      y: 110,
      w: 260,
      detail: {
        what: "The PoP network caching the redirect response itself, not the data behind it, and serving the large majority of clicks without your servers being involved.",
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
      id: "app",
      label: "Redirect handler",
      sub: "single-flight coalescing",
      kind: "compute",
      x: 760,
      y: 220,
      w: 260,
      detail: {
        what: "The origin tier resolving the 5% the edge missed: cache lookup, store read on miss, back-fill on the way out, then the redirect.",
        why: "It exists to be rare, so its job is not throughput but making sure a herd of identical misses becomes one read. A per-server map of alias to in-flight future means the second request for a cold alias waits on the first instead of issuing its own, and probabilistic early refresh within the last 10% of a TTL stops the herd re-forming at each expiry boundary.",
        numbers: [
          "~6k reads/s at a 95% edge hit rate",
          "~30ms from cache, ~80ms from the store",
          "200 servers turn 100k identical misses into 200 reads",
        ],
        breaks:
          "A viral link no edge has yet: 100k requests arrive across the fleet in one second, every one misses and every one issues the same point query for the same key. Without coalescing that is 100k identical reads landing on one partition.",
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
      id: "takedown",
      label: "Takedown control",
      sub: "410 Gone + explicit CDN purge",
      kind: "compute",
      x: 760,
      y: 330,
      w: 260,
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
      id: "cdn-logs",
      label: "CDN log stream",
      sub: "the ~95% origin never saw",
      kind: "compute",
      x: 760,
      y: 460,
      w: 260,
      detail: {
        what: "The CDN's own delivery logs, parsed into click events for every redirect that was answered at the edge.",
        why: "Caching the redirect at the edge is precisely what makes those clicks invisible to your servers, so counting has to move to where the request was actually answered. This is why the 60-second TTL is a click-counting granularity as well as a takedown SLA.",
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
      id: "kafka",
      label: "Click event log",
      sub: "Kafka, fire-and-forget",
      kind: "bus",
      x: 400,
      y: 460,
      w: 260,
      detail: {
        what: "A durable log taking one click event of about 200B per origin-served redirect, written fire-and-forget from the redirect handler.",
        why: "The redirect must never wait on analytics. At 1M clicks/s peak a synchronous warehouse write would either crush the warehouse or serialise every redirect behind it, so the producer does not wait for an acknowledgement and the pipeline is explicitly allowed to be down.",
        numbers: [
          "~200B per event: alias, ts, country, referrer, ua and ip hashes",
          "24 MB/s steady, 200 MB/s at peak",
          "delivery target 99.9%, against 99.99% on redirects",
        ],
        breaks:
          "A broker outage loses whatever overflows the bounded local ring buffer on each app server, and you cannot say how much, because the events that would have told you are the ones you lost.",
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
    {
      id: "warehouse",
      label: "Analytics warehouse",
      sub: "columnar, ~260 GB/day",
      kind: "store",
      x: 400,
      y: 580,
      w: 260,
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
      id: "e2",
      from: "write-api",
      to: "id-gen",
      label: "next id",
      detail: {
        what: "A request for a unique id, served from the server's leased block or generated locally by Snowflake.",
        why: "This hop is what removes the collision check from creation. If the id is unique by construction there is no read before the write, and the create path collapses to a single insert.",
        numbers: ["one counter round trip per 1000 ids"],
        breaks:
          "If this becomes a per-insert call to a central counter it is both the write ceiling and the single point of failure, which is the whole reason for leasing blocks.",
      },
    },
    {
      id: "e3",
      from: "write-api",
      to: "safety",
      label: "reputation check",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 70,
      detail: {
        what: "The destination URL sent to Safe Browsing and the internal blocklist before an alias is issued.",
        why: "Create time is the only point where you can refuse. Once the alias exists, stopping it means a takedown, a CDN purge and whatever exposure happened in between.",
        numbers: ["one call per create", "inside the 200ms shorten budget"],
        breaks:
          "This is a third-party dependency on your write path. When it is unavailable, shorten blocks unless you deliberately fall back to the cached verdict and queue a re-check.",
      },
    },
    {
      id: "e4",
      from: "write-api",
      to: "alias-store",
      label: "single insert",
      fromSide: "right",
      toSide: "left",
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
      fromSide: "right",
      toSide: "left",
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
      fromSide: "right",
      toSide: "right",
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
      to: "app",
      label: "miss, ~6k/s",
      animated: true,
      detail: {
        what: "The 5% of requests the edge cannot answer: cold aliases and entries whose 60-second TTL has just lapsed.",
        why: "The miss rate, not the miss latency, is the number to watch. A p99 of 100ms is met only because this path is rare, so a hit-rate regression is a latency incident rather than a cost one.",
        numbers: ["5% of 120k/s = ~6k/s", "alert if the hit rate drops below 90%"],
        breaks:
          "Synchronised TTL expiry sends every PoP back at the same instant for the hottest keys, which is why entries in the last 10% of their TTL are refreshed early by one request while the rest keep serving the old value.",
      },
    },
    {
      id: "e9",
      from: "app",
      to: "cache",
      label: "lookup",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The memory lookup for alias to long_url, including tombstones for known-missing aliases.",
        why: "It answers about 99% of what gets past the edge, at roughly 30ms end to end, which is the difference between meeting the p99 target and depending on the database for it.",
        numbers: ["~6k/s in", "~30ms served from here"],
        breaks:
          "Simultaneous misses for the same key would each issue their own store read, so the coalescing map has to sit in front of this call rather than behind it.",
      },
    },
    {
      id: "e10",
      from: "app",
      to: "alias-store",
      label: "miss, ~60/s",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The point read of last resort, one primary-key lookup on the hash-partitioned table.",
        why: "It is drawn thin on purpose: about 60 reads/s in steady state, and keeping it there is the justification for every layer above. This is also the path that costs about 80ms, so it is the only place the latency budget is at risk.",
        numbers: ["~60 reads/s", "~80ms end to end", "step-change alert on this rate"],
        breaks:
          "Distinct 404s bypass every protection above: they always miss and coalescing cannot merge them, so an enumeration scan lands here at full rate unless the misses are negatively cached.",
      },
    },
    {
      id: "e11",
      from: "alias-store",
      to: "cache",
      label: "back-fill on the way out",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 70,
      detail: {
        what: "The row written into the memory cache as the response passes back through the handler, and pushed to the edge with the redirect.",
        why: "It makes a cold alias a one-time cost. The second request for the same alias is already warm, which is what stops a slowly-warming viral link from paying the 80ms store path repeatedly.",
        numbers: ["positive TTL 1h", "negative entries cached for 30s"],
        breaks:
          "Caching a miss is the dangerous half. A tombstone TTL anywhere near the positive one would make a newly created alias 404 for its own creator.",
      },
    },
    {
      id: "e12",
      from: "app",
      to: "kafka",
      label: "click event, fire-and-forget",
      dashed: true,
      detail: {
        what: "One ~200B event per origin-served redirect, pushed onto the log without waiting for an acknowledgement.",
        why: "It is dashed because nothing on the redirect depends on it. The response is already on its way back to the client, so a broker outage costs analytics accuracy and never availability.",
        numbers: ["~6k events/s from origin", "~200B each"],
        breaks:
          "Fire-and-forget means the producer never learns about a failure. The bounded local ring buffer is the only thing between a broker outage and silent loss, and it is deliberately small.",
      },
    },
    {
      id: "e13",
      from: "cdn",
      to: "cdn-logs",
      label: "delivery logs",
      dashed: true,
      fromSide: "right",
      toSide: "right",
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
      id: "e14",
      from: "cdn-logs",
      to: "kafka",
      label: "edge clicks, batched",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Parsed log lines joined onto the same event stream the origin-served clicks use.",
        why: "Two sources have to converge before the warehouse, or stats would need to union a real-time stream against a lagging log dump on every query. Merging here keeps the read side simple.",
        numbers: ["about 95% of events arrive down this arrow"],
        breaks:
          "The two sources have different delays, so any window shorter than the log lag is systematically incomplete and a dashboard reading it will show a dip that is not real.",
      },
    },
    {
      id: "e15",
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
      id: "e16",
      from: "takedown",
      to: "cdn",
      label: "purge",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "An explicit purge call for the alias, invalidating it across PoPs rather than waiting out the TTL.",
        why: "Without it, a link flagged as phishing keeps redirecting from the edge for up to 60 more seconds, which is a live exploit rather than a stale cache. Purges are billed per call, so this is reserved for safety cases.",
        numbers: ["propagates in seconds", "alert above 30s propagation"],
        breaks:
          "It reaches the edge and nothing beyond it. A browser that cached a 301 is unreachable, and archives and link previewers already copied the destination.",
      },
    },
    {
      id: "e17",
      from: "takedown",
      to: "alias-store",
      label: "deleted_at, then 410",
      dashed: true,
      fromSide: "left",
      toSide: "right",
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
