import type { Diagram } from "./types";

export const DISTRIBUTED_CACHE: Diagram = {
  id: "distributed-cache",
  title: "Distributed Cache",
  question: "Design a Distributed Cache (Memcached / Redis at scale)",
  sourceId: "patterns",
  itemId: 34,
  overview: {
    shape:
      "A cache is a hint store bolted onto the read path. The hit is trivial; every component here exists to defend the miss path or the invalidation path, the two places a cache turns from an optimisation into a bug.",
    forces: [
      {
        constraint: "5M gets/s against a 100k QPS origin means 5M x (1 - h) < 100k forces h > 98%",
        decision: "Hit rate is treated as a hard capacity constraint, not a target, and every design decision defends it",
        lights: ["origin", "tier-group"],
      },
      {
        constraint: "one popular key expiring can turn 10 QPS into 10,000 in the same millisecond",
        decision: "A single-flight loader takes a per-key lock so 10k concurrent misses collapse into one origin query",
        lights: ["loader", "e6", "e7"],
      },
      {
        constraint: "a hot key at 1M reads/s is 16 Gbps on one NIC, while the other 59 shards run at 1.3 Gbps each",
        decision: "Hot keys are either capped locally via an L1 allowlist or replicated across 8 shards, trading invalidatability for bandwidth",
        lights: ["hotkey", "l1", "ring", "e12", "e13"],
      },
      {
        constraint: "an empty pool hands the origin 50x its capacity, so a cold cache is not the same failure as a stampede",
        decision: "Cold-start recovery uses a rate limiter on fill, not the stampede defences, because the cause is different",
        lights: ["origin", "loader"],
      },
      {
        constraint: "hashing modulo the node count remaps ~98% of keys on every resize",
        decision: "The ring places ~150 virtual positions per shard with consistent hashing, so a resize moves only 1/60 of the keyspace",
        lights: ["ring", "e3", "e4"],
      },
    ],
    naive: {
      text: "Cache every read behind a plain hash(key) % N router, and let a miss just query the origin directly with no coordination. At 5M gets/s and a 2% miss rate that is already 100k queries/s, fine until one key goes viral. 10,000 concurrent misses on the same expired key all query the origin at once instead of once. Resizing the cluster is worse: hash modulo the node count remaps about 98% of keys. Adding one shard empties the cache and hands the origin 5M reads/s it was never sized for. The design instead routes every miss through a single-flight loader and places shards on a consistent-hashing ring. A stampede then collapses to one query, and a resize moves only 1/60 of the keyspace.",
      lights: ["loader", "ring"],
    },
    beats: [
      {
        text: "The hit path is one hop and deliberately boring. The application asks its in-process L1 for the handful of allowlisted hot keys, then the tier. The ring maps the key to one of 60 shards, and RAM answers in about 0.3ms. That is 98% of 5M gets/s, and the origin never learns those reads happened.",
        lights: ["app", "l1", "proxy", "ring", "shard", "e1", "e2", "e3", "e4", "e5"],
      },
      {
        text: "Every miss is a small write, which is why the miss path carries the machinery. One loader per key takes a short-lived lock so 10k concurrent misses become one origin query. The value goes back with a 300s TTL jittered by 10%, and a rising refresh probability near expiry means a hot key's TTL never actually arrives.",
        lights: ["loader", "origin", "shard", "e6", "e7", "e8"],
      },
      {
        text: "The sizing is arithmetic and it justifies everything after it. A 10TB working set over 180GB shards is 60 primaries, and 5M over 60 is 83k ops/s each against a 150k to 200k ceiling. 5M x (1 - h) < 100k of origin capacity forces h > 98%. Hit rate is a capacity constraint, not a target.",
        lights: ["tier-group", "shard", "origin"],
      },
      {
        text: "Sharding does not fix a hot key, because one key lives on one shard. A million reads per second of a 2KB value is 16 Gbps arriving at a single machine's network card, while 59 shards run at 1.3 Gbps. The two fixes trade different things: the L1 cuts tier reads to P/T but makes the key uninvalidatable, key-level replication over 8 shards divides the bandwidth and keeps delete working.",
        lights: ["hotkey", "l1", "ring", "e11", "e12", "e13"],
      },
      {
        text: "Invalidation is where a cache stops being a performance optimisation and starts being able to show a customer a wrong number. Writes commit to the origin and then delete the key, never overwrite it, because deletes commute and absent is always safe. A change-log consumer does the same job once instead of once per call site, and a backstop TTL bounds whatever both of them miss.",
        lights: ["writer", "origin", "shard", "invalidator", "e14", "e15", "e16", "e17"],
      },
      {
        text: "Say plainly that a cache is not a database: it may lose every value at any moment and the system must still be correct. Then say the uncomfortable half. An origin sized for 100k QPS against 5M reads/s cannot survive a cold pool. Availability really does depend on the cache being warm, and rate-limited fill is a degradation, not a fix.",
        lights: ["origin", "loader"],
      },
    ],
    crux: {
      problem:
        "Two things have to be true at once. The cache may lose any value at any moment with no correctness consequence, and it may not serve a wrong value for an unbounded time.",
      handled:
        "Hold only the first and the cache is free in your head, and you ship a price that changed twenty minutes ago. Hold only the second and you reach for persistence and quorum reads, and rebuild a slow database that happens to live in RAM. The design holds both: writes commit then delete, and a backstop TTL bounds whatever invalidation misses.",
    },
    numbers: [
      {
        value: "5M gets/s, so h > 98% is arithmetic",
        explain: "5M x (1 - h) has to stay under the origin's 100k QPS ceiling, which algebraically forces the hit rate above 98% before anything else is designed.",
      },
      {
        value: "60 shards x 180GB for a 10TB working set",
        explain: "A 10TB working set over a 180GB usable cap per shard is 56 shards, rounded up to 60 for headroom.",
      },
      {
        value: "one hot key = 16 Gbps on one NIC",
        explain: "1M reads/s of a 2KB value all landing on the single shard that owns the key, versus 1.3 Gbps average per shard across the rest of the fleet.",
      },
    ],
  },
  nodes: [
    {
      id: "tier-group",
      kind: "zone",
      label: "Cache tier: 60 shards, ~30TB RAM",
      detail: {
        what: "The cache cluster itself: 60 primary shards with one replica each, holding a 10TB working set entirely in RAM with persistence switched off.",
        why: "Everything in this box is derived state. Disaster recovery is refilling from the origin rather than restoring anything, which is what makes the tier cheap to run and what makes invalidation the only hard problem it has.",
        numbers: [
          { value: "120 processes x 256GB = ~30TB provisioned", explain: "60 shards x 2 (primary+replica) x 256GB; three times the 10TB working set, headroom that buys replica failover, not slack." },
          { value: "10TB working set, corpus is 10x larger", explain: "The gap between what is provisioned and the full underlying dataset, since only the actively read subset needs to live in RAM." },
        ],
        breaks: {
          failure: "The tier is allowed to be empty and is not allowed to be wrong.",
          handled: "The second property is not enforced by anything inside this box, which is why invalidation is treated as a separate, load-bearing system rather than a cache-internal concern.",
        },
      },
    },
    {
      id: "app",
      label: "App server",
      sub: "cache aside, 5 gets per request",
      kind: "service",
      col: 0,
      row: 0,
      detail: {
        what: "The tier that owns the caching logic: read the cache, load the origin on a miss, write the value back, and delete the key after a write.",
        why: "The cache has no idea which origin row a key came from or when it changed, so read, fill and invalidate decisions all live here. At a 100:1 read to write ratio, putting the cache in the write path would change nothing for 99% of operations.",
        numbers: [
          { value: "10k app servers x 100 req/s x 5 gets = 5M gets/s", explain: "The full derivation of the system's peak read load, from fleet size down to per-request cache calls." },
          { value: "50k writes/s, a 100:1 ratio", explain: "The write volume this same fleet drives, small enough that a synchronous cache write path would barely matter." },
          { value: "cache timeout above 5ms is counted as a miss", explain: "The threshold this tier applies so a slow cache degrades to origin traffic rather than blocking the request." },
        ],
        breaks: {
          failure: "A request that blocks waiting on a slow cache turns a cache incident into an application outage.",
          handled: "Above 5ms, the request is treated as a miss, counted, and sent to the origin instead of waiting further.",
        },
        choice: {
          pick: "Cache aside on reads; on writes commit to the origin then delete the key",
          instead: "Write-through, where the cache writes the origin and acks only when both commit; or write-behind, where the cache acks immediately and drains a queue.",
          decider:
            "The 100:1 ratio. At 5M reads/s against 50k writes/s, write-through adds a hop and a failure mode to 1% of operations and caches values nobody has asked for. Write-behind at a 200ms flush interval loses up to 10,000 acknowledged writes on a crash.",
          flips: "Below roughly 10:1, especially where the same key is written repeatedly. Write-behind genuinely wins for counters, view tallies and telemetry.",
        },
      },
    },
    {
      id: "l1",
      label: "In-process L1",
      sub: "hot-key allowlist, 100ms to 1s TTL",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "A per-process copy of an explicitly allowlisted set of hot keys, held for 100ms to 1s and checked before the tier.",
        why: "Reads reaching the cache tier for one key fall to P/T, where P is the process count and T the L1 TTL. At P = 10k and T = 1s that is 10k/s instead of 1M/s, which takes a hot key from 16 Gbps on one NIC to 160 Mbps.",
        numbers: [
          { value: "P/T = 10k/1s = 10k reads/s at the tier", explain: "The reduced tier-side load once the L1 has absorbed most of a hot key's traffic." },
          { value: "a 100x cut on the hot key", explain: "The overall reduction this layer achieves against the raw fan-out." },
          { value: "staleness floor becomes T, up to 1s", explain: "What this layer costs in return: no read of an allowlisted key can be fresher than its L1 TTL." },
        ],
        breaks: {
          failure: "No delete can reach 10,000 process heaps.",
          handled: "Putting an L1 in front of a key silently converts that key's invalidation into a TTL, which is why only keys that can tolerate a staleness floor are ever allowlisted.",
        },
        choice: {
          pick: "An explicit allowlist of hot keys with a sub-second TTL, never a blanket L1",
          instead: "Key-level replication: store the value across 8 shards under suffixed names and pick a suffix at random per read.",
          decider:
            "The staleness budget against the fanout arithmetic. P/T only buys anything while T exceeds the budget: at P = 100k with T = 100ms, P/T is 1M/s and the L1 has bought nothing at all.",
          flips: "Anything gating money or access, such as prices, entitlements, feature flags and rate limit state. Those get 8-way replication instead, at 8 SETs per fill and 8 deletes per invalidation.",
        },
      },
    },
    {
      id: "proxy",
      label: "Proxy tier",
      sub: "~200 proxies, 4 conns per shard",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "A fleet that multiplexes application connections onto a few hundred backend connections per shard and owns the topology on behalf of every client.",
        why: "Connection count is a real constraint before throughput is. It also gives one place to change the shard map without redeploying 10k application servers, which is what makes a resize an operation rather than a release.",
        numbers: [
          { value: "1.2M sockets direct vs ~800 per shard behind proxies", explain: "The socket-count reduction this tier buys by pooling application connections." },
          { value: "20k sockets/shard x 20KB = 400MB of buffers", explain: "The memory cost a direct-connection design would impose on every shard, avoided by the proxy tier." },
          { value: "extra hop of 100 to 500 microseconds", explain: "Up to half a sub-1ms p99 budget, but the alternative is 1.2M direct sockets fleet-wide; the hop is the cheaper problem to have." },
        ],
        breaks: {
          failure: "It is a new component that can fail.",
          handled: "It needs enough instances that losing one is not a thundering reconnect across the whole fleet, which is why the proxy pool is sized well beyond the bare minimum.",
        },
        choice: {
          pick: "A proxy tier between the applications and the shards",
          instead: "A client library with the ring compiled in, talking straight to the shards.",
          decider:
            "Sockets against latency budget. 10k app servers x 60 shards x 2 connections is 1.2M sockets, 20k per shard. Proxies cut that to 800 per shard and cost 100 to 500 microseconds against a sub-1ms p99.",
          flips: "Small fleets, where 1.2M never materialises and the hop is pure cost, or a budget tight enough that half a millisecond matters.",
        },
      },
    },
    {
      id: "ring",
      label: "Consistent hash ring",
      sub: "~150 vnodes per shard, 60 shards",
      kind: "service",
      col: 3,
      row: 0,
      detail: {
        what: "The function mapping a key to its owning shard, with roughly 150 virtual positions per physical shard. Consistent hashing means a resize moves a small fraction of keys instead of remapping the whole ring.",
        why: "The placement decision is load-bearing for the cache specifically because a remap is a miss burst. Hashing modulo the node count empties the cache on every resize and hands the full read load to an origin sized for 2% of it.",
        numbers: [
          { value: "adding a shard moves ~1/60 of the keyspace", explain: "~1.7% vs modulo's ~98%, roughly 58x smaller; the difference between a scheduled resize and an origin-melting miss burst." },
          { value: "modulo remaps ~98% of keys", explain: "What the naive hash-mod-N alternative would cost on the exact same resize." },
          { value: "1 position per shard gives 2x to 3x imbalance", explain: "Why virtual nodes are needed at all: a single position per shard leaves load badly uneven." },
        ],
        breaks: {
          failure: "Even the 1/N that legitimately moves arrives at the origin as a miss burst.",
          handled: "A resize stays a scheduled event rather than a free one, planned and rate-limited rather than triggered casually.",
        },
        choice: {
          pick: "Consistent hashing with ~150 virtual positions per shard",
          instead: "hash(key) modulo the node count, or a shard map maintained centrally and pushed to clients.",
          decider:
            "What a resize costs. Modulo remaps about 98% of 5B keys and sends 5M reads/s at a 100k QPS origin; the ring moves 1/60. Virtual nodes bring imbalance from 2x-3x down to low single-digit percent.",
          flips: "A cluster whose shard count genuinely never changes, where an explicit map is easier to reason about and to override for a deliberately placed key class.",
        },
      },
    },
    {
      id: "shard",
      label: "Cache shard",
      sub: "Redis, 180GB max, no persistence",
      kind: "database",
      col: 3,
      row: 1,
      parent: "tier-group",
      detail: {
        what: "One single-threaded in-memory shard holding about 1/60 of the working set and answering GET and SET in well under a millisecond.",
        why: "The shard count falls straight out of memory: 10TB over 180GB usable is 56, rounded to 60. The per-shard rate then falls out of that, and the ~2x headroom is what absorbs one shard inheriting a dead peer's traffic.",
        numbers: [
          { value: "83k ops/s per shard against a 150k to 200k ceiling", explain: "The typical per-shard load against the ceiling a single-threaded shard can actually sustain." },
          { value: "1.3 Gbps per shard, trivial on 25 GbE", explain: "The bandwidth one shard carries under normal, evenly-distributed traffic." },
          { value: "maxmemory 180GB = 70% of a 256GB box", explain: "The memory cap this shard runs at, leaving headroom for fragmentation and client buffers." },
        ],
        breaks: {
          failure: "Turning on persistence for warm restarts is the trap.",
          handled: "The fork's copy-on-write can double the process at exactly the moment memory is tight, and it restores values written under an invalidation regime that was not running during the restart.",
        },
        choice: {
          pick: "Redis Cluster, 60 primaries at 180GB maxmemory, persistence off",
          instead: "Memcached: flat string to string, multi-threaded, with no persistence or replication primitive at all.",
          decider:
            "Which features are needed, not which is faster. Redis buys hashes, sorted sets and native replication at a 180GB cap; Memcached buys a simpler failure model and implements leases natively where Redis needs a Lua script.",
          flips: "When plain string values genuinely are all you need. Then Memcached's multi-threading and its complete absence of durability machinery are an advantage rather than a gap.",
        },
      },
    },
    {
      id: "eviction",
      label: "TTL + eviction",
      sub: "LRU + backstop TTL, jittered 10%",
      kind: "service",
      col: 3,
      row: 2,
      parent: "tier-group",
      detail: {
        what: "Two different mechanisms that both remove data: a TTL that bounds how stale a value can be, and eviction that decides who survives a full memory cap.",
        why: "They answer separate questions and only one of them is usually binding. Residency here is 10TB over 200 MB/s of churn, about 14 hours, so against a 300s median TTL keys expire long before eviction ever reaches them.",
        numbers: [
          { value: "residency ~14 hours vs a 300s median TTL", explain: "The comparison that decides which of the two removal mechanisms actually binds under normal load." },
          { value: "100k admissions/s = 200 MB/s of churn", explain: "The write rate driving that residency estimate." },
          { value: "expiry metadata 24B x 5B keys = ~120GB", explain: "The overhead of tracking a TTL on every key, a real but manageable cost." },
        ],
        breaks: {
          failure: "At the memory cap a node either evicts or dies.",
          handled: "The default in most deployments is that keys without a TTL are not evictable, which quietly turns a memory cap into an out-of-memory kill unless every key carries one.",
        },
        choice: {
          pick: "LRU with a backstop TTL on every key, jittered by 10%",
          instead: "An admission policy in front of the cache: W-TinyLFU with a frequency sketch, or S3-FIFO with a small probationary queue and no sketch.",
          decider:
            "The share of admissions evicted having been read exactly once. Below about 20% one-hit wonders LRU is fine; above about 50%, half of a 10TB cache is holding keys nobody will read again.",
          flips: "Workloads that sweep a key range once: search result caches, feed backfills, analytics jobs and crawler traffic, where a bigger cache does not help.",
        },
      },
    },
    {
      id: "replica",
      label: "Async replica",
      sub: "one per shard, ~10s promotion",
      kind: "database",
      col: 3,
      row: 3,
      parent: "tier-group",
      detail: {
        what: "One asynchronous replica per primary, promoted on failure and optionally serving reads to multiply read capacity.",
        why: "Without a replica, losing a node deletes 1/60 of the keyspace permanently and hands the origin that shard's miss traffic. Surviving nodes do not inherit the dead node's data, because consistent hashing reassigns ownership rather than moving bytes.",
        numbers: [
          { value: "failover in roughly 10s", explain: "How long a lost primary's traffic goes unhandled before its replica takes over." },
          { value: "one dead shard = 83k QPS into a 100k origin", explain: "The worst-case load a single lost shard would push onto the origin without a replica to absorb it." },
          { value: "lag adds seconds on top of the 300s TTL", explain: "The additional staleness a promoted replica can carry, on top of the normal TTL bound." },
        ],
        breaks: {
          failure: "A replica can return a value the primary has already deleted.",
          handled: "The bound you publish for replica reads is the TTL plus the lag, not the larger of the two, since both can apply at once.",
        },
        choice: {
          pick: "One async replica per shard, with tight-budget key classes routed to the primary",
          instead: "No replica at all, letting the origin absorb a dead shard; or synchronous replication so a promoted replica never lags.",
          decider:
            "What the origin can absorb. One dead shard is 83k QPS against 100k of total capacity, survivable once and not twice, which is the argument for a replica in a different failure domain.",
          flips: "When the origin is genuinely over-provisioned against the read load, where replicas are pure cost since the correct recovery is a refill.",
        },
      },
    },
    {
      id: "hotkey",
      label: "Hot key detection",
      sub: "sampled heavy hitters, ~10s window",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "Per-shard egress plus sampled per-key request counts, feeding the L1 allowlist and the decision to replicate a key across shards.",
        why: "Both hot key mitigations assume you know which key is hot, and nothing here does by default. Exact per-key counters at 5M ops/s are not affordable, so detection is sampled or a heavy hitters sketch over a window long enough to trust.",
        numbers: [
          { value: "detection lag on the order of 10s", explain: "How long it takes this system to confidently identify a key as hot." },
          { value: "a key can reach 1M reads/s inside that window", explain: "How much damage a key can do before detection even engages." },
          { value: "16 Gbps on one NIC vs 1.3 Gbps per shard", explain: "The gap between a saturated hot-key shard and a normal shard, the scale of the problem this detector exists to catch." },
        ],
        breaks: {
          failure: "Detection lags the hot key.",
          handled: "The first seconds of every hot key are served with no mitigation at all, and the owning shard saturates before anything engages, an accepted cost of sampling over exact counting.",
        },
        choice: {
          pick: "Sampled server-side heavy hitters plus a manual promotion path for predictable keys",
          instead: "Client-side detection inside each application process, or exact per-key counters at the shard.",
          decider:
            "Cost against reaction time. Exact counters at 5M ops/s are unaffordable. Client-side detection reacts immediately but each of 10k processes sees only its slice, so a fleet-hot key can be lukewarm everywhere.",
          flips: "Predictable hot keys, such as a scheduled drop or a launch, where a manual allowlist beats every detector by engaging before the traffic arrives.",
        },
      },
    },
    {
      id: "loader",
      label: "Single-flight loader",
      sub: "per-key lock, early refresh",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "The miss path. The first request to detect a miss takes a short-lived per-key lock, queries the origin, populates the cache and releases, while everyone else waits and reads what it wrote.",
        why: "Three defences layered because each leaves a gap the others cover. One loader per key limits the damage of an expiry; probabilistic refresh before expiry and jittered TTLs stop expiries being synchronised in the first place.",
        numbers: [
          { value: "10k concurrent misses collapse to 1 origin query", explain: "The reduction this mechanism achieves on a hot key's expiry." },
          { value: "set 3600 + random 0 to 360, never exactly 3600", explain: "How jitter is actually applied, spreading a batch of writes' expiries across a window rather than one instant." },
          { value: "10M actively read keys on a 300s TTL = 33k refreshes/s", explain: "The steady-state background refresh rate this mechanism generates across the whole working set." },
        ],
        breaks: {
          failure: "None of the three helps with a cache that starts empty.",
          handled: "A cold pool has the same symptom as a stampede and a completely different cause, which is why it needs a rate limiter instead of the single-flight lock.",
        },
        choice: {
          pick: "A per-key lock built on the cache itself, with no consensus and no fencing token",
          instead: "A real lock service with consensus and monotonic fencing tokens, or no coordination at all.",
          decider:
            "What a lost grant costs: one duplicate origin query, against a 100k QPS budget. Paying tens of milliseconds for consensus to protect a single extra read would destroy the only reason the cache exists.",
          flips: "Never for this lock, that is the point. The moment the protected thing is a mutation rather than a read, a lost grant corrupts data and this construction is wrong.",
        },
      },
    },
    {
      id: "origin",
      label: "Origin database",
      sub: "50 read replicas, 100k QPS ceiling",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "The only authoritative copy of the data. Every miss and every fill lands here, and every write commits here first.",
        why: "This number sets the required hit rate rather than the other way round. 5M x (1 - h) < 100k gives h > 98%, so each point of hit rate is 50k QPS and a key format change is a capacity change.",
        numbers: [
          { value: "50 replicas x 2k QPS = 100k QPS available", explain: "How this origin's total serving capacity is assembled." },
          { value: "h > 98%; at 97% the origin is 50% over", explain: "How thin the margin is: a two-point drop in hit rate is already an overload." },
          { value: "~20ms per row read vs ~0.3ms cached", explain: "~67x slower than cached; combined with h > 98%, even a 1-point hit-rate drop overloads the origin and multiplies user-facing latency." },
        ],
        breaks: {
          failure: "Cold start. The origin is sized for 1/50th of peak read load.",
          handled: "An empty pool presents it with 50x its capacity and it saturates long before the cache can refill. Fill after a cold start is rate-limited rather than let run at full speed for this reason.",
        },
        choice: {
          pick: "Size the origin for misses and protect it with rate-limited fill and load shedding",
          instead: "Size the origin for the real read load, or turn on cache persistence so restarts come back warm.",
          decider:
            "Cost and honesty. 5M QPS of origin capacity is 50x the 100k actually bought, and persistence does not close the gap either: it restores values whose freshness cannot be reasoned about.",
          flips: "When the working set is small enough that the origin can serve peak unaided, where the cache really is only a latency optimisation.",
        },
      },
    },
    {
      id: "writer",
      label: "Write path",
      sub: "commit, then DELETE, never SET",
      kind: "service",
      col: 0,
      row: 2,
      detail: {
        what: "The 50k writes/s path. It commits to the origin first and then deletes the cache key rather than overwriting it.",
        why: "Only one of four orderings survives. Delete first and a reader caches the pre-write value inside the commit window. Overwrite after committing and two writers can apply SETs in the opposite order to their commits. Deletes commute, and absent is always safe.",
        numbers: [
          { value: "50k writes/s, 1% of reads", explain: "The volume this path handles relative to the much larger read traffic." },
          { value: "delete-first window = the origin write, single-digit ms", explain: "How narrow, but real, the race window is under the delete-first alternative." },
          { value: "at 100k misses/s a 1-in-1M race poisons a key every 10s", explain: "How often even a rare race condition actually fires at this scale, which is why it cannot be dismissed as negligible." },
        ],
        breaks: {
          failure: "Commit-then-delete still loses to a stalled reader.",
          handled: "It reads v1, a writer commits v2 and deletes nothing because the key is absent, then the reader SETs v1, which survives the full TTL until it expires.",
        },
        choice: {
          pick: "Commit then DELETE, with a backstop TTL on every key without exception",
          instead: "Versioned values, where a SET carrying an older row version or LSN is rejected; or leases, where a DELETE invalidates the reader's outstanding token.",
          decider:
            "Whether the stalled-reader race must be closed or merely bounded. Versioning costs 8B per value, 40GB across 5B keys, and turns every SET into a compare-and-set. A TTL costs nothing.",
          flips: "Key classes with a tight staleness budget, or anything gating money. Leases are the better buy there, since one lease per key per interval is also a free stampede defence.",
        },
      },
    },
    {
      id: "invalidator",
      label: "Change-log invalidator",
      sub: "CDC consumer + cross-region delete",
      kind: "queue",
      col: 1,
      row: 3,
      detail: {
        what: "A consumer of the origin's committed change stream that deletes the affected keys, and broadcasts those deletes to the other regions' independent pools.",
        why: "It gives one implementation of invalidation ordered by the store's own commit ordering. That replaces a hand-written delete at every call site, where one forgotten delete is a stale value living until its TTL.",
        numbers: [
          { value: "cross-region propagation lag, often 1-5s, becomes the published bound", explain: "The realistic staleness this cross-region path adds, which becomes the honest number to publish." },
          { value: "~50B per delete broadcast, negligible", explain: "The wire cost of this mechanism, cheap enough to never be a capacity concern." },
          { value: "a dropped broadcast is invisible, so the 300s TTL is the real guarantee", explain: "Why this mechanism is a best-effort optimisation layered on top of, not a replacement for, the backstop TTL." },
        ],
        breaks: {
          failure: "It cannot name derived keys.",
          handled: "A page fragment built from a user row, a settings row and three feed rows has no key a row-level event can name. That class gets a short TTL and no invalidation at all.",
        },
        choice: {
          pick: "Drive deletes off the origin's change log, with best-effort broadcast between per-region pools",
          instead: "Every write path issuing its own DELETE, or a tag index mapping source rows to the derived keys built from them.",
          decider:
            "How many services write the same tables. Past roughly 3 or 4 writers of a table, hand-written deletes get forgotten somewhere and the 300s backstop TTL becomes the actual guarantee.",
          flips: "A single service owning every write to a table, where an inline delete is one line of code and a CDC pipeline is an entire system to operate for nothing.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "app",
      to: "l1",
      tier: "hot",
      step: 1,
      label: "hot-key allowlist first",
      detail: {
        what: "The read checking the process-local copy before anything leaves the machine, for the small allowlisted set of keys that have one.",
        why: "It exists only for keys whose fanout would otherwise land on one NIC. Every other key skips it, because a blanket L1 would make the whole keyspace uninvalidatable to buy nothing measurable.",
        numbers: [
          { value: "~200 keys allowlisted", explain: "The typical size of this list, kept deliberately small and reviewed." },
          { value: "100ms to 1s TTL", explain: "The staleness floor this layer imposes on any key it holds." },
        ],
        breaks: {
          failure: "If the allowlist grows by accident, key classes silently acquire a staleness floor nobody chose.",
          handled: "No delete can reach it, which is why additions to this list are deliberate and reviewed rather than automatic.",
        },
      },
    },
    {
      id: "e2",
      from: "l1",
      to: "proxy",
      tier: "hot",
      step: 2,
      label: "GET, 5M/s fleet-wide",
      detail: {
        what: "The actual cache read leaving the application process on a pooled connection to the proxy tier.",
        why: "This is the hop the whole system is sized around: 5M gets/s at a sub-1ms p99. That is why it is a pooled binary protocol rather than anything that opens a connection per call.",
        numbers: [
          { value: "5M gets/s peak", explain: "The peak load this hop is provisioned to sustain." },
          { value: "p99 under 1ms including the network hop", explain: "The latency target the whole tier is held to on this path." },
        ],
        breaks: {
          failure: "Above a 5ms timeout the caller must give up and treat it as a miss.",
          handled: "Waiting on a degraded cache is how a cache incident becomes an outage, which is why this timeout is enforced strictly at the caller.",
        },
      },
    },
    {
      id: "e3",
      from: "proxy",
      to: "ring",
      tier: "data",
      label: "route by key",
      detail: {
        what: "The proxy resolving which shard owns the key, using the ring it holds rather than asking anyone.",
        why: "Placement has to be a local computation on a sub-millisecond path. Holding it in the proxy rather than in 10k clients is what lets the topology change without a fleet-wide redeploy.",
        numbers: [{ value: "one binary search, no network hop", explain: "Adds nothing to the proxy's 100-500µs hop; the lookup is sub-microsecond, so socket multiplexing is the entire cost of this tier." }],
        breaks: {
          failure: "A proxy on a stale ring routes confidently to the wrong shard.",
          handled: "This shows up as a miss rather than an error and quietly costs origin capacity, which is why ring freshness is tracked as its own metric.",
        },
      },
    },
    {
      id: "e4",
      from: "ring",
      to: "shard",
      tier: "hot",
      step: 3,
      label: "owning shard of 60",
      detail: {
        what: "The GET arriving at the single shard that owns this key.",
        why: "One key has exactly one owner, which is what makes the cache cheap. It is also the entire hot key problem: no amount of sharding splits the load for a key that 1M requests per second all want.",
        numbers: [
          { value: "83k ops/s per shard in aggregate", explain: "The typical load one shard carries under evenly distributed traffic." },
          { value: "1M reads/s if they all want one key", explain: "The worst case this hop can face when a single key becomes disproportionately popular." },
        ],
        breaks: {
          failure: "A single key can saturate its owner's NIC at 16 Gbps while the other 59 shards sit at 1.3 Gbps.",
          handled: "The routing layer cannot help with this on its own, which is exactly why hot-key detection and mitigation exist as separate mechanisms.",
        },
      },
    },
    {
      id: "e5",
      from: "shard",
      to: "app",
      tier: "hot",
      step: 4,
      label: "hit: ~0.3ms, 98%",
      offset: 90,
      detail: {
        what: "The hit path returning a ~2KB value, which is where 98% of the 5M gets/s end.",
        why: "This arrow is the entire reason the system exists and it is also the least interesting one. On a hit the origin never learns the read happened, which is what turns 5M reads/s into 100k.",
        numbers: [
          { value: "~0.3ms vs ~20ms at the origin", explain: "The latency win this path delivers over ever touching the authoritative store." },
          { value: "98% of reads end here", explain: "5M reads/s x 98% = 4.9M/s absorbed here; the remaining 2% is exactly the ~100k/s ceiling the origin is provisioned for." },
        ],
        breaks: {
          failure: "Nothing on this path is authoritative.",
          handled: "A value returned here can be stale by up to the TTL, plus replication lag if it came from a replica. That is a known, bounded staleness, not an unbounded one.",
        },
      },
    },
    {
      id: "e6",
      from: "shard",
      to: "loader",
      tier: "hot",
      step: 5,
      label: "miss: 100k/s",
      detail: {
        what: "A miss handed to the loader, which is the only path allowed to touch the origin.",
        why: "Misses are a capacity number rather than an error: at 99% they are 50k/s and half the origin is spare. At 97% they are 150k/s and the origin is 50% over. Routing them through one place is what makes them countable.",
        numbers: [
          { value: "5M x 2% = 100k misses/s", explain: "The baseline miss rate this hop carries at the target hit rate." },
          { value: "each is also an admission, 200 MB/s of churn", explain: "The downstream write cost every miss also generates when it fills the cache." },
        ],
        breaks: {
          failure: "A miss storm is indistinguishable from normal traffic at the shard.",
          handled: "The alarm has to live on origin QPS rather than on the cache, since the shard itself cannot tell a legitimate spike from a stampede.",
        },
      },
    },
    {
      id: "e7",
      from: "loader",
      to: "origin",
      tier: "hot",
      step: 6,
      label: "1 loader per key",
      detail: {
        what: "The origin query, made by exactly one holder of the per-key lock while every other misser waits.",
        why: "Without it, one popular key expiring turns 10 QPS into 10,000 in the same millisecond. The lock is what converts a stampede into a single read plus a short wait for everyone else.",
        numbers: [
          { value: "10k concurrent misses become 1 query", explain: "The collapse this hop achieves on a hot expiring key." },
          { value: "~20ms per origin read", explain: "Paid once per stampede instead of 10,000 times; unlocked, that same 20ms multiplies into the origin overload the tier exists to prevent." },
        ],
        breaks: {
          failure: "If the loader dies holding the lock, every waiter stalls until it expires.",
          handled: "The lock TTL directly bounds the latency of a miss on a hot key, so it is kept short enough that a dead loader never stalls waiters for long.",
        },
      },
    },
    {
      id: "e8",
      from: "loader",
      to: "shard",
      tier: "data",
      label: "SET, TTL 300s +/-10%",
      offset: 40,
      detail: {
        what: "The fill: writing the loaded value back with a jittered TTL, which is why every miss is also a small write.",
        why: "Jitter is the cheap half of the stampede defence. Keys written in the same batch and given exactly 3600 seconds will expire in the same millisecond and rediscover each other at the origin.",
        numbers: [
          { value: "3600 + random 0 to 360", explain: "The concrete jitter formula applied to spread out expiries." },
          { value: "100k admissions/s in steady state", explain: "The steady-state rate this fill path handles." },
        ],
        breaks: {
          failure: "This is the SET a stalled reader makes with a superseded value.",
          handled: "That is the invalidation race a backstop TTL bounds and only versioning or leases actually closes, an accepted residual risk of the simpler design.",
        },
      },
    },
    {
      id: "e9",
      from: "shard",
      to: "eviction",
      tier: "control",
      label: "180GB cap, TTL sweep",
      detail: {
        what: "The two mechanisms inside the shard that remove data: expiry sweeping keys past their TTL, and eviction reclaiming under the memory cap.",
        why: "It is a control path because it removes data rather than serving it. Which of the two is actually binding decides whether the eviction policy fork is worth any time at all.",
        numbers: [
          { value: "residency ~14 hours vs 300s median TTL", explain: "The comparison that determines which removal mechanism actually does the work in practice." },
          { value: "evictions/s is the metric that says which one binds", explain: "The observable signal used to tell whether eviction pressure, not just TTL expiry, is happening." },
        ],
        breaks: {
          failure: "If keys without a TTL are configured as non-evictable, the cap stops being a cap.",
          handled: "The process is OOM killed instead, which is why every key without exception carries a backstop TTL in this design.",
        },
      },
    },
    {
      id: "e10",
      from: "shard",
      to: "replica",
      tier: "control",
      label: "async replication",
      offset: 40,
      detail: {
        what: "Asynchronous replication of the primary's writes to its replica, which stands ready for promotion and can serve reads.",
        why: "It is deliberately asynchronous. Making it synchronous would put a network round trip on a sub-1ms write path in order to durably preserve data that is by definition allowed to vanish.",
        numbers: [
          { value: "promotion in roughly 10s", explain: "How quickly this replica can take over from a failed primary." },
          { value: "lag adds seconds on top of the 300s TTL", explain: "The additional staleness a promoted replica can introduce." },
        ],
        breaks: {
          failure: "A replica serving reads can return a value the primary has already deleted, for as long as the lag lasts.",
          handled: "That is fine for a profile blob and not for an entitlement, which is why tight-budget key classes are routed to the primary instead.",
        },
      },
    },
    {
      id: "e11",
      from: "shard",
      to: "hotkey",
      tier: "control",
      label: "sampled per-key counts",
      offset: 60,
      detail: {
        what: "Per-shard egress and sampled request counts flowing to the detector that decides which keys are hot.",
        why: "Egress per node is cheap and exact but tells you a shard is saturated, not which key did it. Sampled key counts answer the second question at a cost that does not scale with 5M ops/s.",
        numbers: [
          { value: "per-shard egress in Gbps, sampled at ~1% of requests", explain: "How this signal is collected cheaply enough to run continuously." },
          { value: "trustworthy window ~10s", explain: "How long this hop needs to accumulate before its sample is reliable." },
        ],
        breaks: {
          failure: "The window that makes the sample trustworthy is the same window during which the shard is already saturated.",
          handled: "Nothing has engaged yet during that window, an accepted detection lag rather than something this sampling approach can eliminate.",
        },
      },
    },
    {
      id: "e12",
      from: "hotkey",
      to: "l1",
      tier: "control",
      label: "promote to L1 allowlist",
      detail: {
        what: "A detected hot key being added to the allowlist that application processes cache locally.",
        why: "This is the cheap mitigation and it is one-way. Adding a key here caps its tier load at P/T and simultaneously sets its staleness floor at T, with no path back for a delete.",
        numbers: [
          { value: "1M/s at the tier becomes 10k/s", explain: "The reduction this promotion achieves for the key it applies to." },
          { value: "staleness floor becomes the L1 TTL", explain: "Up to 1s (T), and unlike a normal entry it's now unreachable by any invalidation path — a delete can't reach process-local L1 by construction." },
        ],
        breaks: {
          failure: "Promoting a key whose value gates money or access converts a hard invalidation guarantee into a TTL.",
          handled: "This happens without anything failing or logging, which is why promotion policy explicitly excludes such keys and routes them to replication instead.",
        },
      },
    },
    {
      id: "e13",
      from: "hotkey",
      to: "ring",
      tier: "control",
      label: "or spread :0-:7 over 8",
      detail: {
        what: "The other mitigation: storing the hot value under 8 suffixed names so reads pick a suffix at random and land on 8 different shards.",
        why: "It is the answer when the value must stay invalidatable. Splitting one key over 8 shards divides 16 Gbps into 2 Gbps each and keeps DELETE working, which the L1 cannot do at any TTL.",
        numbers: [
          { value: "16 Gbps becomes 8 x 2 Gbps", explain: "The bandwidth reduction this replication scheme achieves per shard." },
          { value: "8 SETs per fill, 8 deletes per invalidation", explain: "The write amplification cost this scheme pays for keeping the key invalidatable." },
        ],
        breaks: {
          failure: "The fanout is manual: every writer must remember all 8 suffixes.",
          handled: "A delete that misses one leaves a stale copy that one read in eight will see. This path is reserved for keys important enough to justify that discipline.",
        },
      },
    },
    {
      id: "e14",
      from: "writer",
      to: "origin",
      tier: "data",
      label: "commit v2 first",
      detail: {
        what: "The write committing to the authoritative store before anything touches the cache.",
        why: "Ordering is the whole point. Touching the cache first opens a window, single-digit milliseconds long, in which any reader misses, reads the pre-write value and caches it. On a hot key that window is a certainty, not a risk.",
        numbers: [
          { value: "50k writes/s", explain: "The rate this hop carries into the origin." },
          { value: "window ~5ms, the origin write duration", explain: "At 50k writes/s a 5ms window recurs on effectively every write; correct ordering closes it rather than merely shrinking a near-constant race." },
        ],
        breaks: {
          failure: "If the commit succeeds and the process dies before the delete, the stale key survives until its backstop TTL.",
          handled: "That is exactly why the TTL is not optional even on the write-then-delete path, since this failure mode is otherwise unbounded.",
        },
      },
    },
    {
      id: "e15",
      from: "writer",
      to: "shard",
      tier: "control",
      label: "then DELETE, never SET",
      offset: 100,
      detail: {
        what: "The invalidation itself: remove the key rather than overwrite it with the new value.",
        why: "Deletes commute, so any interleaving of two of them leaves the key absent and absent is always safe. Two SETs from two writers can land in the opposite order to their commits and leave the older value resident until the TTL.",
        breaks: {
          failure: "A delete is only as good as its fanout.",
          handled: "It must reach the primary, every read replica, every region's pool and every process L1. The last of those is unreachable by construction, which is why L1 keys stay uninvalidatable by policy.",
        },
      },
    },
    {
      id: "e16",
      from: "origin",
      to: "invalidator",
      tier: "control",
      label: "committed change log",
      detail: {
        what: "The origin's committed change stream feeding the invalidation consumer.",
        why: "Reading the log rather than trusting writers gives one implementation of invalidation with the store's own commit ordering, and nothing is forgotten because nothing is hand-written per call site.",
        numbers: [
          { value: "1 ordering source: the store's own commit log", explain: "The single authority this mechanism relies on, rather than trusting every writer to remember." },
          { value: "consumer lag, typically under 1s, is the staleness bound you publish", explain: "The realistic delay this hop introduces, which becomes the honest freshness claim for this path." },
        ],
        breaks: {
          failure: "Consumer lag is a staleness bound that nobody sees fail.",
          handled: "Reads keep succeeding, they are just answering from before the write, which is why lag itself is monitored directly rather than inferred from errors.",
        },
      },
    },
    {
      id: "e17",
      from: "invalidator",
      to: "shard",
      tier: "control",
      label: "delete the row's keys",
      offset: 150,
      detail: {
        what: "Deletes derived from committed row changes, applied to this region's pool and broadcast to the others.",
        why: "It removes the requirement that every one of many services remembers to invalidate. Cross-region it is best effort by construction, because there is no acknowledgement worth waiting on without making a local write depend on a remote region.",
        numbers: [
          { value: "~50B per delete, negligible on the wire", explain: "The bandwidth cost of this broadcast, cheap enough to ignore as a capacity concern." },
          { value: "the 300s backstop TTL remains the only real guarantee", explain: "The honest fallback this best-effort mechanism relies on when a broadcast is silently dropped." },
        ],
        breaks: {
          failure: "It can only delete keys a row-level event can name.",
          handled: "Derived keys, the ones users actually look at, are quietly the stalest thing in the system. Derived-key classes get a short TTL rather than relying on this path at all.",
        },
      },
    },
  ],
};
