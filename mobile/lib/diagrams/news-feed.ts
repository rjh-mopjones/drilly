import type { Diagram } from "./types";

export const NEWS_FEED: Diagram = {
  id: "news-feed",
  title: "News Feed",
  question: "Design a News Feed System (Facebook, Twitter)",
  sourceId: "patterns",
  itemId: 8,
  overview: {
    shape:
      "A feed is a materialised join between the posts table and the follow graph, and the entire design is one decision about when you compute that join: on write for ordinary authors, on read for the handful too large to push, merged together when the reader opens the app.",
    beats: [
      "The write path is durable first and delivered afterwards. The post service writes to the posts store, waits for a quorum, returns success, and only then publishes a fan-out event. Delivery is asynchronous because nobody is waiting on it, and the ack must not be hostage to 500 cache writes.",
      "The fan-out worker is where the fork lives. It reads the author's follower count from a single classification record and compares it to 10,000. Under the line it pages the follower list, skips anyone dormant for 30 days, and pipelines ZADD plus trim into each survivor's timeline. Over the line it does one append to the author's own recent-posts list and stops.",
      "Timelines hold post ids and never bodies, capped at 1000 entries. That cap is about 2.5 days of feed for a 200-follow user, and it doubles as the garbage collector: a duplicate, a post from an account since unfollowed, an id from a bad deploy all age out within two days without anyone having to go and find them.",
      "The read path merges the two delivery routes. The feed service issues one ZREVRANGE against the reader's pushed timeline and a pipelined read of the recent-posts list for each large account they follow, typically eight and hard-capped at 25, then merges by score, deduplicates by post id, and truncates to 500 candidates in about 5ms of round trips.",
      "Ranking runs on the read path because the signals that decide the order, engagement in the last hour, do not exist at write time and differ per reader. A cheap first stage trims 500 to 100 at ~5ms, a deep model scores the survivors at ~30ms, and the ranked result is cached per user for 5 minutes to absorb intra-session refreshes.",
      "Hydration is the correctness boundary. Turning 50 ids into 50 posts is where deletes, blocks, suspensions and regional restrictions are enforced against the source of truth, which is precisely why timelines can hold ids and be treated as disposable derived state: a delete is one write, not a rewrite of 100 million cached lists.",
    ],
    crux:
      "The threshold is not a per-post cost comparison, because amortised over a day the follower count cancels: push costs 10F writes and pull costs 5F reads at every value of F. What actually breaks is concentration, one burst of 100 million writes landing on one cluster in one moment, so the number is bracketed from two directions instead of derived from one equation. The read side sets the floor at ~1,000 because the merge cannot exceed ~25 pull sources inside a 30ms budget; the write side sets the ceiling at ~30,000 because pulling the middle tier back onto the push path adds ~7M writes/s to a cluster already at 5.8M/s against a 15M/s ceiling.",
    numbers: [
      "10,000 followers: push below, pull above",
      "~5.8M cache writes/s, ~2.3M/s after dormant filtering",
      "12.5B feed loads/day against 1B posts/day, 200ms p95",
      "timeline = 1000 ids, ~12TB of Redis sorted sets",
    ],
  },
  nodes: [
    {
      id: "delivery-group",
      label: "Two delivery paths",
      kind: "zone",
      x: 424,
      y: 384,
      w: 272,
      h: 228,
      detail: {
        what: "The push store and the pull store, side by side: the entire hybrid lives in these two keys and the rule that picks between them.",
        why: "Everything else in the diagram is conventional. What makes this a news feed rather than a CRUD app is that one post lands in one of these two places depending on how big its author is, and the read path has to reconcile that at query time.",
        numbers: ["tl:{user_id} capped at 1000", "ar:{author_id} capped at 200"],
        breaks:
          "An author who is in neither store, because the write path already thinks they are large and the read path does not, is invisible to every follower with no error raised anywhere.",
      },
    },
    {
      id: "client-write",
      label: "Client · post",
      sub: "POST /post",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The app posting content: text, media references, nothing else.",
        why: "Drawn explicitly because it sets the latency contract for the write path. The user is waiting for one durable write and nothing more, which is what buys the design permission to make delivery asynchronous.",
        numbers: ["~12k posts/s steady", "~60k/s during a global event"],
        breaks:
          "Scheduled prompts (a 'post your year in review' banner at midnight UTC) turn independent clients into one synchronised 10x write spike.",
      },
    },
    {
      id: "post-service",
      label: "Post service",
      sub: "ack on durable quorum",
      kind: "service",
      x: 40,
      y: 100,
      w: 280,
      detail: {
        what: "Writes the post to the posts store, waits for a durable quorum, returns the post id, then publishes a fan-out event.",
        why: "The ordering is the whole point. Acking after the durable write and before delivery means a post is never lost and never blocks on 500 cache writes, so a celebrity and an ordinary user get the same posting latency.",
        numbers: ["~12k posts/s steady, ~60k/s burst", "~1KB of post metadata per row"],
        breaks:
          "Publishing the fan-out event before the durable write succeeds delivers ids for a post that does not exist, and every hydration of them silently returns nothing.",
        choice: {
          pick: "Ack after the durable quorum write, publish the fan-out event afterwards",
          instead: "Ack only once fan-out has completed, or publish the event first and write asynchronously.",
          decider:
            "What the poster waits on. Waiting for delivery means an author with 500 followers waits for 500 cache writes and one with 9,999 waits for 9,999, so posting latency becomes a function of popularity. Publishing first inverts the failure into lost content, which is unrecoverable rather than merely late.",
          flips:
            "A system where a post must be visible to its own author's feed synchronously, such as a small team tool, where fan-out is a handful of writes and doing it inline is simpler than a queue.",
        },
      },
    },
    {
      id: "fanout-bus",
      label: "Fan-out bus",
      sub: "Kafka, partitioned by author_id",
      kind: "queue",
      x: 40,
      y: 210,
      w: 280,
      detail: {
        what: "A partitioned durable log carrying one delivery event per post to the fan-out workers.",
        why: "It absorbs the 5x event burst that the cache cluster cannot, and the partition key is the design's only ordering guarantee: two posts by the same author land on the same consumer in the order they were written, so a follower never sees a reply above the thing it replies to from the same account.",
        numbers: ["partition key = author_id", "~12k events/s steady, ~60k/s burst"],
        breaks:
          "Nothing orders posts across authors, so a second account's reply can be delivered and ranked above the post it refers to, and with a timestamp score it stays there.",
        choice: {
          pick: "Kafka, partitioned by author_id",
          instead: "Synchronous fan-out inside the post service, or a work queue with no partition key.",
          decider:
            "Burst absorption plus per-author ordering. A global event pushes posts from 12k/s to 60k/s while the cache cluster ceiling is fixed at ~15M writes/s, so delivery has to be allowed to lag and drain. An unkeyed queue gives you the buffering but loses the one ordering property worth having.",
          flips:
            "Under roughly a million users, where total fan-out fits inside the request that created it and a broker is pure operational cost.",
        },
      },
    },
    {
      id: "fanout-worker",
      label: "Fan-out worker",
      sub: "push under 10k, pull over",
      kind: "service",
      x: 40,
      y: 320,
      w: 280,
      detail: {
        what: "Consumes a delivery event, reads the author's classification, and either pushes the post id into every active follower's timeline or does one append to the author's own recent-posts list.",
        why: "This is the fork the whole question turns on. Putting the branch in an async worker rather than on the write path means the expensive case, an author just under the threshold with 9,999 followers, costs the poster nothing and is allowed to take seconds.",
        numbers: [
          "~500 followers per posting account under the threshold",
          "~2.3M inserts/s after dormant filtering, ~50 workers at 50k/s each",
          "pages of 10,000 followers, ~500 ZADDs per round trip",
        ],
        breaks:
          "Worker lag is invisible from the write path: posting still succeeds, the queue simply drains later, so freshness degrades with no request ever failing.",
        choice: {
          pick: "Hybrid fan-out at 10,000 followers, filtered to 30-day-active followers",
          instead: "Pull for everyone with each author's recent posts cached hot, or a static threshold on total followers.",
          decider:
            "Both bounds are capacity, not principle. Below ~1,000 a 200-follow reader carries ~40 pull sources against a ~30ms merge budget that fits ~25; above ~30,000 the 10k-to-100k tier returns to the push path and adds ~7M writes/s to a 5.8M/s baseline under a ~15M/s ceiling. Filtering dormant followers cuts that baseline to ~2.3M/s, because with 500M DAU against 2.5B accounts ~60% of pushes are never read.",
          flips:
            "A flat graph with under ~30 follows per user and no account two orders of magnitude above the median. Pure pull merges 30 hot keys, needs no threshold, no crossing logic and no fan-out fleet, and gets deletes and privacy for free. Also when registered-to-active is near 1, where there is nothing to filter and a static number beats a counter pipeline.",
        },
      },
    },
    {
      id: "author-stats",
      label: "Author stats",
      sub: "follower_count, is_large, crossed_at",
      kind: "database",
      x: 440,
      y: 100,
      w: 240,
      detail: {
        what: "One row per author holding total and active follower counts, the large/small classification, and when it last crossed.",
        why: "It exists so that exactly one place answers 'is this author pushed or pulled'. The write path and the read path both read it, and if they ever disagree an author is neither pushed nor pulled and disappears from every follower's feed.",
        numbers: ["recomputed on a daily batch", "24h dual-mode window on crossing"],
        breaks:
          "The counter is batch-recomputed while follows arrive continuously, so it is always stale; stale towards 'already large' on the write side is the silent failure the dual-mode window exists to cover.",
        choice: {
          pick: "One classification record read by both paths, plus a 24h dual-mode window on crossing",
          instead: "Each path computing author size independently from the follow graph at request time.",
          decider:
            "Disagreement rate. Counting 100 million edges per decision is not affordable on either path, so both read a cached number, and two independently cached numbers diverge. One record makes the staleness shared rather than divergent, and the 24h window costs one day of double writes for the handful of accounts crossing daily.",
          flips:
            "Graphs small enough to count exactly per request, where a live count removes the counter pipeline, the batch job and the crossing transition entirely.",
        },
      },
    },
    {
      id: "follow-graph",
      label: "Follow graph",
      sub: "wide-column, indexed both ways",
      kind: "database",
      x: 440,
      y: 230,
      w: 240,
      detail: {
        what: "The (follower_id, followee_id) edge set, indexed forwards for fan-out and backwards for the reader's large-account set.",
        why: "Both directions are hot for different reasons: the worker needs 'who follows this author' to deliver, the feed service needs 'which of this reader's follows are large' to build the pull set. One direction indexed means the other is a scan.",
        numbers: ["~100B edges, ~200 follows per user", "big_follows set per reader, ~8 typical, capped at 25"],
        breaks:
          "Follow and unfollow propagation lags, so a reader keeps receiving posts from an account they dropped until the next timeline rebuild ages them out.",
        choice: {
          pick: "Wide-column store with both-direction indexes, on hardware separate from the timeline tier",
          instead: "A graph database, or co-locating the graph with the timeline store.",
          decider:
            "Workload isolation more than query shape. These are single-key adjacency reads at 100B edges, not traversals, so a graph engine buys nothing. Co-location is the real trap: a viral post's fan-out triggers compactions that starve graph queries on the same nodes, which is exactly what pushed Twitter to split timelines out of Manhattan.",
          flips:
            "When the product needs real traversals, friends-of-friends or shortest-path recommendations, where an adjacency table forces you to hand-roll what a graph engine already does.",
        },
      },
    },
    {
      id: "timeline-cache",
      label: "Timeline cache",
      sub: "Redis ZSET tl:{user}, cap 1000",
      kind: "database",
      x: 440,
      y: 400,
      w: 240,
      detail: {
        what: "One sorted set per active user holding post ids scored by timestamp, trimmed to 1000 entries.",
        why: "This is the prebuilt half of the feed and the reason an ordinary load is one round trip. Storing ids rather than bodies is what makes it disposable: it is derived state, never replicated across regions, and a lost shard is rebuilt lazily rather than restored.",
        numbers: [
          "~24B per entry, 500M users x 1000 ids = ~12TB",
          "~100 shards at ~120GB each",
          "1000 entries = ~400 posts/day = ~2.5 days of feed",
        ],
        breaks:
          "A timeline can hold a full 1000 ids that hydrate down to 40 usable posts after deletes and blocks, and the write path is oblivious because fan-out did deliver the ids.",
        choice: {
          pick: "Redis sorted sets, one per user, capped at 1000 with score = timestamp",
          instead: "A wide-column row per user on disk, or an unbounded list.",
          decider:
            "The cap is the design, not the substrate. 1000 ids is ~2.5 days of feed at 24KB per user and ~12TB across the fleet; going to 3000 to cover weekly users triples that to ~36TB of RAM at 10 to 50x the per-GB cost of disk, and extends the lifetime of every bad entry proportionally.",
          flips:
            "Past roughly 100M DAU the RAM economics stop working and the cold tail moves to a wide-column store with Redis kept only for the active working set, which is exactly the move Instagram made around 2013.",
        },
      },
    },
    {
      id: "author-recent",
      label: "Author recent posts",
      sub: "Redis ZSET ar:{author}, cap 200",
      kind: "database",
      x: 440,
      y: 520,
      w: 240,
      detail: {
        what: "One sorted set per large account holding its last ~200 post ids, written once per post regardless of follower count.",
        why: "It is the pull half of the hybrid and the cheapest thing in the system: every follower of that account reads the same key, so a hundred million readers collapse onto one hot key, which is the access pattern a cache is best at.",
        numbers: ["one write per post, not F writes", "~200 ids per account, 20 read per feed load"],
        breaks:
          "If this key is stale or unavailable the account vanishes from every follower's feed at once, with no push copy to fall back on; recovery is an author partition scan over a small recent window.",
        choice: {
          pick: "A per-author sorted set read by every follower at query time",
          instead: "Pushing the post to all 100M followers like any other author.",
          decider:
            "Concentration, not total cost. At ~0.5ms of worker time per insert, 100M followers is 14 hours serial and ~50 seconds across 1000 workers, and for those 50 seconds the cache cluster is saturated with one person's post while every other author's fan-out queues behind it.",
          flips:
            "Pushing large accounts to their small, highly engaged follower subset would beat this, but that is a third delivery mode and it is not built.",
        },
      },
    },
    {
      id: "feed-service",
      label: "Feed service",
      sub: "merge + dedupe by post id",
      kind: "service",
      x: 40,
      y: 460,
      w: 280,
      detail: {
        what: "Reads the pushed timeline and the pull sources concurrently, merges by score, deduplicates by post id, and truncates to 500 candidates.",
        why: "This is where the two delivery paths become one feed. Deduplication by post id is not an optimisation: during the 24h dual-mode window a crossing author's post arrives by both routes, so the merge has to be idempotent by construction rather than by luck.",
        numbers: [
          "~2ms timeline read, ~2ms pipelined pull, ~1ms merge CPU",
          "~8 pull sources at p50, hard cap 25",
          "500 candidates handed to ranking",
        ],
        breaks:
          "The 25-source cap silently truncates: a reader following 80 large accounts gets nothing at all from 55 of them, and that reader is disproportionately a new user whose onboarding suggested popular accounts.",
        choice: {
          pick: "Merge at read time with the pull set capped at 25 sources by predicted engagement",
          instead: "An uncapped merge over every large account the reader follows.",
          decider:
            "The 200ms p95 budget: ~35ms ranking, ~60ms hydration, ~40ms network, leaving ~30ms for the merge. Each pull source contributes ~20 candidates and the first ranking stage costs ~5ms per 500, so past ~25 sources the candidate set doubles and ranking cost doubles with it.",
          flips:
            "A chronological feed with no ranking tier. Without the ranking budget the merge is bounded only by round trips, and the cap can rise to whatever the pipeline sustains.",
        },
      },
    },
    {
      id: "ranker",
      label: "Ranking service",
      sub: "two-stage, 5 min per-user cache",
      kind: "service",
      x: 40,
      y: 570,
      w: 280,
      detail: {
        what: "Scores the 500 candidates: a cheap first stage trims to 100, a deep model scores the survivors against a feature store.",
        why: "Ranking cannot move to write time. The signals that decide the order, engagement in the last hour, do not exist when the post is written, and the same post ranks differently for two readers, so a write-time order would be wrong for everyone by the time it was read.",
        numbers: ["~5ms first stage over 500", "~30ms deep model over 100", "2.5B ranks/day with the 5 min cache"],
        breaks:
          "Ranking is on the read path and is the first thing to degrade under load; a ranker timeout falls back to chronological order over the same candidates rather than a blank feed.",
        choice: {
          pick: "Rank at read time over ~500 candidates, cache the ranked result per user for 5 minutes",
          instead: "Rank asynchronously on a schedule and store a materialised ordered feed.",
          decider:
            "Loads per user per day against refresh cycles. The 5-minute cache collapses the ~5 loads in a session to 1, so 500M users x 5 = 2.5B ranks/day. Precomputing to the same freshness means ranking every active user every 5 minutes: 500M x 288 = 144B ranks/day, 58x the compute for an identical result. Break-even is around 1 to 2 loads per user per day.",
          flips:
            "A digest product opened once a day inverts the ratio and lets you run a model far too expensive to serve inline. It also wins for cold-start readers specifically, who cannot hit 200ms from the pull path at all.",
        },
      },
    },
    {
      id: "hydrator",
      label: "Hydration + visibility",
      sub: "ids to posts, deletes and blocks",
      kind: "service",
      x: 40,
      y: 680,
      w: 280,
      detail: {
        what: "Batch-fetches the top-ranked ids from the posts store and drops anything deleted, blocked, suspended or region-restricted for this reader.",
        why: "This is the only place correctness is enforced, and that is what licenses everything upstream to be sloppy. Timelines can hold stale ids, the merge can carry duplicates, the cap can hold entries from unfollowed accounts, because none of it survives hydration.",
        numbers: ["~60ms for the top 50", "over-fetch ~70 to return 50 at 30% drop"],
        breaks:
          "A load whose candidates are heavily unhydratable returns short, and the over-fetch factor is tuned rather than derived, so it occasionally guesses wrong.",
        choice: {
          pick: "Store ids in timelines and resolve content and visibility at read time",
          instead: "Denormalise post bodies into every follower's timeline so a read needs no second hop.",
          decider:
            "The cost of a delete. With ids, a delete is one write to the posts store and it takes effect on the next hydration everywhere; with bodies it is a rewrite of up to 100 million cached lists, and any one missed leaves deleted content on screen. Bodies would also multiply the 12TB cache by the ~1KB post size.",
          flips:
            "Immutable, non-private content with no deletes, edits, blocks or regional rules, where hydration enforces nothing and the extra hop is pure latency.",
        },
      },
    },
    {
      id: "posts-db",
      label: "Posts store",
      sub: "Cassandra, partitioned by author_id",
      kind: "database",
      x: 440,
      y: 660,
      w: 240,
      detail: {
        what: "The source of truth: post_id, author_id, content, media refs, timestamp and deleted_at, partitioned by author.",
        why: "Every other store in the diagram is derived from this one and can be thrown away. It is partitioned by author because both the pull-path fallback and backfill-on-follow ask the same question, give me this author's recent posts.",
        numbers: ["1B posts/day at ~1KB = 1TB/day, ~3TB replicated", "30-day hot tier ~90TB provisioned"],
        breaks:
          "A viral post turns one partition into 100k QPS of hydration; that needs per-id hot detection, a 30 to 60s edge cache and request coalescing, and the TTL is capped by the moderation SLA because a cached post survives its own deletion.",
        choice: {
          pick: "Wide-column store partitioned by author_id",
          instead: "PostgreSQL, or object storage with an index.",
          decider:
            "Write rate and access shape. 1B posts/day is ~12k blind writes/s growing 3TB/day replicated, read back as single-key batch gets with no joins. Postgres serves this happily until the row count and write rate outgrow one machine, and this table is the first to do so.",
          flips:
            "Under roughly 100M posts, where Postgres is simpler to operate and gives you real queries for analytics that the wide-column store cannot answer at all.",
        },
      },
    },
    {
      id: "client-read",
      label: "Client · feed",
      sub: "GET /feed?cursor",
      kind: "external",
      x: 440,
      y: 790,
      w: 240,
      detail: {
        what: "The app requesting a page of feed, 20 posts at a time, with an opaque cursor for the next page.",
        why: "Drawn explicitly because reads are the workload: 12.5 feed loads per post written and ~250 impressions per post, which is the whole justification for paying on the write path. Cursor pagination rather than offsets because the underlying list is being written to while the reader scrolls.",
        numbers: ["~145k loads/s average, ~220k/s diurnal peak, ~650k/s on a global event", "20 posts per page, 200ms p95"],
        breaks:
          "Scrolling past ~1000 entries falls off the end of the cached timeline and onto the pull path, which is ~1% of loads and by far the slowest.",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client-write",
      to: "post-service",
      label: "new post",
      detail: {
        what: "The post itself: text and media references, on its way to durable storage.",
        why: "It is the only synchronous hop the author pays for. Everything after this returns to them as a post id while delivery is still in flight.",
        numbers: ["~12k posts/s steady"],
        breaks:
          "A scheduled prompt synchronises independent clients into a 10x spike in one second, which the durable write path has to absorb because jitter can only be applied after the ack.",
      },
    },
    {
      id: "e2",
      from: "post-service",
      to: "posts-db",
      label: "durable write, then ack",
      fromSide: "right",
      toSide: "right",
      offset: 130,
      detail: {
        what: "The quorum write of the post row, which is what the author's success response actually means.",
        why: "The ack is deliberately tied to this and not to delivery, so posting latency is independent of follower count and no post can be delivered as an id that resolves to nothing.",
        numbers: ["~1KB per row", "1TB/day, ~3TB with replication factor 3"],
        breaks:
          "If the ack ever moves ahead of this write, fan-out delivers ids for a post that does not exist and every hydration of them returns silently empty.",
      },
    },
    {
      id: "e3",
      from: "post-service",
      to: "fanout-bus",
      label: "fan-out event after ack",
      detail: {
        what: "One delivery event per post, published only after the durable write has committed.",
        why: "Ordering the publish after the commit is what makes the log safe to replay: every event on it refers to a post that definitely exists, so a worker restart can reprocess without producing dangling ids.",
        numbers: ["one event per post, ~12k/s"],
        breaks:
          "Publish-before-commit turns a crash between the two into permanent phantom entries in follower timelines that nothing ever cleans up except the 1000-entry cap.",
      },
    },
    {
      id: "e4",
      from: "fanout-bus",
      to: "fanout-worker",
      label: "keyed by author_id",
      animated: true,
      detail: {
        what: "Delivery events consumed in partition order, so one author's posts are handled by one consumer in write order.",
        why: "This is the only ordering guarantee in the system, and it is deliberately per author rather than global: a globally ordered stream would fix cross-author ordering and hand the write path a single-stream throughput ceiling, which is a far worse trade.",
        numbers: ["partition key = author_id", "5x burst absorbed here, not by Redis"],
        breaks:
          "Partition skew: one prolific author pins a partition, so that consumer falls behind while the rest idle, and queue-depth alerts are the only signal.",
      },
    },
    {
      id: "e5",
      from: "fanout-worker",
      to: "author-stats",
      label: "followers > 10,000?",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The classification read that decides push or pull for this post.",
        why: "It is a cached counter rather than a live count because counting a 100 million edge follower list per post is not affordable, and the staleness that buys is exactly what the dual-mode window covers.",
        numbers: ["threshold 10,000 active followers", "recomputed daily"],
        breaks:
          "Stale towards 'already large' here means the worker skips the push while the read path still treats the author as small, so the post reaches nobody for up to a day with no error anywhere.",
      },
    },
    {
      id: "e6",
      from: "fanout-worker",
      to: "follow-graph",
      label: "follower pages of 10,000",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Paging the author's follower list forwards, filtering out anyone with no session in 30 days, and grouping survivors by cache shard.",
        why: "Paging and shard-grouping exist so the writes can be pipelined ~500 to a round trip; issued one at a time the same work would need twenty times the worker fleet.",
        numbers: ["pages of 10,000", "~60% filtered out as dormant", "~50,000 inserts/s per worker once batched"],
        breaks:
          "The dormant filter is the largest saving on the write path and it creates the returning user, whose timeline is empty and whose first load runs entirely on the pull path at ~300ms.",
      },
    },
    {
      id: "e7",
      from: "fanout-worker",
      to: "timeline-cache",
      label: "push: ZADD + trim to 1000",
      animated: true,
      detail: {
        what: "The push path: one ZADD plus ZREMRANGEBYRANK per active follower, pipelined in batches.",
        why: "This edge is the entire cost of the push half of the hybrid, and it is the number that caps how high the threshold can go: every tier you move onto this path multiplies sustained cache write rate.",
        numbers: ["~2.3M inserts/s sustained after filtering", "~12M/s at diurnal peak against a ~15M/s ceiling"],
        breaks:
          "This is the arrow that saturates. One author over the threshold pushed by mistake queues every other author's delivery behind 100 million writes on the same cluster.",
      },
    },
    {
      id: "e8",
      from: "fanout-worker",
      to: "author-recent",
      label: "pull: one append, cap 200",
      detail: {
        what: "The pull path: for an author over the threshold, a single append to their own recent-posts list and nothing else.",
        why: "One write instead of F writes is the point. The delivery work does not disappear, it moves to the read path where it becomes one hot key shared by every follower rather than a burst on one cluster.",
        numbers: ["1 write per post regardless of follower count", "list capped at ~200 ids"],
        breaks:
          "Nothing is delivered, so if this key is lost the author is missing from every follower's feed simultaneously with no push copy anywhere to fall back on.",
      },
    },
    {
      id: "e9",
      from: "client-read",
      to: "feed-service",
      label: "GET /feed?cursor",
      fromSide: "left",
      toSide: "left",
      offset: 70,
      detail: {
        what: "A feed request for the next 20 posts, carrying an opaque cursor rather than an offset.",
        why: "Cursors because the underlying timeline is being appended to and trimmed while the reader scrolls, so an offset would skip and repeat posts across pages.",
        numbers: ["~145k loads/s average, ~650k/s on a global event", "20 posts per page"],
        breaks:
          "A cursor beyond the 1000-entry cap cannot be served from the cache and drops onto the pull path, which is ~1% of loads and the slowest thing in the product.",
      },
    },
    {
      id: "e10",
      from: "timeline-cache",
      to: "feed-service",
      label: "pushed ids, ~2ms",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "One ZREVRANGE returning up to 1000 prebuilt post ids for this reader.",
        why: "This is what the whole write path was for: the ordinary reader's feed is one round trip against an already-ordered list, with no join and no merge.",
        numbers: ["up to 1000 ids", "~2ms, one round trip"],
        breaks:
          "A cold or evicted timeline returns empty and the entire feed has to be rebuilt from the pull path inline, which cannot meet 200ms.",
      },
    },
    {
      id: "e11",
      from: "author-recent",
      to: "feed-service",
      label: "large-account ids, ~2ms",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A pipelined read of ~20 recent ids from each large account the reader follows, issued concurrently with the timeline read.",
        why: "This is the read-time half of the hybrid. The two reads are issued together rather than in sequence because the pushed timeline gates nothing, so the merge waits on both and costs one round trip, not two.",
        numbers: ["~8 sources at p50, capped at 25", "20 ids per source, one round trip regardless of count"],
        breaks:
          "Each extra source adds ~20 candidates to a fixed 500-candidate budget, which is why the cap exists and why lowering the threshold to 1,000 would put ~40 sources here and blow the merge budget.",
      },
    },
    {
      id: "e12",
      from: "feed-service",
      to: "follow-graph",
      label: "big_follows, cap 25",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the reader's large-account follow set, a small per-user set maintained on follow and unfollow.",
        why: "It is maintained incrementally rather than derived per request because scanning 200 follows and checking each one's size would cost more than the merge it feeds.",
        numbers: ["~8 entries typical, hard cap 25 by predicted engagement"],
        breaks:
          "The cap truncates rather than deprioritises: for a reader following 80 large accounts, 55 of them contribute nothing, and rotating the bottom slots to compensate makes the feed change between refreshes with no new posts, which reads as a bug.",
      },
    },
    {
      id: "e13",
      from: "feed-service",
      to: "author-stats",
      label: "same classification",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The read path consulting the identical classification record the fan-out worker used, to decide who belongs in the pull set.",
        why: "Drawn because the failure it prevents is the nastiest one in the design: if the two paths read different sources they will disagree, and an author both paths consider the other's responsibility is delivered by neither.",
        numbers: ["24h dual-mode window on crossing", "classification disagreement rate should be zero outside it"],
        breaks:
          "During the dual-mode window a crossing author's posts arrive by both routes, so the merge must deduplicate by post id or the reader sees doubles.",
      },
    },
    {
      id: "e14",
      from: "feed-service",
      to: "ranker",
      label: "500 candidates",
      animated: true,
      detail: {
        what: "The merged, deduplicated, time-truncated candidate set handed to ranking.",
        why: "It is bounded at 500 deliberately: ranking cost is linear in candidates and the first stage costs ~5ms per 500, so the candidate cap and the pull-source cap are the same constraint seen from two ends.",
        numbers: ["500 candidates, ~1ms of merge CPU"],
        breaks:
          "A pull-heavy reader fills this budget from the pull side alone, squeezing out whatever their pushed timeline held.",
      },
    },
    {
      id: "e15",
      from: "ranker",
      to: "hydrator",
      label: "100 ranked, hydrate 50",
      detail: {
        what: "The ranked survivors, trimmed by the first stage and scored by the deep model, passed on for content resolution.",
        why: "Ranking runs before hydration because hydration is the expensive step and there is no point paying ~60ms to resolve posts that will not be shown.",
        numbers: ["500 to 100 at ~5ms, 100 scored at ~30ms", "top 50 hydrated"],
        breaks:
          "The order can be undone downstream: if hydration drops 30% of the top 50, the returned feed is short or has to reach further down a list that was already ranked.",
      },
    },
    {
      id: "e16",
      from: "hydrator",
      to: "posts-db",
      label: "batch get + visibility",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A batch get of the ranked post ids against the source of truth, with a per-post visibility check for this reader.",
        why: "It is the second hop that the ids-not-bodies rule buys, and it is where deletes, blocks, suspensions and regional restrictions actually take effect, which is why derived timelines never need rewriting.",
        numbers: ["~60ms for the top 50", "over-fetch ~70 to return 50"],
        breaks:
          "A viral post makes one id 100k QPS here, so it needs hot-key detection plus a 30 to 60s edge cache, and that TTL is exactly how long a deleted post stays visible.",
      },
    },
    {
      id: "e17",
      from: "hydrator",
      to: "client-read",
      label: "50 posts, next_cursor",
      animated: true,
      detail: {
        what: "The assembled page of ranked, visible posts plus the cursor for the following page.",
        why: "Everything upstream is budgeted against this one response: ~2ms timeline, ~2ms pull, ~1ms merge, ~35ms ranking, ~60ms hydration, ~40ms network.",
        numbers: ["~80ms p50, ~180ms p95 against a 200ms budget"],
        breaks:
          "If ranking times out the fallback is chronological order over the same candidates, so the feed degrades in quality rather than going blank, and the reader is not told.",
      },
    },
  ],
};
