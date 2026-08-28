import type { Diagram } from "./types";

export const GOODREADS: Diagram = {
  id: "goodreads",
  title: "Goodreads",
  question: "Design Goodreads (Book Catalog, Shelves & Reviews)",
  sourceId: "patterns",
  itemId: 45,
  overview: {
    shape:
      "A read-dominated catalogue whose primary key is a guess: book pages are static enough to live at the CDN edge, while an offline pipeline decides, and keeps re-deciding, which of 300M dirty edition records describe the same book.",
    beats: [
      "The read path is almost entirely cache. A book page is byte-identical for every viewer and it is the organic-search surface, so the anonymous shell (work metadata, edition list, aggregate rating, histogram, top ten reviews) is a CDN object on a five minute TTL, returning in ~20ms at a 92% hit rate.",
      "Personalised state is deliberately not in that body. A logged-in reader gets the same cached shell plus a separate ~5ms call for shelf, progress and their own rating, spliced in on the client. Splitting personalised state out of the cacheable body is the single biggest lever in the whole design.",
      "Writes are small, rare and asynchronous. Shelving is one ~120B row partitioned by user_id at ~8ms, and a rating is a row plus an event; peak is ~750/s across 4M DAU. The work average is folded incrementally off the event log rather than recomputed over 1.8B rating rows.",
      "Identity is inferred rather than looked up. Records arrive from publisher feeds, library records and members disagreeing on title, author spelling, page count and year. Pairwise comparison of 300M records is 4.5x10^16 pairs, so blocking on title tokens plus a folded author surname plus language cuts it to ~500M.",
      "A merge writes pointers and nothing else. Above 0.92 the pipeline unions two clusters, 0.75 to 0.92 goes to a moderator queue, and every merge appends the full pre-merge membership of both sides to a log. No review row is ever rewritten, which is what makes unmerge a replay rather than a restore.",
      "Everything downstream hangs off those same stores offline. Search reindexes incrementally from the merge log with a nightly full rebuild swapped in atomically, and the recommender reads a nightly dump of shelvings, discounting item scores by count^0.5 so the head does not eat every slot.",
    ],
    crux:
      "work_id looks like a primary key and behaves like a hypothesis. Under-merging splits a book's ratings across two pages, which is annoying and recoverable; over-merging puts 900 reviews of a horror novel on a children's picture book, which gets screenshotted. Since no threshold is safe, every merge has to be a reversible pointer write rather than a data migration.",
    numbers: [
      "4.5x10^16 pairs, ~500M after blocking",
      "92% CDN hit at ~9k views/s peak",
      "~750/s peak writes, ~16:1 read:write",
    ],
  },
  nodes: [
    {
      id: "offline-group",
      label: "Offline (batch)",
      kind: "zone",
      x: 16,
      y: 656,
      w: 328,
      h: 226,
      detail: {
        what: "The two batch jobs that write into the serving stores rather than serving traffic themselves.",
        why: "Catalogue correctness and recommendation quality both tolerate hours of latency, so they are deliberately pushed off the request path. Losing this whole region is not an outage: the serving path keeps using the last published cluster table and recommendation lists.",
        numbers: ["full dedup pass runs in under an hour", "batch region loss is tolerable for hours"],
        breaks:
          "A pipeline change that merges 2M pairs in one pass enqueues 2M aggregate recomputes and reindexes at once, so merge application is rate limited per hour and prioritised by rating count.",
      },
    },
    {
      id: "client",
      label: "Reader / search crawler",
      sub: "~250M page views/day",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The reader's browser or app, plus the search-engine crawlers that make book pages the acquisition surface.",
        why: "Drawn because roughly 90% of book page views are anonymous or render identically for everyone, and that fact is what licenses caching the entire shell at the edge and doing the personalised splice on the client.",
        numbers: ["~250M views/day, ~2.9k/s average", "~9k/s at 3x peak", "~4M DAU out of ~150M accounts"],
        breaks:
          "A client that waits for the shelf-state call before painting throws the CDN win away, because the page then blocks on a request that can never be edge cached.",
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "anon shell, 5 min TTL",
      kind: "service",
      x: 40,
      y: 90,
      w: 280,
      detail: {
        what: "Edge cache holding the anonymous page shell: work metadata, edition list, aggregate rating, histogram and top ten reviews.",
        why: "Read to write is ~16:1 at the request level and closer to 100:1 once you count per-page fan-out, on content that is identical for every viewer. The cache is not an optimisation here, it is the capacity plan.",
        numbers: ["92% hit rate, ~20ms, p99 < 30ms", "origin sees only ~230 shell renders/s", "5 minute TTL, so a rating shows up to 5 min late"],
        breaks:
          "A purge storm or a cold cache after a deploy sends full read volume at the origin. A hit rate below 85% doubles origin load and is a paging alert rather than a dashboard.",
        choice: {
          pick: "Cache the anonymous shell at the edge, splice personalised state on the client",
          instead: "Render the whole page per user at the origin, or cache a per-user body at the edge.",
          decider:
            "Cacheability. One shared object serves 92% of ~9k views/s in ~20ms and leaves the origin ~230 renders/s; a per-user body has a hit rate of roughly zero, so the origin would have to carry all 9k/s of renders itself.",
          flips:
            "When most of the page genuinely is personalised, a feed for instance, where there is no shared body to cache and the edge only buys you TLS termination.",
        },
      },
    },
    {
      id: "catalog-svc",
      label: "Catalog Service",
      sub: "shell render, ISBN resolve",
      kind: "service",
      x: 40,
      y: 190,
      w: 280,
      detail: {
        what: "Renders the shell on a cache miss: work document, edition list, aggregates, and the top ten review IDs hydrated in one batch read.",
        why: "Everything it touches is small, cached and globally identical, so it is a read-only assembler rather than a transaction owner. It also owns identifier resolution, which returns candidates rather than guessing when an ISBN is ambiguous.",
        numbers: ["work ~1ms, editions ~2ms, aggregate ~1ms", "top-10 reviews ~3ms + ~6ms hydrate", "~40ms server side, p99 ~180ms"],
        breaks:
          "Fan-out latency. Five dependent reads per render means one slow store sets the page p99, which is why review hydration is a single batch read rather than ten point reads.",
        choice: {
          pick: "Assemble from four cache reads and resolve edition to work at read time",
          instead: "Maintain a denormalised page document per work, rewritten on every change.",
          decider:
            "Merge cost. The work is a hypothesis that moves: a prebuilt document would have to be rewritten for all ~2M merges in a pass plus every rating, whereas read-time resolution is one extra ~1ms pointer read on a page that already does four.",
          flips:
            "If cluster resolution ever stops being a point lookup, for example the contains and derived-from graph traversal that translations and omnibuses really need, where a materialised page beats a traversal on the hottest path.",
        },
      },
    },
    {
      id: "shelf-svc",
      label: "Shelf + Review Service",
      sub: "shelve, progress, rate, review",
      kind: "service",
      x: 40,
      y: 320,
      w: 280,
      detail: {
        what: "The write path and the personalised read: shelvings, reading progress, ratings, review bodies and helpfulness votes.",
        why: "User state cannot be shared between viewers, so it is kept out of the cacheable body and served live. The volumes are genuinely small, which is why the interview sits upstream of serving rather than here.",
        numbers: ["shelf write ~8ms, p99 < 150ms", "~185/s average, ~750/s peak, ~2k/s in January", "shelf-state read ~5ms, never edge cached"],
        breaks:
          "Brigading: 40k one-star ratings in six hours before publication. An hourly rate above 20x the trailing 7-day baseline with over half from accounts under 30 days old quarantines new ratings into a holding buffer instead of deleting user content.",
        choice: {
          pick: "Every user row keys on edition_id, partitioned by user_id",
          instead: "Key user content on work_id, which is what the page is actually about.",
          decider:
            "Recovery cost of a bad merge. An edition_id is minted at ingest and never changes; work_id moves for ~2M clusters per pass, so keying on it turns an unmerge into millions of row rewrites across several stores instead of a few hundred pointer writes.",
          flips:
            "A catalogue you author yourself, where the identifier is a key rather than an inference and no row ever has to move between works.",
        },
      },
    },
    {
      id: "kafka",
      label: "Kafka",
      sub: "rating + activity events",
      kind: "queue",
      x: 40,
      y: 440,
      w: 280,
      detail: {
        what: "The durable log carrying aggregate-update events and follower activity away from the request path.",
        why: "A rating write must not wait on aggregate maintenance, feed fanout or search. Events carry a UUID so at-least-once delivery does not double count a star, and the log gives replay after a bad consumer deploy.",
        numbers: ["~750 events/s at peak", "aggregate freshness SLO p99 < 60s", "one event per shelve, rate or review"],
        breaks:
          "Consumer lag or a lost event leaves work averages quietly wrong, which is only caught by the nightly reconciliation that recomputes every work touched in 24h.",
        choice: {
          pick: "Asynchronous events with idempotent UUIDs",
          instead: "Update the aggregate synchronously inside the rating write.",
          decider:
            "Hotspot and blast radius. A book club pick takes 1000x traffic and its aggregate becomes a single hot key; a synchronous update puts that contention inside a p99 < 150ms user write, while the log absorbs it and the SLO only asks for 60s.",
          flips:
            "Small deployments where a rating write can simply take the counter increment, and 60s of eventual consistency is harder to explain to users than it is worth.",
        },
      },
    },
    {
      id: "aggregator",
      label: "Aggregate stream processor",
      sub: "folds ratings into the work",
      kind: "service",
      x: 40,
      y: 540,
      w: 280,
      detail: {
        what: "Consumes rating events and applies atomic increments to (sum_stars, count, histogram[5]) for the work, not the edition.",
        why: "Averaging 1.8B rating rows per page view is absurd and read-modify-write in the application races two simultaneous raters. Commutative increments off an idempotent stream make concurrency a non-issue rather than a lock problem.",
        numbers: ["~1.8B ratings folded incrementally", "displayed average moves within ~30s", "drift alert above 0.01% of works touched"],
        breaks:
          "Drift. Duplicate or dropped events pull the stored value away from the truth silently, so a nightly job recomputes every work touched in the last 24h and alerts on the count that disagrees.",
        choice: {
          pick: "Incremental atomic increments plus nightly reconciliation",
          instead: "Recompute each work average from the ratings table on a schedule.",
          decider:
            "Freshness against cost. The SLO is a new rating reflected within 60s, and a full recompute over 90M works and 1.8B rows cannot run on that cadence, whereas an increment is one INCRBY. Reconciliation only has to cover the works touched in 24h.",
          flips:
            "After a merge or unmerge, where cluster membership itself changed and an incremental delta has no correct value to apply, so that work gets a full recompute.",
        },
      },
    },
    {
      id: "er-pipeline",
      label: "Entity resolution",
      sub: "Spark: normalise, block, score",
      kind: "service",
      x: 40,
      y: 680,
      w: 280,
      detail: {
        what: "Nightly batch plus a streaming path for new records: normalise, block into candidate groups, score pairs on about eight weighted features, then auto-merge, queue for a moderator, or create a new work.",
        why: "The catalogue is not authored in house, it is inferred from sources that disagree in every field. Blocking is what makes the problem finite: ~80M blocks averaging four records, ~500M pairs at ~20us, about 8 minutes of wall clock on 200 cores.",
        numbers: ["~2M auto-merges, ~400k queued pairs per pass", "auto-merge precision SLO >= 99.5%", "new records resolve in ~200ms each"],
        breaks:
          "Blocking-key skew. A block such as Selected Poems can hold 50k records, which is 1.25B pairs stalling one Spark partition, so block size is hard capped at 1000 with a publisher sub-key and the second pass recovers what that loses.",
        choice: {
          pick: "Two exact blocking keys unioned, with cut points at 0.92 and 0.75",
          instead: "One MinHash LSH pass with a stated recall bound and a single threshold.",
          decider:
            "Debuggability, plus the fact that the two errors are not the same size. Auto-merge precision has to clear 99.5% because 0.5% of 2M merges is 10k wrong ones, and when a duplicate is reported you can compute an exact block key by hand and see why two records never met.",
          flips:
            "A catalogue with no second reliable structured field. Books have ISBNs; free-text submissions with only a title have nothing to build a second exact key from, and LSH is then the only thing offering a recall bound.",
        },
      },
    },
    {
      id: "recommender",
      label: "Recommender",
      sub: "batch CF, popularity-discounted",
      kind: "service",
      x: 40,
      y: 790,
      w: 280,
      detail: {
        what: "Offline job producing a per-user list of works, blending collaborative filtering with a content-based path for titles that have no ratings yet.",
        why: "The signal here is thin: one rating per book per user ever, and only ~12% carry any text, so the popularity-skew fix has to be structural rather than a matter of collecting more data.",
        numbers: ["top ~1,000 works hold ~25% of all ratings", "~60% of works have under 10 ratings", "~10% of each list reserved for exploration"],
        breaks:
          "Popularity collapse. Optimising click-through alone drives the list monotonically onto the head, and only catalogue coverage, the fraction of works recommended to at least one user per week, catches it happening.",
        choice: {
          pick: "Popularity-discounted CF plus a content-based cold-start path",
          instead: "Plain co-occurrence collaborative filtering.",
          decider:
            "Signal skew. With ~25% of ratings sitting on ~1,000 works, raw co-occurrence recommends the same fifty bestsellers to everyone forever, so scores are discounted by count^0.5. User-created shelf names such as cosy-mystery are the best cold-start feature available and no publisher feed provides them.",
          flips:
            "A catalogue with dense repeat interaction, music for example where one user replays a track 400 times, where co-occurrence has enough signal on its own.",
        },
      },
    },
    {
      id: "catalog-store",
      label: "Works, editions, identifiers",
      sub: "document store, ~1.8TB at RF=3",
      kind: "database",
      x: 440,
      y: 160,
      w: 260,
      detail: {
        what: "Three levels held deliberately apart: work documents, edition documents, and an identifier index mapping each ISBN or ASIN to a list of edition IDs.",
        why: "An edition is the object a reader is actually holding and a work is the thing ratings aggregate to, so they cannot be one row. The identifier maps to a list because publishers reuse and misassign ISBNs, which is a fact about the world rather than a data-quality bug.",
        numbers: ["~300M editions at ~2KB, ~1.8TB at RF=3", "~90M works at ~1.5KB, ~400GB at RF=3", "~200k new or changed records/day, ~2.3/s"],
        breaks:
          "A feed reusing an ISBN-13. If the index were a unique key the second record either overwrites the first silently or wedges the feed; as a list, resolve returns ambiguous with candidates.",
        choice: {
          pick: "Document store (DynamoDB or MongoDB), identifiers indexed to a list",
          instead: "A relational schema with a books table and a unique ISBN key.",
          decider:
            "The shape of the data. Edition records are ~2KB of sparse, source-specific fields across 300M rows with no joins on the read path, and identifier to edition is genuinely many-to-many in both directions, so a unique key is a claim the first misassigned ISBN disproves.",
          flips:
            "A curated catalogue of a few million titles from clean contracted sources, where relational constraints are an asset rather than a lie about the input.",
        },
      },
    },
    {
      id: "clusters",
      label: "Cluster table + merge log",
      sub: "union-find KV, append-only log",
      kind: "database",
      x: 440,
      y: 260,
      w: 260,
      detail: {
        what: "edition_id to cluster_id to work_id, plus an append-only log of every merge and unmerge with the score, the evidence that fired, the actor, and the full pre-merge membership of both clusters.",
        why: "This is the only thing a merge writes. Keeping the inference in one indirection layer instead of smearing work_id across two billion user rows is what makes revision cost a few hundred writes rather than a restore from backup.",
        numbers: ["a 200-edition merge is a few hundred pointer writes", "both pages correct within ~2 minutes of an unmerge", "100% of merges reversible in one operation"],
        breaks:
          "Undo is last-in-first-out while bad merges surface oldest-first. Once two later merges sit on top, the tooling refuses and a moderator reconstructs memberships from the log by hand, which works at a few a week and nowhere near generally.",
        choice: {
          pick: "Union-find pointers plus a log storing full pre-merge membership",
          instead: "Rewrite every rating, review and shelving row from work A to work B.",
          decider:
            "Reversibility. Merging two 200-edition works is a few hundred pointer writes; rewriting rows is millions of non-atomic updates across several stores that half-apply when the job dies and cannot be undone once the original work_id is gone. Storing full membership rather than a parent pointer is what survives path compression.",
          flips:
            "A catalogue small enough that a merge is one transaction over a few thousand rows, where carrying work_id on the rows is simpler than the indirection.",
        },
      },
    },
    {
      id: "search",
      label: "Search index",
      sub: "OpenSearch, one doc per work",
      kind: "database",
      x: 440,
      y: 360,
      w: 260,
      detail: {
        what: "An inverted index over works with every edition title and author-name variant folded into one document, and ISBN and ASIN as exact-match keyword fields.",
        why: "The same box takes both a title and a 13 digit identifier, and fuzzy-matching an identifier is never what anyone wants. Ranking blends BM25 with a capped popularity prior so a geology textbook mentioning sand dunes does not outrank the novel.",
        numbers: ["~90M work documents", "edit distance 1 to 2 on title tokens", "full rebuild of 90M works takes hours"],
        breaks:
          "Swapping in a partially built index serves empty or wrong results, so rebuilds go into a parallel index and swap only after a document-count and smoke-query gate, with instant rollback to the previous alias.",
        choice: {
          pick: "Index per work with editions folded in, identifiers as keyword fields",
          instead: "Index per edition, and run identifiers through the same analyser as text.",
          decider:
            "Result quality. A bestseller carries 200+ editions, so indexing editions returns 200 near-identical hits for one book, and an analysed ISBN fuzzy-matches neighbouring numbers when a valid check digit should have been a redirect to the book page instead.",
          flips:
            "When editions genuinely differ to the person searching, a retail catalogue for instance where format, price and availability are the thing being chosen between.",
        },
      },
    },
    {
      id: "shelvings",
      label: "Shelvings, ratings, reviews",
      sub: "Cassandra, ~1.8TB at RF=3",
      kind: "database",
      x: 440,
      y: 460,
      w: 260,
      detail: {
        what: "Billions of tiny rows: shelvings and ratings partitioned by user_id and clustered by (shelf_id, added_at), reviews partitioned by edition_id with no work_id column.",
        why: "The read the product actually serves is an ordered slice of one user's shelf, which is a single-partition range read with no sort and no offset. The book side gets counters only, because the most-shelved book has ~5M shelvings.",
        numbers: ["~5B shelvings at ~120B, ~1.8TB at RF=3", "a 30k-book shelf is a ~3.6MB partition", "~220M reviews with text, ~460GB at RF=3"],
        breaks:
          "Hot partitions from a power user or a mass CSV import. Paging is cursor-only over the clustering key, never a full shelf read, and bulk imports are rate limited and collapsed into one activity event.",
        choice: {
          pick: "One copy partitioned by user_id, with counters on the edition side",
          instead: "A second materialised copy partitioned by edition_id for book-side reads.",
          decider:
            "Skew rather than capacity: 5B rows is ~1.8TB at RF=3 and fits on a handful of machines. The two sides are skewed in opposite directions by six orders of magnitude, and every surface that looks like who shelved this is really which of my ~200 follows shelved this, which is ~200 point reads.",
          flips:
            "Follow lists in the tens of thousands, where intersecting 50k follows costs more than one book-side read. Bulk consumers get a nightly columnar dump partitioned by edition instead.",
        },
      },
    },
    {
      id: "aggregates",
      label: "work_aggregates",
      sub: "Redis, sum, count, histogram[5]",
      kind: "database",
      x: 440,
      y: 560,
      w: 260,
      detail: {
        what: "One small row per work holding (sum_stars, count, histogram[5], last_recompute_ts), with a durable store behind Redis.",
        why: "The page needs an average and a star histogram in about a millisecond and there is no version of that which touches rating rows. Publishing the histogram rather than only the mean also makes a brigade visible in the shape of the distribution.",
        numbers: ["~90M rows, ~1ms read", "displayed average updates within ~30s", "fully recomputed after any merge or unmerge"],
        breaks:
          "Single-key write hotspot on a prize winner or book club pick. Above ~500 writes/s the work is promoted to sharded counters keyed on (work_id, hash(user_id) % N) and summed on read, which costs N reads per render.",
        choice: {
          pick: "Redis with a durable backing store",
          instead: "A counter column next to the ratings, or computing the average on read.",
          decider:
            "Origin render latency. Even at a 92% CDN hit the origin still renders ~230 pages/s and budgets ~1ms for this row, and since a merge forces a full recompute anyway, durability can live in the backing store rather than on the hot path.",
          flips:
            "Low traffic, where the aggregate can be a counter column in the ratings store and one fewer system to operate is worth more than the millisecond.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "cdn",
      label: "GET /work/{id}",
      animated: true,
      detail: {
        what: "A book page request, most often arriving cold from a search engine result rather than from inside the product.",
        why: "Book pages are the organic-search surface, so the first hop has to be an edge that can answer without waking the origin. Roughly 90% of these viewers are anonymous or would be served an identical body anyway.",
        numbers: ["~250M requests/day", "~9k/s at peak"],
        breaks:
          "Deep links carry the work_id, so a work that has since been merged away has to redirect rather than 404, or every indexed URL for the superseded side dies.",
      },
    },
    {
      id: "e2",
      from: "cdn",
      to: "catalog-svc",
      label: "miss, ~8% of views",
      animated: true,
      detail: {
        what: "The cache miss that actually reaches the origin and renders a fresh shell.",
        why: "Only 8% of views get here, which is the entire reason the origin fleet is small. Request coalescing per POP and stale-while-revalidate keep a hot work from turning one expiry into a thundering herd.",
        numbers: ["~230 shell renders/s at the origin", "5 minute TTL"],
        breaks:
          "A staggered purge that is not staggered, or a cold cache after a deploy, turns 8% into 100% instantly and the origin has to load-shed to the last-good shell without personalisation.",
      },
    },
    {
      id: "e3",
      from: "catalog-svc",
      to: "catalog-store",
      label: "work + edition list",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the work document and its edition list to build the page body.",
        why: "The whole works table is ~400GB at RF=3, small enough to sit in a cache tier, which is precisely why book pages are cheap to serve and why the interview is not about this read.",
        numbers: ["work ~1ms, editions ~2ms"],
        breaks:
          "A work with 200+ editions makes this list the largest thing on the page, so the edition list has to be paged or truncated rather than returned whole.",
      },
    },
    {
      id: "e4",
      from: "catalog-svc",
      to: "clusters",
      label: "edition to work, ~1ms",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Resolving the edition a review or shelving was written against into the work currently being displayed.",
        why: "This indirection is the price of keeping work_id off two billion user rows. It is paid once per render as a point read, and it is what turns an unmerge into a pointer rewrite rather than a data migration.",
        numbers: ["one point read per render"],
        breaks:
          "If this ever becomes a graph traversal, which is what translations and omnibuses actually need, the hottest path in the system gains a variable-cost step.",
      },
    },
    {
      id: "e5",
      from: "catalog-svc",
      to: "aggregates",
      label: "avg + histogram",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the precomputed (sum_stars, count, histogram[5]) row for the work being rendered.",
        why: "The alternative is aggregating rating rows at render time, which nobody would do at 1.8B ratings. The histogram is fetched alongside the mean because a brigade is obvious in the distribution and invisible in the average.",
        numbers: ["~1ms", "one row per work"],
        breaks:
          "If the aggregate is missing or stale after a merge the page shows a confidently wrong number, which is worse than a slow page, so recompute is enqueued on every cluster change.",
      },
    },
    {
      id: "e6",
      from: "catalog-svc",
      to: "search",
      label: "title, author or ISBN",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Query traffic from the search box, routed by shape before it is executed.",
        why: "A 10 or 13 digit string with a valid check digit is not a text query; it goes to identifier resolution and redirects straight to the book page. Everything else goes to the inverted index with typo tolerance on title tokens.",
        numbers: ["edit distance 1 to 2 on title tokens"],
        breaks:
          "Ranking on BM25 alone surfaces documents that merely mention the word often; the popularity prior that fixes it is also what makes new books invisible, so it has to be capped.",
      },
    },
    {
      id: "e7",
      from: "client",
      to: "shelf-svc",
      label: "/me/shelf-state, ~5ms",
      animated: true,
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "The second, tiny call a logged-in reader makes: shelf, progress percentage and their own rating for this work.",
        why: "It bypasses the CDN entirely and on purpose. Keeping personalised state out of the cacheable body is what allows one shared object to serve 92% of traffic, and the splice happens on the client.",
        numbers: ["~5ms", "never edge cached"],
        breaks:
          "If the client blocks the first paint on this call, the cached shell arrives in 20ms and is then held hostage by a request that has to reach the origin every single time.",
      },
    },
    {
      id: "e8",
      from: "shelf-svc",
      to: "shelvings",
      label: "one ~120B row, ~8ms",
      fromSide: "right",
      toSide: "left",
      animated: true,
      detail: {
        what: "The shelving, rating or review write: a single-partition append keyed by user_id and clustered by (shelf_id, added_at).",
        why: "Clustering by shelf and time means a shelf is an ordered range in one partition, so both the write and the later cursor page are single-partition operations with no sort and no offset.",
        numbers: ["~8ms, p99 < 150ms", "~750 writes/s at peak"],
        breaks:
          "A CSV import of 30k books hits one partition as fast as the client can send, so bulk paths need their own rate limit separate from the interactive one.",
      },
    },
    {
      id: "e9",
      from: "shelf-svc",
      to: "kafka",
      label: "rating + activity events",
      animated: true,
      detail: {
        what: "An event emitted after the row is written, carrying the rating delta for aggregation and the action for the follower feed.",
        why: "The user write returns as soon as its own row is durable. Aggregation, fanout and reindexing are all consumers, so none of them can add latency to, or fail, the action the reader actually took.",
        numbers: ["one event per action", "UUID per event for dedupe"],
        breaks:
          "A rating edit has to carry a delta computed from the user's previous value, which is only safe because that row is single-writer per user.",
      },
    },
    {
      id: "e10",
      from: "kafka",
      to: "aggregator",
      label: "aggregate-update events",
      animated: true,
      detail: {
        what: "The stream processor consuming rating events in order and deduping on event UUID.",
        why: "At-least-once delivery would otherwise double count a star, and the fix has to live at the consumer because the producer cannot know whether its send was retried.",
        numbers: ["freshness SLO p99 < 60s"],
        breaks:
          "Consumer lag is the failure that shows up as a wrong number on a page rather than as an error, so lag is alerted on directly rather than inferred from latency.",
      },
    },
    {
      id: "e11",
      from: "aggregator",
      to: "aggregates",
      label: "atomic INCRBY",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Folding one rating into the work row: increment sum_stars, increment count, bump one histogram bucket.",
        why: "Increments commute, so two readers rating the same book in the same instant cannot race. That is the property that removes the need for any read-modify-write or lock on the hottest counter in the system.",
        numbers: ["displayed average moves within ~30s"],
        breaks:
          "Increments cannot repair drift, so a nightly reconciliation recomputes every work touched in 24h and alerts when more than ~0.01% disagree.",
      },
    },
    {
      id: "e12",
      from: "catalog-store",
      to: "er-pipeline",
      label: "300M editions, nightly",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 110,
      detail: {
        what: "The full edition corpus read into the nightly dedup pass, alongside the ~200k new or changed records arriving from feeds each day.",
        why: "Blocking has to be recomputed over everything rather than only the new records, because a new record can reveal that two existing works were always the same book.",
        numbers: ["~300M editions in", "~80M blocks, ~500M scored pairs", "~8 min of wall clock on 200 cores"],
        breaks:
          "Ingest validation matters here: a failed ISBN check digit is not a reason to discard a record, it is evidence that a human typed the field by hand.",
      },
    },
    {
      id: "e13",
      from: "er-pipeline",
      to: "clusters",
      label: "cluster ptr + log entry",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The merge itself: union two clusters, mark one superseded, and append the score, evidence, actor and both pre-merge memberships to the log.",
        why: "Everything about reversibility depends on this being the only write a merge performs. Merge and unmerge become the same code path with the membership list supplied from a different place, which is the property that makes anyone willing to press the button.",
        numbers: ["~2M auto-merges per pass at >= 0.92", "~400k pairs queued in the 0.75 to 0.92 band"],
        breaks:
          "A model change that merges a wave of false pairs, which is why auto-merges per hour are capped and any merge where both sides have over 1000 ratings needs human sign-off.",
      },
    },
    {
      id: "e14",
      from: "er-pipeline",
      to: "aggregates",
      label: "recompute after merge",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "An enqueued full recompute of the surviving work's average and histogram once its cluster membership has changed.",
        why: "Incremental increments have no correct delta to apply when membership itself moves, so the merged work is the one case where the expensive path is the only correct one.",
        numbers: ["cluster writes plus recompute ~15 min per pass"],
        breaks:
          "2M merges enqueue 2M recomputes at once, so application is rate limited per hour and prioritised by rating count, which leaves low-traffic duplicates lingering for a day.",
      },
    },
    {
      id: "e15",
      from: "er-pipeline",
      to: "search",
      label: "reindex off merge log",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "Incremental index updates driven from the merge log, with a nightly full rebuild into a parallel index swapped in atomically.",
        why: "Every merge changes a work document and its edition list, and reindexing 90M works takes hours, so the serving index has to be patched from the log rather than rebuilt on each change.",
        numbers: ["~90M work documents", "swap gated on doc count and smoke queries"],
        breaks:
          "A merge that has not reached the index yet leaves both the merged-away work and its survivor in results, which reads to the user as the duplicate they just reported.",
      },
    },
    {
      id: "e16",
      from: "shelvings",
      to: "recommender",
      label: "nightly columnar dump",
      dashed: true,
      fromSide: "bottom",
      toSide: "right",
      detail: {
        what: "A nightly export of the shelvings table into columnar files partitioned by edition, which the batch jobs read.",
        why: "Co-occurrence needs unfiltered book-side reads, which is exactly what the serving store refuses to provide. Putting it in a dump means the recommender gets its scan without anything paging on a 600MB partition.",
        numbers: ["~5B shelvings scanned offline"],
        breaks:
          "The dump is a day stale, so a book shelved this morning does not influence recommendations until tomorrow, which is invisible for a weekly-cadence product.",
      },
    },
    {
      id: "e17",
      from: "recommender",
      to: "shelf-svc",
      label: "daily list per user",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 130,
      detail: {
        what: "The precomputed per-user recommendation list, served as a plain list read rather than scored at request time.",
        why: "Nothing about this product needs recommendations computed live: the reading cadence is weekly, so a day-old list is indistinguishable from a fresh one and the serving path stays a single lookup.",
        numbers: ["one list per user per day"],
        breaks:
          "If the batch job fails, serve yesterday's list, and failing that a popularity-plus-genre fallback, because an empty shelf reads as a broken product while a stale one reads as normal.",
      },
    },
  ],
};
