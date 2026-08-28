import type { Diagram } from "./types";

export const TIKTOK: Diagram = {
  id: "tiktok",
  title: "TikTok",
  question: "Design TikTok (Short Video)",
  sourceId: "patterns",
  itemId: 28,
  overview: {
    shape:
      "No fan-out anywhere: every swipe is a retrieval query over a 10 billion video corpus, narrowed cheaply to a few hundred, scored expensively down to fifty, and handed to a client that has already downloaded the next two videos.",
    beats: [
      "The Feed Service is a dispatcher rather than a ranker. It assembles context features from the session, time, device and region, looks up the user's precomputed 256-dimensional vector, and fires five retrieval channels concurrently: ANN, trending in region, fresh from follows, sound affinity and exploration.",
      "Retrieval is geometric and almost free per candidate. IVF-PQ takes 10 billion video vectors to a top-1000 in roughly 5ms against 160GB of quantised codes, and over-retrieval buys back the recall the compression cost by re-ranking to top-200 against full vectors.",
      "Ranking is the expensive half and the cost dominator. A multi-task network scores the roughly 300 survivors on completion, like, share and follow, collapses them into a single number, then re-ranks for variety so one creator cannot own three of your next six swipes.",
      "The response is 50 ids carrying manifest and signed first-chunk URLs, because a sub-100ms swipe-to-play target sits below any network round trip. The client plays number one and pulls the first segment of two and three on background bandwidth, so the next swipe resolves locally.",
      "Nothing enters this system on engagement. A new video's embedding is computed from its pixels, audio, sound and creator at the end of transcode and inserted into the index before it is marked feed-eligible, after which it competes for one reserved feed slot in ten.",
      "The loop closes at two speeds deliberately. Interaction events stream back at about a trillion a day, the ranker checkpoints from them every five minutes so an hour-scale trend is caught, and retrieval embeddings rebuild hourly over 30 days so the model cannot chase its own output.",
    ],
    crux:
      "Every stage of the funnel ranks on observed engagement, and a video with no impressions has no observations, so without a reserved exploration budget the corpus freezes at whatever was popular yesterday. Exploration is the only door in, and at 100M uploads a day it is oversubscribed four to one permanently.",
    numbers: [
      "10B videos to ~300 candidates per call",
      "~200k feed calls/s peak, 60M scorings/s",
      "40B exploration impressions demanded vs 10B supplied",
      "under 100ms swipe-to-play",
    ],
  },
  nodes: [
    {
      id: "retrieval-group",
      label: "Retrieval: 10B to ~300 candidates",
      kind: "zone",
      x: 424,
      y: 214,
      w: 292,
      h: 328,
    },
    {
      id: "client",
      label: "Client app",
      sub: "plays local, preloads 2-3 ahead",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The app: it plays the current video from local storage while downloading the first segment of the next two or three.",
        why: "A sub-100ms swipe-to-play target is below any network round trip, so the only way a swipe feels instant is for the next video to be on the device before the thumb lands. Preload is therefore an architectural decision, not a client detail.",
        numbers: [
          "under 100ms swipe-to-play target",
          "~50 ids per response, refetch near the halfway mark",
          "~40 swipes per session",
        ],
        breaks:
          "Preloaded videos the user never reaches are wasted bytes on somebody's data plan, so preload hit ratio and wasted-prefetch bytes only mean anything read together.",
        choice: {
          pick: "Adaptive preload depth: 3 ahead at 720p on Wi-Fi, 1 ahead at 480p on metered cellular",
          instead: "A fixed depth of three preloaded videos for everyone.",
          decider:
            "Wasted bytes against start latency. A response carries ~50 ids and a session runs ~40 swipes, so preloading 3 ahead on cellular discards a segment for most videos never reached, while 1 ahead on Wi-Fi leaves the 100ms budget unmet on a link that had the bandwidth spare.",
          flips:
            "Wi-Fi-only or offline-first products, where bandwidth is effectively free and depth should run as deep as local storage allows.",
        },
      },
    },
    {
      id: "feed-service",
      label: "Feed Service",
      sub: "context features, 5 channels in parallel",
      kind: "service",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "The regional entry point for a feed call: builds context features, fetches the user vector, and dispatches the five retrieval channels concurrently.",
        why: "Everything downstream is a store or a model, so one tier has to own the request budget of about 10ms for retrieval and 30ms for ranking. The channels run in parallel because five sequential calls would spend the entire budget on network waits.",
        numbers: [
          "~46k feed calls/s average, ~200k/s peak",
          "~25 impressions consumed per call",
          "50 ids per response",
        ],
        breaks:
          "It is the single point of feed availability, so when the recommender behind it is unhealthy it has to degrade to trending plus follows plus the per-user candidate cache rather than return an empty feed.",
        choice: {
          pick: "Return a batch of 50 ids per call, client refetches near the halfway mark",
          instead: "One video per request, resolved on each swipe.",
          decider:
            "Call rate. 100B impressions/day at ~25 consumed per call is 4B calls/day, ~46k/s average and ~200k/s peak. Per-swipe resolution multiplies that by 25 and puts a round trip inside the 100ms budget, which also kills preload because the client would not know what comes next.",
          flips:
            "Surfaces where ordering must react to the immediately preceding item, such as live or conversational feeds, where a half-stale batch is worse than the extra calls.",
        },
      },
    },
    {
      id: "embedding-store",
      label: "User embedding store",
      sub: "1TB of 256-d vectors, hourly refresh",
      kind: "database",
      x: 440,
      y: 110,
      w: 260,
      detail: {
        what: "A key-value store holding one 256-dimensional float vector per user, rebuilt hourly in batch from a 30-day interaction window.",
        why: "The two-tower model is deliberately asymmetric so the expensive half runs offline. Serving needs only a lookup, which keeps a 200k-calls-per-second tier off training hardware and makes the user vector a stable anchor rather than something that lurches mid-session.",
        numbers: ["1B users x 256 dims x 4B = ~1TB", "refreshed hourly", "one read per feed call"],
        breaks:
          "Embedding age is invisible in engagement metrics until watch rate regresses, so it needs its own freshness alarm, separate from the ranker's.",
        choice: {
          pick: "Precomputed vectors in a KV store, hourly batch refresh",
          instead: "Running the user tower live per request from raw history.",
          decider:
            "Where the forward pass lands. 1TB of vectors refreshed hourly is one batch job; a live user-tower pass is an inference at ~200k calls/s inside a 10ms retrieval budget. Within-session reactivity is recovered by the ranker's context features, which genuinely do run live.",
          flips:
            "Small user bases, or products where intent shifts so sharply inside a session that an hour-old vector retrieves the wrong neighbourhood entirely.",
        },
      },
    },
    {
      id: "ann-index",
      label: "ANN index",
      sub: "IVF-PQ, 10B vectors, ~160GB",
      kind: "database",
      x: 440,
      y: 230,
      w: 260,
      detail: {
        what: "The learned retrieval channel: 10 billion video vectors as product-quantised codes, sharded, with a coarse quantizer routing the user vector to the relevant cells.",
        why: "Scoring 10 billion candidates with the ranker is more compute than exists, so the corpus has to be narrowed by arithmetic that costs almost nothing per candidate. This index is what makes serving cost independent of catalogue size.",
        numbers: [
          "10B vectors at ~16B per PQ code = ~160GB",
          "top-1000 in ~5ms",
          "re-ranked to top-200 against full vectors",
        ],
        breaks:
          "Retrieval failures are silent. Anything this index does not surface is never scored, never served and never measured, because you only observe the quality of what you served.",
        choice: {
          pick: "IVF-PQ, sharded, over-retrieving top-1000 then exact re-ranking to top-200",
          instead: "HNSW, which holds full vectors in RAM and gives materially better recall at the same query latency.",
          decider:
            "Corpus size against memory budget. A 256-dim float32 vector is 1KB, so 10B vectors is ~10TB of RAM for HNSW against ~160GB for IVF-PQ at 16B per vector, a 60x gap. The 5 to 10 points of recall lost to quantisation are bought back by over-retrieving.",
          flips:
            "Retrieval pools under ~100M vectors. A hot recent subset for one region is under 10M and belongs in HNSW, which is also where IVF-PQ's poor handling of streaming inserts hurts most.",
        },
      },
    },
    {
      id: "trending",
      label: "Trending + follows channels",
      sub: "Redis top-K per region, non-learned",
      kind: "database",
      x: 440,
      y: 340,
      w: 260,
      detail: {
        what: "The non-learned channels: cached top-K by recent engagement per region, plus recent uploads from followed creators and videos using sounds the user has engaged with.",
        why: "Retrieval embeddings are up to an hour stale and a sound goes from unknown to top-of-region in two to six hours, so during exactly the events that matter most the learned path cannot see the content. These channels inject it through a path that needs no training.",
        numbers: ["~50 candidates from trending", "~30 from follows", "~20 from sound affinity"],
        breaks:
          "This is a patch over stale retrieval rather than a fix, so if the hourly rebuild slips, the channel quietly becomes most of the feed and every user in a region converges on the same videos.",
        choice: {
          pick: "Redis top-K per region, recomputed continuously",
          instead: "Letting the learned retrieval path surface trends on its own.",
          decider:
            "Time constants. A trend peaks in 2 to 6 hours while retrieval rebuilds hourly over a 30-day window, so a video that exploded 40 minutes ago still sits where the corpus put it. A cheap non-learned channel closes that gap without making retrieval fast enough to destabilise the feedback loop.",
          flips:
            "Catalogues that turn over daily rather than hourly, such as long-form video or a music library, where the learned path is fresh enough and a second channel is pure operational cost.",
        },
      },
    },
    {
      id: "explore-pool",
      label: "Exploration pool",
      sub: "1 slot in 10, under 500 impressions",
      kind: "database",
      x: 440,
      y: 450,
      w: 260,
      detail: {
        what: "A reserved retrieval channel filling one feed slot in ten from videos with under 500 lifetime impressions that have cleared moderation.",
        why: "Every other stage ranks on observed engagement, so a video with none is unreachable by construction. This channel is the only door into the corpus, which is why it is an explicit budget line you can read off a dashboard rather than a term buried inside a model.",
        numbers: [
          "1 feed slot in 10",
          "~400 impressions to measure completion to +/-5 points",
          "40B of demand against 10B supplied, 4x oversubscribed",
          "bottom-decile kill at 100 impressions recovers ~7% of the quota",
        ],
        breaks:
          "Uncorrected position bias makes exploration impressions look worse than organic ones, so the promotion threshold ratchets upward and the whole mechanism decays into a no-op while every dashboard stays green.",
        choice: {
          pick: "A reserved quota served as its own retrieval channel, entry ranked by a cheap prior",
          instead: "A UCB-style uncertainty bonus inside the ranker, so under-observed videos compete on a boosted score.",
          decider:
            "Whether the spend is visible. Measuring completion near 40% to +/-5 points needs ~400 impressions, and 100M uploads/day is 40B of demand against 100B of total inventory, so exploration must be rationed. A bonus has no budget: its spend is emergent and shifts silently on every retrain.",
          flips:
            "Under roughly 5% of daily impressions needed to explore everything. A niche app at 1M uploads/day needs 400M against 20B of inventory, and there the bonus wins because it explores continuously and targets uncertainty.",
        },
      },
    },
    {
      id: "video-tower",
      label: "Video tower",
      sub: "content + creator features only",
      kind: "service",
      x: 840,
      y: 450,
      w: 260,
      detail: {
        what: "The offline half of the two-tower model: one forward pass per video at the end of transcode over creator, hashtags, sound, sampled frames and the audio track.",
        why: "Not one of those inputs requires a view, which is the whole point. The tower is architecturally forbidden from consuming engagement counts, so a video four minutes old already has plausible neighbours rather than a cold-start branch bolted on the side.",
        numbers: [
          "~100M uploads/day",
          "256-dim output, one pass per video",
          "inserted before the video is marked feed-eligible",
        ],
        breaks:
          "A feature-only embedding is a prior, not a measurement: two videos with near-identical audio and visuals routinely differ 3x in completion because one has a better first two seconds, and nothing in these inputs can see that.",
        choice: {
          pick: "Content and creator features only, computed at end of transcode",
          instead: "Seeding the embedding from a video's first few hundred impressions.",
          decider:
            "Reachability. 100M videos a day arrive with zero observations, and a video that gets no impressions never earns any, so any engagement-derived embedding leaves the day's uploads unreachable forever. It also means the transcode metric that matters is time-to-feed-eligible, not time-to-1080p.",
          flips:
            "Catalogues whose items arrive with external priors attached, such as licensed content with known viewership, where an engagement-seeded vector starts far closer to the truth than pixels do.",
        },
      },
    },
    {
      id: "union",
      label: "Union, dedupe, safety filter",
      sub: "~300 candidates survive",
      kind: "service",
      x: 40,
      y: 400,
      w: 280,
      detail: {
        what: "Merges the five channels, drops duplicates, and applies moderation, region and block-list filters before anything is scored.",
        why: "The channels overlap heavily and the filters here are set lookups, while the stage immediately after is the most expensive tier in the system. Filtering first guarantees no accelerator time is ever spent on a candidate that could not have been served.",
        numbers: ["5 channels merged", "~300 candidates out", "filter cost is one set lookup per candidate"],
        breaks:
          "A takedown landing between ranking and playback still slips through, which is why hydration repeats a tombstone check for ids already handed to a client.",
        choice: {
          pick: "Filter before ranking, then tombstone again at hydration",
          instead: "Ranking everything and filtering the top 50 afterwards.",
          decider:
            "Where the cost lands. Scoring runs at 60M candidate-scorings/s on 400 to 600 accelerators; filtering is a lookup. Ranking first pays inference on candidates that can never be served and still needs the hydration check anyway, because a video can be taken down after it was scored.",
          flips:
            "When eligibility depends on the ranking itself, such as a policy expressed as a share of the final response rather than as a per-item rule.",
        },
      },
    },
    {
      id: "ranker",
      label: "Multi-task ranker",
      sub: "watch, like, share, follow",
      kind: "service",
      x: 40,
      y: 510,
      w: 280,
      detail: {
        what: "A multi-task network with sparse embedding tables scoring each candidate for completion, like, share, comment and follow in one forward pass.",
        why: "Retrieval knows what resembles what you watched before and has no notion of what you will actually finish. That prediction is what the expensive stage buys, and it is affordable only because retrieval already bounded the work at a few hundred candidates.",
        numbers: [
          "~300 candidates in ~30ms",
          "60M candidate-scorings/s at peak",
          "~150k scorings/s per accelerator, ~400 to 600 accelerators",
        ],
        breaks:
          "It is the cost dominator, so candidate-set size is a budget line rather than a tuning knob, and any inference latency spike is a direct product regression.",
        choice: {
          pick: "One multi-task model with four heads on an accelerator fleet",
          instead: "A model per objective, or a gradient-boosted tree over dense features.",
          decider:
            "Serving cost is linear in candidates times models. At 60M candidate-scorings/s a shared trunk with four heads costs ~400 to 600 accelerators; four separate models multiply that by four for predictions that share nearly all of their features anyway.",
          flips:
            "When one objective needs a wildly different feature set or update cadence from the rest, at which point the shared trunk is a coupling you pay for on every deploy.",
        },
      },
    },
    {
      id: "rerank",
      label: "Diversity re-rank + hydrate",
      sub: "top 50 ids + prefetch hints",
      kind: "service",
      x: 40,
      y: 620,
      w: 280,
      detail: {
        what: "Collapses the four predictions into one score with A/B-tuned weights, penalises repeated creators and topics, then hydrates the top 50 with manifest and signed first-chunk URLs.",
        why: "A pure score ordering puts the same creator in three of six swipes, which reads as a broken feed even when every individual prediction was correct. Hydration lives here so the response carries everything playback needs without a second round trip.",
        numbers: ["top 50 returned", "prefetch hints for the next 2 to 3", "weights tuned by A/B, not learned end to end"],
        breaks:
          "The blend weights are where product policy hides, and a weight change that reshapes the corpus passes every A/B because the test metric is the same quantity the weights optimise.",
        choice: {
          pick: "Embed manifest URL and a signed first-chunk URL in the feed response",
          instead: "Return ids only and let the client resolve each manifest on demand.",
          decider:
            "Round trips inside a 100ms budget. An id-only response costs a manifest fetch before the first byte of video, which on mobile alone exceeds the swipe-to-play target, and the client cannot preload two ahead when it does not yet know their URLs.",
          flips:
            "When URLs must be authorised per view at play time, such as paid or rights-restricted content, where handing out 50 pre-signed URLs at once is a leak.",
        },
      },
    },
    {
      id: "cdn",
      label: "Edge CDN",
      sub: "HLS segments, pre-warmed",
      kind: "external",
      x: 840,
      y: 110,
      w: 260,
      detail: {
        what: "Edge points of presence serving the HLS segments the client plays and preloads.",
        why: "At 100B impressions a day and roughly 2MB actually watched per impression, egress is about 2.3TB/s, and an edge hit ratio above 95% is what keeps origin egress near 100GB/s. Preload only works if the segment is one short hop away.",
        numbers: ["~200PB/day egress", ">95% edge hit ratio", "origin sees one fetch per POP per object"],
        breaks:
          "A cold POP turns a preload into a full origin round trip, which is precisely the case the 100ms budget cannot absorb, so rising videos are pushed to edges ahead of the demand.",
      },
    },
    {
      id: "events",
      label: "Interaction event log",
      sub: "Kafka, slot_index on every row",
      kind: "queue",
      x: 440,
      y: 620,
      w: 260,
      detail: {
        what: "The partitioned durable log carrying impression, start, quartile, complete, skip, like and share events, each stamped with the feed slot index.",
        why: "The label a model trains on has to be joined to the ordering the user was actually shown, and slot index is load-bearing: without it exploration impressions are compared against organic ones and every new video looks worse than it is.",
        numbers: [
          "~10 events per impression, ~1T events/day",
          "~150B per event, ~150TB/day",
          "7-day hot retention, ~1PB",
        ],
        breaks:
          "Stream lag starves the online learner of labels while the ranker keeps serving a checkpoint that looks healthy, so the response is to pin the last good checkpoint rather than train on a partial window.",
        choice: {
          pick: "Partitioned durable log, aggregated at the regional edge before shipping",
          instead: "Writing interactions straight into the feature lake or the training store.",
          decider:
            "Volume against fan-out. 1T events/day at ~150B is 150TB/day feeding an online learner, an hourly batch job and analytics off one write. Cross-region cost is dominated by this stream, which is why it is aggregated regionally before it crosses.",
          flips:
            "Products where interaction volume is small enough that a single warehouse write serves every consumer, and a broker is one more thing to operate for no gain.",
        },
      },
    },
    {
      id: "trainer",
      label: "Model training",
      sub: "ranker 5 min, retrieval hourly",
      kind: "service",
      x: 440,
      y: 740,
      w: 260,
      detail: {
        what: "Two paths off one stream: a continuous learner checkpointing the ranker every five minutes, and an hourly batch job rebuilding retrieval embeddings over a 30-day window.",
        why: "The feedback loop closes at retrieval, not at ranking. The ranker only reorders a candidate set it did not choose, so a bad update costs one session's ordering, whereas a bad retrieval update changes what is eligible and is self-reinforcing across every session after it.",
        numbers: [
          "ranker checkpoint every 5 minutes",
          "retrieval rebuilt hourly over 30 days",
          "one anomalous hour is 1/720 of the retrieval signal",
        ],
        breaks:
          "The two layers disagree about what time it is: for an hour after a sound explodes the ranker scores those videos highly and retrieval will not surface them, and the trending channel papers over that rather than fixing it.",
        choice: {
          pick: "Split cadence: ranker online every 5 minutes, retrieval hourly from a 30-day window",
          instead: "One cadence for both, either both hourly or both fully online.",
          decider:
            "The time constant of the loop against the timescale being chased. A trend peaks in 2 to 6 hours so scoring needs sub-hour freshness; taste moves over weeks so the embedding space does not. Hourly over 30 days makes an anomalous hour 1/720 of the signal, where a 5-minute retrieval window makes it essentially all of it.",
          flips:
            "Corpora turning over daily rather than hourly, or retrieval embeddings from a frozen content encoder with no engagement features at all, where there is no loop to damp.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "feed-service",
      label: "swipe: user_id + context",
      animated: true,
      detail: {
        what: "The feed request: user id plus session context, which is time, region, device and what the user did in the last 60 seconds.",
        why: "The user vector is an hour old by design, so within-session reactivity has to arrive as request-time features instead. This is where a run of three skipped cooking videos enters the system.",
        numbers: ["~200k requests/s at peak"],
        breaks:
          "Context features are logged at request time and joined to labels later, so a schema change here silently breaks training joins for everything served during the rollout.",
      },
    },
    {
      id: "e2",
      from: "feed-service",
      to: "embedding-store",
      label: "256-d user vector",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A single key-value read fetching the user's precomputed 256-dimensional embedding.",
        why: "The whole point of the two-tower split is that this is a lookup rather than a forward pass. It has to return inside the 10ms retrieval budget because every channel that follows is keyed on the vector it returns.",
        numbers: ["~1KB per vector", "one read per feed call"],
        breaks:
          "A miss for a brand new user means there is no vector at all, so the call has to fall back to demographic-bucket defaults over an evergreen pool.",
      },
    },
    {
      id: "e3",
      from: "feed-service",
      to: "ann-index",
      label: "ANN top-1000, ~5ms",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The approximate nearest neighbour query: find the video vectors closest to the user vector in 256-dimensional space.",
        why: "This is the hop that replaces fan-out. There is no set of recipients to push a video to, so a user reaches a video by querying an index rather than by having it delivered into a materialised timeline.",
        numbers: ["10B vectors searched", "top-1000 in ~5ms", "trimmed to top-200 by exact distance"],
        breaks:
          "An unavailable shard returns fewer candidates rather than an error, so empty-candidate rate is the leading indicator here, not the error rate.",
      },
    },
    {
      id: "e4",
      from: "feed-service",
      to: "trending",
      label: "top-K region + follows",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Cheap cache reads for regional trending, recent uploads from followed creators, and videos on sounds the user has engaged with.",
        why: "These channels are non-learned on purpose: they still work when the models are stale or unhealthy, which makes them the degraded feed as well as a normal contributor.",
        numbers: ["~50 trending", "~30 from follows", "~20 sound affinity"],
        breaks:
          "This is the only surviving fan-out-shaped path, and letting its quota grow turns a personalised feed into a regional one without anything alarming.",
      },
    },
    {
      id: "e5",
      from: "feed-service",
      to: "explore-pool",
      label: "1 feed slot in 10",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The reserved exploration draw: candidates with under 500 lifetime impressions, sampled against a per-user quota.",
        why: "Reserving the slot at dispatch rather than letting exploration compete on score is what makes the spend a number somebody can cap. It is requested even when the other channels have plenty to offer.",
        numbers: ["10% of slots", "10B exploration impressions/day supplied"],
        breaks:
          "An underspent quota is invisible in engagement metrics, which improve when you explore less, so the alarm has to be on weekly promotions out of the pool.",
      },
    },
    {
      id: "e6",
      from: "ann-index",
      to: "union",
      label: "top-200 exact re-ranked",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The 200 best candidates by exact distance, after over-retrieving 1000 from the quantised codes and re-scoring them against full vectors.",
        why: "Product quantisation costs 5 to 10 points of recall, and over-retrieval is how that is bought back: pull wider than needed from the cheap index, then pay exact distance on a set small enough to afford it.",
        numbers: ["1000 in, 200 out", "full vectors fetched from a separate store"],
        breaks:
          "If the full-vector store is unavailable the re-rank is skipped and quality degrades quietly, because a slightly worse ordering looks identical to a healthy one from outside.",
      },
    },
    {
      id: "e7",
      from: "trending",
      to: "union",
      label: "non-learned candidates",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Trending, follows and sound-affinity candidates joining the same pool as the learned ones.",
        why: "They arrive as peers rather than as a fallback so the ranker gets to judge them on the same features. That is also what makes the degraded path cheap: the pipeline is unchanged, one channel simply stops contributing.",
        numbers: ["~100 of the ~300 candidates"],
        breaks:
          "Trending content is already popular, so it wins the ranker's score comparison structurally and needs the diversity re-rank downstream to stop it dominating every response.",
      },
    },
    {
      id: "e8",
      from: "explore-pool",
      to: "union",
      label: "under-observed candidates",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Videos with almost no engagement history entering the candidate set through their reserved slot.",
        why: "This is the only arrow in the diagram that carries a video the models know nothing about, and it exists because every other route into the feed is gated on evidence a new upload cannot have.",
        numbers: ["~20 per call", "each video runs to a ~400 impression budget"],
        breaks:
          "Their slot position is fixed and slot position affects completion independently of the video, so the impressions this edge delivers are not comparable to organic ones without a position-bias correction.",
      },
    },
    {
      id: "e9",
      from: "union",
      to: "ranker",
      label: "~300 candidates",
      animated: true,
      detail: {
        what: "The deduplicated, safety-filtered candidate set handed to the expensive stage.",
        why: "This number is the budget. Ranking cost is linear in it, so 300 rather than 500 is a capacity decision made in advance, not something tuned by whoever is on call during a latency incident.",
        numbers: ["~300 candidates", "60M candidate-scorings/s at peak"],
        breaks:
          "Nothing downstream can recover a good video the channels failed to surface, so every recall failure upstream becomes permanent here and is unobservable by construction.",
      },
    },
    {
      id: "e10",
      from: "ranker",
      to: "rerank",
      label: "4 head scores per video",
      animated: true,
      detail: {
        what: "Per-candidate predictions for completion, like, share and follow, passed on unblended.",
        why: "Blending is kept out of the model so the weights can be moved by A/B test without a retrain. The model predicts behaviour; the weights encode what the product currently wants to be.",
        numbers: ["4 predictions per candidate", "~300 candidates scored"],
        breaks:
          "Completion is the dominant head and is a function of duration as much as of quality, so leaning on it reshapes the corpus toward shorter videos while every test validates the change.",
      },
    },
    {
      id: "e11",
      from: "rerank",
      to: "client",
      label: "50 ids + prefetch hints",
      animated: true,
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "The feed response: 50 video ids with metadata, manifest URLs and signed first-chunk URLs attached.",
        why: "Returning a batch rather than a video is what makes preload possible at all, and shipping the URLs inside the response removes the manifest round trip that would otherwise sit between the swipe and the first frame.",
        numbers: ["50 ids", "~25 consumed before refetch"],
        breaks:
          "Ids are hydrated at response time, so a video taken down afterwards has already been handed to clients and only the playback-time tombstone catches it.",
      },
    },
    {
      id: "e12",
      from: "client",
      to: "cdn",
      label: "preload next 2-3",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Background range requests for the first segment of the next two or three videos while the current one plays.",
        why: "This edge is the product. Every millisecond of swipe-to-play is spent before the user swipes, on bandwidth they are not using, which is the only way to beat a round trip that is itself longer than the whole latency budget.",
        numbers: ["4-second segments", "first segment only", "depth by network class"],
        breaks:
          "It competes with the currently playing video for bandwidth, so on a weak link aggressive preloading degrades the video the user is actually watching.",
      },
    },
    {
      id: "e13",
      from: "ranker",
      to: "cdn",
      label: "pre-warm rising videos",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      offset: 60,
      detail: {
        what: "A push of first segments to edge POPs in a region as soon as a video starts scoring into the rising bucket.",
        why: "The recommender knows a video is about to be popular before the traffic arrives, which is a signal a purely reactive cache cannot have. Pre-warming turns the first thousand viewers in a region from origin misses into edge hits.",
        numbers: ["one fill per POP", "triggered on score, not on requests"],
        breaks:
          "Pre-warming on a score that later proves wrong fills edges with content nobody watches, so the trigger threshold trades storage at the edge against origin egress spikes.",
      },
    },
    {
      id: "e14",
      from: "client",
      to: "events",
      label: "watch, skip, like, slot",
      dashed: true,
      fromSide: "right",
      toSide: "top",
      detail: {
        what: "Roughly ten fine-grained events per impression: impression, start, quartiles, complete, skip, like, share, each carrying the slot index.",
        why: "This is the only measurement the system has of whether any decision upstream was correct. It is drawn as a control path because it carries no user-visible state, and yet it is what the next five minutes of ranking is built from.",
        numbers: ["~1T events/day", "~150TB/day", "slot_index on every row"],
        breaks:
          "Events are training input rather than user-visible state, so a small replay window is tolerable, but losing slot index makes the whole exploration measurement uncorrectable.",
      },
    },
    {
      id: "e15",
      from: "events",
      to: "trainer",
      label: "labels joined to features",
      dashed: true,
      detail: {
        what: "A streaming consumer joining interaction events against the features logged at request time to emit user, video and label training pairs.",
        why: "A label without the features the model actually saw is untrainable, which is why request-time features are logged rather than recomputed. Recomputing them later would train on a world the model never observed.",
        numbers: ["7-day hot retention", "30-day window for the batch path"],
        breaks:
          "Join lag shows up as model freshness rather than as an error, so the stream lag metric and the model-freshness SLO have to be alarmed as one thing.",
      },
    },
    {
      id: "e16",
      from: "trainer",
      to: "ranker",
      label: "checkpoint every 5 min",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A fresh ranker checkpoint promoted into the serving fleet roughly every five minutes, A/B routed rather than deployed in place.",
        why: "A sound goes from unknown to top-of-region in two to six hours, so the scoring layer needs sub-hour freshness or it misses the event entirely. Routing by traffic share means a bad checkpoint rolls back by moving traffic, not by redeploying.",
        numbers: ["5 minute cadence", "rollback by traffic shift"],
        breaks:
          "Fast updates on data the ranker itself generated is the feedback loop, and it is only safe because the ranker cannot change which candidates are eligible.",
      },
    },
    {
      id: "e17",
      from: "trainer",
      to: "embedding-store",
      label: "hourly, 30-day window",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "The hourly batch rebuild writing 1TB of refreshed user vectors.",
        why: "Slow deliberately. What a user likes moves over weeks, so there is no freshness deadline here, and the slow window is the stability anchor that keeps the retrieval space from drifting toward whatever the system happened to serve this afternoon.",
        numbers: ["1TB rewritten hourly", "30-day training window"],
        breaks:
          "A rebuild that fails silently leaves vectors ageing with no visible symptom until watch rate regresses days later, which is why embedding age is its own alarm.",
      },
    },
    {
      id: "e18",
      from: "trainer",
      to: "ann-index",
      label: "hourly index rebuild",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 150,
      detail: {
        what: "Recomputed video embeddings re-clustered and re-quantised into the IVF-PQ index on the same hourly cadence.",
        why: "IVF-PQ handles streaming inserts badly, so updates are batched into a rebuild. That is the price paid for the 60x memory saving, and it is also what keeps retrieval too slow to chase its own output.",
        numbers: ["hourly rebuild", "10B vectors re-quantised"],
        breaks:
          "Retrieval is therefore up to an hour stale exactly when trends move fastest, and the trending channel exists to patch that rather than to fix it.",
      },
    },
    {
      id: "e19",
      from: "video-tower",
      to: "ann-index",
      label: "feature-only embedding",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A new video's 256-dimensional vector inserted into the retrieval index at the end of transcode, before it is feed-eligible.",
        why: "This insert is the analogue of fan-out. A new video is written once into the index and every user reaches it by query rather than by delivery, which is why there is no per-follower write anywhere in this design.",
        numbers: ["~100M inserts/day", "no engagement features consumed"],
        breaks:
          "A transcode backlog is therefore an exploration backlog too, since a video cannot enter any channel until its embedding exists.",
      },
    },
    {
      id: "e20",
      from: "video-tower",
      to: "explore-pool",
      label: "admitted if prior clears",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Admission to the exploration pool, ranked by a prior that costs no impressions: creator trailing completion, whether the sound is rising, cluster health, moderation confidence.",
        why: "The quota is oversubscribed four to one, so the door itself has to be rationed. The top quartile by prior enters immediately and the rest drain into the quota overnight when it is underused.",
        numbers: ["top quartile by prior enters immediately", "entry priors capped per creator per day"],
        breaks:
          "A video that clears neither tier is served only to followers and on its sound page, and by construction we cannot tell which of those was a mistake, because detecting it needs the impressions we declined to spend.",
      },
    },
  ],
};
