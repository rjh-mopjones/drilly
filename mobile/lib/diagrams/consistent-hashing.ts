import type { Diagram } from "./types";

export const CONSISTENT_HASHING: Diagram = {
  id: "consistent-hashing",
  title: "Consistent Hashing",
  question: "Design Consistent Hashing",
  sourceId: "patterns",
  itemId: 2,
  overview: {
    shape:
      "Consistent hashing is not a service you call, it is a pure function compiled into every node, so the system around it is an in-process lookup on the hot path plus a membership plane that rewrites the ring about ten times a day.",
    beats: [
      "The hot path never leaves the process. A caller hands a key to the ring library, which hashes it with a seeded xxHash and binary-searches a sorted uint32 array of 200k positions, so a lookup is ~18 comparisons and ~100ns with no network hop at all.",
      "Virtual nodes are what make the answer even. One position per server leaves the unluckiest of ten servers owning 2.93 times the average by luck alone, so each physical server gets around 200 scattered positions and the coefficient of variation of owned keyspace falls as 1/sqrt(V) to 7.1%.",
      "Replication is the same walk continued. After the primary you keep going clockwise to the next distinct physical hosts, skipping further positions of a host already chosen and optionally same-rack or same-AZ hosts, so RF=3 falls out of the structure rather than out of a second placement table.",
      "Membership is the actual system, and it splits into three jobs that people conflate. A failure detector decides, with quorum, that a node is down; a small consensus group issues the monotonic epoch; gossip disseminates the resulting view to 1000 nodes in around ten seconds at 3KB/s per node.",
      "A join moves one small arc per position. The joining node claims 1/(N+1) of the keyspace, roughly 30GB at 1000 nodes and 30GB apiece, pulled from up to 200 donors. Writes flip at the epoch bump, reads dual-read both owners, and the donor deletes last so an abort costs nothing.",
      "The whole shape is one deliberate asymmetry: expensive on change, free on read. Two round trips of coordination per membership change buys a steady-state lookup with no coordination at all, and that only pays because membership changes ten times a day while lookups happen a million times a second per node.",
    ],
    crux:
      "Membership is eventually consistent while ownership has to be single-valued. A node holding a stale ring will confidently serve from the wrong owner and nothing in the system notices, so the epoch stamped on every request is not bookkeeping, it is the only thing converting a correctness bug into a latency blip.",
    numbers: [
      "200 positions per server, spread 7.1%",
      "~100ns lookup over a 3.2MB ring",
      "a join moves 1/(N+1), about 0.1% at N=1000",
    ],
  },
  nodes: [
    {
      id: "inproc-group",
      label: "In-process, no network hop",
      kind: "group",
      x: 16,
      y: 94,
      w: 328,
      h: 328,
      detail: {
        what: "The whole lookup: hash the key, binary-search the ring, walk to the replica set. All of it runs inside the caller's process against local memory.",
        why: "The requirement that shapes everything else is that no lookup consults a coordinator. At a sub-1ms budget and 1M lookups/s/node, a network hop per lookup is not a slower design, it is a different one.",
        numbers: ["~100ns end to end", "3.2MB of state per node", "1M lookups/s/node budgeted"],
        breaks:
          "Everything in this box is a cached view of membership, so its correctness is entirely inherited from the epoch check on the way out.",
      },
    },
    {
      id: "client",
      label: "Calling service",
      sub: "get_node(key), get_replicas(key, 3)",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "Whatever service needs to know where a key lives. It links the ring as a library rather than calling a lookup service.",
        why: "Drawn explicitly because it sets the constraint the rest answers to: this caller runs the lookup a million times a second per node and cannot afford a round trip, which is why the mapping has to be derivable locally.",
        numbers: ["~1M lookups/s/node", "sub-1ms budget, in-process"],
        breaks:
          "A caller that caches a resolved owner instead of recomputing it holds a stale answer straight through a membership change, with no epoch attached to catch it.",
      },
    },
    {
      id: "hasher",
      label: "Key hash",
      sub: "xxHash, seed pinned in config",
      kind: "compute",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "Maps a key into the 32-bit position space: `pos = xxhash(key) % RING_SIZE`.",
        why: "Placement has to be a pure function of the key, so every node in the fleet must land on the identical position or the same key quietly lives in two places. Agreement matters far more here than distribution quality.",
        numbers: ["32-bit position space", "~500MB/s on short inputs", "one hash per lookup"],
        breaks:
          "A binary upgrade that changes the function or the seed diverges placement fleet-wide and every read misses, so a node must refuse to boot when its hash signature does not match the cluster's.",
        choice: {
          pick: "xxHash, non-cryptographic, with the seed pinned in config on every node",
          instead: "A cryptographic digest such as MD5 or SHA-1, truncated to 32 bits.",
          decider:
            "Cost per lookup at 1M lookups/s/node. xxHash runs at ~500MB/s on short inputs, so hashing a 32B key is a few nanoseconds against ~100ns for the binary search that follows; a cryptographic digest is an order of magnitude more for collision resistance the ring never uses.",
          flips:
            "When key names are attacker-controlled and a deliberate collision storm onto one node is a real threat, where a keyed hash buys that at the cost of the hot path.",
        },
      },
    },
    {
      id: "ring",
      label: "Ring: sorted uint32 array",
      sub: "200k entries, ~3.2MB, bisect_left",
      kind: "store",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "Every node's in-memory copy of the ring: positions sorted ascending, looked up with `bisect_left(ring_positions, pos)` wrapped modulo the ring length.",
        why: "The mapping is derived rather than stored, so the entire fleet's placement fits in a few megabytes on every machine. That is what buys a lookup with no network hop and a thousand nodes agreeing without coordinating per request.",
        numbers: [
          "1000 servers x 200 positions = 200k entries",
          "16B per entry = 3.2MB, sits in L2 (1-4MB)",
          "log2(200000) ~ 18 comparisons, ~100ns",
        ],
        breaks:
          "It is a cached view. A node holding a lower epoch than a request it receives must refresh before answering, or it serves from the previous owner and nothing downstream notices.",
        choice: {
          pick: "A sorted uint32 array in local memory on every node, binary searched",
          instead:
            "A few thousand fixed partitions with an explicit partition-to-server map published by a control plane.",
          decider:
            "3.2MB of derived state against an availability dependency on the read path. The array answers in ~100ns from L2 at 1M lookups/s/node; the explicit map is smaller but has to be versioned, distributed and consulted, which puts a control plane in front of a lookup built to cost 100ns.",
          flips:
            "When you must steer one specific hot range onto dedicated hardware. No hash-derived scheme can express that, and an explicit map is the only option that can.",
        },
      },
    },
    {
      id: "replica-walk",
      label: "Replica walk",
      sub: "next 3 distinct hosts, AZ-aware",
      kind: "compute",
      x: 40,
      y: 330,
      w: 280,
      detail: {
        what: "Continues clockwise from the primary position to the next N distinct physical hosts, skipping further positions of a host already chosen.",
        why: "Replica selection falls out of the same walk that found the primary, so there is no second mechanism and no replica table that can drift out of step with the ring. Failure-domain spread is one extra skip predicate on the same loop.",
        numbers: ["RF = 3", "skips repeat positions of a chosen host", "optionally skips same-rack or same-AZ"],
        breaks:
          "With 200 random positions a node's replica peers are effectively the entire cluster, so nearly every 3-node combination is the replica set for some key and any three simultaneous failures lose data.",
        choice: {
          pick: "Derive the replica set by continuing the same clockwise walk to 3 distinct hosts",
          instead: "A separately maintained replica placement table consulted after the primary lookup.",
          decider:
            "How many structures have to agree. Replicas derived from the same walk cannot disagree with the primary; a separate table can, and then two structures must be kept in step across every one of the ~10 membership changes per day and every one of the 200 arcs each moves.",
          flips:
            "When placement must satisfy constraints the walk cannot express, such as pinning one tenant's replicas to named hosts, which needs an explicit map rather than a rule.",
        },
      },
    },
    {
      id: "data-node",
      label: "Owning storage node",
      sub: "~30GB, serves its 200 arcs",
      kind: "compute",
      x: 40,
      y: 440,
      w: 280,
      detail: {
        what: "The physical server the walk resolved to. It owns roughly 1/1000 of the keyspace spread across 200 small arcs and serves reads and writes for them.",
        why: "The ring stores nothing per key, so this is where the bytes are and this is what makes a membership change expensive. 10^10 keys at ~1KB with RF=3 is 30TB, which is 30GB apiece over 1000 nodes.",
        numbers: [
          "30TB / 1000 nodes = 30GB per node",
          "200 arcs per node",
          "ring epoch carried on every inter-node RPC",
        ],
        breaks:
          "A freshly joined node claims its arcs at the epoch bump with an empty page cache, so p99 for those keys spikes for minutes until reads are allowed to move across.",
        choice: {
          pick: "~30GB per node across 1000 nodes",
          instead: "Far denser nodes at ~10TB each, with a correspondingly smaller fleet.",
          decider:
            "Rebalance time. At 30GB a join transfers in ~10s, bounded by the recipient's ~3GB/s NIC. The same arithmetic at 10TB per node gives ~1 hour, which is the point where throttling stops being optional and any node loss becomes an hour-long rebuild.",
          flips:
            "When storage cost dominates and membership churn is genuinely rare, where dense nodes are far cheaper per byte and an hour-long rebuild is a price worth paying.",
        },
      },
    },
    {
      id: "handoff",
      label: "Arc handoff",
      sub: "writes flip at epoch, donor deletes last",
      kind: "compute",
      x: 40,
      y: 550,
      w: 280,
      detail: {
        what: "The migration of one arc: stream the range to the new owner, dual-read both owners while it is in flight, cut writes over at the epoch, then let the donor drop its copy.",
        why: "For the duration the arc has two plausible owners, and the ordering of the cutover is the only thing deciding whether a crash costs a partial copy or an entire range. Writes need exactly one destination; reads can afford two.",
        numbers: [
          "dual reads cover 1/(N+1), about 0.1% at N=1000",
          "recipient inbound concurrency capped, not bytes per stream",
          "a second epoch bump marks the handoff complete",
        ],
        breaks:
          "Reverse the delete ordering and a crash at 90% transferred loses the arc outright; as built, the rollback is deleting a partial copy on a machine that is already dead.",
        choice: {
          pick: "Writes flip at the epoch bump, reads dual-read until complete, donor deletes last",
          instead: "Cut reads and writes over together at the end, or hand ownership over immediately on join.",
          decider:
            "What a crash mid-transfer costs. With the donor deleting last a failed join is abandoned rather than rolled back, and the doubled reads that buys touch only the arc under migration, 1/(N+1) of the keyspace or about 0.1% at N=1000, invisible in aggregate.",
          flips:
            "A pure cache with no durability requirement, where losing an arc is a miss rather than data loss and the simpler single cutover is fine.",
        },
      },
    },
    {
      id: "donors",
      label: "Donor nodes",
      sub: "up to 200 per join, ~150MB each",
      kind: "compute",
      x: 40,
      y: 660,
      w: 280,
      detail: {
        what: "The existing servers that each cede a handful of small arcs to a joining node and stream the data behind them.",
        why: "With 200 positions per server a join takes tiny slices from nearly the whole fleet instead of half of one neighbour's range. That is exactly why load smooths out, and it is also why pacing a rebuild is a fleet-wide decision rather than a local one.",
        numbers: [
          "~30GB total, ~150MB per donor",
          "200 donors x 50MB/s = 10GB/s inbound, 80Gbps",
          "recipient NIC ~3GB/s is the real limit, ~10s transfer",
        ],
        breaks:
          "Rebalance traffic competes with foreground serving on every donor at once, so a join degrades p99 across the cluster rather than on one pair of machines.",
        choice: {
          pick: "Cap concurrent inbound streams at the recipient",
          instead: "Throttle bytes per donor stream, say 50MB/s each.",
          decider:
            "200 donors at a 50MB/s per-stream throttle is still 10GB/s inbound, which is 80Gbps and well past a 25GbE NIC, so the per-stream number bounds nothing useful. The recipient's NIC at ~3GB/s is the actual constraint and it is the one worth expressing.",
          flips:
            "A low-vnode ring, say 16 positions per node, where a rebuild pulls from 16 peers and the per-stream budget genuinely is the whole budget.",
        },
      },
    },
    {
      id: "vnode-table",
      label: "vnode to physical map",
      sub: "server_id, rack, az",
      kind: "store",
      x: 440,
      y: 220,
      w: 260,
      detail: {
        what: "The mapping from each ring position to the physical server behind it, together with that server's rack and availability zone.",
        why: "The ring answers which position, not which machine. The replica walk needs physical identity to tell when two positions are the same host, and needs the failure-domain labels to spread the replica set across them.",
        numbers: ["~200 vnode ids per physical server", "200k rows at 1000 servers", "carried alongside the ring in the same few MB"],
        breaks:
          "Wrong or missing rack and AZ labels let the walk place all three replicas in one failure domain while every metric still reports three replicas.",
        choice: {
          pick: "Around 200 randomly placed positions per physical server",
          instead:
            "Around 16 positions per server, placed by an allocation algorithm that picks each token to minimise the resulting imbalance.",
          decider:
            "Load spread against blast radius. Random placement gives a coefficient of variation of 1/sqrt(V): V=1 is 100% and leaves the worst of ten servers at 2.93x average, V=200 is 7.1%, V=1000 is 3.2%. Metadata is never the constraint at 3.2MB.",
          flips:
            "When correlated-failure durability matters more than an even spread. At RF=3 with 256 random positions on 100 nodes nearly every 3-node combination is a replica set, so any three simultaneous failures lose data. Cassandra dropped its default from 256 to 16 in 4.0 (2021) and paired it with deliberate token allocation for exactly this.",
        },
      },
    },
    {
      id: "failure-detector",
      label: "Failure detector",
      sub: "phi-accrual, k=5 rounds + quorum",
      kind: "compute",
      x: 440,
      y: 340,
      w: 260,
      detail: {
        what: "Watches peer heartbeats and maintains a suspicion level per node, escalating to a down declaration only once a quorum of peers agrees.",
        why: "A missed heartbeat is one node's opinion. Acting on it unilaterally is how a brief network blip turns into terabytes of pointless migration, so declaring a node down is a decision with a quorum behind it rather than an observation.",
        numbers: [
          "k=5 consecutive missed rounds at 1Hz = 5s floor",
          "~2 failures/day at 1000 nodes with ~500-day MTBF",
          "~10 membership events/day in total",
        ],
        breaks:
          "Tuned too tight it flaps, and the same arc migrates away and back; hysteresis before a returned node is promoted is what stops the oscillation.",
        choice: {
          pick: "Phi-accrual suspicion, plus k=5 missed rounds and quorum agreement before acting",
          instead: "A fixed heartbeat timeout, acted on by whichever node noticed first.",
          decider:
            "The cost of a false positive. A wrong down declaration moves 30GB for nothing, so a 5s floor plus quorum is cheap insurance, and phi-accrual additionally raises the bar on links that are habitually slow instead of tripping on every latency excursion.",
          flips:
            "Small clusters that already run a coordination service on the path, where its session timeout is the failure detector and there is nothing to build.",
        },
      },
    },
    {
      id: "epoch-issuer",
      label: "Epoch issuer",
      sub: "consensus group or leaseholder",
      kind: "store",
      x: 440,
      y: 450,
      w: 260,
      detail: {
        what: "A small consensus group, or a designated coordinator holding a lease from one, that issues the monotonic epoch stamped on every ring version.",
        why: "Gossip converges a fleet on facts but cannot make a decision: two nodes can decide S2 is dead differently and both will happily spread their version. Ordering membership changes needs exactly one decider, and this is the only thing left on the path that needs consensus.",
        numbers: [
          "~10 epoch increments/day",
          "two round trips of coordination per membership change",
          "epoch carried on every inter-node RPC",
        ],
        breaks:
          "Lose quorum and the epoch stops advancing. Steady-state lookups keep working from the last ring, but every topology change has to be refused until quorum returns.",
        choice: {
          pick: "Epoch increments from a small consensus group, with gossip doing the dissemination",
          instead:
            "A coordination service that holds the full membership and is watched directly by every node.",
          decider:
            "Cluster size. Linearizable membership from a coordination service is worth a lot below a few hundred nodes, but the watcher count becomes the bottleneck, and pushing every one of 1000 nodes a change is a fan-out problem gossip solves for 3KB/s per node.",
          flips:
            "Below a few hundred nodes, where putting the whole membership in the coordination service is simpler, removes the stale-view window entirely, and the watch fan-out is nowhere near its limit.",
        },
      },
    },
    {
      id: "membership",
      label: "Membership view",
      sub: "gossip, 3 random peers/s",
      kind: "store",
      x: 440,
      y: 560,
      w: 260,
      detail: {
        what: "The `(epoch, [node_id, state, positions, heartbeat])` view every node holds, exchanged with a few random peers every second.",
        why: "The ring is a pure function of this view, so agreeing on the view is the entire remaining problem. Gossip is chosen for the dissemination half because it has no central fan-out point and degrades gracefully under churn.",
        numbers: [
          "3 random peers per second per node",
          "~1KB per round x 3 = 3KB/s per node",
          "convergence ~10s at 1000 nodes",
        ],
        breaks:
          "A node partitioned from its peers but still reachable by clients holds a stale ring and answers confidently. The guard is refusing to serve when the last successful gossip exchange is older than 30s, which trades availability for not being wrong.",
        choice: {
          pick: "Gossip: 3 random peers every second, epoch attached to every exchange",
          instead: "Every node watching a coordination service for the membership record.",
          decider:
            "Fan-out cost. Gossip is 3KB/s per node and converges in ~10s at 1000 nodes with no central watcher; a coordination service has to push each of ~10 changes/day to 1000 watchers, and that watcher count is what stops scaling past a few hundred nodes.",
          flips:
            "A few hundred nodes or fewer, where linearizable membership removes the eventual-consistency window that gossip creates and the epoch machinery gets much simpler.",
        },
      },
    },
    {
      id: "snapshots",
      label: "Ring snapshots",
      sub: "hourly, object storage",
      kind: "store",
      x: 440,
      y: 670,
      w: 260,
      detail: {
        what: "Hourly snapshots of the ring plus membership state, written to object storage for audit.",
        why: "Ownership is computed rather than recorded, so after the fact nothing in the system knows who owned a key yesterday. Every wrong-replica investigation starts with that question, and it cannot be answered from a structure that holds no history.",
        numbers: ["~5MB per snapshot", "5MB x 8760 = ~44GB/yr", "hourly cadence"],
        breaks:
          "Hourly granularity misses changes between snapshots, so a short-lived flap leaves no trace of the ownership it briefly caused.",
        choice: {
          pick: "Hourly snapshots of ring and membership state to object storage",
          instead: "Retaining the full epoch history inside the coordination service.",
          decider:
            "44GB/yr in object storage costs nothing and sits off the serving path, whereas keeping ~10 epochs a day of full ring state in a consensus store grows the thing every membership change depends on, for a read nobody makes in real time.",
          flips:
            "When you need per-change rather than per-hour granularity, where an append-only log of epoch deltas is the right structure and hourly snapshots are the wrong one.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "hasher",
      label: "get(key)",
      animated: true,
      detail: {
        what: "A key arriving at the ring library, in process, as a function call rather than an RPC.",
        why: "The entire design is shaped to keep this a function call. Anything that consults a coordinator per request blows a sub-1ms budget at a million lookups a second per node.",
        numbers: ["~1M lookups/s/node"],
        breaks:
          "A caller that caches the resolved owner rather than recomputing it carries a stale answer past a membership change with no epoch attached to catch it.",
      },
    },
    {
      id: "e2",
      from: "hasher",
      to: "ring",
      label: "pos = xxhash(key) % 2^32",
      animated: true,
      detail: {
        what: "The 32-bit position the key hashes to, handed to the ring for a binary search.",
        why: "Keys and servers live in the same space, and that is the whole trick: ownership becomes a property of a key's nearest neighbour rather than of the fleet size, which is the global quantity modulo hashing depends on.",
        numbers: ["32-bit space", "a few ns per short-key hash"],
        breaks:
          "Two nodes computing this with different seeds land on different positions for the same key, and the cluster silently splits its keyspace with no error anywhere.",
      },
    },
    {
      id: "e3",
      from: "ring",
      to: "replica-walk",
      label: "bisect_left, first vnode clockwise",
      animated: true,
      detail: {
        what: "The binary search result: the index of the first ring position at or above the key's position, wrapped modulo the ring length.",
        why: "This is the local property that replaces `% N`. The answer depends only on the nearest position clockwise, so a membership change elsewhere on the circle cannot change it, which is why a join moves 1/(N+1) of keys instead of all of them.",
        numbers: ["~18 comparisons over 200k entries", "~100ns on an L2 hit"],
        breaks:
          "The wrap at the top of the ring is the classic off-by-one: miss it and every key hashing above the highest position has no owner at all.",
      },
    },
    {
      id: "e4",
      from: "replica-walk",
      to: "vnode-table",
      label: "vnode to host, rack, az",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Resolving each position on the walk to the physical server behind it, along with its failure-domain labels.",
        why: "The walk has to know when two positions are the same machine. Without that, taking the next three positions can quietly return one host three times, and RF=3 becomes RF=1 with nothing reporting it.",
        numbers: ["200 positions per host", "RF = 3 distinct hosts"],
        breaks:
          "Stale or missing rack and AZ labels put all three replicas in one domain while the cluster still believes it is spread across three.",
      },
    },
    {
      id: "e5",
      from: "replica-walk",
      to: "data-node",
      label: "primary + 2 replicas",
      animated: true,
      detail: {
        what: "The ordered replica list, and the request going to the primary, stamped with the caller's ring epoch.",
        why: "The ring's entire output is an ordered list of nodes: it holds no state, does no I/O and has no failure mode of its own. What happens when two clients write concurrently or only two of three replicas answer is a different question.",
        numbers: ["RF = 3", "epoch on every inter-node RPC"],
        breaks:
          "A node receiving a request that carries an epoch higher than its own must refresh before answering. Skip that and a stale view becomes a wrong answer instead of a latency blip.",
      },
    },
    {
      id: "e6",
      from: "membership",
      to: "ring",
      label: "(epoch, positions)",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      offset: 60,
      detail: {
        what: "A converged membership view being applied: positions recomputed and the local ring rebuilt with the new epoch stamped on it.",
        why: "The ring is derived, never authored, so this is the only way it ever changes. Keeping the derivation local is what lets a thousand nodes agree on placement without any of them talking to each other at lookup time.",
        numbers: ["~10 rebuilds/day", "200k entries rebuilt from the view"],
        breaks:
          "Applying a view without comparing epochs, or applying an older one out of order, silently rolls ownership backwards and reintroduces the stale-owner bug from the inside.",
      },
    },
    {
      id: "e7",
      from: "failure-detector",
      to: "epoch-issuer",
      label: "down, with quorum",
      dashed: true,
      detail: {
        what: "An escalation: enough peers agree a node has missed k consecutive rounds, so a membership change is proposed.",
        why: "Detection and decision are deliberately separate. Gossip can spread the fact that a node looks unreachable, but only one place is allowed to turn that into the statement that its arcs are reassigned.",
        numbers: ["k=5 missed rounds at 1Hz", "quorum of peers required"],
        breaks:
          "Without the quorum step, one node with a failing NIC reassigns a healthy peer's arcs and moves 30GB for nothing, then moves it back when the link recovers.",
      },
    },
    {
      id: "e8",
      from: "epoch-issuer",
      to: "membership",
      label: "epoch++, new node state",
      dashed: true,
      detail: {
        what: "The decided membership change, published as a new `(epoch, membership)` pair for gossip to spread.",
        why: "This is the handover from consensus to dissemination. Consensus decides once, about ten times a day, and gossip does the fan-out to a thousand nodes that a consensus group would be a poor tool for.",
        numbers: ["~10 changes/day", "converged across 1000 nodes in ~10s"],
        breaks:
          "Gossip can deliver views out of order, so a node has to compare epochs rather than trust the most recent exchange it happened to have.",
      },
    },
    {
      id: "e9",
      from: "data-node",
      to: "failure-detector",
      label: "heartbeat + epoch, 1Hz",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      offset: 40,
      detail: {
        what: "Heartbeats and the sender's current epoch, exchanged with three random peers every second.",
        why: "Liveness is measured by peers rather than reported to a central watcher, for the same reason membership is gossiped: no fan-out point, and the per-node cost stays flat as the fleet grows.",
        numbers: ["3 peers/s", "~3KB/s per node", "epoch skew alerts above 3"],
        breaks:
          "A heartbeat proves the process is up, not that its data is current, so a node that flapped and returned looks perfectly healthy while serving reads from a cold, stale copy.",
      },
    },
    {
      id: "e10",
      from: "membership",
      to: "snapshots",
      label: "hourly, ~5MB",
      dashed: true,
      detail: {
        what: "The current ring and membership state written out to object storage once an hour.",
        why: "Ownership is computed, not recorded, so without this there is no way to answer who owned key K on date D, which is where every stale-read investigation starts.",
        numbers: ["~5MB per snapshot", "~44GB/yr"],
        breaks:
          "The snapshot is a by-product nothing depends on, so nothing notices when it stops; the first symptom is an investigation with no history to read.",
      },
    },
    {
      id: "e11",
      from: "epoch-issuer",
      to: "handoff",
      label: "epoch bump: writes flip",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      offset: 100,
      detail: {
        what: "The epoch bump that makes the new owner the single destination for writes to the arc under migration.",
        why: "A write must have exactly one home, so ownership flips atomically at the epoch rather than drifting across the fleet as gossip converges. Reads are the side that can tolerate two answers, and they do, by dual-reading.",
        numbers: ["one bump to flip writes, a second to mark the handoff done"],
        breaks:
          "Bump too early and the arc takes writes into a node holding none of its prior contents; bump too late and two nodes both believe they own the write.",
      },
    },
    {
      id: "e12",
      from: "data-node",
      to: "handoff",
      label: "join: claim 200 positions",
      detail: {
        what: "A joining or returning node registering its positions, which is what defines the set of arcs to transfer.",
        why: "The arcs follow from the ring rather than from a placement decision: the joining node claims exactly the keyspace between each of its positions and the position counter-clockwise of it, and nothing else in the circle changes owner.",
        numbers: ["claims 1/(N+1) of the keyspace", "~30GB at N=1000 and 30GB per node", "200 arcs"],
        breaks:
          "A returning node that claims its arcs and immediately serves reads answers from a cold cache with data stale by however long it was away. It takes writes at once and reads only once warm.",
      },
    },
    {
      id: "e13",
      from: "handoff",
      to: "donors",
      label: "pull arc ranges",
      detail: {
        what: "Requests to each donor for the specific contiguous key ranges it is ceding, staged arc by arc so the transfer can be paused.",
        why: "Streaming a contiguous range is the reason this is a ring at all. Rendezvous hashing gives the same minimal-disruption property with better balance, and gives you no contiguous range to hand off, repair or reason about.",
        numbers: ["up to 200 donors per join", "~150MB per donor"],
        breaks:
          "Rebalance reads compete with foreground serving on the donors, and with 200 positions per node that pressure lands on the whole cluster rather than one neighbour.",
      },
    },
    {
      id: "e14",
      from: "donors",
      to: "data-node",
      label: "~30GB streamed, donor deletes last",
      fromSide: "right",
      toSide: "right",
      offset: 60,
      detail: {
        what: "The actual bytes, plus the ordering that makes a join abortable: the donor drops its copy only after the recipient acknowledges the arc and the epoch marks the handoff complete.",
        why: "For the duration the arc has two plausible owners, and the delete ordering is the only thing separating an abandoned migration from a lost range. Reverse it and a crash at 90% transferred costs data.",
        numbers: ["~10s at a ~3GB/s recipient NIC", "~1 hour at 10TB per node"],
        breaks:
          "200 donors at 50MB/s is 10GB/s inbound, so the recipient's NIC saturates and foreground p99 climbs unless inbound concurrency is capped at the recipient rather than per stream.",
      },
    },
  ],
};
