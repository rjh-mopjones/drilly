import type { Diagram } from "./types";

export const CONSISTENT_HASHING: Diagram = {
  id: "consistent-hashing",
  title: "Consistent Hashing",
  question: "Design Consistent Hashing",
  sourceId: "patterns",
  itemId: 2,
  overview: {
    shape:
      "Consistent hashing is not a service you call, it is a pure function compiled into every node. The system around it is an in-process lookup on the hot path, plus a membership plane rewriting the ring about ten times a day.",
    forces: [
      {
        constraint: "a caller runs the lookup ~1M times/s/node with a sub-1ms budget, no room for a network hop",
        decision: "The ring is compiled into every node as an in-process library, so a lookup never leaves the process",
        lights: ["caller", "ring-lib", "e1"],
      },
      {
        constraint: "one position per server leaves the unluckiest of ten servers owning 2.93x the average, by luck alone",
        decision: "Each physical server gets ~200 scattered virtual node positions, dropping the spread's coefficient of variation to 7.1%",
        lights: ["vnode-table", "e4"],
      },
      {
        constraint: "membership is eventually consistent, but ownership has to be single-valued at read time",
        decision: "Every ring version and every RPC carries a monotonic epoch, so a stale node refreshes instead of silently answering wrong",
        lights: ["epoch-issuer", "gossip-view", "e9", "e11"],
      },
      {
        constraint: "a wrong down declaration moves 30GB of data for nothing",
        decision: "The failure detector requires k=5 missed rounds and a quorum of peers to agree before declaring a node down",
        lights: ["failure-detector", "e8"],
      },
      {
        constraint: "a write needs exactly one home, but a joining node's cache starts empty",
        decision: "Writes flip to the new owner at the epoch bump while reads dual-read the donor until the hit rate crosses a threshold",
        lights: ["arc-handoff", "warming", "e12", "e15", "e16"],
      },
    ],
    naive: {
      text: "Place keys with a plain hash mod N, so `hash(key) % N` picks a server directly and adding or removing one server just changes N. The moment N changes, that computation changes for nearly every key at once. On a 1000-node cluster serving 10^10 keys, one join or leave would force nearly all of them to move rather than the 1/(N+1) share consistent hashing actually needs. Placing servers as points on the same hashed ring fixes that. Giving each key to its nearest clockwise neighbour confines a membership change to one small arc instead of the whole keyspace.",
      lights: ["ring-search", "arc-handoff"],
    },
    beats: [
      {
        text: "The hot path never leaves the process. A caller hands a key to the ring library, which hashes it with a seeded xxHash and binary-searches a sorted uint32 array of 200k positions. A lookup is ~18 comparisons and ~100ns with no network hop at all.",
        lights: ["caller", "ring-lib", "hasher", "ring-search", "e1", "e2", "e3"],
      },
      {
        text: "Virtual nodes are what make the answer even. One position per server leaves the unluckiest of ten servers owning 2.93 times the average by luck alone. Each physical server instead gets around 200 scattered positions, and the coefficient of variation of owned keyspace falls as 1/sqrt(V) to 7.1%.",
        lights: ["vnode-table", "ring-search", "e4"],
      },
      {
        text: "Replication is the same walk continued. After the primary you keep going clockwise to the next distinct physical hosts, skipping further positions of a host already chosen and optionally same-rack or same-AZ hosts. RF=3 falls out of the structure rather than out of a second placement table.",
        lights: ["replica-walk", "vnode-table", "coordinator", "e4", "e5"],
      },
      {
        text: "Membership is the actual system, and it splits into three jobs people conflate. A failure detector decides, once a majority of peers agree, that a node is down. A small consensus group issues the monotonic epoch. Gossip disseminates the resulting view to 1000 nodes in around ten seconds at 3KB/s per node.",
        lights: ["membership-agent", "failure-detector", "gossip-view", "epoch-issuer", "e7", "e8", "e9"],
      },
      {
        text: "A join moves one small arc per position. The joining node claims 1/(N+1) of the keyspace, roughly 30GB at 1000 nodes, pulled from up to 200 donors. Writes flip at the epoch bump, reads dual-read both owners, and the donor deletes last so an abort costs nothing.",
        lights: ["arc-handoff", "donors", "warming", "e12", "e13", "e14", "e15", "e16"],
      },
      {
        text: "The whole shape is one deliberate asymmetry: expensive on change, free on read. Two round trips of coordination per membership change buys a steady-state lookup with no coordination at all. That only pays because membership changes ten times a day while lookups happen a million times a second per node.",
        lights: ["epoch-issuer", "ring-lib", "e9", "e11"],
      },
    ],
    crux: {
      problem:
        "Membership is eventually consistent while ownership has to be single-valued. A node holding a stale ring will confidently serve from the wrong owner, and nothing in the system notices on its own.",
      handled:
        "The epoch stamped on every request and every ring version is not bookkeeping. It is the only thing converting that silent correctness bug into a detectable refresh: a node that sees a higher epoch than its own must catch up before it answers.",
    },
    numbers: [
      {
        value: "200 positions per server, spread 7.1%",
        explain: "The coefficient of variation of owned keyspace falls as 1/sqrt(V); at V=200 positions per server that is 7.1%, down from 100% at one position each.",
      },
      {
        value: "~100ns lookup over a 3.2MB ring",
        explain: "log2(200,000) is about 18 comparisons, and the whole 200k-entry array fits inside a typical L2 cache, so the binary search never touches main memory.",
      },
      {
        value: "a join moves 1/(N+1), about 0.1% at N=1000",
        explain: "Only the arc between the new position and its clockwise neighbour changes hands; at 1000 nodes that share is roughly 30GB out of 30TB total.",
      },
    ],
  },
  nodes: [
    {
      id: "caller",
      label: "Calling service",
      sub: "get_node(key), get_replicas(key, 3)",
      kind: "service",
      col: 0,
      row: 0,
      detail: {
        what: "Whatever service of ours needs to know where a key lives. It links the ring as a library rather than calling a lookup service.",
        why: "Drawn explicitly because it sets the constraint the rest answers to. This caller runs the lookup a million times a second per node and cannot afford a round trip, so the mapping has to be derivable locally.",
        numbers: [
          { value: "~1M lookups/s/node", explain: "At ~100ns actual cost, this rate uses under 0.01% of a core; that margin is why caching the answer is never worth the staleness risk." },
          { value: "sub-1ms budget, in-process", explain: "The latency ceiling this caller operates under, far too tight for a round trip to a separate service." },
        ],
        breaks: {
          failure: "A caller that caches a resolved owner instead of recomputing it holds a stale answer straight through a membership change.",
          handled: "With no epoch attached to catch it, that stale answer is silently wrong, which is why the library is always called fresh rather than cached by the application.",
        },
        choice: {
          pick: "Call the ring library fresh on every request rather than caching its answer",
          instead: "Resolve once per connection or per batch and reuse the owner list for its lifetime.",
          decider:
            "Cost of a lookup against the cost of a stale one. At ~100ns the library is cheaper than almost anything the caller could do with a cached value, including checking whether the cache is still valid.",
          flips: "A caller issuing millions of lookups against the same key inside one microsecond-scale hot loop, where a single per-loop resolve is safe because no membership change can land mid-loop.",
        },
      },
    },

    // --- the ring library: one linked artefact, three stages ------------------
    {
      id: "ring-lib",
      kind: "serviceGroup",
      col: 1,
      row: 0,
      sub: "in-process: hash → lookup → walk",
      label: "Ring library",
      detail: {
        what: "The whole lookup as one linked artefact: hash the key, binary-search the ring, walk to the replica set. Three stages of one function call, all against local memory.",
        why: "The requirement that shapes everything else is that no lookup consults a coordinator. At a sub-1ms budget and 1M lookups/s/node, a network hop per lookup is not a slower design, it is a different one.",
        numbers: [
          { value: "~100ns end to end", explain: "The full cost of hash, search and walk together, once the ring is resident in local memory." },
          { value: "3.2MB of state per node", explain: "3.2MB x 1000 nodes ≈ 3.2GB fleet-wide to place 30TB of actual data — a thousandth of what it maps, cheap to replicate everywhere." },
          { value: "1M lookups/s/node budgeted", explain: "The throughput this library is designed to sustain per node without any coordination overhead." },
        ],
        breaks: {
          failure: "Everything in here is a cached view of membership, so its correctness is entirely inherited from the epoch check on the way out.",
          handled: "The library itself has no failure mode of its own, since it does no I/O; every real failure mode lives in the membership plane that feeds it.",
        },
        choice: {
          pick: "Link the ring into every caller as a library, rebuilt locally from the membership view",
          instead: "A placement service the caller asks, or a sidecar holding the ring.",
          decider:
            "Cost per lookup. The library answers in ~100ns from L2 at 1M lookups/s/node; the cheapest RPC to a sidecar on the same box is ~50µs, 500x the whole budget.",
          flips: "When the ring has to be updated faster than gossip converges, or when callers are untrusted and cannot be given the membership view at all.",
        },
      },
    },
    {
      id: "hasher",
      label: "Key hash",
      sub: "xxHash, seed pinned in config",
      kind: "process",
      col: 1,
      row: 0,
      parent: "ring-lib",
      detail: {
        what: "Maps a key into the 32-bit position space: `pos = xxhash(key) % RING_SIZE`.",
        why: "Placement has to be a pure function of the key. Every node in the fleet must land on the identical position, or the same key quietly lives in two places. Agreement matters far more here than distribution quality.",
        numbers: [
          { value: "32-bit position space", explain: "2^32 ≈ 4.3B positions hold only 200k actual entries — that sparsity keeps two server vnodes from ever colliding on the same slot." },
          { value: "~500MB/s on short inputs", explain: "The throughput of this hash function, cheap enough to be a rounding error against the search that follows." },
          { value: "one hash per lookup", explain: "The fixed cost every lookup pays here, regardless of key length or ring size." },
        ],
        breaks: {
          failure: "A binary upgrade that changes the function or the seed diverges placement fleet-wide and every read misses.",
          handled: "A node must refuse to boot when its hash signature does not match the cluster's, catching the mismatch before it can silently split the keyspace.",
        },
        choice: {
          pick: "xxHash, non-cryptographic, with the seed pinned in config on every node",
          instead: "A cryptographic digest such as MD5 or SHA-1, truncated to 32 bits.",
          decider:
            "Cost per lookup at 1M lookups/s/node. xxHash runs at ~500MB/s on short inputs, so hashing a 32B key is a few nanoseconds against ~100ns for the binary search that follows.",
          flips: "When key names are attacker-controlled and a deliberate collision storm onto one node is a real threat, where a keyed hash buys that at the cost of the hot path.",
        },
      },
    },
    {
      id: "ring-search",
      label: "Ring lookup",
      sub: "bisect over 200k uint32, ~3.2MB",
      kind: "process",
      col: 1,
      row: 1,
      parent: "ring-lib",
      detail: {
        what: "The binary search over the in-memory ring: positions sorted ascending, looked up with `bisect_left(ring_positions, pos)` wrapped modulo the ring length.",
        why: "The mapping is derived rather than stored, so the entire fleet's placement fits in a few megabytes on every machine. That is what buys a lookup with no network hop and a thousand nodes agreeing without coordinating per request.",
        numbers: [
          { value: "1000 servers x 200 positions = 200k entries", explain: "V=200 gives CoV = 1/sqrt(200) ≈ 7.1%; that's what buys even load, versus V=1's 100% CoV leaving the worst server at 2.93x average." },
          { value: "16B per entry = 3.2MB, sits in L2 (1-4MB)", explain: "The memory footprint of the ring, small enough to avoid a main-memory access on every lookup." },
          { value: "log2(200000) ~ 18 comparisons, ~100ns", explain: "The hash step costs a few nanoseconds by comparison (~500MB/s xxHash); this search is what actually dominates the ~100ns total." },
        ],
        breaks: {
          failure: "The array is a cached view. A node holding a lower epoch than a request it receives must refresh before answering.",
          handled: "Skipping that refresh means it serves from the previous owner and nothing downstream notices, which is why the epoch check is mandatory, not advisory.",
        },
        choice: {
          pick: "A sorted uint32 array in local memory on every node, binary searched",
          instead: "A few thousand fixed partitions with an explicit partition-to-server map published by a control plane.",
          decider:
            "3.2MB of derived state against an availability dependency on the read path. The array answers in ~100ns from L2; the explicit map is smaller but has to be versioned, distributed and consulted.",
          flips: "When you must steer one specific hot range onto dedicated hardware. No hash-derived scheme can express that, and an explicit map is the only option that can.",
        },
      },
    },
    {
      id: "replica-walk",
      label: "Replica walk",
      sub: "next 3 distinct hosts, AZ-aware",
      kind: "process",
      col: 1,
      row: 2,
      parent: "ring-lib",
      detail: {
        what: "Continues clockwise from the primary position to the next N distinct physical hosts, skipping further positions of a host already chosen.",
        why: "Replica selection falls out of the same walk that found the primary. There is no second mechanism and no replica table that can drift out of step with the ring. Failure-domain spread is one extra skip predicate on the same loop.",
        numbers: [
          { value: "RF = 3", explain: "The replication factor this walk produces by simply continuing past the primary position." },
          { value: "1 skip rule: repeat positions of a chosen host", explain: "The single rule that keeps three replicas from being the same physical machine." },
          { value: "optional 2nd skip rule: same-rack or same-AZ", explain: "An additional predicate applied when failure-domain spread matters more than raw distinctness." },
        ],
        breaks: {
          failure: "With 200 random positions a node's replica peers are effectively the entire cluster.",
          handled: "Nearly every 3-node combination is the replica set for some key, so any three simultaneous failures can lose data, an accepted trade of the random-placement scheme.",
        },
        choice: {
          pick: "Derive the replica set by continuing the same clockwise walk to 3 distinct hosts",
          instead: "A separately maintained replica placement table consulted after the primary lookup.",
          decider:
            "How many structures have to agree. Replicas derived from the same walk cannot disagree with the primary; a separate table can, and two structures must then be kept in step across every membership change.",
          flips: "When placement must satisfy constraints the walk cannot express, such as pinning one tenant's replicas to named hosts, which needs an explicit map rather than a rule.",
        },
      },
    },
    {
      id: "vnode-table",
      label: "vnode to physical map",
      sub: "server_id, rack, az, in memory",
      kind: "cache",
      col: 2,
      row: 0,
      detail: {
        what: "The in-memory mapping from each ring position to the physical server behind it, together with that server's rack and availability zone. Derived from the membership view alongside the ring and rebuilt with it.",
        why: "The ring answers which position, not which machine. The replica walk needs physical identity to tell when two positions are the same host, and needs the failure-domain labels to spread the replica set across them.",
        numbers: [
          { value: "~200 vnode ids per physical server", explain: "The scattering that gives each server an even, spread-out share of the keyspace." },
          { value: "200k rows at 1000 servers", explain: "Exactly matches the ring's own 200k entries, carried at no extra memory cost, why physical identity stays free alongside placement." },
          { value: "carried alongside the ring, same ~3.2MB total", explain: "This table's footprint adds essentially nothing on top of the ring itself." },
        ],
        breaks: {
          failure: "Wrong or missing rack and AZ labels let the walk place all three replicas in one failure domain.",
          handled: "Every metric still reports three replicas even though they share a domain, which is why label correctness is validated separately from replica count.",
        },
        choice: {
          pick: "Around 200 randomly placed positions per physical server",
          instead: "Around 16 positions per server, placed by an allocation algorithm that picks each token to minimise the resulting imbalance.",
          decider:
            "Load spread against blast radius. Random placement gives a coefficient of variation of 1/sqrt(V): V=1 is 100% and leaves the worst of ten servers at 2.93x average, V=200 is 7.1%.",
          flips: "When correlated-failure durability matters more than an even spread. Cassandra hit this exact problem at 256 vnodes and cut its default to 16 in 4.0, trading spread for a bounded shared-data set.",
        },
      },
    },
    {
      id: "coordinator",
      label: "Request coordinator",
      sub: "coalescing, per-key QPS counters",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "The caller-side dispatch layer, which stamps each request with the local ring epoch, spreads reads across the replicas, and collapses concurrent misses for one key into a single fetch.",
        why: "The ring distributes keys evenly and does nothing about per-key load, so the only place a hot key can be seen or absorbed is where the requests are issued. This is also where the epoch is attached, turning a stale view into a refresh rather than a wrong answer.",
        numbers: [
          { value: "alert at 100x cluster-median QPS on one key", explain: "The threshold that flags a single key as disproportionately hot against the rest of the fleet." },
          { value: "per-key counters sampled over a ~5s window", explain: "How this layer tracks per-key traffic without adding significant overhead to every request." },
          { value: "1 epoch stamp per outbound request", explain: "The single piece of metadata attached here that makes staleness detectable downstream." },
        ],
        breaks: {
          failure: "Detection lags a viral key's onset, because counters are sampled over a window of seconds.",
          handled: "The first few seconds of a hot key are simply served degraded, an accepted cost of sampling rather than reacting to every single request instantly.",
        },
        choice: {
          pick: "Replicate a hot key beyond RF and coalesce concurrent reads at the coordinator",
          instead: "Splitting the key into `key:0`..`key:9` and recombining in the application.",
          decider:
            "Who can make the change. Extra replication beyond RF=3 plus coalescing fixes hot reads with no application change; it does nothing for a hot write, which fans out to every extra copy.",
          flips: "A single key taking sustained writes rather than reads, where no infrastructure answer exists and the split has to happen in the caller.",
        },
      },
    },

    // --- the storage node: one deployable, three states of one arc -----------
    {
      id: "storage-node",
      kind: "serviceGroup",
      col: 1,
      row: 2,
      sub: "owns arcs; warms, hands off",
      label: "Storage node",
      detail: {
        what: "The physical server the walk resolved to. It does three things with an arc: serve it, take it over during a handoff, and warm up before it is trusted with reads.",
        why: "It is one service because these compete for the same NIC and page cache on the same box. A rebalance is not a separate system, it is the same machine spending its bandwidth on something other than foreground traffic.",
        numbers: [
          { value: "30TB / 1000 nodes = 30GB per node", explain: "The steady-state data footprint each node carries across the whole fleet." },
          { value: "200 arcs per node", explain: "How that data is subdivided per node, matching the number of virtual positions it holds." },
          { value: "~10 membership events/day", explain: "How often this node's arcs are disturbed by a join, leave or rebalance." },
        ],
        breaks: {
          failure: "Rebalance traffic and foreground serving share one machine.",
          handled: "A join anywhere in the fleet shows up as p99 degradation on nodes that are not even joining, since donor bandwidth is shared with live traffic.",
        },
        choice: {
          pick: "One process handling serving, warming and handoff for every arc it owns",
          instead: "A separate migration service on the box that moves bytes while a distinct process serves reads and writes.",
          decider:
            "Whether the two workloads can be paced against each other without a second control loop. Both compete for the same NIC and page cache, so one process can throttle a handoff against live p99 directly.",
          flips: "When migration work is heavy enough to want its own resource limits and its own deploy cadence, independent of the serving code.",
        },
      },
    },
    {
      id: "serve-arcs",
      label: "Serve owned arcs",
      sub: "~30GB across 200 arcs",
      kind: "process",
      col: 1,
      row: 2,
      parent: "storage-node",
      detail: {
        what: "Steady state: the node owns roughly 1/1000 of the keyspace spread across 200 small arcs and serves reads and writes for them, checking the epoch on every inter-node RPC.",
        why: "The ring stores nothing per key, so this is where the bytes are and this is what makes a membership change expensive. 10^10 keys at ~1KB with RF=3 is 30TB, which is 30GB apiece over 1000 nodes.",
        numbers: [
          { value: "30TB / 1000 nodes = 30GB per node", explain: "The data volume each node holds and serves under normal operation." },
          { value: "200 arcs per node", explain: "The granularity of that data, one arc per virtual position." },
          { value: "1 epoch value carried on every inter-node RPC", explain: "The mechanism that lets a node detect when its own view has fallen behind mid-request." },
        ],
        breaks: {
          failure: "A node that never answers a request carrying a higher epoch than its own is correct but unavailable for that instant.",
          handled: "One that does answer is available and wrong instead. The refresh-first rule deliberately picks correctness over availability for that brief window.",
        },
        choice: {
          pick: "~30GB per node across 1000 nodes",
          instead: "Far denser nodes at ~10TB each, with a correspondingly smaller fleet.",
          decider:
            "Rebalance time. At 30GB a join transfers in ~10s, bounded by the recipient's ~3GB/s NIC. The same arithmetic at 10TB per node gives ~1 hour.",
          flips: "When storage cost dominates and membership churn is genuinely rare, where dense nodes are far cheaper per byte and an hour-long rebuild is a price worth paying.",
        },
      },
    },
    {
      id: "warming",
      label: "Warming state",
      sub: "takes writes; reads stay on donor",
      kind: "process",
      col: 1,
      row: 3,
      parent: "storage-node",
      detail: {
        what: "The state a freshly joined or returning node sits in after it claims its arcs. It takes writes immediately, because a write needs exactly one home, while reads keep going to whoever covered for it until its hit rate crosses a threshold.",
        why: "Ownership at the epoch bump and readiness to serve reads are different events, and conflating them is how a correct membership change turns into a visible outage. A node with an empty page cache is the ring's right answer and the wrong machine to read from.",
        numbers: [
          { value: "p99 spike lasts minutes on a cold node", explain: "The realistic duration of degraded latency this state is designed to absorb before it becomes invisible to users." },
          { value: "100% of buffered writes replay before promotion", explain: "The completeness guarantee before this node is allowed to also serve reads." },
          { value: "flap alert above 2 down-up cycles/hour", explain: "The threshold that flags a node oscillating between states rather than settling." },
        ],
        breaks: {
          failure: "A returning node that skips this looks perfectly healthy on every liveness signal.",
          handled: "It serves reads from a cold cache with data stale by however long it was away, which is exactly what this state's read-hold-back is built to prevent.",
        },
        choice: {
          pick: "Split the cutover: writes at the epoch bump, reads only once the hit rate crosses a threshold",
          instead: "Promote the node to full owner at the epoch bump, as a fresh join does.",
          decider:
            "How long the cold cache lasts. A 30GB node reads through its working set in minutes, and p99 for those keys is degraded for all of it; deferring reads costs one extra hop to the donor.",
          flips: "A pure cache with no durability requirement, where a cold node just misses and the miss is already the normal case.",
        },
      },
    },
    {
      id: "arc-handoff",
      label: "Arc handoff",
      sub: "writes flip at epoch, then delete",
      kind: "process",
      col: 1,
      row: 4,
      parent: "storage-node",
      detail: {
        what: "The migration of one arc. Stream the range from the donor, dual-read both owners while it is in flight, cut writes over at the epoch, then let the donor drop its copy.",
        why: "For the duration the arc has two plausible owners. The ordering of the cutover is the only thing deciding whether a crash costs a partial copy or an entire range. Writes need exactly one destination; reads can afford two.",
        numbers: [
          { value: "dual reads cover 1/(N+1), about 0.1% at N=1000", explain: "The tiny fraction of the keyspace ever affected by dual-reading, negligible in aggregate." },
          { value: "a distinct 2nd epoch bump marks the handoff complete", explain: "The separate signal that finally lets the donor delete its copy, kept apart from the write-flip epoch." },
        ],
        breaks: {
          failure: "Reverse the delete ordering and a crash at 90% transferred loses the arc outright.",
          handled: "As built, the rollback is simply deleting a partial copy on a machine that is already dead, so a failed join never costs the range itself.",
        },
        choice: {
          pick: "Writes flip at the epoch bump, reads dual-read until complete, donor deletes last",
          instead: "Cut reads and writes over together at the end, or hand ownership over immediately on join.",
          decider:
            "What a crash mid-transfer costs. With the donor deleting last a failed join is abandoned rather than rolled back, and the doubled reads touch only the 1/(N+1) share under migration.",
          flips: "A pure cache with no durability requirement, where losing an arc is a miss rather than data loss and the simpler single cutover is fine.",
        },
      },
    },
    {
      id: "donors",
      label: "Donor nodes",
      sub: "up to 200 per join, ~150MB each",
      kind: "database",
      col: 0,
      row: 2,
      detail: {
        what: "The existing servers that each cede a handful of small arcs to a joining node. They stream the data behind them, and keep serving reads for those arcs until the handoff completes.",
        why: "With 200 positions per server a join takes tiny slices from nearly the whole fleet instead of half of one neighbour's range. That is exactly why load smooths out, and it is also why pacing a rebuild is a fleet-wide decision rather than a local one.",
        numbers: [
          { value: "~30GB total, ~150MB per donor", explain: "How thinly one join's data volume is spread across the donating fleet." },
          { value: "200 donors x 50MB/s = 10GB/s inbound, 80Gbps", explain: "What a naive per-stream throttle would still allow in aggregate, far past any reasonable NIC." },
          { value: "recipient NIC ~3GB/s is the real limit, ~10s transfer", explain: "The actual constraint that determines how fast a join can complete." },
        ],
        breaks: {
          failure: "Rebalance traffic competes with foreground serving on every donor at once.",
          handled: "A join degrades p99 across the cluster rather than on one pair of machines, which is why concurrency is capped at the recipient rather than left unbounded per donor.",
        },
        choice: {
          pick: "Cap concurrent inbound streams at the recipient",
          instead: "Throttle bytes per donor stream, say 50MB/s each.",
          decider:
            "200 donors at a 50MB/s per-stream throttle is still 10GB/s inbound, well past a 25GbE NIC, so the per-stream number bounds nothing useful. The recipient's NIC at ~3GB/s is the actual constraint.",
          flips: "A low-vnode ring, say 16 positions per node, where a rebuild pulls from 16 peers and the per-stream budget genuinely is the whole budget.",
        },
      },
    },

    // --- membership: detection and dissemination ride the same exchange ------
    {
      id: "membership-agent",
      kind: "serviceGroup",
      col: 2,
      row: 2,
      sub: "on every node: detector + gossip",
      label: "Membership agent",
      detail: {
        what: "The daemon every node runs to keep its view of the fleet current: it watches peer heartbeats and it exchanges the membership view, both over the same 1Hz gossip round.",
        why: "Detection and dissemination are two jobs but one deployable, because a heartbeat and a membership entry travel in the same 1KB exchange with the same three random peers. What is genuinely separate is deciding, which needs one decider and lives in the consensus group next door.",
        numbers: [
          { value: "3 random peers per second", explain: "The fan-out this agent uses each round to keep the fleet's views converging." },
          { value: "~3KB/s per node", explain: "The steady bandwidth cost per node this gossip-plus-heartbeat design settles at." },
          { value: "convergence ~10s at 1000 nodes", explain: "How long a new fact takes to reach the whole fleet through this exchange." },
        ],
        breaks: {
          failure: "Partitioned from its peers but still reachable by clients, the agent stops learning and the node serves confidently from a stale ring.",
          handled: "The guard is refusing to serve when the last successful exchange is older than 30s, converting silent staleness into a visible refusal.",
        },
        choice: {
          pick: "One daemon carrying both heartbeats and membership view in the same gossip round",
          instead: "A dedicated heartbeat process separate from a dedicated gossip process on each node.",
          decider:
            "Whether the two facts belong in one packet. A heartbeat and a membership entry both change at the same cadence and are read by the same peers. Splitting them doubles the 3KB/s per node for no new information.",
          flips: "When liveness needs a tighter interval than membership dissemination does, for example sub-second failure detection against a multi-second gossip fan-out.",
        },
      },
    },
    {
      id: "failure-detector",
      label: "Failure detector",
      sub: "phi-accrual, k=5 rounds + quorum",
      kind: "process",
      col: 2,
      row: 2,
      parent: "membership-agent",
      detail: {
        what: "Watches peer heartbeats and maintains a suspicion level per node, escalating to a down declaration only once a quorum of peers agrees.",
        why: "A missed heartbeat is one node's opinion. Acting on it unilaterally is how a brief network blip turns into terabytes of pointless migration. Declaring a node down is therefore a decision with a quorum behind it, not an observation.",
        numbers: [
          { value: "k=5 consecutive missed rounds at 1Hz = 5s floor", explain: "The minimum time before any single peer even suspects a failure, filtering out momentary blips." },
          { value: "~2 failures/day at 1000 nodes with ~500-day MTBF", explain: "The realistic failure rate this detector is tuned against at fleet scale." },
          { value: "~10 membership events/day in total", explain: "The combined rate of all membership changes, failures and joins alike." },
        ],
        breaks: {
          failure: "Tuned too tight it flaps, and the same arc migrates away and back.",
          handled: "Hysteresis before a returned node is promoted is what stops the oscillation, requiring sustained health rather than a single good heartbeat.",
        },
        choice: {
          pick: "Phi-accrual suspicion, plus k=5 missed rounds and quorum agreement before acting",
          instead: "A fixed heartbeat timeout, acted on by whichever node noticed first.",
          decider:
            "The cost of a false positive. A wrong down declaration moves 30GB for nothing, so a 5s floor plus quorum is cheap insurance, and phi-accrual additionally raises the bar on links that are habitually slow.",
          flips: "Small clusters that already run a coordination service on the path, where its session timeout is the failure detector and there is nothing to build.",
        },
      },
    },
    {
      id: "gossip-view",
      label: "Gossip: membership view",
      sub: "3 random peers/s, epoch tagged",
      kind: "process",
      col: 2,
      row: 3,
      parent: "membership-agent",
      detail: {
        what: "The `(epoch, [node_id, state, positions, heartbeat])` view every node holds, exchanged with a few random peers every second and applied only when the epoch is higher than the local one.",
        why: "The ring is a pure function of this view, so agreeing on the view is the entire remaining problem. Gossip is chosen for the dissemination half because it has no central fan-out point and degrades gracefully under churn.",
        numbers: [
          { value: "3 random peers per second per node", explain: "The exchange rate underlying this gossip protocol's fan-out." },
          { value: "~1KB per round x 3 = 3KB/s per node", explain: "The bandwidth cost this convergence mechanism settles at per node." },
          { value: "convergence ~10s at 1000 nodes", explain: "How quickly a change reaches the entire fleet under this fan-out pattern." },
        ],
        breaks: {
          failure: "Gossip delivers views out of order, so applying the most recent exchange rather than the highest epoch rolls ownership backwards.",
          handled: "Comparing by epoch rather than by recency of arrival is what prevents that regression from ever reintroducing the stale-owner bug.",
        },
        choice: {
          pick: "Gossip: 3 random peers every second, epoch attached to every exchange",
          instead: "Every node watching a coordination service for the membership record.",
          decider:
            "Fan-out cost. Gossip is 3KB/s per node and converges in ~10s at 1000 nodes with no central watcher; a coordination service has to push each change to 1000 watchers directly.",
          flips: "A few hundred nodes or fewer, where linearizable membership removes the eventual-consistency window that gossip creates and the epoch machinery gets much simpler.",
        },
      },
    },
    {
      id: "epoch-issuer",
      label: "Epoch issuer",
      sub: "consensus group or leaseholder",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "A small consensus group, or a designated coordinator holding a lease from one, that issues the monotonic epoch stamped on every ring version.",
        why: "Gossip converges a fleet on facts but cannot make a decision: two nodes can decide S2 is dead differently and both will happily spread their version. Ordering membership changes needs exactly one decider, and this is the only thing left on the path that needs consensus.",
        numbers: [
          { value: "~10 epoch increments/day", explain: "The typical daily rate this decider actually has to act." },
          { value: "two round trips of coordination per membership change", explain: "The fixed cost this consensus step pays, in exchange for eliminating coordination from every lookup." },
          { value: "1 epoch value carried on every inter-node RPC", explain: "The single output of this component that flows into every other part of the system." },
        ],
        breaks: {
          failure: "Lose quorum and the epoch stops advancing.",
          handled: "Steady-state lookups keep working from the last ring, but every topology change has to be refused until quorum returns, an availability trade that protects correctness.",
        },
        choice: {
          pick: "Epoch increments from a small consensus group, with gossip doing the dissemination",
          instead: "A coordination service that holds the full membership and is watched directly by every node.",
          decider:
            "Cluster size. Linearizable membership from a coordination service is worth a lot below a few hundred nodes, but the watcher count becomes the bottleneck at fleet scale.",
          flips: "Below a few hundred nodes, where putting the whole membership in the coordination service is simpler and removes the stale-view window entirely.",
        },
      },
    },
    {
      id: "snapshots",
      label: "Ring snapshots",
      sub: "hourly, object storage",
      kind: "blob",
      col: 2,
      row: 3,
      detail: {
        what: "Hourly snapshots of the ring plus membership state at the epoch that produced them, written to object storage for audit.",
        why: "Ownership is computed rather than recorded, so after the fact nothing in the system knows who owned a key yesterday. Every wrong-replica investigation starts with that question, and it cannot be answered from a structure that holds no history.",
        numbers: [
          { value: "~5MB per snapshot", explain: "Larger than the live ~3.2MB ring+vnode state it captures, since a snapshot also carries membership metadata the hot structures don't keep." },
          { value: "5MB x 8760 = ~44GB/yr", explain: "The total annual storage this audit trail costs, negligible against the system's other volumes." },
          { value: "1 snapshot per hour", explain: "The cadence this trail is captured at, a deliberate coarser grain than the epoch changes themselves." },
        ],
        breaks: {
          failure: "Hourly granularity misses changes between snapshots, so a short-lived flap leaves no trace of the ownership it briefly caused.",
          handled: "Nothing depends on the snapshot either, so nothing notices when it stops, which is why its own freshness is checked separately rather than assumed.",
        },
        choice: {
          pick: "Hourly snapshots of ring and membership state to object storage",
          instead: "Retaining the full epoch history inside the consensus group.",
          decider:
            "44GB/yr in object storage costs nothing and sits off the serving path, whereas keeping full ring state in a consensus store grows the thing every membership change depends on.",
          flips: "When you need per-change rather than per-hour granularity, where an append-only log of epoch deltas is the right structure and hourly snapshots are the wrong one.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "caller",
      to: "hasher",
      tier: "hot",
      step: 1,
      label: "get(key)",
      detail: {
        what: "A key arriving at the ring library, in process, as a function call rather than an RPC.",
        why: "The entire design is shaped to keep this a function call. Anything that consults a coordinator per request blows a sub-1ms budget at a million lookups a second per node.",
        numbers: [{ value: "~1M lookups/s/node", explain: "1M/s x ~100ns end to end ≈ 0.1ms of CPU per node per second — negligible, why no lookup is ever allowed to leave the process." }],
        breaks: {
          failure: "A caller that caches the resolved owner rather than recomputing it carries a stale answer past a membership change.",
          handled: "With no epoch attached to catch it, that answer stays silently wrong, which is why every call re-enters this hop rather than reusing a prior result.",
        },
      },
    },
    {
      id: "e2",
      from: "hasher",
      to: "ring-search",
      tier: "hot",
      step: 2,
      label: "pos = xxhash(key) % 2^32",
      detail: {
        what: "The 32-bit position the key hashes to, handed to the ring for a binary search.",
        why: "Keys and servers live in the same space, and that is the whole trick. Ownership becomes a property of a key's nearest neighbour, rather than of the fleet size, the global quantity modulo hashing depends on.",
        numbers: [
          { value: "32-bit space", explain: "The coordinate range both keys and server positions are hashed into." },
          { value: "~5ns per short-key hash", explain: "The typical cost of this hop's hash computation, negligible against the search that follows." },
        ],
        breaks: {
          failure: "Two nodes computing this with different seeds land on different positions for the same key.",
          handled: "The cluster silently splits its keyspace with no error anywhere, which is why the seed is pinned in config and checked at boot rather than left to drift.",
        },
      },
    },
    {
      id: "e3",
      from: "ring-search",
      to: "replica-walk",
      tier: "hot",
      step: 3,
      label: "first vnode clockwise",
      detail: {
        what: "The binary search result: the index of the first ring position at or above the key's position, wrapped modulo the ring length.",
        why: "This is the local property that replaces `% N`. The answer depends only on the nearest position clockwise, so a membership change elsewhere on the circle cannot change it. That is why a join moves 1/(N+1) of keys instead of all of them.",
        numbers: [
          { value: "~18 comparisons over 200k entries", explain: "log2(200k) ≈ 17.6, rounds to 18; scaling is logarithmic, so a 10x larger cluster costs ~3-4 more comparisons, not 10x more time." },
          { value: "~100ns on an L2 hit", explain: "The realistic latency of this whole lookup step once the ring is resident in cache." },
        ],
        breaks: {
          failure: "The wrap at the top of the ring is the classic off-by-one.",
          handled: "Miss it and every key hashing above the highest position has no owner at all, which is why the wraparound case is specifically tested rather than assumed correct.",
        },
      },
    },
    {
      id: "e4",
      from: "replica-walk",
      to: "vnode-table",
      tier: "control",
      label: "vnode to host, rack, az",
      detail: {
        what: "Resolving each position on the walk to the physical server behind it, along with its failure-domain labels.",
        why: "The walk has to know when two positions are the same machine. Without that, taking the next three positions can quietly return one host three times, and RF=3 becomes RF=1 with nothing reporting it.",
        numbers: [
          { value: "200 positions per host", explain: "The scattering this table encodes for every physical server." },
          { value: "RF = 3 distinct hosts", explain: "The replication factor this resolution step guarantees, distinct machines rather than distinct positions." },
        ],
        breaks: {
          failure: "Stale or missing rack and AZ labels put all three replicas in one domain.",
          handled: "The cluster still believes it is spread across three domains, which is why label correctness is checked as its own health signal rather than inferred from replica count.",
        },
      },
    },
    {
      id: "e5",
      from: "replica-walk",
      to: "coordinator",
      tier: "hot",
      step: 4,
      label: "primary + 2 replicas",
      detail: {
        what: "The ordered replica list handed back to the caller's dispatch layer.",
        why: "The ring's entire output is an ordered list of nodes: it holds no state, does no I/O and has no failure mode of its own. Everything about which of those nodes has the current value is the next question, not this one.",
        numbers: [
          { value: "RF = 3", explain: "This exact list lets the coordinator spread reads across 3 candidates and fail over between them, rather than being pinned to one node." },
          { value: "~100ns to produce the list", explain: "Cheaper than the cost of checking whether a cached list is still valid, why the coordinator recomputes it fresh on every request." },
        ],
        breaks: {
          failure: "A caller that treats the list as stable rather than recomputing it per request pins itself to an owner the ring has already moved on from.",
          handled: "That is exactly why the coordinator recomputes fresh on every request instead of caching this list, since a ~100ns recompute is cheaper than validating a cached one.",
        },
      },
    },
    {
      id: "e6",
      from: "coordinator",
      to: "serve-arcs",
      tier: "hot",
      step: 5,
      label: "epoch-stamped read/write",
      detail: {
        what: "The request itself, sent to the primary with the caller's ring epoch attached, with reads spread across the replica set and duplicate concurrent misses collapsed into one fetch.",
        why: "The epoch on the wire is what makes an eventually consistent membership plane safe to build on. It turns 'this node has a stale ring' from a silent wrong answer into a detectable refresh.",
        numbers: [
          { value: "RF = 3", explain: "Sets the fan-out for read spreading and for collapsing concurrent misses on one key into a single fetch, both scoped to these 3 nodes." },
          { value: "1 epoch value on every inter-node RPC", explain: "The single field that carries the staleness check on this hop." },
          { value: "alert at 100x median QPS on one key", explain: "The threshold that flags an individual key as disproportionately hot on this path." },
        ],
        breaks: {
          failure: "A node receiving a request that carries an epoch higher than its own must refresh before answering.",
          handled: "Skip that and a stale view becomes a wrong answer instead of a latency blip, which is why the refresh-before-answer rule is enforced in the serving code itself.",
        },
      },
    },
    {
      id: "e7",
      from: "serve-arcs",
      to: "failure-detector",
      tier: "control",
      label: "heartbeat + epoch, 1Hz",
      detail: {
        what: "Heartbeats and the sender's current epoch, exchanged with three random peers every second.",
        why: "Liveness is measured by peers rather than reported to a central watcher, the same reason membership is gossiped. There is no fan-out point, and the per-node cost stays flat as the fleet grows.",
        numbers: [
          { value: "3 peers/s", explain: "The exchange rate this heartbeat mechanism uses per node." },
          { value: "~3KB/s per node", explain: "The bandwidth cost of this liveness check, shared with the membership gossip it rides alongside." },
          { value: "epoch skew alerts above 3", explain: "The threshold at which a node's epoch falling behind its peers is flagged as an issue." },
        ],
        breaks: {
          failure: "A heartbeat proves the process is up, not that its data is current.",
          handled: "A node that flapped and returned looks perfectly healthy while serving reads from a cold, stale copy, which the warming state exists specifically to catch.",
        },
      },
    },
    {
      id: "e8",
      from: "failure-detector",
      to: "epoch-issuer",
      tier: "control",
      label: "down, with quorum",
      detail: {
        what: "An escalation: enough peers agree a node has missed k consecutive rounds, so a membership change is proposed.",
        why: "Detection and decision are deliberately separate. Gossip can spread the fact that a node looks unreachable, but only one place is allowed to turn that into the statement that its arcs are reassigned.",
        numbers: [
          { value: "k=5 missed rounds at 1Hz", explain: "The minimum evidence required before any escalation is even proposed." },
          { value: "quorum: over 50% of peers must agree", explain: "The threshold that keeps one node's bad link from unilaterally reassigning a healthy peer's data." },
        ],
        breaks: {
          failure: "Without the quorum step, one node with a failing NIC reassigns a healthy peer's arcs and moves 30GB for nothing.",
          handled: "It then moves it back when the link recovers, wasted work the quorum requirement exists entirely to prevent.",
        },
      },
    },
    {
      id: "e9",
      from: "epoch-issuer",
      to: "gossip-view",
      tier: "control",
      label: "epoch++, new node state",
      detail: {
        what: "The decided membership change, published as a new `(epoch, membership)` pair for gossip to spread.",
        why: "This is the handover from consensus to dissemination. Consensus decides once, about ten times a day, and gossip does the fan-out to a thousand nodes that a consensus group would be a poor tool for.",
        numbers: [
          { value: "~10 changes/day", explain: "Below the snapshot's 24/day cadence — most hourly snapshots capture no real change, existing only to cover the rare one that does." },
          { value: "converged across 1000 nodes in ~10s", explain: "How quickly the change this hop publishes reaches the whole fleet." },
        ],
        breaks: {
          failure: "Gossip can deliver views out of order.",
          handled: "A node has to compare epochs rather than trust the most recent exchange it happened to have, which is what keeps out-of-order delivery from corrupting ownership.",
        },
      },
    },
    {
      id: "e10",
      from: "epoch-issuer",
      to: "snapshots",
      tier: "control",
      label: "hourly, ~5MB",
      offset: 60,
      detail: {
        what: "The ring and membership state at the current epoch, written out to object storage once an hour.",
        why: "Ownership is computed, not recorded, so without this there is no way to answer who owned key K on date D, which is where every stale-read investigation starts.",
        numbers: [
          { value: "~5MB per snapshot", explain: "Written on a fixed hourly clock, not on change — most of these 24 daily writes capture a ring identical to the one before it." },
          { value: "~44GB/yr", explain: "5MB x 24/day x 365 ≈ 44GB; against the 30TB this ring places, the audit trail costs roughly a millionth of the data it describes." },
        ],
        breaks: {
          failure: "The snapshot is a by-product nothing depends on, so nothing notices when it stops.",
          handled: "The first symptom is an investigation with no history to read, which is why snapshot freshness is checked as its own signal rather than assumed to just work.",
        },
      },
    },
    {
      id: "e11",
      from: "gossip-view",
      to: "ring-search",
      tier: "control",
      label: "(epoch, positions)",
      offset: 20,
      detail: {
        what: "A converged membership view being applied: positions recomputed and the local ring and vnode map rebuilt with the new epoch stamped on them.",
        why: "The ring is derived, never authored, so this is the only way it ever changes. Keeping the derivation local is what lets a thousand nodes agree on placement without any of them talking to each other at lookup time.",
        numbers: [
          { value: "~10 rebuilds/day", explain: "How often this local rebuild happens, matching the daily membership change rate." },
          { value: "200k entries rebuilt from the view", explain: "Even though a join changes only ~0.1% of positions (1/(N+1) at N=1000), this rebuild regenerates the full 200k-entry array, not just the delta." },
        ],
        breaks: {
          failure: "Applying a view without comparing epochs, or applying an older one out of order, silently rolls ownership backwards.",
          handled: "Comparing strictly by epoch is what reintroduces safety here, refusing any view that is not newer than the current one.",
        },
      },
    },
    {
      id: "e12",
      from: "gossip-view",
      to: "arc-handoff",
      tier: "control",
      label: "epoch bump: writes flip",
      offset: 20,
      detail: {
        what: "The new epoch reaching the node that is taking the arc, which is the instant the new owner becomes the single destination for writes to it.",
        why: "A write must have exactly one home, so ownership flips at a named epoch rather than drifting across the fleet as gossip converges. Reads are the side that can tolerate two answers, and they do, by dual-reading until the transfer completes.",
        numbers: [
          { value: "one bump to flip writes, a second to mark the handoff done", explain: "The two-stage epoch mechanism that separates write ownership from read readiness." },
          { value: "~10s convergence at 1000 nodes", explain: "How quickly this write-flip reaches every node that needs to respect it." },
        ],
        breaks: {
          failure: "Flip too early and the arc takes writes into a node holding none of its prior contents.",
          handled: "Flip too late and two nodes both believe they own the write, so the epoch bump is placed precisely at the point ownership is actually ready to be exclusive.",
        },
      },
    },
    {
      id: "e13",
      from: "arc-handoff",
      to: "donors",
      tier: "data",
      label: "pull arc ranges",
      detail: {
        what: "Requests to each donor for the specific contiguous key ranges it is ceding, staged arc by arc so the transfer can be paused.",
        why: "Streaming a contiguous range is the reason this is a ring at all. Rendezvous hashing gives the same minimal-disruption property with better balance, and gives you no contiguous range to hand off, repair or reason about.",
        numbers: [
          { value: "up to 200 donors per join", explain: "How many machines contribute a small slice each, rather than one neighbour giving up half its range." },
          { value: "~150MB per donor", explain: "The typical size of one donor's contribution to a single join." },
          { value: "claims 1/(N+1) of the keyspace", explain: "The total share this whole transfer moves, regardless of how many donors it is spread across." },
        ],
        breaks: {
          failure: "Rebalance reads compete with foreground serving on the donors.",
          handled: "With 200 positions per node that pressure lands on the whole cluster rather than one neighbour, which is why inbound concurrency is capped at the recipient.",
        },
      },
    },
    {
      id: "e14",
      from: "donors",
      to: "arc-handoff",
      tier: "data",
      label: "~30GB streamed",
      offset: 60,
      detail: {
        what: "The actual bytes, plus the ordering that makes a join abortable: the donor drops its copy only after the recipient acknowledges the arc and the epoch marks the handoff complete.",
        why: "For the duration the arc has two plausible owners, and the delete ordering is the only thing separating an abandoned migration from a lost range. Reverse it and a crash at 90% transferred costs data.",
        numbers: [
          { value: "~10s at a ~3GB/s recipient NIC", explain: "The realistic time this transfer takes at the throughput the recipient can actually sustain." },
          { value: "~1 hour at 10TB per node", explain: "How much longer the same transfer would take under a denser-node design, illustrating the trade behind node sizing." },
        ],
        breaks: {
          failure: "200 donors at 50MB/s is 10GB/s inbound, so the recipient's NIC saturates.",
          handled: "Foreground p99 climbs unless inbound concurrency is capped at the recipient rather than per stream, which is the guard actually enforced here.",
        },
      },
    },
    {
      id: "e15",
      from: "arc-handoff",
      to: "warming",
      tier: "data",
      label: "arc claimed, cache cold",
      offset: 60,
      detail: {
        what: "The transition once the arc is claimed: the node is the ring's answer for those keys and takes their writes, with an empty page cache behind it.",
        why: "The epoch bump is a statement about ownership, not about readiness. Treating it as both is how a correct, well-paced membership change shows up as minutes of degraded p99 on the keys that just moved.",
        numbers: [
          { value: "p99 degraded for minutes on a cold node", explain: "The realistic duration this transition's cost is contained to." },
          { value: "100% of buffered writes replay first", explain: "The completeness requirement before this node moves past the warming state." },
        ],
        breaks: {
          failure: "A returning node that skips this and serves reads immediately answers from data stale by however long it was away.",
          handled: "Every liveness signal says it is fine even though the data is not, which is exactly the gap this warming transition is built to close.",
        },
      },
    },
    {
      id: "e16",
      from: "warming",
      to: "serve-arcs",
      tier: "data",
      label: "hit rate over threshold",
      detail: {
        what: "Promotion to full owner: reads stop routing to the donor and start landing on the new owner.",
        why: "The threshold is a cache hit rate rather than a timer, because the thing being waited on is a warm working set. How long that takes depends on the traffic the arc actually gets.",
        numbers: [
          { value: "reads move only once hit rate exceeds ~90%", explain: "The specific threshold this promotion is gated on, tuned to catch a genuinely warm cache." },
          { value: "a distinct 2nd epoch bump marks the handoff done", explain: "The signal that formally closes out the migration once promotion completes." },
        ],
        breaks: {
          failure: "Promote on a timer instead and a quiet arc gets promoted cold.",
          handled: "That produces the same p99 spike the warming state exists to avoid, which is why hit rate, not elapsed time, is the actual gate.",
        },
      },
    },
  ],
};
