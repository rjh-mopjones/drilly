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
      "The fan-out fleet is where the fork lives. Its first stage reads the author's classification record and compares it to 10,000. Under the line the paging stage runs: follower list in blocks of 10,000, dormant accounts dropped, survivors grouped by shard, ZADD plus trim pipelined ~500 to a round trip. Over the line that stage is skipped entirely and the post id is appended once to the author's own recent-posts list.",
      "Nothing on the request path decides who is large. A nightly batch counts active followers, sets is_large, stamps crossed_at, and refreshes the affected readers' pull sets. That staleness is deliberate and it is also the design's nastiest failure: stale towards 'already large' means an author is neither pushed nor pulled, and disappears for a day with no error anywhere. The 24h dual-mode window exists to cover exactly that.",
      "Timelines hold post ids and never bodies, capped at 1000 entries. That cap is about 2.5 days of feed for a 200-follow user, and it doubles as the garbage collector: a duplicate, a post from an account since unfollowed, an id from a bad deploy all age out within two days without anyone having to go and find them.",
      "The read path merges the two delivery routes. The feed service issues one ZREVRANGE against the reader's pushed timeline and a pipelined read of the recent-posts list for each large account in their maintained pull set, typically eight and hard-capped at 25, then merges by score, deduplicates by post id, and truncates to 500 candidates in about 5ms of round trips.",
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
    // ---------------------------------------------------------------- write
    {
      id: "client-write",
      label: "Client · post",
      sub: "POST /post",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "Our own app, posting content: text, media references, nothing else.",
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
      col: 1,
      row: 0,
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
      col: 1,
      row: 1,
      detail: {
        what: "A partitioned durable log carrying one delivery event per post to the fan-out fleet.",
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

    // ---- FRAME: one worker fleet, three stages ----
    {
      id: "fanout-fleet",
      label: "Fan-out worker fleet",
      kind: "serviceGroup",
      col: 2,
      row: 1,
      sub: "classify · push · backfill",
      detail: {
        what: "The async delivery tier: classify the author, and for a small one page and push. The same fleet also drains follow-backfill jobs at lower priority. ~50 workers at ~50k inserts/s each.",
        why: "One deployable, not three services. The stages share the Redis connection pool, the shard map and the pipelining buffer, and splitting them would put a network hop in the middle of a loop whose whole economy is batching ~500 writes per round trip.",
        numbers: [
          "~50 workers, ~50k inserts/s each once batched",
          "~2.3M inserts/s sustained, headroom for the 5x event burst",
        ],
        breaks:
          "Because it is one pool, a signup importing 500 follows (50,000 backfill inserts) competes with live delivery. Priority is a scheduling decision inside the worker, not an isolation boundary, so a big enough backfill wave still shows up as fan-out lag.",
        choice: {
          pick: "Backfill on the same worker pool as live fan-out, at lower priority",
          instead: "A dedicated backfill fleet, isolated from delivery.",
          decider:
            "Duty cycle. Backfill is bursty and rare (a follow, a signup import) while delivery is continuous, so a dedicated fleet is idle almost always and still has to be sized for the signup spike. Sharing means one pool sized for delivery absorbs backfill in its own headroom.",
          flips:
            "A product with continuous bulk imports — a migration, a follow-recommendation rollout that adds follows for millions of users — where backfill stops being bursty and starts competing for the whole pool.",
        },
      },
    },
    {
      id: "p-classify",
      label: "Classify author",
      sub: "read is_large, compare to 10k",
      kind: "process",
      col: 2,
      row: 1,
      parent: "fanout-fleet",
      detail: {
        what: "The first stage of the worker: read the author's classification record and take the fork. Under the threshold, hand off to the paging stage. Over it, do the one thing a large author needs — append the post id to their own recent-posts list — and finish.",
        why: "This is the fork the whole question turns on, and it lives in an async worker rather than on the write path so the expensive case, an author just under the threshold with 9,999 followers, costs the poster nothing and is allowed to take seconds.",
        numbers: [
          "threshold 10,000 active followers",
          "~500 followers per posting account under the line",
          "over the line: exactly 1 write, whatever the follower count",
        ],
        breaks:
          "The record it reads is a batch product and therefore stale. Stale towards 'already large' here means the push is skipped while the reader's pull set still does not contain the author, so the post reaches nobody for up to a day and no request fails.",
        choice: {
          pick: "Hybrid fan-out with the fork at 10,000 followers",
          instead: "Pull for everyone with each author's recent posts cached hot, or push for everyone.",
          decider:
            "Both bounds are capacity, not principle. Below ~1,000 a 200-follow reader carries ~40 pull sources against a ~30ms merge budget that fits ~25; above ~30,000 the 10k-to-100k tier returns to the push path and adds ~7M writes/s to a 5.8M/s baseline under a ~15M/s ceiling. The defensible band is ~1,000 to ~30,000 and 10,000 is the middle of it.",
          flips:
            "A flat graph with under ~30 follows per user and no account two orders of magnitude above the median. Pure pull merges 30 hot keys, needs no threshold, no crossing logic and no fan-out fleet, and gets deletes and privacy for free.",
        },
      },
    },
    {
      id: "p-push",
      label: "Push fan-out",
      sub: "page, drop dormant, pipeline",
      kind: "process",
      col: 2,
      row: 2,
      parent: "fanout-fleet",
      detail: {
        what: "The stage a large author skips: page the follower list in blocks of 10,000, drop anyone with no session in 30 days, group survivors by cache shard, and issue pipelined ZADD plus ZREMRANGEBYRANK pairs ~500 to a round trip.",
        why: "The batching is the reason the push path is affordable at all. Issued one write at a time the same work needs roughly twenty times the worker fleet; grouped by shard and pipelined, a single worker sustains ~50,000 inserts/s.",
        numbers: [
          "pages of 10,000 followers, ~500 ZADDs per round trip",
          "~60% of a follower list filtered out as dormant",
          "~5.8M writes/s unfiltered, ~2.3M/s after filtering",
        ],
        breaks:
          "Worker lag is invisible from the write path: posting still succeeds, the queue simply drains later, so freshness degrades with nothing failing. Queue depth and oldest-job age are the only signals.",
        choice: {
          pick: "Page the graph forward and pipeline shard-grouped writes",
          instead: "Read the whole follower list into the worker, or issue writes one at a time as the list streams.",
          decider:
            "Memory against round trips. A 9,999-follower list is trivial to hold but the same code runs against the tail during the 24h dual-mode window, so paging is what stops one author's list sizing the worker's heap. Un-batched writes cost one RTT each: at 0.5ms per insert the fleet is 20x larger for identical work.",
          flips:
            "A pure-push design with a hard follower cap, where every list fits in memory and the shard-grouping bookkeeping buys nothing.",
        },
      },
    },
    {
      id: "p-backfill",
      label: "Follow backfill",
      sub: "author's last 100 on follow",
      kind: "process",
      col: 2,
      row: 3,
      parent: "fanout-fleet",
      detail: {
        what: "The other job this fleet drains: when someone follows an account, read that account's last 100 posts and insert them into the new follower's timeline.",
        why: "Without it a new follow leaves the reader's timeline with none of that author's history, and the feed reads as broken at exactly the moment the reader took an action. Until the job lands the feed service treats the new followee as a one-shot pull source, so the reader never sees a gap.",
        numbers: [
          "up to 100 inserts per follow",
          "a signup importing 500 follows = ~50,000 inserts",
          "runs below live fan-out on the same pool",
        ],
        breaks:
          "Onboarding is the spike: 500 follows at once is 50,000 inserts for one user, and if that ran at delivery priority a signup wave would push fan-out lag for everybody.",
        choice: {
          pick: "Backfill asynchronously, and treat the followee as a pull source until it lands",
          instead: "Backfill synchronously inside the follow request, or never backfill and let the timeline fill naturally.",
          decider:
            "What the reader sees in the next few seconds. Synchronous means a follow request that writes up to 100 entries, and 500 of them at signup; never backfilling means an empty feed for a brand-new account, which is the single worst first impression the product can make. Async plus a pull fallback costs one extra merge source for a few seconds.",
          flips:
            "A chronological feed with no ranking, where the pull fallback is cheap enough to be permanent and backfill is pure write amplification.",
        },
      },
    },

    // -------------------------------------------------- write-side stores
    {
      id: "follow-graph",
      label: "Follow graph",
      kind: "database",
      col: 3,
      row: 1,
      sub: "wide-column + big_follows pull set",
      detail: {
        what: "The (follower_id, followee_id) edge set, indexed forwards for fan-out and backwards for building a reader's large-account set.",
        why: "Both directions are hot for different reasons: the worker needs 'who follows this author' to deliver, and the follow service and the nightly batch need 'which of this reader's follows are large' to maintain the pull set. One direction indexed means the other is a scan.",
        numbers: ["~100B edges, ~200 follows per user", "~4% of edges point above the threshold"],
        breaks:
          "Follow and unfollow propagation lags, so a reader keeps receiving posts from an account they dropped until the 1000-entry cap ages them out.",
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
      id: "follow-service",
      label: "Follow service",
      sub: "POST /follow",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The other write path. It records the edge, adds the followee to the reader's large-account set if it is above the threshold, and enqueues a backfill job.",
        why: "Follow is where the read path's cheap lookups are paid for. Deciding at follow time which of your follows are large is what lets a feed load skip scanning 200 follows and checking each one's size, and it is the moment the reader is willing to wait a few milliseconds.",
        numbers: ["edge write plus one set update", "backfill of up to 100 posts queued, not awaited"],
        breaks:
          "The three effects are not one transaction. A crash between the edge write and the set update leaves a reader following a large account that is missing from their pull set, and nothing notices until the classification batch next rebuilds it.",
        choice: {
          pick: "Update the reader's pull set inline, queue the backfill",
          instead: "Derive both asynchronously from a change-data-capture stream off the follow graph.",
          decider:
            "What the reader sees on their next load, which is often seconds away. The pull set has to be right immediately or a fresh follow of a celebrity produces nothing at all; the backfill is historic content and can be seconds late without anyone noticing. CDC would make both eventually consistent and would make the first case visibly wrong.",
          flips:
            "Once follows arrive in bulk — imports, recommendation rollouts — where the inline path becomes the bottleneck and CDC plus a rebuild is the only thing that keeps the request fast.",
        },
      },
    },

    // ---- FRAME: the hybrid itself ----
    {
      id: "delivery",
      label: "Delivery stores · disposable",
      kind: "zone",
      detail: {
        what: "The push store and the pull store, side by side: the entire hybrid lives in these two keys and the rule that picks between them.",
        why: "Everything else in the diagram is conventional. What makes this a news feed rather than a CRUD app is that one post lands in one of these two places depending on how big its author is, and the read path has to reconcile that at query time. Both are derived from the posts store and the follow graph, so neither is ever replicated cross-region or restored from backup: a lost shard is rebuilt lazily, and total loss is acceptable by construction.",
        numbers: ["tl:{user_id} capped at 1000", "ar:{author_id} capped at 200", "RPO for this frame: total loss is fine"],
        breaks:
          "An author who is in neither store, because the write path already thinks they are large and the read path does not, is invisible to every follower with no error raised anywhere.",
      },
    },
    {
      id: "timeline-cache",
      label: "Timeline cache",
      sub: "Redis ZSET tl:{user}, cap 1000",
      kind: "cache",
      col: 1,
      row: 2,
      parent: "delivery",
      detail: {
        what: "One sorted set per active user holding post ids scored by timestamp, trimmed to 1000 entries.",
        why: "This is the prebuilt half of the feed and the reason an ordinary load is one round trip. Storing ids rather than bodies is what makes it disposable: it is derived state, never replicated across regions, and a lost shard is rebuilt lazily rather than restored.",
        numbers: [
          "~24B per entry, 500M users x 1000 ids = ~12TB",
          "~100 shards at ~120GB each",
          "1000 entries = ~400 posts/day = ~2.5 days of feed",
        ],
        breaks:
          "A timeline can hold a full 1000 ids that hydrate down to 40 usable posts after deletes and blocks, and the write path is oblivious because fan-out did deliver the ids. Nothing detects it except a per-reader hydration-yield alarm.",
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
      kind: "cache",
      col: 2,
      row: 2,
      parent: "delivery",
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
      id: "posts-db",
      label: "Posts store",
      sub: "Cassandra, partitioned by author_id",
      kind: "database",
      col: 0,
      row: 2,
      detail: {
        what: "The source of truth: post_id, author_id, content, media refs, timestamp and deleted_at, partitioned by author.",
        why: "Every other store in the diagram is derived from this one and can be thrown away. It is partitioned by author because both backfill-on-follow and the pull-path fallback ask the same question, give me this author's recent posts.",
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

    // ------------------------------------------------- classification tier
    {
      id: "classifier",
      label: "Classification batch",
      kind: "service",
      col: 3,
      row: 0,
      sub: "nightly is_large + author stats",
      detail: {
        what: "The daily job that counts each author's 30-day-active followers, sets is_large, stamps crossed_at, and refreshes the pull set of every reader affected by a flip.",
        why: "It is drawn because it owns the design's nastiest failure. Nothing on either request path is allowed to count 100 billion edges, so the classification has to be produced somewhere off the hot path, and whatever produces it is the single point where the write path's view and the read path's view of an author can diverge.",
        numbers: [
          "runs daily over ~100B edges",
          "handful of accounts cross 10,000 on any given day",
          "opens a 24h dual-mode window per crossing",
        ],
        breaks:
          "A skipped or failed run freezes the classification. Authors that grew past the threshold yesterday are still pushed (harmless, just expensive) and authors that were demoted are pulled by nobody. The signal is the classification-disagreement metric, not a failed request.",
        choice: {
          pick: "A nightly batch, with a 24h dual-mode window around each crossing",
          instead: "Maintain the classification live on every follow and unfollow.",
          decider:
            "How often the answer changes against how much it costs to keep exact. Follower counts move constantly but is_large flips for a handful of accounts a day, so a live pipeline pays continuously for a decision that changes almost never. The window makes the resulting staleness safe rather than trying to eliminate it: for 24 hours the author is both pushed and pulled, and the merge deduplicates.",
          flips:
            "If crossings become common — a product where accounts routinely oscillate around the line — the double-delivery window stops being cheap and the classification has to become live, with hysteresis instead of a single threshold.",
        },
      },
    },

    // ----------------------------------------------------------- read path
    {
      id: "feed-service",
      label: "Feed service",
      kind: "serviceGroup",
      col: 2,
      row: 3,
      sub: "merge · rank · hydrate",
      detail: {
        what: "One deployable that serves GET /feed: merge the two delivery routes into a candidate set, call the ranker, then hydrate what came back and return it.",
        why: "Merging and hydrating are two stages of one request, sharing the reader's context, the connection pools and the 200ms budget; a network hop between them would buy nothing. Ranking is deliberately not in this frame: it needs different hardware, has its own timeout, and has a fallback (chronological order) that this service implements when the ranker misses.",
        numbers: ["~80ms p50, ~180ms p95 against a 200ms budget", "~145k loads/s average, ~650k/s on a global event"],
        breaks:
          "Everything in here degrades together: one deployable means a hydration slowdown eats the same threads that serve merges, so a moderation event that drops hydration yield shows up as latency on feeds that had nothing to do with it.",
        choice: {
          pick: "Merge and hydrate in one service, rank in another",
          instead: "One service for the whole read path, or three separate services.",
          decider:
            "Whether the stage has its own failure mode. Ranking times out on its own and falls back to chronological, so it needs to be a call this service can abandon; merge and hydrate have no such independence — if hydration fails there is no feed to return, so isolating it would only add a hop.",
          flips:
            "Once hydration needs its own hardware (a media-heavy feed with per-post transformation), where it stops being a cheap batch get and starts deserving its own fleet and its own scaling curve.",
        },
      },
    },
    {
      id: "p-merge",
      label: "Merge + dedupe",
      sub: "by score, then by post id",
      kind: "process",
      col: 2,
      row: 3,
      parent: "feed-service",
      detail: {
        what: "Reads the pushed timeline and the pull sources concurrently, merges by score, deduplicates by post id, and truncates to 500 candidates.",
        why: "This is where the two delivery paths become one feed. Deduplication by post id is not an optimisation: during the 24h dual-mode window a crossing author's post arrives by both routes, so the merge has to be idempotent by construction rather than by luck.",
        numbers: [
          "~2ms timeline read, ~2ms pipelined pull, ~1ms merge CPU",
          "~8 pull sources at p50, hard cap 25",
          "500 candidates handed to ranking",
        ],
        breaks:
          "A pull-heavy reader fills the 500-candidate budget from the pull side alone, squeezing out whatever their pushed timeline held — and that reader is the new user whose follows are almost all large accounts.",
        choice: {
          pick: "Merge at read time with the pull set capped at 25 sources",
          instead: "An uncapped merge over every large account the reader follows.",
          decider:
            "The 200ms p95 budget: ~35ms ranking, ~60ms hydration, ~40ms network, leaving ~30ms for the merge. Each pull source contributes ~20 candidates and the first ranking stage costs ~5ms per 500, so past ~25 sources the candidate set doubles and ranking cost doubles with it.",
          flips:
            "A chronological feed with no ranking tier. Without the ranking budget the merge is bounded only by round trips, and the cap can rise to whatever the pipeline sustains.",
        },
      },
    },
    {
      id: "p-hydrate",
      label: "Hydrate + visibility",
      sub: "ids to posts, deletes and blocks",
      kind: "process",
      col: 2,
      row: 5,
      parent: "feed-service",
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
      id: "ranker",
      kind: "process",
      col: 2,
      row: 4,
      parent: "feed-service",
      label: "Ranking service",
      sub: "two-stage, 5 min per-user cache",
      detail: {
        what: "Scores the 500 candidates: a cheap first stage trims to 100, a deep model scores the survivors against a feature store.",
        why: "Separate from the feed service because it is the one stage that can be abandoned. It runs on different hardware, it is the first thing to degrade under load, and the feed service is expected to give up on it and serve chronological order rather than a blank feed. Ranking also cannot move to write time: the signals that decide the order, engagement in the last hour, do not exist when the post is written, and the same post ranks differently for two readers.",
        numbers: ["~5ms first stage over 500", "~30ms deep model over 100", "2.5B ranks/day with the 5 min cache"],
        breaks:
          "A ranker timeout is invisible to the reader: they get the same posts in chronological order and are not told the feed was not ranked. Only the timeout-rate metric shows it.",
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
      id: "client-read",
      label: "Client · feed",
      sub: "GET /feed?cursor",
      kind: "client",
      col: 3,
      row: 3,
      detail: {
        what: "The app requesting a page of feed, 20 posts at a time, with an opaque cursor for the next page.",
        why: "Drawn explicitly because reads are the workload: 12.5 feed loads per post written and ~250 impressions per post, which is the whole justification for paying on the write path. Cursor pagination rather than offsets because the underlying list is being written to while the reader scrolls.",
        numbers: [
          "~145k loads/s average, ~220k/s diurnal peak, ~650k/s on a global event",
          "20 posts per page, 200ms p95",
        ],
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
      label: "durable quorum write",
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
      to: "p-classify",
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
      to: "classifier",
      tier: "data",
      from: "p-classify",
      label: "followers > 10,000?",
      detail: {
        what: "The classification read that decides push or pull for this post.",
        why: "It is a cached, batch-computed number rather than a live count because counting a 100 million edge follower list per post is not affordable, and the staleness that buys is exactly what the dual-mode window covers.",
        numbers: ["threshold 10,000 active followers", "one row read per post"],
        breaks:
          "Stale towards 'already large' here means the worker skips the push while the reader's pull set does not yet contain the author, so the post reaches nobody for up to a day with no error anywhere.",
      },
    },
    {
      id: "e6",
      from: "p-classify",
      to: "p-push",
      label: "under 10k: fan out",
      animated: true,
      detail: {
        what: "The push branch, in process: hand the post and the author id to the paging stage.",
        why: "This is the expensive branch and it is the common one. Roughly 96% of follow edges point below the threshold, so almost every post takes this hop and its cost is what sets the size of the fan-out fleet.",
        numbers: ["~500 followers per posting account under the line", "~96% of edges below the threshold"],
        breaks:
          "The branch is taken on a number that is up to a day old, so an account that crossed this morning still takes it and pays for a push nobody needed. Harmless but not free.",
      },
    },
    {
      id: "e7",
      from: "p-classify",
      to: "author-recent",
      label: "over 10k: one append",
      detail: {
        what: "The pull branch: for an author over the threshold, a single append to their own recent-posts list, and the worker is done.",
        why: "One write instead of F writes is the point. The delivery work does not disappear, it moves to the read path where it becomes one hot key shared by every follower rather than a burst of 100 million writes on one cluster in one moment.",
        numbers: ["1 write per post regardless of follower count", "list capped at ~200 ids"],
        breaks:
          "Nothing is delivered, so if this key is lost the author is missing from every follower's feed simultaneously with no push copy anywhere to fall back on.",
      },
    },
    {
      id: "e8",
      from: "p-push",
      to: "follow-graph",
      label: "follower pages of 10,000",
      detail: {
        what: "Paging the author's follower list forwards, in blocks of 10,000, and grouping survivors by cache shard.",
        why: "Paging and shard-grouping exist so the writes can be pipelined ~500 to a round trip; issued one at a time the same work would need twenty times the worker fleet.",
        numbers: ["pages of 10,000", "~500 ZADDs per round trip", "~50,000 inserts/s per worker once batched"],
        breaks:
          "This read is on the same physical tier as every other graph query, so if the timeline tier and the graph tier are ever co-located a viral fan-out starves ordinary follow lookups.",
      },
    },
    {
      id: "e10",
      from: "p-push",
      to: "timeline-cache",
      label: "ZADD + trim to 1000",
      animated: true,
      detail: {
        what: "The push itself: one ZADD plus ZREMRANGEBYRANK per active follower, pipelined in batches of ~500.",
        why: "This edge is the entire cost of the push half of the hybrid, and it is the number that caps how high the threshold can go: every tier you move onto this path multiplies sustained cache write rate.",
        numbers: ["~2.3M inserts/s sustained after filtering", "~12M/s at diurnal peak against a ~15M/s ceiling"],
        breaks:
          "This is the arrow that saturates. One author over the threshold pushed by mistake queues every other author's delivery behind 100 million writes on the same cluster.",
      },
    },
    {
      id: "e11",
      from: "client-write",
      to: "follow-service",
      label: "follow / unfollow",
      detail: {
        what: "The other write the product supports, and the one that changes what a feed is made of.",
        why: "Drawn because a follow has three consequences, not one: an edge, a possible pull-set entry, and a backfill job. Answers that draw only the posting path leave the reader's first load after a follow undefined.",
        numbers: ["returns { ok, backfill_queued }", "a signup can carry 500 of these at once"],
        breaks:
          "Unfollow is the weaker half: the edge disappears immediately but already-pushed ids stay in the reader's timeline until the 1000-entry cap ages them out, so posts from a dropped account keep appearing for up to two days.",
      },
    },
    {
      id: "e12",
      from: "follow-service",
      to: "follow-graph",
      label: "edge, indexed both ways",
      detail: {
        what: "The durable record of the follow, written so it is readable forwards (who follows this author) and backwards (who does this reader follow).",
        why: "This is the only durable effect of a follow. Everything else the follow service touches — the pull set, the backfill — is derived from this edge and can be rebuilt from it.",
        numbers: ["~100B edges total", "~200 follows per user"],
        breaks:
          "Propagation lag between this write and the derived sets is the failure the CDC-lag and post-from-unfollowed-author canaries watch for.",
      },
    },
    {
      id: "e14",
      from: "follow-service",
      to: "p-backfill",
      label: "backfill job, low priority",
      detail: {
        what: "The asynchronous job: fetch the followee's last 100 posts and insert them into this reader's timeline.",
        why: "It rides the same worker pool as live fan-out at lower priority, because backfill is bursty and rare while delivery is continuous — a dedicated fleet would sit idle almost always and still need sizing for the signup spike.",
        numbers: ["up to 100 inserts per follow", "500 follows imported at signup = 50,000 inserts"],
        breaks:
          "Priority inside a shared pool is scheduling, not isolation. A large enough backfill wave still shows up as fan-out lag for unrelated authors.",
      },
    },
    {
      id: "e15",
      from: "p-backfill",
      to: "posts-db",
      label: "author's last 100 posts",
      detail: {
        what: "A single-partition read of the followee's recent posts, which is exactly the query the store is partitioned for.",
        why: "It is the second consumer of author-partitioning, alongside the pull-path fallback, and it is why the partition key is author_id rather than post_id or time.",
        numbers: ["100 posts, one partition", "one read per follow"],
        breaks:
          "Following a very prolific account makes this a wide read, and doing 500 of them at signup turns onboarding into a burst of partition scans.",
      },
    },
    {
      id: "e16",
      from: "p-backfill",
      to: "timeline-cache",
      label: "insert 100, cap 1000",
      detail: {
        what: "Inserting the fetched ids into the new follower's timeline, scored by their original timestamps so they land in the right place rather than at the top.",
        why: "Scoring by original timestamp is what stops a follow from looking like a burst of new posts. The reader wanted history, not a notification storm.",
        numbers: ["up to 100 entries against a 1000 cap"],
        breaks:
          "100 backfilled entries is 10% of the cap, so importing many follows at once can push a reader's genuinely recent posts out of the window before they have been seen.",
      },
    },
    {
      id: "e18",
      from: "classifier",
      to: "follow-graph",
      label: "count edges nightly",
      dashed: true,
      detail: {
        what: "The batch scan that counts each author's followers, reading the graph in the forward direction.",
        why: "It is the reason the classification is a batch product at all: counting 100 billion edges is affordable once a day off the request path and affordable nowhere else.",
        numbers: ["~100B edges scanned", "~4% of edges point above the threshold"],
        breaks:
          "This scan runs on the same tier the fan-out fleet is paging, so it has to be rate-shaped or it competes with live delivery for the graph.",
      },
    },
    {
      id: "e21",
      from: "client-read",
      to: "p-merge",
      label: "GET /feed?cursor",
      detail: {
        what: "A feed request for the next 20 posts, carrying an opaque cursor rather than an offset.",
        why: "Cursors because the underlying timeline is being appended to and trimmed while the reader scrolls, so an offset would skip and repeat posts across pages.",
        numbers: ["~145k loads/s average, ~650k/s on a global event", "20 posts per page"],
        breaks:
          "A cursor beyond the 1000-entry cap cannot be served from the cache and drops onto the pull path, which is ~1% of loads and the slowest thing in the product.",
      },
    },
    {
      id: "e22",
      from: "timeline-cache",
      to: "p-merge",
      label: "pushed ids, ~2ms",
      animated: true,
      detail: {
        what: "One ZREVRANGE returning up to 1000 prebuilt post ids for this reader.",
        why: "This is what the whole write path was for: the ordinary reader's feed is one round trip against an already-ordered list, with no join and no merge.",
        numbers: ["up to 1000 ids", "~2ms, one round trip"],
        breaks:
          "A cold or evicted timeline returns empty and the entire feed has to be rebuilt from the pull path inline, which cannot meet 200ms.",
      },
    },
    {
      id: "e23",
      from: "author-recent",
      to: "p-merge",
      label: "large-account ids, ~2ms",
      animated: true,
      detail: {
        what: "A pipelined read of ~20 recent ids from each large account in the reader's pull set, issued concurrently with the timeline read.",
        why: "This is the read-time half of the hybrid. The two reads are issued together rather than in sequence because the pushed timeline gates nothing, so the merge waits on both and costs one round trip, not two.",
        numbers: ["~8 sources at p50, capped at 25", "20 ids per source, one round trip regardless of count"],
        breaks:
          "Each extra source adds ~20 candidates to a fixed 500-candidate budget, which is why the cap exists and why lowering the threshold to 1,000 would put ~40 sources here and blow the merge budget.",
      },
    },
    {
      id: "e24",
      to: "p-merge",
      from: "follow-graph",
      label: "pull set, ~8 of 25",
      detail: {
        what: "The reader's large-account set, read first because it is what says which recent-posts keys to pipeline.",
        why: "It is one set read instead of a scan over 200 follows and their classifications, which is the difference between a merge that fits in 30ms and one that does not.",
        numbers: ["~8 entries at p50", "hard cap 25", "one round trip"],
        breaks:
          "Stale membership here is invisible: an account missing from the set is simply absent from the feed, and the reader has no way to tell that from the account not having posted.",
      },
    },
    {
      id: "e25",
      from: "p-merge",
      to: "ranker",
      label: "500 candidates",
      animated: true,
      detail: {
        what: "The merged, deduplicated, time-truncated candidate set handed to ranking.",
        why: "It is bounded at 500 deliberately: ranking cost is linear in candidates and the first stage costs ~5ms per 500, so the candidate cap and the pull-source cap are the same constraint seen from two ends.",
        numbers: ["500 candidates, ~1ms of merge CPU", "~35ms of ranking budget"],
        breaks:
          "This is the call the feed service must be willing to abandon. On a ranker timeout it serves the same candidates in chronological order, and the reader is not told.",
      },
    },
    {
      id: "e26",
      from: "ranker",
      to: "p-hydrate",
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
      id: "e27",
      from: "p-hydrate",
      to: "posts-db",
      label: "batch get + visibility",
      detail: {
        what: "A batch get of the ranked post ids against the source of truth, with a per-post visibility check for this reader.",
        why: "It is the second hop that the ids-not-bodies rule buys, and it is where deletes, blocks, suspensions and regional restrictions actually take effect, which is why derived timelines never need rewriting.",
        numbers: ["~60ms for the top 50", "over-fetch ~70 to return 50"],
        breaks:
          "A viral post makes one id 100k QPS here, so it needs hot-key detection plus a 30 to 60s edge cache, and that TTL is exactly how long a deleted post stays visible.",
      },
    },
    {
      id: "e28",
      from: "p-hydrate",
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
