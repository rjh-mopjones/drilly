import type { Diagram } from "./types";

export const INSTAGRAM: Diagram = {
  id: "instagram",
  title: "Instagram",
  question: "Design Instagram",
  sourceId: "patterns",
  itemId: 27,
  overview: {
    shape:
      "Two paths that meet at a URL and nowhere else: 2MB of pixels travel down the left through a pre-signed PUT, a transcode ladder and a CDN, while a kilobyte of metadata travels down the right through the post row, fan-out and the feed, and the API tier never touches a byte in either direction.",
    beats: [
      "Upload bypasses the application tier entirely. The client asks the API for a pre-signed PUT, the API mints a post_id and writes a row with status=processing, and the phone uploads straight to object storage. At 1.2k posts/s and 2MB each, proxying instead would push 2.4GB/s of pass-through traffic across a fleet sized for JSON request handling.",
      "The landed object raises an event onto a durable queue and a worker pool consumes it, decodes the source once (HEIC, JPEG, PNG) and encodes a fixed four-rung ladder in parallel: 100px thumbnail at ~10KB, 480px at ~80KB, 1080px at ~300KB and a re-encoded full size at ~2MB, each in AVIF and WebP with a JPEG fallback.",
      "Pre-encoding at upload rather than resizing on request is the central efficiency decision, and the total is not what settles it. Pre-encoding is ~2 CPU-seconds per post, about 2,300 cores continuous, spent in a background queue where a 5 second p95 is invisible. On-demand at a 95% hit ratio and 600k peak feed loads is ~4,500 cores sitting between a user and an image.",
      "Async generation forces the rest of the design. The post row exists before its bytes are servable, so status is load-bearing: the post is hidden from every feed, grid and search result until it flips to ready, fan-out fires on post_ready rather than on insert, and the author gets a synchronously generated thumbnail so a creator never thinks the upload failed.",
      "On read the feed response is a few kilobytes of JSON carrying CDN URLs and dimensions, never image data, and the client picks the rung that fits its viewport and its network. Fan-out itself is the news feed answer and question 8 is the deep treatment; here it is one component that moves 8-byte post ids and never sees a pixel.",
      "Delivery is a cache hit in the viewer's city. URLs are content-addressed per rung and immutable with a one year max-age, which is what makes a >95% hit ratio reachable and holds origin egress to ~72Gbps. It is also the direct cause of the deletion problem: an edge purge across hundreds of POPs is best effort by construction.",
    ],
    crux:
      "Immutability is what buys the hit ratio and it is what makes deletion impossible to do properly. A one year max-age on an unguessable path is the reason 95% of 600k feed loads per second never reach origin, and it is the reason a deleted post's bytes remain fetchable from an edge for minutes to hours by anyone holding the URL. Every clean fix breaks the thing that pays for the system: short TTLs destroy the ratio, per-viewer signatures destroy shared cacheability, and an edge tombstone check makes media availability depend on metadata availability, which is the exact coupling the two-path split exists to avoid.",
    numbers: [
      "100M posts/day, ~1.2k/s steady, 2MB avg original",
      "ladder 10KB / 80KB / 300KB / 2MB = ~2.4MB per post",
      "440TB/day of media, ~40PB hot per quarter",
      ">95% CDN hit ratio, 30k origin fetches/s, ~72Gbps",
    ],
  },
  nodes: [
    {
      id: "byte-path",
      label: "The byte path",
      kind: "group",
      x: 16,
      y: 104,
      w: 328,
      h: 532,
      detail: {
        what: "Everything a pixel touches: the raw landing bucket, the notification queue, the transcode pool, the variant store and the CDN in front of them.",
        why: "Deciding who should see a post is a graph problem measured in microseconds per edge, and delivering the post is a bandwidth problem measured in gigabits per second. They share nothing but an identifier, so they get separate infrastructure with separate scaling curves.",
        numbers: ["~72Gbps origin egress", "API fleet sized for ~1KB rows"],
        breaks:
          "The seam between the two halves: a post row exists before its bytes are servable, so every surface has to honour the status gate or followers get timeline entries pointing at 404s.",
      },
    },
    {
      id: "client-upload",
      label: "Client · upload",
      sub: "4MB HEIC from the camera roll",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The posting phone. It asks for an upload URL, then PUTs the file itself, and shows an 'uploading' state until the variants exist.",
        why: "The client is the only party holding the original bytes, and it is sitting on the worst network in the system. Making it talk to object storage directly means a slow mobile upload holds a storage connection open rather than an application thread that also runs auth and database calls.",
        numbers: ["~2MB average post", "retries aggressively on flaky mobile networks"],
        breaks:
          "Client retries are guaranteed, so every stage downstream has to be idempotent on the post_id the API minted or one upload becomes two posts.",
      },
    },
    {
      id: "api",
      label: "Upload API",
      sub: "mints post_id, signs the PUT",
      kind: "compute",
      x: 440,
      y: 0,
      w: 240,
      detail: {
        what: "The metadata tier. It mints a post_id, writes the row as processing, signs a scoped PUT URL and returns a few hundred bytes.",
        why: "This fleet exists to handle rows, not files. Keeping it off the byte path is what lets the same fleet size serve photos and video, because its throughput stops being a function of media volume entirely.",
        numbers: ["response is a few hundred bytes", "15 minute signature expiry"],
        breaks:
          "A loose signature turns the endpoint into an upload oracle: without a content-length bound a client PUTs a 5GB file against a URL you handed out, which is an unmetered write and a decode bomb for the worker.",
        choice: {
          pick: "Pre-signed PUT scoped to one key, one method, a max content length and a 15 minute expiry",
          instead: "Proxy the upload through the API tier and stream it to storage.",
          decider:
            "Pass-through bandwidth against fleet shape. 1.2k posts/s at 2MB is 2.4GB/s crossing servers provisioned for CPU-bound request handling, and a slow client holds a request thread for tens of seconds. 15 minutes rather than 60 seconds because the expiry has to cover a bad network, and the client re-requests rather than resuming.",
          flips:
            "Small files where the proxy cost is trivial, or when every byte must be inspected in-line before it lands, which a pre-signed PUT cannot do because the signature bounds the size and says nothing about the content.",
        },
      },
    },
    {
      id: "raw-store",
      label: "Object store · raw",
      sub: "originals, archive tier at 30d",
      kind: "store",
      x: 40,
      y: 120,
      w: 280,
      detail: {
        what: "Where the pre-signed PUT lands. Holds every uploaded original and is the only source a re-encode is ever run from.",
        why: "The codec cycle turns over roughly every five years, JPEG through WebP through AVIF, and every turn is a full re-encode of the corpus. Re-encoding from an already lossy derivative compounds generational loss, visibly by the second hop, so the original is kept even though most are never read again.",
        numbers: ["200TB/day of originals", "73PB/year, ~$73k/month at archive prices"],
        breaks:
          "Orphaned objects: an upload whose row was never completed is referenced by nothing and reclaimed by no lifecycle rule, which is the most common way this pipeline leaks storage.",
        choice: {
          pick: "Keep the original forever, tier to archive at 30 days, keep the 1080px rung warm as a fast fallback master",
          instead: "Delete the original once the ladder exists and promote the full-resolution derivative to master.",
          decider:
            "73PB/year of retained originals is about $73k/month at roughly $1/TB/month, which is predictable and small against the platform. The quality loss from re-encoding a derivative is permanent and unrecoverable, and it lands on every future codec migration.",
          flips:
            "When the original is enormous relative to what is served. A 5MB short video serving a 500KB rendition is a 10x ratio, and at that ratio the archive bill is the dominant line item rather than a rounding error.",
        },
      },
    },
    {
      id: "queue",
      label: "ObjectCreated queue",
      sub: "durable, at-least-once",
      kind: "bus",
      x: 40,
      y: 224,
      w: 280,
      detail: {
        what: "The notification the object store raises when a raw upload lands, consumed by the transcode pool.",
        why: "It is the buffer that lets upload rate and transcode capacity be different numbers. A global event driving 10x the normal upload rate does not fail uploads, it grows a queue, and the queue depth is the signal that scales the pool.",
        numbers: ["scale-up policy adds capacity within 30s", "~6k posts/s at a spike"],
        breaks:
          "Depth is the alerting signal, not worker CPU, because a saturated pool looks perfectly healthy per host while users watch 'uploading' for minutes and abandon.",
        choice: {
          pick: "A durable queue between the storage event and the workers, with the pool autoscaling on depth",
          instead: "Invoke the transcoder synchronously from the storage event notification.",
          decider:
            "Burst absorption. A 10x upload spike against a pool that adds capacity in 30s needs somewhere to put the backlog, and at-least-once redelivery is what makes a worker crash a retry rather than a lost post. The price is that every stage must be idempotent on post_id.",
          flips:
            "Low and predictable volume where a direct invocation is one less system to operate and a dropped event can simply be re-driven by hand.",
        },
      },
    },
    {
      id: "workers",
      label: "Transcode workers",
      sub: "4 rungs, AVIF/WebP/JPEG",
      kind: "compute",
      x: 40,
      y: 328,
      w: 280,
      detail: {
        what: "The autoscaling pool that decodes the source once and encodes the fixed ladder in parallel, then flips the post row to ready.",
        why: "This is where the whole design spends its compute, and it spends it off the read path deliberately. Perceptual hashing against known-bad fingerprints runs here too at ~20ms, and the ML classifier at ~200ms, both cheap against a 5 second pipeline.",
        numbers: ["~2 CPU-s/post, ~2,300 cores continuous", "~12k cores at the peak hour", "~5s p95 upload to ready"],
        breaks:
          "A rung that fails requeues the rung and not the post, because re-decoding a 12MP source to redo one 10KB thumbnail wastes the expensive half. Persistent failure needs a breakdown by source format or a new phone's codec looks like a generic outage.",
        choice: {
          pick: "Pre-encode a fixed four-rung ladder asynchronously at upload, before the post is publishable",
          instead: "Store one high-quality master and derive any requested size lazily at an image service in front of the cache.",
          decider:
            "Where the compute lands relative to the latency-critical path. Pre-encoding is ~2,300 cores in a queue where 5 seconds is invisible. On-demand at a 95% hit ratio and 600k peak feed loads is 30k derivations/s, ~4,500 cores even at 150ms each, every one of them between a user and an image.",
          flips:
            "When the variant space is combinatorially large rather than a fixed menu. Arbitrary crops, per-surface aspect ratios and four pixel densities take the ladder from 4 rungs to 40 and pre-encoding from 2.4MB to ~24MB per post, which is 2.4PB/day.",
        },
      },
    },
    {
      id: "variant-store",
      label: "Variant store",
      sub: "deterministic keys, per-rung tiering",
      kind: "store",
      x: 40,
      y: 432,
      w: 280,
      detail: {
        what: "The derivative set, written at deterministic keys of the form {post_id}/{rung}.{codec} so a duplicate delivery overwrites identical bytes.",
        why: "Keying per rung rather than per post is what lets a rung move storage tier or be re-encoded without invalidating its siblings. Thumbnail and small stay hot forever because profile grids read them forever; medium tiers to warm at 90 days and full resolution to archive at 30.",
        numbers: ["~2.4MB of derivatives per post", "240TB/day of variants", "12 objects per post: 4 rungs x 3 codecs"],
        breaks:
          "Cold-tier revival has no predictor. Archive first-byte latency is seconds to minutes, which is fine for a deliberate download and wrong when a years-old photo resurfaces because something external to the platform linked it.",
        choice: {
          pick: "One object per rung per codec at a deterministic key, tiered by rung and age",
          instead: "One packed object per post, or tiering the whole derivative set by age alone.",
          decider:
            "Independent lifecycles. Full resolution is 85% of the bytes and rarely viewed while thumbnails are read forever, so a single tiering rule either keeps 160PB/year hot or makes grid scroll wait on archive. Per-rung keys also make an at-least-once redelivery a harmless overwrite instead of a second post.",
          flips:
            "When every rung is fetched together, where one packed object is one request and one cache entry rather than twelve.",
        },
      },
    },
    {
      id: "cdn",
      label: "Multi-tier CDN",
      sub: "edge, regional, then origin",
      kind: "store",
      x: 40,
      y: 536,
      w: 280,
      detail: {
        what: "City-level edges backstopped by regional nodes, with the variant store as origin of last resort. Rising posts get their small and medium rungs pre-warmed to regional caches.",
        why: "The marginal viewer has to be free, otherwise a post with ten million viewers costs ten million times a post with ten. Immutable per-rung URLs with a one year max-age are what make that true, because there is nothing to revalidate.",
        numbers: [">95% hit ratio, 30k origin fetches/s", "~9GB/s, ~72Gbps origin egress", "a fall to 80% takes egress to ~290Gbps"],
        breaks:
          "Purge is best effort. After a delete or a moderation removal, anyone holding the direct URL can still fetch the bytes until the entry ages out, and a POP that was offline during the purge serves stale content when it returns.",
        choice: {
          pick: "Content-addressed immutable public URLs on an unguessable path, signed short-lived URLs only for private accounts and DMs",
          instead: "Sign every media URL against the requesting user so each fetch is individually authorised and auditable.",
          decider:
            "Cache key cardinality sets the hit ratio, which sets origin egress. A per-viewer signature makes every URL unique and degrades the shared cache toward one entry per viewer; 95% to 80% takes egress from ~72Gbps to ~290Gbps, a 4x infrastructure step for identical traffic. A 5 minute expiry also breaks a scroll back up.",
          flips:
            "Predominantly private content, or regulation demanding per-access authorisation with an audit record. The middle path is edge compute validating a token carried outside the cache key, which costs an invocation on the hottest path in the system.",
        },
      },
    },
    {
      id: "posts-db",
      label: "Post metadata",
      sub: "wide-column, partition by user",
      kind: "store",
      x: 440,
      y: 120,
      w: 240,
      detail: {
        what: "The post row: caption, location, hashtags, the media URL set per rung, and the status field that gates visibility.",
        why: "Status is load-bearing because publishing is asynchronous. The row exists before the bytes are servable, so every surface filters on ready, and the transition is a compare-and-set so the second worker to finish is a no-op.",
        numbers: ["~1KB per row", "100GB/day, ~300GB/day at RF=3", "CAS processing to ready"],
        breaks:
          "A hot post pulls millions of hydrate reads onto one row, which is why the assembled post card is cached for 60s at the API tier rather than read through.",
        choice: {
          pick: "A wide-column store partitioned by user_id",
          instead: "A relational store with the media bytes in a BLOB column.",
          decider:
            "Write volume and access shape. 100M rows/day at ~1KB with reads that are single-partition profile scans and point lookups is exactly the wide-column case, and pre-sharding by user lets a hot partition split independently. Bytes never go here at all: 440TB/day belongs in object storage.",
          flips:
            "Below the point where one machine holds the corpus, where a relational store gives real queries over posts and is far simpler to operate.",
        },
      },
    },
    {
      id: "stories",
      label: "Stories",
      sub: "native 24h row TTL",
      kind: "store",
      x: 440,
      y: 236,
      w: 240,
      detail: {
        what: "A separate collection carrying the same media pipeline output, with a native 24 hour row TTL so expiry is a property of the store rather than a job.",
        why: "Ephemerality has to be enforced by something that cannot be forgotten. A sweeper job over 30M stories/day is one outage away from stories outliving their promise, whereas compaction reclaiming expired rows has no operator in the loop.",
        numbers: ["~30M stories/day", "~45TB/day ephemeral, ~47TB hot", "row TTL 24h, object rule 25h"],
        breaks:
          "TTL drift between the row and the object. The grace hour exists so the row never outlives its bytes, and the canary metric is the fraction of stories still retrievable past their TTL.",
        choice: {
          pick: "Native row TTL plus a matching object lifecycle rule, and Highlights copies the media into a permanent collection",
          instead: "A scheduled sweeper deleting expired stories, with an exemption flag on rows promoted to Highlights.",
          decider:
            "Who owns the deletion. The store's own expiry cannot fall behind or be paused; a sweeper against 30M/day can. Copying on Highlights rather than exempting matters because the two have different access patterns, and an exemption flag on a TTL row is a reliable way to leak storage forever.",
          flips:
            "When expiry needs logic the store cannot express, such as retaining a story that is the subject of an open report, where a job that understands the exception is the only option.",
        },
      },
    },
    {
      id: "fanout",
      label: "Fan-out + timelines",
      sub: "hybrid push/pull, see #8",
      kind: "compute",
      x: 440,
      y: 384,
      w: 240,
      detail: {
        what: "The feed half, assumed rather than derived: push post ids into per-follower timeline caches, pull for high-follower accounts, merge at read.",
        why: "It is here because publishing is not finished until followers can see the post, and it is one box because question 8 owns the push-versus-pull derivation in full. What matters at this scale is that it moves 8-byte ids and never touches a pixel.",
        numbers: ["~500 candidate ids per user, 4KB each", "~2TB of timeline cache, ~4TB replicated"],
        breaks:
          "It must be triggered by post_ready and never by the insert, or followers receive timeline entries pointing at media that does not exist yet.",
        choice: {
          pick: "Hybrid fan-out on write for ordinary accounts, fan-in on read above the threshold",
          instead: "Pure fan-out on read for everyone, recomputing the timeline per request.",
          decider:
            "Read amplification against write burst, and question 8 works the threshold properly. Here the relevant number is that a timeline entry is 8 bytes against a 2.4MB post, so distribution is three orders of magnitude cheaper than delivery and belongs on a completely different system.",
          flips:
            "When the candidate set stops coming from the follow graph. A retrieval model over the whole corpus, as on TikTok, has no per-user timeline to materialise at all.",
        },
      },
    },
    {
      id: "hydrator",
      label: "Feed hydrate + counters",
      sub: "60s card cache, 100 like shards",
      kind: "compute",
      x: 440,
      y: 500,
      w: 240,
      detail: {
        what: "Turns post ids into cards: metadata, the URL set per rung with dimensions, and like counts summed from 100 shard keys.",
        why: "This is the correctness boundary where deletes, blocks and moderation tombstones are enforced against the source of truth, which is what lets timeline caches be treated as disposable derived state.",
        numbers: ["~8.3k likes/s on a viral post, ~83/s per shard", "60s post card TTL", "~1TB of counter state"],
        breaks:
          "Counter drift. The shards are a derived cache and the append-only like log is the source of truth, so an hourly reconciliation writes an audit-trailed adjustment and the log always wins.",
        choice: {
          pick: "Sharded Redis counters, 100 keys per post, reconciled against an append-only like-event log",
          instead: "A single counter row per post incremented in place.",
          decider:
            "5M likes in 10 minutes is ~8.3k writes/s against one row, which single-row throughput in a wide-column store cannot sustain. Split across 100 shards each takes ~83 writes/s, and the price is summing 100 keys on read, amortised behind the 60s card cache.",
          flips:
            "Median posts, which take tens of likes over their entire lifetime. Sharding exists purely for the tail, and exact counts for advertiser dashboards read the event log directly rather than the counters.",
        },
      },
    },
    {
      id: "client-feed",
      label: "Client · feed",
      sub: "picks the rung by viewport",
      kind: "external",
      x: 40,
      y: 660,
      w: 280,
      detail: {
        what: "The viewing app. It receives JSON containing URLs and dimensions, then fetches the rung that suits its screen and its connection.",
        why: "Putting selection on the client is what turns a bandwidth problem into an addressing problem. A feed render stays at a few kilobytes of JSON while the bytes arrive from an edge cache in the viewer's city.",
        numbers: ["~20 posts per render", "starts at small, upgrades to medium on zoom or a 2s dwell", "~115k feed loads/s steady, ~600k peak"],
        breaks:
          "Serving full resolution to a phone on a slow cellular link burns a data cap and stalls the render, which hits exactly the users on the worst networks hardest.",
        choice: {
          pick: "Ship every rung URL with dimensions and let the client choose, with AVIF and WebP served on the Accept header",
          instead: "Have the server or an image CDN negotiate the variant from device and network headers.",
          decider:
            "Only the client knows its viewport, pixel density and current connection quality, and none of that is reliably in a header. AVIF and WebP cut 30 to 50% of bytes at equal quality. The cost is cache footprint: 12 objects per post rather than one, a deliberate trade for delivered bytes.",
          flips:
            "When the surface is server-rendered and the client cannot choose, or when cache entries are the binding constraint and collapsing the menu is worth the extra bytes on the wire.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client-upload",
      to: "api",
      label: "ask for a pre-signed URL",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A metadata request returning a post_id and a scoped, time-limited PUT URL of a few hundred bytes.",
        why: "It is the only call the uploading client makes to the application tier. Everything after it is between the phone and object storage, which is what decouples API fleet size from media volume.",
        numbers: ["a few hundred bytes of response", "15 minute expiry"],
        breaks:
          "Handing back a URL without a content-length bound or a key scope makes it a durable capability that writes anywhere in the bucket and can be shared.",
      },
    },
    {
      id: "e2",
      from: "api",
      to: "posts-db",
      label: "row, status=processing",
      dashed: true,
      detail: {
        what: "The post row written before a single byte has been uploaded, holding the minted post_id and a processing status.",
        why: "The id has to exist first because it is the key everything downstream is idempotent on: the object key, the variant keys and the status transition all derive from it.",
        numbers: ["~1KB row"],
        breaks:
          "A row whose upload never completes is a tombstone that a retry resumes from, and if it is not, the client mints a second post_id and orphans the first upload's objects.",
      },
    },
    {
      id: "e3",
      from: "client-upload",
      to: "raw-store",
      label: "pre-signed PUT, ~2MB",
      animated: true,
      detail: {
        what: "The phone uploading the original file straight to object storage, never through an application server.",
        why: "At 1.2k posts/s this is 2.4GB/s of traffic that would otherwise cross a fleet provisioned for CPU-bound request handling, while a slow mobile client holds a request thread open for tens of seconds.",
        numbers: ["2.4GB/s avoided at the API tier", "200TB/day of originals"],
        breaks:
          "The signature is the only control on this hop, so it has to bind one key, one method and a maximum size, or the bucket takes writes you never sized for.",
      },
    },
    {
      id: "e4",
      from: "raw-store",
      to: "queue",
      label: "ObjectCreated event",
      detail: {
        what: "The storage-side notification that a raw upload has landed, carrying the object key.",
        why: "It is what makes the pipeline event-driven rather than polled. The API never learns that the upload finished, so nothing on the metadata path has to wait on a mobile network.",
        breaks:
          "Delivery is at-least-once, so a duplicate event has to be harmless, which is why variant keys are deterministic and the status flip is a compare-and-set.",
      },
    },
    {
      id: "e5",
      from: "queue",
      to: "workers",
      label: "one message per upload",
      animated: true,
      detail: {
        what: "A worker leasing a transcode job off the queue.",
        why: "The depth of this hop is the scaling signal for the whole pipeline, because per-host CPU on a saturated pool looks healthy while the backlog grows.",
        numbers: ["autoscale adds capacity within 30s", "priority lane for established creators"],
        breaks:
          "Under a global upload spike the queue grows faster than the pool drains it, and the fix that users actually feel is the synchronous thumbnail, not the extra capacity.",
      },
    },
    {
      id: "e6",
      from: "workers",
      to: "raw-store",
      label: "fetch source bytes",
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "The worker pulling the original out of storage to decode it once before encoding every rung.",
        why: "Decoding a 12MP source is the expensive half of the job, so it happens once and all four rungs are encoded from the decoded buffer in parallel.",
        numbers: ["~2 CPU-s per post total"],
        breaks:
          "A source format the decoder does not handle, typically a new phone's codec, fails every attempt, which is why the failure metric needs a breakdown by source format.",
      },
    },
    {
      id: "e7",
      from: "workers",
      to: "variant-store",
      label: "deterministic variant keys",
      animated: true,
      detail: {
        what: "The four rungs written back at {post_id}/{rung}.{codec}, in AVIF and WebP with a JPEG fallback.",
        why: "Deterministic keys turn an at-least-once redelivery into an overwrite of identical bytes rather than a second copy, and per-rung keys let one rung be re-encoded or tiered without disturbing the others.",
        numbers: ["10KB, 80KB, 300KB, ~2MB", "12 objects per post"],
        breaks:
          "A partial ladder is not publishable, so a failed rung requeues on its own rather than restarting the whole post.",
      },
    },
    {
      id: "e8",
      from: "workers",
      to: "posts-db",
      label: "CAS to status=ready",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The compare-and-set that flips the row from processing to ready once every required rung exists.",
        why: "This is the publish gate. It is the only moment the post becomes visible to feeds, grids and search, and making it a CAS is what makes a duplicate worker finish as a no-op.",
        breaks:
          "Persistent failure marks the row processing_failed and notifies the client rather than leaving it stuck, because a row in limbo blocks the retry from resuming at the right state.",
      },
    },
    {
      id: "e9",
      from: "variant-store",
      to: "cdn",
      label: "origin fill on miss",
      detail: {
        what: "The origin fetch a regional cache makes when it does not hold the requested rung, plus the pre-warm push for posts the ranker scores as rising.",
        why: "Only 5% of requests get this far, and that number is the entire economics of the read path. Pre-warming small and medium to regional caches is what stops the first viewer in a new city paying a cross-ocean fetch.",
        numbers: ["30k origin fetches/s at peak", "~72Gbps egress", "full resolution is never pre-warmed"],
        breaks:
          "The rising signal is lagging by construction, so the first few thousand viewers of any viral post still pay origin latency no matter how good the pre-warm is.",
      },
    },
    {
      id: "e10",
      from: "cdn",
      to: "client-feed",
      label: "chosen rung, ~300KB",
      animated: true,
      detail: {
        what: "The actual image bytes, served from an edge in the viewer's city against an immutable one-year-max-age URL.",
        why: "This is the hop the system spends its money on and the one it optimised everything else for. The marginal viewer costs a cache hit, so a post with ten million views costs no more per view than one with ten.",
        numbers: ["~30ms from a warm edge", "300 to 800ms on a cross-ocean origin miss"],
        breaks:
          "Because the URL is immutable and unguessable rather than authorised, a deleted post's bytes stay fetchable here until the purge reaches every POP, which takes minutes to hours.",
      },
    },
    {
      id: "e11",
      from: "posts-db",
      to: "fanout",
      label: "post_ready, not insert",
      detail: {
        what: "The event that triggers distribution, fired on the status transition rather than on the row insert.",
        why: "Firing on insert means followers get timeline entries for a post whose bytes do not exist yet, and every one of them renders a 404. The status transition is the only point at which the post is genuinely servable.",
        breaks:
          "It puts publish latency on the critical path of the transcode pipeline, so a pipeline backlog is also a distribution delay for everyone downstream.",
      },
    },
    {
      id: "e12",
      from: "fanout",
      to: "hydrator",
      label: "500 candidate post ids",
      detail: {
        what: "The merged candidate set of 8-byte post ids handed to hydration and ranking.",
        why: "Ids rather than bodies all the way through the metadata path is why a timeline is 4KB per user and why a delete is one write rather than a rewrite of a hundred million cached lists.",
        numbers: ["~500 ids at 8B each", "~2TB of timeline cache"],
        breaks:
          "Ids can outlive what they point at, so hydration has to enforce deletes, blocks and moderation state rather than trusting the cache.",
      },
    },
    {
      id: "e13",
      from: "hydrator",
      to: "posts-db",
      label: "hydrated card, 60s TTL",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 80,
      detail: {
        what: "Batch reads of post rows to build the cards, cached assembled for 60 seconds at the API tier.",
        why: "A celebrity post would otherwise pull millions of reads onto a single row while every feed service hydrates it independently. The card cache collapses that to one read per miss.",
        numbers: ["60s TTL", "read replicas widen the fan-out further"],
        breaks:
          "If metadata slows down, media URLs become unavailable even though the bytes are hot on the CDN, which is the one way the two paths can still take each other down.",
      },
    },
    {
      id: "e14",
      from: "hydrator",
      to: "client-feed",
      label: "URLs + dimensions, ~4KB",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The feed response: JSON carrying every rung's URL plus dimensions and counts, and no image data at all.",
        why: "Twenty posts at 300KB inlined is a 6MB response that cannot be cached per post, cannot be range-requested, cannot be progressively rendered, and puts 72Gbps of media through a fleet sized for JSON.",
        numbers: ["~20 posts per page", "base64 inflates bytes by 33%"],
        breaks:
          "The client now needs the dimensions to reserve layout space, or the feed reflows as each image lands. A 2KB blurhash placeholder is the one inline exception worth making.",
      },
    },
    {
      id: "e15",
      from: "api",
      to: "stories",
      label: "story rows, 24h TTL",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 60,
      detail: {
        what: "A story written into its own collection rather than the posts table, carrying a native 24 hour row TTL.",
        why: "Stories run the same media pipeline but have a completely different lifecycle, and separating the collection is what lets the store's own expiry do the work instead of a job that has to be operated.",
        numbers: ["~30M stories/day"],
        breaks:
          "Promoting a story to Highlights has to copy the media into a permanent collection, because exempting a row from its TTL leaks storage indefinitely.",
      },
    },
    {
      id: "e16",
      from: "stories",
      to: "variant-store",
      label: "25h object lifecycle",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The pairing between the 24 hour row TTL and the object store lifecycle rule that deletes the story's media at 25 hours.",
        why: "The hour of grace is deliberate: the row must never outlive its bytes, because a story row pointing at deleted media is a broken render while an orphaned object is merely a cost.",
        numbers: ["row 24h, object 25h", "~47TB hot footprint"],
        breaks:
          "The two expiries are configured in different systems, so drift between them is invisible until a canary measures stories still retrievable past their TTL.",
      },
    },
  ],
};
