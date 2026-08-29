import type { Diagram } from "./types";

export const INSTAGRAM: Diagram = {
  id: "instagram",
  title: "Instagram",
  question: "Design Instagram",
  sourceId: "patterns",
  itemId: 27,
  overview: {
    shape:
      "Two paths meet at a URL and nowhere else: pixels move through a pre-signed PUT and a CDN, while metadata moves through the post row, fan-out and the feed.",
    forces: [
      {
        constraint: "1.2k posts/s at ~2MB each is 2.4GB/s of pass-through traffic if proxied through the API",
        decision: "The client PUTs straight to Object store · raw via a pre-signed URL the Upload API only signs",
        lights: ["client-upload", "api", "raw-store", "e1", "e3"],
      },
      {
        constraint: "On-demand transcoding at 600k peak feed loads and a 95% hit ratio is ~4,500 cores between a user and an image",
        decision: "Transcode workers pre-encode a fixed four-rung ladder asynchronously, at ~2,300 cores in a background queue",
        lights: ["workers", "queue"],
      },
      {
        constraint: "A ~5-second transcode pipeline means the post row exists before its bytes are servable",
        decision: "Post metadata gates every surface on status=ready, and Fan-out fires on post_ready, never on insert",
        lights: ["posts-db", "fanout", "e8", "e11"],
      },
      {
        constraint: "A one-year max-age URL is what gets the CDN over a >95% hit ratio at 30k origin fetches/s",
        decision: "Content-addressed immutable URLs are the design, even though a delete purge is only best effort",
        lights: ["cdn", "e9", "e10"],
      },
      {
        constraint: "30M ephemeral stories/day need a 24-hour lifecycle a background sweeper could silently fail to enforce",
        decision: "Stories carries a native row TTL plus a matching object lifecycle rule, so expiry is a store property",
        lights: ["stories", "e15", "e16"],
      },
    ],
    naive: {
      text: "Store one high-quality master image per post and derive whatever size a request asks for on the fly, from an image-resizing service sitting in front of the cache. At a 95% CDN hit ratio and 600k peak feed loads a second, the 5% miss is still 30,000 on-demand resize operations a second. Each costs roughly 150ms, about 4,500 cores permanently sitting between a user and an image they are waiting to see. Transcode workers instead pre-encode a fixed four-rung ladder once, asynchronously, right after upload. The on-demand path never runs at all, and a 95% hit just means a CDN fetch of bytes that already exist.",
      lights: ["workers", "cdn"],
    },
    beats: [
      {
        text: "Upload bypasses the application tier entirely. The client asks the API for a pre-signed PUT, the API mints a post_id and writes a row with status=processing, and the phone uploads straight to object storage. At 1.2k posts/s and 2MB each, proxying instead would push 2.4GB/s of pass-through traffic across a fleet sized for JSON request handling.",
        lights: ["client-upload", "api", "raw-store", "posts-db", "e1", "e2", "e3"],
      },
      {
        text: "The landed object raises an event onto a durable queue and a worker pool consumes it, decoding the source once (HEIC, JPEG, PNG). It then encodes a fixed four-rung ladder in parallel: 100px, 480px, 1080px and a re-encoded full size. Each rung ships in AVIF and WebP with a JPEG fallback.",
        lights: ["queue", "workers", "variant-store", "e4", "e5", "e7"],
      },
      {
        text: "Pre-encoding at upload rather than resizing on request is the central efficiency decision, and the total is not what settles it. Pre-encoding is ~2 CPU-seconds per post, about 2,300 cores continuous, spent in a background queue where a 5 second p95 is invisible. On-demand at a 95% hit ratio and 600k peak feed loads is ~4,500 cores sitting between a user and an image.",
        lights: ["workers"],
      },
      {
        text: "Async generation forces the rest of the design. The post row exists before its bytes are servable, so status is load-bearing. The post is hidden from every feed, grid and search result until it flips to ready. Fan-out fires on post_ready rather than on insert, and the author gets a synchronously generated thumbnail so a creator never thinks the upload failed.",
        lights: ["posts-db", "workers", "fanout", "e8", "e11"],
      },
      {
        text: "On read the feed response is a few kilobytes of JSON carrying CDN URLs and dimensions, never image data. The client picks the rung that fits its viewport and its network. Fan-out itself is a news feed distribution question in its own right; here it is one component that moves 8-byte post ids and never sees a pixel.",
        lights: ["fanout", "hydrator", "client-feed", "e12", "e14"],
      },
      {
        text: "Delivery is a cache hit in the viewer's city. URLs are content-addressed per rung and immutable with a one year max-age, which is what makes a >95% hit ratio reachable and holds origin egress to ~72Gbps. It is also the direct cause of the deletion problem: an edge purge across hundreds of POPs is best effort by construction.",
        lights: ["cdn", "e9", "e10"],
      },
    ],
    crux: {
      problem:
        "Immutability is what buys the hit ratio and it is what makes deletion impossible to do properly. A one year max-age on an unguessable path is the reason 95% of 600k feed loads per second never reach origin. It is also the reason a deleted post's bytes remain fetchable from an edge for minutes to hours by anyone holding the URL.",
      handled:
        "Every clean fix breaks the thing that pays for the system. Short TTLs destroy the hit ratio. Per-viewer signatures destroy shared cacheability. An edge tombstone check makes media availability depend on metadata availability, the exact coupling the two-path split exists to avoid. The design accepts a best-effort purge rather than pay any of those costs.",
    },
    numbers: [
      {
        value: "100M posts/day, ~1.2k/s steady, 2MB avg original",
        explain: "The baseline upload volume and size the whole write path is provisioned against.",
      },
      {
        value: "ladder 10KB / 80KB / 300KB / 2MB = ~2.4MB per post",
        explain: "The four pre-encoded rungs and their combined size, the actual storage cost of making on-demand resizing unnecessary.",
      },
      {
        value: "440TB/day of media, ~40PB hot per quarter",
        explain: "The total daily media volume and the working set kept in fast storage, the two numbers capacity planning is built from.",
      },
      {
        value: ">95% CDN hit ratio, 30k origin fetches/s, ~72Gbps",
        explain: "The delivery economics the whole design optimises for: almost every view is a cache hit, and origin only ever sees the remainder.",
      },
    ],
  },
  nodes: [
    {
      id: "client-upload",
      label: "Client · upload",
      sub: "4MB HEIC from the camera roll",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The posting phone. It asks for an upload URL, then PUTs the file itself, and shows an 'uploading' state until the variants exist.",
        why: "The client is the only party holding the original bytes, and it is sitting on the worst network in the system. Making it talk to object storage directly means a slow mobile upload holds a storage connection open rather than an application thread that also runs auth and database calls. It also retries aggressively on flaky mobile networks.",
        numbers: [{ value: "~2MB average post", explain: "The typical upload size, the number the whole pipeline's throughput math is built from." }],
        breaks: {
          failure: "Client retries are guaranteed.",
          handled: "Every stage downstream has to be idempotent on the post_id the API minted, or one upload becomes two posts.",
        },
      },
    },
    {
      id: "api",
      label: "Upload API",
      sub: "mints post_id, signs the PUT",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The metadata tier. It mints a post_id, writes the row as processing, signs a scoped PUT URL and returns a few hundred bytes.",
        why: "This fleet exists to handle rows, not files. Keeping it off the byte path is what lets the same fleet size serve photos and video, because its throughput stops being a function of media volume entirely.",
        numbers: [
          { value: "response is a few hundred bytes", explain: "Constant regardless of the ~2MB upload behind it — why this fleet's throughput never scales with media volume, unlike the 2.4GB/s it would carry if it proxied files." },
          { value: "15 minute signature expiry", explain: "How long the signed URL stays valid, chosen to cover a bad network rather than a fast one." },
        ],
        breaks: {
          failure: "A loose signature turns the endpoint into an upload oracle.",
          handled: "Without a content-length bound a client PUTs a 5GB file against a URL you handed out, which is an unmetered write and a decode bomb for the worker.",
        },
        choice: {
          pick: "Pre-signed PUT scoped to one key, one method, a max content length and a 15 minute expiry",
          instead: "Proxy the upload through the API tier and stream it to storage.",
          decider:
            "Pass-through bandwidth against fleet shape. 1.2k posts/s at 2MB is 2.4GB/s crossing servers provisioned for CPU-bound request handling, and a slow client holds a request thread for tens of seconds. 15 minutes rather than 60 seconds, because the expiry has to cover a bad network, and the client re-requests rather than resuming.",
          flips: "Small files where the proxy cost is trivial, or when every byte must be inspected in-line before it lands. A pre-signed PUT cannot do that, because the signature bounds the size and says nothing about the content.",
        },
      },
    },
    {
      id: "raw-store",
      label: "Object store · raw",
      sub: "originals, archive tier at 30d",
      kind: "database",
      col: 0,
      row: 1,
      detail: {
        what: "Where the pre-signed PUT lands. Holds every uploaded original and is the only source a re-encode is ever run from.",
        why: "The codec cycle turns over roughly every five years, JPEG through WebP through AVIF, and every turn is a full re-encode of the corpus. Re-encoding from an already lossy derivative compounds generational loss, visibly by the second hop, so the original is kept even though most are never read again.",
        numbers: [
          { value: "200TB/day of originals", explain: "The daily ingest volume this store absorbs before any transcoding happens." },
          { value: "73PB/year, ~$73k/month at archive prices", explain: "The annual retention cost of keeping every original forever, small against the platform's overall infrastructure spend." },
        ],
        breaks: {
          failure: "Orphaned objects: an upload whose row was never completed is referenced by nothing.",
          handled: "It is reclaimed by no lifecycle rule, which is the most common way this pipeline leaks storage. A periodic reconciliation against the metadata store is what catches it.",
        },
        choice: {
          pick: "Keep the original forever, tier to archive at 30 days, keep the 1080px rung warm as a fast fallback master",
          instead: "Delete the original once the ladder exists and promote the full-resolution derivative to master.",
          decider:
            "73PB/year of retained originals is about $73k/month at roughly $1/TB/month, which is predictable and small against the platform. The quality loss from re-encoding a derivative is permanent and unrecoverable, and it lands on every future codec migration.",
          flips: "When the original is enormous relative to what is served. A 5MB short video serving a 500KB rendition is a 10x ratio, and at that ratio the archive bill is the dominant line item rather than a rounding error.",
        },
      },
    },
    {
      id: "queue",
      label: "ObjectCreated queue",
      sub: "durable, at-least-once",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "The notification the object store raises when a raw upload lands, consumed by the transcode pool.",
        why: "It is the buffer that lets upload rate and transcode capacity be different numbers. A global event driving 10x the normal upload rate does not fail uploads, it grows a queue, and the queue depth is the signal that scales the pool.",
        numbers: [
          { value: "scale-up policy adds capacity within 30s", explain: "How fast the worker pool responds to a growing backlog." },
          { value: "~6k posts/s at a spike", explain: "The peak arrival rate this queue has to absorb before workers can catch up." },
        ],
        breaks: {
          failure: "Depth is the alerting signal, not worker CPU.",
          handled: "A saturated pool looks perfectly healthy per host while users watch 'uploading' for minutes and abandon, which is why depth, not CPU, is what pages.",
        },
        choice: {
          pick: "A durable queue between the storage event and the workers, with the pool autoscaling on depth",
          instead: "Invoke the transcoder synchronously from the storage event notification.",
          decider:
            "Burst absorption. A 10x upload spike against a pool that adds capacity in 30s needs somewhere to put the backlog. At-least-once redelivery is what makes a worker crash a retry rather than a lost post, at the price that every stage must be idempotent on post_id.",
          flips: "Low and predictable volume where a direct invocation is one less system to operate, and a dropped event can simply be re-driven by hand.",
        },
      },
    },
    {
      id: "workers",
      label: "Transcode workers",
      sub: "4 rungs, AVIF/WebP/JPEG",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "The autoscaling pool that decodes the source once and encodes the fixed ladder in parallel, then flips the post row to ready.",
        why: "This is where the whole design spends its compute, and it spends it off the read path deliberately. Perceptual hashing against known-bad fingerprints runs here too at ~20ms, and the ML classifier at ~200ms, both cheap against a 5 second pipeline.",
        numbers: [
          { value: "~2 CPU-s/post, ~2,300 cores continuous", explain: "The steady-state compute cost of pre-encoding every post's ladder." },
          { value: "~12k cores at the peak hour", explain: "The provisioned peak, well above the steady-state average to absorb upload bursts." },
          { value: "~5s p95 upload to ready", explain: "The latency budget this whole background pipeline is held to, invisible to a waiting user." },
        ],
        breaks: {
          failure: "A rung that fails requeues the rung and not the post.",
          handled: "Re-decoding a 12MP source to redo one 10KB thumbnail wastes the expensive half. Persistent failure needs a breakdown by source format, or a new phone's codec looks like a generic outage.",
        },
        choice: {
          pick: "Pre-encode a fixed four-rung ladder asynchronously at upload, before the post is publishable",
          instead: "Store one high-quality master and derive any requested size lazily at an image service in front of the cache.",
          decider:
            "Where the compute lands relative to the latency-critical path. Pre-encoding is ~2,300 cores in a queue where 5 seconds is invisible. On-demand at a 95% hit ratio and 600k peak feed loads is 30k derivations/s, ~4,500 cores even at 150ms each, every one of them between a user and an image.",
          flips: "When the variant space is combinatorially large rather than a fixed menu. Arbitrary crops, per-surface aspect ratios and four pixel densities take the ladder from 4 rungs to 40, and pre-encoding from 2.4MB to ~24MB per post, which is 2.4PB/day.",
        },
      },
    },
    {
      id: "variant-store",
      label: "Variant store",
      sub: "deterministic keys, per-rung tiers",
      kind: "database",
      col: 3,
      row: 1,
      detail: {
        what: "The derivative set, written at deterministic keys of the form {post_id}/{rung}.{codec} so a duplicate delivery overwrites identical bytes.",
        why: "Keying per rung rather than per post is what lets a rung move storage tier or be re-encoded without invalidating its siblings. Thumbnail and small stay hot forever because profile grids read them forever; medium tiers to warm at 90 days and full resolution to archive at 30.",
        numbers: [
          { value: "~2.4MB of derivatives per post", explain: "10KB + 80KB + 300KB + ~2MB summed across the ladder — roughly the size of the original alone, for four rungs across three codecs each." },
          { value: "240TB/day of variants", explain: "The daily write volume this store absorbs from the transcode pipeline." },
          { value: "12 objects per post: 4 rungs x 3 codecs", explain: "The object count per post, which is why per-rung keys matter for tiering independently." },
        ],
        breaks: {
          failure: "Cold-tier revival has no predictor.",
          handled: "Archive first-byte latency is seconds to minutes, fine for a deliberate download and wrong when a years-old photo resurfaces because something external linked it.",
        },
        choice: {
          pick: "One object per rung per codec at a deterministic key, tiered by rung and age",
          instead: "One packed object per post, or tiering the whole derivative set by age alone.",
          decider:
            "Independent lifecycles. Full resolution is 85% of the bytes and rarely viewed, while thumbnails are read forever. A single tiering rule either keeps 160PB/year hot or makes grid scroll wait on archive. Per-rung keys also make an at-least-once redelivery a harmless overwrite instead of a second post.",
          flips: "When every rung is fetched together, where one packed object is one request and one cache entry rather than twelve.",
        },
      },
    },
    {
      id: "cdn",
      label: "Multi-tier CDN",
      sub: "edge, regional, then origin",
      kind: "database",
      col: 3,
      row: 2,
      detail: {
        what: "City-level edges backstopped by regional nodes, with the variant store as origin of last resort. Rising posts get their small and medium rungs pre-warmed to regional caches.",
        why: "The marginal viewer has to be free, otherwise a post with ten million viewers costs ten million times a post with ten. Immutable per-rung URLs with a one year max-age are what make that true, because there is nothing to revalidate.",
        numbers: [
          { value: ">95% hit ratio, 30k origin fetches/s", explain: "The delivery economics at the top of the funnel: the fraction of requests the edge answers alone." },
          { value: "~9GB/s, ~72Gbps origin egress", explain: "The residual bandwidth cost the origin actually carries after edge caching absorbs the rest." },
          { value: "a fall to 80% takes egress to ~290Gbps", explain: "How steeply origin cost rises if the hit ratio ever degrades, the reason immutability is non-negotiable." },
        ],
        breaks: {
          failure: "Purge is best effort.",
          handled: "After a delete or a moderation removal, anyone holding the direct URL can still fetch the bytes until the entry ages out. A POP offline during the purge serves stale content when it returns.",
        },
        choice: {
          pick: "Content-addressed immutable public URLs on an unguessable path, signed short-lived URLs only for private accounts and DMs",
          instead: "Sign every media URL against the requesting user so each fetch is individually authorised and auditable.",
          decider:
            "Cache key cardinality sets the hit ratio, which sets origin egress. A per-viewer signature makes every URL unique and degrades the shared cache toward one entry per viewer. 95% to 80% takes egress from ~72Gbps to ~290Gbps, a 4x infrastructure step for identical traffic.",
          flips: "Predominantly private content, or regulation demanding per-access authorisation with an audit record. The middle path is edge compute validating a token carried outside the cache key, costing an invocation on the hottest path in the system.",
        },
      },
    },
    {
      id: "posts-db",
      label: "Post metadata",
      sub: "wide-column, partition by user",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "The post row: caption, location, hashtags, the media URL set per rung, and the status field that gates visibility.",
        why: "Status is load-bearing because publishing is asynchronous. The row exists before the bytes are servable, so every surface filters on ready. The transition from processing to ready is a compare-and-set, so the second worker to finish is a no-op.",
        numbers: [
          { value: "~1KB per row", explain: "100M rows/day × ~1KB ≈ the 100GB/day this store actually writes — bytes never land here at all, since 440TB/day of media goes straight to object storage." },
          { value: "100GB/day, ~300GB/day at RF=3", explain: "The daily write footprint of this store across the whole platform." },
        ],
        breaks: {
          failure: "A hot post pulls millions of hydrate reads onto one row.",
          handled: "That is why the assembled post card is cached for 60s at the API tier rather than read through on every request.",
        },
        choice: {
          pick: "A wide-column store partitioned by user_id",
          instead: "A relational store with the media bytes in a blob column.",
          decider:
            "Write volume and access shape. 100M rows/day at ~1KB with reads that are single-partition profile scans and point lookups is exactly the wide-column case, and pre-sharding by user lets a hot partition split independently. Bytes never go here at all: 440TB/day belongs in object storage.",
          flips: "Below the point where one machine holds the corpus, where a relational store gives real queries over posts and is far simpler to operate.",
        },
      },
    },
    {
      id: "stories",
      label: "Stories",
      sub: "native 24h row TTL",
      kind: "database",
      col: 3,
      row: 0,
      detail: {
        what: "A separate collection carrying the same media pipeline output, with a native 24 hour row TTL so expiry is a property of the store rather than a job.",
        why: "Ephemerality has to be enforced by something that cannot be forgotten. A sweeper job over 30M stories/day is one outage away from stories outliving their promise, whereas compaction reclaiming expired rows has no operator in the loop.",
        numbers: [
          { value: "~30M stories/day", explain: "The daily volume this collection ingests, on top of the main post pipeline." },
          { value: "~45TB/day ephemeral, ~47TB hot", explain: "The daily ingest and the resulting steady-state hot footprint, since content expires almost as fast as it arrives." },
          { value: "row TTL 24h, object rule 25h", explain: "The two expiries this design keeps deliberately offset, so the row never outlives its bytes." },
        ],
        breaks: {
          failure: "TTL drift between the row and the object.",
          handled: "The grace hour exists so the row never outlives its bytes, and the canary metric is the fraction of stories still retrievable past their TTL.",
        },
        choice: {
          pick: "Native row TTL plus a matching object lifecycle rule, and Highlights copies the media into a permanent collection",
          instead: "A scheduled sweeper deleting expired stories, with an exemption flag on rows promoted to Highlights.",
          decider:
            "Who owns the deletion. The store's own expiry cannot fall behind or be paused; a sweeper against 30M/day can. Copying on Highlights rather than exempting matters because the two have different access patterns, and an exemption flag on a TTL row is a reliable way to leak storage forever.",
          flips: "When expiry needs logic the store cannot express, such as retaining a story that is the subject of an open report. There a job that understands the exception is the only option.",
        },
      },
    },
    {
      id: "fanout",
      label: "Fan-out + timelines",
      sub: "hybrid push/pull",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "The feed half, assumed rather than derived: push post ids into per-follower timeline caches, pull for high-follower accounts, merge at read.",
        why: "It is here because publishing is not finished until followers can see the post. It is one box because the push-versus-pull threshold is a feed-distribution question in its own right, orthogonal to media. What matters at this scale is that it moves 8-byte ids and never touches a pixel.",
        numbers: [
          { value: "~500 candidate ids per user, 4KB each", explain: "The candidate-set size one fan-out pass produces for a single reader." },
          { value: "~2TB of timeline cache, ~4TB replicated", explain: "500 ids × 8B ≈ 4KB per user — three orders of magnitude cheaper than the 2.4MB post it points at, why distribution runs on a separate system from delivery." },
        ],
        breaks: {
          failure: "It must be triggered by post_ready and never by the insert.",
          handled: "Otherwise followers receive timeline entries pointing at media that does not exist yet, which is why the trigger is the status transition, not the write.",
        },
        choice: {
          pick: "Hybrid fan-out on write for ordinary accounts, fan-in on read above the threshold",
          instead: "Pure fan-out on read for everyone, recomputing the timeline per request.",
          decider:
            "Read amplification against write burst, weighed at the account's follower count where the two costs cross. A timeline entry is 8 bytes against a 2.4MB post, so distribution is three orders of magnitude cheaper than delivery and belongs on a completely different system.",
          flips: "When the candidate set stops coming from the follow graph. A retrieval model over the whole corpus, as on TikTok, has no per-user timeline to materialise at all.",
        },
      },
    },
    {
      id: "hydrator",
      label: "Feed hydrate + counters",
      sub: "60s card cache, 100 like shards",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "Turns post ids into cards: metadata, the URL set per rung with dimensions, and like counts summed from 100 shard keys.",
        why: "This is the correctness boundary where deletes, blocks and moderation tombstones are enforced against the source of truth, which is what lets timeline caches be treated as disposable derived state.",
        numbers: [
          { value: "~8.3k likes/s on a viral post, ~83/s per shard", explain: "The peak like rate a single post can generate, and how sharding spreads it." },
          { value: "60s post card TTL", explain: "How long an assembled card is cached, amortising the cost of hydrating a hot post." },
          { value: "~1TB of counter state", explain: "The total storage this counter system holds across every post." },
        ],
        breaks: {
          failure: "Counter drift.",
          handled: "The shards are a derived cache and the append-only like log is the source of truth, so an hourly reconciliation writes an audit-trailed adjustment and the log always wins.",
        },
        choice: {
          pick: "Sharded Redis counters, 100 keys per post, reconciled against an append-only like-event log",
          instead: "A single counter row per post incremented in place.",
          decider:
            "5M likes in 10 minutes is ~8.3k writes/s against one row, which single-row throughput in a wide-column store cannot sustain. Split across 100 shards each takes ~83 writes/s, and the price is summing 100 keys on read, amortised behind the 60s card cache.",
          flips: "Median posts, which take tens of likes over their entire lifetime. Sharding exists purely for the tail, and exact counts for advertiser dashboards read the event log directly rather than the counters.",
        },
      },
    },
    {
      id: "client-feed",
      label: "Client · feed",
      sub: "picks the rung by viewport",
      kind: "external",
      col: 2,
      row: 3,
      detail: {
        what: "The viewing app. It receives JSON containing URLs and dimensions, then fetches the rung that suits its screen and its connection.",
        why: "Putting selection on the client is what turns a bandwidth problem into an addressing problem. A feed render stays at a few kilobytes of JSON while the bytes arrive from an edge cache in the viewer's city.",
        numbers: [
          { value: "~20 posts per render", explain: "The typical feed page size the client requests." },
          { value: "starts at small, upgrades to medium on zoom or a 2s dwell", explain: "The progressive-loading rule the client applies before requesting a larger rung." },
          { value: "~115k feed loads/s steady, ~600k peak", explain: "The read-side scale the whole delivery path is sized against." },
        ],
        breaks: {
          failure: "Serving full resolution to a phone on a slow cellular link burns a data cap and stalls the render.",
          handled: "That hits exactly the users on the worst networks hardest, which is why the client starts small and upgrades only on explicit signals like zoom or dwell time.",
        },
        choice: {
          pick: "Ship every rung URL with dimensions and let the client choose, with AVIF and WebP served on the Accept header",
          instead: "Have the server or an image CDN negotiate the variant from device and network headers.",
          decider:
            "Only the client knows its viewport, pixel density and current connection quality, and none of that is reliably in a header. AVIF and WebP cut 30 to 50% of bytes at equal quality. The cost is cache footprint: 12 objects per post rather than one, a deliberate trade for delivered bytes.",
          flips: "When the surface is server-rendered and the client cannot choose, or when cache entries are the binding constraint and collapsing the menu is worth the extra bytes on the wire.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client-upload",
      to: "api",
      tier: "control",
      label: "ask for a pre-signed URL",
      detail: {
        what: "A metadata request returning a post_id and a scoped, time-limited PUT URL of a few hundred bytes.",
        why: "It is the only call the uploading client makes to the application tier. Everything after it is between the phone and object storage, which is what decouples API fleet size from media volume.",
        numbers: [
          { value: "a few hundred bytes of response", explain: "Fixed regardless of upload size — this is what decouples API fleet capacity from media volume, since everything after this response bypasses the app tier." },
          { value: "15 minute expiry", explain: "The validity window of the returned URL." },
        ],
        breaks: {
          failure: "Handing back a URL without a content-length bound or a key scope makes it a durable capability.",
          handled: "That capability writes anywhere in the bucket and can be shared, which is why the signature always binds a key, method and size limit.",
        },
      },
    },
    {
      id: "e2",
      from: "api",
      to: "posts-db",
      tier: "control",
      label: "row, status=processing",
      detail: {
        what: "The post row written before a single byte has been uploaded, holding the minted post_id and a processing status.",
        why: "The id has to exist first because it is the key everything downstream is idempotent on: the object key, the variant keys and the status transition all derive from it.",
        numbers: [{ value: "~1KB row", explain: "Tiny and constant regardless of upload size — cheap enough to write before a single byte arrives, and post_id becomes the key every downstream write derives from." }],
        breaks: {
          failure: "A row whose upload never completes is a tombstone that a retry resumes from.",
          handled: "If it is not resumed, the client mints a second post_id and orphans the first upload's objects, which is why reconciliation exists downstream.",
        },
      },
    },
    {
      id: "e3",
      from: "client-upload",
      to: "raw-store",
      tier: "hot",
      step: 1,
      label: "pre-signed PUT, ~2MB",
      detail: {
        what: "The phone uploading the original file straight to object storage, never through an application server.",
        why: "At 1.2k posts/s this is 2.4GB/s of traffic that would otherwise cross a fleet provisioned for CPU-bound request handling. A slow mobile client also holds a request thread open for tens of seconds if proxied.",
        numbers: [
          { value: "2.4GB/s avoided at the API tier", explain: "The pass-through bandwidth this edge removes from the application fleet entirely." },
          { value: "200TB/day of originals", explain: "The daily volume this edge actually carries into raw storage." },
        ],
        breaks: {
          failure: "The signature is the only control on this hop.",
          handled: "It has to bind one key, one method and a maximum size, or the bucket takes writes you never sized for.",
        },
      },
    },
    {
      id: "e4",
      from: "raw-store",
      to: "queue",
      tier: "data",
      label: "ObjectCreated event",
      detail: {
        what: "The storage-side notification that a raw upload has landed, carrying the object key.",
        why: "It is what makes the pipeline event-driven rather than polled. The API never learns that the upload finished, so nothing on the metadata path has to wait on a mobile network.",
        breaks: {
          failure: "Delivery is at-least-once, so a duplicate event has to be harmless.",
          handled: "That is why variant keys are deterministic and the status flip is a compare-and-set, so a repeat event is a no-op.",
        },
      },
    },
    {
      id: "e5",
      from: "queue",
      to: "workers",
      tier: "hot",
      step: 2,
      label: "one message per upload",
      detail: {
        what: "A worker leasing a transcode job off the queue.",
        why: "The depth of this hop is the scaling signal for the whole pipeline, because per-host CPU on a saturated pool looks healthy while the backlog grows. A priority lane keeps established creators' uploads moving ahead of a cold-start backlog during a spike.",
        numbers: [{ value: "autoscale adds capacity within 30s", explain: "The response time of the pool to a growing queue depth." }],
        breaks: {
          failure: "Under a global upload spike the queue grows faster than the pool drains it.",
          handled: "The fix that users actually feel is the synchronous thumbnail, not the extra capacity, since that is what tells them the upload succeeded.",
        },
      },
    },
    {
      id: "e6",
      from: "workers",
      to: "raw-store",
      tier: "data",
      label: "fetch source bytes",
      offset: 60,
      detail: {
        what: "The worker pulling the original out of storage to decode it once before encoding every rung.",
        why: "Decoding a 12MP source is the expensive half of the job, so it happens once and all four rungs are encoded from the decoded buffer in parallel.",
        numbers: [{ value: "~2 CPU-s per post total", explain: "The full compute cost of decode plus all four encodes, most of it spent on the single decode." }],
        breaks: {
          failure: "A source format the decoder does not handle, typically a new phone's codec, fails every attempt.",
          handled: "That is why the failure metric needs a breakdown by source format, or a codec-specific bug looks like a generic outage.",
        },
      },
    },
    {
      id: "e7",
      from: "workers",
      to: "variant-store",
      tier: "hot",
      step: 3,
      label: "deterministic variant keys",
      detail: {
        what: "The four rungs written back at {post_id}/{rung}.{codec}, in AVIF and WebP with a JPEG fallback.",
        why: "Deterministic keys turn an at-least-once redelivery into an overwrite of identical bytes rather than a second copy. Per-rung keys also let one rung be re-encoded or tiered without disturbing the others.",
        numbers: [
          { value: "10KB, 80KB, 300KB, ~2MB", explain: "Sums to the ~2.4MB per-post derivative total — four sizes written in one pass off a single decode, not four separate expensive re-decodes." },
          { value: "12 objects per post", explain: "The full object count once every rung and codec combination is counted." },
        ],
        breaks: {
          failure: "A partial ladder is not publishable.",
          handled: "A failed rung requeues and retries encoding alone; the failure metric needs a source-format breakdown or a new phone's codec silently looks like a generic outage.",
        },
      },
    },
    {
      id: "e8",
      from: "workers",
      to: "posts-db",
      tier: "control",
      label: "CAS to status=ready",
      detail: {
        what: "The compare-and-set that flips the row from processing to ready once every required rung exists.",
        why: "This is the publish gate. It is the only moment the post becomes visible to feeds, grids and search, and making it a CAS is what makes a duplicate worker finish as a no-op.",
        breaks: {
          failure: "Persistent failure marks the row processing_failed and notifies the client rather than leaving it stuck.",
          handled: "A row in limbo blocks the retry from resuming at the right state, so a terminal failure state is essential.",
        },
      },
    },
    {
      id: "e9",
      from: "variant-store",
      to: "cdn",
      tier: "data",
      label: "origin fill on miss",
      detail: {
        what: "The origin fetch a regional cache makes when it does not hold the requested rung, plus the pre-warm push for posts the ranker scores as rising.",
        why: "Only 5% of requests get this far, and that number is the entire economics of the read path. Pre-warming small and medium to regional caches is what stops the first viewer in a new city paying a cross-ocean fetch. Full resolution is never pre-warmed, since it is 85% of the bytes for the rarest request.",
        numbers: [
          { value: "30k origin fetches/s at peak", explain: "The residual load this edge carries after edge caching absorbs the rest." },
          { value: "~72Gbps egress", explain: "The bandwidth this edge costs at that fetch rate." },
        ],
        breaks: {
          failure: "The rising signal is lagging by construction.",
          handled: "The first few thousand viewers of any viral post still pay origin latency, no matter how good the pre-warm is.",
        },
      },
    },
    {
      id: "e10",
      from: "cdn",
      to: "client-feed",
      tier: "hot",
      step: 5,
      label: "chosen rung, ~300KB",
      detail: {
        what: "The actual image bytes, served from an edge in the viewer's city against an immutable one-year-max-age URL.",
        why: "This is the hop the system spends its money on and the one it optimised everything else for. The marginal viewer costs a cache hit, so a post with ten million views costs no more per view than one with ten.",
        numbers: [
          { value: "~30ms from a warm edge", explain: "The typical latency for this edge on a cache hit." },
          { value: "300 to 800ms on a cross-ocean origin miss", explain: "The far tail latency when the edge misses and origin sits across an ocean." },
        ],
        breaks: {
          failure: "Because the URL is immutable and unguessable rather than authorised, a deleted post's bytes stay fetchable here.",
          handled: "Accepted: closing it means per-viewer authorised URLs instead of immutable ones, which collapses the shared cache and pushes origin egress from ~72Gbps toward ~290Gbps.",
        },
      },
    },
    {
      id: "e11",
      from: "posts-db",
      to: "fanout",
      tier: "data",
      label: "post_ready, not insert",
      detail: {
        what: "The event that triggers distribution, fired on the status transition rather than on the row insert.",
        why: "Firing on insert means followers get timeline entries for a post whose bytes do not exist yet, and every one of them renders a 404. The status transition is the only point at which the post is genuinely servable.",
        breaks: {
          failure: "It puts publish latency on the critical path of the transcode pipeline.",
          handled: "A pipeline backlog is also a distribution delay for everyone downstream, which is the accepted cost of waiting for genuine servability.",
        },
      },
    },
    {
      id: "e12",
      from: "fanout",
      to: "hydrator",
      tier: "data",
      label: "500 candidate post ids",
      detail: {
        what: "The merged candidate set of 8-byte post ids handed to hydration and ranking.",
        why: "Ids rather than bodies all the way through the metadata path is why a timeline is 4KB per user. It is also why a delete is one write, rather than a rewrite of a hundred million cached lists.",
        numbers: [
          { value: "~500 ids at 8B each", explain: "500 × 8B = 4KB per user — the entire reason a timeline entry costs three orders of magnitude less than the 2.4MB post it points at." },
          { value: "~2TB of timeline cache", explain: "The total footprint across every user's candidate list." },
        ],
        breaks: {
          failure: "Ids can outlive what they point at.",
          handled: "Hydration has to enforce deletes, blocks and moderation state, rather than trusting that every id on this edge still resolves.",
        },
      },
    },
    {
      id: "e13",
      from: "hydrator",
      to: "posts-db",
      tier: "control",
      label: "hydrated card, 60s TTL",
      offset: 80,
      detail: {
        what: "Batch reads of post rows to build the cards, cached assembled for 60 seconds at the API tier.",
        why: "A celebrity post would otherwise pull millions of reads onto a single row while every feed service hydrates it independently. The card cache collapses that to one read per miss, and read replicas widen that fan-out further for the reads that do land.",
        numbers: [{ value: "60s TTL", explain: "The cache lifetime that amortises repeated hydration of the same hot post." }],
        breaks: {
          failure: "If metadata slows down, media URLs become unavailable even though the bytes are hot on the CDN.",
          handled: "That is the one way the two paths can still take each other down, which is why this edge's latency is monitored independently of media delivery.",
        },
      },
    },
    {
      id: "e14",
      from: "hydrator",
      to: "client-feed",
      tier: "hot",
      step: 4,
      label: "URLs + dimensions, ~4KB",
      detail: {
        what: "The feed response: JSON carrying every rung's URL plus dimensions and counts, and no image data at all.",
        why: "Twenty posts at 300KB inlined is a 6MB response that cannot be cached per post, range-requested, or progressively rendered. It would also put 72Gbps of media through a fleet sized for JSON.",
        numbers: [
          { value: "~20 posts per page", explain: "The typical page size this response carries." },
          { value: "base64 inflates bytes by 33%", explain: "On top of already shipping raw bytes at all — 20 posts × 300KB inlined is already 6MB before this tax, why only a 2KB blurhash placeholder is ever inlined." },
        ],
        breaks: {
          failure: "The client now needs the dimensions to reserve layout space, or the feed reflows as each image lands.",
          handled: "A 2KB blurhash placeholder is the one inline exception worth making, since it prevents layout shift without shipping real pixels.",
        },
      },
    },
    {
      id: "e15",
      from: "api",
      to: "stories",
      tier: "control",
      label: "story rows, 24h TTL",
      offset: 60,
      detail: {
        what: "A story written into its own collection rather than the posts table, carrying a native 24 hour row TTL.",
        why: "Stories run the same media pipeline but have a completely different lifecycle. Separating the collection is what lets the store's own expiry do the work, instead of a job that has to be operated.",
        numbers: [{ value: "~30M stories/day", explain: "The daily volume flowing across this edge into the ephemeral collection." }],
        breaks: {
          failure: "Promoting a story to Highlights has to copy the media into a permanent collection.",
          handled: "Exempting a row from its TTL instead leaks storage indefinitely, which is why promotion is always a copy, never a flag.",
        },
      },
    },
    {
      id: "e16",
      from: "stories",
      to: "variant-store",
      tier: "control",
      label: "25h object lifecycle",
      detail: {
        what: "The pairing between the 24 hour row TTL and the object store lifecycle rule that deletes the story's media at 25 hours.",
        why: "The hour of grace is deliberate: the row must never outlive its bytes. A story row pointing at deleted media is a broken render, while an orphaned object is merely a cost.",
        numbers: [
          { value: "row 24h, object 25h", explain: "The two lifetimes this edge coordinates, deliberately offset by an hour." },
          { value: "~47TB hot footprint", explain: "The steady-state storage this ephemeral collection holds at any moment." },
        ],
        breaks: {
          failure: "The two expiries are configured in different systems.",
          handled: "Drift between them is invisible until a canary measures stories still retrievable past their TTL, which is why that canary runs continuously.",
        },
      },
    },
  ],
  figures: {
    "retry-cas": {
      title: "Deterministic keys plus a CAS close both failure modes",
      nodes: [
        { id: "worker-a", label: "Worker A: delivery 1", kind: "service", col: 0, row: 0 },
        { id: "worker-b", label: "Worker B: delivery 2", sub: "retry of the same event", kind: "service", col: 1, row: 0 },
        {
          id: "same-key",
          label: "Same key",
          sub: "{post_id}/med.avif",
          kind: "blob",
          col: 0,
          row: 1,
          detail: {
            what: "The deterministic variant object key both deliveries write to, derived from post_id and rung rather than minted fresh.",
            why: "A retried worker overwrites identical bytes at the same key instead of creating an orphaned duplicate nothing in metadata ever references.",
          },
        },
        {
          id: "cas-win",
          label: "CAS wins: ready",
          kind: "database",
          col: 0,
          row: 2,
          detail: {
            what: "The compare-and-swap of the post's status from processing to ready, matched by whichever delivery reaches it first.",
            why: "Keying the transition on the specific prior value, not an unconditional write, is what makes a second delivery a no-op rather than a race.",
          },
        },
        { id: "cas-fail", label: "CAS fails: no-op", kind: "database", col: 1, row: 2 },
      ],
      edges: [
        { id: "e1", from: "worker-a", to: "same-key", tier: "hot", step: 1, label: "writes" },
        { id: "e2", from: "worker-b", to: "same-key", tier: "hot", step: 2, label: "overwrites, harmless" },
        { id: "e3", from: "same-key", to: "cas-win", tier: "hot", step: 3, label: "first CAS" },
        { id: "e4", from: "same-key", to: "cas-fail", tier: "control", label: "second CAS" },
      ],
    },
  },
};
