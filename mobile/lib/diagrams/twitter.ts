import type { Diagram } from "./types";

export const TWITTER: Diagram = {
  id: "twitter",
  title: "Twitter / X",
  question: "Design Twitter / X",
  sourceId: "patterns",
  itemId: 26,
  overview: {
    shape:
      "One durable write on the left, three derived systems hanging off a single event stream, and a read path that assembles a timeline and collapses cascade duplicates.",
    forces: [
      {
        constraint: "Fan-out is ~1.2M timeline appends/s steady, orders of magnitude more work than the one write that triggers it",
        decision: "Tweet service acknowledges after one durable row write, then publishes an event; fan-out runs asynchronously off the stream",
        lights: ["tweet-service", "tweet-store", "event-stream", "e1", "e2", "e4"],
      },
      {
        constraint: "The per-tweet burst budget is ~200k appends/s against a 5s freshness SLO, so 1M is the most one tweet may push",
        decision: "Fan-out cuts push at ~1M active followers, not at a flat follower-count threshold",
        lights: ["fanout", "follow-graph", "e6", "e7"],
      },
      {
        constraint: "500k accounts retweeting at ~500 mean followers each would push 250M entries in twenty minutes, 2.5x what the celebrity cut avoided",
        decision: "A rate-triggered cutover at ~1,000 retweets/min turns later retweets into edges the Timeline service merges, not individual pushes",
        lights: ["fanout", "timeline-service"],
      },
      {
        constraint: "Raising the push cut from 10k to 1M followers takes read-side fan-in from ~38 fetches to 2 to 4",
        decision: "Timeline service maintains a small fetch-path set per reader and does one pipelined multi-get, not N sequential reads",
        lights: ["timeline-service", "follow-graph", "timeline-caches", "e11", "e12"],
      },
      {
        constraint: "A deleted tweet must vanish from every cached timeline instantly, without rewriting millions of cached entries",
        decision: "Timelines store 8-byte ids only; Hydration + counters resolves bodies, tombstones and visibility late, at read time",
        lights: ["timeline-caches", "hydrator", "e15"],
      },
    ],
    naive: {
      text: "Skip precomputing anything. When a reader opens their timeline, walk each account they follow, read that author's recent tweets from the tweet store, and merge the results by id at request time. This needs no Fan-out service and no Timeline caches at all. It fails on fan-in, not on any single read. A typical account follows about 150 people, so one page load costs 150 single-partition reads against the authoritative store. That is instead of the 2 to 4 pipelined reads the actual design achieves. At ~58k timeline loads/s steady that is millions of reads per second of amplification against a store sized for ~2.3k writes/s. The p99 latency of 150 sequential reads blows past the 300ms budget before any ranking or hydration even starts. The Fan-out service and Timeline + recent caches replace this by doing the merge work once, at write time, for the accounts where it is cheap. They fall back to fan-in only for accounts too large to push to.",
      lights: ["fanout", "timeline-caches", "timeline-service"],
    },
    beats: [
      {
        text: "The write path is deliberately tiny. The poster's request reaches the tweet service, which takes a Snowflake id, a time-sortable identifier, and writes one ~1KB row to a wide-column store partitioned by author_id. It acknowledges the poster, then publishes an event. Media never enters that row: it goes to a separate blob store, and the row carries only a reference. 50M media tweets a day at ~500KB is 25TB against a 1KB row.",
        lights: ["poster", "tweet-service", "tweet-store", "event-stream", "e1", "e2", "e4"],
      },
      {
        text: "Ids are load-bearing rather than incidental. 41 bits of millisecond timestamp, 10 of machine, 12 of sequence means sorting by id sorts by time. The timeline stores no separate timestamp, an entry is 8 bytes, and merging two delivery routes is a merge of two sorted integer lists rather than a sort.",
        lights: ["timeline-caches", "timeline-service"],
      },
      {
        text: "Distribution is where this question parts company with a generic feed's push-versus-pull derivation. The cut is drawn per edge, at ~1M active followers, and only into readers who opened the app in the last 7 days. The binding constraint is the per-tweet burst budget of 200k appends per second against a 5s freshness SLO.",
        lights: ["fanout", "follow-graph", "timeline-caches", "e5", "e6", "e7"],
      },
      {
        text: "Then the cascade, which is the part nobody arrives with. Excluding a 100M-follower account from push saves 100M writes. 500k ordinary accounts retweeting that same tweet at ~500 mean followers each generate 250M pushed entries in twenty minutes, 2.5x the volume the celebrity rule existed to avoid. A rate-triggered cutover at ~1,000 retweets per minute turns later retweets into edges in a per-original list that the Timeline service's merge already consults.",
        lights: ["fanout", "timeline-service"],
      },
      {
        text: "The read path has a 300ms p99 and exactly one term in it that scales with the graph: the pipelined fan-in over above-cut followees. Raising the cut from 10k to 1M takes that from ~38 fetches to 2 to 4. Everything else, the merge, the retweet_of dedupe, ranking and hydrating 20 bodies, is bounded by the candidate window and the page.",
        lights: ["timeline-service", "hydrator", "reader", "e11", "e12", "e14", "e17"],
      },
      {
        text: "Search and trending are consumers of the same stream and never sit in the write path, so an indexer falling behind cannot stop anyone tweeting. Search is a second architecture rather than a box: an append-only in-memory index of the last 7 days in descending id order. A batch-built relevance-ordered archive sits behind the same query API.",
        lights: ["search", "trending", "e9", "e10"],
      },
    ],
    crux: {
      problem:
        "The celebrity is a solved problem and costs one line of policy. The content you kept off the push path comes back onto it wearing a different hat.",
      handled:
        "A retweet cascade routes the same tweet id through fan-out at 2.5x the volume the celebrity rule avoided, in a fraction of the time, from accounts far below the cut. A rate-triggered cutover at ~1,000 retweets/minute catches this. Later retweets of a cascading original become edges in a per-original list the Timeline service's merge already knows how to consult, instead of individual timeline pushes.",
    },
    numbers: [
      {
        value: "200M tweets/day, ~2.3k/s steady and ~50k/s at a global event",
        explain: "Baseline write volume and the peak multiple the write path and event stream have to absorb without falling behind.",
      },
      {
        value: "push cut at ~1M active followers, from 200k appends/s x 5s SLO",
        explain: "The derivation of the fan-out threshold: the per-tweet burst budget multiplied by the freshness SLO sets the ceiling on entries one tweet may push.",
      },
      {
        value: "500k retweets x ~500 followers = 250M entries at ~200k/s",
        explain: "The volume an ordinary-account cascade generates, 2.5x what excluding one 100M-follower celebrity from push saves.",
      },
      {
        value: "hot search window: 1.4B docs x 15 postings x 4B = ~84GB",
        explain: "The size of the 7-day append-only search index, small enough to be fully RAM-resident across its shard fleet.",
      },
    ],
  },
  nodes: [
    {
      id: "derived-group",
      label: "Derived, never in the write path",
      kind: "zone",
      detail: {
        what: "The two stream consumers that are not distribution: search indexing and trending.",
        why: "Both are built from the same tweet event stream as fan-out, so neither can be a dependency of posting. A search cluster falling behind must degrade search, not stop the write path.",
        numbers: [
          { value: "searchable within 10s", explain: "The freshness target for a newly posted tweet to appear in search results." },
          { value: "trend list refreshed once a minute", explain: "The cadence at which the trending pipeline recomputes its top-K output per geo." },
        ],
        breaks: {
          failure: "Both are rebuildable caches with different staleness targets.",
          handled: "Every correctness question about them is a reconciliation problem rather than a transaction, since neither can block or be blocked by the write path.",
        },
      },
    },
    {
      id: "poster",
      label: "Poster",
      sub: "posts, waits on the durable row",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The author's app, sending one post request and waiting only for the tweet row to be acknowledged.",
        why: "The poster's whole experience is this one round trip. Everything past the durable write, fan-out, search, trending, is invisible to this client and allowed to be both asynchronous and stale.",
        numbers: [
          { value: "2.3k posts/s steady, ~50k/s peak", explain: "The write rate this client population generates, the baseline the whole write path is sized against." },
          { value: "ack after 1 durable write, not after fan-out", explain: "The exact point at which the poster's request returns, deliberately excluding all downstream distribution work." },
        ],
        breaks: {
          failure: "A client that retries a slow ack without an idempotency key can double-post.",
          handled: "The idempotency key travels with the original request rather than being assigned server-side after the fact, so a retry safely resolves to the same tweet.",
        },
      },
    },
    {
      id: "reader",
      label: "Reader",
      sub: "20 cards per page",
      kind: "client",
      col: 0,
      row: 3,
      detail: {
        what: "The app rendering a page of the home timeline: 20 cards with bodies, media and counts, on the first screen of every session.",
        why: "This is the client the entire read path is sized for: a 300ms p99 and a fixed-size response. That holds regardless of how many accounts the reader follows or how large a cascade is running underneath.",
        numbers: [
          { value: "20 cards per page", explain: "The fixed response size every upstream stage is bounded against, regardless of graph size or cascade activity." },
          { value: "~58k timeline loads/s steady, ~120k/s peak", explain: "The read rate this client population generates, the load the whole timeline-service and hydration path is provisioned for." },
        ],
        breaks: {
          failure: "A stale block on this client shows a timeline that has not moved in minutes.",
          handled: "A missing block triggers a cold rebuild rather than serving silently empty, so staleness is visible as a rebuild rather than a stuck feed.",
        },
      },
    },
    {
      id: "tweet-service",
      label: "Tweet service",
      kind: "service",
      col: 1,
      row: 0,
      sub: "Snowflake id; ack on durable row",
      detail: {
        what: "Takes a post, assigns an id, writes the tweet row, acknowledges the author, and publishes a tweet event.",
        why: "The poster must not wait on distribution. Fan-out is 100B timeline writes a day, roughly 1.2M/s steady, and the acknowledgement has no business being hostage to any of it. Everything after the durable row is derived and is allowed to be stale or to be retried.",
        numbers: [
          { value: "~1KB row", explain: "The one durable write everything downstream derives from — at 2.3k/s steady, ~50k/s peak, the whole pipeline's correctness rests on this single commit." },
          { value: "2.3k tweets/s steady, ~50k/s peak", explain: "The write throughput this service must sustain, matching global posting volume." },
          { value: "5s freshness SLO for active followers", explain: "The target time from post to visible in an active follower's timeline, the number the fan-out burst budget is derived from." },
        ],
        breaks: {
          failure: "Publishing the event before the row is durable inverts the ordering.",
          handled: "A consumer could index or fan out a tweet that a crash then loses, with nothing downstream able to tell, which is why the row commit always precedes the publish.",
        },
        choice: {
          pick: "Acknowledge after the tweet row is durable, publish the event afterwards",
          instead: "Acknowledge only once fan-out has completed, so a tweet is visible everywhere the moment it returns.",
          decider:
            "Fan-out for an ordinary author is ~500 timeline appends and for a mid-tier account tens of thousands. A synchronous ack would couple a sub-100ms write to a job whose length varies by four orders of magnitude with follower count. The 5s freshness SLO exists precisely so that work can be asynchronous.",
          flips:
            "A small deployment where mean follower count is in the tens, so fan-out is a handful of writes and doing it inline removes an entire queue and its backlog alerting.",
        },
      },
    },
    {
      id: "event-stream",
      label: "Tweet event stream",
      sub: "Kafka, one stream, three consumers",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "The durable log every derived system reads: fan-out, the search indexer and trending all consume the same tweet events.",
        why: "The tweet store is partitioned by author and answers one question, what did this author post. Every other question in the product is a different index over the same events. Those indexes are consumers of one stream rather than features of one database, and none of them can block posting.",
        numbers: [
          { value: "~2.3k events/s steady, ~50k/s at a global event", explain: "The publish rate this stream carries, matching the tweet-service's own write rate one-for-one." },
          { value: "three independent consumer groups", explain: "Fan-out, search and trending each track their own offset, so one falling behind never affects the others." },
        ],
        breaks: {
          failure: "Consumer lag is silent from the write side.",
          handled: "Posting still looks perfectly healthy while timelines, search and trends drift minutes behind reality, so per-consumer lag is monitored as its own SLO independent of write-path health.",
        },
        choice: {
          pick: "One Kafka stream with independent consumer groups per derived system",
          instead: "The tweet service calling fan-out, the indexer and trending directly.",
          decider:
            "Blast radius against a 99.99% read availability target with three consumers at very different reliability. Direct calls put a search cluster's health inside the p99 of posting and give no replay when a consumer is rebuilt. A log lets each of the three fall behind, be reset and be re-run without the write path noticing.",
          flips:
            "One consumer and no rebuild story, where a queue or a direct call is dramatically less to operate than a partitioned log.",
        },
      },
    },
    {
      id: "tweet-store",
      label: "Tweet store",
      sub: "Cassandra, partition by author_id",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "The only authoritative record: one ~1KB row per tweet, partitioned by author_id, holding text, parent_id, retweet_of and 32 bytes of media references.",
        why: "Partitioning by author makes writes cheap and makes the profile timeline a single partition scan. It cannot answer everything I follow, newest first, at all, and that is deliberate: the distribution layer exists precisely because this store refuses that query. Media bytes live in a separate blob store behind a CDN, uploaded before the post request and only referenced here. 50M media tweets a day at ~500KB post-transcode is ~25TB against a ~1KB row, so inlining it would multiply this store roughly 125x.",
        numbers: [
          { value: "200M rows/day, ~200GB/day raw", explain: "Daily write volume and the raw bytes it produces before replication." },
          { value: "~600GB/day at RF=3", explain: "The replicated write volume this store absorbs daily." },
          { value: "~1.1PB replicated over 5 years", explain: "~600GB/day × 365 × 5 ≈ 1.1PB — the growth rate that rules out a relational engine and demands cheap linear scaling instead." },
          { value: "~25TB/day of media held off the row, hot for 30 days", explain: "The media volume kept entirely in object storage rather than inline, and how long it stays warm at the CDN edge." },
        ],
        breaks: {
          failure: "A prolific author is one partition, so a single account posting at machine rate concentrates writes and profile reads on one replica set.",
          handled: "This is monitored as hot-partition load rather than treated as an edge case, since the partitioning scheme trades this concentration for cheap writes everywhere else.",
        },
        choice: {
          pick: "Wide-column store (Cassandra or Manhattan) partitioned by author_id",
          instead: "Sharded PostgreSQL with the same partition key.",
          decider:
            "Write volume against a store with no join requirement. 200M rows/day at ~1KB is ~600GB/day replicated and ~1.1PB over five years, with an access pattern of blind writes and single-partition reads. There is no query here that needs a relational engine, and there is a lot of data that needs cheap linear growth.",
          flips:
            "Under roughly 100M tweets total, where one Postgres primary holds the corpus, gives real ad-hoc queries, and needs no per-request consistency knob.",
        },
      },
    },
    {
      id: "fanout",
      label: "Fan-out service",
      sub: "per-edge cut, ~1M active followers",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "Consumes tweet events, appends the id to the author's own recent list, and for below-cut authors pushes it into the timelines of followers active in the last 7 days.",
        why: "Push versus pull is a general derivation and the specific test here is narrower: active follower count against the cut, then reader activity per edge inside the loop. A typical follow set is thick with mid-tier accounts sitting just above any flat threshold. This service also records every retweet against its original in a per-original retweeter list and bumps a rate counter. Above ~1,000 retweets/minute, later retweets of that original become edges in this list instead of individual timeline pushes.",
        numbers: [
          { value: "cut at ~1M active followers", explain: "The threshold below which an author's tweets are pushed individually to every active follower." },
          { value: "~200k appends/s budget dedicated to one tweet", explain: "The per-tweet burst rate this service can sustain, the number the whole cut derivation starts from." },
          { value: "pool sized ~5M appends/s against 1.2M/s steady", explain: "The fleet's total capacity versus its typical steady-state load, leaving headroom for correlated spikes." },
          { value: "cutover above 1,000 retweets/minute", explain: "Crossing it is what avoids the 500k x ~500 followers = 250M entries the next number shows a viral chain would otherwise push individually." },
          { value: "500k retweets x ~500 followers = 250M entries avoided", explain: "The push volume the cascade cutover prevents once a retweet chain crosses the trigger rate." },
        ],
        breaks: {
          failure: "Aggregate burst, not any single tweet, is the real threat. A 20x tweet-rate spike wants ~24M appends/s against a ~5M/s pool, and the queue simply grows.",
          handled: "The shed is to tighten the activity window from 7 days to an hour, roughly 9x fewer readers, pushing that cohort onto the cold rebuild path instead of dropping writes.",
        },
        choice: {
          pick: "Cut on active followers at ~1M and push only into readers active in the last 7 days",
          instead: "The standard hybrid: a flat cut at ~10k total followers, applied to every follower regardless of whether they read.",
          decider:
            "The per-tweet burst budget, not aggregate cost. The pool can give one tweet ~200k appends/s and the freshness SLO is 5s, so 200k x 5 = 1M entries is the most one tweet may push. That lands the cut at 1M. At 1M a 150-account follow set holds 2 to 4 fetch-path authors; at 10k it holds ~38.",
          flips:
            "When the fleet cannot sustain a 200k/s burst for one tweet, or timelines live in a store with millisecond writes, or the SLO is far tighter than 5s. The cut genuinely drops into the tens of thousands then, and read fan-in has to be attacked instead.",
        },
      },
    },
    {
      id: "follow-graph",
      label: "Follow graph",
      sub: "forward + inverse + fetch-path set",
      kind: "database",
      col: 3,
      row: 3,
      detail: {
        what: "Two views of the same edge, follower to followee and followee to follower, plus a small denormalised per-user set of the above-cut authors that user follows.",
        why: "The graph is read in opposite directions by the two paths. Fan-out needs the followers of an author; the read path needs which of a reader's followees sit on the fetch path. Neither can be derived from the other cheaply at 75B edges. Both are materialised, and the asymmetry is paid for in write amplification rather than read latency.",
        numbers: [
          { value: "~500M accounts x ~150 follows = ~75B edges", explain: "At this scale neither direction derives cheaply from the other, which is why both are materialised and the cost lands in write amplification, not read latency." },
          { value: "median 20 followers, p99 ~5,000, top thousand above 100M", explain: "The follower-count distribution, wildly skewed, which is what makes a flat threshold a poor fit for the push cut." },
          { value: "fetch-path set typically 2 to 4 entries", explain: "The typical size of the denormalised set a reader's timeline load actually consults." },
        ],
        breaks: {
          failure: "Mass follow is the stress case: an account gaining 10M followers in an hour puts 10M appends against one inverse-index key.",
          handled: "The same 10M users need their fetch-path sets rewritten again the moment that account crosses the cut, so crossings are handled as a batch job rather than as individual events.",
        },
        choice: {
          pick: "Both edge directions materialised, plus a maintained per-user fetch-path set",
          instead: "Computing the fetch-path authors per request by walking the user's follows and reading each author's follower count.",
          decider:
            "Read-path cost inside a 300ms p99. Recomputing means 150 edge reads plus 150 counter lookups on every timeline load at ~58k loads/s; the maintained set is one small read that returns 2 to 4 ids. The write cost is bounded because it changes only on a follow or on an author crossing the cut.",
          flips:
            "Small follow sets and a low read rate. There walking the graph per request is a few milliseconds, and the denormalised set is state that can go stale for no benefit.",
        },
      },
    },
    {
      id: "timeline-caches",
      label: "Timeline + recent caches",
      sub: "packed 8B ids: tl 800, author 200",
      kind: "database",
      col: 3,
      row: 1,
      detail: {
        what: "Two id-only structures in the same cluster: one home timeline per user capped at ~800 ids, and one recent-tweets list per author capped at ~200 that the fetch path reads.",
        why: "Storing ids rather than bodies is what makes deletion, editing and visibility changes cheap: they resolve at hydration instead of requiring millions of cached lists to be rewritten. It also makes an entry 8 bytes rather than ~1KB, the difference between a cache that fits and one that does not.",
        numbers: [
          { value: "800 ids x 8B = 6.4KB payload/user", explain: "The per-user storage cost for one full home-timeline cache entry." },
          { value: "~2.8TB packed vs ~25TB as sorted sets", explain: "A 9x gap from representation alone — packed 8-byte ids beat a Redis sorted set's ~90B/member skiplist overhead at 350M users held." },
          { value: "350M weekly active users held", explain: "The population this cache tier serves, the scale the packed-block design was chosen against." },
        ],
        breaks: {
          failure: "Losing a large shard produces a rebuild storm, since every affected user falls onto the 150-fetch cold path at once.",
          handled: "Rebuilding lazily from author recent lists, rather than backfilling globally, spreads the recovery load instead of concentrating it into one storm.",
        },
        choice: {
          pick: "Packed blocks of 8-byte ids with a small header",
          instead: "Redis sorted sets keyed by user with the tweet id as score.",
          decider:
            "Memory on the largest cache in the system. Above 128 members a sorted set switches to skiplist plus dict at roughly 90B per member, so 800 members is ~72KB per user and 350M users is ~25TB. Packed blocks are ~8KB per user and ~2.8TB, a 9x difference.",
          flips:
            "When the cache comfortably fits either way. A sorted set is off the shelf, and a custom structure is only correct when the access pattern is stable and the team can carry a fork for years.",
        },
      },
    },
    {
      id: "timeline-service",
      label: "Timeline service",
      sub: "fan-in, k-way merge, dedupe, rank",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "The read path: prebuilt block, resolve fetch-path followees, one pipelined multi-get of their recent lists, merge by id, collapse retweet_of duplicates, filter and rank.",
        why: "Only one step scales with the graph, the fan-in over above-cut followees, and everything else is bounded by the candidate window and the page. That is why the push cut is chosen to control read fan-in rather than write volume. At a 10k cut the varying term is ~38 fetches; at 1M it is 2 to 4. During a cascade the merge also draws on a per-original retweeter list held in the fan-out tier. This happens once that original has crossed the ~1,000 retweets/minute cutover and stopped fanning out individually.",
        numbers: [
          { value: "300ms p99 budget", explain: "The end-to-end latency target this entire read path is sized against." },
          { value: "~58k timeline loads/s steady, ~120k/s peak", explain: "The call rate this service absorbs, matching the reader client population." },
          { value: "3 keys pipelined is ~1ms; 38 keys done naively is ~20ms", explain: "The latency cost of fan-in at the actual cut versus a flat 10k-follower threshold, the number that justifies the higher cut." },
          { value: "1 extra merge source while a cascade is tripped, collapsing to 1 entry per original", explain: "The retweet-cascade edge list joins the merge as one more sorted source, deduplicated down to a single entry per original tweet." },
        ],
        breaks: {
          failure: "A cold mailbox has nothing at step 1 and every followee becomes a fetch-path author: 150 recent-list reads instead of 3.",
          handled: "This arrives correlated when lapsed users return during a global event, which is an accepted cost of the cold-rebuild path rather than something actively mitigated.",
        },
        choice: {
          pick: "A k-way merge over an arbitrary list of sorted sources, deduplicated by retweet_of",
          instead: "A two-way union of the pushed timeline and the pulled celebrity lists.",
          decider:
            "The second source is never the last one. Out-of-network recommendations, replies in engaged conversations and cascade edges all enter as further sorted sources, and each one costs nothing extra in a k-way merge. Dedupe is not cosmetic: during a cascade one original can arrive from dozens of followees and occupy most of a reader's 20 visible slots.",
          flips:
            "A strictly chronological product with exactly two delivery routes and no ranking, where a two-way union is simpler and provably sufficient.",
        },
      },
    },
    {
      id: "hydrator",
      label: "Hydration + counters",
      sub: "20 bodies, tombstones, counters",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "Turns the top 20 ranked ids into rendered tweets: bodies from the tweet cache, tombstone checks, blocks and mutes. It sums engagement counts across counter shards and resolves media ids into CDN URLs.",
        why: "This is the only step that touches the tweet store, and it is where late binding pays off. A deleted tweet vanishes from every timeline at once because hydration finds a tombstone, without rewriting any of the 250M cached entries that point at it. Media resolution happens here for the same reason bodies do: the row carries only a reference. Media bytes never pass through this tier, so a card with a viral video costs the CDN, not the timeline path.",
        numbers: [
          { value: "~1.2M hydrations/s before caching", explain: "The raw hydration workload before any cache absorbs it, one id lookup per rendered card." },
          { value: "99% cache hit leaves ~12k store reads/s", explain: "What actually reaches the authoritative tweet store once the hydration cache absorbs its share." },
          { value: "~1B engagement increments/day, ~12k/s", explain: "The counter-write volume this tier absorbs, spread across shards per tweet." },
          { value: "media hot in the CDN for 30 days", explain: "How long media stays warm at the edge before falling back to colder object storage." },
        ],
        breaks: {
          failure: "A hot tweet concentrates load on exactly one cache key, and its counters need tens of thousands of increments per second spread across shards.",
          handled: "That key gets client-side replication across cache nodes rather than the usual single-owner hashing, and a deleted tweet's media invalidates the CDN edge as well as the row.",
        },
        choice: {
          pick: "Hydrate ids late from a cache fronting the tweet store, with counters sharded per tweet",
          instead: "Materialising bodies and counts into the timeline at fan-out time.",
          decider:
            "8 bytes against ~1KB per entry, and the delete story. Materialised bodies would make the timeline cache ~125x larger and turn one deletion into millions of cached-list rewrites. Sharded counters are forced separately: no single row survives tens of thousands of increments per second.",
          flips:
            "Feeds small enough to hold bodies, or products where a stale copy of a post is acceptable and the extra round trip at read time is not.",
        },
      },
    },
    {
      id: "search",
      label: "Search index tier",
      sub: "in-memory 7d + batch archive",
      kind: "database",
      col: 1,
      row: 2,
      parent: "derived-group",
      detail: {
        what: "Two indexes behind one query API: an append-only in-memory index of the last 7 days with documents in descending tweet-id order, and a batch-built relevance-ordered archive on disk.",
        why: "The corpus is public, so search is a first-class subsystem rather than a feature, and it answers a question the timeline cannot: what did the world say four seconds ago. Descending id order lets a recency query stop as soon as it has k hits instead of scoring every match.",
        numbers: [
          { value: "1.4B docs in the 7-day window", explain: "Feeds directly into the ~84GB total below — small enough that the entire 7-day hot window stays memory-resident across its shard fleet." },
          { value: "1.4B x 15 postings x 4B = ~84GB, under 1GB per shard across 100", explain: "The full memory footprint of the hot index, small enough to be entirely RAM-resident across its shard fleet." },
          { value: "archive ~3KB/doc, ~600GB/day, ~220TB/year", explain: "The growth rate of the colder, relevance-ordered archive that documents age into after leaving the hot window." },
        ],
        breaks: {
          failure: "Ingestion lag puts the freshest tweets exactly where they are most wanted and least present.",
          handled: "Under load, tokenisation of low-value fields, link previews and alt text, is shed before shedding documents, preserving core search coverage over enrichment.",
        },
        choice: {
          pick: "Two indexes: append-only time-ordered hot window, batch-built relevance-ordered archive",
          instead: "One general-purpose search cluster with time-partitioned indexes and a 1-second refresh interval.",
          decider:
            "Segment-merge write amplification at 200M docs/day. That is ~600GB/day of new index, and a tiered merge policy rewrites each document 8 to 10 times, so ~5 to 6TB/day of rewrite concentrated exactly when ingest spikes. The append-only hot index does zero merges by construction.",
          flips:
            "Peak ingest under a few thousand docs/s, or a 10 to 30 second freshness target, where one cluster is far less to build and the merge amplification is affordable.",
        },
      },
    },
    {
      id: "trending",
      label: "Trending pipeline",
      sub: "top-K per geo",
      kind: "service",
      col: 2,
      row: 2,
      parent: "derived-group",
      detail: {
        what: "A streaming top-K over the same tweet events, holding bounded sketch and heap state per geo partition and refreshing the trend list once a minute.",
        why: "It is named here so it is not mistaken for a storage problem or a new pipeline. It is a ranking problem over an existing stream, sharing nothing with fan-out or search but the event log it reads from.",
        numbers: [
          { value: "~200 geo partitions", explain: "The granularity at which trending is computed independently, one set of top-K state per partition." },
          { value: "under 10MB of state per partition", explain: "The bounded memory cost of one partition's sketch and heap, small enough to hold every partition comfortably in memory." },
          { value: "refreshed once a minute", explain: "The cadence at which each partition's trend list is recomputed and published." },
        ],
        breaks: {
          failure: "Bot spam poisons hashtag counts, and counting alone cannot tell a botnet from a moment.",
          handled: "Scoring by entity diversity, unique posters, network diversity and account age lets the pipeline suppress low-diversity bursts rather than relying on raw counts.",
        },
        choice: {
          pick: "Bounded sketch plus heap per geo partition, consuming the shared event stream",
          instead: "Exact counts per term in a datastore, queried on a schedule.",
          decider:
            "State size against a stream at ~2.3k tweets/s carrying tens of thousands of distinct terms. Sketch and heap is a few MB per partition across ~200 partitions. Exact counting is unbounded cardinality and a growing table, for an answer that only needs the top few dozen.",
          flips:
            "A small corpus with a bounded term vocabulary, where exact counts are cheap and give a defensible answer to why something trended.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e2",
      from: "tweet-service",
      to: "tweet-store",
      tier: "hot",
      step: 2,
      label: "durable row, then ack",
      detail: {
        what: "The one write in this design that must not be lost: the ~1KB tweet row, partitioned by author_id.",
        why: "This is the only strongly consistent step. Everything after it is a derived cache with its own staleness. The correctness of the whole product rests on this single write and the fact that the acknowledgement follows it.",
        numbers: [
          { value: "~1KB per row", explain: "×200M rows/day ×3 replicas ≈ 600GB/day — this size makes the store's growth linear and cheap, not any single write slow." },
          { value: "200M rows/day", explain: "Daily volume through this write path." },
          { value: "~600GB/day at RF=3", explain: "The replicated write footprint this store absorbs." },
        ],
        breaks: {
          failure: "Acknowledging before the quorum returns means a poster is told their tweet exists when it may not.",
          handled: "This is the one failure this design refuses to tolerate, so the ack is strictly gated on quorum confirmation, never issued optimistically.",
        },
      },
    },
    {
      id: "e4",
      from: "tweet-service",
      to: "event-stream",
      tier: "hot",
      step: 3,
      label: "publish after ack",
      detail: {
        what: "The tweet event, published only once the row is durable and the poster has been acknowledged.",
        why: "This ordering is the whole shape of the design. Publishing after the ack means distribution, indexing and trending are all downstream of a fact rather than a prediction. Any of them can fail, be retried, or be rebuilt from the log without consulting the write path.",
        numbers: [
          { value: "one event per tweet", explain: "The publish rate here tracks the write rate exactly, one to one." },
          { value: "~50k/s at a global event", explain: "The peak this arrow has to absorb, matching the write path's own peak." },
        ],
        breaks: {
          failure: "If the publish fails after the ack, the tweet exists but reaches nobody.",
          handled: "That gap needs an outbox or a reconciliation sweep against the store, not a retry loop in the request, since the poster has already been told the tweet succeeded.",
        },
      },
    },
    {
      id: "e5",
      from: "event-stream",
      to: "fanout",
      tier: "hot",
      step: 4,
      label: "tweet event",
      detail: {
        what: "Tweet events consumed by the distribution tier.",
        why: "Fan-out is a consumer like any other, which is what lets it lag under load without touching posting. Under a correlated spike the mitigation is to tighten the activity window and shed readers, never to drop tweets.",
        numbers: [
          { value: "1.2M timeline appends/s steady", explain: "The baseline write load this consumer generates downstream of every tweet event." },
          { value: "pool sized ~5M/s", explain: "The fleet's provisioned capacity, well above steady load to absorb bursts." },
          { value: "a 20x spike wants ~24M/s", explain: "The demand a severe correlated event can generate, well past what the pool alone can absorb." },
        ],
        breaks: {
          failure: "Queue depth grows silently during a global event.",
          handled: "Publish-to-visible lag is monitored as the alert that matters, since error rate stays at zero throughout a purely capacity-driven slowdown.",
        },
      },
    },
    {
      id: "e6",
      from: "fanout",
      to: "follow-graph",
      tier: "control",
      label: "followers, active only",
      detail: {
        what: "Reading the author's follower list from the inverse index and intersecting it with the recently-active set.",
        why: "The activity filter is applied here rather than at read time because a push into a mailbox nobody opens is pure waste. With ~350M of 500M accounts active weekly it only removes ~30% of edges, so take it for the read-path effect on the cut rather than for the write saving.",
        numbers: [
          { value: "~75B edges total", explain: "The full size of the graph this read potentially draws from." },
          { value: "~350M weekly active of ~500M accounts", explain: "The active population the filter narrows the follower set down to." },
          { value: "~30% of edges removed", explain: "The typical share of a follower list this activity filter excludes from push." },
        ],
        breaks: {
          failure: "A stale active set pushes into cold mailboxes and skips warm ones.",
          handled: "The read path sees cold rebuilds it did not expect in this case, which is why active-set freshness is tracked as its own signal rather than assumed correct.",
        },
      },
    },
    {
      id: "e7",
      from: "fanout",
      to: "timeline-caches",
      tier: "hot",
      step: 5,
      label: "append 8-byte id",
      detail: {
        what: "The push itself: appending the tweet id to each surviving follower's timeline block, plus one unconditional append to the author's own recent list.",
        why: "The author append happens for every tweet regardless of the cut, because it is the fetch path's only source. Above the cut it is the entire distribution: one write, one cache key, shared by 100M followers.",
        numbers: [
          { value: "8 bytes per entry", explain: "8B versus ~1KB per body is the gap between a cache that fits (~2.8TB) and one that doesn't (~25TB) — id-only is what makes fan-out affordable at all." },
          { value: "~200k appends/s budget per tweet", explain: "The per-tweet burst rate this write path can sustain, the number the push cut is derived from." },
          { value: "cap 800 per timeline, 200 per author", explain: "The maximum list length maintained per structure, bounding both memory and rebuild cost." },
        ],
        breaks: {
          failure: "The cap is also the garbage collector.",
          handled: "Without it, unfollows, deletes and bad deploys would leave entries that nothing ever goes back to clean up, so the bounded length doubles as automatic cleanup.",
        },
      },
    },
    {
      id: "e9",
      from: "event-stream",
      to: "search",
      tier: "data",
      label: "docs, searchable in 10s",
      detail: {
        what: "Tweet events tokenised into documents and appended to the hot index in descending id order.",
        why: "Search reads the same stream as fan-out so that indexing can never be a precondition for posting. The append-only shape means this path has no merge amplification to fall behind on: what remains is transport and tokenisation, which scale by adding shards.",
        numbers: [
          { value: "~15 indexable terms per tweet", explain: "The typical number of postings one tweet generates in the index." },
          { value: "10s freshness target", explain: "The latency budget from tweet publish to appearing in search results." },
          { value: "100 shards, under 1GB of postings each", explain: "The fleet size and per-shard footprint that keeps the entire hot index RAM-resident." },
        ],
        breaks: {
          failure: "Deleted tweets stay in sealed segments behind a query-time tombstone filter until they age out of the 7-day window.",
          handled: "Visibility and erasure are given different SLAs on purpose, since fast tombstoning at query time is cheap while physical removal from sealed segments is not.",
        },
      },
    },
    {
      id: "e10",
      from: "event-stream",
      to: "trending",
      tier: "control",
      label: "counts per geo partition",
      detail: {
        what: "The same events feeding a bounded sketch and heap per geographic partition.",
        why: "Trending is a third consumer rather than a component of search or of the feed, because it shares nothing with them but the stream it reads.",
        numbers: [
          { value: "~200 partitions", explain: "200 × under 10MB per-partition state stays under 2GB total — geo-partitioning keeps this whole tier tiny, sharing no storage with the 75B-edge follow graph." },
          { value: "refreshed once a minute", explain: "The output cadence for each partition's trend list." },
        ],
        breaks: {
          failure: "The stream carries spam as faithfully as it carries news.",
          handled: "Suppression has to happen inside this consumer, not upstream, since the event stream itself makes no judgment about content quality.",
        },
      },
    },
    {
      id: "e11",
      from: "timeline-service",
      to: "follow-graph",
      tier: "control",
      label: "fetch-path set, 2 to 4",
      detail: {
        what: "Step 2 of the read path: one small read returning the above-cut authors this reader follows.",
        why: "This is maintained rather than computed so that a timeline load never walks 150 edges and 150 follower counts inside a 300ms budget. It is the number that decides how wide the next hop is.",
        numbers: [
          { value: "2 to 4 entries typical at a 1M cut", explain: "The typical fetch-path set size under the actual push cut this design uses." },
          { value: "~38 at a 10k cut", explain: "What the same set would grow to under a naively lower flat threshold, the comparison that justified the higher cut." },
          { value: "several hundred for a 30,000-follow account", explain: "The extreme case: a user following an unusually large number of accounts." },
        ],
        breaks: {
          failure: "An account crossing the cut invalidates this set for every one of its followers at once.",
          handled: "Crossings are treated as a batch job with a recently-crossed side list, rather than as an individual event needing synchronous rewrite.",
        },
      },
    },
    {
      id: "e12",
      from: "timeline-service",
      to: "timeline-caches",
      tier: "hot",
      step: 6,
      label: "prebuilt block + fan-in",
      detail: {
        what: "One read of the reader's packed timeline block, then one pipelined multi-get of the recent lists for their fetch-path authors.",
        why: "The fan-in must be a single pipelined round trip, never N sequential ones. Throughput is not the failure mode here. The failure mode is read latency becoming a function of how many famous accounts a user happened to follow, not a property you want inside a p99.",
        numbers: [
          { value: "~800 ids in the block, sub-millisecond", explain: "Negligible next to the ~1ms pipelined fan-in that follows it — reading the reader's own block is not what this path's p99 budget has to worry about." },
          { value: "3 keys pipelined ~1ms", explain: "The typical fan-in cost at the actual push cut, a single pipelined round trip." },
          { value: "38 keys over 20 shards naively ~20ms", explain: "The cost the same fan-in would carry under a lower flat follower cut, the comparison that justified this design." },
        ],
        breaks: {
          failure: "A missing block means a cold user.",
          handled: "The rebuild treats all ~150 followees as fetch-path authors through this same edge, which is slower but correct, rather than a special-cased recovery path.",
        },
      },
    },
    {
      id: "e14",
      from: "timeline-service",
      to: "hydrator",
      tier: "hot",
      step: 7,
      label: "top 20 ids after ranking",
      detail: {
        what: "The ranked ids handed on for hydration, after merge, dedupe, blocks, mutes and scoring.",
        why: "Ranking runs here rather than at write time because the strongest signals, engagement in the last hour, do not exist when the tweet is distributed. Caching the unranked candidate set instead of the ranked result means a model change invalidates nothing.",
        numbers: [
          { value: "a few hundred candidates", explain: "The typical size of the merged, deduplicated pool ranking operates over before the final cut." },
          { value: "20 hydrated per page", explain: "The final count handed on to hydration, matching the fixed page size the whole read path targets." },
        ],
        breaks: {
          failure: "Pagination is the hard case: a positional cursor over a continuously rewritten ranked list duplicates and skips items.",
          handled: "Page 3 needs a pinned per-session snapshot rather than a live re-rank, so paging stays stable even as the underlying candidate pool keeps changing.",
        },
      },
    },
    {
      id: "e15",
      from: "hydrator",
      to: "tweet-store",
      tier: "data",
      label: "bodies on cache miss",
      detail: {
        what: "Fetching tweet bodies for the ids that missed the tweet cache.",
        why: "This is the only read path that reaches the authoritative store, and it is also where a tombstone is discovered. Late binding is what makes deletion instant everywhere without touching a single cached timeline.",
        numbers: [
          { value: "~1.2M hydrations/s before caching", explain: "The raw lookup volume before the hydration cache absorbs most of it." },
          { value: "99% hit rate leaves ~12k store reads/s", explain: "The actual load that reaches the tweet store once caching is applied." },
        ],
        breaks: {
          failure: "A cache hit rate drop of a few points multiplies store reads by an order of magnitude.",
          handled: "The tweet cache is treated as load-bearing rather than an optimisation, so its hit rate is alarmed directly rather than only inferred from store load.",
        },
      },
    },
    {
      id: "e1",
      from: "poster",
      to: "tweet-service",
      tier: "hot",
      step: 1,
      label: "POST tweet",
      detail: {
        what: "The post request itself: text, optional media ids already uploaded, and the client's idempotency key.",
        why: "Everything the write path is optimised for starts here: the poster must not wait on distribution. This hop and the durable write behind it are the only latency the author actually feels.",
        numbers: [
          { value: "2.3k tweets/s steady, ~50k/s peak", explain: "The request rate this entry point absorbs, matching global posting volume." },
          { value: "~1KB request body", explain: "The typical size of one post request, small enough that the network hop itself is not the bottleneck." },
        ],
        breaks: {
          failure: "A retried post without an idempotency key creates a second tweet rather than returning the first.",
          handled: "This is indistinguishable from a double-post bug once it reaches the timeline, which is why the idempotency key is mandatory on every post request rather than optional.",
        },
      },
    },
    {
      id: "e17",
      from: "hydrator",
      to: "reader",
      tier: "hot",
      step: 8,
      label: "20 rendered cards",
      detail: {
        what: "The finished response: 20 hydrated tweets with bodies, media CDN URLs and counts, returned for one page of the reader's timeline.",
        why: "This is the arrow the whole read path exists to serve. Everything upstream, the cut, the merge, the rank, is spent so this response is a fixed-size JSON payload. That holds regardless of how many people the reader follows or how viral the tweets in it are.",
        numbers: [
          { value: "20 cards per page", explain: "The final fixed response size, the target every upstream stage's cost was bounded against." },
          { value: "300ms p99 budget end to end", explain: "The full latency target from request to this response, the number the whole read path is sized to hit." },
        ],
        breaks: {
          failure: "A page that mixes cached and freshly-hydrated cards inconsistently reads as a broken feed.",
          handled: "Hydration always runs over the whole page rather than only over cache misses, so every card in a response is consistently fresh.",
        },
      },
    },
  ],
  figures: {
    "cascade-dedupe": {
      title: "The k-way merge dedupes a cascade in one pass",
      nodes: [
        {
          id: "dup-source",
          label: "3 followees, tweet X",
          sub: "same tweet, arrives 3 times",
          kind: "database",
          col: 0,
          row: 0,
          detail: {
            what: "The same retweeted original arriving from several followees' sorted lists during the same k-way merge pass.",
            why: "A viral cascade means many followees carry the identical tweet id, and merging naively would repeat it once per followee.",
          },
        },
        { id: "single-source", label: "1 followee, tweet Y", kind: "database", col: 0, row: 1 },
        {
          id: "merged-feed",
          label: "Merged feed: 2 rows",
          sub: "not 4",
          kind: "service",
          col: 0,
          row: 2,
          detail: {
            what: "The deduplicated output of the merge: each distinct tweet id kept once, with repeats folded into an attribution count.",
            why: "A hash set over the candidate window catches the duplicate in the same pass that already merges the sorted lists, so the visible feed never repeats a tweet just because several followees retweeted it.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "dup-source", to: "merged-feed", tier: "hot", step: 1, label: "kept once, +2 others" },
        { id: "e2", from: "single-source", to: "merged-feed", tier: "hot", step: 2, label: "kept as-is" },
      ],
    },
  },
};
