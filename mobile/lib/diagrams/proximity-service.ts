import type { Diagram } from "./types";

export const PROXIMITY_SERVICE: Diagram = {
  id: "proximity-service",
  title: "Proximity Service",
  question: "Design a Proximity Service (Yelp, Find Nearby)",
  sourceId: "patterns",
  itemId: 13,
  overview: {
    shape:
      "A two-phase filter over a file: a cheap approximate prune that turns a circle on the map into a block of pre-computed cells, then an exact distance test over the few thousand candidates that block returned.",
    beats: [
      "No storage engine has a near operator. You manufacture a one-dimensional key out of a latitude and a longitude, so a nearby search becomes an equality lookup on a handful of cell ids rather than a distance computation over 200M rows.",
      "That key is lossy in a specific way, and every remaining decision is a consequence of the loss. A circle never aligns to cell edges, so you read the whole block that covers the radius: at a 1km radius on 1.22km by 0.61km cells that is 3 by 5, fifteen cells, 11.2km2 against a 3.14km2 circle, a 3.6x over-fetch.",
      "Density is what makes the block dangerous. The same fifteen cells return about 22,000 candidates in Midtown, 1,700 in a suburb and 20 in a rural county, a 1000x spread against a query that does not change, so the per-candidate cost is the number the whole design turns on.",
      "Keeping that cost at about 5ns means the index entry is a packed 48-byte struct carrying coordinates, a category bitmask, rating and opening hours, so filtering and ranking happen inside the scan and only the 20 rows you actually return are ever hydrated from the card store.",
      "Businesses do not move. Coordinate changes run at 0.6/s against 60k searches/s, a ratio near 100,000:1, which makes the index derived, disposable state: built offline, checksummed, diffed, canaried and swapped in by pointer flip, with the day's moves carried in a small overlay map alongside.",
      "The result cache is keyed on the cell rather than on raw coordinates, so everyone standing anywhere inside one cell shares one entry. That single key choice is what turns a key space with millions of distinct values into a few thousand hot ones and takes 300k/s peak down to 120k/s at the index.",
    ],
    crux:
      "The query is a circle, the index is made of boxes, and population density across those boxes varies by three orders of magnitude. You cannot make the boxes fit the circle, so you pay the over-fetch and make each wasted candidate cost nanoseconds instead of a row read.",
    numbers: [
      "~22,000 candidates in a Midtown block, ~20 in a rural county",
      "48B packed entry, ~5ns to test, so a p99 scan is 110µs of a 200ms budget",
      "0.6 coordinate writes/s against 60k reads/s, near 100,000:1",
    ],
  },
  nodes: [
    {
      id: "node-ram",
      label: "Serving node memory",
      kind: "group",
      x: 424,
      y: 216,
      w: 272,
      h: 216,
      detail: {
        what: "What lives in RAM on every search node: the 10GB index artifact memory-mapped from local disk, plus the overlay of coordinate changes made since it was built.",
        why: "Phase one is a scan of up to 22,000 packed entries. That is only cheap in-process; the moment a candidate costs a network round trip the two-phase filter stops paying for itself and the whole design collapses back into a per-candidate fetch.",
        numbers: ["10GB artifact, memory-resident", "~50k overlay entries per day"],
        breaks:
          "The artifact is global, so a bad build is a global search outage rather than a partial one. Canary promotion and keeping the previous artifact resident on disk are what bound that.",
        choice: {
          pick: "A packed read-only artifact memory-mapped into every serving node",
          instead: "A shared remote index tier, for example Redis sorted sets holding cell members.",
          decider:
            "Cost per candidate. A packed 48-byte entry tests in ~5ns in-process, so 22,000 of them is 110µs; a general-purpose sorted set costs closer to 80B per member (16GB rather than 10GB) and every cell probe becomes a network hop. At 15 probes and 120k/s that is the budget.",
          flips:
            "When the index no longer fits in a node's RAM, or when it is mutated constantly rather than rebuilt, at which point a shared write-absorbing tier is the only option.",
        },
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "lat, lng, radius, filters",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The phone or browser asking what is near a point, with a radius, an optional category and an open-now flag.",
        why: "It is drawn because it supplies the two parameters that set the cost of everything downstream: the location, which picks the cell, and the radius, which picks the precision tier and therefore the size of the block scanned.",
        numbers: ["5 nearby searches per user per day", "1B MAU"],
        breaks:
          "A client is free to ask for a 50km radius in Manhattan, which is 15.7M entries and 78ms of pure scan on one core. Nothing about the client can be trusted to keep the query cheap.",
      },
    },
    {
      id: "search-api",
      label: "Search API",
      sub: "clamps radius to 3 tiers",
      kind: "compute",
      x: 40,
      y: 100,
      w: 280,
      detail: {
        what: "The stateless request tier: validates the query, clamps the radius into one of three buckets, probes the result cache and, on a miss, drives the two-phase filter.",
        why: "Radius is the one client-supplied parameter that scales cost quadratically, so it has to be bucketed before it reaches the index rather than honoured exactly. Clamping is also what makes the result cache key finite.",
        numbers: ["60k/s average, 300k/s peak", "200ms p99 budget", "3 tiers: 5km, 1km, 200m"],
        breaks:
          "Clamping means the API does not do quite what the caller asked for. A genuinely wide search is served from the coarse tier and a 30km search is refused outright, which has to be documented rather than hidden.",
        choice: {
          pick: "Clamp radius into three precision buckets, hard cap at 25km",
          instead: "Honour an arbitrary client radius and pick precision continuously.",
          decider:
            "Scan cost grows with area. A 50km radius in a dense metro covers 7,850km2 and scans 15.7M entries at 5ns, which is 78ms on one core and unsurvivable at 120k/s. Three buckets also bound the cache key space, which is what keeps the hit rate at 60%.",
          flips:
            "A catalogue small enough that even a continent-wide scan is cheap, where clamping only costs you accuracy and buys nothing measurable back.",
        },
      },
    },
    {
      id: "block-planner",
      label: "Cell encoding + block",
      sub: "geohash L6, 3 x 5 = 15 cells",
      kind: "compute",
      x: 40,
      y: 200,
      w: 280,
      detail: {
        what: "Encodes the user's coordinates to a cell id at the tier matching the radius, then computes the block of cells that covers the circle from anywhere inside that cell.",
        why: "This is where the two-dimensional query becomes one-dimensional. The general form is (2*ceil(r/w) + 1) x (2*ceil(r/h) + 1) for cells of width w and height h, and getting it wrong is a correctness bug that never throws.",
        numbers: [
          "geohash L5 4.9km, L6 1.22km x 0.61km, L7 153m",
          "1km radius at L6: 3 x 5 = 15 cells",
          "block 11.2km2 vs a 3.14km2 circle, 3.6x over-fetch",
        ],
        breaks:
          "The folk rule of cell plus eight neighbours is only right when the cell is at least as large as the radius in both dimensions. Geohash cells are 2:1 at even lengths, so using 9 cells silently loses everything between 610m and 1km due north or south.",
        choice: {
          pick: "Geohash, compared on the shorter cell dimension",
          instead: "S2 cells on a Hilbert curve, or H3 hexagons.",
          decider:
            "For a static catalogue all three answer the same question and the choice barely moves the design, which is worth saying out loud because candidates burn ten minutes here. Geohash string prefixes drop into any store; the cost is 2:1 cells at even lengths and distortion near the poles, both handled in this one component.",
          flips:
            "S2 when you need hierarchical roll-ups across a genuinely global surface with sane polar behaviour, H3 when cells are demand buckets for moving entities and expanding by k rings has to be a uniform operation across all six neighbours.",
        },
      },
    },
    {
      id: "scan",
      label: "Candidate scan",
      sub: "bitmask filter inside the scan",
      kind: "compute",
      x: 40,
      y: 300,
      w: 280,
      detail: {
        what: "Fifteen range probes into the memory-resident index, streaming packed 48-byte entries and applying the category bitmask and open-hours test as it goes.",
        why: "Phase one has to be genuinely cheap or the two-phase split is not worth making. Filtering here rather than after a fetch is what keeps hydration at 20 rows instead of 22,000, and it is the single arithmetic comparison the whole design rests on.",
        numbers: [
          "p99 22,000 entries at 5ns = 110µs",
          "median 1,700 entries = 8.5µs",
          "bitmask eliminates ~98% of them",
        ],
        breaks:
          "Only attributes that live in the 48-byte entry can be filtered here. A filter that does not fit forces either a wider entry across 200M rows or a post-scan fetch, which reintroduces the 100x hydration cost this design exists to avoid.",
        choice: {
          pick: "Filter and rank inside the scan over self-contained entries",
          instead: "An index of business ids only: fetch every candidate, then filter and rank.",
          decider:
            "Candidates per query times backend QPS. Filtering first is 120k x 20 = 2.4M card reads/s; hydrating first is 120k x 2,000 mean candidates = 240M reads/s, 100x more, and a single Midtown query moves 22,000 x 2KB = 44MB. Break-even sits near 20 candidates, roughly a 200m radius in a suburb.",
          flips:
            "When candidates are naturally few, meaning a hard sub-500m radius cap in one non-dense market, or when the filter set changes faster than you can rebuild, since denormalising a user-generated tag means a 10GB rebuild per tag.",
        },
      },
    },
    {
      id: "rank",
      label: "Haversine + rank",
      sub: "top 20, distance blended with rating",
      kind: "compute",
      x: 40,
      y: 400,
      w: 280,
      detail: {
        what: "Phase two: exact haversine distance over the survivors of the scan, a blended distance-and-rating score, a partial sort for the top 20, then one hydration call.",
        why: "The block over-covers the circle by 3.6x, so somebody has to throw away the false positives, and it has to be the expensive exact test rather than the cheap one. Ranking runs on index fields, so quality ordering never needs a row read.",
        numbers: ["~330 survivors at p99, 50ns each = 17µs", "~90 inside 1km, top 20 returned"],
        breaks:
          "Straight-line distance is not what people mean by near. A place 800m away across a river with no crossing for 3km outranks one 1.2km away on the same block, and nothing in the index can know that.",
        choice: {
          pick: "Blend distance and rating after the scan, cap the scan itself by distance",
          instead: "Truncate each cell to its local top-K by blended score during the scan.",
          decider:
            "A cell's local top-K is not the block's global top-K, because the 15 cells are scanned independently. In a cell holding 22,000 entries any truncation drops results someone wanted, so the bias is real and bounded by the cap, and it is measured against an uncapped shadow query rather than declared solved.",
          flips:
            "When the block is a single cell, where local and global top-K coincide, or when the drop rate against the shadow query is genuinely zero and the cap can be removed.",
        },
      },
    },
    {
      id: "result-cache",
      label: "Result cache",
      sub: "(cell, category, radius, page), 60s",
      kind: "store",
      x: 440,
      y: 100,
      w: 240,
      detail: {
        what: "A short-TTL cache of whole result pages, keyed on the cell id rather than on the raw coordinates that produced it.",
        why: "Everyone standing anywhere inside one cell shares an entry, which is the difference between a key space with millions of distinct values and one with a few thousand hot ones. It is the reason peak backend load is 120k/s and not 300k/s.",
        numbers: ["~70% hit on the top 1,000 cells", "those cells carry ~40% of traffic", "~60% blended, TTL jittered 50-70s"],
        breaks:
          "Invalidation is best-effort and sometimes wrong. One business edit touches an unbounded set of keys, so cell-prefix invalidation over-invalidates: a chain updating hours across 3,000 locations wipes the hot cells in every metro at once and triples backend QPS.",
        choice: {
          pick: "Key on (cell, category, radius bucket, page) with a 60s jittered TTL",
          instead: "Key on the raw lat/lng of the request, or do not cache results at all.",
          decider:
            "Distinct keys. Raw coordinates are effectively unique per request, so the hit rate is near zero; the cell collapses them onto a few thousand hot keys and reaches 70% on the top 1,000, blending to 60% overall. That is 180k/s of peak traffic that never reaches the index.",
          flips:
            "Moving entities, where a result is stale before the response lands and caching is meaningless, and open-now queries, whose answer depends on the current hour so the key is incomplete without an hour bucket.",
        },
      },
    },
    {
      id: "geo-index",
      label: "Geo index artifact",
      sub: "48B entries sorted by cell id, 10GB",
      kind: "store",
      x: 440,
      y: 240,
      w: 240,
      detail: {
        what: "A packed, read-only array of 48-byte entries sorted by cell id: business id, coordinates, cell id, category bitmask, rating, popularity and an open-hours bitmap.",
        why: "Everything needed to filter and rank lives here, which is why hydration is 20 rows rather than 22,000. Being an immutable sorted array rather than a mutable structure is what makes a probe an array offset instead of a tree walk.",
        numbers: ["200M x 48B = ~10GB", "15 range probes per query", "candidates 20 to 22,000, a 1000x spread"],
        breaks:
          "Denormalised attributes drift. Rating and popularity change continuously in the catalogue, so between builds the index ranks on stale values, and those are exactly the fields that actually move.",
        choice: {
          pick: "A uniform cell grid at three precision tiers, with a per-cell candidate cap as a backstop",
          instead: "Adaptive subdivision: a quadtree whose leaves hold at most k places, bounding candidates by construction.",
          decider:
            "The cost of a single candidate, not the number of them. Both pay the same boundary tax. The grid's candidate count spans 20 to 22,000, but a packed 48-byte entry tests in ~5ns so p99 scan is 110µs against a 200ms budget, 0.06%. A 1000x spread on a term worth 0.06% is not worth a tree.",
          flips:
            "When a candidate costs a row read rather than an array probe, since 22,000 reads at 10µs is 220ms on its own. Also when radius is absent so precision cannot be bucketed and you need a real k-nearest-neighbour walk, or when the cap is measurably dropping wanted results.",
        },
      },
    },
    {
      id: "overlay",
      label: "Coordinate overlay",
      sub: "moves since last build + tombstones",
      kind: "store",
      x: 440,
      y: 340,
      w: 240,
      detail: {
        what: "A small per-node hash map of business id to new cell id for coordinate changes since the last build, plus a tombstone set filtered during the scan.",
        why: "It is what makes an immutable artifact acceptable. Without it, freshness for a moved or deleted business is a whole build cycle, and you would be tempted into a live index for a write rate of 0.6/s.",
        numbers: ["~50k coordinate changes/day", "0.6 writes/s", "consulted on every scan"],
        breaks:
          "It grows until the next build lands, so a stalled build turns a trivial map into an unbounded one. Overlay size is the leading indicator that index freshness lag is about to become a real problem.",
        choice: {
          pick: "An in-memory overlay map consulted alongside the artifact",
          instead: "Rebuild and promote on every coordinate edit, or patch the artifact in place.",
          decider:
            "Volume against build time. 50k coordinate changes a day is 0.6/s, so the overlay never exceeds ~50k entries and costs nothing to hold, while a build is 5 to 10 minutes and cannot chase individual edits. Patching a memory-mapped sorted array in place is not a thing you want to be doing.",
          flips:
            "When coordinate writes exceed roughly 1% of reads or freshness must be under a minute, both of which flip the moment the entities move rather than being edited.",
        },
      },
    },
    {
      id: "card-store",
      label: "Card store",
      sub: "in-memory KV, ~300B per place",
      kind: "store",
      x: 440,
      y: 440,
      w: 240,
      detail: {
        what: "A sharded in-memory key-value tier holding the display projection: name, rating, review count, category, thumbnail reference and short address.",
        why: "Hydration is the last step and touches only what is returned, so it is one 20-key multi-get per query. Keeping a slim projection separate from the 2KB transactional row is what makes that read cheap enough to sit on the hot path.",
        numbers: ["200M x 300B = ~60GB", "120k multi-gets of 20 keys/s", "2.4M card reads/s at peak"],
        breaks:
          "A partial or slow multi-get degrades the whole page. The fallback is to serve what the index entry already holds, so the card drops to name and rating rather than the request failing.",
        choice: {
          pick: "A dedicated in-memory KV tier holding a 300B projection",
          instead: "Hydrate the full 2KB record straight from the transactional catalogue.",
          decider:
            "Read rate and payload. 2.4M card reads/s against a 400GB transactional store is not a workload it will serve at single-digit milliseconds, and the full record is 7x the bytes for fields nothing on the result page renders. 60GB of projection shards comfortably across RAM.",
          flips:
            "Low query rates, where the extra tier is one more thing to keep in sync for no measurable latency gain and the catalogue can simply serve the reads.",
        },
      },
    },
    {
      id: "catalogue",
      label: "Business catalogue",
      sub: "transactional, ~2KB rows, 400GB",
      kind: "store",
      x: 440,
      y: 560,
      w: 240,
      detail: {
        what: "The transactional source of truth: the full record per place, including name, hours, address, photos and description. Never on the search path.",
        why: "Both the index and the card store are derived from it and can be regenerated from it, which is the property that makes a bad artifact a rollback rather than data loss. Keeping it off the read path is deliberate, not incidental.",
        numbers: ["200M places x ~2KB = ~400GB", "~10M catalogue edits/day, ~120 writes/s", "under 0.5% of edits move a coordinate"],
        breaks:
          "Malformed or spoofed coordinates get baked into the next build, so validation has to happen at ingest. Once a bad coordinate is in the artifact it takes a rebuild to remove.",
        choice: {
          pick: "Keep the transactional store off the search path entirely",
          instead: "Push the geometry into the store that already holds the rows and answer search there with a bounding-box index.",
          decider:
            "What a candidate costs when the index and the store are the same system. A row read is ~10µs, so 22,000 candidates is 220ms and blows a 200ms budget before ranking, and per-node throughput drops by roughly an order of magnitude.",
          flips:
            "Polygon and drive-time queries, which radius search cannot express at all. Those route to the store's bounding-box index instead, at maybe thousands of QPS per node, which is fine because they are operator-facing and rare.",
        },
      },
    },
    {
      id: "build-job",
      label: "Index build + promote",
      sub: "checksum, diff, canary, pointer flip",
      kind: "compute",
      x: 440,
      y: 660,
      w: 240,
      detail: {
        what: "The offline job that maps the catalogue, sorts 10GB of entries by cell id, checksums the artifact, diffs it against the outgoing version and promotes it by canary.",
        why: "Because the entities are static, the index is a file you release rather than a structure you mutate. That is what makes it testable: you can replay a recorded query corpus against two versions and compare result sets before anyone sees the new one.",
        numbers: ["build is 5 to 10 minutes", "refuse promotion if entry count moves more than 1%", "rollback is a pointer flip"],
        breaks:
          "The fleet is briefly mixed during a roll, so two users in the same cell can get different results for a few minutes. Fine for a business catalogue, not fine for anything with a consistency requirement.",
        choice: {
          pick: "Build offline and swap a versioned immutable artifact",
          instead: "A live index written through on every business edit.",
          decider:
            "Coordinate writes against reads. 50k coordinate changes a day is 0.6/s against 60k reads/s, near 100,000:1, so the day's changes fit in an overlay and a full rebuild is a scheduled job rather than an incident. A live index also cannot be diffed before it is exposed.",
          flips:
            "The moment the indexed entities move. A driver rewriting position every 4 seconds gives a write rate of fleet size divided by 4, and an offline build is meaningless against it.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "search-api",
      label: "lat, lng, radius, category",
      animated: true,
      detail: {
        what: "The search request: a point, a radius in kilometres, an optional category and an open-now flag.",
        why: "Everything about the cost of this query is decided by two of these fields. The point selects the cell and the radius selects the precision tier, which together fix how many candidates the scan will touch.",
        numbers: ["5B searches/day", "radius clamped to 25km"],
        breaks:
          "The radius arrives untrusted. One client asking for 50km in a dense metro is 15.7M entries scanned, so validation here is a capacity control rather than input hygiene.",
      },
    },
    {
      id: "e2",
      from: "search-api",
      to: "result-cache",
      label: "probe, then fill on miss",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A lookup on (cell, category, radius bucket, page), and on a miss the write-back of the finished page with a jittered 60-second TTL.",
        why: "Sixty percent of queries end at this arrow. Because the key is the cell rather than the coordinates, the thousand people searching coffee in Times Square at noon all collapse onto one entry rather than a thousand.",
        numbers: ["~60% blended hit rate", "TTL jittered 50-70s"],
        breaks:
          "Every expiry on a hot cell sends thousands of concurrent identical misses at the index, so this needs single-flight per key or the TTL boundary becomes a self-inflicted thundering herd.",
      },
    },
    {
      id: "e3",
      from: "search-api",
      to: "block-planner",
      label: "cache miss, ~120k/s",
      animated: true,
      detail: {
        what: "The 40% of queries the cache did not answer, carrying a clamped radius and a validated point.",
        why: "The radius is already bucketed by the time it gets here, so the planner only has to map a bucket to a precision tier rather than reason about arbitrary values. That is what keeps three tiers sufficient.",
        numbers: ["300k/s peak x (1 - 0.6) = ~120k/s"],
        breaks:
          "If the cache hit rate collapses, for example after a bulk edit triggers cell-prefix invalidation, this arrow instantly carries 300k/s and the index tier is sized for 120k/s.",
      },
    },
    {
      id: "e4",
      from: "block-planner",
      to: "scan",
      label: "15 cell ids",
      animated: true,
      detail: {
        what: "The covering block: the list of cell ids whose union contains the requested circle from anywhere inside the centre cell.",
        why: "This is the moment the query stops being geometry and becomes a set of integer keys, which is the entire point of manufacturing a cell id in the first place.",
        numbers: ["3 x 5 = 15 cells at a 1km radius", "3.6x more area than the circle"],
        breaks:
          "Too coarse a tier and this is 9 cells covering 215km2, a 68x over-fetch and 430,000 entries. Too fine and it is 225 cells, no longer contiguous in cell order, so you pay 225 probes instead of 15.",
      },
    },
    {
      id: "e5",
      from: "scan",
      to: "geo-index",
      label: "range probe per cell",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Fifteen range reads into the sorted packed array, one per cell id in the block, returning every entry filed under those cells.",
        why: "Entries are sorted by cell id, so a cell is a contiguous range rather than a scattered set of rows. That contiguity is why the probe is an array offset and a memory walk instead of an index seek per candidate.",
        numbers: ["p99 ~22,000 entries returned", "48B each, ~5ns to test"],
        breaks:
          "Cell arithmetic wraps badly at 180 degrees longitude and cells degenerate near the poles, so the block computation has to special-case the antimeridian and clamp latitude to 85 degrees.",
      },
    },
    {
      id: "e6",
      from: "scan",
      to: "overlay",
      label: "moves + tombstones",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The overlay consulted alongside the artifact: businesses whose coordinates changed since the build, and deletions filtered out during the scan.",
        why: "It is what stops index freshness being a whole build cycle. At 0.6 coordinate writes a second the correction set is tiny, so correctness costs a hash probe rather than a different architecture.",
        numbers: ["~50k entries", "checked per candidate"],
        breaks:
          "A business that moved has to be suppressed at its old cell as well as added at its new one, or the same place appears twice in one result set.",
      },
    },
    {
      id: "e7",
      from: "scan",
      to: "rank",
      label: "~330 survivors at p99",
      animated: true,
      detail: {
        what: "Entries that passed the category bitmask and the open-hours test, handed to the exact distance pass.",
        why: "The cheap approximate phase has already discarded about 98% of the block, so the expensive exact test runs over hundreds rather than tens of thousands. That ratio is what makes a two-phase filter worth building at all.",
        numbers: ["22,000 candidates in, ~330 out", "~90 of those inside 1km"],
        breaks:
          "Anything the bitmask cannot express leaks past this arrow and has to be evaluated on a hydrated record, which is exactly the 100x cost the design is built to avoid.",
      },
    },
    {
      id: "e8",
      from: "rank",
      to: "card-store",
      label: "20-key multi-get",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "One batched read for the display projections of the twenty places actually being returned.",
        why: "Hydration happens after ranking, never before. Fetching first would be 240M reads/s at peak and 44MB of wire traffic for a single Midtown query, against 2.4M reads/s and a few kilobytes doing it this way.",
        numbers: ["20 keys per query", "2.4M card reads/s at peak"],
        breaks:
          "Fan-out above 20 means filtering has leaked out of the index. That metric is the first thing to check when p99 moves, ahead of the scan itself.",
      },
    },
    {
      id: "e9",
      from: "rank",
      to: "client",
      label: "top 20, ~5ms server",
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "The ranked page returned to the caller: twenty places with distance, rating and a next-page token.",
        why: "Almost all of the few milliseconds spent here is the two network hops, not the geometry. The scan and the haversine together are about 130µs, which is the payoff for making phase one a walk over packed structs.",
        numbers: ["~5ms server time", "200ms p99 budget"],
        breaks:
          "The distance shown is straight-line, and it is labelled as distance rather than travel time on purpose. Waterfronts, cities cut by rail and anywhere with elevation are where users notice the difference.",
      },
    },
    {
      id: "e10",
      from: "catalogue",
      to: "build-job",
      label: "nightly full build",
      dashed: true,
      detail: {
        what: "The build job reading the whole catalogue: a map over 400GB producing one 48-byte entry per place, then a sort by cell id.",
        why: "The index is derived state, so it is regenerated rather than reconciled. A rebuild that takes minutes rather than hours is what makes rebuild an ordinary response to a suspected problem instead of an outage.",
        numbers: ["400GB mapped, 10GB sorted", "5 to 10 minutes on a modest cluster"],
        breaks:
          "A truncated artifact from a half-failed build looks like a valid one. Entry-count and per-region checksums against the previous version are the only thing that catches it before promotion.",
      },
    },
    {
      id: "e11",
      from: "build-job",
      to: "geo-index",
      label: "artifact swap, canaried",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "Promotion: nodes memory-map the new file, warm it and flip a pointer, one canary node first with its live results diffed against the outgoing version.",
        why: "Treating the index as a release rather than a write is only possible because it is immutable. You cannot diff two versions of a structure that is being mutated tens of thousands of times a second.",
        numbers: ["refuse promotion outside a 1% entry-count band", "previous artifact stays resident on disk"],
        breaks:
          "The artifact is global, so a bad promotion is a global search outage. Rollback has to be a pointer flip back to a file already on local disk, not a rebuild.",
      },
    },
    {
      id: "e12",
      from: "build-job",
      to: "card-store",
      label: "300B projection rebuild",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 40,
      detail: {
        what: "The same build pass emitting the display projection: 60GB of cards, sharded across the in-memory tier.",
        why: "Both derived stores come out of one pass over the catalogue so they cannot disagree about which places exist. A card missing for an id the index still returns is a partially rendered result.",
        numbers: ["200M x 300B = ~60GB", "distributed per build cycle"],
        breaks:
          "Cards and index entries promoted independently can drift, so an id in the new artifact may have no card in the old projection until both land.",
      },
    },
    {
      id: "e13",
      from: "catalogue",
      to: "overlay",
      label: "coordinate edits, 0.6/s",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "Coordinate changes and deletions streamed to serving nodes between builds, landing in the per-node overlay map and tombstone set.",
        why: "Under 0.5% of the 10M daily catalogue edits move a coordinate, so this is a trickle rather than a stream. Ratings and hours are not carried here; they are rebuilt on a faster cadence than the geometry because they are the fields that actually move.",
        numbers: ["50k of 10M daily edits", "0.6/s against 60k reads/s"],
        breaks:
          "If this stream stalls, the overlay silently stops growing and search keeps returning confidently stale locations, which is why overlay size is monitored as a freshness indicator rather than assumed healthy.",
      },
    },
  ],
};
