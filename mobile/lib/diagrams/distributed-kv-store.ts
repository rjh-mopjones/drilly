import type { Diagram } from "./types";

export const DISTRIBUTED_KV_STORE: Diagram = {
  id: "distributed-kv-store",
  title: "Distributed KV Store",
  question: "Design a Distributed Key-Value Store (Dynamo-style)",
  sourceId: "patterns",
  itemId: 3,
  overview: {
    shape:
      "A leaderless ring where any node can coordinate. It hashes the key to its N=3 owners, fans the request to all of them, and answers the client after W acknowledgements or R responses. It then spends the rest of its life converging the replicas it deliberately left behind.",
    forces: [
      {
        constraint: "no key has a leader, so any of 128 nodes can coordinate, but two clients can write the same key at once",
        decision: "Version vectors detect the concurrency honestly and return siblings, rather than silently discarding one write",
        lights: ["version-vectors", "e10", "e11"],
      },
      {
        constraint: "W + R > N is needed so a read set and a write set always share a member; at N=3 that forces W + R to at least 4",
        decision: "The quorum engine uses W=2, R=2, the cheapest pair that still tolerates one dead or slow replica on each path",
        lights: ["quorum", "e4"],
      },
      {
        constraint: "W=2 leaves one of three replicas behind on every one of 200k writes/s, the steady state, not a fault",
        decision: "Read repair, hinted handoff and Merkle anti-entropy converge that gap on three timescales, each covering the previous one's hole",
        lights: ["read-repair", "hints", "anti-entropy", "e8", "e9", "e5", "e6", "e14", "e15"],
      },
      {
        constraint: "an absent row loses to a present row in every version comparison, so 1 replica that missed a delete resurrects it",
        decision: "A delete writes a dominating tombstone instead of removing the row, held for gc_grace_seconds",
        lights: ["tombstones", "e12", "e13"],
      },
      {
        constraint: "two clients reading 100 and both writing 90 both succeed at any W and R, since no quorum composes a compare-and-set",
        decision: "Values with real invariants move out to a separate per-key-leader store instead of living in the leaderless one",
        lights: ["cas-store", "e17"],
      },
    ],
    naive: {
      text: "Give every key one leader that serializes its writes, the way a normal database would, so conflicts simply cannot happen. That solves the concurrency problem but reintroduces exactly what going leaderless exists to remove: availability now depends on one specific machine being alive for every key it owns. The design instead lets any of the N=3 replicas accept a write, and answers a quorum instead of waiting for a leader. Two clients can then genuinely write the same key at once, so version vectors detect that concurrency honestly and return both versions rather than silently picking one.",
      lights: ["quorum", "version-vectors"],
    },
    beats: [
      {
        text: "Everything follows from one refusal: no key has a leader. Give that up and availability stops depending on any particular machine being alive. You now allow two clients to write the same key at once, and every remaining decision is about where you pay for that.",
        lights: ["client", "cas-store", "e17"],
      },
      {
        text: "Placement is arithmetic, not lookup. The coordinator hashes the key onto the consistent hashing ring and reads off the N nodes that own that range. There is no placement service to fail, and any of the 128 nodes in a region can serve any request without holding the data itself.",
        lights: ["geo-dns", "coordinator", "ring-lookup", "e1", "e2", "e3"],
      },
      {
        text: "The quorum is the load-bearing line. W + R > N means the set that acknowledged a write and the set that answered a read must share a member. With N=3 you need W + R at least 4, and W=R=2 is the cheapest pair that holds while tolerating one dead or slow replica on each path.",
        lights: ["quorum", "replicas", "e4"],
      },
      {
        text: "Locally each replica is a log structured merge tree: writes append to a commit log and a sorted in-memory table, flush to immutable files, and compact in the background. Writes are sequential and cheap; point reads cost one or two file opens once a Bloom filter per file rules the rest out.",
        lights: ["replica-zone", "replicas", "lsm", "e7"],
      },
      {
        text: "Divergence is the steady state rather than a fault, because W=2 leaves one replica behind on every one of 200k writes per second. Three mechanisms converge it on three timescales, each covering the previous one's hole. Read repair fixes what a read notices, hinted handoff parks writes for three hours, Merkle anti-entropy sweeps the rest.",
        lights: ["read-repair", "hints", "anti-entropy", "e8", "e9", "e5", "e6", "e14", "e15"],
      },
      {
        text: "Deletes break all three, so a delete writes a tombstone with a dominating version rather than removing the row, and the tombstone survives gc_grace_seconds. The residue after all of that is genuinely concurrent writes, which version vectors detect honestly and never resolve; something above the store has to merge.",
        lights: ["tombstones", "version-vectors", "e12", "e13", "e10", "e11"],
      },
    ],
    crux: {
      problem:
        "W + R > N is an overlap property and nothing more. It guarantees a read reaches at least one replica holding the last acknowledged write.",
      handled:
        "It does not order two concurrent writes, does not make two successive reads agree, and does not make read-modify-write safe at any setting. Every hard part of this design lives in that gap. Version vectors detect what the quorum cannot prevent, and values with real invariants move to a store with a leader instead.",
    },
    numbers: [
      {
        value: "N=3, W=2, R=2 inside one region",
        explain: "The cheapest quorum pair satisfying W + R > N at N=3, chosen to tolerate one dead or slow replica on both the read and write path.",
      },
      {
        value: "128 nodes/region, ~400GB and ~23k replica ops/s each",
        explain: "How the 1M ops/s aggregate and the working set actually land per machine once spread across the ring.",
      },
      {
        value: "gc_grace 10 days against a ~1.1 hour repair pass",
        explain: "Roughly two orders of magnitude of headroom between how long a tombstone is kept and how long a full anti-entropy pass actually takes.",
      },
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
        numbers: [
          { value: "1M ops/s aggregate", explain: "1M / 128 nodes ≈ 7,800 ops/s per node average — the per-machine load every downstream capacity number is sized against." },
          { value: "4:1 read to write, so 800k reads/s and 200k writes/s", explain: "The traffic mix that drives every downstream capacity number." },
        ],
        breaks: {
          failure: "A client that merges a sibling set and writes the result without carrying the merged vector as its parent recreates the same conflict on the next read.",
          handled: "A rising sibling count is that failure showing up in the metrics, which is why sibling rate is monitored as a client-correctness signal, not just a store one.",
        },
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
        why: "There is no compare-and-set at any W and R, and version vectors only report the collision. Two clients reading 100 and both writing 90 both succeed. The honest architecture names the escape hatch rather than pretending the quorum covers it.",
        numbers: [
          { value: "4 round trips for a per-key Paxos ballot against 1 for a quorum write", explain: "4x the latency of an ordinary quorum write — the deliberate cost paid only by the narrow set of keys that need compare-and-set." },
          { value: "0 keys with invariants belong in the leaderless store", explain: "The hard rule this boundary enforces." },
        ],
        breaks: {
          failure: "This is a boundary, not a layer: a team will put a counter in the leaderless store because it is convenient and nothing rejects it.",
          handled: "The lost update is invisible in every metric the store emits, which is why this boundary has to be enforced by review and convention, not by the system itself.",
        },
        choice: {
          pick: "Move invariant-carrying values out to a store with a per-key leader",
          instead: "Lightweight transactions inside this store, a Paxos ballot per key.",
          decider:
            "Round trips and composition. An LWT costs four round trips instead of one against a 30ms p99 write budget. It still does not compose across keys, so a two-key invariant is unprotected either way.",
          flips: "When conditional updates are rare and confined to one key, a claim-this-username or reserve-this-seat path at tens of ops/s.",
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
        why: "It selects a region and stops there. Inside the region no load balancer is on the path, because every node can coordinate and the design's whole availability argument is that no particular machine has to be alive.",
        numbers: [
          { value: "RTO 1 to 5 minutes for client failover", explain: "The realistic recovery time this tier is held to when it pulls an unhealthy region." },
          { value: "region failover tested every ~90 days, AZ failover every 30", explain: "The cadence this failover path is actually exercised, rather than assumed to work." },
        ],
        breaks: {
          failure: "DNS TTL is the failover clock and clients cache past it.",
          handled: "The RTO is bounded by resolver behaviour you do not control, and a region that is unhealthy but still answering health checks keeps taking traffic regardless.",
        },
        choice: {
          pick: "Geo DNS with health checks that pull an entire region",
          instead: "An anycast or proxy tier that fails individual requests over between regions.",
          decider:
            "Whether failover is per request or per region. Quorums are LOCAL_QUORUM, so a request cannot usefully be retried in another region mid-flight, at an RPO of 1 to 60 seconds.",
          flips: "When the store runs EACH_QUORUM and every write is already in every region, where per-request failover is safe and the RTO drops from minutes to seconds.",
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
        what: "Whichever node received the request. One process on every node runs all four stages: locate the key's owners, fan the request out, count responses against the quorum, and compare versions before answering.",
        why: "These are stages of one request path on one machine, not four services. Separating the coordinator role from the storage role is the whole reason there is no single point of failure.",
        numbers: [
          { value: "10⁶ / 128 = ~8k coordinations/s/node", explain: "The average coordination load each node carries, folded into the same box that stores replicas." },
          { value: "on top of ~23k replica ops/s/node", explain: "The additional storage-role work each node already does, which coordination adds only a fraction to." },
        ],
        breaks: {
          failure: "It is the connection concentration point: high client counts exhaust file descriptors, EMFILE on accept.",
          handled: "Gossip starts flapping on the same node under that pressure, which is why descriptor limits and connection caps are treated as a named failure mode here.",
        },
        choice: {
          pick: "Any node coordinates; the role is not a dedicated tier",
          instead: "A dedicated stateless proxy tier in front of the storage nodes.",
          decider:
            "Hop count against a 10ms p99 read budget. Coordination is ~8k requests/s per node folded into a box already sized for ~23k replica ops/s, so it is nearly free.",
          flips: "When clients are outside your control and you need somewhere to enforce quotas and bound connection counts.",
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
        why: "This is arithmetic on local state, not a call to anything. Placement has to be derivable on every node from gossip, because a placement service would be exactly the single point of failure that going leaderless exists to remove.",
        numbers: [
          { value: "128 nodes per region", explain: "50TB / 128 ≈ 390GB, matching the ~400GB/node figure exactly — ring size is what sets per-node data volume." },
          { value: "N=3 owners per key", explain: "How many distinct nodes this lookup returns for any key." },
          { value: "~400GB per node at 50TB physical", explain: "The scale of data this placement scheme spreads evenly across the fleet." },
        ],
        breaks: {
          failure: "A hot key is placed on N replicas and nothing more.",
          handled: "One celebrity key drives 100x traffic at three specific nodes and the ring has no way to spread it, an accepted limitation of hash placement without a hot-key-specific mitigation.",
        },
        choice: {
          pick: "Hash partitioning on a consistent hashing ring",
          instead: "Order-preserving range partitioning, which keeps keys sorted across nodes.",
          decider:
            "Whether reads are point lookups or ordered scans across partitions. Ours are point lookups with intra-partition ranges only, at 800k reads/s, so hash partitioning buys even spread.",
          flips: "When cross-partition range scans are a first-class access pattern, where sorted placement is the only way to serve them.",
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
        why: "W + R > N is the entire consistency argument. The set of replicas that acknowledged a write and the set that answers a read must intersect. A read then always reaches at least one replica holding the last acknowledged write.",
        numbers: [
          { value: "W + R > N, so W=R=2 at N=3", explain: "The minimum overlap requirement, and the cheapest pair of settings that satisfies it." },
          { value: "R=1 is ~1 to 2ms, R=2 is ~4 to 6ms against a 10ms p99", explain: "The latency cost each extra required response adds, still comfortably inside the budget." },
        ],
        breaks: {
          failure: "Overlap is not ordering. A write that reached one replica and was never acknowledged can still be read later.",
          handled: "Two successive reads can disagree, and no W and R setting makes read-modify-write safe, which is exactly why invariant-carrying values live elsewhere.",
        },
        choice: {
          pick: "N=3, W=2, R=2, satisfied within a single region",
          instead: "W=1/R=1 with background read repair, or the asymmetric W=3/R=1 and W=1/R=3.",
          decider:
            "The p99 budget against read-your-writes. W + R ≥ 4 is forced at N=3, and waiting for the second of three replicas lands near a single replica's p90 at 4 to 6ms.",
          flips: "When reads are advisory: telemetry, view counts, feature flags. W=1/R=1 there is correct rather than a compromise and roughly halves both latencies.",
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
        what: "The stage that compares what came back: one replica is asked for the value, the others for a digest. On a mismatch, a second round pulls full values from all N and picks the winner by version.",
        why: "It is the cheapest convergence mechanism because it rides traffic that was happening anyway. It belongs on the coordinator, the only place that sees all N responses at once.",
        numbers: [
          { value: "N-1 digests per read", explain: "The extra data each read carries to make comparison cheap in the common case." },
          { value: "runs on every one of 800k reads/s", explain: "How pervasive this mechanism is, folded silently into normal traffic." },
        ],
        breaks: {
          failure: "It only touches keys somebody reads.",
          handled: "Under the Zipfian skew these workloads always have, the head is repaired constantly. A long tail can go months without a single read, exactly the gap anti-entropy has to cover.",
        },
        choice: {
          pick: "Background read repair with digest reads",
          instead: "Blocking read repair, which waits for the repair write to be acknowledged before answering.",
          decider:
            "Where the repair round trip lands. Background repair promises nothing about when the stale replica is fixed but adds 0ms to the response.",
          flips: "When a client reading twice must not go backwards. Blocking read repair is exactly what you enable there, and you pay for it in p99.",
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
        why: "The residue of leaderlessness is two clients writing the same key at once, and every quorum setting accepts both. Vectors are the honest answer: they report concurrency instead of silently discarding a write.",
        numbers: [
          { value: "16B per writer entry, ~48B per record", explain: "The typical size of a version vector once a few clients have touched the key." },
          { value: "NTP holds a fleet within 1 to 10ms", explain: "The clock precision a well-run fleet achieves, the baseline that a timestamp-based scheme would rely on." },
          { value: "unsafe for LWW when writes land within ~100ms", explain: "The window inside which a wall-clock scheme would risk ordering two writes wrongly." },
        ],
        breaks: {
          failure: "Detection is all they do. There is no compare-and-set at any W and R.",
          handled: "Two clients reading 100 and both writing 90 both succeed, and a balance or a stock count does not belong in this store as a result.",
        },
        choice: {
          pick: "Version vectors keyed by client actor, siblings returned to the caller",
          instead: "Last-write-wins on a wall-clock timestamp, exactly one value ever returned.",
          decider:
            "Whether the value type has a merge that is commutative, associative and idempotent, against clock skew. A VM live migration or an NTP step can move a clock by 1 to 10 seconds.",
          flips: "Cache entries, recomputable projections and session records, where take one and move on genuinely is correct.",
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
        why: "It is a work queue rather than a store: nothing reads from it, it only replays and empties. It bridges the gap between a short outage and a full repair scan. It sits outside the replica set on purpose, which is why a hint must not count toward W under a strict quorum.",
        numbers: [
          { value: "4.7k writes/s per node share (200k × 3/128)", explain: "The typical hint volume any single node accumulates on behalf of a neighbour." },
          { value: "3 hour default TTL", explain: "How long a hint is kept before it is dropped and the problem is handed to anti-entropy instead." },
          { value: "~60GB of hints per 3 hour outage", explain: "The realistic storage cost one node's full outage window generates." },
        ],
        breaks: {
          failure: "A flapping node produces more hints than a dead one.",
          handled: "Hint-buffer growth rather than node up or down is the metric worth watching, and the replay burst on rejoin has to be throttled to avoid overwhelming the recovering node.",
        },
        choice: {
          pick: "Hint on a neighbour with a 3 hour TTL; hints never count toward a strict W",
          instead: "Sloppy quorum, which deliberately does count hinted writes on non-replicas toward W.",
          decider:
            "Whether the intersection argument survives. If a hint counts, W=2 can be satisfied by two nodes that are not replicas of the key at all, and a later R=2 read overlaps none of the acknowledgers.",
          flips: "When availability during a partition matters more than the invariant, which is most of the time, and is why sloppy quorum is on by default.",
        },
      },
    },
    {
      id: "replica-zone",
      label: "Replica set (N=3), gossiping",
      kind: "zone",
      detail: {
        what: "The three nodes the ring assigns to this key, plus the local storage engine each of them runs.",
        why: "Every node in the fleet is interchangeable, so this box is a role assignment rather than a tier: the same machines coordinate other keys. Membership and token ownership are gossiped between peers.",
        numbers: [
          { value: "N=3 per region", explain: "The replication factor every key gets, no exceptions." },
          { value: "each region holds its own full RF 3 set", explain: "How replication is scoped: every region is independently fully replicated." },
        ],
        breaks: {
          failure: "Two of the three going down at once takes W=2 and R=2 below quorum for that range, and only that range.",
          handled: "That is exactly why the ring spreads ranges across racks, so a single rack failure cannot take two of a key's three replicas at once.",
        },
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
        why: "Three full copies rather than fragments is a payload-size decision. Values here are mutable and about 1.2KB, so replication keeps a read to one node's disk and lets any surviving replica answer alone.",
        numbers: [
          { value: "1.2KB stored record", explain: "The typical value size this whole design is tuned around." },
          { value: "36TB logical at RF 3, ~50TB physical", explain: "The total dataset size once replication and overhead are counted." },
          { value: "3M replica operations/s", explain: "The aggregate replica-side load across the fleet, three times the client-facing rate." },
        ],
        breaks: {
          failure: "Every acknowledged write at W=2 leaves one of the three behind.",
          handled: "200k stale copies per second is the designed steady state, not an incident, which is why convergence mechanisms exist rather than treating this as an error condition.",
        },
        choice: {
          pick: "Full 3x replication",
          instead: "Reed-Solomon 6+3 erasure coding at 1.5x storage.",
          decider:
            "Payload size. RS 6+3 on a 1.2KB record yields 200B fragments, so per-fragment headers and six network hops dominate the payload for every one of 800k reads/s.",
          flips: "Immutable megabyte-to-gigabyte objects, where the storage saving is measured in petabytes and the reconstruct cost is amortised across a large fragment.",
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
        why: "Writes become sequential, which is what makes 200k writes/s at RF 3 cheap per node. Reads pay for it in file opens, and a Bloom filter per SSTable is what brings a point lookup back down to one or two.",
        numbers: [
          { value: "1 to 2 file opens per point read at 1% Bloom FP", explain: "The realistic read cost this engine achieves for a point lookup." },
          { value: "10x write amplification, ~56MB/s per node", explain: "The disk cost this design pays in exchange for cheap, sequential writes." },
          { value: "leveled compaction throttled to ~50MB/s", explain: "Close to but below the ~56MB/s write-amp rate compaction must sustain, why it's watched: a shortfall builds SSTable backlog fast." },
        ],
        breaks: {
          failure: "Compaction competes with foreground reads for queue depth long before it saturates bandwidth.",
          handled: "Read amplification above 10 SSTables per read is the leading indicator, watched as an early signal before latency actually degrades.",
        },
        choice: {
          pick: "LSM tree with a Bloom filter per SSTable and leveled compaction",
          instead: "A page-oriented B-tree updated in place, with a write-ahead log for durability.",
          decider:
            "Whether reads are point lookups or ordered scans. Point reads are near parity: a 1% false-positive Bloom puts an LSM lookup at 1 to 2 file opens against a B-tree's 1.",
          flips: "Read-mostly workloads with the working set in memory, or dominantly ordered scans, where write amplification stops mattering.",
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
        why: "Quorums stay inside a region so the WAN never lands on the request path. The cross-region copy exists for a whole-DC failure and for serving readers near it.",
        numbers: [
          { value: "~70ms transatlantic round trip", explain: "The network cost that would land on every write if quorums crossed regions." },
          { value: "RTO 1 to 5 minutes, RPO 1 to 60 seconds", explain: "The recovery objectives this async replication scheme actually delivers." },
          { value: "WAN cost 5 to 50% of intra-DC traffic", explain: "The bandwidth overhead of shipping mutations across regions relative to local traffic." },
        ],
        breaks: {
          failure: "A long partition between regions grows hint buffers past the TTL and lets version vectors diverge on both sides.",
          handled: "Healing means a full anti-entropy pass and a conflict count somebody has to look at, an accepted cost of choosing availability over cross-region strong consistency.",
        },
        choice: {
          pick: "Active-active, LOCAL_QUORUM per DC plus asynchronous cross-DC replication",
          instead: "EACH_QUORUM, requiring a quorum in every DC on every write.",
          decider:
            "The WAN round trip against a 30ms p99 write budget. EACH_QUORUM pays ~70ms transatlantic on every write and stalls writes entirely when any DC is down.",
          flips: "Rare cross-region operations such as account creation in a multi-region product, where 70ms is acceptable.",
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
        what: "A delete writes a marker carrying a version that dominates what it replaces, stored in the same SSTables as live data. The marker survives gc_grace_seconds before it can be purged.",
        why: "Every convergence mechanism above compares versions, and an absent row loses to a present row in every comparison. A replica that missed the delete would reintroduce the data at the next read repair or repair pass.",
        numbers: [
          { value: "10 day default (864,000s)", explain: "The default retention window this marker survives before it can be purged." },
          { value: "~170GB per region at a 1% delete rate", explain: "The steady-state storage cost this mechanism imposes at typical delete volume." },
          { value: "~100B per tombstone", explain: "200k writes/s x 1% deletes x 10-day grace ≈ 1.7B markers x 100B = the ~170GB/region figure above; cost is retention length, not size." },
        ],
        breaks: {
          failure: "Purge early and you get silent data resurrection.",
          handled: "For a right-to-erasure deletion that is a compliance event, not a bug. The grace period is set to exceed the worst-case repair interval of the coldest range for exactly this reason.",
        },
        choice: {
          pick: "Versioned delete markers held for gc_grace_seconds",
          instead: "Removing the row on delete, as a mutable store would.",
          decider:
            "Version comparison has no representation for absence, so removal cannot win against a replica that still holds the row. The cost is bounded: about 0.5% of logical bytes at a 1% delete rate.",
          flips: "Queue-shaped workloads at a 50% delete rate, where the fix is bucketing by time and dropping whole partitions instead of tuning grace periods.",
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
        what: "The repair scheduler. Each replica builds a Merkle tree over its token ranges, and two replicas compare roots, recursing only into subtrees that disagree.",
        why: "It is the only mechanism with complete coverage, so it is what backstops the cold keys read repair never touches and the writes hinted handoff dropped at the TTL. It runs as its own service so its rate is an operator decision, not a consequence of traffic.",
        numbers: [
          { value: "400GB per node at a 100MB/s throttle is ~4,000s, about 1.1 hours", explain: "The typical duration a full repair pass takes at the throttled rate." },
          { value: "2¹⁵ leaves over 10⁷ keys is ~300 keys per leaf", explain: "The granularity this tree structure operates at, trading precision for message count." },
          { value: "well inside gc_grace of 864,000s", explain: "The margin between how long a pass takes and how long a tombstone is kept, giving comfortable headroom." },
        ],
        breaks: {
          failure: "Repair cost tracks data volume rather than divergence.",
          handled: "A cluster where 0.001% of keys diverged still reads 400GB per node to establish that, an accepted cost that binds at roughly 10x this data on the same node count.",
        },
        choice: {
          pick: "Full subrange Merkle repair, throttled to ~100MB/s",
          instead: "Incremental repair, which tracks which SSTables have already been repaired so a pass touches only new data.",
          decider:
            "Margin against the grace window. A full pass is ~1.1 hours against a 10 day gc_grace, roughly two orders of magnitude of headroom, so correctness beats cleverness for now.",
          flips: "Once data per node grows about 10x and a full pass no longer fits comfortably inside gc_grace.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "geo-dns",
      tier: "hot",
      step: 1,
      label: "get / put(key)",
      detail: {
        what: "The client request, carrying the key, the value on a write, and the quorum the caller wants for this specific call.",
        why: "The quorum is a per-request argument rather than a cluster setting, which is what lets one deployment serve a strict caller and a sloppy one at the same time. Resolution happens once and is cached.",
        numbers: [
          { value: "1M ops/s aggregate", explain: "The total load this front door handles across every client." },
          { value: "4:1 read to write", explain: "The traffic mix carried by this hop." },
        ],
        breaks: {
          failure: "There is no per-request signal telling the caller it got a sloppy quorum instead of a strict one.",
          handled: "A client cannot tell when the guarantee it asked for was quietly voided, an accepted gap in the availability-favouring default.",
        },
      },
    },
    {
      id: "e2",
      from: "geo-dns",
      to: "ring-lookup",
      tier: "hot",
      step: 2,
      label: "any node in that region",
      detail: {
        what: "The request landing on whichever node in the healthy region the client resolved to, which becomes the coordinator for this call.",
        why: "Steering stops at the region. Inside it the client picks whichever node it likes, because none of them is special. Adding a load balancer here would put a machine that can be down back on a path built to have none.",
        numbers: [
          { value: "any of 128 nodes can coordinate per region", explain: "The full set of candidates this hop can route to." },
          { value: "~8k coordinations/s per node", explain: "The average load a single node absorbs in the coordinator role." },
        ],
        breaks: {
          failure: "Clients that pin to one node rather than spreading concentrate connections on it.",
          handled: "Descriptor exhaustion there looks like a cluster problem rather than a client one, which is why client-side spreading is expected behaviour, not a bonus.",
        },
      },
    },
    {
      id: "e3",
      from: "ring-lookup",
      to: "quorum",
      tier: "hot",
      step: 3,
      label: "N owners for this key",
      detail: {
        what: "The output of placement handed to the counter: the three node IDs that own this key's range, in ring order.",
        why: "Drawn inside the coordinator because no network hop happens here, this is one process calling the next stage of itself. That is the whole point of hash placement: the owners are computed, not looked up.",
        numbers: [{ value: "N=3 owners out of 128 nodes", explain: "The output size of this local computation." }],
        breaks: {
          failure: "A node with a stale view of the ring during a topology change hands the counter a node that no longer owns the range.",
          handled: "That is what makes membership convergence a correctness concern and not just bookkeeping, so gossip freshness is watched directly.",
        },
      },
    },
    {
      id: "e4",
      from: "quorum",
      to: "replicas",
      tier: "hot",
      step: 4,
      label: "fan out to all N=3",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Parallel writes carrying the value and its version vector, or a read consisting of one full value request and N-1 digest requests. The client is answered after W acks or R responses.",
        why: "Sending to all N and waiting for W or R is deliberate. Fanning to only W would mean a single slow replica turns into a timeout, instead of being outrun by the other two.",
        numbers: [
          { value: "fan to N=3, wait for W=2 or R=2", explain: "The exact fan-out and wait rule this hop enforces on every request." },
          { value: "R=1 lands near ~1 to 2ms, R=2 near ~4 to 6ms", explain: "The latency this hop costs depending on how many responses are required." },
          { value: "1M client ops/s is 3M replica ops/s", explain: "The multiplier this fan-out applies to raw client traffic." },
        ],
        breaks: {
          failure: "The third replica is still written and still counted for convergence, but the client left at W=2.",
          handled: "A GC pause on that node is invisible to the caller and becomes 200k stale copies per second, the accepted steady-state divergence this design tolerates.",
        },
      },
    },
    {
      id: "e5",
      from: "quorum",
      to: "hints",
      tier: "control",
      label: "replica unreachable",
      fromSide: "right",
      toSide: "top",
      offset: 40,
      detail: {
        what: "A write for a replica that did not answer, stored on a healthy neighbour tagged with the intended owner's node ID.",
        why: "It keeps a short outage from costing that range any write availability, and it bounds how much work anti-entropy has to do later. Under a strict quorum it does not count toward W.",
        numbers: [
          { value: "4.7k writes/s per node share", explain: "The typical hint accumulation rate one node absorbs." },
          { value: "3 hour default TTL", explain: "How long a hint is held before being dropped." },
        ],
        breaks: {
          failure: "If the hint is counted toward W, which is exactly what sloppy quorum does, the intersection argument collapses.",
          handled: "Two non-replicas can satisfy W=2 and a later R=2 read overlaps none of them, which is why this design keeps hints strictly out of the W count.",
        },
      },
    },
    {
      id: "e6",
      from: "hints",
      to: "replicas",
      tier: "control",
      label: "replay on rejoin",
      detail: {
        what: "The neighbour dials the recovered owner and replays its buffered writes in arrival order once gossip reports the owner alive again.",
        why: "It closes the window between a node going down and the next repair pass, which would otherwise be hours away. Replay is throttled because the backlog arrives as a single burst.",
        numbers: [{ value: "~60GB replayed after a 3 hour outage", explain: "The realistic replay volume this hop handles after a typical outage." }],
        breaks: {
          failure: "Past the TTL hints are simply dropped and the problem is handed to anti-entropy.",
          handled: "A node down for four hours converges on the repair timescale rather than the handoff one, an accepted, slower fallback path.",
        },
      },
    },
    {
      id: "e7",
      from: "replicas",
      to: "lsm",
      tier: "hot",
      step: 5,
      label: "commit log + memtable",
      detail: {
        what: "The local durable write on each replica: append to the commit log, insert into the sorted in-memory table, acknowledge.",
        why: "Durability is a sequential append rather than an in-place page update, which is what makes an acknowledgement cheap enough that waiting for two of them fits inside a few milliseconds.",
        numbers: [{ value: "~56MB/s per node sustained at 10x write amplification", explain: "The steady-state disk throughput this local write path drives." }],
        breaks: {
          failure: "Acknowledging from the memtable before the commit log is durable turns a node crash into acknowledged writes that never existed.",
          handled: "No quorum setting can recover from that, which is why the commit log write is strictly ordered before any acknowledgement leaves this node.",
        },
      },
    },
    {
      id: "e8",
      from: "quorum",
      to: "read-repair",
      tier: "control",
      label: "digest mismatch",
      detail: {
        what: "The trigger: the digests returned by the responding replicas do not agree, so a second round pulls full values from all N.",
        why: "Matching digests mean the replicas agree and nothing further happens, which is the common case and the reason digests are worth the extra round in the uncommon one.",
        numbers: [{ value: "one full value plus N-1 digests per read", explain: "The payload shape this comparison relies on to stay cheap in the common case." }],
        breaks: {
          failure: "The comparison happens on the coordinator, so a mismatch is only ever noticed for keys that are actually read.",
          handled: "The cold tail is invisible to it, which is exactly the gap anti-entropy exists to close on its own schedule.",
        },
      },
    },
    {
      id: "e9",
      from: "read-repair",
      to: "replicas",
      tier: "control",
      label: "writeback of the winner",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The winning version, picked by version comparison, written back to whichever replica was behind.",
        why: "Convergence rides on traffic that already happened, so the hot part of the keyspace stays consistent for free. Doing it in the background rather than before the response keeps it off the p99 path.",
        numbers: [{ value: "0ms added to the client response", explain: "Paid entirely after the response ships, unlike anti-entropy's ~1.1-hour scan; hot keys converge for free without waiting on that pass." }],
        breaks: {
          failure: "Nothing guarantees the writeback succeeds, and nothing retries it.",
          handled: "A replica that is down during the repair stays stale until anti-entropy finds it, which is the backstop this mechanism relies on.",
        },
      },
    },
    {
      id: "e10",
      from: "lsm",
      to: "version-vectors",
      tier: "data",
      label: "value + version vector",
      fromSide: "bottom",
      toSide: "right",
      detail: {
        what: "The stored record read back out: value, version vector, TTL header, or a set of concurrent siblings if more than one version survives, returned to the coordinator that asked.",
        why: "The vector travels with the value everywhere because causality has to be decidable at read time on any node, with no shared clock and no coordinator that saw both writes.",
        numbers: [{ value: "16B per writer entry, ~48B per record", explain: "The typical size of the metadata this hop carries alongside the value." }],
        breaks: {
          failure: "Vectors keyed by coordinator node grow without bound under churn and need pruning, and pruning can falsely report concurrency.",
          handled: "Keying by client actor bounds them by the number of writers touching the key instead, avoiding that unbounded growth.",
        },
      },
    },
    {
      id: "e11",
      from: "version-vectors",
      to: "client",
      tier: "control",
      label: "value or sibling set",
      fromSide: "left",
      toSide: "left",
      offset: 40,
      detail: {
        what: "The response: one value when a version dominates, or every concurrent sibling with its vector when none does, for the caller to merge.",
        why: "The store detects and never resolves, so this arrow is where the unresolved conflict is handed out. The caller must write the merged result back with the merged vector as its parent.",
        numbers: [{ value: "alert when siblings/read rises above ~2x baseline", explain: "The operational signal that flags an abnormal rise in write conflicts." }],
        breaks: {
          failure: "If reconciliation code cannot be put in clients, the only options left are restricting values to self-merging types.",
          handled: "Or moving the key to a store with a per-key leader and paying the latency, the two honest alternatives when client-side merge is not feasible.",
        },
      },
    },
    {
      id: "e12",
      from: "lsm",
      to: "tombstones",
      tier: "control",
      label: "delete writes a marker",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A delete stored as a versioned marker inside the same SSTables as live data, rather than removing the row.",
        why: "Removal has no representation in a version comparison, so a replica that missed a delete would win against absence and reintroduce the data. A marker with a dominating version wins those comparisons instead.",
        numbers: [
          { value: "~100B per tombstone", explain: "At ~8% the size of a typical 1.2KB record, one tombstone is cheap; the cost is it can't be purged for 10 days, unlike an overwritten value." },
          { value: "~170GB per region at a 1% delete rate", explain: "The steady-state storage this mechanism costs at typical delete volume." },
        ],
        breaks: {
          failure: "Tombstones are a read cost that outlives the data.",
          handled: "A scan over a mostly-deleted partition still reads every marker to prove the rows are gone, an accepted cost of keeping deletion honest.",
        },
      },
    },
    {
      id: "e13",
      from: "tombstones",
      to: "anti-entropy",
      tier: "control",
      label: "gc_grace > repair time",
      fromSide: "right",
      toSide: "right",
      detail: {
        what: "The sizing constraint that ties the two together. A tombstone may only be purged once every replica has certainly seen it, which means after a full repair pass has covered its range.",
        why: "This single comparison is what the whole convergence design reduces to. If the repair cycle time for the coldest range ever exceeds the grace period, a returning replica resurrects deleted rows.",
        numbers: [
          { value: "~1.1 hour pass against 864,000s of grace", explain: "The actual margin between repair duration and how long a tombstone is kept." },
          { value: "alert when repair lag exceeds gc_grace / 2", explain: "The threshold that flags this margin eroding before it becomes dangerous." },
        ],
        breaks: {
          failure: "The direction of the fix is counterintuitive: if repair falls behind you raise the grace period.",
          handled: "Repair is the thing already saturated, so raising the grace period buys time rather than trying to speed up an already-maxed-out process.",
        },
      },
    },
    {
      id: "e14",
      from: "lsm",
      to: "anti-entropy",
      tier: "control",
      label: "Merkle over ranges",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The tree build: read every key in the range, hash small ranges into leaves, hash children into parents up to a root.",
        why: "Comparison has to be cheap enough to run between every pair of replicas, and a tree makes that logarithmic in messages. The read is the cost you cannot avoid.",
        numbers: [
          { value: "400GB per node at 100MB/s is ~1.1 hours", explain: "This fixed ~1.1h runs whether one key diverged or a million did, why the safe-delete window is coupled to total bytes, not actual drift." },
          { value: "throttled to ~100MB/s so it does not compete with foreground reads", explain: "Set independently of compaction's ~50MB/s throttle on the same disk, so this pass doesn't compound an already-busy write-amp budget." },
        ],
        breaks: {
          failure: "The pass takes the same hour whether one key diverged or a million did.",
          handled: "That couples the safe deletion window to total bytes rather than to anything about deletions, an accepted property of a full-scan repair strategy.",
        },
      },
    },
    {
      id: "e15",
      from: "anti-entropy",
      to: "replicas",
      tier: "control",
      label: "resync diverged ranges",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Streaming the key ranges under the disagreeing subtrees from a healthy replica to the one that is behind, written into its store as files rather than replayed as writes.",
        why: "This is the only mechanism with complete coverage, so it is what finally converges the cold keys read repair never sees and the writes hinted handoff dropped at the TTL.",
        numbers: [{ value: "2¹⁵ leaves over 10⁷ keys resyncs ~300 keys per diverged key", explain: "The over-repair cost this granularity imposes for every actually-diverged key." }],
        breaks: {
          failure: "Over-repair is normal: leaf granularity means one diverged key drags about 300 neighbours across the wire.",
          handled: "Repair traffic is not proportional to damage as a result, an accepted trade for keeping the tree comparison itself cheap.",
        },
      },
    },
    {
      id: "e16",
      from: "replicas",
      to: "remote-region",
      tier: "control",
      label: "async cross-DC shipping",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Mutations shipped to the other region's replica set after the local quorum has already answered the client.",
        why: "Putting the WAN inside the quorum would add ~70ms to every write against a 30ms budget and would stall writes whenever any region is unhealthy. Shipping asynchronously buys a disaster-recovery copy and local reads elsewhere.",
        numbers: [
          { value: "~70ms transatlantic", explain: "The round trip this design avoids putting on the write path." },
          { value: "RPO 1 to 60 seconds", explain: "The recovery point objective accepted in exchange for that latency saving." },
          { value: "WAN cost 5 to 50% of intra-DC traffic", explain: "The bandwidth this async shipping consumes relative to local traffic." },
        ],
        breaks: {
          failure: "Writes accepted here in the last few seconds are simply not in the other region yet.",
          handled: "A region failover loses them, and a long partition means both sides accept conflicting writes that only converge on repair, an accepted cost of the RPO.",
        },
      },
    },
    {
      id: "e17",
      from: "client",
      to: "cas-store",
      tier: "control",
      label: "values with invariants",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The values that never enter the leaderless store: balances, stock counts, anything whose next value is a function of its current one.",
        why: "No W and R setting creates a compare-and-set, and version vectors only report the collision after both writes succeeded. Drawing the boundary is the honest move.",
        numbers: [{ value: "two clients reading 100 and both writing 90 both succeed", explain: "The concrete failure this boundary exists to prevent from ever happening in the leaderless store." }],
        breaks: {
          failure: "Nothing enforces this arrow. It is a convention.",
          handled: "The failure when somebody ignores it is a lost update that no metric in this store reports, which is why this boundary depends on discipline outside the system.",
        },
      },
    },
  ],
  figures: {
    "read-repair": {
      title: "Read repair: two fast replicas satisfy R=2, the stale third catches up",
      nodes: [
        { id: "client", label: "Client", kind: "client", col: 0, row: 0 },
        { id: "coordinator", label: "Coordinator", kind: "service", col: 0, row: 1 },
        {
          id: "replica-fast",
          label: "Replica 1 + 2",
          sub: "v=5, respond fast",
          kind: "database",
          col: 0,
          row: 2,
          detail: {
            what: "The two replicas that answer quickly with the current value, satisfying R=2.",
            why: "The coordinator only needs R of N responses to answer the client, so it never waits for the slowest replica.",
          },
        },
        {
          id: "replica-stale",
          label: "Replica 3",
          sub: "v=3, stale, late",
          kind: "database",
          col: 0,
          row: 3,
          detail: {
            what: "The replica that missed the last write and answers late with an old version.",
            why: "Its stale reply arrives after the client already has an answer, so the mismatch is repaired in the background rather than on the client's critical path.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "client", to: "coordinator", tier: "hot", step: 1, label: "GET key" },
        { id: "e2", from: "coordinator", to: "replica-fast", tier: "hot", step: 2, label: "read → v=5" },
        { id: "e3", from: "coordinator", to: "replica-stale", tier: "hot", step: 3, label: "read → v=3, late" },
        { id: "e4", from: "coordinator", to: "client", tier: "hot", step: 4, label: "v=5, R=2 satisfied" },
        { id: "e5", from: "coordinator", to: "replica-stale", tier: "hot", step: 5, label: "write_repair(v=5)" },
      ],
    },
    "version-vectors": {
      title: "Version vectors: dominance versus concurrency",
      nodes: [
        { id: "va", label: "{A:3, B:5}", kind: "database", col: 0, row: 0 },
        {
          id: "vb",
          label: "{A:4, B:5}",
          kind: "database",
          col: 1,
          row: 0,
          detail: {
            what: "A vector where every component is greater than or equal, and one strictly greater.",
            why: "That makes it strictly newer than {A:3, B:5}, so the store can order the two writes with no ambiguity.",
          },
        },
        { id: "vc", label: "{A:3, B:5}", kind: "database", col: 0, row: 1 },
        {
          id: "vd",
          label: "{A:4, B:4}",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "A vector that is greater in one component and lower in another.",
            why: "Neither vector dominates the other, so the store reports the two writes as concurrent and returns both as siblings rather than guessing which is newer.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "va", to: "vb", tier: "hot", step: 1, label: "dominates: strictly newer" },
        { id: "e2", from: "vc", to: "vd", tier: "data", label: "no dominance: concurrent" },
      ],
    },
  },
};
