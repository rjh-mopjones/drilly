import type { Diagram } from "./types";

export const GOOGLE_MAPS: Diagram = {
  id: "google-maps",
  title: "Google Maps",
  question: "Design Google Maps",
  sourceId: "patterns",
  itemId: 15,
  overview: {
    shape:
      "Three subsystems that share a road-graph source and almost nothing else: tiles are a static-asset problem, traffic is stream aggregation, and routing is a shortest-path query with a 100ms budget that is only survivable because almost all of it was computed in advance.",
    beats: [
      "Size each subsystem on its own numbers and they never meet: 350k tile requests/s at commute peak, 10k route computes/s, and roughly 1M GPS probes/s. There is no shared bottleneck, and the price of that is three pipelines that must stay in agreement about one graph.",
      "Tiles are the cheap half. Slice the world into a quadtree keyed by (zoom, x, y), encode geometry rather than pixels, render once and cache at the edge. The quadtree is 1.4T addressable tiles at z=0 to 20, of which 1 to 5% materialise, so ~50B tiles at 30KB blended is a 1.5PB corpus behind a CDN that absorbs over 95% of requests.",
      "Routing is the interview, and one number decides it. A continental graph is ~10M nodes and ~30M edges, and an unguided search settles most of it: about 0.5s of CPU per query, so 10k/s needs 5,000 cores for something with a 100ms budget. Preprocessing a shortcut hierarchy takes the same query to ~1ms, which is 10 cores.",
      "The bill arrives when the weights move. A hierarchy is correct only for the metric it was built with, so preprocessing splits in two: a contraction order derived from graph shape alone, rebuilt weekly because that is how often roads physically change, and a customisation pass over the current travel times that runs in about a second and emits a fresh 240MB weight array every five minutes.",
      "Traffic closes the loop. Anonymised probes are map-matched to segments, reduced with a trimmed mean over a 5-minute tumbling window with hysteresis so segments do not flap, and published as the next metric. Verified closures skip the window entirely on an override channel, because a closed road produces no probes and therefore looks exactly like a quiet one.",
      "The honest concession is coverage. Roughly 300M probes per window land on about 3% of the world's 150M edges, and every other edge carries a historical time-of-day profile that the router treats as an equally good number. A road nobody is routed onto never gets probes, so its estimate never improves.",
    ],
    crux:
      "A shortcut hierarchy is only correct for the weights it was built with, and live traffic replaces those weights every five minutes. Overlaying deltas does not repair it: the witness decisions that chose which shortcuts exist were taken under the old numbers, so a shortcut that is now required may simply not be there, and nothing at query time can detect it.",
    numbers: [
      "5,000 cores unguided against 10 with a customisable hierarchy, at 10k route computes/s",
      "1.5PB vector tile corpus, 95%+ CDN hit rate, ~350k tile requests/s at peak",
      "~1M probes/s reduced into a 240MB weight metric per continent every 5 minutes",
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
      row: 2,
      detail: {
        what: "The phone or browser: it fetches tiles, asks for a route once, then runs the navigation session itself against the polyline it was handed.",
        why: "Re-planning is the server's job and noticing that a re-plan is needed is the client's. Matching its own GPS to the polyline locally is what stops 2.5M concurrent navigations from becoming 80k requests/s of drift correction.",
        numbers: [
          "~20 tiles opened per session",
          "~900k concurrent navigations average, ~2.5M at peak",
          "re-plan only after >50m off the polyline for >10s",
        ],
        breaks:
          "A client that asks the server on every GPS tick turns ordinary position noise into a re-plan storm; the 50m and 10s thresholds are the only thing holding that line.",
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
      id: "tile-cdn",
      label: "Tile CDN",
      sub: "(z, x, y) key, 95%+ hit rate",
      kind: "gateway",
      col: 1,
      row: 0,
      detail: {
        what: "The edge tier: a global cache fleet answering tile requests from the point of presence nearest the user, keyed only by zoom, column and row.",
        why: "Tile popularity is Zipfian, so a small set of city-centre tiles dominates every request pattern. Caching those at the edge is what turns 350k requests/s into an origin that sees single-digit thousands.",
        numbers: [
          "10B tile requests/day, ~116k/s average",
          "~350k/s at commute peak",
          "z above 14 typically under 90% hit, z below 10 over 99%",
        ],
        breaks:
          "A large diff invalidating millions of tiles at once collapses the hit rate and the origin takes the whole difference, so popular tiles must be pre-warmed before the version pointer flips.",
        choice: {
          pick: "CDN in front of immutable, versioned tile objects",
          instead: "Sizing an origin fleet for peak tile traffic directly.",
          decider:
            "Hit rate, which sets origin capacity outright. At 95% the origin sees 5% of 10B/day, 5.8k req/s average and ~17k/s at peak, one modest fleet. At 80% it is 23k/s average, four times the hardware for exactly the same product.",
          flips:
            "A private or single-region deployment where the traffic never justifies edge infrastructure and one regional origin is already closer to every user than a point of presence would be.",
        },
      },
    },
    {
      id: "tile-origin",
      label: "Tile object store",
      sub: "MVT vector tiles, ~1.5PB",
      kind: "blob",
      col: 3,
      row: 0,
      detail: {
        what: "The materialised tile corpus in object storage: one gzipped MVT object per (z, x, y) that has any content in it, carrying geometry and properties rather than pixels.",
        why: "The quadtree holds 4^z tiles per zoom, so z=0 to 20 is (4^21 - 1)/3 or about 1.4T addressable tiles. Around 70% of the surface is ocean and most high-zoom land tiles are empty, so you store what exists rather than what is addressable.",
        numbers: [
          "1.4T addressable, 1 to 5% materialise",
          "~50B tiles x 30KB blended = 1.5PB",
          "10 to 50KB per tile, rural against dense urban",
        ],
        breaks:
          "Object count rather than bytes: 50B objects is a metadata problem in its own right, and any operation that wants to enumerate or sweep the corpus will not finish.",
        choice: {
          pick: "One vector (MVT) corpus of immutable objects in blob storage, styled on the client",
          instead: "Pre-rendered raster pyramids, one PNG set per style and display density.",
          decider:
            "Styles multiplied by densities. One corpus is 1.5PB; raster costs that per style, so three styles is 4.5PB and a high-density pyramid roughly doubles it again. A style change on raster re-renders 1.5PB, while on vector it is a client release.",
          flips:
            "Clients that cannot render: embedded head units, e-ink, print, thumbnails and social previews. Answer with a server-side renderer over the same vector tiles so raster is an output format rather than a second pipeline.",
        },
      },
    },
    {
      id: "tile-builder",
      label: "Tile builder",
      sub: "re-render on map diff",
      kind: "service",
      col: 5,
      row: 0,
      detail: {
        what: "The batch job that turns a map source extract into tile objects, re-rendering only the tiles whose bounding boxes intersect an applied diff.",
        why: "Geometry changes when someone edits the map, which is a completely different clock from traffic or topology. Treating tiles as a rebuild-on-change asset is what makes them safe to cache for months downstream.",
        numbers: [
          "~3M edits/day on the OSM diff feed",
          "~1% of materialised tiles touched per week",
          "15TB/week re-render against a 1.5PB corpus",
        ],
        breaks:
          "One edit to an administrative boundary touches thousands of tiles from z=10 to z=18, so the invalidation set must be deduped per cycle and ordered by predicted CDN miss rate or the queue never drains.",
        choice: {
          pick: "Incremental re-render driven by the changed bounding boxes in the diff feed",
          instead: "Rebuilding the planet on a nightly or weekly schedule.",
          decider:
            "Churn against corpus size. 3M edits/day touch about 1% of materialised tiles per week, which is 15TB against 1.5PB, roughly 100x less work for the same visible result.",
          flips:
            "A change to the tile schema or the encoding itself, where every object is stale by definition and a full rebuild is the only coherent answer.",
        },
      },
    },
    {
      id: "map-source",
      label: "Map data source",
      sub: "OSM diff feed, ~3M edits/day",
      kind: "external",
      col: 6,
      row: 0,
      detail: {
        what: "The upstream road data everything is derived from: an OpenStreetMap diff feed (or a proprietary survey extract) carrying geometry, topology and restrictions such as one-ways, turn bans and vehicle class.",
        why: "It is the single source the three subsystems share. The whole 'three pipelines, one graph' shape of this design only means something because tiles and the contraction order are two different renderings of the same upstream edits.",
        numbers: [
          "~3M edits/day on the OSM diff feed",
          "~50M routable nodes and ~150M edges globally",
          "~10M nodes and ~30M edges per continent",
        ],
        breaks:
          "A newly added road is invisible until its tiles re-render (hours), unroutable until the order rebuilds (up to a week), and unweighted until probes arrive (never, if nobody drives it). Nothing reports that divergence because each pipeline is individually healthy; it is structural, and it is the cost of three clocks.",
        choice: {
          pick: "Ingest an open diff feed and treat it as an external dependency",
          instead: "A proprietary survey and imagery pipeline owned in house.",
          decider:
            "What it actually changes. Source choice changes ingestion, licensing and the tile pipeline, and changes nothing about the serving path or the routing algorithm, so it is not an architecture fork. It is a data-quality and legal decision wearing an architecture costume.",
          flips:
            "Coverage or liability requirements the open feed cannot meet: lane-level geometry, verified speed limits, or markets where the community map is thin. Then it becomes an owned pipeline with its own editors and QA, feeding exactly the same two consumers.",
        },
      },
    },

    // --------------------------------------------------------------- routing
    {
      id: "routing-pod",
      label: "Routing pod (one continent)",
      kind: "serviceGroup",
      col: 1,
      row: 1,
      detail: {
        what: "One deployable query server per continent. It holds the shortcut hierarchy in memory and answers a route request end to end: search, unpack, ETA. The three stages below are in-process, not services.",
        why: "They are drawn as stages rather than peers because they share the resident graph and the current metric, and a network hop between them would cost more than the query itself. The pseudocode in the write-up is literally these three lines inside one process.",
        numbers: [
          "~10M nodes and ~30M edges per continent",
          "~2GB topology + 240MB metric resident",
          "~10k route computes/s at peak, 100ms in-pod budget",
        ],
        breaks:
          "Sharding does not rescue a shortest-path query, it splits the answer rather than the load: any route crossing a boundary needs both shards plus a boundary-node table to join them, so Lisbon to Warsaw runs 3 to 5x slower through that stitch and fails outright if the two regions are on different order versions.",
        choice: {
          pick: "One continent's graph resident per pod, pods pinned per region",
          instead: "A global graph on one large box, or fine-grained sharding by metro area.",
          decider:
            "Blast radius, not RAM. All six continents is ~12GB, which would physically fit one machine, so memory is not the reason to split. The reason is that an order rebuild is a continent-wide event and you want it to be able to fail in one region at a time. Sharding finer than a continent starts stitching ordinary domestic routes.",
          flips:
            "A single-country product, where the whole graph is a few hundred megabytes and one pod class with no stitch path at all is strictly simpler.",
        },
      },
    },
    {
      id: "upward-search",
      label: "Bidirectional upward search",
      sub: "~1ms, settles hundreds of nodes",
      kind: "process",
      col: 1,
      row: 1,
      parent: "routing-pod",
      detail: {
        what: "The query itself: relax only edges toward higher-ranked nodes from the source, only edges from higher-ranked nodes in the reverse graph from the target, and stop when the smallest tentative key exceeds the best combined distance found.",
        why: "The 100ms budget makes an unguided search impossible, so the pod does almost no exploration. Every shortcut stands for a real path, so this is exact rather than approximate, which is the property most candidates fail to claim out loud.",
        numbers: [
          "~1ms per query customisable, ~150μs classic",
          "hundreds of nodes settled instead of millions",
          "~10k route computes/s at peak",
        ],
        breaks:
          "Exactness is a claim about the algorithm, not about the road. The answer is optimal with respect to a metric that is up to 5 minutes old, so a route can be provably shortest and still wrong about the world.",
        choice: {
          pick: "Bidirectional upward search over a resident shortcut hierarchy",
          instead:
            "Unguided or plain bidirectional Dijkstra over the raw graph, or A* guided by lower bounds from 16 to 32 landmark nodes.",
          decider:
            "Cores. An unguided continental query is ~0.5s of CPU, so 10k/s needs 5,000 cores running flat out; the hierarchy query at ~1ms needs 10. Four orders of magnitude, paid once in preprocessing, is the reason the entire design exists. Landmarks buy only ~10x.",
          flips:
            "A city-sized graph, where a plain search returns in milliseconds and hours of preprocessing is pure operational cost. Landmark-guided A* also wins as a targeted fallback inside a region whose closure has landed but whose customisation pass has not run: free-flow lower bounds stay admissible as long as traffic only makes edges slower.",
        },
      },
    },
    {
      id: "shortcut-unpack",
      label: "Shortcut unpacking",
      sub: "recursive, recovers road segments",
      kind: "process",
      col: 1,
      row: 3,
      parent: "routing-pod",
      detail: {
        what: "The winning path is a chain of shortcuts, each standing in for a two-hop path through a contracted node. Unpacking expands them recursively until only original road segments remain, which is what the polyline and the turn list are built from.",
        why: "Without it the pod would return an answer that is correct and undrawable. The search deliberately never touches the low-ranked residential edges the driver actually turns onto, so those have to be recovered afterwards.",
        numbers: [
          "roughly one shortcut per original edge in the hierarchy",
          "unpacking is a small fraction of the ~1ms query",
        ],
        breaks:
          "Unpacking is where a topology/metric version mismatch surfaces as garbage rather than as an error: if the metric was customised against a superseded order, the middle-node references expand into segments that do not join up.",
        choice: {
          pick: "Store one middle node per shortcut and expand recursively at query time",
          instead: "Materialise the full segment list for every shortcut at preprocessing time.",
          decider:
            "Memory against a few microseconds. A middle node is 4 bytes on 30M shortcuts; storing full paths is unbounded, because a top-level motorway shortcut can stand for hundreds of segments, and it would multiply the 2GB resident footprint several times over for latency nobody can measure.",
          flips:
            "A tiny graph where the whole expanded path set fits comfortably and preprocessing is cheap, or a pure cost query (an ETA matrix) where the polyline is never needed and unpacking can be skipped entirely.",
        },
      },
    },
    {
      id: "eta-model",
      label: "ETA model",
      sub: "current weights then profiles",
      kind: "process",
      col: 1,
      row: 4,
      parent: "routing-pod",
      detail: {
        what: "Turns the unpacked path into an arrival time, costing the near part of the trip on the current metric and the far part on historical time-of-day profiles.",
        why: "A 40-minute route uses this window's numbers for a segment you reach in 35 minutes, which is exactly the segment most likely to be wrong, because congestion moves. The hybrid is the shipped compromise between a scalar metric and full time-dependent routing.",
        numbers: [
          "NFR: ETA error p50 under 10% of trip duration",
          "current weights for the first 15 to 20 minutes",
          "historical profiles beyond that",
        ],
        breaks:
          "The drift shows up as ETA error rather than as a visibly bad route, so it is easy to under-measure: the map looks right and the clock is wrong. Some mid-trip re-plans are correcting our own earlier optimism rather than reacting to new traffic.",
        choice: {
          pick: "Hybrid: current metric for the first 15 to 20 minutes, historical profile beyond",
          instead: "Fully time-dependent routing, where each edge weight is a function of departure time.",
          decider:
            "Customisation cost multiplied by the number of time buckets, and the query itself. Time-dependent weights multiply the ~1s sweep by every bucket, and the bidirectional search stops working cleanly because the backward search does not know the arrival time it should be searching from. The hybrid costs one extra lookup per edge.",
          flips:
            "Scheduled transit, where the timetable is the metric and there is no meaningful time-independent weight at all, or freight planning hours ahead where departure time is the variable being optimised.",
        },
      },
    },

    // ------------------------------------------------- preprocessed artefacts
    {
      id: "hierarchy-group",
      label: "Preprocessed hierarchy: two artefacts, two clocks",
      kind: "zone",
      detail: {
        what: "The structure the router queries, deliberately split into a topology that depends only on the shape of the road network and a weight array that depends only on the current travel times. They are published separately and swapped separately.",
        why: "Conflating these is the classic mistake. The topology takes hours and changes when a road is built; the weights take a second and change every traffic window. Keeping them apart is what lets freshness be a file swap rather than a rebuild.",
        numbers: [
          "topology ~2GB per continent, weekly",
          "metric 240MB per continent, every 5 minutes",
        ],
        breaks:
          "The two must agree on edge ids. A metric produced against the previous order is not stale, it is nonsense, so both artefacts carry the order id they belong to and a pod refuses a pair that disagrees.",
      },
    },
    {
      id: "cch-topology",
      label: "Hierarchy topology",
      sub: "order + shortcuts, ~2GB",
      kind: "blob",
      col: 3,
      row: 1,
      parent: "hierarchy-group",
      detail: {
        what: "An immutable versioned artefact: the node order and the shortcut edges it implies, published to object storage weekly and loaded into pod memory as flat arrays.",
        why: "At rest it is a file, which is what makes rollback trivial; in the pod it is a data structure, not a dataset. Nothing about a shortest-path search survives contact with a query planner, and a single query touches this structure hundreds of times inside a millisecond.",
        numbers: [
          "30M edges plus ~30M shortcuts = 60M",
          "60M x 32B = 1.9GB, call it 2GB per continent",
          "all six continents ~12GB",
        ],
        breaks:
          "A partial or corrupt order promoted after a rebuild fails continent-wide, so a pod must refuse to load one whose fixture routes do not recost sensibly against the previous order, and the previous artefact must stay loadable.",
        choice: {
          pick: "Immutable versioned artefact in blob storage, loaded into resident arrays",
          instead: "A graph database, or a sharded store queried per hop.",
          decider:
            "Access pattern against size. The query settles hundreds of nodes inside ~1ms, so a per-hop network round trip is three orders of magnitude too slow, and the artefact is only 2GB per continent anyway. Keeping it as a versioned object rather than a live store is what makes an order rollback a pointer change.",
          flips:
            "Ad-hoc traversal workloads, k-hop neighbourhoods or reachability questions, where a query language earns its keep and the latency budget is a human's patience rather than 100ms.",
        },
      },
    },
    {
      id: "weight-metric",
      label: "Weight metric",
      sub: "one float per edge, 240MB",
      kind: "blob",
      col: 3,
      row: 3,
      parent: "hierarchy-group",
      detail: {
        what: "A versioned, immutable array of edge weights for the current traffic window, published every 5 minutes and swapped into pods behind an atomic pointer flip.",
        why: "Making the metric a separate artefact from the topology is the entire design. Freshness becomes a file swap rather than a rebuild, and a disputed route can be replanned against the exact version that produced it.",
        numbers: [
          "60M edges x 4B = 240MB per continent",
          "69GB per continent per day at a 5-minute cadence",
          "last 24h kept at full cadence, hourly samples beyond",
        ],
        breaks:
          "A query must never see half a metric. Without an atomic swap a route is computed against a mixture of two windows, which is a wrong answer with no error attached to it.",
        choice: {
          pick: "Immutable versioned weight array, promoted by an atomic pointer flip",
          instead: "Mutating weights in place, or overlaying traffic deltas on a classic hierarchy.",
          decider:
            "Consistency and reproducibility against storage cost. 240MB per continent per window is 69GB/day, cheap enough to keep 24 hours at full cadence, and it is the only way to reproduce a specific complaint. An overlay on a classic hierarchy is worse than stale: the witness decisions that chose which shortcuts exist were made under the old weights, and a missing shortcut cannot be repaired by adjusting numbers.",
          flips:
            "A single-node or development setup with one reader, where in-place mutation is simpler and there is no rollback story worth paying for.",
        },
      },
    },
    {
      id: "order-builder",
      label: "Contraction order builder",
      sub: "nested dissection, weekly",
      kind: "service",
      col: 5,
      row: 1,
      detail: {
        what: "The batch job that derives a node ordering from graph structure alone and inserts every shortcut that order implies, with no witness search and no weights involved.",
        why: "This is the half of preprocessing that must not depend on travel time. Deriving the order by nested dissection over a separator hierarchy makes the resulting topology valid for any non-negative metric, which is exactly what lets weights be refreshed without touching structure.",
        numbers: [
          "hours per continent",
          "rebuilt weekly, tracking when roads physically change",
          "adds roughly one shortcut per original edge",
        ],
        breaks:
          "An order rebuild changes every node rank and the whole shortcut set at once, invalidating every cached route and every warm metric, so it is the risky job even though it is the rare one. Shadow both orders on live traffic and keep the previous artefact loadable.",
        choice: {
          pick: "Metric-independent order by nested dissection, rebuilt weekly",
          instead:
            "Classic contraction hierarchies (Geisberger and co-authors, 2008): order by edge difference with a witness search, rebuilt nightly against one fixed metric.",
          decider:
            "How often the metric changes measured against how long preprocessing takes. Classic contraction is hours per continent and the traffic window is 5 minutes, so its structure is permanently built for stale weights. The metric-independent order carries more shortcuts and costs ~1ms per query instead of 150μs, which is 10 cores rather than 1.5 at 10k/s.",
          flips:
            "A metric that does not move: walking, cycling, distance-optimal routes, or a freight network fixed by bridge heights and weight limits. Take classic contraction and the 150μs, because there is nothing to customise.",
        },
      },
    },
    {
      id: "customisation-pass",
      label: "Customisation pass",
      sub: "bottom-up sweep, ~1s per continent",
      kind: "service",
      col: 5,
      row: 3,
      detail: {
        what: "One bottom-up sweep over the contracted nodes, setting every shortcut weight to the minimum over its two-hop paths under the current travel times, and publishing the result as a new metric version.",
        why: "This is the cheap half of preprocessing and the reason the split works. No search, no witness checks, one pass, parallel by level, so a structure built once keeps tracking a metric that is replaced every five minutes.",
        numbers: [
          "~1s for a continent-sized graph",
          "every 5 minutes = 0.3% duty cycle",
          "emits 240MB keyed by edge id",
        ],
        breaks:
          "It is a global serialisation point per continent. If the aggregator's window does not close on time, every pod in the region silently keeps serving the previous metric, which is why metric age is the page-worthy number and alerts above 120s.",
        choice: {
          pick: "Recompute every shortcut weight bottom-up, once per traffic window",
          instead: "Re-run the full contraction each night, or patch only the shortcuts whose underlying edges changed.",
          decider:
            "Cost against correctness. The full sweep is about a second per continent, a 0.3% duty cycle at a 5-minute cadence, so selective patching optimises something already free. Contraction itself is hours per continent and cannot run per window at any price.",
          flips:
            "A metric where only a handful of edges move between windows, such as a closure-only feed with no live speeds, where the override channel already delivers the change and a sweep buys nothing.",
        },
      },
    },

    // --------------------------------------------------------------- closures
    {
      id: "closure-source",
      label: "Closure sources",
      sub: "transport authorities, police feeds",
      kind: "external",
      col: 6,
      row: 1,
      detail: {
        what: "The third parties who know a road is shut: transport authorities, police and highways feeds, and roadworks schedules. Outside our trust boundary and outside our pager.",
        why: "A closed road produces no probes, which reads to the aggregator exactly like a quiet road. This is the one input the traffic pipeline structurally cannot derive, so it has to come from outside it.",
        numbers: [
          "requirement: closure reflected in routing within 60s",
          "against a 300s aggregation window",
        ],
        breaks:
          "Their coverage and latency are not ours to fix, and a feed can go quiet without failing: no closures reported is indistinguishable from no closures happening, so a silent feed needs a heartbeat rather than an error rate.",
        choice: {
          pick: "Verified institutional feeds only",
          instead: "Accept crowdsourced user reports of closures directly.",
          decider:
            "The cost of a false positive. A wrongly closed motorway re-plans every navigation in the region within one window, so the bar for writing straight into a live metric is confirmation, not volume. User reports are a useful signal for prioritising verification, not an authority to close an edge.",
          flips:
            "Disasters and fast-moving events, where institutional feeds lag by hours and being roughly right immediately beats being exactly right late. Then clustered user reports promote to a lower-confidence closure with a short expiry.",
        },
      },
    },
    {
      id: "closure-gate",
      label: "Closure override gate",
      sub: "two-source confirm, kill switch",
      kind: "service",
      col: 6,
      row: 3,
      detail: {
        what: "Our side of the override channel: it confirms, rate-limits and applies closures, writing edges impassable straight into the live weight array and handing the same set to the next customisation pass.",
        why: "The external feed is a claim; this is the component that decides whether to act on it. It exists because the override path writes into a live artefact with none of the gating a deploy gets, so the gating has to live somewhere and it cannot live in the third party.",
        numbers: [
          "impassable within 60s of a confirmed closure",
          "two-source confirmation on motorway-class edges",
          "per-region rate limit on closure events",
        ],
        breaks:
          "It owns the largest blast radius in the system. A bad polygon flagging a motorway closed re-plans every navigation in the region inside one window, and there is no gradual rollout for a metric write, so the operator kill switch is the mitigation of last resort rather than a nice-to-have.",
        choice: {
          pick: "Confirm and rate-limit, then write directly into the current weight array",
          instead: "Let the closure show up through the next aggregation window like any other speed change.",
          decider:
            "Time to reflect, and whether the window can deliver at all. The requirement is 60s against a 300s window, and the window cannot see a closure in any case because there are no probes on a closed road to aggregate.",
          flips:
            "Low-stakes advisory data such as roadworks warnings or event notices, where being one window late costs nothing and the blast radius of a bad write is not worth a second write path.",
        },
      },
    },

    // ---------------------------------------------------------------- traffic
    {
      id: "history-profiles",
      label: "Historical speed profiles",
      sub: "per segment, per time of day",
      kind: "database",
      col: 2,
      row: 5,
      detail: {
        what: "The prior: a typical speed for every segment, keyed by time of day and day of week, fitted from months of past windows. It is what fills in the ~97% of edges no probe touched, and what the ETA model uses beyond the near horizon.",
        why: "The reduce step cannot publish a weight for a segment it has no samples for, and leaving a hole is not an option because the router has to cost that edge somehow. This is where the number comes from when there is no measurement.",
        numbers: [
          "~97% of 150M global edges fall back to it in any window",
          "used under ~5 samples in the window",
          "keyed by (segment, weekday, time bucket)",
        ],
        breaks:
          "Measured and inferred weights arrive in the same units and the router cannot tell them apart, so a residential cut-through with no samples competes on equal terms with an arterial that has 60. Worse, the loop has no fix: a road nobody is routed onto never gets probes, so its profile never improves and a street closed for a month is indistinguishable from a permanently quiet one.",
        choice: {
          pick: "Keep a time-of-day prior and let the router treat it as an ordinary weight",
          instead: "Tag every weight as measured or inferred and bias the router toward measured edges.",
          decider:
            "What the bias actually does. Preferring measured edges systematically pushes traffic onto main roads, which is a product decision about routing behaviour rather than an accuracy improvement: it makes the residential complaint better in one direction and worse in the other. The prior is well calibrated on aggregate, and its failure is silent rather than large.",
          flips:
            "Safety-relevant modes such as truck routing round low bridges, or markets with very thin coverage where the prior is fitted on too little data to be trusted and an explicit confidence band is better than a confident guess.",
        },
      },
    },
    {
      id: "probe-bus",
      label: "Probe stream",
      sub: "anonymised GPS, ~1M/s peak",
      kind: "queue",
      col: 0,
      row: 6,
      detail: {
        what: "The ingest path for anonymised location pings from every device in motion with location sharing on, not only from devices actively navigating.",
        why: "It is a reduce-and-drop stream. Probes exist to produce this window's segment speeds and nothing downstream needs them afterwards, which is why the design has no long-term storage line for them at all.",
        numbers: [
          "25M moving devices at 1 probe/30s = ~1M/s peak",
          "~100B payload, so ~100MB/s ingress",
          "~250k/s off peak",
        ],
        breaks:
          "Losing a region's in-flight probes costs one window of freshness. That is the deliberate RPO: the peer region rebuilds from the next window, so the worst case is 5 to 10 minutes of routing on the last good weights.",
        choice: {
          pick: "Partitioned stream, reduced inside the window and dropped",
          instead: "Persisting raw probes for later reprocessing.",
          decider:
            "Volume against value. 100MB/s of ingress is many terabytes a day of data whose entire purpose expires in 5 minutes, and replicating it cross-region to protect a value recomputed every 5 minutes is not worth the bandwidth.",
          flips:
            "Training or evaluating the map-matching and ETA models, which need realised trajectories. Sample a small fraction under a separate retention policy rather than keeping the firehose.",
        },
      },
    },
    {
      id: "traffic-agg",
      label: "Traffic aggregator: one job, one window watermark",
      kind: "serviceGroup",
      col: 1,
      row: 6,
      detail: {
        what: "The streaming job that turns probes into the next weight metric. Match, reduce and state are stages of it rather than services: they are bound to the same 5-minute window and share its watermark.",
        why: "Splitting them into separate deployables buys nothing and costs a queue per boundary, because none of them can advance past the window the others are on. The write-up treats them as one component for the same reason: they share one pager row, and every symptom of a matching failure appears as a reduce-side lag.",
        numbers: [
          "~1M probes/s at peak",
          "300M probes per 5-minute tumbling window",
          "one output per segment per window",
        ],
        breaks:
          "If any stage falls behind, the window watermark stalls and the customisation pass downstream simply has nothing to run on. That shows up as routing staleness rather than as an ingest alert, which is why segment-update lag is monitored rather than probe throughput.",
        choice: {
          pick: "One windowed streaming job with three in-process stages",
          instead: "Three services with a queue between each pair, scaled independently.",
          decider:
            "Whether they can actually scale apart. They cannot: all three are pinned to the same window watermark, so the slowest one sets the pace regardless of how the others are provisioned, and each queue would add a serialisation hop to ~1M records/s for no isolation.",
          flips:
            "Map matching becoming a shared service with other consumers, such as fleet analytics or ETA-model training, where its output is wanted outside this window and a durable boundary earns its keep.",
        },
      },
    },
    {
      id: "map-match",
      label: "Map matching",
      sub: "HMM over candidate segments",
      kind: "process",
      col: 1,
      row: 6,
      parent: "traffic-agg",
      detail: {
        what: "Snaps each probe to a road segment using position, heading and the recent trajectory rather than distance alone, emitting (segment, speed) pairs.",
        why: "The nearest segment is routinely the wrong one. A flyover and the surface street beneath it, or a motorway and its service road, are metres apart and opposite in meaning, and consumer GPS error is comfortably larger than that gap.",
        numbers: ["~1M probes/s at peak", "standard formulation: Newson and Krumm, 2009"],
        breaks:
          "A client GPS-format change collapses matching quietly. The symptom is a falling per-segment update rate rather than an error rate, so the gate is a format version at ingest plus an alert on segment-update lag over 5 minutes.",
        choice: {
          pick: "Hidden Markov model over candidate segments, scored with the recent trajectory",
          instead: "Nearest-segment snap by geometric distance.",
          decider:
            "Ambiguity in the geometry, weighted by where the traffic is. A distance snap gets a measurable share of ~1M probes/s wrong precisely in dense interchanges, which are the segments with the most probes and the most riding on their weight.",
          flips:
            "Sparse rural networks or a fleet on known fixed routes, where there is one plausible candidate and the trajectory adds nothing an index lookup does not already give you.",
        },
      },
    },
    {
      id: "window-reduce",
      label: "Window reduce",
      sub: "trimmed mean, 5-min tumbling",
      kind: "process",
      col: 2,
      row: 6,
      parent: "traffic-agg",
      detail: {
        what: "Reduces the matched pairs into one speed per segment per 5-minute window, discarding the top and bottom 10% of samples, and falling back to the historical profile for any segment with too few.",
        why: "Raw probes are not weights. A parked car with location sharing on and a motorcyclist filtering at 100mph land in the same sample set, and the mean of those two is a number that describes no vehicle on that road.",
        numbers: [
          "300M probes per 5-minute window",
          "trims the top and bottom 10%",
          "under ~5 samples keeps the historical profile",
        ],
        breaks:
          "Coverage rather than accuracy: about 3% of the 150M global edges carry a measured weight in any window, and the fallback is invisible downstream because it is emitted in the same units on the same channel.",
        choice: {
          pick: "Trimmed mean over a 5-minute tumbling window",
          instead: "A plain mean per window, or an exponentially weighted average updated per probe.",
          decider:
            "Outliers. Discarding the top and bottom 10% removes the parked car and the filtering motorcyclist, which a mean cannot, and a tumbling window gives the customisation pass one complete consistent picture rather than a moving target.",
          flips:
            "A dense, well-behaved fleet such as buses or delivery vans with known vehicle classes, where the outliers are already excluded and a sliding or exponentially weighted estimate buys freshness for free.",
        },
      },
    },
    {
      id: "segment-state",
      label: "Segment state machine",
      sub: "free/slow/heavy/stopped, 2-window hysteresis",
      kind: "process",
      col: 4,
      row: 6,
      parent: "traffic-agg",
      detail: {
        what: "Compares each segment's reduced speed against its typical profile and drives a small state machine — free, slow, heavy, stopped, plus a Closed state only the override can set — requiring a state to hold for two consecutive windows before it changes.",
        why: "Hysteresis is not cosmetic. A segment that flaps between free and slow rewrites its weight every window, every rewrite invalidates cached routes, and drivers already committed to that road get re-planned back and forth.",
        numbers: [
          "a state must hold 2 consecutive windows",
          "slow below 0.7x typical, back to free above 0.85x",
          "stopped below 5 km/h sustained 3 windows",
        ],
        breaks:
          "Hysteresis is deliberately slow to react. A genuine sudden jam is reflected one window late, which is 5 minutes of routing people onto a road that has just stopped moving — the price paid for not re-planning everyone on a borderline segment twice an hour.",
        choice: {
          pick: "Per-segment state machine with 2-window hysteresis and asymmetric thresholds",
          instead: "Publish the reduced speed directly and let the router see every fluctuation.",
          decider:
            "Route churn. A borderline segment crossing its threshold every window rewrites its weight every 5 minutes and invalidates every cached route through it; asymmetric enter and exit thresholds (0.7x in, 0.85x out) are what stop a segment sitting on the boundary from oscillating at all.",
          flips:
            "Incident detection or an operations console, where the point is to see the change the moment it happens and there is no re-planning cost attached to reacting early.",
        },
      },
    },
  ],
  edges: [
    // ----------------------------------------------------------------- tiles
    {
      id: "e1",
      from: "client",
      to: "tile-cdn",
      label: "tiles (z, x, y)",
      animated: true,
      fromSide: "top",
      toSide: "left",
      detail: {
        what: "Tile fetches as the user pans and zooms, addressed by zoom, column and row.",
        why: "The map on screen is bytes written weeks ago. Keeping the key purely geometric, with no per-user variation in it, is what makes every response cacheable for everybody at the edge.",
        numbers: ["~20 tiles per session", "10B/day, ~350k/s at peak", "p99 under 500ms"],
        breaks:
          "High zoom bands cache worst, typically under 90% hit above z=14 against over 99% below z=10, so the miss traffic concentrates in exactly the detailed tiles that cost most to render.",
      },
    },
    {
      id: "e2",
      from: "tile-cdn",
      to: "tile-origin",
      label: "5% miss, ~5.8k/s",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The cache miss path: a tile the edge does not hold being fetched from object storage.",
        why: "Cold tiles are the long tail of a Zipfian distribution, so they are pulled lazily on first request rather than pushed. The origin exists to be boring and small.",
        numbers: ["5% of 10B/day = 500M/day", "~5.8k req/s average, ~17k/s at peak"],
        breaks:
          "Origin capacity is a consequence of cache behaviour rather than of user traffic: at an 80% hit rate the same product needs 23k/s of origin instead of 5.8k/s.",
      },
    },
    {
      id: "e3",
      from: "tile-builder",
      to: "tile-origin",
      label: "re-rendered tiles",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Newly rendered tile objects written back to the corpus for the regions a diff touched.",
        why: "Tiles are versioned rather than mutated so the CDN can be told about a new pointer instead of being asked to invalidate individual keys across every point of presence.",
        numbers: ["15TB/week", "~1% of materialised tiles"],
        breaks:
          "Flipping the version pointer before popular tiles are warm dumps the whole invalidation set onto the origin at once, which is the failure that takes tile serving down after a large edit.",
      },
    },
    {
      id: "e4",
      from: "map-source",
      to: "tile-builder",
      label: "diff bounding boxes",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The applied diff, reduced to the bounding boxes of what changed so the builder can compute the tile set to re-render.",
        why: "Geometry is the fastest-changing of the three derivations and the cheapest to redo, so it takes the diff directly rather than waiting for anything to be rebuilt.",
        numbers: ["~3M edits/day", "~1% of materialised tiles touched per week"],
        breaks:
          "One boundary edit expands to thousands of tiles from z=10 to z=18, so the bounding box has to be expanded per zoom level and deduped before it reaches the render queue, or the queue length becomes a function of editor behaviour.",
      },
    },
    {
      id: "e5",
      from: "map-source",
      to: "order-builder",
      label: "topology changes",
      fromSide: "bottom",
      toSide: "top",
      dashed: true,
      detail: {
        what: "The same upstream data, read for structure rather than geometry: which intersections exist, which segments connect them, and what the turn restrictions are.",
        why: "Drawn dashed and slow because the order only has to track when roads physically change, not when the map is edited. A relabelled café moves a tile and nothing else.",
        numbers: ["rebuilt weekly", "~50M nodes and ~150M edges globally"],
        breaks:
          "This is the slowest of the three clocks, so it sets how long a new road stays unroutable: up to a week after it is already visible on the map, which is the complaint users actually file.",
      },
    },

    // --------------------------------------------------------------- routing
    {
      id: "e6",
      from: "client",
      to: "upward-search",
      label: "POST /route",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A route request carrying origin, destination, mode and preferences.",
        why: "One request per trip start plus a re-plan only on genuine deviation. Everything expensive about routing has already happened by the time this arrives, which is why a 100ms in-pod budget is achievable at all.",
        numbers: ["~1.7k/s trip starts at peak", "~4.2k/s re-plans", "~10k/s total including previews"],
        breaks:
          "Cross-region requests do not fit this shape. Pods hold one continent, so a Lisbon to Warsaw query is stitched through a boundary-node table across two pods and runs 3 to 5x slower, and it breaks outright if the two regions are on different order versions.",
      },
    },
    {
      id: "e7",
      from: "upward-search",
      to: "shortcut-unpack",
      label: "winning shortcut path",
      detail: {
        what: "The meeting node and the chain of shortcut edges that won, handed on for expansion.",
        why: "The search deliberately never touched the low-ranked edges the driver actually turns onto, so what it produces is a correct answer in the wrong vocabulary.",
        numbers: ["hundreds of nodes settled", "in-process, no network hop"],
        breaks:
          "If the topology and metric versions disagree, this is where it becomes visible: the middle-node references expand into segments that do not join up, rather than into an error.",
      },
    },
    {
      id: "e8",
      from: "shortcut-unpack",
      to: "eta-model",
      label: "road segments",
      detail: {
        what: "The fully expanded path as original road segments, ready to be costed and turned into a polyline and turn list.",
        why: "The ETA is computed over real segments rather than shortcuts because the near part of the trip has to be costed on the live metric segment by segment, and a shortcut summarises a weight rather than a stretch of road.",
        numbers: ["in-process, no network hop"],
        breaks:
          "A very long route expands to a large segment list, so the polyline has to be simplified for transport; over-simplifying it is what makes the client's own map matching drift and fire spurious re-plans.",
      },
    },
    {
      id: "e9",
      from: "eta-model",
      to: "client",
      label: "polyline + turns + ETA",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The response: the route polyline, the turn instructions and an arrival time, plus the metric version it was planned against.",
        why: "This is the whole contract with the client for the rest of the trip. Everything after it — speaking turns, matching GPS, deciding whether to ask again — happens on the phone against these bytes.",
        numbers: ["one response per trip start", "under 1s end to end"],
        breaks:
          "The metric version has to travel with the answer. Without it a complaint about a route cannot be replanned against the numbers that produced it, and the only available reply is a guess.",
      },
    },
    {
      id: "e10",
      from: "cch-topology",
      to: "upward-search",
      label: "order + shortcuts, weekly",
      dashed: true,
      fromSide: "left",
      toSide: "top",
      detail: {
        what: "The topology being loaded into pod memory, which happens on the weekly order cadence rather than the traffic cadence.",
        why: "Drawn as a control path because it is not traffic, it is a deployment. Separating it from the metric swap is what makes a bad order rollback-able without touching freshness.",
        numbers: ["~2GB per continent", "weekly"],
        breaks:
          "Loading an order whose fixture routes fail their cost comparison would break routing continent-wide, so pods must refuse it and pin the previous artefact instead.",
      },
    },
    {
      id: "e11",
      from: "weight-metric",
      to: "upward-search",
      label: "metric swap, every 5 min",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The current weight array being swapped into a running pod behind a pointer flip. This is the arrow the whole design is about.",
        why: "It is not a request path. It is the weights being replaced underneath a resident graph, which is how a structure preprocessed for one metric keeps answering questions about a world that changed 90 seconds ago.",
        numbers: ["240MB per swap", "metric age alerted above 120s"],
        breaks:
          "If the swap stalls, nothing fails: pods keep serving the previous metric and every route silently gets older, which is why metric age is a first-class monitored number rather than an implementation detail.",
      },
    },

    // ---------------------------------------------------- preprocessing jobs
    {
      id: "e12",
      from: "order-builder",
      to: "cch-topology",
      label: "weekly rebuild",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A newly computed order and its shortcut set published as an artefact.",
        why: "Roads change on the timescale of construction, not congestion, so this pipeline runs on its own slow clock and never blocks the fast one.",
        numbers: ["hours to build", "~60M edges after contraction"],
        breaks:
          "Promotion is the dangerous moment: node ranks change wholesale, so the new order is customised and shadowed against live traffic before it is allowed to take queries.",
      },
    },
    {
      id: "e13",
      from: "cch-topology",
      to: "customisation-pass",
      label: "shortcut topology",
      dashed: true,
      fromSide: "top",
      toSide: "top",
      offset: 60,
      detail: {
        what: "The pass reading the current order and shortcut set so it knows which weights to compute and in what sequence.",
        why: "The sweep is defined by the topology: visit contracted nodes in order, take the minimum over each shortcut's two-hop paths. Without the order there is nothing to sweep, which is why the two artefacts are versioned together.",
        numbers: ["one pass, parallel by level", "~1s per continent"],
        breaks:
          "A metric computed against a superseded order is not stale, it is meaningless, because edge ids no longer refer to the same shortcuts. Both artefacts have to carry the order id.",
      },
    },
    {
      id: "e14",
      from: "customisation-pass",
      to: "weight-metric",
      label: "writes 240MB array",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The output of the sweep: a complete new weight array keyed by edge id, published as a new version.",
        why: "Publishing a whole artefact rather than a patch is what makes the swap atomic and the result reproducible. Versions are cheap and being able to recost a complaint against the exact metric that produced it is the only debugging tool that works.",
        numbers: ["240MB per continent per window", "one version every 5 minutes"],
        breaks:
          "An output that moves fixture route costs wildly means bad aggregation rather than bad traffic, and it must be gated before promotion; stale but consistent beats fresh and wrong.",
      },
    },

    // --------------------------------------------------------------- traffic
    {
      id: "e15",
      from: "client",
      to: "probe-bus",
      label: "anonymised GPS pings",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Location pings with lat, lng, heading, speed, timestamp and a rotating id, sent from devices in motion.",
        why: "The probe stream is not a navigation feature: it comes from everyone with location sharing on, which is what gives coverage on roads nobody is currently being routed along.",
        numbers: ["~1 probe/30s per device", "25M moving devices at peak", "~100B per payload"],
        breaks:
          "This is the arrow with a privacy position attached to it. The id rotates and nothing raw is retained, which is only defensible because the aggregate is recomputed from scratch every 5 minutes.",
      },
    },
    {
      id: "e16",
      from: "probe-bus",
      to: "map-match",
      label: "~1M probes/s",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Batches of raw probes handed to matching.",
        why: "Ingest and matching are the one boundary in this pipeline that is genuinely a queue: ingest is network bound and trivially partitioned, matching is CPU bound and needs a probe's recent history, and the buffer between them absorbs the commute ramp.",
        numbers: ["~1M/s at peak", "~250k/s off peak"],
        breaks:
          "If matching falls behind, the window watermark stalls and the customisation pass downstream simply has nothing to run on, which shows up as routing staleness rather than as an ingest alert.",
      },
    },
    {
      id: "e17",
      from: "map-match",
      to: "window-reduce",
      label: "(segment, speed)",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Matched pairs: one road segment and one observed speed per probe.",
        why: "This is where a location becomes a fact about a road. Everything downstream is arithmetic over segments, so the graph identity is attached exactly once, here.",
        numbers: ["300M pairs per 5-minute window"],
        breaks:
          "A mismatched probe is indistinguishable from a real observation downstream, so a systematic matching error on one interchange quietly poisons that segment's weight for as long as it persists.",
      },
    },
    {
      id: "e18",
      from: "window-reduce",
      to: "segment-state",
      label: "trimmed mean/segment",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "One speed per segment for the closed window, measured where there were enough samples and taken from the profile where there were not.",
        why: "The state machine needs a single settled number per segment per window; comparing a distribution against a profile every window is the same decision made with more moving parts.",
        numbers: ["~3% of edges measured", "the rest carry the profile"],
        breaks:
          "Measured and inferred values travel on the same channel in the same units, so nothing after this point can tell them apart, and the state machine will happily transition a segment on the strength of a prior.",
      },
    },
    {
      id: "e19",
      from: "history-profiles",
      to: "window-reduce",
      label: "under 5 samples",
      dashed: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The fallback lookup: a segment with too few probes in the window takes its typical speed for this weekday and time bucket instead.",
        why: "There is no third option. The router has to cost every edge, so a segment with no measurement gets a prior rather than a hole, and the prior is calibrated well enough on aggregate to be defensible.",
        numbers: ["applies to ~97% of edges in any window", "threshold ~5 samples"],
        breaks:
          "The fallback is silent by design, so a matching regression that stops producing pairs for a whole region looks identical to a quiet region: both simply fall back, and the metric stays plausible while being entirely inferred.",
      },
    },
    {
      id: "e20",
      from: "history-profiles",
      to: "eta-model",
      label: "beyond ~20 min",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The far half of the trip costed on typical speeds for the time the driver will actually be there, rather than on this window's numbers.",
        why: "Current weights are the best estimate for the next 15 to 20 minutes and a worse one after that, because congestion moves. This is the cheap approximation of time-dependent routing.",
        numbers: ["current weights for the first 15 to 20 minutes", "profiles beyond"],
        breaks:
          "The handover point is arbitrary, so routes look optimal at departure and drift afterwards, and the drift surfaces as ETA error rather than as a visibly wrong road.",
      },
    },
    {
      id: "e21",
      from: "segment-state",
      to: "customisation-pass",
      label: "per-segment speeds",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The settled per-segment speeds for the closed window, handed to the sweep as the metric to customise against.",
        why: "The pass needs one complete, consistent picture rather than a stream, because a hierarchy customised against a half-formed window is internally inconsistent in ways no query can detect.",
        numbers: ["one window every 5 minutes", "~3% measured, the rest inferred"],
        breaks:
          "This is the serialisation point of the whole loop. If the window does not close on time the sweep has nothing to run on, every pod keeps serving the previous metric, and the only visible symptom is metric age climbing.",
      },
    },

    // --------------------------------------------------------------- closures
    {
      id: "e22",
      from: "closure-source",
      to: "closure-gate",
      label: "verified closures",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Closure notices from transport authorities and police feeds arriving as edge or polygon claims.",
        why: "This is the only input to the routing metric that does not come from probes, and it exists because a closed road generates no probes at all.",
        numbers: ["must reach routing within 60s", "against a 300s aggregation window"],
        breaks:
          "Silence is ambiguous: a feed that has stopped publishing looks exactly like a period with no closures, so this arrow needs a heartbeat rather than an error rate to be monitorable at all.",
      },
    },
    {
      id: "e23",
      from: "closure-gate",
      to: "weight-metric",
      label: "impassable now",
      dashed: true,
      fromSide: "bottom",
      toSide: "bottom",
      offset: 70,
      detail: {
        what: "A confirmed closure setting the affected edges impassable in the array pods are currently serving, without waiting for a window.",
        why: "It is the one input allowed to skip the pipeline, because the pipeline structurally cannot see it: no probes are generated on a closed road, so aggregation reads a closure as quiet traffic.",
        numbers: ["within 60s against a 300s window"],
        breaks:
          "It writes directly into a live artefact, so it has the blast radius of a deploy with none of the gating. Two-source confirmation on motorway-class edges and an operator kill switch are what make it survivable.",
      },
    },
    {
      id: "e24",
      from: "closure-gate",
      to: "customisation-pass",
      label: "folded next window",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The same closure set handed to the next sweep, so the closure becomes part of the metric properly rather than remaining a patch on top of one version of it.",
        why: "Without this the override would be lost at the next pointer flip: the sweep rebuilds every shortcut weight from the traffic metric, and anything written directly into the previous array is simply overwritten.",
        numbers: ["folded in on the next 5-minute cycle"],
        breaks:
          "If the fold is missed, a closed road reopens by itself at the next metric swap and nothing logs it, because the override write and the sweep are both behaving exactly as designed.",
      },
    },
  ],
};
