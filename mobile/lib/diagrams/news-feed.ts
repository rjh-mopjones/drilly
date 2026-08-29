import type { Diagram } from "./types";

export const NEWS_FEED: Diagram = {
  id: "news-feed",
  title: "News Feed",
  question: "Design a News Feed System (Facebook, Twitter)",
  sourceId: "patterns",
  itemId: 8,
  overview: {
    shape:
      "A feed is a materialised join between posts and the follow graph, computed on write for most authors and on read for the largest ones.",
    forces: [
      {
        constraint: "push costs 10F writes, pull costs 5F reads at every follower count F; no per-post cost picks a threshold",
        decision: "bracket the threshold between two independent limits instead: the read-side merge budget and the write-side cluster ceiling",
        lights: ["p-merge", "p-push"],
      },
      {
        constraint: "the read-side merge cannot exceed ~25 pull sources inside a ~30ms budget",
        decision: "set the pull-side floor at ~1,000 followers",
        lights: ["p-merge", "e23"],
      },
      {
        constraint: "pulling the 10k-100k tier onto the write path would add ~7M writes/s to a 5.8M/s baseline under a 15M/s ceiling",
        decision: "set the push-side ceiling at ~30,000 followers, landing the threshold at 10,000",
        lights: ["p-push", "timeline-cache", "e10"],
      },
      {
        constraint: "counting 100 billion follow edges cannot run on the request path",
        decision: "classify authors in a nightly batch, with a 24h dual-mode window around each crossing",
        lights: ["classifier", "e18"],
      },
      {
        constraint: "a delete must never mean rewriting up to 100 million cached lists",
        decision: "timelines hold post ids, never bodies, and Hydrate + visibility enforces deletes at read time",
        lights: ["timeline-cache", "p-hydrate"],
      },
    ],
    naive: {
      text: "A reader defaults to one rule: either push every post to every follower's timeline, or make every feed a live query over the follow graph and posts table. Pure push breaks at a celebrity with 100 million followers, since one post becomes 100 million writes landing on one cluster in one moment. Pure pull breaks the opposite way: an ordinary reader's 200 follows becomes 200 reads merged on every single load. The hybrid picks per author instead: push below 10,000 followers, pull above it.",
      lights: ["p-classify", "p-push", "author-recent"],
    },
    beats: [
      {
        text: "The write path is durable first and delivered afterwards. The post service writes to the posts store, waits for a quorum, returns success, and only then publishes a fan-out event. Delivery is asynchronous because nobody is waiting on it, and the ack must not be hostage to 500 cache writes.",
        lights: ["post-service", "posts-db", "fanout-bus", "e2", "e3"],
      },
      {
        text: "The fan-out fleet is where the fork lives. Its first stage reads the author's classification record and compares it to 10,000. Under the line the paging stage runs: follower list in blocks of 10,000, dormant accounts dropped, survivors grouped by shard, ZADD plus trim pipelined ~500 to a round trip. Over the line that stage is skipped entirely and the post id is appended once to the author's own recent-posts list.",
        lights: ["fanout-fleet", "p-classify", "p-push", "author-recent", "e4", "e6", "e7"],
      },
      {
        text: "Nothing on the request path decides who is large. A nightly batch counts active followers, sets is_large, stamps crossed_at, and refreshes the affected readers' pull sets. That staleness is deliberate, and it is also the design's nastiest failure. Stale towards 'already large' means an author is neither pushed nor pulled, and disappears for a day with no error anywhere. The 24h dual-mode window exists to cover exactly that.",
        lights: ["classifier", "follow-graph", "e18"],
      },
      {
        text: "Timelines hold post ids and never bodies, capped at 1000 entries. That cap is about 2.5 days of feed for a 200-follow user. It doubles as the garbage collector: a duplicate, a post from an account since unfollowed, or an id from a bad deploy all age out within two days. Nobody has to go and find them.",
        lights: ["timeline-cache"],
      },
      {
        text: "The read path merges the two delivery routes. The feed service issues one ZREVRANGE, a command returning a sorted set in descending score order, against the reader's pushed timeline. It also issues a pipelined read of the recent-posts list for each large account in the reader's pull set, typically eight and hard-capped at 25. It then merges by score, deduplicates by post id, and truncates to a 500-post pool in about 5ms of round trips.",
        lights: ["feed-service", "p-merge", "timeline-cache", "author-recent", "follow-graph", "e21", "e22", "e23", "e24"],
      },
      {
        text: "Ranking runs on the read path because the signals that decide the order, engagement in the last hour, do not exist at write time and differ per reader. A cheap first stage trims 500 to 100 at ~5ms, and a deep model scores the survivors at ~30ms. The ranked result is cached per user for 5 minutes to absorb intra-session refreshes.",
        lights: ["ranker", "e25", "e26"],
      },
      {
        text: "Hydration is the correctness boundary. Turning 50 ids into 50 posts is where deletes, blocks, suspensions and regional restrictions are enforced against the source of truth. That is precisely why timelines can hold ids and be treated as disposable derived state. A delete becomes one write, not a rewrite of 100 million cached lists.",
        lights: ["p-hydrate", "posts-db", "e27", "e28"],
      },
    ],
    crux: {
      problem:
        "The threshold is not a per-post cost comparison. Amortised over a day the follower count cancels: push costs 10F writes and pull costs 5F reads at every value of F. What actually breaks is concentration: one burst of 100 million writes landing on one cluster in one moment.",
      handled:
        "The number is bracketed from two directions instead of derived from one equation. The read side sets the floor at ~1,000, because the merge cannot exceed ~25 pull sources inside a 30ms budget. The write side sets the ceiling at ~30,000: pulling the middle tier back onto the push path adds ~7M writes/s to a 5.8M/s baseline under a 15M/s ceiling.",
    },
    numbers: [
      {
        value: "10,000 followers: push below, pull above",
        explain: "The threshold sits in the middle of the defensible band, ~1,000 to ~30,000, bracketed by the read-side merge budget and the write-side cluster ceiling.",
      },
      {
        value: "~5.8M cache writes/s, ~2.3M/s after dormant filtering",
        explain: "The push path's write load before and after dropping followers with no session in 30 days; the filtered figure is measured against the cluster's write ceiling.",
      },
      {
        value: "12.5B feed loads/day against 1B posts/day, 200ms p95",
        explain: "Reads outnumber writes more than 12 to 1, the whole justification for paying the fan-out cost on the write path instead of the read path.",
      },
      {
        value: "timeline = 1000 ids, ~12TB of Redis sorted sets",
        explain: "500M users × 1000 ids at ~24 bytes each is the total memory footprint of the push half of the hybrid.",
      },
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
        numbers: [
          { value: "~12k posts/s steady", explain: "The baseline write rate the post service and fan-out fleet are provisioned for." },
          { value: "~60k/s during a global event", explain: "A roughly 5x burst above steady state, which the fan-out bus and worker fleet absorb without touching write latency." },
        ],
        breaks: {
          failure: "Scheduled prompts, a 'post your year in review' banner at midnight UTC, turn independent clients into one synchronised spike.",
          handled: "That spike lands at roughly 10x steady state, and the durable write path absorbs it because delivery is asynchronous and can lag without affecting posting latency.",
        },
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
        why: "The ordering is the whole point. Acking after the durable write and before delivery means a post is never lost and never blocks on 500 cache writes. A celebrity and an ordinary user get the same posting latency.",
        numbers: [
          { value: "~12k posts/s steady, ~60k/s burst", explain: "The write rate this service is provisioned for, the same figure the client and fan-out bus are sized against." },
          { value: "~1KB of post metadata per row", explain: "1KB × 12k posts/s ≈ 12MB/s steady, ~60MB/s at burst — trivial bandwidth, which is why the quorum write never becomes this service's bottleneck." },
        ],
        breaks: {
          failure: "Publishing the fan-out event before the durable write succeeds would deliver ids for a post that does not yet exist.",
          handled: "The event is published only after the quorum write commits. Every id a worker ever sees resolves to a real post, and a worker restart can safely reprocess the log.",
        },
        choice: {
          pick: "Ack after the durable quorum write, publish the fan-out event afterwards",
          instead: "Ack only once fan-out has completed, or publish the event first and write asynchronously.",
          decider:
            "What the poster waits on. Waiting for delivery means an author with 500 followers waits for 500 cache writes and one with 9,999 waits for 9,999, so posting latency becomes a function of popularity. Publishing first inverts the failure into lost content, which is unrecoverable rather than merely late.",
          flips:
            "A system where a post must be visible to its own author's feed synchronously, such as a small team tool. There fan-out is a handful of writes, and doing it inline is simpler than a queue.",
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
        why: "It absorbs the 5x event burst that the cache cluster cannot. The partition key is also the design's only ordering guarantee: two posts by the same author land on the same consumer, in the order they were written. A follower therefore never sees a reply above the thing it replies to from the same account.",
        numbers: [
          { value: "1 partition key: author_id", explain: "The only ordering guarantee in the system: two posts by the same author land on the same consumer in write order." },
          { value: "~12k events/s steady, ~60k/s burst", explain: "The same write rate as the post service, one event per post, buffered so delivery can lag behind ingestion." },
        ],
        breaks: {
          failure: "Nothing orders posts across different authors.",
          handled:
            "A second account's reply can be delivered and ranked above the post it refers to, and with a timestamp score it stays there. This is accepted because cross-author ordering would need a single global stream and a much lower throughput ceiling.",
        },
        choice: {
          pick: "Kafka, partitioned by author_id",
          instead: "Synchronous fan-out inside the post service, or a work queue with no partition key.",
          decider:
            "Burst absorption plus per-author ordering. A global event pushes posts from 12k/s to 60k/s while the cache cluster ceiling is fixed at ~15M writes/s, so delivery has to be allowed to lag and drain. An unkeyed queue gives you the buffering but loses the one ordering property worth having.",
          flips: "Under roughly a million users, where total fan-out fits inside the request that created it and a broker is pure operational cost.",
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
        what: "The async delivery tier: classify the author, and for a small one page and push. The same fleet also drains follow-backfill jobs at lower priority.",
        why: "One deployable, not three services. The stages share the Redis connection pool, the shard map and the pipelining buffer. Splitting them would put a network hop in the middle of a loop whose whole economy is batching ~500 writes per round trip.",
        numbers: [
          { value: "~50 workers, ~50k inserts/s each once batched", explain: "The batched per-worker throughput; issuing writes one at a time would need roughly twenty times as many workers for the same load." },
          { value: "~2.3M inserts/s sustained, headroom for the 5x event burst", explain: "The steady-state write rate after dormant-follower filtering, with enough spare capacity to absorb a global-event burst." },
        ],
        breaks: {
          failure: "Because it is one pool, a signup importing 500 follows, 50,000 backfill inserts, competes with live delivery.",
          handled: "Priority is a scheduling decision inside the worker rather than an isolation boundary, so a large enough backfill wave still shows up as fan-out lag.",
        },
        choice: {
          pick: "Backfill on the same worker pool as live fan-out, at lower priority",
          instead: "A dedicated backfill fleet, isolated from delivery.",
          decider:
            "Duty cycle. Backfill is bursty and rare, a follow, a signup import, while delivery is continuous. A dedicated fleet would be idle almost always and still has to be sized for the signup spike. Sharing means one pool sized for delivery absorbs backfill in its own headroom.",
          flips:
            "A product with continuous bulk imports: a migration, or a follow-recommendation rollout that adds follows for millions of users. There backfill stops being bursty and starts competing for the whole pool.",
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
        what: "The first stage of the worker: read the author's classification record and take the fork. Under the threshold, hand off to the paging stage.",
        why: "This is the fork the whole question turns on, and it lives in an async worker rather than on the write path. The expensive case, an author just under the threshold with 9,999 followers, costs the poster nothing and is allowed to take seconds.",
        numbers: [
          { value: "threshold 10,000 active followers", explain: "The line the whole hybrid forks on, bracketed between a ~1,000 read-side floor and a ~30,000 write-side ceiling." },
          { value: "~500 followers per posting account under the line", explain: "The typical push-side author's follower count, why the ordinary case is cheap even though the push path is the more expensive branch." },
          { value: "over the line: exactly 1 write, whatever the follower count", explain: "The pull branch's entire cost, independent of whether the author has 10,000 followers or 100 million." },
        ],
        breaks: {
          failure: "The record it reads is a batch product and therefore stale.",
          handled:
            "Stale towards 'already large' means the push is skipped while the reader's pull set still does not contain the author, so the post reaches nobody for up to a day. The 24h dual-mode window is what bounds this.",
        },
        choice: {
          pick: "Hybrid fan-out with the fork at 10,000 followers",
          instead: "Pull for everyone with each author's recent posts cached hot, or push for everyone.",
          decider:
            "Both bounds are capacity, not principle. Below ~1,000 a 200-follow reader carries ~40 pull sources against a ~30ms merge budget that fits ~25. Above ~30,000 the 10k-to-100k tier returns to the push path and adds ~7M writes/s to a 5.8M/s baseline under a ~15M/s ceiling. The defensible band is ~1,000 to ~30,000 and 10,000 is the middle of it.",
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
        what: "The stage a large author skips: page the follower list in blocks of 10,000, drop anyone with no session in 30 days, and group survivors by cache shard. It then issues pipelined ZADD plus ZREMRANGEBYRANK pairs ~500 to a round trip.",
        why: "The batching is the reason the push path is affordable at all. Issued one write at a time the same work needs roughly twenty times the worker fleet; grouped by shard and pipelined, a single worker sustains ~50,000 inserts/s.",
        numbers: [
          { value: "pages of 10,000 followers, ~500 ZADDs per round trip", explain: "The paging and batching sizes that make the write affordable; un-batched writes would need roughly twenty times the worker fleet." },
          { value: "~60% of a follower list filtered out as dormant", explain: "Accounts with no session in 30 days are dropped before any cache write, most of the reduction from 5.8M to 2.3M writes/s." },
          { value: "~5.8M writes/s unfiltered, ~2.3M/s after filtering", explain: "The write load before and after dormant filtering; the filtered figure is what the cache cluster ceiling is actually measured against." },
        ],
        breaks: {
          failure: "Worker lag is invisible from the write path: posting still succeeds, and the queue simply drains later.",
          handled: "Freshness degrades with nothing failing, so queue depth and oldest-job age are the only signals a lagging fleet is caught by.",
        },
        choice: {
          pick: "Page the graph forward and pipeline shard-grouped writes",
          instead: "Read the whole follower list into the worker, or issue writes one at a time as the list streams.",
          decider:
            "Memory against round trips. A 9,999-follower list is trivial to hold, but the same code runs against the tail during the 24h dual-mode window. Paging is what stops one author's list sizing the worker's heap. Un-batched writes cost one RTT each: at 0.5ms per insert the fleet is 20x larger for identical work.",
          flips: "A pure-push design with a hard follower cap, where every list fits in memory and the shard-grouping bookkeeping buys nothing.",
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
          { value: "up to 100 inserts per follow", explain: "500 × 100 = the ~50,000-insert signup spike named below — this per-follow cap is what keeps that worst case bounded rather than open-ended." },
          { value: "a signup importing 500 follows = ~50,000 inserts", explain: "The onboarding spike this job has to absorb without affecting live fan-out for other authors." },
          { value: "lower priority, same pool of ~50 workers as live fan-out", explain: "Backfill shares the delivery fleet's spare capacity rather than getting a dedicated fleet, since it is bursty and rare while delivery is continuous." },
        ],
        breaks: {
          failure: "Onboarding is the spike: 500 follows at once is 50,000 inserts for one user.",
          handled: "If that ran at delivery priority a signup wave would push fan-out lag for everybody, so backfill runs at lower priority in the same pool instead.",
        },
        choice: {
          pick: "Backfill asynchronously, and treat the followee as a pull source until it lands",
          instead: "Backfill synchronously inside the follow request, or never backfill and let the timeline fill naturally.",
          decider:
            "What the reader sees in the next few seconds. Synchronous means a follow request that writes up to 100 entries, and 500 of them at signup. Never backfilling means an empty feed for a brand-new account, the single worst first impression the product can make. Async plus a pull fallback costs one extra merge source for a few seconds.",
          flips: "A chronological feed with no ranking, where the pull fallback is cheap enough to be permanent and backfill is pure write amplification.",
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
        why: "Both directions are hot for different reasons. The worker needs 'who follows this author' to deliver, while the follow service and the nightly batch need 'which of this reader's follows are large' to maintain the pull set. One direction indexed means the other is a scan.",
        numbers: [
          { value: "~100B edges, ~200 follows per user", explain: "The scale of the adjacency set both fan-out and the nightly classifier operate over; too large to scan on any request." },
          { value: "~4% of edges point above the threshold", explain: "4% of 100B edges is ~4B pull-side links — and per reader, 4% of ~200 follows is roughly 8 large accounts in the pull set." },
        ],
        breaks: {
          failure: "Follow and unfollow propagation lags.",
          handled: "A reader keeps receiving posts from an account they dropped until the 1000-entry cap ages them out, which bounds the exposure to about two days without any explicit cleanup.",
        },
        choice: {
          pick: "Wide-column store with both-direction indexes, on hardware separate from the timeline tier",
          instead: "A graph database, or co-locating the graph with the timeline store.",
          decider:
            "Workload isolation more than query shape. These are single-key adjacency reads at 100B edges, not traversals, so a graph engine buys nothing. Co-location is the real trap: a viral post's fan-out triggers compactions that starve graph queries on the same nodes. That is exactly what pushed Twitter to split timelines out of Manhattan.",
          flips: "When the product needs real traversals, friends-of-friends or shortest-path recommendations, where an adjacency table forces you to hand-roll what a graph engine already does.",
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
        why: "Follow is where the read path's cheap lookups are paid for. Deciding at follow time which of your follows are large is what lets a feed load skip scanning 200 follows and checking each one's size. It is also the moment the reader is willing to wait a few milliseconds.",
        numbers: [
          { value: "edge write plus one set update", explain: "The two synchronous effects of a follow: the durable edge, and, if the followee is large, an entry in the reader's pull set." },
          { value: "backfill of up to 100 posts queued, not awaited", explain: "The third effect is asynchronous, so the follow request itself never waits on it." },
        ],
        breaks: {
          failure: "The three effects are not one transaction.",
          handled: "A crash between the edge write and the set update leaves a reader following a large account missing from their pull set. Nothing notices until the classification batch next rebuilds it.",
        },
        choice: {
          pick: "Update the reader's pull set inline, queue the backfill",
          instead: "Derive both asynchronously from a change-data-capture stream off the follow graph.",
          decider:
            "What the reader sees on their next load. The pull set has to be right within this single follow request, or a fresh follow of a celebrity produces nothing at all. The backfill is historic content and can be seconds late without anyone noticing; CDC would make both eventually consistent and the first case visibly wrong.",
          flips: "Once follows arrive in bulk, imports, recommendation rollouts, the inline path becomes the bottleneck, and CDC plus a rebuild is the only thing that keeps the request fast.",
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
        why: "Everything else here is conventional. What makes this a news feed rather than a CRUD app is that one post lands in one of these two places depending on how big its author is. The read path has to reconcile that at query time. Both stores are derived from the posts store and the follow graph, so neither is ever replicated cross-region or restored from backup. A lost shard is rebuilt lazily, and total loss is acceptable by construction.",
        numbers: [
          { value: "tl:{user_id} capped at 1000", explain: "The push-side key's size limit, which doubles as a garbage collector for stale and duplicate ids." },
          { value: "ar:{author_id} capped at 200", explain: "The pull-side key's size limit, sized to cover several days of a large account's posting." },
          { value: "0 recovery work: rebuilt lazily from source", explain: "Because both stores are derived from the posts store and follow graph, a lost shard needs no restore; it refills from the next write and the next read." },
        ],
        breaks: {
          failure: "An author who is in neither store, because the write path already thinks they are large and the read path does not, is invisible to every follower.",
          handled: "No error is raised anywhere for this case; the 24h dual-mode window around a classification crossing is what makes the failure rare rather than eliminating it.",
        },
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
          { value: "~24B per entry, 500M users x 1000 ids = ~12TB", explain: "The per-entry cost times the fleet-wide cap is the total memory footprint of the push half of the hybrid." },
          { value: "~100 shards at ~120GB each", explain: "How the ~12TB total is spread across the cluster, sized by write throughput rather than by data volume." },
          { value: "1000 entries = ~400 posts/day = ~2.5 days of feed", explain: "At a typical posting rate per followed account, the cap covers roughly two and a half days of feed before entries age out." },
        ],
        breaks: {
          failure: "A timeline can hold a full 1000 ids that hydrate down to 40 usable posts after deletes and blocks.",
          handled: "The write path is oblivious, because fan-out did deliver the ids; nothing detects this except a per-reader hydration-yield alarm watching the ratio of ids stored to posts returned.",
        },
        choice: {
          pick: "Redis sorted sets, one per user, capped at 1000 with score = timestamp",
          instead: "A wide-column row per user on disk, or an unbounded list.",
          decider:
            "The cap is the design, not the substrate. 1000 ids is ~2.5 days of feed at 24KB per user, ~12TB across the fleet. Going to 3000 to cover weekly users triples that to ~36TB of RAM, at 10 to 50x the per-GB cost of disk. It also extends the lifetime of every bad entry proportionally.",
          flips: "Past roughly 100M DAU the RAM economics stop working. The cold tail then moves to a wide-column store, with Redis kept only for the active working set, exactly the move Instagram made around 2013.",
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
        why: "It is the pull half of the hybrid and the cheapest thing in the system. Every follower of that account reads the same key, so a hundred million readers collapse onto one hot key. That is the access pattern a cache is best at.",
        numbers: [
          { value: "one write per post, not F writes", explain: "The entire saving of the pull branch: a single append regardless of whether the author has 10,000 or 100 million followers." },
          { value: "~200 ids per account, 20 read per feed load", explain: "The cap on this key against how much of it any one feed load actually reads, keeping it cheap under heavy fan-in." },
        ],
        breaks: {
          failure: "If this key is stale or unavailable the account vanishes from every follower's feed at once.",
          handled: "There is no push copy to fall back on, so recovery is an author-partition scan over a small recent window rather than a lookup anywhere else.",
        },
        choice: {
          pick: "A per-author sorted set read by every follower at query time",
          instead: "Pushing the post to all 100M followers like any other author.",
          decider:
            "Concentration, not total cost. At ~0.5ms of worker time per insert, 100M followers is 14 hours serial and ~50 seconds across 1000 workers. For those 50 seconds the cache cluster is saturated with one person's post while every other author's fan-out queues behind it.",
          flips: "Pushing large accounts to their small, highly engaged follower subset would beat this, but that is a third delivery mode and it is not built.",
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
        why: "Every other store here is derived from this one and can be thrown away. It is partitioned by author because both backfill-on-follow and the pull-path fallback ask the same question, give me this author's recent posts.",
        numbers: [
          { value: "1B posts/day at ~1KB = 1TB/day, ~3TB replicated", explain: "The daily write volume at replication factor 3, which sets the storage growth rate for the source of truth." },
          { value: "30-day hot tier ~90TB provisioned", explain: "The rolling window of storage kept readily available, derived directly from the daily replicated volume." },
        ],
        breaks: {
          failure: "A viral post turns one partition into 100k QPS of hydration.",
          handled: "That needs per-id hot detection, a 30 to 60s edge cache and request coalescing. The cache TTL is capped by the moderation SLA, because a cached post can survive its own deletion for that long.",
        },
        choice: {
          pick: "Wide-column store partitioned by author_id",
          instead: "PostgreSQL, or object storage with an index.",
          decider:
            "Write rate and access shape. 1B posts/day is ~12k blind writes/s growing 3TB/day replicated, read back as single-key batch gets with no joins. Postgres serves this happily until the row count and write rate outgrow one machine, and this table is the first to do so.",
          flips: "Under roughly 100M posts, where Postgres is simpler to operate and gives you real queries for analytics that the wide-column store cannot answer at all.",
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
        why: "It is drawn because it owns the design's nastiest failure. Nothing on either request path is allowed to count 100 billion edges, so the classification has to be produced somewhere off the hot path. Whatever produces it becomes the single point where the write path's view and the read path's view of an author can diverge.",
        numbers: [
          { value: "runs daily over ~100B edges", explain: "The full scan size that makes this a nightly batch job rather than a live computation on any request." },
          { value: "handful of accounts cross 10,000 on any given day", explain: "How rarely the classification actually changes, why a live pipeline would pay continuously for a decision that changes almost never." },
          { value: "opens a 24h dual-mode window per crossing", explain: "The safety margin around each crossing, during which the author is both pushed and pulled so the merge's deduplication covers the transition." },
        ],
        breaks: {
          failure: "A skipped or failed run freezes the classification.",
          handled: "Authors that grew past the threshold yesterday are still pushed, harmless but expensive, and authors that were demoted are pulled by nobody. The classification-disagreement metric is the signal, not a failed request.",
        },
        choice: {
          pick: "A nightly batch, with a 24h dual-mode window around each crossing",
          instead: "Maintain the classification live on every follow and unfollow.",
          decider:
            "How often the answer changes against how much it costs to keep exact. Follower counts move constantly but is_large flips for a handful of accounts a day, so a live pipeline pays continuously for a decision that changes almost never. The window makes the resulting staleness safe rather than trying to eliminate it: for 24 hours the author is both pushed and pulled, and the merge deduplicates.",
          flips: "If crossings become common, a product where accounts routinely oscillate around the line, the double-delivery window stops being cheap. The classification then has to become live, with hysteresis instead of a single threshold.",
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
        what: "One deployable that serves GET /feed: merge the two delivery routes into one post pool, rank it, then hydrate what came back and return it.",
        why: "Merge, rank and hydrate are three stages of one request, sharing the reader's context, the connection pools and the 200ms budget. Ranking is still the one stage that can fail independently, even though it deploys and scales with the other two rather than as a separate service. It has its own timeout and a fallback to chronological order that this service applies when the ranker misses.",
        numbers: [
          { value: "~80ms p50, ~180ms p95 against a 200ms budget", explain: "The end-to-end latency this deployable is held to, summing merge, ranking, hydration and network." },
          { value: "~145k loads/s average, ~650k/s on a global event", explain: "The read load this service is provisioned for, roughly 4.5x above average during a global event." },
        ],
        breaks: {
          failure: "Everything in here degrades together: one deployable means a hydration slowdown eats the same threads that serve merges.",
          handled: "A moderation event that drops hydration yield shows up as latency on feeds that had nothing to do with it. Ranking is the one stage carved out with its own timeout and fallback for exactly this reason.",
        },
        choice: {
          pick: "Merge, rank and hydrate as one deployable, with ranking scoped as the one stage that can time out and fall back",
          instead: "Split ranking into its own service that this one calls over the network.",
          decider:
            "Whether the stage has its own failure mode. Ranking times out on its own and falls back to chronological order, so it already behaves like an abandonable call even while co-located. Splitting it out would only add one network hop for that same behaviour. Merge and hydrate have no such independence — if hydration fails there is no feed to return, so isolating either buys nothing but latency.",
          flips:
            "Once ranking's resource profile diverges enough from merge and hydrate, GPU inference against a materially different cost and scaling curve. Co-locating it then wastes capacity on one side, and the extra hop is worth paying to scale it independently.",
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
        what: "Reads the pushed timeline and the pull sources concurrently, merges by score, deduplicates by post id, and truncates to a 500-post pool.",
        why: "This is where the two delivery paths become one feed. Deduplication by post id is not an optimisation. During the 24h dual-mode window a crossing author's post arrives by both routes, so the merge has to be idempotent by construction rather than by luck.",
        numbers: [
          { value: "~2ms timeline read, ~2ms pipelined pull, ~1ms merge CPU", explain: "The three costs that sum into this stage's share of the 200ms budget, with the two reads issued concurrently." },
          { value: "~8 pull sources at p50, hard cap 25", explain: "The typical and maximum number of large accounts a reader's pull set contributes, the figure the 30ms merge budget is sized against." },
          { value: "500 posts handed to ranking", explain: "The pool size this stage truncates to, chosen so the first ranking stage's ~5ms-per-500 cost stays inside budget." },
        ],
        breaks: {
          failure: "A pull-heavy reader fills the 500-post budget from the pull side alone, squeezing out whatever their pushed timeline held.",
          handled: "That reader is typically the new user whose follows are almost all large accounts. The design accepts this rather than special-casing it, since the pool is still ranked fairly across whatever it contains.",
        },
        choice: {
          pick: "Merge at read time with the pull set capped at 25 sources",
          instead: "An uncapped merge over every large account the reader follows.",
          decider:
            "The 200ms p95 budget: ~35ms ranking, ~60ms hydration, ~40ms network, leaving ~30ms for the merge. Each pull source contributes ~20 posts and the first ranking stage costs ~5ms per 500, so past ~25 sources the pool doubles and ranking cost doubles with it.",
          flips: "A chronological feed with no ranking tier. Without the ranking budget the merge is bounded only by round trips, and the cap can rise to whatever the pipeline sustains.",
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
        numbers: [
          { value: "~60ms for the top 50", explain: "The batch-get latency against the posts store for the ranked ids the reader will actually see." },
          { value: "over-fetch ~70 to return 50 at 30% drop", explain: "The tuned over-fetch factor that compensates for the typical drop rate from deletes, blocks and restrictions." },
        ],
        breaks: {
          failure: "A load whose pool is heavily unhydratable returns short.",
          handled: "The over-fetch factor is tuned rather than derived, so it occasionally guesses wrong. A feed page then comes back with fewer than 50 posts, rather than reaching further down the ranked list.",
        },
        choice: {
          pick: "Store ids in timelines and resolve content and visibility at read time",
          instead: "Denormalise post bodies into every follower's timeline so a read needs no second hop.",
          decider:
            "The cost of a delete. With ids, a delete is one write to the posts store, taking effect on the next hydration everywhere. With bodies it is a rewrite of up to 100 million cached lists, and any one missed leaves deleted content on screen. Bodies would also multiply the 12TB cache by the ~1KB post size.",
          flips: "Immutable, non-private content with no deletes, edits, blocks or regional rules, where hydration enforces nothing and the extra hop is pure latency.",
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
        what: "Scores the 500-post pool: a cheap first stage trims to 100, a deep model scores the survivors against a feature store.",
        why: "Separate from the feed service because it is the one stage that can be abandoned. It runs on different hardware and is the first thing to degrade under load. The feed service is expected to give up on it and serve chronological order rather than a blank feed. Ranking also cannot move to write time: the signals that decide the order, engagement in the last hour, do not exist when the post is written. The same post also ranks differently for two readers.",
        numbers: [
          { value: "~5ms first stage over 500", explain: "The cheap filtering pass that trims the pool before the expensive model runs." },
          { value: "~30ms deep model over 100", explain: "The cost of scoring the survivors of the first stage; running it over the full 500 instead would blow the ranking budget." },
          { value: "2.5B ranks/day with the 5 min cache", explain: "500M users at roughly 5 loads a session, collapsed by the per-user cache to one rank computation per cache window." },
        ],
        breaks: {
          failure: "A ranker timeout is invisible to the reader.",
          handled: "They get the same posts in chronological order and are not told the feed was not ranked; only the timeout-rate metric shows the degradation happened.",
        },
        choice: {
          pick: "Rank at read time over a ~500-post pool, cache the ranked result per user for 5 minutes",
          instead: "Rank asynchronously on a schedule and store a materialised ordered feed.",
          decider:
            "Loads per user per day against refresh cycles. The 5-minute cache collapses the ~5 loads in a session to 1, so 500M users x 5 = 2.5B ranks/day. Precomputing to the same freshness means ranking every active user every 5 minutes: 500M x 288 = 144B ranks/day, 58x the compute for an identical result. Break-even is around 1 to 2 loads per user per day.",
          flips: "A digest product opened once a day inverts the ratio and lets you run a model far too expensive to serve inline. It also wins for cold-start readers specifically, who cannot hit 200ms from the pull path at all.",
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
          { value: "~145k loads/s average, ~220k/s diurnal peak, ~650k/s on a global event", explain: "The read load curve the whole read path is provisioned against, roughly 4.5x average at its highest." },
          { value: "20 posts per page, 200ms p95", explain: "The page size and latency budget the client contracts for on every request." },
        ],
        breaks: {
          failure: "Scrolling past ~1000 entries falls off the end of the cached timeline and onto the pull path.",
          handled: "That path is about 1% of loads and by far the slowest, accepted as a rare degraded case rather than optimised for.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client-write",
      to: "post-service",
      tier: "data",
      label: "new post",
      detail: {
        what: "The post itself: text and media references, on its way to durable storage.",
        why: "It is the only synchronous hop the author pays for. Everything after this returns to them as a post id while delivery is still in flight.",
        numbers: [{ value: "~12k posts/s steady", explain: "The baseline load this synchronous hop is provisioned for." }],
        breaks: {
          failure: "A scheduled prompt synchronises independent clients into a 10x spike in one second.",
          handled: "The durable write path has to absorb it directly, because jitter can only be applied after the ack, so this hop is provisioned for burst rather than steady state.",
        },
      },
    },
    {
      id: "e2",
      from: "post-service",
      to: "posts-db",
      tier: "data",
      label: "durable quorum write",
      detail: {
        what: "The quorum write of the post row, which is what the author's success response actually means.",
        why: "The ack is deliberately tied to this and not to delivery. Posting latency stays independent of follower count, and no post can be delivered as an id that resolves to nothing.",
        numbers: [
          { value: "~1KB per row", explain: "1KB × 12k posts/s × 86,400s/day ≈ 1TB/day, matching the figure below — quorum write bandwidth stays trivial even at that daily volume." },
          { value: "1TB/day, ~3TB with replication factor 3", explain: "The daily storage growth this write path drives, before and after replication." },
        ],
        breaks: {
          failure: "If the ack ever moves ahead of this write, fan-out delivers ids for a post that does not exist.",
          handled: "Every hydration of such an id would return silently empty, which is why the ack is deliberately tied to this commit and never to anything downstream.",
        },
      },
    },
    {
      id: "e3",
      from: "post-service",
      to: "fanout-bus",
      tier: "data",
      label: "fan-out event after ack",
      detail: {
        what: "One delivery event per post, published only after the durable write has committed.",
        why: "Ordering the publish after the commit is what makes the log safe to replay. Every event on it refers to a post that definitely exists, so a worker restart can reprocess without producing dangling ids.",
        numbers: [{ value: "one event per post, ~12k/s", explain: "The publish rate mirrors the write rate one-to-one, since delivery is triggered per post." }],
        breaks: {
          failure: "Publish-before-commit would turn a crash between the two into permanent phantom entries in follower timelines.",
          handled: "Nothing would ever clean those up except the 1000-entry cap eventually ageing them out, which is why the publish is strictly ordered after the commit instead.",
        },
      },
    },
    {
      id: "e4",
      from: "fanout-bus",
      to: "p-classify",
      tier: "hot",
      step: 1,
      label: "keyed by author_id",
      detail: {
        what: "Delivery events consumed in partition order, so one author's posts are handled by one consumer in write order.",
        why: "This is the only ordering guarantee in the system, and it is deliberately per author rather than global. A globally ordered stream would fix cross-author ordering, but it would hand the write path a single-stream throughput ceiling, a far worse trade.",
        numbers: [
          { value: "1 partition key: author_id", explain: "The ordering guarantee this consumption preserves: one author's posts are always processed in write order." },
          { value: "5x burst absorbed here, not by Redis", explain: "The queue is what buffers a global-event spike; the cache cluster only ever sees the steady drain rate behind it." },
        ],
        breaks: {
          failure: "Partition skew: one prolific author pins a partition.",
          handled: "That consumer falls behind while the rest idle, and queue-depth alerts per partition are the only signal, since there is no automatic rebalancing for a single hot author.",
        },
      },
    },
    {
      id: "e5",
      to: "follow-graph",
      tier: "data",
      from: "p-classify",
      label: "read is_large",
      detail: {
        what: "The classification read that decides push or pull for this post: a single row lookup for the author's is_large flag, written nightly by the classifier.",
        why: "It is a cached, batch-written flag rather than a live count, because counting a 100 million edge follower list per post is not affordable. The staleness that buys is exactly what the dual-mode window covers.",
        numbers: [
          { value: "threshold 10,000 active followers", explain: "The line this single read decides against, the same threshold the nightly classifier maintains." },
          { value: "one row read per post", explain: "The entire cost of this check; cheap enough to run on every single post without touching the follower count itself." },
        ],
        breaks: {
          failure: "Stale towards 'already large' here means the worker skips the push while the reader's pull set does not yet contain the author.",
          handled: "The post reaches nobody for up to a day with no error anywhere; the 24h dual-mode window bounds this exposure rather than eliminating it.",
        },
      },
    },
    {
      id: "e6",
      from: "p-classify",
      to: "p-push",
      tier: "hot",
      step: 2,
      label: "under 10k: fan out",
      detail: {
        what: "The push branch, in process: hand the post and the author id to the paging stage.",
        why: "This is the expensive branch and it is the common one. Roughly 96% of follow edges point below the threshold, so almost every post takes this hop and its cost is what sets the size of the fan-out fleet.",
        numbers: [
          { value: "~500 followers per posting account under the line", explain: "The typical size of the push branch's target list, small next to the threshold itself." },
          { value: "~96% of edges below the threshold", explain: "Almost every follow relationship is push-side, why this branch, though expensive, is also common and sets the fan-out fleet's size." },
        ],
        breaks: {
          failure: "The branch is taken on a number that is up to a day old.",
          handled: "An account that crossed this morning still takes the push branch and pays for delivery nobody needed. This is accepted as harmless waste, since the alternative is checking the graph live on every post.",
        },
      },
    },
    {
      id: "e7",
      from: "p-classify",
      to: "author-recent",
      tier: "data",
      label: "over 10k: one append",
      detail: {
        what: "The pull branch: for an author over the threshold, a single append to their own recent-posts list, and the worker is done.",
        why: "One write instead of F writes is the point. The delivery work does not disappear; it moves to the read path. There it becomes one hot key shared by every follower rather than a burst of 100 million writes on one cluster in one moment.",
        numbers: [
          { value: "1 write per post regardless of follower count", explain: "The pull branch's entire cost, the saving that makes a threshold worth having at all." },
          { value: "list capped at ~200 ids", explain: "The size limit on the author's own recent-posts key, enough history to cover several days of posting." },
        ],
        breaks: {
          failure: "Nothing is delivered, so if this key is lost the author is missing from every follower's feed simultaneously.",
          handled: "There is no push copy anywhere to fall back on for this author, the trade the pull branch makes in exchange for one write instead of millions.",
        },
      },
    },
    {
      id: "e8",
      from: "p-push",
      to: "follow-graph",
      tier: "data",
      label: "follower pages of 10,000",
      detail: {
        what: "Paging the author's follower list forwards, in blocks of 10,000, and grouping survivors by cache shard.",
        why: "Paging and shard-grouping exist so the writes can be pipelined ~500 to a round trip; issued one at a time the same work would need twenty times the worker fleet.",
        numbers: [
          { value: "pages of 10,000", explain: "The page size the follower list is walked in, bounding worker memory during the 24h dual-mode window's tail cases." },
          { value: "~500 ZADDs per round trip", explain: "The pipelining batch size that makes the write throughput achievable." },
          { value: "~50,000 inserts/s per worker once batched", explain: "The resulting per-worker throughput; issuing writes one at a time instead would need roughly twenty times as many workers." },
        ],
        breaks: {
          failure: "This read is on the same physical tier as every other graph query.",
          handled: "If the timeline tier and the graph tier are ever co-located, a viral fan-out starves ordinary follow lookups, which is why they are kept on separate hardware.",
        },
      },
    },
    {
      id: "e10",
      from: "p-push",
      to: "timeline-cache",
      tier: "hot",
      step: 3,
      label: "ZADD + trim to 1000",
      detail: {
        what: "The push itself: one ZADD plus ZREMRANGEBYRANK per active follower, pipelined in batches of ~500.",
        why: "This edge is the entire cost of the push half of the hybrid. It is also the number that caps how high the threshold can go, since every tier moved onto this path multiplies sustained cache write rate.",
        numbers: [
          { value: "~2.3M inserts/s sustained after filtering", explain: "The steady-state write rate this arrow carries after dormant followers are dropped, the figure the cluster ceiling is measured against." },
          { value: "~12M/s at diurnal peak against a ~15M/s ceiling", explain: "The load at the busiest time of day, leaving roughly 20% headroom under the cluster's write ceiling." },
        ],
        breaks: {
          failure: "This is the arrow that saturates.",
          handled: "One author over the threshold pushed by mistake queues every other author's delivery behind 100 million writes on the same cluster, exactly the concentration failure the threshold exists to prevent.",
        },
      },
    },
    {
      id: "e11",
      from: "client-write",
      to: "follow-service",
      tier: "data",
      label: "follow / unfollow",
      detail: {
        what: "The other write the product supports, and the one that changes what a feed is made of.",
        why: "A follow has three consequences, not one: an edge, a possible pull-set entry, and a backfill job. A design that only accounts for the posting path leaves the reader's first load after a follow undefined.",
        numbers: [
          { value: "3 consequences per follow: edge, pull-set entry, backfill job", explain: "The full set of effects one follow triggers, only the first of which is guaranteed synchronous." },
          { value: "a signup can carry 500 of these at once", explain: "The onboarding burst this write path has to absorb without degrading for unrelated users." },
        ],
        breaks: {
          failure: "Unfollow is the weaker half: the edge disappears immediately but already-pushed ids stay in the reader's timeline.",
          handled: "Posts from a dropped account keep appearing for up to two days, until the 1000-entry cap ages them out; nothing actively removes them sooner.",
        },
      },
    },
    {
      id: "e12",
      from: "follow-service",
      to: "follow-graph",
      tier: "data",
      label: "edge, indexed both ways",
      detail: {
        what: "The durable record of the follow, written so it is readable forwards (who follows this author) and backwards (who does this reader follow).",
        why: "This is the only durable effect of a follow. Everything else the follow service touches — the pull set, the backfill — is derived from this edge and can be rebuilt from it.",
        numbers: [
          { value: "~100B edges total", explain: "The scale of the durable record this write contributes to." },
          { value: "~200 follows per user", explain: "The typical fan-out on the follower side of a single account's graph." },
        ],
        breaks: {
          failure: "Propagation lag between this write and the derived sets is a real risk.",
          handled: "The CDC-lag and post-from-unfollowed-author canaries watch specifically for this gap between the durable edge and the sets derived from it.",
        },
      },
    },
    {
      id: "e14",
      from: "follow-service",
      to: "p-backfill",
      tier: "data",
      label: "backfill job, low priority",
      detail: {
        what: "The asynchronous job: fetch the followee's last 100 posts and insert them into this reader's timeline.",
        why: "It rides the same worker pool as live fan-out at lower priority, because backfill is bursty and rare while delivery is continuous. A dedicated fleet would sit idle almost always and still need sizing for the signup spike.",
        numbers: [
          { value: "up to 100 inserts per follow", explain: "This per-follow cap is the multiplier behind the 50,000-insert signup spike below: 500 follows × 100 = that worst case, bounded rather than open-ended." },
          { value: "500 follows imported at signup = 50,000 inserts", explain: "The worst-case burst this queue has to absorb without affecting live delivery." },
        ],
        breaks: {
          failure: "Priority inside a shared pool is scheduling, not isolation.",
          handled: "A large enough backfill wave still shows up as fan-out lag for unrelated authors, since there is no hard resource boundary between the two job types.",
        },
      },
    },
    {
      id: "e15",
      from: "p-backfill",
      to: "posts-db",
      tier: "data",
      label: "author's last 100 posts",
      detail: {
        what: "A single-partition read of the followee's recent posts, which is exactly the query the store is partitioned for.",
        why: "It is the second consumer of author-partitioning, alongside the pull-path fallback, and it is why the partition key is author_id rather than post_id or time.",
        numbers: [
          { value: "100 posts, one partition", explain: "The read this job issues, matching exactly the partition key the posts store was chosen for." },
          { value: "one read per follow", explain: "500 follows at signup means 500 of these reads, but each is bounded to 100 rows regardless of whether the followee has 200 posts or 200,000." },
        ],
        breaks: {
          failure: "Following a very prolific account makes this a wide read.",
          handled: "Doing 500 of these at signup turns onboarding into a burst of partition scans, why backfill runs at low priority rather than inline with the follow request.",
        },
      },
    },
    {
      id: "e16",
      from: "p-backfill",
      to: "timeline-cache",
      tier: "data",
      label: "insert 100, cap 1000",
      detail: {
        what: "Inserting the fetched ids into the new follower's timeline, scored by their original timestamps so they land in the right place rather than at the top.",
        why: "Scoring by original timestamp is what stops a follow from looking like a burst of new posts. The reader wanted history, not a notification storm.",
        numbers: [{ value: "up to 100 entries against a 1000 cap", explain: "The backfilled batch relative to the timeline's total size, about 10% of the cap in the worst case." }],
        breaks: {
          failure: "100 backfilled entries is 10% of the cap.",
          handled: "Importing many follows at once can push a reader's genuinely recent posts out of the window before they have been seen. This is accepted as a rare cost of instant history on a new follow.",
        },
      },
    },
    {
      id: "e18",
      from: "classifier",
      to: "follow-graph",
      tier: "control",
      label: "count edges, write is_large",
      detail: {
        what: "The nightly batch scan that counts each author's followers in the forward direction, then writes back is_large, crossed_at and the affected readers' pull sets.",
        why: "It is the reason the classification is a batch product at all. Counting 100 billion edges is affordable once a day, off the request path, and affordable nowhere else. Writing the result back to this same store is what the live worker's read, via the other edge into this store, depends on.",
        numbers: [
          { value: "~100B edges scanned", explain: "The full nightly scan size, the same figure that makes live classification unaffordable." },
          { value: "~4% of edges point above the threshold", explain: "4% of the ~100B edges scanned is ~4B relationships whose pull-set membership this nightly write actually has to touch or update." },
        ],
        breaks: {
          failure: "This scan runs on the same tier the fan-out fleet is paging.",
          handled: "It has to be rate-shaped or it competes with live delivery for the graph, so the nightly job is throttled to stay below the headroom the push path needs.",
        },
      },
    },
    {
      id: "e21",
      from: "client-read",
      to: "p-merge",
      tier: "data",
      label: "GET /feed?cursor",
      detail: {
        what: "A feed request for the next 20 posts, carrying an opaque cursor rather than an offset.",
        why: "Cursors because the underlying timeline is being appended to and trimmed while the reader scrolls, so an offset would skip and repeat posts across pages.",
        numbers: [
          { value: "~145k loads/s average, ~650k/s on a global event", explain: "The request rate this endpoint is provisioned for, the same curve the whole read path is sized against." },
          { value: "20 posts per page", explain: "The page size returned per request, the unit the cursor advances by." },
        ],
        breaks: {
          failure: "A cursor beyond the 1000-entry cap cannot be served from the cache.",
          handled: "It drops onto the pull path instead, about 1% of loads and the slowest thing in the product, accepted as a rare degraded case rather than eliminated.",
        },
      },
    },
    {
      id: "e22",
      from: "timeline-cache",
      to: "p-merge",
      tier: "hot",
      step: 4,
      label: "pushed ids, ~2ms",
      detail: {
        what: "One ZREVRANGE returning up to 1000 prebuilt post ids for this reader.",
        why: "This is what the whole write path was for: the ordinary reader's feed is one round trip against an already-ordered list, with no join and no merge.",
        numbers: [
          { value: "up to 1000 ids", explain: "The maximum size of a single ZREVRANGE response, bounded by the timeline's own cap." },
          { value: "~2ms, one round trip", explain: "At ~2ms this leaves nearly all of the ~30ms merge budget (below) for the pull-path reads — the pushed timeline is essentially free by comparison." },
        ],
        breaks: {
          failure: "A cold or evicted timeline returns empty.",
          handled: "The entire feed then has to be rebuilt from the pull path inline, which cannot meet the 200ms budget. A cold timeline is a rare, explicitly slower path rather than something masked.",
        },
      },
    },
    {
      id: "e23",
      from: "author-recent",
      to: "p-merge",
      tier: "hot",
      step: 5,
      label: "large-account ids, ~2ms",
      detail: {
        what: "A pipelined read of ~20 recent ids from each large account in the reader's pull set, issued concurrently with the timeline read.",
        why: "This is the read-time half of the hybrid. The two reads are issued together rather than in sequence because the pushed timeline gates nothing, so the merge waits on both and costs one round trip, not two.",
        numbers: [
          { value: "~8 sources at p50, capped at 25", explain: "The typical and maximum fan-in this pipelined read issues, the figure the 30ms merge budget is measured against." },
          { value: "20 ids per source, one round trip regardless of count", explain: "Each pull source contributes a bounded number of ids, and pipelining keeps the cost to one round trip no matter how many sources are queried." },
        ],
        breaks: {
          failure: "Each extra source adds ~20 posts to a fixed 500-post budget.",
          handled: "This is why the cap exists at 25, and why lowering the push/pull threshold to 1,000 would put roughly 40 sources here and blow the merge budget entirely.",
        },
      },
    },
    {
      id: "e24",
      to: "p-merge",
      tier: "data",
      from: "follow-graph",
      label: "pull set, ~8 of 25",
      detail: {
        what: "The reader's large-account set, read first because it is what says which recent-posts keys to pipeline.",
        why: "It is one set read instead of a scan over 200 follows and their classifications. That is the difference between a merge that fits in 30ms and one that does not.",
        numbers: [
          { value: "~8 entries at p50", explain: "The typical size of a reader's large-account pull set." },
          { value: "hard cap 25", explain: "The upper bound on this set, matching the merge stage's source cap." },
          { value: "one round trip", explain: "This single read decides how many of up to 25 sources the next stage pipelines — its cost never grows even as that count does." },
        ],
        breaks: {
          failure: "Stale membership here is invisible: an account missing from the set is simply absent from the feed.",
          handled: "The reader has no way to tell that from the account not having posted, which is why the classification-disagreement metric, not a user report, is what catches it.",
        },
      },
    },
    {
      id: "e25",
      from: "p-merge",
      to: "ranker",
      tier: "hot",
      step: 6,
      label: "500-post pool",
      detail: {
        what: "The merged, deduplicated, time-truncated post pool handed to ranking.",
        why: "It is bounded at 500 deliberately: ranking cost is linear in pool size, and the first stage costs ~5ms per 500. The pool cap and the pull-source cap are the same constraint seen from two ends.",
        numbers: [
          { value: "500 posts, ~1ms of merge CPU", explain: "The pool size handed to ranking and the negligible cost of producing it, compared to what ranking itself costs." },
          { value: "~35ms of ranking budget", explain: "The latency allowance ranking gets inside the 200ms total, set so the two-stage model fits comfortably." },
        ],
        breaks: {
          failure: "This is the call the feed service must be willing to abandon.",
          handled: "On a ranker timeout it serves the same pool in chronological order, and the reader is not told, so a ranking failure degrades quality rather than availability.",
        },
      },
    },
    {
      id: "e26",
      from: "ranker",
      to: "p-hydrate",
      tier: "data",
      label: "100 ranked, hydrate 50",
      detail: {
        what: "The ranked survivors, trimmed by the first stage and scored by the deep model, passed on for content resolution.",
        why: "Ranking runs before hydration because hydration is the expensive step and there is no point paying ~60ms to resolve posts that will not be shown.",
        numbers: [
          { value: "500 to 100 at ~5ms, 100 scored at ~30ms", explain: "The two-stage cost: a cheap filter over the full pool, then an expensive model over only the survivors." },
          { value: "top 50 hydrated", explain: "Only the final 50 actually get resolved to content, since nothing past this point will be shown." },
        ],
        breaks: {
          failure: "The order can be undone downstream.",
          handled: "If hydration drops 30% of the top 50, the returned feed is short, or has to reach further down a list that was already ranked. This is accepted rather than re-ranking after the fact.",
        },
      },
    },
    {
      id: "e27",
      from: "p-hydrate",
      to: "posts-db",
      tier: "data",
      label: "batch get + visibility",
      detail: {
        what: "A batch get of the ranked post ids against the source of truth, with a per-post visibility check for this reader.",
        why: "It is the second hop that the ids-not-bodies rule buys. It is also where deletes, blocks, suspensions and regional restrictions actually take effect, which is why derived timelines never need rewriting.",
        numbers: [
          { value: "~60ms for the top 50", explain: "The batch-get latency against the source of truth for the final set of ids the reader will see." },
          { value: "over-fetch ~70 to return 50", explain: "The tuned buffer against the typical drop rate from deletes, blocks and restrictions." },
        ],
        breaks: {
          failure: "A viral post makes one id 100k QPS here.",
          handled: "It needs hot-key detection plus a 30 to 60s edge cache. That TTL is exactly how long a deleted post can stay visible despite being removed from the source of truth.",
        },
      },
    },
    {
      id: "e28",
      from: "p-hydrate",
      to: "client-read",
      tier: "hot",
      step: 7,
      label: "50 posts, next_cursor",
      detail: {
        what: "The assembled page of ranked, visible posts plus the cursor for the following page.",
        why: "Everything upstream is budgeted against this one response: ~2ms timeline, ~2ms pull, ~1ms merge, ~35ms ranking, ~60ms hydration, ~40ms network.",
        numbers: [{ value: "~80ms p50, ~180ms p95 against a 200ms budget", explain: "The end-to-end latency everything upstream is budgeted against, summing every stage plus network." }],
        breaks: {
          failure: "If ranking times out the fallback is chronological order over the same pool.",
          handled: "The feed degrades in quality rather than going blank, and the reader is not told, the same fallback the ranking service itself applies.",
        },
      },
    },
  ],
};
