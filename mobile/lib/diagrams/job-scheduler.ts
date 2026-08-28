import type { Diagram } from "./types";

export const JOB_SCHEDULER: Diagram = {
  id: "job-scheduler",
  title: "Job Scheduler",
  question: "Design a Distributed Job Scheduler / Cron",
  sourceId: "patterns",
  itemId: 36,
  overview: {
    shape:
      "A scheduler manufactures its own input: a leader ticks the calendar, materialises every due occurrence as a run row keyed on (job_id, scheduled_at), and everything downstream of that row is ordinary at-least-once queue-and-worker plumbing.",
    beats: [
      "Definitions land in a transactional store holding a cron line, a timezone, a payload pointer and a next_run_at. Registration is also where a stable jitter offset derived from hash(job_id) is attached, because the cron line the user typed will be read back later and has to still say midnight.",
      "The tick is the product. One elected leader per shard reads next_run_at <= NOW() every 30 seconds and, per due job, runs a single transaction: insert the run row ON CONFLICT DO NOTHING and advance next_run_at guarded on its old value. Both or neither, because splitting them gives you either a silent skip or a silent hang.",
      "Leader election is a load optimisation, not the correctness mechanism, which inverts how this design is usually presented. Two schedulers that both believe they lead produce one run row and one wasted transaction, because the unique constraint on the calendar tuple has already settled identity. The lease only stops you paying N times the write load.",
      "The row commits, then it publishes, never the reverse. Committing first leaves the recoverable failure, a QUEUED row with no queue message, which a sweeper republishes after 60 seconds. Publishing first leaves a run in a worker's hands with no record to write status against, and there is no clean way to reconcile that afterwards.",
      "Workers pull, take an advisory lease on the same tuple, heartbeat every 30 seconds against a 90 second TTL, execute, and compare-and-set the terminal status on (run_id, attempt). The lease deduplicates the common case and cannot do more than that, so the job's own ledger is what actually protects reality.",
      "Three guarantees, and the whole answer is refusing to collapse them: exactly one run record per calendar occurrence, at least one execution attempt per record, at most one accepted completion. Exactly-once execution is not on that list, because the last thing a job does is talk to a system you do not control.",
    ],
    crux:
      "Exactly-once execution is not on offer and the design has to say so out loud. The decision can be exactly-once, because a unique constraint on (job_id, scheduled_at) settles what counts as the same fire, but the execution ends in somebody else's system, so what you actually build is idempotent at-least-once. The second half is worse: the failure mode of a scheduler is silence, since a run that never fired raises no error, consumes no capacity and leaves no row.",
    numbers: [
      "10M definitions, ~40M runs/day, ~460 runs/s steady",
      "2.5M due at 00:00:00, ~4,200/s after a plus or minus 5 minute jitter",
      "8,400 writes/s at peak against a primary that does 10-20k",
      "~670 interrupted runs/day, about 1 in 60,000",
    ],
  },
  nodes: [
    {
      id: "execution",
      label: "Execution plane: at-least-once",
      kind: "zone",
      x: 24,
      y: 404,
      w: 672,
      h: 218,
      detail: {
        what: "Everything below the run record: the worker pool, the advisory lease, and the external systems a job mutates.",
        why: "Drawn as a zone because the guarantee changes here. Above the line the design owns identity and can be exactly-once about the decision; below it, work is retried, redelivered and occasionally duplicated, and the only defence is the job being idempotent on (job_id, scheduled_at).",
        numbers: ["~300k concurrent runs at peak", "~670 interrupted runs/day"],
        breaks:
          "Candidates spend the interview in this box, on the worker pool and the retry policy, which is the easy half that any queue-and-worker system already solves.",
      },
    },
    {
      id: "registration",
      label: "Registration API",
      sub: "cron, tz, jitter, catch_up",
      kind: "service",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The write path for definitions: cron expression or run_at, timezone, payload pointer, retry policy, catch-up policy, DAG parents and the jitter window.",
        why: "Two properties that decide the whole system's behaviour are set here and nowhere else: the stable per-job jitter offset, and whether the job is at-least-once or at-most-once. Both have to be declared at registration because nothing outside the job can infer them later.",
        numbers: ["~1KB per definition, 10M definitions = 10GB", "70% recurring, 30% one-shot"],
        breaks:
          "A catch_up=run_all job whose entrypoint ignores scheduled_at replays with today's data and silently produces a different answer from the one that was missed, so it has to be refused here rather than detected downstream.",
        choice: {
          pick: "Stable jitter from hash(job_id) inside a configurable window, applied at registration",
          instead: "Fire exactly on the cron boundary and absorb the burst with worker capacity.",
          decider:
            "2.5M runs come due at 00:00:00 (840k hourly plus 1.68M midnight-daily). Spread over a plus or minus 5 minute window that is ~4,200 runs/s, which one primary can commit and one queue can take; unjittered it is 2.5M in a single second and no amount of fleet fixes the downstream systems those jobs hit.",
          flips:
            "Jobs whose boundary is real opt out explicitly and pay the burst: an end-of-day cut at 16:30:00 where a run 200ms early excludes a trade that belongs in the file.",
        },
      },
    },
    {
      id: "jobs-db",
      label: "Jobs store",
      sub: "Postgres, sharded hash(job_id)",
      kind: "database",
      x: 440,
      y: 0,
      w: 240,
      detail: {
        what: "Source of truth for what should run: cron expression, timezone, payload pointer, retry policy, DAG parents, next_run_at, shard and state.",
        why: "The tick is a write transaction against this store, and it is deliberately separate from run history: 10GB of slowly changing definitions and 20GB a day of append-only attempts share nothing except a job id, and have completely different retention.",
        numbers: ["10M x 1KB = 10GB, ~30GB at RF=3", "8,400 writes/s at peak, 10-20k capacity"],
        breaks:
          "Failing the tick over to a read replica. The tick is a write transaction, and a stale read re-emits jobs whose next_run_at has already advanced.",
        choice: {
          pick: "One Postgres primary per shard, sharded by hash(job_id)",
          instead: "One unsharded primary, or moving definitions into the wide-column store that already holds run history.",
          decider:
            "The write rate, not the read. The next_run_at <= NOW() scan is an index range scan returning only due rows and is cheap; what saturates is two write ops per fire, so 4,200 fires/s is 8,400 writes/s against a primary that does 10k to 20k. Capacity never binds: the whole table is 10GB.",
          flips:
            "Below roughly 1k fires/s a single unsharded primary carries everything, and one datastore is easier to back up consistently and to reason about transactionally.",
        },
      },
    },
    {
      id: "scheduler",
      label: "Scheduler tick",
      sub: "leader per shard, 30s tick",
      kind: "service",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "A leader-elected process that polls the jobs store for next_run_at <= NOW() and materialises one run record per due occurrence. It never executes a job.",
        why: "Separating the decision from the work is what gives leases, retries, dependency resolution and audit a single artifact to key on. Fold execution into the ticker and there is no object for a retry to attach to, which is why mixing them makes failure handling so much harder.",
        numbers: ["30s tick, LIMIT 10000 per shard", "4,200 fires/s in the midnight window"],
        breaks:
          "Splitting the run insert and the next_run_at advance into two transactions. Advance first and crash and the occurrence is skipped forever with no error anywhere; insert first and crash and every later tick re-reads the same due row, hits the conflict and the job appears to hang.",
        choice: {
          pick: "One elected leader per shard evaluating the calendar on a fixed tick",
          instead: "No scheduler process: every worker evaluates the calendar against its own clock and races to insert the run row.",
          decider:
            "How much clock skew the tightest job tolerates. Against a plus or minus 60 second fire-delay SLO, a fleet drifting 50ms on the public NTP pool is fine and the leaderless design is simpler. Against a job that must snapshot at 09:30:00 within 100ms, one disciplined clock beats a thousand approximately-agreeing ones.",
          flips:
            "Small fleets, per-tenant deployments, or infrastructure with no reliable coordination primitive. The cost is that nobody can answer what is due right now from one place any more.",
        },
      },
    },
    {
      id: "coordination",
      label: "Coordination lease",
      sub: "15-30s TTL, standby takeover",
      kind: "database",
      x: 440,
      y: 110,
      w: 240,
      detail: {
        what: "The lease deciding which scheduler replica ticks a shard, with standbys that take over inside one tick interval.",
        why: "It exists to stop N schedulers doing the same work, not to make the work correct. The unique constraint on the calendar tuple already guarantees one run record whatever the leadership situation, so nothing else in the design is allowed to depend on this lease being right.",
        numbers: ["15-30s TTL", "failover lands inside one 30s tick"],
        breaks:
          "A leadership flap is a load incident, not a correctness one: a second leader at 4,200 fires/s doubles the pressure on a store already at 8,400 writes/s, which is how an election problem becomes a database outage.",
        choice: {
          pick: "A 15 to 30 second coordination lease that nothing depends on being correct",
          instead: "Treating a consensus-backed lock as the mechanism that prevents duplicate fires.",
          decider:
            "The unique constraint already makes double-ticking harmless, so election only buys load: two leaders cost one wasted transaction per job and N-1 discarded envelopes. 15 to 30 seconds is short enough that failover lands inside one 30s tick and long enough that a GC pause does not thrash leadership.",
          flips:
            "Never for correctness. With no coordination service at all, drop the leader entirely and let every replica tick, accepting N times the write load as the price.",
        },
      },
    },
    {
      id: "runs-db",
      label: "Run records + history",
      sub: "unique on (job_id, scheduled_at)",
      kind: "database",
      x: 440,
      y: 210,
      w: 240,
      detail: {
        what: "One row per attempt: run_id, status, attempt, start, end, worker and error snippet, with run identity unique on (job_id, scheduled_at).",
        why: "That tuple is the entire exactly-once story for the decision. scheduled_at is the occurrence computed from the cron expression, never now() at the moment of firing, so identity survives a retried tick, a leader change, a clock 400ms fast and an envelope redelivered four minutes later.",
        numbers: ["~500B per run, 40M/day = 20GB/day raw", "~1.8TB hot at 90 days retention"],
        breaks:
          "Naive local-time evaluation. Local 02:30 happens twice on the fall-back Sunday, so two genuinely different fires collide on one key unless occurrences are computed in UTC against a current tz database.",
        choice: {
          pick: "A wide-column store keyed on (job_id, scheduled_at), append-only per attempt",
          instead: "Keeping run history alongside the definitions in the transactional store.",
          decider:
            "Volume and retention. 40M runs a day at ~500B is 20GB/day raw and ~1.8TB hot at 90 days, against 10GB total for every definition. This is the only component in the design with real volume.",
          flips:
            "A scheduler doing thousands rather than tens of millions of runs a day, where one Postgres holds both and the tick transaction covers the run insert and the next_run_at advance with no cross-store reasoning at all.",
        },
      },
    },
    {
      id: "queue",
      label: "Durable job queue",
      sub: "partitioned log, 24h retention",
      kind: "queue",
      x: 40,
      y: 290,
      w: 280,
      detail: {
        what: "The hand-off between scheduler and workers, carrying a ~1KB envelope per run record.",
        why: "It decouples scheduling throughput from execution throughput and absorbs the top-of-hour burst. If every worker is down at 02:00 the run records sit here and drain when workers recover, rather than the fire being lost.",
        numbers: ["460/s steady, 10k/s design peak", "~1TB retention absorbs a 24h stall at peak"],
        breaks:
          "No backpressure. When workers stall a naive scheduler keeps emitting, overruns retention and loses the head of the backlog, which is the oldest work and the most likely to matter.",
        choice: {
          pick: "A partitioned durable log between scheduler and workers, published after the row commits",
          instead: "No queue: workers poll a claim table with SELECT ... FOR UPDATE SKIP LOCKED, so the run record and the claim are the same row.",
          decider:
            "Sustained dispatch rate against polling cost. A claim table holds roughly 1k dispatches/s and a couple of hundred pollers before empty polls dominate and the head of the next_run_at index becomes a lock-contention point. The midnight window is 4,200/s across a fleet that autoscales past 1,000 workers.",
          flips:
            "Below about 1k/s with a fleet under a few hundred, which describes most schedulers in production. One datastore and one transaction removes the commit-versus-publish ordering hazard and the sweeper entirely.",
        },
      },
    },
    {
      id: "sweeper",
      label: "Publish sweeper",
      sub: "QUEUED > 60s, republish",
      kind: "service",
      x: 440,
      y: 310,
      w: 240,
      detail: {
        what: "A scan for run rows still in QUEUED after 60 seconds with no recorded publish receipt, which it republishes to the queue.",
        why: "Choosing a broker introduced a second durable system that can disagree with the first, and this is the component that reconciles them. It is the honest cost of that decision, drawn rather than hidden.",
        numbers: ["60s threshold", "makes queue delivery at-least-once by construction"],
        breaks:
          "It cannot tell lost from merely slow, so it is a duplicate source by design; the lease absorbs the common case and the job's ledger absorbs the rest.",
        choice: {
          pick: "Commit the row, then publish, and sweep the gap after 60 seconds",
          instead: "Publishing inside the tick transaction, via two-phase commit or a transactional outbox.",
          decider:
            "The direction of the failure, not its probability. Commit-then-publish leaves a QUEUED row with no message, which a 60 second scan repairs. Publish-then-commit leaves a run in a worker's hands with no row, and the status write then has nothing to write to.",
          flips:
            "The claim-table design, where the run record and the claim are one row in one transaction and there is nothing to reconcile, so the sweeper does not need to exist.",
        },
      },
    },
    {
      id: "workers",
      label: "Worker pool",
      sub: "pull, lease, execute, heartbeat",
      kind: "service",
      x: 40,
      y: 420,
      w: 280,
      detail: {
        what: "Stateless processes that pull a run record, take the lease, execute, heartbeat, and compare-and-set a terminal status.",
        why: "This is the easy half and deliberately ordinary at-least-once work that any queue-and-worker system already knows how to do. Statelessness is the point: any worker is replaceable mid-flight, which is what makes reclaim a bounded 90 second operation.",
        numbers: ["~300k concurrent runs at peak, 14k steady", "~670 interrupted runs/day, ~1 in 60,000"],
        breaks:
          "The worker that stalls rather than crashes. A GC pause or a partition to the lease store expires the TTL while the process is alive and still holding connections open, so two live workers execute the same occurrence.",
        choice: {
          pick: "At-least-once execution with idempotency owned by the job, normally a ledger row on (job_id, scheduled_at)",
          instead: "At-most-once: mark the run attempted before executing, never auto-retry, and turn every interruption into a page.",
          decider:
            "Whether the side effect can carry a deduplication key the receiver honours. If it can, the ~670 interrupted runs a day (1 in 60,000) are absorbed silently. If it cannot, at-least-once converts those 670 into 670 genuine duplicates a day.",
          flips:
            "A side effect that is externally visible and cannot be deduplicated, where a duplicate is worse than a gap: a duplicated 10,000 share buy at the open, or a settlement file dropped twice on a counterparty's SFTP endpoint. This is a per-job attribute declared at registration, not a system-wide mode.",
        },
      },
    },
    {
      id: "lease",
      label: "Lease store",
      sub: "Redis SETNX, 90s TTL",
      kind: "database",
      x: 440,
      y: 420,
      w: 240,
      detail: {
        what: "lease:{job_id}:{scheduled_at} mapped to a worker_id with a TTL, renewed by a heartbeat every 30 seconds.",
        why: "It deduplicates the common case cheaply and bounds reclaim: a crashed worker's run is claimable again within 90 seconds instead of stalling every dependent DAG task behind it forever.",
        numbers: ["300k leases x 200B = ~60MB", "30s heartbeat against a 90s TTL", "a 4h backfill renews ~160 times"],
        breaks:
          "It is a hint, not a lock. Any 90 second blip to the lease store loses a perfectly healthy job's lease, and the TTL expiring does nothing to stop the original process continuing.",
        choice: {
          pick: "An in-memory store with TTLs, treated as advisory",
          instead: "A fenced lock where the protected resource rejects writes below a monotonic token, or a database row lock held for the run.",
          decider:
            "300k concurrent leases at 200B is 60MB, so this fits one node with room to spare, and no TTL lease can stop a stalled worker regardless of how it is implemented. Given correctness has to come from the job's ledger either way, buy the cheap deduplication rather than the expensive one.",
          flips:
            "When the resource being mutated can check a fence token, at which point fencing genuinely prevents the two-live-workers case instead of merely making it rare.",
        },
      },
    },
    {
      id: "target",
      label: "External systems",
      sub: "warehouse, object store, APIs",
      kind: "external",
      x: 440,
      y: 530,
      w: 240,
      detail: {
        what: "Whatever the job actually mutates: a data warehouse, object storage, an email API, a counterparty endpoint.",
        why: "It is drawn because it is the reason exactly-once is off the table. The last thing a job does is change a system outside this design, and the only defence is an idempotency key derived from the run tuple that the receiver agrees to honour.",
        numbers: ["idempotency key = (job_id, scheduled_at)"],
        breaks:
          "Jitter spreads fires in time but is blind to contention: 200 jobs spread over a 10 minute window that all query the same warehouse still queue behind each other, and the scheduler sees a healthy dispatch rate the whole time.",
      },
    },
    {
      id: "dlq",
      label: "Dead letter + alerting",
      sub: "bounded retries, page once",
      kind: "queue",
      x: 40,
      y: 630,
      w: 280,
      detail: {
        what: "Where a run lands once its retry budget is exhausted, and the one place on-call is paged from.",
        why: "Retries have to be bounded or a wedged job blocks its entire DAG. Dependents are marked SKIPPED with a parent_failed reason rather than queued indefinitely, so a broken parent produces one alert instead of one per dependent.",
        numbers: ["DAGs of hundreds of tasks, p99 ~1k", "alert on exhaustion, not per attempt"],
        breaks:
          "Sudden dead-letter growth usually means a downstream dependency broke rather than the scheduler, so paging on it without the dependency context sends on-call to the wrong system.",
        choice: {
          pick: "Exponential backoff up to a bounded max_retries, then dead-letter and one alert",
          instead: "Retrying indefinitely, or alerting on every failed attempt.",
          decider:
            "Whether the failure is transient. Backoff absorbs transient ones; past the bound more attempts only multiply load on whatever is already broken, and per-attempt alerting on a DAG of hundreds of tasks (p99 ~1k) buries the one signal that mattered.",
          flips:
            "At-most-once jobs, which never auto-retry at all: an interruption goes straight to a page and a human decides whether to re-run it.",
        },
      },
    },
    {
      id: "watchdog",
      label: "Missing-run watchdog",
      sub: "declared cadence, grace window",
      kind: "service",
      x: 440,
      y: 630,
      w: 240,
      detail: {
        what: "A separate check that every job with a declared expected cadence actually produced a run inside its grace window.",
        why: "It is the only thing in the design that can detect absence. Every other signal is derived from work that happened, and a run that never fired is work that did not, so it has to be inferred from an independent model of what should have occurred.",
        numbers: ["fire delay SLO p99 under 60s", "tick lag pages above 5x the tick interval"],
        breaks:
          "It shares our jobs store, our clock and our tz database, so exactly the bugs most likely to cause a silent miss (a bad tz rollout, a shard whose leader never took over, a next_run_at advanced without an insert) blind the detector too.",
        choice: {
          pick: "Per-job declared cadence plus a watchdog alerting when a fire does not appear in its grace window",
          instead: "Relying on run failures and dead-letter growth to surface problems.",
          decider:
            "Absence has no signal. A missing run errors nowhere, consumes no capacity and leaves no row, so all 6 of the normal SLOs (tick lag, fire delay p99 under 60s, dead-letter growth, lease-acquire ratio and the rest) stay green while a 02:00 batch silently never happened.",
          flips:
            "Nothing replaces it, and this build is honestly weak: a genuinely independent check runs on a different stack against a different replica with its own external liveness proof, and we have not built that.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "registration",
      to: "jobs-db",
      label: "definition + stable jitter",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A new or updated definition written to the jobs store, with its first next_run_at and its jitter offset already computed.",
        why: "The offset is fixed at registration rather than at fire time so it is stable: the same job always lands at the same place in the window, which keeps the schedule predictable across restarts and leader changes.",
        numbers: ["offset = hash(job_id) inside the window"],
        breaks:
          "A job that inherits jitter without opting out now means within 5 minutes of midnight rather than midnight, which has to be documented rather than discovered by whoever reads the cron line back.",
      },
    },
    {
      id: "e2",
      from: "scheduler",
      to: "jobs-db",
      label: "due scan + tick txn",
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "The tick: read due rows, then per job one transaction that inserts the run row ON CONFLICT DO NOTHING and advances next_run_at guarded on its previous value.",
        why: "Both writes or neither. The guard on the old value is what makes two concurrent leaders safe: the loser's update matches zero rows and its insert conflicts, so it knows it did nothing rather than assuming it won.",
        numbers: ["LIMIT 10000 per tick", "two write ops per fire, 8,400/s at peak"],
        breaks:
          "If the store is unavailable the tick simply does not run. Nothing is lost, because next_run_at never advanced, but the catch-up policy then has to decide on recovery whether to replay the missed occurrences.",
      },
    },
    {
      id: "e3",
      from: "scheduler",
      to: "coordination",
      label: "leader lease, 15-30s TTL",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Acquiring and renewing the per-shard leadership lease, and watching the key so a standby takes over promptly.",
        why: "Drawn as a control path because nothing correctness-bearing travels on it. Its only job is keeping the number of ticking schedulers at one, which is a cost decision rather than a safety one.",
        numbers: ["15-30s TTL, failover inside one tick"],
        breaks:
          "A scheduler that wrongly believes it still leads does no damage at all, and that being true is the test of whether the rest of the design is right.",
      },
    },
    {
      id: "e4",
      from: "scheduler",
      to: "runs-db",
      label: "run row, ON CONFLICT",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The materialised run record: (job_id, scheduled_at, run_id, attempt=1, status=QUEUED), under a unique constraint.",
        why: "This row is the artifact everything else attaches to. Once it exists, every component downstream can ask whether two things are the same fire and get the same answer, which is what makes retries, leases and audit tractable.",
        numbers: ["one row per calendar occurrence"],
        breaks:
          "Identity taken from now() instead of the computed occurrence would let two schedulers 50ms apart create two identities for one fire, and the unique constraint would happily accept both.",
      },
    },
    {
      id: "e5",
      from: "scheduler",
      to: "queue",
      label: "publish after commit",
      animated: true,
      detail: {
        what: "The run envelope published to the durable queue, strictly after the transaction that created the row has committed.",
        why: "Ordering is the entire point of this arrow. Publish first and crash and there is a run on the queue and in a worker's hands with no record to write status against, which cannot be reconciled afterwards.",
        numbers: ["~1KB envelope", "460/s steady, 4,200/s at midnight"],
        breaks:
          "The gap between commit and publish is real: a crash there leaves a QUEUED row with no message, and the sweeper exists solely to cover it.",
      },
    },
    {
      id: "e6",
      from: "queue",
      to: "workers",
      label: "pull run record",
      animated: true,
      detail: {
        what: "A worker pulling the next run envelope from its partition.",
        why: "Pull rather than push means execution capacity sets the rate, so the midnight burst queues rather than knocking the fleet over, and scheduling throughput stays independent of execution throughput.",
        numbers: ["10k/s design peak"],
        breaks:
          "Redelivery is normal here, so a worker can never assume it is the first to see this envelope; the lease and the job's ledger are what make that assumption unnecessary.",
      },
    },
    {
      id: "e7",
      from: "workers",
      to: "lease",
      label: "SETNX + 30s heartbeat",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "An atomic set-if-not-exists on lease:{job_id}:{scheduled_at} with a TTL, then a heartbeat every 30 seconds to extend it.",
        why: "One atomic claim per occurrence keeps two workers off the same run in the common case, and the TTL is what makes a dead worker's run reclaimable rather than stuck behind a process that will never return.",
        numbers: ["90s TTL, 30s heartbeat"],
        breaks:
          "The TTL expires on a stalled process just as readily as on a dead one, and the stalled process still holds open connections to whatever it was mutating.",
      },
    },
    {
      id: "e8",
      from: "workers",
      to: "target",
      label: "side effect + idem key",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The actual work: writing to the warehouse, dropping a file, calling an API, carrying an idempotency key derived from (job_id, scheduled_at).",
        why: "This is the arrow that makes exactly-once impossible, and the key is the only defence. Keying on the tuple rather than the attempt is what makes a stalled worker and its replacement collide in the ledger instead of both taking effect.",
        numbers: ["key = (job_id, scheduled_at), not the attempt"],
        breaks:
          "A receiver that does not honour the key turns ~670 interrupted runs a day into 670 genuine duplicates, at which point that job belongs in at-most-once mode instead.",
      },
    },
    {
      id: "e9",
      from: "workers",
      to: "runs-db",
      label: "CAS terminal status",
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "The terminal status written as a compare-and-set on (run_id, attempt) rather than a blind update.",
        why: "It keeps history coherent when two workers both believe they own the run: the stalled one's late SUCCEEDED is rejected. The compare-and-set protects the record, and only the job's own ledger protects reality.",
        numbers: ["at most one accepted completion per record"],
        breaks:
          "A blind update would let a worker whose lease expired 20 minutes ago overwrite the outcome of the attempt that actually finished.",
      },
    },
    {
      id: "e10",
      from: "runs-db",
      to: "sweeper",
      label: "QUEUED > 60s",
      dashed: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "A scan for run rows still in QUEUED after 60 seconds with no recorded publish receipt.",
        why: "It reconciles the two durable systems the queue introduced. Nothing else in the design can notice that a committed decision never became a message, because the run row on its own looks perfectly healthy.",
        numbers: ["60s threshold"],
        breaks:
          "Too short a threshold republishes runs that were merely slow to be picked up, adding duplicate work during exactly the busiest minute of the day.",
      },
    },
    {
      id: "e11",
      from: "sweeper",
      to: "queue",
      label: "republish lost runs",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Republishing the envelope for a committed run that never reached the queue.",
        why: "It makes delivery at-least-once by construction rather than by hope: a broker outage stops nothing permanently, because the rows are already committed and get republished when the broker returns.",
        numbers: ["nothing is lost, because the row committed first"],
        breaks:
          "It cannot distinguish lost from slow, so it is a duplicate source by design and leans entirely on the lease and the job's idempotency downstream.",
      },
    },
    {
      id: "e12",
      from: "workers",
      to: "queue",
      label: "retry, attempt+1",
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "A failed run going back onto the queue with attempt+1 and an exponential backoff delay.",
        why: "The run record already exists, so a retry is a new attempt against the same identity rather than a new fire. That is what keeps a retried job idempotent against the same ledger key in the external system.",
        numbers: ["same (job_id, scheduled_at), new attempt"],
        breaks:
          "Unbounded retries wedge the whole DAG and multiply load on whatever is already broken downstream, which is why the budget has to be finite.",
      },
    },
    {
      id: "e13",
      from: "workers",
      to: "dlq",
      label: "retries exhausted",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "A run past its retry budget routed to the dead letter, with dependent tasks marked SKIPPED and a parent_failed reason.",
        why: "One alert per exhausted job rather than one per attempt, and dependents fail fast instead of sitting queued behind something that is never going to succeed.",
        numbers: ["one page per exhaustion, not per attempt"],
        breaks:
          "Marking dependents SKIPPED loses the distinction between a task that failed and one that never ran, so the reason code has to carry it or the history becomes unreadable.",
      },
    },
    {
      id: "e14",
      from: "runs-db",
      to: "watchdog",
      label: "expected cadence check",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "The watchdog comparing the runs that exist against each job's declared expected cadence and grace window.",
        why: "Absence has no signal of its own, so it can only be inferred by asking a separate model of what should have happened. Nothing in the run store can volunteer a row that was never written.",
        numbers: ["per-job declared cadence, per-job grace window"],
        breaks:
          "It reads the same store, clock and tz database as the scheduler, so a bad tz rollout or a shard whose leader never took over hides from the detector and the detected alike.",
      },
    },
  ],
};
