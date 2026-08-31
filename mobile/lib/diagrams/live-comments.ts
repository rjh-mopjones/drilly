import type { Diagram } from "./types";

export const LIVE_COMMENTS: Diagram = {
  id: "live-comments",
  title: "Live Comments",
  question: "Design Live Comments (Facebook Live, Twitch Chat)",
  sourceId: "patterns",
  itemId: 59,
  overview: {
    shape:
      "Fan-out by construction, not by delivery. A comment is scored once, sampled once per stream into a shared once-a-second frame, and broadcast by edge servers that each hold tens of thousands of connections. Nobody receives every comment; everybody receives a readable chat.",
    forces: [
      {
        constraint: "5,000 comments/s on the head stream, and 1M viewers who can each read ~10/s",
        decision: "The Fan-out sampler chooses ≤15 comments per stream per second, once, and every viewer receives that shared frame",
        lights: ["sampler", "e4", "e5"],
      },
      {
        constraint: "100M concurrent viewers is a connection problem before it is anything else",
        decision: "Edge broadcast servers hold ~50k connections each across ~2,000 nodes and write one batched frame per viewer per second",
        lights: ["edge", "e7"],
      },
      {
        constraint: "Naive per-viewer delivery on the head stream is 5,000 x 1M = 5B messages a second",
        decision: "Delivery cost is decoupled from comment rate: one frame per stream per second reaches ~20 subscribed edges as ~20 RPCs",
        lights: ["sampler", "edge", "e5"],
      },
      {
        constraint: "1.9M of the 2M live streams have under 100 viewers and must cost almost nothing",
        decision: "The Subscription registry maps stream to the edges that actually have its viewers; an unwatched stream is delivered nowhere",
        lights: ["registry", "e6", "e8"],
      },
      {
        constraint: "A comment must appear to its author instantly, and to the room within ~2s",
        decision: "Local echo on the author's screen at post time; the shared frame carries it to everyone else on the next 1-second tick",
        lights: ["viewer", "ingest", "e1"],
      },
    ],
    naive: {
      text: "Give every viewer a message queue and push every comment of their stream into it. The head stream kills it at once: 5,000 comments/s x 1M viewers is 5 billion deliveries a second, and even a hundredth of that melts any queueing tier. Worse, it is effort spent making the product unusable: a screen scrolling 5,000 comments a second is unreadable noise. The Fan-out sampler inverts the problem. Choosing what a human can read, ≤15 comments a second, happens once per stream, and delivery becomes one shared frame per second whatever the comment rate.",
      lights: ["sampler", "edge"],
    },
    beats: [
      {
        text: "A viewer posts a comment to the Comment ingest API and sees it on their own screen immediately: local echo, confirmed when the post is acknowledged. Ingest rate-limits per user, dedups on a client key, and stamps the comment with its stream id and a per-stream sequence number. The author's experience is decoupled from everything downstream; even a viewer whose comment is never sampled sees it in their own chat.",
        lights: ["viewer", "ingest", "e1"],
      },
      {
        text: "The Spam + moderation filter scores the comment in ~10ms before it is durable: obvious spam and banned users are dropped or shadowed synchronously. Slower signals, coordinated raids, reported content, run asynchronously and issue takedowns after the fact. A takedown tombstones the comment in the store and sends a retraction id through the same frame path, so screens showing it remove it.",
        lights: ["spam", "e2"],
      },
      {
        text: "Accepted comments append to the Stream bus, partitioned by stream id, so one stream's comments are one ordered partition. The bus is the system's buffer and its replay. The sampler reads it live, the Comment store archives it, and a restarted consumer resumes from its offset instead of losing the gap.",
        lights: ["bus", "e3", "e9"],
      },
      {
        text: "The Fan-out sampler is where the ratio is broken. Once a second per stream it takes everything that arrived, scores it, and packs a frame of at most 15. The creator's comments always make it, replies to sampled comments preferentially, then a score-weighted sample of the rest. The head stream's 5,000 arrivals become one ~1KB frame. Sampling is per stream, never per viewer, which is the entire economics.",
        lights: ["sampler", "e4"],
      },
      {
        text: "The sampler asks the Subscription registry which edges hold viewers of the stream and sends the frame to exactly those. The head stream reaches all ~2,000 edges: 2,000 RPCs a second. A stream with 40 viewers reaches 2 or 3. The 1.9M streams nobody is watching are sampled cheaply and delivered nowhere, which is what makes 2M concurrent streams affordable.",
        lights: ["sampler", "registry", "e5", "e6"],
      },
      {
        text: "Each Edge broadcast server fans a received frame out to its local connections for that stream: a memory loop over open sockets, one buffered write each. Per viewer, delivery is one frame a second whatever the comment rate, so an edge with 50k connections does ~50k writes a second, a few hundred Mbps. The edge also injects the viewer's own unsampled comments into their copy of the frame, so local echo survives page refreshes.",
        lights: ["edge", "e7"],
      },
      {
        text: "A late joiner should not stare at an empty chat. On connect, the edge registers the viewer in the registry: the first viewer of a stream on a node subscribes the node. It backfills the last ~50 comments from the Comment store, ~10KB, and live frames take over. Sequence numbers stitch backfill and live together without duplicates.",
        lights: ["edge", "registry", "store", "e8", "e10"],
      },
      {
        text: "The path adds up to the freshness target. Ingest + spam ~15ms, bus append ~5ms, sampler tick worst case ~1s, registry lookup ~1ms, frame RPC ~10ms, edge write ~5ms. Worst case ~1.1s and typical ~600ms, against a ~2s post-to-room target. The deliberate 1-second tick dominates, and it is the same mechanism that makes the whole thing affordable.",
        lights: ["ingest", "sampler", "edge", "e3", "e5", "e7"],
      },
    ],
    crux: {
      problem:
        "At scale there is no such thing as showing everyone the chat. 5,000 comments a second cannot be read by anyone, so every viewer necessarily sees a sample, and two viewers of the same stream see different chats.",
      handled:
        "The design makes the sample principled instead of accidental. Deterministic inclusion classes come first: the creator's comments, your own comments, replies to what you were shown. The rest is a score-weighted sample chosen once per stream, so at least everyone's sample is drawn from the same frame. What remains is honest divergence: a comment seen by 4% of the room drives replies other viewers never saw context for. The product accepts it; no design at this ratio avoids it.",
    },
    numbers: [
      {
        value: "5B deliveries/s if fan-out is per viewer",
        explain: "5,000 comments/s on the head stream x 1M viewers. The number that rules out per-viewer queues and forces the shared-frame design.",
      },
      {
        value: "≤15 comments per frame, 1 frame/s",
        explain: "A human reads ~10 chat lines a second at most. The cap turns delivery cost into viewers x 1/s regardless of comment rate, and the sampler's choice work into once per stream per second.",
      },
      {
        value: "~2,000 edges x ~50k connections",
        explain: "100M concurrent viewers over long-lived connections; ~50k writes/s and a few hundred Mbps per node, comfortable for an event-loop server.",
      },
      {
        value: "~2,000 RPCs/s to broadcast the head stream",
        explain: "One frame per second to each subscribed edge. The million-viewer multiplication happens inside edges as local socket writes, never on the network between tiers.",
      },
      {
        value: "~60MB/s, ~5TB/day into the store",
        explain: "200k comments/s peak x ~300B. Every comment is stored even if never sampled: the archive serves late-join backfill, VOD replay and moderation review.",
      },
    ],
  },
  nodes: [
    {
      id: "viewer",
      label: "Viewers",
      kind: "client",
      sub: "watch, comment, one socket",
      col: 0,
      row: 0,
      detail: {
        what: "The audience: each viewer holds one long-lived connection to an edge server and posts comments over plain HTTP.",
        why: "The two directions are deliberately different paths. Posting is a rare, per-user action that can afford a full API round trip; receiving is a continuous broadcast that cannot. Splitting them lets each side scale on its own economics.",
        numbers: [
          { value: "100M concurrent at peak", explain: "The connection count the edge tier is sized for; most viewers never post." },
          { value: "~1 post per 500 viewer-minutes", explain: "Posting is rare: 200k comments/s from 100M viewers. The read path, not the write path, is the scale problem." },
        ],
        breaks: {
          failure: "A viewer's connection drops and reconnects to a different edge, risking a gap or duplicates in their chat.",
          handled: "Frames carry the stream's sequence range. The client sends the last sequence it rendered on reconnect; the edge backfills the gap from the store and resumes frames, deduping by sequence.",
        },
      },
    },
    {
      id: "ingest",
      label: "Comment ingest API",
      kind: "service",
      sub: "rate limit, dedupe, sequence",
      col: 1,
      row: 0,
      detail: {
        what: "The write path: accepts a post, rate-limits the user, dedups on a client key, stamps stream id and per-stream sequence, and acknowledges.",
        why: "The acknowledgement is the author's product experience: their comment is on their screen the moment it is accepted, whatever the sampler later decides. Ingest is stateless behind a load balancer; the per-stream sequence comes from the bus partition it appends to.",
        numbers: [
          { value: "200k posts/s peak", explain: "The global write rate; ~2k/s per ingest node across ~100 nodes." },
          { value: "~15ms post-to-ack", explain: "Rate check, spam score, bus append. The author's local echo is confirmed at this latency." },
        ],
        breaks: {
          failure: "A retry after a slow ack posts the same comment twice.",
          handled: "The client key makes the append idempotent: the second attempt returns the first comment's sequence. One comment, one sequence, however many retries.",
        },
        choice: {
          pick: "Post over plain HTTP, receive over the persistent connection",
          instead: "Posting up the same WebSocket the frames come down.",
          decider:
            "Failure isolation. Posts need auth, rate limiting and retries, request semantics HTTP already has. Multiplexing 200k posts/s into the broadcast tier couples the write path's abuse handling to the read path's fan-out, and an edge restart would take the write path down with it.",
          flips: "A chat where typing indicators and presence flow upstream continuously, where the socket is already bidirectional and a second path is overhead.",
        },
      },
    },
    {
      id: "spam",
      label: "Spam + moderation",
      kind: "service",
      sub: "~10ms score, async takedown",
      col: 2,
      row: 0,
      detail: {
        what: "A synchronous classifier on every post, and an asynchronous pipeline for the signals that take longer than a post can wait.",
        why: "Anything publicly visible at this scale is a target, and a live chat amplifies in seconds. The sync pass catches the cheap majority: banned users, repeated text, link spam, at ~10ms. The async pass catches what needs context, raids, reports, coordinated bursts, and repairs after the fact with takedowns.",
        numbers: [
          { value: "~10ms sync budget", explain: "Small enough to sit inside the ~15ms post-to-ack; anything slower moves to the async tier by construction." },
          { value: "~3% of posts dropped or shadowed", explain: "Shadowed comments still echo to their author, which keeps the cheapest spam from learning it was caught." },
        ],
        breaks: {
          failure: "A raid of new accounts floods a target stream faster than reports can arrive.",
          handled: "A per-stream velocity monitor watches unique-author rate and account-age mix; past threshold it flips the stream to member-or-older-account posting and pages the moderation queue. Blunt, reversible, and the creator can lift it.",
        },
        choice: {
          pick: "Sync score inside the ack, async takedown with retraction",
          instead: "Full moderation before any comment becomes visible.",
          decider:
            "Latency against exposure. Full pre-moderation puts the slow models on the path of 200k posts/s and turns ~15ms acks into hundreds of ms. The async repair bounds exposure to seconds for content only deeper models catch, on a surface where each comment is visible for ~20 seconds anyway.",
          flips: "High-risk surfaces, a children's product, a regulated broadcast, where seconds of exposure is unacceptable and pre-moderation latency is the price.",
        },
      },
    },
    {
      id: "bus",
      label: "Stream bus",
      kind: "queue",
      sub: "partitioned by stream id",
      col: 3,
      row: 0,
      detail: {
        what: "The append-only log of accepted comments, partitioned by stream id so each stream is one ordered sequence.",
        why: "One write, three readers with different rhythms: the sampler reads live, the store archives, moderation replays. The log decouples them, and the per-partition order is where comment sequence numbers actually come from.",
        numbers: [
          { value: "200k appends/s, ~60MB/s", explain: "Comments are small; the volume is modest for a partitioned log even at peak." },
          { value: "24h retention", explain: "Enough for any consumer to recover from an outage and for moderation to replay an incident; the archive owns anything older." },
        ],
        breaks: {
          failure: "The head stream's single partition takes 5k appends/s while 2M partitions idle.",
          handled: "5k appends/s of 300B messages is ~1.5MB/s, well inside one partition's ceiling. Order within a stream is the product requirement, so the skew is accepted rather than sharded away; a stream approaching partition limits is rate-capped at ingest first.",
        },
        choice: {
          pick: "A partitioned log between ingest and everything downstream",
          instead: "Ingest calling the sampler and store directly.",
          decider:
            "Recovery. Direct calls mean a sampler restart drops the comments posted while it was down, invisibly. With the log, every consumer resumes from its offset; a 30-second sampler outage is 30 seconds of delayed frames, not lost comments.",
          flips: "A single-region chat at a few hundred comments/s, where the ingest tier can double as the fan-out and the log is machinery.",
        },
      },
    },
    {
      id: "edge",
      label: "Edge broadcast servers",
      kind: "service",
      sub: "~50k conns each, 1 frame/s out",
      col: 0,
      row: 1,
      detail: {
        what: "The connection tier: ~2,000 nodes, each holding ~50k viewer connections and writing each one batched frame per second per watched stream.",
        why: "The million-fold multiplication has to happen somewhere, and here it is a loop over in-memory sockets rather than network hops: one frame arrives, ~thousands of local writes leave. The edge also personalises cheaply: it injects the viewer's own unsampled comments into their copy, so everyone always sees themselves in the chat.",
        numbers: [
          { value: "~50k writes/s per node", explain: "One frame per connection per second; a few hundred Mbps of egress at ~500B to 1KB per frame." },
          { value: "~64 bytes of state per connection", explain: "Stream id, last sequence delivered, auth handle. 50k connections is a few MB, which is why one node holds so many." },
        ],
        breaks: {
          failure: "An edge node dies and 50k viewers drop at once, then reconnect in a stampede.",
          handled: "Connections rebalance through the load balancer across surviving nodes; each reconnect is cheap (register + backfill). The registry expires the dead node's subscriptions by lease, so frames stop flowing to it within seconds.",
        },
        choice: {
          pick: "SSE with batched frames over an event-loop server",
          instead: "Client polling every second against a comments API.",
          decider:
            "The same 1-second cadence, wildly different cost. Polling is 100M HTTP requests a second hitting the serving tier, each paying headers, auth and routing to usually fetch nothing new. A held connection replaces all of it with one buffered socket write, ~1,000x less per-message overhead.",
          flips: "Tiny audiences on infrastructure that cannot hold connections, a serverless-only stack, where polling's simplicity wins at a scale where its waste is affordable.",
        },
      },
    },
    {
      id: "registry",
      label: "Subscription registry",
      kind: "database",
      sub: "stream → edges with viewers",
      col: 2,
      row: 1,
      detail: {
        what: "A leased map from stream id to the edge nodes currently holding at least one viewer of it, plus per-stream viewer counts.",
        why: "It is what makes quiet streams free. Delivery follows viewers, not existence: the sampler sends a stream's frame only to edges in its entry, so 1.9M barely-watched streams cost their own sampling tick and nothing more. Entries are leases refreshed by edges, so a dead node's subscriptions age out on their own.",
        numbers: [
          { value: "2M stream entries, ~each a small set", explain: "The head stream's entry lists ~2,000 edges; the median stream's lists 1 or 2." },
          { value: "~10s lease TTL", explain: "The staleness bound: a crashed edge receives frames for at most one lease interval." },
        ],
        breaks: {
          failure: "A registry entry outlives its viewers and frames flow to an edge with nobody watching.",
          handled: "Wasted frames for one lease interval, then the unrefreshed lease expires. The reverse failure, a missing entry, self-heals on the next viewer connect, which re-registers unconditionally.",
        },
        choice: {
          pick: "A leased subscription map read by the fan-out tier",
          instead: "Broadcasting every stream's frames to every edge and filtering locally.",
          decider:
            "The multiplication. All-streams-to-all-edges is 2M frames/s x 2,000 nodes = 4B frame deliveries a second, almost all filtered to nothing. The registry reduces it to the ~2.2M frame RPCs a second that have actual viewers behind them.",
          flips: "A deployment with dozens of streams and a handful of edges, where broadcast-and-filter is simpler and the waste is invisible.",
        },
      },
    },
    {
      id: "sampler",
      label: "Fan-out sampler",
      kind: "service",
      sub: "≤15 of N, once per stream/s",
      col: 3,
      row: 1,
      detail: {
        what: "The tier that turns each stream's comment firehose into one shared frame per second: score, apply inclusion rules, pack ≤15, send to subscribed edges.",
        why: "This is where the impossible ratio is broken. Choosing what is readable happens once per stream, not once per viewer. The head stream costs one scoring pass over ~5,000 comments a second instead of a million individual decisions. Streams are sharded across sampler workers by stream id; a worker owns a stream's tick or it does not.",
        numbers: [
          { value: "one ~1KB frame per stream per second", explain: "The unit of delivery: sequence range, ≤15 comments, retraction ids. Its size is capped whatever the comment rate." },
          { value: "head stream: score 5,000, keep 15", explain: "Creator comments and replies-to-shown are guaranteed slots; the rest is a score-weighted sample favouring engagement and account health." },
        ],
        breaks: {
          failure: "A sampler worker stalls and its streams' chats freeze while comments keep arriving.",
          handled: "Workers heartbeat per shard; a stalled shard is reassigned within ~5s and the new owner resumes from the bus offset, sending a catch-up frame. Viewers see a pause then a burst, never a gap in their own comments.",
        },
        choice: {
          pick: "Server-side sampling into one shared frame per stream",
          instead: "Delivering everything and letting each client throttle and choose.",
          decider:
            "Where the ratio lands. Client-side choice still requires delivering 5,000 comments/s to 1M screens, the 5B/s that is being avoided, and burns every phone's battery filtering noise. Doing it once server-side costs one worker's scoring pass and makes delivery rate-independent.",
          flips: "Small rooms, under ~50 comments/s, where everything fits under the read cap and sampling is a no-op passthrough.",
        },
      },
    },
    {
      id: "store",
      label: "Comment store",
      kind: "database",
      sub: "per-stream log, backfill + VOD",
      col: 2,
      row: 2,
      detail: {
        what: "The durable archive of every accepted comment, keyed by (stream id, sequence), fed from the bus.",
        why: "The live path never reads it, which is what keeps it simple. It exists for the three consumers that arrive later: a joining viewer's backfill, VOD replay of the chat beside the recording, and moderation review. Tombstones from takedowns apply here, so replays are as moderated as the live chat ended up.",
        numbers: [
          { value: "~5TB/day at peak rates", explain: "200k/s x ~300B. Retained hot for 30 days, then compacted with the VOD or dropped per retention policy." },
          { value: "backfill: last ~50 comments, ~10KB", explain: "One partition read by (stream, sequence range); cheap enough to do on every join and reconnect." },
        ],
        breaks: {
          failure: "A viral VOD replays its chat to millions, turning the archive into a read hot spot the live design never had.",
          handled: "VOD chat is served as static timed segments rendered once and cached on the CDN, not as store reads per viewer. The store serves the render, the CDN serves the crowd.",
        },
        choice: {
          pick: "A wide-column store keyed by (stream, sequence)",
          instead: "Reusing the bus's retention as the only history.",
          decider:
            "Read shape. Backfill and VOD are range reads by position in one stream, which is exactly a wide-column partition. They also arrive days after the bus's 24h retention has aged the data out. The log is a pipe, not an archive.",
          flips: "Ephemeral chat as a product decision, nothing replayable after the stream ends, where the bus retention is the whole history and the store is dead weight.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "viewer",
      to: "ingest",
      tier: "hot",
      step: 1,
      label: "post + local echo",
      detail: {
        what: "A comment posted over HTTP with a client-generated key; the author's screen shows it immediately and marks it confirmed on the ack.",
        why: "Local echo is the product promise to the author, made before the system has decided anything. It is also why an author never notices not being sampled: their own chat always contains them.",
        numbers: [{ value: "~15ms to ack", explain: "Rate limit + spam score + bus append; the small budget that keeps posting feel instant." }],
        breaks: {
          failure: "The ack is lost and the client retries a comment that already appended.",
          handled: "The client key dedups at ingest; the retry gets the original sequence back and the echo flips to confirmed without a duplicate.",
        },
      },
    },
    {
      id: "e2",
      from: "ingest",
      to: "spam",
      tier: "hot",
      step: 2,
      label: "sync score, ~10ms",
      detail: {
        what: "The synchronous classification call inside the post path: pass, drop, or shadow.",
        why: "Scoring before durability means the cheap majority of spam never costs storage, sampling or delivery. Shadowing instead of rejecting keeps naive bots from learning which patterns are caught.",
        numbers: [{ value: "~3% dropped or shadowed here", explain: "The sync tier's catch; the async tier repairs what needs slower signals." }],
        breaks: {
          failure: "The classifier tier degrades and the choice is block all posting or accept unscored.",
          handled: "Fail open with sampling and a velocity cap per stream, and lean on async takedowns. Posting staying up matters more than perfect sync coverage for minutes.",
        },
      },
    },
    {
      id: "e3",
      from: "spam",
      to: "bus",
      tier: "hot",
      step: 3,
      label: "append, per-stream seq",
      detail: {
        what: "The accepted comment appended to its stream's partition, receiving the sequence number every later stage keys on.",
        why: "Sequence is assigned by the partition, not by ingest nodes, so ordering within a stream is by construction and needs no coordination across the stateless write tier.",
        numbers: [{ value: "~5ms append", explain: "One partitioned log write; the last synchronous step of the post path." }],
        breaks: {
          failure: "A partition leader fails over and appends stall for seconds on affected streams.",
          handled: "Ingest buffers briefly and retries; authors keep their local echo and acks arrive late. A few seconds of delayed frames beats dropping the comments on the floor.",
        },
      },
    },
    {
      id: "e4",
      from: "bus",
      to: "sampler",
      tier: "hot",
      step: 4,
      label: "stream partition feed",
      detail: {
        what: "Each sampler worker consuming the partitions of the streams it owns, accumulating comments for the next tick's frame.",
        why: "The worker reads everything and forwards almost nothing, which is the right side of the ratio to do work on. Ownership by partition means a stream's frames are built by exactly one worker, so frames never race.",
        numbers: [{ value: "200k comments/s in, ~2.2M frames/s out across all streams", explain: "Frames out scale with live streams and viewers, not with comment volume; the two sides of this edge scale independently." }],
        breaks: {
          failure: "A worker falls behind its partitions and frames carry increasingly stale comments.",
          handled: "Lag is monitored per shard; past 2s the worker sheds by sampling from the newest window first, freshness over completeness, and the shard rebalances if lag persists.",
        },
      },
    },
    {
      id: "e5",
      from: "sampler",
      to: "edge",
      tier: "hot",
      step: 5,
      label: "1 frame/s to subscribers",
      detail: {
        what: "The per-stream frame pushed once a second to exactly the edges the registry lists for that stream.",
        why: "This is the whole trick made visible. The network between tiers carries frames proportional to subscribed edges, ~2,000 RPCs a second for the biggest stream on earth. The million-fold multiplication stays inside edge memory.",
        numbers: [
          { value: "~2.2M frame RPCs/s fleet-wide", explain: "Sum over live streams of subscribed edges; dominated by big streams, bounded by edges x streams-with-viewers." },
          { value: "~1KB per frame", explain: "Sequence range, ≤15 comments, retraction ids; capped regardless of comment rate." },
        ],
        breaks: {
          failure: "A frame RPC to one edge is lost and 50k viewers on that node miss a second of chat.",
          handled: "Frames carry the sequence range; the next frame's range exposes the gap and the edge backfills from the store if it matters. In practice a 1-second hole in a sampled chat is invisible.",
        },
      },
    },
    {
      id: "e6",
      from: "sampler",
      to: "registry",
      tier: "data",
      label: "who subscribes?",
      detail: {
        what: "The per-tick lookup of the stream's current edge set, cached briefly in the worker.",
        why: "Reading at tick time keeps delivery tracking viewers as they move; the short cache keeps 2.2M ticks a second from hammering the registry for mostly unchanged answers.",
        numbers: [{ value: "~1ms lookup, ~2s worker cache", explain: "Staleness here only means a frame or two to a just-emptied edge, already bounded by the lease." }],
        breaks: {
          failure: "Registry unavailable: no worker knows where any stream's viewers are.",
          handled: "Workers keep serving from their last known edge sets, which decay only as fast as viewers actually move. Minutes of registry outage degrade delivery accuracy slightly rather than silencing chats.",
        },
      },
    },
    {
      id: "e7",
      from: "edge",
      to: "viewer",
      tier: "hot",
      step: 6,
      label: "batched frame, 1/s",
      detail: {
        what: "The buffered socket write of the frame to every local connection watching that stream, with the viewer's own comments injected into their copy.",
        why: "One write per viewer per second is the invariant the whole design exists to reach. The per-viewer injection is the only personalisation on the path, and it is a memory merge, not a lookup.",
        numbers: [
          { value: "~50k writes/s per edge node", explain: "Connections x 1/s; the loop is CPU-light and the bandwidth is a few hundred Mbps." },
          { value: "≤1s added by batching", explain: "The tick is most of the post-to-room latency and is the deliberate price of rate-independent delivery." },
        ],
        breaks: {
          failure: "A slow connection cannot drain even one frame a second.",
          handled: "Per-connection buffers cap at a few frames; beyond that the edge drops the oldest frames for that connection. Sampled chat degrades to more-sampled chat, and the client's sequence gap triggers backfill if it recovers.",
        },
      },
    },
    {
      id: "e8",
      from: "edge",
      to: "registry",
      tier: "control",
      label: "lease: first viewer joins",
      detail: {
        what: "Subscription maintenance: the first local viewer of a stream registers the node, the lease refreshes while any remain, and expiry unsubscribes.",
        why: "Making subscription follow the first viewer, rather than configuration, is what lets 2M streams exist with delivery cost proportional to actual audiences.",
        numbers: [{ value: "~10s lease, refreshed in batches", explain: "One batched refresh per node per interval covers all its streams; churn cost stays flat as audiences move." }],
        breaks: {
          failure: "Registration races the first frame: a brand-new viewer misses the second before their node's subscription lands.",
          handled: "The join backfill from the store covers exactly that window; the viewer's first screen is backfill plus the next frame, with sequence numbers deduping the seam.",
        },
      },
    },
    {
      id: "e9",
      from: "bus",
      to: "store",
      tier: "data",
      label: "archive every comment",
      detail: {
        what: "A bus consumer landing every accepted comment in the archive, sampled or not, tombstoning on takedown.",
        why: "The sampler's choices are about screens, not truth. Backfill, VOD and moderation all need the full record, and the author's own-comments view is served from here after reconnects.",
        numbers: [{ value: "~60MB/s sustained at peak", explain: "A modest, purely sequential write load; the archive consumer is never on any latency path." }],
        breaks: {
          failure: "The archive consumer lags and late joiners' backfill misses the most recent comments.",
          handled: "Backfill tops up from the bus tail beyond the archive's high-water mark, so the seam between archive and live is covered by the log either way.",
        },
      },
    },
    {
      id: "e10",
      from: "store",
      to: "edge",
      tier: "data",
      label: "late join: last ~50",
      detail: {
        what: "The backfill read on connect or reconnect: the last ~50 comments of the stream, merged with the viewer's own recent comments.",
        why: "An empty chat reads as a dead stream. Ten kilobytes on join buys the room feeling alive at the cost of one partition range read.",
        numbers: [{ value: "~10KB per join", explain: "Even a reconnect stampede of 50k viewers is ~500MB of range reads, spread across stream partitions." }],
        breaks: {
          failure: "A mass reconnect after an edge death turns backfill into a synchronized read burst.",
          handled: "Edges cache the last frames per subscribed stream and serve most backfill from memory, touching the store only for deeper gaps; the burst is absorbed where the connections are.",
        },
      },
    },
  ],
  figures: {
    ratio: {
      title: "Breaking the ratio: choose once per stream, multiply only in memory",
      nodes: [
        { id: "firehose", label: "Head stream firehose", sub: "5,000 comments/s", kind: "queue", col: 0, row: 0 },
        {
          id: "pick",
          label: "Sampler tick",
          sub: "score all, keep ≤15",
          kind: "service",
          col: 0,
          row: 1,
          detail: {
            what: "One scoring pass per second over everything that arrived, packing one shared frame.",
            why: "The choice of what is readable is made once for the whole room, not once per viewer; this is the only place the 5,000/s is ever processed in full.",
          },
        },
        {
          id: "frame",
          label: "One shared frame",
          sub: "~1KB, sequence-stamped",
          kind: "blob",
          col: 0,
          row: 2,
          detail: {
            what: "The second's chat for this stream: ≤15 comments plus retraction ids.",
            why: "Its size is capped whatever the comment rate, so delivery cost below this point no longer depends on how fast people type.",
          },
        },
        {
          id: "edges",
          label: "~2,000 subscribed edges",
          sub: "one RPC each, per second",
          kind: "service",
          col: 1,
          row: 2,
          detail: {
            what: "The network fan-out: one frame RPC per subscribed edge per second.",
            why: "2,000 RPCs a second is the entire inter-tier cost of the biggest stream on earth.",
          },
        },
        {
          id: "sockets",
          label: "1M viewer sockets",
          sub: "local writes, in memory",
          kind: "client",
          col: 1,
          row: 3,
          detail: {
            what: "The million-fold multiplication: a loop over each edge's local connections, one buffered write each.",
            why: "It happens inside edge memory, never on the network between tiers, which is why the number can be a million.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "firehose", to: "pick", tier: "hot", step: 1, label: "everything, once" },
        { id: "e2", from: "pick", to: "frame", tier: "hot", step: 2, label: "≤15 survive" },
        { id: "e3", from: "frame", to: "edges", tier: "hot", step: 3, label: "~2,000 RPCs" },
        { id: "e4", from: "edges", to: "sockets", tier: "hot", step: 4, label: "1M local writes" },
      ],
    },
  },
};
