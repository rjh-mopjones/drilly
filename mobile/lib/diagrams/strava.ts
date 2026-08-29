import type { Diagram } from "./types";

export const STRAVA: Diagram = {
  id: "strava",
  title: "Strava",
  question: "Design Strava (Fitness Activity Tracking)",
  sourceId: "patterns",
  itemId: 44,
  overview: {
    shape:
      "An activity is a bulk upload acked in ~150ms once bytes are durable; the expensive part behind that ack is one geospatial join against a ~35M-segment corpus.",
    forces: [
      {
        constraint: "~150ms ack budget, but the ~75KB upload and its processing take roughly a second",
        decision: "The Mobile app PUTs straight to Raw upload store; Upload API only records intent and returns 202",
        lights: ["mobile", "raw-store", "upload-api", "e1", "e2", "e3"],
      },
      {
        constraint: "GPS wanders in a ~10m circle, so a nine-minute cafe stop can add ~160m of fake distance",
        decision: "Processing workers collapse drift clusters to a centroid and read elevation from a terrain raster, never GPS altitude",
        lights: ["workers"],
      },
      {
        constraint: "A feed page is 20 activities: ~40KB of summaries against ~600KB of full point streams, a 15x gap",
        decision: "Storage splits into a small Activity summary store for the feed and a cold Activity stream store for detail taps",
        lights: ["summary-store", "stream-store", "e7", "e8"],
      },
      {
        constraint: "Comparing one upload against all ~35M segments costs ~35s of CPU, ~2,800 cores steady",
        decision: "The Segment matcher narrows candidates through a 4-stage funnel: 35M to 10k to 1.2k to 50 to ~22",
        lights: ["matcher", "seg-index"],
      },
      {
        constraint: "Materialising every (segment, athlete) best across all segments is ~560GB, mostly never read",
        decision: "Leaderboards only materialise the top 1,000 for the ~2M segments with recent traffic",
        lights: ["leaderboards", "efforts"],
      },
    ],
    naive: {
      text: "Test the new track against every one of ~35M segments, since ordered directional traversal is the correct predicate and a spatial index cannot express it alone. Each comparison is a real geometric test, not a cheap distance check, so 35M of them sum to roughly 35s of CPU per upload. At ~80 uploads/s steady that is ~2,800 cores just to keep pace, and ~28,000 at the Saturday peak of ~800 uploads/s. The Segment matcher and its Segments + S2 cell index replace the brute-force scan with a narrowing funnel. Cheap, sloppy stages run first, allowed false positives, and only the last stage pays for full geometric precision.",
      lights: ["matcher", "seg-index"],
    },
    beats: [
      {
        text: "The upload path is deliberately dumb, and that is the design. The phone records at 1Hz into an on-device SQLite buffer, then PUTs a ~75KB FIT file straight to object storage through a presigned URL. The API only records the intent, publishes activity.uploaded and returns 202 in ~150ms. Bytes never pass through the application tier, and durability is established before the client is told yes.",
        lights: ["mobile", "raw-store", "upload-api", "kafka", "e1", "e2", "e3"],
      },
      {
        text: "A worker then parses and cleans, because device numbers cannot be trusted. It drops bad-accuracy points and teleports, collapses a 540-point drift cluster from a nine-minute cafe stop into its centroid, and median-smooths the rest before deriving distance and moving time. Elevation comes from a 30m terrain raster sampled at each cleaned point, never from GPS altitude, whose ~15m noise summed over 5,400 samples would invent thousands of metres of climb.",
        lights: ["workers", "e4", "e5"],
      },
      {
        text: "Storage splits in two, the most consequential decision after the upload funnel. A ~2KB summary row with a simplified polyline serves the feed from a wide-column store. A ~30KB compressed columnar blob sits in object storage and is fetched only when someone taps through. A feed page is 20 activities, so 40KB against 600KB decides whether the feed works on a train.",
        lights: ["summary-store", "stream-store", "e7", "e8"],
      },
      {
        text: "Then the actual problem: which of ~35M segments did this track traverse. Four stages run, cheapest first, each allowed false positives and none allowed a false negative. Cover the track with ~210 level-13 S2 cells, a fixed-size tile of the Earth's surface used to index location. Union the segments whose start point falls in them, 35M down to ~10k in 3ms. Bounding-box reject at a 25m margin brings that to ~1.2k in 1ms. A corridor test against a 20m spatial hash of the track's own points narrows to ~50 in 20ms. A monotone cursor with direction and gap checks finishes at ~22 efforts in 30ms.",
        lights: ["matcher", "seg-index", "e9", "e10", "e11"],
      },
      {
        text: "This is map-matching, not intersection, and the distinction is the whole design. Two polylines crossing at a junction intersect, and so does a ride on the opposite carriageway of a dual carriageway 11m away. Only contiguous, in-order, correctly directed coverage counts. No spatial index expresses that predicate, which is why the corridor and monotone-cursor stages exist at all.",
        lights: ["matcher"],
      },
      {
        text: "Efforts land in a wide-column table partitioned by segment_id at ~20 per activity. Leaderboards are Redis sorted sets per segment, written with a conditional add so best-per-athlete dedup is free, and the feed pushes the summary into followers' timelines and never the stream. Everything after parsing is a pure function of the cleaned stream plus the index and raster versions, which makes every backfill and bug fix a replay rather than a migration.",
        lights: ["efforts", "leaderboards", "feed", "e12", "e13"],
      },
    ],
    crux: {
      problem:
        "The predicate a match must satisfy is not proximity. Two tracks that cross at a junction do not traverse each other's segment, and a ride on the opposite carriageway 11m away passes close but never traverses it. No spatial index expresses ordered, directional traversal by itself.",
      handled:
        "The 4-stage funnel splits the predicate across stages of increasing precision instead of asking one index to answer it. The S2 cell and bounding-box stages are deliberately sloppy, allowed to pass anything remotely plausible, because their only job is to shrink 35M candidates cheaply. The corridor test and the monotone cursor are where directionality and contiguity are actually checked, against a small enough candidate set that real geometric work is affordable. Every stage may produce a false positive; none may drop a true match, which is what keeps the funnel safe to run sloppy-first.",
    },
    numbers: [
      {
        value: "35M to 10k to 1.2k to 50 to 22, ~100ms mean",
        explain: "The funnel's candidate count after each of the four stages; the mean cost per upload across the whole matcher fleet, including the dense-metro tail.",
      },
      {
        value: "~35M segments, ~18GB RAM-resident per matcher",
        explain: "The full segment corpus at ~500B each fits comfortably in memory, which is why the corpus is replicated whole onto every matcher rather than queried over the network.",
      },
      {
        value: "~80 uploads/s steady, ~800/s at weekend peak",
        explain: "A predictable 10x Saturday-morning spike that the queue absorbs as depth rather than as latency or dropped uploads.",
      },
      {
        value: "~2KB feed summary against a ~30KB stream blob",
        explain: "A 15x size gap; multiplied by a 20-activity feed page it is the difference between a page that loads on a train and one that does not.",
      },
    ],
  },
  nodes: [
    {
      id: "matcher-zone",
      label: "Matcher node: index beside the CPU",
      kind: "zone",
      detail: {
        what: "One matcher process with the entire segment corpus mapped into its own address space, so the join is CPU over local memory rather than network round trips.",
        why: "The matcher is the only stage whose cost scales with the global corpus rather than with one activity, so its data has to sit inside the process. ~35M segments at ~500B is only ~18GB, cheap enough to replicate onto every node.",
        numbers: [
          { value: "~18GB geometry + ~560MB cell index", explain: "The full segment geometry plus the level-13 start-cell lookup table, both resident in every matcher's memory." },
          { value: "~100ms fleet mean per upload", explain: "The average time for one upload to clear all four funnel stages, across the whole matcher fleet including slow dense-metro cases." },
          { value: "~8 cores steady, ~80 at peak", explain: "The compute the matcher fleet needs at steady state versus the Saturday-morning 10x spike." },
        ],
        breaks: {
          failure: "The whole zone is a snapshot. A node running a stale index silently produces no efforts for recent segments.",
          handled: "The index version is stamped on every effort, and a node too far behind the segments watermark refuses to consume, turning a silent gap into a visible lag alarm.",
        },
      },
    },
    {
      id: "mobile",
      label: "Mobile app",
      sub: "1Hz recorder, SQLite buffer, FIT",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The recorder and the reader: samples GPS and paired BLE sensors at 1Hz into a durable on-device buffer, encodes FIT, and later renders the feed and detail charts.",
        why: "Recording has to survive an OS kill, a dead battery and an hour with no signal, so every sample is committed to disk in the same transaction as session state. Uploads are keyed on a client-generated id minted at recording start, so a retry over a flaky network can never duplicate an activity.",
        numbers: [
          { value: "3,600 points per hour at 1Hz", explain: "The raw sample rate before any cleaning; a 90-minute ride produces about 5,400 of these points." },
          { value: "~75KB FIT vs ~1.5MB GPX", explain: "The binary format's density on the exact connection least likely to hold." },
          { value: "40km ride = 5,400 points", explain: "The typical point count for a 90-minute activity, the size the cleaning pipeline downstream is sized against." },
        ],
        breaks: {
          failure: "An app killed mid-activity loses whatever was only in memory, since a plain in-process array vanishes with the process.",
          handled: "The buffer is a write-through ring committed to disk on every sample, and relaunch offers to resume or upload the partial activity rather than silently dropping it.",
        },
        choice: {
          pick: "FIT binary with delta-encoded fields, written through to on-device SQLite",
          instead: "GPX or TCX XML, or buffering samples in memory and serialising at stop.",
          decider:
            "Bytes on a mobile uplink and survivability. A 90-minute ride is ~75KB as FIT against ~1.5MB as GPX, a 20x difference on exactly the connection least likely to hold. An in-memory buffer turns an OS kill into hours of lost data rather than seconds.",
          flips:
            "Interoperability-first products, where users import and export tracks between tools constantly and XML's readability is worth the size. Or very short activities, where 1.5MB is not a problem.",
        },
      },
    },
    {
      id: "raw-store",
      label: "Raw upload store",
      sub: "S3, presigned PUT, 12mo cold",
      kind: "database",
      col: 0,
      row: 1,
      detail: {
        what: "The original FIT, GPX or TCX bytes, written directly by the client through a presigned URL and kept on a cold tier for 12 months.",
        why: "This object is what makes the ack safe. The client is told 202 only once bytes are durable here, so a region loss during processing costs a replay rather than an activity. Retaining the original is also the only recovery path when a firmware change exposes a parser bug months later.",
        numbers: [
          { value: "~50KB per uploaded hour", explain: "The FIT file's typical density per hour of recording, the figure the store's total size scales from." },
          { value: "2.5B activities/yr", explain: "Global upload volume, the base multiplier for every capacity number in this system." },
          { value: "~125TB rolling at 12 months", explain: "2.5B activities × ~50KB, retained on a cold tier for a year before it ages out." },
        ],
        breaks: {
          failure: "Twelve months is a hard cliff. A parser bug discovered in month 13 cannot be fixed by replay for the oldest cohort.",
          handled: "There is no fix for expired bytes; the only faithful record of what the device emitted is already gone. Extending retention is the only lever, traded against the ~125TB/yr it already costs.",
        },
        choice: {
          pick: "Keep the raw bytes 12 months on a cold object-storage tier",
          instead: "Discard the original once parsing succeeds and keep only the cleaned stream.",
          decider:
            "The cost of the insurance against the cost of the incident. ~125TB rolling on a cold tier is a rounding error next to the ~190TB/yr of photo egress. Without it a per-device-model parser regression is unfixable rather than a bounded replay.",
          flips:
            "When the parser is trivial and the source format is a stable in-house one you control end to end. There the cleaned stream is a faithful enough record, and the raw copy is pure cost.",
        },
      },
    },
    {
      id: "upload-api",
      label: "Upload API",
      sub: "init, presign, commit, 202",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "Three small endpoints: hand out a presigned PUT URL, record an uploads row on commit, publish activity.uploaded and return 202 processing.",
        why: "The user-perceived latency of an upload and the cost of processing one have nothing to do with each other. This tier does the minimum that must happen synchronously: establish durability, establish idempotency, and enqueue. Everything else is allowed to be seconds late.",
        numbers: [
          { value: "~150ms ack", explain: "The end-to-end time from commit call to the 202 response, dominated by the durability write." },
          { value: "~80 req/s steady, ~800/s peak", explain: "The commit rate the tier is sized for, tracking the upload rate directly." },
          { value: "p95 30s to feed, 90s to efforts", explain: "The processing latency budgets that everything past the 202 is allowed to spend." },
        ],
        breaks: {
          failure: "It owns duplicate suppression. Without a unique constraint on the client's upload id, a retry after a network drop creates a second activity.",
          handled: "The upload_uuid unique constraint makes a retried commit return the existing activity_id instead of creating a twin, so the athlete never competes against their own duplicate leaderboard entries.",
        },
        choice: {
          pick: "Presigned PUT straight to object storage, ack after durability, publish an event",
          instead: "Proxy the upload bytes through the application tier and process inline.",
          decider:
            "Throughput the tier gains nothing by carrying. 800 uploads/s at ~50KB is ~40MB/s of body streaming through stateless boxes purely to hand it to S3 anyway. Inline processing would put the ~100ms mean plus a 300 to 600ms dense-metro tail into the athlete's request.",
          flips:
            "When the payload must be validated or transformed before it is allowed to land, for example a regulated pipeline that cannot store unverified bytes. There the proxy hop is the point.",
        },
      },
    },
    {
      id: "stream-store",
      label: "Activity stream store",
      sub: "columnar zstd blob, ~30KB",
      kind: "database",
      col: 1,
      row: 3,
      detail: {
        what: "One object per activity holding per-channel arrays, latlng, altitude, heart rate, power, cadence, delta and zigzag encoded then compressed.",
        why: "Charts read whole channels, never individual points, so a columnar layout compresses far harder than row-major and is read as one sequential GET. It is deliberately cold: touched on roughly 1% of feed impressions, so it must not sit on the feed's critical path.",
        numbers: [
          { value: "~8B/point effective, ~30KB/activity", explain: "The compressed per-point cost after delta encoding and zstd, against ~32B/point stored raw." },
          { value: "~75TB/yr, ~113TB erasure-coded", explain: "2.5B activities × ~30KB, then the redundancy overhead of erasure coding for durability." },
          { value: "one GET on tap", explain: "The entire detail-view read is a single sequential object fetch, no per-point queries." },
        ],
        breaks: {
          failure: "It is region-local by design and never replicated globally, so a follower in another region taps through to a cross-region read.",
          handled: "This is the accepted price of not paying to copy 75TB/yr for reads that mostly never happen; the cross-region read is slower but rare enough not to matter in aggregate.",
        },
        choice: {
          pick: "Per-channel columnar blob in object storage",
          instead: "Point rows in the activity database, or a time-series store.",
          decider:
            "Access shape against cost. 3,600 points times 2.5B activities is a row count no database should own for data only ever read whole. Columnar plus zstd lands at ~8B/point against ~32B raw.",
          flips:
            "When per-point server-side queries are a product feature, say segment-level analytics computed on read, where you genuinely need to index inside the stream rather than ship it to the client.",
        },
      },
    },
    {
      id: "summary-store",
      label: "Activity summary store",
      sub: "wide-column, part. athlete_id",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "The ~2KB feed representation: distance, elapsed, moving, elevation gain, counters and a simplified encoded polyline of ~300 points.",
        why: "Roughly 99% of feed impressions never open the detail view, so the object the feed reads must be small enough that 20 of them are a cheap page. Partitioning by athlete_id and clustering by start_date makes an athlete's own history a single-partition scan too.",
        numbers: [
          { value: "~500B row + ~1.5KB polyline", explain: "The stat fields plus a polyline simplified from 3,600 points down to about 300." },
          { value: "20 rows = ~40KB per feed page", explain: "One full feed page's total payload, the number a mobile client actually pays for." },
          { value: "~5TB/yr, ~15TB at RF=3", explain: "2.5B activities × ~2KB, then tripled for replication." },
        ],
        breaks: {
          failure: "It is the fail-closed point for privacy. Writing the truncated polyline before the privacy zone is applied would publish the athlete's home address.",
          handled: "The publish path asserts truncation happened and ships no map at all rather than an untruncated one, so a privacy-zone failure degrades the card instead of leaking a location.",
        },
        choice: {
          pick: "A separate ~2KB summary row, distinct from the stream blob",
          instead: "One record per activity holding the full point stream, read by both feed and detail.",
          decider:
            "The 15x size ratio against the read mix. A 20-activity feed page is ~40KB split against ~600KB unified, the difference between a p99 under 200ms and an unusable feed. At ~40M MAU the wasted egress per impression is the dominant cost line.",
          flips:
            "Short activities or an analysis-first product. A 20-minute run is ~1,200 points and a ~10KB stream, so the ratio falls to ~5x and one object avoids a second round trip.",
        },
      },
    },
    {
      id: "kafka",
      label: "Kafka: activity.uploaded",
      sub: "one event per commit",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "The durable log that separates the ~150ms user-facing upload from the ~1s of asynchronous processing behind it.",
        why: "The Saturday-morning spike is 10x and perfectly predictable, and the only cheap way to absorb it is as queue depth rather than as latency, dropped uploads or standing capacity. Consumer lag is also the leading indicator the matcher fleet autoscales on, because lag moves minutes before CPU does.",
        numbers: [
          { value: "~80 events/s steady, ~800/s peak", explain: "Tracks upload volume directly, since one event is published per committed upload." },
          { value: "consumer lag SLO p99 < 60s", explain: "The target for how far behind the tip of the log any consumer group is allowed to fall." },
          { value: "2 consumer groups: live and backfill", explain: "Separate groups so a backfill flood can be shed without touching the live processing SLO." },
        ],
        breaks: {
          failure: "At-least-once delivery means the same activity can be processed twice after a consumer restart.",
          handled: "Every downstream write and every KOM notification is idempotent on (segment_id, effort_id), so a redelivered event is safe to reprocess rather than requiring exactly-once delivery.",
        },
        choice: {
          pick: "A partitioned durable log with independent consumer groups",
          instead: "A work queue such as SQS, or synchronous processing in the upload request.",
          decider:
            "Replay and isolation at a 10x spike. Everything downstream is a pure function of the cleaned stream, so reprocessing means rewinding an offset rather than reconstructing input. A second consumer group lets a backfill flood be shed while the live peak keeps its 90s budget.",
          flips:
            "A peak-to-steady ratio near 1 with a small corpus, say a single-city deployment at ~50k segments where the funnel costs ~1ms, and a synchronous response removes the still-processing state entirely.",
        },
      },
    },
    {
      id: "workers",
      label: "Processing workers",
      sub: "parse, clean GPS, derive stats",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "Parse FIT, clean the GPS, and derive distance, moving time, elevation gain and the rolling-window power curve from the cleaned stream.",
        why: "Raw device output is wrong in specific, reproducible ways, and every number the athlete argues about comes from here. Cleaning server-side rather than trusting the device is also what makes the whole pipeline a pure function of the cleaned stream and index versions, so a fix is a replay.",
        numbers: [
          { value: "parse ~15ms, clean ~10ms, derive ~30ms", explain: "Parsing, cleaning and deriving stats are the three sub-stages a cleaned track passes through before matching begins." },
          { value: "540-point cafe drift cluster collapsed", explain: "A concrete example of the noise cleaning removes: nine minutes standing still, wandering enough to look like walking." },
          { value: "elapsed 1h38 against moving 1h29", explain: "Why the two figures diverge: elapsed counts wall-clock time, moving time excludes detected stops like the cafe cluster." },
        ],
        breaks: {
          failure: "It owns silent wrongness. A firmware update that emits a FIT variant the parser mishandles produces plausible but incorrect distance and elevation.",
          handled: "Per-device-model outlier alerts watch the distribution of derived stats, so a systematic parser regression on one device model surfaces as an anomaly rather than staying silent.",
        },
        choice: {
          pick: "Clean and derive server-side from the raw samples",
          instead: "Trust the distance and moving time the device already computed.",
          decider:
            "Fabricated distance. Consumer GPS wanders in a ~10m circle at ~0.3 m/s while genuinely still. Nine minutes at a cafe adds ~160m of distance and nine minutes of moving time, unless clusters under ~15m for over 30s are collapsed to their centroid.",
          flips:
            "A closed hardware ecosystem where you own the firmware and its filtering, so the device's numbers are yours anyway and recomputing them only creates two answers that can disagree.",
        },
      },
    },
    {
      id: "matcher",
      label: "Segment matcher",
      sub: "4-stage funnel, ~55ms p50",
      kind: "service",
      col: 3,
      row: 2,
      parent: "matcher-zone",
      detail: {
        what: "Four narrowing stages: S2 cell prefilter, bounding-box reject, 20m corridor test against a spatial hash of the track's own points, then an ordered monotone map-match with direction and gap checks.",
        why: "The invariant is the design: any stage may pass a candidate that turns out not to match, no stage may drop one that does. That contract is what lets each stage be sloppy and fast, ordered by cost per candidate divided by rejection rate.",
        numbers: [
          { value: "35M to 10k to 1.2k to 50 to 22", explain: "The candidate count surviving each of the four stages, in order." },
          { value: "~55ms p50, ~120ms p95, ~100ms fleet mean", explain: "Cheap because rejection is front-loaded: stage 1 cuts 35M to 10k before the expensive ordered map-match ever runs on the surviving handful." },
          { value: "20m corridor, 25m bbox margin", explain: "The distance tolerances used by the corridor test and the bounding-box reject, chosen wide enough to never reject a true match." },
        ],
        breaks: {
          failure: "Dense metros break stage 1: a level-13 cell in central London holds thousands of segment starts, so the prefilter returns ~80k candidates.",
          handled: "Those cells adaptively descend to level 15, a smaller cell size, splitting the crowded area into finer tiles so the prefilter narrows back down to a workable candidate count.",
        },
        choice: {
          pick: "A four-stage in-process funnel with an ordered map-match at the end",
          instead: "One proximity query against a spatial database such as PostGIS, then filter in the application.",
          decider:
            "Where the work lands. 80 to 800 multi-polygon proximity queries per second against one shared store, each returning thousands of rows you post-filter anyway, makes the database the ceiling. Stages 3 and 4 still run in the application because no spatial index expresses ordered directional traversal.",
          flips:
            "A hundredfold below this scale. At ~50k segments nothing is replicated, a newly created segment matches immediately with no backfill, and the query cost is invisible.",
        },
      },
    },
    {
      id: "seg-index",
      label: "Segments + S2 cell index",
      sub: "level 13, ~18GB in RAM",
      kind: "database",
      col: 3,
      row: 3,
      parent: "matcher-zone",
      detail: {
        what: "The full segment corpus, geometry and all, plus a hash from level-13 S2 cell to the segments whose start point falls in it, held in the matcher's memory.",
        why: "Indexing by start point rather than full cell cover keeps it at one posting per segment. It is safe only because an effort requires a complete traversal, which necessarily passes through the start point within the corridor width of some track point.",
        numbers: [
          { value: "~35M segments at ~500B = ~18GB", explain: "The full corpus's memory footprint, small enough to replicate on every matcher node." },
          { value: "cell index alone ~560MB", explain: "The start-cell lookup table, a small fraction of the total memory footprint next to the geometry itself." },
          { value: "level 13 is ~1.1km per cell area", explain: "Roughly the physical size of one S2 cell at this level, the granularity the prefilter operates at." },
        ],
        breaks: {
          failure: "Retroactive mutation. A segment created today was not in the index when historical activities were processed, so it has no efforts until a backfill runs.",
          handled: "A backfill sweep re-reads candidate historical streams and runs the corridor and monotone-cursor stages against the new segment, acquiring the efforts it should have had all along.",
        },
        choice: {
          pick: "The whole corpus RAM-resident on every matcher, keyed by level-13 start cell",
          instead: "A shared spatial database queried per upload, or a level-16 full cell cover per segment.",
          decider:
            "Row count against bytes. ~35M rows is enormous to query per upload and tiny to hold at ~18GB. Start-point indexing keeps the postings list at ~560MB rather than five or six times that for a full cover.",
          flips:
            "If the product ever grants partial-segment credit, the complete-traversal argument collapses, the start-point index starts dropping real matches, and it has to become a full cover.",
        },
      },
    },
    {
      id: "efforts",
      label: "Efforts store",
      sub: "wide-column, part. segment_id",
      kind: "database",
      col: 2,
      row: 3,
      detail: {
        what: "One narrow row per timed traversal, partitioned by segment_id and clustered by elapsed ascending, with a secondary view partitioned by athlete_id.",
        why: "This is the source of truth every leaderboard is derived from, so partitioning by segment makes a segment's board a single-partition read and makes rebuilding a wiped Redis slot cheap. Efforts are never deleted, because a 2013 KOM is still the KOM.",
        numbers: [
          { value: "~20 efforts/activity, ~50B/yr", explain: "The write amplification from one activity into many segment-effort rows, and the resulting annual row count." },
          { value: "~1,600 writes/s steady, ~16k/s peak", explain: "The write rate driven by the ~20x amplification over the upload rate." },
          { value: "~120B/row, ~18TB/yr at RF=3", explain: "The narrow row's size, multiplied by annual volume and tripled for replication." },
        ],
        breaks: {
          failure: "It owns the 20x write amplification, the largest row count in the system by an order of magnitude.",
          handled: "Efforts are batched per activity, so a partial batch failure replays the whole activity's efforts, which the idempotent effort key makes safe to retry.",
        },
        choice: {
          pick: "Wide-column partitioned by segment_id, clustered elapsed ASC",
          instead: "A relational table with indexes on both segment_id and athlete_id.",
          decider:
            "Write rate against row count. ~50B rows/yr at ~1,600 writes/s steady and ~16k/s at peak is past what one relational primary absorbs. The dominant read is a single ordered partition scan with no joins in it.",
          flips:
            "Below roughly a billion efforts, where Postgres handles the write rate comfortably and real queries over filtered boards are worth more than headroom you are not using.",
        },
      },
    },
    {
      id: "leaderboards",
      label: "Leaderboards",
      sub: "Redis ZSET per segment",
      kind: "database",
      col: 2,
      row: 4,
      detail: {
        what: "A sorted set per segment keyed by segment and board type, member athlete id, score elapsed time. The write is what makes it Strava-specific, not the ranking mechanics.",
        why: "The write only overwrites a member's score when the new time is lower. Best-per-athlete deduplication falls out of the write, instead of needing a read-modify-write that two concurrent workers would race on.",
        numbers: [
          { value: "top 1,000 for ~2M active segments", explain: "The materialised depth and breadth: enough ranks to matter, only for segments with recent traffic." },
          { value: "~160GB against ~560GB materialised fully", explain: "The memory saved by only materialising boards anyone actually reads, against materialising every segment's board." },
          { value: "read p99 < 100ms", explain: "Only reachable because just the ~2M active segments are materialised in Redis — the other ~33M fall back to a single-partition efforts scan instead, exempt from this target." },
        ],
        breaks: {
          failure: "Hot keys. A famous segment concentrates writes on one sorted set and one efforts partition.",
          handled: "Writes to a hot segment are buffered and applied in small batches, and the athlete's own new personal record is merged client-side to preserve read-your-writes without waiting on the batch.",
        },
        choice: {
          pick: "Materialise top 1,000 for the ~2M segments with recent traffic; compute the rest on demand",
          instead: "Materialise every (segment, athlete) best across all ~35M segments.",
          decider:
            "Cold bytes. Every pair is ~7B entries at ~80B, about 560GB and mostly never read, against ~160GB for the boards anyone actually looks at. The other ~33M segments are served by a bounded single-partition read from efforts.",
          flips:
            "Age-group and weight-class filters on the few hundred genuinely famous segments. There materialising the filtered boards too is worth the write amplification, because that is where all the read traffic goes.",
        },
      },
    },
    {
      id: "feed",
      label: "Feed fan-out",
      sub: "hybrid push/pull fan-out",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "Pushes the new activity into followers' Redis timeline sorted sets and serves feed reads by hydrating summary rows, the same push/pull hybrid used for any social timeline.",
        why: "The feed is deliberately decoupled from segment matching, because upload-to-feed and upload-to-efforts are separate SLOs. The athlete should see their ride long before the last of 22 efforts is written, and a matcher backlog must not delay the thing they actually look at.",
        numbers: [
          { value: "~180 followers typical", explain: "The median fan-out width, which is what makes push-on-write affordable for most athletes." },
          { value: "20 ids per page, ~40KB hydrated", explain: "The timeline holds only ids; hydrating 20 of them into full summaries is what a feed page actually costs." },
          { value: "read p99 < 180ms", explain: "Almost entirely spent turning 20 ids into ~40KB of hydrated summaries — the timeline lookup itself is cheap, so this budget is really the hydration budget." },
        ],
        breaks: {
          failure: "Pro athletes with ~1M followers make fan-out-on-write expensive: a single upload would become a million writes.",
          handled: "The push threshold is set lower than a typical social timeline, since activity volume per athlete is ~1/day rather than ~20 posts/day, and celebrity accounts fall back to pull-at-read-time.",
        },
        choice: {
          pick: "Hybrid push/pull with a lower push threshold than a social timeline",
          instead: "Pure fan-out-on-write to every follower, or pure pull at read time.",
          decider:
            "Posting rate. At ~1 activity/day per athlete the write cost of pushing is low, so push is right for the long tail. But a ~1M-follower account still makes a single upload a million writes and belongs on the pull side.",
          flips:
            "A follower graph with no celebrities, where pure push is simpler and the fan-in merge at read time buys nothing.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "mobile",
      to: "upload-api",
      tier: "data",
      label: "init + commit, upload_uuid",
      detail: {
        what: "Two small control calls: an init call to get a presigned URL, then a commit carrying the client-generated upload id.",
        why: "The id is minted when recording starts, not when uploading starts. A retry after a network drop presents the same key, so the second commit returns the existing activity_id rather than creating a twin.",
        numbers: [
          { value: "~150ms end to end", explain: "The full round trip for both control calls plus the durability write they gate." },
          { value: "202 processing returned", explain: "The response the client sees once durability is established, before any parsing or matching has run." },
        ],
        breaks: {
          failure: "If the id were generated at upload time instead, every retry would look like a distinct activity.",
          handled: "Minting the id at recording start means a retry always presents the same key, so the commit is naturally idempotent and no duplicate activity is ever created.",
        },
      },
    },
    {
      id: "e2",
      from: "mobile",
      to: "raw-store",
      tier: "data",
      label: "presigned PUT, ~75KB FIT",
      detail: {
        what: "The activity bytes going straight from the phone into object storage, bypassing the application tier entirely.",
        why: "The API gains nothing by carrying the body, and this is the write that establishes durability. The 202 is only returned once these bytes exist, so a process or region loss afterwards costs a replay rather than the ride.",
        numbers: [
          { value: "~50KB per uploaded hour", explain: "The typical body size this write carries, the figure the raw store's total size scales from." },
          { value: "800 PUTs/s at peak", explain: "The Saturday-morning peak rate this presigned upload path has to absorb without touching the application tier." },
        ],
        breaks: {
          failure: "A presigned URL is a bearer capability with a lifetime, so an unscoped or long-lived one becomes an open write handle into the bucket.",
          handled: "Each URL is scoped to exactly one object key and expires within minutes, so a leaked URL is only useful briefly and only for one upload slot.",
        },
      },
    },
    {
      id: "e3",
      from: "upload-api",
      to: "kafka",
      tier: "hot",
      step: 1,
      label: "activity.uploaded",
      detail: {
        what: "One event per committed upload, published after the uploads row is written and before the client is acked.",
        why: "This is the seam between the 150ms the athlete waits and the ~1s of work behind it. Publishing rather than calling means a matcher outage becomes consumer lag instead of upload failures on a Saturday morning.",
        numbers: [{ value: "~80/s steady, ~800/s peak", explain: "The publish rate, tracking upload volume one-for-one." }],
        breaks: {
          failure: "Publish and the database write are not one transaction, so a crash between them loses the event with the row still present.",
          handled: "A reconciliation sweep periodically scans uploads rows with no activity after N minutes and re-publishes the missing event, recovering from the crash window.",
        },
      },
    },
    {
      id: "e4",
      from: "kafka",
      to: "workers",
      tier: "hot",
      step: 2,
      label: "consume, lag SLO 60s",
      detail: {
        what: "Workers consuming the upload event and beginning the parse, clean and derive stage.",
        why: "Consumer lag on this topic is the leading indicator for both latency SLOs and the autoscaling signal, because lag moves minutes before CPU does. The weekend spike is predictable enough to pre-warm against.",
        numbers: [
          { value: "p99 lag < 60s", explain: "The target for how far behind the tip of the topic this consumer group is allowed to fall." },
          { value: "10x weekend spike absorbed as depth", explain: "The queue lets the Saturday-morning surge show up as backlog rather than as dropped uploads or missed latency targets." },
        ],
        breaks: {
          failure: "At-least-once delivery redelivers on restart, so the same activity is reprocessed after a crash.",
          handled: "Every downstream write is idempotent, so a redelivered event produces the same final state rather than doubling efforts or summary rows.",
        },
      },
    },
    {
      id: "e5",
      from: "workers",
      to: "raw-store",
      tier: "data",
      label: "GET raw bytes",
      offset: 60,
      detail: {
        what: "The worker fetching the original FIT file it was told about, rather than receiving it in the message.",
        why: "The event carries a key, not a payload, which keeps the log small and means a reprocess years later reads the same bytes the first attempt did. This is also the read the parser-bug replay depends on.",
        numbers: [{ value: "~50KB per fetch", explain: "The typical object size this read pulls, matching one uploaded activity's raw bytes." }],
        breaks: {
          failure: "Once the 12-month retention window expires this read fails.",
          handled: "Any replay campaign is bounded by retention rather than by the pipeline's ability to run it, so a fix shipped after month 12 cannot recover the oldest cohort.",
        },
      },
    },
    {
      id: "e7",
      from: "workers",
      to: "stream-store",
      tier: "data",
      label: "write ~30KB stream blob",
      detail: {
        what: "The cleaned per-channel arrays written as one compressed columnar object keyed by athlete and activity.",
        why: "This is the canonical stream every later stage is a function of. Putting it in object storage rather than a database keeps ~75TB/yr off the tier that serves the feed.",
        numbers: [
          { value: "~8B/point effective", explain: "The compressed per-point cost after delta encoding and zstd." },
          { value: "~30KB/activity", explain: "The typical compressed object size for a 90-minute ride's full stream." },
        ],
        breaks: {
          failure: "It is written before the summary, so a crash between the two leaves a stream with no feed entry.",
          handled: "This is invisible until someone deep-links to the activity; a consistency sweep periodically checks for orphaned streams and either completes the summary write or discards the orphan.",
        },
      },
    },
    {
      id: "e8",
      from: "workers",
      to: "summary-store",
      tier: "data",
      label: "write ~2KB summary",
      detail: {
        what: "The feed representation: derived stats plus a polyline simplified from 3,600 points to ~300, truncated wherever it enters a privacy zone.",
        why: "The feed must never read the stream, so the summary has to be self-sufficient. Everything the card and its map need is in this one row, which is what holds a 20-activity page at ~40KB.",
        numbers: [
          { value: "3,600 points down to ~300", explain: "The polyline simplification ratio applied before the summary is written." },
          { value: "~5B/point polyline encoding", explain: "The compressed cost per point in the simplified polyline, small enough that ~300 points is under 2KB." },
        ],
        breaks: {
          failure: "This is the fail-closed privacy boundary. A truncation that silently does not happen would leak the athlete's home.",
          handled: "If the zone service cannot be reached, the activity publishes with no map at all rather than risk an untruncated one, trading a missing map for a guaranteed non-leak.",
        },
      },
    },
    {
      id: "e9",
      from: "workers",
      to: "matcher",
      tier: "hot",
      step: 3,
      label: "cleaned track, 3,600 pts",
      detail: {
        what: "The cleaned, smoothed point array handed to the matcher, along with the track's bounding box and S2 cover.",
        why: "Matching runs on the cleaned stream and never on raw samples, because drift clusters and teleports would both corrupt the corridor test and stall the monotone cursor. Cleaning first is what makes the funnel's cardinalities hold.",
        numbers: [
          { value: "3,600 points for a 90-minute ride", explain: "The typical point count handed to the matcher after cleaning, unchanged in count from the raw sample rate." },
          { value: "~210 level-13 cells for 40km", explain: "The size of the S2 cell cover computed for a typical ride, the input to the first funnel stage." },
        ],
        breaks: {
          failure: "Over-aggressive smoothing pulls points off the road and away from segment vertices.",
          handled: "This shows up as a rise in the zero-effort upload rate rather than as any explicit error, so smoothing parameters are tuned against that metric rather than by inspection.",
        },
      },
    },
    {
      id: "e10",
      from: "matcher",
      to: "seg-index",
      tier: "hot",
      step: 4,
      label: "cell lookup, 35M to 10k",
      detail: {
        what: "A hash probe per covered cell into the local start-cell index, unioning the candidate segment ids.",
        why: "This is a local memory read rather than a network call on purpose. It is the whole reason the corpus is RAM-resident: as a database round trip it would be 80 to 800 proximity queries per second against one shared store.",
        numbers: [
          { value: "~210 cells probed", explain: "One probe per S2 cell in the track's cover, each a constant-time local hash lookup." },
          { value: "~9,800 candidates from ~35M", explain: "The surviving candidate count after this first, cheapest funnel stage." },
          { value: "~3ms", explain: "The time this stage takes, dominated by the cost of ~210 memory probes." },
        ],
        breaks: {
          failure: "In a dense metro this returns ~80k rather than ~10k, since a level-13 cell there holds thousands of segment starts.",
          handled: "Crowded cells adaptively descend to level 15, a smaller cell size. This descent rule is identical on every matcher, so two nodes never derive different efforts from the same activity.",
        },
      },
    },
    {
      id: "e11",
      from: "matcher",
      to: "efforts",
      tier: "hot",
      step: 5,
      label: "~22 efforts, batched",
      detail: {
        what: "The surviving matches written as narrow effort rows with interpolated entry and exit times, batched per activity.",
        why: "Entry and exit are interpolated between the bracketing 1Hz samples rather than snapped to them, because 2s of quantisation on a 3-minute effort is 1% and that decides crowns. Interpolation is deterministic, so a replay produces an identical time.",
        numbers: [
          { value: "~20 efforts per activity", explain: "The typical count of segments a single ride's cleaned track survives the funnel for." },
          { value: "~1,600 writes/s steady, ~16k/s peak", explain: "The write rate driven by ~20x amplification over the upload rate." },
        ],
        breaks: {
          failure: "A partial batch failure means replaying the whole activity's efforts.",
          handled: "This is only safe because the effort key is idempotent on the activity and segment pair, so a replayed batch overwrites rather than duplicates.",
        },
      },
    },
    {
      id: "e12",
      from: "efforts",
      to: "leaderboards",
      tier: "data",
      label: "ZADD LT elapsed",
      detail: {
        what: "Each written effort updating its segment's sorted set, conditionally on being faster than that athlete's existing entry.",
        why: "The conditional write makes the sorted set the arbiter instead of the worker. A plain read-modify-write races when two efforts on the same segment are processed concurrently and both believe they took the crown.",
        numbers: [
          { value: "one ZADD per effort", explain: "Each surviving effort triggers exactly one conditional write to its segment's leaderboard." },
          { value: "top 100 cached with a short TTL", explain: "The hottest slice of each board is cached briefly to absorb read bursts without hitting Redis on every request." },
        ],
        breaks: {
          failure: "The sorted set is a cache, not the truth. A lost Redis node wipes its slots.",
          handled: "Those boards are rebuilt from single-partition reads against the efforts store, which is why efforts is the durable source of truth and Redis is disposable.",
        },
      },
    },
    {
      id: "e13",
      from: "summary-store",
      to: "feed",
      tier: "data",
      label: "hydrate 20 rows",
      detail: {
        what: "The feed service reading summary rows for the activity ids it popped from a follower's timeline sorted set.",
        why: "The timeline holds ids only, so the hydrate is where the ~2KB representation earns its keep. 20 rows is ~40KB of JSON, which keeps the read inside a 200ms p99 on a mobile connection.",
        numbers: [
          { value: "20 ids per page", explain: "The page size the timeline read returns, the unit the hydration step operates on." },
          { value: "~40KB per page", explain: "The total hydrated payload for one feed page, once all 20 summary rows are fetched." },
          { value: "p99 ~180ms", explain: "The read latency target this hydration step has to stay inside." },
        ],
        breaks: {
          failure: "A follower in another region hydrates against replicated summaries, which is what makes the summary store globally replicated.",
          handled: "Summaries replicate globally specifically because feed reads must stay fast everywhere; the far larger streams behind them deliberately do not replicate, since they are rarely read.",
        },
      },
    },
    {
      id: "e14",
      from: "feed",
      to: "mobile",
      tier: "control",
      label: "feed page, ~40KB",
      offset: 120,
      detail: {
        what: "The rendered feed going back to the app: summary fields plus an encoded polyline the client draws straight onto map tiles.",
        why: "This is the read path that 99% of impressions stop at, which is precisely why no point stream is touched anywhere along it. The polyline being pre-simplified server-side means the client draws ~300 points, not 3,600.",
        numbers: [
          { value: "p95 30s from upload to visible", explain: "The latency target from the athlete pressing upload to their own ride appearing in their own feed." },
          { value: "~40KB per page", explain: "The total payload the client renders, unchanged from the hydration step behind it." },
        ],
        breaks: {
          failure: "Efforts are eventually consistent against this, so an athlete can see their own activity before their KOM notification arrives.",
          handled: "The UI is built to be honest about still processing. It shows the activity immediately, with effort counts filling in once the matcher finishes, rather than blocking the whole card on matching.",
        },
      },
    },
    {
      id: "e15",
      from: "stream-store",
      to: "mobile",
      tier: "data",
      label: "on tap, one 30KB GET",
      detail: {
        what: "A single object GET when the athlete opens the detail view, after which heart rate, power and elevation charts render locally.",
        why: "This is a separate, colder path because it is the half of the storage split that almost never runs. Serving it from object storage through the CDN keeps the analysis view off the feed's critical path entirely.",
        numbers: [
          { value: "~30KB zstd", explain: "The compressed object size fetched on this single GET." },
          { value: "roughly 1% of impressions", explain: "How rarely this path runs relative to the feed, which is why it is allowed to be colder and slower." },
        ],
        breaks: {
          failure: "The stream is region-local, so a tap on a distant follower's ride is a cross-region read with a visibly worse tail.",
          handled: "This tail is accepted because the path is rare; replicating 75TB/yr globally to avoid it would cost far more than the occasional slow detail-view load.",
        },
      },
    },
    {
      id: "e16",
      from: "stream-store",
      to: "matcher",
      tier: "control",
      label: "backfill re-reads streams",
      offset: 100,
      detail: {
        what: "The retroactive path: when a segment is created, candidate historical activities are found through a coarse level-11 activity cell index. Their streams are re-read to run only the corridor and monotone-cursor stages.",
        why: "The corpus mutates under the derived data, so a new segment on a busy road has to acquire efforts from rides recorded years earlier. The backfill index is deliberately coarser than the matching index because backfill can afford false positives.",
        numbers: [
          { value: "level 11, ~400B/activity, ~1TB/yr", explain: "The coarse backfill index's cell size and per-activity cost, sized to be cheap rather than precise." },
          { value: "capped at 24 months", explain: "How far back a backfill sweep looks for candidate historical activities to re-check." },
        ],
        breaks: {
          failure: "One new segment on a popular road can enqueue millions of stream fetches and saturate object-store egress.",
          handled: "Backfill runs on its own consumer group with a hard rate limit and is shed before the live pipeline is touched. A large backfill degrades only itself, never live matching.",
        },
      },
    },
  ],
};
