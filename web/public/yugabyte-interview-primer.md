---
type: interview-prep
---

# YugabyteDB Interview Primer — 334 Questions

Comprehensive Q+A primer for YugabyteDB / distributed-SQL interviews. A Databases-category companion to the Postgres, Cassandra, and Redis primers — the open-source distributed SQL (NewSQL) database: a PostgreSQL-compatible + Cassandra-compatible query layer over a Spanner-inspired, Raft-replicated storage engine (DocDB). Covers the architecture, sharding & tablets, replication & Raft, consistency & distributed transactions, hybrid logical clocks, YSQL & YCQL, data modeling, indexes & query execution, multi-region & geo-distribution, HA, tuning, operations, the alternatives landscape, and design playbooks.

Each answer is interview-shaped: opinionated, concrete, real YSQL/YCQL and `yb-admin`, architecture internals, failure modes, and the sharding/geo anti-patterns that matter. Current YugabyteDB; contrasts with Postgres, CockroachDB, Spanner, Aurora, and Cassandra where it clarifies.

1. [[#YugabyteDB Fundamentals & Architecture]]
2. [[#Distributed SQL & the NewSQL Landscape]]
3. [[#Cluster Architecture: YB-Master & YB-TServer]]
4. [[#DocDB: The Storage Engine]]
5. [[#Sharding & Tablets]]
6. [[#Data Distribution, Placement & Replication Factor]]
7. [[#Replication & Raft Consensus]]
8. [[#Consistency & Isolation Levels]]
9. [[#Distributed Transactions Deep Dive]]
10. [[#Hybrid Logical Clocks & Time]]
11. [[#YSQL — PostgreSQL Compatibility]]
12. [[#YSQL Data Modeling & Schema Design]]
13. [[#YCQL — the Cassandra-Compatible API]]
14. [[#Indexes & Query Performance]]
15. [[#Query Execution & Pushdowns]]
16. [[#Multi-Region & Geo-Distribution]]
17. [[#High Availability & Failure Handling]]
18. [[#Performance Tuning & Scaling]]
19. [[#Operations & Deployment]]
20. [[#YugabyteDB vs Alternatives & Ecosystem]]
21. [[#Scenario & Data-Modeling Playbooks]]

---

## YugabyteDB Fundamentals & Architecture

### Summary

**What this topic covers**

The 30-second-and-30-minute answers to "what is YugabyteDB?" This is the warm-up topic every YugabyteDB interview opens with, and getting it crisp buys you credibility for everything harder that follows. Three concern areas live here: (1) the **category** — YugabyteDB is an open-source (Apache 2.0) **distributed SQL** database, and you need to be able to say what "distributed SQL" means and why it's a real category, not marketing; (2) the **architecture at a glance** — two query APIs (**YSQL**, **YCQL**) over one distributed storage engine (**DocDB**), sharded into tablets, each a Raft group, all running on a symmetric cluster of nodes with no data-plane master bottleneck; and (3) the **judgment** — when YugabyteDB is the right tool (Postgres workloads outgrowing a single node, needing HA and/or geo-distribution) and, just as important, when it is the *wrong* tool (a single small dataset where vanilla Postgres is simpler and lower-latency). The 16 questions here range from "is it just Postgres?" to "walk me through the architecture."

**Mental model**

Think of YugabyteDB as **"scale-out PostgreSQL that never has a single point of failure."** Picture three layers stacked on a cluster of identical nodes. At the top, a **query layer**: for YSQL this is *literally the real PostgreSQL query engine* (parser, planner, executor) running on each node, so joins, indexes, foreign keys, triggers, and extensions work. Under it, **DocDB** — a distributed document store that shards every table by primary key into **tablets** and spreads them across nodes. Under each tablet, **Raft consensus** replicating it (RF=3) to a majority before any write is acknowledged, giving strong consistency and automatic leader failover. At the bottom, a per-tablet **RocksDB** LSM-tree persisting the bytes. The key mental shift from single-node Postgres: there is no one "primary" server. Every node hosts data *and* can serve queries; the metadata "brain" (YB-Master) is deliberately kept out of the read/write path so it can never become a per-request bottleneck. You scale by adding nodes; you survive failures because any tablet's followers can elect a new leader in seconds.

**Key terms**

- **Distributed SQL / NewSQL** — SQL + ACID transactions of a traditional RDBMS, plus the horizontal scale-out and fault tolerance of NoSQL. YugabyteDB's category.
- **YSQL** — the PostgreSQL-compatible API; reuses the actual PostgreSQL query layer, so it is a *reuse* of Postgres, not a reimplementation.
- **YCQL** — the Cassandra-Query-Language-compatible, semi-relational API for wide-row/high-throughput workloads.
- **DocDB** — the distributed document store all APIs sit on: sharded, replicated, MVCC, built on customized RocksDB.
- **Tablet** — a shard of a table (a contiguous or hashed range of the primary key); the unit of replication and Raft consensus.
- **Raft** — the consensus protocol replicating each tablet to a majority quorum; source of strong consistency and no-SPOF failover.
- **Universe** — a YugabyteDB deployment: the primary data cluster plus any read-replica clusters.
- **YB-Master / YB-TServer** — control plane (metadata, load balancing) vs data plane (tablets + query layer).
- **RF (replication factor)** — copies of each tablet, typically 3; tolerates ⌊RF/2⌋ node failures.
- **Strong consistency (CP)** — YugabyteDB is a CP system: it stays consistent under partition, sacrificing some availability rather than serving stale/split-brain data.
- **Google Spanner lineage** — the design blueprint (globally-distributed, consistent SQL) YugabyteDB follows, married to PostgreSQL heritage for the SQL layer.

**Why interviewers ask this**

The opening "what is YugabyteDB" question is a filter. A junior answer is "a database" or "like Postgres but in the cloud." A senior answer names the category (distributed SQL), the one-sentence value prop (ACID + SQL + horizontal scale + strong consistency + no SPOF), the two-APIs-one-engine shape, and the Spanner-plus-Postgres lineage — in under a minute. The *when-NOT-to-use-it* half is the real senior signal: candidates who reach for distributed SQL for a 5GB single-region app are showing they optimize for résumé, not for the workload. Interviewers also probe whether you understand that YSQL *reuses* Postgres rather than merely being "wire-compatible" — that single fact explains most of what YSQL can and can't do.

**Common confusions**

- "It's just Postgres with replication" — no; it's a from-scratch distributed storage engine (DocDB/Raft) that happens to reuse Postgres's *query layer*. Streaming replication and a single writer are exactly what it replaces.
- "Distributed SQL means eventual consistency" — the opposite. YugabyteDB is strongly consistent (CP). Eventual consistency is the NoSQL tradeoff it was built to avoid.
- "YCQL is Cassandra" — it's Cassandra-*compatible* API surface, but strongly consistent with distributed transactions and global secondary indexes underneath.
- "It uses TrueTime like Spanner" — no; YugabyteDB uses Hybrid Logical Clocks + NTP within a bounded clock skew, not Google's atomic-clock TrueTime.
- "More nodes = always faster" — scale-out adds throughput and capacity, but a single-region multi-node cluster can be *slower* per-operation than one Postgres box because writes pay Raft quorum latency.

**What follows from this topic**

This is the trunk everything branches from. The "distributed SQL / NewSQL landscape" topic zooms out to peers (CockroachDB, Spanner, TiDB, Aurora) and the CAP positioning sketched here. The "YB-Master & YB-TServer" topic zooms *in* on the two-role cluster architecture. Later topics unpack DocDB, tablets, hash-vs-range sharding, Raft replication, distributed transactions, YSQL-vs-YCQL, and multi-region deployment — all of which are just the layers of the mental model above, examined one at a time. If you can't give the one-minute architecture answer yet, anchor it here before going deeper.

### Q1. What is YugabyteDB in one or two sentences?

YugabyteDB is an **open-source (Apache 2.0), distributed SQL database** — it gives you ACID transactions, SQL, and strong consistency (the relational guarantees) together with horizontal scale-out and no single point of failure (the NoSQL operational wins). It's inspired by Google Spanner and reuses the PostgreSQL query layer, so the elevator pitch is **"scale-out PostgreSQL that survives node and region failures without giving up SQL or consistency."**

### Q2. What problem does YugabyteDB solve? Who reaches for it?

The core problem: **you have a relational/PostgreSQL workload that has outgrown a single node, but you refuse to give up SQL, joins, and ACID.**

Traditional Postgres scales *up* (a bigger box) and *out* only for reads (replicas). Once writes, data volume, or availability requirements exceed one primary, teams historically had two bad options:

- **Manually shard Postgres** — application-level sharding, cross-shard joins and transactions become your problem, and rebalancing is a project.
- **Move to NoSQL** — get scale, but lose SQL, joins, multi-row ACID, and strong consistency, pushing that complexity back into every app.

YugabyteDB's pitch is "you shouldn't have to choose": keep the Postgres programming model, get automatic sharding, replication, HA, and (optionally) geo-distribution underneath. Typical adopters: SaaS platforms scaling past a single Postgres, systems needing multi-region HA or data residency, and workloads that want Postgres features *and* elastic scale.

### Q3. Is YugabyteDB just PostgreSQL? What does "reuses the PostgreSQL query layer" mean?

It is **not** just Postgres, but the YSQL API is closer to Postgres than any competitor because it **reuses the actual PostgreSQL source code for the query layer** — the parser, planner/optimizer, and executor are Postgres's own, forked and kept in sync.

What that buys you: real joins, secondary indexes, foreign keys, constraints, triggers, stored procedures, `EXPLAIN`, many extensions, and PostgreSQL wire-protocol compatibility (existing drivers, ORMs, and `psql`/`ysqlsh` just work).

What's *different*: below the query layer, Postgres's single-node storage (heap tables, the buffer manager, streaming replication, MVCC-on-a-single-box) is **entirely replaced** by DocDB — a distributed, sharded, Raft-replicated store. So SQL semantics are Postgres; storage, replication, and scaling are not. That split is the single most useful fact to internalize: *Postgres on top, distributed engine underneath.*

### Q4. What are the two query APIs, and why does one storage engine serve both?

| | **YSQL** | **YCQL** |
|---|---|---|
| Model | PostgreSQL-compatible relational | Cassandra-CQL-compatible, semi-relational |
| Query layer | Reuses real PostgreSQL engine | Yugabyte-built CQL layer |
| Best for | Joins, transactions, relational apps | Wide rows, high-throughput, key-based access |
| Consistency | Strong | Strong (unlike Cassandra's tunable/eventual) |

Both APIs sit on the **same DocDB** distributed document store. That means sharding, Raft replication, strong consistency, MVCC, and fault tolerance are implemented **once**, in DocDB, and inherited by both APIs. You pick the API that fits the workload's data model without re-choosing the storage/consistency stack. Most greenfield relational work uses YSQL; YCQL suits Cassandra-shaped workloads that want strong consistency.

### Q5. What is DocDB?

**DocDB** is YugabyteDB's distributed document store — the layer that turns a cluster of nodes into one logical database. Its responsibilities:

- **Sharding**: split each table by primary key into **tablets** and distribute them across nodes.
- **Replication**: replicate each tablet (RF=3) via its own **Raft** group.
- **Persistence**: store each tablet's data in a per-tablet, heavily customized **RocksDB** (an LSM-tree engine).
- **MVCC**: multi-version concurrency using **hybrid-time** timestamps so readers and writers don't block each other and snapshots are consistent.

Both YSQL and YCQL translate their operations into DocDB read/write operations. When people say "the distributed part of YugabyteDB," they mean DocDB plus Raft.

### Q6. Walk me through the layered architecture from a query to disk.

Top to bottom, a write flows like this:

1. **Query layer** — a client connects to a node's YSQL (Postgres) or YCQL process, which parses/plans/executes the statement.
2. **DocDB routing** — the statement is turned into key-value operations; DocDB finds which **tablet** owns those keys (by hash or range of the primary key) and routes to that tablet's **leader**.
3. **Raft consensus** — the tablet leader replicates the write to its followers and waits for a **majority quorum** to persist it before acknowledging → strong consistency + durability, and automatic leader re-election if the leader dies.
4. **RocksDB** — each replica persists the change in its local LSM-tree (memtable → WAL → SSTables).

Reads by default go to the tablet **leader** (linearizable); optionally **follower reads** trade a bounded staleness for lower/local latency. Four layers: **query → DocDB → Raft → RocksDB.**

### Q7. How does YugabyteDB achieve strong consistency and avoid a single point of failure?

Two mechanisms, both from the Raft-per-tablet design:

**Strong consistency** — every write is committed through Raft to a **majority of the tablet's replicas** before the client gets an ack. A committed write is on a quorum, so any subsequent read (from the leader) sees it. There's no window where an acknowledged write can be lost or where two nodes disagree about the latest value.

**No single point of failure** — each tablet has its own leader, and leadership is spread across the cluster; there is no global primary. If a node (and the tablet leaders it hosts) dies, the affected tablets' followers **automatically elect a new leader** in seconds and serving continues. The metadata brain (YB-Master) runs as its own Raft group of 3 and is *not* in the data path, so even losing a master leader doesn't stop reads and writes. Failure of any single node degrades capacity, not availability.

### Q8. What's the Google Spanner connection, and how does YugabyteDB differ from Spanner?

YugabyteDB is a **Spanner-inspired** design: globally-distributed, horizontally-scalable, strongly-consistent SQL, sharded into ranges/tablets and replicated by a consensus protocol. Spanner (the 2012 Google paper and product) is the blueprint the whole distributed-SQL category follows.

The headline difference is **clocks**. Spanner uses **TrueTime** — GPS/atomic-clock hardware giving tightly-bounded time uncertainty, plus "commit-wait" — to order transactions globally. YugabyteDB uses **Hybrid Logical Clocks (HLC)** over ordinary servers with **NTP** and a configured `max_clock_skew`, avoiding special hardware at the cost of relying on bounded skew.

Other differences: Spanner is proprietary/managed-only (Google Cloud); YugabyteDB is **open-source (Apache 2.0)** and self-hostable, and its SQL layer is **PostgreSQL** (reused source), giving broad Postgres feature/ecosystem compatibility rather than Spanner's own SQL dialect.

### Q9. Where does YugabyteDB sit on CAP? Is it CP or AP?

**CP** — consistent and partition-tolerant. Under a network partition, YugabyteDB chooses **consistency over availability**: a tablet whose leader can't reach a majority stops accepting writes rather than risk split-brain or stale acknowledged data. The minority side becomes unavailable for those tablets until the partition heals or a new leader is elected on the majority side.

Contrast **Cassandra**, which is **AP** (stays available, may serve stale/conflicting data, resolves later). YugabyteDB was built specifically to *not* make that tradeoff.

The more precise framing is **PACELC**: under a Partition it's PC (consistency); Else (normal operation) it leans toward Consistency but exposes **follower reads** as an opt-in latency-for-staleness knob when you want it. So the default is "never lie about data," with explicit escape hatches.

### Q10. When should you use YugabyteDB — and when should you not?

**Use it when** you have at least one of:

- A PostgreSQL/relational workload **outgrowing a single node** (write throughput, data volume, or connection scale).
- A hard **high-availability** requirement (survive node/AZ/region failure with automatic failover, no manual promotion).
- **Multi-region** needs — geo-distribution, low local latency in several regions, or **data residency** (pin certain rows to certain regions).
- A desire to keep **SQL + ACID + joins** while scaling out, instead of manually sharding Postgres or migrating to NoSQL.

**Don't use it when**:

- Your data fits comfortably on **one Postgres node** and will for the foreseeable future — vanilla Postgres is simpler, cheaper, and **lower-latency** per operation.
- You're **single-region and latency-critical** with no scale or HA pressure — the Raft-quorum write path adds latency a single primary doesn't pay.
- You have **no need for horizontal scale or continuous availability** — you'd be buying distributed-systems operational complexity for benefits you won't use.

The senior instinct: **don't reach for distributed SQL until a single Postgres is actually the bottleneck.**

### Q11. Give the "walk me through the architecture" answer an interviewer wants.

"YugabyteDB is a distributed SQL database built as a symmetric cluster of nodes with two server roles. **YB-TServers** are the data plane: each hosts a set of **tablets** — shards of your tables by primary key — and each tablet is replicated three ways as its own **Raft** group with a leader and two followers. TServers also run the **query layer**, which for YSQL is the real PostgreSQL engine, so clients connect to any node and get full SQL. **YB-Masters** are the control plane — a separate Raft group of three that holds metadata, tablet placement, and runs the load balancer, but is *not* in the read/write path. A write hits a node's query layer, gets routed to the owning tablet's leader, is committed to a Raft majority, and persisted in each replica's RocksDB. Reads go to the leader by default, or to followers for bounded-staleness local reads. You scale by adding TServers; you survive failures because any tablet re-elects a leader automatically. There's no single point of failure and consistency is strong."

That's the whole system in one breath — expand any clause on request.

### Q12. How is YugabyteDB distributed — packaging, editions, and the company behind it?

**Core** — YugabyteDB is fully open-source under **Apache 2.0**; you can run the database itself for free, self-hosted, forever.

**YugabyteDB Anywhere** — a commercial self-managed control plane (formerly "Platform") for operating YugabyteDB across your own infrastructure/Kubernetes/clouds: automated deploys, upgrades, backups, monitoring.

**YugabyteDB Aeon** (formerly "Managed") — the fully-managed cloud **DBaaS** run by Yugabyte on the major clouds; you consume the database, they operate it.

The company is **Yugabyte**, founded by ex-Facebook engineers who had built and operated large-scale distributed data infrastructure. There's an active open-source community, public Slack/forum, and the code is on GitHub. For interviews: know that the *engine* is open-source and the *managed/enterprise operations tooling* is where the commercial offering sits.

### Q13. Why is "distributed SQL" considered its own database category?

Because it's a genuinely different set of tradeoffs from the categories on either side of it:

- **Traditional RDBMS** (single-node Postgres/MySQL/Oracle): great SQL + ACID, but scale *up* only and a single point of failure.
- **NoSQL** (Cassandra, Mongo, DynamoDB): great scale-out + availability, but sacrifice SQL, joins, multi-row ACID, and/or strong consistency.
- **Distributed SQL** (YugabyteDB, CockroachDB, Spanner, TiDB): keep SQL + ACID + strong consistency **and** get horizontal scale-out + fault tolerance.

The category exists because doing *both* required new engineering — automatic sharding, consensus replication per shard, and distributed transactions — rather than bolting replication onto a monolith. It's sometimes called **NewSQL**. The one-line justification: "SQL and ACID at scale, with no single point of failure" wasn't achievable with either older category, so the market named the thing that achieves it.

### Q14. At a glance, how does YugabyteDB compare to Postgres, Cassandra, and Spanner?

| | **Postgres** | **Cassandra** | **Spanner** | **YugabyteDB** |
|---|---|---|---|---|
| Model | Relational SQL | Wide-column NoSQL | Distributed SQL | Distributed SQL |
| Scale | Up (out for reads) | Out | Out | Out |
| Consistency | Strong (1 node) | Tunable/eventual (AP) | Strong (CP) | Strong (CP) |
| SPOF | Yes (primary) | No | No | No |
| SQL / joins | Full | No (CQL) | SQL dialect | Full (reuses PG) |
| Clocks | n/a | n/a | TrueTime (atomic) | HLC + NTP |
| Licensing | Open source | Open source | Proprietary | Open source (Apache 2.0) |

The shorthand: **YugabyteDB = Postgres's SQL + Cassandra-class scale-out + Spanner's consistency model, open-source, without atomic clocks.** Each row is a topic on its own later in the primer.

### Q15. Does YugabyteDB support geo-distribution, and what does it enable?

Yes — geo-distribution is a first-class capability and often the reason teams choose it over a single Postgres. At a high level it enables:

- **Multi-region HA** — replicas across regions so you survive an entire region failure with automatic failover.
- **Data residency / geo-partitioning** — pin specific rows to specific regions (e.g. EU users' data physically stays in EU) via tablespaces, satisfying compliance while keeping local latency.
- **Local latency** — place tablet leaders or read replicas near users; **follower reads** serve bounded-stale data from a nearby replica.
- **Async DR / active-active** — **xCluster** replication between clusters for disaster recovery or two-region active-active.

The tradeoff to name in the same breath: a synchronously-stretched cluster makes writes pay **cross-region Raft round-trips**, so multi-region design is about choosing which writes pay that cost. The mechanisms (geo-partitioning, follower reads, xCluster) are detailed in the multi-region topic later.

### Q16. What are the headline features that define YugabyteDB? Give the checklist.

The features an interviewer wants to hear enumerated:

- **PostgreSQL-compatible SQL (YSQL)** by reusing the real PG query layer — joins, FKs, indexes, triggers, extensions, transactions.
- **Horizontal scale-out** — add nodes to grow throughput and capacity linearly; automatic sharding into tablets.
- **Strong consistency** — Raft-per-tablet, majority-quorum writes; a CP system.
- **Continuous availability / no SPOF** — automatic leader failover, no single primary, resilient to node/AZ/region loss.
- **ACID transactions**, including **distributed** multi-shard transactions, at Snapshot/Serializable/Read-Committed isolation.
- **Two APIs, one engine** — YSQL and YCQL over DocDB.
- **Geo-distribution** — multi-region, geo-partitioning for residency, follower reads, xCluster async replication.
- **Open source (Apache 2.0)** with managed (Aeon) and self-managed (Anywhere) options.
- **Cloud-native ops** — Kubernetes operator, rolling upgrades, distributed backups/PITR.

If you can rattle off that list and then defend any item, you've passed the fundamentals screen.

## Distributed SQL & the NewSQL Landscape

### Summary

**What this topic covers**

Zooming out from YugabyteDB to the *category* it lives in, so you can situate it against everything else an interviewer might name. This is the "why does this class of database exist and who are the players" topic. Three concern areas: (1) the **definition and history** — what "NewSQL"/distributed SQL means, and the traditional-RDBMS → NoSQL → NewSQL arc that produced it; (2) the **theory** — CAP and PACELC, why distributed SQL chooses CP, and the Google Spanner paper as the lineage the whole category descends from; and (3) the **map** — the peers (CockroachDB, Spanner, TiDB, Aurora, Citus, Vitess), how they differ from each other and from YugabyteDB, and the tradeoffs you accept when you pick distributed SQL over a single Postgres you shard yourself. The 16 questions run from "what is NewSQL" to "why choose distributed SQL over manual sharding, and what does it cost you."

**Mental model**

Databases have swung on a pendulum. **Traditional RDBMS** (Oracle, Postgres, MySQL) gave us SQL + ACID but scale by getting a bigger single box, with the primary as a single point of failure. When web-scale outgrew the biggest box, **NoSQL** (Dynamo, Cassandra, MongoDB) scaled *out* across commodity nodes — but paid for it by dropping SQL, joins, multi-row ACID, and often strong consistency, pushing that complexity into every application. **NewSQL / distributed SQL** is the pendulum swinging back with new engineering: keep the SQL + ACID + strong consistency of the RDBMS, but get the horizontal scale-out and fault tolerance of NoSQL, by **sharding data and replicating each shard with a consensus protocol**. The mental anchor: distributed SQL is "have your cake and eat it" made real by two ideas — automatic sharding and per-shard consensus (Raft/Paxos) — plus distributed transactions to glue shards together. Everything in the landscape is a variation on *how* a given product does those three things and *which* SQL dialect it speaks.

**Key terms**

- **NewSQL / distributed SQL** — RDBMS guarantees (SQL, ACID, strong consistency) plus NoSQL scale-out and fault tolerance.
- **Scale up vs scale out** — bigger single machine (RDBMS) vs more machines (NoSQL/NewSQL).
- **CAP theorem** — under a network partition you must choose Consistency or Availability; you can't have both.
- **CP vs AP** — distributed SQL chooses CP (consistency); Dynamo-style NoSQL chooses AP (availability).
- **PACELC** — extends CAP: under Partition choose C or A; Else (no partition) choose Latency or Consistency.
- **Google Spanner** — the 2012 globally-distributed, externally-consistent SQL database; the blueprint for the category (TrueTime clocks).
- **Consensus replication** — Raft/Paxos committing each write to a majority; the source of strong consistency at scale.
- **Sharding** — splitting data by key across nodes; automatic in distributed SQL, manual in a sharded monolith.
- **CockroachDB** — the closest peer: open-source, Postgres-flavoured distributed SQL.
- **TiDB** — MySQL-compatible distributed SQL (separate storage layer, TiKV).
- **Amazon Aurora** — cloud RDBMS with shared distributed *storage* but a **single writer** — often lumped in, architecturally different.
- **Citus / Vitess** — sharding *middleware/extensions* over Postgres/MySQL — not full distributed SQL.

**Why interviewers ask this**

Placing YugabyteDB in its landscape shows you chose it for reasons, not hype. A junior can define YugabyteDB; a senior can say *why* the NewSQL category exists, *what it costs*, and *which alternative* they'd pick for a given workload. The CAP question specifically separates people who've memorized "CA/CP/AP" from people who understand that "CA" is meaningless in a distributed system (partitions are not optional) and that the real choice under partition is C-or-A. The Aurora-vs-YugabyteDB distinction is a favorite trap: both are "distributed" but one is single-writer shared-storage and the other is shared-nothing multi-writer — conflating them is a tell. And "why not just shard Postgres yourself?" tests whether you appreciate the operational reality distributed SQL automates.

**Common confusions**

- "NewSQL means it's faster than Postgres" — no; per-operation it's often *slower* (consensus latency). It's about scale and availability, not raw single-op speed.
- "CAP lets you pick CA" — not in a real distributed system. Partitions happen; you only choose C or A when one does. "CA" describes a single node.
- "Aurora is distributed SQL" — Aurora distributes *storage* but has a single writer node; it's a scaled-up RDBMS, not shared-nothing distributed SQL.
- "Vitess/Citus are the same thing as YugabyteDB" — they're sharding layers over an existing DB; cross-shard transactions and consistency are weaker/bolted-on, not native.
- "Distributed SQL removes all the hard parts" — it automates sharding and replication, but adds cross-node latency, distributed-transaction cost, and clock/consistency subtleties you must still design around.

**What follows from this topic**

This is the context that makes YugabyteDB's specific choices legible. The CP stance here is realized concretely by Raft-per-tablet (replication topic) and distributed transactions (transactions topic). The Spanner lineage explains the HLC-vs-TrueTime clock discussion in fundamentals and multi-region. The peer comparisons (especially CockroachDB) recur whenever an interviewer asks "why YugabyteDB over X." Read the fundamentals topic for what YugabyteDB *is*; read this for the *category and competitors*; then the cluster-architecture topic shows *how* YugabyteDB implements the CP, shared-nothing, consensus-replicated design the whole category shares.

### Q1. What is "NewSQL" / distributed SQL, and why does it exist?

**NewSQL** (largely synonymous with **distributed SQL**) is a class of databases that keep the **SQL interface and ACID transactions** of a traditional relational database while adding the **horizontal scalability and fault tolerance** of NoSQL systems. The goal is explicitly "best of both": you don't give up joins, transactions, or strong consistency to get scale-out and high availability.

It exists because neither older category could deliver both:

- Traditional RDBMS gave SQL + ACID but scaled *up* and had a single-node ceiling and a single point of failure.
- NoSQL scaled *out* and stayed available, but dropped SQL, joins, and multi-row ACID, forcing that logic into applications.

NewSQL closes the gap with new engineering — automatic sharding + consensus replication + distributed transactions — so you get relational guarantees at distributed scale. YugabyteDB, CockroachDB, Google Spanner, and TiDB are the canonical members.

### Q2. Tell the historical arc: RDBMS → NoSQL → NewSQL.

**1. Traditional RDBMS (1980s–2000s)** — Oracle, DB2, Postgres, MySQL. SQL, ACID, joins, strong consistency — but designed for a single node. You scale by buying a bigger machine (scale *up*), and the primary is a single point of failure. Eventually web-scale workloads outgrew the biggest available box.

**2. NoSQL (mid-2000s on)** — triggered by papers like Amazon **Dynamo** and Google **Bigtable**; products like **Cassandra**, **MongoDB**, **DynamoDB**. These scaled *out* across commodity nodes and stayed highly available, but achieved it by **abandoning** SQL, joins, multi-row ACID, and (often) strong consistency in favor of eventual consistency. Scale went up; application complexity went up with it, because consistency and relationships became the app's problem.

**3. NewSQL / distributed SQL (2012 on)** — Google's **Spanner** paper showed you *could* have globally-distributed, strongly-consistent SQL. **YugabyteDB**, **CockroachDB**, and **TiDB** followed. They **bring back SQL + ACID + strong consistency** but keep the scale-out and fault tolerance, using sharding and consensus replication. The arc is a pendulum: scale-out cost us relational guarantees, and NewSQL bought them back at scale.

### Q3. Explain the CAP theorem and where distributed SQL sits.

**CAP**: in the presence of a network **P**artition, a distributed system can guarantee **C**onsistency or **A**vailability, but not both. (Absent a partition, this forced choice doesn't apply — which is why "CA" isn't a real operating mode for a distributed database.)

Distributed SQL like YugabyteDB chooses **CP**: under a partition it preserves **consistency** and sacrifices availability on the minority side — a tablet whose leader can't reach a majority stops serving writes rather than risk stale or split-brain data. When the partition heals (or a new leader forms on the majority side), availability returns, and no acknowledged write was ever lost or contradicted.

Contrast **Cassandra/Dynamo (AP)**: they stay available on both sides of a partition and accept temporary inconsistency, reconciling later. The whole point of NewSQL is to *avoid* that reconciliation burden. So the interview soundbite: **"YugabyteDB is CP — it will make a minority partition unavailable before it will lie to you."**

### Q4. CAP is coarse. What does PACELC add?

**PACELC** refines CAP to describe behavior *when there's no partition too*: "if **P**artition, choose **A** or **C**; **E**lse (normal operation), choose **L**atency or **C**onsistency."

It matters because CAP only talks about partitions, which are rare, while the everyday tradeoff is **latency vs consistency**. A strongly-consistent read must go to the leader and may cross the network/region (higher latency); a lower-latency read might accept slightly stale data.

YugabyteDB is **PC/EC** by default — consistent under partition, and consistent-by-default in normal operation (reads served by the tablet leader are linearizable). But it exposes an **EL** escape hatch: **follower reads** let you opt into bounded-staleness reads from a nearby replica for lower latency when a specific query can tolerate it. So the honest characterization is "consistent by default, with an explicit latency-for-staleness knob," which is exactly the PACELC framing an interviewer is fishing for.

### Q5. Why is the Google Spanner paper the lineage of this whole category?

Google's 2012 **Spanner** paper demonstrated something the industry thought was impractical: a **globally-distributed, horizontally-scalable, strongly-consistent (externally consistent) SQL database.** It sharded data into ranges, replicated each range with **Paxos** consensus, ran distributed transactions with two-phase commit, and used **TrueTime** — GPS/atomic-clock hardware exposing bounded time uncertainty — to globally order transactions.

That paper is the **blueprint** for distributed SQL. **YugabyteDB** and **CockroachDB** are essentially open-source, commodity-hardware realizations of the Spanner design: shard + consensus-replicate + distributed transactions + strong consistency at scale. The main thing they change is the clock — instead of TrueTime's special hardware, they use **Hybrid Logical Clocks + NTP** within a bounded skew. So when you explain YugabyteDB's architecture, you're describing Spanner's ideas adapted to run anywhere without atomic clocks.

### Q6. How does scale-out actually work conceptually in distributed SQL?

Two ideas, composed:

**1. Sharding** — the data is automatically partitioned by key into shards (YugabyteDB calls them **tablets**). Each shard owns a subset of the rows, and shards are spread across nodes. Adding nodes lets you spread more shards, so **capacity and throughput grow with the cluster** — that's the "scale-out."

**2. Consensus replication per shard** — each shard is replicated (typically 3×) and its replicas run a consensus protocol (**Raft** in YugabyteDB, Paxos in Spanner). Writes commit to a **majority**, giving strong consistency and automatic failover *per shard* rather than for the whole database. Because consensus is per-shard, different shards' leaders live on different nodes, distributing both data and leadership.

**3. Distributed transactions** — when one transaction touches multiple shards, a two-phase-commit-style protocol coordinates them so ACID holds across shards.

The elegance: consistency and availability are solved once, per shard, and the database scales by having *more shards on more nodes*.

### Q7. Who are YugabyteDB's peers, and how do they differ?

| Product | SQL flavor | Architecture | Note |
|---|---|---|---|
| **CockroachDB** | PostgreSQL-flavoured | Shared-nothing, Raft, distributed txns | Closest peer; own SQL engine, not PG source reuse |
| **Google Spanner** | Spanner SQL | Shared-nothing, Paxos, **TrueTime** | The proprietary original; GCP-only |
| **TiDB** | MySQL-compatible | Compute (TiDB) + storage (TiKV) split | Separate stateless SQL tier over TiKV |
| **Amazon Aurora** | PG/MySQL-compatible | Shared distributed **storage**, single writer | Scaled-*up* RDBMS, not shared-nothing |
| **Citus** | PostgreSQL | Sharding **extension** on Postgres | Coordinator + workers; not native distributed SQL |
| **Vitess** | MySQL | Sharding **middleware** over MySQL | Powers YouTube; middleware, not one engine |

**How YugabyteDB differs**: it reuses the **actual PostgreSQL query layer** (the deepest PG compatibility of the group), is fully **open-source (Apache 2.0)**, runs **shared-nothing** with **Raft-per-tablet**, and offers **two APIs** (YSQL + YCQL) over one engine. CockroachDB is the nearest neighbor; the real differentiators are PG-source reuse and the dual API.

### Q8. YugabyteDB vs CockroachDB — how do you tell them apart?

They're the two closest members of the category — both open-source, Postgres-flavoured, shared-nothing distributed SQL with consensus-replicated shards, distributed transactions, and HLC-style clocks. Differences that matter:

- **PostgreSQL compatibility**: YugabyteDB **reuses PostgreSQL's actual query-layer source code**, so PG feature/extension compatibility tends to be broader and more literal. CockroachDB **reimplements** a PG-compatible SQL layer from scratch — wire-compatible, but its own engine.
- **APIs**: YugabyteDB offers **YSQL and YCQL** (a Cassandra-compatible API) on the same engine; CockroachDB is SQL-only.
- **Storage engine framing**: YugabyteDB layers YSQL/YCQL over **DocDB** (customized RocksDB); CockroachDB uses its own Pebble-based store.
- **Licensing history**: YugabyteDB core is Apache 2.0; CockroachDB moved its core to a more restrictive (BSL) license.

For interviews: "same category, same core ideas; YugabyteDB reuses real Postgres and adds a Cassandra API, Cockroach reimplements Postgres compatibility — and the licenses differ."

### Q9. Why is Amazon Aurora usually a different animal, even though it's called "distributed"?

Aurora is frequently listed alongside distributed SQL because it's cloud-native and "distributed," but the architecture is fundamentally different:

- Aurora distributes the **storage layer** — a log-structured, 6-way-replicated shared storage fabric across AZs — but the **compute** side is a **single primary writer** (plus read replicas). All writes funnel through one writer node.
- YugabyteDB is **shared-nothing** and **multi-writer**: data is sharded and *every* node can accept writes for the tablets it leads; there's no single writer.

Consequences: Aurora scales **reads** well and gives durable, HA storage, but **write throughput is bounded by one node** and it doesn't horizontally scale writes the way distributed SQL does. It's best understood as a **very good scaled-up RDBMS with distributed storage**, not a shared-nothing distributed SQL database. Conflating the two is a classic interview trap.

### Q10. How are Citus and Vitess different from true distributed SQL?

Both are **sharding layers** over an existing single-node database rather than a ground-up distributed engine:

- **Citus** — a **PostgreSQL extension** that shards tables across a coordinator + worker Postgres nodes. Great for scaling certain (especially multi-tenant/analytics) Postgres workloads, but it's Postgres-with-sharding-bolted-on: cross-shard transactions and some SQL are more constrained, and it's not a symmetric shared-nothing consensus system.
- **Vitess** — **middleware** in front of many MySQL instances (famously scaling YouTube). It routes and shards queries across MySQL shards, but the underlying nodes are still MySQL; distributed transactions and consistency guarantees are weaker/more manual than native distributed SQL.

The distinction: in **YugabyteDB** sharding, consensus replication, distributed transactions, and strong consistency are **native, automatic, and symmetric** — one engine. Citus/Vitess **coordinate** a fleet of traditional single-node databases. The interview line: "middleware/extension sharding vs a purpose-built distributed SQL engine."

### Q11. What are the real tradeoffs of distributed SQL versus a single Postgres?

Distributed SQL is not free. Name these honestly:

- **Cross-node / cross-region latency** — a write must reach a **Raft majority**, so it pays at least one extra network round-trip; if replicas span regions, that round-trip is tens of milliseconds. A single Postgres commit is local.
- **Distributed-transaction cost** — transactions spanning multiple shards need a two-phase-commit-style coordination (write intents, a status tablet), which is more expensive than a single-node commit.
- **Operational complexity** — more moving parts (masters, tservers, tablets, rebalancing, clock skew) than one Postgres process, even though much is automated.
- **Higher single-op latency** — for a workload that fits one node, distributed SQL is usually **slower per operation** than that one node.

The payoff you're buying: horizontal scale, no single point of failure, and geo-distribution. The senior framing: "you trade a bit of latency and complexity for scale and availability — only worth it once a single node is actually the constraint."

### Q12. Why choose distributed SQL over manually sharding your own Postgres?

If you shard Postgres yourself, **you** own everything distributed SQL automates, forever:

- **Shard placement and routing** — deciding which rows live where, and building the routing layer.
- **Rebalancing** — moving data when shards get hot or you add capacity, usually with downtime or bespoke tooling.
- **Cross-shard transactions and joins** — implementing 2PC and scatter-gather joins in the app, correctly, is genuinely hard.
- **Failover** — promoting replicas per shard, managing quorum, avoiding split-brain.
- **Schema changes** — coordinating DDL across every shard.

Distributed SQL makes all of that **native and automatic**: sharding into tablets, transparent rebalancing via the load balancer, native distributed transactions, per-tablet Raft failover, and cluster-wide DDL. You keep a single logical Postgres-compatible database instead of a fleet you hand-orchestrate. The tradeoff is the latency/complexity of Q11, but you're trading *your* operational burden for the database's engineering. That's the core "buy vs build the distribution layer" argument.

### Q13. Restate the consistency-vs-latency reality of any distributed database.

In a single-node database, "consistent" and "fast" don't conflict — the data is right there. The moment you distribute and replicate for durability and HA, **a strongly-consistent operation must coordinate across replicas**, and coordination costs network time. So:

- **Strong/linearizable reads and writes** go through the leader and (for writes) a majority quorum — correct, but they pay network latency, magnified across regions.
- **Lower-latency reads** (e.g. **follower reads**) can be served locally, but only by accepting **bounded staleness**.

There's no free lunch: you're always trading somewhere on the consistency↔latency axis. YugabyteDB's stance is **strong by default, with opt-in knobs** (follower reads, read replicas, geo-partitioning) to buy latency back where a specific query or region can tolerate slightly stale or geographically-pinned data. Understanding this is what lets you *design* a distributed schema instead of being surprised by its latency.

### Q14. What's the "pick all three" pitch, and is it actually true?

The distributed-SQL pitch is: **elastic horizontal scale + strong consistency + full SQL — pick all three**, where older systems forced you to drop one (RDBMS drops scale, NoSQL drops SQL/consistency).

Is it true? Mostly, with an asterisk. You genuinely *do* get SQL + strong consistency + scale-out simultaneously — that's the real achievement of the category and it wasn't possible before Spanner-style designs. The asterisk is **latency and the CAP reality**: strong consistency at scale costs coordination latency (especially cross-region), and under a partition you still sacrifice availability (CP). So the honest version is "**scale + consistency + SQL, yes — but you pay coordination latency for the consistency, and you accept CP under partition.**" A candidate who states the pitch *and* the asterisk sounds like an engineer; one who states only the pitch sounds like a brochure.

### Q15. An interviewer says "what is NewSQL and why should I care?" Give the crisp answer.

"NewSQL — or distributed SQL — is a database category that gives you the **SQL and ACID transactions of a traditional relational database** *and* the **horizontal scale-out and fault tolerance of NoSQL**, at the same time. It exists because we used to have to choose: relational databases were reliable and expressive but capped at one big node with a single point of failure, and NoSQL scaled out but made us give up joins, transactions, and strong consistency. Google's Spanner proved you could have both, and open-source implementations like **YugabyteDB** and CockroachDB followed. It works by **sharding your data automatically, replicating each shard with a consensus protocol like Raft, and running distributed transactions across shards** — so you get a single logical SQL database that scales by adding nodes and survives failures without manual intervention. You care if you have a relational workload that's outgrowing a single node or needs multi-region availability, and you don't want to rewrite it onto NoSQL." Then, if pressed, add the CP/latency asterisk.

### Q16. When is distributed SQL the *wrong* answer, and what would you use instead?

Reaching for distributed SQL reflexively is a red flag. It's the wrong tool when:

- **The data fits one node and will keep fitting** — use **vanilla Postgres**. Simpler, cheaper, lower per-op latency, huge ecosystem.
- **You need read scale, not write scale, and can tolerate stale reads** — Postgres **read replicas** or **Aurora** may be enough.
- **The workload is analytical/OLAP** — a columnar warehouse (Snowflake, BigQuery, ClickHouse) beats a distributed OLTP SQL database at scans/aggregations.
- **The access pattern is pure key-value or wide-column at extreme write rates with eventual consistency acceptable** — a NoSQL store (DynamoDB, Cassandra) may be a better fit and cheaper.
- **You just need multi-tenant Postgres sharding** — **Citus** might solve it without adopting a whole new database.

Use distributed SQL when you specifically need **SQL + ACID + strong consistency + horizontal scale and/or multi-region HA together** — that intersection is its home turf, and it's the *only* thing that fills it well. Choosing it outside that intersection buys complexity you won't recoup.

## Cluster Architecture: YB-Master & YB-TServer

### Summary

**What this topic covers**

The physical anatomy of a running YugabyteDB cluster: the two server processes that make it up, what each does, and how a request flows through them. This is the topic that turns the abstract "distributed SQL" story into "here are the actual processes and here's who does what." Three concern areas: (1) the **two roles** — **YB-Master** (control plane) and **YB-TServer** (data plane), what each owns, and the deliberate separation between them; (2) the **request path and topology** — how many of each you run, how a client query finds its data, and why the master is *not* in the read/write path; and (3) the **operational reality** — adding/removing nodes, colocating masters with tservers, the processes and web UIs, and what happens when a master fails versus when a tserver fails. The 16 questions go from "what are the components of a YugabyteDB cluster" to "diagnose which role a given failure affects."

**Mental model**

A YugabyteDB **universe** is a cluster of identical machines, but two *roles* run on them. Picture the **YB-TServers** as the workforce: each one stores a slice of the data (its **tablets**), participates in each tablet's Raft group, *and* runs the query layer (the PostgreSQL process for YSQL) that clients talk to. There's no separate "SQL tier" — the compute and the storage live together on every TServer, which is why any node can serve any query. Now picture the **YB-Masters** as the **brain, not the gatekeeper**: a small Raft group (usually 3) that remembers the map — which tables exist, which tablets live on which TServers, placement/replication policy — and does the housekeeping: DDL coordination, tablet assignment, load balancing, membership tracking. Crucially the master is consulted to *learn the map* (and that map is cached), then it gets out of the way — it is **not** touched on every read or write. Contrast an HDFS NameNode, which sits in the path; YB-Master is explicitly designed *not* to. Data plane scales with your data (many TServers); control plane is fixed and small (3 masters for quorum).

**Key terms**

- **Universe** — a YugabyteDB deployment: the primary data cluster plus any read-replica clusters. Sometimes used interchangeably with "cluster."
- **YB-TServer (Tablet Server)** — the data-plane process: hosts tablets + their data, runs Raft, and runs the YSQL/YCQL query layer.
- **YB-Master** — the control-plane process: metadata, tablet-to-tserver mapping, placement, DDL, load balancing, membership.
- **Tablet** — a shard of a table; the unit a TServer hosts and a Raft group replicates.
- **Control plane vs data plane** — metadata/coordination (master) vs actual query/read/write serving (tserver).
- **Master Raft group** — the 3 masters form their own Raft group for HA of metadata (leader + 2 followers, auto-failover).
- **Load balancer** — the master subsystem that rebalances tablets/leaders evenly across TServers.
- **Tablet leader** — the Raft leader replica of a tablet that serves its strong reads and coordinates its writes.
- **Heartbeats** — periodic TServer→Master health/status signals used for membership and load decisions.
- **Colocation (of processes)** — running a master and a tserver on the same node in small clusters (distinct from *table* colocation).
- **`yb-master` / `yb-tserver`** — the actual binaries/processes; `yugabyted` wraps them for simple single-command startup.

**Why interviewers ask this**

"What are the components of a YugabyteDB cluster" is the structural literacy check — and the follow-up "is the master in the request path?" is where seniors separate from juniors. The wrong mental model (master as a per-request coordinator/gatekeeper) predicts bottlenecks and failure modes that don't exist; the right one (master as an out-of-band brain) predicts YugabyteDB's actual scaling and availability behavior. Interviewers also probe the **why**: why 3 masters (quorum) but N tservers (scale with data); why separate control and data planes at all; and what *actually* breaks when each role fails. Getting "a master failure doesn't stop reads/writes, a tserver failure just re-elects tablet leaders" right demonstrates you understand the separation is a resilience feature, not incidental.

**Common confusions**

- "The master is like a Cassandra coordinator / it handles every query" — no; the master is **not** in the read/write path. TServers serve requests; the master just maintains the map.
- "You need lots of masters as you grow" — no; masters stay at **3** (or 5) for quorum regardless of cluster size. You add **TServers** to scale.
- "Master failure takes the cluster down" — no; a master **follower** failing is invisible, and a master **leader** failing triggers a fast Raft re-election while data serving continues uninterrupted.
- "Masters store the data" — they store **metadata** (schemas, tablet placement), not your table rows. Rows live on TServers.
- "TServers are just storage" — they're storage **and** compute; each runs the query layer, so there's no separate SQL node tier.
- "Universe = cluster always" — a universe can include read-replica clusters beyond the primary cluster; they're related but not identical terms.

**What follows from this topic**

This is where the fundamentals' architecture sketch becomes concrete processes. The **tablet** and **Raft** references here are unpacked in the sharding and replication topics — the master *assigns* tablets and the tserver *hosts* their Raft groups. The request-flow answer here (client → tserver query layer → tablet leader) is the skeleton the transactions and consistency topics flesh out. The load balancer and node-addition mechanics preview the scaling/operations topic. And the control-vs-data-plane separation is exactly what makes the no-single-point-of-failure claim from the fundamentals topic true in practice. Know this topic and the phrase "no master bottleneck" stops being a slogan and becomes something you can defend.

### Q1. What are the components of a YugabyteDB cluster? Give the overview.

A YugabyteDB deployment is called a **universe** — the primary data cluster (plus optional read-replica clusters). It's built from exactly **two server roles**:

- **YB-Master** — the **control plane**. Stores cluster metadata (tables, schemas, tablet-to-tserver mapping, placement policy), coordinates DDL, runs the load balancer, and tracks node membership. Runs as a small Raft group, typically **3** masters for HA. **Not in the data read/write path.**
- **YB-TServer (Tablet Server)** — the **data plane**. Hosts the **tablets** (shards) and their data (DocDB/RocksDB), participates in each tablet's Raft group, and runs the **query layer** (YSQL/YCQL) that clients connect to. You run **as many as you need** to hold your data and serve your throughput.

So: a fixed, small set of masters (the brain) and a scalable set of tservers (the workforce). Clients only ever talk to tservers.

### Q2. What does a YB-TServer do?

The **YB-TServer** is the workhorse — it does both storage and compute:

- **Hosts tablets** — it holds a set of tablet replicas, each persisted in its own customized **RocksDB** (LSM-tree) via DocDB. This is where your actual table rows live.
- **Participates in Raft** — for every tablet it hosts, it's a member of that tablet's Raft group (leader or follower), replicating writes to a majority and enabling automatic failover.
- **Runs the query layer** — each TServer runs the **YSQL (PostgreSQL) process** and/or the **YCQL** service. Clients connect *here*; the TServer parses/plans/executes SQL and turns it into DocDB operations.

The key consequence: **compute and storage live together on every TServer**, so any node can accept a client connection and serve queries. There is no separate stateless SQL tier. You scale the data plane by adding TServers.

### Q3. What does a YB-Master do?

The **YB-Master** is the cluster's control plane — its brain and bookkeeper:

- **Metadata** — stores the authoritative catalog: which tables/indexes exist, their schemas, and the **tablet-to-TServer mapping** and placement/replication policy.
- **DDL coordination** — orchestrates schema changes (`CREATE TABLE`, index builds, etc.) consistently across the cluster.
- **Tablet assignment & bootstrapping** — decides where new tablets go and manages bringing new replicas online.
- **Load balancing** — runs the **load balancer** that rebalances tablets and tablet leaders evenly across TServers as data grows or nodes are added/removed.
- **Membership & health** — tracks which TServers are alive via **heartbeats**, and reacts to failures/additions.

The single most important thing to say next: **the master is NOT in the data read/write path.** It maintains the map; it does not sit on every request. That's what keeps it from becoming a per-request bottleneck.

### Q4. Why is it critical that YB-Master is not in the read/write path?

Because a metadata service on the request path becomes a **scaling bottleneck and a single point of failure** — exactly what YugabyteDB is designed to avoid.

The reference cautionary tale is the **HDFS NameNode**: it sits in the path, so its capacity caps the whole cluster and its outage stops the cluster. YugabyteDB deliberately keeps YB-Master **out** of the data path:

- A client's read/write is served entirely by **TServers** (query layer + tablet leaders). The master isn't consulted per request.
- TServers **cache** the tablet-location map they originally learned from the master, so even lookups don't repeatedly hit it.
- Therefore the master's throughput does **not** limit query throughput, and a master outage does **not** stop reads and writes.

The master is the **brain, not the gatekeeper** — consulted to learn/maintain the map, then out of the way. This separation is what makes "no single point of failure" and "linear scale-out" true at the same time.

### Q5. Why do you run 3 YB-Masters, and how do they stay consistent?

You run **3 masters** (sometimes 5) because the masters form their **own Raft group** to make the *metadata* highly available:

- One master is the **leader**; the others are **followers** replicating the metadata log.
- A **quorum (majority)** is needed to commit metadata changes — with 3 masters, 2 form a majority, so the cluster tolerates **1 master failure** and keeps a consistent catalog.
- If the master **leader** fails, the followers run a Raft election and **promote a new leader automatically** — no manual intervention, and (crucially) data serving on TServers continues throughout.

Three is the smallest number giving fault tolerance with a clear majority (odd numbers avoid split votes). You use 5 if you want to tolerate 2 master failures. You do **not** scale masters with cluster size — 3 is enough because they only guard metadata, not data volume.

### Q6. How many TServers should you run, and why does that number differ from masters?

**TServers scale with your workload; masters don't.**

- **Masters** are fixed and small — **3** (or 5) — because their job is quorum-based *metadata* HA, which doesn't get bigger as data grows. More masters wouldn't add capacity, just election overhead.
- **TServers** grow with your **data volume and throughput** — each one holds tablets and serves queries, so adding TServers adds storage capacity, write/read throughput, and connection capacity. This is the horizontal scale-out lever.

So a small cluster might be 3 nodes (3 masters colocated with 3 tservers); a large one might be 3 masters and dozens or hundreds of tservers. The mental rule: **"3 masters for the brain, as many tservers as the data and traffic demand."** When someone asks "how do you scale YugabyteDB," the answer is "add TServers," never "add masters."

### Q7. Walk me through how a client request flows through the cluster.

For a read or write of some rows:

1. **Client connects to a TServer's query layer** — the app (via a PG driver for YSQL) opens a connection to any TServer. That TServer parses/plans/executes the statement.
2. **Find the tablet** — the query layer determines which **tablet** owns the target keys, using the tablet-location map. That map originally comes from the **master** but is **cached** on the TServer, so this is a local lookup, not a master round-trip per request.
3. **Route to the tablet leader** — the request is sent to the tablet's **Raft leader**, which may be on a *different* TServer than the one the client connected to.
4. **Serve** — for a write, the leader replicates via Raft to a majority, then acks. For a strong read, the leader serves it directly; for a **follower read**, a nearby follower serves bounded-stale data.

Note what's absent: the **master is not on this path.** Any TServer can be the entry point, and data-owning leaders do the actual work.

### Q8. What are heartbeats and health checks in the cluster?

**Heartbeats** are the periodic signals **TServers send to the YB-Master leader** to report "I'm alive and here's my status" (which tablets I host, load, etc.). They're the master's window into cluster membership and health.

The master uses them to:

- **Track membership** — detect when a TServer joins or, by *missing* heartbeats, when one has failed or become unreachable.
- **Trigger rebalancing** — when a node dies, the master notices via missed heartbeats and directs the **re-replication** of that node's tablets onto surviving nodes to restore RF, and rebalances leaders.
- **Drive the load balancer** — heartbeated load/placement info feeds decisions about moving tablets to even out the cluster.

Separately, tablet **Raft** groups have their own leader-election heartbeats *among replicas* — that's how a dead tablet leader is detected and re-elected in seconds, independent of the master. Two heartbeat systems: TServer→Master (membership/health) and intra-Raft (leader liveness).

### Q9. How do you add or remove nodes — and does it differ for masters vs tservers?

Yes, the two roles behave differently:

**Adding a TServer** — start a new `yb-tserver` pointed at the existing masters. It registers via heartbeat, and the master's **load balancer** automatically moves a share of tablets/leaders onto it, rebalancing the cluster with no downtime. This is the normal scale-out operation and you can do it repeatedly.

**Removing a TServer** — you **blacklist**/decommission it (e.g. via `yb-admin`); the load balancer drains its tablets to other nodes (re-replicating to preserve RF) before you shut it down, so no data or availability is lost.

**Masters** are different — you don't add/remove them to scale; the master set is a fixed quorum (3). Changing master membership (e.g. replacing a failed master or moving one) is a deliberate **master-configuration change** through `yb-admin`, done carefully to preserve quorum, not a routine scaling action.

Rule of thumb: **tservers churn to scale and heal; the master quorum is stable and changed only intentionally.**

### Q10. Can you run masters and tservers on the same machine? When would you?

Yes — a master and a tserver are separate processes and can be **colocated on the same node**. This is common in **small clusters**: a 3-node cluster typically runs a `yb-master` *and* a `yb-tserver` on each of the 3 nodes, giving you master quorum and data serving without needing 3 extra dedicated master machines. The `yugabyted` tool does exactly this for you on single-command/small deployments.

As clusters grow, you often **separate** them — dedicate 3 nodes to masters and let a larger fleet of nodes be tservers — so heavy data-plane load can't starve the (lightweight but latency-sensitive) master processes, and so scaling tservers doesn't touch the master quorum.

(Note: this "process colocation" is different from **table colocation**, a separate feature that packs small tables onto a shared tablet to avoid per-table overhead. Same word, different concept — worth distinguishing in an interview.)

### Q11. What are the `yb-master` / `yb-tserver` processes, and how do you start them?

They're the two actual server **binaries**:

- **`yb-master`** — runs the control-plane process; started with flags telling it its own address and the set of master addresses (`--master_addresses`) so the masters can form their Raft quorum, plus data dirs and placement info.
- **`yb-tserver`** — runs the data-plane process; started with `--tserver_master_addrs` pointing at the masters so it can register, plus its data directories and (optionally) placement/zone flags.

For simple or single-node setups, **`yugabyted`** is a wrapper that launches and manages both processes with sensible defaults via one command — good for dev and small clusters. In production/Kubernetes, the **YugabyteDB Operator** or YugabyteDB Anywhere manages the `yb-master`/`yb-tserver` processes, their flags (gflags), and rolling upgrades for you.

```bash
# Simple local start (wraps yb-master + yb-tserver)
yugabyted start

# Inspect cluster / roles via the admin CLI
yb-admin -master_addresses <m1,m2,m3> list_all_masters
yb-admin -master_addresses <m1,m2,m3> list_all_tablet_servers
```

### Q12. What web UIs does a YugabyteDB cluster expose?

Each role exposes an HTTP admin/monitoring UI:

- **Master UI** (default port **7000**) — the cluster-level dashboard: list of tservers and their health, tables and their tablets, tablet-to-tserver placement, load-balancer status, and overall universe state. This is where you see the *map* the master maintains.
- **TServer UI** (default port **9000**) — the per-node view: the tablets this TServer hosts, their Raft roles (leader/follower), local read/write metrics, and RocksDB/DocDB internals.

They're invaluable for interviews-as-diagnostics questions: "how would you check if tablets are balanced?" → the **master UI (7000)** load distribution; "how would you find a hot tablet?" → the **tserver UIs (9000)** per-tablet metrics. Production setups usually also export Prometheus metrics scraped into Grafana (and YugabyteDB Anywhere bundles dashboards), but the built-in 7000/9000 UIs are the always-available first stop.

### Q13. Why does separating the control plane and data plane matter architecturally?

The separation is what lets YugabyteDB be **both** highly scalable **and** highly available without contradiction:

- **Scalability** — because the control plane (master) is out of the request path, the **data plane (tservers) scales independently and linearly**. Adding tservers adds capacity without the master becoming a throughput ceiling.
- **Availability** — because metadata lives in its own **Raft-replicated** master quorum, and data lives in **per-tablet Raft** groups, the two fail independently. A master outage doesn't stop data serving; a tserver outage doesn't corrupt metadata — each recovers via its own consensus.
- **Clean responsibilities** — the master reasons about *placement and policy* globally; the tservers reason about *serving data* locally. Neither has to do the other's job, which keeps both simple and fast.

Collapse the two (put metadata on the request path, à la a NameNode) and you reintroduce the bottleneck/SPOF the design exists to avoid. The clean split *is* the architecture.

### Q14. Explain "the master is the brain, not the gatekeeper."

It's the one-line correction for the most common misconception about YugabyteDB.

A **gatekeeper** would sit on every request — every read/write would pass through it, making it a throughput bottleneck and a single point of failure (the HDFS NameNode model). YugabyteDB's master is explicitly **not** that.

Instead it's the **brain**: it *knows* and *maintains* the cluster's state — the map of which tablets live where, the schemas, the placement policy — and it *decides* things out-of-band: where to put new tablets, how to rebalance, how to coordinate DDL. But once a TServer has learned the map (and cached it), it serves client requests **without consulting the master at all**. So the master thinks and plans; the tservers do the per-request work.

The practical payoff: query throughput scales with tservers (the brain isn't a bottleneck), and losing the brain briefly doesn't stop the body from working (reads/writes continue during a master failover).

### Q15. What happens when a YB-TServer fails? What's the impact?

A TServer failure is a **local, self-healing** event — it degrades capacity, not availability:

1. **Detection** — the TServer stops heartbeating; the master notices, and the affected tablets' Raft groups notice their member is gone.
2. **Leader re-election** — for every tablet where the dead node was the **leader**, the surviving replicas run a Raft election and **promote a new leader within seconds**. Writes/reads for those tablets resume on the new leaders. Tablets where it was only a follower keep serving from their existing leader with no interruption.
3. **Re-replication** — the tablets on the dead node are now under-replicated (RF 3→2). The master's load balancer directs surviving nodes to **create new replicas** to restore RF=3.
4. **Rebalance** — once healed, tablets/leaders are rebalanced evenly.

Impact: with RF=3 you tolerate the loss with **no data loss and only a brief, per-tablet failover blip**. Lose more than a majority of a tablet's replicas at once, though, and that tablet becomes unavailable until replicas recover.

### Q16. What happens when a YB-Master fails? How does that differ from a tserver failure?

A master failure is even **less** disruptive to serving than a tserver failure, because the master isn't in the data path:

- **A master follower fails** — essentially **invisible**. The master leader still has quorum (2 of 3), metadata operations continue, and data serving is completely unaffected.
- **The master leader fails** — the remaining masters run a **Raft election and promote a new leader in seconds**. During that brief window, **reads and writes keep flowing** (tservers serve from cached tablet maps and per-tablet Raft leaders); what pauses momentarily is **control-plane work** — new DDL, tablet assignment, load-balancing decisions — which resumes once the new master leader is up.

**The contrast to state clearly:**

- **TServer failure** affects **data availability** for the tablets it led — brief per-tablet re-election plus re-replication to restore RF.
- **Master failure** affects **cluster management** (DDL, rebalancing) briefly — **not** the serving of existing data.

That asymmetry is the whole point of separating control and data planes: the component that isn't on the request path can fail without interrupting requests.
## DocDB: The Storage Engine

### Summary

**What this topic covers**

DocDB is the layer everyone forgets is there — the distributed document store that sits *beneath* both YSQL and YCQL and does the actual work of persisting, sharding, replicating, and versioning your data. When you write a row through the PostgreSQL-compatible YSQL API, that row does not land in a Postgres heap file; it is encoded into key-value entries and handed to DocDB, which stores it in a per-tablet **RocksDB** (an LSM-tree engine) and replicates it via Raft. This topic has 15 questions covering what DocDB is and why it exists, the customized-RocksDB foundation and *why* Yugabyte forked RocksDB rather than using it stock, the LSM-tree write path (memtable → SSTables → compaction → tombstones), how a SQL/CQL row is *encoded* into DocDB key-value entries, **MVCC with hybrid-time timestamps**, multi-version reads and read-time merging, TTL/tombstones/compaction, the read path (block cache, bloom filters, compression), the intents store for distributed transactions, and how one storage engine can serve two very different query APIs.

**Mental model**

Think of YugabyteDB as two boxes stacked. The **top box** is a query layer — for YSQL it is literally the PostgreSQL parser/planner/executor; for YCQL it is a Cassandra-flavoured layer. The **bottom box** is DocDB, and it does not know or care about SQL. It speaks one language: encoded key-value documents. A single logical row becomes a small "document" — the primary key encodes into a **document key**, and each non-key column becomes a **sub-document (cell)** hanging off that key, each cell tagged with a **hybrid-time** timestamp. DocDB is per-**tablet**: a table is sharded into tablets, and every tablet is its own pair of RocksDB instances (one for regular data, one for provisional/intents data) plus its own Raft group. Writes append to a memtable and WAL, flush to immutable SSTables, and get merged by background compaction — classic LSM. Because every version is timestamped, a read is a *snapshot at a hybrid-time*: DocDB merges the visible versions and hides anything newer or deleted. That is how you get consistent, non-blocking reads without readers taking locks.

**Key terms**

- **DocDB** — YugabyteDB's distributed document store; the common, sharded, replicated key-value/document storage engine under both APIs.
- **RocksDB (customized)** — the embedded LSM-tree engine per tablet; Yugabyte forked it and pulled MVCC/transactions/checkpoints up into DocDB.
- **LSM-tree** — log-structured merge tree: writes hit an in-memory **memtable**, flush to immutable **SSTables**, and are reconciled by **compaction**.
- **Memtable / SSTable** — mutable in-RAM write buffer vs immutable on-disk sorted string table.
- **Compaction** — background merge of SSTables that drops overwritten versions and applies tombstones to reclaim space.
- **Document key** — the encoding of a row's primary key (hash + range components) into DocDB's key space.
- **Sub-document / cell** — a single column's value under a document key, individually timestamped.
- **Hybrid time (HLC)** — the MVCC timestamp on every write; combines physical (NTP) time with a logical counter.
- **MVCC** — multi-version concurrency control: writes create new versions, reads see a consistent snapshot, GC removes old versions.
- **Tombstone** — a delete marker; the row/cell is not erased until a later compaction.
- **Intents / provisional records** — uncommitted writes of a distributed transaction, kept in a separate RocksDB (the intents DB) until commit.
- **Bloom filter / block cache** — read-path accelerators: skip SSTables that can't hold a key; cache hot blocks in RAM.

**Why interviewers ask this**

DocDB is the fastest way to tell whether a candidate understands YugabyteDB as a *distributed system* or just as "Postgres that scales." A junior answer stops at "it's Postgres-compatible." A senior answer explains that the Postgres compatibility is only the query layer, that storage is a sharded, replicated, LSM-based document store with its own MVCC, and can reason about the consequences: why writes are append-oriented and cheap, why range scans behave the way they do, why deletes don't immediately free space, and why compaction and hybrid time exist. Interviewers also probe this to check LSM literacy transferable from Cassandra/RocksDB, and to see if you can separate the *what the user sees* (SQL rows) from *what is stored* (encoded key-values).

**Common confusions**

- "YSQL stores data in Postgres files." No — YSQL reuses the Postgres *query layer* only; storage is DocDB, not the Postgres heap.
- "DocDB is just RocksDB." It's a heavily customized RocksDB with MVCC/transactions/checkpoints lifted out into DocDB, plus a separate intents store — and it's wrapped in Raft replication.
- "A row is stored as one blob." A row is a mini-document: each column is an individually timestamped cell, which is why sparse rows and per-column TTLs work.
- "Deletes free space immediately." Deletes write tombstones; space returns only at compaction.
- "Reads take locks to stay consistent." No — MVCC + hybrid time give readers a snapshot without blocking writers.

**What follows from this topic**

DocDB's per-tablet, per-key design is the foundation for `Sharding & Tablets` (how the key space is split and which sharding strategy you pick) and for `Data Distribution, Placement & Replication Factor` (how each tablet's RocksDB is replicated RF-ways across fault domains). Hybrid time here is the same clock that powers isolation and consistent distributed transactions, and the intents store previewed here is where provisional records live during two-phase commit.

### Q1. What is DocDB and where does it sit in the YugabyteDB architecture?

DocDB is YugabyteDB's **distributed document store** — the storage engine that lives underneath *both* query APIs. YugabyteDB is two layers: a query layer on top (YSQL, the PostgreSQL-compatible API, and YCQL, the Cassandra-flavoured API) and DocDB on the bottom.

DocDB is a **persistent, sharded, replicated key-value / document store**. It takes rows the query layer produces, encodes them into key-value entries, stores them in per-tablet LSM-tree engines, versions them with hybrid-time MVCC, and replicates each tablet via Raft. The query layer never touches disk directly — it always goes through DocDB.

The key insight for interviews: **Postgres compatibility is a query-layer feature, not a storage feature.** The storage is a distributed document store built for sharding and replication, which is exactly what stock Postgres storage can't do.

### Q2. Why did Yugabyte build DocDB on RocksDB instead of using PostgreSQL's own storage?

Postgres's heap storage is a single-node design: one primary writes to local files, replicas stream WAL. It has no built-in sharding, no distributed replication with automatic failover, and no per-shard consensus. To get horizontal scale-out and no single point of failure, storage has to be **distributed, sharded, and replicated** from the ground up.

RocksDB is an embeddable **LSM-tree** key-value engine — fast append-oriented writes, good compression, well suited to being one shard of a larger system. Yugabyte runs one (customized) RocksDB per tablet, wraps each tablet in a Raft group, and lets the YB-Master assign tablets to nodes. That gives sharding + replication + failover that Postgres storage simply doesn't offer.

So the split is deliberate: **reuse the Postgres query layer** (planner, executor, SQL features) for developer-facing compatibility, but **replace the storage** with something built to be distributed.

### Q3. What is an LSM-tree and how does DocDB's write path use it?

An **LSM-tree (log-structured merge tree)** optimizes for writes by never doing in-place updates. The path:

1. A write appends to a **WAL** (durability) and updates an in-memory **memtable** (a sorted structure).
2. When the memtable fills, it is flushed to an **immutable SSTable** on disk.
3. Over time many SSTables accumulate; a background **compaction** merges them, dropping overwritten versions and applying tombstones.

```text
write → WAL + memtable → (flush) → SSTable, SSTable, SSTable → (compaction) → merged SSTable
```

Consequences you should be able to state: writes are **fast and sequential** (append, not random in-place update); reads may have to check several SSTables (mitigated by bloom filters); and **space is reclaimed lazily** at compaction, not at delete time. This is the same family of engine as Cassandra and stock RocksDB, so LSM intuition transfers directly.

### Q4. How is a SQL row (or CQL row) encoded into DocDB key-value entries?

DocDB stores documents, so a row is encoded as a small document rather than a single blob:

- The **primary key** (its hash component and any range/clustering components) encodes into a **document key** — the prefix under which the whole row lives.
- Each **non-key column** becomes a **sub-document / cell** keyed by the column under that document key.
- Each cell carries its own **hybrid-time timestamp** (its version) and value.

So one logical row maps to *several* key-value entries — roughly one per column — sharing a common document-key prefix. Two important properties fall out of this:

- **Sparsity is cheap** — a NULL / unset column simply has no cell; you don't pay for empty columns.
- **Per-column versioning and TTL** work — because each cell is independently timestamped, you can overwrite or expire one column without rewriting the row.

This encoding is what lets a single relational row behave like a mini-document, and it's the same mechanism whether the row arrived via YSQL or YCQL.

### Q5. Explain MVCC with hybrid-time timestamps in DocDB.

Every write in DocDB is tagged with a **hybrid-time** timestamp (from the Hybrid Logical Clock — physical NTP time plus a logical counter). Writes never overwrite in place; they create a **new version** of the affected cell at a new hybrid time.

A read is therefore a **snapshot at a hybrid time**: DocDB returns, for each cell, the latest version whose timestamp is ≤ the read's snapshot time, and ignores anything newer or any version shadowed by a tombstone. Because versions are just timestamped entries in the LSM store, **readers never block writers and writers never block readers** — there's no shared lock for consistency; the timestamp ordering does the work.

This is what powers **Snapshot Isolation** (the default) and consistent reads: a transaction picks a read time and sees a stable view of the database as of that instant. Old versions are retained until they can no longer be needed by any active read, then **garbage-collected during compaction**.

### Q6. How does DocDB store multiple versions of a column and merge them at read time?

Because writes are append-only and each carries a hybrid time, a single cell can have several versions living across different SSTables and the memtable — e.g. `value=10 @ t1`, `value=20 @ t2`, `tombstone @ t3`.

At read time DocDB performs a **merge**: for the requested snapshot time it walks the versions of that cell (newest-first), and returns the first version at or below the snapshot time — unless a tombstone at or below the snapshot shadows it, in which case the cell reads as absent. Bloom filters and the sorted structure let it skip SSTables that can't contain the key.

Compaction later **collapses** these versions: once a version is older than the MVCC retention horizon and no active read needs it, compaction keeps only what's necessary and physically drops the rest, reclaiming space and speeding future reads.

### Q7. How do deletes, tombstones, and TTL work in DocDB, and how is space reclaimed?

A delete does **not** erase data in place — it writes a **tombstone**, a marker at a hybrid time that shadows earlier versions of that cell/row. Reads at or after the tombstone's time see the data as gone.

**YCQL TTL** works the same way: a cell can be given a time-to-live, after which it is treated as expired (an implicit tombstone) even without an explicit delete — handy for time-series/expiring data.

Physical space is reclaimed only during **compaction**, when the merge process finds a tombstone (or expired-by-TTL cell) plus the now-shadowed older versions and drops them all. The consequence to flag in an interview: **immediately after a big delete, disk usage doesn't drop** — it drops after compaction runs. And a workload that deletes/overwrites heavily accumulates tombstones that can slow reads until compaction catches up (the same "tombstone" pain Cassandra users know).

### Q8. Why can the same DocDB engine serve both relational YSQL and semi-relational YCQL?

Because DocDB is deliberately **query-language-agnostic**. It stores encoded key-value documents and knows nothing about SQL, joins, or CQL — those live entirely in the query layer above it.

Both APIs compile their operations down to the **same DocDB primitives**: read a document key, write a cell at a hybrid time, scan a key range, delete via tombstone. YSQL's rich relational features (joins, foreign keys, secondary indexes, transactions) and YCQL's semi-relational model are both expressed in terms of those primitives. Secondary indexes, for instance, are just additional DocDB tables/tablets keyed differently.

The payoff is architectural leverage: sharding, replication, MVCC, Raft, and failover are implemented **once** in DocDB and inherited by both APIs. You don't reimplement distribution per query language.

### Q9. What does "per-tablet RocksDB" mean, and why two RocksDB instances per tablet?

A table is sharded into **tablets**, and each tablet is an independent unit of storage and replication. Concretely, **each tablet owns its own RocksDB storage** — in fact **two** RocksDB instances:

- a **regular DB** holding committed data (the cells and versions), and
- an **intents (provisional) DB** holding uncommitted writes of in-flight distributed transactions.

Keeping intents in a separate store means provisional records can be scanned and cleaned up (committed → moved to the regular DB, or aborted → discarded) without polluting the main dataset. Each tablet also has its own WAL and its own Raft group. So "a tablet" = a slice of the key space + its two RocksDBs + its Raft peers. This per-tablet isolation is what lets tablets split, move between nodes, and be replicated independently.

### Q10. Where are provisional records / write intents stored, and why separately?

Provisional records (write **intents**) are the uncommitted writes produced while a **distributed transaction** is running. They're stored in the tablet's dedicated **intents RocksDB**, separate from committed data.

The separation matters because an intent's fate is undecided: the transaction may commit or abort. Keeping intents apart lets DocDB (a) let other transactions detect conflicts by scanning intents, (b) apply them to the regular DB atomically on commit at the transaction's commit hybrid time, or (c) discard them cleanly on abort. Commit status itself is tracked by a **transaction status tablet**. (Full distributed-transaction mechanics are covered in the transactions topic — here the point is just *where the bytes live*: a per-tablet intents store.)

### Q11. Walk through DocDB's read path — bloom filters, block cache, and compression.

A read for a document key proceeds roughly:

1. **Memtable** — check the in-memory buffer first (newest writes).
2. **SSTables** — for on-disk data, use **bloom filters** to skip any SSTable that provably can't contain the key, avoiding needless disk I/O.
3. **Block cache** — data blocks are cached in RAM; hot reads are served without touching disk. Frequently-read tablets stay warm here.
4. **Merge** — across the memtable and the SSTables that might hold the key, merge versions by hybrid time to produce the snapshot-consistent value.

**Compression** (e.g. block compression in RocksDB) shrinks SSTables on disk, trading a little CPU for less I/O and more effective cache. The practical read-tuning levers are therefore memory for the block cache, bloom-filter effectiveness, and keeping compaction healthy so a key isn't spread across too many SSTables.

### Q12. "How does YugabyteDB actually store my data?" — give the end-to-end answer.

Trace one `INSERT`:

1. Your `INSERT` hits the **YSQL** layer (real PostgreSQL parser/planner/executor), which turns the row into DocDB operations.
2. YugabyteDB routes it to the **tablet** that owns that primary key (by hash or range sharding).
3. The row is **encoded**: primary key → document key, each column → a timestamped cell.
4. The write goes through that tablet's **Raft group** — replicated to a majority of peers before acknowledging (durability + strong consistency).
5. On each peer it lands in the tablet's **RocksDB**: WAL + memtable now, flushed to **SSTables** later, tagged with a **hybrid-time** for MVCC.
6. Reads pick a hybrid-time snapshot and **merge versions** to return a consistent view; **compaction** later GCs old versions and tombstones.

The headline: rows aren't in Postgres files — they're **encoded, sharded, Raft-replicated, LSM-stored, hybrid-time-versioned** key-values in DocDB.

### Q13. How does DocDB's storage compare to Cassandra's at a glance?

Both are **LSM-based** (memtable → SSTables → compaction → tombstones), so the write path and the tombstone/TTL behaviour feel familiar.

| | DocDB (YugabyteDB) | Cassandra |
|---|---|---|
| Engine | Customized RocksDB (LSM) per tablet | Custom LSM storage per node |
| Consistency | **Strong** — Raft quorum per tablet | Tunable, eventual by default |
| Replication | Raft (leader + followers) | Dynamo-style, no single leader |
| Transactions | Distributed ACID txns, MVCC hybrid time | Limited (lightweight txns only) |
| Query layer on top | YSQL (Postgres) **and** YCQL | CQL only |
| Sharding | Tablets, hash or range, auto-split | Token-ring hash partitioning |

The one-liner: DocDB borrows Cassandra's **LSM storage intuition** but replaces Dynamo-style eventual consistency with **Raft-based strong consistency**, and adds a full SQL query layer.

### Q14. Why are DocDB writes fast and append-oriented, and what's the tradeoff?

Because it's an **LSM-tree**: a write appends to the WAL and updates an in-memory memtable — sequential, no random in-place disk update, no read-modify-write of a B-tree page. Flushing memtables to immutable SSTables is also sequential. That gives high write throughput and predictable write latency.

The tradeoff is **read and space amplification**: a key's versions can be spread across several SSTables, so reads may check multiple files (mitigated by bloom filters and the block cache), and overwritten/deleted data lingers as extra versions/tombstones until **compaction** reclaims it. So you trade cheap writes now for background compaction work and lazy space reclamation later — the classic LSM bargain. On top of that, every write also pays **Raft replication** cost to a quorum, which is the distributed-systems tax for strong consistency.

### Q15. How does hybrid-time MVCC give consistent reads without locking readers?

In a lock-based system, a read either blocks writers (shared locks) or risks seeing partial writes. DocDB avoids both with **multi-versioning**: writes create new, timestamped versions instead of mutating in place.

A read picks a **hybrid-time snapshot** and returns, per cell, the newest version at or below that time. Because the data it needs already exists as immutable, timestamped versions, it doesn't need to lock out concurrent writers — they're just creating *newer* versions the read will ignore. So **readers don't block writers and writers don't block readers**.

This is the mechanism behind Snapshot Isolation and consistent point-in-time reads (and, combined with Raft, linearizable reads from the leader). The cost is keeping old versions around until the MVCC retention window passes, after which compaction GCs them — you pay in a bit of space and background work rather than in reader contention.

## Sharding & Tablets

### Summary

**What this topic covers**

This is the topic that decides whether your YugabyteDB cluster scales linearly or falls over on one hot node. YugabyteDB splits every table's rows into **tablets** (shards), each owning a contiguous slice of the key space and independently replicated and served. *How* a row maps to a tablet depends on the **sharding strategy** baked into the primary key: **hash** (the default — even distribution, great for point lookups, no ordered scans) or **range** (sorted order — enables range scans, but risks a write **hotspot** on monotonically increasing keys). This topic has 17 questions covering both strategies and when to pick each, the DDL syntax, the monotonic-key hotspot (the single most common modelling mistake), automatic tablet splitting and presplitting, colocation for small tables, how tablets map to nodes as leaders and followers, the tablet-count tradeoff, `yb-admin` inspection, and worked "how would you shard this" schema examples.

**Mental model**

Picture the primary key as a coordinate that decides *which tablet* a row lives in. With **hash sharding**, YugabyteDB hashes the partition columns and scatters rows uniformly across tablets — so 1000 users land evenly on all nodes, and a lookup by key goes straight to one tablet. The cost: keys that are "close" (e.g. consecutive timestamps) land on *different* tablets, so you can't scan a range efficiently. With **range sharding**, rows are stored in **sorted key order**, so `WHERE ts BETWEEN …` and `ORDER BY` hit a contiguous set of tablets — but if your key monotonically increases (timestamp, `serial` id), **every new write targets the last tablet**, pinning all write load to one node: a hotspot. The whole art of data modelling in YugabyteDB is choosing, per table, between "even distribution, no ordered scans" and "ordered scans, watch for hotspots." Tablets aren't static — they **auto-split** as they grow, and you can **presplit** a known-large table at creation.

**Key terms**

- **Tablet** — a shard: a contiguous slice of a table's key space, independently replicated (RF peers) and served.
- **Hash sharding** — default; partition columns are hashed to distribute rows evenly; `PRIMARY KEY ((col) HASH)`.
- **Range sharding** — rows stored sorted by key (`ASC`/`DESC`); enables efficient range scans and ordered reads.
- **Hotspot** — one tablet/node absorbing disproportionate load; classic cause is a monotonically increasing range key.
- **Partition (hash) columns** — the leading key columns in `(( … ))` that determine the tablet.
- **Range (clustering) columns** — key columns after the hash part, ordered within a partition.
- **Tablet splitting** — automatic (dynamic) division of a growing tablet into two, without downtime.
- **Presplitting** — creating a table already divided into N tablets (`SPLIT INTO` for hash, `SPLIT AT` for range).
- **Colocation** — packing many small tables into one shared tablet to cut per-table overhead and keep joins local.
- **Tablet leader / follower** — the Raft leader peer serves reads/writes; followers replicate and can serve follower reads.
- **Tablet peer** — one replica of a tablet (RF peers per tablet).

**Why interviewers ask this**

Sharding is where distributed-SQL theory meets a pager at 3am. A junior candidate picks a primary key for uniqueness; a senior candidate picks it for **distribution and access pattern**, and can immediately spot that `PRIMARY KEY (created_at)` on a range-sharded table will hotspot. Interviewers use "how would you shard this table" and "spot the hotspot" to see whether you understand that in YugabyteDB **the primary key IS the sharding key** — it determines both correctness and physical load distribution. They also probe whether you know the escape hatches: leading a range key with a hash bucket, choosing hash when you only need point access, presplitting, and colocating reference tables.

**Common confusions**

- "Sharding is automatic so key choice doesn't matter." It's automatic *given your key* — but hash-vs-range and monotonic keys decide whether load is even or hotspotted.
- "Range sharding is just slower hash." No — range enables ordered scans hash can't do; the tradeoff is hotspot risk, not raw speed.
- "Auto-split fixes hotspots." Splitting helps size skew, but a monotonic key still funnels *all new writes* to the newest tablet's leader.
- "More tablets is always better." Too many tablets = per-tablet overhead (Raft, memory); too few = poor parallelism.
- "Hash and range are cluster-wide settings." They're chosen **per key / per index**, even per column position.

**What follows from this topic**

Tablets are the unit that `Data Distribution, Placement & Replication Factor` replicates and places across nodes, zones, and regions — each tablet's RF peers and its leader are what that topic spreads across fault domains. Sharding also sits directly on `DocDB` (each tablet is its own RocksDB pair and Raft group) and shapes the transactions topic (single-tablet vs multi-tablet writes have very different costs).

### Q1. How does YugabyteDB distribute a table's data across the cluster?

YugabyteDB splits every table's rows into **tablets** (shards). Each tablet owns a **contiguous slice of the table's key space**, and each tablet is independently **replicated** (RF peers, e.g. 3) and **served** (one peer is the Raft leader).

Which tablet a given row lands in is decided by the **primary key** and its **sharding strategy** — hash or range. The YB-Master assigns tablets to YB-TServer nodes and rebalances them as nodes join or leave.

The consequence is **linear scale-out**: add nodes, tablets (and their leaders) redistribute, and both storage and throughput grow. The catch is that even distribution only happens if your key choice actually spreads load — which is why the hash-vs-range decision matters so much.

### Q2. What's the difference between hash and range sharding? Give a full comparison.

| | Hash sharding (default) | Range sharding |
|---|---|---|
| Syntax | `PRIMARY KEY ((id) HASH)` | `PRIMARY KEY (id ASC)` / `DESC` |
| Row order | Hashed → effectively random | Sorted by key |
| Distribution | **Even** across tablets/nodes | Depends on key values |
| Point lookup | Excellent (goes to one tablet) | Good |
| Range scan / `ORDER BY` | **Not efficient** (keys scattered) | **Efficient** (contiguous tablets) |
| Main risk | — | **Hotspot** on monotonic keys |
| Best for | Uniform access, max scale | Ordered access, range queries |

**Hash** hashes the partition columns and scatters rows uniformly — ideal for even load and point lookups, but you cannot do an efficient ordered range scan because consecutive keys live on different tablets. **Range** stores rows in sorted order so `BETWEEN`/`ORDER BY` are efficient, but a monotonically increasing key sends every new write to the last tablet — a hotspot. The choice is per key, and you often combine both.

### Q3. What is the monotonic-key hotspot, and why is it the #1 modelling pitfall?

With **range sharding**, rows are stored in sorted key order across tablets. If the key **monotonically increases** — a timestamp, a `serial`/auto-increment id, a `bigserial`, `now()` — then the "largest key so far" always lives in the **last tablet**. Since every new insert has a bigger key than the last, **every write targets that one tablet's leader**, on one node.

The result: no matter how many nodes you have, write throughput is capped by a single node, and that node's CPU/disk saturate while the rest of the cluster idles. Auto-splitting the hot tablet doesn't cure it, because the *new* highest tablet immediately becomes the next hotspot.

It's the #1 pitfall because the schema looks perfectly reasonable (`PRIMARY KEY (created_at)` for a time-series table) and passes all functional tests — the pain only shows up under write load at scale. Fixes: use **hash** on the leading key, or prefix the range key with a **hash bucket** so writes fan out.

### Q4. How do you choose between hash and range sharding for a given table?

Decision rule:

- **Default to hash** when access is by exact key and you want maximum, even scale-out — user-by-id, session-by-token, event-by-uuid. No ordered scans needed → hash.
- **Choose range** when you genuinely need **ordered scans**: `WHERE ts BETWEEN`, `ORDER BY`, "latest N", pagination by key. But then check the key isn't monotonic.
- If you need ordered scans *and* the natural key is monotonic (timestamps), **don't range-shard on the raw timestamp alone**. Either hash a leading column (e.g. `((user_id) HASH, ts DESC)` — hash distributes users, range within each user), or add a **hash bucket** prefix (`bucket = hash(id) % N`) so writes spread across N tablets while staying ordered within a bucket.

The senior framing: pick the sharding strategy from the **read/write access pattern**, then sanity-check it against the **write distribution** (any monotonic hotspot?). Uniqueness alone is never a good enough reason to pick a key.

### Q5. Show the DDL syntax for specifying sharding on a primary key and on indexes.

```sql
-- Hash-sharded PK (default): even distribution, point lookups
CREATE TABLE users (
  id   uuid,
  name text,
  PRIMARY KEY ((id) HASH)
);

-- Range-sharded PK: sorted, supports range scans
CREATE TABLE events_by_day (
  day  date,
  seq  bigint,
  PRIMARY KEY (day ASC, seq ASC)
);

-- Hash leading column + range clustering: distribute by user, order within user
CREATE TABLE orders (
  user_id uuid,
  created_at timestamptz,
  amount numeric,
  PRIMARY KEY ((user_id) HASH, created_at DESC)
);

-- Sharding also applies to secondary indexes
CREATE INDEX idx_orders_amount ON orders (amount ASC);        -- range index
CREATE INDEX idx_orders_status ON orders ((status) HASH);     -- hash index
```

The double parentheses `(( … ))` mark the **hash (partition)** columns; columns after them are **range (clustering)** columns ordered by `ASC`/`DESC`. Indexes are themselves DocDB tables and take their own hash/range choice.

### Q6. What is automatic tablet splitting and how does it work?

As a tablet grows past a size threshold, YugabyteDB **automatically splits it into two** tablets, each taking half the key range, **online and without downtime**. This is **dynamic resharding**: you don't pre-plan the exact number of shards — the system adapts as data grows, and the YB-Master rebalances the resulting tablets across nodes.

The benefit is operational simplicity: a table that starts small on a few tablets grows into many tablets across many nodes automatically. The limitation to state clearly: splitting solves **size skew** (a tablet that got too big), but it does **not** solve a **write hotspot from a monotonic key** — the newest tablet still receives all new writes, so it just splits and re-hotspots. Splitting is about capacity and parallelism, not about fixing a bad key design.

### Q7. What is presplitting, and when would you presplit a table?

**Presplitting** creates a table already divided into multiple tablets at creation time, instead of starting with few and waiting for auto-split. Use it when you **know** a table will be large or write-heavy from day one, so you get parallelism immediately rather than after a series of splits.

```sql
-- Hash-sharded: start with 16 tablets
CREATE TABLE metrics (
  id uuid,
  PRIMARY KEY ((id) HASH)
) SPLIT INTO 16 TABLETS;

-- Range-sharded: split at explicit boundaries
CREATE TABLE readings (
  ts timestamptz,
  PRIMARY KEY (ts ASC)
) SPLIT AT VALUES (('2026-01-01'), ('2026-06-01'));
```

`SPLIT INTO N TABLETS` presplits a **hash**-sharded table into N evenly-hashed tablets; `SPLIT AT VALUES` presplits a **range**-sharded table at chosen key boundaries. Presplitting avoids the early-life bottleneck of a big import all hitting one tablet, and lets a large table use the whole cluster from the first write.

### Q8. What is colocation and when should you use it?

**Colocation** packs many **small tables into a single shared tablet** instead of giving each table its own tablets. Normally every table gets its own set of tablets (each with Raft groups, memory, WAL); for a schema with dozens of tiny reference/lookup tables, that per-table overhead dominates and joins cross tablets/nodes.

With a **colocated database (or tablespace)**, those small tables live together in one tablet, so:

- **Overhead drops** — one Raft group instead of dozens.
- **Joins are local** — related small tables sit together, so joins don't fan out across nodes.

```sql
CREATE DATABASE app WITH colocation = true;
-- small reference tables here share one tablet;
-- opt a large table OUT so it shards normally:
CREATE TABLE big_events (...) WITH (colocation = false);
```

Use colocation for **many small tables** (config, lookups, low-volume reference data). Keep large or high-throughput tables **non-colocated** so they shard across the cluster. It's the inverse optimization to sharding: sharding spreads big tables out; colocation gathers small tables in.

### Q9. How do tablets map to nodes, including leaders and followers?

Each tablet has **RF peers** (e.g. 3 for RF=3) — one **leader** and the rest **followers** — and these peers are placed on **different nodes** (and, ideally, different zones/regions) by the YB-Master.

- The **leader** handles writes and (by default) strongly-consistent reads for that tablet.
- **Followers** replicate the Raft log and can serve **follower reads** (bounded-staleness) for lower/local latency.

Crucially, **leadership is spread**: across all the tablets in the cluster, each node is the leader for some tablets and a follower for others, so write load balances. The YB-Master's load balancer continuously rebalances both **replicas** and **leaders** so no single node is leader for too many tablets. (The details of replica placement across fault domains are the subject of the placement/RF topic.)

### Q10. What's the tradeoff in choosing the number of tablets?

It's a balance:

- **Too few tablets** → poor parallelism (few nodes do the work), and higher hotspot risk (one tablet is a big fraction of load). A 3-node cluster with 1 tablet uses one node.
- **Too many tablets** → per-tablet **overhead**: each tablet is a Raft group with heartbeats, memory (memtables, block cache share), WAL, and metadata. Thousands of tiny tablets waste RAM and CPU on coordination.

The sweet spot gives enough tablets that work spreads across all nodes with headroom for growth and rebalancing, without so many that overhead dominates. In practice you size initial tablets to the node/CPU count (auto-split grows it later), presplit known-large tables, and colocate the many-tiny-tables case. The guiding question: "does every node get useful work, without drowning in Raft overhead?"

### Q11. What's the difference between a tablet leader and a tablet follower?

For each tablet's Raft group of RF peers, exactly one is the **leader** and the others are **followers**:

- **Leader** — accepts writes, drives Raft replication to followers, and serves **strongly-consistent (linearizable) reads** by default. All writes for that tablet funnel through its leader.
- **Follower** — receives and applies the replicated Raft log, stands ready to be elected leader on failure, and can serve **follower reads** (bounded-staleness) when the client opts in for lower or more local latency.

Leadership is **per tablet**, so a node is simultaneously leader for some tablets and follower for others — that's how write load spreads. On leader failure, Raft **automatically elects a new leader** from the up-to-date followers, giving fast failover with no single point of failure.

### Q12. How do you inspect a table's tablets in operations?

Use `yb-admin` against the master addresses:

```bash
# list tablets for a table, with their peers and leaders
yb-admin -master_addresses <m1,m2,m3> list_tablets ysql.mydb orders

# see all tablet servers and their load
yb-admin -master_addresses <m1,m2,m3> list_all_tablet_servers

# check per-server tablet counts to spot imbalance
yb-admin -master_addresses <m1,m2,m3> list_tablet_servers <tablet_id>
```

`list_tablets` shows each tablet's key range, its peers, and which node holds the leader — the go-to for diagnosing **skew** (one node holding too many leaders) or confirming a hotspot (all recent writes on one tablet). You can also see tablet distribution in the YB-Master web UI. When diagnosing a "one node is hot" incident, this is the first place to look.

### Q13. How does sharding into tablets enable linear scale-out?

Because a table is split into many independent **tablets**, and tablets (and their leaders) are spread across nodes, **work parallelizes**: reads and writes for different keys hit different tablets on different nodes simultaneously. Storage capacity is the sum of all nodes' disks; write/read throughput is the aggregate of all tablet leaders.

When you **add a node**, the YB-Master's load balancer **moves some tablets (and leaderships) to it**, so both capacity and throughput grow roughly linearly — no manual resharding, no downtime. **Auto-splitting** feeds this by turning big tablets into more, finer units that can spread further.

The essential precondition: your keys must actually distribute load. Linear scale-out is real only if hashing spreads rows evenly (or your range keys aren't monotonic). Perfect sharding on paper is defeated by one hotspotting key — which is why key design is the lever that turns the "add nodes → more throughput" promise on or off.

### Q14. Design the sharding for a table storing orders per user. Explain your key.

```sql
CREATE TABLE orders (
  user_id    uuid,
  created_at timestamptz,
  order_id   uuid,
  amount     numeric,
  PRIMARY KEY ((user_id) HASH, created_at DESC, order_id)
);
```

The reasoning:

- **`((user_id) HASH)`** — hash the user id so users (and their orders) spread **evenly** across all tablets/nodes. No single node owns "recent orders," so there's no global write hotspot.
- **`created_at DESC`** as a **range** clustering column — within a single user's tablet, orders are stored newest-first, so "this user's recent orders" and range-by-date scans are efficient and already ordered.
- **`order_id`** last to guarantee uniqueness when two orders share a timestamp.

This is the canonical pattern: **hash on the entity you access by (user), range within it (time)**. It gives even distribution *and* efficient ordered per-user scans, and it dodges the monotonic-timestamp hotspot because the global ordering key is a hashed user id, not the raw time.

### Q15. Spot the hotspot: `CREATE TABLE events (ts timestamptz, ..., PRIMARY KEY (ts ASC));`. What's wrong and how do you fix it?

**What's wrong:** the primary key is `ts ASC` — a **range-sharded, monotonically increasing** key. Since `ts` only ever grows, every new event has the largest key so far and lands in the **last tablet**, whose leader is on **one node**. All write load funnels to that single node; the rest of the cluster idles, and auto-splitting just relocates the hotspot to the new tail tablet.

**Fixes:**

```sql
-- Option A: hash bucket prefix — spread writes across N buckets, ordered within each
CREATE TABLE events (
  bucket smallint,          -- e.g. hash(event_id) % 16
  ts     timestamptz,
  event_id uuid,
  PRIMARY KEY ((bucket) HASH, ts DESC, event_id)
);

-- Option B: hash on a natural high-cardinality column you query by
CREATE TABLE events (
  device_id uuid,
  ts timestamptz,
  PRIMARY KEY ((device_id) HASH, ts DESC)
);
```

Option A keeps time-ordering **within a bucket** while fanning writes across 16 tablets. Option B works when you always query by `device_id`. Either way, the leading key becomes **hashed/high-cardinality** instead of monotonic.

### Q16. Why is the primary key effectively the sharding key in YugabyteDB?

Because YugabyteDB decides which **tablet** a row lives in by **encoding and hashing/ordering the primary key** — there's no separate "shard key" you set independently (as in some middleware shards). The hash `(( … ))` portion of the PK is literally the partition key that chooses the tablet; the range portion orders rows within it.

The big implication: the primary key does **double duty** — it enforces uniqueness **and** determines physical data distribution and load. So you can't choose a PK purely for uniqueness; a "correct but monotonic" PK will functionally work while destroying your write distribution. Designing a table for scale means designing the primary key for **distribution and access pattern first**, uniqueness second (adding a trailing column if needed). This is the mental shift from single-node Postgres, where the PK is just an index and distribution isn't a concept.

### Q17. When would you use range sharding despite the hotspot risk, and how do you keep it safe?

Use **range sharding** whenever ordered access is a first-class requirement: efficient `WHERE key BETWEEN …`, `ORDER BY key`, "latest N", key-based pagination, or time-bucketed scans. Hash sharding simply can't serve those efficiently because it scatters adjacent keys.

You keep it safe by making sure the **leading** key column is **not globally monotonic**:

- Put a **hash/high-cardinality** column first (`((tenant_id) HASH, ts DESC)`) so ordering is *within* a partition, not global.
- Or add a **bucket** prefix (`((hash(id) % N) HASH, ts ASC)`) to fan writes across N tablets while staying ordered within each bucket.
- Reserve a pure range PK (`ts ASC` alone) for **low-write / read-mostly** tables where the hotspot never materializes, or where you genuinely need one global order and write rate is modest.

The principle: range sharding is the right tool for ordered scans — the discipline is ensuring the *first* key component distributes writes so you never funnel them all to the tail tablet.

## Data Distribution, Placement & Replication Factor

### Summary

**What this topic covers**

This topic is about survival: how YugabyteDB places tablet replicas across the cluster so that losing a node, a zone, or even a region doesn't lose your data or your quorum. It centres on the **replication factor (RF)** — how many copies (tablet peers) of each tablet exist — and on the **placement policy** that spreads those copies across **fault domains** (nodes → zones → regions). This topic has 16 questions covering RF and why it's odd, the fault-tolerance math (why RF=3 survives one failure and RF=5 survives two), tablet peers and the Raft leader, placement across zones/regions, the fault-tolerance level you achieve, the YB-Master **load balancer**, **preferred zones / leader placement** for write locality, rebalancing on node add/remove, the RF-vs-node-count distinction, under-replication, `yb-admin` placement config, and worked "survive a zone/region failure" designs.

**Mental model**

Every tablet has **RF peers**, and those peers form a **Raft group** — a write must reach a **majority (quorum)** of peers before it's acknowledged. That single fact drives everything. Since Raft needs a majority alive, RF must be **odd** (a majority is well-defined), and a cluster tolerates ⌊RF/2⌋ peer failures: RF=3 keeps quorum with 1 down, RF=5 with 2 down. But *tolerating a failure* only helps if the failure doesn't take out your quorum — which is where **placement** comes in. If all 3 peers of a tablet sit in one availability zone, losing that zone loses the tablet. So YugabyteDB spreads each tablet's peers across **fault domains**: different nodes, then different zones, then different regions. The **fault-tolerance level** (node / zone / region) is a function of RF *and* how widely you spread. The YB-Master continuously **rebalances** replicas and leaders to honour placement and even out load; **preferred zones** let you pin leaders near your writers to cut latency.

**Key terms**

- **Replication factor (RF)** — number of tablet peers (copies) per tablet; 3 standard, 5 for higher fault tolerance; **must be odd**.
- **Tablet peer** — one replica of a tablet; the RF peers form a Raft group with one leader.
- **Quorum / majority** — the ⌊RF/2⌋+1 peers a write must reach; Raft needs a majority alive to make progress.
- **Fault domain** — a failure boundary: node, availability zone, region/cloud.
- **Placement policy** — rules spreading each tablet's peers across fault domains (cloud/region/zone flags).
- **Fault-tolerance level** — the largest domain you can lose without losing quorum: node-, zone-, or region-level.
- **Load balancer (YB-Master)** — automatically balances tablet replicas and leaders across nodes/zones.
- **Preferred zone / leader placement** — pinning tablet leaders to a chosen zone/region to localize write latency.
- **Rebalancing** — automatic streaming of tablet data to new nodes (or off removed ones).
- **Under-replication** — a tablet with fewer than RF live peers; the cluster works to restore full RF.
- **RF vs node count** — RF is copies (durability/availability); nodes are capacity/throughput; nodes ≥ RF, often ≫ RF.
- **Read replicas** — separate async (non-voting) replicas for local reads; their RF is configured independently.

**Why interviewers ask this**

This is the "can you keep it up during an outage" test. Juniors conflate RF with node count ("RF=3 means 3 nodes"); seniors know RF is copies-per-tablet and you can run RF=3 on 30 nodes. Interviewers want to see you compute fault tolerance from RF (⌊RF/2⌋) *and* reason about placement — that RF=3 alone doesn't survive a zone loss unless the three peers are in three different zones. The strongest signal is answering "how do you make YugabyteDB survive a zone/region failure": the candidate who says "RF=3 across three zones for zone fault tolerance; RF=3 across three regions (or RF=5) for region fault tolerance, with preferred-zone leaders to manage write latency" clearly understands the interplay of RF, placement, quorum, and latency.

**Common confusions**

- "RF=3 means 3 nodes." No — RF is peers **per tablet**; you can have far more nodes, each holding a subset of each tablet's peers.
- "RF=3 survives a zone failure automatically." Only if the 3 peers are placed in **3 different zones**; otherwise a zone loss can take a quorum.
- "Higher RF is always better." Higher RF = more copies to write to → higher write latency and cost; RF=5 buys tolerating 2 failures, not free safety.
- "Even RF is fine." Raft needs a **majority**; even RF wastes a copy and complicates quorum — keep RF odd.
- "Read replicas count toward RF." They're **separate async** replicas with their own factor; they don't vote in Raft.

**What follows from this topic**

This topic replicates and places the **tablets** from `Sharding & Tablets` — every tablet's RF peers and its leader are what get spread across fault domains here. The quorum mechanics tie back to `DocDB` (Raft-committed writes) and forward to the transactions and consistency topics (leader reads vs follower reads, cross-region write latency). Placement and preferred zones are also the on-ramp to the multi-region topics (geo-partitioning, follower reads, xCluster).

### Q1. What is the replication factor (RF) in YugabyteDB?

The **replication factor** is the number of **copies of each tablet** — the number of **tablet peers** — that YugabyteDB maintains. RF is set at the universe/cluster level (and can be per-tablespace for placement).

- **RF=3** is the standard — three peers per tablet, tolerating one failure.
- **RF=5** gives higher fault tolerance — five peers, tolerating two failures.
- RF **must be odd**, because each tablet's peers form a **Raft group** that needs a well-defined **majority** to commit writes and elect leaders.

RF is about **durability and availability**: more copies means more failures survived, at the cost of writing each change to more peers (higher write latency). It is *not* the same as the number of nodes — RF is per-tablet copies; nodes are the machines those copies are spread over.

### Q2. Why must RF be odd?

Because each tablet is a **Raft group**, and Raft makes progress only with a **majority (quorum)** of peers — ⌊RF/2⌋+1. An odd RF gives a clean majority and maximises the failures tolerated per copy:

- RF=3 → majority 2 → tolerates 1 failure.
- RF=5 → majority 3 → tolerates 2 failures.

An **even** RF wastes a replica: RF=4 also only tolerates 1 failure (majority is 3), so it costs an extra copy for no extra fault tolerance, and a 2-2 split has no majority (risking unavailability). Odd RF avoids split-brain ambiguity and gives the best tolerance-per-copy ratio, which is why YugabyteDB uses 3 or 5.

### Q3. Work through the fault-tolerance math for RF=3 and RF=5.

A Raft group of RF peers needs a **majority** alive to commit and elect leaders. Majority = ⌊RF/2⌋+1; failures tolerated = ⌊RF/2⌋.

| RF | Peers | Majority needed | Failures tolerated |
|---|---|---|---|
| 3 | 3 | 2 | **1** |
| 5 | 5 | 3 | **2** |
| 7 | 7 | 4 | 3 |

So **RF=3 survives 1 peer failure** (2 of 3 still form a quorum) and **RF=5 survives 2**. Lose one more than that and the tablet loses quorum: it can't commit writes or elect a leader, so it becomes unavailable (data isn't lost if peers recover, but it's offline until quorum returns).

Two nuances: (1) this is per **fault domain** only if peers are spread across domains — otherwise one zone loss can drop multiple peers at once; (2) higher RF costs write latency (more peers per commit), so RF=5 is for when tolerating two simultaneous failures is worth the price.

### Q4. What are tablet peers and how do they relate to the Raft leader?

The **RF peers** of a tablet are its RF replicas — for RF=3, three peers, each holding a full copy of that tablet's data on a different node. Together they form one **Raft consensus group**.

Within that group, exactly one peer is the **Raft leader**; the rest are **followers**. Writes go to the leader, which replicates them to followers and commits once a **majority** has the entry. Reads are served by the leader by default (linearizable), or by followers as bounded-staleness follower reads.

If the leader's node fails, the remaining peers **elect a new leader** (Raft election), and service continues — as long as a majority of peers survive. So "tablet peer" = a replica; "leader" = the currently-elected coordinator among them. Leadership is per tablet, so across the cluster each node leads some tablets and follows others.

### Q5. How does placement policy spread replicas across fault domains?

Placement policy tells YugabyteDB to distribute each tablet's **RF peers across distinct fault domains** rather than piling them in one place. Fault domains are hierarchical: **node → availability zone → region/cloud**.

You describe each node's location with **cloud / region / zone** placement info, and set a placement policy so that, for example, an RF=3 tablet places its three peers in **three different zones**. Then losing any one zone drops only **one** peer per tablet — quorum (2 of 3) survives.

```bash
# tell the cluster to spread RF=3 across three zones (min 1 replica each)
yb-admin -master_addresses <m> modify_placement_info \
  aws.us-west.us-west-1a,aws.us-west.us-west-1b,aws.us-west.us-west-1c 3
```

The principle: **fault tolerance = RF + how widely peers are spread**. Spreading across zones buys zone-level tolerance; across regions buys region-level tolerance. Without a placement policy, replicas could cluster in one domain and a single-domain failure could take a quorum.

### Q6. What determines the fault-tolerance level (node, zone, or region) you achieve?

It's the combination of **RF** and **how you spread the peers across fault domains**:

- **Node-level FT** — peers on different **nodes** (same zone). RF=3 survives 1 node loss. Cheapest, but a zone outage can take multiple peers.
- **Zone-level FT** — peers across different **availability zones**. RF=3 across 3 zones survives a full **zone** loss (one peer down per tablet, quorum intact).
- **Region-level FT** — peers across different **regions**. RF=3 across 3 regions (or RF=5) survives a full **region** loss — at the cost of cross-region Raft write latency.

The rule: you get tolerance at the **largest fault domain across which you've spread a quorum-preserving number of peers**. RF sets *how many* failures; placement sets *what kind* of failure (node/zone/region) those map to. That's why "RF=3" alone isn't an answer — "RF=3 across 3 zones" is.

### Q7. What does the YB-Master load balancer do?

The **YB-Master** runs a background **load balancer** that keeps tablet **replicas** and **leaders** evenly distributed across the cluster while honouring the placement policy. It:

- **Balances replicas** — so each node holds a fair share of tablet peers (no node overloaded on storage/IO).
- **Balances leaders** — so leadership (and thus write/read load) is spread, not concentrated on a few nodes.
- **Enforces placement** — moves replicas to satisfy zone/region spread rules.
- **Reacts to topology change** — when nodes are added or removed, it streams tablets to rebalance.

This is automatic and online. It's why adding a node "just works" — the balancer notices the imbalance and migrates tablets/leaders to the new node. When you diagnose uneven load, you're often looking at the balancer mid-move or a placement constraint preventing an even spread.

### Q8. What are preferred zones / leader placement and why use them?

By default tablet leaders are spread across all zones. **Preferred zones** (leader placement) let you **pin tablet leaders to a chosen zone or region**, while replicas still live everywhere for durability.

The reason is **write latency**. Every write goes through the tablet **leader** and must reach a Raft majority. If your application and the leaders are in the same region, writes commit with local + nearby-follower latency. If leaders are scattered across distant regions, writes pay cross-region round-trips. By setting the preferred zone to where your writers are, you **localize the leader**, cutting write latency, while keeping replicas in other zones/regions for fault tolerance.

```bash
yb-admin -master_addresses <m> set_preferred_zones \
  aws.us-west.us-west-1a aws.us-west.us-west-1b
```

It's a key lever in multi-region deployments: durability everywhere, but leaders (and thus fast writes) near your primary traffic.

### Q9. What happens to data distribution when you add or remove a node?

**Adding a node:** the YB-Master's load balancer detects the new capacity and **automatically streams some tablet peers (and leaderships) onto it**, rebalancing storage and load. No manual resharding, no downtime — the cluster gradually evens out.

**Removing a node (or a node failing):** its tablets become **under-replicated** (fewer than RF live peers). The cluster **re-replicates** the affected tablets onto other nodes to restore full RF, and rebalances leaders off the departed node. For a graceful removal you **blacklist** the node so its data drains before decommission.

```bash
yb-admin -master_addresses <m> change_blacklist ADD <host:port>   # drain a node
```

The guarantee: the cluster continuously works toward "every tablet at full RF, evenly spread, placement satisfied." This automatic rebalancing is what makes elastic scale-out and node replacement operationally cheap.

### Q10. What's the difference between replication factor and the number of nodes?

They're orthogonal:

- **RF** = copies **per tablet** — durability and availability. RF=3 means every tablet has 3 peers.
- **Node count** = how many machines — capacity and throughput. More nodes = more storage, CPU, and aggregate IOPS.

You need **at least RF nodes** (to place RF peers on distinct nodes), but you usually have **many more**. On a 30-node RF=3 cluster, each tablet still has just 3 peers, but those peers are spread so that the 30 nodes collectively hold thousands of tablets — capacity scales with nodes while each tablet's redundancy stays at 3.

So "scale up for more capacity" means **add nodes** (RF unchanged); "tolerate more failures" means **raise RF** (say 3→5). Conflating them is the classic junior error — RF is not "how many servers," it's "how many copies of each shard."

### Q11. What is under-replication and how does the cluster respond?

A tablet is **under-replicated** when it has **fewer than RF live peers** — e.g. an RF=3 tablet down to 2 peers after a node fails. It's still available (2 of 3 is a quorum) but has **reduced fault tolerance**: one more failure would lose quorum.

The cluster treats this as a condition to fix: after a grace period (to avoid churning on a brief blip), the YB-Master **re-replicates** the tablet by creating a new peer on another node and streaming the data, restoring full RF. Until that completes, dashboards/`yb-admin` report the tablet as under-replicated.

The operational point: under-replication is a **warning state**, not data loss — but you want to resolve node failures promptly (or let auto-re-replication run) so you're not sitting one failure away from unavailability. Persistent under-replication usually means not enough nodes/zones to satisfy RF + placement.

### Q12. How do you configure placement with yb-admin?

The core command is `modify_placement_info`, which sets the target placement and minimum replicas per fault domain:

```bash
# RF=3 spread one replica into each of three zones
yb-admin -master_addresses <m1,m2,m3> modify_placement_info \
  aws.us-west.us-west-1a,aws.us-west.us-west-1b,aws.us-west.us-west-1c 3

# pin leaders to a preferred zone for local write latency
yb-admin -master_addresses <m1,m2,m3> set_preferred_zones \
  aws.us-west.us-west-1a

# drain a node before decommissioning
yb-admin -master_addresses <m1,m2,m3> change_blacklist ADD <host:port>
```

Each TServer is started with its own `--placement_cloud`, `--placement_region`, `--placement_zone` flags describing where it lives; `modify_placement_info` then says how to spread replicas across those domains. Per-tablespace placement (in YSQL) lets you set different placement/RF for different tables — the foundation for geo-partitioning.

### Q13. How does rack/zone awareness prevent replicas ending up in one failure domain?

Placement is **fault-domain aware**: because each node advertises its cloud/region/zone, the YB-Master knows the failure boundaries and deliberately **places a tablet's peers in distinct domains** instead of allowing them to cluster.

Without this awareness, a load balancer optimizing only for disk/CPU could put all three RF=3 peers of a tablet in the **same zone** — and a single zone outage would then take the whole tablet down despite RF=3. Zone/rack awareness forbids that: the placement policy requires (say) one peer per zone, so no single zone/rack holds a quorum of any tablet.

This is the mechanism that turns raw redundancy into *usable* fault tolerance. RF gives you copies; **domain awareness ensures the copies are in different baskets**, so losing one basket never loses a quorum.

### Q14. How do read replicas differ from the RF peers, and how is their replication factor set?

**RF peers** are the **synchronous, voting** Raft replicas — they participate in quorum, can become leader, and every write must reach a majority of them. Their count is the cluster RF (3, 5, …).

**Read replicas** are a **separate, asynchronous, non-voting** tier. They receive data asynchronously (they don't slow down writes, don't vote in Raft, and can't become leaders) and exist to serve **local, low-latency reads** in a region far from the primary cluster. Their replication factor is configured **independently** of the primary RF — you might run RF=3 in the main region plus a read-replica cluster in another region for local reads.

The key distinctions to state: read replicas **don't affect write quorum or durability guarantees** (that's the RF peers' job), they serve **stale (async) reads only**, and their count is a separate setting. They're a latency optimization, not a fault-tolerance one.

### Q15. Design a topology that survives an availability-zone failure. Walk through it.

Target: **zone-level fault tolerance** — lose any one AZ, stay fully available.

Design: a **3-node, 3-AZ, RF=3** cluster — one node in each of `us-west-1a`, `-1b`, `-1c`, with placement requiring **one replica of every tablet per zone**.

```bash
yb-admin -master_addresses <m> modify_placement_info \
  aws.us-west.us-west-1a,aws.us-west.us-west-1b,aws.us-west.us-west-1c 3
```

Why it survives an AZ loss: every tablet has exactly one peer in each zone. Lose a whole zone and each tablet loses **one** peer — the other two (in the surviving zones) still form a **majority (2 of 3)**, so every tablet keeps a quorum: writes commit, and Raft re-elects leaders in the surviving zones for any tablets that had their leader in the dead zone. No data loss, brief re-election blip. When the zone returns, the peers re-sync and rebalancing restores even placement. Scale it by adding nodes evenly across the three zones (still RF=3), keeping the one-peer-per-zone invariant.

### Q16. "How do you make YugabyteDB survive a region failure?" Give the full answer.

You need **region-level fault tolerance**, which means spreading a quorum-preserving set of peers across **regions**:

- **RF=3 across 3 regions** — one peer per region. Lose any region and each tablet keeps 2 of 3 → quorum survives, cluster stays up. Minimal cost in copies.
- **RF=5 across regions** for tolerating **two** simultaneous failures, or for smoother quorum when regions have unequal capacity.

The tradeoff is **write latency**: with peers in different regions, every write must reach a Raft majority that now spans regions, so commits pay a cross-region round-trip. Manage it with **preferred zones / leader placement** — pin leaders to the region nearest your writers so the leader-to-nearest-follower hop is short, and consider **follower reads** for local low-latency reads elsewhere.

For data-residency or to avoid the cross-region write tax on every row, layer **geo-partitioning** (pin specific rows to a region via tablespaces) so most writes stay in-region while still surviving a region loss for the globally-replicated tables. And for DR without synchronous cost, **xCluster** async replication gives a second region you can fail over to. The crisp answer: **RF≥3 spread across regions for synchronous region survival; preferred-zone leaders + follower reads to control latency; geo-partitioning/xCluster when you need residency or want to avoid paying cross-region latency on every write.**
## Replication & Raft Consensus

### Summary

**What this topic covers**

How YugabyteDB keeps your data safe and consistent even when nodes die: **replication driven by the Raft consensus protocol, one Raft group per tablet**. This is the beating heart of the "strong consistency + no single point of failure" claim. The 17 questions in this topic cover the Raft primer (leader, followers, log, quorum), the write path through Raft, why a majority-commit gives you strong consistency (and how that contrasts with Cassandra's eventual replication), leader election and leader leases, leader reads vs follower reads, the per-tablet nature of replication (millions of independent Raft groups spread across the cluster), how many failures a group tolerates, log replication and follower catch-up, and the practical "how does YugabyteDB stay up when a node dies" answer an interviewer wants to hear.

**Mental model**

Forget the whole-database-replication picture from primary/replica Postgres. In YugabyteDB the **unit of replication is the tablet**, not the database or the node. Each tablet (a shard of a table's rows) is stored on **RF nodes** — with the default **RF=3** that's **one leader + two followers** — and those three replicas form a **Raft consensus group**. The leader is the only replica that accepts writes for that tablet. It appends the write to its **Raft log**, ships the log entry to the followers, and once a **majority (quorum)** of the group has the entry durably on disk, the entry is **committed** — applied to the DocDB state machine (RocksDB) and acknowledged to the client. Because a committed write lives on a majority, any minority failure can't lose it, and Raft's election rules guarantee the next leader already has every committed entry. A big cluster runs **millions of these Raft groups concurrently**, and the YB-Master spreads tablet leaders evenly so no single node is a bottleneck. Node death is a non-event: the affected tablets simply elect new leaders from up-to-date followers within seconds.

**Key terms**

- **Raft** — a distributed consensus protocol: one elected leader accepts writes, replicates them to followers, commits on majority ack. Guarantees agreement and durability despite failures.
- **Tablet** — a horizontal shard of a table; the unit of replication and its own Raft group.
- **Raft group / peer group** — the RF replicas of one tablet (leader + followers) that agree via Raft.
- **Leader** — the single replica that accepts writes and (by default) serves reads for a tablet.
- **Follower** — a replica that receives replicated log entries and can become leader.
- **Quorum / majority** — ⌊RF/2⌋+1 replicas; the number that must ack for a commit (2 of 3 at RF=3).
- **Raft log** — the ordered, replicated record of operations; the source of truth that the DocDB state machine is derived from.
- **Commit** — the point at which a majority holds an entry durably; only then is it applied and acked.
- **Leader election** — followers detect a missing leader heartbeat and vote in a new leader from an up-to-date replica.
- **Leader lease** — a time-based grant so exactly one leader can serve linearizable reads, preventing a stale ex-leader from answering.
- **Follower read** — an optional read served by a follower at bounded staleness for lower/local latency (preview).
- **Fault tolerance** — a group survives ⌊RF/2⌋ failures (1 at RF=3, 2 at RF=5).

**Why interviewers ask this**

This is where they separate people who've read the marketing page from people who understand the machine. A junior says "it replicates data three times." A senior explains that each tablet is an independent Raft group, that writes commit on quorum before ack, that this is what makes committed writes durable and linearizable, and that leader election gives automatic failover in seconds with no split-brain. The killer follow-ups are "what happens when the leader dies mid-write?" and "why can't you lose a committed write?" — both of which you answer by reasoning about the Raft log and the majority rule, not by reciting a number. Getting the quorum-vs-unanimity distinction right (you need a majority, not all replicas) signals you actually understand why the system stays available during a failure.

**Common confusions**

- "It writes to all 3 replicas before acking" — no, it waits for a **majority** (2 of 3), which is why one node can be down and writes still succeed.
- "There's a primary node for the whole database" — leadership is **per tablet**; every node is a leader for some tablets and a follower for others.
- "Raft and the storage engine are the same thing" — the **Raft log** is the replicated operation log; **DocDB/RocksDB** is the state machine the log is applied to. Different layers.
- "Failover loses recent writes" — a new leader is always chosen from a replica that has every committed entry, so committed writes survive.
- "Follower reads are the default" — no, **leader reads are the default** (linearizable); follower reads are opt-in bounded-staleness.
- "It's like Cassandra replication" — Cassandra replicates asynchronously with tunable/eventual consistency; YugabyteDB uses synchronous Raft quorum for strong consistency.

**What follows from this topic**

Raft is the foundation the next two topics build on. `## Consistency & Isolation Levels` explains what guarantees this quorum replication actually buys you at the SQL level (linearizable single-key ops, snapshot/serializable transactions). `## Distributed Transactions Deep Dive` shows how a single atomic commit is coordinated across **many** independent Raft groups when a transaction spans tablets. The YB-Master control plane is itself a Raft group of 3, so the same mechanism secures cluster metadata. And follower reads and cross-region commit latency — touched on here — are the levers the multi-region topics pull.

### Q1. How does YugabyteDB replicate data, and what protocol does it use?

YugabyteDB replicates at the **tablet** level using the **Raft consensus protocol**. A table is sharded into tablets by primary key; each tablet is replicated to **RF nodes** (default **RF=3**) and those replicas form a **Raft group** with one **leader** and RF-1 **followers**.

Every write for a tablet goes to that tablet's leader, which appends it to the Raft log and replicates it to followers. Once a **majority (quorum)** of the group has the entry durably, it commits. This synchronous, quorum-based replication is what gives YugabyteDB **strong consistency and durability** — unlike Cassandra's asynchronous, eventually-consistent replication.

### Q2. Give me a quick primer on Raft.

Raft is a distributed consensus protocol — an understandable alternative to Paxos. The essentials:

- **One leader** is elected per group; only the leader accepts writes.
- The leader appends each operation to its **replicated log** and sends it to followers.
- An entry is **committed** once a **majority** of the group has it durably on disk.
- Committed entries are applied to the **state machine** (in YugabyteDB, DocDB) in log order, identically on every replica.
- If the leader fails, followers hold an **election** and pick a new leader that has all committed entries.

The guarantees: **agreement** (all replicas apply the same operations in the same order) and **durability** (a committed entry survives any minority failure). YugabyteDB runs one Raft group per tablet.

### Q3. Walk me through the write path for a single write.

```text
1. Client sends a write to the tablet's LEADER (routed via smart client / YB-TServer).
2. Leader assigns a hybrid-time, appends the op to its Raft LOG (WAL).
3. Leader replicates the log entry to the FOLLOWERS in parallel.
4. Each follower writes the entry durably and acks.
5. Once a MAJORITY (including the leader) has it durably, the entry is COMMITTED.
6. Leader applies it to DocDB (RocksDB) and ACKs the client.
```

The key line is step 5: the write is acknowledged only after a **quorum** has it on disk. That's why a **committed write survives any minority failure** — it already lives on a majority, and any future leader must have it.

### Q4. Why does Raft give you strong consistency here?

Three properties combine:

- **No lost committed writes** — a commit requires a majority, and Raft's election rules only elect a leader that holds every committed entry. So a committed write is never rolled back.
- **Single writer per tablet** — only the leader accepts writes, and a **leader lease** ensures only one leader can serve linearizable reads at a time. No split-brain, no conflicting concurrent writers.
- **Ordered application** — all replicas apply the log in the same order, so they converge to the identical state.

Contrast with Cassandra, which replicates asynchronously and lets you tune consistency per query; you can read stale data and, without care, lose writes on conflict. YugabyteDB's Raft quorum makes single-key operations **linearizable** by construction.

### Q5. What happens when the tablet leader fails?

Automatic failover via **leader election**:

1. Followers stop receiving the leader's **heartbeats**.
2. After an election timeout, a follower becomes a **candidate** and requests votes.
3. A candidate that is **up to date** (has all committed entries) wins a **majority** of votes and becomes the new leader.
4. It resumes serving reads and writes for that tablet.

This typically completes in **a few seconds**. Because only an up-to-date replica can win, **no committed write is lost**. Meanwhile, the other tablets whose leaders lived on the dead node also re-elect — but each is independent, so the cluster as a whole barely hiccups.

### Q6. What is a leader lease and why is it needed?

A **leader lease** is a time-bounded grant that lets a leader serve **linearizable reads locally** without checking with the group on every read. The leader knows that for the duration of the lease, no other replica can have become leader, so its local state reflects all committed writes.

Without leases, a **stale ex-leader** — one that got partitioned and doesn't yet know it's been replaced — could answer a read with old data (a split-brain read). The lease closes that window: a new leader waits out the old lease before serving linearizable reads, and the old leader stops serving once its lease expires. This is what makes default (leader) reads linearizable without a Raft round-trip per read.

### Q7. What's the difference between leader reads and follower reads?

| | Leader reads (default) | Follower reads |
|---|---|---|
| Served by | Tablet leader | Any follower replica |
| Consistency | **Linearizable** — sees all committed writes | **Bounded staleness** — may lag slightly |
| Latency | One hop to the leader (possibly cross-zone) | Local replica, lower latency |
| Use when | You need the latest value | Read-heavy, staleness-tolerant, latency-sensitive |
| Status | GA | Preview / opt-in |

Follower reads (`SET yb_read_from_followers = true` with a staleness bound) let a read hit a nearby replica instead of a possibly-remote leader — great for geo-distributed read latency — at the cost of reading data up to a bounded interval old.

### Q8. If replication is per-tablet, how many Raft groups does a cluster run?

Potentially **millions**. Every tablet is its own Raft group, and a large table can have thousands of tablets, across many tables, across the cluster. Each group independently elects a leader and commits its own writes.

The YB-Master **load-balances** tablet leaders so they're spread evenly across nodes — this is crucial, because a single node hosts leaders for some tablets and followers for others. That balance is what turns "one leader per tablet" into a cluster where **write and read load is distributed**, not funneled through one machine. It's the opposite of a single-primary database.

### Q9. How many node failures can a Raft group tolerate?

A group of RF replicas tolerates **⌊RF/2⌋** failures, because a commit needs a majority (⌊RF/2⌋+1):

| RF | Majority needed | Failures tolerated |
|---|---|---|
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

At the default **RF=3**, a tablet keeps serving reads and writes with **one replica down**. Lose two and that tablet loses quorum — it can't commit new writes until a replica recovers. This is a per-tablet property, so fault tolerance is usually framed at the cluster level via the placement policy (e.g. RF=3 across 3 zones survives one zone failure).

### Q10. What's the difference between the Raft log and the DocDB state machine?

- The **Raft log** (the WAL) is the ordered, replicated sequence of operations. It's what gets agreed upon via consensus and what makes replication durable.
- **DocDB** (per-tablet RocksDB) is the **state machine** — the materialized key-value data you actually query. It's derived by applying committed log entries in order.

Every replica applies the same committed log in the same order, so every replica's DocDB converges to identical state. The separation matters: consensus happens over the log; storage/reads happen over the state machine. A follower that fell behind catches up by receiving missing **log** entries, then applying them to its DocDB.

### Q11. How does a lagging or rejoining follower catch up?

The leader tracks each follower's progress (its last-replicated log index). If a follower is behind — slow, restarted, or newly rejoined — the leader keeps sending it the **missing log entries** until it's caught up, then resumes normal replication.

If a follower has fallen so far behind that the leader has already **GC'd** those log segments, YugabyteDB uses **remote bootstrap**: the follower is shipped a recent snapshot of the tablet's RocksDB state plus the tail of the log, rather than replaying from the beginning. Either way, once caught up the follower rejoins the quorum and can again contribute to majority commits and stand for election.

### Q12. Why Raft instead of primary + async replicas like classic Postgres?

Async primary/replica replication has a correctness hole on failover: a replica may not have received the primary's most recent writes, so promoting it can **lose committed data** or require manual intervention and risk split-brain. Semi-sync helps but doesn't fully solve it.

Raft closes the hole by construction:

- A write commits only after a **majority** has it durably.
- A new leader is elected only from a replica holding **all committed entries**.

So failover is **automatic, fast, and lossless** — no lost committed writes, no split-brain, no operator paging at 3am to promote a replica. That correctness-under-failover guarantee is exactly why a distributed SQL database uses consensus rather than async replication.

### Q13. Does the YB-Master use Raft too?

Yes. The **YB-Master** (control plane — cluster metadata, tablet-to-node mapping, load balancing, DDL) runs as its own **Raft group of 3** (or more). Cluster metadata is replicated and committed via Raft exactly like tablet data, so the control plane has the same strong-consistency and no-single-point-of-failure properties.

Losing the master **leader** triggers a normal Raft election; a new master leader takes over in seconds. And because the master isn't on the hot read/write path (smart clients cache tablet locations), a brief master election doesn't stall data-plane traffic.

### Q14. What determines commit latency, and what does that mean cross-region?

A write commits after **one round-trip to a quorum** — the leader must hear back from enough followers to form a majority. So commit latency is roughly the **round-trip time to the nearest replica that completes the majority**.

Within a single region/zone, that's sub-millisecond to low-single-digit milliseconds. **Cross-region**, if the tablet's replicas are spread across distant regions, forming a quorum means waiting for an ack from another region — so every write pays **inter-region RTT** (tens of ms). That's the fundamental tax of a synchronously-replicated stretched cluster, and it's why multi-region designs reach for **geo-partitioning** (keep a row's replicas in its home region) or **follower reads** (serve reads locally) — covered in the multi-region topics (preview).

### Q15. How do I see which node is the leader for a tablet?

```bash
# List tablets for a table and their Raft leader/followers
yb-admin -master_addresses <m1>,<m2>,<m3> \
  list_tablets ysql.mydb users

# Detailed per-tablet replica roles (LEADER / FOLLOWER)
yb-admin -master_addresses <m1>,<m2>,<m3> \
  list_tablet_servers <tablet_id>
```

This shows, per tablet, which TServer holds the **LEADER** and which hold **FOLLOWER** replicas. It's the go-to for diagnosing an unbalanced cluster (leaders piled on one node) or confirming placement after a failure/rebalance. The master UI exposes the same information graphically.

### Q16. Concrete example: a 3-replica tablet loses a node — what happens?

Two cases, RF=3 (leader L + followers F1, F2):

- **A follower dies (say F2)**: nothing user-visible. L still forms a majority with F1 (2 of 3), so reads and writes continue uninterrupted. F2's replica is re-created elsewhere by the load balancer, then remote-bootstrapped back into the group.
- **The leader dies (L)**: F1 and F2 miss heartbeats, hold an election, and one becomes the new leader (it has all committed entries). After a few seconds, writes resume. **No committed write is lost.** A fresh third replica is then rebuilt to restore RF=3.

Either way the tablet tolerates exactly **one** failure. A second concurrent failure would cost it quorum.

### Q17. In one breath: how does YugabyteDB stay consistent when a node dies?

Because consistency doesn't depend on any single node. Every tablet is replicated **RF=3** as a **Raft group**, and every write is committed to a **majority (quorum)** before it's acknowledged — so a committed write already lives on multiple nodes. When a node dies, the tablets it led simply **elect new leaders** from up-to-date followers within seconds, and those leaders are guaranteed by Raft to hold every committed write. No lost data, no split-brain (leader leases enforce a single leader), no manual failover. The key subtlety is **quorum, not unanimity**: you need a majority to agree, which is precisely what lets the system keep working while a minority is down.

## Consistency & Isolation Levels

### Summary

**What this topic covers**

What consistency guarantees YugabyteDB actually gives you, and how to pick an **isolation level** for a workload. YugabyteDB is **strongly consistent by design** — single-key operations are linearizable, and multi-row work is ACID. This topic's 16 questions cover the three YSQL isolation levels (**Snapshot Isolation**, **Serializable**, **Read Committed**), how they map to PostgreSQL's levels, the fast path for single-shard operations vs the cost of distributed transactions, MVCC and non-blocking reads, transaction conflicts / retries / read restarts (and their tie to clock skew and hybrid time), how all this differs from Cassandra's tunable consistency and Spanner's TrueTime, and the interview staples: "does YugabyteDB support ACID?", "what isolation level?", and "linearizability vs serializability."

**Mental model**

Two axes, don't conflate them. **Consistency (linearizability)** is about *ordering of operations in real time* on a single object — YugabyteDB gives you this for single-key ops because every tablet commits via Raft quorum and reads go to the leader under a lease. **Isolation** is about *how concurrent transactions see each other* — that's the SQL isolation level (SI / Serializable / Read Committed). YugabyteDB implements isolation with **MVCC over hybrid-time timestamps**: each transaction reads a consistent snapshot as of a chosen hybrid time, so **readers never block writers and writers never block readers**. Where transactions genuinely conflict (write-write on the same key, or serializability violations), one transaction is **aborted** and must be **retried** by the application — there is no lock-wait-forever; conflicts surface as serialization failures. Think "Postgres semantics, but the snapshot is a distributed hybrid-time snapshot and conflicts resolve by abort-and-retry rather than always blocking."

**Key terms**

- **Strong consistency / linearizability** — single-key operations appear to happen instantly, in real-time order; a read sees the latest committed write.
- **Snapshot Isolation (SI)** — YSQL's **default**; each txn sees a consistent snapshot as of its start; maps to Postgres **REPEATABLE READ**; prevents dirty/non-repeatable reads; allows some **write skew**.
- **Serializable** — strongest; result equals *some* serial order; no anomalies including write skew; more conflicts/retries.
- **Read Committed (RC)** — each **statement** sees a fresh snapshot; added for Postgres compatibility and fewer retries.
- **MVCC** — multi-version concurrency control; multiple timestamped versions of a row let reads proceed without locking writers.
- **Hybrid time / HLC** — the timestamp source that orders versions and picks snapshot/commit points across nodes.
- **Write skew** — an SI anomaly where two txns read overlapping data and each writes a disjoint part, together violating an invariant.
- **Read restart** — a read that must retry because concurrent commits fall within the clock-skew uncertainty window (`max_clock_skew`).
- **Serialization failure (40001)** — the error a conflicting/retryable transaction returns; the app should catch and retry it.
- **External consistency** — a cluster-wide real-time ordering guarantee (Spanner's term via TrueTime); YugabyteDB approximates it with HLC.

**Why interviewers ask this**

Isolation is where "I use transactions" meets "do you know what they actually guarantee." Juniors say "it's ACID" and stop. Seniors know YSQL's **default is Snapshot Isolation** (not Read Committed like stock Postgres, historically), can explain **write skew** and why Serializable prevents it, and — crucially — know the app must **handle serialization-failure retries** rather than assuming the database blocks until it's safe. The strongest signal is understanding **linearizability vs serializability** as two different things (single-object real-time order vs multi-object transaction order) and knowing YugabyteDB gives you both. Interviewers also probe the trade-off: when do you pay for Serializable, and when is SI or RC good enough? A crisp "Serializable for correctness-critical invariants, RC for throughput and Postgres app compatibility" lands well.

**Common confusions**

- "YugabyteDB's default is Read Committed like Postgres" — historically YSQL's default is **Snapshot Isolation** (Postgres REPEATABLE READ). Read Committed exists but check the default for your version.
- "Snapshot Isolation is fully serializable" — it isn't; SI permits **write skew**. Use **Serializable** to eliminate it.
- "Strong consistency means no retries" — no. Under SI/Serializable, conflicting transactions **abort and must be retried** by the app.
- "Linearizability and serializability are the same" — linearizability is single-object real-time ordering; serializability is multi-object transaction ordering. Different guarantees.
- "It uses TrueTime like Spanner" — no; YugabyteDB uses **HLC + NTP** within a bounded `max_clock_skew`, which is why **read restarts** exist.
- "Readers block writers" — MVCC means reads see a snapshot and **don't block** writers (and vice versa); only genuine write conflicts cause aborts.

**What follows from this topic**

The abort-and-retry model here is fully explained by `## Distributed Transactions Deep Dive`, which shows how provisional intents, the transaction status tablet, and conflict detection produce those serialization failures. The linearizability guarantee rests on `## Replication & Raft Consensus` (quorum commit + leader leases). And the read-restart / clock-skew discussion ties back to hybrid time — the reason YugabyteDB tolerates NTP-level clocks instead of needing Spanner's atomic-clock TrueTime.

### Q1. Does YugabyteDB support ACID transactions, and at what isolation level?

Yes — YugabyteDB is fully **ACID**, including **distributed** (multi-row, multi-node) transactions. It's **strongly consistent** by design: single-key operations are **linearizable**, and transactions are serializable-capable.

In **YSQL** it supports three isolation levels:

- **Snapshot Isolation** — the default (maps to Postgres `REPEATABLE READ`).
- **Serializable** — the strongest.
- **Read Committed** — for Postgres compatibility.

This is a core differentiator from Cassandra (which is eventually/tunably consistent with only limited lightweight transactions). YugabyteDB gives you real SQL transactions on a horizontally-scalable, fault-tolerant store.

### Q2. What isolation levels does YSQL support and how do they map to Postgres?

| YSQL level | Maps to Postgres | Snapshot granularity | Key property |
|---|---|---|---|
| **Snapshot Isolation** | REPEATABLE READ | Per **transaction** | Default; consistent snapshot as of txn start; allows write skew |
| **Serializable** | SERIALIZABLE | Per **transaction** | No anomalies, incl. write skew; more conflicts/retries |
| **Read Committed** | READ COMMITTED | Per **statement** | Fresh snapshot each statement; fewer retries; Postgres-compatible |

The nuance: stock PostgreSQL's default is **Read Committed**, but YSQL has historically defaulted to **Snapshot Isolation**. Note also that in Postgres, asking for READ UNCOMMITTED gets you READ COMMITTED; YugabyteDB likewise has no dirty reads.

### Q3. What is Snapshot Isolation and why is it the default?

Under **Snapshot Isolation (SI)**, a transaction reads a **consistent snapshot** of the database as of its start time — chosen via hybrid time. Every read in the txn sees that same snapshot, so:

- **No dirty reads** — you never see uncommitted data.
- **No non-repeatable reads** — re-reading a row returns the same value.
- **No phantom surprises within the snapshot**.

It's the default because it's a strong, intuitive guarantee (matches Postgres `REPEATABLE READ`) that's **cheaper than full Serializable** — it doesn't need to track read/write dependency conflicts as aggressively, so it produces fewer aborts. The trade-off: SI permits **write skew** (see the next question).

### Q4. What is write skew and how do I avoid it?

**Write skew** is the classic SI anomaly. Two transactions each **read** an overlapping set of rows, each concludes an invariant still holds, then each **writes a different row** — individually fine, together breaking the invariant.

Textbook case: a rule "at least one doctor must be on call." Two on-call doctors each run a txn, both read "2 on call, fine," and each sets themselves off-call. Under SI both commit → **zero** on call.

```sql
-- Both txns under Snapshot Isolation:
BEGIN;
SELECT count(*) FROM oncall WHERE on_call = true;  -- both see 2
UPDATE oncall SET on_call = false WHERE doctor = 'alice';  -- txn A
-- (txn B does the same for 'bob')
COMMIT;  -- both succeed under SI -> invariant violated
```

Fix: use **Serializable** isolation, which detects the read/write conflict and aborts one, or add an explicit locking/constraint strategy.

### Q5. When should I use Serializable isolation?

Use **Serializable** when correctness depends on an **invariant across multiple rows** that SI's write-skew hole could break — financial ledgers, inventory/seat allocation, uniqueness enforced in application logic, on-call/scheduling constraints.

Serializable guarantees the outcome equals **some serial execution** of the transactions — no anomalies at all, including write skew. The cost is more **transaction conflicts**: when concurrency would violate serializability, one transaction is **aborted** with a serialization failure, so your app must **retry**. Under contention that means more retries and lower throughput.

Rule of thumb: **Serializable for correctness-critical writes; Snapshot Isolation or Read Committed for high-throughput or read-mostly paths.**

### Q6. What is Read Committed and why was it added?

**Read Committed (RC)** gives each **statement** its own fresh snapshot of committed data — so a later statement in the same transaction can see rows committed by others after the transaction began. This is stock PostgreSQL's default behaviour.

YugabyteDB added RC for two reasons:

1. **Postgres compatibility** — many apps and ORMs are written assuming RC semantics; running them unchanged needs RC.
2. **Fewer retries** — RC can internally handle certain conflicts by transparently re-reading the latest data at the statement level, reducing the number of serialization failures the client sees compared to SI/Serializable.

```sql
SET default_transaction_isolation = 'read committed';
```

### Q7. How do I set the isolation level?

Per session or per transaction:

```sql
-- Session default:
SET default_transaction_isolation = 'serializable';

-- Single transaction:
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- ... statements ...
COMMIT;

-- Or on the BEGIN:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;  -- = Snapshot Isolation
```

`REPEATABLE READ` and `SNAPSHOT` map to Snapshot Isolation; `SERIALIZABLE` to Serializable; `READ COMMITTED`/`READ UNCOMMITTED` to Read Committed. Set it as tightly as the workload needs — don't run everything Serializable if only a few code paths require it.

### Q8. What's the difference between a single-shard and a distributed transaction, consistency-wise?

- **Single-row / single-shard**: the operation touches keys on **one tablet**, so it's committed by that tablet's Raft group as **one atomic, linearizable** write. No distributed-transaction machinery — this is the **fast path** (a single Raft round-trip).
- **Multi-row / multi-shard**: the transaction touches keys across **multiple tablets** (different Raft groups), so YugabyteDB runs the **distributed transaction protocol** — provisional intents, a transaction status tablet, a commit that flips status atomically. More network round-trips, higher latency.

Both are fully ACID and consistent; the difference is **cost**. This is why a schema/design goal is to keep hot transactions **single-shard** where possible (see the distributed-transactions topic).

### Q9. How does MVCC let reads avoid blocking writes?

YugabyteDB keeps **multiple timestamped versions** of each row in DocDB, ordered by **hybrid time**. A read simply picks the version visible as of its snapshot's hybrid time — it doesn't need a lock and doesn't wait for in-flight writers. Conversely, writers create **new** versions rather than overwriting in place, so they don't block readers.

The upshot: **readers don't block writers, and writers don't block readers.** Contention only arises on genuine **write-write conflicts** to the same key (or read/write conflicts under Serializable), which resolve by aborting one transaction — not by long lock waits. This non-blocking model is central to how a distributed SQL database sustains concurrency.

### Q10. What's a read restart, and why does it happen?

A **read restart** happens because YugabyteDB uses **hybrid logical clocks** over NTP-synced wall clocks with a bounded uncertainty (`max_clock_skew`, e.g. 500ms). When a read encounters data committed within that **uncertainty window** — close enough in time that clock skew makes ordering ambiguous — it can't be sure whether that write should be in its snapshot. To stay correct, it **restarts** the read at a later timestamp.

```text
Read at t → sees a write with a timestamp inside [t, t + max_clock_skew]
          → ambiguous ordering → restart read at a higher timestamp
```

Restarts are usually transparent and rare; frequent ones point to **bad clock sync** (tighten NTP) or extremely hot recently-written keys. This is the practical cost of using HLC instead of Spanner's TrueTime.

### Q11. How does the app handle transaction conflicts and retries?

Under SI and especially Serializable, concurrent transactions that genuinely conflict cause one to **abort** with a serialization failure — Postgres error code **40001** (`serialization_failure` / `Operation expired` / `Conflicts with higher priority transaction`). The database does **not** silently make it correct; the **application must retry** the transaction.

```python
for attempt in range(5):
    try:
        with conn:                      # BEGIN ... COMMIT
            cur.execute("UPDATE accounts SET bal = bal - 100 WHERE id = %s", (a,))
            cur.execute("UPDATE accounts SET bal = bal + 100 WHERE id = %s", (b,))
        break                           # success
    except SerializationFailure:
        if attempt == 4: raise
        sleep(backoff(attempt))         # retry with backoff
```

Make retries **idempotent** and use exponential backoff. Read Committed reduces how often clients see these by handling some conflicts at the statement level.

### Q12. How does YugabyteDB's consistency differ from Cassandra's and Spanner's?

| | Cassandra | Spanner | YugabyteDB |
|---|---|---|---|
| Default consistency | **Tunable / eventual** | External (strong) | **Strong** (linearizable single-key) |
| Transactions | Limited (LWT/Paxos per-partition) | Full distributed ACID | Full distributed ACID |
| Clock basis | N/A (no global order) | **TrueTime** (atomic clocks) | **HLC + NTP** (`max_clock_skew`) |
| Isolation | N/A (per-op) | Serializable / external | SI / Serializable / RC |

Cassandra trades consistency for availability/tunability; you can read stale data. Spanner gives external consistency but needs Google's TrueTime hardware. YugabyteDB gives strong consistency and full ACID on **commodity clocks** by using HLC — accepting occasional read restarts as the price.

### Q13. Explain linearizability vs serializability.

They're different guarantees on different scopes:

- **Linearizability** — a **single-object**, real-time guarantee: each operation appears to take effect instantaneously at some point between its start and end, consistent with real-time order. YugabyteDB gives this for **single-key** operations (Raft quorum commit + leader lease reads).
- **Serializability** — a **multi-object**, transaction-level guarantee: the result of concurrent transactions equals *some* serial order of them. It says nothing about real-time ordering between non-overlapping transactions.

YugabyteDB provides **both**: linearizable single-key ops and (at Serializable isolation) serializable multi-key transactions. Spanner's "external consistency" = **strict serializability** = serializability **plus** real-time order, achieved with TrueTime.

### Q14. Design guidance: pick an isolation level for a bank transfer vs a read-mostly dashboard.

- **Bank transfer / ledger**: use **Serializable**. Money movement has cross-row invariants (no double-spend, balances never go negative under concurrency, no write skew). The extra conflicts/retries are worth strict correctness — wrap the transfer in a retry loop for 40001.
- **Read-mostly analytics dashboard**: use **Read Committed** (or SI), and consider **follower reads** for local latency if slight staleness is acceptable. There are no cross-row invariants to protect, so paying for Serializable would just add contention and latency for no benefit.

The general principle: **match isolation to the strongest invariant the workload actually needs**, not the strongest available.

### Q15. Does a read see the latest committed write, or can it be stale?

Depends on where it's served:

- **Leader read (default)**: **yes, latest** — linearizable. The tablet leader, under its lease, holds all committed writes, so the read reflects everything committed before it started.
- **Follower read (opt-in)**: possibly **stale** within a **bounded** interval. You explicitly trade freshness for lower/local latency (`yb_read_from_followers`, with a staleness bound like 30s).

So by default YugabyteDB reads are fresh and strongly consistent; staleness only appears when you deliberately enable follower reads for latency. That's the opposite of Cassandra, where staleness is a tunable default behaviour.

### Q16. In one answer: what is YugabyteDB's consistency model?

YugabyteDB is **strongly consistent** by design. Every single-key operation is **linearizable** — committed via Raft quorum and read from the leader under a lease, so a read always sees the latest committed write. Multi-row work is **fully ACID** with three isolation levels in YSQL: **Snapshot Isolation** (default), **Serializable** (strongest, no write skew), and **Read Committed** (Postgres-compatible). Isolation is implemented with **MVCC over hybrid-time timestamps**, so reads don't block writes; genuine conflicts resolve by **aborting and retrying** (serialization failures the app must handle). Unlike Cassandra it isn't eventually consistent, and unlike Spanner it achieves this with **HLC + NTP** rather than atomic-clock TrueTime — the reason occasional **read restarts** exist.

## Distributed Transactions Deep Dive

### Summary

**What this topic covers**

The mechanism behind a YugabyteDB transaction that touches **multiple rows across multiple tablets on multiple nodes** — a true distributed ACID transaction. This is where the "how does it commit atomically across independent Raft groups?" question gets answered. The 16 questions cover the challenge (atomicity + isolation across independent shards), the 2-phase-commit-style protocol, **provisional records / write intents**, the **transaction status tablet / coordinator**, the atomic commit (a single status flip), the async **apply** phase that resolves intents into committed records, **conflict detection** and priority-based aborts, how a reader decides whether to see a provisional value, hybrid-time timestamp assignment, why single-shard transactions skip all of it (fast path), the **cost** of distributed transactions and the design rules to minimize it, the **retry logic** the app must own, cross-region implications, savepoints, a comparison to Spanner, and the "how does YugabyteDB do distributed ACID?" interview answer.

**Mental model**

A distributed transaction is orchestrated by a **transaction status record** that lives on a single **transaction status tablet** — the one authoritative place that says whether the transaction is PENDING, COMMITTED, or ABORTED. As the transaction runs, its writes don't go straight into the data; they're written as **provisional records (write intents)** into a special intents section of DocDB on **each involved tablet**, tagged with the **transaction id** and a hybrid time. These intents are tentative — visible only to the transaction itself until it commits. **Commit is a single atomic act**: the coordinator flips the status record to COMMITTED via one Raft write to the status tablet. That one write makes the whole multi-tablet transaction durable and visible — the essence of the 2PC-style design. Afterward, an **apply phase** asynchronously converts each provisional intent into a normal committed record on its tablet. Any reader that meets a provisional value **checks the transaction's status** to decide whether it's committed (visible) or not. Single-shard transactions skip all of this — they're just one Raft write.

**Key terms**

- **Distributed transaction** — a transaction spanning multiple tablets/nodes, needing atomic commit across independent Raft groups.
- **Provisional record / write intent** — a tentative, uncommitted version written to the intents store on each involved tablet, tagged with the transaction id and hybrid time.
- **Transaction status tablet** — a special tablet holding transaction **status records**; the single source of truth for commit/abort.
- **Transaction coordinator** — the component (on the TServer handling the txn) that drives the protocol and talks to the status tablet.
- **Status record** — per-transaction state: **PENDING → COMMITTED / ABORTED**.
- **Commit** — a single atomic Raft write flipping the status record to COMMITTED (the linearization point of the whole txn).
- **Apply / resolution phase** — async conversion of provisional intents into regular committed records after commit.
- **Conflict detection** — when two txns' intents collide on a key, one is aborted by **priority** / first-writer-wins.
- **Transaction priority** — value used to decide which of two conflicting transactions aborts.
- **Serialization failure (40001)** — the retryable error a conflicting/aborted transaction returns.
- **Fast path (single-shard)** — a transaction on one tablet, committed by one Raft write with no intents/status tablet.
- **Read point** — the hybrid time at which the transaction reads a consistent snapshot.

**Why interviewers ask this**

This is the deep-end question that reveals whether you understand distributed systems or just SQL. Anyone can say "it's ACID"; the signal is explaining **how** atomicity is achieved when the rows live on different Raft groups — the provisional intents, the single-status-record commit, the async apply, and how reads resolve visibility via the status record. Seniors also grasp the **cost model**: distributed transactions pay multiple round-trips plus a status-tablet write, so they design to keep transactions **single-shard/small** and own the **retry loop** for serialization failures. The best answers connect it upward (this is what produces the 40001 errors from the isolation topic) and outward (compare to Spanner's 2PC-over-Paxos). Get this right and you've demonstrated you can reason about correctness and performance in a sharded, replicated system.

**Common confusions**

- "Every transaction uses this heavy protocol" — no; **single-shard** transactions take a fast path (one Raft write) and skip intents and the status tablet entirely.
- "2PC has a single-point-of-failure coordinator" — the status is itself Raft-replicated on the status tablet, so there's no fragile standalone coordinator like classic 2PC.
- "Commit writes all the data atomically everywhere at once" — the atomic act is the **status flip**; the data intents are resolved **asynchronously** afterward, but become visible the instant status = COMMITTED.
- "Conflicting transactions queue and wait" — under conflict, one transaction is **aborted** by priority and must be **retried**; it doesn't just block indefinitely.
- "Distributed and single-row transactions cost the same" — distributed ones pay extra round-trips + a status write; keep transactions single-shard when you can.
- "Intents are visible to everyone" — provisional intents are visible only to their own transaction until commit; other readers consult the status record.

**What follows from this topic**

This mechanism is the concrete implementation of the isolation guarantees in `## Consistency & Isolation Levels` — the intents, status record, and conflict detection are exactly what produce Snapshot/Serializable semantics and the 40001 retries. It stands on `## Replication & Raft Consensus` — every intent write, every status flip, and the final committed records are themselves Raft-committed within their tablets. And its cost model (round-trips, status writes, cross-region latency) is the reason the schema-design and multi-region topics push you toward colocating related data and keeping transactions single-shard.

### Q1. How does YugabyteDB execute a transaction that spans multiple tablets?

It runs a **2-phase-commit-style distributed transaction** coordinated through a **transaction status record**:

1. **Write intents**: the transaction's writes go to each involved tablet as **provisional records (write intents)** — tentative, tagged with the transaction id and a hybrid time — not into the live data yet.
2. **Commit**: the coordinator atomically flips the transaction's **status record** (on a transaction status tablet) to **COMMITTED** via a single Raft write. That one act makes the whole transaction durable and visible.
3. **Apply**: asynchronously, each tablet resolves its provisional intents into normal committed records.

Atomicity across independent Raft groups comes from the **single status flip** being the one point that decides commit-or-abort for all the intents at once.

### Q2. What's the core challenge a distributed transaction has to solve?

**Atomicity and isolation across independent shards.** The rows a transaction touches can live on different **tablets**, each its own **Raft group** on possibly different nodes. There's no shared lock manager or single log spanning them. So you need:

- **All-or-nothing commit** — either every tablet's write takes effect or none does, even though they commit independently.
- **Isolation** — concurrent transactions must not see each other's half-finished work, and conflicts must be detected across shards.

YugabyteDB solves both by funneling the **commit decision** through one atomic, Raft-replicated **status record**, and by staging writes as **provisional intents** that only become visible once that status says COMMITTED.

### Q3. What are provisional records / write intents?

**Write intents** (provisional records) are the transaction's tentative writes, stored in a dedicated **intents** region of DocDB on **each tablet the transaction touches**. Each intent carries:

- the **transaction id** it belongs to,
- a **hybrid-time** timestamp,
- the intended value (and the lock/intent type — read or write).

They are **not** part of the committed data. They're visible only to their own transaction while it runs. When another transaction reads a key and finds an intent, it consults the owning transaction's **status record** to decide whether to treat the value as committed. On commit, intents are resolved into regular records; on abort, they're discarded. Intents are how YugabyteDB stages a multi-tablet write before the atomic commit.

### Q4. What is the transaction status tablet and what does it track?

The **transaction status tablet** is a special system tablet that stores **status records** — one per in-flight distributed transaction — recording state:

```text
PENDING  →  COMMITTED   (commit)
         →  ABORTED     (conflict / rollback / timeout)
```

It's the **single source of truth** for whether a transaction committed. Like any tablet it's **Raft-replicated**, so the commit decision is itself durable and highly available — this is what avoids classic 2PC's fragile single coordinator. A **transaction coordinator** (running on the TServer that received the transaction) drives the protocol and issues the status writes. Readers that encounter a provisional intent look up its transaction's status here to resolve visibility.

### Q5. Walk me through the commit and the apply phase.

```text
1. COMMIT issued. Coordinator picks a commit hybrid-time.
2. Coordinator writes COMMITTED to the transaction's status record
   (a single Raft write to the status tablet).  <-- ATOMIC COMMIT POINT
3. From this instant the transaction is durable and its writes are
   logically visible (readers resolve intents via status = COMMITTED).
4. APPLY (async): the coordinator tells each involved tablet to convert
   its provisional intents into regular committed records at the commit time.
5. Intents are cleaned up; the status record can eventually be GC'd.
```

The subtlety candidates miss: **visibility happens at step 2**, not step 4. The status flip is the linearization point; the apply phase is just asynchronous cleanup that materializes the intents into the main data.

### Q6. How does conflict detection work?

When a transaction tries to write an **intent** on a key that already has a conflicting intent (or committed write) from another transaction, YugabyteDB detects the conflict and resolves it by **aborting one transaction** — it doesn't let both proceed. Which one aborts is decided by **transaction priority** (each transaction gets a priority; the lower-priority one is aborted — a generalized first-writer/priority scheme).

```text
Txn A holds a write intent on key K.
Txn B tries to write an intent on key K → conflict.
→ Compare priorities → abort the loser → it returns 40001 → app retries.
```

Under **Serializable**, read intents also participate, so read/write conflicts (the write-skew case) are caught too. The result is the **serialization failures** the application must retry.

### Q7. When a reader hits a provisional value, how does it decide whether to see it?

It **checks the owning transaction's status record**:

- If the intent's transaction is **COMMITTED** and its commit time is **≤ the reader's read point**, the reader treats the intent as a committed value and sees it.
- If **PENDING**, the value isn't committed yet — the reader ignores it (or, under conflict rules, may trigger a conflict/wait/abort decision).
- If **ABORTED**, the intent is dead — ignored.

This status lookup is what makes provisional writes safe: intents can sit in DocDB visibly-on-disk but **logically invisible** until their transaction commits. It's also why the status tablet must be highly available — reads depend on it to resolve visibility for keys with in-flight intents.

### Q8. How are timestamps assigned to a transaction's reads and commit?

YugabyteDB uses **hybrid time (HLC)**:

- **Read point**: the transaction reads a consistent snapshot as of a chosen hybrid time (its start, under Snapshot Isolation). All reads see data as of that read point.
- **Commit time**: at commit, the coordinator picks a **commit hybrid-time** and stamps the COMMITTED status record and the applied records with it.

Because hybrid time combines a physical (NTP) component with a logical counter, it gives a **globally meaningful ordering** across tablets without atomic clocks. The bounded `max_clock_skew` is why **read restarts** can occur when a read meets a write inside the uncertainty window — the transaction re-reads at a higher timestamp to stay correct.

### Q9. Why do single-shard transactions skip all of this?

If a transaction touches keys on **one tablet only**, there's nothing to coordinate across Raft groups — the single tablet's leader can commit the whole thing as **one Raft write**, atomically and linearizably. No provisional intents, no status tablet, no separate commit/apply.

```text
Single-shard: client → tablet leader → one Raft quorum commit → done.
Multi-shard:  intents on N tablets → status-tablet commit → async apply.
```

That's a large latency difference — the single-shard **fast path** is one round-trip; the distributed path is several plus a status write. It's the central reason schema design aims to keep hot transactions on a single tablet.

### Q10. What does a distributed transaction cost, and how do I minimize it?

**Cost**: multiple network round-trips (writing intents to each tablet), a **status-tablet Raft write** for the commit, and asynchronous **intent cleanup** — so latency and resource use are meaningfully higher than a single-row operation, and it grows with the number of tablets involved.

**Minimize it by design**:

- **Colocate related data** so a transaction hits one tablet (colocated tables, matching partition keys, tablespaces).
- **Keep transactions small** — fewer rows, fewer tablets, fewer statements.
- **Keep transactions short** to reduce the conflict window (fewer aborts).
- **Batch** operations rather than many round-trips.
- Prefer **single-row** operations where the data model allows.
- Make retries **idempotent** so 40001 retries are safe.

### Q11. What retry logic must the application own?

Distributed transactions can **abort on conflict** and return Postgres error **40001** (serialization failure). The database does not silently fix it — the **application must retry** the whole transaction.

```python
for attempt in range(MAX_RETRIES):
    try:
        with conn:  # BEGIN ... COMMIT
            run_transfer(cur, src, dst, amount)
        break
    except SerializationFailure:          # SQLSTATE 40001
        if attempt == MAX_RETRIES - 1:
            raise
        time.sleep(exp_backoff(attempt))  # jittered backoff
```

Rules: retry the **entire** transaction (not just the failed statement), use **exponential backoff with jitter**, cap attempts, and ensure the transaction body is **idempotent** so a retry doesn't double-apply. Read Committed reduces how often clients see 40001 by resolving some conflicts at the statement level.

### Q12. What happens to distributed transactions across regions?

They pay **WAN latency**. Every step that needs a Raft quorum — writing intents to a tablet whose replicas span regions, and the **status-tablet commit** — must wait for an ack from a replica in another region. So a cross-region distributed transaction can take **tens of milliseconds per round-trip**, multiplied by the number of coordination steps.

Mitigations (multi-region topics):

- **Geo-partitioning** — pin a row's tablet replicas to its home region so its transactions commit locally.
- **Colocate** the tablets a transaction touches in one region.
- Keep transactions **single-shard** so there's one local quorum, not several remote ones.

The lesson: a naively stretched cluster turns cheap transactions into WAN-bound ones; design placement so hot transactions stay regional.

### Q13. Give a concrete example: a transfer touching two accounts on two tablets.

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
  UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';  -- tablet T1
  UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';    -- tablet T2
COMMIT;
```

What happens under the hood:

1. A **write intent** for alice's row is placed on **T1**; an intent for bob's row on **T2**. Both tagged with this transaction's id and hybrid time.
2. On `COMMIT`, the coordinator flips the transaction's **status record** to COMMITTED with a commit hybrid-time — **one atomic Raft write**.
3. The two intents are asynchronously **applied** into committed rows on T1 and T2.

If, concurrently, another transaction had a conflicting intent on alice's row, one of them aborts (by priority) with **40001** and retries. That's a textbook two-tablet distributed transaction.

### Q14. How does this compare to Google Spanner's approach?

Both use **two-phase commit layered over a consensus protocol**, so the commit decision is replicated and fault-tolerant rather than sitting on a fragile single coordinator:

| | Spanner | YugabyteDB |
|---|---|---|
| Consensus | **Paxos** per group | **Raft** per tablet |
| 2PC coordination | 2PC across Paxos groups | 2PC-style via **transaction status tablet** |
| Clock / ordering | **TrueTime** + commit-wait | **HLC (hybrid time)** + `max_clock_skew` |
| Timestamp cost | Waits out clock uncertainty on commit | Occasional **read restarts** instead |

The architectures rhyme; the big divergence is clocks. Spanner uses TrueTime atomic-clock hardware and **commit-wait** to guarantee external consistency; YugabyteDB uses **HLC over NTP** on commodity hardware and pays with occasional read restarts rather than a commit-wait delay.

### Q15. Are savepoints supported inside a transaction?

Yes — YSQL supports **savepoints** (Postgres-compatible), letting you partially roll back within a transaction:

```sql
BEGIN;
  INSERT INTO orders (id, user_id) VALUES (1, 'alice');
  SAVEPOINT sp1;
  INSERT INTO order_items (order_id, sku) VALUES (1, 'bad');
  ROLLBACK TO SAVEPOINT sp1;   -- undo the bad insert, keep the order
  INSERT INTO order_items (order_id, sku) VALUES (1, 'good');
COMMIT;
```

`ROLLBACK TO SAVEPOINT` discards the provisional intents written since the savepoint without aborting the whole transaction. This matters for ORMs and stored procedures that rely on nested error handling. It's part of YSQL's PostgreSQL-compatibility surface, implemented over the same intents machinery.

### Q16. In one answer: how does YugabyteDB do distributed ACID transactions?

When a transaction spans multiple tablets, YugabyteDB stages every write as a **provisional intent** in DocDB on each involved tablet, tagged with the **transaction id** and a **hybrid time** — tentative, invisible to other transactions. A **transaction status record** on a Raft-replicated **status tablet** is the single source of truth for whether the transaction committed. **Commit is one atomic Raft write** flipping that record to COMMITTED, which instantly makes the whole multi-tablet transaction durable and visible; an asynchronous **apply** phase then materializes the intents into committed rows. Conflicts are detected on intents and resolved by **priority-based abort** (returning **40001** for the app to retry). **Single-shard** transactions skip all of it via a one-Raft-write fast path. It's a **2PC-style protocol over per-tablet Raft** — the same idea as Spanner's 2PC-over-Paxos, but using **hybrid clocks** instead of TrueTime.
## Hybrid Logical Clocks & Time

### Summary

**What this topic covers**

How YugabyteDB answers the hardest question in any distributed database: *what time is it, and in what order did things happen?* Without a shared notion of time you cannot take a consistent snapshot, you cannot order transactions across nodes, and you cannot give MVCC readers a coherent view of the world. But physical clocks on different servers drift, NTP is imperfect, and there is no free global clock. This topic walks the two industry answers — **Google Spanner's TrueTime** (GPS + atomic clocks + commit-wait, but proprietary hardware) and **YugabyteDB's Hybrid Logical Clocks (HLC)** (commodity NTP + a Lamport counter, no special hardware) — and the operational consequences of the HLC choice: `max_clock_skew_usec`, read restarts, the danger of excessive clock skew, and why keeping NTP/chrony tight is a hard requirement rather than a nice-to-have. The 15 questions here explain how YugabyteDB orders events without atomic clocks, and give you the concrete "why am I getting read-restart errors" answer an interviewer (or an on-call page) will want.

**Mental model**

Think of every write in YugabyteDB as being stamped with a **hybrid timestamp**: a pair `(physical, logical)` where `physical` is a wall-clock microsecond reading (NTP-synced) and `logical` is a monotonic counter. When two events happen far apart in real time, the physical component orders them — timestamps track real time closely, so snapshots at "now" mean roughly what you expect. When two events happen so close together that physical clocks can't distinguish them (or slightly disagree due to skew), the logical counter breaks the tie and preserves **causality** (happens-before). The clock never runs backwards: on receiving a message with a higher timestamp, a node advances its own clock forward and bumps the logical counter. That's the whole trick — you get *approximately real* timestamps (good for snapshots) *plus* a strict, causal, monotonic order (good for correctness), without atomic clocks. The cost is that you must *assume* a bound on how wrong the physical clocks can be — `max_clock_skew` — and occasionally pay for that assumption with a **read restart** when a read lands inside the ambiguity window.

**Key terms**

- **Hybrid Logical Clock (HLC)** — a clock combining a physical-time component (NTP wall clock) with a logical Lamport-style counter; tracks real time yet guarantees monotonic, causal ordering.
- **Hybrid time / hybrid timestamp** — the `(physical, logical)` timestamp HLC produces; tags every DocDB write and orders MVCC versions and transactions.
- **TrueTime** — Spanner's API returning a bounded time *interval* `[earliest, latest]` from GPS + atomic clocks; the uncertainty is *measured*, not assumed.
- **Commit-wait** — Spanner's technique of sleeping out the uncertainty ε before a commit is visible, guaranteeing external consistency. YugabyteDB does **not** do this.
- **Lamport clock** — logical counter giving happens-before ordering with no physical-time component; HLC's logical half descends from it.
- **max_clock_skew_usec** — the assumed maximum clock skew between nodes (default 500,000 µs = 500 ms). YugabyteDB *trusts* clocks are within this bound; it is the safety margin.
- **Read restart** — when a read might have missed a concurrent write due to skew ambiguity, the read is retried at a safe timestamp so the snapshot stays consistent.
- **Ambiguity window** — the interval (≈ max_clock_skew) in which a write's real ordering versus a read is uncertain; the source of read restarts.
- **NTP / chrony** — the time-sync daemons that keep wall clocks within max_clock_skew; the operational foundation HLC rests on.
- **External consistency / linearizability** — if txn A commits before txn B starts (in real time), A's timestamp is lower; the property Spanner buys with commit-wait and YugabyteDB approximates via HLC + skew bound.

**Why interviewers ask this**

This is the single best question for separating someone who has *operated* a distributed SQL database from someone who has only read the marketing page. A junior answer is "it uses timestamps." A senior answer explains *why* physical clocks alone are insufficient (drift, no global clock), *why* Spanner needs special hardware (to measure uncertainty tightly enough that commit-wait is cheap), and *why* YugabyteDB's HLC is a deliberate portability-for-hardware trade. The follow-up — "so why do I get read-restart errors?" — is where the interviewer finds out whether you understand that consistency in YugabyteDB is *conditional on your clocks being synced*. If you can connect `max_clock_skew_usec`, NTP hygiene, read restarts, and the (unlike-Spanner) absence of commit-wait into one coherent story, you're demonstrating exactly the systems judgment the role needs.

**Common confusions**

- "YugabyteDB uses atomic clocks like Spanner." No — it uses **HLC over commodity NTP**. No GPS, no atomic clocks. That's the entire point.
- "HLC is just a Lamport clock." No — Lamport clocks have no physical-time component, so their timestamps drift arbitrarily from real time. HLC keeps timestamps close to wall-clock time *and* preserves causality.
- "Read restarts are bugs / errors I should suppress." They're a **correctness mechanism** — the system retrying to give you a consistent snapshot. You reduce them by tightening clock sync, not by ignoring them.
- "max_clock_skew is measured like TrueTime's ε." No — it's an *assumed* bound you configure. If real skew exceeds it, guarantees can break. TrueTime *measures* its uncertainty; HLC *assumes* it.
- "Bigger max_clock_skew is safer." It's *safer against skew violations* but *widens the ambiguity window*, causing more read restarts and higher latency. It's a trade, not a free dial.
- "YugabyteDB waits out uncertainty on every commit." No commit-wait — that's a Spanner thing. YugabyteDB avoids that latency tax by using HLC + read restarts instead.

**What follows from this topic**

Hybrid time is the substrate under everything else. The **DocDB / storage** topic uses hybrid timestamps to version MVCC records in RocksDB. The **transactions & isolation** topic relies on hybrid time to order provisional records and pick snapshot timestamps. **Follower reads** and **bounded staleness** are expressed in hybrid time. And the **multi-region** topic inherits the operational rule that clock sync must be tight *everywhere* — cross-region NTP skew directly widens your ambiguity window. Get time right and the rest of YugabyteDB's consistency story stands on solid ground.

### Q1. Why does a distributed database need a notion of time at all — can't each node just use its own clock?

Because correctness properties are defined *across* nodes. To take a **consistent snapshot** (read everything as of one instant), to **order transactions** so everyone agrees who committed first, and to give **MVCC readers** a coherent view, you need a single, agreed ordering of events that live on different machines.

Each node using its own clock fails because **physical clocks drift**. Two servers' wall clocks can disagree by tens or hundreds of milliseconds even with NTP. If node A stamps a write at "10:00:00.100" and node B stamps a later write at "10:00:00.050" (because B's clock is behind), the timestamps *lie* about the real order. A snapshot read could then see the later write but miss the earlier one — a torn, inconsistent view.

There is also **no perfect global clock**: the speed of light and network jitter mean you can't instantaneously broadcast "it is now exactly T" to every node. So distributed databases need a *constructed* notion of time that is (a) close enough to real time to be useful for snapshots and (b) strictly monotonic and causal so ordering is never violated. That's what HLC provides.

### Q2. How did Google Spanner solve the distributed-time problem?

Spanner introduced **TrueTime**: an API backed by **GPS receivers and atomic clocks** deployed in every datacenter. Instead of returning a single instant, TrueTime returns a bounded *interval* — `TT.now() = [earliest, latest]` — that is *guaranteed* to contain the true current time. The width of that interval, ε, is the clock uncertainty, kept small (a few milliseconds) by the specialized hardware.

The second half is **commit-wait**. When a transaction is assigned a commit timestamp `s`, Spanner *waits* until `TT.now().earliest > s` before making the commit visible — i.e. it sleeps out the uncertainty ε. This guarantees that once a transaction commits, its timestamp is definitely in the past for every node, so any transaction that starts afterward gets a strictly higher timestamp.

The payoff is **external consistency** (linearizability across the whole database): if T1 commits before T2 starts in real wall-clock time, T1's timestamp is lower. The cost is that this requires **special, expensive hardware** — GPS and atomic clocks in every datacenter — which is why TrueTime is essentially Google/Spanner-specific and not portable to commodity cloud or on-prem hardware.

### Q3. How does YugabyteDB solve the same problem without special hardware?

With **Hybrid Logical Clocks (HLC)**. An HLC timestamp is a pair `(physical, logical)`:

- **physical** — a wall-clock reading in microseconds, taken from the node's NTP-synced clock.
- **logical** — a monotonic Lamport-style counter used to disambiguate events that share (or nearly share) a physical time.

The clock combines the two so that timestamps **track real time closely** (from the physical component) *and* provide a **strict happens-before ordering** (from the logical component) even when physical clocks disagree slightly. No GPS, no atomic clocks — just commodity servers with NTP.

The trade versus TrueTime: instead of *measuring* a tight uncertainty interval in hardware, YugabyteDB *assumes* an upper bound on clock skew (`max_clock_skew_usec`) and handles the residual ambiguity in software via **read restarts**. This makes YugabyteDB **portable and cheap** to run anywhere — any cloud, any on-prem box — at the cost of relying on NTP hygiene rather than dedicated timekeeping hardware.

### Q4. What exactly is a Hybrid Logical Clock and why does it "work"?

An HLC value is `(physical_time, logical_counter)`. The update rules make it work:

- **On a local event / send**: set `physical = max(local_physical, wall_clock_now)`. If the physical component didn't advance (same microsecond), increment `logical`; otherwise reset `logical` to 0.
- **On receiving a message with timestamp `(p_msg, l_msg)`**: set `physical = max(local_physical, p_msg, wall_clock_now)`, and set `logical` to one more than the max of the relevant logical counters when physical times tie. In short: **advance physical time forward on receipt, and bump the logical counter to preserve causality.**

Two guarantees fall out:

1. **It never goes backwards.** The physical component only ever moves forward (it's a `max`), and within the same physical instant the logical counter strictly increases. Time is monotonic.
2. **It preserves causality.** If event A causally precedes B (A's node sent a message B received), then A's timestamp is strictly less than B's — because B advanced its clock past A's on receipt.

So HLC timestamps are close to real wall-clock time (good for snapshots and human intuition) yet form a total, causal order (good for correctness) — the best of Lamport clocks and physical clocks combined.

### Q5. What is `max_clock_skew_usec` and why does it matter?

`max_clock_skew_usec` is the **assumed maximum clock skew** between any two nodes in the universe — the safety margin YugabyteDB builds its consistency reasoning on. The default is **500,000 µs (500 ms)**.

YugabyteDB *trusts* that every node's physical clock is within this bound of true time. It uses that assumption to decide, when a read at timestamp `T` encounters a write whose timestamp is close to `T`, whether that write *might* actually have happened before the read in real time. The uncertainty window it must account for is roughly `max_clock_skew`.

The critical operational consequence: **if real clock skew ever exceeds `max_clock_skew_usec`, consistency guarantees can be violated** — a read could legitimately miss a write it should have seen. That's why tight time sync (NTP/chrony) is not optional. Conversely, setting the value too *high* to be "safe" widens the ambiguity window and causes more read restarts and higher latency. It's a genuine trade you tune against your fleet's real, measured skew.

### Q6. What is a "read restart" and why does YugabyteDB issue them?

A **read restart** happens when a read might have *missed* a write that could actually have occurred before it in real time, due to clock skew. Rather than return a possibly-inconsistent snapshot, YugabyteDB **retries the read at a safe, higher timestamp** so the snapshot is guaranteed consistent.

Concretely: a read is assigned a snapshot timestamp `T`. It then encounters a record written at `T'` where `T < T' < T + max_clock_skew`. Because the two clocks could be skewed, YugabyteDB *can't be sure* whether that write truly happened after the read's intended instant or just *looks* later due to skew. To stay consistent, it "restarts" the read, advancing the read timestamp to cover the ambiguity so the write is unambiguously included or excluded.

Read restarts are a **correctness feature, not an error to swallow**. On the single-shard fast path they're often handled transparently by the server. In some multi-statement / multi-shard cases you may surface a `read restart` error to the client and need to retry the transaction. Either way, the fix is fewer of them — via tighter clocks — not suppression.

### Q7. How do I reduce read restarts?

The dominant lever is **tighter clock synchronization** — the smaller your real skew, the smaller the ambiguity window, the fewer reads land inside it.

- **Run chrony (or well-tuned NTP) against low-latency, reliable time sources**, ideally the same stratum-1 sources or cloud-provider time service across the whole fleet. Cloud provider time services (e.g. a local time daemon) typically give sub-millisecond skew.
- **Monitor actual skew** and, once you trust it's tight, consider *lowering* `max_clock_skew_usec` toward your measured worst case — a smaller assumed skew directly shrinks the ambiguity window.
- **Prefer single-shard, single-statement reads** where possible; large multi-shard scans have more surface area to hit an ambiguous write.
- **Use follower/bounded-staleness reads** for read-heavy workloads that tolerate slight staleness — reading at an older, safe timestamp sidesteps the fresh-write ambiguity window.
- **Retry at the transaction level** for the read-restart errors you can't eliminate; treat them like a serialization retry.

### Q8. What happens if real clock skew exceeds `max_clock_skew_usec`?

Then YugabyteDB's core assumption is violated and **consistency guarantees can break**. The read-restart machinery is sized to `max_clock_skew`; if two nodes are actually skewed by *more* than that, a read can miss a write that genuinely committed before it, producing a snapshot that isn't linearizable — a real correctness bug, not just latency.

This is why clock skew is a **first-class operational concern**:

- **Monitor it continuously.** YugabyteDB exposes clock-skew metrics; alert when skew approaches a fraction of `max_clock_skew_usec`.
- **Harden time sync.** Use chrony with redundant, low-latency sources; watch for a node whose NTP daemon has died or is chasing a bad upstream.
- **Don't set `max_clock_skew` unrealistically low** just to cut read restarts — you'd be trading latency for a real risk of skew violations.

The healthy operating posture: keep *measured* skew far below `max_clock_skew_usec`, alert well before they converge, and treat a node with runaway skew as a node to pull from the ring.

### Q9. Compare HLC (YugabyteDB) with TrueTime (Spanner).

| Aspect | TrueTime (Spanner) | Hybrid Logical Clock (YugabyteDB) |
|---|---|---|
| Hardware | GPS + atomic clocks in every DC | Commodity servers, NTP only |
| Uncertainty | **Measured** interval ε (a few ms) | **Assumed** bound `max_clock_skew` |
| On commit | **Commit-wait**: sleep out ε | No commit-wait |
| Handling ambiguity | Wait before making commit visible | **Read restarts** on the read path |
| Portability | Google-specific / proprietary | Runs anywhere (any cloud, on-prem) |
| Cost | Expensive specialized hardware | Cheap; relies on NTP hygiene |
| External consistency | Guaranteed by construction | Approximated within the skew bound |

The essence: TrueTime *pays on the write path* (every commit waits out measured uncertainty) using expensive hardware to keep that wait small. HLC *pays on the read path* (occasional read restarts) using free NTP plus a configured skew bound. YugabyteDB deliberately chose portability and no per-commit latency tax over TrueTime's hardware-guaranteed tightness.

### Q10. Does YugabyteDB have a commit-wait, and how does avoiding it affect latency?

**No — YugabyteDB has no commit-wait.** This is a key latency advantage of the HLC approach. In Spanner, *every* transaction pays a `commit-wait` of roughly ε before its commit is visible, so write latency has a built-in floor tied to clock uncertainty. YugabyteDB skips that entirely: a write commits as soon as Raft quorum acknowledges it, with no artificial sleep.

The trade is that the uncertainty doesn't disappear — it's deferred to the **read path** as occasional read restarts. Most reads never hit the ambiguity window and pay nothing; the few that do pay a retry. So instead of taxing *100% of writes* with a wait (Spanner), YugabyteDB taxes *a small fraction of reads* with a restart. For most workloads that's a better deal, especially write-latency-sensitive ones, provided your clocks are well synced so restarts stay rare.

### Q11. How do hybrid-time timestamps tag writes and order MVCC versions and transactions?

Every write that lands in **DocDB** is stamped with a **hybrid timestamp**. Inside each tablet's RocksDB, records are stored as MVCC versions keyed partly by that hybrid time, so a single logical row can hold multiple timestamped versions. Reads pick a snapshot hybrid time and see the latest version *at or below* it — that's how consistent snapshots and time-travel reads work.

For **transactions**, hybrid time provides the total order: a transaction is assigned timestamps for its provisional records (write intents) and a final commit hybrid time. The **transaction status tablet** records the commit, and the commit hybrid time is what makes the transaction's writes visible to readers at or after that time. Because hybrid time is monotonic and causal, all nodes agree on the order in which transactions committed, which is exactly what snapshot and serializable isolation require. In short: hybrid time is the single ruler against which every version and every transaction is measured.

### Q12. What are the external-consistency considerations with HLC?

External consistency (a.k.a. linearizability across the whole database) means: if transaction A finishes before transaction B begins *in real wall-clock time*, then A is ordered before B and B sees A's effects. Spanner guarantees this by construction via commit-wait over measured TrueTime.

YugabyteDB **approximates** external consistency **within the `max_clock_skew` bound**. As long as real clock skew stays under the configured bound, the read-restart mechanism ensures a read can't miss a causally-earlier write, so you get the linearizable behavior you expect. The caveat is the conditional: the guarantee holds *because* clocks are assumed synced within the bound. If that assumption is violated (skew exceeds the bound), external consistency can be violated too.

Practically, this means: (1) for the strongest guarantees, read from tablet leaders (default) rather than followers; (2) keep NTP tight so the skew assumption holds; and (3) understand that "strong consistency" in YugabyteDB is *strong-consistency-conditional-on-bounded-skew*, which for a well-run cluster is effectively always — but it's an operational responsibility, not a hardware guarantee.

### Q13. Does CockroachDB handle time the same way?

Yes — **CockroachDB uses a very similar HLC-based approach**. Like YugabyteDB, it runs Hybrid Logical Clocks over commodity NTP rather than TrueTime hardware, assumes a maximum clock offset (its equivalent of `max_clock_skew`), and uses **read-refresh / read-restart-style** retries to handle the uncertainty window. Both databases descend intellectually from Spanner but deliberately avoid its atomic-clock dependency.

Differences are in the details and defaults (the exact offset bound, how aggressively each surfaces restarts, transaction-retry ergonomics), and CockroachDB will *shut a node down* if it detects its clock has drifted beyond the configured max offset — a safety valve to protect the skew assumption. The high-level story is the same: HLC + NTP + an assumed skew bound + restart-on-ambiguity, chosen for portability over Spanner's proprietary hardware. If an interviewer asks "how is this like Cockroach," this shared HLC lineage is the answer.

### Q14. A developer complains about intermittent "read restart" errors under load. How do you explain and address it?

Start with *what it is, not that it's broken*: a read restart is YugabyteDB protecting snapshot consistency. Under load with lots of fresh writes, more reads land in the ambiguity window (≈ `max_clock_skew`) where a just-written record's real ordering versus the read is uncertain, so the read is retried at a safe timestamp. It's the system being correct, not failing.

Then diagnose and act:

1. **Check clock skew first.** Pull the clock-skew metrics. A single node with a sick NTP daemon and elevated skew widens everyone's ambiguity window. Fixing time sync often makes the problem largely vanish.
2. **Tighten time sync fleet-wide** — chrony against low-latency, consistent sources (ideally the cloud provider's time service). Once measured skew is tiny and stable, consider lowering `max_clock_skew_usec`.
3. **Shape the workload** — favor single-shard/single-statement reads; use follower or bounded-staleness reads for tolerant read paths so they read at an older safe timestamp.
4. **Handle the residue** — wrap transactions in a retry loop; treat read-restart like a serialization-failure retry. Some are unavoidable under heavy fresh-write contention.

The one-line answer: "It's clock-skew ambiguity surfacing as a safe retry — fix your NTP, then shape reads, then retry the rest."

### Q15. Interview framing: "How does YugabyteDB order events across nodes without Spanner's atomic clocks?"

Give the whole arc in four beats:

1. **The problem.** To snapshot and order transactions across nodes you need agreed time, but physical clocks drift and there's no perfect global clock — naive per-node wall clocks produce inconsistent snapshots.
2. **Spanner's answer.** TrueTime uses GPS + atomic clocks to return a *bounded uncertainty interval*, and commit-wait sleeps out that uncertainty so commits are externally consistent. It works, but needs proprietary hardware.
3. **YugabyteDB's answer.** **Hybrid Logical Clocks** — a physical (NTP wall-clock) component plus a logical Lamport counter. Timestamps stay close to real time *and* form a strict, causal, monotonic order. No atomic clocks. The clock advances forward on message receipt and bumps the counter to preserve happens-before; it never goes backwards.
4. **The trade and its cost.** Instead of *measuring* uncertainty, YugabyteDB *assumes* a bound (`max_clock_skew_usec`) and resolves residual ambiguity with **read restarts** — so there's no per-commit wait, but NTP hygiene becomes an operational requirement, and excessive skew can violate guarantees.

Landing it: "YugabyteDB orders events with HLC over commodity NTP — approximately-real timestamps plus a causal counter — trading Spanner's hardware-measured certainty for portability, and paying for it with occasional read restarts instead of commit-wait."

## YSQL — PostgreSQL Compatibility

### Summary

**What this topic covers**

YSQL is YugabyteDB's flagship API: a **fully-relational, PostgreSQL-compatible SQL interface** on top of the distributed DocDB storage engine. This topic explains *why* that compatibility is genuine rather than marketing — YSQL **reuses the actual PostgreSQL source code** for its query layer — what you get as a result (standard SQL, secondary indexes, foreign keys, triggers, stored procedures, views, extensions, the Postgres wire protocol so your existing drivers and ORMs just work), and, crucially, where the abstraction leaks: the features that are unsupported or catching up, the behaviors that differ because storage is distributed, and the migration story from vanilla Postgres. The 17 questions run from the warm-up ("is it *really* Postgres-compatible, can I use my ORM?") to senior migration and performance-diagnosis scenarios. If you take one thing away: YSQL is Postgres's query layer *re-hosted* on a distributed engine, not a Postgres reimplementation — and that framing explains both its strengths and its rough edges.

**Mental model**

Picture a classic Postgres server sliced in half horizontally. The **top half** — the parser, the planner/optimizer, the executor, the type system, PL/pgSQL, the catalog logic — is the actual PostgreSQL C code. The **bottom half** — Postgres's native heap storage, its single-node WAL, its buffer manager — has been *removed and replaced* by **DocDB**: distributed, sharded, Raft-replicated, MVCC-over-RocksDB storage. YSQL runs that Postgres upper half **on every TServer**, and where Postgres would read/write local heap pages it instead issues reads/writes to DocDB tablets that may live on other nodes. This is why compatibility is high (the SQL surface is *literally Postgres*) and why some things behave differently (a `SERIAL` sequence is now a distributed coordination point; a join may cross the network; the planner's cost assumptions were written for local pages, not remote tablets). Hold this "Postgres head on a distributed body" image and almost every YSQL quirk becomes predictable.

**Key terms**

- **YSQL** — YugabyteDB's PostgreSQL-compatible, fully-relational SQL API; the flagship interface.
- **PostgreSQL query-layer reuse** — YSQL runs the real Postgres parser, planner/optimizer, and executor code, not a clone; the root cause of high compatibility.
- **DocDB** — the distributed document store (sharded, Raft-replicated, MVCC RocksDB) that YSQL sits on in place of Postgres's native heap/WAL.
- **Wire protocol compatibility** — YSQL speaks the Postgres frontend/backend protocol, so Postgres drivers/ORMs connect unchanged.
- **`ysqlsh`** — YugabyteDB's `psql`-compatible interactive shell.
- **PL/pgSQL** — Postgres's procedural language; supported for stored procedures/functions in YSQL.
- **Extensions** — Postgres extensions like `pg_stat_statements`, `pgcrypto`, `fuzzystrmatch`, PostGIS; a subset is supported.
- **PG version tracking** — the Postgres major version YSQL's query layer is based on (advancing over releases, e.g. PG 11 → 15), which determines available SQL features.
- **ysql_dump / ysql_dumpall** — YugabyteDB's `pg_dump`-compatible schema/data export tools.
- **YugabyteDB Voyager** — the end-to-end migration tool for moving schema + data from Postgres (and other DBs) to YugabyteDB.
- **Colocation / tablespaces** — distributed-placement features (colocated small tables; tablespace-based geo placement) that have no vanilla-Postgres equivalent.
- **YCQL** — YugabyteDB's *other*, Cassandra-flavored semi-relational API; the non-Postgres alternative to YSQL.

**Why interviewers ask this**

Because "Postgres-compatible" is the headline claim, and interviewers want to know whether you understand the *mechanism* behind it or just repeat the slogan. A junior candidate says "it's like Postgres." A senior candidate says "it *reuses the Postgres query layer* on top of distributed storage, which is why my JDBC driver and Django ORM work unchanged, but also why sequences contend, why some extensions lag, and why the PG version it tracks matters for which SQL features I can use." The question is also a proxy for migration judgment: can you assess whether an existing Postgres app will lift-and-shift cleanly, and what to test (sequences, unsupported extensions, distributed-execution performance)? That blend of *how it works* + *what breaks in practice* is exactly the signal.

**Common confusions**

- "YSQL is a Postgres clone / reimplementation." No — it **reuses the real Postgres source** for the query layer. That's the whole reason compatibility is high.
- "If it's Postgres-compatible, everything works identically." No — storage is distributed, so sequences contend, some plans differ, a few extensions are unsupported, and the tracked PG version gates newer features.
- "My ORM definitely won't work." Usually it *does* — same wire protocol means psql, JDBC, psycopg, Django, Rails, Hibernate, Prisma mostly point-and-go. You test the edges, not the basics.
- "YSQL and YCQL are two databases." One storage engine (DocDB), two APIs. YSQL is the relational Postgres one; YCQL is the Cassandra-flavored one.
- "It's the latest Postgres." It tracks a *specific* PG major version that advances over releases; don't assume the newest PG feature is present — check the version.
- "SERIAL works exactly like in Postgres." It works, but a global sequence is a distributed coordination point — mind caching/contention at scale.

**What follows from this topic**

YSQL compatibility is the gateway to the rest of the relational story. The **data modeling** topic builds directly on it: because YSQL is real SQL you *can* normalize and use foreign keys — but PK design now also controls sharding, which vanilla Postgres never had to worry about. The **transactions/isolation** topic maps Postgres isolation levels onto YugabyteDB's distributed implementation. **Extensions, indexes, and performance tuning** all inherit "it's Postgres, but distributed." And the migration tooling here (`ysql_dump`, Voyager) is what you reach for when moving a real Postgres workload over. Understand *why* YSQL is compatible, and every downstream topic reads as "Postgres semantics, distributed consequences."

### Q1. What is YSQL and how does it relate to PostgreSQL?

**YSQL is YugabyteDB's flagship API: a fully-relational, PostgreSQL-compatible SQL interface** built on the distributed DocDB storage engine. It gives you familiar relational SQL — tables, joins, constraints, transactions — but backed by horizontal scale-out, strong consistency, and no single point of failure.

The relationship to Postgres is unusually deep. YSQL doesn't *imitate* Postgres — it **reuses the actual PostgreSQL source code** for its query layer (parser, planner/optimizer, executor, type system, PL/pgSQL). That Postgres upper half runs on each YugabyteDB TServer, but instead of writing to Postgres's native single-node heap and WAL, it reads and writes to **DocDB**: sharded, Raft-replicated, MVCC storage.

So the mental one-liner is: **YSQL = the real Postgres query layer re-hosted on distributed storage.** That's why it speaks the Postgres wire protocol, works with Postgres drivers and ORMs, and supports genuine SQL features — while also inheriting distributed-systems behaviors that vanilla Postgres never had.

### Q2. Why is YSQL's PostgreSQL compatibility "genuine" and not just a similar dialect?

Because of one architectural fact: **YSQL reuses the actual PostgreSQL source code for its query layer.** The parser that reads your SQL, the planner/optimizer that builds the query plan, and the executor that runs it are *Postgres's own code*, not a reimplementation.

This matters because reimplementations always diverge — a clone chases Postgres's behavior forever and never quite matches its edge cases, function semantics, type coercions, or SQL grammar. By *reusing* the real code, YSQL inherits Postgres semantics for free: the same functions behave the same way, the same SQL parses the same, PL/pgSQL runs the same procedures.

What Yugabyte replaced is the **storage layer beneath** the query engine — Postgres's heap/WAL swapped for DocDB. So compatibility is high *at the SQL surface* precisely because that surface is unchanged Postgres code; the divergences live *underneath*, in how data is stored, sharded, and executed across nodes. That's a fundamentally different (and stronger) compatibility story than "same-ish dialect."

### Q3. What SQL features do I get in YSQL because of this reuse?

Effectively the relational feature set of the Postgres version YSQL tracks:

- **Full SQL** — inner/outer/cross joins, subqueries, CTEs (including recursive), window functions, aggregates, `GROUP BY`/`HAVING`, set operations.
- **Secondary indexes** — including unique, partial, and expression indexes (distributed and sharded themselves).
- **Foreign keys and constraints** — `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `CHECK`, `NOT NULL`.
- **Triggers** — row- and statement-level, `BEFORE`/`AFTER`.
- **Stored procedures and functions** — in **PL/pgSQL** (and other PLs to varying degrees).
- **Views and materialized views**.
- **Transactions** — `BEGIN`/`COMMIT`/`ROLLBACK`, savepoints, multiple isolation levels.
- **Rich types** — numeric, text, `JSONB`, arrays, `UUID`, timestamps, etc.
- **Many extensions** — `pg_stat_statements`, `pgcrypto`, `fuzzystrmatch`, PostGIS, and more.

```sql
CREATE TABLE authors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES authors(id),
  title text NOT NULL,
  published date
);
CREATE INDEX ON books (author_id);

SELECT a.name, count(*) AS book_count
FROM authors a JOIN books b ON b.author_id = a.id
GROUP BY a.name
HAVING count(*) > 1;
```

This is real relational SQL — the same query you'd write against Postgres — running on a distributed engine.

### Q4. Can I use my existing PostgreSQL drivers and ORMs with YugabyteDB?

**Mostly, yes — because YSQL speaks the same Postgres wire protocol.** Point your client at YugabyteDB's YSQL port (5433 by default) and standard Postgres tooling connects unchanged:

- **Drivers**: `psql`/`ysqlsh`, JDBC (PostgreSQL JDBC), `psycopg`/`psycopg2` (Python), `pq`/`pgx` (Go), Npgsql (.NET), node-postgres.
- **ORMs / frameworks**: Django, Rails/ActiveRecord, Hibernate, Prisma, SQLAlchemy, TypeORM, GORM.

Because the protocol and SQL surface are Postgres, these generally "just work" for the common path — connect, query, transact.

Two nuances a senior answer adds:

1. **Smart drivers.** YugabyteDB ships *cluster-aware* JDBC/psycopg drivers that load-balance across nodes and are topology-aware. Plain Postgres drivers work too, but the smart drivers avoid funneling all connections through one node.
2. **Test the edges.** Sequence-heavy inserts, unsupported extensions, and distributed-execution performance are where you validate — not the basic CRUD, which is fine.

So the honest answer is "yes for the vast majority of your app; test sequences, extensions, and hot-path performance."

### Q5. What is `ysqlsh`?

`ysqlsh` is YugabyteDB's **`psql`-compatible interactive shell** — a fork of Postgres's `psql` for talking to YSQL. If you know `psql`, you already know `ysqlsh`: same meta-commands (`\d`, `\dt`, `\l`, `\du`, `\timing`, `\copy`), same query editing, same output formatting.

```bash
ysqlsh -h 127.0.0.1 -p 5433 -U yugabyte -d yugabyte
# \dt            list tables
# \d books       describe a table
# \timing on     show query timings
```

You can also just use stock `psql` against the YSQL port — it works, because of wire-protocol compatibility. `ysqlsh` is simply the version shipped and tested with YugabyteDB.

### Q6. Where does YSQL differ from vanilla PostgreSQL?

The differences almost all trace back to *storage is distributed*:

- **Sequences / `SERIAL`** — a sequence is a global coordination point; naive high-rate inserts contend. Use sequence caching, `UUID`s, or hash-distributed keys.
- **Monotonic primary keys** — a `SERIAL`/timestamp PK on a range-sharded table creates a **hotspot** (the modeling topic's #1 anti-pattern); Postgres never cared, YugabyteDB does.
- **Some extensions unsupported** — many work, but not all; check the supported list before relying on one.
- **PG version lag** — YSQL tracks a *specific* Postgres major version (advancing over releases); the very newest PG feature may not be present yet.
- **Distributed-execution nuances** — query plans and cost characteristics differ because reads can cross the network; some plans that are cheap in single-node PG are not, and vice versa.
- **Placement features with no PG analog** — **colocation** and **tablespace-based geo placement** are YugabyteDB-specific.
- **Certain DDL/behavioral edges** — some operations behave differently or have distributed-specific options (`SPLIT INTO`, `HASH`/`ASC`/`DESC` in PK DDL).

The pattern: *SQL surface = Postgres; storage, distribution, and performance = distributed system.*

### Q7. Why do some PostgreSQL features lag or remain unsupported in YSQL?

Because each feature has to be **adapted to the distributed storage and execution engine**, not just inherited. The query-layer *code* is reused, but anything that touches storage, transactions, or execution must be re-plumbed onto DocDB and made to work correctly across sharded, Raft-replicated tablets.

For example: a feature that assumes local heap access, single-node locking, or Postgres's native WAL can't be dropped in unchanged — it needs a distributed implementation that preserves consistency across nodes. Sequences had to become distributed-coordination-aware; certain index or extension internals that reach into storage need porting; newer PG-version features arrive as Yugabyte advances the reused PG base version.

So the lag isn't sloppiness — it's the cost of guaranteeing that each feature behaves correctly *and* consistently in a distributed setting. The reused query layer gets you most of the way for free; the last mile (storage-touching behavior) is deliberate, careful work, which is why some features trail vanilla Postgres.

### Q8. What's the migration story from PostgreSQL to YugabyteDB?

Two layers: **schema/app compatibility** and **tooling**.

Because YSQL is Postgres-compatible at the SQL and wire-protocol level, **schema and application code are highly portable** — much of your DDL, queries, and ORM code moves with minimal change. The work is in the distributed-specific parts.

Tooling:

- **`ysql_dump` / `ysql_dumpall`** — `pg_dump`-compatible export of schema and data.
- **YugabyteDB Voyager** — the end-to-end migration tool: it assesses the source schema, flags what needs changes, converts and imports schema + data, and can do live/CDC-based migration to cut over with minimal downtime.

The distributed-specific migration work you plan for:

1. **Rework primary keys** for sharding — add `HASH`/`ASC`/`DESC`, fix monotonic-key hotspots (SERIAL/timestamp PKs).
2. **Handle sequences** — decide caching vs UUIDs to avoid contention.
3. **Check extensions** — confirm each one you use is supported.
4. **Re-test performance** — distributed execution changes cost characteristics; validate hot paths.

So: lift the schema/app with high fidelity, then deliberately adapt PKs, sequences, extensions, and performance for distribution.

### Q9. How do performance characteristics differ from single-node PostgreSQL?

The fundamental difference is **the network is now in the loop**. Single-node Postgres reads local heap pages and commits to a local WAL; YSQL reads from DocDB tablets that may live on other nodes and commits via **Raft quorum** across replicas. So:

- **Writes** pay Raft replication latency (a quorum round-trip); in multi-region clusters this can be cross-region and dominate write latency.
- **Reads** may fan out across tablets/nodes; a query the Postgres planner thinks is cheap (assuming local pages) can involve remote round-trips.
- **Joins and secondary-index lookups** can cross tablet boundaries, adding network hops the single-node cost model didn't anticipate.
- **Sequences** become a distributed coordination point rather than a cheap local counter.

The upside is **horizontal scale** and fault tolerance Postgres can't match — you add nodes to add throughput and survive failures with no SPOF. The tuning mindset shifts from "minimize disk I/O on one box" to "minimize cross-node/cross-region round-trips and distribute load evenly." Good PK/sharding design (next topic) is how you win back locality.

### Q10. What PostgreSQL version is YSQL based on, and why does it matter?

YSQL's query layer is based on a **specific PostgreSQL major version** that YugabyteDB **advances over releases** — historically tracking older versions and moving forward (e.g. from PG 11 toward PG 15 and beyond across YugabyteDB releases).

It matters because the **available SQL features, functions, and syntax are those of the tracked PG version**. If a feature landed in a Postgres version newer than the one YSQL currently tracks, it may not be present yet. So before relying on a recent Postgres capability, check which PG version your YugabyteDB release is based on.

This is also why "is it the latest Postgres?" is the wrong question — it's *a* Postgres, at a defined version, moving forward deliberately (each version bump means re-basing the reused Postgres source onto the distributed engine, which is real work). For migration planning, match your source Postgres version's feature usage against YSQL's tracked version and flag any gaps.

### Q11. When does YSQL "just work" versus need tweaks?

**Just works** (the common path):
- Standard DDL: tables, columns, constraints, foreign keys, indexes.
- Standard DML and queries: CRUD, joins, subqueries, CTEs, window functions, aggregates.
- Transactions, PL/pgSQL procedures, views, triggers.
- Connecting via Postgres drivers/ORMs over the wire protocol.
- Supported extensions.

**Needs tweaks** (the distributed edges):
- **Primary key design** — add `HASH`/`ASC`/`DESC`; fix monotonic-key hotspots.
- **Sequences at scale** — caching or UUIDs to avoid contention.
- **Unsupported extensions** — find an alternative or confirm support.
- **Newest PG features** — verify they exist in the tracked PG version.
- **Performance-sensitive paths** — re-test; a plan cheap in single-node PG may cross the network.
- **Placement / geo** — use colocation and tablespaces (no PG equivalent).

Rule of thumb: **the SQL surface just works; the storage-and-distribution-facing choices need deliberate design.**

### Q12. Show a concrete example of using a Postgres extension in YSQL.

Extensions are created the standard Postgres way with `CREATE EXTENSION`, and supported ones behave as in Postgres.

```sql
-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SELECT gen_random_uuid();                         -- random UUID
SELECT crypt('s3cret', gen_salt('bf'));           -- bcrypt hash

-- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT query, calls, total_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 5;
```

`pg_stat_statements` is especially useful on YugabyteDB for finding the queries that cross the network or hit hotspots. Other commonly-used supported extensions include `fuzzystrmatch`, `uuid-ossp`, and PostGIS. Always confirm a given extension is on YugabyteDB's supported list before depending on it — the set is broad but not the entire Postgres ecosystem, because some extensions reach into storage internals that had to be adapted for DocDB.

### Q13. An interviewer asks: "Is YSQL *really* Postgres-compatible, or is that marketing?"

Give the mechanism, then the caveats — that's the credible answer.

**The mechanism (why it's real):** YSQL **reuses the actual PostgreSQL source code** for its query layer — parser, planner, executor, PL/pgSQL. It's not a clone chasing Postgres behavior; it *is* Postgres's query engine, re-hosted on distributed DocDB storage. That's why it speaks the Postgres wire protocol and why your JDBC driver, psql, and Django ORM connect unchanged.

**The caveats (where it's honest, not marketing):** compatibility is high at the SQL surface but not 100%, because storage is distributed. Sequences contend, some extensions are unsupported, it tracks a specific PG version (so the newest feature may lag), and performance differs because the network is in the loop.

**The landing:** "It's genuinely Postgres-compatible because it reuses the Postgres query layer — so most apps and ORMs work with little change — but it's Postgres *re-hosted on a distributed engine*, so I'd test sequences, extensions, and hot-path performance rather than assume byte-identical behavior." That balance — real compatibility, honest edges — is the senior answer.

### Q14. "I'm on Postgres with Hibernate and a couple of extensions. Will it lift-and-shift to YugabyteDB?"

Likely yes for the bulk of it, with a targeted checklist:

1. **App + Hibernate**: works over the Postgres wire protocol; consider the **YugabyteDB smart JDBC driver** for cluster-aware load balancing so connections don't funnel through one node.
2. **Schema**: import via `ysql_dump`/Voyager. Then **rework primary keys** for sharding — this is the real work. Any `SERIAL`/timestamp/`BIGSERIAL` PK needs a hotspot review (hash-shard or switch to UUIDs).
3. **Sequences**: if you rely on `SERIAL` at high insert rates, plan for sequence caching or UUIDs to avoid distributed-coordination contention.
4. **Extensions**: check each against YugabyteDB's supported list; find alternatives for any unsupported ones.
5. **PG version**: verify any newer Postgres features you use exist in the tracked PG version.
6. **Performance**: re-test hot paths; distributed execution and Raft-quorum writes change cost characteristics — a fine single-node query may now cross the network.

Use **Voyager** to assess the schema up front — it flags most of the above automatically. Summary: expect a high-fidelity lift, then budget deliberate effort for PKs, sequences, extensions, and performance validation.

### Q15. How does YSQL compare to YCQL, briefly?

Both APIs sit on the **same DocDB storage engine**, but they're aimed at different needs:

| | YSQL | YCQL |
|---|---|---|
| Model | Fully-relational, PostgreSQL-compatible | Semi-relational, Cassandra-CQL-compatible |
| Query layer | Reused Postgres parser/planner/executor | Cassandra-flavored |
| Joins | Yes | No (denormalize, like Cassandra) |
| Foreign keys / triggers / PL | Yes | No |
| Transactions | Full distributed ACID, multiple isolation levels | Limited/single-row + some multi-row |
| Wire protocol | Postgres | Cassandra CQL |
| Best for | Relational apps, Postgres migrations, complex SQL | Cassandra-style workloads wanting strong consistency + global indexes |

**YSQL is the flagship** and the default choice for new relational applications and Postgres migrations. YCQL exists for teams with Cassandra-shaped workloads (wide rows, denormalized access) who want YugabyteDB's strong consistency and distributed indexes without adopting full SQL. When in doubt, use YSQL. (YCQL gets its own topic — treat this as a preview.)

### Q16. Walk through creating a table, a join, and an index in YSQL — anything distributed-specific to note?

The SQL is standard Postgres; the one distributed-specific habit is being deliberate about the **primary key's sharding**.

```sql
-- Note the HASH sharding on the PK — even distribution for point lookups
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- hash-sharded by default
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE orders (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  order_ts timestamptz DEFAULT now(),
  amount numeric,
  -- hash on user_id to distribute, range on order_ts for time-ordered reads
  PRIMARY KEY ((user_id) HASH, order_ts DESC)
);

-- A secondary index is itself distributed and sharded
CREATE INDEX ON orders (user_id);

-- Standard relational join — real SQL, runs across the distributed engine
SELECT u.email, count(o.id) AS order_count, sum(o.amount) AS total
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.email;
```

Everything here is ordinary Postgres SQL — the join, the aggregate, the index. The *only* distributed-aware choices are in the PK DDL (`HASH` vs `ASC`/`DESC`) and knowing the secondary index is itself sharded. That's the recurring theme: Postgres SQL, distributed data-modeling discipline.

### Q17. Diagnose: a query that was fast on single-node Postgres is slow on YugabyteDB. What do you check?

Frame it as "the network entered the loop" and work down:

1. **`EXPLAIN (ANALYZE, DIST)`** — YSQL's `EXPLAIN` shows distributed round-trips and rows fetched from DocDB. Look for many storage round-trips or large scans that were cheap locally but aren't remotely.
2. **Hotspot?** If the table has a **monotonic PK** on a range-sharded table, writes/reads may pile on one tablet/node. Check for a single hot tablet — the #1 cause. Redesign the PK (hash-shard or composite).
3. **Cross-tablet / cross-node fan-out** — a join or index lookup crossing tablet boundaries pays network hops. Consider colocation for small tables, or a PK/index design that keeps related rows on the same tablet.
4. **Missing/poor secondary index** — without a matching distributed index, a query may scan broadly across tablets. Add an index aligned to the access pattern (and mind *its* sharding).
5. **Multi-region write latency** — if the cluster is stretched across regions, writes pay cross-region Raft quorum. Check topology; consider geo-partitioning or follower reads.
6. **Sequence contention** — high-rate `SERIAL` inserts serialize on the sequence; check for it and switch to caching/UUIDs.

The mindset shift from Postgres tuning: you're no longer minimizing local disk I/O — you're **minimizing cross-node and cross-region round-trips and evening out load**. Most "slow on YugabyteDB" cases are a hotspot or an access pattern that fans out across tablets, both fixable with schema/PK design.

## YSQL Data Modeling & Schema Design

### Summary

**What this topic covers**

How to design schemas and — above all — **primary keys** in YugabyteDB, where the PK is not merely an index (as in Postgres) but the **sharding key** that decides how data is distributed across the cluster. This topic covers the central `HASH` vs range (`ASC`/`DESC`) choice in PK DDL and their opposite trade-offs; the **#1 anti-pattern** (a monotonically increasing PK creating a single-tablet hotspot); the canonical **composite PK** pattern (hash-partition part + range-clustering part) for multi-tenant and time-series data; hotspot-avoidance techniques (hashing, salting/bucketing, random UUIDs, reverse timestamps); `SERIAL`/sequence contention at scale; colocated tables and tablespaces; the cost of foreign keys and secondary indexes across tablets; and the normalize-vs-denormalize calculus in a *distributed SQL* setting (unlike Cassandra, you *can* join — but cross-tablet joins cost network). The 16 questions center on the interviewer's favorite: "design the schema/PK for this table at scale, and spot the hotspot." The mental shift to internalize: in YugabyteDB, **PK design is capacity and performance design**, not just uniqueness.

**Mental model**

In single-node Postgres, the primary key is *just a unique B-tree index* — where a row physically lives is irrelevant. In YugabyteDB, **the primary key IS the sharding key**: it determines which **tablet** (and therefore which node) a row lives on. So one DDL decision now controls three things at once — uniqueness, data distribution, and query performance. The core lever is in the PK definition itself: **`HASH`** scatters rows evenly across tablets by a hash of the key (great for point lookups and write scaling, but you lose ordered range scans on that key), while **range** (`ASC`/`DESC`) keeps rows physically ordered (great for `ORDER BY` and range queries, but a monotonically increasing key funnels every new write to the *last* tablet on *one* node — a hotspot). The winning pattern for most real tables is a **composite** PK: hash on a distribution column to spread load, then range on a second column to keep related rows ordered and local. Design the PK for the *access pattern*, and the cluster scales; design it like a Postgres PK, and you get hotspots.

**Key terms**

- **Primary key = sharding key** — in YugabyteDB the PK determines tablet placement, so PK design drives distribution and performance, not just uniqueness.
- **Tablet** — the unit of sharding, replication (RF=3 Raft group), and load balancing; rows map to tablets by their PK.
- **HASH sharding** — `PRIMARY KEY ((col) HASH)`; distributes rows by hash for even load and write scaling; **no ordered range scans** on that key.
- **Range sharding** — `PRIMARY KEY (col ASC|DESC)`; keeps rows ordered for efficient range queries and `ORDER BY`; risks a hotspot on monotonic keys.
- **Hotspot** — one tablet/node taking a disproportionate share of load, classically from a monotonically increasing range-sharded PK (timestamp, `SERIAL`, sequence, UUIDv1).
- **Composite PK (hash + range)** — `PRIMARY KEY ((hash_col) HASH, range_col ASC|DESC)`; distribute by the hash part, order within it by the range part. The canonical multi-tenant/time-series pattern.
- **Salt / bucket** — an extra column (e.g. `hash(id) % N`) mixed into the key to spread an otherwise-monotonic key across N tablets.
- **Colocated table** — a small table placed in one shared tablet so joins between small tables are local and per-table tablet overhead is avoided.
- **Tablespace** — used in YugabyteDB for data placement / geo-partitioning (pinning rows to regions), not just physical storage.
- **`SPLIT INTO`** — presplits a table into N tablets at creation to avoid a single-tablet start and reduce initial rebalancing.
- **Sequence / `SERIAL`** — a global auto-increment; in a distributed DB it's a coordination point that can contend at scale.

**Why interviewers ask this**

This is *the* practical YugabyteDB design question, and it's where the mental shift from single-node databases either shows up or doesn't. A junior candidate designs a Postgres schema — `id SERIAL PRIMARY KEY`, timestamp PK on an events table — and unknowingly builds a hotspot that pins the whole write workload to one node. A senior candidate reasons from the *access pattern* to the sharding: hash the distribution column, range the ordering column, avoid monotonic range PKs, salt where needed, and know when to colocate small tables or presplit big ones. Interviewers give you a table ("orders", "events", "multi-tenant users") and watch whether you (a) recognize the PK is the sharding key, (b) can spot the hotspot, and (c) can propose the composite-PK fix. Getting this right signals you can actually run a distributed SQL database in production, not just pass CRUD through it.

**Common confusions**

- "The PK is just a unique index like in Postgres." In YugabyteDB the **PK is the sharding key** — it controls where data lives and how load spreads.
- "A timestamp or `SERIAL` PK is fine." On a **range-sharded** table it's the **#1 hotspot** — every new row hits the last tablet on one node. Hash it, salt it, or use a random UUID.
- "Hash sharding is always best." Hash gives even distribution but **kills ordered range scans** on that key; for time-range queries you need a range component.
- "UUIDs are always safe." Random `uuid4` is; **time-ordered UUIDv1** is effectively monotonic and can hotspot on a range key.
- "Just normalize like Postgres." You *can* normalize and join (unlike Cassandra), but **cross-tablet joins and foreign keys cost network** — model for locality.
- "Secondary indexes are free / local." They're **themselves distributed and sharded**, with their own placement to choose.

**What follows from this topic**

This is where the whole primer becomes actionable. It builds directly on **YSQL — PostgreSQL Compatibility** (you *have* real SQL, FKs, joins — now use them wisely under distribution) and on **sharding/tablets** (the PK is how rows map to tablets). It feeds **secondary indexes** (which are themselves sharded — choose their distribution too), **transactions** (cross-tablet writes and FKs invoke the distributed-transaction path), and **multi-region** (tablespaces pin rows to regions for residency and local latency). Master PK design and hotspot avoidance here, and the performance and geo topics become tuning exercises rather than firefighting. The one sentence to carry forward: **in YugabyteDB, you design the primary key for the access pattern, because the primary key is the sharding key.**

### Q1. In YugabyteDB, why is primary-key design more important than in PostgreSQL?

Because **the primary key is the sharding key.** In single-node Postgres, the PK is *just a unique B-tree index* — it enforces uniqueness, and where the row physically sits doesn't matter for scale. In YugabyteDB, the PK additionally decides **which tablet** (and therefore **which node**) each row lives on.

That means one DDL choice now controls three things simultaneously:

1. **Uniqueness** (as in Postgres).
2. **Data distribution** — how evenly rows spread across the cluster.
3. **Query performance** — whether point lookups and range scans are efficient, and whether writes concentrate or spread.

Get it wrong and you build a **hotspot**: e.g. a `SERIAL` or timestamp PK funnels every new write to one tablet on one node, and adding nodes doesn't help because the load isn't distributed. Get it right — hash the distribution column, range the ordering column — and the cluster scales linearly.

So the mental shift from Postgres is: **PK design is capacity and performance design, not just a uniqueness constraint.** You design it from the *access pattern*, not by reflex `id SERIAL PRIMARY KEY`.

### Q2. Explain HASH vs range sharding in the primary-key DDL, with trade-offs.

The choice is expressed *in the PK definition itself*:

```sql
-- HASH-sharded: rows scattered by hash(id)
CREATE TABLE users (id uuid, PRIMARY KEY ((id) HASH));

-- Range-sharded: rows kept in sorted order by created_at
CREATE TABLE events (created_at timestamptz, PRIMARY KEY (created_at ASC));
```

| | HASH (`((col) HASH)`) | Range (`(col ASC/DESC)`) |
|---|---|---|
| Distribution | Even, by hash of key | By key order (contiguous ranges) |
| Best for | Point lookups, write scaling | Range queries, `ORDER BY`, `BETWEEN` |
| Range scans on key | **No** (keys scattered) | **Yes** (efficient) |
| Hotspot risk | Low (spreads writes) | **High if key is monotonic** |
| Typical use | Surrogate IDs, user IDs | Time series *within a partition* |

**Hash** buys you even load and write scaling but sacrifices ordered scans on that key — you can't efficiently do `WHERE id BETWEEN` or `ORDER BY id` because the keys are deliberately scattered. **Range** buys you ordered access — efficient range and `ORDER BY` queries — but if the key increases monotonically (timestamp, sequence), every new write lands on the *last* tablet, creating a hotspot on one node.

The real-world answer for most tables is **neither alone but a composite**: hash a distribution column, range an ordering column (next question).

### Q3. What is the #1 primary-key anti-pattern in YugabyteDB?

**A monotonically increasing primary key on a range-sharded table.** That includes:

- `id SERIAL` / `BIGSERIAL` PRIMARY KEY
- a sequence-backed key
- `created_at`/timestamp as a range PK
- **UUIDv1** (time-ordered UUIDs)

The problem: range sharding keeps rows in sorted order across tablets, so the "newest" values all live in the *last* tablet. If the key always increases, **every new insert targets that one last tablet on one node** — a **hotspot**. Your write throughput is capped at a single node's capacity, and adding nodes to the cluster doesn't help, because the load isn't distributed. This is the classic "I scaled out but writes didn't get faster" trap.

```sql
-- ANTI-PATTERN: every insert hits the last tablet -> single-node hotspot
CREATE TABLE events (
  ts timestamptz,
  payload jsonb,
  PRIMARY KEY (ts ASC)      -- monotonic range key = hotspot
);
```

Fixes: **hash-shard** the key, **salt/bucket** it, use a **random UUID (uuid4)**, or make it a **composite** PK (hash a distribution column, range the timestamp *within* it). Spotting this in a schema is exactly what interviewers test.

### Q4. Show the canonical composite primary-key pattern and when to use it.

**Hash on a distribution column, range on a clustering column** — distribute load *across* the hash part, keep rows ordered *within* it:

```sql
CREATE TABLE order_events (
  tenant_id uuid,
  created_at timestamptz,
  event_id uuid,
  payload jsonb,
  -- hash tenant_id to spread tenants across the cluster,
  -- range created_at DESC for time-ordered reads within a tenant
  PRIMARY KEY ((tenant_id) HASH, created_at DESC, event_id)
);
```

The `(tenant_id) HASH` part scatters tenants evenly across tablets (no hotspot, write-scalable). The `created_at DESC` part keeps each tenant's rows time-ordered *within* its tablet range, so this query is efficient and local:

```sql
SELECT * FROM order_events
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT 50;             -- newest events for one tenant, no full scan
```

**Use it for** multi-tenant tables (hash the tenant, order within), time-series per entity (hash the device/user, range the timestamp), and any "give me the recent rows *for this key*" access pattern. It's the workhorse YugabyteDB PK — it gets you Cassandra-style partition+clustering behavior while staying in relational SQL. The key insight: the monotonic column (`created_at`) is safe here because it's a **range component *within* a hashed partition**, not the top-level shard key.

### Q5. What techniques avoid hotspots?

Five main levers, roughly in order of preference:

1. **Hash-shard the key** — `PRIMARY KEY ((id) HASH)`. Default for surrogate keys; spreads writes evenly. Use when you don't need ordered scans on that key.
2. **Use random UUIDs (`uuid4`), not sequential IDs** — `gen_random_uuid()` distributes naturally. Avoid **UUIDv1** (time-ordered = effectively monotonic).
3. **Composite hash + range** — hash a distribution column, range the monotonic column *within* it, so time-ordering is safe inside a partition.
4. **Salt / bucket a monotonic key** — prepend a bucket like `hash(x) % N` so a naturally-increasing value spreads across N tablets:
   ```sql
   CREATE TABLE metrics (
     bucket smallint,            -- e.g. hash(sensor_id) % 16
     ts timestamptz,
     sensor_id uuid, value double precision,
     PRIMARY KEY ((bucket) HASH, ts DESC)
   );
   ```
   Trade-off: a full time-range scan must fan out across all N buckets.
5. **Reverse-timestamp tricks** — occasionally used to reshape ordering, but hashing/salting is usually cleaner.

The through-line: **never let a monotonically increasing value be the top-level shard key**. Distribute it (hash/salt/UUID) or demote it to a range component under a hashed partition.

### Q6. How do SERIAL / sequences behave at scale, and what are the alternatives?

A `SERIAL` (or any sequence) is a **global, monotonic counter** — and in a distributed database, generating the next value is a **distributed-coordination point**. Every node that needs an id must coordinate to get a unique, increasing value, so at high insert rates the sequence becomes a **contention and latency bottleneck**. Worse, the resulting keys are monotonic, so if used as a range PK they *also* create a hotspot (double whammy).

Alternatives, best first:

- **Random UUIDs** — `id uuid DEFAULT gen_random_uuid()` with `PRIMARY KEY ((id) HASH)`. No coordination, no hotspot. The default recommendation for surrogate keys at scale.
- **Sequence caching** — if you truly need integer ids, cache a block of values per node so coordination happens once per block, not per row:
  ```sql
  CREATE SEQUENCE user_id_seq CACHE 10000;  -- amortize coordination
  ```
  Reduces contention, but ids are non-contiguous across nodes and still monotonic-ish (hash the key if used as PK).
- **Hash the id** — if you keep an integer id, shard it with `((id) HASH)` so at least distribution is even.

Rule of thumb: **prefer UUIDs; if you must have sequences, cache aggressively and hash the resulting key.**

### Q7. What are colocated tables and when should you use them?

**Colocated tables** are small tables placed together in **one shared tablet** rather than each getting their own tablet(s). Two benefits:

1. **Local joins** — because colocated tables live on the same tablet/node, joins between them (and lookups) are **local**, avoiding cross-node network hops.
2. **Less tablet overhead** — a schema with *many small tables* (reference/lookup tables, config, small dimension tables) would otherwise create lots of tablets, each with its own Raft group and overhead. Colocating them collapses that overhead.

```sql
-- Create a colocated database, then small tables share one tablet
CREATE DATABASE app WITH COLOCATION = true;
-- reference tables here are colocated by default; opt big tables out
CREATE TABLE big_events (...) WITH (COLOCATION = false);
```

**Use colocation for**: many small tables, reference/lookup data, small dimension tables joined frequently — the classic "lots of little tables" schema. **Don't colocate** large, high-throughput tables — they need their own tablets to distribute load; forcing them into one shared tablet recreates a hotspot. The pattern: colocate the small stuff for locality, shard the big stuff for scale.

### Q8. How do tablespaces relate to data placement and geo-distribution?

In YugabyteDB, **tablespaces are repurposed for placement policy** — deciding *which regions/zones* a table's (or partition's) tablets live in — rather than Postgres's original "which disk directory." You define a tablespace with a placement spec, then create tables/partitions in it to **pin their data to specific regions**.

This is the foundation of **geo-partitioning / row-level geo**: combine table partitioning with per-partition tablespaces so, say, EU users' rows physically live in EU nodes and US users' rows in US nodes — giving you **data residency** (compliance) and **local latency** (reads/writes served from the nearest region).

```sql
CREATE TABLESPACE eu_ts WITH (replica_placement = '{...eu regions...}');
CREATE TABLESPACE us_ts WITH (replica_placement = '{...us regions...}');
-- partition a table by region, pin each partition to a tablespace
```

This is a **preview of the multi-region topic** — the key modeling takeaway is that placement is a schema-design concern in YugabyteDB: you can shape *where* data lives, not just *how* it's keyed. Design the partitioning + tablespace mapping to match your residency and latency requirements.

### Q9. Are secondary indexes distributed too? What does that mean for design?

**Yes — secondary indexes in YugabyteDB are themselves distributed and sharded**, stored as their own DocDB structures across tablets (unlike a single-node Postgres index that lives on one machine). So an index isn't a free, local add-on: it has its *own* sharding to choose and its *own* write cost.

Design implications:

1. **Choose the index's sharding.** Like a PK, an index can be hash- or range-sharded on its indexed columns:
   ```sql
   -- range-sharded index for time-range lookups on a column
   CREATE INDEX ON orders (order_ts ASC);
   -- hash-sharded index for point lookups on email
   CREATE INDEX ON users ((email) HASH);
   ```
   A monotonic range index has the same **hotspot** risk as a monotonic PK.
2. **Writes hit the index tablets too.** Every insert/update maintaining the index is a distributed write — often via the transaction path to keep index and table consistent — so over-indexing costs write throughput.
3. **Lookups may cross tablets.** A query using a secondary index may hop from index tablet to base-table tablet on another node (an index scan + remote fetch), adding a round-trip.

So: index for the access pattern, but treat each index as a distributed object with its own placement and write cost — not a cheap local structure. (Full treatment is the indexes topic; this is the preview.)

### Q10. What's the cost of foreign keys across tablets?

Foreign keys **work** in YSQL (real relational integrity, unlike Cassandra) — but enforcing them in a distributed database has a cost. The referenced parent row and the referencing child row may live on **different tablets on different nodes**. So:

- **Write-time checks cross the network.** Inserting/updating a child row must verify the parent exists; deleting/updating a parent must check children. When those rows are on other tablets, the check is a **remote round-trip**, and the operation runs through the **distributed-transaction** path to stay consistent — more latency than a single-node FK check.
- **Hot-path amplification.** High-throughput writes on FK-heavy tables pay this cost on every operation; it compounds with cross-region latency in stretched clusters.

Design guidance: **use FKs where integrity matters, but be deliberate on hot paths.** Options to reduce cost include modeling related rows to share a tablet (e.g. same hash partition key so parent and child colocate), limiting FKs on the highest-throughput tables, or accepting the cost where correctness demands it. The senior instinct: know FKs are available and correct, but treat them as a *distributed* operation whose cost you weigh against the write-rate and locality of the tables involved.

### Q11. Normalize or denormalize in a distributed SQL database like YugabyteDB?

This is where YugabyteDB differs sharply from Cassandra. In Cassandra you *must* denormalize because there are no joins. In YugabyteDB (YSQL) you have **real joins, foreign keys, and ACID transactions** — so you **can and often should normalize**, keeping a clean relational model.

The catch: **cross-tablet joins cost network**. A join whose rows live on different tablets/nodes pays round-trips the single-node planner didn't. So the calculus is:

- **Normalize by default** — you get integrity, no update anomalies, and real SQL. This is a genuine advantage over Cassandra.
- **Design for locality** where the join is hot — e.g. give parent and child the **same hash partition key** so they colocate on a tablet and the join is local; or **colocate** small reference tables so dimension joins are local.
- **Selectively denormalize** only for proven hot paths where even a local-ish join is too costly — the same performance-vs-purity trade you'd make in Postgres, plus a network dimension.

So the answer isn't Cassandra's "always denormalize" nor Postgres's "network is free" — it's **normalize for correctness, then engineer locality (partition alignment, colocation) for the hot joins, and denormalize only as a last resort.**

### Q12. What is `SPLIT INTO` and when do you use it?

`SPLIT INTO` **presplits** a table (or index) into a specified number of tablets **at creation time**, rather than starting as one tablet that auto-splits later as it grows.

```sql
CREATE TABLE users (id uuid, ...) 
  SPLIT INTO 24 TABLETS;                    -- hash-sharded, 24 tablets up front

-- range-sharded tables presplit at explicit boundaries instead
CREATE TABLE events (region text, ts timestamptz, PRIMARY KEY (region ASC, ts ASC))
  SPLIT AT VALUES (('us-west'), ('us-east'));
```

**Use it when** you know a table will be large or high-throughput from day one. Without presplitting, the table begins life on a *single* tablet and must **auto-split and rebalance** as data pours in — during which early load concentrates on few tablets (a transient hotspot) and the cluster does extra split/move work. Presplitting into a sensible number of tablets (often aligned to node/CPU count) spreads load across the cluster **immediately**, avoiding that warm-up hotspot and initial rebalancing churn.

Don't over-split tiny tables (each tablet has Raft/overhead cost) — presplitting is for tables you're confident will be big. It pairs naturally with hash-sharded PKs on high-volume tables.

### Q13. Design the schema for a users table and an orders table at scale.

Reason from the access patterns: users are looked up by id (point lookups); orders are queried as "recent orders for a user" (per-user, time-ordered).

```sql
-- Users: point lookups by id -> hash-shard the surrogate key.
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY ((id) HASH)          -- even distribution, write-scalable, no hotspot
);

-- Orders: "recent orders for a user" -> hash user_id, range order_ts DESC.
CREATE TABLE orders (
  user_id uuid NOT NULL,
  order_ts timestamptz DEFAULT now(),
  order_id uuid DEFAULT gen_random_uuid(),
  amount numeric,
  PRIMARY KEY ((user_id) HASH, order_ts DESC, order_id)
) SPLIT INTO 24 TABLETS;
```

Why this scales:

- **`users`** hash-shards on `id`: point lookups by id are efficient, writes spread evenly, no monotonic hotspot. `email UNIQUE` gives a distributed unique index for login lookups.
- **`orders`** hash-partitions on `user_id` (spreads users across the cluster) and range-orders on `order_ts DESC` *within* each user — so "latest N orders for user X" is a local, ordered, no-scan query. The monotonic timestamp is safe because it's a range component under a hashed partition, not the top-level shard key.
- **`SPLIT INTO`** presplits the high-volume orders table to avoid a single-tablet warm-up hotspot.

```sql
SELECT * FROM orders WHERE user_id = $1 ORDER BY order_ts DESC LIMIT 20;
```

This is the pattern to reach for in the interview: hash the distribution key, range the ordering key, avoid monotonic top-level keys.

### Q14. Spot the problem: `CREATE TABLE events (id BIGSERIAL PRIMARY KEY, ts timestamptz, data jsonb);`

**Problem: a monotonically increasing primary key that will hotspot — the classic anti-pattern.** `BIGSERIAL` generates ever-increasing integers, and a plain `PRIMARY KEY` on a value like that behaves as a range key whose newest values cluster together. Every insert targets the *last* tablet on *one* node, so:

1. **Write hotspot** — all inserts hit one node; the cluster can't scale writes by adding nodes.
2. **Sequence contention** — `BIGSERIAL` is a global sequence, a distributed-coordination point that also bottlenecks at high insert rate.

Both problems stem from the same monotonic-key mistake. Fixes depend on the access pattern:

```sql
-- If events are looked up by id (point lookups): random UUID, hash-sharded.
CREATE TABLE events (
  id uuid DEFAULT gen_random_uuid(),
  ts timestamptz, data jsonb,
  PRIMARY KEY ((id) HASH)
);

-- If events are queried by "recent events per source": composite hash+range.
CREATE TABLE events (
  source_id uuid, ts timestamptz, event_id uuid DEFAULT gen_random_uuid(),
  data jsonb,
  PRIMARY KEY ((source_id) HASH, ts DESC, event_id)
);
```

Either way: **eliminate the monotonic top-level key** — hash the surrogate key, or demote the timestamp to a range component under a hashed partition. That's the fix an interviewer is listening for.

### Q15. Describe the mental shift from PostgreSQL primary-key design.

In **Postgres**, the PK is a **local uniqueness constraint + index**. You reflexively write `id SERIAL PRIMARY KEY` because where the row lives is irrelevant — one machine holds everything, and the PK's only jobs are "be unique" and "index for lookups." Monotonic ids are *ideal* (compact, cache-friendly, sequential inserts).

In **YugabyteDB**, the PK is the **sharding key** — it decides which tablet and node each row lives on. So the same `id SERIAL PRIMARY KEY` that's optimal in Postgres becomes a **hotspot** in YugabyteDB, because monotonic keys funnel writes to one tablet. The shift is:

| Postgres instinct | YugabyteDB instinct |
|---|---|
| PK = unique index | PK = shard key (uniqueness *and* distribution *and* perf) |
| `id SERIAL` by default | Hash a UUID, or composite hash+range |
| Monotonic key is fine/ideal | Monotonic top-level key = hotspot |
| Design PK for uniqueness | Design PK for the **access pattern** |
| Joins/FKs are "free" | Cross-tablet joins/FKs cost network |
| Indexes are local | Indexes are distributed & sharded |

The one-sentence reframe: **stop thinking "what uniquely identifies this row?" and start thinking "how is this data accessed, and how should it be distributed?" — because in YugabyteDB the primary key answers both.**

### Q16. How would you approach designing a multi-tenant, time-series schema for scale?

Frame it from the two dominant access patterns — *isolate tenants* and *read recent data per tenant* — and let those drive the PK.

1. **Hash the tenant, range the time.** The canonical composite PK: `PRIMARY KEY ((tenant_id) HASH, ts DESC, ...)`. Hashing `tenant_id` spreads tenants evenly across the cluster (no hotspot, write-scalable); ranging `ts DESC` keeps each tenant's data time-ordered *within* its partition, so "recent events for tenant X" is a local, ordered, no-scan query.

   ```sql
   CREATE TABLE tenant_events (
     tenant_id uuid, ts timestamptz, event_id uuid DEFAULT gen_random_uuid(),
     payload jsonb,
     PRIMARY KEY ((tenant_id) HASH, ts DESC, event_id)
   ) SPLIT INTO 48 TABLETS;
   ```

2. **Guard against a giant tenant.** If one tenant dwarfs the others, its single hash partition can still hotspot. Add a **bucket/salt** — `PRIMARY KEY ((tenant_id, bucket) HASH, ts DESC)` where `bucket = hash(event_id) % N` — to spread a huge tenant across N sub-partitions (trade: cross-bucket fan-out for full scans).

3. **Presplit** the high-volume table (`SPLIT INTO`) so it spreads immediately instead of warming up on one tablet.

4. **Handle residency/geo** if tenants are regional: partition by region and pin partitions to **tablespaces** so each region's data lives locally (residency + latency).

5. **Colocate** small per-tenant reference/config tables for local joins; keep the big time-series table sharded.

6. **Choose secondary indexes** for secondary access patterns (e.g. by event type), sharding *them* appropriately, and mind their write cost.

The summary you'd give: **hash the tenant to distribute, range the timestamp within it for recency, salt the whale tenants, presplit the big table, and use tablespaces for geo** — a design that scales writes, keeps per-tenant reads local and ordered, and stays in clean relational SQL.
## YCQL — the Cassandra-Compatible API

### Summary

**What this topic covers**

YugabyteDB's *second* query API. Everyone reaches for YSQL (the PostgreSQL-compatible face of the database) — but YugabyteDB also exposes **YCQL**, a **Cassandra-Query-Language-compatible, semi-relational API** that sits on the *same* DocDB storage engine as YSQL. This topic is about what YCQL is, where it came from (Apache Cassandra's CQL), and — the part interviewers actually care about — how it differs from real Cassandra. The 15 questions here move from "what is YCQL and why does a Postgres-compatible database ship a Cassandra API" through the concrete data-model mechanics (partition keys, clustering columns, wide rows) to the decision framework: when do you pick YCQL over YSQL, and when would a Cassandra shop migrate to YCQL to escape eventual-consistency operational pain. If you know Cassandra, this topic is mostly *unlearning* the eventual-consistency mental model.

**Mental model**

Think of YugabyteDB as **one storage engine (DocDB) with two front doors**. YSQL reuses the actual PostgreSQL query layer; YCQL reuses Cassandra's query *language and data model* but re-implements the engine underneath on top of DocDB's Raft-replicated, strongly-consistent tablets. So YCQL gives you Cassandra's *ergonomics* — `CREATE TABLE`, `PRIMARY KEY ((partition_key), clustering_col)`, wide rows, time-series-friendly layout, mostly-compatible drivers — but Cassandra's *distributed-systems weaknesses are gone*. There is no tunable eventual consistency, no read repair, no `gc_grace_seconds` tombstone/zombie problem, no manual `nodetool repair`, no anti-entropy, no compaction-strategy tuning to babysit. Every write is Raft-committed to a quorum before it's acknowledged, so a read sees the latest write. The pitch in one line: **"Cassandra-compatible, but strongly consistent, with global indexes and distributed transactions."** You keep the data model and drivers; you drop the operational tax.

**Key terms**

- **YCQL** — YugabyteDB's Cassandra-Query-Language-compatible, semi-relational API over DocDB.
- **YSQL** — the sibling PostgreSQL-compatible API; the two do **not** share tables.
- **Partition key** — the `((...))` portion of the primary key; decides which tablet a row hashes to.
- **Clustering columns** — the ordered part of the primary key; sorts rows *within* a partition (great for time-series).
- **Wide row / wide partition** — one partition holding many clustered rows; the Cassandra/YCQL sweet spot.
- **Strong consistency by default** — YCQL reads/writes go through Raft quorum; no tunable consistency levels.
- **Global secondary index** — a sharded, transactionally-consistent index table (contrast Cassandra's local, eventually-consistent 2i).
- **Distributed ACID transaction** — `BEGIN TRANSACTION ... END TRANSACTION;` gives multi-row atomicity Cassandra lacks.
- **`ycqlsh`** — the YCQL shell (the analogue of Cassandra's `cqlsh`).
- **Keyspace** — YCQL's namespace for tables (distinct from YSQL databases/schemas).
- **JSONB** — YCQL supports a JSONB column type for semi-structured data.

**Why interviewers ask this**

Two signals. First, **do you understand that YugabyteDB is multi-API over one engine** — a candidate who thinks YugabyteDB *is* Postgres has only half the picture. Second, and more important, **can you articulate why "Cassandra-compatible but strongly consistent" is valuable**. A junior says "YCQL is just Cassandra." A senior explains that YCQL removes the operational and correctness pain that makes real Cassandra hard — eventual consistency, repair, tombstones, local 2i scatter-gather — while keeping the data model that made Cassandra good for high-write, key-access, time-series workloads. The migration angle ("we have a Cassandra cluster bleeding ops hours, should we move to YCQL?") is a favourite because it forces you to weigh compatibility against what actually changes.

**Common confusions**

- "YCQL is Cassandra" — no. It's *CQL-compatible* but runs on YugabyteDB's Raft/DocDB engine. The behaviour (consistency, indexes, transactions, ops) is very different.
- "You can join YCQL and YSQL tables" — no. They don't share storage namespaces; a table lives in one API or the other.
- "YCQL is eventually consistent like Cassandra" — no, it's strongly consistent by default. There are no tunable consistency levels to reason about.
- "YCQL secondary indexes are local like Cassandra's 2i" — no, they're **global and strongly consistent**.
- "YCQL is the recommended API for new apps" — generally *not*; Yugabyte steers new projects to YSQL as the richer, more actively-developed API. YCQL shines for Cassandra-style workloads and migrations.
- "YCQL supports arbitrary SQL joins" — no. It's semi-relational — key-based access, no arbitrary JOINs, less rich SQL than YSQL.

**What follows from this topic**

YCQL shares the sharding, tablet, and Raft machinery covered in the sharding and replication topics — its `PRIMARY KEY ((partition_key), clustering_col)` maps directly onto hash-partitioned tablets, so the monotonic-key hotspot warnings apply here too. Its global secondary indexes are the same distributed-index structure covered in **Indexes & Query Performance**. And the "push compute to the data" execution model in **Query Execution & Pushdowns** applies to YCQL reads as well. If you're weighing YCQL vs YSQL, that decision is really a data-model decision — read this alongside the sharding and transactions topics.

### Q1. What is YCQL and how does it relate to YSQL?

**YCQL** is YugabyteDB's **Cassandra-Query-Language-compatible, semi-relational API**. It's the second of the database's two query layers. Both APIs sit on the **same DocDB storage engine** — the same Raft-replicated, auto-sharded, MVCC tablets.

- **YSQL** — PostgreSQL-compatible, fully relational (joins, foreign keys, triggers, extensions). Reuses the real Postgres query layer.
- **YCQL** — Cassandra-CQL-compatible, semi-relational (partition/clustering key access, wide rows, limited joins).

The key point: they are **two front doors on one engine**, but they **do not share tables**. A table created in YSQL is not visible from YCQL and vice versa — different keyspaces/namespaces. You pick an API per workload, not per query.

### Q2. Where does YCQL come from, and what does it inherit from Cassandra?

YCQL is derived from **Apache Cassandra's CQL**, so the surface is deliberately familiar to Cassandra users:

```sql
CREATE TABLE sensor_data (
  device_id uuid,
  reading_time timestamp,
  temperature double,
  PRIMARY KEY ((device_id), reading_time)
) WITH CLUSTERING ORDER BY (reading_time DESC);
```

What it keeps from Cassandra:

- The **partition-key / clustering-column data model** — `PRIMARY KEY ((partition), clustering...)`.
- **Wide-row / time-series friendliness** — many clustered rows under one partition.
- Similar **data types and syntax** (`uuid`, `timestamp`, collections, etc.).
- **Largely compatible CQL drivers** — existing Cassandra client code often works with minimal change.

So a Cassandra developer is productive fast. What changes is everything *underneath* the syntax.

### Q3. How does YCQL differ from real Apache Cassandra? (the big one)

This is the interview meat. YCQL keeps Cassandra's *data model* but replaces its *distributed-systems foundation*:

| Concern | Apache Cassandra | YCQL (YugabyteDB) |
|---|---|---|
| Consistency | Tunable, eventually consistent | **Strongly consistent by default** (Raft quorum) |
| Read repair / anti-entropy | Required (`nodetool repair`) | **None needed** — Raft keeps replicas in sync |
| Tombstones / `gc_grace` | Zombie-data hazard, tuning burden | **Not a concern** |
| Secondary indexes | Local, per-node, eventually consistent | **Global, strongly consistent** |
| Transactions | None (single-row atomicity only) | **Distributed ACID** (`BEGIN TRANSACTION`) |
| Compaction strategy | Manual tuning (STCS/LCS/TWCS) | Managed by DocDB, auto-split |
| Sharding | Manual token ranges / vnodes | **Auto-sharded, auto-splitting tablets** |

In short: you get Cassandra's ergonomics without eventual consistency, repair, tombstone hazards, or compaction babysitting.

### Q4. Is YCQL strongly consistent? How is that possible if CQL came from Cassandra?

Yes — **strongly consistent by default**. The CQL *language* came from Cassandra, but the *engine* underneath is YugabyteDB's DocDB. Every YCQL write is replicated via **Raft consensus** to a **quorum/majority** of the tablet's replicas before it's acknowledged, and reads are served by the tablet **leader** (linearizable).

That means there are **no tunable consistency levels** to reason about (no `ONE`/`QUORUM`/`ALL` correctness roulette), **no read repair**, and **no eventual-consistency window** where a read might miss a just-committed write. For a Cassandra veteran this is the single biggest mental shift: you delete the "it'll be consistent eventually" model entirely.

### Q5. How do secondary indexes differ between Cassandra 2i and YCQL?

Cassandra's secondary indexes (2i) are **local** — each node indexes only its own data, they're **eventually consistent**, and a lookup that isn't on the partition key becomes a **scatter-gather** across every node. They're notoriously a trap for high-cardinality columns.

YCQL's secondary indexes are **global and strongly consistent**: the index is its own **distributed, sharded index table**, kept **transactionally in sync** with the base table. An indexed lookup routes straight to the tablet holding that index entry — no cluster-wide scatter-gather.

```sql
CREATE INDEX ON users (email);
-- global, strongly consistent, sharded across the cluster
```

This is one of the strongest reasons a Cassandra shop migrates to YCQL.

### Q6. Does YCQL support transactions? Cassandra doesn't.

Yes. YCQL supports **distributed ACID transactions** for multi-row atomicity — something Apache Cassandra fundamentally lacks (Cassandra offers only single-partition atomicity plus lightweight transactions via Paxos for compare-and-set).

```sql
BEGIN TRANSACTION
  INSERT INTO accounts (id, balance) VALUES (1, 100);
  INSERT INTO accounts (id, balance) VALUES (2, 200);
END TRANSACTION;
```

Under the hood these use the same distributed-transaction machinery (provisional records / write intents + a transaction status tablet) as YSQL. For workloads that need "these two writes both happen or neither does," this closes a real Cassandra gap.

### Q7. What data model does YCQL use — partition keys and clustering columns?

Same model as Cassandra. The primary key has two parts:

```sql
PRIMARY KEY ((partition_key_cols), clustering_col_1, clustering_col_2)
```

- **Partition key** — the double-parenthesised part. Hashes the row to a tablet. All rows with the same partition key live together on one tablet.
- **Clustering columns** — sort rows *within* the partition, on disk, in clustering order.

```sql
CREATE TABLE events (
  user_id uuid,
  event_time timestamp,
  event_type text,
  payload jsonb,
  PRIMARY KEY ((user_id), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);
```

This makes "fetch the latest N events for a user" a single-partition, pre-sorted read — the classic time-series access pattern.

### Q8. When would you choose YCQL over YSQL?

Choose **YCQL** when your workload is **Cassandra-shaped**:

- High **write throughput** with simple, key-based access patterns.
- **Wide rows / time-series** data (metrics, events, IoT, feeds).
- You're **migrating off Cassandra** and want strong consistency, global indexes, and transactions without rewriting your data model.
- You don't need arbitrary SQL joins or the full relational feature set.

Choose **YSQL** when you need **full relational SQL** — arbitrary joins, foreign keys, rich queries, Postgres compatibility, extensions, stored procedures. Yugabyte generally **recommends YSQL for new applications** because it's the richer, more actively developed API.

Rule of thumb: *new relational app → YSQL; Cassandra-style workload or Cassandra migration → YCQL.*

### Q9. What are the limitations of YCQL compared to YSQL?

YCQL is **semi-relational**, so relative to YSQL you give up:

- **No arbitrary JOINs** — access is key-based; you denormalize instead of joining.
- **Less rich SQL** — no full Postgres query surface, fewer functions, no window functions, etc.
- **No foreign keys / triggers / extensions** — the relational feature set is thinner.
- **Data modelling is query-first** — you design tables around access patterns (like Cassandra), not around normalized entities.

The trade you get in return is a simple, high-throughput, key-access model that scales writes beautifully. It's the right tool when the workload fits; the wrong one when you need relational flexibility.

### Q10. We have a Cassandra cluster and it's an operational nightmare. Should we migrate to YCQL? What changes?

Strong candidate for migration. YCQL keeps your **CQL data model and drivers** largely intact, so the migration is mostly a data move plus validation — not a rewrite.

What you **gain**: strong consistency (delete the eventual-consistency mental model), global strongly-consistent secondary indexes, distributed transactions, and — the big operational win — **no more `nodetool repair`, no tombstone/`gc_grace` zombie problem, no compaction-strategy tuning, no anti-entropy**. Tablets auto-shard and auto-split.

What **changes**: you stop reasoning about consistency levels and read repair; your indexes behave differently (global, not local); some Cassandra-specific tuning knobs simply don't exist. Validate driver compatibility and any CQL features you use, but for most Cassandra shops the operational relief is the whole point.

### Q11. Can you mix YSQL and YCQL in the same database? Can they share tables?

You can run both APIs against the same **cluster (universe)** — the TServers host both query layers on the same DocDB tablets. But they **do not share tables**. YSQL tables live in Postgres-style databases/schemas; YCQL tables live in **keyspaces**. There's no cross-API query — you can't join a YCQL table to a YSQL table.

So "mixing" means: different services on the same cluster can use different APIs, but each table belongs to exactly one API. Most teams standardise on one API per application to avoid confusion.

### Q12. What is `ycqlsh`?

`ycqlsh` is the **YCQL command-line shell** — YugabyteDB's analogue of Cassandra's `cqlsh`. You use it to run CQL against the YCQL API:

```bash
ycqlsh <host> 9042
```

```sql
ycqlsh> USE my_keyspace;
ycqlsh> SELECT * FROM events WHERE user_id = ... LIMIT 10;
```

(YSQL has the parallel `ysqlsh`, the Postgres `psql` analogue.) Port 9042 is the familiar Cassandra client port, part of what makes existing Cassandra tooling and drivers work against YCQL.

### Q13. Show a realistic YCQL table with partition and clustering keys.

A time-series-style table for per-device sensor readings:

```sql
CREATE KEYSPACE iot;

CREATE TABLE iot.readings (
  device_id  uuid,
  bucket     date,          -- coarse time bucket to bound partition size
  reading_at timestamp,
  metric     text,
  value      double,
  meta       jsonb,
  PRIMARY KEY ((device_id, bucket), reading_at, metric)
) WITH CLUSTERING ORDER BY (reading_at DESC);
```

- **Partition key `(device_id, bucket)`** — spreads load across tablets and *bounds* partition size (a bucket per day) so no single partition grows unbounded.
- **Clustering `(reading_at DESC, metric)`** — newest-first ordering, so "latest readings for a device today" is a single-partition, pre-sorted scan.
- **`jsonb meta`** — YCQL's JSONB support for semi-structured attributes.

Note the bucketed partition key: the same anti-hotspot discipline you'd apply to hash sharding in YSQL.

### Q14. YCQL vs Cassandra vs YSQL — when would you use each?

| | Apache Cassandra | YCQL | YSQL |
|---|---|---|---|
| Consistency | Eventual (tunable) | **Strong** | **Strong** |
| Data model | Partition + clustering | Partition + clustering | Full relational |
| Joins | No | No | **Yes** |
| Transactions | No (single-partition) | **Distributed ACID** | **Distributed ACID** |
| Secondary indexes | Local, eventual | **Global, strong** | **Global, strong** |
| Ops burden | High (repair, tombstones, compaction) | Low | Low |
| Best for | Existing Cassandra estates | Cassandra-style workloads wanting strong consistency + migrations | New relational apps, joins, Postgres compat |

Use **Cassandra** only if you're already on it and not ready to move. Use **YCQL** for Cassandra-shaped workloads that want strong consistency, transactions, global indexes, and far less ops pain — especially Cassandra migrations. Use **YSQL** for anything relational or new. Yugabyte's default recommendation for greenfield is YSQL.

### Q15. Why is "Cassandra-compatible but strongly consistent" the pitch for YCQL?

Because it targets the exact pain that makes real Cassandra expensive to run. Cassandra's data model — wide rows, partition/clustering keys, high write throughput — is genuinely good for time-series and key-access workloads. What hurts is the **distributed-systems foundation**: eventual consistency you have to reason about, read repair, `nodetool repair`, tombstones and `gc_grace` zombies, local eventually-consistent secondary indexes, and no multi-row transactions.

YCQL keeps the good part (the model, the drivers, the throughput) and swaps the foundation for **Raft-based strong consistency**, **global strongly-consistent indexes**, **distributed ACID transactions**, and **auto-sharding with no repair/compaction babysitting**. So a team gets Cassandra's ergonomics and scale **without** its correctness footguns and operational tax. That's the whole value proposition: *familiar surface, drastically better fundamentals.*

## Indexes & Query Performance

### Summary

**What this topic covers**

How indexing actually works in a *distributed* SQL database, and how you use it to make queries fast. In single-node Postgres an index is a cheap local B-tree; in YugabyteDB an index is itself a **distributed, sharded, replicated structure** — so the rules change. The 16 questions here cover what a secondary index physically *is* in YugabyteDB (a separate index table sharded across the cluster, kept transactionally in sync with the base table), why that makes indexed lookups fast (global, not scatter-gather like Cassandra's local 2i), the **write cost** of indexes (every base write must transactionally update the index too), **covering / INCLUDE indexes** and **index-only scans**, the index's *own* sharding choices (hash vs range, same hotspot rules), unique/partial/expression indexes, and the essential tuning tool: **`EXPLAIN (ANALYZE, DIST)`** to actually *see* the RPCs, rows scanned, and pushdowns. The recurring interview scenario is "this query is slow — how do you index it?"

**Mental model**

Picture an index as **a second table you didn't write, that the database maintains for you, sharded across the whole cluster**. Its rows are `(indexed_column → base_row_locator)`, distributed over tablets by the index key. That gives you two facts to reason about at all times. First, **reads get cheaper**: a lookup on an indexed column routes straight to the index tablet that owns that value, then fetches the base row — instead of scanning every tablet. Second, **writes get more expensive**: every insert/update/delete on the base table must *also* transactionally update every index that covers the changed columns, adding write amplification and latency. So indexing is a **read-vs-write trade**, amplified by the network — each extra index is extra distributed work on every write. The senior instinct is: index exactly to your access patterns, use covering indexes to turn two round-trips into one (an index-only scan), and never over-index a write-heavy table.

**Key terms**

- **Secondary index** — a distributed, sharded index table kept transactionally in sync with the base table.
- **Global index** — YugabyteDB indexes are global (cluster-wide, strongly consistent), not local per-node like Cassandra 2i.
- **Covering index / `INCLUDE`** — extra non-key columns stored in the index so a query is answered from the index alone.
- **Index-only scan** — a read satisfied entirely from the index, avoiding a trip to the base table.
- **Write amplification** — each base-table write must also update every affected index → more work per write.
- **Index sharding (HASH vs range)** — you choose the distribution of the index key, with the same hotspot risks as the base table.
- **Unique index** — enforces uniqueness; backs primary keys and unique constraints.
- **Partial index** — indexes only rows matching a `WHERE` predicate.
- **Expression index** — indexes a computed expression (e.g. `lower(email)`).
- **`EXPLAIN (ANALYZE, DIST)`** — shows the distributed plan: rows scanned, RPC round-trips, pushdowns, index usage.
- **Online backfill** — `CREATE INDEX` builds the index without blocking writes.
- **Full distributed scan** — a query with no usable index scans every tablet; expensive.

**Why interviewers ask this**

Indexing separates people who've *operated* a distributed SQL database from people who've only read the docs. A junior treats indexes as free and adds one per column. A senior knows an index is a sharded structure with a real write cost, reasons about covering indexes and index-only scans to cut network round-trips, chooses the index's *own* sharding to avoid hotspots, and reaches for `EXPLAIN (ANALYZE, DIST)` to *prove* what the query does rather than guessing. The "why is this query slow / how would you index it" question is a live audition: they want to see you check for a full distributed scan, propose an index aligned to the predicate, consider a covering index, and validate with `EXPLAIN`.

**Common confusions**

- "Indexes are free like in Postgres" — no. In a distributed DB an index is a sharded table; every write pays to keep it in sync.
- "YugabyteDB's secondary indexes are local like Cassandra's" — no, they're **global and strongly consistent**.
- "More indexes always make things faster" — they speed *reads* but slow *writes* and add storage; over-indexing hurts.
- "An index means no trip to the base table" — only if it's a **covering** index (INCLUDE the needed columns) enabling an index-only scan; otherwise there's a second fetch.
- "Index sharding doesn't matter" — it does. The index key can hotspot on monotonic values just like a base table.
- "`EXPLAIN` alone tells me the distributed cost" — use `EXPLAIN (ANALYZE, DIST)` to see actual RPCs and rows; plain `EXPLAIN` hides the distributed reality.

**What follows from this topic**

Indexes are half of query performance; **Query Execution & Pushdowns** is the other half — how the coordinator scatters work to tablets and pushes filters/projections/aggregates down to avoid shipping rows. The two connect directly: an index-only scan is the ultimate pushdown (fetch nothing from the base table). Index sharding decisions (hash vs range, hotspots) are the same ones from the sharding topic applied to the index key. And YCQL's global secondary indexes are the same structure described here. If a query is slow, this topic tells you how to index it; the pushdowns topic tells you how to read `EXPLAIN (ANALYZE, DIST)` and why the plan behaves as it does.

### Q1. How do indexes work in a distributed SQL database like YugabyteDB — are they like Postgres indexes?

Not physically. In single-node Postgres, an index is a **local B-tree** next to the table on the same disk. In YugabyteDB, a secondary index is itself a **distributed, sharded, replicated structure** — effectively **its own table**, sharded across the cluster by the index key, each shard Raft-replicated RF=3, kept **transactionally in sync** with the base table.

So an index isn't a free local pointer structure; it's cluster-wide state with its own tablets. That single fact drives everything else in this topic: reads route to the index tablet that owns a value (fast), but every write must transactionally update the index too (costly). You reason about indexes the way you reason about a second table.

### Q2. What is a secondary index in YugabyteDB, and how is it different from Cassandra's 2i?

A **secondary index** is a distinct **index table**, sharded across the cluster, storing `(indexed_columns → base-row locator)` and maintained **transactionally** with the base table. It is **global and strongly consistent**.

Contrast Cassandra's local secondary index (2i): Cassandra indexes each node's own data, so an indexed lookup that isn't on the partition key becomes a **scatter-gather across every node**, and it's only eventually consistent.

| | Cassandra 2i | YugabyteDB index |
|---|---|---|
| Scope | Local per-node | **Global (cluster-wide)** |
| Consistency | Eventual | **Strong (transactional)** |
| Lookup | Scatter-gather all nodes | Routes to the owning index tablet |

Because YugabyteDB's index is global, an indexed lookup goes **straight to the right tablet** instead of fanning out.

### Q3. What is the write cost of an index?

Every write to the base table must **also transactionally update every index that covers the changed columns**. That means:

- An insert becomes: write the base row *and* write into each index (each a distributed, Raft-replicated write).
- An update to an indexed column must remove the old index entry and add the new one.
- All of it participates in the transaction, so it adds **write amplification and latency**.

The practical rule: **don't over-index**. Each additional index is extra distributed work on *every* write. On a write-heavy table, three unnecessary indexes can meaningfully raise write latency. Index to your actual read patterns and no further.

### Q4. What is a covering index / INCLUDE, and why does it matter more in a distributed system?

A **covering index** stores extra non-key columns via `INCLUDE`, so a query can be satisfied **entirely from the index** — an **index-only scan** — without a second trip to the base table.

```sql
CREATE INDEX idx_users_email ON users (email) INCLUDE (name, created_at);
-- SELECT name, created_at FROM users WHERE email = ...  → index-only scan
```

Why it matters *more* here than in Postgres: in a distributed database, the base row may live on a **different tablet, possibly a different node**, than the index entry. Without covering, the read is two round-trips: index tablet → base tablet. With covering, it's **one** — the index tablet answers completely. Cutting a network RPC is a real latency win, and it compounds at scale.

### Q5. How is the index itself sharded, and does that create hotspot risk?

The index is a distributed table, so **you choose how its key is sharded** — **HASH** (even distribution, no ordered range scans) or **range** (`ASC`/`DESC`, ordered, enables range scans). This is the *same* decision as for a base table's primary key, and it carries the **same hotspot risk**:

```sql
-- range index on a monotonically increasing column → all new writes hit the last tablet
CREATE INDEX idx_events_time ON events (created_at ASC);  -- hotspot risk

-- hash index → even write distribution, but no range scans on created_at
CREATE INDEX idx_events_time ON events (created_at HASH);
```

If you range-shard an index on a monotonic value (timestamp, serial), inserts pile onto the last tablet — an index hotspot. Choose HASH unless you genuinely need ordered range scans on that index.

### Q6. What are unique, partial, and expression indexes?

- **Unique index** — enforces uniqueness across the cluster (transactionally). Backs primary keys and `UNIQUE` constraints.

```sql
CREATE UNIQUE INDEX ON users (email);
```

- **Partial index** — indexes only rows matching a predicate; smaller and cheaper when you only query a subset.

```sql
CREATE INDEX ON orders (user_id) WHERE status = 'open';
```

- **Expression index** — indexes a computed expression, so predicates on that expression can use it.

```sql
CREATE INDEX ON users (lower(email));
-- WHERE lower(email) = 'alice@acme.com'  → uses the index
```

Partial and expression indexes are especially valuable in a distributed DB because they keep the index *smaller* — less distributed state to maintain on every write.

### Q7. When does the planner use an index versus a full scan?

The planner uses an index when the query's predicate is **selective** and matches the index's leading columns, so the index meaningfully narrows the rows. It falls back to a **full distributed scan** when there's no usable index, when the predicate isn't sargable (e.g. a function on the column with no matching expression index), or when the query is expected to touch most rows anyway.

The danger is the silent full scan: a `WHERE` on an unindexed column becomes a scan across **every tablet in the cluster**. Always confirm with `EXPLAIN (ANALYZE, DIST)` rather than assuming the planner found your index — a type mismatch or non-sargable predicate can quietly disable it.

### Q8. How do you use EXPLAIN to understand a distributed query? What does DIST add?

`EXPLAIN` shows the plan; `EXPLAIN (ANALYZE, DIST)` **runs** it and shows the **distributed reality** — the piece plain `EXPLAIN` hides.

```sql
EXPLAIN (ANALYZE, DIST) SELECT name FROM users WHERE email = 'alice@acme.com';
```

`DIST` surfaces:

- **Rows scanned** at the storage layer vs rows returned.
- **RPC round-trips** to tablet servers (how many network hops).
- **Which access path** — index scan, index-only scan, or full sequential scan.
- **Pushdowns applied** — whether filters/projections were pushed to DocDB.

This is *the* tuning tool. If you see a Seq Scan with a huge rows-scanned count and many RPCs, you're doing a full distributed scan and need an index. If you wanted an index-only scan but see a base-table fetch, your index isn't covering.

### Q9. What is the cost of a query that can't use an index?

It becomes a **full distributed scan**: the coordinator must read across **all tablets** of the table, on every node, and filter. That's the worst case in a distributed DB — you pay network round-trips to every tablet and ship (or at least scan) huge row counts.

On a large table this can turn a millisecond point lookup into a multi-second cluster-wide operation, and it scales *badly* as data grows because more data means more tablets to hit. This is why an unindexed `WHERE` on a hot query path is a classic distributed-SQL performance bug — and why you validate with `EXPLAIN (ANALYZE, DIST)` before shipping.

### Q10. How do you keep indexes minimal and aligned to access patterns?

Design indexes from your **actual query predicates**, not speculatively:

- One index per real access pattern (the columns you filter/sort by), leading-column ordered to match.
- Use **covering (`INCLUDE`)** columns to enable index-only scans on your hottest read.
- Use **partial** indexes when you only ever query a subset (`WHERE status = 'open'`).
- **Drop** indexes no query uses — they only cost writes and storage.
- On write-heavy tables, be ruthless: each index is per-write distributed overhead.

The mental check before adding an index: *which query does this serve, and is that query hot enough to justify the write cost on every insert/update?* If you can't name the query, don't add the index.

### Q11. Walk through the read path when a query uses an index.

For a non-covering index:

1. The query layer routes the predicate to the **index tablet** that owns the indexed value.
2. That tablet returns the **base-row locator** (the primary key / pointer).
3. The query layer fetches the **base row** from the tablet that owns it — possibly on a different node.

That's **two round-trips**. For a **covering** index (the needed columns are `INCLUDE`d), step 3 disappears — the index tablet returns everything, an **index-only scan**, **one round-trip**. Eliminating that second hop is the whole reason covering indexes matter so much in a distributed system.

### Q12. Can you build an index online without blocking writes?

Yes. `CREATE INDEX` in YugabyteDB does an **online, non-blocking backfill** — it builds the index over existing data while the table continues to serve reads and writes, then makes the index live. You don't take a write outage to add an index.

```sql
CREATE INDEX idx_orders_user ON orders (user_id);
-- backfills existing rows online; new writes are indexed as they arrive
```

This matters operationally: on a large distributed table, a blocking index build would be an unacceptable outage. Online backfill lets you add indexes to production tables safely (though the backfill still consumes cluster resources, so schedule large ones thoughtfully).

### Q13. How do foreign keys and unique constraints relate to indexes?

Both are **backed by indexes**. A **unique constraint** is enforced by a **unique index** — a distributed, transactionally-maintained index that rejects duplicate keys cluster-wide. A **foreign key** relies on an index (typically a unique index on the referenced key) so the constraint check is an efficient lookup rather than a scan.

The distributed-cost implication: enforcing a unique constraint or FK means an **extra transactional index check/update on every affected write**, coordinated across tablets. It's correct and usually worth it, but on a very high-throughput write path it's real overhead to be aware of — constraints aren't free in a shared-nothing database.

### Q14. How do you find slow queries in the first place?

Use **`pg_stat_statements`** (available through the YSQL/Postgres-compatible layer) to aggregate query statistics — total and mean execution time, call counts, rows — so you can rank queries by cost and find the expensive ones.

```sql
SELECT query, calls, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Then take the worst offenders into `EXPLAIN (ANALYZE, DIST)` to see whether they're doing full distributed scans, missing pushdowns, or cross-node joins. `pg_stat_statements` tells you *what* is slow; `EXPLAIN (ANALYZE, DIST)` tells you *why*.

### Q15. Show a covering index turning two RPCs into one.

```sql
-- Base table: users, sharded by id
-- Hot query: look up name + signup date by email
SELECT name, created_at FROM users WHERE email = 'alice@acme.com';
```

**Without covering** — index on `email` only:

1. Hit the `email` index tablet → get the user's `id`.
2. Fetch the base row (on another tablet/node) for `name`, `created_at`.
   → **two round-trips.**

**With covering:**

```sql
CREATE INDEX idx_users_email ON users (email) INCLUDE (name, created_at);
```

Now the index tablet already holds `name` and `created_at`, so the query is an **index-only scan** — **one round-trip**. `EXPLAIN (ANALYZE, DIST)` will show the base-table fetch disappear. On a hot path, halving the RPCs is a direct latency win.

### Q16. This query is slow. Walk me through how you'd index it.

A structured approach:

1. **Reproduce and measure** — run `EXPLAIN (ANALYZE, DIST)`. Look for a **Seq Scan**, a large rows-scanned count, and many RPCs → that's a full distributed scan.
2. **Find the predicate** — identify the columns in `WHERE`/`JOIN`/`ORDER BY`. Those are your index candidates.
3. **Add a matching index** — leading columns matching the predicate; choose **HASH** unless you need ordered range scans (and watch the monotonic-key hotspot).
4. **Consider covering** — if the query selects a few columns, `INCLUDE` them for an index-only scan and drop the second RPC.
5. **Re-run `EXPLAIN (ANALYZE, DIST)`** — confirm it's now an index (or index-only) scan with far fewer rows and RPCs.
6. **Weigh the write cost** — make sure the new index earns its keep on a write-heavy table; drop redundant ones.

The point is you **prove** each step with `EXPLAIN (ANALYZE, DIST)` rather than guessing — that's the senior signal.

## Query Execution & Pushdowns

### Summary

**What this topic covers**

What actually happens between "I ran a SELECT" and "I got rows back" in a distributed database — and the single most important optimization for making it fast: **pushdowns**. When you query YugabyteDB, one node's query layer becomes the **coordinator**: it plans the query, **scatters** work to the tablet leaders that hold the relevant data (often on other nodes), and **gathers** the results. Because network latency between nodes dominates, the whole performance game is **minimizing the data that crosses the network**. That's what pushdowns do — instead of shipping raw rows to the coordinator and filtering there, YugabyteDB **pushes computation down to DocDB** on the tablet servers: predicate/filter, projection, aggregate, and LIMIT pushdowns. The 15 questions here cover the coordinator/scatter-gather model, each pushdown type, single-tablet vs multi-tablet queries, why **distributed joins** are expensive and how to mitigate them, follower reads, prepared statements/batching, and reading `EXPLAIN (ANALYZE, DIST)` to *see* the RPCs and pushdowns. The theme in one phrase: **push compute to the data, don't pull data to the compute.**

**Mental model**

Hold two pictures in your head. First, the **shape of execution**: a client connects to some TServer; that node's **Postgres query-layer process is the coordinator** for the query. It parses/plans, then issues **RPCs to the tablet leaders** that own the needed rows — those leaders may be on other nodes — and assembles the answer. Every one of those RPCs is a network round-trip, and **network latency is the dominant cost** in a shared-nothing database. Second, the **optimization lever**: for each tablet, you can either ship all its raw rows back to the coordinator and process them centrally (bad — lots of bytes on the wire), or you can **push the work into the tablet** so it filters, projects, and pre-aggregates locally and returns only the small result (good). The senior mindset is to structure schema and queries so work is *pushed down* and, ideally, restricted to a *single tablet* — one hop, minimal data — rather than a wide scatter-gather with a cross-node join in the middle.

**Key terms**

- **Coordinator** — the query-layer (Postgres) process on the node the client hit; plans the query and orchestrates scatter-gather.
- **Scatter-gather** — send sub-requests to multiple tablet leaders, then combine their results.
- **Tablet leader** — the Raft leader replica that serves reads/writes for a tablet.
- **Pushdown** — moving computation from the coordinator down to DocDB on the tablet server.
- **Predicate/filter pushdown** — apply `WHERE` at the tablet so only matching rows travel.
- **Projection pushdown** — fetch only the needed columns, not whole rows.
- **Aggregate pushdown** — compute `COUNT`/`SUM`/etc. partially at each tablet.
- **LIMIT pushdown** — stop early at the tablet instead of shipping everything.
- **Single-tablet query** — a query whose key confines it to one tablet → one hop, fast.
- **Distributed join** — joining rows that live on different tablets/nodes → network shuffle, costly.
- **Follower read** — serve a read from a local follower replica (bounded staleness) to cut latency.
- **`EXPLAIN (ANALYZE, DIST)`** — shows RPCs, rows scanned, and which pushdowns were applied.

**Why interviewers ask this**

This is the topic that reveals whether you understand *why* a distributed database is fast or slow. Anyone can write a SELECT; a senior engineer can trace it through coordinator → scatter-gather → pushdowns → gather, and predict where the latency goes. The "why is my join slow" question is the classic: the strong answer explains that the joined rows live on different tablets, so the engine must shuffle data across the network, and then offers real mitigations (colocation, denormalization, indexes, join order, co-locating joined data by design). Interviewers also probe whether you know pushdowns *exist* — candidates who think the coordinator pulls all rows and filters centrally will design schemas that do exactly that and wonder why they're slow. The ability to read `EXPLAIN (ANALYZE, DIST)` and point at the missing pushdown is the concrete, senior-level skill they're listening for.

**Common confusions**

- "The coordinator fetches all rows then filters" — no, that's the anti-pattern pushdowns exist to avoid; filters/projections/aggregates are pushed to the tablets.
- "A distributed join is like a Postgres join" — no. If matching rows are on different nodes, the engine shuffles data across the network — far costlier.
- "All queries scatter to every tablet" — no. A query whose key restricts it to one tablet is a single-hop, fast query; scatter-gather is for multi-tablet scans.
- "Reads always go to the leader" — by default yes, but **follower reads** can serve bounded-staleness reads locally for lower latency.
- "More columns are free" — no. Projection pushdown matters; selecting `*` ships columns you don't need across the network.
- "`EXPLAIN` shows the network cost" — use `EXPLAIN (ANALYZE, DIST)`; plain `EXPLAIN` hides RPCs and pushdowns.

**What follows from this topic**

This is the execution counterpart to **Indexes & Query Performance** — an index-only scan is really the ultimate pushdown (fetch nothing extra from the base table), and both are read via the same `EXPLAIN (ANALYZE, DIST)` tool. The single-tablet-vs-scatter-gather distinction ties straight back to the **sharding** topic: how you choose your primary key decides whether hot queries land on one tablet or fan out. The distributed-join cost connects to schema design and colocation (co-locating related data to avoid cross-node shuffles). And follower reads connect to the multi-region/replication topics. In short, this topic explains *why* the sharding and indexing decisions elsewhere in the primer matter — they exist to make execution push compute to the data.

### Q1. Walk me through how a SELECT actually executes across the cluster.

1. The client connects to a TServer. That node's **query layer (the PostgreSQL process) becomes the coordinator** for this query.
2. The coordinator **parses, plans, and optimizes** the query.
3. It figures out which **tablets** hold the relevant rows and issues **RPCs to those tablet leaders** — which may live on other nodes.
4. Each tablet does its part (ideally with filters/projections **pushed down**) and returns results.
5. The coordinator **gathers** the responses, does any final work (final aggregation, sort, join assembly), and returns rows to the client.

The mental headline: **one coordinator, scatter to tablet leaders, gather back**. Every scatter is a network round-trip, so the whole performance story is about **how many tablets you touch and how much data each returns**.

### Q2. What is the coordinator, and why does it matter that it can be any node?

The **coordinator** is the **query-layer (Postgres) process on whichever TServer the client connected to**. There's no special "master" node for queries — any node can coordinate any query. It plans the query and orchestrates the scatter-gather to tablet leaders.

Why it matters: it means the coordinator and the data are frequently **not co-located** — the node you connected to may own none of the tablets your query needs, so it must make cross-node RPCs. This is why **connection routing** and **data placement** affect latency, and why a query confined to the coordinator's own tablet(s) is cheaper than one that fans out across the cluster.

### Q3. Why is minimizing cross-node round-trips the core performance concern?

Because in a shared-nothing distributed database, **network latency dominates**. A local disk/memory read inside a tablet is microseconds; a cross-node RPC is a network hop — orders of magnitude slower, and you often need *many* of them. Ten sequential cross-node round-trips can dwarf the actual data-processing time.

So performance work is mostly about **reducing round-trips and bytes on the wire**: keep queries on a single tablet where possible, push filtering/aggregation into the tablets so less data travels, batch operations to amortize round-trips, and avoid cross-node joins that shuffle data. Everything in this topic is a variation on "the network is the bottleneck — do less of it."

### Q4. What are pushdowns, and why are they the key optimization?

**Pushdowns** move computation **from the coordinator down to DocDB on the tablet servers**, so work happens *where the data lives* instead of after shipping raw rows across the network.

The naive model: the coordinator pulls every candidate row from every tablet, then filters/aggregates centrally — huge amounts of data cross the wire. The pushdown model: each tablet **filters, projects, and pre-aggregates locally** and returns only the small result.

Because the network is the bottleneck, pushdowns are *the* lever: they directly cut the bytes and rows crossing between nodes. The whole principle is **"push compute to the data, don't pull data to the compute."** When a query is slow, a missing pushdown (visible in `EXPLAIN (ANALYZE, DIST)`) is a prime suspect.

### Q5. Explain the main types of pushdown.

- **Predicate / filter pushdown** — apply the `WHERE` clause **at the tablet**, so only matching rows travel back. Instead of shipping a million rows and keeping ten, the tablet returns ten.
- **Projection pushdown** — fetch **only the needed columns**, not entire rows. `SELECT name` doesn't drag along a big `payload` column.
- **Aggregate pushdown** — compute `COUNT`/`SUM`/`MIN`/`MAX`/etc. **partially at each tablet**; the coordinator just combines the partial results. A cluster-wide `COUNT(*)` returns one number per tablet, not every row.
- **LIMIT pushdown** — stop scanning early at the tablet once enough rows are found, instead of materializing everything and truncating at the coordinator.

All four exist for the same reason: **cut the data crossing the network**. `EXPLAIN (ANALYZE, DIST)` shows which were applied.

### Q6. What's the difference between a single-tablet query and a multi-tablet scatter-gather?

A **single-tablet query** is one whose key predicate restricts it to exactly one tablet — e.g. a lookup on the full hash-partition key. The coordinator makes **one RPC to one tablet leader** and gets the answer. This is the fast path: one hop, minimal data.

A **multi-tablet scatter-gather** touches many tablets — a range scan across a hash-sharded table, or a query with no selective key predicate. The coordinator fans out RPCs to **many tablet leaders across nodes** and combines results. More hops, more data, more latency.

The design implication ties straight to sharding: **choose your primary key so your hot queries are single-tablet**. A query pattern that always fans out cluster-wide is a schema smell.

### Q7. Why are distributed joins expensive, and how do you mitigate them?

They're expensive because the rows being joined may live on **different tablets on different nodes**. To match them, the engine must **shuffle data across the network** — far costlier than a single-node Postgres join where everything is in local memory. A join across large, differently-sharded tables can generate a lot of cross-node traffic.

Mitigations:

- **Colocation** — co-locate related tables/rows on the same tablet (e.g. colocated tables for small related data) so the join is local.
- **Denormalization** — where appropriate, store data together to avoid the join entirely.
- **Indexes** — an index can turn a scan-heavy join side into targeted lookups.
- **Join order / planning** — join the most selective side first to shrink the shuffled set.
- **Design for co-location** — key related tables so joined rows land together by design.

The senior answer names the cause (cross-node shuffle) *and* the mitigations.

### Q8. How do batching and prepared statements help?

Both **amortize round-trips**, which is the whole game in a distributed DB.

- **Prepared statements** parse/plan once and reuse the plan, avoiding repeated planning overhead and letting the layer reuse cached metadata. They also enable operation batching.
- **Batching** groups many operations into fewer network round-trips — e.g. a multi-row insert or a batched write instead of N separate statements, each with its own coordinator↔tablet hop.

Instead of paying one (or more) network round-trip *per* operation, you pay far fewer for the batch. On a high-throughput write path or a loop of point operations, batching is often the single biggest latency win, because it attacks the dominant cost directly: the number of network hops.

### Q9. What are follower reads and when would you use them?

By default, reads go to the **tablet leader** for linearizable, strongly-consistent results. **Follower reads** let you serve a read from a **local follower replica** instead, accepting **bounded staleness** in exchange for **lower latency** — especially valuable in multi-region deployments where the leader may be in a distant region.

```sql
SET yb_read_from_followers = true;
SET default_transaction_read_only = true;
```

Use them for read-heavy, latency-sensitive workloads that can tolerate slightly stale data (dashboards, analytics, geographically local reads) and want to avoid a cross-region hop to the leader. You would *not* use them where you must read your own latest writes. It's a deliberate latency-for-freshness trade.

### Q10. How does the query layer avoid re-fetching metadata on every query?

The query layer **caches table and tablet metadata** — schema, and which tablets hold which key ranges / which nodes host their leaders. Without caching, every query would need extra round-trips to the YB-Master control plane just to learn where the data lives, adding latency to everything.

By caching this metadata locally, the coordinator can plan and route straight to the right tablet leaders. The cache is refreshed/invalidated as the cluster changes (tablet splits, leader moves, load balancing), so it stays correct without paying a metadata lookup on the hot path. This is part of why steady-state queries are fast even though the topology underneath is dynamic.

### Q11. How do you use EXPLAIN (ANALYZE, DIST) to see the pushdowns and RPCs?

`EXPLAIN (ANALYZE, DIST)` executes the query and exposes the **distributed** execution details that plain `EXPLAIN` hides:

```sql
EXPLAIN (ANALYZE, DIST)
SELECT count(*) FROM orders WHERE status = 'open';
```

Read it for:

- **RPC round-trips** — how many network hops to tablet servers.
- **Rows scanned at storage vs rows returned** — a big gap that *didn't* get filtered means a missing predicate pushdown.
- **Which pushdowns applied** — filter, projection, aggregate.
- **Access path** — single-tablet vs scatter, index vs seq scan.

If a `COUNT` scans millions of rows and returns them to the coordinator instead of pre-aggregating per tablet, you'll see it here — and know a pushdown didn't happen. This is the tool that turns "it feels slow" into "here's the round-trip it's paying."

### Q12. Show how a bad plan blows up latency.

Consider `SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.status = 'open';` on two large, differently-sharded tables with no helpful index.

What goes wrong:

- **No predicate pushdown** on a non-sargable filter → every tablet ships rows back.
- **Full distributed scan** of `orders` across all tablets.
- **Cross-node join** → `orders` rows and matching `customers` rows live on different nodes, forcing a network **shuffle**.
- **`SELECT *`** → no projection pushdown; wide rows cross the wire.

Each factor multiplies round-trips and bytes. `EXPLAIN (ANALYZE, DIST)` would show a Seq Scan, huge rows-scanned counts, and many RPCs. Fix it by indexing the filter (predicate pushdown / index scan), selecting only needed columns (projection), and co-locating or denormalizing the join — turning a cluster-wide shuffle into targeted, pushed-down work.

### Q13. How does parallelism across tablets help — and when doesn't it?

Because a table's data is spread across **many tablets**, the coordinator can **scatter RPCs to those tablets in parallel** and let each do its share of the scan/filter/aggregate simultaneously. For a large analytical scan, this parallelism across tablets (and nodes) is a strength — you get more aggregate CPU and I/O working at once.

It *doesn't* help — and can hurt — when the query fans out to **more tablets than it needs**: a point lookup that scatters cluster-wide pays coordination overhead for no benefit, and a wide scatter-gather still has to **gather** everything back through one coordinator, which can bottleneck. Parallelism is great for genuinely large scans, wasteful for queries that should have been single-tablet. The goal is *right-sized* fan-out, not maximal fan-out.

### Q14. Sequential scan vs index scan in a distributed context — what's the difference in cost?

- **Sequential (full) scan** — read across **all tablets** of the table, on all nodes, and filter. Even with predicate pushdown reducing returned rows, you still pay to *touch every tablet* — many RPCs, scaling worse as data (and tablet count) grows.
- **Index scan** — route to the **specific index tablet(s)** that own the value, then fetch the base row (or answer entirely from a **covering index** = index-only scan, one hop).

The distributed twist: the gap between them is *wider* than in single-node Postgres, because a seq scan's cost is "round-trips to every tablet," not just "read a local heap." So the presence of a usable index can be the difference between one RPC and hundreds. `EXPLAIN (ANALYZE, DIST)` shows which path you got.

### Q15. My query is fine on small data but slow at scale — walk me through diagnosing it.

A systematic pass, all grounded in "the network is the bottleneck":

1. **`EXPLAIN (ANALYZE, DIST)`** first — count RPCs and compare rows-scanned vs rows-returned.
2. **Is it single-tablet or scatter-gather?** If a query that *should* be a point lookup is fanning out, your key/sharding or predicate is wrong.
3. **Are pushdowns applied?** A big scanned-vs-returned gap means a filter/projection/aggregate that *isn't* being pushed down — the coordinator is pulling raw rows. Fix the predicate or add an index/expression index so it's sargable.
4. **Is there a cross-node join?** If so, that's likely the culprit — consider colocation, denormalization, join order, or an index on the join key.
5. **`SELECT *`?** Trim to needed columns for projection pushdown.
6. **Consider follower reads / batching** if latency (not correctness) is the issue and the pattern allows.

The reason it degrades *with scale* is almost always that a full distributed scan or cross-node shuffle grows with the data — the fix is to make execution **push compute to the data** and stay on as few tablets as possible.
## Multi-Region & Geo-Distribution

### Summary

**What this topic covers**

How to run YugabyteDB across more than one region — and the fact that there is no single "multi-region mode", but a **menu of deployment options** each trading consistency, latency, RPO/RTO, and data residency differently. This is one of the most-loved senior interview areas for distributed SQL, because it forces you to reason about the physics: the speed of light between regions is fixed, a Raft write needs a quorum, and therefore **synchronous cross-region writes cannot escape WAN latency**. The 17 questions here walk the five levers — a **synchronously-replicated stretched universe**, **geo-partitioning** (row-level, via tablespaces), **read replicas**, **follower reads**, and **xCluster** async replication — and then the decision framework that picks between them for a given requirement (zero-RPO failover vs data residency vs local read latency vs loose-coupled DR). If you can only memorise one thing: **spreading data across regions buys resilience and locality, but synchronous replication makes every write pay the inter-region round-trip.**

**Mental model**

Start from the write path. Every write commits through Raft to a **majority of its tablet's replicas**. If those replicas sit in three different regions, the leader must hear back from at least one *remote* region before it acknowledges — so the floor on write latency is roughly one cross-region round-trip (tens of ms within a continent, 100+ ms intercontinental). That single fact generates the whole design space. If you cannot tolerate that latency but still want multi-region, you either (a) keep the *data* that a user touches in *their* region so the quorum is local (**geo-partitioning**), (b) keep writes single-region and replicate **asynchronously** to another universe for DR (**xCluster**, accepting a data-loss window), or (c) leave writes alone but make *reads* local (**follower reads / read replicas**). Everything else is tuning: **preferred region / leader placement** pins tablet leaders into one region so the common write path stays intra-region while followers absorb the WAN cost. Think of it as a dial from "one strongly-consistent universe stretched thin" to "two loosely-coupled universes glued with async replication."

**Key terms**

- **Universe** — a YugabyteDB cluster (data + the YB-Master control plane); the unit that xCluster replicates *between*.
- **Stretched (synchronous) cluster** — one universe with RF replicas spread across regions; strong consistency, zero-RPO region failover, high write latency.
- **Preferred region / leader placement** — pinning tablet *leaders* to one region so most writes stay local while followers are remote.
- **Geo-partitioning** — partitioning a table by a region column and pinning each partition to a region via **tablespaces**; data lives and is served where it belongs.
- **Tablespace** — the YugabyteDB placement primitive that maps a partition/table to specific regions/zones and an RF.
- **Read replica** — an asynchronous, read-only replica set in another region for low-latency local reads; not part of the write quorum; eventually consistent.
- **Follower read** — reading from a local follower replica (bounded staleness) instead of the leader, for lower read latency.
- **xCluster** — asynchronous replication between two *separate* universes; uni- or bi-directional; for DR / active-active; has an RPO (data-loss) window.
- **RPO / RTO** — recovery point (data you can lose) / recovery time (how long to recover) objectives; sync = RPO 0, xCluster = RPO > 0.
- **Data residency / sovereignty** — the legal requirement (GDPR etc.) that a user's data physically stays in a jurisdiction; geo-partitioning's headline use.

**Why interviewers ask this**

Multi-region is where juniors and seniors separate cleanly. A junior says "put it in three regions for high availability" and stops. A senior immediately asks *the* clarifying questions: what's your RPO, can you tolerate cross-region write latency, and do you have data-residency law to satisfy? The signal is whether you understand that **you cannot have zero-RPO region failover, low write latency, AND a globally shared write set all at once** — you must pick. Interviewers also probe whether you know the concrete mechanisms (tablespaces for geo-partitioning, preferred region for leaders, xCluster for async DR) rather than hand-waving "it's distributed so it just works." The best candidates give a decision framework and defend the tradeoff, not a single answer.

**Common confusions**

- "Multi-region always means low latency because data is close." — Only *reads* get closer for free; synchronous *writes* get *slower* because the quorum spans regions.
- "A stretched cluster and xCluster are the same." — A stretched cluster is *one* synchronous universe (RPO 0); xCluster is *two* universes replicated *asynchronously* (RPO > 0).
- "Geo-partitioning is sharding." — It's placement, not just distribution: rows are pinned to a specific region by a partition key, primarily for residency and locality, still under one logical table.
- "Follower reads are stale forever." — They're *bounded*-staleness; you choose a staleness window, and it's typically small.
- "xCluster gives strong consistency across regions." — No; it's asynchronous, so the target lags and a failover can lose the un-replicated tail.
- "Preferred region changes where data lives." — It moves *leaders* (the write path), not the placement of replicas.

**What follows from this topic**

Multi-region sits on top of the replication and consistency machinery from the Replication & Consistency and Sharding topics — Raft quorums, RF, and tablet leaders are the primitives every option here manipulates. The failover behaviour of a stretched cluster is the subject of the **High Availability & Failure Handling** topic. The latency mechanics (why a cross-region write is 3× a local one, how to diagnose it) reappear in **Performance Tuning & Scaling**. If the sync/async and quorum ideas feel shaky, revisit those topics before trying to defend a multi-region design in an interview.

### Q1. What are the multi-region deployment options in YugabyteDB, and how do they differ?

There are five main options, each a different point on the consistency/latency/RPO curve:

| Option | Consistency | Write latency | RPO on region loss | Primary use |
|---|---|---|---|---|
| Stretched sync cluster | Strong (linearizable) | High (cross-region quorum) | 0 | Zero-data-loss HA across regions |
| Geo-partitioning | Strong, per-region local | Low (local quorum) | 0 within region | Data residency + local latency |
| Read replicas | Eventual (async) | Unaffected (read-only) | n/a (reads) | Low-latency local reads |
| Follower reads | Bounded staleness | Unaffected | n/a (reads) | Cheaper/local reads off leaders |
| xCluster | Eventual (async) | Low (single-region writes) | > 0 (async lag) | DR / active-active across universes |

The mental split: **one synchronous universe** (stretched, geo-partitioned) versus **read offloading** (read replicas, follower reads) versus **two async universes** (xCluster). You often combine them — e.g. a geo-partitioned universe with follower reads.

### Q2. Why do synchronous cross-region writes have high latency, and can you avoid it?

Because a write commits only after a **Raft quorum** acknowledges it. In a stretched RF=3 cluster with one replica per region, the leader must get a round-trip to at least one *remote* region before acking — so write latency is floored by the inter-region network RTT (tens of ms same-continent, 100+ ms intercontinental). It's physics, not a config bug.

You can't remove the quorum, but you can move *what pays for it*:

- **Geo-partitioning** — keep each user's data (and its 3 replicas) inside one region, so the quorum is *local*. Writes stay fast; you just lose the "any region can serve any row" property.
- **Preferred region / leader placement** — pin all tablet leaders into one region. Clients near that region get local-ish latency; the followers still absorb the WAN cost for durability, but the client-facing hop is cheaper.
- **xCluster** — make writes single-region and async-replicate for DR, accepting an RPO window.

So the honest interview answer: "You avoid cross-region *write* latency by not requiring a cross-region *quorum* — either localise the data (geo-partition) or drop to async (xCluster)."

### Q3. What is a stretched synchronous cluster and when would you choose it?

A **single universe** with its RF=3 (or RF=5) replicas spread across 3 (or 5) regions, all replicating synchronously via Raft. Its defining property: it **survives a full region loss with zero data loss and no consistency compromise** — the remaining regions still form a quorum, a new leader is elected, and the cluster keeps serving strongly-consistent reads and writes.

Choose it when the hard requirement is **zero-RPO region-level failover** and you can *afford the write latency*. Classic fit: financial/ledger systems that must never lose a committed transaction and must survive an AWS region going dark, where writes are not ultra-latency-sensitive.

Mitigate the latency with **preferred region** for leaders so the steady-state write path is as local as possible, and keep RF replicas in *3 regions* (not 2 + witness) so any single region loss still leaves a quorum. The cost you accept: every write is a cross-region round-trip.

### Q4. What is geo-partitioning and why is it the "killer feature" for global apps?

Geo-partitioning uses PostgreSQL **row-level partitioning** plus YugabyteDB **tablespaces** to pin each partition of a table to a specific region. You partition by a region column, and each partition's tablets (and their replicas) physically live in that region.

```sql
-- one tablespace per region, pinning replicas there
CREATE TABLESPACE eu_ts WITH (replica_placement='{"num_replicas":3,
  "placement_blocks":[{"cloud":"aws","region":"eu-west-1","min_num_replicas":3}]}');

CREATE TABLE users (
  id uuid, geo text, name text, ...
) PARTITION BY LIST (geo);

CREATE TABLE users_eu PARTITION OF users FOR VALUES IN ('EU') TABLESPACE eu_ts;
CREATE TABLE users_us PARTITION OF users FOR VALUES IN ('US') TABLESPACE us_ts;
```

Now an EU user's row lives *and is served* in the EU: local reads, local write quorum (low latency), and the data **never leaves the EU** — satisfying GDPR/data-sovereignty. US users' rows live in the US. It's still **one logical `users` table** you can query normally. That combination — data residency *and* local latency *and* a single SQL surface — is why it's the standout multi-region feature. The catch: cross-region queries (an EU query touching US rows) pay WAN latency, so it works best when access is region-local.

### Q5. What are read replicas, and how do they differ from synchronous replicas?

Read replicas are **asynchronous, read-only** replicas placed in another region. They are **not part of the Raft write quorum**, so they never slow writes down; the leader ships them updates asynchronously, meaning they are **eventually consistent** (slightly stale).

Use them to give users in a region low-latency **local reads** without paying to make that region part of the write path. Example: primary write cluster in `us-east`, a read-replica cluster in `ap-south` so APAC users read locally while all writes still commit in `us-east`.

Contrast with a synchronous (voting) replica: that participates in the quorum, keeps strong consistency, but adds its region's RTT to write latency. Read replicas trade consistency for zero write-path impact.

### Q6. What are follower reads and when would you use them?

Normally reads go to the tablet **leader** for linearizable consistency. **Follower reads** let a client read from a *local follower* replica instead, accepting **bounded staleness**:

```sql
SET yb_read_from_followers = true;
SET yb_follower_read_staleness_ms = 30000;  -- accept up to 30s staleness
-- reads in this (read-only) txn now hit the nearest follower
```

Use them when (a) the read can tolerate slightly stale data (dashboards, product catalogs, analytics) and (b) a follower is *closer* than the leader, so you save the cross-region hop to the leader. They offload the leader and localise reads without any extra replicas.

Difference from read replicas: follower reads use the *existing voting followers* of the RF group; read replicas are *additional, non-voting* async replicas. Both give local, eventually/bounded-consistent reads.

### Q7. What is xCluster replication and how does it differ from a stretched cluster?

xCluster is **asynchronous replication between two separate universes**. Writes commit locally in the source universe (fast, single-region quorum), then stream asynchronously to the target universe.

| | Stretched sync cluster | xCluster |
|---|---|---|
| Topology | One universe, replicas across regions | Two separate universes |
| Replication | Synchronous (Raft quorum) | Asynchronous |
| Write latency | High (cross-region) | Low (local) |
| Consistency | Strong | Eventual (target lags) |
| RPO on failover | 0 | > 0 (the un-shipped tail) |
| Coupling | Tight (one cluster) | Loose (independent clusters) |

Choose **xCluster** when you want low local write latency and loose coupling and can accept a small data-loss window on failover — classic **active-passive DR** (primary + standby in another region) or **active-active** (both take writes). Choose a **stretched cluster** when zero data loss on region failure is non-negotiable and you can pay the write latency.

### Q8. What is the difference between unidirectional and bidirectional xCluster?

**Unidirectional (active-passive)** — one source universe replicates to a read-only/standby target. Used for DR: normal traffic hits the primary; on disaster you promote the standby (losing the async tail = RPO > 0). Simple, no conflict handling.

**Bidirectional (active-active)** — both universes take writes and replicate to each other. Gives low-latency writes in *both* regions, but you must **avoid write conflicts** on the same rows (no cross-universe conflict resolution guarantees like a single Raft group gives). Safe pattern: partition ownership so each region only writes its *own* keys (e.g. region A owns even IDs / EU rows, region B owns US rows), turning it into two non-overlapping write sets that happen to share schema. Never let both sides update the same row concurrently and expect a clean merge.

### Q9. Give a decision framework for choosing a multi-region strategy.

Ask what the *hard* requirement is, then pick:

- **Need zero-RPO survival of a full region loss + can tolerate write latency** → **stretched synchronous cluster** across 3 regions, with preferred-region leaders.
- **Need data residency/sovereignty (GDPR) + local latency per region** → **geo-partitioning** via tablespaces.
- **Need low-latency local reads, writes centralised** → **follower reads** (tolerate staleness, no extra infra) or **read replicas** (dedicated read cluster).
- **Need async DR / loose coupling / low local write latency, can accept an RPO window** → **xCluster** (unidirectional for DR, bidirectional with partitioned ownership for active-active).

The meta-point interviewers want: **one size doesn't fit all** — you often combine (geo-partitioned universe + follower reads + xCluster to a DR region). Lead with the RPO and latency requirements; the option falls out of those.

### Q10. Design a globally-distributed database for an app with EU, US, and APAC users and GDPR data residency.

Requirements: EU personal data must stay in the EU, users want local latency, and the business wants regional resilience.

**Design:** one YugabyteDB universe, **geo-partitioned** by region:

- `PARTITION BY LIST (geo)` on the user-data tables; partitions `_eu`, `_us`, `_apac`, each pinned to that region's tablespace with RF=3 *within* the region (so a region's data has local quorum and never leaves — GDPR satisfied).
- Each region's writes/reads for its own users stay **local and low-latency** (local quorum, no WAN hop).
- Add **follower reads** for read-mostly reference tables that are globally shared, so any region reads them locally with bounded staleness.
- For DR, run **xCluster** to a secondary universe (or use in-region RF=3 across 3 AZs for zonal HA).

**Why not a stretched cluster?** It would force cross-region quorums (slow writes) and, worse, could place EU rows' replicas outside the EU — violating residency. Geo-partitioning is the fit because the requirement is *residency + locality*, not *global zero-RPO on a single write set*.

### Q11. How does "preferred region" / leader placement help, and what does it not fix?

You designate a **preferred region** so the load balancer places all (or most) **tablet leaders** there. Since writes and leader (linearizable) reads go through the leader, clients near the preferred region get a fast client→leader hop.

What it **fixes**: it avoids clients paying to reach a leader in a far region, and concentrates the fast path in one place.

What it **does not fix**: the **write still needs a cross-region quorum** — the leader must reach at least one remote-region follower to commit, so durability still costs a WAN round-trip. Preferred region reduces the *client-facing* latency and read latency, not the fundamental cross-region commit cost. To remove *that*, you need local quorums (geo-partitioning) or async (xCluster). Also: all leaders in one region means that region's loss triggers a wave of leader elections elsewhere (brief unavailability, then recovery).

### Q12. What are the RPO and RTO characteristics of each multi-region option?

- **Stretched sync cluster**: **RPO = 0** (committed = on a cross-region quorum, so a region loss loses nothing), **RTO = seconds** (Raft re-elects leaders automatically).
- **Geo-partitioning**: within a region it's a normal RF=3 sync setup — **RPO = 0, RTO = seconds** for zonal failures; a *whole-region* loss makes that region's partitions unavailable unless you also replicate them.
- **Read replicas / follower reads**: they serve reads only; losing them costs no data (RPO n/a for writes), and clients just fail over to the leader.
- **xCluster**: **RPO > 0** — the asynchronous lag (un-shipped writes) is lost on an unplanned failover; **RTO** depends on how fast you promote the target and redirect clients (often minutes, manual or orchestrated).

The headline: **only synchronous replication gives RPO 0**. Anything async (xCluster, read replicas) trades a data-loss window for lower write latency / looser coupling.

### Q13. A team put a 3-region stretched cluster in prod and write latency is 120 ms. Is this a bug?

No — that's the expected physics, not a bug. In a stretched sync cluster, every write commits via a **Raft quorum spanning regions**, so latency is floored by the inter-region RTT. 120 ms is consistent with an intercontinental round-trip to reach a remote-region follower for the quorum.

Diagnose and improve:

- Confirm replicas are in **three** regions (if intercontinental, that's your number). Consider 3 *nearby* regions instead of 3 continents if the app allows.
- Set a **preferred region** so at least the client→leader hop is local.
- If the workload is region-partitionable, **geo-partition** so each write's quorum is *local* — that's the real fix, turning 120 ms into single-digit ms per region.
- If they can tolerate an RPO window, switch to **single-region writes + xCluster** DR.

The interview point: recognise it as inherent cross-region quorum cost and reach for geo-partitioning or async, not for "tune the network."

### Q14. How do you provide low-latency local reads in every region without slowing writes?

Two tools, both leave the write path untouched:

- **Follower reads** — clients read the nearest **follower** with bounded staleness (`yb_read_from_followers = true`). No new infrastructure; uses the existing RF followers. Best when there's already a follower in each read region.
- **Read replicas** — add **async, non-voting** read-only replicas in regions that need local reads but aren't part of the RF group. Best when you want reads in a region that has *no* voting replica.

Both are eventually/bounded-consistent and, crucially, **not in the write quorum**, so writes keep their existing latency. If reads must be *strongly* consistent, they have to hit the leader (paying the hop) — you can't have local *and* linearizable from a remote follower. Combine with geo-partitioning when the data is region-owned so even leader reads are local.

### Q15. When would you pick xCluster over a stretched synchronous cluster for DR?

Pick **xCluster** when:

- **Write latency matters** — you need writes to commit at single-region speed, not cross-region quorum speed.
- You can **tolerate an RPO window** (some seconds of un-replicated writes lost on an unplanned failover).
- You want **loose coupling** — two independently-operable universes (upgrade/maintain them separately, blast-radius isolation) rather than one stretched cluster whose regions are one failure domain of coordination.

Pick a **stretched cluster** when **RPO must be 0** and you'll pay the write latency to guarantee no committed transaction is ever lost on a region failure.

Rule of thumb: **regulated zero-loss systems → stretched sync; latency-sensitive systems that can accept a small loss window → xCluster DR.**

### Q16. How does YugabyteDB's multi-region model compare to Spanner and CockroachDB here?

All three are Spanner-lineage distributed SQL and offer analogous knobs, but:

| | YugabyteDB | CockroachDB | Spanner |
|---|---|---|---|
| Residency/locality | Geo-partitioning via tablespaces | Regional-by-row / table localities | Placement configs |
| Local reads | Follower reads, read replicas | Follower reads | Stale/bounded reads |
| Async DR | xCluster (uni/bi-directional) | CDC / (newer) PCR | Cross-region configs |
| Clock basis | **HLC + NTP** (max_clock_skew) | **HLC + NTP** | **TrueTime** (atomic clocks, commit-wait) |

The one to emphasise: **YugabyteDB and CockroachDB use Hybrid Logical Clocks over NTP**, so they bound clock skew in software; **Spanner uses TrueTime hardware** and commit-wait. Functionally the multi-region *options* are similar (stretch, geo-partition, local reads, async DR); YugabyteDB's distinctive angle is the **PostgreSQL-compatible** surface over these options and open-source xCluster. Don't claim any of them removes cross-region write latency — none do.

### Q17. Design the multi-region strategy for a global SaaS: strong-consistency billing, low-latency user sessions, and DR.

Different requirements → different tools in one design:

- **Billing/ledger (must be strongly consistent, zero-loss):** put these tables in a **stretched synchronous cluster** (RF=3 across 3 regions) with a **preferred region** for leaders. RPO 0, survives a region loss, accepts write latency because billing volume is low and correctness is paramount.
- **User sessions / profile data (latency-sensitive, residency):** **geo-partition** by user region so each user's session reads/writes are local and (for EU users) stay in the EU.
- **Reference/config data (read-mostly, global):** **follower reads** so every region reads locally with bounded staleness.
- **Disaster recovery for the whole system:** **xCluster** to a secondary universe (or rely on the stretched cluster's built-in region survival for the billing tier).

The interview signal is exactly this: you **don't apply one mode globally** — you segment by each dataset's consistency/latency/residency/RPO needs and combine geo-partitioning, sync placement, follower reads, and xCluster accordingly.

## High Availability & Failure Handling

### Summary

**What this topic covers**

Why YugabyteDB stays up when hardware, zones, or whole regions fail — and what actually happens, mechanically, during each kind of failure. The unifying idea is that **there is no single point of failure**: every tablet is a Raft group and the YB-Master control plane is a Raft group, so any single node/replica loss is just a routine **automatic leader election**, not an outage requiring a human. The 15 questions here cover node failure, zone/AZ failure, region failure, in-flight transaction behaviour, the master group's role, rolling upgrades with zero downtime, self-healing re-replication, how long failover takes and what clients experience, and the CP (consistency-over-availability) behaviour during a network partition. If Replication & Consistency taught you *how* Raft commits writes, this topic is *what Raft buys you when things break*.

**Mental model**

Picture the cluster as thousands of small independent Raft groups (one per tablet), each with a leader and RF-1 followers, plus one special Raft group of 3 YB-Masters holding the metadata. **Failure is local to the groups that lost their leader.** When a node dies, only the tablets whose *leaders* lived on it are briefly affected — each of those groups runs a leader election (a surviving follower wins in a few seconds) and service resumes; tablets that only lost a *follower* never even hiccup. As long as a **majority of each group survives**, the group keeps committing — so RF=3 tolerates 1 loss, RF=5 tolerates 2. There is no "promote the replica" script, no external failover coordinator, no split-brain: Raft's majority rule *is* the failover mechanism, and a minority partition simply cannot elect a leader, so it stops rather than diverging. After a permanent loss, the cluster **self-heals** — the load balancer re-replicates under-replicated tablets onto surviving nodes to restore RF. The whole story is "majority survives → keep going; automatically re-elect and re-replicate."

**Key terms**

- **No single point of failure (SPOF)** — every role (data tablets and the master control plane) is a replicated Raft group, so no one node is irreplaceable.
- **Replication factor (RF)** — replicas per tablet; RF=3 tolerates 1 failure, RF=5 tolerates 2 (needs a surviving majority).
- **Fault tolerance / quorum** — a group keeps serving while > half its replicas are alive; below that it stops (to stay consistent).
- **Automatic leader election** — on a leader's loss, surviving followers elect a new leader in seconds; the core failover mechanism.
- **Under-replicated tablet** — a tablet with fewer live replicas than RF after a loss; the load balancer re-replicates it to restore RF.
- **Self-healing / re-replication** — automatic creation of new replicas on healthy nodes after a permanent node loss.
- **Load balancer (YB-Master function)** — moves leaders off a draining node and rebalances/re-replicates tablets.
- **Rolling upgrade** — upgrading/restarting one node at a time (leaders drained first) so the cluster stays available.
- **Fault domain** — the failure boundary (node / zone / region) you spread replicas across to survive that level of loss.
- **CP system** — under a partition YugabyteDB keeps **C**onsistency and sacrifices **A**vailability on the minority side.

**Why interviewers ask this**

HA is where candidates reveal whether they understand *distributed* systems or just *replicated* ones. A junior answer is "it has replicas, so it's highly available." A senior answer explains the **mechanism**: majority quorum, automatic Raft leader election in seconds, no external coordinator, no split-brain, and self-healing re-replication — and can trace what happens to an *in-flight* transaction (uncommitted aborts and retries; quorum-committed survives). Interviewers also want to hear the honest CAP position: YugabyteDB is **CP**, so during a partition the minority side deliberately becomes unavailable rather than serve stale/divergent data. The strongest signal is describing a real failure timeline — "a node dies, these tablets re-elect within the election timeout, clients see a brief retry, then the balancer restores RF" — because that shows you've operated it, not just read the datasheet.

**Common confusions**

- "You need a script/coordinator to fail over." — No; Raft leader election is automatic and internal. There's no external failover tool to run.
- "A node failure takes the cluster down." — Only the affected tablets' *leadership* blips for an election; the rest keeps serving, and followers-only losses don't blip at all.
- "RF=3 survives 2 failures." — It survives **1** (needs a majority of 2 alive). RF=5 survives 2.
- "Committed data can be lost on failover." — If it was committed (on a quorum) it survives any single failure; only *un-quorum'd* in-flight writes are lost/retried.
- "It stays available on both sides of a partition." — It's CP: the **minority** side stops serving to avoid split-brain; only the majority side continues.
- "The YB-Master is a SPOF." — The masters are their own Raft group of 3; a master leader loss just re-elects, and data-path reads/writes don't even depend on the master being up moment-to-moment.
- "Failover means seconds of full outage." — Only the tablets that lost a leader pause, and only for the election timeout (seconds); clients experience a retry, not a global outage.

**What follows from this topic**

The HA guarantees here are the payoff of the Raft/quorum machinery in Replication & Consistency and the RF/tablet placement from Sharding. The *region-level* failure story connects directly to **Multi-Region & Geo-Distribution** (a stretched cluster's zero-RPO region survival). What clients actually experience during a failover — retries, brief latency spikes — and how self-healing re-replication can affect load feed into **Performance Tuning & Scaling**. If the quorum/majority idea is fuzzy, revisit Replication & Consistency first, because every HA guarantee here is just "a majority survived."

### Q1. How does YugabyteDB achieve high availability with no single point of failure?

Every stateful role in the system is a **replicated Raft group**, so no single node is irreplaceable:

- Each **tablet** (shard) is an RF=3 (or 5) Raft group — one leader, followers. Lose any replica and the group re-elects/continues.
- The **YB-Master** control plane is itself a Raft group of 3, so cluster metadata is HA too.
- **YB-TServers** are stateless-per-request query servers; clients can talk to any of them.

Because failover is **Raft leader election** — automatic, internal, quorum-based — there is no external coordinator, no primary to manually promote, and no SPOF. Lose a node and only the tablet *leaders* it hosted need re-electing (seconds); everything else keeps serving. Contrast a classic primary-replica DB where the single primary *is* the SPOF and promotion needs orchestration.

### Q2. What exactly happens when a single node fails?

Three things, in order:

1. **Leader re-election (seconds).** Tablets whose *leaders* were on the dead node have no leader; their surviving followers detect the missed heartbeats, hit the election timeout, and elect a new leader on another node. Those tablets are briefly unavailable (the election window) then resume. Tablets that only lost a *follower* are unaffected.
2. **Continued service.** Every other tablet — and all follower-only-affected tablets — keeps serving throughout. Clients to the dead node reconnect to a live TServer; drivers retry transparently.
3. **Self-healing re-replication.** The affected tablets are now **under-replicated** (2 of 3 replicas). If the node stays down past a threshold, the load balancer **re-replicates** them onto healthy nodes to restore RF=3, and rebalances leaders.

Net client impact: a brief spike/retry on the minority of tablets that lost a leader, then normal. No data loss for anything that was committed to a quorum.

### Q3. How does replication factor determine fault tolerance?

A Raft group serves as long as a **majority (quorum) of its replicas is alive**. So:

| RF | Quorum needed | Failures tolerated |
|---|---|---|
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

RF=3 is the standard (survives 1 node/zone loss); RF=5 for higher tolerance (survives 2). Note it's **not** "RF-1 failures" — it's "lose fewer than half." Also, *where* the replicas sit determines *what level* you survive: 3 replicas across 3 **zones** → survive a zone loss; across 3 **regions** → survive a region loss. RF gives you the *count* of tolerable failures; placement across fault domains gives you the *kind*.

### Q4. What happens during a zone (AZ) failure?

If the tablet replicas are spread across **at least 3 zones** (one per zone for RF=3), losing a whole zone removes exactly **one replica per tablet** — so every tablet still has a **2-of-3 quorum** in the surviving zones. The cluster:

- Re-elects leaders for tablets whose leaders were in the dead zone (seconds).
- Keeps serving **strongly consistent** reads and writes from the surviving two zones.
- Self-heals: if configured/possible, re-replicates to restore RF once capacity allows (or when the zone returns).

Zero data loss, brief blip on re-electing tablets. The prerequisite is **3 fault domains** — if you'd put 2 of 3 replicas in one zone, losing that zone would take a majority of those tablets down. This is why RF=3 across 3 AZs is the default HA topology.

### Q5. What happens during a region failure?

Same mechanism, one level up. If replicas are spread across **≥ 3 regions** (a stretched synchronous cluster), losing an entire region removes one replica per tablet, a **quorum survives** in the other regions, leaders re-elect there, and the cluster continues with **zero data loss and strong consistency** — this is the zero-RPO region-failover story.

The trade you paid for it is **write latency**: cross-region quorums are slow (see the Multi-Region topic). If instead you ran single-region with async **xCluster** DR, a region loss means promoting the standby and losing the async tail (RPO > 0). So: **stretched sync = survive region loss with RPO 0; xCluster = survive with an RPO window but faster normal writes.** The HA capability follows directly from having ≥ 3 regional fault domains.

### Q6. What happens to in-flight transactions during a failover?

It depends on how far the transaction got:

- **Not yet committed to a quorum** (still buffering, or leader died mid-commit before a majority persisted it): the transaction **aborts**. The client's driver gets a retryable error and re-runs it against the new leader. No partial/torn state is exposed.
- **Committed to a quorum** before the failure: it **survives**. By definition it's durable on a majority of replicas, so the newly-elected leader (which must come from an up-to-date majority member) already has it. The client sees success (possibly after a brief retry to find the new leader).

So the guarantee is clean: **committed = on a quorum = safe across any single failure; uncommitted = aborted and retried.** There's no "maybe committed" grey zone that violates atomicity. Application code should always be prepared to **retry** on transient/leader-change errors — that's the one thing clients must do.

### Q7. What is the YB-Master's role in HA, and what if the master leader fails?

The **YB-Master** group (3 nodes, its own Raft group) is the control plane: it holds cluster metadata (table schemas, tablet-to-node mapping), does load balancing, coordinates DDL, and manages placement. Because it's a **Raft group of 3**, it's HA too — if the **master leader** fails, the other masters **re-elect a leader** in seconds, and metadata stays available.

Crucially, the **data path is decoupled**: steady-state reads/writes go TServer→tablet-leader and **don't require the master on the critical path** (clients cache tablet locations). So even a brief master outage doesn't stop ongoing queries — it only pauses operations that *need* the master (DDL, new tablet placement, rebalancing). The master being replicated is why metadata isn't a SPOF.

### Q8. How do rolling upgrades achieve zero downtime?

You upgrade **one node at a time** while the cluster stays up:

1. The load balancer **drains leaders** off the target node (moves tablet leadership to other replicas), so the node is only a follower for its tablets.
2. Stop, upgrade, restart that node. Its tablets kept a quorum on the other replicas throughout, so they never lost availability — only the *follower* on this node was briefly absent.
3. The node rejoins, catches up via Raft, leaders rebalance back, and you move to the next node.

Because every tablet keeps its majority alive on the other nodes at all times, **no tablet loses quorum** and clients see at most brief retries as leaders move. This is the same primitive as failure handling — moving leadership and relying on quorum survival — applied deliberately. `yb-admin` and the upgrade tooling orchestrate the drain/upgrade/rejoin loop.

### Q9. How does YugabyteDB self-heal after a permanent node loss?

When a node is **permanently** gone (past the failure-detection threshold), its tablets are **under-replicated** (e.g. 2 of 3 replicas). The **load balancer** (a YB-Master function) automatically:

- **Re-replicates** each under-replicated tablet by creating a fresh replica on a healthy node and streaming the data to it via Raft, restoring RF=3.
- **Rebalances** leaders and replicas so load is even across the surviving/new nodes.

No operator action is required — you replace the dead hardware whenever convenient, and when the new node joins, the balancer moves some replicas onto it to rebalance. This is what "self-healing" means: the cluster restores its own redundancy and balance. The one thing to watch operationally is that re-replication consumes network/IO, so a node loss can cause a temporary load bump while RF is being restored.

### Q10. How is this different from a primary-replica database's failover?

| | Primary-replica (e.g. classic Postgres/MySQL) | YugabyteDB |
|---|---|---|
| Write target | Single primary (SPOF) | Any tablet's leader (many, distributed) |
| Failover | Promote a replica — often a **script/tool** (Patroni, orchestrator) | **Automatic Raft election**, internal |
| Failover time | Seconds–minutes, orchestration-dependent | Seconds (election timeout) |
| Split-brain risk | Real (two primaries if promotion races) | **None** — minority can't elect a leader |
| Data loss | Possible if async replica lagged | None for quorum-committed writes |
| Scope | Whole DB fails over | Only affected tablets re-elect |

The core differences: there is **no single primary**, failover is **built-in and automatic**, there's **no split-brain** (Raft majority forbids two leaders), and failure is **granular** (per-tablet) rather than whole-database. You never write or run a promotion script.

### Q11. How long does a failover take and what do clients experience?

Failover time is essentially the **Raft election timeout** — on the order of **a few seconds** — for the specific tablets that lost their leader. Followers notice missed heartbeats, wait out the timeout, hold an election, and a new leader is serving.

What clients see:

- Requests to *unaffected* tablets: **nothing** — normal latency.
- Requests to tablets mid-election: a **brief retryable error / latency spike**, then success once the new leader is up. Smart drivers retry automatically, so a well-written app just sees a small blip.
- Connections to a dead node: dropped; the driver reconnects to another TServer.

So the honest interview answer is "**seconds, and only for the affected tablets — clients experience a retry, not a global outage.**" This is why apps must implement **retry-on-transient-error**; that's what turns a few-second election into an invisible hiccup.

### Q12. During a network partition, does YugabyteDB stay available? (CAP)

YugabyteDB is a **CP** system: under a partition it preserves **Consistency** and sacrifices **Availability on the minority side**.

Concretely: a tablet's replicas split by a partition. The side with a **majority** of that tablet's replicas keeps a quorum — it can elect/keep a leader and serve strongly-consistent reads and writes. The **minority** side **cannot** reach quorum, so it **refuses** to serve writes (and non-follower reads) for those tablets rather than risk divergence. When the partition heals, the minority replicas catch up via Raft.

This is a deliberate choice: it **prevents split-brain** and guarantees you never read/commit divergent data. The cost is that clients stuck on the minority side lose availability for the affected tablets until the partition heals or they can reach the majority. "Consistent and partition-tolerant; the minority gives up availability."

### Q13. A node dies at 3am. Walk through what happens with no human involved.

1. **~0s:** Node goes dark. Its tablet followers stop heartbeating; its tablet *leaders* stop responding.
2. **~a few seconds:** Every tablet that lost its leader runs a **Raft election**; a surviving up-to-date follower becomes the new leader. Those tablets resume serving. Follower-only-affected tablets never paused.
3. **Throughout:** Clients on the dead node reconnect to other TServers; drivers **retry** the few failed in-flight requests (uncommitted ones re-run; committed ones already survived).
4. **After the failure threshold:** The load balancer sees **under-replicated** tablets and **re-replicates** them onto healthy nodes to restore RF=3, rebalancing leaders. There may be a temporary IO/network bump.
5. **Morning:** You replace the hardware at leisure; the new node rejoins and the balancer rebalances onto it.

No pager script, no manual promotion, no data loss for committed work. That autonomy — "**it fixes itself, you clean up later**" — is the whole point.

### Q14. How do you check cluster health and spot under-replication?

Use `yb-admin` and the master UI:

```bash
# overall cluster/tablet health and any under-replicated tablets
yb-admin -master_addresses <masters> list_all_tablet_servers
yb-admin -master_addresses <masters> get_universe_config

# per-table tablet/replica placement and leader distribution
yb-admin -master_addresses <masters> list_tablets ysql.mydb mytable

# check for under-replicated / leaderless tablets
yb-admin -master_addresses <masters> get_load_move_completion
```

The **YB-Master web UI** (port 7000) shows tablet-server liveness, under-replicated/leaderless tablet counts, and load-balancer activity at a glance. Watch for: dead/unresponsive TServers, tablets below RF, leaderless tablets, and ongoing load-balancer moves (which indicate re-replication/rebalancing in progress). In production you'd also scrape the Prometheus metrics (tablet health, leader counts, RPC latencies) into dashboards/alerts rather than eyeballing `yb-admin`.

### Q15. What is YugabyteDB's durability guarantee, and how is it upheld across failures?

The guarantee: **a write acknowledged as committed is durable on the disks of a Raft quorum** of its tablet's replicas. The leader only acks after a **majority persisted the record to their WAL** (fsynced). Therefore:

- Any **single** node loss cannot lose committed data — a majority still has it, and the next leader is elected from an up-to-date majority member.
- A **zone/region** loss (with replicas across ≥3 such domains) likewise leaves a quorum holding every committed write → **RPO 0**.
- Only writes that were **not yet on a quorum** when the failure hit are lost — and those were never acknowledged as committed, so no atomicity/durability promise is broken.

This is why "committed" in YugabyteDB is a strong statement: it means **quorum-durable**, which is exactly what lets the automatic failover machinery guarantee no committed data is ever lost across node, zone, or region failures.

## Performance Tuning & Scaling

### Summary

**What this topic covers**

How YugabyteDB scales and the concrete levers you pull when it's slow. Two halves: **scaling** — linear horizontal scale-out by adding TServer nodes, automatic tablet splitting, and the load balancer that spreads leaders/replicas evenly; and **tuning** — the recurring performance problems and their fixes, dominated by the number-one issue, **hotspots** from monotonically-increasing keys. The 16 questions here cover scale-out/scale-in mechanics, tablet splitting and balance, detecting and fixing write/read hotspots (hash-sharding, salting, UUIDs, key reversal), connection management and pooling, batching and prepared statements, keeping transactions single-shard, covering indexes and pushdowns, follower reads for offload, isolation-level tradeoffs, the read/write latency components, and a systematic "my queries are slow — diagnose and scale" method. This is the most *operational* topic: it's where the elegant distributed-SQL model meets the messy reality of skew, connections, and cross-region round-trips.

**Mental model**

Performance in YugabyteDB is governed by **where the data is and how evenly work spreads across tablets**. Throughput scales when load is spread over many tablets on many nodes; it collapses when load concentrates on one — a **hotspot**. So the first question for any slow workload is "is the work *balanced*?" A monotonic primary key (timestamp, `SERIAL`, sequence) on a range-sharded table sends every new write to the *last* tablet, pinning your whole write throughput to one node no matter how many you have — the classic anti-pattern. The fix is to **distribute the key**: hash-shard it, salt it, or use random UUIDs. The second governor is **round-trips**: a write costs a Raft quorum round-trip, a distributed transaction costs a 2-phase coordination across tablets, and a cross-region write costs a WAN hop — so batching, prepared statements, single-shard transactions, and index-only scans all win by cutting round-trips or the amount of cross-tablet work. The third is **connections**: YSQL is Postgres, so each connection is a heavyweight backend process; thousands of them exhaust memory/CPU, hence pooling. Diagnose in that order: **balance → round-trips → connections.**

**Key terms**

- **Linear scale-out** — adding TServer nodes increases capacity/throughput near-linearly as tablets and leaders rebalance onto them.
- **Tablet splitting** — automatic (or manual/pre-) splitting of a tablet as it grows, to keep tablets right-sized and spreadable.
- **Load balancer** — the YB-Master function that spreads tablet replicas and *leaders* evenly across nodes.
- **Hotspot** — a single tablet/node absorbing a disproportionate share of writes or reads; the top performance killer.
- **Monotonic key** — an ever-increasing PK (timestamp/serial/sequence) that funnels writes to one range tablet under range sharding.
- **Hash sharding** — `PRIMARY KEY ((col) HASH)`; hashes the key so writes spread evenly (default in YSQL) — kills write hotspots but loses range scans.
- **Salting / bucketing** — adding a hash/bucket column to a key to spread an otherwise sequential/hot value across tablets.
- **Connection pooling** — reusing a bounded set of backend connections (server-side YSQL Connection Manager, or PgBouncer-style) because YSQL connections are heavy.
- **Prepared statement / batching** — reusing a parsed/planned statement and sending many rows per round-trip to amortise planning and network cost.
- **Covering index / index-only scan** — an index that contains all needed columns (`INCLUDE`) so the query is served from the index without a table lookup.
- **Follower read** — reading from a local follower (bounded staleness) to offload leaders and localise read latency.
- **Single-shard transaction** — a transaction touching one tablet, avoiding the cost of the distributed 2-phase-commit path.

**Why interviewers ask this**

Because tuning a distributed SQL database exposes whether you understand *why* it's distributed, not just that it is. The signature senior question is a **hotspot** scenario: "you have a 12-node cluster but writes don't scale — why?" The junior flails ("add more nodes"); the senior instantly says "monotonic primary key on a range-sharded table — all writes hit one tablet; hash-shard it or add a bucket." Interviewers also probe whether you know that **more nodes don't help a skewed workload**, that YSQL connections are heavy (Postgres heritage) so pooling matters, that distributed transactions and cross-region writes cost round-trips, and that you diagnose with **data** (per-tablet metrics, latency percentiles, node CPU) rather than guessing. The strongest candidates give a **repeatable diagnosis method** — check balance, then round-trips, then connections — and reach for the right `yb-admin`/metrics tool.

**Common confusions**

- "Adding nodes always increases throughput." — Only if the load is *balanced*. A hotspot pins throughput to one node regardless of cluster size.
- "Hash vs range sharding is just a style choice." — It's the difference between even write distribution and a monotonic-key hotspot; it also decides whether range scans work.
- "UUIDs are slower so avoid them for PKs." — A *random* UUID spreads writes and avoids hotspots; a sequential id concentrates them. For write-heavy tables, random UUID/hash usually wins.
- "Connections are free, open as many as you want." — YSQL spawns a backend process per connection; thousands cause memory/CPU pressure — pool them.
- "Serializable is just SI with a flag." — Serializable adds conflict detection and **retries**; under contention it can be markedly slower — pick the weakest isolation that's correct.
- "Every transaction is distributed." — Single-tablet transactions take a cheaper fast path; keep transactions single-shard when you can.
- "Indexes are free reads." — A secondary index is its own set of tablets with its own writes; over-indexing slows writes. Covering indexes help reads but cost on writes.

**What follows from this topic**

Tuning ties every earlier topic together: hotspots come straight from the **Sharding** (hash vs range, tablet) decisions; write/read latency components come from **Replication & Consistency** (Raft quorum) and **Multi-Region** (cross-region round-trips); distributed-transaction cost comes from the **Transactions** topic; and the self-healing re-replication that can bump load comes from **High Availability**. Think of this topic as the applied capstone — the place where getting the earlier models right pays off, and getting them wrong shows up as a latency graph. If a tuning answer feels like guessing, the gap is usually in Sharding or Transactions, not here.

### Q1. How does YugabyteDB scale horizontally, and is scaling linear?

You **add TServer nodes** and the cluster automatically **rebalances tablets and tablet leaders** onto them — no re-sharding, no downtime. Because data is already split into many tablets (each a Raft group), spreading them over more machines gives **near-linear** growth in capacity and throughput *for balanced workloads*: double the nodes, roughly double the throughput.

```bash
# add a node: just start a tserver pointed at the masters
yb-tserver --tserver_master_addrs <masters> ... &
# the load balancer moves tablets/leaders onto it automatically
yb-admin -master_addresses <masters> get_load_move_completion
```

**Scale-in** is the reverse — you `blacklist`/decommission a node and the balancer drains its tablets onto the rest before you remove it. The critical caveat: linearity **assumes even load**. If a hotspot concentrates writes on one tablet, adding nodes does nothing for that bottleneck — the skew must be fixed first (see hotspots).

### Q2. What is tablet splitting and why does it matter for performance?

A **tablet** is the unit of distribution and parallelism. YugabyteDB **auto-splits** a tablet when it grows past a size threshold, producing two tablets that can live on different nodes — so a table's data (and its load) can spread as it grows without manual re-sharding.

Why it matters:

- **Parallelism:** more tablets = more Raft groups = more nodes/cores can work in parallel. A table stuck in *one* tablet can only use one node's write path.
- **Balance:** right-sized tablets let the load balancer distribute leaders/replicas evenly.

For large or bulk-loaded tables, you can **pre-split** at creation (`SPLIT INTO n TABLETS` for hash, or `SPLIT AT VALUES` for range) so you start with enough tablets instead of waiting for auto-split — important to avoid a cold-start bottleneck where everything hits one tablet until it splits.

```sql
CREATE TABLE events (id uuid, ...) SPLIT INTO 24 TABLETS;
```

### Q3. What causes a write hotspot and how do you fix it? (the #1 tuning issue)

A **write hotspot** happens when a **monotonically-increasing key** is used on a **range-sharded** table: timestamps, `SERIAL`/`BIGSERIAL`, sequences, auto-increment IDs. Every new row sorts to the *end* of the key space, so every write lands on the **last tablet** → one tablet, one node, does all the writing regardless of cluster size.

Fixes, roughly in order of preference:

- **Hash-shard the key:** `PRIMARY KEY ((id) HASH)` — hashing scatters sequential values across all tablets. Default for YSQL PKs, and usually the right answer.
- **Use random UUIDs** instead of sequential ids so keys are naturally spread.
- **Add a bucket/salt column** to the partition key when you *need* range order on the real column (e.g. `PRIMARY KEY ((bucket) HASH, ts ASC)` with `bucket = hash(id) % N`).
- **Reverse the key** (e.g. bit-reverse an id) so consecutive values land in different tablets.

```sql
-- hotspot: every insert hits the last tablet
CREATE TABLE events (ts timestamptz, ..., PRIMARY KEY (ts ASC));
-- fixed: writes spread across all tablets
CREATE TABLE events (id uuid DEFAULT gen_random_uuid(), ts timestamptz,
  PRIMARY KEY ((id) HASH));
```

The trade: hashing kills efficient **range scans** on that key. If you truly need ordered scans *and* even writes, salt/bucket so you range-scan within buckets.

### Q4. Spot the problem: `CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, ...)` on a 10-node cluster with slow, non-scaling writes.

The problem is the **`BIGSERIAL` primary key with default range sharding** (an `ASC` primary key). `BIGSERIAL` is a monotonically increasing sequence, so every insert produces the next-highest id, which sorts to the **last range tablet** — a **write hotspot**. All inserts funnel to one tablet on one node; the other 9 nodes sit idle for writes, so adding nodes doesn't help.

Fix — make the key distribute:

```sql
-- Option A: hash-shard the surrogate key
CREATE TABLE orders (id BIGSERIAL, ..., PRIMARY KEY ((id) HASH));
-- Option B (preferred for new schemas): random UUID PK
CREATE TABLE orders (id uuid DEFAULT gen_random_uuid(),
  ..., PRIMARY KEY ((id) HASH));
```

Either spreads inserts across all tablets/nodes, restoring near-linear write scaling. If you must keep sequential ids for ordering, add a **hash bucket** to the partition key so writes spread while you retain range order within a bucket. This is *the* classic YugabyteDB interview trap — a monotonic PK negating the whole point of a distributed DB.

### Q5. How do you detect hotspots?

Look for **imbalance**, not just high latency:

- **Per-tablet metrics** (YB-Master/TServer UI on ports 7000/9000, or Prometheus): compare read/write ops and bytes per tablet — a hotspot shows one tablet with far higher ops than its peers.
- **Per-node resource use:** one TServer pegged at high CPU/IO while others idle is the tell-tale signature of a skewed workload.
- **`yb-admin list_tablets`** to see tablet ranges and leader placement, and check whether a single tablet holds the hot key range.
- **Latency percentiles:** p99 spiking while throughput is capped, and throughput *not* rising when you add nodes, both point at a hotspot rather than a global capacity limit.

The diagnostic mindset: if one node/tablet is hot while the rest are cool, it's **skew** (fix the key/sharding), not insufficient capacity (which would show *all* nodes busy).

### Q6. Why does connection management matter, and how do you handle it at scale?

Because **YSQL is PostgreSQL**, and Postgres spawns a **backend process per connection**. Each connection carries real memory and scheduling overhead, so thousands of direct connections (e.g. many app instances each with a big pool) cause **memory and CPU pressure** on the TServers — degrading everyone, sometimes tipping into instability.

Handle it with **pooling**:

- **YSQL Connection Manager** — YugabyteDB's built-in server-side connection pooler; multiplexes many client connections onto fewer backends.
- **Client/side or middle-tier pooling** (PgBouncer-style, or the app framework's pool) with a **bounded** max size.

Rule of thumb: size the pool to the cluster's capacity (a few×cores), not to your peak client count. A "connection storm" — many clients opening connections at once (e.g. after a failover or a serverless scale-up) — is a real outage cause; pooling and bounded pools are the defence.

### Q7. How do batching and prepared statements improve performance?

Both cut per-operation overhead:

- **Prepared statements** parse and plan the query **once**, then execute many times with different params — saving repeated parse/plan cost. In a distributed DB, avoiding re-planning on every call is a real win, and drivers can cache the plan.
- **Batching** sends **many rows/statements per round-trip** instead of one-at-a-time. Since each round-trip to a tablet leader costs network + a Raft quorum commit, batching amortises that fixed cost across many rows — often a multiple-× throughput gain for bulk inserts.

```sql
-- multi-row insert: one round-trip, one commit, many rows
INSERT INTO events (id, payload) VALUES
  (gen_random_uuid(), $1), (gen_random_uuid(), $2), (gen_random_uuid(), $3);
```

Also use **`COPY`** for large bulk loads. The general principle: **round-trips are the enemy** — anything that packs more work into fewer round-trips (batching, prepared statements, multi-row DML) helps, especially across regions.

### Q8. Why keep transactions single-shard/small, and how?

A transaction touching a **single tablet** takes a cheap **fast path** — the tablet's leader commits it via its own Raft group, no cross-tablet coordination. A **multi-tablet (distributed) transaction** must run the **2-phase-commit-style protocol** with provisional records/write intents and a transaction-status tablet — extra round-trips, more contention, higher latency.

So, to keep transactions cheap:

- **Co-locate related rows** so a logical operation stays in one tablet — e.g. design keys so a user's data shares a partition, or use **colocated tables** for small related tables.
- **Keep transactions small and short** — fewer statements, fewer tablets touched, held for less time (less contention → fewer retries).
- **Avoid unnecessary multi-row cross-tablet updates** in one transaction where independent transactions would do.

The interview point: distributed transactions *work* and are ACID, but they're **not free**; a schema that keeps common operations single-shard scales far better.

### Q9. How do covering indexes and pushdowns speed up reads?

A **secondary index** in YugabyteDB is its own distributed (tablet) structure. A normal indexed lookup finds the row's key in the index, then does a **second lookup** to the base table for the other columns — two round-trips across tablets. A **covering index** includes all the columns the query needs (via `INCLUDE`), so the query is answered **entirely from the index** (an **index-only scan**) — no base-table trip.

```sql
-- query needs email + name filtered by email; cover it
CREATE INDEX idx_users_email ON users (email) INCLUDE (name);
-- SELECT name FROM users WHERE email = $1;  -- index-only, one lookup
```

**Pushdowns** help too: YugabyteDB pushes filters/aggregates down to the tablet (DocDB) layer so less data crosses the network to the query layer. The trade for covering indexes: every extra index is **more write amplification** (each insert/update maintains it), so cover the *hot* queries, don't index everything.

### Q10. How do follower reads help performance, and what do they cost?

**Follower reads** let read-only queries hit a **local follower** replica instead of the (possibly remote) leader, with **bounded staleness**:

```sql
SET yb_read_from_followers = true;
SET yb_follower_read_staleness_ms = 30000;
```

Two performance wins: (1) **offload the leaders** — spreads read load onto followers, relieving a read-hot leader; (2) **localise latency** — in multi-region, read from the nearby follower instead of paying a WAN hop to the leader.

The cost is **staleness**: you may read data up to the configured window old, so only use it where that's acceptable (dashboards, catalogs, analytics — not read-your-own-writes flows). It doesn't help write latency at all. Pair it with geo-partitioning (data already local) when you can, but follower reads are the cheapest way to get local reads without extra replicas.

### Q11. How does the isolation level affect performance?

Higher isolation = more conflict checking and more **retries** under contention:

| Level | Behaviour | Perf characteristic |
|---|---|---|
| Read Committed | Statement-level snapshot; internal retries | Fewest client-visible conflicts; lowest overhead |
| Snapshot Isolation (default) | Txn-level snapshot; write-write conflicts abort | Good default; retries only on write conflicts |
| Serializable | Full serializability; more conflicts detected | Most retries/aborts under contention; highest cost |

Under contention, **Serializable** aborts and forces client retries more often, which can sharply raise latency and lower throughput. The tuning guidance: **use the weakest isolation that's still correct** for the workload — most apps are fine on Snapshot Isolation (the default) or Read Committed; reserve Serializable for logic that genuinely needs it. And always implement **retry loops**, because under any level a contended transaction may need to re-run.

### Q12. What are the components of write and read latency?

**Write latency** (to the tablet leader):

- Network hop **client → tablet leader**.
- **Raft quorum round-trip** — leader must get a majority of followers to persist (fsync WAL) before ack. In multi-region, this includes a **cross-region hop** (the dominant cost when stretched).
- Local storage write (DocDB/RocksDB memtable + WAL).
- Extra for **distributed transactions**: 2-phase coordination across tablets + the status tablet.

**Read latency:**

- Network hop **client → tablet leader** (default, linearizable), or to a **local follower** with follower reads.
- Local read from DocDB (memtable + SST files; LSM read amplification, mitigated by compaction/bloom filters).
- Extra for **secondary-index** reads: an index lookup *plus* a base-table lookup unless it's a covering/index-only scan.

The two biggest levers fall out of this: **cut the cross-region hop** (geo-partition, follower reads, preferred leaders) and **cut extra round-trips** (covering indexes, single-shard txns, batching).

### Q13. My reads and writes are suddenly slow. How do you diagnose and scale?

Work the three governors in order — **balance, round-trips, connections** — with data:

1. **Balance / hotspots.** Check per-tablet and per-node metrics. One node/tablet hot while others idle → a **hotspot** (monotonic key, hot partition). Fix the sharding (hash/salt/UUID), pre-split, or rebalance — *before* adding nodes.
2. **Round-trips & queries.** `EXPLAIN (ANALYZE, DIST)` slow queries: look for missing indexes (seq scans), non-covering indexes (extra base lookups), unnecessary **distributed transactions**, and **cross-region** hops. Add covering indexes, batch, keep txns single-shard.
3. **Connections.** Check backend count / TServer memory-CPU. A **connection storm** or oversized pools → add the **YSQL Connection Manager** / bound the pool.
4. **Capacity.** If *all* nodes are evenly busy at high CPU/IO (no skew), you're genuinely at capacity → **scale out** (add TServers; the balancer rebalances) and check disk/compaction pressure.

The discipline interviewers reward: **measure which regime you're in** (skew vs round-trips vs connections vs capacity) rather than reflexively adding nodes — adding nodes only helps the *balanced-capacity* case.

### Q14. What are the most common performance bottlenecks in YugabyteDB?

The usual suspects, roughly by frequency:

- **Hotspots** — monotonic keys / hot partitions concentrating load on one tablet. (#1)
- **Too few tablets** — a small or un-pre-split table stuck on one/few tablets, unable to use the cluster.
- **Cross-region writes** — synchronous quorums spanning regions inflating write latency.
- **Connection storms / oversized pools** — too many heavyweight YSQL backends exhausting memory/CPU.
- **Unindexed or non-covering queries** — sequential scans or extra base-table lookups.
- **Large distributed transactions** — many tablets in one txn, high contention, retries.
- **Compaction / disk pressure** — LSM read amplification when compaction falls behind or disks are undersized.

Notice the top three are **placement/sharding and topology** problems, not raw hardware — which is exactly why "add more nodes" is the wrong first move and why interviewers press on hotspots.

### Q15. Walk through fixing a serial-PK hotspot and adding pooling for a write-heavy service.

**Symptom:** a `SERIAL`-keyed `events` table on an 8-node cluster; inserts are latency-bound and don't scale; one TServer is CPU-pegged, seven idle; the app opens thousands of direct connections and TServer memory is high.

**Fix the hotspot:**

- Change the PK from the range-sharded serial to a distributed key — switch to a **random UUID** or **hash-sharded** surrogate, and **pre-split** the new table:

```sql
CREATE TABLE events_v2 (id uuid DEFAULT gen_random_uuid(), ts timestamptz,
  payload jsonb, PRIMARY KEY ((id) HASH)) SPLIT INTO 24 TABLETS;
```

- Backfill from the old table with **`COPY`/batched inserts**, then swap. Inserts now spread across all 24 tablets / 8 nodes → near-linear write scaling.

**Add pooling:**

- Put connections behind the **YSQL Connection Manager** (or a PgBouncer-style pool), **bounded** to roughly a few× the total cores, so thousands of client connections multiplex onto a sane number of backends — eliminating the memory/CPU pressure and connection-storm risk.

**Verify:** per-tablet metrics now even, all 8 nodes sharing CPU, p99 down, and throughput rising when you add a 9th node. That last check — throughput scaling with nodes — confirms the skew is actually gone.

### Q16. Which YugabyteDB tools and metrics do you use for performance work?

- **`EXPLAIN (ANALYZE, DIST, VERBOSE)`** — the primary query-tuning tool; shows the distributed plan, rows, and where time goes (seq scans, index lookups, RPCs to tablets).
- **`yb-admin`** — cluster/tablet/leader inspection: `list_tablets`, `list_all_tablet_servers`, `get_load_move_completion`, leader/replica placement, and load-balancer state.
- **YB-Master / TServer web UIs** (ports 7000 / 9000) — per-tablet ops and bytes, leader distribution, tablet-server health, ongoing balancer activity.
- **Prometheus metrics + Grafana dashboards** — the real production surface: **latency percentiles** (p50/p99), tablet balance, **RPC queue** length, compaction stats, cache hit rates, connection/backend counts, per-node CPU/IO.

The key metrics to watch: **latency percentiles** (not just averages), **tablet/leader balance** (skew detection), **compaction and RPC-queue** pressure, and **connection counts**. Sizing follows from these — enough CPU/memory for the connection and compaction load, enough disk IO for the LSM write/compaction path, and enough tablets to spread work.
## Operations & Deployment

### Summary

**What this topic covers**

How you actually get YugabyteDB running, keep it healthy, and hand it to an on-call rotation — the day-2 surface that separates "I read the docs" from "I've operated this." The 15 questions here span the bootstrapping story (`yugabyted` for quick starts vs `yb-master`/`yb-tserver` for production universes), the CLIs you live in (`ysqlsh`, `ycqlsh`, `yb-admin`), deployment targets (VMs/bare-metal, Kubernetes via the operator/Helm, YugabyteDB Anywhere as a self-managed control plane, and YugabyteDB Managed / Aeon as the DBaaS), backup & recovery (distributed snapshots, point-in-time recovery, object-storage backups), zero-downtime rolling upgrades, monitoring/observability (Prometheus, the master/tserver web UIs, Grafana), security (TLS, auth/RBAC, encryption at rest, audit logging), connection pooling (the YSQL Connection Manager), capacity planning, elastic node add/remove, and migration tooling (YugabyteDB Voyager). If the earlier topics taught you *what* the database does, this one is *how you run it without getting paged at 3am*.

**Mental model**

Think of a YugabyteDB cluster (a "universe") as two cooperating process fleets plus the tooling wrapped around them. **YB-Masters** are the control plane — a Raft group of 3 that holds cluster metadata, assigns tablets to nodes, runs the load balancer, and coordinates DDL. **YB-TServers** are the data plane — they host tablet-peers (each its own Raft group) and run the YSQL/YCQL query layer. `yugabyted` is a friendly wrapper that starts a master and a tserver on one node for you and can join others into a cluster; it is the on-ramp, not what you tune in production. Operationally the mindset is: the system *wants* to self-heal — lose a node and Raft re-elects leaders and the master re-replicates under-replicated tablets automatically. Your job is to give it correct placement (fault-domain awareness across zones/regions via `placement_*` flags), enough headroom (CPU, disk, tablet count), TLS + auth, backups you've actually restored, and observability so you see tablet imbalance or Raft trouble before users do. More moving parts than a single Postgres, but the payoff is that most failures are non-events.

**Key terms**

- **yugabyted** — single-binary daemon that bootstraps a node (master + tserver) and can form a cluster; the quick-start / dev on-ramp.
- **yb-master** — control-plane process; Raft group of 3 holding metadata, tablet placement, load balancing, DDL.
- **yb-tserver** — data-plane process; hosts tablet-peers and the YSQL/YCQL query layer, serves reads/writes.
- **yb-admin** — cluster admin CLI: placement config, tablet/leader inspection, snapshots, master ops.
- **ysqlsh / ycqlsh** — the psql-compatible and cqlsh-compatible shells for YSQL and YCQL.
- **gflags** — the tunable process flags (e.g. `--placement_zone`, `--ysql_enable_auth`); set at start or via `yb-ts-cli`/config.
- **Distributed snapshot** — a consistent, coordinated point-in-time copy across all tablets of a table/keyspace.
- **PITR (point-in-time recovery)** — restore the database to any timestamp within a retention window.
- **Rolling upgrade** — upgrade/restart one node at a time so the universe stays available (zero-downtime).
- **YugabyteDB Anywhere** — self-managed control plane / orchestration UI to deploy & manage universes across clouds.
- **YugabyteDB Managed / Aeon** — the fully-managed cloud DBaaS (Yugabyte runs the ops).
- **YSQL Connection Manager** — built-in server-side connection pooler that multiplexes many client connections.

**Why interviewers ask this**

Operations questions sort candidates fast because you can't fake having run something. A junior answer stops at `yugabyted start` and "it's like Postgres." A senior answer knows the production topology is a Master-Raft-of-3 plus TServers spread across fault domains, knows that placement flags are what make an AZ failure a non-event, and can talk through a *real* runbook: take a distributed snapshot, back it up to S3, do a rolling upgrade, watch the tablet-balance and Raft-health metrics, restore-test regularly. Interviewers also probe security (TLS both directions, auth/RBAC, encryption at rest) because it's the thing teams skip and regret, and migration (Voyager) because most real adoptions are "move an existing Postgres/Oracle app," not greenfield. The signal they want: do you understand that distributed SQL trades more day-2 surface for self-healing resilience, and can you operate that trade competently?

**Common confusions**

- "`yugabyted` is the production way to run it" — it's the quick-start on-ramp; production universes are managed via `yb-master`/`yb-tserver` (directly, or through Anywhere/Managed/K8s operator).
- "It's Postgres, so `pg_dump` is my backup" — `pg_dump` works logically but the scalable, consistent path is distributed snapshots + PITR coordinated across tablets.
- "Upgrades need a maintenance window" — rolling upgrades are node-at-a-time and zero-downtime by design because of RF=3 + Raft failover.
- "Adding a node means re-sharding by hand" — no; the master's load balancer moves tablet-peers to the new node automatically.
- "TLS is one setting" — there are *two* channels: node-to-node and client-to-node encryption, configured separately.
- "The web UI is the monitoring" — the master/tserver UIs are great for a look, but real observability is the Prometheus endpoints scraped into Grafana with alerts.

**What follows from this topic**

Operations is where the earlier abstractions cash out. Rolling upgrades and node failure recovery are the practical face of the **RF/Raft/HA** material; placement flags and geo-aware deployment are the operational side of the **multi-region** topics (geo-partitioning, follower reads, xCluster); connection pooling ties back to YSQL's Postgres-process-per-connection model; monitoring metrics (latency, tablet balance, Raft health, compaction) are how you *diagnose* the performance problems in the **Scenario & Data-Modeling Playbooks** topic. And migration (Voyager) is the bridge from the **vs Postgres/Alternatives** decision to an actual production system.

### Q1. How do you get a YugabyteDB cluster running — dev vs production?

For a laptop or a demo, one command:

```bash
# Single-node local cluster
yugabyted start

# Form a 3-node cluster (run on each node, pointing at the first)
yugabyted start --advertise_address=node1
yugabyted start --advertise_address=node2 --join=node1
yugabyted start --advertise_address=node3 --join=node1
```

`yugabyted` starts a `yb-master` and a `yb-tserver` per node and wires them together — the easy on-ramp, great for dev and small setups.

For production you run the two processes explicitly (or via Kubernetes / Anywhere / Managed), because you want control over placement, flags, and separate master/tserver lifecycles:

```bash
# 3 masters know about each other; tservers register with the masters
yb-master   --master_addresses=m1:7100,m2:7100,m3:7100 --fs_data_dirs=/data \
            --placement_cloud=aws --placement_region=us-west --placement_zone=us-west-2a
yb-tserver  --tserver_master_addrs=m1:7100,m2:7100,m3:7100 --fs_data_dirs=/data \
            --placement_cloud=aws --placement_region=us-west --placement_zone=us-west-2a
```

The `placement_*` flags are what let YugabyteDB spread RF=3 replicas across zones so a single AZ failure never loses a tablet's quorum.

### Q2. What are yb-master and yb-tserver, and why two roles?

**yb-master** is the control plane: it stores cluster metadata (tables, tablets, placement), assigns tablet-peers to nodes, runs the load balancer, and coordinates DDL. It is itself a Raft group of 3 for its own HA — losing one master doesn't stop the cluster.

**yb-tserver** is the data plane: it hosts the tablet-peers (each a Raft group) that actually store data, and runs the YSQL/YCQL query layer that serves reads and writes.

Splitting them matters because the roles scale differently. You typically have exactly 3 (or 5) masters no matter how big the cluster gets, while you add tservers to scale data and throughput. The master is *not* in the hot path of most reads/writes — a client talks to a tserver, which routes to the right tablet leader — so master load stays modest even at scale.

### Q3. What are the main CLIs and what is each for?

| CLI | Compatible with | Use it for |
|---|---|---|
| `ysqlsh` | `psql` | Interactive SQL against YSQL — DDL, queries, `\d`, scripts |
| `ycqlsh` | `cqlsh` | Interactive YCQL (Cassandra API) — keyspaces, CQL |
| `yb-admin` | — | Cluster admin: placement config, tablet/leader inspection, snapshots, master ops |
| `yb-ts-cli` | — | Per-tserver operations and flag changes |

Examples:

```bash
ysqlsh -h node1 -U yugabyte -d mydb
yb-admin -master_addresses m1:7100,m2:7100,m3:7100 list_all_tablet_servers
yb-admin -master_addresses m1:7100,m2:7100,m3:7100 \
         modify_placement_info aws.us-west.us-west-2a,aws.us-east.us-east-1a 3
```

`ysqlsh`/`ycqlsh` are for application-level work; `yb-admin` is the operator's Swiss-army knife for the cluster itself.

### Q4. How do you deploy YugabyteDB on Kubernetes?

Use the **YugabyteDB Kubernetes Operator** or the Helm chart. Masters and tservers each run as **StatefulSets** (stable network identity + persistent volumes are exactly what a database needs), with headless Services for peer discovery and PVCs for storage.

```bash
helm repo add yugabytedb https://charts.yugabyte.com
helm install yb-demo yugabytedb/yugabyte \
  --namespace yb --create-namespace \
  --set replicas.master=3,replicas.tserver=3
```

Key fit with the K8s model: StatefulSets give each pod a sticky identity (`yb-tserver-0`, `-1`, …) and its own volume, so a rescheduled pod reattaches its data. Spread pods across zones with topology/anti-affinity so RF=3 survives an AZ loss, and expose the YSQL port via a Service. The operator also handles day-2 actions (scaling, upgrades) declaratively. For serious fleets, **YugabyteDB Anywhere** can manage K8s-based universes too.

### Q5. What is YugabyteDB Anywhere vs YugabyteDB Managed (Aeon)?

**YugabyteDB Anywhere** is a self-managed control plane — an orchestration UI/API you run yourself to deploy and manage universes across clouds, on-prem, and Kubernetes. It automates provisioning, backups, rolling upgrades, monitoring hooks, and multi-region topologies. You still own the infrastructure; Anywhere gives you a fleet-management pane over it.

**YugabyteDB Managed / Aeon** is the fully-managed cloud DBaaS — Yugabyte runs everything (provisioning, patching, backups, scaling) and you consume a database endpoint. Least ops, but you're on their cloud footprint and pricing.

The spectrum: raw `yb-master`/`yb-tserver` (max control, max ops) → K8s operator → Anywhere (self-managed automation) → Managed/Aeon (no ops). Pick based on how much of the operational burden you want to keep versus the control and multi-cloud flexibility you need.

### Q6. How do backups and recovery work?

The scalable, consistent path is **distributed snapshots** — a coordinated point-in-time copy across all tablets of a table or keyspace, then exported to object storage (S3/GCS/Azure Blob).

```bash
# Consistent snapshot of a keyspace, then back it up to S3
yb-admin -master_addresses m1:7100 create_database_snapshot ysql.mydb
yb-admin -master_addresses m1:7100 list_snapshots
# (export snapshot metadata + data to object storage; restore reverses it)
```

**Point-in-time recovery (PITR)** lets you restore to any timestamp within a retention window — the safety net for "someone ran a bad `DELETE`":

```bash
yb-admin create_snapshot_schedule 1440 10080 ysql.mydb   # interval, retention (mins)
yb-admin restore_snapshot_schedule <schedule-id> "2026-07-01 12:00:00"
```

The distributed nature matters: the snapshot is coordinated across tablets so you get a globally consistent image, not a smear of per-node states. `pg_dump` still works for small logical exports, but snapshots + PITR are the production tool. And a backup you haven't test-restored is a hope, not a backup — schedule restore drills.

### Q7. How do rolling upgrades work with zero downtime?

Because every tablet is RF=3 with Raft, you can take one node out at a time without losing any tablet's quorum. The upgrade is node-at-a-time: drain/leader-step-down on a node, upgrade the binary, restart, let it rejoin and catch up, then move to the next.

```bash
# Per node: gracefully move leaders off, upgrade, restart, verify, proceed
yb-admin -master_addresses m1:7100 leader_stepdown_all <node>   # move leaders away
# ... upgrade binary on that node, restart yb-tserver, wait for it to be healthy ...
```

While one node is down, the other two replicas of each tablet keep serving (a follower gets elected leader in ~seconds if needed). You upgrade tservers, then masters (or per the version's documented order), watching under-replicated-tablet and Raft-health metrics between steps. YugabyteDB Anywhere and the K8s operator automate this whole dance. The upshot: version upgrades are a routine, no-maintenance-window operation — a direct payoff of the RF/Raft design.

### Q8. How do you monitor and observe a YugabyteDB cluster?

Every master and tserver exposes **Prometheus metrics** endpoints; scrape them into Prometheus and visualize in **Grafana** (Yugabyte ships dashboards). Each process also has a **web UI** (master UI shows tablet placement, leader distribution, load-balancer state; tserver UI shows local tablets and RPCs) for quick eyeballing.

Key metrics to alert on:

- **Latency** — p99 read/write per table/tablet; the first thing users feel.
- **Tablet balance** — leaders and peers spread evenly; a skew means a hotspot.
- **Raft health** — under-replicated tablets, leaderless tablets, election churn.
- **Compaction / write stalls** — RocksDB compaction backlog, memstore pressure.
- **Resource** — CPU, disk, WAL/SST disk usage, connection counts.

The workflow: dashboards for trend, alerts on the four horsemen above (latency, imbalance, Raft trouble, disk), and the web UIs plus `yb-admin` for drill-down when an alert fires. This ties directly into the observability primer — treat the DB as another RED/USE service.

### Q9. How do you secure a YugabyteDB deployment?

Layered, and interviewers want you to name the layers:

- **TLS — two channels**: node-to-node encryption (between masters/tservers) and client-to-node encryption (app ↔ cluster). Configured separately via cert flags.
- **Authentication & RBAC**: enable auth (`--ysql_enable_auth=true` / `--use_cassandra_authentication=true`), then roles/users with `GRANT`/`REVOKE`; supports password, and via the Postgres layer, LDAP/OIDC/host-based `hba` rules for YSQL.
- **Encryption at rest**: transparent encryption of on-disk data with a key managed by the cluster / a KMS.
- **Network**: firewalls/security groups restricting the master (7100), tserver (9100), YSQL (5433), YCQL (9042) ports to known CIDRs.
- **Audit logging**: log DDL/DML/auth events for compliance.

```sql
-- YSQL RBAC
CREATE ROLE app_ro LOGIN PASSWORD 'REDACTED';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_ro;
```

The one people forget is that TLS has *two* separate channels — encrypting client traffic but leaving inter-node traffic plaintext is a common gap.

### Q10. What is the YSQL Connection Manager and why does it matter?

YSQL inherits Postgres's **process-per-connection** model, so thousands of app connections mean thousands of backend processes and heavy memory use — the classic Postgres connection-storm problem, amplified across a cluster. The **YSQL Connection Manager** is a built-in, server-side connection pooler that multiplexes many client connections onto a small pool of backends, so a spike in clients doesn't translate into a spike in processes.

```bash
yb-tserver --enable_ysql_conn_mgr=true --ysql_conn_mgr_max_client_connections=10000
```

Without it you'd bolt on PgBouncer (which works, since YSQL is Postgres-wire). The Connection Manager is the native answer. This is a frequent "why is my cluster OOMing / why are connections timing out" diagnosis — the fix is pooling, covered again in the scenario topic.

### Q11. How do you add or remove nodes, and what happens?

Elastic scaling is a first-class operation. To scale out, start a new tserver pointed at the masters; the master's load balancer automatically moves a share of tablet-peers onto it to rebalance — no manual re-sharding.

```bash
# Add: just start another tserver with the same master_addresses + placement flags
yb-tserver --tserver_master_addrs=m1:7100,m2:7100,m3:7100 --fs_data_dirs=/data \
           --placement_zone=us-west-2c

# Remove gracefully: blacklist the node so the balancer drains its tablets first
yb-admin -master_addresses m1:7100 change_blacklist ADD node4:9100
# ... wait until it holds no tablet leaders/peers, then stop the process ...
```

Removal is the mirror image: blacklist the node, let the balancer move its replicas elsewhere (keeping RF=3 intact throughout), then shut it down. The whole point of the shared-nothing design is that capacity changes are online.

### Q12. How do you approach capacity planning and sizing?

Reason from the tablet up. Each tablet-peer costs some RAM (memstore/block cache) and each node holds many peers, so drivers are: data size × RF (RF=3 triples storage), target tablet count (aim for a sane number of tablets per core — too few and you can't parallelize/rebalance, too many and per-tablet overhead dominates), write throughput (WAL + compaction I/O), and connection count (memory per backend, hence pooling).

Rules of thumb to state: size disk for `raw_data × RF × growth × compaction-headroom`; keep CPU headroom for compactions and Raft; spread nodes across at least 3 fault domains so RF=3 survives one; and pre-split large/known-hot tables so you don't rely solely on auto-split under load. Then validate with a load test and watch p99 latency, compaction backlog, and CPU — capacity planning is a hypothesis you confirm with the same metrics you'll later alert on.

### Q13. How do you migrate an existing database to YugabyteDB?

Use **YugabyteDB Voyager**, the purpose-built migration tool for PostgreSQL, Oracle, and MySQL → YugabyteDB. It runs three phases: **export schema** (and flag incompatibilities), **export/import data** (snapshot + optional change-data-capture for near-zero-downtime cutover), and **import schema**, with an assessment report telling you what needs changing.

```bash
yb-voyager export schema   --source-db-type postgresql --source-db-name app ...
yb-voyager import schema   --target-db-host node1 --target-db-name app ...
yb-voyager import data     --target-db-host node1 --target-db-name app ...
```

The work Voyager surfaces is the distributed-SQL adaptation: choosing hash-sharded primary keys (a monotonic `SERIAL` PK that was fine on single-node Postgres becomes a hotspot), swapping sequences for UUIDs where appropriate, and handling any unsupported extensions. Most of the app — drivers, ORMs, SQL — carries over untouched because YSQL reuses the Postgres query layer. This ties directly to the "migrate a Postgres app" scenario in the playbooks topic.

### Q14. How is day-2 operating YugabyteDB different from a single Postgres?

More moving parts, but more self-healing. A single Postgres has one process, one failure domain, and failover is a bolt-on (Patroni, replicas, a VIP flip you script and pray over). YugabyteDB has a master fleet, a tserver fleet, tablets, and Raft groups — more concepts — but node failure, leader election, re-replication, and rebalancing are automatic and built in.

| Concern | Single Postgres | YugabyteDB |
|---|---|---|
| Failover | Manual/bolt-on (Patroni etc.) | Automatic Raft election, seconds |
| Scale writes | Vertical only | Add tservers, online |
| Upgrades | Restart / failover window | Rolling, zero-downtime |
| Backups | `pg_dump` / PITR (single node) | Distributed snapshots + PITR |
| Moving parts | Few | More (masters, tservers, tablets) |

The honest interview answer: you trade operational *simplicity* for operational *resilience and scale*. Don't take that trade for a small single-region app that Postgres handles fine — take it when you need horizontal write scale, multi-region, or failure tolerance beyond a single primary.

### Q15. Walk me through how you'd deploy and operate YugabyteDB in production.

**Deploy**: a universe with 3 masters and N tservers spread across at least 3 fault domains (zones, ideally set up for your region topology), placement flags set so RF=3 replicas never share a zone. Run it via the Kubernetes operator, YugabyteDB Anywhere, or Managed/Aeon depending on how much ops you want to own — not raw `yugabyted`, which is the dev on-ramp.

**Secure**: TLS on both node-to-node and client-to-node channels, auth + RBAC roles, encryption at rest, locked-down security groups, audit logging on.

**Scale & connect**: enable the YSQL Connection Manager for pooling; add tservers online when CPU/latency climb and let the load balancer rebalance.

**Protect**: scheduled distributed snapshots to object storage plus a PITR window, and — non-negotiable — periodic restore drills.

**Observe**: Prometheus scraping every node into Grafana, alerting on p99 latency, tablet imbalance, Raft/under-replication, and disk; master/tserver UIs and `yb-admin` for drill-down.

**Maintain**: rolling, zero-downtime upgrades one node at a time, watching Raft health between steps. Migrate existing apps in with Voyager, adjusting PKs to hash-sharding as you go. The theme: lean on the self-healing, and put your effort into placement, backups-you've-tested, security, and observability.

## YugabyteDB vs Alternatives & Ecosystem

### Summary

**What this topic covers**

The "when would you pick X over Y" conversation that shows up in almost every distributed-database interview. The 15 questions here position YugabyteDB against its whole competitive set: **CockroachDB** (its closest peer), **Google Spanner** (the Spanner-inspired original), **Amazon Aurora** (the shared-storage managed relational option people confuse it with), vanilla **PostgreSQL** (the "do you even need distributed SQL?" baseline), the sharding middleware world (**Citus**, **Vitess**), and the NoSQL stores (**Cassandra**, **MongoDB**). It also covers the ecosystem story — Postgres compatibility as a moat, the Apache-2.0 open-source/licensing angle, the multi-cloud/no-lock-in pitch — and, crucially, **when NOT to use YugabyteDB**. The goal is that you can run the decision matrix out loud and defend a choice.

**Mental model**

Arrange the options on two axes: **how much you scale writes horizontally** and **how much ops you own**. Single-node **Postgres** scales up only and you run it. **Aurora** distributes *storage* and scales reads, but it's still a **single writer** — it does not scale write throughput horizontally and isn't active-active multi-region; it's managed, so low ops. **Spanner** scales writes globally with external consistency via TrueTime atomic clocks, zero ops — but it's proprietary and GCP-locked. **YugabyteDB** and **CockroachDB** are the open, self-hostable, shared-nothing, Raft-based distributed SQL databases that scale writes horizontally and run anywhere/multi-cloud — Spanner's model without the lock-in. Within that pair, YugabyteDB reuses the *actual* Postgres query layer and adds a Cassandra API (YCQL) under Apache-2.0; CockroachDB is a from-scratch Postgres-wire reimplementation under a source-available BSL license. **Citus/Vitess** are "shard your existing Postgres/MySQL" middleware — a different, coordinator/proxy model. **Cassandra/Mongo** trade SQL and strong consistency for eventual-consistency scale. The senior move is to start every comparison from "do you actually need horizontal write scale / multi-region-active / beyond-single-primary resilience?" — because if not, Postgres or Aurora is simpler.

**Key terms**

- **Shared-nothing** — each node owns its data partitions; scale by adding nodes (YugabyteDB, CockroachDB, Spanner). Contrast shared-storage.
- **Shared-storage, single-writer** — one primary handles all writes over a distributed storage layer (Aurora); scales reads/storage, not write throughput.
- **CockroachDB** — closest peer; from-scratch Postgres-wire distributed SQL, Raft/HLC, **BSL** (source-available, not fully open).
- **Google Spanner** — proprietary, fully-managed distributed SQL using **TrueTime** atomic clocks for external consistency; GCP-only.
- **TrueTime vs HLC** — Spanner's atomic-clock/commit-wait consistency vs YugabyteDB's Hybrid Logical Clocks over NTP with bounded skew.
- **Amazon Aurora** — managed MySQL/Postgres, distributed storage, single writer; not shared-nothing, not active-active geo.
- **Citus** — Postgres *extension* that shards Postgres via a coordinator; great for multi-tenant/analytics.
- **Vitess** — MySQL sharding middleware (runs YouTube-scale MySQL).
- **BSL (Business Source License)** — source-available but restricted; converts to open later. Not the same as Apache-2.0.
- **Apache 2.0** — YugabyteDB's permissive open-source license; self-host freely, no vendor lock-in.
- **Postgres wire/query-layer compatibility** — YSQL reuses the real Postgres layer, so drivers/ORMs/tools "just work."
- **xCluster / multi-cloud** — async cross-cluster replication and the ability to run the same DB across clouds.

**Why interviewers ask this**

Because "pick a database" is the most common real decision an engineer influences, and the wrong reasons are everywhere. A junior answer name-drops "it's like Spanner but open source" and stops. A senior answer starts with the *requirement* (write scale? regions? residency? RPO/RTO? team maturity?) and *then* maps it to an option, knowing the sharp distinctions: Aurora is single-writer (the most common confusion), Spanner is TrueTime/proprietary, CockroachDB is the near-twin with a licensing/compatibility difference, and vanilla Postgres is often the right answer. Interviewers also listen for intellectual honesty — can you say "both YugabyteDB and CockroachDB are excellent, here's how I'd break the tie" rather than fanboying — and for knowing when *not* to reach for distributed SQL. It's a maturity signal as much as a knowledge one.

**Common confusions**

- "Aurora scales writes horizontally like YugabyteDB" — no. Aurora is single-writer; it scales storage and read replicas, not write throughput. This is the single biggest misconception.
- "CockroachDB is open source like YugabyteDB" — CockroachDB is BSL (source-available, restricted); YugabyteDB is Apache-2.0. Different licensing story.
- "YugabyteDB is a Postgres fork" — YSQL *reuses* the Postgres query layer but runs on a distributed storage engine (DocDB); it's not just forked single-node Postgres.
- "Spanner and YugabyteDB have the same consistency mechanism" — Spanner uses TrueTime atomic clocks + commit-wait; YugabyteDB uses HLC over NTP within a bounded max_clock_skew.
- "Citus/Vitess are the same category as YugabyteDB" — they're sharding middleware over existing Postgres/MySQL (coordinator/proxy), not shared-nothing distributed SQL databases.
- "Distributed SQL is always better than Postgres" — it's better *when you need it*; for single-node-scale, single-region, latency-critical OLTP, plain Postgres is simpler and faster.

**What follows from this topic**

The comparisons here are the "why YugabyteDB" that every architecture decision rests on. The Aurora/Postgres contrast feeds directly into the **Scenario & Data-Modeling Playbooks** "should we use YugabyteDB or just Postgres/Aurora here?" check. The Spanner TrueTime-vs-HLC distinction connects back to the consistency and clock-skew material (read-restart errors, `max_clock_skew`). The multi-cloud/xCluster angle links to the multi-region topics, and the Postgres-compatibility moat is why migration (Voyager, in Operations) is comparatively painless. Know this topic and you can *justify* the design choices the rest of the primer teaches you to make.

### Q1. What is YugabyteDB and how would you position it in one sentence?

YugabyteDB is an **open-source (Apache 2.0) distributed SQL** database — it gives you ACID transactions, full SQL, horizontal scale-out, strong consistency, and no single point of failure, inspired by Google Spanner but self-hostable anywhere.

The one-liner that lands in interviews: *"Spanner's architecture — sharded, Raft-replicated, strongly consistent distributed SQL — but open source and multi-cloud, and it reuses the actual PostgreSQL query layer so your Postgres app mostly just works."* It exposes two APIs over one storage engine (DocDB): **YSQL** (Postgres-compatible) and **YCQL** (Cassandra-compatible). Position it as the answer to "I've outgrown single-node Postgres and need horizontal write scale, multi-region, or failure tolerance beyond one primary — without giving up SQL, transactions, or my cloud choice."

### Q2. YugabyteDB vs CockroachDB — how do you choose?

They're the **closest peers**: both open-ish, Postgres-flavoured, shared-nothing distributed SQL, Raft + hybrid-clock, Spanner-inspired. Both are genuinely excellent — say that. The differences:

| | YugabyteDB | CockroachDB |
|---|---|---|
| Postgres layer | Reuses the **actual** Postgres query layer (high fidelity) | From-scratch Postgres-wire reimplementation |
| Extra API | **YCQL** (Cassandra API) | SQL only |
| License | **Apache 2.0** (fully open) | **BSL** (source-available, restricted) |
| Storage | DocDB (per-tablet RocksDB) | Pebble (RocksDB-derived) |

**How I'd break the tie**: choose YugabyteDB if PostgreSQL-feature fidelity matters (extensions, edge-case syntax), if you want a Cassandra-style API alongside SQL, or if a permissive open-source license is a hard requirement (no BSL). Choose CockroachDB if you prefer its tooling/ops ergonomics or its geo-partitioning UX and the BSL is fine for you. Both handle the core distributed-SQL job well; the decision is usually license + Postgres-compatibility + team familiarity, not raw capability.

### Q3. YugabyteDB vs Google Spanner?

Spanner is the **proprietary original** — Google's fully-managed, globally-distributed SQL that pioneered the model. The core technical difference is consistency mechanism: Spanner uses **TrueTime**, an atomic-clock + GPS infrastructure that bounds clock uncertainty tightly and uses **commit-wait** to guarantee external consistency. YugabyteDB uses **Hybrid Logical Clocks (HLC)** over ordinary **NTP** within a configured `max_clock_skew` — no special hardware, at the cost of relying on well-synced clocks.

| | Google Spanner | YugabyteDB |
|---|---|---|
| Consistency clock | TrueTime (atomic clocks) | HLC over NTP |
| Hosting | GCP-only, fully managed | Self-host anywhere, or Managed/Aeon |
| License | Proprietary | Apache 2.0 |
| Ops | None (Google runs it) | You run it (or use Aeon) |
| Lock-in | GCP | None; multi-cloud |

Pick Spanner if you're all-in on GCP, want zero ops, and will pay for it. Pick YugabyteDB if you need open source, self-hosting, multi-cloud, or want to avoid lock-in — you get Spanner's *model* without the atomic clocks or the GCP tether.

### Q4. YugabyteDB vs Amazon Aurora — what's the crucial distinction?

The one interviewers are fishing for: **Aurora is shared-storage, single-writer; YugabyteDB is shared-nothing, multi-writer.**

Aurora (MySQL/Postgres-compatible) distributes its *storage* across AZs and scales read replicas, but **one primary handles all writes**. So Aurora scales storage and read throughput — not write throughput horizontally — and it isn't active-active across regions (a region failover promotes a replica, with a gap). YugabyteDB shards data across nodes with a leader per tablet, so **many nodes take writes in parallel** and you scale write throughput by adding nodes, with active multi-region topologies available.

| | Amazon Aurora | YugabyteDB |
|---|---|---|
| Architecture | Shared-storage, single writer | Shared-nothing, multi-writer |
| Scale writes | No (vertical primary only) | Yes (add nodes) |
| Multi-region active | No (failover only) | Yes (stretched/geo/xCluster) |
| Ops | Fully managed (AWS) | Self-host or Managed/Aeon |

Choose Aurora when you want a managed relational DB, don't need write scale-out or active-active geo, and are on AWS — it's simpler. Choose YugabyteDB when you need horizontal write scale, multi-region-active, or no cloud lock-in.

### Q5. YugabyteDB vs vanilla PostgreSQL — do you actually need distributed SQL?

This is the reality check, and answering it well is a maturity signal. Vanilla Postgres is single-node: it scales **up** (bigger box), is simpler to run, and has **lower latency in a single region** because there's no cross-node Raft on the write path. Most applications are perfectly happy on Postgres (or Aurora) for a long time.

You reach for distributed SQL only when you hit one of:
- **Horizontal write scale** — one primary can't take the write throughput anymore.
- **>1 region, active** — you need writes served in multiple regions, or data residency per region.
- **Resilience beyond a single primary** — zero-downtime through node/AZ/region failure without manual failover.

If you don't need those, YugabyteDB is *more* operational cost and *higher* single-region write latency for no benefit. The honest senior answer: "Start on Postgres. Move to YugabyteDB when you have a concrete scale, geo, or resilience requirement Postgres can't meet — and because YSQL reuses the Postgres layer, that migration is comparatively cheap when the time comes."

### Q6. YugabyteDB vs Citus and Vitess?

Both are **sharding middleware over existing databases**, a different model from a native distributed SQL database.

**Citus** is a Postgres *extension*: a coordinator node routes queries to worker Postgres nodes that hold shards. Great for multi-tenant SaaS (shard by tenant) and real-time analytics. But the coordinator is a distinct role, cross-shard transactions and rebalancing are more manual, and it's Postgres-with-sharding rather than a self-healing shared-nothing cluster.

**Vitess** is MySQL sharding middleware (it runs YouTube/PlanetScale-scale MySQL) — a proxy layer (vtgate) over many MySQL shards, with its own topology service.

Versus YugabyteDB: YugabyteDB is a single logical database with **built-in** sharding, Raft replication, automatic rebalancing, and distributed transactions — no coordinator SPOF, no manual shard management, automatic failover. Choose Citus/Vitess if you're deeply invested in Postgres/MySQL and want to bolt on sharding incrementally; choose YugabyteDB for a purpose-built distributed SQL database with self-healing and strong consistency out of the box.

### Q7. YugabyteDB vs Cassandra and MongoDB?

Cassandra and MongoDB are NoSQL: they scale horizontally and were built for it, but historically trade away strong consistency, multi-row/multi-shard ACID transactions, and rich SQL (Cassandra is eventually consistent with a limited query model; Mongo added transactions later but the model differs).

YugabyteDB gives you **strong consistency + SQL + distributed ACID transactions + global secondary indexes** *and* horizontal scale — the things those NoSQL stores make you give up. And via **YCQL** you even get a Cassandra-Query-Language-compatible API on top of the same strongly-consistent, Raft-replicated storage — so you can get "Cassandra-shaped" access patterns without Cassandra's eventual-consistency and lightweight-transaction caveats.

Pick Cassandra/Mongo when your workload is genuinely schemaless/append-heavy and eventual consistency is acceptable, and you want their specific ecosystems. Pick YugabyteDB when you want NoSQL-like scale but refuse to give up transactions, strong consistency, and SQL/joins.

### Q8. Why is PostgreSQL ecosystem compatibility such a big selling point?

Because it makes adoption cheap and de-risked. YSQL reuses the actual PostgreSQL query layer, so it speaks the Postgres wire protocol and supports Postgres SQL, which means: existing **drivers** (JDBC, psycopg, pgx, node-postgres), **ORMs** (Hibernate, Django ORM, SQLAlchemy, Prisma, ActiveRecord), **tools** (psql, pgAdmin, dbeaver, Flyway, Liquibase), and much application SQL work **unchanged**.

The strategic effect: the switching cost from Postgres is dominated by the few genuinely distributed concerns — choosing hash-sharded PKs, sequences → UUIDs, occasional unsupported extensions — not by rewriting your data-access layer. Contrast a NoSQL migration, which rewrites your whole persistence model. This compatibility is also the practical reason Voyager migrations are feasible and why teams treat YugabyteDB as "the Postgres I can scale," lowering both technical and organizational risk.

### Q9. Why does the Apache-2.0 open-source story matter?

Licensing is a real architectural constraint, not a footnote. YugabyteDB core is **Apache 2.0** — permissive, fully open source: you can self-host freely, fork it, run it in any cloud or on-prem, and you have no vendor able to change the terms out from under you. That matters for regulated industries, air-gapped deployments, avoiding lock-in, and long-term cost control.

Contrast **CockroachDB's BSL** (Business Source License): source-available but with usage restrictions (e.g. you can't offer it as a competing managed service), converting to open source only after a delay. And Spanner/Aurora are fully proprietary + tied to a cloud. So the open-source axis is a genuine differentiator: if "no lock-in, self-host anywhere, permissive license" is a hard requirement, YugabyteDB clears the bar where BSL and proprietary options don't. Yugabyte still monetizes via Anywhere and Managed/Aeon — the open core plus commercial control plane model.

### Q10. When should you NOT use YugabyteDB?

Just as important as when you should. Avoid it when:

- **Single-node / small apps** — if Postgres on one box handles your load, YugabyteDB is more ops and higher write latency for no gain.
- **Latency-critical single-region OLTP** — cross-node Raft adds write latency vs a local Postgres; if microseconds matter and you're single-region, plain Postgres wins.
- **Teams without distributed-systems ops maturity** — more moving parts (masters, tservers, tablets, placement); a team that can't operate that should stay on managed Postgres/Aurora or use Aeon.
- **Heavy analytical / OLAP workloads** — YugabyteDB is an OLTP-oriented distributed SQL DB; big scans/aggregations belong in a warehouse (Snowflake, BigQuery, ClickHouse).

The pattern: YugabyteDB earns its complexity when you need horizontal write scale, multi-region-active, or resilience beyond a single primary. Without one of those drivers, simpler is better — and saying so is exactly the judgment interviewers want to hear.

### Q11. What's the multi-cloud / no-lock-in angle?

Because YugabyteDB is open source and self-hostable, you can run a single logical database that spans clouds and on-prem — nodes in AWS, GCP, Azure, or your own datacenter, in one universe or coupled via **xCluster** async replication. That buys you: avoiding hostage pricing from any one cloud, meeting data-residency rules by placing nodes in specific jurisdictions, and disaster recovery that isn't confined to one provider's regions.

Spanner (GCP-only) and Aurora (AWS-only) structurally can't do this — they're cloud-native and cloud-locked. CockroachDB can (it's also self-hostable), but under BSL. So the pitch is: *the same distributed SQL guarantees, but you decide where it runs, and you can move.* For enterprises with multi-cloud mandates or acquisition-driven heterogeneous estates, this is often the deciding factor over the technically-similar Spanner.

### Q12. Give me the full decision matrix — YugabyteDB vs CockroachDB vs Spanner vs Aurora vs Postgres.

| Option | Pick when | Watch out for |
|---|---|---|
| **PostgreSQL** | Single-region, fits one node, want simplest ops & lowest latency | No horizontal write scale; single primary |
| **Aurora** | Managed relational on AWS, need read/storage scale but **not** write scale-out | Single writer; not active-active geo; AWS lock-in |
| **Spanner** | All-in on GCP, want zero ops + global scale, will pay | Proprietary; GCP lock-in; cost |
| **CockroachDB** | Open-ish distributed SQL, like its ops/geo UX, BSL acceptable | BSL (not fully open); from-scratch PG compat |
| **YugabyteDB** | Distributed SQL + high PG fidelity + YCQL + Apache-2.0 + multi-cloud | More day-2 surface than single Postgres |

Decision flow to say out loud: *Does it fit one Postgres node in one region? → Postgres.* *Need managed + read/storage scale, no write scale-out, on AWS? → Aurora.* *Need horizontal write scale / multi-region-active / no-single-primary resilience? → distributed SQL.* Within distributed SQL: *GCP + zero ops + budget → Spanner; open/self-host/multi-cloud → YugabyteDB or CockroachDB, tie-broken on license (Apache vs BSL), Postgres fidelity, and YCQL need.*

### Q13. Where is YugabyteDB heading — recent versions and direction?

Speak to themes rather than pinning exact version numbers (they move). Recent YugabyteDB (2.x line) direction: deepening **PostgreSQL compatibility** (closing feature/extension gaps so more Postgres apps run unmodified), the built-in **YSQL Connection Manager** to solve the connection-scaling problem natively, richer **multi-region** capabilities (geo-partitioning ergonomics, read replicas, xCluster including active-active and transactional consistency improvements), performance work on the query layer and DocDB, and stronger **operability** via YugabyteDB Anywhere and Managed/Aeon.

The strategic through-line: make "the Postgres you can scale globally" true with as few caveats as possible, and reduce the day-2 gap versus single-node Postgres. When asked, frame it as "PG-compatibility, multi-region, and operability are the three vectors they keep pushing on" — that shows you track the product's actual priorities, not just a feature list.

### Q14. Both YugabyteDB and CockroachDB are great — how do you actually pick between them without hand-waving?

Reduce it to a few concrete tie-breakers and stop pretending one is universally better:

1. **License** — if a permissive, fully open-source license (Apache 2.0) is a hard requirement, YugabyteDB; if BSL is acceptable, both are in play.
2. **Postgres fidelity** — if you depend on specific Postgres extensions or edge-case behavior, YugabyteDB's reuse of the real Postgres layer is the safer bet; test *your* schema on both.
3. **Second API** — if you want a Cassandra-style API alongside SQL, only YugabyteDB has YCQL.
4. **Ops/UX preference** — CockroachDB's tooling and geo-partitioning ergonomics appeal to some teams; run a POC.
5. **Team familiarity / support** — existing expertise and commercial support relationships often decide it.

The credible close: "I'd run a proof-of-concept with our actual schema and workload on both, measure p99 and check for compatibility gaps, and let the license and POC results decide — not a benchmark blog." That answer signals engineering maturity far more than declaring a winner.

### Q15. A team says "we'll just use MongoDB, it scales" — how do you push back or agree?

Agree *or* push back based on requirements, not dogma. Ask: **do you need multi-document ACID transactions, strong consistency, joins, and SQL?** If the workload is document-shaped, append-heavy, schema-fluid, and eventual consistency is fine, Mongo is a reasonable choice and I wouldn't fight it.

But if there are **money, inventory, or correctness-critical invariants** that need distributed transactions and strong consistency across entities — the classic "two documents must change together, always consistent" — that's exactly where NoSQL bites you and where YugabyteDB shines: it *also* scales horizontally, but keeps SQL, joins, and distributed ACID. And via YCQL you can even offer a Cassandra-like API if the team wants NoSQL ergonomics on strongly-consistent storage.

The framing: "Mongo scaling isn't the question — *consistency and transactionality* are. If you need those with scale, a distributed SQL database gives you scale without giving up correctness; if you truly don't, Mongo's fine." That reframes a religious argument into a requirements decision.

## Scenario & Data-Modeling Playbooks

### Summary

**What this topic covers**

The capstone: "design this," "spot the anti-pattern," and "diagnose this" — the questions that separate people who *know about* YugabyteDB from people who can *build and fix* systems on it. The 17 questions here mix (a) **design scenarios** with concrete DDL and reasoning — multi-tenant SaaS, global apps with EU/US data residency, high-scale time-series, zero-downtime region failover, and Postgres→YugabyteDB migration — and (b) **anti-pattern / diagnosis scenarios** with fixes — hot nodes from monotonic keys, cross-region write latency, slow distributed transactions and 40001 retries, slow joins, high remote-region read latency, read-restart errors, and connection storms. Each answer gives the concrete DDL/config/command *and* the "why." Treat this as the definitive YugabyteDB design-and-troubleshooting reference.

**Mental model**

Run every scenario through the same funnel, in order:

1. **Do you even need distributed SQL here?** If a single Postgres fits, say so — don't over-engineer.
2. **Design the primary key / sharding to distribute load and avoid hotspots.** Hash on a high-cardinality key (tenant, entity, user) so writes fan out; never hash-*less* range-shard on a monotonic column (serial/timestamp) or one tablet becomes a hot leader.
3. **Keep transactions single-shard and small.** Co-locate data that changes together so txns stay on one tablet; expect cost and retries when they span tablets/regions.
4. **Pick the multi-region topology for the requirement** — sync stretched cluster (strong, cross-region write latency), geo-partitioning (residency + local latency), follower reads/read replicas (local reads), or xCluster (loose async coupling).
5. **Index for the access pattern**, and prefer covering/index-only scans to avoid cross-tablet lookups.
6. **Expect and design around distributed-txn and cross-region latency** — it's physics, not a bug.

Almost every "diagnose this" answer is one of these principles violated.

**Key terms**

- **Hash-sharded PK** — `PRIMARY KEY ((col) HASH)`; distributes rows evenly, no hotspot, no range scan on that key.
- **Range-sharded PK** — `ASC/DESC`; ordered range scans, but a monotonic key hotspots one tablet.
- **Hotspot** — one tablet/leader taking disproportionate load, usually a monotonic key on a range shard.
- **Colocation** — placing small related tables/rows together (colocated tables) so joins/txns stay single-tablet.
- **Geo-partitioning** — pinning rows to a region via a partition column + tablespaces for residency + local latency.
- **Tablespace** — a placement policy object mapping data to specific cloud/region/zone.
- **Follower read** — bounded-staleness read served by a local follower instead of the (possibly remote) leader.
- **Preferred region / leader** — configuring tablet leaders to live in a chosen region to localize write latency.
- **xCluster** — async replication between two clusters for DR / active-active loose coupling.
- **40001 (serialization failure)** — the retryable transaction-conflict error apps must catch and retry.
- **Read restart** — a read forced to retry due to clock-skew ambiguity; mitigated by tight NTP / `max_clock_skew`.
- **Pre-split / auto-split** — creating tablets up front (or letting them split) so load spreads before/under growth.

**Why interviewers ask this**

Design and diagnosis are where knowledge becomes engineering. Anyone can recite "hash vs range sharding"; the test is whether, handed "our writes bottleneck on one node," you immediately suspect a monotonic PK on a range shard and reach for hash-sharding or bucketing. Senior signal is: starting from requirements (does this need distributed SQL?), designing PKs that distribute load, keeping transactions single-shard, choosing the *right* multi-region topology for the consistency/latency/residency tradeoff, and reading a latency symptom back to its architectural cause (cross-region quorum, hot tablet, cross-tablet join, clock skew). These questions also reveal whether you understand the *costs* — that distributed transactions and cross-region writes have irreducible latency you design around, not away. It's the closest thing to watching you work.

**Common confusions**

- "Just use `SERIAL`/`BIGSERIAL` like in Postgres" — a monotonic PK on a range shard hotspots one tablet; use hash-sharding, UUIDs, or bucketing at scale.
- "A distributed transaction is as cheap as a local one" — multi-tablet txns pay coordination cost and can hit serialization retries; keep them single-shard and short.
- "Follower reads are just stale, avoid them" — they're *bounded* staleness and the right tool for local low-latency reads when you can tolerate a small lag.
- "Geo-partitioning and a stretched sync cluster are the same" — geo-partitioning pins rows locally (residency + local latency, per-region leaders); a stretched sync cluster replicates every write across regions (strong, but cross-region write latency).
- "Read-restart errors are a bug in the database" — they're a clock-skew symptom; tighten NTP / `max_clock_skew`.
- "Add more app connections to go faster" — past a point that causes connection storms and OOM; pool instead (YSQL Connection Manager / PgBouncer).

**What follows from this topic**

This is where every earlier topic pays off. The PK-design and hotspot material is **sharding** applied under pressure; the multi-region playbooks are **geo-partitioning/follower-reads/xCluster** turned into decisions; the 40001 and read-restart diagnoses are **transactions and HLC/clock-skew** in production; the connection-storm fix is the **YSQL Connection Manager** from Operations; and the "should we even use YugabyteDB?" check loops back to **vs Postgres/Aurora**. If you can work these scenarios, you can defend a real YugabyteDB design end-to-end — which is exactly what the interview is testing.

### Q1. Design a schema for a high-scale multi-tenant SaaS.

Shard by tenant so each tenant's data distributes across the cluster while a single tenant's rows stay together for efficient per-tenant queries. Hash the tenant portion of the key:

```sql
CREATE TABLE orders (
  tenant_id  uuid,
  order_id   uuid,
  created_at timestamptz DEFAULT now(),
  total_cents bigint,
  PRIMARY KEY ((tenant_id) HASH, order_id)
);
```

`((tenant_id) HASH, order_id)` hashes on `tenant_id` (even distribution across tablets, no single hot tenant-shard by position) and keeps `order_id` as a clustering column so a tenant's orders are co-located and range-scannable. Queries always filter by `tenant_id`, so they hit a bounded set of tablets, and cross-tenant scans (the thing you don't want in multi-tenant) are naturally discouraged.

For the many **small** per-tenant lookup/config tables, use **colocation** so they share a tablet instead of each paying full distributed overhead:

```sql
CREATE DATABASE saas WITH COLOCATION = true;
-- small reference tables land colocated; big tables opt out with WITH (colocation = false)
```

The tradeoff to state: hashing `tenant_id` means you can't range-scan *across* tenants on the PK, which is exactly right for tenant isolation. A giant "noisy neighbor" tenant can still be split further (e.g. add a bucket) if one tenant's data outgrows comfortable tablet sizes.

### Q2. Design for a global app with EU/US data residency.

Requirement: EU users' rows must stay in the EU, US users' in the US, each with local read/write latency. Use **row-level geo-partitioning** — partition by a region column, and map each partition to a **tablespace** pinned to that region:

```sql
CREATE TABLESPACE eu_ts WITH (replica_placement=
  '{"num_replicas":3,"placement_blocks":[{"cloud":"aws","region":"eu-west","zone":"a","min_num_replicas":3}]}');
CREATE TABLESPACE us_ts WITH (replica_placement=
  '{"num_replicas":3,"placement_blocks":[{"cloud":"aws","region":"us-east","zone":"a","min_num_replicas":3}]}');

CREATE TABLE users (
  id uuid, region text, email text, ...,
  PRIMARY KEY ((id) HASH, region)
) PARTITION BY LIST (region);

CREATE TABLE users_eu PARTITION OF users FOR VALUES IN ('eu') TABLESPACE eu_ts;
CREATE TABLE users_us PARTITION OF users FOR VALUES IN ('us') TABLESPACE us_ts;
```

EU rows physically live (all 3 replicas) in the EU, satisfying residency (GDPR) and giving EU users local latency; ditto US. For read-mostly global-reference data that everyone needs locally, add **follower reads** or read replicas so remote regions read a local copy at bounded staleness. The key insight: geo-partitioning localizes *both* the data and its leaders per region, so writes don't cross the ocean — unlike a stretched sync cluster.

### Q3. Design a time-series / event table at scale.

The trap is a monotonic-only PK (a `SERIAL` or a bare timestamp) on a range shard: all new rows land on the newest tablet's leader → a moving hotspot. Split the write load by hashing on the entity, and range on time *within* each entity so you still get efficient time-range scans:

```sql
CREATE TABLE events (
  device_id  uuid,
  ts         timestamptz,
  payload    jsonb,
  PRIMARY KEY ((device_id) HASH, ts DESC)
);
```

`((device_id) HASH, ts DESC)` fans writes across all devices (no single hot tablet) while `ts DESC` keeps each device's events ordered for `WHERE device_id = ? AND ts BETWEEN ...` scans and "latest N" queries. If you truly must range on time globally (e.g. cross-device time scans), **bucket** it: `PRIMARY KEY ((bucket) HASH, ts)` with `bucket = hash(id) % N` to spread the monotonic load across N tablets.

Also **pre-split** large tables so you don't rely solely on auto-split catching up under a write storm:

```sql
CREATE TABLE events (...) SPLIT INTO 24 TABLETS;   -- hash-sharded presplit
```

The anti-pattern to name explicitly: *monotonic-key hotspot*. Never make time or a serial the leading, un-hashed shard key on a high-ingest table.

### Q4. Design for zero-downtime region failover.

Two topologies, pick per requirement:

**Option A — 3-region synchronous stretched cluster, RF=3, one replica per region.** Every write commits via Raft to a majority (2 of 3 regions), so losing any one region keeps quorum and the cluster keeps serving with **zero RPO and automatic failover** — no data loss, no manual promotion. Cost: every write pays cross-region round-trip latency. Localize it by setting **preferred-region leaders** so leaders (and thus the write path) concentrate in your primary region until it fails:

```bash
yb-admin -master_addresses m1:7100 set_preferred_zones aws.us-east.us-east-1a
```

**Option B — xCluster async replication** between two clusters (primary + standby). Writes are local and fast; the standby lags slightly (non-zero RPO) and failover is a promotion. Looser coupling, lower write latency, small potential data loss.

```
Zero data loss + auto failover, pay write latency   → Option A (sync stretch, 3 regions)
Local write latency, tolerate small RPO on failover  → Option B (xCluster)
```

State the tradeoff crisply: **sync stretched = zero RPO, higher write latency; xCluster = low latency, non-zero RPO.** Choose by whether the business can tolerate any data loss on a region failure.

### Q5. How would you migrate a PostgreSQL app to YugabyteDB?

Use **YugabyteDB Voyager** for the mechanics (assess → export schema → import schema → export/import data, with CDC for near-zero-downtime cutover). But the engineering work is the *distributed* adaptation:

- **Primary keys**: a single-node `SERIAL`/`BIGSERIAL` PK becomes a hotspot. Switch to hash-sharded PKs, and prefer **UUIDs** over sequences for high-insert tables (`gen_random_uuid()`), since a global sequence is itself a contended monotonic counter.
- **Sharding intent**: pick the leading hash key per table for the real access pattern (tenant, entity), as in the earlier designs.
- **Compatibility gaps**: most SQL, drivers, and ORMs work unchanged (YSQL reuses the Postgres layer), but check for unsupported extensions and any single-node-only assumptions.

```sql
-- Before (Postgres): id BIGSERIAL PRIMARY KEY
-- After (YugabyteDB):
CREATE TABLE accounts (
  id uuid DEFAULT gen_random_uuid(),
  ...,
  PRIMARY KEY ((id) HASH)
);
```

What **stays the same**: your queries, joins, transactions, ORM mappings, and most tooling — that's the whole point of Postgres compatibility. What **changes**: PK/sharding design, sequences → UUIDs where they'd bottleneck, and validating extensions. Cut over with Voyager's CDC to keep downtime minimal.

### Q6. Diagnose: one node is hot and writes are bottlenecked. What's wrong and how do you fix it?

Almost always a **monotonic-key hotspot**: the table's leading PK column is a `SERIAL`/`BIGSERIAL` or a `timestamp` on a **range** shard, so every new row targets the same (newest) tablet, whose single leader takes all the write traffic while the rest of the cluster idles.

Confirm it in the tserver/master UI or via `yb-admin` — one tablet leader with disproportionate write ops and one hot node.

Fixes, in order of preference:

```sql
-- 1. Hash-shard on a high-cardinality key so writes fan out
PRIMARY KEY ((entity_id) HASH, ts DESC)

-- 2. Or use a UUID PK (naturally distributed)
id uuid DEFAULT gen_random_uuid(), PRIMARY KEY ((id) HASH)

-- 3. Or bucket a monotonic key to spread it across N tablets
PRIMARY KEY ((bucket) HASH, ts)   -- bucket = hash(id) % 16
```

The anti-pattern's name: *monotonic/sequential PK on a range shard*. The fix in one sentence — make the leading shard key hashed and high-cardinality so inserts distribute across tablets and leaders instead of piling onto the newest one.

### Q7. Diagnose: cross-region write latency is 100ms+. Why, and what are the options?

That's physics: your write path is committing a Raft quorum that **spans regions**, so each write pays a cross-region round trip (or two) to reach a majority of replicas. If you have RF=3 with one replica per region, every commit waits on a remote region — 100ms+ is expected.

Options, by what you're willing to trade:

- **Preferred-region leaders** — pin tablet leaders to your primary region so the leader→follower round trip is at least *initiated* locally; helps when clients are also there.
- **Geo-partitioning** — pin each row's replicas to its own region so writes stay in-region and never cross the ocean (best when data is naturally regional; also gives residency).
- **Accept it** — if you *require* zero-RPO strong consistency across regions (a synchronous stretched cluster), cross-region commit latency is the price; you don't get zero data loss *and* local latency simultaneously.
- **xCluster** — if you can tolerate small RPO, replicate async so writes commit locally and fast.

The framing to give: *cross-region sync quorum = strong consistency but high write latency; you localize it (preferred leaders / geo-partition), loosen it (xCluster), or accept it.* You can't beat the speed of light with a synchronous global quorum.

### Q8. Diagnose: a distributed transaction is slow with lots of retries.

Two things are happening. **Slow**: the transaction touches multiple tablets (and maybe regions), so it runs the distributed 2-phase protocol with a transaction-status tablet and write intents — inherently more expensive than a single-shard txn. **Retries**: you're getting **40001 serialization failures** from conflicts under Serializable/Snapshot isolation.

Fixes:

- **Make it single-shard** — co-locate the data the txn touches (same tenant/entity under one hash key, or colocated tables) so it commits on one tablet without cross-tablet coordination.
- **Shorten the transaction** — hold fewer rows for less time; don't do slow app work mid-transaction.
- **Reduce contention** — avoid many txns updating the same hot row; batch or redesign the access pattern.
- **Handle 40001 with retry-with-backoff** in the app — it's a *normal*, expected outcome under Serializable, not a bug:

```sql
-- Application pseudo-flow
-- BEGIN; ... ; COMMIT;   on SQLSTATE 40001 → wait a jittered backoff, retry the whole txn
```

Name the anti-pattern: *a fat, multi-tablet, high-contention transaction.* The senior fix is design (colocate + shorten + single-shard) plus correct client-side retry of 40001, not cranking timeouts.

### Q9. Diagnose: a join is slow. What's happening and how do you fix it?

A join across tables whose rows live on **different tablets/nodes** forces a cross-tablet (and possibly cross-node/region) **data shuffle** — network-bound, unlike a local Postgres hash join. The classic cause: the two tables are sharded on unrelated keys, so matching rows aren't co-located.

Fixes, in order:

- **Colocation** — put small/related tables together (colocated tables, or a shared hash key like `tenant_id`) so the join is local to a tablet.
- **Denormalize** — for hot read paths, store the joined data together and avoid the join entirely.
- **Index for the join / add a covering index** — so the planner does index-only scans instead of fetching+shuffling base rows:

```sql
CREATE INDEX ON order_items ((tenant_id) HASH, order_id) INCLUDE (sku, qty);
```

- **Shard aligned keys together** — if two big tables are always joined on `tenant_id`, hash both on `tenant_id` so matching partitions co-reside.

The anti-pattern: *joining tables that aren't co-located, causing a cross-tablet shuffle.* Fix by aligning sharding keys, colocating small tables, denormalizing hot paths, or covering the query with an index-only scan.

### Q10. Diagnose: read latency is high in a remote region.

The reads are going to the tablet **leader**, which lives in another region, so each read pays a cross-region round trip. Options to serve reads locally:

- **Follower reads** — read from a local follower replica at **bounded staleness**; huge latency win when a slightly stale read is acceptable:

```sql
SET yb_read_from_followers = true;
SET default_transaction_read_only = true;   -- follower reads require read-only txn
-- staleness bounded by yb_follower_read_staleness_ms
```

- **Read replicas** — add non-voting replicas in the remote region purpose-built to serve local reads (they don't participate in the write quorum, so they don't slow writes).
- **Geo-partition** — if the remote region *owns* that data, pin it there so its leader is local and reads are strongly-consistent *and* fast.

Choose by consistency need: strongly-consistent-must-be-fresh in that region → geo-partition (move the leader there); *tolerate small staleness* → follower reads / read replicas. The anti-pattern: *every region reading from a single distant leader.* Serve reads from something local.

### Q11. Diagnose: we're getting read-restart errors.

Read restarts come from **clock skew**. YugabyteDB uses Hybrid Logical Clocks over NTP; when a read encounters data whose commit timestamp falls within the ambiguity window created by clock uncertainty (`max_clock_skew`), it can't be sure of ordering, so it **restarts** the read to get a correct, consistent result. Frequent restarts mean your clocks are drifting too far apart.

Fixes:

- **Tighten NTP** — run a reliable time service (chrony) with low-latency sources so real skew stays well under the configured bound; this is the root-cause fix.
- **Keep `max_clock_skew` honest** — it must be ≥ your actual worst-case skew (setting it too low causes correctness issues; too high widens the ambiguity window and hurts). Fix the clocks rather than papering over with a huge value.
- **Reduce the trigger** — very hot, just-written rows read immediately elsewhere are more prone; follower-read/staleness settings and access-pattern tweaks can help.

Name it: *read-restart = clock-skew ambiguity.* The real fix is better time sync (NTP/chrony), not disabling consistency. This ties back to the Spanner contrast — Spanner throws atomic clocks at exactly this problem; you throw good NTP.

### Q12. Diagnose: connection storms / the cluster is running out of memory.

YSQL inherits Postgres's **process-per-connection** model, so thousands of direct app connections spawn thousands of backend processes, each consuming memory — leading to OOM and connection timeouts, especially with a serverless/autoscaling app tier that opens connections aggressively.

Fix: **pool connections** so a small number of backends serve many clients.

```bash
# Native: enable the built-in YSQL Connection Manager on tservers
yb-tserver --enable_ysql_conn_mgr=true --ysql_conn_mgr_max_client_connections=10000
```

Or front the cluster with **PgBouncer** (works because YSQL is Postgres-wire) in transaction-pooling mode, and cap the driver/ORM pool size on the app side. Also right-size backends and watch the connection-count and memory metrics.

The anti-pattern: *unbounded direct connections* (each app instance opening a large pool straight to the DB). The fix is pooling — the YSQL Connection Manager is the native answer; PgBouncer is the classic external one. This is the operational counterpart to the sizing discussion: connections are a first-class capacity dimension.

### Q13. A team wants to put a small internal tool on YugabyteDB "to be future-proof." What do you advise?

Push back gently and apply the funnel: **does this actually need distributed SQL?** A small internal tool — single region, fits comfortably on one node, no active-active or write-scale requirement — gets *more* operational surface (masters, tservers, tablets, placement) and *higher* single-region write latency from YugabyteDB, for zero benefit today.

Advice: **start on Postgres (or managed Postgres/Aurora)** — simpler, lower latency, less to operate. Because YSQL reuses the Postgres query layer, migrating *later* (with Voyager) is comparatively cheap if the tool ever genuinely needs scale, multi-region, or beyond-single-primary resilience. "Future-proofing" by adopting distributed-systems complexity before you have a distributed-systems requirement is paying a real cost now for a hypothetical benefit.

The senior message: *choose YugabyteDB when a concrete scale/geo/resilience requirement demands it, not speculatively.* Knowing when **not** to reach for it is the judgment being tested.

### Q14. Design the ordering/inventory core for an e-commerce platform on YugabyteDB.

Requirements: high write throughput, correctness on inventory (no overselling), reasonable latency. Design PKs to distribute load while keeping transactional data co-located.

```sql
-- Orders: hash on a high-cardinality id → writes fan out
CREATE TABLE orders (
  order_id uuid DEFAULT gen_random_uuid(),
  customer_id uuid, status text, created_at timestamptz DEFAULT now(),
  PRIMARY KEY ((order_id) HASH)
);

-- Inventory: hash on sku; the decrement is a single-row, single-shard txn
CREATE TABLE inventory (
  sku text, qty_available bigint,
  PRIMARY KEY ((sku) HASH)
);
```

The correctness path — reserve stock — is a **single-shard transaction** on one `inventory` row (Serializable, retry 40001), which stays cheap and consistent:

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
  UPDATE inventory SET qty_available = qty_available - 1
    WHERE sku = 'sku-123' AND qty_available > 0;   -- 0 rows → out of stock
  INSERT INTO order_items (...);
COMMIT;   -- on 40001, retry with backoff
```

Keep the reservation transaction **single-shard and short** so it doesn't turn into a slow multi-tablet txn. Avoid a hot inventory row for a single blockbuster SKU by considering bucketed inventory (N sub-rows summing to the total) if one SKU's contention dominates. This exercises the whole funnel: distribute (hash PKs), keep txns single-shard, and handle serialization retries in the app.

### Q15. Spot the anti-pattern: `CREATE TABLE logs (id BIGSERIAL PRIMARY KEY, ts timestamptz, msg text);` — what's wrong for a high-ingest log table?

Two hotspots baked into one line. `BIGSERIAL` is a **monotonic counter**, and as the leading PK it means every insert targets the newest tablet → a single hot leader takes all writes (a *monotonic-key hotspot*). The sequence itself is also a **contended global counter**. On a high-ingest log table this pins throughput to one node no matter how big the cluster is.

Fix — distribute the writes:

```sql
CREATE TABLE logs (
  id uuid DEFAULT gen_random_uuid(),
  ts timestamptz DEFAULT now(),
  msg text,
  PRIMARY KEY ((id) HASH)
) SPLIT INTO 24 TABLETS;
```

If you need time-ordered scans per source, hash the source and range on time: `PRIMARY KEY ((source_id) HASH, ts DESC)`. If you need *global* time-range scans, bucket: `PRIMARY KEY ((bucket) HASH, ts)`. The lesson: on YugabyteDB, a `SERIAL`/`BIGSERIAL` leading PK — the reflexive Postgres habit — is an anti-pattern at write scale. Reach for UUIDs or a hashed high-cardinality key, and presplit.

### Q16. Choose the multi-region strategy: strong global consistency, EU/US residency, and low local read latency — but the write path can't cross the ocean on every commit. What do you pick?

These requirements point at **geo-partitioning**, not a stretched sync cluster. A stretched sync cluster gives strong global consistency but makes *every* write cross regions — violating "write path can't cross the ocean." Geo-partitioning pins each region's rows (and their leaders/replicas) to that region:

```sql
-- rows tagged region='eu' live entirely in EU tablespace; 'us' in US
CREATE TABLE accounts (id uuid, region text, ..., PRIMARY KEY ((id) HASH, region))
  PARTITION BY LIST (region);
CREATE TABLE accounts_eu PARTITION OF accounts FOR VALUES IN ('eu') TABLESPACE eu_ts;
CREATE TABLE accounts_us PARTITION OF accounts FOR VALUES IN ('us') TABLESPACE us_ts;
```

Now EU writes commit within EU (local latency + GDPR residency), US within US — each partition is strongly consistent locally, and no write crosses the ocean because a partition's quorum is regional. For the *shared/global* reference data everyone reads, use **follower reads** or **read replicas** so remote regions read locally at bounded staleness.

The decision logic to state: residency + local write latency + per-region strong consistency → **geo-partition** (data is regional). Only use a stretched sync cluster when a *single* dataset must be strongly consistent *and* survive a whole-region loss with zero RPO, and you accept cross-region write latency for it. Match the topology to whether the data is regional or truly global.

### Q17. Give me your end-to-end checklist for approaching any YugabyteDB design or troubleshooting question.

The funnel, out loud, in order — this is the reusable framework:

1. **Do you need distributed SQL at all?** If a single Postgres/Aurora fits (single region, fits one node, no active-active), say so. Don't over-engineer.
2. **Design the PK/sharding to distribute load.** Hash on a high-cardinality key (tenant/entity/uuid); never leave a monotonic `SERIAL`/timestamp as the leading range-shard key (hotspot). Presplit big/hot tables.
3. **Keep transactions single-shard and short.** Colocate data that changes together; expect cost + 40001 retries when txns span tablets, and handle them in the app.
4. **Choose the multi-region topology for the requirement**: sync stretched (zero RPO, cross-region write latency), geo-partition (residency + local latency, regional data), follower reads/read replicas (local low-latency reads), xCluster (loose async, small RPO).
5. **Index for the access pattern**, prefer covering/index-only scans, colocate to avoid cross-tablet join shuffles.
6. **Expect distributed/cross-region latency as physics** — localize, loosen, or accept it; you can't have zero-RPO global sync *and* local write latency at once.

For **diagnosis**, map the symptom to a violated principle: hot node → monotonic-key hotspot (2); slow/retrying txn → fat multi-tablet txn (3); 100ms writes → cross-region quorum (4); slow join → non-colocated shuffle (5); slow remote reads → distant leader (fix with follower reads); read-restarts → clock skew (NTP); connection storms → pool. Nearly every YugabyteDB problem is one of these six principles applied or violated — that framework is what turns a hard question into a methodical answer.
