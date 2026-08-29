import type { Diagram } from "./types";

export const CICD: Diagram = {
  id: "cicd",
  title: "CI/CD Pipeline",
  question: "Design a CI/CD & Code Deployment System",
  sourceId: "patterns",
  itemId: 54,
  overview: {
    shape:
      "Two systems joined by one immutable object. A build farm turns a commit into a signed, digest-pinned artifact, and a deploy controller walks that digest onto the fleet slowly enough to take it back out.",
    forces: [
      {
        constraint: "200k runs/day at 24 uncached worker-minutes each is a fleet nobody will fund",
        decision: "An action cache keyed on SHA-256 of declared inputs answers ~87% of actions from a lookup, cutting 24 minutes to 5.5",
        lights: ["action-cache", "e6"],
      },
      {
        constraint: "one worker fleet runs pull-request code from anyone, at up to ~3,250 workers holding scoped production access",
        decision: "Each job runs in its own Firecracker microVM, resumed from snapshot and destroyed after, with a 15-minute scoped credential",
        lights: ["worker-pool", "e4"],
      },
      {
        constraint: "a dropped column has 0 code-side recovery once it lands, against a rollback SLO of p95 under 5 minutes",
        decision: "A schema lint gate blocks destructive DDL unless the matching expand phase is already recorded as globally deployed",
        lights: ["schema-gate", "e2", "e14"],
      },
      {
        constraint: "rollback undoes the binary in ~45s but never the 1 email already sent or payment already captured",
        decision: "The rollout ladder caps exposure at 1% of traffic for 10 minutes before ever widening the blast radius",
        lights: ["rollout-ladder", "e9", "e10"],
      },
      {
        constraint: "a flag flip reverts in ~5s globally, three orders of magnitude faster than a ~45s digest rollback",
        decision: "The binary ships dark behind the feature-flag service, so deploy and release become separate, independently undoable events",
        lights: ["flag-service", "e15", "e16"],
      },
    ],
    naive: {
      text: "Build from source on every run, and deploy by rebuilding the same commit again if something needs rolling back. At 200k runs a day and 24 uncached worker-minutes each, that fleet is roughly 14,300 workers nobody will fund. A mid-incident rebuild from source may not even reproduce the artifact that was actually running. The design instead answers ~87% of actions from a content-addressed action cache. Every artifact is pinned by digest in the artifact store, so a rollback is a lookup of the exact previous object, never a rebuild.",
      lights: ["action-cache", "artifact-store"],
    },
    beats: [
      {
        text: "The build side starts as a compilation of intent. A webhook lands, and the controller reads the pipeline spec at the head SHA rather than from a UI. It expands the spec into a DAG of around 140 jobs with fan-out shards and merge gates. Reading the spec at the SHA is what makes what ran reconstructible months later.",
        lights: ["source-host", "pipeline-controller", "e1", "e3"],
      },
      {
        text: "Then almost nothing runs. Every action is keyed by SHA-256 of its complete declared inputs, argv plus sorted env plus input file digests plus toolchain digest. Around 87% of those keys are answered from a content-addressed store in ~40ms. That turns 24 worker-minutes per run into 5.5, and a 14,300-worker fleet into 3,250. The cache is the entire economics.",
        lights: ["build-scheduler", "worker-pool", "action-cache", "e4", "e6"],
      },
      {
        text: "The precondition is hermeticity, not hit rate. An action that reads something it did not declare lets two runs with the same key produce different outputs. The cache then serves one of them silently behind a green build. A slow build is visible; a wrong cache hit is not, and it ships. That is why the sandbox and toolchain pinning land before the cache does.",
        lights: ["action-cache", "e6"],
      },
      {
        text: "Workers are one Firecracker microVM per job, resumed from snapshot in ~800ms and destroyed after. This fleet executes code written by whoever opened the pull request, while holding the keys to production. A shared host kernel is the wrong trust boundary, so nothing long-lived is stored on a worker: the job exchanges an OIDC token for a 15-minute scoped credential.",
        lights: ["worker-pool", "e4"],
      },
      {
        text: "The artifact is the hinge. One signed, digest-addressed object crosses from the build plane to the deploy plane, and it is never rebuilt. Everything the deploy side claims about rollback speed rests on the fact that the previous artifact still exists, and pushing it is the same mechanism that pushed the new one.",
        lights: ["artifact-store", "deploy-controller", "e7", "e8"],
      },
      {
        text: "The deploy side is a risk problem solved by going slowly and measuring. 1% of tasks take the new digest against a freshly restarted baseline on the old one. The analyser needs ~23k requests per arm to call an error-rate doubling. So the rung bakes for 10 minutes and the ladder climbs 5%, 25%, one cell, region by region to global at ~3h50m. A REGRESS verdict restores the pinned previous digest in ~45 seconds.",
        lights: ["rollout-ladder", "canary-analyser", "fleet", "deploy-controller", "e9", "e10", "e11", "e12"],
      },
    ],
    crux: {
      problem:
        "Rolling back code is trivial because you still hold the artifact, pinned by digest. Rolling back state is not.",
      handled:
        "A migration that dropped a column makes redeploying the previous binary a worse outage than the one you are recovering from. So schema changes expand before they contract, and N and N-1 always coexist in the fleet. Any risky behaviour change ships dark behind a flag rather than inside the binary itself.",
    },
    numbers: [
      {
        value: "87% cache hit rate: ~3,250 workers, not ~14,300",
        explain: "At 87% a run costs 24 x 0.13 + 2.4 = 5.5 worker-minutes instead of 24, the arithmetic that shrinks the fleet by 4.4x.",
      },
      {
        value: "~23k requests per arm, so a 10 minute bake at 100 req/s",
        explain: "The sample size needed to detect a 0.1% error-rate doubling at 95% confidence and 80% power. That takes about 4 minutes at typical canary traffic, so the 10-minute rung has margin.",
      },
      {
        value: "rollback to the pinned previous digest in ~45s",
        explain: "How fast a REGRESS verdict restores service, because the previous artifact was never deleted and pushing it uses the exact mechanism that pushed the new one.",
      },
    ],
  },
  nodes: [
    {
      id: "build-plane",
      label: "Build plane: a throughput problem",
      kind: "zone",
      detail: {
        what: "Everything from the pipeline spec to the finished artifact: DAG expansion, scheduling, ephemeral execution and the caches that stop most of it executing at all.",
        why: "This half is sized by arithmetic rather than by risk. 200k runs a day at 24 uncached worker-minutes each is a fleet nobody will fund. The design pressure is entirely about answering actions without running them, and keeping that answer correct.",
        numbers: [
          { value: "200k pipeline runs/day", explain: "The daily volume every stage inside this boundary is sized to absorb." },
          { value: "2.4M jobs/day", explain: "The job count after DAG expansion, roughly 12 jobs per average run." },
          { value: "240M action executions/day", explain: "The finest-grained unit of work, most of which the cache answers without ever running." },
        ],
        breaks: {
          failure: "A lockfile or toolchain bump invalidates the root of the graph.",
          handled: "Every action misses at once, and the plane needs 4x its capacity for a day, which is an accepted, budgeted spike rather than a design flaw to eliminate.",
        },
      },
    },
    {
      id: "source-host",
      label: "Source host",
      sub: "push / PR webhook",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The code host that fires a webhook on every push and pull request, carrying repo, ref, SHA and event.",
        why: "It is drawn outside the boundary because it is the one part of the trigger path you do not run, and its delivery guarantee is weaker than the pipeline needs. Around 50k commits a day arrive this way and nothing else tells you a commit exists.",
        numbers: [
          { value: "~50k commits/day", explain: "Fans out ~4x into runs, ~12x further into jobs, ~100x further into actions: 240M/day from 50k commits, why the cache layer has to exist." },
          { value: "~200k pipeline runs/day", explain: "Runs outnumber commits because pushes, PR updates and re-triggers all create separate runs." },
        ],
        breaks: {
          failure: "A dropped webhook means a commit silently never builds, and the absence is invisible.",
          handled: "A gap detector compares main SHAs against pipeline_runs every 5 minutes, catching what the delivery guarantee alone cannot.",
        },
      },
    },
    {
      id: "pipeline-controller",
      label: "Pipeline Controller",
      kind: "service",
      sub: "spec at head SHA, expands DAG",
      col: 1,
      row: 0,
      parent: "build-plane",
      detail: {
        what: "Reads .pipeline.yaml at the head SHA, validates it, and expands it into a DAG of jobs with fan-out shards and fan-in gates.",
        why: "The pipeline that runs has to be the pipeline that was reviewed. Reading the spec at the SHA is what makes what ran reconstructible. Test selection then walks the reverse dependency graph of the changed files and drops a 500k test suite to ~18k in 24 shards.",
        numbers: [
          { value: "~140 jobs in a wide PR DAG", explain: "The upper end of DAG size for a change touching many parts of the codebase." },
          { value: "500k tests to ~18k, 24 shards", explain: "The reduction test selection achieves by only running tests reachable from the changed files." },
          { value: "~3k tests/run org-wide after selection", explain: "The typical per-run test count once selection and sharding are both applied." },
        ],
        breaks: {
          failure: "Run creation must be idempotent on (repo_id, sha, spec_hash).",
          handled: "Without that key, webhook redelivery and the reconciliation poller could both build the same commit twice, wasting capacity and confusing status reporting.",
        },
        choice: {
          pick: "Declarative spec versioned in-repo, read at the head SHA",
          instead: "An imperative pipeline configured in a UI and stored in the control plane.",
          decider:
            "Whether you can reconstruct what ran. Across 200k runs a day a UI-configured pipeline drifts from the code it builds, with no record tying a 3-week-old green build to the steps that produced it.",
          flips: "A handful of long-lived pipelines that almost never change, where in-repo YAML is ceremony and a UI is genuinely easier for the people who own it.",
        },
      },
    },
    {
      id: "schema-gate",
      label: "Schema lint gate",
      sub: "blocks destructive DDL",
      kind: "service",
      col: 2,
      row: 0,
      parent: "build-plane",
      detail: {
        what: "A CI check that rejects a dropped column, a dropped table or a narrowing type change unless the matching expand phase is already recorded as globally deployed.",
        why: "This is where the rollback promise is actually enforced, weeks before anyone needs it. Expand/contract as a convention is a convention people forget under deadline; as a gate in the build path it is a property of the system.",
        numbers: [
          { value: "4 deploys over ~2 weeks for a column rename", explain: "The realistic timeline this gate enforces for a safe expand-then-contract migration." },
          { value: "1 expand digest checked against the deploys table", explain: "The single lookup this gate performs to decide whether a contract step is currently safe." },
        ],
        breaks: {
          failure: "It only sees DDL that goes through the migration tooling.",
          handled: "A destructive statement run by hand against production leaves the gate green and the rollback path already gone, an accepted gap outside this gate's reach.",
        },
        choice: {
          pick: "Expand/contract enforced as a CI gate against deployed state",
          instead: "Running migrations in a pre-deploy hook, one deploy per schema change.",
          decider:
            "Migration duration against the rollback SLO of p95 under 5 minutes. Backfilling 400M rows in chunked batches at ~20k rows/s is ~6 hours, and on the deploy path those 6 hours sit inside the rollback path.",
          flips: "Additive, bounded migrations under 1M rows and 10 seconds on a table with exactly one writing service, where the four-step ceremony is overhead.",
        },
      },
    },
    {
      id: "build-scheduler",
      label: "Build Scheduler",
      kind: "service",
      sub: "constraint match, fair queue",
      col: 1,
      row: 1,
      parent: "build-plane",
      detail: {
        what: "Bin-packs job records onto a heterogeneous worker pool, matching hard constraints such as arch, RAM and image digest, under per-team weighted fair queueing.",
        why: "Not a FIFO queue. Jobs carry constraints that cannot be traded, macOS notarisation needs Apple hardware and GPU tests need an accelerator. Fairness has to be structural, or one repo's 4-hour dependency-upgrade run starves every other team.",
        numbers: [
          { value: "2.4M jobs/day", explain: "The total volume this scheduler places across every worker pool shape." },
          { value: "p95 queue wait < 30s", explain: "Held by provisioning at rho = 0.7 rather than higher; running the fleet hotter would cut cost but blow this target on a merge wave." },
          { value: "provisioned at rho = 0.7", explain: "The target utilisation this scheduler is sized against, leaving headroom for queueing variance." },
        ],
        breaks: {
          failure: "Small pools are where queueing theory bites.",
          handled: "The macOS pool is ~90 concurrent at peak on 120 machines, so p95 wait there is minutes at a utilisation the x86 pool absorbs without noticing. It is watched as its own SLO.",
        },
        choice: {
          pick: "Constraint-aware bin packing with per-team weighted fair queueing",
          instead: "A single FIFO queue per pool shape.",
          decider:
            "Head-of-line blocking at 2.4M jobs a day. One team's 4-hour upgrade run fills a FIFO and every other team's 8-minute PR waits behind it, blowing the p95 queue wait SLO for people who did nothing wrong.",
          flips: "A single-team farm where there is nobody to be unfair to, and FIFO plus a priority lane for the release branch is the whole requirement.",
        },
      },
    },
    {
      id: "worker-pool",
      label: "Ephemeral workers",
      sub: "one Firecracker microVM per job",
      kind: "service",
      col: 2,
      row: 1,
      parent: "build-plane",
      detail: {
        what: "Hardware-virtualised guests resumed from a snapshot pool in ~800ms, mounting nothing from the host, network denied by default, destroyed after a single job.",
        why: "A VM's isolation boundary at roughly a container's start-up cost. A container shares the host kernel, and this fleet executes code written by whoever opened the pull request. The kernel is the wrong trust boundary no matter how good the seccomp profile is. Each job exchanges a signed OIDC token for a credential scoped to that repo and ref, so nothing durable ever sits on the box.",
        numbers: [
          { value: "~800ms snapshot resume", explain: "How quickly a new microVM is ready to run a job, small against an 8-minute average run." },
          { value: "~3,250 workers at peak, 4 vCPU each", explain: "The fleet size the cache hit rate makes affordable, down from ~14,300 without it." },
          { value: "~10% (~330) kept pre-booted warm", explain: "The buffer that absorbs a merge wave before falling back to cold-boot latency." },
          { value: "15-min OIDC-exchanged creds, zero long-lived secrets on workers", explain: "The credential lifetime, short enough that a compromised job's access expires on its own." },
        ],
        breaks: {
          failure: "The warm pool is what the queue-wait SLO actually rests on: at a merge wave it depletes.",
          handled: "Observed p95 wait becomes cold-boot time rather than queueing, and the credential broker's trust policy is the whole security boundary, so fork PRs get a credential-free pool entirely.",
        },
        choice: {
          pick: "One Firecracker microVM per job, discarded after",
          instead: "Containers on a shared, reused host with a hardened seccomp profile.",
          decider:
            "The trust boundary against start-up cost. A microVM resumes from snapshot in ~800ms, so isolation costs a fraction of an 8-minute run. Reused hosts also leak state between jobs, which quietly breaks the hermeticity the cache depends on.",
          flips: "A farm building only trusted first-party code where nested virtualisation is unavailable, for example inside another cloud VM, and containers are the only option on offer.",
        },
      },
    },
    {
      id: "action-cache",
      label: "Action cache + CAS",
      sub: "key = SHA-256 of declared inputs",
      kind: "database",
      col: 3,
      row: 1,
      parent: "build-plane",
      detail: {
        what: "A key-value map from action key to output digests over content-addressed object storage, fronted by a regional read-through cache.",
        why: "This is the single largest cost lever in the system and everything else is rounding error beside it. Keying on argv plus sorted env plus input digests plus toolchain digest means an action already computed for these exact inputs is a lookup, not an execution.",
        numbers: [
          { value: "~87% hit rate, ~40ms p50 lookup", explain: "How often this cache answers an action without running it, and how cheap that answer is when it does." },
          { value: "5.5 worker-min/run cached vs 24", explain: "The real per-run cost once the hit rate is applied, against the uncached alternative." },
          { value: "~126TB CAS on a 21-day LRU window", explain: "The storage this cache needs to sustain that hit rate at current build volume." },
        ],
        breaks: {
          failure: "A non-hermetic action makes the cache serve a wrong output behind a green build.",
          handled: "Detection is a nightly re-execution of ~0.5% of hits diffing output digests, which is ~3% extra compute and is sampling, not proof, so it catches drift eventually rather than immediately.",
        },
        choice: {
          pick: "Content-addressed action cache keyed by a hash of all declared inputs",
          instead: "No action cache: every job builds from source on a clean worker and you buy machines instead.",
          decider:
            "The hit rate needed to make the fleet affordable. At 87% a run costs 5.5 worker-minutes instead of 24, so peak demand is ~3,250 workers rather than ~14,300. At 70% it is ~5,700 workers, so most of the saving lives in the last fifteen points.",
          flips: "Builds that are not hermetic and cannot cheaply be made so: an unsandboxed toolchain, tests that reach the network, codegen that embeds timestamps.",
        },
      },
    },
    {
      id: "artifact-store",
      label: "Artifact store",
      kind: "database",
      sub: "signed, immutable, by digest",
      col: 1,
      row: 2,
      detail: {
        what: "Digest-addressed, chunk-deduplicated object storage holding every artifact with a signed provenance attestation recording its inputs.",
        why: "This is the hinge between the two halves, and the reason rollback is a lookup rather than a rebuild. The thing you roll back to is the exact object that passed the pipeline, not a rebuild from the same SHA that might differ.",
        numbers: [
          { value: "~500MB per artifact, ~100TB/day raw", explain: "The daily write volume before deduplication is applied." },
          { value: "~1.32PB logical, ~650TB provisioned after dedup", explain: "The actual storage footprint once chunk-level deduplication across adjacent builds is applied." },
          { value: "deployed artifacts kept 2 years", explain: "How long a rollback target stays available regardless of how recently it was actually running." },
        ],
        breaks: {
          failure: "Retention has to be reference-counted against the deploys table, not purely time-based.",
          handled: "Expiring the rollback target of a service nobody has redeployed in three months deletes the recovery path silently. You find out during the incident, which is why deletion is gated on deploy history.",
        },
        choice: {
          pick: "Immutable digest-addressed artifacts with signed provenance",
          instead: "Rebuilding from the commit SHA at deploy time, or mutable tags such as latest.",
          decider:
            "Whether rollback is a lookup or a build. Restoring the previous digest is ~45 seconds; rebuilding from source is an 8-minute pipeline you are running during an incident, and it may not reproduce.",
          flips: "Tiny artifacts on a truly hermetic toolchain where a rebuild is seconds and byte-identical, so storing every build buys nothing over rebuilding on demand.",
        },
      },
    },
    {
      id: "deploy-controller",
      label: "Deploy Controller",
      sub: "owns strategy, bake, rollback",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "Reads the rollout spec, pins the digest, drives the ladder rung by rung, checks freeze windows at every rung, and owns the auto-rollback trigger.",
        why: "One place that answers what is running where and how far it got. Rollout state is a durable object rather than controller memory, so a crash mid-ladder is resumed by the new leader at the last recorded phase instead of restarting the exposure.",
        numbers: [
          { value: "~2k deploy records/day", explain: "The daily volume of rollouts this controller drives to completion." },
          { value: "~1,500 services, one lease each", explain: "The scale of the fleet, with a per-service lease preventing concurrent conflicting rollouts." },
          { value: "rollback SLO p95 < 5 min", explain: "The published target for how fast a bad deploy is fully reversed." },
        ],
        breaks: {
          failure: "Two concurrent rollouts for one service, an automated main-branch deploy and a manual hotfix, put three versions in the fleet.",
          handled: "That makes every canary comparison meaningless, since baseline and canary would each reflect two different changes at once, which is why a per-service lease excludes concurrent rollouts entirely.",
        },
        choice: {
          pick: "One control plane owning the path from artifact to fleet",
          instead: "A reconciler per environment that continuously drives running version toward a declared version.",
          decider:
            "Auditability against blast radius. A single control plane gives one answer to what ran and what shipped across ~1,500 services, at the cost that a control-plane outage is a company-wide deploy freeze.",
          flips: "Once the pipeline's own availability has burned you. A reconciler makes rollback an edit to a small piece of declared state, which keeps working when the control plane does not.",
        },
      },
    },
    {
      id: "rollout-ladder",
      label: "Rollout ladder",
      kind: "service",
      sub: "1 -> 5 -> 25 -> cell -> region",
      col: 2,
      row: 3,
      detail: {
        what: "The staged exposure schedule: 1% for 10 minutes, 5% and 25% for 15 each, the first full cell for 30, remaining cells and regions at 60, reaching global in ~3h50m.",
        why: "Each rung widens the failure domain by a stated, bounded amount, and the first rung caps unrecoverable effects at 1% of traffic for 10 minutes. The region ladder takes the lowest-traffic region first so the largest population is last and has the most evidence behind it.",
        numbers: [
          { value: "1% = 100 of 10,000 tasks", explain: "What the first rung actually means in absolute terms against fleet size." },
          { value: "first cell gets 30 min, 1 of 12", explain: "The bake time and scope of the first full-cell exposure, before spreading further." },
          { value: "merge to global ~3h50m", explain: "The total time from first exposure to a fully converged fleet, when every rung passes cleanly." },
        ],
        breaks: {
          failure: "The 1% canary must run against an equal-sized baseline population freshly restarted on the old digest.",
          handled: "Without that, you measure JIT warm-up and heap age instead of the change, and read 15% worse on p99 for no reason at all.",
        },
        choice: {
          pick: "Canary ladder on a rolling substrate",
          instead: "Blue-green: stand up a second full fleet, verify out of band, cut over at the load balancer.",
          decider:
            "Double capacity against detection speed. Rolling holds capacity flat and the first 10 minutes of exposure is 1% of users, at the price of ~3h50m to global. Blue-green cuts over in ~30s but needs 10,000 extra tasks and gives no gradual signal.",
          flips: "A mixed-version fleet that is genuinely unsafe, such as a wire format that could not be made N/N-1 compatible. Also verification that is a deterministic smoke test rather than a statistical comparison.",
        },
      },
    },
    {
      id: "canary-analyser",
      label: "Canary analyser",
      sub: "canary vs restarted baseline",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "Polls the metrics system every 30s and scores a small fixed set (error rate, p99 latency, one or two declared business counters) on both arms, returning PASS, REGRESS or hold.",
        why: "Bake time is a sample-size calculation, not a ritual. Detecting a 0.1% error rate doubling at 95% confidence and 80% power needs ~23k requests per arm. At 100 req/s that is ~4 minutes, so the rung is 10 minutes for margin rather than an arbitrary two.",
        numbers: [
          { value: "~23k requests per arm", explain: "The sample size needed to detect the target effect size at the chosen confidence and power." },
          { value: "p99 verdicts only trusted from the 5% rung", explain: "Latency comparisons need more traffic than the 1% rung provides to be statistically meaningful." },
          { value: "~431k per arm for a 20% relative effect", explain: "How much traffic a much larger, rarer effect would need, illustrating how sample size scales with effect size." },
        ],
        breaks: {
          failure: "Missing data is never a pass.",
          handled: "If the metrics pipeline gaps, the rollout holds at its current rung and pages, because interpreting silence as health is how a bad digest reaches global.",
        },
        choice: {
          pick: "Two-proportion test on a small fixed metric set, two consecutive bad intervals to fire",
          instead: "Threshold alarms on many metrics, or a human eyeballing a dashboard for two minutes.",
          decider:
            "False positives destroy the gate faster than false negatives do. Scoring many metrics at once means multiple-comparison noise auto-rolls-back healthy deploys and teams switch the gate off.",
          flips: "A service under ~500 req/s, where a 1% canary sees 0.5 req/s and needs ~13 hours to reach significance. The honest move there is to rely on fast rollback and synthetic probes instead.",
        },
      },
    },
    {
      id: "fleet",
      label: "Production fleet",
      sub: "~10k tasks across 12 cells",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "The tasks actually serving traffic, each pinned to an artifact digest, spread across cells and regions that form the failure domains the ladder walks.",
        why: "From the controller's point of view it is one number: how many tasks are on which digest. The reconciliation loop compares desired against actual digest distribution per cell, which is how a crashed controller's mess is found.",
        numbers: [
          { value: "10,000 tasks, 10k req/s", explain: "The scale of the fleet and the traffic it serves, the base unit every rollout percentage is measured against." },
          { value: "~6 min of mixed versions per rolling deploy", explain: "How long N and N-1 coexist during a normal rolling deploy, a window compatibility has to survive." },
          { value: "~5TB egress to push a 500MB artifact fleet-wide", explain: "The bandwidth cost of a full fleet-wide artifact push, why mirrors and peer distribution exist." },
        ],
        breaks: {
          failure: "N and N-1 serve simultaneously for several minutes during any rolling deploy.",
          handled: "A change that is not backward-compatible is already broken before anyone thinks about undoing it, which is why compatibility is a hard gate rather than a best-effort convention.",
        },
        choice: {
          pick: "Roll in place with N/N-1 compatibility as a hard gate",
          instead: "Drain and replace behind a maintenance window, or a full second fleet per deploy.",
          decider:
            "Mixed versions are unavoidable, not a choice. A rolling deploy across 10,000 tasks leaves both versions serving for ~6 minutes, so compatibility is a precondition for deploying at all without downtime.",
          flips: "In-process state that cannot be drained, or a storage format where two versions genuinely cannot coexist. Then you pay for the second fleet and cut over atomically.",
        },
      },
    },
    {
      id: "flag-service",
      label: "Feature-flag service",
      sub: "release switch, ~5s propagation",
      kind: "database",
      col: 3,
      row: 2,
      detail: {
        what: "A low-latency config store holding flag name, percentage and cohorts, read by every task with a long client-side TTL.",
        why: "It makes deploy and release different events. The binary ships dark with both code paths and the flag at 0%. The risky moment is then a flip that reverts in ~5s globally without touching a single task, rather than a fleet operation.",
        numbers: [
          { value: "~5s global propagation SLO", explain: "How quickly a flag change reaches every task, without redeploying or restarting any of them." },
          { value: "three orders of magnitude faster than a ~45s rollback", explain: "The comparison that makes a flag flip the preferred first response over a digest rollback whenever it is available." },
        ],
        breaks: {
          failure: "If the flag service is unavailable, clients must serve last-known values and fail to the safe default of off.",
          handled: "That failure mode turns an outage into frozen-but-correct behaviour, rather than a fleet-wide behaviour change nobody asked for.",
        },
        choice: {
          pick: "Flags in a read-mostly config store with client caching and fail-to-off",
          instead: "Shipping the behaviour change on directly and using a redeploy to turn it off.",
          decider:
            "Undo latency. A flag flip reverts in ~5s with no fleet operation. The same change as a deploy is ~45s at best on the canary rung, and a full ladder to undo everywhere.",
          flips: "Changes that cannot be switched anyway: runtime upgrades, dependency bumps, schema. There the flag is a fiction and the ladder plus expand/contract is the only real protection.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "source-host",
      to: "pipeline-controller",
      tier: "hot",
      step: 1,
      label: "push / PR webhook",
      detail: {
        what: "The event carrying repo, ref, SHA and event type into the controller, which creates a run record.",
        why: "It is the only signal that a commit exists, and its delivery guarantee belongs to somebody else. Run creation is idempotent on (repo_id, sha, spec_hash), and a reconciliation poller enqueues anything the webhook lost.",
        numbers: [
          { value: "~50k commits/day", explain: "The daily volume of trigger events this edge carries." },
          { value: "gap detector runs every 5 min", explain: "How often the reconciliation poller checks for commits the webhook might have dropped." },
        ],
        breaks: {
          failure: "A dropped delivery is silent: the commit simply never builds.",
          handled: "Nothing complains because nothing was expecting it, which is exactly why a periodic gap detector exists rather than relying on delivery guarantees alone.",
        },
      },
    },
    {
      id: "e2",
      from: "pipeline-controller",
      to: "schema-gate",
      tier: "control",
      label: "destructive DDL lint",
      detail: {
        what: "Migration files in the change are handed to the lint, which classifies each statement and looks for narrowing or destructive DDL.",
        why: "The cheapest place to stop an irreversible schema change is before the artifact exists. Once the column is dropped in production there is no code-side recovery, so this check is worth more than any amount of deploy-time care.",
        breaks: {
          failure: "It only inspects DDL that goes through the tooling.",
          handled: "A hand-run statement bypasses the whole gate without leaving a trace in the pipeline, an accepted gap outside this check's reach.",
        },
      },
    },
    {
      id: "e3",
      from: "pipeline-controller",
      to: "build-scheduler",
      tier: "hot",
      step: 2,
      label: "DAG of ~140 jobs",
      detail: {
        what: "Expanded job records with their stage, dependencies and hard constraints, emitted to the scheduler for placement.",
        why: "Expansion and placement are separate concerns. The controller knows what must run and in what order; the scheduler knows where there is a worker that satisfies arch, RAM and image digest. Keeping them apart lets the farm be resized without touching pipeline semantics.",
        numbers: [
          { value: "~140 jobs on a wide change", explain: "The upper end of job count for one DAG expansion." },
          { value: "12 jobs on an average run", explain: "The typical case, far smaller than a wide multi-service change." },
        ],
        breaks: {
          failure: "Fan-in gates mean one stuck job holds a whole stage.",
          handled: "Job-level timeouts exist for exactly that reason: each shard is bounded independently, so one hung shard fails on its own timeout instead of stalling the entire run indefinitely.",
        },
      },
    },
    {
      id: "e4",
      from: "build-scheduler",
      to: "worker-pool",
      tier: "hot",
      step: 3,
      label: "job + constraints",
      detail: {
        what: "A dispatched job claimed by a warm microVM that resumes from snapshot and starts executing actions.",
        why: "This is the hop the queue-wait SLO measures, enqueue to worker start, and it is the metric engineers actually feel. It degrades before capacity is exhausted, which is exactly what makes it the right autoscaling trigger.",
        numbers: [
          { value: "p95 queue wait < 30s", explain: "The target latency for this hop under normal load." },
          { value: "~800ms snapshot resume", explain: "How much of that latency is the worker actually starting, once one is available." },
        ],
        breaks: {
          failure: "At a merge wave the warm pool depletes and p95 wait becomes cold-boot time.",
          handled: "The pre-boot buffer of ~10% of peak is the real SLO mechanism, not the autoscaler, which reacts too slowly for a sudden merge wave.",
        },
      },
    },
    {
      id: "e6",
      from: "worker-pool",
      to: "action-cache",
      tier: "hot",
      step: 4,
      label: "87% hit, ~40ms",
      detail: {
        what: "A single lookup per action on the key, returning output digests to fetch from the CAS, or a miss that means actually compiling.",
        why: "This is the hot path of the entire build side and the reason the fleet is affordable. 240M actions a day are attempted; ~87% of them are answered without executing anything.",
        numbers: [
          { value: "240M actions/day, ~13% miss", explain: "The scale of traffic this lookup absorbs, with only a small fraction falling through to real execution." },
          { value: "~4M genuinely new keys/day", explain: "13% of 240M miss (~31M/day), but most were computed before and evicted by the 21-day LRU window; only these 4M set the real compute floor." },
          { value: "~6TB/day of new cache content", explain: "The daily growth this cache absorbs from those genuinely new keys." },
        ],
        breaks: {
          failure: "A wrong hit is invisible: the build goes green, the artifact ships.",
          handled: "You learn about it from a nightly re-execution sample already overtaken by the release train, which is why hermeticity is enforced up front rather than relied on afterward.",
        },
      },
    },
    {
      id: "e7",
      from: "worker-pool",
      to: "artifact-store",
      tier: "hot",
      step: 5,
      label: "~60MB novel chunks",
      detail: {
        what: "The ~500MB of build output uploaded content-addressed, so only chunks the store has never seen cross the wire.",
        why: "Adjacent builds of the same service share most of their bytes, so uploading whole artifacts would be ~100TB/day of pointless transfer. The signed provenance attestation is written here too, recording inputs as well as outputs.",
        numbers: [
          { value: "~500MB artifact, ~60MB novel", explain: "How little of a typical artifact is actually new bytes once deduplication is applied." },
          { value: "~65% chunk dedup", explain: "The overall deduplication rate across adjacent builds of the same service." },
        ],
        breaks: {
          failure: "Provenance has to record input digests, not just outputs.",
          handled: "Without input digests you cannot enumerate which shipped artifacts consumed a poisoned cache key after a hermeticity failure, which is why both are written here.",
        },
      },
    },
    {
      id: "e8",
      from: "artifact-store",
      to: "deploy-controller",
      tier: "hot",
      step: 6,
      label: "pinned digest",
      detail: {
        what: "One signed, immutable artifact identified by digest, handed to the deploy side as the thing to ship.",
        why: "This is the hinge of the whole design. The build side stops here and the deploy side never rebuilds, so the object that goes to production is byte-identical to the object that passed.",
        numbers: [{ value: "~1,600 new artifacts reach production/day", explain: "The rate this hop actually feeds into deployment out of the much larger daily build volume." }],
        breaks: {
          failure: "If anything downstream resolves a mutable tag rather than a digest, rollback stops being a lookup.",
          handled: "Every claim about a 45-second restore quietly becomes false in that case, which is why every consumer downstream is required to pin by digest, never a tag.",
        },
      },
    },
    {
      id: "e9",
      from: "deploy-controller",
      to: "rollout-ladder",
      label: "1%, fresh baseline",
      tier: "hot",
      step: 7,
      detail: {
        what: "Phase 1: 100 of 10,000 tasks take the new digest while an equal-sized population is freshly restarted on the old one.",
        why: "Comparability comes before statistics. Measured against long-running incumbents the canary shows JIT warm-up, heap age and cold connection pools. The classic result is a canary reading 15% worse on p99 that is completely fine.",
        numbers: [
          { value: "100 canary tasks, 100 baseline", explain: "The exact size of the first exposure, matched to a freshly restarted comparison group." },
          { value: "spread across at least 2 AZs and instance types", explain: "How the canary population is distributed, so no single host or zone can dominate the comparison." },
        ],
        breaks: {
          failure: "If canary tasks land on one host or one AZ, a single degraded machine can impersonate a bad build.",
          handled: "That could roll back a healthy deploy on the strength of one bad host, which is why placement across zones and instance types is enforced rather than left to chance.",
        },
      },
    },
    {
      id: "e10",
      from: "rollout-ladder",
      to: "fleet",
      tier: "hot",
      step: 8,
      label: "5% to 25% to cell",
      detail: {
        what: "Each passed rung widens the population running the new digest, task by task, until the whole fleet is converged.",
        why: "The ramp is the only bound on unrecoverable effects. Rollback undoes the binary but never the emails sent or payments captured. So the product of a 1% first rung is not the statistics, it is capping those effects at 1% of traffic for 10 minutes.",
        numbers: [
          { value: "10 min, 15, 15, 30, then 60 per region", explain: "The full bake-time schedule this edge advances through as the ladder climbs." },
          { value: "freeze window checked at each of 5 rungs", explain: "The rollout re-checks whether a freeze applies at every single step, not just at the start." },
        ],
        breaks: {
          failure: "Pushing a 500MB artifact to 10,000 tasks at once is ~5TB of egress in minutes.",
          handled: "That would saturate the object store, so regional mirrors and in-cell peer distribution carry the load instead of the origin store.",
        },
      },
    },
    {
      id: "e11",
      from: "fleet",
      to: "canary-analyser",
      tier: "control",
      label: "error rate + p99",
      detail: {
        what: "The analyser polls the metrics system every 30s for the two arms' error rate, p99 latency and declared business counters.",
        why: "It reads the existing metrics pipeline rather than owning its own, because the numbers a rollout is judged on must be the same numbers the on-call sees. Freshness is checked per interval so a lagging pipeline is distinguishable from a healthy service.",
        numbers: [
          { value: "30s poll interval", explain: "How often this edge samples the two comparison arms." },
          { value: "~23k requests/arm to decide", explain: "The sample size the analyser waits to accumulate before a verdict is statistically meaningful." },
        ],
        breaks: {
          failure: "A gapped metrics pipeline gives the analyser nothing to compare.",
          handled: "The only safe reading of no data is hold and page, never pass, since treating silence as health is exactly how a bad digest would reach global.",
        },
      },
    },
    {
      id: "e12",
      from: "canary-analyser",
      to: "deploy-controller",
      tier: "control",
      label: "PASS / REGRESS",
      detail: {
        what: "The verdict that either advances the ladder one rung or replaces the canary tasks with the pinned previous digest and pages.",
        why: "This is the only loop in the system and it is the loop that matters. It is what makes the rollout automatic rather than a human watching a dashboard. It closes in ~45 seconds because the previous artifact never went anywhere.",
        numbers: [
          { value: "restore in ~45s", explain: "How fast a REGRESS verdict actually reverses exposure on the canary population." },
          { value: "two consecutive bad intervals to fire", explain: "The confirmation this verdict requires before acting, to avoid reacting to a single noisy sample." },
        ],
        breaks: {
          failure: "The verdict only covers the compute tier.",
          handled: "It cannot undo a migration, an email or a published event, so a green rollback here can still leave the incident open for those side effects.",
        },
      },
    },
    {
      id: "e13",
      from: "fleet",
      to: "artifact-store",
      tier: "data",
      label: "fetch by digest, ~5TB",
      offset: 90,
      detail: {
        what: "Each task pulls the artifact it has been assigned, by digest, from a regional mirror or from a peer in its own cell.",
        why: "Deploy-time bandwidth is a real bottleneck, not a footnote: 500MB to 10,000 tasks is ~5TB in a few minutes. Mirrors plus in-cell peer distribution keep it off the origin store, at the cost of a distribution path that is harder to debug.",
        numbers: [
          { value: "~500MB per task", explain: "The size each individual task fetches to update itself to the new digest." },
          { value: "artifact fetch p99 < 20s", explain: "The latency target this hop is held to, even under fleet-wide fetch pressure." },
        ],
        breaks: {
          failure: "If a region's object store degrades the deploy must block rather than proceed with a partially updated fleet.",
          handled: "Proceeding anyway would leave a mixed-version state nobody chose, so the deploy pauses instead of pressing forward blind.",
        },
      },
    },
    {
      id: "e14",
      from: "schema-gate",
      to: "deploy-controller",
      tier: "control",
      label: "expand deployed?",
      offset: 110,
      detail: {
        what: "The gate queries deploy records for that service and refuses the change unless the matching expand digest has finished its ladder globally.",
        why: "It is the one place the build plane depends on deploy-plane state, and it has to. Whether a contract phase is safe is a question about what is actually running everywhere, not about what has been merged.",
        numbers: [{ value: "rename = 4 deploys over ~2 weeks", explain: "The realistic multi-deploy timeline this dependency enforces for one safe schema rename." }],
        breaks: {
          failure: "If the deploy records are wrong or partially replicated the gate can misjudge the state.",
          handled: "It either blocks a safe change or, worse, waves through a contract phase while some region still runs the old reader, which is why deploy-record accuracy is itself monitored.",
        },
      },
    },
    {
      id: "e15",
      from: "deploy-controller",
      to: "flag-service",
      tier: "control",
      label: "ship dark, flag at 0%",
      detail: {
        what: "The binary carries both code paths and the flag stays at 0% through the entire rollout, so the deploy changes nothing a user can see.",
        why: "Separating deploy from release is what turns the risky moment into a switch. The fleet operation and the behaviour change stop being the same event, which means they can be undone independently and at wildly different speeds.",
        breaks: {
          failure: "A change that is not actually behind the flag ships live with the binary.",
          handled: "The ladder is then the only protection it has, which is why code review specifically checks that risky changes are properly gated before merge.",
        },
      },
    },
    {
      id: "e16",
      from: "flag-service",
      to: "fleet",
      tier: "data",
      label: "release flip, ~5s",
      detail: {
        what: "Tasks read the flag with a long client TTL and change behaviour when the percentage moves, with no restart and no scheduling operation.",
        why: "This is the fastest undo in the system by three orders of magnitude, which is why deploy and release are deliberately different words. Externally visible effects go behind the same flag so their blast radius is bounded by the ramp.",
        numbers: [
          { value: "~5s global propagation", explain: "How fast a flag change reaches every task in the fleet." },
          { value: "0 tasks touched, 0 restarts", explain: "The operational cost of this change, in contrast to a full deploy or rollback." },
        ],
        breaks: {
          failure: "Clients must cache last-known values and default to off when the flag service is unreachable.",
          handled: "Without that fallback, an outage in a read-mostly config store would become a behaviour change everywhere at once, rather than a safely frozen state.",
        },
      },
    },
  ],
  figures: {
    "expand-contract": {
      title: "Four deploys expand a schema before contracting it",
      nodes: [
        {
          id: "a",
          label: "A: add + dual-write",
          sub: "expand phase",
          kind: "service",
          col: 0,
          row: 0,
          detail: {
            what: "Add the new column and write both the old and new column on every write.",
            why: "Rollback stays safe through this step and the next two, because the old column is still there and still correct.",
          },
        },
        { id: "b", label: "B: backfill", sub: "background job", kind: "service", col: 0, row: 1 },
        { id: "c", label: "C: read new column", sub: "still dual-write", kind: "service", col: 0, row: 2 },
        {
          id: "d",
          label: "D: drop old column",
          sub: "irreversible",
          kind: "database",
          col: 0,
          row: 3,
          detail: {
            what: "Drop the old column, once nothing depends on the old shape.",
            why: "This is the only irreversible step in the sequence, and it runs weeks after A, once nothing depends on the old shape.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "a", to: "b", tier: "hot", step: 1, label: "then" },
        { id: "e2", from: "b", to: "c", tier: "hot", step: 2, label: "then" },
        { id: "e3", from: "c", to: "d", tier: "hot", step: 3, label: "weeks later" },
      ],
    },
  },
};
