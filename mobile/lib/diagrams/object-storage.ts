import type { Diagram } from "./types";

export const OBJECT_STORAGE: Diagram = {
  id: "object-storage",
  title: "Object Storage",
  question: "Design S3 (Distributed Object Storage)",
  sourceId: "patterns",
  itemId: 21,
  overview: {
    shape:
      "An object store is a small strongly consistent index in front of write-once bytes: no request reaches a disk without resolving through it first.",
    forces: [
      {
        constraint: "40T objects are never modified in place, turning storage into an index problem",
        decision: "split in two: metadata owns the mutable pointer, storage nodes hold immutable piece_id to bytes with no coordination",
        lights: ["metadata", "storage"],
      },
      {
        constraint: "a 20TB HDD costs $0.00025/GB-month against NVMe at roughly 7x that price",
        decision: "keep the 12PB index on NVMe and the 21EB of bytes on dense HDD, sized independently",
        lights: ["metadata", "storage"],
      },
      {
        constraint: "RS(6,3) at 1.5x beats 3x replication, but costs 5 extra seeks per read",
        decision: "record layout per object in the manifest; small and hot objects keep whole replicas",
        lights: ["ec", "lifecycle", "manifest"],
      },
      {
        constraint: "a viral object fans one manifest out to the same 9 storage nodes, ~111k req/s each",
        decision: "put a CDN in front of every GET so a hot key never reaches the origin at full rate",
        lights: ["cdn", "e2"],
      },
      {
        constraint: "independent-failure durability is ~17 nines but only 11 are published",
        decision: "size repair's discovery-and-rebuild latency, not the erasure code, since correlated failure dominates the gap",
        lights: ["repair", "background-plane"],
      },
    ],
    naive: {
      text: "A reader defaults to one filesystem-shaped store: mutable files, in-place edits, one tier holding both the pointer and the bytes. That breaks the moment you need 15M req/s of strong consistency over 21EB of bytes, because a mutable byte store pays coordination cost on every single write. The design splits it instead: the Metadata service owns the one mutable pointer, and Storage nodes hold write-once pieces that need no locking at all.",
      lights: ["metadata", "storage"],
    },
    beats: [
      {
        text: "Everything follows from one property: an object is never modified in place, which turns a storage problem into an index problem. Split the system in two. The metadata service holds 12PB of small mutable records on NVMe and needs consensus. The data plane holds 21EB of large immutable pieces on HDD and needs no coordination at all, because nothing it stores is ever rewritten.",
        lights: ["metadata", "storage"],
      },
      {
        text: "A write lands fresh pieces in the data plane first, which is safe without any locking because nobody has ever read those pieces. It then commits exactly one manifest pointer in metadata. The client sees a 200 only after that commit. An overwrite is the identical operation with a different pointer, so consistency, versioning and resumable upload collapse into one move: build something immutable, then swap one cell.",
        lights: ["ec", "metadata", "e9", "e10"],
      },
      {
        text: "Multipart is the same mechanism with the manifest assembled incrementally. CreateMultipartUpload allocates an upload_id reachable from no key. Each UploadPart writes its pieces and records a (part_num, etag) row. CompleteMultipartUpload validates the list, builds the final manifest and swaps the pointer. That commit is the only atomic step in a transfer that may have run for a day.",
        lights: ["multipart", "manifest", "e11", "e12"],
      },
      {
        text: "Placement is where durability is actually bought. Each piece becomes 6 data and 3 parity fragments under RS(6,3), placed 3-3-3 so no zone holds more than m. That costs 1.5x overhead instead of the 3x a whole replica needs. Layout is a per-object property recorded in the manifest, so small and hot objects keep whole replicas and archive drops to RS(10,4) at 1.4x.",
        lights: ["ec", "manifest", "lifecycle", "e9"],
      },
      {
        text: "Two background jobs then run forever and never finish. Repair rebuilds fragments after a drive dies, prioritised by how little redundancy is left. Scrub re-reads all 21EB on a 90-day cadence to catch silent bit rot that never raises a read error. Garbage collection sweeps pieces orphaned by aborted uploads and overwritten manifests, and all three are throttled to roughly 10% of cluster bandwidth.",
        lights: ["background-plane", "repair", "scrub", "gc"],
      },
      {
        text: "An object store is often treated as one opaque dependency by the systems that call it. What makes that possible is exactly what this design shows. Every consistency guarantee is concentrated into one small index while the bytes underneath are immutable and boring, so none of that complexity ever leaks out to the caller.",
        lights: ["frontend", "metadata"],
      },
    ],
    crux: {
      problem: "The durability number does not come from the erasure code. RS(6,3) tolerates 3 simultaneous fragment losses and nothing more.",
      handled:
        "Eleven nines comes from the ratio between the repair window and the failure interarrival time. Independent failures alone give roughly seventeen nines, so the six-order gap to the published eleven is correlated failure, software defects and operator error. Reaching for a wider code optimises a term already a million times too small to matter.",
    },
    numbers: [
      {
        value: "40T objects in region, ~310KB mean, ~12EB logical",
        explain: "The object population and its mean size multiply to the logical byte total the system is sized against, before storage overhead.",
      },
      {
        value: "15M req/s, all of it through metadata first",
        explain: "Every request, GET or PUT, resolves through the index before touching a disk, making strong consistency structural rather than a promise.",
      },
      {
        value: "RS(6,3) at 1.5x against 3x replicas; 1.77x fleet-weighted",
        explain: "The per-object overhead the erasure code buys over a whole replica; the fleet-weighted figure blends in the hot tier that stays replicated.",
      },
      {
        value: "17 nines from independent failure, 11 published",
        explain: "The six-order gap between independent math and the published figure is correlated failure, software bugs and operator error, not the code's own math.",
      },
    ],
  },
  nodes: [
    {
      id: "background-plane",
      kind: "serviceGroup",
      col: 2,
      row: 3,
      label: "Background plane",
      sub: "repair, scrub, GC — never stops",
      detail: {
        what: "Three jobs that run forever: repair rebuilds fragments, scrub re-reads for silent bit rot, and garbage collection sweeps orphaned pieces.",
        why: "The published durability figure is set by how long an object sits under-replicated, not by the code word, so repair's discovery-and-rebuild latency is the actual durability lever. Scrub exists because bit rot never raises a read error, and GC exists because nothing is ever mutated in place, so every overwrite and abandoned upload leaves bytes behind.",
        numbers: [
          { value: "repair: ~29 drives/day, ~6.7GB/s, 0.004% of fleet bandwidth", explain: "The bandwidth this job actually costs, a small fraction of the fleet's total capacity even at the full failure rate." },
          { value: "scrub: 21EB / 90 days, ~2.7TB/s, 1.7% of aggregate read bandwidth", explain: "The bandwidth a full rolling re-read of the fleet costs, larger than repair by roughly three orders of magnitude." },
          { value: "gc: 7-day grace before a piece is swept", explain: "The delay between a piece becoming unreferenced and its actual deletion, chosen to protect uploads still in flight." },
        ],
        breaks: {
          failure: "All three are throttled to roughly 10% of cluster bandwidth combined.",
          handled: "A cadence that silently stretches under load is a durability regression no other metric surfaces. Repair window and scrub cadence are tracked as explicit SLOs, not left to a dashboard.",
        },
        choice: {
          pick: "One deployable running all three jobs, sharing a single throttled bandwidth budget",
          instead: "Three independent services, each with its own bandwidth allocation and deploy cadence.",
          decider:
            "All three read the same 12PB index and the same 21EB of storage, and none of them serve a foreground request. Splitting them would fragment one ~10% bandwidth throttle into three that have to be rebalanced by hand whenever one job's backlog grows relative to the others.",
          flips:
            "Once one job's resource profile diverges sharply from the others, for example scrub moving onto a dedicated read-optimised tier while repair stays on the main fleet. At that point sharing a throttle stops simplifying and starts bottlenecking.",
        },
      },
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
        why: "It is drawn because the customer's key naming is an input we do not control and cannot fix from inside the storage system. It is also the direct cause of the sequential-prefix hotspot that saturates a single metadata partition.",
        numbers: [
          { value: "objects 1KB to 5TB", explain: "The full size range a single object can span, from a tiny config file to the multipart maximum." },
          { value: "70% under 128KB, median ~10KB", explain: "Most objects are small, exactly the population where erasure coding's per-fragment overhead stops paying for itself." },
        ],
        breaks: {
          failure: "A client that verifies a multipart upload by comparing MD5s discovers in production that the ETag is not the object's digest.",
          handled: "It is the MD5 of the concatenated part MD5s with a -N suffix instead. That is why CRC32C and SHA-256 were added as first-class checksums for clients that need a real digest.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge",
      sub: "absorbs the hot key",
      kind: "external",
      col: 1,
      row: 0,
      detail: {
        what: "Edge caches in front of every GET, serving popular objects close to users without touching the origin at all.",
        why: "A viral thumbnail read 1M times per second resolves to one manifest and fans out to the same 9 storage nodes, roughly 111k req/s each. That saturates them even though the fleet has a million of them. The only real answer for a globally hot object is not to send the reads here.",
        numbers: [
          { value: "over 99% of hot-object reads absorbed", explain: "1% of 1M req/s is ~10k, spread over 9 nodes ≈ 1.1k req/s each — a sliver of the 111k/node the full load would cause." },
          { value: "1M req/s would be ~111k req/s per node at origin", explain: "Without the edge, a viral read fans out to the same 9 storage nodes holding that object's fragments, overwhelming them individually." },
        ],
        breaks: {
          failure: "It does nothing for an in-region hot read that bypasses the edge.",
          handled: "The fallback is shadow replication beyond what the code requires plus round-robin, an operational workaround; the durable fix is a lifecycle rule promoting the object to whole replicas.",
        },
        choice: {
          pick: "CDN in front of all GETs, plus a per-key gateway rate limit at the origin",
          instead: "Shadow-replicating a hot object across more nodes than the erasure code needs and reading round-robin.",
          decider:
            "Where the 1M req/s lands. A CDN removes over 99% of it before it becomes storage load. Shadow replication still lands the full aggregate on the fleet, only spreading the 111k req/s per node across more spindles. The durable fix is a lifecycle rule promoting the object to whole replicas, which also turns a 6-seek read into 1.",
          flips: "In-region access with no edge in the path, where shadow replication is the only lever left and you accept it as a workaround.",
        },
      },
    },
    {
      id: "frontend",
      label: "API frontend",
      sub: "auth, ack after commit",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "The stateless HTTP tier that authenticates the request, applies per-key rate limits, and orchestrates the resolve-then-touch-bytes sequence.",
        why: "It enforces the single rule the whole design rests on: no path reaches bytes without resolving through metadata first, and a PUT is acked only after the metadata pointer commits. That one ordering is what makes strong read-after-write achievable rather than aspirational.",
        numbers: [
          { value: "~15M req/s in region", explain: "The full request volume this tier authenticates and orchestrates, split between reads and writes." },
          { value: "~14M GET/s and ~1.4M PUT/s", explain: "The read:write split, roughly 10:1, that sizes the metadata and data plane very differently." },
          { value: "GET p99 under 100ms in-region", explain: "The latency SLO this tier is held to, dominated by the metadata lookup rather than the byte transfer for a typical small object." },
        ],
        breaks: {
          failure: "Acking before the pointer commits reintroduces the eventual-consistency window.",
          handled: "Every caller that overwrites would then have to build a retry-until-you-see-your-own-write loop, which they get wrong, so the ack is deliberately held until the pointer commit instead.",
        },
        choice: {
          pick: "Strong read-after-write on every operation: ack after the pointer commit, serve pointer reads from the shard leader or a lease-holding replica",
          instead: "Ack as soon as the fragments are durable and let the pointer propagate asynchronously to a replicated read cache.",
          decider:
            "What the commit costs against what its absence costs. A Raft commit across three AZs is 1 to 3ms, while the data-plane write for a 310KB object is 20 to 50ms. Consistency therefore costs 2 to 10% of PUT latency and 0% of GET latency. AWS re-took this trade in December 2020 and shipped it fleet-wide at no measurable latency change.",
          flips: "When the pointer must be visible in more than one region. A cross-region consensus round is 60 to 150ms, 20 to 50x the intra-region commit, so multi-region buckets are eventually consistent by construction.",
        },
      },
    },
    {
      id: "metadata",
      label: "Metadata service",
      sub: "Raft KV, range-partitioned",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "The sharded, consensus-replicated index mapping (bucket, key, version_id) to a manifest_id plus size, etag, storage class and encryption key reference.",
        why: "This is the only mutable cell in the entire system, so all the consistency lives here and the data plane needs none. It also scales on a different axis to the bytes: a customer with a billion tiny objects costs nothing in disks and everything in index.",
        numbers: [
          { value: "~300B per index record, 40T records, ~12PB of index", explain: "The per-record cost times the object population is the total index size, small next to the 21EB of bytes it points at." },
          { value: "4,000 metadata nodes; capacity binds by 40x over throughput", explain: "The fleet is sized by request rate, not by index bytes; storage capacity alone would need far fewer nodes." },
          { value: "~3.75k ops/s per node, 2% of the throughput ceiling", explain: "Ordinary load leaves enormous headroom per node, which is why a single hot prefix concentrating traffic is the failure mode that actually bites." },
        ],
        breaks: {
          failure: "A customer writing logs/YYYY-MM-DD/ at 20k PUT/s lands all of it on one range partition against a ~3,500 PUT/s ceiling.",
          handled: "It takes 503s until the split lands, repeatedly, because tomorrow's date is a fresh hotspot. The mitigation is a randomised prefix or a client-side sharding key, not a server-side fix alone.",
        },
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
      label: "Erasure coder",
      sub: "RS(6,3), max 3 frags per AZ",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "Splits each piece into 6 data and 3 parity fragments with Reed-Solomon, selects 9 nodes under anti-affinity, and reconstructs on read when fragments are missing.",
        why: "It converts a durability requirement into a placement rule. Any 6 of 9 reconstruct the piece, and 3-3-3 across zones means losing an entire availability zone removes exactly 3 fragments and leaves exactly the 6 needed. That costs 1.5x storage instead of the 200% overhead of three whole copies.",
        numbers: [
          { value: "RS(6,3): 9 fragments, any 6 reconstruct", explain: "The code's defining property: the piece survives the loss of any 3 of its 9 fragments." },
          { value: "1.5x overhead against 3x replication", explain: "The storage cost of the code compared to keeping three whole copies of the same bytes." },
          { value: "167KB fragments for a 1MB object", explain: "Each of the 9 fragments a 1MB piece splits into, sized so the whole set reconstructs the original." },
        ],
        breaks: {
          failure: "Placement must refuse a write that violates anti-affinity.",
          handled: "Once too many fragments share a zone, a single zone outage takes the object below k. No repair job can help, since the survivors are not enough to reconstruct from.",
        },
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
      col: 2,
      row: 2,
      detail: {
        what: "A fleet of dense disk servers holding a flat piece_id to bytes map and no other logic at all.",
        why: "Everything intelligent was deliberately pushed up into metadata so this tier can be the cheapest possible bulk medium. It also scales purely on bytes, so adding capacity for a bandwidth-heavy workload never requires buying index IOPS.",
        numbers: [
          { value: "~21EB physical at 1.77x weighted overhead", explain: "The physical bytes stored across every tier's overhead, blended by how much of the fleet sits in each tier." },
          { value: "~1.05M drives of 20TB, ~10,500 servers at 100 drives each", explain: "The physical fleet size this capacity is built from, at today's commodity drive density." },
          { value: "aggregate read bandwidth ~158TB/s", explain: "The fleet-wide read capacity that scrub, repair and foreground GETs all compete for a share of." },
        ],
        breaks: {
          failure: "A dead 20TB drive holds fragments for order 1e8 erasure groups.",
          handled: "The expensive part of losing it is not rebuilding 20TB. It is finding which groups were affected, why a reverse index from node to group exists to make that lookup fast.",
        },
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
      col: 0,
      row: 1,
      detail: {
        what: "Bucket-level configuration: owner, region, access policies, versioning on or off, lifecycle rules, object lock.",
        why: "Bucket state is rare, small and rarely changed, so it has nothing in common with an index of 40 trillion objects. Keeping it separate means the hot path can cache it aggressively rather than paying an index shard for a value that changes once a year.",
        numbers: [
          { value: "one row per bucket against 40T object rows", explain: "Bucket count sits in the millions while object count sits in the trillions, a gap that justifies a separate, tiny store." },
          { value: "read on every one of 15M req/s, written almost never", explain: "The read:write ratio that makes this table cache almost perfectly, unlike the object index it sits beside." },
        ],
        breaks: {
          failure: "If a policy change is cached too long the frontend authorises against stale rules.",
          handled: "That is an access-control failure rather than a performance one, so the cache TTL on bucket policy is kept short enough that a revoke takes effect within seconds.",
        },
        choice: {
          pick: "A small replicated SQL database, separate from the object index",
          instead: "Storing bucket config as rows in the same sharded KV that holds the 12PB object index.",
          decider:
            "Cardinality and change rate. Buckets number in the millions against 40T objects. They are read on every one of 15M req/s but written essentially never, so they cache perfectly and want joins and constraints rather than range-partitioned scale.",
          flips: "If buckets ever became numerous enough to outgrow one replicated database, at which point they are just another sharded namespace and the distinction stops paying for itself.",
        },
      },
    },
    {
      id: "manifest",
      label: "Manifest store",
      sub: "immutable, write-once",
      kind: "database",
      col: 3,
      row: 1,
      detail: {
        what: "Immutable records keyed by manifest_id, each listing the object's parts and, for every part, its fragments and their node locations.",
        why: "Three levels and every level except the top pointer is write-once. An in-flight GET that already resolved a manifest_id keeps reading valid bytes to completion even through an overwrite, because the manifest it holds cannot be edited out from under it. That is snapshot isolation you get for free rather than implement.",
        numbers: [
          { value: "fragment list ~108B, 9 entries of 12B", explain: "9 entries matches the 9-node fragment spread mentioned for a hot object above — at 108B per part, a 5TB object's manifest stays trivially small." },
          { value: "one manifest per object version", explain: "Versioning multiplies manifests, not pointers; each version gets its own immutable manifest while the pointer only ever names the current one." },
        ],
        breaks: {
          failure: "The swap is atomic for exactly one key.",
          handled: "Replacing 400 parquet files as a unit is not expressible this way, which is why Iceberg and Delta Lake replay the same single-pointer trick one layer up, above this system.",
        },
        choice: {
          pick: "A mutable (bucket, key) pointer above immutable manifests and immutable pieces",
          instead: "Content addressing, where the name of the bytes is the hash of the bytes and dedup comes free.",
          decider:
            "What deletion costs. Content addressing enforces immutability by construction and dedups repeat uploads. But it makes deletion a reference-counting problem across every key that ever pointed at those bytes, on a path running 1.4M PUT/s where a single lost decrement is permanent. A pointer swap keeps exactly one mutable cell and defers reclamation to a sweep.",
          flips: "Backup and container-image workloads, where the same bytes arrive thousands of times and the dedup saving dwarfs the placement locality you give up.",
        },
      },
    },
    {
      id: "multipart",
      label: "Multipart upload state",
      sub: "upload_id to part rows",
      kind: "database",
      col: 3,
      row: 2,
      detail: {
        what: "Ordinary metadata rows recording (upload_id, part_num) to piece list and etag, for an in-progress manifest reachable from no key.",
        why: "Parts are independent, so re-uploading part 7 replaces one row and orphans its previous pieces while no other part notices. The service holds only the current part's buffer, so server memory is O(part size) rather than O(object) for a 5TB upload.",
        numbers: [
          { value: "max 10,000 parts, 5MB to 5GB each, 5TB effective max object", explain: "The part-count and part-size limits multiply out to the largest object the system can accept in one upload." },
          { value: "single PUT capped at 5GB", explain: "The ceiling on a non-multipart write, above which a client is forced onto the multipart path." },
          { value: "1TB at 100Mbps is ~22 hours on one session, or 1,000 parts of ~80s", explain: "The same transfer as one long session versus many short, independently retryable parts, the whole argument for multipart." },
        ],
        breaks: {
          failure: "A client that dies mid-upload leaves parts that are billable forever.",
          handled: "This is why lifecycle rules to expire incomplete uploads exist at all; without one, a client that crashed years ago is still being charged today.",
        },
        choice: {
          pick: "Multipart upload of independently retryable parts with one atomic manifest commit at the end",
          instead: "A single streaming PUT that holds one session open for the whole transfer.",
          decider:
            "Session survival. A 1TB upload at 100Mbps is ~22 hours on one TCP session, which will not survive a load balancer recycle, a NAT timeout or a laptop lid. As 1,000 parts of ~80s each, a failure instead costs 80 seconds of re-transfer instead of a day.",
          flips: "Objects under the 5GB single-PUT cap that transfer in seconds, where the three-call dance and the orphan-sweep obligation buy nothing.",
        },
      },
    },
    {
      id: "lifecycle",
      label: "Storage lifecycle",
      sub: "layout is a per-object property",
      kind: "service",
      col: 0,
      row: 2,
      detail: {
        what: "Evaluates bucket lifecycle rules and rewrites an object's layout: replicas to RS(6,3) to RS(10,4), expiry, and promotion of a hot object back to whole replicas.",
        why: "The layout decision is per object and revisable, not a global constant, because the fleet is bimodal and the crossover between replicas and coding depends on access frequency. Recording the layout in the manifest is what lets a background job change it later without touching the read path.",
        numbers: [
          { value: "tier mix 20% hot at 3x, 50% warm at 1.5x, 30% archive at 1.4x", explain: "The population split across storage classes that produces the fleet's blended overhead figure." },
          { value: "weighted overhead 1.77x, so 12EB logical is ~21EB physical", explain: "The blended overhead across all three tiers, applied to the logical byte total to get the actual physical footprint." },
          { value: "128KB minimum billable size on the infrequent-access tier", explain: "A floor below which a small object is billed as this size, since storing it smaller costs more in overhead than it saves." },
        ],
        breaks: {
          failure: "Matching the wrong class to the access pattern is only discovered on restore.",
          handled: "An archive retrieval takes hours against a job that expected milliseconds, so retrieval time is surfaced when a lifecycle rule is created, not left to be discovered during an incident.",
        },
        choice: {
          pick: "Layout recorded per object in the manifest and revised by lifecycle rules",
          instead: "One global layout for the whole fleet, with no tier machinery to maintain.",
          decider:
            "The 1.77x weighted overhead against a flat 3x or a flat 1.5x. Coding a 10KB object gives 9 fragments of ~1.1KB dominated by per-fragment headers and 6 seeks to read it. Replicating 30% archive bytes at 3x instead of 1.4x, meanwhile, doubles the fleet's largest cost line.",
          flips: "A single-purpose fleet where every object has the same size and access shape, or one that packs small objects into sealed extents so the small-object case disappears.",
        },
      },
    },
    {
      id: "repair",
      kind: "process",
      label: "Repair",
      sub: "prioritised by low redundancy",
      col: 1,
      row: 3,
      parent: "background-plane",
      detail: {
        what: "Detects erasure groups with fewer than 9 healthy fragments, reads k survivors, reconstructs the missing fragments and writes them to healthy nodes.",
        why: "The published durability figure is set by how long an object sits under-replicated, not by the code word, so this job's latency is the durability lever. Groups sitting at exactly k jump the queue because they are one more failure from unrecoverable.",
        numbers: [
          { value: "~29 drive failures/day at 1% AFR on 1.05M drives", explain: "The steady-state failure rate this job has to keep pace with, derived directly from the fleet's annualised failure rate." },
          { value: "580TB/day of reconstruction, ~6.7GB/s, 0.004% of fleet bandwidth", explain: "The bandwidth cost of rebuilding every failed drive's fragments, a tiny fraction of the fleet's total capacity." },
          { value: "1-hour repair window is what the 17-nines arithmetic assumes", explain: "The discovery-and-rebuild latency the published durability figure is actually calibrated against, not the code's own math." },
        ],
        breaks: {
          failure: "It is bound by discovery, not bandwidth.",
          handled: "A dead drive touches order 1e8 erasure groups, and finding them in a 12PB index is the slow part. The reverse index makes that lookup a range read instead of a full scan.",
        },
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
      kind: "process",
      label: "Scrub",
      sub: "90-day rolling re-read",
      col: 2,
      row: 3,
      parent: "background-plane",
      detail: {
        what: "Re-reads every stored fragment on a rolling cadence and verifies its checksum, catching silent corruption that never raised a read error.",
        why: "Bit rot flips bits on spinning platters without failing the read, so nothing else in the system will ever notice. Without a proactive re-read, corruption is discovered when a customer GETs the object, by which point the surviving fragments may also have decayed.",
        numbers: [
          { value: "21EB every 90 days is ~2.7TB/s", explain: "The bandwidth a full rolling re-read of the fleet requires to complete once every 90 days." },
          { value: "1.7% of the fleet's 158TB/s aggregate read bandwidth", explain: "That bandwidth cost as a share of what the fleet can read in total, small enough to fit inside the maintenance budget." },
          { value: "HDD unrecoverable read error rate ~1e-15", explain: "The per-bit error rate that makes silent corruption a real, if rare, event across an exabyte-scale fleet." },
        ],
        breaks: {
          failure: "A cadence that has silently stretched from 90 days to 400 under load is a durability regression that no other metric surfaces.",
          handled: "This is why scrub_cycle_days is tracked as an explicit SLO rather than as a dashboard number nobody checks.",
        },
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
      kind: "process",
      label: "Garbage collection",
      sub: "mark and sweep, 7-day grace",
      col: 3,
      row: 3,
      parent: "background-plane",
      detail: {
        what: "Walks reachability from pointer to manifest to piece and reclaims pieces with no referent: aborted uploads, replaced parts and overwritten manifests.",
        why: "Garbage is the price of never mutating anything. Every overwrite, every retried part and every abandoned upload leaves pieces behind, and the only way to know they are dead is a reachability walk over the whole index.",
        numbers: [
          { value: "7-day grace before a piece is swept", explain: "The delay chosen to protect a piece belonging to an upload still in flight when its manifest does not yet exist." },
          { value: "reachability runs over ~12PB of index", explain: "The full size of the mark phase's scan, run against the same index every foreground request also reads." },
          { value: "2 alarms: unreferenced_bytes and sweep cycle time", explain: "The two signals that catch a stalled or slow sweep before it becomes an unexplained storage cost." },
        ],
        breaks: {
          failure: "A stalled sweep shows up as a storage cost anomaly weeks before anything else notices.",
          handled: "The grace period also means reclaimed space always lags the delete by a week that the customer is billed for, an accepted cost of protecting in-flight uploads.",
        },
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
      tier: "hot",
      step: 5,
      label: "GET",
      detail: {
        what: "Ordinary read traffic arriving at an edge cache rather than at the region.",
        why: "Reads outnumber writes about 10:1 and popular objects are read far more than they change, so the cheapest possible GET is the one that never reaches the origin at all.",
        numbers: [{ value: "~14M GET/s in region before caching", explain: "The full read volume before the CDN absorbs the vast majority of it." }],
        breaks: {
          failure: "A cache miss storm on a newly popular object sends the full aggregate at the origin at once.",
          handled: "That is exactly the 1M req/s hot key case; the durable fix is promoting the object to whole replicas via a lifecycle rule rather than relying on the cache alone.",
        },
      },
    },
    {
      id: "e2",
      from: "cdn",
      to: "frontend",
      tier: "control",
      label: "origin miss",
      detail: {
        what: "The residual read traffic that the edge could not serve, forwarded to the region.",
        why: "It is deliberately the thin path: over 99% of hot-object reads are absorbed upstream, and everything below this arrow is sized for what is left plus the cold long tail.",
        numbers: [{ value: "over 99% absorbed at the edge", explain: "Under 1% of the ~14M GET/s arriving at the edge reaches this arrow — order 140k/s or less, not the full read volume." }],
        breaks: {
          failure: "If the edge is bypassed, the same 9 storage nodes take roughly 111k req/s each.",
          handled: "That becomes a bottleneck in a fleet of a million drives, so bypassing the edge for in-region reads is treated as an incident trigger, not a normal path.",
        },
      },
    },
    {
      id: "e3",
      from: "client",
      to: "frontend",
      tier: "hot",
      step: 1,
      label: "PUT / DELETE",
      detail: {
        what: "Writes and deletes, which are never cacheable and always go to the region.",
        why: "A write has to reach the tier that can commit the pointer. The ack the client receives is a durability claim, so nothing between here and the metadata commit may shortcut it.",
        numbers: [
          { value: "~1.4M PUT/s in region", explain: "The full write volume this arrow carries, roughly a tenth of the read volume." },
          { value: "single PUT capped at 5GB", explain: "The size above which a client must use multipart instead of a single request." },
        ],
        breaks: {
          failure: "A DELETE under versioning writes a delete marker rather than removing anything.",
          handled: "Customers reliably misread that as a deletion when every byte remains billable and recoverable, so the UI and billing both surface delete markers explicitly rather than hiding them.",
        },
      },
    },
    {
      id: "e4",
      from: "frontend",
      to: "bucket",
      tier: "control",
      label: "policy, versioning",
      detail: {
        what: "Reading bucket ownership, access policy, versioning state and object lock before the request is allowed to proceed.",
        why: "Authorisation and versioning semantics are bucket properties, not object properties, so they are resolved once per request against a table that essentially never changes and therefore caches perfectly.",
        numbers: [{ value: "read on every one of 15M req/s, written almost never", explain: "The read:write ratio that lets this lookup be cached aggressively without a meaningful staleness cost." }],
        breaks: {
          failure: "Cache this too long and a revoked policy keeps authorising requests.",
          handled: "That is a security failure rather than a stale read, so the policy cache TTL is kept short enough that a revoke takes effect within seconds.",
        },
      },
    },
    {
      id: "e5",
      from: "frontend",
      to: "metadata",
      tier: "hot",
      step: 6,
      label: "(bucket, key)",
      detail: {
        what: "The index resolution every single request performs before anything touches a disk.",
        why: "This is the arrow that defines the system. The missing arrow beside it matters more: there is no path from the frontend to a storage node that skips this hop.",
        numbers: [
          { value: "all 15M req/s land here", explain: "Every single request, without exception, resolves through this lookup before touching a byte of storage." },
          { value: "1 shard leader or a lease-holding replica serves each read", explain: "The read is served from a node guaranteed to hold the current committed state, which is what makes it strongly consistent." },
        ],
        breaks: {
          failure: "Every operation pays this lookup, including a 1KB GET where the index round trip costs more than the read it authorises.",
          handled: "This cost is accepted deliberately, since it is the one hop that makes read-after-write consistency a structural guarantee rather than a hope.",
        },
      },
    },
    {
      id: "e6",
      from: "metadata",
      to: "manifest",
      tier: "data",
      label: "manifest_id",
      detail: {
        what: "Dereferencing the pointer to the immutable manifest describing this object version's parts and fragments.",
        why: "Splitting the pointer from the manifest is what makes the pointer swap atomic and cheap. The mutable cell is a single identifier, and everything it names is write-once. It can be shared, cached and read concurrently without locking.",
        numbers: [{ value: "one manifest per object version", explain: "Every version an object accumulates under versioning gets its own immutable manifest, never edited or shared." }],
        breaks: {
          failure: "A reader that resolved the manifest before an overwrite keeps reading the old bytes to completion.",
          handled: "This is correct snapshot behaviour, but it means an old manifest cannot be reclaimed until its readers drain, which the garbage collector's grace period accounts for.",
        },
      },
    },
    {
      id: "e7",
      from: "metadata",
      to: "ec",
      tier: "hot",
      step: 7,
      label: "fragment locations",
      detail: {
        what: "The 9 (node_id, piece_id, frag_idx) triples and the storage class, handed down so the data plane knows which disks to talk to.",
        why: "The data plane is deliberately dumb: it cannot answer where anything is, only give me this piece. Carrying placement down from the index is what lets a fragment be moved or re-encoded later without the key ever changing.",
        numbers: [{ value: "9 locations, ~12B each", explain: "The full fragment location list handed down for one piece, small enough to pass along with every request that needs it." }],
        breaks: {
          failure: "Locations that drift from reality after a rebalance mean reads hit dead nodes and fall back to reconstruction.",
          handled: "That quietly turns a 1-seek path into a 6-seek one, so location drift is tracked as its own latency regression rather than only as an error rate.",
        },
      },
    },
    {
      id: "e8",
      from: "frontend",
      to: "ec",
      tier: "hot",
      step: 2,
      label: "object bytes",
      detail: {
        what: "The payload itself, streamed to the encoder to be split into 6 data and 3 parity fragments.",
        why: "Bytes never travel through the index. Keeping the payload path and the pointer path physically separate is the reason a 12PB NVMe tier and a 21EB HDD tier can be sized, scaled and failed independently.",
        numbers: [
          { value: "mean object ~310KB", explain: "The average payload size streamed down this arrow, small enough that most writes complete in tens of milliseconds." },
          { value: "memory bounded by 1 part in flight (5MB-5GB), not the whole object", explain: "Server memory scales with one part's buffer, not the object's total size, which is what makes a 5TB upload possible." },
        ],
        breaks: {
          failure: "A 5TB object cannot be buffered anywhere in this path.",
          handled: "This is precisely why multipart exists rather than being a convenience: each part streams through independently rather than requiring the whole object in memory at once.",
        },
      },
    },
    {
      id: "e9",
      from: "ec",
      to: "storage",
      tier: "hot",
      step: 3,
      label: "write 9, read 6",
      detail: {
        what: "Fragment traffic: 9 parallel writes on a PUT under anti-affinity, and 6 parallel reads on a GET that needs reconstruction.",
        why: "This fan-out needs no coordination whatsoever, because nobody has ever read the pieces being written and nothing already stored is being modified. That absence of coordination is what lets the data plane be 10,500 dumb servers.",
        numbers: [
          { value: "max 3 fragments per AZ", explain: "The anti-affinity limit that guarantees losing one availability zone removes at most 3 of the 9 fragments." },
          { value: "data-plane write 20 to 50ms for a 310KB object", explain: "This fan-out dominates PUT latency — the commit that follows costs only 2-10% of it, and a GET pays none of it." },
        ],
        breaks: {
          failure: "A read that has to gather 6 fragments costs 6 seeks where a whole replica costs 1.",
          handled: "This is why small and hot objects are not erasure coded in the first place; the lifecycle service keeps them on whole replicas instead.",
        },
      },
    },
    {
      id: "e10",
      from: "ec",
      to: "metadata",
      tier: "hot",
      step: 4,
      label: "commit pointer",
      detail: {
        what: "The single atomic step of the whole write: once every fragment is durable, swap (bucket, key) to the new manifest_id.",
        why: "Before this commit the pieces are useless garbage, and harmless garbage if the commit never happens. After it the object exists, completely, for every reader. There is no intermediate state a client can observe, and no lock was taken to achieve that.",
        numbers: [
          { value: "Raft commit 1 to 3ms across three AZs", explain: "The one coordinated step in an otherwise coordination-free write — fragment writes upstream need none, but this pointer swap needs Raft consensus across 3 AZs." },
          { value: "2 to 10% of PUT latency, 0% of GET latency", explain: "1-3ms of commit against a ~21-53ms total PUT is roughly this 2-10% — a GET pays none of it, reading only an already-swapped pointer." },
        ],
        breaks: {
          failure: "If the leader is lost mid-commit the PUT is simply not acked.",
          handled: "The client retries, and the orphaned pieces are left for the sweep, so a failed write costs storage rather than correctness.",
        },
      },
    },
    {
      id: "e11",
      from: "frontend",
      to: "multipart",
      tier: "control",
      label: "upload_id, part rows",
      detail: {
        what: "CreateMultipartUpload allocating an upload_id, then one row per UploadPart recording its piece list and etag.",
        why: "Recording parts as ordinary metadata rows is what makes them independently retryable. Re-uploading part 7 replaces one row and orphans its old pieces, and no other part and no reader notices.",
        numbers: [
          { value: "up to 10,000 parts", explain: "The maximum number of independently retryable pieces one multipart upload can be split into." },
          { value: "parts of 5MB to 5GB", explain: "The size bounds on each part, chosen so retrying one part is always a small, bounded cost." },
        ],
        breaks: {
          failure: "These rows are reachable from no key, so nothing will ever clean them up on its own.",
          handled: "An abandoned upload sits there billable until a lifecycle rule expires it, which is why expiring incomplete uploads is treated as a required rule, not an optional one.",
        },
      },
    },
    {
      id: "e12",
      from: "multipart",
      to: "manifest",
      tier: "data",
      label: "Complete: final manifest",
      detail: {
        what: "CompleteMultipartUpload validating the submitted (part_num, etag) list against the recorded rows and assembling the final immutable manifest.",
        why: "A transfer that may have run for a day collapses into one commit here, which is how atomicity is achieved without ever holding a lock across the upload.",
        numbers: [{ value: "final ETag is the MD5 of the concatenated part MD5s, with a -N suffix", explain: "The mechanical rule for how the ETag is computed, why it is not simply the MD5 of the object's bytes." }],
        breaks: {
          failure: "That ETag depends on the part size the client chose.",
          handled: "Two byte-identical uploads split differently have different ETags, which is why CRC32C and SHA-256 were added as first-class checksums in February 2022.",
        },
      },
    },
    {
      id: "e13",
      from: "bucket",
      to: "lifecycle",
      tier: "control",
      label: "lifecycle rules",
      detail: {
        what: "The per-bucket rules that drive transitions and expiry: move to infrequent access after N days, to archive after M, expire incomplete uploads.",
        why: "Rules live on the bucket because they are a customer policy statement, while the layout they produce lives on the object. Separating the two is what lets one rule change re-tier billions of objects without rewriting the rule per key.",
        numbers: [{ value: "evaluated once a day, not per request", explain: "The cadence lifecycle rules run on, cheap enough to sweep billions of objects without touching the request path at all." }],
        breaks: {
          failure: "A rule that transitions objects below the 128KB eligibility floor pays the tier's minimum billable size on every one of them.",
          handled: "The rule then costs more than it saves, so eligibility floors are checked before a transition rule is allowed to apply, not only enforced at billing time.",
        },
      },
    },
    {
      id: "e14",
      from: "lifecycle",
      to: "ec",
      tier: "control",
      label: "re-encode on transition",
      detail: {
        what: "A background re-encode: read the object at its current layout, rewrite it as RS(10,4) or as whole replicas, and swap the manifest.",
        why: "It is the same build-then-swap move as an ordinary write, the payoff of making layout a per-object property. Changing a tier is just another immutable build followed by a pointer commit, invisible to any reader.",
        numbers: [{ value: "3x to 1.5x to 1.4x across the tiers", explain: "The overhead an object moves through as it transitions from hot replicas down to warm and archive coding." }],
        breaks: {
          failure: "This is also the durable fix for a hot key, promoting it back to whole replicas.",
          handled: "If it lags the traffic spike, the special case has to be handled in the read path instead, which is why a promotion can also be triggered manually.",
        },
      },
    },
    {
      id: "e15",
      from: "repair",
      to: "storage",
      tier: "data",
      label: "rebuild from 6 survivors",
      detail: {
        what: "Reading k surviving fragments of an under-replicated group, reconstructing the missing ones and writing them to healthy nodes.",
        why: "Every hour an object spends below 9 fragments is an hour of elevated loss probability, and the published nines assume this loop closes in about one hour. The repair window, not the code, is the durability parameter.",
        numbers: [
          { value: "~29 drives/day, 580TB/day rebuilt", explain: "The daily reconstruction volume this job sustains, driven directly by the fleet's failure rate." },
          { value: "~6.7GB/s, 0.004% of 158TB/s", explain: "That volume expressed as bandwidth, a negligible fraction of the fleet's total read capacity." },
        ],
        breaks: {
          failure: "Bandwidth is never the constraint here.",
          handled: "Without spare capacity in the rack the reconstructed fragments have nowhere to land and the window stretches, so rack headroom, not bandwidth, is what capacity planning watches.",
        },
      },
    },
    {
      id: "e16",
      from: "repair",
      to: "metadata",
      tier: "data",
      label: "reverse index scan",
      detail: {
        what: "A range read of node_id to group_id to enumerate every erasure group a dead node participated in.",
        why: "This exists because the obvious alternative does not scale: finding the affected groups by scanning the primary (bucket, key) index means walking 12PB to service one drive failure. The reverse index turns that into one ordered scan.",
        numbers: [
          { value: "order 1e8 groups per 20TB drive", explain: "20TB ÷ ~310KB mean object size ≈ 6.5×10^7 objects, each its own erasure group — why a per-drive scan replaces walking the full 12PB index." },
          { value: "one extra index write per fragment on the PUT path", explain: "The cost this reverse index adds to every write, paid to make repair discovery a range read instead of a full scan." },
        ],
        breaks: {
          failure: "It is a second copy of placement data that can drift from the primary.",
          handled: "Drift here is invisible until a repair job fails to find groups that genuinely need rebuilding, so the two indexes are reconciled on a periodic consistency check.",
        },
      },
    },
    {
      id: "e17",
      from: "scrub",
      to: "storage",
      tier: "data",
      label: "re-read every fragment",
      detail: {
        what: "A rolling full re-read of all stored bytes with checksum verification, throttled to a fixed share of cluster bandwidth.",
        why: "Silent corruption raises no error, so the only way to find it is to go looking. Throttling rather than racing means the cadence stretches under load instead of scrub competing with foreground reads.",
        numbers: [
          { value: "21EB per 90 days, ~2.7TB/s", explain: "The bandwidth this rolling re-read costs to complete one full pass over the fleet in 90 days." },
          { value: "1.7% of aggregate read bandwidth", explain: "That cost as a share of the fleet's total read capacity, comfortably inside the maintenance budget." },
          { value: "throttled inside a 10% maintenance budget", explain: "The cap this job, repair and GC share, chosen so background work never meaningfully competes with foreground reads." },
        ],
        breaks: {
          failure: "This is the real permanent background tax, larger than repair by three orders of magnitude.",
          handled: "It never stops for the life of the fleet, so its bandwidth share is provisioned as a permanent cost line rather than treated as occasional maintenance.",
        },
      },
    },
    {
      id: "e18",
      from: "scrub",
      to: "repair",
      tier: "control",
      label: "checksum mismatch",
      detail: {
        what: "A failed checksum handed to repair, which reconstructs the fragment from survivors and overwrites the corrupt copy.",
        why: "Detection and reconstruction are deliberately the same machinery, whether a fragment is missing or merely wrong. A corrupt fragment is simply a lost fragment that the disk still happily returns.",
        numbers: [{ value: "HDD unrecoverable read error rate ~1e-15", explain: "The per-bit error rate that makes silent corruption a real event at exabyte scale, the reason scrub exists at all." }],
        breaks: {
          failure: "A rising mismatch rate concentrated on one drive model is a firmware bug rather than bad luck.",
          handled: "Treating it as background noise hides a correlated failure the durability arithmetic assumes cannot happen, so mismatch rate is tracked per drive model, not only in aggregate.",
        },
      },
    },
    {
      id: "e19",
      from: "gc",
      to: "storage",
      tier: "data",
      label: "sweep unreferenced",
      detail: {
        what: "Deleting pieces that the reachability walk proved nothing points at, once they are older than the grace period.",
        why: "Immutability means space is only ever reclaimed here, never inline with a delete. The grace period exists because a piece written seconds ago may belong to an upload still in flight whose manifest does not exist yet.",
        numbers: [{ value: "7-day grace, so reclaimed space lags the delete by a week", explain: "The delay between a delete and the actual reclamation of its bytes, chosen to protect uploads still in flight." }],
        breaks: {
          failure: "Even after the sweep the blocks are only physically overwritten when the drive next reuses them.",
          handled: "That may be never before decommission, so the honest claim to a compliance customer is unreachability plus cryptographic erasure, not physical erasure.",
        },
      },
    },
    {
      id: "e20",
      from: "gc",
      to: "metadata",
      tier: "data",
      label: "reachability walk",
      detail: {
        what: "The mark phase: walk pointer to manifest to piece across the index to build the live set.",
        why: "Reference counting would be exact and immediate, but at 1.4M PUT/s a single lost decrement is a certainty and leaks the space permanently with no way to detect it. A slow, safe, repeatable walk is the trade taken.",
        numbers: [
          { value: "walk spans ~12PB of index", explain: "The full size of the index this mark phase has to traverse to build the live reachable set." },
          { value: "sweep cycle time, 1 of the 2 GC alarms", explain: "One of the two signals monitored to catch a walk that has slowed or stalled before it becomes a cost anomaly." },
        ],
        breaks: {
          failure: "The walk competes with foreground index traffic, so it is rate-limited.",
          handled: "A rate limit set too low lets unreferenced bytes accumulate for weeks before the cost anomaly surfaces, so the limit is tuned against the sweep-cycle-time alarm.",
        },
      },
    },
  ],
  figures: {
    "pointer-swap": {
      title: "A reader keeps its manifest; a writer swaps the pointer",
      nodes: [
        { id: "v1", label: "Manifest v1", sub: "immutable", kind: "blob", col: 0, row: 0 },
        { id: "v2", label: "Manifest v2", sub: "immutable, freshly written", kind: "blob", col: 1, row: 0 },
        {
          id: "reader",
          label: "Reader",
          sub: "resolved v1, still reading",
          kind: "client",
          col: 0,
          row: 1,
          detail: {
            what: "A GET that already resolved the (bucket, key) pointer to manifest v1 before the overwrite committed.",
            why: "Because v1 is never edited, only superseded, the reader keeps reading valid bytes to completion regardless of what happens to the pointer afterwards.",
          },
        },
        {
          id: "pointer",
          label: "Pointer now points to v2",
          sub: "the one mutable cell",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "The (bucket, key, version_id) → manifest_id mapping, atomically swapped to v2 once its fragments are durably written.",
            why: "This swap is the only mutation in the whole system. Nothing else needs a lock because nothing else is ever edited in place.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "v1", to: "reader", tier: "hot", step: 1, label: "resolved before the swap" },
        { id: "e2", from: "v2", to: "pointer", tier: "hot", step: 2, label: "commit swaps pointer" },
      ],
    },
  },
};
