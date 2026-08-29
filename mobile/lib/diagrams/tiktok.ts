import type { Diagram } from "./types";

export const TIKTOK: Diagram = {
  id: "tiktok",
  title: "TikTok",
  question: "Design TikTok (Short Video)",
  sourceId: "patterns",
  itemId: 28,
  overview: {
    shape:
      "No fan-out anywhere: every swipe is a retrieval query over a 10 billion video corpus, narrowed cheaply to a few hundred, scored expensively down to fifty.",
    forces: [
      {
        constraint: "10B video corpus, but only ~300 candidates can ever be scored per swipe",
        decision: "Retrieval channels narrow 10B to ~300 cheaply, before the expensive Multi-task ranker ever runs",
        lights: ["retrieval-group", "ann-index", "trending", "union"],
      },
      {
        constraint: "~200k feed calls/s peak against a ~10ms retrieval budget per call",
        decision: "A precomputed User embedding store replaces a live per-request forward pass with one KV lookup",
        lights: ["embedding-store", "e2"],
      },
      {
        constraint: "A sub-100ms swipe-to-play target sits below any network round trip",
        decision: "Feed Service returns a batch of 50 ids with signed URLs, and the Client preloads the next 2-3 locally",
        lights: ["rerank", "client", "cdn", "e11", "e12"],
      },
      {
        constraint: "Every stage ranks on observed engagement, so a video with zero impressions has no observations",
        decision: "Union reserves 1 explore slot in 10 for low-impression videos, regardless of predicted score",
        lights: ["union"],
      },
      {
        constraint: "A sound can peak in 2 to 6 hours, but retrieval embeddings only rebuild hourly over a 30-day window",
        decision: "Trending/follows/sound channels inject freshness the learned ANN index cannot see yet",
        lights: ["trending", "e4", "e7"],
      },
    ],
    naive: {
      text: "Score every one of 10 billion videos against the user for each swipe, the direct approach once personalisation is assumed to need the whole catalogue. Even a cheap 100ns dot product per video is 1 second of compute per swipe. At ~200k feed calls/s peak that is 200,000 core-seconds of work every second, computationally impossible at any budget. Push-based fan-out, materialising a personalised timeline per follower the way an older social feed does, fails even earlier. TikTok has no follow graph strong enough to explain most watched videos, since most watch time comes from accounts the viewer never followed. The ANN index and the Union + safety + explore stage replace brute-force scoring with a narrowing funnel. Cheap geometric retrieval takes 10B down to a few hundred, and only that few hundred ever reaches the expensive Multi-task ranker.",
      lights: ["ann-index", "union", "ranker"],
    },
    beats: [
      {
        text: "The Feed Service is a dispatcher rather than a ranker. It assembles context features from the session, time, device and region, and looks up the user's precomputed 256-dimensional vector. It then fires five retrieval channels concurrently: ANN, trending in region, fresh from follows, sound affinity and exploration.",
        lights: ["feed-service", "embedding-store", "e1", "e2"],
      },
      {
        text: "Retrieval is geometric and almost free per candidate. IVF-PQ, an index that groups vectors into cells and compresses each one into a short code, takes 10 billion video vectors to a top-1000. That runs in roughly 5ms against 160GB of quantised codes. Over-retrieval buys back the recall the compression cost, by re-ranking to top-200 against full vectors.",
        lights: ["ann-index", "trending", "e3", "e4", "e6"],
      },
      {
        text: "Ranking is the expensive half and the cost dominator. A multi-task network scores the roughly 300 survivors on completion, like, share and follow, and collapses them into a single number. It then re-ranks for variety, so one creator cannot own three of your next six swipes.",
        lights: ["union", "ranker", "rerank", "e9", "e10"],
      },
      {
        text: "The response is 50 ids carrying manifest and signed first-chunk URLs, because a sub-100ms swipe-to-play target sits below any network round trip. The client plays number one and pulls the first segment of two and three on background bandwidth, so the next swipe resolves locally.",
        lights: ["rerank", "client", "cdn", "e11", "e12"],
      },
      {
        text: "Nothing enters this system on engagement. A new video's embedding is computed from its pixels, audio, sound and creator at the end of transcode, and inserted into the index before it is marked feed-eligible. It then competes for one reserved feed slot in ten. The union stage forces one candidate in ten to be a low-impression video regardless of predicted score. A video ranking has never seen has no observations to rank it on.",
        lights: ["ann-index", "union"],
      },
      {
        text: "The loop closes at two speeds deliberately. Interaction events stream back at about a trillion a day. The ranker checkpoints from them every five minutes so an hour-scale trend is caught, and retrieval embeddings rebuild hourly over 30 days so the model cannot chase its own output.",
        lights: ["events", "trainer", "ranker", "e14", "e15", "e16", "e17"],
      },
    ],
    crux: {
      problem:
        "Every stage of the funnel ranks on observed engagement, so a video with no impressions has no observations for any of them to rank it on.",
      handled:
        "Union reserves one slot in ten specifically for low-impression videos, regardless of predicted score. A brand-new video always gets a chance to be seen and generate the data every later stage needs. At ~100M uploads a day against ~10B daily impressions available to explore with, demand for that slot runs about four to one oversubscribed. Even which low-impression videos fill it is itself a ranking problem, just over a different objective than predicted engagement.",
    },
    numbers: [
      {
        value: "10B videos to ~300 candidates per call",
        explain: "The full narrowing ratio the funnel achieves: five retrieval channels plus deduplication and safety filtering, before the expensive ranker ever sees a candidate.",
      },
      {
        value: "~200k feed calls/s peak, 60M scorings/s",
        explain: "Peak call rate multiplied by ~300 candidates scored per call; this is the number the accelerator fleet is sized against.",
      },
      {
        value: "40B exploration impressions demanded vs 10B supplied",
        explain: "~100M daily uploads each wanting enough impressions to be measurable, against the fixed slice of daily impressions the explore slot can actually supply, a 4:1 shortfall.",
      },
      {
        value: "under 100ms swipe-to-play",
        explain: "Below a typical mobile RTT of 50-150ms on its own, so a swipe can't afford one round trip. The client preloads instead, and the feed arrives as a batch, not a single video.",
      },
    ],
  },
  nodes: [
    {
      id: "retrieval-group",
      kind: "zone",
      label: "Retrieval: 10B to ~300 candidates",
      detail: {
        what: "The three parallel channels that narrow the full video corpus before the ranker ever runs: the learned ANN index, and the non-learned trending/follows/sound channels.",
        why: "Scoring 10 billion videos per swipe is more compute than exists. This boundary is where cost drops from a function of catalogue size to a function of a fixed few hundred. Everything inside it is cheap per video; everything outside it is expensive per video.",
        numbers: [
          { value: "10B videos narrowed to ~300 per call", explain: "The full corpus against what actually reaches the ranker, the ratio that makes serving cost independent of catalogue size." },
          { value: "~5ms ANN plus lookups, under the 10ms retrieval budget", explain: "The combined latency of the retrieval channels, leaving headroom before the ranker's own 30ms stage begins." },
        ],
        breaks: {
          failure: "A channel going quiet inside this boundary is invisible from outside it: the union stage still produces ~300 candidates from the remaining channels.",
          handled: "A dead trending feed or a stale index shows up as a worse feed rather than an error. Channel health has to be monitored directly, rather than inferred from the union's output count.",
        },
      },
    },
    {
      id: "client",
      label: "Client app",
      sub: "plays local, preloads 2-3 ahead",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The app: it plays the current video from local storage while downloading the first segment of the next two or three.",
        why: "A sub-100ms swipe-to-play target is below any network round trip, so the only way a swipe feels instant is for the next video to already be on the device. Preload is therefore an architectural decision, not a client detail.",
        numbers: [
          { value: "under 100ms swipe-to-play target", explain: "Rules out fetching per swipe — a round trip alone can exceed 100ms, so ~50 ids must already sit on the client before the user's thumb moves." },
          { value: "~50 ids per response, refetch near the halfway mark", explain: "The client refetches before it runs out of ids, so it never has to block a swipe on a network round trip." },
          { value: "~40 swipes per session", explain: "The typical session length, which sets how often the 50-id batch is exhausted and refetched." },
        ],
        breaks: {
          failure: "Preloaded videos the user never reaches are wasted bytes on somebody's data plan.",
          handled: "Preload hit ratio and wasted-prefetch bytes are tracked together as one pair of metrics, since either alone hides the actual tradeoff being made.",
        },
        choice: {
          pick: "Adaptive preload depth: 3 ahead at 720p on Wi-Fi, 1 ahead at 480p on metered cellular",
          instead: "A fixed depth of three preloaded videos for everyone.",
          decider:
            "Wasted bytes against start latency. A response carries ~50 ids and a session runs ~40 swipes, so preloading 3 ahead on cellular discards a segment for most videos never reached. Meanwhile 1 ahead on Wi-Fi leaves the 100ms budget unmet on a link with bandwidth to spare.",
          flips:
            "Wi-Fi-only or offline-first products, where bandwidth is effectively free and depth should run as deep as local storage allows.",
        },
      },
    },
    {
      id: "feed-service",
      label: "Feed Service",
      kind: "service",
      col: 1,
      row: 0,
      sub: "context features, 5 channels",
      detail: {
        what: "The regional entry point for a feed call: builds context features, fetches the user vector, and dispatches the five retrieval channels concurrently.",
        why: "Everything downstream is a store or a model, so one tier has to own the request budget of about 10ms for retrieval and 30ms for ranking. The channels run in parallel, because five sequential calls would spend the entire budget on network waits.",
        numbers: [
          { value: "~46k feed calls/s average, ~200k/s peak", explain: "The call rate this tier is sized against, driven directly by how many impressions each call carries." },
          { value: "~25 impressions consumed per call", explain: "How far through the 50-id batch a typical session gets before refetching." },
          { value: "50 ids per response", explain: "The batch size returned per call, chosen to comfortably outlast the ~25 impressions typically consumed before a refetch." },
        ],
        breaks: {
          failure: "It is the single point of feed availability, so a recommender outage anywhere behind it threatens the whole feed.",
          handled: "When the recommender is unhealthy, the service degrades to trending plus follows plus a per-user candidate cache, rather than returning an empty feed.",
        },
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
      kind: "database",
      col: 1,
      row: 1,
      parent: "retrieval-group",
      sub: "1TB of vectors, hourly refresh",
      detail: {
        what: "A key-value store holding one 256-dimensional float vector per user, rebuilt hourly in batch from a 30-day interaction window.",
        why: "The two-tower model is deliberately asymmetric so the expensive half runs offline. Serving needs only a lookup, keeping a 200k-calls-per-second tier off training hardware and making the user vector a stable anchor rather than something that lurches mid-session.",
        numbers: [
          { value: "1B users x 256 dims x 4B = ~1TB", explain: "Small enough to make a live per-request lookup trivial — running the user tower per request instead would need inference at 200k calls/s inside the 10ms retrieval budget." },
          { value: "refreshed once an hour", explain: "The batch cadence, chosen because taste shifts over weeks rather than minutes." },
          { value: "one read per feed call", explain: "The cost this store adds to a feed call: a single key-value lookup, not a model inference." },
        ],
        breaks: {
          failure: "Embedding age is invisible in engagement metrics until watch rate regresses days later.",
          handled: "The store carries its own freshness alarm, separate from the ranker's, so a stalled rebuild is caught before it shows up as a silent quality regression.",
        },
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
      col: 2,
      row: 1,
      parent: "retrieval-group",
      detail: {
        what: "The learned retrieval channel: 10 billion video vectors as product-quantised codes, sharded, with a coarse quantizer routing the user vector to the relevant cells.",
        why: "Scoring 10 billion candidates with the ranker is more compute than exists, so the corpus has to be narrowed by arithmetic that costs almost nothing per candidate. This index is what makes serving cost independent of catalogue size. Vectors are computed offline by a two-tower video encoder over creator, hashtags, sound, sampled frames and audio. One pass runs per video at end of transcode, inserted before the video is feed-eligible. The encoder consumes no engagement features on purpose, so a video with zero views already has plausible neighbours instead of a cold-start branch bolted on the side.",
        numbers: [
          { value: "10B vectors at ~16B per PQ code = ~160GB", explain: "The compressed index size, small enough to fit across a modest shard fleet." },
          { value: "top-1000 in ~5ms", explain: "Leaves headroom inside the 10ms retrieval budget for the second, exact re-rank pass to top-200 that buys back precision lost to PQ compression." },
          { value: "re-ranked to top-200 against full vectors", explain: "The second, exact pass that recovers precision the compression cost, on a set small enough to afford it." },
          { value: "~100M video embeddings inserted/day, feature-only", explain: "The daily insertion rate matching upload volume; every embedding is computed from content alone, with no engagement signal." },
        ],
        breaks: {
          failure: "Retrieval failures are silent. Anything this index does not surface is never scored, never served and never measured.",
          handled: "You only observe the quality of what you served, so recall is tracked through offline evaluation against held-out interactions rather than inferred from production metrics alone.",
        },
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
      kind: "database",
      col: 3,
      row: 1,
      parent: "retrieval-group",
      sub: "Redis top-K, non-learned",
      label: "Trending/follows/sound",
      detail: {
        what: "The non-learned channels: cached top-K by recent engagement per region, plus recent uploads from followed creators and videos using sounds the user has engaged with.",
        why: "Retrieval embeddings are up to an hour stale and a sound goes from unknown to top-of-region in two to six hours. During exactly the events that matter most, the learned path cannot see the content, so these channels inject it through a path that needs no training.",
        numbers: [
          { value: "~50 candidates from trending", explain: "With the ~30 from follows and ~20 from sound affinity below, these three non-learned channels supply roughly a third of the ~300-candidate pool the ranker sees." },
          { value: "~30 from follows", explain: "Recent uploads from creators the user follows, a small fraction of the total pool despite being the classic social-feed source." },
          { value: "~20 from sound affinity", explain: "Videos using sounds the user has previously engaged with, a signal the learned index cannot yet reflect for a sound that just went viral." },
        ],
        breaks: {
          failure: "This is a patch over stale retrieval rather than a fix.",
          handled: "If the hourly rebuild slips, this channel quietly becomes most of the feed, and every user in a region converges on the same videos. Rebuild lag is monitored directly to catch this.",
        },
        choice: {
          pick: "Redis top-K per region, recomputed continuously",
          instead: "Letting the learned retrieval path surface trends on its own.",
          decider:
            "Time constants. A trend peaks in 2 to 6 hours while retrieval rebuilds hourly over a 30-day window. A video that exploded 40 minutes ago still sits where the corpus put it. A cheap non-learned channel closes that gap without making retrieval fast enough to destabilise the feedback loop.",
          flips:
            "Catalogues that turn over daily rather than hourly, such as long-form video or a music library. There the learned path is fresh enough, and a second channel is pure operational cost.",
        },
      },
    },
    {
      id: "union",
      kind: "service",
      col: 2,
      row: 2,
      sub: "~300 survive; 1 slot in 10 explores",
      label: "Union + safety + explore",
      detail: {
        what: "Merges the five channels, drops duplicates, applies moderation, region and block-list filters before anything is scored. It reserves 1 of every 10 surviving slots for low-impression videos regardless of predicted score.",
        why: "The channels overlap heavily and the filters here are set lookups, while the stage immediately after is the most expensive tier in the system. Filtering first guarantees no accelerator time is spent on a candidate that could not have been served. The reserved explore slot stops the corpus freezing on yesterday's winners. Every other stage ranks on observed engagement, and a video nobody has seen has no observations for any of them to use.",
        numbers: [
          { value: "5 channels merged", explain: "ANN, trending, follows, sound affinity and exploration, all combined into one candidate pool before ranking." },
          { value: "~300 candidates out", explain: "×~200k feed calls/s peak ≈ 60M scorings/s — this number alone sizes the ranker's accelerator fleet, not catalogue size or channel count." },
          { value: "1 explore slot in every 10", explain: "The reserved fraction of output slots that go to low-impression videos regardless of their predicted score." },
          { value: "~40B exploration impressions demanded vs ~10B supplied", explain: "~100M daily uploads each wanting enough impressions to be measurable, against the fixed slice of daily impressions actually available for exploration." },
        ],
        breaks: {
          failure: "A takedown landing between ranking and playback still slips through.",
          handled: "Hydration repeats a tombstone check for ids already handed to a client, so a video removed after scoring is still caught before it plays.",
        },
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
      col: 1,
      row: 2,
      detail: {
        what: "A multi-task network with sparse embedding tables scoring each candidate for completion, like, share, comment and follow in one forward pass.",
        why: "Retrieval knows what resembles what you watched before and has no notion of what you will actually finish. That prediction is what the expensive stage buys, and it is affordable only because retrieval already bounded the work at a few hundred candidates.",
        numbers: [
          { value: "~300 candidates in ~30ms", explain: "The candidate count and latency budget this stage operates under, the largest single cost in the request path." },
          { value: "60M candidate-scorings/s at peak", explain: "Peak feed calls times candidates per call, the load figure the accelerator fleet is provisioned for." },
          { value: "~150k scorings/s per accelerator, ~400 to 600 accelerators", explain: "Per-unit throughput and the resulting fleet size needed to sustain peak scoring load." },
        ],
        breaks: {
          failure: "It is the cost dominator, so any inference latency spike is a direct product regression.",
          handled: "Candidate-set size is treated as a fixed budget line rather than a tuning knob, so the fleet is sized against a known worst case instead of reacting after the fact.",
        },
        choice: {
          pick: "One multi-task model with four heads on an accelerator fleet",
          instead: "A model per objective, or a gradient-boosted tree over dense features.",
          decider:
            "Serving cost is linear in candidates times models. At 60M candidate-scorings/s a shared trunk with four heads costs ~400 to 600 accelerators. Four separate models multiply that by four for predictions that share nearly all of their features anyway.",
          flips:
            "When one objective needs a wildly different feature set or update cadence from the rest, at which point the shared trunk is a coupling you pay for on every deploy.",
        },
      },
    },
    {
      id: "rerank",
      sub: "top 50 ids + prefetch hints",
      kind: "service",
      col: 0,
      row: 1,
      label: "Re-rank + hydrate",
      detail: {
        what: "Collapses the four predictions into one score with A/B-tuned weights, penalises repeated creators and topics, then hydrates the top 50 with manifest and signed first-chunk URLs.",
        why: "A pure score ordering puts the same creator in three of six swipes, which reads as a broken feed even when every individual prediction was correct. Hydration lives here so the response carries everything playback needs without a second round trip.",
        numbers: [
          { value: "top 50 returned", explain: "The final batch size handed back to the client, enough to cover a typical session between refetches." },
          { value: "prefetch hints for the next 2 to 3", explain: "Additional metadata the client uses to decide preload depth for the immediately upcoming videos." },
          { value: "4 head scores blended by A/B-tuned weights", explain: "The completion, like, share and follow predictions, combined into one ranking number by weights the product team can move independently of the model." },
        ],
        breaks: {
          failure: "The blend weights are where product policy hides.",
          handled: "A weight change that reshapes the corpus can pass every A/B test, since the test metric is the same quantity the weights optimise. Weight changes get separate scrutiny from model changes.",
        },
        choice: {
          pick: "Embed manifest URL and a signed first-chunk URL in the feed response",
          instead: "Return ids only and let the client resolve each manifest on demand.",
          decider:
            "Round trips inside a 100ms budget. An id-only response costs a manifest fetch before the first byte of video, which on mobile alone exceeds the swipe-to-play target. The client also cannot preload two ahead when it does not yet know their URLs.",
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
      col: 0,
      row: 2,
      detail: {
        what: "Edge points of presence serving the HLS segments the client plays and preloads.",
        why: "At 100B impressions a day and roughly 2MB actually watched per impression, egress is about 2.3TB/s. An edge hit ratio above 95% is what keeps origin egress near 100GB/s, and preload only works if the segment is one short hop away.",
        numbers: [
          { value: "~200PB/day egress", explain: "Total edge bandwidth served to clients, the scale that makes CDN cost the dominant infrastructure line." },
          { value: ">95% edge hit ratio", explain: "The target fraction of requests served without touching origin, which keeps origin traffic to a manageable ~100GB/s." },
          { value: "origin sees one fetch per POP per object", explain: "The collapse ratio a well-warmed edge achieves, regardless of how many clients in that region request the same segment." },
        ],
        breaks: {
          failure: "A cold POP turns a preload into a full origin round trip, exactly the case the 100ms budget cannot absorb.",
          handled: "Rising videos are pushed to edges ahead of the demand curve, so the first viewers in a region hit a warm POP rather than triggering the cold-start round trip.",
        },
      },
    },
    {
      id: "events",
      label: "Interaction event log",
      sub: "Kafka, slot_index on every row",
      kind: "queue",
      col: 3,
      row: 2,
      detail: {
        what: "The partitioned durable log carrying impression, start, quartile, complete, skip, like and share events, each stamped with the feed slot index.",
        why: "The label a model trains on has to be joined to the ordering the user was actually shown, and slot index is load-bearing. Without it, exploration impressions are compared against organic ones and every new video looks worse than it is.",
        numbers: [
          { value: "~10 events per impression, ~1T events/day", explain: "The fine-grained event volume this log carries, an order of magnitude above raw impression count." },
          { value: "~150B per event, ~150TB/day", explain: "Per-event size multiplied by daily volume, the raw ingestion rate this log absorbs." },
          { value: "7-day hot retention, ~1PB", explain: "How long events stay quickly accessible before ageing out to colder storage." },
        ],
        breaks: {
          failure: "Stream lag starves the online learner of labels while the ranker keeps serving a checkpoint that looks healthy.",
          handled: "The response is to pin the last good checkpoint rather than train on a partial window, so a lagging stream degrades freshness rather than model quality.",
        },
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
      col: 3,
      row: 3,
      detail: {
        what: "Two paths off one stream: a continuous learner checkpointing the ranker every five minutes, and an hourly batch job rebuilding retrieval embeddings over a 30-day window.",
        why: "The feedback loop closes at retrieval, not at ranking. The ranker only reorders a candidate set it did not choose, so a bad update costs one session's ordering. A bad retrieval update changes what is eligible and is self-reinforcing across every session after it.",
        numbers: [
          { value: "ranker checkpoint every 5 minutes", explain: "The online-learning cadence, fast enough to catch an hour-scale trend before it peaks." },
          { value: "retrieval rebuilt hourly over 30 days", explain: "The batch cadence for the slower-moving embedding space, deliberately much slower than ranking." },
          { value: "one anomalous hour is 1/720 of the retrieval signal", explain: "A 30-day window at hourly granularity dilutes any single unusual hour to a small fraction of the total signal, damping the feedback loop." },
        ],
        breaks: {
          failure: "The two layers disagree about what time it is: for an hour after a sound explodes, the ranker scores those videos highly but retrieval will not surface them.",
          handled: "The trending channel papers over this gap without fixing it, an accepted limitation rather than a solved one. Making retrieval fast enough to close it would destabilise the feedback loop.",
        },
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
      tier: "hot",
      step: 1,
      label: "swipe: user_id + context",
      detail: {
        what: "The feed request: user id plus session context, which is time, region, device and what the user did in the last 60 seconds.",
        why: "The user vector is an hour old by design, so within-session reactivity has to arrive as request-time features instead. This is where a run of three skipped cooking videos enters the system.",
        numbers: [{ value: "~200k requests/s at peak", explain: "The peak call rate this endpoint absorbs, matching the Feed Service's own peak capacity." }],
        breaks: {
          failure: "Context features are logged at request time and joined to labels later.",
          handled: "A schema change here can silently break training joins for everything served during a rollout. Context-feature schema changes go through the same review as model changes.",
        },
      },
    },
    {
      id: "e2",
      from: "feed-service",
      to: "embedding-store",
      tier: "hot",
      step: 2,
      label: "256-d user vector",
      detail: {
        what: "A single key-value read fetching the user's precomputed 256-dimensional embedding.",
        why: "The whole point of the two-tower split is that this is a lookup rather than a forward pass. It has to return inside the 10ms retrieval budget, because every channel that follows is keyed on the vector it returns.",
        numbers: [
          { value: "~1KB per vector", explain: "The size of the value fetched on this read, small enough to be cheap even at 200k reads/s." },
          { value: "one read per feed call", explain: "This lookup happens exactly once per call, not once per candidate, keeping its cost fixed regardless of retrieval fan-out." },
        ],
        breaks: {
          failure: "A miss for a brand new user means there is no vector at all.",
          handled: "The call falls back to demographic-bucket defaults over an evergreen pool, so a new user still gets a reasonable feed before their own vector exists.",
        },
      },
    },
    {
      id: "e3",
      from: "feed-service",
      to: "ann-index",
      tier: "hot",
      step: 3,
      label: "ANN top-1000, ~5ms",
      detail: {
        what: "The approximate nearest neighbour query: find the video vectors closest to the user vector in 256-dimensional space.",
        why: "This is the hop that replaces fan-out. There is no set of recipients to push a video to. A user reaches a video by querying an index, rather than by having it delivered into a materialised timeline.",
        numbers: [
          { value: "10B vectors searched", explain: "The full corpus this single query scans against, made affordable only by the quantised index structure." },
          { value: "top-1000 in ~5ms", explain: "Well inside the 10ms retrieval budget, leaving room for the exact re-rank to top-200 that follows on the next hop." },
          { value: "trimmed to top-200 by exact distance", explain: "The subsequent re-ranking step that recovers the precision lost to quantisation." },
        ],
        breaks: {
          failure: "An unavailable shard returns fewer candidates rather than an error.",
          handled: "Empty-candidate rate is monitored as the leading indicator here, not error rate, since a partial index failure degrades quietly rather than loudly.",
        },
      },
    },
    {
      id: "e4",
      from: "feed-service",
      to: "trending",
      tier: "data",
      label: "top-K region + follows",
      detail: {
        what: "Cheap cache reads for regional trending, recent uploads from followed creators, and videos on sounds the user has engaged with.",
        why: "These channels are non-learned on purpose: they still work when the models are stale or unhealthy, which makes them the degraded feed as well as a normal contributor.",
        numbers: [
          { value: "~50 trending", explain: "Cached regional top-K by recent engagement, refreshed continuously rather than computed per request." },
          { value: "~30 from follows", explain: "Recent uploads from creators the user follows, the one channel with a classic social-feed shape." },
          { value: "~20 sound affinity", explain: "Videos using sounds the user has previously engaged with, a signal independent of the ANN index." },
        ],
        breaks: {
          failure: "This is the only surviving fan-out-shaped path in the whole design.",
          handled: "Letting its quota grow unchecked would turn a personalised feed into a regional one without anything alarming, so the channel's candidate quota is capped rather than left to expand freely.",
        },
      },
    },
    {
      id: "e6",
      from: "ann-index",
      to: "union",
      tier: "hot",
      step: 4,
      label: "top-200 exact re-ranked",
      detail: {
        what: "The 200 best candidates by exact distance, after over-retrieving 1000 from the quantised codes and re-scoring them against full vectors.",
        why: "Product quantisation costs 5 to 10 points of recall, and over-retrieval is how that is bought back. Pull wider than needed from the cheap index, then pay exact distance on a set small enough to afford it.",
        numbers: [
          { value: "1000 in, 200 out", explain: "The over-retrieval ratio: five times as many candidates pulled as ultimately survive the exact re-ranking pass." },
          { value: "200 full vectors fetched from a separate store", explain: "The exact re-ranking pass requires the uncompressed vector, fetched separately from the quantised index used for the first pass." },
        ],
        breaks: {
          failure: "If the full-vector store is unavailable the re-rank is skipped and quality degrades quietly.",
          handled: "A slightly worse ordering looks identical to a healthy one from outside, which is why full-vector store availability is tracked as its own alarm rather than inferred from user-facing metrics.",
        },
      },
    },
    {
      id: "e7",
      from: "trending",
      to: "union",
      tier: "data",
      label: "non-learned candidates",
      detail: {
        what: "Trending, follows and sound-affinity candidates joining the same pool as the learned ones.",
        why: "They arrive as peers rather than as a fallback so the ranker gets to judge them on the same features. That is also what makes the degraded path cheap: the pipeline is unchanged, one channel simply stops contributing.",
        numbers: [{ value: "~100 of the ~300 candidates", explain: "The combined share of the final candidate pool these non-learned channels typically contribute." }],
        breaks: {
          failure: "Trending content is already popular, so it wins the ranker's score comparison structurally.",
          handled: "The diversity re-rank downstream is what stops trending content dominating every response, rather than trying to suppress it at this stage.",
        },
      },
    },
    {
      id: "e9",
      from: "union",
      to: "ranker",
      tier: "hot",
      step: 5,
      label: "~300 candidates",
      detail: {
        what: "The deduplicated, safety-filtered candidate set handed to the expensive stage.",
        why: "This number is the budget. Ranking cost is linear in it, so 300 rather than 500 is a capacity decision made in advance, not something tuned by whoever is on call during a latency incident.",
        numbers: [
          { value: "~300 candidates", explain: "The fixed pool size ranking is sized against, a capacity decision rather than an incident-time tuning knob." },
          { value: "60M candidate-scorings/s at peak", explain: "Peak call rate times pool size, the load figure that determines accelerator fleet size." },
        ],
        breaks: {
          failure: "Nothing downstream can recover a good video the channels failed to surface.",
          handled: "Every recall failure upstream becomes permanent here and is unobservable by construction, which is why retrieval recall is measured offline rather than assumed from production behaviour.",
        },
      },
    },
    {
      id: "e10",
      from: "ranker",
      to: "rerank",
      tier: "hot",
      step: 6,
      label: "4 head scores per video",
      detail: {
        what: "Per-candidate predictions for completion, like, share and follow, passed on unblended.",
        why: "Blending is kept out of the model so the weights can be moved by A/B test without a retrain. The model predicts behaviour; the weights encode what the product currently wants to be.",
        numbers: [
          { value: "4 predictions per candidate", explain: "One score per objective, kept separate rather than pre-combined so downstream weighting can change independently of the model." },
          { value: "~300 candidates scored", explain: "The full pool from the previous stage, each carrying all four predictions." },
        ],
        breaks: {
          failure: "Completion is the dominant head and is a function of duration as much as of quality.",
          handled: "Leaning on it reshapes the corpus toward shorter videos while every A/B test still validates the change, which is an accepted tradeoff monitored by tracking corpus duration distribution separately.",
        },
      },
    },
    {
      id: "e11",
      from: "rerank",
      to: "client",
      tier: "hot",
      step: 7,
      label: "50 ids + prefetch hints",
      offset: 90,
      detail: {
        what: "The feed response: 50 video ids with metadata, manifest URLs and signed first-chunk URLs attached.",
        why: "Returning a batch rather than a video is what makes preload possible at all. Shipping the URLs inside the response also removes the manifest round trip that would otherwise sit between the swipe and the first frame.",
        numbers: [
          { value: "50 ids", explain: "The batch size, chosen to outlast a typical session's ~25 consumed impressions before refetch." },
          { value: "~25 consumed before refetch", explain: "The typical point in the batch where the client triggers its next call, well before running out." },
        ],
        breaks: {
          failure: "Ids are hydrated at response time, so a video taken down afterwards has already been handed to clients.",
          handled: "A playback-time tombstone check is the only backstop against this. It catches a video pulled down after hydration, since the response itself can never be recalled once sent.",
        },
      },
    },
    {
      id: "e12",
      from: "client",
      to: "cdn",
      tier: "hot",
      step: 8,
      label: "preload next 2-3",
      detail: {
        what: "Background range requests for the first segment of the next two or three videos while the current one plays.",
        why: "This edge is the product. Every millisecond of swipe-to-play is spent before the user swipes, on bandwidth they are not using. That is the only way to beat a round trip longer than the whole latency budget.",
        numbers: [
          { value: "4-second segments", explain: "The chunk size fetched for preload, small enough to fetch quickly without wasting bandwidth on unwatched content." },
          { value: "1 segment fetched, not the whole file", explain: "Only the first segment is preloaded, so a skipped video wastes minimal bandwidth." },
          { value: "1 to 3 ahead depending on network class", explain: "Preload depth adapts to the connection, trading start latency against wasted bytes." },
        ],
        breaks: {
          failure: "Preload competes with the currently playing video for bandwidth.",
          handled: "On a weak link, aggressive preloading degrades the video the user is actually watching, which is why preload depth adapts down on constrained connections rather than staying fixed.",
        },
      },
    },
    {
      id: "e13",
      from: "ranker",
      to: "cdn",
      tier: "control",
      label: "pre-warm rising videos",
      offset: 60,
      detail: {
        what: "A push of first segments to edge POPs in a region as soon as a video starts scoring into the rising bucket.",
        why: "The recommender knows a video is about to be popular before the traffic arrives, a signal a purely reactive cache cannot have. Pre-warming turns the first thousand viewers in a region from origin misses into edge hits.",
        numbers: [
          { value: "one fill per POP", explain: "The push happens once per point of presence, not once per expected viewer, keeping the cost of pre-warming bounded." },
          { value: "triggered once score crosses the rising threshold", explain: "The trigger condition: a video's predicted trajectory, not its current traffic, decides when to pre-warm." },
        ],
        breaks: {
          failure: "Pre-warming on a score that later proves wrong fills edges with content nobody watches.",
          handled: "The trigger threshold is tuned to trade edge storage against origin egress spikes, accepting some wasted pre-warms as the cost of catching the real ones early.",
        },
      },
    },
    {
      id: "e14",
      from: "client",
      to: "events",
      tier: "control",
      label: "watch, skip, like, slot",
      detail: {
        what: "Roughly ten fine-grained events per impression: impression, start, quartiles, complete, skip, like, share, each carrying the slot index.",
        why: "This is the only measurement the system has of whether any decision upstream was correct. It is a control path because it carries no user-visible state, and yet it is what the next five minutes of ranking is built from.",
        numbers: [
          { value: "~1T events/day", explain: "The daily event volume this path carries, an order of magnitude above raw impression count." },
          { value: "~150TB/day", explain: "The raw bytes this event stream produces, the ingestion load the log has to absorb." },
          { value: "slot_index stamped once per row", explain: "Every event carries the position it was shown at, without which exploration impressions cannot be fairly compared to organic ones." },
        ],
        breaks: {
          failure: "Events are training input rather than user-visible state, so a small replay window is tolerable.",
          handled: "Losing slot index specifically makes the whole exploration measurement uncorrectable, which is why it is treated as a required field rather than an optional enrichment.",
        },
      },
    },
    {
      id: "e15",
      from: "events",
      to: "trainer",
      tier: "control",
      label: "labels joined to features",
      detail: {
        what: "A streaming consumer joining interaction events against the features logged at request time to emit user, video and label training pairs.",
        why: "A label without the features the model actually saw is untrainable, which is why request-time features are logged rather than recomputed. Recomputing them later would train on a world the model never observed.",
        numbers: [
          { value: "7-day hot retention", explain: "How long raw events stay available for this join before ageing to colder storage." },
          { value: "30-day window for the batch path", explain: "The longer window the hourly retrieval rebuild draws from, separate from the fast online join." },
        ],
        breaks: {
          failure: "Join lag shows up as model freshness rather than as an error.",
          handled: "The stream lag metric and the model-freshness SLO are alarmed as one combined signal, so a silent join delay is caught before it degrades ranking quality.",
        },
      },
    },
    {
      id: "e16",
      from: "trainer",
      to: "ranker",
      tier: "control",
      label: "checkpoint every 5 min",
      detail: {
        what: "A fresh ranker checkpoint promoted into the serving fleet roughly every five minutes, A/B routed rather than deployed in place.",
        why: "A sound goes from unknown to top-of-region in two to six hours, so the scoring layer needs sub-hour freshness or it misses the event entirely. Routing by traffic share means a bad checkpoint rolls back by moving traffic, not by redeploying.",
        numbers: [
          { value: "5 minute cadence", explain: "How often a new checkpoint is available for promotion into the serving fleet." },
          { value: "rollback is a single traffic-routing change, not a redeploy", explain: "A bad checkpoint is undone by shifting traffic share back to the previous one, far faster than a full redeploy." },
        ],
        breaks: {
          failure: "Fast updates on data the ranker itself generated is the feedback loop.",
          handled: "This is only safe because the ranker cannot change which candidates are eligible, only how they are ordered, so a runaway feedback loop cannot expand beyond retrieval's boundaries.",
        },
      },
    },
    {
      id: "e17",
      to: "retrieval-group",
      label: "hourly: embeddings + index",
      from: "trainer",
      tier: "control",
      offset: 90,
      detail: {
        what: "The hourly batch rebuild writing 1TB of refreshed user vectors.",
        why: "Slow deliberately. What a user likes moves over weeks, so there is no freshness deadline here. The slow window is the stability anchor that keeps the retrieval space from drifting toward whatever the system happened to serve this afternoon.",
        numbers: [
          { value: "1TB rewritten hourly", explain: "The full size of the user embedding store, rebuilt from scratch each cycle rather than updated incrementally." },
          { value: "30-day training window", explain: "The lookback window this rebuild draws from, long enough to damp any single anomalous hour to a small fraction of the signal." },
        ],
        breaks: {
          failure: "A rebuild that fails silently leaves vectors ageing with no visible symptom until watch rate regresses days later.",
          handled: "Embedding age is its own alarm, tracked independently of engagement metrics, so a stalled rebuild is caught before it becomes a delayed quality regression.",
        },
      },
    },
  ],
  figures: {
    "embedding-seed": {
      title: "Content-seeded embeddings exist before any views",
      nodes: [
        { id: "zero-impressions", label: "New video: 0 impressions", kind: "external", col: 0, row: 0 },
        {
          id: "unreachable",
          label: "No embedding",
          sub: "unreachable forever",
          kind: "external",
          col: 0,
          row: 1,
          detail: {
            what: "The dead end an engagement-seeded embedding leaves a brand-new video in, with no observed behaviour to derive a starting position from.",
            why: "Retrieval searches by embedding proximity, so a video with no embedding cannot be found by that channel at all, ever, regardless of how good it is.",
          },
        },
        { id: "content-features", label: "Pixels, audio, creator", kind: "blob", col: 1, row: 0 },
        {
          id: "real-position",
          label: "Real position",
          sub: "zero views needed",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "An embedding derived only from the video's own content and creator features, computed the moment transcoding finishes.",
            why: "This is a prior about what the video resembles, not a measurement of whether it's good, so it competes for the explicit exploration quota next rather than being trusted outright.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "zero-impressions", to: "unreachable", tier: "control", label: "no signal to seed from" },
        { id: "e2", from: "content-features", to: "real-position", tier: "hot", step: 1, label: "exists at transcode time" },
      ],
    },
  },
};
