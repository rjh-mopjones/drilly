import type { Diagram } from "./types";

export const RECOMMENDATION: Diagram = {
  id: "recommendation",
  title: "Recommendation System",
  question: "Design a Recommendation System (Home Feed Ranking)",
  sourceId: "patterns",
  itemId: 61,
  overview: {
    shape:
      "A funnel, not a search: 50M items become ~3,000 candidates by cheap retrieval, 500 get scored by an expensive model on fresh features, 20 get served. The loop that feeds it logs the features exactly as served, because the model is only as honest as its training data.",
    forces: [
      {
        constraint: "50M items, a 20-item answer, and a 250ms budget",
        decision: "The Feed service runs a funnel: ~3,000 candidates from parallel cheap sources, 500 ranked by the heavy model, 20 served after re-ranking",
        lights: ["feed-api", "cand", "ranker", "e2", "e4"],
      },
      {
        constraint: "Scoring 50M items with the ranking model would take ~5,000 seconds per request",
        decision: "The ANN index answers 'the ~1,000 items nearest this user's taste vector' in ~10ms, so the heavy model only ever sees survivors",
        lights: ["ann", "e3"],
      },
      {
        constraint: "10B impressions a day train tomorrow's model, but features drift by the hour",
        decision: "The Ranking model service logs the exact feature values it scored with; training joins outcomes to those, never to re-derived ones",
        lights: ["ranker", "log", "e14"],
      },
      {
        constraint: "A new video has 0 history, and history is most of the ~300 features",
        decision: "~2% of slots are exploration, and Realtime aggregates give a fresh item minute-old engagement features instead of day-old nothing",
        lights: ["stream-agg", "features", "e8", "e9"],
      },
      {
        constraint: "A bad model ships behind 200s and green dashboards, because relevance has no error code",
        decision: "The Model registry promotes only through offline eval, then shadow traffic, then a small online holdout, with one-step rollback",
        lights: ["registry", "e10", "e11"],
      },
    ],
    naive: {
      text: "One global popularity list: sort the catalogue by view count, take the top 20, cache it, same for everyone. It even works for a week. Then two things happen. Engagement flatlines, because a global list is wallpaper: personalised feeds run 3 to 4x the click-through of a global one, and the gap widens with catalogue size. And the list freezes, because popularity is a feedback loop. The top 20 collect ~all impressions, which keeps them the top 20, and a new item's chance of being seen rounds to zero. The funnel plus exploration exists to break both: retrieval personalises before ranking spends, and the 2% explore slots pay today's engagement for tomorrow's training data.",
      lights: ["feed-api", "cand"],
    },
    beats: [
      {
        text: "A feed request reaches the Feed service, which owns the funnel and the deadline. It computes the user's taste vector once, fans out to the Candidate sources in parallel, and later re-ranks the model's top items for diversity and policy before returning 20. It is a scatter-gather orchestrator with a budget for every hop, and it degrades by dropping sources, never by missing the deadline.",
        lights: ["user", "feed-api", "e1", "e2"],
      },
      {
        text: "The Candidate sources are cheap and plural. The ANN index returns ~1,000 items nearest the user's vector; trending supplies ~500 heavy hitters; follows supplies subscribed creators' posts; fresh supplies new items owed exploration. Union and dedupe: ~3,000 candidates. Each source is a different opinion about what might be relevant, and none needs to be very right, because the ranker sits behind them.",
        lights: ["cand", "ann", "e2", "e3"],
      },
      {
        text: "The ANN index is what makes retrieval personal at 50M-item scale. Items live as 128-dim embeddings from a two-tower model; the user tower runs per request, and the index answers approximate nearest-neighbour queries in ~10ms on an in-memory graph. Approximate is the point: the 3,000th-best candidate lost nothing, because 500 of 3,000 get ranked anyway.",
        lights: ["ann", "embed", "e3", "e12"],
      },
      {
        text: "The Ranking model service takes the 500 survivors and hydrates them from the Online feature store, ~100 user features and ~200 per item, in one batched read. It scores each candidate's probability of meaningful engagement: not click, but watch-past-30s, because clicks alone train clickbait. ~50ms for the batch on accelerators, the single most expensive hop in the funnel.",
        lights: ["ranker", "features", "e4", "e5"],
      },
      {
        text: "As it scores, the ranker writes the exact feature vector it used for every scored candidate to the event log. This is the loop's honesty mechanism: tomorrow's training joins outcomes to the features as served, never as re-derived later. Hours-later re-derivation disagrees with serve time for any feature that moves, and the freshest features move most.",
        lights: ["ranker", "log", "e14"],
      },
      {
        text: "The client logs what actually happened: impressions with position, clicks, watch time, skips. The Training pipeline joins outcomes to logged features into examples, retrains daily, and evaluates against a held-out day. Position is logged so the model can be trained around position bias. An item shown at slot 1 gets clicks for being at slot 1, and training must not credit the item for the slot.",
        lights: ["user", "log", "trainer", "e6", "e7"],
      },
      {
        text: "Realtime aggregates close the fast loop. A streaming job folds the same event log into minute-fresh counters, an item's impressions, clicks and watch completion over the last hour, written into the feature store. A video posted at noon has usable engagement features by 12:05, which is the difference between exploration that learns and exploration that just spends.",
        lights: ["stream-agg", "features", "log", "e8", "e9"],
      },
      {
        text: "The Model registry gates the loop's output. A candidate model needs offline eval parity, then a shadow run scoring live requests with results discarded, then a small online holdout with engagement compared. Only then promotion, with one-step rollback to the prior version. The budget holds end to end: candidates ~30ms in parallel, hydrate ~30ms, rank ~50ms, re-rank ~10ms, ~150ms against the 250ms p99 target.",
        lights: ["registry", "trainer", "ranker", "e10", "e11"],
      },
    ],
    crux: {
      problem:
        "The system trains on data it generated. The model chooses what is shown; what is shown is what gets engagement; engagement is what trains the model. Left alone, the loop narrows: popular items stay popular, new items never surface, and the model grows confident about a world it created.",
      handled:
        "Three deliberate leaks in the loop. Exploration: ~2% of served slots go to under-exposed items the model would not have picked, which is paid-for training data. Position logging with bias correction, so the model cannot credit items for their slots. And engagement depth over clicks as the label, so the loop optimises satisfaction rather than curiosity. What remains is real: the feed still mostly reflects the model's own past choices. Offline eval on logged data cannot fully measure a policy that would have shown different items. The online holdout is the only honest meter, and it is small and slow.",
    },
    numbers: [
      {
        value: "~5,000s to score 50M vs ~50ms for 500",
        explain: "The ranking model costs ~0.1ms per item even batched on accelerators; 50M x 0.1ms is ~83 minutes per request. The funnel's whole job is making the expensive model only ever see 500.",
      },
      {
        value: "~3,000 → 500 → 20",
        explain: "Candidates from parallel cheap sources, survivors scored by the heavy model, final page after diversity and policy re-ranking. Each stage is ~10x cheaper per item than the next.",
      },
      {
        value: "~25GB of item embeddings",
        explain: "50M items x 128 dims x 4B ≈ 25GB, roughly doubled by the graph index: shardable across a few in-memory nodes answering ~10ms approximate top-1k.",
      },
      {
        value: "~150ms spent vs 250ms p99 budget",
        explain: "Candidates ~30ms (parallel), hydrate ~30ms, rank ~50ms, re-rank ~10ms, plus transport. The headroom absorbs a slow source, which is dropped rather than waited for.",
      },
      {
        value: "10B impressions/day, ~2% explored",
        explain: "The event volume that trains the model, and the slice of traffic deliberately spent on items the model would not have picked, so tomorrow's model knows something today's does not.",
      },
    ],
  },
  nodes: [
    {
      id: "user",
      label: "Viewer",
      kind: "client",
      sub: "requests feed, emits events",
      col: 0,
      row: 0,
      detail: {
        what: "The person scrolling: requests a page of 20, then emits the ground truth as they use it: impressions with position, clicks, watch time, skips.",
        why: "The event stream is the product's only supervision signal. Nobody labels relevance; behaviour is the label, which is why event logging is engineered like a pipeline input rather than analytics exhaust.",
        numbers: [
          { value: "100M daily viewers, ~30k feed requests/s peak", explain: "The serving load; each request is one full funnel execution." },
          { value: "10B impressions/day logged", explain: "~100 impressions per user per day; the raw material of every model this system will ever have." },
        ],
        breaks: {
          failure: "Client batching drops or duplicates event uploads on flaky networks.",
          handled: "Events carry client-generated ids and upload in resumable batches; the log dedupes on id. Losing a few per mille is tolerable, but a bias in what is lost, only long sessions, only one platform, would poison training, so loss is monitored per cohort.",
        },
      },
    },
    {
      id: "feed-api",
      label: "Feed service",
      kind: "service",
      sub: "funnel owner: 3,000 → 500 → 20",
      col: 1,
      row: 0,
      detail: {
        what: "The orchestrator of one feed request: compute the user vector, scatter to candidate sources, gather and dedupe, send survivors to the ranker, re-rank for diversity and policy, return 20.",
        why: "Someone has to own the deadline. Each hop has a budget and a degraded mode. A candidate source that misses its 50ms is dropped from this request; a ranker timeout falls back to retrieval order with popularity boosts. The page is always served; only its quality degrades.",
        numbers: [
          { value: "~30k requests/s peak, stateless", explain: "Scales horizontally; all state lives in the stores and indexes behind it." },
          { value: "final re-rank: ~10ms", explain: "Diversity caps (no 3 items from one creator), policy filters, dedupe against recently shown; cheap rules over 50 items." },
        ],
        breaks: {
          failure: "A downstream slowdown stacks timeouts and the funnel blows its p99.",
          handled: "Hedged requests to candidate sources, hard per-hop deadlines, and a whole-request circuit: past 200ms spent, skip ranking entirely and serve retrieval order. Users get a worse page, never a spinner.",
        },
        choice: {
          pick: "One orchestrator owning explicit per-hop budgets",
          instead: "A chain where each stage calls the next and the deadline is emergent.",
          decider:
            "Tail behaviour. With 4 hops at p99 each, a chained design's page p99 compounds everything's bad days. Explicit budgets with degraded modes cap the page at 250ms by construction, converting overruns into quality loss instead of latency.",
          flips: "An offline batch recommender, emails, weekly digests, where there is no deadline and a simple chain is clearer.",
        },
      },
    },
    {
      id: "cand",
      label: "Candidate sources",
      kind: "serviceGroup",
      sub: "ANN + trending + follows + fresh",
      col: 2,
      row: 0,
      detail: {
        what: "Parallel cheap retrievers, each contributing a few hundred to a thousand candidates: nearest-to-taste, currently trending, from followed creators, and deliberately fresh.",
        why: "Plurality is robustness. Each source is a different theory of relevance with different failure modes; the union means no single theory owns the feed, and the ranker arbitrates. Adding a new theory, a new source, never touches the ranker.",
        numbers: [
          { value: "~3,000 candidates after union + dedupe", explain: "~1,000 ANN + ~500 trending + ~500 follows + ~500 fresh + ~500 from resurfacing, overlapping." },
          { value: "50ms budget, hedged, droppable", explain: "Sources answer in parallel; a laggard is dropped from this request rather than waited for." },
        ],
        breaks: {
          failure: "A source degrades into returning junk rather than failing, and junk flows to the ranker.",
          handled: "Per-source health is measured downstream: the share of each source's candidates surviving ranking is tracked, and a source whose survival rate collapses is auto-muted and paged. The ranker is the filter; the monitor is what notices.",
        },
        choice: {
          pick: "Plural independent sources unioned, each droppable",
          instead: "One learned retrieval model asked for all 3,000 candidates.",
          decider:
            "Coverage and blast radius. Four ~50ms sources in parallel cost the page nothing extra, and cover taste, the moment, follow promises and freshness separately. Muting a sick source costs ~25% of breadth instead of the page.",
          flips: "A small catalogue where one retriever's recall saturates, and plurality is just more things to operate.",
        },
      },
    },
    {
      id: "ann-source",
      label: "Taste retrieval",
      kind: "process",
      parent: "cand",
      col: 2,
      row: 0,
      detail: {
        what: "Queries the ANN index with the user's taste vector for the ~1,000 nearest items.",
        why: "The personalised core of retrieval: it finds items like what this user engages with, including items with modest global popularity.",
      },
    },
    {
      id: "trending-source",
      label: "Trending",
      kind: "process",
      parent: "cand",
      col: 2,
      row: 0,
      detail: {
        what: "The current heavy hitters by short-window engagement, lightly personalised by category.",
        why: "Covers the cold-start user and the network-wide moment; cheap because it is precomputed once, not per user.",
      },
    },
    {
      id: "follows-source",
      label: "Follows",
      kind: "process",
      parent: "cand",
      col: 2,
      row: 0,
      detail: {
        what: "Recent items from creators the user follows, from a fan-out-on-read of their follow list.",
        why: "An explicit signal the user gave; a feed that buries followed creators breaks a promise the product made.",
      },
    },
    {
      id: "fresh-source",
      label: "Fresh + explore",
      kind: "process",
      parent: "cand",
      col: 2,
      row: 0,
      detail: {
        what: "New and under-exposed items owed exploration traffic, sampled by upload recency and low impression count.",
        why: "The deliberate leak in the feedback loop: it pays ~2% of slots to learn about items the model knows nothing about.",
      },
    },
    {
      id: "ann",
      label: "ANN index",
      kind: "database",
      sub: "HNSW, 50M × 128-dim, in-RAM",
      col: 3,
      row: 0,
      detail: {
        what: "The approximate nearest-neighbour index over item embeddings: a navigable graph in memory, sharded, answering top-1k queries in ~10ms.",
        why: "Exact nearest-neighbour over 50M vectors is a 25GB linear scan per query; the graph index answers approximately in milliseconds. Approximate costs nothing here, because retrieval feeds a ranker, not a user.",
        numbers: [
          { value: "~50GB with graph overhead, sharded", explain: "25GB of vectors roughly doubled by graph links; a few shards, query fanned out, results merged." },
          { value: "~10ms top-1k, ~95% recall vs exact", explain: "The missing 5% are items with near-identical neighbours already in the set; the funnel makes the loss unmeasurable." },
        ],
        breaks: {
          failure: "The nightly index rebuild and the live delta stream disagree, and a deleted item keeps surfacing.",
          handled: "Deletions apply as a filter at query time from a small tombstone set, so takedowns are immediate whatever the index build state; the rebuild folds them in properly.",
        },
        choice: {
          pick: "In-memory graph ANN (HNSW-style), nightly build + streamed deltas",
          instead: "Exact retrieval via an inverted index over tags and categories.",
          decider:
            "What retrieval can express. Tag retrieval finds items sharing labels; embedding retrieval finds items sharing audiences, which is the actual signal. And it answers in ~10ms at ~95% recall, where exact vector search would need a full scan.",
          flips: "A small catalogue, under ~1M items, where exact search is a 100ms scan and the index machinery is not yet earning its keep.",
        },
      },
    },
    {
      id: "log",
      label: "Event log",
      kind: "queue",
      sub: "impressions, outcomes, features",
      col: 0,
      row: 1,
      detail: {
        what: "The partitioned log of everything the loop learns from: impressions with position, engagement outcomes, and the ranker's as-served feature vectors.",
        why: "One log, three consumers on their own clocks: the trainer joins it daily, the realtime aggregator folds it by the minute, and debugging replays it. Keeping features and outcomes in the same stream is what makes the training join exact.",
        numbers: [
          { value: "~10B impressions + ~1.5B scored-feature records/day", explain: "Outcomes are small; the feature records dominate bytes at ~2KB each, ~3TB/day, retained 30 days." },
          { value: "1 partition holds a user's whole join", explain: "The log is partitioned by user id, so joining outcomes to servings never crosses partitions." },
        ],
        breaks: {
          failure: "Feature records and outcomes for the same serving land far apart or half-missing.",
          handled: "Both carry the serving's request id, so the join is by id, never by time proximity. A serving with features but no outcomes within the window is labelled negative rather than dropped, because silence is the common outcome.",
        },
        choice: {
          pick: "Log features beside outcomes, join by request id",
          instead: "Store only outcomes and re-derive features from the warehouse at training time.",
          decider:
            "Training-serving skew. Re-derived features disagree with serve time for anything that moves: an item's hour-old CTR, a user's session state. The model then trains on inputs it will never see in production. The cost is ~3TB/day of logged features; the alternative cost is a model that is quietly wrong everywhere it matters.",
          flips: "Purely static features, language, category, duration, where re-derivation is exact and logging them is redundant bytes.",
        },
      },
    },
    {
      id: "ranker",
      label: "Ranking model service",
      kind: "service",
      sub: "scores 500, logs features",
      col: 1,
      row: 1,
      detail: {
        what: "The heavy model behind the funnel: hydrates 500 candidates from the feature store, scores each for probability of meaningful engagement, and logs the exact features it scored with.",
        why: "This is where quality is actually decided, so it gets the budget: ~50ms on accelerators for the batch. The label it predicts is deliberate: watch-past-30s and completion, not click, because a click model converges on clickbait within weeks.",
        numbers: [
          { value: "500 candidates, ~50ms batched", explain: "~0.1ms per item amortised on accelerators; the funnel exists so this number multiplies 500 and never 50M." },
          { value: "~300 features per scored pair", explain: "~100 user, ~200 item and cross features, fetched in one batched hydration call." },
        ],
        breaks: {
          failure: "The feature store hydration misses or times out for some candidates.",
          handled: "Missing features fill with training-time defaults and the affected candidates are scored with a penalty flag; a hydration failure above 5% flips the request to retrieval-order fallback. Never blocking the page on a feature read is a rule.",
        },
        choice: {
          pick: "One heavy ranker behind cheap retrieval, engagement-depth labels",
          instead: "A lighter model everywhere: score tens of thousands of candidates with a small model and skip retrieval quality.",
          decider:
            "Where marginal compute buys quality. Doubling retrieval breadth with a weak scorer moves engagement single-digit percent. The same compute in a deeper ranker over 500 well-retrieved candidates moves it more, in every published ablation and a decade of industry convergence on this shape.",
          flips: "Sparse catalogues or query-driven surfaces, search-like, where candidate quality is the bottleneck and ranking depth saturates.",
        },
      },
    },
    {
      id: "features",
      label: "Online feature store",
      kind: "cache",
      sub: "user + item, ms reads, dual-fed",
      col: 2,
      row: 1,
      detail: {
        what: "The low-latency store of serving features: per-user profiles and histories, per-item stats from daily batch jobs, and minute-fresh engagement counters from the stream.",
        why: "The ranker's quality is capped by feature freshness, and its latency by this store: one batched read for 500 items must return in ~30ms. Batch and streaming pipelines write the same named features, so the ranker never knows which pipeline a value came from.",
        numbers: [
          { value: "~500GB hot, sharded, ~5ms batched reads", explain: "50M items x ~2KB of features plus user rows; memory-first with SSD spill." },
          { value: "minute-fresh counters on ~2M active items", explain: "The streaming feed updates engagement stats for items with current traffic; the long tail keeps daily values." },
        ],
        breaks: {
          failure: "Batch and streaming writers disagree on a feature's definition and the value flaps twice a day.",
          handled: "Feature definitions live in one registry both pipelines compile from, and a monitor diffs batch vs stream values on overlap windows. A divergence beyond tolerance quarantines the feature to its batch value and pages the owner.",
        },
        choice: {
          pick: "One online store dual-fed by batch and stream, single feature registry",
          instead: "The ranker reading the warehouse and stream stores directly per request.",
          decider:
            "The 30ms hydration budget. A warehouse read is hundreds of ms and the stream store speaks a different shape. Materialising both into one keyed store is what makes 500-item hydration a single ~5ms batched call plus network.",
          flips: "Tiny candidate sets or relaxed latency, an email digest ranker, where reading sources directly avoids operating a store.",
        },
      },
    },
    {
      id: "embed",
      label: "Embedding builder",
      kind: "service",
      sub: "item towers, index build + deltas",
      col: 3,
      row: 1,
      detail: {
        what: "The job that runs the item tower over the catalogue, writes embeddings, and builds the ANN index: full rebuild nightly, streamed inserts for new items.",
        why: "Retrieval quality is embedding quality. New items get a provisional embedding from content alone, title, category, audio and frames, within minutes of upload, so exploration can find them before any engagement exists to embed.",
        numbers: [
          { value: "50M items nightly, ~2h on accelerators", explain: "The full pass that realigns the index with the freshly trained towers; deltas cover the day between." },
          { value: "new item indexed in ~5 min", explain: "Content-only embedding streamed into the live index; replaced by a behaviour-informed one at the next rebuild." },
        ],
        breaks: {
          failure: "A new user tower ships while the index still holds last night's item embeddings, and the two spaces misalign.",
          handled: "Tower pairs are versioned together: the ranker's user tower version is pinned to the index build it matches, and a new pair activates only when its index finishes. Misaligned queries are prevented by construction, at the cost of towers lagging a training cycle.",
        },
        choice: {
          pick: "Two-tower embeddings: user tower at request time, item tower precomputed",
          instead: "A single cross model scoring user-item pairs directly for retrieval.",
          decider:
            "Precomputability. A cross model cannot be indexed, scoring it over 50M items is the ~5,000s non-starter, while two towers turn retrieval into nearest-neighbour over precomputed vectors. The cross-features the towers cannot see are exactly what the ranker upstairs exists to model.",
          flips: "Retrieval over a few thousand items, where the cross model can score everything and no index is needed at all.",
        },
      },
    },
    {
      id: "stream-agg",
      label: "Realtime aggregates",
      kind: "service",
      sub: "minute-fresh CTR + watch stats",
      col: 0,
      row: 2,
      detail: {
        what: "A streaming job folding the event log into short-window engagement counters per item, impressions, clicks, completion, written to the feature store within ~a minute.",
        why: "Freshness is a feature the daily batch cannot provide. An item posted at noon has real engagement numbers by 12:05, so the ranker judges exploration results almost immediately. A breaking-news item's rise is visible to the model while it is still rising.",
        numbers: [
          { value: "~150k events/s folded, ~1 min lag", explain: "Windowed counts with late-event tolerance; approximate is fine, these are features, not invoices." },
          { value: "~2M active items updated per window", explain: "Only items with current traffic get streamed updates; the tail's features age gracefully to batch values." },
        ],
        breaks: {
          failure: "The streaming job lags and 'last hour' features silently mean 'three hours ago'.",
          handled: "Every streamed feature carries its watermark, and the ranker reads it: features staler than 10 minutes are discounted toward batch values rather than trusted. Stale-but-labelled degrades quality; stale-and-trusted degrades it silently.",
        },
        choice: {
          pick: "Streamed windowed counters written into the shared feature store",
          instead: "Querying an analytics store for fresh stats at request time.",
          decider:
            "Multiplication. ~30k requests/s x 500 candidates would be ~15M analytic lookups a second; folding once per event is a ~150k events/s stream job whose output is an ordinary ~5ms feature read.",
          flips: "Surfaces ranked on day-old features by design, weekly digests, where the batch pipeline alone is honest.",
        },
      },
    },
    {
      id: "trainer",
      label: "Training pipeline",
      kind: "service",
      sub: "daily join, retrain, eval",
      col: 1,
      row: 2,
      detail: {
        what: "The batch loop: join outcomes to as-served features by request id, build examples with position and propensity, retrain ranker and towers, evaluate on a held-out day.",
        why: "The join is the pipeline's integrity. Because features were logged at serve time, an example is exactly what the model saw and what happened next. Position is a feature at training and neutralised at serving, the standard correction for slot bias.",
        numbers: [
          { value: "~1.5B examples/day into training", explain: "Scored servings with outcomes; negatives are the overwhelming majority and are downsampled with weight corrections." },
          { value: "daily full retrain, ~4h", explain: "Plus lightweight incremental updates for the popularity-sensitive parts between full runs." },
        ],
        breaks: {
          failure: "A pipeline bug corrupts one day's examples and the retrained model inherits it.",
          handled: "Training data ships with distribution checks against the prior week, feature coverage, label rates, and a model that trained on flagged data cannot promote. The registry's gauntlet exists precisely because the trainer will eventually produce a confident wrong model.",
        },
        choice: {
          pick: "Daily full retrain plus incremental freshness updates",
          instead: "Fully online learning, updating the live model per event.",
          decider:
            "Blast radius of a bad update. Online learning propagates a labelling bug into serving within ~10 minutes, with no eval gate; daily training puts every model through offline eval and shadow before traffic. The freshness online learning buys is delivered more safely by minute-fresh features feeding a stable model.",
          flips: "Adversarial, fast-moving surfaces, spam scoring, ad auctions, where day-old weights are materially blind and the gates must move to sampling instead.",
        },
      },
    },
    {
      id: "registry",
      label: "Model registry",
      kind: "database",
      sub: "versions, eval gates, rollback",
      col: 2,
      row: 2,
      detail: {
        what: "The versioned record of every trained model with its eval results, and the promotion state machine: offline eval, shadow, holdout, live, with one-step rollback.",
        why: "Relevance has no error code: a bad model serves 200s with plausible pages while engagement quietly slides. The registry replaces detection with procedure: nothing reaches traffic without passing eval parity offline, scoring shadow traffic, and beating the incumbent on a live holdout slice.",
        numbers: [
          { value: "shadow: ~1% of requests, results discarded", explain: "The candidate scores real traffic for latency and sanity; users never see its choices." },
          { value: "holdout: ~2% live, ~3 days to significance", explain: "Engagement-depth deltas are small; the comparison needs days of traffic to call honestly." },
        ],
        breaks: {
          failure: "A regression too subtle for the holdout window ships anyway.",
          handled: "Long-term holdback cohorts stay on the prior model for weeks, catching slow damage the 3-day gate cannot. The cost, a small slice of users on stale relevance, is treated as the price of a meter.",
        },
        choice: {
          pick: "Gated promotion with shadow and holdout, rollback as a pointer flip",
          instead: "Deploying the nightly model directly on eval metrics alone.",
          decider:
            "Offline metrics measure the logged world, not the served one: a model can beat the incumbent on yesterday's clicks and lose on tomorrow's behaviour. The 3-day holdout is the only measurement of the thing actually being changed, and rollback must be instant because the failure is discovered late by nature.",
          flips: "Low-stakes surfaces, an internal tool's 'related items', where a quiet regression costs little and the gauntlet is overhead.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "user",
      to: "feed-api",
      tier: "hot",
      step: 1,
      label: "feed request",
      detail: {
        what: "The page request: user id, surface, page cursor, device context; 20 ranked items return.",
        why: "One request triggers the whole funnel; everything the response needs is computed inside the 250ms envelope, because a feed that precomputes pages goes stale between sessions.",
        numbers: [{ value: "~30k requests/s peak", explain: "Each one a full scatter-gather-rank; the funnel's per-stage costs are all multiplied by this." }],
        breaks: {
          failure: "A user refreshes rapidly and sees the same page recomputed, wasting the funnel.",
          handled: "A short per-user response cache (~30s) serves rapid refreshes; the cursor advances through a session's already-ranked spillover before a fresh funnel runs.",
        },
      },
    },
    {
      id: "e2",
      from: "feed-api",
      to: "cand",
      tier: "hot",
      step: 2,
      label: "scatter: ~3,000 back",
      detail: {
        what: "The parallel fan-out to every candidate source with the user vector and context, unioned and deduped on return.",
        why: "Sources answer independently within one shared 50ms budget; the union is where plural theories of relevance become one candidate set for the ranker to arbitrate.",
        numbers: [{ value: "4+ sources, 50ms shared budget", explain: "Hedged and droppable; the funnel's breadth degrades gracefully source by source." }],
        breaks: {
          failure: "Dedupe misses near-duplicates, re-uploads, clips, and the page fills with the same content.",
          handled: "Dedupe runs on content fingerprints as well as ids, and the final re-rank enforces creator and content-cluster caps as the last line.",
        },
      },
    },
    {
      id: "e3",
      from: "cand",
      to: "ann",
      tier: "hot",
      step: 3,
      label: "top-1k near user vector",
      detail: {
        what: "The taste-retrieval source querying the index shards with the request's user vector, merging shard results.",
        why: "The one retrieval hop that is personal and cheap at the same time; its ~10ms is what lets personalisation happen before the expensive model rather than after.",
        numbers: [{ value: "~10ms across shards, ~95% recall", explain: "Approximate by design; the ranker behind it makes the missing 5% costless." }],
        breaks: {
          failure: "A shard is slow and the merge waits on the tail.",
          handled: "Merge returns at the budget with whatever shards answered; a missing shard trims candidate breadth for one request, which the plural sources already cover.",
        },
      },
    },
    {
      id: "e4",
      from: "feed-api",
      to: "ranker",
      tier: "hot",
      step: 4,
      label: "rank 500 survivors",
      detail: {
        what: "The pruned candidate set sent for scoring; ordered scores return for the final re-rank.",
        why: "The 3,000 to 500 pruning uses a lightweight pre-scorer, retrieval scores plus a few features, so the heavy model's 50ms multiplies 500 and not 3,000. The funnel narrows in cost order.",
        numbers: [{ value: "500 in, 500 scores out, ~50ms", explain: "The most expensive hop; sized so the whole funnel fits ~150ms of its 250ms budget." }],
        breaks: {
          failure: "Ranker capacity saturates at peak and queueing would blow the page budget.",
          handled: "The batch shrinks under pressure: 500 drops toward 200 scored candidates before any request queues. Quality bends; latency does not.",
        },
      },
    },
    {
      id: "e5",
      from: "ranker",
      to: "features",
      tier: "hot",
      step: 5,
      label: "hydrate 500 × ~300",
      detail: {
        what: "One batched read: the user's feature row plus feature rows for every candidate, merged into model inputs.",
        why: "Hydration is a latency cliff if done naively: 500 point reads would be 500 round trips. The batched call keeps it one ~5ms store operation plus deserialisation.",
        numbers: [{ value: "~30ms end-to-end for the batch", explain: "Store read plus assembly into tensors; the second-largest hop after the model itself." }],
        breaks: {
          failure: "A hot item's feature row becomes a read hot spot across every request.",
          handled: "Item features are cached in-process at the ranker with second-level TTLs; the store sees each hot item once per ranker node per second, not once per request.",
        },
      },
    },
    {
      id: "e6",
      from: "user",
      to: "log",
      tier: "data",
      label: "impressions + outcomes",
      detail: {
        what: "The client's event uploads: impression with position, click, watch time, skip, batched and resumable.",
        why: "This is the label supply. Position is mandatory on every impression because the bias correction at training depends on it; an impression without a position is an example the trainer cannot use honestly.",
        numbers: [{ value: "~10B/day, ~120k/s average", explain: "Bursty with usage peaks; the log absorbs and the consumers read at their own pace." }],
        breaks: {
          failure: "An app update breaks watch-time reporting on one platform.",
          handled: "Per-platform label-rate monitors alarm on distribution shifts; training excludes flagged cohorts for the affected days rather than learning from a broken sensor.",
        },
      },
    },
    {
      id: "e7",
      from: "log",
      to: "trainer",
      tier: "data",
      label: "daily join by request id",
      detail: {
        what: "The training read: as-served feature records joined to outcome events on the request id, per user partition.",
        why: "Joining by id rather than by time is what makes examples exact. The features in an example are byte-identical to what the model scored, which is the whole defence against training-serving skew.",
        numbers: [{ value: "~1.5B examples from ~3TB of features", explain: "The daily volume; negatives downsampled with importance weights to keep training tractable." }],
        breaks: {
          failure: "Outcomes arrive after the training cutoff, watch time reported on next app open.",
          handled: "The join window trails by a day: today's training uses servings from two days ago through yesterday, so late outcomes land before their servings are joined.",
        },
      },
    },
    {
      id: "e8",
      from: "log",
      to: "stream-agg",
      tier: "data",
      label: "fold by the minute",
      detail: {
        what: "The streaming consumer reading the same log and folding per-item windowed counters continuously.",
        why: "Same events, second clock: what the trainer sees tomorrow, the counters reflect in a minute, and both derive from one source so they cannot disagree about what happened.",
        numbers: [{ value: "~150k events/s, ~1 min watermark", explain: "Late events within tolerance fold in; the counters are features and tolerate approximation." }],
        breaks: {
          failure: "A replay after consumer failure double-counts a window.",
          handled: "Windows fold idempotently by event id within the window's state; replays reconverge to the same counts.",
        },
      },
    },
    {
      id: "e9",
      from: "stream-agg",
      to: "features",
      tier: "data",
      label: "minute-fresh counters",
      detail: {
        what: "The streamed feature writes: short-window engagement stats per active item, stamped with their watermark.",
        why: "The watermark travels with the value so the ranker can discount staleness instead of trusting it; freshness that cannot be verified is worse than staleness that can.",
        numbers: [{ value: "~2M items/window updated", explain: "Only items with live traffic; the write rate stays flat however large the catalogue grows." }],
        breaks: {
          failure: "A counter spike from a bot wave inflates an item's fresh CTR.",
          handled: "The counters consume the log after spam filtering, and the ranker's inputs cap per-feature z-scores, so one poisoned counter bends a score rather than owning it.",
        },
      },
    },
    {
      id: "e10",
      from: "trainer",
      to: "registry",
      tier: "data",
      label: "candidate + eval report",
      detail: {
        what: "Every trained model registered with its data lineage, eval metrics and the training-data health checks it passed.",
        why: "Lineage is what makes a later incident debuggable: which data trained the model that served the bad week is a lookup, not archaeology.",
        numbers: [{ value: "1 candidate/day per surface, all retained", explain: "Models are cheap to keep and expensive to reconstruct; the registry keeps every artefact and verdict." },],
        breaks: {
          failure: "A model trained on subtly flagged data is registered anyway.",
          handled: "Health-check failures hard-block promotion state, not registration: the artefact exists for forensics but cannot advance toward traffic.",
        },
      },
    },
    {
      id: "e11",
      from: "registry",
      to: "ranker",
      tier: "control",
      label: "promote / shadow / rollback",
      detail: {
        what: "The registry driving which model version the ranker serves, shadows, or reverts to.",
        why: "Model deployment is a pointer flip against versioned artefacts, so rollback is seconds, which matters because relevance regressions are discovered days late by nature.",
        numbers: [{ value: "rollback < 1 min, one step", explain: "The prior version stays warm; reverting is re-pointing, not redeploying." }],
        breaks: {
          failure: "Shadow and live models read the same feature store and a shadow bug pollutes shared caches.",
          handled: "Shadow runs read-only with its own cache namespace; it can be wrong in private, which is the entire point of shadow.",
        },
      },
    },
    {
      id: "e12",
      from: "embed",
      to: "ann",
      tier: "data",
      label: "nightly build + deltas",
      detail: {
        what: "The index lifecycle: full rebuild from the night's item embeddings, atomic shard swap, streamed inserts between builds.",
        why: "Atomic swap per shard means queries never see a half-built index; the delta stream keeps the day's uploads retrievable without waiting for tonight.",
        numbers: [{ value: "~2h rebuild, ~5 min delta path", explain: "The two freshness clocks of retrieval: catalogue-wide realignment nightly, per-item availability in minutes." }],
        breaks: {
          failure: "A bad embedding batch degrades the whole index at swap.",
          handled: "Pre-swap sanity queries compare recall against the live index on a probe set; a failing build is discarded and the old index serves another day.",
        },
      },
    },
    {
      id: "e13",
      from: "trainer",
      to: "embed",
      tier: "data",
      label: "fresh tower weights",
      detail: {
        what: "The nightly handoff of retrained tower weights to the embedding builder.",
        why: "Towers must move together. The item tower that builds tonight's index is versioned with the user tower the ranker will run against it. The two sides of the dot product always share a space.",
        numbers: [{ value: "tower pair versioned as 1 unit", explain: "The invariant that prevents querying a new user vector against an old item space." }],
        breaks: {
          failure: "Tower training diverges and nightly embeddings shift wholesale.",
          handled: "Embedding-drift checks compare distances on a fixed probe set between builds; a wholesale shift quarantines the build for human review.",
        },
      },
    },
    {
      id: "e14",
      from: "ranker",
      to: "log",
      tier: "data",
      label: "features as served",
      detail: {
        what: "For every scored candidate: the request id, model version, position served, and the exact feature vector the model scored.",
        why: "The single most important non-serving write in the system. Without it, training joins outcomes to re-derived features that disagree with serve time, and the model learns a world it never actually saw.",
        numbers: [{ value: "~1.5B records/day, ~2KB each", explain: "~3TB/day, 30-day retention: the storage bill for a model that trains on the truth." }],
        breaks: {
          failure: "Under load, feature logging is the tempting thing to shed.",
          handled: "It sheds by sampling, never by stopping: at pressure the ranker logs a uniform sample with recorded rates, so training reweights instead of inheriting a silent gap.",
        },
      },
    },
  ],
  figures: {
    funnel: {
      title: "The funnel: each stage is ~10x cheaper per item than the next",
      nodes: [
        { id: "corpus", label: "Catalogue: 50M items", sub: "embedded, indexed", kind: "database", col: 0, row: 0 },
        {
          id: "retrieve",
          label: "Retrieval: ~3,000",
          sub: "ANN + trending + follows + fresh",
          kind: "service",
          col: 0,
          row: 1,
          detail: {
            what: "Cheap parallel sources reduce 50M to ~3,000 in ~30ms.",
            why: "Milliseconds per thousand items: retrieval only has to be roughly right, because a ranker sits behind it.",
          },
        },
        {
          id: "rank",
          label: "Ranking: 500 scored",
          sub: "heavy model, ~50ms",
          kind: "service",
          col: 0,
          row: 2,
          detail: {
            what: "The expensive model scores the survivors on ~300 fresh features each.",
            why: "~0.1ms per item is affordable for 500 and absurd for 50M; the funnel exists to protect this stage.",
          },
        },
        {
          id: "page",
          label: "Page: 20 served",
          sub: "diversity + policy re-rank",
          kind: "client",
          col: 0,
          row: 3,
          detail: {
            what: "The final page after creator caps, policy filters and dedupe against recent history.",
            why: "Rules, not models: the last stage encodes product promises the score cannot express.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "corpus", to: "retrieve", tier: "hot", step: 1, label: "50M → 3,000" },
        { id: "e2", from: "retrieve", to: "rank", tier: "hot", step: 2, label: "3,000 → 500" },
        { id: "e3", from: "rank", to: "page", tier: "hot", step: 3, label: "500 → 20" },
      ],
    },
  },
};
