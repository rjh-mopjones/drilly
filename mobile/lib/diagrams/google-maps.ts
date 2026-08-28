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
    {
      id: "hierarchy-group",
      label: "Preprocessed hierarchy: two artefacts, two clocks",
      kind: "zone",
      x: 424,
      y: 424,
      w: 272,
      h: 218,
      detail: {
        what: "The structure the router queries, deliberately split into a topology that depends only on the shape of the road network and a weight array that depends only on the current travel times.",
        why: "Conflating these is the classic mistake. The topology takes hours and changes when a road is built; the weights take a second and change every traffic window. Keeping them apart is what lets freshness be a file swap rather than a rebuild.",
        numbers: ["topology ~2GB per continent, weekly", "metric 240MB per continent, every 5 minutes"],
        breaks:
          "The two must agree on edge ids. A metric produced against the previous order is not stale, it is nonsense, so both artefacts carry the order id they belong to.",
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "map view + navigation session",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
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
    {
      id: "routing-pod",
      label: "Routing pod",
      sub: "bidirectional upward search, ~1ms",
      kind: "service",
      x: 40,
      y: 140,
      w: 280,
      detail: {
        what: "A query server holding one continent's hierarchy in RAM, answering routes with a bidirectional search that only ever relaxes edges toward higher-ranked nodes.",
        why: "The 100ms budget makes the raw query impossible, so the pod does almost no exploration: it climbs from both ends toward the motorway level and stops when the smallest tentative key exceeds the best combined distance found, then unpacks shortcuts to recover the polyline.",
        numbers: [
          "~10M nodes and ~30M edges per continent",
          "~1ms per query customisable, ~150μs classic",
          "~10k route computes/s at peak",
        ],
        breaks:
          "Sharding does not rescue a shortest-path query, it splits the answer rather than the load: any route crossing a boundary needs both shards plus a boundary table to join them, and a Lisbon to Warsaw route runs 3 to 5x slower through that stitch.",
        choice: {
          pick: "Bidirectional upward search over a resident shortcut hierarchy, one continent per pod",
          instead: "Unguided or plain bidirectional Dijkstra over the raw graph, sharded by region.",
          decider:
            "Cores. An unguided continental query is ~0.5s of CPU, so 10k/s needs 5,000 cores running flat out; the hierarchy query at ~1ms needs 10. Four orders of magnitude, paid once in preprocessing, is the reason the entire design exists.",
          flips:
            "A city-sized graph, where a plain search returns in milliseconds and hours of preprocessing plus a weekly rebuild is pure operational cost for latency nobody can perceive.",
        },
      },
    },
    {
      id: "probe-bus",
      label: "Probe stream",
      sub: "anonymised GPS, ~1M/s peak",
      kind: "queue",
      x: 40,
      y: 280,
      w: 280,
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
      id: "map-matcher",
      label: "Map matcher",
      sub: "HMM over candidate segments",
      kind: "service",
      x: 40,
      y: 400,
      w: 280,
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
      id: "traffic-agg",
      label: "Traffic aggregator",
      sub: "trimmed mean, 5-min tumbling window",
      kind: "service",
      x: 40,
      y: 520,
      w: 280,
      detail: {
        what: "Reduces map-matched pairs into one speed per segment per 5-minute window, then drives a per-segment state machine (free, slow, heavy, stopped) with hysteresis.",
        why: "Raw probes are not weights. A parked car with location sharing on and a motorcyclist filtering at 100mph land in the same sample set, and a segment that flaps between states rewrites its weight every window and re-plans everyone already committed to it.",
        numbers: [
          "300M probes per 5-minute window",
          "trims the top and bottom 10%",
          "under ~5 samples keeps the historical profile",
          "a state must hold 2 consecutive windows",
        ],
        breaks:
          "Coverage rather than accuracy: about 3% of the 150M global edges carry a measured weight in any window, the rest fall back to a time-of-day prior, and the router treats a measurement and a guess as the same kind of number.",
        choice: {
          pick: "Trimmed mean over a 5-minute tumbling window, with 2-window hysteresis on state changes",
          instead: "A plain mean per window, or an exponentially weighted average updated per probe.",
          decider:
            "Outliers and flap. Discarding the top and bottom 10% removes the parked car and the filtering motorcyclist, which a mean cannot; requiring two consecutive windows stops a borderline segment rewriting its weight every 5 minutes and invalidating cached routes each time.",
          flips:
            "A dense, well-behaved fleet such as buses or delivery vans with known vehicle classes, where the outliers are already excluded and freshness matters more than stability.",
        },
      },
    },
    {
      id: "customisation-pass",
      label: "Customisation pass",
      sub: "bottom-up sweep, ~1s per continent",
      kind: "service",
      x: 40,
      y: 640,
      w: 280,
      detail: {
        what: "One bottom-up sweep over the contracted nodes, setting every shortcut weight to the minimum over its two-hop paths under the current travel times.",
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
    {
      id: "tile-cdn",
      label: "Tile CDN",
      sub: "(z, x, y) key, 95%+ hit rate",
      kind: "service",
      x: 440,
      y: 0,
      w: 240,
      detail: {
        what: "A global cache fleet answering tile requests from the point of presence nearest the user, keyed only by zoom, column and row.",
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
      kind: "database",
      x: 440,
      y: 110,
      w: 240,
      detail: {
        what: "The materialised tile corpus: one gzipped MVT object per (z, x, y) that has any content in it, carrying geometry and properties rather than pixels.",
        why: "The quadtree holds 4^z tiles per zoom, so z=0 to 20 is (4^21 - 1)/3 or about 1.4T addressable tiles. Around 70% of the surface is ocean and most high-zoom land tiles are empty, so you store what exists rather than what is addressable.",
        numbers: [
          "1.4T addressable, 1 to 5% materialise",
          "~50B tiles x 30KB blended = 1.5PB",
          "10 to 50KB per tile, rural against dense urban",
        ],
        breaks:
          "Object count rather than bytes: 50B objects is a metadata problem in its own right, and any operation that wants to enumerate or sweep the corpus will not finish.",
        choice: {
          pick: "One vector (MVT) corpus, styled on the client",
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
      x: 440,
      y: 220,
      w: 240,
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
      id: "order-builder",
      label: "Contraction order builder",
      sub: "nested dissection, weekly",
      kind: "service",
      x: 440,
      y: 330,
      w: 240,
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
          instead: "Classic contraction hierarchies (Geisberger and co-authors, 2008): order by edge difference with a witness search, rebuilt nightly against one fixed metric.",
          decider:
            "How often the metric changes measured against how long preprocessing takes. Classic contraction is hours per continent and the traffic window is 5 minutes, so its structure is permanently built for stale weights. The metric-independent order carries more shortcuts and costs ~1ms per query instead of 150μs, which is 10 cores rather than 1.5 at 10k/s.",
          flips:
            "A metric that does not move: walking, cycling, distance-optimal routes, or a freight network fixed by bridge heights and weight limits. Take classic contraction and the 150μs, because there is nothing to customise.",
        },
      },
    },
    {
      id: "cch-topology",
      label: "Hierarchy topology",
      sub: "order + shortcuts, ~2GB",
      kind: "database",
      x: 440,
      y: 440,
      w: 240,
      detail: {
        what: "The node order and the shortcut edges it implies, held in pod memory as arrays rather than in any kind of database.",
        why: "It is a data structure, not a dataset. Nothing about a shortest-path search survives contact with a query planner, and a single query touches this structure hundreds of times inside a millisecond.",
        numbers: [
          "30M edges plus ~30M shortcuts = 60M",
          "60M x 32B = 1.9GB, call it 2GB per continent",
          "all six continents ~12GB",
        ],
        breaks:
          "A partial or corrupt order promoted after a rebuild fails continent-wide, so a pod must refuse to load one whose fixture routes do not recost sensibly against the previous order.",
        choice: {
          pick: "Resident in-memory arrays, one continent per pod",
          instead: "A graph database, or a sharded store queried per hop.",
          decider:
            "Access pattern against size. The query settles hundreds of nodes inside ~1ms, so a per-hop network round trip is three orders of magnitude too slow, and the artefact is only 2GB per continent anyway. Pods are pinned per region for preprocessing blast radius, not for RAM: 12GB globally would fit one large box.",
          flips:
            "Ad-hoc traversal workloads, k-hop neighbourhoods or reachability questions, where a query language earns its keep and the latency budget is a human's patience rather than 100ms.",
        },
      },
    },
    {
      id: "weight-metric",
      label: "Weight metric",
      sub: "one float per edge, 240MB",
      kind: "database",
      x: 440,
      y: 550,
      w: 240,
      detail: {
        what: "A versioned array of edge weights for the current traffic window, swapped into pods behind a pointer flip.",
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
      id: "closure-feed",
      label: "Closure override",
      sub: "impassable within 60s",
      kind: "external",
      x: 440,
      y: 660,
      w: 240,
      detail: {
        what: "An out-of-band channel from verified closure sources that marks edges impassable immediately, bypassing the aggregation window entirely.",
        why: "A closed road produces no probes, which reads to the aggregator exactly like a quiet road. The one case where the historical profile is actively wrong rather than merely imprecise is the case the traffic pipeline cannot detect at all.",
        numbers: ["closure reflected in routing within 60s", "against a 300s aggregation window"],
        breaks:
          "A bad polygon flagging a motorway closed creates a re-planning storm across every navigation in the region inside one window, so motorway-class closures need two-source confirmation, per-region rate limits and an operator kill switch.",
        choice: {
          pick: "Override channel writing straight into the current weight array",
          instead: "Letting the closure show up through the next aggregation window like any other speed change.",
          decider:
            "Time to reflect, and whether the window can deliver at all. The requirement is 60s against a 300s window, and the window cannot see a closure in any case because there are no probes on a closed road to aggregate. The next customisation pass folds the override in properly.",
          flips:
            "Low-stakes advisory data such as roadworks warnings or event notices, where being one window late costs nothing and the blast radius of a bad write is not worth a second write path.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "tile-cdn",
      label: "tiles (z, x, y)",
      animated: true,
      fromSide: "right",
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
      from: "client",
      to: "routing-pod",
      label: "POST /route",
      animated: true,
      detail: {
        what: "A route request carrying origin, destination, mode and preferences, answered with a polyline, turn steps and an ETA.",
        why: "One request per trip start plus a re-plan only on genuine deviation. Everything expensive about routing has already happened by the time this arrives, which is why a 100ms in-pod budget is achievable at all.",
        numbers: ["~1.7k/s trip starts at peak", "~4.2k/s re-plans", "~10k/s total including previews"],
        breaks:
          "Cross-region requests do not fit this shape. Pods hold one continent, so a Lisbon to Warsaw query is stitched through a boundary-node table across two pods and runs 3 to 5x slower, and it breaks outright if the two regions are on different order versions.",
      },
    },
    {
      id: "e5",
      from: "client",
      to: "probe-bus",
      label: "anonymised GPS pings",
      animated: true,
      detail: {
        what: "Location pings with lat, lng, heading, speed, timestamp and a rotating id, sent from devices in motion.",
        why: "The probe stream is not a navigation feature: it comes from everyone with location sharing on, which is what gives coverage on roads nobody is currently being routed along.",
        numbers: ["~1 probe/30s per device", "25M moving devices at peak", "~100B per payload"],
        breaks:
          "This is the arrow with a privacy position attached to it. The id rotates and nothing raw is retained, which is only defensible because the aggregate is recomputed from scratch every 5 minutes.",
      },
    },
    {
      id: "e6",
      from: "probe-bus",
      to: "map-matcher",
      detail: {
        what: "Batches of raw probes handed to matching.",
        why: "Ingest and matching scale on different things: ingest is network bound and trivially partitioned, matching is CPU bound and needs a probe's recent history, so they are separated rather than fused.",
        numbers: ["~1M/s at peak"],
        breaks:
          "If matching falls behind, the window watermark stalls and the customisation pass downstream simply has nothing to run on, which shows up as routing staleness rather than as an ingest alert.",
      },
    },
    {
      id: "e7",
      from: "map-matcher",
      to: "traffic-agg",
      label: "(segment, speed)",
      detail: {
        what: "Matched pairs: one road segment and one observed speed per probe.",
        why: "This is where a location becomes a fact about a road. Everything downstream is arithmetic over segments, so the graph identity is attached exactly once, here.",
        numbers: ["300M pairs per 5-minute window"],
        breaks:
          "A mismatched probe is indistinguishable from a real observation downstream, so a systematic matching error on one interchange quietly poisons that segment's weight for as long as it persists.",
      },
    },
    {
      id: "e8",
      from: "traffic-agg",
      to: "customisation-pass",
      label: "per-segment speeds",
      detail: {
        what: "The reduced speed per segment for the closed window, plus historical profiles for segments with too few samples.",
        why: "The pass needs one complete, consistent picture of the metric rather than a stream, because a hierarchy customised against a half-formed window is internally inconsistent in ways no query can detect.",
        numbers: ["~3% of edges carry a measured speed", "the rest fall back to a time-of-day profile"],
        breaks:
          "Measured and inferred weights arrive in the same units and the router cannot tell them apart, so a residential cut-through with no samples competes on equal terms with an arterial that has 60.",
      },
    },
    {
      id: "e9",
      from: "customisation-pass",
      to: "weight-metric",
      label: "writes 240MB array",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The output of the sweep: a complete new weight array keyed by edge id, published as a new version.",
        why: "Publishing a whole artefact rather than a patch is what makes the swap atomic and the result reproducible. Versions are cheap and being able to recost a complaint against the exact metric that produced it is the only debugging tool that works.",
        numbers: ["240MB per continent per window", "one version every 5 minutes"],
        breaks:
          "An output that moves fixture route costs wildly means bad aggregation rather than bad traffic, and it must be gated before promotion; stale but consistent beats fresh and wrong.",
      },
    },
    {
      id: "e10",
      from: "weight-metric",
      to: "routing-pod",
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
    {
      id: "e11",
      from: "cch-topology",
      to: "routing-pod",
      label: "order + shortcuts, weekly",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The topology being loaded into pod memory, which happens on the weekly order cadence rather than the traffic cadence.",
        why: "Drawn as a control path because it is not traffic, it is a deployment. Separating it from the metric swap is what makes a bad order rollback-able without touching freshness.",
        numbers: ["~2GB per continent", "weekly"],
        breaks:
          "Loading an order whose fixture routes fail their cost comparison would break routing continent-wide, so pods must refuse it and pin the previous artefact instead.",
      },
    },
    {
      id: "e12",
      from: "order-builder",
      to: "cch-topology",
      label: "weekly rebuild",
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
      fromSide: "left",
      toSide: "right",
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
      from: "closure-feed",
      to: "weight-metric",
      label: "impassable now",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "A verified closure setting the affected edges impassable in the array that pods are currently serving, without waiting for a window.",
        why: "It is the one input allowed to skip the pipeline, because the pipeline structurally cannot see it: no probes are generated on a closed road, so aggregation reads a closure as quiet traffic.",
        numbers: ["within 60s against a 300s window"],
        breaks:
          "It writes directly into a live artefact, so it has the blast radius of a deploy with none of the gating. Two-source confirmation on motorway-class edges and a kill switch are what make it survivable.",
      },
    },
  ],
};
