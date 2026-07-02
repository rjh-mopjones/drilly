---
type: interview-prep
---

# Cassandra Interview Primer — 336 Questions

Comprehensive Q+A primer for Apache Cassandra / distributed-NoSQL interviews. A Databases-category companion to the Postgres and DB Theory primers — but a different world: masterless architecture, the token ring, tunable consistency, LSM storage, and query-first data modeling. Covers the architecture, partitioning & replication, consistency, CQL & data modeling, primary keys & partition design, the write/read paths, SSTables & compaction, tombstones, repair, advanced types & indexing, LWT & batches, time-series patterns, operations, tuning, multi-DC, the 4.x/5.0 ecosystem & alternatives, and data-modeling playbooks.

Each answer is interview-shaped: opinionated, concrete, real CQL and `nodetool`, storage internals, failure modes, and the data-modeling anti-patterns that sink real clusters. Current Cassandra (4.x/5.0 — SAI, ACC, UCS); ScyllaDB & Astra noted; contrasts with relational/DynamoDB where it clarifies.

1. [[#Cassandra Fundamentals & Architecture]]
2. [[#Data Distribution & Partitioning]]
3. [[#Replication & Topology]]
4. [[#Tunable Consistency]]
5. [[#The Data Model & CQL]]
6. [[#Query-First Data Modeling]]
7. [[#Primary Keys, Partition & Clustering Columns]]
8. [[#Partition Design & Anti-patterns]]
9. [[#The Write Path]]
10. [[#The Read Path]]
11. [[#Storage Engine: SSTables & Compaction]]
12. [[#Tombstones, Deletes & TTL]]
13. [[#Repair & Anti-Entropy]]
14. [[#Advanced Data Types & Indexing]]
15. [[#Lightweight Transactions & Batches]]
16. [[#Time-Series & Common Modeling Patterns]]
17. [[#Cluster Operations]]
18. [[#Performance Tuning & Monitoring]]
19. [[#Multi-DC, Availability & Failure Handling]]
20. [[#Cassandra 4.x/5.0, Ecosystem & Alternatives]]
21. [[#Scenario & Data-Modeling Playbooks]]

---

## Cassandra Fundamentals & Architecture

### Summary

**What this topic covers**

The starting point of every Cassandra interview: what kind of database this actually is, why it was built the way it was, and the single architectural decision that defines everything else — there is **no master**. Three concern areas live here: (1) the **shape of the database** — a masterless, peer-to-peer, distributed, wide-column NoSQL store, and what each of those words buys you; (2) the **lineage and the CAP tradeoff** — Cassandra is Amazon Dynamo's distribution model welded onto Google Bigtable's storage model, and it deliberately chooses **availability + partition tolerance (AP)** with **tunable consistency**; and (3) the **operational promise** — linear horizontal scale, relentless write throughput, no single point of failure, and multi-datacenter geo-distribution as a first-class feature. The 16 questions here are the warm-up round, but they encode the mental shift the rest of the primer depends on: Cassandra is not a relational database with a different query language, it is a different set of tradeoffs. Get the "masterless" idea wrong and every later topic — partitioning, replication, consistency, data modeling — will feel arbitrary instead of inevitable.

**Mental model**

Picture a ring of identical nodes, each one able to answer any request. There is no primary, no config server, no leader election, no node that is more important than any other. A client connects to *any* node, and that node becomes the **coordinator** for that request — it figures out which nodes own the data and talks to them. Nodes constantly **gossip** their state to each other, so the cluster has a shared, eventually-consistent picture of who is up, who owns what, and who is joining or leaving. This is the deep contrast with primary-replica systems (Postgres streaming replication, MongoDB replica sets) where writes must funnel through one elected primary — lose that primary and you stall until a new one is elected. In Cassandra there is nothing to elect and nothing to fail over to, because every node already does the same job. That symmetry is why Cassandra can promise "always on": you can lose nodes, racks, or a whole datacenter and the survivors keep serving. The cost of that symmetry is that Cassandra gives up the things a single coordinator makes easy — joins, multi-row ACID transactions, and strong consistency by default. You trade rich queries for availability and scale.

**Key terms**

- **Masterless / peer-to-peer** — every node is functionally identical; no primary, leader, or config server. Removes the single point of failure.
- **Wide-column** — a partition holds many rows keyed by clustering columns; rows are sparse (missing columns cost nothing). Not a document store, not a key-value store.
- **Coordinator** — the node a client connects to for a given request; it routes to the replicas and returns the result. Any node can coordinate.
- **Replica** — a node that actually stores a copy of a given partition. Determined by the token ring + replication factor.
- **Gossip** — the peer-to-peer protocol nodes use to exchange membership and state a few times per second.
- **Token ring** — the logical ring of hash values around which partitions are distributed; each node owns ranges of it.
- **Keyspace** — the top-level namespace (like a database/schema), where replication settings are defined. Contains tables.
- **AP system** — in CAP terms, Cassandra favors Availability and Partition tolerance over strong Consistency.
- **Tunable consistency** — you choose per-query how many replicas must respond, trading latency/availability against consistency.
- **CQL** — Cassandra Query Language; SQL-like syntax over the wide-column model. The modern interface (replaced the old Thrift API).
- **Dynamo + Bigtable** — Cassandra's two ancestors: Dynamo for distribution, Bigtable for on-disk storage.

**Why interviewers ask this**

These questions separate people who have *operated* Cassandra from people who have only read that it's "NoSQL." A junior answer is "it's a NoSQL database, it's fast and scalable." A senior answer names the tradeoff out loud: masterless means no single point of failure and easy horizontal scale, but it costs you ACID transactions, joins, and strong-consistency-by-default, so you only reach for Cassandra when write volume and availability matter more than query flexibility. Interviewers also probe whether you know *when not to* use it — reaching for Cassandra to store 10,000 rows you want to run ad-hoc analytics on is a design smell. The strongest signal is being able to place Cassandra in the CAP triangle and immediately qualify it: "AP, but with tunable consistency, so I can dial toward CP per query when I need to."

**Common confusions**

- "Cassandra is a document database like MongoDB" — no. It's wide-column; a partition holds rows, not JSON documents, and there is no master node.
- "NoSQL means no schema" — Cassandra tables have a defined schema with typed columns; it's "not relational," not "not structured."
- "Cassandra is always eventually consistent" — consistency is tunable per query; QUORUM+QUORUM gives you strong consistency when you want it.
- "It's just a faster relational database" — it can't do joins, has no cross-partition ACID by default, and forbids ad-hoc queries. Different paradigm.
- "AP means it loses data during a partition" — it stays available and reconciles later via read repair / hinted handoff / repair; it doesn't silently drop acknowledged writes.

**What follows from this topic**

Everything. The masterless ring you meet here is drawn out concretely in **Data Distribution & Partitioning** (how the token ring and consistent hashing actually place data), then in **Replication & Topology** (how many copies exist and where they go), and finally in the consistency topics (how tunable consistency turns an AP system into "CP when you need it"). The write-optimized claim previewed here — very fast writes — is cashed out in the storage-engine topics (commit log, memtable, SSTable, LSM tree, compaction). Hold onto one sentence: *masterless, wide-column, AP with tunable consistency, query-first modeling.* The rest of the primer is that sentence in detail.

### Q1. What kind of database is Cassandra, in one sentence?

Apache Cassandra is a **masterless, peer-to-peer, distributed, wide-column NoSQL database** designed for high write throughput, linear horizontal scalability, and continuous availability across multiple datacenters.

Unpack the load-bearing words:

- **Masterless / peer-to-peer** — every node is equal; there is no primary, leader, or config server, so no single point of failure.
- **Distributed** — data is partitioned and replicated across many nodes automatically.
- **Wide-column** — data lives in partitions that hold rows keyed by clustering columns; it is not a document or key-value store.
- **NoSQL** — no joins, no cross-partition ACID by default; you model tables around queries, not entities.

The one-sentence answer interviewers actually want ends with the tradeoff: *"...which makes it an AP system with tunable consistency — it trades relational query flexibility and strong-consistency-by-default for availability and scale."*

### Q2. What does "masterless" mean and why does it matter?

**Masterless** means every node in the cluster performs the same role. There is no primary node, no elected leader, and no separate config/metadata server. Any node can accept any read or write and act as the **coordinator** for that request.

Why it matters:

- **No single point of failure.** There is no special node whose loss stalls the cluster. Lose a node — even several — and the survivors keep serving.
- **No failover latency.** Primary-replica systems must detect a dead primary and elect a new one, a window during which writes stall. Cassandra has nothing to elect.
- **Uniform operations.** Every node is provisioned and configured identically, which simplifies scaling and automation.
- **Linear scale-out.** Adding capacity is just adding more identical nodes; there is no master to become a bottleneck.

The cost of symmetry is the absence of a coordinator-of-record that could cheaply enforce global invariants — hence no joins, no multi-partition ACID by default, and eventual (but tunable) consistency.

### Q3. How does Cassandra differ from a primary-replica system like Postgres or a MongoDB replica set?

| | Cassandra (masterless) | Primary-replica (Postgres / MongoDB) |
|---|---|---|
| Write target | Any node (coordinator) | Only the primary |
| On primary failure | N/A — no primary | Elect new primary; writes stall meanwhile |
| Scaling writes | Add nodes; writes spread | Primary is the write bottleneck; scale up or shard |
| Topology | Ring of equal peers | Tree: one primary, many replicas |
| Consistency default | Tunable, often eventual | Strong on the primary |
| Multi-DC | First-class, active-active | Bolt-on, usually active-passive |

The key contrast: primary-replica systems route all writes through one node, which is a natural bottleneck and a failover risk. **Sharded-with-a-master** systems (e.g. a MongoDB sharded cluster with config servers and per-shard primaries) spread writes across shards but still have a primary per shard and dedicated config servers — more moving parts, more special nodes. Cassandra has none of that: writes spread across the ring and every node is interchangeable.

### Q4. What does "wide-column" mean? How is it different from a document or key-value store?

**Wide-column** means data is organized into **partitions**, and each partition can hold many **rows** keyed by **clustering columns**. Within a partition, rows are stored contiguously and sorted by the clustering columns, and every row is **sparse** — a column that has no value for a row costs essentially nothing.

Contrast:

- **Key-value store** (Redis, DynamoDB-as-KV): one key → one opaque blob. Cassandra's partition is richer — it's a key → an ordered, queryable collection of rows.
- **Document store** (MongoDB): one key → one nested JSON document. Cassandra rows are flat, typed, columnar, and grouped into partitions you can range-scan by clustering column.
- **Relational**: normalized tables joined at query time. Cassandra denormalizes and forbids joins.

```cql
-- A wide partition: all messages for one conversation, ordered newest-first
CREATE TABLE messages_by_conversation (
  conversation_id uuid,      -- partition key: which node/partition
  sent_at         timeuuid,  -- clustering column: order within partition
  sender          text,
  body            text,
  PRIMARY KEY (conversation_id, sent_at)
) WITH CLUSTERING ORDER BY (sent_at DESC);
```

Here one `conversation_id` partition holds many message rows sorted by time — the "wide" part. The heritage is Bigtable's column families; modern CQL presents it as rows, but the on-disk model is still partition-of-columns.

### Q5. Where did Cassandra come from? What are its two ancestors?

Cassandra fuses two 2000s-era papers:

- **Amazon Dynamo (2007)** — contributed the **distribution and availability** model: consistent hashing on a token ring, replication, tunable consistency, gossip-based membership, and "always writable" design. This is the *how do we spread data and stay up* half.
- **Google Bigtable (2006)** — contributed the **storage and data model**: the wide-column / column-family layout, the log-structured merge (LSM) write path (commit log → memtable → SSTable), and sorted on-disk storage. This is the *how do we store and lay out data on disk* half.

Cassandra was created at Facebook (for inbox search), open-sourced in 2008, and became an Apache top-level project. The one-liner interviewers like: **"Dynamo for distribution, Bigtable for storage."** That fusion explains its personality — Dynamo-style availability with Bigtable-style write-optimized columnar storage.

### Q6. Where does Cassandra sit in the CAP theorem, and why?

Cassandra is an **AP** system: under a network **partition**, it favors **Availability** and **Partition tolerance** over strong **Consistency**. When nodes can't all talk to each other, Cassandra keeps accepting reads and writes on whichever replicas are reachable, and reconciles later (read repair, hinted handoff, anti-entropy repair).

But the important nuance — and the senior answer — is **tunable consistency**. CAP is not a permanent label baked into the database; Cassandra lets you choose per query how many replicas must acknowledge:

- Read at `ONE`, write at `ONE` → maximally available, eventually consistent.
- Read at `QUORUM`, write at `QUORUM` (so **R + W > RF**) → strong consistency, at the cost of availability if too many replicas are down.

So Cassandra defaults to AP but lets you slide individual queries toward CP. The honest framing: *"AP with tunable consistency; I choose the point on the spectrum per operation."*

**PACELC** extends this: *if Partitioned, choose A or C; Else (normal operation) choose Latency or Consistency.* Cassandra is **PA/EL** — favors availability under partition, and favors latency (low consistency) in normal operation — but tunable knobs let you push toward C.

### Q7. What are Cassandra's core design goals?

- **Linear horizontal scalability** — double the nodes, roughly double the throughput and capacity, with no rewrite.
- **High write throughput** — the LSM write path (append to commit log + memtable) makes writes cheap; no read-before-write, no in-place updates.
- **Continuous availability / no downtime** — masterless design means no single point of failure; you can add/remove/replace nodes and do rolling upgrades live.
- **Geo-distribution** — multi-datacenter replication is first-class, enabling low-latency local reads and disaster recovery.
- **Tunable consistency** — per-query control over the consistency/availability/latency tradeoff.
- **Operational simplicity at scale** — every node is identical; scaling is "add more of the same."

These goals are why the model is restrictive: joins, ad-hoc queries, and global transactions are exactly the features that don't scale linearly or survive partitions, so Cassandra drops them.

### Q8. What is gossip in Cassandra?

**Gossip** is the peer-to-peer protocol nodes use to share cluster state. Roughly once per second, each node picks a few other nodes and exchanges what it knows: which nodes are up or down, their tokens (what data they own), their schema version, load, and status (joining, leaving, normal).

Key properties:

- **Decentralized** — no coordinator broadcasts state; knowledge spreads epidemically, and the whole cluster converges quickly.
- **Failure detection** — gossip feeds a **phi accrual failure detector** that decides when a node is probably down (based on how overdue its heartbeats are), rather than a hard timeout.
- **Seed nodes** — new nodes contact configured **seed** nodes to bootstrap into the gossip network. Seeds are just well-known entry points, not masters.

Gossip is *how* a masterless cluster maintains a shared picture of itself without any central authority — it's the connective tissue under the token ring.

### Q9. Explain the node / cluster / datacenter / keyspace / table hierarchy.

From the outside in:

- **Cluster** — the whole deployment: all nodes that gossip together and share the token ring.
- **Datacenter (DC)** — a logical group of nodes, usually mapping to a physical region or availability zone. Replication and consistency can be scoped per DC (`LOCAL_QUORUM`, RF per DC).
- **Rack** — a failure/latency domain within a DC; replicas are spread across racks so one rack failure doesn't lose a partition.
- **Node** — a single Cassandra instance owning ranges of the token ring.
- **Keyspace** — the top-level data namespace (like a schema/database). Replication strategy and RF are defined here, per DC.
- **Table** — a set of rows with a defined schema and a primary key (partition key + clustering columns), living inside a keyspace.

```cql
CREATE KEYSPACE app WITH replication =
  {'class': 'NetworkTopologyStrategy', 'dc1': 3, 'dc2': 3};

CREATE TABLE app.users_by_id (id uuid PRIMARY KEY, name text, email text);
```

### Q10. When should you use Cassandra?

Reach for Cassandra when you have several of these:

- **Very high write volume** — ingest that would overwhelm a single primary (telemetry, clickstream, IoT, event logs).
- **Time-series / append-heavy data** — sensor readings, metrics, messaging/chat history, activity feeds.
- **Always-on requirement** — you cannot tolerate downtime or a failover window; you need to survive node/rack/DC loss.
- **Multi-datacenter** — global users needing low-latency local reads, or active-active DR.
- **Scale beyond one machine** — data or throughput that no single server can hold, where you want to scale by adding commodity nodes.
- **Known, predictable query patterns** — you can design tables around a fixed set of access patterns.

The classic fits: messaging, activity feeds, fraud/event pipelines, product catalogs at scale, time-series/IoT platforms.

### Q11. When should you NOT use Cassandra?

Avoid Cassandra when you need:

- **ACID transactions across rows/tables** — banking-style multi-entity atomic updates. (LWT gives single-partition compare-and-set only, and it's slow.)
- **Joins and normalized relational modeling** — Cassandra has no joins; you'd denormalize everything.
- **Ad-hoc / analytical queries** — arbitrary `WHERE`/`GROUP BY`/aggregations on non-key columns. `ALLOW FILTERING` is a red flag, not a feature.
- **Strong consistency by default** with read-your-writes everywhere cheaply.
- **Small data** — if it fits comfortably on one Postgres box, Cassandra's operational overhead isn't worth it.
- **Rapidly changing / unknown query patterns** — Cassandra makes you commit to access patterns up front; exploratory querying fights the model.

The honest interview answer: *"For most CRUD apps with modest data and rich queries, use Postgres. Cassandra earns its keep at write-heavy, always-on, horizontally-scaled workloads with known access patterns."*

### Q12. How does Cassandra compare to a relational database at a high level?

| | Relational (Postgres/MySQL) | Cassandra |
|---|---|---|
| Data model | Normalized tables, joins | Denormalized, one table per query |
| Query style | Ad-hoc SQL, any predicate | Fixed patterns; query by key |
| Transactions | Multi-row ACID | Single-partition LWT only; no cross-partition ACID by default |
| Consistency | Strong by default | Tunable, eventual by default |
| Scaling | Vertical, or manual sharding | Horizontal, built-in |
| Topology | Primary-replica | Masterless ring |
| Failure | Failover window | No single point of failure |
| Modeling driver | The data (entities/relations) | The queries (access patterns) |

The paradigm shift: in relational you model the *data* and figure out queries later; in Cassandra you model the *queries* and denormalize the data to serve them. This "query-first modeling" is developed fully in the data-modeling topics — it's the single biggest adjustment for relational engineers.

### Q13. Why is Cassandra described as "write-optimized"?

Because a write never has to read first and never modifies data in place. The write path is:

1. Append the mutation to the **commit log** (sequential disk write, for durability).
2. Apply it to the in-memory **memtable**.
3. Acknowledge the client.

That's it — two fast, append-only operations, no random-access disk seeks, no read-modify-write. Later, memtables **flush** to immutable **SSTables** on disk, and background **compaction** merges SSTables. This is a **log-structured merge (LSM) tree**, and it's why Cassandra sustains enormous write rates.

The tradeoff shows up on reads: a single row may be spread across the memtable and several SSTables, so a read may have to merge multiple sources (mitigated by bloom filters, partition indexes, and caches). Cassandra optimizes the write path and pays some of it back on reads — the opposite of a B-tree database that does in-place updates. This is previewed here and detailed in the storage-engine topics.

### Q14. What is a coordinator node?

The **coordinator** is whichever node a client happens to connect to for a given request. It's not a special role — *any* node coordinates whatever requests land on it. Its job for one request:

1. Hash the partition key to a token, determine the replica set for that partition.
2. Forward the read/write to the appropriate replicas (honoring the requested **consistency level**).
3. Wait for enough replica acknowledgments to satisfy the consistency level.
4. Perform read repair / store hints as needed, and return the result to the client.

Because any node can coordinate, smart drivers use **token-aware** routing — they connect directly to a node that owns the data, so the coordinator is also a replica and one network hop is saved. The coordinator concept is the practical face of "masterless": leadership is per-request and ephemeral, not a fixed office.

### Q15. What are the managed and compatible alternatives to running Cassandra yourself?

- **DataStax Astra** — managed Cassandra-as-a-service (serverless, pay-per-use), removing the operational burden of running your own cluster. Same CQL/data model.
- **ScyllaDB** — a from-scratch **C++** rewrite of Cassandra (no JVM, shard-per-core architecture, its own tuning), wire- and CQL-compatible. Aims for much lower latency and higher per-node throughput; a drop-in-ish alternative when JVM GC pauses or per-node efficiency are pain points.
- **Amazon Keyspaces** — AWS's managed, Cassandra-compatible (CQL) service.
- **Cloud DynamoDB** — not Cassandra, but a close cousin (also Dynamo-descended); managed, similar distribution model, different API and pricing.

Interview-relevant contrast: Cassandra (and Astra) run on the **JVM**, so GC tuning and heap management are real operational concerns; **ScyllaDB** sidesteps that with C++ and its shard-per-core design, which is why it's the go-to name when someone says "Cassandra but faster / no GC pauses."

### Q16. What are Cassandra's high-level components in a single request?

For a read or write, the pieces in play:

- **Client driver** — connects to the cluster, ideally **token-aware** so it routes to a node owning the data.
- **Coordinator** — the node handling this request; routes to replicas per the consistency level.
- **Token ring + partitioner** — maps the partition key → token → owning nodes.
- **Replicas** — the RF nodes actually storing the partition, chosen by the replication strategy across racks/DCs.
- **Gossip + snitch** — keep every node's view of membership and topology current so the coordinator routes correctly.
- **Storage engine per node** — commit log, memtable, SSTables, bloom filters, caches (the LSM machinery).

The mental picture: *client → coordinator → (token ring says which replicas) → replicas answer → coordinator reconciles → client.* No master appears anywhere in that flow — which is the whole point.

## Data Distribution & Partitioning

### Summary

**What this topic covers**

How Cassandra decides *which node stores which data* — the mechanics under the masterless ring. Three concern areas: (1) the **placement mechanism** — consistent hashing on a token ring, the partitioner that hashes partition keys into 64-bit tokens, and how nodes own token ranges; (2) **virtual nodes (vnodes)** — why each physical node owns many small ranges instead of one big one, and the balance/rebuild/repair tradeoffs; and (3) the **consequences of key choice** — why the partition key single-handedly determines data placement, load balance, and whether you get even distribution or hot nodes. The 17 questions here turn the abstract "ring of equal nodes" from the previous topic into a concrete, walk-through-able system: partition key → hash → token → owning node(s). This is also where the seeds of the most common production disasters are planted — hot partitions and unbalanced load both start with a bad partition key, and every one of them traces back to how distribution works. Nail this and replication (next topic) and data modeling (later) both become obvious.

**Mental model**

Imagine the full range of a 64-bit hash laid out as a circle — the **token ring**, from roughly −2⁶³ to +2⁶³, wrapping around. Every node is assigned positions (tokens) on this ring, which carve it into arcs; each node **owns** the arc of token values from the previous node's token up to its own. To place a row, Cassandra takes its **partition key**, runs it through the **partitioner** (Murmur3 by default) to get a token, then walks **clockwise** to find the first node whose range contains that token — that's the primary replica, and the next RF−1 nodes clockwise hold the other copies. The crucial insight is that the token is a *hash*, so partition keys are scattered pseudo-randomly around the ring regardless of their real-world values — sequential IDs don't cluster on one node. **Consistent hashing** is what makes this elastic: when a node joins or leaves, only the arcs adjacent to it are reassigned, so the vast majority of data doesn't move. **Vnodes** refine this by giving each physical node many small arcs scattered around the ring instead of one contiguous slice, which smooths out balance and speeds up rebuilds. Everything downstream — load, hotspots, scalability — is a consequence of this ring geometry.

**Key terms**

- **Consistent hashing** — hashing scheme where adding/removing a node reshuffles only neighboring key ranges, not the whole dataset.
- **Token ring** — the circular space of 64-bit token values around which partitions are distributed.
- **Token** — a 64-bit value; the hash of a partition key, and also the boundary markers nodes own.
- **Partitioner** — the function hashing partition keys to tokens. **Murmur3Partitioner** is the modern default.
- **Token range** — a contiguous arc of the ring `(previous_token, this_token]` owned by a node.
- **Primary replica** — the first node clockwise from a partition's token; the "natural" first owner.
- **Virtual node (vnode)** — one of many small token ranges a single physical node owns; controlled by `num_tokens`.
- **Partition key** — the part of the primary key that's hashed to a token; determines which node/partition stores the row.
- **Composite partition key** — a partition key made of multiple columns, hashed together as one unit.
- **Data locality** — all rows sharing a partition key live together on the same replicas, enabling fast single-partition reads.
- **Hot partition** — a partition receiving disproportionate traffic because of a low-cardinality or skewed partition key.
- **`nodetool ring` / `getendpoints`** — tools to inspect token ownership and which nodes hold a given key.

**Why interviewers ask this**

Partitioning is where "I've read about Cassandra" and "I've debugged Cassandra at 3am" diverge. A junior candidate says "it distributes data across nodes." A senior candidate can trace a specific key to its node, explain *why* a monotonic or low-cardinality partition key creates a hotspot, and connect that to the LSM/read-latency problems it causes downstream. Interviewers use these questions to test whether you understand that **the partition key is the single most important schema decision in Cassandra** — it decides both correctness (can this query be served by one partition?) and performance (is load even, or is one node melting?). They also probe vnodes to see if you understand real operational tradeoffs (rebuild speed vs repair overhead vs availability), which only shows up once you've actually scaled a cluster.

**Common confusions**

- "The partitioner preserves key order, so I can range-scan across partitions" — no. Murmur3 hashes keys, so ordering is destroyed; you cannot efficiently scan a range of partition keys.
- "More vnodes is always better" — higher `num_tokens` improves balance but hurts repair and availability; modern guidance is a *lower* count (e.g. 16, or 8 with the newer allocation algorithm), not the old default of 256.
- "Adding a node rebalances the whole cluster" — consistent hashing means only ranges adjacent to the new node move; most data stays put.
- "The partition key must be a single column" — it can be composite (multiple columns hashed together).
- "Choosing a random/UUID partition key is best because it's even" — even distribution is necessary but not sufficient; you also need queries to target single partitions, so the key must match your access pattern.

**What follows from this topic**

The token ring you place data on here is exactly what **Replication & Topology** builds on — replica selection is "walk clockwise from the token, skipping to satisfy rack/DC rules." The hot-partition and large-partition risks introduced here become the performance and anti-pattern topics later (why p99 latency spikes, why the queue pattern is forbidden). And the "partition key determines everything" theme drives the entire data-modeling section, where you'll choose partition keys to make each query hit exactly one partition. If you remember one thing: *partition key → Murmur3 token → owning node, and that choice fixes both where data lives and how evenly load spreads.*

### Q1. How does Cassandra decide which node stores a given row?

It hashes the row's **partition key** to a **token**, then finds the node that owns that token on the **ring**.

Concretely:

1. Extract the partition key from the primary key.
2. Run it through the **partitioner** (Murmur3 by default) → a 64-bit **token**.
3. Walk **clockwise** around the token ring to the first node whose token range contains that token — that node is the **primary replica**.
4. The next RF−1 nodes clockwise (respecting topology rules) hold the additional replicas.

```cql
PRIMARY KEY ((user_id), created_at)
--            ^^^^^^^  partition key -> hashed to a token -> owning node(s)
```

Because it's a hash, the real-world value of the key is irrelevant to placement — `user_id = 1` and `user_id = 2` land in unrelated spots on the ring. The coordinator does this computation on every request to route it.

### Q2. What is consistent hashing and why does Cassandra use it?

**Consistent hashing** maps both keys and nodes onto the same circular hash space, and a key belongs to the first node clockwise from its position. Its defining property: when a node is added or removed, **only the keys in the ranges adjacent to that node move** — everything else stays put.

Contrast with naive **modulo hashing** (`node = hash(key) % N`): if `N` changes because you added or removed a node, *almost every key* remaps to a different node, forcing a full reshuffle of the dataset. That's catastrophic at scale.

```
Ring (clockwise). Adding node D only steals a slice from its neighbor:

   before:  A ---- B ---- C ---- (wrap)
   after:   A -- D - B ---- C ---- (wrap)
            only keys between A and D moved; B and C untouched
```

For an elastic, always-on system that grows by adding commodity nodes, minimizing data movement on membership change is essential — hence consistent hashing.

### Q3. What is the partitioner, and which one should you use?

The **partitioner** is the hash function that turns a partition key into a token.

- **Murmur3Partitioner** — the default since Cassandra 1.2. Fast, produces well-distributed 64-bit tokens. Use this.
- **RandomPartitioner** — legacy; MD5-based, 127-bit tokens. Slower, kept for backward compatibility.
- **ByteOrderedPartitioner** — legacy and **dangerous**: it orders tokens by the raw bytes of the key instead of hashing. That *does* let you range-scan partition keys, but it causes severe **hotspots** (sequential or clustered keys pile onto adjacent nodes) and load imbalance. Effectively deprecated; don't use it.

The partitioner is a cluster-wide setting and cannot be changed after the cluster is created. The interview point: ordered partitioners look tempting because they enable range scans across partitions, but the hotspot cost is why the community abandoned them — hashed distribution (Murmur3) is the right default.

### Q4. What are tokens and token ranges?

A **token** is a 64-bit integer. It plays two roles:

1. It's the **hash of a partition key** (what the partitioner computes).
2. It's a **boundary marker** assigned to nodes; each node's token(s) define where its ownership ends on the ring.

A **token range** is the arc `(previous_node_token, this_node_token]` — the contiguous set of token values a node owns. A partition whose key hashes into that range lives on that node (as primary replica).

```
Ring tokens:   ... N1=100 ...... N2=500 ...... N3=900 ... (wrap)
key hashes to token 640  ->  falls in (500, 900]  ->  owned by N3 (primary)
```

The **primary replica** for a partition is simply the first node clockwise from the partition's token — the node whose range the token falls into. Additional replicas continue clockwise.

### Q5. What are virtual nodes (vnodes) and why do they exist?

A **virtual node (vnode)** is one of many small token ranges a single physical node owns. Instead of each node owning one big contiguous arc of the ring, with vnodes each node owns many small arcs scattered around the ring. The `num_tokens` setting controls how many.

Why vnodes were introduced:

- **Better balance** — many small random ranges even out ownership far better than one range per node, especially with heterogeneous or small clusters.
- **Faster bootstrap/rebuild** — when a node joins or is replaced, its many small ranges can be streamed **from many source nodes in parallel**, instead of streaming one huge range from one or two neighbors.
- **Less hotspotting on topology change** — losing a node spreads its load across many nodes (the many peers who share its scattered ranges), rather than dumping it all on one neighbor.

Before vnodes, operators manually computed and assigned single tokens per node — tedious and error-prone. Vnodes automate balanced distribution.

### Q6. What's the tradeoff with vnodes, and what's the modern guidance on num_tokens?

More vnodes = better balance, but there are real costs:

- **Repair overhead** — repair works per token range (Merkle trees per range); more ranges = more repair work and coordination.
- **Availability math** — with many vnodes, each physical node shares ranges with many others, so as the cluster grows the probability that *some* set of replica nodes overlap on a range (and a multi-node failure loses a partition) increases.
- **Streaming/coordination overhead** — more ranges to track.

The old default was `num_tokens = 256`, which prioritized balance but hurt repair and availability. **Modern guidance** (Cassandra 4.0+) is a **much lower count** — commonly `num_tokens = 16`, or even `8` when using the newer **token allocation algorithm** (`allocate_tokens_for_keyspace` / `allocate_tokens_for_local_replication_factor`), which achieves good balance with far fewer tokens. Fewer vnodes = better repair and availability with only slightly worse balance, which is the right trade at scale.

### Q7. Walk through a concrete partition-key-to-node mapping.

Say a 3-node cluster with these (simplified) tokens and RF=3:

```
N1 owns up to token 100
N2 owns up to token 500
N3 owns up to token 900  (then wraps to N1)
```

Insert a row with `user_id = 'alice'`:

1. `Murmur3('alice')` → some 64-bit token, say it lands at **640**.
2. Walk clockwise: 640 falls in `(500, 900]` → **N3 is the primary replica**.
3. RF=3, so the next two nodes clockwise also store it → N1 (wrap), N2. All three hold `alice`.

Now `user_id = 'bob'` → `Murmur3('bob')` = say **120** → falls in `(100, 500]` → **N2 primary**, then N3, N1.

Notice `alice` and `bob` land on unrelated primaries even though they're "adjacent" alphabetically — the hash scatters them. That scattering is what gives even load; it's also why you can't range-scan `user_id` values.

### Q8. Why does the partition key choice determine load balance?

Because the partition key is the *only* input to placement — the token is `hash(partition_key)`. So the distribution of your partition keys is the distribution of your load.

- **Good key (high cardinality, even access):** e.g. `user_id`. Millions of distinct values hash uniformly around the ring → data and traffic spread evenly across nodes.
- **Bad key (low cardinality):** e.g. `country` with 10 values → only 10 tokens, so at most 10 partitions, piling enormous data and traffic onto a few nodes = **hot partitions** and idle nodes.
- **Bad key (skewed access):** even with many values, if one value is hammered (a celebrity `user_id`, a `status='pending'` bucket), that single partition's node melts while others sit idle.

Even distribution requires a partition key that is both **high cardinality** and **evenly accessed**. This is why partition-key selection is the highest-leverage schema decision — get it wrong and no amount of hardware saves you.

### Q9. What's the difference between a single and a composite partition key?

A **single** partition key hashes one column to the token. A **composite (compound) partition key** hashes **multiple columns together as one unit** to a single token.

```cql
-- Single partition key
PRIMARY KEY ((sensor_id), reading_time)

-- Composite partition key: (sensor_id, day) hashed TOGETHER
PRIMARY KEY ((sensor_id, day), reading_time)
```

Note the **double parentheses** — that's what groups columns into a composite partition key. Without them, only the first column is the partition key and the rest become clustering columns.

Why use composite:

- **Bucketing to bound partition size** — adding `day` splits an otherwise-unbounded per-sensor partition into one-per-day partitions, preventing huge partitions.
- **Distribution** — combining columns increases cardinality and spreads load.

The catch: to read, you must supply **all** columns of the composite partition key (you can't query by `sensor_id` alone once `day` is part of the partition key) — the hash needs every component.

### Q10. What happens to data placement when you add or remove a node?

Thanks to consistent hashing, only the ranges **adjacent** to the change move:

- **Adding a node:** the new node is assigned tokens (its vnodes) and takes over those ranges from the current owners. During **bootstrap**, it streams exactly the data for those ranges from the existing replicas. With vnodes, its many small ranges stream from many nodes in parallel → faster, more even. Most of the cluster's data doesn't move.
- **Removing a node** (`nodetool decommission`): its ranges are reassigned to the nodes that will now own them, and it streams its data to them before leaving. `nodetool removenode` handles a node that's already dead (data is reconstructed from other replicas).

This is the elastic scaling story: growth and shrinkage touch only neighboring ranges, so you can scale a live cluster with minimal data movement and no downtime — a direct payoff of consistent hashing.

### Q11. How does the coordinator know which replicas to contact?

The coordinator computes it locally — no lookup service needed. It has, via **gossip**, an up-to-date map of every node's tokens and every node's DC/rack (from the **snitch**). For a request it:

1. Hashes the partition key → token.
2. Determines the primary replica (first node clockwise) and the full replica set (next RF−1 clockwise, honoring the replication strategy's rack/DC rules).
3. Routes the request to the appropriate replicas for the consistency level.

Because every node has this map, **any** node can route correctly — that's the masterless property. Smart drivers replicate the token map client-side (**token-aware routing**) and connect directly to a replica, so the coordinator is itself an owner and a hop is saved. There's no central directory — placement is computable from the ring + topology that gossip keeps synchronized.

### Q12. How do you inspect token ownership and find which nodes hold a key?

```bash
# Show the full ring: tokens and owning nodes
nodetool ring

# Ownership percentage per node for a keyspace (accounts for RF)
nodetool status app

# Which nodes are the replicas for a specific partition key?
nodetool getendpoints app users_by_id alice
```

`nodetool ring` lists every token and its owner (verbose with vnodes — many rows per node). `nodetool status` gives a compact per-node view with ownership %. `getendpoints` is the direct answer to "where does *this* key live?" — it prints the IPs of the replicas, which is invaluable when diagnosing a hot node or verifying replica placement.

### Q13. How do racks and datacenters factor into data placement?

Placement isn't purely "next N nodes clockwise" — with **NetworkTopologyStrategy**, replica selection walks the ring but **skips nodes to satisfy topology rules**, trying to place each replica on a **distinct rack** within each datacenter. The **snitch** tells Cassandra which DC and rack each node belongs to.

The goal is **failure isolation**: if all RF replicas landed in the same rack and that rack lost power, the partition would be unavailable. By spreading replicas across racks (and, in multi-DC keyspaces, placing a full RF in each DC), a rack or even a whole DC can fail without losing data.

This is the bridge to the next topic — the ring geometry here (clockwise walk from the token) is refined by rack/DC awareness in **Replication & Topology**, where snitches and NetworkTopologyStrategy are covered in full. For now: placement = token ring order, filtered by topology to spread copies across failure domains.

### Q14. What is data locality in Cassandra and why does it matter?

**Data locality** means all rows that share a partition key are stored **together** on the same set of replicas. Because they hash to the same token, they land on the same nodes, physically clustered and sorted by clustering columns.

Why it matters:

- **Single-node reads** — a query for one partition (e.g. all messages in one conversation) is served by one replica set, often one disk seek to a contiguous run of rows. No scatter-gather across the cluster.
- **Efficient range reads within a partition** — clustering columns are sorted on disk, so "last 50 messages" is a cheap sequential read.

The flip side is the whole design constraint: locality is *per partition*, so anything you want to read together must be modeled into the **same partition**. This is exactly why data modeling revolves around the partition key — you engineer locality to match your queries.

### Q15. Why can't you efficiently range-scan across partitions?

Because the partitioner **hashes** the partition key. Two partition keys that are "close" in value (`user 1000` and `user 1001`) hash to two completely unrelated tokens on opposite sides of the ring. There is no on-disk or on-ring ordering of partition keys to scan along.

```cql
-- This is NOT an efficient range scan; user_id order has no ring meaning
SELECT * FROM users WHERE user_id >= 1000 AND user_id < 2000;  -- illegal / needs ALLOW FILTERING
```

Cassandra only supports range queries on **clustering columns** (which *are* sorted, within a partition), not on the partition key. A "scan a range of partition keys" request would have to hit the entire ring — every node — which is why it's disallowed or requires `ALLOW FILTERING` (a full cluster scan, a red flag). If you need ordered scans across a key, you model it differently (e.g. bucketing into a partition whose clustering column carries the order).

### Q16. What is a hot partition and how does a bad key cause one?

A **hot partition** is a single partition receiving a disproportionate share of reads or writes, overloading the replicas that own it while the rest of the cluster sits idle. It defeats the whole point of distribution.

Causes, all rooted in the partition key:

- **Low cardinality** — `PRIMARY KEY ((status), ...)` with 3 statuses → 3 partitions → 3 hot nodes.
- **Monotonic / time-based key** — `PRIMARY KEY ((current_day), ...)` → *all* today's writes hammer one partition (a "hot spot that moves each day").
- **Skewed access** — a celebrity user, a `global` bucket, a single tenant that's 90% of traffic.

```cql
-- Anti-pattern: every event today writes to ONE partition
PRIMARY KEY ((event_date), event_id)      -- hot partition per day

-- Better: spread with a bucket / high-cardinality key
PRIMARY KEY ((event_date, bucket), event_id)   -- bucket = hash % N spreads load
```

Hot partitions cause write bottlenecks, large partitions, and the read-latency/compaction pain covered in the performance topics. Prevention is a high-cardinality, evenly-accessed partition key.

### Q17. How does the token allocation algorithm improve on random vnode assignment?

Originally, vnode tokens were assigned **randomly**. With enough tokens (256) that averaged out to decent balance, but with fewer tokens random assignment produces noticeable imbalance — some nodes own materially more of the ring than others.

Cassandra added a **token allocation algorithm** that, instead of picking random tokens, computes tokens to **optimize balance for a given replication factor**. You enable it with:

```
# cassandra.yaml
allocate_tokens_for_local_replication_factor: 3
# (or, older form) allocate_tokens_for_keyspace: <keyspace>
num_tokens: 16
```

It considers existing token placement and RF to choose new tokens that even out ownership. The payoff: you get good balance with a **low `num_tokens`** (16, even 8), which in turn gives you the repair and availability benefits of fewer vnodes without sacrificing distribution. This is why modern deployments pair a low vnode count with the allocation algorithm rather than the old random-256 approach.

## Replication & Topology

### Summary

**What this topic covers**

How many copies of your data exist and *where* Cassandra puts them — the layer that turns "data is placed on the ring" into "data survives failures." Three concern areas: (1) the **replication factor (RF)** — how many copies of each partition exist, why RF=3 is the standard, and how RF trades storage/write cost against fault tolerance; (2) **replication strategies** — SimpleStrategy (naive, single-DC, never in production) vs NetworkTopologyStrategy (production standard, RF per DC, replicas spread across racks); and (3) **topology awareness** — snitches, racks, and datacenters as the failure and latency domains that determine safe replica placement and enable multi-DC geo-distribution. The 16 questions here build directly on the token ring: replica selection is "walk clockwise from the partition's token, skipping to satisfy rack/DC rules." This topic also sets up consistency — RF is the denominator in the **R + W > RF** rule that governs strong consistency, so getting RF and replica placement right is the prerequisite for reasoning about QUORUM math later. Placement here is about *durability and availability*; consistency (next) is about *what you read back*.

**Mental model**

Think of RF as "how many independent bets I'm placing that this partition survives." RF=1 is one bet — lose that node, lose the data (and the partition becomes unavailable). RF=3 is three bets on three different nodes, ideally in three different racks (and in multi-DC, a full set of bets in each region). Placement isn't random: starting from the partition's token, Cassandra walks clockwise to pick the primary replica, then continues clockwise choosing the next replicas — but with **NetworkTopologyStrategy** it *skips* nodes to avoid putting two replicas in the same rack, so a rack failure can't take out more than one copy. The **snitch** is the map that makes this possible: it tells Cassandra which DC and rack every node is in. Multi-DC is the same idea at larger scale — you declare an RF *per datacenter*, and Cassandra maintains a full replica set in each, so an entire region can go dark and the other region keeps serving with local latency. The whole topic is about arranging copies across failure domains so that no single failure — node, rack, or datacenter — loses or blocks access to a partition.

**Key terms**

- **Replication factor (RF)** — the number of copies of each partition, set per keyspace (often per DC). RF=3 is typical.
- **Replica** — a node holding a copy of a partition. The RF replicas are chosen by the strategy from the token ring.
- **Replication strategy** — the algorithm choosing replica nodes: SimpleStrategy or NetworkTopologyStrategy.
- **SimpleStrategy** — naive clockwise replica placement, topology-unaware; single-DC/dev only.
- **NetworkTopologyStrategy (NTS)** — production strategy; RF specified per DC, replicas placed on distinct racks per DC.
- **Snitch** — the component that tells Cassandra each node's datacenter and rack, informing placement and routing.
- **GossipingPropertyFileSnitch** — the recommended snitch; each node declares its DC/rack, propagated via gossip.
- **Rack** — a failure/latency domain within a DC; replicas are spread across racks for isolation.
- **Datacenter (DC)** — a group of nodes (region/AZ); RF and consistency can be scoped per DC.
- **Primary replica** — the first replica clockwise from the token; the other RF−1 follow (topology-adjusted).
- **Hinted handoff** — when a replica is down, the coordinator stores a hint and replays the write later.
- **Transient replication** — advanced feature where some replicas keep data only until repair, reducing storage.

**Why interviewers ask this**

Replication is where availability stops being a slogan and becomes arithmetic. A junior answer is "RF=3 means three copies." A senior answer explains *where* those copies go and why: distinct racks for fault isolation, a full RF per DC for geo-redundancy, and the consequence that RF sets the ceiling for both your consistency options (QUORUM needs RF replicas to reason about) and your fault tolerance (survive floor((RF−1)/... ) failures). Interviewers probe SimpleStrategy-vs-NTS because reaching for SimpleStrategy in production (or worse, discovering it under-replicated a DC) is a classic real-world outage. They ask about snitches because misconfigured topology silently defeats rack/DC isolation — replicas that you *think* are spread out but aren't. This topic signals whether a candidate can design for failure domains, not just nominal capacity.

**Common confusions**

- "RF=3 means 3 nodes total" — no, it means 3 copies of *each* partition; the cluster can have hundreds of nodes, each holding a share.
- "SimpleStrategy is fine, just simpler" — it ignores racks and DCs; in production it can place all copies in one rack or fail to replicate to a second DC. Use NTS always.
- "The snitch routes queries" — the snitch *informs* placement and proximity; the coordinator routes. Getting the snitch wrong corrupts placement.
- "Changing RF instantly adds copies" — altering RF only changes the intended placement; you must run `nodetool repair` to actually stream the new copies into existence.
- "Higher RF is always better" — more copies cost more storage and make every write hit more nodes; RF=3 is the sweet spot for most workloads.
- "RF=1 is okay for unimportant data" — RF=1 means any node loss makes those partitions unavailable *and* unrecoverable; there's no fault tolerance at all.

**What follows from this topic**

RF is the number the consistency topics divide by: **R + W > RF** for strong consistency, and QUORUM = floor(RF/2)+1. So the RF you set and the DCs you replicate to directly shape which consistency levels (QUORUM vs LOCAL_QUORUM) make sense — LOCAL_QUORUM only means anything because you replicated per DC here. The "some replicas are down" cases previewed here (hinted handoff) are detailed in the write-path and consistency topics, along with read repair and anti-entropy **repair** — the three mechanisms that reconcile the replicas you're placing. And rack/DC awareness feeds the operations topics (safe rolling restarts, adding a DC). Remember: *this topic decides how many copies and where; consistency decides how many must answer.*

### Q1. What is the replication factor and where is it set?

The **replication factor (RF)** is the number of copies of each partition stored across the cluster. It's a **per-keyspace** setting, and with NetworkTopologyStrategy it's specified **per datacenter**.

```cql
CREATE KEYSPACE app WITH replication =
  {'class': 'NetworkTopologyStrategy', 'dc1': 3, 'dc2': 3};
```

Key facts:

- RF=3 is the typical production choice — enough redundancy to survive failures and support QUORUM, without excessive storage/write cost.
- **RF ≤ number of nodes** (per DC). You can't have more copies than nodes to hold them; RF greater than the node count means writes can't fully replicate.
- RF applies to *every* partition in the keyspace uniformly.

RF is the foundational number for both durability (how many failures you survive) and consistency (the denominator in R + W > RF).

### Q2. How are the replicas for a partition chosen?

Start from the partition's **token** and walk **clockwise** around the ring:

1. The first node whose range contains the token is the **primary replica**.
2. Continue clockwise, selecting the next nodes as additional replicas until you have RF of them.
3. With **NetworkTopologyStrategy**, *skip* candidate nodes that would put two replicas in the same **rack** (within a DC), so copies land on distinct racks; and do this independently per DC to satisfy the per-DC RF.

```
Token ring (RF=3, NTS, racks in []):
  ...T--> N1[r1] --> N2[r1] --> N3[r2] --> N4[r3] ...
  key token just before N1:
    replica1 = N1 (rack1)
    replica2 = N3 (rack2)   <- N2 skipped, same rack as N1
    replica3 = N4 (rack3)
```

There's nothing "primary" about the primary replica in terms of authority — all replicas are equal for reads/writes. "Primary" just names the first one clockwise. The snitch supplies the rack/DC info that drives the skipping.

### Q3. Compare SimpleStrategy and NetworkTopologyStrategy.

| | SimpleStrategy | NetworkTopologyStrategy (NTS) |
|---|---|---|
| Topology awareness | None — ignores racks and DCs | Rack- and DC-aware |
| RF specification | Single number for the cluster | Per datacenter |
| Replica placement | Next RF nodes clockwise, blindly | Clockwise but spread across racks, per DC |
| Multi-DC | Not supported meaningfully | Designed for it |
| Use in production | **No** | **Yes — always** |
| Use case | Single-node dev, learning | All real clusters |

**SimpleStrategy** just walks clockwise and takes the next RF nodes, with no idea what rack or DC they're in — so it might put all 3 copies in one rack, or fail to replicate properly across DCs. **NTS** places a full RF in each named DC and spreads those replicas across distinct racks for fault isolation. The rule: use NTS everywhere, even single-DC — it costs nothing and lets you add a DC later without a painful migration.

### Q4. What is a snitch and why does it matter?

A **snitch** determines the network topology — it tells Cassandra which **datacenter** and **rack** each node belongs to, and how "close" nodes are to each other. This information drives two things:

1. **Replica placement** — NetworkTopologyStrategy uses rack/DC info to spread replicas across failure domains.
2. **Request routing/proximity** — the coordinator prefers closer replicas (e.g. `LOCAL_QUORUM` stays in the local DC; dynamic snitching routes reads to the fastest-responding replica).

Common snitches:

- **SimpleSnitch** — single-DC only, no rack awareness. Dev/testing.
- **GossipingPropertyFileSnitch (GPFS)** — **recommended**. Each node declares its DC and rack in `cassandra-rackdc.properties`, and this is propagated via gossip. Works on any infrastructure.
- **PropertyFileSnitch** — older; every node holds a file mapping all nodes' IPs to DC/rack (harder to maintain).
- **Ec2Snitch / Ec2MultiRegionSnitch / GoogleCloudSnitch** — cloud snitches that derive DC/rack from the cloud provider's region/AZ metadata automatically.

Getting the snitch wrong silently breaks isolation — replicas you believe are on separate racks may all be together — so it's a high-stakes configuration.

### Q5. Why does RF=1 mean no fault tolerance?

With **RF=1** there is exactly **one copy** of each partition, on one node. Consequences:

- **Node down = data unavailable.** If that node is offline, every partition it owns cannot be read or written at *any* consistency level — there's no other replica to serve them.
- **Node lost = data gone.** If the disk/node is permanently lost, that data is unrecoverable; no other node has it.
- **No repair possible** — anti-entropy repair reconciles *between* replicas; with one replica there's nothing to reconcile against.

RF=1 gives you Cassandra's distribution (data spread across nodes) but **none of its resilience**. It's only appropriate for throwaway/regenerable data where you genuinely don't care about losing a slice. For anything that matters, RF≥3 in production so you can lose a node (or do a rolling restart) and still serve at QUORUM.

### Q6. How does RF affect consistency and availability?

RF is the lever behind the whole consistency/availability tradeoff:

- **More copies = survive more failures.** With RF=3 and QUORUM (2 of 3), you can lose one replica and still read/write. With RF=5 and QUORUM (3 of 5), you can lose two.
- **More copies = higher cost.** Every write must be sent to all RF replicas (the coordinator writes to all, waits for CL of them), and storage multiplies by RF. RF=5 doubles storage and write fan-out vs RF=3 for marginal extra safety.
- **RF sets the consistency ceiling.** Strong consistency requires **R + W > RF**; QUORUM = floor(RF/2)+1. So RF determines what "quorum" means and how many nodes can be down while still achieving it.

The sweet spot is **RF=3**: tolerates one node down at QUORUM, supports strong consistency, and keeps storage/write amplification reasonable. You raise RF only when you need to tolerate more simultaneous failures per DC. This is the direct on-ramp to the consistency-levels topic.

### Q7. What happens to a write when some replicas are down?

The coordinator always attempts to send the write to **all** RF replicas. What matters for success is only whether the **consistency level (CL)** is met:

- If enough replicas ack to satisfy the CL (e.g. 2 of 3 for QUORUM), the write **succeeds** even though one replica missed it.
- For the down replica(s), the coordinator stores a **hinted handoff** — a saved copy of the mutation — and replays it to that replica when it comes back (within a time window, default 3 hours).
- If too few replicas are up to meet the CL, the write **fails** (the client gets an error), even though it may have been persisted on the replicas that were up.

```
RF=3, CL=QUORUM(2), N3 down:
  coordinator -> N1 ok, N2 ok  => QUORUM met => success
              -> N3 down       => store hint, replay later
```

Hinted handoff plus read repair and anti-entropy repair are the three mechanisms that eventually make all replicas consistent. Hints handle short outages; repair handles everything hints miss (e.g. replica down longer than the hint window).

### Q8. How do you alter the replication factor, and what must you do afterward?

Alter it with `ALTER KEYSPACE`:

```cql
ALTER KEYSPACE app WITH replication =
  {'class': 'NetworkTopologyStrategy', 'dc1': 3, 'dc2': 3};

-- then, on the affected nodes:
-- nodetool repair -full app
```

The critical point: **altering RF only changes the intended placement metadata — it does not move any data.** If you *increase* RF, the new replica nodes don't yet have the existing partitions; you must run **`nodetool repair`** to stream the data to them. Until repair finishes, reads at higher consistency levels may miss data or the new replicas may serve nulls.

Also mind consistency during the change: increasing RF while clients read at QUORUM can transiently return stale/empty results until repair completes, so plan the change and repair as one operation. When *decreasing* RF, run cleanup afterward (`nodetool cleanup`) to drop now-unneeded data.

### Q9. How does replication work in a multi-datacenter keyspace?

With NetworkTopologyStrategy you declare an RF **per DC**, and Cassandra maintains a **full, independent replica set in each DC**:

```cql
CREATE KEYSPACE app WITH replication =
  {'class': 'NetworkTopologyStrategy', 'dc1': 3, 'dc2': 3};
```

This means:

- Each DC holds 3 copies of every partition — so `dc2` can serve all data locally even if `dc1` is completely down (geo-redundancy / DR).
- **Writes** are sent to all replicas in all DCs (the coordinator forwards to a remote-DC coordinator that fans out locally), but clients typically use **`LOCAL_QUORUM`** so they only wait for the *local* DC's quorum — low latency, while cross-DC replication happens asynchronously.
- **Reads** at `LOCAL_QUORUM` stay within the local DC, giving users low-latency reads from their nearest region.

This is Cassandra's geo-distribution superpower: active-active multi-region with local-latency reads/writes and full failover, configured with one map. It's why `LOCAL_QUORUM` exists and why per-DC RF matters.

### Q10. How do you read node ownership and replication status?

```bash
# Per-node status, ownership %, up/down, load, for a keyspace
nodetool status app
```

Example output shape:

```
Datacenter: dc1
=====================
--  Address     Load    Tokens  Owns(effective)  Host ID   Rack
UN  10.0.0.1    2.1 GB  16      33.3%             abc...    rack1
UN  10.0.0.2    2.0 GB  16      33.3%             def...    rack2
UN  10.0.0.3    2.2 GB  16      33.3%             ghi...    rack3
```

Reading it:

- **UN** = Up/Normal (first letter status: U/D; second letter state: N/L/J/M).
- **Owns (effective)** — accounts for RF; with RF=3 on 3 nodes each "owns" ~100% effectively (every node holds a copy of everything). Pass the keyspace to get RF-aware numbers.
- **Rack** column confirms replicas are spread across racks — a quick sanity check that your snitch/topology is right.

`nodetool status` is the first command in any triage: who's up, is load balanced, are racks/DCs correct.

### Q11. Why must replicas be spread across racks and datacenters?

Because **racks and datacenters are failure domains**, and the point of replication is to survive the failure of a whole domain, not just a single node.

- **Racks** — a rack typically shares power and top-of-rack networking. If all RF replicas of a partition sat in one rack and that rack lost power, the partition would be unavailable (or lost). NTS spreads the RF replicas across distinct racks so **one rack failure removes at most one replica** — you still have a quorum.
- **Datacenters** — a DC (region/AZ) can fail entirely (outage, disaster, network cut). A full RF in each DC means another region keeps serving with no data loss (DR), and users get low-latency local reads in normal operation.

The design principle: arrange copies so that **no single failure domain contains a majority of a partition's replicas**. Rack awareness protects against rack loss; multi-DC protects against region loss. Both depend on the snitch reporting topology correctly.

### Q12. What is transient replication?

**Transient replication** (an advanced, experimental feature) splits a partition's replicas into **full replicas** and **transient replicas**. Full replicas store the data permanently as usual; **transient replicas store data only temporarily — until repair propagates it to the full replicas — then discard it.**

The idea: you can get the availability/consistency benefits of a higher effective replica count without paying the full storage cost of every replica keeping everything. For example, RF=3 with one transient replica means only 2 nodes store each partition permanently, but a third participates in quorums for availability during the window before repair.

Caveats: it's designed to work with **incremental repair**, has restrictions (e.g. not with everything, monotonic reads considerations), and is not commonly used in typical deployments. In an interview it's a "I know this exists and what problem it targets — reducing storage amplification at high RF" answer, not something you'd casually enable.

### Q13. How does RF relate to QUORUM consistency (preview)?

QUORUM means a **majority of replicas** must respond: `QUORUM = floor(RF/2) + 1`.

| RF | QUORUM | Failures tolerated at QUORUM |
|---|---|---|
| 1 | 1 | 0 |
| 3 | 2 | 1 |
| 5 | 3 | 2 |

Strong consistency requires **R + W > RF** — the read replica set and write replica set must overlap. The common recipe is **write QUORUM + read QUORUM**, which for RF=3 is 2 + 2 = 4 > 3 → guaranteed overlap → you read the latest write.

This is why RF is the number everything divides by: it sets what QUORUM means, how many nodes can be down while still meeting it, and whether R + W > RF holds. In multi-DC, **LOCAL_QUORUM** applies the same math within a single DC's RF (e.g. 2 of that DC's 3), giving strong consistency locally without cross-DC latency. The consistency-levels topic develops all of this — here just anchor that RF is the denominator.

### Q14. Which snitch should you use in production and how do you configure it?

Use **GossipingPropertyFileSnitch (GPFS)** for most production deployments. Each node declares its own DC and rack in a local file, and gossip spreads that to the cluster — so you don't maintain a global topology file, and it works on any infrastructure (on-prem or cloud).

```properties
# cassandra-rackdc.properties (per node)
dc=dc1
rack=rack1
```

```yaml
# cassandra.yaml
endpoint_snitch: GossipingPropertyFileSnitch
```

On native cloud deployments, the cloud snitches (**Ec2Snitch**, **Ec2MultiRegionSnitch**, **GoogleCloudSnitch**, **AzureSnitch**) auto-derive DC=region and rack=availability-zone from provider metadata, which is convenient — but GPFS is the safe, portable default and gives you explicit control. The snitch must be consistent cluster-wide and is effectively fixed once data is placed, so choose it correctly at cluster creation.

### Q15. What are common rack-aware placement pitfalls?

The classic failure mode is **unbalanced racks**. NetworkTopologyStrategy tries to place each of the RF replicas on a distinct rack, but this only works cleanly when the number of racks matches (or exceeds) RF and racks have roughly equal node counts.

Pitfalls:

- **Fewer racks than RF** — e.g. RF=3 but only 2 racks defined. NTS can't put every replica on a distinct rack, so two replicas share a rack, weakening isolation.
- **Unequal racks** — if rack1 has 10 nodes and rack2 has 2, NTS still tries to place one replica per rack, so the 2 nodes in rack2 get hammered with a disproportionate share of replicas → load imbalance and hotspots.
- **Everyone in one rack** — declaring all nodes as the same rack (or misconfiguring the snitch) means no rack isolation at all; a common accidental state.

Best practice: use a **number of racks equal to your RF** (e.g. 3 racks for RF=3) with **balanced node counts per rack**. Either use as many racks as RF with even sizing, or — a defensible alternative some operators choose — put all nodes in a single rack deliberately (uniform placement) rather than a lopsided multi-rack setup. Mismatched, uneven racks are the worst case.

### Q16. How does a write flow to all replicas, and where does hinted handoff fit?

The write path across replicas:

1. Client sends the write to a **coordinator** (ideally token-aware → the coordinator is itself a replica).
2. The coordinator identifies all RF replicas (across racks, and across DCs in multi-DC) and **sends the mutation to all of them in parallel**. For remote DCs, it forwards to one node there which fans out locally.
3. Each live replica writes to its **commit log + memtable** and acks.
4. The coordinator returns success once the **consistency level** is met (e.g. 2 acks for QUORUM), not waiting for all.
5. For any replica that's **down or times out**, the coordinator writes a **hint** locally and replays it when that replica recovers (within `max_hint_window`, default 3h).

```
client -> coordinator --parallel--> N1 (ok)
                                 --> N2 (ok)      => CL=QUORUM met -> ack client
                                 --> N3 (down)    => store hint, replay later
```

So the write reaches all replicas *eventually*: live ones immediately, down ones via hinted handoff. If a replica is down longer than the hint window, **anti-entropy repair** is the backstop. This flow — all replicas targeted, CL gate for success, hints for the stragglers — is the bridge into the write-path and consistency topics.
## Tunable Consistency

### Summary

**What this topic covers**

Cassandra's single most distinctive feature: **tunable, per-query consistency**. Unlike a relational database where the isolation level is a property of the transaction and the database always presents a single authoritative copy, Cassandra lets you choose — on every individual read and every individual write — how many replicas must respond before the operation is considered successful. That choice is a dial you turn between latency/availability at one end and consistency at the other. The 16 questions here cover the full menu of **consistency levels** (ONE, QUORUM, LOCAL_QUORUM, ALL, ANY, SERIAL...), how the **coordinator** actually satisfies a read and a write at a given level, the pivotal **R + W > RF rule** for read-your-writes strength, what eventual consistency means (and what anomalies it permits), the multi-datacenter workhorse **LOCAL_QUORUM**, and how **last-write-wins** timestamp resolution silently decides conflicts. This is where masterless replication stops being trivia and starts being an engineering decision you own.

**Mental model**

Think of every partition as living on RF replica nodes, none of them special — there is no primary. When you write, the **coordinator** (whichever node you connected to) forwards the mutation to all RF replicas and waits for **W** acknowledgements before telling your client "ok". When you read, the coordinator asks **R** replicas and returns the row with the newest cell timestamp. Consistency is not a global setting; it is the arithmetic of overlap. If the set of W replicas you wrote to and the set of R replicas you later read from are guaranteed to share at least one node, that shared node has the latest write and the read cannot miss it. That guarantee holds exactly when **R + W > RF**. Everything else — QUORUM, LOCAL_QUORUM, ONE — is just picking numbers that satisfy or deliberately violate that inequality to trade correctness for speed. Cassandra does not lock, does not coordinate a leader, does not use vector clocks; conflicts are resolved by the highest timestamp, full stop.

**Key terms**

- **Consistency level (CL)** — per-request setting for how many replicas must respond; set client-side per statement.
- **Replication factor (RF)** — how many copies of each partition exist, set per keyspace per datacenter.
- **QUORUM** — a majority of **all** replicas across all datacenters: `floor(RF_total/2) + 1`.
- **LOCAL_QUORUM** — a majority of replicas **within the coordinator's local datacenter** only; no cross-DC wait.
- **EACH_QUORUM** — a quorum in **every** datacenter (writes only in practice); strong but cross-DC latency.
- **ONE / LOCAL_ONE** — a single replica responds (LOCAL_ONE forces it to be local); lowest latency, weakest.
- **ALL** — every replica must respond; strongest but zero fault tolerance — one node down = failed request.
- **ANY** — write-only, satisfied even if only a **hint** is stored (no live replica took it); weakest possible durability.
- **SERIAL / LOCAL_SERIAL** — Paxos-based linearizable reads/writes for lightweight transactions (LWT).
- **Coordinator** — the node handling your request; routes to replicas, tallies acks, resolves timestamps.
- **Last-write-wins (LWW)** — conflict resolution by highest cell timestamp; no merge, no vector clocks.
- **Read repair** — when a read sees mismatched replicas, the coordinator pushes the newest value to stale ones.

**Why interviewers ask this**

Tunable consistency is the fastest way to separate someone who has read a Cassandra blog post from someone who has run it in production. A junior candidate says "Cassandra is eventually consistent" and stops. A senior candidate knows that "eventually consistent" is a *choice you can override per query*, can derive `R + W > RF` from first principles, and knows that in a multi-DC deployment you almost never use QUORUM — you use LOCAL_QUORUM to avoid paying WAN latency on every request. Interviewers probe here because getting consistency wrong is how teams ship subtle data-loss and stale-read bugs that only appear under node failure or network partition. They want to see that you can reason about the failure modes, not just recite the level names, and that you understand the availability math: with RF=3, QUORUM survives one node down; with RF=3 and ALL, it survives none.

**Common confusions**

- "QUORUM means a majority of nodes in the cluster" — no, it's a majority of the **replicas** for that partition (RF of them), not the whole ring.
- "In multi-DC, QUORUM is what I want" — usually wrong; plain QUORUM counts replicas across all DCs and pays cross-DC latency. LOCAL_QUORUM is the workhorse.
- "R + W > RF gives me ACID / linearizability" — it gives read-your-writes / strong consistency for single operations, not transactions or isolation. Concurrent writers still race on timestamps.
- "Eventual consistency means the data might be wrong forever" — no; absent new writes, replicas converge (via read repair, hints, and `nodetool repair`). It means *stale reads are possible for a window*, not permanent corruption.
- "Higher consistency is always better" — it costs latency and availability. Analytics jobs happily read at ONE; a bank balance read might need QUORUM. It's per-workload.
- "Cassandra uses vector clocks like Dynamo" — it does not. It uses wall-clock cell timestamps and last-write-wins, which makes clock skew a real correctness hazard.

**What follows from this topic**

Consistency levels only make sense once you know replication factor and the token ring (the Replication & Distribution topic) — CL is meaningless without RF. The SERIAL/LOCAL_SERIAL levels and `IF` conditions preview **lightweight transactions (LWT)**, Cassandra's Paxos-based escape hatch from last-write-wins, covered later. Read repair and the eventual-consistency guarantee tie directly into **anti-entropy repair** (`nodetool repair`, Merkle trees). And the whole "you choose per query" philosophy reinforces the **query-first data modeling** mindset: Cassandra hands you dials, not guarantees, and expects you to engineer the behaviour you need.

### Q1. What does "tunable consistency" mean in Cassandra, and why is it Cassandra's defining feature?

Tunable consistency means you choose, **per individual read and per individual write**, how many replicas must acknowledge before the operation succeeds. It is not a database-wide or transaction-wide setting — it's a parameter on the statement.

This is the whole point of Cassandra's design. Because it's masterless (no primary node arbitrates writes), there is no single source of truth to read from; instead every partition lives on RF equal replicas. Tunable consistency is how you decide, request by request, how much you care about seeing the latest value versus getting a fast, highly-available answer.

Concretely: a background analytics scan can read at `ONE` (fastest, may be slightly stale — who cares), while a read that must reflect a just-committed write reads at `QUORUM`. Same table, same cluster, different guarantees, chosen at query time. No other mainstream database gives you this dial at this granularity.

### Q2. List the main consistency levels and what each requires.

| Level | Requires (per request) | Notes |
|---|---|---|
| `ANY` | 1 ack, or just a stored hint | Write-only; weakest durability |
| `ONE` / `LOCAL_ONE` | 1 replica responds | LOCAL_ONE forces local DC |
| `TWO` / `THREE` | 2 / 3 replicas respond | Rarely used explicitly |
| `QUORUM` | majority of **all** replicas: `floor(RF/2)+1` | Counts across all DCs |
| `LOCAL_QUORUM` | majority within the **local** DC | Multi-DC workhorse |
| `EACH_QUORUM` | a quorum in **every** DC | Writes; strong, cross-DC cost |
| `ALL` | every replica responds | Strongest, no fault tolerance |
| `SERIAL` / `LOCAL_SERIAL` | Paxos consensus | For LWT reads / conditional writes |

`ANY`, `EACH_QUORUM` are effectively write-only. `SERIAL`/`LOCAL_SERIAL` are the linearizable levels used by lightweight transactions.

### Q3. Walk through what happens on a write at CL = QUORUM with RF = 3.

QUORUM here is `floor(3/2)+1 = 2`.

1. Your client sends the write to a **coordinator** node.
2. The coordinator hashes the partition key, finds the **3 replicas** that own it, and sends the mutation to all 3 in parallel.
3. It waits for **2 acknowledgements** (W = QUORUM = 2).
4. As soon as 2 replicas have applied the write (commit log + memtable) and acked, the coordinator returns **success** to the client.
5. The 3rd replica's write still happens — asynchronously. If it was down, the coordinator stores a **hint** and replays it later (hinted handoff).

Key point: "success" does not mean all replicas have it — it means *at least W* do. The rest converge via the async write, hints, read repair, or `nodetool repair`.

### Q4. Walk through a read at CL = QUORUM with RF = 3.

1. Client sends the read to a coordinator.
2. Coordinator identifies the 3 replicas and asks **2** of them (R = QUORUM = 2) — typically one full data read and one digest (checksum) request to save bandwidth.
3. It compares the responses **by cell timestamp** and returns the **newest** value to the client.
4. If the two replicas disagree (different timestamps), the coordinator resolves to the newest and triggers **read repair**: it pushes the current value back to the stale replica so it converges.

So a QUORUM read both returns the freshest of the contacted replicas *and* opportunistically heals divergence it observes.

### Q5. Explain the R + W > RF rule and why it guarantees strong consistency.

**R** = replicas contacted on read, **W** = replicas acked on write, **RF** = total replicas.

If `R + W > RF`, then the set of W replicas that took your write and the set of R replicas your read contacts **must overlap in at least one node** (pigeonhole principle). That overlapping replica holds the latest write, and since reads return the highest-timestamp value, the read is guaranteed to see your write. That's read-your-writes / strong consistency for a single key.

Classic example, RF = 3:
- W = QUORUM (2), R = QUORUM (2) → 2 + 2 = 4 > 3 → **strong**. Guaranteed overlap.
- W = ONE (1), R = ONE (1) → 1 + 1 = 2 ≤ 3 → **eventual**. The read may hit two replicas that both missed the write.
- W = ALL (3), R = ONE (1) → 4 > 3 → strong, but writes have no fault tolerance.
- W = ONE (1), R = ALL (3) → 4 > 3 → strong, but reads have no fault tolerance.

QUORUM/QUORUM is the popular pick because it's strong *and* tolerates one node down on both paths.

### Q6. If RF = 3 and I write at ONE and read at ONE, what can go wrong?

`R + W = 1 + 1 = 2`, which is **not** greater than RF = 3, so you have **eventual, not strong** consistency.

Failure scenario:
1. Write at ONE: coordinator acks after **just one** replica (say replica A) applies the write. B and C haven't got it yet.
2. Read at ONE immediately after: coordinator happens to ask replica **B**, which still has the old value.
3. You read **stale data** — a value older than one you already successfully wrote. Read-your-writes is violated.

The replicas will converge eventually (async write / hints / read repair / repair), but for a window you can read a value older than a completed write. For a user-facing "save then reload" flow this is a visible bug. Fix: use QUORUM on at least one side so `R + W > RF`.

### Q7. What is LOCAL_QUORUM and why is it the default choice for multi-datacenter clusters?

`LOCAL_QUORUM` requires a majority of replicas **within the coordinator's own datacenter**, ignoring replicas in other DCs for the ack count.

Why it's the workhorse: with, say, RF = 3 per DC across two DCs (6 replicas total), plain `QUORUM` needs 4 of 6 acks — which forces you to wait on **cross-DC (WAN) latency** on every single request. `LOCAL_QUORUM` needs just 2 of the 3 local replicas: you get strong consistency **within the local DC** (2 + 2 > 3 locally) at LAN latency, while replication to the remote DC still happens asynchronously.

This gives you the common production shape: each DC serves its own clients with strong local consistency and low latency, and the DCs converge with each other eventually. You reserve `EACH_QUORUM` for the rare case where you truly need a quorum in every DC before acking.

### Q8. How does Cassandra resolve conflicting writes to the same cell?

**Last-write-wins by cell timestamp.** Every column value carries a timestamp (microseconds since epoch, assigned by the coordinator or supplied via `USING TIMESTAMP`). When two writes touch the same cell, the one with the **higher timestamp** wins — unconditionally. There is no merge, no vector clock, no conflict surfaced to the application.

```cql
-- both target the same cell; higher timestamp wins on read/compaction
UPDATE users_by_id USING TIMESTAMP 1700000000000000
  SET email = 'a@acme.test' WHERE id = 1;
UPDATE users_by_id USING TIMESTAMP 1700000000000001
  SET email = 'b@acme.test' WHERE id = 1;  -- this one wins
```

The danger: this trusts wall clocks. If two nodes have **clock skew**, a write that is logically newer but has an earlier timestamp is silently discarded. That's why NTP discipline across the cluster matters, and why LWW is a genuine correctness hazard, not just an implementation detail.

### Q9. Does R + W > RF give you ACID transactions?

No. It gives you **strong consistency for a single-key operation** — a read is guaranteed to see the latest committed write to that key. It does **not** give you:

- **Atomicity across keys/partitions** — Cassandra has no multi-partition transactions by default (batches aren't transactions).
- **Isolation** — two clients writing the same cell concurrently still race; last-write-wins picks a winner by timestamp, there's no serialization.
- **Read-modify-write safety** — "read balance, subtract 10, write back" is unsafe; another writer can interleave.

For genuine compare-and-set semantics you need **lightweight transactions (LWT)** with `IF` conditions and `SERIAL` consistency (Paxos), which are much slower. R + W > RF is a consistency guarantee, not a transaction guarantee.

### Q10. With RF = 3, how many node failures can each consistency level tolerate?

For a given partition with RF = 3:

| CL | Replicas needed | Node failures tolerated |
|---|---|---|
| ONE | 1 | 2 |
| QUORUM | 2 | 1 |
| ALL | 3 | 0 |

QUORUM's appeal is exactly this: 2 of 3 means you survive **one** replica being down and still serve reads and writes with strong consistency (when paired QUORUM/QUORUM). `ALL` gives the strongest guarantee but any single replica outage makes the request fail — poor availability. `ONE` survives two failures but is only eventually consistent. Note this is *per partition*: which specific nodes are down matters, because different partitions live on different replica sets.

### Q11. What is the ANY consistency level and why is it dangerous?

`ANY` is a **write-only** level satisfied if the write reaches **at least one node in any form — including merely being stored as a hint** on the coordinator for a currently-down replica. No live replica needs to have actually applied it.

It's the weakest possible durability. The danger: the write can be "successful" while sitting only in a hint. If the coordinator dies before replaying that hint, and no replica ever got the data, the write is **lost** — yet the client was told it succeeded. You also can't read at ANY (there's no matching read level to guarantee you'd see it).

Use it essentially never for data you care about. It exists for fire-and-forget writes where availability trumps durability, but in practice `LOCAL_ONE` or higher is almost always the right floor.

### Q12. Can you get monotonic reads? What breaks them?

Not automatically. **Monotonic reads** means once you've seen a value, you never later see an older one. Cassandra doesn't guarantee this across successive reads at low consistency.

What breaks it: read at `ONE` twice in a row. The first read hits an up-to-date replica; the second read is routed (by the coordinator/load balancing) to a **different, staler** replica that missed the latest write. You go "forward then backward" in time. Same risk across a client failover between coordinators.

Mitigations: read at `QUORUM`/`LOCAL_QUORUM` so `R + W > RF` holds and every read reflects the latest committed write; or pin a session to consistent routing. But fundamentally, low-CL reads sacrifice monotonicity — it's part of what you trade away for latency.

### Q13. How do you choose consistency levels for a user-facing app versus an analytics job?

**User-facing (e.g. profile save then reload):** you need read-your-writes. Use `LOCAL_QUORUM` writes and `LOCAL_QUORUM` reads so `R + W > RF` holds within the DC, giving strong consistency at LAN latency while tolerating one node down. This is the sensible default for interactive workloads.

**Analytics / batch scan (e.g. Spark job aggregating a table):** you're reading huge volumes and slight staleness is irrelevant. Use `ONE` / `LOCAL_ONE` reads — lowest latency, least cluster load, maximum availability. No need to pay quorum coordination for data you're aggregating.

**Bulk ingest:** often `LOCAL_ONE` or `LOCAL_QUORUM` writes depending on how much durability you need before acking.

The point of tunable consistency is that these coexist on the same cluster and table — you set CL per workload, per query.

### Q14. What actually happens to replicas that didn't ack a QUORUM write?

The write still targets **all RF replicas** — QUORUM just means the coordinator *returns to the client* after W acks. The remaining replicas converge through several mechanisms:

- **Async completion** — the mutation was already sent to all replicas; the slow ones just finish after the client got its ack.
- **Hinted handoff** — if a replica was *down*, the coordinator stores a hint and replays it when the replica comes back (default up to `max_hint_window_in_ms`, ~3h).
- **Read repair** — a later read at sufficient CL notices the divergence and pushes the newest value to stale replicas.
- **Anti-entropy repair** — `nodetool repair` uses Merkle trees to reconcile everything, the backstop for hints that expired.

So "only 2 of 3 acked" is normal and safe — the 3rd catches up. This is why the system is *eventually* consistent even when you read/write at QUORUM.

### Q15. Why doesn't "eventually consistent" mean "wrong forever"?

Because absent new writes, replicas **converge to the same value** — the system actively heals divergence. "Eventual" describes a *time window* during which replicas may disagree, not a permanent state.

The convergence machinery:
- **Hinted handoff** replays writes missed by down replicas.
- **Read repair** fixes divergence detected during reads.
- **`nodetool repair`** (Merkle-tree anti-entropy) reconciles all replicas on a schedule (run within `gc_grace_seconds`).

Given last-write-wins resolution, all replicas will settle on the value with the highest timestamp. The staleness window is typically milliseconds to seconds under healthy operation. The correct framing: a read at low CL *may* return a value that's briefly out of date, but the data is not corrupt and will converge — you traded temporary staleness for latency and availability, which is exactly the deal Cassandra offers.

### Q16. You need strong consistency but your cluster spans three datacenters. What CL do you use and what's the trade-off?

If "strong" means globally strong (a read in any DC sees the latest write from any DC), you'd need `EACH_QUORUM` writes plus `LOCAL_QUORUM` (or QUORUM) reads — but that pays cross-DC latency on every write and fails if any DC loses quorum. Expensive and fragile.

The pragmatic answer most systems choose: **strong consistency *within each DC* via `LOCAL_QUORUM` reads and writes**, and accept that cross-DC replication is asynchronous (eventual). Each DC serves its local users correctly and fast; the DCs converge with each other in the background.

Trade-off to state explicitly: you get low-latency, strong, HA reads/writes locally, but a client in DC1 might briefly not see a write that just committed in DC2. If you genuinely need cross-DC linearizability, Cassandra is arguably the wrong tool — or you reach for LWT (SERIAL), accepting a large latency hit. Interviewers want you to name that trade-off, not pretend LOCAL_QUORUM is globally strong.

## The Data Model & CQL

### Summary

**What this topic covers**

The Cassandra Query Language (**CQL**) and the object hierarchy it manipulates: **keyspaces**, **tables**, **rows**, and **columns**. CQL is deliberately designed to *look* like SQL — `SELECT`, `INSERT`, `CREATE TABLE`, familiar-looking `WHERE` clauses — so relational engineers feel at home. This is a trap. Underneath, CQL is a thin, intentionally restricted query surface over the partition-based storage engine: **no joins, no subqueries, no arbitrary `WHERE`, no cross-partition aggregation** as a normal operation. The 16 questions here cover creating keyspaces and tables, CQL's type system, `cqlsh` and the basic CRUD verbs, the crucial gotcha that **INSERT is really an UPSERT**, why the `WHERE` clause is so restricted, `TTL` and `USING TIMESTAMP`, `IF NOT EXISTS`/`IF` (an LWT preview), paging and `LIMIT`, the danger of `ALLOW FILTERING`, and how a CQL statement maps down to timestamped cells in SSTables. The theme: learn where CQL diverges from SQL, because those divergences are exactly where interviews and outages happen.

**Mental model**

Read CQL as "SQL syntax, key-value semantics". A CQL table is not a relation you can slice any way you like; it is a **map of partitions**, and within each partition a **sorted map of rows**. Every efficient query names a single partition (via the partition key) and optionally walks its clustering-ordered rows. That's it. When you write CQL, mentally translate each statement into "which partition does this touch, and where in that partition's sort order?" If your query can't answer that — if it filters on a column that isn't part of the key — then either it won't run, or it'll demand `ALLOW FILTERING` and scan the whole cluster. Writes are even simpler: there is no read-before-write and no existence check. `INSERT` and `UPDATE` both just stamp cells with a timestamp; the "row" you see later is the merge of all the cells that ever got written for that primary key, newest timestamp winning. CQL is a convenience skin; the storage engine is the real model.

**Key terms**

- **Keyspace** — top-level namespace, like a database; owns the **replication strategy** and **RF**. Tables live inside it.
- **Table (column family)** — a set of partitions with a defined schema and a primary key.
- **Partition** — all rows sharing a partition key; the unit of storage, replication, and single-query access.
- **Row** — a set of columns identified by the full primary key (partition key + clustering columns).
- **Cell** — a single column value with its own **timestamp** and optional **TTL**; the atom the engine stores.
- **CQL** — Cassandra Query Language; SQL-like syntax, key-value semantics, no joins.
- **cqlsh** — the interactive shell; `DESCRIBE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`, `COPY`.
- **UPSERT** — Cassandra's write model: INSERT and UPDATE both write cells with no existence check.
- **TTL** — per-write expiry in seconds; expired cells become tombstones and are later compacted away.
- **USING TIMESTAMP** — override the write timestamp that drives last-write-wins.
- **ALLOW FILTERING** — opt-in to a scan that isn't satisfied by the key; a red flag at scale.
- **Prepared statement** — pre-parsed, cached query with bind variables; faster and injection-safe.

**Why interviewers ask this**

Because the number-one failure mode for engineers new to Cassandra is treating it like a SQL database with a funny driver. Interviewers use CQL questions to check whether you've internalised the divergences: do you know that `INSERT ... IF NOT EXISTS` is a completely different (Paxos-backed, slow) operation than a plain `INSERT`? Do you understand why you can't just add a `WHERE status = 'active'` on a non-key column? Do you reach for `ALLOW FILTERING` casually (junior) or recoil from it (senior)? Do you know that a plain `INSERT` silently overwrites without telling you? These questions reveal whether you'll model data correctly and write queries that scale, or whether you'll build something that works in dev with 100 rows and melts in prod at 100 million. It's a cheap, fast filter for real Cassandra experience.

**Common confusions**

- "INSERT fails if the row exists, like SQL" — no. Plain INSERT is an upsert; it silently overwrites. Only `IF NOT EXISTS` checks, and that's an LWT.
- "CQL is basically SQL" — syntactically yes, semantically no: no joins, no subqueries, no arbitrary WHERE, no cross-partition GROUP BY as a normal operation.
- "I can filter on any column" — only partition key (fully) and clustering columns (in prefix order) filter efficiently. Anything else needs an index or `ALLOW FILTERING`.
- "A keyspace is like a table" — a keyspace is like a **database**; it holds tables and carries the replication settings.
- "ALLOW FILTERING makes my query work" — it makes it *run*, by scanning; at scale that's a cluster-wide table scan and a latency/timeout disaster.
- "UPDATE requires the row to exist" — it doesn't; UPDATE on a missing primary key just creates it. Same engine operation as INSERT.

**What follows from this topic**

CQL's restrictions are not arbitrary — they exist to keep every query roughly O(1) in partitions touched, which is the whole point of **Primary Keys** (partition + clustering, the next deep dive) and **query-first data modeling** (why you build one table per access pattern instead of joining). The `WHERE`-clause limits directly motivate denormalization. `IF`/`IF NOT EXISTS` previews **lightweight transactions**. `TTL` and tombstones connect to the **storage engine and compaction** topics. Master CQL's shape here, and the modeling topics stop feeling like arbitrary rules and start feeling like the only sane way to use this surface.

### Q1. Describe the CQL object hierarchy: keyspace, table, row, column.

Top to bottom:

- **Keyspace** — the outermost container, analogous to a SQL *database*. It defines the **replication strategy** and **replication factor** for everything inside it. You pick a keyspace per application/bounded context.
- **Table** — a schema'd set of **partitions**; historically called a column family. Has a defined primary key.
- **Partition** — all rows sharing the same partition key; the unit that lives together on a node and is replicated as a group.
- **Row** — identified by the full primary key; a collection of columns.
- **Column / cell** — a single named value. At the storage level each cell carries its own **timestamp** and optional **TTL**.

The mental jump from SQL: the keyspace owns *replication*, and the partition (not the table) is the real unit of locality and access.

### Q2. How is CQL different from SQL, despite looking similar?

CQL borrows SQL's *syntax* but not its *semantics*. The big divergences:

- **No joins** — you cannot join two tables. You denormalize instead.
- **No subqueries.**
- **No arbitrary WHERE** — you can only filter efficiently on the partition key and clustering columns (in order). No `WHERE arbitrary_column = ...` without an index or `ALLOW FILTERING`.
- **No cross-partition aggregation** as a normal operation — historically no `GROUP BY` across partitions; aggregates are limited and meant to run within a single partition.
- **INSERT is an upsert** — no existence check, no "duplicate key" error.
- **No transactions/isolation** across partitions by default.

The rule of thumb: CQL is a **thin query surface over a partitioned key-value store**. Anything that would require scanning or coordinating across partitions is either forbidden or a red flag.

### Q3. Write CQL to create a keyspace and a table.

```cql
-- Keyspace: replication strategy + RF live here
CREATE KEYSPACE IF NOT EXISTS shop
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3
};

USE shop;

-- A table: primary key defines partition + clustering
CREATE TABLE IF NOT EXISTS orders_by_customer (
  customer_id uuid,
  order_ts    timestamp,
  order_id    uuid,
  total       decimal,
  status      text,
  PRIMARY KEY (customer_id, order_ts)
) WITH CLUSTERING ORDER BY (order_ts DESC);
```

`NetworkTopologyStrategy` with a per-DC RF is the production choice (use `SimpleStrategy` only for single-node dev). Here `customer_id` is the partition key (which node) and `order_ts` clusters rows within each customer's partition, newest first.

### Q4. What CQL data types should I know?

The common ones:

- **Text/numeric**: `text` (UTF-8), `int`, `bigint`, `smallint`, `varint`, `float`, `double`, `decimal`, `boolean`.
- **Identifiers/time**: `uuid` (random), `timeuuid` (v1, time-ordered — great for clustering), `timestamp`, `date`, `time`.
- **Binary/network**: `blob`, `inet`.
- **Collections**: `list<T>`, `set<T>`, `map<K,V>` — small, denormalized groupings (not for large unbounded data).
- **User-defined types (UDT)**: `CREATE TYPE address (...)` then use it as a column type.
- **Counter**: `counter` — special distributed increment type (its own table restrictions).

`timeuuid` is worth calling out: it's a UUID that sorts by time, ideal as a clustering column for event/feed ordering. Collections and UDTs are for *bounded* embedded data — abuse them and you get large-cell / read-amplification problems.

### Q5. What is cqlsh and what are the basic commands?

`cqlsh` is the interactive Python shell for talking to a cluster over CQL.

```cql
DESCRIBE keyspaces;
DESCRIBE TABLE shop.orders_by_customer;

INSERT INTO shop.orders_by_customer (customer_id, order_ts, order_id, total, status)
  VALUES (uuid(), toTimestamp(now()), uuid(), 42.00, 'paid');

SELECT * FROM shop.orders_by_customer WHERE customer_id = 8ac3...;

UPDATE shop.orders_by_customer SET status = 'shipped'
  WHERE customer_id = 8ac3... AND order_ts = '2026-07-01T10:00:00Z';

DELETE FROM shop.orders_by_customer
  WHERE customer_id = 8ac3... AND order_ts = '2026-07-01T10:00:00Z';
```

`DESCRIBE` inspects schema, `COPY` does CSV import/export, and you set the session consistency with `CONSISTENCY LOCAL_QUORUM;`. It's the psql-equivalent for Cassandra.

### Q6. Why is INSERT really an UPSERT in Cassandra, and why does that matter?

Because Cassandra never does a read-before-write. An `INSERT` and an `UPDATE` are the **same storage operation**: write cells for this primary key, each stamped with a timestamp. There is **no existence check** — inserting a primary key that already exists silently **overwrites** the affected cells (last-write-wins by timestamp); updating a primary key that doesn't exist silently **creates** it.

Why it matters:

- **No duplicate-key error.** In SQL, `INSERT` on an existing PK fails loudly. In CQL it succeeds and clobbers — a classic source of silent data loss when engineers assume INSERT = "create only".
- **It's why writes are fast** — no read, no lock, just an append. But it means the application, not the database, owns "does this already exist?" logic.

If you genuinely need create-only semantics, you must use `INSERT ... IF NOT EXISTS`, which is a lightweight transaction (Paxos) and far slower.

### Q7. Why can't I put an arbitrary column in the WHERE clause?

Because Cassandra locates data by **hashing the partition key to a node**, then walking the partition's rows in **clustering order**. That's the only index the storage engine gives you for free. So:

- **Partition key** — must be fully specified with `=` (or `IN`); it's how the coordinator finds the node. Without it, Cassandra doesn't know *which node* to ask.
- **Clustering columns** — can be filtered, but only as a **left-to-right prefix** with equality, and a range on the last one, because rows are physically sorted by them.
- **Any other column** — has no index. Filtering on it means scanning every partition on every node.

```cql
-- OK: partition key given, clustering range
SELECT * FROM orders_by_customer
  WHERE customer_id = ? AND order_ts >= ?;

-- Rejected: no partition key, filtering a non-key column
SELECT * FROM orders_by_customer WHERE status = 'paid';
-- Error: needs ALLOW FILTERING (a full scan)
```

The restriction is the feature: it forces every query into a shape the engine can serve efficiently. If you need to query by `status`, you model a table keyed by status.

### Q8. What do TTL and USING TIMESTAMP do on a write?

**TTL (time-to-live)** sets a per-write expiry in **seconds**. When the TTL elapses, the cell is treated as deleted — it becomes a tombstone and is eventually compacted away.

```cql
-- session row auto-expires after 1 hour
INSERT INTO sessions (id, token) VALUES (?, ?) USING TTL 3600;
```

**USING TIMESTAMP** overrides the microsecond write timestamp that drives last-write-wins. Normally the coordinator assigns `now()`; you override it when you need deterministic conflict resolution (e.g. replaying events in a specific order).

```cql
UPDATE users SET email = ? WHERE id = ? USING TIMESTAMP 1700000000000000;
```

Caveats: TTL'd data generates tombstones, so TTL-heavy tables (especially time-series) want **TWCS** compaction to drop whole expired SSTables. And hand-setting timestamps is a foot-gun — get the ordering wrong and a "newer" write loses.

### Q9. What does IF NOT EXISTS / IF do, and what's the catch?

They turn a write into a **conditional write** — a **lightweight transaction (LWT)** backed by Paxos.

```cql
-- create-only: fails (returns applied=false) if the row exists
INSERT INTO users (id, email) VALUES (?, ?) IF NOT EXISTS;

-- compare-and-set: only update if current status matches
UPDATE orders SET status = 'shipped'
  WHERE id = ? IF status = 'paid';
```

The catch: LWTs are **expensive**. Each one runs a Paxos consensus round (multiple round-trips among replicas at `SERIAL` consistency), so they can be **4x or more the latency** of a normal write and don't scale to high contention on the same partition. Use them sparingly — for genuine uniqueness constraints or state-machine transitions — never as your default write path. Overusing LWT is a well-known Cassandra anti-pattern.

### Q10. How does a CQL row map to what's actually stored?

A CQL row is a **view over a set of timestamped cells**, not a fixed physical record. When you write, each non-key column you set becomes a **cell**: `(partition key, clustering key, column name) → value, timestamp, [ttl]`.

Those cells are appended to the memtable and flushed into immutable **SSTables**. Over time, different writes to the *same* row can live in *different* SSTables. When you read the row, the engine **merges** all the cells for that primary key across the memtable and SSTables, taking the highest timestamp per cell. The "row" you get back is that reconstructed merge.

Consequences that follow directly:
- Partial updates are cheap — you only write the cells you touched.
- A deleted cell is a **tombstone** cell, also timestamped, that shadows older values until compaction removes it.
- Reads can touch many SSTables (read amplification), which is why bloom filters, caching, and compaction strategy matter.

### Q11. What are collections and UDTs for, and when do they bite you?

**Collections** (`list`, `set`, `map`) and **UDTs** let you embed structured, denormalized data inside a single row instead of a separate table.

```cql
CREATE TYPE address (street text, city text, zip text);
CREATE TABLE users (
  id uuid PRIMARY KEY,
  emails set<text>,
  prefs  map<text, text>,
  home   frozen<address>
);
```

Use them for **small, bounded** groupings that you always read with the row — a user's handful of phone numbers, a fixed set of flags.

Where they bite:
- **Unbounded growth** — a collection with thousands of elements becomes a large cell that's read/written whole; you can't page it. Model that as clustering rows instead.
- **Non-frozen collection updates** generate tombstones (especially list operations), hurting read latency.
- **Reads are all-or-nothing** — you can't fetch just part of a collection efficiently.

Rule: collections are embedded convenience for small data, not a substitute for proper partition/clustering modeling.

### Q12. Why is CQL deliberately limited compared to SQL?

To keep every supported query **cheap and predictable** — roughly O(1) in the number of partitions touched, and servable without cross-node coordination.

SQL's power (joins, arbitrary `WHERE`, `GROUP BY` over the whole table) assumes a single machine (or a coordinator that can scan/shuffle freely) and is fine at moderate scale. On a masterless cluster of hundreds of nodes, those operations would mean scatter-gather across the whole ring — unbounded latency, unpredictable load, no horizontal scalability. So Cassandra simply **doesn't offer them**. By restricting CQL to "name a partition, walk its clustering order", it guarantees that a query's cost is bounded and localizable. The limitation is a deliberate trade: you give up query flexibility to get linear scalability and predictable latency. This is why the modeling burden shifts to you — you design tables per query instead of querying flexibly over normalized tables.

### Q13. How do LIMIT and paging work in CQL?

`LIMIT n` caps the number of rows returned. Because a partition's rows are stored in **clustering order**, `LIMIT` on a single-partition query is efficient — it returns the first *n* rows in that sort order and stops.

```cql
-- newest 20 orders for a customer (clustered DESC on order_ts)
SELECT * FROM orders_by_customer
  WHERE customer_id = ? LIMIT 20;
```

**Paging** is handled by the driver via a **paging state** token: the server returns a page of rows plus an opaque cursor; the next fetch resumes from there. This streams large result sets without loading everything into memory — you don't do SQL-style `OFFSET` (there's no efficient offset). For "next page" UX you typically page within a partition using the last clustering value as a `WHERE order_ts < ?` bound, which is both efficient and stable.

### Q14. What is ALLOW FILTERING and why is it a red flag?

`ALLOW FILTERING` tells Cassandra: "I know this query isn't satisfied by the primary key — go ahead and scan and filter anyway." Cassandra normally *rejects* such queries to protect you.

```cql
-- forces a scan across partitions; O(cluster), unpredictable
SELECT * FROM orders_by_customer
  WHERE status = 'paid' ALLOW FILTERING;
```

Why it's dangerous at scale:
- It can read **every partition on every node**, then discard most rows — a full table scan disguised as a filter.
- Latency and load are **unbounded** and grow with data size; it'll pass in dev with 1,000 rows and time out in prod with 100 million.

It's occasionally acceptable **within a single partition** (you've already narrowed to one partition and are filtering its rows) or for one-off admin queries on tiny tables. As a production access pattern it's an anti-pattern — the correct fix is to **model a table** (or an SAI index) that serves the query by key. Seeing `ALLOW FILTERING` in app code is a review-blocking smell.

### Q15. How does schema (DDL) propagate across the cluster, given there's no master?

DDL changes (creating/altering keyspaces and tables) propagate via **gossip** — the peer-to-peer protocol nodes use to share state. When you run `CREATE TABLE`, the change is announced and nodes converge on a common **schema version**. You can check agreement with `nodetool describecluster` (it lists schema versions; all nodes should report the same UUID).

The gotcha: because there's no coordinator serializing DDL, **concurrent schema changes from different clients can cause schema disagreement** (a "schema mismatch"), which can wedge the cluster. Best practices:
- Make schema changes **one at a time, from a single client**, and wait for agreement before the next.
- Avoid programmatic on-the-fly `CREATE TABLE` in app hot paths.
- Prefer `IF NOT EXISTS` / `IF EXISTS` to make DDL idempotent.

Schema is eventually consistent like data, but disagreement here is operationally nastier, so you treat DDL as a careful, serialized admin operation.

### Q16. I have a SQL need: "get all active users in London." How do I translate that to Cassandra?

You don't bolt a `WHERE city = 'London' AND status = 'active'` onto a `users` table — those aren't the primary key, so it'd demand `ALLOW FILTERING` and scan everything.

Instead you **model a table for that access pattern**:

```cql
CREATE TABLE active_users_by_city (
  city        text,
  user_id     uuid,
  name        text,
  PRIMARY KEY (city, user_id)
);
-- query is now a single-partition read:
SELECT * FROM active_users_by_city WHERE city = 'London';
```

The partition key is `city` (the thing you filter on), and you only insert a row here when a user is active in that city (removing it when they deactivate). You maintain this table with application-side writes alongside the canonical `users_by_id` table.

The mindset shift: in Cassandra a "query" is answered by a table designed for it, not by filtering a general-purpose table. This is the doorway to **query-first data modeling** — every access pattern gets its own denormalized table.

## Query-First Data Modeling

### Summary

**What this topic covers**

The single most important skill for using Cassandra well — and the one relational engineers get most wrong: **query-first (query-driven) data modeling**. Where relational design starts from the *entities* (model the domain, normalize to third normal form, then query however you like with joins and ad-hoc `WHERE`s), Cassandra inverts the entire process. You **start from your queries** — the concrete read access patterns your application needs — and design a table for each one, denormalizing shamelessly so every query hits a single partition. The 17 questions here cover why this inversion is forced by the architecture (no joins, no ad-hoc queries, `ALLOW FILTERING` is a scan), the **one-table-per-query-pattern** rule, **denormalization as the default** (duplicate data everywhere; storage and writes are cheap, reads must be fast), keeping duplicated copies in sync via application-side fan-out writes, the conceptual→logical→physical workflow (Chebotko diagrams), computing partition size up front, and worked examples: a user profile, a message feed, an order history. The recurring lesson: your data model is *dictated by your reads*, and fighting that is how you end up with a slow, unscalable Cassandra deployment.

**Mental model**

Turn relational thinking upside down. In a relational database, the schema is a faithful, normalized model of the domain, and queries are an afterthought you compose at runtime. In Cassandra, **queries are the input and the schema is the output**. Before you write a single `CREATE TABLE`, you list every way the application will read data: "look up a user by id", "look up a user by email", "list a conversation's messages newest-first", "show a customer's orders by date". Each of those becomes its **own table**, keyed so the query is a single-partition read. The same logical data — a user — might be physically duplicated across `users_by_id`, `users_by_email`, and embedded inside `messages_by_conversation`. That duplication is not a bug; it is the design. Writes fan out to all the copies; reads stay O(1) in partitions. You accept **write amplification** and give up the ability to run queries you didn't plan for, in exchange for predictable, horizontally-scalable read latency. If a new query appears, you build a new table — you do not "add an index later".

**Key terms**

- **Query-first modeling** — derive tables from access patterns, not from entities; reads dictate schema.
- **Denormalization** — deliberately duplicating data across tables so each query is served by one partition.
- **One table per query** — the default heuristic; each distinct read pattern gets a purpose-built table.
- **Fan-out writes** — on an update, the app writes to every table holding a copy of that data.
- **Access pattern** — a specific read the application performs; the atomic unit of modeling.
- **Partition size budget** — keep partitions bounded (rows × cell size ≲ ~100MB, ideally far less).
- **Chebotko diagram** — notation for the conceptual→logical→physical modeling workflow.
- **Materialized view** — server-maintained denormalized copy keyed differently; convenient but caveated.
- **Write amplification** — extra writes incurred by maintaining duplicated copies; an accepted trade.
- **Ad-hoc query** — a query you didn't design a table for; effectively unsupported (scan / ALLOW FILTERING).
- **Secondary index / SAI** — table-local indexes; a limited tool, *not* the answer to arbitrary queries.

**Why interviewers ask this**

This is the topic that most reliably separates "has used Cassandra" from "has read about Cassandra". Almost every real-world Cassandra disaster traces back to relational instincts leaking in: someone modeled normalized tables and tried to join in the app, or added a secondary index to support an ad-hoc filter, or built one giant table and reached for `ALLOW FILTERING`. Interviewers give you an access pattern ("design a schema for a chat app / a feed / an order history") and watch whether you *start from the queries* and denormalize, or whether you draw an ER diagram and normalize. They want to hear you say "duplicate the data", "one table per query", "fan out the writes", and "compute the partition size" without prompting. Getting this right signals you'll build systems that scale; getting it wrong signals expensive re-architecture later.

**Common confusions**

- "Denormalization is a last-resort optimization" — in Cassandra it's the **default and correct** first move, not a hack.
- "I'll normalize now and add indexes for the other queries" — secondary indexes don't make ad-hoc queries scale; you model tables per query.
- "Duplicating data wastes storage" — storage is cheap; read latency is precious. The trade is intentional.
- "I can just join in the application" — you can, but app-side joins across partitions are the same scatter-gather you were avoiding; pre-join by denormalizing instead.
- "Materialized views solve the sync problem for free" — they automate one denormalization but carry real caveats (consistency, performance) and aren't a blanket answer.
- "One big flexible table is simpler" — it forces `ALLOW FILTERING` scans; multiple narrow purpose-built tables are the simple *scalable* answer.

**What follows from this topic**

Query-first modeling is the payoff of everything before it. It only works because of **tunable consistency** (you fan out writes and accept eventual convergence between copies), the **primary key** design (partition key for distribution, clustering for order — the topic this leans on hardest), and CQL's deliberate restrictions (no joins, no ad-hoc `WHERE`). It sets up the **anti-patterns** topic (hot partitions, unbounded partitions, secondary-index misuse) because bad modeling is *how* you create those pathologies. Materialized views and SAI (5.0) are the "can the server do some of this for me?" follow-ups — useful, but they don't repeal the core discipline: **know your queries first**.

### Q1. How does query-first modeling differ from relational modeling?

They run in **opposite directions**.

**Relational:** model the *domain* first. Identify entities and relationships, normalize (3NF) to eliminate duplication, define foreign keys. Queries come later and are flexible — joins and arbitrary `WHERE` clauses let you ask almost anything of a well-normalized schema. The schema is entity-driven; queries adapt to it.

**Cassandra (query-first):** model the *queries* first. Enumerate every read access pattern the app needs, then design **one table per pattern**, keyed so each query is a single-partition lookup. Duplication is embraced. The schema is query-driven; **the data model is dictated by the reads.**

The reason for the inversion is architectural: Cassandra has no joins and no efficient ad-hoc queries (that would require cross-node coordination on a masterless cluster). So you can't "query however you like later" — you must know the queries up front and build storage that serves them directly.

### Q2. Why is denormalization the default in Cassandra rather than a last resort?

Because the cost structure is inverted from a relational database. In Cassandra:

- **Storage is cheap** — disk is plentiful; duplicating data across tables costs almost nothing that matters.
- **Writes are cheap** — the LSM write path (append to commit log + memtable) makes writes extremely fast, so writing the same data to several tables is fine.
- **Reads must be fast and single-partition** — the one thing you protect is read latency, which means each query must hit exactly one partition with no joins.

So you **duplicate data** so that every query has a table shaped exactly for it. Normalization would force joins (which don't exist) or multi-partition reads (which don't scale). Denormalization is therefore the *first* design move, not a fallback. The mantra: "normalize for correctness in relational; denormalize for access in Cassandra."

### Q3. What does "one table per query pattern" mean in practice?

It means each distinct way you read the data gets its own purpose-built table, even if that duplicates the underlying entity.

Example — you need to look up a user two ways, by id and by email:

```cql
CREATE TABLE users_by_id (
  id uuid PRIMARY KEY,
  email text, name text, created_at timestamp
);

CREATE TABLE users_by_email (
  email text PRIMARY KEY,
  id uuid, name text, created_at timestamp
);
```

Two tables, same user, different partition keys — because the partition key must be the thing you look up by. On any user change you **write to both**. Each read is a clean single-partition lookup:

```cql
SELECT * FROM users_by_id    WHERE id = ?;
SELECT * FROM users_by_email WHERE email = ?;
```

You do *not* build one `users` table and try to query it by email without a matching key — that needs `ALLOW FILTERING` or an index and won't scale.

### Q4. Why are there no joins, and how do you cope without them?

There are no joins because a join across a masterless, horizontally-partitioned cluster would require **cross-node scatter-gather** — pulling matching rows from potentially every node and combining them. That's unbounded in latency and load and destroys horizontal scalability. Rather than offer a slow, unpredictable join, Cassandra simply doesn't have one.

You cope by **pre-joining at write time via denormalization**. Instead of joining `orders` to `users` at read time, you store the user's name (and whatever else the read needs) *inside* the orders table:

```cql
CREATE TABLE orders_by_customer (
  customer_id uuid,
  order_ts    timestamp,
  order_id    uuid,
  customer_name text,   -- denormalized from users
  total       decimal,
  PRIMARY KEY (customer_id, order_ts)
) WITH CLUSTERING ORDER BY (order_ts DESC);
```

The "join" happened when you wrote the row. The read is a single-partition scan. The cost is that if the customer's name changes you must update it in every table that copied it — an accepted trade.

### Q5. Why don't ad-hoc queries work, and what should I do instead?

An ad-hoc query filters on something that isn't part of a table's key. Cassandra can't serve it efficiently because its only free index is "hash the partition key → node, walk clustering order". Filtering on a non-key column means **scanning every partition on every node** (that's what `ALLOW FILTERING` does) — a full-cluster table scan with unbounded latency that works in dev and times out in prod.

What to do instead: **decide your queries in advance and model a table for each.** If a genuinely new query appears in production, you don't hack it with `ALLOW FILTERING` or a secondary index — you **build a new table** for it and backfill. That's the honest Cassandra answer, and it's why the up-front access-pattern analysis is so important: an access pattern you forgot is expensive to add later, so you enumerate them carefully at design time.

### Q6. Walk me through the query-first modeling workflow.

Five steps:

1. **List access patterns.** Enumerate every read the app performs, precisely: "get user by id", "get user by email", "list a user's most recent 50 orders by date". These are your inputs.
2. **One table per query.** Give each access pattern its own table.
3. **Choose the partition key** so the query filters on it *and* data spreads evenly across the cluster (avoid hot/huge partitions).
4. **Choose clustering columns** for the order the query wants and to make the primary key unique (e.g. cluster by `order_ts DESC`, add `order_id` to break ties).
5. **Validate partition size.** Estimate rows-per-partition × row width; keep partitions bounded (well under ~100MB, ideally far smaller). If a partition would grow unbounded, add a bucketing component to the partition key.

Then loop: for every write, work out which tables must be updated to keep the denormalized copies consistent. Formally this is the **conceptual → logical → physical** progression (Chebotko diagrams): entities and relationships → tables tied to queries → CQL with concrete keys and types.

### Q7. How do you handle a one-to-many relationship without joins?

You model the "many" as **clustering rows within the parent's partition**, denormalizing whatever the read needs.

Example — a customer (one) has many orders:

```cql
CREATE TABLE orders_by_customer (
  customer_id uuid,        -- partition key: the "one"
  order_ts    timestamp,   -- clustering: order the "many"
  order_id    uuid,
  total       decimal,
  status      text,
  PRIMARY KEY (customer_id, order_ts)
) WITH CLUSTERING ORDER BY (order_ts DESC);
```

`WHERE customer_id = ?` returns all that customer's orders, already sorted newest-first, in a single-partition read. No join, no separate lookup.

If you *also* need "get an order by its id" you build a second table `orders_by_id` keyed on `order_id`, and write to both on order creation. Many-to-one and many-to-many follow the same recipe: pick which side you query from, make it the partition, and fan out writes to maintain the reverse-lookup tables you need.

### Q8. If you duplicate data across tables, how do you keep the copies in sync?

It's the **application's responsibility** — Cassandra won't do it for you (there are no foreign keys or cascading updates). Options, roughly in order of commonness:

- **Fan-out writes in the app** — on an update, write to every table that holds a copy. The default approach.
- **Logged batches** — group the writes to multiple tables in a `BEGIN BATCH` so they're applied atomically-ish (all-or-nothing for the mutations), at a coordination cost. Good for keeping denormalized copies consistent; not a general transaction.
- **CDC / change data capture** — stream the commit log to a consumer that propagates changes to derived tables. Used at scale.
- **Materialized views** — let Cassandra maintain one denormalized copy automatically (with caveats).

The honest trade-off: because these copies are updated by separate writes, there's a **window where they can diverge** (a fan-out write partially fails, a batch is retried). You design for idempotent writes and reconcile via repair/backfill. Perfect cross-table consistency isn't on offer; you accept eventual convergence — the same bargain as tunable consistency.

### Q9. When should you use a materialized view versus maintaining a second table yourself?

A **materialized view (MV)** is a server-maintained table that automatically mirrors a base table under a *different* primary key — Cassandra keeps it in sync on every base write.

```cql
CREATE MATERIALIZED VIEW users_by_email AS
  SELECT * FROM users_by_id
  WHERE email IS NOT NULL AND id IS NOT NULL
  PRIMARY KEY (email, id);
```

Use an MV when you want a straightforward alternate-key view and you value not writing the sync code yourself.

Prefer a **manually-maintained table** when: you need full control over what's denormalized and when; you're worried about MV performance (each base write does extra read/write work); or you need shapes MVs can't express. MVs have real caveats — historically flagged as experimental, potential for the view to drift from the base under certain failures, and write-path overhead — so many production teams **avoid MVs and hand-roll the second table** for predictability. Rule of thumb: MV for convenience on simple cases; hand-rolled tables when you need control or scale.

### Q10. Describe the conceptual → logical → physical modeling process.

It's the disciplined path from domain understanding to CQL, formalized by **Chebotko diagrams**:

- **Conceptual** — an entity/relationship view of the domain, independent of Cassandra: users, orders, messages and how they relate. Same as you'd start relationally.
- **Logical** — bring in the **access patterns** and map each query to a table. This is where the inversion happens: tables are named after queries (`orders_by_customer`), and you decide partition keys (from the query's filter) and clustering columns (from its ordering). Chebotko notation annotates keys (K for partition, C↑/C↓ for clustering).
- **Physical** — concrete CQL: pick data types, add table options (compaction strategy, TTL, clustering order), validate partition sizes, and finalize.

The value of the process is that it forces you to reconcile the domain (conceptual) with the queries (logical) *before* committing to CQL (physical), so you catch missing access patterns and oversized partitions on paper rather than in production.

### Q11. How do you avoid relational instincts leaking into a Cassandra model?

Consciously suppress the reflexes that serve you well in SQL and hurt you here:

- **No normalization for its own sake.** Duplicate freely; don't factor a shared entity into its own table "to avoid repetition".
- **No "add an index later".** If a new query appears, build a *table*, not a secondary index — indexes don't make ad-hoc queries scale.
- **No app-side joins across partitions.** If you find yourself reading table A then table B to stitch results, you should have denormalized B's fields into A.
- **No general-purpose table + `ALLOW FILTERING`.** That's relational thinking ("I'll just filter") applied to a scan-hostile engine.
- **Start from queries, not an ER diagram.** If your first artifact is a normalized entity model with foreign keys, you're modeling relationally.

The tell that you've adapted: your table names read like queries (`messages_by_conversation`, `users_by_email`), the same field appears in several tables, and you can point to exactly which query each table serves.

### Q12. How does read-heavy versus write-heavy influence your modeling?

Both favor denormalization, but the emphasis shifts:

- **Read-heavy** — lean *harder* into denormalization and one-table-per-query. Pre-compute and store exactly what each read needs so reads touch one partition and merge few SSTables. You'll accept more duplicated copies and more write fan-out to keep reads trivial. Consider caching and compaction strategy (e.g. LCS for read-heavy tables to reduce SSTables per read).
- **Write-heavy** — you're already well-served (writes are cheap), but watch that fan-out doesn't explode: every extra denormalized table multiplies your write volume. Be deliberate about *how many* copies you maintain, and consider whether some derived tables can be built async (CDC) rather than in the hot write path. Time-series write-heavy workloads want TWCS and careful partition bucketing to bound partition growth.

The unifying point: denormalization is the trade, and you tune *how much* of it against the read/write ratio and the partition-size budget.

### Q13. Why is write amplification from denormalization an acceptable trade-off?

Because of Cassandra's cost asymmetry. A write goes to the **commit log + memtable** — an append, no read, no lock, no in-place update — so it's cheap and the LSM engine is built to sustain enormous write throughput. Writing the same logical change to three or four denormalized tables is still fast and horizontally scalable.

Reads are the expensive, latency-sensitive side: a read may have to merge a memtable and several SSTables, and a *cross-partition* read means scatter-gather across nodes. So the deal is: **pay a little extra on the cheap side (writes) to make the expensive side (reads) trivial.** You spend abundant, cheap resources (disk, write throughput) to protect the scarce, precious one (read latency at scale).

Contrast relational, where writes are comparatively expensive (index maintenance, constraint checks, locking) so you *minimize* duplication. Different cost model → opposite optimal strategy. Write amplification isn't a regrettable side effect; it's the mechanism that buys scalable reads.

### Q14. When you change denormalized data, do you UPDATE or re-INSERT, and does it matter?

Mechanically it doesn't matter — INSERT and UPDATE are the **same upsert** operation, both just write timestamped cells with no read-before-write. Either will overwrite the affected cells by last-write-wins.

What actually matters:

- **Touch every copy.** The real work isn't UPDATE vs INSERT, it's remembering to write the change to **all** the denormalized tables that hold that field. Miss one and it silently goes stale.
- **Watch key changes.** If the *value you changed is part of another table's partition/clustering key* (e.g. a user changes their email, and you have `users_by_email`), you can't UPDATE the key in place — you must **INSERT the new row and DELETE the old one**. Updating a component of the primary key isn't a mutation of the same row; it's a different row.
- **Idempotency.** Prefer writes that are safe to retry, since fan-out can partially fail.

So: use whichever verb reads clearly, but treat the *set of tables* and *key changes* as the thing to get right.

### Q15. Are secondary indexes the answer to ad-hoc queries?

No — that's one of the most common Cassandra mistakes.

A native secondary index is **local to each node**: it indexes that node's slice of the data. Querying by an indexed column with no partition key means the coordinator must **fan out to every node**, have each consult its local index, and gather results — a scatter-gather whose cost grows with cluster size. It works acceptably only in narrow cases (low-cardinality columns queried *within* a known partition), and behaves badly for high-cardinality columns (e.g. email) or as a general "let me filter by anything" tool.

The right answer for a new access pattern is a **denormalized table** keyed for that query. Indexes are a limited convenience, not a substitute for modeling.

**5.0 nuance:** **SAI (Storage-Attached Indexing)** is a much better index — more efficient, supports more predicates, lower overhead — and widens where indexing is reasonable. But even SAI doesn't repeal the discipline: for your primary, high-volume access patterns you still model tables; indexes (SAI included) supplement, they don't replace.

### Q16. Model the access patterns for a messaging app.

Access patterns first: (1) list a conversation's messages, newest first, paged; (2) fetch a single message by id; maybe (3) list a user's conversations.

Primary table for pattern (1):

```cql
CREATE TABLE messages_by_conversation (
  conversation_id uuid,
  bucket          text,       -- e.g. '2026-07' to bound partition size
  message_id      timeuuid,   -- time-ordered clustering
  sender_id       uuid,
  sender_name     text,       -- denormalized so no user join needed
  body            text,
  PRIMARY KEY ((conversation_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

- Partition key `(conversation_id, bucket)`: groups a conversation's messages together, and the **month bucket** caps partition growth for busy chats (avoids an unbounded partition).
- Clustering `message_id` (a `timeuuid`) `DESC`: newest-first order *and* uniqueness for free.
- `sender_name` is denormalized so rendering the feed needs no lookup into a users table.

Pattern (2) gets `messages_by_id` (partition key `message_id`); pattern (3) gets `conversations_by_user`. On send, the app **fans out** a write to each relevant table. Every read is a single-partition, correctly-ordered scan.

### Q17. Here's a schema — critique it. `CREATE TABLE events (id uuid PRIMARY KEY, user_id uuid, type text, created_at timestamp)` and you need "all events for a user, newest first".

The schema is modeled like a relational table and doesn't serve the query.

**What's wrong:**
- The query is "events **for a user**, newest first", but `user_id` and `created_at` aren't in the key. Running `WHERE user_id = ? ORDER BY created_at DESC` would demand `ALLOW FILTERING` — a full-cluster scan. Broken at scale.
- `id` as the sole partition key means every event is its own partition; there's no way to read a user's events together without scanning.

**Fix — model for the access pattern:**

```cql
CREATE TABLE events_by_user (
  user_id    uuid,
  bucket     text,       -- e.g. day/month to bound partition size
  created_at timeuuid,   -- clustering: newest-first + unique
  event_id   uuid,
  type       text,
  PRIMARY KEY ((user_id, bucket), created_at)
) WITH CLUSTERING ORDER BY (created_at DESC);
```

Now `WHERE user_id = ? AND bucket = ?` is a single-partition read, already sorted newest-first. The **bucket** keeps a heavy user's partition bounded (a firehose user would otherwise blow past the ~100MB partition budget). If you also need "get event by id", add an `events_by_id` table and fan out the write. That's the query-first correction: name the table after the query, key it for the filter and the order, and bound the partition.
## Primary Keys, Partition & Clustering Columns

### Summary

**What this topic covers**

The single most important thing to get right in Cassandra: the **primary key**. In Cassandra a primary key is not just a uniqueness constraint the way it is in a relational database — it is the physical layout of your data. The primary key = **partition key + clustering columns**, and each half does a completely different job. The partition key decides *which node/partition* a row lives on (it is hashed to a token and routed around the ring); the clustering columns decide the *order of rows within that partition* and complete row uniqueness. Get this split wrong and every later problem — hot partitions, unbounded partitions, `ALLOW FILTERING`, slow reads — flows from it. The 17 questions in this topic cover the CQL syntax (single vs composite partition key, the double-parens rule), clustering order, the "restrict in key order" query rule, why `ALLOW FILTERING` is a red flag, and how to design a key for both *distribution* and *query/order* at the same time.

**Mental model**

Picture a Cassandra table as a two-level map. The **outer key** is the partition key: hash it (Murmur3) to a token, the token tells you which node(s) own it. Everything with the same partition key is one **partition** — a contiguous, co-located, replicated unit that lives together on the same replicas. The **inner structure** is a sorted map keyed by the clustering columns: within one partition, rows are stored physically sorted by clustering column, in the order you declared. So a query is fast only when it says "give me *this* partition (I know the whole partition key), then walk a *contiguous slice* of the sorted rows inside it." That is a single seek to one node plus a sequential scan — the operation Cassandra is built for. Anything else (unknown partition, skipping a clustering column, filtering a non-key column) forces a scan across partitions/nodes, which is why the query planner refuses it without `ALLOW FILTERING`. Design the key by asking two questions in order: (1) what column(s) evenly spread the data and are always known at read time → partition key; (2) how do I want rows *sorted and range-scanned* inside each partition → clustering columns.

**Key terms**

- **Primary key** — partition key + clustering columns together; uniquely identifies a row.
- **Partition key** — the first component; hashed to a token to pick the owning node(s). Determines *where* data lives.
- **Clustering column(s)** — order rows *within* a partition; determine on-disk sort and complete uniqueness.
- **Partition** — all rows sharing one partition key; the unit of co-location, replication, and most reads.
- **Composite (compound) partition key** — a partition key of multiple columns, written with double parens `((a, b))`; all must be supplied to read.
- **Compound primary key** — a primary key with one or more clustering columns after the partition key.
- **Clustering order** — `WITH CLUSTERING ORDER BY (col DESC)`; stores rows pre-sorted for efficient range/reverse reads.
- **Token** — the hash of the partition key that places it on the ring.
- **Slice query** — a range read over clustering columns within one partition.
- **`token()`** — CQL function to read/compare the token of a partition key; used for paging across partitions.
- **`ALLOW FILTERING`** — opt-in flag that lets a query scan rows/partitions server-side; a red flag in production.
- **Static column** — a column scoped to the partition (one value shared by all rows in it), not per clustering row.

**Why interviewers ask this**

This is the fastest way to tell a Cassandra engineer from someone applying relational instincts to a NoSQL store. A junior says "the primary key makes rows unique." A senior says "the partition key controls distribution and the clustering columns control on-disk order, so I choose them from my *query patterns*, not my entities." Interviewers probe: can you write the CQL for a composite partition key and explain the double parens? Can you state the restriction rule ("you must give the whole partition key and a contiguous prefix of clustering columns")? Do you flinch when you see `ALLOW FILTERING`? Do you understand that clustering order is a *storage* decision that makes "newest first" free? These questions separate people who have modeled real Cassandra tables from people who have only read that "it's a NoSQL database."

**Common confusions**

- "The partition key and the primary key are the same thing." No — the partition key is the *first part* of the primary key; clustering columns are the rest.
- "I can query by a clustering column alone." No — you must supply the whole partition key first, then a contiguous prefix of clustering columns.
- "`PRIMARY KEY (a, b)` and `PRIMARY KEY ((a, b))` are the same." Completely different: the first is partition key `a` + clustering `b`; the second is a *composite partition key* of `a` and `b` with no clustering column.
- "`ALLOW FILTERING` makes my query work, so it's fine." It makes it *run*, not *scale* — it scans and gets slower as data grows.
- "Clustering order is just an ORDER BY at query time." It's a *storage* directive; it decides physical sort so reverse/range reads are cheap.
- "Uniqueness is enforced like a relational PK." There's no read-before-write — a duplicate primary key is an **upsert** (last write wins), not an error.

**What follows from this topic**

Everything downstream. **Partition Design & Anti-patterns** is the direct sequel: once you know the partition key controls placement, you learn how a *bad* one creates hot or unbounded partitions and how bucketing fixes it. **The Write Path** explains why upsert-by-primary-key is so fast (append-only, no read-before-write). Query-first data modeling, secondary indexes vs SAI, and tombstones all assume you can already reason about partitions and clustering order. If this topic is shaky, fix it before anything else — it is the foundation the whole primer stands on.

### Q1. What is a primary key in Cassandra, and how is it different from a relational primary key?

In Cassandra the primary key does two jobs a relational PK never does: it decides **which node** your data lives on and **how rows are sorted on disk**. It is made of two parts:

```cql
PRIMARY KEY (partition_key, clustering_col1, clustering_col2)
```

- The **partition key** (first component) is hashed to a token that routes the row to its owning replicas.
- The **clustering columns** (the rest) order rows within that partition and complete the uniqueness.

In a relational DB the primary key is a uniqueness/lookup constraint and an index; storage layout is largely independent of it. In Cassandra the primary key *is* the storage layout. And there is no read-before-write: inserting a duplicate primary key is an **upsert** (last-write-wins), not a constraint violation.

### Q2. What is the difference between a partition key and a clustering column?

| | Partition key | Clustering column |
|---|---|---|
| Job | Decides *which* partition/node | Orders rows *within* a partition |
| Mechanism | Hashed (Murmur3) → token → replicas | Stored physically sorted |
| Must supply to read | Always, in full | Contiguous prefix only |
| Controls | Distribution across the ring | On-disk sort + range scans |
| Cardinality goal | High, even spread | Whatever your sort/range needs |

The partition key answers "where does this data live?" The clustering columns answer "in what order do I want the rows inside that partition, and how do I range-scan them?" You choose the partition key for **distribution** and the clustering columns for **query/order**.

### Q3. Explain the CQL syntax for single, compound, and composite partition keys.

```cql
-- Single-column partition key, no clustering column
PRIMARY KEY (user_id)

-- Compound primary key: partition key user_id + clustering column ts
PRIMARY KEY (user_id, ts)

-- Composite (multi-column) partition key: (user_id, day) hashed together,
-- then clustered by ts
PRIMARY KEY ((user_id, day), ts)
```

The **double parens** are the critical detail. `PRIMARY KEY (a, b)` means partition key `a`, clustering column `b`. `PRIMARY KEY ((a, b))` means a *single composite partition key* built from both `a` and `b` — you must supply **both** to read, and there is no clustering column. Mixing these up is one of the most common modeling bugs in Cassandra.

### Q4. What is a composite partition key and when would you use one?

A composite partition key hashes **multiple columns together** into one token:

```cql
CREATE TABLE events_by_sensor_day (
  sensor_id text,
  day       date,
  ts        timestamp,
  value     double,
  PRIMARY KEY ((sensor_id, day), ts)
);
```

Two reasons to reach for it:

1. **Bound partition size (bucketing).** `sensor_id` alone would put *all* readings for a sensor forever in one partition (unbounded). Adding `day` creates one partition per sensor per day, keeping each partition small.
2. **Spread/group load deliberately.** Combining columns changes which token — and therefore which node — the data lands on.

The trade-off: you must now supply **both** `sensor_id` **and** `day` on every read. You can't query across all days for a sensor in one shot — you fan out per day (or precompute another table).

### Q5. How is a row uniquely identified in Cassandra?

By its **full primary key** — the partition key plus *all* clustering columns. Two rows are the same row (and later writes upsert into it) if and only if every primary-key component matches.

```cql
PRIMARY KEY ((conversation_id), message_ts, message_id)
```

Here a message is unique per `(conversation_id, message_ts, message_id)`. If two writes share all three, the second overwrites the first cell-by-cell (last-write-wins by timestamp). `message_id` is often added as a tiebreaker so two messages with the same timestamp don't collide.

### Q6. What are clustering columns and what does clustering order do?

Clustering columns define the **physical sort order of rows inside a partition**. You can pin that order explicitly:

```cql
CREATE TABLE messages_by_conversation (
  conversation_id uuid,
  message_ts      timestamp,
  message_id      timeuuid,
  body            text,
  PRIMARY KEY ((conversation_id), message_ts, message_id)
) WITH CLUSTERING ORDER BY (message_ts DESC, message_id DESC);
```

`CLUSTERING ORDER BY (message_ts DESC)` stores rows **newest-first on disk**. That makes "give me the last 50 messages" a cheap sequential read from the front of the partition — no sort at query time, no reverse scan. Clustering order is a *storage* decision, not a query-time `ORDER BY`: you're choosing how the SSTables lay bytes down. Reverse iteration is possible but cheaper when it matches the stored order.

### Q7. What is the rule for which queries Cassandra allows, and why?

The rule: **supply the entire partition key** (equality), then restrict clustering columns as a **contiguous prefix** — equality on the leading ones, and equality or a **range** on the last one you touch. You may not skip a clustering column, and you may not restrict a later one without restricting all earlier ones.

Why? Because the data is physically sorted exactly that way. Cassandra needs the full partition key to find the *one* partition (single seek), and clustering restrictions become a **contiguous slice** of the sorted rows. Skipping a column would require scanning and stitching non-adjacent rows — which is not a slice, so the planner refuses it (unless you force `ALLOW FILTERING`).

```cql
-- PRIMARY KEY ((conversation_id), message_ts, message_id)
-- OK: whole partition key + range on first clustering column
SELECT * FROM messages_by_conversation
WHERE conversation_id = ?
  AND message_ts >= ? AND message_ts < ?;

-- REJECTED: skips message_ts to restrict message_id
SELECT * FROM messages_by_conversation
WHERE conversation_id = ? AND message_id = ?;
```

### Q8. Why can't you query on a non-key column without ALLOW FILTERING?

Because there is no index that maps that column's value back to a partition/row. Cassandra only knows how to (a) hash a partition key to a node and (b) slice sorted rows by clustering column. A predicate on any other column can only be satisfied by **reading rows and filtering them in memory** — potentially across every partition on every node.

```cql
-- body is not part of the key and has no index
SELECT * FROM messages_by_conversation WHERE body = 'hello';
-- InvalidRequest: use ALLOW FILTERING (don't!)
```

The Cassandra answer is not "add ALLOW FILTERING" — it's "if you need to query by `body`, model a table (or SAI index) whose key/index supports that access pattern."

### Q9. Why is ALLOW FILTERING considered a red flag in production?

`ALLOW FILTERING` tells Cassandra to fetch candidate rows and filter them **server-side**, which can mean scanning entire partitions — or, without a partition key restriction, scanning the whole ring. Its cost is **unpredictable and unbounded**: it works fine on 10 rows in dev and melts the cluster at scale, because latency grows with data volume, not with result size.

It's an interview trap: the interviewer shows a query that "only works with ALLOW FILTERING" and watches whether you *fix the query* or *fix the model*. The right instinct is almost always the model — add a table or SAI index that makes the access pattern a real key lookup. Legitimate uses are rare: analytics over a single, already-restricted small partition, or one-off admin queries. In an application hot path, treat it as a bug.

### Q10. Here's a query that needs ALLOW FILTERING. How do you fix the data model?

```cql
CREATE TABLE users (
  user_id uuid PRIMARY KEY,
  email   text,
  country text
);
-- App needs: all users in a country. This forces ALLOW FILTERING:
SELECT * FROM users WHERE country = 'US' ALLOW FILTERING;   -- scans everything
```

Fix it with **query-first modeling**: build a table whose partition key *is* the thing you query by.

```cql
CREATE TABLE users_by_country (
  country text,
  user_id uuid,
  email   text,
  PRIMARY KEY ((country), user_id)
);
SELECT * FROM users_by_country WHERE country = 'US';   -- one partition, no filtering
```

Now the read is a single-partition slice. Caveat: `country` is low-cardinality, so `('US')` could become a **hot/large partition** — the natural next step is to bucket it (e.g. `PRIMARY KEY ((country, signup_month), user_id)`), which is exactly the **Partition Design** topic.

### Q11. What are static columns and how do they relate to the primary key?

A **static column** is scoped to the **partition**, not to individual clustering rows — there is one value per partition, shared by every row in it.

```cql
CREATE TABLE messages_by_conversation (
  conversation_id uuid,
  title           text STATIC,     -- one per conversation, not per message
  message_ts      timestamp,
  body            text,
  PRIMARY KEY ((conversation_id), message_ts)
);
```

`title` belongs to the conversation (the partition), so it's stored once and updatable independently of any message. Static columns only make sense when the partition has clustering columns (otherwise every row *is* the partition). They're handy for partition-level metadata and for LWT conditions scoped to a partition — a preview of later topics.

### Q12. How do you design a primary key for both distribution and query order?

Split the decision into two independent questions and answer them in order:

1. **Distribution (partition key):** which column(s) are (a) always known at read time and (b) high-cardinality enough to spread evenly across the ring, while (c) keeping the partition bounded in size? That's your partition key — possibly composite/bucketed.
2. **Order & range (clustering columns):** within that partition, how do I want rows sorted, and what range scans do I run? That's your clustering columns + `CLUSTERING ORDER BY`.

```cql
-- "latest readings per sensor per day", newest first
CREATE TABLE readings_by_sensor_day (
  sensor_id text,
  day       date,
  ts        timestamp,
  value     double,
  PRIMARY KEY ((sensor_id, day), ts)
) WITH CLUSTERING ORDER BY (ts DESC);
```

Partition key `(sensor_id, day)` distributes and bounds; clustering `ts DESC` gives free newest-first range reads. The key is derived from the **access pattern**, never from the entity's "natural" identity.

### Q13. What's a slice query, and how do ranges on clustering columns work?

A **slice query** reads a **contiguous run of rows within one partition** using a range on a clustering column. Because rows are stored sorted by clustering column, the range maps to a single seek + sequential scan.

```cql
-- PRIMARY KEY ((sensor_id, day), ts) ... CLUSTERING ORDER BY (ts DESC)
SELECT * FROM readings_by_sensor_day
WHERE sensor_id = 's1' AND day = '2026-07-01'
  AND ts >= '2026-07-01T09:00' AND ts < '2026-07-01T10:00';
```

Rules: you can range only on the **last clustering column you restrict**, and all earlier clustering columns must be pinned with equality. `LIMIT` plus the stored order makes "latest N" trivial: `... WHERE sensor_id=? AND day=? LIMIT 50` returns the 50 newest rows because they're physically first.

### Q14. How does the token() function help you page across partitions?

Because partitions are ordered by **token** (not by partition-key value), you can't say `WHERE partition_key > x` to page across partitions. Instead you compare **tokens**:

```cql
SELECT * FROM users_by_country
WHERE token(country) > token('US')
LIMIT 1000;
```

`token()` exposes the hash Cassandra uses to place partitions on the ring, so you can walk the whole ring in token order in bounded chunks — the classic full-table-scan/export pattern. In practice you rarely hand-roll this: the driver's automatic paging (`fetch_size` / paging state) handles slicing within and across partitions for you. `token()` is the manual tool when you need explicit, resumable range-based scans over an entire table.

### Q15. What's the difference between a partition and a row?

A **row** is a single record identified by the full primary key. A **partition** is the **set of all rows sharing one partition key** — the physical, co-located, replicated unit Cassandra stores and reads together.

```
Partition  (conversation_id = C1)          <- one partition, lives on RF replicas
  ├─ row (message_ts=10:00, message_id=a)  <- rows, sorted by clustering columns
  ├─ row (message_ts=10:01, message_id=b)
  └─ row (message_ts=10:02, message_id=c)
```

A partition can hold one row (when there are no clustering columns) or millions (a wide partition). Reads and replication operate at the partition level; this is why "how big can one partition get?" is the question that decides whether your cluster stays healthy.

### Q16. Model a time-series schema and explain the key choices.

Requirement: store per-sensor readings, query "latest readings for sensor X" and "readings for sensor X in a time window," at high write volume.

```cql
CREATE TABLE readings_by_sensor (
  sensor_id text,
  bucket    date,        -- day bucket to bound partition size
  ts        timestamp,
  value     double,
  PRIMARY KEY ((sensor_id, bucket), ts)
) WITH CLUSTERING ORDER BY (ts DESC);
```

Choices, justified:

- **Partition key `(sensor_id, bucket)`** — `sensor_id` gives even spread (many sensors); `bucket` (day) bounds each partition so it can't grow unbounded over months/years.
- **Clustering `ts DESC`** — physically newest-first, so "latest N" is a front-of-partition `LIMIT` with no sort.
- **Reads** — `WHERE sensor_id=? AND bucket=?` for a day; range on `ts` within it for a window; fan out across buckets for multi-day.

The cost is the multi-day fan-out and the client needing to know the bucket — a deliberate trade to keep partitions healthy.

### Q17. What's wrong with this schema, and how do you fix it?

```cql
CREATE TABLE orders (
  status   text,
  order_id uuid,
  customer uuid,
  total    decimal,
  PRIMARY KEY ((status), order_id)
);
```

Two problems, both rooted in the partition key:

1. **Low-cardinality, hot partition.** `status` has a handful of values (`'pending'`, `'shipped'`…). All pending orders share **one partition on one set of replicas**, so that node takes disproportionate read/write load while others idle.
2. **Unbounded partition.** Orders in a status accumulate forever, so `('pending')` grows without limit — huge partition, slow reads, compaction/GC pressure.

Fix by choosing a distributing, bounding partition key and modeling the actual access pattern:

```cql
-- If you query "recent orders by customer":
CREATE TABLE orders_by_customer (
  customer  uuid,
  bucket    date,
  order_id  timeuuid,
  status    text,
  total     decimal,
  PRIMARY KEY ((customer, bucket), order_id)
) WITH CLUSTERING ORDER BY (order_id DESC);
```

`customer` spreads load (high cardinality), `bucket` bounds size, and if you truly need "all pending orders" that becomes its own bucketed table or an SAI index — not a low-cardinality partition key.

## Partition Design & Anti-patterns

### Summary

**What this topic covers**

Partition design is the **number-one thing that makes or breaks a Cassandra cluster** — more than hardware, more than tuning, more than consistency levels. Nearly every production Cassandra incident traces back to a bad partition key. This topic covers the two ways partitions go wrong — **hot partitions** (traffic concentrated on one partition/node) and **large/unbounded partitions** (a partition that grows without limit) — the practical size targets that keep you safe, the fix (**bucketing / partition splitting**), how to estimate partition size, how to detect problems with `nodetool`, and the classic anti-patterns (low-cardinality keys, celebrity keys, global buckets, queue-style tombstone churn). The 16 questions here turn "the partition key controls placement" (from the previous topic) into a working discipline for keeping every partition small, evenly loaded, and bounded.

**Mental model**

Think of the cluster as a ring of nodes, and every partition key as a dart thrown at the ring by a hash function. Two things can go wrong. First, **too many darts land in the same spot** — a hot partition. That happens when the partition key has low cardinality (`country`), or when one value is disproportionately popular (a celebrity user), or when you funnel everything into a single "global" bucket. One node melts while the rest idle; vnodes don't save you because the *key* is the problem, not the range assignment. Second, **one spot keeps accumulating darts forever** — a large/unbounded partition. That happens when a partition has no natural bound (all events for one sensor, for all time). The partition grows until reads, compaction, and GC on that partition degrade. The cure for both is the same idea: **add a component to the partition key** — a time bucket to bound growth, a hash/modulo bucket to spread load. You are constantly balancing "one partition per query is efficient" against "don't let any partition grow unbounded or get too hot."

**Key terms**

- **Hot partition** — a partition receiving disproportionate traffic, overloading its replicas while others idle.
- **Large / unbounded partition** — a partition that grows without limit; blows up memory, compaction, and read latency.
- **Bucketing (partition splitting)** — adding a time and/or hash component to the partition key to bound size and spread load.
- **Cardinality** — number of distinct values of the partition key; drives how evenly data spreads.
- **Cell** — a single column value in a row; partition size ≈ rows × columns (cells).
- **Wide partition** — a partition with very many rows; a spectrum, dangerous at the large end.
- **`nodetool tablehistograms`** — per-table latency/partition-size distribution, incl. max partition size.
- **`nodetool tablestats`** — table-level stats incl. compacted partition max bytes and cell counts.
- **Compaction** — background merge of SSTables; large/tombstone-heavy partitions make it expensive.
- **Celebrity problem** — one hot key (a popular user/entity) skewing an otherwise fine key.
- **Global bucket** — a single partition key value everything funnels into; a hot-partition anti-pattern.
- **Queue anti-pattern** — a partition with heavy insert+delete churn → tombstone accumulation.

**Why interviewers ask this**

This is where interviewers find out if you've actually *operated* Cassandra or only read about it. A junior chooses the partition key from the entity ("orders are keyed by status"). A senior chooses it from **distribution + bounded size + access pattern**, and can immediately spot that `status` is a hot, unbounded partition waiting to happen. Expect scenario questions: "here's a schema, what breaks at scale?" and "your p99 read latency is climbing on one table — why?" The signal they want: you know the ≲100MB / ≲100k-rows guidance, you reach for bucketing reflexively, you can estimate a partition's size from rows × columns, and you know that "it worked in dev with 10 rows" is exactly how these bugs hide until production traffic exposes them.

**Common confusions**

- "vnodes spread load, so partition design doesn't matter." vnodes spread *token ranges*; a single hot key still lands on one partition/node.
- "Wide partitions are fine, Cassandra handles millions of rows." Up to a bound — past ~100MB / 100k rows they degrade reads, compaction, and GC.
- "One partition per query is always best." Only if that partition stays small and cool; unbounded/hot partitions are worse than a small fan-out.
- "High cardinality is always good." Too-high cardinality (a unique key per row) makes millions of tiny partitions — also suboptimal for range access.
- "The 2-billion-cells number is the target." That's a *hard limit*; you want to stay far below it (≲100MB, ≲100k rows).
- "Deleting rows frees the partition immediately." Deletes write **tombstones**; the space and read cost linger until `gc_grace_seconds` + compaction.

**What follows from this topic**

This is the operational sequel to **Primary Keys, Partition & Clustering Columns**: that topic taught you *what* the partition key does; this one teaches you how to keep it healthy. The **queue/tombstone** and **tombstone-heavy partition** previews here open into the deletes-and-tombstones topic (gc_grace, zombie data, compaction). Bucketing connects to time-series modeling and TWCS compaction. And the detection tooling (`nodetool tablehistograms`, large-partition log warnings) links to the read-path and performance-diagnosis topics, where wide partitions show up as p99 latency spikes.

### Q1. Why is partition design the most important decision in a Cassandra data model?

Because the partition key simultaneously controls **where data lives**, **how evenly load spreads**, and **how big each stored unit gets** — and Cassandra gives you almost no runtime escape hatch if you get it wrong. There are no joins to paper over a bad layout, no query planner to route around a hot spot, and reshaping the key means rewriting the table.

Nearly every serious Cassandra production incident — one node at 100% CPU, p99 read latency spiking, compaction falling behind, OOM/GC pauses — traces back to a hot or unbounded partition. Consistency levels, compaction strategy, and hardware are all secondary: they can't rescue a model that concentrates traffic or lets a partition grow forever. Get the partition key right and the cluster is boring; get it wrong and no amount of tuning saves you.

### Q2. What is a hot partition and what causes it?

A **hot partition** is a partition that receives a disproportionate share of reads and/or writes, so the (small set of) replicas owning it are overloaded while the rest of the cluster idles.

Common causes:

- **Low-cardinality partition key** — e.g. `PRIMARY KEY ((country), ...)`: `('US')` absorbs a huge fraction of traffic.
- **Celebrity/skewed key** — the key is high-cardinality in theory but one value dominates (a celebrity user's timeline, one giant tenant).
- **Global bucket** — everything funnels into a single key like `('all')` or `('today')`.
- **Monotonic/time-only key** — keying by "current hour" sends *all* current writes to one partition at once.

The tell is per-node imbalance: one node hot, others cool, for the same table. vnodes don't help — the hash sends one key to one place regardless.

### Q3. What is a large or unbounded partition and why is it dangerous?

A **large partition** is one holding too much data; an **unbounded partition** is one with no natural limit, so it grows forever. Example: `PRIMARY KEY ((sensor_id), ts)` puts *every reading for a sensor, for all time* in one partition.

Why it hurts:

- **Reads slow down** — a read may touch the whole partition across multiple SSTables; wide partitions mean more data merged per query, spiking p99.
- **Compaction gets expensive** — merging a giant partition is CPU/IO-heavy and can fall behind.
- **Memory/GC pressure** — building/serializing large partitions strains heap; repair and streaming a huge partition is painful.

It's insidious because it's invisible early: with a week of data the partition is small and fast. Months later it's hundreds of MB and the same query is timing out.

### Q4. What are the practical size limits you should target for a partition?

Rules of thumb (not hard laws, but battle-tested):

- **≲ 100 MB** per partition.
- **≲ 100,000 rows** per partition.
- **~2 billion cells** is the *hard* architectural limit — treat it as a cliff you never approach, not a target.

Aim well under the soft targets so that growth, wide rows, and compaction overhead have headroom. Equally important is **even distribution**: you want partitions roughly the same size across the ring, not one 500 MB monster among thousands of tiny ones. If a partition trends toward these numbers, that's the signal to bucket it.

### Q5. What is bucketing and how does it fix partition problems?

**Bucketing** (partition splitting) adds a component to the partition key so one logical grouping becomes many bounded partitions. Two flavors, often combined:

- **Time bucket** — bound *growth* over time.
- **Hash/modulo bucket** — bound *load* by spreading a hot key.

```cql
-- Before: unbounded — all readings for a sensor forever in one partition
PRIMARY KEY ((sensor_id), ts)

-- After: one partition per sensor per day — bounded size
PRIMARY KEY ((sensor_id, day), ts)

-- Hot single key spread across N sub-partitions:
-- bucket = hash(user_id) % 10, written alongside the row
PRIMARY KEY ((celebrity_id, bucket), post_ts)
```

Time buckets cap how big any partition can ever get; hash buckets scatter a celebrity/global key across several partitions/nodes. The cost is read fan-out — "last 7 days" now reads 7 partitions, and a spread key must query all buckets — a deliberate trade for a healthy cluster.

### Q6. How do you estimate the size of a partition?

Start from **cells**: a partition's cell count ≈ **number of rows × number of (non-key) columns per row** (regulars and collections add up; collection elements count as cells too). Multiply by average cell size for a rough byte estimate, and add per-row/per-cell overhead.

```
cells ≈ rows_per_partition × columns_per_row
size  ≈ cells × avg_cell_bytes  (+ overhead)
```

Example: a sensor writing every second, 5 columns, kept for a year in one partition:
`31.5M rows × 5 ≈ 158M cells` — orders of magnitude past the ≲100k-rows guidance, clearly unbounded. Do this arithmetic **at design time** using expected write rate × retention, not after production melts. It's the fastest way to catch an unbounded partition before it ships.

### Q7. How do you detect partition problems in a running cluster?

Use the tooling and the logs:

```bash
# Per-table partition-size distribution incl. max partition (bytes)
nodetool tablehistograms <keyspace> <table>

# Table stats: compacted partition max bytes, mean cells, tombstones
nodetool tablestats <keyspace>.<table>
```

- **`tablehistograms`** shows the partition-size and latency percentiles — a huge "max partition bytes" or a fat tail is your smoking gun.
- **`tablestats`** shows compacted partition max/mean and average cells per slice.
- **Logs**: Cassandra emits **"Writing large partition"** / compacting-large-partition **warnings** past `compaction_large_partition_warning_threshold`.
- **Symptoms**: rising p99 reads on one table, one node hot, compaction backlog, long GC pauses.

Correlate a hot node + a fat partition histogram + large-partition log warnings and you've found it.

### Q8. Why do uneven partitions cause uneven load even with vnodes?

Vnodes split each node's ownership into **many small token ranges**, which balances how *token space* is distributed — assuming keys hash uniformly. But vnodes operate on **token ranges, not on traffic per key**. If one partition key is hot or huge, all of its reads/writes hash to the **same token**, land in the **same range**, and hit the **same replicas** — no matter how finely you've sliced the ring.

So vnodes fix *range* imbalance (some nodes owning more of the ring than others); they do nothing for *key* imbalance (one key being 1000× more popular, or one partition being 1000× bigger). The distribution is only as even as your partition key's cardinality and access distribution allow.

### Q9. How do you balance "one partition per query" against "don't grow unbounded"?

These two goals pull against each other, and modeling is finding the sweet spot:

- **"One partition per query"** wants a *coarse* key so a query hits a single partition — efficient, one seek.
- **"Bounded partition"** wants a *fine* key so no partition grows too large or too hot.

Bucketing is the compromise: choose the **coarsest key that still keeps the partition within ≲100MB / ≲100k rows** over its lifetime. Size the bucket to your data rate — a low-volume sensor might bucket by month; a high-volume one by hour. You accept a small, bounded read fan-out (query a handful of buckets) in exchange for never having a hot or unbounded partition. The wrong answers are the extremes: one giant partition (unbounded) or a bucket so fine every query fans out across hundreds of partitions.

### Q10. Compare low-cardinality, high-cardinality, and too-high-cardinality partition keys.

| Cardinality | Example key | Effect |
|---|---|---|
| **Too low** | `country`, `status`, `('all')` | Few huge, hot partitions — one node overloaded |
| **Good** | `user_id`, `(sensor_id, day)` | Many evenly-sized, well-distributed partitions |
| **Too high** | `event_uuid` (unique per row) | Millions of tiny 1-row partitions |

Low cardinality → hot/large partitions. **Just-right** cardinality gives even spread with partitions big enough to serve a query but small enough to stay healthy. **Too-high** cardinality (a distinct key per row) technically distributes perfectly but is often suboptimal: you lose the ability to range-scan related rows in one partition, every read is a separate partition lookup, and you may need a scatter-gather. The goal isn't "maximize cardinality" — it's "even distribution with partitions sized to your access pattern."

### Q11. What is the queue/messaging anti-pattern in Cassandra?

Using a Cassandra partition as a **work queue** — insert jobs, read them, then **delete** them as they're processed — is a classic anti-pattern. The problem is **tombstones**: every delete writes a tombstone, and a queue partition sees continuous insert+delete churn, so the partition fills with tombstones that aren't reclaimed until `gc_grace_seconds` + compaction.

The result is **tombstone hell**: reads at the front of the queue must scan past thousands of tombstoned (deleted-but-still-present) rows to find live ones, so read latency climbs and can hit tombstone thresholds that abort the query. Cassandra's LSM/append-only storage is built for immutable, accumulating data, not high-churn delete-heavy workloads. Queues want a purpose-built system (Kafka, SQS, a real queue). This previews the tombstones topic: deletes are writes, and delete-heavy access patterns are where Cassandra hurts most.

### Q12. How do wide partitions cause read amplification?

A read for a partition may have to consult the **memtable plus every SSTable that holds part of that partition**, then merge them (reconciling by timestamp, skipping tombstones). The wider the partition, the more data lives across more SSTables, so a single logical read touches **more bytes, more SSTables, and more cells** — that's read amplification.

Even a slice (`LIMIT 50`) can suffer: to return 50 live rows the read may scan past tombstones and buffer more data than it returns. Wide partitions also blunt bloom filters and partition indexes (more offset to scan within the partition). The net effect is that p99 read latency on a table is often a direct function of its **max partition size** — which is exactly why the size targets and detection tooling matter.

### Q13. How do you choose a good compound (composite) partition key?

Work through four checks:

1. **Always known at read time** — every component must be supplied on every read, so pick columns the query always has.
2. **Even distribution** — the combination should hash to many well-spread tokens (high enough cardinality, no dominant value).
3. **Bounded size** — include a component (usually a time bucket) that caps how large any partition can grow over the data's lifetime.
4. **Acceptable fan-out** — the more you bucket, the more partitions a range query touches; keep that fan-out small.

```cql
-- Good: distributes by sensor, bounds by day, both known at query time
PRIMARY KEY ((sensor_id, day), ts)
```

The best key is derived from the **write rate × retention × access pattern**, not from the entity's identity. If any of the four checks fails, revisit before you ship.

### Q14. What ongoing monitoring would you set up for partition health?

Track partition size and its consequences continuously, not just at design time:

- **Max/mean partition size per table** — from `nodetool tablehistograms` / `tablestats`, exported to your metrics stack; alert on tables trending toward ≲100MB.
- **Large-partition log warnings** — alert on the "Writing large partition" / compacting-large-partition log lines.
- **Per-node load skew** — CPU, read/write throughput, and pending-compaction per node; a persistent single-node hot spot signals a hot partition.
- **p99 read latency per table** — the earliest user-visible symptom of a widening partition.
- **Tombstone metrics** — tombstones scanned per read and tombstone-threshold warnings, to catch queue-like churn.

The point is to catch the slow creep — a partition that's fine today and 200 MB in three months — before it becomes an incident.

### Q15. This schema has a hot/unbounded partition. Diagnose and fix it.

```cql
CREATE TABLE page_views (
  site_id  text,
  viewed_at timestamp,
  user_id  uuid,
  url      text,
  PRIMARY KEY ((site_id), viewed_at, user_id)
);
```

Diagnosis — **both** failure modes at once:

- **Hot partition**: `site_id` is low-cardinality and skewed — one popular site's partition takes most of the write traffic, hammering its replicas.
- **Unbounded partition**: all views for a site, forever, in one partition — it grows without limit.

Fix with time bucketing (bound size) and, for a dominant site, a hash bucket (spread load):

```cql
CREATE TABLE page_views (
  site_id   text,
  day       date,
  shard     int,        -- e.g. hash(user_id) % 8, to split a hot site's day
  viewed_at timestamp,
  user_id   uuid,
  url       text,
  PRIMARY KEY ((site_id, day, shard), viewed_at, user_id)
) WITH CLUSTERING ORDER BY (viewed_at DESC);
```

Now each partition is one site/day/shard — bounded and spread. Reads for a day fan out across the shards (a small, fixed number), the deliberate cost of a healthy layout.

### Q16. Why does "it worked in dev with 10 rows" hide these problems?

Because both failure modes are **functions of scale and time**, and dev has neither. With 10 rows:

- A hot partition looks fine — 10 rows on one node is trivial load; you only see imbalance under production concurrency and volume.
- An unbounded partition looks fine — it hasn't had months of real traffic to grow; the size cliff is invisible until the data accumulates.
- Tombstone/queue churn looks fine — you haven't done millions of insert/delete cycles yet.

So the schema passes every dev test, ships, and then degrades weeks or months later as one partition heats up or balloons — often with no code change to blame. The defenses are **design-time estimation** (rows × columns × retention) and **production monitoring** of partition size/skew, precisely because functional testing at small scale can't surface these.

## The Write Path

### Summary

**What this topic covers**

Why Cassandra writes are famously, almost suspiciously, fast — and exactly what happens on each node when you write. This topic walks the write path end to end: the coordinator sending to replicas, the **commit log** append (durability), the **memtable** update (memory), the acknowledgement once the consistency level is met, and the later **flush to an immutable SSTable**. It covers the design choices that make writes cheap — **append-only, no read-before-write, no in-place update, no locks** — and the machinery around them: **hinted handoff** for down replicas, commit-log durability modes, memtable flush triggers, **upsert / last-write-wins** semantics, how **RF and CL** interact on writes, and write atomicity. The 15 questions here explain the LSM-tree advantage and set up the read-path and compaction topics (where the cost of cheap writes comes due).

**Mental model**

A Cassandra write does the least possible synchronous work. There is **no read-before-write**: Cassandra doesn't look up the current row, doesn't check existence, doesn't lock. It just records "at timestamp T, column X = value" as a new cell. On each replica that means two cheap operations: a **sequential append to the commit log** (so the write survives a crash) and an **in-memory update to the memtable** (a sorted structure). Both are fast — one sequential disk write, one memory write, zero random-access seeks. The write is acknowledged as soon as the **consistency level's worth of replicas** confirm. Later, asynchronously, the memtable fills and is **flushed to disk as an immutable SSTable**, and the commit-log segment is recycled. Nothing is ever modified in place — updates and deletes are just new timestamped cells, reconciled at read time by **last-write-wins**. This is the LSM tree: make writes trivially cheap by deferring all the merging/sorting work to background compaction and to reads. The price of fast writes is paid later.

**Key terms**

- **Coordinator** — the node handling the client request; forwards the write to all RF replicas.
- **Commit log** — append-only on-disk log written first for **durability**; replayed after a crash.
- **Memtable** — in-memory, sorted, per-table write buffer updated alongside the commit log.
- **SSTable** — immutable Sorted String Table on disk; a flushed memtable.
- **Flush** — writing a full memtable out to a new SSTable; frees the commit-log segment.
- **Append-only / no in-place update** — writes never modify existing data; they add timestamped cells.
- **No read-before-write** — writes don't read current state, so there's no lookup/lock cost.
- **Upsert** — insert and update are identical; last write (by timestamp) wins.
- **Hinted handoff** — coordinator stores a "hint" for a down replica and replays it when the node returns.
- **`max_hint_window`** — how long hints are kept for a down node before being dropped.
- **RF / CL** — replication factor (copies) vs consistency level (acks to wait for) on a write.
- **`commitlog_sync`** — durability mode: `periodic` (batched fsync) vs `batch` (fsync before ack).

**Why interviewers ask this**

"Why are Cassandra writes so fast?" is a staple, and the depth of your answer is the signal. A junior says "it's in memory." A senior says "append-only commit log plus memtable, **no read-before-write, no in-place update, no locks** — it's an LSM tree, so the work is deferred to compaction." From there interviewers probe the trade-offs: what makes writes durable if they're acknowledged from memory (the commit log)? What happens when a replica is down (hinted handoff — and why it's *not* a substitute for repair)? How do RF and CL interact on a write? Why are writes faster than reads (writes append; reads may merge many SSTables + memtable)? Getting these right shows you understand not just that Cassandra is fast, but *why*, and what you pay for it later.

**Common confusions**

- "Writes go straight to SSTables." No — they go to the commit log + memtable; SSTables are written later on flush.
- "Acknowledging from memory means writes aren't durable." The **commit log** (on disk, first) provides durability even before the flush.
- "An update modifies the existing row." Nothing is modified in place; an update writes a new timestamped cell, reconciled by last-write-wins.
- "Hinted handoff guarantees consistency, so I don't need repair." Hints expire (`max_hint_window`) and can be lost; **repair** is the real anti-entropy backstop.
- "CL controls how many replicas store the data." RF controls copies; CL controls how many **acks** the coordinator waits for — the write is still sent to all RF.
- "A batch is faster/atomic across partitions." A single write to one partition is atomic; multi-partition atomicity needs a logged batch/LWT and isn't free.

**What follows from this topic**

The write path is the setup for the whole storage story. It creates the **immutable SSTables** that the **compaction** topic later merges (and where "write amplification" is paid). It explains why the **read path** is harder than the write path (a read may merge memtable + multiple SSTables, using bloom filters and caches). The **tombstones** topic is a direct corollary — deletes are just writes (timestamped tombstone cells), which is why delete-heavy patterns hurt. **Counters** and **LWT** are called out as the exceptions that *do* read-before-write. And **RF/CL** here connects to the tunable-consistency topic (R + W > RF). Understanding why writes are cheap is the key that unlocks the rest of Cassandra's storage engine.

### Q1. Why are writes in Cassandra so fast?

Because a write does the **least possible synchronous work** and never touches disk randomly. The design removes the expensive parts of a traditional write:

- **No read-before-write** — Cassandra doesn't fetch the current row or check existence; it just records a new timestamped cell.
- **No in-place update** — nothing existing is modified, so no random-access seek to find and rewrite a page.
- **No locks** — no row/page locking or coordination on the write path.

What's left is cheap: a **sequential append to the commit log** and an **in-memory memtable update**. Both are fast — one sequential IO and one memory write — and the write is acknowledged as soon as the consistency level is met. This is the LSM-tree bargain: make writes trivial by deferring the sorting/merging work to background compaction and to read time.

### Q2. Walk through the Cassandra write path step by step.

1. **Coordinator receives** the write and forwards it to **all RF replicas** for the partition (routing via the token).
2. On **each replica**, two things happen together:
   - **(a) Append to the commit log** on disk — sequential, for durability (survives a crash).
   - **(b) Update the memtable** in memory — a sorted, per-table write buffer.
3. **Acknowledge** — once the **consistency level's** worth of replicas confirm (a), (b), the coordinator returns success to the client.
4. **Flush (later, async)** — when a memtable fills (or on a trigger), it's flushed to a new **immutable SSTable** on disk, and the corresponding commit-log segment can be recycled.

```
client → coordinator → [replica: commit log (disk) + memtable (mem)] ×RF
                         └── ack when CL satisfied ──→ client
   ...later... memtable full → flush → immutable SSTable; commit-log segment recycled
```

No random seeks, no read-modify-write — just append + memory.

### Q3. What is the role of the commit log?

The commit log is Cassandra's **durability** mechanism. Every write is appended to it **on disk, sequentially, before (or as) the write is acknowledged**, so that if the node crashes with data still only in the (volatile) memtable, nothing is lost.

On restart, Cassandra **replays the commit log** into fresh memtables, reconstructing any writes that hadn't yet been flushed to SSTables. Once a memtable is flushed to an SSTable, its commit-log segment is no longer needed and gets recycled. So the commit log is the reason "acknowledged from memory" is still safe: the durability lives in the sequential on-disk log, not in the memtable. Its durability strength is tunable via `commitlog_sync` (periodic vs batch fsync).

### Q4. What is the memtable and when is it flushed?

The **memtable** is an in-memory, per-table, **sorted** write buffer. Every write updates the memtable (alongside the commit-log append); reads also consult it (it holds the newest data not yet on disk).

It's flushed to an immutable SSTable when any of these fire:

- **Size** — the memtable (or the overall memtable heap/offheap budget) exceeds its threshold.
- **Commit log pressure** — the commit log needs to recycle space.
- **Time** — a configurable max flush interval.
- **Manual** — `nodetool flush`.

```bash
nodetool flush <keyspace> <table>   # force memtables to SSTables
```

On flush the sorted memtable is written out sequentially as a new SSTable, and its commit-log segment can be freed. This is why writes stay cheap — the sorting/merging is batched and deferred to flush + compaction.

### Q5. What is an SSTable and why is it immutable?

An **SSTable** (Sorted String Table) is an on-disk file of a flushed memtable: rows **sorted by primary key**, written **sequentially**, with supporting structures (partition index, bloom filter, compression, stats).

It's **immutable** — once written, it is never modified. Updates and deletes don't edit it; they land in the memtable and become *new* SSTables on the next flush. Immutability is what makes writes cheap and safe: writing is always a sequential append of a fresh file, never a random-access rewrite, so there's no locking or in-place mutation. The cost is that a partition's data can end up spread across **many** SSTables over time, which is why **compaction** exists (to merge them) and why the **read path** is more work than the write path.

### Q6. Why do writes never require random-access disk seeks?

Because both durable steps are sequential or in-memory. The **commit-log append** writes to the *end* of a log file — pure sequential IO, the fastest thing a disk (spinning or SSD) does. The **memtable update** is a pure memory operation. Neither needs to locate and rewrite an existing on-disk record, so there's no seek to a random page.

Contrast a B-tree/relational update, which typically must **find** the target page (seek/read), modify it, and write it back — random IO that gets worse as data grows. Cassandra's LSM design trades that away: writes only ever append (commit log) or touch memory (memtable), and all the sorting/merging is deferred to background compaction. Sequential-append + memory is the core reason write throughput is so high and so predictable.

### Q7. What is hinted handoff and what problem does it solve?

**Hinted handoff** keeps writes flowing when a replica is temporarily **down**. If the coordinator sees that a replica for the partition is unavailable, it stores a **hint** — a record of the missed write — locally, and **replays** it to that replica once it comes back online. This improves **availability** (the write can still succeed at the required CL if enough *other* replicas ack) and helps replicas catch up quickly on return.

```
coordinator: replica R3 is down
  → write to R1, R2 (ack CL)
  → store hint for R3
  ...R3 returns...
  → coordinator replays hint to R3
```

Hints are kept only for `max_hint_window` (e.g. 3 hours by default) — after that the down node is considered too stale and hints are dropped, on the assumption you'll run repair.

### Q8. Why is hinted handoff not a substitute for repair?

Because hints are **best-effort and time-bounded**, not a guarantee. Several ways a write can be missed permanently despite hints:

- The replica is down **longer than `max_hint_window`** — hints stop being stored/are dropped.
- The **coordinator storing the hints itself dies**, or hints are lost/overrun.
- The write happened while the node was down **and** no hint was written (e.g. coordinator didn't know, or during certain failure windows).

**Repair** (`nodetool repair`, using Merkle trees to compare replicas and stream differences) is the real anti-entropy backstop — it reconciles *all* divergence between replicas, regardless of cause. Hinted handoff reduces how much repair has to do; it doesn't replace it. Best practice is regular scheduled repair (within `gc_grace_seconds`) precisely because you can't rely on hints for completeness.

### Q9. What is the difference between commitlog_sync periodic and batch mode?

It's the durability-vs-latency knob for the commit log:

| Mode | fsync behavior | Trade-off |
|---|---|---|
| **periodic** (default) | fsync the commit log on an interval (e.g. every 10s); **ack before fsync** | Fast writes; a crash can lose up to the last interval's un-fsynced writes |
| **batch** | fsync **before** acknowledging the write | Stronger durability (nothing acked is lost); higher write latency |

`periodic` gives you Cassandra's headline write speed but a small window of potential data loss on a hard crash. `batch` guarantees an acknowledged write is on stable storage before the client hears success, at a latency cost. Most deployments run `periodic` and rely on RF (multiple replicas) so a single node's small loss window is covered by other copies. It's a per-node durability policy, distinct from the per-query consistency level.

### Q10. Explain upsert semantics and last-write-wins.

Cassandra doesn't distinguish INSERT from UPDATE — both are **upserts**. Because there's **no read-before-write**, a write never checks whether the row exists; it just records timestamped cells for the given primary key. If the key is new, a row appears; if it exists, the new cells overwrite the old ones — **at read time**, by comparing timestamps.

```cql
INSERT INTO users_by_id (id, name) VALUES (1, 'alice');   -- creates
UPDATE users_by_id SET name = 'bob' WHERE id = 1;         -- same as another insert
INSERT INTO users_by_id (id, name) VALUES (1, 'carol');   -- upsert, no error
```

**Last-write-wins (LWW):** each cell carries a timestamp; when reads (or compaction) reconcile multiple versions, the **highest timestamp wins**. This is why clock skew matters and why "insert if not exists" needs **LWT** (lightweight transactions) — plain writes can't detect existence.

### Q11. How do replication factor and consistency level interact on a write?

They're independent knobs. **RF** = how many replicas *store* each partition (fixed per keyspace). **CL** = how many replicas must *acknowledge* before the coordinator returns success (per query).

Critically, the write is **sent to all RF replicas regardless of CL** — CL only decides how many acks you *wait for*.

```
RF = 3, write CL = QUORUM (2)
coordinator → sends to all 3 replicas
           → returns success after 2 ack (the 3rd completes async / via hints)
```

So `CL=ONE` still writes to all 3 replicas; it just acks after 1. This is the basis of tunable consistency: pair write CL and read CL so that **R + W > RF** (e.g. QUORUM write + QUORUM read on RF=3) for strong consistency, or lower CL for lower latency and weaker guarantees.

### Q12. Is a Cassandra write atomic? At what granularity?

A single write to a **single partition** is **atomic and isolated** — all its columns (even across multiple rows within that one partition) either apply together or not at all, and a concurrent reader won't see a partial write. That's the granularity Cassandra guarantees for free.

What you **don't** get for free:

- **Multi-partition atomicity** — a write touching several partitions is not atomic across them by default. A **logged batch** provides atomicity (all-or-nothing) across partitions, but *not* isolation and at a coordination cost — not a general-purpose transaction.
- **Conditional/serializable semantics** — "insert if not exists" / compare-and-set need **LWT** (Paxos), which is much slower.

So: reach for the natural single-partition atomicity by modeling related data into one partition; use logged batches or LWT only when you truly need cross-partition atomicity or conditions, knowing the cost.

### Q13. Who supplies the write timestamp, and why does it matter?

Every cell is written with a **timestamp**, used for last-write-wins reconciliation. By default the **coordinator** assigns it (microseconds since epoch); clients can override it with `USING TIMESTAMP`.

```cql
UPDATE users_by_id USING TIMESTAMP 1720000000000000
SET name = 'alice' WHERE id = 1;
```

It matters because **the highest timestamp wins**, everywhere — reads, compaction, conflict resolution. Consequences:

- **Clock skew** across nodes/clients can cause a "later" write to lose to an earlier one, or a delete to mask a newer insert — keep clocks tightly synced (NTP).
- **Client-supplied timestamps** let you control ordering (idempotent replays, backfills) but you own the correctness — a stale timestamp silently no-ops against newer data.

Timestamps are the whole basis of Cassandra's conflict resolution, so getting them right is a correctness issue, not a detail.

### Q14. Why do fast writes lead to write amplification later?

Because the work you skipped at write time doesn't disappear — it's deferred. Each flush creates a **new immutable SSTable**, and updates/deletes to a partition scatter its data across **many** SSTables over time. To keep reads efficient and reclaim space (obsolete versions, tombstones), Cassandra runs **compaction**: it reads multiple SSTables and rewrites them into fewer, merged ones.

That rewriting means the same logical data gets **written to disk multiple times** over its life — **write amplification**. So the cheap append at write time is paid back later as background IO. The chosen **compaction strategy** (STCS, LCS, TWCS, UCS) is essentially a knob trading write amplification against read and space amplification. This is the direct sequel to the write path: fast writes now, compaction cost later.

### Q15. Why are writes faster than reads in Cassandra?

Because the **write path is trivial and the read path may be expensive**. A write appends to the commit log and updates the memtable — sequential IO + memory, no lookup. A read, by contrast, may have to **gather and merge a partition's data from multiple places**:

- the **memtable** (newest, unflushed data), plus
- **potentially several SSTables** on disk (data scattered by successive flushes/updates),
- using **bloom filters** to skip SSTables that can't contain the key, the **partition index/summary** to locate offsets, and **caches** where available,
- then **reconcile by timestamp** (last-write-wins) and **skip tombstones**.

So writes are O(append) while reads can be O(merge across N SSTables) — and wide partitions or tombstone buildup make reads worse. This asymmetry is the essence of the LSM tree: defer and amortize the hard work (sorting, merging, cleanup) out of the write path, paying it at read time and in compaction.
## The Read Path

### Summary

**What this topic covers**

How Cassandra actually answers a read — the single most misunderstood part of the system, because in Cassandra **reads are harder than writes**, the exact inverse of most people's intuition from relational databases. Writes are a blind append (commit log + memtable, no read-before-write); reads have to *reconstruct* the current state of a row that may be scattered across the memtable and many immutable SSTables, with tombstones masking deleted cells, and then reconcile that across replicas at the requested consistency level. This topic's 16 questions walk the read path end to end: coordinator replica selection, the per-replica lookup accelerators (bloom filter, key cache, partition index & summary, row cache), timestamp-based merge/reconciliation, read repair, digest reads, speculative retry, and the operational reality of diagnosing a slow read (`nodetool cfstats`, `TRACING ON`, SSTables-touched, cache tuning, wide-partition cost).

**Mental model**

Picture a read as a two-level fan-in. **Level 1 — the cluster:** the coordinator hashes the partition key to find the replica set, then contacts as many replicas as the consistency level (CL) demands — the closest/fastest first, others for digest comparison. **Level 2 — one replica's disk:** that replica must assemble the row from every place a fragment could live: the current **memtable** plus every **SSTable** that might hold cells for this partition. It doesn't blindly scan them all — it uses accelerators (bloom filter to skip SSTables that definitely lack the key, key cache + partition index/summary to jump straight to the byte offset, optional row cache to skip the work entirely) — then **merges** the fragments cell-by-cell, newest write-timestamp wins, tombstones erase. The coordinator then reconciles replica answers, returns the newest, and repairs stale ones (**read repair**). Everything that makes reads slow — too many SSTables, tombstone pileup, wide partitions, high CL — is a consequence of this two-level fan-in.

**Key terms**

- **Coordinator** — the node handling the client request; picks replicas, gathers responses, reconciles, returns the answer.
- **Bloom filter** — per-SSTable probabilistic set: "might this SSTable contain this partition key?" No false negatives, some false positives; lets a replica skip SSTables that definitely lack the key.
- **Key cache (partition key cache)** — caches the index offset for recently read partition keys, skipping the partition-index lookup.
- **Partition summary / partition index** — the summary is an in-memory sample of the on-disk partition index; together they resolve a partition key to a byte offset inside an SSTable.
- **Row cache** — optional cache of whole rows/partitions in memory; huge win for tiny hot rows, dangerous for wide partitions.
- **Merge / reconciliation** — combining fragments across memtable + SSTables by write timestamp; newest cell wins, tombstones mask deletes.
- **Read repair** — when replicas disagree at CL > ONE, the coordinator returns the newest data and writes it back to stale replicas.
- **Digest read** — a lightweight hash of a replica's data used to detect mismatch cheaply without shipping full data.
- **Speculative retry** — the coordinator sends an extra read to another replica if the first is slow, to protect p99.
- **SSTables-per-read** — how many SSTables a single read had to touch; the primary read-latency lever.

**Why interviewers ask this**

The read path is the fastest way to tell a Cassandra operator from a Cassandra tourist. A junior says "it reads from disk." A senior explains *why a single read can touch 30 SSTables*, how the bloom filter and key cache keep that off the hot path, why compaction strategy bounds it (LCS ≈ one SSTable per level), and how tombstones turn a cheap read into a timeout. This is also the topic where the tunable-consistency story becomes concrete: the interviewer wants to hear that CL controls *which and how many replicas* are read, that R + W > RF is what buys strong consistency, and that read repair is the mechanism that heals divergence. Get this right and you can credibly own a production cluster's p99.

**Common confusions**

- "Reads are fast because writes are fast." Writes are fast *because they skip the read*; reads pay the reconstruction cost writes deferred.
- "The bloom filter tells you the row is in the SSTable." No — it only rules SSTables *out*; a positive is "maybe," still requiring a real lookup.
- "Row cache always helps." It can wreck you on wide partitions — one cached partition can be hundreds of MB and thrash the cache.
- "Read repair is a separate repair job." No — it's inline, per-read, opportunistic; `nodetool repair` (Merkle-tree anti-entropy) is the scheduled full repair.
- "Higher consistency = safer, always use ALL." ALL kills availability and latency and disables retry; LOCAL_QUORUM is the workhorse.

**What follows from this topic**

The read path is where three other topics collide. **Storage Engine: SSTables & Compaction** explains why SSTables-per-read exists and how each compaction strategy bounds it. **Tombstones, Deletes & TTL** explains the single most common cause of slow reads. And the **consistency / replication** model explains the coordinator's replica selection and read repair. If your reads are slow, the answer is almost always in one of those three — usually compaction (too many SSTables) or tombstones.

### Q1. Why are reads more complex and often slower than writes in Cassandra?

Because a write is a blind append and a read is a reconstruction.

A write goes to the **commit log** (durability) and the **memtable** (memory) and returns — no disk seek, no read-before-write, no checking whether the row already exists. That's why Cassandra ingests writes so fast.

A read has to find the *current* value of a row whose fragments may be spread across:

- the **memtable** (not yet flushed), plus
- **many immutable SSTables** (each flush created a new one; an overwrite doesn't modify the old SSTable, it writes a newer cell elsewhere), plus
- **tombstones** that mask deleted cells.

The replica must locate every relevant fragment, **merge them by write timestamp** (newest cell wins, tombstones erase), and only then does it have the row. The more SSTables a partition's data is spread across, the more work per read. This is the fundamental LSM-tree trade: cheap writes, reconstruction-cost reads — which is why compaction (merging SSTables) is what keeps reads fast.

### Q2. Walk me through the Cassandra read path end to end.

Two levels: cluster, then replica.

**Cluster level (coordinator):**
1. Client sends the read to any node — that node becomes the **coordinator**.
2. Coordinator hashes the partition key → token → replica set (RF replicas).
3. Based on the **consistency level**, it queries enough replicas: typically one **full data read** from the closest/fastest replica plus **digest reads** from others to compare cheaply.
4. It waits for CL responses, reconciles them (newest timestamp wins), returns the answer, and triggers **read repair** if replicas disagreed.

**Replica level (per node building its answer):**
1. Check the **row cache** (if enabled) — hit returns immediately.
2. Read the **memtable** for any recent cells.
3. For on-disk data, for each SSTable: check its **bloom filter** — skip if it says "definitely not here."
4. For surviving SSTables, use the **key cache** (or the **partition summary → partition index**) to get the exact byte offset.
5. Read the relevant cells from each SSTable's Data file.
6. **Merge** memtable + SSTable fragments by timestamp, applying tombstones, to build the row.

The coordinator then combines replica answers and returns the reconciled row.

### Q3. What is a bloom filter and how does it speed up reads?

A **bloom filter** is a per-SSTable probabilistic data structure that answers one question: "might this SSTable contain this partition key?"

- **No false negatives** — if it says "no," the key is definitely not in that SSTable, so the read skips it entirely (no disk IO).
- **False positives possible** — if it says "maybe," the read still has to look; occasionally that lookup finds nothing.

The payoff: with many SSTables, most of them don't hold a given partition, and the bloom filter lets a replica avoid touching them. It lives in memory (off-heap), so the check is cheap.

You can trade memory for accuracy with `bloom_filter_fp_chance` per table — lower false-positive chance means a bigger filter but fewer wasted lookups. If you see reads touching SSTables that don't contain the key, or high memory pressure from filters, this is the knob.

### Q4. What are the partition summary and partition index, and how do they fit the read?

They translate a partition key into a **byte offset** inside an SSTable so the replica can seek straight to the data instead of scanning.

- **Partition index** — an on-disk structure mapping partition keys → offsets in that SSTable's Data file.
- **Partition summary** — an in-memory *sample* of the partition index (every Nth entry). It narrows the search to a small region of the index so you read only a tiny slice from disk.

Read order once the bloom filter says "maybe": check the **key cache** first (offset cached directly). On a miss, consult the **partition summary** to find roughly where in the **partition index** to look, read that index chunk to get the exact offset, then seek into the Data file. Modern Cassandra (BIG/BTI formats) refines these structures, but the concept holds: summary narrows, index resolves, then seek.

### Q5. What is the key cache and how does it differ from the row cache?

Both are read accelerators, but they cache different things and carry very different risk.

| | Key cache | Row cache |
|---|---|---|
| Caches | Partition key → SSTable offset | Entire row/partition data |
| Saves | The index lookup (one seek) | The whole read (all seeks + merge) |
| Default | On, safe, cheap | Off, use sparingly |
| Danger | Minimal | Wide partitions blow up memory |
| Good for | Almost all workloads | Small, hot, rarely-changing rows |

**Key cache** is nearly free and on by default — it just remembers where a partition lives on disk. Leave it on.

**Row cache** caches the actual row content, so a hit skips the entire read path. But it caches the *whole partition*; one wide partition can be hundreds of MB and evict everything useful. It's also invalidated on write. Only enable it (`caching = {'rows_per_partition': 'N'}`) for small, read-heavy, write-light partitions — otherwise it hurts.

### Q6. How does Cassandra merge data from the memtable and multiple SSTables?

By **write timestamp**, per cell. Every cell (column value) carries the timestamp of the write that produced it. To build a row, Cassandra gathers that cell from every source — memtable and each relevant SSTable — and keeps the one with the **newest timestamp**. This is **last-write-wins (LWW)** at cell granularity.

Tombstones participate in the same comparison: a tombstone is just a cell with a timestamp and a "deleted" marker. If the newest thing for a cell is a tombstone, the cell reads as absent (until compaction removes both).

Two consequences:
- A row you read may be assembled from cells sourced from different SSTables at different times — Cassandra stitches them together.
- Clock skew matters: because reconciliation is timestamp-based, badly skewed clocks across the cluster can make an older write "win." Use NTP; for correctness-critical updates use LWT (Paxos) or client-supplied timestamps carefully.

### Q7. What is read repair and when does it run?

**Read repair** is inline anti-entropy: when a read at **CL > ONE** contacts multiple replicas and their responses disagree, the coordinator returns the newest version to the client **and** writes that newest version back to the stale replicas, healing them.

- **Blocking read repair** — happens on the foreground read path when replicas that were required to satisfy the CL disagree; the coordinator repairs before returning, so it costs latency but guarantees the client gets consistent data.
- **Asynchronous / background** — historically `read_repair_chance` / `dc_local_read_repair_chance` gave a probability of also querying and repairing extra replicas beyond CL, in the background. These table options are deprecated/removed in modern Cassandra (4.0+); read repair is now driven by the `read_repair` table option (`BLOCKING` default, or `NONE`) tied to the CL path.

Read repair only fixes data you actually read. It is **not** a substitute for scheduled `nodetool repair`, which uses Merkle trees to fix *all* divergence, including data no one has queried recently.

### Q8. What is a digest read and why does Cassandra use it?

A **digest read** is a cheap way to detect replica disagreement without shipping full data.

When the coordinator reads at CL > ONE, it asks **one** replica for the full data and the **others** for just a **digest** — a hash of the data they'd return. If all digests match the full read's digest, the replicas agree and the coordinator returns immediately, having transferred one full payload plus a few small hashes.

If a digest *mismatches*, the coordinator knows there's divergence, so it issues full data reads to the disagreeing replicas, reconciles by timestamp, returns the newest, and triggers read repair.

The win is network efficiency: you get multi-replica consistency checking at roughly the bandwidth cost of a single-replica read, only paying full price when there's actually a conflict to resolve.

### Q9. How does the consistency level affect read latency and which replicas are queried?

CL sets *how many* replica acknowledgements the coordinator must collect before answering, which directly controls latency and which replicas participate.

| CL | Replicas needed | Latency | Notes |
|---|---|---|---|
| ONE / LOCAL_ONE | 1 | Lowest | May read stale data; fastest/closest replica |
| LOCAL_QUORUM | majority in local DC | Moderate | The workhorse for multi-DC; strong within DC |
| QUORUM | majority across all DCs | Higher | Cross-DC latency creeps in |
| ALL | every replica | Highest | No fault tolerance; one slow/down replica stalls the read |

Higher CL means waiting on more (and often more distant) replicas, so **tail latency tracks the slowest replica in the required set**. It also increases the chance of detecting and repairing divergence.

The consistency guarantee comes from **R + W > RF**: e.g. RF=3 with QUORUM writes (W=2) and QUORUM reads (R=2) → 2+2 > 3, so a read always overlaps the latest write. For most workloads, **LOCAL_QUORUM read + LOCAL_QUORUM write** is the right default — strong consistency without cross-DC latency.

### Q10. What is speculative retry and how does it protect p99?

**Speculative retry** protects tail latency by not letting one slow replica hold up a read. If the first replica the coordinator queried hasn't responded within a threshold, the coordinator proactively sends the read to an *additional* replica and uses whichever answers first.

It's configured per table via the `speculative_retry` option:
- `99PERCENTILE` (common default) — retry once a read exceeds the table's p99 latency.
- `Xms` — retry after a fixed millisecond delay.
- `ALWAYS` — always query an extra replica.
- `NONE` — disabled.

The point is p99/p999: without it, a single GC pause, disk hiccup, or hot node on the required replica set turns into a client-visible latency spike. With it, the coordinator routes around the straggler. It costs extra read work, so it's a deliberate latency-vs-load trade — usually worth it for read-latency-sensitive tables.

### Q11. My p99 read latency just spiked. How do you diagnose it?

Work from the read path outward. The usual suspects, in rough order of likelihood:

1. **Too many SSTables per read** — compaction fell behind. Check `nodetool cfstats <ks>.<table>` for "SSTables in each level" / "SSTable count" and the "SSTables per read" histogram; check `nodetool compactionstats` for pending compactions. Fix: let compaction catch up, review strategy (LCS for read-heavy).
2. **Tombstones** — a partition full of deletes/expired TTLs. `TRACING ON` a slow query and look for "tombstone cells read"; watch `tombstone_warn_threshold` in logs. Fix: model out deletes, TWCS+TTL, repair within gc_grace.
3. **Wide/hot partition** — one partition far larger than the rest. `nodetool tablehistograms` shows partition-size and cell-count percentiles.
4. **Consistency level too high / a slow replica** — ALL or QUORUM waiting on a struggling node; check per-node latency, GC pauses, `nodetool tpstats` for dropped reads.
5. **Cache pressure** — row cache thrashing on wide partitions, or key-cache hit rate collapsed.

Concretely: `TRACING ON;` then run the slow query — the trace tells you exactly how many SSTables were touched and how many tombstones were scanned, which usually points straight at the cause.

### Q12. How do you see how many SSTables a read is touching?

Two tools.

**Query tracing** — the surgical view of one query:
```cql
TRACING ON;
SELECT * FROM messages_by_conversation WHERE conversation_id = 42;
TRACING OFF;
```
The trace lists each stage, including how many SSTables were read and how many tombstone cells were scanned for that specific query.

**cfstats / tablehistograms** — the aggregate view for a table:
```bash
nodetool cfstats acme.messages_by_conversation
nodetool tablehistograms acme messages_by_conversation
```
`tablehistograms` gives percentiles for **SSTables per read**, read/write latency, partition size, and cell count. If the SSTables-per-read p99 is high (say double digits), compaction is behind or the strategy is wrong for the workload — that's your read-latency lever.

### Q13. Why does having too many SSTables per read hurt latency, and how does LCS help?

Each SSTable a read must consult adds work: a bloom-filter check, possibly an index lookup, possibly a disk seek and a merge step. If a partition's data is spread across 30 SSTables, a single read may do dozens of seeks and merge 30 fragments — latency scales with SSTable count.

**Compaction** is what keeps this bounded by merging SSTables together, collapsing overwritten cells and reducing the count.

**Leveled Compaction Strategy (LCS)** is the strongest bound: it organises SSTables into levels where, within a level, SSTables have **non-overlapping** partition-key ranges. So for a given partition key, at most **one SSTable per level** can contain it — typically resulting in ~1 SSTable read from L0 plus one per higher level, often a handful total regardless of how much data you have. That predictability is why LCS is the go-to for read-heavy and update-heavy workloads, at the cost of higher write amplification. (More in the Storage Engine topic.)

### Q14. Why do tombstones slow down reads?

Because a read has to **read and merge tombstones**, not skip them. A tombstone is a "this was deleted" marker with a timestamp; until compaction purges it (after gc_grace_seconds), it lives in SSTables and the read path must scan it to know that the data it masks is gone.

The pathological case: a partition where you've deleted (or TTL-expired) thousands of rows. To return the few live rows, the read must scan **past all those tombstones**, merging each one, doing real work to produce *nothing*. This is why:
- `tombstone_warn_threshold` (default 1000) logs a warning, and
- `tombstone_failure_threshold` (default 100000) **aborts the query** — Cassandra would rather fail than spend forever scanning tombstones.

The classic incident: using Cassandra as a queue (insert + delete churn in one partition) → tombstone pileup → read timeouts. Covered in depth in the Tombstones, Deletes & TTL topic.

### Q15. What's the cost of reading a wide partition?

A wide partition (millions of rows / hundreds of MB under one partition key) is expensive to read because everything scales with its size:

- **More cells to merge** across memtable + SSTables for that one partition.
- **Row cache is unusable** — caching the partition would blow the cache; enabling it makes things worse.
- **Full-partition reads pull huge result sets**, pressuring heap and GC on the coordinator and replica.
- **Compaction of that partition is heavy**, and it becomes a **hotspot** if it's also frequently accessed — one node does disproportionate work.

Even a *slice* read (with a clustering restriction) is fine — Cassandra seeks within the partition — but `SELECT *` on a wide partition, or scanning it top-to-bottom, is a latency and GC risk. The fix is modeling: **bucket** the partition (e.g. add a time bucket to the partition key) to bound its size, targeting ≲100MB / ≲100k rows per partition.

### Q16. What are monotonic reads and does Cassandra guarantee them?

A **monotonic read** guarantee means: once a client has seen a value, it will never subsequently see an *older* value — reads don't go backwards in time.

Cassandra does **not** guarantee this by default at low consistency. With CL=ONE, two successive reads can hit different replicas; if one replica is stale, a client can read the new value and then the old one — a non-monotonic read. This is a direct consequence of the AP, eventually-consistent design.

You get monotonic-read-like behavior by using **quorum consistency with R + W > RF** (e.g. LOCAL_QUORUM both ways at RF=3): every read overlaps the latest acknowledged write, so you never regress. Read repair also helps by healing stale replicas as they're read.

The interview point: Cassandra's consistency is *tunable*, not absent. If your application needs "never see older data," raise the CL to satisfy R + W > RF; if you can tolerate staleness for latency, drop to ONE and accept non-monotonic reads.

## Storage Engine: SSTables & Compaction

### Summary

**What this topic covers**

The on-disk heart of Cassandra: the **LSM-tree** storage model, the immutable **SSTable** files it produces, and the **compaction** process that merges them. This is where the "why are writes fast but reads need reconstruction" story gets its mechanical explanation, and where you choose the single most impactful table-level knob for performance — the **compaction strategy** (STCS, LCS, TWCS, and 5.0's UCS). The 17 questions here cover the LSM model and why it's write-optimized, SSTable immutability and its component files, what compaction does and why it's essential, the write/read/space **amplification** trade, a strategy-by-strategy comparison with workload guidance, compaction tuning and health signals (`nodetool compactionstats`, pending compactions), major-vs-minor compaction pitfalls, compression, disk headroom, and how compaction ties into tombstone eviction and repair.

**Mental model**

Think of Cassandra's storage as an **append-only log that periodically tidies itself**. Every write lands in memory (memtable) and, when memory fills, is flushed as a brand-new **immutable, sorted file** (SSTable) — Cassandra never edits an SSTable in place. Updates and deletes are *also* just new writes (a newer cell, or a tombstone) in newer SSTables. This makes writes sequential and blazing fast, but it means the truth about a row can be smeared across many files, and dead data (overwritten cells, expired TTLs, old tombstones) accumulates. **Compaction** is the housekeeper: it reads several SSTables, merges them by key, keeps the newest cell per column, drops shadowed/expired data, and writes out fewer, cleaner SSTables — reclaiming space and cutting SSTables-per-read. The **compaction strategy** decides *which* SSTables to merge and *when*, and that choice is a bet about your workload: write-heavy, read-heavy, or time-series.

**Key terms**

- **LSM-tree (Log-Structured Merge tree)** — write model: buffer in memory, flush as immutable sorted runs, merge in background. Powers Cassandra, RocksDB, HBase, ScyllaDB, LevelDB.
- **SSTable (Sorted String Table)** — immutable on-disk file, sorted by partition then clustering key.
- **Component files** — an SSTable is several files: **Data** (rows), **Index** (partition offsets), **Filter** (bloom filter), **Summary** (index sample), **Statistics**, **CompressionInfo**, TOC, Digest.
- **Compaction** — background merge of SSTables that discards overwritten cells, expired TTLs, and purgeable tombstones, and reduces file count.
- **Write amplification** — bytes written to disk per byte of logical data, due to repeated re-compaction.
- **Read amplification** — SSTables/IO consulted per logical read.
- **Space amplification** — disk used per byte of live data (dead data awaiting compaction).
- **STCS / LCS / TWCS / UCS** — the four compaction strategies (size-tiered, leveled, time-windowed, unified).
- **Major vs minor compaction** — minor is the automatic background merge; major compacts everything into (few) large SSTable(s), usually manual.
- **Pending compactions** — backlog of compaction tasks; a key health signal.

**Why interviewers ask this**

Compaction strategy is the question that separates people who've *operated* Cassandra from people who've only used it. Anyone can `INSERT`; knowing that a time-series table with TTL should use **TWCS** (so whole expired windows drop cheaply) rather than STCS (which never lets those tombstones die and bloats disk) is the difference between a healthy cluster and a 3 a.m. page. Interviewers probe whether you understand the **amplification trade** — that you can optimize for at most two of write/read/space — and whether you can map a workload to a strategy and justify it. It's also where they test whether you know the anti-patterns: running manual major compaction on an STCS table, or letting pending compactions climb until reads degrade.

**Common confusions**

- "SSTables get updated in place." Never — they're immutable; an update writes a new cell in a new SSTable, reconciled at read/compaction time.
- "Compaction is optional / just cleanup." It's essential — without it, SSTables-per-read and disk usage grow unbounded and reads collapse.
- "More compaction is always better." Compaction competes for IO/CPU; unthrottled or over-aggressive compaction spikes latency. It's a balance.
- "Major compaction fixes performance." With STCS it creates one giant SSTable that then won't compact (nothing similar-sized to merge with), and tombstones in it linger — usually a mistake.
- "You can run at 90% disk full." STCS can temporarily need up to ~2× a table's size during compaction; you must keep headroom.

**What follows from this topic**

Compaction is the hinge between the other two engine topics. **The Read Path** is fast or slow largely because of SSTables-per-read, which compaction controls. **Tombstones, Deletes & TTL** matters because tombstones are only physically removed *during compaction*, after gc_grace_seconds — so your compaction strategy directly governs whether tombstones (and expired TTL data) actually get reclaimed. Choose the strategy to fit the workload, and the read and tombstone problems largely take care of themselves; choose wrong, and you fight both forever.

### Q1. What is an LSM-tree and why is it write-optimized?

An **LSM-tree (Log-Structured Merge tree)** is a storage design that buffers writes in memory, flushes them to disk as **immutable sorted files**, and merges those files in the background. It's the model behind Cassandra, RocksDB, HBase, LevelDB, and ScyllaDB.

It's write-optimized because a write never seeks or reads first:
1. Append to a durable log (commit log).
2. Insert into an in-memory sorted structure (memtable).
3. Return. Done.

When the memtable fills, it's flushed **sequentially** as one new SSTable — no random-write disk IO, which is what kills throughput on spinning disks and wears SSDs. Updates and deletes are also just appends (a newer cell, a tombstone), so there's never a read-modify-write.

The cost is deferred to reads and background work: because data for a key can live in many SSTables, reads must merge fragments, and **compaction** must periodically consolidate. That's the LSM bargain — trade read and background cost for extremely cheap, sequential writes. B-trees (relational default) make the opposite trade: read-optimized, but writes do in-place random IO.

### Q2. What is an SSTable and what does immutability buy you?

An **SSTable (Sorted String Table)** is an immutable, on-disk file holding rows sorted by partition key (token order) and then by clustering columns. Once written (by a memtable flush or a compaction), it is **never modified** — only read, or eventually deleted when compaction supersedes it.

Immutability buys a lot:
- **Sequential writes** — flushing is one big sequential write, no random in-place updates.
- **Lock-free reads** — readers never contend with writers on a file; no read locks needed.
- **Trivial caching** — an immutable file's blocks can be cached without invalidation logic.
- **Cheap snapshots/backups** — `nodetool snapshot` just hard-links the existing SSTable files; nothing can change them.
- **Safe compaction** — you build the merged output alongside the inputs, then atomically switch, with no risk to concurrent readers.

The price: you can't overwrite or delete in place, so **updates create new cells and deletes create tombstones** in newer SSTables, which is why reads must merge and compaction must clean up. Immutability is the enabler of both fast writes and the read/compaction cost.

### Q3. What are the component files that make up an SSTable?

An SSTable isn't one file — it's a set of files sharing a generation identifier, each with a role:

- **Data** (`*-Data.db`) — the actual rows/cells. The big one.
- **Index** (`*-Index.db`) — maps partition keys to byte offsets in the Data file (and indexes clustering positions within large partitions).
- **Filter** (`*-Filter.db`) — the **bloom filter** for this SSTable's partition keys.
- **Summary** (`*-Summary.db`) — an in-memory-loaded sample of the Index for fast narrowing.
- **Statistics** (`*-Statistics.db`) — metadata: min/max timestamps, clustering ranges, tombstone histograms, compression ratio — used for query pruning and compaction decisions.
- **CompressionInfo** (`*-CompressionInfo.db`) — chunk offsets for the compressed Data file.
- **TOC** (`*-TOC.txt`) — lists the component files.
- **Digest** (`*-Digest.crc32`) — checksum for integrity.

On a read, the flow uses several of these: bloom **Filter** to skip, **Summary** → **Index** to find the offset, then **Data** (via **CompressionInfo**) to fetch. **Statistics** lets Cassandra skip whole SSTables by timestamp/clustering range — important for TWCS and tombstone-aware reads.

### Q4. What does compaction actually do?

**Compaction** merges multiple SSTables into fewer, cleaner ones. For each partition/row it encounters across the input SSTables, it:

1. **Merges cells by timestamp** — keeps the newest cell per column, discarding overwritten (shadowed) older cells.
2. **Drops expired TTL data** — cells whose TTL has passed become droppable.
3. **Purges tombstones** that are past **gc_grace_seconds** and safe to remove (no older data they still need to shadow in other SSTables).
4. **Reduces SSTable count** — fewer files means fewer bloom-filter checks, index lookups, and merges per read.
5. **Reclaims disk** — dead data physically leaves the dataset.

The output is a new set of SSTables; the inputs are deleted once the switch is complete. So compaction simultaneously fixes **read amplification** (fewer SSTables per read) and **space amplification** (dead data removed). It's not optional maintenance — it's the mechanism that keeps an LSM store from degrading into thousands of tiny files full of garbage. It's also the *only* place tombstones and expired TTL data are physically removed.

### Q5. Explain write, read, and space amplification and the trade between them.

They're the three costs of an LSM store, and you can typically optimize for at most two:

- **Write amplification** — how many bytes actually hit disk per byte of logical data. Compaction rewrites data repeatedly, so a byte you write once may be re-written many times as it moves through compaction.
- **Read amplification** — how many SSTables / IOs a single read must consult. More SSTables holding a key = higher read amplification.
- **Space amplification** — how much disk you use per byte of *live* data. Overwritten cells, expired TTLs, and un-purged tombstones inflate this.

The trade: aggressively compacting to keep few SSTables (low read + low space amplification) means rewriting data often (**high write amplification**) — that's **LCS**. Compacting lazily to save write IO (**low write amplification**) leaves more SSTables and more dead data around (**higher read + space amplification**) — that's **STCS**. TWCS sidesteps some of this for time-series by dropping whole windows without rewriting them. Picking a compaction strategy *is* picking which two amplifications you care about for that table.

### Q6. Compare the compaction strategies — STCS, LCS, TWCS, UCS.

| Strategy | How it merges | Optimizes | Costs | Use when |
|---|---|---|---|---|
| **STCS** (SizeTiered) | Merges SSTables of *similar size* into larger ones | Write throughput | Read + space amplification; temporary ~2× disk during compaction | General/write-heavy, default |
| **LCS** (Leveled) | Non-overlapping SSTables in size-tiered levels; ~1 SSTable per level per key | Read latency, predictable, low space | High write amplification | Read-heavy, update-heavy, latency-sensitive |
| **TWCS** (TimeWindowed) | Groups SSTables by time window; compacts within a window, drops whole expired windows | Time-series with TTL; cheap expiry | Bad for updates/out-of-order writes | Append-mostly time-series with TTL |
| **UCS** (Unified, 5.0) | Configurable scaling parameters; can behave like STCS or LCS on a sliding scale | Flexibility — one strategy to tune | Newer, needs understanding to configure | Modern default; tune toward read or write |

The mental shortcut: **STCS** = cheap writes, messier reads; **LCS** = clean reads, expensive writes; **TWCS** = time-series/TTL specialist that expires data almost for free; **UCS** = the 5.0 unifier that dials between STCS and LCS behavior so you don't have to switch strategies as a workload evolves.

### Q7. When would you choose STCS?

**Size-Tiered Compaction Strategy** is the default and the right pick for **write-heavy or general-purpose** tables where reads are mostly recent data and you don't need bounded read latency.

How it works: it waits until it has several (default ~4) SSTables of *similar size*, then merges them into one larger SSTable; those larger SSTables later merge with other large ones, forming tiers. This is IO-efficient for writes — data isn't rewritten often (**low write amplification**).

The downsides:
- **Read amplification** — a given partition can be spread across SSTables in multiple tiers, so reads may touch many.
- **Space amplification** — merging a tier of big SSTables can temporarily need up to ~2× that data's size in free disk.
- **Tombstones linger** — dead data in a big SSTable won't be reclaimed until it finds similar-sized SSTables to compact with, which can take a long time.

Choose STCS when write throughput matters most and your reads are latency-tolerant or hit recent data; avoid it for update-heavy or delete-heavy tables where space and tombstones balloon.

### Q8. When would you choose LCS, and what does it cost?

**Leveled Compaction Strategy** is for **read-heavy, update-heavy, or latency-sensitive** tables where you want predictable, bounded read latency.

It organises SSTables into levels (L0, L1, L2…), each ~10× the previous. Within L1 and above, SSTables have **non-overlapping** partition-key ranges, so for any given key **at most one SSTable per level** can contain it. A read therefore touches roughly one SSTable per level — typically a small, predictable handful regardless of dataset size. That's why LCS gives the best and most consistent read latency, and it keeps **space amplification low** (little dead data lingers).

The cost is **write amplification**: maintaining non-overlapping levels means constantly rewriting SSTables as data cascades down levels — a byte can be rewritten ~10× more than under STCS. On write-heavy tables this can saturate IO and let compaction fall behind (L0 backs up).

Choose LCS when: rows are updated frequently (so overwrites need collapsing), reads dominate and must be fast, and your write rate is moderate enough that compaction keeps up. Avoid it for pure write-heavy ingest.

### Q9. When would you choose TWCS?

**Time-Window Compaction Strategy** is purpose-built for **time-series, append-mostly data with a TTL** — metrics, events, logs, IoT readings.

It groups SSTables into **time windows** (e.g. one day). Within the current window it compacts normally (STCS-like); once a window closes, its SSTable is left alone. The magic is expiry: when every cell in an old window has passed its TTL, Cassandra can **drop the entire SSTable** for that window — no merging, no tombstone scanning, no rewrite. Reclaiming a day of expired data is nearly free.

This solves the exact problem STCS has with TTL data: under STCS, TTL-expired cells become tombstones stuck inside large SSTables that won't compact away for ages, bloating disk and slowing reads. TWCS avoids that by dropping whole windows.

Requirements to use it well:
- Data is **written roughly in time order** and you rarely update or delete old rows (out-of-order writes and updates smear data across windows and break the whole-SSTable-drop optimization).
- Every row has a **TTL** (or you delete by whole window).

Choose TWCS for time-series/TTL workloads; it's the standard answer for "how do I store metrics/events in Cassandra."

### Q10. What is UCS (Unified Compaction Strategy) and why does it matter?

**UCS (Unified Compaction Strategy)**, introduced in **Cassandra 5.0**, is a single configurable strategy that can be tuned to behave anywhere on the spectrum from **STCS-like** (fewer rewrites, write-optimized) to **LCS-like** (leveled, read-optimized), controlled by a scaling parameter rather than by switching strategy classes.

Why it matters:
- **One strategy to learn and tune.** Instead of picking STCS vs LCS up front and paying a painful migration if the workload shifts, you dial UCS toward read or write optimization with a config parameter.
- **Smoother behavior.** It's designed to avoid some of the sharp edges (STCS's space spikes, LCS's write-amplification cliffs) and to shard compaction for better parallelism on large nodes.
- **The modern default direction.** As clusters move to 5.0, UCS becomes the recommended general strategy, with TWCS still preferred specifically for time-series/TTL.

In an interview, the signal is: you know Cassandra 5.0 unified the historically-separate STCS/LCS trade into one tunable strategy, so "which strategy?" increasingly becomes "how do I tune UCS?" — while TWCS remains the specialist for time-series.

### Q11. How do you choose a compaction strategy for a given workload?

Map the workload's dominant characteristic to the strategy:

- **Time-series / append-only with TTL** (metrics, logs, events) → **TWCS**. Whole expired windows drop for free.
- **Read-heavy / update-heavy / latency-sensitive** (a table you frequently read and overwrite) → **LCS**. Bounded SSTables-per-read, low space amplification.
- **Write-heavy / general, reads tolerate variance** → **STCS** (or **UCS** tuned write-ward). Cheap writes.
- **On Cassandra 5.0, unsure or evolving** → **UCS**, tuned toward read or write as needed.

Ask three questions: (1) Is it time-series with TTL? If yes, TWCS, stop. (2) Do reads dominate and need predictable latency, or are rows updated a lot? If yes, LCS. (3) Otherwise write throughput wins → STCS/UCS.

Anti-signals: don't put LCS on a firehose write ingest (write amplification saturates IO); don't put STCS on delete-heavy or TTL data (tombstones and dead data pile up); don't use TWCS if you update or out-of-order-write old data.

### Q12. How do you tune compaction, and why does unthrottled compaction hurt latency?

Compaction competes with client queries for disk IO and CPU, so it's throttled and bounded on purpose:

- **`compaction_throughput_mb_per_sec`** (in `cassandra.yaml`, or live via `nodetool setcompactionthroughput`) caps compaction disk bandwidth. Set to 0 = unlimited.
- **`concurrent_compactors`** — how many compactions run in parallel; too many saturates IO, too few lets a backlog grow.
- Per-strategy options (e.g. STCS bucketing thresholds, LCS `sstable_size_in_mb`, TWCS window size).

**Why unthrottled hurts:** if compaction is allowed to consume all disk bandwidth, it starves client reads/writes — your p99 latency spikes and reads may time out during big compactions. **But** if you throttle too hard, compaction falls behind, SSTables-per-read climbs, and reads degrade the *other* way. It's a balance: throttle enough to protect query latency, but keep `nodetool compactionstats` pending count low. On fast NVMe you can raise throughput; on shared/slow disks, keep it conservative.

### Q13. What do pending compactions and compactionstats tell you?

`nodetool compactionstats` shows in-flight and queued compaction work:

```bash
nodetool compactionstats
# pending tasks: 2
# id  compaction type  keyspace  table  completed  total  unit  progress
```

**Pending compactions** is a primary **health signal**:
- **Near zero / low and stable** — compaction is keeping up. Healthy.
- **Steadily climbing** — compaction can't keep pace with the write rate (or is throttled too hard). This directly means SSTables-per-read is rising, so **read latency will degrade** and disk usage grows. Fix: raise compaction throughput/concurrency, add capacity, or reconsider the strategy (e.g. LCS on a write firehose can't keep up → switch to STCS/UCS).

Pair it with `nodetool compactionhistory` (what has run) and `nodetool tablestats` (SSTable count, space used). A sustained backlog is one of the clearest early warnings that a node is heading for trouble — catch it before reads start timing out.

### Q14. What's the difference between major and minor compaction, and why is manual major compaction risky?

**Minor compaction** is the automatic, background compaction the strategy runs continuously — merging a subset of SSTables as thresholds are met. This is normal, healthy operation; you don't trigger it.

**Major compaction** (`nodetool compact`) forces *all* SSTables for a table to be compacted together, typically into one (or, in newer versions, a few) large SSTable(s).

Why manual major compaction is usually a mistake, especially with **STCS**:
- It creates **one enormous SSTable**. Under STCS, compaction merges *similar-sized* SSTables — but now there's nothing else its size, so it **won't compact again for a very long time**. Tombstones and overwritten data trapped inside it linger far past gc_grace.
- It's an **IO storm** that tanks latency while it runs and temporarily needs a lot of free disk.
- It only helps transiently; the underlying cause (wrong strategy, tombstone churn) remains.

Legit uses are narrow: reclaiming space after a bulk delete/TTL expiry when you understand the consequences, or on LCS/TWCS where the downside is smaller. Reach for it deliberately, not as a routine fix.

### Q15. How does compaction relate to tombstone eviction and repair?

Tombstones are only **physically removed during compaction**, and only when two conditions hold:

1. The tombstone is **older than gc_grace_seconds** (default 10 days), and
2. Compaction can prove no other SSTable holds older data that the tombstone still needs to shadow (otherwise removing it would resurrect that data).

So your **compaction strategy governs whether tombstones actually get reclaimed**. Under STCS, a tombstone in a large SSTable may wait a long time for similar-sized SSTables to compact with — dead data lingers. Under LCS, data cycles through levels faster, so tombstones clear more promptly. Under TWCS, whole expired windows drop, removing tombstones/TTL data wholesale.

The **repair** connection is the safety interlock: gc_grace exists so that `nodetool repair` can propagate a delete to *every* replica before the tombstone is compacted away. If you run repair less often than gc_grace, or lower gc_grace recklessly, compaction can purge a tombstone a replica never received → **data resurrection**. Compaction, gc_grace, and repair are a three-way contract — covered fully in the Tombstones topic.

### Q16. How does compression fit into the storage engine, and should you keep it on?

Cassandra compresses SSTable **Data** files by default, in fixed-size **chunks** (default 16KB, `chunk_length_in_kb`), with offsets recorded in the CompressionInfo component so a read can decompress just the chunk it needs — you don't decompress the whole file to read one row.

Defaults and options:
- Default codec is **LZ4** — very fast, modest ratio; the right default for most tables.
- **Zstd** / **Deflate** give better ratios at higher CPU cost — worth it for cold, space-sensitive, read-light data.
- Configure via the table's `compression` option; you can disable it (`{'enabled': false}`).

Should you keep it on? **Almost always yes.** Because Cassandra data has lots of repetition (column names, similar values) and compression is chunked, you usually get a solid space saving *and* often **better read throughput** — less data read from disk outweighs the decompression CPU. Turn it off only for already-incompressible data (e.g. encrypted/compressed blobs) or extreme low-latency CPU-bound cases. Tune `chunk_length_in_kb` down for point-read-heavy tables (less wasted decompression) and up for scan-heavy tables.

### Q17. How much disk headroom does the storage engine need, and why?

You must run with meaningful free disk — a common rule of thumb is to **keep utilization well under ~50–70%** per node, not fill it — because compaction needs temporary space and a full disk is catastrophic.

Why:
- **STCS can temporarily need up to ~2× a table's size** during a major/large compaction: it writes the merged output *before* deleting the inputs, so both exist briefly. If you're at 80% and a big compaction starts, you can run out of disk mid-compaction.
- **Compaction is how space is reclaimed** — dead data (overwritten cells, expired TTL, purgeable tombstones) only leaves during compaction. If the disk fills, compaction can't run, so you can't reclaim, and you're stuck.
- **A full disk can take the node down** and requires painful manual recovery (adding capacity, snapshots cleanup, or emergency compaction elsewhere).

LCS and TWCS have smaller transient spikes than STCS (LCS compacts smaller SSTable sets; TWCS drops whole windows), so they tolerate higher utilization — but you still keep headroom. The operational takeaway: monitor disk, alert early, and add nodes *before* you're tight, because a nearly-full Cassandra node is hard to rescue.

## Tombstones, Deletes & TTL

### Summary

**What this topic covers**

The most notorious operational hazard in Cassandra, and the direct cause of a large share of production incidents: **deletes create data**. Because SSTables are immutable, you can't erase a row in place — a `DELETE` writes a **tombstone**, a timestamped "this is deleted" marker that masks older data until compaction can safely remove it. This topic's 16 questions cover why that's true, the types of tombstones, **gc_grace_seconds** and the **zombie/data-resurrection** bug it exists to prevent, **TTL** and how expiry becomes tombstones, the **tombstone read-latency problem** (warn/failure thresholds, the classic query-abort incident), the **queue/messaging anti-pattern**, mitigation strategies (TWCS + TTL over explicit deletes, modeling to avoid deletes), how tombstones interact with compaction and repair, and how to detect and diagnose tombstone trouble.

**Mental model**

Internalize one sentence: **a delete is a write.** Cassandra never modifies data on disk; it only appends. So a delete appends a tombstone with a timestamp; at read time, if the tombstone's timestamp is newer than the data it covers, the data reads as absent. The tombstone can't just be dropped immediately, because a replica that missed the delete still has the live data — the tombstone must survive long enough (**gc_grace_seconds**, default 10 days) for **repair** to carry the delete to every replica. Only after that grace period can compaction physically purge the tombstone. Meanwhile, every read of that partition must **scan past the tombstones** to find live data. So tombstones cost you twice: space (they sit around for 10+ days) and read latency (they're scanned on every read until purged). The whole discipline of "modeling to avoid deletes" flows from this.

**Key terms**

- **Tombstone** — a timestamped deletion marker; masks older data during reads until compaction purges it.
- **Cell / row / range / partition tombstone** — deletion markers at different granularities (one column, one row, a slice of clustering rows, a whole partition).
- **gc_grace_seconds** — how long (default 864000s = 10 days) a tombstone must live before compaction may purge it; the window for repair to propagate the delete.
- **Data resurrection / zombie data** — deleted data "coming back" because a tombstone was purged before every replica received the delete.
- **TTL (time-to-live)** — per-cell/row expiry; expired cells become tombstones, then get compacted away.
- **tombstone_warn_threshold** — read scans this many tombstones (default 1000) → warning logged.
- **tombstone_failure_threshold** — read scans this many (default 100000) → **query aborted**.
- **Anti-entropy repair** — `nodetool repair`, Merkle-tree reconciliation that propagates deletes/updates; must run within gc_grace.
- **Range tombstone** — a single marker deleting a contiguous range of clustering rows.
- **Queue anti-pattern** — insert+delete churn in one partition producing tombstone pileup and read timeouts.

**Why interviewers ask this**

This is *the* Cassandra senior-vs-junior question. A junior thinks "delete removes the row." A senior knows a delete *adds* a tombstone, that tombstones tank read latency and can abort queries, that gc_grace_seconds and repair form a safety contract against zombie data, and that "just use Cassandra as a queue" is how you page yourself at 3 a.m. Interviewers use tombstones to test whether you understand Cassandra's storage model deeply enough to *model schemas that avoid deletes* — the real skill. The "reads are timing out" diagnosis and the "why is Cassandra a bad queue" question are near-universal at senior level.

**Common confusions**

- "Delete frees space immediately." It doesn't — it *adds* a tombstone; space is reclaimed only after gc_grace + compaction.
- "TTL is free/cheap cleanup." Expired cells become tombstones first; TTL data still needs a compaction strategy (TWCS) that reclaims it, or tombstones pile up.
- "Lower gc_grace_seconds to clean up faster." Dangerous — shorten the repair window and you risk data resurrection.
- "Updating a collection is cheap." Overwriting a collection (list/set/map) inserts a **range tombstone** then the new data — a hidden tombstone source.
- "Reading a partition I just deleted from is fine." It's the worst case — you scan all the tombstones to return the survivors.

**What follows from this topic**

Tombstones tie the whole storage story together. They're the main reason **The Read Path** slows down (scanning tombstones), and they're physically removed only in **Storage Engine: SSTables & Compaction** (during compaction, past gc_grace) — which is why **TWCS + TTL** is the recommended pattern for expiring data, and why your compaction strategy determines whether tombstones actually clear. And gc_grace_seconds is meaningless without disciplined **repair**. Master this topic and most "mysterious latency" and "data came back" incidents become obvious.

### Q1. Why is a delete in Cassandra actually a write?

Because SSTables are **immutable** — Cassandra never modifies data already on disk. There's no "go find the row and erase it" operation; the data may be spread across many SSTables you can't edit.

So a `DELETE` does the only thing the storage engine can do: it **appends a new marker** — a **tombstone** — carrying a timestamp and saying "everything for this key/column older than me is deleted." At read time, Cassandra merges fragments by timestamp; if the newest thing for a cell is a tombstone, the cell reads as absent.

The consequences that surprise people:
- A delete **increases** data on disk (adds the tombstone) rather than shrinking it immediately.
- The old data is still physically present, just **masked** by the tombstone, until compaction removes both — and compaction can't do that until **gc_grace_seconds** has passed.
- Reads get *slower* after heavy deletes, because they must scan the tombstones.

This single fact — delete = write = tombstone — is the root of every tombstone problem in this topic.

### Q2. What are the different types of tombstones?

Tombstones exist at several granularities, depending on what you deleted:

- **Cell tombstone** — deletes a single column of a single row (`DELETE col FROM t WHERE ...` or setting a column to null).
- **Row tombstone** — deletes one whole row (`DELETE FROM t WHERE pk=.. AND ck=..`).
- **Range tombstone** — deletes a **contiguous range of clustering rows** in one marker (`DELETE FROM t WHERE pk=.. AND ck >= x AND ck < y`), and — importantly — is also what an **overwrite of a collection** generates.
- **Partition tombstone** — deletes an entire partition (`DELETE FROM t WHERE pk=..`) with a single marker; the most efficient delete because it's one tombstone covering everything.
- **TTL expiry** — when a cell's TTL passes, it becomes (effectively) a tombstone automatically, with no explicit DELETE.

The efficiency ordering matters: deleting a whole partition (one partition tombstone) is far cheaper on reads than deleting thousands of individual rows (thousands of row tombstones). Range tombstones are efficient for contiguous slices but are a hidden cost behind collection updates. When you can, delete at the coarsest granularity that fits.

### Q3. What is gc_grace_seconds and why does it exist?

**gc_grace_seconds** is the minimum time (default **864000 seconds = 10 days**) a tombstone must remain in the data before compaction is allowed to physically purge it.

It exists to give **repair** time to propagate the delete to **every** replica. Here's the danger it guards against: suppose RF=3 and you delete a row. The delete (tombstone) reaches 2 replicas but one replica is temporarily down and misses it. That replica still holds the *live* old data. If the tombstone were purged immediately from the 2 replicas that got it, then when the down replica comes back and they reconcile, the down replica's live data has no tombstone to mask it — so the **deleted data comes back**.

gc_grace_seconds prevents this by keeping the tombstone alive long enough for `nodetool repair` (anti-entropy) to carry it to the lagging replica. The hard rule: **you must run repair on every table within gc_grace_seconds.** If you can't, don't lower gc_grace. If you lower gc_grace, you must repair more often. Getting this contract wrong is exactly how zombie data happens (next question).

### Q4. Explain the data-resurrection / zombie-data bug in detail.

**Data resurrection** ("zombie data") is deleted data reappearing because a tombstone was purged before every replica learned about the delete. Step by step:

1. RF=3. You `DELETE` a row. The tombstone is written to replicas A and B, but replica **C is down** and misses it.
2. C comes back holding the **original live row** — and no tombstone.
3. **You never run repair** (or run it after gc_grace). Time passes beyond gc_grace_seconds.
4. Compaction on A and B, seeing the tombstones are now older than gc_grace, **purges** them. A and B now have *nothing* for that row.
5. A later read/repair reconciles A, B, C. A and B have no data and no tombstone; **C has live data**. The merge concludes C's row is the surviving truth.
6. The deleted row is **back** — resurrected.

The bug is entirely about ordering: the tombstone (which encodes "deleted") was destroyed before it reached the replica that needed it. The fix is the gc_grace/repair contract: **run `nodetool repair` on every table within gc_grace_seconds** so the tombstone reaches C (step 2→3) before compaction can purge it (step 4). This is why "we don't repair regularly" is a latent data-corruption bug in any cluster that deletes.

### Q5. How does TTL work, and what happens when data expires?

**TTL (time-to-live)** auto-expires data after a set number of seconds — perfect for ephemeral or time-series data you don't want to delete manually.

You set it per write (per-cell), or as a table default:
```cql
INSERT INTO sessions (id, token) VALUES (1, 'abc') USING TTL 3600;   -- expires in 1h
UPDATE sessions USING TTL 3600 SET token = 'xyz' WHERE id = 1;
-- or a table default:
CREATE TABLE events (...) WITH default_time_to_live = 604800;        -- 7 days
```

What happens on expiry:
1. When a cell's TTL passes, it stops being returned by reads — it's logically gone.
2. Physically, the expired cell **becomes a tombstone** (it's now a deletion marker with the expiry timestamp).
3. That tombstone lives until compaction can purge it (subject to gc_grace).

The catch: **TTL is not free cleanup.** Expired cells turn into tombstones, so a table with lots of TTL expiry under the wrong compaction strategy (e.g. STCS) accumulates tombstones and slows down — exactly the problem TWCS solves by dropping whole expired time-windows. TTL + TWCS is the healthy combination; TTL + STCS on high-volume data is a tombstone trap.

### Q6. Why do tombstones cause read-latency problems, and what are the thresholds?

Reads have to **scan through tombstones** to find live data. A tombstone isn't skippable — the read path must examine it to know that the data it covers is deleted. So a partition containing thousands of tombstones forces a read to process all of them just to return the handful of live rows — real CPU and IO spent producing nothing.

Cassandra guards against this with two thresholds (in `cassandra.yaml`):
- **`tombstone_warn_threshold`** (default **1000**) — if a single read scans this many tombstones, a **warning** is logged. Your early signal.
- **`tombstone_failure_threshold`** (default **100000**) — if a read scans this many, Cassandra **aborts the query** with a `TombstoneOverwhelmingException` rather than spend unbounded time. Your read literally fails.

The classic incident: a partition accumulates tombstones (from deletes or TTL churn) until reads first slow (warnings), then start **failing** at the failure threshold — client-visible errors and timeouts. When you see `TombstoneOverwhelmingException` or "Read N live rows and M tombstone cells" warnings in the logs, you have a tombstone problem, and the fix is almost always a modeling change, not raising the threshold.

### Q7. Why is Cassandra a bad message queue?

Because a queue is **insert + delete churn in a single partition**, which is the perfect tombstone-generation machine.

The pattern: producers insert messages into a partition (say `queue_id`), consumers read the oldest and **delete** them once processed. Every delete writes a tombstone into that same partition. Now every read that scans for the next unprocessed message must **scan past all the tombstones** of already-deleted messages accumulated since the last compaction. As throughput rises:

1. Tombstones pile up faster than compaction (bounded by gc_grace) can remove them.
2. Reads scan more and more tombstones → latency climbs.
3. Eventually reads cross `tombstone_failure_threshold` → queries **abort**. The queue stops working.

This is the textbook Cassandra anti-pattern. Cassandra is optimized for immutable, append-oriented, distributed writes — not the delete-heavy, read-oldest, mutate-in-place semantics of a queue. If you need a queue, use Kafka, SQS, RabbitMQ, or Pulsar. If you *must* approximate one in Cassandra, use **TWCS + TTL** so messages expire by whole time-windows instead of being individually deleted — but the honest answer in an interview is "don't; use a real queue."

### Q8. How do you mitigate tombstone problems?

The theme is **avoid deletes by design**, and when you can't, make them cheap to reclaim:

- **Use TTL instead of explicit deletes** for expiring data — combined with **TWCS**, whole windows drop without per-row tombstone scans.
- **Model to avoid deletes.** Prefer immutable, append-only tables; represent "state change" as a new row (event sourcing) rather than delete+insert. Query for the latest.
- **Don't delete-then-read the same partition.** If you must delete, avoid reading through the deleted range afterward; bucket data so deleted buckets are dropped whole.
- **Delete at coarse granularity** — a partition tombstone (one marker) beats thousands of row tombstones.
- **Use range deletes** for contiguous slices instead of many single-row deletes.
- **Bucket by time** so old data ages out into droppable TWCS windows rather than needing deletes at all.
- **Lower gc_grace_seconds only with caution** — and only if you can guarantee more frequent repair; never as a blind "clean up faster" knob.
- **Pick the right compaction strategy** — LCS or TWCS reclaim tombstones faster than STCS for delete/TTL-heavy tables.

The senior instinct: when a schema requires frequent deletes, that's a signal to **re-model**, not to tune thresholds.

### Q9. How do tombstones interact with compaction and repair?

They're a three-way contract — tombstones, **compaction** (removal), and **repair** (propagation):

- **Compaction removes tombstones**, but only when both: the tombstone is **older than gc_grace_seconds**, and compaction can confirm no other SSTable still holds older data the tombstone must shadow (else removing it resurrects that data). So the *rate* tombstones clear depends on your compaction strategy — STCS lets them linger in big SSTables; LCS/TWCS clear them faster.
- **Repair propagates the delete** to every replica before compaction purges the tombstone. gc_grace_seconds is precisely the window given for this.

The interlock: if repair runs within gc_grace, every replica gets the tombstone, and when compaction later purges it, all replicas agree the data is gone — clean. If repair *doesn't* run in time, compaction may purge a tombstone a replica never received → **resurrection**.

So the operational rule set is: (1) run `nodetool repair` on every table within gc_grace_seconds; (2) choose a compaction strategy that reclaims tombstones at the rate your workload generates them; (3) never lower gc_grace without tightening repair frequency to match.

### Q10. How do you detect and diagnose tombstone problems?

Multiple signals, from coarse to surgical:

**Logs** — the loudest signal. Look for:
- `Read N live rows and M tombstone cells...` warnings (from `tombstone_warn_threshold`).
- `TombstoneOverwhelmingException` — reads hitting `tombstone_failure_threshold` and aborting.

**Per-query tracing** — pinpoint one slow query:
```cql
TRACING ON;
SELECT * FROM messages_by_conversation WHERE conversation_id = 42;
```
The trace shows "tombstone cells read" for that exact query — a partition scanning thousands of tombstones is your smoking gun.

**Table stats** — aggregate health:
```bash
nodetool tablestats acme.messages_by_conversation   # "Average/Maximum tombstones per slice"
nodetool tablehistograms acme messages_by_conversation
```
These expose the tombstones-per-read distribution.

**Metrics** — via JMX/Prometheus: `TombstoneScannedHistogram` per table, live-vs-tombstone cell ratios.

The diagnostic flow: logs tell you a table has tombstone trouble → `tablestats`/tracing confirm which partitions and how bad → then you fix the **model** (TTL/TWCS, avoid deletes), not the symptom.

### Q11. My reads are timing out. Walk me through diagnosing it as a tombstone issue.

Start from the symptom and confirm tombstones before assuming them:

1. **Check the logs** on the coordinator/replicas for `TombstoneOverwhelmingException` or "read N live rows and M tombstone cells" warnings. If present, tombstones are strongly implicated.
2. **Identify the table/query.** The warning names the table; correlate with which client queries are timing out.
3. **Trace the query:** `TRACING ON;` then run the offending `SELECT`. Read the "tombstone cells read" count — if it's thousands (or hitting 100k → abort), that's the cause.
4. **Confirm the pattern:** is this a partition subject to heavy deletes or TTL churn (a queue-like access pattern, a frequently-overwritten collection, or TTL data on STCS)? `nodetool tablestats` "maximum tombstones per slice" quantifies it.
5. **Root-cause the model:** deletes-then-reads on the same partition, collection overwrites, TTL under STCS, or an out-and-out queue.

**Fix (durable, not band-aid):** re-model to avoid deletes (append-only + read-latest), switch expiry to **TTL + TWCS**, bucket by time so old data drops in whole windows, or delete at partition granularity. Raising `tombstone_failure_threshold` just delays the next incident — don't lead with that.

### Q12. Why is overwriting a collection a hidden tombstone source?

Because overwriting a **list/set/map** with a new value isn't an in-place update — Cassandra implements it as **delete-then-insert**: it writes a **range tombstone** covering the old collection, then inserts the new elements.

```cql
-- This does NOT just update; it tombstones the whole old collection first:
UPDATE users SET tags = {'a','b','c'} WHERE id = 1;
```

Every full-collection overwrite emits a range tombstone. Do this frequently on the same rows and you accumulate tombstones exactly as if you were running explicit deletes — reads of those rows then scan them, and latency climbs. It's insidious because the CQL looks like a harmless `UPDATE`.

Mitigations:
- **Append/remove elements** instead of reassigning the whole collection when possible:
  ```cql
  UPDATE users SET tags = tags + {'d'} WHERE id = 1;   -- append, no range tombstone
  ```
  (Note: element *removal* from sets/maps still creates cell tombstones.)
- **Avoid frozen-vs-non-frozen mistakes** and reconsider whether a collection is the right model for frequently-mutated data.
- For heavily-mutated multi-valued data, a **clustering-column table** (one row per element) is often better than a mutable collection.

### Q13. What's the difference between deleting a whole partition and deleting rows?

It's a big efficiency difference driven by **how many tombstones** you create.

**Deleting a whole partition** — one **partition tombstone**:
```cql
DELETE FROM messages_by_conversation WHERE conversation_id = 42;
```
A single marker covers every row in the partition. Reads of that partition see one tombstone and know it's all gone — cheap. This is the most efficient way to delete a lot of data.

**Deleting individual rows** — one **row tombstone each**:
```cql
DELETE FROM messages_by_conversation WHERE conversation_id = 42 AND message_id = 1001;
-- ... repeated thousands of times
```
Thousands of deletes = thousands of tombstones in that partition. Any subsequent read of the partition must scan all of them → the classic tombstone-latency problem.

The design lesson: **model so you delete at partition granularity.** If you routinely need to purge groups of rows, put that group in its own partition (e.g. time-bucketed partitions) so you can drop it with one partition tombstone — or better, let it TTL-expire under TWCS so no explicit delete is needed at all. Fine-grained row deletion at scale is the road to tombstone incidents.

### Q14. Is it safe to lower gc_grace_seconds? When and how?

It's safe **only** if you tighten repair to match — and risky otherwise, because gc_grace is the window that prevents zombie data.

The rule is invariant: **you must complete a full repair of the table within gc_grace_seconds.** Lowering gc_grace shrinks that window. So:

- **Safe case:** you run reliable, frequent repairs (e.g. Cassandra Reaper on a 1–2 day cycle) and want tombstones reclaimed faster to cut read latency/disk. You can lower gc_grace *to comfortably above your repair interval* (e.g. repair daily → gc_grace of 3 days, not 1). Never set it below your actual repair completion time.
- **Special case — gc_grace = 0:** sometimes used for **TTL-only, never-explicitly-deleted, immutable time-series** tables (append-only, TWCS) where every replica gets every write and there are no manual deletes to lose. Even then, understand the risk: any missed write + hint expiry can cause inconsistency.
- **Dangerous case:** lowering it because "cleanup is slow" without guaranteeing repair cadence → **data resurrection**.

How: `ALTER TABLE t WITH gc_grace_seconds = 259200;`. Change it deliberately, paired with a verified repair schedule — never as a reflexive latency fix.

### Q15. Why is "just delete the data" dangerous at scale?

Because at scale, deletes don't reclaim space — they **manufacture load**. Four compounding costs:

1. **Deletes add data, not remove it.** Each is a tombstone that lives 10+ days (gc_grace) before compaction can purge it. Delete a lot and disk *grows* first.
2. **Reads degrade.** Every tombstone in a partition is scanned on read; heavy deletes turn cheap reads into slow ones, then into aborted queries at the failure threshold.
3. **Resurrection risk.** More deletes = more tombstones that *must* be repaired to every replica within gc_grace, or deleted data comes back. At scale, keeping repair ahead of gc_grace across every table is real operational burden.
4. **Compaction pressure.** Tombstone-heavy tables need timely compaction to reclaim, competing with client IO.

So "we'll just delete old rows nightly" is a trap: at high volume it produces tombstone pileup, read timeouts, disk bloat, and zombie risk all at once. The scalable pattern is to **design deletes out**: TTL for expiry, TWCS to drop whole windows, time-bucketed partitions you can drop with one partition tombstone, and append-only models where "delete" means "write a newer state and read the latest." In Cassandra, the cheapest delete is the one you never issue.

### Q16. Design an approach to expire time-series data without tombstone pain.

The goal: expire old data continuously at high volume with **near-zero tombstone cost**. The recipe is **TTL + TWCS + time-bucketed partitions**, and no explicit deletes.

**1. Put a TTL on every write** (table default so nothing is forgotten):
```cql
CREATE TABLE readings_by_sensor (
  sensor_id text,
  bucket    text,        -- e.g. '2026-07' month bucket
  ts        timestamp,
  value     double,
  PRIMARY KEY ((sensor_id, bucket), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
  AND default_time_to_live = 2592000          -- 30 days
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_unit': 'DAYS',
                    'compaction_window_size': 1};
```

**2. Let TWCS drop whole expired windows.** Because writes are time-ordered and every cell shares a TTL, an entire day's SSTable expires together and TWCS **drops the whole file** — no per-row tombstone scanning, no compaction rewrite.

**3. Bucket the partition key** (`(sensor_id, bucket)`) so partitions stay bounded (≲100MB) and old buckets simply stop being written to and age out.

**4. Never explicitly `DELETE`.** Deletes would scatter tombstones across windows and defeat the whole-SSTable-drop optimization.

**5. Keep writes roughly in time order and avoid updating old rows** — out-of-order or updated data smears across windows and breaks clean expiry.

This is the canonical healthy time-series pattern: expiry is free (windows drop), reads stay fast (no tombstone scans), and you never fight the tombstone/gc_grace/repair machinery.
## Repair & Anti-Entropy

### Summary

**What this topic covers**

How Cassandra keeps replicas of the same data in agreement over time, and why that is an *active* job rather than something that happens for free. Because Cassandra is an AP, eventually-consistent store, replicas of a partition drift apart whenever a node is down, a write is dropped under load, or a query is served at a consistency level below ALL. This topic covers the three anti-entropy mechanisms — **hinted handoff**, **read repair**, and **`nodetool repair`** (full anti-entropy repair) — how they complement each other, how repair uses **Merkle trees** to find differences cheaply, **full vs incremental** and **primary-range vs subrange** repair, the hard operational rule that you must repair every node inside **gc_grace_seconds** to avoid zombie data, tooling (**Cassandra Reaper**), and the cost/monitoring/consequences of getting it wrong. The 15 questions run from "why does Cassandra need repair at all" to "we never ran repair — what breaks."

**Mental model**

Think of every replica of a partition as a separate copy that is *usually* right but is allowed to fall behind. Cassandra never blocks a write waiting for all replicas, so at any instant some replicas are stale. Three forces push them back together, on three different timescales. **Hinted handoff** is *seconds-to-hours*: the coordinator stashes writes destined for a briefly-down replica and replays them when it returns — best-effort, bounded, and it gives up after `max_hint_window`. **Read repair** is *at-read-time*: when you actually query a row, Cassandra compares the replicas it touched and pushes the newest version to the stale ones — but only for data someone reads. **`nodetool repair`** is the *comprehensive, scheduled* backstop: it compares *all* data across replicas and streams the differences, whether or not anyone ever reads it. The critical insight: only full repair guarantees that a **delete (tombstone)** propagates to every replica before `gc_grace_seconds` expires. Skip repair and tombstones get purged unevenly, resurrecting deleted rows. Repair isn't optional hygiene — it's a correctness requirement.

**Key terms**

- **Anti-entropy** — the general process of detecting and reconciling divergence between replicas.
- **Hinted handoff** — coordinator stores a "hint" for a temporarily-down replica and replays it later; bounded by `max_hint_window_in_ms`.
- **Read repair** — during a read, stale replicas are corrected from the freshest response; only touches data that is read.
- **`nodetool repair`** — full anti-entropy repair; compares and streams differences for all data in the repaired ranges.
- **Merkle tree** — a hash tree of a token range; replicas exchange trees to locate mismatched sub-ranges without shipping all rows.
- **Validation phase** — building Merkle trees (CPU/IO heavy, reads all data in range).
- **Sync (streaming) phase** — streaming the differing partitions between replicas.
- **Full repair** — recomputes and compares everything in the range.
- **Incremental repair** — marks already-repaired SSTables so they are skipped next time; faster but historically fragile.
- **Primary-range repair (`-pr`)** — each node repairs only the ranges it primarily owns, so cluster-wide work isn't duplicated RF times.
- **gc_grace_seconds** — how long tombstones are retained before they can be purged; the deadline by which every replica must be repaired.
- **Cassandra Reaper** — the standard external tool to schedule, segment, throttle, and orchestrate repairs safely.

**Why interviewers ask this**

Repair separates people who have *operated* Cassandra from people who have only read about it. A junior candidate treats "eventual consistency" as magic that self-heals; a senior candidate knows that self-healing is largely *your* job, on a schedule, inside a deadline. The tombstone/gc_grace/zombie-data chain is the single most operationally important thing to understand — getting it right shows you grasp how deletes actually work in an LSM store. Interviewers also probe whether you know the *three* mechanisms and, crucially, why the first two are insufficient alone (hints expire; read repair never touches cold data). Being able to say "LOCAL_QUORUM writes + scheduled repair via Reaper" as the standard reliability recipe is a strong senior signal.

**Common confusions**

- "Eventual consistency means it fixes itself, so I don't need repair." — False. Without repair, cold, un-read data diverges forever and deletes resurrect.
- "Hinted handoff guarantees delivery." — No; hints have a bounded window and can be dropped. They reduce, not eliminate, the need for repair.
- "Read repair keeps everything consistent." — Only data that gets read. Cold data is never touched.
- "Repair copies all data every time." — No; Merkle trees mean it streams only the *differing* ranges.
- "Incremental repair is always the right default." — It's faster but was buggy for years; know the version caveats before recommending it blindly.
- "I can run repair whenever." — You must complete a repair cycle on every node within `gc_grace_seconds` (default 10 days), or risk zombie data.

**What follows from this topic**

Repair is the reconciliation half of the consistency story whose *write* half lives in **Consistency & Replication** (RF, consistency levels, R+W>RF) and whose *delete* mechanics live with **Tombstones & Compaction**. The gc_grace deadline ties directly to compaction and data modeling: TTL-heavy and delete-heavy schemas make repair timing more critical. Repair also intersects with cluster operations — adding a node or changing RF requires repair to make new replicas whole.

### Q1. Why does Cassandra need repair at all — isn't it eventually consistent?

"Eventually consistent" describes the *guarantee* (replicas will converge), not a mechanism that makes convergence happen for free. Cassandra deliberately never blocks a write on all replicas — it writes to whatever replicas meet your consistency level and moves on. So divergence is normal and constant:

- A replica was **down** when a write happened and missed it.
- A write was **dropped** under load (coordinator overload, timeout).
- You wrote at **ONE/LOCAL_QUORUM**, so not every replica got the write synchronously.

Something has to actively reconcile these. Read repair and hinted handoff patch *some* of it, but only repair (`nodetool repair`) systematically compares *all* data across replicas and fixes it. Most importantly, repair is the **only** mechanism that guarantees a delete (tombstone) reaches every replica before it's purged — without it you get resurrected data. Eventual consistency is a promise; repair is how you keep it.

### Q2. Explain the three anti-entropy mechanisms and how they complement each other.

They operate on different timescales and different data:

| Mechanism | When | Scope | Guarantee |
|---|---|---|---|
| **Hinted handoff** | Replica briefly down | Writes during the outage window | Best-effort; hints expire after `max_hint_window` |
| **Read repair** | At read time | Only data actually queried | Fixes replicas touched by that read |
| **`nodetool repair`** | Scheduled | ALL data in the range | Comprehensive; the real backstop |

The point is that the first two are *incomplete*. Hinted handoff only covers a bounded outage and drops hints if the node stays down too long or the coordinator restarts. Read repair only ever fixes data that someone reads — cold data (old rows nobody queries) is never corrected. Full repair is the only one that touches everything, read or not, which is why it's mandatory on a schedule despite the other two existing.

### Q3. How does hinted handoff work, and why isn't it sufficient on its own?

When a coordinator tries to write to a replica that is down (or not responding), it stores a **hint** — a record of the mutation plus its intended target — locally. When the down node comes back and gossip reports it as up, the coordinator replays the stored hints to it.

It's a latency/availability optimization: the down node catches up quickly without a full repair. But it is **best-effort** and bounded:

- Hints are only kept for `max_hint_window_in_ms` (default 3 hours). If the node is down longer, hints stop being stored and existing ones may be discarded.
- If the coordinator itself dies, its hints can be lost.
- Hints don't cover writes that were dropped for reasons other than a known-down replica.

So hinted handoff shrinks the window of divergence but never closes it. You still need full repair to guarantee convergence.

### Q4. How does read repair work, and what's its blind spot?

On a read, the coordinator contacts replicas per the consistency level. If it gets responses from multiple replicas and they disagree, it resolves to the newest version (by timestamp) and writes that back to the stale replicas — the read "repairs" them.

`read_repair` can be configured (`BLOCKING` or `NONE`) at table level, and historically there was also cross-DC probabilistic read repair. Either way, the blind spot is fundamental: **read repair only ever fixes data that is read.** A partition that no one queries for months can be arbitrarily stale on some replicas and read repair will never touch it. This is precisely the cold-data gap that full `nodetool repair` exists to close.

### Q5. What are Merkle trees and how does repair use them?

A **Merkle tree** is a binary hash tree: leaves hash small sub-ranges of the token space, and each parent hashes its children. The root summarizes the whole range in one hash.

During repair's **validation phase**, each participating replica reads its data for the range and builds a Merkle tree. Replicas then exchange trees and compare them top-down. If two roots match, the ranges are identical — done, nothing to stream. If they differ, they descend into the children to find *which* sub-ranges differ, and only those leaf ranges are reconciled. This is the key efficiency: instead of shipping every row across the network to compare, they compare compact hashes and stream only the partitions that actually differ (the **sync phase**).

The cost is that building the trees requires reading all the data in the range (CPU + IO heavy), which is why validation is the expensive part and why you throttle and schedule repair.

### Q6. What's the difference between full and incremental repair?

**Full repair** rebuilds Merkle trees over *all* SSTables in the range every run, regardless of whether that data was repaired before. Correct but expensive — you re-validate data that hasn't changed since the last repair.

**Incremental repair** marks SSTables as "repaired" once they've been through a successful repair. Subsequent repairs skip already-repaired SSTables and only validate the unrepaired (new since last repair) data. This is much faster and is the modern default guidance.

The caveat: incremental repair was **historically buggy** (over-streaming, anti-compaction issues, marking data repaired that wasn't fully so) for many versions. On modern Cassandra (4.x+) it's much improved, but you should know the version and validate it in your environment before relying on it. A common safe pattern is incremental for routine cycles plus occasional full repairs.

### Q7. What is primary-range repair (`-pr`) and why use it?

Every partition is replicated RF times, so a naive full-cluster repair would validate and reconcile each range once *per replica* — RF× redundant work.

**Primary-range repair** (`nodetool repair -pr`) tells each node to repair only the token ranges for which it is the *primary* owner. If you run `-pr` on every node in the cluster, every range gets repaired exactly once collectively, with no duplication.

```bash
# run on every node, ideally staggered / off-peak
nodetool repair -pr
```

The tradeoff: with `-pr` you must run it on *all* nodes to cover the full ring; skipping a node leaves its primary ranges unrepaired. Tools like Reaper handle this orchestration for you.

### Q8. What is subrange repair and when is it useful?

Subrange repair repairs a specific slice of a node's token range (via `--start-token` / `--end-token`) rather than the whole range at once.

It's useful because a single range can be huge, and repairing it in one shot means one enormous validation + streaming operation that's hard to throttle, easy to time out, and painful to resume if it fails. Breaking a node's ranges into many small **subrange segments** lets you:

- Throttle and pace the work.
- Retry a failed segment cheaply instead of restarting the whole range.
- Keep IO/CPU impact bounded and predictable.

This is exactly what **Cassandra Reaper** automates — it splits the ring into segments and repairs them incrementally with concurrency and throttling controls.

### Q9. Why must you run repair on every node within gc_grace_seconds?

This is the single most important operational rule in Cassandra, and it's about deletes. A delete writes a **tombstone** — a marker that says "this data is deleted as of timestamp T." Tombstones are retained for `gc_grace_seconds` (default 10 days) and only then eligible to be purged by compaction.

The window exists so that repair can propagate the tombstone to *every* replica before it's purged. If a replica was down when the delete happened and never receives the tombstone, and then all copies of the tombstone are purged after gc_grace on the replicas that did get it, that down replica still holds the *original live data*. On the next read/repair it will propagate that live data back — the deleted row **resurrects** (a "zombie").

The rule: **complete a full repair on every node at least once every `gc_grace_seconds`.** If you can't keep up, you must raise gc_grace (at the cost of retaining tombstones longer). Miss the deadline and you risk zombie data.

### Q10. What is Cassandra Reaper and why is it the standard tool?

Running repair correctly by hand is genuinely hard: you must repair every node inside gc_grace, avoid overlapping repairs that overload the cluster, segment large ranges, throttle IO, retry failures, and do it continuously forever. Hand-rolled cron scripts get this wrong.

**Cassandra Reaper** (open source, originally from Spotify/The Last Pickle) is the de facto tool for this. It:

- Splits the ring into subrange **segments** and repairs them with controlled **concurrency**.
- **Throttles** to limit cluster impact; schedules repairs off-peak.
- Tracks progress, **retries** failed segments, and resumes.
- Ensures every node/range is repaired within your gc_grace window.
- Provides a UI/API for scheduling and monitoring.

If an interviewer asks "how do you run repair in production," the expected answer is "Reaper on a schedule," not "a cron job calling `nodetool repair`."

### Q11. What is the cost of repair and how do you keep it from hurting the cluster?

Repair is expensive on three axes:

- **CPU + IO** — the validation phase reads all data in the range to build Merkle trees.
- **Network + IO** — the sync phase streams differing partitions between nodes.
- **Compaction pressure** — streamed data lands as new SSTables that then need compacting.

An unthrottled full-cluster repair can spike latency and starve normal traffic. Mitigations:

- Run **off-peak** and stagger across nodes (never repair everything at once).
- Use **subrange segments** with limited concurrency (Reaper).
- Throttle streaming (`nodetool setstreamthroughput`) and compaction throughput.
- Prefer **incremental** repair (on versions where it's solid) to cut validation work.
- Use **`-pr`** to avoid RF× redundant validation.

The goal is steady, throttled, continuous repair — not an occasional big-bang run.

### Q12. What actually goes wrong if you never run repair?

Three failure modes, escalating:

1. **Inconsistent reads.** Replicas diverge and, depending on which replicas a read hits at a given consistency level, you get different (stale) answers. Read repair patches some of this but only for data that's read.
2. **Data resurrection (zombies).** Tombstones get purged after gc_grace on the replicas that received them, while a replica that missed the delete still holds the live row — and re-propagates it. Deleted data comes back. This is the scary, silent one.
3. **Growing entropy.** The longer you go, the more the replicas drift, and the more painful the eventual "catch-up" repair becomes (huge streaming, big compaction backlog).

"We've never run repair and everything's fine" usually means you simply haven't *noticed* the resurrected rows or stale reads yet.

### Q13. After adding a node or increasing RF, why do you need repair?

Both operations create replicas that don't yet hold all the data they're now responsible for.

- **Adding a node** — bootstrap streams the ranges the new node now owns, but to be safe (and if bootstrap missed anything, or you added with `-Dcassandra.consistent.rangemovement=false`) you run repair to guarantee the new node and its neighbors agree.
- **Increasing RF** — say RF goes from 3 to 5. The two new replicas for each partition have *no data* for it yet. Reads at low consistency could hit an empty replica and return nothing. You must run **full repair** so the new replicas are populated before relying on the higher RF, and typically read at a consistency level that tolerates the gap until repair completes.

Changing RF without a follow-up repair is a classic way to cause missing-data reads.

### Q14. What is the over-streaming pitfall in repair?

Over-streaming is when repair streams far more data than actually differs between replicas. Causes:

- **Merkle tree granularity.** Trees have limited depth, so each leaf covers a range of tokens. If even one partition in a leaf differs, the *whole leaf's* partitions may be considered mismatched and streamed — amplifying a tiny difference into a large transfer.
- **Buggy incremental repair** (older versions) mixing repaired/unrepaired SSTables during **anti-compaction**, causing data to be re-streamed unnecessarily.

The symptoms are repairs that stream gigabytes when little actually changed, followed by a compaction storm. Mitigations: use subrange repair (smaller ranges → finer effective granularity), keep partitions reasonably sized, and use a modern Cassandra version where incremental repair's anti-compaction is fixed.

### Q15. Someone says "LOCAL_QUORUM plus repair is the reliability recipe." Why?

Because together they cover both halves of consistency:

- **LOCAL_QUORUM writes and reads** give you strong consistency *within a datacenter* right now — with RF=3, W=QUORUM(2) and R=QUORUM(2), R+W (4) > RF (3), so a read is guaranteed to see the latest committed write, while staying available if one replica is down and avoiding cross-DC latency.
- **Scheduled repair** handles the *over time* half: it reconciles replicas that drifted (dropped writes, downed nodes) and — critically — propagates tombstones before gc_grace so deletes don't resurrect.

LOCAL_QUORUM alone doesn't fix cold data or guarantee tombstone propagation; repair alone doesn't give you read-your-writes consistency at query time. Run both and you get correct reads now *and* convergence + no zombies over time. That's why it's the standard production posture, and why "we run LOCAL_QUORUM and Reaper" is the answer interviewers want.

## Advanced Data Types & Indexing

### Summary

**What this topic covers**

The richer data-modeling tools Cassandra gives you *inside* a row — **collections** (set/list/map), **user-defined types (UDTs)**, **counters**, and **static columns** — and then the perennially misunderstood subject of **indexing**: why **secondary indexes (2i)** are nothing like relational indexes, the legacy **SASI**, the modern **SAI (Storage-Attached Indexing)** in Cassandra 5.0, **materialized views**, and how to choose between "make another table," 2i, SAI, and MVs for a given query. The through-line is Cassandra's query-first philosophy: these features are conveniences layered on top of a partition-key-centric storage engine, and each has sharp edges (tombstone gotchas, scatter-gather, write amplification) that come straight from that engine. The 16 questions run from "what are collections for" to "how do I query by email when it isn't the partition key" and "what's wrong with a secondary index on a high-cardinality column."

**Mental model**

Cassandra stores data as partitions of rows, and everything here bends around that. **Collections and UDTs** let a single row hold a small, bounded group of values without a separate table — each element is physically a **cell**, so they're cheap for small groups and dangerous for large ones. **Counters** are a special column type with read-modify-write semantics because distributed increment can't be last-write-wins. **Static columns** attach one value to a whole partition. Then indexing: relational databases assume a global index you can query freely; Cassandra can't, because data is sharded by partition key across nodes. A **secondary index** is a *local* index on each node, so querying it without a partition key means **scatter-gather across every node** — fine occasionally, disastrous as a routine access pattern. The senior instinct is: when you need to query by a non-key column at scale, the default answer is usually **"make another table"** (denormalize), and reach for SAI/2i/MV only when a second table is genuinely worse.

**Key terms**

- **Collection (set/list/map)** — a multi-valued column for a small bounded group; each element stored as its own cell.
- **Frozen** — the collection/UDT is serialized as a single opaque blob; can't update individual elements, but usable in keys.
- **UDT (user-defined type)** — a named composite type grouping fields, used as a column type (often frozen).
- **Counter** — special column supporting distributed increment/decrement via read-modify-write; can't coexist with normal columns in a table.
- **Static column** — a column whose value is shared by all rows in a partition (one value per partition).
- **Secondary index (2i)** — a hidden per-node index table letting you query a non-key column; scatter-gathers across nodes.
- **SASI** — legacy, experimental index supporting text/range queries; largely superseded.
- **SAI (Storage-Attached Indexing)** — Cassandra 5.0's modern secondary index: multiple per table, numeric range + text, lower overhead, plus vector/ANN.
- **Materialized view (MV)** — a server-maintained denormalized copy of a base table keyed differently.
- **Denormalized table** — a hand-maintained second table written to explicitly for a different query pattern.
- **ALLOW FILTERING** — forces Cassandra to scan and filter rows the query can't satisfy via keys/indexes; a performance red flag.
- **Cardinality** — number of distinct values a column has; the key factor in whether a 2i is viable.

**Why interviewers ask this**

Indexing questions are the fastest way to tell whether a candidate has internalized Cassandra's data model or is still thinking in SQL. A junior reaches for `CREATE INDEX` the moment they need to query a non-key column; a senior asks "how selective is it, and will this scatter-gather every node?" and often answers "model a second table instead." Collections and counters have specific, well-known traps (collection tombstones, list concurrency, counter inaccuracy under retries) that separate people who've been burned from people who've read a tutorial. And knowing that **SAI** (5.0) has changed the calculus — making secondary indexes genuinely useful for the first time — signals you're current, not stuck on 3.x folklore.

**Common confusions**

- "A secondary index works like a relational index." — No; it's per-node and scatter-gathers, so it doesn't scale like a global B-tree index.
- "Just add ALLOW FILTERING to make the query work." — It makes it *run*, not *scale*; it's a full scan waiting to hurt you.
- "Collections are a good place to store lots of items." — No; keep them small and bounded — each element is a cell and overwrites create tombstones.
- "Lists are just like sets." — Lists have read-before-write and concurrency hazards; prefer sets or maps unless order truly matters.
- "Counters are exact." — They're approximate under retries/failures; use them for likes/views, not accounting.
- "Materialized views are free denormalization." — They carry consistency/repair caveats and an "experimental" reputation; hand-maintained tables are often safer.

**What follows from this topic**

This builds directly on **Data Modeling** (query-first, one-table-per-query, partition/clustering keys) — indexing is what you consider *only after* deciding a separate table isn't the answer. Collection and counter tombstone/consistency behavior ties back to **Tombstones & Compaction** and **Consistency & Replication**. The "make another table and keep it in sync" pattern connects forward to **Lightweight Transactions & Batches**, where single-partition logged batches keep denormalized tables consistent.

### Q1. What collection types does Cassandra support and what are they for?

Cassandra has three collection types, all meant for a **small, bounded** group of values that logically belongs to one row:

- **set<T>** — unordered, unique values (e.g. a user's tags).
- **list<T>** — ordered, allows duplicates (e.g. an ordered list of phone numbers).
- **map<K,V>** — key-value pairs (e.g. `{ "home": "...", "work": "..." }`).

```cql
CREATE TABLE users_by_id (
  id uuid PRIMARY KEY,
  name text,
  emails set<text>,
  prefs map<text, text>
);
```

The critical constraint: collections are for **small** groups (tens of items, not thousands). Each element is stored as an individual cell, and the whole collection is read into memory as part of the row. They are *not* a substitute for a proper table when the group is unbounded — if a user could have a million items, that's a partition/table, not a collection.

### Q2. How are collections stored, and why does that matter?

Each element of a non-frozen collection is stored as its **own cell**, with the collection element (set value, list index/UUID, or map key) encoded into the cell's clustering/column path. That's what lets you update individual elements without rewriting the whole collection.

Consequences:

- **Reads pull the whole collection.** There's no "page through a collection" — accessing the row materializes all its cells. Big collections = big reads and memory pressure.
- **Per-element overhead.** Each cell carries a timestamp (and for TTL, an expiry), so large collections have real storage overhead.
- **Tombstone risk on overwrite** (see next question).

This is exactly why the guidance is "keep collections small and bounded." The storage model makes small collections convenient and large ones a latency and tombstone hazard.

### Q3. What's the tombstone gotcha with collections, and why prefer sets/maps over lists?

**Overwriting a whole collection creates a tombstone.** When you do `UPDATE ... SET emails = {...}`, Cassandra can't know which old elements to keep, so it writes a **range tombstone** to delete everything currently there, then inserts the new elements. Do this frequently and you accumulate collection tombstones, which hurt read latency. Prefer *element-level* updates (`emails = emails + {'x'}`) over wholesale reassignment.

**Lists are worse than sets/maps** for two reasons:

- **Read-before-write.** Some list operations (e.g. setting or removing by index, prepend) require Cassandra to read the current list first — violating the "writes don't read" fast-path and adding latency + a race window.
- **Concurrency hazards.** Because of index-based semantics, concurrent list modifications can produce surprising results (duplicate or lost elements) since there's no coordination.

Guidance: use **set** if you don't need order/duplicates, **map** if you need keyed values, and reach for **list** only when order genuinely matters — and even then prefer append/prepend of whole elements over index operations.

### Q4. What's the difference between frozen and non-frozen collections/UDTs?

**Non-frozen** — the collection/UDT is stored as individual cells; you can update elements independently (`SET m['k'] = 'v'`, `SET s = s + {x}`). This is the flexible, default mode.

**Frozen** — the entire collection/UDT is serialized into a **single opaque blob**. You can only replace it wholesale, not update elements. But because it's a single value:

- It can be used as (part of) a **primary key** or inside another collection.
- It has less per-element overhead.

```cql
CREATE TYPE address (street text, city text, zip text);

CREATE TABLE users_by_id (
  id uuid PRIMARY KEY,
  home frozen<address>,        -- whole address updated at once
  tags set<text>               -- individual tags updatable
);
```

Rule of thumb: use frozen when the value is atomic/immutable-ish or needs to be in a key; non-frozen when you need element-level updates.

### Q5. What are user-defined types (UDTs) and when should you use one?

A **UDT** groups several fields under one named type so you can use it as a column type:

```cql
CREATE TYPE address (street text, city text, zip text, country text);

CREATE TABLE users_by_id (
  id uuid PRIMARY KEY,
  name text,
  home_addr frozen<address>
);
```

Use a UDT when a set of fields **always travels together** and belongs to the row — an address, a geo-coordinate, a money amount+currency. It's cleaner than a pile of `home_street`, `home_city`, `home_zip` columns and keeps related fields grouped.

When *not* to: if you need to query or index individual sub-fields, or the group is really a one-to-many relationship, use separate columns or a separate table. UDTs are usually **frozen** in practice (simpler, keyable), which means you replace the whole value on update — fine for cohesive value objects, awkward if sub-fields change independently.

### Q6. What are counters and why are they a special column type?

A **counter** is a column supporting distributed **increment/decrement**:

```cql
CREATE TABLE page_views (
  page_id text PRIMARY KEY,
  views counter
);

UPDATE page_views SET views = views + 1 WHERE page_id = 'home';
```

They're special because normal Cassandra writes are **last-write-wins** with a client-supplied timestamp — that model can't express "add 1 to whatever's there," since two concurrent +1s would clobber each other rather than sum. Counters instead use a **read-modify-write** protocol coordinated across replicas so increments accumulate correctly.

That specialness comes with hard restrictions (next question) and accuracy caveats: because they're read-modify-write and not idempotent, a retried increment after an uncertain timeout can double-count or under-count. Use counters for **approximate** metrics — likes, views, votes — never for anything that must be exact, like financial balances.

### Q7. What are the restrictions and hazards of counter columns?

Restrictions:

- **A counter table can't mix counter and non-counter columns** (besides the primary key). All non-PK columns must be counters. If you need other attributes, put them in a separate table.
- You **can't set** a counter to an arbitrary value or `INSERT` one — only increment/decrement via `UPDATE`.
- Counters **can't have a TTL** and don't play nicely with some operations.

Hazards:

- **Not idempotent.** A `+1` that times out with an unknown outcome is dangerous to retry — you might apply it twice or zero times. This makes counters unreliable for exact counts.
- **Accuracy drift.** Under failures, streaming, or (historically) certain repair/compaction scenarios, counters can lose precision.

Bottom line: counters are a pragmatic tool for high-volume approximate metrics. If you need exactness, model events (append immutable rows) and aggregate, or use an external system with proper transactional semantics.

### Q8. What is a static column and when would you use one?

A **static column** holds **one value per partition**, shared by all rows (clustering rows) in that partition:

```cql
CREATE TABLE messages_by_conversation (
  conversation_id uuid,
  message_id timeuuid,
  conversation_name text STATIC,   -- one per conversation
  sender text,
  body text,
  PRIMARY KEY (conversation_id, message_id)
);
```

Here every message row in a conversation shares one `conversation_name`. It's ideal for **partition-level metadata** — data that describes the whole partition rather than an individual row: a conversation's title, an account's plan tier alongside its transaction rows, a device's model alongside its readings.

Benefits: you avoid duplicating the value on every row, and you can update it once. It requires a table with clustering columns (a static column makes no sense in a single-row-per-partition table). Reads can fetch just the static column cheaply, and writes can set it independently of the clustering rows.

### Q9. Why are secondary indexes (2i) not like relational indexes?

In a relational DB, an index is a *global* structure — one B-tree over the whole table — so an indexed lookup goes straight to the matching rows. Cassandra can't do that, because rows are sharded by partition-key token across many nodes and there's no global index.

A Cassandra **secondary index** is therefore a **hidden index table local to each node**, indexing only the data that node stores. When you query by an indexed column *without also restricting the partition key*, the coordinator has no idea which nodes hold matches, so it must **scatter-gather**: query *every* node, collect partial results, and merge. That's O(cluster size) work per query.

So a 2i is fine when the query also pins the partition (so it's node-local) or the cluster is small and the index selective, but it does **not** give you a scalable "find rows by column X" the way SQL does. Treating it like a relational index is the classic mistake.

### Q10. When is a secondary index acceptable, and what are the anti-patterns?

**Acceptable-ish:**

- The query also restricts the **partition key**, so the index lookup is node-local (no scatter-gather). E.g. "within this partition, rows where status = 'active'."
- The column has **moderate cardinality** and the indexed value returns a manageable number of rows.
- The table isn't enormous and the query is infrequent.

**Anti-patterns (why 2i has a bad reputation):**

- **High-cardinality columns** (e.g. email, user_id) — nearly every value is unique, so the index is huge and each lookup still scatter-gathers to find a handful of rows. Terrible.
- **Very low-cardinality columns** (e.g. boolean, gender) — each value matches a huge fraction of rows across all nodes; you scan almost everything.
- **Frequently-updated columns** — every update churns the index, adding write and tombstone overhead.

The frequent right answer is **"model another table"** keyed by the column you want to query. Reach for 2i only in the narrow node-local case — or use **SAI** on 5.0.

### Q11. What is SASI and what happened to it?

**SASI (SSTable-Attached Secondary Index)** was an experimental index type added to give richer querying than classic 2i — notably **text search** (prefix/contains via `LIKE`) and **range** queries on non-key columns, with the index attached to SSTables.

It never fully shed its "experimental" status: it had correctness edge cases, high memory/disk overhead for some workloads, and limited maintenance. It was useful in specific cases (server-side text prefix search) but was never recommended as a general-purpose solution.

SASI is effectively **superseded by SAI** in Cassandra 5.0, which delivers similar (and broader) capabilities with a much more solid, production-oriented implementation. On modern clusters you should reach for SAI, not SASI.

### Q12. What is SAI (Storage-Attached Indexing) and why is it better?

**SAI**, introduced in **Cassandra 5.0**, is the modern secondary indexing engine and a genuine step change over classic 2i and SASI:

- **Multiple indexes per table** at low incremental cost — the index structures share storage attached to SSTables, so adding several indexes doesn't multiply overhead the way multiple 2i's would.
- **Numeric range and text** queries (not just equality), with better selectivity handling.
- **Much lower disk and write overhead** than classic 2i for equivalent indexing.
- **Vector / ANN search** for embeddings — SAI underpins Cassandra's vector search, enabling similarity queries for AI workloads.

It still lives within the same distributed reality (a query without a partition-key restriction can still fan out), but SAI makes secondary indexing *actually viable* for many patterns that were 2i anti-patterns before. On 5.0, SAI is the recommended path when you need to query by a non-partition-key column and don't want a whole extra table.

### Q13. What are materialized views and what are their caveats?

A **materialized view (MV)** is a server-maintained denormalized copy of a base table, keyed differently:

```cql
CREATE MATERIALIZED VIEW users_by_email AS
  SELECT * FROM users_by_id
  WHERE email IS NOT NULL AND id IS NOT NULL
  PRIMARY KEY (email, id);
```

Now you can query `users_by_email` by email. Cassandra automatically keeps the view in sync as the base table changes — convenient, because you don't hand-write the second table.

The caveats are why many teams avoid them:

- **Consistency/repair issues.** Keeping the view consistent with the base under failures, concurrent updates, and repair has known bugs; views can drift from the base and are awkward to repair back into agreement.
- **"Experimental" reputation.** MVs have carried warnings for years; some organizations disable them.
- **Write amplification.** Each base write may trigger view maintenance (including read-before-write in some cases).

The common recommendation is to **hand-maintain a denormalized table** instead (write to both tables from the app, ideally via a single-partition logged batch), which gives you explicit control over consistency.

### Q14. How do I decide between another table, 2i, SAI, and a materialized view for a query?

Decision order, roughly:

1. **Another table (denormalize).** Default for a *frequent, performance-critical* access pattern. Query-first modeling says build one table per query. Keep tables in sync from the app (single-partition logged batch where atomicity matters). Best performance and predictability; costs extra writes and storage.
2. **SAI (5.0+).** Good when you need to query by a non-key column, the pattern is *secondary* (not your hottest path), and you don't want to maintain a whole extra table. Far better than old 2i; supports range/text/vector.
3. **Secondary index (2i).** Only in the narrow case: query also restricts the partition key (node-local), moderate cardinality, infrequent. Otherwise avoid.
4. **Materialized view.** Convenient auto-maintained denormalization, but weigh the consistency/repair caveats — often a hand-maintained table is safer.

The instinct interviewers want: extra table for the hot path, SAI for convenient secondary queries on modern clusters, 2i only when node-local, MV with caution.

### Q15. What's wrong with using ALLOW FILTERING, and how does it relate to indexing?

`ALLOW FILTERING` tells Cassandra: "I know this query can't be satisfied by the primary key or an index alone — scan and filter rows anyway." Cassandra normally *refuses* such queries precisely because they don't scale.

```cql
-- refused without the clause, because status isn't a key
SELECT * FROM users_by_id WHERE status = 'active' ALLOW FILTERING;
```

The problem: this reads far more data than it returns, potentially scanning entire partitions or fanning across nodes, with latency that grows with data size. It's fine for a one-off admin query on a small table; it's a **red flag** in application code — a schema smell saying "I'm querying by something I didn't model for."

Relation to indexing: `ALLOW FILTERING` is what you fall back to when you *don't* have an appropriate table or index. The fix is to add the right access path — a **purpose-built table** (best) or an appropriate **SAI** index — not to ship the filter scan.

### Q16. I need to query users by email, but email isn't the partition key. What do I do?

Standard interview scenario. Your `users_by_id` table is keyed by `id`, but login needs lookup by email. Options, in order of preference:

**1. A second table keyed by email (recommended).**

```cql
CREATE TABLE users_by_email (
  email text PRIMARY KEY,
  id uuid,
  name text
);
```

Write both tables together — ideally a **single-partition logged batch** per user won't work across different partition keys, so use a logged batch across the two tables (atomic, at some coordinator cost) or accept eventual consistency and reconcile. Email lookups are now a single-partition read: fast and scalable. This is the query-first answer.

**2. SAI index on email (Cassandra 5.0).** If maintaining a second table is too much and you're on 5.0, an SAI index on `email` handles it with far less pain than old 2i. Still weigh fan-out for non-partition-restricted queries.

**Not recommended:** a classic **2i on email** (high cardinality → scatter-gather, bad) or `ALLOW FILTERING` (full scan). Email is unique and high-cardinality — exactly the 2i anti-pattern. Model the second table.

## Lightweight Transactions & Batches

### Summary

**What this topic covers**

The two features people reach for when they want SQL-style transactional behavior in Cassandra — **lightweight transactions (LWT)** and **batches** — and, just as importantly, how both are routinely *misused*. Cassandra has **no general multi-row ACID transactions** by default: writes are last-write-wins with no locks. LWT provides linearizable **compare-and-set** (via `IF NOT EXISTS` / `IF col = ?`) using **Paxos**, at roughly 4× the latency of a normal write. Batches provide **atomicity** (logged batches) — not performance, not isolation — and are famously abused as a bulk-loading tool, which makes things *slower*. This topic covers how LWT works and when it's justified, SERIAL vs LOCAL_SERIAL, the `[applied]` result, the Cassandra 5.0 **Accord/ACC** general-transactions future, logged vs unlogged batches, the multi-partition batch anti-pattern, single-partition batches as the good use, and why parallel async writes beat batches for throughput. The 15 questions go from "does Cassandra have transactions" to "should I use a batch here — diagnose it."

**Mental model**

Start from the default: Cassandra writes are dumb-fast and dumb-simple — append with a timestamp, last write wins, no read, no lock, no coordination. Everything in this topic is what you bolt on when that isn't enough, and each bolt-on trades away Cassandra's core advantage (cheap, uncoordinated writes) for a guarantee. **LWT** buys you *linearizable conditional writes* by running a Paxos consensus round among the replicas — four round-trips, so ~4× latency and much lower throughput; you use it sparingly for correctness-critical uniqueness/CAS (unique usernames, optimistic concurrency). **Batches** buy you *atomicity across statements* via a batchlog — all-or-nothing eventually — but **not** isolation and **not** speed. The universal mistake is treating a batch like a SQL transaction for performance: a multi-partition batch actually *overloads one coordinator* and is slower than firing the writes in parallel. The right frame: use LWT rarely, use logged batches only to keep a few related (ideally same-partition) tables in sync atomically, and use parallel async writes for throughput.

**Key terms**

- **Last-write-wins (LWW)** — default conflict resolution; the write with the highest timestamp wins, no locking.
- **Lightweight transaction (LWT)** — a conditional write (`IF NOT EXISTS`, `IF col = ?`) that is linearizable via Paxos.
- **Paxos** — the consensus protocol LWT uses; ~4 round-trips (prepare/promise, propose/accept) plus a read.
- **SERIAL / LOCAL_SERIAL** — the serial consistency levels LWT uses; LOCAL_SERIAL confines Paxos to the local DC.
- **`[applied]`** — the boolean column an LWT returns: `true` if the condition held and the write happened, `false` otherwise (with current values).
- **Logged batch** — statements recorded in the batchlog first; guarantees atomicity (all eventually apply or none).
- **Unlogged batch** — a grouping of statements with **no** atomicity guarantee; just one coordinator round-trip.
- **Batchlog** — a system table replicating a batch's statements so a coordinator failure can't leave it half-applied.
- **Single-partition batch** — a batch where all statements share one partition key; efficient and atomically isolated.
- **Multi-partition batch** — statements spanning partitions/nodes; the anti-pattern when used for bulk speed.
- **Accord / ACC** — Cassandra 5.0's general-purpose, multi-partition transaction protocol (leaderless consensus).
- **Idempotency** — whether re-applying an operation is safe; central to retrying LWTs and batches after timeouts.

**Why interviewers ask this**

This topic is a misconception minefield, which makes it a great filter. Candidates from a relational background assume `BATCH` means "transaction" and reach for it to make bulk writes atomic *and* fast — exactly backwards. A senior candidate explains that batches are for atomicity of a few related writes, cost the coordinator, and are *slower* than parallel writes for bulk. Similarly, LWT looks like a cheap "just add `IF NOT EXISTS`," but a senior knows it invokes Paxos, costs ~4× latency, and must be rationed. Being able to say "LWT for the rare uniqueness check, single-partition logged batch to keep denormalized tables in sync, async parallel writes for throughput, and Accord on 5.0 for real transactions" demonstrates you understand Cassandra's actual concurrency model rather than importing SQL habits.

**Common confusions**

- "A batch is a transaction like in SQL." — No; logged batches give atomicity, not isolation, and never give performance.
- "Batches make bulk writes faster." — The opposite for multi-partition batches: they overload one coordinator and are slower than parallel async writes.
- "Unlogged batches are atomic." — No; they carry no atomicity guarantee, just grouping.
- "LWT is just adding `IF NOT EXISTS`, cheap." — It runs Paxos, ~4× latency, much lower throughput; ration it.
- "I can use LWT as a general lock." — That's a performance disaster; LWT is for rare correctness-critical CAS.
- "LWT reads are automatically consistent with normal reads." — You must read at SERIAL to be guaranteed to see the latest committed Paxos write.

**What follows from this topic**

This closes the loop opened by **Consistency & Replication** (tunable consistency, R+W>RF): LWT is where Cassandra offers *linearizable* consistency, at a price, via SERIAL. It ties to **Advanced Data Types & Indexing**, where the recommended fix for "query by email" was a second table plus a **single-partition logged batch** to keep tables in sync — this topic explains why that batch is the *right* use and a multi-partition bulk batch is the wrong one. It also connects to **Data Modeling**: good modeling minimizes the need for LWT and cross-partition atomicity in the first place.

### Q1. Does Cassandra support ACID transactions?

By default, **no** — not general multi-row ACID transactions. Cassandra's write model is **last-write-wins**: a write carries a timestamp, is applied without reading or locking, and the highest timestamp wins on conflict. There are no locks, no rollback, no isolation across statements, and no cross-partition atomicity out of the box.

What it *does* offer are two narrower tools:

- **Lightweight transactions (LWT)** — linearizable **compare-and-set** on a *single partition*, via Paxos.
- **Logged batches** — **atomicity** (all-or-nothing) across a set of statements, but *not* isolation.

And single writes have some ACID-ish properties: a single-partition write is atomic and isolated *for that partition*, and durable (commit log). But if you're asked "can I do a bank transfer with debit-one-account/credit-another atomically and isolated," the honest default answer is "not with vanilla Cassandra" — until 5.0's **Accord** (see later). This is a deliberate tradeoff for scale and availability.

### Q2. What is a lightweight transaction and when would you use one?

An **LWT** is a *conditional* write — it only applies if a condition on the current data holds:

```cql
-- register a username only if it's free
INSERT INTO users_by_name (username, id)
VALUES ('alice', 550e8400-...)
IF NOT EXISTS;

-- optimistic concurrency: update only if unchanged
UPDATE accounts SET status = 'closed'
WHERE id = ?
IF status = 'active';
```

It gives you **linearizable compare-and-set** on a single partition — the thing plain LWW writes can't do, because two clients could otherwise both "check then write" and both think they won.

Use it for **rare, correctness-critical** cases:

- **Uniqueness** — claim a unique username/email/slug exactly once.
- **Optimistic concurrency** — "update only if the version/status is still what I read."
- **Idempotent creation** — insert-if-absent.

The key word is *rare*. LWT is expensive (next question), so it's the exception you sprinkle on the few operations that truly need atomic check-and-set, not a default.

### Q3. How does an LWT work under the hood, and why is it ~4× slower?

An LWT runs **Paxos**, a consensus protocol, among the replicas of the partition. Simplified, a successful LWT is roughly **four round-trips**:

1. **Prepare / promise** — the coordinator proposes a ballot; replicas promise not to accept older ballots.
2. **Read** — the current value is read (at SERIAL) to evaluate the `IF` condition.
3. **Propose / accept** — if the condition holds, the new value is proposed and replicas accept.
4. **Commit** — the accepted value is committed and acknowledged.

Compared to a normal write (one round-trip to replicas), that's ~**4× the latency** and far lower throughput, plus it uses SERIAL/LOCAL_SERIAL consistency which requires a quorum of replicas to participate. Contention makes it worse: concurrent LWTs on the same partition can force retries as ballots collide.

That cost is *the* reason LWT must be rationed. It's fine for a username registration that happens once per user; it's catastrophic as the mechanism behind every write in a hot path.

### Q4. What's the difference between SERIAL and LOCAL_SERIAL?

These are the **serial consistency levels** that govern the Paxos phase of an LWT (distinct from the normal consistency level, which governs the commit).

- **SERIAL** — Paxos requires a quorum of replicas **across all datacenters**. Strongest, but in a multi-DC deployment it pays cross-DC latency on every LWT.
- **LOCAL_SERIAL** — Paxos runs among replicas in the **local datacenter** only. Much lower latency in multi-DC setups, at the cost of not coordinating with other DCs (so cross-DC linearizability isn't guaranteed).

In a single-DC cluster they're effectively equivalent. In multi-DC, you almost always want **LOCAL_SERIAL** for LWTs — pairing naturally with LOCAL_QUORUM for the normal writes — to keep the (already high) LWT latency from also crossing datacenters. You set it as the serial consistency on the statement/session.

### Q5. What does an LWT return, and how do you use the result?

An LWT returns a special row with an **`[applied]`** boolean:

- **`[applied] = true`** — the condition held and the write happened.
- **`[applied] = false`** — the condition did *not* hold; the write did **not** happen, and Cassandra returns the **current values** of the columns involved so you can see why.

```cql
INSERT INTO users_by_name (username, id) VALUES ('alice', ?) IF NOT EXISTS;
-- [applied]=false, username='alice', id=<existing> → someone already took it
```

Your application must **check `[applied]`** and branch: on `false`, handle the conflict (username taken, version stale — often re-read and retry your logic). This is the compare-and-set contract: the returned current values let you implement optimistic-concurrency retry loops correctly. Ignoring `[applied]` and assuming the write succeeded is a common bug.

### Q6. When is LWT justified versus when is it overused?

**Justified (rare, correctness-critical):**

- Enforcing **uniqueness** where a duplicate is genuinely unacceptable (username, account number).
- **Optimistic concurrency** on a specific record that multiple clients might race on.
- **Idempotent create** (`IF NOT EXISTS`) to avoid double-creation.

**Overused (performance disaster):**

- As a **general locking mechanism** — wrapping ordinary updates in `IF` conditions to serialize access. Every such write now pays 4× latency and contends on Paxos.
- On **hot partitions** where many clients LWT the same key — ballot contention causes retries and collapse.
- When the correctness requirement could be **designed away** — e.g. using a naturally unique partition key so `INSERT` alone can't create a dup, or tolerating LWW because the app doesn't actually need linearizability.

The senior heuristic: if you find yourself using LWT on a frequent write path, step back and remodel. LWT is a scalpel, not a lock library.

### Q7. Are LWT writes visible to normal reads consistently?

Not automatically — you have to read correctly. An LWT commits through Paxos at SERIAL, but a **normal read** (e.g. at QUORUM/LOCAL_QUORUM) is *not* guaranteed to reflect an in-flight or just-committed Paxos operation, because a Paxos round may be committed on some replicas but the normal read path doesn't run the Paxos read protocol.

To be guaranteed to see the latest committed LWT value, read at **SERIAL** (or LOCAL_SERIAL):

```cql
-- serial read: sees the latest committed Paxos state (and finishes in-progress rounds)
SELECT * FROM accounts WHERE id = ? ;   -- with serial consistency set
```

A SERIAL read participates in / completes any in-progress Paxos round, giving linearizable read-your-writes with LWT. The practical rule: if a value's correctness depends on LWT, read it at SERIAL, not plain QUORUM. Mixing LWT writes with plain reads and expecting linearizability is a subtle, common mistake.

### Q8. What's coming in Cassandra 5.0 for transactions (Accord)?

Cassandra's long-standing gap has been **general, multi-partition transactions**. LWT only does single-partition CAS; logged batches only do atomicity-without-isolation. **Accord (ACC)** is the new transaction protocol (developed for Cassandra, targeting the 5.x line) that aims to close this.

Key ideas:

- **Leaderless / global consensus** — Accord provides strictly serializable, multi-partition, multi-key transactions without a single coordinator/leader bottleneck, and (unlike Paxos-per-key) in a way designed to scale across partitions and datacenters.
- **One-round-trip fast path** in the common case, using synchronized clocks / reordering, rather than Paxos's multiple rounds.
- Exposes real **`BEGIN TRANSACTION ... COMMIT`**-style semantics with reads and conditional writes across partitions.

The significance: it would let Cassandra do things like atomic transfers across partitions with isolation — historically "use a different database" territory. For interviews, knowing Accord exists and *why* (it fixes the no-general-transactions limitation that LWT and batches only partially patch) is a strong currency signal.

### Q9. What's the difference between a logged and an unlogged batch?

| | Logged batch | Unlogged batch |
|---|---|---|
| **Atomicity** | Yes — all statements eventually apply or none | **No** guarantee |
| **Mechanism** | Statements written to the **batchlog** first, then applied | Statements just grouped and sent |
| **Isolation** | No | No |
| **Overhead** | Higher (batchlog write + replication) | Lower (one coordinator hop) |
| **Use** | Keep related tables in sync atomically | Grouping same-partition writes; convenience |

```cql
BEGIN BATCH        -- logged by default
  INSERT INTO users_by_id (id, email) VALUES (?, ?);
  INSERT INTO users_by_email (email, id) VALUES (?, ?);
APPLY BATCH;

BEGIN UNLOGGED BATCH
  ...
APPLY BATCH;
```

A **logged** batch records the statements in a replicated **batchlog** before applying them, so if the coordinator dies mid-batch, another node replays the batchlog and the batch still completes — that's the atomicity guarantee. An **unlogged** batch skips the batchlog: no atomicity, just grouping. Neither gives *isolation* — other readers can see partial results while the batch applies.

### Q10. What exactly does a logged batch guarantee — and not guarantee?

**Guarantees:** **atomicity** — either all statements in the batch eventually apply, or none do. The batchlog ensures a coordinator crash can't leave the batch half-applied forever; another replica replays it.

**Does NOT guarantee:**

- **Isolation.** While the batch is applying, concurrent reads can observe *some* of the statements' effects and not others. There's no snapshot; "atomic" here means eventual all-or-nothing, not "invisible until commit." (A *single-partition* batch is the exception — it's isolated within that partition.)
- **Performance.** The batchlog write + replication is *extra* work versus plain writes.
- **Ordering/serializability** across partitions in any transactional sense.

So a logged batch is the tool for "these few writes must all land or none" — e.g. keeping `users_by_id` and `users_by_email` consistent. It is emphatically *not* a SQL transaction and not a speed optimization.

### Q11. Explain the multi-partition batch anti-pattern.

The classic mistake: using a big **multi-partition** batch to bulk-load or bulk-update for speed, reasoning "one request is faster than many."

Why it backfires: a batch is executed by a **single coordinator**. If the batch touches many partitions spread across the cluster, that one coordinator must fan the writes out to all the owning replicas, wait, and (for logged batches) also write the batchlog. You've turned what could be N independent, parallel writes hitting N coordinators into one overloaded coordinator doing serial fan-out. Result: the coordinator becomes a hotspot, latency rises, and the batch is **slower** than just issuing the writes individually and in parallel.

```cql
-- ANTI-PATTERN: 10k rows across many partitions in one batch
BEGIN BATCH
  INSERT INTO events (...) VALUES (...);   -- partition A
  INSERT INTO events (...) VALUES (...);   -- partition Z
  ... x10000
APPLY BATCH;   -- one coordinator drowns
```

Batches are for **atomicity across a few related statements sharing a partition key**, not throughput. For bulk, use parallel async writes.

### Q12. What is a single-partition batch and why is it the "good" use?

A **single-partition batch** is one where every statement targets the **same partition key**:

```cql
BEGIN BATCH
  INSERT INTO messages_by_conversation (conversation_id, message_id, body) VALUES (?, ?, ?);
  UPDATE messages_by_conversation SET last_message = ? WHERE conversation_id = ? AND message_id = ?;
APPLY BATCH;   -- all same conversation_id
```

It's efficient and safe because all statements go to the **same replicas** (the ones owning that partition). The coordinator does a single, node-local operation rather than cluster-wide fan-out — no coordinator hotspot. And a single-partition batch is applied **atomically and in isolation** for that partition: readers see all of it or none of it.

This is the sweet spot: use single-partition batches to atomically make several changes to the *same* partition (multiple rows/columns of one conversation, one user's several counters, etc.). It's fast *and* gives you the strongest guarantee batches offer.

### Q13. Why do parallel async writes beat batches for bulk loading?

Because they spread the work across the whole cluster instead of funneling it through one coordinator.

- **Batch (bulk):** one coordinator receives all statements and must dispatch to every owning replica, serially coordinating and (if logged) writing the batchlog. One node bottlenecks; throughput is capped by that node.
- **Parallel async writes:** the driver sends many independent writes concurrently, each routed (token-aware) directly to a coordinator that owns the data. Load spreads across all nodes; you saturate the cluster, not one node.

```java
// bulk load: fire N async writes, let the cluster absorb them
List<CompletionStage<AsyncResultSet>> futures = rows.stream()
    .map(r -> session.executeAsync(bound(r)))
    .toList();
// await all
```

So for ingesting lots of data, issue many prepared, token-aware, async writes (with a concurrency limit and backpressure). This is *the* Cassandra bulk pattern, and it's dramatically faster than stuffing rows into big batches.

### Q14. What are the batch size thresholds and why do they exist?

Cassandra actively guards against oversized batches because they cause coordinator memory pressure and instability:

- **`batch_size_warn_threshold_in_kb`** — logs a WARNING when a batch's serialized size exceeds it (default ~5KB historically). A signal you're probably misusing batches.
- **`batch_size_fail_threshold_in_kb`** — **rejects** the batch outright above this size (default ~50KB). A hard stop.

These exist precisely because the multi-partition-bulk-batch anti-pattern is so tempting and so damaging — the thresholds nudge (then force) you away from giant batches that would overload coordinators and risk OOM. There are also warnings for batches spanning too many partitions.

If you're hitting these thresholds, the message isn't "raise the threshold" — it's "you're using batches wrong; split into single-partition batches or parallel async writes."

### Q15. I have a write path that needs some guarantee — should I use an LWT, a batch, or neither? Walk me through deciding.

Diagnose by *what guarantee you actually need*:

- **"Only one client may create/claim X."** → **LWT** (`IF NOT EXISTS` / `IF col = ?`). Uniqueness or optimistic concurrency on a single partition. Accept the ~4× latency; it's rare.
- **"These few related writes must all land or none — and they share a partition."** → **single-partition logged batch.** Atomic, isolated, efficient. (E.g. multiple rows of one conversation.)
- **"Keep denormalized tables in sync (different partitions) atomically."** → **logged batch across those tables**, accepting coordinator overhead and no isolation. Keep it to a handful of statements. (E.g. `users_by_id` + `users_by_email`.)
- **"I need to write a lot of data fast."** → **neither** — parallel async token-aware writes. Batches are the wrong tool; LWT catastrophically so.
- **"I need multi-partition atomic *and* isolated (a real transaction)."** → vanilla Cassandra can't; redesign to a single partition, handle it in the app, or use **Accord** on 5.0.

The meta-point interviewers want: don't reach for LWT/batch reflexively (SQL reflex). Identify the exact guarantee, pick the minimal tool, and prefer *modeling the need away* (single partition, naturally unique keys) over paying for coordination.
## Time-Series & Common Modeling Patterns

### Summary

**What this topic covers**

The patterns that make Cassandra worth choosing in the first place. Cassandra is a **query-first, denormalized, wide-column** store, and a handful of canonical shapes cover the overwhelming majority of real deployments: **time-series / IoT / event ingestion** (its sweet spot), **messaging / chat**, **feeds / timelines**, **leaderboards / counters**, **lookup / secondary-access tables**, and **key-value / cache-like** usage. The 16 questions in this topic drill the mechanics of each — how to lay out the `PRIMARY KEY`, how to bucket time so partitions stay bounded, how TTL and TWCS expire old data cheaply, and how to answer the interview staple "design a schema for [chat / IoT metrics / activity feed / leaderboard]." The through-line: you model **one table per read pattern**, you partition to bound size and spread load, and you cluster to get rows back in the order you'll read them.

**Mental model**

Every Cassandra table is a distributed hash map of **partitions**, and inside each partition is a **sorted list of rows**. So the entire modeling game is two decisions: what makes a partition (the **partition key** → which node), and what orders rows inside it (the **clustering columns** → sort order on disk). For time-series you almost always want `PRIMARY KEY ((entity, time_bucket), ts)` with `CLUSTERING ORDER BY (ts DESC)` — partition by the thing you query (a sensor, a conversation, a user) combined with a time bucket to bound partition growth, then cluster by timestamp descending so the newest data is at the start of the partition and "latest N" is a cheap `LIMIT N`. Writes are append-only inserts, which is exactly what Cassandra's LSM write path is fastest at. You never update or delete rows in the hot path — you let **TTL** expire them and let **TWCS** drop whole expired SSTables. Reads slice a contiguous range of clustering values within a single partition, which is a sequential scan of sorted data — the fastest read Cassandra can do.

**Key terms**

- **Time bucket** — a coarse time component (day/hour/month) folded into the partition key to cap partition size for a high-frequency series.
- **Clustering order** — `WITH CLUSTERING ORDER BY (ts DESC)` sets on-disk row order so newest-first reads need no reversal.
- **TTL** — per-write (or per-column) expiry; the row becomes a tombstone after `USING TTL <seconds>` elapses.
- **TWCS (TimeWindowCompactionStrategy)** — groups SSTables by time window so an expired window is dropped whole, no per-cell tombstone scan.
- **Fan-out-on-write** — write a copy of an event into every consumer's own table/partition at write time (feeds/timelines).
- **Lookup table** — a second denormalized table keyed by an alternate access column (`users_by_email` beside `users_by_id`).
- **Counter table** — a special table type for distributed increment/decrement (`counter` columns).
- **Latest-value pattern** — `LIMIT 1` on a `DESC`-clustered partition to read the most recent row.
- **Wide row / wide partition** — many clustering rows under one partition key; powerful, but bounded (keep ≲100MB / ≲100k rows).
- **Bounded partition** — the design goal: pick partition key + bucket so no partition grows without limit.

**Why interviewers ask this**

This is where Cassandra interviews are won or lost, because modeling is the skill that separates people who've *run* Cassandra from people who've read about it. A junior answer reaches for a `WHERE` clause on an arbitrary column and gets surprised by `ALLOW FILTERING`; a senior answer starts by asking "what are the read patterns?" and builds a table per query, accepting denormalization and double-writes as the price of predictable latency. Interviewers specifically probe **partition sizing** ("what happens when one sensor writes every second for a year?") because unbounded partitions are the single most common production failure. They ask for a **chat or feed schema** because it forces you to demonstrate query-first thinking, clustering order, and fan-out trade-offs in one answer. Getting the bucketing math right — sizing the bucket from write rate × retention to hit the partition target — is the concrete signal that you've operated this at scale.

**Common confusions**

- "Partition by sensor_id" alone — fine until that sensor emits forever; without a time bucket the partition grows unbounded and eventually kills reads and compaction.
- "Cluster ascending and reverse in the query" — a `ORDER BY ts DESC` against `ASC` storage works but reads the whole partition; store in the order you read (`CLUSTERING ORDER BY ts DESC`).
- "Delete old rows on a schedule" — deletes generate tombstones that hurt reads; use TTL + TWCS to drop whole windows instead.
- "Counters are just an int I increment" — counter columns are a distinct, non-idempotent type with real accuracy caveats under retries; don't mix them with normal columns.
- "One big table with a secondary index covers all my queries" — no; you build a second table per access pattern, not an index.
- "Use Cassandra as a work queue" — the queue pattern (write jobs, delete when done) is an anti-pattern: constant deletes = tombstone hell.

**What follows from this topic**

These patterns lean directly on everything the primer builds earlier: partition vs clustering keys, the LSM write path (why append-only is fast), tombstones and `gc_grace_seconds` (why you avoid deletes), and compaction strategy choice (why TWCS fits time-series). They also set up the operational topics — **Cluster Operations** (how these tables get backed up and repaired) and **Performance Tuning & Monitoring** (why a badly-bucketed time-series is the #1 cause of a spiking p99). If you can design a bounded, query-first time-series or feed schema on a whiteboard, you can pass most of a Cassandra data-modeling round.

### Q1. Why is Cassandra considered ideal for time-series and IoT data?

Four properties line up perfectly with time-series workloads:

- **High write throughput** — the LSM write path (commit log append + memtable, flush to immutable SSTable) makes ingesting millions of appends/sec cheap and horizontally scalable. Time-series is write-heavy; Cassandra is write-optimized.
- **Natural time ordering** — clustering columns store rows physically sorted, so `CLUSTERING ORDER BY (ts DESC)` gives you newest-first reads with zero sorting at query time.
- **TTL expiry** — old data ages out automatically per-write; no batch delete job.
- **TWCS** — time-windowed compaction lets whole expired windows be dropped as entire SSTables, so retention costs almost nothing and never triggers a tombstone scan.

Add linear horizontal scaling and multi-DC replication and you have the archetypal metrics/sensor store. This is why Cassandra (and ScyllaDB) underpin so many metrics platforms.

### Q2. Show the canonical time-series schema and explain each part.

```cql
CREATE TABLE sensor_readings (
    sensor_id   text,
    bucket      text,        -- e.g. '2026-07-02' (day bucket)
    ts          timestamp,
    temperature double,
    humidity    double,
    PRIMARY KEY ((sensor_id, bucket), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_unit': 'DAYS',
                    'compaction_window_size': 1};
```

- **Partition key `(sensor_id, bucket)`** — decides which node owns the data. Combining the entity with a time bucket bounds the partition so one sensor doesn't grow forever.
- **Clustering column `ts`, `DESC`** — orders readings within the partition newest-first, so recent-data queries and `LIMIT 1` are cheap.
- **TWCS aligned to the bucket** — each day's data becomes its own compaction window; expiry drops whole SSTables.

A range read is then a slice within one partition:

```cql
SELECT * FROM sensor_readings
WHERE sensor_id = 'sensor-42' AND bucket = '2026-07-02'
  AND ts >= '2026-07-02T00:00:00' AND ts < '2026-07-02T06:00:00';
```

### Q3. How do you pick the time-bucket granularity?

Size it so the partition stays under the target (**≲100MB, ≲100k rows**). Work from **write rate × row size × bucket duration**:

- Estimate rows per bucket = writes/sec × seconds in the bucket.
- Estimate bytes = rows × approximate row size.
- Choose the bucket so both stay comfortably under target.

Worked example: a sensor emitting **1 reading/sec** at ~50 bytes.

- **Day bucket** → 86,400 rows × 50B ≈ 4.3MB. Fine — use day buckets.
- A sensor at **1,000 readings/sec** → day bucket = 86.4M rows (way too big). Drop to an **hour bucket** (3.6M rows, still large) or **minute bucket** depending on row size. For very high frequency, bucket by hour and accept more partitions.

Rule of thumb: pick the coarsest bucket that keeps the busiest series under ~100MB. Coarser = fewer partitions to query across; finer = safer bounding. When in doubt, bucket finer — a too-large partition is far more painful than one extra partition per query.

### Q4. How do TTL and TWCS work together to expire old data cheaply?

**TTL** sets an expiry on each write:

```cql
INSERT INTO sensor_readings (sensor_id, bucket, ts, temperature)
VALUES ('sensor-42', '2026-07-02', '2026-07-02T10:00:00', 21.5)
USING TTL 2592000;  -- 30 days
```

After the TTL elapses the cell becomes a tombstone. On its own, TTL expiry can create huge tombstone counts. **TWCS** is what makes it cheap: it groups SSTables into time windows and, crucially, does **not** compact across windows. When every cell in a window has expired, the entire SSTable is simply **dropped** — no read of the data, no per-cell tombstone processing. So old windows evaporate at near-zero cost.

The rule that makes this work: **set the TTL and the TWCS window consistently, and never mix short-TTL and long-TTL data or issue explicit deletes into a TWCS table** — either breaks the "drop whole window" property and reintroduces tombstone scans.

### Q5. How do you query a time range that spans multiple buckets?

Cassandra can only slice within a single partition, and the bucket is part of the partition key — so a multi-bucket range is resolved **in the application**: enumerate the buckets in the range, then query each (or issue them concurrently) and merge.

```cql
-- app computes buckets: '2026-06-30','2026-07-01','2026-07-02'
SELECT * FROM sensor_readings
WHERE sensor_id = 'sensor-42' AND bucket = '2026-07-01'
  AND ts >= '2026-07-01T00:00:00' AND ts < '2026-07-02T00:00:00';
```

Fire the per-bucket queries in parallel with token-aware routing and stream-merge the results. This is the deliberate trade-off of bucketing: you accept a little app-side fan-out to guarantee bounded partitions. Keep the bucket coarse enough that a typical query touches only a handful of partitions.

### Q6. Design a schema for a chat / messaging application.

Two access patterns dominate: **list a conversation's messages newest-first** and **list a user's conversations**. Build a table per pattern.

```cql
CREATE TABLE messages_by_conversation (
    conversation_id uuid,
    bucket          text,         -- e.g. month '2026-07' for busy chats
    message_ts      timeuuid,
    sender_id       uuid,
    body            text,
    PRIMARY KEY ((conversation_id, bucket), message_ts)
) WITH CLUSTERING ORDER BY (message_ts DESC);

CREATE TABLE conversations_by_user (
    user_id            uuid,
    last_message_ts    timeuuid,
    conversation_id    uuid,
    other_participant  text,
    PRIMARY KEY (user_id, last_message_ts)
) WITH CLUSTERING ORDER BY (last_message_ts DESC);
```

- `messages_by_conversation` clusters by `timeuuid DESC` → newest messages first, `LIMIT 50` for the initial screen, slice older on scroll. Bucket by month (or day for very active groups) to bound the partition.
- `conversations_by_user` gives each user their inbox sorted by recency; you update it (delete+insert on new message) or maintain it via the write path.
- Use **`timeuuid`** for `message_ts` so simultaneous messages don't collide and you keep ordering.

### Q7. Design a schema for an activity feed / timeline.

Choose **fan-out-on-write** for read-heavy feeds. When a user posts, write a copy of the event into each follower's own timeline partition:

```cql
CREATE TABLE user_timeline (
    user_id     uuid,          -- the follower who will read this
    event_ts    timeuuid,
    author_id   uuid,
    post_id     uuid,
    preview     text,
    PRIMARY KEY (user_id, event_ts)
) WITH CLUSTERING ORDER BY (event_ts DESC);
```

Reading a feed is then one partition slice — extremely fast, which is what you want since feeds are read far more than written. The cost is write amplification: a post by someone with N followers means N inserts. That's the classic **fan-out-on-write vs fan-out-on-read** trade-off — write-time fan-out makes reads O(1) but makes celebrity accounts expensive, so many systems use a **hybrid** (fan-out for normal users, fan-out-on-read for high-follower accounts merged at query time). Cassandra's cheap writes make fan-out-on-write the usual default.

### Q8. How do you implement leaderboards and counters, and what are the caveats?

Use a **counter table** for aggregate counts (likes, views, scores):

```cql
CREATE TABLE post_counters (
    post_id uuid PRIMARY KEY,
    likes   counter,
    views   counter
);
UPDATE post_counters SET views = views + 1 WHERE post_id = ?;
```

Caveats — counters are the sharp-edged part of Cassandra:

- **Not idempotent** — a retried increment after a timeout may double-count. Unlike normal writes you can't safely replay them, so a coordinator timeout leaves you genuinely unsure whether it applied.
- **Special table** — counter columns can't coexist with non-counter columns (besides the key), and you can't set an arbitrary value, only inc/dec.
- **More expensive** — counter writes involve a read-before-write internally, so they're slower than plain writes.

For a *ranked* leaderboard (top-N by score), counters don't sort — you maintain a separate table keyed to cluster by score, or offload true ranking to Redis. Use Cassandra counters for approximate/eventually-consistent totals, not for money.

### Q9. What is a lookup / secondary-access table and when do you use one?

When you need to fetch the same entity by two different keys, you build **two denormalized tables**, not a secondary index:

```cql
CREATE TABLE users_by_id    (user_id uuid PRIMARY KEY, email text, name text);
CREATE TABLE users_by_email (email text PRIMARY KEY, user_id uuid, name text);
```

Query by `user_id` hits the first, query by `email` hits the second — each is a fast single-partition read. On write you insert into both (a **logged batch** if you need them to stay in sync). This is the standard denormalized secondary-access pattern and it's preferred over a native secondary index because it guarantees the read is a single-partition lookup instead of a potential cluster-wide scan. Use SAI (5.0) only when you genuinely can't predict the access column ahead of time.

### Q10. How do you model the "latest value" query efficiently?

Cluster the partition by time **descending** and read `LIMIT 1`:

```cql
SELECT * FROM sensor_readings
WHERE sensor_id = 'sensor-42' AND bucket = '2026-07-02'
LIMIT 1;   -- newest row, since ts is CLUSTERING ORDER BY (ts DESC)
```

Because rows are stored newest-first, the latest reading sits at the very start of the partition — the read touches minimal data. If your "latest" query must not know the current bucket, keep a tiny companion table `latest_by_sensor (sensor_id PRIMARY KEY, ts, value)` that you overwrite on each write; a single-row upsert is cheap and gives O(1) "current value" without needing to guess the bucket. Overwriting a single row is fine here — it's one cell, not a tombstone-generating delete.

### Q11. Why should time-series data be append-only, and what happens if you update or delete?

Time-series should be **insert-only**. Updates and deletes both create tombstones (an update that overwrites a cell, and every delete, writes a marker), and tombstones in a time-series table are poison because:

- They accumulate in partitions you scan on every range read, inflating read latency.
- They interact badly with TWCS — a delete forces cross-window work and breaks the "drop whole window" optimization.
- They persist until `gc_grace_seconds` passes AND compaction runs, and can resurrect data ("zombies") if a node missed the delete and isn't repaired in time.

If a reading was wrong, prefer writing a **correction as a new row** (event-sourcing style) and resolving at read time, rather than mutating history. Let TTL + TWCS handle removal of old data. Treating the table as an immutable log is what keeps time-series fast.

### Q12. Design a schema for IoT metrics ingestion at scale.

Requirements: millions of devices, high-frequency readings, range queries per device, automatic retention.

```cql
CREATE TABLE device_metrics (
    device_id  text,
    metric     text,          -- 'cpu','temp','voltage'
    bucket     text,          -- hour bucket for high frequency
    ts         timestamp,
    value      double,
    PRIMARY KEY ((device_id, metric, bucket), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
  AND default_time_to_live = 7776000   -- 90 days
  AND compaction = {'class':'TimeWindowCompactionStrategy',
                    'compaction_window_unit':'HOURS',
                    'compaction_window_size':1};
```

Design decisions:

- **`(device_id, metric, bucket)` partition** — splits per device *and* per metric so a chatty metric doesn't bloat others; the hour bucket bounds high-frequency series.
- **`default_time_to_live`** — table-level retention so every insert expires automatically.
- **TWCS by hour** — expired hours dropped whole.
- **Spread load** — millions of device IDs hash across the ring, so writes are naturally balanced with no hot partition. This is Cassandra operating exactly in its sweet spot: high-cardinality partition key, append-only, bounded partitions, automatic expiry.

### Q13. What are wide-row / wide-partition patterns and their limits?

A **wide partition** stores many clustering rows under one partition key — a single sensor's day of readings, a conversation's messages, a user's timeline. This is Cassandra's superpower: sequential, sorted access to a big contiguous run of related rows in one read. But it has hard limits:

- Keep partitions **≲100MB and ≲~100,000 rows / cells**. Beyond that, compaction, repair, and reads on that partition degrade sharply.
- A single partition lives on its replica set — a giant partition creates a hotspot and can't be spread across the cluster.
- Very wide partitions blow up memory during compaction and slow streaming during node moves.

The fix is always the same: **bucket the partition key** (add a time or hash component) to cap width. Wide rows are good; *unbounded* rows are the classic failure. `nodetool tablehistograms` shows your partition-size distribution — watch the max.

### Q14. Can you do event sourcing on Cassandra? How?

Yes — event sourcing (an append-only log of immutable events, state rebuilt by replay) maps cleanly onto Cassandra because the write model is already append-only.

```cql
CREATE TABLE account_events (
    account_id  uuid,
    event_seq   bigint,
    event_type  text,
    payload     text,       -- serialized event
    created_at  timestamp,
    PRIMARY KEY (account_id, event_seq)
) WITH CLUSTERING ORDER BY (event_seq ASC);
```

Read all events for an aggregate by slicing the partition in order and folding them into current state. Cassandra gives you fast appends and cheap sequential replay; you avoid updates/deletes by construction. Watch two things: **partition growth** (a long-lived aggregate needs bucketing or periodic **snapshotting** — persist a materialized state row so replay starts from the snapshot, not event zero), and **ordering** (use a monotonic `event_seq` or `timeuuid`; wall-clock timestamps can collide/reorder). For cross-aggregate transactional guarantees you'd reach for LWT or 5.0 Accord transactions, but pure per-aggregate event sourcing needs neither.

### Q15. Why is using Cassandra as a work queue an anti-pattern?

The queue pattern — insert jobs, read the oldest, **delete** when processed — is one of the most notorious Cassandra anti-patterns because it maximizes exactly what Cassandra is worst at: **deletes and tombstone scans**.

- Every processed job leaves a **tombstone**. Your "read the next N unprocessed jobs" query slices from the front of the partition — straight through all the tombstones of already-deleted jobs.
- As the queue drains and refills, the read has to skip thousands of tombstones to find live rows, and can hit the tombstone-scan threshold and **fail the query** outright (`TombstoneOverwhelmingException`).
- Tombstones linger until `gc_grace_seconds` + compaction, so the problem persists even when the queue is "empty."

Use a purpose-built queue (Kafka, SQS, RabbitMQ) instead. If you must, mitigate with per-partition time bucketing so drained buckets age out whole via TTL rather than per-row deletes — but the honest interview answer is "don't use Cassandra as a queue."

### Q16. Why is time-series Cassandra's sweet spot — summarize the fit.

Because every characteristic of time-series/event workloads matches a Cassandra strength, point for point:

| Time-series need | Cassandra strength |
|---|---|
| Very high write volume | LSM write path — appends are cheap, scales linearly |
| Newest-first reads | Clustering order `DESC` — sorted on disk, no sort at read |
| Bounded range scans | Single-partition slice on clustering ts |
| Automatic retention | Per-write TTL + `default_time_to_live` |
| Cheap deletion of old data | TWCS drops whole expired windows, no tombstone scan |
| Append-only, no mutation | Avoids tombstones entirely |
| Massive scale, always-on | Masterless, multi-DC, no single point of failure |

Contrast with a relational store: B-tree indexes suffer under sustained high-cardinality inserts, deleting old rows is expensive, and scaling writes means sharding you have to build yourself. Cassandra gives you all of that natively. The one discipline it demands in return is **bounding your partitions** — get the bucketing right and time-series is where Cassandra shines brightest.

## Cluster Operations

### Summary

**What this topic covers**

The day-2 reality of running a Cassandra cluster: the operational toolkit you use after the schema is designed and the app is live. This is the **`nodetool`** world — checking cluster health, adding and removing nodes, replacing dead ones, taking backups, scheduling repairs, and doing rolling restarts and upgrades without downtime. The 16 questions here span the essential `nodetool` subcommands, the full lifecycle of a node (bootstrap → serve → decommission/replace), token allocation with vnodes, snapshot-based backups and PITR, repair scheduling, seed-node design, and the classic operational mistakes (forgetting `cleanup`, making every node a seed, restarting too fast). If the modeling topics are "how do I store data," this topic is "how do I keep the cluster that stores it alive and balanced."

**Mental model**

Cassandra is **masterless**, so operations are inherently node-by-node and stream-based — there is no leader to coordinate a cluster-wide change, so most operations mutate one node at a time while the ring keeps serving. Two mental anchors: (1) **data movement is streaming** — adding, removing, replacing, or repairing a node all boil down to nodes streaming SSTables to each other over the network, and your job is to watch that streaming (`nodetool netstats`) and let it finish before the next step. (2) **the ring owns ranges, not you** — each node owns token ranges (many, via vnodes); when topology changes, ownership shifts and data has to follow. That's why after adding a node you must run `cleanup` on the *old* nodes (they still hold data they no longer own), and why removing a node means its ranges must be re-streamed to new owners first. Almost every ops mistake is a violation of "let the streaming finish, then reconcile ownership."

**Key terms**

- **`nodetool`** — the JMX-backed admin CLI; the primary tool for observing and operating a node.
- **Bootstrap** — a new node joining the ring and streaming its assigned token ranges from existing replicas.
- **`auto_bootstrap`** — the setting (default true) that makes a joining node stream data before serving reads.
- **`cleanup`** — removes data a node no longer owns after ranges moved; run on old nodes after adding a node.
- **`decommission`** — gracefully removes a *live* node, streaming its data to new owners before it leaves.
- **`removenode` / `assassinate`** — remove a *dead* node (rebuild its data elsewhere) / force-remove as a last resort.
- **`replace_address`** — JVM flag to bring up a replacement node that assumes a dead node's identity and streams its data.
- **Vnodes (`num_tokens`)** — many small token ranges per node for even balance and faster streaming.
- **Snapshot** — `nodetool snapshot`: hard-links to immutable SSTables = a cheap point-in-time backup.
- **Seed node** — a well-known node new nodes contact to discover the cluster via gossip; a bootstrap contact point, not a special role.
- **`drain`** — flush memtables and stop accepting writes; run before a restart/upgrade.
- **UN / DN** — `nodetool status` states: Up/Normal vs Down/Normal.

**Why interviewers ask this**

Modeling questions test whether you can *build* on Cassandra; ops questions test whether you can *run* it — and running a masterless distributed database is where the real scars are. Interviewers want to hear that you've added capacity to a live cluster (and remembered `cleanup`), replaced a dead node correctly (`replace_address`, not "just add a new one"), and understand that **repair within `gc_grace_seconds` is not optional**. The signal is operational muscle memory: a junior recites commands; a senior explains the *sequence and the why* — drain before restart, one node at a time, watch netstats, cleanup after, never make all nodes seeds. The "how do you add capacity to a live cluster without downtime" walkthrough is a near-universal senior screen because it exercises bootstrap, streaming, balance, and cleanup in one narrative.

**Common confusions**

- "Adding a node rebalances automatically, I'm done" — the new node streams its data, but old nodes still hold their old copies; you must run `cleanup` to reclaim that space.
- "Just remove the config and restart to drop a node" — use `decommission` (live) or `removenode` (dead); yanking a node loses its only-copy ranges until repair.
- "Make every node a seed for resilience" — seeds don't bootstrap normally and don't stream on join; all-seeds breaks adding capacity. Keep a small fixed set.
- "Snapshots are full backups" — they're hard-links to SSTables on the *same disk*; you must copy them off-node to survive disk loss.
- "Repair is optional if replicas agree" — without repair within `gc_grace_seconds`, deleted data can resurrect (zombies).
- "Restart the whole cluster to apply a change" — do a **rolling** restart, one node at a time, `drain` first.

**What follows from this topic**

Cluster ops sits on top of the architecture fundamentals (token ring, vnodes, replication, gossip, hinted handoff) and feeds directly into **Performance Tuning & Monitoring** — many of the same `nodetool` commands (`tpstats`, `tablehistograms`, `compactionstats`) that you use to operate the cluster are also your diagnostic tools when latency spikes. It also connects back to **anti-entropy / consistency**: repair, hinted handoff, and read repair are the three mechanisms that keep replicas convergent, and you schedule the first of those as a routine operation. Master ops and you can keep a cluster healthy; the next topic is how you make it fast.

### Q1. What is `nodetool` and which subcommands should you know?

`nodetool` is the JMX-backed command-line admin tool that ships with Cassandra; you run it against a single node to observe or operate it. The essentials, grouped:

```bash
# Health & topology
nodetool status            # per-node state (UN/DN), ownership %, load
nodetool info              # this node: heap, uptime, cache, load
nodetool ring              # token ranges around the ring
nodetool gossipinfo        # gossip view of every node

# Diagnostics
nodetool tpstats           # thread-pool stats, dropped messages
nodetool tablestats        # per-table stats (aka cfstats)
nodetool tablehistograms   # latency & partition-size percentiles
nodetool compactionstats   # pending/active compactions
nodetool netstats          # streaming progress (bootstrap/repair)

# Operations
nodetool flush             # memtable -> SSTable
nodetool drain             # flush + stop accepting writes (pre-restart)
nodetool cleanup           # drop data no longer owned
nodetool repair            # anti-entropy repair
nodetool rebuild           # stream data from another DC
nodetool decommission      # gracefully remove this live node
nodetool removenode <id>   # remove a dead node
```

Know `status`, `repair`, `cleanup`, `decommission`, `netstats`, `compactionstats`, and `drain` cold — they cover the vast majority of real operations.

### Q2. How do you read `nodetool status` output?

```
Datacenter: dc1
================
Status=Up/Down |/ State=Normal/Leaving/Joining/Moving
--  Address       Load       Tokens  Owns   Host ID    Rack
UN  10.0.0.1      512.4 GiB  256     33.4%  a1b2...     rack1
UN  10.0.0.2      498.1 GiB  256     33.1%  c3d4...     rack2
DN  10.0.0.3      505.7 GiB  256     33.5%  e5f6...     rack3
```

- **First two chars** = status + state. `UN` = Up/Normal (healthy). `DN` = Down/Normal (node is down). `UJ` = joining (bootstrapping), `UL` = leaving (decommissioning), `UM` = moving.
- **Load** — data on disk for that node. Watch for imbalance.
- **Tokens** — vnode count (256 is a common default; 16 on modern setups).
- **Owns** — fraction of the ring owned. Roughly even is healthy.
- **Rack** — for topology-aware replica placement.

A `DN` node is your first alarm; check gossip and whether hinted handoff is accumulating for it.

### Q3. Walk through adding a node to a live cluster (bootstrapping).

1. **Prep config** — same cluster name, correct `seeds` (existing seeds, not itself), matching `snitch`/topology, `auto_bootstrap: true` (default).
2. **Start the node** — it contacts a seed, learns the ring via gossip, is assigned token ranges (vnodes), and enters **joining** state (`UJ`).
3. **It streams** — the new node pulls its assigned ranges from existing replicas. Watch progress:

```bash
nodetool netstats        # streaming files/bytes remaining
nodetool status          # node shows UJ until done, then UN
```

4. **It goes live** — once streaming completes it flips to `UN` and starts serving reads for its ranges.
5. **Run `cleanup` on the OTHER nodes** — the existing nodes still hold copies of ranges that moved to the new node. Reclaim that space:

```bash
nodetool cleanup         # on each pre-existing node, one at a time
```

6. **Add nodes one at a time** — let each finish bootstrapping before starting the next, so streaming and token allocation stay sane.

Forgetting step 5 is the most common capacity-add mistake — disks stay full even though ownership moved.

### Q4. How do you remove a node — decommission vs removenode vs assassinate?

Depends on whether the node is **alive**:

| Command | Node state | What it does |
|---|---|---|
| `nodetool decommission` | **Live** | Run *on the leaving node*; streams its ranges to new owners, then leaves gracefully. Preferred. |
| `nodetool removenode <host-id>` | **Dead** | Run from another node; rebuilds the dead node's ranges onto their new owners from remaining replicas. |
| `nodetool assassinate <ip>` | **Dead/stuck** | Force-removes from gossip *without* streaming. Last resort — leaves ranges under-replicated until you repair. |

```bash
# graceful, on the node being removed:
nodetool decommission
# dead node, from a healthy node:
nodetool removenode e5f6...
```

Always prefer `decommission` for a planned removal — it guarantees data is re-replicated before the node departs. `removenode` for a node that's already dead. Reach for `assassinate` only when `removenode` is stuck, and follow it immediately with `nodetool repair` to restore replication.

### Q5. How do you replace a dead node?

Use the **`replace_address`** mechanism so the replacement assumes the dead node's token ranges and streams its data, rather than joining as a brand-new node.

1. Confirm the old node is truly dead (`DN` in status) and won't come back.
2. Provision a new machine with identical config (cluster name, seeds, snitch).
3. Add the replace flag to `jvm.options` / `cassandra-env`:

```bash
-Dcassandra.replace_address_first_boot=10.0.0.3   # the dead node's IP
```

4. Start it. It bootstraps into the dead node's ranges, streaming from surviving replicas; watch `nodetool netstats`.
5. Once it's `UN`, remove the replace flag (so a future restart doesn't re-trigger it) and run `nodetool repair` to be safe.

This is correct because it preserves token ownership — the replacement takes over exactly the dead node's ranges. Just adding a fresh node instead would leave the dead node's ranges under-replicated and require a `removenode` afterward.

### Q6. How does token allocation work with vnodes, and how do you keep balance?

Each node owns many small token ranges (**virtual nodes**, `num_tokens` in `cassandra.yaml`) rather than one big range. Benefits: even data distribution, faster streaming (many small ranges stream in parallel from many peers), and smoother rebalancing when nodes join/leave.

Trade-off: too many vnodes (the old default 256) can hurt repair and availability math; modern practice is **fewer vnodes (e.g. 16)** combined with the **allocation algorithm** for balance:

```yaml
num_tokens: 16
allocate_tokens_for_keyspace: my_keyspace   # or allocate_tokens_for_local_replication_factor
```

`allocate_tokens_for_keyspace` tells Cassandra to place a new node's tokens to *minimize imbalance* for that keyspace's replication factor, rather than choosing them randomly. With random token selection and few vnodes you can get significant ownership skew; the allocation algorithm fixes that. Check balance with the `Owns` column in `nodetool status`.

### Q7. How do backups work in Cassandra?

The core primitive is **`nodetool snapshot`**, which creates **hard-links** to the current immutable SSTable files:

```bash
nodetool snapshot -t nightly my_keyspace
```

Because SSTables are immutable and this just hard-links them, a snapshot is **instant and near-zero space** at creation — a true point-in-time image. Key facts:

- **Per-node, coordinate cluster-wide** — a snapshot is local to one node; a consistent cluster backup means snapshotting all nodes at (roughly) the same time.
- **Copy it off-node** — hard-links live on the same disk, so they don't protect against disk/host loss. Ship the snapshot files to object storage/another host.
- **Incremental backups** — enable `incremental_backups` to hard-link each new SSTable as it's flushed, so between snapshots you capture deltas.
- **Restore** — stop the node (or use `sstableloader`), place the snapshot SSTables into the table directory, and restart / reload.
- **Clear old ones** — `nodetool clearsnapshot` reclaims space (snapshots pin SSTables even after compaction would delete them).

### Q8. How do you get point-in-time recovery (PITR)?

Combine snapshots with **commitlog archiving**:

- A **snapshot** gives you a consistent base image at time T.
- **Commitlog archiving** (`commitlog_archiving.properties`) copies each commit log segment off-node as it's written, capturing every mutation after T.
- To restore to a specific point, restore the snapshot, then **replay** the archived commit logs up to your target timestamp.

So the recipe is: regular coordinated snapshots (your restore points) + continuous commitlog archiving (the fine-grained tail) + off-node storage of both. Test the restore — a backup you've never restored is a hypothesis, not a backup. For many teams a nightly coordinated snapshot with off-node copy is enough; PITR with commitlog replay is for stricter RPO requirements.

### Q9. How should repair be scheduled and why is it mandatory?

**Repair** (`nodetool repair`) is anti-entropy: nodes build **Merkle trees** of their data, compare them, and stream the differences so replicas converge. It's mandatory because it's what guarantees deleted data stays deleted:

- Every replica must run repair **within `gc_grace_seconds`** (default 10 days). If a replica missed a delete and isn't repaired before the tombstone is garbage-collected, the old data **resurrects** ("zombie data").
- It also heals divergence from dropped writes, down nodes, and consistency levels below QUORUM.

Don't run naive full repairs by hand cluster-wide — they're heavy and error-prone. Use **Cassandra Reaper** (or your platform's scheduler) to run **incremental/subrange repairs** continuously and evenly, completing a full cycle for every table comfortably inside `gc_grace_seconds`. The operational rule: repair cadence < `gc_grace_seconds`, always.

### Q10. How do you do a rolling restart or upgrade without downtime?

Because Cassandra is masterless with RF > 1, you can take **one node at a time** offline and the cluster keeps serving. Per node:

1. `nodetool drain` — flush memtables and stop accepting writes so the restart is clean (no commitlog replay on startup).
2. Stop the node, apply the change (config edit / new binary).
3. Start it, wait for `UN` in `nodetool status` and for gossip to settle, and let hinted handoff/read repair catch it up.
4. Only then move to the next node.

For a **major version upgrade**, additionally:

- Check **version compatibility** — you can run a mixed-version cluster briefly, but don't `nodetool repair`, add/remove nodes, or change schema during the upgrade window.
- After all nodes are on the new major, run **`nodetool upgradesstables`** on each to rewrite SSTables into the new format.

Never restart faster than nodes can rejoin and stabilize — going too fast can drop below your consistency level's required replicas.

### Q11. What happens when a node goes down, and how does it catch up on return?

While a replica is down, the cluster stays available (assuming RF > 1 and your CL can be met by the remaining replicas). Two mechanisms cover the gap:

- **Hinted handoff** — the coordinator stores "hints" (the missed writes) for the down node, up to `max_hint_window_in_ms` (default 3 hours). When the node returns, coordinators replay the hints to it.
- **Read repair** — reads that touch the recovered node detect and fix stale values inline.

But hints only cover the hint window, and read repair only fixes data that gets read. So the durable fix is: **when a node returns after any meaningful downtime, run `nodetool repair`** to guarantee it's fully converged. If it was down longer than `gc_grace_seconds`, you must repair before it can safely serve — otherwise it may reintroduce deleted data. In `nodetool status` a returning node goes `DN` → `UN`; watch hint delivery and follow with repair.

### Q12. How do you manage disk space and add capacity?

Cassandra scales **out, not up** — you add nodes rather than growing disks, because more nodes also add throughput and spread partitions.

- **Leave compaction headroom** — STCS can transiently need up to ~50% free space to compact; running disks near full is dangerous (compaction stalls, then reads slow as SSTable counts climb). Keep meaningful free space, more with STCS.
- **Reclaim after topology changes** — `nodetool cleanup` after adding nodes; `nodetool clearsnapshot` to drop old snapshots pinning SSTables.
- **Watch the growth signals** — rising `Load` in `nodetool status`, pending compactions in `compactionstats`, SSTable count per table.
- **Add capacity by bootstrapping new nodes** (Q3), then `cleanup` the old ones so freed ranges actually release disk.

The failure mode to avoid: waiting until disks are 90% full — at that point compaction can't run, which makes disk usage *worse* and tanks read latency. Add capacity proactively.

### Q13. What are seed nodes and how should you configure them?

A **seed** is a node whose address new nodes are told to contact first, so they can discover the rest of the cluster via **gossip**. Critical nuances:

- A seed is **not** a special data role — it owns data like any node and isn't a master. It's purely a **bootstrap contact point**.
- **Seeds don't auto-bootstrap by streaming** on join, so **never add a new node to the cluster as a seed** — it would come up without streaming its data and serve incomplete results. Bootstrap it as a non-seed, then optionally promote it.
- Keep a **small, fixed set** (e.g. 2–3 per DC), spread across racks/DCs for resilience. **Don't make every node a seed** — that breaks the ability to add capacity and provides no benefit.
- List the same seeds in every node's `cassandra.yaml`.

The classic mistake — "all nodes are seeds for maximum resilience" — actively harms the cluster.

### Q14. What are the cassandra.yaml essentials an operator should know?

The config knobs you'll actually touch:

- **`cluster_name`** — must match across all nodes; a mismatch prevents joining.
- **`seeds`** (in `seed_provider`) — the bootstrap contact points; small fixed set.
- **`listen_address` / `rpc_address` / `broadcast_address`** — networking; get these right for multi-host/multi-DC.
- **`endpoint_snitch`** — topology awareness (`GossipingPropertyFileSnitch` is the common choice); drives rack/DC-aware replica placement.
- **`num_tokens`** (+ `allocate_tokens_for_keyspace`) — vnode count and balance.
- **`data_file_directories`, `commitlog_directory`** — ideally on separate disks (commitlog is sequential-write heavy).
- **`concurrent_compactors`, `compaction_throughput_mb_per_sec`** — compaction tuning.
- **`hinted_handoff_enabled`, `max_hint_window_in_ms`** — down-node handling.

Changes to most of these require a **rolling restart** to take effect. Keep configs identical across the cluster except for host-specific addresses.

### Q15. What are the most common cluster-operations mistakes?

The recurring ones that cause real incidents:

- **Forgetting `cleanup` after adding nodes** — old nodes keep data they no longer own; disks stay full and you think the add didn't help.
- **Not running repair within `gc_grace_seconds`** — deleted data resurrects (zombies); the #1 consistency-ops failure.
- **Making every node a seed** — breaks bootstrapping new capacity.
- **Restarting nodes too fast** — going to the next before the previous rejoins can drop below the required replica count and cause errors/unavailability.
- **Skipping `drain` before restart** — leads to long commitlog replay and, during upgrades, risks a messy startup.
- **Treating snapshots as backups** without copying them off-node — a disk loss takes the "backup" with it.
- **Replacing a dead node as a fresh node** instead of using `replace_address` — leaves ranges under-replicated.

Every one of these is avoidable with the "one node at a time, let streaming finish, then reconcile ownership, then repair" discipline.

### Q16. Walk me through adding capacity to a live cluster without downtime.

The end-to-end senior answer:

1. **Decide scale-out** — you're low on disk headroom or throughput; add nodes, don't grow disks.
2. **Provision** new nodes with identical config: matching `cluster_name`, existing `seeds` (new nodes are **not** seeds), correct snitch/rack, `auto_bootstrap: true`, and `num_tokens` + `allocate_tokens_for_keyspace` for balance.
3. **Bootstrap one node** — start it; it joins (`UJ`), gets token ranges, and streams its data from existing replicas. Watch `nodetool netstats` and `nodetool status` until it's `UN`.
4. **Repeat one at a time** — never bootstrap two nodes simultaneously; let each finish so token allocation and streaming stay correct.
5. **`cleanup` the pre-existing nodes** — run `nodetool cleanup` on each old node (one at a time, off-peak) to drop ranges that moved to the new nodes and actually reclaim disk.
6. **Verify balance** — `nodetool status` should show roughly even `Owns` and `Load`.
7. **Repair if needed** — a routine repair afterward ensures full convergence.

Throughout, the cluster keeps serving because it's masterless and RF > 1 — no downtime, streaming just happens in the background. The two things that make it correct: adding nodes serially, and remembering `cleanup`.

## Performance Tuning & Monitoring

### Summary

**What this topic covers**

How to make a Cassandra cluster fast and how to prove it's fast — the levers and the instruments. The 15 questions here cover **JVM and GC tuning** (Cassandra runs on the JVM, so heap sizing and GC pauses directly shape tail latency), the **key metrics** that matter (latency percentiles p50/p95/p99/p999, throughput, pending compactions, dropped mutations, SSTables-per-read, tombstones-scanned-per-read, cache hit rates), the **monitoring stack** (JMX → Prometheus + Grafana), the split between **read tuning and write tuning** (writes are cheap; reads are where the pain lives), **compaction tuning**, **caches**, **consistency level as a latency lever**, request tracing, and driver-side tuning. The centerpiece is the diagnostic flow: "reads are slow — walk me through finding out why," where the usual suspects are GC, wide partitions, tombstones, too many SSTables, and compaction backlog.

**Mental model**

Cassandra performance is a **tail-latency** problem, not an average problem — a p50 of 2ms with a p99 of 800ms means 1% of your users are having a terrible time, and that 1% is what pages you. So you think in **percentiles**, and you reason about what makes the tail spike: a **GC pause** freezes a node for hundreds of ms and can make it drop messages or flap; a **wide partition** turns one read into a massive scan; **tombstones** force a read to wade through deleted data; **too many SSTables per read** (compaction falling behind) multiplies disk seeks. Writes are almost never the bottleneck — the LSM path is fast by design — so when latency is bad, you look at the **read path** and at **GC**. And you don't guess: you read the metrics. `nodetool tablehistograms` tells you SSTables-per-read and partition size; `tpstats` tells you dropped mutations and blocked pools; tracing tells you where a specific query spends its time. Measure, find the bottleneck (CPU vs disk IO vs GC vs network vs a hot partition), then pull the right lever.

**Key terms**

- **Latency percentiles (p50/p95/p99/p999)** — the distribution of request latency; p99/p999 (tail) is what matters most.
- **GC pause** — a stop-the-world garbage collection freeze; long pauses cause timeouts, dropped messages, and node flapping.
- **G1GC** — the default modern collector for Cassandra; targets predictable pause times (vs the older CMS).
- **Dropped mutations** — writes a node dropped because it was overloaded (visible in `tpstats`); a red flag.
- **SSTables per read** — how many SSTables a read must merge; high values mean compaction is behind or the strategy is wrong.
- **Tombstones scanned per read** — deleted markers a read wades through; high values tank read latency.
- **Key cache / row cache / chunk cache** — key cache (good, caches partition-key→offset), row cache (dangerous), chunk cache (compressed-block cache).
- **Page cache** — the OS filesystem cache Cassandra relies on heavily; leave RAM for it.
- **`tpstats` / `tablehistograms` / `proxyhistograms`** — the core `nodetool` diagnostics.
- **Speculative retry** — the coordinator re-sends a read to another replica if the first is slow, trimming the tail.
- **Token-aware routing** — the driver sends a request straight to a replica for the key, avoiding an extra hop.

**Why interviewers ask this**

Tuning questions are the deepest senior signal in a Cassandra interview because they require you to connect the architecture (LSM, compaction, tombstones, GC, the read path) to *observable symptoms* and *specific fixes*. Anyone can say "Cassandra is fast"; a senior engineer can be told "our p99 read latency just doubled" and produce a structured diagnosis — check GC logs, check `tablehistograms` for SSTables-per-read and partition size, check `tpstats` for dropped mutations and compaction backlog, check for a hot partition or a tombstone-heavy table. Interviewers also probe whether you understand the **write-cheap / read-expensive asymmetry** (candidates who try to "tune writes" reveal they don't get the LSM model) and whether you know the dangerous knobs (row cache, oversized heap). The "walk me through diagnosing slow reads" question is the canonical closer.

**Common confusions**

- "Bigger heap = better" — oversizing the heap lengthens GC pauses and steals RAM from the OS page cache that Cassandra depends on; ~8–16GB with G1GC is the norm.
- "Enable row cache for speed" — row cache is usually a trap: it caches whole partitions, is easily invalidated, and wastes heap; key cache + OS page cache is the right default.
- "High p99 means I need more nodes" — often it's a hot partition, tombstones, or compaction backlog on existing nodes; adding nodes won't fix a modeling problem.
- "Tune the write path" — writes are already cheap; latency problems are almost always reads or GC.
- "p50 looks fine, we're good" — p50 hides the tail; a healthy p50 with an ugly p99 is a real, page-worthy problem.
- "Dropped mutations are network blips" — they mean a node was overloaded and silently lost writes, creating inconsistency; investigate, don't ignore.

**What follows from this topic**

Performance tuning is where every other topic in the primer comes home to roost. Bad **data modeling** (unbounded partitions, tombstone-generating deletes, the queue anti-pattern from the time-series topic) shows up here as a spiking p99. **Compaction strategy** choice determines SSTables-per-read. **Consistency level** is both a correctness knob and a latency knob. **Cluster operations** (GC-induced flapping, dropped mutations, compaction backlog) surface in the same `nodetool` output you use to run the cluster. And the monitoring stack (JMX → Prometheus + Grafana) is the same observability discipline used across the rest of your platform. If you can diagnose a latency spike end to end, you understand Cassandra.

### Q1. Why does JVM garbage collection matter so much for Cassandra latency?

Cassandra runs on the JVM, so a **stop-the-world GC pause freezes the entire node** — no reads served, no writes accepted — for the duration of the pause. That connects directly to tail latency and stability:

- A multi-hundred-ms GC pause shows up as a p99/p999 spike for every request that node was handling.
- Worse, a long pause makes the node miss **gossip** heartbeats, so peers mark it **down** — it "flaps" (down, then up) even though the process never died. Flapping triggers hinted handoff and unnecessary streaming.
- During the pause the node also **drops mutations** it can't process in time, creating inconsistency.

So GC tuning isn't micro-optimization — it's the difference between a stable cluster and one that periodically stutters. The goal is many short, predictable pauses rather than occasional long ones, which is exactly what G1GC targets.

### Q2. How do you size the heap and choose a garbage collector?

**Don't oversize the heap.** Counterintuitively, a bigger heap makes GC pauses *longer* (more to scan) and steals RAM from the **OS page cache** that Cassandra relies on for fast reads. Guidance:

- **Heap ~8–16GB** with **G1GC** (the modern default). G1 targets a configurable pause goal and handles larger heaps far better than the old **CMS** collector, which suffered fragmentation and long full-GC stalls.
- Leave the **majority of system RAM to the OS page cache** — Cassandra reads SSTables through the filesystem, so page cache is effectively your read cache.
- Much of Cassandra's memory is **off-heap** anyway — bloom filters, memtable buffers, compression metadata — deliberately kept out of the heap to reduce GC pressure.

For very large machines with modern JDKs, ZGC or Shenandoah (low-pause collectors) can be worth testing, but the safe, standard answer is **G1GC with a right-sized 8–16GB heap and lots of RAM left for the OS**.

### Q3. What are the key metrics you monitor on a Cassandra cluster?

Watch these, ideally as dashboards:

- **Read/write latency percentiles** — p50, p95, **p99, p999** per table. The tail is the point.
- **Throughput** — ops/sec (reads and writes) per node and cluster-wide.
- **Pending compactions** — from `compactionstats`; a rising backlog inflates SSTables-per-read.
- **Pending / blocked thread-pool tasks and dropped messages** — from `tpstats`; dropped mutations = overload.
- **SSTables per read** and **tombstones scanned per read** — from `tablehistograms`; the direct read-latency drivers.
- **Hint counts** — accumulating hints mean a replica is down or overloaded.
- **Cache hit rates** — key cache especially.
- **Heap usage & GC pause time / frequency** — the stability signal.
- **Disk usage & IO** — headroom for compaction; IO saturation.

The tightest early-warning set: **p99 latency, pending compactions, dropped mutations, and GC pause time**.

### Q4. What does the Cassandra monitoring stack look like?

Cassandra exposes metrics over **JMX**, and the standard pattern is to scrape and visualize them:

- **JMX → Prometheus** via an exporter (the **Metrics Collector for Apache Cassandra (MCAC)**, or the JMX exporter/`cassandra-exporter`) turns JMX MBeans into Prometheus metrics.
- **Prometheus** stores the time-series; **Grafana** dashboards visualize latency percentiles, compaction backlog, GC, dropped mutations, etc.
- **Alerting** via Prometheus Alertmanager on the early-warning set (p99, pending compactions, dropped mutations, node down).
- Commercial/turnkey options: **DataStax OpsCenter** (for DSE) and managed metrics in **Astra**.

This ties into the broader observability primer — Cassandra is just another Prometheus target, and the discipline (RED-style metrics, percentile dashboards, alert on the tail) is the same as any other service. For ad-hoc, on-the-box investigation you drop to `nodetool` (`tablehistograms`, `tpstats`, `proxyhistograms`).

### Q5. Why do you tune reads, not writes?

Because **writes are cheap by construction** and reads aren't. A write is a commit-log append plus a memtable insert (both in-memory-fast, sequential IO) — no read of existing data, no seeks. The LSM design makes writes so cheap that they're almost never your bottleneck.

Reads are the hard path: a read may need to check the memtable **and merge multiple SSTables**, consult bloom filters and partition indexes, wade through **tombstones**, and hit disk. All the things that go wrong — wide partitions, tombstone buildup, too many SSTables from compaction backlog, cold caches — hit reads. So when someone says "Cassandra is slow," the answer is almost always about the read path or GC. The corollary: your **data model** (which determines partition size, tombstone load, and SSTables touched) is the single biggest lever on read performance — tuning starts there, not in config.

### Q6. How do you tune compaction for performance?

Compaction merges SSTables in the background; tune it so it keeps up **without starving live queries**:

- **Throughput throttle** — `compaction_throughput_mb_per_sec` caps compaction IO so it doesn't saturate disk and slow reads. Too low → backlog grows and SSTables-per-read climbs; too high → compaction steals IO from queries. Tune to keep pending compactions near zero without hurting p99.
- **`concurrent_compactors`** — how many compactions run at once; size to available CPU/IO so a backlog can be worked off.
- **Right strategy for the workload** — LCS for read-heavy (fewer SSTables per read, at higher write amplification), STCS for write-heavy, **TWCS** for time-series, UCS (5.0) as a unified option.
- **Watch pending compactions and SSTable count** — a persistent backlog is the warning sign; a read touching many SSTables means compaction isn't keeping up or the strategy is wrong.

The balance: enough compaction resources to keep SSTable counts low, throttled enough that it never starves the query path.

### Q7. Which caches help and which hurt?

| Cache | Verdict | Why |
|---|---|---|
| **Key cache** | Good, keep on | Caches partition-key → SSTable offset; small, high value, saves an index lookup. |
| **Row cache** | Usually harmful | Caches whole partitions on-heap; easily invalidated by any write to the partition, wastes heap, and pushes GC pressure. Only ever for tiny, read-only, hot partitions. |
| **Chunk cache** | Useful | Caches decompressed SSTable chunks; helps read-heavy workloads. |
| **OS page cache** | Critical — rely on it | The real read cache; Cassandra reads SSTables through the filesystem, so free RAM = fast reads. |

The headline rule: **key cache yes, row cache almost never, and leave most RAM to the OS page cache.** The most common cache mistake is enabling row cache expecting a speedup and getting GC pressure and invalidation churn instead. Let the OS do the caching it's good at.

### Q8. How is consistency level a performance lever?

The **consistency level (CL)** you choose per query trades latency and availability against strength:

- **ONE / LOCAL_ONE** — the coordinator waits for a single (local-DC) replica. Fastest and most available; weakest consistency.
- **LOCAL_QUORUM** — majority of replicas in the local DC; the common production sweet spot — strong-enough consistency without cross-DC latency.
- **QUORUM / ALL** — more replicas (QUORUM across all DCs, ALL = every replica). Stronger, but slower and less available; ALL means one down replica fails the request.

Latency scales with how many replicas the coordinator must wait for, and QUORUM/ALL can incur cross-DC round trips. So CL is a real latency knob: read at `LOCAL_ONE` when you can tolerate staleness (e.g. a cache-like lookup), read/write at `LOCAL_QUORUM` when you need strong consistency (`R + W > RF`). Don't reach for `ALL` — it trades away Cassandra's availability for marginal benefit and spikes the tail.

### Q9. How do you use request tracing to find where time goes?

Cassandra can trace a query's execution across the coordinator and replicas, showing each step and its timing:

```cql
TRACING ON;
SELECT * FROM sensor_readings WHERE sensor_id='sensor-42' AND bucket='2026-07-02';
-- output: coordinator -> replicas, each stage with microsecond timings,
--         SSTables read, tombstones scanned, merge steps
TRACING OFF;
```

The trace reveals the real culprit: many SSTables merged (compaction behind), lots of tombstones scanned (delete-heavy table), a slow replica, or cross-node latency. For production you don't trace every query — enable **probabilistic tracing** to sample a small fraction:

```bash
nodetool settraceprobability 0.001   # trace 0.1% of queries
```

Traces then land in the `system_traces` keyspace for analysis. Tracing is the tool that turns "reads are slow" into "this query scans 40,000 tombstones" — it localizes the cost.

### Q10. What is speculative retry and how does it help the tail?

**Speculative retry** trims tail latency by not letting one slow replica dominate a read. Normally the coordinator sends the read to the required replicas and waits. With speculative retry, if a replica hasn't responded within a threshold (e.g. the 99th-percentile latency), the coordinator **sends the read to an additional replica** and returns whichever answers first.

```cql
ALTER TABLE sensor_readings WITH speculative_retry = '99PERCENTILE';
```

This directly attacks p99/p999 caused by a single momentarily-slow node (a GC pause, a compaction spike, a disk hiccup) — instead of waiting out the straggler, you route around it. The cost is a bit more read load (extra requests), so you set the threshold to fire only for genuine outliers (`99PERCENTILE`), not on every read. It's one of the cheapest wins for tail latency.

### Q11. What driver-side tuning matters?

The client driver has real leverage on latency:

- **Token-aware routing** — the driver hashes the partition key and sends the request **directly to a replica** that owns it, saving a coordinator-to-replica hop. This is a default in modern drivers; make sure it's on and paired with a topology-aware load-balancing policy (prefer local DC).
- **Prepared statements** — prepare once, execute many; the server caches the query plan and you send only the bound values. Faster and safer than re-parsing string queries.
- **Connection pooling** — right-size connections/requests-per-connection so you're not starved or oversubscribed.
- **Async / batching of independent queries** — fire concurrent requests (e.g. the per-bucket time-series fan-out) rather than serializing them.
- **Appropriate consistency level per query** (Q8).

Token-aware routing plus prepared statements are the two that matter most — together they remove an extra network hop and repeated query parsing from every request.

### Q12. What are dropped mutations and what do they mean?

A **dropped mutation** is a write that a node received but **discarded because it was overloaded** — the request sat in a queue longer than its timeout, so the node drops it rather than fall further behind. You see them in `nodetool tpstats`:

```bash
nodetool tpstats
# ...
# Message type   Dropped
# MUTATION       1423
# READ           12
```

They matter because:

- **They signal overload** — the node can't keep up with write pressure (often due to compaction backlog stealing IO, GC pauses, or undersized hardware).
- **They cause inconsistency** — a dropped mutation means that replica missed the write, so replicas diverge until **repair** (or read repair / hinted handoff) fixes it.

Non-zero dropped mutations is an alert-worthy condition: investigate compaction backlog, GC, and IO saturation on that node, and don't rely on the write actually having RF copies until repair runs.

### Q13. Walk through diagnosing slow reads (high p99).

A structured flow, cheapest checks first:

1. **Scope it** — is it one table, one node, or cluster-wide? Check Grafana p99 per table/node. One node → suspect that node's GC/IO/hardware; one table → suspect its data model.
2. **Check GC** — GC logs / metrics for long pauses correlating with the spikes. Long pauses → heap/GC tuning or memory pressure (Q1/Q2).
3. **Check `tablehistograms`** for the slow table:

```bash
nodetool tablehistograms my_keyspace my_table
# look at: SSTables per read, partition size (max!), cell count, latency
```

- **High SSTables per read** → compaction behind (check `compactionstats`) or wrong strategy.
- **Huge max partition size** → a **wide/hot partition** (a modeling bug — needs bucketing).

4. **Check tombstones** — tracing or table metrics for tombstones-scanned-per-read. High → delete-heavy table or the queue anti-pattern; fix the model, tune `gc_grace`, or switch off deletes.
5. **Check `tpstats`** — dropped mutations / blocked pools → overload.
6. **Trace a slow query** (`TRACING ON`) to localize the exact cost.

Order of likelihood: **GC pause, wide partition, tombstones, too many SSTables (compaction backlog), then a slow/overloaded node.**

### Q14. What are the common causes of a high p99, ranked?

The usual suspects, roughly in order of how often they're the culprit:

1. **GC pauses** — a stop-the-world freeze spikes every in-flight request; often from an oversized heap or memory pressure.
2. **Wide / hot partitions** — a single unbounded partition turns a read into a giant scan and concentrates load on one replica set. A modeling bug.
3. **Tombstones** — delete-heavy tables (or the queue anti-pattern) make reads wade through deleted data; can even fail with `TombstoneOverwhelmingException`.
4. **Too many SSTables per read** — compaction backlog or wrong compaction strategy multiplies disk seeks per read.
5. **Compaction backlog itself** — pending compactions stealing IO and inflating SSTable counts.
6. **Overloaded node / IO saturation** — dropped mutations, blocked thread pools, disk at 100%.
7. **Cross-DC or high CL** — waiting on distant replicas (`QUORUM`/`ALL`) adds round trips.

Notice most of these trace back to **data modeling** (partitions, tombstones) or **GC** — which is why "add more nodes" is so often the wrong first reflex.

### Q15. How do you identify the actual bottleneck — CPU vs disk vs GC vs network vs hot partition?

Match the symptom to the resource, using both OS tools and `nodetool`:

- **GC** — GC logs / metrics show long or frequent pauses; latency spikes correlate with pauses; node flapping in `nodetool status`. Fix: heap/GC tuning, reduce memory pressure.
- **Disk IO** — `iostat` shows high utilization/await; high SSTables-per-read; compaction backlog in `compactionstats`. Fix: compaction tuning, faster disks, or a data model that reads fewer SSTables.
- **CPU** — high load average with healthy IO; often compaction-heavy or lots of small queries. Fix: `concurrent_compactors`, query patterns, scale out.
- **Network** — cross-DC latency in traces; `nodetool netstats` streaming saturating links. Fix: topology, CL choice, throttle streaming.
- **Hot partition** — one partition/replica set far hotter than others; `nodetool tablehistograms` shows a huge max partition; uneven `Load`/latency per node. Fix: repartition/bucket the key — a modeling change, not a config one.

The method is always the same: **measure first** (Grafana + `nodetool` + OS tools), localize the constrained resource, then apply the matching lever. Guessing and adding nodes without measuring is the anti-pattern — it doesn't fix GC, tombstones, or a hot partition.
## Multi-DC, Availability & Failure Handling

### Summary

**What this topic covers**

This is the topic where Cassandra earns its reputation. The pitch — "always-on, geo-distributed, no single point of failure" — is not marketing gloss; it is the direct consequence of a masterless, peer-to-peer design plus per-datacenter replication. The 16 questions here cover how Cassandra runs across multiple datacenters and regions: **NetworkTopologyStrategy** placing a full replica set in every DC, **LOCAL_QUORUM** as the everyday consistency workhorse, how writes propagate to remote DCs, how the ring survives a node / rack / DC failure, how gossip and the phi-accrual failure detector notice a dead node, the availability math per replication factor and consistency level, and how you design a deployment that survives an availability-zone or whole-region outage. If Data Modeling is where you win points for cleverness, this is where you win points for having actually operated a cluster.

**Mental model**

Picture two datacenters, `dc1` and `dc2`, each holding a **complete** copy of the keyspace at RF 3. That is the whole trick: DCs are not shards of each other, they are full mirrors kept in sync asynchronously. A client in region 1 talks to `dc1` at **LOCAL_QUORUM** — it needs 2 of the 3 local replicas to ack, and it never waits on the cross-Atlantic hop to `dc2`. The coordinator still forwards the write to `dc2` (one forwarder node per remote DC fans it out to the local replicas there), but that propagation is asynchronous and off the client's critical path. Availability falls out of this naturally: lose a node, the other two local replicas satisfy LOCAL_QUORUM; lose a rack, replicas on other racks cover it; lose an entire DC, the surviving DC keeps serving its own clients with zero coordination from the dead one. There is no leader to elect, no failover event, no split brain — just a ring that keeps answering.

**Key terms**

- **NetworkTopologyStrategy (NTS)** — replication strategy that takes RF *per datacenter*, e.g. `{dc1: 3, dc2: 3}`; the production default. SimpleStrategy is single-DC / dev only.
- **LOCAL_QUORUM** — quorum of replicas *within the coordinator's own DC*; strong local consistency without cross-DC latency.
- **EACH_QUORUM** — requires a quorum in *every* DC (writes only); strongest cross-DC guarantee, but pays every DC's latency.
- **Snitch** — component that tells Cassandra which DC and rack each node is in, so NTS can place replicas correctly (`GossipingPropertyFileSnitch` is the standard).
- **Rack awareness** — NTS spreads a partition's replicas across different racks/AZs so one rack failure never removes a full replica set.
- **Gossip** — peer-to-peer protocol nodes use to exchange membership and state a few times a second.
- **Phi-accrual failure detector** — the adaptive algorithm that decides a node is DOWN based on missed heartbeats rather than a fixed timeout.
- **Hinted handoff** — a coordinator stores a "hint" for a temporarily-down replica and replays it when the node returns.
- **Seed node** — a well-known node a booting node contacts to join the gossip cluster; not a master.
- **No single point of failure (SPOF)** — every node is a peer; there is no master whose death stops the cluster.
- **Live-live / active-active** — every DC takes reads and writes simultaneously, not a hot/standby pair.
- **Datacenter rebuild** — `nodetool rebuild` streams a full copy into a newly-added DC from an existing one.

**Why interviewers ask this**

Multi-DC is the fastest way to separate someone who has *read about* Cassandra from someone who has *run* it. A junior candidate says "Cassandra is highly available" and stops. A senior candidate explains *why*: masterless means no failover, NTS means full copies per region, and LOCAL_QUORUM means you get strong consistency without paying the WAN. They can do the availability arithmetic (RF 3 + QUORUM tolerates one failure; RF 5 tolerates two), they know the difference between LOCAL_QUORUM and EACH_QUORUM and when each is worth it, and they can sketch a deployment that survives an AZ or region loss. Interviewers also probe the failure story — what actually happens when a node, a rack, or a whole DC goes down — because that is where design decisions meet operational reality. If you can narrate a region outage calmly, you signal you have been on call for one.

**Common confusions**

- "Each DC holds part of the data" — no. With NTS, each DC holds a *complete* replica set. DCs mirror; they don't shard across each other.
- "LOCAL_QUORUM is weaker than QUORUM" — it's a different scope, not a weaker guarantee. LOCAL_QUORUM is strongly consistent *within its DC*; plain QUORUM may pull replicas across DCs and eat WAN latency.
- "A DC failure requires a failover / promotion" — there is nothing to promote. The surviving DC was already serving live traffic; you just lose the dead DC's capacity.
- "Cassandra can suffer split brain" — it can't in the Postgres sense. There is no single authority to split. Conflicting writes are resolved by last-write-wins timestamps and reconciled by read repair / anti-entropy repair.
- "Seed nodes are masters" — they're only gossip bootstrap contacts. Losing all seeds doesn't stop a running cluster; it only blocks *new* nodes from discovering it.
- "Adding a DC just needs a keyspace ALTER" — you also have to `nodetool rebuild` to stream existing data into the new DC, or it starts empty.

**What follows from this topic**

Everything here rests on the ring, consistent hashing, and RF from the Architecture topic, and on the tunable-consistency (R + W > RF) rules from the Consistency topic — LOCAL_QUORUM is just QUORUM scoped to one DC. The failure-handling machinery (hinted handoff, read repair, `nodetool repair`, gc_grace) connects to the Anti-Entropy / Repair topic. And the multi-DC posture feeds directly into the Ecosystem topic's DynamoDB comparison (global tables vs NTS) and the Scenario topic's "design for surviving a region failure" and "cross-region writes are slow" playbooks.

### Q1. Why is Cassandra considered strong for multi-datacenter and geo-distributed deployments?

Because multi-DC isn't bolted on — it falls straight out of the masterless design. There is no leader that has to live in one region, so no region is "primary". Every datacenter runs a full, independent replica set and serves its own local reads and writes.

Four things make it work:

- **Per-DC replication** via NetworkTopologyStrategy — you declare RF *per DC*, so each region has complete copies.
- **DC-local consistency** via LOCAL_QUORUM — clients get strong consistency talking only to their nearest DC, never waiting on the WAN.
- **Async cross-DC propagation** — writes replicate to remote DCs in the background, off the client's critical path.
- **No failover event** — lose a region and the survivors were already live; there's nothing to promote.

Typical uses: geo-locality (serve users from their nearest region), disaster recovery, live-live active-active, and workload isolation (a dedicated analytics DC that never touches OLTP latency).

### Q2. How do you configure multi-DC replication?

Use NetworkTopologyStrategy with a replication factor per datacenter:

```cql
CREATE KEYSPACE acme
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3,
  'dc2': 3
};
```

Every DC named here gets its own full set of replicas — `{dc1: 3, dc2: 3}` means 6 copies total, 3 in each region, not 3 split across regions. You can also run asymmetric RF, e.g. `{dc1: 3, analytics: 1}` for a lightweight analytics mirror.

Two prerequisites:

- A topology-aware **snitch** (`GossipingPropertyFileSnitch`) so Cassandra knows each node's DC and rack.
- Correct `cassandra-rackdc.properties` on every node declaring its `dc=` and `rack=`.

Never use SimpleStrategy in production — it ignores topology and is dev/single-DC only.

### Q3. What is LOCAL_QUORUM and why is it the multi-DC workhorse?

LOCAL_QUORUM requires a quorum of replicas **within the coordinator's own datacenter**. With RF 3 in that DC, that's 2 acks — all from local nodes.

The point is latency. Plain `QUORUM` counts replicas across *all* DCs, so a global quorum may force the coordinator to wait for a node an ocean away. LOCAL_QUORUM gives you the same strong-consistency property (R + W > RF, both scoped to the local DC) with only same-region round trips.

```cql
-- read and write both at LOCAL_QUORUM in the local DC
CONSISTENCY LOCAL_QUORUM;
INSERT INTO users_by_id (id, email) VALUES (uuid(), 'alice@acme.test');
```

The recipe: **LOCAL_QUORUM writes + LOCAL_QUORUM reads** gives you read-your-writes consistency inside each DC while cross-DC replication catches up asynchronously. It's the default choice for almost every multi-DC OLTP workload.

### Q4. LOCAL_QUORUM vs EACH_QUORUM — when would you use each?

| | LOCAL_QUORUM | EACH_QUORUM |
|---|---|---|
| Scope | Quorum in local DC only | Quorum in *every* DC |
| Latency | Local round trips only | Pays every DC's WAN latency |
| Survives a remote DC down? | Yes | No (that DC can't form a quorum) |
| Applies to | Reads and writes | Writes only |
| Use for | Almost everything | When a write must be durable in all regions before ack |

LOCAL_QUORUM is the default. Reach for EACH_QUORUM only when a write genuinely must be acknowledged in every datacenter before you tell the client "done" — rare, and it makes you fragile, because a single unreachable DC now fails your writes. Most teams get cross-DC durability from async replication + repair instead of blocking on EACH_QUORUM.

### Q5. How does a write propagate to remote datacenters?

The coordinator handles local and remote replicas differently:

1. It sends the write to **all local replicas** in parallel and waits for enough acks to satisfy the consistency level (e.g. 2 for LOCAL_QUORUM).
2. For each **remote DC**, it sends the write to a **single forwarder** replica in that DC, which then fans out to the other local replicas there. This sends the payload across the WAN once per remote DC instead of once per remote replica — saving cross-DC bandwidth.
3. Remote propagation is **asynchronous** — the coordinator does not block on remote acks under LOCAL_QUORUM.

```
client → coordinator (dc1)
           ├─ dc1 replica A  ✓  ┐ waited on (LOCAL_QUORUM = 2)
           ├─ dc1 replica B  ✓  ┘
           ├─ dc1 replica C  (async)
           └─ dc2 forwarder ─→ dc2 replicas A/B/C  (async, one WAN hop)
```

If a remote replica is down, the coordinator stores a **hint** and replays it later. Anti-entropy repair backstops anything hints miss.

### Q6. How are reads and writes routed to the local datacenter?

Two cooperating layers:

- **Server side — the snitch.** `GossipingPropertyFileSnitch` tells each node which DC/rack every other node is in, so a coordinator prefers local replicas and the load balancer can keep traffic in-region.
- **Client side — the driver's load-balancing policy.** Use a **DC-aware, token-aware** policy: DC-awareness pins the driver to its local DC (it only uses remote DCs if the local one is unreachable, if configured to fail over at all); token-awareness routes each query straight to a replica that *owns* the partition, skipping an extra coordinator hop.

```java
CqlSession.builder()
  .withLocalDatacenter("dc1")   // DC-aware
  .build();                     // token-aware is default in modern drivers
```

Net effect: a client in region 1 hits a `dc1` coordinator, which hits `dc1` replicas, and satisfies LOCAL_QUORUM without a single WAN round trip.

### Q7. What is rack awareness and why does it matter?

A **rack** maps to a physical rack on-prem or an **availability zone** in the cloud. NetworkTopologyStrategy tries to place a partition's replicas on **distinct racks** within each DC.

Why it matters: if all 3 replicas of a partition landed in the same AZ and that AZ died, you'd lose the partition entirely — and even non-fatal, you couldn't satisfy LOCAL_QUORUM. Spreading replicas across 3 racks means one rack/AZ failure removes at most **one** replica per partition, so LOCAL_QUORUM (2 of 3) still succeeds and no data is unavailable.

Rule of thumb: run **RF = number of racks/AZs** (commonly RF 3 across 3 AZs) and keep node counts balanced across racks, so token ranges distribute evenly. Misconfigured racks (everything in `rack1`) silently defeat the whole scheme.

### Q8. How does the ring cope with a single node going down?

Gracefully — this is the common case Cassandra is built for.

- **Detection:** gossip stops hearing from the node; the phi-accrual failure detector marks it DOWN within seconds.
- **Writes keep succeeding:** with RF 3 and QUORUM/LOCAL_QUORUM you need 2 acks; 2 replicas remain. The coordinator stores a **hint** for the down replica.
- **Reads keep succeeding:** the other replicas answer; read repair fixes any staleness among them.
- **On return:** hinted handoff replays the buffered writes. If the node was down longer than `max_hint_window` (default 3h), hints expire and you run `nodetool repair` to make it consistent again.

No client-visible outage, no failover. The only cost is temporarily reduced redundancy for partitions the node owned.

### Q9. What happens when an entire rack or availability zone goes down?

If replicas are spread across racks correctly (Q7), an AZ outage removes **one replica per partition**. With RF 3:

- LOCAL_QUORUM (2 of 3) still succeeds for both reads and writes.
- Hints accumulate for the down replicas; they replay when the AZ returns.
- No partition becomes unavailable, because no partition had two of its three replicas in the dead AZ.

This is exactly why RF and rack count are chosen together. If you'd run RF 2 across 2 AZs, losing one AZ drops you to a single replica and QUORUM (which needs 2) starts failing — you'd be stuck at CL ONE with no redundancy. RF 3 across 3 AZs is the standard precisely because it tolerates a full-AZ loss at LOCAL_QUORUM.

### Q10. What happens when an entire datacenter goes down?

The other datacenters keep serving. Because each DC is a full, independent replica set:

- Clients in surviving regions continue at **LOCAL_QUORUM** with no coordination from the dead DC.
- There is **no failover / promotion** — the survivors were already live-live.
- Writes destined for the dead DC pile up as hints (bounded by the hint window); anything beyond that is reconciled by `nodetool repair` once the DC returns.
- When the DC comes back, run **repair** (or `nodetool rebuild` if it lost its data) to resync before pointing traffic at it again.

Contrast with a primary/replica database, where losing the primary's region triggers a failover election and a window of unavailability. Cassandra just loses that DC's *capacity*, not its *availability*.

### Q11. How do gossip and the failure detector work?

**Gossip** is the peer-to-peer membership protocol. A few times per second, each node picks a small random set of peers and exchanges state — who's up, who's down, tokens, schema version, load. State converges across the whole cluster in a handful of rounds without any central registry. **Seed nodes** are just well-known contact points a booting node gossips with first.

**Failure detection** uses the **phi-accrual failure detector**. Instead of a hard timeout ("no heartbeat in 10s ⇒ dead"), it tracks the *distribution* of inter-arrival times of a node's heartbeats and outputs a suspicion level, phi, that rises as a node goes quiet. When phi crosses a threshold the node is marked DOWN. This adapts to network jitter — a slightly slow link raises phi gradually rather than causing false positives. **Flapping** (a node repeatedly marked up/down) usually means GC pauses, network instability, or an overloaded node, and it's a red flag worth chasing.

### Q12. What's the availability math — how many failures can you tolerate?

It's a function of RF and consistency level. QUORUM needs `floor(RF/2) + 1` replicas:

| RF | QUORUM needs | Failures tolerated at QUORUM |
|---|---|---|
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

So RF 3 + QUORUM survives one replica down per partition; RF 5 survives two. Drop to CL ONE and you tolerate RF−1 failures but lose strong consistency. Go to CL ALL and you tolerate zero — any single replica down fails the operation.

In multi-DC, apply the math **per DC**: `{dc1: 3, dc2: 3}` at LOCAL_QUORUM tolerates one node down in the local DC *and* the complete loss of the other DC simultaneously, because LOCAL_QUORUM never depended on the remote DC. That composability is the whole point.

### Q13. Why does Cassandra have no single point of failure?

Because there is no special node. Every node is a peer that can act as coordinator for any request; there's no master, no config server, no leader to elect. Compare the usual SPOF suspects and what Cassandra does instead:

- **No master node** — any node coordinates; masterless by design.
- **No metadata/config server** — topology and schema spread by gossip; every node knows the ring.
- **No primary replica** — all replicas are equal; reads/writes go to any of them.
- **Seed nodes aren't masters** — they only bootstrap gossip for *new* nodes; a running cluster survives all seeds being down.

The trade you make for this is Cassandra's **AP** stance: under a partition it stays available and may serve slightly stale data until repair reconciles, rather than refusing service to stay consistent. There's simply no single component whose failure takes the cluster offline.

### Q14. During a network partition between DCs, what happens?

Cassandra is **AP** — it favours availability. If `dc1` and `dc2` can't talk:

- Each DC keeps serving its **own** clients at LOCAL_QUORUM, because LOCAL_QUORUM never needed the other DC.
- Cross-DC replication stalls; the coordinators buffer **hints** for the unreachable DC (up to the hint window).
- The two DCs may briefly diverge — a key written in `dc1` isn't yet visible in `dc2`.
- When the partition heals, hinted handoff replays buffered writes and **read repair / `nodetool repair`** reconcile any remaining differences using last-write-wins timestamps.

The one thing that *does* fail during the partition is anything demanding **EACH_QUORUM** or global **QUORUM** that spans the severed link — which is exactly why those consistency levels make you fragile in multi-DC and LOCAL_QUORUM is preferred.

### Q15. How do you add a new datacenter to a live cluster?

Online, with no downtime, in this order:

1. Stand up the new DC's nodes with the correct snitch and `dc=`/`rack=` set; let them join gossip but **don't** point client traffic at them yet (set `auto_bootstrap: false` on the new nodes so they join empty).
2. Alter each keyspace to add RF for the new DC:

```cql
ALTER KEYSPACE acme
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3,
  'dc2': 3,
  'dc3': 3
};
```

3. Stream existing data into the new DC:

```bash
nodetool rebuild -- dc1     # run on each new-DC node, sourcing from dc1
```

4. Run `nodetool repair` to catch writes that arrived during rebuild, then start routing local clients to the new DC at LOCAL_QUORUM.

Skipping step 3 is the classic mistake — the ALTER makes the new DC a *replica target* for new writes, but it starts with no historical data until you rebuild.

### Q16. Design a Cassandra deployment that survives an AZ and a region failure.

Layer redundancy at both scopes:

**Within a region (survive an AZ loss):**
- Two or more regions modelled as datacenters, each `RF 3`.
- Three availability zones per DC, mapped to three **racks**; use `GossipingPropertyFileSnitch`.
- RF 3 across 3 AZs so one AZ loss removes one replica per partition — LOCAL_QUORUM (2/3) still serves.

**Across regions (survive a region loss):**
- `NetworkTopologyStrategy {us_east: 3, us_west: 3}` — full copies in each region, live-live.
- Clients use DC-aware + token-aware routing to their nearest region; consistency **LOCAL_QUORUM** for reads and writes.
- A region outage just removes that region's capacity; the other keeps serving with no failover.

**Operational backstops:**
- Regular `nodetool repair` (or Cassandra Reaper) within `gc_grace_seconds` for anti-entropy.
- Snapshots + incremental backups (or Medusa) shipped off-cluster for true disaster recovery.
- Runbook: on region loss, keep serving from the survivor; on return, `repair`/`rebuild` before restoring traffic.

The one-line summary for an interviewer: **RF 3 across 3 AZs handles the AZ failure; NTS with a full replica set per region handles the region failure; LOCAL_QUORUM keeps both cheap.**

## Cassandra 4.x/5.0, Ecosystem & Alternatives

### Summary

**What this topic covers**

The map of the modern Cassandra world and, just as importantly, how to decide whether you should be in it at all. The 15 questions here cover what **Cassandra 4.x** fixed (stability, streaming, repair, virtual tables, audit logging), the headline **Cassandra 5.0** features that change how you model (**SAI** indexing, **Accord/ACC** transactions, **vector search**, unified compaction), the **driver and application layer** (prepared statements, token-/DC-aware load balancing, async, paging, retries, pooling), the surrounding **ecosystem** (`cqlsh`, `nodetool`, Reaper, Medusa, Stargate, the Spark connector, CDC), the **managed offerings** (DataStax Astra, AWS Keyspaces, Azure Managed Instance), the **ScyllaDB** rewrite, and the head-to-head against **DynamoDB, MongoDB, HBase, Redis, and Postgres**. The through-line is a senior instinct: Cassandra is a specialized tool, and the most valuable answer is often "you don't need it."

**Mental model**

Think in three concentric rings. The **core** is Apache Cassandra the database — 4.x made it boringly reliable, 5.0 made it more capable (real indexes with SAI, real multi-partition transactions with Accord, vectors for AI). Around it is the **application ring**: your app never touches the ring directly, it goes through a **driver**, and most of your latency and correctness wins live there — prepared statements, token-aware routing, idempotent retries. Around *that* is the **ecosystem ring**: operational tools (Reaper for repair, Medusa for backups, `nodetool`), API gateways (Stargate), analytics (Spark connector, CDC), and managed platforms (Astra, Keyspaces) that trade control for no-ops. Sitting outside all three are the **alternatives** — DynamoDB, Scylla, Mongo, HBase, Redis, Postgres — each occupying a different point on the managed-vs-control, model, and consistency axes. Choosing well means knowing which ring your problem actually lives in.

**Key terms**

- **SAI (Storage-Attached Indexing)** — Cassandra 5.0's new secondary-index standard; far better than legacy 2i, supports numeric ranges and text, one index infrastructure per table.
- **Accord / ACC** — 5.0's general-purpose, leaderless transaction protocol bringing multi-partition ACID without a coordinator bottleneck.
- **Vector search / ANN** — 5.0 approximate-nearest-neighbour indexing over embedding columns, for AI/semantic-search workloads.
- **UCS (Unified Compaction Strategy)** — 5.0 compaction that subsumes STCS/LCS behaviour under one tunable strategy.
- **Prepared statement** — a CQL statement parsed once on the server and executed many times with bound values; faster and injection-safe.
- **Token-aware + DC-aware load balancing** — driver policy that routes a query to a replica that owns the data, in the local DC.
- **Stargate** — data API gateway exposing Cassandra over REST, GraphQL, gRPC, and Document APIs.
- **Cassandra Reaper** — tool that schedules and orchestrates `nodetool repair` so anti-entropy actually happens.
- **Medusa** — backup/restore tool for Cassandra (snapshots to object storage).
- **DataStax Astra** — serverless, managed Cassandra-as-a-service.
- **AWS Keyspaces** — Amazon's serverless, CQL-compatible managed service (not real Cassandra under the hood).
- **ScyllaDB** — a C++, shard-per-core reimplementation of Cassandra that speaks CQL; higher throughput per node, no JVM/GC.

**Why interviewers ask this**

This topic separates people who can *operate and choose* from people who can only *use*. Version awareness (knowing SAI and Accord landed in 5.0) signals you track the project rather than remembering a 2016 blog post. Driver knowledge (prepared statements, token-aware routing) is where real production latency is won or lost — a candidate who mentions it has debugged a slow service. But the sharpest signal is the alternatives question. A junior reaches for Cassandra because it's cool; a senior asks "do you have the write volume, the scale, and the availability requirement to justify the modeling and ops burden — or is this a Postgres table?" Being able to say "use DynamoDB if you're all-in on AWS and want no-ops; use Postgres if you need joins and ad-hoc queries; use Cassandra when you genuinely need multi-region always-on write scale" is exactly the judgment interviewers are testing for.

**Common confusions**

- "AWS Keyspaces is Cassandra" — it's CQL-*compatible* but a different engine underneath; some behaviours (batches, timestamps, consistency semantics) differ.
- "SAI makes Cassandra a general query database" — it makes secondary lookups viable, but query-first modeling still rules; SAI is not a license to `SELECT ... WHERE` on anything.
- "Accord means Cassandra is now ACID like Postgres" — it adds serializable multi-partition transactions, but you still design around partitions; it's not an invitation to do joins and long transactions.
- "ScyllaDB is just faster Cassandra you drop in" — it's compatible but a separate product with its own operational model and feature lag on the newest CQL features; migration is real work.
- "The driver is a thin HTTP client" — it's a stateful, topology-aware component; using it wrong (no prepared statements, wrong LB policy, non-idempotent retries) is a top cause of production pain.
- "Managed means you can ignore data modeling" — Astra/Keyspaces remove ops, not the need to model around partitions and access patterns.

**What follows from this topic**

The version features here reshape earlier topics: SAI is the modern answer to the Secondary Indexes topic's "don't index high-cardinality columns"; Accord revisits the LWT/Paxos discussion in the Consistency topic; UCS extends the Compaction topic. The driver layer is where the Consistency and Multi-DC topics become concrete (LOCAL_QUORUM + token-aware routing). And the alternatives comparison sets up the Scenario topic's recurring "should we even use Cassandra for this?" gut-check — the single most valuable question you can ask in a data-store design interview.

### Q1. What changed in Cassandra 4.x?

4.x was the "make it boringly reliable" release line. Highlights:

- **Stability and correctness** — a huge testing push (fuzzing, property tests); 4.0 was arguably the most stable release ever shipped.
- **Faster streaming (zero-copy / "Zero Copy Streaming")** — bootstrapping and repair stream entire SSTables at near disk speed, cutting the time to add/replace a node dramatically.
- **Better, incremental repair** — more reliable anti-entropy, less repair pain.
- **Virtual tables** — expose metrics and settings as queryable `system_views` tables via CQL, no JMX round-trip.
- **Audit logging & full query logging (`fqltool`)** — capture and replay queries for security/debugging.
- **JDK 11 support and GC improvements** — better tail latencies.

The theme: nothing flashy, everything operational. If someone asks "why upgrade to 4.x", the answer is faster node operations and far fewer surprises.

### Q2. What are the headline Cassandra 5.0 features?

5.0 is the "make it more capable" release:

- **SAI (Storage-Attached Indexing)** — a new, far better secondary index: supports numeric ranges and text matching, shares one index infrastructure per table, and scales better than legacy 2i. The new default for secondary lookups.
- **Accord / ACC transactions** — a leaderless consensus protocol delivering **general-purpose, multi-partition ACID** transactions without a single-coordinator bottleneck — a genuine step beyond single-partition LWT.
- **Vector Search / ANN** — a `VECTOR` type plus approximate-nearest-neighbour indexing, aimed squarely at AI/embedding and semantic-search workloads.
- **UCS (Unified Compaction Strategy)** — one compaction strategy that can behave like STCS or LCS via configuration, simplifying tuning.
- **Trie-based memtables and SSTable indexes** — more memory-efficient, faster lookups.

Together they broaden what Cassandra can do (indexes, transactions, vectors) without giving up the masterless, scale-out core.

### Q3. What is SAI and how does it compare to legacy secondary indexes?

**SAI (Storage-Attached Indexing)** is Cassandra 5.0's replacement for the old secondary index (2i) machinery.

| | Legacy 2i | SAI |
|---|---|---|
| Storage | Separate hidden table per index | Attached to the SSTables, shared infra |
| Disk/overhead | High; one structure per index | Much lower; one per table for many columns |
| Queries | Equality only, high-cardinality is a trap | Equality *and numeric ranges*, text match |
| Scaling | Degrades badly with cardinality | Far better, though still fan-out |
| Recommendation | Avoid | The modern default for secondary lookups |

The caveat that *survives* SAI: it's still a **scatter-gather** across replicas (the query hits many nodes to find matching partitions), so it doesn't turn Cassandra into a relational query engine. Use SAI for genuine secondary-access needs on an existing table; still prefer a **purpose-built query table** for your primary high-throughput access paths.

### Q4. What does Accord (ACC) add, and how is it different from LWT?

**LWT (lightweight transactions)** use Paxos for *single-partition* compare-and-set (`IF NOT EXISTS`, `IF col = ?`). They're correct but slow (multiple round trips) and can't span partitions.

**Accord** is a new leaderless consensus protocol that provides **general-purpose, multi-partition, strictly-serializable transactions** — you can atomically read and write across several partitions with ACID guarantees, and because it's leaderless there's no single coordinator to bottleneck or fail over.

```
LWT:      one partition, compare-and-set, Paxos, slow, no cross-partition
Accord:   many partitions, full ACID transaction, leaderless, no SPOF
```

The senior caveat: Accord makes multi-partition transactions *possible*, not *free*. You still model query-first and keep transactions small; it's for the cases where you genuinely need cross-partition atomicity, not a green light to write relational-style code on Cassandra.

### Q5. Why does the driver layer matter so much, and what should you always do?

Your app never speaks to the ring directly — it goes through a **driver** (the DataStax Java/Python/Node/etc. drivers), and most production latency and correctness lives there. Always:

- **Use prepared statements** — parse once, execute many; faster and injection-safe (Q6).
- **Use a token-aware + DC-aware load-balancing policy** — route each query to a replica that owns the partition, in the local DC, skipping an extra coordinator hop and any WAN latency (Q7).
- **Set consistency explicitly** — usually LOCAL_QUORUM; don't rely on defaults.
- **Make retries idempotent** — mark statements idempotent so the retry policy can safely re-send; never blindly retry non-idempotent writes.
- **Page large results** — don't pull a huge partition in one response; use fetch size / automatic paging.
- **Reuse one Session** — it manages connection pooling and topology; creating sessions per request is a classic bug.

### Q6. What are prepared statements and why use them?

A **prepared statement** is a CQL query you send to the cluster *once* to be parsed and planned; the server returns an ID, and thereafter you execute it many times with only the bound values.

```java
PreparedStatement ps = session.prepare(
  "INSERT INTO users_by_id (id, email) VALUES (?, ?)");
session.execute(ps.bind(id, "alice@acme.test"));
session.execute(ps.bind(id2, "bob@acme.test"));
```

Two wins:

- **Performance** — parsing happens once, not per execution; the driver also caches metadata and can compute the token for token-aware routing from the bound key.
- **Safety** — values are bound as parameters, never string-concatenated, so CQL injection is impossible.

Rule: prepare each distinct statement **once** at startup and reuse it. Preparing the same string repeatedly (or building queries by string concatenation) defeats both benefits.

### Q7. What is token-aware, DC-aware load balancing?

It's the driver policy that decides *which node* to send each query to.

- **Token-aware** — the driver knows the ring's token ranges, so for a query whose partition key it can see, it sends the request **directly to a replica that owns that data**. That node coordinates locally instead of forwarding — one fewer network hop and no random-coordinator penalty.
- **DC-aware** — the driver treats one DC as local and only uses it (falling back to remote DCs only if configured and necessary), so queries never accidentally cross the WAN.

```java
CqlSession.builder().withLocalDatacenter("dc1").build();
// token-awareness is the default wrapping policy in modern drivers
```

Combined with LOCAL_QUORUM, this is *the* multi-DC latency recipe: right node, right region, minimum hops. Getting it wrong (round-robin across all DCs) is a frequent cause of mysterious cross-region latency.

### Q8. What tools make up the Cassandra operational ecosystem?

- **`cqlsh`** — the interactive CQL shell for schema, queries, and quick ops.
- **`nodetool`** — the primary admin CLI: `status`, `repair`, `compactionstats`, `tpstats`, `cleanup`, `rebuild`, `flush`, `drain`.
- **Cassandra Reaper** — schedules and orchestrates repairs across the cluster so anti-entropy actually happens on time (running `nodetool repair` by hand doesn't scale).
- **Medusa** — snapshot-based backup and restore to object storage (S3/GCS).
- **Metrics Collector / metrics exporters** — ship Cassandra metrics to Prometheus/Grafana for latency, compaction, and pending-task dashboards.
- **Stargate** — data-API gateway (REST/GraphQL/gRPC/Document) for teams that don't want to speak CQL directly.
- **Spark-Cassandra connector** — bulk analytics and ETL over Cassandra data from Spark.
- **CDC (Change Data Capture)** — stream changes out of Cassandra (e.g. into Kafka) for downstream pipelines.

Naming Reaper and Medusa unprompted signals you've actually run a cluster, not just queried one.

### Q9. What managed / hosted Cassandra options exist?

- **DataStax Astra** — **serverless, fully-managed Cassandra** (real Cassandra/DSE underneath), pay-for-what-you-use, autoscaling, with Stargate APIs built in. The closest to "Cassandra without ops".
- **AWS Keyspaces** — Amazon's **serverless, CQL-compatible** service. Convenient if you're all-in on AWS, but it's a *different engine* under the CQL surface, so some behaviours (lightweight transactions, batches, per-partition semantics, timestamps) differ from real Cassandra — validate, don't assume.
- **Azure Managed Instance for Apache Cassandra** — Microsoft-run **actual Cassandra** clusters; more "managed nodes" than serverless, and it can hybrid-join an on-prem cluster as a DC.

The trade across all three: you give up node-level control and some multi-cloud flexibility in exchange for no-ops. They remove the operational burden — they do **not** remove the need to model query-first.

### Q10. What is ScyllaDB and why do teams migrate to it?

**ScyllaDB** is a ground-up **C++ reimplementation of Cassandra** that speaks the same CQL and wire protocol. Its defining design is **shard-per-core**: one shard pinned per CPU core with its own memory and data, using async I/O (the Seastar framework) and no shared locks — and crucially **no JVM, so no GC pauses**.

Why teams move:

- **Much higher throughput and lower, more predictable tail latency per node** — often letting you run the same workload on far fewer machines.
- **No GC-induced latency spikes** — a chronic Cassandra tail-latency source disappears.
- **Self-tuning** — it adapts to hardware automatically, reducing knob-twiddling.

The trade-offs (be honest about these): it's a **separate product** with its own operational tooling and its own timeline for the newest Apache Cassandra features (e.g. it tends to lag on brand-new CQL/5.0 features), and a migration is real work — data movement, driver/config validation, and re-testing behaviour. It's compatible, not literally drop-in.

### Q11. Cassandra vs DynamoDB — how do you choose?

They share Dynamo lineage (consistent hashing, tunable consistency, wide-column-ish model), so the decision is mostly operational:

| | Cassandra | DynamoDB |
|---|---|---|
| Ops | Self-managed (or Astra) | Fully managed, no-ops |
| Cloud | Multi-cloud / on-prem / hybrid | AWS only |
| Cost model | Infra you run | Pay-per-throughput (RCU/WCU) or on-demand |
| Multi-region | NTS, full control | Global Tables |
| Control/tuning | Deep (compaction, CLs, repair) | Limited knobs |
| Query features | CQL, SAI, 5.0 transactions | Query/Scan, GSIs, transactions |

Choose **DynamoDB** when you're all-in on AWS and want zero operational burden and elastic pay-per-use. Choose **Cassandra** when you need multi-cloud/on-prem/hybrid, deep control, no per-request pricing at very high sustained volume, or full-copy-per-region multi-DC on your own terms.

### Q12. Cassandra vs MongoDB vs HBase vs Redis — one line each?

- **MongoDB** — document store with rich queries, secondary indexes, and aggregation, but a **primary-secondary** replication model (a primary per shard). Pick it when you need flexible documents and ad-hoc queries; Cassandra beats it for masterless multi-region write availability and linear write scale.
- **HBase** — a Bigtable-style wide-column store on the **Hadoop/HDFS** stack with a **master** (HMaster) and region servers. Strong consistency and tight Hadoop integration, but master-based and operationally heavier; pick it if you already live in Hadoop and want strong consistency.
- **Redis** — **in-memory** key-value/data-structure store; microsecond latency, great as a cache or for ephemeral/real-time data. Not a durable system of record at Cassandra's scale; different job entirely.

Cassandra's niche among them: **masterless, always-on, high-write-throughput, multi-region** system of record — at the cost of no joins and query-first modeling.

### Q13. Cassandra vs Postgres — the "do you actually need Cassandra?" check.

This is the most important comparison, because the honest default answer is often **Postgres**.

- **Postgres** gives you ACID transactions, joins, ad-hoc queries, secondary indexes on anything, a mature ecosystem, and — with read replicas and modern extensions — a *lot* of scale. Most applications never outgrow it.
- **Cassandra** gives you linear write scaling, masterless always-on multi-region availability, and no single point of failure — but demands **query-first denormalized modeling** (one table per access pattern, no joins, no ad-hoc queries), tombstone/compaction awareness, and real operational maturity.

The reality check: Cassandra's modeling and ops burden is only worth it when you genuinely have the **write volume, the scale, or the always-on multi-region requirement** to justify it. If your data is small-to-moderate, your queries are varied, or your team lacks ops maturity, Postgres is the better engineering decision — and saying so in an interview is a strong senior signal.

### Q14. When should you NOT use Cassandra?

Say no when you need any of these:

- **Transactions, joins, or referential integrity** across entities — that's a relational job (or Accord only for narrow cases).
- **Ad-hoc / analytical queries** you can't predict in advance — Cassandra needs the query known at modeling time; `ALLOW FILTERING` is a smell, not a feature.
- **Small or moderate data** — a single Postgres/MySQL box handles it with far less complexity.
- **Aggregations, reporting, BI** — export to a warehouse (or use the Spark connector); don't run analytics on the OLTP ring.
- **A team without ops maturity** — repair, compaction tuning, and capacity planning are ongoing work; a managed relational DB is safer.
- **Strong read-after-write everywhere with heavy contention on single rows** — LWT overhead will hurt.

The tell of a good engineer is reaching for Cassandra *only* when the write-scale/availability requirement is real.

### Q15. "We're choosing between Cassandra, DynamoDB, and Postgres for a new service." How do you decide?

Drive it from the requirements, in this order:

1. **Do you need joins, ad-hoc queries, or ACID across entities?** → **Postgres.** Stop here; most services land here.
2. **Do you have massive write throughput / huge data / always-on multi-region needs, and predictable access patterns?** → a wide-column store. Then:
   - **All-in on AWS, want zero ops, fine with pay-per-throughput?** → **DynamoDB.**
   - **Need multi-cloud / on-prem / hybrid, deep control, full-copy-per-region multi-DC, or no per-request pricing at sustained scale?** → **Cassandra** (or Astra for managed).
3. **Is it a cache or ephemeral real-time data?** → **Redis**, likely alongside one of the above.

Frame the answer as a checklist, not a preference. The senior move is to *try to talk yourself out of Cassandra first* — "unless X, Y, or Z is true, this is a Postgres table" — and only land on Cassandra when the scale/availability case is genuinely made.

## Scenario & Data-Modeling Playbooks

### Summary

**What this topic covers**

The capstone. This is where every earlier topic — partition keys, clustering, consistency, tombstones, compaction, batches, LWT — gets applied to real problems under interview pressure. The 17 questions split into two kinds. **Design questions**: "model a chat app", "an activity feed", "IoT time-series", "a leaderboard", "user lookup by id *and* email", "order history", "query by a non-key column" — each answered with a concrete CQL schema and the reasoning. **Diagnose / spot-the-anti-pattern questions**: "one node is overloaded", "reads are timing out with TombstoneOverwhelmingException", "p99 latency is spiking", "a partition grew to 5GB", "a deleted row came back", "this query needs ALLOW FILTERING", "our batch is slow", "LWT is everywhere and slow", "cross-region writes are slow", and the ever-present "should we even use Cassandra?" Each diagnosis names the anti-pattern and gives the fix. Together this is the definitive Cassandra modeling-and-troubleshooting reference.

**Mental model**

Cassandra modeling is a fixed pipeline, and interviews reward running it out loud:

1. **Start from access patterns.** List the exact queries the app makes. You are modeling queries, not entities.
2. **Partition key for distribution.** Choose a key that spreads load evenly *and* groups the rows a query reads together. Watch cardinality — too low means hot partitions.
3. **Clustering columns for order.** Pick the on-disk sort (usually time DESC) so the common query is a contiguous slice.
4. **Validate partition size.** Estimate rows × row-size × time. If a partition grows unbounded or past ~100MB, **bucket** it (add a time or hash component to the partition key).
5. **Pick the consistency level.** LOCAL_QUORUM for correctness; ONE where you can tolerate staleness.
6. **Mind tombstones and compaction.** Delete-heavy or TTL data → TWCS and avoid the queue pattern. Wide time-series → TWCS + TTL.

Diagnosis is the same pipeline run backwards: a symptom (hot node, timeout, latency spike, resurrected row) points to exactly one broken step.

**Key terms**

- **Query-first modeling** — design one table per access pattern; denormalize freely; no joins, no ad-hoc.
- **Bucketing** — adding a time window or hash to the partition key to bound partition size / spread a hot key.
- **Hot partition** — one partition taking disproportionate traffic due to low-cardinality or celebrity keys.
- **Wide / unbounded partition** — a partition that grows without limit (append-only by a single key); the top modeling failure.
- **Tombstone** — a delete marker; too many on a read path cause `TombstoneOverwhelmingException`.
- **TWCS (Time-Window Compaction Strategy)** — compaction for time-series/TTL data; whole SSTables expire cheaply.
- **Fan-out-on-write** — precompute per-consumer copies at write time (feeds/timelines) so reads are a single partition slice.
- **Denormalized duplicate tables** — the same data written to multiple tables, one per query (kept in sync by the app or a batch).
- **ALLOW FILTERING** — a flag that lets Cassandra scan+filter; a red flag meaning your table doesn't match your query.
- **Zombie / resurrected data** — deleted rows reappearing because repair didn't run within `gc_grace_seconds`.
- **Logged batch** — atomic multi-statement batch; correct *only* for keeping denormalized tables in sync, not for bulk load.

**Why interviewers ask this**

Design and diagnosis are the questions that can't be bluffed. Anyone can recite "Cassandra is masterless"; only someone who has modeled real tables can turn "build a messaging app" into `messages_by_conversation` with bucketing and DESC clustering and explain *why*, or hear "reads are timing out" and immediately suspect tombstones from a queue pattern. These questions test the whole stack at once: do you start from access patterns or from entities (the junior tell is drawing an ER diagram)? Do you catch the unbounded partition before it's a 5GB incident? Do you know that a resurrected row means repair didn't run inside gc_grace? Senior candidates also show restraint — spotting the case where the right answer is "this shouldn't be in Cassandra at all." This is the topic that most predicts on-the-job success.

**Common confusions**

- "Model the entities, then figure out queries" — backwards. Queries first; the schema is downstream of them.
- "One big table is simpler" — a single unbounded/hot partition is the most common production failure; bucket early.
- "Deletes free space immediately" — no; they write tombstones that linger until gc_grace *and* compaction, and can slow reads meanwhile.
- "ALLOW FILTERING is fine for small tables" — it teaches a habit that detonates at scale; redesign the table around the query instead.
- "Batches make writes faster" — logged multi-partition batches are *slower* and for atomicity only; for bulk load use parallel async single-partition writes.
- "LWT is just a conditional write" — every LWT is a Paxos round; sprinkling `IF` everywhere serializes your hot path.
- "Counters are normal columns" — they're a special type with their own rules; don't mix them with regular columns or expect idempotent retries.

**What follows from this topic**

Nothing follows — this *is* where it all lands. Every playbook here reaches back: partition/clustering choices to the Data Modeling and Architecture topics, consistency fixes (R + W > RF, LOCAL_QUORUM) to the Consistency and Multi-DC topics, tombstone/TTL/TWCS fixes to the Storage/Compaction and Deletes topics, batch and LWT anti-patterns to the Writes topic, and "should we use Cassandra?" to the Ecosystem topic's alternatives. If you can run the modeling pipeline forward to design and backward to diagnose, you've integrated the whole primer.

### Q1. Design a schema for a chat / messaging app.

Access patterns: load the most recent messages in a conversation, page backwards through history, post a new message.

Partition by conversation so one query reads one partition; cluster by time **descending** so "latest messages" is the front of the partition. Guard against a busy conversation growing unbounded by adding a **time bucket** to the partition key:

```cql
CREATE TABLE messages_by_conversation (
  conversation_id uuid,
  bucket          text,        -- e.g. '2026-07' month bucket
  message_id      timeuuid,    -- time-ordered
  sender_id       uuid,
  body            text,
  PRIMARY KEY ((conversation_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

- **`(conversation_id, bucket)` partition key** — spreads load and bounds each partition to one month of a conversation, so no partition grows forever.
- **`message_id timeuuid` clustering DESC** — newest first; `LIMIT 50` gives the latest page cheaply, and paging state walks older messages.
- Read the current bucket first; cross a bucket boundary only when you page past it.

Reads and writes at **LOCAL_QUORUM**. This is the canonical "wide partition, time-ordered, bucketed" pattern.

### Q2. Design an activity feed / timeline.

The choice is fan-out-on-write vs fan-out-on-read. For feeds, **fan-out-on-write** (precompute each user's timeline) makes the read a single fast partition slice — the right trade when reads vastly outnumber writes:

```cql
CREATE TABLE feed_by_user (
  user_id    uuid,
  event_id   timeuuid,
  actor_id   uuid,
  verb       text,
  target     text,
  PRIMARY KEY (user_id, event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);
```

On each new event, write one row into **every follower's** `feed_by_user` partition (async, in parallel). Reading a timeline is then a single-partition `SELECT ... WHERE user_id = ? LIMIT n`.

The known caveat: **celebrity fan-out.** A user with millions of followers triggers millions of writes per event, and their followers' partitions get hot. Mitigate by hybridizing — fan out normal users on write, but pull celebrity posts on read (merge a small "big accounts" query into the timeline). Name this trade-off; it's the senior signal.

### Q3. Design IoT / sensor time-series storage.

Access pattern: query one sensor's readings over a time range; data is append-only, high-volume, and expires. Partition by **sensor + time bucket**, cluster by timestamp DESC, set a **TTL**, and use **TWCS**:

```cql
CREATE TABLE readings_by_sensor (
  sensor_id uuid,
  day       date,          -- daily bucket
  ts        timestamp,
  value     double,
  PRIMARY KEY ((sensor_id, day), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
  AND default_time_to_live = 2592000          -- 30 days
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_unit': 'DAYS',
                    'compaction_window_size': 1};
```

- **`(sensor_id, day)`** bounds each partition to one day of one sensor — predictable size, no unbounded growth.
- **TTL** expires old readings automatically.
- **TWCS** groups data by time window so an entire expired SSTable is dropped as a unit — no per-row tombstone storm, which is exactly why STCS/LCS are wrong here.

This TTL + TWCS + time-bucket combination is *the* time-series pattern; getting the compaction strategy right is the point.

### Q4. Design a leaderboard.

Two honest options, both with caveats.

**Counters** for running score totals:

```cql
CREATE TABLE score_by_player (
  game_id   uuid,
  player_id uuid,
  score     counter,
  PRIMARY KEY (game_id, player_id)
);
UPDATE score_by_player SET score = score + 10
  WHERE game_id = ? AND player_id = ?;
```

Caveats: counters are a **special type** (separate columns, no mixing with regular columns), updates are **not idempotent** (a retried increment can double-count), and there's no way to `ORDER BY score` — Cassandra sorts by clustering key, not by value.

**So how do you get ranked order?** You can't rank arbitrarily large sets on the ring efficiently. Practical answers: keep a bounded top-N by writing score-keyed rows into a small ranking partition (`PRIMARY KEY (game_id, score, player_id)` with `score DESC`), accepting some skew and update churn; or — the common real answer — compute the leaderboard in **Redis (sorted sets)** or a batch job and use Cassandra only for the authoritative counts. Saying "true global ranking isn't Cassandra's strength" is the mature answer.

### Q5. Model user profiles queried by id AND by email.

There are no joins and no free secondary lookups, so you **denormalize into one table per lookup** and keep them in sync:

```cql
CREATE TABLE users_by_id (
  id    uuid PRIMARY KEY,
  email text,
  name  text
);
CREATE TABLE users_by_email (
  email text PRIMARY KEY,
  id    uuid,
  name  text
);
```

- Look up by id → `users_by_id`; look up by email → `users_by_email`. Each query hits one partition.
- **Keep them in sync** on write. If atomicity matters (e.g. email must be unique), use a **logged batch** across the two tables, or an LWT (`IF NOT EXISTS`) on `users_by_email` to enforce uniqueness:

```cql
INSERT INTO users_by_email (email, id, name)
  VALUES ('alice@acme.test', ?, 'alice') IF NOT EXISTS;
```

Duplication is normal and expected in Cassandra — storage is cheap, joins don't exist, and each table exists to serve exactly one query.

### Q6. Model e-commerce order history.

Access patterns: list a customer's orders newest-first, and open a single order. Two tables:

```cql
CREATE TABLE orders_by_customer (
  customer_id uuid,
  order_id    timeuuid,
  total       decimal,
  status      text,
  PRIMARY KEY (customer_id, order_id)
) WITH CLUSTERING ORDER BY (order_id DESC);

CREATE TABLE order_details_by_id (
  order_id  timeuuid,
  line_no   int,
  sku       text,
  qty       int,
  price     decimal,
  PRIMARY KEY (order_id, line_no)
);
```

- **`orders_by_customer`** — partition per customer, orders clustered newest-first; the "my orders" screen is one partition slice.
- **`order_details_by_id`** — partition per order holding its line items; the order-detail screen is one partition read.

If a customer could accumulate a huge order count over years, add a **year bucket** to the first table's partition key (`(customer_id, year)`) to bound growth. Denormalize display fields (total, status) onto `orders_by_customer` so the list view needs no second lookup.

### Q7. You need to query by a non-key column. How?

You do **not** reach for `ALLOW FILTERING`. Three legitimate options, in order of preference:

1. **Make another table** keyed by that column (the query-first default). Want users by `country`? Create `users_by_country ((country), id)` and write to it alongside `users_by_id`.
2. **SAI (Cassandra 5.0)** — attach a storage-attached index for genuine secondary access, including range/text. Good for occasional lookups on an existing table; still a scatter-gather, so not for your highest-throughput path.
3. **Legacy secondary index (2i)** — only for **low-cardinality** columns on modest data; avoid on high-cardinality columns (it degrades badly).

```cql
-- preferred: purpose-built query table
CREATE TABLE users_by_country (
  country text,
  id      uuid,
  name    text,
  PRIMARY KEY (country, id)
);
```

The principle: in Cassandra the *query defines the table*. A new access pattern usually means a new table, not a filter over an existing one.

### Q8. One node is overloaded / you have a hot partition. Diagnose and fix.

**Symptom:** one node shows far higher CPU/load/latency than its peers; `nodetool status` load is lopsided; one partition dominates traffic.

**Diagnosis:** a **hot partition** — the partition key is either **low-cardinality** (few distinct values, so few partitions carry all traffic) or has a **celebrity key** (one value — a viral user, a `status='active'` flag — takes disproportionate reads/writes). All requests for that key hash to the same replicas.

**Fix — increase key cardinality by bucketing:**

```cql
-- before: hot, one partition per popular key
PRIMARY KEY (channel_id, message_id)
-- after: spread across N buckets
PRIMARY KEY ((channel_id, bucket), message_id)   -- bucket = hash(...) % 16, or a time window
```

Adding a time or hash bucket splits the hot key across many partitions/nodes. For a truly celebrity key, hash-bucket it and scatter-gather the small number of buckets on read. Never model a boolean/enum as a partition key — that's the classic low-cardinality trap.

### Q9. Reads are timing out with TombstoneOverwhelmingException. Diagnose and fix.

**Symptom:** reads fail or time out; logs show `TombstoneOverwhelmingException` or "Read N live rows and M tombstone cells".

**Diagnosis:** the read scans a partition full of **tombstones** — almost always a **delete-heavy / queue pattern**: rows are inserted then deleted (a work queue, a "process and remove" table), so a query for live rows wades through thousands of delete markers that can't be reclaimed until `gc_grace_seconds` passes *and* compaction runs.

**Fix — stop deleting; model with expiry instead:**

```cql
-- replace delete-driven queue with TTL + time buckets + TWCS
CREATE TABLE jobs_by_day (
  day  date,
  id   timeuuid,
  body text,
  PRIMARY KEY (day, id)
) WITH default_time_to_live = 86400
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_unit': 'HOURS',
                    'compaction_window_size': 6};
```

Let rows **TTL out** and let **TWCS** drop whole expired SSTables — no per-row tombstone scanning. The blanket rule: **Cassandra is not a queue.** If you're deleting as fast as you insert, the data model is wrong.

### Q10. p99 read latency is spiking. How do you diagnose it?

Read latency is a merge across the memtable and *N* SSTables, so the usual culprits are anything that raises N or slows the merge. Work through them:

- **Too many SSTables / compaction backlog** — check `nodetool compactionstats` and `tablestats` (SSTables per read). A backlog means reads touch many files. Fix: right compaction strategy (LCS for read-heavy, TWCS for time-series), let compaction catch up, check for pending compactions.
- **Wide partitions** — `nodetool tablehistograms` shows partition size/cell counts. A huge partition makes every read expensive. Fix: bucket the partition key.
- **Tombstones** — high tombstone-per-read (Q9). Fix: TTL/TWCS, stop deleting.
- **GC pauses** — JVM stop-the-world pauses spike the tail; check GC logs. Fix: heap tuning, or the ScyllaDB argument (no GC).
- **Consistency level / cross-DC** — reads at QUORUM that reach across DCs eat WAN latency. Fix: LOCAL_QUORUM + token/DC-aware routing.

Method: `nodetool tablehistograms` + `tablestats` + `compactionstats` first — measure which factor dominates before tuning.

### Q11. A partition grew to 5GB. What went wrong and how do you fix it?

**Diagnosis:** an **unbounded partition** — the partition key has no bounding dimension, so an append-only stream under one key grows forever. Classic cause: `PRIMARY KEY (sensor_id, ts)` or `PRIMARY KEY (user_id, event_id)` with no time/hash bucket. Wide partitions blow up read latency, GC, and repair, and risk node instability. Target is roughly **≤100MB** per partition.

**Fix — bound it with a bucket in the partition key:**

```cql
-- before: unbounded
PRIMARY KEY (sensor_id, ts)
-- after: one partition per sensor per day
PRIMARY KEY ((sensor_id, day), ts)
```

Choose the bucket granularity so each partition stays within budget: day for high-rate sensors, month for a chat channel, a hash bucket for a hot key. Migrating existing data means a rewrite into the new schema. The lesson to state: **always ask "what bounds this partition's size?" at modeling time** — an unbounded partition is a latent incident.

### Q12. We're getting stale reads / a deleted row came back. Two problems — diagnose both.

These are two distinct consistency bugs.

**Stale reads (R + W ≤ RF):** if read CL + write CL don't overlap a replica, a read can miss the latest write. Example: write ONE, read ONE, RF 3 — no guaranteed overlap. **Fix:** ensure **R + W > RF**, e.g. LOCAL_QUORUM reads *and* writes at RF 3 (2 + 2 > 3). That guarantees at least one replica in the read set has the newest write.

**A deleted row came back (zombie / resurrected data):** a delete writes a tombstone reclaimed after `gc_grace_seconds` (default 10 days). If a replica **missed the tombstone** (it was down during the delete) and **repair didn't run within gc_grace**, the tombstone is purged from the replicas that had it, and the stale replica's still-live copy resurrects the row on the next read/repair. **Fix:** run **`nodetool repair` on every table within `gc_grace_seconds`** (use Cassandra Reaper to schedule it). The rule: gc_grace is a *deadline* to repair, not just a cleanup timer.

### Q13. This query requires ALLOW FILTERING. Is that OK, and what should you do?

No, it's a design smell. `ALLOW FILTERING` tells Cassandra to **read more data than the query returns** — scan partitions/rows and filter in memory — because the table's key doesn't match the query. It may look fine on a small table and then melt the cluster at scale (unbounded scans, coordinator pressure, timeouts).

**Fix: redesign the table around the query.** If you need users by signup month:

```cql
-- don't: SELECT * FROM users_by_id WHERE month = ? ALLOW FILTERING;
-- do: a table whose key IS the query
CREATE TABLE users_by_month (
  month text,
  id    uuid,
  name  text,
  PRIMARY KEY (month, id)
);
```

Acceptable exceptions are narrow: filtering *within a single partition* you've already restricted by partition key (Cassandra isn't scanning the whole ring), or a genuine one-off admin query you'll run once. As a standing app query path, `ALLOW FILTERING` means the model is wrong — add the table or use SAI.

### Q14. Our bulk-load batch is slow. What's the anti-pattern and the fix?

**Anti-pattern:** using a **multi-partition (logged) BATCH** to load lots of rows, assuming it batches for performance like SQL. It doesn't. A logged batch that spans partitions makes the coordinator responsible for all of them, writes to the **batchlog** (for atomicity) first, and fans out across the ring — it's *slower* and stresses the coordinator.

**Fix: parallel async single-partition writes:**

```java
// don't: one giant BEGIN BATCH ... APPLY BATCH across many partitions
// do: fire independent async prepared inserts, bounded concurrency
List<CompletionStage<AsyncResultSet>> futures = new ArrayList<>();
for (Row r : rows) futures.add(session.executeAsync(ps.bind(r.k, r.v)));
```

Each write goes straight to the replicas that own its partition (token-aware), fully parallel, no batchlog overhead. Use bounded concurrency and idempotent statements. The distinction to state clearly: **logged batches are for atomicity** (keeping denormalized tables in sync, Q5), **never for throughput.** For real bulk loads use async writes or a purpose-built loader.

### Q15. We're using LWT everywhere and it's slow. Why, and what do you do?

**Why:** every lightweight transaction (`IF NOT EXISTS`, `IF col = ?`) runs a **Paxos** consensus round — multiple round trips (prepare/propose/commit) among the replicas, serialized per partition. It's correct but *several times* the cost of a normal write, and using it on a hot path serializes that path.

**Fix — design to avoid it:**

- **Only use LWT where you truly need linearizable compare-and-set** — uniqueness enforcement, claim-a-resource, idempotency guards. Not for ordinary writes.
- **Reduce contention** — if many LWTs hit one partition, they queue on Paxos; spread the contended key or rethink the flow.
- **Prefer natural idempotency** — model so blind writes are safe (e.g. write-once by a unique key, last-write-wins on a versioned column) instead of guarding every write with `IF`.
- **Cassandra 5.0 Accord** — where you genuinely need multi-partition transactions, Accord is the leaderless successor to per-partition LWT.

The senior point: LWT is a scalpel for the few operations that need consensus, not a default. If it's "everywhere", the model leans on consistency guarantees Cassandra makes expensive — redesign to not need them.

### Q16. Cross-region writes are slow. What's the fix?

**Diagnosis:** the writes are using a consistency level that waits on **remote datacenters** — typically plain `QUORUM` (a quorum across *all* DCs, so the coordinator blocks on a WAN round trip) or `EACH_QUORUM` (a quorum in *every* DC). Either way the client pays cross-region latency on the critical path.

**Fix — write at LOCAL_QUORUM and let cross-DC replication happen async:**

```cql
CONSISTENCY LOCAL_QUORUM;   -- quorum in the local DC only
```

Combined with a **DC-aware + token-aware** driver policy (`withLocalDatacenter("dc1")`), the write is acknowledged by local replicas only, and the coordinator forwards to remote DCs asynchronously (one forwarder per remote DC). You get strong local consistency without the WAN tax. Only keep EACH_QUORUM for the rare write that *must* be durable in every region before acknowledging — and accept that it makes you unavailable if any DC is unreachable. For almost everything, LOCAL_QUORUM is the answer.

### Q17. "Should we use Cassandra for this?" — how do you run the check?

Turn it into a fast gut-check that tries to *disqualify* Cassandra first, because the honest default is usually "no":

- **Do you need joins, ad-hoc queries, or ACID across entities?** → Yes ⇒ **not Cassandra** (Postgres). Most services stop here.
- **Do you need aggregations / reporting / BI?** → Yes ⇒ warehouse or Spark, not the OLTP ring.
- **Is the data small-to-moderate and the traffic modest?** → Yes ⇒ a single relational DB is simpler and cheaper.
- **Does your team have ops maturity for repair, compaction, capacity?** → No ⇒ managed relational or DynamoDB.
- **Do you genuinely have huge write volume, very large data, OR an always-on multi-region requirement, with predictable access patterns?** → Yes to these ⇒ **Cassandra is a fit** (or Astra/DynamoDB depending on cloud/ops appetite).

State it as: "Unless you have the write-scale, data-size, or always-on multi-region requirement — and can commit to query-first modeling and the ops burden — this is a Postgres table." Being willing to talk the interviewer *out* of Cassandra is the strongest signal you understand it.
