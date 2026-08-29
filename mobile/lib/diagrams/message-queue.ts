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
      "What the log cannot express is per-message state. One unprocessable record holds up everything behind it on its partition, and a dead-letter topic relocates that blocking rather than removing it. If the requirement is per-message retry, backoff and priority, the answer is a broker-tracked queue, not this.",
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
    // ---------------------------------------------------------------- producer
    {
      id: "producer",
      label: "Producer",
      sub: "payments, CDC, clickstream",
      kind: "serviceGroup",
      col: 0,
      row: 1,
      detail: {
        what: "The publishing application with the Kafka producer library in the same process. Routing, batching and sending are three stages of one send() call, not three services.",
        why: "Everything that decides ordering and durability happens client-side, before a byte leaves the machine: which partition, how long to batch, what acknowledgement to wait for. Drawing these as peer services would invent network hops that do not exist and would hide that one application team owns all three settings.",
        numbers: [
          "3M msg/s average, 10M peak, mean message 1KB",
          "3M x 1KB = 3GB/s average, 10GB/s peak",
          "p99 produce ack ~10ms with acks=all",
        ],
        breaks:
          "These are library defaults on a hundred teams' classpaths. A service that ships with acks=1, or with a null key, looks identical from the broker side, and there is no cluster-side control that catches either.",
      },
    },
    {
      id: "partitioner",
      label: "Partitioner",
      sub: "hash(key) % partition count",
      kind: "process",
      col: 0,
      row: 1,
      parent: "producer",
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
          pick: "Hash the message key, and over-provision partitions at 50 to 100",
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
      id: "accumulator",
      label: "Record accumulator",
      sub: "batch.size 16KB / linger.ms=5",
      kind: "process",
      col: 0,
      row: 1,
      parent: "producer",
      detail: {
        what: "Per-partition buffers holding records until the batch reaches batch.size or linger.ms elapses, at which point it is released as one ProduceRequest.",
        why: "Batching is what turns millions of tiny records into a few large sequential appends, which is the only access pattern the broker is fast at. It is also the one latency-for-throughput dial on the client side; there is no broker-side equivalent.",
        numbers: [
          "batch.size 16KB, linger.ms=5",
          "3M msg/s at 1KB mean = 3GB/s of batched writes",
          "linger is about half the ~10ms p99 ack",
        ],
        breaks:
          "The buffer is bounded by buffer.memory. When the leader is unreachable it fills and send() starts blocking, so a broker problem surfaces first as latency inside the application rather than as an error from Kafka.",
        choice: {
          pick: "linger.ms=5 with 16KB per-partition batches",
          instead: "linger.ms=0, sending each record the moment it arrives.",
          decider:
            "Request count against the latency budget. At linger.ms=0, 3M msg/s is 3M requests/s against a broker whose whole economy is large sequential appends. Five milliseconds of deliberate delay is half the 10ms p99 ack budget and collapses those into a couple of hundred thousand batched requests.",
          flips:
            "A low-volume control topic where each message is worth its own round trip, or an end-to-end p99 budget near 5ms, where linger would be most of it.",
        },
      },
    },
    {
      id: "sender",
      label: "Sender",
      sub: "acks=all, idempotence=true",
      kind: "process",
      col: 0,
      row: 1,
      parent: "producer",
      detail: {
        what: "The I/O thread that sends each ready batch to that partition's current leader and holds it until the ProduceResponse arrives, retrying against the new leader after a failover.",
        why: "The acknowledgement level chosen here is the only place durability is actually purchased. Idempotence is what stops the retry that a lost acknowledgement forces from becoming a duplicate nothing downstream can distinguish from a real second event.",
        numbers: [
          "p99 produce ack ~10ms",
          "acks=all + min.insync.replicas=2 survives one broker loss",
          "acks=1 is roughly 2x the throughput",
        ],
        breaks:
          "The producer's cached view of who leads this partition goes stale on a failover, and the retry against the new leader is exactly where duplicates come from when idempotence is off.",
        choice: {
          pick: "acks=all with min.insync.replicas=2 and enable.idempotence=true",
          instead: "acks=1, or acks=0 fire and forget.",
          decider:
            "acks=1 is roughly 2x the throughput and drops the last batch on every leader crash, with no error, no metric and no way to reconstruct the gap. acks=all costs a p99 of about 10ms and loses nothing while 2 of 3 replicas hold the bytes. Idempotence has been the default since Kafka 3.0 and its cost is negligible.",
          flips:
            "Telemetry, clickstream and application logs, where a batch lost on a leader crash is cheaper than the latency and nobody reconciles the totals later.",
        },
      },
    },

    // ------------------------------------------------------------ control plane
    {
      id: "kraft",
      label: "KRaft controllers",
      sub: "3-5 nodes, tails metadata log",
      kind: "database",
      col: 0,
      row: 0,
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

    // --------------------------------------------------------- rack A / broker
    {
      id: "rack",
      label: "Rack A",
      sub: "one failure domain: power, switch, AZ",
      kind: "zone",
      detail: {
        what: "One failure domain, drawn as a boundary rather than a machine: the leader broker for this partition, the NVMe log directory it appends to and the kernel page cache over that log, all behind one power distribution unit and one top-of-rack switch.",
        why: "Committed means present in the page cache of every in-sync replica and on no disk anywhere, so durability is entirely a claim about how many independent failure domains hold the bytes. Three replicas inside this one rectangle would be one failure domain wearing the number three, which is why the followers are drawn outside it.",
        numbers: [
          "20 brokers in this rack, 60 in the cluster across 3 racks",
          "30GB/s peak disk write / 0.5GB/s usable per broker = 60 brokers",
          "~4k partitions per broker, 240k cluster ceiling",
        ],
        breaks:
          "Rack-aware placement costs cross-AZ traffic on every single produce, in latency and on the bill. Turning broker.rack off to save that is invisible right up until the rack goes.",
      },
    },
    {
      id: "broker",
      label: "Leader broker",
      sub: "one appender per partition",
      kind: "serviceGroup",
      col: 1,
      row: 1,
      parent: "rack",
      detail: {
        what: "The single broker that accepts every read and write for this partition: it appends, assigns offsets, tracks the high watermark, answers fetches from followers and consumers alike, and ages closed segments out to the tier.",
        why: "One writer per partition is what makes an offset mean anything: it is a position in one file, so two writers would produce two orderings and the sequence number would stop being a sequence. The four stages inside are one JVM on one machine; drawing them as peer services would invent four network hops that do not exist.",
        numbers: [
          "500MB/s of write per broker at peak",
          "~1GB/s NVMe ceiling, 0.5GB/s budgeted usable",
          "~4k partitions per broker",
        ],
        breaks:
          "Segment appends, replica catch-up fetches, consumer reads and tier uploads all contend for the same devices inside this one process, and there is no isolation between them beyond throttles that have their own failure mode.",
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
      id: "append",
      label: "Log append",
      sub: "assigns offset, updates index",
      kind: "process",
      col: 1,
      row: 1,
      parent: "broker",
      detail: {
        what: "The request handler that appends a batch to the tail of the active segment file, assigns each record its offset, and updates the sparse index mapping every few kilobytes of log to a byte position.",
        why: "Records are never updated in place, so the head never seeks and every write is a sequential append, which is among the fastest I/O patterns available because the hardware can predict the next sector. There is no cleverness above this: the throughput number is the disk.",
        numbers: [
          "500MB/s per broker at peak",
          "1GB segment files, oldest deleted by retention",
          "index and time-index add ~1% on top of the log",
        ],
        breaks:
          "The append lands in the page cache, not on a platter. Kafka does not fsync per batch, so an acknowledged record exists only in the memory of three machines until the kernel gets round to it.",
        choice: {
          pick: "No fsync per batch; log.flush.interval.messages effectively unbounded",
          instead: "Flush to disk on every batch before the leader considers it written.",
          decider:
            "Forcing a flush per batch costs roughly an order of magnitude of throughput, taking a broker from ~1GB/s of sequential append down into the tens of MB/s. Replicating to three machines in three racks covers the same exposure for the price of cross-AZ traffic, which is far cheaper. The residual risk is correlated power loss across all three before the kernel flushes.",
          flips:
            "A single-rack or single-machine deployment, where there is no second failure domain to replicate into and the flush is the only durability on offer.",
        },
      },
    },
    {
      id: "hwm",
      label: "High watermark",
      sub: "min log-end-offset, ISR",
      kind: "process",
      col: 1,
      row: 1,
      parent: "broker",
      detail: {
        what: "The bookkeeping that tracks each follower's log-end-offset, advances the high watermark to the minimum across the in-sync set, and releases the acks=all ProduceResponse once that watermark passes the batch.",
        why: "This is the moment 'committed' is defined, and it means present in the page cache of every in-sync replica: not durable on any disk, and not necessarily readable on the followers yet. It also gates reads, because a consumer may not read past the watermark, so nothing a consumer has seen can later be truncated.",
        numbers: [
          "HW = min log-end-offset across the ISR",
          "p99 produce ack ~10ms",
          "same-AZ round trip ~0.5ms, cross-AZ ~1ms",
        ],
        breaks:
          "Fall below min.insync.replicas and this gate refuses writes with NotEnoughReplicas. That outage is the durability guarantee working, and lowering the setting to 1 to clear the alert converts a loud incident into an invisible data-loss window.",
        choice: {
          pick: "min.insync.replicas=2 against RF=3, refusing writes below it",
          instead:
            "min.insync.replicas=1, or releasing the producer on the leader's local append.",
          decider:
            "At min.insync.replicas=1 a leader crash immediately after the acknowledgement loses the batch with no error, no metric and no way to reconstruct the gap. That is the acks=1 failure with the ceremony of acks=all. Holding at 2 costs availability precisely when one of three replicas is already gone, which is minutes a quarter measured against a silent loss window of unknown size.",
          flips:
            "Topics reconstructible from an upstream source, such as clickstream or application logs, where a produce outage costs more than a gap nobody reconciles.",
        },
      },
    },
    {
      id: "fetchsvc",
      label: "Fetch handler",
      sub: "sendfile, one path for reads",
      kind: "process",
      col: 1,
      row: 1,
      parent: "broker",
      detail: {
        what: "The handler answering every FetchRequest. A follower asking for offset N+1 and a consumer asking for its next batch issue the same call, and the bytes go from the segment file to the socket through sendfile() without entering the JVM heap.",
        why: "One protocol for both paths means there is one read path to make fast and no separate replication wire at all. Zero copy is what makes an extra consumer group nearly free: the same bytes are shipped to every reader with no per-subscriber copy.",
        numbers: [
          "~150MB/s read egress per broker at 3 groups per topic",
          "9GB/s cluster read against 3GB/s ingress",
          "fetch.max.wait.ms=10, so ~5ms average poll wait",
        ],
        breaks:
          "A rebuilding replica and a backfilling consumer are indistinguishable here and compete for exactly the same devices. Throttling the replica to protect consumer latency can hold it out of the in-sync set, and that is how you throttle your way into a produce outage.",
        choice: {
          pick: "Consumers pull with a bounded long poll; followers use the same call",
          instead: "The broker pushes to consumers against a per-consumer credit window.",
          decider:
            "Latency budget against reader count. A long poll at fetch.max.wait.ms=10 adds about 5ms, invisible against a 50ms end-to-end budget and ruinous against a 5ms one. In exchange the broker holds no flow-control state per consumer, so a reader stalled for an hour costs one stale offset instead of a growing outstanding-delivery table.",
          flips:
            "p99 delivery under about 5ms with readers in the tens rather than thousands, or when the broker must choose which consumer receives a message: least-busy dispatch and priority routing only exist in the push model.",
        },
      },
    },
    {
      id: "retention",
      label: "Retention + tier upload",
      sub: "12h local, rest in the bucket",
      kind: "process",
      col: 1,
      row: 1,
      parent: "broker",
      detail: {
        what: "The KIP-405 remote log manager: it uploads closed segment files to object storage, deletes local segments on a time or size bound, and serves a fetch that has fallen past the local boundary by reading them back.",
        why: "Retention is never by consumption, which is the property replay is built on: the broker deletes on a schedule and has no idea who has read what. Tiering exists because keeping the whole window locally is what makes every rebalance copy history it will never read.",
        numbers: [
          "7 days at 3GB/s = 1.81PB single replica, ~5.5PB with RF=3",
          "92TB per broker local vs 6.5TB at 12h local retention",
          "remote fetch 50-200ms against <1ms local",
        ],
        breaks:
          "A stalled upload fills local disk behind it. RemoteCopyLagBytes climbs, and the alert has to fire well before the local retention boundary rather than at it, because by then there is nowhere left to append.",
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

    // ------------------------------------------------------------- the log itself
    {
      id: "partitionlog",
      label: "Partition log",
      sub: "1GB append-only segments on NVMe",
      kind: "queue",
      col: 2,
      row: 1,
      parent: "rack",
      detail: {
        what: "The partition as it exists on disk: fixed-size segment files written strictly at the tail, never in place, plus a sparse index from offset to byte position.",
        why: "This file is the product. Ordering is position in it, replay is a smaller offset against it, and fan-out is one more sequential read of it. Nothing is removed when it is read, which is the single property that separates a log from a mailbox.",
        numbers: [
          "~1GB/s per broker on NVMe, budget 0.5GB/s usable",
          "1GB segment files, oldest deleted by retention",
          "~50k partitions in use against a 240k ceiling",
        ],
        breaks:
          "Partitions are indivisible. One key carrying 10% of a topic's traffic saturates its log while the siblings idle, and the only routes out are salting the key and losing per-key ordering, or scaling that one consumer vertically.",
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
      label: "OS page cache",
      sub: "kernel buffer over segments",
      kind: "cache",
      col: 2,
      row: 2,
      parent: "rack",
      detail: {
        what: "The kernel's buffer over the log files. The broker allocates no cache of its own: writes pass through this buffer on the way down and recent reads are served straight out of it.",
        why: "Consumers mostly read what was just written, so the write path populates the read cache for free. It is memory you are allowed to lose by construction, because everything in it is either already in a segment file or not yet committed.",
        numbers: [
          "local read <1ms against 50-200ms from the tier",
          "read egress ~150MB/s per broker",
          "9GB/s cluster read at 3 consumer groups per topic",
        ],
        breaks:
          "The cached window is however much RAM is left over, so it shrinks under memory pressure and no consumer is told that its reads just became disk reads competing with replica fetches.",
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

    // ------------------------------------------------------------- other racks
    {
      id: "followers",
      label: "In-sync followers",
      sub: "2 replicas, racks B and C",
      kind: "queue",
      col: 1,
      row: 0,
      detail: {
        what: "The two brokers holding copies of this partition's log, in the in-sync set while they have fetched within replica.lag.time.max.ms. They are the set the watermark waits for and the set a new leader is elected from.",
        why: "Durability here is replication rather than flush, so membership of this set is the guarantee itself. They are drawn outside rack A on purpose: three copies are three failure domains only if they sit in three of them.",
        numbers: [
          "replica.lag.time.max.ms 30s",
          "RF=3 survives one broker loss with nothing lost",
          "ISR shrink-and-recover within 60s as an SLO",
        ],
        breaks:
          "Ejection from the set is silent to producers until the set falls below min.insync.replicas. Durability drops a level first and the outage arrives second, so UnderReplicatedPartitions is the page, not UnderMinIsr.",
        choice: {
          pick: "RF=3 with rack-aware placement (broker.rack), unclean leader election off",
          instead:
            "Three replicas inside one rack, or unclean.leader.election.enable=true to keep serving.",
          decider:
            "Correlated failure, because nothing has fsynced when the producer's call returns. Three replicas behind one power distribution unit is one failure domain, not three. Unclean election promotes an out-of-sync replica and silently truncates every record past its log-end-offset; on a payments topic that is a payment that vanished with no error anywhere.",
          flips:
            "Single-rack deployments where cross-AZ egress dominates the bill and the topic is reconstructible from an upstream source, so the correlated case is an inconvenience rather than a loss.",
        },
      },
    },

    // ---------------------------------------------------------- outside the cluster
    {
      id: "objectstore",
      label: "Object storage tier",
      sub: "closed segments, ~10x cheaper",
      kind: "blob",
      col: 1,
      row: 3,
      detail: {
        what: "The bucket holding every closed segment once it has been uploaded, and the source a fetch resolves against after local retention has deleted the local copy.",
        why: "It decouples how much history a topic keeps from how much disk each broker carries, which is also what stops a rebalance moving history nobody will read. Reads resolve local-first, so the tier is invisible until a consumer lags past the boundary.",
        numbers: [
          "~10x lower storage cost per byte",
          "6.5TB local per broker instead of 92TB",
          "remote fetch 50-200ms against <1ms local",
        ],
        breaks:
          "Fetch latency jumps by two orders of magnitude exactly when a consumer is trying to catch up, so a lag incident gets slower to recover from the deeper it goes. A regional bucket outage takes the whole remote read path with it.",
        choice: {
          pick: "Object storage as a read-through tier underneath the local log",
          instead:
            "Brokers writing every byte straight to shared object storage, with no local log at all.",
          decider:
            "Commit latency. A shared-storage broker batches writes into the bucket and commits in a few hundred milliseconds, against the few milliseconds a local append costs. That is fine for an analytical workload and nowhere near a p99 produce ack of 10ms. Keeping the tier under the log keeps the hot path local and moves only cold bytes.",
          flips:
            "Analytical workloads where cross-zone network charges dominate the bill and nothing needs a single-digit-millisecond acknowledgement. That design has been shipping since 2023 and it buys elasticity, because scaling then moves no data at all.",
        },
      },
    },
    {
      id: "mirror",
      label: "Cross-region mirror",
      sub: "async, ~30% of topics",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "Cluster Linking, or MirrorMaker 2 on OSS, copying selected topics and their consumer-group state into the peer region's cluster.",
        why: "Asynchronous by default, because a synchronous cross-region write costs far too much latency for a general-purpose topic. That makes the replication lag at the moment of failure the recovery point objective, which is a design number rather than a performance detail.",
        numbers: [
          "0.3 x 3GB/s = 900MB/s sustained egress, 78TB/day",
          "~$1,550/day, ~$47k/month at $0.02/GB",
          "RPO seconds to ~1min, RTO ~5min for consumer cutover",
        ],
        breaks:
          "Active-active on the same topic has no ordering between the two clusters, so conflict resolution lands in application code. And this is usually the single largest line item on the bill, which is why the 30% figure gets audited quarterly.",
        choice: {
          pick: "Asynchronous mirroring of the ~30% of topics with a peer-region consumer",
          instead: "Mirror every topic, or acknowledge synchronously across both regions.",
          decider:
            "Cost against RPO. Mirroring everything takes 900MB/s to 3GB/s and the bill past $150k/month, most of it for topics nobody reads over there. Synchronous acknowledgement puts a cross-region round trip inside every produce, tens of milliseconds against a 10ms budget.",
          flips:
            "Financial topics that need zero RPO. Those ride a tighter tier with a synchronous mirror or two-region acks, at much higher cost, and only those.",
        },
      },
    },

    // -------------------------------------------------------------- consumer side
    {
      id: "coordinator",
      label: "Group coordinator",
      sub: "membership + assignment",
      kind: "service",
      col: 0,
      row: 2,
      detail: {
        what: "The broker that owns a consumer group: it tracks membership by heartbeat, assigns partitions to members, and runs a rebalance whenever a consumer joins or leaves.",
        why: "Exactly one consumer may own a partition at a time, or two of them advance the same cursor, so membership changes need a coordinated reassignment rather than each consumer deciding for itself. The new owner then resumes from the committed offset, which is why a departure costs duplicates rather than gaps.",
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
      id: "dlq",
      label: "Dead-letter topic",
      sub: "deterministic failures only",
      kind: "queue",
      col: 0,
      row: 4,
      detail: {
        what: "A separate topic a consumer publishes an unprocessable record to, so it can commit past that offset and keep the cursor moving.",
        why: "A cursor advances or it does not, so one bad record at offset N holds up every record behind it on that partition. Publishing it elsewhere is the only way to advance without dropping it, which is the closest a log gets to per-message handling.",
        numbers: [
          "one poison record blocks one partition, not the group",
          "track DLQ depth as an SLO",
          "replay tooling re-ingests after a code patch",
        ],
        breaks:
          "It relocates head-of-line blocking rather than removing it. When the failure is a downstream dependency that has been down four minutes, this absorbs several million perfectly good records, their order relative to the main topic is gone, and re-injecting them later replays them against state that has moved past them.",
        choice: {
          pick: "Dead-letter only deterministic failures; pause the partition on retriable ones",
          instead: "Dead-letter anything that throws, or chain retry topics with staged delays.",
          decider:
            "Which failures are actually deterministic. A bad schema or an unparseable payload will fail identically forever, so moving it aside is free. A downstream 503 will succeed on the next attempt, and dead-lettering it converts a four-minute outage into millions of out-of-order records to re-inject. No arrangement keeps per-key ordering and per-message retry at the same time, and the classification lives in application code that no central component can verify.",
          flips:
            "When the workload is a work queue rather than a stream. Then broker-tracked acknowledgement with retry, backoff and a dead-letter after N attempts is straightforwardly the better tool, and the log was never the right one.",
        },
      },
    },
    {
      id: "offsets",
      label: "__consumer_offsets",
      sub: "row per (group,topic,partition)",
      kind: "queue",
      col: 0,
      row: 3,
      detail: {
        what: "An internal compacted Kafka topic holding the committed offset for every (group, topic, partition), which is the entire per-consumer state the cluster keeps.",
        why: "Putting the read position in the consumer rather than the broker is the placement that settles everything else: replay for nothing, fan-out that costs a sequential read, ordering per key, and a broker that tracks nobody. Keeping it in a log means it replicates and fails over exactly like data, with no second datastore in the commit path.",
        numbers: [
          "5k groups x 10 topics x 50 partitions = 2.5M rows",
          "2.5M x 64B = 160MB, trivially cached",
          "100k consumers committing every 5s = 20k commits/s",
        ],
        breaks:
          "This topic is also where rebalance churn shows up first: a flapping consumer drives repeated writes here, and a group whose coordinator partition is unavailable cannot commit or resume at all.",
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
      id: "consumer",
      label: "Consumer group",
      sub: "each partition, one member",
      kind: "serviceGroup",
      col: 1,
      row: 2,
      detail: {
        what: "A set of consumer instances sharing a topic's partitions, every one of them running the same three-stage loop: poll, process, commit.",
        why: "Because consumers pull, a slow one simply lags and the broker never notices, which is why one cluster serves thousands of independent readers. The group, not the instance, is the unit of assignment and of offset bookkeeping.",
        numbers: [
          "100k consumer instances across 5k groups",
          "3 consumers on 6 partitions get 2 each",
          "end to end producer to consumer ~20 to 50ms",
        ],
        breaks:
          "Consumer count above partition count does nothing: the 51st consumer on a 50-partition topic polls nothing. Past that ceiling the only move is a repartition, which is the one-way door.",
      },
    },
    {
      id: "fetcher",
      label: "Fetch loop",
      sub: "long poll + heartbeat",
      kind: "process",
      col: 1,
      row: 2,
      parent: "consumer",
      detail: {
        what: "The poll: give me messages from this partition starting at this offset, with a bounded wait if there is nothing yet. The same thread heartbeats to the coordinator to keep this member in the group.",
        why: "The consumer names the position rather than being handed one, which is why replay is a smaller number in this request rather than a feature, and why the broker keeps no delivery state for anyone.",
        numbers: [
          "fetch.max.wait.ms=10, so ~5ms average wait",
          "end to end ~20 to 50ms",
          "session.timeout.ms must exceed your GC pauses",
        ],
        breaks:
          "A consumer that stops fetching costs the cluster one stale offset and nothing else, so lag is invisible to the broker and has to be alerted on from outside as latest_offset - committed_offset.",
        choice: {
          pick: "Long poll at fetch.max.wait.ms=10, session.timeout.ms above your worst GC pause",
          instead: "Tight polling with a short session timeout for faster failure detection.",
          decider:
            "A session timeout below your worst stop-the-world pause makes a GC hiccup indistinguishable from a death, so the group rebalances around a consumer that is about to come back and do it again. Detection gets faster by a few seconds; a rebalance storm costs the whole group its throughput for as long as it lasts.",
          flips:
            "Very small groups where a rebalance completes in milliseconds, so losing seconds to a genuinely dead member is the larger cost.",
        },
      },
    },
    {
      id: "processor",
      label: "Process the batch",
      sub: "idempotent sink, keyed",
      kind: "process",
      col: 1,
      row: 2,
      parent: "consumer",
      detail: {
        what: "The application work: each record is transformed, written to a sink, or turned into a side effect, and none of it is committed until this returns.",
        why: "Delivery is at-least-once, so this stage has to be safe to run twice. An idempotency key the sink honours is what makes a replayed record harmless, and once the output leaves Kafka it is the only remedy there is.",
        numbers: [
          "a rebalance replays everything since the last commit",
          "at 3M msg/s with 30s of work, broker-tracked delivery would track 90M records",
          "one poison record blocks its partition, not the group",
        ],
        breaks:
          "Exactly-once stops at the cluster boundary. The moment the output is a payment API call, an email, or a database not enrolled in the transaction, the guarantee reverts to at-least-once, and a consumer with a non-idempotent sink is indistinguishable from a correct one until a rebalance replays 200 records and someone is charged twice.",
        choice: {
          pick: "At-least-once with an idempotency key carried in the payload schema",
          instead:
            "Kafka transactions plus isolation.level=read_committed for exactly-once semantics.",
          decider:
            "Where the output lands. Transactions make consume-transform-produce atomic as long as both ends are Kafka; the moment a sink sits outside the cluster the guarantee reverts and the idempotency key is doing all the work anyway. Paying transaction overhead for a guarantee that stops at the boundary buys nothing, and most consumers are on the boundary.",
          flips:
            "A pure Kafka-to-Kafka pipeline, such as a streaming join or aggregation whose only output is another topic. There transactions genuinely close the loop, and read_committed is what keeps aborted writes invisible.",
        },
      },
    },
    {
      id: "committer",
      label: "Commit offset",
      sub: "after the work, every 5s",
      kind: "process",
      col: 1,
      row: 2,
      parent: "consumer",
      detail: {
        what: "The commit written after processing: everything up to offset N is done, start at N+1 next time. It goes into the __consumer_offsets topic, not into a datastore of its own.",
        why: "Committing after the work rather than before is what makes this at-least-once. A crash between processing and commit replays records rather than skipping them, which is the failure mode an idempotency key can absorb.",
        numbers: [
          "100k consumers committing every 5s = 20k commits/s",
          "one 64B row per (group, topic, partition)",
          "2.5M rows, 160MB cluster-wide",
        ],
        breaks:
          "Commit first and a crash silently skips work. There is no error and no metric; the gap only shows up in whatever downstream state was supposed to change.",
        choice: {
          pick: "Commit after processing, asynchronously, roughly every 5s",
          instead: "Commit before processing, or commit synchronously after every record.",
          decider:
            "Commit-before-process turns at-least-once into at-most-once, losing records on the next crash with nothing to detect it. Synchronous per-record commits are correct and put a round trip in front of every record, which at 3M msg/s is not something the cluster can serve. Every 5s bounds the replay window to five seconds of work.",
          flips:
            "Low-volume topics where each record is expensive and a five-second replay window is worse than the round trip, so a synchronous commit per record is affordable.",
        },
      },
    },
  ],
  edges: [
    // --------------------------------------------------------------- produce path
    {
      id: "e1",
      from: "partitioner",
      to: "accumulator",
      label: "hash(key) % partitions",
      animated: true,
      detail: {
        what: "The record, now carrying a destination partition, handed to that partition's buffer.",
        why: "The destination has to be known first, because a batch is a unit of one partition's log. Routing precedes accumulation rather than following it.",
        numbers: ["mean message 1KB", "3M msg/s average"],
        breaks:
          "A null key means round-robin, which silently gives up the per-key ordering the rest of the design is sold on, and nothing in the record records that choice.",
      },
    },
    {
      id: "e2",
      from: "accumulator",
      to: "sender",
      label: "16KB batch or linger 5ms",
      animated: true,
      detail: {
        what: "A batch released to the I/O thread once it hits batch.size or linger.ms elapses, whichever comes first.",
        why: "This is the latency-for-throughput trade, made once per batch and entirely on the client. Nothing downstream can undo a producer that chose to send one record at a time.",
        numbers: ["batch.size 16KB, linger.ms=5", "~5ms of the ~10ms p99 ack"],
        breaks:
          "If the leader is unreachable, batches stack up against buffer.memory and send() begins to block, so a cluster problem first appears as application latency.",
      },
    },
    {
      id: "e3",
      from: "sender",
      to: "append",
      tier: "hot",
      label: "ProduceRequest acks=all",
      detail: {
        what: "A whole batch sent as one request to the current leader of the chosen partition.",
        why: "Batching amortises the request over 16KB of records, and it goes to the leader specifically because a partition has exactly one appender, which is what makes the offsets it assigns a real sequence.",
        numbers: ["batch.size 16KB or linger.ms=5, whichever first", "500MB/s per broker at peak"],
        breaks:
          "The producer's cached view of who leads this partition goes stale on a failover, and the retry against the new leader is where duplicates come from without idempotence.",
      },
    },
    {
      id: "e4",
      from: "append",
      to: "partitionlog",
      tier: "hot",
      label: "append at tail, offset N",
      detail: {
        what: "The batch appended to the tail of the active segment file, each record given its offset, and the sparse index updated.",
        why: "This is the only write pattern in the system: strictly at the end of a file, never in place, which is why the throughput number is a property of the disk rather than of any algorithm.",
        numbers: ["500MB/s per broker at peak", "1GB segment files"],
        breaks:
          "This append goes to the page cache, not to a platter. What is on disk when the producer's call returns is whatever the kernel happened to have flushed.",
      },
    },
    {
      id: "e5",
      from: "partitionlog",
      to: "pagecache",
      tier: "data",
      label: "written through the cache",
      detail: {
        what: "Recently written segments sitting in the kernel's buffer because they were just written through it.",
        why: "The write path populates the read cache for free, so consumers reading near the tail never touch a device and the broker never had to implement a cache of its own.",
        numbers: ["local read <1ms"],
        breaks:
          "The cached window is however much RAM is left over, so it shrinks under memory pressure and no consumer is told that its reads just became disk reads.",
      },
    },

    // ------------------------------------------------------------ replication path
    {
      id: "e6",
      from: "fetchsvc",
      to: "followers",
      tier: "hot",
      label: "records up to N",
      detail: {
        what: "The fetch response carrying new records to each follower, which appends them to its own copy of the log in another rack.",
        why: "Followers use the ordinary consumer protocol rather than a dedicated replication wire, so there is one read path to make fast. It also means a rebuilding replica and a backfilling consumer compete for exactly the same devices.",
        numbers: ["2 followers per partition at RF=3", "cross-AZ round trip ~1ms"],
        breaks:
          "A follower that falls more than 30s behind is ejected from the in-sync set, the watermark stops waiting for it, and durability quietly drops a level before anything alerts.",
      },
    },
    {
      id: "e7",
      from: "followers",
      to: "hwm",
      tier: "control",
      label: "fetch N+1 = implicit ack",
      detail: {
        what: "The follower's next FetchRequest, asking for offset N+1, which is how the leader learns it holds everything up to N.",
        why: "There is no separate acknowledgement message: the next fetch is the acknowledgement. The leader uses these positions to advance the high watermark to the minimum log-end-offset across the in-sync set.",
        numbers: ["HW = min log-end-offset across the ISR", "replica.lag.time.max.ms 30s"],
        breaks:
          "Reverse this with the produce response and you have built acks=1 with extra latency; the ordering of these steps is the entire guarantee.",
      },
    },
    {
      id: "e8",
      from: "hwm",
      to: "sender",
      tier: "control",
      label: "ack when HW advances",
      detail: {
        what: "The ProduceResponse carrying the assigned offset, released only once the high watermark has passed the batch.",
        why: "This is the moment 'committed' is defined, and it means present in the page cache of every in-sync replica. Not durable on any disk, and not necessarily readable on the followers yet.",
        numbers: ["p99 produce ack ~10ms", "same-AZ 0.5ms, cross-AZ ~1ms round trip"],
        breaks:
          "Under acks=1 this response is sent before any follower has fetched, so a leader crash straight afterwards loses the batch with no error anywhere in the system.",
      },
    },
    {
      id: "e9",
      from: "kraft",
      to: "append",
      tier: "control",
      label: "you lead P2, epoch E",
      detail: {
        what: "The metadata log telling every broker which one leads each partition, and electing a replacement from the in-sync set when a leader dies.",
        why: "Electing only from the in-sync set is what makes failover lossless: by construction those replicas hold everything up to the old high watermark, so nothing committed can be missing. The epoch is what lets a returning leader detect divergence and truncate to the first divergent epoch's start offset instead of trusting its own watermark, which is the KIP-101 fix.",
        numbers: [
          "failover in hundreds of ms under KRaft",
          "ControllerActiveCount must be exactly 1",
        ],
        breaks:
          "With unclean.leader.election.enable=true an out-of-sync replica can be promoted, silently truncating every record past its log-end-offset. On a payments topic that is a payment that vanished with no error.",
      },
    },

    // ----------------------------------------------------------------- read path
    {
      id: "e10",
      from: "pagecache",
      to: "fetchsvc",
      tier: "data",
      label: "hot segments from RAM",
      detail: {
        what: "The bytes a fetch actually returns, taken from the kernel buffer rather than from the device whenever the requested offset is recent.",
        why: "Consumers mostly read what was just written, so the common case never reaches a disk. That is what makes fan-out cost a sequential read that mostly hits RAM instead of a copy per subscriber.",
        numbers: ["local read <1ms", "~150MB/s read egress per broker"],
        breaks:
          "A consumer that lags out of the cached window turns a RAM read into a disk read, and that catch-up competes with replica fetches for exactly the same devices.",
      },
    },
    {
      id: "e11",
      from: "fetcher",
      to: "fetchsvc",
      tier: "data",
      label: "fetch(partition, offset)",
      detail: {
        what: "The pull: give me messages from this partition starting at this offset, with a bounded wait if there is nothing yet.",
        why: "The consumer names the position rather than being handed one, which is why replay is a smaller number in this request rather than a feature, and why the broker keeps no delivery state for anyone.",
        numbers: ["fetch.max.wait.ms=10, ~5ms average wait", "end to end ~20 to 50ms"],
        breaks:
          "A consumer that stops fetching costs the cluster one stale offset and nothing else, so lag is invisible to the broker and has to be alerted on from the outside.",
      },
    },
    {
      id: "e12",
      from: "fetchsvc",
      to: "fetcher",
      tier: "hot",
      label: "sendfile to socket",
      detail: {
        what: "The fetch response: log bytes piped from the segment file straight to the consumer's socket by sendfile(), never entering the JVM heap.",
        why: "This is what makes an extra consumer group nearly free. The same bytes are shipped to every reader with no per-subscriber copy, which is why fan-out costs a sequential read rather than a queue per consumer.",
        numbers: [
          "~150MB/s read egress per broker",
          "9GB/s cluster read at 3 groups per topic",
        ],
        breaks:
          "Consumers cannot be served past the high watermark, so a shrunken in-sync set stalls readers as well as writers.",
      },
    },

    // --------------------------------------------------------------- retention path
    {
      id: "e13",
      from: "retention",
      to: "objectstore",
      tier: "data",
      label: "closed segments uploaded",
      detail: {
        what: "Sealed segment files copied to object storage, after which local retention can delete them while they remain readable.",
        why: "It decouples how much history the topic keeps from how much disk each broker carries, which also stops a rebalance moving history it will never read.",
        numbers: ["~10x lower storage cost", "6.5TB local per broker instead of 92TB"],
        breaks:
          "If uploads stall, RemoteCopyLagBytes climbs and local disk fills behind it, so the alert has to fire well before the local retention boundary.",
      },
    },
    {
      id: "e14",
      from: "objectstore",
      to: "retention",
      tier: "data",
      label: "remote fetch if lagged",
      detail: {
        what: "A fetch that missed local retention falling through to object storage and being served back through the broker, transparently to the consumer's code.",
        why: "Reads resolve local-first, so the tier is invisible until a consumer lags past the boundary. Sizing local retention above the 99.9th percentile of lag is what keeps it that way.",
        numbers: ["50-200ms remote against <1ms local", "12h of local retention"],
        breaks:
          "Fetch latency jumps by two orders of magnitude precisely when a consumer is trying to catch up, so a lag incident gets slower to recover from the deeper it goes.",
      },
    },
    {
      id: "e15",
      from: "partitionlog",
      to: "mirror",
      tier: "control",
      label: "async copy, ~30% of topics",
      detail: {
        what: "Selected topics, and their consumer-group state, replicated to the peer region's cluster in the background.",
        why: "Only the topics with a consumer in the peer region are worth the egress, and the copy is asynchronous because a synchronous cross-region write would put tens of milliseconds inside every produce.",
        numbers: ["900MB/s sustained, 78TB/day", "~$47k/month at $0.02/GB", "RPO seconds to ~1min"],
        breaks:
          "Whatever has not been copied at the moment the region fails is the data loss, so this lag is the RPO. Nothing surfaces that except a mirror-lag metric somebody has to watch.",
      },
    },

    // ------------------------------------------------------------- consumer group
    {
      id: "e16",
      from: "fetcher",
      to: "processor",
      label: "poll() returns a batch",
      animated: true,
      detail: {
        what: "The records handed to application code, in offset order within each partition.",
        why: "Order is only defined inside one partition, so this batch is ordered for the key that hashed here and has no defined relation to anything on another partition.",
        numbers: ["each partition goes to exactly one consumer in the group"],
        breaks:
          "The loop stalls here, not in the broker. A slow processor shows up as consumer lag and as a session timeout if it outlasts the heartbeat.",
      },
    },
    {
      id: "e17",
      from: "processor",
      to: "committer",
      label: "only after the work lands",
      animated: true,
      detail: {
        what: "The handoff from finished work to the commit, in that order and never the reverse.",
        why: "This ordering is the delivery guarantee. Work first then commit is at-least-once; commit first then work is at-most-once, and there is nothing else in the system that distinguishes them.",
        numbers: ["replay window bounded by the 5s commit interval"],
        breaks:
          "A crash in between replays the batch. That is the intended failure and it is only harmless if the sink was idempotent.",
      },
    },
    {
      id: "e18",
      from: "processor",
      to: "dlq",
      tier: "control",
      label: "deterministic failures only",
      detail: {
        what: "An unprocessable record published to a separate topic so the consumer can commit past it and keep the partition moving.",
        why: "The cursor cannot skip a record without committing past it, so the record has to go somewhere first. This is the log's only answer to per-message failure.",
        numbers: ["track DLQ depth as an SLO", "one poison record blocks one partition"],
        breaks:
          "Sending retriable failures down here is the common mistake: a downstream outage dumps millions of good records into the dead-letter topic, out of order relative to the main one, and re-injecting them replays them against state that has already moved on.",
      },
    },
    {
      id: "e19",
      from: "committer",
      to: "offsets",
      tier: "hot",
      label: "commit(offset + 1)",
      detail: {
        what: "A commit written after processing, meaning everything up to offset N is done and the next poll should start at N+1.",
        why: "Keeping this in a Kafka topic rather than a side datastore means the position replicates and fails over exactly like the data it points into, with no second system in the hot path of every consumer.",
        numbers: ["20k commits/s cluster-wide", "every 5s per consumer instance", "64B per row"],
        breaks:
          "Commit first and a crash silently skips work. There is no error and no metric; the gap only shows up in whatever downstream state was supposed to change.",
      },
    },
    {
      id: "e20",
      from: "fetcher",
      to: "coordinator",
      tier: "control",
      label: "heartbeat, join, leave",
      detail: {
        what: "Group membership traffic: heartbeats on a session timeout, plus explicit joins and leaves that trigger a reassignment.",
        why: "Partition ownership must be exclusive, so somebody has to decide it centrally. Heartbeats are how a dead consumer is distinguished from a slow one, badly, on a timeout.",
        numbers: ["session.timeout.ms above your GC pauses"],
        breaks:
          "A GC pause longer than the session timeout looks exactly like a death, so the group rebalances around a consumer that is about to come back and do it again.",
      },
    },
    {
      id: "e21",
      from: "coordinator",
      to: "offsets",
      tier: "control",
      label: "resume from committed",
      detail: {
        what: "The new owner of a partition reading the group's committed offset to find out where to start.",
        why: "This is why a rebalance is survivable at all: ownership moves, but the position does not travel with the consumer, it is looked up. Any records processed after the last commit are simply redone.",
        numbers: ["one 64B row per (group, topic, partition)"],
        breaks:
          "Everything between the last commit and the revocation is reprocessed, so a rebalance replays records and a non-idempotent sink turns that into a duplicate side effect.",
      },
    },
  ],
};
