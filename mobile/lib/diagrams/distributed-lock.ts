import type { Diagram } from "./types";

export const DISTRIBUTED_LOCK: Diagram = {
  id: "distributed-lock",
  title: "Distributed Lock",
  question: "Design a Distributed Lock",
  sourceId: "patterns",
  itemId: 35,
  overview: {
    shape:
      "Two mechanisms, not one: a consensus cluster grants time-bounded ownership of a key, and the protected resource refuses any write carrying a token older than the last one it accepted.",
    forces: [
      {
        constraint: "1k correctness acquires/s move money, but 9k/s best-effort acquires would waste most of a majority-commit cluster",
        decision: "The lock class router sends correctness locks to etcd for a token and best-effort locks to Redis for speed",
        lights: ["router", "etcd", "redis", "e2", "e3"],
      },
      {
        constraint: "with 0 expiry, 1 crashed holder wedges the key until a human intervenes",
        decision: "Every grant carries a 30s lease, so liveness is automatic, even though it invites a live-but-slow holder to be expired",
        lights: ["lease", "e5"],
      },
      {
        constraint: "a 35s GC pause under a 20s lease expires the lease while the holder is frozen, believing it still holds the key",
        decision: "The fencing token is the Raft log revision itself, monotonic by construction, with no separate counter that could lag on failover",
        lights: ["fence-token", "etcd", "e6"],
      },
      {
        constraint: "a single check-then-write leaves 1 gap a pause can land in, no matter how late that check runs",
        decision: "The fence check rides inside the same UPDATE statement as the write, at the resource, the only party that sees both writes",
        lights: ["fence-check", "resource", "e10", "e11", "e12"],
      },
      {
        constraint: "one nightly batch job or one manual fix bypasses a client-side fence with no signal anywhere",
        decision: "Fencing is enforced in the storage layer itself, never merely requested of clients",
        lights: ["fence-check", "resource"],
      },
    ],
    naive: {
      text: "Have the holder just check its lock is still valid right before it writes, then write. That closes the obvious race, but a check-then-write still has a gap: the process can pause between the check and the write. A stop-the-world garbage collection pause of 35 seconds fits comfortably inside a 20 second lease's expiry. A worker that was valid at the time of its check can resume mid-function after its lease expired and a second worker already took over, believing nothing happened. The design instead puts a monotonically increasing fencing token on every write and checks it at the resource. That check rides inside the same statement as the write, the only place that sees both workers' writes at once.",
      lights: ["fence-check", "resource"],
    },
    beats: [
      {
        text: "A call site picks its lock class before it picks a lock. Correctness locks, roughly 1k acquires per second across ten money-moving services, go to consensus and come back with a token. The other 9k per second, cache refills and cron dedupe, go to Redis, where a duplicate holder is waste rather than damage.",
        lights: ["router", "etcd", "redis", "e2", "e3"],
      },
      {
        text: "The grant side is deliberately thin. Three etcd nodes acknowledge nothing until a majority holds it durably, so a leader change or a partition cannot record two grants for the same key. Every grant also carries a 30 second TTL, so a holder that dies does not wedge the key forever.",
        lights: ["grant-side", "etcd", "lease", "e5"],
      },
      {
        text: "The token is the only part of the grant that matters downstream. It is the Raft revision at which the lock key was created, so monotonicity is a property of the log rather than a feature someone could get subtly wrong. A separate counter service would be a second consensus problem you now own.",
        lights: ["fence-token", "etcd", "e6"],
      },
      {
        text: "Then the holder pauses. A 35 second stop-the-world collection under a 20 second lease expires the lease while the process is frozen. The next holder acquires with token 34 and writes, and the first resumes mid-function believing nothing happened. Nothing at the lock service prevents this, because the service behaved correctly at every step.",
        lights: ["worker-a", "worker-b", "fence-token", "e7", "e8", "e9"],
      },
      {
        text: "So the check lives at the resource, inside the same statement as the write. The conditional UPDATE compares and advances max_seen_token atomically; zero rows affected means fenced out, and the caller has to treat that as terminal rather than something to retry. A read, then a compare in application code, then a write reopens exactly the gap the fence exists to close.",
        lights: ["fence-check", "resource", "e10", "e11", "e12"],
      },
      {
        text: "Enforce it in the storage layer rather than requesting it of clients, because the guarantee is only as strong as the least disciplined writer. One nightly batch job or one operator applying a manual fix bypasses a client-side fence with no signal anywhere. Accept that some resources cannot be fenced at all, at which point the lock is advisory and you should say so.",
        lights: ["fence-check", "resource"],
      },
    ],
    crux: {
      problem:
        "A holder cannot verify it still holds the lock at the instant of its write, because any check it performs can be followed by another pause before the write lands.",
      handled:
        "The only party that sees both writes is the resource, so the resource is the only place safety can live. Everything the lock service itself does is contention control wearing the word safety.",
    },
    numbers: [
      {
        value: "20s lease against a 35s GC pause",
        explain: "The concrete scenario that defeats a lease-only design: a pause longer than the lease lets a frozen holder outlive its own grant and wake up believing it is still valid.",
      },
      {
        value: "1k correctness vs 9k best-effort acquires/s",
        explain: "The traffic split the router makes, sized so the small correctness share fits comfortably on a majority-commit cluster while the larger best-effort share stays on cheap Redis.",
      },
      {
        value: "etcd acquire 1 to 10ms, Redis sub-1ms",
        explain: "The roughly 20x to 30x latency gap between the two backends, the reason best-effort locks are never routed through consensus.",
      },
      {
        value: "peak 20k consensus writes/s, 68% of ceiling",
        explain: "The worst realistic load on etcd, a fleet-wide reacquire storm, measured against its 10k-30k writes/s ceiling.",
      },
    ],
  },
  nodes: [
    {
      id: "grant-side",
      label: "Grant side: consensus lock service",
      kind: "zone",
      detail: {
        what: "The part of the design that hands out time-bounded ownership: a majority-commit cluster, the lease that expires it, and the log position that names it.",
        why: "It is one zone because none of its three pieces is independently useful. A grant with no expiry wedges the key when a holder dies, and an expiry with no token is a promise nobody downstream can check.",
        numbers: [
          { value: "3 or 5 nodes", explain: "The typical size of a consensus cluster this small deployment runs." },
          { value: "majority (2 of 3) commit per grant", explain: "The agreement threshold every grant must clear before it is acknowledged." },
          { value: "30s TTL", explain: "The lease lifetime every grant carries by default." },
        ],
        breaks: {
          failure: "Everything in this zone can be flawless and two workers still write the same record.",
          handled: "The conflict happens one hop further down at the resource, which is exactly why this zone alone can never be the safety mechanism, only the contention control.",
        },
      },
    },
    {
      id: "worker-a",
      label: "Worker A, the holder",
      sub: "acquires, then pauses 35s in GC",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The process that acquired the lock first, did some work, and then stopped running for 35 seconds inside a stop-the-world garbage collection pause.",
        why: "It is a first-class component because it is the failure the whole design answers to. A holder that is merely slow rather than dead is indistinguishable from a dead one at the lock service, and it wakes up with no notification that its lease expired.",
        numbers: [
          { value: "20s lease", explain: "The grant window this worker holds before it must renew." },
          { value: "35s pause", explain: "The freeze duration that outlasts the lease and triggers the whole failure mode." },
          { value: "0 renewals sent during the freeze", explain: "The renewal loop itself is frozen along with everything else, so nothing extends the lease during the pause." },
        ],
        breaks: {
          failure: "It resumes mid-function still believing it holds the lock and issues a write with token 33, which is stale by the time it lands.",
          handled: "That write is exactly what the resource-side fence exists to catch, since nothing at the worker itself can detect the staleness.",
        },
        choice: {
          pick: "Let the lease simply expire and rely on the resource-side fence to reject the stale write",
          instead: "Have the worker watch its own lease and abort mid-function the instant it is revoked.",
          decider:
            "Whether a frozen process can run its own abort code. A 35s stop-the-world pause freezes every thread, the watch callback included, so self-detection is unavailable during exactly the failure that matters.",
          flips: "Pauses caused by blocked I/O rather than a frozen runtime, where a watch thread keeps scheduling and can genuinely cancel the pending write before it is sent.",
        },
      },
    },
    {
      id: "worker-b",
      label: "Worker B, next holder",
      sub: "acquires at t=22, writes with 34",
      kind: "service",
      col: 0,
      row: 3,
      detail: {
        what: "The second process, which acquires the key legitimately once A's lease expires and writes to the resource with a strictly higher token.",
        why: "It exists to make the race concrete. Without a second acquirer the lease expiry is harmless; with one, two live processes each believe they are the holder and both issue writes into the same row.",
        numbers: [
          { value: "acquires at t=22", explain: "The moment this worker legitimately takes over once A's lease has lapsed." },
          { value: "token 34", explain: "The strictly higher token this worker's grant carries." },
          { value: "1 write accepted, fence_token 34", explain: "The single write that actually lands, once the fence has done its job." },
        ],
        breaks: {
          failure: "Its correct write is the one that gets silently overwritten if the resource does not fence.",
          handled: "The visible symptom without a fence is corruption attributed to B rather than to A, which is why the fence check exists at the resource itself.",
        },
        choice: {
          pick: "Poll for the key with jittered backoff after a null acquire",
          instead: "Block on a server-side wait queue and be woken when the key frees.",
          decider:
            "Visibility against latency. A wait queue wakes the next holder in roughly one round trip, but hides queue depth inside the service. Polling costs an extra request per attempt but leaves contention visible as a metric.",
          flips: "A single hot key with many waiters, where the O(waiters) cost of everyone polling every interval genuinely dominates and a FIFO wait queue is worth the lost visibility.",
        },
      },
    },
    {
      id: "router",
      label: "Lock class router",
      kind: "service",
      col: 0,
      row: 0,
      sub: "picks lock class per call site",
      detail: {
        what: "The client-side decision, made per call site rather than globally, about which backend a given lock goes to and whether it returns a fencing token at all.",
        why: "Sizing only works if the two lock classes are counted separately, because they land on different backends and only one of them is anywhere near a ceiling. Putting all 10k acquires/s on consensus wastes headroom; putting all of them on Redis makes money movement unsafe.",
        numbers: [
          { value: "~1k/s correctness", explain: "The steady rate of correctness-critical acquires this router directs to consensus." },
          { value: "~9k/s best effort", explain: "The much larger volume of acquires this router keeps off consensus entirely." },
          { value: "~10k/s total, 100k/s at peak", explain: "The combined load this router handles across both classes at peak." },
        ],
        breaks: {
          failure: "A call site that quietly reclassifies itself.",
          handled: "Someone moves ledger posting onto the best-effort path for latency, and nothing fails until a failover hands the same key to two workers. Classification is reviewed rather than left to individual judgment for exactly this reason.",
        },
        choice: {
          pick: "Two lock classes on two backends, chosen per call site",
          instead: "One backend for everything, Redis, with fencing bolted on by an INCR counter as the token.",
          decider:
            "Acquire rate against the consensus write ceiling, crossed with what a duplicate holder costs. Correctness traffic is 1k acquires/s steady and 10k/s at peak, so 20k writes/s at peak against etcd's 10k to 30k ceiling, about 68%.",
          flips: "Nothing you lock is correctness-critical, or there is no consensus store in the organisation and no appetite to operate one.",
        },
      },
    },
    {
      id: "etcd",
      label: "etcd cluster, 3 nodes",
      sub: "Raft, majority commit per grant",
      kind: "database",
      col: 2,
      row: 1,
      parent: "grant-side",
      detail: {
        what: "A small consensus cluster that does not acknowledge a lock write until a majority holds it durably on disk.",
        why: "Majority commit is what stops two grants for the same key being recorded across a leader change or a partition. It is also what gives the log a single agreed order, which is where the fencing token comes from.",
        numbers: [
          { value: "10k to 30k writes/s ceiling", explain: "The capacity this cluster is provisioned against." },
          { value: "acquire 1 to 10ms, p99 20 to 30ms", explain: "The latency this majority-commit path costs on a typical request." },
          { value: "2.3k writes/s steady", explain: "The realistic steady-state load this cluster actually carries." },
        ],
        breaks: {
          failure: "Losing majority stops acquires entirely.",
          handled: "That is the correct behaviour for correctness locks, work stops rather than forking, but it is still a full outage of the lock path while it lasts.",
        },
        choice: {
          pick: "etcd, 3 nodes, lease plus keep-alive",
          instead: "ZooKeeper with ephemeral znodes tied to the client session.",
          decider:
            "Operational preference, not a design fork. Both require a majority of 3 to agree before acknowledging, and both expose a log position usable as a token.",
          flips: "Heavy contention on single keys where you want a fair FIFO queue for free, or an estate that already runs ZooKeeper for something else.",
        },
      },
    },
    {
      id: "lease",
      label: "Lease and keep-alive",
      kind: "service",
      sub: "TTL 30s, renew at 10s, alerts",
      col: 3,
      row: 1,
      parent: "grant-side",
      detail: {
        what: "The expiry attached to every grant, plus the holder's renewal loop that extends it while work is still in progress.",
        why: "Without a TTL a crashed holder wedges the key until a human intervenes. With one, liveness is automatic and the cost is that a live but slow holder can be expired out from under itself, which is precisely the hole fencing closes.",
        numbers: [
          { value: "TTL 30s, renew every 10s", explain: "The default cadence this mechanism runs at." },
          { value: "3,000 concurrent long holders", explain: "The scale of active leases this mechanism is designed to support at once." },
          { value: "300 renewals/s, ~13% of steady load", explain: "The overhead this renewal traffic adds against the cluster's overall steady-state load." },
        ],
        breaks: {
          failure: "Synchronised renewal is a self-inflicted write spike through the leader's log.",
          handled: "A renewal missed to a GC pause also silently converts a healthy holder into an expired one, which is why renewals are jittered rather than fired on a fixed schedule.",
        },
        choice: {
          pick: "30s TTL renewed at TTL/3, jittered into [TTL/4, TTL/2]",
          instead: "A long TTL with no renewal, or a short TTL renewed aggressively.",
          decider:
            "Renewal load against pause tolerance. At 3,000 concurrent long holders renewing once per 10s that is 300 renewals/s, about 13% of steady consensus load, affordable here.",
          flips: "ZooKeeper, where the lock is an ephemeral znode bound to the client session and there is no explicit TTL to size or renew at all.",
        },
      },
    },
    {
      id: "fence-token",
      label: "Fencing token",
      sub: "etcd mod_revision, ZK czxid",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "A number returned with every grant that strictly increases across successive grants, taken from the position of that grant in the consensus log.",
        why: "It is the one thing the lock service produces that the resource can check. It has to come from something that already has a single agreed order, and a renewal deliberately does not mint a new one.",
        numbers: [
          { value: "1 strictly increasing value per key", explain: "The core property this token guarantees, derived directly from log order." },
          { value: "0 new tokens minted on renewal", explain: "Renewal deliberately does not produce a new token, which is what prevents fencing out the holder's own in-flight write." },
        ],
        breaks: {
          failure: "A token minted anywhere other than the log.",
          handled: "A separate counter service is a second consensus problem, and a counter that resets or lags on failover fences out the wrong writer. The token is always the log's own position for this reason.",
        },
        choice: {
          pick: "The consensus log position: etcd mod_revision or ZooKeeper czxid",
          instead: "A dedicated counter service, or Redis INCR.",
          decider:
            "Whether monotonicity survives failover. In a 3 node Raft log every committed grant sits at a higher index than every previous one, globally, so monotonicity is inherited rather than implemented.",
          flips: "Best-effort locks where the token is a debugging aid rather than a safety mechanism, or an estate with one Redis and no consensus store.",
        },
      },
    },
    {
      id: "redis",
      label: "Redis SETNX, 3 shards",
      sub: "SET key NX EX 30, no token",
      kind: "database",
      col: 1,
      row: 0,
      detail: {
        what: "Sharded single-instance Redis holding a key with an expiry, used for locks where a duplicate holder is annoying rather than damaging.",
        why: "Sub-millisecond and one hop, against tens of milliseconds through a quorum. That latency gap, not safety, is what pushes cache refills, cron dedupe and stampede collapse onto this tier.",
        numbers: [
          { value: "~100k ops/s per instance", explain: "The per-instance capacity this tier is provisioned against." },
          { value: "90k/s peak sharded to 30k/s each", explain: "How peak load is spread across the three shards." },
          { value: "sub-1ms acquire", explain: "The latency this tier delivers, the whole reason best-effort locks live here." },
        ],
        breaks: {
          failure: "Replication is asynchronous, so a primary that dies before replicating hands the same key to a second caller after failover.",
          handled: "There is no log here, so no token can be issued that is monotonic across that failover, an accepted gap since none of this tier's locks are correctness-critical.",
        },
        choice: {
          pick: "Sharded single-instance Redis SETNX for best-effort locks only",
          instead: "Redlock, acquiring the same key on a majority of 5 independent Redis masters.",
          decider:
            "Whether you need a fencing token, and whether you will depend on a wall-clock drift bound. Redlock's reference specification allows 1% of the TTL for drift, so 300ms on a 30s lease.",
          flips: "You already run several independent Redis instances, the locks are best-effort, and what you actually want is for the lock to survive one master dying.",
        },
      },
    },
    {
      id: "fence-check",
      label: "Fence check at the write",
      kind: "service",
      col: 0,
      row: 2,
      sub: "AND fence_token < :token",
      detail: {
        what: "The compare-and-advance predicate that rides inside the same UPDATE as the write, refusing any token lower than the highest already accepted.",
        why: "This is the only mechanism in the design that actually prevents corruption, because it is the only check performed by the party that sees both writes. Zero rows affected means fenced out, and the caller must treat that as terminal.",
        numbers: [
          { value: "one extra predicate", explain: "The added complexity this mechanism costs, minimal compared to what it prevents." },
          { value: "zero extra round trips", explain: "The fence check adds no network cost, since it rides inside the write's own statement." },
          { value: "0 rows affected means fenced", explain: "The exact signal a caller must recognise as a terminal rejection, never something to retry." },
        ],
        breaks: {
          failure: "It makes each write safe without making the critical section atomic.",
          handled: "A holder that writes A, is fenced out, then fails on B leaves the resource half updated, and no token check can see that, an accepted limit of per-statement fencing.",
        },
        choice: {
          pick: "Single-statement compare-and-advance, enforced by the storage layer",
          instead: "Read max_seen_token, compare in application code, then write.",
          decider:
            "Where the process can pause. A read-then-write leaves a gap between the check and the write that a 35 second pause fits inside comfortably, exactly the race the fence exists to close.",
          flips: "Object storage, where conditional writes give compare-and-swap on the ETag directly and there is no separate token column to maintain.",
        },
      },
    },
    {
      id: "resource",
      label: "Protected resource",
      kind: "database",
      sub: "fence_token column, rejections",
      col: 1,
      row: 2,
      detail: {
        what: "The database row the lock exists to protect, carrying the highest token it has ever accepted alongside the data.",
        why: "The counter belongs to the protected object, not to the lock, because the object is what both writers touch. That is also what makes fencing composable with optimistic concurrency, both are a monotonic check at the last hop.",
        numbers: [
          { value: "~200 B per active lock record", explain: "The storage overhead this mechanism adds per protected object." },
          { value: "one counter per protected object", explain: "The granularity this design uses, tied to the object rather than to the lock key." },
          { value: "one lock key to one object", explain: "The relationship this design assumes to keep fencing sound." },
        ],
        breaks: {
          failure: "Fencing moves the serialisation point onto the object.",
          handled: "For a per-order row that is free; for a single global object every write now contends on the same counter, which is the hot lock wearing a different hat.",
        },
        choice: {
          pick: "A fence_token column on the object, one lock key to one object",
          instead: "One counter per lock key, or a shared max_seen table.",
          decider:
            "Partial fencing and false rejects. If one lock key guards 3 rows, all 3 must carry the column and take the same token in one transaction. Otherwise a partially fenced writer updates some rows and not others.",
          flips: "A store with native conditional writes on a version or ETag, where the existing concurrency primitive already is the counter.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "worker-a",
      to: "router",
      tier: "hot",
      step: 1,
      label: "acquire(key, ttl=30s)",
      detail: {
        what: "The acquire call, carrying the lock key and the TTL the caller wants.",
        why: "The API is deliberately three calls, acquire, release and renew, because anything richer tempts callers into holding state the service cannot verify. The TTL is passed per call because a 2 second ledger post and a 60 second batch step want very different expiries.",
        numbers: [
          { value: "3 calls: acquire, release, renew", explain: "The entire surface area of the client API, kept deliberately minimal." },
          { value: "1 TTL argument passed per call", explain: "How each caller tailors its own expiry rather than sharing a global default." },
        ],
        breaks: {
          failure: "A caller that sizes the TTL against expected work rather than worst-case pause gets expired mid-section routinely.",
          handled: "This is survivable only because the fence exists downstream, which is the entire justification for that mechanism rather than a redundant safeguard.",
        },
      },
    },
    {
      id: "e2",
      from: "router",
      to: "etcd",
      tier: "hot",
      step: 2,
      label: "correctness lock",
      detail: {
        what: "Correctness-critical acquires being sent to the consensus cluster, where each one costs a majority commit.",
        why: "This is the path that money movement, ledger posting and state-machine transitions take, and it is the only path that returns a token. It is routed by call site rather than by load.",
        numbers: [
          { value: "~1k acquires/s steady", explain: "The typical rate this hop carries." },
          { value: "10k/s at peak", explain: "The worst realistic burst this hop must absorb." },
          { value: "1 to 10ms per acquire", explain: "The latency this consensus path costs on a normal request." },
        ],
        breaks: {
          failure: "The spike is a release storm, not organic growth: a fleet-wide deploy makes every holder reacquire at once.",
          handled: "That is 20k writes/s and 68% of ceiling arriving in one second, an accepted burst pattern the cluster is sized to absorb.",
        },
      },
    },
    {
      id: "e3",
      from: "router",
      to: "redis",
      tier: "data",
      label: "best-effort lock, no token",
      detail: {
        what: "Best-effort acquires going to sharded Redis, returning ownership of a key and nothing else.",
        why: "These locks exist to collapse a stampede or deduplicate a cron run, where two holders means one wasted cache refill. Paying a majority round trip for that would be 20x the latency for a guarantee nobody downstream would check.",
        numbers: [
          { value: "~9k/s steady, 90k/s peak", explain: "The volume this hop carries, far larger than the correctness path." },
          { value: "sharded by key hash across 3 instances", explain: "How this traffic is spread to stay under any single instance's ceiling." },
          { value: "sub-1ms", explain: "The latency this path delivers." },
        ],
        breaks: {
          failure: "Nothing here survives a failover: the replica promoted after an async gap has never heard of the grant.",
          handled: "It will hand the same key straight to a second caller, an accepted risk since nothing routed here is correctness-critical.",
        },
      },
    },
    {
      id: "e4",
      from: "worker-b",
      to: "router",
      tier: "data",
      label: "acquire, told to retry",
      detail: {
        what: "Worker B's acquire while A still holds the key, which returns null rather than blocking.",
        why: "Returning null and letting the caller decide keeps the lock service out of the caller's scheduling. A blocking acquire hides queue depth inside the service, where you cannot see which key is pathological.",
        numbers: [{ value: "1 wait-queue depth metric tracked per key", explain: "The observability this design keeps, in exchange for not blocking inside the service itself." }],
        breaks: {
          failure: "Redis SETNX has no queue at all, so everyone polls and an arbitrary poller wins.",
          handled: "Wait times are left unbounded for the unlucky caller there, an accepted cost of the simpler best-effort design.",
        },
      },
    },
    {
      id: "e5",
      from: "etcd",
      to: "lease",
      tier: "control",
      label: "TTL 30s lease",
      detail: {
        what: "The grant being bound to a lease, a TTL'd object identified by a lease id, with the lock key attached to it.",
        why: "Binding the key to a lease rather than writing an expiry into the value is what makes release automatic. When the lease is revoked or expires, the key attached to it disappears without anyone having to run cleanup.",
        numbers: [
          { value: "TTL 30s", explain: "The default expiry window this binding gives every grant." },
          { value: "1 key tied to 1 lease; dies with it", explain: "The one-to-one relationship that makes automatic cleanup possible." },
        ],
        breaks: {
          failure: "A holder that crashes between acquiring and starting work still holds the key for the full TTL.",
          handled: "TTL directly bounds how long a dead holder blocks everyone else, which is why TTL is chosen deliberately rather than set arbitrarily long.",
        },
      },
    },
    {
      id: "e6",
      from: "etcd",
      to: "fence-token",
      tier: "control",
      label: "Raft revision as token",
      detail: {
        what: "The revision at which the lock key was created being read back out as the token for this grant.",
        why: "Nothing is computed here, which is the point. The number already exists as a consequence of committing to the log, so its monotonicity is inherited rather than implemented.",
        breaks: {
          failure: "Systems without a shared log cannot supply this edge at all.",
          handled: "That is exactly why a resource-side fence cannot be retrofitted onto Redlock, which has no single log to derive a monotonic token from.",
        },
      },
    },
    {
      id: "e7",
      from: "fence-token",
      to: "worker-a",
      tier: "hot",
      step: 3,
      label: "granted, token 33",
      offset: 60,
      detail: {
        what: "The first grant returning to Worker A: ownership of the key plus token 33.",
        why: "The token travels back to the client because the client is what will attach it to every write. This is the moment ownership becomes something a third party can verify.",
        numbers: [
          { value: "token 33", explain: "The specific token this grant carries." },
          { value: "1 lease created here, TTL 30s", explain: "The lease this grant is bound to." },
        ],
        breaks: {
          failure: "This is the last notification A ever gets.",
          handled: "Nothing tells it when the lease expires, so from here on its belief about ownership is a memory of the past, exactly the gap the fence is built to catch.",
        },
      },
    },
    {
      id: "e8",
      from: "lease",
      to: "worker-a",
      fromSide: "top",
      toSide: "left",
      tier: "data",
      label: "renew at TTL/3, 10s",
      offset: 110,
      detail: {
        what: "The keep-alive loop extending the lease every 10 seconds while the holder is still working.",
        why: "Renewal is what lets a 30 second TTL cover a 5 minute job without sizing the TTL for the worst case. It deliberately does not mint a new token, because a fresh token would fence out the holder's own in-flight write.",
        numbers: [
          { value: "renew every 10s", explain: "The default renewal cadence this loop runs at." },
          { value: "jitter into [TTL/4, TTL/2]", explain: "The spread applied to avoid synchronised renewal spikes." },
          { value: "300 renewals/s at our numbers", explain: "The aggregate renewal load this loop generates fleet-wide." },
        ],
        breaks: {
          failure: "The renewal thread lives inside the process it is renewing for.",
          handled: "A stop-the-world pause freezes the renewal along with the work, and the lease expires with nobody noticing, which is the exact failure this whole design accepts and fences against.",
        },
      },
    },
    {
      id: "e9",
      from: "fence-token",
      to: "worker-b",
      fromSide: "right",
      toSide: "bottom",
      tier: "hot",
      step: 4,
      label: "granted, token 34",
      offset: 100,
      detail: {
        what: "The second grant, issued after A's lease expired, carrying token 34.",
        why: "The lock service is behaving correctly at this instant: the previous lease is gone, so the key is free. That correctness is precisely what makes the situation dangerous.",
        numbers: [
          { value: "token 34", explain: "The strictly higher token this new grant carries." },
          { value: "issued at t=22", explain: "The moment this grant is issued, after A's lease has lapsed." },
          { value: "33 is never reissued", explain: "Tokens are never reused, which is what keeps the ordering unambiguous downstream." },
        ],
        breaks: {
          failure: "Nothing in this hop can tell whether A is dead or merely frozen.",
          handled: "No amount of extra caution here would help, because the distinction is unobservable from the service, which is exactly why safety has to live at the resource instead.",
        },
      },
    },
    {
      id: "e10",
      from: "worker-b",
      to: "fence-check",
      tier: "hot",
      step: 5,
      label: "write, fence=34",
      offset: 90,
      detail: {
        what: "The legitimate write, carrying token 34 in the same statement as the data.",
        why: "The token rides with the payload rather than being presented separately, because a separate authorisation step reopens the gap: the process can pause between being authorised and writing.",
        numbers: [
          { value: "token 34 beats max_seen 33", explain: "The comparison that lets this write succeed." },
          { value: "one statement", explain: "The atomicity guarantee this design relies on, token check and write together." },
        ],
        breaks: {
          failure: "If B holds a lock guarding 3 rows and writes them in 3 statements, only the ones written before it is fenced land.",
          handled: "The token has to be applied to all of them in one transaction to avoid that partial-fencing outcome.",
        },
      },
    },
    {
      id: "e11",
      from: "worker-a",
      to: "fence-check",
      label: "stale write 33: fenced out",
      tier: "hot",
      step: 6,
      offset: 110,
      detail: {
        what: "The late write from the resumed holder, carrying the token it was granted before its lease expired.",
        why: "This arrow is the whole question. It is issued by a process running correct code, following the protocol, holding a token it was legitimately given. No client-side discipline can prevent it.",
        numbers: [
          { value: "token 33", explain: "The now-stale token this late write carries." },
          { value: "issued at t=35", explain: "When this write actually arrives, well after A's lease expired." },
          { value: "max_seen is already 34", explain: "The state the fence check compares against, already advanced past this write's token." },
        ],
        breaks: {
          failure: "Without a check at the far end this write commits and silently replaces fresher data.",
          handled: "Nothing anywhere logs an error in that case, which is exactly why the check has to exist at the resource rather than being optional.",
        },
      },
    },
    {
      id: "e12",
      from: "fence-check",
      to: "resource",
      tier: "hot",
      step: 7,
      label: "commit, max_seen = 34",
      detail: {
        what: "The accepted write landing, advancing the row's stored token to the one that just won.",
        why: "Compare and advance happen in the same atomic unit as the data write. There is no instant at which the row has accepted the payload but not yet recorded the token that authorised it.",
        numbers: [
          { value: "1 extra predicate", explain: "The added condition this write carries." },
          { value: "1 extra column write", explain: "The additional field updated alongside the payload." },
          { value: "0 extra round trips", explain: "The predicate and column write above ride the same statement as the data write; fencing's real cost is organisational, not computational." },
        ],
        breaks: {
          failure: "The cost of fencing is organisational rather than computational: this predicate is trivial.",
          handled: "The real difficulty is getting every writer to the row to carry a token at all, which is a discipline and rollout problem, not a technical one.",
        },
      },
    },
  ],
};
