import type { Diagram } from "./types";

export const YOUTUBE: Diagram = {
  id: "youtube",
  title: "YouTube",
  question: "Design YouTube",
  sourceId: "patterns",
  itemId: 11,
  overview: {
    shape:
      "Two systems that touch at exactly one place: a write path that turns a stranger's file into cacheable segments as cheaply as it can get away with, and a read path where a CDN serves essentially every byte and the origin serves almost none.",
    beats: [
      "Upload never touches an application server. The client asks for presigned multipart URLs, splits a 2.5GB file into 5MB parts and PUTs them straight into object storage, tracking which parts are confirmed so a dropped connection resumes at part 47 rather than at zero. Completion of the object is the event that enqueues a job.",
      "The transcode DAG then does the smallest useful thing. Probe the container, re-cut the source at forced closed GOPs into six-second segments, encode two rungs only at 360p and 720p, fan the segments across GPU workers, package once as CMAF fragmented MP4 with an HLS playlist and a DASH manifest over the same bytes, extract thumbnails, publish. For a 12-minute upload that is 240 segment jobs and under a minute of wall clock.",
      "In parallel, a frame and audio classifier pass and a fingerprint match against the rights database return a verdict. Publication is gated on that verdict rather than on the encode finishing, which is why upload readiness, publish readiness and full-quality readiness are three separate state fields rather than one status enum.",
      "Everything above 720p is earned. An escalation controller watches per-video view velocity over a sliding window plus the channel's prior, and only then commissions 1080p, 4K, per-title ladder analysis and AV1. Around 5% of uploads cross the threshold, which is what turns a 3,600-GPU fleet into a 1,200-GPU one and 2.9PB/day of encoded output into 1.15PB.",
      "Delivery is pull-through. The player reads a manifest, estimates its own bandwidth and pulls six-second segments from the nearest edge; on a miss the edge goes to a shield tier that collapses thousands of correlated misses for the same object into one origin fetch. Only a predicted-hot slice is pushed out in advance, because one day of uploads is several times what an edge appliance holds.",
      "The asymmetry that falls out of escalation is that segments are immutable and manifests are not. Segment URLs are keyed by source hash, rung, encoder build and index and carry a year with immutable; manifests are rewritten when a rung lands and carry max-age=60, which bounds how long an edge keeps telling viewers the video tops out at 720p.",
    ],
    crux:
      "You have to commit the expensive work before the information that would justify it exists. Half of uploads never reach 100 views and the top 1% take 80% of watch time, but you learn which is which hours after the encode decision was made, so escalation is reactive by construction and the fastest-rising videos are served at the floor rung during exactly the hour their audience is largest.",
    numbers: [
      "500 hours uploaded per minute, 8.3 source-hours per second",
      "~1,200 GPUs and 1.15PB/day against ~3,600 and 2.9PB for the full ladder",
      "~83 Tbps average egress, ~800 bytes served per byte produced",
    ],
  },
  nodes: [
    {
      id: "pipeline-group",
      label: "Transcode DAG",
      kind: "group",
      x: 24,
      y: 184,
      w: 312,
      h: 308,
      detail: {
        what: "The asynchronous half of the system: orchestration, segment encoding and packaging, run once at the floor and re-run per escalation.",
        why: "Nothing in this box is on a viewer's critical path, which is the property that lets it be queued, retried, shed under load and revisited weeks later. A transcode backlog degrades the creator experience and leaves playback untouched.",
        numbers: ["240 jobs for a 12-minute floor pass", "under 60s upload-to-playable at p50"],
        breaks:
          "The box is long-running, so worker loss mid-graph is normal rather than exceptional and every node in it has to be safe to re-run.",
      },
    },
    {
      id: "creator",
      label: "Creator client",
      sub: "5MB parts, resumable",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The uploader's browser or app, splitting the source file into fixed-size parts and tracking which parts the object store has confirmed.",
        why: "A 2.5GB upload over a mobile connection will fail at least once, so the design assumption is that it always fails. Keeping the confirmed-part list on the client is what makes a resume cost one part rather than the whole file.",
        numbers: ["~2.5GB for a 20-minute upload", "~25k concurrent uploads at peak", "mean in-flight duration ~5 min"],
        breaks:
          "If resumable state is lost mid-file the client restarts from zero, which shows up as an offset-mismatch rate and a pile of abandoned multipart sessions.",
      },
    },
    {
      id: "upload-api",
      label: "Upload API",
      sub: "presigned multipart, no bytes",
      kind: "compute",
      x: 440,
      y: 0,
      w: 240,
      detail: {
        what: "A stateless tier that mints presigned part URLs, creates the video row, and accepts the completion call. It never sees video bytes.",
        why: "At 8.3 source-hours arriving every second the ingest tier is the one place where handling bytes would be catastrophic. Handing out presigned URLs moves the transfer to the object store, so this tier scales on request rate rather than on bandwidth.",
        numbers: ["83 upload starts/s at peak", "~1GB per source hour of raw material"],
        breaks:
          "It owns the upload_id to object mapping, so a lost session record orphans a half-written multipart upload that nobody will ever complete or abort.",
        choice: {
          pick: "Presigned multipart URLs, client writes directly to object storage",
          instead: "Stream the upload through the application tier and have it write to storage.",
          decider:
            "Concurrency and bandwidth. ~25k concurrent uploads at peak, each averaging five minutes and ~1GB per source hour, would pin 25k long-lived connections and 720TB/day of transit on an application fleet that otherwise does nothing but issue URLs. Presigning makes those object-store multipart sessions instead.",
          flips: "When you must inspect or transform bytes in flight, for example virus scanning or watermarking at ingest, or at volumes low enough that one modest fleet absorbs the transfer.",
        },
      },
    },
    {
      id: "source-store",
      label: "Source object store",
      sub: "archive tier, kept forever",
      kind: "store",
      x: 40,
      y: 100,
      w: 280,
      detail: {
        what: "Raw uploads at src/{video_id}/{source_hash}, in an archive-class tier, replicated cross-region before the upload is acknowledged.",
        why: "Every derivative is recomputable from this object and nothing else is, so it is the only thing in the system with a zero RPO. It is also the input to escalation runs that may happen weeks after the floor pass.",
        numbers: ["~720TB/day of source", "~1GB per source hour", "retained permanently"],
        breaks:
          "Cross-region source replication is the dominant DR cost line at 720TB/day, and it is the one thing that cannot be regenerated if you get it wrong.",
        choice: {
          pick: "Archive-class object storage, source retained permanently",
          instead: "Delete the source once the floor rungs exist and treat the 720p rendition as the master.",
          decider:
            "What escalation and codec migration need to read. Re-encoding 1080p or AV1 from a 2.5 Mbps 720p rendition compounds generation loss, and at ~720TB/day against 1.15PB/day of derivatives the source is the cheaper half of the bill sitting in a tier 10x to 20x below standard.",
          flips: "When storage genuinely dominates and the ladder is frozen, so nothing will ever be re-encoded, which is the case for short-lived or ephemeral media rather than a permanent catalogue.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Transcode orchestrator",
      sub: "Temporal DAG, Kafka fan-out",
      kind: "compute",
      x: 40,
      y: 200,
      w: 280,
      detail: {
        what: "Owns the job graph: probe, split at forced closed GOPs, fan segment jobs onto the work queue, verify, publish. Workers own no state.",
        why: "The graph is long-running, partially failing and re-entrant. Retrying a single segment rather than the video, and enforcing the uploaded, floor-published and escalated transitions in one place, is what keeps a 240-job pass from becoming 240 chances to publish something broken.",
        numbers: ["120 segments x 2 rungs for a 12-minute video", "6s segments, keyframes aligned across rungs"],
        breaks:
          "Publishing a manifest before every segment of a rung exists hands players a mid-playback 404, and most players stall rather than stepping down a rung, so segment count and summed duration are verified unconditionally before promotion.",
        choice: {
          pick: "Temporal for the DAG and readiness state machine, Kafka as the segment work queue",
          instead: "Chained queue consumers with the state inferred from what exists in the bucket.",
          decider:
            "Fan-out plus lifetime. One pass is 240 jobs whose failures must be retried individually, and escalation re-enters the same graph weeks later against a video that already has two rungs. Inferring state from bucket listings gives you no per-node retry and no way to express three independent readiness fields.",
          flips: "A linear pipeline with a handful of steps and no second pass, where a workflow engine is a service to operate for a state machine you could have written in a table.",
        },
      },
    },
    {
      id: "encoders",
      label: "GPU encode fleet",
      sub: "ffmpeg NVENC, segment-parallel",
      kind: "compute",
      x: 40,
      y: 300,
      w: 280,
      detail: {
        what: "Stateless workers that each pull one contiguous byte range of the source and emit one encoded segment for one rung.",
        why: "Segments are independent only because the split step forced closed GOPs at fixed timestamps, and that independence is what turns 20 minutes of video into tens of seconds of wall clock. The floor is 360p and 720p; everything above it is commissioned later.",
        numbers: ["~15x realtime for one 1080p rung", "7.3 GPU-min/source-hour full ladder vs 2.2 at the floor", "~1,200 GPUs against ~3,600"],
        breaks:
          "Below a few minutes of source the job is bound by object-store round trips rather than GPU, so adding workers makes it slower; under ~60s of source the video is encoded whole on one worker.",
        choice: {
          pick: "Hardware H.264 on GPUs, segment-parallel at 6s, floor rungs only",
          instead: "CPU x264 encoding, or encoding the whole file on one worker.",
          decider:
            "Fleet arithmetic at 8.3 source-hours/s. Hardware encode runs several times faster than CPU at comparable quality, and the floor at 0.55 1080p-equivalents against a full ladder at 1.82 is the difference between ~1,200 and ~3,600 saturated GPUs. Job output paths are pure functions of input plus encoder build, so a retry overwrites itself byte for byte.",
          flips: "When quality per bit is worth more than throughput, which is the curated-catalogue case, or for the small share of titles where a slow software encode repays itself in egress.",
        },
      },
    },
    {
      id: "packager",
      label: "CMAF packager",
      sub: "fMP4 once, HLS + DASH manifests",
      kind: "compute",
      x: 40,
      y: 400,
      w: 280,
      detail: {
        what: "Writes fragmented MP4 segments once, emits an HLS playlist and a DASH MPD over the same objects, and extracts thumbnails on the floor pass.",
        why: "iOS requires HLS and everything else speaks DASH, but since HLS gained fMP4 support in 2016 the difference is two small text files rather than two copies of the bytes. Thumbnails are generated here because they are cheap and creator-visible immediately, unlike everything expensive.",
        numbers: ["a 6s 720p segment is ~1.9MB", "manifests ~5KB", "~900M new objects/day at the floor"],
        breaks:
          "It writes the mutable half of the system. A manifest rewritten before its segments are durable, or rungs whose keyframes sit at different presentation timestamps, both surface as a stall on quality switch rather than as an error.",
        choice: {
          pick: "One CMAF fMP4 byte-stream, two manifests over it",
          instead: "MPEG-TS segments for HLS and separate fMP4 segments for DASH.",
          decider:
            "Duplicate storage for no compatibility gain. Two segment formats doubles 1.15PB/day of encoded output and doubles a 900M-object/day PUT bill that already runs ~$4.5k/day. CMAF standardised the container in 2018 and HLS has read fMP4 since 2016, so the compatibility argument for the split has expired.",
          flips: "When you must serve players old enough to require transport-stream HLS, where the duplication is the price of reaching them at all.",
        },
      },
    },
    {
      id: "moderation",
      label: "Moderation + rights gate",
      sub: "classifiers, fingerprint match",
      kind: "compute",
      x: 440,
      y: 200,
      w: 240,
      detail: {
        what: "A parallel branch of the DAG: frame and audio classifiers plus a fingerprint match against the rights database, returning a verdict in seconds.",
        why: "This is the only design in the media cluster where the content itself is untrusted, so publication is a gated event rather than a deployment step. The gate is risk-tiered, and everything slower than a few seconds runs after the video is live with tombstoning available at any point.",
        numbers: ["1 frame/s sampled, ~720 frames per 12-min video", "~0.7 GPU-seconds/video, ~30 GPUs platform-wide", "3.6M videos/day"],
        breaks:
          "It owns the exposure window. Fingerprinting loses to combinations of re-encoding, cropping, mirroring and pitch-shifting, so low-reach infringement is largely uncaught and the honest metric is exposure-hours before takedown rather than an incident count.",
        choice: {
          pick: "Synchronous classifier and fingerprint gate, human review asynchronous",
          instead: "Hold every upload private until human review clears it.",
          decider:
            "3.6M videos/day at 5 minutes of review each is 300k reviewer-hours/day, about 37,500 full-time reviewers, so a universal human gate is not expensive but arithmetically unavailable. The classifier pass costs ~30 GPUs against a 1,200-GPU encode fleet, so there is no cost case for skipping it either.",
          flips: "Where a single exposure is unacceptable and volume is small enough to pay for: accounts under 24 hours old, scores in the uncertain band, known-harmful hashes, and jurisdictions with pre-publication obligations.",
        },
      },
    },
    {
      id: "metadata",
      label: "Metadata store",
      sub: "videos, video_rungs",
      kind: "store",
      x: 440,
      y: 400,
      w: 240,
      detail: {
        what: "Sharded by video_id: title, duration, and three separate state fields for upload, publish and quality tier, plus one row per completed rung.",
        why: "Uploaded, published and escalated are independent events, and conflating them into one status is the classic mistake here: it tells creators a video is ready when it is not, and gives the manifest generator a partial-rung case it cannot represent.",
        numbers: ["3.6M new video rows/day", "a rung row exists only once the rung is complete"],
        breaks:
          "It is the fast half of a takedown. Manifest hydration reads publish_state, so a tombstone stops new playback within seconds while cached segment URLs stay fetchable until they are purged or evicted.",
        choice: {
          pick: "Three state fields plus a wide-column video_rungs table",
          instead: "A single status enum on the video row covering the whole lifecycle.",
          decider:
            "The states are not ordered. A video can be published at the floor and escalating, or fully encoded and blocked on a rights verdict, and one enum over 3.6M videos/day forces a combinatorial state list that every reader has to interpret identically. Writing a rung row only on completion removes the partial-state case entirely.",
          flips: "A pipeline with a genuinely linear lifecycle and one output, where an enum is legible and a second table is ceremony.",
        },
      },
    },
    {
      id: "encoded-store",
      label: "Encoded object store",
      sub: "origin, lifecycle by last access",
      kind: "store",
      x: 40,
      y: 500,
      w: 280,
      detail: {
        what: "The origin: segments at seg/{source_hash}/{rung}/{encoder_build}/{index}.m4s and manifests at mf/{video_id}, tiered by last access.",
        why: "Segment paths are content-addressed down to the encoder build so a re-encode can never overwrite an object already cached somewhere in the world. That immutability is what lets segments carry a year of TTL, which is what makes the delivery path a dumb cache.",
        numbers: ["1.15PB/day encoded, ~2.6PB/day with erasure coding", "~950PB/year", "archive tiers 10x to 20x below standard"],
        breaks:
          "Below a low access threshold the right move is deletion rather than demotion, so a reawakened long-tail video needs a re-encode taking minutes; keeping the 360p rung of everything warm forever removes that from the user-visible path.",
        choice: {
          pick: "Lifecycle by last access, then delete derivatives and keep source plus 360p",
          instead: "Keep every rendition of every video in standard storage forever.",
          decider:
            "~1EB/year of growth. Storing seven renditions of a video with 40 lifetime views for a decade is the single largest avoidable line item, and re-encoding costs seconds of GPU against storage that costs forever. Archive tiers run 10x to 20x below standard and ~90% of the catalogue goes untouched after 30 days.",
          flips: "When restore latency is contractual, or the catalogue is small enough that the whole tiering apparatus costs more to operate than the bytes it saves.",
        },
      },
    },
    {
      id: "escalation",
      label: "Escalation controller",
      sub: "Redis view velocity + priors",
      kind: "compute",
      x: 440,
      y: 600,
      w: 240,
      detail: {
        what: "Counters over a sliding window of views in the last hour, plus the channel's median first-day views as a prior, deciding which videos get the expensive rungs.",
        why: "This is the piece that makes the question different from a curated catalogue. Nothing above the floor is produced without its say-so, so the threshold is a control loop against fleet cost rather than a constant somebody hardcoded.",
        numbers: ["threshold tuned so ~5% of uploads cross it", "escalation stops paying above ~30%", "escalation is one-way"],
        breaks:
          "It is reactive by construction: a video going from zero to a million views in ten minutes is served at 720p through its entire ramp, and no signal available at ingest distinguishes a first-time uploader from the half that never reach 100 views.",
        choice: {
          pick: "Two rungs at ingest, upper rungs commissioned on view velocity and channel priors",
          instead: "Encode the full seven-rung ladder for every upload and never revisit a video.",
          decider:
            "~3,600 GPUs and 2.9PB/day against ~1,200 and 1.15PB/day, a 3x compute and 60% storage difference on a catalogue where half of uploads never reach 100 views. Note that a 1080p floor is not the moderate compromise it looks like: 1080p alone costs more than every rung beneath it combined and takes the fleet back to ~3,100.",
          flips: "A small or curated catalogue where every asset is known to be worth the money, at low absolute volume where 3x of a small number beats operating a controller, or on a paid tier that contractually promises 4K on publish.",
        },
      },
    },
    {
      id: "shield",
      label: "Origin shield",
      sub: "coalesces concurrent misses",
      kind: "compute",
      x: 40,
      y: 600,
      w: 280,
      detail: {
        what: "A mid-tier cache between the edges and the origin that collapses simultaneous misses for the same object into one origin fetch.",
        why: "Misses are not independent. A fast-rising video has thousands of edges wanting the same segment within the same second, and without coalescing that arrives at the origin as a correlated burst rather than as the 5% average the capacity plan assumed.",
        numbers: ["~4 Tbps origin at 95% offload", "45PB/day origin egress, ~9PB at 99%"],
        breaks:
          "It concentrates the miss path, so a shield outage does not degrade gracefully: every edge falls through to origin at once and cache-fill amplification spikes exactly when demand does.",
        choice: {
          pick: "Shield tier between edges and origin",
          instead: "Let every edge fetch from origin directly.",
          decider:
            "The last few percent arrives correlated. At 95% offload the origin still serves 5% of 900PB/day, about 4 Tbps, and that residue is bursty rather than smooth, so the number that sizes origin is the correlated peak and not the average.",
          flips: "A small edge footprint where fan-in is already low, and the extra hop adds latency to every miss for coalescing that rarely fires.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "immutable segments, ~95% offload",
      kind: "external",
      x: 40,
      y: 700,
      w: 280,
      detail: {
        what: "The tier that actually serves the bytes: pull-through on miss, with a predicted-hot slice pushed out in advance.",
        why: "In aggregate the system serves ~800 bytes for every byte it produces, so the design question is cache strategy and egress rather than application throughput. Nothing between the player and the object store holds per-viewer session state, which is precisely what makes this tier a dumb cache.",
        numbers: ["~83 Tbps average, ~250 Tbps peak", "segments max-age=31536000 immutable", "manifests max-age=60"],
        breaks:
          "Long segment TTLs are load-bearing for the cost model and directly oppose immediate takedown: a cached segment URL stays fetchable across tens of thousands of edges and third-party appliances for minutes at best after the manifest has already stopped serving.",
        choice: {
          pick: "Pull-through by default, push only the predicted-hot slice",
          instead: "Pre-position the catalogue to edges and ISP-embedded appliances ahead of demand.",
          decider:
            "Daily growth against appliance capacity. One day of encoded output is 1.15PB and an ISP-embedded appliance holds 100 to 500TB, so a single day of uploads is 2x to 10x what one box holds before the back catalogue exists. What can be pushed is the slice that fits, and 80% of watch time in ~1% of videos means that slice is also the one that matters.",
          flips: "A catalogue that fits on the appliance, which is the curated case, and per-event for a scheduled fixture where one planned fill beats millions of correlated misses.",
        },
      },
    },
    {
      id: "viewer",
      label: "Viewer player",
      sub: "ABR, picks its own rung",
      kind: "external",
      x: 40,
      y: 800,
      w: 280,
      detail: {
        what: "The player: fetches a manifest, estimates bandwidth from its own download timings, and requests the next six-second segment at whichever rung it chooses.",
        why: "Bandwidth changes during playback and the server cannot observe it, so the decision belongs to the only party holding the measurement. A Wi-Fi to cellular handover becomes a quality drop rather than a stall.",
        numbers: ["time-to-first-frame under 500ms at p95", "rebuffer under 0.5% of watch time", "6s segments"],
        breaks:
          "A player mid-playback will not see an escalated rung until it refreshes the manifest, and most refresh only on a seek or a stall, so a quality upgrade lands on the next viewer rather than the current one.",
        choice: {
          pick: "Client-side adaptive bitrate over a text manifest",
          instead: "Server-side session-managed streaming, or progressive download of one file.",
          decider:
            "Cacheability. ABR keeps zero per-viewer state between the player and the object store, which is what allows a year of TTL on segments and ~95% edge offload of ~83 Tbps. A server-side session would put a stateful hop in front of every one of those bytes.",
          flips: "Very short clips, where the whole file lands before the first adaptation decision would have fired and progressive download is simpler and faster.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "creator",
      to: "upload-api",
      label: "init: presigned parts",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "POST /upload/init returning an upload_id, a part size and a list of presigned part URLs.",
        why: "It is drawn as a control path because it is the only part of the upload the application tier participates in. Everything after it is the client talking to storage directly, which is what keeps this tier stateless at 83 upload starts a second.",
        numbers: ["83 upload starts/s at peak"],
        breaks: "Presigned URLs expire, so a long-running upload has to be able to ask for fresh ones without restarting the session.",
      },
    },
    {
      id: "e2",
      from: "creator",
      to: "source-store",
      label: "5MB parts, direct PUT",
      animated: true,
      detail: {
        what: "The video bytes themselves, written part by part straight into object storage and acknowledged individually.",
        why: "This is the arrow that must not pass through a server. Part-level acknowledgement is what turns a failure at part 47 into a resume at 47 rather than at zero, and it keeps 25k concurrent uploads off the application fleet.",
        numbers: ["~2.5GB for a 20-minute upload", "~720TB/day of source"],
        breaks: "An abandoned multipart session leaves orphaned parts that are billed until a lifecycle rule aborts them.",
      },
    },
    {
      id: "e3",
      from: "upload-api",
      to: "metadata",
      label: "video row created",
      // Route down the right of the column so the label clears the node it
      // would otherwise sit on top of.
      offset: 70,
      fromSide: "right",
      toSide: "right",
      dashed: true,
      detail: {
        what: "Creating the video row with upload_state set and publish_state unset.",
        why: "The row has to exist before the bytes finish so the creator has something to poll, and so the pipeline has somewhere to record readiness transitions when the completion event fires.",
        breaks: "If the row and the multipart session disagree the video is invisible to the creator while its bytes are being paid for.",
      },
    },
    {
      id: "e4",
      from: "source-store",
      to: "orchestrator",
      label: "completion event",
      detail: {
        what: "The bucket completion event for the assembled source object, which enqueues a transcode job.",
        why: "Durability of the source is the trigger, not the client's claim to have finished. Starting from the object means a retry weeks later reads exactly the same bytes and the job is safe to replay.",
        numbers: ["~3.6M videos/day"],
        breaks: "A dropped or duplicated event either strands a video in processing forever or starts two passes, which is why job identity comes from the source hash.",
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "encoders",
      label: "240 segment jobs",
      animated: true,
      detail: {
        what: "Segment jobs on the work queue, one per segment per rung, each carrying the byte range recorded by the split step.",
        why: "Passing byte offsets rather than letting each worker seek the source is what keeps the fan-out from becoming an object-store round-trip storm, which is the real bound on short videos.",
        numbers: ["120 segments x 2 rungs for 12 minutes", "at most 0.4 GPU-seconds per 720p segment"],
        breaks: "Past a few hundred workers on one video every extra worker is another set of round trips against the same source object, so the job gets slower rather than faster.",
      },
    },
    {
      id: "e6",
      from: "encoders",
      to: "packager",
      label: "fMP4 segments",
      detail: {
        what: "Completed per-rung segments handed to packaging once the orchestrator has verified the count and summed duration.",
        why: "Packaging is cheap and encoding is not, so the split lets a rung be published the moment its own segments exist rather than waiting on the rest of the ladder.",
        breaks: "Rungs whose keyframes sit at different presentation timestamps cannot be switched between mid-stream, and this is the last step that can catch it.",
      },
    },
    {
      id: "e7",
      from: "packager",
      to: "encoded-store",
      label: "segments + 2 manifests",
      animated: true,
      detail: {
        what: "Writing fragmented MP4 segments to content-addressed paths and promoting the HLS and DASH manifests atomically.",
        why: "Segments go down first and the manifest last, because a manifest that references a segment which is not there yet hands every player a 404 mid-playback and most players stall instead of stepping down.",
        numbers: ["~900M new objects/day", "~$4.5k/day in PUTs alone"],
        breaks: "Object count is a real cost line here rather than a rounding error, which is one of the arguments against producing rungs nobody asked for.",
      },
    },
    {
      id: "e8",
      from: "orchestrator",
      to: "moderation",
      label: "1 frame/s + fingerprint",
      dashed: true,
      detail: {
        what: "A parallel branch of the DAG running frame and audio classifiers and a fingerprint match while the encode proceeds.",
        why: "It runs alongside rather than after because it is cheap and the encode is not, so gating on it costs nothing in wall clock. Publication waits on both branches, not on either one alone.",
        numbers: ["~0.7 GPU-seconds per video", "~30 GPUs platform-wide"],
        breaks: "At a 1% false-positive rate a synchronous gate wrongly delays about 36,000 legitimate creators a day, which is why the gate is risk-tiered rather than uniform.",
      },
    },
    {
      id: "e9",
      from: "moderation",
      to: "metadata",
      label: "verdict gates publish",
      dashed: true,
      detail: {
        what: "An append-only verdict row per check, and the flip of publish_state when both branches come back green.",
        why: "Verdicts are appended rather than overwritten because a takedown has to be able to show what was known at the time it was allowed through.",
        breaks: "Publishing on the encode verdict alone would make visibility a deployment step rather than a gated event, which is the whole distinction this design turns on.",
      },
    },
    {
      id: "e10",
      from: "orchestrator",
      to: "metadata",
      label: "readiness + rungs",
      dashed: true,
      detail: {
        what: "Writing a video_rungs row per completed rung and moving the video through uploaded, floor-published and escalated.",
        why: "The rung row exists only once every segment of that rung is durable, so the manifest generator reads a table with no partial state in it and needs no special case.",
        numbers: ["one row per completed rung"],
        breaks: "If readiness is inferred from bucket contents instead, a half-written rung looks complete and gets advertised in a manifest.",
      },
    },
    {
      id: "e11",
      from: "encoded-store",
      to: "shield",
      label: "origin fetch on miss",
      detail: {
        what: "The origin read that fills the shield, one per object no matter how many edges asked for it simultaneously.",
        why: "This is the only path by which viewer traffic reaches storage at all, and it exists to be rare: at 95% offload it carries 5% of 900PB/day.",
        numbers: ["45PB/day, about 4 Tbps"],
        breaks: "Cold-tier objects are minutes away rather than milliseconds, so a reawakened long-tail video stalls here unless a warm rung was kept.",
      },
    },
    {
      id: "e12",
      from: "shield",
      to: "cdn",
      label: "one fill per object",
      detail: {
        what: "The coalesced fill going back out to whichever edges are waiting on that object.",
        why: "Thousands of edges missing the same segment in the same second is the normal shape of a rising video, and collapsing them into one fetch is the difference between an origin sized for the average and one sized for the burst.",
        breaks: "The coalescing window is finite, so a stampede spread across slightly different segment indices still fans in.",
      },
    },
    {
      id: "e13",
      from: "cdn",
      to: "viewer",
      label: "segments, ~95% at edge",
      animated: true,
      detail: {
        what: "The manifest and then a stream of six-second segments, served from the nearest edge at whatever rung the player asked for.",
        why: "This is where essentially all the bytes in the system go. Segments are immutable at content-addressed URLs so they cache for a year; the manifest is the mutable exception and carries 60 seconds.",
        numbers: ["~83 Tbps average, ~250 Tbps peak", "~1.9MB per 6s 720p segment"],
        breaks: "An edge holding a stale manifest keeps serving a video that appears to top out at 720p for up to a minute after escalation completed.",
      },
    },
    {
      id: "e14",
      from: "viewer",
      to: "metadata",
      label: "GET /video/{id}",
      dashed: true,
      offset: 100,
      fromSide: "right",
      toSide: "right",
      detail: {
        what: "The page-level read: title, duration, publish_state and the manifest URL, before a single byte of video is fetched.",
        why: "Playback is gated here rather than at the CDN, which is what makes a tombstone effective within seconds even though the segments behind it stay cached and fetchable.",
        breaks: "It is the one uncached hop on the read path, so it is sized against page views rather than against segment requests.",
      },
    },
    {
      id: "e15",
      from: "viewer",
      to: "escalation",
      label: "view events",
      dashed: true,
      detail: {
        what: "Watch events feeding the per-video sliding-window counters the controller reads.",
        why: "This is the only signal that tells you what a video is worth, and it arrives hours after the encoding decision it should have informed. The whole cost model rests on this arrow being cheap and roughly right rather than exact.",
        numbers: ["~1B watch-hours/day", "sliding window of the last hour"],
        breaks: "Counter drift moves the escalation rate off its 5% target in either direction and the fleet size is silently wrong until the bill arrives.",
      },
    },
    {
      id: "e16",
      from: "escalation",
      to: "orchestrator",
      label: "re-enqueue upper rungs",
      dashed: true,
      detail: {
        what: "A second pass through the same graph for 1080p, 4K, per-title ladder analysis and AV1, with split, thumbnails and notify skipped.",
        why: "Re-entering the existing DAG rather than running a separate pipeline is what makes the encoder build pinning matter: a rung half-encoded on one build and half on another gives quality discontinuities nobody finds until a viewer complains.",
        numbers: ["~5% of uploads", "the remaining 6.15 Mbps of ladder, 2.8x source"],
        breaks: "Escalation runs on a preemptible lane and is shed first under an upload spike, because late upper rungs are invisible to nearly everyone while an unplayable video is a support ticket.",
      },
    },
    {
      id: "e17",
      from: "packager",
      to: "cdn",
      label: "pre-warm hot slice",
      dashed: true,
      offset: 90,
      fromSide: "left",
      toSide: "left",
      detail: {
        what: "A push of the floor rung to major points of presence, fired only for channels above a subscriber threshold or a scheduled premiere.",
        why: "For a known audience with a known start time, one planned fill beats any reactive mechanism, because the traffic arrives faster than a cache fills.",
        breaks: "The push can only carry rungs that exist, so on a first-time uploader's video the push and the escalation race each other and both lose the first hour.",
      },
    },
  ],
};
