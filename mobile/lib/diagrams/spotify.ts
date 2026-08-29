import type { Diagram } from "./types";

export const SPOTIFY: Diagram = {
  id: "spotify",
  title: "Spotify",
  question: "Design Spotify (Music Streaming + Recommendations)",
  sourceId: "patterns",
  itemId: 40,
  overview: {
    shape:
      "Three businesses share one front door: a distributor, a recommender whose customers mostly want repeats, and an accounting firm that must prove the count years later.",
    forces: [
      {
        constraint: "a 4-minute track at 160kbps is 4.8MB, landing inside the first 3% of playback on a 5Mbps link",
        decision: "pick a rung once at track start and fetch the whole object, no adaptive mid-track ladder",
        lights: ["client", "edge"],
      },
      {
        constraint: "two rungs of the top 10M tracks is 144TB, one storage node, covering ~90% of plays",
        decision: "treat edge residency as a decision, not a forecast: pin the popular catalogue whole",
        lights: ["edge", "origin"],
      },
      {
        constraint: "four plays in five are repeats; the exclusion filter a video recommender uses becomes the pool itself",
        decision: "rank the listener's own <10,000-row library with a scan and a scoring function, not an index",
        lights: ["queue", "library"],
      },
      {
        constraint: "familiar tracks complete above 95% against ~60% for new ones, inside any affordable 2-week experiment window",
        decision: "hold the exploration rate as a fixed 15-20% policy constant rather than tuning it by experiment",
        lights: ["discovery", "labels"],
      },
      {
        constraint: "playback may drop an event, but the ledger must not drop one and must prove that years later",
        decision: "split delivery: a lossy streaming aggregate for dashboards, a deterministic batch over an immutable archive for pay",
        lights: ["events", "archive", "royalty"],
      },
    ],
    naive: {
      text: "A reader defaults to one pipeline: stream every play event through a real-time processor that both updates dashboards and pays royalties. That breaks the moment an offline listener's device reconnects three weeks late. Exactly-once inside a stream processor is not exactly-once from a retrying mobile client, and holding streaming state open for 30 days is unaffordable. The design splits it instead: Royalty batch recomputes the whole period deterministically from an immutable archive, while the live stream stays a provisional, lossy dashboard that pays nobody.",
      lights: ["royalty", "archive", "events"],
    },
    beats: [
      {
        text: "Delivery collapses because the objects are tiny. A four-minute track at 160kbps is 4.8MB. You pick a rung once at track start, fetch the object whole, and prefetch the entire next track 20 seconds before the current one ends. On a 5Mbps link the file has landed inside the first 3% of playback, which leaves mid-track adaptation nothing to adapt.",
        lights: ["client", "edge", "e4", "e5"],
      },
      {
        text: "Edge residency is a decision rather than a forecast. Two rungs of the top 10M tracks is 144TB, one storage node, covering ~90% of plays. Pre-pushing a new release to every edge is 17MB across the three lossy rungs. The device is then the highest-hit-rate tier of all: 4GB of spare phone storage holds ~830 tracks, which is most of a heavy listener's rotation.",
        lights: ["edge", "origin", "e6"],
      },
      {
        text: "The recommender is the strange half, because four plays in five are repeats. That inverts the machinery: the exclusion filter becomes the pool. The queue service ranks the listener's own library, playlists and follows, under 10,000 rows for the large majority. It uses a scan and a scoring function rather than an index. That is what keeps this tier at a few hundred hosts instead of a few thousand.",
        lights: ["queue", "library", "e14"],
      },
      {
        text: "The funnel everyone draws decides under a fifth of the plays. It runs weekly and offline: collaborative filtering, an audio encoder for the 60k daily uploads, and a text model for cultural context. The three merge into a ~500-track pool, a deep ranker, diversification, and 30 tracks written per listener into a cache.",
        lights: ["discovery", "e12", "e13"],
      },
      {
        text: "Labels invert with the product too. A familiar track completes at over 95% and 80% of impressions are familiar, so completion mostly measures familiarity that history already tells you for free. The negative becomes a skip inside 30 seconds, which is the royalty threshold and therefore already computed, and the positive becomes a repeat play within 7 days.",
        lights: ["labels", "e11"],
      },
      {
        text: "Money is a third consumer of the same events. Every event carries its own played_at, the archive is columnar and immutable, and the payable ledger is a deterministic batch over it, deduplicated on (user_id, track_id, play_start_ts). The streaming aggregate exists, is at-least-once, feeds artist dashboards, and pays nobody.",
        lights: ["events", "archive", "royalty", "e8", "e9"],
      },
    ],
    crux: {
      problem:
        "The exploration rate is held as a fixed policy constant of 15 to 20%, not tuned by experiment. Every measurable signal prefers familiarity, and no affordable experiment can tell a genuine preference from one the platform trained.",
      handled:
        "A track the listener already loves completes at over 95%, is almost never skipped, and lifts every metric inside a two-week experiment window. An unfamiliar one completes at roughly 60% and is skipped inside 30 seconds about a third of the time. Novelty's cost lands inside that window and its benefit lands outside it, which is why holding the constant is the honest choice and tuning it would not be.",
    },
    numbers: [
      {
        value: "~8.4B plays/day, ~18B events/day, ~500k/s peak",
        explain: "The top-level play volume and the event fan-out per play, the figures every downstream tier from delivery to the ledger is sized against.",
      },
      {
        value: "144TB pinned per edge against ~4.4PB at origin",
        explain: "How small the popular catalogue is relative to the full one, which is what makes edge residency a decision rather than a forecasting problem.",
      },
      {
        value: "~81% of plays are repeats; pool under 10,000 tracks",
        explain: "81% repeat means the other 19% of ~8.4B daily plays — still ~1.6B/day — is what the full recommendation funnel actually has to serve.",
      },
    ],
  },
  nodes: [
    {
      id: "ledger-group",
      label: "The ledger: batch, not stream",
      kind: "zone",
      detail: {
        what: "The money path: an immutable columnar archive and the deterministic batch that turns it into statement rows.",
        why: "This half of the system has a failure tolerance nothing else here shares. Playback may drop an event and nobody notices, recommendation may drop a thousand. The ledger may not drop one and must be able to prove that in an audit years later.",
        numbers: [
          { value: "~1PB over a 7-year audit window", explain: "The accumulated archive size at the contractual retention period, the storage cost of being able to reproduce any past period's payout exactly." },
          { value: "ledger rerun diff SLO exactly zero", explain: "The correctness bar this batch is held to: rerunning a past period must produce byte-identical output, not merely a close approximation." },
        ],
        breaks: {
          failure: "Determinism is a property of the inputs, not the code.",
          handled: "A rate table updated in place or a rights correction that overwrites history makes every future rerun disagree with what was paid. Both are kept effective-dated and immutable instead.",
        },
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
        why: "Because objects are small and the same ones recur, the device is the highest-hit-rate tier in the system. The decisions that remove network work entirely are made here rather than server-side.",
        numbers: [
          { value: "4GB spare holds ~830 tracks at 160kbps", explain: "The device cache capacity at typical spare storage, enough to hold most of a heavy listener's actual rotation locally." },
          { value: "prefetch the whole next track 20s before the end", explain: "The lead time this design relies on to have the next object fully fetched before it is needed, removing the network from the critical path." },
          { value: "p99 tap-to-first-audio under 300ms", explain: "The latency target from a tap to audible sound, achievable because the object is small enough to start streaming from almost immediately." },
        ],
        breaks: {
          failure: "Shuffle defeats prefetch.",
          handled: "A listener shuffling a 5,000-track playlist turns every track into a network fetch and collapses the device cache hit rate toward zero. Shuffle order is resolved server-side and shipped ahead instead.",
        },
        choice: {
          pick: "Pick a rung once, fetch the whole object, prefetch the entire next track",
          instead: "HLS or DASH throughout, ~10-second segments, mid-track bitrate switching as video does it.",
          decider:
            "Object size against speculative bandwidth. 4.8MB at 160kbps arrives in under 8 seconds on a 5Mbps link, inside the first 3% of playback, so there is nothing left to adapt. The threshold sits around 25MB.",
          flips: "Lossless at ~27MB for four minutes and podcasts at 60MB+, which the same client fetches chunked because the manifest declares delivery mode per object.",
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
        why: "Entitlement is per account and changes on billing events while metadata changes on content events. So the decision has to be taken per play rather than baked into a manifest or an edge config that outlives it.",
        numbers: [
          { value: "one call per track start", explain: "The granularity of this decision: made fresh for every play rather than cached across a session, since entitlement and metadata can each change independently." },
          { value: "~8.4B plays/day", explain: "The full daily call volume this endpoint absorbs, the top-level figure the whole play-start path is provisioned against." },
          { value: "4 entitlement dimensions: rungs, on-demand vs shuffle, offline, skip budget", explain: "The full set of account-specific permissions this one decision resolves, bundled into a single response rather than checked separately." },
        ],
        breaks: {
          failure: "This path saturates before the bytes do.",
          handled: "Ten million clients calling GET /track inside sixty seconds at a midnight release is an admission-control problem, fixed with a jittered visibility window and an edge-cached catalogue response.",
        },
        choice: {
          pick: "Fail open to the last entitlement cached on the device with a short TTL",
          instead: "Block playback whenever the entitlement service cannot answer.",
          decider:
            "The cost of each error. Briefly serving a 320kbps rung to an account that lapsed an hour ago costs a fraction of a cent. Blocking every listener in a region for a 5-minute outage costs the product.",
          flips: "Territory and rights restrictions rather than subscription tier, where over-serving is a licensing breach that rights holders audit rather than a rounding error.",
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
        why: "The catalogue is small enough that residency stops being a forecasting problem. The two mainstream rungs of the top 10M tracks are one storage node and cover the overwhelming majority of plays. So you choose what to hold rather than predict it.",
        numbers: [
          { value: "10M x 14.4MB = ~144TB pinned per edge", explain: "144TB fits on one storage node with room to spare, which is why the 97% hot hit-ratio SLO needs no second node per edge." },
          { value: "top 1% at two rungs is ~14TB, fits any PoP", explain: "Even the smallest edge locations can hold the hottest slice of the catalogue, since it is a tiny fraction of the total pinned set." },
          { value: "a whole new release is ~17MB across three lossy rungs", explain: "17MB per edge against ~780GB/s of peak delivery is nothing — cheap enough that the pre-push hook runs unconditionally, no popularity gate needed." },
          { value: "edge hit ratio SLO above 97% hot, 80% tail", explain: "The freshness and coverage bar this cache is held to, differentiated by how popular the requested track actually is." },
        ],
        breaks: {
          failure: "An unscheduled viral track is a cold miss, but only one per edge per rung, so the herd costs thousands of origin fetches rather than ten million.",
          handled: "A scheduled release that misses the pre-push hook is the avoidable version of the same event, why the hook is wired into the release calendar rather than left manual.",
        },
        choice: {
          pick: "Commercial CDN with an explicit pin API plus release-calendar pre-push",
          instead: "Plain demand-filled LRU edges with no pinning.",
          decider:
            "Pre-pushing an album to every edge is a few hundred megabytes and takes seconds, against ~780GB/s of peak delivery. At that ratio residency is a decision, and LRU would evict the pre-positioned set during the launch it was staged for.",
          flips: "The long tail, where pinning all 100M tracks is 1.7PB per edge at the lossy rungs and demand-fill is the only affordable policy.",
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
          { value: "~18B events/day at ~2.2 per play", explain: "The event fan-out per play, since one play generates a start, a qualified marker and a terminal event rather than a single record." },
          { value: "~210k/s average, ~500k/s evening peak", explain: "The throughput this log sustains at typical and peak load, the figure the whole ingest tier is provisioned against." },
          { value: "~150B per event, ~2.7TB/day raw, ~8TB/day at RF=3", explain: "The per-event size and the resulting daily volume this log durably holds before replication and after." },
          { value: "hot for 7 days, then archived", explain: "The retention window this log itself holds before rolling into the immutable columnar archive the ledger actually reads from." },
        ],
        breaks: {
          failure: "The schema is now a contract three teams depend on.",
          handled: "A field added for ranking is a field the royalty batch will be asked about in an audit, so schema changes are reviewed with that downstream consumer explicitly in mind.",
        },
        choice: {
          pick: "Partitioned durable log keyed by user_id, with clients buffering and replaying",
          instead: "A work queue consumed once, or direct writes into the analytics store.",
          decider:
            "Legitimate lateness. Offline licences run 30 days, so a play can arrive four weeks after it happened and every consumer must be able to reread it. A consumed queue offers no replay and a direct write has no second reader.",
          flips: "A service with no offline mode and no royalty obligation, where events are pure analytics and losing a percentage of them costs nothing worth a broker.",
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
        why: "The payable number is a recomputation, so its input has to be immutable and re-readable years later. It cannot be a checkpoint inside a stream processor that nobody can inspect after the fact.",
        numbers: [
          { value: "2.7TB/day raw compresses ~8x to ~340GB/day", explain: "The compression columnar storage buys over the raw event log, bringing the daily footprint down to something affordable at a 7-year retention window." },
          { value: "~870TB over seven years, call it ~1PB", explain: "The accumulated archive size across the full contractual audit window, the total cost of being able to reproduce any past period exactly." },
        ],
        breaks: {
          failure: "Size is not the constraint, determinism is.",
          handled: "A schema migration or an in-place rate correction silently changes what a rerun of last March produces. The rerun diff is how you find out, why both are kept immutable and versioned.",
        },
        choice: {
          pick: "Columnar files on object storage, written once and never mutated",
          instead: "Keeping the payable history in a warehouse table that supports updates.",
          decider:
            "Reproducibility over a 7-year window at ~340GB/day. An updatable table cannot prove what it contained on the day a period was paid, and the SLO on the rerun diff is exactly zero, not small.",
          flips: "When the audit window is short and corrections are frequent, where the operational convenience of updating a row beats a reprocessing pipeline nobody runs.",
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
        what: "A nightly and then monthly deterministic batch that applies the 30-second rule on event time, the per-country rate and the fractional split. It emits one statement row per rights holder per period.",
        why: "Payouts are monthly and events are legitimately weeks late, so the ledger is a recomputation rather than a running total. Anything already paid is credited forward with a statement note rather than restated, because rights holders have booked the number.",
        numbers: [
          { value: "dedup on 3 fields: user_id, track_id, play_start_ts", explain: "The composite key that makes this batch idempotent regardless of how many times the same play event is replayed from the archive." },
          { value: "30 contiguous seconds qualifies", explain: "The minimum listening duration that turns a play into a payable stream, the same threshold used as the skip-negative label for ranking." },
          { value: "streams counted per listener per track per day are capped, typically at one", explain: "The anti-abuse cap that limits how many times repeated listening to the same track by the same person can count toward payout in a day." },
          { value: "stream-against-batch gap expected under 0.1%", explain: "The tolerance between the provisional streaming dashboard's count and the batch's final payable number, small enough that the two rarely visibly disagree." },
        ],
        breaks: {
          failure: "Fraud, and it is bounded by the client rather than the pipeline.",
          handled: "A farm on real accounts with real subscriptions emits events indistinguishable from a listener, so detection is statistical and the fraction paid is unknown by construction.",
        },
        choice: {
          pick: "Deterministic batch over the archive is the ledger; the stream is a provisional dashboard",
          instead: "One exactly-once streaming pipeline whose output is the payable number.",
          decider:
            "30 days of legitimate lateness from offline licences. Holding streaming state open for a month costs more than recomputing the month. Exactly-once inside a processor is not exactly-once from a retrying mobile client, so the dedup key does the real work either way.",
          flips: "No offline mode with p99.9 lateness in minutes, or a business that genuinely needs payable numbers hourly. The alternative is also operationally simpler: one pipeline, and no risk of the dashboard and the statement telling an artist two different numbers.",
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
        why: "Four plays in five are repeats, so the surface carrying most listening ranks one person's own universe. It uses a scan over recency, lifetime play count, time of day and what is already queued. That fact alone is the sizing decision for the whole tier.",
        numbers: [
          { value: "~81% of plays are repeats, ~19% first hears", explain: "The split between listening the queue service alone can serve and listening that needs the recommendation funnel, the figure that sizes both tiers." },
          { value: "pool under 10,000 tracks for most listeners", explain: "The typical size of a listener's own library and playlists, small enough that a linear scan beats building an index." },
          { value: "a few hundred hosts, not a few thousand", explain: "The fleet size this design achieves by serving the majority of plays from a simple scan rather than a full retrieval-and-ranking funnel." },
        ],
        breaks: {
          failure: "Shuffle order must be a seeded permutation shipped ahead with the queue, not a draw at play time.",
          handled: "Otherwise the client has nothing to prefetch and the device cache stops working, so shuffle is resolved server-side and delivered as a fixed ordering before playback needs it.",
        },
        choice: {
          pick: "Scan and score the listener's own rows on the request path",
          instead: "Run the retrieval-plus-ranker funnel for every queue request.",
          decider:
            "Pool size. 10^4 rows the listener already owns against 10^8 in the catalogue: the funnel exists to cut 10^8 down, and it earns nothing for the 81% of plays that are repeats.",
          flips: "A listener under about 50 plays, who has no history to rank and is served from onboarding picks blended with region and age-band popularity priors.",
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
        why: "It is read on every play and almost entirely cacheable, so a whole replica per region removes a cross-region hop from the play path. It is also the same table the ledger keys on, which is why it is versioned rather than mutable.",
        numbers: [
          { value: "100M tracks x ~1.5KB = ~150GB; RF=3 gives ~450GB", explain: "The full catalogue size before and after replication, small enough to keep a whole copy in every region." },
          { value: "1 identifier (ISRC) is what the royalty path keys on", explain: "The single stable identifier the entire payment pipeline joins on, chosen because it never changes across catalogue corrections." },
          { value: "~60k new tracks/day", explain: "The daily ingestion rate this table has to absorb, small enough that the whole-replica approach remains affordable." },
        ],
        breaks: {
          failure: "Recording ownership is usually clean; composition ownership is asserted by publishers and societies, arrives incomplete and is revised retroactively.",
          handled: "So the count is exact and the split is not, an accepted asymmetry the royalty batch handles by holding a reserve against unmatched compositions.",
        },
        choice: {
          pick: "Rights and rate rows are effective-dated and never updated in place",
          instead: "Update the rights map and rate tables in place as corrections arrive.",
          decider:
            "The batch takes the table version as an explicit input, so rerunning last March must use last March's rates. In-place updates make every rerun of a paid period disagree, and the diff SLO is exactly zero.",
          flips: "Metadata with no financial consequence, such as artwork or tags, where versioning every correction is storage and ceremony for nothing.",
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
        why: "The edge serves the overwhelming majority of plays, so origin is sized from the miss rate rather than the play rate. It exists to fill edges and to hold the long tail nobody would ever pin.",
        numbers: [
          { value: "44MB per track across four rungs, ~4.4PB total", explain: "The full per-track footprint across every quality level, multiplied out to the total origin storage size at catalogue scale." },
          { value: "lossy rungs only are ~1.7PB", explain: "The origin footprint if lossless were excluded, showing how much of total storage the highest-quality rung alone accounts for." },
          { value: "~23GB/s at peak, which is 3% of 780GB/s", explain: "Origin's actual throughput share at peak, small because the edge tier absorbs almost all delivery traffic before it ever reaches origin." },
        ],
        breaks: {
          failure: "Long-tail growth: 60k tracks/day x 44MB is 2.6TB/day, roughly 1PB a year.",
          handled: "Most of which never plays once, an accepted cost of eagerly encoding every rung rather than transcoding lazily on first request for tracks with no traffic.",
        },
        choice: {
          pick: "Encode the 160kbps rung eagerly; transcode the other rungs on first request for tracks with no plays",
          instead: "Encode all four rungs eagerly at upload.",
          decider:
            "2.6TB/day of eager growth against 0.3TB/day, an 8x cut, paid for with a few hundred milliseconds on the very first play of a long-tail track at a non-default rung. That first play is rare by definition.",
          flips: "Anything with a release campaign behind it, where the first play is the one that matters and must not wait on a transcode.",
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
        why: "This is simultaneously the pool for most plays and the only place the feature that separates 'exhausted' from 'due for revival' lives. No embedding encodes time-since-last-play crossed with lifetime count.",
        numbers: [
          { value: "under 10,000 tracks for the large majority", explain: "The typical size of one listener's library and playlists combined, small enough for the queue service to scan directly." },
          { value: "a few hundred kilobytes of rows per listener", explain: "The storage footprint per listener, small enough that holding this table for the entire user base is inexpensive." },
        ],
        breaks: {
          failure: "Collaborative playlists: two people inserting at the same position at the same time, which fractional keys absorb.",
          handled: "Offline edits that arrive against a version that has moved are the harder case, resolved by treating the fractional key itself as the source of truth.",
        },
        choice: {
          pick: "Fractional position keys on playlist entries",
          instead: "Integer positions renumbered on every insert.",
          decider:
            "Write amplification and collisions. Inserting at the top of a 10,000-entry playlist renumbers 10,000 rows. A fractional key writes one row, and two collaborators inserting at the same spot get distinct keys with no lock.",
          flips: "Short, single-owner lists where renumbering is trivial and integer positions are easier to reason about and to page.",
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
        what: "Turns the same play events into training labels on event time: a skip inside 30 seconds is the negative, a repeat play within 7 days is the positive. Completion is recorded but is not the target.",
        why: "When most impressions are familiar, completion measures familiarity rather than satisfaction, and the listener's own history already tells you that for free. The chosen negative is also the royalty threshold, so it is already computed exactly on the money path.",
        numbers: [
          { value: "familiar completes at ~95%, first hear at ~60%", explain: "The completion gap between familiar and unfamiliar tracks, why raw completion mostly measures familiarity rather than genuine satisfaction." },
          { value: "blended completion ~88%, variance almost all in the 20% that are first hears", explain: "The overall completion rate once familiar and unfamiliar plays are mixed, showing nearly all the useful signal sits in the smaller unfamiliar slice." },
          { value: "skip-before-30s base rate ~15%", explain: "The baseline rate of this chosen negative label, a figure already computed as part of the royalty qualification threshold." },
        ],
        breaks: {
          failure: "Windowing on arrival time.",
          handled: "A device offline for three weeks uploads three weeks of listening at once. An arrival-time window treats it as a single day and distorts the profile, so every window is computed on event time instead.",
        },
        choice: {
          pick: "skip-before-30s as the negative, repeat-within-7-days as the positive",
          instead: "Predicted play-completion probability, the objective every video recommender uses.",
          decider:
            "Base rates. Blended completion sits near 88% with 80% of impressions familiar, so a model trained on it mostly learns to predict familiarity. Skip-before-30s has a ~15% base rate and costs nothing extra to emit.",
          flips: "The discovery surfaces specifically, where every track is unfamiliar by construction, repeat has had no time to happen, and completion is the sharpest signal available. Two objectives on two surfaces is the honest answer.",
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
        why: "Three sources because no single one covers every data regime. CF is strongest where a track already has plays. The audio encoder gives a brand-new upload a vector at all, and text carries cultural context neither can see.",
        numbers: [
          { value: "~200 CF + ~150 audio + ~100 text entries, ~500 after dedup", explain: "The contribution of each retrieval source to the merged candidate pool before the deep ranker and diversification narrow it further." },
          { value: "top 30 per listener per surface", explain: "The final number of tracks this weekly batch writes per listener, small enough to serve as a simple cache read at request time." },
          { value: "novelty held at 15-20% of impressions as policy", explain: "The fixed exploration rate enforced regardless of what the ranking model itself would prefer, the guard against converging entirely on familiarity." },
          { value: "this funnel decides ~19% of plays; the weekly mix about 3%", explain: "The actual share of total listening this expensive funnel is responsible for, small next to the repeat-play majority the queue service handles directly." },
        ],
        breaks: {
          failure: "A ranker trained on repeat plays converges on a rotation of 40 tracks and every metric inside a two-week experiment agrees with it.",
          handled: "The guards are a hard novelty floor no model output may override and a per-track exposure cap, both policy constants rather than anything the model can adjust.",
        },
        choice: {
          pick: "HNSW over 100M track vectors in RAM, with incremental inserts",
          instead: "A quantised index such as IVF-PQ, and its recall loss.",
          decider:
            "Memory. 100M x 256 dims x float32 is 100GB, ~140GB with graph overhead across 8 shards of ~18GB, which fits in RAM. The fork that binds at 10B vectors and 10TB does not bind two orders of magnitude smaller.",
          flips: "A corpus 100x larger, as in the short-video case, where the index no longer fits and quantisation stops being optional. Incremental inserts also matter here: 60k uploads a day must be retrievable within minutes or release radar misses Friday.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "play-api",
      tier: "control",
      label: "GET /track/{id}",
      detail: {
        what: "The control call at track start, asking what this track is and what this account may do with it.",
        why: "Entitlement and metadata are decided per play because they change on different clocks: billing events for one, content events for the other. Neither can be baked into anything the edge caches for a day.",
        numbers: [
          { value: "one call per track start", explain: "The granularity this call runs at, made fresh per play rather than cached across a session." },
          { value: "~8.4B/day", explain: "The daily volume this arrow carries in aggregate, matching total play volume one-to-one." },
        ],
        breaks: {
          failure: "It is the first thing to fall over at a midnight release, when ten million clients make this exact call inside sixty seconds.",
          handled: "A jittered visibility window and an edge-cached catalogue response absorb that spike, smoothing it before it reaches the entitlement decision itself.",
        },
      },
    },
    {
      id: "e2",
      from: "play-api",
      to: "catalogue",
      tier: "control",
      label: "metadata + rung keys",
      detail: {
        what: "Reading the track row: title, artists, duration, ISRC and the object key for each rung.",
        why: "The catalogue is 450GB replicated whole into every region precisely so this read never leaves the region, which is what keeps a play start inside its latency budget.",
        numbers: [
          { value: "~1.5KB per row", explain: "100M tracks × 1.5KB ≈ 150GB, ~450GB at RF=3 — small enough to replicate the whole catalogue everywhere, keeping this read local." },
          { value: "regional replica, 0 cross-region hops", explain: "The consequence of replicating the whole catalogue into every region: this read never has to leave the region a play starts in." },
        ],
        breaks: {
          failure: "If the lookup is unavailable a play cannot start at all.",
          handled: "The client caches metadata for everything already in its queue for 24 hours and degrades to tracks resident on the device. A brief outage still lets a listener keep listening to what they queued.",
        },
      },
    },
    {
      id: "e3",
      from: "play-api",
      to: "client",
      tier: "control",
      label: "entitlement + signed URLs",
      offset: 40,
      detail: {
        what: "The response: which rungs this account may use, and a signed edge URL for each of them.",
        why: "The client, not the server, picks the rung, because it is the only party that knows its measured throughput and its own cache contents. The server's job is to bound the choice, not to make it.",
        numbers: [
          { value: "premium unlocks 320kbps and lossless", explain: "The tier gate this response enforces, the concrete difference entitlement makes to which rungs a given account may request." },
          { value: "one URL per permitted rung", explain: "The response carries a distinct signed URL for every rung this account is allowed to use, so the client chooses without a further round trip." },
        ],
        breaks: {
          failure: "Signed URLs have to outlive a paused track but not a shared link.",
          handled: "The expiry window is a product decision disguised as a security parameter, tuned to cover a realistic pause without making a leaked URL useful for long.",
        },
      },
    },
    {
      id: "e4",
      from: "client",
      to: "edge",
      tier: "hot",
      step: 1,
      label: "GET whole object",
      detail: {
        what: "One HTTP GET for the entire track object, plus a second one 20 seconds before the end for the whole next track in the queue.",
        why: "This single arrow carries the whole delivery argument. Fetching the next track outright means the gap between tracks is zero and the next start does not depend on the network at all.",
        numbers: [
          { value: "4.8MB at 160kbps, 9.6MB at 320kbps", explain: "The object size at the two most common rungs, small enough to fetch whole well within the time a track takes to play." },
          { value: "prefetch at duration minus 20s", explain: "The lead time before a track ends that the client begins fetching the next one, chosen to comfortably finish before playback needs it." },
        ],
        breaks: {
          failure: "It is speculative spend.",
          handled: "A listener who skips has paid for bytes nobody heard, which is why the argument for this design is about object size and metered cost rather than protocol purity.",
        },
      },
    },
    {
      id: "e5",
      from: "edge",
      to: "client",
      tier: "hot",
      step: 2,
      label: "4.8MB, first audio ~120ms",
      offset: 70,
      detail: {
        what: "The object bytes streaming back, with playback starting from the first bytes rather than waiting for the file.",
        why: "The rest of the file lands inside the first 15 seconds of playback, which is why there is no adaptive ladder here. The decision was made and executed inside the first 3% of the track.",
        numbers: [
          { value: "~390GB/s average egress, ~780GB/s peak", explain: "The aggregate delivery bandwidth this arrow represents across the whole edge fleet, the figure that sizes total egress capacity." },
          { value: "29M concurrent streams at peak", explain: "The concurrent playback population this delivery path serves at its busiest, the top-level figure the edge fleet is provisioned against." },
        ],
        breaks: {
          failure: "On a weak network the client must step down a rung before rebuffering rather than after.",
          handled: "There is no mid-object switch to fall back on, so the rung decision at track start has to be conservative enough to avoid a stall rather than correctable mid-stream.",
        },
      },
    },
    {
      id: "e6",
      from: "origin",
      to: "edge",
      tier: "data",
      label: "miss fill + release pre-push",
      detail: {
        what: "Origin fetches on a cold miss, and scheduled pre-pushes of new releases before they go live.",
        why: "Origin capacity is sized from this arrow rather than from play volume, and pre-push turns a scheduled launch from a cold-start event into a routine part of the release process.",
        numbers: [
          { value: "~23GB/s at origin at peak, 3% of delivery", explain: "The scale of origin's contribution to total delivery, tiny because the edge tier absorbs almost everything." },
          { value: "~17MB per release across three lossy rungs", explain: "17MB against this arrow's 23GB/s peak is under a millisecond of bandwidth — cheap enough that pre-push never competes with real miss-fill traffic." },
        ],
        breaks: {
          failure: "Origin egress spiking is the alarm that says the pin list or the release calendar hook is wrong.",
          handled: "Not that traffic grew, so an origin egress spike is investigated as a residency-policy failure first rather than treated as ordinary capacity pressure.",
        },
      },
    },
    {
      id: "e7",
      from: "client",
      to: "events",
      tier: "hot",
      step: 3,
      label: "start / qualified / stop",
      offset: 150,
      detail: {
        what: "Three events per play: start at t=0, qualified at 30 seconds, and a terminal event carrying the stop position, batched by POST /events.",
        why: "Every event carries its own played_at so the server never infers time from arrival. This is the property that makes both the ledger and the training pipeline correct in the presence of offline playback.",
        numbers: [
          { value: "~2.2 events per play", explain: "The event fan-out per play: a start, a qualified marker, and a terminal event, not a single record." },
          { value: "~18B/day, ~500k/s at peak", explain: "The resulting daily and peak event volume this arrow carries, driven directly by total play volume and the per-play event count." },
          { value: "~150B per event", explain: "The compact per-event size that keeps this high-volume stream affordable to ingest and store." },
        ],
        breaks: {
          failure: "The endpoint takes batches because a device offline for three weeks uploads three weeks at once.",
          handled: "The ingest path has to treat a burst of stale event times as normal rather than as an attack, since rejecting it would silently lose legitimate offline listening history.",
        },
      },
    },
    {
      id: "e8",
      from: "events",
      to: "archive",
      tier: "data",
      label: "columnar, by event time",
      detail: {
        what: "The log's 7-day hot window rolling into immutable columnar files partitioned on event time.",
        why: "The ledger reads the archive rather than the stream, so this write is the boundary between a system that may lose data and one that may not. Everything after it must be re-runnable.",
        numbers: [
          { value: "~2.7TB/day raw to ~340GB/day compressed", explain: "The volume this write handles before and after columnar compression, the transformation that makes 7-year retention affordable." },
          { value: "~8x with dictionary encoding", explain: "The compression ratio dictionary encoding on track_id, country and device achieves, the mechanism behind the overall size reduction." },
        ],
        breaks: {
          failure: "A schema change here is the quiet way to break determinism.",
          handled: "The batch that reads last March's files has to still understand them years later, why this stream's schema is treated as a long-lived contract, not something changed lightly.",
        },
      },
    },
    {
      id: "e9",
      from: "archive",
      to: "royalty",
      tier: "data",
      label: "recompute the whole period",
      detail: {
        what: "The batch reading every archived event whose event time falls in the period, after a cutoff long enough to collect offline stragglers.",
        why: "Recomputing a month is cheaper than holding streaming state open for the 30 days an offline licence can legitimately delay an event. A recomputation can be re-run and diffed while a checkpoint cannot.",
        numbers: [
          { value: "dedup on 3 fields: user_id, track_id, play_start_ts", explain: "The composite key this batch uses to guarantee idempotence, matching the key the royalty batch itself dedupes on." },
          { value: "30 contiguous seconds qualifies", explain: "The minimum listen duration that turns a play into a payable stream, read directly from the archived event time." },
        ],
        breaks: {
          failure: "A rerun that disagrees with the paid run is an incident, not a correction.",
          handled: "Any nonzero diff blocks payout, so the rerun-diff check is a hard gate rather than a metric to watch and explain away later.",
        },
      },
    },
    {
      id: "e10",
      from: "royalty",
      to: "catalogue",
      tier: "control",
      label: "effective-dated rates",
      offset: 200,
      detail: {
        what: "The batch reading the rights map and per-country rate table as of the period being computed, passed in as an explicit version.",
        why: "Determinism lives or dies here. If the tables are read as 'current' rather than 'as of March', rerunning March produces a different answer every time a publisher files a correction.",
        numbers: [
          { value: "one statement row per rights holder per period", explain: "The output granularity of this batch, one row per payee per payout period rather than one row per stream." },
          { value: "shares split 3 ways: recording owner, publisher, writers", explain: "The three parties a single stream's royalty is divided among, each governed by a separately effective-dated rate." },
        ],
        breaks: {
          failure: "Composition ownership is revised retroactively, sometimes years later.",
          handled: "A reserve is held against unmatched compositions and trued up as claims resolve, so a late correction adjusts a held reserve rather than reopening an already-paid statement.",
        },
      },
    },
    {
      id: "e11",
      from: "events",
      to: "labels",
      tier: "control",
      label: "same log, ranker labels",
      detail: {
        what: "The second consumer of the log, reading the same events the ledger reads and turning them into training labels.",
        why: "One log, two consumers, opposite tolerances: this one may drop thousands of events without anyone noticing. That is exactly why it must not share a pipeline with the one that may drop none.",
        numbers: [
          { value: "~18B events/day", explain: "The full volume this arrow reads from, the same stream the royalty batch reads with a completely different tolerance for loss." },
          { value: "windowed on event time, 0 reliance on arrival time", explain: "This consumer windows strictly on when the play happened, not when the event arrived, so late offline uploads still land in the correct window." },
        ],
        breaks: {
          failure: "Because it shares the schema with the ledger, a field added here for ranking becomes a field an auditor may ask the royalty batch about.",
          handled: "This is an accepted coupling cost of reading the same log rather than maintaining two separately evolving schemas for the same underlying events.",
        },
      },
    },
    {
      id: "e12",
      from: "labels",
      to: "discovery",
      tier: "control",
      label: "skip-30s / repeat-7d",
      detail: {
        what: "Labelled examples feeding the ranker that scores the pool.",
        why: "The label choice is the model choice here. Feeding completion instead would train the ranker to predict familiarity, which the listener's own history already provides at zero cost.",
        numbers: [
          { value: "~15% skip-before-30s base rate", explain: "The baseline rate of the chosen negative label, already computed as part of the royalty qualification threshold." },
          { value: "familiar ~95% vs first hear ~60% completion", explain: "The completion gap that makes raw completion a poor training signal on surfaces dominated by familiar tracks." },
        ],
        breaks: {
          failure: "On discovery surfaces the labels flip: every track there is unfamiliar, repeat has had no time to happen.",
          handled: "Completion becomes the sharper signal there instead, so two distinct objectives run side by side on two different surfaces rather than forcing one scheme to fit both.",
        },
      },
    },
    {
      id: "e13",
      from: "library",
      to: "discovery",
      tier: "control",
      label: "history, playlists, follows",
      detail: {
        what: "The listener's own rows feeding both the collaborative-filtering matrix and the exclusion and diversification stages of the weekly batch.",
        why: "This is also where the ranker gets time-since-last-play crossed with lifetime play count. That is the feature that distinguishes a track the listener is bored of from one they would love to hear again after three years.",
        numbers: [{ value: "listener vectors ~400M x 1KB = ~400GB, refreshed daily", explain: "400GB refreshes whole daily, but the weekly discovery batch it feeds only recomputes once a week — a listener's latest plays wait days to matter." }],
        breaks: {
          failure: "Nothing in retrieval separates 'exhausted' from 'due for revival'.",
          handled: "That feature has to be handed to the ranker deliberately, since no embedding encodes it, which is why this table's raw play-history fields feed the ranker directly.",
        },
      },
    },
    {
      id: "e14",
      from: "queue",
      to: "library",
      tier: "data",
      label: "scan <10,000 own tracks",
      offset: 60,
      detail: {
        what: "The hot path for the majority of plays: read the listener's saved tracks and playlists and score them on recency, play count, time of day and current queue.",
        why: "Four plays in five are repeats, so the exclusion filter of a video recommender becomes the pool here, and the pool is small enough that a scan beats any index.",
        numbers: [
          { value: "under 10,000 rows", explain: "The typical scan size this path operates over, small enough that a linear scan outperforms building and maintaining an index." },
          { value: "0 vector index on this path", explain: "This path deliberately carries no retrieval infrastructure at all, relying purely on a scan and a scoring function over the listener's own rows." },
        ],
        breaks: {
          failure: "A new listener has nothing to scan.",
          handled: "Onboarding picks plus region and age-band priors carry the first ~50 plays instead, until enough history accumulates for this path to take over.",
        },
      },
    },
    {
      id: "e16",
      to: "queue",
      tier: "control",
      from: "discovery",
      label: "Monday key read",
      offset: 140,
      detail: {
        what: "One key read when a discovery surface opens, hydrated with metadata and edge URLs from the catalogue.",
        why: "The whole point of precomputing is that this is a lookup and nothing else. No retrieval, no ranking, no accelerator in the request path on the busiest morning of the week.",
        numbers: [
          { value: "hit-rate SLO above 99.9%", explain: "The reliability bar this lookup is held to, achievable because the whole weekly output set is small enough to replicate everywhere in advance." },
          { value: "payload age under 7 days", explain: "The maximum staleness this cache is expected to carry, bounded by the weekly batch's own refresh cadence." },
        ],
        breaks: {
          failure: "On a miss, serve last week's list rather than an empty surface, and alert.",
          handled: "A persistent miss means the Sunday batch or its replication failed, so this fallback trades a week of staleness for never showing an empty surface.",
        },
      },
    },
    {
      id: "e17",
      from: "client",
      to: "queue",
      tier: "control",
      label: "GET /queue/next",
      detail: {
        what: "The client asking what plays after the current track, given the context it is playing from.",
        why: "The answer has to come far enough ahead that the client can prefetch the whole next object 20 seconds before the current one ends. So this call leads playback rather than following it.",
        numbers: [
          { value: "next ~5-10 tracks per call", explain: "The lookahead depth this call returns, enough to keep the client's prefetch pipeline fed across several track boundaries." },
          { value: "prefetch window 20s", explain: "The lead time the client relies on this response to arrive within, matching the prefetch trigger on the playback side." },
        ],
        breaks: {
          failure: "If it is late or unavailable, autoplay stalls at a track boundary.",
          handled: "The last served queue stays on the device as the fallback, so a temporary outage degrades to replaying a stale but valid queue rather than stopping playback.",
        },
      },
    },
    {
      id: "e18",
      from: "queue",
      to: "client",
      tier: "control",
      label: "next N + shuffle order",
      offset: 40,
      detail: {
        what: "The resolved queue, including the shuffle permutation for the next N tracks rather than a promise to randomise later.",
        why: "Shuffle resolved server-side is what lets the device cache keep working under shuffle, which is otherwise the single behaviour that collapses the highest-hit-rate tier in the system.",
        numbers: [
          { value: "1 seeded permutation shipped ahead, not drawn live", explain: "Shuffle order is resolved once, server-side, and delivered as a fixed sequence, rather than decided live at each track boundary." },
          { value: "rebuffer rate measured across 2 segments: shuffle on/off", explain: "This metric is tracked separately for shuffled and sequential playback, since shuffle changes the client's ability to prefetch reliably." },
        ],
        breaks: {
          failure: "A listener who reorders or skips ahead invalidates the prefetch.",
          handled: "The client has to re-request rather than trust a queue it has already diverged from, so any manual reordering triggers a fresh queue fetch instead of continuing on stale data.",
        },
      },
    },
  ],
};
