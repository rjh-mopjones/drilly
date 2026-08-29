import type { Diagram } from "./types";

export const CICD: Diagram = {
  id: "cicd",
  title: "CI/CD Pipeline",
  question: "Design a CI/CD & Code Deployment System",
  sourceId: "patterns",
  itemId: 54,
  overview: {
    shape:
      "Two systems joined by one immutable object: a build farm that turns a commit into a signed artifact pinned by digest, and a deploy controller that walks that exact digest onto the fleet slowly enough to take it back out.",
    beats: [
      "The build side starts as a compilation of intent. A webhook lands, the controller reads the pipeline spec at the head SHA rather than from a UI, and expands it into a DAG of around 140 jobs with fan-out shards and fan-in gates. Reading the spec at the SHA is what makes what ran reconstructible months later.",
      "Then almost nothing runs. Every action is keyed by SHA-256 of its complete declared inputs, argv plus sorted env plus input file digests plus toolchain digest, and around 87% of those keys are answered from a content-addressed store in ~40ms. That turns 24 worker-minutes per run into 5.5, and a 14,300-worker fleet into 3,250. The cache is the entire economics.",
      "The precondition is hermeticity, not hit rate. An action that reads something it did not declare lets two runs with the same key produce different outputs, and the cache serves one of them silently behind a green build. A slow build is visible; a wrong cache hit is not, and it ships. That is why the sandbox and toolchain pinning land before the cache does.",
      "Workers are one Firecracker microVM per job, resumed from snapshot in ~800ms and destroyed after. CI executes code written by whoever opened the pull request while holding the keys to production, so a shared host kernel is the wrong trust boundary and nothing long-lived is stored on a worker: the job exchanges an OIDC token for a 15-minute scoped credential.",
      "The artifact is the hinge. One signed, digest-addressed object crosses from the build plane to the deploy plane, and it is never rebuilt. Everything the deploy side claims about rollback speed rests on the fact that the previous artifact still exists and pushing it is the same mechanism that pushed the new one.",
      "The deploy side is a risk problem solved by going slowly and measuring. 1% of tasks take the new digest against a freshly restarted baseline on the old one, the analyser needs ~23k requests per arm to call an error-rate doubling, so the rung bakes for 10 minutes and the ladder climbs 5%, 25%, one cell, region by region to global at ~3h50m. A REGRESS verdict restores the pinned previous digest in ~45 seconds.",
    ],
    crux:
      "Rolling back code is trivial because you still hold the artifact, pinned by digest. Rolling back state is not: a migration that dropped a column makes redeploying the previous binary a worse outage than the one you are recovering from. So schema changes expand before they contract, N and N-1 always coexist, and the behaviour change ships dark behind a flag.",
    numbers: [
      "87% cache hit rate: ~3,250 workers, not ~14,300",
      "~23k requests per arm, so a 10 minute bake at 100 req/s",
      "rollback to the pinned previous digest in ~45s",
    ],
  },
  nodes: [
    {
      id: "build-plane",
      label: "Build plane: a throughput problem",
      kind: "zone",
      detail: {
        what: "Everything from the pipeline spec to the finished artifact: DAG expansion, scheduling, ephemeral execution and the caches that stop most of it executing at all.",
        why: "This half is sized by arithmetic rather than by risk. 200k runs a day at 24 uncached worker-minutes each is a fleet nobody will fund, so the design pressure is entirely about answering actions without running them, and about keeping that answer correct.",
        numbers: ["200k pipeline runs/day", "2.4M jobs/day", "240M action executions/day"],
        breaks:
          "A lockfile or toolchain bump invalidates the root of the graph, every action misses, and the plane needs 4x its capacity for a day.",
      },
    },
    {
      id: "source-host",
      label: "Source host (#39)",
      sub: "push / PR webhook",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The code host that fires a webhook on every push and pull request, carrying repo, ref, SHA and event.",
        why: "It is drawn outside the boundary because it is the one part of the trigger path you do not run, and its delivery guarantee is weaker than the pipeline needs. Around 50k commits a day arrive this way and nothing else tells you a commit exists.",
        numbers: ["~50k commits/day", "~200k pipeline runs/day"],
        breaks:
          "A dropped webhook means a commit silently never builds, and the absence is invisible, which is why a gap detector compares main SHAs against pipeline_runs every 5 minutes.",
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
        why: "The pipeline that runs has to be the pipeline that was reviewed. Reading the spec at the SHA is what makes what ran reconstructible; test selection then walks the reverse dependency graph of the changed files and drops a 500k test suite to ~18k in 24 shards.",
        numbers: ["~140 jobs in a wide PR DAG", "500k tests to ~18k, 24 shards", "~3k tests/run org-wide after selection"],
        breaks:
          "Run creation must be idempotent on (repo_id, sha, spec_hash), or webhook redelivery and the reconciliation poller both build the same commit twice.",
        choice: {
          pick: "Declarative spec versioned in-repo, read at the head SHA",
          instead: "An imperative pipeline configured in a UI and stored in the control plane.",
          decider:
            "Whether you can reconstruct what ran. Across 200k runs a day a UI-configured pipeline drifts from the code it builds and there is no record tying a 3-week-old green build to the steps that produced it. Reading the spec at the SHA makes the pipeline part of the reviewed change.",
          flips:
            "A handful of long-lived pipelines that almost never change, where in-repo YAML is ceremony and a UI is genuinely easier for the people who own it.",
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
        what: "A CI check that rejects DROP COLUMN, DROP TABLE or a narrowing type change unless the matching expand phase is already recorded as globally deployed.",
        why: "This is where the rollback promise is actually enforced, weeks before anyone needs it. Expand/contract as a convention is a convention people forget under deadline; as a gate in the build path it is a property of the system.",
        numbers: ["4 deploys over ~2 weeks for a column rename", "checks the deploys table for the expand digest"],
        breaks:
          "It only sees DDL that goes through the migration tooling. A destructive statement run by hand against production leaves the gate green and the rollback path already gone.",
        choice: {
          pick: "Expand/contract enforced as a CI gate against deployed state",
          instead: "Running migrations in a pre-deploy hook, one deploy per schema change.",
          decider:
            "Migration duration against the rollback SLO of p95 under 5 minutes. Backfilling 400M rows in chunked batches at ~20k rows/s is ~6 hours, and on the deploy path those 6 hours sit inside the rollback path. Destructive DDL is worse than slow: once the column is gone, rollback time is undefined, not long.",
          flips:
            "Additive, bounded migrations under 1M rows and 10 seconds on a table with exactly one writing service. One deploy is simpler there and the four-step ceremony is overhead, provided the destructive-DDL gate itself stays on.",
        },
      },
    },
    {
      id: "build-scheduler",
      label: "Build Scheduler (#36)",
      kind: "service",
      sub: "constraint match, fair queue",
      col: 1,
      row: 1,
      parent: "build-plane",
      detail: {
        what: "Bin-packs job records onto a heterogeneous worker pool, matching hard constraints such as arch, RAM and image digest, under per-team weighted fair queueing.",
        why: "Not a FIFO queue. Jobs carry constraints that cannot be traded (macOS notarisation needs Apple hardware, GPU tests need an accelerator) and fairness has to be structural, because one repo's 4-hour dependency-upgrade run will otherwise starve every other team on the farm.",
        numbers: ["2.4M jobs/day", "p95 queue wait < 30s", "provisioned at rho = 0.7"],
        breaks:
          "Small pools are where queueing theory bites: the macOS pool is ~90 concurrent at peak on 120 machines, so p95 wait there is minutes at a utilisation the x86 pool absorbs without noticing.",
        choice: {
          pick: "Constraint-aware bin packing with per-team weighted fair queueing",
          instead: "A single FIFO queue per pool shape.",
          decider:
            "Head-of-line blocking at 2.4M jobs a day. One team's 4-hour upgrade run fills a FIFO and every other team's 8-minute PR waits behind it, which blows the p95 queue wait SLO of 30s for people who did nothing wrong. Fairness has to be enforced at dispatch because it cannot be recovered later.",
          flips:
            "A single-team farm where there is nobody to be unfair to, and FIFO plus a priority lane for the release branch is the whole requirement.",
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
        what: "Hardware-virtualised guests resumed from a snapshot pool in ~800ms, mounting nothing from the host, network denied by default, destroyed after a single job. Each job exchanges a signed OIDC token for a credential scoped to that repo and ref, so nothing durable ever sits on the box.",
        why: "A VM's isolation boundary at roughly a container's start-up cost. A container shares the host kernel, and this fleet executes code written by whoever opened the pull request, so the kernel is the wrong trust boundary no matter how good the seccomp profile is. The same logic sets the credential model: a fully compromised build should yield something that expires in 15 minutes and touches one repo's resources, not a long-lived secret a vault read would hand it.",
        numbers: [
          "~800ms snapshot resume",
          "~3,250 workers at peak, 4 vCPU each",
          "~10% (~330) kept pre-booted warm",
          "15-min OIDC-exchanged creds, zero long-lived secrets on workers",
        ],
        breaks:
          "The warm pool is what the queue-wait SLO actually rests on: at a merge wave it depletes, and observed p95 wait becomes cold-boot time rather than queueing. And the credential broker's trust policy is the whole security boundary: a loose ref pattern hands scoped production access to any branch a contributor can create. Fork PRs get a credential-free pool entirely.",
        choice: {
          pick: "One Firecracker microVM per job, discarded after",
          instead: "Containers on a shared, reused host with a hardened seccomp profile.",
          decider:
            "The trust boundary against start-up cost. A microVM resumes from snapshot in ~800ms, so isolation costs a fraction of an 8-minute run, and 4.4x fewer of them are needed once the cache lands. Reused hosts also leak state between jobs, which quietly breaks the hermeticity the cache depends on.",
          flips:
            "A farm building only trusted first-party code where nested virtualisation is unavailable, for example inside another cloud VM, and containers are the only option on offer.",
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
        numbers: ["~87% hit rate, ~40ms p50 lookup", "5.5 worker-min/run cached vs 24", "~126TB CAS on a 21-day LRU window"],
        breaks:
          "A non-hermetic action makes the cache serve a wrong output behind a green build. Detection is a nightly re-execution of ~0.5% of hits diffing output digests, which is ~3% extra compute and is sampling, not proof.",
        choice: {
          pick: "Content-addressed action cache keyed by a hash of all declared inputs",
          instead: "No action cache: every job builds from source on a clean worker and you buy machines instead.",
          decider:
            "The hit rate needed to make the fleet affordable. At 87% a run costs 24 x 0.13 + 2.4 = 5.5 worker-minutes instead of 24, so peak demand is ~3,250 workers and ~13,000 vCPU rather than ~14,300 and ~57,000. At 70% it is ~5,700 workers, a 75% cost increase, so most of the saving lives in the last fifteen points.",
          flips:
            "Builds that are not hermetic and cannot cheaply be made so: an unsandboxed toolchain from the host image, tests that reach the network, codegen that embeds timestamps. Also below roughly 200 workers, where 4.4x of a small number does not pay for a CAS, a sandbox and a poisoning canary.",
        },
      },
    },
    {
      id: "artifact-store",
      label: "Artifact store (#21)",
      kind: "database",
      sub: "signed, immutable, by digest",
      col: 1,
      row: 2,
      detail: {
        what: "Digest-addressed, chunk-deduplicated object storage holding every artifact with a signed provenance attestation recording its inputs.",
        why: "This is the hinge between the two halves, and the reason rollback is a lookup rather than a rebuild. The thing you roll back to is the exact object that passed the pipeline, not a rebuild from the same SHA that might differ.",
        numbers: ["~500MB per artifact, ~100TB/day raw", "~1.32PB logical, ~650TB provisioned after dedup", "deployed artifacts kept 2 years"],
        breaks:
          "Retention has to be reference-counted against the deploys table, not purely time-based. Expiring the rollback target of a service nobody has redeployed in three months deletes the recovery path silently, and you find out during the incident.",
        choice: {
          pick: "Immutable digest-addressed artifacts with signed provenance",
          instead: "Rebuilding from the commit SHA at deploy time, or mutable tags such as latest.",
          decider:
            "Whether rollback is a lookup or a build. Restoring the previous digest is ~45 seconds; rebuilding from source is an 8-minute pipeline you are running during an incident, and it may not reproduce. Chunk dedup across adjacent builds is ~65%, which is what keeps 100TB/day of raw output inside ~650TB provisioned.",
          flips:
            "Tiny artifacts on a truly hermetic toolchain where a rebuild is seconds and byte-identical, so storing every build buys nothing over rebuilding on demand.",
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
        numbers: ["~2k deploy records/day", "~1,500 services, one lease each", "rollback SLO p95 < 5 min"],
        breaks:
          "Two concurrent rollouts for one service, say an automated main-branch deploy and a manual hotfix, put three versions in the fleet and make every canary comparison meaningless, which is why a per-service lease (#35) excludes them.",
        choice: {
          pick: "One control plane owning the path from artifact to fleet",
          instead: "A reconciler per environment that continuously drives running version toward a declared version.",
          decider:
            "Auditability against blast radius. A single control plane gives one answer to what ran and what shipped across ~1,500 services and makes policy real because policy is in the path; the cost is that a control-plane outage is a company-wide deploy freeze. A reconciler keeps deploying while CI is down but splits the audit story across two systems.",
          flips:
            "Once the pipeline's own availability has burned you. A reconciler makes rollback an edit to a small piece of declared state, which keeps working when the control plane does not.",
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
        why: "Each rung widens the failure domain by an amount you can name out loud, and the first rung caps unrecoverable effects at 1% of traffic for 10 minutes. The region ladder takes the lowest-traffic region first so the largest population is last and has the most evidence behind it.",
        numbers: ["1% = 100 of 10,000 tasks", "first cell gets 30 min, 1 of 12", "merge to global ~3h50m"],
        breaks:
          "The 1% canary must run against an equal-sized baseline population freshly restarted on the old digest, or you measure JIT warm-up and heap age instead of the change and read 15% worse on p99 for no reason.",
        choice: {
          pick: "Canary ladder on a rolling substrate",
          instead: "Blue-green: stand up a second full fleet, verify out of band, cut over at the load balancer.",
          decider:
            "Double capacity against detection speed. Rolling holds capacity flat and the first 10 minutes of exposure is 1% of users, at the price of ~3h50m to global. Blue-green cuts over in ~30s with the fastest undo available, but needs 10,000 extra tasks for the cutover window and gives no gradual signal: 100% of users find the regression simultaneously.",
          flips:
            "A mixed-version fleet that is genuinely unsafe, such as a wire format you could not make N/N-1 compatible; or a fleet small enough that doubling 40 tasks is a rounding error; or verification that is a deterministic smoke test rather than a statistical comparison.",
        },
      },
    },
    {
      id: "canary-analyser",
      label: "Canary analyser (#17)",
      sub: "canary vs restarted baseline",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "Polls the metrics system every 30s and scores a small fixed set (error rate, p99 latency, one or two declared business counters) on both arms, returning PASS, REGRESS or hold.",
        why: "Bake time is a sample-size calculation, not a ritual. Detecting a 0.1% error rate doubling at 95% confidence and 80% power needs ~23k requests per arm, which at 100 req/s is ~4 minutes, so the rung is 10 minutes for margin rather than an arbitrary two.",
        numbers: ["~23k requests per arm", "p99 verdicts only trusted from the 5% rung", "~431k per arm for a 20% relative effect"],
        breaks:
          "Missing data is never a pass. If the metrics pipeline gaps, the rollout holds at its current rung and pages, because interpreting silence as health is how a bad digest reaches global.",
        choice: {
          pick: "Two-proportion test on a small fixed metric set, two consecutive bad intervals to fire",
          instead: "Threshold alarms on many metrics, or a human eyeballing a dashboard for two minutes.",
          decider:
            "False positives destroy the gate faster than false negatives do. Scoring many metrics at once means multiple-comparison noise auto-rolls-back healthy deploys and teams switch the gate off; requiring two consecutive bad 30s intervals costs 30 seconds of detection and removes most of it.",
          flips:
            "A service under ~500 req/s, where a 1% canary sees 0.5 req/s and needs ~13 hours to reach significance. There the honest move is to label the stage as not a gate and rely on fast rollback and synthetic probes.",
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
        why: "It is drawn as one node because from the controller's point of view it is one number: how many tasks are on which digest. The reconciliation loop compares desired against actual digest distribution per cell, which is how a crashed controller's mess is found.",
        numbers: ["10,000 tasks, 10k req/s", "~6 min of mixed versions per rolling deploy", "~5TB egress to push a 500MB artifact fleet-wide"],
        breaks:
          "N and N-1 serve simultaneously for several minutes during any rolling deploy, so a change that is not backward-compatible is already broken before anyone thinks about undoing it.",
        choice: {
          pick: "Roll in place with N/N-1 compatibility as a hard gate",
          instead: "Drain and replace behind a maintenance window, or a full second fleet per deploy.",
          decider:
            "Mixed versions are unavoidable, not a choice. A rolling deploy across 10,000 tasks leaves both versions serving for ~6 minutes, so compatibility is a precondition for deploying at all without downtime, and rollback is simply the case where you are most grateful you had it.",
          flips:
            "In-process state that cannot be drained, or a storage format where two versions genuinely cannot coexist. Then you pay for the second fleet and cut over atomically.",
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
        why: "It makes deploy and release different events. The binary ships dark with both code paths and the flag at 0%, so the risky moment is a flip that reverts in ~5s globally without touching a single task, rather than a fleet operation.",
        numbers: ["~5s global propagation SLO", "three orders of magnitude faster than a ~45s rollback"],
        breaks:
          "If the flag service is unavailable, clients must serve last-known values and fail to the safe default of off, so an outage degrades to frozen-but-correct rather than a fleet-wide behaviour change nobody asked for.",
        choice: {
          pick: "Flags in a read-mostly config store with client caching and fail-to-off",
          instead: "Shipping the behaviour change on directly and using a redeploy to turn it off.",
          decider:
            "Undo latency. A flag flip reverts in ~5s with no fleet operation; the same change as a deploy is ~45s at best on the canary rung and a full ladder to undo everywhere. The cost is a growing pile of switches and a combinatorial test surface.",
          flips:
            "Changes that cannot be switched anyway: runtime upgrades, dependency bumps, schema. There the flag is a fiction and the ladder plus expand/contract is the only real protection.",
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
      label: "push / PR webhook",
      detail: {
        what: "The event carrying repo, ref, SHA and event type into the controller, which creates a run record.",
        why: "It is the only signal that a commit exists, and its delivery guarantee belongs to somebody else, so run creation is idempotent on (repo_id, sha, spec_hash) and a reconciliation poller enqueues anything the webhook lost.",
        numbers: ["~50k commits/day", "gap detector runs every 5 min"],
        breaks:
          "A dropped delivery is silent: the commit simply never builds, and nothing complains because nothing was expecting it.",
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
        breaks:
          "It only inspects DDL that goes through the tooling, so a hand-run statement bypasses the whole gate without leaving a trace in the pipeline.",
      },
    },
    {
      id: "e3",
      from: "pipeline-controller",
      to: "build-scheduler",
      tier: "hot",
      label: "DAG of ~140 jobs",
      detail: {
        what: "Expanded job records with their stage, dependencies and hard constraints, emitted to the scheduler for placement.",
        why: "Expansion and placement are separate concerns: the controller knows what must run and in what order, the scheduler knows where there is a worker that satisfies arch, RAM and image digest. Keeping them apart lets the farm be resized without touching pipeline semantics.",
        numbers: ["~140 jobs on a wide change", "12 jobs on an average run"],
        breaks:
          "Fan-in gates mean one stuck job holds a whole stage, so job-level timeouts have to exist or a single hung shard stalls the run indefinitely.",
      },
    },
    {
      id: "e4",
      from: "build-scheduler",
      to: "worker-pool",
      tier: "hot",
      label: "job + constraints",
      detail: {
        what: "A dispatched job claimed by a warm microVM that resumes from snapshot and starts executing actions.",
        why: "This is the hop the queue-wait SLO measures, enqueue to worker start, and it is the metric engineers actually feel. It degrades before capacity is exhausted, which is exactly what makes it the right autoscaling trigger.",
        numbers: ["p95 queue wait < 30s", "~800ms snapshot resume"],
        breaks:
          "At a merge wave the warm pool depletes and p95 wait becomes cold-boot time, so the pre-boot buffer of ~10% of peak is the real SLO mechanism, not the autoscaler.",
      },
    },
    {
      id: "e6",
      from: "worker-pool",
      to: "action-cache",
      tier: "hot",
      label: "87% hit, ~40ms",
      detail: {
        what: "A single lookup per action on the key, returning output digests to fetch from the CAS, or a miss that means actually compiling.",
        why: "This is the hot path of the entire build side and the reason the fleet is affordable. 240M actions a day are attempted; ~87% of them are answered without executing anything, which is a 4.4x reduction in worker-minutes per run.",
        numbers: ["240M actions/day, ~13% miss", "~4M genuinely new keys/day", "~6TB/day of new cache content"],
        breaks:
          "A wrong hit is invisible: the build goes green, the artifact ships, and you learn about it from a nightly re-execution sample that has already been overtaken by the release train.",
      },
    },
    {
      id: "e7",
      from: "worker-pool",
      to: "artifact-store",
      tier: "hot",
      label: "~60MB novel chunks",
      detail: {
        what: "The ~500MB of build output uploaded content-addressed, so only chunks the store has never seen cross the wire.",
        why: "Adjacent builds of the same service share most of their bytes, so uploading whole artifacts would be ~100TB/day of pointless transfer. The signed provenance attestation is written here too, recording inputs as well as outputs.",
        numbers: ["~500MB artifact, ~60MB novel", "~65% chunk dedup"],
        breaks:
          "Provenance has to record input digests, not just outputs, or you cannot enumerate which shipped artifacts consumed a poisoned cache key after a hermeticity failure.",
      },
    },
    {
      id: "e8",
      from: "artifact-store",
      to: "deploy-controller",
      tier: "hot",
      label: "pinned digest",
      detail: {
        what: "One signed, immutable artifact identified by digest, handed to the deploy side as the thing to ship.",
        why: "This is the hinge of the whole design. The build side stops here and the deploy side never rebuilds, so the object that goes to production is byte-identical to the object that passed, and the previous one is still sitting there addressed by its own digest.",
        numbers: ["~1,600 new artifacts reach production/day"],
        breaks:
          "If anything downstream resolves a mutable tag rather than a digest, rollback stops being a lookup and every claim about a 45-second restore quietly becomes false.",
      },
    },
    {
      id: "e9",
      from: "deploy-controller",
      to: "rollout-ladder",
      label: "1%, fresh baseline",
      tier: "hot",
      detail: {
        what: "Phase 1: 100 of 10,000 tasks take the new digest while an equal-sized population is freshly restarted on the old one.",
        why: "Comparability comes before statistics. Measured against long-running incumbents the canary shows JIT warm-up, heap age and cold connection pools, and the classic result is a canary reading 15% worse on p99 that is completely fine.",
        numbers: ["100 canary tasks, 100 baseline", "spread across AZs and instance types"],
        breaks:
          "If canary tasks land on one host or one AZ, a single degraded machine can impersonate a bad build and roll back a healthy deploy.",
      },
    },
    {
      id: "e10",
      from: "rollout-ladder",
      to: "fleet",
      tier: "hot",
      label: "5% to 25% to cell",
      detail: {
        what: "Each passed rung widens the population running the new digest, task by task, until the whole fleet is converged.",
        why: "The ramp is the only bound on unrecoverable effects. Rollback undoes the binary but never the emails sent or payments captured, so the product of a 1% first rung is not the statistics, it is capping those effects at 1% of traffic for 10 minutes.",
        numbers: ["10 min, 15, 15, 30, then 60 per region", "freeze checked at every rung"],
        breaks:
          "Pushing a 500MB artifact to 10,000 tasks at once is ~5TB of egress in minutes and saturates the object store, so regional mirrors and in-cell peer distribution carry it.",
      },
    },
    {
      id: "e11",
      from: "fleet",
      to: "canary-analyser",
      tier: "control",
      label: "error rate + p99 (#17)",
      detail: {
        what: "The analyser polls the metrics system every 30s for the two arms' error rate, p99 latency and declared business counters.",
        why: "It reads the existing metrics pipeline rather than owning its own, because the numbers a rollout is judged on must be the same numbers the on-call sees. Freshness is checked per interval so a lagging pipeline is distinguishable from a healthy service.",
        numbers: ["30s poll interval", "~23k requests/arm to decide"],
        breaks:
          "A gapped metrics pipeline gives the analyser nothing to compare, and the only safe reading of no data is hold and page, never pass.",
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
        why: "This is the only loop in the picture and it is the loop that matters: it is what makes the rollout automatic rather than a human watching a dashboard, and it closes in ~45 seconds because the previous artifact never went anywhere.",
        numbers: ["restore in ~45s", "two consecutive bad intervals to fire"],
        breaks:
          "The verdict only covers the compute tier. It cannot undo a migration, an email or a published event, so a green rollback here can still leave the incident open.",
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
        numbers: ["~500MB per task", "artifact fetch p99 < 20s"],
        breaks:
          "If a region's object store degrades the deploy must block rather than proceed with a partially updated fleet, which is a mixed-version state nobody chose.",
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
        why: "It is the one place the build plane depends on deploy-plane state, and it has to: whether a contract phase is safe is a question about what is actually running everywhere, not about what has been merged.",
        numbers: ["expand must be globally deployed", "rename = 4 deploys over ~2 weeks"],
        breaks:
          "If the deploy records are wrong or partially replicated the gate either blocks a safe change or, worse, waves through a contract phase while some region still runs the old reader.",
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
        breaks:
          "A change that is not actually behind the flag ships live with the binary, and the ladder is then the only protection it has.",
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
        numbers: ["~5s global propagation", "no task is touched"],
        breaks:
          "Clients must cache last-known values and default to off when the flag service is unreachable, or an outage in a read-mostly config store becomes a behaviour change everywhere at once.",
      },
    },
  ],
};
