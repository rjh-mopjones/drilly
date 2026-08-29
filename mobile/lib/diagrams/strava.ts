import type { Diagram } from "./types";

export const STRAVA: Diagram = {
  id: "strava",
  title: "Strava",
  question: "Design Strava (Fitness Activity Tracking)",
  sourceId: "patterns",
  itemId: 44,
  overview: {
    shape:
      "An activity is a bulk upload of a finished GPS track, acked in ~150ms once the bytes are durable, and everything expensive behind that ack is one geospatial join run per write against a corpus of ~35M segments that dwarfs the request.",
    beats: [
      "The upload path is deliberately dumb, and that is the design. The phone records at 1Hz into an on-device SQLite buffer, PUTs a ~75KB FIT file straight to object storage through a presigned URL, and the API only records the intent, publishes activity.uploaded and returns 202 in ~150ms. Bytes never pass through the application tier, and durability is established before the client is told yes.",
      "A worker then parses and cleans, because device numbers cannot be trusted. Drop bad-accuracy points and teleports, collapse the 540-point drift cluster from a nine-minute cafe stop into its centroid, median-smooth the rest, then derive distance and moving time. Elevation comes from a 30m terrain raster sampled at each cleaned point, never from GPS altitude, whose ~15m noise summed over 5,400 samples invents thousands of metres of climb.",
      "Storage splits in two and this is the most consequential decision after the funnel. A ~2KB summary row with a Douglas-Peucker simplified polyline serves the feed from a wide-column store, and a ~30KB zstd columnar stream blob sits in object storage and is fetched only when someone taps through. The ratio is 15x, a feed page is 20 activities, so 40KB against 600KB decides whether the feed works on a train.",
      "Then the actual problem: which of ~35M segments did this track traverse. Four stages, cheapest first, each allowed false positives and none allowed a false negative. Cover the track with ~210 level-13 S2 cells and union the segments whose start point falls in them (35M to ~10k, 3ms), bbox-reject at a 25m margin (~1.2k, 1ms), corridor-test every segment vertex against a 20m spatial hash of the track's own points (~50, 20ms), then walk a monotone cursor with direction and gap checks (~22 efforts, 30ms).",
      "Say the distinction out loud, because it is what the question is testing: this is map-matching, not intersection. Two polylines crossing at a junction intersect, and so does a ride on the opposite carriageway of a dual carriageway 11m away. Only contiguous, in-order, correctly directed coverage counts, and no spatial index expresses that predicate, which is why stages 3 and 4 exist at all.",
      "The tail of the system is mostly reference to other patterns. Efforts land in a wide-column table partitioned by segment_id at ~20 per activity, leaderboards are Redis sorted sets per segment (see #22) written with ZADD LT so best-per-athlete dedup is free, and the feed is the hybrid push/pull fan-out from #8 carrying the summary and never the stream. Everything after parsing is a pure function of the cleaned stream plus the index and raster versions, which makes every backfill and bug fix a replay rather than a migration.",
    ],
    crux:
      "Deciding which segments a new track traversed. Naively that is 35M polyline comparisons per upload, ~35s of CPU, ~2,800 cores steady and ~28,000 at the Saturday peak. Worse, the predicate is not proximity but ordered directional traversal, so the spatial index only ever produces candidates and three more stages have to run.",
    numbers: [
      "35M to 10k to 1.2k to 50 to 22, ~100ms mean",
      "~35M segments, ~18GB RAM-resident per matcher",
      "~80 uploads/s steady, ~800/s at weekend peak",
      "~2KB feed summary against a ~30KB stream blob",
    ],
  },
  nodes: [
    {
      id: "matcher-zone",
      label: "Matcher node: index beside the CPU",
      kind: "zone",
      detail: {
        what: "One matcher process with the entire segment corpus mmap'd into its own address space, so the join is CPU over local memory rather than network round trips.",
        why: "The matcher is the only stage whose cost scales with the size of the global corpus rather than with this one activity, so its data has to sit inside the process. ~35M segments at ~500B is only ~18GB, which is cheap enough to replicate onto every node and expensive enough to make a shared database the bottleneck.",
        numbers: ["~18GB geometry + ~560MB cell index", "~100ms fleet mean per upload", "~8 cores steady, ~80 at peak"],
        breaks:
          "The whole zone is a snapshot. A node running a stale index silently produces no efforts for recent segments, which is why the index version is stamped on every effort and a node too far behind the segments watermark refuses to consume.",
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
        what: "The recorder and the reader: samples GPS and paired BLE sensors at 1Hz into a durable on-device buffer, encodes FIT, and later renders the feed and the detail charts.",
        why: "Recording has to survive an OS kill, a dead battery and an hour in a valley with no signal, so every sample is committed to disk in the same transaction as session state. Uploads are keyed on a client-generated upload_uuid minted at recording start, so a retry over a flaky mobile network can never duplicate an activity.",
        numbers: ["3,600 points per hour at 1Hz", "~75KB FIT vs ~1.5MB GPX", "40km ride = 5,400 points"],
        breaks:
          "An app killed mid-activity loses whatever was only in memory, which is why the buffer is a write-through ring rather than an in-process array, and why relaunch offers to resume or upload the partial activity.",
        choice: {
          pick: "FIT binary with delta-encoded fields, written through to on-device SQLite",
          instead: "GPX or TCX XML, or buffering samples in memory and serialising at stop.",
          decider:
            "Bytes on a mobile uplink and survivability. A 90-minute ride is ~75KB as FIT against ~1.5MB as GPX, a 20x difference on exactly the connection least likely to hold, and an in-memory buffer turns an OS kill into hours of lost data rather than seconds.",
          flips:
            "Interoperability-first products, where users import and export tracks between tools constantly and XML's readability is worth the size, or very short activities where 1.5MB is not a problem.",
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
        what: "The original FIT/GPX/TCX bytes, written directly by the client through a presigned URL and kept on a cold tier for 12 months.",
        why: "This object is what makes the ack safe: the client is told 202 only once the bytes are durable here, so a region loss during processing costs a replay rather than an activity. Retaining the original is also the only recovery path when a firmware change exposes a parser bug months later.",
        numbers: ["~50KB per uploaded hour", "2.5B activities/yr", "~125TB rolling at 12 months"],
        breaks:
          "Twelve months is a hard cliff. A parser bug discovered in month 13 cannot be fixed by replay for the oldest cohort, because the only faithful record of what the device actually emitted has already expired.",
        choice: {
          pick: "Keep the raw bytes 12 months on a cold object-storage tier",
          instead: "Discard the original once parsing succeeds and keep only the cleaned stream.",
          decider:
            "The cost of the insurance against the cost of the incident. ~125TB rolling on a cold tier is a rounding error next to the ~190TB/yr of photo egress, and without it a per-device-model parser regression is unfixable rather than a replay of one (device_model, date_range) cohort.",
          flips:
            "When the parser is trivial and the source format is a stable in-house one you control end to end, at which point the cleaned stream is a faithful enough record and the raw copy is pure cost.",
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
        why: "The user-perceived latency of an upload and the cost of processing one have nothing to do with each other, so this tier does the minimum that must happen synchronously: establish durability, establish idempotency, and enqueue. Everything else is allowed to be seconds late.",
        numbers: ["~150ms ack", "~80 req/s steady, ~800/s peak", "p95 30s to feed, 90s to efforts"],
        breaks:
          "It owns duplicate suppression. Without the upload_uuid unique constraint, a client that retries after a network drop creates a second activity and a second set of efforts, and the athlete's own leaderboard entries start competing with each other.",
        choice: {
          pick: "Presigned PUT straight to object storage, ack after durability, publish an event",
          instead: "Proxy the upload bytes through the application tier and process inline.",
          decider:
            "Throughput the tier gains nothing by carrying. 800 uploads/s at ~50KB is ~40MB/s of body streaming through stateless boxes purely to hand it to S3 anyway, and inline processing puts the ~100ms mean plus a 300 to 600ms dense-metro tail into the athlete's request.",
          flips:
            "When the payload must be validated or transformed before it is allowed to land, for example a regulated pipeline that cannot store unverified bytes, where the proxy hop is the point.",
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
        what: "One object per activity holding per-channel arrays (latlng, altitude, heart rate, power, cadence) delta and zigzag encoded, then zstd compressed.",
        why: "Charts read whole channels, never individual points, so a columnar layout compresses far harder than row-major and is read as one sequential GET. It is deliberately cold: it is touched on roughly 1% of feed impressions, so it must not sit on the feed's critical path.",
        numbers: ["~8B/point effective, ~30KB/activity", "~75TB/yr, ~113TB erasure-coded", "one GET on tap"],
        breaks:
          "It is region-local by design and never replicated globally, so a follower in another region taps through to a cross-region read. That is the accepted price of not paying to copy 75TB/yr for reads that mostly never happen.",
        choice: {
          pick: "Per-channel columnar blob in object storage",
          instead: "Point rows in the activity database, or a time-series store.",
          decider:
            "Access shape against cost. 3,600 points times 2.5B activities is a row count no database should own for data that is only ever read whole, and columnar plus zstd lands at ~8B/point against ~32B raw, so the store is ~75TB/yr instead of ~290TB.",
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
        what: "The ~2KB feed representation: distance, elapsed, moving, elevation gain, counters and a Douglas-Peucker simplified encoded polyline of ~300 points.",
        why: "Roughly 99% of feed impressions never open the detail view, so the object the feed reads must be small enough that 20 of them are a cheap page. Partitioning by athlete_id and clustering by start_date makes an athlete's own history a single-partition scan too.",
        numbers: ["~500B row + ~1.5KB polyline", "20 rows = ~40KB per feed page", "~5TB/yr, ~15TB at RF=3"],
        breaks:
          "It is the fail-closed point for privacy. If the truncated polyline is written before the privacy zone is applied, the athlete's home address is published and cached downstream, so the publish path asserts truncation and ships no map at all rather than an untruncated one.",
        choice: {
          pick: "A separate ~2KB summary row, distinct from the stream blob",
          instead: "One record per activity holding the full point stream, read by both feed and detail.",
          decider:
            "The 15x size ratio against the read mix. A 20-activity feed page is ~40KB split against ~600KB unified, which is the difference between a p99 under 200ms and an unusable feed, and at ~40M MAU the wasted ~28KB per impression is the dominant egress line.",
          flips:
            "Short activities or an analysis-first product. A 20-minute run is ~1,200 points and a ~10KB stream, so the ratio falls to ~5x and one object avoids a second round trip and a reconciliation surface after reprocessing.",
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
        numbers: ["~80 events/s steady, ~800/s peak", "consumer lag SLO p99 < 60s", "separate backfill consumer group"],
        breaks:
          "At-least-once delivery means the same activity can be processed twice after a consumer restart, so every downstream write and every KOM notification has to be idempotent on (segment_id, effort_id).",
        choice: {
          pick: "A partitioned durable log with independent consumer groups",
          instead: "A work queue such as SQS, or synchronous processing in the upload request.",
          decider:
            "Replay and isolation at a 10x spike. Everything downstream is a pure function of the cleaned stream, so reprocessing 2.5B activities/yr means rewinding an offset rather than reconstructing input, and a second consumer group lets a backfill flood be shed while the live 800/s peak keeps its 90s budget.",
          flips:
            "A peak-to-steady ratio near 1 with a small corpus, say a single-city or race-timing deployment at ~50k segments where the funnel costs ~1ms, and a synchronous response removes the still-processing state entirely.",
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
        why: "Raw device output is wrong in specific, reproducible ways, and every number the athlete argues about comes from here. Cleaning server-side rather than trusting the device is also what makes the whole pipeline a pure function of (cleaned stream, index version, raster version), so a fix is a replay.",
        numbers: ["parse ~15ms, clean ~10ms, derive ~30ms", "540-point cafe drift cluster collapsed", "elapsed 1h38 against moving 1h29"],
        breaks:
          "It owns silent wrongness. A firmware update that emits a FIT variant the parser mishandles produces plausible but incorrect distance and elevation, which is only caught by per-device-model outlier alerts on those distributions.",
        choice: {
          pick: "Clean and derive server-side from the raw samples",
          instead: "Trust the distance and moving time the device already computed.",
          decider:
            "Fabricated distance. Consumer GPS wanders in a ~10m circle at ~0.3 m/s while genuinely still, so nine minutes at a cafe adds ~160m of distance and nine minutes of moving time unless clusters under ~15m for over 30s are collapsed to their centroid.",
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
        what: "Four narrowing stages: S2 cell prefilter, bounding-box reject, 15m corridor test against a spatial hash of the track's own points, then an ordered monotone map-match with direction and gap checks.",
        why: "The invariant is the design: any stage may pass a candidate that turns out not to match, no stage may drop one that does. That contract is what lets each stage be sloppy and fast, and it is why the ordering is by cost per candidate divided by rejection rate.",
        numbers: ["35M to 10k to 1.2k to 50 to 22", "~55ms p50, ~120ms p95, ~100ms fleet mean", "15m corridor, 25m bbox margin"],
        breaks:
          "Dense metros break stage 1: a level-13 cell in central London holds thousands of segment starts, so the prefilter returns ~80k candidates and the corridor stage dominates, which is why those cells adaptively descend to level 15.",
        choice: {
          pick: "A four-stage in-process funnel with an ordered map-match at the end",
          instead: "One proximity query against a spatial database such as PostGIS, then filter in the application.",
          decider:
            "Where the work lands. 80 to 800 multi-polygon proximity queries per second against one shared store, each returning thousands of rows you post-filter anyway, makes the database the ceiling, and stages 3 and 4 still run in the application because no spatial index expresses ordered directional traversal.",
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
        why: "Indexing by start point rather than full cell cover keeps it at one posting per segment, and it is safe only because an effort requires a complete traversal, which necessarily passes through the start point within the corridor width of some track point. That is the false-negative argument, and it is what the whole prefilter rests on.",
        numbers: ["~35M segments at ~500B = ~18GB", "cell index alone ~560MB", "level 13 is ~1.1km per cell area"],
        breaks:
          "Retroactive mutation. A segment created today was not in the index when historical activities were processed, so it has no efforts until a backfill runs, and a segment whose endpoint is edited orphans every effort timed against the old geometry.",
        choice: {
          pick: "The whole corpus RAM-resident on every matcher, keyed by level-13 start cell",
          instead: "A shared spatial database queried per upload, or a level-16 full cell cover per segment.",
          decider:
            "Row count against bytes. ~35M rows is enormous to query per upload and tiny to hold at ~18GB, and start-point indexing keeps the postings list at ~560MB rather than five or six times that for a full cover.",
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
        why: "This is the source of truth that every leaderboard is derived from, so partitioning by segment makes give me this segment's board a single-partition read and makes rebuilding a wiped Redis slot cheap. Efforts are never deleted, because a 2013 KOM is still the KOM.",
        numbers: ["~20 efforts/activity, ~50B/yr", "~1,600 writes/s steady, ~16k/s peak", "~120B/row, ~18TB/yr at RF=3"],
        breaks:
          "It owns the 20x write amplification, the largest row count in the system by an order of magnitude. Efforts are batched per activity so a partial batch failure replays the whole activity, which the idempotent effort key makes safe.",
        choice: {
          pick: "Wide-column partitioned by segment_id, clustered elapsed ASC",
          instead: "A relational table with indexes on both segment_id and athlete_id.",
          decider:
            "Write rate against row count. ~50B rows/yr at ~1,600 writes/s steady and ~16k/s at peak is past what one relational primary absorbs, and the dominant read is a single ordered partition scan with no joins in it.",
          flips:
            "Below roughly a billion efforts, where Postgres handles the write rate comfortably and real queries over filtered boards are worth more than headroom you are not using.",
        },
      },
    },
    {
      id: "leaderboards",
      label: "Leaderboards",
      sub: "Redis ZSET per segment (see #22)",
      kind: "database",
      col: 2,
      row: 4,
      detail: {
        what: "A sorted set per segment keyed seg:{id}:{board}, member athlete_id, score elapsed. The sorted-set mechanics are the leaderboard pattern in #22; only the write is Strava-specific.",
        why: "The Strava twist is ZADD key LT elapsed athlete_id, which overwrites only when the new time is lower, so best-per-athlete deduplication falls out of the write instead of needing a read-modify-write that two concurrent workers would race on.",
        numbers: ["top 1,000 for ~2M active segments", "~160GB against ~560GB materialised fully", "read p99 < 100ms"],
        breaks:
          "Hot keys. Alpe d'Huez concentrates writes on one ZSET and one efforts partition, so writes are buffered and applied in small batches and the athlete's own new PR has to be merged client-side to preserve read-your-writes.",
        choice: {
          pick: "Materialise top 1,000 for the ~2M segments with recent traffic; compute the rest on demand",
          instead: "Materialise every (segment, athlete) best across all ~35M segments.",
          decider:
            "Cold bytes. Every pair is ~7B entries at ~80B, about 560GB and mostly never read, against ~160GB for the boards anyone actually looks at, with the other ~33M segments served by a bounded single-partition read from efforts.",
          flips:
            "Age-group and weight-class filters on the few hundred genuinely famous segments, where materialising the filtered boards too is worth the write amplification because that is where all the read traffic goes.",
        },
      },
    },
    {
      id: "feed",
      label: "Feed fan-out",
      sub: "hybrid push/pull (see #8)",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "Pushes the new activity into followers' Redis timeline ZSETs and serves feed reads by hydrating summary rows, unchanged from the news-feed pattern in #8.",
        why: "The feed is deliberately decoupled from segment matching, because upload-to-feed and upload-to-efforts are separate SLOs: the athlete should see their ride long before the last of 22 efforts is written, and a matcher backlog must not delay the thing they actually look at.",
        numbers: ["~180 followers typical", "20 ids per page, ~40KB hydrated", "read p99 < 180ms"],
        breaks:
          "Pro athletes with ~1M followers make fan-out-on-write expensive, so the push threshold is set lower here than in #8 because activity volume per athlete is ~1/day rather than ~20 posts/day.",
        choice: {
          pick: "Hybrid push/pull with a lower push threshold than a social timeline",
          instead: "Pure fan-out-on-write to every follower, or pure pull at read time.",
          decider:
            "Posting rate. At ~1 activity/day per athlete the write cost of pushing is low, so push is right for the long tail, but a ~1M-follower account still makes a single upload a million writes and belongs on the pull side.",
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
        what: "Two small control calls: POST /uploads/init to get a presigned URL, then a commit carrying the client-generated upload_uuid.",
        why: "The uuid is minted when recording starts, not when uploading starts, so a retry after a network drop presents the same key and the second commit returns the existing activity_id rather than creating a twin.",
        numbers: ["~150ms end to end", "202 processing returned"],
        breaks:
          "If the uuid were generated at upload time instead, every retry would look like a distinct activity and the athlete would compete against themselves on every leaderboard the ride touched.",
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
        why: "The API gains nothing by carrying the body, and this is the write that establishes durability. The 202 is only allowed to be returned once these bytes exist, so a process or region loss afterwards costs a replay rather than the ride.",
        numbers: ["~50KB per uploaded hour", "800 PUTs/s at peak"],
        breaks:
          "A presigned URL is a bearer capability with a lifetime, so it must be scoped to one key and expire quickly or it becomes an open write handle into the bucket.",
      },
    },
    {
      id: "e3",
      from: "upload-api",
      to: "kafka",
      tier: "hot",
      label: "activity.uploaded",
      detail: {
        what: "One event per committed upload, published after the uploads row is written and before the client is acked.",
        why: "This is the seam between the 150ms the athlete waits and the ~1s of work behind it. Publishing rather than calling means a matcher outage becomes consumer lag instead of upload failures on a Saturday morning.",
        numbers: ["~80/s steady, ~800/s peak"],
        breaks:
          "Publish and the database write are not one transaction, so a crash between them loses the event with the row still present; the reconciliation is a sweep over uploads rows with no activity after N minutes.",
      },
    },
    {
      id: "e4",
      from: "kafka",
      to: "workers",
      tier: "hot",
      label: "consume, lag SLO 60s",
      detail: {
        what: "Workers consuming the upload event and beginning the parse, clean and derive stage.",
        why: "Consumer lag on this topic is the leading indicator for both latency SLOs and the autoscaling signal for the fleet, because lag moves minutes before CPU does and the weekend spike is predictable enough to pre-warm against.",
        numbers: ["p99 lag < 60s", "10x weekend spike absorbed as depth"],
        breaks:
          "At-least-once delivery redelivers on restart, so the same activity is reprocessed and every downstream write has to be idempotent or a replay doubles the efforts.",
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
        numbers: ["~50KB per fetch"],
        breaks:
          "Once the 12-month TTL expires this read fails, so any replay campaign is bounded by retention rather than by the pipeline's ability to run it.",
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
        why: "This is the canonical stream every later stage is a function of, and putting it in object storage rather than a database keeps ~75TB/yr off the tier that serves the feed.",
        numbers: ["~8B/point effective", "~30KB/activity"],
        breaks:
          "It is written before the summary, so a crash between the two leaves a stream with no feed entry, which is invisible until someone deep-links to the activity.",
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
        why: "The feed must never read the stream, so the summary has to be self-sufficient: everything the card and its map need is in this one row, which is what holds a 20-activity page at ~40KB.",
        numbers: ["3,600 points down to ~300", "~5B/point polyline encoding"],
        breaks:
          "This is the fail-closed privacy boundary. If the zone service cannot be reached the activity publishes with no map at all, because a truncation that silently does not happen leaks the athlete's home.",
      },
    },
    {
      id: "e9",
      from: "workers",
      to: "matcher",
      tier: "hot",
      label: "cleaned track, 3,600 pts",
      detail: {
        what: "The cleaned, smoothed point array handed to the matcher, along with the track's bounding box and S2 cover.",
        why: "Matching runs on the cleaned stream and never on raw samples, because drift clusters and teleports would both corrupt the corridor test and stall the monotone cursor. Cleaning first is what makes the funnel's cardinalities hold.",
        numbers: ["3,600 points for a 90-minute ride", "~210 level-13 cells for 40km"],
        breaks:
          "Over-aggressive smoothing pulls points off the road and away from segment vertices, which shows up as a rise in the zero-effort upload rate rather than as any error.",
      },
    },
    {
      id: "e10",
      from: "matcher",
      to: "seg-index",
      tier: "hot",
      label: "cell lookup, 35M to 10k",
      detail: {
        what: "A hash probe per covered cell into the local start-cell index, unioning the candidate segment ids.",
        why: "It is drawn as a local read rather than a network call on purpose: this arrow is the whole reason the corpus is RAM-resident, because as a database round trip it would be 80 to 800 proximity queries per second against one shared store.",
        numbers: ["~210 cells probed", "~9,800 candidates from ~35M", "~3ms"],
        breaks:
          "In a dense metro this returns ~80k rather than ~10k, so the per-cell adaptive descent to level 15 must be identical on every matcher or two nodes derive different efforts from the same activity.",
      },
    },
    {
      id: "e11",
      from: "matcher",
      to: "efforts",
      tier: "hot",
      label: "~22 efforts, batched",
      detail: {
        what: "The surviving matches written as narrow effort rows with interpolated entry and exit times, batched per activity.",
        why: "Entry and exit are interpolated between the bracketing 1Hz samples rather than snapped to them, because 2s of quantisation on a 3-minute effort is 1% and that decides crowns. Interpolation is deterministic, so a replay produces an identical time.",
        numbers: ["~20 efforts per activity", "~1,600 writes/s steady, ~16k/s peak"],
        breaks:
          "A partial batch failure means replaying the whole activity's efforts, which is only safe because the effort key is idempotent on the activity and segment pair.",
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
        why: "LT makes the sorted set the arbiter instead of the worker. A read-modify-write races when two efforts on the same segment are processed concurrently and both believe they took the KOM; ZADD plus ZRANGE 0 0 in one Lua script means exactly one observes itself at rank 1.",
        numbers: ["one ZADD per effort", "top 100 cached with a short TTL"],
        breaks:
          "The ZSET is a cache, not the truth. A lost Redis node wipes its slots, and those boards are rebuilt from single efforts partition reads while serving directly from efforts in the meantime.",
      },
    },
    {
      id: "e13",
      from: "summary-store",
      to: "feed",
      tier: "data",
      label: "hydrate 20 rows",
      detail: {
        what: "The feed service reading summary rows for the activity ids it popped from a follower's timeline ZSET.",
        why: "The timeline holds ids only, so the hydrate is where the ~2KB representation earns its keep: 20 rows is ~40KB of JSON, which is what keeps the read inside a 200ms p99 on a mobile connection.",
        numbers: ["20 ids per page", "~40KB per page", "p99 ~180ms"],
        breaks:
          "A follower in another region hydrates against replicated summaries, so summaries replicate globally while the streams behind them deliberately do not.",
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
        numbers: ["p95 30s from upload to visible", "~40KB per page"],
        breaks:
          "Efforts are eventually consistent against this, so an athlete can see their own activity before their KOM notification arrives and the UI has to be honest about still processing.",
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
        why: "Drawn as a separate, colder arrow because it is the half of the storage split that almost never runs. Serving it from object storage through the CDN keeps the analysis view off the feed's critical path entirely.",
        numbers: ["~30KB zstd", "roughly 1% of impressions"],
        breaks:
          "The stream is region-local, so a tap on a distant follower's ride is a cross-region read with a visibly worse tail than the feed that led to it.",
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
        what: "The retroactive path: when a segment is created, candidate historical activities are found through a coarse level-11 activity cell index and their streams re-read to run stages 3 and 4 only.",
        why: "The corpus mutates under the derived data, so a new segment on a busy road has to acquire efforts from rides recorded years earlier. The backfill index is deliberately coarser than the matching index because backfill can afford false positives.",
        numbers: ["level 11, ~400B/activity, ~1TB/yr", "capped at 24 months"],
        breaks:
          "One new segment on a popular road can enqueue millions of stream fetches and saturate object-store egress, so backfill runs on its own consumer group with a hard rate limit and is shed before the live pipeline is touched.",
      },
    },
  ],
};
