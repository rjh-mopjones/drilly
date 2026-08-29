import type { Diagram } from "./types";

export const JOB_SCHEDULER: Diagram = {
  id: "job-scheduler",
  title: "Job Scheduler",
  question: "Design a Distributed Job Scheduler / Cron",
  sourceId: "patterns",
  itemId: 36,
  overview: {
    shape:
      "A scheduler manufactures its own input: a leader ticks the calendar, materialises every due occurrence as a run row, and everything downstream is ordinary at-least-once queue-and-worker plumbing.",
    forces: [
      {
        constraint: "2.5M runs come due at 00:00:00 in a single instant, unjittered",
        decision: "Registration attaches a stable per-job jitter offset from hash(job_id), spreading fires over a window",
        lights: ["registration", "e1"],
      },
      {
        constraint: "8,400 writes/s at peak against a primary that does 10-20k, two writes per fire",
        decision: "The tick's insert-and-advance runs as one transaction on Jobs store, guarded on next_run_at's old value",
        lights: ["scheduler", "jobs-db", "e2"],
      },
      {
        constraint: "A publish gap of even 1 second between commit and queue can leave a row with no message",
        decision: "The row commits, then it publishes, never the reverse, with a Publish sweeper covering the gap",
        lights: ["scheduler", "queue", "sweeper", "e5", "e10"],
      },
      {
        constraint: "1 external API call is the last thing a job does, in a system nobody here controls",
        decision: "Execution stays at-least-once, with idempotency owned by the job's own ledger on (job_id, scheduled_at)",
        lights: ["workers", "target", "e8"],
      },
      {
        constraint: "0 errors, 0 capacity used and 0 rows written is what a missed run looks like",
        decision: "A separate Missing-run watchdog checks declared cadence against a grace window",
        lights: ["watchdog", "e14"],
      },
    ],
    naive: {
      text: "Run every job's cron check inline on whichever server happens to be free, firing a job the instant its boundary is crossed, and let workers race to grab it. 2.5M jobs share a midnight boundary, so an unjittered fleet fires 2.5M times in the same second, and no worker fleet or downstream system survives that. Racing workers with no shared record of what has already fired also means two workers can both believe they are first to run a job. Nothing settles which attempt is authoritative. The scheduler instead materialises one run row per due occurrence under a unique constraint, and jitters each job's fire time from a stable per-job offset. Identity becomes a database constraint, not a race.",
      lights: ["scheduler", "runs-db", "registration"],
    },
    beats: [
      {
        text: "Definitions land in a transactional store holding a cron line, a timezone, a payload pointer and a next_run_at. Registration is also where a stable jitter offset derived from hash(job_id) is attached. The cron line the user typed will be read back later and has to still say midnight.",
        lights: ["registration", "jobs-db", "e1"],
      },
      {
        text: "The tick is the product. One elected leader per shard reads next_run_at against the current time every 30 seconds. Per due job it runs a single transaction: insert the run row, ignoring a duplicate key rather than erroring, and advance next_run_at guarded on its old value. Both or neither, because splitting them gives you either a silent skip or a silent hang.",
        lights: ["scheduler", "jobs-db", "runs-db", "e2", "e4"],
      },
      {
        text: "Leader election is a load optimisation, not the correctness mechanism, which inverts how this design is usually presented. Two schedulers that both believe they lead produce one run row and one wasted transaction, because the unique constraint on the calendar tuple has already settled identity. The lease only stops you paying N times the write load.",
        lights: ["scheduler", "coordination", "e3"],
      },
      {
        text: "The row commits, then it publishes, never the reverse. Committing first leaves the recoverable failure, a queued row with no queue message, which a sweeper republishes after 60 seconds. Publishing first leaves a run in a worker's hands with no record to write status against, and there is no clean way to reconcile that afterwards.",
        lights: ["scheduler", "queue", "sweeper", "e5", "e10", "e11"],
      },
      {
        text: "Workers pull, take an advisory lease on the same tuple, heartbeat every 30 seconds against a 90 second TTL, execute, and compare-and-set the terminal status on (run_id, attempt). The lease deduplicates the common case and cannot do more than that, so the job's own ledger is what actually protects reality.",
        lights: ["workers", "lease", "runs-db", "e6", "e7", "e9"],
      },
      {
        text: "Three guarantees, and the whole answer is refusing to collapse them: exactly one run record per calendar occurrence, at least one execution attempt per record, at most one accepted completion. Exactly-once execution is not on that list, because the last thing a job does is talk to a system you do not control.",
        lights: ["runs-db", "target", "e8", "e9"],
      },
    ],
    crux: {
      problem:
        "Exactly-once execution is not on offer. The decision can be exactly-once, because a unique constraint on (job_id, scheduled_at) settles what counts as the same fire, but the execution ends in somebody else's system. What you actually build is idempotent at-least-once.",
      handled:
        "The second half is worse: the failure mode of a scheduler is silence, since a run that never fired raises no error, consumes no capacity and leaves no row. The design answers with a Missing-run watchdog that checks declared cadence against a grace window, from an independent model of what should have happened. Nothing inside the normal pipeline can notice an absence on its own.",
    },
    numbers: [
      {
        value: "10M definitions, ~40M runs/day, ~460 runs/s steady",
        explain: "The baseline scale the whole system is provisioned against, at rest far below any of its peak numbers.",
      },
      {
        value: "2.5M due at 00:00:00, ~4,200/s after a plus or minus 5 minute jitter",
        explain: "The midnight collision and what spreading it over a jitter window reduces it to, the number that makes the write path survivable.",
      },
      {
        value: "8,400 writes/s at peak against a primary that does 10-20k",
        explain: "The tick's actual write load, two operations per fire, against the ceiling one sharded primary can sustain.",
      },
      {
        value: "~670 interrupted runs/day, about 1 in 60,000",
        explain: "How rarely a worker is actually interrupted mid-run; small enough that idempotent at-least-once execution is a good trade rather than a constant headache.",
      },
    ],
  },
  nodes: [
    {
      id: "execution",
      label: "Execution plane: at-least-once",
      kind: "zone",
      detail: {
        what: "Everything below the run record: the worker pool, the advisory lease, and the external systems a job mutates.",
        why: "It is a zone because the guarantee changes here. Above the line the design owns identity and can be exactly-once about the decision. Below it, work is retried, redelivered and occasionally duplicated, and the only defence is the job being idempotent on (job_id, scheduled_at).",
        numbers: [
          { value: "~300k concurrent runs at peak", explain: "The largest simultaneous execution load this plane has to sustain." },
          { value: "~670 interrupted runs/day", explain: "How often a run is cut off mid-flight and has to be recovered by a new attempt." },
        ],
        breaks: {
          failure: "The worker pool and retry policy are the easy half of this box.",
          handled: "Any queue-and-worker system already solves them. The hard half is the run row above this line, which is what actually settles identity.",
        },
      },
    },
    {
      id: "registration",
      label: "Registration API",
      sub: "cron, tz, jitter, catch_up",
      kind: "service",
      col: 0,
      row: 0,
      detail: {
        what: "The write path for definitions: cron expression or run_at, timezone, payload pointer, retry policy, catch-up policy, DAG parents and the jitter window.",
        why: "Two properties that decide the whole system's behaviour are set here and nowhere else: the stable per-job jitter offset, and whether the job is at-least-once or at-most-once. Both have to be declared at registration because nothing outside the job can infer them later.",
        numbers: [
          { value: "~1KB per definition, 10M definitions = 10GB", explain: "10M × 1KB = 10GB — dwarfed by the ~1.8TB of 90-day run history; this store's constraint is tick write throughput, never capacity." },
          { value: "70% recurring, 30% one-shot", explain: "The mix of cadence types the registration path has to support." },
        ],
        breaks: {
          failure: "A catch_up=run_all job whose entrypoint ignores scheduled_at replays with today's data.",
          handled: "That silently produces a different answer from the one that was missed, so it has to be refused here rather than detected downstream.",
        },
        choice: {
          pick: "Stable jitter from hash(job_id) inside a configurable window, applied at registration",
          instead: "Fire exactly on the cron boundary and absorb the burst with worker capacity.",
          decider:
            "2.5M runs come due at 00:00:00 (840k hourly plus 1.68M midnight-daily). Spread over a plus or minus 5 minute window that is ~4,200 runs/s, which one primary can commit and one queue can take. Unjittered it is 2.5M in a single second, and no amount of fleet fixes the downstream systems those jobs hit.",
          flips: "Jobs whose boundary is real opt out explicitly and pay the burst: an end-of-day cut at 16:30:00 where a run 200ms early excludes a trade that belongs in the file.",
        },
      },
    },
    {
      id: "jobs-db",
      label: "Jobs store",
      sub: "Postgres, sharded hash(job_id)",
      kind: "database",
      col: 1,
      row: 0,
      detail: {
        what: "Source of truth for what should run: cron expression, timezone, payload pointer, retry policy, DAG parents, next_run_at, shard and state.",
        why: "The tick is a write transaction against this store, and it is deliberately separate from run history. 10GB of slowly changing definitions and 20GB a day of append-only attempts share nothing except a job id, and have completely different retention.",
        numbers: [
          { value: "10M x 1KB = 10GB, ~30GB at RF=3", explain: "The definitions store's small, mostly static footprint." },
          { value: "8,400 writes/s at peak, 10-20k capacity", explain: "The tick's peak write rate against the ceiling one sharded primary can sustain." },
        ],
        breaks: {
          failure: "Failing the tick over to a read replica.",
          handled: "The design refuses to fail the tick over to a replica at all; it blocks until the primary returns, and the catch-up policy replays missed occurrences once it does.",
        },
        choice: {
          pick: "One Postgres primary per shard, sharded by hash(job_id)",
          instead: "One unsharded primary, or moving definitions into the wide-column store that already holds run history.",
          decider:
            "The write rate, not the read. The next_run_at range scan against the current time is an index range scan returning only due rows, and is cheap. What saturates is two write ops per fire, so 4,200 fires/s is 8,400 writes/s against a primary that does 10k to 20k. Capacity never binds: the whole table is 10GB.",
          flips: "Below roughly 1k fires/s a single unsharded primary carries everything, and one datastore is easier to back up consistently and to reason about transactionally.",
        },
      },
    },
    {
      id: "scheduler",
      label: "Scheduler tick",
      sub: "leader per shard, 30s tick",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "A leader-elected process that polls the jobs store for next_run_at against the current time and materialises one run record per due occurrence. It never executes a job.",
        why: "Separating the decision from the work is what gives leases, retries, dependency resolution and audit a single artifact to key on. Fold execution into the ticker and there is no object for a retry to attach to, which is why mixing them makes failure handling so much harder.",
        numbers: [
          { value: "30s tick, capped at 10,000 due rows per shard", explain: "The scan cadence and the per-tick ceiling that bounds one leader's work." },
          { value: "4,200 fires/s in the midnight window", explain: "The peak rate this process has to sustain when the daily and hourly boundaries overlap." },
        ],
        breaks: {
          failure: "Splitting the run insert and the next_run_at advance into two transactions.",
          handled: "Advance first and crash and the occurrence is skipped forever with no error anywhere. Insert first and crash and every later tick re-reads the same due row, hits the conflict, and the job appears to hang.",
        },
        choice: {
          pick: "One elected leader per shard evaluating the calendar on a fixed tick",
          instead: "No scheduler process: every worker evaluates the calendar against its own clock and races to insert the run row.",
          decider:
            "How much clock skew the tightest job tolerates. Against a plus or minus 60 second fire-delay SLO, a fleet drifting 50ms on the public NTP pool is fine and the leaderless design is simpler. Against a job that must snapshot at 09:30:00 within 100ms, one disciplined clock beats a thousand approximately-agreeing ones.",
          flips: "Small fleets, per-tenant deployments, or infrastructure with no reliable coordination primitive. The cost is that nobody can answer what is due right now from one place any more.",
        },
      },
    },
    {
      id: "coordination",
      label: "Coordination lease",
      sub: "15-30s TTL, standby takeover",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "The lease deciding which scheduler replica ticks a shard, with standbys that take over inside one tick interval.",
        why: "It exists to stop N schedulers doing the same work, not to make the work correct. The unique constraint on the calendar tuple already guarantees one run record whatever the leadership situation. Nothing else in the design is allowed to depend on this lease being right.",
        numbers: [
          { value: "15-30s TTL", explain: "How long a lease survives without renewal before a standby can claim it." },
          { value: "failover lands inside one 30s tick", explain: "The bound on how long leadership can be missing before a replacement takes over." },
        ],
        breaks: {
          failure: "A leadership flap is a load incident, not a correctness one.",
          handled: "A second leader at 4,200 fires/s doubles the pressure on a store already at 8,400 writes/s, which is how an election problem becomes a database outage.",
        },
        choice: {
          pick: "A 15 to 30 second coordination lease that nothing depends on being correct",
          instead: "Treating a consensus-backed lock as the mechanism that prevents duplicate fires.",
          decider:
            "The unique constraint already makes double-ticking harmless, so election only buys load: two leaders cost one wasted transaction per job. 15 to 30 seconds is short enough that failover lands inside one 30s tick and long enough that a GC pause does not thrash leadership.",
          flips: "Never for correctness. With no coordination service at all, drop the leader entirely and let every replica tick, accepting N times the write load as the price.",
        },
      },
    },
    {
      id: "runs-db",
      label: "Run records + history",
      sub: "unique on (job_id, scheduled_at)",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "One row per attempt: run_id, status, attempt, start, end, worker and error snippet, with run identity unique on (job_id, scheduled_at).",
        why: "That tuple is the entire exactly-once story for the decision. scheduled_at is the occurrence computed from the cron expression, never now() at the moment of firing. Identity survives a retried tick, a leader change, a clock 400ms fast and an envelope redelivered four minutes later.",
        numbers: [
          { value: "~500B per run, 40M/day = 20GB/day raw", explain: "The daily write volume this store absorbs across the whole fleet." },
          { value: "~1.8TB hot at 90 days retention", explain: "The resulting hot-tier footprint at the retention window this store keeps." },
        ],
        breaks: {
          failure: "Naive local-time evaluation.",
          handled: "Local 02:30 happens twice on the fall-back Sunday, so two genuinely different fires collide on one key unless occurrences are computed in UTC against a current timezone database.",
        },
        choice: {
          pick: "A wide-column store keyed on (job_id, scheduled_at), append-only per attempt",
          instead: "Keeping run history alongside the definitions in the transactional store.",
          decider:
            "Volume and retention. 40M runs a day at ~500B is 20GB/day raw and ~1.8TB hot at 90 days, against 10GB total for every definition. This is the only component in the design with real volume.",
          flips: "A scheduler doing thousands rather than tens of millions of runs a day. One Postgres then holds both, and the tick transaction covers the insert and the advance with no cross-store reasoning at all.",
        },
      },
    },
    {
      id: "queue",
      label: "Durable job queue",
      sub: "partitioned log, 24h retention",
      kind: "queue",
      col: 0,
      row: 2,
      detail: {
        what: "The hand-off between scheduler and workers, carrying a ~1KB envelope per run record.",
        why: "It decouples scheduling throughput from execution throughput and absorbs the top-of-hour burst. If every worker is down at 02:00 the run records sit here and drain when workers recover, rather than the fire being lost.",
        numbers: [
          { value: "460/s steady, 10k/s design peak", explain: "The throughput range this queue is designed to absorb." },
          { value: "~1TB retention absorbs a 24h stall at peak", explain: "How long the fleet could be completely down before this queue starts losing envelopes to retention." },
        ],
        breaks: {
          failure: "No backpressure. When workers stall a naive scheduler keeps emitting.",
          handled: "That overruns retention and loses the head of the backlog, which is the oldest work and the most likely to matter.",
        },
        choice: {
          pick: "A partitioned durable log between scheduler and workers, published after the row commits",
          instead: "No queue: workers poll a claim table with a row-locking claim query that skips already-locked rows, so the run record and the claim are the same row.",
          decider:
            "Sustained dispatch rate against polling cost. A claim table holds roughly 1k dispatches/s and a couple of hundred pollers before empty polls dominate and the head of the next_run_at index becomes a lock-contention point. The midnight window is 4,200/s across a fleet that autoscales past 1,000 workers.",
          flips: "Below about 1k/s with a fleet under a few hundred, which describes most schedulers in production. One datastore and one transaction removes the commit-versus-publish ordering hazard and the sweeper entirely.",
        },
      },
    },
    {
      id: "sweeper",
      label: "Publish sweeper",
      sub: "queued > 60s, republish",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "A scan for run rows still queued after 60 seconds with no recorded publish receipt, which it republishes to the queue.",
        why: "Choosing a broker introduced a second durable system that can disagree with the first, and this is the component that reconciles them. It is the honest cost of that decision, drawn rather than hidden.",
        numbers: [
          { value: "60s threshold", explain: "How long a queued row waits with no publish receipt before this scan acts on it." },
          { value: "makes queue delivery at-least-once by construction", explain: "The guarantee this component's existence is what makes true." },
        ],
        breaks: {
          failure: "It cannot tell lost from merely slow, so it is a duplicate source by design.",
          handled: "The lease's SETNX claim absorbs the common case of two pulls; when it fails, the job's own idempotency key on (job_id, scheduled_at) absorbs whatever duplicate slips through.",
        },
        choice: {
          pick: "Commit the row, then publish, and sweep the gap after 60 seconds",
          instead: "Publishing inside the tick transaction, via two-phase commit or a transactional outbox.",
          decider:
            "The direction of the failure, not its probability. Commit-then-publish leaves a queued row with no message, which a 60 second scan repairs. Publish-then-commit leaves a run in a worker's hands with no row, and the status write then has nothing to write to.",
          flips: "The claim-table design, where the run record and the claim are one row in one transaction and there is nothing to reconcile, so the sweeper does not need to exist.",
        },
      },
    },
    {
      id: "workers",
      label: "Worker pool",
      sub: "pull, lease, execute, heartbeat",
      kind: "service",
      col: 1,
      row: 2,
      parent: "execution",
      detail: {
        what: "Stateless processes that pull a run record, take the lease, execute, heartbeat, and compare-and-set a terminal status.",
        why: "This is the easy half and deliberately ordinary at-least-once work that any queue-and-worker system already knows how to do. Statelessness is the point: any worker is replaceable mid-flight, which is what makes reclaim a bounded 90 second operation.",
        numbers: [
          { value: "~300k concurrent runs at peak, 14k steady", explain: "The execution load this pool sustains at peak and at rest." },
          { value: "~670 interrupted runs/day, ~1 in 60,000", explain: "How often a worker gets cut off mid-run, the base rate the job's idempotency has to absorb." },
        ],
        breaks: {
          failure: "The worker that stalls rather than crashes.",
          handled: "A GC pause or a partition to the lease store expires the TTL while the process is alive, still holding connections open. Two live workers then execute the same occurrence.",
        },
        choice: {
          pick: "At-least-once execution with idempotency owned by the job, normally a ledger row on (job_id, scheduled_at)",
          instead: "At-most-once: mark the run attempted before executing, never auto-retry, and turn every interruption into a page.",
          decider:
            "Whether the side effect can carry a deduplication key the receiver honours. If it can, the ~670 interrupted runs a day (1 in 60,000) are absorbed silently. If it cannot, at-least-once converts those 670 into 670 genuine duplicates a day.",
          flips: "A side effect that is externally visible and cannot be deduplicated, where a duplicate is worse than a gap. A duplicated 10,000 share buy, or a settlement file dropped twice, are two examples. This is a per-job attribute declared at registration, not a system-wide mode.",
        },
      },
    },
    {
      id: "lease",
      label: "Lease store",
      sub: "Redis SETNX, 90s TTL",
      kind: "database",
      col: 3,
      row: 2,
      parent: "execution",
      detail: {
        what: "lease:{job_id}:{scheduled_at} mapped to a worker_id with a TTL, renewed by a heartbeat every 30 seconds.",
        why: "It deduplicates the common case cheaply and bounds reclaim: a crashed worker's run is claimable again within 90 seconds instead of stalling every dependent DAG task behind it forever.",
        numbers: [
          { value: "300k leases x 200B = ~60MB", explain: "300k × 200B ≈ 60MB — small enough for one Redis node, which is why an advisory in-memory store suffices and a distributed lock service would be overkill." },
          { value: "30s heartbeat against a 90s TTL", explain: "The renewal cadence against the expiry window, giving margin for one missed heartbeat." },
          { value: "a 4h backfill renews ~160 times", explain: "How many heartbeats a long-running job sends over its lifetime to keep its lease alive." },
        ],
        breaks: {
          failure: "It is a hint, not a lock.",
          handled: "Any 90 second blip to the lease store loses a perfectly healthy job's lease, and the TTL expiring does nothing to stop the original process continuing.",
        },
        choice: {
          pick: "An in-memory store with TTLs, treated as advisory",
          instead: "A fenced lock where the protected resource rejects writes below a monotonic token, or a database row lock held for the run.",
          decider:
            "300k concurrent leases at 200B is 60MB, so this fits one node with room to spare. No TTL lease can stop a stalled worker regardless of how it is implemented. Given correctness has to come from the job's ledger either way, buy the cheap deduplication rather than the expensive one.",
          flips: "When the resource being mutated can check a fence token, at which point fencing genuinely prevents the two-live-workers case instead of merely making it rare.",
        },
      },
    },
    {
      id: "target",
      label: "External systems",
      sub: "warehouse, object store, APIs",
      kind: "external",
      col: 2,
      row: 2,
      parent: "execution",
      detail: {
        what: "Whatever the job actually mutates: a data warehouse, object storage, an email API, a counterparty endpoint.",
        why: "It is drawn because it is the reason exactly-once is off the table. The last thing a job does is change a system outside this design. The only defence is an idempotency key derived from the (job_id, scheduled_at) tuple that the receiver agrees to honour.",
        breaks: {
          failure: "Jitter spreads fires in time but is blind to contention.",
          handled: "200 jobs spread over a 10 minute window that all query the same warehouse still queue behind each other, and the scheduler sees a healthy dispatch rate the whole time.",
        },
      },
    },
    {
      id: "dlq",
      label: "Dead letter + alerting",
      sub: "bounded retries, page once",
      kind: "queue",
      col: 1,
      row: 3,
      detail: {
        what: "Where a run lands once its retry budget is exhausted, and the one place on-call is paged from.",
        why: "Retries have to be bounded or a wedged job blocks its entire DAG. Dependents are marked skipped with a parent_failed reason rather than queued indefinitely, so a broken parent produces one alert on exhaustion instead of one per attempt or one per dependent.",
        numbers: [{ value: "DAGs of hundreds of tasks, p99 ~1k", explain: "The typical and tail DAG size this component's alert budget has to work at without becoming noise." }],
        breaks: {
          failure: "Sudden dead-letter growth usually means a downstream dependency broke rather than the scheduler.",
          handled: "Paging on it without the dependency context sends on-call to the wrong system, so the alert carries the dependency reason with it.",
        },
        choice: {
          pick: "Exponential backoff up to a bounded max_retries, then dead-letter and one alert",
          instead: "Retrying indefinitely, or alerting on every failed attempt.",
          decider:
            "Whether the failure is transient. Backoff absorbs transient ones. Past the bound more attempts only multiply load on whatever is already broken. Per-attempt alerting on a DAG of hundreds of tasks (p99 ~1k) also buries the one signal that mattered.",
          flips: "At-most-once jobs, which never auto-retry at all: an interruption goes straight to a page and a human decides whether to re-run it.",
        },
      },
    },
    {
      id: "watchdog",
      label: "Missing-run watchdog",
      sub: "declared cadence, grace window",
      kind: "service",
      col: 3,
      row: 0,
      detail: {
        what: "A separate check that every job with a declared expected cadence actually produced a run inside its grace window.",
        why: "It is the only thing in the design that can detect absence. Every other signal is derived from work that happened, and a run that never fired is work that did not. It has to be inferred from an independent model of what should have occurred.",
        numbers: [
          { value: "fire delay SLO p99 under 60s", explain: "The latency this watchdog holds ordinary fires to before treating a delay as suspicious." },
          { value: "tick lag pages above 5x the tick interval", explain: "The threshold at which a stalled leader's tick lag becomes a page rather than noise." },
        ],
        breaks: {
          failure: "It shares our jobs store, our clock and our tz database.",
          handled: "Exactly the bugs most likely to cause a silent miss, a bad tz rollout, a shard whose leader never took over, blind the detector too.",
        },
        choice: {
          pick: "Per-job declared cadence plus a watchdog alerting when a fire does not appear in its grace window",
          instead: "Relying on run failures and dead-letter growth to surface problems.",
          decider:
            "Absence has no signal. A missing run errors nowhere, consumes no capacity and leaves no row. All the normal SLOs, tick lag, fire delay p99, dead-letter growth, lease-acquire ratio, stay green while a 02:00 batch silently never happened.",
          flips: "Nothing replaces it, and this build is honestly weak. A genuinely independent check would run on a different stack against a different replica, with its own external liveness proof, and we have not built that.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "registration",
      to: "jobs-db",
      tier: "data",
      label: "definition + stable jitter",
      detail: {
        what: "A new or updated definition written to the jobs store, with its first next_run_at and its jitter offset already computed.",
        why: "The offset is fixed at registration rather than at fire time so it is stable. The same job always lands at the same place in the window, derived once as hash(job_id), which keeps the schedule predictable across restarts and leader changes.",
        breaks: {
          failure: "A job that inherits jitter without opting out now means within 5 minutes of midnight rather than midnight.",
          handled: "Accepted: fixing it means making jitter opt-in rather than default, at the cost of forcing every job author to decide explicitly at registration time.",
        },
      },
    },
    {
      id: "e2",
      from: "scheduler",
      to: "jobs-db",
      tier: "data",
      label: "due scan + tick txn",
      detail: {
        what: "The tick: read due rows, then per job one transaction that inserts the run row, ignoring a duplicate key rather than erroring, and advances next_run_at guarded on its previous value.",
        why: "Both writes or neither. The guard on the old value is what makes two concurrent leaders safe. The loser's update matches zero rows and its insert conflicts, so it knows it did nothing rather than assuming it won.",
        numbers: [
          { value: "capped at 10,000 due rows per tick", explain: "The maximum work one tick can take on, bounding a single leader's worst case." },
          { value: "two write ops per fire, 8,400/s at peak", explain: "The write amplification of one transaction, doubling the effective load on the store." },
        ],
        breaks: {
          failure: "If the store is unavailable the tick simply does not run.",
          handled: "Nothing is lost, because next_run_at never advanced, but the catch-up policy then has to decide on recovery whether to replay the missed occurrences.",
        },
      },
    },
    {
      id: "e3",
      from: "scheduler",
      to: "coordination",
      tier: "control",
      label: "leader lease, 15-30s TTL",
      detail: {
        what: "Acquiring and renewing the per-shard leadership lease, and watching the key so a standby takes over promptly.",
        why: "It is a control path because nothing correctness-bearing travels on it. Its only job is keeping the number of ticking schedulers at one, which is a cost decision rather than a safety one.",
        numbers: [{ value: "15-30s TTL, failover inside one tick", explain: "The lease's validity window and the bound on how fast a standby replaces it." }],
        breaks: {
          failure: "A scheduler that wrongly believes it still leads does no damage at all.",
          handled: "That being true is the test of whether the rest of the design is right, since correctness never actually depends on this lease.",
        },
      },
    },
    {
      id: "e4",
      from: "scheduler",
      to: "runs-db",
      tier: "data",
      label: "run row, dedup on insert",
      detail: {
        what: "The materialised run record: (job_id, scheduled_at, run_id, attempt=1, status=queued), under a unique constraint.",
        why: "This row is the artifact everything else attaches to. Once it exists, every component downstream can ask whether two things are the same fire and get the same answer, which is what makes retries, leases and audit tractable.",
        numbers: [{ value: "one row per calendar occurrence", explain: "The identity guarantee this write enforces, regardless of how many schedulers attempted it." }],
        breaks: {
          failure: "Identity taken from now() instead of the computed occurrence would let two schedulers 50ms apart create two identities for one fire.",
          handled: "The unique constraint would happily accept both, which is why identity is always the computed occurrence, never wall-clock time.",
        },
      },
    },
    {
      id: "e5",
      from: "scheduler",
      to: "queue",
      tier: "hot",
      step: 1,
      label: "publish after commit",
      detail: {
        what: "The run envelope published to the durable queue, strictly after the transaction that created the row has committed.",
        why: "Ordering is the entire point of this edge. Publish first and crash and there is a run on the queue and in a worker's hands with no record to write status against, which cannot be reconciled afterwards.",
        numbers: [
          { value: "~1KB envelope", explain: "1KB × 10k/s peak × 86,400s ≈ 864GB ≈ the ~1TB retention window — sized so a full day of workers being down never overruns it." },
          { value: "460/s steady, 4,200/s at midnight", explain: "The throughput range this edge sustains at rest and at peak." },
        ],
        breaks: {
          failure: "The gap between commit and publish is real.",
          handled: "A crash there leaves a queued row with no message, and the sweeper exists solely to cover it.",
        },
      },
    },
    {
      id: "e6",
      from: "queue",
      to: "workers",
      tier: "hot",
      step: 2,
      label: "pull run record",
      detail: {
        what: "A worker pulling the next run envelope from its partition.",
        why: "Pull rather than push means execution capacity sets the rate, so the midnight burst queues rather than knocking the fleet over. Scheduling throughput stays independent of execution throughput.",
        numbers: [{ value: "10k/s design peak", explain: "The maximum pull rate this edge is designed to sustain across the fleet." }],
        breaks: {
          failure: "Redelivery is normal here, so a worker can never assume it is the first to see this envelope.",
          handled: "The lease's SETNX claim stops a second worker from pulling the same envelope in the common case, and the job's idempotency key on (job_id, scheduled_at) covers the rest.",
        },
      },
    },
    {
      id: "e7",
      from: "workers",
      to: "lease",
      tier: "data",
      label: "SETNX + 30s heartbeat",
      detail: {
        what: "An atomic set-if-not-exists on lease:{job_id}:{scheduled_at} with a TTL, then a heartbeat every 30 seconds to extend it.",
        why: "One atomic claim per occurrence keeps two workers off the same run in the common case. The TTL is what makes a dead worker's run reclaimable, rather than stuck behind a process that will never return.",
        numbers: [{ value: "90s TTL, 30s heartbeat", explain: "The lease's expiry window and the renewal cadence that keeps it alive." }],
        breaks: {
          failure: "The TTL expires on a stalled process just as readily as on a dead one.",
          handled: "The stalled process still holds open connections to whatever it was mutating, which is why the lease alone cannot fully prevent a double execution.",
        },
      },
    },
    {
      id: "e8",
      from: "workers",
      to: "target",
      tier: "hot",
      step: 3,
      label: "side effect + idem key",
      detail: {
        what: "The actual work: writing to the warehouse, dropping a file, calling an API, carrying an idempotency key derived from (job_id, scheduled_at).",
        why: "This is the edge that makes exactly-once impossible, and the key is the only defence. Keying on the (job_id, scheduled_at) tuple rather than the attempt is what makes a stalled worker and its replacement collide in the ledger instead of both taking effect.",
        breaks: {
          failure: "A receiver that does not honour the key turns ~670 interrupted runs a day into 670 genuine duplicates.",
          handled: "At that point that job belongs in at-most-once mode instead, declared at registration rather than discovered in production.",
        },
      },
    },
    {
      id: "e9",
      from: "workers",
      to: "runs-db",
      tier: "data",
      label: "CAS terminal status",
      detail: {
        what: "The terminal status written as a compare-and-set on (run_id, attempt) rather than a blind update.",
        why: "It keeps history coherent when two workers both believe they own the run: the stalled one's late success write is rejected. The compare-and-set protects the record, and only the job's own ledger protects reality.",
        numbers: [{ value: "at most one accepted completion per record", explain: "The guarantee this compare-and-set enforces, regardless of how many workers attempted the same run." }],
        breaks: {
          failure: "A blind update would let a worker whose lease expired 20 minutes ago overwrite the outcome of the attempt that actually finished.",
          handled: "The compare-and-set on (run_id, attempt) rejects a write from a worker whose lease already expired, so only the attempt still holding a valid record can post its outcome.",
        },
      },
    },
    {
      id: "e10",
      from: "runs-db",
      to: "sweeper",
      tier: "control",
      label: "queued > 60s",
      detail: {
        what: "A scan for run rows still queued after 60 seconds with no recorded publish receipt.",
        why: "It reconciles the two durable systems the queue introduced. Nothing else in the design can notice that a committed decision never became a message, because the run row on its own looks perfectly healthy.",
        numbers: [{ value: "60s threshold", explain: "The wait period before this scan treats a queued row as needing a republish." }],
        breaks: {
          failure: "Too short a threshold republishes runs that were merely slow to be picked up.",
          handled: "That adds duplicate work during exactly the busiest minute of the day, which is why the threshold is tuned above normal pickup latency.",
        },
      },
    },
    {
      id: "e11",
      from: "sweeper",
      to: "queue",
      tier: "control",
      label: "republish lost runs",
      detail: {
        what: "Republishing the envelope for a committed run that never reached the queue.",
        why: "It makes delivery at-least-once by construction rather than by hope. A broker outage stops nothing permanently, because the rows are already committed and get republished when the broker returns.",
        breaks: {
          failure: "It cannot distinguish lost from slow, so it is a duplicate source by design.",
          handled: "It leans entirely on the lease's SETNX claim and the job's own idempotency key downstream to absorb whatever duplicate a republish creates.",
        },
      },
    },
    {
      id: "e12",
      from: "workers",
      to: "queue",
      tier: "data",
      label: "retry, attempt+1",
      offset: 90,
      detail: {
        what: "A failed run going back onto the queue with attempt+1 and an exponential backoff delay.",
        why: "The run record already exists, so a retry is a new attempt against the same (job_id, scheduled_at) identity rather than a new fire. That is what keeps a retried job idempotent against the same ledger key in the external system.",
        breaks: {
          failure: "Unbounded retries wedge the whole DAG.",
          handled: "They also multiply load on whatever is already broken downstream, which is why the retry budget has to be finite.",
        },
      },
    },
    {
      id: "e13",
      from: "workers",
      to: "dlq",
      tier: "data",
      label: "retries exhausted",
      detail: {
        what: "A run past its retry budget routed to the dead letter, with dependent tasks marked skipped and a parent_failed reason.",
        why: "One alert per exhausted job rather than one per attempt, and dependents fail fast instead of sitting queued behind something that is never going to succeed.",
        numbers: [{ value: "one page per exhaustion, not per attempt", explain: "The alerting discipline this edge enforces, keeping a wedged DAG from generating noise." }],
        breaks: {
          failure: "Marking dependents skipped loses the distinction between a task that failed and one that never ran.",
          handled: "The reason code distinguishes parent_failed from never-ran explicitly on every skipped dependent, or the DAG's history becomes unreadable once someone looks back later.",
        },
      },
    },
    {
      id: "e14",
      from: "runs-db",
      to: "watchdog",
      tier: "control",
      label: "expected cadence check",
      offset: 90,
      detail: {
        what: "The watchdog comparing the runs that exist against each job's declared expected cadence and grace window.",
        why: "Absence has no signal of its own, so it can only be inferred by asking a separate, per-job model of declared cadence and grace window. Nothing in the run store can volunteer a row that was never written.",
        breaks: {
          failure: "It reads the same store, clock and tz database as the scheduler.",
          handled: "A bad tz rollout or a shard whose leader never took over hides from the detector and the detected alike, which is the design's known blind spot.",
        },
      },
    },
  ],
};
