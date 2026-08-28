import type { Diagram } from "./types";

export const WEB_SEARCH: Diagram = {
  id: "web-search",
  title: "Web Search",
  question: "Design a Web Search Engine",
  sourceId: "patterns",
  itemId: 47,
  overview: {
    shape:
      "One index split a thousand ways by document, built offline into immutable segments, and queried by asking every shard at once and merging their twenty best answers inside a hard deadline.",
    beats: [
      "Acquisition is not this system's problem. A durable stream of fetched pages arrives from the crawler (question 6), roughly 29k documents a second, and everything upstream of that stream, politeness, dedup, traps, belongs to a different design with different constraints.",
      "Index building is an offline batch job, never a write against a serving node. Tokenise, emit (term, doc_id, positions, field), shuffle by term, sort by doc id, delta and varbyte encode, and write an immutable generation-tagged segment. Publishing is a pointer swap and a bad build rolls back in seconds.",
      "The index is split by document, not by term. Each of ~1000 leaves owns ~50M documents and the complete index for them, so a query is answered locally and only ~800 bytes crosses the network. Term partitioning would have to move the smallest posting list, ~180MB, per query: ~9TB/s at 50k uncached QPS, a number that ends the design rather than one you engineer around.",
      "The query path is a cache, a fan-out and a merge. The result cache absorbs ~50% of traffic because query popularity is Zipf. What misses goes through a root and ~30 mid-tier mergers to all 1000 leaves under a 40ms hard deadline, and the root returns once 99% of shards have answered.",
      "Retrieval and ranking then split by cost profile. A cheap bounded scorer at the leaf prunes a ~750k union to ~5k scored documents and emits 20; an expensive cross-encoder reorders only the top 500 centrally on a GPU. Retrieval is cheap per document over billions so it is pushed down, ranking is expensive per document over hundreds so it is pulled up.",
      "The budget is the thing to put on the board: cache lookup ~2ms, fan-out and leaf retrieval ~40ms behind the deadline with hedging at ~12ms, merge tree ~10ms, feature fetch ~20ms, cross-encoder ~50ms, snippets ~40ms, egress ~15ms. About 180ms against a 300ms SLO, and the remaining 120ms absorbs the tail rather than funding growth.",
    ],
    crux:
      "You have to bound the work of one query twice, and the second bound is fragile. Partitioning caps how much index a machine looks at; early termination caps how many matches it actually scores. But early termination is only rank-safe while the score is a sum of per-term contributions with known ceilings, which is precisely why the expensive model has to sit above retrieval and score a candidate set someone else produced.",
    numbers: [
      "~1000 shards x ~50M docs, ~165TB per index copy",
      "750k union, 5k scored, 20 per leaf, 500 reranked, 10 shown",
      "40ms leaf deadline, ~180ms of a 300ms p99 budget",
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
        numbers: ["~50M docs and ~165GB of index per shard", "~800B of results on the wire per shard", "~25 replicas per shard, ~25,000 leaves"],
        breaks:
          "Every machine works on every uncached query, so p99 is the maximum of 1000 draws and capacity scales with QPS x shards rather than QPS.",
        choice: {
          pick: "Partition the index by document, ~1000 shards, complete local index",
          instead: "Partition by term, so a three-word query wakes three machines instead of a thousand.",
          decider:
            "Cross-shard posting-list transfer against fan-out tail. Term partitioning must move a list per query; the cheapest for `coffee shops brooklyn` is `shops` at ~90M postings x 2B = ~180MB, and at 50k uncached QPS that is ~9TB/s of bisection bandwidth. Fan-out's cost is a tail you can cap with a deadline at ~5% extra fleet load. One is unbuildable, the other is a line item.",
          flips:
            "When the largest list you would move stays under ~1MB and shard count is low: a ~10M-document corpus over ~10 shards, or a workload of single-term SKU and product-code lookups where there is nothing to intersect.",
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
        numbers: ["~5ms on a cache hit", "100k QPS peak, ~33k/s average", "~2.9B queries/day"],
        breaks:
          "Over-eager normalisation answers a different question: stemming a product code or spell-correcting a surname loses the one token the user cared about.",
        choice: {
          pick: "Normalise and key the query once, before any fan-out",
          instead: "Ship the raw query to the leaves and let each one normalise it.",
          decider:
            "Duplicated work and a missing cache key. Normalising at the leaf repeats identical work 1000 times per query, and worse there is no canonical key, so nothing is reusable across the ~50% of traffic that repeats and the serving fleet roughly doubles.",
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
        numbers: ["hit rate SLO >= 50%", "one point ~= 1M leaf RPCs/s ~= 500 machines", "~10 min TTL"],
        breaks:
          "Cache-key cardinality. Adding user identity takes the key space from millions of queries to billions of query-user pairs, the hit rate falls toward zero and the serving fleet roughly doubles.",
        choice: {
          pick: "Redis keyed on query, locale and a coarse personalisation bucket",
          instead: "A per-user cache key, or no result cache at all.",
          decider:
            "Hit rate priced in machines. Coarse buckets hold the rate above 50%; per-user keys drive it to nearly zero, and since every point is worth ~500 machines a five-point drop is a capacity incident rather than a performance curiosity.",
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
        why: "One root socket cannot issue 1000 RPCs and collect 1000 responses inside a 50ms budget, and ~800KB fanned in per query at 50k uncached QPS is ~40GB/s, which saturates a NIC long before the CPU.",
        numbers: ["~30 mergers, ~33 leaves each", "~800KB fanned in per query", "hedge rate SLO <= 8%"],
        breaks:
          "A mid-tier merger dying mid-query silently loses ~33 shards, so shard coverage has to be counted per response rather than assumed.",
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
      col: 0,
      row: 2,
      parent: "leaf-group",
      detail: {
        what: "The process that answers locally: an FST lookup per term, cursors opened over the base segments and the real-time tier, and one top-20 heap for the shard.",
        why: "64 cores at ~30ms of CPU per query gives ~2k QPS per leaf, and that single figure sets the replica count for the whole fleet. Every decision inside the leaf is made against that 30ms.",
        numbers: ["~2k QPS per leaf, ~30ms CPU per query", "~2B distinct terms in a ~40GB FST", "~200GB of resident postings per leaf"],
        breaks:
          "Cold posting lists on rare terms turn a 5ms leaf query into a 50ms NVMe-bound one, and long-tail queries are exactly the ones the result cache cannot help with.",
        choice: {
          pick: "FST term dictionary, memory-resident, one per segment",
          instead: "A hash map from term to offset, or an on-disk B-tree.",
          decider:
            "Resident bytes. ~2B distinct terms is far too much as raw strings beside 200GB of postings; an FST shares prefixes and suffixes and holds the same map in ~40GB with the term-level doc_freq and max_score inline, which is what early termination needs before it touches a posting.",
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
      col: 0,
      row: 3,
      parent: "leaf-group",
      detail: {
        what: "Disjunctive retrieval with early termination: a score ceiling per term and per 128-posting block, a running theta equal to the 20th-best score, and any document or block that provably cannot reach theta is skipped unread.",
        why: "The union of the three terms in one shard is ~750k documents, and scoring one is a random read into the doc-metadata block at ~175ns, so ~130ms of CPU against a ~30ms budget. This scores ~5k instead, about 150x less work, and provably returns the same top 20.",
        numbers: ["~750k union, ~5k scored, ~1ms", "ceiling per 128-posting block", "~175ns per scored document"],
        breaks:
          "Pruning collapses on phrase-heavy queries, because position verification happens after a document is admitted so the retrieval bound is the loose bag-of-words one, and on terms whose score distribution is flat, where the ceiling never falls below theta.",
        choice: {
          pick: "Disjunctive scoring with block-max WAND, MaxScore on short queries",
          instead: "Strict conjunctive intersection: walk the cursors in lockstep and score only documents containing every term.",
          decider:
            "Union size against the CPU budget, and whether AND is the semantics you want. Intersection is genuinely cheap, ~1ms for the ~5k documents holding all three terms, but it drops a heavily linked page titled 'Brooklyn Coffee' that says cafes rather than shops, and on a six-term query drops nearly everything. Exhaustive disjunctive scoring is ~4x over budget and would need ~100,000 leaves instead of ~25,000.",
          flips:
            "When AND is correct rather than a compromise: code search, log search and legal discovery, where a missing term is a wrong answer. Also when the union is under ~100k documents per shard, which covers most enterprise and site search.",
        },
      },
    },
    {
      id: "crawl-stream",
      label: "Crawl stream (#6)",
      sub: "fetched pages, Kafka",
      kind: "external",
      col: 1,
      row: 1,
      detail: {
        what: "The input contract: a durable stream of fetched pages produced by the crawler. Acquisition, politeness, traps and URL dedup all live in question 6, not here.",
        why: "It is one box on purpose. This design owns indexing and serving; drawing the crawler would import a completely different set of constraints (per-host rate limits, robots, frontier scheduling) that change none of the decisions below it.",
        numbers: ["~5% of the corpus changes per day", "2.5B docs/day, ~29k docs/s", "~50KB HTML in, ~5KB text out"],
        breaks:
          "If the stream stalls, breaking content silently stops appearing. The base index keeps serving everything older, so only the crawl-to-searchable lag gauge shows it, which is why that gauge pages at 15 minutes.",
      },
    },
    {
      id: "indexer",
      label: "Index build",
      sub: "Spark shuffle, hourly segments",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "An offline batch job: strip boilerplate, tokenise, emit (term, doc_id, positions, field), shuffle by term, sort each list by doc id, delta and varbyte encode, write a segment.",
        why: "Sorting by term is a global operation, so you want to pay for it once per segment rather than once per document. Nothing here is synchronous with serving, which is what makes a bad build recoverable rather than an outage.",
        numbers: ["~29k docs/s, ~145MB/s of extracted text", "~65MB/s of new postings", "hourly incremental, base rebuild every 2-3 days"],
        breaks:
          "A full base rebuild over 165TB takes days, so the base index is always somewhat stale and rebuilds must be staggered per shard or the fleet all rebuilds at once.",
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
      col: 1,
      row: 3,
      detail: {
        what: "Generation-tagged segment files on local NVMe, mmapped, with the canonical copy in object storage. Each holds the FST dictionary, the posting blocks, a columnar doc-metadata block, and a delete bitmap.",
        why: "Nothing is ever mutated in place. Publishing is a pointer swap, a deletion is a bit in an overlay, and readers need no locks against writers. The delete bitmap is the only mutable structure a leaf owns.",
        numbers: ["~2B per non-positional posting, ~4.5B positional", "~165TB per full index copy, ~1PB at RF=3", "~32B of metadata per document"],
        breaks:
          "Compaction rewrites the same postings repeatedly and competes with serving for NVMe bandwidth; throttle it and query cost grows roughly linearly in segment count instead.",
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
      col: 1,
      row: 4,
      detail: {
        what: "A small in-memory inverted index per leaf holding everything indexed since the last hourly segment publish, unioned with the base segments before the local top-k.",
        why: "Rebuilding 165TB takes days and a story published four minutes ago cannot wait for that. The tier only ever has to cover the gap since the last publish, which is one hour of crawl.",
        numbers: ["~104M docs fleet-wide per hour", "~234MB per leaf", "crawl-to-searchable p95 <= 5 min"],
        breaks:
          "These documents have no PageRank, because the link graph has not seen them, and no click data, because nobody has clicked them. The two tiers therefore score by different functions permanently, and a page's rank shifts when it graduates into the base index.",
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
      col: 0,
      row: 4,
      detail: {
        what: "The fan-in: 1000 x 20 candidates collapsed into one global ordering, then a tier-2 gradient-boosted ranker over ~200 features cuts that to 500.",
        why: "Leaf scores are directly comparable, because every shard runs the same scoring function over a hash-uniform slice of the corpus, so the merge is a k-way heap rather than a rescore. The GBDT is where signals that need the whole candidate set can finally be applied.",
        numbers: ["20,000 in, 500 out", "~10ms at p99", "coverage SLO: 99.9% of queries reach >= 99% of shards"],
        breaks:
          "If shards answer from different segment generations the merge silently mixes two scoring regimes, so the ordering is wrong rather than late, which no latency alarm will catch.",
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
      col: 0,
      row: 5,
      detail: {
        what: "A transformer that reads the query and each document together and reorders the top 500. The most expensive component per document anywhere in the system.",
        why: "It structurally cannot participate in retrieval: it produces no per-term score ceiling, so it would break the rank-safety that early termination rests on. The funnel is forced by what can and cannot be bounded, not chosen as a cost optimisation.",
        numbers: ["500 documents reranked, 10 shown", "~50ms GPU batch at p99", "0.1% permanent no-rerank holdback"],
        breaks:
          "GPUs are the scarcest resource, so a traffic spike hits this tier first. You cut depth from 500 to 200 and circuit-break to the GBDT order, which is a quality cliff exactly when traffic is highest.",
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
      row: 6,
      detail: {
        what: "Fetches URL, title and extracted text for the ten winners from the document store and highlights the matched terms.",
        why: "This is the only component that touches raw document text, which is why the doc store is deliberately off the retrieval path. Reading ~85TB of text to decide ranking would be absurd; reading it for ten results is ~40ms.",
        numbers: ["~40ms at p99 including doc-store reads", "~85TB gzipped doc store, ~255TB at RF=3", "10 of 20,000 candidates need one"],
        breaks:
          "A failed snippet fetch must degrade to a cached or meta-description snippet. Dropping the result instead is strictly worse: a result with a poor snippet beats a missing result.",
        choice: {
          pick: "A separate document store, read only for the final 10",
          instead: "Carry the document text alongside the postings so leaves can build snippets locally.",
          decider:
            "Bytes kept where they are not needed. Text is ~85TB against ~165TB of index, and building snippets at the leaf means all 1000 shards touch text for candidates that will never be shown, when only 10 of 20,000 ever need one.",
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
      label: "normalised key probe",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A lookup on sha1(normalised query | locale | personalisation bucket) before any fan-out happens.",
        why: "Query popularity is Zipf, so a small head of queries covers about half of all traffic. This probe is the difference between 100M leaf RPCs/s and 50M.",
        numbers: ["~50-60% of traffic answered here", "~5ms end to end on a hit"],
        breaks:
          "A cold cache after a deploy doubles leaf QPS instantly, so the fleet has to be provisioned for a stated miss headroom and the cache warmed from the head-query list rather than cold-started.",
      },
    },
    {
      id: "e2",
      from: "query-service",
      to: "fanout",
      label: "cache miss",
      animated: true,
      detail: {
        what: "The normalised term list, filters and locale for a query the cache could not answer.",
        why: "Everything below this arrow costs ~1000 machine-visits, which is why so much design effort sits above it. Roughly half of peak traffic crosses it, about 50k QPS.",
        numbers: ["~50k uncached QPS at peak"],
        breaks:
          "Long-tail queries dominate here by definition, and they are the ones with cold posting lists, so the miss path has a systematically worse latency distribution than the hit path.",
      },
    },
    {
      id: "e3",
      from: "fanout",
      to: "leaf",
      label: "1000 leaf RPCs, 40ms",
      animated: true,
      detail: {
        what: "The same query broadcast to every shard: terms, filters, k=20 and a deadline_ms of 40.",
        why: "Document partitioning means relevance can be anywhere, so there is no subset of shards you could ask instead. The deadline travels with the request so the leaf, not the caller, enforces it.",
        numbers: ["k=20 per leaf", "deadline 40ms, hedge at the p95"],
        breaks:
          "This is the fan-out tax: capacity scales with QPS x shards. At 50M leaf RPCs/s and ~2k QPS per leaf you need ~25,000 machines, so any per-query cost here is multiplied a thousandfold.",
      },
    },
    {
      id: "e4",
      from: "leaf",
      to: "retrieval",
      label: "term to posting lists",
      animated: true,
      detail: {
        what: "One FST lookup per term, yielding a posting-list offset plus that term's doc_freq and max_score, handed to the retrieval loop as cursors.",
        why: "The max_score comes out of the dictionary rather than the postings on purpose: early termination needs each term's ceiling before it decodes a single posting, and the cursors are sorted by it.",
        numbers: ["3 cursors for a three-word query", "~500k, ~200k, ~90k postings locally"],
        breaks:
          "A term missing from the dictionary is a zero-length list, not an error, so a tokeniser mismatch between build and query time degrades recall silently.",
      },
    },
    {
      id: "e5",
      from: "segments",
      to: "retrieval",
      label: "mmapped postings",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Posting blocks and doc-metadata reads served straight out of the page cache over mmapped segment files.",
        why: "Postings are the overwhelming majority of the 165TB, so bytes decoded per query is the latency variable. Gap plus varbyte encoding means a term in 500k of 50M documents needs one or two bytes per posting, and SIMD decodes billions per second.",
        numbers: ["~2B per posting non-positional", "skip entry every 128 postings"],
        breaks:
          "A block not resident is an NVMe read in the middle of the scoring loop, which is how a 5ms query becomes a 50ms one on rare terms.",
      },
    },
    {
      id: "e6",
      from: "rt-index",
      to: "leaf",
      label: "last hour, in memory",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The documents indexed since the last hourly publish, unioned with the base cursors before the leaf's local top-20 is taken.",
        why: "Freshness is additive rather than a separate query path, so a failure of this tier degrades freshness only and never correctness. A watermark drops the tier when the segment covering it lands.",
        numbers: ["~234MB per leaf", "dropped by watermark on publish"],
        breaks:
          "These documents carry no PageRank or click signal, so mixing them into one ranked list means two scoring regimes in the same top 10, which is why real-time results are capped unless the query is news-intent.",
      },
    },
    {
      id: "e7",
      from: "retrieval",
      to: "merge",
      label: "top 20 x 1000",
      animated: true,
      detail: {
        what: "Each leaf's twenty best hits as (doc_id, score, flags), about 40 bytes each, ~800B per shard.",
        why: "Capping k at the leaf is what keeps the network bill a function of k rather than corpus size. 1000 x 800B is ~800KB per query, and at 50k uncached QPS that is already ~40GB/s.",
        numbers: ["~800B per shard, ~800KB per query", "~40GB/s of intra-datacentre traffic"],
        breaks:
          "Shards that miss the deadline simply are not represented, so the response is flagged partial and coverage must be counted rather than assumed.",
      },
    },
    {
      id: "e8",
      from: "merge",
      to: "reranker",
      label: "global top 500",
      detail: {
        what: "The 500 surviving candidates plus their fetched ranking features, handed to the GPU tier.",
        why: "This is the boundary between bounded and unbounded scoring. Everything above it decomposes into per-term contributions with ceilings; everything below reads query and document together and cannot.",
        numbers: ["~20ms of feature fetch before the call", "depth cut to 200 under load"],
        breaks:
          "Feature fetch is a scatter read over 500 documents, so it inherits its own tail; a slow feature store delays the reranker and there is no deadline left to absorb it.",
      },
    },
    {
      id: "e9",
      from: "reranker",
      to: "snippets",
      label: "top 10 doc ids",
      detail: {
        what: "The final ten document ids, in display order, sent for text fetch and term highlighting.",
        why: "Snippets are generated only after the ordering is final. Generating them earlier would mean paying doc-store reads for 490 documents nobody will see.",
        numbers: ["10 documents, ~40ms including reads"],
        breaks:
          "If the reranker circuit-breaks to the GBDT order this still receives ten ids and the user sees results, so the degradation is invisible except in the interleaving metric.",
      },
    },
    {
      id: "e10",
      from: "snippets",
      to: "query-cache",
      label: "top 10, 10 min TTL",
      dashed: true,
      offset: 90,
      fromSide: "right",
      toSide: "right",
      detail: {
        what: "The finished response written back under the same canonical key that missed on the way in.",
        why: "The TTL is the freshness knob for repeated queries: ten minutes bounds how stale a cached answer can be while still covering the Zipf head, which is where all the savings are.",
        numbers: ["~10 min TTL", "cache hit rate SLO >= 50%"],
        breaks:
          "Caching a response flagged partial pins a degraded answer for the whole TTL, so partial responses either skip the write or get a much shorter TTL.",
      },
    },
    {
      id: "e11",
      from: "crawl-stream",
      to: "indexer",
      label: "~29k docs/s of text",
      detail: {
        what: "Fetched pages arriving from the crawler, boilerplate-stripped down to ~5KB of indexable text each.",
        why: "This is the seam between the two systems. The contract is a durable stream, so the indexer can restart, replay and rebuild without the crawler knowing or caring.",
        numbers: ["2.5B docs/day, ~145MB/s of text", "~50KB HTML in, ~5KB text out"],
        breaks:
          "A stalled stream is invisible from the serving side, since the base index keeps answering. Only the crawl-to-searchable lag gauge catches it, and it pages at 15 minutes.",
      },
    },
    {
      id: "e12",
      from: "indexer",
      to: "segments",
      label: "immutable segments",
      detail: {
        what: "A finished segment published to the leaf owning hash(doc_id) % 1000, which mmaps it and starts serving on a generation pointer swap.",
        why: "Publish is atomic and reversible because the unit is a whole immutable file with a generation tag. That is what makes a bad tokeniser build a seconds-long rollback rather than an incident.",
        numbers: ["hourly incremental publish per shard", "canary on 1% of shards first"],
        breaks:
          "A corrupt or mis-tokenised segment passes checksum but changes the result-count and score distribution, which is why the canary compares those against the previous generation rather than trusting the checksum.",
      },
    },
    {
      id: "e13",
      from: "indexer",
      to: "rt-index",
      label: "gap since last publish",
      dashed: true,
      offset: 70,
      fromSide: "right",
      toSide: "right",
      detail: {
        what: "Documents indexed since the last hourly segment landed, built continuously into the in-memory tier rather than waiting for the batch.",
        why: "The batch build is the right shape for 25 trillion postings and the wrong shape for a news story four minutes old. This arrow is the whole freshness story: same input, second path, much smaller.",
        numbers: ["~104M documents per hour fleet-wide", "~234MB per leaf"],
        breaks:
          "If the watermark that drops these documents on publish is wrong, the same document is served twice from two tiers with two different scores.",
      },
    },
  ],
};
