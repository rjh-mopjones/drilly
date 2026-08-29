import type { Diagram } from "./types";

export const DISTRIBUTED_KV_STORE: Diagram = {
  id: "distributed-kv-store",
  title: "Distributed KV Store",
  question: "Design a Distributed Key-Value Store (Dynamo-style)",
  sourceId: "patterns",
  itemId: 3,
  overview: {
    shape:
      "A leaderless ring where any node can coordinate: it hashes the key to its N=3 owners, fans the request to all of them, answers the client after W acknowledgements or R responses, and then spends the rest of its life converging the replicas it deliberately left behind.",
    beats: [
      "Everything follows from one refusal: no key has a leader. Give that up and availability stops depending on any particular machine being alive, but you now allow two clients to write the same key at once, and every remaining decision is about where you pay for that.",
      "Placement is arithmetic, not lookup. The coordinator hashes the key onto the consistent hashing ring and reads off the N nodes that own that range, so there is no placement service to fail and any of the 128 nodes in a region can serve any request without holding the data itself.",
      "The quorum is the load-bearing line. W + R > N means the set that acknowledged a write and the set that answered a read must share a member, so with N=3 you need W + R at least 4, and W=R=2 is the cheapest pair that holds while tolerating one dead or slow replica on each path.",
      "Locally each replica is a log structured merge tree: writes append to a commit log and a sorted in-memory table, flush to immutable files, and compact in the background. Writes are sequential and cheap; point reads cost one or two file opens once a Bloom filter per file rules the rest out.",
      "Divergence is the steady state rather than a fault, because W=2 leaves one replica behind on every one of 200k writes per second. Three mechanisms converge it on three timescales and each covers the previous one's hole: read repair fixes what a read notices, hinted handoff parks writes for three hours, Merkle anti-entropy sweeps the rest.",
      "Deletes break all three, so a delete writes a tombstone with a dominating version rather than removing the row, and the tombstone survives gc_grace_seconds. The residue after all of that is genuinely concurrent writes, which version vectors detect honestly and never resolve; something above the store has to merge.",
    ],
    crux:
      "W + R > N is an overlap property and nothing more. It guarantees a read reaches at least one replica holding the last acknowledged write; it does not order two concurrent writes, does not make two successive reads agree, and does not make read-modify-write safe at any setting. Every hard part of this design lives in that gap.",
    numbers: [
      "N=3, W=2, R=2 inside one region",
      "128 nodes/region, ~400GB and ~23k replica ops/s each",
      "gc_grace 10 days against a ~1.1 hour repair pass",
    ],
  },
  nodes: [
    {
      id: "client",
      label: "Client",
      sub: "picks R and W per request",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The caller, issuing get, put and delete against any node in the region and naming the quorum it wants on each call.",
        why: "Consistency here is per request and not per system, so the knob belongs to the caller: one keyspace serves a W=R=2 caller and a W=R=1 caller in the same second. The client is also where reconciliation happens, because the store detects conflicts and never resolves them.",
        numbers: ["1M ops/s aggregate", "4:1 read to write, so 800k reads/s and 200k writes/s"],
        breaks:
          "A client that merges a sibling set and writes the result without carrying the merged vector as its parent recreates the same conflict on the next read, and a rising sibling count is that failure showing up in the metrics.",
      },
    },
    {
      id: "cas-store",
      label: "Per-key-leader store",
      sub: "where invariant-carrying values go",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "A separate store with one elected writer per key range, holding the values this design refuses to hold: balances, stock counts, anything conditionally updated.",
        why: "There is no compare-and-set at any W and R, and version vectors only report the collision. Two clients reading 100 and both writing 90 both succeed. So the honest architecture names the escape hatch rather than pretending the quorum covers it, and this store is then not the system of record for anything carrying an invariant.",
        numbers: ["4 round trips for a per-key Paxos ballot against 1 for a quorum write", "0 keys with invariants belong in the leaderless store"],
        breaks:
          "This is a boundary, not a layer: a team will put a counter in the leaderless store because it is convenient and nothing rejects it, and the lost update is invisible in every metric the store emits.",
        choice: {
          pick: "Move invariant-carrying values out to a store with a per-key leader",
          instead: "Lightweight transactions inside this store — a Paxos ballot per key, as Cassandra offers.",
          decider:
            "Round trips and composition. An LWT costs four round trips instead of one against a 30ms p99 write budget, and it still does not compose across keys, so a two-key invariant is unprotected either way. If the invariant is real, the leader is what buys it.",
          flips:
            "When conditional updates are rare and confined to one key — a claim-this-username or reserve-this-seat path at tens of ops/s — where four round trips on a rare call is cheaper than operating a second store.",
        },
      },
    },
    {
      id: "geo-dns",
      label: "Geo DNS + health checks",
      sub: "picks a region, not a node",
      kind: "gateway",
      col: 0,
      row: 1,
      detail: {
        what: "The geo load balancer, or equivalently client-side region pinning: it steers a caller to a healthy region and pulls a whole region out when its health checks fail.",
        why: "It selects a region and stops there. Inside the region no load balancer is on the path, because every node can coordinate and the design's whole availability argument is that no particular machine has to be alive. This is also the only piece that owns the recovery time objective, since quorums never cross regions.",
        numbers: ["RTO 1 to 5 minutes for client failover", "failover tested quarterly, AZ failover monthly"],
        breaks:
          "DNS TTL is the failover clock and clients cache past it, so the RTO is bounded by resolver behaviour you do not control; and a region that is unhealthy but still answering health checks keeps taking traffic.",
        choice: {
          pick: "Geo DNS with health checks that pull an entire region",
          instead: "An anycast or proxy tier that fails individual requests over between regions.",
          decider:
            "Whether failover is per request or per region. Quorums are LOCAL_QUORUM, so a request cannot usefully be retried in another region mid-flight — the data may not be there yet at an RPO of 1 to 60 seconds. Region-granular steering matches what the replication actually guarantees.",
          flips:
            "When the store runs EACH_QUORUM and every write is already in every region, where per-request failover is safe and the RTO drops from minutes to seconds.",
        },
      },
    },
    {
      id: "coordinator",
      label: "Coordinator (any node)",
      sub: "a role, not a tier",
      kind: "serviceGroup",
      col: 0,
      row: 2,
      detail: {
        what: "Whichever node received the request. One process on every one of the 128 nodes runs all four stages below: locate the key's owners, fan the request out, count responses against the quorum, and compare versions before answering.",
        why: "These are stages of one request path on one machine, not four services. Separating the coordinator role from the storage role is the whole reason there is no single point of failure: clients talk to a nearby node while replicas stay wherever the partitioning scheme says they belong, so no failover step and no election pause sits on the request path.",
        numbers: ["10⁶ / 128 = ~8k coordinations/s/node", "on top of ~23k replica ops/s/node"],
        breaks:
          "It is the connection concentration point: high client counts exhaust file descriptors, EMFILE on accept, and gossip starts flapping on the same node.",
        choice: {
          pick: "Any node coordinates; the role is not a dedicated tier",
          instead: "A dedicated stateless proxy tier in front of the storage nodes.",
          decider:
            "Hop count against a 10ms p99 read budget. Coordination is ~8k requests/s per node folded into a box already sized for ~23k replica ops/s, so it is nearly free, while a proxy tier adds a network hop to every one of 1M ops/s and becomes a thing that can be down.",
          flips:
            "When clients are outside your control and you need somewhere to enforce quotas and bound connection counts, since descriptor exhaustion on the coordinator is already a named failure mode here.",
        },
      },
    },
    {
      id: "ring-lookup",
      label: "Ring lookup",
      sub: "hash(key) → next N distinct nodes",
      kind: "process",
      col: 0,
      row: 2,
      parent: "coordinator",
      detail: {
        what: "The placement stage: hash the key onto the consistent hashing ring, walk the gossiped token map, take the next N distinct nodes as the owners of that range.",
        why: "This is arithmetic on local state, not a call to anything. Placement has to be derivable on every node from gossip, because a placement service would be exactly the single point of failure that going leaderless exists to remove. Adding or removing a node moves only the ranges adjacent to its tokens.",
        numbers: ["128 nodes per region", "N=3 owners per key", "~400GB per node at 50TB physical"],
        breaks:
          "A hot key is placed on N replicas and nothing more, so one celebrity key drives 100x traffic at three specific nodes and the ring has no way to spread it. A node with a stale ring view during a topology change routes to a node that no longer owns the range.",
        choice: {
          pick: "Hash partitioning on a consistent hashing ring",
          instead: "Order-preserving range partitioning, which keeps keys sorted across nodes.",
          decider:
            "Whether reads are point lookups or ordered scans across partitions. Ours are point lookups with intra-partition ranges only, at 800k reads/s, so hash partitioning buys even spread across 128 nodes; range partitioning would put sequential keys on one node and hand you a hot shard for free.",
          flips:
            "When cross-partition range scans are a first-class access pattern, where sorted placement is the only way to serve them and you accept managing hot shards by hand.",
        },
      },
    },
    {
      id: "quorum",
      label: "Quorum engine",
      sub: "N=3, W=2, R=2 (LOCAL_QUORUM)",
      kind: "process",
      col: 0,
      row: 3,
      parent: "coordinator",
      detail: {
        what: "The counter on the coordinator: send to all N=3, return to the client after W acknowledgements on a write or R responses on a read.",
        why: "W + R > N is the entire consistency argument. It says the set of replicas that acknowledged a write and the set that answers a read must intersect, so a read always reaches at least one replica holding the last acknowledged write. With N=3 that needs W + R of at least 4, and W=R=2 is the cheapest pair, tolerating one dead or slow replica on each path.",
        numbers: ["W + R > N, so W=R=2 at N=3", "R=1 is ~1 to 2ms, R=2 is ~4 to 6ms against a 10ms p99"],
        breaks:
          "Overlap is not ordering. A write that reached one replica and was never acknowledged can still be read later, two successive reads can disagree, and no W and R setting makes read-modify-write safe.",
        choice: {
          pick: "N=3, W=2, R=2, satisfied within a single region",
          instead: "W=1/R=1 with background read repair, or the asymmetric W=3/R=1 and W=1/R=3.",
          decider:
            "The p99 budget against read-your-writes. W + R ≥ 4 is forced at N=3, and the cost is order statistics: waiting for the fastest of 3 replicas lands near a single replica's median at 1 to 2ms, waiting for the second lands near its p90 at 4 to 6ms. Our budget is 10ms p99, so R=2 fits with margin.",
          flips:
            "When reads are advisory: telemetry, view counts, feature flags, a session record whose loss means one re-login. W=1/R=1 there is correct rather than a compromise and roughly halves both latencies. At a 2ms p99 budget R=2 does not fit and the design changes rather than the knob.",
        },
      },
    },
    {
      id: "read-repair",
      label: "Read repair",
      sub: "1 value + N-1 digests",
      kind: "process",
      col: 0,
      row: 4,
      parent: "coordinator",
      detail: {
        what: "The stage that compares what came back: one replica is asked for the value and the others for a digest, and on a mismatch a second round pulls full values from all N, picks the winner by version, and writes it back to whoever was behind.",
        why: "It is the cheapest convergence mechanism because it rides traffic that was happening anyway, and it belongs on the coordinator because the coordinator is the only place that sees all N responses. Digests keep the common case to one 1.2KB value on the wire instead of three, and the writeback happens off the response path so it costs the client nothing.",
        numbers: ["N-1 digests per read", "runs on every one of 800k reads/s"],
        breaks:
          "It only touches keys somebody reads. Under the Zipfian skew these workloads always have, the head is repaired constantly and a long tail can go months without a single read.",
        choice: {
          pick: "Background read repair with digest reads",
          instead: "Blocking read repair, which waits for the repair write to be acknowledged before answering.",
          decider:
            "Where the repair round trip lands. Background repair promises nothing about when the stale replica is fixed but adds 0ms to the response; blocking repair adds a full write round trip to a path already budgeted at 10ms p99.",
          flips:
            "When a client reading twice must not go backwards. Blocking read repair is exactly what you enable there, and you pay for it in p99.",
        },
      },
    },
    {
      id: "version-vectors",
      label: "Version vectors",
      sub: "detect concurrency, return siblings",
      kind: "process",
      col: 0,
      row: 5,
      parent: "coordinator",
      detail: {
        what: "The last stage before the response: compare the per-key counter tuples that came back. If one vector dominates componentwise it is newer; if neither dominates the writes are concurrent and both versions go to the caller.",
        why: "The residue of leaderlessness is two clients writing the same key at once, and every quorum setting accepts both. Vectors are the honest answer: they report concurrency instead of silently discarding a write, which timestamps cannot do because NTP error and write interarrival overlap. The comparison sits on the coordinator because that is where all N responses meet.",
        numbers: ["16B per writer entry, ~48B per record", "NTP holds a fleet within 1 to 10ms", "unsafe for LWW when writes land within ~100ms"],
        breaks:
          "Detection is all they do. There is no compare-and-set at any W and R, so two clients reading 100 and both writing 90 both succeed, and a balance or a stock count does not belong in this store.",
        choice: {
          pick: "Version vectors keyed by client actor, siblings returned to the caller",
          instead: "Last-write-wins on a wall-clock timestamp, exactly one value ever returned.",
          decider:
            "Whether the value type has a merge that is commutative, associative and idempotent, and clock skew against write interarrival. A well-run fleet holds NTP within 1 to 10ms, but a VM live migration or an NTP step moves a clock by seconds, so two writes landing within ~100ms will sometimes be ordered wrongly and you never find out.",
          flips:
            "Cache entries, recomputable projections and session records, where take one and move on genuinely is correct. LWW is then cheaper on every axis: no sibling set, no sibling explosion, no reconciliation code, no vector bytes per record. Cassandra, by far the most deployed member of this family, offers only LWW at cell granularity and no siblings at all.",
        },
      },
    },
    {
      id: "hints",
      label: "Hinted handoff buffer",
      sub: "on a neighbour, 3h TTL",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "A durable backlog of writes parked on a healthy neighbour, each tagged with the replica it was intended for, drained in arrival order when that owner returns.",
        why: "It is a work queue rather than a store: nothing reads from it, it only replays and empties. It bridges the gap between a short outage and a full repair scan, so a node rebooting does not cost a range its write availability. It sits outside the replica set on purpose — the hint holder is not a replica of the key, which is exactly why a hint must not count toward W under a strict quorum.",
        numbers: ["4.7k writes/s per node share (200k × 3/128)", "3 hour default TTL", "~60GB of hints per 3 hour outage"],
        breaks:
          "A flapping node produces more hints than a dead one, so hint-buffer growth rather than node up or down is the metric, and the replay burst on rejoin has to be throttled.",
        choice: {
          pick: "Hint on a neighbour with a 3 hour TTL; hints never count toward a strict W",
          instead: "Sloppy quorum, which deliberately does count hinted writes on non-replicas toward W.",
          decider:
            "Whether the intersection argument survives. If a hint counts, W=2 can be satisfied by two nodes that are not replicas of the key at all, and a later R=2 read of the canonical replicas overlaps none of the acknowledgers. A sloppy quorum has no consistency invariant, only good odds.",
          flips:
            "When availability during a partition matters more than the invariant, which is most of the time, and is why sloppy quorum is on by default. The honest fix is a per-request flag when any acknowledgement came from a non-replica.",
        },
      },
    },
    {
      id: "replica-zone",
      label: "Replica set (N=3), gossiping",
      kind: "zone",
      detail: {
        what: "The three nodes the ring assigns to this key, plus the local storage engine each of them runs.",
        why: "Every node in the fleet is interchangeable, so this box is a role assignment rather than a tier: the same machines coordinate other keys. Membership and token ownership are gossiped between peers, which is why losing any one of the three costs a quorum member and never costs availability.",
        numbers: ["N=3 per region", "each region holds its own full RF 3 set"],
        breaks:
          "Two of the three going down at once takes W=2 and R=2 below quorum for that range, and only that range, which is why the ring spreads ranges across racks.",
      },
    },
    {
      id: "replicas",
      label: "Replica nodes",
      sub: "3x replication of a ~1.2KB record",
      kind: "database",
      col: 1,
      row: 2,
      parent: "replica-zone",
      detail: {
        what: "The N=3 nodes that own this key's range, each holding a full copy of the value, its version vector and its TTL header.",
        why: "Three full copies rather than fragments is a payload-size decision. Values here are mutable and about 1.2KB, so replication keeps a read to one node's disk and lets any surviving replica answer alone, which is what tolerating a dead node on both the read and write path actually requires.",
        numbers: ["1.2KB stored record", "36TB logical at RF 3, ~50TB physical", "3M replica operations/s"],
        breaks:
          "Every acknowledged write at W=2 leaves one of the three behind, so 200k stale copies per second is the designed steady state, not an incident.",
        choice: {
          pick: "Full 3x replication",
          instead: "Reed-Solomon 6+3 erasure coding at 1.5x storage.",
          decider:
            "Payload size. RS 6+3 on a 1.2KB record yields 200B fragments, so per-fragment headers and six network hops dominate the payload and every one of 800k reads/s has to gather six pieces and reconstruct. The same code on a 1MB fragment is obviously right at 1.5x against 3x.",
          flips:
            "Immutable megabyte-to-gigabyte objects, where the storage saving is measured in petabytes and the reconstruct cost is amortised across a large fragment.",
        },
      },
    },
    {
      id: "lsm",
      label: "LSM storage engine",
      sub: "WAL + memtable + SSTables + Bloom",
      kind: "database",
      col: 1,
      row: 3,
      parent: "replica-zone",
      detail: {
        what: "The local store on each replica: append to a commit log and a sorted in-memory table, flush to immutable SSTables, compact in the background.",
        why: "Writes become sequential, which is what makes 200k writes/s at RF 3 cheap per node. Reads pay for it in file opens, and a Bloom filter per SSTable is what brings a point lookup back down to one or two, which is the only reason an LSM competes with a B-tree on this workload at all.",
        numbers: ["1 to 2 file opens per point read at 1% Bloom FP", "10x write amplification, ~56MB/s per node", "leveled compaction throttled to ~50MB/s"],
        breaks:
          "Compaction competes with foreground reads for queue depth long before it saturates bandwidth, and read amplification above 10 SSTables per read is the leading indicator.",
        choice: {
          pick: "LSM tree with a Bloom filter per SSTable and leveled compaction",
          instead: "A page-oriented B-tree updated in place, with a write-ahead log for durability.",
          decider:
            "Whether reads are point lookups or ordered scans. Point reads are near parity: a 1% false-positive Bloom puts an LSM lookup at 1 to 2 file opens against a B-tree's 1. Range scans are not, since a 5-level LSM does roughly 5x the I/O of a leaf walk. Below roughly 5% of reads being cross-level scans, LSM.",
          flips:
            "Read-mostly workloads with the working set in memory, or dominantly ordered scans, where write amplification stops mattering and you delete compaction as an operational surface. Concede the hardware shift too: on NVMe a random 4KB write runs at hundreds of thousands of IOPS, so the sequential-versus-random gap the LSM case was built on has narrowed by orders of magnitude.",
        },
      },
    },
    {
      id: "remote-region",
      label: "Remote region",
      sub: "async cross-DC, RPO 1 to 60s",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "A second or third region holding its own full RF 3 replica set, fed asynchronously from this one and serving its own local quorum.",
        why: "Quorums stay inside a region so the WAN never lands on the request path. The cross-region copy exists for a whole-DC failure and for serving readers near it, and it is drawn off the request path because you get no acknowledgement from it before answering the client.",
        numbers: ["~70ms transatlantic round trip", "RTO 1 to 5 minutes, RPO 1 to 60 seconds", "WAN cost 5 to 50% of intra-DC traffic"],
        breaks:
          "A long partition between regions grows hint buffers past the TTL and lets version vectors diverge on both sides, so healing means a full anti-entropy pass and a conflict count somebody has to look at.",
        choice: {
          pick: "Active-active, LOCAL_QUORUM per DC plus asynchronous cross-DC replication",
          instead: "EACH_QUORUM, requiring a quorum in every DC on every write.",
          decider:
            "The WAN round trip against a 30ms p99 write budget. EACH_QUORUM pays ~70ms transatlantic on every write and stalls writes entirely when any DC is down; LOCAL_QUORUM satisfies the intersection property inside the DC and accepts an RPO of 1 to 60 seconds instead.",
          flips:
            "Rare cross-region operations such as account creation in a multi-region product, where 70ms is acceptable. Active-passive is the alternative when strong cross-region consistency is genuinely required.",
        },
      },
    },
    {
      id: "tombstones",
      label: "Tombstones",
      sub: "gc_grace_seconds = 10 days",
      kind: "database",
      col: 2,
      row: 3,
      detail: {
        what: "A delete writes a marker carrying a version that dominates what it replaces, stored in the same SSTables as live data, and the marker survives gc_grace_seconds before it can be purged.",
        why: "Every convergence mechanism above compares versions, and an absent row loses to a present row in every comparison, so a replica that missed the delete would reintroduce the data at the next read repair or repair pass. The grace period is where the assumption that every replica has seen it gets written down.",
        numbers: ["10 day default (864,000s)", "~170GB per region at a 1% delete rate", "~100B per tombstone"],
        breaks:
          "Purge early and you get silent data resurrection, which for a right-to-erasure deletion is a compliance event rather than a bug. The invariant is that the grace period exceeds the worst-case repair interval of the coldest range.",
        choice: {
          pick: "Versioned delete markers held for gc_grace_seconds",
          instead: "Removing the row on delete, as a mutable store would.",
          decider:
            "Version comparison has no representation for absence, so removal cannot win against a replica that still holds the row. The cost is bounded and small at a 1% delete rate: 200k × 0.01 × 864,000s is 1.7 × 10⁹ resident tombstones at ~100B, about 0.5% of logical bytes.",
          flips:
            "Queue-shaped workloads at a 50% delete rate, where the same arithmetic gives ~8TB and the read path collapses long before that. The fix there is not tuning: bucket by time and drop whole partitions, which is a metadata operation.",
        },
      },
    },
    {
      id: "anti-entropy",
      label: "Anti-entropy repair",
      sub: "Merkle trees, ~1.1h per node",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "The repair scheduler. Each replica builds a Merkle tree over its token ranges, leaves hashing small key ranges. Two replicas compare roots and recurse only into subtrees that disagree.",
        why: "It is the only mechanism with complete coverage, so it is what backstops the cold keys read repair never touches and the writes hinted handoff dropped at the TTL. It is drawn as its own service because it is scheduled and throttled independently of the request path: its rate is an operator decision, not a consequence of traffic. Message cost is logarithmic; the disk cost is not, because building the tree reads every key in the range.",
        numbers: ["400GB per node at a 100MB/s throttle is ~4,000s, about 1.1 hours", "2¹⁵ leaves over 10⁷ keys is ~300 keys per leaf", "well inside gc_grace of 864,000s"],
        breaks:
          "Repair cost tracks data volume rather than divergence: a cluster where 0.001% of keys diverged still reads 400GB per node to establish that, and it binds at roughly 10x this data on the same node count.",
        choice: {
          pick: "Full subrange Merkle repair, throttled to ~100MB/s",
          instead: "Incremental repair, which tracks which SSTables have already been repaired so a pass touches only new data.",
          decider:
            "Margin against the grace window. A full pass is ~1.1 hours against a 10 day gc_grace, roughly two orders of magnitude of headroom at 400GB per node, so the coupling is not yet painful and correctness beats cleverness.",
          flips:
            "Once data per node grows about 10x and a full pass no longer fits comfortably inside gc_grace. Incremental repair is the intended answer, but its Cassandra implementation had correctness bugs that kept it off by default for years after the 2016 to 2018 period.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "geo-dns",
      label: "get / put(key)",
      animated: true,
      detail: {
        what: "The client request, carrying the key, the value on a write, and the quorum the caller wants for this specific call.",
        why: "The quorum is a per-request argument rather than a cluster setting, which is what lets one deployment serve a strict caller and a sloppy one at the same time. Resolution happens once and is cached, so this hop is not on the per-request path in steady state.",
        numbers: ["1M ops/s aggregate", "4:1 read to write"],
        breaks:
          "There is no per-request signal telling the caller it got a sloppy quorum instead of a strict one, so a client cannot tell when the guarantee it asked for was quietly voided.",
      },
    },
    {
      id: "e2",
      from: "geo-dns",
      to: "ring-lookup",
      label: "any node in that region",
      animated: true,
      detail: {
        what: "The request landing on whichever node in the healthy region the client resolved to, which becomes the coordinator for this call.",
        why: "Steering stops at the region. Inside it the client picks whichever node it likes, because none of them is special and adding a load balancer here would put a machine that can be down back on a path built to have none.",
        numbers: ["128 candidate coordinators per region", "~8k coordinations/s per node"],
        breaks:
          "Clients that pin to one node rather than spreading concentrate connections on it, and descriptor exhaustion there looks like a cluster problem rather than a client one.",
      },
    },
    {
      id: "e3",
      from: "ring-lookup",
      to: "quorum",
      label: "N owners for this key",
      animated: true,
      detail: {
        what: "The output of placement handed to the counter: the three node IDs that own this key's range, in ring order.",
        why: "Drawn inside the coordinator because no network hop happens here — this is one process calling the next stage of itself. That is the whole point of hash placement: the owners are computed, not looked up.",
        numbers: ["N=3 owners out of 128 nodes"],
        breaks:
          "A node with a stale view of the ring during a topology change hands the counter a node that no longer owns the range, which is what makes membership convergence a correctness concern and not just bookkeeping.",
      },
    },
    {
      id: "e4",
      from: "quorum",
      to: "replicas",
      label: "fan out to all N=3",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Parallel writes carrying the value and its version vector, or a read consisting of one full value request and N-1 digest requests, with the client answered after W acks or R responses.",
        why: "Sending to all N and waiting for W or R is deliberate: fanning to only W would mean a single slow replica turns into a timeout instead of being outrun by the other two. This is also the hop the p99 budget is spent on — waiting for the second of three responses lands near a single replica's p90.",
        numbers: ["fan to N=3, wait for W=2 or R=2", "R=1 lands near ~1 to 2ms, R=2 near ~4 to 6ms", "1M client ops/s is 3M replica ops/s"],
        breaks:
          "The third replica is still written and still counted for convergence, but the client left at W=2, so a GC pause on that node is invisible to the caller and becomes 200k stale copies per second.",
      },
    },
    {
      id: "e5",
      from: "quorum",
      to: "hints",
      label: "replica unreachable",
      dashed: true,
      fromSide: "right",
      toSide: "top",
      offset: 40,
      detail: {
        what: "A write for a replica that did not answer, stored on a healthy neighbour tagged with the intended owner's node ID.",
        why: "It keeps a short outage from costing that range any write availability, and it bounds how much work anti-entropy has to do later. Under a strict quorum it does not count toward W, so it is bookkeeping rather than an acknowledgement.",
        numbers: ["4.7k writes/s per node share", "3 hour default TTL"],
        breaks:
          "If the hint is counted toward W, which is exactly what sloppy quorum does, the intersection argument collapses: two non-replicas can satisfy W=2 and a later R=2 read overlaps none of them.",
      },
    },
    {
      id: "e6",
      from: "hints",
      to: "replicas",
      label: "replay on rejoin",
      dashed: true,
      detail: {
        what: "The neighbour dials the recovered owner and replays its buffered writes in arrival order once gossip reports the owner alive again.",
        why: "It closes the window between a node going down and the next repair pass, which would otherwise be hours away. Replay is throttled because the backlog arrives as a single burst at the exact moment the node is also rebuilding caches and rejoining quorums.",
        numbers: ["~60GB replayed after a 3 hour outage"],
        breaks:
          "Past the TTL hints are simply dropped and the problem is handed to anti-entropy, so a node down for four hours converges on the repair timescale rather than the handoff one.",
      },
    },
    {
      id: "e7",
      from: "replicas",
      to: "lsm",
      label: "commit log + memtable",
      animated: true,
      detail: {
        what: "The local durable write on each replica: append to the commit log, insert into the sorted in-memory table, acknowledge.",
        why: "Durability is a sequential append rather than an in-place page update, which is what makes an acknowledgement cheap enough that waiting for two of them fits inside a few milliseconds. The flush to immutable files happens later and off this path.",
        numbers: ["~56MB/s per node sustained at 10x write amplification"],
        breaks:
          "Acknowledging from the memtable before the commit log is durable turns a node crash into acknowledged writes that never existed, which no quorum setting can recover.",
      },
    },
    {
      id: "e8",
      from: "quorum",
      to: "read-repair",
      label: "digest mismatch",
      dashed: true,
      detail: {
        what: "The trigger: the digests returned by the responding replicas do not agree, so a second round pulls full values from all N.",
        why: "Matching digests mean the replicas agree and nothing further happens, which is the common case and the reason digests are worth the extra round in the uncommon one. Comparing a hash over value plus version metadata is cheaper than shipping three copies of a 1.2KB record on every read.",
        numbers: ["one full value plus N-1 digests per read"],
        breaks:
          "The comparison happens on the coordinator, so a mismatch is only ever noticed for keys that are actually read, and the cold tail is invisible to it.",
      },
    },
    {
      id: "e9",
      from: "read-repair",
      to: "replicas",
      label: "writeback of the winner",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The winning version, picked by version comparison, written back to whichever replica was behind.",
        why: "Convergence rides on traffic that already happened, so the hot part of the keyspace stays consistent for free. Doing it in the background rather than before the response keeps it off the p99 path and is why it promises nothing about when the stale replica is actually fixed.",
        numbers: ["0ms added to the client response"],
        breaks:
          "Nothing guarantees the writeback succeeds, and nothing retries it, so a replica that is down during the repair stays stale until anti-entropy finds it.",
      },
    },
    {
      id: "e10",
      from: "lsm",
      to: "version-vectors",
      label: "value + version vector",
      fromSide: "bottom",
      toSide: "right",
      detail: {
        what: "The stored record read back out: value, version vector, TTL header, or a set of concurrent siblings if more than one version survives, returned to the coordinator that asked.",
        why: "The vector travels with the value everywhere because causality has to be decidable at read time on any node, with no shared clock and no coordinator that saw both writes. That is what makes concurrency detectable rather than guessed at.",
        numbers: ["16B per writer entry, ~48B per record"],
        breaks:
          "Vectors keyed by coordinator node grow without bound under churn and need pruning, and pruning can falsely report concurrency; keying by client actor bounds them by the number of writers touching the key.",
      },
    },
    {
      id: "e11",
      from: "version-vectors",
      to: "client",
      label: "value or sibling set",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 40,
      detail: {
        what: "The response: one value when a version dominates, or every concurrent sibling with its vector when none does, for the caller to merge.",
        why: "The store detects and never resolves, so this arrow is where the unresolved conflict is handed out. The caller must write the merged result back with the merged vector as its parent, or the same conflict reappears on the next read.",
        numbers: ["alert on any sustained rise in siblings per read"],
        breaks:
          "If reconciliation code cannot be put in clients, the only options left are restricting values to self-merging types or moving the key to a store with a per-key leader and paying the latency.",
      },
    },
    {
      id: "e12",
      from: "lsm",
      to: "tombstones",
      label: "delete writes a marker",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A delete stored as a versioned marker inside the same SSTables as live data, rather than removing the row.",
        why: "Removal has no representation in a version comparison, so a replica that missed a delete would win against absence and reintroduce the data. A marker with a dominating version wins those comparisons instead, which is how a delete propagates at all.",
        numbers: ["~100B per tombstone", "~170GB per region at a 1% delete rate"],
        breaks:
          "Tombstones are a read cost that outlives the data: a scan over a mostly-deleted partition still reads every marker to prove the rows are gone.",
      },
    },
    {
      id: "e13",
      from: "tombstones",
      to: "anti-entropy",
      label: "gc_grace > repair time",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      detail: {
        what: "The sizing constraint that ties the two together: a tombstone may only be purged once every replica has certainly seen it, which means after a full repair pass has covered its range.",
        why: "This single comparison is what the whole convergence design reduces to. If the repair cycle time for the coldest range ever exceeds the grace period, a returning replica resurrects deleted rows and nothing reports it.",
        numbers: ["~1.1 hour pass against 864,000s of grace", "alert when repair lag exceeds gc_grace / 2"],
        breaks:
          "The direction of the fix is counterintuitive: if repair falls behind you raise the grace period, because repair is the thing already saturated.",
      },
    },
    {
      id: "e14",
      from: "lsm",
      to: "anti-entropy",
      label: "Merkle over ranges",
      dashed: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The tree build: read every key in the range, hash small ranges into leaves, hash children into parents up to a root.",
        why: "Comparison has to be cheap enough to run between every pair of replicas, and a tree makes that logarithmic in messages. The read is the cost you cannot avoid, because there is nowhere else the current state of a range is summarised.",
        numbers: ["400GB per node at 100MB/s is ~1.1 hours", "throttled so it does not compete with foreground reads"],
        breaks:
          "The pass takes the same hour whether one key diverged or a million did, which couples the safe deletion window to total bytes rather than to anything about deletions.",
      },
    },
    {
      id: "e15",
      from: "anti-entropy",
      to: "replicas",
      label: "resync diverged ranges",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Streaming the key ranges under the disagreeing subtrees from a healthy replica to the one that is behind, written into its store as files rather than replayed as writes.",
        why: "This is the only mechanism with complete coverage, so it is what finally converges the cold keys read repair never sees and the writes hinted handoff dropped at the TTL. Every production cluster runs all three because each covers the previous one's hole.",
        numbers: ["2¹⁵ leaves over 10⁷ keys resyncs ~300 keys per diverged key"],
        breaks:
          "Over-repair is normal: leaf granularity means one diverged key drags about 300 neighbours across the wire, so repair traffic is not proportional to damage.",
      },
    },
    {
      id: "e16",
      from: "replicas",
      to: "remote-region",
      label: "async cross-DC shipping",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Mutations shipped to the other region's replica set after the local quorum has already answered the client.",
        why: "Putting the WAN inside the quorum would add ~70ms to every write against a 30ms budget and would stall writes whenever any region is unhealthy. Shipping asynchronously buys a disaster-recovery copy and local reads elsewhere at the price of a stated, non-zero recovery point objective.",
        numbers: ["~70ms transatlantic", "RPO 1 to 60 seconds", "WAN cost 5 to 50% of intra-DC traffic"],
        breaks:
          "Writes accepted here in the last few seconds are simply not in the other region yet, so a region failover loses them, and a long partition means both sides accept conflicting writes that only converge on repair.",
      },
    },
    {
      id: "e17",
      from: "client",
      to: "cas-store",
      label: "values with invariants",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The values that never enter the leaderless store: balances, stock counts, anything whose next value is a function of its current one.",
        why: "No W and R setting creates a compare-and-set, and version vectors only report the collision after both writes succeeded. Drawing the boundary is the honest move, because the alternative is discovering it as a slow leak in a balance nobody is reconciling.",
        numbers: ["two clients reading 100 and both writing 90 both succeed"],
        breaks:
          "Nothing enforces this arrow. It is a convention, and the failure when somebody ignores it is a lost update that no metric in this store reports.",
      },
    },
  ],
};
