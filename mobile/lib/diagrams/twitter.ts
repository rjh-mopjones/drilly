import type { Diagram } from "./types";

export const TWITTER: Diagram = {
  id: "twitter",
  title: "Twitter / X",
  question: "Design Twitter / X",
  sourceId: "patterns",
  itemId: 26,
  overview: {
    shape:
      "One durable write on the left, three independent derived systems hanging off a single event stream, and a read path on the right that assembles a timeline from two sources and has to collapse the duplicates a retweet cascade puts in front of it.",
    beats: [
      {
        text: "The write path is deliberately tiny. The poster's request reaches the tweet service, which takes a Snowflake id, writes one ~1KB row to a wide-column store partitioned by author_id, acknowledges the poster, and publishes an event. Media never enters that row: it goes to object storage and the row carries references, because 50M media tweets a day at ~500KB is 25TB against a 1KB row.",
        lights: ["poster", "tweet-service", "tweet-store", "event-stream", "e1", "e2", "e4"],
      },
      {
        text: "Ids are load-bearing rather than incidental. 41 bits of millisecond timestamp, 10 of machine, 12 of sequence means sorting by id sorts by time, so the timeline stores no separate timestamp, an entry is 8 bytes, and merging two delivery routes is a merge of two sorted integer lists rather than a sort.",
        lights: ["timeline-caches", "timeline-service"],
      },
      {
        text: "Distribution is where this question parts company with a generic feed's push-versus-pull derivation. The cut is drawn per edge, at ~1M active followers, and only into readers who opened the app in the last 7 days, because the binding constraint is the per-tweet burst budget of 200k appends per second against a 5s freshness SLO.",
        lights: ["fanout", "follow-graph", "timeline-caches", "e5", "e6", "e7"],
      },
      {
        text: "Then the cascade, which is the part nobody arrives with. Excluding a 100M-follower account from push saves 100M writes; 500k ordinary accounts retweeting that same tweet at ~500 mean followers each generate 250M pushed entries in twenty minutes, 2.5x the volume the celebrity rule existed to avoid. A rate-triggered cutover at ~1,000 retweets per minute turns later retweets into edges in a per-original list that the Timeline service's merge already consults.",
        lights: ["fanout", "timeline-service"],
      },
      {
        text: "The read path has a 300ms p99 and exactly one term in it that scales with the graph: the pipelined fan-in over above-cut followees. Raising the cut from 10k to 1M takes that from ~38 fetches to 2 to 4. Everything else, the merge, the retweet_of dedupe, ranking and hydrating 20 bodies, is bounded by the candidate window and the page.",
        lights: ["timeline-service", "hydrator", "reader", "e11", "e12", "e14", "e17"],
      },
      {
        text: "Search and trending are consumers of the same stream and never sit in the write path, so an indexer falling behind cannot stop anyone tweeting. Search is a second architecture rather than a box: an append-only in-memory index of the last 7 days in descending id order, and a batch-built relevance-ordered archive behind the same query API.",
        lights: ["search", "trending", "e9", "e10"],
      },
    ],
    crux:
      "The celebrity is a solved problem and costs one line of policy. The content you kept off the push path comes back onto it wearing a different hat: a retweet cascade routes the same tweet id through fan-out at 2.5x the volume you avoided and in a fraction of the time, from accounts three orders of magnitude below the cut.",
    numbers: [
      "200M tweets/day, ~2.3k/s steady and ~50k/s at a global event",
      "push cut at ~1M active followers, from 200k appends/s x 5s SLO",
      "500k retweets x ~500 followers = 250M entries at ~200k/s",
      "hot search window: 1.4B docs x 15 postings x 4B = ~84GB",
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
        numbers: ["searchable within 10s", "trend list refreshed once a minute"],
        breaks:
          "Both are rebuildable caches with different staleness, so every correctness question about them is a reconciliation problem rather than a transaction.",
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
        numbers: ["2.3k posts/s steady, ~50k/s peak", "ack after 1 durable write, not after fan-out"],
        breaks:
          "A client that retries a slow ack without an idempotency key can double-post, which is why the key travels with the request rather than being assigned server-side after the fact.",
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
        why: "This is the client the entire read path is sized for: a 300ms p99 and a fixed-size response regardless of how many accounts the reader follows or how large a cascade is running underneath.",
        numbers: ["20 cards per page", "~58k timeline loads/s steady, ~120k/s peak"],
        breaks:
          "A stale block on this client shows a timeline that has not moved in minutes, which is why a missing block triggers a cold rebuild rather than serving silently empty.",
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
        numbers: ["~1KB row", "2.3k tweets/s steady, ~50k/s peak", "5s freshness SLO for active followers"],
        breaks:
          "Publishing the event before the row is durable inverts the ordering: a consumer can index or fan out a tweet that a crash then loses, and nothing downstream can tell.",
        choice: {
          pick: "Acknowledge after the tweet row is durable, publish the event afterwards",
          instead: "Acknowledge only once fan-out has completed, so a tweet is visible everywhere the moment it returns.",
          decider:
            "Fan-out for an ordinary author is ~500 timeline appends and for a mid-tier account tens of thousands, so a synchronous ack couples a sub-100ms write to a job whose length varies by four orders of magnitude with the author's follower count. The freshness SLO of 5s exists precisely so that work can be asynchronous.",
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
        why: "The tweet store is partitioned by author and answers one question, what did this author post. Every other question in the product is a different index over the same events, so those indexes are consumers of one stream rather than features of one database, and none of them can block posting.",
        numbers: ["~2.3k events/s steady, ~50k/s at a global event", "three independent consumer groups"],
        breaks:
          "Consumer lag is silent from the write side. Posting still looks perfectly healthy while timelines, search and trends drift minutes behind reality.",
        choice: {
          pick: "One Kafka stream with independent consumer groups per derived system",
          instead: "The tweet service calling fan-out, the indexer and trending directly.",
          decider:
            "Blast radius against a 99.99% read availability target with three consumers at very different reliability. Direct calls put a search cluster's health inside the p99 of posting and give no replay when a consumer is rebuilt; a log lets each of the three fall behind, be reset and be re-run without the write path noticing.",
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
        what: "The only authoritative record: one ~1KB row per tweet, partitioned by author_id, holding text, parent_id, retweet_of and 32 bytes of media references. The bytes themselves live in object storage behind a CDN, uploaded before the post request and only referenced here, because 50M media tweets a day at ~500KB post-transcode is ~25TB against a ~1KB row: inlining media would multiply this store roughly 125x and put bytes nobody has requested yet on the write path.",
        why: "Partitioning by author makes writes cheap and makes the profile timeline a single partition scan. It cannot answer everything I follow, newest first, at all, and that is deliberate: the distribution layer exists precisely because this store refuses that query.",
        numbers: [
          "200M rows/day, ~200GB/day raw",
          "~600GB/day at RF=3",
          "~1.1PB replicated over 5 years",
          "~25TB/day of media held off the row, hot for 30 days",
        ],
        breaks:
          "A prolific author is one partition, so a single account posting at machine rate concentrates writes and profile reads on one replica set.",
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
        what: "Consumes tweet events, appends the id to the author's own recent list, and for below-cut authors pushes it into the timelines of followers who were active in the last 7 days. Also records every retweet against its original in a per-original retweeter list and bumps a rate counter on it: above ~1,000 retweets/minute, later retweets of that original become edges in this list instead of individual timeline pushes.",
        why: "Push versus pull is a general derivation and the specific test here is narrower: it is active follower count against the cut, and then reader activity per edge inside the loop, because a typical follow set is thick with mid-tier accounts sitting just above any flat threshold. The retweet cutover exists because excluding a 100M-follower account from push saves 100M writes, but 500k ordinary accounts retweeting that tweet at ~500 mean followers each would generate 250M pushed entries in twenty minutes, 2.5x the volume the celebrity rule avoided; the rate trigger bounds that by when it fires rather than by how viral the tweet gets, and the read-side merge already knows how to consult the resulting edge list.",
        numbers: [
          "cut at ~1M active followers",
          "~200k appends/s dedicated to one tweet",
          "pool sized ~5M appends/s against 1.2M/s steady",
          "cutover above 1,000 retweets/minute",
          "500k retweets x ~500 followers = 250M entries avoided",
        ],
        breaks:
          "Aggregate burst, not any single tweet. A 20x tweet-rate spike wants ~24M appends/s against a ~5M/s pool, and the queue simply grows; the shed is to tighten the activity window from 7 days to an hour, which is roughly 9x fewer readers and pushes that cohort onto the cold rebuild path. The retweet trigger is only as good as its lag: firing 90 seconds late has already let roughly 150k retweets through, which is most of the peak, so that measurement path has to run in seconds, not minutes.",
        choice: {
          pick: "Cut on active followers at ~1M and push only into readers active in the last 7 days",
          instead: "The standard hybrid: a flat cut at ~10k total followers, applied to every follower regardless of whether they read.",
          decider:
            "The per-tweet burst budget, not aggregate cost. The pool can give one tweet ~200k appends/s and the freshness SLO is 5s, so 200k x 5 = 1M entries is the most one tweet may push, which lands the cut at 1M. The read-side consequence is what makes it visible: at 1M a 150-account follow set holds 2 to 4 fetch-path authors, at 10k it holds ~38.",
          flips:
            "When the fleet cannot sustain a 200k/s burst for one tweet, or timelines live in a store with millisecond writes, or the SLO is far tighter than 5s. The cut genuinely drops into the tens of thousands then, and read fan-in has to be attacked instead with a 60s TTL on the merged candidate set.",
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
        why: "The graph is read in opposite directions by the two paths: fan-out needs the followers of an author, the read path needs which of a reader's followees sit on the fetch path. Neither can be derived from the other cheaply at 75B edges, so both are materialised and the asymmetry is paid for in write amplification rather than read latency.",
        numbers: ["~500M accounts x ~150 follows = ~75B edges", "median 20 followers, p99 ~5,000, top thousand above 100M", "fetch-path set typically 2 to 4 entries"],
        breaks:
          "Mass follow. An account gaining 10M followers in an hour puts 10M appends against one inverse-index key, and the same 10M users need their fetch-path sets rewritten again the moment that account crosses the cut.",
        choice: {
          pick: "Both edge directions materialised, plus a maintained per-user fetch-path set",
          instead: "Computing the fetch-path authors per request by walking the user's follows and reading each author's follower count.",
          decider:
            "Read-path cost inside a 300ms p99. Recomputing means 150 edge reads plus 150 counter lookups on every timeline load at ~58k loads/s; the maintained set is one small read that returns 2 to 4 ids. The write cost is bounded because it changes only on a follow or on an author crossing the cut.",
          flips:
            "Small follow sets and a low read rate, where walking the graph per request is a few milliseconds and the denormalised set is state that can go stale for no benefit.",
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
        why: "Storing ids rather than bodies is what makes deletion, editing and visibility changes cheap: they resolve at hydration instead of requiring millions of cached lists to be rewritten. It also makes an entry 8 bytes rather than ~1KB, which is the difference between a cache that fits and one that does not.",
        numbers: ["800 ids x 8B = 6.4KB payload/user", "~2.8TB packed vs ~25TB as sorted sets", "350M weekly active users held"],
        breaks:
          "Losing a large shard produces a rebuild storm, because every affected user falls onto the 150-fetch cold path at once. Rebuild lazily from author recent lists rather than backfilling globally.",
        choice: {
          pick: "Packed blocks of 8-byte ids with a small header",
          instead: "Redis sorted sets keyed by user with the tweet id as score.",
          decider:
            "Memory on the largest cache in the system. Above 128 members a sorted set switches to skiplist plus dict at roughly 90B per member, so 800 members is ~72KB per user and 350M users is ~25TB; packed blocks are ~8KB per user and ~2.8TB, a 9x difference. The access pattern is append plus a recent range read, and neither Redis primitive fits it.",
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
        what: "The read path: prebuilt block, resolve fetch-path followees, one pipelined multi-get of their recent lists, merge by id, collapse retweet_of duplicates, filter and rank. During a cascade the merge also draws on a per-original retweeter list held in the fan-out tier, once that original has crossed the ~1,000 retweets/minute cutover and stopped fanning out individually.",
        why: "Only one step scales with the graph, the fan-in over above-cut followees, and everything else is bounded by the candidate window and the page. That is why the push cut is chosen to control read fan-in rather than write volume: at a 10k cut the varying term is ~38 fetches, at 1M it is 2 to 4. The cascade source is where the cutover's cost actually lands: it moves fan-out for a viral retweet off the write path and onto every reader's merge instead, and it is also where attribution comes from, surfacing the original once with the earliest in-network retweeter named.",
        numbers: [
          "300ms p99 budget",
          "~58k timeline loads/s steady, ~120k/s peak",
          "3 keys pipelined is ~1ms; 38 keys done naively is ~20ms",
          "1 extra merge source while a cascade is tripped, collapsing to 1 entry per original",
        ],
        breaks:
          "A cold mailbox has nothing at step 1 and every followee becomes a fetch-path author: 150 recent-list reads instead of 3, tens of milliseconds pipelined and seconds if looped, arriving correlated when lapsed users return during a global event. Without dedupe on retweet_of, one cascading original arrives from dozens of followees and takes most of a reader's 20 visible slots, which is immediately visible to a user during exactly the moment they are paying attention.",
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
        what: "Turns the top 20 ranked ids into rendered tweets: bodies from the tweet cache, tombstone checks, blocks and mutes, engagement counts summed across counter shards, and media ids resolved into CDN URLs the client fetches directly.",
        why: "This is the only step that touches the tweet store, and it is where late binding pays off. A deleted tweet vanishes from every timeline at once because hydration finds a tombstone, without rewriting any of the 250M cached entries that point at it. Media resolution happens here for the same reason bodies do: the row carries only a reference, media bytes never pass through this tier, so a card with a viral video costs the CDN and not the timeline path, and stays a fixed-size JSON response regardless of attachment size.",
        numbers: [
          "~1.2M hydrations/s before caching",
          "99% cache hit leaves ~12k store reads/s",
          "~1B engagement increments/day, ~12k/s",
          "media hot in the CDN for 30 days",
        ],
        breaks:
          "A hot tweet concentrates load on exactly one cache key, so that key needs client-side replication across cache nodes rather than the usual single-owner hashing, and its counters need tens of thousands of increments per second spread across shards. A deleted tweet's media can also outlive the tombstone at the CDN edge, so removal has to invalidate the CDN as well as the row.",
        choice: {
          pick: "Hydrate ids late from a cache fronting the tweet store, with counters sharded per tweet",
          instead: "Materialising bodies and counts into the timeline at fan-out time.",
          decider:
            "8 bytes against ~1KB per entry, and the delete story. Materialised bodies would make the timeline cache ~125x larger and turn one deletion into millions of cached-list rewrites. Sharded counters are forced separately: no single row survives tens of thousands of increments per second, and an approximate like count for a few hundred milliseconds is invisible.",
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
        numbers: ["1.4B docs in the 7-day window", "1.4B x 15 postings x 4B = ~84GB, under 1GB per shard across 100", "archive ~3KB/doc, ~600GB/day, ~220TB/year"],
        breaks:
          "Ingestion lag puts the freshest tweets exactly where they are most wanted and least present. Shed tokenisation of low-value fields, link previews and alt text, before shedding documents.",
        choice: {
          pick: "Two indexes: append-only time-ordered hot window, batch-built relevance-ordered archive",
          instead: "One general-purpose search cluster with time-partitioned indexes and a 1-second refresh interval.",
          decider:
            "Segment-merge write amplification at 200M docs/day. That is ~600GB/day of new index, and a tiered merge policy rewrites each document 8 to 10 times, so ~5 to 6TB/day of rewrite concentrated exactly when ingest spikes. The append-only hot index does zero merges by construction and its whole 7-day window is ~84GB of postings, so it is RAM-resident.",
          flips:
            "Peak ingest under a few thousand docs/s, or a 10 to 30 second freshness target, where one cluster is far less to build and the merge amplification is affordable. Also when queries are relevance-ranked rather than recency-ranked, since early termination only pays on a time-ordered index.",
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
        why: "It is named here so it is not mistaken for a storage problem or a new pipeline: it is a ranking problem over an existing stream, sharing nothing with fan-out or search but the event log it reads from.",
        numbers: ["~200 geo partitions", "under 10MB of state per partition", "refreshed once a minute"],
        breaks:
          "Bot spam poisons hashtag counts, and counting alone cannot tell a botnet from a moment. Score by entity diversity, unique posters and networks and account age, and suppress low-diversity bursts.",
        choice: {
          pick: "Bounded sketch plus heap per geo partition, consuming the shared event stream",
          instead: "Exact counts per term in a datastore, queried on a schedule.",
          decider:
            "State size against a stream at ~2.3k tweets/s carrying tens of thousands of distinct terms. Sketch and heap is a few MB per partition across ~200 partitions; exact counting is unbounded cardinality and a growing table for an answer that only needs the top few dozen.",
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
      label: "durable row, then ack",
      detail: {
        what: "The one write in this design that must not be lost: the ~1KB tweet row, partitioned by author_id.",
        why: "This is the only strongly consistent step. Everything after it is a derived cache with its own staleness, so the correctness of the whole product rests on this single write and the fact that the acknowledgement follows it.",
        numbers: ["~1KB per row", "200M rows/day", "~600GB/day at RF=3"],
        breaks:
          "Acknowledging before the quorum returns means a poster is told their tweet exists when it may not, which is the one failure this design refuses to tolerate.",
      },
    },
    {
      id: "e4",
      from: "tweet-service",
      to: "event-stream",
      tier: "hot",
      label: "publish after ack",
      detail: {
        what: "The tweet event, published only once the row is durable and the poster has been acknowledged.",
        why: "This ordering is the whole shape of the design. Publishing after the ack means distribution, indexing and trending are all downstream of a fact rather than a prediction, so any of them can fail, be retried, or be rebuilt from the log without consulting the write path.",
        numbers: ["one event per tweet", "~50k/s at a global event"],
        breaks:
          "If the publish fails after the ack, the tweet exists but reaches nobody. That gap needs an outbox or a reconciliation sweep against the store, not a retry loop in the request.",
      },
    },
    {
      id: "e5",
      from: "event-stream",
      to: "fanout",
      tier: "hot",
      label: "tweet event",
      detail: {
        what: "Tweet events consumed by the distribution tier.",
        why: "Fan-out is a consumer like any other, which is what lets it lag under load without touching posting. Under a correlated spike the mitigation is to tighten the activity window and shed readers, never to drop tweets.",
        numbers: ["1.2M timeline appends/s steady", "pool sized ~5M/s", "a 20x spike wants ~24M/s"],
        breaks:
          "Queue depth grows silently during a global event, so publish-to-visible lag is the alert that matters rather than error rate, which stays at zero throughout.",
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
        numbers: ["~75B edges total", "~350M weekly active of ~500M accounts", "~30% of edges removed"],
        breaks:
          "A stale active set pushes into cold mailboxes and skips warm ones, so the read path sees cold rebuilds it did not expect.",
      },
    },
    {
      id: "e7",
      from: "fanout",
      to: "timeline-caches",
      tier: "hot",
      label: "append 8-byte id",
      detail: {
        what: "The push itself: appending the tweet id to each surviving follower's timeline block, plus one unconditional append to the author's own recent list.",
        why: "The author append happens for every tweet regardless of the cut, because it is the fetch path's only source. Above the cut it is the entire distribution: one write, one cache key, shared by 100M followers.",
        numbers: ["8 bytes per entry", "~200k appends/s budget per tweet", "cap 800 per timeline, 200 per author"],
        breaks:
          "The cap is also the garbage collector. Without it, unfollows, deletes and bad deploys leave entries that nothing ever goes back to clean up.",
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
        numbers: ["~15 indexable terms per tweet", "10s freshness target", "100 shards, under 1GB of postings each"],
        breaks:
          "Deleted tweets stay in sealed segments behind a query-time tombstone filter until they age out of the 7-day window, which is why visibility and erasure have different SLAs.",
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
        numbers: ["~200 partitions", "refreshed once a minute"],
        breaks:
          "The stream carries spam as faithfully as it carries news, so suppression has to happen inside this consumer, not upstream.",
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
        numbers: ["2 to 4 entries typical at a 1M cut", "~38 at a 10k cut", "several hundred for a 30,000-follow account"],
        breaks:
          "An account crossing the cut invalidates this set for every one of its followers at once, so treat crossings as a batch job with a recently-crossed side list rather than as an event.",
      },
    },
    {
      id: "e12",
      from: "timeline-service",
      to: "timeline-caches",
      tier: "hot",
      label: "prebuilt block + fan-in",
      detail: {
        what: "One read of the reader's packed timeline block, then one pipelined multi-get of the recent lists for their fetch-path authors.",
        why: "The fan-in must be a single pipelined round trip, never N sequential ones. Throughput is not the failure mode; the failure mode is read latency becoming a function of how many famous accounts a user happened to follow, which is not a property you want inside a p99.",
        numbers: ["~800 ids in the block, sub-millisecond", "3 keys pipelined ~1ms", "38 keys over 20 shards naively ~20ms"],
        breaks:
          "A missing block means a cold user, and the rebuild treats all ~150 followees as fetch-path authors through this same edge.",
      },
    },
    {
      id: "e14",
      from: "timeline-service",
      to: "hydrator",
      tier: "hot",
      label: "top 20 ids after ranking",
      detail: {
        what: "The ranked ids handed on for hydration, after merge, dedupe, blocks, mutes and scoring.",
        why: "Ranking runs here rather than at write time because the strongest signals, engagement in the last hour, do not exist when the tweet is distributed. Caching the unranked candidate set instead of the ranked result means a model change invalidates nothing.",
        numbers: ["a few hundred candidates", "20 hydrated per page"],
        breaks:
          "Pagination. A positional cursor over a continuously rewritten ranked list duplicates and skips items, so page 3 needs a pinned per-session snapshot.",
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
        numbers: ["~1.2M hydrations/s before caching", "99% hit rate leaves ~12k store reads/s"],
        breaks:
          "A cache hit rate drop of a few points multiplies store reads by an order of magnitude, so the tweet cache is load-bearing rather than an optimisation.",
      },
    },
    {
      id: "e1",
      from: "poster",
      to: "tweet-service",
      tier: "hot",
      label: "POST tweet",
      detail: {
        what: "The post request itself: text, optional media ids already uploaded, and the client's idempotency key.",
        why: "Everything the write path is optimised for starts here: the poster must not wait on distribution, so this hop and the durable write behind it are the only latency the author actually feels.",
        numbers: ["2.3k tweets/s steady, ~50k/s peak", "~1KB request body"],
        breaks:
          "A retried post without an idempotency key creates a second tweet rather than returning the first, which is indistinguishable from a double-post bug once it reaches the timeline.",
      },
    },
    {
      id: "e17",
      from: "hydrator",
      to: "reader",
      tier: "hot",
      label: "20 rendered cards",
      detail: {
        what: "The finished response: 20 hydrated tweets with bodies, media CDN URLs and counts, returned for one page of the reader's timeline.",
        why: "This is the arrow the whole read path exists to serve. Everything upstream, the cut, the merge, the rank, is spent so this response is a fixed-size JSON payload regardless of how many people the reader follows or how viral the tweets in it are.",
        numbers: ["20 cards per page", "300ms p99 budget end to end"],
        breaks:
          "A page that mixes cached and freshly-hydrated cards inconsistently reads as a broken feed, which is why hydration always runs over the whole page rather than only over cache misses.",
      },
    },
  ],
};
