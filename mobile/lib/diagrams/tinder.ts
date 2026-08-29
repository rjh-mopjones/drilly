import type { Diagram } from "./types";

export const TINDER: Diagram = {
  id: "tinder",
  title: "Tinder",
  question: "Design Tinder (Dating / Match)",
  sourceId: "patterns",
  itemId: 38,
  overview: {
    shape:
      "Two paths with opposite cost profiles: a narrowing funnel that spends 300ms picking twenty candidates, and a swipe write that costs one row and one lookup but must be exact.",
    forces: [
      {
        constraint: "A user 80% through their local market needs 100 ranked results for 20 fresh; at 95% they need 400",
        decision: "The Exclusion filter runs before the Two-tower ranker, never after, so ranking cost never depends on depletion",
        lights: ["bloom", "ranker", "e3"],
      },
      {
        constraint: "1,500 candidates x 2,800 pages/s scored jointly would be 4.2M model invocations/s, not buildable",
        decision: "The Two-tower ranker splits scoring into cached Candidate embeddings plus one live user pass and a dot product",
        lights: ["ranker", "embeddings", "e5"],
      },
      {
        constraint: "A swipe is the only irreversible write the system makes, at 20k/s steady",
        decision: "The Swipe Service records the swipe then reads the Reverse index once for reciprocity, in one synchronous request",
        lights: ["swipe-svc", "swipes", "reverse", "e9", "e10"],
      },
      {
        constraint: "Two people can right-swipe each other within milliseconds of each other",
        decision: "Match Service keys the match row on the canonical ordered pair, so the database's own uniqueness constraint settles the race",
        lights: ["match-svc", "matches", "e14"],
      },
      {
        constraint: "The top decile of profiles can absorb over half of all right-swipes, monopolising feeds and hotspotting the Reverse index",
        decision: "Exposure + diversify applies a decaying multiplier once a profile passes roughly 10x its local mean impressions",
        lights: ["exposure", "e6", "e7"],
      },
    ],
    naive: {
      text: "Run the two-tower ranker over the whole geo-and-preference-filtered pool, about 10,000 candidates within 10km, then filter out already-swiped profiles from the ranked list afterward. Filtering after ranking means over-fetching by the reciprocal of the unswiped fraction, and that fraction decays every day a user keeps swiping. Someone 80% through their local market needs 100 ranked results to yield 20 fresh ones; at 95% they need 400. At 2,800 feed pages/s, ranking 10,000 candidates each is 28M dot-product passes a second. That is against the ~4.2M the Two-tower ranker was already built to avoid by not becoming a joint network. The Exclusion filter replaces this by running before ranking. It drops swiped candidates first, so the ranker only ever sees ~1,500 candidates, regardless of how depleted the user's market has become.",
      lights: ["bloom", "ranker"],
    },
    beats: [
      {
        text: "Start from the property, not the components. The candidate pool is inventory rather than a corpus: a swipe spends a candidate permanently, the pool is bounded by a radius, and nothing happens until both sides agree. Everything distinctive falls out of those three facts.",
        lights: ["funnel-group", "swipe-svc"],
      },
      {
        text: "The read path is a narrowing funnel and its order is the design. The Geo + attribute index returns roughly 10,000 people within 10km. The preference filter on age, gender and activity recency trims to ~3,000, the Exclusion filter subtracts everyone already swiped and leaves ~1,500, and only then does the Two-tower ranker run.",
        lights: ["geo", "bloom", "ranker", "e2", "e3", "e4"],
      },
      {
        text: "Exclusion has to come before ranking and never after. Filtering afterwards means over-fetching by the reciprocal of the unswiped fraction, and that fraction decays per user. Someone 80% through their market needs 100 ranked results to yield 20 fresh ones, and at 95% they need 400.",
        lights: ["bloom", "e3"],
      },
      {
        text: "The write path is one row and one lookup. Record the swipe partitioned by the swiper at 20k/s steady, then read the reverse index keyed by target to ask whether that person already swiped right on you. If not, write nothing the target can ever observe: the privacy rule and the match rule are the same rule.",
        lights: ["swipe-svc", "swipes", "reverse", "e9", "e10"],
      },
      {
        text: "Match creation is where exactness lives. Key the row on the canonical ordered pair so two simultaneous swipes converge on a single insert, notify both sides once, then hand off to a separate chat service asynchronously. A binding failure then shows up as a delay rather than as a lost match.",
        lights: ["match-svc", "matches", "client", "e13", "e14", "e15"],
      },
      {
        text: "Exposure is a product constraint rather than an optimisation. A profile everyone wants sits in millions of feeds and hands its owner an inbox they cannot meaningfully answer. The Exposure + diversify stage applies a decaying multiplier once a profile passes roughly ten times its local mean impressions.",
        lights: ["exposure", "e6", "e7"],
      },
    ],
    crux: {
      problem:
        "A profile everyone wants is a write hotspot on the reverse index and a feed monopoly at the same time. Both come from one fact: the scarce resource is attention on the other side of the market, not compute.",
      handled:
        "Capping it costs relevance in exactly the thin markets that need help most. Exposure + diversify applies a decaying multiplier rather than deleting over-exposed profiles outright, which would empty a pool of only 1,500. The Reverse index sub-shards a hot target up to 16 ways by hash of the swiper id once it trips a threshold. This contains the write hotspot without touching the swiper-partitioned primary copy at all.",
    },
    numbers: [
      {
        value: "1.6B swipes/day: 20k/s steady, 60k/s peak",
        explain: "The write path's baseline and peak load, three orders of magnitude above the feed request rate that produces it.",
      },
      {
        value: "funnel 10k to 3k to 1.5k to 20, p99 under 300ms",
        explain: "The narrowing ratio across all four funnel stages, and the latency budget the whole ladder has to fit inside.",
      },
      {
        value: "~750M right-swipes/day, 4% mutual, ~30M matches/day",
        explain: "Right-swipes filtered by the reciprocity rate; only 1 in 25 right-swipes becomes a match, which is why the match path can afford to be exact even under high swipe volume.",
      },
    ],
  },
  nodes: [
    {
      id: "funnel-group",
      label: "Feed funnel",
      kind: "zone",
      detail: {
        what: "The whole read path: geo and preference narrowing, exclusion, ranking, then exposure control and the cut to twenty.",
        why: "This is one zone because the stages are not independent services, they are a cardinality ladder inside a single request budget. Each stage buys a reduction with the cheapest predicate available at that point, so the one expensive stage runs over hundreds rather than millions.",
        numbers: [
          { value: "10k to 3k to 1.5k to 20", explain: "The candidate count surviving each stage of the funnel, in order." },
          { value: "300ms p99 for the whole ladder", explain: "The total latency budget every stage in this zone shares, from geo lookup to the final twenty cards." },
        ],
        breaks: {
          failure: "Reorder the ladder and it still returns plausible results.",
          handled: "This is precisely why funnel-ordering bugs survive every correctness test anyone writes for the swipe path, so ordering is documented and reviewed as a design invariant, not just implemented once.",
        },
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "20 cards per page, last coords",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The phone holding a page of twenty cards, emitting one swipe per card and carrying the user's last known coordinates on every feed request.",
        why: "Drawn explicitly because it sets two constraints the rest of the design answers to. Location changes while the user is holding the phone, which kills a precomputed deck. One feed request also buys twenty swipe decisions, which is why the read rate sits three orders of magnitude below the write rate.",
        numbers: [
          { value: "20 cards per page, 32 swipes/user/day", explain: "The page size and typical daily activity, together setting how often a client needs to refetch." },
          { value: "~350k concurrent sessions, ~1M at peak", explain: "The active client population the feed tier is sized against." },
          { value: "~925 feed requests/s against 20k swipes/s", explain: "The ratio between read and write rate, roughly 1:20, driven directly by the 20-card page size." },
        ],
        breaks: {
          failure: "A swipe retried after a reconnect must not create a second row.",
          handled: "The client sends an idempotent key of (swiper_id, target_id), so a replay is a no-op rather than a duplicate write.",
        },
      },
    },
    {
      id: "feed",
      label: "Feed Service",
      sub: "geo, prefs, exclusion, per request",
      kind: "service",
      col: 1,
      row: 0,
      parent: "funnel-group",
      detail: {
        what: "Runs the first three funnel stages on every request: geo radius, preference predicate, exclusion, then hands the survivors to the ranker.",
        why: "Nothing here caches, because the exclusion set, the preference predicate and the ranker are all per user. The cache key would be the user, and the hit rate within a session is near zero. A stale entry is also actively wrong: it contains people this user just swiped.",
        numbers: [
          { value: "~925 req/s average, ~2.8k/s peak", explain: "The call rate this tier absorbs, driven by session count and page size." },
          { value: "geo 10 to 30ms, exclusion 10 to 30ms", explain: "The latency each of the two cheap early stages spends out of the 300ms total budget." },
          { value: "300ms p99 for the whole request", explain: "The end-to-end latency target this service and everything it calls must fit inside." },
        ],
        breaks: {
          failure: "Stage 3 selectivity decays monotonically for a user who stays in one place, so a healthy funnel on day one returns a thin page by month two.",
          handled: "Nothing in the swipe path notices this on its own, so candidates surviving exclusion are tracked directly and widening starts at ~200 survivors, not at zero.",
        },
        choice: {
          pick: "Build the candidate list online, every request, storing nothing between sessions except the swipe log",
          instead: "A nightly batch job that ranks a few hundred candidates per user into a stored deck the app pages through.",
          decider:
            "How fast the defining predicate goes stale, and here it is location. Batch is genuinely cheaper on compute, 75B scorings a night against 120B online, a ~40% saving. But roughly a third of dating sessions start more than 10km from the previous session's origin. A deck whose entire premise is a stale origin is not repairable, only rebuildable.",
          flips:
            "When matching is not geo-anchored. Interest or questionnaire products such as Hinge's Most Compatible have a stable predicate, so a daily deck is a design artifact and an expensive cross-encoder becomes free quality.",
        },
      },
    },
    {
      id: "ranker",
      label: "Two-tower ranker",
      sub: "128-d dot product, ~1.5k scored",
      kind: "service",
      col: 2,
      row: 0,
      parent: "funnel-group",
      detail: {
        what: "Scores the ~1,500 survivors with one user-tower pass plus a dot product against each candidate's precomputed 128-dimensional embedding.",
        why: "Ranking is the expensive stage and must never see the whole population, which is the entire reason the three cheap stages run first. Labels are behavioural rather than declared: the retrieval tower learns from conversations, five or more exchanged messages. The fast ranker retrains on swipe labels because those are plentiful and immediate.",
        numbers: [
          { value: "1,500 inner products over 128 dims = 192k MACs", explain: "The total arithmetic one ranking pass costs, entirely linear algebra rather than a model forward pass per candidate." },
          { value: "100 to 150ms, half the 300ms budget", explain: "The latency this stage spends scoring 1,500 candidates, the single largest share of the whole funnel's latency." },
          { value: "a joint model would be 4.2M invocations/s", explain: "1,500 candidates × 2,800 pages/s = 4.2M model calls/s — no inference fleet serves that, which is exactly why scoring splits into two towers instead of one joint pass." },
        ],
        breaks: {
          failure: "Model server failure loses personalisation entirely.",
          handled: "It circuit-breaks to a cached per-geo ordering by recency and popularity. A worse feed beats no feed, and this is the only tier where that trade is acceptable.",
        },
        choice: {
          pick: "Two-tower factorisation, candidate embeddings computed offline",
          instead: "A joint network scoring f(user, candidate) once per pair, or an ELO-style desirability scalar per profile.",
          decider:
            "1,500 candidates times 2,800 pages/s is 4.2M model invocations per second, which is not a system anyone builds. Two towers reduce the request path to one user pass plus 1,500 dot products, taking microseconds. ELO is cheaper still and fails differently: collapsing to one global ordinal makes exposure a monotone function of a single number, which is why Tinder deprecated it in 2019.",
          flips:
            "When the candidate set is already tiny. Reranking the top 50 with a joint cross-encoder is 140k invocations per second, merely expensive rather than impossible, and it buys back the expressivity the factorisation gave away.",
        },
      },
    },
    {
      id: "exposure",
      label: "Exposure + diversify",
      sub: "decaying multiplier, then top 20",
      kind: "service",
      col: 3,
      row: 0,
      parent: "funnel-group",
      detail: {
        what: "Applies the per-profile daily impression budget and a diversity penalty to the scored list, then cuts the top twenty.",
        why: "It attaches after scoring rather than at retrieval, and that placement is the whole argument. Removing budget-exhausted profiles from the candidate set is tempting and wrong in exactly the markets that need fairness most. In a pool of 1,500, deleting the top 150 empties the feed, whereas a decaying multiplier degrades smoothly.",
        numbers: [
          { value: "mean profile is shown 32 times/day", explain: "The typical daily impression count a profile receives, the baseline this stage's threshold is set against." },
          { value: "redistribution starts near 320/day, 10x local mean", explain: "The impression count at which the decaying multiplier begins to bite for a given profile." },
          { value: "50k/day hard cap is 1,500x the mean", explain: "The absolute ceiling on daily impressions, reserved for the most extreme outlier profiles." },
        ],
        breaks: {
          failure: "Boost sells the exposure this budget removes, and popular profiles are both the best customers and the ones the budget exists to restrain.",
          handled: "Boost is made to reallocate the remaining budget rather than add to it, a design defensible on its own terms even though it is weaker than the marketing promises.",
        },
        choice: {
          pick: "Constrain supply: a decaying ranker multiplier once a profile passes roughly 10x its local mean",
          instead: "Constrain nothing on supply and guarantee demand instead: reserve 5 slots of every 20 for candidates below an exposure threshold.",
          decider:
            "Which side is actually scarce, measured as the share of right-swipes absorbed by the top decile of profiles. Above roughly 50% the supply side is binding and throttling is the only thing that moves the number; below it, throttling degrades relevance for no fairness gain.",
          flips:
            "Thin markets, which is precisely where supply-side caps do most damage. With 1,500 filtered candidates, throttling the top 150 removes the reason people opened the app, while reserved slots only displace a marginal candidate.",
        },
      },
    },
    {
      id: "geo",
      label: "Geo + attribute index",
      sub: "Redis Cluster, sharded by country",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "Each user's coordinate in a radius-queryable index, alongside the age, gender and last-active attributes the preference filter reads.",
        why: "Geo here is stage one of four rather than the system, so it gets a small slice of the budget and has to answer from memory. Sharding by country means a query for 10km around a London coordinate never touches a US shard, which is what keeps the fan-out constant as the user base grows.",
        numbers: [
          { value: "GEORADIUS 10km returns ~10k ids", explain: "The typical output size of the first funnel stage, before any preference filtering." },
          { value: "10 to 30ms of a 300ms budget", explain: "The latency cost this stage spends, small relative to the ranker's share." },
          { value: "widen by doubling to a 500km cap", explain: "The fallback strategy when a sparse region returns too few candidates, doubling radius up to this maximum." },
        ],
        breaks: {
          failure: "Geo skew: a fixed radius floods a dense city and empties a rural county. A shard primary failing is worse, returning an empty region rather than an error.",
          handled: "The client degrades to a popularity-ordered default feed instead of showing nothing, so a shard failure is invisible to the user rather than a blank screen.",
        },
        choice: {
          pick: "Redis Cluster with GEORADIUS, sharded by country",
          instead: "An S2 cell scheme over the profile store, or PostGIS on the transactional database.",
          decider:
            "This stage gets 10 to 30ms of a 300ms budget while returning ~10k ids, so it has to be an in-memory index rather than a disk query. Country sharding bounds the fan-out; a global index would touch every shard for a London query.",
          flips:
            "When the answer is shared across users. In a nearby-restaurants service everyone in one cell gets the same list and a 60 second cache absorbs around 70% of traffic, so a cell scheme plus exact-distance refinement wins.",
        },
      },
    },
    {
      id: "embeddings",
      label: "Candidate embeddings",
      sub: "128 floats/profile, ~50GB",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "One 128-dimensional vector per profile produced by the candidate tower offline, pushed to regional caches and read by every ranking pass.",
        why: "This is the cache that makes the ranker affordable at all. The candidate half of the model changes only when the profile does, while it is read by every feed request that retrieves that profile. Computing it once and reading it thousands of times is the whole economy of the two-tower design.",
        numbers: [
          { value: "128 floats plus metadata ~1KB per profile", explain: "The per-profile storage cost, small enough that the entire catalogue fits comfortably in a regional cache." },
          { value: "50M profiles ~50GB, refreshed nightly", explain: "The total cache size across the full profile catalogue, well within memory budget for regional replicas." },
          { value: "profile-edit re-embed lands within 5 minutes", explain: "Closes the gap the nightly refresh leaves — a same-day bio or photo change reaches the vector in minutes rather than waiting up to 24h." },
        ],
        breaks: {
          failure: "A nightly refresh misses intra-day changes: a new bio, new photos, a jump in activity.",
          handled: "An incremental re-embed on profile-edit events catches these intra-day changes, so the ranker is not confidently scoring people who no longer look like their vector.",
        },
        choice: {
          pick: "Precompute the candidate tower offline and cache the vectors globally",
          instead: "Compute candidate embeddings at request time alongside the user embedding.",
          decider:
            "Read amplification. Each vector is read by every request that retrieves its profile and changes only on edit. Computing per request would multiply 1,500 tower passes into every one of 2.8k requests a second. Precomputed, the request path is 192k multiply-accumulates.",
          flips:
            "When profiles change faster than they are read, or when ranking needs viewer-specific signals that cannot be baked into a candidate-only vector. That is exactly what a cross-encoder rerank exists to supply.",
        },
      },
    },
    {
      id: "bloom",
      label: "Exclusion filter",
      sub: "Bloom 1% FP + exact overlay",
      kind: "database",
      col: 3,
      row: 1,
      detail: {
        what: "One compact bit array per user answering 'have I probably swiped this person', warmed into the feed server at session start, with a small exact overlay in front of it.",
        why: "A candidate can be spent only once, so this is the stage that makes the pool behave like inventory. It is also the only stage whose selectivity gets worse every day the user keeps swiping. Loading it per session makes the check a local memory probe rather than a database round trip inside the request budget.",
        numbers: [
          { value: "9.6 bits/element at 1% false positive", explain: "The per-entry memory cost of the Bloom filter, the standard rate for this false-positive target." },
          { value: "42KB for a three-year user, 600KB at a 500k ceiling", explain: "How the filter's memory footprint scales with a user's cumulative swipe count, still small at even extreme usage." },
          { value: "~80GB hot cache at 1M sessions, against ~530GB exact", explain: "The total memory this structure costs across the peak concurrent session population, versus what an exact set would cost instead." },
        ],
        breaks: {
          failure: "A Bloom filter has no delete short of a counting variant at 4x the space, so paid rewind has no home here.",
          handled: "An exact overlay of the last ~50 swipes sits in front of it, with the swipe row tombstoned. That is the easy half of undo, though once the overlay exists the case for holding the exact set outright gets thin.",
        },
        choice: {
          pick: "Bloom filter per user at 1% false positive, with an exact check against the swipes table at swipe-write",
          instead: "An exact seen-set of swiped ids per user, held as a compressed bitmap in the same cache.",
          decider:
            "The cost of a false positive against 6.7x the memory, and both numbers are small. 1% drops about 15 of 1,500 candidates and no user can observe it. 80GB against 530GB at 1M peak concurrent sessions is affordable either way; the Bloom filter also wins on fixed size at allocation.",
          flips:
            "Thin markets and undo. Dropping 1% of 300 candidates is three real people out of a pool the user exhausts within weeks, and those are the users you can least afford to disappoint.",
        },
      },
    },
    {
      id: "swipe-svc",
      label: "Swipe Service",
      sub: "one row write, one reverse read",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "Records every swipe partitioned by the swiper, then asks the reverse index exactly one question: has this target already swiped right on me?",
        why: "The write path is deliberately trivial because it runs twenty times harder than the read path, at 20k/s steady against 925 feed requests/s. Everything expensive and approximate lives in the funnel; this side is cheap and has to be exact, because it is the only irreversible thing the system does.",
        numbers: [
          { value: "20k/s steady, 60k/s peak", explain: "The write load this service absorbs, three orders of magnitude above the feed request rate." },
          { value: "p99 under 200ms including the reciprocity read", explain: "The latency budget for the whole swipe-and-check operation, tighter than the feed's own 300ms budget." },
          { value: "~750M right-swipes/day, 46% of all swipes", explain: "1.6B swipes/day × 46% ≈ 750M — only these trigger the reciprocity read; left-swipes, the other 54%, never touch the reverse index." },
        ],
        breaks: {
          failure: "Silently dropping the reciprocity check under load is a mutual right-swipe that never becomes a match, violating the only guarantee the product makes.",
          handled: "The check is queued with backpressure instead of dropped, so the user finds out later rather than never, and the queue is monitored as a first-class SLO.",
        },
        choice: {
          pick: "Write the swipe, then resolve reciprocity with one reverse-index read on the same request",
          instead: "Publish the swipe to a stream and resolve reciprocity asynchronously in a consumer.",
          decider:
            "A match has to be visible before the thumb leaves the screen, inside a 200ms p99. Asynchronous resolution adds a hop and a lag to all 26k peak right-swipes a second, in order to save a single-row read. 96% of those will never match anything anyway.",
          flips:
            "Hot targets. Above 1,000 right-swipes a minute on one profile, the check is queued with backpressure precisely because the synchronous path cannot absorb it. This applies the asynchronous design only to the few hundred profiles that need it.",
        },
      },
    },
    {
      id: "swipes",
      label: "Swipes table",
      sub: "Cassandra, partition = swiper_id",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "Every swipe as (swiper_id, target_id, direction, ts), partitioned by the swiper so the write load spreads evenly across the ring.",
        why: "Append-only, write-heavy, no joins and single-key reads is the exact shape a wide-column store is for. Partitioning by the swiper balances by construction because everyone swipes at roughly the same rate, which is the property the target-keyed copy conspicuously lacks.",
        numbers: [
          { value: "80B per row, ~130GB/day raw, ~390GB replicated", explain: "Per-row size and daily volume, tripled for replication across the cluster." },
          { value: "12-month hot retention ~47TB raw", explain: "~130GB/day × 365 ≈ 47TB — the cap is deliberate, since an unbounded log would make the exclusion filter grow forever." },
          { value: "1.6B swipes/day", explain: "The aggregate daily write volume across the whole user base, the baseline this store is sized against." },
        ],
        breaks: {
          failure: "Retention is the quiet decision that determines exclusion-filter growth over time.",
          handled: "The exclusion window is bounded at 12 months, since a profile passed on a year ago is effectively a new candidate. An unbounded log would make the exclusion filter grow forever.",
        },
        choice: {
          pick: "Cassandra, partitioned by swiper_id",
          instead: "PostgreSQL, or the same wide-column store partitioned by target_id as the primary copy.",
          decider:
            "1.6B blind appends a day at 20k/s steady and 60k/s peak, no joins, single-key reads. Partitioning by the swiper spreads perfectly because every user emits about 32 swipes a day; partitioning by the target puts a celebrity's entire inbound stream on one node.",
          flips:
            "Below a few hundred million rows. There Postgres is simpler to operate and gives you real queries over the swipe log for the depletion and exposure analysis this design leans on.",
        },
      },
    },
    {
      id: "reverse",
      label: "Reverse index",
      sub: "by target_id, sub-sharded when hot",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "The same swipe data indexed by target_id, existing for exactly one purpose: answering the reciprocity question in a single row read.",
        why: "Reciprocity must never be a scan, and it must never be answered by asking the target's client anything, because unreciprocated interest has to stay invisible. One index gives you both the match rule and the privacy rule, which are the same rule.",
        numbers: [
          { value: "one row read per right-swipe", explain: "The entire cost of this store's normal operation, before any hot-target sharding kicks in." },
          { value: "sub-shards a hot target up to 16 ways by hash(swiper_id)", explain: "The maximum fan-out applied to a single overloaded target, spreading its inbound reads across shards." },
          { value: "alert above 1,000 right-swipes/min on one target", explain: "The threshold that triggers hot-target handling before the underlying partition saturates." },
        ],
        breaks: {
          failure: "A celebrity taking 50k right-swipes in an hour turns one row into a write hotspot at thousands per second, while the swiper-partitioned primary copy stays perfectly balanced.",
          handled: "Every dashboard built off the primary copy looks fine during this failure, which is why the reverse index has its own hot-key alerting independent of the swipes table's health metrics.",
        },
        choice: {
          pick: "A target-keyed index, sub-sharded only for targets that trip a hot-key threshold",
          instead: "Sub-shard every target uniformly, or drop the index and scan the swipes table for reciprocity.",
          decider:
            "Sub-sharding turns one reciprocity read into N. Applying it to every target multiplies 26k peak right-swipe reads a second by N, for the sake of a few hundred profiles. The threshold is the actual design, and N stays small.",
          flips:
            "If 'who liked you' ships as a visible product surface. That is the same write, but ordered, unbounded and read in bulk, which turns this from a point lookup into a materialised list per target.",
        },
      },
    },
    {
      id: "match-svc",
      label: "Match Service",
      kind: "service",
      col: 0,
      row: 2,
      sub: "idempotent (min, max), then chat",
      detail: {
        what: "On a reciprocal right-swipe, creates one match keyed on the canonical ordered pair (min(a, b), max(a, b)) and notifies both sides exactly once.",
        why: "Two people can right-swipe each other within milliseconds, and naive per-user writes produce two match rows and two divergent inboxes. Canonicalising the key makes both writers target the same row, so the database's own uniqueness constraint does the coordination instead of a lock on the hot path.",
        numbers: [
          { value: "4% of right-swipes are mutual", explain: "The reciprocity rate; only a small fraction of right-swipes trigger match creation at all." },
          { value: "~30M matches/day, against a public figure near 26M", explain: "Total daily match volume across the platform, for scale comparison against a single very popular profile's own right-swipe count." },
        ],
        breaks: {
          failure: "Undo is one-way past this point. If the swipe created a match the other party may already have been notified.",
          handled: "Revoking a match would require a distributed rollback across match state, push delivery and a chat channel. Most products simply refuse to rewind a swipe that matched, a product rule doing the work a distributed transaction would otherwise need to.",
        },
        choice: {
          pick: "INSERT ... ON CONFLICT DO NOTHING on the canonical ordered pair",
          instead: "A distributed lock over both user ids, or a compare-and-set across two per-user rows.",
          decider:
            "The contention is two simultaneous writers, not two thousand. At 30M matches a day a canonical key lets the uniqueness constraint settle the race for free. A lock instead adds a coordination round trip to every one of 26k peak right-swipes a second, to protect a 4% case.",
          flips:
            "If the match row carries state both writers need to merge rather than mere existence. There a no-op second write loses information, and you need a real transaction or a merge function.",
        },
      },
    },
    {
      id: "matches",
      label: "Matches table",
      sub: "keyed on the canonical pair",
      kind: "database",
      col: 3,
      row: 2,
      detail: {
        what: "One row per match: (match_id, user_a, user_b, created_at, state, last_msg_ts), keyed on the ordered pair so it is unique by construction.",
        why: "The match is the canonical entity and the swipes are the audit log, which is what lets a swipe be corrected without the match identity moving. Storing both swipe timestamps in the row answers 'who liked first' for analytics without a join back into 1.6B swipes a day.",
        numbers: [
          { value: "100B per row, 30M/day ~3GB/day", explain: "Per-row size and the resulting daily write volume, tiny compared to the swipes table it references." },
          { value: "~1.1TB/year", explain: "The annual growth of this table, small enough to keep indefinitely without a retention policy." },
          { value: "2 swipe timestamps carried inline", explain: "Both original swipe times are stored directly on the match row, avoiding a join back into the swipes table for common analytics questions." },
        ],
        breaks: {
          failure: "The uniqueness violation on this table is the detection signal for the simultaneous-swipe race.",
          handled: "Suppressing the conflict error would hide the exact bug the constraint exists to catch, so conflict rate is monitored rather than silenced.",
        },
        choice: {
          pick: "A wide-column table keyed on the canonical pair, one row per match",
          instead: "Two rows per match, one per user, written on each side for a contiguous inbox read.",
          decider:
            "Two rows reintroduce the race the canonical key removes. At 30M matches a day the pair of writes can interleave and leave one side holding a match the other cannot see. One row plus a per-user materialisation on top gives the same read pattern without the split-brain.",
          flips:
            "When the inbox read overwhelmingly dominates and its latency is the product. There the per-user copy stops being a projection and becomes the primary, with a reconciliation job accepting the risk.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "feed",
      tier: "hot",
      step: 1,
      label: "GET /feed + coords",
      detail: {
        what: "A feed request carrying the user's last known coordinates, asking for the next twenty cards.",
        why: "Coordinates travel on the request rather than being read from a stored profile, because location is the predicate that changes while the user is holding the phone. That single fact is what rules out a precomputed deck.",
        numbers: [
          { value: "~925 req/s average, ~2.8k/s peak", explain: "The call rate this endpoint absorbs, tracking active session count directly." },
          { value: "one request buys 20 swipe decisions", explain: "Each feed page fuels roughly twenty subsequent swipe writes, which is why write load runs far above read load." },
        ],
        breaks: {
          failure: "A stale or spoofed coordinate quietly poisons stage one.",
          handled: "The funnel has no way to tell a commuter from a location spoofer without behavioural signals from elsewhere, so this remains an accepted gap covered by other abuse-detection layers.",
        },
      },
    },
    {
      id: "e2",
      from: "feed",
      to: "geo",
      tier: "data",
      label: "10km radius, ~10k ids",
      detail: {
        what: "The radius query plus the attribute reads that back the preference filter, returning candidate ids rather than profiles.",
        why: "Ids only, because a feed page is about 5KB of JSON carrying photo URLs and media never touches this path. Pulling 10,000 full profile records to discard 8,500 of them would spend the whole latency budget on serialisation.",
        numbers: [
          { value: "~10k ids in, ~3k after preferences", explain: "The narrowing this single stage achieves before exclusion even runs." },
          { value: "10 to 30ms", explain: "The latency this stage spends, a small slice of the overall 300ms budget." },
        ],
        breaks: {
          failure: "In a sparse region this returns dozens rather than thousands.",
          handled: "The caller widens in sequence: recency first, then age band, then radius doubling to a 500km cap, so a thin market degrades gracefully rather than returning an empty feed.",
        },
      },
    },
    {
      id: "e3",
      from: "feed",
      to: "bloom",
      tier: "data",
      label: "already swiped? ~1.5k left",
      detail: {
        what: "The exclusion probe: seven hash lookups per candidate against the session's warmed bit array.",
        why: "This is the stage that makes the pool inventory rather than a corpus, and it has to run before the ranker. That keeps the model's cost independent of how depleted the user is. Running it after would mean over-fetching by a factor that grows as the user consumes their market.",
        numbers: [
          { value: "~3k in, ~1.5k out", explain: "The narrowing this stage achieves, removing everyone the user has already swiped." },
          { value: "1% false positive drops about 15 candidates", explain: "The expected number of true unswiped candidates lost to the filter's error rate on a typical page." },
        ],
        breaks: {
          failure: "A cold or evicted filter lets already-swiped profiles back into the feed.",
          handled: "Detection is the count of exact-check corrections at swipe-write, and the fix is to warm rather than to block the feed, since transient repeats beat an empty page.",
        },
      },
    },
    {
      id: "e4",
      from: "feed",
      to: "ranker",
      tier: "hot",
      step: 2,
      label: "~1.5k survivors",
      detail: {
        what: "The unswiped, preference-matching candidate set handed to the model.",
        why: "1,500 is the number the three cheap stages exist to produce, because it is what makes a model pass affordable inside the request. Against the unfiltered pool the same ranking would be four orders of magnitude worse.",
        numbers: [
          { value: "1,500 candidates", explain: "The fixed candidate-set size the ranker is provisioned against." },
          { value: "2.8k pages/s peak", explain: "The peak call rate that, multiplied by candidate count, sets the ranker's total scoring load." },
        ],
        breaks: {
          failure: "The cardinality on this arrow is the depletion metric.",
          handled: "When it falls below ~200 for a cohort, that market is exhausting and widening has to start before the feed changes character overnight, so this count is monitored directly.",
        },
      },
    },
    {
      id: "e5",
      from: "ranker",
      to: "embeddings",
      tier: "control",
      label: "128-d vectors",
      detail: {
        what: "Reading the precomputed candidate vectors for the 1,500 survivors so the request path only has to do dot products.",
        why: "The asymmetry is the point: the candidate tower runs once per profile offline, the user tower runs once per request, and everything in between is arithmetic. That is what turns 4.2M model invocations a second into microseconds of linear algebra.",
        numbers: [
          { value: "1,500 vectors of 128 floats", explain: "The data this read pulls per ranking pass, small enough to fetch well inside the latency budget." },
          { value: "192k multiply-accumulates per request", explain: "The total arithmetic cost of scoring all 1,500 candidates against the user vector." },
        ],
        breaks: {
          failure: "If the cache misses, the ranker either blocks on a cold read inside a 150ms slice of budget or scores a stale vector.",
          handled: "The stale-vector failure mode is invisible, which is why cache hit rate is tracked as its own SLO rather than inferred from ranking latency alone.",
        },
      },
    },
    {
      id: "e6",
      from: "ranker",
      to: "exposure",
      tier: "data",
      label: "~1.5k scored",
      detail: {
        what: "The scored candidate list passed to exposure control and diversification before the cut to twenty.",
        why: "The budget attaches here, after scoring and before diversification, rather than at retrieval. Removing over-exposed profiles from the candidate set instead would empty the feed in exactly the thin markets that need fairness most.",
        numbers: [{ value: "1,500 scored, 20 returned", explain: "The final cut this arrow feeds into, the last narrowing step in the whole funnel." }],
        breaks: {
          failure: "Applying the multiplier to a score that is already the output of a ranked cut makes the penalty non-monotone.",
          handled: "A mistuned decay can promote candidates the model ranked far lower, which is why the decay curve is tuned and monitored separately from the ranker's own scoring quality.",
        },
      },
    },
    {
      id: "e7",
      from: "exposure",
      to: "client",
      tier: "hot",
      step: 3,
      label: "top 20, p99 < 300ms",
      detail: {
        what: "Twenty candidate cards as roughly 5KB of JSON carrying photo URLs, a bucketed distance and profile text.",
        why: "URLs rather than media, so the CDN serves the expensive bytes off this path entirely. Distance is a bucketed band rather than a coordinate, because precise coordinates must never leave the server.",
        numbers: [
          { value: "~5KB per page", explain: "The total response size, kept small because it carries only URLs and metadata, never image bytes." },
          { value: "300ms p99 end to end", explain: "The full latency target from request to response, the number every upstream stage's budget was carved out of." },
        ],
        breaks: {
          failure: "Bucketed distance slows trilateration rather than defeating it. Three accounts and a scriptable location can narrow a target to the intersection of three annuli.",
          handled: "Hysteresis on the displayed band raises the attack cost from minutes to days rather than removing it entirely, an accepted mitigation rather than a full fix.",
        },
      },
    },
    {
      id: "e8",
      from: "client",
      to: "swipe-svc",
      tier: "hot",
      step: 4,
      label: "POST /swipe",
      detail: {
        what: "One swipe event per card: target id, direction, and an idempotency key of (swiper_id, target_id).",
        why: "This arrow carries twenty times the traffic of the feed arrow, because one page of candidates produces twenty decisions. Sizing the write path off feed request rates is the classic mistake here.",
        numbers: [
          { value: "20k/s steady, 60k/s peak", explain: "The write rate this endpoint absorbs, the baseline the whole swipe path is provisioned against." },
          { value: "46% are right-swipes", explain: "20k/s steady × 46% ≈ 9,200/s — only that slice carries on to the reciprocity read at e10; left-swipes end here." },
        ],
        breaks: {
          failure: "Cross-region replication is asynchronous with an RPO of seconds, so a forced failover can lose the most recent swipes.",
          handled: "Client retry against the idempotent key on reconnect is what makes lost swipes survivable, since a replayed swipe after failover is safely a no-op rather than a duplicate.",
        },
      },
    },
    {
      id: "e9",
      from: "swipe-svc",
      to: "swipes",
      tier: "hot",
      step: 5,
      label: "append, by swiper_id",
      detail: {
        what: "The durable swipe record, and the exact check that catches a Bloom false positive before it masks a duplicate write.",
        why: "The probabilistic filter is fine in the feed, where a false positive costs one candidate out of 1,500. It cannot be load-bearing here, though, where the same false positive would silently swallow a real swipe.",
        numbers: [
          { value: "80B per row", explain: "80B × 1.6B swipes/day ≈ 130GB raw, ×3 replication ≈ 390GB/day — volume, not schema size, is what makes this write path expensive." },
          { value: "~390GB/day replicated at RF=3", explain: "The daily write volume this table absorbs, tripled for replication." },
        ],
        breaks: {
          failure: "This write has to land before the match decision is acknowledged.",
          handled: "A crash between the swipe write and the match decision would leave a match with no swipe behind it and no way to audit how it happened. The ordering is enforced strictly to prevent this.",
        },
      },
    },
    {
      id: "e10",
      from: "swipe-svc",
      to: "reverse",
      tier: "hot",
      step: 6,
      label: "did they swipe me?",
      detail: {
        what: "A single-row read against the target-keyed index asking whether the reciprocal right-swipe already exists.",
        why: "One read, never a scan, and no matter how popular the target is. This is the entire mutual-like detection mechanism. The reciprocity check and the privacy guarantee are satisfied by the same lookup, because nothing is written that the target can observe unless it returns a hit.",
        numbers: [
          { value: "one row read per right-swipe", explain: "The normal-case cost of this operation, before any hot-target sharding is triggered." },
          { value: "up to 16 reads for sub-sharded hot targets", explain: "The worst-case fan-out when a target's inbound reads have been spread across sub-shards." },
        ],
        breaks: {
          failure: "For a hot target this read fans to N sub-shards and the write behind it saturates a partition, so those checks queue with backpressure.",
          handled: "Discarding a queued check would be a mutual right-swipe that never becomes a match, so the queue is monitored and drained rather than dropped under load.",
        },
      },
    },
    {
      id: "e11",
      from: "swipe-svc",
      to: "bloom",
      tier: "control",
      label: "set bit + overlay",
      offset: 40,
      detail: {
        what: "Marking the target as swiped in this user's filter, and pushing it onto the small exact overlay that fronts it.",
        why: "The filter has to be updated on the write path rather than rebuilt per session, or the same candidate reappears later in the very same session. The overlay exists so an undone swipe has something that can actually be removed.",
        numbers: [
          { value: "overlay of the last ~50 swipes", explain: "Bounds how far paid rewind reaches before falling back to a full filter rebuild from the swipes table — cheap undo for the common case, expensive beyond it." },
          { value: "9.6 bits added per swipe", explain: "The marginal memory cost of recording one new swipe in the filter." },
        ],
        breaks: {
          failure: "The overlay is the only deletable structure in the exclusion path.",
          handled: "Anything beyond a one-step rewind needs the filter rebuilt from the swipes table rather than patched, an accepted limit on how far undo can reach cheaply.",
        },
      },
    },
    {
      id: "e12",
      from: "swipes",
      to: "embeddings",
      tier: "control",
      label: "swipe labels",
      offset: 56,
      detail: {
        what: "The training loop: swipe outcomes and conversation labels flowing back into the towers that produce candidate vectors.",
        why: "The model is split by signal speed. The retrieval tower retrains slowly on conversation labels, matches reaching five or more messages, which is the honest objective but scarce and delayed by days. The fast ranker retrains on swipe labels, which are immediate but measure attraction rather than compatibility.",
        numbers: [
          { value: "30M matches/day, ~10% converse = 3M positives", explain: "The daily volume of the scarcer, higher-quality conversation label this training loop depends on." },
          { value: "labels delayed 1 to 3 days", explain: "The typical lag before a conversation label is usable for retraining, far slower than the immediate swipe signal." },
        ],
        breaks: {
          failure: "Optimising the tower on swipe labels alone drifts the whole system toward attraction.",
          handled: "The metric that would show this, conversations per match, is the one nobody watches while matches per user is going up. This is an acknowledged monitoring gap rather than a solved problem.",
        },
      },
    },
    {
      id: "e13",
      from: "swipe-svc",
      to: "match-svc",
      tier: "hot",
      step: 7,
      label: "reciprocal hit",
      detail: {
        what: "The 4% of right-swipes where the reverse lookup returned a hit, handed on for match creation.",
        why: "It is a separate service because everything upstream is approximate and best-effort while this step must be exact and idempotent. Splitting them means the funnel can degrade under load without ever putting the match guarantee at risk.",
        numbers: [
          { value: "~30M matches/day", explain: "The daily volume that ultimately flows through this handoff to match creation." },
          { value: "4% of ~750M right-swipes", explain: "The reciprocity rate that determines how much of the right-swipe volume actually reaches this arrow." },
        ],
        breaks: {
          failure: "If this hop is retried without the canonical key doing its job downstream, one reciprocal swipe becomes two matches and two notifications for the same pair.",
          handled: "The canonical-pair key at match creation absorbs a retried hop safely, turning a duplicate handoff into a harmless no-op rather than a duplicate match.",
        },
      },
    },
    {
      id: "e14",
      from: "match-svc",
      to: "matches",
      tier: "data",
      label: "insert (min, max)",
      detail: {
        what: "The idempotent insert on the canonical ordered pair, where the second of two simultaneous writers becomes a no-op.",
        why: "This is the only place in the system where correctness is settled by a constraint rather than by convention. Both users converge on one row, so exactly one match exists and each side is notified once.",
        numbers: [
          { value: "100B row", explain: "100B × 30M matches/day = 3GB/day — negligible beside the swipes table's 390GB/day, since matches are the rare, valuable output the funnel produces." },
          { value: "~3GB/day", explain: "The total daily write volume this table absorbs, tiny next to the swipes table behind it." },
        ],
        breaks: {
          failure: "The no-op has to be genuinely silent to the caller but visible to monitoring.",
          handled: "A rising rate of conflicts is the signal that the reciprocity path is being retried more than it should be, so conflict rate is tracked as its own metric.",
        },
      },
    },
    {
      id: "e15",
      from: "match-svc",
      to: "client",
      tier: "data",
      label: "match notification",
      offset: 60,
      detail: {
        what: "The push notification and in-app banner sent to both matched users once the canonical row is committed.",
        why: "Notification happens after the insert, never before, so a race between two simultaneous writers can never produce two notifications for one match. It travels outside the funnel because it is not a feed card, it is an interrupt.",
        numbers: [
          { value: "~30M matches/day, 2 notifications each", explain: "The daily volume of this notification path, twice the match count since both sides are notified." },
          { value: "sent within 1 to 2 seconds of the insert", explain: "The latency target from a committed match to both users being told about it." },
        ],
        breaks: {
          failure: "A notification that fires before the insert commits can tell a user about a match that a rollback then erases.",
          handled: "The notification is ordered strictly after e14 in the write path, never in parallel with it. It can then never reference a match that does not yet exist.",
        },
      },
    },
  ],
};
