import type { Diagram } from "./types";

export const SPOTIFY: Diagram = {
  id: "spotify",
  title: "Spotify",
  question: "Design Spotify (Music Streaming + Recommendations)",
  sourceId: "patterns",
  itemId: 40,
  overview: {
    shape:
      "Three businesses behind one front door: a distributor whose objects are so small the popular catalogue fits at the edge, a recommender whose customers mostly want to hear things they have already heard, and an accounting firm that has to prove the count years later.",
    beats: [
      "Delivery collapses because the objects are tiny. A four-minute track at 160kbps is 4.8MB, so you pick a rung once at track start, fetch the object whole, and prefetch the entire next track 20 seconds before the current one ends. On a 5Mbps link the file has landed inside the first 3% of playback, which leaves mid-track adaptation nothing to adapt.",
      "Edge residency is a decision rather than a forecast. Two rungs of the top 10M tracks is 144TB, one storage node, covering ~90% of plays, and pre-pushing a new release to every edge is 17MB across the three lossy rungs. The device is then the highest-hit-rate tier of all: 4GB of spare phone storage holds ~830 tracks, which is most of a heavy listener's rotation.",
      "The recommender is the strange half, because four plays in five are repeats. That inverts the machinery: the exclusion filter becomes the candidate pool. The queue service ranks the listener's own library, playlists and follows, under 10,000 rows for the large majority, with a scan and a scoring function rather than an index, which is what keeps this tier at a few hundred hosts instead of a few thousand.",
      "The funnel everyone draws decides under a fifth of the plays. It runs weekly and offline: collaborative filtering, an audio encoder that gives the 60k daily uploads a vector on the day they land, and a text model for cultural context, merging into ~500 candidates, a deep ranker, diversification, and 30 tracks written per listener into a key-value cache.",
      "Labels invert with the product too. A familiar track completes at over 95% and 80% of impressions are familiar, so completion mostly measures familiarity that history already tells you for free. The negative becomes a skip inside 30 seconds, which is the royalty threshold and therefore already computed, and the positive becomes a repeat play within 7 days.",
      "Money is a third consumer of the same events. Every event carries its own played_at, the archive is columnar and immutable, and the payable ledger is a deterministic batch over it, deduplicated on (user_id, track_id, play_start_ts). The streaming aggregate exists, is at-least-once, feeds artist dashboards, and pays nobody.",
    ],
    crux:
      "Every measurable signal prefers familiarity. A track the listener already loves completes at over 95%, is almost never skipped, and lifts every metric readable inside a two-week experiment; an unfamiliar one completes at roughly 60% and is skipped inside 30 seconds about a third of the time. The cost of novelty lands inside the experiment window and its benefit lands outside it, so the exploration rate is held as a policy constant of 15 to 20% rather than tuned, which is an honest admission that no experiment anyone can afford will settle it.",
    numbers: [
      "~8.4B plays/day, ~18B events/day, ~500k/s peak",
      "144TB pinned per edge against ~4.4PB at origin",
      "~81% of plays are repeats; candidate set under 10,000 tracks",
    ],
  },
  nodes: [
    {
      id: "ledger-group",
      label: "The ledger: batch, not stream",
      kind: "zone",
      detail: {
        what: "The money path: an immutable columnar archive and the deterministic batch that turns it into statement rows.",
        why: "This half of the system has a failure tolerance nothing else here shares. Playback may drop an event and nobody notices, recommendation may drop a thousand, and the ledger may not drop one and must be able to prove that in an audit years later.",
        numbers: ["~1PB over a 7-year audit window", "ledger rerun diff SLO exactly zero"],
        breaks:
          "Determinism is a property of the inputs, not the code. A rate table updated in place or a rights correction that overwrites history makes every future rerun disagree with what was paid.",
      },
    },
    {
      id: "client",
      label: "Listener client",
      sub: "whole-object fetch, device cache",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The app that picks a rung at track start, pulls the whole object, prefetches the next track in the queue, and emits the play events.",
        why: "Because objects are small and the same ones recur, the device is the highest-hit-rate tier in the system, so the decisions that remove network work entirely are made here rather than server-side.",
        numbers: [
          "4GB spare holds ~830 tracks at 160kbps",
          "prefetch the whole next track 20s before the end",
          "p99 tap-to-first-audio under 300ms",
        ],
        breaks:
          "Shuffle defeats prefetch. A listener shuffling a 5,000-track playlist turns every track into a network fetch and collapses the device cache hit rate toward zero.",
        choice: {
          pick: "Pick a rung once, fetch the whole object, prefetch the entire next track",
          instead: "HLS or DASH throughout, ~10-second segments, mid-track bitrate switching as video does it.",
          decider:
            "Object size against speculative bandwidth. 4.8MB at 160kbps arrives in under 8 seconds on a 5Mbps link, inside the first 3% of playback, so there is nothing left to adapt. The threshold sits around 25MB.",
          flips:
            "Lossless at ~27MB for four minutes and podcasts at 60MB+, which the same client fetches chunked because the manifest declares delivery mode per object.",
        },
      },
    },
    {
      id: "play-api",
      label: "Play API",
      sub: "catalogue + entitlement per play",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "GET /track/{id}: returns metadata, the entitlement decision for this account, and signed edge URLs for every rung the account may use.",
        why: "Entitlement is per account and changes on billing events while metadata changes on content events, so the decision has to be taken per play rather than baked into a manifest or an edge config that outlives it.",
        numbers: ["one call per track start", "~8.4B plays/day", "rungs, on-demand vs shuffle, offline, skip budget"],
        breaks:
          "This path saturates before the bytes do. Ten million clients calling GET /track inside sixty seconds at a midnight release is an admission-control problem, fixed with a jittered visibility window and an edge-cached catalogue response.",
        choice: {
          pick: "Fail open to the last entitlement cached on the device with a short TTL",
          instead: "Block playback whenever the entitlement service cannot answer.",
          decider:
            "The cost of each error. Briefly serving a 320kbps rung to an account that lapsed an hour ago costs a fraction of a cent; blocking every listener in a region for a 5-minute outage costs the product.",
          flips:
            "Territory and rights restrictions rather than subscription tier, where over-serving is a licensing breach that rights holders audit rather than a rounding error.",
        },
      },
    },
    {
      id: "edge",
      label: "Edge audio cache",
      sub: "top 10M tracks x 2 rungs, 144TB",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "Whole encoded objects pinned at each edge, with a pin API and a pre-push hook wired into the release calendar.",
        why: "The catalogue is small enough that residency stops being a forecasting problem: the two mainstream rungs of the top 10M tracks are one storage node and cover the overwhelming majority of plays, so you choose what to hold rather than predict it.",
        numbers: [
          "10M x 14.4MB = ~144TB pinned per edge",
          "top 1% at two rungs is ~14TB, fits any PoP",
          "a whole new release is ~17MB across three lossy rungs",
          "edge hit ratio SLO above 97% hot, 80% tail",
        ],
        breaks:
          "An unscheduled viral track is a cold miss, but only one per edge per rung, so the herd costs thousands of origin fetches rather than ten million. A scheduled release that misses the pre-push hook is the avoidable version of the same event.",
        choice: {
          pick: "Commercial CDN with an explicit pin API plus release-calendar pre-push",
          instead: "Plain demand-filled LRU edges with no pinning.",
          decider:
            "Pre-pushing an album to every edge is a few hundred megabytes and takes seconds, against ~780GB/s of peak delivery. At that ratio residency is a decision, and LRU would evict the pre-positioned set during the launch it was staged for.",
          flips:
            "The long tail, where pinning all 100M tracks is 1.7PB per edge at the lossy rungs and demand-fill is the only affordable policy.",
        },
      },
    },
    {
      id: "events",
      label: "Play-event log",
      sub: "by user_id, ~500k/s peak",
      kind: "queue",
      col: 0,
      row: 1,
      detail: {
        what: "An append-only partitioned log carrying start at t=0, the qualified marker at 30s, and a terminal event with the stop position.",
        why: "Three consumers with incompatible requirements read the same events: the ledger may not lose one, the training pipeline may lose thousands, and the dashboard wants them now. A shared immutable log lets each pick its own delivery semantics instead of the loosest consumer paying the ledger's correctness cost.",
        numbers: [
          "~18B events/day at ~2.2 per play",
          "~210k/s average, ~500k/s evening peak",
          "~150B per event, ~2.7TB/day raw, ~8TB/day at RF=3",
          "hot for 7 days, then archived",
        ],
        breaks:
          "The schema is now a contract three teams depend on, so a field added for ranking is a field the royalty batch will be asked about in an audit.",
        choice: {
          pick: "Partitioned durable log keyed by user_id, with clients buffering and replaying",
          instead: "A work queue consumed once, or direct writes into the analytics store.",
          decider:
            "Legitimate lateness. Offline licences run 30 days, so a play can arrive four weeks after it happened and every consumer must be able to reread it; a consumed queue offers no replay and a direct write has no second reader.",
          flips:
            "A service with no offline mode and no royalty obligation, where events are pure analytics and losing a percentage of them costs nothing worth a broker.",
        },
      },
    },
    {
      id: "archive",
      label: "Royalty archive",
      sub: "columnar, ~340GB/day, 7 years",
      kind: "database",
      col: 0,
      row: 2,
      parent: "ledger-group",
      detail: {
        what: "The same events in columnar form on object storage, dictionary-encoded on track_id, country and device, kept for the contractual audit window.",
        why: "The payable number is a recomputation, so its input has to be immutable and re-readable years later rather than a checkpoint inside a stream processor that nobody can inspect after the fact.",
        numbers: ["2.7TB/day raw compresses ~8x to ~340GB/day", "~870TB over seven years, call it ~1PB"],
        breaks:
          "Size is not the constraint, determinism is. A schema migration or an in-place rate correction silently changes what a rerun of last March produces, and the rerun diff is how you find out.",
        choice: {
          pick: "Columnar files on object storage, written once and never mutated",
          instead: "Keeping the payable history in a warehouse table that supports updates.",
          decider:
            "Reproducibility over a 7-year window at ~340GB/day. An updatable table cannot prove what it contained on the day a period was paid, and the SLO on the rerun diff is exactly zero, not small.",
          flips:
            "When the audit window is short and corrections are frequent, where the operational convenience of updating a row beats a reprocessing pipeline nobody runs.",
        },
      },
    },
    {
      id: "royalty",
      label: "Royalty batch",
      sub: "event time, 30s rule, dedup key",
      kind: "service",
      col: 1,
      row: 2,
      parent: "ledger-group",
      detail: {
        what: "A nightly and then monthly deterministic batch that applies the 30-second rule on event time, the per-country rate and the fractional split, emitting one statement row per rights holder per period.",
        why: "Payouts are monthly and events are legitimately weeks late, so the ledger is a recomputation rather than a running total. Anything already paid is credited forward with a statement note rather than restated, because rights holders have booked the number.",
        numbers: [
          "dedup on (user_id, track_id, play_start_ts)",
          "30 contiguous seconds qualifies",
          "streams counted per listener per track per day are capped, typically at one",
          "stream-against-batch gap expected under 0.1%",
        ],
        breaks:
          "Fraud, and it is bounded by the client rather than the pipeline. A farm on real accounts with real subscriptions emits events indistinguishable from a listener, so detection is statistical and the fraction paid is unknown by construction.",
        choice: {
          pick: "Deterministic batch over the archive is the ledger; the stream is a provisional dashboard",
          instead: "One exactly-once streaming pipeline whose output is the payable number.",
          decider:
            "30 days of legitimate lateness from offline licences. Holding streaming state open for a month costs more than recomputing the month, and exactly-once inside a processor is not exactly-once from a retrying mobile client, so the dedup key does the real work either way.",
          flips:
            "No offline mode with p99.9 lateness in minutes, or a business that genuinely needs payable numbers hourly. The alternative is also operationally simpler: one pipeline, and no risk of the dashboard and the statement telling an artist two different numbers.",
        },
      },
    },
    {
      id: "queue",
      label: "Queue service",
      sub: "ranks the listener's <10k tracks",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "Builds the next N tracks: scores the listener's own library and playlists, resolves shuffle order server-side, and hydrates precomputed discovery lists.",
        why: "Four plays in five are repeats, so the surface carrying most listening ranks one person's own universe with a scan over recency, lifetime play count, time of day and what is already queued. Saying that out loud is the sizing decision for the whole tier.",
        numbers: [
          "~81% of plays are repeats, ~19% first hears",
          "candidate set under 10,000 tracks for most listeners",
          "a few hundred hosts, not a few thousand",
        ],
        breaks:
          "Shuffle order must be a seeded permutation shipped ahead with the queue, not a draw at play time, or the client has nothing to prefetch and the device cache stops working.",
        choice: {
          pick: "Scan and score the listener's own rows on the request path",
          instead: "Run the retrieval-plus-ranker funnel for every queue request.",
          decider:
            "Candidate-set size. 10^4 rows the listener already owns against 10^8 in the catalogue: the funnel exists to cut 10^8 down, and it earns nothing for the 81% of plays that are repeats.",
          flips:
            "A listener under about 50 plays, who has no history to rank and is served from onboarding picks blended with region and age-band popularity priors.",
        },
      },
    },
    {
      id: "catalogue",
      label: "Catalogue + rights",
      sub: "~450GB, whole replica per region",
      kind: "database",
      col: 3,
      row: 0,
      detail: {
        what: "Track metadata, ISRC codes, per-rung object keys, audio features, and the effective-dated rights map naming holders, roles and shares.",
        why: "It is read on every play and almost entirely cacheable, so a whole replica per region removes a cross-region hop from the play path; and it is the same table the ledger keys on, which is why it is versioned rather than mutable.",
        numbers: [
          "100M tracks x ~1.5KB = ~150GB; RF=3 gives ~450GB",
          "ISRC is the identifier the royalty path keys on",
          "~60k new tracks/day",
        ],
        breaks:
          "Recording ownership is usually clean; composition ownership is asserted by publishers and societies, arrives incomplete and is revised retroactively, so the count is exact and the split is not.",
        choice: {
          pick: "Rights and rate rows are effective-dated and never updated in place",
          instead: "Update the rights map and rate tables in place as corrections arrive.",
          decider:
            "The batch takes the table version as an explicit input, so rerunning last March must use last March's rates. In-place updates make every rerun of a paid period disagree, and the diff SLO is exactly zero.",
          flips:
            "Metadata with no financial consequence, such as artwork or tags, where versioning every correction is storage and ceremony for nothing.",
        },
      },
    },
    {
      id: "origin",
      label: "Audio origin",
      sub: "four rungs per track, ~4.4PB",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "S3-compatible object store holding each track as whole encoded objects at 96, 160 and 320kbps plus lossless.",
        why: "The edge serves the overwhelming majority of plays, so origin is sized from the miss rate rather than the play rate, and it exists to fill edges and to hold the long tail nobody would ever pin.",
        numbers: [
          "44MB per track across four rungs, ~4.4PB total",
          "lossy rungs only are ~1.7PB",
          "~23GB/s at peak, which is 3% of 780GB/s",
        ],
        breaks:
          "Long-tail growth: 60k tracks/day x 44MB is 2.6TB/day, roughly 1PB a year, most of which never plays once.",
        choice: {
          pick: "Encode the 160kbps rung eagerly; transcode the other rungs on first request for tracks with no plays",
          instead: "Encode all four rungs eagerly at upload.",
          decider:
            "2.6TB/day of eager growth against 0.3TB/day, an 8x cut, paid for with a few hundred milliseconds on the very first play of a long-tail track at a non-default rung, which is rare by definition.",
          flips:
            "Anything with a release campaign behind it, where the first play is the one that matters and must not wait on a transcode.",
        },
      },
    },
    {
      id: "library",
      label: "Library + playlists",
      sub: "play_count, last_played_at",
      kind: "database",
      col: 3,
      row: 1,
      detail: {
        what: "Per-listener saved tracks, albums and follows, playlists with fractional position keys, and (track_id, play_count, last_played_at) per listener.",
        why: "This is simultaneously the candidate pool for most plays and the only place the feature that separates 'exhausted' from 'due for revival' lives, because no embedding encodes time-since-last-play crossed with lifetime count.",
        numbers: [
          "under 10,000 tracks for the large majority",
          "a few hundred kilobytes of rows per listener",
        ],
        breaks:
          "Collaborative playlists: two people inserting at the same position at the same time, which fractional keys absorb, and offline edits that arrive against a version that has moved.",
        choice: {
          pick: "Fractional position keys on playlist entries",
          instead: "Integer positions renumbered on every insert.",
          decider:
            "Write amplification and collisions. Inserting at the top of a 10,000-entry playlist renumbers 10,000 rows; a fractional key writes one row, and two collaborators inserting at the same spot get distinct keys with no lock.",
          flips:
            "Short, single-owner lists where renumbering is trivial and integer positions are easier to reason about and to page.",
        },
      },
    },
    {
      id: "labels",
      label: "Label builder",
      sub: "skip<30s negative, repeat-7d +",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "Turns the same play events into training labels on event time: a skip inside 30 seconds is the negative, a repeat play within 7 days is the positive, and completion is recorded but is not the target.",
        why: "When most impressions are familiar, completion measures familiarity rather than satisfaction, and the listener's own history already tells you that for free. The chosen negative is also the royalty threshold, so it is already computed exactly on the money path.",
        numbers: [
          "familiar completes at ~95%, first hear at ~60%",
          "blended completion ~88%, variance almost all in the 20% that are first hears",
          "skip-before-30s base rate ~15%",
        ],
        breaks:
          "Windowing on arrival time. A device offline for three weeks uploads three weeks of listening at once, and an arrival-time window treats it as a single day and distorts the profile badly.",
        choice: {
          pick: "skip-before-30s as the negative, repeat-within-7-days as the positive",
          instead: "Predicted play-completion probability, the objective every video recommender uses.",
          decider:
            "Base rates. Blended completion sits near 88% with 80% of impressions familiar, so a model trained on it mostly learns to predict familiarity; skip-before-30s has a ~15% base rate and costs nothing extra to emit.",
          flips:
            "The discovery surfaces specifically, where every track is unfamiliar by construction, repeat has had no time to happen, and completion is the sharpest signal available. Two objectives on two surfaces is the honest answer.",
        },
      },
    },
    {
      id: "discovery",
      label: "Discovery precompute",
      kind: "service",
      col: 3,
      row: 2,
      sub: "weekly; 30 cached per listener",
      detail: {
        what: "A weekly batch: collaborative-filtering, audio-encoder and text retrieval merge into a ~500-track pool, a deep ranker scores it, diversification spreads genre and freshness, and 30 tracks are written per listener.",
        why: "Three sources because no single one covers every data regime: CF is strongest where a track already has plays, the audio encoder gives a track uploaded four minutes ago a vector at all, and text carries the cultural context neither can see.",
        numbers: [
          "~200 CF + ~150 audio + ~100 text candidates, ~500 after dedup",
          "top 30 per listener per surface",
          "novelty held at 15-20% of impressions as policy",
          "this funnel decides ~19% of plays; the weekly mix about 3%",
        ],
        breaks:
          "A ranker trained on repeat plays converges on a rotation of 40 tracks and every metric inside a two-week experiment agrees with it. The guards are a hard novelty floor no model output may override and a per-track exposure cap, both policy constants.",
        choice: {
          pick: "HNSW over 100M track vectors in RAM, with incremental inserts",
          instead: "A quantised index such as IVF-PQ, and its recall loss.",
          decider:
            "Memory. 100M x 256 dims x float32 is 100GB, ~140GB with graph overhead across 8 shards of ~18GB, which fits in RAM. The fork that binds at 10B vectors and 10TB does not bind two orders of magnitude smaller.",
          flips:
            "A corpus 100x larger, as in the short-video case, where the index no longer fits and quantisation stops being optional. Incremental inserts also matter here: 60k uploads a day must be retrievable within minutes or release radar misses Friday.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "play-api",
      label: "GET /track/{id}",
      dashed: true,
      detail: {
        what: "The control call at track start, asking what this track is and what this account may do with it.",
        why: "Entitlement and metadata are decided per play because they change on different clocks: billing events for one, content events for the other. Neither can be baked into anything the edge caches for a day.",
        numbers: ["one call per track start", "~8.4B/day"],
        breaks:
          "It is the first thing to fall over at a midnight release, when ten million clients make this exact call inside sixty seconds.",
      },
    },
    {
      id: "e2",
      from: "play-api",
      to: "catalogue",
      label: "metadata + rung keys",
      dashed: true,
      detail: {
        what: "Reading the track row: title, artists, duration, ISRC and the object key for each rung.",
        why: "The catalogue is 450GB replicated whole into every region precisely so this read never leaves the region, which is what keeps a play start inside its latency budget.",
        numbers: ["~1.5KB per row", "regional replica, no cross-region hop"],
        breaks:
          "If the lookup is unavailable a play cannot start at all, so the client caches metadata for everything already in its queue for 24 hours and degrades to tracks resident on the device.",
      },
    },
    {
      id: "e3",
      from: "play-api",
      to: "client",
      label: "entitlement + signed URLs",
      dashed: true,
      offset: 40,
      detail: {
        what: "The response: which rungs this account may use, and a signed edge URL for each of them.",
        why: "The client, not the server, picks the rung, because it is the only party that knows its measured throughput and its own cache contents. The server's job is to bound the choice, not to make it.",
        numbers: ["premium unlocks 320kbps and lossless", "one URL per permitted rung"],
        breaks:
          "Signed URLs have to outlive a paused track but not a shared link, so the expiry window is a product decision disguised as a security parameter.",
      },
    },
    {
      id: "e4",
      from: "client",
      to: "edge",
      label: "GET whole object",
      animated: true,
      detail: {
        what: "One HTTP GET for the entire track object, plus a second one 20 seconds before the end for the whole next track in the queue.",
        why: "This single arrow carries the whole delivery argument. Fetching the next track outright means the gap between tracks is zero and the next start does not depend on the network at all.",
        numbers: ["4.8MB at 160kbps, 9.6MB at 320kbps", "prefetch at duration minus 20s"],
        breaks:
          "It is speculative spend. A listener who skips has paid for bytes nobody heard, which is why the argument is about object size and metered data rather than protocol preference.",
      },
    },
    {
      id: "e5",
      from: "edge",
      to: "client",
      label: "4.8MB, first audio ~120ms",
      animated: true,
      offset: 70,
      detail: {
        what: "The object bytes streaming back, with playback starting from the first bytes rather than waiting for the file.",
        why: "The rest of the file lands inside the first 15 seconds of playback, which is why there is no adaptive ladder here: the decision was made and executed inside the first 3% of the track.",
        numbers: ["~390GB/s average egress, ~780GB/s peak", "29M concurrent streams at peak"],
        breaks:
          "On a weak network the client must step down a rung before rebuffering rather than after, since there is no mid-object switch to fall back on.",
      },
    },
    {
      id: "e6",
      from: "origin",
      to: "edge",
      label: "miss fill + release pre-push",
      detail: {
        what: "Origin fetches on a cold miss, and scheduled pre-pushes of new releases before they go live.",
        why: "Origin capacity is sized from this arrow rather than from play volume, and pre-push turns a scheduled launch from a cold-start event into a routine part of the release process.",
        numbers: ["~23GB/s at origin at peak, 3% of delivery", "~17MB per release across three lossy rungs"],
        breaks:
          "Origin egress spiking is the alarm that says the pin list or the release calendar hook is wrong, not that traffic grew.",
      },
    },
    {
      id: "e7",
      from: "client",
      to: "events",
      label: "start / qualified / stop",
      animated: true,
      offset: 150,
      detail: {
        what: "Three events per play: start at t=0, qualified at 30 seconds, and a terminal event carrying the stop position, batched by POST /events.",
        why: "Every event carries its own played_at so the server never infers time from arrival, which is the property that makes both the ledger and the training pipeline correct in the presence of offline playback.",
        numbers: ["~2.2 events per play", "~18B/day, ~500k/s at peak", "~150B per event"],
        breaks:
          "The endpoint takes batches because a device offline for three weeks uploads three weeks at once, so the ingest path has to treat a burst of stale event times as normal rather than as an attack.",
      },
    },
    {
      id: "e8",
      from: "events",
      to: "archive",
      label: "columnar, by event time",
      detail: {
        what: "The log's 7-day hot window rolling into immutable columnar files partitioned on event time.",
        why: "The ledger reads the archive rather than the stream, so this write is the boundary between a system that may lose data and one that may not. Everything after it must be re-runnable.",
        numbers: ["~2.7TB/day raw to ~340GB/day compressed", "~8x with dictionary encoding"],
        breaks:
          "A schema change here is the quiet way to break determinism, because the batch that reads last March's files has to still understand them years later.",
      },
    },
    {
      id: "e9",
      from: "archive",
      to: "royalty",
      label: "recompute the whole period",
      detail: {
        what: "The batch reading every archived event whose event time falls in the period, after a cutoff long enough to collect offline stragglers.",
        why: "Recomputing a month is cheaper than holding streaming state open for the 30 days an offline licence can legitimately delay an event, and a recomputation can be re-run and diffed while a checkpoint cannot.",
        numbers: ["dedup on (user_id, track_id, play_start_ts)", "30 contiguous seconds qualifies"],
        breaks:
          "A rerun that disagrees with the paid run is an incident, not a correction, and any nonzero diff blocks payout.",
      },
    },
    {
      id: "e10",
      from: "royalty",
      to: "catalogue",
      label: "effective-dated rates",
      dashed: true,
      offset: 200,
      detail: {
        what: "The batch reading the rights map and per-country rate table as of the period being computed, passed in as an explicit version.",
        why: "Determinism lives or dies here. If the tables are read as 'current' rather than 'as of March', rerunning March produces a different answer every time a publisher files a correction.",
        numbers: ["one statement row per rights holder per period", "shares split across recording owner, publisher and writers"],
        breaks:
          "Composition ownership is revised retroactively, sometimes years later, so a reserve is held against unmatched compositions and trued up as claims resolve.",
      },
    },
    {
      id: "e11",
      from: "events",
      to: "labels",
      label: "same log, ranker labels",
      dashed: true,
      detail: {
        what: "The second consumer of the log, reading the same events the ledger reads and turning them into training labels.",
        why: "One log, two consumers, opposite tolerances: this one may drop thousands of events without anyone noticing, which is exactly why it must not share a pipeline with the one that may drop none.",
        numbers: ["~18B events/day", "windowed on event time, never arrival time"],
        breaks:
          "Because it shares the schema with the ledger, a field added here for ranking becomes a field an auditor may ask the royalty batch about.",
      },
    },
    {
      id: "e12",
      from: "labels",
      to: "discovery",
      label: "skip-30s / repeat-7d",
      dashed: true,
      detail: {
        what: "Labelled examples feeding the ranker that scores the candidate pool.",
        why: "The label choice is the model choice here. Feeding completion instead would train the ranker to predict familiarity, which the listener's own history already provides at zero cost.",
        numbers: ["~15% skip-before-30s base rate", "familiar ~95% vs first hear ~60% completion"],
        breaks:
          "On discovery surfaces the labels flip: every track there is unfamiliar, repeat has had no time to happen, and completion is the sharper signal, so two objectives run on two surfaces.",
      },
    },
    {
      id: "e13",
      from: "library",
      to: "discovery",
      label: "history, playlists, follows",
      dashed: true,
      detail: {
        what: "The listener's own rows feeding both the collaborative-filtering matrix and the exclusion and diversification stages of the weekly batch.",
        why: "This is also where the ranker gets time-since-last-play crossed with lifetime play count, the feature that distinguishes a track the listener is bored of from one they would love to hear again after three years.",
        numbers: ["listener vectors ~400M x 1KB = ~400GB, refreshed daily"],
        breaks:
          "Nothing in retrieval separates 'exhausted' from 'due for revival', so that feature has to be handed to the ranker deliberately because no embedding encodes it.",
      },
    },
    {
      id: "e14",
      from: "queue",
      to: "library",
      label: "scan <10,000 own tracks",
      offset: 60,
      detail: {
        what: "The hot path for the majority of plays: read the listener's saved tracks and playlists and score them on recency, play count, time of day and current queue.",
        why: "Four plays in five are repeats, so the exclusion filter of a video recommender becomes the candidate pool here, and the pool is small enough that a scan beats any index.",
        numbers: ["under 10,000 rows", "no vector index on this path"],
        breaks:
          "A new listener has nothing to scan, which is why onboarding picks plus region and age-band priors carry the first ~50 plays.",
      },
    },
    {
      id: "e16",
      to: "queue",
      from: "discovery",
      label: "Monday key read",
      dashed: true,
      offset: 140,
      detail: {
        what: "One key read when a discovery surface opens, hydrated with metadata and edge URLs from the catalogue.",
        why: "The whole point of precomputing is that this is a lookup and nothing else: no retrieval, no ranking, no accelerator in the request path on the busiest morning of the week.",
        numbers: ["hit-rate SLO above 99.9%", "payload age under 7 days"],
        breaks:
          "On a miss, serve last week's list rather than an empty surface, and alert, because a persistent miss means the Sunday batch or its replication failed.",
      },
    },
    {
      id: "e17",
      from: "client",
      to: "queue",
      label: "GET /queue/next",
      dashed: true,
      detail: {
        what: "The client asking what plays after the current track, given the context it is playing from.",
        why: "The answer has to come far enough ahead that the client can prefetch the whole next object 20 seconds before the current one ends, so this call leads playback rather than following it.",
        numbers: ["next N tracks per call", "prefetch window 20s"],
        breaks:
          "If it is late or unavailable, autoplay stalls at a track boundary, which is why the last served queue stays on the device as the fallback.",
      },
    },
    {
      id: "e18",
      from: "queue",
      to: "client",
      label: "next N + shuffle order",
      dashed: true,
      offset: 40,
      detail: {
        what: "The resolved queue, including the shuffle permutation for the next N tracks rather than a promise to randomise later.",
        why: "Shuffle resolved server-side is what lets the device cache keep working under shuffle, which is otherwise the single behaviour that collapses the highest-hit-rate tier in the system.",
        numbers: ["seeded permutation shipped ahead", "rebuffer rate is measured segmented by shuffle on/off"],
        breaks:
          "A listener who reorders or skips ahead invalidates the prefetch, so the client has to re-request rather than trust a queue it has already diverged from.",
      },
    },
  ],
};
