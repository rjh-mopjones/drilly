import type { Diagram } from "./types";

export const SEARCH_AUTOCOMPLETE: Diagram = {
  id: "search-autocomplete",
  title: "Search Autocomplete",
  question: "Design a Search Autocomplete (Google Suggest)",
  sourceId: "patterns",
  itemId: 10,
  overview: {
    shape:
      "Two systems that share nothing but a file: an hourly batch pipeline that computes the answer to every prefix worth serving in advance, and a serving path that does no computing at all, only a walk of a few characters and a pointer read.",
    beats: [
      "Debounce and the edge come first because between them they decide how big the fleet is. The client suppresses prefixes under three characters and debounces 150ms, which collapses roughly six eligible keystrokes into about five suggest calls per search, and a 60 second edge TTL then absorbs about 95% of the resulting 2M peak QPS.",
      "What survives to the origin is a lookup rather than a search. Each serving node holds the entire 12GB FST in memory, walks one character per typed character, and reads the top-10 list already sitting at that node. That costs about a microsecond, so the network round trip, not the computation, spends the 50ms server budget.",
      "The precomputation is the whole design. An hourly job reads a rolling 24 hours of query logs, keeps the ~100M distinct strings that clear a floor of five occurrences a day, builds a trie over them and walks it post-order, so every parent's top-10 is selected from the union of its children's top-10 lists in a single pass.",
      "Compilation is what deletes the routing layer. A hashmap trie carrying those top-K payloads is about 76GB and does not fit a 64GB box, which would force sharding by first character and hand you the hot-prefix skew as a permanent tax. Minimising to an FST lands at about 12GB, so every node holds everything and there is nothing left to route.",
      "Freshness is bolted on beside the snapshot rather than expressed inside it. A streaming job rebuilds a 50 to 100MB overlay trie every 60 seconds from the live query stream and the serving node merges the two lists for about 5 microseconds, which is the only mutable thing anywhere on the request path.",
      "Publishing is the part that actually hurts. Nodes pull the 12GB snapshot from object storage rather than from the build host, because 200 nodes times 12GB is 2.4TB an hour, then verify a checksum, run about 1000 canary prefixes, and flip one atomic pointer in 10% waves with a two-minute soak between them.",
      "Safety is two filters at two speeds, and the diagram draws both. The build-time blocklist and classifier run before anything can reach a node's top-K, which is the cheap place to do it; the serve-time filter exists because the 60 second overlay can put a term in front of a user that no build-time pass has ever seen, and because a takedown clock measured in hours cannot wait for the next build.",
    ],
    crux:
      "Prefix traffic is far more skewed than the query distribution underneath it, because every long query passes through the same short prefixes on its way. The prefix 'th' alone is roughly 60K requests per second at peak while a partition owning 'z' sits idle. You do not balance that skew, you delete it: make the structure small enough that every node holds all of it, and let the edge absorb the short prefixes before they reach a server.",
    numbers: [
      "2M peak QPS, ~100K at the origin after a 95% edge hit rate",
      "12GB compiled FST vs ~76GB hashmap trie",
      "50ms server p99 inside a ~100ms keypress-to-paint budget",
    ],
  },
  nodes: [
    {
      id: "client",
      label: "Browser client",
      sub: "150ms debounce, local history merge",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The typing surface: it debounces keystrokes, suppresses prefixes shorter than three characters, and blends the user's own recent queries into the list before painting.",
        why: "This is the cheapest request reduction in the system, because a request removed here never exists. It is also where personalisation has to live: the moment the origin sees a user identity the response stops being cacheable and the 95% edge hit rate evaporates. It is a client rather than a third party because its behaviour is a load-bearing input to every capacity number below it, and it ships with the product.",
        numbers: [
          "~20 character average query, ~6 eligible keystrokes",
          "~5 suggest calls per search after debounce",
          "~100ms keypress to paint, ~10ms of it client render",
        ],
        breaks:
          "Personalisation is only as good as what this device has seen, so a user's first session on a new phone gets none at all.",
        choice: {
          pick: "Debounce 150ms, suppress prefixes under 3 characters, merge personal history on the client",
          instead: "Fire on every keystroke and merge the user's history at the origin.",
          decider:
            "Origin fleet size, which is a direct function of edge hit rate. Debouncing takes ~6 eligible keystrokes down to ~5 calls per search, and a response that is a pure function of (prefix, locale) caches at ~95%, so 2M peak QPS becomes ~100K at the origin. A per-user response is uncacheable by construction: the origin absorbs the full 2M, a 20x fleet, and each request now needs a history lookup on a path whose whole point is that it touches no datastore.",
          flips:
            "A logged-in product at 5K QPS rather than 2M, where the CDN was never doing meaningful work and 'the thing you opened yesterday' beats anything global. Also when history must not persist on the device, or must be consistent across a user's devices immediately.",
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
          "~95% of 2M peak QPS resolves at the edge",
          "~350B response, inside one MTU",
          "an edge hit uses ~10ms of the ~100ms budget",
        ],
        breaks:
          "A cache stampede on popular prefixes right after a snapshot roll, and the 60 second window after a rollback where the edge keeps serving the bad answers the origin has already stopped producing.",
        choice: {
          pick: "Edge cache on a 60 second TTL, cache key (prefix, locale), Vary: none",
          instead: "A longer TTL for a higher hit rate, or no edge tier with the origin sized for the full load.",
          decider:
            "Trend freshness against hit rate. 60 seconds is chosen to match the streaming overlay: a longer TTL would cache away the very freshness the overlay exists to provide, and a shorter one erodes the 95% that holds the origin at ~100K QPS. Without the tier at all the fleet is 20x larger for the same answers.",
          flips:
            "The instant responses differ per user. A personalised response is uncacheable, at which point the edge does nothing and every request is an origin request.",
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
        why: "There is no prefix-to-node mapping to maintain, which is the whole prize of a 12GB structure: any node can answer any prefix, so balancing is trivial and there is no shard to become a bottleneck. What is left is admission. A node that has just booted, or has just pulled a snapshot, must not take traffic until its canary prefixes pass.",
        numbers: [
          "~100K origin QPS at peak spread over ~200 nodes",
          "~25% CPU utilisation, so the fleet absorbs a lost node",
          "a replacement warms by pulling 12GB, minutes not hours",
        ],
        breaks:
          "It routes around a dead node happily and keeps feeding a node that is up but wrong. The signal that matters is empty-result rate per node, not process liveness.",
        choice: {
          pick: "Readiness gated on the canary prefix set passing, not on the process being up",
          instead: "Ordinary liveness and HTTP-200 health checks.",
          decider:
            "The failure being defended against is a node serving an empty index, which returns 200 in ~50μs and therefore looks like the fastest, healthiest node in the fleet. The same ~1000 canary prefixes that gate the pointer flip gate readiness, so such a node removes itself instead of attracting traffic.",
          flips:
            "A stateless service with no loaded artifact, where process-up and answering-correctly really are the same claim and a health endpoint is not lying to you.",
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
        why: "The 50ms budget is spent almost entirely on the network, so every ingredient of a response has to already be in this process's address space. Drawing the FST and the overlay inside the box rather than beside it is the claim that matters: they are not tiers, they are memory, which is why the fleet is sized by RAM and geography rather than by CPU.",
        numbers: [
          "~50μs of CPU per origin request end to end",
          "~100K origin QPS peak, ~20 cores of real work",
          "~200 nodes, each holding the full 12GB snapshot",
          "size the box for 24GB: both snapshots are resident during a swap",
        ],
        breaks:
          "Anything that puts a lookup back on this path. A per-user history fetch or a shared index service reintroduces a network hop into a budget that assumes none.",
        choice: {
          pick: "Stateless nodes each holding the entire snapshot, sized for RAM and geography",
          instead: "Partition the structure by first character and route each request to the owning shard.",
          decider:
            "Hot-prefix skew. Partitioning by first character makes the 't' partition the bottleneck for the whole system while most of the fleet idles, since 'th' alone is ~60K requests per second at peak. At 12GB compiled, every node fits the whole structure, so there is no prefix-to-shard mapping left to skew and no fan-out to amplify a tail.",
          flips:
            "When the structure genuinely outgrows a box. 10x the traffic is only 2 to 3x the distinct strings above the floor, so ~30GB, and at that point you shard on a hash of the first three characters so 'th' and 'tw' land apart, and you take the skew back.",
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
        what: "The whole request path in one function: walk the prefix through the FST, read the finished top-10, look the same prefix up in the overlay, merge the two lists, serialise ~350B of JSON.",
        why: "It is one stage rather than four boxes because there is nothing between the steps: no queue, no I/O, no failure that stops at one of them and not the others. The four lines of pseudocode in the answer are the deployable unit, and drawing them as peers would imply a network hop inside a 50μs path.",
        numbers: [
          "~50μs of CPU per request end to end",
          "~1μs base lookup, ~5μs overlay merge",
          "~350B response, 10 suggestions, inside one MTU",
        ],
        breaks:
          "Past depth 12 there is no stored top-K, so it scans a small subtree at ~20μs instead. That is fine only while those subtrees stay small, which is a property of the corpus rather than of this code.",
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
        why: "Filtering belongs at build time because it costs nothing there, but two things outrun the build. The overlay can serve a term that was unseen 60 seconds ago and that no build-time pass has ever looked at, and jurisdictional takedowns arrive with a clock measured in hours against a cadence measured in one. This is the only place either can take effect before the next snapshot.",
        numbers: [
          "~0.2ms, against a ~50ms server budget",
          "takedown clock in hours vs an hourly build cadence",
          "a suppression is still served from the edge for up to 60s",
        ],
        breaks:
          "It is the last line, so its own failure is silent: a rule that fails open lets through exactly the thing it was written for, and nothing about latency or error rate moves. The detector is a blocklist-match canary, not a metric.",
        choice: {
          pick: "A second-line filter at serve time on top of the build-time blocklist",
          instead: "Trust the build-time filter and keep the request path free of policy logic.",
          decider:
            "The 60 second overlay. A term can go from unseen to served in one minute, which is faster than any build and far faster than any human review, so build-time filtering structurally cannot cover it. The price is ~0.2ms of a 50ms budget, which is 0.4% of the thing you are protecting.",
          flips:
            "No real-time path at all. If the served structure only ever changes at build time, the serve-time pass is duplicated work on every one of 100K requests per second for a set that cannot have changed.",
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
      parent: "serving-node",
      detail: {
        what: "The served artifact: a minimised automaton mapping each prefix to a byte offset, with that prefix's precomputed top-10 stored inline at the offset.",
        why: "Precomputing the top-K at every node is what makes serving cost independent of how many completions a prefix covers. A three-character prefix sits above the order of 100,000 completions; reading the finished list is ~1μs, while gathering and heap-selecting them would be 1 to 3ms. It is a cache rather than a system of record: the copy in object storage is authoritative, and a node that loses this rebuilds it by pulling the file again.",
        numbers: [
          "~100M queries, ~1B trie nodes",
          "12GB compiled, top-10 stored to depth 12",
          "~1μs base lookup, O(prefix length)",
          "size the box for 24GB: both snapshots are resident during a swap",
        ],
        breaks:
          "Immutability. Nothing can be edited in place, so every correction, including a policy suppression, waits for the next build or gets handled by the filter in front of it.",
        choice: {
          pick: "Serve a compiled FST, which shares suffixes as well as prefixes",
          instead: "Serve the pointer-and-hashmap trie the build already has in memory.",
          decider:
            "Bytes per node against the size of a serving box. 1B nodes at ~60B each is ~60GB, plus ~16GB of top-K payload, so ~76GB, which does not fit 64GB and therefore forces sharding. The FST amortises to ~10B per node and lands at 8 to 16GB. The prize is not lookup speed, both are O(prefix length); it is that every node holds everything and routing disappears.",
          flips:
            "When the structure fits uncompressed. Under ~10M entries a hashmap trie is roughly 5GB and fits anywhere, and you have skipped a compile that takes tens of minutes. It also wins whenever entries must be mutated in place, because minimisation is global and one insert can invalidate a large shared-suffix region.",
        },
      },
    },
    {
      id: "loader",
      label: "Snapshot loader",
      sub: "checksum · canaries · pointer flip",
      kind: "process",
      col: 1,
      row: 4,
      parent: "serving-node",
      detail: {
        what: "The activation path on each node: pull the new snapshot to a temp path on local NVMe, verify the checksum, run ~1000 canary prefixes against expected results, then mmap the file and flip one atomic pointer.",
        why: "It is a stage of the serving node rather than a service of its own because nothing about it is central: every node does this to itself, within its wave, and a node that fails a canary simply does not activate and does not become ready. The failure being defended against is a bad build rather than a bad download, and a bad build passes its checksum perfectly.",
        numbers: [
          "~1000 canary prefixes before the flip",
          "10% waves with a two-minute soak between them",
          "previous two snapshots kept on disk, rollback in seconds",
        ],
        breaks:
          "Both snapshots are resident during the overlap, so a box sized for 12GB rather than 24GB runs out of memory precisely during the roll. And after a rollback the edge keeps serving the bad answers for up to the 60 second TTL, so purge-by-tag has to have been tested before the incident.",
        choice: {
          pick: "Canary-verified atomic pointer flip, rolled in 10% waves",
          instead: "Checksum, swap, and restart the process on every node at once.",
          decider:
            "A checksum only proves the bytes arrived. It says nothing about a semantically empty snapshot, which is why the gate is ~1000 known prefixes diffed against expected results, and why the rollout is staged so a bad build reaches at most 10% of ~200 nodes before the soak halts it. Rollback is then a pointer flip against a file already on disk, seconds and no network.",
          flips:
            "A single-node deployment, or one where a few seconds of downtime per roll is acceptable. Then restart-with-the-new-file is simpler than refcounted mappings and a wave schedule.",
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
      parent: "serving-node",
      detail: {
        what: "A small mutable trie of the same node shape, rebuilt every 60 seconds from the recent query stream and merged with the base result at request time.",
        why: "The base snapshot is up to an hour old, and popularity moves faster than that. If a term starts trending at 2:47pm it will not appear until the 3pm snapshot, so freshness shorter than the build cadence has to sit beside the snapshot rather than inside it. It is drawn as a cache because dropping it is a supported operating mode: the node then serves from the base alone.",
        numbers: ["50 to 100MB per serving node", "adds ~5μs to a lookup", "60 second rebuild cadence"],
        breaks:
          "It is the only mutable thing on the serving path and therefore the least tested. A term can go from unseen to served in 60 seconds, which no human review process can match, so this is the path that leaks something.",
        choice: {
          pick: "A separate small trie merged at serve time, with a stricter automated filter than the base index",
          instead: "Mutating the served structure in place as counts arrive.",
          decider:
            "The base structure is a minimised FST and cannot be edited: one insert can invalidate a large shared-suffix region, so a real-time write path into it does not exist. A 50 to 100MB side structure costs ~5μs at merge time and can be dropped entirely when it misbehaves, which is what makes it safe to run at a 60 second cadence.",
          flips:
            "When hourly freshness is genuinely enough, for example an internal directory or a catalogue that changes daily. Then the overlay is pure operational risk for no user-visible gain.",
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
          "~10B searches/day, ~417M arriving per hour",
          "~200M distinct strings appear in a day",
          "daily aggregates compress to ~10GB/day Parquet, ~3.6TB/yr",
        ],
        breaks:
          "It is a feedback loop. Suggesting a query causes people to run it, which raises its count, which causes it to be suggested more, and nothing in the log distinguishes 'popular because wanted' from 'popular because we put it there'.",
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
          "hourly cadence, tens of minutes of work",
          "~417M queries arrive per hour",
          "build host sized for the ~76GB intermediate trie",
        ],
        breaks:
          "A viral event multiplies log volume and the job slips its hour, so the fleet keeps serving an ageing snapshot while every latency metric stays green. Snapshot age has to be its own alarm because nothing else moves.",
        choice: {
          pick: "One hourly batch rebuild of the whole structure",
          instead: "Maintain the served index incrementally as counts arrive.",
          decider:
            "The served artifact is a minimised FST and minimisation is global, so a single insert can invalidate a large shared-suffix region: there is no incremental path into it. What the cadence costs is bounded by how fast ranking actually moves, and the head of the query distribution barely changes between weekdays, so an hour plus a 60 second overlay for what does move loses very little.",
          flips:
            "A corpus small enough to serve from a mutable trie, under ~10M entries, where you insert in place and this entire frame disappears along with the publish and swap machinery below it.",
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
          "24 hour window, ~6 hour half-life decay",
          "floor of 5 occurrences/day cuts ~200M distinct strings to ~100M",
          "~417M queries arrive per hour",
        ],
        breaks:
          "The floor deletes a large band of legitimate rare queries, so for a real fraction of prefixes the system has nothing to say and returns an empty list, which reads as broken to a user typing something perfectly reasonable.",
        choice: {
          pick: "Rolling 24 hour window with ~6 hour half-life decay and a floor of 5 occurrences/day",
          instead: "Count only the last hour, or keep every distinct string with no floor.",
          decider:
            "Rank stability against manipulability. An hour of counts is too thin to rank on, while no floor imports bot noise directly into the suggestion list. A floor of 5 halves ~200M distinct strings to the ~100M the build actually consumes, and on log explosion you sample the tail at 1% rather than lowering it, because the head distribution is what every top-K is made of.",
          flips:
            "A corpus with no adversary and no long tail, such as an internal catalogue, where every entry deserves to be suggestable and there is nobody manufacturing counts.",
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
          "runs over ~100M strings, once an hour",
          "zero cost on a path that serves ~100K QPS",
          "jurisdictional suppression maintained as per-region overlays",
        ],
        breaks:
          "It is string matching against people who are deliberately working around string matching, and offensive or defamatory combinations are composed continuously. A blocklist is a snapshot of yesterday's adversary.",
        choice: {
          pick: "Filter the candidate strings before the top-K roll-up",
          instead: "Let the build finish and strip blocked strings out of the finished top-10 lists.",
          decider:
            "The roll-up's own invariant. A parent's top-10 is selected from the union of its children's top-10 lists, so a blocked string that survives into a child's list has already displaced a legitimate completion from every ancestor's candidate set. Removing it afterwards leaves you a nine-item list, not a corrected one, and the tenth entry no longer exists anywhere to promote.",
          flips:
            "A suppression set that is genuinely per-request, such as one that varies by user age or account setting. Then it cannot be applied at build time at all and has to run over the finished list at serve time.",
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
        why: "A parent's top-10 is selected from the union of its children's top-10 lists plus its own terminal entry, which is correct because any completion in the parent's true top-K also beats everything below it inside its own child subtree. That turns the build into one pass rather than a subtree scan per node.",
        numbers: [
          "top-K stored only to depth 12",
          "past depth 12 a scan at request time costs ~20μs",
          "O(nodes x branching x K), ~1B nodes",
        ],
        breaks:
          "The roll-up is only valid while a score is a property of the completion alone. Length normalisation and prefix-position boosts make the score depend on the (prefix, completion) pair, and then the union of children's lists is no longer a sufficient candidate set.",
        choice: {
          pick: "Precompute top-10 at every node down to depth 12",
          instead: "Store only the candidate set and rank at request time.",
          decider:
            "CPU per request against request rate inside a 50ms budget. A three-character prefix covers on the order of 100,000 completions; gathering and heap-selecting ten is 1 to 3ms, against ~1μs for a precomputed read. At 100K origin QPS that is 100 to 300 cores of pure ranking versus about 0.1 of one. The depth cap is what holds the top-K payload at ~16GB rather than growing with the longest string.",
          flips:
            "When the candidate set is small or the ranking depends on request-time inputs. Under a few thousand candidates a scan finishes in under 100μs, and once the answer varies by region, stock and live promotion the build-time cross product explodes: 10 regions x in-stock x 20 promotions is 400 variants of every list.",
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
        why: "Suffix sharing is the trick: 'running', 'jumping' and 'walking' all end in the same path, so that tail is stored once. This step is what turns a structure too big for a serving box into one that fits on every serving box, which is the decision the whole serving layout rests on.",
        numbers: [
          "~76GB uncompressed to 8-16GB, call it 12GB",
          "~60B per hashmap node amortises to ~10B",
          "compile takes tens of minutes, entirely offline",
        ],
        breaks:
          "Minimisation is global, so the output is read-only and the step is all-or-nothing: there is no partial artifact to publish and no way to patch the one you have.",
        choice: {
          pick: "Build with a plain trie and compile to an FST as a separate stage, using a mature builder such as Lucene's",
          instead: "Construct the FST directly as strings arrive, skipping the intermediate trie.",
          decider:
            "Debuggability against build-host memory. FST construction is a real algorithm while trie insertion is trivial, so keeping the trie stage means there is always a structure you can query directly to answer 'is the compiler wrong or is the data wrong' at 3am. The cost is a build host sized for the ~76GB intermediate, which is a real and easily forgotten capacity requirement.",
          flips:
            "A corpus too large for the intermediate to be resident at all. Then you stream into the compiler and give up the reference structure, and you find out about compiler bugs from serving.",
        },
      },
    },
    {
      id: "object-store",
      label: "Snapshot store",
      sub: "S3, 12GB immutable artifact",
      kind: "blob",
      col: 1,
      row: 8,
      detail: {
        what: "Object storage holding the published FST snapshots, from which every serving node pulls independently.",
        why: "Distribution, not replication. The served artifact is read-only, so every region holds an identical copy per locale and there is no replication protocol to run, only a fan-out job. It is also the entire disaster recovery story: recovery is 'pull the current snapshot and pass the canaries'.",
        numbers: [
          "12GB per snapshot, 200 nodes pull 2.4TB/hour at ~670MB/s",
          "36GB/hour with 3 replicas, ~870GB for 24 hours of rollback history",
          "RPO bounded by the last published snapshot, at most one hour of ranking freshness",
        ],
        breaks:
          "Nothing user-generated lives here, so the risk is not losing data but publishing something wrong and having 200 nodes fetch it in parallel within minutes.",
        choice: {
          pick: "Nodes pull from object storage, keeping the last 24 hours of snapshots",
          instead: "The build host pushes the snapshot directly to each serving node.",
          decider:
            "Egress. 200 nodes times 12GB is 2.4TB per hour, about 670MB/s sustained, and a single build host would be the bottleneck for the entire rollout. Retaining 24 hours costs ~870GB, which is noise next to the traffic it protects.",
          flips:
            "A handful of serving nodes on the same network as the builder, where a direct push saves an entire storage dependency and the egress never binds.",
        },
      },
    },
    {
      id: "stream-agg",
      label: "Streaming aggregator",
      sub: "Flink, 60 second windows",
      kind: "service",
      col: 2,
      row: 7,
      detail: {
        what: "A streaming job that counts the recent query stream in 60 second windows and publishes the small overlay trie the serving nodes merge.",
        why: "It is deployed apart from the hourly build rather than folded into it because the two fail on different schedules and one of them is optional: this job can be switched off, and the product degrades to hourly freshness instead of going down. It also emits 50 to 100MB where the build emits 12GB, so nothing about their capacity or cadence is shared.",
        numbers: ["60 second windows", "produces 50 to 100MB per publish", "closes an up-to-one-hour freshness gap"],
        breaks:
          "It stalls or gets poisoned by a coordinated flood, and the symptom is suggestions with no history at all in the base snapshot. The mitigation is to serve from the base alone until it recovers.",
        choice: {
          pick: "A separate streaming job producing a merge-time overlay",
          instead: "Shortening the batch cadence to every few minutes.",
          decider:
            "The build is ~100M strings compiled into a 12GB artifact that then has to reach 200 nodes at ~670MB/s. That does not run every few minutes at any sane cost, whereas counting a 60 second window and publishing 50 to 100MB does. The two paths are different jobs because they are three orders of magnitude apart in output size.",
          flips:
            "A corpus small enough that a full rebuild takes seconds. Then rebuild whole and delete the overlay, along with the merge logic and the extra safety filter it drags in.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e-type",
      from: "client",
      to: "cdn",
      label: "GET /suggest?q=wea",
      animated: true,
      detail: {
        what: "A debounced keystroke going out as a plain GET keyed only on prefix and locale.",
        why: "The request carries no user identity, which is the single property that makes it cacheable at the edge. Personal history never becomes a parameter, so the response stays a pure function of (prefix, locale) and one cached copy serves everybody.",
        numbers: ["~5 calls per search", "~2M QPS at peak, ~580K average"],
        breaks:
          "Add any per-user parameter and the cache key fragments per user, turning a 95% hit rate into roughly zero and the origin load into 2M QPS.",
      },
    },
    {
      id: "e-hit",
      from: "cdn",
      to: "client",
      label: "10 suggestions, ~10ms",
      fromSide: "right",
      toSide: "right",
      animated: true,
      detail: {
        what: "The cached ~350B JSON payload returned from an edge node without touching the origin.",
        why: "This is where about 95% of all suggest traffic ends. Short prefixes are requested constantly and their answers are identical for everyone, so the common case never reaches a machine that knows anything about tries.",
        numbers: ["~350B, 10 suggestions", "~10ms of the ~100ms keypress-to-paint budget"],
        breaks:
          "Right after a rollback this path keeps returning the bad answers for up to the 60 second TTL, because the origin being healthy again says nothing about what the edge already holds.",
      },
    },
    {
      id: "e-miss",
      from: "cdn",
      to: "lb",
      label: "miss, ~5% of traffic",
      animated: true,
      detail: {
        what: "The miss path: longer and rarer prefixes that no edge node has a cached response for.",
        why: "The whole fleet is sized against this number rather than against total traffic. 2M peak QPS times 5% is ~100K origin QPS, which at ~50μs of CPU per request is about 20 cores of real work spread over ~200 nodes held there by memory and geography.",
        numbers: ["~100K origin QPS at peak", "~50μs CPU per request"],
        breaks:
          "A cache stampede after a snapshot roll sends many simultaneous fills for the same popular prefix, which is why origin fills are single-flighted and top prefixes are pre-warmed.",
      },
    },
    {
      id: "e-route",
      from: "lb",
      to: "suggest",
      label: "any node will do",
      fromSide: "right",
      toSide: "left",
      animated: true,
      detail: {
        what: "The miss handed to whichever node is in the ready pool, with no prefix-to-node mapping consulted.",
        why: "This arrow is deliberately boring, and that is the payoff of the 12GB compile: because every node holds the whole snapshot, there is no routing decision to make, no shard to be hot and no fan-out whose slowest leaf becomes the p99 of the service.",
        numbers: ["~100K origin QPS over ~200 nodes", "~25% CPU utilisation, so a lost node is absorbed"],
        breaks:
          "It sends traffic to any node that says it is ready, so readiness has to mean the canary prefixes pass. A node with an empty index answers faster than a healthy one and will attract traffic, not shed it.",
      },
    },
    {
      id: "e-lookup",
      from: "suggest",
      to: "fst-index",
      label: "walk prefix, read top-10",
      fromSide: "right",
      toSide: "left",
      animated: true,
      detail: {
        what: "One character walked per typed character, ending at a node whose finished top-10 is read straight out of memory.",
        why: "This is the payoff for the entire build pipeline: serving cost does not depend on how many completions the prefix covers. The alternative, gathering and ranking the subtree, is 1 to 3ms for a three-character prefix and would be 100 to 300 cores at origin rate.",
        numbers: ["~1μs, O(prefix length)", "in-process mmap, no network hop"],
        breaks:
          "Past depth 12 there is no stored top-K, so the node scans a small subtree instead, which costs ~20μs and is fine only because those subtrees are genuinely small.",
      },
    },
    {
      id: "e-merge",
      from: "suggest",
      to: "overlay",
      label: "merge trending entries",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The overlay lookup whose top few entries are merged with the base list before the policy filter and serialisation.",
        why: "It is the only way to serve something that started trending after the last snapshot was built, and it is deliberately a merge rather than a write into the base structure, because the compiled FST cannot be edited in place at all.",
        numbers: ["adds ~5μs", "overlay contributes up to 5 candidates"],
        breaks:
          "This is the sharpest safety edge in the system: an entry can go from unseen to served in 60 seconds, faster than any human review, so overlay entries are rate-limited and filtered harder than the base index and still leak first.",
      },
    },
    {
      id: "e-filter",
      from: "suggest",
      to: "policy-filter",
      label: "10 merged candidates",
      detail: {
        what: "The merged list handed to the suppression pass before it is serialised.",
        why: "Second-line defence, in-process, on a list of ten strings. It is drawn as its own step because it is the only point where a suppression newer than the last build, or one that applies to this jurisdiction and not the global index, can take effect.",
        numbers: ["~0.2ms of a ~50ms budget", "10 candidates in, at most 10 out"],
        breaks:
          "A filter that fails open is invisible: the response is the right size, the right shape and the right latency, and the only thing wrong with it is the content.",
      },
    },
    {
      id: "e-fill",
      from: "policy-filter",
      to: "cdn",
      label: "350B, max-age 60",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The filtered response travelling back through the load balancer to the edge, to be cached for 60 seconds under the (prefix, locale) key.",
        why: "The TTL is chosen to match the streaming overlay cadence: caching longer would cache away exactly the freshness the overlay exists to provide, and caching shorter erodes the hit rate that holds the origin at ~100K QPS.",
        numbers: ["Cache-Control: public, max-age=60", "Vary: none"],
        breaks:
          "If a policy suppression ships while a bad answer is cached, that answer keeps being served for up to 60 seconds unless purge-by-tag works, and the first time you use purge is during an incident.",
      },
    },
    {
      id: "e-logs-agg",
      from: "query-logs",
      to: "aggregate",
      label: "24h rolling window",
      detail: {
        what: "A full rolling day of submitted queries read once an hour, not just the hour that has just passed.",
        why: "An hour of counts is too thin to rank on, so the window is a day with recency decay applied inside it. Yesterday still contributes and today dominates, which is what keeps the head of the ranking stable between consecutive builds.",
        numbers: ["~417M queries per hour", "~6 hour half-life decay"],
        breaks:
          "On a viral event the volume outruns the job and the hourly build slips, so the fleet silently keeps serving an older snapshot with every latency metric looking healthy.",
      },
    },
    {
      id: "e-agg-safety",
      from: "aggregate",
      to: "safety",
      label: "~100M queries kept",
      detail: {
        what: "The surviving distinct query strings with their decayed scores, handed to the suppression pass.",
        why: "Everything below the frequency floor is already gone, so this is the smallest set the policy pass could possibly run over, and running it here means the roll-up below never sees a string it is not allowed to rank.",
        numbers: ["~100M strings after the floor of 5/day", "~200M distinct strings arrived"],
        breaks:
          "Roughly 15% of searches are ones nobody has run before, and the floor removes a much wider band than that, so whatever does not survive here is a prefix the system will have nothing to say about.",
      },
    },
    {
      id: "e-safety-topk",
      from: "safety",
      to: "topk",
      label: "blocked strings dropped",
      detail: {
        what: "The permitted strings, sorted lexicographically, streamed into the trie builder.",
        why: "Sorted input is what lets the trie be built in one streaming pass holding only a single root-to-leaf path in memory, so the builder never needs the whole structure resident while constructing it. Filtering before this point is what keeps the roll-up's candidate sets honest.",
        numbers: ["~1B trie nodes at ~20 chars each", "one streaming pass, one root-to-leaf path resident"],
        breaks:
          "A blocklist that runs after this stage cannot repair anything: the blocked string has already displaced a legitimate completion out of every ancestor's top-10.",
      },
    },
    {
      id: "e-topk-fst",
      from: "topk",
      to: "compile",
      label: "~76GB trie with top-K",
      detail: {
        what: "The finished in-memory trie, every node down to depth 12 carrying its top-10, handed to the minimiser.",
        why: "The compile step exists only because this artifact is too big to serve. ~60GB of nodes plus ~16GB of top-K payload does not fit a 64GB box, and not fitting is what would force sharding and the hot-prefix skew that comes with it.",
        numbers: ["~60GB of nodes plus ~16GB top-K payload", "~60B per hashmap node"],
        breaks:
          "This structure only exists inside the build job, so a build host sized for 76GB plus headroom is a real and easily forgotten capacity requirement.",
      },
    },
    {
      id: "e-publish",
      from: "compile",
      to: "object-store",
      label: "12GB immutable snapshot",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The minimised, checksummed artifact written once to object storage as an immutable snapshot.",
        why: "Publishing once and letting the fleet pull is what keeps the build host out of the distribution path. Immutability is also what makes rollback trivial: an older snapshot is still a valid served structure, so recovery is a file choice rather than a repair.",
        numbers: ["12GB per locale", "written once, read ~200 times"],
        breaks:
          "A well-formed but semantically wrong snapshot is indistinguishable from a good one at this point, because the checksum only proves the bytes are intact.",
      },
    },
    {
      id: "e-pull",
      from: "object-store",
      to: "loader",
      label: "each node pulls 12GB",
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "Every serving node downloading the new snapshot to a temp path on local NVMe, in parallel with all the others.",
        why: "Pulling from object storage rather than being pushed from the build host is a bandwidth decision: 200 nodes times 12GB is 2.4TB per hour, and one host's egress would be the bottleneck for the entire rollout.",
        numbers: ["2.4TB/hour, ~670MB/s sustained", "~200 nodes worldwide"],
        breaks:
          "A partial or corrupt download on a subset of nodes, which is exactly what the checksum catches and exactly the failure mode people over-index on relative to a bad build.",
      },
    },
    {
      id: "e-swap",
      from: "loader",
      to: "fst-index",
      label: "atomic pointer flip",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      detail: {
        what: "The activation itself: mmap the verified file and flip one pointer from the old FST to the new one, in 10% waves across the fleet.",
        why: "Requests already holding the old pointer finish against the old mapping, which is unmapped when its refcount hits zero, so no request ever sees a half-swapped structure. Waves exist so a build that passes its canaries on one node but is wrong in general cannot take the whole fleet.",
        numbers: ["10% waves, two-minute soak", "both snapshots resident during the overlap, so size for 24GB"],
        breaks:
          "Swapping the whole fleet at once. A bad build then reaches 100% of serving nodes before anybody sees a metric move.",
      },
    },
    {
      id: "e-logs-stream",
      from: "query-logs",
      to: "stream-agg",
      label: "live query stream",
      fromSide: "right",
      toSide: "left",
      animated: true,
      detail: {
        what: "The same log consumed continuously rather than in hourly batches, counted in 60 second windows.",
        why: "Sharing the input with the batch job is deliberate: both paths rank the same thing by the same signal, so the overlay never disagrees with the base snapshot about what a query is, only about how recently it got popular.",
        numbers: ["60 second windows", "same source as the hourly build"],
        breaks:
          "A coordinated query flood reaches this path in a minute, long before the frequency floor on the batch side would have absorbed it.",
      },
    },
    {
      id: "e-overlay-publish",
      from: "stream-agg",
      to: "overlay",
      label: "rebuild every 60s",
      fromSide: "top",
      toSide: "left",
      detail: {
        what: "The freshly counted trending entries published as a small trie for every serving node to hold alongside the base snapshot.",
        why: "It is published rather than merged into the index because the base artifact is immutable, and it is small so a node can drop it and serve from the base alone the moment the overlay looks wrong.",
        numbers: ["50 to 100MB per node", "60 second cadence against an hourly base"],
        breaks:
          "Overlay age is its own alarm: the base index may be an hour old, but an overlay five minutes stale means the trending path has silently stopped.",
      },
    },
  ],
};
