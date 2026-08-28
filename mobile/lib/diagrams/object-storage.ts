import type { Diagram } from "./types";

export const OBJECT_STORAGE: Diagram = {
  id: "object-storage",
  title: "Object Storage",
  question: "Design S3 (Distributed Object Storage)",
  sourceId: "patterns",
  itemId: 21,
  overview: {
    shape:
      "An object store is a small strongly consistent index in front of write-once bytes: metadata owns (bucket, key) -> manifest, the data plane owns piece_id -> bytes, and no request reaches a disk without resolving through the index first.",
    beats: [
      "Everything follows from one property: an object is never modified in place, which turns a storage problem into an index problem. Split the system in two. The metadata service holds 12PB of small mutable records on NVMe and needs consensus; the data plane holds 21EB of large immutable pieces on HDD and needs no coordination at all, because nothing it stores is ever rewritten.",
      "A write lands fresh pieces in the data plane first, which is safe without any locking because nobody has ever read those pieces, and then commits exactly one manifest pointer in metadata. The client sees a 200 only after that commit. An overwrite is the identical operation with a different pointer, so consistency, versioning and resumable upload collapse into one move: build something immutable, then swap one cell.",
      "Multipart is the same mechanism with the manifest assembled incrementally. CreateMultipartUpload allocates an upload_id reachable from no key, each UploadPart writes its pieces and records a (part_num, etag) row, and CompleteMultipartUpload validates the list, builds the final manifest and swaps the pointer. That commit is the only atomic step in a transfer that may have run for a day.",
      "Placement is where durability is actually bought. Each piece becomes 6 data and 3 parity fragments under RS(6,3), placed 3-3-3 so no zone holds more than m, at 1.5x overhead instead of the 3x a whole replica costs. Layout is a per-object property recorded in the manifest, so small and hot objects keep whole replicas and archive drops to RS(10,4) at 1.4x.",
      "Two background jobs then run forever and never finish. Repair rebuilds fragments after a drive dies, prioritised by how little redundancy is left; scrub re-reads all 21EB on a 90-day cadence to catch silent bit rot that never raises a read error. Garbage collection sweeps pieces orphaned by aborted uploads and overwritten manifests, and all three are throttled to roughly 10% of cluster bandwidth.",
      "Several other designs in this app draw an object store as one box on the edge of the picture. This is the inside of that box, and the reason it can be drawn as a single box elsewhere is precisely that every consistency guarantee has been concentrated into one small index while the bytes underneath are immutable and boring.",
    ],
    crux:
      "The durability number does not come from the erasure code. RS(6,3) tolerates 3 simultaneous fragment losses and nothing more; eleven nines comes from the ratio between the repair window and the failure interarrival time. Independent failures alone give roughly seventeen nines, so the six-order gap to the published eleven is correlated failure, software defects and operator error. Reaching for a wider code optimises the term that is already a million times too small to matter.",
    numbers: [
      "40T objects in region, ~310KB mean, ~12EB logical",
      "15M req/s, all of it through metadata first",
      "RS(6,3) at 1.5x against 3x replicas; 1.77x fleet-weighted",
      "17 nines from independent failure, 11 published",
    ],
  },
  nodes: [
    {
      id: "background-plane",
      label: "Background plane, never stops",
      kind: "zone",
    },
    {
      id: "client",
      label: "Client / SDK",
      sub: "PUT, GET, multipart",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The caller, holding an HTTP API and a key it chose itself, uploading anything from a 1KB config file to a 5TB dataset.",
        why: "It is drawn because the customer's key naming is an input we do not control and cannot fix from inside the storage system, and it is the direct cause of the sequential-prefix hotspot that saturates a single metadata partition.",
        numbers: [
          "objects 1KB to 5TB",
          "70% under 128KB, median ~10KB",
          "read:write about 10:1",
        ],
        breaks:
          "A client that verifies a multipart upload by comparing MD5s discovers in production that the ETag is the MD5 of the concatenated part MD5s with a -N suffix, not the object's digest.",
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "absorbs the hot key",
      kind: "external",
      col: 0,
      row: 1,
      detail: {
        what: "Edge caches in front of every GET, serving popular objects close to users without touching the origin at all.",
        why: "A viral thumbnail read 1M times per second resolves to one manifest and fans out to the same 9 storage nodes, roughly 111k req/s each, which saturates them even though the fleet has a million of them. The only real answer for a globally hot object is not to send the reads here.",
        numbers: [
          "over 99% of hot-object reads absorbed",
          "1M req/s would be ~111k req/s per node at origin",
        ],
        breaks:
          "It does nothing for an in-region hot read that bypasses the edge, where the fallback is shadow replication beyond what the code requires plus round-robin, which is an operational workaround rather than a design.",
        choice: {
          pick: "CDN in front of all GETs, plus a per-key gateway rate limit at the origin",
          instead: "Shadow-replicating a hot object across more nodes than the erasure code needs and reading round-robin.",
          decider:
            "Where the 1M req/s lands. A CDN removes over 99% of it before it becomes storage load; shadow replication still lands the full aggregate on the fleet and only spreads the 111k req/s per node across more spindles. The durable fix is a lifecycle rule promoting the object to whole replicas, which also turns a 6-seek read into 1.",
          flips: "In-region access with no edge in the path, where shadow replication is the only lever left and you accept it as a workaround.",
        },
      },
    },
    {
      id: "frontend",
      label: "API frontend",
      sub: "auth, ack after commit",
      kind: "service",
      col: 0,
      row: 2,
      detail: {
        what: "The stateless HTTP tier that authenticates the request, applies per-key rate limits, and orchestrates the resolve-then-touch-bytes sequence.",
        why: "It enforces the single rule the whole design rests on: no path reaches bytes without resolving through metadata first, and a PUT is acked only after the metadata pointer commits. That one ordering is what makes strong read-after-write achievable rather than aspirational.",
        numbers: [
          "~15M req/s in region",
          "~14M GET/s and ~1.4M PUT/s",
          "GET p99 under 100ms in-region",
        ],
        breaks:
          "Acking before the pointer commits reintroduces the eventual-consistency window, and every caller that overwrites then has to build a retry-until-you-see-your-own-write loop, which they get wrong.",
        choice: {
          pick: "Strong read-after-write on every operation: ack after the pointer commit, serve pointer reads from the shard leader or a lease-holding replica",
          instead: "Ack as soon as the fragments are durable and let the pointer propagate asynchronously to a replicated read cache.",
          decider:
            "What the commit costs against what its absence costs. A Raft commit across three AZs is 1 to 3ms, while the data-plane write for a 310KB object is 20 to 50ms, so consistency is 2 to 10% of PUT latency and 0% of GET latency. AWS re-took this trade in December 2020 and shipped it fleet-wide at no measurable latency change.",
          flips: "When the pointer must be visible in more than one region: a cross-region consensus round is 60 to 150ms, 20 to 50x the intra-region commit, so multi-region buckets are eventually consistent by construction.",
        },
      },
    },
    {
      id: "metadata",
      label: "Metadata service",
      sub: "Raft KV, range-partitioned",
      kind: "database",
      col: 0,
      row: 3,
      detail: {
        what: "The sharded, consensus-replicated index mapping (bucket, key, version_id) to a manifest_id plus size, etag, storage class and encryption key reference.",
        why: "This is the only mutable cell in the entire system, so all the consistency lives here and the data plane needs none. It also scales on a different axis to the bytes: a customer with a billion tiny objects costs nothing in disks and everything in index.",
        numbers: [
          "~300B per index record, 40T records, ~12PB of index",
          "4,000 metadata nodes; capacity binds by 40x over throughput",
          "~3.75k ops/s per node, 2% of the throughput ceiling",
        ],
        breaks:
          "A customer writing logs/YYYY-MM-DD/ at 20k PUT/s lands all of it on one range partition against a ~3,500 PUT/s ceiling, and takes 503s until the split lands, repeatedly, because tomorrow's date is a fresh hotspot.",
        choice: {
          pick: "Range-partition on (bucket, key) with automatic split on rate and size, and hash fragment placement independently",
          instead: "Hash-partition on hash(bucket, key), making a prefix hotspot structurally impossible.",
          decider:
            "Whether customers LIST. A range partition sustains ~3,500 PUT/s and ~5,500 GET/s before it must split, and splits take minutes. Under hashing, a prefix LIST returning 1,000 keys becomes a scatter-gather across ~2,700 partitions in region and tens of thousands in practice, and data-lake planners LIST before every scan.",
          flips: "When nobody lists. A blob store fronting a database always arrives with a known key, so hashing there deletes an entire class of incident and costs nothing.",
        },
      },
    },
    {
      id: "ec",
      label: "Erasure coder + placement",
      sub: "RS(6,3), max 3 frags per AZ",
      kind: "service",
      col: 0,
      row: 4,
      detail: {
        what: "Splits each piece into 6 data and 3 parity fragments with Reed-Solomon, selects 9 nodes under anti-affinity, and reconstructs on read when fragments are missing.",
        why: "It converts a durability requirement into a placement rule. Any 6 of 9 reconstruct the piece, and 3-3-3 across zones means losing an entire availability zone removes exactly 3 fragments and leaves exactly the 6 needed, at 1.5x storage instead of the 200% overhead of three whole copies.",
        numbers: [
          "RS(6,3): 9 fragments, any 6 reconstruct",
          "1.5x overhead against 3x replication",
          "167KB fragments for a 1MB object",
        ],
        breaks:
          "Placement must refuse a write that violates anti-affinity. Once too many fragments share a zone, a single zone outage takes the object below k and no repair job can help, because the survivors are not enough to reconstruct from.",
        choice: {
          pick: "RS(6,3) for the warm tier, RS(10,4) at 1.4x for archive, whole replicas for small and hot",
          instead: "One code path erasure-coding everything, which is a simpler system with a lower storage bill and no tier machinery.",
          decider:
            "Seeks against bytes saved. A 20TB HDD at $5/disk-month prices capacity at $0.00025/GB-month and one seek at $1.9e-8, so EC's 5 extra seeks per read cost $9.5e-8 against 1.5·S GB saved. Break-even is ~3,950·S(GB) reads/month: 1GB at 130 reads/day, 128KB at once every two months, 10KB at one read every two years.",
          flips: "When you pack small objects into large sealed extents before coding, so no fragment is ever small. Then EC-everything is correct, which is what f4 and Azure actually do. It also flips outright on a flash-only fleet, where the 10KB crossover moves to roughly 30 reads a day.",
        },
      },
    },
    {
      id: "storage",
      label: "Storage nodes",
      sub: "dense HDD, piece_id to bytes",
      kind: "database",
      col: 0,
      row: 5,
      detail: {
        what: "A fleet of dense disk servers holding a flat piece_id to bytes map and no other logic at all.",
        why: "Everything intelligent was deliberately pushed up into metadata so this tier can be the cheapest possible bulk medium. It also scales purely on bytes, so adding capacity for a bandwidth-heavy workload never requires buying index IOPS.",
        numbers: [
          "~21EB physical at 1.77x weighted overhead",
          "~1.05M drives of 20TB, ~10,500 servers at 100 drives each",
          "aggregate read bandwidth ~158TB/s",
        ],
        breaks:
          "A dead 20TB drive holds fragments for order 1e8 erasure groups, so the expensive part of losing it is not rebuilding 20TB, it is finding which groups were affected.",
        choice: {
          pick: "Dense HDD servers, roughly 100 drives per chassis, holding immutable pieces only",
          instead: "An all-flash fleet, or fusing the index onto the same nodes that hold the bytes.",
          decider:
            "Cost per stored byte at exabyte scale, and the fact that the two planes have opposite profiles. A 20TB HDD is $0.00025/GB-month; NVMe raises that by roughly 7x while dropping per-operation cost by four orders of magnitude. Fusing the planes would force all 21EB onto the more expensive profile to serve 12PB of index.",
          flips: "A flash-only fleet, which inverts the layout rule entirely: the replicate-hot-and-small guidance is a statement about spinning disks and does not survive NVMe.",
        },
      },
    },
    {
      id: "bucket",
      label: "Bucket service",
      sub: "replicated SQL",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "Bucket-level configuration: owner, region, access policies, versioning on or off, lifecycle rules, object lock.",
        why: "Bucket state is rare, small and rarely changed, so it has nothing in common with an index of 40 trillion objects. Keeping it separate means the hot path can cache it aggressively rather than paying an index shard for a value that changes once a year.",
        numbers: [
          "one row per bucket against 40T object rows",
          "read on every request, written almost never",
        ],
        breaks:
          "If a policy change is cached too long the frontend authorises against stale rules, which is an access-control failure rather than a performance one.",
        choice: {
          pick: "A small replicated SQL database, separate from the object index",
          instead: "Storing bucket config as rows in the same sharded KV that holds the 12PB object index.",
          decider:
            "Cardinality and change rate. Buckets number in the millions against 40T objects, they are read on every one of 15M req/s but written essentially never, so they cache perfectly and want joins and constraints rather than range-partitioned scale.",
          flips: "If buckets ever became numerous enough to outgrow one replicated database, at which point they are just another sharded namespace and the distinction stops paying for itself.",
        },
      },
    },
    {
      id: "manifest",
      label: "Manifest store",
      sub: "immutable, write-once",
      kind: "database",
      col: 1,
      row: 3,
      detail: {
        what: "Immutable records keyed by manifest_id, each listing the object's parts and, for every part, its fragments and their node locations.",
        why: "Three levels and every level except the top pointer is write-once. An in-flight GET that already resolved a manifest_id keeps reading valid bytes to completion even through an overwrite, because the manifest it holds cannot be edited out from under it. That is snapshot isolation you get for free rather than implement.",
        numbers: [
          "fragment list ~108B, 9 entries of 12B",
          "one manifest per object version",
        ],
        breaks:
          "The swap is atomic for exactly one key, so replacing 400 parquet files as a unit is not expressible, which is why Iceberg and Delta Lake replay the same single-pointer trick one layer up.",
        choice: {
          pick: "A mutable (bucket, key) pointer above immutable manifests and immutable pieces",
          instead: "Content addressing, where the name of the bytes is the hash of the bytes and dedup comes free.",
          decider:
            "What deletion costs. Content addressing enforces immutability by construction and dedups repeat uploads, but it makes deletion a reference-counting problem across every key that ever pointed at those bytes, on a path running 1.4M PUT/s where a single lost decrement is permanent. A pointer swap keeps exactly one mutable cell and defers reclamation to a sweep.",
          flips: "Backup and container-image workloads, where the same bytes arrive thousands of times and the dedup saving dwarfs the placement locality you give up.",
        },
      },
    },
    {
      id: "multipart",
      label: "Multipart upload state",
      sub: "upload_id to part rows",
      kind: "database",
      col: 1,
      row: 4,
      detail: {
        what: "Ordinary metadata rows recording (upload_id, part_num) to piece list and etag, for an in-progress manifest reachable from no key.",
        why: "Parts are independent, so re-uploading part 7 replaces one row and orphans its previous pieces while no other part notices. The service holds only the current part's buffer, so server memory is O(part size) rather than O(object) for a 5TB upload.",
        numbers: [
          "max 10,000 parts, 5MB to 5GB each, 5TB effective max object",
          "single PUT capped at 5GB",
          "1TB at 100Mbps is ~22 hours on one session, or 1,000 parts of ~80s",
        ],
        breaks:
          "A client that dies mid-upload leaves parts that are billable forever, which is why lifecycle rules to expire incomplete uploads exist at all: without one, a client that crashed in 2019 is still being charged.",
        choice: {
          pick: "Multipart upload of independently retryable parts with one atomic manifest commit at the end",
          instead: "A single streaming PUT that holds one session open for the whole transfer.",
          decider:
            "Session survival. A 1TB upload at 100Mbps is ~22 hours on one TCP session, which will not survive a load balancer recycle, a NAT timeout or a laptop lid; as 1,000 parts of ~80s each, a failure costs 80 seconds of re-transfer instead of a day.",
          flips: "Objects under the 5GB single-PUT cap that transfer in seconds, where the three-call dance and the orphan-sweep obligation buy nothing.",
        },
      },
    },
    {
      id: "lifecycle",
      label: "Storage class + lifecycle",
      sub: "layout is a per-object property",
      kind: "service",
      col: 1,
      row: 5,
      detail: {
        what: "Evaluates bucket lifecycle rules and rewrites an object's layout: replicas to RS(6,3) to RS(10,4), expiry, and promotion of a hot object back to whole replicas.",
        why: "The layout decision is per object and revisable, not a global constant, because the fleet is bimodal and the crossover between replicas and coding depends on access frequency. Recording the layout in the manifest is what lets a background job change it later without touching the read path.",
        numbers: [
          "tier mix 20% hot at 3x, 50% warm at 1.5x, 30% archive at 1.4x",
          "weighted overhead 1.77x, so 12EB logical is ~21EB physical",
          "128KB minimum billable size on the infrequent-access tier",
        ],
        breaks:
          "Matching the wrong class to the access pattern is only discovered on restore, when an archive retrieval takes hours against a job that expected milliseconds.",
        choice: {
          pick: "Layout recorded per object in the manifest and revised by lifecycle rules",
          instead: "One global layout for the whole fleet, with no tier machinery to maintain.",
          decider:
            "The 1.77x weighted overhead against a flat 3x or a flat 1.5x. Coding a 10KB object gives 9 fragments of ~1.1KB dominated by per-fragment headers and 6 seeks to read it, while replicating 30% archive bytes at 3x instead of 1.4x doubles the fleet's largest cost line.",
          flips: "A single-purpose fleet where every object has the same size and access shape, or one that packs small objects into sealed extents so the small-object case disappears.",
        },
      },
    },
    {
      id: "repair",
      label: "Repair",
      sub: "prioritised by remaining redundancy",
      kind: "service",
      col: 1,
      row: 6,
      parent: "background-plane",
      detail: {
        what: "Detects erasure groups with fewer than 9 healthy fragments, reads k survivors, reconstructs the missing fragments and writes them to healthy nodes.",
        why: "The published durability figure is set by how long an object sits under-replicated, not by the code word, so this job's latency is the durability lever. Groups sitting at exactly k jump the queue because they are one more failure from unrecoverable.",
        numbers: [
          "~29 drive failures/day at 1% AFR on 1.05M drives",
          "580TB/day of reconstruction, ~6.7GB/s, 0.004% of fleet bandwidth",
          "1-hour repair window is what the 17-nines arithmetic assumes",
        ],
        breaks:
          "It is bound by discovery, not bandwidth: a dead drive touches order 1e8 erasure groups, and finding them in a 12PB index is the slow part.",
        choice: {
          pick: "A reverse index from node_id to group_id, written alongside every fragment",
          instead: "Scanning the primary (bucket, key) index to find the groups a dead node participated in.",
          decider:
            "Repair discovery time, which sets the repair window that sets the nines. A node death against the primary index is a scan of 12PB; against the reverse index it is one range read. It costs a second index write on every PUT at 1.4M PUT/s, and it is worth it.",
          flips: "A cluster small enough that the primary index scan finishes inside the target repair window anyway, where the extra write amplification buys nothing.",
        },
      },
    },
    {
      id: "scrub",
      label: "Scrub",
      sub: "90-day rolling re-read",
      kind: "service",
      col: 1,
      row: 7,
      parent: "background-plane",
      detail: {
        what: "Re-reads every stored fragment on a rolling cadence and verifies its checksum, catching silent corruption that never raised a read error.",
        why: "Bit rot flips bits on spinning platters without failing the read, so nothing else in the system will ever notice. Without a proactive re-read, corruption is discovered when a customer GETs the object, by which point the surviving fragments may also have decayed.",
        numbers: [
          "21EB every 90 days is ~2.7TB/s",
          "1.7% of the fleet's 158TB/s aggregate read bandwidth",
          "HDD unrecoverable read error rate ~1e-15",
        ],
        breaks:
          "A cadence that has silently stretched from 90 days to 400 under load is a durability regression that no other metric surfaces, which is why scrub_cycle_days is tracked as an SLO rather than as a dashboard.",
        choice: {
          pick: "Proactive rolling scrub at a fixed bandwidth share, cadence tracked as an SLO",
          instead: "Verify checksums only on read, and repair whatever a customer request happens to find broken.",
          decider:
            "Coverage against cost. Scrub is 2.7TB/s, 1.7% of aggregate read bandwidth, and fits inside a 10% maintenance budget with 5x headroom. Verify-on-read covers only what is read, and the archive tier is precisely the data that is never read and most needs checking.",
          flips: "An all-hot fleet where every object is read many times a month anyway, so read traffic already provides full coverage for free.",
        },
      },
    },
    {
      id: "gc",
      label: "Garbage collection",
      sub: "mark and sweep, 7-day grace",
      kind: "service",
      col: 1,
      row: 8,
      parent: "background-plane",
      detail: {
        what: "Walks reachability from pointer to manifest to piece and reclaims pieces with no referent: aborted uploads, replaced parts and overwritten manifests.",
        why: "Garbage is the price of never mutating anything. Every overwrite, every retried part and every abandoned upload leaves pieces behind, and the only way to know they are dead is a reachability walk over the whole index.",
        numbers: [
          "7-day grace before a piece is swept",
          "reachability runs over ~12PB of index",
          "unreferenced_bytes and sweep cycle time are the alarms",
        ],
        breaks:
          "A stalled sweep shows up as a storage cost anomaly weeks before anything else notices, and the grace period means reclaimed space always lags the delete by a week that the customer is billed for.",
        choice: {
          pick: "Mark and sweep with a 7-day grace period",
          instead: "Reference counting on every manifest write, which is exact and reclaims immediately.",
          decider:
            "Failure mode under write rate. Reference counting adds write amplification to the PUT path and fails permanently on a single lost decrement, which at 1.4M PUT/s is a certainty rather than a risk. Mark and sweep is slower and safe, and the grace period is what stops it sweeping a piece written seconds ago by an upload still in flight.",
          flips: "A low-write system where an exact count is cheap and immediate reclamation matters, for example a small tenant-facing store billed by live bytes.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "cdn",
      label: "GET",
      animated: true,
      detail: {
        what: "Ordinary read traffic arriving at an edge cache rather than at the region.",
        why: "Reads outnumber writes about 10:1 and popular objects are read far more than they change, so the cheapest possible GET is the one that never reaches the origin at all.",
        numbers: ["~14M GET/s in region before caching"],
        breaks:
          "A cache miss storm on a newly popular object sends the full aggregate at the origin at once, which is exactly the 1M req/s hot key case.",
      },
    },
    {
      id: "e2",
      from: "cdn",
      to: "frontend",
      label: "origin miss",
      dashed: true,
      detail: {
        what: "The residual read traffic that the edge could not serve, forwarded to the region.",
        why: "It is drawn as the thin path deliberately: over 99% of hot-object reads are absorbed upstream, and everything below this arrow is sized for what is left plus the cold long tail.",
        numbers: ["over 99% absorbed at the edge"],
        breaks:
          "If the edge is bypassed, the same 9 storage nodes take roughly 111k req/s each and become a bottleneck in a fleet of a million.",
      },
    },
    {
      id: "e3",
      from: "client",
      to: "frontend",
      label: "PUT / DELETE",
      animated: true,
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "Writes and deletes, which are never cacheable and always go to the region.",
        why: "A write has to reach the tier that can commit the pointer, and the ack the client receives is a durability claim, so nothing between here and the metadata commit may shortcut it.",
        numbers: ["~1.4M PUT/s in region", "single PUT capped at 5GB"],
        breaks:
          "A DELETE under versioning writes a delete marker rather than removing anything, which customers reliably misread as a deletion when every byte remains billable and recoverable.",
      },
    },
    {
      id: "e4",
      from: "frontend",
      to: "bucket",
      label: "policy, versioning",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading bucket ownership, access policy, versioning state and object lock before the request is allowed to proceed.",
        why: "Authorisation and versioning semantics are bucket properties, not object properties, so they are resolved once per request against a table that essentially never changes and therefore caches perfectly.",
        numbers: ["read on every request, written almost never"],
        breaks:
          "Cache this too long and a revoked policy keeps authorising requests, which is a security failure rather than a stale read.",
      },
    },
    {
      id: "e5",
      from: "frontend",
      to: "metadata",
      label: "(bucket, key)",
      animated: true,
      detail: {
        what: "The index resolution every single request performs before anything touches a disk.",
        why: "This is the arrow that defines the system, and the missing arrow beside it matters more: there is no path from the frontend to a storage node that skips this hop. That is what makes read-after-write consistency a property rather than a hope.",
        numbers: ["all 15M req/s land here", "served by the shard leader or a lease-holding replica"],
        breaks:
          "Every operation pays this lookup, including a 1KB GET where the index round trip costs more than the read it authorises.",
      },
    },
    {
      id: "e6",
      from: "metadata",
      to: "manifest",
      label: "manifest_id",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Dereferencing the pointer to the immutable manifest describing this object version's parts and fragments.",
        why: "Splitting the pointer from the manifest is what makes the pointer swap atomic and cheap: the mutable cell is a single identifier, and everything it names is write-once and can be shared, cached and read concurrently without locking.",
        numbers: ["one manifest per object version"],
        breaks:
          "A reader that resolved the manifest before an overwrite keeps reading the old bytes to completion, which is correct snapshot behaviour but means an old manifest cannot be reclaimed until its readers drain.",
      },
    },
    {
      id: "e7",
      from: "metadata",
      to: "ec",
      label: "fragment locations",
      animated: true,
      detail: {
        what: "The 9 (node_id, piece_id, frag_idx) triples and the storage class, handed down so the data plane knows which disks to talk to.",
        why: "The data plane is deliberately dumb: it cannot answer where anything is, only give me this piece. Carrying placement down from the index is what lets a fragment be moved or re-encoded later without the key ever changing.",
        numbers: ["9 locations, ~12B each"],
        breaks:
          "Locations that drift from reality after a rebalance mean reads hit dead nodes and fall back to reconstruction, quietly turning a 1-seek path into a 6-seek one.",
      },
    },
    {
      id: "e8",
      from: "frontend",
      to: "ec",
      label: "object bytes",
      animated: true,
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "The payload itself, streamed to the encoder to be split into 6 data and 3 parity fragments.",
        why: "Bytes never travel through the index. Keeping the payload path and the pointer path physically separate is the reason a 12PB NVMe tier and a 21EB HDD tier can be sized, scaled and failed independently.",
        numbers: ["mean object ~310KB", "streamed a part at a time, so memory is O(part size)"],
        breaks:
          "A 5TB object cannot be buffered anywhere in this path, which is precisely why multipart exists rather than being a convenience.",
      },
    },
    {
      id: "e9",
      from: "ec",
      to: "storage",
      label: "write 9, read 6",
      animated: true,
      detail: {
        what: "Fragment traffic: 9 parallel writes on a PUT under anti-affinity, and 6 parallel reads on a GET that needs reconstruction.",
        why: "This fan-out needs no coordination whatsoever, because nobody has ever read the pieces being written and nothing already stored is being modified. That absence of coordination is what lets the data plane be 10,500 dumb servers.",
        numbers: ["max 3 fragments per AZ", "data-plane write 20 to 50ms for a 310KB object"],
        breaks:
          "A read that has to gather 6 fragments costs 6 seeks where a whole replica costs 1, which is why small and hot objects are not erasure coded in the first place.",
      },
    },
    {
      id: "e10",
      from: "ec",
      to: "metadata",
      label: "commit pointer",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 40,
      detail: {
        what: "The single atomic step of the whole write: once every fragment is durable, swap (bucket, key) to the new manifest_id.",
        why: "Before this commit the pieces are useless garbage, and harmless garbage if the commit never happens. After it the object exists, completely, for every reader. There is no intermediate state a client can observe, and no lock was taken to achieve that.",
        numbers: ["Raft commit 1 to 3ms across three AZs", "2 to 10% of PUT latency, 0% of GET latency"],
        breaks:
          "If the leader is lost mid-commit the PUT is simply not acked, the client retries, and the orphaned pieces are left for the sweep, so a failed write costs storage rather than correctness.",
      },
    },
    {
      id: "e11",
      from: "frontend",
      to: "multipart",
      label: "upload_id, part rows",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 110,
      detail: {
        what: "CreateMultipartUpload allocating an upload_id, then one row per UploadPart recording its piece list and etag.",
        why: "Recording parts as ordinary metadata rows is what makes them independently retryable: re-uploading part 7 replaces one row and orphans its old pieces, and no other part and no reader notices.",
        numbers: ["up to 10,000 parts", "parts of 5MB to 5GB"],
        breaks:
          "These rows are reachable from no key, so nothing will ever clean them up on its own; an abandoned upload sits there billable until a lifecycle rule expires it.",
      },
    },
    {
      id: "e12",
      from: "multipart",
      to: "manifest",
      label: "Complete: final manifest",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "CompleteMultipartUpload validating the submitted (part_num, etag) list against the recorded rows and assembling the final immutable manifest.",
        why: "A transfer that may have run for a day collapses into one commit here, which is how atomicity is achieved without ever holding a lock across the upload.",
        numbers: ["final ETag is the MD5 of the concatenated part MD5s, with a -N suffix"],
        breaks:
          "That ETag depends on the part size the client chose, so two byte-identical uploads split differently have different ETags, which is why CRC32C and SHA-256 were added as first-class checksums in February 2022.",
      },
    },
    {
      id: "e13",
      from: "bucket",
      to: "lifecycle",
      label: "lifecycle rules",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 60,
      detail: {
        what: "The per-bucket rules that drive transitions and expiry: move to infrequent access after N days, to archive after M, expire incomplete uploads.",
        why: "Rules live on the bucket because they are a customer policy statement, while the layout they produce lives on the object. Separating the two is what lets one rule change re-tier billions of objects without rewriting the rule per key.",
        numbers: ["evaluated on a daily cadence, not per request"],
        breaks:
          "A rule that transitions objects below the 128KB eligibility floor pays the tier's minimum billable size on every one of them, so the rule costs more than it saves.",
      },
    },
    {
      id: "e14",
      from: "lifecycle",
      to: "ec",
      label: "re-encode on transition",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A background re-encode: read the object at its current layout, rewrite it as RS(10,4) or as whole replicas, and swap the manifest.",
        why: "It is the same build-then-swap move as an ordinary write, which is the payoff of making layout a per-object property: changing a tier is just another immutable build followed by a pointer commit, invisible to any reader.",
        numbers: ["3x to 1.5x to 1.4x across the tiers"],
        breaks:
          "This is also the durable fix for a hot key, promoting it back to whole replicas, and if it lags the traffic spike the special case has to be handled in the read path instead.",
      },
    },
    {
      id: "e15",
      from: "repair",
      to: "storage",
      label: "rebuild from 6 survivors",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Reading k surviving fragments of an under-replicated group, reconstructing the missing ones and writing them to healthy nodes.",
        why: "Every hour an object spends below 9 fragments is an hour of elevated loss probability, and the published nines assume this loop closes in about one hour. The repair window, not the code, is the durability parameter.",
        numbers: ["~29 drives/day, 580TB/day rebuilt", "~6.7GB/s, 0.004% of 158TB/s"],
        breaks:
          "Bandwidth is never the constraint here; without spare capacity in the rack the reconstructed fragments have nowhere to land and the window stretches.",
      },
    },
    {
      id: "e16",
      from: "repair",
      to: "metadata",
      label: "reverse index scan",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A range read of node_id to group_id to enumerate every erasure group a dead node participated in.",
        why: "This exists because the obvious alternative does not scale: finding the affected groups by scanning the primary (bucket, key) index means walking 12PB to service one drive failure. The reverse index turns that into one ordered scan.",
        numbers: ["order 1e8 groups per 20TB drive", "one extra index write per fragment on the PUT path"],
        breaks:
          "It is a second copy of placement data that can drift from the primary, and drift here is invisible until a repair job fails to find groups that genuinely need rebuilding.",
      },
    },
    {
      id: "e17",
      from: "scrub",
      to: "storage",
      label: "re-read every fragment",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A rolling full re-read of all stored bytes with checksum verification, throttled to a fixed share of cluster bandwidth.",
        why: "Silent corruption raises no error, so the only way to find it is to go looking. Throttling rather than racing means the cadence stretches under load instead of scrub competing with foreground reads.",
        numbers: ["21EB per 90 days, ~2.7TB/s", "1.7% of aggregate read bandwidth", "throttled inside a 10% maintenance budget"],
        breaks:
          "This is the real permanent background tax, larger than repair by three orders of magnitude, and it never stops for the life of the fleet.",
      },
    },
    {
      id: "e18",
      from: "scrub",
      to: "repair",
      label: "checksum mismatch",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "A failed checksum handed to repair, which reconstructs the fragment from survivors and overwrites the corrupt copy.",
        why: "Detection and reconstruction are deliberately the same machinery whether a fragment is missing or merely wrong, because a corrupt fragment is simply a lost fragment that the disk still happily returns.",
        numbers: ["HDD unrecoverable read error rate ~1e-15"],
        breaks:
          "A rising mismatch rate concentrated on one drive model is a firmware bug rather than bad luck, and treating it as background noise hides a correlated failure that the durability arithmetic assumes cannot happen.",
      },
    },
    {
      id: "e19",
      from: "gc",
      to: "storage",
      label: "sweep unreferenced",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Deleting pieces that the reachability walk proved nothing points at, once they are older than the grace period.",
        why: "Immutability means space is only ever reclaimed here, never inline with a delete. The grace period exists because a piece written seconds ago may belong to an upload still in flight whose manifest does not exist yet.",
        numbers: ["7-day grace, so reclaimed space lags the delete by a week"],
        breaks:
          "Even after the sweep the blocks are only physically overwritten when the drive next reuses them, which may be never before decommission, so the honest claim to a compliance customer is unreachability plus cryptographic erasure, not physical erasure.",
      },
    },
    {
      id: "e20",
      from: "gc",
      to: "metadata",
      label: "reachability walk",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The mark phase: walk pointer to manifest to piece across the index to build the live set.",
        why: "Reference counting would be exact and immediate, but at 1.4M PUT/s a single lost decrement is a certainty and leaks the space permanently with no way to detect it. A slow, safe, repeatable walk is the trade taken.",
        numbers: ["walk spans ~12PB of index", "sweep cycle time is the metric that matters"],
        breaks:
          "The walk competes with foreground index traffic, so it is rate-limited, and a rate limit set too low lets unreferenced bytes accumulate for weeks before the cost anomaly surfaces.",
      },
    },
  ],
};
