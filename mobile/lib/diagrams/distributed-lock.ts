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
    beats: [
      {
        text: "A call site picks its lock class before it picks a lock. Correctness locks, roughly 1k acquires per second across ten money-moving services, go to consensus and come back with a token. The other 9k per second, cache refills and cron dedupe, go to Redis, where a duplicate holder is waste rather than damage.",
        lights: ["router", "etcd", "redis", "e2", "e3"],
      },
      {
        text: "The grant side is deliberately thin. Three etcd nodes acknowledge nothing until a majority holds it durably, so a leader change or a partition cannot record two grants for the same key, and every grant carries a 30 second TTL so a holder that dies does not wedge the key forever.",
        lights: ["grant-side", "etcd", "lease", "e5"],
      },
      {
        text: "The token is the only part of the grant that matters downstream. It is the Raft revision at which the lock key was created, so monotonicity is a property of the log rather than a feature someone implemented and could get subtly wrong. A separate counter service would be a second consensus problem you now own.",
        lights: ["fence-token", "etcd", "e6"],
      },
      {
        text: "Then the holder pauses. A 35 second stop-the-world collection under a 20 second lease expires the lease while the process is frozen, so the next holder acquires with token 34 and writes, and the first resumes mid-function believing nothing happened. Nothing at the lock service prevents this, because the service behaved correctly at every step.",
        lights: ["worker-a", "worker-b", "fence-token", "e7", "e8", "e9"],
      },
      {
        text: "So the check lives at the resource, inside the same statement as the write. The conditional UPDATE compares and advances max_seen_token atomically; zero rows affected means fenced out, and the caller has to treat that as terminal rather than something to retry. A read, then a compare in application code, then a write reopens exactly the gap the fence exists to close.",
        lights: ["fence-check", "resource", "e10", "e11", "e12"],
      },
      {
        text: "Enforce it in the storage layer rather than requesting it of clients, because the guarantee is only as strong as the least disciplined writer: one nightly batch job or one operator applying a manual fix bypasses a client-side fence with no signal anywhere. And accept that some resources cannot be fenced at all, at which point the lock is advisory and you should say so.",
        lights: ["fence-check", "resource"],
      }
    ],
    crux:
      "A holder cannot verify it still holds the lock at the instant of its write, because any check it performs can be followed by another pause before the write lands. The only party that sees both writes is the resource, so the resource is the only place safety can live. Everything the lock service does is contention control wearing the word safety.",
    numbers: [
      "20s lease against a 35s GC pause",
      "1k correctness vs 9k best-effort acquires/s",
      "etcd acquire 1 to 10ms, Redis sub-1ms",
      "peak 20k consensus writes/s, 68% of ceiling"
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
        numbers: ["3 or 5 nodes", "majority (2 of 3) commit per grant", "30s TTL"],
        breaks:
          "Everything in this zone can be flawless and two workers still write the same record, because the conflict happens one hop further down at the resource.",
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
        numbers: ["20s lease", "35s pause", "0 renewals sent during the freeze"],
        breaks:
          "It resumes mid-function still believing it holds the lock and issues a write with token 33, which is stale by the time it lands.",
        choice: {
          pick: "Let the lease simply expire and rely on the resource-side fence to reject the stale write",
          instead: "Have the worker watch its own lease and abort mid-function the instant it is revoked.",
          decider:
            "Whether a frozen process can run its own abort code. A 35s stop-the-world pause freezes every thread, the watch callback included, so self-detection is unavailable during exactly the failure that matters; the only party still running when the stale write lands is the resource itself.",
          flips:
            "Pauses caused by blocked I/O rather than a frozen runtime, where a watch thread keeps scheduling and can genuinely cancel the pending write before it is sent.",
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
        numbers: ["acquires at t=22", "token 34", "1 write accepted, fence_token 34"],
        breaks:
          "Its correct write is the one that gets silently overwritten if the resource does not fence, so the visible symptom is corruption attributed to B rather than to A.",
        choice: {
          pick: "Poll for the key with jittered backoff after a null acquire",
          instead: "Block on a server-side wait queue and be woken when the key frees.",
          decider:
            "Visibility against latency. A wait queue wakes the next holder in roughly one round trip, but hides queue depth inside the service; polling costs an extra request per attempt but leaves per-key contention visible as a metric the caller can act on.",
          flips:
            "A single hot key with many waiters, where the O(waiters) cost of everyone polling every interval genuinely dominates and a FIFO wait queue is worth the lost visibility.",
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
        numbers: ["~1k/s correctness", "~9k/s best effort", "~10k/s total, 100k/s at peak"],
        breaks:
          "A call site that quietly reclassifies itself. Someone moves ledger posting onto the best-effort path for latency, and nothing fails until a failover hands the same key to two workers.",
        choice: {
          pick: "Two lock classes on two backends, chosen per call site",
          instead: "One backend for everything, Redis, with fencing bolted on by an INCR counter as the token.",
          decider:
            "Acquire rate against the consensus write ceiling, crossed with what a duplicate holder costs. Correctness traffic is 1k acquires/s steady and 10k/s at peak, and each acquire is paired with a release, so 20k writes/s at peak against etcd's 10k to 30k ceiling, about 68%, which one cluster carries. Best-effort traffic is 9k/s steady and 90k/s at peak, which it does not.",
          flips:
            "Nothing you lock is correctness-critical, or there is no consensus store in the organisation and no appetite to operate one. Then take Redis plus INCR plus a resource-side fence and write the failover gap down as a known exposure, which is strictly better than Redis with no fence.",
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
        why: "Majority commit is what stops two grants for the same key being recorded across a leader change or a partition. It is also what gives the log a single agreed order, which is where the fencing token comes from, so the two properties are bought together.",
        numbers: ["10k to 30k writes/s ceiling", "acquire 1 to 10ms, p99 20 to 30ms", "2.3k writes/s steady"],
        breaks:
          "Losing majority stops acquires entirely. That is the correct behaviour for correctness locks, so work stops rather than forking, but it is a full outage of the lock path.",
        choice: {
          pick: "etcd, 3 nodes, lease plus keep-alive",
          instead: "ZooKeeper with ephemeral znodes tied to the client session.",
          decider:
            "Operational preference, not a design fork: both require a majority to agree before acknowledging, and both expose a log position usable as a token. ZooKeeper earns the pick when contention matters, because ephemeral-sequential nodes with predecessor-only watches make the wake cost per release O(1) rather than O(waiters).",
          flips:
            "Heavy contention on single keys where you want a fair FIFO queue for free, or an estate that already runs ZooKeeper for something else and will not operate a second coordination store.",
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
        numbers: ["TTL 30s, renew every 10s", "3,000 concurrent long holders", "300 renewals/s, ~13% of steady load"],
        breaks:
          "Synchronised renewal is a self-inflicted write spike through the leader's log, and a renewal missed to a GC pause silently converts a healthy holder into an expired one.",
        choice: {
          pick: "30s TTL renewed at TTL/3, jittered into [TTL/4, TTL/2]",
          instead: "A long TTL with no renewal, or a short TTL renewed aggressively.",
          decider:
            "Renewal load against pause tolerance. At 3,000 concurrent long holders renewing once per 10s that is 300 renewals/s, about 13% of steady consensus load, so renewal is affordable here; at 100k long holders it would be 10k/s and would dominate. A long TTL instead leaves a crashed holder's key wedged for the whole TTL.",
          flips:
            "ZooKeeper, where the lock is an ephemeral znode bound to the client session and there is no explicit TTL to size or renew at all.",
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
        why: "It is the one thing the lock service produces that the resource can check. It has to come from something that already has a single agreed order, and a renewal deliberately does not mint a new one, or an in-flight write from the correct holder would be rejected by your own fence.",
        numbers: ["1 strictly increasing value per key", "0 new tokens minted on renewal"],
        breaks:
          "A token minted anywhere other than the log. A separate counter service is a second consensus problem, and a counter that resets or lags on failover fences out the wrong writer.",
        choice: {
          pick: "The consensus log position: etcd mod_revision or ZooKeeper czxid",
          instead: "A dedicated counter service, or Redis INCR.",
          decider:
            "Whether monotonicity survives failover. In a 3 node Raft log every committed grant sits at a higher index than every previous one, globally, so monotonicity is a property of the log rather than code someone wrote. Redis INCR is genuinely monotonic within one instance's lifetime and fails only across a failover to a replica whose counter lagged, which is the exact moment you needed it.",
          flips:
            "Best-effort locks where the token is a debugging aid rather than a safety mechanism, or an estate with one Redis and no consensus store, where INCR plus a resource-side fence beats no fence at all.",
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
        why: "Sub-millisecond and one hop, against tens of milliseconds through a quorum. That 20x to 30x latency gap, not safety, is what pushes cache refills, cron dedupe and stampede collapse onto this tier, and none of them corrupt anything if two workers run.",
        numbers: ["~100k ops/s per instance", "90k/s peak sharded to 30k/s each", "sub-1ms acquire"],
        breaks:
          "Replication is asynchronous, so a primary that dies before replicating hands the same key to a second caller after failover. There is no log, so no token can be issued that is monotonic across that failover.",
        choice: {
          pick: "Sharded single-instance Redis SETNX for best-effort locks only",
          instead: "Redlock, acquiring the same key on a majority of 5 independent Redis masters.",
          decider:
            "Whether you need a fencing token, and whether you will depend on a wall-clock drift bound. Redlock's reference specification allows 1% of the TTL for drift, so 300ms on a 30s lease, and any NTP step or VM live migration larger than that breaks the bound. Five independent masters share no log, so there is no value they can agree is monotonic. Separately, 90k/s peak against a 100k/s ceiling is why this tier is 3 shards rather than one instance.",
          flips:
            "You already run several independent Redis instances, the locks are best-effort, and what you actually want is for the lock to survive one master dying. Redlock does deliver that, and it is wrong only when it is sold as safety.",
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
        why: "This is the only mechanism in the design that actually prevents corruption, because it is the only check performed by the party that sees both writes. Zero rows affected means fenced out, and the caller has to treat that as terminal rather than retrying into the same rejection.",
        numbers: ["one extra predicate", "zero extra round trips", "0 rows affected means fenced"],
        breaks:
          "It makes each write safe without making the critical section atomic. A holder that writes A, is fenced out, then fails on B leaves the resource half updated, and no token check can see that.",
        choice: {
          pick: "Single-statement compare-and-advance, enforced by the storage layer",
          instead: "Read max_seen_token, compare in application code, then write.",
          decider:
            "Where the process can pause. A read-then-write leaves a gap between the check and the write that a 35 second pause fits inside comfortably, which is the exact race the fence exists to close, so the comparison has to sit inside the store's atomic unit. Enforcement placement matters just as much: 1 nightly batch job that never heard of the lock voids a client-enforced fence with no signal anywhere.",
          flips:
            "Object storage, where S3 conditional writes give compare-and-swap on the ETag directly (If-None-Match from August 2024, If-Match from November 2024) and there is no separate token column to maintain.",
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
        why: "The counter belongs to the protected object, not to the lock, because the object is what both writers touch. That is also what makes fencing composable with optimistic concurrency: both are a monotonic check at the last hop, differing only in who mints the number.",
        numbers: ["~200 B per active lock record", "one counter per protected object", "one lock key to one object"],
        breaks:
          "Fencing moves the serialisation point onto the object. For a per-order row that is free; for a single global object every write now contends on the same counter, which is the hot lock wearing a different hat.",
        choice: {
          pick: "A fence_token column on the object, one lock key to one object",
          instead: "One counter per lock key, or a shared max_seen table.",
          decider:
            "Partial fencing and false rejects. If one lock key guards 3 rows, all 3 carry the column and take the same token in the same transaction, or a partially fenced writer updates some and not others. And an object guarded by lock A on Monday and lock B on Tuesday sees 2 independent sequences, so the lower one is refused for no good reason.",
          flips:
            "A store with native conditional writes on a version or ETag, where the existing concurrency primitive already is the counter and a second column adds nothing.",
        },
      },
    }
  ],
  edges: [
    {
      id: "e1",
      from: "worker-a",
      to: "router",
      tier: "hot",
      label: "acquire(key, ttl=30s)",
      detail: {
        what: "The acquire call, carrying the lock key and the TTL the caller wants.",
        why: "The API is deliberately three calls, acquire, release and renew, because anything richer tempts callers into holding state the service cannot verify. The TTL is passed per call because a 2 second ledger post and a 60 second batch step want very different expiries.",
        numbers: ["3 calls: acquire, release, renew", "1 TTL argument passed per call"],
        breaks:
          "A caller that sizes the TTL against expected work rather than worst-case pause gets expired mid-section routinely, which is survivable only because the fence exists.",
      },
    },
    {
      id: "e2",
      from: "router",
      to: "etcd",
      tier: "hot",
      label: "correctness lock",
      detail: {
        what: "Correctness-critical acquires being sent to the consensus cluster, where each one costs a majority commit.",
        why: "This is the path that money movement, ledger posting and state-machine transitions take, and it is the only path that returns a token. It is routed by call site rather than by load, because the routing decision is about what a duplicate holder costs, not about throughput.",
        numbers: ["~1k acquires/s steady", "10k/s at peak", "1 to 10ms per acquire"],
        breaks:
          "The spike is a release storm, not organic growth: a fleet-wide deploy makes every holder reacquire at once, which is 20k writes/s and 68% of ceiling arriving in one second.",
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
        numbers: ["~9k/s steady, 90k/s peak", "sharded by key hash across 3 instances", "sub-1ms"],
        breaks:
          "Nothing here survives a failover: the replica promoted after an async gap has never heard of the grant and will hand the same key straight to a second caller.",
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
        numbers: [ "1 wait-queue depth metric tracked per key"],
        breaks:
          "Redis SETNX has no queue at all, so everyone polls and an arbitrary poller wins, leaving wait times unbounded for the unlucky.",
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
        why: "Binding the key to a lease rather than writing an expiry into the value is what makes release automatic: when the lease is revoked or expires, the key attached to it disappears without anyone having to run cleanup.",
        numbers: ["TTL 30s", "1 key tied to 1 lease; dies with it"],
        breaks:
          "A holder that crashes between acquiring and starting work still holds the key for the full TTL, so TTL directly bounds how long a dead holder blocks everyone else.",
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
        why: "Nothing is computed here, which is the point. The number already exists as a consequence of committing to the log, so its monotonicity is inherited rather than implemented and there is no counter to get wrong on failover.",
        breaks:
          "Systems without a shared log cannot supply this edge at all, which is exactly why a resource-side fence cannot be retrofitted onto Redlock.",
      },
    },
    {
      id: "e7",
      from: "fence-token",
      to: "worker-a",
      tier: "hot",
      label: "granted, token 33",
      offset: 60,
      detail: {
        what: "The first grant returning to Worker A: ownership of the key plus token 33.",
        why: "The token travels back to the client because the client is what will attach it to every write. This is the moment ownership becomes something a third party can verify, rather than something only the lock service knows.",
        numbers: ["token 33", "1 lease created here, TTL 30s"],
        breaks:
          "This is the last notification A ever gets. Nothing tells it when the lease expires, so from here on its belief about ownership is a memory of the past.",
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
        numbers: ["renew every 10s", "jitter into [TTL/4, TTL/2]", "300 renewals/s at our numbers"],
        breaks:
          "The renewal thread lives inside the process it is renewing for, so a stop-the-world pause freezes the renewal along with the work, and the lease expires with nobody noticing.",
      },
    },
    {
      id: "e9",
      from: "fence-token",
      to: "worker-b",
      fromSide: "right",
      toSide: "bottom",
      tier: "hot",
      label: "granted, token 34",
      offset: 100,
      detail: {
        what: "The second grant, issued after A's lease expired, carrying token 34.",
        why: "The lock service is behaving correctly at this instant: the previous lease is gone, so the key is free. That correctness is precisely what makes the situation dangerous, because there are now two live processes that each believe they hold the key.",
        numbers: ["token 34", "issued at t=22", "33 is never reissued"],
        breaks:
          "Nothing in this hop can tell whether A is dead or merely frozen, and no amount of extra caution here would help, because the distinction is unobservable from the service.",
      },
    },
    {
      id: "e10",
      from: "worker-b",
      to: "fence-check",
      tier: "hot",
      label: "write, fence=34",
      offset: 90,
      detail: {
        what: "The legitimate write, carrying token 34 in the same statement as the data.",
        why: "The token rides with the payload rather than being presented separately, because a separate authorisation step reopens the gap: the process can pause between being authorised and writing.",
        numbers: ["token 34 beats max_seen 33", "one statement"],
        breaks:
          "If B holds a lock guarding 3 rows and writes them in 3 statements, only the ones written before it is fenced land, so the token has to be applied to all of them in one transaction.",
      },
    },
    {
      id: "e11",
      from: "worker-a",
      to: "fence-check",
      label: "stale write 33: fenced out",
      tier: "hot",
      offset: 110,
      detail: {
        what: "The late write from the resumed holder, carrying the token it was granted before its lease expired.",
        why: "This arrow is the whole question. It is issued by a process that is running correct code, following the protocol, and holding a token it was legitimately given, which is why no client-side discipline can prevent it.",
        numbers: ["token 33", "issued at t=35", "max_seen is already 34"],
        breaks:
          "Without a check at the far end this write commits and silently replaces fresher data, and nothing anywhere logs an error.",
      },
    },
    {
      id: "e12",
      from: "fence-check",
      to: "resource",
      tier: "hot",
      label: "commit, max_seen = 34",
      detail: {
        what: "The accepted write landing, advancing the row's stored token to the one that just won.",
        why: "Compare and advance happen in the same atomic unit as the data write, so there is no instant at which the row has accepted the payload but not yet recorded the token that authorised it.",
        numbers: ["1 extra predicate", "1 extra column write", "0 extra round trips"],
        breaks:
          "The cost of fencing is organisational rather than computational: this predicate is trivial, and the difficulty is getting every writer to the row to carry a token at all.",
      },
    }
  ],
};
