import type { Diagram } from "./types";

export const TINDER: Diagram = {
  id: "tinder",
  title: "Tinder",
  question: "Design Tinder (Dating / Match)",
  sourceId: "patterns",
  itemId: 38,
  overview: {
    shape:
      "Two paths with opposite cost profiles: a narrowing funnel that spends 300ms picking twenty candidates, and a swipe write that costs one row and one lookup but is the only thing here that has to be exact.",
    beats: [
      "Start from the property, not the components. The candidate pool is inventory rather than a corpus: a swipe spends a candidate permanently, the pool is bounded by a radius, and nothing happens until both sides agree. Everything distinctive falls out of those three facts.",
      "The read path is a narrowing funnel and its order is the design. A geo query returns roughly 10,000 people within 10km, the preference filter on age, gender and activity recency trims to ~3,000, the exclusion filter subtracts everyone already swiped and leaves ~1,500, and only then does the ranker run.",
      "Exclusion has to come before ranking and never after. Filtering afterwards means over-fetching by the reciprocal of the unswiped fraction, and that fraction decays per user: someone 80% through their market needs 100 ranked results to yield 20 fresh ones, and at 95% they need 400.",
      "The write path is one row and one lookup. Record the swipe partitioned by the swiper at 20k/s steady, then read the reverse index keyed by target to ask whether that person already swiped right on you. If not, write nothing the target can ever observe: the privacy rule and the match rule are the same rule.",
      "Match creation is where exactness lives. Key the row on the canonical ordered pair so two simultaneous swipes converge on a single insert, notify both sides once, then hand off to a separate chat service asynchronously so a binding failure shows up as a delay rather than as a lost match.",
      "Exposure is a product constraint rather than an optimisation. A profile everyone wants sits in millions of feeds and hands its owner an inbox they cannot meaningfully answer, so the ranker applies a decaying multiplier once a profile passes roughly ten times its local mean impressions.",
    ],
    crux:
      "A profile everyone wants is a write hotspot on the reverse index and a feed monopoly at the same time, and both come from one fact: the scarce resource is attention on the other side of the market, not compute. Capping it costs relevance in exactly the thin markets that need help most.",
    numbers: [
      "1.6B swipes/day: 20k/s steady, 60k/s peak",
      "funnel 10k to 3k to 1.5k to 20, p99 under 300ms",
      "~750M right-swipes/day, 4% mutual, ~30M matches/day",
    ],
  },
  nodes: [
    {
      id: "funnel-group",
      label: "Feed funnel",
      kind: "group",
      x: 16,
      y: 86,
      w: 328,
      h: 344,
      detail: {
        what: "The whole read path: geo and preference narrowing, exclusion, ranking, then exposure control and the cut to twenty.",
        why: "Drawn as one zone because the stages are not independent services, they are a cardinality ladder inside a single request budget. Each stage buys a reduction with the cheapest predicate available at that point, so the one expensive stage runs over hundreds rather than millions.",
        numbers: ["10k to 3k to 1.5k to 20", "300ms p99 for the whole ladder"],
        breaks:
          "Reorder the ladder and it still returns plausible results, which is why funnel-ordering bugs survive every correctness test anyone writes for the swipe path.",
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "20 cards per page, last known coords",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The phone holding a page of twenty cards, emitting one swipe per card and carrying the user's last known coordinates on every feed request.",
        why: "Drawn explicitly because it sets two constraints the rest of the design answers to. Location changes while the user is holding the phone, which is what kills a precomputed deck, and one feed request buys twenty swipe decisions, which is why the read rate sits three orders of magnitude below the write rate.",
        numbers: [
          "20 cards per page, 32 swipes/user/day",
          "~350k concurrent sessions, ~1M at peak",
          "~925 feed requests/s against 20k swipes/s",
        ],
        breaks:
          "A swipe retried after a reconnect must not create a second row, so the client sends an idempotent key of (swiper_id, target_id) and a replay is a no-op rather than a duplicate.",
      },
    },
    {
      id: "feed",
      label: "Feed Service",
      sub: "geo, prefs, exclusion, per request",
      kind: "compute",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "Runs the first three funnel stages on every request: geo radius, preference predicate, exclusion, then hands the survivors to the ranker.",
        why: "Nothing here caches, because the exclusion set, the preference predicate and the ranker are all per user, so the cache key is the user and the hit rate within a session is near zero. A stale entry is actively wrong: it contains people this user just swiped.",
        numbers: [
          "~925 req/s average, ~2.8k/s peak",
          "geo 10 to 30ms, exclusion 10 to 30ms",
          "300ms p99 for the whole request",
        ],
        breaks:
          "Stage 3 selectivity decays monotonically for a user who stays in one place, so a funnel that looks healthy on day one returns a thin page by month two and nothing in the swipe path notices. Track candidates surviving exclusion and widen at ~200, not at zero.",
        choice: {
          pick: "Build the candidate list online, every request, storing nothing between sessions except the swipe log",
          instead: "A nightly batch job that ranks a few hundred candidates per user into a stored deck the app pages through.",
          decider:
            "How fast the defining predicate goes stale, and here it is location. Batch is genuinely cheaper on compute, 75B scorings a night against 120B online, a ~40% saving, but roughly a third of dating sessions start more than 10km from the previous session's origin, and a deck whose entire premise is a stale origin is not repairable, only rebuildable.",
          flips:
            "When matching is not geo-anchored. Interest or questionnaire products such as Hinge's Most Compatible have a stable predicate, so a daily deck is a design artifact and an expensive cross-encoder becomes free quality. Batch is also the only shape that can allocate a scarce profile's attention globally rather than approximating it per request.",
        },
      },
    },
    {
      id: "ranker",
      label: "Two-tower ranker",
      sub: "128-d dot product, ~1.5k scored",
      kind: "compute",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "Scores the ~1,500 survivors with one user-tower pass plus a dot product against each candidate's precomputed 128-dimensional embedding.",
        why: "Ranking is the expensive stage and must never see the whole population, which is the entire reason the three cheap stages run first. Labels are behavioural rather than declared: the retrieval tower learns from conversations, five or more exchanged messages, while the fast ranker retrains on swipe labels because those are plentiful and immediate.",
        numbers: [
          "1,500 inner products over 128 dims = 192k MACs",
          "100 to 150ms, half the 300ms budget",
          "a joint model would be 4.2M invocations/s",
        ],
        breaks:
          "Model server failure loses personalisation entirely, so it circuit-breaks to a cached per-geo ordering by recency and popularity. A worse feed beats no feed, and this is the only tier where that trade is acceptable.",
        choice: {
          pick: "Two-tower factorisation, candidate embeddings computed offline",
          instead: "A joint network scoring f(user, candidate) once per pair, or an ELO-style desirability scalar per profile.",
          decider:
            "1,500 candidates times 2,800 pages/s is 4.2M model invocations per second, which is not a system anyone builds. Two towers reduce the request path to one user pass plus 1,500 dot products, taking microseconds. ELO is cheaper still and fails differently: collapsing to one global ordinal makes exposure a monotone function of a single number, which is why Tinder deprecated it in 2019. Keep right-swipe rate per impression as a feature, refuse the total order.",
          flips:
            "When the candidate set is already tiny. Reranking the top 50 with a joint cross-encoder is 140k invocations per second, merely expensive rather than impossible, and it buys back the expressivity the factorisation gave away.",
        },
      },
    },
    {
      id: "exposure",
      label: "Exposure budget + diversify",
      sub: "decaying multiplier, then top 20",
      kind: "compute",
      x: 40,
      y: 330,
      w: 280,
      detail: {
        what: "Applies the per-profile daily impression budget and a diversity penalty to the scored list, then cuts the top twenty.",
        why: "It attaches after scoring rather than at retrieval, and that placement is the whole argument. Removing budget-exhausted profiles from the candidate set is tempting and wrong in exactly the markets that need fairness most: in a pool of 1,500, deleting the top 150 empties the feed, whereas a decaying multiplier degrades smoothly.",
        numbers: [
          "mean profile is shown 32 times/day",
          "redistribution starts near 320/day, 10x local mean",
          "50k/day hard cap is 1,500x the mean",
        ],
        breaks:
          "Boost sells the exposure this budget removes, and popular profiles are both the best customers and the ones the budget exists to restrain. Making Boost reallocate the remaining budget rather than add to it is defensible, weaker than the marketing, and something engineering can only frame.",
        choice: {
          pick: "Constrain supply: a decaying ranker multiplier once a profile passes roughly 10x its local mean",
          instead: "Constrain nothing on supply and guarantee demand instead: reserve 5 slots of every 20 for candidates below an exposure threshold.",
          decider:
            "Which side is actually scarce, measured as the share of right-swipes absorbed by the top decile of profiles. Above roughly 50% the supply side is binding and throttling is the only thing that moves the number; below it, throttling degrades relevance for no fairness gain. Alert when the top 10% absorb more than 30%.",
          flips:
            "Thin markets, which is precisely where supply-side caps do most damage. With 1,500 filtered candidates, throttling the top 150 removes the reason people opened the app, while reserved slots only displace a marginal candidate. They are also far easier to audit under the EU Digital Services Act, in force since 2024.",
        },
      },
    },
    {
      id: "geo",
      label: "Geo + attribute index",
      sub: "Redis Cluster, sharded by country",
      kind: "store",
      x: 440,
      y: 110,
      w: 240,
      detail: {
        what: "Each user's coordinate in a radius-queryable index, alongside the age, gender and last-active attributes the preference filter reads.",
        why: "Geo here is stage one of four rather than the system, so it gets a small slice of the budget and has to answer from memory. Sharding by country means a query for 10km around a London coordinate never touches a US shard, which is what keeps the fan-out constant as the user base grows.",
        numbers: [
          "GEORADIUS 10km returns ~10k ids",
          "10 to 30ms of a 300ms budget",
          "widen by doubling to a 500km cap",
        ],
        breaks:
          "Geo skew: a fixed radius floods a dense city and empties a rural county. A shard primary failing is worse, because it returns an empty region rather than an error, so the client degrades to a popularity-ordered default feed instead of showing nothing.",
        choice: {
          pick: "Redis Cluster with GEORADIUS, sharded by country",
          instead: "An S2 cell scheme over the profile store, or PostGIS on the transactional database.",
          decider:
            "This stage gets 10 to 30ms of a 300ms budget while returning ~10k ids, so it has to be an in-memory index rather than a disk query. Country sharding bounds the fan-out; a global index would touch every shard for a London query.",
          flips:
            "When the answer is shared across users. In a nearby-restaurants service everyone in one cell gets the same list and a 60 second cache absorbs around 70% of traffic, so a cell scheme plus exact-distance refinement wins. Nothing caches here, because the exclusion set and the ranker are per user.",
        },
      },
    },
    {
      id: "embeddings",
      label: "Candidate embeddings",
      sub: "128 floats/profile, ~50GB",
      kind: "store",
      x: 440,
      y: 220,
      w: 240,
      detail: {
        what: "One 128-dimensional vector per profile produced by the candidate tower offline, pushed to regional caches and read by every ranking pass.",
        why: "This is the cache that makes the ranker affordable at all. The candidate half of the model changes only when the profile does, while it is read by every feed request that retrieves that profile, so computing it once and reading it thousands of times is the whole economy of the two-tower design.",
        numbers: [
          "128 floats plus metadata ~1KB per profile",
          "50M profiles ~50GB, refreshed nightly",
          "profile-edit re-embed lands within minutes",
        ],
        breaks:
          "A nightly refresh misses intra-day changes: a new bio, new photos, a jump in activity. Without an incremental re-embed on profile-edit events the ranker is confidently scoring people who no longer look like their vector.",
        choice: {
          pick: "Precompute the candidate tower offline and cache the vectors globally",
          instead: "Compute candidate embeddings at request time alongside the user embedding.",
          decider:
            "Read amplification. Each vector is read by every request that retrieves its profile and changes only on edit, so computing per request multiplies 1,500 tower passes into every one of 2.8k requests a second. Precomputed, the request path is 192k multiply-accumulates.",
          flips:
            "When profiles change faster than they are read, or when ranking needs viewer-specific signals that cannot be baked into a candidate-only vector, which is exactly what a cross-encoder rerank exists to supply.",
        },
      },
    },
    {
      id: "bloom",
      label: "Exclusion filter",
      sub: "Bloom 1% FP + exact overlay",
      kind: "store",
      x: 440,
      y: 330,
      w: 240,
      detail: {
        what: "One compact bit array per user answering 'have I probably swiped this person', warmed into the feed server at session start, with a small exact overlay in front of it.",
        why: "A candidate can be spent only once, so this is the stage that makes the pool behave like inventory, and it is the only stage whose selectivity gets worse every day the user keeps swiping. Loading it per session makes the check a local memory probe rather than a database round trip inside the request budget.",
        numbers: [
          "9.6 bits/element at 1% false positive",
          "42KB for a three-year user, 600KB at a 500k ceiling",
          "~80GB hot cache at 1M sessions, against ~530GB exact",
        ],
        breaks:
          "A Bloom filter has no delete short of a counting variant at 4x the space, so paid rewind has no home here: you keep an exact overlay of the last ~50 swipes in front of it and tombstone the swipe row. That is the easy half of undo, and once the overlay exists the case for not simply holding the exact set gets thin.",
        choice: {
          pick: "Bloom filter per user at 1% false positive, with an exact check against the swipes table at swipe-write",
          instead: "An exact seen-set of swiped ids per user, held as a compressed bitmap in the same cache.",
          decider:
            "The cost of a false positive against 6.7x the memory, and both numbers are small. 1% drops about 15 of 1,500 candidates and no user can observe it; 80GB against 530GB at 1M peak concurrent sessions is affordable either way. Bloom wins on two secondary properties: fixed size at allocation, so a 500k-swipe power user does not fragment the cache, and a constant seven-hash probe.",
          flips:
            "Thin markets and undo. Dropping 1% of 300 candidates is three real people out of a pool the user exhausts within weeks, and those are the users you can least afford to disappoint. Shipping rewind forces the exact overlay anyway.",
        },
      },
    },
    {
      id: "swipe-svc",
      label: "Swipe Service",
      sub: "one row write, one reverse read",
      kind: "compute",
      x: 40,
      y: 470,
      w: 280,
      detail: {
        what: "Records every swipe partitioned by the swiper, then asks the reverse index exactly one question: has this target already swiped right on me?",
        why: "The write path is deliberately trivial because it runs twenty times harder than the read path, at 20k/s steady against 925 feed requests/s. Everything expensive and approximate lives in the funnel; this side is cheap and has to be exact, because it is the only irreversible thing the system does.",
        numbers: [
          "20k/s steady, 60k/s peak",
          "p99 under 200ms including the reciprocity read",
          "~750M right-swipes/day, 46% of all swipes",
        ],
        breaks:
          "Silently dropping the reciprocity check under load is a mutual right-swipe that never becomes a match, which violates the only guarantee the product makes. Queue it with backpressure instead, and the user finds out months later when a friend says they swiped right.",
        choice: {
          pick: "Write the swipe, then resolve reciprocity with one reverse-index read on the same request",
          instead: "Publish the swipe to a stream and resolve reciprocity asynchronously in a consumer.",
          decider:
            "A match has to be visible before the thumb leaves the screen, inside a 200ms p99. Asynchronous resolution adds a hop and a lag to all 26k peak right-swipes a second in order to save a single-row read, and 96% of those will never match anything anyway.",
          flips:
            "Hot targets. Above 1,000 right-swipes a minute on one profile the check is queued with backpressure precisely because the synchronous path cannot absorb it, which is the asynchronous design applied to the few hundred profiles that need it.",
        },
      },
    },
    {
      id: "swipes",
      label: "Swipes table",
      sub: "Cassandra, partition = swiper_id",
      kind: "store",
      x: 440,
      y: 470,
      w: 240,
      detail: {
        what: "Every swipe as (swiper_id, target_id, direction, ts), partitioned by the swiper so the write load spreads evenly across the ring.",
        why: "Append-only, write-heavy, no joins and single-key reads is the exact shape a wide-column store is for. Partitioning by the swiper balances by construction because everyone swipes at roughly the same rate, which is the property the target-keyed copy conspicuously lacks.",
        numbers: [
          "80B per row, ~130GB/day raw, ~390GB replicated",
          "12-month hot retention ~47TB raw",
          "1.6B swipes/day",
        ],
        breaks:
          "Retention is the quiet decision. Bound the exclusion window at 12 months, because a profile passed on a year ago is effectively a new candidate and an unbounded log is what makes the exclusion filter grow forever.",
        choice: {
          pick: "Cassandra, partitioned by swiper_id",
          instead: "PostgreSQL, or the same wide-column store partitioned by target_id as the primary copy.",
          decider:
            "1.6B blind appends a day at 20k/s steady and 60k/s peak, no joins, single-key reads. Partitioning by the swiper spreads perfectly because every user emits about 32 swipes a day; partitioning by the target puts a celebrity's entire inbound stream on one node.",
          flips:
            "Below a few hundred million rows, where Postgres is simpler to operate and gives you real queries over the swipe log for the depletion and exposure analysis this design leans on.",
        },
      },
    },
    {
      id: "reverse",
      label: "Reverse index",
      sub: "by target_id, sub-sharded when hot",
      kind: "store",
      x: 440,
      y: 580,
      w: 240,
      detail: {
        what: "The same swipe data indexed by target_id, existing for exactly one purpose: answering the reciprocity question in a single row read.",
        why: "Reciprocity must never be a scan, and it must never be answered by asking the target's client anything, because unreciprocated interest has to stay invisible. One index gives you both the match rule and the privacy rule, which are the same rule.",
        numbers: [
          "one row read per right-swipe",
          "sub-shard on (target_id, hash(swiper_id) % N)",
          "alert above 1,000 right-swipes/min on one target",
        ],
        breaks:
          "A celebrity taking 50k right-swipes in an hour turns one row into a write hotspot at thousands per second, while the swiper-partitioned primary copy stays perfectly balanced and every dashboard looks fine.",
        choice: {
          pick: "A target-keyed index, sub-sharded only for targets that trip a hot-key threshold",
          instead: "Sub-shard every target uniformly, or drop the index and scan the swipes table for reciprocity.",
          decider:
            "Sub-sharding turns one reciprocity read into N. Applying it to every target multiplies 26k peak right-swipe reads a second by N for the sake of a few hundred profiles, so the threshold is the actual design and N stays small.",
          flips:
            "If 'who liked you' ships as a visible product surface. That is the same write, but ordered, unbounded and read in bulk, which turns this from a point lookup into a materialised list per target and changes its storage entirely.",
        },
      },
    },
    {
      id: "match-svc",
      label: "Match Service",
      sub: "idempotent insert on (min, max)",
      kind: "compute",
      x: 40,
      y: 580,
      w: 280,
      detail: {
        what: "On a reciprocal right-swipe, creates one match keyed on the canonical ordered pair (min(a, b), max(a, b)) and notifies both sides exactly once.",
        why: "Two people can right-swipe each other within milliseconds, and naive per-user writes produce two match rows and two divergent inboxes. Canonicalising the key makes both writers target the same row, so the database's own uniqueness constraint does the coordination instead of a lock on the hot path.",
        numbers: [
          "4% of right-swipes are mutual",
          "~30M matches/day, against a public figure near 26M",
          "second writer is a no-op",
        ],
        breaks:
          "Undo is one-way past this point. If the swipe created a match the other party may already have been notified, so revoking it is a distributed rollback across match state, push delivery and a chat channel. Most products simply refuse to rewind a swipe that matched, which is a product rule doing the work of a distributed transaction.",
        choice: {
          pick: "INSERT ... ON CONFLICT DO NOTHING on the canonical ordered pair",
          instead: "A distributed lock over both user ids, or a compare-and-set across two per-user rows.",
          decider:
            "The contention is two simultaneous writers, not two thousand. At 30M matches a day a canonical key lets the uniqueness constraint settle the race for free, while a lock adds a coordination round trip to every one of 26k peak right-swipes a second to protect a 4% case.",
          flips:
            "If the match row carries state both writers need to merge rather than mere existence, where a no-op second write loses information and you need a real transaction or a merge function.",
        },
      },
    },
    {
      id: "matches",
      label: "Matches table",
      sub: "keyed on the canonical pair",
      kind: "store",
      x: 440,
      y: 690,
      w: 240,
      detail: {
        what: "One row per match: (match_id, user_a, user_b, created_at, state, last_msg_ts), keyed on the ordered pair so it is unique by construction.",
        why: "The match is the canonical entity and the swipes are the audit log, which is what lets a swipe be corrected without the match identity moving. Storing both swipe timestamps in the row answers 'who liked first' for analytics without a join back into 1.6B swipes a day.",
        numbers: [
          "100B per row, 30M/day ~3GB/day",
          "~1.1TB/year",
          "both swipe timestamps carried inline",
        ],
        breaks:
          "The uniqueness violation on this table is the detection signal for the simultaneous-swipe race, so suppressing the error hides the exact bug the constraint exists to catch.",
        choice: {
          pick: "A wide-column table keyed on the canonical pair, one row per match",
          instead: "Two rows per match, one per user, written on each side for a contiguous inbox read.",
          decider:
            "Two rows reintroduce the race the canonical key removes: at 30M matches a day the pair of writes can interleave and leave one side holding a match the other cannot see. One row plus a per-user materialisation on top gives the same read pattern without the split-brain.",
          flips:
            "When the inbox read overwhelmingly dominates and its latency is the product, where the per-user copy stops being a projection and becomes the primary, with a reconciliation job accepting the risk.",
        },
      },
    },
    {
      id: "chat",
      label: "Chat Service",
      sub: "Q9, channel bound async",
      kind: "external",
      x: 40,
      y: 690,
      w: 280,
      detail: {
        what: "A separate messaging service that a match event unlocks. The diagram stops at the handoff on purpose.",
        why: "Matching and messaging have opposite shapes: one is a single exact write per pair, the other is a long-lived ordered stream per channel with delivery and presence semantics. Folding them together means the match path inherits the messaging system's availability, which is the wrong direction for the only guarantee this product makes.",
        numbers: [
          "~10% of matches actually converse",
          "20 messages/day at 300B, ~18GB/day backlog",
          "binding is async, the match row exists immediately",
        ],
        breaks:
          "A match created with no chat channel bound. The match row lands first and the inbox renders it, and the binding retries with backoff, so the failure surfaces as a delay rather than as a match nobody can open.",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "feed",
      label: "GET /feed + coords",
      animated: true,
      detail: {
        what: "A feed request carrying the user's last known coordinates, asking for the next twenty cards.",
        why: "Coordinates travel on the request rather than being read from a stored profile, because location is the predicate that changes while the user is holding the phone. That single fact is what rules out a precomputed deck.",
        numbers: ["~925 req/s average, ~2.8k/s peak", "one request buys 20 swipe decisions"],
        breaks:
          "A stale or spoofed coordinate quietly poisons stage one, and the funnel has no way to tell a commuter from a location spoofer without behavioural signals from elsewhere.",
      },
    },
    {
      id: "e2",
      from: "feed",
      to: "geo",
      label: "10km radius, ~10k ids",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The radius query plus the attribute reads that back the preference filter, returning candidate ids rather than profiles.",
        why: "Ids only, because a feed page is about 5KB of JSON carrying photo URLs and media never touches this path. Pulling 10,000 full profile records to discard 8,500 of them would spend the whole latency budget on serialisation.",
        numbers: ["~10k ids in, ~3k after preferences", "10 to 30ms"],
        breaks:
          "In a sparse region this returns dozens rather than thousands, so the caller has to widen: recency first, then age band, then radius doubling to a 500km cap.",
      },
    },
    {
      id: "e3",
      from: "feed",
      to: "bloom",
      label: "already swiped? ~1.5k left",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The exclusion probe: seven hash lookups per candidate against the session's warmed bit array.",
        why: "This is the stage that makes the pool inventory rather than a corpus, and it has to run before the ranker so the model's cost stays independent of how depleted the user is. Running it after would mean over-fetching by a factor that grows as the user consumes their market.",
        numbers: ["~3k in, ~1.5k out", "1% false positive drops about 15 candidates"],
        breaks:
          "A cold or evicted filter lets already-swiped profiles back into the feed. Detection is the count of exact-check corrections at swipe-write, and the fix is to warm rather than to block the feed, because transient repeats beat an empty page.",
      },
    },
    {
      id: "e4",
      from: "feed",
      to: "ranker",
      label: "~1.5k survivors",
      animated: true,
      detail: {
        what: "The unswiped, preference-matching candidate set handed to the model.",
        why: "1,500 is the number the three cheap stages exist to produce, because it is what makes a model pass affordable inside the request. Against the unfiltered pool the same ranking would be four orders of magnitude worse.",
        numbers: ["1,500 candidates", "2.8k pages/s peak"],
        breaks:
          "The cardinality on this arrow is the depletion metric. When it falls below ~200 for a cohort, that market is exhausting and widening has to start before the feed changes character overnight.",
      },
    },
    {
      id: "e5",
      from: "ranker",
      to: "embeddings",
      label: "128-d vectors",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the precomputed candidate vectors for the 1,500 survivors so the request path only has to do dot products.",
        why: "The asymmetry is the point: the candidate tower runs once per profile offline, the user tower runs once per request, and everything in between is arithmetic. That is what turns 4.2M model invocations a second into microseconds of linear algebra.",
        numbers: ["1,500 vectors of 128 floats", "192k multiply-accumulates per request"],
        breaks:
          "If the cache misses, the ranker either blocks on a cold read inside a 150ms slice of budget or scores a stale vector, and the second failure is invisible.",
      },
    },
    {
      id: "e6",
      from: "ranker",
      to: "exposure",
      label: "~1.5k scored",
      detail: {
        what: "The scored candidate list passed to exposure control and diversification before the cut to twenty.",
        why: "The budget attaches here, after scoring and before diversification, rather than at retrieval. Removing over-exposed profiles from the candidate set instead would empty the feed in exactly the thin markets that need fairness most.",
        numbers: ["1,500 scored, 20 returned"],
        breaks:
          "Applying the multiplier to a score that is already the output of a ranked cut makes the penalty non-monotone, so a mistuned decay can promote candidates the model ranked far lower.",
      },
    },
    {
      id: "e7",
      from: "exposure",
      to: "client",
      label: "top 20, p99 < 300ms",
      fromSide: "left",
      toSide: "left",
      animated: true,
      detail: {
        what: "Twenty candidate cards as roughly 5KB of JSON carrying photo URLs, a bucketed distance and profile text.",
        why: "URLs rather than media, so the CDN serves the expensive bytes off this path entirely. Distance is a bucketed band rather than a coordinate, because precise coordinates must never leave the server.",
        numbers: ["~5KB per page", "300ms p99 end to end"],
        breaks:
          "Bucketed distance slows trilateration rather than defeating it. Three accounts and a scriptable location narrow a target to the intersection of three annuli, and hysteresis on the displayed band raises the attack cost from minutes to days rather than removing it.",
      },
    },
    {
      id: "e8",
      from: "client",
      to: "swipe-svc",
      label: "POST /swipe",
      animated: true,
      detail: {
        what: "One swipe event per card: target id, direction, and an idempotency key of (swiper_id, target_id).",
        why: "This arrow carries twenty times the traffic of the feed arrow, because one page of candidates produces twenty decisions. Sizing the write path off feed request rates is the classic mistake here.",
        numbers: ["20k/s steady, 60k/s peak", "46% are right-swipes"],
        breaks:
          "Cross-region replication is asynchronous with an RPO of seconds, so a forced failover can lose the most recent swipes. Client retry against the idempotent key on reconnect is what makes that survivable.",
      },
    },
    {
      id: "e9",
      from: "swipe-svc",
      to: "swipes",
      label: "append, by swiper_id",
      fromSide: "right",
      toSide: "left",
      animated: true,
      detail: {
        what: "The durable swipe record, and the exact check that catches a Bloom false positive before it masks a duplicate write.",
        why: "The probabilistic filter is fine in the feed where a false positive costs one candidate out of 1,500, but it cannot be load-bearing here, where the same false positive would silently swallow a real swipe.",
        numbers: ["80B per row", "~390GB/day replicated at RF=3"],
        breaks:
          "This write has to land before the match decision is acknowledged, or a crash between them leaves a match with no swipe behind it and no way to audit how it happened.",
      },
    },
    {
      id: "e10",
      from: "swipe-svc",
      to: "reverse",
      label: "did they swipe me?",
      fromSide: "right",
      toSide: "left",
      animated: true,
      detail: {
        what: "A single-row read against the target-keyed index asking whether the reciprocal right-swipe already exists.",
        why: "One read, never a scan, and no matter how popular the target is. This is the entire mutual-like detection mechanism: the reciprocity check and the privacy guarantee are satisfied by the same lookup, because nothing is written that the target can observe unless it returns a hit.",
        numbers: ["one row read per right-swipe", "N reads for sub-sharded hot targets"],
        breaks:
          "For a hot target this read fans to N sub-shards and the write behind it saturates a partition, so those checks queue with backpressure. Discarding one is a mutual right-swipe that never becomes a match.",
      },
    },
    {
      id: "e11",
      from: "swipe-svc",
      to: "bloom",
      label: "set bit + overlay",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 40,
      detail: {
        what: "Marking the target as swiped in this user's filter, and pushing it onto the small exact overlay that fronts it.",
        why: "The filter has to be updated on the write path rather than rebuilt per session, or the same candidate reappears later in the very same session. The overlay exists so an undone swipe has something that can actually be removed.",
        numbers: ["overlay of the last ~50 swipes", "9.6 bits added per swipe"],
        breaks:
          "The overlay is the only deletable structure in the exclusion path, so anything beyond a one-step rewind needs the filter rebuilt from the swipes table rather than patched.",
      },
    },
    {
      id: "e12",
      from: "swipes",
      to: "embeddings",
      label: "swipe labels",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 56,
      detail: {
        what: "The training loop: swipe outcomes and conversation labels flowing back into the towers that produce candidate vectors.",
        why: "The model is split by signal speed. The retrieval tower retrains slowly on conversation labels, matches reaching five or more messages, which is the honest objective but scarce and delayed by days. The fast ranker retrains on swipe labels, which are immediate but measure attraction rather than compatibility.",
        numbers: ["30M matches/day, ~10% converse = 3M positives", "labels delayed hours to days"],
        breaks:
          "Optimising the tower on swipe labels alone drifts the whole system toward attraction, and the metric that would show it, conversations per match, is the one nobody watches because matches per user is going up.",
      },
    },
    {
      id: "e13",
      from: "swipe-svc",
      to: "match-svc",
      label: "reciprocal hit",
      animated: true,
      detail: {
        what: "The 4% of right-swipes where the reverse lookup returned a hit, handed on for match creation.",
        why: "It is a separate service because everything upstream is approximate and best-effort while this step must be exact and idempotent. Splitting them means the funnel can degrade under load without ever putting the match guarantee at risk.",
        numbers: ["~30M matches/day", "4% of ~750M right-swipes"],
        breaks:
          "If this hop is retried without the canonical key doing its job downstream, one reciprocal swipe becomes two matches and two notifications for the same pair.",
      },
    },
    {
      id: "e14",
      from: "match-svc",
      to: "matches",
      label: "insert (min, max)",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The idempotent insert on the canonical ordered pair, where the second of two simultaneous writers becomes a no-op.",
        why: "This is the only place in the system where correctness is settled by a constraint rather than by convention. Both users converge on one row, so exactly one match exists and each side is notified once.",
        numbers: ["100B row", "~3GB/day"],
        breaks:
          "The no-op has to be genuinely silent to the caller but visible to monitoring, because a rising rate of conflicts is the signal that the reciprocity path is being retried more than it should be.",
      },
    },
    {
      id: "e15",
      from: "match-svc",
      to: "chat",
      label: "match event",
      dashed: true,
      detail: {
        what: "A published match event that a separate messaging service consumes to bind a channel for the pair.",
        why: "Asynchronous on purpose. The match row is the source of truth and exists the moment the insert lands, so a messaging outage delays a conversation rather than losing a match, which is the only ordering of those two failures that is acceptable.",
        numbers: ["~30M events/day", "~10% produce a conversation"],
        breaks:
          "Matches without a chat binding accumulate silently if nobody counts them, because the inbox still renders the match and only the user who taps it finds out.",
      },
    },
  ],
};
