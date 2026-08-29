import type { Diagram } from "./types";

export const GOODREADS: Diagram = {
  id: "goodreads",
  title: "Goodreads",
  question: "Design Goodreads (Book Catalog, Shelves & Reviews)",
  sourceId: "patterns",
  itemId: 45,
  overview: {
    shape:
      "A read-dominated catalogue whose primary key is a guess: book pages live at the CDN edge, while an offline pipeline keeps re-deciding which editions describe the same book.",
    forces: [
      {
        constraint: "~9k views/s at peak, on a page that is byte-identical for 90% of viewers",
        decision: "The anonymous shell is a CDN object on a 5-minute TTL, so the edge answers 92% of requests without waking the origin",
        lights: ["cdn", "e1", "e2"],
      },
      {
        constraint: "One logged-in reader's shelf and rating state cannot be shared with the other 99% of viewers",
        decision: "The Shelf + Review Service serves a separate ~5ms call, spliced onto the cached shell on the client",
        lights: ["shelf-svc", "e7"],
      },
      {
        constraint: "Pairwise comparison of 300M editions is 4.5x10^16 pairs",
        decision: "Entity resolution blocks on title tokens, author surname and language first, cutting comparisons to ~500M",
        lights: ["er-pipeline", "e12"],
      },
      {
        constraint: "0.5% of 2M auto-merges in one pass is still 10,000 wrong merges",
        decision: "Clusters + merge log stores only pointers plus full pre-merge membership, so every merge is reversible",
        lights: ["clusters", "e13"],
      },
      {
        constraint: "The most-shelved book has ~5M shelvings, six orders of magnitude more than a typical shelf",
        decision: "Shelves & reviews partitions by user_id and keeps only counters on the book side",
        lights: ["shelvings"],
      },
    ],
    naive: {
      text: "Give every book row a single primary key at ingest, store ratings against it directly, and average them live on every page read. Publisher feeds, library records and members disagree on title, author spelling and page count for the same book. Records describing one physical work arrive as many different rows with no shared key. Averaging 1.8B ratings on every render is also far too slow for a ~20ms budget. Works & editions instead treats identity as inferred rather than given, and work_aggregates folds each rating in once, incrementally, rather than recomputing the mean from scratch.",
      lights: ["catalog-store", "aggregates"],
    },
    beats: [
      {
        text: "The read path is almost entirely cache. A book page is byte-identical for every viewer, and it is the organic-search surface. The anonymous shell (work metadata, edition list, aggregate rating, histogram, top ten reviews) is a CDN object on a five minute TTL, returning in ~20ms at a 92% hit rate.",
        lights: ["client", "cdn", "e1", "e2"],
      },
      {
        text: "Personalised state is deliberately not in that body. A logged-in reader gets the same cached shell plus a separate ~5ms call for shelf, progress and their own rating, spliced in on the client. Splitting personalised state out of the cacheable body is the single biggest lever in the whole design.",
        lights: ["client", "shelf-svc", "e7"],
      },
      {
        text: "Writes are small, rare and asynchronous. Shelving is one ~120B row partitioned by user_id at ~8ms, and a rating is a row plus an event. Peak is ~750/s across 4M DAU. The work average is folded incrementally off the event log rather than recomputed over 1.8B rating rows.",
        lights: ["shelf-svc", "shelvings", "kafka", "aggregates", "e8", "e9", "e10"],
      },
      {
        text: "Identity is inferred rather than looked up. Records arrive from publisher feeds, library records and members disagreeing on title, author spelling, page count and year. Pairwise comparison of 300M records is 4.5x10^16 pairs, so blocking on title tokens plus a folded author surname plus language cuts it to ~500M.",
        lights: ["catalog-store", "er-pipeline", "e12"],
      },
      {
        text: "A merge writes pointers and nothing else. Above 0.92 the pipeline unions two clusters, 0.75 to 0.92 goes to a moderator queue, and every merge appends the full pre-merge membership of both sides to a log. No review row is ever rewritten, which is what makes unmerge a replay rather than a restore.",
        lights: ["er-pipeline", "clusters", "e13"],
      },
      {
        text: "Everything downstream hangs off those same stores offline. Search reindexes incrementally from the merge log, with a nightly full rebuild swapped in atomically. The recommender reads a nightly dump of shelvings, discounting item scores by count^0.5 so the head does not eat every slot.",
        lights: ["search", "recommender", "shelvings", "e15", "e16", "e17"],
      },
    ],
    crux: {
      problem:
        "work_id looks like a primary key and behaves like a hypothesis. Under-merging splits a book's ratings across two pages, which is annoying and recoverable. Over-merging puts 900 reviews of a horror novel on a children's picture book, which gets screenshotted. Since no threshold is safe, every merge has to be a reversible pointer write rather than a data migration.",
      handled:
        "Clusters + merge log stores only union-find pointers plus the full pre-merge membership of both sides, so an unmerge replays the log rather than restoring from backup. What the design does not solve is undo ordering. Undo is last-in-first-out while bad merges surface oldest-first, so once two later merges sit on top of a bad one, a moderator reconstructs membership from the log by hand.",
    },
    numbers: [
      {
        value: "4.5x10^16 pairs, ~500M after blocking",
        explain: "The raw pairwise comparison count for 300M editions against the count after blocking on title tokens, author surname and language; blocking is what makes entity resolution finite at all.",
      },
      {
        value: "92% CDN hit at ~9k views/s peak",
        explain: "8% miss × ~9k/s peak ≈ 720 origin req/s — well above the ~230/s the origin normally sees, why the hit-rate alert fires at 85%, not 0%.",
      },
      {
        value: "~750/s peak writes, ~16:1 read:write",
        explain: "The write-side peak against the read:write ratio; both numbers point the same direction, toward a design that spends almost everything on the read path.",
      },
      {
        value: "~1.8B ratings folded incrementally",
        explain: "1.8B ÷ ~90M work rows ≈ 20 ratings folded per work on average — cheap enough per row that incrementing beats ever re-summing from raw ratings.",
      },
      {
        value: "0.5% of 2M auto-merges = 10,000 wrong merges",
        explain: "Why auto-merge precision has to clear 99.5%. Even at that bar, one nightly pass still produces ten thousand merges someone eventually has to unwind.",
      },
    ],
  },
  nodes: [
    {
      id: "offline-group",
      label: "Offline (batch)",
      kind: "zone",
      detail: {
        what: "The two batch jobs that write into the serving stores rather than serving traffic themselves.",
        why: "Catalogue correctness and recommendation quality both tolerate hours of latency, so they are deliberately pushed off the request path. Losing this whole region is not an outage: the serving path keeps using the last published cluster table and recommendation lists.",
        numbers: [
          { value: "full dedup pass runs in under 1 hour", explain: "The wall-clock cost of one nightly entity resolution pass over the whole catalogue on the allotted compute." },
          { value: "batch region loss is tolerable for 24+ hours", explain: "How long the serving path can run on stale cluster and recommendation data before anyone notices, since neither is on the request path." },
        ],
        breaks: {
          failure: "A pipeline change that merges 2M pairs in one pass enqueues 2M aggregate recomputes and reindexes at once.",
          handled: "Merge application is rate limited per hour and prioritised by rating count, so the serving stores absorb the change gradually rather than all at once.",
        },
      },
    },
    {
      id: "client",
      label: "Reader / search crawler",
      sub: "~250M page views/day",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The reader's browser or app, plus the search-engine crawlers that make book pages the acquisition surface.",
        why: "Drawn because roughly 90% of book page views are anonymous or render identically for everyone. That fact is what licenses caching the entire shell at the edge and doing the personalised splice on the client.",
        numbers: [
          { value: "~250M views/day, ~2.9k/s average", explain: "The baseline traffic level the whole edge and origin capacity plan is built from." },
          { value: "~9k/s at 3x peak", explain: "The peak the CDN, not the origin, has to absorb; the origin only ever sees the ~8% miss rate of this number." },
          { value: "~4M DAU out of ~150M accounts", explain: "How small the actively-writing population is against total registered accounts, which is why write volume stays modest at this read scale." },
        ],
        breaks: {
          failure: "A client that waits for the shelf-state call before painting throws the CDN win away.",
          handled: "The page then blocks on a request that can never be edge cached, so first paint must never depend on the personalised splice arriving.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "anon shell, 5 min TTL",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "Edge cache holding the anonymous page shell: work metadata, edition list, aggregate rating, histogram and top ten reviews.",
        why: "Read to write is ~16:1 at the request level and closer to 100:1 once you count per-page fan-out, on content that is identical for every viewer. The cache is not an optimisation here, it is the capacity plan.",
        numbers: [
          { value: "92% hit rate, ~20ms, p99 < 30ms", explain: "The steady-state performance the edge delivers; almost all traffic never reaches the origin at all." },
          { value: "origin sees only ~230 shell renders/s", explain: "The residual load after the 92% hit rate, which is the number the origin fleet is actually sized against." },
          { value: "5 minute TTL, so a rating shows up to 5 min late", explain: "The freshness cost of caching; acceptable because a single rating moves the aggregate imperceptibly." },
        ],
        breaks: {
          failure: "A purge storm or a cold cache after a deploy sends full read volume at the origin.",
          handled: "A hit rate below 85% doubles origin load and is treated as a paging alert rather than a dashboard metric, so it is caught before the origin saturates.",
        },
        choice: {
          pick: "Cache the anonymous shell at the edge, splice personalised state on the client",
          instead: "Render the whole page per user at the origin, or cache a per-user body at the edge.",
          decider:
            "Cacheability. One shared object serves 92% of ~9k views/s in ~20ms and leaves the origin ~230 renders/s. A per-user body has a hit rate of roughly zero, so the origin would have to carry all 9k/s of renders itself.",
          flips: "When most of the page genuinely is personalised, a feed for instance, where there is no shared body to cache and the edge only buys you TLS termination.",
        },
      },
    },
    {
      id: "catalog-svc",
      label: "Catalog Service",
      sub: "shell render, ISBN resolve",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "Renders the shell on a cache miss: work document, edition list, aggregates, and the top ten review IDs hydrated in one batch read.",
        why: "Everything it touches is small, cached and globally identical, so it is a read-only assembler rather than a transaction owner. It also owns identifier resolution, which returns a list of matching editions rather than guessing when an ISBN is ambiguous.",
        numbers: [
          { value: "work ~1ms, editions ~2ms, aggregate ~1ms", explain: "The per-store read latencies that sum into the render budget below." },
          { value: "top-10 reviews ~3ms + ~6ms hydrate", explain: "The most expensive single component of the render, a batch read followed by hydration of the review bodies." },
          { value: "~40ms server side, p99 ~180ms", explain: "The full server-side render time once every dependent read is summed, well inside the page's overall latency budget." },
        ],
        breaks: {
          failure: "Fan-out latency. Five dependent reads per render means one slow store sets the page p99.",
          handled: "Review hydration is a single batch read rather than ten point reads, which is what keeps one slow dependency from multiplying into ten slow round trips.",
        },
        choice: {
          pick: "Assemble from four cache reads and resolve edition to work at read time",
          instead: "Maintain a denormalised page document per work, rewritten on every change.",
          decider:
            "Merge cost. The work is a hypothesis that moves: a prebuilt document would have to be rewritten for all ~2M merges in a pass plus every rating. Read-time resolution is one extra ~1ms pointer read on a page that already does four.",
          flips: "If cluster resolution ever stops being a point lookup, for example the contains and derived-from graph traversal that translations and omnibuses really need. There a materialised page beats a traversal on the hottest path.",
        },
      },
    },
    {
      id: "shelf-svc",
      label: "Shelf + Review Service",
      sub: "shelve, progress, rate, review",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The write path and the personalised read: shelvings, reading progress, ratings, review bodies and helpfulness votes.",
        why: "User state cannot be shared between viewers, so it is kept out of the cacheable body and served live. The volumes are genuinely small, which is why identity resolution sits upstream of serving rather than here.",
        numbers: [
          { value: "shelf write ~8ms, p99 < 150ms", explain: "The write latency budget for a shelving action, dominated by a single-partition append." },
          { value: "~185/s average, ~750/s peak, ~2k/s in January", explain: "The write rate at average, peak and the seasonal spike from New Year's reading-goal resolutions." },
          { value: "shelf-state read ~5ms, never edge cached", explain: "The personalised read's latency, kept fast enough that splicing it client-side costs almost nothing next to the cached shell." },
        ],
        breaks: {
          failure: "Brigading: 40k one-star ratings in six hours before publication.",
          handled: "An hourly rate above 20x the trailing 7-day baseline with over half from accounts under 30 days old quarantines new ratings into a holding buffer instead of deleting user content.",
        },
        choice: {
          pick: "Every user row keys on edition_id, partitioned by user_id",
          instead: "Key user content on work_id, which is what the page is actually about.",
          decider:
            "Recovery cost of a bad merge. An edition_id is minted at ingest and never changes; work_id moves for ~2M clusters per pass. Keying on it would turn an unmerge into millions of row rewrites across several stores instead of a few hundred pointer writes.",
          flips: "A catalogue you author yourself, where the identifier is a key rather than an inference and no row ever has to move between works.",
        },
      },
    },
    {
      id: "kafka",
      label: "Kafka",
      sub: "rating + activity events",
      kind: "queue",
      col: 0,
      row: 2,
      detail: {
        what: "The durable log carrying aggregate-update events and follower activity away from the request path.",
        why: "A rating write must not wait on aggregate maintenance, feed fanout or search. Events carry a UUID so at-least-once delivery does not double count a star, and the log gives replay after a bad consumer deploy.",
        numbers: [
          { value: "~750 events/s at peak", explain: "The event rate at the same peak as the write path that produces it, since every write emits exactly one event." },
          { value: "aggregate freshness SLO p99 < 60s", explain: "The staleness bound consumers must meet, comfortably inside the CDN's own 5-minute freshness window." },
          { value: "one event per shelve, rate or review", explain: "The event granularity; nothing is batched, which keeps the aggregate consumer's per-event logic simple." },
        ],
        breaks: {
          failure: "Consumer lag or a lost event leaves work averages quietly wrong.",
          handled: "This is only caught by the nightly reconciliation that recomputes every work touched in 24h, correcting drift a paging alert would otherwise never see.",
        },
        choice: {
          pick: "Asynchronous events with idempotent UUIDs",
          instead: "Update the aggregate synchronously inside the rating write.",
          decider:
            "Hotspot and blast radius. A book club pick takes 1000x traffic and its aggregate becomes a single hot key. A synchronous update puts that contention inside a p99 < 150ms user write, while the log absorbs it and the SLO only asks for 60s.",
          flips: "Small deployments where a rating write can simply take the counter increment, and 60s of eventual consistency is harder to explain to users than it is worth.",
        },
      },
    },
    {
      id: "er-pipeline",
      label: "Entity resolution",
      sub: "Spark: normalise, block, score",
      kind: "service",
      col: 1,
      row: 3,
      parent: "offline-group",
      detail: {
        what: "Nightly batch plus a streaming path for new records: normalise, block into comparison groups, score pairs on about eight weighted features. Then auto-merge, queue for a moderator, or create a new work.",
        why: "The catalogue is not authored in house, it is inferred from sources that disagree in every field. Blocking is what makes the problem finite: ~80M blocks averaging four records, ~500M pairs at ~20us, about 8 minutes of wall clock on 200 cores.",
        numbers: [
          { value: "~2M auto-merges, ~400k queued pairs per pass", explain: "The output volume of one nightly pass, split between fully automatic merges and pairs held for moderator review." },
          { value: "auto-merge precision SLO >= 99.5%", explain: "The bar auto-merges must clear before shipping without review, since even at this bar thousands of wrong merges still slip through." },
          { value: "new records resolve in ~200ms each", explain: "Fast enough to clear each of the ~2.3 records/s arriving from feeds before the next lands, so a new edition never sits unclustered until the next nightly batch." },
        ],
        breaks: {
          failure: "Blocking-key skew. A block such as Selected Poems can hold 50k records, which is 1.25B pairs stalling one Spark partition.",
          handled: "Block size is hard capped at 1000 with a publisher sub-key, and a second pass recovers whatever candidate pairs that cap loses.",
        },
        choice: {
          pick: "Two exact blocking keys unioned, with cut points at 0.92 and 0.75",
          instead: "One MinHash LSH pass with a stated recall bound and a single threshold.",
          decider:
            "Debuggability, plus the fact that the two errors are not the same size. Auto-merge precision has to clear 99.5% because 0.5% of 2M merges is 10k wrong ones. When a duplicate is reported, you can compute an exact block key by hand and see why two records never met.",
          flips: "A catalogue with no second reliable structured field. Books have ISBNs; free-text submissions with only a title have nothing to build a second exact key from, and LSH is then the only thing offering a recall bound.",
        },
      },
    },
    {
      id: "recommender",
      label: "Recommender",
      sub: "batch CF, popularity-discounted",
      kind: "service",
      col: 2,
      row: 3,
      parent: "offline-group",
      detail: {
        what: "Offline job producing a per-user list of works, blending collaborative filtering with a content-based path for titles that have no ratings yet.",
        why: "The signal here is thin: one rating per book per user ever, and only ~12% carry any text. The popularity-skew fix has to be structural rather than a matter of collecting more data.",
        numbers: [
          { value: "top ~1,000 works hold ~25% of all ratings", explain: "The concentration that plain co-occurrence would exploit; unchecked it recommends the same bestsellers to everyone." },
          { value: "~60% of works have under 10 ratings", explain: "How thin the long tail's signal actually is, which is why a content-based path exists for cold-start titles." },
          { value: "~10% of each list reserved for exploration", explain: "The slice of every recommendation list deliberately spent outside pure predicted relevance, to keep catalogue coverage from collapsing." },
        ],
        breaks: {
          failure: "Popularity collapse. Optimising click-through alone drives the list monotonically onto the head.",
          handled: "Only catalogue coverage catches this happening: the fraction of works recommended to at least one user per week, tracked as its own metric rather than inferred from click-through.",
        },
        choice: {
          pick: "Popularity-discounted CF plus a content-based cold-start path",
          instead: "Plain co-occurrence collaborative filtering.",
          decider:
            "Signal skew. With ~25% of ratings sitting on ~1,000 works, raw co-occurrence recommends the same fifty bestsellers to everyone forever, so scores are discounted by count^0.5. User-created shelf names such as cosy-mystery are the best cold-start feature available, and no publisher feed provides them.",
          flips: "A catalogue with dense repeat interaction, music for example where one user replays a track 400 times, where co-occurrence has enough signal on its own.",
        },
      },
    },
    {
      id: "catalog-store",
      sub: "document store, ~1.8TB at RF=3",
      kind: "database",
      col: 2,
      row: 1,
      label: "Works & editions",
      detail: {
        what: "Three levels held deliberately apart: work documents, edition documents, and an identifier index mapping each ISBN or ASIN to a list of edition IDs.",
        why: "An edition is the object a reader is actually holding and a work is the thing ratings aggregate to, so they cannot be one row. The identifier maps to a list because publishers reuse and misassign ISBNs, which is a fact about the world rather than a data-quality bug.",
        numbers: [
          { value: "~300M editions at ~2KB, ~1.8TB at RF=3", explain: "The edition-level storage footprint, the larger of the two document collections since every publisher's printing gets its own row." },
          { value: "~90M works at ~1.5KB, ~400GB at RF=3", explain: "The work-level footprint, small enough to sit comfortably in a cache tier ahead of the origin." },
          { value: "~200k new or changed records/day, ~2.3/s", explain: "The daily ingest rate from feeds, which is what the streaming resolution path has to keep up with between nightly batches." },
        ],
        breaks: {
          failure: "A feed reusing a 13-digit ISBN.",
          handled: "If the index were a unique key the second record would overwrite the first silently or wedge the feed. As a list, resolve returns ambiguous with the matching editions instead.",
        },
        choice: {
          pick: "Document store (DynamoDB or MongoDB), identifiers indexed to a list",
          instead: "A relational schema with a books table and a unique ISBN key.",
          decider:
            "The shape of the data. Edition records are ~2KB of sparse, source-specific fields across 300M rows with no joins on the read path. Identifier to edition is genuinely many-to-many in both directions, so a unique key is a claim the first misassigned ISBN disproves.",
          flips: "A curated catalogue of a few million titles from clean contracted sources, where relational constraints are an asset rather than a lie about the input.",
        },
      },
    },
    {
      id: "clusters",
      sub: "union-find KV, append-only log",
      kind: "database",
      col: 2,
      row: 0,
      label: "Clusters + merge log",
      detail: {
        what: "edition_id to cluster_id to work_id, plus an append-only log of every merge and unmerge. Each entry carries the score, the evidence that fired, the actor, and the full pre-merge membership of both clusters.",
        why: "This is the only thing a merge writes. Keeping the inference in one indirection layer instead of smearing work_id across two billion user rows makes revision cost a few hundred writes, not a restore from backup.",
        numbers: [
          { value: "a 200-edition merge is a few hundred pointer writes", explain: "The actual cost of one merge, which stays small and constant regardless of how many ratings or reviews reference the affected editions." },
          { value: "both pages correct within ~2 minutes of an unmerge", explain: "How quickly an unmerge propagates to the serving path once the pointer write and cache invalidation both land." },
          { value: "100% of merges reversible in one operation", explain: "Because the log stores full pre-merge membership rather than a delta, every merge can be undone without reconstructing state from elsewhere." },
        ],
        breaks: {
          failure: "Undo is last-in-first-out while bad merges surface oldest-first.",
          handled: "Once two later merges sit on top, the tooling refuses. A moderator reconstructs memberships from the log by hand instead, which works at a few a week and nowhere near generally.",
        },
        choice: {
          pick: "Union-find pointers plus a log storing full pre-merge membership",
          instead: "Rewrite every rating, review and shelving row from work A to work B.",
          decider:
            "Reversibility. Merging two 200-edition works is a few hundred pointer writes. Rewriting rows is millions of non-atomic updates across several stores that half-apply when the job dies and cannot be undone once the original work_id is gone. Storing full membership rather than a parent pointer is what survives path compression.",
          flips: "A catalogue small enough that a merge is one transaction over a few thousand rows, where carrying work_id on the rows is simpler than the indirection.",
        },
      },
    },
    {
      id: "search",
      label: "Search index",
      sub: "OpenSearch, one doc per work",
      kind: "database",
      col: 0,
      row: 3,
      detail: {
        what: "An inverted index over works with every edition title and author-name variant folded into one document, and ISBN and ASIN as exact-match keyword fields.",
        why: "The same box takes both a title and a 13 digit identifier, and fuzzy-matching an identifier is never what anyone wants. Ranking blends BM25 with a capped popularity prior so a geology textbook mentioning sand dunes does not outrank the novel.",
        numbers: [
          { value: "~90M work documents", explain: "The index size, one document per work rather than per edition, which is what keeps a bestseller from returning 200 near-duplicate hits." },
          { value: "edit distance 1 to 2 on title tokens", explain: "The typo tolerance applied to title search, chosen to catch common misspellings without matching unrelated short words." },
          { value: "full rebuild of 90M works takes hours", explain: "Hours-long, which is why the serving index is only ever patched from the merge log between changes — a full rebuild happens on a schedule, never per merge." },
        ],
        breaks: {
          failure: "Swapping in a partially built index serves empty or wrong results.",
          handled: "Rebuilds go into a parallel index and swap only after a document-count and smoke-query gate, with instant rollback to the previous alias.",
        },
        choice: {
          pick: "Index per work with editions folded in, identifiers as keyword fields",
          instead: "Index per edition, and run identifiers through the same analyser as text.",
          decider:
            "Result quality. A bestseller carries 200+ editions, so indexing editions returns 200 near-identical hits for one book. An analysed ISBN fuzzy-matches neighbouring numbers when a valid check digit should have been a redirect to the book page instead.",
          flips: "When editions genuinely differ to the person searching, a retail catalogue for instance where format, price and availability are the thing being chosen between.",
        },
      },
    },
    {
      id: "shelvings",
      sub: "Cassandra, ~1.8TB at RF=3",
      kind: "database",
      col: 1,
      row: 2,
      label: "Shelves & reviews",
      detail: {
        what: "Billions of tiny rows: shelvings and ratings partitioned by user_id and clustered by (shelf_id, added_at), reviews partitioned by edition_id with no work_id column.",
        why: "The read the product actually serves is an ordered slice of one user's shelf, which is a single-partition range read with no sort and no offset. The book side gets counters only, because the most-shelved book has ~5M shelvings.",
        numbers: [
          { value: "~5B shelvings at ~120B, ~1.8TB at RF=3", explain: "The total row count and its replicated storage footprint, comfortably within reach of a handful of machines." },
          { value: "a 30k-book shelf is a ~3.6MB partition", explain: "30,000 × ~120B/row ≈ 3.6MB — small enough that even the largest realistic shelf fits comfortably in one partition, so paging stays cursor-only rather than needing a scan." },
          { value: "~220M reviews with text, ~460GB at RF=3", explain: "The smaller, text-bearing subset of writes, partitioned separately by edition rather than user." },
        ],
        breaks: {
          failure: "Hot partitions from a power user or a mass CSV import.",
          handled: "Paging is cursor-only over the clustering key, never a full shelf read, and bulk imports are rate limited and collapsed into one activity event.",
        },
        choice: {
          pick: "One copy partitioned by user_id, with counters on the edition side",
          instead: "A second materialised copy partitioned by edition_id for book-side reads.",
          decider:
            "Skew rather than capacity: 5B rows is ~1.8TB at RF=3 and fits on a handful of machines. The two sides are skewed in opposite directions by six orders of magnitude. Every surface that looks like who shelved this is really which of my ~200 follows shelved this, which is ~200 point reads.",
          flips: "Follow lists in the tens of thousands, where intersecting 50k follows costs more than one book-side read. Bulk consumers get a nightly columnar dump partitioned by edition instead.",
        },
      },
    },
    {
      id: "aggregates",
      label: "work_aggregates",
      sub: "Redis, sum, count, histogram[5]",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "One small row per work holding (sum_stars, count, histogram[5], last_recompute_ts), with a durable store behind Redis. An in-line stream processor consumes rating events off Kafka and applies atomic increments here rather than recomputing from the ratings table.",
        why: "The page needs an average and a star histogram in about a millisecond, and there is no version of that which touches rating rows. Publishing the histogram rather than only the mean also makes a brigade visible in the shape of the distribution. Commutative increments off an idempotent stream also make concurrent raters a non-issue rather than a lock problem.",
        numbers: [
          { value: "~90M rows, ~1ms read", explain: "The store's total size and its read latency, small and fast because it holds five numbers per work rather than any raw ratings." },
          { value: "displayed average updates within ~30s", explain: "The effective end-to-end freshness a reader sees, well inside the 60s consumer SLO." },
          { value: "1 full recompute triggered per merge or unmerge", explain: "The one case where an incremental update is impossible, since membership itself, not just the count, has changed." },
          { value: "~1.8B ratings folded incrementally", explain: "The lifetime volume this store has absorbed one atomic increment at a time, never re-summed from raw rows." },
        ],
        breaks: {
          failure: "Single-key write hotspot on a prize winner or book club pick.",
          handled:
            "Above ~500 writes/s the work is promoted to sharded counters keyed on (work_id, hash(user_id) % N) and summed on read, costing N reads per render. A nightly job also recomputes every work touched in the last 24h and alerts on drift, since duplicate or dropped events can silently skew the stored value.",
        },
        choice: {
          pick: "Redis with a durable backing store",
          instead: "A counter column next to the ratings, or computing the average on read.",
          decider:
            "Origin render latency. Even at a 92% CDN hit the origin still renders ~230 pages/s and budgets ~1ms for this row. Since a merge forces a full recompute anyway, durability can live in the backing store rather than on the hot path.",
          flips: "Low traffic, where the aggregate can be a counter column in the ratings store and one fewer system to operate is worth more than the millisecond.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "cdn",
      tier: "hot",
      step: 1,
      label: "GET /work/{id}",
      detail: {
        what: "A book page request, most often arriving cold from a search engine result rather than from inside the product.",
        why: "Book pages are the organic-search surface, so the first hop has to be an edge that can answer without waking the origin. Roughly 90% of these viewers are anonymous or would be served an identical body anyway.",
        numbers: [
          { value: "~250M requests/day", explain: "The daily volume landing on this edge, almost entirely absorbed before it reaches the origin." },
          { value: "~9k/s at peak", explain: "The peak the edge, not the origin, has to sustain; the origin only ever sees the miss rate of this number." },
        ],
        breaks: {
          failure: "Deep links carry the work_id, so a work that has since been merged away has to redirect rather than 404.",
          handled: "Every indexed URL for the superseded side redirects to the survivor, which keeps search rankings and inbound links intact across a merge.",
        },
      },
    },
    {
      id: "e2",
      from: "cdn",
      to: "catalog-svc",
      tier: "hot",
      step: 2,
      label: "miss, ~8% of views",
      detail: {
        what: "The cache miss that actually reaches the origin and renders a fresh shell.",
        why: "Only 8% of views get here, which is the entire reason the origin fleet is small. Request coalescing per POP and stale-while-revalidate keep a hot work from turning one expiry into a thundering herd.",
        numbers: [
          { value: "~230 shell renders/s at the origin", explain: "The residual load this edge carries, small enough that the origin fleet stays modest." },
          { value: "5 minute TTL", explain: "How often this edge is exercised for any single work, absent a purge or a cold cache." },
        ],
        breaks: {
          failure: "A staggered purge that is not staggered, or a cold cache after a deploy, turns 8% into 100% instantly.",
          handled: "The origin has to load-shed to the last-good shell without personalisation, rather than fail outright, when this happens.",
        },
      },
    },
    {
      id: "e3",
      from: "catalog-svc",
      to: "catalog-store",
      tier: "data",
      label: "work + edition list",
      detail: {
        what: "Reading the work document and its edition list to build the page body.",
        why: "The whole works table is ~400GB at RF=3, small enough to sit in a cache tier. That is precisely why book pages are cheap to serve, and why this read is never the bottleneck.",
        numbers: [{ value: "work ~1ms, editions ~2ms", explain: "The two components of this read; together a small fraction of the overall render budget." }],
        breaks: {
          failure: "A work with 200+ editions makes this list the largest thing on the page.",
          handled: "The edition list has to be paged or truncated rather than returned whole, so a long tail of editions never bloats a single render.",
        },
      },
    },
    {
      id: "e4",
      from: "catalog-svc",
      to: "clusters",
      tier: "data",
      label: "edition to work, ~1ms",
      detail: {
        what: "Resolving the edition a review or shelving was written against into the work currently being displayed.",
        why: "This indirection is the price of keeping work_id off two billion user rows. It is paid once per render as a point read, and it is what turns an unmerge into a pointer rewrite rather than a data migration.",
        numbers: [{ value: "one point read per render", explain: "The entire cost of this indirection; a single lookup, not a join or a scan." }],
        breaks: {
          failure: "If this ever becomes a graph traversal, which is what translations and omnibuses actually need.",
          handled: "The hottest path in the system would gain a variable-cost step, so the design keeps work resolution a point read for as long as it can.",
        },
      },
    },
    {
      id: "e5",
      from: "catalog-svc",
      to: "aggregates",
      tier: "data",
      label: "avg + histogram",
      detail: {
        what: "Reading the precomputed (sum_stars, count, histogram[5]) row for the work being rendered.",
        why: "The alternative is aggregating rating rows at render time, which nobody would do at 1.8B ratings. The histogram is fetched alongside the mean because a brigade is obvious in the distribution and invisible in the average.",
        numbers: [
          { value: "~1ms", explain: "The read latency, negligible against the overall render budget." },
          { value: "one row per work", explain: "The granularity of this store, five numbers regardless of how many ratings a work has accumulated." },
        ],
        breaks: {
          failure: "If the aggregate is missing or stale after a merge the page shows a confidently wrong number.",
          handled: "That is worse than a slow page, so a full recompute is enqueued on every cluster change rather than left to drift.",
        },
      },
    },
    {
      id: "e6",
      from: "catalog-svc",
      to: "search",
      tier: "data",
      label: "title, author or ISBN",
      detail: {
        what: "Query traffic from the search box, routed by shape before it is executed.",
        why: "A 10 or 13 digit string with a valid check digit is not a text query; it goes to identifier resolution and redirects straight to the book page. Everything else goes to the inverted index with typo tolerance on title tokens.",
        numbers: [{ value: "edit distance 1 to 2 on title tokens", explain: "The typo tolerance applied before a query reaches the inverted index." }],
        breaks: {
          failure: "Ranking on BM25 alone surfaces documents that merely mention the word often.",
          handled: "A popularity prior fixes that, but the same prior would also make new books invisible if left uncapped, so it is deliberately bounded.",
        },
      },
    },
    {
      id: "e7",
      from: "client",
      to: "shelf-svc",
      tier: "hot",
      step: 3,
      label: "/me/shelf-state, ~5ms",
      offset: 90,
      detail: {
        what: "The second, tiny call a logged-in reader makes: shelf, progress percentage and their own rating for this work.",
        why: "It bypasses the CDN entirely and on purpose, never edge cached. Keeping personalised state out of the cacheable body is what allows one shared object to serve 92% of traffic, and the splice happens on the client.",
        numbers: [{ value: "~5ms", explain: "Negligible next to the CDN's ~20ms shell response, so paying it on every logged-in view beats losing the 92% shared cache by baking personalisation into the cached body." }],
        breaks: {
          failure: "If the client blocks the first paint on this call, the cached shell arrives in 20ms and is then held hostage.",
          handled: "First paint must never wait on this edge, since it has to reach the origin every single time and cannot be edge cached.",
        },
      },
    },
    {
      id: "e8",
      from: "shelf-svc",
      to: "shelvings",
      tier: "hot",
      step: 4,
      label: "one ~120B row, ~8ms",
      detail: {
        what: "The shelving, rating or review write: a single-partition append keyed by user_id and clustered by (shelf_id, added_at).",
        why: "Clustering by shelf and time means a shelf is an ordered range in one partition. Both the write and the later cursor page are single-partition operations with no sort and no offset.",
        numbers: [
          { value: "~8ms, p99 < 150ms", explain: "The write latency this edge sustains, dominated by a single-partition append rather than any coordination." },
          { value: "~750 writes/s at peak", explain: "The peak load this edge carries, matching the write-side peak everywhere else in the design." },
        ],
        breaks: {
          failure: "A CSV import of 30k books hits one partition as fast as the client can send.",
          handled: "Bulk paths need their own rate limit separate from the interactive one, so an import cannot starve ordinary shelving writes.",
        },
      },
    },
    {
      id: "e9",
      from: "shelf-svc",
      to: "kafka",
      tier: "hot",
      step: 5,
      label: "rating + activity events",
      detail: {
        what: "An event emitted after the row is written, carrying the rating delta for aggregation and the action for the follower feed.",
        why: "The user write returns as soon as its own row is durable. Aggregation, fanout and reindexing are all consumers, so none of them can add latency to, or fail, the action the reader actually took.",
        numbers: [
          { value: "one event per action", explain: "The event granularity, matching the write granularity one for one." },
          { value: "1 UUID per event for dedupe", explain: "The mechanism that lets at-least-once delivery never double count a star on the consumer side." },
        ],
        breaks: {
          failure: "A rating edit has to carry a delta computed from the user's previous value.",
          handled: "This is only safe because that row is single-writer per user, so no concurrent edit can race the delta computation.",
        },
      },
    },
    {
      id: "e10",
      to: "aggregates",
      tier: "hot",
      step: 6,
      from: "kafka",
      label: "aggregate-update events",
      detail: {
        what: "The stream processor consuming rating events in order and deduping on event UUID.",
        why: "At-least-once delivery would otherwise double count a star, and the fix has to live at the consumer because the producer cannot know whether its send was retried.",
        numbers: [{ value: "freshness SLO p99 < 60s", explain: "The staleness bound this edge must keep consumers inside, well within the CDN's own 5-minute cache window." }],
        breaks: {
          failure: "Consumer lag is the failure that shows up as a wrong number on a page rather than as an error.",
          handled: "Lag is alerted on directly rather than inferred from latency, since a silently wrong average would otherwise go unnoticed until the nightly reconciliation.",
        },
      },
    },
    {
      id: "e12",
      from: "catalog-store",
      to: "er-pipeline",
      tier: "control",
      label: "300M editions, nightly",
      offset: 110,
      detail: {
        what: "The full edition corpus read into the nightly dedup pass, alongside the ~200k new or changed records arriving from feeds each day.",
        why: "Blocking has to be recomputed over everything rather than only the new records, because a new record can reveal that two existing works were always the same book.",
        numbers: [
          { value: "~300M editions in", explain: "The full corpus size this edge reads on every pass, not just the day's new arrivals." },
          { value: "~80M blocks, ~500M scored pairs", explain: "The blocking output that makes the pass tractable, reducing the raw pairwise count by many orders of magnitude." },
          { value: "~8 min of wall clock on 200 cores", explain: "The actual compute time for one nightly pass once blocking has done its job." },
        ],
        breaks: {
          failure: "Ingest validation matters here: a failed ISBN check digit is not a reason to discard a record.",
          handled: "It is evidence that a human typed the field by hand, so the record is kept and resolved on its other fields instead of dropped.",
        },
      },
    },
    {
      id: "e13",
      from: "er-pipeline",
      to: "clusters",
      tier: "control",
      label: "cluster ptr + log entry",
      detail: {
        what: "The merge itself: union two clusters, mark one superseded, and append the score, evidence, actor and both pre-merge memberships to the log.",
        why: "Everything about reversibility depends on this being the only write a merge performs. Merge and unmerge become the same code path with the membership list supplied from a different place, which is the property that makes anyone willing to press the button.",
        numbers: [
          { value: "~2M auto-merges per pass at >= 0.92", explain: "Even at the 99.5% precision SLO, 0.5% of 2M is 10,000 wrong merges every pass — the residual the moderator queue and reversible log exist to catch." },
          { value: "~400k pairs queued in the 0.75 to 0.92 band", explain: "About a fifth the volume of the auto-merge batch — the backlog size the moderator queue has to sustain every single night, not just occasionally." },
        ],
        breaks: {
          failure: "A model change that merges a wave of false pairs.",
          handled: "Auto-merges per hour are capped, and any merge where both sides have over 1000 ratings needs human sign-off, which bounds the damage from a bad model deploy.",
        },
      },
    },
    {
      id: "e14",
      from: "er-pipeline",
      to: "aggregates",
      tier: "control",
      label: "recompute after merge",
      detail: {
        what: "An enqueued full recompute of the surviving work's average and histogram once its cluster membership has changed.",
        why: "Incremental increments have no correct delta to apply when membership itself moves, so the merged work is the one case where the expensive path is the only correct one.",
        numbers: [{ value: "cluster writes plus recompute ~15 min per pass", explain: "The end-to-end time for this edge's work on one nightly pass, including the recompute it triggers." }],
        breaks: {
          failure: "2M merges enqueue 2M recomputes at once.",
          handled: "Application is rate limited per hour and prioritised by rating count, which leaves low-traffic duplicates lingering for a day rather than overloading the aggregate store.",
        },
      },
    },
    {
      id: "e15",
      from: "er-pipeline",
      to: "search",
      tier: "control",
      label: "reindex off merge log",
      detail: {
        what: "Incremental index updates driven from the merge log, with a nightly full rebuild into a parallel index swapped in atomically.",
        why: "Every merge changes a work document and its edition list, and reindexing 90M works takes hours. The serving index has to be patched from the log rather than rebuilt on each change.",
        numbers: [
          { value: "~90M work documents", explain: "The full index size, which is why a full rebuild is reserved for the nightly cycle rather than done per change." },
          { value: "2 gates before swap: document count and smoke queries", explain: "The safety checks a rebuilt index must pass before it replaces the live one." },
        ],
        breaks: {
          failure: "A merge that has not reached the index yet leaves both the merged-away work and its survivor in results.",
          handled: "That reads to the user as the duplicate they just reported, which is why incremental reindexing off the merge log runs continuously rather than only nightly.",
        },
      },
    },
    {
      id: "e16",
      from: "shelvings",
      to: "recommender",
      tier: "control",
      label: "nightly columnar dump",
      detail: {
        what: "A nightly export of the shelvings table into columnar files partitioned by edition, which the batch jobs read.",
        why: "Co-occurrence needs unfiltered book-side reads, which is exactly what the serving store refuses to provide. Putting it in a dump means the recommender gets its scan without anything paging on a 600MB partition.",
        numbers: [{ value: "~5B shelvings scanned offline", explain: "The full row count this edge exports each night for the recommender to scan." }],
        breaks: {
          failure: "The dump is a day stale, so a book shelved this morning does not influence recommendations until tomorrow.",
          handled: "That is invisible for a weekly-cadence product, so the design accepts a day of lag rather than paying for a live feed.",
        },
      },
    },
    {
      id: "e17",
      from: "recommender",
      to: "shelf-svc",
      tier: "control",
      label: "daily list per user",
      offset: 130,
      detail: {
        what: "The precomputed per-user recommendation list, served as a plain list read rather than scored at request time.",
        why: "Nothing about this product needs recommendations computed live: the reading cadence is weekly. A day-old list is indistinguishable from a fresh one, and the serving path stays a single lookup.",
        numbers: [{ value: "one list per user per day", explain: "The refresh cadence this edge delivers, matched to a weekly reading cadence rather than to request-time freshness." }],
        breaks: {
          failure: "If the batch job fails, an empty shelf reads as a broken product.",
          handled: "The design serves yesterday's list first, and a popularity-plus-genre fallback after that, since a stale list reads as normal while an empty one does not.",
        },
      },
    },
  ],
};
