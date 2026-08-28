import type { Diagram } from "./types";

export const GOOGLE_DRIVE: Diagram = {
  id: "google-drive",
  title: "Google Drive",
  question: "Design Google Drive (Dropbox)",
  sourceId: "patterns",
  itemId: 12,
  overview: {
    shape:
      "The file is not the unit. Every file is sliced into 4MB chunks named by the SHA-256 of their bytes, so sync becomes a conversation about hashes rather than a transfer of files, and the bytes only move for the chunks nobody already holds.",
    beats: [
      "The client is where the difficulty lives, and it is one program rather than a tier: a filesystem watcher, a local index holding three trees, and a chunker, all in one process on hardware you do not control. Diffing against the third tree, the last state at which local and server were known to agree, is the only way to tell 'I deleted this' from 'they created this'.",
      "Chunking and hashing turn a file into an ordered list of 4MB SHA-256 hashes. That one move buys delta sync, resumable upload and cross-user dedup at the same time, because a chunk that two users happen to share collides by construction rather than because anybody built a dedup feature.",
      "Upload is a handshake, not a transfer. The client sends the hash list, the server answers with only the subset it lacks, and the client uploads that. A 1GB corporate installer is 250 chunks of which perhaps 10 are user-specific, so roughly 40MB crosses the wire instead of 1GB.",
      "Metadata and bytes are deliberately different systems. Metadata is small, mutable, transactional and needs ordering, at roughly 18PB replicated; chunks are large, immutable and need durability, at roughly 11EB. Two orders of magnitude apart in size and opposite in every access property, so they get separate stores.",
      "Commit is a compare and swap on the parent version, and that single operation is also the conflict detector. It writes the version row, increments chunk refcounts and appends one journal entry in one transaction. The ordering is not negotiable: chunks durable, then commit, then notify.",
      "Convergence runs off the journal, an append-only log per namespace with a monotonic id. A device stores a cursor and asks for everything after it, so a sync costs O(changes) rather than O(files), which is the whole reason a 10M-file namespace is syncable at all. The pub/sub bus and the socket fleet above it only make that poll arrive sooner, which is exactly why they are allowed to lose messages.",
    ],
    crux:
      "The system cannot read the files. It sees opaque bytes with no notion of a line or a paragraph, so there is no merge function, so two devices that edited the same file offline genuinely cannot be reconciled. The design's job is to make conflicts rare and then hand the survivors to a human as a second file on disk.",
    numbers: [
      "4MB fixed chunks, SHA-256",
      "~40% dedup: 10EB raw to ~6EB distinct",
      "~100k conflict copies/day",
    ],
  },
  nodes: [
    {
      id: "sync-agent",
      label: "Sync agent (client-side)",
      kind: "serviceGroup",
      x: 16,
      y: 10,
      w: 624,
      h: 394,
      detail: {
        what: "One program on the user's laptop or phone: the filesystem watcher, the three-tree diff, the local index that holds those trees plus the journal cursor, and the chunker that hashes and uploads.",
        why: "Drawn as one service made of stages rather than as several peers, because that is what it is. It ships as a single binary, the stages share memory and a process lifetime, and a crash takes all of them together. Nearly all the difficulty of the product lives in here, and it is the one component running on hardware you do not control, which is why the server treats everything it says as a claim rather than a fact.",
        numbers: ["~2.5 devices per user", "one cursor per namespace", "~10k files, ~10GB per user"],
        breaks:
          "It is the only part of the system that ever holds a whole file, so every bug here shows up as user data that silently failed to sync. Nothing server-side can see that it happened.",
      },
    },
    {
      id: "watcher",
      label: "Filesystem watcher",
      sub: "OS events + periodic rescan",
      kind: "process",
      x: 40,
      y: 60,
      w: 280,
      detail: {
        what: "The stage that learns a local file changed: OS change notifications for latency, plus a periodic full rescan of the tree as the backstop.",
        why: "It is the only input to the whole upload path, and it is unreliable by construction. Separating it from the diff matters because the two fail differently: the watcher loses events, the diff misreads the events it gets.",
        numbers: [
          "full rescan of a 500k-file tree is minutes of disk I/O",
          "rescan on a timer and after every reconnect",
        ],
        breaks:
          "All three major OS watchers coalesce under load and drop events, and none guarantees a rename arrives as a rename, so a folder rename can surface as 10k deletes followed by 10k creates. Version history breaks and the bytes re-upload.",
        choice: {
          pick: "Treat the watcher as a latency optimisation and the periodic rescan as correctness",
          instead:
            "Trusting the watcher alone, or dropping it and polling the tree on a timer with no watcher at all.",
          decider:
            "What it costs to be wrong against what it costs to check. A rescan of a 500k-file tree is minutes of disk I/O, so you cannot run it often; a dropped event is permanent divergence, so you cannot skip it. Running both gets sub-second latency in the common case and bounded divergence in the bad one, at the price of a real detection window nobody can close.",
          flips:
            "A platform with a reliable change journal such as NTFS USN, where the OS itself hands you an ordered, gap-free log and the rescan drops back to a rare repair tool.",
        },
      },
    },
    {
      id: "three-tree",
      label: "Three-tree diff",
      sub: "local vs synced vs server",
      kind: "process",
      x: 40,
      y: 170,
      w: 280,
      detail: {
        what: "Decides what actually changed by diffing three views of the folder: the local filesystem now, the server state as of the cursor, and `synced`, the last state at which the two were known to agree.",
        why: "This is the stage that makes the diff decidable. Local against synced yields local changes, server against synced yields remote changes, a path in both is a conflict, a path in neither is untouched. With only local and server you cannot distinguish 'I deleted this' from 'they created this', which is where nearly every sync bug in this class comes from.",
        numbers: ["3 trees, not 2", "a path in both diffs is a conflict", "renames matched on content hash + size"],
        breaks:
          "Run against a partially-populated local tree, say an external drive that has not mounted, and the diff concludes the user deleted everything. The client has to refuse when the root is missing or the file count drops past a threshold, and ask instead.",
        choice: {
          pick: "Keep three trees and diff against the last agreed state",
          instead: "Two trees, local and server, deciding by timestamp or by whichever side looks newer.",
          decider:
            "Whether delete and create are distinguishable at all. With two trees a path present on the server and absent locally is exactly as consistent with 'I deleted it' as with 'they just created it', and no timestamp settles it because a delete leaves nothing to stamp. The third tree makes it a lookup rather than a guess, and it costs one extra copy of the metadata, kilobytes per thousand files.",
          flips:
            "Nothing at this scope. Two trees only work where deletes are impossible or the client is never the authority for them, which is a different product.",
        },
      },
    },
    {
      id: "local-index",
      label: "Local index",
      sub: "three trees + journal cursor",
      kind: "database",
      x: 360,
      y: 170,
      w: 260,
      detail: {
        what: "The client's own durable store: the three trees, each file's ordered chunk list, and the cursor into every namespace's journal.",
        why: "The cursor has to survive a reboot or reconnection restarts from nothing, and the synced tree has to survive it or there is no third tree to diff against. Persisting them is what turns a restart into a resumed sync rather than a full rescan.",
        numbers: ["~10k files per user, ~500B of local metadata each", "one cursor row per namespace"],
        breaks:
          "Lose or corrupt it and the client has no synced tree and no cursor, so it falls back to a full tree diff against the server manifest, which is the expensive path the journal exists to avoid and the one that can conclude the user deleted everything.",
      },
    },
    {
      id: "chunker",
      label: "Chunker + uploader",
      sub: "4MB fixed, SHA-256",
      kind: "process",
      x: 360,
      y: 300,
      w: 260,
      detail: {
        what: "Splits each changed file into 4MB chunks, hashes every chunk with SHA-256, runs the have_blocks handshake, uploads the missing chunks and then sends the commit.",
        why: "Naming a chunk by its content is the move the whole design rests on. Identical bytes collide everywhere in the system for free, so delta sync, resumable upload and cross-user dedup all fall out of one decision rather than being three features.",
        numbers: [
          "4MB chunks, files under 4MB stored whole",
          "1GB file = 256 chunks = 8KB of hash list",
          "SHA-256 at 1 to 2 GB/s per core with hardware acceleration",
        ],
        breaks:
          "Fixed offsets are catastrophic for inserts: 10 bytes added at offset 0 of a 1GB file shifts all 256 boundaries and re-uploads the whole gigabyte.",
        choice: {
          pick: "Fixed 4MB offsets, each chunk hashed with SHA-256",
          instead:
            "Content-defined boundaries from a rolling hash (Rabin or buzhash), averaging 1MB with a 512KB floor and 8MB ceiling.",
          decider:
            "What fraction of modified bytes come from edits that change a file's length in the middle. A 10-byte insert at offset 0 of a 1GB file costs 1GB fixed against roughly 2MB content-defined, a 500x difference on that one operation. Content-defined costs a second pass over every byte, roughly halving the 1 to 2 GB/s hashing rate, which is battery on a phone. Below about 5% length-changing edits fixed wins; above about 20% you are losing whole files to single inserts.",
          flips:
            "A corpus edited in the middle: source trees, design assets, or a backup product ingesting VM images and database files, which is why restic, borg and rsync all use content-defined boundaries.",
        },
      },
    },
    {
      id: "meta-svc",
      label: "Metadata service",
      sub: "handshake + CAS commit",
      kind: "service",
      x: 720,
      y: 170,
      w: 280,
      detail: {
        what: "Answers the have_blocks handshake with the hashes it lacks, then applies the commit as a compare and swap on the parent version and publishes the result.",
        why: "It is the only component that decides anything. Every other box either moves bytes or carries news, so all ordering, all authorisation and all conflict detection have to live in the one place that can run a transaction.",
        numbers: [
          "commit carries (file_id, parent_version, chunk_list)",
          "409 returns the current version",
          "~100k conflict copies/day",
        ],
        breaks:
          "Ordering. Commit before the chunks are durable and you publish a version pointing at bytes nobody has; notify before commit and a device is told about a version that does not exist yet.",
        choice: {
          pick: "Last writer wins on a version compare and swap, with the loser preserved as a conflict copy",
          instead:
            "A three-way merge against the common ancestor, dispatched by format, with unrecognised formats falling back to a conflict copy.",
          decider:
            "What fraction of conflicting files have a defined merge function, weighed against the asymmetry of being wrong. A conflict copy costs a user two minutes; a bad merge is silent corruption they may not notice for six months. At ~100k conflicts/day, 20% mergeable coverage is 20k merges/day, and a 1-in-1000 bad merge is 20 corrupted files a day, which is not a rate a storage product survives.",
          flips:
            "When you own the format. A notes app, a code host or a design tool with its own document model should merge, because coverage is 100% and the merge is testable against a fixed grammar.",
        },
      },
    },
    {
      id: "journal",
      label: "Server file journal",
      sub: "append-only, monotonic jid",
      kind: "queue",
      x: 720,
      y: 430,
      w: 280,
      detail: {
        what: "An append-only log per namespace of every operation (create, modify, move, delete), each stamped with a monotonically increasing id, read by cursor.",
        why: "This is the property that makes sync scale, and it is the only durable half of change propagation. A device persists its cursor and asks for everything after it, so reconnection costs O(changes since last sync) and is completely independent of how many files the namespace holds.",
        numbers: [
          "~1B entries/day at ~100B each = ~100GB/day",
          "90 days retention = ~9TB",
          "10M-file namespaces sync in O(changes)",
        ],
        breaks:
          "A device away longer than the retention window falls off the end and has to fall back to a full tree diff, which is minutes of work on both ends and exactly the path the journal exists to avoid.",
        choice: {
          pick: "A per-namespace append-only log with a monotonic id, read by cursor",
          instead: "Comparing directory listings between client and server on each sync.",
          decider:
            "Cost as a function of tree size. Listing comparison is O(total files) and is already unusable at the 10k files an average user holds, let alone the 10M-file namespaces enterprise tenants build. The journal is O(changes), and at ~1B entries/day and 90 days retention the whole log is ~9TB, which is trivially cheap.",
          flips:
            "Namespaces small enough that a full listing is a single cheap request, where a log is state you have to retain and expire for no benefit.",
        },
      },
    },
    {
      id: "notify",
      label: "Notify service",
      sub: "WebSocket fleet",
      kind: "service",
      x: 720,
      y: 580,
      w: 280,
      detail: {
        what: "The fleet holding one persistent socket per connected device, consuming from the bus and pushing 'namespace advanced to jid N' down the sockets that care.",
        why: "It is an accelerator and never a correctness mechanism. Because clients poll the journal regardless, this path is allowed to be lossy, unordered and best-effort, which is precisely what lets it be cheap at this fan-out.",
        numbers: [
          "~12k events/s steady, ~60k/s at business-hours peak",
          "fan-out x2.5 devices per user, more for shared folders",
          "one socket held open per connected device",
        ],
        breaks:
          "A sync storm: one member refactoring 100 files in a folder with 50 collaborators is 5000 pushes unless they are debounced into one 'namespace advanced' message per device.",
        choice: {
          pick: "Best-effort push over persistent sockets, with clients polling the journal anyway",
          instead: "Treating the push as the authoritative change signal, or pure polling with no push at all.",
          decider:
            "What class of bug a lost message becomes. With polling underneath, a dropped push is a latency bug the next poll repairs; without it, the same drop is permanent divergence. Keeping the poll is what allows this 12k events/s path to be unreliable and therefore cheap.",
          flips:
            "A tiny deployment where polling every few seconds is affordable outright, so the socket fleet is pure operational cost.",
        },
      },
    },
    {
      id: "pubsub",
      label: "Notify bus",
      sub: "topic per namespace",
      kind: "queue",
      x: 1120,
      y: 320,
      w: 260,
      detail: {
        what: "The pub/sub topic the metadata service publishes to on commit, and the notify fleet subscribes to. Carries `{ namespace_id, jid }` and nothing else.",
        why: "It decouples the transaction from the fan-out. The commit path must not wait on, or fail because of, however many sockets happen to be open for a 500-member shared folder, and the socket fleet must be able to scale and restart without the metadata tier knowing. Sending the id rather than the change is what allows a 100-file refactor to collapse into one message per namespace instead of 100 fanned to 50 collaborators.",
        numbers: ["~12k messages/s steady, ~60k/s peak", "payload is an id, not a change"],
        breaks:
          "It is fire-and-forget on purpose, so a partition or a slow consumer silently drops events and every affected device is stale until its next poll. That is only survivable because the poll exists; treat this as durable delivery and you have hidden a correctness bug behind a metric.",
        choice: {
          pick: "An ephemeral topic keyed by namespace, fanned out at read time by the socket fleet",
          instead: "A durable per-device queue, so a disconnected device finds its notifications waiting.",
          decider:
            "Whether you already have the durable copy. 1B operations/day times ~2.5 devices is ~2.5B messages/day, and making those durable and per-device is a second storage system with its own retention, at the size of the thing it duplicates. The journal already is that system, and it is retained for 90 days rather than for the length of a disconnect, so the durable inbox buys nothing the cursor does not already give you.",
          flips:
            "A product with no pull path at all, such as a push-only device fleet that cannot poll, where the queue is the only delivery guarantee there is.",
        },
      },
    },
    {
      id: "block-svc",
      label: "Block service",
      sub: "PUT /chunk/{hash}",
      kind: "service",
      x: 720,
      y: 710,
      w: 280,
      detail: {
        what: "Receives the chunks the handshake said were missing, verifies the bytes actually hash to the claimed key, writes them to the object store and registers them in the chunk index.",
        why: "Chunks are immutable and content-addressed, so this path needs no transactions and no ordering at all. That is exactly what lets uploads run fully parallel and lets a partial upload survive a process restart or resume on a different device.",
        numbers: [
          "per-chunk acks, resume from the last acked chunk",
          "~10TB/day net new, ~30TB/day after 3x replication",
        ],
        breaks:
          "Trusting a client's claim to already hold a hash turns that hash into an access token, so anyone who obtains one can attach another user's chunk to their own file and read it.",
        choice: {
          pick: "Per-user dedup by default, plus global dedup with a proof-of-possession challenge above a size threshold",
          instead:
            "Believing the client's have_blocks list unconditionally, or restricting dedup to the user's own chunks always.",
          decider:
            "How much of the dedup win survives the mitigation. Cross-user dedup is around 30% consumer and 50 to 80% inside a corporate tenant, but most of that is intra-tenant, so per-user or per-tenant keyspaces sacrifice far less than the headline suggests. Challenging for a random 4KB range costs one round trip and proves possession, which is worth paying only where the bandwidth saved is large.",
          flips:
            "When privacy is the product. Client-side encryption with user keys kills all cross-user dedup and is the honest answer there.",
        },
      },
    },
    {
      id: "chunk-index",
      label: "Chunk index",
      sub: "hash to size, refcount, location",
      kind: "database",
      x: 1120,
      y: 60,
      w: 260,
      detail: {
        what: "A key-value store mapping chunk_hash to its size, reference count and blob location. This is what the handshake queries.",
        why: "The existence question has to be answerable in a single key lookup, because it runs once per chunk of every upload before any bytes move. Keeping it separate from the metadata DB means the handshake never touches the transactional tier.",
        numbers: ["one key per distinct chunk across ~6EB of distinct bytes", "single-key lookup per chunk"],
        breaks:
          "Refcounts drift from the actual metadata references, so a counter that reaches zero wrongly deletes a live chunk. The counter is a fast path, never the truth.",
        choice: {
          pick: "A key-value store keyed by chunk hash, kept out of the metadata database",
          instead: "Rows in the same transactional store that holds files and versions.",
          decider:
            "Access pattern and blast radius. This is uniform single-key reads at upload rate with no joins and no ordering requirement, against a metadata tier that is already ~18PB and needs transactions. Putting the handshake on that tier means every upload probe competes with commits.",
          flips:
            "Deployments small enough that one database serves both, where a second store is operational cost for a query pattern Postgres would handle fine.",
        },
      },
    },
    {
      id: "metadata-db",
      label: "Metadata DB",
      sub: "sharded by namespace",
      kind: "database",
      x: 1120,
      y: 170,
      w: 260,
      detail: {
        what: "The transactional store holding files, versions, chunk lists and ACLs, sharded by namespace rather than by user.",
        why: "It stores the logical description of the tree and never a byte of file content, which is what allows reasoning about what changed to cost kilobytes. Chunk lists live in their own table because a 1TB file is 256k rows and will not fit in one.",
        numbers: [
          "~10T file rows at ~500B = 5PB",
          "chunk lists ~1PB at 32B per hash, 3 versions",
          "~6PB logical, ~18PB replicated",
        ],
        breaks:
          "Moves across namespace boundaries are not atomic. Dragging a folder out of a shared team folder into your private root is a copy plus a delete across two independent journals, so file ids change and version history resets.",
        choice: {
          pick: "Shard by namespace: a private root is one, every shared folder is another, mounted into each member's tree",
          instead: "Shard by user_id and replicate a shared folder's metadata into every member's shard.",
          decider:
            "Members per shared folder multiplied by change rate. A 500-member folder taking a 10k-file bulk edit is 5M metadata writes under per-user sharding against 10k under namespaces, and those 5M have to be transactional across 500 shards. Break-even is around 5 members; above about 50 it dominates the metadata tier.",
          flips:
            "Purely consumer products where sharing is rare, small and read-mostly. Per-user sharding also buys atomic moves anywhere in the tree, which namespaces genuinely give up.",
        },
      },
    },
    {
      id: "object-store",
      label: "Object store",
      sub: "key = SHA-256 of chunk",
      kind: "blob",
      x: 1120,
      y: 860,
      w: 260,
      detail: {
        what: "The blob tier holding raw chunk bytes keyed by their hash, tiered from SSD-backed hot storage to erasure-coded cold.",
        why: "This is the half you buy rather than build. Chunks are immutable and content-addressed, which is exactly the workload an object store sells, and rebuilding it is answering a different question by accident.",
        numbers: [
          "~6EB distinct after ~40% dedup, ~11EB stored",
          "hot 3x replicated, cold Reed-Solomon 10+4 at 1.4x",
          "~300PB hot tier, provisioned to ~500PB",
        ],
        breaks:
          "A chunk unavailable in one region stalls every file that references it, so reads have to retry against an alternate region and recache lazily.",
        choice: {
          pick: "Buy an object store: hot bytes 3x replicated, cold erasure coded at 10+4",
          instead: "Build the storage layer, choosing placement, replication factor and durability arithmetic yourself.",
          decider:
            "Where the product actually is. Storage is the easy half and it is purchasable; the tiering is worth reasoning about because the cold tier is 7EB of hardware, since 6EB at 3x everywhere is 18EB against ~11EB tiered. The convergence protocol on top is the part nobody sells you.",
          flips:
            "When storage economics are the business, at which point you are answering the object-store question directly rather than this one.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "GET /chunk/{hash}",
      kind: "gateway",
      x: 360,
      y: 860,
      w: 260,
      detail: {
        what: "The edge tier chunk reads hit first, keyed by the same content hash the rest of the system uses, falling through to the object store on a miss.",
        why: "Content addressing makes caching trivially safe: a chunk's bytes can never change under its key, so there is no invalidation problem and an edge can hold it forever. That is what makes a widely shared template survivable.",
        numbers: ["a hot chunk collapses thousands of fetches to one origin read", "4MB immutable objects, no TTL logic"],
        breaks:
          "A hot chunk requested by thousands of users at once melts the origin if the edge misses, which is the one read-side thundering herd this system has.",
        choice: {
          pick: "Serve chunk reads from a CDN edge, cached by content hash",
          instead: "Reading every chunk from the object store directly.",
          decider:
            "Fan-out on shared content. A widely shared template chunk is requested by thousands of users in the same window, and each is an identical immutable 4MB read. Edge caching turns that into one origin fetch with no invalidation logic, because the key already guarantees the bytes.",
          flips:
            "A corpus with no sharing at all, where every chunk is read by one user and the edge hit rate never justifies the tier.",
        },
      },
    },
    {
      id: "devices",
      label: "Other devices",
      sub: "same agent, own cursor",
      kind: "client",
      x: 40,
      y: 580,
      w: 280,
      detail: {
        what: "The user's other machines and every collaborator's machine. Each runs the identical sync agent drawn above, with its own local index and its own cursor per namespace.",
        why: "They are drawn explicitly because they set the constraints the rest answers to: a week offline is the baseline case, not the edge case, and they are the reason convergence has to be pull-driven rather than push-driven. The agent above is just the one that happened to write.",
        numbers: ["~2.5 devices per user", "downloads only the chunks the local tree lacks", "a 4MB edit to a 200MB file costs 4MB"],
        breaks:
          "A full tree diff against a partially-populated local tree, say an external drive that has not mounted, concludes the user deleted everything, so the client must refuse and ask instead.",
      },
    },
    {
      id: "gc",
      label: "Refcount GC",
      sub: "nightly sweep + mark-and-sweep",
      kind: "service",
      x: 1480,
      y: 170,
      w: 260,
      detail: {
        what: "Decrements refcounts when versions expire, deletes refcount-zero chunks after a grace period, and periodically recomputes reachability from the metadata store.",
        why: "Chunks are written before any version references them and outlive every version that did, so nothing else in the design has a reason to delete a byte. Without this the store only grows.",
        numbers: ["7-day grace period before deletion", "weekly mark-and-sweep against the metadata store"],
        breaks:
          "Deleting on a drifted refcount destroys a chunk that live versions still reference, and content addressing means every file sharing those bytes breaks at once.",
        choice: {
          pick: "Refcounts as the fast path, with a periodic mark-and-sweep as the truth",
          instead: "Refcounts alone, or mark-and-sweep alone with no counters.",
          decider:
            "Whether you can afford to scan. A full reachability scan over ~10T file rows is not something you run nightly, and refcounts alone drift under concurrent commits and version expiry. Counters plus a 7-day grace window make the common case cheap, and the weekly sweep catches the drift before anything is deleted wrongly.",
          flips:
            "A corpus small enough to scan continuously, where the counters are pure complexity and reachability is always current.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "watcher",
      to: "three-tree",
      label: "changed paths",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Paths the OS reported as changed, handed to the diff to be interpreted.",
        why: "The watcher reports events; only the diff can say what they mean. Keeping the hand-off explicit is what lets the diff treat an incoming event as a hint rather than as truth, and re-derive the answer from the trees.",
        numbers: ["events coalesce under load", "rescan supplies what the events missed"],
        breaks:
          "If the watcher missed the event this edge never fires, and the file is silently unsynced until the next full rescan closes the window.",
      },
    },
    {
      id: "e2",
      from: "three-tree",
      to: "local-index",
      label: "reads three trees",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The diff reading the synced and server trees out of the local index, and writing back the new synced state once a commit is acknowledged.",
        why: "`synced` only advances when the server has confirmed, which is what makes it a statement about agreement rather than about intent. Advancing it optimistically is how a failed upload turns into a silently lost edit.",
        numbers: ["synced advances only on ack", "cursor advances only after a replayed range is applied"],
        breaks:
          "Advancing the cursor before the range is applied loses those operations permanently, because the journal is never re-read below the cursor.",
      },
    },
    {
      id: "e3",
      from: "three-tree",
      to: "chunker",
      label: "changed files to hash",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The set of files the diff decided genuinely changed locally, handed to the chunker.",
        why: "The diff runs on metadata and costs nothing; chunking reads every byte of the file. Deciding what changed before touching bytes is what keeps an idle folder free and a 10k-file rename cheap.",
        numbers: ["local vs synced yields local changes", "a rename ideally moves no bytes at all"],
        breaks:
          "A rename the diff failed to recognise arrives here as an unrelated delete plus create, so the whole file re-hashes and re-uploads and its version history restarts.",
      },
    },
    {
      id: "e4",
      from: "chunker",
      to: "meta-svc",
      label: "have_blocks([h1..hN])",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The ordered hash list for the changed file, sent before any bytes move.",
        why: "Turning upload into 'which of these do you already have' rather than 'here it is' is the single biggest efficiency win in the system, and it costs 32 bytes per 4MB of file to ask.",
        numbers: ["32B per hash", "1GB file = 256 hashes = 8KB of question"],
        breaks:
          "This list is a claim by software on a stranger's laptop, so the server cannot treat 'I have h' as proof of possession.",
      },
    },
    {
      id: "e5",
      from: "meta-svc",
      to: "chunker",
      label: "missing hashes only",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      offset: 60,
      detail: {
        what: "The subset of hashes the server does not hold, returned to the client.",
        why: "This reply is where the dedup saving is actually realised. In a corporate tenant a 1GB installer collapses to about 40MB of transfer because 240 of its 250 chunks already exist from prior uploads.",
        numbers: ["~30% dedup consumer, 50 to 80% corporate", "1GB installer to ~40MB transferred"],
        breaks:
          "Answering it honestly for chunks the user never uploaded leaks information: chunk existence becomes an oracle for 'someone else has this file'.",
      },
    },
    {
      id: "e6",
      from: "chunker",
      to: "block-svc",
      label: "PUT missing chunks",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The bytes of the missing chunks, uploaded in parallel with a per-chunk ack.",
        why: "Chunks are immutable and unreferenced until commit, so they can go up in any order, from any device, across any number of connections. That is what makes a 10GB upload over flaky mobile resumable.",
        numbers: ["resume from the last acked chunk", "4MB bounds a single retransmit"],
        breaks:
          "Chunks uploaded and never committed are garbage until GC collects them, so an abandoned upload leaks storage for the grace period.",
      },
    },
    {
      id: "e7",
      from: "block-svc",
      to: "object-store",
      label: "store under its hash",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Writing the chunk bytes into the blob tier under key = SHA-256 of those bytes.",
        why: "Content addressing means two users uploading the same bytes write the same key, so dedup is a property of the naming scheme rather than a feature anybody implemented.",
        numbers: ["~10TB/day net new, ~30TB/day after replication"],
        breaks:
          "This write must be durable before the commit lands, or the commit publishes a version pointing at bytes nobody holds.",
      },
    },
    {
      id: "e8",
      from: "block-svc",
      to: "chunk-index",
      label: "register hash + location",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Recording that the chunk now exists, with its size and blob location.",
        why: "The index entry is what makes the next handshake answer 'present' for this chunk. It goes in after the blob write, so the index never advertises a chunk the store cannot serve.",
        numbers: ["one key write per genuinely new chunk"],
        breaks:
          "Registering before the blob is durable means a later handshake tells a client not to upload bytes the system has actually lost.",
      },
    },
    {
      id: "e9",
      from: "chunker",
      to: "meta-svc",
      label: "commit(parent_version)",
      fromSide: "right",
      toSide: "left",
      offset: 40,
      detail: {
        what: "The commit carrying file_id, parent_version and the full ordered chunk list, sent only once every chunk is durable.",
        why: "This is the atomic step and the only place a conflict can be detected. Sending the parent version rather than just the new state is what turns concurrent editing into a detectable event instead of a silent overwrite.",
        numbers: ["applied only if current version still equals parent_version", "409 returns the current version"],
        breaks:
          "A failed compare and swap is the conflict, and the loser's bytes become a sibling conflict copy named for the losing device, because merging two divergent edits to a binary format produces corruption rather than a merge.",
      },
    },
    {
      id: "e10",
      from: "meta-svc",
      to: "chunk-index",
      label: "lookup hashes",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "One key lookup per submitted hash to decide which chunks already exist.",
        why: "The handshake has to be answerable without touching the transactional tier or the bytes themselves, which is why the existence question lives in its own key-value store.",
        numbers: ["single-key read per chunk of every upload"],
        breaks:
          "A slow index turns the handshake into the bottleneck of every upload, including the ones where nothing needs transferring at all.",
      },
    },
    {
      id: "e11",
      from: "meta-svc",
      to: "metadata-db",
      label: "version row + refcounts",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "One transaction writing the version row, incrementing chunk refcounts and appending the journal entry.",
        why: "All three have to happen together or not at all. A version without its journal entry never propagates, and refcounts incremented outside the transaction drift the moment a commit fails partway.",
        numbers: ["~500B per file row", "32B per chunk hash, ~3 retained versions"],
        breaks:
          "This tier is sharded by namespace, so a move between namespaces spans two shards and two journals and cannot be made atomic at all.",
      },
    },
    {
      id: "e12",
      from: "meta-svc",
      to: "journal",
      label: "append one entry",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The committed operation appended to the namespace journal with the next monotonic id, inside the same transaction as the version row.",
        why: "The journal entry is the canonical statement that something changed. A conflict copy is written as an ordinary create precisely so it gets an entry here and propagates by the normal mechanism with no special case downstream.",
        numbers: ["~1B entries/day across 1B namespaces", "~10 file operations per active user-day"],
        breaks:
          "Ordering within a namespace is the guarantee clients depend on, so any gap or reordering in the ids breaks replay on every device holding a cursor.",
      },
    },
    {
      id: "e13",
      from: "meta-svc",
      to: "pubsub",
      label: "publish {ns, jid}",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A fire-and-forget publish, after the commit is durable, saying a namespace has moved to journal id N.",
        why: "Strictly last in the ordering, and strictly outside the transaction. Publishing before the commit tells a device about a version that does not exist yet; blocking the commit on the publish makes the interactive write path depend on the fan-out tier being healthy.",
        numbers: ["~12k publishes/s steady, ~60k/s peak", "one message per namespace, not per file"],
        breaks:
          "Nothing retries it. A publish lost here is invisible to the metadata tier, and the only thing that repairs it is the client's next poll.",
      },
    },
    {
      id: "e14",
      from: "pubsub",
      to: "notify",
      label: "fan out to sockets",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The socket fleet consuming the topic and resolving one message into the set of connected devices that subscribe to that namespace.",
        why: "The fan-out has to happen here rather than at publish time, because only this tier knows which devices are currently connected, and that set changes far faster than the commit rate.",
        numbers: ["x2.5 devices per user, far more for a shared folder", "5000 pushes debounced to one per device"],
        breaks:
          "A shared folder with 500 members turns one message into 500 socket writes, so a bulk edit here is where a sync storm actually lands.",
      },
    },
    {
      id: "e15",
      from: "notify",
      to: "devices",
      label: "push over WebSocket",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The push telling connected devices to pull the journal now rather than at their next poll.",
        why: "It exists purely to cut the gap between commit and convergence. Because it decides nothing, it is allowed to be lossy and unordered, and a dropped message costs latency rather than correctness.",
        numbers: ["carries an id, not a change", "a disconnected device gets nothing and does not need to"],
        breaks:
          "A device that treated this as its only signal would diverge permanently on a single dropped message, which is why the pull below is not optional.",
      },
    },
    {
      id: "e16",
      from: "devices",
      to: "journal",
      label: "GET /journal?since=cursor",
      animated: true,
      fromSide: "top",
      toSide: "left",
      detail: {
        what: "The pull: everything after the device's stored cursor for that namespace, replayed in order.",
        why: "This is the actual convergence mechanism and it runs whether or not a push arrived. Cost is proportional to what changed, which is what makes a 10M-file namespace syncable after a week offline.",
        numbers: ["O(changes), not O(files)", "90 day retention window"],
        breaks:
          "A cursor older than the retention window falls back to a full tree diff, which is minutes of CPU and disk and risks concluding the user deleted everything if the local tree is not fully mounted.",
      },
    },
    {
      id: "e17",
      from: "devices",
      to: "cdn",
      label: "fetch missing chunks",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Delta download: the device fetches only the chunks in the new version that its local tree lacks.",
        why: "The replayed journal gives it a chunk list, and it already knows which hashes it holds, so the download is a set difference. Editing 4MB of a 200MB video costs 4MB on every other device.",
        numbers: ["4MB downloaded for a 4MB edit to a 200MB file"],
        breaks:
          "Chunks can be fetched speculatively before the commit is visible, which halves the wall-clock gap on large files but means some fetched chunks are discarded.",
      },
    },
    {
      id: "e18",
      from: "cdn",
      to: "object-store",
      label: "origin fetch on miss",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The edge pulling a chunk it does not hold from the blob tier.",
        why: "It is drawn as the rare path on purpose. For shared content the edge absorbs almost all of the fan-out, so origin sees one fetch per hot chunk rather than thousands.",
        numbers: ["one origin read per hot chunk per edge"],
        breaks:
          "A cold chunk that has aged into the erasure-coded tier takes seconds to warm up, so the first reader after a long idle period pays a latency the hot path never sees.",
      },
    },
    {
      id: "e19",
      from: "metadata-db",
      to: "gc",
      label: "expired versions",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Version expiry and file purges feeding refcount decrements, plus the full reachability scan the sweep runs against.",
        why: "The metadata store is the only component that knows which chunks are still referenced, because a chunk itself carries no back-pointer to the files using it. Reachability has to be computed from this side.",
        numbers: ["~3 retained versions per file", "weekly mark-and-sweep"],
        breaks:
          "Reading this while commits are in flight gives a snapshot that undercounts references, which is exactly why deletion waits out a grace period rather than acting on one scan.",
      },
    },
    {
      id: "e20",
      from: "gc",
      to: "object-store",
      label: "delete refcount-zero",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "Deleting chunks whose reference count has been zero for longer than the grace period.",
        why: "Chunks outlive the versions that created them and nothing else has a reason to remove them, so this is the only path in the design that frees storage.",
        numbers: ["7-day grace period covers undelete and refcount bugs"],
        breaks:
          "Deleting on a wrong count destroys bytes shared by every file that referenced them, so the sweep verifies against metadata before anything is removed.",
      },
    },
    {
      id: "e21",
      from: "gc",
      to: "chunk-index",
      label: "verify counts",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Comparing stored refcounts against the reachability the sweep computed, and correcting the drift.",
        why: "The counter is a fast path that lets commit avoid a scan, not the truth. Treating it as truth is how a live chunk gets deleted, so it is reconciled rather than trusted.",
        numbers: ["orphan-chunk count and refcount drift are paged on"],
        breaks:
          "Drift in the safe direction leaks storage quietly, so the metric matters as much as the repair: nobody notices orphans until the bill does.",
      },
    },
  ],
};
