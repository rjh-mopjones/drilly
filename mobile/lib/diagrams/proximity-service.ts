import type { Diagram } from "./types";

export const PROXIMITY_SERVICE: Diagram = {
  id: "proximity-service",
  title: "Proximity Service",
  question: "Design a Proximity Service (Yelp, Find Nearby)",
  sourceId: "patterns",
  itemId: 13,
  overview: {
    shape:
      "A two-phase filter over a file: a cheap prune turns a circle into cells, then an exact test runs only over what the block returned.",
    forces: [
      {
        constraint: "no storage engine has a near operator; distance over 200M rows is unattainable",
        decision: "manufacture a 1D cell key from lat/lng so a nearby search becomes an equality lookup on a few cells",
        lights: ["block", "geo-index"],
      },
      {
        constraint: "a circle never aligns to cell edges; a 1km radius over-fetches 3.6x against a 3.14km2 circle",
        decision: "read the whole covering block and filter cheaply inside it rather than trying to match the circle exactly",
        lights: ["block", "scan"],
      },
      {
        constraint: "match density spans 1000x, ~20 rural to ~22,000 in Midtown, for the identical query shape",
        decision: "make each wasted match cost nanoseconds: pack entries 48 bytes, keep the whole 10GB index memory-resident",
        lights: ["geo-index", "scan"],
      },
      {
        constraint: "coordinate writes run at 0.6/s against 60k reads/s, near 100,000:1",
        decision: "treat the index as derived, disposable state: built offline, diffed, canaried and swapped by pointer flip",
        lights: ["index-build", "artifact-store"],
      },
      {
        constraint: "a raw-coordinate cache key is unique per request, so the natural hit rate is near zero",
        decision: "key the result cache on the cell instead, collapsing millions of coordinates onto a few thousand hot keys",
        lights: ["result-cache", "e2"],
      },
    ],
    naive: {
      text: "A reader defaults to a bounding-box query against the transactional store, with a distance filter applied on top. That breaks at 200M rows and 120k/s of search traffic, since a row read is ~10µs and 22,000 matches is 220ms before ranking even starts. That alone blows the 200ms budget. The design replaces it with a derived, packed index: Geo index artifact holds 48-byte entries entirely in memory, so a match costs nanoseconds instead of a row read.",
      lights: ["geo-index", "catalogue"],
    },
    beats: [
      {
        text: "No storage engine has a near operator. You manufacture a one-dimensional key out of a latitude and a longitude. A nearby search becomes an equality lookup on a handful of cell ids, rather than a distance computation over 200M rows.",
        lights: ["block"],
      },
      {
        text: "That key is lossy in a specific way, and every remaining decision is a consequence of the loss. A circle never aligns to cell edges, so you read the whole block that covers the radius. At a 1km radius on 1.22km by 0.61km cells that is 3 by 5, fifteen cells: 11.2km2 against a 3.14km2 circle, a 3.6x over-fetch.",
        lights: ["block", "e4"],
      },
      {
        text: "Density is what makes the block dangerous. The same fifteen cells return about 22,000 matches in Midtown, 1,700 in a suburb and 20 in a rural county. That is a 1000x spread against a query that does not change, so the per-match cost is the number the whole design turns on.",
        lights: ["scan"],
      },
      {
        text: "Keeping that cost at about 5ns means the four stages of a search and the 10GB index are one process on one machine. The scan is a memory walk over packed 48-byte structs, and filtering and ranking happen inside it. Only the 20 rows you actually return are ever hydrated from the card store.",
        lights: ["serving-node", "search-svc", "geo-index"],
      },
      {
        text: "Businesses do not move. Coordinate changes run at 0.6/s against 60k searches/s, a ratio near 100,000:1. That makes the index derived, disposable state: built offline, checksummed, diffed, canaried and swapped in by pointer flip, with the day's moves carried in a small overlay map alongside.",
        lights: ["edit-stream", "overlay", "artifact-store", "index-build"],
      },
      {
        text: "The result cache is keyed on the cell rather than on raw coordinates, so everyone standing anywhere inside one cell shares one entry. That single key choice is what turns a key space with millions of distinct values into a few thousand hot ones. It takes 300k/s peak down to 120k/s at the index.",
        lights: ["result-cache", "e2"],
      },
    ],
    crux: {
      problem: "The query is a circle, the index is made of boxes, and population density across those boxes varies by three orders of magnitude.",
      handled: "You cannot make the boxes fit the circle, so you pay the over-fetch and make each wasted match cost nanoseconds instead of a row read.",
    },
    numbers: [
      {
        value: "~22,000 matches in a Midtown block, ~20 in a rural county",
        explain: "The same fixed query shape, fifteen cells at a 1km radius, returns wildly different match counts by density, which is why per-match cost is what the design optimises.",
      },
      {
        value: "48B packed entry, ~5ns to test, so a p99 scan is 110µs of a 200ms budget",
        explain: "Even the worst-case Midtown block costs a tiny fraction of the latency budget, because each match is a memory comparison rather than a row read.",
      },
      {
        value: "0.6 coordinate writes/s against 60k reads/s, near 100,000:1",
        explain: "The write rate is so far below the read rate that treating the index as a rebuilt file rather than a live structure costs almost nothing in freshness.",
      },
    ],
  },
  nodes: [
    // --- the read path: one node, one process, plus the state it maps -------
    {
      id: "client",
      label: "Client",
      sub: "lat, lng, radius, filters",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The phone or browser asking what is near a point, with a radius, an optional category and an open-now flag.",
        why: "It is a client rather than a third party: it runs our build, we ship it and we are paged for it. It is drawn because it supplies the two parameters that set the cost of everything downstream. The location picks the cell, and the radius picks the precision tier and therefore the size of the block scanned.",
        numbers: [
          { value: "1B MAU, 5 nearby searches per user per day", explain: "The user base and per-user search frequency that multiply out to the system's total daily search volume." },
          { value: "5B searches/day", explain: "The resulting daily volume, the top-level figure every downstream capacity number in this design is derived from." },
        ],
        breaks: {
          failure: "A client is free to ask for a 50km radius in Manhattan, which is 15.7M entries and 78ms of pure scan on one core.",
          handled: "Nothing about the client can be trusted to keep the query cheap, so the clamp runs server-side regardless of what the client requests.",
        },
      },
    },
    {
      id: "serving-node",
      label: "Serving node",
      kind: "zone",
      detail: {
        what: "One search machine: the stateless search binary, the 10GB index artifact memory-mapped from its local disk, and the overlay of coordinate changes made since that artifact was built.",
        why: "The frame is a co-residency claim, not a deployment one. The service and the artifact ship on completely different pipelines: a normal binary rollout for one, a canaried pointer flip for the other. But they have to sit in the same address space. Phase one is a walk over up to 22,000 packed entries, and the moment a match costs a network round trip the two-phase filter stops paying for itself. The design collapses back into a per-match fetch at that point.",
        numbers: [
          { value: "10GB artifact, memory-resident on every node", explain: "The full index size, small enough to fit in RAM on every serving node rather than needing to be sharded." },
          { value: "~50k overlay entries per day", explain: "The daily coordinate-change volume the overlay has to hold alongside the immutable artifact, tiny next to the index itself." },
          { value: "match cost ~5ns in-process", explain: "The per-entry test cost that makes even a worst-case scan cheap, achievable only because the match never leaves memory." },
        ],
        breaks: {
          failure: "The artifact is global, so a bad build is a global search outage rather than a partial one.",
          handled: "Every node holds the whole world rather than a shard of it. Canary promotion and keeping the previous artifact resident on local disk are what bound that.",
        },
        choice: {
          pick: "A packed read-only artifact memory-mapped into every serving node",
          instead: "A shared remote index tier, for example Redis sorted sets holding cell members.",
          decider:
            "Cost per match. A packed 48-byte entry tests in ~5ns in-process, so 22,000 of them is 110µs. A general-purpose sorted set costs closer to 80B per member (16GB rather than 10GB) and every cell probe becomes a network hop. At 15 probes per query and 120k/s that is the whole budget, spent on transport.",
          flips: "When the index no longer fits in a node's RAM, or when it is mutated constantly rather than rebuilt, at which point a shared write-absorbing tier is the only option.",
        },
      },
    },
    {
      id: "search-svc",
      label: "Search service",
      kind: "serviceGroup",
      col: 1,
      row: 0,
      parent: "serving-node",
      detail: {
        what: "One stateless deployable that runs the whole request: validate and clamp, encode the cell and compute the block, scan the matches, then rank and hydrate.",
        why: "The hot path is a single function internally: tier, then cells_covering, then the comprehension, then nlargest, then mget. Drawing those four stages as peer services would claim an independence that does not exist. They deploy together, scale on the same signal, and each stage exists only to make the next one affordable. Splitting them would also put a network hop where the design has budgeted 5ns.",
        numbers: [
          { value: "60k/s average, 300k/s peak", explain: "The request rate this deployable is provisioned against, five times higher at peak than average." },
          { value: "~120k/s reaches the scan after the cache", explain: "The result cache absorbs most traffic, so only a fraction of requests ever reach the expensive scan stage." },
          { value: "~5ms server time, 200ms p99 budget", explain: "The actual work done here is a small fraction of the total latency budget, leaving room for network and hydration." },
        ],
        breaks: {
          failure: "Being stateless is what makes it disposable, but it holds a 10GB mapping, so a node is not cheap to start.",
          handled: "It has to fetch or open the artifact and warm it before it can serve. Autoscaling on a traffic spike is minutes, not seconds, so the fleet is sized for peak rather than scaled into it.",
        },
        choice: {
          pick: "One stateless deployable running validate, block, scan and rank as in-process stages",
          instead: "Four separate services on the request path: validate, cell-encode, scan, rank.",
          decider:
            "Cost per match. A packed match tests in ~5ns in-process. Splitting these four stages into services would put a network hop between the scan and the rank, at exactly the point the design has budgeted 5ns per match. That hop repeats for however many hundreds of matches a query touches.",
          flips: "If one stage needed meaningfully different hardware, for example the rank stage moving onto a GPU-scored model, at which point the extra hop would be worth paying for independent scaling.",
        },
      },
    },
    {
      id: "clamp",
      label: "Validate + clamp radius",
      sub: "3 tiers, hard cap 25km",
      kind: "process",
      col: 1,
      row: 0,
      parent: "search-svc",
      detail: {
        what: "The entry stage: validate the point, clamp the radius into one of three buckets, and build the cache key. It probes the result cache, and on a miss drives the rest of the request.",
        why: "Radius is the one client-supplied parameter whose cost grows with area, so it has to be bucketed before it reaches the index rather than honoured exactly. Bucketing is also what makes the cache key finite: a continuous radius would give every request its own key and a hit rate near zero.",
        numbers: [
          { value: "3 tiers: 5km, 1km, 200m", explain: "The fixed precision buckets every client radius is rounded into, chosen so the cache key space stays finite." },
          { value: "hard cap 25km", explain: "The maximum radius honoured at all; anything wider is refused rather than scanned at unbounded cost." },
          { value: "~60% of requests end here on a cache hit", explain: "The majority of traffic never reaches the expensive block scan at all, answered straight from the result cache." },
        ],
        breaks: {
          failure: "Clamping means the API does not do quite what the caller asked for.",
          handled: "A genuinely wide search is served from the coarse tier and a 30km search is refused outright. Both have to be documented rather than hidden from callers.",
        },
        choice: {
          pick: "Clamp radius into three precision buckets, hard cap at 25km",
          instead: "Honour an arbitrary client radius and pick precision continuously.",
          decider:
            "Scan cost grows with area. A 50km radius in a dense metro covers 7,850km2 and scans 15.7M entries at 5ns, which is 78ms on one core and unsurvivable at 120k/s. Three buckets also bound the cache key space, which is what keeps the blended hit rate at 60%.",
          flips: "A catalogue small enough that even a continent-wide scan is cheap, where clamping only costs you accuracy and buys nothing measurable back.",
        },
      },
    },
    {
      id: "block",
      label: "Cell encode + block",
      sub: "geohash L6, 3 x 5 = 15 cells",
      kind: "process",
      col: 1,
      row: 1,
      parent: "search-svc",
      detail: {
        what: "Encodes the user's coordinates to a cell id at the tier matching the clamped radius, then computes the block of cells that covers the circle from anywhere inside that cell.",
        why: "This is where the two-dimensional query becomes one-dimensional. The general form is (2*ceil(r/w) + 1) x (2*ceil(r/h) + 1) for cells of width w and height h, and getting it wrong is a correctness bug that never throws.",
        numbers: [
          { value: "geohash L5 4.9km, L6 1.22km x 0.61km, L7 153m", explain: "The precision tiers this encoding produces at each geohash length, the raw material the radius clamp maps onto." },
          { value: "1km radius at L6: 3 x 5 = 15 cells", explain: "The covering block one typical query produces, the number of range probes issued into the index." },
          { value: "block 11.2km2 vs a 3.14km2 circle, 3.6x over-fetch", explain: "The area cost of covering a circle with a rectangular grid at this precision tier." },
        ],
        breaks: {
          failure: "The folk rule of cell plus eight neighbours is only right when the cell is at least as large as the radius in both dimensions. Geohash cells are 2:1 at even lengths, so using 9 cells silently loses everything between 610m and 1km due north or south.",
          handled: "Cell arithmetic also wraps badly at 180 degrees longitude and degenerates near the poles. This stage special-cases the antimeridian and clamps latitude to 85 degrees to keep both bugs from ever reaching production.",
        },
        choice: {
          pick: "Geohash, compared on the shorter cell dimension",
          instead: "S2 cells on a Hilbert curve, or H3 hexagons.",
          decider:
            "For a static catalogue all three answer the same question and the choice barely moves the design, though teams routinely spend disproportionate time debating it anyway. Geohash string prefixes drop into any store; the cost is 2:1 cells at even lengths and distortion near the poles, both handled in this one stage.",
          flips: "S2 when you need hierarchical roll-ups across a genuinely global surface with sane polar behaviour. H3 when cells are demand buckets for moving entities and expanding by k rings has to be a uniform operation across all six neighbours.",
        },
      },
    },
    {
      id: "scan",
      label: "Block scan",
      sub: "bitmask + hours in the scan",
      kind: "process",
      col: 1,
      row: 2,
      parent: "search-svc",
      detail: {
        what: "Fifteen range probes into the memory-mapped artifact, streaming packed 48-byte entries and applying the category bitmask and the open-hours test as it goes. The overlay is consulted for moves and tombstones.",
        why: "Phase one has to be genuinely cheap or the two-phase split is not worth making. Filtering here rather than after a fetch is what keeps hydration at 20 rows instead of 22,000, and it is the single arithmetic comparison the whole design rests on.",
        numbers: [
          { value: "p99 22,000 entries at 5ns = 110µs", explain: "The worst-case scan cost in the densest markets, still a small fraction of the 200ms latency budget." },
          { value: "median 1,700 entries = 8.5µs", explain: "The typical scan cost for an ordinary suburban query, negligible against the rest of the request." },
          { value: "bitmask eliminates ~98% of them", explain: "98% eliminated leaves ~330 survivors at p99 (22,000 × 2%) — the population the haversine pass below runs its expensive exact test on." },
        ],
        breaks: {
          failure: "Only attributes that live in the 48-byte entry can be filtered here. The bitmask holds 64 category bits and the hours bitmap is a coarse approximation.",
          handled: "A filter that does not fit forces either a wider entry across 200M rows or a post-scan fetch, which reintroduces the 100x hydration cost this design exists to avoid.",
        },
        choice: {
          pick: "Filter and rank inside the scan over self-contained entries",
          instead: "An index of business ids only: fetch every match, then filter and rank.",
          decider:
            "Matches per query times backend QPS. Filtering first is 120k x 20 = 2.4M card reads/s; hydrating first is 120k x 2,000 mean matches = 240M reads/s, 100x more. A single Midtown query moves 22,000 x 2KB = 44MB. Break-even sits near 20 matches, roughly a 200m radius in a suburb.",
          flips: "When matches are naturally few, meaning a hard sub-500m radius cap in one non-dense market. Or when the filter set changes faster than you can rebuild, since denormalising a user-generated tag means a 10GB rebuild per tag.",
        },
      },
    },
    {
      id: "rank",
      label: "Haversine + rank",
      sub: "top 20, distance x rating",
      kind: "process",
      col: 1,
      row: 3,
      parent: "search-svc",
      detail: {
        what: "Phase two: exact haversine distance over the survivors of the scan, a blended distance-and-rating score, a partial sort for the top 20, then one hydration call and the cache fill.",
        why: "The block over-covers the circle by 3.6x, so somebody has to throw away the false positives, and it has to be the expensive exact test rather than the cheap one. Ranking runs on index fields, so quality ordering never needs a row read.",
        numbers: [
          { value: "~330 survivors at p99, 50ns each = 17µs", explain: "17µs is about 0.0085% of the 200ms budget — cheaper than the 110µs bitmask scan it follows, despite doing real trigonometry, not a bit test." },
          { value: "~90 inside 1km, top 20 returned", explain: "Most survivors of the exact test are outside the radius people actually care about, narrowing further before the final top-20 cut." },
        ],
        breaks: {
          failure: "Straight-line distance is not what people mean by near.",
          handled: "A place 800m away across a river with no crossing for 3km outranks one 1.2km away on the same block, and nothing in the index can know that. Isochrones cannot be baked into a static artifact at all.",
        },
        choice: {
          pick: "Blend distance and rating after the scan, cap the scan itself by distance",
          instead: "Truncate each cell to its local top-K by blended score during the scan.",
          decider:
            "A cell's local top-K is not the block's global top-K, because the 15 cells are scanned independently. In a cell holding 22,000 entries any truncation drops results someone wanted. The bias is real and bounded by the cap, measured against an uncapped shadow query rather than declared solved.",
          flips: "When the block is a single cell, where local and global top-K coincide. Or when the drop rate against the shadow query is genuinely zero and the cap can be removed.",
        },
      },
    },
    {
      id: "geo-index",
      label: "Geo index artifact",
      sub: "48B x 200M, 10GB mmap",
      kind: "cache",
      col: 1,
      row: 1,
      parent: "serving-node",
      detail: {
        what: "A packed, read-only array of 48-byte entries sorted by cell id: business id, coordinates, cell id, category bitmask, rating, popularity and an open-hours bitmap, memory-mapped from local disk.",
        why: "It is a cache rather than a store because losing it costs nothing but a warm-up. The catalogue is the record, and this file is derived from it, checksummed and re-downloadable. Everything needed to filter and rank lives here, which is why hydration is 20 rows rather than 22,000. Being an immutable sorted array rather than a mutable structure is what makes a probe an array offset instead of a tree walk.",
        numbers: [
          { value: "200M x 48B = ~10GB", explain: "The full population times the packed entry size, small enough to memory-map on every serving node." },
          { value: "15 range probes per query", explain: "These 15 cells over-cover the query circle by ~3.6x — that padding is exactly what the bitmask and haversine passes downstream exist to filter out." },
          { value: "matches 20 to 22,000, a 1000x spread", explain: "The density spread across markets that the per-match cost, not the match count, has to absorb." },
        ],
        breaks: {
          failure: "Denormalised attributes drift.",
          handled: "Rating and popularity change continuously in the catalogue, so between builds the index ranks on stale values. Those fields are rebuilt on a faster cadence than the geometry for that reason.",
        },
        choice: {
          pick: "A uniform cell grid at three precision tiers, with a per-cell match cap as a backstop",
          instead: "Adaptive subdivision: a quadtree whose leaves hold at most k places, bounding matches by construction.",
          decider:
            "The cost of a single match, not the number of them. Both pay the same boundary tax. The grid's match count spans 20 to 22,000, but a packed 48-byte entry tests in ~5ns so p99 scan is 110µs against a 200ms budget, 0.06%. A 1000x spread on a term worth 0.06% is not worth a tree.",
          flips: "When a match costs a row read rather than an array probe, since 22,000 reads at 10µs is 220ms on its own. Also when radius is absent so precision cannot be bucketed and you need a real k-nearest-neighbour walk, or when the cap is measurably dropping wanted results.",
        },
      },
    },
    {
      id: "overlay",
      label: "Coordinate overlay",
      sub: "moves + tombstones, ~50k",
      kind: "cache",
      col: 1,
      row: 2,
      parent: "serving-node",
      detail: {
        what: "A per-node in-memory hash map of business id to new cell id for coordinate changes since the last build, plus a tombstone set filtered during the scan. Rebuilt by replaying the stream, never persisted.",
        why: "It is what makes an immutable artifact acceptable. Without it, freshness for a moved or deleted business is a whole build cycle, and you would be tempted into a live index for a write rate of 0.6/s.",
        numbers: [
          { value: "~50k coordinate changes/day", explain: "The daily volume this overlay has to hold, small enough to keep entirely in memory alongside the artifact." },
          { value: "0.6 writes/s", explain: "The same daily volume expressed as a steady rate, vanishingly small against the 60k reads/s it sits beside." },
          { value: "consulted once per match", explain: "The overlay is checked for every entry the scan touches, so its cost is paid per match rather than once per query." },
        ],
        breaks: {
          failure: "It grows until the next build lands, so a stalled build turns a trivial map into an unbounded one.",
          handled: "Overlay size is the leading indicator that index freshness lag is about to become a real problem. A business that moved also has to be suppressed at its old cell as well as added at its new one, or it appears twice.",
        },
        choice: {
          pick: "An in-memory overlay map consulted alongside the artifact",
          instead: "Rebuild and promote on every coordinate edit, or patch the artifact in place.",
          decider:
            "Volume against build time. 50k coordinate changes a day is 0.6/s, so the overlay never exceeds ~50k entries and costs nothing to hold. A build is 5 to 10 minutes and cannot chase individual edits. Patching a memory-mapped sorted array in place is not a thing you want to be doing.",
          flips: "When coordinate writes exceed roughly 1% of reads or freshness must be under a minute, both of which flip the moment the entities move rather than being edited.",
        },
      },
    },

    // --- shared tiers outside the node -------------------------------------
    {
      id: "result-cache",
      label: "Result cache",
      sub: "keyed on cell, 60s jittered",
      kind: "cache",
      col: 2,
      row: 0,
      detail: {
        what: "A short-TTL shared cache of whole result pages, keyed on (cell, category, radius bucket, page) rather than on the raw coordinates that produced them.",
        why: "Everyone standing anywhere inside one cell shares an entry, which is the difference between a key space with millions of distinct values and one with a few thousand hot ones. It is the reason peak backend load is 120k/s and not 300k/s, and losing the whole tier is a load problem rather than a correctness one.",
        numbers: [
          { value: "~70% hit on the top 1,000 cells", explain: "The hit rate concentrated in the busiest cells, where the key-collapsing effect matters most." },
          { value: "those cells carry ~40% of traffic", explain: "A small number of hot cells account for a disproportionate share of total query volume." },
          { value: "~60% blended, TTL jittered 50-70s", explain: "The overall hit rate once cold, rarely-queried cells are averaged in, still enough to cut peak backend load significantly." },
        ],
        breaks: {
          failure: "Invalidation is best-effort and sometimes wrong, so the TTL is the real mechanism.",
          handled: "Every expiry on a hot cell also sends thousands of concurrent identical misses at the index, which is why single-flight per key and jitter are not optional.",
        },
        choice: {
          pick: "Key on (cell, category, radius bucket, page) with a 60s jittered TTL",
          instead: "Key on the raw lat/lng of the request, or do not cache results at all.",
          decider:
            "Distinct keys. Raw coordinates are effectively unique per request, so the hit rate is near zero. The cell collapses them onto a few thousand hot keys and reaches 70% on the top 1,000, blending to 60% overall. That is 180k/s of peak traffic that never reaches the index.",
          flips: "Moving entities, where a result is stale before the response lands and caching is meaningless. And open-now queries, whose answer depends on the current hour, so the key is incomplete without an hour bucket.",
        },
      },
    },
    {
      id: "card-store",
      label: "Card store",
      sub: "in-memory KV, ~300B a place",
      kind: "cache",
      col: 3,
      row: 1,
      detail: {
        what: "A sharded in-memory key-value tier holding the display projection: name, rating, review count, category, thumbnail reference and short address.",
        why: "Hydration is the last step and touches only what is returned, so it is one 20-key multi-get per query. Keeping a slim projection separate from the 2KB transactional row is what makes that read cheap enough to sit on the hot path. It is a cache rather than a store because the same build pass regenerates it from the catalogue.",
        numbers: [
          { value: "200M x 300B = ~60GB", explain: "The full projection size across every business, small enough to shard comfortably across an in-memory tier." },
          { value: "120k multi-gets of 20 keys/s", explain: "The request rate this tier serves at, one batched read per search request that reaches this stage." },
          { value: "2.4M card reads/s at peak", explain: "The individual key read rate once multi-gets are broken down, the figure that actually sizes the tier's shard count." },
        ],
        breaks: {
          failure: "A partial or slow multi-get degrades the whole page.",
          handled: "The fallback is to serve what the index entry already holds, so the card drops to name and rating rather than the request failing.",
        },
        choice: {
          pick: "A dedicated in-memory KV tier holding a 300B projection",
          instead: "Hydrate the full 2KB record straight from the transactional catalogue.",
          decider:
            "Read rate and payload. 2.4M card reads/s against a 400GB transactional store is not a workload it will serve at single-digit milliseconds. The full record is also 7x the bytes for fields nothing on the result page renders. 60GB of projection shards comfortably across RAM.",
          flips: "Low query rates, where the extra tier is one more thing to keep in sync for no measurable latency gain and the catalogue can simply serve the reads.",
        },
      },
    },

    // --- the derive-and-release path ---------------------------------------
    {
      id: "artifact-store",
      label: "Artifact store",
      sub: "versioned files, N-1 kept",
      kind: "blob",
      col: 2,
      row: 1,
      detail: {
        what: "Object storage holding each build as an immutable versioned file: the 10GB index artifact and the 60GB card set, with the previous version retained and distributed to every region.",
        why: "It is what makes the index a release rather than a write. Regions pull a file instead of talking to a central index tier, so there is no cross-region index traffic. A node recovering is a copy from local disk or the bucket, not a rebuild. Rollback needs the previous artifact to already exist somewhere durable.",
        numbers: [
          { value: "10GB index + 60GB cards per build cycle", explain: "The total artifact size published on every build, small enough to distribute globally without meaningful lag." },
          { value: "N-1 versions retained", explain: "The previous version is always kept alongside the current one, so a rollback never depends on a rebuild." },
          { value: "1 file pulled per node, not per request", explain: "Distribution cost is paid once per node per build, not per query, which is what keeps the read path free of cross-region traffic." },
        ],
        breaks: {
          failure: "If distribution stalls, nodes serve whatever they already have and nothing looks broken.",
          handled: "Search still answers, just from a stale world, so artifact age across the fleet has to be a monitored number rather than an assumption.",
        },
        choice: {
          pick: "Publish immutable versioned artifacts to object storage and pull them per node",
          instead: "Push deltas to serving nodes over RPC, or have nodes patch what they hold.",
          decider:
            "Rollback time. A pointer flip back to a file already resident on local disk is seconds. Unwinding a stream of applied deltas is a rebuild, and at 5 to 10 minutes per build that is the outage. Immutability is also the only thing that lets you diff two versions before either is exposed.",
          flips: "When the index is mutated continuously rather than rebuilt, at which point there is no version to publish and no diff to take.",
        },
      },
    },
    {
      id: "edit-stream",
      label: "Edit stream",
      sub: "0.6 moves/s, fan-out to nodes",
      kind: "queue",
      col: 3,
      row: 2,
      detail: {
        what: "The ordered log of catalogue changes that matter between builds: coordinate moves and deletions fanned out to every serving node's overlay. Cell-prefix invalidation messages are fanned out to the result cache.",
        why: "It exists because two different derived stores have to hear about the same edit, and neither can poll 200M rows. It is also the only place bulk edits can be rate-limited. A chain updating 3,000 locations is one producer, and throttling it here is what stops it becoming a cache-wide event.",
        numbers: [
          { value: "50k of 10M daily edits carry a coordinate", explain: "Only a small fraction of total catalogue edits actually change a coordinate, which is why the overlay stays small." },
          { value: "0.6/s against 60k reads/s", explain: "The write rate expressed against the read rate, the ratio that makes an offline-built index acceptable." },
          { value: "1 broadcast stream reaches every serving node", explain: "A single log fans out identically to the whole fleet, avoiding any per-node coordination or targeted delivery logic." },
        ],
        breaks: {
          failure: "If the stream stalls, the overlay silently stops growing and search keeps returning confidently stale locations, with no error anywhere.",
          handled: "Overlay size and stream lag are monitored as freshness indicators rather than assumed healthy, since nothing else would ever surface a stalled stream.",
        },
        choice: {
          pick: "One ordered stream, fanned out to every node overlay and to the cache",
          instead: "Invalidate synchronously on the catalogue write, or have nodes poll the catalogue for changes.",
          decider:
            "Fan-out against write rate. 0.6 coordinate writes/s against a fleet that all need the same message makes a broadcast log trivial. A synchronous fan-out on the write path is absurd by comparison: a catalogue commit would block on every serving node. Polling 400GB for 50k daily changes is the same cost with worse latency.",
          flips: "A single-node deployment, where there is nobody to fan out to and the index can simply be updated in place.",
        },
      },
    },
    {
      id: "index-build",
      label: "Index build + release",
      kind: "serviceGroup",
      col: 2,
      row: 4,
      detail: {
        what: "The offline pipeline that turns the catalogue into a released artifact: map and sort, then validate against the outgoing version, then promote by canary.",
        why: "Because the entities are static, the index is a file you release rather than a structure you mutate, and a release has stages a write does not. You can replay a recorded query corpus against two versions and compare result sets before anyone sees the new one. The three stages are one job on one schedule, which is why they are one deployable rather than three.",
        numbers: [
          { value: "build is 5 to 10 minutes on a modest cluster", explain: "The end-to-end time from starting a build to having a validated, publishable artifact, fast enough for a rebuild to be routine." },
          { value: "one scheduled run, plus on demand", explain: "Builds run on a regular schedule by default, with the option to trigger one manually when a problem needs a faster fix." },
          { value: "an ordinary response: same 5 to 10 min as any build", explain: "Fixing a bad coordinate or a suspected data issue costs the same as any scheduled build, not a special slower recovery path." },
        ],
        breaks: {
          failure: "It is a batch job on a schedule, so its failure is silent by construction.",
          handled: "Nothing on the read path degrades. The fleet just keeps serving the previous artifact while the overlay grows underneath it, which is why build success itself has to be monitored.",
        },
        choice: {
          pick: "Build offline and swap a versioned immutable artifact",
          instead: "A live index written through on every business edit.",
          decider:
            "Coordinate writes against reads. 50k coordinate changes a day is 0.6/s against 60k reads/s, near 100,000:1. The day's changes fit in an overlay and a full rebuild is a scheduled job rather than an incident. A live index also cannot be diffed before it is exposed.",
          flips: "The moment the indexed entities move. A driver rewriting position every 4 seconds gives a write rate of fleet size divided by 4, and an offline build is meaningless against it.",
        },
      },
    },
    {
      id: "build-promote",
      label: "Canary + pointer flip",
      sub: "canary, then pointer flip",
      kind: "process",
      col: 5,
      row: 0,
      parent: "index-build",
      detail: {
        what: "Promotion: publish the validated artifact, have one canary node memory-map it, warm it and flip its pointer, diff its live results against the outgoing version, then roll the fleet.",
        why: "Validation catches an artifact that is wrong on its own terms; only live traffic catches one that is wrong in a way the corpus did not cover. The flip is a pointer rather than a restart because the previous mapping has to stay resident for the rollback to be seconds.",
        numbers: [
          { value: "one canary node first", explain: "The first node to receive the new artifact, given real traffic before the rest of the fleet follows." },
          { value: "1 previous artifact stays resident on disk", explain: "The prior version is kept mapped and ready, so a rollback needs no rebuild or re-download." },
          { value: "rollback: 1 pointer flip", explain: "The entire cost of undoing a bad promotion, a single atomic operation rather than a rebuild or a restart." },
        ],
        breaks: {
          failure: "The fleet is briefly mixed during a roll, so two users in the same cell can get different results for a few minutes.",
          handled: "This is fine for a business catalogue, not fine for anything with a consistency requirement, which is why the flips case exists to name that boundary explicitly.",
        },
        choice: {
          pick: "Canary one node on live traffic, then roll the fleet node by node",
          instead: "A coordinated fleet-wide flip at an agreed timestamp.",
          decider:
            "What the mixed window costs. Here it is a few minutes of two users in one cell seeing slightly different result sets, for a catalogue that changes once a year per row. Nobody can detect that. A coordinated flip buys consistency you do not need and gives up the live canary diff, the only check that catches a subtly wrong ranking.",
          flips: "Anything with a real consistency requirement across the fleet, for example pricing or eligibility, where two answers in one cell is a defect rather than a rounding error.",
        },
      },
    },
    {
      id: "build-gate",
      label: "Checksum + corpus diff",
      sub: "1% band, corpus replay",
      kind: "process",
      col: 5,
      row: 1,
      parent: "index-build",
      detail: {
        what: "The gate: entry-count and per-region checksums against the previous artifact, then a replay of a recorded query corpus against both versions with the result sets compared within tolerance.",
        why: "A truncated artifact from a half-failed build looks exactly like a valid one, and there is no runtime error to catch it. The file opens, the probes work, the results are just missing. Comparing against the outgoing version is the only signal that exists.",
        numbers: [
          { value: "refuse promotion if entry count moves more than 1%", explain: "The tolerance band this gate enforces before a build can even be considered for promotion." },
          { value: "corpus replayed, 2 result sets compared within tolerance", explain: "A recorded set of real queries is run against both the old and new artifact, and their answers compared, before either is exposed to users." },
        ],
        breaks: {
          failure: "It is a diff against yesterday, so it cannot catch an error that has been present in every build.",
          handled: "A genuine 2% catalogue growth also trips it, which is deliberate. The band needs a human to look, not an automatic override.",
        },
      },
    },
    {
      id: "build-map",
      label: "Map + sort by cell id",
      sub: "400GB in, 10GB sorted out",
      kind: "process",
      col: 5,
      row: 2,
      parent: "index-build",
      detail: {
        what: "A map over the whole catalogue producing one packed 48-byte entry per place, sorted by cell id, plus the 300B display projection for the card set in the same pass.",
        why: "Both derived stores come out of one pass so they cannot disagree about which places exist. A card missing for an id the index still returns is a partially rendered result. Sorting by cell id is what makes a cell a contiguous range and therefore a probe rather than a seek per match.",
        numbers: [
          { value: "400GB mapped, 10GB sorted, 60GB of cards", explain: "The full pass over the transactional catalogue and the two derived artifacts it produces in the same run." },
          { value: "5 to 10 minutes", explain: "The time this pass takes end to end, fast enough that a rebuild is routine rather than exceptional." },
        ],
        breaks: {
          failure: "Rebuild time is the floor on how fast a bad coordinate can be removed from search.",
          handled: "It is a latency number rather than a batch-job detail. Ten minutes is what makes rebuild an ordinary response instead of an outage.",
        },
      },
    },
    {
      id: "catalogue",
      label: "Business catalogue",
      sub: "transactional, ~2KB rows, 400GB",
      kind: "database",
      col: 1,
      row: 3,
      detail: {
        what: "The transactional source of truth: the full record per place, including name, hours, address, photos and description. Never on the search path.",
        why: "Both the index and the card store are derived from it and can be regenerated from it. That is the property that makes a bad artifact a rollback rather than data loss. Keeping it off the read path is deliberate, not incidental.",
        numbers: [
          { value: "200M places x ~2KB = ~400GB", explain: "The full catalogue size, the source every derived store is built from." },
          { value: "~10M catalogue edits/day, ~120 writes/s", explain: "The steady write rate this transactional store handles, tiny compared to the read volume the derived stores absorb instead." },
          { value: "under 0.5% of edits move a coordinate", explain: "Most catalogue edits touch fields other than location, which is why the overlay stays so small relative to total edit volume." },
        ],
        breaks: {
          failure: "It is the only durable copy of anything here, so its RPO is the system's RPO.",
          handled: "Everything else is minutes of rebuild away. This is the one box where losing data actually means losing data.",
        },
        choice: {
          pick: "Keep the transactional store off the search path entirely",
          instead: "Push the geometry into the store that already holds the rows and answer search there with a bounding-box index.",
          decider:
            "What a match costs when the index and the store are the same system. A row read is ~10µs, so 22,000 matches is 220ms and blows a 200ms budget before ranking, and per-node throughput drops by roughly an order of magnitude.",
          flips: "Polygon and drive-time queries, which radius search cannot express at all. Those route to this store's bounding-box index instead, at maybe thousands of QPS per node, which is fine because they are operator-facing and rare.",
        },
      },
    },
    {
      id: "ingest",
      label: "Catalogue ingest",
      sub: "coordinate sanity at write",
      kind: "service",
      col: 0,
      row: 3,
      detail: {
        what: "The write path into the catalogue: business creates, edits and deletes, with coordinate sanity checks and quarantine before anything is committed.",
        why: "It is drawn because it owns a failure nothing downstream can fix. A malformed or spoofed coordinate is not rejected by anything later in the pipeline, it is simply indexed. The build maps it, the checksum accepts it, the scan returns it, and the only way out is a rebuild. Validation has to happen at the one point before the data becomes derived.",
        numbers: [
          { value: "~10M edits/day, ~120 writes/s", explain: "The full write volume into the catalogue, the baseline this validation stage has to check without becoming the bottleneck." },
          { value: "under 0.5% move a coordinate", explain: "The small share of edits that actually need the coordinate sanity check applied, though every edit passes through this stage." },
          { value: "a bad coordinate costs a 5 to 10 minute rebuild", explain: "One bounds check here costs nothing against 120 writes/s; skip it and only a full 200M-row, 5-10 minute rebuild removes the bad coordinate." },
        ],
        breaks: {
          failure: "Sanity checks catch coordinates in the ocean, not coordinates two streets away, so deliberate low-grade spoofing gets through.",
          handled: "The second net is a per-cell entry-count anomaly on the build side, which notices a cell that suddenly gained a thousand places.",
        },
        choice: {
          pick: "Validate and quarantine coordinates at write time",
          instead: "Accept anything and filter suspect entries during the build or at query time.",
          decider:
            "Where the cost lands. Rejecting at write is one bounds check on 120 writes/s. Filtering at build is a rule applied to 200M rows every cycle, and filtering at query time is per-match work on a path budgeted at 5ns. The asymmetry is 120/s against 2.4M/s.",
          flips: "Bulk imports from a partner feed, where rejecting a row at write means rejecting the whole file, and quarantine plus reconciliation is the only workable shape.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "clamp",
      label: "search query",
      tier: "hot",
      step: 1,
      detail: {
        what: "The search request: a point, a radius in kilometres, an optional category and an open-now flag.",
        why: "Everything about the cost of this query is decided by two of these fields. The point selects the cell and the radius selects the precision tier, which together fix how many matches the scan will touch.",
        numbers: [
          { value: "5B searches/day", explain: "The total daily volume this arrow carries in aggregate across the whole user base." },
          { value: "60k/s average, 300k/s peak", explain: "The request rate range this arrow has to sustain, five times higher at peak than average." },
        ],
        breaks: {
          failure: "The radius arrives untrusted. One client asking for 50km in a dense metro is 15.7M entries scanned.",
          handled: "Validation here is a capacity control rather than input hygiene, so the clamp runs on every request regardless of what the client claims to need.",
        },
      },
    },
    {
      id: "e2",
      from: "clamp",
      to: "result-cache",
      tier: "hot",
      step: 2,
      label: "probe, then fill on miss",
      detail: {
        what: "A lookup on (cell, category, radius bucket, page), and on a miss the write-back of the finished page with a jittered 60-second TTL.",
        why: "Sixty percent of queries end at this arrow. Because the key is the cell rather than the coordinates, the thousand people searching coffee in Times Square at noon all collapse onto one entry rather than a thousand.",
        numbers: [
          { value: "~60% blended hit rate", explain: "The overall share of queries this cache answers without ever reaching the index, averaged across hot and cold cells." },
          { value: "TTL jittered 50-70s", explain: "The randomised expiry window that spreads cache misses out in time instead of letting them all land in the same instant." },
        ],
        breaks: {
          failure: "Every expiry on a hot cell sends thousands of concurrent identical misses at the index.",
          handled: "This needs single-flight per key, or the TTL boundary becomes a self-inflicted thundering herd every time a popular cell's entry expires.",
        },
      },
    },
    {
      id: "e3",
      from: "clamp",
      to: "block",
      tier: "hot",
      step: 3,
      label: "cache miss, ~120k/s",
      detail: {
        what: "The 40% of queries the cache did not answer, carrying a clamped radius and a validated point, handed to the next stage in the same process.",
        why: "The radius is already bucketed by the time it gets here, so the planner only has to map a bucket to a precision tier rather than reason about arbitrary values. That is what keeps three tiers sufficient.",
        numbers: [
          { value: "300k/s peak x (1 - 0.6) = ~120k/s", explain: "The traffic that survives the result cache and actually reaches the expensive scan stage, at peak load." },
          { value: "0 network hops: a function call", explain: "This hand-off happens entirely in-process, with none of the latency a service boundary would add." },
        ],
        breaks: {
          failure: "If the cache hit rate collapses, for example after a bulk edit triggers cell-prefix invalidation, this arrow instantly carries 300k/s.",
          handled: "The index tier is sized for 120k/s, so a hit-rate collapse is a real capacity event that has to be watched for, not an assumption baked into sizing.",
        },
      },
    },
    {
      id: "e4",
      from: "block",
      to: "scan",
      tier: "hot",
      step: 4,
      label: "15 cell ids",
      detail: {
        what: "The covering block: the list of cell ids whose union contains the requested circle from anywhere inside the centre cell.",
        why: "This is the moment the query stops being geometry and becomes a set of integer keys, which is the entire point of manufacturing a cell id in the first place.",
        numbers: [
          { value: "3 x 5 = 15 cells at a 1km radius", explain: "The covering block size at this radius and precision tier, the number of range probes one query issues." },
          { value: "3.6x more area than the circle", explain: "The over-fetch this block accepts, unavoidable since a rectangular grid can never exactly tile a circle." },
        ],
        breaks: {
          failure: "Too coarse a tier and this is 9 cells covering 215km2, a 68x over-fetch and 430,000 entries.",
          handled: "Too fine and it is 225 cells, no longer contiguous in cell order, so you pay 225 probes instead of 15; the three-tier bucketing avoids both extremes.",
        },
      },
    },
    {
      id: "e5",
      from: "scan",
      to: "rank",
      tier: "hot",
      step: 6,
      label: "~330 survivors at p99",
      detail: {
        what: "Entries that passed the category bitmask and the open-hours test, handed to the exact distance pass.",
        why: "The cheap approximate phase has already discarded about 98% of the block, so the expensive exact test runs over hundreds rather than tens of thousands. That ratio is what makes a two-phase filter worth building at all.",
        numbers: [
          { value: "22,000 matches in, ~330 out", explain: "The reduction the cheap bitmask and hours filter buys before the expensive exact distance test has to run." },
          { value: "~90 of those inside 1km", explain: "How many of the survivors are actually within the requested radius, narrowing further before the final top-20 selection." },
        ],
        breaks: {
          failure: "Anything the bitmask cannot express leaks past this arrow and has to be evaluated on a hydrated record.",
          handled: "That is exactly the 100x cost the design is built to avoid, so filter attributes are deliberately kept to what fits in the packed 48-byte entry.",
        },
      },
    },
    {
      id: "e6",
      from: "scan",
      to: "geo-index",
      tier: "hot",
      step: 5,
      label: "15 range probes",
      detail: {
        what: "Fifteen range reads into the sorted packed array, one per cell id in the block, returning every entry filed under those cells.",
        why: "Entries are sorted by cell id, so a cell is a contiguous range rather than a scattered set of rows. The mapping is local, so this is a memory walk rather than a network call. Both properties are why a match costs 5ns.",
        numbers: [
          { value: "p99 ~22,000 entries returned", explain: "The worst-case volume this arrow carries in the densest markets, the figure the whole scan-cost budget is built around." },
          { value: "48B each, ~5ns to test", explain: "The per-entry size and per-entry test cost that together make even a 22,000-entry scan cheap." },
          { value: "110µs at p99, 8.5µs at the median", explain: "The end-to-end cost of this scan at worst case and typical case, both a tiny fraction of the 200ms budget." },
        ],
        breaks: {
          failure: "The first probe after a promotion touches cold pages, so a freshly flipped node runs slow until the mapping is warm.",
          handled: "Warming before the flip is part of promotion for that reason, so a node never serves live traffic against cold, unmapped memory.",
        },
      },
    },
    {
      id: "e7",
      from: "scan",
      to: "overlay",
      fromSide: "left",
      toSide: "left",
      tier: "data",
      label: "moves + tombstones",
      detail: {
        what: "The overlay consulted alongside the artifact: businesses whose coordinates changed since the build, and deletions filtered out during the scan.",
        why: "It is what stops index freshness being a whole build cycle. At 0.6 coordinate writes a second the correction set is tiny, so correctness costs a hash probe per match rather than a different architecture.",
        numbers: [
          { value: "~50k entries", explain: "The typical size of this per-node overlay, small enough to check on every match without meaningfully adding latency." },
          { value: "checked once per match", explain: "The overlay lookup happens for every entry the scan touches, not just for ones that already look suspicious." },
        ],
        breaks: {
          failure: "A business that moved has to be suppressed at its old cell as well as added at its new one.",
          handled: "Otherwise the same place appears twice in one result set, so the overlay carries both a tombstone for the old location and an entry for the new one.",
        },
      },
    },
    {
      id: "e8",
      from: "rank",
      to: "card-store",
      tier: "hot",
      step: 7,
      label: "20-key multi-get",
      detail: {
        what: "One batched read for the display projections of the twenty places actually being returned.",
        why: "Hydration happens after ranking, never before. Fetching first would be 240M reads/s at peak and 44MB of wire traffic for a single Midtown query, against 2.4M reads/s and a few kilobytes doing it this way.",
        numbers: [
          { value: "20 keys per query", explain: "The fixed size of this batched read, exactly matching the top-20 results the query actually returns." },
          { value: "2.4M card reads/s at peak", explain: "The individual key read rate this tier serves at peak, driven directly by the 120k/s of queries reaching this stage." },
        ],
        breaks: {
          failure: "Fan-out above 20 means filtering has leaked out of the index.",
          handled: "That metric is the first thing to check when p99 moves, ahead of the scan itself. A wider multi-get almost always traces back to a filter that should have run earlier.",
        },
      },
    },
    {
      id: "e9",
      from: "rank",
      to: "client",
      label: "top 20 results",
      tier: "hot",
      step: 8,
      detail: {
        what: "The ranked page returned to the caller: twenty places with distance, rating and a next-page token.",
        why: "Almost all of the few milliseconds spent here is the two network hops, not the geometry. The scan and the haversine together are about 130µs, which is the payoff for making phase one a walk over packed structs.",
        numbers: [
          { value: "~5ms server time", explain: "The actual compute time spent producing this response, small next to the network round trips around it." },
          { value: "200ms p99 budget", explain: "The full latency target this response is held to, most of which is network rather than server work." },
        ],
        breaks: {
          failure: "The distance shown is straight-line, and it is labelled as distance rather than travel time on purpose.",
          handled: "Waterfronts, cities cut by rail and anywhere with elevation are where users notice the difference, and the label is the honest way to surface that limitation rather than hide it.",
        },
      },
    },
    {
      id: "e10",
      from: "artifact-store",
      to: "geo-index",
      tier: "control",
      label: "mmap + pointer flip",
      detail: {
        what: "A node pulling the current artifact version to local disk, memory-mapping it, warming it and flipping its pointer to the new mapping.",
        why: "This is the only way new geometry reaches a serving node, and it is a file operation rather than a write. That is what makes rollback a pointer flip back to a mapping that is still open, rather than a rebuild.",
        numbers: [
          { value: "10GB per version", explain: "10GB × 2 (current plus the resident previous mapping below) is the real per-node footprint during a flip — small enough that keeping both costs nothing." },
          { value: "1 previous mapping stays resident", explain: "The prior artifact stays open in memory even after the flip, so a rollback needs no re-fetch." },
          { value: "flip touches 1 pointer per node, atomically", explain: "The entire promotion is a single atomic pointer swap per node, with no partial or torn state possible." },
        ],
        breaks: {
          failure: "The artifact is global, so a bad version promoted here is a global search outage rather than a partial one.",
          handled: "Nothing downstream of this arrow can detect that the geometry is wrong, only that it changed, which is why validation and canary happen before this arrow, never after.",
        },
      },
    },
    {
      id: "e11",
      from: "artifact-store",
      to: "card-store",
      tier: "control",
      label: "60GB card set",
      detail: {
        what: "The display projection from the same build pass, 60GB of 300-byte cards loaded across the in-memory shards.",
        why: "Both derived stores come out of one pass over the catalogue so they cannot disagree about which places exist. A card missing for an id the index still returns is a partially rendered result.",
        numbers: [
          { value: "200M x 300B = ~60GB", explain: "The full card set size produced by one build pass, distributed alongside the index artifact." },
          { value: "redistributed once per build cycle", explain: "Cards are pushed out on the same schedule as the index, not on a separate cadence." },
        ],
        breaks: {
          failure: "Cards and index entries land independently, so an id in the new artifact may have no card yet.",
          handled: "The result degrades to name and rating rather than failing, which is why hydration has a fallback at all for exactly this window.",
        },
      },
    },
    {
      id: "e12",
      from: "edit-stream",
      to: "overlay",
      tier: "control",
      label: "coordinate moves",
      detail: {
        what: "Coordinate changes and deletions fanned out to every serving node between builds, landing in the per-node overlay map and tombstone set.",
        why: "Under 0.5% of the 10M daily catalogue edits move a coordinate, so this is a trickle rather than a stream. Ratings and hours are not carried here; they are rebuilt on a faster cadence than the geometry because they are the fields that actually move.",
        numbers: [
          { value: "50k of 10M daily edits", explain: "The small share of total catalogue edits that actually carry a coordinate change and need to reach this overlay." },
          { value: "0.6/s against 60k reads/s", explain: "The write rate this stream carries, vanishingly small against the read volume it sits beside." },
        ],
        breaks: {
          failure: "Every node applies this independently, so a node that missed messages diverges from its neighbours.",
          handled: "There is nothing to reconcile it until the next build lands, which is why stream lag per node is monitored rather than assumed uniform across the fleet.",
        },
      },
    },
    {
      id: "e13",
      from: "edit-stream",
      to: "result-cache",
      tier: "control",
      label: "cell-prefix invalidation",
      detail: {
        what: "Best-effort invalidation: an edit is translated into the cell prefixes whose cached pages might contain it, and those keys are dropped.",
        why: "The key includes category, radius bucket and page, so one business edit touches an unbounded set of keys that cannot be enumerated. Prefix invalidation is the only tractable approximation, and it is an optimisation on top of the TTL rather than the mechanism.",
        numbers: [
          { value: "60s TTL is the real mechanism", explain: "Prefix invalidation is best-effort on top of this; the TTL is what actually guarantees a stale entry cannot live forever." },
          { value: "bulk edits (e.g. 3,000-location chains) rate-limited into this path", explain: "Large batch updates are throttled before they reach the invalidation path, so one bulk edit cannot instantly wipe every hot cell at once." },
        ],
        breaks: {
          failure: "It over-invalidates badly. A chain updating hours across 3,000 locations wipes the hot cells in every major metro at once.",
          handled: "The blended hit rate falls from 60% toward zero for the 60 seconds it takes to refill, and backend QPS triples at the worst possible moment. The TTL eventually recovers it without further intervention.",
        },
      },
    },
    {
      id: "e14",
      from: "build-promote",
      to: "artifact-store",
      tier: "control",
      label: "publish + canary",
      detail: {
        what: "The validated build published as a new immutable version, with the previous version retained for rollback.",
        why: "Publishing and promoting are the same step only because the artifact is immutable. Nodes discover the new version and flip on their own schedule, so a roll is a property of the fleet rather than a coordinated event.",
        numbers: [
          { value: "N-1 versions retained", explain: "The previous version is always available for a rollback that needs no rebuild." },
          { value: "rollback: 1 pointer flip, not a 5 to 10 min rebuild", explain: "The cost difference between rolling back to a retained version versus rebuilding from scratch, seconds against minutes." },
        ],
        breaks: {
          failure: "A publish that succeeds but distributes slowly leaves the fleet mixed for longer than the canary window assumed.",
          handled: "Artifact age across the fleet is the metric that catches this, not publish success, since a successful publish says nothing about how far distribution has actually reached.",
        },
      },
    },
    {
      id: "e15",
      from: "catalogue",
      to: "edit-stream",
      tier: "control",
      label: "coordinate edits, 0.6/s",
      detail: {
        what: "Committed catalogue changes published to the stream: coordinate moves, deletions, and the edits that make cached pages wrong.",
        why: "The stream is fed from the transaction rather than from the application, so an edit that committed is an edit that will be published. Anything weaker and the two derived stores drift from the record with no way to notice.",
        numbers: [
          { value: "~10M edits/day total", explain: "The full catalogue edit volume this stream carries, of which only a small fraction changes a coordinate." },
          { value: "50k of them carry a coordinate", explain: "50k ÷ 10M ≈ 0.5%, matching that ratio elsewhere; spread over a day that's ~0.58/s, matching this edge's own 0.6/s label." },
        ],
        breaks: {
          failure: "If this stalls, nothing errors: search keeps answering from the last build, confidently, with stale locations.",
          handled: "Stream lag is a freshness metric rather than an availability one, so it has to be watched explicitly since nothing else would surface the problem.",
        },
      },
    },
    {
      id: "e16",
      from: "catalogue",
      to: "build-map",
      tier: "control",
      label: "nightly full pass",
      detail: {
        what: "The build job reading the whole catalogue: a map over 400GB producing one 48-byte entry and one 300-byte card per place, then a sort by cell id.",
        why: "The index is derived state, so it is regenerated rather than reconciled. A rebuild that takes minutes rather than hours is what makes rebuild an ordinary response to a suspected problem instead of an outage.",
        numbers: [
          { value: "400GB mapped, 10GB sorted", explain: "The full catalogue read in this pass, and the packed, sorted artifact it produces." },
          { value: "5 to 10 minutes on a modest cluster", explain: "The time this pass takes end to end, fast enough to make a rebuild an ordinary operational response." },
        ],
        breaks: {
          failure: "It reads a live transactional store, so the pass has to be taken against a snapshot.",
          handled: "Otherwise the artifact contains a smear of several minutes of edits, which shows up as a corpus diff nobody can explain when the build is later validated.",
        },
      },
    },
    {
      id: "e17",
      from: "build-map",
      to: "build-gate",
      tier: "data",
      label: "10GB sorted by cell id",
      detail: {
        what: "The freshly built artifact handed to validation before anything is published.",
        why: "Nothing between here and the fleet can tell a truncated artifact from a valid one, so this is the last point where the previous version is still available for comparison.",
        numbers: [
          { value: "10GB index, 60GB cards", explain: "The full size of the artifact handed off for validation before either file is published anywhere." },
          { value: "diffed against 1 prior version before publish", explain: "Every new build is compared against exactly the version it would replace, never against an older baseline." },
        ],
        breaks: {
          failure: "A half-failed build produces a file that opens and probes correctly and is simply missing places.",
          handled: "The failure is silent by construction, which is why the next stage is a diff against the previous version rather than a health check.",
        },
      },
    },
    {
      id: "e18",
      from: "build-gate",
      to: "build-promote",
      tier: "data",
      label: "1% band + corpus diff",
      detail: {
        what: "The gate's verdict: entry count within 1% of the previous artifact, per-region checksums sane, and the recorded query corpus returning matching result sets within tolerance.",
        why: "Promotion is the irreversible-ish step, so everything that can be checked offline is checked before it. The band is deliberately tight enough to trip on real growth, because a human confirming 2% is cheaper than a global outage.",
        numbers: [
          { value: "refuse promotion outside a 1% entry-count band", explain: "The tolerance this gate enforces before a build is even eligible for canary promotion." },
          { value: "2 result sets compared within tolerance", explain: "The old and new artifact's answers to the same recorded query corpus, compared before either reaches real traffic." },
        ],
        breaks: {
          failure: "It compares against yesterday, so an error present in every build passes every time.",
          handled: "The canary diff on live traffic is the second net, and neither this gate nor the canary catches a systematic bug in the encoder itself.",
        },
      },
    },
    {
      id: "e19",
      from: "ingest",
      to: "catalogue",
      tier: "control",
      label: "validated writes, ~120/s",
      detail: {
        what: "Business creates, edits and deletes committed to the source of truth after coordinate sanity checks.",
        why: "This is the only arrow that writes anything durable in the whole diagram. Everything else is derived from what lands here, which is why validation sits before it rather than anywhere downstream.",
        numbers: [
          { value: "~10M edits/day, ~120 writes/s", explain: "The full write volume into the catalogue that this validation stage sits in front of." },
          { value: "under 0.5% move a coordinate", explain: "The small share of writes that actually touch location, though every write passes through the same coordinate sanity check." },
        ],
        breaks: {
          failure: "A bad coordinate committed here is baked into the next artifact and takes a full rebuild to remove.",
          handled: "The cost of a missed check is 5 to 10 minutes of wrong results rather than a rejected request, which is why validation runs before the commit, not after.",
        },
      },
    },
  ],
  figures: {
    "geohash-precision": {
      title: "Geohash precision vs query cost",
      nodes: [
        { id: "len5", label: "geohash len=5", sub: "~5km cell", kind: "database", col: 0, row: 0 },
        { id: "out5", label: "Over-fetch", sub: "~10x candidates, ~15km covered", kind: "service", col: 1, row: 0 },
        {
          id: "len6",
          label: "geohash len=6",
          sub: "~600m cell",
          kind: "database",
          col: 0,
          row: 1,
          detail: {
            what: "The precision level whose cell dimensions actually match a 1km search radius.",
            why: "Covering radius r from a cell of width w and height h needs (2·ceil(r/w)+1) × (2·ceil(r/h)+1) cells, computed from the cell's shorter dimension, not assumed to be 3×3.",
          },
        },
        {
          id: "out6",
          label: "Good match",
          sub: "~3x candidates, ~1.8km covered",
          kind: "service",
          col: 1,
          row: 1,
          detail: {
            what: "The well-balanced outcome: enough neighbouring cells to cover the radius without over-fetching.",
            why: "A folk answer of one cell plus its eight neighbours is only correct when the cell is at least as wide and tall as the requested radius in both directions, which this precision level satisfies.",
          },
        },
        { id: "len7", label: "geohash len=7", sub: "~150m cell", kind: "database", col: 0, row: 2 },
        { id: "out7", label: "Under-fetch", sub: "64 cell lookups needed", kind: "service", col: 1, row: 2 },
      ],
      edges: [
        { id: "e1", from: "len5", to: "out5", tier: "data", label: "1km radius search" },
        { id: "e2", from: "len6", to: "out6", tier: "hot", step: 1, label: "1km radius search" },
        { id: "e3", from: "len7", to: "out7", tier: "data", label: "1km radius search" },
      ],
    },
    "build-gate-canary": {
      title: "Build, gate, canary, flip: nothing promoted blind",
      nodes: [
        { id: "build", label: "Nightly build", sub: "map + sort by cell", kind: "service", col: 0, row: 0 },
        { id: "gate", label: "Gate", sub: "1% band + corpus diff", kind: "service", col: 1, row: 0 },
        { id: "canary", label: "Canary node", sub: "live result-set diff", kind: "service", col: 0, row: 1 },
        {
          id: "flip",
          label: "Fleet pointer flip",
          sub: "previous artifact stays resident",
          kind: "blob",
          col: 1,
          row: 1,
          detail: {
            what: "The atomic switch every serving node makes once a canary has served real traffic against the new artifact.",
            why: "Any stage failing means the current artifact keeps serving; nothing is ever promoted blind, and the previous version stays resident for an instant rollback.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "build", to: "gate", tier: "hot", step: 1, label: "checksummed artifact" },
        { id: "e2", from: "gate", to: "canary", tier: "hot", step: 2, label: "passes count + diff check" },
        { id: "e3", from: "canary", to: "flip", tier: "hot", step: 3, label: "canary result sets agree" },
      ],
    },
  },
};
