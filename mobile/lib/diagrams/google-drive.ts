import type { Diagram } from "./types";

export const GOOGLE_DRIVE: Diagram = {
  id: "google-drive",
  title: "Google Drive",
  question: "Design Google Drive (Dropbox)",
  sourceId: "patterns",
  itemId: 12,
  overview: {
    shape:
      "The file is not the unit. Every file is sliced into 4MB chunks named by the SHA-256 of their bytes, so sync becomes a conversation about hashes, and bytes only move for chunks nobody already holds.",
    forces: [
      {
        constraint: "~40% of bytes are duplicates across users, and a naive re-upload sends 100% of a changed file",
        decision: "4MB content-addressed chunks turn upload into a handshake: the server asks only for the chunks it lacks",
        lights: ["chunker", "meta-svc", "e4", "e5"],
      },
      {
        constraint: "10M-file namespaces cannot afford an O(files) full-tree diff on every reconnect",
        decision: "The Server file journal is an append-only log read by cursor, so sync costs O(changes) instead",
        lights: ["journal", "e16"],
      },
      {
        constraint: "A device offline for 7 days must not be told 'everything changed'",
        decision: "The Three-tree diff keeps a third tree, the last agreed state, so delete and create are distinguishable",
        lights: ["three-tree"],
      },
      {
        constraint: "Metadata is ~18PB replicated while chunk bytes are ~11EB, three orders of magnitude apart",
        decision: "Metadata DB and Object store are deliberately separate systems with opposite access properties",
        lights: ["metadata-db", "object-store"],
      },
      {
        constraint: "A shared folder with 500 members turns one edit into 500 socket writes",
        decision: "The Notify bus and Notify service carry only a namespace id and are allowed to lose messages",
        lights: ["pubsub", "notify", "e13", "e14"],
      },
    ],
    naive: {
      text: "Treat the file as the unit: on a save, compare it to the version you last uploaded and, if it differs, upload the whole file again. A 10-byte edit at the start of a 1GB file shifts every byte's offset as far as a whole-file comparison is concerned, so the entire gigabyte re-uploads. Two devices holding the exact same corporate installer would each pay for their own full upload, with no way for the system to notice the bytes are identical. The Chunker + uploader instead slices every file into 4MB content-addressed chunks. It asks the Metadata service which ones it already has, so only chunks nobody holds ever cross the wire.",
      lights: ["chunker", "meta-svc"],
    },
    beats: [
      {
        text: "The client is where the difficulty lives, and it is one program rather than a tier. It holds a filesystem watcher, a local index of three trees, and a chunker, all in one process on hardware you do not control. Diffing against the third tree is the only way to tell 'I deleted this' from 'they created this'. The third tree is the last state at which local and server were known to agree.",
        lights: ["sync-agent", "watcher", "three-tree", "chunker"],
      },
      {
        text: "Chunking and hashing turn a file into an ordered list of 4MB SHA-256 hashes. That one move buys delta sync, resumable upload and cross-user dedup at the same time. A chunk that two users happen to share collides by construction, rather than because anybody built a dedup feature.",
        lights: ["chunker"],
      },
      {
        text: "Upload is a handshake, not a transfer. The client sends the hash list, the server answers with only the subset it lacks, and the client uploads that. A 1GB corporate installer is 256 chunks of which perhaps 10 are user-specific, so roughly 40MB crosses the wire instead of 1GB.",
        lights: ["chunker", "meta-svc", "e4", "e5"],
      },
      {
        text: "Metadata and bytes are deliberately different systems. Metadata is small, mutable, transactional and needs ordering, at roughly 18PB replicated. Chunks are large, immutable and need durability, at roughly 11EB. Two orders of magnitude apart in size and opposite in every access property, so they get separate stores.",
        lights: ["metadata-db", "object-store", "chunk-index"],
      },
      {
        text: "Commit is a compare and swap on the parent version, and that single operation is also the conflict detector. It writes the version row, increments chunk refcounts and appends one journal entry in one transaction. The ordering is not negotiable: chunks durable, then commit, then notify.",
        lights: ["meta-svc", "metadata-db", "journal", "e9", "e11", "e12"],
      },
      {
        text: "Convergence runs off the journal, an append-only log per namespace with a monotonic id. A device stores a cursor and asks for everything after it, so a sync costs O(changes) rather than O(files). That is the whole reason a 10M-file namespace is syncable at all. The pub/sub bus and the socket fleet above it only make that poll arrive sooner, which is exactly why they are allowed to lose messages.",
        lights: ["journal", "pubsub", "notify", "devices", "e14", "e15", "e16"],
      },
    ],
    crux: {
      problem:
        "The system cannot read the files. It sees opaque bytes with no notion of a line or a paragraph, so there is no merge function. Two devices that edited the same file offline genuinely cannot be reconciled.",
      handled:
        "The design's job is to make conflicts rare, then hand the survivors to a human as a second file on disk. Last-writer-wins on a version compare-and-swap detects every conflict. The loser is preserved as a conflict copy rather than silently discarded, so nothing is ever lost even though nothing is ever merged.",
    },
    numbers: [
      {
        value: "4MB fixed chunks, SHA-256",
        explain: "The unit sync actually operates on; naming a chunk by its content hash is what makes delta sync, resumable upload and cross-user dedup all fall out of one decision.",
      },
      {
        value: "~40% dedup: 10EB raw to ~6EB distinct",
        explain: "The bandwidth and storage saved because identical chunks collide by construction across every user, with no dedup feature built on top.",
      },
      {
        value: "~100k conflict copies/day",
        explain: "Each of these is a user shown two files rather than a silent overwrite or a corrupting auto-merge — the accepted cost of choosing safety over cleverness at conflict time.",
      },
      {
        value: "10M-file namespaces sync in O(changes)",
        explain: "What the journal-and-cursor design buys over comparing directory listings, which would be O(files) and already too slow at an ordinary user's 10k files.",
      },
      {
        value: "~2.5 devices per user",
        explain: "The average fan-out one change has to reach; it is why the notify path is built to be lossy and cheap rather than durable and expensive.",
      },
    ],
  },
  nodes: [
    {
      id: "sync-agent",
      label: "Sync agent (client-side)",
      kind: "serviceGroup",
      col: 0,
      row: 1,
      detail: {
        what: "One program on the user's laptop or phone: the filesystem watcher, the three-tree diff, and the chunker that hashes and uploads. A local index holds those trees plus the journal cursor.",
        why: "It is one service made of stages rather than several peers, because that is what it is. It ships as a single binary, the stages share memory and a process lifetime, and a crash takes all of them together. Nearly all the difficulty of the product lives in here, and it is the one component running on hardware you do not control. That is why the server treats everything it says as a claim rather than a fact. The local index has to survive a reboot too, or the synced tree and cursor are gone. Without it, the client falls back to a full tree diff against the server manifest: the expensive path the whole design exists to avoid.",
        numbers: [
          { value: "~2.5 devices per user", explain: "The average fan-out any single change has to reach across a user's own machines, before shared collaborators are counted." },
          { value: "one cursor per namespace", explain: "The state the local index has to persist per shared folder or root, since each namespace's journal is read independently." },
          { value: "~10k files, ~10GB per user", explain: "The typical size of the tree a single agent has to watch, diff and chunk." },
          { value: "local index ~500B of metadata per file, persisted across restarts", explain: "The per-file cost of the local index, small enough to hold the whole tree's state comfortably on disk." },
        ],
        breaks: {
          failure: "It is the only part of the system that ever holds a whole file, so every bug here shows up as user data that silently failed to sync.",
          handled: "Nothing server-side can see that it happened. Losing or corrupting the local index destroys the synced tree and cursor together, forcing a full diff. That risks a false 'everything deleted' read if the local tree is not fully mounted.",
        },
        choice: {
          pick: "One client binary running watcher, diff and chunker as in-process stages",
          instead: "Split the client into separate cooperating processes, or move the diff and chunking onto the server.",
          decider:
            "Where the bytes and the file handles already are. Every stage needs the local filesystem, so splitting into processes buys isolation at the cost of IPC on every one of a user's ~10k files. Moving the diff server-side means shipping whole files across a connection you do not trust to stay up, for a decision that only needs metadata.",
          flips: "A managed device fleet where a privileged watcher process must be isolated from the unprivileged uploader for security reasons, at which point the IPC cost is worth paying.",
        },
      },
    },
    {
      id: "watcher",
      label: "Filesystem watcher",
      sub: "OS events + periodic rescan",
      kind: "process",
      col: 0,
      row: 0,
      parent: "sync-agent",
      detail: {
        what: "The stage that learns a local file changed: OS change notifications for latency, plus a periodic full rescan of the tree as the backstop.",
        why: "It is the only input to the whole upload path, and it is unreliable by construction. Separating it from the diff matters because the two fail differently: the watcher loses events, the diff misreads the events it gets. The rescan reruns on a timer and again after every reconnect, not only from OS events.",
        numbers: [{ value: "full rescan of a 500k-file tree is minutes of disk I/O", explain: "Expensive enough that it must be periodic, not continuous — exactly why OS watch events, not this scan, carry the sub-second latency the product promises." }],
        breaks: {
          failure: "All three major OS watchers coalesce under load and drop events, and none guarantees a rename arrives as a rename.",
          handled: "A folder rename can surface as 10k deletes followed by 10k creates. Version history breaks and the bytes re-upload, which the periodic rescan and content-hash matching eventually repair.",
        },
        choice: {
          pick: "Treat the watcher as a latency optimisation and the periodic rescan as correctness",
          instead: "Trusting the watcher alone, or dropping it and polling the tree on a timer with no watcher at all.",
          decider:
            "What it costs to be wrong against what it costs to check. A rescan of a 500k-file tree is minutes of disk I/O, so you cannot run it often. A dropped event is permanent divergence, so you cannot skip it. Running both gets sub-second latency in the common case and bounded divergence in the bad one.",
          flips: "A platform with a reliable change journal such as NTFS USN. There the OS itself hands you an ordered, gap-free log, and the rescan drops back to a rare repair tool.",
        },
      },
    },
    {
      id: "three-tree",
      label: "Three-tree diff",
      sub: "local vs synced vs server",
      kind: "process",
      col: 0,
      row: 1,
      parent: "sync-agent",
      detail: {
        what: "Decides what actually changed by diffing three views of the folder: the local filesystem now, the server state as of the cursor, and a third view called `synced`. That third view is the state where the two last agreed.",
        why: "This is the stage that makes the diff decidable. Local against synced yields local changes, server against synced yields remote changes, a path in both is a conflict, a path in neither is untouched. With only local and server you cannot distinguish 'I deleted this' from 'they created this', which is where nearly every sync bug in this class comes from. Renames are matched by content hash and size rather than by path.",
        numbers: [{ value: "3 trees, not 2", explain: "The minimum needed to make delete and create distinguishable, since two trees alone cannot tell which side changed." }],
        breaks: {
          failure: "Run against a partially-populated local tree, say an external drive that has not mounted, and the diff concludes the user deleted everything.",
          handled: "The client has to refuse when the root is missing or the file count drops past a threshold, and ask instead, rather than acting on a plausible but wrong diff.",
        },
        choice: {
          pick: "Keep three trees and diff against the last agreed state",
          instead: "Two trees, local and server, deciding by timestamp or by whichever side looks newer.",
          decider:
            "Whether delete and create are distinguishable at all. With two trees a path present on the server and absent locally is exactly as consistent with 'I deleted it' as with 'they just created it'. No timestamp settles it because a delete leaves nothing to stamp. The third tree makes it a lookup rather than a guess, at the cost of one extra copy of the metadata, kilobytes per thousand files.",
          flips: "Nothing at this scope. Two trees only work where deletes are impossible or the client is never the authority for them, which is a different product.",
        },
      },
    },
    {
      id: "chunker",
      label: "Chunker + uploader",
      sub: "4MB fixed, SHA-256",
      kind: "process",
      col: 1,
      row: 2,
      parent: "sync-agent",
      detail: {
        what: "Splits each changed file into 4MB chunks, hashes every chunk with SHA-256, runs the have_blocks handshake, uploads the missing chunks and then sends the commit.",
        why: "Naming a chunk by its content is the move the whole design rests on. Identical bytes collide everywhere in the system for free, so delta sync, resumable upload and cross-user dedup all fall out of one decision rather than being three features.",
        numbers: [
          { value: "4MB chunks, files under 4MB stored whole", explain: "The chunk boundary; small files skip chunking entirely since there is nothing to split." },
          { value: "1GB file = 256 chunks = 8KB of hash list", explain: "256 × 32B = 8KB — over 100,000x smaller than the 1GB file itself, which is what makes asking before sending nearly free." },
          { value: "SHA-256 at 1 to 2 GB/s per core with hardware acceleration", explain: "The hashing throughput available, which is why fixed-offset chunking is cheap enough to run on every changed file." },
        ],
        breaks: {
          failure: "Fixed offsets are catastrophic for inserts.",
          handled: "10 bytes added at offset 0 of a 1GB file shifts all 256 boundaries. The whole gigabyte re-uploads, a cost the design accepts as rare in this product's usage pattern.",
        },
        choice: {
          pick: "Fixed 4MB offsets, each chunk hashed with SHA-256",
          instead: "Content-defined boundaries from a rolling hash (Rabin or buzhash), averaging 1MB with a 512KB floor and 8MB ceiling.",
          decider:
            "What fraction of modified bytes come from edits that change a file's length in the middle. A 10-byte insert at offset 0 of a 1GB file costs 1GB fixed against roughly 2MB content-defined, a 500x difference on that one operation. Content-defined costs a second pass over every byte, roughly halving the hashing rate, which is battery on a phone. Below about 5% length-changing edits fixed wins.",
          flips: "A corpus edited in the middle: source trees, design assets, or a backup product ingesting VM images and database files. That is why restic, borg and rsync all use content-defined boundaries.",
        },
      },
    },
    {
      id: "meta-svc",
      label: "Metadata service",
      sub: "handshake + CAS commit",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "Answers the have_blocks handshake with the hashes it lacks, then applies the commit as a compare and swap on the parent version and publishes the result.",
        why: "It is the only component that decides anything. Every other box either moves bytes or carries news, so all ordering, all authorisation and all conflict detection have to live in the one place that can run a transaction.",
        numbers: [
          { value: "409 returns the current version", explain: "The response code and payload a failed compare-and-swap returns, which is what a client needs to detect and resolve a conflict." },
          { value: "~100k conflict copies/day", explain: "The daily volume of detected concurrent edits across the whole service." },
        ],
        breaks: {
          failure: "Ordering. Commit before the chunks are durable and you publish a version pointing at bytes nobody has.",
          handled: "Notify before commit and a device is told about a version that does not exist yet, so the sequence chunks-then-commit-then-notify is enforced strictly, never reordered.",
        },
        choice: {
          pick: "Last writer wins on a version compare and swap, with the loser preserved as a conflict copy",
          instead: "A three-way merge against the common ancestor, dispatched by format, with unrecognised formats falling back to a conflict copy.",
          decider:
            "What fraction of conflicting files have a defined merge function, weighed against the asymmetry of being wrong. A conflict copy costs a user two minutes; a bad merge is silent corruption they may not notice for six months. At ~100k conflicts/day, 20% mergeable coverage is 20k merges/day, and a 1-in-1000 bad merge is 20 corrupted files a day.",
          flips: "When you own the format. A notes app, a code host or a design tool with its own document model should merge, because coverage is 100% and the merge is testable against a fixed grammar.",
        },
      },
    },
    {
      id: "journal",
      label: "Server file journal",
      sub: "append-only, monotonic jid",
      kind: "queue",
      col: 2,
      row: 2,
      detail: {
        what: "An append-only log per namespace of every operation (create, modify, move, delete), each stamped with a monotonically increasing id, read by cursor.",
        why: "This is the property that makes sync scale, and it is the only durable half of change propagation. A device persists its cursor and asks for everything after it, so reconnection costs O(changes since last sync) and is completely independent of how many files the namespace holds.",
        numbers: [
          { value: "~1B entries/day at ~100B each = ~100GB/day", explain: "The daily write volume of the journal across every namespace in the fleet." },
          { value: "90 days retention = ~9TB", explain: "The total storage the retention window costs, small next to the metadata or object tiers." },
          { value: "10M-file namespaces sync in O(changes)", explain: "The scaling property this store buys, independent of how large the namespace's tree has grown." },
        ],
        breaks: {
          failure: "A device away longer than the retention window falls off the end.",
          handled: "It has to fall back to a full tree diff, which is minutes of work on both ends and exactly the path the journal exists to avoid.",
        },
        choice: {
          pick: "A per-namespace append-only log with a monotonic id, read by cursor",
          instead: "Comparing directory listings between client and server on each sync.",
          decider:
            "Cost as a function of tree size. Listing comparison is O(total files) and is already unusable at the 10k files an average user holds, let alone the 10M-file namespaces enterprise tenants build. The journal is O(changes), and at ~1B entries/day and 90 days retention the whole log is ~9TB, trivially cheap.",
          flips: "Namespaces small enough that a full listing is a single cheap request, where a log is state you have to retain and expire for no benefit.",
        },
      },
    },
    {
      id: "notify",
      label: "Notify service",
      sub: "WebSocket fleet",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "The fleet holding one persistent socket per connected device, consuming from the bus and pushing 'namespace advanced to jid N' down the sockets that care.",
        why: "It is an accelerator and never a correctness mechanism. Because clients poll the journal regardless, this path is allowed to be lossy, unordered and best-effort, which is precisely what lets it be cheap at this fan-out.",
        numbers: [
          { value: "~12k events/s steady, ~60k/s at business-hours peak", explain: "The push rate this fleet has to sustain at steady state and at peak." },
          { value: "fan-out x2.5 devices per user, more for shared folders", explain: "The multiplier turning one commit into several socket pushes." },
          { value: "one socket held open per connected device", explain: "The connection model, which is what makes push latency low but also what makes the fleet's size proportional to concurrent users, not to change volume." },
        ],
        breaks: {
          failure: "A sync storm: one member refactoring 100 files in a folder with 50 collaborators is 5000 pushes.",
          handled: "Unless they are debounced into one 'namespace advanced' message per device, which is what keeps a bulk edit from becoming a socket flood.",
        },
        choice: {
          pick: "Best-effort push over persistent sockets, with clients polling the journal anyway",
          instead: "Treating the push as the authoritative change signal, or pure polling with no push at all.",
          decider:
            "What class of bug a lost message becomes. With polling underneath, a dropped push is a latency bug the next poll repairs; without it, the same drop is permanent divergence. Keeping the poll is what allows this 12k events/s path to be unreliable and therefore cheap.",
          flips: "A tiny deployment where polling every few seconds is affordable outright, so the socket fleet is pure operational cost.",
        },
      },
    },
    {
      id: "pubsub",
      label: "Notify bus",
      sub: "topic per namespace",
      kind: "queue",
      col: 1,
      row: 0,
      detail: {
        what: "The pub/sub topic the metadata service publishes to on commit, and the notify fleet subscribes to. Carries `{ namespace_id, jid }` and nothing else.",
        why: "It decouples the transaction from the fan-out. The commit path must not wait on, or fail because of, however many sockets happen to be open for a 500-member shared folder. The socket fleet must also be able to scale and restart without the metadata tier knowing.",
        numbers: [{ value: "~12k messages/s steady, ~60k/s peak", explain: "The publish rate on this bus, matching the commit rate rather than the eventual socket fan-out." }],
        breaks: {
          failure: "It is fire-and-forget on purpose, so a partition or a slow consumer silently drops events.",
          handled: "Every affected device is stale until its next poll. That is only survivable because the poll exists; treating this as durable delivery would hide a correctness bug behind a metric.",
        },
        choice: {
          pick: "An ephemeral topic keyed by namespace, fanned out at read time by the socket fleet",
          instead: "A durable per-device queue, so a disconnected device finds its notifications waiting.",
          decider:
            "Whether you already have the durable copy. 1B operations/day times ~2.5 devices is ~2.5B messages/day, and making those durable and per-device is a second storage system with its own retention. The journal already is that system, retained for 90 days rather than for the length of a disconnect.",
          flips: "A product with no pull path at all, such as a push-only device fleet that cannot poll, where the queue is the only delivery guarantee there is.",
        },
      },
    },
    {
      id: "block-svc",
      label: "Block service",
      sub: "PUT /chunk/{hash}",
      kind: "service",
      col: 0,
      row: 2,
      detail: {
        what: "Receives the chunks the handshake said were missing, verifies the bytes actually hash to the claimed key, writes them to the object store and registers them in the chunk index.",
        why: "Chunks are immutable and content-addressed, so this path needs no transactions and no ordering at all. That is exactly what lets uploads run fully parallel. Per-chunk acks let a partial upload survive a process restart or resume on a different device from the last acked chunk.",
        numbers: [{ value: "~10TB/day net new, ~30TB/day after 3x replication", explain: "The daily write volume this service actually persists after replication, small next to total traffic thanks to dedup." }],
        breaks: {
          failure: "Trusting a client's claim to already hold a hash turns that hash into an access token.",
          handled: "Anyone who obtains one can attach another user's chunk to their own file and read it, which is why possession is challenged rather than assumed above a size threshold.",
        },
        choice: {
          pick: "Per-user dedup by default, plus global dedup with a proof-of-possession challenge above a size threshold",
          instead: "Believing the client's have_blocks list unconditionally, or restricting dedup to the user's own chunks always.",
          decider:
            "How much of the dedup win survives the mitigation. Cross-user dedup is around 30% consumer and 50 to 80% inside a corporate tenant, but most of that is intra-tenant. So per-user or per-tenant keyspaces sacrifice far less than the headline suggests. Challenging for a random 4KB range costs one round trip and proves possession.",
          flips: "When privacy is the product. Client-side encryption with user keys kills all cross-user dedup and is the honest answer there.",
        },
      },
    },
    {
      id: "chunk-index",
      label: "Chunk index",
      sub: "hash to size, refcount, location",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "A key-value store mapping chunk_hash to its size, reference count and blob location. This is what the handshake queries.",
        why: "The existence question has to be answerable in a single key lookup, because it runs once per chunk of every upload before any bytes move. Keeping it separate from the metadata DB means the handshake never touches the transactional tier.",
        numbers: [
          { value: "one key per distinct chunk across ~6EB of distinct bytes", explain: "Tracks the ~6EB of distinct bytes dedup leaves behind, not the 10EB raw — this store's size follows content uniqueness, not upload volume." },
          { value: "single-key lookup per chunk", explain: "Cheap enough to run ahead of every byte moving, which is exactly why this store is kept separate from the ~18PB transactional metadata tier." },
        ],
        breaks: {
          failure: "Refcounts drift from the actual metadata references, so a counter that reaches zero wrongly deletes a live chunk.",
          handled: "The counter is a fast path, never the truth. A weekly mark-and-sweep against the metadata store catches and corrects drift before deletion.",
        },
        choice: {
          pick: "A key-value store keyed by chunk hash, kept out of the metadata database",
          instead: "Rows in the same transactional store that holds files and versions.",
          decider:
            "Access pattern and blast radius. This is uniform single-key reads at upload rate with no joins and no ordering requirement, against a metadata tier that is already ~18PB and needs transactions. Putting the handshake on that tier means every upload probe competes with commits.",
          flips: "Deployments small enough that one database serves both, where a second store is operational cost for a query pattern Postgres would handle fine.",
        },
      },
    },
    {
      id: "metadata-db",
      label: "Metadata DB",
      sub: "sharded by namespace",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "The transactional store holding files, versions, chunk lists and ACLs, sharded by namespace rather than by user.",
        why: "It stores the logical description of the tree and never a byte of file content, which is what allows reasoning about what changed to cost kilobytes. Chunk lists live in their own table because a 1TB file is 256k rows and will not fit in one.",
        numbers: [
          { value: "~10T file rows at ~500B = 5PB", explain: "The file-row storage footprint across the whole fleet." },
          { value: "chunk lists ~1PB at 32B per hash, 3 versions", explain: "The storage cost of tracking which chunks make up each retained version of every file." },
          { value: "~6PB logical, ~18PB replicated", explain: "~5PB of file rows + ~1PB of chunk lists ≈ this 6PB total, replicated 3x to ~18PB — the two numbers above summed, not a separate estimate." },
        ],
        breaks: {
          failure: "Moves across namespace boundaries are not atomic.",
          handled: "Dragging a folder out of a shared team folder into your private root is a copy plus a delete across two independent journals. File ids change and version history resets.",
        },
        choice: {
          pick: "Shard by namespace: a private root is one, every shared folder is another, mounted into each member's tree",
          instead: "Shard by user_id and replicate a shared folder's metadata into every member's shard.",
          decider:
            "Members per shared folder multiplied by change rate. A 500-member folder taking a 10k-file bulk edit is 5M metadata writes under per-user sharding against 10k under namespaces, and those 5M have to be transactional across 500 shards. Break-even is around 5 members; above about 50 it dominates the metadata tier.",
          flips: "Purely consumer products where sharing is rare, small and read-mostly. Per-user sharding also buys atomic moves anywhere in the tree, which namespaces genuinely give up.",
        },
      },
    },
    {
      id: "object-store",
      label: "Object store",
      sub: "key = SHA-256 of chunk",
      kind: "blob",
      col: 0,
      row: 3,
      detail: {
        what: "The blob tier holding raw chunk bytes keyed by their hash, tiered from SSD-backed hot storage to erasure-coded cold.",
        why: "This is the half you buy rather than build. Chunks are immutable and content-addressed, which is exactly the workload an object store sells, and rebuilding it is answering a different question by accident.",
        numbers: [
          { value: "~6EB distinct after ~40% dedup, ~11EB stored", explain: "The unique bytes after dedup, and the actual stored footprint once replication and erasure coding are applied." },
          { value: "hot 3x replicated, cold Reed-Solomon 10+4 at 1.4x", explain: "The two durability schemes used, chosen by how often each chunk is read." },
          { value: "~300PB hot tier, provisioned to ~500PB", explain: "The hot-tier size and its provisioned headroom, since hot storage is far more expensive per byte than cold." },
        ],
        breaks: {
          failure: "A chunk unavailable in one region stalls every file that references it.",
          handled: "Reads have to retry against an alternate region and recache lazily, so a regional blip degrades latency rather than availability.",
        },
        choice: {
          pick: "Buy an object store: hot bytes 3x replicated, cold erasure coded at 10+4",
          instead: "Build the storage layer, choosing placement, replication factor and durability arithmetic yourself.",
          decider:
            "Where the product actually is. Storage is the easy half and it is purchasable. The tiering is worth reasoning about, because the cold tier is 7EB of hardware, since 6EB at 3x everywhere is 18EB against ~11EB tiered. The convergence protocol on top is the part nobody sells you.",
          flips: "When storage economics are the business, at which point you are answering the object-store question directly rather than this one.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "GET /chunk/{hash}",
      kind: "gateway",
      col: 3,
      row: 3,
      detail: {
        what: "The edge tier chunk reads hit first, keyed by the same content hash the rest of the system uses, falling through to the object store on a miss.",
        why: "Content addressing makes caching trivially safe: a chunk's bytes can never change under its key, so there is no invalidation problem and an edge can hold it forever. That is what makes a widely shared template survivable.",
        numbers: [
          { value: "a hot chunk collapses thousands of fetches to one origin read", explain: "The fan-out reduction this tier buys for widely shared content." },
          { value: "4MB immutable objects, no TTL logic", explain: "Why this cache needs no invalidation code at all: the key already guarantees the bytes never change." },
        ],
        breaks: {
          failure: "A hot chunk requested by thousands of users at once melts the origin if the edge misses.",
          handled: "This is the one read-side thundering herd this system has, and request coalescing at the edge is what keeps a cold cache from turning into an origin spike.",
        },
        choice: {
          pick: "Serve chunk reads from a CDN edge, cached by content hash",
          instead: "Reading every chunk from the object store directly.",
          decider:
            "Fan-out on shared content. A widely shared template chunk is requested by thousands of users in the same window, and each is an identical immutable 4MB read. Edge caching turns that into one origin fetch with no invalidation logic, because the key already guarantees the bytes.",
          flips: "A corpus with no sharing at all, where every chunk is read by one user and the edge hit rate never justifies the tier.",
        },
      },
    },
    {
      id: "devices",
      label: "Other devices",
      sub: "same agent, own cursor",
      kind: "client",
      col: 2,
      row: 3,
      detail: {
        what: "The user's other machines and every collaborator's machine. Each runs the identical sync agent drawn above, with its own local index and its own cursor per namespace.",
        why: "They are drawn explicitly because they set the constraints the rest answers to: a week offline is the baseline case, not the edge case. They are the reason convergence has to be pull-driven rather than push-driven. The agent above is just the one that happened to write.",
        numbers: [
          { value: "~2.5 devices per user", explain: "The average fan-out for a solo user's own changes, before shared collaborators add to the count." },
          { value: "a 4MB edit to a 200MB file costs 4MB", explain: "The download cost on every other device once delta sync applies, regardless of the edited file's total size." },
        ],
        breaks: {
          failure: "A full tree diff against a partially-populated local tree, say an external drive that has not mounted, concludes the user deleted everything.",
          handled: "The client must refuse and ask instead, rather than acting on a diff run against an incomplete tree.",
        },
      },
    },
    {
      id: "gc",
      label: "Refcount GC",
      sub: "nightly sweep + mark-and-sweep",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "Decrements refcounts when versions expire, deletes refcount-zero chunks after a grace period, and periodically recomputes reachability from the metadata store.",
        why: "Chunks are written before any version references them and outlive every version that did, so nothing else in the design has a reason to delete a byte. Without this the store only grows.",
        numbers: [
          { value: "7-day grace period before deletion", explain: "The window a refcount-zero chunk survives, long enough to absorb undelete requests and refcount drift before anything is actually removed." },
          { value: "mark-and-sweep runs once a week against the metadata store", explain: "The cadence of the truth-checking pass that catches drift the fast-path counters accumulate." },
        ],
        breaks: {
          failure: "Deleting on a drifted refcount destroys a chunk that live versions still reference.",
          handled: "Content addressing means every file sharing those bytes breaks at once, which is why the weekly sweep verifies against metadata before anything is actually deleted.",
        },
        choice: {
          pick: "Refcounts as the fast path, with a periodic mark-and-sweep as the truth",
          instead: "Refcounts alone, or mark-and-sweep alone with no counters.",
          decider:
            "Whether you can afford to scan. A full reachability scan over ~10T file rows is not something you run nightly, and refcounts alone drift under concurrent commits and version expiry. Counters plus a 7-day grace window make the common case cheap, and the weekly sweep catches the drift before anything is deleted wrongly.",
          flips: "A corpus small enough to scan continuously, where the counters are pure complexity and reachability is always current.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "watcher",
      to: "three-tree",
      tier: "hot",
      step: 1,
      label: "changed paths",
      detail: {
        what: "Paths the OS reported as changed, handed to the diff to be interpreted.",
        why: "The watcher reports events; only the diff can say what they mean. Keeping the hand-off explicit is what lets the diff treat an incoming event as a hint rather than as truth, and re-derive the answer from the trees. Events coalesce under load and the periodic rescan supplies what they missed.",
        breaks: {
          failure: "If the watcher missed the event this edge never fires.",
          handled: "The file is silently unsynced until the next full rescan closes the window, which bounds the worst-case detection delay.",
        },
      },
    },
    {
      id: "e3",
      from: "three-tree",
      to: "chunker",
      tier: "hot",
      step: 2,
      label: "changed files to hash",
      detail: {
        what: "The set of files the diff decided genuinely changed locally, handed to the chunker.",
        why: "The diff runs on metadata and costs nothing; chunking reads every byte of the file. Deciding what changed before touching bytes is what keeps an idle folder free, and a rename recognised as a rename ideally moves no bytes at all.",
        breaks: {
          failure: "A rename the diff failed to recognise arrives here as an unrelated delete plus create.",
          handled: "The whole file re-hashes and re-uploads, and its version history restarts, which the content-hash matching in the diff exists to prevent in the common case.",
        },
      },
    },
    {
      id: "e4",
      from: "chunker",
      to: "meta-svc",
      tier: "hot",
      step: 3,
      label: "have_blocks([h1..hN])",
      detail: {
        what: "The ordered hash list for the changed file, sent before any bytes move.",
        why: "Turning upload into 'which of these do you already have' rather than 'here it is' is the single biggest efficiency win in the system. It costs 32 bytes per 4MB of file to ask.",
        numbers: [
          { value: "32B per hash", explain: "× 256 hashes for a 1GB file ≈ 8KB — the size of asking, negligible next to the gigabyte it's asking about." },
          { value: "1GB file = 256 hashes = 8KB of question", explain: "8KB to ask, but the answer can save up to 80% of a corporate upload (e5) — the dedup win is bought for a rounding error of bandwidth." },
        ],
        breaks: {
          failure: "This list is a claim by software on a stranger's laptop.",
          handled: "The server cannot treat 'I have h' as proof of possession, so a possession challenge exists for exactly the cases where that claim matters.",
        },
      },
    },
    {
      id: "e5",
      from: "meta-svc",
      to: "chunker",
      tier: "data",
      label: "missing hashes only",
      offset: 60,
      detail: {
        what: "The subset of hashes the server does not hold, returned to the client.",
        why: "This reply is where the dedup saving is actually realised. In a corporate tenant a 1GB installer collapses to about 40MB of transfer because 246 of its 256 chunks already exist from prior uploads.",
        numbers: [
          { value: "~30% dedup consumer, 50 to 80% corporate", explain: "The typical dedup rate by tenant type, which is what makes a corporate installer so much cheaper to upload the second time." },
          { value: "1GB installer to ~40MB transferred", explain: "A concrete example of the saving this edge's answer produces." },
        ],
        breaks: {
          failure: "Answering it honestly for chunks the user never uploaded leaks information.",
          handled: "Chunk existence becomes an oracle for 'someone else has this file', which is why a possession challenge gates dedup above a size threshold.",
        },
      },
    },
    {
      id: "e6",
      from: "chunker",
      to: "block-svc",
      tier: "hot",
      step: 4,
      label: "PUT missing chunks",
      detail: {
        what: "The bytes of the missing chunks, uploaded in parallel with a per-chunk ack.",
        why: "Chunks are immutable and unreferenced until commit, so they can go up in any order, from any device, across any number of connections, resuming from the last acked chunk. That is what makes a 10GB upload over flaky mobile resumable.",
        numbers: [{ value: "4MB bounds a single retransmit", explain: "The maximum amount of work a failed transfer loses, since each chunk is its own retry unit." }],
        breaks: {
          failure: "Chunks uploaded and never committed are garbage until GC collects them.",
          handled: "An abandoned upload leaks storage for the grace period before GC reclaims unreferenced chunks; the nightly sweep bounds that window rather than eliminating the leak.",
        },
      },
    },
    {
      id: "e7",
      from: "block-svc",
      to: "object-store",
      tier: "hot",
      step: 5,
      label: "store under its hash",
      detail: {
        what: "Writing the chunk bytes into the blob tier under key = SHA-256 of those bytes.",
        why: "Content addressing means two users uploading the same bytes write the same key, so dedup is a property of the naming scheme rather than a feature anybody implemented.",
        numbers: [{ value: "~10TB/day net new, ~30TB/day after replication", explain: "The actual write volume landing here after dedup has already removed duplicate chunks." }],
        breaks: {
          failure: "This write must be durable before the commit lands.",
          handled: "Otherwise the commit publishes a version pointing at bytes nobody holds, which is why chunk durability strictly precedes the commit step.",
        },
      },
    },
    {
      id: "e8",
      from: "block-svc",
      to: "chunk-index",
      tier: "data",
      label: "register hash + location",
      detail: {
        what: "Recording that the chunk now exists, with its size and blob location.",
        why: "The index entry is what makes the next handshake answer 'present' for this chunk. It goes in after the blob write, so the index never advertises a chunk the store cannot serve.",
        numbers: [{ value: "one key write per genuinely new chunk", explain: "Skipped for the ~40% of chunks dedup already holds — only genuinely new content ever reaches a write here at all." }],
        breaks: {
          failure: "Registering before the blob is durable means a later handshake tells a client not to upload bytes the system has actually lost.",
          handled: "Ordering the write after the blob is durable is the entire fix, so this edge only ever fires once the bytes genuinely exist.",
        },
      },
    },
    {
      id: "e9",
      from: "chunker",
      to: "meta-svc",
      tier: "hot",
      step: 6,
      label: "commit(parent_version)",
      offset: 40,
      detail: {
        what: "The commit carrying file_id, parent_version and the full ordered chunk list, sent only once every chunk is durable.",
        why: "This is the atomic step and the only place a conflict can be detected. Sending the parent version rather than just the new state turns concurrent editing into a detectable event instead of a silent overwrite. It applies only if the current version still equals the parent version.",
        numbers: [{ value: "409 returns the current version", explain: "The signal a client uses to detect and resolve a lost race." }],
        breaks: {
          failure: "A failed compare and swap is the conflict, and the loser's bytes become a sibling conflict copy.",
          handled: "The copy is named for the losing device, because merging two divergent edits to a binary format produces corruption rather than a merge.",
        },
      },
    },
    {
      id: "e10",
      from: "meta-svc",
      to: "chunk-index",
      tier: "data",
      label: "lookup hashes",
      detail: {
        what: "One key lookup per submitted hash to decide which chunks already exist.",
        why: "The handshake has to be answerable without touching the transactional tier or the bytes themselves, which is why the existence question lives in its own key-value store.",
        numbers: [{ value: "single-key read per chunk of every upload", explain: "The full cost of this edge, cheap enough to run before any bytes move." }],
        breaks: {
          failure: "A slow index turns the handshake into the bottleneck of every upload.",
          handled: "That includes the ones where nothing needs transferring at all, which is why this store is kept small, single-purpose and fast rather than folded into the metadata tier.",
        },
      },
    },
    {
      id: "e11",
      from: "meta-svc",
      to: "metadata-db",
      tier: "hot",
      step: 7,
      label: "version row + refcounts",
      detail: {
        what: "One transaction writing the version row, incrementing chunk refcounts and appending the journal entry.",
        why: "All three have to happen together or not at all. A version without its journal entry never propagates, and refcounts incremented outside the transaction drift the moment a commit fails partway.",
        numbers: [
          { value: "~500B per file row", explain: "× ~10T file rows ≈ the ~5PB file-row footprint metadata-db carries — small per write, large only at the fleet's full scale." },
          { value: "32B per chunk hash, ~3 retained versions", explain: "The additional per-version cost carried in the chunk-list table." },
        ],
        breaks: {
          failure: "This tier is sharded by namespace, so a move between namespaces spans two shards and two journals.",
          handled: "That move cannot be made atomic at all, so it is modelled as a copy plus a delete rather than pretended to be a single operation.",
        },
      },
    },
    {
      id: "e12",
      from: "meta-svc",
      to: "journal",
      tier: "hot",
      step: 8,
      label: "append one entry",
      detail: {
        what: "The committed operation appended to the namespace journal with the next monotonic id, inside the same transaction as the version row.",
        why: "The journal entry is the canonical statement that something changed. A conflict copy is written as an ordinary create precisely so it gets an entry here and propagates by the normal mechanism with no special case downstream.",
        numbers: [
          { value: "~1B entries/day across 1B namespaces", explain: "The scale of journal traffic across the whole fleet." },
          { value: "~10 file operations per active user-day", explain: "The typical per-user contribution to that total." },
        ],
        breaks: {
          failure: "Ordering within a namespace is the guarantee clients depend on.",
          handled: "Any gap or reordering in the ids breaks replay on every device holding a cursor, which is why the id is assigned inside the same transaction as the version row.",
        },
      },
    },
    {
      id: "e13",
      from: "meta-svc",
      to: "pubsub",
      tier: "control",
      label: "publish {ns, jid}",
      detail: {
        what: "A fire-and-forget publish, after the commit is durable, saying a namespace has moved to journal id N.",
        why: "Strictly last in the ordering, and strictly outside the transaction. Publishing before the commit tells a device about a version that does not exist yet. Blocking the commit on the publish would make the interactive write path depend on the fan-out tier being healthy.",
        numbers: [
          { value: "~12k publishes/s steady, ~60k/s peak", explain: "The publish rate on this edge, matching commit rate rather than the eventual fan-out to sockets." },
          { value: "one message per namespace, not per file", explain: "The granularity of what is published; a bulk edit still produces one message, not one per changed file." },
        ],
        breaks: {
          failure: "Nothing retries it. A publish lost here is invisible to the metadata tier.",
          handled: "The only thing that repairs it is the client's next poll, which is why this edge is allowed to be lossy at all.",
        },
      },
    },
    {
      id: "e14",
      from: "pubsub",
      to: "notify",
      tier: "control",
      label: "fan out to sockets",
      detail: {
        what: "The socket fleet consuming the topic and resolving one message into the set of connected devices that subscribe to that namespace.",
        why: "The fan-out has to happen here rather than at publish time, because only this tier knows which devices are currently connected. That set changes far faster than the commit rate.",
        numbers: [
          { value: "x2.5 devices per user, far more for a shared folder", explain: "The multiplier this edge applies to every incoming message." },
          { value: "5000 pushes debounced to one per device", explain: "The effect of debouncing a bulk edit before it reaches this fan-out step." },
        ],
        breaks: {
          failure: "A shared folder with 500 members turns one message into 500 socket writes.",
          handled: "A bulk edit here is where a sync storm actually lands, which is why debouncing happens before fan-out rather than after.",
        },
      },
    },
    {
      id: "e15",
      from: "notify",
      to: "devices",
      tier: "control",
      label: "push over WebSocket",
      detail: {
        what: "The push telling connected devices to pull the journal now rather than at their next poll.",
        why: "It exists purely to cut the gap between commit and convergence. Because it decides nothing, it is allowed to be lossy and unordered, and a dropped message costs latency rather than correctness. A disconnected device simply gets nothing and does not need to.",
        breaks: {
          failure: "A device that treated this as its only signal would diverge permanently on a single dropped message.",
          handled: "That is why the pull below is not optional: every device polls the journal on its own schedule regardless of whether a push ever arrived.",
        },
      },
    },
    {
      id: "e16",
      from: "devices",
      to: "journal",
      tier: "hot",
      step: 9,
      label: "GET /journal?since=cursor",
      detail: {
        what: "The pull: everything after the device's stored cursor for that namespace, replayed in order.",
        why: "This is the actual convergence mechanism and it runs whether or not a push arrived. Cost is proportional to what changed rather than to how many files the namespace holds, which is what makes a 10M-file namespace syncable after a week offline.",
        numbers: [{ value: "90 day retention window", explain: "The maximum gap this pull can bridge before falling back to a full tree diff." }],
        breaks: {
          failure: "A cursor older than the retention window falls back to a full tree diff.",
          handled: "That is minutes of CPU and disk, and risks concluding the user deleted everything if the local tree is not fully mounted. The client checks the tree is mounted first.",
        },
      },
    },
    {
      id: "e17",
      from: "devices",
      to: "cdn",
      tier: "hot",
      step: 10,
      label: "fetch missing chunks",
      detail: {
        what: "Delta download: the device fetches only the chunks in the new version that its local tree lacks.",
        why: "The replayed journal gives it a chunk list, and it already knows which hashes it holds, so the download is a set difference. Editing 4MB of a 200MB video costs 4MB on every other device.",
        numbers: [{ value: "4MB downloaded for a 4MB edit to a 200MB file", explain: "The delta-download cost, independent of the edited file's total size." }],
        breaks: {
          failure: "Chunks can be fetched speculatively before the commit is visible.",
          handled: "This halves the wall-clock gap on large files but means some fetched chunks are discarded, a bandwidth cost the design accepts for the latency win.",
        },
      },
    },
    {
      id: "e18",
      from: "cdn",
      to: "object-store",
      tier: "data",
      label: "origin fetch on miss",
      detail: {
        what: "The edge pulling a chunk it does not hold from the blob tier.",
        why: "It is the rare path on purpose. For shared content the edge absorbs almost all of the fan-out, so origin sees one fetch per hot chunk rather than thousands.",
        numbers: [{ value: "one origin read per hot chunk per edge", explain: "The effective fan-in this edge reduces thousands of client requests to." }],
        breaks: {
          failure: "A cold chunk that has aged into the erasure-coded tier takes seconds to warm up.",
          handled: "The first reader after a long idle period pays a latency the hot path never sees, which the design accepts since cold chunks are read rarely by definition.",
        },
      },
    },
    {
      id: "e19",
      from: "metadata-db",
      to: "gc",
      tier: "control",
      label: "expired versions",
      detail: {
        what: "Version expiry and file purges feeding refcount decrements, plus the full reachability scan the sweep runs against.",
        why: "The metadata store is the only component that knows which chunks are still referenced, because a chunk itself carries no back-pointer to the files using it. Reachability has to be computed from this side.",
        numbers: [
          { value: "~3 retained versions per file", explain: "The version depth that determines when an old version's chunks become eligible for refcount decrement." },
          { value: "mark-and-sweep runs once a week", explain: "The cadence of the full reachability pass this edge feeds." },
        ],
        breaks: {
          failure: "Reading this while commits are in flight gives a snapshot that undercounts references.",
          handled: "That is exactly why deletion waits out a grace period rather than acting on one scan, absorbing any undercounting before bytes are actually removed.",
        },
      },
    },
    {
      id: "e20",
      from: "gc",
      to: "object-store",
      tier: "control",
      label: "delete refcount-zero",
      detail: {
        what: "Deleting chunks whose reference count has been zero for longer than the grace period.",
        why: "Chunks outlive the versions that created them and nothing else has a reason to remove them, so this is the only path in the design that frees storage.",
        numbers: [{ value: "7-day grace period covers undelete and refcount bugs", explain: "The window this edge waits before acting, chosen to absorb both user undelete requests and any refcount drift." }],
        breaks: {
          failure: "Deleting on a wrong count destroys bytes shared by every file that referenced them.",
          handled: "The sweep verifies against metadata before anything is removed, so this edge only ever fires on counts already reconciled against the source of truth.",
        },
      },
    },
    {
      id: "e21",
      from: "gc",
      to: "chunk-index",
      tier: "control",
      label: "verify counts",
      detail: {
        what: "Comparing stored refcounts against the reachability the sweep computed, and correcting the drift.",
        why: "The counter is a fast path that lets commit avoid a scan, not the truth. Treating it as truth is how a live chunk gets deleted, so it is reconciled rather than trusted, and the orphan-chunk count and refcount drift are both paged on.",
        numbers: [{ value: "1 reconciliation pass per week", explain: "How often this edge runs, matching the mark-and-sweep cadence it belongs to." }],
        breaks: {
          failure: "Drift in the safe direction leaks storage quietly.",
          handled: "The metric matters as much as the repair here, since nobody notices orphans until the bill does, so orphan count is tracked and alerted on directly.",
        },
      },
    },
  ],
  figures: {
    "three-trees": {
      title: "Three trees: local, synced, and server",
      nodes: [
        {
          id: "synced",
          label: "Synced",
          sub: "last agreed state",
          kind: "database",
          col: 0,
          row: 0,
          detail: {
            what: "The third tree: the filesystem state the client and server were last known to agree on.",
            why: "A path appearing in both diffs against synced is a real conflict; a path in neither was never touched by anyone. Two-tree comparison cannot tell a local creation from a remote deletion, and this is what resolves the ambiguity.",
          },
        },
        { id: "local", label: "Local", sub: "filesystem now", kind: "database", col: 0, row: 1 },
        { id: "server", label: "Server", sub: "current remote state", kind: "database", col: 1, row: 1 },
      ],
      edges: [
        { id: "e1", from: "local", to: "synced", tier: "hot", step: 1, label: "diff → local changes" },
        { id: "e2", from: "server", to: "synced", tier: "hot", step: 2, label: "diff → remote changes" },
      ],
    },
    "chunk-handshake": {
      title: "The chunk handshake: negotiate, then commit",
      nodes: [
        { id: "client", label: "Client", sub: "splits + hashes locally", kind: "client", col: 0, row: 0 },
        {
          id: "metaserver",
          label: "Metaserver",
          kind: "service",
          col: 1,
          row: 0,
          detail: {
            what: "The service that negotiates which chunks are missing and commits the final version.",
            why: "Trusting a client's claim of 'I already have chunk h' unconditionally means knowing a hash becomes equivalent to holding the file. A claim of possession must never substitute for proof of it.",
          },
        },
        { id: "blockserver", label: "Block server", kind: "service", col: 0, row: 1 },
        { id: "hashkv", label: "Hash KV", sub: "chunk existence index", kind: "database", col: 1, row: 1 },
      ],
      edges: [
        { id: "e1", from: "client", to: "metaserver", tier: "hot", step: 1, label: "have_blocks → missing list" },
        { id: "e2", from: "metaserver", to: "hashkv", tier: "hot", step: 2, label: "lookup hashes" },
        { id: "e3", from: "client", to: "blockserver", tier: "hot", step: 3, label: "PUT missing chunks" },
        { id: "e4", from: "blockserver", to: "hashkv", tier: "hot", step: 4, label: "store(h)" },
        { id: "e5", from: "client", to: "metaserver", tier: "hot", step: 5, label: "commit_file → ack" },
      ],
    },
  },
};
