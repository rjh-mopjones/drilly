import type { Diagram } from "./types";

export const YOUTUBE: Diagram = {
  id: "youtube",
  title: "YouTube",
  question: "Design YouTube",
  sourceId: "patterns",
  itemId: 11,
  overview: {
    shape:
      "Two systems touching at one place: a write path turning a file into cacheable segments cheaply, and a read path where a CDN serves nearly every byte.",
    forces: [
      {
        constraint: "8.3 source-hours arrive every second, at ~25k concurrent uploads peak",
        decision: "Upload API mints presigned multipart URLs and never touches video bytes itself",
        lights: ["creator", "upload-api", "encoded-store", "e1", "e2"],
      },
      {
        constraint: "A 12-minute upload is 240 independent segment-encode jobs, any of which can fail alone",
        decision: "The Transcode orchestrator (Temporal) owns the DAG, so a failure retries one segment, never the whole video",
        lights: ["orchestrator", "pipeline-zone"],
      },
      {
        constraint: "Half of uploads never reach 100 views, but the encode decision has to be made before that is known",
        decision: "Only 360p and 720p are produced at the floor; higher rungs are commissioned later, only for the ~5% crossing a view-velocity threshold",
        lights: ["orchestrator", "encoders", "viewer", "e24"],
      },
      {
        constraint: "The check branch must return a verdict within a few seconds without adding wall clock to the 240-job encode",
        decision: "Moderation + rights gate runs as a parallel branch of the same DAG, alongside the encode rather than after it",
        lights: ["moderation", "orchestrator", "e11", "e16"],
      },
      {
        constraint: "The system serves roughly 800 bytes for every byte it produces",
        decision: "The CDN edge pulls through on miss with immutable, year-cached segment URLs; only a predicted-hot slice is pushed",
        lights: ["cdn", "e18", "e19", "e21"],
      },
    ],
    naive: {
      text: "Stream every upload through the application server, transcode the full quality ladder, 360p through 4K, synchronously before the video can be published. Then serve playback straight from the origin object store. Streaming through the app tier means 25k concurrent uploads pin 25k long connections onto a fleet that should only be issuing URLs. That is 720TB/day of transit the app tier never needed to carry. Encoding every rung for every video regardless of whether anyone watches it burns GPU on the roughly half of uploads that never reach 100 views. A full ladder costs ~3,600 GPUs and 2.9PB/day against ~1,200 GPUs and 1.15PB/day for a floor-only pass, so the wasted share is real money at 8.3 source-hours/s. Serving from the origin fails even faster. The system serves ~800 bytes for every byte it produces, and no origin fleet is sized for ~83 Tbps of average egress. Presigned uploads, floor-only encoding with later escalation, and a CDN serving ~95% of bytes replace this three-part naive design.",
      lights: ["upload-api", "orchestrator", "cdn"],
    },
    beats: [
      {
        text: "Upload never touches an application server. The client asks for presigned multipart URLs, splits a 2.5GB file into 5MB parts and PUTs them straight into object storage. It tracks which parts are confirmed so a dropped connection resumes at part 47 rather than at zero. Completion of the object is the event that enqueues a job.",
        lights: ["creator", "upload-api", "encoded-store", "orchestrator", "e1", "e2", "e4"],
      },
      {
        text: "The transcode job graph then does the smallest useful thing. Probe the container, re-cut the source at forced closed GOPs into six-second segments, encode two rungs only at 360p and 720p, fan the segments across the GPU encode fleet. Package once as one fragmented-MP4 byte stream with two small text playlists layered over the same bytes for the two playback protocols, extract thumbnails, publish. For a 12-minute upload that is 240 segment jobs and under a minute of wall clock.",
        lights: ["pipeline-zone", "splitter", "work-queue", "encoders", "packager", "e5", "e7", "e8", "e9", "e10"],
      },
      {
        text: "In parallel, the Moderation + rights gate samples frames and audio, matches them against a rights catalogue, and returns a verdict. Publication is gated on that verdict rather than on the encode finishing. That is why upload readiness, publish readiness and full-quality readiness are three separate state fields rather than one status enum.",
        lights: ["moderation", "metadata", "e11", "e16"],
      },
      {
        text: "Everything above 720p is earned. The orchestrator's escalation logic watches per-video view velocity over a sliding window plus the channel's prior, and only then commissions 1080p, 4K, per-title ladder analysis and AV1. Around 5% of uploads cross the threshold, which is what turns a 3,600-GPU fleet into a 1,200-GPU one and 2.9PB/day of encoded output into 1.15PB.",
        lights: ["orchestrator", "viewer", "e24"],
      },
      {
        text: "Delivery is pull-through. The player reads a manifest, estimates its own bandwidth and pulls six-second segments from the nearest edge. On a miss, the CDN collapses thousands of correlated misses for the same object into one origin fetch. Only a predicted-hot slice is pushed out in advance, because one day of uploads is several times what an edge appliance holds.",
        lights: ["cdn", "viewer", "encoded-store", "e18", "e19", "e21"],
      },
      {
        text: "The asymmetry that falls out of escalation is that segments are immutable and manifests are not. Segment URLs are keyed by source hash, rung, encoder build and index and carry a year with immutable. Manifests are rewritten when a rung lands and carry max-age=60, which bounds how long an edge keeps telling viewers the video tops out at 720p.",
        lights: ["cdn", "e21"],
      },
    ],
    crux: {
      problem:
        "You have to commit the expensive work before the information that would justify it exists. Half of uploads never reach 100 views and the top 1% take 80% of watch time.",
      handled:
        "You learn which is which hours after the encode decision was made, so escalation is reactive by construction. The fastest-rising videos are served at the floor rung during exactly the hour their audience is largest. The channel prior in the escalation logic buys back part of that gap for known creators. A brand-new channel's viral video still rides out its first hour at 720p, an accepted cost of not being able to see the future.",
    },
    numbers: [
      {
        value: "500 hours uploaded per minute, 8.3 source-hours per second",
        explain: "The baseline ingest rate the entire write path, from presigned URLs through the GPU fleet, is sized against." },
      {
        value: "~1,200 GPUs and 1.15PB/day against ~3,600 and 2.9PB for the full ladder",
        explain: "The GPU and storage cost of floor-only encoding versus encoding every rung for every upload, the payoff of deferring escalation." },
      {
        value: "~83 Tbps average egress, ~800 bytes served per byte produced",
        explain: "The read-side amplification that makes the CDN's offload rate, not application throughput, the dominant cost variable in the whole system." },
    ],
  },
  nodes: [
    // --- ingest, column A ---
    {
      id: "creator",
      label: "Creator client",
      sub: "5MB parts, resumable",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The uploader's browser or app, splitting the source file into fixed-size parts and tracking which parts the object store has confirmed.",
        why: "A 2.5GB upload over a mobile connection will fail at least once, so the design assumption is that it always fails. Keeping the confirmed-part list on the client is what makes a resume cost one part rather than the whole file. It is also the reason no server has to hold session state for 25k simultaneous uploads.",
        numbers: [
          { value: "~2.5GB for a 20-minute upload", explain: "The typical file size this client manages across a multipart session." },
          { value: "~25k concurrent uploads at peak", explain: "The client population this design absorbs without any server-side session state." },
          { value: "mean in-flight duration ~5 min", explain: "The typical time one upload spends active before completing." },
        ],
        breaks: {
          failure: "If resumable state is lost mid-file the client restarts from zero.",
          handled: "This shows up as an offset-mismatch rate and a pile of abandoned multipart sessions, billed until a lifecycle rule aborts them, so both are monitored as explicit signals.",
        },
      },
    },
    {
      id: "encoded-store",
      label: "Object store",
      sub: "src/ permanent, seg+mf/ tiered",
      kind: "blob",
      col: 0,
      row: 1,
      detail: {
        what: "Two regions of the same object storage service: raw uploads in an archive-class tier kept forever, and derivatives tiered by last access.",
        why: "Raw uploads live at src/{video_id}/{source_hash}; derivatives live at seg/{source_hash}/{rung}/{encoder_build}/{index}.m4s and mf/{video_id}. Every derivative is recomputable from the source object and nothing else is, so the source region has a zero RPO and is retained permanently. Segment paths are content-addressed down to the encoder build, so a re-encode can never overwrite an object already cached somewhere, which is what lets segments carry a year of TTL.",
        numbers: [
          { value: "source: ~720TB/day, retained permanently", explain: "The daily growth of the source archive, never deleted since derivatives depend on it forever." },
          { value: "encoded: 1.15PB/day, ~2.6PB/day with erasure coding, ~950PB/year", explain: "The floor-pass encoded output volume, before and after redundancy, and its annual scale." },
          { value: "archive tiers 10x to 20x below standard", explain: "The cost reduction achieved by moving cold source data to the cheapest available storage class." },
        ],
        breaks: {
          failure: "Cross-region source replication is the dominant DR cost line at 720TB/day, and it is the one thing that cannot be regenerated if you get it wrong.",
          handled: "On the encoded side, below a low access threshold the right move is deletion rather than demotion. A reawakened long-tail video then needs a re-encode taking minutes rather than paying to keep it warm forever.",
        },
        choice: {
          pick: "Lifecycle by last access, then delete derivatives and keep source plus 360p",
          instead: "Keep every rendition of every video in standard storage forever.",
          decider:
            "~1EB/year of growth. Storing seven renditions of a video with 40 lifetime views for a decade is the single largest avoidable line item. Re-encoding costs seconds of GPU against storage that costs forever. Archive tiers run 10x to 20x below standard and ~90% of the catalogue goes untouched after 30 days.",
          flips:
            "When restore latency is contractual, or the catalogue is small enough that the whole tiering apparatus costs more to operate than the bytes it saves.",
        },
      },
    },
    // --- ingest tier and the pipeline spine, column B ---
    {
      id: "upload-api",
      label: "Upload API",
      sub: "presigned multipart, no bytes",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "A stateless tier that mints presigned part URLs, creates the video row, and accepts the completion call. It never sees video bytes.",
        why: "At 8.3 source-hours arriving every second the ingest tier is the one place where handling bytes would be catastrophic. Handing out presigned URLs moves the transfer to the object store, so this tier scales on request rate rather than on bandwidth.",
        numbers: [
          { value: "83 upload starts/s at peak", explain: "The request rate this stateless tier handles, decoupled entirely from data volume." },
          { value: "~1GB per source hour of raw material", explain: "The typical raw data size per hour of uploaded content." },
        ],
        breaks: {
          failure: "It owns the upload_id to object mapping.",
          handled: "A lost session record orphans a half-written multipart upload that nobody will ever complete or abort. Abandoned session cleanup is a monitored lifecycle policy rather than an afterthought.",
        },
        choice: {
          pick: "Presigned multipart URLs, client writes directly to object storage",
          instead: "Stream the upload through the application tier and have it write to storage.",
          decider:
            "Concurrency and bandwidth. ~25k concurrent uploads at peak, each averaging five minutes and ~1GB per source hour. That would pin 25k long-lived connections and 720TB/day of transit on an application fleet that otherwise does nothing but issue URLs.",
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
      col: 1,
      row: 1,
      detail: {
        what: "The workflow engine that owns the job graph and the readiness state machine: probe and split, fan segment jobs, run the check branch, verify, publish. It owns escalation, a threshold job reading a sliding-window view counter that re-enqueues a video into the same graph for higher rungs once it is worth the cost.",
        why: "The graph is long-running, partially failing and re-entrant. Retrying a single segment rather than the video is what keeps a 240-job pass from becoming 240 chances to publish something broken. Enforcing the uploaded, floor-published and escalated transitions in one place does the same. Escalation is the control loop that keeps the fleet at ~1,200 GPUs instead of ~3,600: nothing above the 720p floor is produced without its say-so. It is reactive by construction. A video going from zero to a million views in ten minutes is served at the floor through its entire ramp. The channel prior buys back part of that gap for known creators.",
        numbers: [
          { value: "240 jobs for a 12-minute floor pass", explain: "The full job count one upload generates through the DAG at the floor rungs." },
          { value: "under 60s upload-to-playable at p50", explain: "The target latency from upload completion to the video being watchable at the floor." },
          { value: "3.6M workflows started per day", explain: "The daily volume of independent transcode DAGs this orchestrator manages." },
          { value: "escalation threshold tuned so ~5% of uploads cross it, stops paying above ~30%", explain: "The calibration target for the escalation rate, and the ceiling past which escalating more would cost more than it returns." },
        ],
        breaks: {
          failure: "Publishing a manifest before every segment of a rung exists hands players a mid-playback 404, and most players stall rather than stepping down a rung.",
          handled: "Segment count and summed duration are verified unconditionally before promotion, so a partial rung can never reach a manifest.",
        },
        choice: {
          pick: "Temporal for the DAG and the readiness state machine",
          instead: "Chained queue consumers with the state inferred from what exists in the bucket.",
          decider:
            "Fan-out plus lifetime. One pass is 240 jobs whose failures must be retried individually, and escalation re-enters the same graph weeks later against a video that already has two rungs. Inferring state from bucket listings gives you no per-node retry and no way to express three independent readiness fields.",
          flips:
            "A linear pipeline with a handful of steps and no second pass. There a workflow engine is a service to operate for a state machine you could have written in a table.",
        },
      },
    },
    {
      id: "pipeline-zone",
      label: "Transcode DAG — retried per node, never on a viewer's path",
      kind: "zone",
      detail: {
        what: "The asynchronous half of the system: split, segment encode, packaging and the check branch, run once at the floor and re-run per escalation.",
        why: "Nothing in this box is on a viewer's critical path, which is the property that lets it be queued, retried, shed under load and revisited weeks later. It is a zone rather than one service because these stages scale on different signals and on different hardware. CPU handles the cut, GPUs handle the encode, and packaging needs almost nothing.",
        numbers: [
          { value: "240 jobs for a 12-minute floor pass", explain: "The total work one upload generates through this zone at the floor." },
          { value: "under 60s upload-to-playable at p50", explain: "The end-to-end target this zone's whole floor pass has to meet." },
          { value: "escalation can re-enter the same graph 1 or more weeks later", explain: "How long after the floor pass an escalation run may still need to resume the same workflow." },
        ],
        breaks: {
          failure: "The box is long-running, so worker loss mid-graph is normal rather than exceptional.",
          handled: "Job output paths are pure functions of input plus encoder build, which is what makes a retry overwrite itself byte for byte rather than corrupting state.",
        },
      },
    },
    {
      id: "splitter",
      label: "Probe + split",
      sub: "forced closed GOPs at 6s",
      kind: "service",
      col: 1,
      row: 2,
      parent: "pipeline-zone",
      detail: {
        what: "Reads the source object once: rejects a broken container, then re-cuts the timeline on fixed six-second boundaries with a forced closed group of pictures at each cut. It records the byte offset of every segment.",
        why: "Segment-parallel encoding works only because a segment can be encoded without reference to its neighbours, and that is a property you create rather than one you find. A camera puts keyframes wherever it likes. The recorded byte offsets are what let each encode worker issue one ranged read instead of seeking a 2.5GB object.",
        numbers: [
          { value: "120 segments for a 12-minute video", explain: "The segment count one video's timeline is cut into for parallel encoding." },
          { value: "keyframe timestamps identical across all 2 floor rungs", explain: "The invariant that makes switching between rungs mid-playback seamless." },
          { value: "one pass over the source, CPU-bound", explain: "Running on CPU rather than GPU frees every accelerator in the 1,200-strong encode fleet for the actual transcode work that follows." },
        ],
        breaks: {
          failure: "Both of its failures are quiet. Cut on the wrong frame and segments do not concatenate cleanly.",
          handled: "The player shows a flash of macroblocks at every boundary in that case. If 360p and 720p cut on different timestamps instead, a player cannot switch rung mid-stream without a visible stall; both are caught by downstream duration checks.",
        },
        choice: {
          pick: "Re-cut the source at fixed 6s boundaries with forced closed GOPs",
          instead: "Segment on the source's own keyframes wherever they happen to fall.",
          decider:
            "Cross-rung switchability. Adaptive bitrate requires every rung to carry a keyframe at the same presentation timestamp, which the source cannot guarantee. Forcing keyframes at the segment length costs on the order of 10% bitrate.",
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
      col: 1,
      row: 3,
      parent: "pipeline-zone",
      detail: {
        what: "The durable work queue between the orchestrator and the GPU fleet, split into two lanes: the floor pass, and a preemptible lane carrying escalation work.",
        why: "It is the shock absorber for a 2x diurnal peak and for news events that double upload rate for hours. Because the backlog drains in minutes against a tens-of-seconds SLO, queueing is cheaper than provisioning to peak, and the lane split is what makes shedding safe.",
        numbers: [
          { value: "~900M segment jobs/day at the floor", explain: "The daily job volume this queue carries at the floor rungs alone." },
          { value: "peak upload rate ~2x the daily mean", explain: "The diurnal swing this queue absorbs as backlog rather than as provisioned peak capacity." },
          { value: "queue drains in minutes, SLO is under 60 seconds", explain: "How quickly the backlog clears versus the target latency for one video's floor pass." },
        ],
        breaks: {
          failure: "Queue depth and oldest-job age are the creator-visible SLO in disguise.",
          handled: "If the two lanes share priority, an escalation burst on yesterday's viral videos delays today's uploads becoming playable, which is exactly why escalation is preemptible and shed first.",
        },
        choice: {
          pick: "Two lanes, escalation preemptible and shed first",
          instead: "One priority queue with escalation jobs at a lower priority number.",
          decider:
            "What you do at 10x. A shared queue still holds the escalation work in memory and still schedules it between floor jobs. A separate preemptible lane can be stopped outright instead, the only lever that returns the whole fleet to the floor pass.",
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
      col: 1,
      row: 4,
      parent: "pipeline-zone",
      detail: {
        what: "Stateless workers that each pull one contiguous byte range of the source and emit one encoded segment for one rung.",
        why: "That independence is what turns 20 minutes of video into tens of seconds of wall clock. The floor is 360p and 720p; everything above it is commissioned later, which is the difference between a 1,200-GPU fleet and a 3,600-GPU one.",
        numbers: [
          { value: "~15x realtime for one 1080p rung", explain: "The encode speed this fleet achieves for one higher rung, relative to the video's own playback duration." },
          { value: "7.3 GPU-min/source-hour full ladder vs 2.2 at the floor", explain: "The GPU-time cost of the full quality ladder against just the two floor rungs, per hour of source video." },
          { value: "at most 0.4 GPU-seconds per 720p segment", explain: "The per-segment GPU cost at the floor, small enough that 240 segments still finish in under a minute." },
        ],
        breaks: {
          failure: "Below a few minutes of source the job is bound by object-store round trips rather than GPU, 240 ranged reads and 240 writes.",
          handled: "Adding workers below that threshold makes it slower rather than faster, so very short videos are encoded whole on one worker instead of being segment-parallelised.",
        },
        choice: {
          pick: "Hardware H.264 on GPUs, segment-parallel at 6s, floor rungs only",
          instead: "CPU x264 encoding, or encoding the whole file on one worker.",
          decider:
            "Fleet arithmetic at 8.3 source-hours/s. Hardware encode runs several times faster than CPU at comparable quality. The floor at 0.55 1080p-equivalents against a full ladder at 1.82 is the difference between ~1,200 and ~3,600 saturated GPUs.",
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
      col: 2,
      row: 4,
      parent: "pipeline-zone",
      detail: {
        what: "Writes fragmented MP4 segments once, emits an HLS playlist and a DASH MPD over the same objects, and extracts thumbnails on the floor pass.",
        why: "iOS requires HLS and everything else speaks DASH, but since HLS gained fMP4 support in 2016 the difference is two small text files rather than two copies of the bytes. Thumbnails are generated here because they are cheap and creator-visible immediately, unlike everything expensive.",
        numbers: [
          { value: "a 6s 720p segment is ~1.9MB", explain: "The typical size of one segment object this stage produces." },
          { value: "manifests ~5KB", explain: "The tiny size of the two text manifests generated over each shared segment set." },
          { value: "~900M new objects/day at the floor", explain: "The daily object count this stage writes, a real cost line in its own right." },
        ],
        breaks: {
          failure: "It writes the mutable half of the system. A manifest rewritten before its segments are durable surfaces as a mid-playback 404.",
          handled: "Players stall rather than stepping down a rung, so segments go down first and the manifest is promoted atomically last, never the reverse.",
        },
        choice: {
          pick: "One CMAF fMP4 byte-stream, two manifests over it",
          instead: "MPEG-TS segments for HLS and separate fMP4 segments for DASH.",
          decider:
            "Duplicate storage for no compatibility gain. Two segment formats doubles 1.15PB/day of encoded output and doubles a 900M-object/day PUT bill that already runs ~$4.5k/day. CMAF standardised the container in 2018 and HLS has read fMP4 since 2016.",
          flips:
            "When you must serve players old enough to require transport-stream HLS, where the duplication is the price of reaching them at all.",
        },
      },
    },
    // --- the check branch, column C ---
    {
      id: "moderation",
      label: "Moderation + rights gate",
      kind: "serviceGroup",
      col: 2,
      row: 1,
      parent: "pipeline-zone",
      detail: {
        what: "One gate service, three stages of a single verdict: sample and classify, fingerprint against the rights catalogue, then decide whether this video may be published. The rights catalogue is reference fingerprints that rights holders register themselves, each carrying a policy of block, monetise or track.",
        why: "This is one service rather than three because it returns one answer to one caller in seconds and is deployed and scaled as a unit. The classifier pass is ~30 GPUs platform-wide, a rounding error against the 1,200-GPU encode fleet. It runs as a parallel branch of the transcode DAG because it is cheap and the encode is not, so gating on it costs nothing in wall clock.",
        numbers: [
          { value: "verdict within a few seconds, both of 2 branches must be green", explain: "Fast enough, sharing one decode, to run as a parallel branch of the transcode DAG rather than a gate the much longer encode has to wait behind." },
          { value: "~0.7 GPU-seconds/video, ~30 GPUs platform-wide", explain: "The compute cost of this entire safety and rights pass, negligible against the encode fleet." },
          { value: "3.6M videos/day", explain: "The daily volume this gate has to check without ever blocking the encode." },
          { value: "rights catalogue queried once per upload, nearest-neighbour not equality", explain: "The lookup shape this stage performs, since re-encoding changes the bits but not the content." },
        ],
        breaks: {
          failure: "It owns the exposure window, and that window can never be driven to zero at 3.6M uploads a day.",
          handled: "The honest metric is exposure-hours before takedown rather than an incident count, a target somebody has to sign off on. Coverage gaps in the rights catalogue are invisible the same way.",
        },
        choice: {
          pick: "One synchronous gate service, three internal stages sharing a decode",
          instead: "Three separate services, classifier, fingerprint matcher, verdict, chained by queues.",
          decider:
            "Shared cost. The classifier and fingerprint stages want the same decoded frames, and re-decoding per service would double the ~30-GPU platform-wide cost of the whole check branch for no new information. Queueing between three services also adds hops to a path that has to return in seconds.",
          flips:
            "When one stage needs independent scaling or a different deploy cadence from the other two. An example is a fingerprint matcher whose reference catalogue update schedule has nothing to do with the classifier model's.",
        },
      },
    },
    {
      id: "classifiers",
      label: "Frame + audio classifier",
      sub: "1 frame/s sampled",
      kind: "process",
      col: 2,
      row: 3,
      parent: "moderation",
      detail: {
        what: "Decodes the source once, samples one frame a second plus the audio track, and scores both against the safety models.",
        why: "Sampling rather than scoring every frame is what makes a synchronous gate affordable. 720 frames for a 12-minute video at ~1,000 frames/s/GPU is 0.7 GPU-seconds, so the whole platform's safety pass costs ~30 GPUs. Against a 1,200-GPU encode fleet there is no cost case for skipping it.",
        numbers: [
          { value: "~720 frames per 12-min video", explain: "The sampled frame count this stage actually scores, versus the full ~43,000 real frames." },
          { value: "~1,000 frames/s/GPU", explain: "The classifier's per-GPU throughput, the number that makes platform-wide cost affordable." },
          { value: "~30 GPUs platform-wide", explain: "The total fleet size this whole safety pass requires across all uploads." },
        ],
        breaks: {
          failure: "Sampling at 1 Hz means a violation shorter than a second between sampled frames is not seen.",
          handled: "The score band it returns is a probability rather than an answer, which is why the gate downstream is risk-tiered instead of thresholded once.",
        },
        choice: {
          pick: "Sample 1 frame/s and the audio track",
          instead: "Score every frame of every upload.",
          decider:
            "30 GPUs against 21,600. A 12-minute video is 720 sampled frames but ~43,000 real ones. Full-rate scoring costs more than the entire encode fleet to catch violations that are almost always many seconds long.",
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
      col: 2,
      row: 4,
      parent: "moderation",
      detail: {
        what: "Computes perceptual audio and video fingerprints from the frames the classifier stage already decoded, and looks them up against the rights catalogue.",
        why: "It shares a decode with the classifier pass because decoding is the expensive part and both stages want the same frames. Rights matching has to survive re-encoding, so an exact hash is useless here: the lookup is a nearest-neighbour search over perceptual descriptors.",
        numbers: [
          { value: "shares 1 decode with the classifier pass", explain: "The single decode this stage reuses rather than paying for its own." },
          { value: "returns a match id or nothing, in under 5 seconds", explain: "Fits inside the gate's few-second budget by reusing the classifier's decode — this stage adds a lookup, not a second pass over the video." },
        ],
        breaks: {
          failure: "It loses an arms race. Robust fingerprints handle re-encoding, cropping, mirroring, time-shifting and pitch-shifting individually, but lose to combinations of them.",
          handled: "Low-reach infringement is largely uncaught, since robust fingerprints lose to combined transforms. The reachable goal is making evasion expensive through repeated detection, not eliminating it outright.",
        },
        choice: {
          pick: "Perceptual fingerprints matched against a reference catalogue",
          instead: "Exact content hashing of the uploaded file.",
          decider:
            "What a re-upload actually looks like. An exact hash catches only a byte-identical file, and every real infringing re-upload has been through at least 1 transcode, so the hash changes while the content does not.",
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
      col: 2,
      row: 5,
      parent: "moderation",
      detail: {
        what: "Combines the safety score and the match result into publish, hold, or hold-and-queue-for-human-review, using account age, score band and known-harmful hashes to pick the tier.",
        why: "This is the stage that makes publication a gated event rather than a deployment step. It is the only design in the media cluster where the content itself is untrusted. It is risk-tiered rather than uniform because a uniform synchronous gate at a 1% false-positive rate wrongly delays about 36,000 legitimate creators a day.",
        numbers: [
          { value: "3.6M videos/day", explain: "The daily upload volume this verdict stage decides on." },
          { value: "1% false positives is ~36k creators/day delayed", explain: "The concrete cost of a naive uniform threshold, the number that motivates risk tiering instead." },
          { value: "human review at 5 min/video would need ~37,500 reviewers", explain: "The staffing cost a universal human review gate would require at this volume." },
        ],
        breaks: {
          failure: "Everything slower than seconds runs after the video is live, so the residual risk is real.",
          handled: "It is spent deliberately: the human queue is ordered by predicted reach rather than by arrival, and tombstoning is available at any point afterwards.",
        },
        choice: {
          pick: "Synchronous classifier and fingerprint gate, human review asynchronous and risk-ordered",
          instead: "Hold every upload private until human review clears it.",
          decider:
            "3.6M videos/day at 5 minutes of review each is 300k reviewer-hours/day, about 37,500 full-time reviewers, so a universal human gate is not expensive but arithmetically unavailable.",
          flips:
            "Where a single exposure is unacceptable and volume is small enough to pay for: accounts under 24 hours old, scores in the uncertain band, known-harmful hashes. Also jurisdictions with pre-publication obligations.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "immutable segments, ~95% offload",
      kind: "gateway",
      col: 3,
      row: 1,
      detail: {
        what: "The tier that actually serves the bytes: pull-through on miss, with a predicted-hot slice pushed out in advance. A shield tier sits between the edges and the origin, collapsing simultaneous misses for the same object into one origin fetch.",
        why: "In aggregate the system serves ~800 bytes for every byte it produces, so the design question is cache strategy and egress rather than application throughput. Nothing between the player and the object store holds per-viewer session state, which is precisely what makes this tier a dumb cache. Misses are not independent: a fast-rising video has thousands of edges wanting the same segment within the same second. Without the shield's coalescing the origin would see a correlated burst.",
        numbers: [
          { value: "~83 Tbps average, ~250 Tbps peak", explain: "The egress bandwidth this tier serves at typical and peak load." },
          { value: "segments max-age=31536000 immutable", explain: "The full year-long cache lifetime assigned to content-addressed segment objects." },
          { value: "manifests max-age=60", explain: "The much shorter cache lifetime on the mutable manifest, bounding how stale a viewer's view of available rungs can be." },
          { value: "shield holds origin to ~4 Tbps at 95% offload, ~45PB/day", explain: "What actually reaches the origin once the edge and shield tiers absorb the rest." },
        ],
        breaks: {
          failure: "Long segment TTLs are load-bearing for the cost model and directly oppose immediate takedown.",
          handled: "A cached segment URL stays fetchable across tens of thousands of edges for minutes at best after the manifest has already stopped serving. This is an accepted gap the metadata-level gate is designed to bound instead.",
        },
        choice: {
          pick: "Pull-through by default, push only the predicted-hot slice",
          instead: "Pre-position the catalogue to edges and ISP-embedded appliances ahead of demand.",
          decider:
            "Daily growth against appliance capacity. One day of encoded output is 1.15PB, and an ISP-embedded appliance holds 100 to 500TB. A single day of uploads is 2x to 10x what one box holds before the back catalogue even exists.",
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
      col: 2,
      row: 0,
      detail: {
        what: "Sharded by video_id: title, duration, three separate state fields for upload, publish and quality tier, plus one row per completed rung. A thin watch API sits in front, returning title, duration and the manifest URL, or a takedown if publish_state is tombstoned.",
        why: "Uploaded, published and escalated are independent events, and conflating them into one status is the classic mistake here: it tells creators a video is ready when it is not. Gating playback at that read hop rather than at the CDN is what makes a takedown effective within seconds even though the segments behind it stay cached. Signed URLs would destroy the ~95% edge offload the whole cost model rests on, so takedown speed is bought at the metadata read, not at the segment fetch.",
        numbers: [
          { value: "3.6M new video rows/day", explain: "The daily write volume of new video records into this store." },
          { value: "read once per watch page, never per segment", explain: "The read pattern that keeps this store's load orders of magnitude below the delivery path it fronts." },
          { value: "watch API: one call per watch, ~1B watch-hours/day behind it", explain: "The scale of activity this thin read hop ultimately gates." },
        ],
        breaks: {
          failure: "It is the fast half of a takedown. Manifest hydration reads publish_state, so a tombstone stops new playback within seconds.",
          handled: "Cached segment URLs stay fetchable until they are purged or evicted, so this read hop stops players, not bytes. It is an accepted split between what can be fixed instantly and what cannot.",
        },
        choice: {
          pick: "Three state fields plus a wide-column video_rungs table",
          instead: "A single status enum on the video row covering the whole lifecycle.",
          decider:
            "The states are not ordered. A video can be published at the floor and escalating, or fully encoded and blocked on a rights verdict. One enum over 3.6M videos/day forces a combinatorial state list that every reader has to interpret identically.",
          flips:
            "A pipeline with a genuinely linear lifecycle and one output, where an enum is legible and a second table is ceremony.",
        },
      },
    },
    {
      id: "viewer",
      label: "Viewer player",
      sub: "ABR, picks its own rung",
      kind: "client",
      col: 3,
      row: 2,
      detail: {
        what: "The player: fetches a manifest, estimates bandwidth from its own download timings, and requests the next six-second segment at whichever rung it chooses.",
        why: "Bandwidth changes during playback and the server cannot observe it, so the decision belongs to the only party holding the measurement. A Wi-Fi to cellular handover becomes a quality drop rather than a stall.",
        numbers: [
          { value: "time-to-first-frame under 500ms at p95", explain: "The startup latency target this player is expected to hit." },
          { value: "rebuffer under 0.5% of watch time", explain: "The target for how rarely playback stalls waiting for data." },
          { value: "6s segments", explain: "The granularity at which this player can switch rungs." },
        ],
        breaks: {
          failure: "A player mid-playback will not see an escalated rung until it refreshes the manifest.",
          handled: "Most players refresh only on a seek or a stall. A quality upgrade lands on the next viewer rather than the current one, an accepted delay rather than a push mechanism.",
        },
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
  ],
  edges: [
    {
      id: "e1",
      from: "creator",
      to: "upload-api",
      tier: "control",
      label: "init: presigned parts",
      detail: {
        what: "POST /upload/init returning an upload_id, a part size and a list of presigned part URLs.",
        why: "This is a control path because it is the only part of the upload the application tier participates in. Everything after it is the client talking to storage directly, which is what keeps this tier stateless at 83 upload starts a second.",
        numbers: [{ value: "83 upload starts/s at peak", explain: "The peak call rate this endpoint absorbs, entirely decoupled from data volume." }],
        breaks: {
          failure: "Presigned URLs expire.",
          handled: "A long-running upload has to be able to ask for fresh ones without restarting the session, so URL refresh is built into the client protocol from the start.",
        },
      },
    },
    {
      id: "e2",
      to: "encoded-store",
      tier: "hot",
      step: 1,
      from: "creator",
      label: "5MB parts, direct PUT",
      detail: {
        what: "The video bytes themselves, written part by part straight into object storage and acknowledged individually.",
        why: "This is the arrow that must not pass through a server. Part-level acknowledgement is what turns a failure at part 47 into a resume at 47 rather than at zero, and it keeps 25k concurrent uploads off the application fleet.",
        numbers: [
          { value: "~2.5GB for a 20-minute upload", explain: "The typical total volume one upload session writes across this arrow." },
          { value: "~720TB/day of source", explain: "The aggregate daily volume this arrow carries across all uploads." },
        ],
        breaks: {
          failure: "An abandoned multipart session leaves orphaned parts.",
          handled: "These are billed until a lifecycle rule aborts them, so orphaned-session cleanup is an explicit policy rather than assumed away.",
        },
      },
    },
    {
      id: "e3",
      from: "upload-api",
      to: "metadata",
      tier: "control",
      label: "video row created",
      detail: {
        what: "Creating the video row with upload_state set and publish_state unset.",
        why: "The row has to exist before the bytes finish so the creator has something to poll. The pipeline also needs somewhere to record readiness transitions when the completion event fires.",
        breaks: {
          failure: "If the row and the multipart session disagree the video is invisible to the creator.",
          handled: "Its bytes are still being paid for in that case, so row-session consistency is checked directly rather than trusted to always match.",
        },
      },
    },
    {
      id: "e4",
      to: "orchestrator",
      tier: "hot",
      step: 2,
      from: "encoded-store",
      label: "completion event",
      detail: {
        what: "The bucket completion event for the assembled source object, which starts a transcode workflow.",
        why: "Durability of the source is the trigger, not the client's claim to have finished. Starting from the object means a retry weeks later reads exactly the same bytes and the job is safe to replay.",
        numbers: [{ value: "~3.6M videos/day", explain: "The daily volume of completion events this arrow generates, each starting one workflow." }],
        breaks: {
          failure: "A dropped or duplicated event either strands a video in processing forever or starts two passes.",
          handled: "Workflow identity comes from the source hash, so a duplicate event resolves to the same workflow instead of starting a second one.",
        },
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "splitter",
      tier: "hot",
      step: 3,
      label: "probe, then split",
      detail: {
        what: "The first two nodes of the graph: reject a broken container, then re-cut the timeline at forced closed GOPs and record the byte offsets.",
        why: "Rejecting here rather than after the fan-out is the cheapest possible failure: a broken container costs one probe instead of 240 scheduled jobs that all fail the same way.",
        breaks: {
          failure: "A container that probes clean but decodes badly gets through.",
          handled: "The first thing to notice is the segment-duration check at packaging, which is why that check exists as a second, independent line of defence.",
        },
      },
    },
    {
      id: "e6",
      to: "encoders",
      tier: "data",
      from: "encoded-store",
      label: "ranged read per job",
      offset: 40,
      detail: {
        what: "Each encode worker pulls exactly one contiguous byte range of the source, the range its split step recorded.",
        why: "This is the arrow that decides wall clock on short videos. 240 ranged reads and 240 writes dominate a floor pass whose actual GPU work is under two minutes. Passing byte offsets is what stops every worker seeking through a 2.5GB object.",
        numbers: [
          { value: "240 reads and 240 writes for a 12-minute floor pass", explain: "The full I/O count this arrow generates for one video's floor encode." },
          { value: "~1GB per source hour", explain: "The typical byte volume this arrow moves per hour of source video." },
        ],
        breaks: {
          failure: "Past a few hundred workers on one video every extra worker is another set of round trips against the same source object.",
          handled: "The job gets slower rather than faster past that point, which is why worker count per video is capped rather than scaled unboundedly.",
        },
      },
    },
    {
      id: "e7",
      from: "splitter",
      to: "work-queue",
      tier: "hot",
      step: 4,
      label: "240 jobs, byte offsets",
      detail: {
        what: "One job per segment per rung, each carrying the byte range and the target rung, published onto the floor lane.",
        why: "The fan-out is the whole point of the split: a 12-minute video becomes 120 segments across 2 rungs. Each of those is independently retryable rather than the video being retryable.",
        numbers: [
          { value: "120 segments x 2 rungs for 12 minutes", explain: "The exact job count this arrow produces for a typical floor pass." },
          { value: "~900M segment jobs/day", explain: "The aggregate daily job volume this arrow feeds into the work queue." },
        ],
        breaks: {
          failure: "Escalation publishes to the preemptible lane instead, with split, thumbnails and notify skipped.",
          handled: "A lane misconfiguration silently makes escalation compete with the creator-visible pass, which is why lane assignment is validated rather than assumed correct.",
        },
      },
    },
    {
      id: "e8",
      from: "work-queue",
      to: "encoders",
      tier: "hot",
      step: 5,
      label: "one segment per worker",
      detail: {
        what: "Workers pull jobs and are free to die: the job returns to the queue and the retry writes the same bytes to the same path.",
        why: "Idempotency is what makes at-least-once delivery safe here. The output path is a pure function of source hash, rung, encoder build and index, so a duplicate delivery overwrites itself byte for byte.",
        numbers: [
          { value: "at most 0.4 GPU-seconds per 720p segment", explain: "The per-segment compute cost at the higher floor rung." },
          { value: "~0.05 for the 360p rung", explain: "The comparable, much smaller cost at the lower floor rung." },
        ],
        breaks: {
          failure: "An encoder or driver upgrade between two runs of the same video changes the output subtly.",
          handled: "This is why the build is in the path and never in a header. A build change is guaranteed to produce a new, distinct object rather than silently mutating an old one.",
        },
      },
    },
    {
      id: "e9",
      from: "encoders",
      to: "packager",
      tier: "hot",
      step: 6,
      label: "fMP4 segments",
      detail: {
        what: "Completed per-rung segments handed to packaging once the orchestrator has verified the count and summed duration.",
        why: "Packaging is cheap and encoding is not, so the split lets a rung be published the moment its own segments exist rather than waiting on the rest of the ladder.",
        breaks: {
          failure: "Rungs whose keyframes sit at different presentation timestamps cannot be switched between mid-stream.",
          handled: "This is the last step that can catch it, so the duration and count check here is treated as the final gate before publication.",
        },
      },
    },
    {
      id: "e10",
      from: "packager",
      to: "encoded-store",
      tier: "hot",
      step: 7,
      label: "segments + 2 manifests",
      detail: {
        what: "Writing fragmented MP4 segments to content-addressed paths and promoting the HLS and DASH manifests atomically.",
        why: "Segments go down first and the manifest last. A manifest that references a segment which is not there yet hands every player a 404 mid-playback, and most players stall instead of stepping down.",
        numbers: [
          { value: "~900M new objects/day", explain: "The daily object-write volume this arrow generates." },
          { value: "~$4.5k/day in PUTs alone", explain: "The direct cost of just the write operations this arrow performs." },
        ],
        breaks: {
          failure: "Object count is a real cost line here rather than a rounding error.",
          handled: "This is one of the arguments against producing rungs nobody asked for, reinforcing why escalation stays selective rather than encoding everything up front.",
        },
      },
    },
    {
      id: "e11",
      from: "orchestrator",
      to: "classifiers",
      tier: "control",
      label: "check branch, in parallel",
      detail: {
        what: "A parallel branch of the same workflow, started at the same time as the split and joined before publication.",
        why: "It runs alongside rather than after because it is cheap and the encode is not, so gating on it costs nothing in wall clock. Publication waits on both branches, not on either one alone.",
        numbers: [
          { value: "~0.7 GPU-seconds per video", explain: "The compute cost this parallel branch adds per upload." },
          { value: "~30 GPUs platform-wide", explain: "The total fleet size this whole branch requires across all uploads." },
        ],
        breaks: {
          failure: "If the join is dropped and publication waits only on the encode, visibility becomes a deployment step rather than a gated event.",
          handled: "That is the whole distinction this design turns on, which is why the join condition is enforced structurally by the orchestrator rather than left to convention.",
        },
      },
    },
    {
      id: "e12",
      from: "classifiers",
      to: "fingerprint",
      tier: "data",
      label: "one decode, reused",
      detail: {
        what: "The decoded frames and audio the classifier pass already produced, handed to fingerprinting rather than decoded a second time.",
        why: "Decoding is the expensive part of both checks, and doing it once is what keeps the entire platform's gate at ~30 GPUs. It is also why these are stages of one service rather than two services that would each pull the source.",
        breaks: {
          failure: "The two stages now share a failure: a decode that dies takes both checks with it.",
          handled: "The workflow retries the whole branch rather than one check in that case, an accepted coupling traded for the shared-decode savings.",
        },
      },
    },
    {
      id: "e13",
      from: "classifiers",
      to: "verdict",
      tier: "data",
      label: "safety score",
      offset: 40,
      detail: {
        what: "A score per policy class rather than a boolean, carried straight to the gate.",
        why: "The gate needs the band, not the answer: a score in the uncertain range routes to human review, a high score holds, a low score publishes. Collapsing it to a boolean here would throw away the only information the risk tiering runs on.",
        numbers: [{ value: "1% false positives is ~36k creators/day delayed", explain: "The scale of harm even a small error rate causes at this volume." }],
        breaks: {
          failure: "A model update that shifts the score distribution silently re-tiers every upload.",
          handled: "The thresholds are re-derived whenever the model changes, so drift is caught by deliberate recalibration rather than by symptom.",
        },
      },
    },
    {
      id: "e14",
      from: "fingerprint",
      to: "verdict",
      tier: "data",
      label: "match id or none",
      detail: {
        what: "The matched reference asset and its policy, or nothing.",
        why: "Most matches are not takedowns. The policy attached to the reference decides between block, monetise and track, so the gate is applying somebody else's rule rather than making a judgement.",
        breaks: {
          failure: "A false match blocks a legitimate creator on somebody else's catalogue entry.",
          handled: "This is the failure with the worst appeal cost in the whole system, so match confidence and appeal turnaround are both tracked as their own signals.",
        },
      },
    },
    {
      id: "e16",
      from: "verdict",
      to: "metadata",
      tier: "control",
      label: "verdict gates publish",
      detail: {
        what: "An append-only verdict row per check, and the flip of publish_state when both branches come back green.",
        why: "Verdicts are appended rather than overwritten because a takedown has to be able to show what was known at the time the video was allowed through.",
        breaks: {
          failure: "This same field is what a tombstone writes later.",
          handled: "The takedown path and the publish path share one read on the serving side and cannot disagree, since both go through this one field.",
        },
      },
    },
    {
      id: "e17",
      from: "orchestrator",
      to: "metadata",
      tier: "control",
      label: "readiness + rung rows",
      detail: {
        what: "Writing a video_rungs row per completed rung and moving the video through uploaded, floor-published and escalated.",
        why: "The rung row exists only once every segment of that rung is durable. The manifest generator then reads a table with no partial state in it and needs no special case.",
        numbers: [{ value: "one row per completed rung", explain: "The granularity at which readiness state is recorded, keeping partial rungs entirely invisible to readers." }],
        breaks: {
          failure: "If readiness is inferred from bucket contents instead, a half-written rung looks complete.",
          handled: "It gets advertised in a manifest in that case, which is exactly why readiness is written explicitly here rather than inferred from storage state.",
        },
      },
    },
    {
      id: "e18",
      from: "packager",
      to: "cdn",
      tier: "data",
      label: "pre-warm hot slice",
      detail: {
        what: "A push of the floor rung to major points of presence, fired for channels above a subscriber threshold and for scheduled premieres. The escalation controller also fires it when a video crosses the velocity threshold in its first minutes.",
        why: "For a known audience with a known start time, one planned fill beats any reactive mechanism, because the traffic arrives faster than a cache fills.",
        breaks: {
          failure: "The push can only carry rungs that exist.",
          handled: "On a first-time uploader's video the push and the escalation race each other and both lose the first hour, an accepted gap for unpredictable virality.",
        },
      },
    },
    {
      id: "e19",
      to: "cdn",
      tier: "data",
      from: "encoded-store",
      label: "origin fetch on miss",
      detail: {
        what: "The origin read that fills the shield, one per object no matter how many edges asked for it simultaneously.",
        why: "This is the only path by which viewer traffic reaches storage at all, and it exists to be rare: at 95% offload it carries 5% of 900PB/day.",
        numbers: [{ value: "45PB/day, about 4 Tbps", explain: "The actual volume that reaches the origin once the shield collapses correlated misses." }],
        breaks: {
          failure: "Cold-tier objects are minutes away rather than milliseconds.",
          handled: "A reawakened long-tail video stalls here unless a warm 360p rung was kept, which is why the lifecycle policy retains a 360p floor rather than deleting everything.",
        },
      },
    },
    {
      id: "e21",
      from: "cdn",
      to: "viewer",
      tier: "hot",
      step: 8,
      label: "segments, ~95% at edge",
      detail: {
        what: "The manifest and then a stream of six-second segments, served from the nearest edge at whatever rung the player asked for.",
        why: "This is where essentially all the bytes in the system go. Segments are immutable at content-addressed URLs so they cache for a year; the manifest is the mutable exception and carries 60 seconds.",
        numbers: [
          { value: "~83 Tbps average, ~250 Tbps peak", explain: "The bandwidth this arrow serves at typical and peak load, essentially the whole system's egress." },
          { value: "~1.9MB per 6s 720p segment", explain: "The typical unit size delivered on each request along this arrow." },
        ],
        breaks: {
          failure: "An edge holding a stale manifest keeps serving a video that appears to top out at 720p.",
          handled: "This lasts for up to a minute after escalation completed, bounded directly by the manifest's 60-second TTL, an accepted delay rather than an instant push.",
        },
      },
    },
    {
      id: "e22",
      to: "metadata",
      tier: "control",
      from: "viewer",
      label: "GET /watch/{id}",
      detail: {
        what: "The page-level read before a single byte of video is fetched: title, duration, publish_state and the manifest URL.",
        why: "Playback is gated here rather than at the CDN, which is what makes a tombstone effective within seconds even though the segments behind it stay cached and fetchable.",
        breaks: {
          failure: "It is the one uncached hop on the read path.",
          handled: "It is sized against page views rather than against segment requests, three orders of magnitude smaller than the delivery path it fronts, so this hop stays cheap despite being uncached.",
        },
      },
    },
    {
      id: "e24",
      to: "orchestrator",
      tier: "control",
      from: "viewer",
      label: "watch events",
      detail: {
        what: "Watch events feeding the per-video sliding-window counters, the same stream the recommendation system consumes for its own purposes.",
        why: "This is the only signal that tells you what a video is worth, and it arrives hours after the encoding decision it should have informed. The whole cost model rests on this arrow being cheap and roughly right rather than exact.",
        numbers: [
          { value: "~1B watch-hours/day", explain: "The daily scale of the signal feeding this arrow." },
          { value: "a 1-hour sliding window", explain: "The time horizon the escalation decision is based on, deliberately short and approximate." },
        ],
        breaks: {
          failure: "It must never sit on the playback path: an outage here costs escalation decisions.",
          handled: "Blocking playback on it would trade a 99.99% SLO for a best-effort one, so this arrow is kept strictly off the critical path by design.",
        },
      },
    },
  ],
  figures: {
    pipeline: {
      title: "Transcoding pipeline: split into independent segment jobs",
      nodes: [
        { id: "upload", label: "Raw upload", sub: "S3 ingest + validate", kind: "blob", col: 0, row: 0 },
        { id: "split", label: "Split into segments", sub: "6s each, 600/hr video", kind: "service", col: 0, row: 1 },
        {
          id: "jobs",
          label: "N parallel segment jobs",
          sub: "closed GOP per segment",
          kind: "queue",
          col: 0,
          row: 2,
          detail: {
            what: "One independent job per segment, dispatched to whatever encoder capacity is free.",
            why: "A segment can be encoded without referencing its neighbours only because every cut forces a closed group of pictures. That is what turns a twenty-minute video into hundreds of parallel jobs instead of one long stream.",
          },
        },
        {
          id: "encode",
          label: "Encode all rungs",
          sub: "1080p/720p/480p/240p, GPU",
          kind: "service",
          col: 0,
          row: 3,
          detail: {
            what: "Each rung's encoder for a segment, run in parallel across the same split.",
            why: "GPU compute for a floor pass is under two minutes of work; wall clock is dominated by object-store round trips, which is why the split records byte offsets so each worker issues one ranged read.",
          },
        },
        { id: "package", label: "Package HLS/DASH", sub: "fMP4 + manifest", kind: "service", col: 0, row: 4 },
        { id: "ready", label: "Status: READY", sub: "notify + pre-warm CDN", kind: "service", col: 0, row: 5 },
      ],
      edges: [
        { id: "e1", from: "upload", to: "split", tier: "hot", step: 1, label: "validated source" },
        { id: "e2", from: "split", to: "jobs", tier: "hot", step: 2, label: "byte offsets recorded" },
        { id: "e3", from: "jobs", to: "encode", tier: "hot", step: 3, label: "one ranged read each" },
        { id: "e4", from: "encode", to: "package", tier: "hot", step: 4, label: "rung-aligned keyframes" },
        { id: "e5", from: "package", to: "ready", tier: "hot", step: 5, label: "playable manifest" },
      ],
    },
  },
};
