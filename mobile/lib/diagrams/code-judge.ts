import type { Diagram } from "./types";

export const CODE_JUDGE: Diagram = {
  id: "code-judge",
  title: "Online Code Judge",
  question: "Design LeetCode (an Online Code Judge)",
  sourceId: "patterns",
  itemId: 60,
  overview: {
    shape:
      "A queue of untrusted programs, a fleet of disposable sandboxes sized for the contest spike, and a verdict pipeline built for fairness. The same code gets the same verdict at 2am on a quiet Tuesday and in the first minute of a 30,000-person contest.",
    forces: [
      {
        constraint: "Every submission is a program you must assume is hostile, run 200 to 1,000 times a second",
        decision: "Judge workers give each run a fresh micro-sandbox: no network, a private filesystem, fixed memory and CPU quota, destroyed after one run",
        lights: ["workers", "e3"],
      },
      {
        constraint: "A contest opens and submissions jump from ~200/s to ~1,000/s in under a minute",
        decision: "The Capacity controller prewarms the pool from the contest calendar, minutes ahead, because reactive autoscaling loses a race that is announced in advance",
        lights: ["capacity", "workers", "e9", "e11"],
      },
      {
        constraint: "A verdict within 5% of the time limit must not depend on which machine ran it",
        decision: "Runs are charged CPU time on pinned cores with a per-language multiplier, and near-limit results re-run once before a time-limit verdict is final",
        lights: ["workers", "e5"],
      },
      {
        constraint: "Hidden test data is the product, and the code reading it is the adversary, up to 1,000 times a second",
        decision: "Inputs enter the sandbox as streams and expected outputs never enter at all; comparison happens outside, and output is capped at 64KB",
        lights: ["tests", "workers", "e4"],
      },
      {
        constraint: "One submission may only ever score once, however many retries and requeues it survives",
        decision: "The submission id is the idempotency key end to end: claims, verdicts and Contest service scoring all dedupe on it",
        lights: ["verdicts", "contest", "e6"],
      },
    ],
    naive: {
      text: "One server: exec() the submission with a 2-second alarm, tests read from a local folder, verdict written to the database. Three separate disasters. Security: the code can read the test folder, fork-bomb the host, or open a socket and mail the test data home. Fairness: wall-clock timing on a shared, noisy box means the same solution passes at 2am and fails at peak, and users notice within a day. Scale: a contest burst of 1,000 submissions/s at ~15 seconds of judging each needs ~15,000 concurrent runs, which is not one server at any price. The sandbox, the CPU-time accounting and the prewarmed pool each fix one of the three.",
      lights: ["workers", "capacity", "queue"],
    },
    beats: [
      {
        text: "A submission arrives at the Submission API: problem id, language, source text, a client retry key. The API authenticates, applies a per-user in-flight cap of 2, and enqueues. The cap is fairness at the front door: one user resubmitting in a loop cannot occupy a contest's worth of judging capacity.",
        lights: ["coder", "api", "e1", "e2"],
      },
      {
        text: "The Judge queue is partitioned by language pool and consumed in arrival order. During contests, contest submissions take a reserved share of capacity so practice traffic cannot starve them. The queue is the buffer that absorbs what even a prewarmed fleet cannot: depth is the signal everything else keys from.",
        lights: ["queue", "e2", "e9"],
      },
      {
        text: "A Judge worker claims a run and builds it a fresh micro-sandbox: a syscall-filtered jail or lightweight microVM. It has no network, a private filesystem holding only the toolchain and the submission, 256MB of memory and a fixed CPU quota on pinned cores. Compile, then execute against test cases, then destroy the sandbox. Nothing survives between runs, so nothing can be planted for the next one.",
        lights: ["workers", "e3"],
      },
      {
        text: "Test cases stream in from the Test-case store, versioned per problem. The input goes to the program's stdin; the expected output never enters the sandbox. The worker captures stdout, capped at 64KB, and compares outside the jail, with special judges, tolerance checks and multiple-valid-answer graders, running on the trusted side too.",
        lights: ["tests", "workers", "e4"],
      },
      {
        text: "Cases run cheapest-first and fail fast: the small discriminating cases go before the heavy stress cases, and the first failure ends the run for scoring purposes. Average occupancy drops from ~15s to ~6s, which at contest rates is the difference between ~15,000 and ~6,000 concurrent sandboxes.",
        lights: ["workers", "tests", "e4"],
      },
      {
        text: "Timing is CPU time, not wall time, read from the sandbox's own accounting, with a per-language multiplier so an interpreted solution is not judged on a compiled budget. A result within 5% of the limit re-runs once and keeps the better time. The verdict, per-case results, times and memory land in the Verdict store keyed by submission id, and the API pushes the result to the waiting client.",
        lights: ["workers", "verdicts", "e5", "e10"],
      },
      {
        text: "The Contest service consumes verdicts for contest submissions: scoring, wrong-answer penalties, and the standings freeze in the final hour. It updates the Leaderboard cache, a sorted set serving live standings to every participant. Scoring dedupes on submission id, so a replayed verdict cannot double-count.",
        lights: ["contest", "leaderboard", "e6", "e7", "e8"],
      },
      {
        text: "The Capacity controller closes the loop. It watches queue depth and wait times continuously, and it reads the contest calendar: fifteen minutes before a 30,000-entrant contest it prewarms the pool toward ~6,000 sandboxes. The verdict budget holds through the burst: ~2s queue, ~1s sandbox setup, ~1s compile, ~6s cases, ~1s writeback, ~11s against a 20s p50 target.",
        lights: ["capacity", "queue", "workers", "e9", "e11"],
      },
    ],
    crux: {
      problem:
        "Fairness under multi-tenancy. A verdict is a measurement of someone's code on your hardware, at the boundary where a few percent of jitter flips accepted into time-limit-exceeded. And it is taken on a fleet that is 30x busier during the contest that matters most.",
      handled:
        "The measurement is engineered like an experiment. CPU time from the sandbox's accounting, not wall time. Pinned cores and a fixed quota, so a noisy neighbour cannot slow the subject. Per-language multipliers, so the language choice is priced in. Near-limit results re-run once, best time kept, so boundary flips need two bad measurements. What remains: hardware generations really do differ by a few percent, so limits carry a per-fleet calibration constant. Problem setters are told the honest rule: set limits at 2x the reference solution, never at 1.1x.",
    },
    numbers: [
      {
        value: "~15,000 concurrent runs, uncapped burst",
        explain: "1,000 submissions/s at contest open x ~15s of judging each. Fail-fast ordering cuts occupancy to ~6s, so the prewarmed pool targets ~6,000 sandboxes instead.",
      },
      {
        value: "~6s average judging, down from ~15s",
        explain: "Cheapest-most-discriminating cases first, stop at first failure: most wrong submissions fail in the first few cases and never pay for the stress tests.",
      },
      {
        value: "64KB output cap per run",
        explain: "Bounds both the comparison cost and the exfiltration channel: a program trying to print the test data home is cut off mid-leak.",
      },
      {
        value: "~11s verdict at burst vs 20s p50 target",
        explain: "Queue ~2s + sandbox ~1s + compile ~1s + cases ~6s + writeback ~1s. The budget is spent in the sandbox, which is why occupancy, not queueing, sizes the fleet.",
      },
      {
        value: "re-run within 5% of the time limit",
        explain: "One repeat, keep the better time: a boundary verdict then requires two independent slow measurements, which pushes jitter-caused wrong verdicts from ~1 in 100 to ~1 in 10,000.",
      },
    ],
  },
  nodes: [
    {
      id: "coder",
      label: "Coders",
      kind: "client",
      sub: "editor, submit, watch verdict",
      col: 0,
      row: 0,
      detail: {
        what: "The user in the in-browser editor: submit, then watch the per-case progress and final verdict arrive.",
        why: "The submission experience is a held expectation, not a page reload. The client keeps a connection open and per-case results stream in as they finish, which makes a 10-second judge feel active rather than hung.",
        numbers: [
          { value: "~10M registered, ~30k in a big contest", explain: "The two populations that matter: steady practice traffic and the synchronized burst." },
          { value: "~200 submissions/s steady", explain: "The background rate the fleet idles against between contests." },
        ],
        breaks: {
          failure: "A user double-clicks submit, or retries on a slow ack, and risks two judgings and two penalty entries.",
          handled: "The client retry key dedupes at the API: the second request returns the first submission's id and attaches to its progress stream.",
        },
      },
    },
    {
      id: "api",
      label: "Submission API",
      kind: "service",
      sub: "auth, caps, enqueue, push result",
      col: 1,
      row: 0,
      detail: {
        what: "The stateless front door: authenticate, validate, apply per-user caps, enqueue the submission, and stream progress back to the client.",
        why: "Fairness starts here, before any expensive resource is touched. The per-user in-flight cap of 2 and a per-minute rate limit mean no individual, malicious or enthusiastic, can occupy a meaningful slice of the judging fleet.",
        numbers: [
          { value: "in-flight cap: 2 per user", explain: "A user's third submission waits client-side until one verdict returns; capacity math can then assume users, not loops." },
          { value: "~50KB max source size", explain: "Bounds queue payloads and compile cost; generated-code monsters are rejected at the door." },
        ],
        breaks: {
          failure: "The API accepts a submission, then crashes before the enqueue is acknowledged to the client.",
          handled: "Enqueue-then-ack ordering plus the retry key: the client retries, the queue dedupes on submission id, and the user sees one submission either way.",
        },
        choice: {
          pick: "Enqueue and stream progress over the held connection",
          instead: "Synchronous judging inside the request, response = verdict.",
          decider:
            "Occupancy. A verdict takes ~6 to 15 seconds; holding a synchronous request that long at 1,000/s is ~10,000 blocked requests doing nothing. The queue also gives the burst somewhere to live, and per-case streaming makes the wait legible.",
          flips: "An internal grader for a classroom of 30, where a blocking call is simpler and the burst never comes.",
        },
      },
    },
    {
      id: "queue",
      label: "Judge queue",
      kind: "queue",
      sub: "per-language pools, FIFO",
      col: 2,
      row: 0,
      detail: {
        what: "The buffer between acceptance and execution: partitioned by language pool, consumed in arrival order, with a reserved capacity share for contest traffic.",
        why: "The queue is what turns a burst into a wait instead of an outage. Its depth is the one honest signal of fleet health: the Capacity controller scales on it, the status page reads from it, and contest reservations are enforced at claim time.",
        numbers: [
          { value: "~2s p50 wait at contest burst", explain: "The queueing share of the 20s verdict budget once the prewarmed pool is live." },
          { value: "contest share: 70% of claims during contests", explain: "Practice traffic keeps 30% and waits longer; contest verdicts are the product during those 90 minutes." },
        ],
        breaks: {
          failure: "A worker claims a submission and dies mid-judge; the run vanishes.",
          handled: "Claims carry a visibility timeout of 2x the worst judging time, and an expired claim requeues the submission. The verdict write dedupes on submission id if the first worker was merely slow.",
        },
        choice: {
          pick: "FIFO per pool with claim leases and a contest reservation",
          instead: "Priority scoring per submission, contest weight as a big number.",
          decider:
            "Explainability during the event that matters. FIFO within a class answers every 'why is mine slow' with a queue position; priority scores answer it with nothing. A 70% contest share gives contests their guarantee without starving practice completely.",
          flips: "A judging fleet shared by many customers with paid tiers, where weighted fair queueing is the honest model and per-tenant SLOs replace queue positions.",
        },
      },
    },
    {
      id: "capacity",
      label: "Capacity controller",
      kind: "service",
      sub: "calendar prewarm + depth scaling",
      col: 3,
      row: 0,
      detail: {
        what: "The control loop that sizes the worker pool: reactive scaling on queue depth and wait, plus scheduled prewarming from the contest calendar.",
        why: "The contest burst is the rare load spike that is announced weeks in advance, and the whole trick is to use that. Reactive autoscaling alone loses: boot plus warm is minutes, and the burst peaks in the first sixty seconds. Prewarm starts fifteen minutes early and hands the burst a pool that is already standing.",
        numbers: [
          { value: "prewarm to ~6,000 sandboxes at T-15min", explain: "Sized from registrations x historical submit rate x ~6s occupancy, with 30% headroom." },
          { value: "scale-in no earlier than T+30min", explain: "The end-of-contest resubmit wave is as sharp as the open; tearing down early relives the spike without the pool." },
        ],
        breaks: {
          failure: "An unscheduled burst, a viral problem, an exam somewhere, arrives with no calendar entry.",
          handled: "Depth-based scaling still runs underneath, and the queue absorbs the minutes it needs. Waits degrade visibly on the status page, and per-user caps keep the wait fair while the pool catches up.",
        },
        choice: {
          pick: "Calendar-driven prewarm over depth-only autoscaling",
          instead: "Permanently provisioning for the contest peak.",
          decider:
            "Utilisation. The peak needs ~6,000 sandboxes for ~2 hours a week; steady state needs ~1,200. Always-on peak capacity is ~5x the fleet idling ~98% of the time, and the calendar removes the only reason to pay it: surprise.",
          flips: "Judging as a 24/7 API product with no calendar, where the spikes really are surprises and headroom plus fast boot is all there is.",
        },
      },
    },
    {
      id: "workers",
      label: "Judge workers",
      kind: "serviceGroup",
      sub: "1 fresh sandbox per run",
      col: 2,
      row: 1,
      detail: {
        what: "The judging fleet: each claimed run gets a disposable sandbox, and the worker drives compile, execute and compare as a pipeline.",
        why: "One sandbox per run, destroyed after, is the security model and the fairness model at once. Nothing persists for the next run to find, and nothing left running steals cycles from it. The stages are separate because their budgets and failure modes are: a compile error is a verdict, not an incident.",
        numbers: [
          { value: "~1,200 steady, ~6,000 at contest", explain: "Concurrent sandboxes: rate x ~6s occupancy, plus headroom; each is 2 vCPU + 256MB, so the burst pool is ~12k vCPUs." },
          { value: "~1s sandbox setup from a warm template", explain: "Jail or microVM cloned from a per-language snapshot; cold boot would triple it, which is what prewarming avoids." },
        ],
        breaks: {
          failure: "A submission finds a sandbox escape and reaches the worker host.",
          handled: "Defence in depth bounds the blast. The host holds no secrets beyond a claim lease, expected outputs live outside it, egress is denied at the network layer, and hosts are recycled on schedule. An escape is contained to wasting one host, and the jail is patched like the attack surface it is.",
        },
        choice: {
          pick: "Syscall-filtered jails on pinned cores, one per run, from warm templates",
          instead: "A pool of long-lived containers reset between runs.",
          decider:
            "What reset means under adversarial input. A reused container accumulates state a hostile program can plant, tmpfiles, processes, cgroup debris, and cleaning it reliably costs more than cloning a fresh jail in ~1s. Fresh-per-run makes the security argument a construction, not a checklist.",
          flips: "Trusted-code grading, an internal training tool, where reuse is safe and the reset cost argument wins.",
        },
      },
    },
    {
      id: "compile",
      label: "Compile",
      kind: "process",
      parent: "workers",
      col: 2,
      row: 1,
      detail: {
        what: "The submission compiled or syntax-checked inside the sandbox, with its own time and memory budget.",
        why: "Compilation runs untrusted input through a large toolchain, so it happens inside the jail like everything else; a compiler bomb is just another submission that exceeds its budget.",
        numbers: [{ value: "~1s budget, 10s hard cap", explain: "Template-heavy or generated code hits the cap and receives a compile-limit verdict rather than occupying a worker." }],
      },
    },
    {
      id: "run",
      label: "Run cases",
      kind: "process",
      parent: "workers",
      col: 2,
      row: 1,
      detail: {
        what: "The compiled program executed once per test case: input on stdin, stdout captured, CPU and memory read from the sandbox accounting.",
        why: "Cheapest-most-discriminating cases first, stop at first failure. Most wrong submissions die in the first few cases and never pay for the stress tests, which is where the ~15s to ~6s occupancy saving lives.",
        numbers: [{ value: "≤20 cases, 1-2s CPU limit each", explain: "Per-case limits with the per-language multiplier applied; memory capped at 256MB." }],
      },
    },
    {
      id: "compare",
      label: "Compare + verdict",
      kind: "process",
      parent: "workers",
      col: 2,
      row: 1,
      detail: {
        what: "Captured output checked against the expected answer outside the sandbox: exact match, tolerance, or a problem-specific special judge.",
        why: "Comparison is trusted code reading secret data, so it never enters the jail. The near-limit re-run decision is made here, where the times are known.",
        numbers: [{ value: "outputs capped at 64KB", explain: "Everything past the cap is truncation plus a wrong-answer verdict, which also closes the bulk-exfiltration channel." }],
      },
    },
    {
      id: "tests",
      label: "Test-case store",
      kind: "database",
      sub: "versioned per problem",
      col: 3,
      row: 1,
      detail: {
        what: "The versioned corpus of test cases per problem: inputs, expected outputs, special-judge binaries, and the case ordering used for fail-fast.",
        why: "Test data is the product's integrity. Versioning is what makes a rejudge meaningful: a verdict records the test version it ran against. When a setter fixes a weak case, affected submissions are rejudged against v2 deterministically.",
        numbers: [
          { value: "~3,500 problems x ~20 cases", explain: "Small data with outsized value; fully cached on workers by version hash, invalidated on publish." },
          { value: "case bundles ~1-50MB", explain: "Stress-test inputs dominate; streamed to the sandbox stdin rather than materialised inside it." },
        ],
        breaks: {
          failure: "A weak or wrong test case ships and verdicts diverge from the problem statement.",
          handled: "Publishing a fixed version triggers a targeted rejudge of submissions judged on the old version, with standings recomputed. The verdict's version pin makes the sweep exact rather than heuristic.",
        },
        choice: {
          pick: "Expected outputs and judges live outside the sandbox, inputs streamed in",
          instead: "Shipping the whole case bundle into the sandbox for a self-contained run.",
          decider:
            "What the adversary can read. Anything inside the jail is readable by the submission; a bundle with expected outputs turns every problem into print-the-answer. Streaming input costs 1 pipe per case and keeps the secret on the trusted side by construction.",
          flips: "Nothing at this trust level; only a trusted-code grader can safely ship answers inside.",
        },
      },
    },
    {
      id: "verdicts",
      label: "Verdict store",
      kind: "database",
      sub: "by submission id, immutable",
      col: 1,
      row: 1,
      detail: {
        what: "The record of every submission and its judged outcome: verdict, per-case results, CPU times, memory, test version, judged-at.",
        why: "Submission id is the idempotency key of the whole system, and this store is where it is enforced. A requeued run whose first worker was merely slow writes second and loses. Verdicts are immutable; a rejudge appends a new verdict with a new test version, never edits.",
        numbers: [
          { value: "~20M verdicts/day, ~2KB each", explain: "Steady practice plus contests; ~40GB/day, kept forever because profiles and rejudges both read history." },
          { value: "1 verdict per submission id, first write wins", explain: "The rule that makes worker crashes, requeues and races produce exactly one verdict." },
        ],
        breaks: {
          failure: "Two workers judge the same submission after a slow claim expires, and their verdicts differ due to jitter.",
          handled: "First write wins and the loser is discarded; the near-limit re-run policy makes a materially different second verdict rare, and the audit trail keeps both timings for calibration.",
        },
        choice: {
          pick: "Immutable verdicts keyed by submission id, rejudges append",
          instead: "Updating a submission row in place with its latest outcome.",
          decider:
            "Disputes and rejudges. Contest standings changed by a rejudge need the before and after to both exist, with test versions attached, or every complaint becomes archaeology. Append-only costs storage that ~2KB rows make irrelevant.",
          flips: "A private practice tool with no contests and no disputes, where latest-state-only is simpler and sufficient.",
        },
      },
    },
    {
      id: "contest",
      label: "Contest service",
      kind: "service",
      sub: "scoring, penalties, freeze",
      col: 1,
      row: 2,
      detail: {
        what: "The competition layer: registration, scoring rules, wrong-answer penalties, the final-hour standings freeze, and plagiarism review hooks.",
        why: "Judging and competing are different systems with different clocks. A verdict is true forever; a score depends on when the contest says it landed, what earlier attempts cost, and whether standings are frozen. Keeping the rules here means the judging pipeline never learns what a penalty is.",
        numbers: [
          { value: "score = solve time + 5min per wrong attempt", explain: "The classic penalty rule; applied on verdict consumption, idempotent by submission id." },
          { value: "freeze: final 60 minutes", explain: "Verdicts keep flowing to participants; only the public standings hold, then unfreeze at the end." },
        ],
        breaks: {
          failure: "A rejudge after the contest flips a verdict that standings and ratings already consumed.",
          handled: "Scoring replays deterministically from the verdict log: new standings are computed, a diff is published, and ratings re-run. The append-only verdict store is what makes this a recomputation instead of a negotiation.",
        },
        choice: {
          pick: "Scoring as a deterministic fold over the verdict log",
          instead: "Incrementing scores in place as verdicts arrive.",
          decider:
            "Rejudges and disputes are normal, not exceptional: every large contest has one. A fold recomputes cleanly from immutable inputs; in-place increments turn every correction into manual surgery on live standings.",
          flips: "Casual unranked contests where a rare wrong score is annoying rather than reputationally expensive.",
        },
      },
    },
    {
      id: "leaderboard",
      label: "Leaderboard cache",
      kind: "cache",
      sub: "sorted set per contest",
      col: 0,
      row: 2,
      detail: {
        what: "The live standings: a sorted set per contest keyed by score, serving rank pages and each participant's own position.",
        why: "30,000 participants refresh standings compulsively; the read path must be a cache hit. The sorted set gives rank, neighbours and pages in microseconds, rebuilt from the contest service's fold on restart.",
        numbers: [
          { value: "~5k standings reads/s during a contest", explain: "Served entirely from the cache; the verdict pipeline never feels the refresh habit." },
          { value: "rebuild in ~2s from the score fold", explain: "The cache is disposable by design; correctness lives in the verdict log and the fold." },
        ],
        breaks: {
          failure: "Cache eviction or restart mid-contest empties the standings.",
          handled: "Serve the last snapshot with a staleness banner while the fold rebuilds; two seconds of stale ranks beats an empty page during the freeze hour.",
        },
        choice: {
          pick: "A disposable sorted-set cache rebuilt from the score fold",
          instead: "Querying standings from the verdict store with an indexed ranking query.",
          decider:
            "Read shape. ~5,000 rank reads/s, each wanting position, neighbours and a page, is a sorted set's native operation in microseconds. As a database query it is a repeated sort over 30,000 rows, on the system of record, during its busiest hour.",
          flips: "Small contests, a few hundred entrants, where the ranking query is trivial and the cache is one more thing to rebuild.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "coder",
      to: "api",
      tier: "hot",
      step: 1,
      label: "submit {code, retry key}",
      detail: {
        what: "The submission request, held open for the progress stream: queued, compiling, case 7 of 20, verdict.",
        why: "Judging takes seconds and users retry what looks stuck; the retry key plus the visible per-case progress removes the reason to mash the button at all.",
        numbers: [{ value: "~200/s steady, ~1,000/s burst", explain: "The two rates the whole pipeline is sized around." }],
        breaks: {
          failure: "The connection drops mid-judge and the user never sees the verdict.",
          handled: "The verdict lands in the store regardless; reconnecting or refreshing reads it by submission id. The stream is a courtesy, not the record.",
        },
      },
    },
    {
      id: "e2",
      from: "api",
      to: "queue",
      tier: "hot",
      step: 2,
      label: "enqueue to language pool",
      detail: {
        what: "The accepted submission appended to its language pool's queue with contest flag and submission id.",
        why: "Enqueue is the durability point: from here the submission survives API crashes, worker crashes and requeues, and everything downstream dedupes on its id.",
        numbers: [{ value: "~2s p50 wait at burst", explain: "The queue's slice of the verdict budget once prewarm has the pool standing." }],
        breaks: {
          failure: "A poison submission crashes every worker that claims it.",
          handled: "A claim-count on the message: after 3 failed claims it is quarantined with an internal-error verdict and paged for a human, instead of cycling through the fleet forever.",
        },
      },
    },
    {
      id: "e3",
      from: "queue",
      to: "workers",
      tier: "hot",
      step: 3,
      label: "claim, lease 2x max time",
      detail: {
        what: "A worker claiming the next run in its pool under a visibility lease, then building the sandbox from the language's warm template.",
        why: "The lease is the crash-recovery contract: a worker that dies simply stops renewing, and the run reappears for another worker. No coordinator tracks workers; the queue's timeouts are the whole failure protocol.",
        numbers: [
          { value: "lease = 2x worst judging time", explain: "Long enough that a slow-but-alive run is never judged twice in parallel, short enough that a crash costs one lease of delay." },
          { value: "~1s template-to-ready", explain: "Sandbox cloned from the per-language snapshot with toolchain preloaded." },
        ],
        breaks: {
          failure: "Claim storms at contest open: thousands of workers hitting one pool's head.",
          handled: "Claims are batched, workers take a small prefetch of runs per claim call, so the queue serves hundreds of claim RPCs a second, not tens of thousands.",
        },
      },
    },
    {
      id: "e4",
      from: "workers",
      to: "tests",
      tier: "hot",
      step: 4,
      label: "cases by version hash",
      detail: {
        what: "The worker fetching the problem's case bundle by version hash, cached locally, and streaming inputs into the sandbox case by case.",
        why: "The version hash makes worker caches trivially correct: a republished problem is a new hash, so stale cache hits are impossible by construction rather than by invalidation discipline.",
        numbers: [
          { value: "~99% local cache hit", explain: "A few thousand problems dominate traffic; the store mostly serves newly published versions." },
          { value: "0 expected outputs inside the sandbox", explain: "The sandbox sees stdin per case; expected outputs stay on the trusted side always." },
        ],
        breaks: {
          failure: "A 50MB stress input x thousands of concurrent contest runs of the same problem hammers the store.",
          handled: "The version-hash cache absorbs it: each worker fetches once and judges many; the store's burst is proportional to workers, not submissions.",
        },
      },
    },
    {
      id: "e5",
      from: "workers",
      to: "verdicts",
      tier: "hot",
      step: 5,
      label: "verdict, first write wins",
      detail: {
        what: "The final verdict with per-case times, memory, output digests and the test version, written once per submission id.",
        why: "First-write-wins here is what makes every upstream failure mode safe: requeues, races and duplicate claims all collapse to one recorded outcome.",
        numbers: [{ value: "~2KB per verdict", explain: "Rich enough for profiles, disputes and rejudge sweeps without storing outputs themselves." }],
        breaks: {
          failure: "The write succeeds but the claim acknowledgement fails, and the run requeues anyway.",
          handled: "The second worker's write loses on the id and is discarded; the wasted judging is the cost of the crash, bounded to one run.",
        },
      },
    },
    {
      id: "e6",
      from: "verdicts",
      to: "contest",
      tier: "data",
      label: "contest verdict feed",
      detail: {
        what: "The contest service consuming new verdicts for registered contest submissions, in order, exactly once by submission id.",
        why: "Scoring is a consumer, not a callback. If the contest service is down for a minute, verdicts pile up in the feed and the fold catches up; judging never blocks on competition machinery.",
        numbers: [{ value: "~50 verdicts/s during a contest", explain: "Tiny next to judging volume; the ordering and idempotency matter, not the throughput." }],
        breaks: {
          failure: "The feed replays after a consumer restart and delivers verdicts twice.",
          handled: "The fold is idempotent on submission id, so replay is free; standings computed twice are the same standings.",
        },
      },
    },
    {
      id: "e7",
      from: "contest",
      to: "leaderboard",
      tier: "data",
      label: "score updates",
      detail: {
        what: "The fold's output applied to the sorted set: new score, new rank, per participant.",
        why: "Writes are per scoring event, a trickle; reads are the flood. The cache exists so 30,000 refresh habits read microsecond ranks instead of re-running any scoring logic.",
        numbers: [{ value: "~50 writes/s vs ~5k reads/s", explain: "The asymmetry that makes a cache the right shape for standings." }],
        breaks: {
          failure: "During the freeze, a leaked live update would reveal standings movement.",
          handled: "Freeze is enforced at the write: public-set updates buffer in the contest service and flush at unfreeze; participants' own rows keep updating privately.",
        },
      },
    },
    {
      id: "e8",
      from: "leaderboard",
      to: "coder",
      tier: "data",
      label: "live standings",
      detail: {
        what: "Rank pages and own-position reads served straight from the cache to participants.",
        why: "Standings are the emotional surface of a contest; serving them from a sorted set keeps the compulsive refresh loop away from every system that does real work.",
        numbers: [{ value: "~5k reads/s, ~1ms", explain: "The read load during a big contest, fully absorbed by the cache tier." }],
        breaks: {
          failure: "A standings page cached by the browser shows pre-freeze ranks after unfreeze.",
          handled: "Responses carry the freeze epoch; clients refetch when the epoch changes, so unfreeze is a visible flip rather than a stale mystery.",
        },
      },
    },
    {
      id: "e9",
      from: "queue",
      to: "capacity",
      tier: "control",
      label: "depth + wait signals",
      detail: {
        what: "The queue's depth, arrival rate and wait percentiles streamed to the capacity controller.",
        why: "Depth is the one metric that cannot lie about whether the fleet is keeping up: occupancy can look healthy while the queue quietly grows.",
        numbers: [{ value: "scale-out at >30s projected wait", explain: "Projected from depth over drain rate; conservative because sandbox boot is fast but not free." }],
        breaks: {
          failure: "A stuck pool, a bad language image, makes depth grow while other pools idle.",
          handled: "Signals are per pool, so scaling and paging are per pool; a broken pool quarantines its image and drains to the previous version.",
        },
      },
    },
    {
      id: "e10",
      from: "api",
      to: "verdicts",
      tier: "data",
      label: "read verdict for client",
      detail: {
        what: "The API reading verdict and per-case progress to feed the client's held connection, and to answer reconnect polls.",
        why: "The store is the truth the stream mirrors: any API node can pick up any client's watch by submission id, which is what makes the front tier stateless.",
        numbers: [{ value: "~1ms point read by id", explain: "One row; progress events additionally push from the worker via the API's subscription." }],
        breaks: {
          failure: "A user polls a submission id that is still queued and sees nothing.",
          handled: "The submission row exists from enqueue with state queued and position; there is never a moment where a real id reads as missing.",
        },
      },
    },
    {
      id: "e11",
      from: "capacity",
      to: "workers",
      tier: "control",
      label: "prewarm to ~6,000",
      detail: {
        what: "Pool-size commands: boot sandbox hosts from templates ahead of the calendar, scale in gently after.",
        why: "The burst is announced, so the controller's job is mostly to believe the calendar: T-15min prewarm, hold through the final-minute resubmit wave, release after T+30min.",
        numbers: [{ value: "T-15min out, T+30min in", explain: "The window that covers both spikes of a contest: the open and the last-five-minutes flurry." }],
        breaks: {
          failure: "Prewarm capacity fails to materialise, a cloud capacity shortage, minutes before the contest.",
          handled: "The controller alarms at T-10min if the pool is under target. Operators get a real decision window: delay the contest start, or run with longer queues and say so on the banner.",
        },
      },
    },
  ],
  figures: {
    burst: {
      title: "The contest burst is announced: prewarm beats reaction",
      nodes: [
        { id: "cal", label: "Contest calendar", sub: "30k registered, starts 14:30", kind: "database", col: 0, row: 0 },
        {
          id: "ctl",
          label: "Capacity controller",
          sub: "T-15min: begin prewarm",
          kind: "service",
          col: 0,
          row: 1,
          detail: {
            what: "Reads registrations and history, sizes the pool, starts booting at 14:15.",
            why: "Reactive scaling sees the burst only when the queue grows, minutes after the start; the calendar sees it weeks early.",
          },
        },
        {
          id: "pool",
          label: "Warm pool",
          sub: "~6,000 sandboxes standing",
          kind: "service",
          col: 0,
          row: 2,
          detail: {
            what: "Sandbox hosts booted from per-language templates, idle and claimed within a second.",
            why: "The burst's first minute is its worst; the pool must exist before submission one, not after alarm one.",
          },
        },
        {
          id: "spike",
          label: "14:30: 1,000 submits/s",
          sub: "queue wait stays ~2s",
          kind: "queue",
          col: 1,
          row: 2,
          detail: {
            what: "The open-minute flood arriving into a pool already sized for it.",
            why: "With ~6s occupancy and ~6,000 sandboxes the fleet drains ~1,000/s at steady state; the queue never builds beyond seconds.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "cal", to: "ctl", tier: "hot", step: 1, label: "T-15min trigger" },
        { id: "e2", from: "ctl", to: "pool", tier: "hot", step: 2, label: "boot from templates" },
        { id: "e3", from: "spike", to: "pool", tier: "hot", step: 3, label: "absorbed at ~2s wait" },
      ],
    },
  },
};
