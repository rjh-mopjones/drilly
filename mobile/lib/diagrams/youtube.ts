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
    // --- ingest, column A ---
    {
      id: "creator",
      label: "Creator client",
      sub: "5MB parts, resumable",
      kind: "client",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The uploader's browser or app, splitting the source file into fixed-size parts and tracking which parts the object store has confirmed.",
        why: "A 2.5GB upload over a mobile connection will fail at least once, so the design assumption is that it always fails. Keeping the confirmed-part list on the client is what makes a resume cost one part rather than the whole file, and it is the reason no server has to hold session state for 25k simultaneous uploads.",
        numbers: [
          "~2.5GB for a 20-minute upload",
          "~25k concurrent uploads at peak",
          "mean in-flight duration ~5 min",
        ],
        breaks:
          "If resumable state is lost mid-file the client restarts from zero, which shows up as an offset-mismatch rate and a pile of abandoned multipart sessions billed until a lifecycle rule aborts them.",
      },
    },
    {
      id: "source-store",
      label: "Source object store",
      sub: "archive tier, kept forever",
      kind: "blob",
      x: 40,
      y: 150,
      w: 280,
      detail: {
        what: "Raw uploads at src/{video_id}/{source_hash}, in an archive-class tier, replicated cross-region before the upload is acknowledged.",
        why: "Every derivative is recomputable from this object and nothing else is, so it is the only thing in the system with a zero RPO. It is also the input to escalation runs that may happen weeks after the floor pass, and to a codec migration that may happen years after.",
        numbers: ["~720TB/day of source", "~1GB per source hour", "retained permanently"],
        breaks:
          "Cross-region source replication is the dominant DR cost line at 720TB/day, and it is the one thing that cannot be regenerated if you get it wrong.",
        choice: {
          pick: "Archive-class object storage, source retained permanently",
          instead: "Delete the source once the floor rungs exist and treat the 720p rendition as the master.",
          decider:
            "What escalation and codec migration need to read. Re-encoding 1080p or AV1 from a 2.5 Mbps 720p rendition compounds generation loss, and at ~720TB/day against 1.15PB/day of derivatives the source is the cheaper half of the bill sitting in a tier 10x to 20x below standard.",
          flips:
            "When storage genuinely dominates and the ladder is frozen, so nothing will ever be re-encoded, which is the case for short-lived or ephemeral media rather than a permanent catalogue.",
        },
      },
    },
    {
      id: "encoded-store",
      label: "Encoded object store",
      sub: "origin, lifecycle by last access",
      kind: "blob",
      x: 40,
      y: 1120,
      w: 280,
      detail: {
        what: "The origin: segments at seg/{source_hash}/{rung}/{encoder_build}/{index}.m4s and manifests at mf/{video_id}, tiered by last access.",
        why: "Segment paths are content-addressed down to the encoder build so a re-encode can never overwrite an object already cached somewhere in the world. That immutability is what lets segments carry a year of TTL, which is what makes the whole delivery path a dumb cache.",
        numbers: [
          "1.15PB/day encoded, ~2.6PB/day with erasure coding",
          "~950PB/year",
          "archive tiers 10x to 20x below standard",
        ],
        breaks:
          "Below a low access threshold the right move is deletion rather than demotion, so a reawakened long-tail video needs a re-encode taking minutes; keeping the 360p rung of everything warm forever removes that from the user-visible path.",
        choice: {
          pick: "Lifecycle by last access, then delete derivatives and keep source plus 360p",
          instead: "Keep every rendition of every video in standard storage forever.",
          decider:
            "~1EB/year of growth. Storing seven renditions of a video with 40 lifetime views for a decade is the single largest avoidable line item, and re-encoding costs seconds of GPU against storage that costs forever. Archive tiers run 10x to 20x below standard and ~90% of the catalogue goes untouched after 30 days.",
          flips:
            "When restore latency is contractual, or the catalogue is small enough that the whole tiering apparatus costs more to operate than the bytes it saves.",
        },
      },
    },
    {
      id: "escalation",
      label: "Escalation controller",
      sub: "threshold job, ~5% cross it",
      kind: "service",
      x: 40,
      y: 1250,
      w: 280,
      detail: {
        what: "The threshold job: reads the sliding-window view counters plus the channel's median first-day views, and re-enqueues the video for 1080p, 4K, per-title ladder analysis and AV1.",
        why: "This is the piece that makes the question different from a curated catalogue. Nothing above the floor is produced without its say-so, so the threshold is a control loop against fleet cost rather than a constant somebody hardcoded, and it has to be re-derived as traffic shifts or the fleet size drifts silently.",
        numbers: [
          "threshold tuned so ~5% of uploads cross it",
          "escalation stops paying above ~30%",
          "escalation is one-way",
        ],
        breaks:
          "It is reactive by construction: a video going from zero to a million views in ten minutes is served at 720p through its entire ramp, and no signal available at ingest distinguishes a first-time uploader from the half that never reach 100 views.",
        choice: {
          pick: "Two rungs at ingest, upper rungs commissioned on view velocity and channel priors",
          instead: "Encode the full seven-rung ladder for every upload and never revisit a video.",
          decider:
            "~3,600 GPUs and 2.9PB/day against ~1,200 and 1.15PB/day, a 3x compute and 60% storage difference on a catalogue where half of uploads never reach 100 views. Note that a 1080p floor is not the moderate compromise it looks like: 1080p alone costs more than every rung beneath it combined and takes the fleet back to ~3,100.",
          flips:
            "A small or curated catalogue where every asset is known to be worth the money, at low absolute volume where 3x of a small number beats operating a controller, or on a paid tier that contractually promises 4K on publish.",
        },
      },
    },
    // --- ingest tier and the pipeline spine, column B ---
    {
      id: "upload-api",
      label: "Upload API",
      sub: "presigned multipart, no bytes",
      kind: "service",
      x: 440,
      y: 0,
      w: 280,
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
          flips:
            "When you must inspect or transform bytes in flight, for example virus scanning or watermarking at ingest, or at volumes low enough that one modest fleet absorbs the transfer.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Transcode orchestrator",
      sub: "Temporal, owns the graph",
      kind: "service",
      x: 440,
      y: 290,
      w: 280,
      detail: {
        what: "The workflow engine that owns the job graph and the readiness state machine: probe and split, fan segment jobs, run the check branch, verify, publish. It owns no bytes and does no encoding.",
        why: "The graph is long-running, partially failing and re-entrant. Retrying a single segment rather than the video, and enforcing the uploaded, floor-published and escalated transitions in one place, is what keeps a 240-job pass from becoming 240 chances to publish something broken. It is drawn outside the DAG frame because it drives those stages rather than being one of them.",
        numbers: [
          "240 jobs for a 12-minute floor pass",
          "under 60s upload-to-playable at p50",
          "3.6M workflows started per day",
        ],
        breaks:
          "Publishing a manifest before every segment of a rung exists hands players a mid-playback 404, and most players stall rather than stepping down a rung, so segment count and summed duration are verified unconditionally before promotion.",
        choice: {
          pick: "Temporal for the DAG and the readiness state machine",
          instead: "Chained queue consumers with the state inferred from what exists in the bucket.",
          decider:
            "Fan-out plus lifetime. One pass is 240 jobs whose failures must be retried individually, and escalation re-enters the same graph weeks later against a video that already has two rungs. Inferring state from bucket listings gives you no per-node retry and no way to express three independent readiness fields.",
          flips:
            "A linear pipeline with a handful of steps and no second pass, where a workflow engine is a service to operate for a state machine you could have written in a table.",
        },
      },
    },
    {
      id: "pipeline-zone",
      label: "Transcode DAG — retried per node, never on a viewer's path",
      kind: "zone",
      x: 416,
      y: 386,
      w: 764,
      h: 578,
      detail: {
        what: "The asynchronous half of the system: split, segment encode, packaging and the check branch, run once at the floor and re-run per escalation.",
        why: "Nothing in this box is on a viewer's critical path, which is the property that lets it be queued, retried, shed under load and revisited weeks later. A transcode backlog degrades the creator experience and leaves playback untouched. It is a zone rather than one service because these stages scale on different signals and on different hardware: CPU for the cut, GPUs for the encode, near-nothing for the packaging.",
        numbers: [
          "240 jobs for a 12-minute floor pass",
          "under 60s upload-to-playable at p50",
          "a second pass weeks later re-enters the same graph",
        ],
        breaks:
          "The box is long-running, so worker loss mid-graph is normal rather than exceptional and every node in it has to be safe to re-run. Job output paths are pure functions of input plus encoder build, which is what makes a retry overwrite itself byte for byte.",
      },
    },
    {
      id: "splitter",
      label: "Probe + split",
      sub: "forced closed GOPs at 6s",
      kind: "service",
      x: 440,
      y: 470,
      w: 280,
      detail: {
        what: "Reads the source object once: rejects a broken container, then re-cuts the timeline on fixed six-second boundaries with a forced closed group of pictures at each cut, recording the byte offset of every segment.",
        why: "Segment-parallel encoding works only because a segment can be encoded without reference to its neighbours, and that is a property you create rather than one you find: a camera puts keyframes wherever it likes. The recorded byte offsets are the second half of its job, because they are what let each encode worker issue one ranged read instead of seeking a 2.5GB object.",
        numbers: [
          "120 segments for a 12-minute video",
          "keyframe timestamps identical across every rung",
          "one pass over the source, CPU-bound",
        ],
        breaks:
          "Both of its failures are quiet. Cut on the wrong frame and segments do not concatenate cleanly, so the player shows a flash of macroblocks at every boundary. Cut 360p and 720p on different presentation timestamps and a player cannot switch rung mid-stream without a visible stall.",
        choice: {
          pick: "Re-cut the source at fixed 6s boundaries with forced closed GOPs",
          instead: "Segment on the source's own keyframes wherever they happen to fall.",
          decider:
            "Cross-rung switchability. Adaptive bitrate requires every rung to carry a keyframe at the same presentation timestamp, which the source cannot guarantee; forcing keyframes at the segment length costs on the order of 10% bitrate, and forcing them far more often than that costs the same 10% for nothing.",
          flips:
            "Single-rung delivery with no switching, where you can take the source's own GOP structure and skip the re-cut entirely.",
        },
      },
    },
    {
      id: "work-queue",
      label: "Segment work queue",
      sub: "Kafka, floor lane + preemptible",
      kind: "queue",
      x: 440,
      y: 600,
      w: 280,
      detail: {
        what: "The durable work queue between the orchestrator and the GPU fleet, split into two lanes: the floor pass, and a preemptible lane carrying escalation work.",
        why: "It is the shock absorber for a 2x diurnal peak and for news events that double upload rate for hours. Because the backlog drains in minutes against a tens-of-seconds SLO, queueing is cheaper than provisioning to peak, and the lane split is what makes shedding safe: escalation work can be dropped entirely while the creator-visible pass keeps its latency.",
        numbers: [
          "~900M segment jobs/day at the floor",
          "peak upload rate ~2x the daily mean",
          "queue drains in minutes, SLO is tens of seconds",
        ],
        breaks:
          "Queue depth and oldest-job age are the creator-visible SLO in disguise. If the two lanes share priority, an escalation burst on yesterday's viral videos delays today's uploads becoming playable at all.",
        choice: {
          pick: "Two lanes, escalation preemptible and shed first",
          instead: "One priority queue with escalation jobs at a lower priority number.",
          decider:
            "What you do at 10x. A shared queue still holds the escalation work in memory and still schedules it between floor jobs; a separate preemptible lane can be stopped outright, which is the only lever that returns the whole fleet to the floor pass. Late upper rungs are invisible to nearly everyone; a video that will not play for an hour is a support ticket.",
          flips:
            "A pipeline with one class of work, where a second lane is a second thing to monitor for no scheduling freedom you would ever use.",
        },
      },
    },
    {
      id: "encoders",
      label: "GPU encode fleet",
      sub: "ffmpeg NVENC, one segment/job",
      kind: "service",
      x: 440,
      y: 730,
      w: 280,
      detail: {
        what: "Stateless workers that each pull one contiguous byte range of the source and emit one encoded segment for one rung.",
        why: "That independence is what turns 20 minutes of video into tens of seconds of wall clock. The floor is 360p and 720p; everything above it is commissioned later, which is the difference between a 1,200-GPU fleet and a 3,600-GPU one.",
        numbers: [
          "~15x realtime for one 1080p rung",
          "7.3 GPU-min/source-hour full ladder vs 2.2 at the floor",
          "at most 0.4 GPU-seconds per 720p segment",
        ],
        breaks:
          "Below a few minutes of source the job is bound by object-store round trips rather than GPU — 240 ranged reads and 240 writes — so adding workers makes it slower; under ~60s of source the video is encoded whole on one worker.",
        choice: {
          pick: "Hardware H.264 on GPUs, segment-parallel at 6s, floor rungs only",
          instead: "CPU x264 encoding, or encoding the whole file on one worker.",
          decider:
            "Fleet arithmetic at 8.3 source-hours/s. Hardware encode runs several times faster than CPU at comparable quality, and the floor at 0.55 1080p-equivalents against a full ladder at 1.82 is the difference between ~1,200 and ~3,600 saturated GPUs. Output paths include the encoder build, so a retry overwrites itself byte for byte.",
          flips:
            "When quality per bit is worth more than throughput, which is the curated-catalogue case, or for the small share of titles where a slow software encode repays itself in egress.",
        },
      },
    },
    {
      id: "packager",
      label: "CMAF packager",
      sub: "fMP4 once, HLS + DASH manifests",
      kind: "service",
      x: 440,
      y: 860,
      w: 280,
      detail: {
        what: "Writes fragmented MP4 segments once, emits an HLS playlist and a DASH MPD over the same objects, and extracts thumbnails on the floor pass.",
        why: "iOS requires HLS and everything else speaks DASH, but since HLS gained fMP4 support in 2016 the difference is two small text files rather than two copies of the bytes. Thumbnails are generated here because they are cheap and creator-visible immediately, unlike everything expensive.",
        numbers: [
          "a 6s 720p segment is ~1.9MB",
          "manifests ~5KB",
          "~900M new objects/day at the floor",
        ],
        breaks:
          "It writes the mutable half of the system. A manifest rewritten before its segments are durable surfaces as a mid-playback 404, and players stall rather than stepping down a rung, so segments go down first and the manifest is promoted atomically last.",
        choice: {
          pick: "One CMAF fMP4 byte-stream, two manifests over it",
          instead: "MPEG-TS segments for HLS and separate fMP4 segments for DASH.",
          decider:
            "Duplicate storage for no compatibility gain. Two segment formats doubles 1.15PB/day of encoded output and doubles a 900M-object/day PUT bill that already runs ~$4.5k/day. CMAF standardised the container in 2018 and HLS has read fMP4 since 2016, so the compatibility argument for the split has expired.",
          flips:
            "When you must serve players old enough to require transport-stream HLS, where the duplication is the price of reaching them at all.",
        },
      },
    },
    {
      id: "shield",
      label: "Origin shield",
      sub: "coalesces concurrent misses",
      kind: "gateway",
      x: 440,
      y: 1120,
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
          flips:
            "A small edge footprint where fan-in is already low, and the extra hop adds latency to every miss for coalescing that rarely fires.",
        },
      },
    },
    // --- the check branch, column C ---
    {
      id: "moderation",
      label: "Moderation + rights gate",
      kind: "serviceGroup",
      x: 860,
      y: 426,
      w: 300,
      h: 408,
      detail: {
        what: "One gate service, three stages of a single verdict: sample and classify, fingerprint against the rights catalogue, then decide whether this video may be published.",
        why: "It is drawn as one service rather than three because it returns one answer to one caller in seconds and is deployed and scaled as a unit — the classifier pass is ~30 GPUs platform-wide, a rounding error against the 1,200-GPU encode fleet. It runs as a parallel branch of the transcode DAG because it is cheap and the encode is not, so gating on it costs nothing in wall clock.",
        numbers: [
          "verdict in seconds, both branches must be green",
          "~0.7 GPU-seconds/video, ~30 GPUs platform-wide",
          "3.6M videos/day",
        ],
        breaks:
          "It owns the exposure window, and that window can never be driven to zero at 3.6M uploads a day. The honest metric is exposure-hours before takedown rather than an incident count, and the target is a number somebody has to sign off on.",
      },
    },
    {
      id: "classifiers",
      label: "Frame + audio classifiers",
      sub: "1 frame/s sampled",
      kind: "process",
      x: 880,
      y: 470,
      w: 260,
      detail: {
        what: "Decodes the source once, samples one frame a second plus the audio track, and scores both against the safety models.",
        why: "Sampling rather than scoring every frame is what makes a synchronous gate affordable: 720 frames for a 12-minute video at ~1,000 frames/s/GPU is 0.7 GPU-seconds, so the whole platform's safety pass costs ~30 GPUs. Against a 1,200-GPU encode fleet there is no cost case for skipping it.",
        numbers: ["~720 frames per 12-min video", "~1,000 frames/s/GPU", "~30 GPUs platform-wide"],
        breaks:
          "Sampling at 1 Hz means a violation shorter than a second between sampled frames is not seen, and the score band it returns is a probability rather than an answer, which is why the gate downstream is risk-tiered instead of thresholded once.",
        choice: {
          pick: "Sample 1 frame/s and the audio track",
          instead: "Score every frame of every upload.",
          decider:
            "30 GPUs against 21,600. A 12-minute video is 720 sampled frames but ~43,000 real ones, so full-rate scoring costs more than the entire encode fleet to catch violations that are almost always many seconds long.",
          flips:
            "Short-form content, where a second is a meaningful fraction of the whole video, and the highest-risk tiers where a single missed frame is unacceptable.",
        },
      },
    },
    {
      id: "fingerprint",
      label: "Fingerprint match",
      sub: "robust audio + video hashes",
      kind: "process",
      x: 880,
      y: 600,
      w: 260,
      detail: {
        what: "Computes perceptual audio and video fingerprints from the frames the classifier stage already decoded, and looks them up against the rights catalogue.",
        why: "It shares a decode with the classifier pass because decoding is the expensive part and both stages want the same frames. Rights matching has to survive re-encoding, so an exact hash is useless here: the lookup is a nearest-neighbour search over perceptual descriptors.",
        numbers: [
          "runs on the same decode as the classifier pass",
          "returns a match id or nothing, in seconds",
        ],
        breaks:
          "It loses an arms race. Robust fingerprints handle re-encoding, cropping, mirroring, time-shifting and pitch-shifting individually and lose to combinations, so low-reach infringement is largely uncaught and the reachable position is to make evasion expensive rather than impossible.",
        choice: {
          pick: "Perceptual fingerprints matched against a reference catalogue",
          instead: "Exact content hashing of the uploaded file.",
          decider:
            "What a re-upload actually looks like. An exact hash catches only a byte-identical file, and every real infringing re-upload has been through a transcode at minimum, so the hash changes while the content does not. Exact hashing is still worth keeping as a cheap first pass for identical re-uploads and for storage dedup.",
          flips:
            "Deduplicating literal re-uploads, where an exact hash is free and answers the question completely.",
        },
      },
    },
    {
      id: "verdict",
      label: "Verdict + risk tier",
      sub: "gates publish_state",
      kind: "process",
      x: 880,
      y: 730,
      w: 260,
      detail: {
        what: "Combines the safety score and the match result into publish, hold, or hold-and-queue-for-human-review, using account age, score band and known-harmful hashes to pick the tier.",
        why: "This is the stage that makes publication a gated event rather than a deployment step, and it is the only design in the media cluster where the content itself is untrusted. It is risk-tiered rather than uniform because a uniform synchronous gate at a 1% false-positive rate wrongly delays about 36,000 legitimate creators a day.",
        numbers: [
          "3.6M videos/day",
          "1% false positives is ~36k creators/day delayed",
          "human review at 5 min/video would need ~37,500 reviewers",
        ],
        breaks:
          "Everything slower than seconds runs after the video is live, so the residual risk is real and is spent deliberately: the human queue is ordered by predicted reach rather than by arrival, and tombstoning is available at any point afterwards.",
        choice: {
          pick: "Synchronous classifier and fingerprint gate, human review asynchronous and risk-ordered",
          instead: "Hold every upload private until human review clears it.",
          decider:
            "3.6M videos/day at 5 minutes of review each is 300k reviewer-hours/day, about 37,500 full-time reviewers, so a universal human gate is not expensive but arithmetically unavailable.",
          flips:
            "Where a single exposure is unacceptable and volume is small enough to pay for: accounts under 24 hours old, scores in the uncertain band, known-harmful hashes, and jurisdictions with pre-publication obligations.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "immutable segments, ~95% offload",
      kind: "gateway",
      x: 860,
      y: 1120,
      w: 280,
      detail: {
        what: "The tier that actually serves the bytes: pull-through on miss, with a predicted-hot slice pushed out in advance.",
        why: "In aggregate the system serves ~800 bytes for every byte it produces, so the design question is cache strategy and egress rather than application throughput. Nothing between the player and the object store holds per-viewer session state, which is precisely what makes this tier a dumb cache.",
        numbers: [
          "~83 Tbps average, ~250 Tbps peak",
          "segments max-age=31536000 immutable",
          "manifests max-age=60",
        ],
        breaks:
          "Long segment TTLs are load-bearing for the cost model and directly oppose immediate takedown: a cached segment URL stays fetchable across tens of thousands of edges and third-party ISP-embedded appliances for minutes at best after the manifest has already stopped serving.",
        choice: {
          pick: "Pull-through by default, push only the predicted-hot slice",
          instead: "Pre-position the catalogue to edges and ISP-embedded appliances ahead of demand.",
          decider:
            "Daily growth against appliance capacity. One day of encoded output is 1.15PB and an ISP-embedded appliance holds 100 to 500TB, so a single day of uploads is 2x to 10x what one box holds before the back catalogue exists. What can be pushed is the slice that fits, and 80% of watch time in ~1% of videos means that slice is also the one that matters.",
          flips:
            "A catalogue that fits on the appliance, which is the curated case, and per-event for a scheduled fixture where one planned fill beats millions of correlated misses.",
        },
      },
    },
    // --- metadata, rights and the read path, columns D and E ---
    {
      id: "metadata",
      label: "Metadata store",
      sub: "videos, video_rungs",
      kind: "database",
      x: 1240,
      y: 150,
      w: 280,
      detail: {
        what: "Sharded by video_id: title, duration, and three separate state fields for upload, publish and quality tier, plus one row per completed rung.",
        why: "Uploaded, published and escalated are independent events, and conflating them into one status is the classic mistake here: it tells creators a video is ready when it is not, and gives the manifest generator a partial-rung case it cannot represent.",
        numbers: [
          "3.6M new video rows/day",
          "a rung row exists only once the rung is complete",
          "read once per watch page, never per segment",
        ],
        breaks:
          "It is the fast half of a takedown. Manifest hydration reads publish_state, so a tombstone stops new playback within seconds while cached segment URLs stay fetchable until they are purged or evicted.",
        choice: {
          pick: "Three state fields plus a wide-column video_rungs table",
          instead: "A single status enum on the video row covering the whole lifecycle.",
          decider:
            "The states are not ordered. A video can be published at the floor and escalating, or fully encoded and blocked on a rights verdict, and one enum over 3.6M videos/day forces a combinatorial state list that every reader has to interpret identically. Writing a rung row only on completion removes the partial-state case entirely.",
          flips:
            "A pipeline with a genuinely linear lifecycle and one output, where an enum is legible and a second table is ceremony.",
        },
      },
    },
    {
      id: "rights-db",
      label: "Rights catalogue",
      sub: "reference fingerprints",
      kind: "database",
      x: 1240,
      y: 600,
      w: 280,
      detail: {
        what: "The reference set rights holders register: fingerprints of protected audio and video, with the policy attached to each — block, monetise, or track.",
        why: "It is the only durable dependency of the check branch and it is written by a completely different population from the rest of the system. A match is not the end of the decision either: most matches resolve to a policy rather than a takedown, which is why the row carries the policy and not just the identity.",
        numbers: [
          "queried once per upload, 3.6M/day",
          "nearest-neighbour lookup, not an equality match",
        ],
        breaks:
          "Its coverage bounds everything downstream: content nobody has registered cannot be matched, so the gate's recall is a property of this table rather than of the matcher.",
      },
    },
    {
      id: "viewer",
      label: "Viewer player",
      sub: "ABR, picks its own rung",
      kind: "client",
      x: 1240,
      y: 1120,
      w: 280,
      detail: {
        what: "The player: fetches a manifest, estimates bandwidth from its own download timings, and requests the next six-second segment at whichever rung it chooses.",
        why: "Bandwidth changes during playback and the server cannot observe it, so the decision belongs to the only party holding the measurement. A Wi-Fi to cellular handover becomes a quality drop rather than a stall.",
        numbers: [
          "time-to-first-frame under 500ms at p95",
          "rebuffer under 0.5% of watch time",
          "6s segments",
        ],
        breaks:
          "A player mid-playback will not see an escalated rung until it refreshes the manifest, and most refresh only on a seek or a stall, so a quality upgrade lands on the next viewer rather than the current one.",
        choice: {
          pick: "Client-side adaptive bitrate over a text manifest",
          instead: "Server-side session-managed streaming, or progressive download of one file.",
          decider:
            "Cacheability. ABR keeps zero per-viewer state between the player and the object store, which is what allows a year of TTL on segments and ~95% edge offload of ~83 Tbps. A server-side session would put a stateful hop in front of every one of those bytes.",
          flips:
            "Very short clips, where the whole file lands before the first adaptation decision would have fired and progressive download is simpler and faster.",
        },
      },
    },
    {
      id: "playback-api",
      label: "Watch API",
      sub: "manifest hydration, tombstone",
      kind: "service",
      x: 1640,
      y: 990,
      w: 280,
      detail: {
        what: "The one uncached hop on the read path: given a video id it returns title, duration and the manifest URL, or a takedown response if publish_state says tombstoned.",
        why: "Playback is gated here rather than at the CDN, which is what makes a takedown effective within seconds even though the segments behind it stay cached and fetchable. It is sized against page views rather than segment requests, so it is three orders of magnitude smaller than the delivery path it fronts.",
        numbers: [
          "one call per watch, not per segment",
          "~1B watch-hours/day behind it",
          "manifests carry max-age=60 once handed out",
        ],
        breaks:
          "It stops players, not bytes. A segment URL already cached at an edge stays fetchable by anyone holding it until eviction or an explicit purge, so takedown is fast here and best effort everywhere below.",
        choice: {
          pick: "Tombstone at manifest hydration, long TTLs below it",
          instead: "Short-lived signed URLs on every segment so a takedown is immediate end to end.",
          decider:
            "The cache hit rate the cost model rests on. Signing makes the segment URL unstable, and unstable URLs destroy the ~95% offload that turns 900PB/day of egress into 45PB of origin. Signing is worth it only where the requirement is contractual.",
          flips:
            "Premium or paid content, where entitlement is per-viewer anyway and there is no shared cache to protect.",
        },
      },
    },
    {
      id: "counters",
      label: "View velocity counters",
      sub: "Redis, 1h sliding window",
      kind: "cache",
      x: 1640,
      y: 1250,
      w: 280,
      detail: {
        what: "Per-video counters over a sliding window of views in the last hour, held in memory, alongside the channel priors the controller reads with them.",
        why: "This is the only signal that says what a video is worth, and it arrives hours after the encoding decision it should have informed. It is a cache rather than a store because the whole cost model needs it cheap and roughly right rather than exact — a lost window costs one escalation decision, not a video.",
        numbers: ["~1B watch-hours/day feeding it", "window of the last hour", "read by a threshold job, not per view"],
        breaks:
          "Counter drift moves the escalation rate off its 5% target in either direction, and the fleet size is silently wrong until the bill arrives, which is why escalation rate and GPU-hours per upload are alarmed rather than reviewed.",
        choice: {
          pick: "Approximate in-memory sliding-window counters",
          instead: "Exact aggregation of the watch-event stream in the analytics warehouse.",
          decider:
            "What the consumer needs. The threshold is a control loop tuned so ~5% of uploads cross it, so being a few percent wrong on a count changes nothing; being an hour late changes the decision entirely. Warehouse aggregation is accurate and arrives after the window it describes has closed.",
          flips:
            "Anything billed or reported from the same number, where an approximate count is not defensible and the latency is acceptable.",
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
        breaks:
          "Presigned URLs expire, so a long-running upload has to be able to ask for fresh ones without restarting the session.",
      },
    },
    {
      id: "e2",
      from: "creator",
      to: "source-store",
      label: "5MB parts, direct PUT",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The video bytes themselves, written part by part straight into object storage and acknowledged individually.",
        why: "This is the arrow that must not pass through a server. Part-level acknowledgement is what turns a failure at part 47 into a resume at 47 rather than at zero, and it keeps 25k concurrent uploads off the application fleet.",
        numbers: ["~2.5GB for a 20-minute upload", "~720TB/day of source"],
        breaks:
          "An abandoned multipart session leaves orphaned parts that are billed until a lifecycle rule aborts them.",
      },
    },
    {
      id: "e3",
      from: "upload-api",
      to: "metadata",
      label: "video row created",
      dashed: true,
      fromSide: "right",
      toSide: "top",
      detail: {
        what: "Creating the video row with upload_state set and publish_state unset.",
        why: "The row has to exist before the bytes finish so the creator has something to poll, and so the pipeline has somewhere to record readiness transitions when the completion event fires.",
        breaks:
          "If the row and the multipart session disagree the video is invisible to the creator while its bytes are being paid for.",
      },
    },
    {
      id: "e4",
      from: "source-store",
      to: "orchestrator",
      label: "completion event",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The bucket completion event for the assembled source object, which starts a transcode workflow.",
        why: "Durability of the source is the trigger, not the client's claim to have finished. Starting from the object means a retry weeks later reads exactly the same bytes and the job is safe to replay.",
        numbers: ["~3.6M videos/day"],
        breaks:
          "A dropped or duplicated event either strands a video in processing forever or starts two passes, which is why workflow identity comes from the source hash.",
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "splitter",
      label: "probe, then split",
      dashed: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The first two nodes of the graph: reject a broken container, then re-cut the timeline at forced closed GOPs and record the byte offsets.",
        why: "Rejecting here rather than after the fan-out is the cheapest possible failure: a broken container costs one probe instead of 240 scheduled jobs that all fail the same way.",
        breaks:
          "A container that probes clean but decodes badly gets through, and the first thing to notice is the segment-duration check at packaging.",
      },
    },
    {
      id: "e6",
      from: "source-store",
      to: "encoders",
      label: "ranged read per job",
      offset: 40,
      fromSide: "bottom",
      toSide: "left",
      detail: {
        what: "Each encode worker pulls exactly one contiguous byte range of the source, the range its split step recorded.",
        why: "This is the arrow that decides wall clock on short videos. 240 ranged reads and 240 writes dominate a floor pass whose actual GPU work is under two minutes, and passing byte offsets is what stops every worker seeking through a 2.5GB object.",
        numbers: ["240 reads and 240 writes for a 12-minute floor pass", "~1GB per source hour"],
        breaks:
          "Past a few hundred workers on one video every extra worker is another set of round trips against the same source object, so the job gets slower rather than faster.",
      },
    },
    {
      id: "e7",
      from: "splitter",
      to: "work-queue",
      label: "240 jobs, byte offsets",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "One job per segment per rung, each carrying the byte range and the target rung, published onto the floor lane.",
        why: "The fan-out is the whole point of the split: a 12-minute video becomes 120 segments across 2 rungs, and each of those is independently retryable rather than the video being retryable.",
        numbers: ["120 segments x 2 rungs for 12 minutes", "~900M segment jobs/day"],
        breaks:
          "Escalation publishes to the preemptible lane instead, with split, thumbnails and notify skipped, so a lane misconfiguration silently makes escalation compete with the creator-visible pass.",
      },
    },
    {
      id: "e8",
      from: "work-queue",
      to: "encoders",
      label: "one segment per worker",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Workers pull jobs and are free to die: the job returns to the queue and the retry writes the same bytes to the same path.",
        why: "Idempotency is what makes at-least-once delivery safe here. The output path is a pure function of source hash, rung, encoder build and index, so a duplicate delivery overwrites itself byte for byte.",
        numbers: ["at most 0.4 GPU-seconds per 720p segment", "~0.05 for the 360p rung"],
        breaks:
          "An encoder or driver upgrade between two runs of the same video changes the output subtly, which is why the build is in the path and never in a header.",
      },
    },
    {
      id: "e9",
      from: "encoders",
      to: "packager",
      label: "fMP4 segments",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Completed per-rung segments handed to packaging once the orchestrator has verified the count and summed duration.",
        why: "Packaging is cheap and encoding is not, so the split lets a rung be published the moment its own segments exist rather than waiting on the rest of the ladder.",
        breaks:
          "Rungs whose keyframes sit at different presentation timestamps cannot be switched between mid-stream, and this is the last step that can catch it.",
      },
    },
    {
      id: "e10",
      from: "packager",
      to: "encoded-store",
      label: "segments + 2 manifests",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Writing fragmented MP4 segments to content-addressed paths and promoting the HLS and DASH manifests atomically.",
        why: "Segments go down first and the manifest last, because a manifest that references a segment which is not there yet hands every player a 404 mid-playback and most players stall instead of stepping down.",
        numbers: ["~900M new objects/day", "~$4.5k/day in PUTs alone"],
        breaks:
          "Object count is a real cost line here rather than a rounding error, which is one of the arguments against producing rungs nobody asked for.",
      },
    },
    {
      id: "e11",
      from: "orchestrator",
      to: "classifiers",
      label: "check branch, in parallel",
      dashed: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "A parallel branch of the same workflow, started at the same time as the split and joined before publication.",
        why: "It runs alongside rather than after because it is cheap and the encode is not, so gating on it costs nothing in wall clock. Publication waits on both branches, not on either one alone.",
        numbers: ["~0.7 GPU-seconds per video", "~30 GPUs platform-wide"],
        breaks:
          "If the join is dropped and publication waits only on the encode, visibility becomes a deployment step rather than a gated event, which is the whole distinction this design turns on.",
      },
    },
    {
      id: "e12",
      from: "classifiers",
      to: "fingerprint",
      label: "one decode, reused",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The decoded frames and audio the classifier pass already produced, handed to fingerprinting rather than decoded a second time.",
        why: "Decoding is the expensive part of both checks, and doing it once is what keeps the entire platform's gate at ~30 GPUs. It is also why these are stages of one service rather than two services that would each pull the source.",
        breaks:
          "The two stages now share a failure: a decode that dies takes both checks with it, and the workflow has to retry the branch rather than one check.",
      },
    },
    {
      id: "e13",
      from: "classifiers",
      to: "verdict",
      label: "safety score",
      fromSide: "left",
      toSide: "left",
      offset: 40,
      detail: {
        what: "A score per policy class rather than a boolean, carried straight to the gate.",
        why: "The gate needs the band, not the answer: a score in the uncertain range routes to human review, a high score holds, a low score publishes. Collapsing it to a boolean here would throw away the only information the risk tiering runs on.",
        numbers: ["1% false positives is ~36k creators/day delayed"],
        breaks:
          "A model update that shifts the score distribution silently re-tiers every upload, so the thresholds are re-derived whenever the model changes.",
      },
    },
    {
      id: "e14",
      from: "fingerprint",
      to: "verdict",
      label: "match id or none",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The matched reference asset and its policy, or nothing.",
        why: "Most matches are not takedowns. The policy attached to the reference decides between block, monetise and track, so the gate is applying somebody else's rule rather than making a judgement.",
        breaks:
          "A false match blocks a legitimate creator on somebody else's catalogue entry, which is the failure with the worst appeal cost in the whole system.",
      },
    },
    {
      id: "e15",
      from: "fingerprint",
      to: "rights-db",
      label: "nearest-neighbour lookup",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A similarity query against the registered reference fingerprints, not an equality lookup.",
        why: "Every real infringing re-upload has been through at least one transcode, so the descriptors never match bit for bit. The query has to tolerate re-encoding, cropping, mirroring and pitch-shifting individually.",
        numbers: ["3.6M queries/day", "one per upload, in seconds"],
        breaks:
          "Combinations of those transforms defeat it, so the miss rate is highest exactly where somebody is trying, and the queue that catches the rest is ordered by predicted reach.",
      },
    },
    {
      id: "e16",
      from: "verdict",
      to: "metadata",
      label: "verdict gates publish",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "An append-only verdict row per check, and the flip of publish_state when both branches come back green.",
        why: "Verdicts are appended rather than overwritten because a takedown has to be able to show what was known at the time the video was allowed through.",
        breaks:
          "This same field is what a tombstone writes later, so the takedown path and the publish path share one read on the serving side and cannot disagree.",
      },
    },
    {
      id: "e17",
      from: "orchestrator",
      to: "metadata",
      label: "readiness + rung rows",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "Writing a video_rungs row per completed rung and moving the video through uploaded, floor-published and escalated.",
        why: "The rung row exists only once every segment of that rung is durable, so the manifest generator reads a table with no partial state in it and needs no special case.",
        numbers: ["one row per completed rung"],
        breaks:
          "If readiness is inferred from bucket contents instead, a half-written rung looks complete and gets advertised in a manifest.",
      },
    },
    {
      id: "e18",
      from: "packager",
      to: "cdn",
      label: "pre-warm hot slice",
      dashed: true,
      fromSide: "right",
      toSide: "top",
      detail: {
        what: "A push of the floor rung to major points of presence, fired for channels above a subscriber threshold, for scheduled premieres, and by the escalation controller when a video crosses the velocity threshold in its first minutes.",
        why: "For a known audience with a known start time, one planned fill beats any reactive mechanism, because the traffic arrives faster than a cache fills.",
        breaks:
          "The push can only carry rungs that exist, so on a first-time uploader's video the push and the escalation race each other and both lose the first hour.",
      },
    },
    {
      id: "e19",
      from: "encoded-store",
      to: "shield",
      label: "origin fetch on miss",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The origin read that fills the shield, one per object no matter how many edges asked for it simultaneously.",
        why: "This is the only path by which viewer traffic reaches storage at all, and it exists to be rare: at 95% offload it carries 5% of 900PB/day.",
        numbers: ["45PB/day, about 4 Tbps"],
        breaks:
          "Cold-tier objects are minutes away rather than milliseconds, so a reawakened long-tail video stalls here unless a warm 360p rung was kept.",
      },
    },
    {
      id: "e20",
      from: "shield",
      to: "cdn",
      label: "one fill per object",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The coalesced fill going back out to whichever edges are waiting on that object.",
        why: "Thousands of edges missing the same segment in the same second is the normal shape of a rising video, and collapsing them into one fetch is the difference between an origin sized for the average and one sized for the burst.",
        breaks:
          "The coalescing window is finite, so a stampede spread across slightly different segment indices still fans in.",
      },
    },
    {
      id: "e21",
      from: "cdn",
      to: "viewer",
      label: "segments, ~95% at edge",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The manifest and then a stream of six-second segments, served from the nearest edge at whatever rung the player asked for.",
        why: "This is where essentially all the bytes in the system go. Segments are immutable at content-addressed URLs so they cache for a year; the manifest is the mutable exception and carries 60 seconds.",
        numbers: ["~83 Tbps average, ~250 Tbps peak", "~1.9MB per 6s 720p segment"],
        breaks:
          "An edge holding a stale manifest keeps serving a video that appears to top out at 720p for up to a minute after escalation completed.",
      },
    },
    {
      id: "e22",
      from: "viewer",
      to: "playback-api",
      label: "GET /watch/{id}",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "The page-level read before a single byte of video is fetched: title, duration, publish_state and the manifest URL.",
        why: "Playback is gated here rather than at the CDN, which is what makes a tombstone effective within seconds even though the segments behind it stay cached and fetchable.",
        breaks:
          "It is the one uncached hop on the read path, so it is sized against page views rather than against segment requests.",
      },
    },
    {
      id: "e23",
      from: "playback-api",
      to: "metadata",
      label: "publish_state + rungs",
      dashed: true,
      fromSide: "top",
      toSide: "right",
      detail: {
        what: "One point read per watch: the video row and its completed rungs, which together decide whether a manifest URL is returned at all.",
        why: "Hydrating the manifest from the rung table rather than from bucket contents is what lets an escalated rung appear the moment it is durable, and a tombstone disappear the moment it is written.",
        numbers: ["one read per watch, not per segment"],
        breaks:
          "A stale read here serves a manifest for a video that was tombstoned seconds ago, so this read is deliberately not cached.",
      },
    },
    {
      id: "e24",
      from: "viewer",
      to: "counters",
      label: "watch events",
      dashed: true,
      fromSide: "bottom",
      toSide: "left",
      detail: {
        what: "Watch events feeding the per-video sliding-window counters, the same stream the recommendation system consumes for its own purposes.",
        why: "This is the only signal that tells you what a video is worth, and it arrives hours after the encoding decision it should have informed. The whole cost model rests on this arrow being cheap and roughly right rather than exact.",
        numbers: ["~1B watch-hours/day", "sliding window of the last hour"],
        breaks:
          "It must never sit on the playback path: an outage here costs escalation decisions, and blocking playback on it would trade a 99.99% SLO for a best-effort one.",
      },
    },
    {
      id: "e25",
      from: "counters",
      to: "escalation",
      label: "1h window + channel prior",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The threshold job reading the window per candidate video, together with the channel's median first-day views.",
        why: "The prior is what buys back part of the reactive gap: a channel with a million subscribers gets the full ladder at ingest because its expected value is known before the file arrives.",
        numbers: ["threshold tuned so ~5% of uploads cross it"],
        breaks:
          "A first-time uploader has no prior at all, so for exactly the case where the reactive gap hurts most there is nothing to read.",
      },
    },
    {
      id: "e26",
      from: "escalation",
      to: "orchestrator",
      label: "re-enqueue upper rungs",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A second pass through the same workflow for 1080p, 4K, per-title ladder analysis and AV1, with split, thumbnails and notify skipped.",
        why: "Re-entering the existing graph rather than running a separate pipeline is what makes encoder-build pinning matter: a rung half-encoded on one build and half on another gives quality discontinuities nobody finds until a viewer complains.",
        numbers: ["~5% of uploads", "the remaining 6.15 Mbps of ladder, 2.8x source"],
        breaks:
          "This work rides the preemptible lane and is shed first under an upload spike, because late upper rungs are invisible to nearly everyone while an unplayable video is a support ticket.",
      },
    },
  ],
};
