import type { Diagram } from "./types";

export const COLLABORATIVE_EDITOR: Diagram = {
  id: "collaborative-editor",
  title: "Collaborative Editor",
  question: "Design Google Docs (Real-Time Collaborative Editor)",
  sourceId: "patterns",
  itemId: 37,
  overview: {
    shape:
      "The document is never transmitted: what travels is a stream of small operations, each tagged with the revision its author was looking at, rewritten once that revision has gone stale.",
    forces: [
      {
        constraint: "insert('X', 5) is a function of a document, and by the time it lands that document has usually moved",
        decision: "The server rewrites every stale operation through the OT transform, so it still means what its author intended",
        lights: ["transform", "e3"],
      },
      {
        constraint: "convergence across 3 or more transform sites needs a stronger property (TP2) several published algorithms falsely claimed",
        decision: "One document owner is the only transform site per document, keeping the system on the buildable TP1-only side",
        lights: ["owner-zone", "owner"],
      },
      {
        constraint: "an edit that reached three screens and no disk can neither be recovered nor un-shown",
        decision: "The operation is appended to a majority of the op log before broadcast ever begins",
        lights: ["oplog", "broadcast", "e4", "e5"],
      },
      {
        constraint: "fan-out is quadratic in editors: at ~1,000 concurrent typists that is 2M frame-sends/s",
        decision: "Active editors are capped at 50, with the rest downgraded to suggestion or view mode",
        lights: ["broadcast", "e6"],
      },
      {
        constraint: "a five year old document would cost 800,000 operations to replay before the first character renders",
        decision: "A snapshotter writes the full document every 1,000 operations or 5 minutes, so open time never depends on history depth",
        lights: ["snapshotter", "snapshots", "e10", "e11"],
      },
    ],
    naive: {
      text: "Broadcast every operation to every client exactly as the author sent it, and let each client apply it directly to whatever it currently shows. An insert('X', 5) means insert at position 5, but by the time it arrives the document has usually moved. Applying it blindly puts a letter in the wrong place. With no single site deciding order, two clients can disagree forever about what happened. The design instead funnels every operation through one document owner, which transforms a stale operation so it still expresses its author's intent against the state that actually exists.",
      lights: ["owner", "transform"],
    },
    beats: [
      {
        text: "An operation is not a message. A message means the same thing whenever it is delivered; insert('X', 5) is a function of a document, and by the time it lands that document has usually moved. Every real decision here is about where you convert that function into one that still expresses its author's intent against the state that actually exists.",
        lights: ["client", "owner", "transform"],
      },
      {
        text: "One process owns each document. It takes operations in arrival order, reads its own log from the sender's base_rev to current_rev, and folds the operation through that gap one transform at a time. It assigns the next revision and only then broadcasts. Funnelling everything through a single owner turns a distributed concurrency problem into an ordered queue, the largest simplification in the design.",
        lights: ["owner-zone", "owner", "transform", "broadcast", "e2", "e3"],
      },
      {
        text: "The client is not passive. Your keystroke applies locally the instant you type, so typing never waits for a round trip. The client holds unacknowledged work in a pending buffer at most one operation deep on the wire. When a remote operation arrives the transform runs in both directions: the remote against the buffer, and the buffer against the remote, so both sides transform from the same premise.",
        lights: ["client", "socket-edge", "e1", "e6"],
      },
      {
        text: "Write order is not negotiable. The operation is appended to a majority of the per document log before it is broadcast. An edit that reached three screens and no disk can neither be recovered nor un-shown. The originating client gets back only its new revision number, never its own operation, because it applied that edit half a second ago.",
        lights: ["oplog", "broadcast", "e4", "e5", "e6"],
      },
      {
        text: "Snapshots bound the cost of opening. A full serialised document is written every 1,000 operations or every 5 minutes. A five year old document then opens as one snapshot fetch plus a short tail, rather than replaying 800,000 operations from creation. Version history is stored as revisions coalesced at roughly one per minute of editing, a 40x reduction over raw operations.",
        lights: ["snapshotter", "snapshots", "history", "e10", "e11", "e12"],
      },
      {
        text: "Presence and offline are the two paths that do not look like the others. Cursors ride the same socket, are throttled to about 10 frames per second per client at the socket edge and are never written to the log. A client returning from a gap sends its last received revision, pulls the operations it missed and rebases its buffered work against them.",
        lights: ["presence", "offline", "e8", "e9", "e13", "e14"],
      },
    ],
    crux: {
      problem:
        "Every client must land on byte-identical text no matter what order operations arrived in. The property that makes that achievable is that there is exactly one transform site.",
      handled:
        "Two owners for one document means transforms happening in two places, which requires a stronger convergence property that almost nobody has correctly implemented. The design refuses to shard or replicate the owner, accepting a single process as the hard ceiling on how many editors one document can serve.",
    },
    numbers: [
      {
        value: "200ms keystroke budget, ~15ms of it transform plus log append",
        explain: "The end-to-end round-trip target from typing to acknowledgement; the transform and durable write consume only a slice of it, with network hops taking the rest.",
      },
      {
        value: "snapshot every 1,000 ops or 5 minutes",
        explain: "The trigger that bounds how many operations a client ever has to replay on open, whichever threshold is hit first.",
      },
      {
        value: "p50 1 editor per document, p99 20, product cap 50",
        explain: "Most documents are edited alone; the design's hard limits are set against the long tail of heavily collaborated documents, not the typical case.",
      },
    ],
  },
  nodes: [
    {
      id: "client",
      label: "Editor client",
      sub: "local doc + pending buffer, depth 1",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The browser or app holding its own copy of the document, last_server_rev, and a buffer of operations it applied locally but has not had acknowledged.",
        why: "Typing cannot wait for a round trip, so the client applies your keystroke optimistically and reconciles afterwards. That optimism is exactly what creates divergence, and the pending buffer is the record of how far ahead of the server this screen currently is.",
        numbers: [
          { value: "keystrokes coalesced into ~500ms bundles", explain: "How individual keystrokes are batched before being sent, reducing frame count without adding perceptible delay." },
          { value: "wire depth of 1 unacknowledged operation", explain: "At most one bundle is ever in flight unacknowledged, keeping the amount of state that could need rebasing small." },
          { value: "~200B per operation on the wire", explain: "The typical payload size of one coalesced edit, small enough to keep the socket cheap." },
        ],
        breaks: {
          failure: "Applying an incoming remote operation without also transforming the pending buffer against it.",
          handled: "The buffer silently rots, the next acknowledgement makes the client believe it is level, and one user sees a character permanently in the wrong place with no way to self-correct.",
        },
      },
    },
    {
      id: "socket-edge",
      label: "WebSocket edge",
      sub: "session terminator, presence",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The socket-terminating tier that holds one persistent connection per editing session and forwards frames to the document's home region.",
        why: "The system is bound by connection count rather than aggregate throughput, so the tier that owns connections is sized independently of the tier that owns documents. It is also the cheapest place to drop abusive presence frames, before they reach a single-threaded owner.",
        numbers: [
          { value: "~7M concurrent sessions at peak", explain: "The scale of open editing sessions this tier is provisioned to hold simultaneously." },
          { value: "~50k sockets per box, ~300 boxes", explain: "How the connection load is spread across the fleet." },
          { value: "presence capped at ~10 frames/s/client", explain: "The rate limit applied here before cursor traffic can ever reach a document owner." },
        ],
        breaks: {
          failure: "A connection drops mid-edit with local operations unsent.",
          handled: "The client keeps buffering against its last known server revision and reconnects with jittered backoff, so the buffer grows for as long as the outage lasts.",
        },
        choice: {
          pick: "One persistent WebSocket per editing session",
          instead: "Long polling, or server-sent events with a separate POST channel for writes.",
          decider:
            "The 200ms end-to-end budget with traffic in both directions. Roughly 2 operations per second per editor flow up and fan out to every other editor. A fresh HTTP request per operation spends more of that budget on connection setup than on the transform.",
          flips: "A read-mostly viewer, or a comment-only surface, where updates flow one way and SSE removes the socket bookkeeping for free.",
        },
      },
    },
    {
      id: "owner-zone",
      label: "Single transform site",
      kind: "zone",
      detail: {
        what: "Everything inside this box runs in one process for one document: ordering, the transform, and the fan-out.",
        why: "Convergence between two sites needs the transform to satisfy TP1 only. Arbitrary concurrency across three or more transform sites additionally needs TP2, which several published algorithms claimed and were later model-checked to violate. One owner keeps the design on the buildable side of that line.",
        numbers: [
          { value: "exactly 1 transform site per document", explain: "The invariant this whole boundary exists to protect, enforced by never sharding or replicating the owner." },
          { value: "TP1 required, TP2 not", explain: "The weaker, achievable convergence property this design relies on, versus the much harder one it deliberately avoids needing." },
        ],
        breaks: {
          failure: "Sharding a hot document by section, or standing up a second owner so European editors get a local round trip.",
          handled: "Either move creates a second transform site and puts TP2 back in scope with no implementation known to satisfy it, which is why both are refused rather than optimised around.",
        },
      },
    },
    {
      id: "owner",
      label: "Document owner",
      sub: "single-threaded actor, rev counter",
      kind: "service",
      col: 1,
      row: 1,
      parent: "owner-zone",
      detail: {
        what: "One lightweight process per open document holding the current text, the revision counter, and the tail of the operation log.",
        why: "Ordering inside one process is a memory write of tens of nanoseconds. Ordering across processes is distributed consensus on every keystroke. Making the document the unit of ownership converts the hard part of this system into a local queue that never splits.",
        numbers: [
          { value: "1 owner per open document", explain: "The unit of ownership this whole design is built around, never split or shared." },
          { value: "document never sharded, ~50KB mean, 5MB hard cap", explain: "The size range one owner is expected to hold entirely in memory." },
          { value: "hard ceiling ~1,000 editors before 4 cores saturate", explain: "The theoretical CPU limit on one owner, far above the product's own 50-editor cap." },
        ],
        breaks: {
          failure: "The owning host dies mid-broadcast, so some clients hold the newest operation and others do not.",
          handled: "The log was written first, so the replacement replays it, but there is a 10 to 30 second read-only window that users experience as a frozen document.",
        },
        choice: {
          pick: "A flat character sequence with attribute spans over ranges, 4 operation types",
          instead: "A tree of typed nodes addressed by path, the way ProseMirror and Slate model a document.",
          decider:
            "The transform function's case count. Retain, insert, delete and set-attribute is 4 types, so 16 ordered pairs, all offset arithmetic on one axis. A path-addressed tree adds split, join, wrap, unwrap and move, 9 types and 81 pairs, where a concurrent split invalidates every path below it.",
          flips: "When structure rather than prose is the product. An outliner or page builder needs move as a first-class atomic operation, which a flat sequence cannot express without duplicating content.",
        },
      },
    },
    {
      id: "transform",
      label: "OT transform",
      sub: "rewrites ops against the gap",
      kind: "service",
      col: 2,
      row: 1,
      parent: "owner-zone",
      detail: {
        what: "The rule set that rewrites a stale operation so it means against current state what it meant against the state its author saw.",
        why: "An insert at position 5 becomes an insert at position 0 if someone deleted five characters ahead of it. The rewrite runs on the server, the only place with an undisputed answer to what came first, and the identical function runs on the client against its pending buffer.",
        numbers: [
          { value: "TP1: apply a then T(b,a) equals apply b then T(a,b)", explain: "The convergence property this transform is required to satisfy, the mathematical guarantee behind the whole design." },
          { value: "4 operation types, 16 ordered pairs", explain: "4x4 = 16 fixed cases, so even the 300,000-transform worst-case rebase is lookups against a constant table, not a combinatorial blowup." },
          { value: "offline rebase of 200 ops against 1,500 is 300,000 pairwise transforms", explain: "How the transform cost scales with the size of a reconnect gap, the worst realistic case this function handles." },
        ],
        breaks: {
          failure: "A transform bug or a doubly-applied operation diverges one client permanently, and no incremental repair exists because nothing says which side is wrong.",
          handled: "The server hashes its document every 200 operations and broadcasts {rev, hash}; a mismatched client throws its state away and reloads from the last snapshot.",
        },
        choice: {
          pick: "Operational transformation, with the owning server as both ordering authority and the only transform site",
          instead: "A sequence CRDT: every character carries a globally unique identity, and merging divergent histories is a union needing no authority.",
          decider:
            "Whether a server is already on the critical path, and how long a client can be disconnected. A server is needed anyway for authorisation re-checks, durable append and presence fan-out, and the p99 disconnection gap is under 2 minutes against an offline requirement measured in hours.",
          flips: "No server on the edit path at all (local-first, peer to peer), offline gaps measured in days, or shipping the editing core as an SDK others embed.",
        },
      },
    },
    {
      id: "broadcast",
      label: "Broadcast + ack",
      sub: "op' to others, rev only to author",
      kind: "service",
      col: 3,
      row: 1,
      parent: "owner-zone",
      detail: {
        what: "Fan-out of the transformed operation to every other editor on the document, plus a bare revision number back to the client that sent it.",
        why: "The originating client already applied its own edit locally half a second ago, so echoing the operation back would apply it twice. It needs only the revision number to pop the front of its pending buffer and advance last_server_rev.",
        numbers: [
          { value: "at 50 editors: 100 ops/s x 49 recipients = 4,900 frame-sends/s", explain: "The fan-out cost at the product's own editor cap, the traffic this stage is actually sized for." },
          { value: "revision gap SLO p99 < 50 operations", explain: "How far behind current revision a healthy client's acknowledgement is expected to lag." },
        ],
        breaks: {
          failure: "Fan-out is quadratic in editors.",
          handled: "At ~1,000 concurrent typists that is 2M frame-sends/s at roughly 2 microseconds each, which saturates four cores against a single-threaded owner, well above the 50-editor product cap.",
        },
        choice: {
          pick: "Cap active editors at 50 and downgrade the rest to suggestion or view mode",
          instead: "Shard the document by section so each section gets its own owner and its own fan-out.",
          decider:
            "50 is not where the machine stops coping, it is where the merge result stops being usable; the CPU ceiling is nearer 1,000. Sectioning would raise the ceiling but creates a second transform site.",
          flips: "A broadcast-shaped document such as a live lecture transcript, where thousands read and only one or two write, making fan-out a relay problem rather than a convergence problem.",
        },
      },
    },
    {
      id: "oplog",
      label: "Op log",
      sub: "Cassandra, PK doc_id, by rev",
      kind: "queue",
      col: 2,
      row: 2,
      detail: {
        what: "An append-only log of every accepted operation for one document, written to a majority before anything is broadcast.",
        why: "This is the durability boundary. It is also the read that makes the transform possible. The gap from a client's base_rev to current_rev is exactly the set of operations that client had not seen, and you cannot transform against a history you do not hold.",
        numbers: [
          { value: "~100B ops/day, ~20TB/day raw", explain: "The daily write volume this log absorbs across every open document." },
          { value: "~140TB live, 7 days behind the latest snapshot", explain: "How much of that history stays online before falling back on archived snapshots." },
          { value: "append latency SLO p99 < 20ms", explain: "Bounds the store's own contribution to typing latency; miss it and the client sits in 'saving' rather than showing an edit that isn't durable yet." },
        ],
        breaks: {
          failure: "A majority write fails after the user already saw the edit on screen.",
          handled: "The operation is rejected and the client held in a 'saving' state rather than acknowledged, because the system never acknowledges ahead of durability.",
        },
        choice: {
          pick: "A replicated append-only log, partitioned by doc_id and clustered by rev",
          instead: "Storing only the current document and writing the whole thing back on each edit.",
          decider:
            "Access pattern and write rate. Every read is a contiguous range of revisions for one document and every write is an append, exactly what a partition key plus clustering column serves.",
          flips: "A document small enough and edited rarely enough that a whole-document write is cheap, such as a single-user notes app, where the log adds replay machinery nobody needs.",
        },
      },
    },
    {
      id: "lease",
      label: "Lease coordinator",
      sub: "etcd, doc_id to owner, exclusive",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "A coordination service holding the document-to-server assignment and the lease that makes it exclusive, consulted on every document open.",
        why: "One owner per document is only true if something enforces it. The lease is that enforcement, and its heartbeat is also how owner death is detected, which is what bounds the read-only window before a replacement takes over.",
        numbers: [
          { value: "lease reassignment SLO p99 < 30s", explain: "The time bound on how long a document stays frozen after its owner dies." },
          { value: "1 lookup per document open, 0 per operation", explain: "The lease is consulted only when a document is first opened, never on the per-keystroke hot path." },
        ],
        breaks: {
          failure: "The coordination service is on the open path for all ~250M editing sessions per day.",
          handled: "If it is unavailable nobody can open a document even though every owner is perfectly healthy, an accepted single point of failure on open, never on already-open editing.",
        },
        choice: {
          pick: "Lease each open document to exactly one process",
          instead: "Stateless collaboration servers, any of which serves any document, with ordering by compare-and-set append to the log.",
          decider:
            "The concurrency distribution against what the lease costs. Ordering inside one process is tens of nanoseconds. A conditional append to a replicated log is 5 to 20ms, and at 2 ops/s per editor twenty editors collide on about half of appends.",
          flips: "When the p99 is 2 or 3 editors rather than 20, which describes most internal wikis and note-taking products, where the stateless design wins outright.",
        },
      },
    },
    {
      id: "presence",
      label: "Presence channel",
      sub: "cursors + selections, never logged",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "Cursor positions, selections and avatars, forwarded to the other editors on the same socket and never persisted.",
        why: "Presence is what makes collaboration legible, and it is worthless one second later. Sharing the socket keeps it ordered against the edits it describes, while keeping it out of the log stops ephemeral data inflating a 20TB/day durable write path.",
        numbers: [
          { value: "throttled to ~10 frames/s/client", explain: "The rate cap this channel enforces on cursor updates before they can flood the system." },
          { value: "0 bytes written to the op log", explain: "Presence never touches durable storage at all, keeping it entirely off the write-amplification budget." },
        ],
        breaks: {
          failure: "A buggy or hostile client floods cursor frames.",
          handled: "A user dragging a selection across three pages already generates hundreds, so the excess is dropped at the socket edge before it can reach the single-threaded document owner.",
        },
        choice: {
          pick: "Same WebSocket as edits, dropped at the socket edge, never written down",
          instead: "A separate pub/sub channel for presence, or persisting cursor state with the document.",
          decider:
            "Ordering against edits, and blast radius. A cursor offset is only meaningful relative to a revision, so a second channel reintroduces the ordering problem the first one solved.",
          flips: "When presence carries far more than cursors, for example live audio or video tiles, where the media path has nothing to do with the edit path.",
        },
      },
    },
    {
      id: "snapshotter",
      label: "Snapshot writer",
      sub: "every 1,000 ops or 5 minutes",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "A job that serialises the full document at a revision and writes it under a temporary key, verifies its content hash, then atomically advances the 'latest' pointer.",
        why: "Snapshots are what make open time independent of history depth. Without them a five year old shared document costs 800,000 operations to replay before the first character renders.",
        numbers: [
          { value: "snapshot lag SLO < 1,000 operations", explain: "How far a document is allowed to drift from its last snapshot before this job is considered behind." },
          { value: "previous snapshot retained for one cycle", explain: "The rollback margin kept in case a fresh snapshot turns out to be bad." },
        ],
        breaks: {
          failure: "The writer dies mid-write and leaves a partial blob.",
          handled: "The manifest verifies the content hash before 'latest' advances and an orphan sweeper reclaims the debris, so a bad snapshot is never the thing a client loads.",
        },
        choice: {
          pick: "Every 1,000 operations or 5 minutes, whichever comes first",
          instead: "Snapshot on session close, or continuously on every operation.",
          decider:
            "Open cost against write amplification. 1,000 operations bounds the tail a client replays to well under a second, while snapshotting on every operation would be petabytes a day of redundant writes.",
          flips: "Documents that are opened far more often than they are edited, where snapshotting more aggressively buys read latency at a write cost nobody notices.",
        },
      },
    },
    {
      id: "snapshots",
      label: "Snapshot store",
      sub: "object storage, ~1.2PB",
      kind: "database",
      col: 3,
      row: 3,
      detail: {
        what: "Object storage holding the latest full serialised document per doc_id, addressed through a manifest that names the verified current blob.",
        why: "Opening a document is a snapshot fetch plus a short tail rather than a replay of history. Putting whole-document blobs here rather than in the log store keeps the log a pure sequential append path with no large values in it.",
        numbers: [
          { value: "10B hot documents x ~50KB mean = 500TB, RF=3 = 1.5PB", explain: "The raw storage this tier would need before deduplication is applied." },
          { value: "~1.2PB after ~20% deduplication of templates and boilerplate", explain: "The actual footprint once shared boilerplate across documents is deduplicated." },
          { value: "median document ~13KB, p99 ~1MB, cap 5MB", explain: "The size distribution this store is tuned around, with a hard ceiling per document." },
        ],
        breaks: {
          failure: "A 5MB document takes seconds to deserialise and lay out.",
          handled: "The snapshot is streamed and the editor renders the visible viewport before the tail arrives, which fixes opening but not editing latency for very large documents.",
        },
        choice: {
          pick: "Object storage, one verified blob per document",
          instead: "Keeping snapshots as a blob column alongside the document row in the log store.",
          decider:
            "Value size against the log store's access pattern. ~1.2PB of 50KB to 5MB blobs read exactly once per open is the object store's native shape, whereas large values in a wide-column table inflate compaction.",
          flips: "Small documents, below roughly 100KB with a modest corpus, where a blob column removes a whole system and the extra round trip on open costs more than it saves.",
        },
      },
    },
    {
      id: "history",
      label: "Version history",
      sub: "coalesced revisions, ~1 per minute",
      kind: "database",
      col: 2,
      row: 3,
      detail: {
        what: "Named revisions built by coalescing runs of operations into roughly one entry per minute of editing, plus per-range attribution, queried lazily.",
        why: "A year of history is a product feature, but nobody wants it at keystroke granularity and nobody can afford it there either. Coalescing collapses ~400 operations per session into ~10 stored revisions.",
        numbers: [
          { value: "40x reduction: 20TB/day raw becomes 500GB/day", explain: "The compression coalescing achieves, the number that makes a year of history affordable." },
          { value: "~180TB/year against 7.3PB/year for raw operations", explain: "The annual storage difference between the coalesced product feature and keeping every raw operation online." },
        ],
        breaks: {
          failure: "History is loaded lazily, so a request for deep attribution on a large document is a slow query against archived columnar data.",
          handled: "That is the accepted trade rather than something the editor serves inline, since almost nobody scrubs history at half-second granularity.",
        },
        choice: {
          pick: "Store coalesced named revisions, archive raw operations as compressed columnar",
          instead: "Keep every raw operation online for a year and reconstruct any point in time on demand.",
          decider:
            "20TB/day raw against 500GB/day coalesced is the whole argument: 7.3PB/year against ~180TB/year for a feature almost nobody scrubs through at half-second granularity.",
          flips: "Regulated or legal-hold documents where every individual edit and its author must be reproducible. There the raw log is the record, and the 40x is a compliance cost you pay.",
        },
      },
    },
    {
      id: "offline",
      label: "Reconnecting client",
      sub: "buffered ops rebased on the gap",
      kind: "external",
      col: 0,
      row: 1,
      detail: {
        what: "A client returning from a disconnection: it sends last_received_rev, receives the operations it missed, and rebases its accumulated local buffer against them.",
        why: "Reconnect in a chat system is a cursor read that cannot fail interestingly. Here it is a rebase of the client's buffered work against everything it missed, and it can produce a result the user has to be shown before it is committed.",
        numbers: [
          { value: "p99 offline gap under 2 minutes", explain: "How long a typical disconnection lasts, the case the rebase design is actually tuned for." },
          { value: "flight case: 200 local ops against 1,500 remote", explain: "A realistic worst-case reconnect scenario used to size the rebase cost." },
          { value: "300,000 pairwise transforms, microseconds each", explain: "The compute cost of that worst-case rebase, cheap even though the number sounds large." },
        ],
        breaks: {
          failure: "The compute is nothing and the output is the problem.",
          handled: "Two people who spent hours rewriting the same section converge on an interleaving of both rewrites that is provably consistent and reads like nonsense to a human.",
        },
        choice: {
          pick: "Rebase the buffer against the gap, plus a suggestion-mode prompt on overlapping ranges",
          instead: "A fork and merge model where offline work becomes a branch reconciled deliberately, the way source control does it.",
          decider:
            "The p99 offline gap is under 2 minutes, and maintaining two merge models to serve the tail is not worth it. The heuristic shipped instead: if an incoming operation overlaps a range another user touched in the last 10 seconds, push the second author into suggestion mode.",
          flips: "A product where long offline work is the point rather than the tail, such as field data collection or a mobile-first editor, where branch and merge is the honest model.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "socket-edge",
      tier: "hot",
      step: 1,
      label: "op + base_rev",
      detail: {
        what: "A coalesced bundle of a few characters, tagged with the revision its author was looking at and the client id.",
        why: "base_rev is the whole protocol in one field. Without it the server has no way to know which operations this client had not seen, and therefore no way to work out what the operation was supposed to mean.",
        numbers: [
          { value: "~200B per frame", explain: "The typical wire size of one coalesced operation bundle." },
          { value: "~2 bundles/s per actively typing editor", explain: "The steady rate one actively typing client generates." },
        ],
        breaks: {
          failure: "The edit is already on the author's screen before this frame is sent.",
          handled: "A frame lost in flight is a divergence that only the acknowledgement timeout will reveal, prompting a resend rather than silent loss.",
        },
      },
    },
    {
      id: "e2",
      from: "socket-edge",
      to: "owner",
      tier: "hot",
      step: 2,
      label: "ops in arrival order",
      detail: {
        what: "Forwarding operation frames from the socket tier to the process that currently holds the lease on this document.",
        why: "The socket tier scales on connection count and the owner scales on documents, so the two tiers are separate. Everything editing this document has to arrive at the same process, which is what turns concurrency into a queue.",
        numbers: [
          { value: "~1.2M ops/s average fleet-wide, ~5M ops/s peak", explain: "The total volume this hop carries across every open document, aggregated fleet-wide." },
          { value: "30ms edge to owning region", explain: "The typical network latency this hop adds when the socket and the owner share a region." },
        ],
        breaks: {
          failure: "Clients elsewhere in the world pay a cross-region hop here.",
          handled: "A European editor on a US-homed document eats about 140ms of the 200ms budget in transit, and the design simply accepts it as the cost of a single transform site.",
        },
      },
    },
    {
      id: "e3",
      from: "owner",
      to: "transform",
      tier: "hot",
      step: 3,
      label: "gap ops from base_rev",
      detail: {
        what: "The owner handing the incoming operation plus the log slice from base_rev to current_rev to the transform.",
        why: "That slice is precisely the set of operations the sender had not seen. Folding through it one at a time, op' = T(op, gap[i]), produces an operation that expresses the same intent against the revision that actually exists now.",
        numbers: [{ value: "transform plus append budgeted at ~15ms", explain: "The compute-side share of the 200ms keystroke budget, small next to network transit." }],
        breaks: {
          failure: "Folding the gap in the wrong order silently produces a valid-looking operation that lands in the wrong place.",
          handled: "Nothing downstream will reject it on its own, which is why fold order is a strict, tested invariant rather than something left to implementation discretion.",
        },
      },
    },
    {
      id: "e4",
      from: "transform",
      to: "oplog",
      tier: "hot",
      step: 4,
      label: "append, majority write",
      detail: {
        what: "The transformed operation appended at the next revision, synchronously to a majority of replicas.",
        why: "This is the only part of the latency budget that is not physics, which is why it is the one worth optimising. It is also the durability boundary: everything before it can be retried, everything after it has been seen.",
        numbers: [
          { value: "p99 < 20ms majority-write completion", explain: "The only latency in the edit path not fixed by network RTT or disk fsync, so replica placement, not code, is what moves this number." },
          { value: "~20TB/day raw", explain: "The aggregate write volume this hop carries fleet-wide." },
        ],
        breaks: {
          failure: "Replica lag or a full disk fails the append after the author already saw the edit locally.",
          handled: "The operation is rejected rather than acknowledged, and the client sits in a 'saving' state, never showing a durability guarantee that was not actually met.",
        },
      },
    },
    {
      id: "e5",
      from: "oplog",
      to: "broadcast",
      tier: "hot",
      step: 5,
      label: "durable, then fan out",
      detail: {
        what: "The gate: fan-out only begins once the append has completed to a majority.",
        why: "Reverse these two and a crash leaves an edit visible on three screens and absent from storage. A broadcast cannot be undone, whereas a missing acknowledgement can always be retried, so the irreversible step goes second.",
        breaks: {
          failure: "The owner dies between the append and the broadcast, so some clients hold the newest operation and others do not.",
          handled: "The log has it, so a replacement replays and the gap is served on reconnect, and no client ever loses an operation it had already been shown.",
        },
      },
    },
    {
      id: "e6",
      from: "broadcast",
      to: "client",
      tier: "hot",
      step: 6,
      label: "remote_op + ack rev",
      offset: 90,
      detail: {
        what: "The transformed operation to every other editor, and to its author only the new revision number.",
        why: "The author applied that edit locally the moment it was typed, so sending the operation back would apply it twice. Every other client has to transform the arriving operation against its own pending buffer before it can be drawn.",
        numbers: [
          { value: "round-trip acknowledgement SLO p99 < 200ms", explain: "The end-to-end target from a client's edit to receiving its acknowledgement." },
          { value: "30ms out plus 40ms to the far client", explain: "The network share of that budget on a typical cross-client delivery." },
        ],
        breaks: {
          failure: "A client that applies this directly, without transforming against its own pending buffer, ends up permanently offset from everyone else.",
          handled: "The rev-plus-hash checksum every 200 operations is what catches it, forcing a full reload rather than letting the divergence persist silently.",
        },
      },
    },
    {
      id: "e7",
      from: "owner",
      to: "lease",
      tier: "control",
      label: "lease + heartbeat",
      detail: {
        what: "The owner asserting and renewing its exclusive claim on this doc_id, and the placement lookup that sent clients here in the first place.",
        why: "One transform site is a claim that has to be enforced by something outside the process making it. The heartbeat doubles as liveness: a lapsed lease is how owner death is noticed and reassignment starts.",
        numbers: [{ value: "reassignment SLO p99 < 30s", explain: "The time this heartbeat mechanism bounds a dead owner's replacement to." }],
        breaks: {
          failure: "A network partition that lets an owner keep serving while its lease expires elsewhere briefly creates two transform sites.",
          handled: "That is the exact condition the design cannot tolerate, so lease timeouts are set with wide margin against normal network jitter to avoid it.",
        },
      },
    },
    {
      id: "e8",
      from: "socket-edge",
      to: "presence",
      tier: "control",
      label: "cursor frames, 10 fps",
      detail: {
        what: "Cursor and selection frames peeled off the same socket and relayed without ever touching the owner or the log.",
        why: "Presence outnumbers edits and is worthless a second later. Handling it at the edge keeps hundreds of frames per dragged selection away from a single-threaded process that has real work to do.",
        numbers: [{ value: "excess beyond ~10 frames/s/client dropped at the edge", explain: "The rate limit this hop enforces before presence traffic can reach the document owner." }],
        breaks: {
          failure: "Throttling too aggressively makes other people's cursors visibly stutter.",
          handled: "Users read that as the document being slow even when every edit is landing inside budget, which is why the throttle rate itself is tuned rather than set arbitrarily low.",
        },
      },
    },
    {
      id: "e9",
      from: "presence",
      to: "client",
      tier: "control",
      label: "cursors, never logged",
      detail: {
        what: "Other editors' cursors and selections arriving for display, carrying no durable consequence.",
        why: "A cursor is an offset, and offsets move. The client shifts every local anchor by the same arithmetic the transform just used, which is why this path has to stay ordered against the edit stream.",
        breaks: {
          failure: "Skip the anchor arithmetic and typing while a collaborator edits above you drops your caret somewhere else.",
          handled: "Users report it as 'it jumped' and engineers routinely misdiagnose it as a rendering bug, which is why cursor anchoring is treated as part of the transform contract.",
        },
      },
    },
    {
      id: "e10",
      from: "oplog",
      to: "snapshotter",
      tier: "control",
      label: "every 1,000 ops",
      detail: {
        what: "The trigger and the source data: a run of operations since last_snapshot_rev, read back to materialise a full document.",
        why: "Without this the log grows without bound and open cost grows with it. Snapshotting is also what lets the online log tail be trimmed to about 7 days, with everything behind it archived.",
        numbers: [
          { value: "snapshot lag SLO < 1,000 operations", explain: "The maximum backlog this job is allowed to fall behind before it is considered degraded." },
          { value: "~140TB live tail", explain: "20TB/day x 7 days retention; snapshotting is what keeps this bounded, since a growing tail means every reopen replays more ops." },
        ],
        breaks: {
          failure: "If snapshotting falls behind, nothing visibly fails: editing carries on and document open time is what quietly degrades.",
          handled: "That is why snapshot lag is a paged metric rather than a dashboard one, catching the problem before a user notices a slow open.",
        },
      },
    },
    {
      id: "e11",
      from: "snapshotter",
      to: "snapshots",
      tier: "data",
      label: "full document blob",
      detail: {
        what: "The serialised document written under a temporary key, hash-verified, then published by atomically advancing the 'latest' pointer.",
        why: "A half-written snapshot that a client loads is worse than no snapshot at all. Publication is a pointer swap rather than an in-place overwrite, and the previous blob survives one cycle for rollback.",
        numbers: [
          { value: "~1.2PB total", explain: "10B hot docs x ~50KB x RF=3 = 1.5PB raw; ~20% dedup of shared boilerplate gets this to 1.2PB, the footprint this write path grows." },
          { value: "previous snapshot kept for 1 cycle", explain: "The rollback margin retained in case a freshly published snapshot turns out to be corrupt." },
        ],
        breaks: {
          failure: "An orphaned temporary blob from a writer that died before verification.",
          handled: "A sweeper runs to reclaim it, since the alternative is paying storage for debris nobody will ever read.",
        },
      },
    },
    {
      id: "e12",
      from: "snapshotter",
      to: "history",
      tier: "control",
      label: "coalesced revisions",
      detail: {
        what: "Runs of operations collapsed into named revisions at roughly one per minute of editing, written to the history store.",
        why: "Version history is a product surface, not a replay of the log, and building it from coalesced revisions is what keeps a year of history at ~180TB instead of 7.3PB.",
        numbers: [
          { value: "~400 operations per session become ~10 revisions", explain: "The typical compression this hop achieves on a real editing session." },
          { value: "40x reduction", explain: "The overall storage saving that makes a year of version history affordable to keep." },
        ],
        breaks: {
          failure: "Coalescing is lossy by design, so a user cannot scrub to an arbitrary keystroke.",
          handled: "The finest granularity the product can honestly offer is about a minute, which is disclosed rather than presented as finer than it is.",
        },
      },
    },
    {
      id: "e13",
      from: "snapshots",
      to: "offline",
      tier: "data",
      label: "snapshot + tail on open",
      detail: {
        what: "The document open path: fetch the latest verified snapshot, then replay only the operations after it.",
        why: "This is what makes load time independent of history depth. It is also the repair path for a checksum mismatch, where the client discards its state entirely and reloads from here.",
        numbers: [{ value: "costs at most 1 composed operation, ~0.5s of typing, on a forced reload", explain: "How little work a normal open actually costs once snapshots exist." }],
        breaks: {
          failure: "A large document still takes seconds to deserialise and lay out.",
          handled: "The snapshot is streamed and the viewport renders before the tail lands, so a user sees text quickly even while the rest of the document is still loading.",
        },
      },
    },
    {
      id: "e14",
      from: "offline",
      to: "owner",
      tier: "data",
      label: "buffered ops to rebase",
      offset: 60,
      detail: {
        what: "A reconnecting client sending last_received_rev and its accumulated local operations for rebasing against everything it missed.",
        why: "The client kept typing into its buffer for the whole outage, so those operations are all tagged against a revision that is now far behind. They have to be folded through the gap in order before any of them can land.",
        numbers: [{ value: "200 local ops against 1,500 remote is 300,000 transforms", explain: "The compute cost this rebase pays on a realistic worst-case reconnect gap." }],
        breaks: {
          failure: "The merged output is expressed as character-level operations, so the preview shown past the gap threshold is a before-and-after of the merged text.",
          handled: "It cannot say 'your third paragraph lost its second sentence', so a user accepting or rejecting the merge is working from raw text, not from a narrated explanation.",
        },
      },
    },
    {
      id: "e15",
      from: "oplog",
      to: "owner",
      tier: "control",
      label: "replay to current_rev",
      offset: 60,
      detail: {
        what: "A replacement owner reading the log forward from the last snapshot to rebuild the document and the revision counter after acquiring the lease.",
        why: "Because the append precedes the broadcast, the log is by construction at least as far ahead as any client. Rebuilding from it is what guarantees nobody loses a keystroke they saw acknowledged.",
        numbers: [
          { value: "RTO ~10-30s within a region", explain: "The recovery time this replay achieves after an owner dies." },
          { value: "RPO ~0s within a region", explain: "No acknowledged operation is ever lost, because the log is always at least as current as any client." },
        ],
        breaks: {
          failure: "The read-only window during reassignment.",
          handled: "Clients keep typing into their local buffers for 10 to 30 seconds and those buffers keep growing, so the rebase on the far side is larger the longer failover takes.",
        },
      },
    },
  ],
};
