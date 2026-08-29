import type { Diagram } from "./types";

export const WEB_SEARCH: Diagram = {
  id: "web-search",
  title: "Web Search",
  question: "Design a Web Search Engine",
  sourceId: "patterns",
  itemId: 47,
  overview: {
    shape:
      "One index split a thousand ways by document, built offline into immutable segments, and queried by merging every shard's best answers inside a hard deadline.",
    forces: [
      {
        constraint: "Term partitioning would need to move a ~180MB posting list per query at 50k uncached QPS, ~9TB/s",
        decision: "The index is split by document instead, so a query stays local and only ~800B crosses the network per shard",
        lights: ["leaf-group", "leaf", "segments", "e4", "e5"],
      },
      {
        constraint: "Query popularity is Zipf, so a small head of queries covers roughly half of all traffic",
        decision: "The Query result cache absorbs ~50% of traffic before any fan-out, worth ~500 machines per point of hit rate",
        lights: ["query-cache", "e1"],
      },
      {
        constraint: "One root socket cannot issue and collect 1000 RPCs inside a 50ms budget",
        decision: "A two-level fan-out, one root, ~30 mergers, 1000 leaves, returns once 99% of shards have answered, under a 40ms deadline",
        lights: ["fanout", "leaf", "e3"],
      },
      {
        constraint: "Scoring the full ~750k-document union directly costs ~130ms of CPU against a ~30ms leaf budget",
        decision: "Block-max WAND early termination scores only ~5k documents and provably returns the same top 20",
        lights: ["retrieval", "e4"],
      },
      {
        constraint: "Early termination stays rank-safe for the top 20 only while every term's score ceiling is known in advance",
        decision: "The expensive cross-encoder sits above retrieval, reordering only a 500-document candidate set someone else produced",
        lights: ["reranker", "merge", "e8"],
      },
    ],
    naive: {
      text: "Shard the index by term instead of by document: put every posting list for coffee on one machine, every list for shops on another. A query then only wakes as many machines as it has distinct terms, three for a three-word query instead of a thousand, which looks obviously cheaper. The problem is what has to move. Answering an intersection or a ranked union means bringing the posting lists together somewhere. The cheapest list for coffee shops brooklyn is still shops, at roughly 90M postings, about 180MB. At 50k uncached QPS that is ~9TB/s of bisection bandwidth, a number that ends the design rather than one you engineer around. Document partitioning, at ~1000 shards each holding a complete local index, replaces this. A query is answered entirely on one machine, and only the shard's own top 20 results, about 800 bytes, ever crosses the network.",
      lights: ["leaf-group", "leaf"],
    },
    beats: [
      {
        text: "Acquisition is not this system's problem. A durable stream of fetched pages arrives from a web crawler, roughly 29k documents a second. Everything upstream of that stream, politeness, dedup, traps, belongs to a different design with different constraints.",
        lights: ["crawl-stream", "indexer", "e11"],
      },
      {
        text: "Index building is an offline batch job, never a write against a serving node. Tokenise, emit (term, doc_id, positions, field), shuffle by term, sort by doc id, delta and varbyte encode, and write an immutable generation-tagged segment. Publishing is a pointer swap and a bad build rolls back in seconds.",
        lights: ["indexer", "segments", "e12"],
      },
      {
        text: "The index is split by document, not by term. Each of ~1000 leaves owns ~50M documents and the complete index for them, so a query is answered locally and only ~800 bytes crosses the network. Term partitioning would have to move the smallest posting list, ~180MB, per query, ~9TB/s at 50k uncached QPS.",
        lights: ["leaf-group", "leaf", "segments", "e4", "e5"],
      },
      {
        text: "The query path is a cache, a fan-out and a merge. The result cache absorbs ~50% of traffic because query popularity is Zipf. What misses goes through a root and ~30 mid-tier mergers to all 1000 leaves under a 40ms hard deadline, and the root returns once 99% of shards have answered.",
        lights: ["query-service", "query-cache", "fanout", "leaf", "e1", "e2", "e3"],
      },
      {
        text: "Retrieval and ranking then split by cost profile. A cheap bounded scorer at the leaf prunes a ~750k union to ~5k scored documents and emits 20. An expensive cross-encoder reorders only the top 500 centrally on a GPU. Retrieval is cheap per document over billions so it is pushed down; ranking is expensive per document over hundreds so it is pulled up.",
        lights: ["retrieval", "merge", "reranker", "e7", "e8"],
      },
      {
        text: "The budget is what has to add up: cache lookup ~2ms, fan-out and leaf retrieval ~40ms behind the deadline with hedging at ~12ms, merge tree ~10ms. Then feature fetch ~20ms, cross-encoder ~50ms, snippets ~40ms, egress ~15ms. That is about 180ms against a 300ms SLO. The remaining 120ms absorbs the tail rather than funding growth.",
        lights: ["snippets", "e9"],
      },
    ],
    crux: {
      problem:
        "You have to bound the work of one query twice, and the second bound is fragile. Partitioning caps how much index a machine looks at; early termination caps how many matches it actually scores.",
      handled:
        "Early termination is only rank-safe while the score is a sum of per-term contributions with known ceilings. That is precisely why the expensive model has to sit above retrieval and score a candidate set someone else produced. The Cross-encoder rerank cannot participate in retrieval itself: it produces no per-term score ceiling, so running it earlier would break the rank-safety the whole funnel depends on.",
    },
    numbers: [
      {
        value: "~1000 shards x ~50M docs, ~165TB per index copy",
        explain: "The full corpus partitioned into document-hashed shards, each small enough to fit comfortably in one leaf's resident memory and disk budget.",
      },
      {
        value: "750k union, 5k scored, 20 per leaf, 500 reranked, 10 shown",
        explain: "The full narrowing funnel from a single query's local candidate pool down to what the user actually sees, roughly a 75,000x reduction end to end.",
      },
      {
        value: "40ms leaf deadline, ~180ms of a 300ms p99 budget",
        explain: "The hard per-leaf time limit and the running total the whole query path is expected to consume, leaving deliberate headroom for tail latency.",
      },
    ],
  },
  nodes: [
    {
      id: "leaf-group",
      label: "Leaf shard (x1000)",
      kind: "zone",
      detail: {
        what: "One shard: ~50M documents and the complete index for them, so a query is answered without ever leaving the machine.",
        why: "Document partitioning makes load uniform, because doc ids are hashed and no shard is hotter than another, and it makes indexing local, because a new document touches exactly one shard. The network cost per query is a function of k, not of corpus size.",
        numbers: [
          { value: "~50M docs and ~165GB of index per shard", explain: "The per-shard corpus size and index footprint, small enough to keep the hot working set resident." },
          { value: "~800B of results on the wire per shard", explain: "What each shard actually returns per query: its own top-20, not any raw data." },
          { value: "~25 replicas per shard, ~25,000 leaves", explain: "The fleet size at full replication, the number every per-leaf cost figure is multiplied by." },
        ],
        breaks: {
          failure: "Every machine works on every uncached query, so p99 is the maximum of 1000 draws.",
          handled: "Capacity scales with QPS x shards rather than QPS, an accepted cost of document partitioning that the deadline-and-coverage design exists to bound.",
        },
        choice: {
          pick: "Partition the index by document, ~1000 shards, complete local index",
          instead: "Partition by term, so a three-word query wakes three machines instead of a thousand.",
          decider:
            "Cross-shard posting-list transfer against fan-out tail. Term partitioning must move a list per query; the cheapest for `coffee shops brooklyn` is `shops` at ~90M postings x 2B = ~180MB. At 50k uncached QPS that is ~9TB/s of bisection bandwidth. Fan-out's cost is a tail you can cap with a deadline at ~5% extra fleet load.",
          flips:
            "When the largest list you would move stays under ~1MB and shard count is low: a ~10M-document corpus over ~10 shards. Or a workload of single-term SKU and product-code lookups, where there is nothing to intersect.",
        },
      },
    },
    {
      id: "query-service",
      label: "Query service",
      sub: "normalise, stem, cache key",
      kind: "service",
      col: 0,
      row: 0,
      detail: {
        what: "Normalises the query (lowercase, strip punctuation, spell-correct, stem, downweight stopwords), builds the canonical cache key, and either answers from cache or starts the fan-out.",
        why: "This is the only place that can avoid the fan-out entirely. Query popularity is Zipf, so a canonical key turns roughly half of all traffic into a ~5ms lookup and removes it from a 25,000-machine fleet.",
        numbers: [
          { value: "~5ms on a cache hit", explain: "The full latency of the fast path this stage enables." },
          { value: "100k QPS peak, ~33k/s average", explain: "The query volume this service absorbs at typical and peak load." },
          { value: "~2.9B queries/day", explain: "The daily total, the scale that makes even small percentage improvements worth thousands of machines." },
        ],
        breaks: {
          failure: "Over-eager normalisation answers a different question: stemming a product code or spell-correcting a surname loses the one token the user cared about.",
          handled: "This is an accepted risk balanced against the far larger gain of a working cache key, so normalisation rules are tuned conservatively for known-sensitive query classes.",
        },
        choice: {
          pick: "Normalise and key the query once, before any fan-out",
          instead: "Ship the raw query to the leaves and let each one normalise it.",
          decider:
            "Duplicated work and a missing cache key. Normalising at the leaf repeats identical work 1000 times per query, and worse there is no canonical key. Nothing is reusable across the ~50% of traffic that repeats, and the serving fleet roughly doubles.",
          flips:
            "A single-shard deployment where there is no fan-out to amortise and per-shard analysis chains (per-language analysers, say) genuinely differ.",
        },
      },
    },
    {
      id: "query-cache",
      label: "Query result cache",
      sub: "Redis, ~10 min TTL",
      kind: "database",
      col: 1,
      row: 0,
      detail: {
        what: "The serialised top 10, keyed on sha1(normalised query | locale | personalisation bucket) with a ~10 minute TTL.",
        why: "It is the largest capacity lever in the system. At 100k QPS across 1000 shards a cold cache is 100M leaf RPCs/s; a 50% hit rate halves the fleet that has to exist.",
        numbers: [
          { value: "hit rate SLO >= 50%", explain: "The minimum acceptable cache effectiveness, below which capacity planning assumptions break." },
          { value: "one point ~= 1M leaf RPCs/s ~= 500 machines", explain: "The conversion rate between hit-rate percentage and fleet size, what makes this the largest single capacity lever available." },
          { value: "~10 min TTL", explain: "How long a cached answer stays valid before requiring a fresh fan-out." },
        ],
        breaks: {
          failure: "Cache-key cardinality is the risk. Adding user identity takes the key space from millions of queries to billions of query-user pairs.",
          handled: "The hit rate falls toward zero and the serving fleet roughly doubles, which is why personalisation is expressed as a coarse bucket rather than a per-user key.",
        },
        choice: {
          pick: "Redis keyed on query, locale and a coarse personalisation bucket",
          instead: "A per-user cache key, or no result cache at all.",
          decider:
            "Hit rate priced in machines. Coarse buckets hold the rate above 50%; per-user keys drive it to nearly zero. Since every point is worth ~500 machines, a five-point drop is a capacity incident rather than a performance curiosity.",
          flips:
            "A workload with essentially no repeated queries, such as internal log or code search, where the cache is pure operational cost and the memory is better spent on postings.",
        },
      },
    },
    {
      id: "fanout",
      label: "Root + mid-tier mergers",
      sub: "1 root, ~30 mergers, 1000 leaves",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "A two-level fan-out: the root asks ~30 mid-tier mergers, each of which asks ~33 leaves, under a 40ms hard deadline with hedging at the p95.",
        why: "One root socket cannot issue 1000 RPCs and collect 1000 responses inside a 50ms budget. And ~800KB fanned in per query at 50k uncached QPS is ~40GB/s, which saturates a NIC long before the CPU.",
        numbers: [
          { value: "~30 mergers, ~33 leaves each", explain: "The two-level tree's fan-out ratio at each level, chosen to keep any single node's socket count manageable." },
          { value: "~800KB fanned in per query", explain: "The total data volume this tree collects and merges for one query." },
          { value: "hedge rate SLO <= 8%", explain: "The maximum acceptable rate of duplicate hedged requests, kept low to avoid the hedge itself becoming a load problem." },
        ],
        breaks: {
          failure: "A mid-tier merger dying mid-query silently loses ~33 shards.",
          handled: "Shard coverage has to be counted per response rather than assumed, which is why every response is tagged with the fraction of shards it actually represents.",
        },
        choice: {
          pick: "Two-level merge tree, 40ms deadline, return at 99% shard coverage",
          instead: "A single root fanning out to all 1000 leaves and waiting for every one of them.",
          decider:
            "What a missing shard costs against what waiting costs. Dropping 10 of 1000 shards loses ~0.1% of candidates, about 0.1 perturbed results and almost always at positions 8 to 10. Waiting for the true maximum of 1000 draws with a fat tail routinely costs 200ms or more of a 300ms SLO.",
          flips:
            "When completeness is contractual rather than aesthetic: legal discovery, regulatory archives, anything reporting a match count. Also at ~50 shards, where the maximum of 50 draws is close to one leaf's p99 and the deadline buys nothing.",
        },
      },
    },
    {
      id: "leaf",
      label: "Leaf query server",
      sub: "FST dictionary, base + real-time",
      kind: "service",
      col: 1,
      row: 1,
      parent: "leaf-group",
      detail: {
        what: "The process that answers locally: an FST lookup per term, cursors opened over the base segments and the real-time tier, and one top-20 heap for the shard.",
        why: "64 cores at ~30ms of CPU per query gives ~2k QPS per leaf, and that single figure sets the replica count for the whole fleet. Every decision inside the leaf is made against that 30ms.",
        numbers: [
          { value: "~2k QPS per leaf, ~30ms CPU per query", explain: "The per-leaf throughput ceiling that determines fleet-wide replica count." },
          { value: "~2B distinct terms in a ~40GB FST", explain: "2B terms as raw strings would dwarf the 200GB of postings beside it — shared-prefix FST encoding is what keeps the whole dictionary resident at ~40GB." },
          { value: "~200GB of resident postings per leaf", explain: "The memory footprint of the hot posting data this leaf serves from." },
        ],
        breaks: {
          failure: "Cold posting lists on rare terms turn a 5ms leaf query into a 50ms NVMe-bound one.",
          handled: "Long-tail queries are exactly the ones the result cache cannot help with, so this tail latency is monitored and accepted rather than eliminated.",
        },
        choice: {
          pick: "FST term dictionary, memory-resident, one per segment",
          instead: "A hash map from term to offset, or an on-disk B-tree.",
          decider:
            "Resident bytes. ~2B distinct terms is far too much as raw strings beside 200GB of postings. An FST shares prefixes and suffixes and holds the same map in ~40GB, with the term-level doc_freq and max_score inline. That inline data is what early termination needs before it touches a posting.",
          flips:
            "Vocabularies small enough to fit in a plain map, where an FST's build cost and lack of cheap mutation buy nothing.",
        },
      },
    },
    {
      id: "retrieval",
      label: "Block-max WAND",
      sub: "~750k union, ~5k scored",
      kind: "service",
      col: 1,
      row: 2,
      parent: "leaf-group",
      detail: {
        what: "Disjunctive retrieval with early termination: a score ceiling per term and per 128-posting block, a running theta equal to the 20th-best score. Any document or block that provably cannot reach theta is skipped unread.",
        why: "The union of the three terms in one shard is ~750k documents, and scoring one is a random read into the doc-metadata block at ~175ns. That is ~130ms of CPU against a ~30ms budget. This scores ~5k instead, about 150x less work, and provably returns the same top 20.",
        numbers: [
          { value: "~750k union, ~5k scored, ~1ms", explain: "The candidate pool this stage starts from, what it actually scores, and how fast it does it." },
          { value: "ceiling per 128-posting block", explain: "The granularity at which score bounds are computed, letting whole blocks be skipped rather than individual postings." },
          { value: "~175ns per scored document", explain: "The per-document cost of the random metadata read a full score requires." },
        ],
        breaks: {
          failure: "Pruning collapses on phrase-heavy queries, because position verification happens after a document is admitted, so the retrieval bound is the loose bag-of-words one.",
          handled: "It also collapses on terms whose score distribution is flat, where the ceiling never falls below theta, an accepted limit rather than something the algorithm can fix.",
        },
        choice: {
          pick: "Disjunctive scoring with block-max WAND, MaxScore on short queries",
          instead: "Strict conjunctive intersection: walk the cursors in lockstep and score only documents containing every term.",
          decider:
            "Union size against the CPU budget, and whether AND is the semantics you want. Intersection is genuinely cheap, ~1ms for the ~5k documents holding all three terms, but it drops a heavily linked page titled 'Brooklyn Coffee' that says cafes rather than shops. Exhaustive disjunctive scoring is ~4x over budget and would need ~100,000 leaves instead of ~25,000.",
          flips:
            "When AND is correct rather than a compromise: code search, log search and legal discovery, where a missing term is a wrong answer. Also when the union is under ~100k documents per shard, which covers most enterprise and site search.",
        },
      },
    },
    {
      id: "crawl-stream",
      label: "Crawl stream",
      sub: "fetched pages, Kafka",
      kind: "external",
      col: 2,
      row: 0,
      detail: {
        what: "The input contract: a durable stream of fetched pages produced by a web crawler. Acquisition, politeness, traps and URL dedup all live in that separate system, not here.",
        why: "It is one box on purpose. This design owns indexing and serving. Drawing the crawler would import a completely different set of constraints (per-host rate limits, robots, frontier scheduling) that change none of the decisions below it.",
        numbers: [
          { value: "~5% of the corpus changes per day", explain: "The daily churn rate this design has to keep pace with." },
          { value: "2.5B docs/day, ~29k docs/s", explain: "2.5B ÷ 86,400s ≈ 29k docs/s — the exact ingest rate the batch indexer downstream has to sustain without falling behind." },
          { value: "~50KB HTML in, ~5KB text out", explain: "The size reduction from raw fetched HTML to extracted indexable text." },
        ],
        breaks: {
          failure: "If the stream stalls, breaking content silently stops appearing.",
          handled: "The base index keeps serving everything older, so only the crawl-to-searchable lag gauge shows it, which is why that gauge pages at 15 minutes.",
        },
      },
    },
    {
      id: "indexer",
      label: "Index build",
      sub: "Spark shuffle, hourly segments",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "An offline batch job: strip boilerplate, tokenise, emit (term, doc_id, positions, field), shuffle by term, sort each list by doc id, delta and varbyte encode, write a segment.",
        why: "Sorting by term is a global operation, so you want to pay for it once per segment rather than once per document. Nothing here is synchronous with serving, which is what makes a bad build recoverable rather than an outage.",
        numbers: [
          { value: "~29k docs/s, ~145MB/s of extracted text", explain: "The rate this batch pipeline ingests and processes new text." },
          { value: "~65MB/s of new postings", explain: "The output rate of newly generated posting data." },
          { value: "hourly incremental, base rebuild every 2-3 days", explain: "The two cadences: frequent small updates and periodic full rebuilds." },
        ],
        breaks: {
          failure: "A full base rebuild over 165TB takes days, so the base index is always somewhat stale.",
          handled: "Rebuilds must be staggered per shard, or the fleet all rebuilds at once, which is why the rebuild schedule is deliberately spread rather than synchronised.",
        },
        choice: {
          pick: "Batch build producing whole immutable segments",
          instead: "Stream per-document updates straight into the serving tier.",
          decider:
            "The cost of the sort. 25 trillion postings must end up ordered by term then doc id; doing that per document is a random write per posting, whereas a shuffle and sort writes ~65MB/s sequentially. The freshness gap that batching opens is closed by the real-time tier instead, at ~234MB per leaf.",
          flips:
            "Corpora small enough that per-document updates are affordable, the Elasticsearch refresh model at millions rather than billions of documents, where a seconds-fresh single index beats running two scoring regimes.",
        },
      },
    },
    {
      id: "segments",
      label: "Immutable segments",
      sub: "FST, postings, doc meta, deletes",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "Generation-tagged segment files on local NVMe, mmapped, with the canonical copy in object storage. Each holds the FST dictionary, the posting blocks, a columnar doc-metadata block, and a delete bitmap.",
        why: "Nothing is ever mutated in place. Publishing is a pointer swap, a deletion is a bit in an overlay, and readers need no locks against writers. The delete bitmap is the only mutable structure a leaf owns.",
        numbers: [
          { value: "~2B per non-positional posting, ~4.5B positional", explain: "The per-posting storage cost for the two encoding modes this index carries." },
          { value: "~165TB per full index copy, ~1PB at RF=3", explain: "The total corpus size and its replicated footprint." },
          { value: "~32B of metadata per document", explain: "The compact per-document record size that supports scoring without a random text read." },
        ],
        breaks: {
          failure: "Compaction rewrites the same postings repeatedly and competes with serving for NVMe bandwidth.",
          handled: "Throttling compaction is the response, at the cost of query cost growing roughly linearly in segment count instead, an accepted tradeoff to protect the serving path.",
        },
        choice: {
          pick: "Immutable generation-tagged segments, mmapped from local NVMe",
          instead: "A mutable index updated in place as documents change.",
          decider:
            "Rollback time. A corrupt build or a tokeniser bug is a pointer swap back to the previous generation and takes seconds, against days to repair 165TB in place. Immutability is also what lets a new build canary on 1% of shards before fleet-wide publish.",
          flips:
            "Indexes small enough that a full rebuild is minutes and one writer can briefly pause readers, where segment merging is pure overhead.",
        },
      },
    },
    {
      id: "rt-index",
      label: "Real-time tier",
      sub: "in-memory, ~234MB per leaf",
      kind: "database",
      col: 3,
      row: 2,
      detail: {
        what: "A small in-memory inverted index per leaf holding everything indexed since the last hourly segment publish, unioned with the base segments before the local top-k.",
        why: "Rebuilding 165TB takes days and a story published four minutes ago cannot wait for that. The tier only ever has to cover the gap since the last publish, which is one hour of crawl.",
        numbers: [
          { value: "~104M docs fleet-wide per hour", explain: "The volume this tier ingests every publish cycle across the whole fleet." },
          { value: "~234MB per leaf", explain: "The small per-leaf memory footprint of this gap-covering tier." },
          { value: "crawl-to-searchable p95 <= 5 min", explain: "The freshness target this tier is specifically responsible for meeting." },
        ],
        breaks: {
          failure: "These documents have no PageRank, because the link graph has not seen them, and no click data, because nobody has clicked them.",
          handled: "The two tiers therefore score by different functions permanently, and a page's rank shifts when it graduates into the base index, an accepted inconsistency rather than something reconciled.",
        },
        choice: {
          pick: "A small in-memory tier unioned at query time",
          instead: "Publish base segments far more often so there is no gap to cover.",
          decider:
            "Rebuild cost against the freshness SLO. 165TB rebuilt is days against a 5 minute target, while the hourly gap is only ~234MB per leaf and sits comfortably in RAM beside ~200GB of resident postings.",
          flips:
            "When a daily rebuild is fresh enough, a documentation or product catalogue index, where a second scoring regime is not worth the permanent ranking inconsistency it introduces.",
        },
      },
    },
    {
      id: "merge",
      label: "Candidate merge + GBDT",
      sub: "20,000 candidates, top 500",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "The fan-in: 1000 x 20 candidates collapsed into one global ordering, then a tier-2 gradient-boosted ranker over ~200 features cuts that to 500.",
        why: "Leaf scores are directly comparable, because every shard runs the same scoring function over a hash-uniform slice of the corpus. The merge is therefore a k-way heap rather than a rescore. The GBDT is where signals that need the whole candidate set can finally be applied.",
        numbers: [
          { value: "20,000 in, 500 out", explain: "The total merged candidate pool and how far the GBDT stage narrows it." },
          { value: "~10ms at p99", explain: "Fits inside the ~300ms query SLO alongside the 40ms fan-out deadline and the reranker's 50ms GPU batch — the budget this fan-in step must not blow." },
          { value: "coverage SLO: 99.9% of queries reach >= 99% of shards", explain: "The reliability target that keeps a partial response the exception rather than the norm." },
        ],
        breaks: {
          failure: "If shards answer from different segment generations the merge silently mixes two scoring regimes.",
          handled: "The ordering is wrong rather than late, which no latency alarm will catch, so generation consistency across shards is checked explicitly rather than inferred from timing.",
        },
        choice: {
          pick: "k-way merge at k=20 per leaf, then a GBDT over ~200 features",
          instead: "Take the top 100 from every leaf and rank the whole pool centrally with one model.",
          decider:
            "Fan-in bytes. k=20 is ~800B per leaf, ~800KB per query and ~40GB/s at 50k uncached QPS; k=100 is five times that, ~200GB/s, which no merge tier absorbs. Depth 500 into the reranker is what the GPU budget allows, and recall past that is worth very little.",
          flips:
            "Few shards and modest QPS, where fan-in is trivial and a deeper candidate set genuinely buys recall the leaf scorer was too crude to keep.",
        },
      },
    },
    {
      id: "reranker",
      label: "Cross-encoder rerank",
      sub: "500 docs, GPU batch ~50ms",
      kind: "service",
      col: 1,
      row: 4,
      detail: {
        what: "A transformer that reads the query and each document together and reorders the top 500. The most expensive component per document anywhere in the system.",
        why: "It structurally cannot participate in retrieval: it produces no per-term score ceiling, so it would break the rank-safety that early termination rests on. The funnel is forced by what can and cannot be bounded, not chosen as a cost optimisation.",
        numbers: [
          { value: "500 documents reranked, 10 shown", explain: "The final narrowing from GPU-scored candidates to what the user sees." },
          { value: "~50ms GPU batch at p99", explain: "The latency this most-expensive stage adds to the overall budget." },
          { value: "0.1% permanent no-rerank holdback", explain: "A deliberately maintained control group used to measure the reranker's true impact." },
        ],
        breaks: {
          failure: "GPUs are the scarcest resource, so a traffic spike hits this tier first.",
          handled: "You cut depth from 500 to 200 and circuit-break to the GBDT order, a quality cliff accepted deliberately exactly when traffic is highest, rather than letting the tier fall over.",
        },
        choice: {
          pick: "One central GPU tier reranking the top 500",
          instead: "Push the model down to the leaves and rerank there, close to the data.",
          decider:
            "Cost per document times documents seen. At the leaf the transformer would face ~50M documents per shard; centrally it runs 500 times per query. Retrieval is cheap per document and must consider billions so it is pushed down; ranking is expensive per document and needs hundreds so it is pulled up.",
          flips:
            "Corpora where the entire candidate set is a few hundred documents to begin with, so there is no funnel and the extra tier is just another hop.",
        },
      },
    },
    {
      id: "snippets",
      label: "Snippet service",
      sub: "doc store reads, top 10",
      kind: "service",
      col: 0,
      row: 4,
      detail: {
        what: "Fetches URL, title and extracted text for the ten winners from the document store and highlights the matched terms.",
        why: "This is the only component that touches raw document text, which is why the doc store is deliberately off the retrieval path. Reading ~85TB of text to decide ranking would be absurd; reading it for ten results is ~40ms.",
        numbers: [
          { value: "~40ms at p99 including doc-store reads", explain: "The full latency this stage adds, dominated by the reads themselves." },
          { value: "~85TB gzipped doc store, ~255TB at RF=3", explain: "About half the 165TB index size — cheap enough to replicate 3x for durability, since only 10 of 20,000 candidates per query ever read from it." },
          { value: "10 of 20,000 candidates need one", explain: "How rarely this expensive read path is actually exercised relative to the full candidate pool." },
        ],
        breaks: {
          failure: "A failed snippet fetch must degrade to a cached or meta-description snippet.",
          handled: "Dropping the result instead is strictly worse: a result with a poor snippet beats a missing result, which is why degraded snippets are preferred over omission.",
        },
        choice: {
          pick: "A separate document store, read only for the final 10",
          instead: "Carry the document text alongside the postings so leaves can build snippets locally.",
          decider:
            "Bytes kept where they are not needed. Text is ~85TB against ~165TB of index. Building snippets at the leaf means all 1000 shards touch text for candidates that will never be shown, when only 10 of 20,000 ever need one.",
          flips:
            "Small indexes where the text is already resident on the same machine, and running a separate store is more operational cost than the coupling saves.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "query-service",
      to: "query-cache",
      tier: "data",
      label: "normalised key probe",
      detail: {
        what: "A lookup on sha1(normalised query | locale | personalisation bucket) before any fan-out happens.",
        why: "Query popularity is Zipf, so a small head of queries covers about half of all traffic. This probe is the difference between 100M leaf RPCs/s and 50M.",
        numbers: [
          { value: "~50-60% of traffic answered here", explain: "Halves the leaf fan-out load fleet-wide — the gap between 100M leaf RPCs/s and 50M is entirely this cache's hit rate." },
          { value: "~5ms end to end on a hit", explain: "The full latency for a cache-hit query." },
        ],
        breaks: {
          failure: "A cold cache after a deploy doubles leaf QPS instantly.",
          handled: "The fleet has to be provisioned for a stated miss headroom, and the cache is warmed from the head-query list rather than cold-started, absorbing the transition deliberately.",
        },
      },
    },
    {
      id: "e2",
      from: "query-service",
      to: "fanout",
      tier: "hot",
      step: 1,
      label: "cache miss",
      detail: {
        what: "The normalised term list, filters and locale for a query the cache could not answer.",
        why: "Everything below this arrow costs ~1000 machine-visits, which is why so much design effort sits above it. Roughly half of peak traffic crosses it, about 50k QPS.",
        numbers: [{ value: "~50k uncached QPS at peak", explain: "×1000 leaf RPCs per query ≈ 50M leaf RPCs/s fleet-wide — this one number sizes the entire fan-out tier below it." }],
        breaks: {
          failure: "Long-tail queries dominate here by definition, and they are the ones with cold posting lists.",
          handled: "The miss path has a systematically worse latency distribution than the hit path, an accepted asymmetry between the two paths rather than something smoothed away.",
        },
      },
    },
    {
      id: "e3",
      from: "fanout",
      to: "leaf",
      tier: "hot",
      step: 2,
      label: "1000 leaf RPCs, 40ms",
      detail: {
        what: "The same query broadcast to every shard: terms, filters, k=20 and a deadline_ms of 40.",
        why: "Document partitioning means relevance can be anywhere, so there is no subset of shards you could ask instead. The deadline travels with the request so the leaf, not the caller, enforces it.",
        numbers: [
          { value: "k=20 per leaf", explain: "≈800B/leaf, ~800KB/query, ~40GB/s of fan-in at 50k QPS — k=100 would be five times that, more than any merge tier absorbs." },
          { value: "deadline 40ms, hedge at the p95", explain: "The per-shard time limit and the point at which a slow shard's request is duplicated to a faster path." },
        ],
        breaks: {
          failure: "This is the fan-out tax: capacity scales with QPS x shards.",
          handled: "At 50M leaf RPCs/s and ~2k QPS per leaf you need ~25,000 machines. Any per-query cost here is multiplied a thousandfold, which is why this arrow is treated as the most expensive in the system.",
        },
      },
    },
    {
      id: "e4",
      from: "leaf",
      to: "retrieval",
      tier: "hot",
      step: 3,
      label: "term to posting lists",
      detail: {
        what: "One FST lookup per term, yielding a posting-list offset plus that term's doc_freq and max_score, handed to the retrieval loop as cursors.",
        why: "The max_score comes out of the dictionary rather than the postings on purpose. Early termination needs each term's ceiling before it decodes a single posting, and the cursors are sorted by it.",
        numbers: [
          { value: "3 cursors for a three-word query", explain: "The typical number of active cursors retrieval juggles for a short query." },
          { value: "~500k, ~200k, ~90k postings locally", explain: "An example of the per-term posting counts one shard might hold for a three-word query." },
        ],
        breaks: {
          failure: "A term missing from the dictionary is a zero-length list, not an error.",
          handled: "A tokeniser mismatch between build and query time degrades recall silently, so tokeniser consistency between the indexer and the leaf is treated as a critical invariant.",
        },
      },
    },
    {
      id: "e5",
      from: "segments",
      to: "retrieval",
      tier: "data",
      label: "mmapped postings",
      detail: {
        what: "Posting blocks and doc-metadata reads served straight out of the page cache over mmapped segment files.",
        why: "Postings are the overwhelming majority of the 165TB, so bytes decoded per query is the latency variable. Gap plus varbyte encoding means a term in 500k of 50M documents needs one or two bytes per posting, and SIMD decodes billions per second.",
        numbers: [
          { value: "~2B per posting non-positional", explain: "The compact per-posting storage cost that keeps the index small enough to hold in memory." },
          { value: "skip entry every 128 postings", explain: "The granularity of the skip structure that lets whole blocks be bypassed during pruning." },
        ],
        breaks: {
          failure: "A block not resident is an NVMe read in the middle of the scoring loop.",
          handled: "This is how a 5ms query becomes a 50ms one on rare terms, an accepted tail cost of relying on page cache rather than pinning everything in memory.",
        },
      },
    },
    {
      id: "e6",
      from: "rt-index",
      to: "leaf",
      tier: "control",
      label: "last hour, in memory",
      detail: {
        what: "The documents indexed since the last hourly publish, unioned with the base cursors before the leaf's local top-20 is taken.",
        why: "Freshness is additive rather than a separate query path, so a failure of this tier degrades freshness only and never correctness. A watermark drops the tier when the segment covering it lands.",
        numbers: [
          { value: "~234MB per leaf", explain: "The small footprint of this always-unioned real-time layer." },
          { value: "dropped within 1 publish cycle of catching up", explain: "How quickly a document's real-time entry is retired once the base index absorbs it." },
        ],
        breaks: {
          failure: "These documents carry no PageRank or click signal, so mixing them into one ranked list means two scoring regimes in the same top 10.",
          handled: "Real-time results are capped unless the query is news-intent, containing the inconsistency to the cases where freshness clearly matters more than ranking purity.",
        },
      },
    },
    {
      id: "e7",
      from: "retrieval",
      to: "merge",
      tier: "hot",
      step: 4,
      label: "top 20 x 1000",
      detail: {
        what: "Each leaf's twenty best hits as (doc_id, score, flags), about 40 bytes each, ~800B per shard.",
        why: "Capping k at the leaf is what keeps the network bill a function of k rather than corpus size. 1000 x 800B is ~800KB per query, and at 50k uncached QPS that is already ~40GB/s.",
        numbers: [
          { value: "~800B per shard, ~800KB per query", explain: "The compact per-shard payload and the total this arrow carries per query fleet-wide." },
          { value: "~40GB/s of intra-datacentre traffic", explain: "The aggregate bandwidth this arrow consumes at peak query volume." },
        ],
        breaks: {
          failure: "Shards that miss the deadline simply are not represented.",
          handled: "The response is flagged partial and coverage must be counted rather than assumed, which is why shard coverage is a tracked field on every response, not an inferred property.",
        },
      },
    },
    {
      id: "e8",
      from: "merge",
      to: "reranker",
      tier: "hot",
      step: 5,
      label: "global top 500",
      detail: {
        what: "The 500 surviving candidates plus their fetched ranking features, handed to the GPU tier.",
        why: "This is the boundary between bounded and unbounded scoring. Everything above it decomposes into per-term contributions with ceilings; everything below reads query and document together and cannot.",
        numbers: [
          { value: "~20ms of feature fetch before the call", explain: "The latency this stage spends assembling features before the GPU model runs." },
          { value: "depth cut to 200 under load", explain: "The degraded-mode depth used when the GPU tier is under contention." },
        ],
        breaks: {
          failure: "Feature fetch is a scatter read over 500 documents, so it inherits its own tail.",
          handled: "A slow feature store delays the reranker and there is no deadline left to absorb it, which is why feature-store latency is monitored as tightly as the reranker itself.",
        },
      },
    },
    {
      id: "e9",
      from: "reranker",
      to: "snippets",
      tier: "hot",
      step: 6,
      label: "top 10 doc ids",
      detail: {
        what: "The final ten document ids, in display order, sent for text fetch and term highlighting.",
        why: "Snippets are generated only after the ordering is final. Generating them earlier would mean paying doc-store reads for 490 documents nobody will see.",
        numbers: [{ value: "10 documents, ~40ms including reads", explain: "The final volume and latency of this last, narrowest stage of the funnel." }],
        breaks: {
          failure: "If the reranker circuit-breaks to the GBDT order this still receives ten ids and the user sees results.",
          handled: "The degradation is invisible except in the interleaving metric, so quality regressions from this fallback are caught by dedicated experimentation rather than by user complaints.",
        },
      },
    },
    {
      id: "e10",
      from: "snippets",
      to: "query-cache",
      tier: "control",
      label: "top 10, 10 min TTL",
      offset: 90,
      detail: {
        what: "The finished response written back under the same canonical key that missed on the way in.",
        why: "The TTL is the freshness knob for repeated queries. Ten minutes bounds how stale a cached answer can be while still covering the Zipf head, which is where all the savings are.",
        numbers: [
          { value: "~10 min TTL", explain: "The freshness window this write establishes for the cached answer." },
          { value: "cache hit rate SLO >= 50%", explain: "The effectiveness target this write, repeated across the Zipf head, is expected to sustain." },
        ],
        breaks: {
          failure: "Caching a response flagged partial pins a degraded answer for the whole TTL.",
          handled: "Partial responses either skip the write or get a much shorter TTL, so a temporary coverage gap does not become a ten-minute-long degraded answer for everyone.",
        },
      },
    },
    {
      id: "e11",
      from: "crawl-stream",
      to: "indexer",
      tier: "data",
      label: "~29k docs/s of text",
      detail: {
        what: "Fetched pages arriving from the crawler, boilerplate-stripped down to ~5KB of indexable text each.",
        why: "This is the seam between the two systems. The contract is a durable stream, so the indexer can restart, replay and rebuild without the crawler knowing or caring.",
        numbers: [
          { value: "2.5B docs/day, ~145MB/s of text", explain: "The daily volume and steady byte rate this stream carries into the indexer." },
          { value: "~50KB HTML in, ~5KB text out", explain: "The size reduction this pipeline achieves before content ever reaches the index build." },
        ],
        breaks: {
          failure: "A stalled stream is invisible from the serving side, since the base index keeps answering.",
          handled: "Only the crawl-to-searchable lag gauge catches it, and it pages at 15 minutes, the sole signal this specific failure mode relies on.",
        },
      },
    },
    {
      id: "e12",
      from: "indexer",
      to: "segments",
      tier: "data",
      label: "immutable segments",
      detail: {
        what: "A finished segment published to the leaf owning hash(doc_id) % 1000, which mmaps it and starts serving on a generation pointer swap.",
        why: "Publish is atomic and reversible because the unit is a whole immutable file with a generation tag. That is what makes a bad tokeniser build a seconds-long rollback rather than an incident.",
        numbers: [
          { value: "1 publish per shard per hour", explain: "The steady cadence at which new segments become available for serving." },
          { value: "canary on 1% of shards first", explain: "The staged rollout that limits blast radius before a build reaches the whole fleet." },
        ],
        breaks: {
          failure: "A corrupt or mis-tokenised segment passes checksum but changes the result-count and score distribution.",
          handled: "This is why the canary compares those distributions against the previous generation rather than trusting the checksum alone to catch a bad build.",
        },
      },
    },
    {
      id: "e13",
      from: "indexer",
      to: "rt-index",
      tier: "control",
      label: "gap since last publish",
      offset: 70,
      detail: {
        what: "Documents indexed since the last hourly segment landed, built continuously into the in-memory tier rather than waiting for the batch.",
        why: "The batch build is the right shape for 25 trillion postings and the wrong shape for a news story four minutes old. This arrow is the whole freshness story: same input, second path, much smaller.",
        numbers: [
          { value: "~104M documents per hour fleet-wide", explain: "The volume this path carries every publish cycle, feeding the small real-time tier." },
          { value: "~234MB per leaf", explain: "The resulting per-leaf memory cost, tiny compared to the base index." },
        ],
        breaks: {
          failure: "If the watermark that drops these documents on publish is wrong, the same document is served twice from two tiers with two different scores.",
          handled: "This is why watermark correctness on the real-time-to-base handoff is treated as a correctness invariant, checked directly rather than assumed from timing alone.",
        },
      },
    },
  ],
};
