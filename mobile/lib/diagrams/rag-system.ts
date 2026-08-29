import type { Diagram } from "./types";

export const RAG_SYSTEM: Diagram = {
  id: "rag-system",
  title: "RAG System",
  question: "Design a RAG System (Retrieval-Augmented Generation)",
  sourceId: "patterns",
  itemId: 50,
  overview: {
    shape:
      "Two systems that meet only at three indexes: a continuous ingest pipeline that chunks and embeds 50M documents, and a request path that narrows 500M chunks down to the 8 passages a model is allowed to read.",
    beats: [
      "Ingest is a pipeline, not a request path. Connectors take webhooks where a source offers them and poll from a watermark where it does not, a parser normalises to text, and the chunker splits on structural boundaries into roughly 512-token pieces with 64 tokens of overlap.",
      "Chunk size is the parameter everything downstream inherits. At 128 tokens the retrieval metric looks wonderful and the chunk that says 26 weeks never says what the 26 weeks are for; at 2,000 tokens the embedding is an average of six unrelated ideas and four chunks exhaust the token budget. Measure recall and faithfulness together, per source type.",
      "Every chunk is hashed, so a one-paragraph edit re-embeds one chunk rather than eleven, and roughly 70% of the 10M chunks touched daily are skipped outright. Chunks land in two indexes because dense and lexical fail on disjoint queries: an embedding cannot find JOB-4471, and BM25 cannot find a paraphrase.",
      "A query resolves the caller to ACL group IDs, embeds the question with the same model used at ingest, and runs ANN and BM25 in parallel with the permission predicate evaluated inside each search. Post-filtering collapses top-k for exactly the users with least access: a contractor who can read 0.5% of the corpus retrieves 100 and keeps 0.",
      "Reciprocal rank fusion merges the two ranked lists on rank alone, the cross-encoder rescores the top 100 by reading question and chunk jointly, and assembly dedupes, drops expired chunks and keeps the top 8 with the strongest at both ends of the prompt. Below the abstention floor the system says so instead of inventing an answer.",
      "Generation is one box here and belongs to question 46. It costs an order of magnitude more than everything else combined, but it cannot rescue a bad context: the whole design spends its complexity upstream of that box, and the evaluation harness in CI is what tells you whether any of it helped.",
    ],
    crux:
      "Retrieval quality bounds answer quality, and the failure is silent. When the retriever hands over the wrong chunks the model writes a fluent, correctly cited, wrong answer, nothing in the dashboards goes red, and the user reports it as the AI being unreliable rather than as a retrieval bug.",
    numbers: [
      "500M chunks, ~635GB resident at int8, 6 shards",
      "retrieve + rerank ~180ms of a ~1.2s TTFT",
      "recall@10 >= 0.90, faithfulness >= 0.95",
    ],
  },
  nodes: [
    {
      id: "ingest-zone",
      label: "Ingest pipeline (continuous)",
      kind: "zone",
      detail: {
        what: "The write path: connectors, parsing and chunking, and the embedding fleet, all running independently of any query.",
        why: "Ingest and serving share nothing but the three indexes. Keeping the boundary at the index means a bulk backfill of 10M chunks cannot slow a query, and a query storm cannot delay an edit becoming searchable.",
        numbers: ["~1M documents change per day", "edit to searchable p50 ~90s"],
        breaks:
          "A bulk import of a new source starves the incremental lane, so ordinary edits stop appearing while every dashboard still reads healthy. It needs two priority classes and a hard cap on backfill rate.",
      },
    },
    {
      id: "connectors",
      label: "Connectors + CDC",
      sub: "webhook or watermark poll",
      kind: "service",
      col: 0,
      row: 0,
      parent: "ingest-zone",
      detail: {
        what: "One adapter per source system (Confluence, Jira, GitHub, Drive, an S3 bucket of PDFs), each holding a watermark or delta token.",
        why: "The corpus is 50M documents and roughly 2% of it changes daily. Re-crawling everything nightly is 50x the work for the same result, so each connector fetches only what changed since its last run.",
        numbers: ["~1M docs/day changed", "staleness SLO p95 < 5 min for webhooks"],
        breaks:
          "A webhook that silently stops leaves a source frozen at an old version, and it is invisible in every other metric: queries succeed, latency is fine, and the answers are quietly a month old.",
        choice: {
          pick: "Webhooks where offered, watermark polling as backstop, weekly full reconciliation sweep",
          instead: "A nightly full crawl of every source.",
          decider:
            "Freshness against work. The requirement is edit-to-searchable p50 under 2 minutes, which a nightly crawl misses by 12 hours, and re-reading 50M documents to find the 1M that changed is 50x the parse cost. The weekly sweep exists only because deletions are the one event webhooks lose, and a deleted document that stays searchable is a security incident.",
          flips: "A corpus that changes rarely and tolerates overnight freshness, where one scheduled crawl removes an entire class of cursor and watermark bugs.",
        },
      },
    },
    {
      id: "chunker",
      label: "Parser + chunker",
      sub: "512 tok, 64 overlap, per source",
      kind: "service",
      col: 0,
      row: 1,
      parent: "ingest-zone",
      detail: {
        what: "Normalises each document to text and splits it into chunks on structural boundaries, emitting (doc_id, ordinal, text, heading_path, char_span).",
        why: "This is the most consequential and most underrated component in the system, because the chunk is the unit that gets retrieved, reranked and read. Every metric downstream is measured on boundaries this stage chose.",
        numbers: ["~512 tokens, 64 overlap, stride 448", "5,000-token doc yields ~12 chunks", "blended ~10 chunks/doc"],
        breaks:
          "Fixed-size splitting cuts a leave-entitlement table across two chunks, so neither holds both the country column and the weeks column, and no reranker downstream can repair that.",
        choice: {
          pick: "~512 tokens with 64 overlap, split on structure, set per source type",
          instead: "Uniform ~128-token chunks, which raise retrieval precision because each chunk is about one thing.",
          decider:
            "Whether the retrieved chunk carries enough context to answer from alone. 128-token chunks win recall@10 and lose the product: the chunk containing '26 weeks' retrieves beautifully and never says what the 26 weeks are for. Sweep both curves on the labelled set; they peak at different sizes and only faithfulness is the product.",
          flips: "Dense reference material where every paragraph is self-contained, such as an API reference or a glossary. Code goes the other way: function boundaries are the natural unit and are often well past 512 tokens.",
        },
      },
    },
    {
      id: "embed",
      label: "Embedding workers",
      sub: "1024-d, skip unchanged hashes",
      kind: "service",
      col: 0,
      row: 2,
      parent: "ingest-zone",
      detail: {
        what: "The GPU fleet that turns changed chunks into 1024-dimensional vectors, keyed by chunk hash so unchanged text is never re-embedded.",
        why: "The same model must embed both documents and queries, because vectors from two models are points in unrelated spaces. That constraint is why the model version is part of shard identity and why an upgrade is a migration rather than a config change.",
        numbers: ["~10M chunks touched/day, ~70% hash-skipped", "~3M re-embeds/day, ~35/s average", "full re-index ~460 GPU-hours"],
        breaks:
          "A model upgrade has no incremental path. A v2 query against a v1 shard returns noise that looks exactly like results, so the cutover is atomic behind a version flag with both indexes resident at ~1.3TB.",
        choice: {
          pick: "Content-hash idempotency, embed only changed chunks",
          instead: "Re-embed the whole document on any change.",
          decider:
            "Wasted GPU. A typo fix on a 12-chunk page re-embeds 1 chunk rather than 12, and across ~10M chunks touched daily the hash skips ~70% of them, leaving ~3M real embeds. The same hash doubles as the idempotency key, so a replayed CDC event costs nothing.",
          flips: "Sources whose documents are small enough that a document is a single chunk, such as tickets, where hashing per chunk buys nothing over hashing the document.",
        },
      },
    },
    {
      id: "chunk-store",
      label: "Chunk + document store",
      sub: "~3.6TB at RF=3",
      kind: "database",
      col: 1,
      row: 3,
      detail: {
        what: "The text of every chunk plus its heading path, char span, effective dates and ACL group IDs, keyed by (doc_id, ordinal).",
        why: "The indexes hold vectors and postings, not prose, so the words that eventually reach the prompt have to come from somewhere. Keeping the ACL groups here as well is what makes a permission change a metadata upsert on 12 rows instead of a re-embed.",
        numbers: ["~2.4KB per chunk record", "500M chunks, ~1.2TB, ~3.6TB at RF=3", "~150k text reads/s at peak"],
        breaks:
          "Fetching 300 chunk texts per query at 500 q/s is 150k reads/s of fan-out, and a slow tail here lands directly in the rerank window rather than being amortised anywhere.",
        choice: {
          pick: "Object store plus manifest, with an LRU keyed on chunk_id in front",
          instead: "Storing the full chunk text inline as an index payload.",
          decider:
            "Index RAM against fan-out. Inlining 2KB of text on 500M entries adds ~1TB to memory that is already at ~635GB, so only the small rerank-window fields go inline. Access is heavily Zipfian, so a modest LRU absorbs ~80% of the 150k reads/s without buying that memory.",
          flips: "A corpus small enough that the whole text fits alongside the vectors, where inlining removes a network hop from the hot path for free.",
        },
      },
    },
    {
      id: "lexical-index",
      label: "Lexical index (BM25)",
      sub: "inverted index, see #47",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "A classic inverted index over the same chunks, carrying the same filterable payload of ACL groups, effective dates and source type.",
        why: "Embeddings encode topic, and they compress away exactly the low-magnitude signals that identifiers are made of. This arm exists to catch error codes, ticket IDs, product names and acronyms the embedding model has effectively never seen.",
        numbers: ["top 200 per query, ~30ms p95", "sharded by hash(doc_id), same as the vector index"],
        breaks:
          "It has the opposite blind spot: a paraphrased question with no shared vocabulary returns nothing useful, which is why neither arm is allowed to run alone.",
        choice: {
          pick: "Keep a second, lexical index and fuse the two rankings",
          instead: "Dense retrieval only, on the grounds that a good embedding subsumes keyword matching.",
          decider:
            "The queries dense retrieval cannot answer at all. 'Why is JOB-4471 retrying' returns generic chunks about retry policy from the vector index and the exact ticket at rank 1 from BM25. A second index doubles query fan-out and roughly 25% of enterprise questions contain an identifier, so the arm pays for itself.",
          flips: "A prose-only corpus with no identifiers, IDs or rare tokens, where the lexical arm contributes almost nothing and the extra index is pure operational cost.",
        },
      },
    },
    {
      id: "vector-index",
      label: "Vector index (HNSW)",
      sub: "500M x int8, 6 shards, RF=3",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "A layered navigable-small-world graph over 500M scalar-quantised vectors, each node wired to ~32 neighbours, with ACL groups and effective dates as a filterable payload.",
        why: "Approximate search is the only way to touch 500M vectors in 25ms, and the payload has to live in the index rather than beside it, because the permission predicate must be evaluated during the graph walk rather than after it.",
        numbers: ["int8: 1KB/vector, ~500GB", "graph overhead ~270B/node, ~135GB", "~635GB resident, 6 shards at ~83M vectors", "recall@100 ~0.96"],
        breaks:
          "A highly selective ACL predicate makes the greedy walk spend its efSearch budget on nodes it must reject, so recall collapses for exactly the users with least access. Below ~10k allowed chunks, skip the graph and brute-force scan in ~3ms.",
        choice: {
          pick: "HNSW with int8 vectors, 6 shards, RF=3, ~635GB resident",
          instead: "IVF-PQ, which clusters and stores compressed residuals, fitting the same 500M chunks in ~32GB on 3 nodes.",
          decider:
            "Recall against RAM you are willing to buy. HNSW at int8 holds recall@100 near 0.96; IVF-PQ at m=64 lands near 0.85. That is 11 points of recall for roughly 600GB, and 15 questions in 100 silently missing their best chunk is not a policy-lookup product. fp32 would need 17 shards for about one point.",
          flips: "Past roughly 2B chunks, where HNSW stops fitting any affordable fleet, or when queries are broad and many answers are acceptable, which is the recommender case in question 28.",
        },
      },
    },
    {
      id: "query-api",
      label: "Query API",
      sub: "embed question, semantic cache",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "The request entry point: resolves the caller to ACL group IDs from a Redis cache (60s TTL), embeds the question with the ingest-time model, checks the cache, and streams the answer back.",
        why: "The query has to be embedded by the same model that embedded the corpus, so this stage is coupled to the index version rather than free to upgrade. It also owns the cheapest win available: deflecting repeat questions before they reach a 220-accelerator generation tier. ACL resolution runs first, as stage 0, because retrieval needs the predicate at search time rather than at result time, and an unresolvable principal fails the query closed.",
        numbers: [
          "500 q/s peak, ~15M queries/day",
          "query embed ~15ms p95",
          "~15% semantic-cache deflection",
          "ACL resolve ~2ms p95, revocation effective within 60s",
        ],
        breaks:
          "Semantic caching is the easiest way to ship a wrong answer: '2024 bonus policy' and '2025 bonus policy' sit at cosine ~0.98, as do 'can I expense alcohol' and 'can I not expense alcohol'. And if the ACL resolver is unavailable the system must fail closed and refuse the query, since falling back to unfiltered retrieval is a cross-ACL leak.",
        choice: {
          pick: "Exact cache always, semantic cache above cosine ~0.97, partitioned by hash(sorted(group_ids))",
          instead: "A single semantic cache keyed on the query vector alone.",
          decider:
            "Whether a false hit can also be a permission leak. Sharing one entry across ACL group sets makes the cache a bypass, so partitioning is not optional. ~15% deflection off ~220 accelerators saves ~33 of them, more than the entire reranker fleet, which is why it is worth the mitigations: 15-minute TTL and mandatory bypass on years, numbers, negations and proper nouns.",
          flips: "A corpus where answers change constantly or every user has a distinct group set, where hit rate collapses and the cache is pure risk for no saving.",
        },
      },
    },
    {
      id: "hybrid",
      label: "Hybrid retrieval + RRF",
      sub: "200 + 200 fused to ~300",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "Fans the query out to the ANN and BM25 arms in parallel, both carrying the ACL predicate, then merges the two ranked lists into roughly 300 unique candidates.",
        why: "The two retrievers fail on disjoint query types, and merging two cheap rankings beats tuning one expensive one. Running them in parallel means the wall cost is the slower arm, about 30ms, not the sum.",
        numbers: ["200 from each arm, ~300 unique after merge", "ANN ~25ms, BM25 ~30ms, run in parallel", "RRF merge ~3ms"],
        breaks:
          "If one vector shard is unreachable, scatter-gather returns 5/6 of the corpus and the answer looks complete. Degrade to BM25-only with the response flagged rather than silently answering from a partial index.",
        choice: {
          pick: "Reciprocal rank fusion, score = sum of 1/(60 + rank)",
          instead: "A weighted sum of the normalised scores, alpha times dense plus (1 - alpha) times BM25.",
          decider:
            "That the two scores are not comparable. Cosine lives in [-1, 1] with a corpus-dependent distribution and BM25 is unbounded, so alpha needs per-corpus tuning and breaks when the mix shifts. RRF uses ranks only: rank 1 and 40 scores 1/61 + 1/100 = 0.0264, while rank 8 in both scores 2/68 = 0.0294 and wins. Agreement beats one spectacular rank, with no weight to tune.",
          flips: "When you have enough labelled data to train a proper learned fusion model, which beats both, and the traffic to keep it retrained as the corpus drifts.",
        },
      },
    },
    {
      id: "reranker",
      label: "Cross-encoder reranker",
      sub: "top 100 pairs, ~90ms",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "Runs the question and one chunk through a single transformer together, so every query token attends to every chunk token, and rescores the top 100 candidates.",
        why: "This is the only stage that separates 'about this topic' from 'answers this question'. A dot product between two independently computed vectors cannot make that distinction, which is precisely the failure that produces a fluent, wrong answer.",
        numbers: ["50,000 pairs/s at peak", "~132 GFLOPs per pair, ~30 accelerators", "~90ms p95, the most expensive retrieval step"],
        breaks:
          "It sits directly in the latency path, so a traffic spike queues and TTFT breaches the SLO. Adaptive depth 100 to 50 to 25 costs about a point of recall@8 instead of seconds, but it must be logged and alertable, never a silent fallback.",
        choice: {
          pick: "A ~110M-parameter cross-encoder over the top 100 candidates",
          instead: "Trusting the fused bi-encoder ranking, or reranking a much deeper candidate set.",
          decider:
            "Cost per candidate against candidate count. Joint scoring is roughly 1000x more expensive per pair than a dot product, which is exactly why it runs on 100 and not 500M. Going deeper than 100 multiplies a 6.6 PFLOP/s fleet for recall gains the top 8 will never see.",
          flips: "An inline suggestion surface with a sub-100ms budget, where there is no room for a rerank pass at all and you live with bi-encoder ordering and a much smaller k.",
        },
      },
    },
    {
      id: "assembler",
      label: "Context assembly",
      sub: "dedupe, dates, top 8, abstain",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "Drops near-duplicates and expired chunks, applies the recency prior, keeps the best 8, orders them strongest at both ends of the prompt, and decides whether to answer at all.",
        why: "More context makes answers worse: going from 5 chunks to 20 reliably lowers faithfulness, because each irrelevant chunk is one more thing a wrong sentence can plausibly be grounded in. This stage is where the budget is spent deliberately rather than filled.",
        numbers: ["~85 candidates survive, top 8 kept", "~6k prompt tokens", "abstain below a ~0.45 rerank floor"],
        breaks:
          "Two in-date documents that disagree about the expenses limit are indistinguishable to a score. The prompt must surface the conflict and cite both, because a confident pick with a citation looks verified and is not.",
        choice: {
          pick: "8 chunks, best-scoring at both ends, with a calibrated abstention floor",
          instead: "Filling the context window with the top 20 or more and letting the model sort it out.",
          decider:
            "Faithfulness, which falls as k rises, and lost-in-the-middle: models attend to the start and end of a context and poorly to the middle, so a correct chunk placed tenth is often ignored. The floor is calibrated so ~95% of below-floor questions were genuinely unanswerable on the labelled set, turning the worst failure into the second-best outcome.",
          flips: "Corpora where answers are genuinely spread across many passages, such as multi-hop or summarisation work, where the recall of a wider context outweighs the precision it costs.",
        },
      },
    },
    {
      id: "generation",
      label: "Prompt + LLM tier",
      kind: "external",
      col: 2,
      row: 4,
      sub: "stream + cite, see #46",
      detail: {
        what: "The inference tier that reads the 8 assembled chunks and streams a cited answer. Batching, KV cache and GPU economics belong to question 46; this diagram treats it as a boundary.",
        why: "It is drawn as one box on purpose. It dominates the bill and cannot fix a bad context, so the design's complexity belongs upstream: no model improves an answer built from the wrong chunks.",
        numbers: ["~3.3M prefill tokens/s at 500 q/s", "~220 accelerators, ~8x the reranker", "first token ~700ms, 400-token answer over ~8s"],
        breaks:
          "If the tier is degraded or rate-limited, fall back to a smaller model behind the same prompt contract; if all generation is down, return the reranked chunks as ranked links, because a working search product beats an error page.",
        choice: {
          pick: "Retrieval-grounded generation with citations, over a general model",
          instead: "Fine-tuning the corpus into the weights so no retrieval is needed at all.",
          decider:
            "Freshness, citation and permissions, not accuracy. With ~1M document edits a day, baked-in knowledge makes every edit a training run; the model cannot cite a source it no longer holds; and weights cannot be permissioned per reader. That last point alone rules it out for a corpus with ACL groups.",
          flips: "A small, stable, uniformly readable corpus where the whole thing fits in a context window, at which point you skip the index entirely and just send the documents.",
        },
      },
    },
    {
      id: "eval",
      label: "Evaluation harness",
      sub: "2,000 span labels, gates CI",
      kind: "service",
      col: 1,
      row: 4,
      detail: {
        what: "A labelled question set plus retrieval metrics (recall@k, MRR, nDCG) and generation metrics (faithfulness, answer relevance, context relevance), wired into CI.",
        why: "Every knob in this diagram is a quality risk taken on faith without it. It is the only thing that can tell you whether last week's chunker change made the product better, and it is a component rather than a phase before launch.",
        numbers: ["~2,000 labelled (question, doc_id, char_span) pairs", "retrieval metrics ~2 min, LLM-judged ~15 min", "blocks merge on -2 pts recall@10 or -1 pt faithfulness"],
        breaks:
          "Production has no ground truth. A confidently wrong answer to a question nobody anticipated produces no signal at all, and the 1% offline judge shares the failure modes of the system it judges.",
        choice: {
          pick: "Label at (doc_id, char_span), never at chunk_id",
          instead: "Labelling the chunk that contains the answer, which is what the retriever actually returns.",
          decider:
            "Survival across a re-chunk. The moment anyone changes the chunker, every one of 2,000 chunk_id labels is stale and the entire eval history is void, which is exactly how teams end up unable to tell whether a change helped. With spans, recall@10 means 'did any retrieved chunk overlap the gold span', which holds under any chunking.",
          flips: "A frozen chunker on a corpus that never changes shape, where chunk IDs are stable and are simpler to collect and to reason about.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "connectors",
      to: "chunker",
      tier: "data",
      label: "changed docs",
      detail: {
        what: "A change event carrying {source, external_id, version} plus the fetched document body, handed to parsing and chunking.",
        why: "Detection and transformation are separated so a flaky source cannot stall the chunker, and a parser crash cannot lose a connector's watermark. The event is the retry unit.",
        numbers: ["~1M docs/day", "detected within ~60s of the edit"],
        breaks:
          "A poison document such as a corrupt 400MB PDF crashes the parser on every retry, so it must dead-letter after 3 attempts with the doc_id recorded rather than blocking the lane.",
      },
    },
    {
      id: "e2",
      from: "chunker",
      to: "embed",
      tier: "data",
      label: "changed chunks only",
      detail: {
        what: "Chunks whose content hash differs from the stored one, which is the only work the embedding fleet ever sees.",
        why: "The hash is what turns a document edit into proportional work. Without it, editing one paragraph of a 12-chunk page costs 12 embeddings, and the daily bill is 3x higher for identical vectors.",
        numbers: ["~10M chunks touched/day", "~70% skipped, ~3M re-embedded"],
        breaks:
          "A change to the chunker itself shifts every boundary, so every hash changes at once and what looks like an incremental day becomes a full re-embed.",
      },
    },
    {
      id: "e3",
      from: "chunker",
      to: "chunk-store",
      tier: "data",
      label: "text + ACL payload",
      detail: {
        what: "The chunk text, heading path, char span, effective dates and ACL group IDs written as the durable record.",
        why: "This write is what makes an ACL change cheap later: permissions live on the row, so re-sharing a document is a metadata upsert on its ~12 chunks with no embedding involved.",
        numbers: ["~2.4KB per record", "keyed by (doc_id, ordinal)"],
        breaks:
          "If this write lands and the index upsert does not, the text exists but is unreachable, which reads as a missing document rather than an error.",
      },
    },
    {
      id: "e4",
      from: "chunker",
      to: "lexical-index",
      tier: "data",
      label: "tokens + same payload",
      offset: 60,
      detail: {
        what: "Tokenised chunk text and an identical filterable payload posted into the inverted index.",
        why: "Both indexes must carry the same ACL and date fields, or the two arms of a hybrid query apply different filters and the fusion step is merging two different corpora.",
        numbers: ["sharded by hash(doc_id), matching the vector index"],
        breaks:
          "Payload drift between the two indexes is silent: the lexical arm returns chunks the dense arm has already filtered out, and the leak shows up in an ACL audit rather than in a metric.",
      },
    },
    {
      id: "e5",
      from: "embed",
      to: "vector-index",
      tier: "data",
      label: "1024-d int8 upsert",
      detail: {
        what: "The quantised vector plus its filterable payload upserted into the HNSW graph, tagged with the embedding model version.",
        why: "The model version rides along because it is part of shard identity: a v2 query hitting a v1 shard returns noise that looks like results, so mismatches must be rejected rather than served.",
        numbers: ["1KB per vector at int8", "~35 upserts/s average, ~600/s in a backfill burst"],
        breaks:
          "HNSW graph insertion is not free, so a bulk backfill can degrade query latency on the same nodes unless the backfill lane is rate-capped.",
      },
    },
    {
      id: "e7",
      from: "query-api",
      to: "hybrid",
      tier: "hot",
      label: "qvec + group predicate",
      detail: {
        what: "The 1024-dimensional query vector, the raw question text for BM25, and the ACL group set carried as a hard filter.",
        why: "The predicate travels with the query rather than being applied to the results, because a filter evaluated after ranking cannot restore the slots it took away.",
        numbers: ["query embed ~15ms p95"],
        breaks:
          "If the query is embedded by a different model version than the index holds, the vector is meaningless and the results are plausible noise.",
      },
    },
    {
      id: "e8",
      from: "hybrid",
      to: "vector-index",
      tier: "hot",
      label: "ANN top 200, pre-filtered",
      detail: {
        what: "A filtered approximate-nearest-neighbour search scattered across 6 shards and gathered, returning the top 200 readable chunks.",
        why: "The permission predicate is evaluated during the graph walk so that all 200 results are chunks the caller may read, rather than 200 results of which an unpredictable number survive.",
        numbers: ["~25ms p95, slowest shard dominates", "recall@100 ~0.96"],
        breaks:
          "When the allowed set is tiny the greedy walk burns efSearch on rejected nodes and recall collapses, so under ~10k allowed chunks the query routes to an exact scan of ~10MB instead.",
      },
    },
    {
      id: "e9",
      from: "hybrid",
      to: "lexical-index",
      tier: "hot",
      label: "BM25 top 200, same filter",
      offset: 70,
      detail: {
        what: "The literal-token arm of the query, running concurrently with the ANN search under an identical ACL and date filter.",
        why: "It runs in parallel rather than as a fallback because you cannot know in advance which arm will find the answer, and waiting on both costs ~30ms rather than ~55ms.",
        numbers: ["~30ms p95", "top 200"],
        breaks:
          "Without this arm, any question containing an identifier such as a ticket key is simply unanswerable, and it fails by returning topically plausible chunks rather than nothing.",
      },
    },
    {
      id: "e10",
      from: "hybrid",
      to: "reranker",
      tier: "hot",
      label: "top 100 by RRF",
      detail: {
        what: "The 100 highest-fused candidates out of roughly 300 unique, handed to joint scoring.",
        why: "This is the narrowing that makes an expensive model affordable: cost per candidate rises exactly as candidate count falls, which is the shape of the whole funnel.",
        numbers: ["500M to 400 to ~300 unique to 100"],
        breaks:
          "Cutting at 100 caps recall for the rest of the pipeline. Anything the fusion ranked 101st can never be recovered, however well the cross-encoder would have scored it.",
      },
    },
    {
      id: "e11",
      from: "reranker",
      to: "chunk-store",
      tier: "data",
      label: "fetch ~300 texts",
      offset: 90,
      detail: {
        what: "Pulling the actual chunk prose for the candidate set, because both the cross-encoder and the prompt need words rather than vectors.",
        why: "Retrieval returns IDs and scores; nothing before this point has read any text. The fetch is batched because 300 individual round trips would cost more than the rerank itself.",
        numbers: ["~15ms p95 batched", "~150k reads/s at peak, ~80% LRU hit rate"],
        breaks:
          "If a subset of texts fails to resolve, prompt from the ones that did and drop the rest; below 3 resolved chunks, abstain rather than answer from a thin context.",
      },
    },
    {
      id: "e12",
      from: "reranker",
      to: "assembler",
      tier: "hot",
      label: "~85 scored candidates",
      detail: {
        what: "Candidates carrying a joint relevance score, which is the first number in the pipeline that means 'answers this question' rather than 'is about this topic'.",
        why: "Assembly needs a calibrated score, not a rank, because both the abstention floor and the recency prior are multiplicative on it and a rank has no scale to threshold against.",
        numbers: ["~85 left after dedupe and effective-date filtering"],
        breaks:
          "Under adaptive depth reduction these scores come from a shallower candidate set, so the floor is calibrated against a distribution that has quietly shifted.",
      },
    },
    {
      id: "e13",
      to: "assembler",
      tier: "control",
      from: "query-api",
      label: "re-check final 8",
      detail: {
        what: "A second permission check on the eight chunks that are about to enter the prompt, against freshly resolved groups.",
        why: "Defence in depth for one 8-row lookup. Pre-filtering already used groups that may be up to 60 seconds stale, and this is what closes that window before anything is shown to a user.",
        numbers: ["8 rows", "closes the 60s ACL cache TTL"],
        breaks:
          "It is a last line, not a substitute: if it is doing real work regularly, the pre-filter is broken and top-k has already been contaminated upstream.",
      },
    },
    {
      id: "e14",
      from: "assembler",
      to: "generation",
      tier: "hot",
      label: "top 8, ~6k tokens",
      detail: {
        what: "The final context: eight chunks with citations attached, ordered strongest at the beginning and the end of the prompt.",
        why: "The ordering is deliberate, not cosmetic. Models attend well to the start and end of a context and poorly to the middle, so putting the two best chunks at the extremes defeats lost-in-the-middle.",
        numbers: ["8 chunks, ~6k prompt tokens", "prefill ~700ms to first token"],
        breaks:
          "Everything upstream is invisible at this arrow. If the wrong 8 chunks arrive, the answer is fluent, cited and wrong, and no metric on this side of the boundary will show it.",
      },
    },
    {
      id: "e15",
      from: "generation",
      to: "query-api",
      tier: "hot",
      label: "answer + citations",
      offset: 110,
      detail: {
        what: "Streamed answer tokens followed by the citation set of (doc_id, chunk_id, uri, char_span, score), or an abstention with the three best chunks as links.",
        why: "Citations are returned as spans rather than document links so a reader can check the exact sentence the claim came from, which is the only cheap defence a user has against a confident wrong answer.",
        numbers: ["TTFT p95 < 1.5s", "~400 tokens over ~8s", "abstention rate expected 5-10%"],
        breaks:
          "A citation that points at a chunk which does not actually support the sentence is the worst outcome in the system: it looks verified, so nobody checks it.",
      },
    },
    {
      id: "e16",
      from: "assembler",
      to: "eval",
      tier: "control",
      label: "1% judged offline",
      detail: {
        what: "A sampled stream of production candidate sets and answers, plus mined thumbs-down and rephrase events, feeding the labelled set and the rolling faithfulness estimate.",
        why: "The 2,000-question set cannot cover what people actually ask, so the hard cases have to be harvested from traffic. Mining rephrases matters most: they mark questions the system answered badly enough to be asked again.",
        numbers: ["1% offline judge sample", "~30% of generated candidate questions discarded as ambiguous"],
        breaks:
          "Thumbs-down and rephrase signals are biased toward users who noticed they were misled, so the failures nobody catches are invisible here by construction.",
      },
    },
    {
      id: "e17",
      from: "eval",
      to: "chunker",
      tier: "control",
      label: "CI gate on chunk + model",
      offset: 120,
      detail: {
        what: "The merge gate: any change to the chunker, embedding model, retrieval config or prompt runs the harness and is blocked if it regresses the baseline.",
        why: "Chunk size interacts with the embedding model, the reranker and the token budget, so it has to be re-measured whenever any of them change. Treating it as a value set once at project start is the most common way a RAG system quietly underperforms for a year.",
        numbers: ["blocks on -2 pts recall@10", "blocks on -1 pt faithfulness", "~17 min for a full run"],
        breaks:
          "The gate only measures what the labelled set contains, so a change that helps 2,000 known questions and hurts an unrepresented source type ships green.",
      },
    },
  ],
};
