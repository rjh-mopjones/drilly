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
      "Keeping that cost at about 5ns means the four stages of a search and the 10GB index are one process on one machine: the scan is a memory walk over packed 48-byte structs, filtering and ranking happen inside it, and only the 20 rows you actually return are ever hydrated from the card store.",
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
        why: "It is a client rather than a third party: it runs our build, we ship it and we are paged for it. It is drawn because it supplies the two parameters that set the cost of everything downstream, the location which picks the cell and the radius which picks the precision tier and therefore the size of the block scanned.",
        numbers: ["1B MAU, 5 nearby searches per user per day", "5B searches/day"],
        breaks:
          "A client is free to ask for a 50km radius in Manhattan, which is 15.7M entries and 78ms of pure scan on one core. Nothing about the client can be trusted to keep the query cheap, which is why the clamp is server-side.",
      },
    },
    {
      id: "serving-node",
      label: "Serving node",
      kind: "zone",
      detail: {
        what: "One search machine: the stateless search binary, the 10GB index artifact memory-mapped from its local disk, and the overlay of coordinate changes made since that artifact was built.",
        why: "The frame is a co-residency claim, not a deployment one. The service and the artifact ship on completely different pipelines, a normal binary rollout for one and a canaried pointer flip for the other, but they have to sit in the same address space: phase one is a walk over up to 22,000 packed entries, and the moment a candidate costs a network round trip the two-phase filter stops paying for itself and the design collapses back into a per-candidate fetch.",
        numbers: ["10GB artifact, memory-resident on every node", "~50k overlay entries per day", "candidate cost ~5ns in-process"],
        breaks:
          "The artifact is global, so a bad build is a global search outage rather than a partial one, and every node holds the whole world rather than a shard of it. Canary promotion and keeping the previous artifact resident on local disk are what bound that.",
        choice: {
          pick: "A packed read-only artifact memory-mapped into every serving node",
          instead: "A shared remote index tier, for example Redis sorted sets holding cell members.",
          decider:
            "Cost per candidate. A packed 48-byte entry tests in ~5ns in-process, so 22,000 of them is 110µs; a general-purpose sorted set costs closer to 80B per member (16GB rather than 10GB) and every cell probe becomes a network hop. At 15 probes per query and 120k/s that is the whole budget, spent on transport.",
          flips:
            "When the index no longer fits in a node's RAM, or when it is mutated constantly rather than rebuilt, at which point a shared write-absorbing tier is the only option.",
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
        what: "One stateless deployable that runs the whole request: validate and clamp, encode the cell and compute the block, scan the candidates, then rank and hydrate.",
        why: "The prose's hot path is a single function, tier then cells_covering then the comprehension then nlargest then mget, and drawing those four stages as peer services would claim an independence that does not exist. They deploy together, scale on the same signal, and each stage exists only to make the next one affordable. Splitting them would also put a network hop where the design has budgeted 5ns.",
        numbers: ["60k/s average, 300k/s peak", "~120k/s reaches the scan after the cache", "~5ms server time, 200ms p99 budget"],
        breaks:
          "Being stateless is what makes it disposable, but it holds a 10GB mapping, so a node is not cheap to start: it has to fetch or open the artifact and warm it before it can serve. Autoscaling on a traffic spike is minutes, not seconds, so the fleet is sized for peak rather than scaled into it.",
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
        what: "The entry stage: validate the point, clamp the radius into one of three buckets, build the cache key and probe the result cache, and on a miss drive the rest of the request.",
        why: "Radius is the one client-supplied parameter whose cost grows with area, so it has to be bucketed before it reaches the index rather than honoured exactly. Bucketing is also what makes the cache key finite: a continuous radius would give every request its own key and a hit rate near zero.",
        numbers: ["3 tiers: 5km, 1km, 200m", "hard cap 25km", "~60% of requests end here on a cache hit"],
        breaks:
          "Clamping means the API does not do quite what the caller asked for. A genuinely wide search is served from the coarse tier and a 30km search is refused outright, which has to be documented rather than hidden.",
        choice: {
          pick: "Clamp radius into three precision buckets, hard cap at 25km",
          instead: "Honour an arbitrary client radius and pick precision continuously.",
          decider:
            "Scan cost grows with area. A 50km radius in a dense metro covers 7,850km2 and scans 15.7M entries at 5ns, which is 78ms on one core and unsurvivable at 120k/s. Three buckets also bound the cache key space, which is what keeps the blended hit rate at 60%.",
          flips:
            "A catalogue small enough that even a continent-wide scan is cheap, where clamping only costs you accuracy and buys nothing measurable back.",
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
          "geohash L5 4.9km, L6 1.22km x 0.61km, L7 153m",
          "1km radius at L6: 3 x 5 = 15 cells",
          "block 11.2km2 vs a 3.14km2 circle, 3.6x over-fetch",
        ],
        breaks:
          "The folk rule of cell plus eight neighbours is only right when the cell is at least as large as the radius in both dimensions. Geohash cells are 2:1 at even lengths, so using 9 cells silently loses everything between 610m and 1km due north or south. Cell arithmetic also wraps badly at 180 degrees longitude and degenerates near the poles, so this stage special-cases the antimeridian and clamps latitude to 85 degrees.",
        choice: {
          pick: "Geohash, compared on the shorter cell dimension",
          instead: "S2 cells on a Hilbert curve, or H3 hexagons.",
          decider:
            "For a static catalogue all three answer the same question and the choice barely moves the design, which is worth saying out loud because candidates burn ten minutes here. Geohash string prefixes drop into any store; the cost is 2:1 cells at even lengths and distortion near the poles, both handled in this one stage.",
          flips:
            "S2 when you need hierarchical roll-ups across a genuinely global surface with sane polar behaviour, H3 when cells are demand buckets for moving entities and expanding by k rings has to be a uniform operation across all six neighbours.",
        },
      },
    },
    {
      id: "scan",
      label: "Candidate scan",
      sub: "bitmask + hours in the scan",
      kind: "process",
      col: 1,
      row: 2,
      parent: "search-svc",
      detail: {
        what: "Fifteen range probes into the memory-mapped artifact, streaming packed 48-byte entries and applying the category bitmask and the open-hours test as it goes, with the overlay consulted for moves and tombstones.",
        why: "Phase one has to be genuinely cheap or the two-phase split is not worth making. Filtering here rather than after a fetch is what keeps hydration at 20 rows instead of 22,000, and it is the single arithmetic comparison the whole design rests on.",
        numbers: [
          "p99 22,000 entries at 5ns = 110µs",
          "median 1,700 entries = 8.5µs",
          "bitmask eliminates ~98% of them",
        ],
        breaks:
          "Only attributes that live in the 48-byte entry can be filtered here. The bitmask holds 64 category bits and the hours bitmap is a coarse approximation; a filter that does not fit forces either a wider entry across 200M rows or a post-scan fetch, which reintroduces the 100x hydration cost this design exists to avoid.",
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
      sub: "top 20, distance x rating",
      kind: "process",
      col: 1,
      row: 3,
      parent: "search-svc",
      detail: {
        what: "Phase two: exact haversine distance over the survivors of the scan, a blended distance-and-rating score, a partial sort for the top 20, then one hydration call and the cache fill.",
        why: "The block over-covers the circle by 3.6x, so somebody has to throw away the false positives, and it has to be the expensive exact test rather than the cheap one. Ranking runs on index fields, so quality ordering never needs a row read.",
        numbers: ["~330 survivors at p99, 50ns each = 17µs", "~90 inside 1km, top 20 returned"],
        breaks:
          "Straight-line distance is not what people mean by near. A place 800m away across a river with no crossing for 3km outranks one 1.2km away on the same block, and nothing in the index can know that. Isochrones depend on transport mode and time of day, so they cannot be baked into a static artifact at all.",
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
      id: "geo-index",
      label: "Geo index artifact",
      sub: "48B x 200M, 10GB mmap",
      kind: "cache",
      col: 2,
      row: 1,
      parent: "serving-node",
      detail: {
        what: "A packed, read-only array of 48-byte entries sorted by cell id: business id, coordinates, cell id, category bitmask, rating, popularity and an open-hours bitmap, memory-mapped from local disk.",
        why: "It is drawn as a cache rather than a store because losing it costs nothing but a warm-up: the catalogue is the record and this file is derived from it, checksummed and re-downloadable. Everything needed to filter and rank lives here, which is why hydration is 20 rows rather than 22,000, and being an immutable sorted array rather than a mutable structure is what makes a probe an array offset instead of a tree walk.",
        numbers: ["200M x 48B = ~10GB", "15 range probes per query", "candidates 20 to 22,000, a 1000x spread"],
        breaks:
          "Denormalised attributes drift. Rating and popularity change continuously in the catalogue, so between builds the index ranks on stale values, and those are exactly the fields that actually move. They are rebuilt on a faster cadence than the geometry for that reason.",
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
      sub: "moves + tombstones, ~50k",
      kind: "cache",
      col: 2,
      row: 2,
      parent: "serving-node",
      detail: {
        what: "A per-node in-memory hash map of business id to new cell id for coordinate changes since the last build, plus a tombstone set filtered during the scan. Rebuilt by replaying the stream, never persisted.",
        why: "It is what makes an immutable artifact acceptable. Without it, freshness for a moved or deleted business is a whole build cycle, and you would be tempted into a live index for a write rate of 0.6/s.",
        numbers: ["~50k coordinate changes/day", "0.6 writes/s", "consulted on every candidate"],
        breaks:
          "It grows until the next build lands, so a stalled build turns a trivial map into an unbounded one. Overlay size is the leading indicator that index freshness lag is about to become a real problem. A business that moved also has to be suppressed at its old cell as well as added at its new one, or it appears twice in one result set.",
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

    // --- shared tiers outside the node -------------------------------------
    {
      id: "result-cache",
      label: "Result cache",
      sub: "keyed on cell, 60s jittered",
      kind: "cache",
      col: 3,
      row: 0,
      detail: {
        what: "A short-TTL shared cache of whole result pages, keyed on (cell, category, radius bucket, page) rather than on the raw coordinates that produced them.",
        why: "Everyone standing anywhere inside one cell shares an entry, which is the difference between a key space with millions of distinct values and one with a few thousand hot ones. It is the reason peak backend load is 120k/s and not 300k/s, and losing the whole tier is a load problem rather than a correctness one.",
        numbers: ["~70% hit on the top 1,000 cells", "those cells carry ~40% of traffic", "~60% blended, TTL jittered 50-70s"],
        breaks:
          "Invalidation is best-effort and sometimes wrong, so the TTL is the real mechanism. Every expiry on a hot cell also sends thousands of concurrent identical misses at the index, which is why single-flight per key and jitter are not optional.",
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
      id: "card-store",
      label: "Card store",
      sub: "in-memory KV, ~300B a place",
      kind: "cache",
      col: 3,
      row: 3,
      detail: {
        what: "A sharded in-memory key-value tier holding the display projection: name, rating, review count, category, thumbnail reference and short address.",
        why: "Hydration is the last step and touches only what is returned, so it is one 20-key multi-get per query. Keeping a slim projection separate from the 2KB transactional row is what makes that read cheap enough to sit on the hot path, and it is a cache rather than a store because the same build pass regenerates it from the catalogue.",
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

    // --- the derive-and-release path ---------------------------------------
    {
      id: "artifact-store",
      label: "Artifact store",
      sub: "versioned files, N-1 kept",
      kind: "blob",
      col: 4,
      row: 1,
      detail: {
        what: "Object storage holding each build as an immutable versioned file: the 10GB index artifact and the 60GB card set, with the previous version retained and distributed to every region.",
        why: "It is what makes the index a release rather than a write. Regions pull a file instead of talking to a central index tier, so there is no cross-region index traffic and a node recovering is a copy from local disk or the bucket, not a rebuild. Rollback needs the previous artifact to already exist somewhere durable.",
        numbers: ["10GB index + 60GB cards per build cycle", "N-1 versions retained", "distribution is bandwidth-cheap, it does not scale with traffic"],
        breaks:
          "If distribution stalls, nodes serve whatever they already have and nothing looks broken: search still answers, just from a stale world. Artifact age across the fleet has to be a monitored number rather than an assumption.",
        choice: {
          pick: "Publish immutable versioned artifacts to object storage and pull them per node",
          instead: "Push deltas to serving nodes over RPC, or have nodes patch what they hold.",
          decider:
            "Rollback time. A pointer flip back to a file already resident on local disk is seconds; unwinding a stream of applied deltas is a rebuild, and at 5 to 10 minutes per build that is the outage. Immutability is also the only thing that lets you diff two versions before either is exposed.",
          flips:
            "When the index is mutated continuously rather than rebuilt, at which point there is no version to publish and no diff to take.",
        },
      },
    },
    {
      id: "edit-stream",
      label: "Edit stream",
      sub: "0.6 moves/s, fan-out to nodes",
      kind: "queue",
      col: 4,
      row: 2,
      detail: {
        what: "The ordered log of catalogue changes that matter between builds: coordinate moves and deletions fanned out to every serving node's overlay, and cell-prefix invalidation messages fanned out to the result cache.",
        why: "It exists because two different derived stores have to hear about the same edit and neither can poll 200M rows. It is also the only place bulk edits can be rate-limited: a chain updating 3,000 locations is one producer, and throttling it here is what stops it becoming a cache-wide event.",
        numbers: ["50k of 10M daily edits carry a coordinate", "0.6/s against 60k reads/s", "fan-out to every serving node"],
        breaks:
          "If the stream stalls, the overlay silently stops growing and search keeps returning confidently stale locations, with no error anywhere. Overlay size and stream lag are monitored as freshness indicators rather than assumed healthy.",
        choice: {
          pick: "One ordered stream, fanned out to every node overlay and to the cache",
          instead: "Invalidate synchronously on the catalogue write, or have nodes poll the catalogue for changes.",
          decider:
            "Fan-out against write rate. 0.6 coordinate writes/s against a fleet that all need the same message makes a broadcast log trivial and a synchronous fan-out on the write path absurd: a catalogue commit would block on every serving node. Polling 400GB for 50k daily changes is the same cost with worse latency.",
          flips:
            "A single-node deployment, where there is nobody to fan out to and the index can simply be updated in place.",
        },
      },
    },
    {
      id: "index-build",
      label: "Index build + release",
      kind: "serviceGroup",
      col: 5,
      row: 0,
      detail: {
        what: "The offline pipeline that turns the catalogue into a released artifact: map and sort, then validate against the outgoing version, then promote by canary.",
        why: "Because the entities are static, the index is a file you release rather than a structure you mutate, and a release has stages a write does not: you can replay a recorded query corpus against two versions and compare result sets before anyone sees the new one. The three stages are one job on one schedule, which is why they are one deployable rather than three.",
        numbers: ["build is 5 to 10 minutes on a modest cluster", "one scheduled run, plus on demand", "rebuild is an ordinary response, not an incident"],
        breaks:
          "It is a batch job on a schedule, so its failure is silent by construction: nothing on the read path degrades, the fleet just keeps serving the previous artifact while the overlay grows underneath it.",
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
        numbers: ["one canary node first", "previous artifact stays resident on disk", "rollback is a pointer flip"],
        breaks:
          "The fleet is briefly mixed during a roll, so two users in the same cell can get different results for a few minutes. Fine for a business catalogue, not fine for anything with a consistency requirement.",
        choice: {
          pick: "Canary one node on live traffic, then roll the fleet node by node",
          instead: "A coordinated fleet-wide flip at an agreed timestamp.",
          decider:
            "What the mixed window costs. Here it is a few minutes of two users in one cell seeing slightly different result sets for a catalogue that changes once a year per row, which nobody can detect. A coordinated flip buys consistency you do not need and gives up the live canary diff, which is the only check that catches a subtly wrong ranking.",
          flips:
            "Anything with a real consistency requirement across the fleet, for example pricing or eligibility, where two answers in one cell is a defect rather than a rounding error.",
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
        why: "A truncated artifact from a half-failed build looks exactly like a valid one, and there is no runtime error to catch it: the file opens, the probes work, the results are just missing. Comparing against the outgoing version is the only signal that exists.",
        numbers: ["refuse promotion if entry count moves more than 1%", "recorded query corpus replayed against both versions"],
        breaks:
          "It is a diff against yesterday, so it cannot catch an error that has been present in every build. A genuine 2% catalogue growth also trips it, which is deliberate: the band needs a human, not an override.",
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
        why: "Both derived stores come out of one pass so they cannot disagree about which places exist: a card missing for an id the index still returns is a partially rendered result. Sorting by cell id is what makes a cell a contiguous range and therefore a probe rather than a seek per candidate.",
        numbers: ["400GB mapped, 10GB sorted, 60GB of cards", "5 to 10 minutes"],
        breaks:
          "Rebuild time is the floor on how fast a bad coordinate can be removed from search, so it is a latency number rather than a batch-job detail. Ten minutes is what makes rebuild an ordinary response instead of an outage.",
      },
    },
    {
      id: "catalogue",
      label: "Business catalogue",
      sub: "transactional, ~2KB rows, 400GB",
      kind: "database",
      col: 4,
      row: 3,
      detail: {
        what: "The transactional source of truth: the full record per place, including name, hours, address, photos and description. Never on the search path.",
        why: "Both the index and the card store are derived from it and can be regenerated from it, which is the property that makes a bad artifact a rollback rather than data loss. Keeping it off the read path is deliberate, not incidental.",
        numbers: ["200M places x ~2KB = ~400GB", "~10M catalogue edits/day, ~120 writes/s", "under 0.5% of edits move a coordinate"],
        breaks:
          "It is the only durable copy of anything here, so its RPO is the system's RPO. Everything else is minutes of rebuild away; this is the one box where losing data means losing data.",
        choice: {
          pick: "Keep the transactional store off the search path entirely",
          instead: "Push the geometry into the store that already holds the rows and answer search there with a bounding-box index.",
          decider:
            "What a candidate costs when the index and the store are the same system. A row read is ~10µs, so 22,000 candidates is 220ms and blows a 200ms budget before ranking, and per-node throughput drops by roughly an order of magnitude.",
          flips:
            "Polygon and drive-time queries, which radius search cannot express at all. Those route to this store's bounding-box index instead, at maybe thousands of QPS per node, which is fine because they are operator-facing and rare.",
        },
      },
    },
    {
      id: "ingest",
      label: "Catalogue ingest",
      sub: "coordinate sanity at write",
      kind: "service",
      col: 4,
      row: 4,
      detail: {
        what: "The write path into the catalogue: business creates, edits and deletes, with coordinate sanity checks and quarantine before anything is committed.",
        why: "It is drawn because it owns a failure nothing downstream can fix. A malformed or spoofed coordinate is not rejected by anything later in the pipeline, it is simply indexed: the build maps it, the checksum accepts it, the scan returns it, and the only way out is a rebuild. Validation has to happen at the one point before the data becomes derived.",
        numbers: ["~10M edits/day, ~120 writes/s", "under 0.5% move a coordinate", "a bad coordinate costs a 5 to 10 minute rebuild"],
        breaks:
          "Sanity checks catch coordinates in the ocean, not coordinates two streets away, so deliberate low-grade spoofing gets through. The second net is a per-cell entry-count anomaly on the build side, which notices a cell that suddenly gained a thousand places.",
        choice: {
          pick: "Validate and quarantine coordinates at write time",
          instead: "Accept anything and filter suspect entries during the build or at query time.",
          decider:
            "Where the cost lands. Rejecting at write is one bounds check on 120 writes/s; filtering at build is a rule applied to 200M rows every cycle, and filtering at query time is per-candidate work on a path budgeted at 5ns. The asymmetry is 120/s against 2.4M/s.",
          flips:
            "Bulk imports from a partner feed, where rejecting a row at write means rejecting the whole file, and quarantine plus reconciliation is the only workable shape.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "clamp",
      label: "lat, lng, radius, filters",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The search request: a point, a radius in kilometres, an optional category and an open-now flag.",
        why: "Everything about the cost of this query is decided by two of these fields. The point selects the cell and the radius selects the precision tier, which together fix how many candidates the scan will touch.",
        numbers: ["5B searches/day", "60k/s average, 300k/s peak"],
        breaks:
          "The radius arrives untrusted. One client asking for 50km in a dense metro is 15.7M entries scanned, so validation here is a capacity control rather than input hygiene.",
      },
    },
    {
      id: "e2",
      from: "clamp",
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
      from: "clamp",
      to: "block",
      label: "cache miss, ~120k/s",
      animated: true,
      detail: {
        what: "The 40% of queries the cache did not answer, carrying a clamped radius and a validated point, handed to the next stage in the same process.",
        why: "The radius is already bucketed by the time it gets here, so the planner only has to map a bucket to a precision tier rather than reason about arbitrary values. That is what keeps three tiers sufficient.",
        numbers: ["300k/s peak x (1 - 0.6) = ~120k/s", "a function call, not a hop"],
        breaks:
          "If the cache hit rate collapses, for example after a bulk edit triggers cell-prefix invalidation, this arrow instantly carries 300k/s and the index tier is sized for 120k/s.",
      },
    },
    {
      id: "e4",
      from: "block",
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
      id: "e6",
      from: "scan",
      to: "geo-index",
      label: "15 range probes",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Fifteen range reads into the sorted packed array, one per cell id in the block, returning every entry filed under those cells.",
        why: "Entries are sorted by cell id, so a cell is a contiguous range rather than a scattered set of rows, and the mapping is local, so this is a memory walk rather than a network call. Both properties are why a candidate costs 5ns.",
        numbers: ["p99 ~22,000 entries returned", "48B each, ~5ns to test", "110µs at p99, 8.5µs at the median"],
        breaks:
          "The first probe after a promotion touches cold pages, so a freshly flipped node runs slow until the mapping is warm. Warming before the flip is part of promotion for that reason.",
      },
    },
    {
      id: "e7",
      from: "scan",
      to: "overlay",
      label: "moves + tombstones",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The overlay consulted alongside the artifact: businesses whose coordinates changed since the build, and deletions filtered out during the scan.",
        why: "It is what stops index freshness being a whole build cycle. At 0.6 coordinate writes a second the correction set is tiny, so correctness costs a hash probe per candidate rather than a different architecture.",
        numbers: ["~50k entries", "checked per candidate"],
        breaks:
          "A business that moved has to be suppressed at its old cell as well as added at its new one, or the same place appears twice in one result set.",
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
      animated: true,
      fromSide: "left",
      toSide: "right",
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
      from: "artifact-store",
      to: "geo-index",
      label: "mmap + pointer flip",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A node pulling the current artifact version to local disk, memory-mapping it, warming it and flipping its pointer to the new mapping.",
        why: "This is the only way new geometry reaches a serving node, and it is a file operation rather than a write, which is what makes rollback a pointer flip back to a mapping that is still open.",
        numbers: ["10GB per version", "previous mapping stays resident", "flip is atomic per node"],
        breaks:
          "The artifact is global, so a bad version promoted here is a global search outage rather than a partial one. Nothing downstream of this arrow can detect that the geometry is wrong, only that it changed.",
      },
    },
    {
      id: "e11",
      from: "artifact-store",
      to: "card-store",
      label: "60GB card set",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The display projection from the same build pass, 60GB of 300-byte cards loaded across the in-memory shards.",
        why: "Both derived stores come out of one pass over the catalogue so they cannot disagree about which places exist. A card missing for an id the index still returns is a partially rendered result.",
        numbers: ["200M x 300B = ~60GB", "distributed per build cycle"],
        breaks:
          "Cards and index entries land independently, so an id in the new artifact may have no card yet. The result degrades to name and rating rather than failing, which is why hydration has a fallback at all.",
      },
    },
    {
      id: "e12",
      from: "edit-stream",
      to: "overlay",
      label: "coordinate moves",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Coordinate changes and deletions fanned out to every serving node between builds, landing in the per-node overlay map and tombstone set.",
        why: "Under 0.5% of the 10M daily catalogue edits move a coordinate, so this is a trickle rather than a stream. Ratings and hours are not carried here; they are rebuilt on a faster cadence than the geometry because they are the fields that actually move.",
        numbers: ["50k of 10M daily edits", "0.6/s against 60k reads/s"],
        breaks:
          "Every node applies this independently, so a node that missed messages diverges from its neighbours with nothing to reconcile it until the next build lands.",
      },
    },
    {
      id: "e13",
      from: "edit-stream",
      to: "result-cache",
      label: "cell-prefix invalidation",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Best-effort invalidation: an edit is translated into the cell prefixes whose cached pages might contain it, and those keys are dropped.",
        why: "The key includes category, radius bucket and page, so one business edit touches an unbounded set of keys that cannot be enumerated. Prefix invalidation is the only tractable approximation, and it is an optimisation on top of the TTL rather than the mechanism.",
        numbers: ["60s TTL is the real mechanism", "bulk edits rate-limited into this path"],
        breaks:
          "It over-invalidates badly. A chain updating hours across 3,000 locations wipes the hot cells in every major metro at once, the blended hit rate falls from 60% toward zero for the 60 seconds it takes to refill, and backend QPS triples at the worst possible moment.",
      },
    },
    {
      id: "e14",
      from: "build-promote",
      to: "artifact-store",
      label: "publish + canary",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The validated build published as a new immutable version, with the previous version retained for rollback.",
        why: "Publishing and promoting are the same step only because the artifact is immutable: nodes discover the new version and flip on their own schedule, so a roll is a property of the fleet rather than a coordinated event.",
        numbers: ["N-1 versions retained", "rollback is a pointer flip, not a rebuild"],
        breaks:
          "A publish that succeeds but distributes slowly leaves the fleet mixed for longer than the canary window assumed, so artifact age across the fleet is the metric, not publish success.",
      },
    },
    {
      id: "e15",
      from: "catalogue",
      to: "edit-stream",
      label: "coordinate edits, 0.6/s",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Committed catalogue changes published to the stream: coordinate moves, deletions, and the edits that make cached pages wrong.",
        why: "The stream is fed from the transaction rather than from the application, so an edit that committed is an edit that will be published. Anything weaker and the two derived stores drift from the record with no way to notice.",
        numbers: ["~10M edits/day total", "50k of them carry a coordinate"],
        breaks:
          "If this stalls, nothing errors: search keeps answering from the last build, confidently, with stale locations. Stream lag is a freshness metric rather than an availability one.",
      },
    },
    {
      id: "e16",
      from: "catalogue",
      to: "build-map",
      label: "nightly full pass",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The build job reading the whole catalogue: a map over 400GB producing one 48-byte entry and one 300-byte card per place, then a sort by cell id.",
        why: "The index is derived state, so it is regenerated rather than reconciled. A rebuild that takes minutes rather than hours is what makes rebuild an ordinary response to a suspected problem instead of an outage.",
        numbers: ["400GB mapped, 10GB sorted", "5 to 10 minutes on a modest cluster"],
        breaks:
          "It reads a live transactional store, so the pass has to be taken against a snapshot or the artifact contains a smear of several minutes of edits, which shows up as a corpus diff nobody can explain.",
      },
    },
    {
      id: "e17",
      from: "build-map",
      to: "build-gate",
      label: "10GB sorted by cell id",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The candidate artifact handed to validation before anything is published.",
        why: "Nothing between here and the fleet can tell a truncated artifact from a valid one, so this is the last point where the previous version is still available for comparison.",
        numbers: ["10GB index, 60GB cards", "compared against the outgoing version"],
        breaks:
          "A half-failed build produces a file that opens and probes correctly and is simply missing places. The failure is silent by construction, which is why the next stage is a diff rather than a health check.",
      },
    },
    {
      id: "e18",
      from: "build-gate",
      to: "build-promote",
      label: "1% band + corpus diff",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The gate's verdict: entry count within 1% of the previous artifact, per-region checksums sane, and the recorded query corpus returning matching result sets within tolerance.",
        why: "Promotion is the irreversible-ish step, so everything that can be checked offline is checked before it. The band is deliberately tight enough to trip on real growth, because a human confirming 2% is cheaper than a global outage.",
        numbers: ["refuse promotion outside a 1% entry-count band", "corpus replayed against both versions"],
        breaks:
          "It compares against yesterday, so an error present in every build passes every time. The canary diff on live traffic is the second net, and neither catches a systematic bug in the encoder.",
      },
    },
    {
      id: "e19",
      from: "ingest",
      to: "catalogue",
      label: "validated writes, ~120/s",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Business creates, edits and deletes committed to the source of truth after coordinate sanity checks.",
        why: "This is the only arrow that writes anything durable in the whole diagram. Everything else is derived from what lands here, which is why validation sits before it rather than anywhere downstream.",
        numbers: ["~10M edits/day, ~120 writes/s", "under 0.5% move a coordinate"],
        breaks:
          "A bad coordinate committed here is baked into the next artifact and takes a full rebuild to remove, so the cost of a missed check is 5 to 10 minutes of wrong results rather than a rejected request.",
      },
    },
  ],
};
