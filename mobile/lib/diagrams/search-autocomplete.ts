import type { Diagram } from "./types";

export const SEARCH_AUTOCOMPLETE: Diagram = {
  id: "search-autocomplete",
  title: "Search Autocomplete",
  question: "Design a Search Autocomplete (Google Suggest)",
  sourceId: "patterns",
  itemId: 10,
  overview: {
    shape:
      "Two systems share nothing but a file: an hourly batch pipeline precomputes every prefix's answer, and the serving path only walks a few characters to a pointer read.",
    forces: [
      {
        constraint: "the prefix 'th' alone draws ~60K requests/s at peak while a partition owning 'z' sits idle",
        decision: "compile the index small enough that every node holds all of it, so there is no shard to skew",
        lights: ["fst-index", "serving-node"],
      },
      {
        constraint: "gathering and ranking a prefix's completions live would be 1 to 3ms against a 50ms budget",
        decision: "precompute every node's top-10 offline so a lookup is a pointer read, ~1 microsecond",
        lights: ["topk", "suggest"],
      },
      {
        constraint: "a hashmap trie with top-K payloads is ~76GB, too big for a 64GB serving box",
        decision: "minimise it to an FST that shares suffixes as well as prefixes, compiling to ~12GB",
        lights: ["compile", "fst-index"],
      },
      {
        constraint: "popularity can shift in under a minute, far faster than the 1-hour build cadence",
        decision: "merge a small streaming overlay trie rebuilt every 60s alongside the immutable snapshot",
        lights: ["overlay", "stream-agg"],
      },
      {
        constraint: "a 60s overlay can surface a term no build-time filter has ever seen",
        decision: "run a second, cheap policy filter at serve time on top of the build-time blocklist",
        lights: ["policy-filter", "safety"],
      },
    ],
    naive: {
      text: "A reader defaults to a live database query: store completions in a table and filter and sort by popularity on every keystroke. That breaks at 2M peak QPS and a ~50ms budget. Ranking a prefix's full completion set live is 1 to 3ms of gathering and heap-selecting, not the microseconds a request can afford. The design precomputes instead: Trie + top-K roll-up finishes every prefix's answer offline, so the serving path only ever does a pointer read.",
      lights: ["topk", "fst-index"],
    },
    beats: [
      {
        text: "Debounce and the edge come first because between them they decide how big the fleet is. The client suppresses prefixes under three characters and debounces 150ms. That collapses roughly six eligible keystrokes into about five suggest calls per search. A 60 second edge TTL then absorbs about 95% of the resulting 2M peak QPS.",
        lights: ["client", "cdn"],
      },
      {
        text: "What survives to the origin is a lookup rather than a search. Each serving node holds the entire 12GB FST in memory, walks one character per typed character, and reads the top-10 list already sitting at that node. That costs about a microsecond, so the network round trip, not the computation, spends the 50ms server budget.",
        lights: ["serving-node", "suggest", "fst-index"],
      },
      {
        text: "The precomputation is the whole design. An hourly job reads a rolling 24 hours of query logs and keeps the ~100M distinct strings that clear a floor of five occurrences a day. It builds a trie over them and walks it post-order, so every parent's top-10 is selected from the union of its children's top-10 lists in a single pass.",
        lights: ["build-job", "aggregate", "topk"],
      },
      {
        text: "Compilation is what deletes the routing layer. A hashmap trie carrying those top-K payloads is about 76GB and does not fit a 64GB box. That would force sharding by first character and hand you the hot-prefix skew as a permanent tax. Minimising to an FST lands at about 12GB, so every node holds everything and there is nothing left to route.",
        lights: ["compile", "fst-index"],
      },
      {
        text: "Freshness is bolted on beside the snapshot rather than expressed inside it. A streaming job rebuilds a 50 to 100MB overlay trie every 60 seconds from the live query stream. The serving node merges the two lists for about 5 microseconds. This overlay is the only mutable thing anywhere on the request path.",
        lights: ["overlay", "stream-agg"],
      },
      {
        text: "Publishing is the part that actually hurts. Nodes pull the 12GB snapshot from object storage rather than from the build host, because 200 nodes times 12GB is 2.4TB an hour. Each then verifies a checksum, runs about 1000 canary prefixes, and flips one atomic pointer in 10% waves with a two-minute soak between them.",
        lights: ["object-store", "loader", "fst-index"],
      },
      {
        text: "Safety is two filters at two speeds. The build-time blocklist and classifier run before anything can reach a node's top-K, which is the cheap place to do it. The serve-time filter exists because the 60 second overlay can put a term in front of a user that no build-time pass has ever seen. A takedown clock measured in hours also cannot wait for the next build.",
        lights: ["safety", "policy-filter"],
      },
    ],
    crux: {
      problem:
        "Prefix traffic is far more skewed than the query distribution underneath it, because every long query passes through the same short prefixes on its way. The prefix 'th' alone is roughly 60K requests per second at peak while a partition owning 'z' sits idle.",
      handled:
        "You do not balance that skew, you delete it. Make the structure small enough that every node holds all of it, and let the edge absorb the short prefixes before they reach a server.",
    },
    numbers: [
      {
        value: "2M peak QPS, ~100K at the origin after a 95% edge hit rate",
        explain: "Debouncing and the edge cache together cut the traffic the origin fleet actually has to serve by twenty-fold.",
      },
      {
        value: "12GB compiled FST vs ~76GB hashmap trie",
        explain: "Suffix sharing during compilation turns a structure too large for any serving box into one every node can hold whole.",
      },
      {
        value: "50ms server p99 inside a ~100ms keypress-to-paint budget",
        explain: "Half the user-facing latency budget is spent on the network round trip rather than on computation, since a lookup itself costs about a microsecond.",
      },
    ],
  },
  nodes: [
    {
      id: "client",
      label: "Browser client",
      sub: "150ms debounce, history merge",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The typing surface: it debounces keystrokes, suppresses prefixes shorter than three characters, and blends the user's own recent queries into the list before painting.",
        why: "This is the cheapest request reduction in the system, because a request removed here never exists. It is also where personalisation has to live: the moment the origin sees a user identity the response stops being cacheable and the 95% edge hit rate evaporates. It is a client rather than a third party because its behaviour is a load-bearing input to every capacity number below it, and it ships with the product.",
        numbers: [
          { value: "~20 character average query, ~6 eligible keystrokes", explain: "The typical query length against how many of its keystrokes actually clear the 3-character floor and trigger a request." },
          { value: "~5 suggest calls per search after debounce", explain: "The debounce window collapses the eligible keystrokes further, so one search produces fewer requests than characters typed." },
          { value: "~100ms keypress to paint, ~10ms of it client render", explain: "The end-to-end latency budget users experience, almost all of it spent on the network round trip rather than on-device work." },
        ],
        breaks: {
          failure: "Personalisation is only as good as what this device has seen.",
          handled: "A user's first session on a new phone gets none at all, an accepted gap since syncing history across devices would cost the very cacheability the design depends on.",
        },
        choice: {
          pick: "Debounce 150ms, suppress prefixes under 3 characters, merge personal history on the client",
          instead: "Fire on every keystroke and merge the user's history at the origin.",
          decider:
            "Origin fleet size, which is a direct function of edge hit rate. Debouncing takes ~6 eligible keystrokes down to ~5 calls per search, and a response that is a pure function of (prefix, locale) caches at ~95%. So 2M peak QPS becomes ~100K at the origin. A per-user response is uncacheable by construction: the origin absorbs the full 2M, a 20x fleet. Each request now needs a history lookup on a path whose whole point is that it touches no datastore.",
          flips: "A logged-in product at 5K QPS rather than 2M, where the CDN was never doing meaningful work and 'the thing you opened yesterday' beats anything global. Also when history must not persist on the device, or must be consistent across a user's devices immediately.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge cache",
      sub: "60s TTL, ~95% hit rate",
      kind: "gateway",
      col: 0,
      row: 1,
      detail: {
        what: "Hundreds of edge locations caching the suggest response keyed on (prefix, locale) with Cache-Control: public, max-age=60.",
        why: "Short prefixes are requested constantly and their answers are identical for everyone, so most requests never need to reach a machine that knows anything. This is what sizes the origin: it is the difference between 2M QPS and 100K, and it absorbs exactly the hot prefixes that would otherwise skew a partitioned fleet.",
        numbers: [
          { value: "~95% of 2M peak QPS resolves at the edge", explain: "2M × 5% (the miss rate) ≈ 100K, matching the origin QPS figure the load balancer below is sized against — the reason this tier exists." },
          { value: "~350B response, inside one MTU", explain: "The tiny payload size that keeps a cache hit cheap to store and to serve." },
          { value: "an edge hit uses ~10ms of the ~100ms budget", explain: "This ~10ms round trip plus the client's own ~10ms render use a fifth of the budget — on a cache hit, nearly the whole cost." },
        ],
        breaks: {
          failure: "A cache stampede on popular prefixes right after a snapshot roll.",
          handled: "There is also the 60 second window after a rollback where the edge keeps serving bad answers the origin has already stopped producing. Purge-by-tag has to be tested before an incident, not during one.",
        },
        choice: {
          pick: "Edge cache on a 60 second TTL, cache key (prefix, locale), Vary: none",
          instead: "A longer TTL for a higher hit rate, or no edge tier with the origin sized for the full load.",
          decider:
            "Trend freshness against hit rate. 60 seconds is chosen to match the streaming overlay. A longer TTL would cache away the very freshness the overlay exists to provide, and a shorter one erodes the 95% that holds the origin at ~100K QPS. Without the tier at all the fleet is 20x larger for the same answers.",
          flips: "The instant responses differ per user. A personalised response is uncacheable, at which point the edge does nothing and every request is an origin request.",
        },
      },
    },
    {
      id: "lb",
      label: "Origin load balancer",
      sub: "any node, readiness on canaries",
      kind: "gateway",
      col: 0,
      row: 2,
      detail: {
        what: "Spreads the ~5% of traffic that misses the edge across the fleet, and decides which nodes are allowed to be in the pool at all.",
        why: "There is no prefix-to-node mapping to maintain, which is the whole prize of a 12GB structure. Any node can answer any prefix, so balancing is trivial and there is no shard to become a bottleneck. What is left is admission: a node that has just booted, or has just pulled a snapshot, must not take traffic until its canary prefixes pass.",
        numbers: [
          { value: "~100K origin QPS at peak spread over ~200 nodes", explain: "The traffic this tier balances, evenly enough that no single node carries a disproportionate share." },
          { value: "~25% CPU utilisation, so the fleet absorbs a lost node", explain: "The headroom built into fleet sizing, enough that losing one node redistributes its load without anyone noticing." },
          { value: "a replacement warms by pulling 12GB, minutes not hours", explain: "The time a fresh or restarted node takes to become ready, bounded by how fast it can pull and verify a full snapshot." },
        ],
        breaks: {
          failure: "It routes around a dead node happily and keeps feeding a node that is up but wrong.",
          handled: "The signal that matters is empty-result rate per node, not process liveness, since a wrong node still answers successfully by every liveness measure.",
        },
        choice: {
          pick: "Readiness gated on the canary prefix set passing, not on the process being up",
          instead: "Ordinary liveness and HTTP-200 health checks.",
          decider:
            "The failure being defended against is a node serving an empty index, which returns 200 in ~50μs and therefore looks like the fastest, healthiest node in the fleet. The same ~1000 canary prefixes that gate the pointer flip gate readiness, so such a node removes itself instead of attracting traffic.",
          flips: "A stateless service with no loaded artifact, where process-up and answering-correctly really are the same claim and a health endpoint is not lying to you.",
        },
      },
    },
    {
      id: "serving-node",
      label: "Serving node",
      kind: "serviceGroup",
      col: 1,
      row: 2,
      detail: {
        what: "One deployable unit, ~200 of them worldwide: the request path, the two in-memory structures it reads, and the loader that swaps them. Nothing inside this frame is a network hop.",
        why: "The 50ms budget is spent almost entirely on the network, so every ingredient of a response has to already be in this process's address space. Drawing the FST and the overlay inside the box rather than beside it is the claim that matters: they are not tiers, they are memory. That is why the fleet is sized by RAM and geography rather than by CPU.",
        numbers: [
          { value: "~50μs of CPU per origin request end to end", explain: "The actual compute cost of one origin request, tiny against the network time surrounding it." },
          { value: "~100K origin QPS peak, ~20 cores of real work", explain: "The aggregate CPU demand at peak, small enough that the fleet is never CPU-bound." },
          { value: "~200 nodes, each holding the full 12GB snapshot", explain: "The full serving fleet size, sized for RAM and geographic coverage rather than for request throughput." },
          { value: "size the box for 24GB: both snapshots are resident during a swap", explain: "The memory headroom needed during a snapshot rollover, when the old and new artifacts briefly coexist." },
        ],
        breaks: {
          failure: "Anything that puts a lookup back on this path.",
          handled: "A per-user history fetch or a shared index service reintroduces a network hop into a budget that assumes none, which is why personalisation stays entirely client-side.",
        },
        choice: {
          pick: "Stateless nodes each holding the entire snapshot, sized for RAM and geography",
          instead: "Partition the structure by first character and route each request to the owning shard.",
          decider:
            "Hot-prefix skew. Partitioning by first character makes the 't' partition the bottleneck for the whole system while most of the fleet idles, since 'th' alone is ~60K requests per second at peak. At 12GB compiled, every node fits the whole structure, so there is no prefix-to-shard mapping left to skew and no fan-out to amplify a tail.",
          flips: "When the structure genuinely outgrows a box. 10x the traffic is only 2 to 3x the distinct strings above the floor, so ~30GB. At that point you shard on a hash of the first three characters so 'th' and 'tw' land apart, and you take the skew back.",
        },
      },
    },
    {
      id: "suggest",
      label: "Suggest handler",
      sub: "walk · read · merge · serialise",
      kind: "process",
      col: 1,
      row: 2,
      parent: "serving-node",
      detail: {
        what: "The whole request path in one function: walk the prefix through the FST, read the finished top-10, look the same prefix up in the overlay. It merges the two lists and serialises ~350B of JSON.",
        why: "It is one stage rather than four boxes because there is nothing between the steps: no queue, no I/O, no failure that stops at one of them alone. The four steps are effectively one function. Splitting them into peers would imply a network hop inside a 50μs path.",
        numbers: [
          { value: "~50μs of CPU per request end to end", explain: "The total compute this stage costs, dominated by the overlay merge rather than the base lookup." },
          { value: "~1μs base lookup, ~5μs overlay merge", explain: "The split between the two lookups this stage performs, showing the overlay costs far more than the precomputed base read." },
          { value: "~350B response, 10 suggestions, inside one MTU", explain: "The final payload size, small enough to fit in a single network packet." },
        ],
        breaks: {
          failure: "Past depth 12 there is no stored top-K, so it scans a small subtree at ~20μs instead.",
          handled: "That is fine only while those subtrees stay small, a property of the corpus rather than of this code. Subtree size past depth 12 is watched as its own signal.",
        },
      },
    },
    {
      id: "policy-filter",
      label: "Serve-time policy filter",
      sub: "second line, ~0.2ms",
      kind: "process",
      col: 1,
      row: 3,
      parent: "serving-node",
      detail: {
        what: "A last pass over the merged list against the suppression set, applied after the overlay merge and before serialisation.",
        why: "Filtering belongs at build time because it costs nothing there, but two things outrun the build. The overlay can serve a term that was unseen 60 seconds ago and that no build-time pass has ever looked at. Jurisdictional takedowns arrive with a clock measured in hours against a cadence measured in one, and this is the only place either can take effect before the next snapshot.",
        numbers: [
          { value: "~0.2ms, against a ~50ms server budget", explain: "0.2ms is 0.4% of the 50ms budget — cheap enough to run on every one of 100K requests/s, though almost none hit a live takedown." },
          { value: "takedown clock measured in hours vs a 1-hour build cadence", explain: "A legal takedown can require action faster than the next scheduled build, why this filter exists as a separate, faster-acting mechanism." },
          { value: "a suppression is still served from the edge for up to 60s", explain: "Even after this filter blocks a term at origin, a cached edge response can keep serving it until its TTL expires." },
        ],
        breaks: {
          failure: "It is the last line, so its own failure is silent: a rule that fails open lets through exactly the thing it was written for.",
          handled: "Nothing about latency or error rate moves when this happens, so the detector is a blocklist-match canary run continuously, not a metric watched passively.",
        },
        choice: {
          pick: "A second-line filter at serve time on top of the build-time blocklist",
          instead: "Trust the build-time filter and keep the request path free of policy logic.",
          decider:
            "The 60 second overlay. A term can go from unseen to served in one minute, faster than any build and far faster than any human review, so build-time filtering structurally cannot cover it. The price is ~0.2ms of a 50ms budget, 0.4% of the thing you are protecting.",
          flips: "No real-time path at all. If the served structure only ever changes at build time, the serve-time pass is duplicated work. It repeats on every one of 100K requests per second for a set that cannot have changed.",
        },
      },
    },
    {
      id: "fst-index",
      label: "FST snapshot in RAM",
      sub: "12GB, mmapped from local NVMe",
      kind: "cache",
      col: 2,
      row: 2,
      detail: {
        what: "The served artifact: a minimised automaton mapping each prefix to a byte offset, with that prefix's precomputed top-10 stored inline at the offset.",
        why: "Precomputing the top-K at every node is what makes serving cost independent of how many completions a prefix covers. A three-character prefix sits above the order of 100,000 completions; reading the finished list is ~1μs, while gathering and heap-selecting them would be 1 to 3ms. It is a cache rather than a system of record: the copy in object storage is authoritative, and a node that loses this rebuilds it by pulling the file again.",
        numbers: [
          { value: "~100M queries, ~1B trie nodes", explain: "The scale of the surviving corpus after filtering, and the resulting size of the uncompiled trie before minimisation." },
          { value: "12GB compiled, top-10 stored to depth 12", explain: "The final served artifact size, with precomputed answers only kept down to a bounded depth to control payload size." },
          { value: "~1μs base lookup, O(prefix length)", explain: "1μs against the 1-3ms of gathering and heap-selecting live is roughly a 1000-3000x speedup — the whole payoff of precomputing at build time." },
          { value: "size the box for 24GB: both snapshots are resident during a swap", explain: "The memory headroom a serving box needs during a rollover, when old and new snapshots briefly coexist." },
        ],
        breaks: {
          failure: "Immutability.",
          handled: "Nothing can be edited in place, so every correction, including a policy suppression, waits for the next build or gets handled by the filter in front of it.",
        },
        choice: {
          pick: "Serve a compiled FST, which shares suffixes as well as prefixes",
          instead: "Serve the pointer-and-hashmap trie the build already has in memory.",
          decider:
            "Bytes per node against the size of a serving box. 1B nodes at ~60B each is ~60GB, plus ~16GB of top-K payload, so ~76GB, which does not fit 64GB and therefore forces sharding. The FST amortises to ~10B per node and lands at 8 to 16GB. The prize is not lookup speed, both are O(prefix length); it is that every node holds everything and routing disappears.",
          flips: "When the structure fits uncompressed. Under ~10M entries a hashmap trie is roughly 5GB and fits anywhere, and you have skipped a compile that takes tens of minutes. It also wins whenever entries must be mutated in place, because minimisation is global and one insert can invalidate a large shared-suffix region.",
        },
      },
    },
    {
      id: "loader",
      label: "Snapshot loader",
      sub: "checksum + canaries + flip",
      kind: "process",
      col: 1,
      row: 4,
      parent: "serving-node",
      detail: {
        what: "The activation path on each node: pull the new snapshot to a temp path on local NVMe, verify the checksum, run ~1000 canary prefixes against expected results. It then mmaps the file and flips one atomic pointer.",
        why: "It is a stage of the serving node rather than a service of its own because nothing about it is central. Every node does this to itself, within its wave, and a node that fails a canary simply does not activate and does not become ready. The failure being defended against is a bad build rather than a bad download, and a bad build passes its checksum perfectly.",
        numbers: [
          { value: "~1000 canary prefixes before the flip", explain: "The same 1000-prefix set gates two things: the pointer flip here, and node readiness on the load balancer above — one check, two safety nets." },
          { value: "10% waves with a two-minute soak between them", explain: "The staged rollout pace, bounding how much of the fleet a bad build can reach before the process halts it." },
          { value: "previous two snapshots kept on disk, rollback in seconds", explain: "Retaining recent snapshots on local disk means a rollback is a pointer flip rather than a fresh download." },
        ],
        breaks: {
          failure: "Both snapshots are resident during the overlap, so a box sized for 12GB rather than 24GB runs out of memory precisely during the roll.",
          handled: "After a rollback the edge keeps serving the bad answers for up to the 60 second TTL, so purge-by-tag has to have been tested before the incident.",
        },
        choice: {
          pick: "Canary-verified atomic pointer flip, rolled in 10% waves",
          instead: "Checksum, swap, and restart the process on every node at once.",
          decider:
            "A checksum only proves the bytes arrived. It says nothing about a semantically empty snapshot, which is why the gate is ~1000 known prefixes diffed against expected results. The rollout is staged so a bad build reaches at most 10% of ~200 nodes before the soak halts it. Rollback is then a pointer flip against a file already on disk, seconds and no network.",
          flips: "A single-node deployment, or one where a few seconds of downtime per roll is acceptable. Then restart-with-the-new-file is simpler than refcounted mappings and a wave schedule.",
        },
      },
    },
    {
      id: "overlay",
      label: "Trend overlay trie",
      sub: "rebuilt every 60s, 50-100MB",
      kind: "cache",
      col: 2,
      row: 3,
      detail: {
        what: "A small mutable trie of the same node shape, rebuilt every 60 seconds from the recent query stream and merged with the base result at request time.",
        why: "The base snapshot is up to an hour old, and popularity moves faster than that. If a term starts trending at 2:47pm it will not appear until the 3pm snapshot. Freshness shorter than the build cadence has to sit beside the snapshot rather than inside it. It is treated as a cache because dropping it is a supported operating mode: the node then serves from the base alone.",
        numbers: [
          { value: "50 to 100MB per serving node", explain: "The size of this structure, small enough to rebuild and redistribute every 60 seconds without meaningful cost." },
          { value: "adds ~5μs to a lookup", explain: "The latency cost of checking and merging this overlay into every request, negligible against the 50ms budget." },
          { value: "60 second rebuild cadence", explain: "How often this structure is refreshed, the freshness window that closes the gap the hourly base snapshot leaves open." },
        ],
        breaks: {
          failure: "It is the only mutable thing on the serving path and therefore the least tested.",
          handled: "A term can go from unseen to served in 60 seconds, faster than any human review process can match, so this is the path most likely to leak something through.",
        },
        choice: {
          pick: "A separate small trie merged at serve time, with a stricter automated filter than the base index",
          instead: "Mutating the served structure in place as counts arrive.",
          decider:
            "The base structure is a minimised FST and cannot be edited: one insert can invalidate a large shared-suffix region, so a real-time write path into it does not exist. A 50 to 100MB side structure costs ~5μs at merge time and can be dropped entirely when it misbehaves. That is what makes it safe to run at a 60 second cadence.",
          flips: "When hourly freshness is genuinely enough, for example an internal directory or a catalogue that changes daily. Then the overlay is pure operational risk for no user-visible gain.",
        },
      },
    },
    {
      id: "query-logs",
      label: "Query log stream",
      sub: "Kafka, ~10B searches/day",
      kind: "queue",
      col: 0,
      row: 4,
      detail: {
        what: "The durable log of submitted searches, read twice: by the hourly batch job over a 24 hour window, and by the streaming aggregator over 60 second windows.",
        why: "Ranking is popularity, and popularity is only visible in what people actually submitted, so this log is the sole input to the entire index. Both the slow path and the fast path read the same stream, which is why the two rankings never disagree about what a query is.",
        numbers: [
          { value: "~10B searches/day, ~417M arriving per hour", explain: "The total daily volume this log absorbs and the steady-state rate both the batch job and the streaming aggregator keep pace with." },
          { value: "~200M distinct strings appear in a day", explain: "The raw cardinality before the frequency floor narrows it down to what the build actually indexes." },
          { value: "daily aggregates compress to ~10GB/day Parquet, ~3.6TB/yr", explain: "The storage cost of retaining aggregated history for analysis, far smaller than the raw event volume itself." },
        ],
        breaks: {
          failure: "It is a feedback loop.",
          handled: "Suggesting a query causes people to run it, which raises its count, which causes it to be suggested more. Nothing in the log distinguishes 'popular because wanted' from 'popular because we put it there'.",
        },
        choice: {
          pick: "One durable Kafka log read independently by both the hourly batch job and the streaming aggregator",
          instead: "Separate topics per consumer, one tuned for batch reads and one for streaming.",
          decider:
            "Whether the two rankings can ever disagree about what a query is. One shared log at ~10B searches/day means both paths count the exact same events, just over different windows (24h vs 60s). Splitting the log risks the two paths drifting on delivery guarantees or missing events differently.",
          flips: "If the two consumers needed very different retention or partitioning, for example the streaming path needing sub-second latency the batch topic's larger segment sizes cannot give. At that point a dedicated low-latency topic mirrored from the durable log would be worth the duplication.",
        },
      },
    },
    {
      id: "build-job",
      label: "Hourly build job",
      kind: "serviceGroup",
      col: 0,
      row: 5,
      detail: {
        what: "One offline job in four stages: aggregate a rolling day of logs, drop what policy forbids, roll up top-10 over a trie, compile the result to an immutable artifact.",
        why: "They are stages rather than services because a run passes through all four or produces nothing. They share one schedule and one host sized for the ~76GB intermediate structure, they fail together, and none of them can be scaled without the others. The frame is also where the design's central line is drawn: everything inside it tolerates minutes, everything on the serve path has 50ms.",
        numbers: [
          { value: "1-hour cadence, ~30 min of work", explain: "The schedule this job runs on against how long a full run actually takes, leaving comfortable margin before the next one starts." },
          { value: "~417M queries arrive per hour", explain: "The steady-state input rate this job's aggregation stage has to process within its schedule." },
          { value: "build host sized for the ~76GB intermediate trie", explain: "The memory this job's host needs to hold the uncompiled structure before minimisation shrinks it." },
        ],
        breaks: {
          failure: "A viral event multiplies log volume and the job slips its hour.",
          handled: "The fleet keeps serving an ageing snapshot while every latency metric stays green. Snapshot age has to be its own alarm, since nothing else moves to flag it.",
        },
        choice: {
          pick: "One hourly batch rebuild of the whole structure",
          instead: "Maintain the served index incrementally as counts arrive.",
          decider:
            "The served artifact is a minimised FST and minimisation is global, so a single insert can invalidate a large shared-suffix region: there is no incremental path into it. What the cadence costs is bounded by how fast ranking actually moves, and the head of the query distribution barely changes between weekdays. An hour plus a 60 second overlay for what does move loses very little.",
          flips: "A corpus small enough to serve from a mutable trie, under ~10M entries, where you insert in place. This entire frame disappears along with the publish and swap machinery below it.",
        },
      },
    },
    {
      id: "aggregate",
      label: "Frequency aggregation",
      sub: "Spark, 24h window, floor 5/day",
      kind: "process",
      col: 0,
      row: 5,
      parent: "build-job",
      detail: {
        what: "Reads a rolling 24 hours of logs, counts each distinct query string with recency decay, and drops everything under the frequency floor.",
        why: "A rolling day rather than the last hour is what makes counts stable enough to rank on, and the exponential decay is what stops yesterday outvoting today. The floor is not an optimisation but a safety property: below it a count is indistinguishable from one motivated bot.",
        numbers: [
          { value: "24 hour window, ~6 hour half-life decay", explain: "The window this stage ranks over and how quickly older activity fades, keeping today's signal dominant without discarding yesterday entirely." },
          { value: "floor of 5 occurrences/day cuts ~200M distinct strings to ~100M", explain: "The frequency threshold that removes noise and bot traffic, roughly halving the corpus the build actually has to process." },
          { value: "~417M queries arrive per hour", explain: "The steady-state hourly volume this stage aggregates over its full 24-hour rolling window." },
        ],
        breaks: {
          failure: "The floor deletes a large band of legitimate rare queries.",
          handled: "For a real fraction of prefixes the system has nothing to say and returns an empty list, which reads as broken to a user typing something reasonable. This is accepted against importing bot noise.",
        },
        choice: {
          pick: "Rolling 24 hour window with ~6 hour half-life decay and a floor of 5 occurrences/day",
          instead: "Count only the last hour, or keep every distinct string with no floor.",
          decider:
            "Rank stability against manipulability. An hour of counts is too thin to rank on, while no floor imports bot noise directly into the suggestion list. A floor of 5 halves ~200M distinct strings to the ~100M the build actually consumes. On log explosion you sample the tail at 1% rather than lowering it, because the head distribution is what every top-K is made of.",
          flips: "A corpus with no adversary and no long tail, such as an internal catalogue, where every entry deserves to be suggestable and there is nobody manufacturing counts.",
        },
      },
    },
    {
      id: "safety",
      label: "Build-time policy filter",
      sub: "blocklist + classifier",
      kind: "process",
      col: 0,
      row: 6,
      parent: "build-job",
      detail: {
        what: "A blocklist and a classifier pass over the surviving query strings, run before any of them can reach a node's top-10.",
        why: "This is the cheap place to enforce suppression: it costs nothing at request time and it applies to every prefix that would ever have surfaced the string. It runs before the roll-up rather than after it because of how the roll-up works, not because of where it happens to be convenient.",
        numbers: [
          { value: "runs over ~100M strings, once an hour", explain: "The scale and cadence of this pass, cheap to run here because it happens once per build rather than per request." },
          { value: "zero cost on a path that serves ~100K QPS", explain: "Because filtering happens entirely at build time, the request path pays nothing for this safety check." },
          { value: "jurisdictional suppression: 1 overlay per region", explain: "Region-specific takedown rules are applied as a separate overlay per jurisdiction rather than baked into one global blocklist." },
        ],
        breaks: {
          failure: "It is string matching against people who are deliberately working around string matching, and offensive or defamatory combinations are composed continuously.",
          handled: "A blocklist is a snapshot of yesterday's adversary, which is exactly why the serve-time filter exists as a second, faster-reacting line behind it.",
        },
        choice: {
          pick: "Filter the surviving strings before the top-K roll-up",
          instead: "Let the build finish and strip blocked strings out of the finished top-10 lists.",
          decider:
            "The roll-up's own invariant. A parent's top-10 is selected from the union of its children's top-10 lists. A blocked string that survives into a child's list has already displaced a legitimate completion from every ancestor's list. Removing it afterwards leaves you a nine-item list, not a corrected one, and the tenth entry no longer exists to promote.",
          flips: "A suppression set that is genuinely per-request, such as one that varies by user age or account setting. Then it cannot be applied at build time at all and has to run over the finished list at serve time.",
        },
      },
    },
    {
      id: "topk",
      label: "Trie + top-K roll-up",
      sub: "post-order, top-10 to depth 12",
      kind: "process",
      col: 0,
      row: 7,
      parent: "build-job",
      detail: {
        what: "Builds the trie in one streaming pass over lexicographically sorted strings, then walks it post-order attaching each node's finished top-10.",
        why: "A parent's top-10 is selected from the union of its children's top-10 lists plus its own terminal entry. This is correct because any completion in the parent's true top-K also beats everything below it inside its own child subtree. That turns the build into one pass rather than a subtree scan per node.",
        numbers: [
          { value: "top-K stored only to depth 12", explain: "The depth limit that bounds the precomputed payload size, trading a rare deeper scan for a much smaller served artifact." },
          { value: "past depth 12 a scan at request time costs ~20μs", explain: "The fallback cost for the rare prefixes beyond the precomputed depth, still cheap enough to stay well inside budget." },
          { value: "O(nodes x branching x K), ~1B nodes", explain: "The overall cost shape of this build step, dominated by the corpus size rather than by K itself." },
        ],
        breaks: {
          failure: "The roll-up is only valid while a score is a property of the completion alone.",
          handled: "Length normalisation and prefix-position boosts make the score depend on the (prefix, completion) pair, and then the union of children's lists is no longer sufficient on its own.",
        },
        choice: {
          pick: "Precompute top-10 at every node down to depth 12",
          instead: "Store only the raw completions and rank at request time.",
          decider:
            "CPU per request against request rate inside a 50ms budget. A three-character prefix covers on the order of 100,000 completions; gathering and heap-selecting ten is 1 to 3ms, against ~1μs for a precomputed read. At 100K origin QPS that is 100 to 300 cores of pure ranking versus about 0.1 of one. The depth cap is what holds the top-K payload at ~16GB rather than growing with the longest string.",
          flips: "When the completion set is small or the ranking depends on request-time inputs. Under a few thousand completions a scan finishes in under 100μs. Once the answer varies by region, stock and live promotion the build-time cross product explodes: 10 regions x in-stock x 20 promotions is 400 variants of every list.",
        },
      },
    },
    {
      id: "compile",
      label: "FST compile",
      sub: "minimise, 5-10x smaller",
      kind: "process",
      col: 0,
      row: 8,
      parent: "build-job",
      detail: {
        what: "Minimises the finished trie into an immutable automaton that shares common suffixes as well as prefixes, then checksums the artifact.",
        why: "Suffix sharing is the trick: 'running', 'jumping' and 'walking' all end in the same path, so that tail is stored once. This step turns a structure too big for a serving box into one that fits on every serving box. That is the decision the whole serving layout rests on.",
        numbers: [
          { value: "~76GB uncompressed to 8-16GB, call it 12GB", explain: "The size reduction minimisation buys, the single decision that makes universal per-node serving possible." },
          { value: "~60B per hashmap node amortises to ~10B", explain: "The per-node memory saving from suffix sharing, the mechanism behind the overall size reduction." },
          { value: "compile takes ~30 min, entirely offline", explain: "The time this step costs, run entirely within the build job's schedule with no effect on serving latency." },
        ],
        breaks: {
          failure: "Minimisation is global, so the output is read-only and the step is all-or-nothing.",
          handled: "There is no partial artifact to publish and no way to patch the one you have, which is why every correction has to wait for the next full build.",
        },
        choice: {
          pick: "Build with a plain trie and compile to an FST as a separate stage, using a mature builder such as Lucene's",
          instead: "Construct the FST directly as strings arrive, skipping the intermediate trie.",
          decider:
            "Debuggability against build-host memory. FST construction is a real algorithm while trie insertion is trivial. Keeping the trie stage means there is always a structure you can query directly to answer 'is the compiler wrong or is the data wrong' at 3am. The cost is a build host sized for the ~76GB intermediate, a real and easily forgotten capacity requirement.",
          flips: "A corpus too large for the intermediate to be resident at all. Then you stream into the compiler and give up the reference structure, and you find out about compiler bugs from serving.",
        },
      },
    },
    {
      id: "object-store",
      label: "Snapshot store",
      sub: "S3, 12GB immutable artifact",
      kind: "blob",
      col: 1,
      row: 5,
      detail: {
        what: "Object storage holding the published FST snapshots, from which every serving node pulls independently.",
        why: "Distribution, not replication. The served artifact is read-only, so every region holds an identical copy per locale and there is no replication protocol to run, only a fan-out job. It is also the entire disaster recovery story: recovery is 'pull the current snapshot and pass the canaries'.",
        numbers: [
          { value: "12GB per snapshot, 200 nodes pull 2.4TB/hour at ~670MB/s", explain: "The aggregate distribution bandwidth this store has to sustain every time a new snapshot is published." },
          { value: "36GB/hour with 3 replicas, ~870GB for 24 hours of rollback history", explain: "The storage cost of retaining a rolling day of snapshots, small enough to keep comfortably for fast rollback." },
          { value: "RPO bounded by the last published snapshot, at most one hour of ranking freshness", explain: "The worst-case data-loss window if this store were lost, bounded by how often a fresh snapshot is published." },
        ],
        breaks: {
          failure: "Nothing user-generated lives here, so the risk is not losing data.",
          handled: "The risk is publishing something wrong and having 200 nodes fetch it in parallel within minutes, which is why each node independently verifies canaries before serving it.",
        },
        choice: {
          pick: "Nodes pull from object storage, keeping the last 24 hours of snapshots",
          instead: "The build host pushes the snapshot directly to each serving node.",
          decider:
            "Egress. 200 nodes times 12GB is 2.4TB per hour, about 670MB/s sustained, and a single build host would be the bottleneck for the entire rollout. Retaining 24 hours costs ~870GB, which is noise next to the traffic it protects.",
          flips: "A handful of serving nodes on the same network as the builder, where a direct push saves an entire storage dependency and the egress never binds.",
        },
      },
    },
    {
      id: "stream-agg",
      label: "Streaming aggregator",
      sub: "Flink, 60 second windows",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "A streaming job that counts the recent query stream in 60 second windows and publishes the small overlay trie the serving nodes merge.",
        why: "It is deployed apart from the hourly build rather than folded into it because the two fail on different schedules and one of them is optional. This job can be switched off, and the product degrades to hourly freshness instead of going down. It also emits 50 to 100MB where the build emits 12GB, so nothing about their capacity or cadence is shared.",
        numbers: [
          { value: "60 second windows", explain: "The aggregation window this job runs on, fast enough to catch trends within a minute of them starting." },
          { value: "produces 50 to 100MB per publish", explain: "12GB ÷ 100MB ≈ 120x smaller than the base snapshot — cheap enough that switching this job off entirely costs freshness, never capacity." },
          { value: "closes an up-to-one-hour freshness gap", explain: "The maximum staleness the hourly base snapshot alone would otherwise leave between builds." },
        ],
        breaks: {
          failure: "It stalls or gets poisoned by a coordinated flood, and the symptom is suggestions with no history at all in the base snapshot.",
          handled: "The mitigation is to serve from the base alone until it recovers, so a failure here degrades freshness rather than correctness.",
        },
        choice: {
          pick: "A separate streaming job producing a merge-time overlay",
          instead: "Shortening the batch cadence to every few minutes.",
          decider:
            "The build is ~100M strings compiled into a 12GB artifact that then has to reach 200 nodes at ~670MB/s. That does not run every few minutes at any sane cost, whereas counting a 60 second window and publishing 50 to 100MB does. The two paths are different jobs because they are three orders of magnitude apart in output size.",
          flips: "A corpus small enough that a full rebuild takes seconds. Then rebuild whole and delete the overlay, along with the merge logic and the extra safety filter it drags in.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e-type",
      from: "client",
      to: "cdn",
      tier: "hot",
      step: 1,
      label: "GET /suggest?q=wea",
      detail: {
        what: "A debounced keystroke going out as a plain GET keyed only on prefix and locale.",
        why: "The request carries no user identity, which is the single property that makes it cacheable at the edge. Personal history never becomes a parameter, so the response stays a pure function of (prefix, locale) and one cached copy serves everybody.",
        numbers: [
          { value: "~5 calls per search", explain: "The typical number of requests one search session generates after debouncing collapses eligible keystrokes." },
          { value: "~2M QPS at peak, ~580K average", explain: "The traffic range this arrow carries, the top-level figure the edge cache and origin fleet are both sized against." },
        ],
        breaks: {
          failure: "Add any per-user parameter and the cache key fragments per user.",
          handled: "That turns a 95% hit rate into roughly zero and the origin load into 2M QPS, which is why user identity never becomes part of this request.",
        },
      },
    },
    {
      id: "e-hit",
      from: "cdn",
      to: "client",
      tier: "hot",
      step: 2,
      label: "10 suggestions, ~10ms",
      detail: {
        what: "The cached ~350B JSON payload returned from an edge node without touching the origin.",
        why: "This is where about 95% of all suggest traffic ends. Short prefixes are requested constantly and their answers are identical for everyone, so the common case never reaches a machine that knows anything about tries.",
        numbers: [
          { value: "~350B, 10 suggestions", explain: "The cached payload size and result count returned on every hit, small enough to serve instantly from any edge location." },
          { value: "~10ms of the ~100ms keypress-to-paint budget", explain: "This 10ms is the best case; a miss adds a whole extra hop to origin — why hit rate is the biggest lever on latency." },
        ],
        breaks: {
          failure: "Right after a rollback this path keeps returning the bad answers for up to the 60 second TTL.",
          handled: "The origin being healthy again says nothing about what the edge already holds, so purge-by-tag has to be a tested, ready mechanism rather than improvised during an incident.",
        },
      },
    },
    {
      id: "e-miss",
      from: "cdn",
      to: "lb",
      tier: "hot",
      step: 3,
      label: "miss, ~5% of traffic",
      detail: {
        what: "The miss path: longer and rarer prefixes that no edge node has a cached response for.",
        why: "The whole fleet is sized against this number rather than against total traffic. 2M peak QPS times 5% is ~100K origin QPS, which at ~50μs of CPU per request is about 20 cores of real work. That work spreads over ~200 nodes held there by memory and geography.",
        numbers: [
          { value: "~100K origin QPS at peak", explain: "100K ÷ 200 nodes ≈ 500 QPS/node — comfortably below the ~25% CPU headroom the fleet keeps in reserve for absorbing a lost node." },
          { value: "~50μs CPU per request", explain: "The compute cost of serving one origin request, tiny enough that CPU is never the fleet's binding constraint." },
        ],
        breaks: {
          failure: "A cache stampede after a snapshot roll sends many simultaneous fills for the same popular prefix.",
          handled: "This is why origin fills are single-flighted and top prefixes are pre-warmed, so a stampede never turns into duplicated work across the fleet.",
        },
      },
    },
    {
      id: "e-route",
      from: "lb",
      to: "suggest",
      tier: "hot",
      step: 4,
      label: "any node will do",
      detail: {
        what: "The miss handed to whichever node is in the ready pool, with no prefix-to-node mapping consulted.",
        why: "This arrow is deliberately boring, and that is the payoff of the 12GB compile. Because every node holds the whole snapshot, there is no routing decision to make and no shard to be hot. There is also no fan-out whose slowest leaf becomes the p99 of the service.",
        numbers: [
          { value: "~100K origin QPS over ~200 nodes", explain: "The load this arrow spreads across the fleet, evenly enough that no single node dominates." },
          { value: "~25% CPU utilisation, so a lost node is absorbed", explain: "The headroom this routing scheme relies on to absorb a node loss without any capacity planning specific to failure." },
        ],
        breaks: {
          failure: "It sends traffic to any node that says it is ready, so readiness has to mean the canary prefixes pass.",
          handled: "A node with an empty index answers faster than a healthy one and will attract traffic, not shed it, exactly why canary-based readiness exists instead of simple liveness.",
        },
      },
    },
    {
      id: "e-lookup",
      from: "suggest",
      to: "fst-index",
      tier: "hot",
      step: 5,
      label: "walk prefix, read top-10",
      detail: {
        what: "One character walked per typed character, ending at a node whose finished top-10 is read straight out of memory.",
        why: "This is the payoff for the entire build pipeline: serving cost does not depend on how many completions the prefix covers. The alternative, gathering and ranking the subtree, is 1 to 3ms for a three-character prefix and would be 100 to 300 cores at origin rate.",
        numbers: [
          { value: "~1μs, O(prefix length)", explain: "At 1μs this lookup is the cheap fifth of the ~6μs total; the overlay merge that follows costs 5x more in the same process." },
          { value: "in-process mmap, 0 network hops", explain: "The lookup happens entirely within the serving process's own memory, with no network round trip involved at all." },
        ],
        breaks: {
          failure: "Past depth 12 there is no stored top-K, so the node scans a small subtree instead, which costs ~20μs.",
          handled: "That is fine only because those subtrees are genuinely small, a property of the corpus this design relies on rather than something it enforces.",
        },
      },
    },
    {
      id: "e-merge",
      from: "suggest",
      to: "overlay",
      tier: "data",
      label: "merge trending entries",
      detail: {
        what: "The overlay lookup whose top few entries are merged with the base list before the policy filter and serialisation.",
        why: "It is the only way to serve something that started trending after the last snapshot was built. It is deliberately a merge rather than a write into the base structure, because the compiled FST cannot be edited in place at all.",
        numbers: [
          { value: "adds ~5μs", explain: "The latency cost of checking and merging the overlay into every request, negligible against the 50ms budget." },
          { value: "overlay contributes up to 5 entries", explain: "The maximum share of one response the trending overlay can supply, bounding how much any single fast-moving term can dominate a result." },
        ],
        breaks: {
          failure: "This is the sharpest safety edge in the system: an entry can go from unseen to served in 60 seconds, faster than any human review.",
          handled: "Overlay entries are rate-limited and filtered harder than the base index and still leak first, the accepted tradeoff for closing the freshness gap this fast.",
        },
      },
    },
    {
      id: "e-filter",
      from: "suggest",
      to: "policy-filter",
      tier: "data",
      label: "10 merged entries",
      detail: {
        what: "The merged list handed to the suppression pass before it is serialised.",
        why: "Second-line defence, in-process, on a list of ten strings. It is its own step because it is the only point where a suppression newer than the last build can take effect. That includes one that applies to this jurisdiction and not the global index.",
        numbers: [
          { value: "~0.2ms of a ~50ms budget", explain: "Fixed at 10 entries in, at most 10 out, this 0.2ms never scales with popularity — same cost on the rarest prefix as the hottest." },
          { value: "10 entries in, at most 10 out", explain: "This stage only ever removes entries, never adds them, so the output list can shrink but never grow." },
        ],
        breaks: {
          failure: "A filter that fails open is invisible: the response is the right size, the right shape and the right latency.",
          handled: "The only thing wrong with it is the content, which is why this filter's failure mode is watched with a dedicated blocklist-match canary rather than inferred from latency or errors.",
        },
      },
    },
    {
      id: "e-fill",
      from: "policy-filter",
      to: "cdn",
      tier: "hot",
      step: 6,
      label: "350B, max-age 60",
      detail: {
        what: "The filtered response travelling back through the load balancer to the edge, to be cached for 60 seconds under the (prefix, locale) key.",
        why: "The TTL is chosen to match the streaming overlay cadence. Caching longer would cache away exactly the freshness the overlay exists to provide, and caching shorter erodes the hit rate that holds the origin at ~100K QPS.",
        numbers: [
          { value: "Cache-Control: public, max-age=60", explain: "The exact caching directive this response carries, matched to the streaming overlay's own refresh cadence." },
          { value: "0 Vary dimensions: cacheable for everyone", explain: "The response varies on nothing but the request itself, which is what lets one cached copy serve every user identically." },
        ],
        breaks: {
          failure: "If a policy suppression ships while a bad answer is cached, that answer keeps being served for up to 60 seconds unless purge-by-tag works.",
          handled: "The first time you use purge is during an incident otherwise, which is why it has to be exercised and verified well before it is actually needed.",
        },
      },
    },
    {
      id: "e-logs-agg",
      from: "query-logs",
      to: "aggregate",
      tier: "control",
      label: "24h rolling window",
      detail: {
        what: "A full rolling day of submitted queries read once an hour, not just the hour that has just passed.",
        why: "An hour of counts is too thin to rank on, so the window is a day with recency decay applied inside it. Yesterday still contributes and today dominates, which is what keeps the head of the ranking stable between consecutive builds.",
        numbers: [
          { value: "~417M queries per hour", explain: "The steady-state hourly arrival rate this window's aggregation has to keep pace with." },
          { value: "~6 hour half-life decay", explain: "How quickly older activity within the 24-hour window fades in influence, keeping the ranking responsive to recent behaviour." },
        ],
        breaks: {
          failure: "On a viral event the volume outruns the job and the hourly build slips.",
          handled: "The fleet silently keeps serving an older snapshot with every latency metric looking healthy, which is why snapshot age itself has to be a monitored, alertable signal.",
        },
      },
    },
    {
      id: "e-agg-safety",
      from: "aggregate",
      to: "safety",
      tier: "control",
      label: "~100M queries kept",
      detail: {
        what: "The surviving distinct query strings with their decayed scores, handed to the suppression pass.",
        why: "Everything below the frequency floor is already gone, so this is the smallest set the policy pass could possibly run over. Running it here means the roll-up below never sees a string it is not allowed to rank.",
        numbers: [
          { value: "~100M strings after the floor of 5/day", explain: "The surviving corpus size once the frequency floor removes noise and low-signal queries." },
          { value: "~200M distinct strings arrived", explain: "The raw daily cardinality before filtering, roughly double what actually survives to be indexed." },
        ],
        breaks: {
          failure: "Roughly 15% of searches are ones nobody has run before, and the floor removes a much wider band than that.",
          handled: "Whatever does not survive here is a prefix the system will have nothing to say about, an accepted cost of keeping the corpus small enough to rank reliably.",
        },
      },
    },
    {
      id: "e-safety-topk",
      from: "safety",
      to: "topk",
      tier: "control",
      label: "blocked strings dropped",
      detail: {
        what: "The permitted strings, sorted lexicographically, streamed into the trie builder.",
        why: "Sorted input is what lets the trie be built in one streaming pass holding only a single root-to-leaf path in memory. The builder never needs the whole structure resident while constructing it. Filtering before this point is what keeps everything reaching the roll-up honest.",
        numbers: [
          { value: "~1B trie nodes at ~20 chars each", explain: "The scale of the structure this stream builds, sized directly by the surviving corpus after filtering." },
          { value: "one streaming pass, one root-to-leaf path resident", explain: "The memory efficiency sorted input buys: the builder never needs more than a single path in memory at once." },
        ],
        breaks: {
          failure: "A blocklist that runs after this stage cannot repair anything.",
          handled: "The blocked string has already displaced a legitimate completion out of every ancestor's top-10, which is why filtering happens before the roll-up, never after it.",
        },
      },
    },
    {
      id: "e-topk-fst",
      from: "topk",
      to: "compile",
      tier: "control",
      label: "~76GB trie with top-K",
      detail: {
        what: "The finished in-memory trie, every node down to depth 12 carrying its top-10, handed to the minimiser.",
        why: "The compile step exists only because this artifact is too big to serve. ~60GB of nodes plus ~16GB of top-K payload does not fit a 64GB box, and not fitting is what would force sharding and the hot-prefix skew that comes with it.",
        numbers: [
          { value: "~60GB of nodes plus ~16GB top-K payload", explain: "The two components that sum to the uncompiled structure's total size, before minimisation shrinks it for serving." },
          { value: "~60B per hashmap node", explain: "The per-node memory cost of the uncompiled structure, the figure suffix-sharing compilation reduces during the next stage." },
        ],
        breaks: {
          failure: "This structure only exists inside the build job, so a build host sized for 76GB plus headroom is a real and easily forgotten capacity requirement.",
          handled: "Provisioning has to account for it explicitly, since nothing about the serving fleet's own sizing would ever surface this intermediate requirement.",
        },
      },
    },
    {
      id: "e-publish",
      from: "compile",
      to: "object-store",
      tier: "control",
      label: "12GB immutable snapshot",
      detail: {
        what: "The minimised, checksummed artifact written once to object storage as an immutable snapshot.",
        why: "Publishing once and letting the fleet pull is what keeps the build host out of the distribution path. Immutability is also what makes rollback trivial: an older snapshot is still a valid served structure, so recovery is a file choice rather than a repair.",
        numbers: [
          { value: "12GB per locale", explain: "76GB uncompiled compiles down to this 12GB, roughly 6x smaller — and it's written once but read ~200 times, once per serving node." },
          { value: "written once, read ~200 times", explain: "The fan-out ratio of this publish, one write feeding roughly the entire serving fleet." },
        ],
        breaks: {
          failure: "A well-formed but semantically wrong snapshot is indistinguishable from a good one at this point.",
          handled: "The checksum only proves the bytes are intact, which is why every node independently runs canary prefixes before it will actually serve the new snapshot.",
        },
      },
    },
    {
      id: "e-pull",
      from: "object-store",
      to: "loader",
      tier: "data",
      label: "each node pulls 12GB",
      detail: {
        what: "Every serving node downloading the new snapshot to a temp path on local NVMe, in parallel with all the others.",
        why: "Pulling from object storage rather than being pushed from the build host is a bandwidth decision. 200 nodes times 12GB is 2.4TB per hour, and one host's egress would be the bottleneck for the entire rollout.",
        numbers: [
          { value: "2.4TB/hour, ~670MB/s sustained", explain: "The aggregate bandwidth this pull generates across the fleet, the figure that rules out pushing from a single build host." },
          { value: "~200 nodes worldwide", explain: "The full serving fleet size, all pulling independently rather than waiting on a single distribution source." },
        ],
        breaks: {
          failure: "A partial or corrupt download on a subset of nodes, which is exactly what the checksum catches.",
          handled: "It is exactly the failure mode people over-index on relative to a bad build, which the checksum cannot catch at all and canaries exist specifically to.",
        },
      },
    },
    {
      id: "e-swap",
      from: "loader",
      to: "fst-index",
      tier: "data",
      label: "atomic pointer flip",
      detail: {
        what: "The activation itself: mmap the verified file and flip one pointer from the old FST to the new one, in 10% waves across the fleet.",
        why: "Requests already holding the old pointer finish against the old mapping, which is unmapped when its refcount hits zero, so no request ever sees a half-swapped structure. Waves exist so a build that passes its canaries on one node but is wrong in general cannot take the whole fleet.",
        numbers: [
          { value: "10% waves, two-minute soak", explain: "The pace this rollout is staged at, bounding how much of the fleet is exposed before a problem can be caught." },
          { value: "both snapshots resident during the overlap, so size for 24GB", explain: "The memory headroom needed while old and new mappings briefly coexist during the swap." },
        ],
        breaks: {
          failure: "Swapping the whole fleet at once.",
          handled: "A bad build then reaches 100% of serving nodes before anybody sees a metric move, exactly why the flip is staged in waves with a soak between them instead.",
        },
      },
    },
    {
      id: "e-logs-stream",
      from: "query-logs",
      to: "stream-agg",
      tier: "control",
      label: "live query stream",
      detail: {
        what: "The same log consumed continuously rather than in hourly batches, counted in 60 second windows.",
        why: "Sharing the input with the batch job is deliberate. Both paths rank the same thing by the same signal. The overlay never disagrees with the base snapshot about what a query is, only about how recently it got popular.",
        numbers: [
          { value: "60 second windows", explain: "The aggregation window this stream is counted over, fast enough to catch a trend within a minute of it starting." },
          { value: "reads the 1 same log as the hourly build", explain: "Both the fast and slow paths consume the identical durable log, so they can never disagree about what actually happened." },
        ],
        breaks: {
          failure: "A coordinated query flood reaches this path in a minute, long before the frequency floor on the batch side would have absorbed it.",
          handled: "This is why overlay entries carry a stricter automated filter than the base index, since this path sees adversarial traffic before the batch pipeline's own defences can act.",
        },
      },
    },
    {
      id: "e-overlay-publish",
      from: "stream-agg",
      to: "overlay",
      tier: "control",
      label: "rebuild every 60s",
      detail: {
        what: "The freshly counted trending entries published as a small trie for every serving node to hold alongside the base snapshot.",
        why: "It is published rather than merged into the index because the base artifact is immutable. It is small so a node can drop it and serve from the base alone the moment the overlay looks wrong.",
        numbers: [
          { value: "50 to 100MB per node", explain: "The size of each published overlay, small enough to redistribute across the fleet every 60 seconds without meaningful cost." },
          { value: "60 second cadence against an hourly base", explain: "The freshness gap this publish cadence closes, three orders of magnitude faster than the base snapshot's own refresh rate." },
        ],
        breaks: {
          failure: "Overlay age is its own alarm: the base index may be an hour old, but an overlay five minutes stale means the trending path has silently stopped.",
          handled: "That distinction is why overlay staleness is tracked separately from base snapshot age, since the two failures mean very different things operationally.",
        },
      },
    },
  ],
};
