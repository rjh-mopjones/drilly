import type { Diagram } from "./types";

export const MESSAGE_QUEUE: Diagram = {
  id: "message-queue",
  title: "Message Queue",
  question: "Design a Distributed Message Queue (Kafka)",
  sourceId: "patterns",
  itemId: 16,
  overview: {
    shape:
      "This is a partitioned, replicated, append-only log, not a mailbox: writes go to the end of a file, nothing is removed when it is read, and each reader carries its own position.",
    beats: [
      "Everything starts with the partition. A topic splits into partitions, the producer hashes the message key to pick one, and that single function decides both what is ordered relative to what and which broker holds the bytes. Partition count is the ceiling on consumer parallelism and it is close to irreversible.",
      "The write path is one leader and two followers. The leader appends the batch to the tail of the active segment, assigns offsets, and the followers replicate by issuing the same FetchRequest a consumer issues, so there is no separate replication wire. The high watermark advances to the minimum log-end-offset across the in-sync set, and that advance is what releases an acks=all producer.",
      "Committed means present in the page cache of every in-sync replica, not on any disk. Kafka does not fsync per batch; durability is replication. That makes rack-aware placement matter more than the ack setting, because three replicas behind one power distribution unit is one failure domain rather than three.",
      "Throughput is hardware rather than cleverness. Records are never updated in place so the disk head never seeks, the kernel page cache holds recent segments with no cache the broker had to write, and sendfile pipes log bytes straight to the socket without touching the JVM heap. Roughly 1GB/s per broker on NVMe.",
      "Consumers pull and own their read position. The broker keeps one committed offset per group per partition and nothing else, which is why the twentieth consumer group costs a sequential read that mostly hits RAM, and why replay is committing a lower number rather than a feature. Those offsets live in an internal Kafka topic, so they replicate and fail over exactly like data.",
      "Retention runs off a clock or a size, never off consumption. Seven days at 3GB/s is 5.5PB with replication, which is 92TB a broker, so closed segments go to object storage and only the recent working set stays on local NVMe.",
    ],
    crux:
      "Ordering only holds inside a partition, so the partition key is the most consequential choice a producer ever makes. Pick it too coarse and one tenant saturates a partition nobody can split; pick it too fine and the ordering the design was sold on was never there. Changing your mind means changing hash(key) % count, which reorders history once, silently, with nothing in the data recording it.",
    numbers: [
      "3GB/s average, 10GB/s peak ingress",
      "30GB/s of disk write at RF=3, so 60 brokers",
      "p99 produce ack ~10ms with acks=all",
    ],
  },
  nodes: [
    {
      id: "cluster",
      label: "Kafka cluster",
      sub: "60 brokers, RF=3, 20 per rack across 3 racks",
      kind: "group",
      x: 16,
      y: 196,
      w: 328,
      h: 254,
      detail: {
        what: "The broker fleet holding every partition's log, sized by disk write rather than by ingress.",
        why: "Replication factor 3 means every byte is written once by the leader and once by each follower, so 10GB/s of peak ingress is 30GB/s of cluster-wide disk write. Skipping that multiplier is how people arrive at a cluster a third the size it needs to be.",
        numbers: [
          "30GB/s peak disk write / 0.5GB/s usable per broker = 60 brokers",
          "20 brokers per rack across 3 racks",
          "~4k partitions per broker, 240k cluster ceiling",
        ],
        breaks:
          "Rack placement is the durability boundary. Two replicas of one partition in the same rack means a rack loss can take the in-sync set below min.insync.replicas and stop writes.",
      },
    },
    {
      id: "producers",
      label: "Producer clients",
      sub: "batch 16KB / linger.ms=5, acks=all",
      kind: "compute",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "Application services accumulating records into per-partition batches and sending each batch to that partition's leader as one ProduceRequest.",
        why: "Batching is what turns millions of tiny records into a few large sequential appends, and it is the setting that trades latency for throughput on the client side rather than in the broker. The ack level chosen here is the only place durability is actually purchased.",
        numbers: [
          "batch.size 16KB, linger.ms=5",
          "3M msg/s average, 10M peak, mean 1KB",
          "p99 produce ack ~10ms",
        ],
        breaks:
          "An acknowledgement lost on the way back makes the producer resend a batch the broker already has, so retries create duplicates unless idempotence is on.",
        choice: {
          pick: "acks=all with min.insync.replicas=2, enable.idempotence=true",
          instead: "acks=1, or acks=0 fire and forget.",
          decider:
            "acks=1 is roughly 2x the throughput and drops the last batch on every leader crash, with no error, no metric and no way to reconstruct the gap. acks=all costs a p99 of about 10ms and loses nothing while 2 of 3 replicas hold the bytes. Idempotence has been the default since Kafka 3.0 and its cost is negligible.",
          flips:
            "Telemetry, clickstream and application logs, where a batch lost on a leader crash is cheaper than the latency and nobody reconciles the totals later.",
        },
      },
    },
    {
      id: "partitioner",
      label: "Partition router",
      sub: "hash(key) % partition count",
      kind: "compute",
      x: 40,
      y: 100,
      w: 280,
      detail: {
        what: "The producer-side function mapping a message key to exactly one partition, which fixes both its ordering group and the broker that will hold it.",
        why: "A partition is the unit of ordering and of parallelism at the same time, so this one line decides three things at once: that every event for user_42 lands in one log in send order, that events for different keys have no relative order at all, and that consumer parallelism can never exceed the partition count.",
        numbers: [
          "~50k partitions in use against a 240k ceiling",
          "3 consumers on 6 partitions get 2 each",
          "pre-provision 50-100 partitions on important topics",
        ],
        breaks:
          "One key carrying 10% of a topic's traffic saturates its partition while the siblings idle, and partitions are indivisible, so there is no version of this where you split the hot one.",
        choice: {
          pick: "hash the message key, and over-provision partitions at 50 to 100",
          instead:
            "Round-robin with no key, or a static key-to-partition routing table decoupling the mapping from the count.",
          decider:
            "Partition count is a one-way door. Adding partitions changes hash(key) % count, so a key that lived on partition 7 for a year starts landing on 23 and per-key ordering breaks exactly once, silently. Over-provisioning is cheap against a 240k cluster ceiling; the routing table is a consensus problem every producer in the company must agree on.",
          flips:
            "When nothing needs per-key ordering. Round-robin spreads perfectly across all 50 partitions and removes the hot-partition failure outright, which is the right call for logs and telemetry.",
        },
      },
    },
    {
      id: "leader",
      label: "Partition leader",
      sub: "appends, assigns offsets, holds the high watermark",
      kind: "bus",
      x: 40,
      y: 230,
      w: 280,
      detail: {
        what: "The single broker that accepts every read and write for a partition, appends batches to the tail of the active segment, assigns each record an offset and tracks the high watermark.",
        why: "One writer per partition is what makes an offset mean anything: it is a position in one file, so two writers would produce two orderings and the sequence number would stop being a sequence. It also turns commitment into a local minimum over two followers rather than agreement per record.",
        numbers: [
          "500MB/s of write per broker at peak",
          "high watermark = min log-end-offset across the ISR",
          "consumers may not read past the high watermark",
        ],
        breaks:
          "The append lands in the page cache, not on a platter. Kafka does not fsync per batch, so an acknowledged record exists only in the memory of three machines until the kernel gets round to it.",
        choice: {
          pick: "One elected leader per partition, all reads and writes through it",
          instead: "Leaderless quorum writes, or serving reads from any replica.",
          decider:
            "The offset only exists because there is one appender. With 3 replicas, a single leader makes the commit condition a minimum over 2 follower positions, computed locally, rather than a per-record agreement round. Reads through the leader also guarantee a consumer never sees a record that later gets truncated.",
          flips:
            "Cross-rack read cost. Follower fetching lets a consumer read the nearest replica and cuts cross-AZ egress, at the price of reading behind the leader's watermark.",
        },
      },
    },
    {
      id: "isr",
      label: "In-sync replica set",
      sub: "2 followers, min.insync.replicas=2",
      kind: "compute",
      x: 40,
      y: 350,
      w: 280,
      detail: {
        what: "The followers that have fetched within replica.lag.time.max.ms, and therefore the set the high watermark waits for and the set a new leader is elected from.",
        why: "Durability here is replication rather than flush, so membership of this set is the guarantee itself. It is also a durability knob wearing an availability costume: shrink the set and writes get faster and less safe, with no other visible change.",
        numbers: [
          "replica.lag.time.max.ms 30s",
          "RF=3 survives one broker loss with nothing lost",
          "ISR shrink-and-recover within 60s as an SLO",
        ],
        breaks:
          "Fall below min.insync.replicas and the leader refuses writes with NotEnoughReplicas. That outage is the durability guarantee working, and lowering the setting to 1 to clear the alert converts a loud incident into an invisible data-loss window.",
        choice: {
          pick: "RF=3, min.insync.replicas=2, rack-aware placement, unclean election off",
          instead: "Replicas in one rack, or fsync per batch, or unclean leader election on.",
          decider:
            "Correlated failure, because nothing has fsynced when the producer's call returns. Three replicas behind one power distribution unit is one failure domain, not three. broker.rack across 3 racks costs cross-AZ traffic on every produce; forcing fsync per batch costs roughly an order of magnitude of throughput.",
          flips:
            "Single-rack deployments where cross-AZ egress dominates the bill and the topic is reconstructible from an upstream source, so the correlated case is an inconvenience rather than a loss.",
        },
      },
    },
    {
      id: "segments",
      label: "Segment files",
      sub: "append-only on NVMe + sparse index",
      kind: "store",
      x: 440,
      y: 230,
      w: 240,
      detail: {
        what: "The partition as it exists on disk: fixed-size segment files written strictly at the tail, plus a sparse index mapping every few kilobytes of log to a byte position.",
        why: "Records are never updated in place, so the head never seeks and every write is a sequential append, which is among the fastest I/O patterns available because the hardware can predict the next sector. There is no cleverness above this; the throughput number is the disk.",
        numbers: [
          "~1GB/s per broker on NVMe, budget 0.5GB/s usable",
          "1GB segment files, oldest deleted by retention",
          "index and time-index add ~1% on top of the log",
        ],
        breaks:
          "Segment appends, replica catch-up fetches and consumer reads all hit the same devices, and at 500MB/s of write per broker there is not much slack. Throttling a rebuilding replica to protect latency can hold it out of the ISR and stop writes.",
        choice: {
          pick: "Segmented append-only files with a sparse offset index",
          instead: "A B-tree or any record-addressable store.",
          decider:
            "The access pattern has no random component: every write is at the tail and every read is a scan from an offset. An index supporting random update buys nothing and costs a seek per record, which caps a device at thousands of operations per second rather than the ~1GB/s a sequential append sustains. A sparse index at a few KB granularity also stays memory-resident over 6.5TB of local log.",
          flips:
            "When a single record has to be read or mutated by id. At that point this is a database and the log is the wrong shape entirely.",
        },
      },
    },
    {
      id: "pagecache",
      label: "Page cache + sendfile",
      sub: "zero-copy file to socket",
      kind: "store",
      x: 440,
      y: 340,
      w: 240,
      detail: {
        what: "The kernel's buffer over the log files, plus the sendfile() syscall that pipes segment bytes directly from the file to the network socket.",
        why: "Consumers mostly read what was just written, so the hot segments are already in RAM without the broker maintaining a cache of its own. Zero copy then keeps those bytes out of the JVM heap, which is why fan-out to another consumer group costs one sequential read rather than a copy per subscriber.",
        numbers: [
          "read egress ~150MB/s per broker at 3 consumer groups",
          "9GB/s cluster read against 3GB/s ingress",
          "local read <1ms",
        ],
        breaks:
          "A consumer that lags out of the cached window turns a RAM read into a disk read, and that catch-up competes with replica fetches for exactly the same devices.",
        choice: {
          pick: "OS page cache with sendfile zero-copy",
          instead: "An application-level cache on the JVM heap.",
          decider:
            "Duplication and garbage collection. A heap cache holds a second copy of bytes the kernel already has, puts tens of GB under a collector, and still cannot reach a socket without a copy. sendfile ships a segment to the wire without it entering the heap at all, which is one of the three tricks behind 1GB/s per broker.",
          flips:
            "When records must be transformed or filtered per consumer, since sendfile can only ship bytes exactly as they were stored.",
        },
      },
    },
    {
      id: "tiered",
      label: "Retention + tiering",
      sub: "time or size, closed segments to object store",
      kind: "store",
      x: 440,
      y: 450,
      w: 240,
      detail: {
        what: "The retention policy that deletes segments on a clock or a size bound, and the KIP-405 uploader that moves closed segments to object storage before that point.",
        why: "Retention is never by consumption, which is the property replay is built on: the broker deletes on a schedule and has no idea who has read what. Tiering exists because keeping the full window locally is what makes rebalances copy history.",
        numbers: [
          "7 days at 3GB/s = 1.81PB single replica, ~5.5PB with RF=3",
          "92TB per broker local vs 6.5TB at 12h local retention",
          "remote fetch 50-200ms against <1ms local",
        ],
        breaks:
          "A consumer lagging past the local boundary starts fetching remotely at 50 to 200ms, so recovery from a lag incident gets slower exactly when it matters. A stalled upload fills local disk instead.",
        choice: {
          pick: "12 hours local on NVMe, closed segments in object storage",
          instead: "Full 7-day retention on local disk.",
          decider:
            "5.5PB across 60 brokers is 92TB each, roughly 24 drives, and every rebalance copies a slice of it. Keeping 12 hours local is 6.5TB, one drive, and cuts storage cost by about 10x while the whole log stays replayable.",
          flips:
            "Short retention. Below about a day of log there is nothing worth tiering and the remote read path is pure added failure surface.",
        },
      },
    },
    {
      id: "consumers",
      label: "Consumer group",
      sub: "poll, process, then commit",
      kind: "compute",
      x: 40,
      y: 520,
      w: 280,
      detail: {
        what: "A set of consumers sharing a topic's partitions, each issuing fetch(topic, partition, offset, max_bytes) with a bounded wait and committing after the work is done.",
        why: "Because consumers pull, a slow one simply lags and the broker never notices, which is why one cluster serves thousands of independent readers. Committing after processing rather than before is what makes delivery at-least-once, and that is the right default with idempotent consumers.",
        numbers: [
          "each partition goes to exactly one consumer in the group",
          "fetch.max.wait.ms=10, so ~5ms average poll wait",
          "100k consumer instances across 5k groups",
        ],
        breaks:
          "Consumer count above partition count does nothing: the 51st consumer on a 50-partition topic polls nothing. And a poison record blocks its partition forever, because a cursor advances or it does not.",
        choice: {
          pick: "Consumers pull with a bounded long poll",
          instead: "The broker pushes to consumers against a per-consumer credit window.",
          decider:
            "Latency budget against reader count. A long poll at fetch.max.wait.ms=10 adds about 5ms, invisible against a 50ms end-to-end budget and ruinous against a 5ms one. In exchange the broker holds no flow-control state per consumer, so a reader stalled for an hour costs one stale offset instead of a growing outstanding-delivery table.",
          flips:
            "p99 delivery under about 5ms with readers in the tens rather than thousands, or when the broker must choose which consumer receives a message: least-busy dispatch and priority routing only exist in the push model.",
        },
      },
    },
    {
      id: "offsets",
      label: "__consumer_offsets",
      sub: "one row per (group, topic, partition)",
      kind: "bus",
      x: 440,
      y: 560,
      w: 240,
      detail: {
        what: "An internal compacted Kafka topic holding the committed offset for every (group, topic, partition), which is the entire per-consumer state the cluster keeps.",
        why: "Putting the read position in the consumer rather than the broker is the placement that settles everything else: replay for nothing, fan-out that costs a sequential read, ordering per key, and a broker that tracks nobody. Keeping it in a log means it replicates and fails over exactly like data, with no second datastore in the commit path.",
        numbers: [
          "5k groups x 10 topics x 50 partitions = 2.5M rows",
          "2.5M x 64B = 160MB, trivially cached",
          "100k consumers committing every 5s = 20k commits/s",
        ],
        breaks:
          "Commit order is the delivery guarantee. Commit before processing and at-least-once quietly becomes at-most-once, losing records on the next crash with nothing to detect it.",
        choice: {
          pick: "Offsets in a compacted internal Kafka topic",
          instead: "An external store: ZooKeeper, Redis, or a relational table.",
          decider:
            "160MB of state at 20k commits/s that must survive precisely the failures the data survives. A topic the cluster already replicates gives that for free; an external store is a second system with its own failover sitting in the hot path of every consumer.",
          flips:
            "When the sink owns the offset. Writing output and offset in one transaction against the sink is stronger than committing to Kafka, and is the only way exactly-once reaches past the cluster boundary.",
        },
      },
    },
    {
      id: "coordinator",
      label: "Group coordinator",
      sub: "membership + partition assignment",
      kind: "compute",
      x: 40,
      y: 640,
      w: 280,
      detail: {
        what: "The broker that owns a consumer group: it tracks membership by heartbeat, assigns partitions to members, and runs a rebalance whenever a consumer joins or leaves.",
        why: "Exactly one consumer may own a partition at a time or two of them advance the same cursor, so membership changes need a coordinated reassignment rather than each consumer deciding for itself. The new owner then resumes from the committed offset, which is why a departure costs duplicates rather than gaps.",
        numbers: [
          "session.timeout.ms must exceed your GC pauses",
          "eager stops all 100 consumers for seconds per rebalance",
          "cooperative revokes only the partitions that move",
        ],
        breaks:
          "A flaky consumer flapping in and out triggers a rebalance storm, and under the eager protocol group throughput collapses because every member stops for every round.",
        choice: {
          pick: "Cooperative incremental rebalance (KIP-429, Kafka 2.4)",
          instead: "The classic eager protocol that revokes every assignment first.",
          decider:
            "Blast radius under churn. Eager stops all 100 consumers for the duration of each rebalance, typically seconds; cooperative revokes only the partitions that actually move, so 99 of 100 keep flowing while one migrates. The cost is two rebalance rounds instead of one.",
          flips:
            "Very small groups where a full stop is milliseconds anyway, and one round beats two. Neither protocol fixes a consumer that flaps, though; quarantine that one in its own group.",
        },
      },
    },
    {
      id: "kraft",
      label: "KRaft metadata quorum",
      sub: "3-5 controllers, brokers tail the log",
      kind: "store",
      x: 440,
      y: 680,
      w: 240,
      detail: {
        what: "Three or five controller nodes replicating one internal metadata log that every broker tails: which brokers exist, which one leads each partition, topic config and ACLs.",
        why: "Making leadership a subscription rather than a poll means a controller is already current when it is elected, so failover is a Raft election instead of a full metadata reload. It knows nothing about message content, only about who owns what.",
        numbers: [
          "~2M partition ceiling against ~200k on ZooKeeper",
          "failover in hundreds of ms rather than minutes",
          "ControllerActiveCount must be exactly 1 cluster-wide",
        ],
        breaks:
          "Lose quorum majority during a brownout and elections fail: existing leaders keep serving, but nothing can fail over and topic creates hang.",
        choice: {
          pick: "Embedded Raft quorum (KRaft), 3 or 5 controllers spread across racks",
          instead: "An external ZooKeeper ensemble holding configs and assignments.",
          decider:
            "Partition count against controller failover time. A ZooKeeper-backed controller reloads the whole metadata set on election: seconds at 10k partitions, minutes near the ~200k ceiling. Our 50k partitions sit inside that ceiling, but a multi-minute metadata freeze during a rack failure is not something to buy back with a config flag.",
          flips:
            "For a new cluster it does not; Kafka 4.0 removed ZooKeeper support outright. The defensible version is 'stay on ZooKeeper this quarter': below about 30k partitions the failover difference is seconds, which makes it a scheduling call rather than a design preference.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "producers",
      to: "partitioner",
      label: "key + value",
      animated: true,
      detail: {
        what: "A record with its key handed to the partitioner before it can be batched, because batches are per partition.",
        why: "The destination has to be known first: a batch is a unit of one partition's log, so routing precedes accumulation rather than following it.",
        numbers: ["mean message 1KB", "3M msg/s average"],
        breaks:
          "A null key means round-robin, which silently gives up the per-key ordering the rest of the design is sold on and nothing in the record records that choice.",
      },
    },
    {
      id: "e2",
      from: "partitioner",
      to: "leader",
      label: "ProduceRequest acks=all",
      animated: true,
      detail: {
        what: "A whole batch sent as one request to the current leader of the chosen partition.",
        why: "Batching amortises the request over 16KB of records, and it goes to the leader specifically because a partition has exactly one appender, which is what makes the offsets it assigns a real sequence.",
        numbers: ["batch.size 16KB or linger.ms=5, whichever first"],
        breaks:
          "The producer's cached view of who leads this partition goes stale on a failover, and the retry against the new leader is where duplicates come from without idempotence.",
      },
    },
    {
      id: "e3",
      from: "leader",
      to: "segments",
      label: "append, assign offset N",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The batch appended to the tail of the active segment file, each record given its offset, and the sparse index updated.",
        why: "This is the only write pattern in the system: strictly at the end of a file, never in place, which is why the throughput number is a property of the disk rather than of any algorithm.",
        numbers: ["500MB/s per broker at peak", "1GB segment files"],
        breaks:
          "This append goes to the page cache, not to a platter. What is on disk when the producer's call returns is whatever the kernel happened to have flushed.",
      },
    },
    {
      id: "e4",
      from: "leader",
      to: "isr",
      label: "records up to N",
      animated: true,
      detail: {
        what: "The leader's fetch response carrying the new records to each follower, which appends them to its own copy of the log.",
        why: "Followers use the ordinary consumer protocol rather than a dedicated replication wire, so there is one read path to make fast. It also means a rebuilding replica and a backfilling consumer compete for exactly the same resource.",
        numbers: ["2 followers per partition at RF=3"],
        breaks:
          "A follower that falls more than 30s behind is ejected from the in-sync set, the watermark stops waiting for it, and durability quietly drops a level.",
      },
    },
    {
      id: "e5",
      from: "isr",
      to: "leader",
      label: "fetch N+1 = implicit ack",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 70,
      detail: {
        what: "The follower's next FetchRequest, asking for offset N+1, which is how the leader learns it holds everything up to N.",
        why: "There is no separate acknowledgement message: the next fetch is the acknowledgement. The leader uses these positions to advance the high watermark to the minimum log-end-offset across the in-sync set.",
        numbers: ["HW = min log-end-offset across the ISR"],
        breaks:
          "Reverse this with the produce response and you have built acks=1 with extra latency; the ordering of these steps is the entire guarantee.",
      },
    },
    {
      id: "e6",
      from: "leader",
      to: "producers",
      label: "ack when HW advances",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 80,
      detail: {
        what: "The ProduceResponse carrying the assigned offset, released only once the high watermark has passed the batch.",
        why: "This is the moment 'committed' is defined, and it means present in the page cache of every in-sync replica. Not durable on any disk, and not necessarily readable on the followers yet.",
        numbers: ["p99 produce ack ~10ms", "same-AZ 0.5ms, cross-AZ ~1ms round trip"],
        breaks:
          "Under acks=1 this response is sent before any follower has fetched, so a leader crash straight afterwards loses the batch with no error anywhere in the system.",
      },
    },
    {
      id: "e7",
      from: "segments",
      to: "pagecache",
      label: "hot segments in RAM",
      detail: {
        what: "Recently written segments sitting in the kernel's buffer because they were just written through it.",
        why: "The write path populates the read cache for free, so consumers reading near the tail never touch a device and the broker never had to implement a cache of its own.",
        numbers: ["local read <1ms"],
        breaks:
          "The cached window is however much RAM is left over, so it shrinks under memory pressure and no consumer is told that its reads just became disk reads.",
      },
    },
    {
      id: "e8",
      from: "pagecache",
      to: "consumers",
      label: "sendfile to socket",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The fetch response: log bytes piped from the segment file straight to the consumer's socket by sendfile(), never entering the JVM heap.",
        why: "This is what makes an extra consumer group nearly free. The same bytes are shipped to every reader with no per-subscriber copy, which is why fan-out costs a sequential read rather than a queue per consumer.",
        numbers: ["~150MB/s read egress per broker", "9GB/s cluster read at 3 groups per topic"],
        breaks:
          "Consumers cannot be served past the high watermark, so a shrunken in-sync set stalls readers as well as writers.",
      },
    },
    {
      id: "e9",
      from: "consumers",
      to: "leader",
      label: "fetch(partition, offset)",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 150,
      detail: {
        what: "The pull: give me messages from this partition starting at this offset, with a bounded wait if there is nothing yet.",
        why: "The consumer names the position rather than being handed one, which is why replay is a smaller number in this request rather than a feature, and why the broker keeps no delivery state for anyone.",
        numbers: ["fetch.max.wait.ms=10, ~5ms average wait", "end to end ~20 to 50ms"],
        breaks:
          "A consumer that stops fetching costs the cluster one stale offset and nothing else, so lag is invisible to the broker and has to be alerted on from the outside.",
      },
    },
    {
      id: "e10",
      from: "segments",
      to: "tiered",
      label: "closed segments uploaded",
      dashed: true,
      detail: {
        what: "Sealed segment files copied to object storage, after which local retention can delete them while they remain readable.",
        why: "It decouples how much history the topic keeps from how much disk each broker carries, which also stops a rebalance moving history it will never read.",
        numbers: ["~10x lower storage cost", "6.5TB local per broker instead of 92TB"],
        breaks:
          "If uploads stall, RemoteCopyLagBytes climbs and local disk fills behind it, so the alert has to fire well before the local retention boundary.",
      },
    },
    {
      id: "e11",
      from: "tiered",
      to: "consumers",
      label: "remote fetch if lagged",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A fetch that missed local retention falling through to object storage, transparently to the consumer's code.",
        why: "Reads resolve local-first, so the tier is invisible until a consumer lags past the boundary. Sizing local retention above the 99.9th percentile of lag is what keeps it that way.",
        numbers: ["50-200ms remote against <1ms local"],
        breaks:
          "Fetch latency jumps by two orders of magnitude precisely when a consumer is trying to catch up, so a lag incident gets slower to recover from the deeper it goes.",
      },
    },
    {
      id: "e12",
      from: "consumers",
      to: "offsets",
      label: "commit(offset + 1)",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A commit written after processing, meaning everything up to offset N is done and the next poll should start at N+1.",
        why: "Committing after the work rather than before is what makes this at-least-once. A crash between processing and commit replays records rather than skipping them, which is the failure mode you can fix with an idempotency key.",
        numbers: ["20k commits/s cluster-wide", "every 5s per consumer instance"],
        breaks:
          "Commit first and a crash silently skips work. There is no error and no metric; the gap only shows up in whatever downstream state was supposed to change.",
      },
    },
    {
      id: "e13",
      from: "consumers",
      to: "coordinator",
      label: "heartbeat, join, leave",
      dashed: true,
      detail: {
        what: "Group membership traffic: heartbeats on a session timeout, plus explicit joins and leaves that trigger a reassignment.",
        why: "Partition ownership must be exclusive, so somebody has to decide it centrally. Heartbeats are how a dead consumer is distinguished from a slow one, badly, on a timeout.",
        numbers: ["session.timeout.ms above your GC pauses"],
        breaks:
          "A GC pause longer than the session timeout looks exactly like a death, so the group rebalances around a consumer that is about to come back and do it again.",
      },
    },
    {
      id: "e14",
      from: "coordinator",
      to: "offsets",
      label: "resume from committed",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "The new owner of a partition reading the group's committed offset to find out where to start.",
        why: "This is why a rebalance is survivable at all: ownership moves, but the position does not travel with the consumer, it is looked up. Any records processed after the last commit are simply redone.",
        numbers: ["one 64B row per (group, topic, partition)"],
        breaks:
          "Everything between the last commit and the revocation is reprocessed, so a rebalance replays records and a non-idempotent sink turns that into a duplicate side effect.",
      },
    },
    {
      id: "e15",
      from: "kraft",
      to: "leader",
      label: "elects leader from ISR",
      dashed: true,
      fromSide: "top",
      toSide: "right",
      offset: 110,
      detail: {
        what: "The metadata log telling every broker which one leads each partition, and electing a replacement from the in-sync set when a leader dies.",
        why: "Electing only from the in-sync set is what makes failover lossless: by construction those replicas hold everything up to the old high watermark, so nothing committed can be missing.",
        numbers: ["failover in hundreds of ms under KRaft", "controller elections must settle on exactly 1"],
        breaks:
          "With unclean.leader.election.enable=true an out-of-sync replica can be promoted, silently truncating every record past its log-end-offset. On a payments topic that is a payment that vanished with no error.",
      },
    },
  ],
};
