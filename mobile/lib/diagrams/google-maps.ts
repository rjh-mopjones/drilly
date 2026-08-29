import type { Diagram } from "./types";

export const GOOGLE_MAPS: Diagram = {
  id: "google-maps",
  title: "Google Maps",
  question: "Design Google Maps",
  sourceId: "patterns",
  itemId: 15,
  overview: {
    shape:
      "Three subsystems share a road-graph source and little else: tiles are static assets, traffic is stream aggregation, and routing is precomputed in advance.",
    forces: [
      {
        constraint: "350k tile requests/s at commute peak, with no per-user variation in the answer",
        decision: "Tiles are pre-rendered vector geometry cached at the edge, so the CDN absorbs over 95% of requests",
        lights: ["tile-origin", "e-tiles"],
      },
      {
        constraint: "An unguided search over ~10M nodes costs ~0.5s of CPU; 10k route computes/s needs 5,000 cores at that rate",
        decision: "A precomputed shortcut hierarchy takes the same query to ~1ms, 10 cores instead of 5,000",
        lights: ["routing-pod", "cch-topology", "upward-search"],
      },
      {
        constraint: "Live traffic weights refresh every 5 minutes, but rebuilding the shortcut hierarchy takes hours",
        decision: "Preprocessing splits into a weekly Order builder pass and a ~1s Customisation pass, published as separate artefacts",
        lights: ["order-builder", "customisation-pass", "cch-topology", "weight-metric"],
      },
      {
        constraint: "A closed road produces zero probes, so it looks exactly like a quiet one to the aggregator",
        decision: "The Closure override gate writes confirmed closures straight into the live weight array, skipping the window",
        lights: ["closure-gate", "e23"],
      },
      {
        constraint: "~300M probes per window cover only ~3% of the world's 150M edges",
        decision: "Speed profiles supply a time-of-day prior for the other 97%, which the router treats as an equally good number",
        lights: ["history-profiles", "e19"],
      },
    ],
    naive: {
      text: "Ask the routing question fresh on every request: run Dijkstra over the full road graph using whatever the current traffic weights say, from scratch, every time. An unguided search over a ~10M-node continental graph costs about 0.5s of CPU. Answering 10k route computes/s that way needs roughly 5,000 cores running flat out against a 100ms budget. The design instead spends that cost once, in advance. The Order builder precomputes a shortcut hierarchy from graph shape alone, and the Customisation pass sweeps fresh weights over it in about a second. The Upward search then only ever touches hundreds of nodes per query.",
      lights: ["upward-search", "order-builder", "customisation-pass"],
    },
    beats: [
      {
        text: "Size each subsystem on its own numbers and they never meet: 350k tile requests/s at commute peak, 10k route computes/s, and roughly 1M GPS probes/s. There is no shared bottleneck, and the price of that is three pipelines that must stay in agreement about one graph.",
        lights: ["tile-origin", "routing-pod", "traffic-agg"],
      },
      {
        text: "Tiles are the cheap half. Slice the world into a quadtree keyed by (zoom, x, y), encode geometry rather than pixels, render once and cache at the edge. The quadtree is 1.4T addressable tiles at z=0 to 20, of which 1 to 5% materialise. That is ~50B tiles at 30KB blended, a 1.5PB corpus behind a CDN that absorbs over 95% of requests.",
        lights: ["tile-origin", "e-tiles"],
      },
      {
        text: "Routing decides everything on one number. A continental graph is ~10M nodes and ~30M edges, and an unguided search settles most of it. That is about 0.5s of CPU per query, so 10k/s needs 5,000 cores for something with a 100ms budget. Preprocessing a shortcut hierarchy takes the same query to ~1ms, which is 10 cores.",
        lights: ["routing-pod", "cch-topology"],
      },
      {
        text: "The bill arrives when the weights move. A hierarchy is correct only for the metric it was built with, so preprocessing splits in two. A contraction order is derived from graph shape alone, rebuilt weekly because that is how often roads physically change. A customisation pass over the current travel times runs in about a second and emits a fresh 240MB weight array every five minutes.",
        lights: ["order-builder", "customisation-pass", "weight-metric", "cch-topology"],
      },
      {
        text: "Traffic closes the loop. Anonymised probes are map-matched to segments, reduced with a trimmed mean over a 5-minute tumbling window with hysteresis so segments do not flap, and published as the next metric. Verified closures skip the window entirely on an override channel, because a closed road produces no probes and therefore looks exactly like a quiet one.",
        lights: ["traffic-agg", "closure-gate", "e21"],
      },
      {
        text: "The honest concession is coverage. Roughly 300M probes per window land on about 3% of the world's 150M edges. Every other edge carries a historical time-of-day profile that the router treats as an equally good number. A road nobody is routed onto never gets probes, so its estimate never improves.",
        lights: ["history-profiles", "e19", "e20"],
      },
    ],
    crux: {
      problem:
        "A shortcut hierarchy is only correct for the weights it was built with, and live traffic replaces those weights every five minutes. Overlaying deltas does not repair it. The witness decisions that chose which shortcuts exist were taken under the old numbers. A shortcut that is now required may simply not be there, and nothing at query time can detect it.",
      handled:
        "The design never overlays deltas on a stale hierarchy. It splits preprocessing into a metric-independent topology, valid for any non-negative weights, and a full bottom-up recustomisation every five minutes that recomputes every shortcut weight from scratch. Nothing is patched, so no shortcut can go missing the way an overlay would leave it. What remains unfixed is the topology itself, which is only correct until the next weekly rebuild, and a version mismatch between the two artefacts is refused rather than served.",
    },
    numbers: [
      {
        value: "5,000 cores unguided against 10 with a customisable hierarchy, at 10k route computes/s",
        explain: "The preprocessing payoff in one number: four orders of magnitude of compute, paid once rather than on every query.",
      },
      {
        value: "1.5PB vector tile corpus, 95%+ CDN hit rate, ~350k tile requests/s at peak",
        explain: "The scale of the tile-serving problem and how little of it the origin actually sees, since caching absorbs nearly all of the peak.",
      },
      {
        value: "~1M probes/s reduced into a 240MB weight metric per continent every 5 minutes",
        explain: "The traffic pipeline's whole job in one line: a huge, noisy input stream collapsed into a small, versioned artefact the router can swap in atomically.",
      },
      {
        value: "topology rebuilt weekly, metric rebuilt every 5 minutes",
        explain: "The two clocks preprocessing runs on, split because they change for entirely different reasons: road construction versus congestion.",
      },
      {
        value: "~97% of edges fall back to a historical profile in any window",
        explain: "How thin real-time coverage actually is; almost every edge the router costs is priced from a prior rather than a live measurement.",
      },
    ],
  },
  nodes: [
    // ---------------------------------------------------------------- client
    {
      id: "client",
      label: "Client",
      sub: "map view + navigation session",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The phone or browser: it fetches tiles, asks for a route once, then runs the navigation session itself against the polyline it was handed.",
        why: "Re-planning is the server's job and noticing that a re-plan is needed is the client's. Matching its own GPS to the polyline locally is what stops 2.5M concurrent navigations from becoming 80k requests/s of drift correction.",
        numbers: [
          { value: "~20 tiles opened per session", explain: "The typical tile load for one map view, which is what the CDN sizing is built from." },
          { value: "~900k concurrent navigations average, ~2.5M at peak", explain: "The scale of the client population whose GPS drift is handled locally rather than server-side." },
          { value: "re-plan only after >50m off the polyline for >10s", explain: "The threshold that turns ordinary GPS noise into a decision to ask the server again." },
        ],
        breaks: {
          failure: "A client that asks the server on every GPS tick turns ordinary position noise into a re-plan storm.",
          handled: "The 50m and 10s thresholds are the only thing holding that line, converting a continuous noisy signal into a rare, deliberate request.",
        },
        choice: {
          pick: "Server plans, client watches: pull the polyline plus a tile corridor at trip start",
          instead: "Ship a compact routing graph to the device and re-plan entirely on the phone.",
          decider:
            "Re-plan volume against download size and metric freshness. 2.5M concurrent navigations re-planning roughly once per 10 minutes of driving is 4.2k computes/s, about 4 cores, so compute is not the reason to keep it server side. The on-device graph is 100MB to 1GB per region and its metric is only as fresh as the last sync.",
          flips:
            "Connectivity rather than compute is the constraint: offline navigation as a product requirement, roaming users, long tunnels. Ship both and label on-device an explicitly degraded mode, telling the client how old the metric it holds is.",
        },
      },
    },

    // ----------------------------------------------------------------- tiles
    {
      id: "tile-origin",
      label: "Tile object store",
      sub: "MVT vector tiles, ~1.5PB",
      kind: "blob",
      col: 0,
      row: 1,
      detail: {
        what: "The materialised tile corpus in object storage: one gzipped MVT object per (z, x, y) that has any content in it, carrying geometry and properties rather than pixels. A global CDN edge cache fronts every read, keyed purely on (z, x, y), and a batch builder re-renders behind it when a diff touches a tile.",
        why: "The quadtree holds 4^z tiles per zoom, so z=0 to 20 is (4^21 - 1)/3, or about 1.4T addressable tiles. Around 70% of the surface is ocean and most high-zoom land tiles are empty, so you store what exists rather than what is addressable. Tile popularity is Zipfian, so caching city-centre tiles at the edge turns 350k requests/s into an origin that sees single-digit thousands. Geometry changes on the diff feed's clock rather than traffic's, so re-rendering only the touched bounding boxes keeps that cheap.",
        numbers: [
          { value: "1.4T addressable, 1 to 5% materialise", explain: "The full quadtree size against what actually has content; nearly all addressable tiles are ocean or empty land." },
          { value: "~50B tiles x 30KB blended = 1.5PB", explain: "The materialised corpus size, the number the storage and cache tiers are actually built against." },
          { value: "10 to 50KB per tile, rural against dense urban", explain: "The per-tile size range; a dense city tile carries far more geometry than a rural one at the same zoom." },
          { value: "CDN: 95%+ hit rate, ~350k req/s peak, 5.8k-17k/s reaching the origin", explain: "The effect of edge caching on origin load, which is what makes the origin fleet small relative to total request volume." },
          { value: "builder: ~3M edits/day, ~1% of tiles touched/week, 15TB/week re-render", explain: "How much of the corpus the batch builder actually rewrites, driven by upstream map edits rather than traffic." },
        ],
        breaks: {
          failure: "Object count rather than bytes: 50B objects is a metadata problem in its own right, and any operation that wants to enumerate or sweep the corpus will not finish.",
          handled: "A large diff invalidating millions of tiles collapses the edge hit rate and the origin takes the whole difference. Popular tiles are pre-warmed before the version pointer flips, and the invalidation set is deduped and ordered by predicted miss rate.",
        },
        choice: {
          pick: "One vector (MVT) corpus of immutable objects in blob storage, styled on the client",
          instead: "Pre-rendered raster pyramids, one PNG set per style and display density.",
          decider:
            "Styles multiplied by densities. One corpus is 1.5PB; raster costs that per style, so three styles is 4.5PB and a high-density pyramid roughly doubles it again. A style change on raster re-renders 1.5PB, while on vector it is a client release.",
          flips: "Clients that cannot render: embedded head units, e-ink, print, thumbnails and social previews. Answer with a server-side renderer over the same vector tiles so raster is an output format rather than a second pipeline.",
        },
      },
    },
    {
      id: "map-source",
      label: "Map data source",
      sub: "OSM diff feed, ~3M edits/day",
      kind: "external",
      col: 1,
      row: 1,
      detail: {
        what: "The upstream road data everything is derived from: an OpenStreetMap diff feed (or a proprietary survey extract) carrying geometry, topology and restrictions such as one-ways, turn bans and vehicle class.",
        why: "It is the single source the tile and routing pipelines share. The whole 'three pipelines, one graph' shape of this design only means something because tiles and the contraction order are two different renderings of the same upstream edits. The verified-closure channel that feeds the override gate is a separate, faster feed from separate upstream sources, not a variant of this diff.",
        numbers: [
          { value: "~3M edits/day on the OSM diff feed", explain: "The raw ingest rate everything downstream ultimately derives from." },
          { value: "~50M routable nodes and ~150M edges globally", explain: "The full global graph size, before it is split into continental shards for routing." },
          { value: "~10M nodes and ~30M edges per continent", explain: "The per-continent slice that each routing pod actually holds resident." },
        ],
        breaks: {
          failure: "A newly added road is invisible until its tiles re-render (hours), unroutable until the order rebuilds (up to a week), and unweighted until probes arrive (never, if nobody drives it).",
          handled: "Nothing reports that divergence because each pipeline is individually healthy. It is structural, and it is the cost of three clocks running on their own schedules.",
        },
        choice: {
          pick: "Ingest an open diff feed and treat it as an external dependency",
          instead: "A proprietary survey and imagery pipeline owned in house.",
          decider:
            "What it actually changes. Source choice changes ingestion, licensing and the tile pipeline built around the ~3M edits/day feed. It changes nothing about the serving path or the routing algorithm, so it is not an architecture fork. It is a data-quality and legal decision wearing an architecture costume.",
          flips: "Coverage or liability requirements the open feed cannot meet: lane-level geometry, verified speed limits, or markets where the community map is thin. Then it becomes an owned pipeline with its own editors and QA, feeding exactly the same consumers.",
        },
      },
    },

    // --------------------------------------------------------------- routing
    {
      id: "routing-pod",
      label: "Routing pod",
      kind: "serviceGroup",
      col: 1,
      row: 0,
      detail: {
        what: "One deployable query server per continent, holding the shortcut hierarchy in memory and answering a route request end to end: search, unpack, ETA.",
        why: "They run as stages rather than peers because they share the resident graph and the current metric, and a network hop between them would cost more than the query itself. Search, unpack and cost are three sequential steps inside one process, not three services.",
        numbers: [
          { value: "~10M nodes and ~30M edges per continent", explain: "The graph size held resident by each pod." },
          { value: "~2GB topology + 240MB metric resident", explain: "2GB + 240MB ≈ 2.24GB per pod; × 6 continents ≈ 12GB — small enough that memory was never the reason to split by continent." },
          { value: "~10k route computes/s at peak, 100ms in-pod budget", explain: "The throughput and latency target every stage inside the pod has to fit within." },
        ],
        breaks: {
          failure: "Sharding does not rescue a shortest-path query, it splits the answer rather than the load.",
          handled: "Any route crossing a boundary needs both shards plus a boundary-node table to join them. Lisbon to Warsaw runs 3 to 5x slower through that stitch, and fails outright if the two regions are on different order versions.",
        },
        choice: {
          pick: "One continent's graph resident per pod, pods pinned per region",
          instead: "A global graph on one large box, or fine-grained sharding by metro area.",
          decider:
            "Blast radius, not RAM. All six continents is ~12GB, which would physically fit one machine, so memory is not the reason to split. The reason is that an order rebuild is a continent-wide event and you want it to fail in one region at a time. Sharding finer than a continent starts stitching ordinary domestic routes.",
          flips: "A single-country product, where the whole graph is a few hundred megabytes and one pod class with no stitch path at all is strictly simpler.",
        },
      },
    },
    {
      id: "upward-search",
      label: "Upward search",
      sub: "~1ms, settles hundreds of nodes",
      kind: "process",
      col: 1,
      row: 0,
      parent: "routing-pod",
      detail: {
        what: "The query itself: relax only edges toward higher-ranked nodes from the source, and only edges from higher-ranked nodes in the reverse graph from the target. It stops when the smallest tentative key exceeds the best combined distance found.",
        why: "The 100ms budget makes an unguided search impossible, so the pod does almost no exploration. Every shortcut stands for a real path, so this is exact rather than approximate, a property most alternative speedups cannot claim.",
        numbers: [
          { value: "~1ms per query customisable, ~150μs classic", explain: "The query latency under the customisable hierarchy this design uses, against a classic fixed-metric hierarchy's faster but inflexible alternative." },
          { value: "hundreds of nodes settled instead of millions", explain: "The exploration this search actually does, orders of magnitude below an unguided search over the same graph." },
          { value: "~10k route computes/s at peak", explain: "The query rate this stage has to sustain, matching the pod's overall throughput target." },
        ],
        breaks: {
          failure: "Exactness is a claim about the algorithm, not about the road.",
          handled: "The answer is optimal with respect to a metric that is up to 5 minutes old, so a route can be provably shortest and still wrong about the world.",
        },
        choice: {
          pick: "Bidirectional upward search over a resident shortcut hierarchy",
          instead: "Unguided or plain bidirectional Dijkstra over the raw graph, or A* guided by lower bounds from 16 to 32 landmark nodes.",
          decider:
            "Cores. An unguided continental query is ~0.5s of CPU, so 10k/s needs 5,000 cores running flat out. The hierarchy query at ~1ms needs 10. Four orders of magnitude, paid once in preprocessing, is the reason the entire design exists. Landmarks buy only ~10x.",
          flips:
            "A city-sized graph, where a plain search returns in milliseconds and hours of preprocessing is pure operational cost. Landmark-guided A* also wins as a targeted fallback inside a region whose closure has landed but whose customisation pass has not run.",
        },
      },
    },
    {
      id: "shortcut-unpack",
      label: "Shortcut unpacking",
      sub: "recursive, recovers segments",
      kind: "process",
      col: 1,
      row: 0,
      parent: "routing-pod",
      detail: {
        what: "The winning path is a chain of shortcuts, each standing in for a two-hop path through a contracted node. Unpacking expands them recursively until only original road segments remain, which is what the polyline and the turn list are built from.",
        why: "Without it the pod would return an answer that is correct and undrawable. The search deliberately never touches the low-ranked residential edges the driver actually turns onto, so those have to be recovered afterwards.",
        numbers: [
          { value: "roughly one shortcut per original edge in the hierarchy", explain: "How much the hierarchy grows beyond the raw graph, the price paid for the search's speed." },
          { value: "unpacking is a small fraction of the ~1ms query", explain: "Why this stage never threatens the latency budget the search stage already meets." },
        ],
        breaks: {
          failure: "Unpacking is where a topology/metric version mismatch surfaces as garbage rather than as an error.",
          handled: "If the metric was customised against a superseded order, the middle-node references expand into segments that do not join up, which is caught by refusing mismatched versions upstream.",
        },
        choice: {
          pick: "Store one middle node per shortcut and expand recursively at query time",
          instead: "Materialise the full segment list for every shortcut at preprocessing time.",
          decider:
            "Memory against a few microseconds. A middle node is 4 bytes on 30M shortcuts. Storing full paths is unbounded, because a top-level motorway shortcut can stand for hundreds of segments. That would multiply the 2GB resident footprint several times over for latency nobody can measure.",
          flips: "A tiny graph where the whole expanded path set fits comfortably and preprocessing is cheap. Or a pure cost query (an ETA matrix), where the polyline is never needed and unpacking can be skipped entirely.",
        },
      },
    },
    {
      id: "eta-model",
      label: "ETA model",
      sub: "current weights then profiles",
      kind: "process",
      col: 1,
      row: 0,
      parent: "routing-pod",
      detail: {
        what: "Turns the unpacked path into an arrival time, costing the near part of the trip on the current metric and the far part on historical time-of-day profiles.",
        why: "A 40-minute route uses this window's numbers for a segment you reach in 35 minutes, which is exactly the segment most likely to be wrong, because congestion moves. The hybrid is the shipped compromise between a scalar metric and full time-dependent routing.",
        numbers: [
          { value: "NFR: ETA error p50 under 10% of trip duration", explain: "The accuracy target this model is held to." },
          { value: "current weights for the first 15 to 20 minutes, historical profiles beyond", explain: "The handover point between live and historical costing inside one trip." },
        ],
        breaks: {
          failure: "The drift shows up as ETA error rather than as a visibly bad route, so it is easy to under-measure.",
          handled: "The map looks right and the clock is wrong. Some mid-trip re-plans are correcting our own earlier optimism rather than reacting to new traffic, which is tracked separately from genuine traffic-driven re-plans.",
        },
        choice: {
          pick: "Hybrid: current metric for the first 15 to 20 minutes, historical profile beyond",
          instead: "Fully time-dependent routing, where each edge weight is a function of departure time.",
          decider:
            "Customisation cost multiplied by the number of time buckets, and the query itself. Time-dependent weights multiply the ~1s sweep by every bucket. The bidirectional search also stops working cleanly, because the backward search does not know the arrival time it should be searching from. The hybrid costs one extra lookup per edge.",
          flips: "Scheduled transit, where the timetable is the metric and there is no meaningful time-independent weight at all, or freight planning hours ahead where departure time is the variable being optimised.",
        },
      },
    },

    // ------------------------------------------------- preprocessed artefacts
    {
      id: "hierarchy-group",
      label: "Preprocessed hierarchy: two artefacts, two clocks",
      kind: "zone",
      detail: {
        what: "The structure the router queries, split into a topology that depends only on road-network shape and a weight array that depends only on current travel times. They are published separately and swapped separately.",
        why: "Conflating these is the classic mistake. The topology takes hours and changes when a road is built; the weights take a second and change every traffic window. Keeping them apart is what lets freshness be a file swap rather than a rebuild.",
        numbers: [
          { value: "topology ~2GB per continent, weekly", explain: "The slower of the two clocks by three orders of magnitude — why a bad rebuild is a rollback, not a hot-path incident, and freshness stays a metric-only concern." },
          { value: "metric 240MB per continent, every 5 minutes", explain: "~8.5x smaller than the topology and refreshed ~2,000x more often — cheap enough that a full swap is a pointer flip, not a rebuild." },
        ],
        breaks: {
          failure: "The two must agree on edge ids.",
          handled: "A metric produced against the previous order is not stale, it is nonsense. Both artefacts carry the order id they belong to, and a pod refuses a pair that disagrees.",
        },
      },
    },
    {
      id: "cch-topology",
      label: "Hierarchy topology",
      sub: "order + shortcuts, ~2GB",
      kind: "blob",
      col: 2,
      row: 1,
      parent: "hierarchy-group",
      detail: {
        what: "An immutable versioned artefact: the node order and the shortcut edges it implies, published to object storage weekly and loaded into pod memory as flat arrays.",
        why: "At rest it is a file, which is what makes rollback trivial; in the pod it is a data structure, not a dataset. Nothing about a shortest-path search survives contact with a query planner, and a single query touches this structure hundreds of times inside a millisecond.",
        numbers: [
          { value: "30M edges plus ~30M shortcuts = 60M", explain: "The full edge count the hierarchy holds, roughly double the raw graph." },
          { value: "60M x 32B = 1.9GB, call it 2GB per continent", explain: "The memory footprint that follows directly from the edge count." },
          { value: "all six continents ~12GB", explain: "The total footprint across every pod, small enough to fit one machine class." },
        ],
        breaks: {
          failure: "A partial or corrupt order promoted after a rebuild fails continent-wide.",
          handled: "A pod must refuse to load one whose fixture routes do not recost sensibly against the previous order, and the previous artefact must stay loadable.",
        },
        choice: {
          pick: "Immutable versioned artefact in blob storage, loaded into resident arrays",
          instead: "A graph database, or a sharded store queried per hop.",
          decider:
            "Access pattern against size. The query settles hundreds of nodes inside ~1ms, so a per-hop network round trip is three orders of magnitude too slow, and the artefact is only 2GB per continent anyway. Keeping it as a versioned object rather than a live store is what makes an order rollback a pointer change.",
          flips: "Ad-hoc traversal workloads, k-hop neighbourhoods or reachability questions, where a query language earns its keep and the latency budget is a human's patience rather than 100ms.",
        },
      },
    },
    {
      id: "weight-metric",
      label: "Weight metric",
      sub: "one float per edge, 240MB",
      kind: "blob",
      col: 2,
      row: 0,
      parent: "hierarchy-group",
      detail: {
        what: "A versioned, immutable array of edge weights for the current traffic window, published every 5 minutes and swapped into pods behind an atomic pointer flip.",
        why: "Making the metric a separate artefact from the topology is the entire design. Freshness becomes a file swap rather than a rebuild, and a disputed route can be replanned against the exact version that produced it.",
        numbers: [
          { value: "60M edges x 4B = 240MB per continent", explain: "The artefact size, small enough to swap in atomically every window." },
          { value: "69GB per continent per day at a 5-minute cadence", explain: "The daily volume of versions produced, cheap enough to keep a full day at full cadence." },
          { value: "last 24h kept at full cadence, hourly samples beyond", explain: "The retention policy that balances reproducibility for recent complaints against storage cost." },
        ],
        breaks: {
          failure: "A query must never see half a metric.",
          handled: "Without an atomic swap a route is computed against a mixture of two windows, which is a wrong answer with no error attached to it. The pointer flip guarantees every reader sees one complete version or the other.",
        },
        choice: {
          pick: "Immutable versioned weight array, promoted by an atomic pointer flip",
          instead: "Mutating weights in place, or overlaying traffic deltas on a classic hierarchy.",
          decider:
            "Consistency and reproducibility against storage cost. 240MB per continent per window is 69GB/day, cheap enough to keep 24 hours at full cadence, and it is the only way to reproduce a specific complaint. An overlay on a classic hierarchy is worse than stale: the witness decisions that chose which shortcuts exist were made under the old weights. A missing shortcut cannot be repaired by adjusting numbers.",
          flips: "A single-node or development setup with one reader, where in-place mutation is simpler and there is no rollback story worth paying for.",
        },
      },
    },
    {
      id: "order-builder",
      label: "Order builder",
      sub: "nested dissection, weekly",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "The batch job that derives a node ordering from graph structure alone and inserts every shortcut that order implies, with no witness search and no weights involved.",
        why: "This is the half of preprocessing that must not depend on travel time. Deriving the order by nested dissection over a separator hierarchy makes the resulting topology valid for any non-negative metric, which is exactly what lets weights be refreshed without touching structure.",
        numbers: [
          { value: "single-digit hours per continent", explain: "The build time for one full order rebuild, why it can only run on a slow, weekly cadence." },
          { value: "rebuilt once a week, tracking when roads physically change", explain: "The cadence chosen to match construction, not congestion." },
          { value: "adds roughly one shortcut per original edge", explain: "The growth this pass adds to the graph, roughly doubling edge count." },
        ],
        breaks: {
          failure: "An order rebuild changes every node rank and the whole shortcut set at once, invalidating every cached route and every warm metric.",
          handled: "It is the risky job even though it is the rare one. Both orders are shadowed on live traffic and the previous artefact stays loadable, so a bad rebuild can be rolled back cleanly.",
        },
        choice: {
          pick: "Metric-independent order by nested dissection, rebuilt weekly",
          instead: "Classic contraction hierarchies (Geisberger and co-authors, 2008): order by edge difference with a witness search, rebuilt nightly against one fixed metric.",
          decider:
            "How often the metric changes measured against how long preprocessing takes. Classic contraction is hours per continent and the traffic window is 5 minutes, so its structure is permanently built for stale weights. The metric-independent order carries more shortcuts and costs ~1ms per query instead of 150μs, which is 10 cores rather than 1.5 at 10k/s.",
          flips: "A metric that does not move: walking, cycling, distance-optimal routes, or a freight network fixed by bridge heights and weight limits. Take classic contraction and the 150μs, because there is nothing to customise.",
        },
      },
    },
    {
      id: "customisation-pass",
      label: "Customisation pass",
      sub: "bottom-up sweep, ~1s",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "One bottom-up sweep over the contracted nodes, setting every shortcut weight to the minimum over its two-hop paths under current travel times. The result publishes as a new metric version.",
        why: "This is the cheap half of preprocessing and the reason the split works. No search, no witness checks, one pass, parallel by level, so a structure built once keeps tracking a metric that is replaced every five minutes.",
        numbers: [
          { value: "~1s for a continent-sized graph", explain: "The runtime of one full sweep, cheap enough to run every window without falling behind." },
          { value: "every 5 minutes = 0.3% duty cycle", explain: "How little of the window this pass actually occupies." },
          { value: "emits 240MB keyed by edge id", explain: "The output artefact size, matching the weight-metric store's per-window footprint." },
        ],
        breaks: {
          failure: "It is a global serialisation point per continent.",
          handled: "If the aggregator's window does not close on time, every pod in the region silently keeps serving the previous metric. Metric age is the page-worthy number, and alerts fire above 120s.",
        },
        choice: {
          pick: "Recompute every shortcut weight bottom-up, once per traffic window",
          instead: "Re-run the full contraction each night, or patch only the shortcuts whose underlying edges changed.",
          decider:
            "Cost against correctness. The full sweep is about a second per continent, a 0.3% duty cycle at a 5-minute cadence, so selective patching optimises something already free. Contraction itself is hours per continent and cannot run per window at any price.",
          flips: "A metric where only a handful of edges move between windows, such as a closure-only feed with no live speeds. There the override channel already delivers the change, and a sweep buys nothing.",
        },
      },
    },

    // --------------------------------------------------------------- closures
    {
      id: "closure-gate",
      label: "Closure override gate",
      sub: "two-source confirm, kill switch",
      kind: "service",
      col: 0,
      row: 3,
      detail: {
        what: "Our side of the override channel: it confirms, rate-limits and applies closures reported by third parties (transport authorities, police, highways feeds, roadworks schedules). It writes edges impassable straight into the live weight array and hands the same set to the next customisation pass.",
        why: "The external feed is a claim; this is the component that decides whether to act on it. It exists because the override path writes into a live artefact with none of the gating a deploy gets. That gating has to live somewhere, and it cannot live in the third party. A closed road produces no probes, which reads to the aggregator exactly like a quiet road, so this is the one input the traffic pipeline structurally cannot derive itself. The third-party feed itself has no place in this system: it is an API call arriving from outside the trust boundary, not a service we operate or size.",
        numbers: [
          { value: "impassable within 60s of a confirmed closure", explain: "The latency target this gate has to meet once a closure is confirmed." },
          { value: "two-source confirmation on motorway-class edges", explain: "The bar for acting automatically on the highest-consequence roads." },
          { value: "closure events rate-limited to one batch per region per minute", explain: "The throttle that bounds how fast this gate can rewrite the live weight array." },
          { value: "source requirement: closure reflected within 60s against a 300s aggregation window", explain: "Why this path has to exist at all: the ordinary window is five times slower than the requirement." },
        ],
        breaks: {
          failure: "It owns the largest blast radius in the system.",
          handled: "A bad polygon flagging a motorway closed re-plans every navigation in the region inside one window, with no gradual rollout for a metric write. An operator kill switch is the mitigation of last resort rather than a nice-to-have.",
        },
        choice: {
          pick: "Confirm and rate-limit, then write directly into the current weight array",
          instead: "Let the closure show up through the next aggregation window like any other speed change.",
          decider:
            "Time to reflect, and whether the window can deliver at all. The requirement is 60s against a 300s window, and the window cannot see a closure in any case because there are no probes on a closed road to aggregate.",
          flips: "Low-stakes advisory data such as roadworks warnings or event notices. Being one window late costs nothing there, and the blast radius of a bad write is not worth a second write path.",
        },
      },
    },

    // ---------------------------------------------------------------- traffic
    {
      id: "history-profiles",
      label: "Speed profiles",
      sub: "per segment, per time of day",
      kind: "database",
      col: 1,
      row: 3,
      detail: {
        what: "The prior: a typical speed for every segment, keyed by time of day and day of week, fitted from months of past windows. It is what fills in the ~97% of edges no probe touched, and what the ETA model uses beyond the near horizon.",
        why: "The reduce step cannot publish a weight for a segment it has no samples for, and leaving a hole is not an option. The router has to cost that edge somehow, and this is where the number comes from when there is no measurement.",
        numbers: [
          { value: "~97% of 150M global edges fall back to it in any window", explain: "How much of the router's cost function is priced from a prior rather than a live measurement." },
          { value: "used under ~5 samples in the window", explain: "The threshold below which a segment's live reading is considered too thin to trust." },
        ],
        breaks: {
          failure: "Measured and inferred weights arrive in the same units and the router cannot tell them apart.",
          handled: "A residential cut-through with no samples competes on equal terms with an arterial that has 60. Worse, a road nobody is routed onto never gets probes, so its profile never improves and a month-long closure looks like a permanently quiet street.",
        },
        choice: {
          pick: "Keep a time-of-day prior and let the router treat it as an ordinary weight",
          instead: "Tag every weight as measured or inferred and bias the router toward measured edges.",
          decider:
            "What the bias actually does. Preferring measured edges systematically pushes traffic onto main roads, which is a product decision about routing behaviour rather than an accuracy improvement. It makes the residential complaint better in one direction and worse in the other. The prior is well calibrated on aggregate, and its failure is silent rather than large.",
          flips: "Safety-relevant modes such as truck routing round low bridges. Or markets with very thin coverage, where the prior is fitted on too little data to be trusted and an explicit confidence band beats a confident guess.",
        },
      },
    },
    {
      id: "probe-bus",
      label: "Probe stream",
      sub: "anonymised GPS, ~1M/s peak",
      kind: "queue",
      col: 0,
      row: 2,
      detail: {
        what: "The ingest path for anonymised location pings from every device in motion with location sharing on, not only from devices actively navigating.",
        why: "It is a reduce-and-drop stream. Probes exist to produce this window's segment speeds and nothing downstream needs them afterwards, which is why the design has no long-term storage line for them at all.",
        numbers: [
          { value: "25M moving devices at 1 probe/30s = ~1M/s peak", explain: "The device population and reporting rate that together set peak ingest volume." },
          { value: "~100B payload, so ~100MB/s ingress", explain: "The bandwidth this stream actually costs at peak." },
          { value: "~250k/s off peak", explain: "The floor this stream drops to outside commute hours." },
        ],
        breaks: {
          failure: "Losing a region's in-flight probes costs one window of freshness.",
          handled: "That is the deliberate RPO: the peer region rebuilds from the next window, so the worst case is 5 to 10 minutes of routing on the last good weights.",
        },
        choice: {
          pick: "Partitioned stream, reduced inside the window and dropped",
          instead: "Persisting raw probes for later reprocessing.",
          decider:
            "Volume against value. 100MB/s of ingress is many terabytes a day of data whose entire purpose expires in 5 minutes. Replicating it cross-region to protect a value recomputed every 5 minutes is not worth the bandwidth.",
          flips: "Training or evaluating the map-matching and ETA models, which need realised trajectories. Sample a small fraction under a separate retention policy rather than keeping the firehose.",
        },
      },
    },
    {
      id: "traffic-agg",
      label: "Traffic aggregator",
      kind: "serviceGroup",
      col: 1,
      row: 2,
      detail: {
        what: "The streaming job that turns probes into the next weight metric. Match, reduce and state are stages of it rather than services: they are bound to the same 5-minute window and share its watermark.",
        why: "Splitting them into separate deployables buys nothing and costs a queue per boundary, because none of them can advance past the window the others are on. They are one component for the same reason: they share one pager row, and every symptom of a matching failure appears as a reduce-side lag.",
        numbers: [
          { value: "~1M probes/s at peak", explain: "The ingest rate this whole windowed job has to sustain." },
          { value: "300M probes per 5-minute tumbling window", explain: "The volume processed in each window before results publish." },
          { value: "one output per segment per window", explain: "The granularity this job emits at, matching what the router actually consumes." },
        ],
        breaks: {
          failure: "If any stage falls behind, the window watermark stalls and the customisation pass downstream simply has nothing to run on.",
          handled: "That shows up as routing staleness rather than as an ingest alert, which is why segment-update lag is monitored rather than probe throughput.",
        },
        choice: {
          pick: "One windowed streaming job with three in-process stages",
          instead: "Three services with a queue between each pair, scaled independently.",
          decider:
            "Whether they can actually scale apart. They cannot: all three are pinned to the same window watermark, so the slowest one sets the pace regardless of how the others are provisioned. Each queue would add a serialisation hop to ~1M records/s for no isolation.",
          flips: "Map matching becoming a shared service with other consumers, such as fleet analytics or ETA-model training. There its output is wanted outside this window, and a durable boundary earns its keep.",
        },
      },
    },
    {
      id: "map-match",
      label: "Map matching",
      sub: "HMM over nearby segments",
      kind: "process",
      col: 1,
      row: 2,
      parent: "traffic-agg",
      detail: {
        what: "Snaps each probe to a road segment using position, heading and the recent trajectory rather than distance alone, emitting (segment, speed) pairs.",
        why: "The nearest segment is routinely the wrong one. A flyover and the surface street beneath it, or a motorway and its service road, are metres apart and opposite in meaning. Consumer GPS error is comfortably larger than that gap.",
        numbers: [
          { value: "~1M probes/s at peak", explain: "The rate this stage has to match against the road graph in real time." },
          { value: "standard formulation: Newson and Krumm, 2009", explain: "The published algorithm this stage's HMM approach follows." },
        ],
        breaks: {
          failure: "A client GPS-format change collapses matching quietly.",
          handled: "The symptom is a falling per-segment update rate rather than an error rate. The gate is a format version at ingest, plus an alert on segment-update lag over 5 minutes.",
        },
        choice: {
          pick: "Hidden Markov model over nearby segments, scored with the recent trajectory",
          instead: "Nearest-segment snap by geometric distance.",
          decider:
            "Ambiguity in the geometry, weighted by where the traffic is. A distance snap gets a measurable share of ~1M probes/s wrong precisely in dense interchanges, which are the segments with the most probes and the most riding on their weight.",
          flips: "Sparse rural networks or a fleet on known fixed routes, where there is one plausible match and the trajectory adds nothing an index lookup does not already give you.",
        },
      },
    },
    {
      id: "window-reduce",
      label: "Window reduce",
      sub: "trimmed mean, 5-min tumbling",
      kind: "process",
      col: 1,
      row: 2,
      parent: "traffic-agg",
      detail: {
        what: "Reduces the matched pairs into one speed per segment per 5-minute window, discarding the top and bottom 10% of samples. A segment with too few samples falls back to the historical profile.",
        why: "Raw probes are not weights. A parked car with location sharing on and a motorcyclist filtering at 100mph land in the same sample set. The mean of those two describes no vehicle on that road.",
        numbers: [
          { value: "300M probes per 5-minute window", explain: "The input volume this stage reduces down to one number per segment." },
          { value: "trims the top and bottom 10%", explain: "The outlier-removal rule applied before averaging." },
          { value: "under ~5 samples keeps the historical profile", explain: "The fallback threshold shared with the Speed profiles store." },
        ],
        breaks: {
          failure: "Coverage rather than accuracy: about 3% of the 150M global edges carry a measured weight in any window.",
          handled: "The fallback is invisible downstream because it is emitted in the same units on the same channel, which is why coverage, not accuracy, is the number worth watching here.",
        },
        choice: {
          pick: "Trimmed mean over a 5-minute tumbling window",
          instead: "A plain mean per window, or an exponentially weighted average updated per probe.",
          decider:
            "Outliers. Discarding the top and bottom 10% removes the parked car and the filtering motorcyclist, which a mean cannot. A tumbling window also gives the customisation pass one complete consistent picture, rather than a moving target.",
          flips: "A dense, well-behaved fleet such as buses or delivery vans with known vehicle classes. There the outliers are already excluded, and a sliding or exponentially weighted estimate buys freshness for free.",
        },
      },
    },
    {
      id: "segment-state",
      label: "Segment state machine",
      sub: "free/slow/heavy/stopped",
      kind: "process",
      col: 1,
      row: 2,
      parent: "traffic-agg",
      detail: {
        what: "Compares each segment's reduced speed against its typical profile and drives a small state machine: free, slow, heavy, stopped, plus a Closed state only the override can set. A state must hold for two consecutive windows before it changes.",
        why: "Hysteresis is not cosmetic. A segment that flaps between free and slow rewrites its weight every window, every rewrite invalidates cached routes, and drivers already committed to that road get re-planned back and forth.",
        numbers: [
          { value: "a state must hold 2 consecutive windows", explain: "The hysteresis rule that stops a borderline segment from oscillating." },
          { value: "slow below 0.7x typical, back to free above 0.85x", explain: "The asymmetric enter and exit thresholds that widen the dead zone around the boundary." },
          { value: "stopped below 5 km/h sustained 3 windows", explain: "The stricter bar for the most disruptive state, requiring more evidence before declaring a road stopped." },
        ],
        breaks: {
          failure: "Hysteresis is deliberately slow to react.",
          handled: "A genuine sudden jam is reflected one window late, which is 5 minutes of routing people onto a road that has just stopped moving. That is the price paid for not re-planning everyone on a borderline segment twice an hour.",
        },
        choice: {
          pick: "Per-segment state machine with 2-window hysteresis and asymmetric thresholds",
          instead: "Publish the reduced speed directly and let the router see every fluctuation.",
          decider:
            "Route churn. A borderline segment crossing its threshold every window rewrites its weight every 5 minutes and invalidates every cached route through it. Asymmetric enter and exit thresholds (0.7x in, 0.85x out) are what stop a segment sitting on the boundary from oscillating at all.",
          flips: "Incident detection or an operations console, where the point is to see the change the moment it happens and there is no re-planning cost attached to reacting early.",
        },
      },
    },
  ],
  edges: [
    // ----------------------------------------------------------------- tiles
    {
      id: "e-tiles",
      from: "client",
      to: "tile-origin",
      tier: "hot",
      step: 1,
      label: "tiles (z, x, y)",
      detail: {
        what: "Tile fetches as the user pans and zooms, addressed by zoom, column and row. Over 95% are answered from the nearest edge cache, falling through to the object store only on a miss.",
        why: "The map on screen is bytes written weeks ago. Keeping the key purely geometric, with no per-user variation, makes every response cacheable for everybody at the edge. Cold tiles are the long tail of a Zipfian distribution, so they are pulled lazily on first request rather than pushed.",
        numbers: [
          { value: "~20 tiles per session", explain: "The typical per-session load, small enough that the edge cache absorbs it almost entirely." },
          { value: "10B/day, ~350k/s at peak", explain: "The daily and peak request volume this edge carries." },
          { value: "p99 under 500ms", explain: "The same bound whether served from the edge or the 5% that reaches origin at ~17k/s peak — origin latency can't slip just because it's the rarer path." },
          { value: "5% miss reaches the origin, ~5.8k/s average, ~17k/s peak", explain: "The residual load that actually reaches the origin fleet after the edge cache filters it." },
        ],
        breaks: {
          failure: "High zoom bands cache worst, typically under 90% hit above z=14 against over 99% below z=10.",
          handled: "Miss traffic concentrates in exactly the detailed tiles that cost most to render. Origin capacity is a consequence of cache behaviour: an 80% hit rate needs 23k/s of origin instead of 5.8k/s for the same traffic.",
        },
      },
    },
    {
      id: "e-tilebuild",
      from: "map-source",
      to: "tile-origin",
      tier: "data",
      label: "diff-driven re-render",
      detail: {
        what: "The applied diff, reduced to the bounding boxes of what changed, driving a batch re-render that writes new tile objects back into the corpus. The version pointer flips once the popular ones are warm.",
        why: "Geometry is the fastest-changing of the three derivations and the cheapest to redo, so it takes the diff directly rather than waiting for anything to be rebuilt. Tiles are versioned rather than mutated so the CDN can be told about a new pointer instead of being asked to invalidate individual keys across every point of presence.",
        numbers: [
          { value: "~3M edits/day", explain: "The upstream volume feeding this re-render path." },
          { value: "~1% of materialised tiles touched per week", explain: "How much of the corpus actually changes, small next to the whole." },
          { value: "15TB/week re-render against a 1.5PB corpus", explain: "The re-render cost as a fraction of the full corpus." },
        ],
        breaks: {
          failure: "One boundary edit expands to thousands of tiles from z=10 to z=18.",
          handled: "The bounding box has to be expanded per zoom level and deduped before it reaches the render queue. Otherwise the queue length becomes a function of editor behaviour, not actual change volume.",
        },
      },
    },
    {
      id: "e5",
      from: "map-source",
      to: "order-builder",
      tier: "control",
      label: "topology changes",
      detail: {
        what: "The same upstream data, read for structure rather than geometry: which intersections exist, which segments connect them, and what the turn restrictions are.",
        why: "This is a slow control path because the order only has to track when roads physically change, not when the map is edited. A relabelled café moves a tile and nothing else.",
        numbers: [
          { value: "rebuilt once a week", explain: "The cadence this edge is read on, matching the order builder's own schedule." },
          { value: "~50M nodes and ~150M edges globally", explain: "The full graph size this edge feeds into the weekly rebuild." },
        ],
        breaks: {
          failure: "This is the slowest of the three clocks, so it sets how long a new road stays unroutable.",
          handled: "Up to a week after it is already visible on the map, which is the complaint users actually file, since the tile pipeline moves far faster than this one.",
        },
      },
    },

    // --------------------------------------------------------------- routing
    {
      id: "e6",
      from: "client",
      to: "upward-search",
      tier: "hot",
      step: 2,
      label: "POST /route",
      detail: {
        what: "A route request carrying origin, destination, mode and preferences.",
        why: "One request per trip start plus a re-plan only on genuine deviation. Everything expensive about routing has already happened by the time this arrives, which is why a 100ms in-pod budget is achievable at all.",
        numbers: [
          { value: "~1.7k/s trip starts at peak", explain: "Just 17% of the ~10k/s this edge carries at peak — re-plans (~4.2k/s) and previews make up the rest, since most routing traffic is correction, not new trips." },
          { value: "~4.2k/s re-plans", explain: "The dominant contributor to route request volume, driven by deviation and traffic changes." },
          { value: "~10k/s total including previews", explain: "The full request rate this edge carries at peak, matching the pod's overall throughput target." },
        ],
        breaks: {
          failure: "Cross-region requests do not fit this shape.",
          handled: "Pods hold one continent, so a Lisbon to Warsaw query is stitched through a boundary-node table across two pods and runs 3 to 5x slower. It breaks outright if the two regions are on different order versions.",
        },
      },
    },
    {
      id: "e7",
      from: "upward-search",
      to: "shortcut-unpack",
      tier: "data",
      label: "winning shortcut path",
      detail: {
        what: "The meeting node and the chain of shortcut edges that won, handed on for expansion.",
        why: "The search deliberately never touched the low-ranked edges the driver actually turns onto, so what it produces is a correct answer in the wrong vocabulary. It hands off in-process, with no network hop.",
        numbers: [{ value: "hundreds of nodes settled", explain: "The scale of the search's own exploration, matching what this edge carries forward." }],
        breaks: {
          failure: "If the topology and metric versions disagree, this is where it becomes visible.",
          handled: "The middle-node references expand into segments that do not join up, rather than into an error, which is why version agreement is checked before a query ever reaches this stage.",
        },
      },
    },
    {
      id: "e8",
      from: "shortcut-unpack",
      to: "eta-model",
      tier: "data",
      label: "road segments",
      detail: {
        what: "The fully expanded path as original road segments, ready to be costed and turned into a polyline and turn list.",
        why: "The ETA is computed over real segments rather than shortcuts, because the near part of the trip has to be costed on the live metric segment by segment. A shortcut summarises a weight rather than a stretch of road. This handoff is in-process, with no network hop.",
        breaks: {
          failure: "A very long route expands to a large segment list, so the polyline has to be simplified for transport.",
          handled: "Over-simplifying it is what makes the client's own map matching drift and fire spurious re-plans, so simplification is tuned to stay within the client's own tolerance.",
        },
      },
    },
    {
      id: "e9",
      from: "eta-model",
      to: "client",
      tier: "hot",
      step: 4,
      label: "polyline + turns + ETA",
      detail: {
        what: "The response: the route polyline, the turn instructions and an arrival time, plus the metric version it was planned against.",
        why: "This is the whole contract with the client for the rest of the trip. Everything after it, speaking turns, matching GPS, deciding whether to ask again, happens on the phone against these bytes.",
        numbers: [
          { value: "one response per trip start", explain: "The frequency this edge fires at, matching new trips rather than every re-plan." },
          { value: "under 1s end to end", explain: "Against the pod's own 100ms in-pod budget, this leaves ~900ms for network and client rendering — in-pod work is a small slice of what the user actually waits on." },
        ],
        breaks: {
          failure: "The metric version has to travel with the answer.",
          handled: "Without it a complaint about a route cannot be replanned against the numbers that produced it, and the only available reply is a guess.",
        },
      },
    },
    {
      id: "e10",
      from: "cch-topology",
      to: "upward-search",
      tier: "control",
      label: "order + shortcuts, weekly",
      detail: {
        what: "The topology being loaded into pod memory, which happens on the weekly order cadence rather than the traffic cadence.",
        why: "This is a control path rather than traffic, because it is a deployment. Separating it from the metric swap is what makes a bad order rollback-able without touching freshness.",
        numbers: [
          { value: "~2GB per continent", explain: "The same topology hierarchy-group publishes weekly — loaded on this slow cadence so a bad order can be pinned back without touching the 5-minute metric swap." },
          { value: "once a week", explain: "The cadence this edge fires on." },
        ],
        breaks: {
          failure: "Loading an order whose fixture routes fail their cost comparison would break routing continent-wide.",
          handled: "Pods must refuse it and pin the previous artefact instead, which is what keeps a bad rebuild from ever reaching live traffic.",
        },
      },
    },
    {
      id: "e11",
      from: "weight-metric",
      to: "upward-search",
      tier: "hot",
      step: 3,
      label: "metric swap, every 5 min",
      detail: {
        what: "The current weight array being swapped into a running pod behind a pointer flip. This is the edge the whole design is about.",
        why: "It is not a request path. It is the weights being replaced underneath a resident graph, which is how a structure preprocessed for one metric keeps answering questions about a world that changed 90 seconds ago.",
        numbers: [
          { value: "240MB per swap", explain: "The artefact size moved on this edge, matching the weight-metric store's output." },
          { value: "metric age alerted above 120s", explain: "The staleness threshold that pages an operator if this edge stops firing on schedule." },
        ],
        breaks: {
          failure: "If the swap stalls, nothing fails outright.",
          handled: "Pods keep serving the previous metric and every route silently gets older, which is why metric age is a first-class monitored number rather than an implementation detail.",
        },
      },
    },

    // ---------------------------------------------------- preprocessing jobs
    {
      id: "e12",
      from: "order-builder",
      to: "cch-topology",
      tier: "data",
      label: "weekly rebuild",
      detail: {
        what: "A newly computed order and its shortcut set published as an artefact.",
        why: "Roads change on the timescale of construction, not congestion, so this pipeline runs on its own slow clock and never blocks the fast one.",
        numbers: [
          { value: "single-digit hours to build", explain: "The time this edge's rebuild actually takes." },
          { value: "~60M edges after contraction", explain: "The resulting artefact's edge count once shortcuts are added." },
        ],
        breaks: {
          failure: "Promotion is the dangerous moment: node ranks change wholesale.",
          handled: "The new order is customised and shadowed against live traffic before it is allowed to take queries, so a bad rebuild is caught before it reaches production.",
        },
      },
    },
    {
      id: "e13",
      from: "cch-topology",
      to: "customisation-pass",
      tier: "control",
      label: "shortcut topology",
      detail: {
        what: "The pass reading the current order and shortcut set so it knows which weights to compute and in what sequence.",
        why: "The sweep is defined by the topology: visit contracted nodes in order, take the minimum over each shortcut's two-hop paths. Without the order there is nothing to sweep, which is why the two artefacts are versioned together.",
        numbers: [
          { value: "one pass, parallel by level", explain: "The execution model this edge's read enables." },
          { value: "~1s per continent", explain: "The resulting runtime once the topology is loaded." },
        ],
        breaks: {
          failure: "A metric computed against a superseded order is not stale, it is meaningless.",
          handled: "Edge ids no longer refer to the same shortcuts once the order changes. Both artefacts carry the order id for this reason, and a mismatch is refused rather than served.",
        },
      },
    },
    {
      id: "e14",
      from: "customisation-pass",
      to: "weight-metric",
      tier: "data",
      label: "writes 240MB array",
      detail: {
        what: "The output of the sweep: a complete new weight array keyed by edge id, published as a new version.",
        why: "Publishing a whole artefact rather than a patch is what makes the swap atomic and the result reproducible. Versions are cheap and being able to recost a complaint against the exact metric that produced it is the only debugging tool that works.",
        numbers: [
          { value: "240MB per continent per window", explain: "The exact size e11 swaps into pods every 5 minutes — the sweep's entire output becomes the next live metric with nothing added or dropped in between." },
          { value: "one version every 5 minutes", explain: "The publish cadence." },
        ],
        breaks: {
          failure: "An output that moves fixture route costs wildly means bad aggregation rather than bad traffic.",
          handled: "It must be gated before promotion; stale but consistent beats fresh and wrong, so a suspicious sweep result never reaches live pods automatically.",
        },
      },
    },

    // --------------------------------------------------------------- traffic
    {
      id: "e15",
      from: "client",
      to: "probe-bus",
      tier: "hot",
      step: 5,
      label: "anonymised GPS pings",
      detail: {
        what: "Location pings with lat, lng, heading, speed, timestamp and a rotating id, sent from devices in motion.",
        why: "The probe stream is not a navigation feature: it comes from everyone with location sharing on, which is what gives coverage on roads nobody is currently being routed along.",
        numbers: [
          { value: "~1 probe/30s per device", explain: "The per-device reporting cadence." },
          { value: "25M moving devices at peak", explain: "The device population contributing to this edge at peak." },
          { value: "~100B per payload", explain: "× 25M devices ÷ 30s cadence ≈ 83MB/s aggregate ingress — small per ping, but the fleet-wide rate this edge sustains continuously." },
        ],
        breaks: {
          failure: "This is the arrow with a privacy position attached to it.",
          handled: "The id rotates and nothing raw is retained, which is only defensible because the aggregate is recomputed from scratch every 5 minutes rather than accumulated over time.",
        },
      },
    },
    {
      id: "e16",
      from: "probe-bus",
      to: "map-match",
      tier: "data",
      label: "~1M probes/s",
      detail: {
        what: "Batches of raw probes handed to matching.",
        why: "Ingest and matching are the one boundary in this pipeline that is genuinely a queue. Ingest is network bound and trivially partitioned; matching is CPU bound and needs a probe's recent history. The buffer between them absorbs the commute ramp.",
        numbers: [
          { value: "~1M/s at peak", explain: "The throughput this edge sustains during the commute peak." },
          { value: "~250k/s off peak", explain: "The floor this edge drops to outside peak hours." },
        ],
        breaks: {
          failure: "If matching falls behind, the window watermark stalls and the customisation pass downstream simply has nothing to run on.",
          handled: "This shows up as routing staleness rather than as an ingest alert, which is why segment-update lag, not queue depth, is the primary monitored signal.",
        },
      },
    },
    {
      id: "e17",
      from: "map-match",
      to: "window-reduce",
      tier: "data",
      label: "(segment, speed)",
      detail: {
        what: "Matched pairs: one road segment and one observed speed per probe.",
        why: "This is where a location becomes a fact about a road. Everything downstream is arithmetic over segments, so the graph identity is attached exactly once, here.",
        numbers: [{ value: "300M pairs per 5-minute window", explain: "These land on just ~3% of edges live each window — heavily concentrated on popular segments, why most of the graph falls back to historical profiles instead." }],
        breaks: {
          failure: "A mismatched probe is indistinguishable from a real observation downstream.",
          handled: "A systematic matching error on one interchange quietly poisons that segment's weight for as long as it persists. Matching accuracy is monitored directly for this reason, rather than inferred from routing complaints.",
        },
      },
    },
    {
      id: "e18",
      from: "window-reduce",
      to: "segment-state",
      tier: "data",
      label: "trimmed mean/segment",
      detail: {
        what: "One speed per segment for the closed window, measured where there were enough samples and taken from the profile where there were not.",
        why: "The state machine needs a single settled number per segment per window; comparing a distribution against a profile every window is the same decision made with more moving parts.",
        numbers: [{ value: "~3% of edges measured", explain: "The coverage fraction that carries a live reading rather than a fallback on this edge." }],
        breaks: {
          failure: "Measured and inferred values travel on the same channel in the same units.",
          handled: "Nothing after this point can tell them apart. The state machine will happily transition a segment on the strength of a prior, accepted since a wrong prior is rare and self-correcting over time.",
        },
      },
    },
    {
      id: "e19",
      from: "history-profiles",
      to: "window-reduce",
      tier: "control",
      label: "under 5 samples",
      detail: {
        what: "The fallback lookup: a segment with too few probes in the window takes its typical speed for this weekday and time bucket instead.",
        why: "There is no third option. The router has to cost every edge, so a segment with no measurement gets a prior rather than a hole. The prior is calibrated well enough on aggregate to be defensible.",
        numbers: [
          { value: "applies to ~97% of edges in any window", explain: "How often this fallback fires, which is the majority case rather than the exception." },
          { value: "threshold ~5 samples", explain: "The minimum evidence required before a segment's own measurement is trusted over the prior." },
        ],
        breaks: {
          failure: "The fallback is silent by design, so a matching regression that stops producing pairs for a whole region looks identical to a quiet region.",
          handled: "Both simply fall back, and the metric stays plausible while being entirely inferred, which is why matching health is monitored upstream rather than inferred from this edge's behaviour.",
        },
      },
    },
    {
      id: "e20",
      from: "history-profiles",
      to: "eta-model",
      fromSide: "left",
      toSide: "left",
      tier: "control",
      label: "beyond ~20 min",
      detail: {
        what: "The far half of the trip costed on typical speeds for the time the driver will actually be there, rather than on this window's numbers.",
        why: "Current weights are the best estimate for the next 15 to 20 minutes and a worse one after that, because congestion moves. This is the cheap approximation of time-dependent routing.",
        numbers: [{ value: "current weights for the first 15 to 20 minutes, profiles beyond", explain: "The handover rule this edge implements inside the ETA model." }],
        breaks: {
          failure: "The handover point is arbitrary, so routes look optimal at departure and drift afterwards.",
          handled: "The drift surfaces as ETA error rather than as a visibly wrong road, which is why ETA accuracy, not route correctness, is what this edge's design is actually judged against.",
        },
      },
    },
    {
      id: "e21",
      from: "segment-state",
      to: "customisation-pass",
      tier: "data",
      label: "per-segment speeds",
      detail: {
        what: "The settled per-segment speeds for the closed window, handed to the sweep as the metric to customise against.",
        why: "The pass needs one complete, consistent picture rather than a stream, because a hierarchy customised against a half-formed window is internally inconsistent in ways no query can detect.",
        numbers: [
          { value: "one window every 5 minutes", explain: "The cadence this edge fires on, matching the sweep's own schedule." },
          { value: "~3% measured, the rest inferred", explain: "The composition of the data this edge carries into the sweep." },
        ],
        breaks: {
          failure: "This is the serialisation point of the whole loop.",
          handled: "If the window does not close on time the sweep has nothing to run on. Every pod keeps serving the previous metric, and the only visible symptom is metric age climbing.",
        },
      },
    },

    // --------------------------------------------------------------- closures
    {
      id: "e23",
      from: "closure-gate",
      to: "weight-metric",
      tier: "control",
      label: "impassable now",
      detail: {
        what: "A confirmed closure setting the affected edges impassable in the array pods are currently serving, without waiting for a window.",
        why: "It is the one input allowed to skip the pipeline, because the pipeline structurally cannot see it. No probes are generated on a closed road, so aggregation reads a closure as quiet traffic.",
        numbers: [{ value: "within 60s against a 300s window", explain: "How much faster this edge delivers than the ordinary aggregation cycle it bypasses." }],
        breaks: {
          failure: "It writes directly into a live artefact, so it has the blast radius of a deploy with none of the gating.",
          handled: "Two-source confirmation on motorway-class edges and an operator kill switch are what make it survivable, bounding how much damage a bad confirmation can do.",
        },
      },
    },
    {
      id: "e24",
      from: "closure-gate",
      to: "customisation-pass",
      tier: "control",
      label: "folded next window",
      detail: {
        what: "The same closure set handed to the next sweep, so the closure becomes part of the metric properly rather than remaining a patch on top of one version of it.",
        why: "Without this the override would be lost at the next pointer flip. The sweep rebuilds every shortcut weight from the traffic metric, and anything written directly into the previous array is simply overwritten.",
        numbers: [{ value: "folded in on the next 5-minute cycle", explain: "The cadence at which this edge reconciles a manual override with the automated pipeline." }],
        breaks: {
          failure: "If the fold is missed, a closed road reopens by itself at the next metric swap and nothing logs it.",
          handled: "The override write and the sweep are both behaving exactly as designed, which is why the fold step itself is monitored rather than assumed to always happen.",
        },
      },
    },
  ],
};
