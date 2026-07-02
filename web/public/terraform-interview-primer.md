---
type: interview-prep
---

# Terraform / IaC Interview Primer — 333 Questions

Comprehensive Q+A primer for senior Terraform / Infrastructure-as-Code / platform-engineering interviews. Fourth entry in the DevOps track — sister note to the [[Linux Interview Primer]], [[Kubernetes Interview Primer]], and [[Observability Interview Primer]]. Everything the plan/apply model rests on: HCL, providers, resources & data sources, state (local & remote), state surgery, modules & module design, drift, workspaces, the resource graph, testing & policy, CI/CD, security, and running Terraform at scale.

Each answer is interview-shaped: opinionated, concrete, real HCL and `terraform` CLI, state mechanics, failure modes, and production tradeoffs. Terraform 1.x (`moved`/`import` blocks, `-refresh-only`); the OpenTofu fork noted where it matters. Cloud-agnostic examples.

1. [[#IaC Fundamentals & Terraform Overview]]
2. [[#The Core Workflow & the Plan]]
3. [[#HCL Language]]
4. [[#Providers]]
5. [[#Resources & Data Sources]]
6. [[#State Fundamentals]]
7. [[#Remote State & Backends]]
8. [[#State Operations & Manipulation]]
9. [[#Variables, Outputs & Locals]]
10. [[#Modules]]
11. [[#Module Design & Reuse]]
12. [[#Drift Detection & Reconciliation]]
13. [[#Workspaces & Environment Management]]
14. [[#Provisioners & Resource Lifecycle]]
15. [[#Dependencies & the Resource Graph]]
16. [[#Testing, Validation & Policy]]
17. [[#CI/CD & Automation]]
18. [[#Security & Secrets]]
19. [[#Terraform at Scale]]
20. [[#Upgrades, Migration & Troubleshooting]]
21. [[#Scenario & Best-Practice Playbooks]]

---

## IaC Fundamentals & Terraform Overview

### Summary

**What this topic covers**

The conceptual ground floor: what Infrastructure as Code actually buys you, where Terraform sits in that landscape, and how its core loop works before you write a single resource. Three concern areas live here: (1) the **IaC premise** — why codifying infrastructure beats clicking through consoles (reproducibility, version control, peer review, disaster recovery, drift elimination); (2) the **positioning** — declarative vs imperative, and Terraform versus Ansible, CloudFormation, CDK, Pulumi, and Crossplane, so you can say *when* to reach for each; and (3) the **execution model** — HCL as a deliberately-constrained DSL, the `init → plan → apply → destroy` workflow, the provider/plugin architecture, idempotency and convergence, and the OpenTofu fork that followed HashiCorp's license change. The 16 questions here are the warm-ups every platform/DevOps interview opens with. Get them crisp and the interviewer moves on to state and modules; fumble "declarative vs imperative" and you spend the rest of the hour recovering.

**Mental model**

Think of Terraform as a **convergence engine over a desired-state document**. You don't tell it *how* to build infrastructure step by step — you describe the end state you want (this VPC, these subnets, this database), and Terraform figures out the create/update/delete operations needed to make reality match. It does this by reading your config, reading its **state file** (its record of what it built last time), querying the real provider APIs, and computing the diff. Two properties fall out of this: **idempotency** (running apply twice with no config change is a no-op — the second run converges to the same state) and **a dependency graph** (Terraform builds a DAG from your references and parallelises independent work). The other shift is that Terraform is **provider-agnostic orchestration**: it owns the workflow and the graph, but every actual API call is delegated to a **provider plugin** (AWS, GCP, Azure, Cloudflare, Kubernetes). Terraform itself knows nothing about EC2 — the AWS provider does.

**Key terms**

- **Infrastructure as Code (IaC)** — defining and provisioning infrastructure through machine-readable config files under version control, rather than manual console/CLI actions.
- **Declarative** — you describe the desired end state; the tool computes the steps. Terraform, CloudFormation.
- **Imperative / procedural** — you script the ordered steps. Ansible playbooks, shell scripts.
- **HCL (HashiCorp Configuration Language)** — Terraform's DSL: declarative, typed, purpose-built — deliberately *not* a general-purpose programming language.
- **Provider** — a plugin that maps HCL resource types to a real API (aws, google, azurerm, kubernetes). Downloaded by `init`.
- **State** — Terraform's record (`terraform.tfstate`) mapping config resources to real-world resource IDs; the thing it diffs against.
- **Plan** — the proposed set of create/update/delete/replace actions Terraform will take to converge.
- **Idempotency** — applying the same config repeatedly yields the same result; no change means no action.
- **Convergence** — the process of driving real infrastructure toward the declared desired state.
- **Drift** — real infrastructure diverging from state, usually via out-of-band console changes.
- **OpenTofu** — the open-source fork of Terraform created after HashiCorp relicensed to the BSL; now under the Linux Foundation, drop-in compatible with Terraform 1.x.
- **Immutable infrastructure** — you replace servers/resources rather than mutating them in place; Terraform's replace behaviour leans this way.

**Why interviewers ask this**

This is the "do you understand the paradigm, or have you just memorised HCL syntax" filter. Junior candidates describe Terraform as "the thing that makes AWS resources." Senior candidates articulate *why* declarative-desired-state matters operationally: a code-reviewed, versioned plan you can read before it runs is fundamentally safer than a runbook of console clicks, and it gives you disaster recovery for free (the config *is* the rebuild instructions). The Terraform-vs-Ansible question is a classic — it separates people who reach for the right tool (Terraform provisions, Ansible configures) from people who've only ever used one. The OpenTofu question is a 2024-onward signal that you follow the ecosystem and understand licensing risk. Interviewers want a platform engineer who can *choose* tools and justify the choice, not a Terraform monoculturist.

**Common confusions**

- "Terraform is a configuration management tool like Ansible." No — Terraform *provisions* infrastructure (creates the VMs); config management *configures* what's inside them (installs packages). Overlapping but distinct jobs.
- "Declarative means Terraform runs in a random order." No — declarative means *you* don't specify order; Terraform derives order from a dependency graph.
- "The provider is part of Terraform." No — providers are separately-versioned plugins downloaded by `init`; Terraform core is provider-agnostic.
- "OpenTofu is a different tool I'd have to relearn." No — it's a drop-in fork; `.tf` files and the CLI are compatible.
- "Idempotent means it does nothing." No — it means the *outcome* is stable; the first apply does the work, subsequent applies converge to no-op only if nothing changed.

**What follows from this topic**

Everything. The plan/apply loop introduced here is dissected in **The Core Workflow & the Plan**. HCL-as-a-DSL sets up the deep dive in **HCL Language**. The state file mentioned in passing is its own critical topic. The provider model previews resources, data sources, and provider configuration. Nail these fundamentals first — the rest of the primer assumes you can reason in desired-state, graph, and convergence terms without re-explaining them.

### Q1. What is Infrastructure as Code, and why does it matter?

**Infrastructure as Code (IaC)** is the practice of defining your infrastructure — networks, compute, databases, DNS, IAM — in machine-readable configuration files that live in version control, rather than provisioning it by hand through a web console or ad-hoc CLI commands.

Why it matters, concretely:

- **Reproducibility** — the same config produces the same infrastructure in dev, staging, and prod. No "it works in staging because someone clicked a box there two years ago."
- **Version control** — every change is a diff with an author, a timestamp, and a commit message. You can `git blame` a security group rule.
- **Peer review** — infrastructure changes go through pull requests. A second engineer sees the plan before it touches production.
- **Disaster recovery** — the config *is* the rebuild procedure. Lose a region, re-apply, get it back. No tribal knowledge locked in one person's head.
- **No click-ops drift** — when the console is not the source of truth, environments stop silently diverging.

The one-line pitch: IaC turns infrastructure from a set of manual, unauditable actions into a reviewable, testable, repeatable software artifact.

### Q2. What's the difference between declarative and imperative infrastructure tooling? Which is Terraform?

**Imperative** = you write the *steps*. "Create a VM. Then attach a disk. Then open port 443." If you run it twice, you need your own logic to avoid creating two VMs.

**Declarative** = you write the *desired end state*. "There should be one VM with this disk and port 443 open." The tool figures out what actions are needed to get there from wherever you currently are.

Terraform is **declarative**. You describe the target; Terraform reads its state, compares it to the desired config, and computes the minimal set of create/update/delete operations to converge.

```hcl
# Declarative: I want this to exist. Terraform decides create vs update vs no-op.
resource "aws_s3_bucket" "logs" {
  bucket = "acme-app-logs"
}
```

The practical payoff: **idempotency comes for free**. Run apply once, it creates the bucket. Run it again with no change, it does nothing — Terraform sees the desired state already matches reality. With an imperative script you'd have to write "does this bucket already exist?" checks yourself.

### Q3. Terraform vs Ansible — when would you use each?

They solve adjacent but different problems, and mature platforms often use both.

| | Terraform | Ansible |
|---|---|---|
| Primary job | **Provisioning** infrastructure (VMs, networks, DBs) | **Configuration management** (packages, files, services on a host) |
| Model | Declarative desired state | Primarily procedural (ordered tasks; idempotent modules) |
| State | Maintains a state file | Stateless — inspects the host each run |
| Agent | Agentless (calls cloud APIs) | Agentless (SSH/WinRM into hosts) |
| Sweet spot | Standing up cloud resources | Configuring what runs *inside* those resources |

Rule of thumb: **Terraform builds the house; Ansible furnishes the rooms.** Use Terraform to create the servers, load balancers, and databases. Use Ansible to install and configure software on those servers. In immutable-infrastructure shops Ansible's role shrinks (you bake images with Packer instead), but the boundary holds: Terraform provisions, config management configures.

### Q4. How does Terraform compare to CloudFormation?

**CloudFormation** is AWS's native IaC service; **Terraform** is cloud-agnostic.

| | Terraform | CloudFormation |
|---|---|---|
| Cloud scope | Multi-cloud + thousands of providers | AWS only |
| State | You manage state (local or remote backend) | AWS manages state for you (stacks) |
| Language | HCL | JSON/YAML (or CDK on top) |
| Drift handling | `plan` shows drift; refined tooling | Drift detection exists but weaker |
| Ecosystem | Huge provider/module registry | AWS-native, tight service integration |

Key trade-offs: CloudFormation means **no state file to secure or lock** (AWS handles it) and same-day support for new AWS features, but it's a walled garden — useless for Cloudflare DNS, Datadog monitors, or a second cloud. Terraform's HCL is far more pleasant than raw CloudFormation YAML, and one tool spans your whole stack. Most multi-cloud or SaaS-heavy shops pick Terraform; deep single-cloud AWS shops sometimes stay on CloudFormation for the managed state and native support.

### Q5. Where do CDK and Pulumi fit? How are they different from Terraform?

Both let you define infrastructure in a **general-purpose programming language** (TypeScript, Python, Go, C#) instead of a DSL.

- **AWS CDK** — you write code that *synthesises CloudFormation templates*. AWS-scoped (there's CDK for Terraform — `cdktf` — which synthesises Terraform instead).
- **Pulumi** — general-purpose languages over a Terraform-like engine and provider model; multi-cloud, maintains state like Terraform.

The core difference from Terraform is **HCL (a declarative DSL) vs a real programming language**. Real languages give you loops, functions, classes, unit tests, and IDE tooling for free — powerful for large teams building abstractions. The cost: it's easy to write clever, hard-to-review infrastructure, and the imperative feel can obscure what actually gets created. Terraform's HCL is deliberately dumber, which makes plans easier to read and review. Choose Pulumi/CDK when your team thinks in code and wants strong abstractions; choose Terraform/HCL when reviewability and a low-magic plan are the priority.

### Q6. What is Crossplane and how does it differ from Terraform?

**Crossplane** is Kubernetes-native infrastructure provisioning. Instead of a CLI + state file, you install Crossplane into a Kubernetes cluster and declare infrastructure as **Kubernetes custom resources**. The Kubernetes control loop continuously reconciles them — if something drifts, the controller actively fixes it, no `apply` required.

The key differences from Terraform:

- **Continuous reconciliation** vs Terraform's **run-based** model. Crossplane constantly enforces state; Terraform only acts when you run `plan`/`apply`.
- **State lives in the Kubernetes API / etcd**, not a `.tfstate` file you manage.
- **GitOps-native** — you drive it by committing YAML that ArgoCD/Flux syncs into the cluster.

You'd pick Crossplane when you're already all-in on Kubernetes and want infrastructure managed by the same control plane and GitOps flow as your apps. You'd pick Terraform when you want a simpler, run-based tool without a Kubernetes dependency, or a mature module ecosystem. Some shops use Terraform to bootstrap the cluster, then Crossplane inside it.

### Q7. Given all these tools, how do you decide which to use?

A pragmatic decision path:

- **Provisioning cloud/SaaS infrastructure, multi-provider, want reviewable plans** → Terraform (or OpenTofu).
- **Deep single-cloud AWS, want AWS-managed state and same-day feature support** → CloudFormation.
- **Team wants real code, abstractions, and unit tests over infra** → Pulumi or CDK.
- **Already Kubernetes-native, want GitOps + continuous reconciliation** → Crossplane.
- **Configuring software *inside* existing hosts** → Ansible (alongside, not instead of, Terraform).

The senior framing: these aren't mutually exclusive. A common stack is **Terraform for infrastructure + Ansible/Packer for image config + Crossplane or Helm for in-cluster resources.** Interviewers reward "here's the boundary between provisioning and configuration, and here's why I'd combine them," not tribal "Terraform for everything."

### Q8. Why is HCL a DSL rather than a full programming language, and is that a limitation?

HCL is **declarative and deliberately constrained** — it has variables, expressions, functions, `for` comprehensions, and conditionals, but no arbitrary imperative control flow, no classes, no I/O beyond what providers expose. This is a design choice, not an oversight.

The rationale: infrastructure config should be **readable and reviewable by anyone**, and a `plan` should be a faithful, low-magic preview of what will happen. A general-purpose language makes it trivial to write infrastructure whose behaviour you can't predict by reading it — loops that generate hundreds of resources, runtime branches, hidden side effects. HCL's limits keep configs closer to "a document describing desired state" than "a program."

Is it limiting? Sometimes — you occasionally hit walls where you wish you had a real loop or function, and you reach for `for_each`, `dynamic` blocks, `templatefile`, or external data sources. When those feel painful, that's often the signal to step up to Pulumi/CDK. But for most teams the constraint is a feature: it's what makes Terraform plans trustworthy in code review.

### Q9. Walk me through the core Terraform workflow.

The canonical loop is **write → init → plan → apply → (destroy)**:

```bash
# 1. write .tf files describing desired state (done in your editor)

# 2. init — download providers, configure backend, install modules
terraform init

# 3. plan — compute the diff between desired config and real state
terraform plan

# 4. apply — execute the plan, create/update/delete real resources
terraform apply

# 5. destroy — tear it all down (dev/ephemeral environments)
terraform destroy
```

- **write** — author HCL for the resources you want.
- **init** — one-time (per config/backend change) setup: pulls provider plugins, sets up the state backend, downloads modules.
- **plan** — the safety gate: shows exactly what will change before anything happens. Read this like a code review.
- **apply** — makes reality match config; prompts for approval unless `-auto-approve`.
- **destroy** — removes everything the config manages; mostly for ephemeral/test environments.

The plan/apply split is the heart of it: you always get to see and approve the change before it lands.

### Q10. What exactly does `terraform init` do?

`init` is the setup step you run first, and again whenever providers, backend, or modules change. It does three main things:

- **Downloads and installs provider plugins** — reads `required_providers`, resolves versions against constraints, downloads the binaries into `.terraform/`, and records exact versions + checksums in `.terraform.lock.hcl`.
- **Configures the backend** — initialises where state lives (local file, S3, GCS, Terraform Cloud) and, if you're migrating backends, offers to move existing state.
- **Installs modules** — downloads any modules referenced by `source` (registry, git, local path) into `.terraform/modules/`.

```bash
terraform init            # normal
terraform init -upgrade   # re-resolve provider versions to newest allowed
```

It's safe to run repeatedly and it doesn't touch real infrastructure. A common CI gotcha: forgetting that changing a provider version or backend config requires a fresh `init` before `plan` will work.

### Q11. What do idempotency and convergence mean in Terraform?

**Idempotency**: applying the same configuration multiple times produces the same result. The first `apply` does the work; a second `apply` with an unchanged config is a **no-op** because Terraform sees that reality already matches desired state.

**Convergence**: the process of driving real infrastructure toward the declared desired state, regardless of the current starting point. Terraform doesn't care how things got the way they are — it computes the delta from *now* to *desired* and closes the gap.

Together they're why Terraform is safe to re-run: it's not blindly executing "create a bucket" every time (which would fail or duplicate). It's asserting "a bucket like this should exist" and only acting when that assertion isn't already true. This is the fundamental difference from an imperative shell script, where re-running is often dangerous. It's also why drift matters: if someone changes infrastructure out of band, the *next* apply converges it back to what the code says.

### Q12. Explain Terraform's provider/plugin model.

Terraform **core** knows nothing about any specific cloud. It handles config parsing, the dependency graph, state, and the plan/apply lifecycle. Every actual API call is delegated to a **provider** — a separately-distributed plugin.

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}
```

- Providers are **downloaded by `init`** from a registry and pinned via `required_providers` + version constraints, with exact versions locked in `.terraform.lock.hcl`.
- Each provider exposes **resource types** (`aws_instance`, `aws_s3_bucket`) and **data sources** (read-only lookups), and maps Terraform's create/read/update/delete to the target API's CRUD.
- **Provider aliases** let you configure the same provider multiple times — e.g. two AWS regions or accounts — and route resources to a specific one via `provider = aws.us_west`.

This plugin architecture is why Terraform spans AWS, GCP, Azure, Kubernetes, Cloudflare, Datadog, and thousands more with a single core and one workflow.

### Q13. What makes Terraform "cloud-agnostic," and can one config span multiple providers?

Cloud-agnostic means Terraform's **core engine and workflow are the same regardless of target** — the cloud-specific knowledge lives entirely in providers. Learn `plan`/`apply`/state once, apply it everywhere.

And yes, a single configuration can span multiple providers at once — this is a real strength:

```hcl
resource "aws_instance" "app" {
  ami           = "ami-0abcdef"
  instance_type = "t3.micro"
}

resource "cloudflare_record" "app" {
  zone_id = var.zone_id
  name    = "app.acme.com"
  type    = "A"
  value   = aws_instance.app.public_ip   # cross-provider reference
}
```

Here Terraform provisions an EC2 instance *and* the Cloudflare DNS record pointing at it, in one plan, with the dependency graph wiring the IP from AWS into Cloudflare automatically. That cross-provider orchestration in a single graph is something single-cloud tools like CloudFormation simply can't do. It's the concrete answer to "why not just use the cloud's native IaC?"

### Q14. What is OpenTofu, why does it exist, and does it matter to me?

**OpenTofu** is an open-source fork of Terraform. It exists because in August 2023 HashiCorp **relicensed Terraform from the MPL (open source) to the BSL (Business Source License)** — a source-available license that restricts commercial competition. The community responded by forking the last MPL version; the fork became **OpenTofu, now stewarded by the Linux Foundation.**

Why it matters:

- **Licensing risk** — the BSL introduces terms some legal/procurement teams won't accept, and forbids building a competing product on Terraform. OpenTofu stays under a permissive open-source license.
- **Drop-in compatibility** — OpenTofu is compatible with Terraform 1.x: same HCL, same CLI (`tofu` instead of `terraform`), same providers and modules. Migration is low-friction.
- **Divergence over time** — the two are gradually adding independent features (OpenTofu shipped state encryption and early-eval variables), so long-term they'll differ, but the base is shared.

The interview signal: knowing this shows you track the ecosystem and think about supply-chain/licensing risk, not just syntax. For a new platform, OpenTofu is a defensible default; for an existing Terraform estate, migration is usually straightforward if licensing becomes a concern.

### Q15. Where does Terraform fit in a platform-engineering or GitOps toolchain?

Terraform is typically the **provisioning layer** that other tools build on:

- **VCS + PRs** — `.tf` lives in git; changes go through pull requests with the `plan` posted as a comment for review.
- **CI/CD** — a pipeline (GitHub Actions, GitLab CI, Atlantis, Spacelift, Terraform Cloud) runs `plan` on PRs and `apply` on merge to main, with the state backend locked so runs serialise.
- **Secrets** — pulled from Vault, cloud secret managers, or CI secrets — never committed.
- **Downstream** — Terraform stands up the Kubernetes cluster, networking, databases, and IAM; then Helm/ArgoCD/Flux deploy apps *into* it, and config tools (Ansible) or baked images handle host config.

In a GitOps model, git is the source of truth and merges trigger applies. Terraform is a strong fit for the "day-0/day-1" infrastructure layer, though for continuously-reconciled in-cluster resources some teams pair it with Crossplane. The senior point: Terraform rarely stands alone — it's the foundation other layers sit on.

### Q16. What's the difference between immutable and mutable infrastructure, and how does Terraform relate?

**Mutable infrastructure**: you change servers in place — SSH in, patch, update config, restart. Over time each server accumulates a unique history (**configuration drift** and "snowflake servers").

**Immutable infrastructure**: you never modify a running resource. To change it, you build a **new** one from a versioned image and replace the old — like functional programming for servers. No drift, trivial rollback (redeploy the previous image), reproducible.

Terraform leans toward immutability. Many changes it makes are **replacements** — when an attribute can't be updated in place, Terraform destroys and recreates the resource (the `-/+` in a plan). Combined with baked images (Packer) and `create_before_destroy`, this gives you an immutable flow: new AMI → new instances → swap → tear down old. That said, Terraform *can* update in place where the provider supports it, so it's not purely immutable. The lifecycle meta-arguments (`create_before_destroy`, `prevent_destroy`) exist precisely to control this replace-vs-update behaviour safely.

## The Core Workflow & the Plan

### Summary

**What this topic covers**

The mechanics of how Terraform actually changes infrastructure, with the **plan** as the centrepiece. If the previous topic was "what is Terraform," this is "what happens when you press the button." Three concern areas: (1) the **plan/apply lifecycle** — refresh, graph, diff, execution plan, and the CRUD operations providers run; (2) **reading and controlling plans** — the `+ ~ -/+ -` symbols, why replacement is dangerous, saved plan files, `-target`, `-replace`, `-refresh-only`, parallelism, and auto-approve; and (3) the **failure and automation model** — why apply isn't transactional, what a mid-apply failure leaves behind, `destroy`, plan determinism, drift in plans, and exit codes for CI. The 16 questions span warm-up ("what does plan do") to senior ("apply died halfway — walk me through recovery" and "design a CI gate around saved plans"). This is the topic that separates people who *run* Terraform from people who *operate* it safely.

**Mental model**

A **plan is a proposal, an apply is an attempt.** When you run `plan`, Terraform does four things in order: **refresh** (read the real state of everything it manages), **build the graph** (a DAG from your resource references), **diff** (compare desired config against refreshed state), and **produce an execution plan** — an ordered list of create/update/delete/replace actions. Crucially, the plan is a *prediction*. When you `apply`, Terraform walks the same graph and calls provider CRUD operations to realise it — but the world can refuse. An API can error, a quota can be hit, a resource can already exist. **Terraform is not transactional**: there is no rollback. If apply creates three resources and the fourth fails, those three exist and are recorded in state; you fix the problem and re-run, and Terraform converges from where it stopped. Internalising "plan predicts, apply attempts, nothing rolls back" is what makes you cautious in the right places — especially around replacements.

**Key terms**

- **Refresh** — Terraform reading real infrastructure to update its in-memory state before diffing.
- **Execution plan** — the ordered list of actions (create/update/delete/replace) Terraform proposes.
- **`+` create** — resource will be created.
- **`~` update in place** — resource will be modified without destruction.
- **`-/+` replace (recreate)** — resource will be destroyed and recreated; often disruptive.
- **`-` destroy** — resource will be deleted.
- **Saved plan file** — `terraform plan -out=tfplan` captures an exact plan to `apply` later, unchanged.
- **`-target`** — limit an operation to specific resources; an escape hatch, not routine.
- **`-replace`** — force recreation of a resource (successor to `taint`).
- **`-refresh-only`** — reconcile state with reality without changing infrastructure.
- **Parallelism** — how many resource operations Terraform runs concurrently (default 10).
- **`-detailed-exitcode`** — plan exit codes (0/1/2) for CI to detect "changes pending."

**Why interviewers ask this**

The plan is where Terraform's safety story lives, and how you talk about it reveals operational maturity. Junior candidates run `apply` and trust it. Senior candidates read a plan like a diff, flag a `-/+` replace on a stateful database before it wipes data, and know that apply can fail partway leaving partial state. The "apply died halfway" scenario is a favourite because there's no rollback — the only correct answer is "inspect state, fix the cause, re-run to converge," and getting there shows you understand Terraform isn't transactional. The saved-plan and exit-code questions probe whether you've built real CI (plan on PR, apply the *exact* reviewed plan on merge). And `-target` is a trap: reaching for it casually is a red flag; knowing it's an emergency escape hatch is the senior tell.

**Common confusions**

- "Apply rolls back if it fails." It doesn't. Partial changes persist and are recorded in state; you re-run to converge.
- "Plan and apply always agree." Usually, but not guaranteed — the world can change between them, which is exactly why saved plan files exist.
- "`-target` is a normal way to speed things up." No — it's an escape hatch that produces a partial, potentially inconsistent apply. Habitual use hides real problems.
- "Replace is just an update." No — `-/+` destroys and recreates, which can drop data, change IPs, and cause downtime.
- "Refresh changes infrastructure." No — refresh only updates Terraform's view of state; `-refresh-only` reconciles state, still without altering real resources.

**What follows from this topic**

The plan is your window into everything else. Drift (from **IaC Fundamentals**) shows up here as unexpected `~`/`-/+` lines. State is what refresh reads and what a failed apply leaves partially written. The lifecycle meta-arguments (`create_before_destroy`, `prevent_destroy`) are how you tame the dangerous replaces you learn to spot here. And the CI patterns — saved plans, exit codes, locked backends — are how teams operationalise this loop. Master reading a plan and the rest of Terraform becomes far less scary.

### Q1. Walk me through the plan/apply lifecycle in detail.

`terraform apply` (or `plan`) runs through distinct phases:

1. **Refresh** — Terraform queries the provider APIs for the real current state of every resource it manages and updates its in-memory copy of state. This is how it detects drift. (You can skip it with `-refresh=false`.)
2. **Build the dependency graph** — it parses your config, resolves references between resources, and builds a **DAG**. This determines order and what can run in parallel.
3. **Diff / compute the plan** — for each resource it compares desired config against the refreshed state and decides: no change, create, update in place, replace, or destroy.
4. **Present the execution plan** — the human-readable list of `+ ~ -/+ -` actions, with a summary count.
5. **Apply** — on approval, Terraform walks the graph and calls provider **CRUD** operations to realise the plan, writing results back to state as it goes.

```bash
terraform plan             # phases 1–4, no changes made
terraform apply            # phases 1–5, prompts before phase 5
```

The plan/apply split exists so a human (or CI) can review phase 4 before phase 5 touches anything.

### Q2. What does `terraform plan` actually compute?

`plan` produces a **proposed execution plan** without changing any infrastructure. Under the hood it:

- **Refreshes** — reads real resource state from the providers (unless `-refresh=false`).
- **Builds the graph** — a DAG of your resources and their dependencies.
- **Diffs** — compares your desired config against the refreshed state, resource by resource.
- **Emits the plan** — the ordered set of create/update/delete/replace actions plus a summary like `Plan: 2 to add, 1 to change, 0 to destroy.`

The output is a **prediction**, not a guarantee — it's what Terraform *intends* to do based on state at plan time. Read it like a code review diff: every line is a change you're authorising. The single most valuable habit in Terraform is actually reading the plan before approving, especially scanning for destroys and replaces on anything stateful.

### Q3. How do you read a Terraform plan? What do the symbols mean?

Terraform prefixes each planned change with a symbol:

| Symbol | Meaning | Danger |
|---|---|---|
| `+` | **Create** a new resource | Low |
| `~` | **Update in place** | Usually low |
| `-/+` | **Replace** — destroy then recreate | **High** |
| `+/-` | Replace, but create the new one first (`create_before_destroy`) | Medium |
| `-` | **Destroy** | High |

```text
  # aws_db_instance.main must be replaced
-/+ resource "aws_db_instance" "main" {
      ~ instance_class = "db.t3.medium" -> "db.t3.large"  # forces replacement
      ...
    }
```

The one to fear is **`-/+` replace**: Terraform will *destroy and recreate* the resource. For a database that can mean data loss; for a server, a new IP and downtime. The plan tells you *why* — look for the `# forces replacement` annotation on the offending attribute. When you see `-/+` on anything stateful, stop and think before approving. Also always check the bottom-line summary: `Plan: X to add, Y to change, Z to destroy` — a surprise `Z > 0` is your cue to investigate.

### Q4. Why is a replacement dangerous, and how do you handle one safely?

A **replacement** (`-/+`) means destroy-then-recreate. It's dangerous because:

- **Data loss** — replacing a database or stateful volume can wipe data.
- **Downtime** — the old resource is gone before the new one is ready.
- **Changed identifiers** — new IPs, new IDs, breaking anything that referenced the old one.

Replacements happen when you change an attribute the provider can't update in place (the plan annotates it `# forces replacement`).

How to handle safely:

- **Read the plan** and identify *which attribute* forces replacement — sometimes it's an accidental change you can revert.
- Use **`create_before_destroy`** so the new resource is built before the old is torn down (turns `-/+` into `+/-`), reducing downtime.
- Use **`prevent_destroy`** on critical stateful resources so an accidental replace fails the plan instead of running.
- For databases, prefer **in-place changes** or a managed migration path over letting Terraform recreate.

```hcl
resource "aws_db_instance" "main" {
  lifecycle {
    prevent_destroy = true   # refuse to destroy/replace this
  }
}
```

### Q5. Why can `apply` fail partway through, and what does that leave behind?

Because **Terraform is not transactional — there is no rollback.** The plan is a proposal; realising it means dozens of independent API calls, any of which can fail: a quota limit, an invalid AMI, a name collision, a transient API error, a dependency that isn't actually ready.

When apply fails on, say, the 4th of 6 resources:

- The **3 resources that succeeded exist for real** and are **recorded in state**.
- The failing resource may be **partially created** or absent.
- The remaining resources are **not attempted**.

Terraform does **not** undo the successful ones. What you do next:

```bash
# read the error, fix the root cause (quota, config, dependency), then:
terraform plan    # see what's left to do
terraform apply   # converge from where it stopped
```

Because Terraform is idempotent and converges from current state, re-running picks up where it left off — it won't recreate the 3 that succeeded. The mental model: apply is "attempt to converge," and a failure just means "converged partway; run again after fixing the cause."

### Q6. What are saved plan files and why do they matter in CI?

You can capture a plan to a file and apply that *exact* plan later:

```bash
terraform plan -out=tfplan     # save the plan
terraform apply tfplan         # apply exactly what was planned — no re-plan, no prompt
```

Why this matters, especially in CI:

- **What you review is what you apply.** Without a saved plan, `apply` re-plans against *current* state, which may have changed since your review. The saved plan freezes the reviewed diff.
- **No drift between plan and apply.** Applying a saved plan skips the refresh/diff — it executes the recorded actions, eliminating the race where the world moves between plan and apply.
- **Auditability.** The plan file (and its JSON form via `terraform show -json tfplan`) is an artifact you can archive.

The canonical CI pattern: on a PR, run `plan -out=tfplan` and post it for review; on merge, `apply tfplan` — the identical, approved plan. This is the safest way to run Terraform in automation, and interviewers look for it.

### Q7. What is `-target` and why is it considered an escape hatch?

`-target` limits an operation to specific resources (and their dependencies):

```bash
terraform apply -target=aws_instance.web
```

It's an **escape hatch, not a habit**, because:

- It produces a **partial apply** — only part of your config converges, so state can be left inconsistent with what your code says as a whole.
- The plan you see is **incomplete** — you're not reviewing the full picture.
- Routine use usually **masks a real problem** — a badly-structured config, a dependency issue, or a workflow that should be split into separate states/modules instead.

Legitimate uses: breaking a circular dependency during a tricky refactor, recovering from a partial failure, or surgically fixing one resource in an emergency. Terraform even prints a warning that `-target` is for exceptional use. In an interview, "I use `-target` when a normal apply is too slow" is a red flag; "I reach for `-target` only to recover from a specific failure, then run a full apply to reconcile" is the right answer.

### Q8. How do you force a resource to be recreated? (taint / -replace)

Use **`-replace`** (the modern replacement for the deprecated `taint`):

```bash
terraform apply -replace=aws_instance.web
```

This tells Terraform to plan a **destroy-and-recreate** of that specific resource even though its config hasn't changed — useful when a resource is in a bad state the config can't express (a corrupted VM, a manually-broken instance) and you just want a fresh one.

The old way was two steps:

```bash
terraform taint aws_instance.web   # deprecated — marks for recreation
terraform apply
```

`taint` mutated state to mark the resource; `-replace` does it as a plan-time flag, which is cleaner and reviewable (you see the `-/+` in the plan before approving). Same caution as any replacement: it's a destroy, so mind data and downtime.

### Q9. What do `-refresh-only` and `-refresh=false` do?

They're two ends of the "how much does Terraform sync with reality" dial.

- **`-refresh-only`** — Terraform refreshes state against real infrastructure and shows you the drift, but proposes **no config-driven changes**. Approving it **updates state to match reality** without touching infrastructure. This is the safe way to reconcile detected drift into state.

```bash
terraform plan -refresh-only     # see how state differs from reality
terraform apply -refresh-only    # update state to match reality, change nothing real
```

- **`-refresh=false`** — Terraform **skips** reading real infrastructure and diffs against state as-is. Faster, and useful when you know state is current or the provider API is slow/rate-limited, but it means you might miss drift.

The distinction: `-refresh-only` is "sync state *from* the world"; `-refresh=false` is "don't look at the world at all." Neither changes real infrastructure by itself.

### Q10. What does `-auto-approve` do, and when is it appropriate?

By default `terraform apply` computes a plan and then **prompts** for a `yes` before making changes — a human gate. `-auto-approve` skips that prompt:

```bash
terraform apply -auto-approve
```

When it's appropriate:

- **CI/CD applying a saved plan** — the review already happened at PR time; the pipeline applies the approved artifact non-interactively. (Applying a saved plan file is inherently non-interactive anyway.)
- **Ephemeral/throwaway environments** — spinning up and tearing down test infra where nothing's at stake.

When it's dangerous:

- **Interactive prod applies** — skipping the gate means you don't read the plan, so a surprise destroy or replace runs unreviewed.

The rule: automation earns `-auto-approve` only when the plan was reviewed *before* the apply (saved plans on merge). A human at a terminal typing `-auto-approve` against production has thrown away Terraform's main safety feature.

### Q11. What does `-parallelism` control?

Terraform walks its dependency graph and, for resources with no dependency between them, performs operations **concurrently**. `-parallelism` caps how many it runs at once (**default 10**):

```bash
terraform apply -parallelism=5
```

Why you'd change it:

- **Lower it** when you're hitting provider **API rate limits** or throttling, or to reduce load on a fragile API.
- **Raise it** (occasionally) to speed up a huge apply of many independent resources.

It only affects *independent* work — dependent resources still serialise according to the graph, so it's not a magic speedup. It's a knob for API-friendliness more than performance. Note it's a concurrency limit within a single run, unrelated to state locking (which prevents *different* runs from colliding).

### Q12. How does the resource lifecycle map to provider CRUD operations?

Every Terraform-managed resource maps to four provider operations — the same **CRUD** you know from APIs:

| Terraform action | Provider operation |
|---|---|
| Create (`+`) | **C**reate — call the API to make the resource |
| Refresh / read | **R**ead — fetch current state to diff against |
| Update in place (`~`) | **U**pdate — modify attributes without recreation |
| Destroy (`-`) | **D**elete — remove the resource |
| Replace (`-/+`) | Delete **then** Create (no in-place path) |

The provider decides *which* attributes support Update vs which force a Create-after-Delete replacement — that's baked into the provider's schema. When you see `# forces replacement` in a plan, it means the provider has no Update path for that attribute, so Terraform must Delete + Create. Understanding this explains *why* some changes are cheap (`~`) and others are destructive (`-/+`): it's not Terraform being cautious, it's the underlying API lacking an in-place update for that field.

### Q13. Apply failed halfway. Walk me through recovery.

Step by step, staying calm because Terraform converges:

1. **Read the error.** Terraform prints which resource failed and why — quota, permissions, name collision, dependency-not-ready, transient API error.
2. **Check state.** The resources that succeeded are real and recorded; the failed one may be partial. `terraform state list` and `terraform show` tell you what exists.
3. **Fix the root cause.** Bump the quota, fix the config, add the missing permission, correct the bad reference.
4. **Re-plan.** `terraform plan` — Terraform refreshes, sees the 3 that succeeded already exist, and shows only the remaining work.
5. **Re-apply.** `terraform apply` — it converges from where it stopped. Idempotency means the successful resources aren't recreated.

Key points to say out loud: **there is no rollback** — Terraform is not transactional, so you don't "undo," you fix-and-continue. If a resource was left in a genuinely broken partial state that refresh can't reconcile, you may need `-replace` to recreate it cleanly. Never hand-edit `terraform.tfstate` to "clean up" — use `terraform state` subcommands if state surgery is truly needed.

### Q14. How does `terraform destroy` work, and can you destroy selectively?

`terraform destroy` removes **all** infrastructure the configuration manages. It's the inverse of apply: it builds the graph, then plans and executes **deletes** in reverse dependency order (dependents before dependencies).

```bash
terraform destroy               # plan + destroy everything, with a prompt
terraform destroy -auto-approve # no prompt (ephemeral envs)
```

Selective destroy uses `-target`:

```bash
terraform destroy -target=aws_instance.web   # just this resource (+ what depends on it)
```

Same caveats as `-target` generally — it's for surgical cleanup, not routine use, and leaves the rest of your infra untouched. `destroy` is mainly for **ephemeral environments** (PR preview stacks, test infra you spin up and tear down). For anything production, `prevent_destroy` on critical resources is a good guardrail so a stray `destroy` fails fast rather than wiping a database.

### Q15. Is a Terraform plan deterministic? What can make plan and apply disagree?

A plan is **deterministic given the same config, state, and real-world state** — the diff is a pure function of those inputs. But that determinism has caveats that can make a later apply disagree with an earlier plan:

- **The world changed** — someone modified a resource in the console between plan and apply, so refresh now sees something different.
- **Values not known until apply** — some attributes (a generated ID, a computed IP) show as `(known after apply)` in the plan; the plan can't predict them, and dependent values resolve only at apply time.
- **External data sources / time** — a config that reads `timestamp()`, a remote API, or a `data` source whose result shifts will produce a different plan on each run.
- **Provider behaviour** — occasionally a provider computes a diff differently after an upgrade.

The mitigation for CI is **saved plan files** (`plan -out` then `apply` that file), which freeze the reviewed diff so the apply can't silently disagree. If you ever see "plan showed X but apply did Y," it's almost always one of the above — usually out-of-band drift or `known after apply` values.

### Q16. How do you use plan exit codes to automate Terraform in CI?

Use `-detailed-exitcode` so a pipeline can branch on whether there are pending changes:

```bash
terraform plan -detailed-exitcode
# exit 0 = no changes (infra matches config)
# exit 1 = error
# exit 2 = changes present (a diff exists)
```

This lets CI make decisions without parsing text output:

- **0** → nothing to do; skip the apply step, mark the job green.
- **2** → there's a diff; post the plan for review, or gate an apply.
- **1** → real error; fail the job.

The full automation pattern combines this with saved plans:

```bash
terraform plan -detailed-exitcode -out=tfplan
# if exit code == 2, archive tfplan and require approval;
# on merge, run: terraform apply tfplan
```

Without `-detailed-exitcode`, a plain `plan` exits 0 whether or not there are changes, so CI can't tell "clean" from "drift pending." This flag is the hook that makes drift detection and change-gating scriptable — a strong signal you've built real Terraform automation, not just run it by hand.

## HCL Language

### Summary

**What this topic covers**

HCL — the HashiCorp Configuration Language — as an actual language: its syntax, type system, expressions, and the escape hatches you reach for when declarative config gets awkward. Three concern areas: (1) **structure and types** — blocks, labels, arguments, nested blocks, and the full type system (primitives, collections, structural types, `null`); (2) **expressions and transformation** — interpolation, built-in functions, conditionals, `for` comprehensions, splats, and the type-matching gotchas that bite people; and (3) **generation and rendering** — `dynamic` blocks, heredocs, `templatefile`, `sensitive`, and knowing when HCL's declarative limits mean you should reach for external data or a real language instead. The 17 questions run from "what's a block" to senior judgement calls like "this `dynamic` block is unreadable — what would you do instead" and "when do you give up on HCL and use an external data source." This is where syntax knowledge turns into the ability to write *maintainable* Terraform.

**Mental model**

HCL is **a typed, declarative expression language wrapped around blocks.** Everything is either a **block** (a labelled container: `resource "aws_instance" "web" { ... }`) or an **argument** (a `name = expression` assignment) inside one. The expressions are where the power is: HCL has a real type system and a large standard library of functions, plus comprehensions (`for`) and conditionals — but no imperative control flow, no mutation, no loops-as-statements. You don't write "for each item, do this"; you write an *expression that evaluates to a collection*. The second mental shift is **references build the graph**: writing `aws_instance.web.id` isn't just a value lookup, it's a dependency edge Terraform uses to order operations. So HCL is simultaneously a config format, an expression language, and a graph-description language. When you find yourself fighting it — wanting a loop that HCL won't give you — that friction is information: use `for_each`/`dynamic`, or accept that some logic belongs in `templatefile`, an external data source, or a different tool.

**Key terms**

- **Block** — a container with a type, optional labels, and a body: `resource "type" "name" { ... }`.
- **Argument** — a `name = value` assignment inside a block.
- **Nested block** — a block inside a block (e.g. `ingress { ... }` inside a security group).
- **Primitive types** — `string`, `number`, `bool`.
- **Collection types** — `list(...)`, `set(...)`, `map(...)` — homogeneous elements.
- **Structural types** — `object({...})`, `tuple([...])` — heterogeneous, fixed shape.
- **`null`** — absence of a value; omits an argument / falls back to default.
- **Interpolation** — embedding an expression in a string with `${...}`.
- **`for` expression** — a comprehension producing a list `[for ...]` or map `{for ...}`.
- **Splat** — `list[*].attr`, shorthand for a `for` over a collection's attribute.
- **`dynamic` block** — generates repeated nested blocks from a collection.
- **`templatefile`** — renders an external template with variables, for config files/scripts.
- **Meta-argument** — an argument Terraform interprets specially (`count`, `for_each`, `depends_on`, `lifecycle`, `provider`), available on any resource.

**Why interviewers ask this**

HCL fluency is where "I've read the docs" separates from "I've maintained a large codebase." Anyone can write a `resource` block; the signal is in the expressions. Do you know that both branches of a `?:` must type-match? Can you write a `for` that transforms a list of objects into a keyed map for `for_each`? Do you know that a `dynamic` block, while powerful, can make a module unreadable — and can you argue for when *not* to use one? Interviewers also probe the boundary: "when does HCL stop being the right tool?" A senior answer names the real limits (no true functions/recursion, awkward complex transforms) and the escape hatches (`templatefile`, external data sources, or stepping up to Pulumi). The `sensitive` and `null` questions check whether you understand how values flow and how secrets get suppressed in output. It's the topic that most reveals hands-on depth.

**Common confusions**

- "You always need `${}`." No — in modern HCL you write bare expressions (`ami = var.ami`); `${...}` is only for embedding inside a string.
- "A conditional can return different types per branch." No — both branches of `cond ? a : b` must be the same type, or Terraform errors / forces a conversion.
- "`list` and `set` are interchangeable." No — sets are unordered and deduplicated; `for_each` needs a set/map, `count` needs a list/number. Ordering matters for `count`.
- "`dynamic` blocks are just good practice for repetition." They're powerful but hurt readability; overusing them produces write-only modules.
- "`null` is like empty string / zero." No — `null` means *omit this argument*, falling back to the provider default; `""` or `0` are actual values.
- "`sensitive` encrypts the value." No — it only suppresses the value in CLI output/plan; it's still plaintext in state.

**What follows from this topic**

HCL is the substrate for everything else you write. `for_each` and `count` (introduced here as meta-arguments) get their own deep treatment around resource iteration. The type system underpins variables, outputs, and module interfaces. `templatefile` and `dynamic` recur wherever you generate config. And the "when does HCL run out of road" judgement connects back to **IaC Fundamentals** (HCL-as-a-deliberate-DSL) and forward to modules, where clean interfaces depend on wielding these expressions well. Get comfortable reading a dense `for`/`for_each` expression and most real-world Terraform stops looking like magic.

### Q1. Describe HCL's basic syntax — blocks, labels, arguments.

HCL is built from **blocks** and **arguments**:

```hcl
resource "aws_instance" "web" {   # block type + two labels
  ami           = "ami-0abc123"   # argument: name = value
  instance_type = "t3.micro"

  tags = {                        # argument whose value is a map
    Name = "web"
  }

  root_block_device {             # nested block
    volume_size = 20
  }
}
```

- **Block** — a container with a **type** (`resource`) and zero or more **labels** (`"aws_instance"`, `"web"`), followed by a `{ }` body.
- **Argument** — a `name = expression` assignment inside a block body.
- **Nested block** — a block inside a block (`root_block_device`), used for structured sub-configuration.

The labels are positional and meaningful: for `resource`, the first is the resource *type* and the second is your *local name* (used to reference it: `aws_instance.web.id`). This block/label/argument grammar is uniform across the whole language — `variable`, `output`, `module`, `provider`, `terraform` all follow it.

### Q2. Walk me through HCL's type system.

HCL has three tiers of types:

- **Primitives** — `string`, `number` (int and float unified), `bool`.
- **Collections** (homogeneous — all elements same type):
  - `list(T)` — ordered, indexable, allows duplicates.
  - `set(T)` — unordered, unique elements.
  - `map(T)` — string keys to values of type `T`.
- **Structural** (heterogeneous — fixed shape):
  - `object({ name = string, age = number })` — named attributes with per-attribute types.
  - `tuple([string, number, bool])` — fixed-length, per-position types.
- **`null`** — the absence of a value.

```hcl
variable "config" {
  type = object({
    name     = string
    replicas = number
    tags     = map(string)
    ports    = list(number)
  })
}
```

The practical distinctions that bite: **list vs set** (order and duplicates — `for_each` wants a set/map, `count` wants a list/number), and **object vs map** (object has a known fixed set of typed attributes; map has arbitrary string keys, uniform value type). Declaring precise `type` constraints on variables catches bad inputs at plan time instead of deep inside a resource.

### Q3. When do you need `${}` interpolation, and when don't you?

**Modern HCL (0.12+) evaluates bare expressions**, so you almost never need `${}` for a standalone value:

```hcl
# Correct, modern:
ami           = var.ami
instance_type = var.instance_type
count         = length(var.subnets)
```

You only need `${...}` to **embed an expression inside a string literal** (string interpolation):

```hcl
name = "web-${var.environment}-${var.region}"       # interpolation inside a string
arn  = "arn:aws:s3:::${aws_s3_bucket.b.id}/*"
```

The common mistake — legacy from HCL 0.11 — is wrapping a whole value: `instance_type = "${var.instance_type}"`. That's redundant; Terraform even warns about it. Write `var.instance_type`. Rule: bare expression for the value itself, `${}` only when you're splicing a value into surrounding text.

### Q4. What built-in functions do you reach for most, and by category?

HCL ships a large standard library (no user-defined functions). The workhorses by category:

- **String** — `format`, `join`, `split`, `replace`, `trimspace`, `lower`/`upper`, `substr`.
- **Collection** — `length`, `concat`, `merge`, `lookup`, `keys`, `values`, `flatten`, `distinct`, `contains`, `element`, `coalesce`, `coalescelist`, `zipmap`.
- **Encoding** — `jsonencode`/`jsondecode`, `yamlencode`/`yamldecode`, `base64encode`/`base64decode`.
- **Filesystem** — `file`, `fileexists`, `templatefile`, `pathexpand`.
- **Date/time** — `timestamp`, `timeadd`, `formatdate`.
- **Type/safety** — `try`, `can`, `tostring`, `tonumber`, `tolist`, `toset`.

A few that come up constantly in interviews:

```hcl
merge(var.default_tags, var.extra_tags)        # combine maps, later wins
coalesce(var.name, "default-name")             # first non-null
try(var.config.timeout, 30)                     # value or fallback if it errors
flatten([[1, 2], [3, 4]])                       # -> [1, 2, 3, 4]
jsonencode({ Version = "2012-10-17", ... })     # build IAM policy JSON
lookup(var.amis, var.region, "ami-default")     # map lookup with default
```

`try` and `coalesce` for safe defaults, `merge` for tag composition, `jsonencode` for policies, and `flatten` for un-nesting are the ones you'll use daily.

### Q5. How do conditional expressions work, and what's the type-matching gotcha?

HCL's conditional is the ternary `condition ? true_value : false_value`:

```hcl
instance_type = var.environment == "prod" ? "m5.large" : "t3.micro"
count         = var.enabled ? 1 : 0     # common enable/disable pattern
```

The gotcha: **both result values must be the same type**, or convertible to a common type. Terraform evaluates the *types* of both branches even though only one is returned. This errors:

```hcl
# ERROR-prone: one branch a string, the other a list
value = var.x ? "single" : ["a", "b"]
```

A subtler version: returning `null` vs a typed value is usually fine (null is type-flexible), but returning `[]` vs a `list(string)` with elements is fine, while `"" ` vs a number is not. When you hit a type-mismatch error on a conditional, the fix is to make both branches the same shape — e.g. wrap the scalar branch to match, or use `null` for "omit." Also note the `? 1 : 0` idiom paired with `count` is the classic way to conditionally create a resource.

### Q6. Explain `for` expressions.

`for` expressions are HCL's comprehensions — they transform one collection into another. Two forms:

**List comprehension** — `[for ... : ...]`:

```hcl
# uppercase every name
[for name in var.names : upper(name)]

# with a filter
[for n in var.numbers : n if n > 0]
```

**Map comprehension** — `{for k, v in ... : new_k => new_v}`:

```hcl
# build a map from a list of objects, keyed by name
{ for user in var.users : user.name => user.email }

# transform an existing map
{ for k, v in var.tags : lower(k) => v }
```

You iterate `for x in list` (element) or `for k, v in map` (key + value), optionally with an `if` filter. The list form uses `:` then the element expression; the map form uses `=>` between key and value expressions. The most common real use is **reshaping data for `for_each`** — turning a list of objects into a keyed map so `for_each` has stable keys. `for` is how you do "transform this collection" without an imperative loop.

### Q7. What are splat expressions?

A **splat** is shorthand for a `for` expression over a collection, pulling one attribute from every element:

```hcl
aws_instance.web[*].id
# equivalent to:
[for i in aws_instance.web : i.id]
```

It's most common with resources created via `count` (which produces a list) to collect all their IDs, IPs, or ARNs:

```hcl
output "instance_ids" {
  value = aws_instance.web[*].id      # all IDs as a list
}

output "private_ips" {
  value = aws_instance.web[*].private_ip
}
```

The `[*]` operator also has a handy null-safety behaviour: applied to a single (non-list) value it wraps it in a list, and applied to null it yields an empty list — useful for optional single resources. For `for_each` resources (which produce a *map*, not a list), you use `values(aws_instance.web)[*].id` or a `for` over the map instead, since splat targets lists.

### Q8. What are `dynamic` blocks, and why can they hurt readability?

A `dynamic` block generates **repeated nested blocks** from a collection — the answer to "I need N `ingress` blocks and don't want to copy-paste them":

```hcl
resource "aws_security_group" "web" {
  name = "web"

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.from
      to_port     = ingress.value.to
      protocol    = "tcp"
      cidr_blocks = ingress.value.cidrs
    }
  }
}
```

`for_each` supplies the collection; `content` is the template for each generated block; `ingress.value` (and `.key`) reference the current item.

Why they hurt readability: they add a layer of indirection between the config and the actual resource shape. A reader can no longer see the concrete `ingress` blocks — they have to mentally execute the `for_each` and cross-reference the input variable. Nested `dynamic` blocks compound this into near-unreadable "write-only" code. The senior guidance: use `dynamic` for genuinely variable-length, data-driven nested blocks, but if the count is small and fixed, **write the blocks out explicitly** — the redundancy is cheaper than the indirection.

### Q9. How do heredocs and `templatefile` help with rendering config?

For multi-line strings and rendering external files (cloud-init, config files, scripts), HCL gives you heredocs and `templatefile`.

**Heredoc** — an inline multi-line string:

```hcl
user_data = <<-EOT
  #!/bin/bash
  echo "region=${var.region}" > /etc/app.conf
  systemctl restart app
EOT
```

The `<<-` variant strips leading indentation. Interpolation works inside heredocs.

**`templatefile`** — render an external template file with variables:

```hcl
user_data = templatefile("${path.module}/init.sh.tftpl", {
  region   = var.region
  app_port = var.port
})
```

```bash
# init.sh.tftpl
#!/bin/bash
echo "region=${region}" > /etc/app.conf
echo "port=${app_port}" >> /etc/app.conf
```

`templatefile` supports the full expression language inside the template (`${...}`, `%{ for }`, `%{ if }`), so you can loop and branch while rendering. Use a heredoc for short inline snippets; use `templatefile` when the content is substantial, reused, or benefits from living in its own file with its own syntax highlighting.

### Q10. String interpolation vs template files — when do you use each?

Both inject values into text; the choice is about **size and complexity**:

- **String interpolation / heredoc** — for short, inline text where the config and the value live together. A one-line name, a small user_data snippet, an ARN.

```hcl
name      = "app-${var.env}"
user_data = <<-EOT
  #!/bin/bash
  echo "${var.message}"
EOT
```

- **`templatefile`** — for substantial or reused content: a full nginx config, a multi-section cloud-init, an app config file. Keeping it in a separate `.tftpl` file gives you proper formatting, syntax highlighting, and the ability to loop/branch with `%{ for }` / `%{ if }` directives.

Rule of thumb: if the template is more than a few lines, has its own structure, or you'd want to lint/highlight it as (say) shell or YAML, pull it into a file and use `templatefile`. Inline interpolation for the small stuff, `templatefile` when the text becomes a document in its own right.

### Q11. What's the difference between arguments and meta-arguments?

- **Arguments** are **resource-specific** — defined by the provider's schema for that resource type. `ami` and `instance_type` exist because the AWS provider's `aws_instance` schema declares them. Different resources have different arguments.

- **Meta-arguments** are **interpreted by Terraform itself** and available on (almost) *any* resource or module, regardless of provider:

| Meta-argument | Purpose |
|---|---|
| `count` | Create N copies (indexed) |
| `for_each` | Create one per map/set entry (keyed) |
| `depends_on` | Explicit dependency ordering |
| `provider` | Select a provider alias |
| `lifecycle` | Control create/destroy behaviour (`prevent_destroy`, `ignore_changes`, `create_before_destroy`) |

```hcl
resource "aws_instance" "web" {
  ami           = var.ami         # argument (provider-defined)
  instance_type = "t3.micro"      # argument

  count = 3                       # meta-argument (Terraform-defined)
  lifecycle {                     # meta-argument
    create_before_destroy = true
  }
}
```

The distinction matters because meta-arguments are your **cross-cutting control knobs** — iteration, ordering, and lifecycle — and they behave the same everywhere, whereas arguments are whatever each provider exposes.

### Q12. How do type constraints and type conversion work?

**Type constraints** let you declare the expected shape of variables and outputs, so bad input fails at plan time with a clear error rather than deep inside a resource:

```hcl
variable "replicas" {
  type = number
}

variable "subnets" {
  type = list(string)
}

variable "settings" {
  type = object({
    enabled = bool
    tags    = map(string)
  })
}
```

Use `any` to opt out of checking (rarely a good idea), and `optional(type, default)` inside an object to make attributes optional.

**Type conversion** happens automatically where safe (a `number` to `string`, a `tuple` to a `list` if elements match) and explicitly via functions when you need to force it: `tostring`, `tonumber`, `tolist`, `toset`, `tomap`. A frequent one is `toset(var.names)` to feed `for_each`, since it requires a set or map. HCL will also convert a `list` to a `set` and vice-versa when the context demands it. Precise type constraints are one of the cheapest quality wins in Terraform — they turn confusing downstream errors into clear "expected number, got string" messages at the boundary.

### Q13. What does the `sensitive` function do — and what doesn't it do?

`sensitive(value)` marks a value as sensitive so Terraform **suppresses it in CLI output and plans**, showing `(sensitive value)` instead of the real content:

```hcl
output "db_password" {
  value     = aws_db_instance.main.password
  sensitive = true          # also settable as an output argument
}

locals {
  token = sensitive(var.raw_token)   # marks it sensitive throughout
}
```

Once marked, the sensitivity **propagates** — anything derived from a sensitive value is also treated as sensitive in output.

What it does **not** do — the critical interview point: **it does not encrypt anything.** The value is still stored in **plaintext in the state file**. `sensitive` only hides it from console/plan output to prevent shoulder-surfing and log leakage. Real secret protection means securing the state backend (encryption at rest, restricted access, and ideally pulling secrets from Vault or a cloud secret manager at apply time rather than putting them in state at all). Saying "`sensitive` marks it for display but state is still plaintext, so encrypt the backend" is exactly the nuance interviewers want.

### Q14. How does `null` behave, and when is it useful?

`null` represents the **absence of a value**. Assigning `null` to an argument tells Terraform to **omit it**, so the resource falls back to the provider's default — as if you never wrote the argument at all:

```hcl
resource "aws_instance" "web" {
  ami           = var.ami
  instance_type = "t3.micro"
  # if var.kms_key_id is null, this arg is omitted -> provider default
  ebs_optimized = var.ebs_optimized   # null => use default
}
```

This differs sharply from `""` or `0`, which are *real values* you're explicitly setting. `null` = "don't set this"; `""` = "set this to empty string."

Useful patterns:

- **Optional arguments** — pass `null` to mean "use the default," often via a variable defaulting to `null`.
- **Conditional omission** — `key = var.enabled ? var.value : null` sets the argument only when enabled.
- **Type flexibility in conditionals** — `null` sidesteps some ternary type-matching issues since it's type-agnostic.

The mental model: `null` removes an argument from the effective config, rather than assigning a "zero" value to it.

### Q15. How do comments and operators work in HCL?

**Comments** come in three forms:

```hcl
# single-line (preferred idiom)
// single-line (also valid)
/* multi-line
   block comment */
```

The `#` style is conventional in Terraform code.

**Operators** are what you'd expect, with standard precedence:

- **Arithmetic** — `+ - * / %` (on numbers).
- **Comparison** — `== != < <= > >=`.
- **Logical** — `&& || !`.
- **Conditional** — `cond ? a : b`.

```hcl
count      = var.enabled && var.replicas > 0 ? var.replicas : 0
is_prod    = var.env == "prod"
threshold  = var.base * 2 + 10
```

Precedence follows the usual order (`!` and unary minus highest, then `* / %`, then `+ -`, then comparisons, then `&&`, then `||`, then `?:` lowest), and you use parentheses to be explicit. Nothing exotic — the point is HCL has a normal expression grammar, which is what lets you write the conditionals and computed arguments that make configs DRY.

### Q16. When do HCL's declarative limits push you toward external data or a real language?

HCL is deliberately not a general-purpose language — no user-defined functions, no recursion, no real imperative control flow, no arbitrary I/O. You hit the wall when:

- **Complex data transformation** — deeply nested reshaping that turns into an unreadable pile of `for`/`flatten`/`merge`. Sometimes cleaner to compute the data elsewhere and feed it in.
- **Logic that needs a real algorithm** — anything recursive or genuinely procedural.
- **Data from outside Terraform** — you need a value only obtainable by running a script or calling a non-provider API.

The escape hatches, in order of preference:

- **`templatefile` / functions** — for rendering and moderate transforms; stay in HCL.
- **External data source** (`data "external"`) — runs a script that returns JSON to Terraform; a controlled bridge to imperative logic. Use sparingly — it runs on every plan and breaks determinism if not careful.
- **Generate the HCL/JSON with another tool** — compute config in a real language and emit `.tf.json`.
- **Step up to Pulumi/CDKTF** — if you're constantly fighting HCL, a real programming language over the same providers may be the right call.

The senior framing: HCL's limits are usually a feature (readable, reviewable plans). Reaching for an external data source or code generation is a *smell to justify*, not a default — but knowing the escape hatches, and that overusing them undermines Terraform's guarantees, is exactly the judgement interviewers probe.

### Q17. What's the difference between `list`, `set`, and `map`, and why does it matter for iteration?

All three are collections, but with different semantics that directly affect `count` vs `for_each`:

| Type | Ordered? | Duplicates? | Indexed by | Iteration fit |
|---|---|---|---|---|
| `list(T)` | Yes | Yes | integer position | `count` (via `length`) |
| `set(T)` | No | No (unique) | value itself | `for_each` |
| `map(T)` | No (by key) | Keys unique | string key | `for_each` |

```hcl
for_each = toset(var.names)          # set -> each.key == each.value
for_each = var.users_by_id           # map -> each.key, each.value
count    = length(var.names)         # list/number -> count.index
```

Why it matters: **`for_each` requires a set or map** because it needs **stable string keys** to address resources (`aws_instance.web["alice"]`). `count` uses **positional integer indices** (`aws_instance.web[0]`), which is why removing a middle element from a `count` list shifts every subsequent resource and triggers destructive churn. Converting a list to a set with `toset` (or reshaping to a keyed map with a `for` expression) is the standard move to get stable `for_each` addressing. Understanding these three types' ordering/uniqueness semantics is the root of the whole `count`-vs-`for_each` decision.
## Providers

### Summary

**What this topic covers**

Providers are the plugins that make Terraform useful — without them the language is just typed HCL with no way to touch the world. This topic covers what a provider actually is (a binary that translates your resource blocks into a platform's API calls), how providers are declared and pinned (`required_providers`, source addresses, version constraints), how they are distributed and locked (the Terraform Registry, `.terraform` cache, `.terraform.lock.hcl`), how you configure and authenticate them (provider blocks, aliases, env-var and OIDC auth), and how you pass configured providers down into modules. The 16 questions here move from "what is a provider" up to the multi-region/multi-account alias patterns and the meta-provider ordering problem (configuring the `kubernetes` provider against a cluster the same run is still creating). Get providers right and `init` is boring; get them wrong and you get non-deterministic builds, leaked credentials, or breaking upgrades on every apply.

**Mental model**

Terraform core is a graph engine and a language runtime — it knows nothing about AWS, GCP, or Kubernetes. Every bit of platform knowledge lives in a **provider plugin**, a separate binary that speaks a gRPC protocol to core. Core hands the provider a desired-state object; the provider knows the target's API, performs the create/read/update/delete, and hands back the real attributes. So the flow is: your `resource "aws_instance"` block → core builds it into the graph → the `hashicorp/aws` provider turns it into `RunInstances` API calls → the returned instance id and attributes land in state. `terraform init` is the step that reads your `required_providers`, resolves versions against the lock file, downloads the plugins from the Registry into `.terraform/`, and records checksums. Think of a provider as a **driver**: same Terraform language, swappable backend. A provider is *configured* (region, credentials, endpoints) via a `provider` block, and you can have several configured instances of the same provider via **aliases** — one AWS provider for `us-east-1`, another for `eu-west-1`.

**Key terms**

- **Provider** — a plugin binary translating HCL resources/data sources into a platform's API calls (aws, google, azurerm, kubernetes, helm, random, tls, http, ...).
- **Registry** — the default distribution point (registry.terraform.io) that `init` downloads providers from.
- **Source address** — the fully-qualified provider name, e.g. `hashicorp/aws` = `registry.terraform.io/hashicorp/aws`.
- **`required_providers`** — the block (inside `terraform {}`) declaring each provider's source and version constraint.
- **Version constraint** — operators `=`, `!=`, `>=`, `<=`, `~>` (pessimistic) that bound acceptable provider versions.
- **`.terraform.lock.hcl`** — the dependency lock file pinning exact provider versions + checksums; committed to VCS.
- **Provider configuration** — a `provider "aws" { region = ... }` block supplying credentials/region/endpoints.
- **Alias** — a named additional configuration of the same provider (`provider = aws.west`) for multi-region/multi-account.
- **`providers` meta-argument** — how a module block receives explicit provider configurations from the root.
- **Official / partner / community** — Registry tiers by who publishes and supports the provider.
- **Provider-defined functions** — functions a provider can expose (Terraform 1.8+), called as `provider::name::fn(...)`.

**Why interviewers ask this**

Providers separate people who've *run* Terraform in a team from people who've only read a tutorial. The junior signal is "you add a provider block and it works." The senior signal is everything around determinism and security: do you pin versions with `~>` and commit `.terraform.lock.hcl` so every teammate and CI runner resolves the *same* plugin? Do you know that hardcoding an access key in a provider block is a fireable-offense anti-pattern, and that CI should use OIDC/assume-role instead of static keys? Can you set up provider **aliases** for a multi-region deploy and pass them into modules correctly? Do you understand the meta-provider ordering trap where the `kubernetes` provider needs an endpoint that doesn't exist until the `aws_eks_cluster` in the same config is created? These are the questions that decide whether your platform builds reproducibly and whether your secrets stay out of git.

**Common confusions**

- "Providers are part of Terraform." No — core ships separately from providers; each provider is an independently-versioned plugin.
- "`~> 1.2` and `~> 1.2.0` are the same." They differ: `~> 1.2` allows `>= 1.2, < 2.0`; `~> 1.2.0` allows `>= 1.2.0, < 1.3.0`.
- "The lock file is optional." It's the thing that makes builds reproducible — commit it, don't gitignore it.
- "Providers get their credentials from the provider block only." They also read env vars and shared config; the block is one of several auth sources.
- "You need a provider block for every provider." A provider with all-optional config (like `random`) works with no block; core uses an implicit empty configuration.
- "Aliases are for different providers." No — aliases are multiple *configurations of the same* provider.

**What follows from this topic**

Providers are the layer under everything else. The Resources & Data Sources topic is entirely about the objects providers expose. Authentication here connects to the State Fundamentals topic (state can hold provider-returned secrets in plaintext) and to Remote State/Backends (the backend also needs credentials). Aliases and the `providers` meta-argument feed directly into the Modules topic. And the meta-provider ordering problem previews the dependency-graph and `depends_on` discussions in Resources and in the drift/lifecycle material.

### Q1. What is a Terraform provider?

A provider is a **plugin** — a separate binary — that teaches Terraform core how to manage a specific platform. Core is a language runtime and graph engine that knows nothing about any cloud; all platform-specific logic lives in providers.

Concretely, a provider does three things: it **declares the resource types and data sources** you can write (e.g. `aws_instance`, `aws_s3_bucket`, `data.aws_ami`); it **maps CRUD** — when you apply, it turns each resource's desired state into the platform's API calls (create/read/update/delete); and it **handles authentication** to that platform.

Examples: `aws`, `google`, `azurerm` for the big clouds; `kubernetes` and `helm` for k8s; and utility providers like `random`, `tls`, `http`, `null`, and `time` that have nothing to do with a cloud at all. The same Terraform language drives all of them — the provider is the swappable driver.

### Q2. How are providers distributed and installed?

Providers live in the **Terraform Registry** (registry.terraform.io) — a public catalogue of provider binaries, versioned and checksummed.

`terraform init` is the install step. It reads your `required_providers`, resolves each version constraint (respecting `.terraform.lock.hcl` if present), downloads the matching binaries, and caches them under `.terraform/providers/` in your working directory.

```bash
terraform init          # resolve + download providers and set up the backend
terraform init -upgrade # ignore lock file's pins, pick newest allowed versions, re-lock
```

The `.terraform/` directory is machine-local and gitignored; you re-run `init` on a fresh checkout or in CI. You can also point at a private registry or a local filesystem mirror for air-gapped environments.

### Q3. What does the `required_providers` block do?

It declares which providers a configuration needs, where to get them, and which versions are acceptable. It lives inside the top-level `terraform {}` block.

```hcl
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
```

`source` is the full provider address (`hashicorp/aws` expands to `registry.terraform.io/hashicorp/aws`). `version` is a constraint, not an exact pin. Every provider you reference should be declared here — relying on implicit installation is legacy behaviour and doesn't let you pin versions.

### Q4. Explain Terraform version constraint operators.

Constraints bound which versions `init` may select:

| Operator | Meaning | Example |
|---|---|---|
| `=` / bare | Exactly this version | `= 5.40.0` |
| `!=` | Any version except this | `!= 5.41.0` |
| `>=`, `<=`, `>`, `<` | Range bounds | `>= 5.0, < 6.0` |
| `~>` | Pessimistic ("allow rightmost to increment") | see below |

The `~>` operator is the one interviewers probe:

- `~> 5.40` means `>= 5.40, < 6.0` — allows minor and patch bumps.
- `~> 5.40.0` means `>= 5.40.0, < 5.41.0` — allows patch bumps only.

**Why pin at all?** Providers can introduce breaking changes on a major bump. `~>` lets you take bug fixes automatically while blocking the version that renames an argument out from under you. Pin the constraint loosely with `~>` in `required_providers`, and let `.terraform.lock.hcl` record the *exact* resolved version.

### Q5. What is `.terraform.lock.hcl` and should you commit it?

It's the **dependency lock file**. `terraform init` writes it to record the *exact* provider versions it selected (within your constraints) plus **cryptographic checksums** for each platform's binary.

```hcl
provider "registry.terraform.io/hashicorp/aws" {
  version     = "5.40.0"
  constraints = "~> 5.40"
  hashes = [
    "h1:abc123...",
    "zh:def456...",
  ]
}
```

**Yes, commit it.** It is what makes builds reproducible: with the lock file committed, every teammate and every CI runner resolves the identical provider version and verifies the binary hasn't been tampered with. Without it, two people running `init` a week apart can silently get different provider versions.

To intentionally move versions forward, run `terraform init -upgrade`, review the diff to the lock file, and commit it as a deliberate change.

### Q6. How do you configure a provider, and how should you NOT supply credentials?

A `provider` block configures a provider instance — region, endpoints, credentials:

```hcl
provider "aws" {
  region = "us-east-1"
}
```

**Never hardcode secrets in the block:**

```hcl
provider "aws" {
  region     = "us-east-1"
  access_key = "AKIA..."          # anti-pattern: leaks into git and state
  secret_key = "wJalr..."         # do NOT do this
}
```

Static keys in HCL get committed to version control and can end up in state. Instead, let the provider read credentials from the environment or shared config (see the auth question). Region and other non-secret settings in the block are fine; secrets come from outside.

### Q7. What are provider aliases and when do you need them?

An **alias** is a second (or third) named configuration of the *same* provider. You need one whenever a single run touches more than one region or account.

```hcl
provider "aws" {
  region = "us-east-1"            # default (no alias)
}

provider "aws" {
  alias  = "west"
  region = "us-west-2"
}

resource "aws_s3_bucket" "primary" {
  bucket = "acme-primary"
  # uses the default provider
}

resource "aws_s3_bucket" "replica" {
  provider = aws.west             # explicitly selects the aliased config
  bucket   = "acme-replica"
}
```

Common uses: multi-region deployments (replicas, DR), multi-account setups (each `provider` block assumes a different role), or talking to two Kubernetes clusters. Any resource that doesn't set `provider =` uses the default (unaliased) configuration.

### Q8. How do you pass provider configurations into a module?

By default a child module inherits the root's default provider configurations implicitly. When a module needs a *specific* aliased provider, you pass it explicitly with the `providers` meta-argument on the `module` block:

```hcl
module "replica_region" {
  source = "./modules/bucket"

  providers = {
    aws = aws.west              # the module's default aws == root's aws.west
  }
}
```

Inside the module you declare that it expects a provider via `required_providers` (and optionally `configuration_aliases` for modules that need more than one). Best practice: **don't put `provider` blocks inside reusable modules** — accept providers from the caller so the module stays portable across regions/accounts.

### Q9. What are the recommended authentication patterns for providers?

The rule: **credentials come from the environment or an identity, never from committed HCL.**

- **Environment variables** — `AWS_ACCESS_KEY_ID` / `AWS_PROFILE`, `GOOGLE_CREDENTIALS`, `ARM_CLIENT_ID`, etc. Good for local dev.
- **Shared config / profiles** — `~/.aws/config` with `profile = "..."` in the provider block.
- **Assume-role** — the provider assumes an IAM role rather than using a user's long-lived keys.
- **OIDC in CI** — GitHub Actions / GitLab exchange a short-lived OIDC token for temporary cloud credentials. This is the modern standard: **no static keys stored anywhere.**

```hcl
provider "aws" {
  region = "us-east-1"
  assume_role {
    role_arn = "arn:aws:iam::123456789012:role/terraform"
  }
}
```

Static long-lived access keys in code are the thing every reviewer flags: they leak into git and state, don't rotate, and grant standing access.

### Q10. What's the difference between a default and an explicit (aliased) provider configuration?

The **default** configuration is the `provider "aws" {}` block with no `alias`. Any resource, data source, or child module that doesn't specify `provider =` uses it automatically.

An **explicit** configuration has an `alias` and is only used when something selects it by name (`provider = aws.west`, or via the module `providers` map). Terraform never picks an aliased config automatically.

A subtlety: if you *only* define aliased configurations and no default, resources that don't set `provider =` will error because there's no default to fall back on. Keep a default configuration unless every consumer explicitly selects an alias.

### Q11. How do you handle provider upgrades and breaking changes safely?

Providers follow semantic versioning: a **major** bump (5.x → 6.x) can rename arguments, change defaults, or remove resources.

Safe upgrade flow:

```bash
# 1. widen the constraint in required_providers, e.g. "~> 6.0"
terraform init -upgrade        # 2. resolve new version, rewrite lock file
terraform plan                 # 3. review — look for forced replacements / diffs
```

Read the provider's **upgrade guide and changelog** before bumping a major. Do it in a low-risk environment first (dev/staging), watch for resources that plan a destroy/recreate, and commit the lock-file change as its own reviewable diff. Never let a `>=` constraint silently pull in a new major on someone else's `init` — that's how you get a surprise replacement in production.

### Q12. What's the difference between official, partner, and community providers?

Registry tiers by publisher and support level:

- **Official** — published and maintained by HashiCorp (or now, in practice, the platform owner), e.g. `hashicorp/aws`, `hashicorp/google`. Highest trust, fastest updates.
- **Partner** — published by a third-party company that owns the platform, verified by HashiCorp (a signed provider from, say, a SaaS vendor). Supported by that vendor.
- **Community** — published by individuals or orgs, not formally verified. Fine for niche needs, but vet maintenance activity and pin versions carefully.

For anything in a production critical path, prefer official/partner. The source address tells you the namespace (`hashicorp/...` vs `vendorname/...`).

### Q13. What does the `terraform providers` command do?

It prints the provider dependency tree for the current configuration — which providers are required, by which modules, and with what version constraints.

```bash
terraform providers
# Providers required by configuration:
# .
# ├── provider[registry.terraform.io/hashicorp/aws] ~> 5.40
# └── module.network
#     └── provider[registry.terraform.io/hashicorp/aws]

terraform providers lock   # pre-populate lock hashes for multiple platforms
terraform providers schema # dump the schema of installed providers as JSON
```

It's useful for debugging "why is this provider being pulled in?" and for `providers lock` when you need the lock file to cover several OS/arch platforms (e.g. linux CI plus macOS laptops).

### Q14. What are provider-defined functions?

Since Terraform **1.8**, a provider can ship its own functions, not just resources and data sources. You call them with a namespaced syntax:

```hcl
locals {
  parsed = provider::aws::arn_parse(aws_instance.web.arn)
}
```

The pattern is `provider::<name>::<function>(...)`. This lets providers expose platform-specific parsing/encoding/validation logic that previously required awkward workarounds (external data sources, string manipulation). It's a relatively new capability — mention it to signal you track current Terraform, but most day-to-day configs still lean on built-in functions.

### Q15. How does a provider map Terraform's CRUD to a real platform?

Each resource type in a provider implements the lifecycle:

- **Create** — on first apply, the provider calls the platform's "create" API (e.g. `RunInstances`) and records the returned id + attributes into state.
- **Read** — on refresh/plan, it re-reads current attributes from the API to detect drift.
- **Update** — when the plan shows a changed argument that supports in-place update, it calls the update API. Some argument changes are not updatable in place and force a **replace** (destroy + create).
- **Delete** — on `destroy` (or when a resource is removed from config), it calls the delete API.

The provider's schema declares, per attribute, whether a change is updatable or `ForceNew` (triggers replacement). That schema is why `terraform plan` can tell you "this change will destroy and recreate" before you apply.

### Q16. You need to manage Kubernetes resources on an EKS cluster you're creating in the same config. What's the problem and how do you handle it?

This is the classic **meta-provider ordering problem**. The `kubernetes` (and `helm`) provider needs an API endpoint and credentials to configure itself — but those come from the `aws_eks_cluster` resource that this same run hasn't created yet. Provider configuration is evaluated early, so you get a chicken-and-egg failure or a config that only works on the *second* apply.

```hcl
provider "kubernetes" {
  host                   = aws_eks_cluster.this.endpoint
  cluster_ca_certificate = base64decode(aws_eks_cluster.this.certificate_authority[0].data)
  # token from an exec/data source
}
```

The safe answer is to **split it into two stages / two states**: one config (one state) creates the cluster, a separate config manages the workloads on it, wired together with `terraform_remote_state` or data sources. Keeping cluster provisioning and in-cluster resources in the same apply is a known footgun — the provider can't be reliably configured against infrastructure that doesn't exist yet, and a destroy can leave the k8s provider pointed at a dead endpoint. Separation of concerns here is both a reliability and a blast-radius decision.

## Resources & Data Sources

### Summary

**What this topic covers**

Resources are the nouns of Terraform — every `resource` block is one real thing Terraform will create, update, and destroy. This topic covers the resource block anatomy (type + local name = a unique **address**, arguments you set vs attributes you read), how resources reference each other to form **implicit dependencies**, and the two ways to make many of a thing: **`count`** and **`for_each`** — including the single most common Terraform footgun, where removing a middle element from a `count` list shifts every index and destroys/recreates everything after it. It also covers **data sources** (read-only lookups of things Terraform doesn't manage), the meta-arguments (`depends_on`, `provider`, `lifecycle`), when `depends_on` is actually needed versus when references already handle ordering, and utility building blocks (`terraform_data` / `null_resource`, the `external` data source). The 16 questions run from "what's in a resource block" to "walk me through converting a count-based fleet to for_each without a mass rebuild."

**Mental model**

Think of every resource block as a **node in a dependency graph** carrying a stable address like `aws_instance.web` or `aws_instance.web["api"]`. You write **arguments** (desired inputs); after apply, the block also exposes **attributes** (values the provider computed — ids, ARNs, IPs). When you reference one resource's attribute inside another (`subnet_id = aws_subnet.main.id`), Terraform draws an **implicit edge** — it knows the subnet must exist before the instance, purely from the reference. That's the key idea: dependencies come from data flow, so you rarely need explicit `depends_on`. Multiplicity is where people get hurt. `count` gives you a **list** addressed by integer index; `for_each` gives you a **map** addressed by string key. The addressing model — index vs key — is the whole ballgame, because Terraform tracks resources in state by address, and if the address of an existing resource changes, Terraform thinks the old one is gone and a new one appeared.

**Key terms**

- **Resource block** — `resource "TYPE" "NAME" {}`; declares one managed object. Address is `TYPE.NAME`.
- **Argument vs attribute** — arguments are inputs you set; attributes are outputs (often computed) you read.
- **Data source** — `data "TYPE" "NAME" {}`; a read-only lookup of existing/external info, not managed by this config.
- **Implicit dependency** — an ordering edge Terraform infers because one resource references another's attribute.
- **`depends_on`** — an explicit ordering edge for hidden dependencies references can't express.
- **`count`** — a numeric multiplier producing a **list**; instances addressed as `NAME[0]`, `NAME[1]`.
- **`for_each`** — iterates a map or set producing a **map**; instances addressed as `NAME["key"]`.
- **`lifecycle`** — meta-argument block: `create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`.
- **`ForceNew` / replacement** — a changed argument the provider can't update in place, forcing destroy+create.
- **`terraform_data` / `null_resource`** — resources with no cloud object, used to trigger provisioners or carry `triggers`.
- **`external` data source** — runs an external program and reads its JSON output into Terraform.

**Why interviewers ask this**

Resources are where Terraform's declarative model meets messy reality, and `count` vs `for_each` is the single most reliable senior filter in a Terraform interview. A junior reaches for `count` for everything and eventually pages the team when someone deletes the second subnet from a list of five and Terraform proposes destroying three healthy databases. A senior explains *why*: `count` addresses by positional index, so removing a middle element shifts every later index and Terraform reads that as "destroy and recreate." They know `for_each` keys by stable strings, so removing one entry touches only that one. Interviewers also probe dependency reasoning — do you understand that references create ordering automatically, and that reaching for `depends_on` everywhere is a smell? And do you know data sources are read at plan time, so a data source depending on a not-yet-created resource is its own trap?

**Common confusions**

- "`count` and `for_each` are interchangeable." Their addressing differs (index vs key), which changes destroy/recreate behaviour on edits.
- "Data sources create things." They only read — no create/update/destroy. Removing one deletes nothing.
- "You need `depends_on` to order resources." Usually not — a reference already creates the edge. Use `depends_on` only for hidden dependencies.
- "Changing any argument updates in place." Some arguments are `ForceNew` and force a full replace.
- "`for_each` works over a list." It needs a **map or set of strings**; pass a list through `toset()` and beware duplicate/derived keys.
- "`null_resource` is deprecated so ignore it." `terraform_data` is the modern replacement, but the pattern (trigger-on-change) is still very much used.

**What follows from this topic**

Resource addressing is the vocabulary of the State Fundamentals topic — `module.x.aws_instance.y["key"]` is exactly how state entries are named, and the count/for_each addressing here is why `terraform state mv` and `moved` blocks exist. Implicit dependencies preview the dependency-graph discussion and the drift/`ignore_changes` material. Data sources connect back to Providers (the provider implements the read) and forward to Remote State (where `terraform_remote_state` is itself a data source). And `for_each` over a map is the pattern that makes Modules reusable across a set of environments.

### Q1. What is a resource block and what's its address?

A `resource` block declares one object Terraform manages through its full lifecycle:

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0abc123"
  instance_type = "t3.micro"
}
```

`aws_instance` is the **type** (defined by the provider); `web` is the **local name** you choose. Together they form the **address** `aws_instance.web`, which must be unique in the module and is how you reference the resource everywhere else and how it's tracked in state.

You set **arguments** (`ami`, `instance_type`) as desired inputs. After apply, the resource exposes **attributes** you can read — `aws_instance.web.id`, `aws_instance.web.private_ip` — many of which are computed by the provider and unknown until apply.

### Q2. What is a data source and how is it different from a resource?

A **data source** reads information about something that already exists — it never creates, updates, or destroys.

```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/*-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "web" {
  ami = data.aws_ami.ubuntu.id   # read from the data source
}
```

Use data sources to **avoid hardcoding** values (look up the latest AMI, an existing VPC, a secret's ARN) and to query things Terraform doesn't manage (resources owned by another team/config). The address is prefixed `data.` — `data.aws_ami.ubuntu.id`. Deleting a `data` block removes nothing real; deleting a `resource` block destroys the object.

### Q3. How do computed attributes create dependencies between resources?

When you reference one resource's attribute in another resource's argument, Terraform infers an **implicit dependency** and orders them automatically.

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "app" {
  vpc_id     = aws_vpc.main.id        # reference → subnet depends on vpc
  cidr_block = "10.0.1.0/24"
}
```

`aws_vpc.main.id` is a **computed attribute** — its value isn't known until the VPC is created. Terraform sees the reference, adds a graph edge (vpc before subnet), and during plan carries the id as "known after apply." You didn't write `depends_on` — the data flow *is* the dependency. This is the primary way ordering happens in Terraform.

### Q4. Explain the difference between `count` and `for_each`.

Both create multiple instances from one block, but they address instances differently — and that difference drives everything.

| | `count` | `for_each` |
|---|---|---|
| Input | a number | a map or set of strings |
| Instances form a | list | map |
| Address | `NAME[0]`, `NAME[1]` | `NAME["key"]` |
| Iterator | `count.index` | `each.key`, `each.value` |
| Edit safety | fragile (index shift) | stable (keyed) |

```hcl
# count — indexed
resource "aws_instance" "n" {
  count         = 3
  instance_type = "t3.micro"
  tags = { Name = "web-${count.index}" }
}

# for_each — keyed
resource "aws_instance" "svc" {
  for_each      = toset(["api", "worker", "cron"])
  instance_type = "t3.micro"
  tags = { Name = each.key }
}
```

`aws_instance.svc["api"]` is bound to the key `api`; `aws_instance.n[0]` is bound to position 0. Prefer `for_each` for anything you might edit later.

### Q5. What's the classic `count` footgun with a list?

Removing (or inserting) an element in the middle of a `count` list **shifts every subsequent index**, and because Terraform tracks resources by address, it reads the shift as "these later resources changed identity."

Say `count = length(var.names)` with `["a", "b", "c", "d"]` → addresses `[0][1][2][3]`. Delete `"b"`:

- `[0]` still `"a"` — fine
- `[1]` was `"b"`, now `"c"` — Terraform plans to **update/replace** it to look like c
- `[2]` was `"c"`, now `"d"` — replace
- `[3]` existed, now gone — destroy

So deleting one item can destroy/recreate everything after it. With `for_each` keyed by name, removing `"b"` removes exactly `svc["b"]` and leaves `a`, `c`, `d` untouched. This is *the* reason "use `for_each` for sets of similar resources" is standard advice.

### Q6. When is `count` the right choice over `for_each`?

`count` shines for **conditional creation of a single resource** — the "zero or one" pattern:

```hcl
resource "aws_eip" "nat" {
  count  = var.enable_nat ? 1 : 0
  domain = "vpc"
}
```

Here there's no index-shift risk (it's 0 or 1) and `for_each` would be clumsier. Use `count` when: the resource is a simple on/off toggle, or you genuinely want N *identical, order-insensitive, never-individually-removed* copies. Use `for_each` when the instances correspond to distinct named things (subnets per AZ, buckets per env, users per team) — anything where you'll add/remove individual members over time.

Note the referencing gotcha: a `count = ... ? 1 : 0` resource is referenced as `aws_eip.nat[0]`, and code that reads it must handle the zero case (e.g. `try(aws_eip.nat[0].id, null)`).

### Q7. How do you convert a `count`-based resource to `for_each` without destroying everything?

You can't just swap the meta-argument — the addresses change from `NAME[0]` to `NAME["key"]`, and Terraform would plan to destroy all the indexed instances and create all the keyed ones. You must **tell Terraform the addresses moved**.

Modern way — `moved` blocks (in config, reviewable, applies with the change):

```hcl
moved {
  from = aws_instance.svc[0]
  to   = aws_instance.svc["api"]
}
moved {
  from = aws_instance.svc[1]
  to   = aws_instance.svc["worker"]
}
```

Older way — `terraform state mv` per instance:

```bash
terraform state mv 'aws_instance.svc[0]' 'aws_instance.svc["api"]'
```

Then run `terraform plan` and confirm it shows **no** creates/destroys for those resources — only the address change. `moved` blocks are preferred because they're code-reviewed and reproducible across everyone's state.

### Q8. What are the resource meta-arguments?

Meta-arguments are set on any resource regardless of type:

- **`count`** / **`for_each`** — multiplicity (mutually exclusive).
- **`depends_on`** — explicit ordering for hidden dependencies.
- **`provider`** — select a non-default (aliased) provider configuration.
- **`lifecycle`** — customize create/destroy behaviour (`create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`).

```hcl
resource "aws_instance" "web" {
  provider = aws.west
  lifecycle {
    create_before_destroy = true
    ignore_changes        = [tags["LastScanned"]]
  }
}
```

These are the same on every resource type — they're implemented by core, not the provider.

### Q9. How do you reference specific instances created by `count` or `for_each`?

The reference syntax mirrors how the instances are addressed:

```hcl
# count → list, integer index
aws_instance.n[0].id
[for i in aws_instance.n : i.id]          # all ids
aws_instance.n[*].id                       # splat, all ids

# for_each → map, string key
aws_instance.svc["api"].private_ip
values(aws_instance.svc)[*].id             # all
{ for k, v in aws_instance.svc : k => v.id }  # map of key → id
```

For `for_each`, `aws_instance.svc` is a map you can iterate with `for` expressions; for `count`, `aws_instance.n` is a list and you can use the `[*]` splat. Referencing a single instance requires the exact index/key.

### Q10. What are `terraform_data` and `null_resource`, and when do you use them?

Both are resources that manage **no real infrastructure**. They exist to carry a `triggers` set and, historically, to hang provisioners off.

```hcl
resource "terraform_data" "deploy" {
  triggers_replace = [aws_instance.web.id]   # re-run when the instance changes

  provisioner "local-exec" {
    command = "./deploy.sh ${aws_instance.web.public_ip}"
  }
}
```

`terraform_data` (Terraform 1.4+) is the **modern replacement** for `null_resource` — same idea, no extra `null` provider needed, plus it can just store an arbitrary value. Use it to force an action when some input changes, to sequence a provisioner, or as a value-holder. Treat provisioners as a last resort: they're not tracked in state the way real resources are and break the declarative model.

### Q11. When do you actually need `depends_on`?

Almost never — most ordering comes free from references. You need `depends_on` only when there's a **real dependency Terraform can't see** because it isn't expressed as an attribute reference.

Classic case: an app instance needs an IAM policy attachment to exist before it boots, but the instance config doesn't reference the attachment's attributes:

```hcl
resource "aws_instance" "app" {
  # ... no reference to the policy attachment ...
  depends_on = [aws_iam_role_policy_attachment.app]
}
```

Overusing `depends_on` is a smell: it adds edges the graph doesn't need, serializes work that could run in parallel, and often means you should have referenced an attribute instead. Rule of thumb: try to express the dependency as a reference first; reach for `depends_on` only for these invisible, side-effect ordering requirements.

### Q12. How do you mark and handle sensitive attributes?

Some attributes are secrets — passwords, private keys, tokens. Terraform can flag values as **sensitive** so they're redacted in plan/apply output:

```hcl
variable "db_password" {
  type      = string
  sensitive = true
}

output "connection_string" {
  value     = "postgres://admin:${var.db_password}@${aws_db_instance.main.address}"
  sensitive = true    # required, since it embeds a sensitive value
}
```

Sensitivity **propagates**: any expression derived from a sensitive value is itself sensitive, and Terraform errors if you try to output one without marking it. Important caveat: `sensitive` only hides values from *console output* — the plaintext still lands in **state**. That's why the backend must be encrypted and access-controlled (see State Fundamentals). Redaction is not encryption.

### Q13. What is `replace_triggered_by` and how does it differ from `ignore_changes`?

Both are `lifecycle` meta-arguments but do opposite things:

- **`replace_triggered_by`** — force this resource to be **replaced** when a referenced resource/attribute changes, even though its own arguments didn't change.

```hcl
resource "aws_instance" "app" {
  lifecycle {
    replace_triggered_by = [terraform_data.app_version]
  }
}
```

- **`ignore_changes`** — the opposite: **don't** react to drift on the listed attributes (e.g. a `desired_count` an autoscaler manages, or a tag some external tool writes).

```hcl
resource "aws_autoscaling_group" "app" {
  lifecycle {
    ignore_changes = [desired_capacity]
  }
}
```

Use `replace_triggered_by` to rebuild on an external version bump; use `ignore_changes` to tolerate legitimate out-of-band changes so Terraform stops fighting them.

### Q14. When are data sources read — and what's the trap with a data source that depends on a not-yet-created resource?

Data sources are read during **plan** (refresh), so Terraform has their values before it computes changes. That's great for looking up stable, already-existing things.

The trap: if a data source's query depends on something being created **in the same run**, its value can't be known at plan time. For example, `data.aws_instances` filtered by a tag on instances this apply will create — at plan time those instances don't exist yet, so you get either an error, empty results, or a value that's only correct on the *second* apply.

Fixes: reference the creating resource's attributes directly instead of re-querying them; add `depends_on` to the data source (supported, forces it to read after the dependency — but then its result becomes "known after apply," deferring dependent work); or split cluster/prereq creation into a separate apply. The general rule: use data sources for things that already exist independently of this run, not to re-discover things you're creating right now.

### Q15. What is the `external` data source and when would you use it?

The `external` data source runs an **external program** and reads its stdout (which must be a flat JSON object) into Terraform:

```hcl
data "external" "git_sha" {
  program = ["bash", "-c", "echo \"{\\\"sha\\\": \\\"$(git rev-parse HEAD)\\\"}\""]
}

# use: data.external.git_sha.result["sha"]
```

It's an **escape hatch** for pulling in data no provider exposes — a script that queries an internal API, computes a value, or shells out to a CLI. Use it sparingly: the program runs on every plan, must be deterministic and side-effect-free (it's a *data* source, not an action), needs to exist on every machine that runs Terraform (CI included), and complicates reproducibility. Prefer a real provider or data source when one exists; reach for `external` only when nothing else can supply the value.

### Q16. Someone deleted a resource from the config but you don't want Terraform to destroy it. What are your options?

Removing a `resource` block tells Terraform to **destroy** that object on the next apply. If you want the object to keep existing but stop being managed here, you have choices:

- **`removed` block** (Terraform 1.7+) — the declarative way to drop a resource from state *without* destroying it:

```hcl
removed {
  from = aws_instance.legacy
  lifecycle {
    destroy = false   # forget it, don't delete it
  }
}
```

- **`terraform state rm aws_instance.legacy`** — the imperative equivalent: remove it from state so Terraform forgets it owns it (the real resource stays). Then delete the block.
- **`moved`** — if it's not being dropped but relocated to another module/address, move it instead of destroy+recreate.
- **`lifecycle { prevent_destroy = true }`** — a guardrail that makes Terraform *error* rather than destroy, protecting critical resources from accidental removal.

The wrong move is to just delete the block and apply — that destroys production. `removed { ... destroy = false }` is the reviewable, intentional way to hand a resource off.

## State Fundamentals

### Summary

**What this topic covers**

State is the concept that separates Terraform from a shell script that calls cloud APIs. This topic explains what state *is* — the persisted mapping from your configuration addresses to real-world resource IDs plus a cache of their attributes — and **why it must exist at all**: without it Terraform has no way to know what it already manages or to compute a diff. It covers the `terraform.tfstate` JSON file and the three-way relationship (config = desired, state = last-known, real world = actual) that every `plan` reconciles; resource addressing inside state (`module.x.aws_instance.y["key"]`); the serial/lineage bookkeeping; and the two things that make state operationally dangerous — it stores **secrets in plaintext**, and it corrupts if two people apply at once (hence locking). It also covers the cardinal rule (never hand-edit state — use `state` subcommands), what happens when you lose state, `terraform state list/show`, drift and orphans, outputs living in state, and why state, unlike config, can't just be regenerated from scratch. The 17 questions run from "what is state and why does it exist" up to "someone changed a resource in the console — reconcile it safely" and "you lost the state file — now what."

**Mental model**

Terraform is a **diff engine over three inputs**: your configuration (what you *want*), the state file (what Terraform *thinks* currently exists), and the real world (what's *actually* there). Every plan is: refresh state against reality, then compare desired config to state, then emit the create/update/delete/replace actions that converge them. State is the memory that makes this possible — it's how `aws_instance.web` in your HCL is tied to `i-0abc123` in AWS, and it caches attributes so Terraform doesn't have to re-discover the entire world every run. Crucially, state is a **derived-but-not-regenerable** artifact: you can delete all your config and rewrite it, but you cannot rebuild state by re-running Terraform — Terraform would just try to create everything fresh, because to it, no state means "I manage nothing." Recovering lost state means painstaking `import`. That asymmetry — config is disposable, state is precious — is the core intuition.

**Key terms**

- **State** — the mapping from config addresses → real resource IDs, plus a cache of resource attributes and metadata.
- **`terraform.tfstate`** — the default local JSON file holding that state.
- **Three-way diff** — plan reconciles desired config vs recorded state vs refreshed real-world.
- **Resource address (in state)** — e.g. `module.network.aws_subnet.app["az-a"]`; how each managed object is keyed.
- **`serial`** — a counter incremented on every state write; detects out-of-date writes.
- **`lineage`** — a unique id for a state's history; guards against mixing unrelated states.
- **Drift** — real infrastructure diverging from what state records (usually out-of-band console changes).
- **Orphaned resource** — a real object state no longer tracks (or a state entry with no real object).
- **Locking** — preventing concurrent applies from writing state simultaneously and corrupting it.
- **`terraform.tfstate.backup`** — the previous state, written automatically before each state change.
- **Import** — adopting an existing real resource into state (the only way to rebuild lost state).

**Why interviewers ask this**

State is the concept juniors most often misunderstand and the one that causes the worst outages, so it's a reliable depth probe. The junior answer is "state is a file Terraform uses." The senior answer explains *why* it's structurally necessary (no state = no way to diff or to know ownership), *why it's a security liability* (secrets sit in it in plaintext, so the backend must be encrypted and locked down), and *why concurrency needs locking* (two simultaneous applies interleave writes and corrupt the mapping). Interviewers love the scenario questions: "someone changed a security group in the console — walk me through it" tests whether you understand drift and `-refresh-only`; "you lost the state file" tests whether you know config can't rebuild state and that `import` is the recovery path; "why not just hand-edit the JSON" tests whether you respect the `state` subcommands. Answers here reveal whether you've operated Terraform in a team or only demoed it solo.

**Common confusions**

- "State is just a cache I can delete." Delete it and Terraform forgets it owns your infra — next apply tries to recreate everything.
- "Sensitive variables aren't stored." State stores **everything** including passwords and keys, in plaintext.
- "`terraform refresh` is a separate thing I run." It's folded into `plan`/`apply` now; standalone `refresh` is deprecated.
- "I can fix state by editing the JSON." Never — use `state mv/rm/import`; hand edits corrupt serial/lineage and checksums.
- "Losing state is like losing config — just re-run." No — config regenerates trivially; state only comes back via `import`.
- "Locking is a remote-backend nicety." It's what prevents two applies from corrupting the same state; it's essential, not optional.

**What follows from this topic**

State fundamentals set up the entire Remote State/Backends topic — local `terraform.tfstate` doesn't lock and isn't shared, which is exactly why teams move to S3+DynamoDB, GCS, or Terraform Cloud with locking and encryption. The plaintext-secrets point drives backend encryption requirements. Resource addressing here is the vocabulary for the `state mv` / `moved` / `import` operations covered under refactoring and drift, and the drift discussion previews `-refresh-only`, `ignore_changes`, and the reconciliation workflows. In short, once you understand *why* state exists and *why* it's dangerous, every operational Terraform practice — remote backends, locking, encryption, import, drift management — reads as a direct consequence.

### Q1. What is Terraform state and why does it have to exist?

State is Terraform's record of **what it manages** — the mapping from each configuration address (`aws_instance.web`) to the real resource's id (`i-0abc123`), plus a cache of that resource's attributes and some metadata.

It must exist because Terraform is a **diff engine**. To decide what to do on an apply, it has to answer "what do I already own, and how does it differ from the desired config?" Config alone can't answer that — a `resource` block doesn't know whether the thing exists yet or what its current settings are. State is the memory that bridges "the `aws_instance.web` in my code" to "the specific EC2 instance in the account."

Without state, every apply would either try to create everything from scratch (no memory of what exists) or have to query and match the entire cloud on every run (slow, ambiguous, and often impossible to correlate). State is what makes incremental, converging plans possible.

### Q2. What's in the `terraform.tfstate` file?

It's a JSON document. Top-level bookkeeping plus a `resources` array:

```json
{
  "version": 4,
  "terraform_version": "1.9.0",
  "serial": 12,
  "lineage": "a1b2c3d4-...",
  "outputs": { "vpc_id": { "value": "vpc-0abc", "type": "string" } },
  "resources": [
    {
      "type": "aws_instance",
      "name": "web",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        { "attributes": { "id": "i-0abc123", "private_ip": "10.0.1.5", "...": "..." } }
      ]
    }
  ]
}
```

For each managed resource it stores the type, name, which provider owns it, and the full set of **attributes** as last known. Plus `serial`, `lineage`, `terraform_version`, and `outputs`. You *read* this via `terraform state show`; you don't edit it by hand.

### Q3. Explain the three-way relationship a plan reconciles.

Every plan compares three things:

1. **Configuration** — your `.tf` files: the desired state.
2. **State** — what Terraform last recorded as existing.
3. **Real world** — what's actually deployed right now (learned by refreshing).

The flow: Terraform **refreshes** state against the real world (updating cached attributes, detecting drift), then **diffs** the desired config against that refreshed state, and emits the actions (create/update/delete/replace) needed to make reality match config.

This is why both config and state matter: config says where you want to be, state (refreshed) says where you are. Remove state and Terraform thinks you're at zero; ignore reality and Terraform can't detect that someone changed something out of band.

### Q4. How are resources addressed inside state?

State keys each managed object by its **full address**, which nests module path, type, name, and any `count`/`for_each` key:

```bash
aws_vpc.main
module.network.aws_subnet.app["az-a"]
module.services["api"].aws_instance.web[0]
```

The pieces: `module.<name>` (repeated for nesting, with `["key"]` if the module itself uses `for_each`), then `<type>.<name>`, then `[index]` for `count` or `["key"]` for `for_each`. This is exactly the syntax you use with `terraform state mv`, `terraform state show`, `-target`, and `moved`/`import` blocks. Understanding it is what lets you surgically move or inspect a single instance without touching the rest of state.

### Q5. What's the security implication of what state stores?

State stores **every attribute of every resource, in plaintext** — including secrets. A database password, a generated private key (`tls_private_key`), an access token, the initial admin credential — if it's an attribute, it's sitting in the state JSON unencrypted.

Consequences:

- Marking a variable or output `sensitive` only redacts it from **console output**; it does **not** encrypt it in state.
- Therefore the **backend must be encrypted at rest and access-controlled**. A local `terraform.tfstate` on a laptop or, worse, committed to git, is a credential leak.
- Remote backends (S3 with SSE + tight IAM, Terraform Cloud, etc.) exist partly for this reason.

The interview soundbite: "Terraform state is a secrets file. Treat the bucket holding it like you'd treat a vault — encryption, least-privilege access, no public exposure, and never in version control."

### Q6. Why must you never hand-edit `terraform.tfstate`?

Because the file is a consistency-checked structure, not free-form JSON. Editing it by hand risks:

- Breaking the **serial/lineage** bookkeeping or internal checksums, so Terraform rejects or mis-handles the state.
- Silently corrupting the address↔id mapping, causing Terraform to orphan real resources or try to recreate live ones.
- Diverging from what the remote backend/lock expects.

Use the **`state` subcommands** instead, which mutate state safely and update the metadata:

```bash
terraform state list                 # enumerate addresses
terraform state show aws_instance.web
terraform state mv  A B              # rename/move an address
terraform state rm  aws_instance.x   # forget a resource (doesn't destroy it)
terraform import aws_instance.web i-0abc123
```

The rule is absolute: state is edited through Terraform's tooling, never a text editor.

### Q7. Why does concurrency corrupt state, and what prevents it?

State is read-modify-write: Terraform reads the current state, computes changes, applies them, and writes the new state back. If **two applies run against the same state at once**, their writes interleave — one overwrites the other's updates, and the mapping ends up describing neither reality. You get lost resource records, duplicated creates, or a state that no longer matches the world.

**Locking** prevents it. Before an apply, Terraform acquires a lock on the state; a second apply blocks (or fails fast) until the first releases. Local state has no locking. Remote backends provide it — S3 via a DynamoDB lock table (or S3's newer native locking), GCS and azurerm natively, Terraform Cloud/Enterprise built in.

```bash
# Error acquiring the state lock: ConditionalCheckFailedException ...
# Lock Info: ID, Who, Created, ...
```

This is a headline reason teams move off local state: shared work needs locking, and locking needs a remote backend.

### Q8. What does `terraform refresh` do, and where did it go?

Refresh is the step where Terraform **re-reads each managed resource from the provider's API and updates the cached attributes in state** to match reality. It's how drift gets detected.

Historically `terraform refresh` was a standalone command that wrote those updates straight to state. That's now **deprecated** because a silent state write is risky. Refresh is instead folded into `plan` and `apply`, which refresh in-memory and *show* you the drift as part of the diff.

To reconcile state to reality *without* changing infrastructure, use:

```bash
terraform plan  -refresh-only   # show what refresh would change in state
terraform apply -refresh-only   # write the refreshed values into state, no infra changes
```

`-refresh-only` is the safe, explicit successor: you see the drift and choose to record it, rather than a black-box `refresh` mutating state.

### Q9. What do `terraform state list` and `terraform state show` do?

They're the read-only inspection tools for state — how you look inside without opening the JSON.

```bash
terraform state list
# aws_vpc.main
# module.network.aws_subnet.app["az-a"]
# module.network.aws_subnet.app["az-b"]

terraform state show 'module.network.aws_subnet.app["az-a"]'
# prints all recorded attributes for that one instance
```

`state list` enumerates every managed address (optionally filtered by a pattern) — great for finding the exact address you need for `mv`, `rm`, `import`, or `-target`. `state show <address>` dumps the cached attributes of one resource, so you can see what Terraform believes is true about it. Both read state only; neither changes anything.

### Q10. What are the `serial` and `lineage` fields for?

They're integrity/versioning metadata:

- **`serial`** — an integer incremented on **every state write**. It lets the backend and Terraform detect a stale write: if you're about to write state whose serial is behind what's stored, something's out of order (e.g. a concurrent change). It's essentially an optimistic-concurrency version number.
- **`lineage`** — a unique id generated when a state is first created, identifying that state's **history/ancestry**. If you accidentally point Terraform at a state with a different lineage than expected, it warns — this guards against mixing two unrelated states (e.g. restoring the wrong backup, or crossing wires between environments).

Together they answer "is this the state I think it is, and is it up to date?" You don't set them; Terraform maintains them, which is another reason not to hand-edit the file.

### Q11. What is drift and what causes it?

**Drift** is when the real infrastructure diverges from what state records — reality no longer matches Terraform's memory.

The usual cause is **out-of-band changes**: someone edits a resource directly in the cloud console, a CLI script mutates a setting, an autoscaler changes a capacity, or another tool rewrites a tag. Terraform didn't make the change, so its cached attributes are now stale.

`terraform plan` detects drift during its refresh phase and shows it — typically as a diff proposing to *revert* the console change back to what your config says. That's the tension: Terraform wants config to be the source of truth, so absent other handling it will "correct" the drift on the next apply. How you respond depends on whether the change should be adopted (update config), reverted (apply), or tolerated (`ignore_changes`).

### Q12. Someone changed a resource directly in the console. Walk me through reconciling it safely.

Don't blind-apply — figure out intent first.

1. **See the drift**: `terraform plan` (its refresh surfaces the difference between state and reality).
2. **Decide what the change should be:**
   - **Revert it** (the console change was a mistake): `terraform apply` — Terraform pushes the resource back to match config.
   - **Adopt it** (the change is correct and should be permanent): update your **HCL** to match, then `terraform plan` should show no diff. Optionally `apply -refresh-only` to sync state.
   - **Tolerate it** (something external legitimately owns that field, e.g. autoscaler-managed capacity): add `lifecycle { ignore_changes = [...] }` so Terraform stops fighting it.
3. **If you only want state to catch up** without changing infra: `terraform apply -refresh-only`.

The senior points: inspect before acting, distinguish "revert vs adopt vs ignore," never let a surprise console change get silently steamrolled by an unrelated apply, and consider *why* someone was able to change it out of band (tighten access / drift detection in CI).

### Q13. What happens if you lose the state file?

Terraform loses all memory of what it manages. To Terraform, **no state = "I own nothing"** — so the next `plan` proposes to **create everything from scratch**, even though the real resources still exist. Apply that and you get duplicates, name collisions, or errors.

You cannot regenerate state by re-running Terraform (that's the whole point — config doesn't know the resource ids). Recovery options:

- **Restore from backup** — the remote backend's versioning (S3 versioning, TFC state history) or `terraform.tfstate.backup`. This is why remote, versioned backends matter.
- **Rebuild via `import`** — painstakingly re-adopt each existing resource into fresh state:

```bash
terraform import 'aws_instance.web' i-0abc123
```

For a large estate, import is slow and error-prone. The lesson interviewers want: back state up (versioned remote backend), and understand that losing it is categorically worse than losing config.

### Q14. Why can you rebuild config from nothing but not state?

Because they hold different kinds of information. **Config** is declarative intent you author — if you delete it, you can rewrite the `resource` blocks by hand; it contains no runtime-generated identity.

**State** contains information that *only exists after resources are created*: the real resource ids, provider-assigned attributes, the address↔id mapping. Terraform can't recompute that from config, because config never knew the ids in the first place — the cloud assigned them at create time. Re-running Terraform doesn't rediscover the mapping; it just creates new resources.

So the only way to reconstruct state is to **`import`** each existing real resource, telling Terraform "address X corresponds to id Y." That asymmetry is the core operational truth: **config is disposable, state is precious.** Protect state accordingly (remote, versioned, backed up, locked).

### Q15. What is `terraform.tfstate.backup`?

It's the **previous** state, written automatically. Before Terraform writes a new `terraform.tfstate`, it copies the prior version to `terraform.tfstate.backup` in the same directory (for local state).

It's a one-deep safety net: if a state write goes wrong or an operation corrupts the current state, you can recover the immediately-prior version. It is **not** a substitute for real backups — it only keeps the single last generation, and it's local. For genuine protection you want a **versioned remote backend** (S3 versioning, GCS object versioning, Terraform Cloud's full state history) that keeps many generations off-machine. Think of `.tfstate.backup` as an undo for the last operation, not a backup strategy.

### Q16. State file size and performance — what happens at scale?

Because a plan refreshes and diffs **every** resource in a state, a monolithic state with thousands of resources gets slow: each `plan` makes many API calls to refresh, the JSON grows large, locking serializes the whole team on one file, and the blast radius of a mistake covers everything.

Mitigations (which preview the state-layout discussion):

- **Split state** into multiple smaller configurations by boundary (per service, per environment, per layer — network vs app vs data), each with its own backend key and lock.
- Use `-target` sparingly for surgical operations, and data sources / `terraform_remote_state` to reference across states.
- Keep read-heavy lookups as data sources rather than managed resources where appropriate.

The senior framing: state size is really a **blast-radius and team-throughput** question. You split state not just for speed but so a change to the payments service can't lock or endanger the networking layer.

### Q17. Are outputs stored in state, and why does that matter?

Yes — the values of your root-module `output` blocks are recorded in state (under the top-level `outputs` key).

Two implications:

1. **Cross-state references work because of this.** The `terraform_remote_state` data source reads another configuration's state and exposes its outputs — that's how a separate app config consumes the network config's `vpc_id`. It only works because outputs live in state.
2. **Sensitive outputs are plaintext in state too.** An `output ... { sensitive = true }` is redacted from console output but stored unencrypted in state, same as any other attribute — another reason the backend must be encrypted.

So outputs aren't just console sugar; they're the published interface of a state, which is exactly the mechanism the Remote State topic builds on for composing multiple states together.
## Remote State & Backends

### Summary

**What this topic covers**

State is the single most operationally dangerous thing in Terraform, and *where* that state lives — the **backend** — is the difference between a hobby project and a platform a team can safely share. This topic covers why local state falls apart the moment more than one person (or one CI runner) is involved, what a backend actually is, the canonical AWS pattern (**S3 bucket for storage + a locking mechanism**), the other backends you'll meet (gcs, azurerm, Terraform Cloud/`remote`, `http`, Consul), how **state locking** prevents two applies from corrupting each other, partial backend configuration for keeping secrets and per-environment values out of code, encryption at rest, bucket versioning for recovery, and the strategic question of **state isolation** — one giant state vs one state per environment/component and what that does to your blast radius. The 16 questions move from "why not just commit the tfstate file" to "design the backend and state layout for a multi-account org."

**Mental model**

Think of the backend as **two jobs bolted together**: (1) *storage* — a durable, versioned, encrypted place to keep `terraform.tfstate`, and (2) *coordination* — a lock so that only one `apply` mutates that state at a time. Local state does neither well: the file sits on one laptop, there's no lock, secrets sit in plaintext in your working directory, and a `rm -rf` or a lost machine loses your only record of what exists. A remote backend moves the state into shared, durable storage and adds a lock. The mental shift for a platform engineer: **state is a shared production database, not a build artifact.** Whoever can read it can read every secret it captured (RDS passwords, private keys, tokens) in plaintext. Whoever can write it can convince Terraform that reality is different from what it is. So you protect the backend the way you'd protect a secrets store — encryption, access control, versioning, locking — and you decide how to *slice* state so a mistake in one blast radius can't take down everything.

**Key terms**

- **Backend** — configuration for where state is stored and how operations run (local vs remote).
- **State locking** — a mutex preventing concurrent `apply`/`plan -refresh` from corrupting state.
- **S3 backend** — stores state in an S3 object; the AWS-standard remote backend.
- **DynamoDB lock table** — the classic S3-backend locking mechanism (one item per state key).
- **S3 native locking** — newer `use_lockfile = true` that locks via a `.tflock` object, replacing DynamoDB.
- **Partial backend config** — a `backend "s3" {}` block with values supplied at `init` via `-backend-config`.
- **Remote operations** — plan/apply executed on the backend (Terraform Cloud/`remote`), not your machine.
- **State isolation** — splitting infra into multiple independent states to limit blast radius.
- **`force-unlock`** — manually releasing a stuck lock by ID; dangerous, only when you're certain no apply is running.
- **State migration** — moving state from one backend to another via `terraform init` (`-migrate-state`/`-reconfigure`).
- **Chicken-and-egg** — the bucket/table that holds state must itself be created somehow (local state, then migrate, or click-ops).

**Why interviewers ask this**

Backends are where a junior answer and a senior answer diverge hardest. A junior can write a `resource` block; a senior can tell you *why* the S3 backend needs a lock, what happens when two CI jobs apply at once without one, and how they'd structure state so a `terraform destroy` in the dev workspace can't reach production. Interviewers use this to probe operational maturity: do you know state holds plaintext secrets? Do you version the bucket so you can recover from a bad `state push`? Have you actually dealt with a stuck lock at 2am and reached for `force-unlock` — and do you know why that's frightening? For platform-engineer roles this is close to a gate: you are the person who owns the collaboration boundary for every other team's infrastructure.

**Common confusions**

- "The backend runs my Terraform" — most backends (S3, gcs) only *store* state; operations still run locally. Only Terraform Cloud/`remote` runs plan/apply remotely.
- "State locking is automatic everywhere" — you have to *configure* it (DynamoDB table or `use_lockfile`); a bare S3 bucket with no lock will happily let two applies clobber each other.
- "State is encrypted because it's in S3" — only if you enable SSE on the bucket; and even encrypted at rest, anyone who can read the object gets the plaintext secrets inside.
- "Workspaces isolate state safely" — they share one backend and key prefix; they're fine for ephemeral copies, not for prod-vs-dev blast-radius isolation.
- "`force-unlock` fixes a stuck apply" — it releases the lock, not the half-finished apply; use it only when you've confirmed nothing is actually running.

**What follows from this topic**

Once state lives in a shared backend, you need to *operate* on it — import existing infra, move resources, recover from corruption — which is **State Operations & Manipulation**. The isolation choices here feed directly into how you structure **modules** and **workspaces**, and the secrets-in-state problem connects to **Variables, Outputs & Locals** (marking things sensitive doesn't remove them from state). Everything about drift detection also runs *through* the backend, since `plan` reads the remote state to diff against reality.

### Q1. Why is local state a problem for a team? What breaks?

Local state (`terraform.tfstate` in your working directory) is fine for a solo experiment and a disaster for a team. Five things break:

- **Single machine** — the state lives on one laptop or one CI runner. Nobody else can plan or apply against the real infrastructure because they don't have the current state.
- **No locking** — two people (or two CI jobs) can `apply` simultaneously; both read the same starting state, both write, and the last writer wins — corrupting or losing resources from the mapping.
- **No collaboration** — you'd have to email the file around or commit it to git, which races constantly and leaks secrets.
- **Secrets on disk in plaintext** — state captures resource attributes including passwords, private keys, and tokens, sitting unencrypted in your working directory.
- **Easy to lose** — one `rm`, a wiped machine, or a `.gitignore`d file that never got backed up, and you've lost the only record mapping your config to real resource IDs. Terraform will then try to *recreate* everything.

The fix is a remote backend with locking, versioning, and encryption.

### Q2. What is a Terraform backend?

A backend defines **where Terraform stores state and how it runs operations**. Two responsibilities:

- **State storage** — the durable location of `terraform.tfstate` (an S3 object, a GCS object, a Terraform Cloud workspace, a local file).
- **Operation execution** — where `plan`/`apply` actually run. Most backends (`s3`, `gcs`, `azurerm`) run operations *locally* and only store state remotely. The `remote`/Terraform Cloud backend can run operations remotely on their infrastructure.

```hcl
terraform {
  backend "s3" {
    bucket = "acme-tfstate"
    key    = "prod/network/terraform.tfstate"
    region = "us-east-1"
  }
}
```

Without a `backend` block you get the implicit `local` backend (state in the current directory). Changing backends requires `terraform init` to migrate.

### Q3. Walk me through the canonical S3 backend setup and what each piece does.

The AWS-standard pattern is **an S3 bucket for the state object plus a lock**. Historically the lock was a DynamoDB table; on recent Terraform you can use S3-native locking instead.

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-tfstate"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true          # SSE at rest
    dynamodb_table = "acme-tf-locks" # classic locking table
    # use_lockfile = true          # newer S3-native lock (replaces DynamoDB)
  }
}
```

- **bucket** — durable, versioned storage for the state object.
- **key** — the path/name of the state object; effectively the identity of *this* state. Different components/environments use different keys.
- **encrypt** — turns on server-side encryption so the plaintext-secret-laden state isn't sitting unencrypted at rest.
- **dynamodb_table** — holds a lock item keyed by the state path; Terraform writes it before an apply and deletes it after, so a second apply blocks.
- **use_lockfile** — the newer alternative: Terraform writes a `.tflock` object next to the state in S3 to coordinate, removing the need for DynamoDB.

You'd also enable **bucket versioning** so a bad write can be rolled back, and lock down the bucket policy so only the platform role can read it.

### Q4. How does state locking work and why does it matter?

State locking is a **mutex around mutating operations**. Before `apply` (and `plan` with a refresh) Terraform acquires a lock; while held, any other Terraform process trying to operate on the same state fails fast with "Error acquiring the state lock." When the operation finishes, Terraform releases it.

Why it matters: without a lock, two concurrent applies both read the same starting state, both compute plans against it, and both write back — the second overwrites the first's changes, so state no longer reflects reality and resources leak or get double-created.

How it's implemented depends on the backend:
- **DynamoDB (S3 backend)** — a conditional-write of a lock item keyed by the state path; the conditional write fails if the item already exists.
- **S3 native (`use_lockfile`)** — a `.tflock` object acting as the lock.
- **Terraform Cloud** — queues runs so only one applies at a time.

Not every backend supports locking; the `s3` (with a lock mechanism), `gcs`, `azurerm`, and `remote` backends do.

### Q5. An apply is stuck with a lock error but you're sure nothing is running. What do you do?

First **verify** nothing is actually running — check CI, ask the team, look at the lock info Terraform prints (it shows who acquired it, when, and the lock ID). A lock usually persists because a previous apply crashed or was killed before it could release.

Only once you're certain, use `force-unlock` with the lock ID:

```bash
terraform force-unlock <LOCK_ID>
```

The danger: `force-unlock` releases the *lock*, not any operation that might still be running. If you force-unlock while an apply is genuinely in progress elsewhere, you re-open the door to two concurrent applies corrupting state — the exact thing locking exists to prevent. So it's a last resort, done deliberately, after confirming the original process is dead.

### Q6. What is partial backend configuration and why use it?

You can't use variables or interpolation inside a `backend` block — it's read too early, before Terraform evaluates anything. **Partial configuration** solves this: leave some (or all) backend arguments out of the block and supply them at `init` time via `-backend-config`.

```hcl
terraform {
  backend "s3" {
    # intentionally empty / minimal
    key = "network/terraform.tfstate"
  }
}
```

```bash
terraform init \
  -backend-config="bucket=acme-tfstate-prod" \
  -backend-config="region=us-east-1" \
  -backend-config=backend-prod.hcl
```

Why it's useful:
- **Per-environment values** — the same code initialises against a `dev` bucket or a `prod` bucket depending on which `-backend-config` file you pass.
- **Keep secrets out of code** — credentials or account-specific values live in an untracked `.hcl` file or CI secret, not committed.
- **DRY across many components** — a shared `backend.hcl` supplies bucket/region; each component only sets its own `key`.

### Q7. What other backends exist besides S3, and when would you use them?

| Backend | Storage | Locking | When |
|---|---|---|---|
| `s3` | S3 object | DynamoDB or `.tflock` | AWS shops (the default AWS pattern) |
| `gcs` | GCS object | Built-in (object generation) | GCP shops |
| `azurerm` | Azure Blob | Blob lease | Azure shops |
| `remote` / Terraform Cloud | TFC workspace | Built-in, run queue | Managed collaboration, remote runs, policy |
| `http` | Any REST endpoint | Optional (LOCK/UNLOCK) | GitLab-managed state, custom stores |
| `consul` | Consul KV | Consul sessions | Consul-centric environments |

Rule of thumb: match the backend to where your infra and identity already live (S3 for AWS, gcs for GCP, azurerm for Azure). Reach for Terraform Cloud/`remote` when you want managed remote operations, a run queue, and policy-as-code without building it yourself. `local` is only for throwaway experiments.

### Q8. State can contain plaintext secrets. How do you protect it?

Assume **every secret Terraform touches ends up in state in plaintext** — RDS passwords, generated private keys, access tokens, `random_password` outputs. Protection is layered:

- **Encryption at rest** — enable SSE on the bucket (`encrypt = true`, ideally a KMS key you control). This stops someone reading the raw storage from getting plaintext.
- **Access control** — the bucket/table policy should allow only the platform role and CI to read/write. *Read access to state = read access to every secret in it*, so treat it like a secrets store.
- **Versioning + no public access** — block public access entirely; enable versioning for recovery, not exposure.
- **In transit** — backends use TLS; enforce it with a bucket policy denying non-HTTPS requests.

What encryption does *not* do: it doesn't stop an authorised reader from seeing plaintext, and it doesn't keep secrets out of `terraform.tfstate` in the first place. The only way to keep a secret out of state entirely is to not have Terraform manage it — or use ephemeral resources/write-only arguments where supported.

### Q9. Why version the state bucket?

Because state is mutable and Terraform (or a human) can corrupt it. Bucket **versioning** keeps every prior version of the state object, so if an operation writes bad state — a botched `state push`, a partial apply, an accidental `state rm` of the wrong thing — you can recover the previous known-good version instead of rebuilding your mental model of what exists from scratch.

It's the difference between "the state is wrong and we have last night's version" and "the state is wrong and it's gone." Versioning is cheap insurance and pairs with locking (prevents concurrent corruption) and encryption (protects contents at rest). For DynamoDB-based locking you don't version the lock table — it's ephemeral — but the *state bucket* absolutely should be versioned.

### Q10. Compare state isolation strategies — one giant state vs many.

The core tradeoff is **blast radius vs coordination overhead**.

| | One monolithic state | Split state (per env/component) |
|---|---|---|
| Blast radius | Huge — one bad apply/destroy touches everything | Small — contained to that component |
| Plan speed | Slow — refreshes every resource | Fast — only that slice |
| Lock contention | High — everyone waits on one lock | Low — independent locks |
| Cross-references | Direct | Via `remote_state` data source / outputs |
| Cognitive load | Simple to find things | More states to wire together |

Senior default: **isolate by environment (dev/stage/prod) and by component/lifecycle** (networking, data, app). Networking changes rarely and is high-risk; app changes constantly. Putting them in one state means every app deploy re-plans the VPC and shares a lock and a blast radius with it. Split them, and a mistake in the app state can't `destroy` your VPC. You wire them together with published outputs consumed via the `terraform_remote_state` data source (or, better, a real data source/parameter store to avoid tight coupling).

### Q11. How do you migrate state from one backend to another?

You change the `backend` block (or its config) and re-run `terraform init`. Terraform detects the backend changed and offers to migrate:

```bash
# after editing the backend block, e.g. local -> s3
terraform init -migrate-state
```

Terraform copies the existing state into the new backend and, on confirmation, starts using it. If instead you just want to *reconfigure* the backend without copying state (e.g. you already moved the object, or you're pointing at an already-populated backend), use:

```bash
terraform init -reconfigure
```

- `-migrate-state` — copy current state into the new backend.
- `-reconfigure` — ignore existing state, reinitialise with the new config.

Always back up the current state (the bucket is versioned, or `terraform state pull > backup.tfstate`) before migrating. Verify with `terraform plan` afterwards — a clean, no-change plan confirms the migration preserved the mapping.

### Q12. Who can read state can read your secrets — how does that shape access control?

It makes the backend a **tier-0 secrets asset**. Access control follows from one fact: state holds plaintext secrets, so read on the state bucket is equivalent to read on every credential Terraform has ever provisioned.

Practical shape:
- **Least privilege** — only the platform team's role and the CI apply role get read/write on the state bucket and lock table. Developers who only need to *review* plans shouldn't have raw state read; give them plan output via CI instead.
- **Per-environment separation** — prod state in a prod account/bucket with its own IAM, so a dev-account compromise can't read prod secrets.
- **Audit** — enable access logging on the bucket; state reads are security-relevant events.
- **No wildcards** — scope policies to specific key prefixes, not `s3:GetObject *`.

If someone asks "can we give the analytics team read on the tfstate bucket for debugging," the answer is no — that's handing them every database password in the org.

### Q13. How do you create the state bucket itself — the chicken-and-egg problem?

The backend needs an S3 bucket (and lock table) to exist *before* Terraform can use it, but you'd like to manage that bucket with Terraform too. Three common resolutions:

- **Bootstrap with local state, then migrate** — write a small `bootstrap/` config that creates the bucket + lock table using the default *local* backend, apply it, then add a `backend "s3"` block pointing at that bucket and run `terraform init -migrate-state` to move even the bootstrap's own state into it.
- **Click-ops / CLI the bucket once** — create the bucket and table manually (or via a short script) and never manage them in Terraform. Simple, and the bucket is a stable, rarely-changed resource, so not managing it in IaC is defensible.
- **A separate "seed" account/pipeline** — an org-bootstrap process provisions per-account state buckets before any workload Terraform runs.

The pragmatic answer most teams give: bootstrap it once (script or local-state config), enable versioning/encryption/locking on it, and then leave it alone — it's foundational plumbing, not something you re-provision.

### Q14. How do workspaces interact with backends?

CLI **workspaces** are multiple named states *within a single backend*. The backend stays the same; Terraform stores each workspace's state under a distinct key. With the S3 backend, non-default workspaces land under a prefix:

```
<key>                         # default workspace
env:/<workspace>/<key>        # named workspaces (workspace_key_prefix)
```

```bash
terraform workspace new staging
terraform workspace select staging
```

So one backend config can hold `default`, `staging`, `dev` states side by side, selected by `terraform.workspace`. They're good for **ephemeral or structurally-identical copies** (per-developer sandboxes, short-lived feature environments). They're *not* a great fit for prod-vs-dev because they share the same backend, credentials, and code path — it's easy to run an apply against the wrong workspace and hit production. For strong isolation, prefer separate backends/directories per environment.

### Q15. Why is the backend the "collaboration boundary" for a team?

Because the backend is the **one shared source of truth every team member reads and writes**. Your `.tf` files can be duplicated, branched, and reviewed independently, but there is exactly one authoritative state per backend key, and the lock around it is what serialises everyone's changes into a coherent sequence.

That makes the backend the point where collaboration is either safe or chaotic:
- The **lock** turns "many people, one infrastructure" into "one apply at a time."
- The **shared storage** means anyone with access sees the same current reality, so plans are meaningful.
- The **access policy** on it defines who is even allowed to change production.

Design it well — isolated states, locking, versioning, tight IAM — and the backend quietly coordinates a whole org. Design it badly — one giant unlocked local-ish state everyone fights over — and Terraform becomes a source of outages. The state layout *is* your team topology.

### Q16. Design the backend and state layout for a 20-team, multi-account org.

I'd optimise for **blast-radius isolation, least-privilege access, and low lock contention**.

- **One state bucket per account, per region**, with versioning, KMS encryption, blocked public access, and a bucket policy scoped to that account's platform + CI roles. Prod buckets live in prod accounts so their IAM boundary matches.
- **State keyed by environment × component × team**, e.g. `key = "<team>/<component>/<env>/terraform.tfstate"`. Networking, data, and app layers get separate states so a fast-moving app deploy never shares a lock or a blast radius with the VPC.
- **Locking** via DynamoDB table (or `use_lockfile`) per account so locks are independent — 20 teams aren't serialised behind one global lock.
- **Partial backend config** — one shared `backend.hcl` per account supplies bucket/region/table; each component sets only its own `key`, keeping code DRY and env-agnostic.
- **Cross-state references** through published outputs consumed via `terraform_remote_state` (or, preferably, a parameter store / real data sources) so components stay loosely coupled.
- **Remote operations** — run plan/apply in CI (or Terraform Cloud) with per-environment apply roles; humans get plan output, not raw state read.

The through-line: many small, independently-locked, per-account states, wired together loosely, so no single mistake — or single credential — reaches the whole estate.

## State Operations & Manipulation

### Summary

**What this topic covers**

Sometimes the map (state) and the territory (real infrastructure) disagree, or you need to refactor your config without Terraform destroying and recreating everything. That's where **state operations** come in: `terraform import` and import blocks (adopting existing infra), `state mv` and `moved` blocks (renaming/relocating without recreate), `state rm` and `removed` blocks (forgetting a resource without destroying it), `-replace` (the modern replacement for `taint`), and `state pull`/`push` (the dangerous raw dump-and-overwrite). These 16 questions cover *what each command does*, *when you actually need it*, and — critically — *how not to lose your infrastructure while using it*. State surgery is the sharpest tool in Terraform: it mutates the source of truth directly, so the golden rules (never hand-edit, always back up first, always verify with `plan`) run through every answer here.

**Mental model**

Terraform's world has **three things that can drift apart**: your **config** (`.tf` files — desired state), the **state** (Terraform's record of what it manages and its real IDs), and **reality** (the actual cloud resources). Normal `apply` reconciles config → reality via state. State operations are for when the *state itself* is wrong or needs restructuring:

- Resource exists in **reality but not state** → `import` it (adopt).
- Resource exists in **state but not reality** → `state rm` (forget) or refresh.
- Resource needs a **new address** (rename, move into a module) with no change to reality → `state mv` or, better, a `moved` block.
- Resource needs to be **recreated** even though config didn't change → `-replace`.

The senior instinct: prefer the **declarative, version-controlled** forms (`import`/`moved`/`removed` blocks) over the imperative CLI (`state mv`, `import ADDRESS ID`), because the blocks live in code, survive across a team, and are visible in `plan`. And treat `state pull`/`push` as surgery of last resort. Above all: **state is the source of truth Terraform diffs against — corrupt it and Terraform will happily destroy or duplicate real infrastructure to "fix" the discrepancy.**

**Key terms**

- **`terraform import`** — associates an existing real resource with a resource address in state (two-step: write block, then import).
- **Import block** — declarative `import { to = ...; id = ... }`; plannable, can generate config with `-generate-config-out`.
- **`state mv`** — move/rename a resource's address in state without touching reality.
- **`moved` block** — declarative, in-config equivalent of `state mv`; survives across the team.
- **`state rm`** — remove a resource from state so Terraform forgets it; the real resource is untouched.
- **`removed` block** — declarative way to drop a resource from state (and optionally not destroy it).
- **`-replace=ADDRESS`** — force one resource to be destroyed and recreated on next apply (replaces `taint`).
- **`taint`** — deprecated command that marked a resource for recreation; use `-replace` now.
- **`state pull` / `push`** — dump remote state to stdout / overwrite remote state from a file; dangerous.
- **Drift** — divergence between state and reality, typically from out-of-band changes.
- **State surgery** — manually restructuring state to recover from corruption or duplication.

**Why interviewers ask this**

This is the topic that separates people who've *operated* Terraform from people who've only *written* it. Anyone can `apply`; the senior signal is knowing what to do when `apply` wants to destroy and recreate a database because you renamed the resource, or when someone imported a resource twice, or when state and reality have diverged after an incident. Interviewers probe whether you reach for `moved` blocks over `state mv` (team-safety awareness), whether you know `state rm` *doesn't* delete the real resource (a classic misconception with real consequences), and whether you back up state before surgery. Getting these wrong in production means downtime or data loss, so interviewers treat calm, correct state-op answers as a strong proxy for operational trustworthiness.

**Common confusions**

- "`state rm` deletes the resource" — no. It removes it from *state*; the real resource keeps running, now unmanaged. `destroy` deletes; `state rm` forgets.
- "`import` writes the config for me" — the old two-step `import` does not; you write the resource block yourself. Only import *blocks* with `-generate-config-out` can scaffold config.
- "`state mv` and `moved` blocks are interchangeable" — functionally similar, but `moved` blocks are declarative and version-controlled, so the whole team gets the refactor; `state mv` is a one-off on one machine.
- "`taint` is how you force recreation" — deprecated; use `terraform apply -replace=ADDRESS`.
- "You can just edit the tfstate JSON" — never hand-edit; use the `state` subcommands, which keep the file internally consistent.

**What follows from this topic**

State operations only make sense once state lives somewhere shared and recoverable — see **Remote State & Backends** (versioning is what lets you recover from a bad `state push`). The refactoring moves here (`moved` blocks, `state mv` into modules) tie directly into how you structure **modules**. And import/drift work connects to the broader drift-reconciliation story (`plan`, `-refresh-only`, `ignore_changes`) — state ops are how you *fix* the divergence that drift detection *finds*.

### Q1. What are the `terraform state` subcommands and when do you need each?

`terraform state` is a family of commands for inspecting and mutating state directly:

| Subcommand | Purpose | Typical need |
|---|---|---|
| `state list` | List addresses in state | See what Terraform manages |
| `state show <addr>` | Print one resource's attributes | Inspect real IDs/values |
| `state mv <src> <dst>` | Move/rename an address | Refactor without recreate |
| `state rm <addr>` | Remove from state (keep real resource) | Hand off / stop managing |
| `state pull` | Dump remote state to stdout | Backup, inspection, surgery |
| `state push` | Overwrite remote state from a file | Last-resort recovery |
| `state replace-provider` | Rewrite provider references | Provider source migration |

The read-only ones (`list`, `show`) you use constantly and safely. The mutating ones (`mv`, `rm`, `push`) change the source of truth, so you back up first and verify with `plan` after. For most refactoring, the *declarative* equivalents (`moved`/`removed`/`import` blocks) are now preferred over the imperative subcommands.

### Q2. How do you bring existing, manually-created infrastructure under Terraform management?

You **import** it. There are two approaches.

The classic two-step (still common): write the resource block, then import the real resource's ID into that address.

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "acme-logs"
  # ...match the real config
}
```

```bash
terraform import aws_s3_bucket.logs acme-logs
terraform plan   # goal: zero diff
```

Crucially, the two-step `import` **does not write the config** — you author the block by hand, then keep tweaking it until `plan` shows no changes, proving your config matches reality.

The modern approach is **import blocks** (declarative, plannable):

```hcl
import {
  to = aws_s3_bucket.logs
  id = "acme-logs"
}
```

Then `terraform plan` shows the import as part of the plan, and `terraform plan -generate-config-out=generated.tf` can even scaffold the resource block for you. Import blocks are reviewable in a PR and disappear after the import is applied.

### Q3. Compare the old `import` command with the new import blocks.

| | `terraform import ADDRESS ID` | `import { to = ...; id = ... }` block |
|---|---|---|
| Form | Imperative CLI, one machine | Declarative, in config |
| Config authoring | Manual — you write the block first | Can generate with `-generate-config-out` |
| Plannable | No — imports immediately | Yes — shows in `plan` before apply |
| Reviewable | No | Yes — lives in a PR |
| Bulk imports | Tedious, scripted | Multiple blocks, applied together |
| Team-visible | No | Yes, until removed after apply |

The block form is strictly better for anything non-trivial: you see the import in `plan`, teammates review it, and you can generate a starting config. The one caveat is you remove the `import` block after the import succeeds (it's a one-time instruction, not permanent config). The old command still has its place for quick, one-off imports at the terminal.

### Q4. You need to rename a resource or move it into a module without destroying it. How?

Because a resource's **address** is its identity in state, renaming it in config makes Terraform think the old one vanished and a new one appeared — it plans destroy + create. To avoid that, tell Terraform the address moved.

Preferred: a **`moved` block** in config.

```hcl
moved {
  from = aws_instance.web
  to   = aws_instance.app
}
```

Or moving into a module:

```hcl
moved {
  from = aws_instance.app
  to   = module.compute.aws_instance.app
}
```

Run `plan` and you'll see Terraform report the move with **no destroy/recreate**. The imperative equivalent is:

```bash
terraform state mv aws_instance.web aws_instance.app
```

Both preserve the real resource. Prefer the `moved` block: it's version-controlled, so every teammate and CI run applies the same refactor, whereas `state mv` only happens on the machine you ran it on.

### Q5. What does `terraform state rm` do, and what's the classic mistake?

`state rm` **removes a resource from Terraform's state, leaving the real resource untouched.** Terraform simply forgets it exists and stops managing it.

```bash
terraform state rm aws_db_instance.legacy
```

The classic mistake is thinking `state rm` *deletes* the resource. It doesn't — that's `destroy`. `state rm` is the opposite: it *keeps* the real thing and drops the mapping.

When you actually use it:
- **Handing a resource to another config** — remove it here, import it there.
- **Before deleting a module from code** without destroying its resources (you want them to keep running, unmanaged, or move them elsewhere).
- **State surgery** — removing a duplicate/corrupt entry so you can re-import cleanly.

After `state rm`, that resource becomes unmanaged: a future `plan` won't touch it, and if it's still referenced in config, Terraform will try to *create a new one*. So `state rm` usually goes together with either deleting the config too or importing the resource elsewhere.

### Q6. `taint` is deprecated — how do you force a resource to be recreated now?

Use the **`-replace`** planning option:

```bash
terraform apply -replace="aws_instance.web"
# or, to review first:
terraform plan -replace="aws_instance.web"
```

This tells Terraform to destroy and recreate that specific resource on the next apply, even though its config hasn't changed — useful when a resource is in a bad runtime state (corrupted instance, a VM that needs re-imaging) that Terraform can't detect.

`-replace` is better than the old `terraform taint`/`untaint` because it's **part of the plan**: you see exactly what will be replaced *before* applying, rather than mutating state up front and hoping. `taint` mutated state immediately and was easy to forget about. If you want recreation driven by *config* changes instead, use the `replace_triggered_by` lifecycle argument.

### Q7. What do `state pull` and `state push` do, and why are they dangerous?

- **`terraform state pull`** — downloads the current remote state and writes it to stdout. Read-only and safe; great for backups (`terraform state pull > backup.tfstate`) and inspection.
- **`terraform state push`** — takes a local state file and **overwrites** the remote state with it.

```bash
terraform state pull > backup.tfstate
# ...surgery on a copy...
terraform state push edited.tfstate
```

`push` is dangerous because it's a blunt overwrite of the source of truth — no per-resource logic, no merge. If your local file is stale, malformed, or has the wrong serial/lineage, you can clobber good state and Terraform will then plan destructive changes to reconcile. It bypasses the safer per-resource `mv`/`rm`/`import` operations. Use it only as a last resort for surgery Terraform's targeted commands can't express, always from a versioned backup, and verify immediately with `plan`.

### Q8. Why are `moved` blocks better than `state mv` for shared code?

Because `moved` blocks are **declarative and version-controlled**, while `state mv` is a one-off imperative action on a single machine.

If you rename a resource in a shared module and fix your own state with `state mv`, *your* state is correct — but every teammate and every CI pipeline still has the old address. Their next plan sees destroy + create. You'd have to get everyone to run the same `state mv`, which is fragile and error-prone.

A `moved` block committed to the module travels with the code:

```hcl
moved {
  from = aws_instance.web
  to   = aws_instance.app
}
```

Now anyone who pulls the change and runs `plan` gets the move applied automatically, exactly once, with no recreate — including CI and every consumer of the module. It's the difference between "fix my machine" and "fix the refactor for everyone, forever, in code." That's why for library/shared code `moved` blocks are the correct tool.

### Q9. What are `removed` blocks and when would you use one?

A `removed` block is the **declarative way to drop a resource from state**, the in-config counterpart to `state rm`. You use it when you're deleting a resource (or module) from your configuration but want to control whether the real infrastructure is destroyed.

```hcl
removed {
  from = aws_instance.legacy

  lifecycle {
    destroy = false   # forget it, but leave the real resource running
  }
}
```

With `destroy = false`, Terraform removes the resource from state without destroying it — so it keeps running, now unmanaged. This is safer and more reviewable than running `state rm` by hand: it's in a PR, it's applied consistently by everyone and CI, and it documents intent. Like `moved`/`import` blocks, it's a transitional instruction you remove after it's applied. Use it when decommissioning code for a resource you want to hand off, keep, or migrate rather than tear down.

### Q10. Someone changed a resource in the console. Walk me through reconciling drift safely.

**Drift** is state/reality divergence from an out-of-band change. Reconcile it deliberately:

1. **Detect** — run `terraform plan`. The refresh surfaces the difference between recorded state and real attributes. Read carefully: does Terraform want to *revert* the console change (because config is authoritative) or is it showing a genuine new reality?
2. **Decide intent**:
   - The console change was a **mistake** → let Terraform revert it: `terraform apply` brings reality back to config.
   - The console change is **desired** → update your `.tf` config to match, so the next plan is clean and the change is captured in code.
   - The change is on an attribute you'll **never** manage from Terraform → add `lifecycle { ignore_changes = [that_attribute] }` so Terraform stops fighting it.
3. **Reconcile state without changing reality** (if you only want state to catch up): `terraform apply -refresh-only` updates state to match reality without applying config changes.
4. **Verify** — re-run `plan` until it's clean, so state, config, and reality agree.

The unsafe move is blindly `apply`ing and silently reverting a change someone made for a real reason (e.g. an emergency scale-up). Always understand *why* the drift exists before choosing revert vs adopt vs ignore.

### Q11. A resource exists in reality but not in state — and vice versa. How do you handle each?

Two opposite problems, two opposite fixes:

**Exists in reality but not in state** (someone created it by hand, or you `state rm`'d it):
- Write/keep the resource block, then **import** it: `terraform import ADDR ID` or an import block.
- Goal: `plan` shows zero diff, proving state now matches the real resource.

**Exists in state but not in reality** (it was deleted out-of-band):
- A `plan` will show Terraform wanting to *recreate* it (state says it should exist).
- If you *want* it back → `apply` recreates it.
- If it should stay gone → remove it from state and config: `terraform state rm ADDR` (or a `removed` block) plus deleting the block, so Terraform stops trying to recreate it. Alternatively `apply -refresh-only` will notice it's gone and drop it from state.

The mental check is always: **which of state/reality is correct, and which do I move toward the other?** Import moves state toward reality; `rm`/refresh-only removes a phantom; `apply` moves reality toward config.

### Q12. How would you split one giant state into two?

You're extracting a subset of resources into their own configuration/state. Two techniques:

**`state mv` with `-state-out`** — move addresses directly from the source state into a new state file:

```bash
terraform state mv -state-out=../network/terraform.tfstate \
  aws_vpc.main aws_vpc.main
terraform state mv -state-out=../network/terraform.tfstate \
  aws_subnet.private aws_subnet.private
```

Then in the new `network/` config you write the corresponding resource blocks and point at its own backend; `plan` should be clean. The resources are now removed from the original state and present in the new one — no destroy/recreate.

**Pull / edit / push** (heavier surgery) — `state pull` both states, move the resource JSON across, `state push` them back. More error-prone; reserve for cases `state mv` can't express.

Either way: **back up both states first** (they're versioned, or `state pull > backup`), move the config blocks alongside the state moves so config and state stay in sync, and verify each side with `plan` (zero diff) before trusting it.

### Q13. What's the golden rule of state manipulation?

**Never hand-edit the state file — use the `state` subcommands, and back up before any mutation.**

State is a JSON document with internal invariants (a serial number, a lineage, resource dependency ordering, provider references). Hand-editing risks silently corrupting those invariants, and a corrupt state can make Terraform destroy or duplicate real infrastructure. The `state` subcommands (`mv`, `rm`, `import`, `replace-provider`) mutate the file *while keeping it consistent*.

The full discipline:
- **Back up first** — `terraform state pull > backup.tfstate` (or rely on bucket versioning).
- **Prefer declarative blocks** — `moved`/`removed`/`import` over the imperative CLI where possible, so changes are reviewed and reproducible.
- **One change at a time** — don't batch risky surgery.
- **Verify with `plan`** — a clean, expected plan is your proof the operation was correct.

If you can't express what you need with a subcommand or block and are tempted to edit JSON, that's the signal to stop, back up, and think — not to open the file in vim.

### Q14. How do you recover from a corrupted or duplicated state entry?

Approach it as careful surgery, backup-first:

1. **Back up** — `terraform state pull > backup.tfstate` immediately, and confirm bucket versioning is on so you have a rollback.
2. **Diagnose** — `terraform state list` and `state show` to see the duplicate/corrupt addresses; compare against reality.
3. **Remove the bad entry** — `terraform state rm <addr>` for the duplicate or corrupt resource. Remember this only forgets it; the real resource is untouched.
4. **Re-establish the correct mapping** — `import` the real resource back to the correct address if it dropped out of state, or leave it removed if the duplicate was spurious.
5. **Verify** — `terraform plan` should converge to zero diff. If it wants to destroy/recreate something real, stop and re-check before applying.

If the whole state file is unusable, restore the previous version from the versioned bucket (or your `backup.tfstate` via `state push`) and re-apply only the delta. The theme throughout: small reversible steps, a backup you trust, and `plan` as the checkpoint after every move.

### Q15. Why must you verify with `plan` after any state operation?

Because state operations mutate the source of truth **without touching real infrastructure**, so the only way to know you got it right is to ask Terraform what it now *thinks* it needs to do. `terraform plan` diffs the (newly mutated) state against config and reality:

- After an **import** → a clean plan proves your config matches the imported resource (no accidental changes).
- After a **`state mv`/`moved`** → a clean plan proves you moved the address correctly and Terraform won't destroy/recreate.
- After a **`state rm`/`removed`** → the plan shows the resource is no longer managed (and won't be recreated if you also removed the config).
- After a **`state push`** → the plan confirms you didn't clobber good state with something that now wants destructive changes.

An unexpected plan — Terraform wanting to destroy, recreate, or heavily modify a real resource — is the early warning that the state op was wrong. Catching it at `plan` costs nothing; catching it at `apply` can cost an outage. `plan` is the checkpoint that makes state surgery reversible in practice.

### Q16. What's the safe workflow for any risky state surgery, start to finish?

A repeatable, backup-first loop:

1. **Announce + lock context** — make sure no one else is applying (state locking helps), ideally do it outside peak hours.
2. **Back up** — `terraform state pull > backup-$(date +%s).tfstate` and confirm the backend bucket is versioned.
3. **Prefer declarative** — if the change can be a `moved`/`removed`/`import` block in a reviewed PR, do that instead of raw CLI.
4. **One operation at a time** — run the single `state mv`/`rm`/`import` you intend, nothing batched.
5. **Verify with `plan`** — inspect the diff; a clean or expected-only plan is the go/no-go gate. Anything wanting to destroy real resources → stop.
6. **Apply the intended change** (if any) and re-plan to confirm convergence.
7. **Roll back if wrong** — restore the backup via `state push` or the versioned object, and start over.

The whole philosophy is Tidy-First-style small, reversible steps: back up, change one thing, verify, and never treat state as something you edit blind. Do that and even scary surgery — splitting states, recovering from corruption — becomes routine and safe.

## Variables, Outputs & Locals

### Summary

**What this topic covers**

This topic is about **parameterising configurations and moving values through them**: input **variables** (the knobs a caller turns), **locals** (internal named intermediate values), and **outputs** (the results a config or module publishes). It covers type constraints, defaults, `validation` blocks, `sensitive` variables and their limits, the many ways to set a variable and the **precedence order** that decides which wins, `.tfvars` files and per-environment configuration, `TF_VAR_` environment variables, outputs as a module's public API and as the source for `terraform_remote_state`, complex object types with `optional()` attributes, nullable variables, and the discipline of not committing secrets in tfvars. The 15 questions here are foundational — every module you write has inputs, internals, and outputs, and knowing which of the three a value *should* be is a core design skill.

**Mental model**

Think of a Terraform module as a **function**: **variables are its parameters**, **locals are its local variables**, and **outputs are its return values**. That single analogy resolves most "which should I use?" questions:

- A value that a **caller** should be able to set → **variable** (input).
- A value **derived internally** and reused, that no caller should set → **local**.
- A value the module needs to **expose to whoever called it** (or to other configs via remote state) → **output**.

Variables flow *in* (from defaults, env vars, tfvars, CLI flags — with a strict precedence order), locals are computed *inside* (DRY intermediate expressions, never settable from outside), and outputs flow *out*. Two more mental notes for a platform engineer: **type constraints and `validation` blocks are how you make a module fail fast and legibly** at plan time instead of exploding mid-apply; and **`sensitive` only redacts values from CLI output — it does not encrypt them or keep them out of state.** Secrets in a variable still land in plaintext state.

**Key terms**

- **Input variable** — a `variable` block; the module's parameter, with type, default, description, validation.
- **Type constraint** — `string`/`number`/`bool`/`list`/`map`/`set`/`object`/`tuple`; rejects bad input at plan time.
- **`validation` block** — a custom rule (`condition` + `error_message`) enforcing invariants on a variable.
- **`sensitive`** — marks a value so Terraform redacts it in plan/apply output (not in state).
- **Local value** — a `locals` block entry; a named internal expression, computed once, reused.
- **Output** — an `output` block; a published value, optionally `sensitive`, forming a module's public API.
- **`.tfvars` / `.auto.tfvars`** — files that assign variable values; `*.auto.tfvars` are auto-loaded.
- **`TF_VAR_<name>`** — environment variable that sets the variable `<name>`.
- **Precedence** — the order in which conflicting variable sources are resolved (later wins).
- **`optional(type, default)`** — marks an object attribute optional with a fallback, avoiding sprawling required inputs.
- **Nullable** — whether a variable may be `null`; `nullable = false` forbids it.
- **`terraform_remote_state`** — a data source that reads another config's outputs.

**Why interviewers ask this**

Variables/outputs/locals are deceptively simple, so interviewers use them to test **API design sense** and **security hygiene**, not syntax. The senior signal is knowing *when a value should be an input vs a local vs a data source* — over-parameterising (everything a variable) makes modules unusable; under-parameterising makes them rigid. Interviewers probe the precedence order (a frequent real-world gotcha: "why did my `-var` not win?"), whether you understand `sensitive`'s limits (a common false sense of security), and whether you'd ever commit secrets in a `.tfvars` (you wouldn't). For platform roles, module *ergonomics* — good defaults, `optional()` attributes, clear `validation` messages — is the difference between a module the whole org adopts and one everyone forks.

**Common confusions**

- "`sensitive` encrypts the value" — no. It only redacts it from CLI output. The value is still plaintext in state.
- "Locals are just variables" — locals can't be set from outside and aren't part of the module's interface; variables are the input contract.
- "`-var` always wins" — CLI `-var`/`-var-file` are highest, but among files/env vars there's a specific order; know it.
- "Outputs are private" — outputs are a module's *public* API; anything you output is readable by the caller and, via remote state, by other configs.
- "Type = string is enough validation" — type constraints catch shape errors, but semantic rules (valid CIDR, allowed enum values) need `validation` blocks.
- "Optional attributes need `null` checks everywhere" — `optional(type, default)` supplies the fallback for you, so downstream code sees a real value.

**What follows from this topic**

Variables and outputs are the wiring for **modules** — inputs are the module's parameters, outputs its return values, and outputs feed the `terraform_remote_state` reads that connect isolated states (see **Remote State & Backends**). The secrets-in-state caveat here is the same one that makes backend encryption and access control matter. And `for_each` (in the meta-arguments topic) frequently consumes maps built in `locals`, so the local-values patterns here set up dynamic resource creation there.

### Q1. What's the difference between a variable, a local, and an output?

The function analogy nails it: **variables are parameters, locals are local variables, outputs are return values.**

```hcl
variable "environment" {         # input — the caller sets this
  type = string
}

locals {                         # internal — derived, not settable outside
  name_prefix = "acme-${var.environment}"
}

output "bucket_name" {           # result — exposed to the caller
  value = aws_s3_bucket.data.bucket
}
```

- **Variable** — the module's *input contract*. Set by the caller (defaults, tfvars, env, CLI). Has type, default, validation.
- **Local** — an *internal* named expression. Computed inside the module, reused for DRY, and **cannot** be set from outside. Not part of the interface.
- **Output** — the module's *public API*. Exposes a computed value to the calling configuration and, via `terraform_remote_state`, to other configs.

Choosing correctly is a design decision: if a caller should control it → variable; if it's an internal computation → local; if callers/other configs need it → output.

### Q2. Walk through the anatomy of a well-written input variable.

A good `variable` block carries a type, a description, and (where appropriate) a default and validation:

```hcl
variable "instance_count" {
  description = "Number of app instances to run"
  type        = number
  default     = 2

  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 10
    error_message = "instance_count must be between 1 and 10."
  }
}
```

- **`description`** — documents intent; shows in `terraform plan`/docs. Always include it.
- **`type`** — the constraint; rejects wrong-shaped input at plan time (a string where a number is expected).
- **`default`** — makes the variable optional. Omit it to make the variable *required* (Terraform will prompt or error if unset).
- **`validation`** — semantic rules beyond type (ranges, regex, allowed values), with a clear `error_message`.

The discipline: type everything, describe everything, default sensibly, and validate anything with a real constraint. That makes the module self-documenting and fail-fast.

### Q3. How do variable validation blocks work? Give a real example.

A `validation` block enforces a **custom rule** on a variable's value, failing at plan time with a message you write — far better than a cryptic mid-apply provider error.

```hcl
variable "cidr_block" {
  type = string

  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "cidr_block must be a valid CIDR, e.g. 10.0.0.0/16."
  }
}

variable "env" {
  type = string
  validation {
    condition     = contains(["dev", "stage", "prod"], var.env)
    error_message = "env must be one of dev, stage, prod."
  }
}
```

`condition` is a boolean expression referencing `var.<name>`; if it's false, Terraform aborts with `error_message`. Common patterns: `can(...)` to test a function doesn't error (valid CIDR/regex), `contains(...)` for enums, `length(...)` for size limits. You can have multiple `validation` blocks per variable. This turns "the provider rejected it after 3 minutes of apply" into "plan failed instantly with a message that tells me exactly what's wrong."

### Q4. What does marking a variable `sensitive` actually do — and not do?

`sensitive = true` tells Terraform to **redact the value from CLI output** — it shows `(sensitive value)` in plan/apply instead of printing it, and the redaction propagates to anything derived from it.

```hcl
variable "db_password" {
  type      = string
  sensitive = true
}
```

What it does **not** do:
- **It does not encrypt anything.** The value still lands in `terraform.tfstate` in **plaintext**. Anyone who can read state can read it.
- **It doesn't stop the value reaching providers/logs** outside Terraform's own output.
- It can even be slightly annoying — it redacts *everywhere* it flows, so a plan may hide values you wanted to see.

So `sensitive` is about **shoulder-surfing and CI-log hygiene**, not real secret protection. Real protection means: keep secrets out of committed tfvars, source them from a secrets manager or `TF_VAR_` at apply time, encrypt the state backend, and lock down who can read state. For truly keeping a value out of state, look at ephemeral/write-only mechanisms where the provider supports them.

### Q5. List the ways to set a variable and the precedence order.

Terraform resolves a variable's value from multiple sources; **later sources override earlier ones**:

1. **`default`** in the `variable` block (lowest).
2. **Environment variables** — `TF_VAR_<name>`.
3. **`terraform.tfvars`** (and `terraform.tfvars.json`).
4. **`*.auto.tfvars`** / `*.auto.tfvars.json` — loaded automatically, in lexical order.
5. **`-var-file=...`** on the CLI.
6. **`-var 'name=value'`** on the CLI (highest — wins over everything).

```bash
# -var beats the tfvars file beats TF_VAR_ beats default
TF_VAR_region=us-west-2 \
  terraform apply -var-file=prod.tfvars -var 'region=eu-west-1'
# region = eu-west-1
```

The frequent gotcha this explains: "my `TF_VAR_` didn't take effect" — because a `terraform.tfvars` or `-var-file` set the same variable and sits higher in precedence. Knowing this order lets you layer defaults → env-specific tfvars → explicit CLI overrides predictably.

### Q6. How do you manage per-environment configuration with tfvars?

Keep one `.tfvars` per environment and select it at apply time:

```
environments/
  dev.tfvars
  stage.tfvars
  prod.tfvars
```

```bash
terraform apply -var-file=environments/prod.tfvars
```

```hcl
# prod.tfvars
environment    = "prod"
instance_count = 6
instance_type  = "m5.xlarge"
```

The same code, different values per environment — DRY config, no duplicated `.tf`. Notes:
- **`*.auto.tfvars`** is auto-loaded without a flag; handy for values that always apply in a directory, but be careful it doesn't silently override an intended `-var-file`.
- Pair per-env tfvars with per-env **backends** (partial backend config) so `prod.tfvars` and the prod state bucket go together.
- **Never put secrets in committed tfvars** — those files are usually in git. Secrets come from `TF_VAR_` (sourced from a secrets manager) or a data source at apply time.

This is the common lightweight alternative to workspaces for environment separation, and it's more explicit about which env you're targeting.

### Q7. When do you use `TF_VAR_` environment variables?

`TF_VAR_<name>` sets variable `<name>` from the environment. It sits low in precedence (above defaults, below tfvars/CLI). Two main uses:

- **Secrets in CI** — inject `TF_VAR_db_password` from the pipeline's secret store so the value never touches a committed file:

```bash
export TF_VAR_db_password="$(vault read -field=password secret/db)"
terraform apply
```

- **Machine/environment-specific values** — region, account id, credentials-adjacent config that differs per runner without editing code.

The value is always a string as far as the shell is concerned; for complex types you pass JSON (`TF_VAR_tags='{"team":"platform"}'`). The advantage over tfvars is that env vars are the natural interface for CI secret injection and don't risk being committed. The caveat: because they're low precedence, a stray `terraform.tfvars` will silently override them — a classic "why isn't my env var working" trap.

### Q8. What are outputs for, and how are they used across configurations?

Outputs **publish values from a module or root config**. Two roles:

- **A module's public API** — a child module returns computed values (IDs, ARNs, endpoints) to its caller:

```hcl
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID of the created VPC"
}
```

The caller reads `module.network.vpc_id`.

- **Cross-config consumption via remote state** — a root config's outputs can be read by *another* config using the `terraform_remote_state` data source, wiring together isolated states:

```hcl
data "terraform_remote_state" "network" {
  backend = "s3"
  config  = { bucket = "acme-tfstate", key = "network/terraform.tfstate", region = "us-east-1" }
}

resource "aws_instance" "app" {
  subnet_id = data.terraform_remote_state.network.outputs.private_subnet_id
}
```

Outputs can be marked `sensitive = true` to redact them from CLI (same plaintext-in-state caveat). Design outputs deliberately — they're your contract; consumers depend on them, so renaming or removing one is a breaking change.

### Q9. What are locals for, and when is a local the wrong choice?

Locals name **internal intermediate expressions** so you compute once and reuse — DRY, readable config:

```hcl
locals {
  name_prefix = "acme-${var.environment}"
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Team        = var.team
  }
}

resource "aws_s3_bucket" "data" {
  bucket = "${local.name_prefix}-data"
  tags   = local.common_tags
}
```

Use a local when a value is **derived** (from variables, resources, data sources) and **reused or complex** enough that repeating the expression would be error-prone.

When a local is the *wrong* choice:
- The value should be **caller-configurable** → make it a **variable**, not a local (locals can't be set from outside).
- The value comes from **external reality** (an existing resource's attributes) → use a **data source**, not a hardcoded local.
- It's used exactly once and is trivial → inlining may be clearer than a local.

The rule of thumb: variable for inputs, data source for external lookups, local for internal derivation.

### Q10. How do you model a complex configuration object with optional attributes?

Use an `object({...})` type with `optional(type, default)` for attributes that shouldn't be mandatory:

```hcl
variable "service" {
  type = object({
    name          = string
    cpu           = optional(number, 256)
    memory        = optional(number, 512)
    port          = optional(number, 8080)
    public        = optional(bool, false)
    env_vars      = optional(map(string), {})
  })
}
```

A caller only supplies `name` and whatever they want to override:

```hcl
service = { name = "checkout", cpu = 512 }
```

`optional(type, default)` does two things: it makes the attribute non-required, and it **supplies the default when omitted**, so downstream code sees a concrete value rather than `null` — no defensive null-checks scattered everywhere. This is how you keep a rich, structured input ergonomic: mandatory fields required, everything else defaulted. Without `optional()`, every attribute of an object type is required, which forces callers to specify boilerplate they don't care about. It's the key to modules that are both flexible and pleasant to call.

### Q11. What are nullable variables, and when would you set `nullable = false`?

`nullable` controls whether a variable may take the value `null`. By default variables are nullable. Setting `nullable = false` **forbids `null`** — passing `null` becomes an error, and importantly, passing `null` no longer falls back to the default silently.

```hcl
variable "instance_type" {
  type     = string
  default  = "t3.micro"
  nullable = false     # callers cannot pass null to "unset" it
}
```

Why it matters: with a nullable variable, a caller passing `null` gets the default; with `nullable = false`, `null` is rejected outright. Use `nullable = false` when `null` is genuinely meaningless for the variable and you want to catch a caller mistakenly threading a `null` through (e.g. from an upstream `optional()` that defaulted to `null`). It tightens the contract. Conversely, keep a variable nullable when `null` is a meaningful "not set / use provider default" signal that your resource passes straight through.

### Q12. Why must you never commit secrets in tfvars, and what do you do instead?

Because **`.tfvars` files are normal source files that almost always get committed to git** — committing a secret there leaks it into history permanently (rewriting history to remove it is painful and the secret is already compromised, so you'd have to rotate it).

What to do instead:
- **`TF_VAR_` from a secret store** — inject at apply time in CI (`export TF_VAR_db_password=$(vault read ...)`); the value never touches a file.
- **A secrets-manager data source** — read the secret at plan/apply from AWS Secrets Manager / SSM / Vault so it's fetched, not stored in config.
- **Provider-generated + write-only** — let the provider generate the secret and, where supported, use write-only/ephemeral arguments so it isn't persisted.
- **Untracked tfvars as a fallback** — a `secrets.auto.tfvars` in `.gitignore` for local dev, never committed.

And remember: even sourced correctly, secrets Terraform *uses* generally still land in **state** in plaintext, so this must be paired with an encrypted, access-controlled backend. Keeping them out of git is necessary but not sufficient.

### Q13. How do locals help build maps for `for_each`?

`for_each` needs a **map or set of strings**, and building that structure inline in the resource block is unreadable. Locals are where you shape the data:

```hcl
locals {
  users = {
    alice = { role = "admin",     team = "platform" }
    bob   = { role = "developer", team = "payments"  }
  }

  # transform a list of names into a for_each-friendly map
  bucket_map = { for name in var.bucket_names : name => name }
}

resource "aws_iam_user" "team" {
  for_each = local.users
  name     = each.key
  tags     = { role = each.value.role, team = each.value.team }
}
```

By computing the map in a `local` — often with a `for` expression to transform a variable (a list into a keyed map, filtering, deriving keys) — you keep the resource block clean and put the data-shaping logic in one named, testable place. This is one of the most common real uses of locals: turning caller-friendly input (a list, a nested object) into the exact keyed structure `for_each` requires, with stable keys so removing one element doesn't shift the others.

### Q14. What's the difference between variable `validation` and resource `precondition`s?

Both fail fast with a message, but they check **different things at different times**:

- **Variable `validation`** — validates a single **input variable's value**, using only that variable, at the point the variable is evaluated (early, essentially at plan start). Good for input-shape rules: valid CIDR, allowed enum, length limits.

- **`precondition`** (in a resource/data `lifecycle` block) — validates an **assumption before a resource is created/read**, and can reference *other* resources, data sources, and computed values — things not available to a variable `validation`.

```hcl
resource "aws_instance" "app" {
  # ...
  lifecycle {
    precondition {
      condition     = data.aws_ami.selected.architecture == "x86_64"
      error_message = "Selected AMI must be x86_64."
    }
  }
}
```

Rule of thumb: use `validation` for "is this *input* well-formed?" and `precondition` for "is the *state of the world* I'm about to build on actually valid?" There are also `postcondition`s (check a resource's result after apply) for guarantees about what was produced. Together they let a module assert its assumptions instead of failing obscurely deep in a provider.

### Q15. Give an overview of ephemeral values — what problem do they solve?

Ephemeral values are Terraform's answer to the **"secrets always end up in state" problem**. An ephemeral value exists only *during* a plan/apply operation and is **never persisted to state or plan files**.

The pieces:
- **Ephemeral variables and outputs** — marked `ephemeral = true`; they carry a value through a run but aren't stored, so a fetched token or password doesn't linger in state.
- **Ephemeral resources** — a resource type that produces a transient result (e.g. a short-lived credential/secret fetch) used within the run and then discarded.
- **Write-only arguments** — resource arguments (like a DB password) that Terraform sends to the provider but does not read back or store in state.

```hcl
variable "db_password" {
  type      = string
  ephemeral = true
}
```

Why it matters: it's the first mechanism that genuinely keeps a secret *out of state*, unlike `sensitive` (which only redacts output). For a platform engineer handling credentials, ephemeral values + write-only arguments are the modern way to stop secrets from accumulating in plaintext state — pairing with, and partly reducing reliance on, backend encryption. It's newer functionality, so provider support varies, but the direction is clear: transient secrets that never touch disk.
## Modules

### Summary

**What this topic covers**

Modules are Terraform's unit of reuse and encapsulation — a container for a group of resources that gets a single, named input/output contract. This topic covers what a module actually *is* (every Terraform configuration is already a module — the **root module** — and modules you call are **child modules**), the conventional module layout (`main.tf` / `variables.tf` / `outputs.tf` / `versions.tf`), how to call one (the `module` block, `source`, passing inputs as arguments, referencing `module.name.output`), the full range of **module sources** (local paths, the Terraform Registry, git, S3/GCS, subdirectories via `//`), **version pinning** for registry and git modules and why unpinned modules are dangerous, passing providers into modules, `count`/`for_each` on module blocks, the `.terraform/modules` install, refactoring existing resources into a module with `moved` blocks, and — importantly — when *not* to reach for a module. The 17 questions here range from "what is a module" to "someone gave you a module with 40 inputs — critique it" and "refactor these resources into a module without recreating them."

**Mental model**

Think of a module as a **function for infrastructure**: input variables are the parameters, resources are the body, and outputs are the return values. The `module` block is the call site. Just like a function, a good module has a small, meaningful signature and hides its internals — consumers should reason about *what* it provisions, not *how*. The **root module** is the directory you run `terraform apply` in; it wires child modules together and owns the backend and provider configuration. Child modules should generally **not** configure their own providers or backends — they inherit them. When you run `init`, Terraform downloads/copies each `source` into `.terraform/modules/` and records it in a manifest; `plan`/`apply` then treat the module's resources as part of one flattened dependency graph with addresses like `module.network.aws_vpc.this`. The key discipline: modules are an **abstraction boundary**, and every variable and output you expose is public API you'll have to keep stable.

**Key terms**

- **Root module** — the top-level directory where you run Terraform; owns backend + providers.
- **Child module** — any module called via a `module` block.
- **`source`** — where the module code lives (local, registry, git, S3/GCS).
- **Input variable** — a `variable` block; the module's parameters / public contract.
- **Output value** — an `output` block; what the module returns to its caller.
- **Module call** — a `module "name" { ... }` block instantiating a child module.
- **Registry module** — published as `namespace/name/provider` (e.g. `terraform-aws-modules/vpc/aws`).
- **Version constraint** — the `version` argument (registry) or `?ref=` (git) that pins which module code you get.
- **Module instance** — one instantiation; `count`/`for_each` on a module block produce many.
- **`.terraform/modules`** — local install directory + `modules.json` manifest, populated by `init`.
- **`moved` block** — refactor addresses (e.g. into a module) without destroy/recreate.
- **Composition** — modules calling modules to build larger units from smaller ones.

**Why interviewers ask this**

Modules are where you see whether a candidate has actually *operated* Terraform at scale versus written a single `main.tf`. Juniors describe modules as "copy-paste avoidance." Seniors talk about them as **API design** — stable interfaces, semantic versioning, encapsulation, and the cost of a leaky abstraction that a hundred consumers depend on. The tell-tale senior signals: pinning module versions (and knowing an unpinned git module can change under you between applies), keeping composition shallow instead of nesting five layers deep, *not* wrapping a single resource in a module for no reason, and knowing how to refactor into a module safely with `moved` blocks rather than a destroy/recreate. Interviewers also probe provider passing — a subtle area where a lot of otherwise-competent people get it wrong.

**Common confusions**

- "The root config isn't a module" — it is; it's the **root module**. Everything is a module.
- "A module needs its own provider block" — usually the opposite; reusable modules should **not** hardcode providers. Inherit or pass them in explicitly.
- "`source` can be a variable / interpolated" — no. `source` and `version` must be static literals; you can't compute them.
- "Registry and git version pinning are the same syntax" — registry uses the `version` argument; git uses `?ref=` in the URL. The `version` argument is only for registry/private-registry sources.
- "Modules improve performance" — they're an organizational construct; the flattened graph is the same. Modules are for humans.
- "More modules is always better" — premature modularization (a module per single resource) adds indirection with no reuse payoff.

**What follows from this topic**

Modules are the foundation for **Module Design & Reuse** (the very next topic), which goes deep on *good* module design — interfaces, composition over configuration, avoiding over-parameterization, and private registries. Version pinning here connects to provider and state discipline elsewhere in this primer. The `moved` block introduced here reappears in refactoring and in **Drift Detection & Reconciliation** — both are about changing what Terraform manages without tearing down real infrastructure. If modules feel fuzzy, lock this down before the design topic, because design questions assume you already know the mechanics.

### Q1. What is a Terraform module, and what problem does it solve?

A **module** is a reusable, self-contained group of resources with a defined input/output contract — the infrastructure equivalent of a function. It solves two problems: **reuse** (define a "standard VPC" or "standard service" once, instantiate it many times with different inputs) and **encapsulation** (consumers depend on a stable interface — variables in, outputs out — not on the internal resource wiring).

Every Terraform configuration is already a module — the directory you run `apply` in is the **root module**. When it calls another module via a `module` block, that's a **child module**.

The payoff at scale: a 50-service org doesn't write 50 bespoke VPC configs; it writes one VPC module and calls it 50 times. Fix a bug once, bump the version, done.

### Q2. What's the standard file structure of a module?

Convention (Terraform doesn't enforce it, but everyone follows it):

```hcl
# main.tf       — the resources (the body)
# variables.tf  — input variables (the parameters)
# outputs.tf    — output values (the return values)
# versions.tf   — required_version + required_providers
# README.md     — docs; examples/ dir for usage examples
```

Terraform loads **all** `.tf` files in the directory and concatenates them — filenames are for humans, not the parser. You could put everything in `main.tf`; the split exists so a reader knows where to look. `variables.tf` and `outputs.tf` together are the module's public API — reviewers read those two files first to understand the contract.

### Q3. How do you call a module and consume its outputs?

Use a `module` block with a `source` and input arguments, then reference `module.<name>.<output>`:

```hcl
module "network" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"

  name = "acme-prod"
  cidr = "10.0.0.0/16"
}

resource "aws_instance" "app" {
  subnet_id = module.network.private_subnet_ids[0]  # consuming an output
}
```

The arguments (`name`, `cidr`) map to the module's `variable` blocks. `module.network.private_subnet_ids` reads an `output` the module declares. There's no way to reach *inside* a module to grab a resource attribute the module didn't export — outputs are the only escape hatch, which is exactly the encapsulation you want.

### Q4. What are the different module sources, and when do you use each?

| Source | Example | Use when |
|---|---|---|
| Local path | `source = "./modules/vpc"` | Module lives in the same repo/config |
| Terraform Registry | `source = "terraform-aws-modules/vpc/aws"` | Public/private registry module (needs `version`) |
| Generic git | `source = "git::https://github.com/acme/tf-vpc.git?ref=v1.2.0"` | Module in a git repo you control |
| GitHub shorthand | `source = "github.com/acme/tf-vpc"` | Quick GitHub reference |
| S3 / GCS | `source = "s3::https://s3.amazonaws.com/my-tfstate-bucket/vpc.zip"` | Module packaged in object storage |
| Subdirectory | `source = "git::https://github.com/acme/modules.git//vpc?ref=v1.2.0"` | Mono-repo of modules; `//` selects a subdir |

Local paths are resolved relative to the *calling* module. The `//` double-slash separates the repo/package from a subdirectory within it — essential for a mono-repo that holds many modules.

### Q5. How do you pin a module version for registry vs git sources, and why does it matter?

**Registry** modules use the `version` argument with a constraint:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"   # >= 5.8.0, < 6.0.0
}
```

**Git** modules pin with `?ref=` — a tag, branch, or commit SHA:

```hcl
module "vpc" {
  source = "git::https://github.com/acme/tf-vpc.git?ref=v1.2.0"
}
```

Why it matters: an **unpinned** module is a moving target. A git source with no `?ref` tracks the default branch — so someone merging to `main` can change your infrastructure the next time you run `apply`, with no change in *your* code. That's a reproducibility and supply-chain nightmare. Always pin to an immutable tag (or ideally a SHA for git). Pin registry modules with `~>` so you get patches but not breaking majors.

### Q6. What's the difference between the root module and a child module?

The **root module** is the directory where you run `terraform init/plan/apply`. It's special: it owns the **backend** configuration (where state lives), the **provider** configurations, and it's where `terraform.tfvars` is read. A **child module** is any module invoked with a `module` block.

Key asymmetry: child modules **inherit** the root's providers (unless you explicitly pass different ones) and cannot declare their own backend. Variables in the root come from CLI/`.tfvars`/env; variables in a child come from the arguments in its `module` block. Outputs from the root are what `terraform output` shows; outputs from a child are consumed by whoever called it.

### Q7. How do you pass providers into a module, and when do you need to?

By default a child module uses the **default** provider config it inherits from the root. You need to pass providers explicitly when the module must use a *specific aliased* provider — e.g. multi-region or cross-account:

```hcl
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}
provider "aws" {
  alias  = "eu_west"
  region = "eu-west-1"
}

module "us_stack" {
  source    = "./modules/stack"
  providers = { aws = aws.us_east }
}

module "eu_stack" {
  source    = "./modules/stack"
  providers = { aws = aws.eu_west }
}
```

Best practice for **reusable** modules: don't declare `provider` blocks inside them. If a module needs multiple providers, declare `configuration_aliases` in its `required_providers` so the caller must pass them in. Hardcoding a provider (region, credentials) inside a shared module makes it un-reusable.

### Q8. What is module composition, and how deep should modules nest?

**Composition** is building larger modules by calling smaller ones — e.g. a "service" module that calls a "network" module and a "database" module. It's the recommended way to build complexity: combine small, focused modules rather than write one giant configurable one.

The discipline is **keep it shallow**. A common anti-pattern is "module calling module calling module calling module" — by the third layer of nesting, nobody can tell what actually gets created or trace a variable from the root to the resource it sets. Prefer **flat composition**: the root module calls several focused child modules directly and wires their outputs together, rather than deeply nesting. Two levels is usually plenty; beyond that, the indirection costs more than it saves.

### Q9. Why are input variables and outputs called the module's "public API"?

Because they're the **only** contract between the module and its consumers. Everything else — resource names, internal `locals`, how many resources the module creates — is implementation detail the consumer neither sees nor should depend on.

That framing has real consequences:

- **Renaming or removing a variable is a breaking change** — every caller must update. Bump a major version.
- **Removing or renaming an output is a breaking change** — you might be feeding a hundred downstream configs.
- Internal refactors (splitting a resource, renaming a `local`) are *not* breaking as long as the variables and outputs stay stable — that's the whole point of the boundary.

Treat variables/outputs with the same care as a REST API or a library's exported functions.

### Q10. How do count and for_each work on module blocks?

Both create **multiple instances** of a module, just like on a resource:

```hcl
module "service" {
  source   = "./modules/service"
  for_each = toset(["auth", "billing", "search"])
  name     = each.key
}
# addresses: module.service["auth"], module.service["billing"], ...
```

```hcl
module "replica" {
  source = "./modules/db"
  count  = var.replica_count
}
# addresses: module.replica[0], module.replica[1], ...
```

Prefer `for_each` over `count` for the same reason as with resources: `for_each` keys instances by a stable map/set key, so removing the middle element doesn't shift all the others and trigger needless destroy/recreate. Referencing an output becomes `module.service["auth"].endpoint`.

### Q11. What lives in .terraform/modules, and when is it populated?

`terraform init` is the module install step. It:

1. Downloads/copies each `source` into `.terraform/modules/<name>/`.
2. Writes `.terraform/modules/modules.json` — a manifest mapping module names to their local install paths and versions.

Local-path modules are referenced in place; registry and git modules are actually fetched. This is why you must re-run `init` after adding a new module or changing a module's `source`/`version` — `plan` reads the installed copy, not the remote. `.terraform/` is a local cache and belongs in `.gitignore`.

### Q12. When should you NOT create a module?

When there's **no reuse and no meaningful encapsulation** — modularizing then just adds indirection.

Red flags for premature abstraction:

- Wrapping a **single resource** in a module (e.g. a module whose entire body is one `aws_s3_bucket`) — the module adds a variable-passing layer and buys nothing. Just declare the resource.
- "We might reuse it someday." Apply the **rule of three**: abstract on the third real occurrence, not the first speculative one.
- A module used in exactly one place, forever. That's not reuse; it's a filing decision, and inlining is clearer.

Modules cost indirection: a reader now has to jump into another directory to see what happens. Only pay that cost when reuse or a genuine encapsulation boundary justifies it.

### Q13. Local vs remote modules — what's the trade-off?

| | Local (`./modules/x`) | Remote (registry/git) |
|---|---|---|
| Versioning | Tracks your repo's commit | Independently versioned (`version`/`?ref`) |
| Sharing across repos | No (same repo only) | Yes |
| Change blast radius | Changes with your repo | Controlled by version bumps |
| Best for | Repo-internal structure | Org-wide shared building blocks |

Local modules are great for organizing a single configuration — no version management overhead, changes are atomic with the rest of the repo. Remote modules are for **cross-team reuse**: publish once, many repos consume specific pinned versions, and you can roll out a fix as a version bump without touching consumers' code. The cost of remote is the version lifecycle (semver, changelogs) you now have to maintain.

### Q14. Public Terraform Registry vs a private registry — when do you use each?

The **public registry** (registry.terraform.io) hosts community and vendor modules — `terraform-aws-modules/vpc/aws` and friends. Great for common, well-trodden infrastructure; you get battle-tested code for free. Caveats: audit before adopting, pin the version, and understand you're taking a third-party dependency into your infra.

A **private registry** (Terraform Cloud/Enterprise, or a self-hosted implementation of the registry protocol) hosts your **org's internal modules** — your golden-path "service" module, your compliant "network" module. Benefits: the clean `namespace/name/provider` + `version` syntax, discoverability across teams, access control, and a single blessed source of truth so every team builds on the same approved patterns. Most mature orgs run a private registry for their standards and cherry-pick from the public one for commodity infra.

### Q15. How does semantic versioning apply to modules, and what counts as a breaking change?

Modules should follow **semver** (MAJOR.MINOR.PATCH) via git tags / registry versions:

- **MAJOR** — breaking: renamed/removed a variable, renamed/removed an output, changed a default that forces resource replacement, dropped a provider.
- **MINOR** — additive: new optional variable (with a default), new output, new capability that's backward compatible.
- **PATCH** — bug fix, no interface change.

Consumers pin with `~> 5.8` to get MINOR/PATCH but not the breaking MAJOR. As a module author, keep a **changelog** and treat the variable/output surface as sacred — a careless rename ships a breaking change to everyone pinned on `~>`. When you must break, bump MAJOR and document the migration.

### Q16. Can you use depends_on on a module, and when would you?

Yes. `depends_on` on a `module` block forces the entire module to wait until the listed resources/modules are created:

```hcl
module "app" {
  source     = "./modules/app"
  depends_on = [module.network]
}
```

You usually **don't** need it — Terraform infers ordering from data flow (if `module.app` references `module.network.subnet_ids`, the dependency is automatic). Reach for explicit `depends_on` only for **hidden dependencies** the graph can't see: e.g. the app module needs IAM permissions or a VPC endpoint that it doesn't directly reference but relies on at runtime. Overusing `depends_on` serializes your graph and slows applies, so treat it as a last resort after preferring natural references.

### Q17. Walk me through refactoring existing resources into a module without recreating them.

The danger: moving a resource's *config* into a module changes its **address** (`aws_vpc.main` → `module.network.aws_vpc.main`). Terraform sees the old address gone and a new one appearing and plans a **destroy + create** — catastrophic for a live VPC.

The safe way is the **`moved` block**, which tells Terraform the address changed but the object is the same:

```hcl
moved {
  from = aws_vpc.main
  to   = module.network.aws_vpc.main
}
```

Process:

1. Create the module and move the resource definitions into it.
2. Add a `moved` block in the root for **every** resource whose address changed.
3. Run `terraform plan` — it should show "N resources will be moved" and **no** create/destroy. If you see destroy/create, an address is still mismatched.
4. `apply` — Terraform updates state addresses only; no real infra touched.
5. Keep the `moved` blocks for a release cycle so anyone on old state migrates cleanly, then remove them.

`moved` blocks are declarative and committed to code (unlike the old imperative `terraform state mv`), so the refactor is reviewable and reproducible for everyone on the team.

## Module Design & Reuse

### Summary

**What this topic covers**

The previous topic covered module *mechanics*; this one covers module **design** — what separates a module people love to consume from one they fork in frustration. It covers the principles of good design (single clear purpose, sensible defaults, minimal required inputs, composability), the thin/flat vs fat/nested trade-off and the "module calling module calling module" anti-pattern, **composition over configuration** (combine small modules rather than build one giant knobs-everywhere module), the distinction between a **resource module** and an **infrastructure/pattern module**, when to modularize at all (rule of three vs premature abstraction), interface design (variables as the contract, `optional()` object attributes, sensible defaults), avoiding over-parameterization (the 80-variable god module smell), baked-in naming/tagging conventions, provider configuration in reusable modules, versioning and changelog strategy, private registries, testing and `examples/` directories, feature flags via `count`/`for_each`, and the common anti-patterns. The 15 questions are deliberately opinionated — this is the topic where an interviewer hands you a bad module and asks you to critique it.

**Mental model**

Design a module the way you'd design a **library API**: optimize for the *consumer's* experience, not the author's convenience. The best modules do **one thing**, have a **small required surface** (most inputs optional with good defaults), and **compose** — you build a platform out of a handful of focused modules, not one mega-module with a boolean for every decision. The central tension is **DRY vs readability**: yes, factor out repetition, but a module so parameterized that every use needs 40 arguments is worse than a little duplication. The mental test for any input: "does a real consumer genuinely need to vary this, or am I exposing an internal detail?" Prefer **composition over configuration** — instead of one module with `enable_x`, `enable_y`, `enable_z` flags, ship small modules the consumer combines. And remember the **rule of three**: don't abstract until you have three real, concrete uses; premature modularization bakes in the wrong seams.

**Key terms**

- **Resource module** — a thin wrapper adding conventions around one resource type (e.g. an S3 bucket with your org's encryption/tagging defaults).
- **Infrastructure / pattern module** — composes many resources into a complete capability (a full "service" stack: compute + network + DB + IAM).
- **Composition over configuration** — combine small modules rather than toggle features inside one big one.
- **Over-parameterization** — exposing so many variables the module becomes as complex as writing the resources directly.
- **`optional()`** — marks an object-type attribute optional with a default; keeps the required surface small.
- **Interface** — the variable/output contract; the only thing consumers should couple to.
- **Sensible defaults** — defaults that make the common case a one-liner.
- **Rule of three** — abstract on the third real occurrence, not speculatively.
- **God module** — a bloated module trying to do everything, with dozens of flags.
- **terraform-docs** — tool that auto-generates input/output docs from the module.
- **Private registry** — org-internal distribution of blessed modules.
- **`examples/`** — runnable usage examples that double as documentation and test fixtures.

**Why interviewers ask this**

This is the single best topic for separating "wrote some Terraform" from "owns a platform." Design questions have no syntax to hide behind — you're reasoning about interfaces, blast radius, and human ergonomics. Seniors instinctively minimize required inputs, refuse to hardcode providers, distinguish resource modules from pattern modules, and can articulate *why* an 80-variable module is a smell (it's leaking every internal decision to the consumer). They know the rule of three and won't modularize a single resource speculatively. The classic interview move is "here's a module with 50 variables and three nested submodules — review it" — and they want to hear you talk about purpose, defaults, composition, and the DRY-vs-readability trade-off, not just "looks fine."

**Common confusions**

- "More configurable = more reusable" — past a point it's the opposite; over-parameterization makes a module as hard to use as raw resources.
- "DRY means never repeat anything" — some duplication is cheaper than the wrong abstraction. Readability can beat DRY.
- "A pattern module and a resource module are the same" — they sit at different altitudes and are versioned/reused differently.
- "Put the provider config inside the reusable module" — no; that couples every consumer to your region/credentials. Pass providers in.
- "Feature flags belong as `enable_*` booleans" — often better expressed as `count`/`for_each` = 0/1 or as separate composable modules.
- "Examples are optional" — `examples/` is how consumers learn the module and how you test it; skipping it is a design smell.

**What follows from this topic**

This closes the module arc that began with **Modules** — mechanics there, judgment here. The design principles (small interfaces, encapsulation, versioning) echo the state and provider discipline elsewhere in the primer, and the testing/`examples` thread connects to any dedicated module-testing topic. Feature flags via `count`/`for_each` tie back to the resource-meta-argument material. And "don't leak implementation, expose a stable interface" is the same instinct that makes drift and refactoring (next topic, and the `moved`-block work) safe: a clean boundary is what lets you change internals without breaking consumers.

### Q1. What makes a good Terraform module?

Four properties, in priority order:

1. **Single clear purpose** — it does one recognizable thing ("a compliant VPC," "a service"). If you can't name it in a phrase, it's doing too much.
2. **Minimal required inputs** — the common case should be a few lines. Most inputs optional with sensible defaults; only truly per-use values required.
3. **Sensible defaults** — encode your org's good decisions (encryption on, sane instance sizes, standard tags) so consumers get the golden path for free.
4. **Composability** — it plays well with other modules; outputs feed the next module's inputs; it doesn't try to own the whole world.

Underlying all of it: treat it as **API design**. Optimize for the consumer reading the `module` block, not for the author writing the internals.

### Q2. Thin/flat vs fat/nested modules — which do you prefer and why?

Prefer **thin and flat**. A thin module wraps a focused set of resources with a clean interface; a flat composition has the root call several focused modules directly.

The anti-pattern is **fat and deeply nested**: one enormous module, or "module → module → module → module." By the third nesting level nobody can trace a variable from the root down to the resource it configures, and a small change has an unpredictable blast radius. Debugging means spelunking through directories.

Flat composition keeps the wiring visible at the top: the root module reads like a wiring diagram of named building blocks. You trade a slightly longer root config for the ability to actually understand and change the system. Depth is where comprehension goes to die.

### Q3. Explain "composition over configuration" for modules.

Two ways to make a module handle variation:

- **Configuration**: one big module with flags — `enable_monitoring`, `enable_replica`, `enable_cdn`, `use_spot`, ... Every consumer sees every knob; the module's body is a thicket of `count = var.enable_x ? 1 : 0`.
- **Composition**: small, focused modules the consumer **combines**. Want monitoring? Add the monitoring module. Want a replica? Add the replica module.

Composition wins because each piece stays simple and independently testable, consumers only pull in what they need, and you avoid the combinatorial explosion of flag interactions (does `enable_spot` work with `enable_replica`? who knows). Configuration has its place for genuinely small variations, but when you find yourself adding the tenth boolean, that's the signal to split into composable modules instead.

### Q4. What's the difference between a resource module and an infrastructure/pattern module?

**Resource module** — a thin wrapper around **one** (or a couple of tightly-related) resource types, adding your org's conventions: an S3 bucket module that bakes in encryption, versioning, block-public-access, and standard tags. Low-level, highly reusable, changes rarely.

**Infrastructure / pattern module** — composes **many** resources into a complete capability: a "service" module that stands up compute + load balancer + DNS + database + IAM as one unit. Higher-level, encodes an architectural pattern, and typically *itself* composes resource modules.

Why it matters: they're versioned and consumed differently. Resource modules are the stable Lego bricks; pattern modules are the assembled models that use them. Mixing altitudes — a "service" module that also exposes 30 low-level S3 knobs — is exactly how you get a god module.

### Q5. When should you modularize, and when is it premature?

Modularize when there's **real, demonstrated reuse or a genuine encapsulation boundary**. The heuristic is the **rule of three**: the first time you write something, just write it; the second time, note the duplication; the **third** real occurrence, abstract — now you know which parts actually vary.

It's **premature** when:

- You wrap a single resource "in case we reuse it." You probably won't, and if you do, extracting later is cheap.
- You abstract off one example, so the interface guesses wrong about what varies and you refactor it three times.
- The module is used in exactly one place, forever.

Premature abstraction is expensive because a wrong abstraction is harder to unwind than duplication. Duplication is cheap to spot and delete; a bad seam propagates through every consumer.

### Q6. How do you design a module's interface?

The **variables and outputs are the contract** — design them deliberately:

- **Expose what varies, hide what doesn't.** If every consumer passes the same value, make it a `local`, not a variable.
- **Don't leak implementation.** A variable named `internal_sg_rule_priority` exposes a detail consumers shouldn't know. Name and shape inputs around the consumer's mental model.
- **Minimize required inputs.** Required = no default. Keep that list short; make everything else optional with defaults.
- **Output what consumers need to wire onward** — IDs, endpoints, ARNs — and nothing gratuitous. Every output is API you must keep stable.
- **Use typed variables** (`type = object({...})`, `list(string)`) so misuse fails at `plan`, not at `apply`.

Test the design by writing the `module` block *first*, as a consumer, before implementing. If the call site reads cleanly, the interface is good.

### Q7. How do sensible defaults and optional() object attributes keep the interface small?

Every **required** variable is friction — the consumer must supply it every time. Push as much as possible to **optional with a good default** so the common case is a one-liner.

For structured inputs, `optional()` lets object attributes have defaults so consumers only set what they care about:

```hcl
variable "settings" {
  type = object({
    name       = string
    monitoring = optional(bool, true)
    tier       = optional(string, "standard")
    replicas   = optional(number, 1)
  })
}
```

A consumer can now pass just `{ name = "auth" }` and get monitoring on, standard tier, one replica — all defaulted. Without `optional()`, they'd have to specify every field. This is how you make a module both **powerful** (lots of knobs available) and **easy** (almost nothing required) at once.

### Q8. What's wrong with a module that has 80 variables?

It's a **god-module smell**. Symptoms and consequences:

- **It's not actually an abstraction.** If you must configure everything, the module gives you no leverage over just writing the resources — you've added a variable-passing layer for nothing.
- **It's leaking internals.** 80 variables means nearly every internal decision is exposed; there's no encapsulation left.
- **Every knob is a maintenance and testing burden** — the combinatorial space of interactions is untestable.
- **Consumers are overwhelmed** and cargo-cult the example, understanding none of it.

The usual cause is trying to serve every team's needs with one module. The fix is **composition** (split into focused modules), **better defaults** (most of those 80 shouldn't be required or even present), and accepting that a little duplication across two simpler modules beats one unusable mega-module.

### Q9. How should naming and tagging conventions be handled in modules?

**Bake them in.** A module is the perfect place to enforce org standards so every consumer gets them for free and can't forget:

```hcl
locals {
  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "service"
  })
}
```

Apply `local.common_tags` to every resource in the module. Derive names from a convention (`"${var.environment}-${var.name}"`) rather than accepting fully arbitrary names. Accept a `tags` variable for consumer additions, but `merge` your mandatory tags on top so they can't be dropped. Provider-level `default_tags` (AWS) can complement this. The point: consistency shouldn't rely on every consumer remembering — encode it once in the module.

### Q10. How should provider configuration be handled in a reusable module?

**Don't put `provider` blocks inside a reusable module.** A hardcoded provider (region, profile, credentials) makes the module usable in exactly one context and breaks multi-region/multi-account use.

Instead:

- Let the module **inherit** the default provider from the caller for the simple case.
- If the module needs a *specific* or *multiple* providers, declare `configuration_aliases` in its `required_providers` so the caller is **forced** to pass them explicitly via the `providers` argument.

```hcl
terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.primary, aws.replica]
    }
  }
}
```

This keeps the module portable: the caller owns provider config (regions, credentials), and the module just declares what it needs. Also note: a module with an embedded `provider` block can't be cleanly `for_each`'d and complicates removal — another reason to keep provider config in the root.

### Q11. What's your versioning and changelog strategy for shared modules?

Treat shared modules as **released software**:

- **Semver via git tags / registry versions.** MAJOR = breaking interface change, MINOR = additive, PATCH = fix.
- **Maintain a CHANGELOG** so consumers know what a bump means before they take it.
- **Consumers pin** with `~> 1.4` (registry) or `?ref=v1.4.0` (git) so they choose when to move.
- **Breaking changes get a MAJOR bump and a migration note** — never sneak a variable rename into a MINOR.
- Provide an **upgrade path**: when you rename a variable, support both for a MINOR with a deprecation warning, then remove the old one in the next MAJOR.

The mindset: a hundred teams might depend on this module. A careless change is an org-wide incident. Discipline here is what makes shared modules safe to consume.

### Q12. Why do modules ship an examples/ directory and use terraform-docs?

**`examples/`** is a directory of runnable configurations that call the module in representative ways (`examples/simple/`, `examples/complete/`). It serves three purposes at once: it's the **best documentation** (consumers copy from it), it's a **test fixture** (CI runs `plan`/`apply` against each example), and it's a **design check** (if the example reads badly, the interface is wrong).

**terraform-docs** auto-generates the inputs/outputs/requirements tables in the README from the module's `variable` and `output` blocks. It keeps docs in sync with code (run it in CI to fail if the README is stale) so the documented interface never drifts from the actual one. Together they mean a consumer can understand and trust the module without reading its internals — which is the whole point of encapsulation.

### Q13. How do you implement a feature flag / optional resource in a module?

Use `count` (or `for_each`) driven by a boolean/collection input:

```hcl
variable "enable_monitoring" {
  type    = bool
  default = false
}

resource "aws_cloudwatch_dashboard" "this" {
  count = var.enable_monitoring ? 1 : 0
  # ...
}
```

The resource exists only when the flag is set. Reference it defensively — `aws_cloudwatch_dashboard.this[0]` or via `one(aws_cloudwatch_dashboard.this[*].id)` to get `null` when absent.

The caution: a handful of feature flags is fine, but if you're adding them constantly, that's the **composition-over-configuration** signal — split the optional pieces into separate modules the consumer opts into, rather than accumulating flags. Flags also multiply your test matrix, so keep them few and orthogonal.

### Q14. What are the classic module anti-patterns?

- **God module** — does everything, dozens of variables, no clear purpose. Split it.
- **Conditional-everything** — `count = var.enable_x ? 1 : 0` on nearly every resource; the module is more branching than substance. Compose instead.
- **Single-resource wrapper** — a module whose whole body is one resource, no conventions added, used once. Just write the resource.
- **Deep nesting** — module→module→module; untraceable. Flatten.
- **Hardcoded provider/region/account** — un-portable. Pass providers in.
- **Leaky interface** — variables that expose internals; renaming internals breaks consumers.
- **Copy-paste instead of module** — the same 200 lines duplicated across ten repos with subtle drift. The one case where you *should* have modularized.
- **Unpinned module sources** — consuming a module with no `version`/`?ref`, so it changes under you.

The meta-signal: any module you can't describe in one sentence, or whose call site needs a manual to understand, has an anti-pattern in it.

### Q15. In an interview, how would you review a module's design?

I'd work through a checklist out loud:

1. **Purpose** — can I name what this module does in one phrase? If not, it's doing too much.
2. **Required surface** — how many inputs have no default? A long required list is friction; most should be optional.
3. **Defaults** — do the defaults encode the good decision (encryption, tagging), so the common case is a one-liner?
4. **Encapsulation** — do any variables/outputs leak internals? Would renaming an internal resource break a consumer?
5. **Composition** — is this one focused thing, or a god module with 40 flags that should be split?
6. **Providers** — does it hardcode a provider/region, or accept them? (Portability check.)
7. **Versioning & docs** — semver tags, changelog, `examples/`, terraform-docs README?
8. **Nesting** — flat composition or four layers deep?

Then I'd give a concrete verdict: what I'd keep, what I'd split, which variables I'd remove or default. The interviewer wants **judgment and trade-off reasoning**, not a rubber stamp.

## Drift Detection & Reconciliation

### Summary

**What this topic covers**

Configuration drift — the real infrastructure diverging from what Terraform's state and config say it should be — and how to detect and reconcile it safely. This topic covers what drift *is* and why it happens (out-of-band console edits, ClickOps, autoscalers, other automation, provider defaults), **how Terraform detects it** (the refresh step at the start of `plan`), the refresh controls (`-refresh-only`, `-refresh=false`), the reconciliation options (let Terraform revert it, update config to match reality, or `import` unmanaged resources), the **`lifecycle { ignore_changes }`** escape hatch for *deliberately* tolerating drift on specific attributes and its dangers, continuous/automated drift detection (`-detailed-exitcode`, scheduled CI plans, Terraform Cloud, driftctl), remediation and alerting workflows, why immutable infrastructure reduces drift, distinguishing drift from a pending config change in a plan, preventing drift with least-privilege and policy, and the classic "someone deleted a resource in the console — what does Terraform do?" scenario. The 16 questions span from "what is drift" to "design a drift-detection strategy for a 50-service org and walk me through reconciling a live security-group change safely."

**Mental model**

Terraform tracks **three** things, and drift is a mismatch between two of them: your **config** (desired state, the `.tf` files), the **state** (what Terraform last recorded about real resources), and **reality** (what's actually deployed). A normal `plan` does two comparisons: first it **refreshes** — reads reality via provider APIs and updates its in-memory view of state — then it diffs that refreshed state against your config to compute changes. **Drift** is when *reality* has moved away from *state* (someone changed the SG in the console). A **pending change** is when *config* has moved away from state (you edited the `.tf`). Both show up in the same plan, which is why reading a plan carefully matters. The core reconciliation question is always: *which is right — the code or the world?* If code is the source of truth, apply and let Terraform revert reality. If the world's change is legitimate, update code (or accept it into state, or `ignore_changes` it). Terraform is a **convergence engine**: every apply drives reality toward config.

**Key terms**

- **Drift** — real infrastructure differs from Terraform state/config due to out-of-band change.
- **Refresh** — the step that reads real resource state via provider APIs (runs by default at the start of `plan`/`apply`).
- **ClickOps** — making changes by hand in a cloud console; the #1 drift source.
- **`-refresh-only`** — a plan/apply mode that reconciles **state** to reality **without** changing config or infra.
- **`-refresh=false`** — skip the refresh; plan against stored state only (faster, but blind to drift).
- **`ignore_changes`** — `lifecycle` meta-arg telling Terraform to tolerate drift on named attributes.
- **`-detailed-exitcode`** — makes `plan` return 0 (no changes) / 1 (error) / 2 (changes) for CI drift detection.
- **Reconciliation** — resolving drift: revert it, adopt it into config, or import unmanaged resources.
- **Immutable infrastructure** — replace rather than mutate; shrinks the surface for drift.
- **Continuous drift detection** — scheduled `plan`s (CI / Terraform Cloud / driftctl) that alert on drift.
- **Out-of-band change** — any change made outside Terraform.
- **`import`** — bring an existing unmanaged resource under Terraform management.

**Why interviewers ask this**

Drift is where Terraform meets messy reality, and it's a strong senior signal. Juniors treat `plan` as magic and don't know refresh exists; seniors can explain the three-way state/config/reality model, read a plan to tell drift from a config change, and — critically — **reconcile safely** without a destructive apply. The set-piece question is "someone changed a resource in the console — walk me through fixing it." A weak answer blindly runs `apply`. A strong answer investigates first (`-refresh-only` to see the drift), decides whether code or reality is authoritative, and only then acts — possibly updating config, possibly `ignore_changes`, possibly importing. Interviewers also probe `ignore_changes` (do you know it can *hide* real problems?) and org-scale drift detection (scheduled plans, alerting), which reveal whether you've run Terraform in anger.

**Common confusions**

- "`plan` only shows my config changes" — no; refresh means it *also* surfaces drift from out-of-band changes, even with zero config edits.
- "`-refresh-only` changes my infrastructure" — it doesn't; it only reconciles **state** to match reality. No resources are created/updated/destroyed.
- "`ignore_changes` fixes drift" — it *tolerates* drift by telling Terraform to stop caring about that attribute; it can mask real problems.
- "`-refresh=false` is a safe speed-up" — it makes plan blind to drift; you can apply against a stale picture and get surprised.
- "Drift and a pending config change are different plan sections" — they appear in the same plan output; you distinguish them by reasoning about *what* changed and *where*.
- "Terraform auto-reverts drift continuously" — no; it only converges when you run `apply`. Between applies, reality can wander freely.

**What follows from this topic**

Drift ties together state (the record drift is measured against), providers (the APIs refresh calls), and `import`/`moved` (adopting and re-addressing real resources). `ignore_changes` sits alongside the other `lifecycle` meta-args (`create_before_destroy`, `prevent_destroy`). The prevention story — least-privilege so humans *can't* ClickOps, policy-as-code, break-glass procedures — connects to any security/governance topic in the primer. And the immutable-infrastructure thread connects to how you design resources in the first place: the less you mutate in place, the less drift you have to reconcile. Master this and the "walk me through a real incident" questions become straightforward.

### Q1. What is configuration drift?

**Drift** is when the real, deployed infrastructure diverges from what Terraform's state and configuration say it should be — because something changed it **outside** Terraform.

Concrete examples:

- An engineer opens the AWS console and adds an inbound rule to a security group to "quickly debug something."
- An autoscaler changes a group's desired capacity from 3 to 7 under load.
- Another tool (a config-management agent, a Kubernetes operator, a compliance bot) mutates a tag or setting.

None of these went through `terraform apply`, so Terraform's state still reflects the old world. The gap between "what Terraform thinks" and "what's actually there" is drift. It's inevitable in any environment where humans and other automation can touch the same resources.

### Q2. Why does drift happen?

Sources, roughly in order of frequency:

- **ClickOps** — humans making changes by hand in the console, usually "just this once" during an incident. The dominant cause.
- **Other automation** — autoscalers, Kubernetes controllers, Lambda functions, CI scripts, or backup tools mutating resources Terraform also manages.
- **Provider/cloud defaults** — the cloud fills in a value Terraform didn't set (a default SG rule, an auto-generated name, a computed field).
- **Emergency/break-glass changes** — someone bypassed Terraform to fix a production outage fast.
- **Multiple tools owning overlapping resources** — two systems that both think they manage the same tag.

The through-line: any path to mutate infrastructure that **isn't** `terraform apply` is a drift source. Which is why prevention leans heavily on least-privilege.

### Q3. How does Terraform actually detect drift?

Through the **refresh** step. At the start of `terraform plan` (and `apply`), Terraform **refreshes**: for every resource in state, it calls the provider's read API to fetch the resource's *current* real-world attributes, and updates its in-memory copy of state to match reality.

It then diffs that refreshed picture against your **config**. So even if you changed **nothing** in your `.tf` files, drift surfaces in the plan as proposed changes:

```bash
terraform plan
# Note: Objects have changed outside of Terraform
#   ~ resource "aws_security_group" "web" {
#       ~ ingress = [ ... an extra rule someone added in the console ... ]
#     }
# Plan: 0 to add, 1 to change, 0 to destroy.
```

That "Objects have changed outside of Terraform" banner is Terraform telling you it detected drift during refresh. The proposed change is Terraform offering to **revert** reality back to what your config says.

### Q4. What does `terraform plan -refresh-only` do, and when do you use it?

`-refresh-only` runs **only** the refresh + compare, and proposes updating **state** to match reality — it will **not** propose changing your infrastructure or your config.

```bash
terraform plan -refresh-only    # show me the drift, don't offer to revert it
terraform apply -refresh-only   # accept reality into state
```

Use it to **inspect drift safely**: a normal `plan` mixes drift with config changes and frames drift as "I'll revert this," which is scary. `-refresh-only` isolates the question "what has changed in the real world?" and lets you **accept** those changes into state without reverting them — useful when reality is legitimately correct and you want state to reflect it (then you'd update config to match too). It's the safe first move when investigating "what did someone change?"

### Q5. What does `-refresh=false` do, and what's the risk?

`-refresh=false` **skips** the refresh step — Terraform plans using the stored state as-is, without reading reality from provider APIs.

```bash
terraform plan -refresh=false
```

Why anyone uses it: **speed** (refresh on thousands of resources is slow and hammers provider APIs) and **stability** (in CI you sometimes want a deterministic plan that only reflects code changes).

The risk: you're now **blind to drift**. If reality has diverged, `-refresh=false` won't show it, and you can `apply` against a stale mental model — potentially clobbering or being surprised by out-of-band changes. It's a legitimate optimization for known-clean environments or targeted plans, but never a blanket default, because the whole point of refresh is to keep you honest about the real world. In current Terraform, `-refresh-only` mode is the safer way to reason about drift separately.

### Q6. Someone changed a security group in the console. Walk me through reconciling it safely.

I'd **investigate before I act** — never just `apply`.

1. **See the drift without reverting anything:**
   ```bash
   terraform plan -refresh-only
   ```
   This shows exactly what changed in the console versus state.

2. **Decide who's authoritative — code or reality?**
   - *The console change was a mistake / unauthorized* → **code is source of truth**. Run a normal `terraform apply` to let Terraform **revert** the SG back to config. Then figure out how someone made that change and close the hole.
   - *The console change was legitimate* (a needed new rule) → **update the config** to include that rule, so code now matches reality; `apply` becomes a no-op (or use `apply -refresh-only` to sync state, then codify the change).
   - *The attribute legitimately changes out-of-band all the time* → add `lifecycle { ignore_changes = [...] }` so Terraform stops fighting it.

3. **Apply and verify** the plan is clean afterward.

The senior signal is step 2: the safe move is deciding intent *first*, because a reflexive `apply` might revert a change that was keeping production alive.

### Q7. How do you reconcile drift once you've found it?

Three options, chosen by *who's right*:

| Reality is… | Action |
|---|---|
| **Wrong** (unauthorized/mistaken change) | `terraform apply` — Terraform reverts reality to match config |
| **Right** (legitimate change) | Update the `.tf` config to match reality; apply is then a no-op |
| **Right but volatile** (changes constantly out-of-band) | `lifecycle { ignore_changes = [...] }` to tolerate it |
| **An unmanaged resource** someone created | `terraform import` (or an `import` block) to bring it under management |

The decision is always the same question: **is the code or the world the source of truth here?** Reverting is the default when Terraform should own the resource; codifying is right when the out-of-band change is legitimate and should persist; ignoring is for attributes another system owns; importing is for resources Terraform doesn't yet know about.

### Q8. Explain `lifecycle { ignore_changes = [...] }` and give a real use case.

`ignore_changes` tells Terraform to **stop diffing** specific attributes — after initial creation, drift on those attributes is tolerated, not reverted:

```hcl
resource "aws_autoscaling_group" "app" {
  desired_capacity = 3
  # ...
  lifecycle {
    ignore_changes = [desired_capacity]   # autoscaler owns this at runtime
  }
}
```

Real use cases:

- **`desired_capacity`** on an ASG — an autoscaler legitimately changes it; you don't want `apply` snapping it back to 3.
- **Tags added by another tool** — a compliance bot injects tags; ignore them so Terraform doesn't strip them.
- **`ignore_changes = all`** — tolerate *any* drift on a resource (rare; usually for resources bootstrapped by Terraform but then owned elsewhere).

The mechanism: Terraform still tracks the resource, but treats the listed attributes as "not mine to reconcile." It's how you cooperate with other systems that share ownership of a resource.

### Q9. What's the danger of `ignore_changes`?

It can **mask real problems**. By telling Terraform to stop looking at an attribute, you lose drift detection on it — so if something (or someone) makes an *unwanted* change to that attribute, Terraform stays silent. You've traded convergence for tolerance.

Concrete risks:

- **`ignore_changes = all`** turns off drift detection for the whole resource — a security setting could be weakened out-of-band and you'd never see it in a plan.
- It **hides drift you'd actually want to know about**, because `ignore_changes` can't distinguish "legitimate autoscaler change" from "attacker opened a port."
- It becomes a **crutch**: instead of fixing why drift happens, teams paper over it with ever-more `ignore_changes`, and the config stops reflecting reality.

Use it surgically, on specific attributes genuinely owned by another system, and document *why*. It's a scalpel, not a mute button.

### Q10. How do you do continuous / automated drift detection?

Run `plan` on a **schedule** and alert when it's non-empty. The key is `-detailed-exitcode`:

```bash
terraform plan -detailed-exitcode
# exit 0 = no changes (no drift)
# exit 1 = error
# exit 2 = changes present (drift or pending config)
```

A scheduled CI job (cron, GitHub Actions, etc.) runs `plan -detailed-exitcode` against each state; exit code 2 triggers an **alert** ("drift detected in prod-network") to Slack/PagerDuty.

Options:

- **CI-based**: cheap, DIY, you own the alerting.
- **Terraform Cloud/Enterprise**: has **built-in drift detection** that periodically refreshes and notifies.
- **driftctl** (and similar): scan a cloud account for both drift *and* unmanaged resources Terraform doesn't know about.

The goal is to catch drift **early**, before it compounds or before your next real apply collides with it — not to discover it during an incident.

### Q11. How do you distinguish drift from a pending config change in a plan?

They live in the **same plan output**, so you reason about *what moved*:

- **Drift** = **reality** moved away from state. Terraform flags it with the "Objects have changed outside of Terraform" note, and the proposed change would **revert** reality to your (unchanged) config. You didn't touch the `.tf`.
- **Pending config change** = **config** moved away from state. It's the change *you* made in the `.tf` files, and the plan proposes to push it out to reality.

Practical tells: run `terraform plan -refresh-only` — anything it shows is pure **drift** (state vs reality), since it ignores config changes. Conversely, run with `-refresh=false` and anything left is pure **config** change (config vs state). Diffing those two isolates the two sources. In day-to-day reading, if you didn't edit the code and Terraform wants to change something, that's drift.

### Q12. Why does immutable infrastructure reduce drift?

Because you **replace instead of mutate**. In an immutable model, you don't SSH into a server and change it — you build a new image/instance and swap it in; the old one is destroyed. There's no long-lived, hand-editable resource sitting around inviting ClickOps.

Effects on drift:

- **Fewer mutable surfaces** — a resource that's recreated on every change can't slowly accumulate out-of-band edits.
- **Config is authoritative by construction** — the artifact *is* the source of truth; there's no "someone tweaked the running box" state to diverge.
- **Shorter lifetimes** — ephemeral resources get replaced before drift has time to matter.

Mutable infra (long-lived VMs, hand-tuned security groups) is where drift breeds. Immutable patterns (baked images, blue/green, replace-on-change via `create_before_destroy`) shrink the window and the surface for reality to wander from config.

### Q13. How do you prevent drift in the first place?

Make out-of-band changes **hard or impossible**:

- **Least-privilege IAM** — humans don't get write access to prod resources; only the Terraform CI role does. If people *can't* ClickOps, they won't.
- **Break-glass procedures** — emergency access is possible but audited, time-boxed, and triggers a follow-up to reconcile config.
- **Policy-as-code** (OPA/Sentinel) and SCPs — block or flag changes that don't come through the pipeline.
- **Force all changes through the pipeline** — Terraform runs in CI, plans are reviewed, applies are gated. No local applies to prod.
- **Continuous drift detection** — so when drift *does* slip through, you catch it fast (see Q10).
- **Immutable infrastructure** — fewer mutable resources to drift (Q12).

Prevention is mostly an **access-control** problem: drift is a symptom of "too many ways to change infra." Narrow those paths to one — the pipeline — and drift largely disappears.

### Q14. What's the difference between state-vs-reality and config-vs-state?

Two distinct comparisons Terraform makes:

- **State-vs-reality** — does Terraform's recorded state match the actual deployed resource? This is what **refresh** checks, and a mismatch is **drift** (someone changed reality out-of-band). Reconciled by refreshing state or reverting reality.
- **Config-vs-state** — does your `.tf` desired state match what Terraform last recorded? A mismatch is a **pending change** you authored. Reconciled by `apply` (push config to reality) or by editing config.

A normal `plan` does **both**: refresh (state→reality) then diff (config→state), and the plan you see is the combination. Understanding they're separate is what lets you use `-refresh-only` (isolate state-vs-reality) and `-refresh=false` (isolate config-vs-state) to diagnose *which* kind of change you're looking at. Drift is always the state-vs-reality axis; your edits are always the config-vs-state axis.

### Q15. A resource was deleted out-of-band. What does Terraform do?

During **refresh**, Terraform calls the provider's read API for that resource, gets back "not found," and marks it as **gone** in its in-memory state. On the next `plan`, since your config still declares the resource but reality (and now refreshed state) shows it missing, Terraform proposes to **recreate** it:

```bash
terraform plan
#   # aws_instance.app has been deleted
#   + resource "aws_instance" "app" {   # will be re-created
#     ...
#     }
# Plan: 1 to add, 0 to change, 0 to destroy.
```

So the default reconciliation is **recreate** — Terraform converges reality back to config by rebuilding what was deleted. If that deletion was **intentional** (you meant to remove it), the correct move is to delete it from your **config** too (and `terraform state rm` if needed), so Terraform stops trying to recreate it. As always: decide whether the deletion was legitimate, then either let Terraform rebuild it or update code to match the new intent.

### Q16. Design a drift-detection and remediation strategy for a 50-service org.

I'd build it in layers:

**Prevent** (shrink the drift surface):
- Least-privilege: humans have **read-only** prod access; only the Terraform CI role writes. Break-glass is audited and time-boxed.
- All changes flow through PR → `plan` review → gated `apply`. No local prod applies.
- Policy-as-code (Sentinel/OPA) blocks non-pipeline changes where possible.

**Detect** (continuous, per-state):
- Each service owns its own state (isolated blast radius). A **scheduled** job runs `terraform plan -detailed-exitcode` per state, say nightly.
- Exit code 2 → structured alert to the owning team's channel, tagged with which resource drifted.
- Consider Terraform Cloud's built-in drift detection or driftctl to also catch **unmanaged** resources.

**Remediate** (clear workflow):
- Triage: is reality wrong (revert via `apply`), legitimate (codify + PR), or volatile (`ignore_changes`)? Route drift to the owning team with that decision tree.
- Track drift as a metric (drift events per service per week) to find teams/resources that need attention or better IAM.

**Reduce** (structural):
- Prefer immutable patterns so there's less to drift.
- Reserve `ignore_changes` for attributes genuinely owned by other systems, documented per use.

The theme: **isolate** (per-service state), **automate detection** (scheduled plans + alerting), and give teams a **decision framework**, not just a red alert.
## Workspaces & Environment Management

### Summary

**What this topic covers**

How you stand up the *same* infrastructure across multiple environments — dev, stage, prod — without copy-pasting and hand-editing configs. This is one of the first architecture decisions a Terraform codebase forces on you, and one of the most consequential, because it determines your blast radius when something goes wrong. The two canonical answers are **CLI workspaces** (multiple named states from a single config and backend) and **directory-per-environment** (a separate root config, backend, and state per env). This topic covers both, their tradeoffs, how to keep the code DRY with shared modules and thin per-env roots, tfvars-per-environment, partial backend config, the "which workspace am I in" footgun and how to guard prod, when workspaces are genuinely the right tool (ephemeral/PR/feature environments) versus when they're a trap (long-lived prod), **Terragrunt** as a DRY wrapper, and how to promote a change safely across environments. The 15 questions move from "what is a workspace" to "design the environment layout for a multi-team org."

**Mental model**

Think of "environment" as a fault-isolation boundary, not just a name. The core question is: *when I run `apply`, how much can I break, and does prod share fate with dev?* CLI workspaces answer "let one config produce N states" — cheap, DRY, but every workspace shares the same backend, the same credentials-in-practice, and the same code path, so isolation is soft and it's terrifyingly easy to apply to the wrong one. Directory-per-environment answers "give each env its own root, backend, and state" — more files, more duplication, but prod lives in its own bucket with its own credentials and can't be touched by an errant `workspace select`. The senior instinct is: **DRY the reusable parts (modules), duplicate the risky parts (root configs and backends).** Environments should differ only in variables (sizes, counts, CIDRs, feature flags), never in structure. Everything else — the "which env am I even in" problem, drift between envs, promotion — flows from getting that boundary right.

**Key terms**

- **CLI workspace** — a named, separate state file within one backend/config; switch with `terraform workspace select`. Not the same as Terraform Cloud "workspaces."
- **`terraform.workspace`** — interpolation giving the current workspace name; used to vary names/sizing.
- **Default workspace** — every backend starts with a workspace literally named `default`; it can't be deleted.
- **Directory-per-environment** — `environments/{dev,stage,prod}/`, each a root module with its own backend + tfvars.
- **Root module vs child module** — the thing you `apply` (root) vs the reusable unit it calls (child).
- **tfvars per env** — `dev.tfvars`, `prod.tfvars` supplying environment-specific inputs to the same code.
- **Partial backend config** — omit backend values in HCL, pass them at `init` via `-backend-config` so each env points at its own state.
- **Environment drift** — envs diverging in config/version over time so prod no longer matches what you tested in stage.
- **Terragrunt** — a thin wrapper (Gruntwork) that keeps backend/provider boilerplate DRY and wires dependencies between stacks.
- **Ephemeral environment** — a short-lived env (per-PR, per-feature) spun up and torn down automatically — the ideal workspace use case.
- **Promotion** — advancing the *same* module version through dev → stage → prod.

**Why interviewers ask this**

Environment strategy is where platform engineers reveal whether they've actually operated production. A junior reaches for `terraform workspace` because it's the first feature in the docs and "keeps everything in one place." A senior has been burned by applying dev changes to prod because the workspace was wrong, and now defaults to directory-per-environment with separate backends and credentials for anything long-lived, reserving workspaces for ephemeral/PR environments. The interviewer is probing for *blast-radius thinking*: do you understand that sharing a backend means sharing fate? Can you keep code DRY without coupling environments? Do you know why HashiCorp themselves caution that workspaces are not a substitute for strong isolation? Getting this right signals you've designed for the 3am incident, not just the happy path.

**Common confusions**

- "CLI workspaces isolate environments" — they don't isolate the backend or credentials; they only partition state within one backend. Weak isolation.
- "Terraform Cloud workspaces == CLI workspaces" — different concept. TFC/HCP workspaces are closer to a directory-per-env root each; CLI workspaces are named states in one backend.
- "Directory-per-env means duplicating all your code" — no; you duplicate thin *root* configs; the actual resources live in shared modules called by each root.
- "`terraform.workspace` is a good way to pick prod credentials" — using an interpolation on workspace name to switch prod on/off is exactly the footgun that causes cross-env accidents.
- "Workspaces are useless" — they're excellent for ephemeral per-PR/feature environments; the mistake is using them for long-lived prod.

**What follows from this topic**

Environment layout is really a **state layout** decision, so this leans directly on the state and backend topics (one backend per env, locking, partial backend config). The DRY-via-modules answer depends on the modules topic (versioned, reusable child modules). Promotion across environments depends on pinning module/provider versions (the versioning topic). And "tolerate drift in one env but not another" connects to the lifecycle topic (`ignore_changes`) and the drift/reconciliation topic. Get environments right and the rest of your Terraform practice has a stable frame to hang on.

### Q1. What problem does environment management solve in Terraform, and what are the two main approaches?

The problem: you need dev, stage, and prod that are structurally identical but differ in sizing, counts, CIDRs, and credentials — *without* copy-pasting `.tf` files and hand-editing them (which guarantees drift and mistakes).

Two canonical approaches:

| | CLI workspaces | Directory-per-environment |
|---|---|---|
| State | N named states, **one backend** | One state **per env**, separate backends |
| Isolation | Weak (shared backend/creds) | Strong (separate bucket/creds) |
| Duplication | Minimal (one config) | Some (thin root per env) |
| Wrong-env risk | High (easy mis-select) | Low (you `cd` into the env) |
| Best for | Ephemeral / PR / feature envs | Long-lived dev/stage/prod |

The senior default for long-lived production is **directory-per-environment**; workspaces shine for short-lived, low-risk, throwaway environments.

### Q2. How do CLI workspaces actually work?

A workspace is a **separate named state file inside the same backend and config**. You start in a workspace called `default`.

```bash
terraform workspace new dev       # create + switch to "dev"
terraform workspace new prod
terraform workspace list          # * marks the current one
terraform workspace select dev    # switch
terraform workspace show          # print current name
```

Each workspace stores its own state (e.g. in S3 the key becomes `env:/dev/<key>`). The **config and provider setup are shared** — only the state differs. You vary behaviour by interpolating the workspace name:

```hcl
resource "aws_instance" "app" {
  instance_type = terraform.workspace == "prod" ? "m5.large" : "t3.micro"
  tags = { Environment = terraform.workspace }
}
```

The whole appeal is DRY: one config, many states. The whole danger is that "many states, one config, one backend" means weak isolation.

### Q3. What are the real limitations of CLI workspaces?

Five that bite in production:

1. **Shared backend** — all workspaces live in one bucket/state store. A backend-level problem (or a bad policy on that bucket) affects every env at once.
2. **Shared provider config** — same provider block/credentials in practice. You can't cleanly give prod a different AWS account without `terraform.workspace`-based hacks.
3. **Same variables/code path** — every workspace runs the identical config; environment-specific structure is awkward and usually done via brittle conditionals on `terraform.workspace`.
4. **Easy to apply to the wrong workspace** — nothing about your working directory tells you which env you're in. `select prod` then forget, and your next `apply` hits prod.
5. **Not strong prod isolation** — HashiCorp's own docs say workspaces are *not* a substitute for separate configurations/backends when you need real isolation between environments.

That's why workspaces are recommended for ephemeral/feature environments, not long-lived prod.

### Q4. Describe the directory-per-environment layout and why it's the more common production pattern.

Each environment is its own **root module** with its own backend, state, and tfvars:

```text
environments/
  dev/
    main.tf        # calls shared modules
    backend.tf     # dev state bucket
    dev.tfvars
  stage/
    main.tf
    backend.tf     # stage state bucket
    stage.tfvars
  prod/
    main.tf
    backend.tf     # prod state bucket (separate account)
    prod.tfvars
modules/
  network/
  service/
```

Each `main.tf` is thin — it just wires shared modules with env-specific inputs:

```hcl
module "network" {
  source     = "../../modules/network"
  cidr_block = var.cidr_block
  environment = "prod"
}
```

Why it's preferred for long-lived envs: **hard isolation**. Prod has its own state store and (usually) its own cloud credentials, so you literally cannot `apply` dev changes to prod by fat-fingering a workspace — you'd have to be standing in the `prod/` directory with prod credentials. The cost is some duplication in the root configs, which the next question addresses.

### Q5. Directory-per-environment duplicates code. How do you keep it DRY?

You don't duplicate the *resources* — you duplicate only the thin root configs and push all real logic into **shared, versioned modules**:

- **Modules hold the structure** — the network module, the service module, etc., are written once.
- **Root configs are wiring** — each env's `main.tf` calls the same modules and differs only in inputs.
- **tfvars hold the differences** — `dev.tfvars` vs `prod.tfvars` carry the sizes, counts, CIDRs, flags.
- **Pin module versions** — reference modules by version (`?ref=v1.4.0`) so you can promote deliberately.

```hcl
# environments/prod/main.tf
module "service" {
  source  = "git::https://example.com/infra//modules/service?ref=v1.4.0"
  replicas = var.replicas   # 6 in prod.tfvars, 1 in dev.tfvars
}
```

The rule of thumb: **DRY the reusable, duplicate the risky.** Modules are reusable and safe to share; root configs and backends are the isolation boundary and are *supposed* to be separate.

### Q6. How do you supply per-environment variables?

Use a `.tfvars` file per environment and pass it explicitly at plan/apply:

```bash
terraform plan  -var-file=dev.tfvars
terraform apply -var-file=prod.tfvars
```

```hcl
# variables.tf (shared)
variable "instance_type" { type = string }
variable "replicas"      { type = number }

# dev.tfvars
instance_type = "t3.micro"
replicas      = 1

# prod.tfvars
instance_type = "m5.large"
replicas      = 6
```

Keep the **structure identical across envs** — same variables, only the values differ. Auto-loaded `terraform.tfvars` and `*.auto.tfvars` are convenient but make it ambiguous which env you're in; explicit `-var-file` is safer for multi-env because the command records the intent. Never bake environment differences into resource *structure* if a variable can express them.

### Q7. What is partial backend configuration and why is it useful for environments?

You leave backend values out of the HCL and supply them at `init` time, so one config can point each environment at its own state:

```hcl
# backend.tf — no bucket/key hard-coded
terraform {
  backend "s3" {}
}
```

```bash
terraform init -backend-config=dev.backend.hcl
```

```hcl
# dev.backend.hcl
bucket = "acme-tfstate-dev"
key    = "network/terraform.tfstate"
region = "us-east-1"
```

This lets you keep a single module/config while giving each environment a **distinct state bucket/path** — combining some of the DRY-ness of one config with the isolation of separate backends. It's also how CI pipelines target the right backend per env. The catch: you must re-`init` when switching backends, and it's on you (or your pipeline) to pass the correct file.

### Q8. Walk me through the "which workspace am I in" footgun and how to guard prod.

The footgun: nothing in your shell prompt or working directory tells you the active workspace. You `terraform workspace select prod` for a legit reason, get distracted, come back, run `apply` for a dev change — and it lands in **prod**.

Guards, in order of strength:

1. **Prefer directory-per-env for prod** — the strongest guard is not sharing a config at all; you have to `cd prod/` with prod creds.
2. **Show the workspace in your prompt** — add `terraform workspace show` to your shell prompt / PS1 or use a wrapper.
3. **Guard in code** — refuse dangerous ops in the wrong workspace:

```hcl
resource "aws_db_instance" "main" {
  lifecycle { prevent_destroy = true }   # prod DB can't be destroyed
}
```

4. **Pipeline-only prod applies** — humans never run `apply` against prod locally; CI does, with an approval gate and pinned workspace/backend.
5. **Separate credentials** — if dev creds physically can't reach prod, a mis-select fails safely.

The real lesson: don't rely on a human remembering the current workspace for prod safety.

### Q9. When are CLI workspaces the right tool?

When environments are **ephemeral, low-risk, and structurally identical to a template**:

- **Per-PR / preview environments** — spin up `pr-1234`, run tests, tear it down. Perfect: short-lived, isolated by name, cheap to create/destroy.
- **Per-feature / per-developer sandboxes** — each engineer gets their own state without a new directory.
- **Ephemeral test stacks in CI** — create, assert, destroy.

The common thread: the environment is disposable, nobody's paycheck depends on it, and you want zero config duplication for something that lives for minutes to days. In these cases the workspace's weak isolation is fine — there's nothing precious to protect, and `terraform.workspace` naming keeps resources from colliding.

```hcl
resource "aws_s3_bucket" "app" {
  bucket = "acme-app-${terraform.workspace}"   # unique per PR env
}
```

### Q10. Why are workspaces a poor fit for long-lived production?

Because long-lived prod needs the three things workspaces don't give you:

- **Strong isolation** — prod should have its own state store and ideally its own cloud account/credentials. Workspaces share a backend and provider config.
- **Independent lifecycle** — you want to upgrade a provider or module in stage and *not* risk prod. With one shared config, a change to the config affects all workspaces the next time each is applied.
- **Human-error resistance** — prod must not be one `workspace select` away from a dev workflow.

HashiCorp explicitly notes workspaces aren't a substitute for separate configurations when environments need meaningful isolation. For anything you'd page someone about, use directory-per-environment (or separate TFC/HCP workspaces, which are effectively separate roots). Save CLI workspaces for the disposable stuff.

### Q11. What is Terragrunt and what problem does it solve?

Terragrunt is a thin **wrapper around Terraform** (from Gruntwork) that keeps the *boilerplate* DRY in a directory-per-environment layout — the backend and provider config you'd otherwise repeat in every env directory.

Key features:

- **`remote_state` block** — declare your backend once in a root `terragrunt.hcl`; Terragrunt generates the correct `backend` block per directory (auto-deriving distinct keys per env), so you don't hand-write `backend.tf` everywhere.
- **`generate` block** — code-gen provider blocks and other repetitive files into each unit at runtime.
- **`run-all`** — run `plan`/`apply` across many stacks at once (e.g. all of prod).
- **`dependency` blocks** — wire outputs from one stack (e.g. network) into another (e.g. app), with ordering.

```hcl
# terragrunt.hcl (root)
remote_state {
  backend = "s3"
  config = {
    bucket = "acme-tfstate-${local.env}"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = "us-east-1"
  }
}
```

The pitch: get directory-per-env isolation *without* copy-pasting backend/provider boilerplate into every directory. The cost: another tool and DSL to learn; some teams prefer native Terraform + a bit of CI glue instead.

### Q12. How do you promote a change across environments safely?

Promote the **same artifact** — a pinned module version — through the environments in order, applying and validating at each stage:

1. **Cut a module version** — tag the module `v1.5.0`.
2. **Bump dev** to `?ref=v1.5.0`, `plan`, `apply`, validate.
3. **Bump stage** to the *same* `v1.5.0`, `plan`, `apply`, run integration tests.
4. **Bump prod** to the same `v1.5.0` only after stage is green, with an approval gate.

```hcl
# environments/stage/main.tf — same version dev already validated
module "service" {
  source = "git::https://example.com/infra//modules/service?ref=v1.5.0"
}
```

The discipline: **prod runs a version that already succeeded in stage, which already succeeded in dev.** If each env floats on `main` or `latest`, you're testing directly in prod and promotion means nothing. Pinning versions is what makes "it worked in stage" a real guarantee. Always read the `plan` at each env before applying — same version can still surface env-specific diffs.

### Q13. How do you prevent and detect environment drift between dev/stage/prod?

"Drift" here means environments diverging in *configuration/version*, so prod no longer matches what you tested (distinct from infra-vs-state drift).

Prevent:

- **Identical structure, variable-only differences** — never fork the resource graph between envs; if prod needs something dev doesn't, express it as a variable/flag, not a different resource set.
- **Pin and promote the same module versions** — don't let one env drift to a newer module than another silently.
- **Same provider version constraints** across envs (shared `versions.tf` / lockfile discipline).

Detect:

- **Run `plan` on every env regularly** (e.g. nightly CI) — a non-empty plan in stage that dev didn't have flags divergence.
- **Diff the effective config** — compare tfvars and module versions across env directories in review.

The goal is that "it passed in stage" is trustworthy because stage is genuinely a smaller prod, not a differently-shaped stack.

### Q14. What naming conventions keep multi-environment infra sane?

Encode the environment into names and tags consistently so nothing collides and everything is attributable:

- **Prefix/suffix resource names with env** — `acme-app-prod`, `acme-app-dev` (via `var.environment` or `terraform.workspace`).
- **Tag everything** — a mandatory `Environment` tag (plus `Team`, `ManagedBy = "terraform"`) via provider `default_tags` so cost and ownership are queryable.
- **State keys mirror env + component** — `prod/network/terraform.tfstate`, so the backend layout is self-describing.
- **One convention, enforced** — put the env string in exactly one place (a variable or local) and derive everything from it; don't hardcode "prod" in twelve resources.

```hcl
provider "aws" {
  default_tags {
    tags = { Environment = var.environment, ManagedBy = "terraform" }
  }
}
```

Consistent naming is what makes a mis-targeted apply *obvious* ("why is this creating `-dev` resources in the prod account?") instead of silent.

### Q15. Design the environment layout for a mid-sized org with several teams and services.

I'd go **directory-per-environment with strong isolation, shared versioned modules, and workspaces reserved for ephemeral envs**:

- **Separate cloud accounts per environment** (or at minimum per prod vs non-prod) — the hardest isolation boundary; a dev mistake can't reach prod.
- **A backend/state per (environment × component)** — e.g. `prod/network`, `prod/team-a/service-x` — so blast radius is one component in one env, and teams can apply independently without a giant shared state.
- **Shared module registry** — reusable `network`, `service`, `database` modules, semver-tagged, owned by the platform team; product teams consume pinned versions.
- **Thin per-env, per-service root configs** — wiring + tfvars only.
- **CI-driven applies for stage/prod** with approval gates; no local prod applies; separate credentials injected per env.
- **Ephemeral per-PR environments via workspaces** off the non-prod account for fast feedback.
- **Terragrunt (optional)** if the backend/provider boilerplate across all those directories becomes painful.

The through-line: **small blast radius per apply, hard prod isolation, DRY logic in modules, deliberate promotion by version.** That structure scales to many teams without any one apply threatening the whole estate.

## Provisioners & Resource Lifecycle

### Summary

**What this topic covers**

Two related escape hatches from Terraform's pure declarative model: **provisioners** (running scripts as a side effect of resource creation/destruction) and the **`lifecycle` meta-argument** (overriding how Terraform creates, replaces, and destroys resources). Provisioners are the thing HashiCorp tells you to avoid; lifecycle rules are the thing that solves most of the problems people *reach* for provisioners to solve. This topic covers provisioners as a last resort, the three types (`local-exec`, `remote-exec`, `file`), the `connection` block, creation-time vs destroy-time provisioners, failure behaviour (`on_failure`, tainting), `null_resource`/`terraform_data` as something to hang provisioners and triggers on, and then the lifecycle block in depth: `create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`, and pre/postconditions. The 15 questions run from "what is a provisioner" to "here's a resource that keeps getting recreated — fix it with lifecycle."

**Mental model**

Terraform's whole value is that it's **declarative**: you describe desired state, it computes and executes the diff, and state records what exists. Provisioners break that model — they run **imperative scripts as a side effect**, aren't tracked in state, run **once at create time** (not on subsequent applies), and if they fail mid-run they can leave a resource that exists but is half-configured. So the mental model is: *provisioners are a last resort; reach for a cloud-native mechanism first* (`user_data`/cloud-init, a configuration-management tool, a Packer-baked image, or a proper provider). The `lifecycle` block is the opposite — it's still declarative, it just tunes the *algorithm* Terraform uses: create the replacement before destroying the old one (`create_before_destroy`), refuse to destroy this at all (`prevent_destroy`), stop diffing this attribute (`ignore_changes`), or force a replace when something upstream changes (`replace_triggered_by`). When a resource behaves badly — downtime on replace, accidental deletion, perpetual diffs — the fix is almost always a lifecycle rule, not a provisioner.

**Key terms**

- **Provisioner** — an imperative action (script/file copy) run as a side effect of create or destroy; a last resort.
- **`local-exec`** — runs a command on the machine running Terraform.
- **`remote-exec`** — runs commands on the *created* resource, over SSH/WinRM.
- **`file` provisioner** — copies a file/dir from the local machine to the created resource.
- **`connection` block** — how `remote-exec`/`file` reach the resource (host, user, ssh key / winrm).
- **Destroy-time provisioner** — `when = destroy`; runs during `terraform destroy`, before the resource is removed.
- **`on_failure`** — `fail` (default, taint + error) or `continue` (ignore the error).
- **Taint** — marking a resource for recreation on next apply; a create-time provisioner failure taints its resource.
- **`null_resource`** — a resource with no infra, used to hang provisioners/triggers on; superseded by `terraform_data`.
- **`terraform_data`** — the built-in replacement for `null_resource`, with `input`, `output`, and `triggers_replace`.
- **`lifecycle`** — meta-argument block: `create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`, `precondition`/`postcondition`.

**Why interviewers ask this**

This topic is a strong seniority discriminator. A junior sprinkles `remote-exec` provisioners to configure servers and is surprised when nothing re-runs on the next apply and a failed script wedges the state. A senior knows provisioners are HashiCorp's explicit last resort, reaches for `user_data`/cloud-init or an immutable Packer image instead, and treats the `lifecycle` block as the real toolbox — using `create_before_destroy` to replace resources with zero downtime, `prevent_destroy` to keep a prod database from being deleted, and `ignore_changes` to make peace with attributes something else manages. Interviewers want to see that you understand *why* provisioners undermine the declarative model, and that you can debug a resource that keeps getting recreated or can't be destroyed by reaching for the right lifecycle argument.

**Common confusions**

- "Provisioners re-run on every apply" — no; create-time provisioners run **once**, at create. Change the script and nothing happens until the resource is recreated.
- "`local-exec` runs on the new server" — no; `local-exec` runs on the machine running Terraform. `remote-exec` runs on the created resource.
- "`null_resource` is deprecated, use nothing" — use **`terraform_data`**, the built-in replacement; you rarely need the `null` provider anymore.
- "`prevent_destroy` stops all destroys" — it errors on plans that would destroy *that* resource, including a full `terraform destroy`; you must remove the flag to legitimately delete it.
- "`ignore_changes` fixes drift" — it makes Terraform *stop noticing* changes to those attributes; the drift still exists, you're just choosing to tolerate it.
- "`create_before_destroy` is free" — it requires the new resource to be creatable alongside the old (unique names, no conflicting singleton constraints).

**What follows from this topic**

`create_before_destroy` and `replace_triggered_by` change the shape of the **dependency graph**, so this feeds straight into the graph/dependencies topic (ordering, replacement propagation). `ignore_changes` is a core tool in the **drift/reconciliation** topic — the declarative way to tolerate out-of-band changes. `prevent_destroy` connects to the state and safety story (guarding stateful prod resources). And the "prefer `user_data`/immutable images over provisioners" guidance connects to broader immutable-infrastructure practice. In short: prefer declarative lifecycle controls; treat provisioners as the exception you justify.

### Q1. What is a provisioner and why does HashiCorp call it a last resort?

A **provisioner** runs an imperative action — a shell command, a file copy — as a *side effect* of a resource being created or destroyed. Example: SSH into a new VM and run a setup script.

HashiCorp's own docs call them a last resort because they break Terraform's core guarantees:

- **Not declarative** — they run scripts, not desired-state config; Terraform can't reason about what they did.
- **Not tracked in state** — Terraform records that the resource exists, but has no idea what the provisioner changed inside it.
- **Run once, at create** — they don't re-run on later applies. Edit the script and nothing happens until the resource is recreated.
- **Fragile failure mode** — a failure mid-script leaves a resource that exists but is half-configured, and taints it for recreation.

So they undermine the very predictability Terraform exists to provide. Prefer a cloud-native mechanism (next question), and use provisioners only when there's genuinely no alternative.

### Q2. What are the three types of provisioners?

| Type | Runs where | Typical use |
|---|---|---|
| `local-exec` | The machine running Terraform | Call a local script/API after a resource exists (e.g. register something, write an inventory file) |
| `remote-exec` | The **created** resource (via SSH/WinRM) | Run setup commands *on* a new VM |
| `file` | Copies local → created resource | Push a config file or script onto a new VM |

```hcl
resource "aws_instance" "app" {
  # ...
  provisioner "local-exec" {
    command = "echo ${self.private_ip} >> inventory.txt"
  }
  provisioner "remote-exec" {
    inline = ["sudo apt-get update", "sudo apt-get install -y nginx"]
  }
}
```

The key distinction interviewers probe: **`local-exec` runs locally**, on the Terraform host; **`remote-exec` and `file`** need a `connection` block because they reach *into* the created resource.

### Q3. When is a provisioner genuinely needed, and what are the better alternatives?

Genuinely needed: rare cases with no API/provider path — e.g. running a one-off bootstrap command a cloud-init can't express, or a `local-exec` to trigger an external system that has no Terraform provider. Even then, prefer:

- **`user_data` / cloud-init** — bake bootstrap into the instance's launch data; declarative, re-created cleanly, no SSH needed. This replaces the vast majority of `remote-exec` use.
- **A Packer-baked image** — build a golden AMI/image with everything installed; Terraform just launches it. Immutable, fast, no per-boot config.
- **Configuration management** (Ansible/Chef/Puppet) — run *outside* Terraform for ongoing config, so it's idempotent and re-runnable.
- **A custom provider** — if you keep `local-exec`-ing the same API, wrap it in a provider so it's declarative and stateful.

The rule: if the work can be expressed as data (`user_data`), baked into an image, or handled by a real provider, do that. Provisioners are what's left when none of those fit.

### Q4. What's the difference between creation-time and destroy-time provisioners?

By default a provisioner is **creation-time**: it runs after the resource is created, on the first apply that creates it.

A **destroy-time** provisioner runs during `terraform destroy`, *before* the resource is removed, using `when = destroy`:

```hcl
resource "aws_instance" "app" {
  provisioner "remote-exec" {
    when    = destroy
    inline  = ["/opt/app/graceful-shutdown.sh"]
  }
}
```

Use destroy-time provisioners for cleanup that must happen before teardown — deregister from a load balancer, drain connections, flush a cache. Caveats: a destroy-time provisioner can only reference `self` and a small set of values (not other resources or variables), and if it fails the destroy fails. Like all provisioners, it's a last resort — a proper deregistration resource or lifecycle hook is usually cleaner.

### Q5. What happens when a provisioner fails, and how do you control it?

By default a failed provisioner **fails the apply and taints the resource** — Terraform marks it for destruction and recreation on the next apply, because it can't trust a half-provisioned resource.

You control this with `on_failure`:

```hcl
provisioner "remote-exec" {
  inline     = ["/opt/bootstrap.sh"]
  on_failure = continue   # ignore the error, don't taint
}
```

- `fail` (default) — error out and taint the resource.
- `continue` — log the failure but proceed as if it succeeded.

Use `continue` cautiously — it means "I'm fine with this resource existing even if setup failed," which is rarely what you want for a bootstrap step. The tainting behaviour is actually helpful: it forces a clean recreate rather than leaving you with a subtly broken resource, but it also means a flaky provisioner can trigger surprise recreations.

### Q6. What is the `connection` block?

`connection` tells `remote-exec` and `file` provisioners **how to reach the target resource** — the transport, host, and credentials:

```hcl
resource "aws_instance" "app" {
  # ...
  connection {
    type        = "ssh"
    host        = self.public_ip
    user        = "ubuntu"
    private_key = file("~/.ssh/id_rsa")
  }

  provisioner "remote-exec" {
    inline = ["sudo systemctl restart nginx"]
  }
}
```

For Windows you'd use `type = "winrm"`. The connection can be declared at the resource level (shared by all its provisioners) or inside a single provisioner. Note the operational baggage this drags in: Terraform now needs network reachability to the instance, an open SSH/WinRM port, and a credential — which is a big part of why `user_data`/immutable images are preferred; they need none of that.

### Q7. What is `null_resource` and what has replaced it?

`null_resource` (from the `null` provider) is a resource that manages **nothing** — its only purpose is to be something you can **hang provisioners or `triggers` on**, or to force ordering with `depends_on`. It re-runs its provisioners when its `triggers` map changes.

```hcl
resource "null_resource" "reconfigure" {
  triggers = { config_hash = filemd5("app.conf") }
  provisioner "local-exec" { command = "./push-config.sh" }
}
```

Its **built-in replacement is `terraform_data`** — same idea, no external provider needed. Prefer `terraform_data` in new code; `null_resource` still works but requires the `null` provider and is effectively legacy.

### Q8. How does `terraform_data` improve on `null_resource`?

`terraform_data` is a **built-in** managed resource (no provider to install) that does what `null_resource` did, plus it can store data:

- **`triggers_replace`** — when this value changes, the resource is replaced (re-running any provisioners) — the cleaner successor to `null_resource`'s `triggers`.
- **`input`** — a value to store in state.
- **`output`** — echoes `input` back, so you can pass a value through state or use it to gate downstream resources.

```hcl
resource "terraform_data" "bootstrap" {
  triggers_replace = [aws_instance.app.id, filemd5("bootstrap.sh")]

  provisioner "local-exec" {
    command = "./bootstrap.sh ${aws_instance.app.public_ip}"
  }
}
```

Because it's built in, you drop the dependency on the `null` provider. Same use cases — a place to attach provisioners, a trigger mechanism, a way to force a re-run when a hash changes — with `triggers_replace` giving explicit control over what causes replacement.

### Q9. Walk through the `lifecycle` block and what each argument does.

`lifecycle` is a **meta-argument** available on any resource that tunes how Terraform creates, replaces, and destroys it — all still declarative:

```hcl
resource "aws_instance" "app" {
  # ...
  lifecycle {
    create_before_destroy = true
    prevent_destroy       = true
    ignore_changes        = [tags]
    replace_triggered_by  = [terraform_data.config]
  }
}
```

- **`create_before_destroy`** — create the replacement *before* destroying the old one (zero-downtime replaces).
- **`prevent_destroy`** — refuse any plan that would destroy this resource (guardrail).
- **`ignore_changes`** — stop diffing the listed attributes (tolerate out-of-band changes).
- **`replace_triggered_by`** — force a replace when a referenced resource/attribute changes.
- **`precondition` / `postcondition`** — custom validation checked during plan/apply.

Each answers a real operational problem that people otherwise try (badly) to solve with provisioners or manual steps. The next questions take them one at a time.

### Q10. Explain `create_before_destroy` and its implications.

By default, when Terraform must replace a resource, it **destroys the old one, then creates the new** — a window of downtime. `create_before_destroy = true` flips the order: **create the new resource first, then destroy the old.**

```hcl
resource "aws_launch_template" "app" {
  # ...
  lifecycle { create_before_destroy = true }
}
```

Implications you must handle:

- **Naming conflicts** — the old and new resource exist simultaneously, so any uniquely-named attribute (a fixed `name`, a singleton) will collide. Use `name_prefix` or let Terraform generate names.
- **Graph reordering** — it inverts the create/destroy ordering, and it **propagates to dependencies**: things that depend on this resource may also need `create_before_destroy` to avoid the graph forcing an old-first destroy.
- **Capacity** — you momentarily run double the resource; fine for most, relevant for quota-limited ones.

It's the standard pattern for zero-downtime replacement of immutable resources (launch templates, instances behind an ASG, etc.).

### Q11. What does `prevent_destroy` do, and when do you use it?

`prevent_destroy = true` makes Terraform **error on any plan that would destroy that resource** — including an accidental config change that forces replacement, or a full `terraform destroy`.

```hcl
resource "aws_db_instance" "prod" {
  # ...
  lifecycle { prevent_destroy = true }
}
```

Use it as a guardrail on **critical, stateful resources** — production databases, the state bucket, a KMS key — where an accidental destroy is catastrophic and unrecoverable.

Two important caveats:

- It's a *plan-time* guard, not IAM — someone can remove the flag and re-run, or delete the resource out-of-band. It stops accidents, not determined actors.
- It will also block a **legitimate** destroy: to actually delete the resource you must first remove `prevent_destroy` (and note it can even block `terraform destroy` of the whole config until you do). That friction is the point.

### Q12. Explain `ignore_changes` with an example.

`ignore_changes` tells Terraform to **stop diffing specific attributes** — after initial creation, changes to those attributes (by you or by something else) won't show up in the plan and won't be reverted.

```hcl
resource "aws_autoscaling_group" "app" {
  desired_capacity = 2
  lifecycle {
    ignore_changes = [desired_capacity]   # autoscaler owns this at runtime
  }
}
```

Classic use: an attribute that **another system legitimately manages** — an autoscaler setting `desired_capacity`, a deploy tool changing the image tag, a platform adding tags. Without `ignore_changes`, every plan would try to reset the value and fight the other system.

You can ignore specific attributes, or `ignore_changes = all` to freeze everything post-create (rare, blunt). Crucial nuance: this doesn't *fix* drift — the resource really has diverged from your config; you're **choosing to tolerate** that divergence for those attributes. Use it deliberately, not to silence diffs you don't understand.

### Q13. What is `replace_triggered_by`?

`replace_triggered_by` forces Terraform to **replace** a resource when a referenced resource or attribute changes — even if the resource's *own* configuration didn't change.

```hcl
resource "aws_instance" "app" {
  # ...
  lifecycle {
    replace_triggered_by = [terraform_data.app_version]
  }
}

resource "terraform_data" "app_version" {
  input = var.app_version
}
```

Here, bumping `app_version` changes the `terraform_data`, which triggers a **replacement** of the instance — a clean way to force new instances on a new app version without a provisioner or manual taint. You can reference whole resources (replace when they're replaced) or specific attributes (replace when that attribute changes). It's the declarative successor to `terraform taint` for "recreate this when that upstream thing moves," and it shapes the dependency graph (it creates a replacement edge).

### Q14. What are preconditions and postconditions?

They're **custom validation** you attach to a resource or data source via `lifecycle`, checked during plan/apply — a way to assert invariants and fail early with a clear message instead of hitting a confusing downstream error.

```hcl
resource "aws_instance" "app" {
  instance_type = var.instance_type
  ami           = data.aws_ami.selected.id

  lifecycle {
    precondition {
      condition     = data.aws_ami.selected.architecture == "arm64"
      error_message = "Selected AMI must be arm64 for this instance type."
    }
    postcondition {
      condition     = self.public_ip != ""
      error_message = "Instance must receive a public IP."
    }
  }
}
```

- **`precondition`** — checked *before* the resource is created/updated; use it to validate assumptions about inputs/data.
- **`postcondition`** — checked *after*; use it to assert the result came out as expected.

They make failures self-documenting and catch bad configurations at plan time rather than after you've provisioned something wrong.

### Q15. This resource keeps getting recreated (or won't destroy) on every apply. How do you fix it with lifecycle rules?

First **read the plan** — Terraform prints *why* it's replacing (which attribute forces replacement) or what it wants to destroy. Then match the cause to the right lifecycle rule:

- **Perpetual diff on an attribute something else manages** (autoscaler, deploy tool, cloud auto-tagging) → `ignore_changes = [that_attribute]`. You're choosing to tolerate that field's drift.
- **Replacement causing downtime** → `create_before_destroy = true` (and fix any fixed `name` to a `name_prefix` so the old/new can coexist).
- **A resource getting destroyed that must never be** → `prevent_destroy = true` so the plan errors instead of proceeding.
- **A provisioner tainting the resource on every run** → the real fix is usually to remove the provisioner (move bootstrap to `user_data`/an image); if you need "recreate on version change," use `replace_triggered_by` instead of an always-running provisioner.
- **Something recreating because an unstable input changes each plan** (e.g. a timestamp in `user_data`) → stabilise the input, or gate replacement explicitly with `replace_triggered_by`.

The meta-point: don't silence the diff blindly. Diagnose *why* Terraform wants the change from the plan, then apply the narrowest lifecycle rule that expresses your actual intent.

## Dependencies & the Resource Graph

### Summary

**What this topic covers**

How Terraform figures out the *order* to do things. Terraform doesn't execute your config top-to-bottom — it builds a **dependency graph (a DAG)** from the references between resources and walks it, applying independent resources in parallel and dependent ones in order. This topic covers how that graph is built, **implicit dependencies** (the preferred way, created automatically when one resource references another's attribute) versus **explicit dependencies** via `depends_on` (and why to use it sparingly), how the graph enables **parallelism**, why destroys run in reverse order, **cycle errors** and how to break them, the `terraform graph` command, module and data-source dependencies (including the data-source-races-a-not-yet-created-resource problem), how `-target` and `replace_triggered_by` interact with the graph, and how to debug ordering problems. The 15 questions run from "how does Terraform decide order" to "here's a cycle error / a data source reading stale values — fix it."

**Mental model**

Stop thinking of `.tf` files as a script and start thinking of them as a **set of nodes and edges**. Each resource, data source, and module is a node. Every time you write `subnet_id = aws_subnet.web.id`, you draw an **edge**: "the instance depends on the subnet." Terraform collects all those edges into a directed acyclic graph, topologically sorts it, and then walks it — creating a node only after everything it depends on exists, and doing unrelated nodes **concurrently**. Destroy walks the *same* graph in reverse (you can't delete the subnet before the instance in it). This is why Terraform is declarative and order-independent in your source: **you express dependencies by referencing, and Terraform derives the order.** The senior instinct is to make dependencies *implicit* (through references) so the graph is accurate, and to reach for `depends_on` only when a real dependency exists that no reference captures. A "Cycle" error means you drew edges that form a loop; parallelism problems and ordering bugs are almost always a missing or wrong edge.

**Key terms**

- **DAG (directed acyclic graph)** — the dependency graph Terraform builds; "acyclic" because cycles are illegal.
- **Node** — a resource, data source, module, variable, or output in the graph.
- **Edge** — a dependency; drawn when one node references another (implicit) or via `depends_on` (explicit).
- **Implicit dependency** — an edge created automatically because A references B's attribute. The preferred kind.
- **Explicit dependency** — an edge you declare with `depends_on` when no reference expresses the real dependency.
- **Topological sort** — ordering the nodes so every node comes after its dependencies.
- **Parallelism** — Terraform applies independent nodes concurrently; default `-parallelism=10`.
- **Reverse-order destroy** — destroys walk the graph backwards (dependents before dependencies).
- **Cycle** — an illegal loop of edges; Terraform errors with `Cycle: ...`.
- **`terraform graph`** — emits the graph in DOT format for visualisation (e.g. via graphviz).
- **`-target`** — restricts the operation to a node and its dependencies, pruning the rest of the graph.

**Why interviewers ask this**

The graph is the single idea that explains most of Terraform's "why did it do that" behaviour, so it's a great depth probe. A junior thinks Terraform runs the file in order and adds `depends_on` everywhere "to be safe" — killing parallelism and hiding the real structure. A senior knows dependencies should be **implicit through references**, uses `depends_on` only for the genuine no-reference case (IAM policy must exist before the thing that uses it, with no attribute link), understands why a data source can race a not-yet-created resource, can read a plan's order, and knows how to diagnose and break a cycle. Interviewers use "you have a cycle error — walk me through it" and "when do you actually need `depends_on`" to separate people who've internalised the DAG from people who pattern-match on symptoms.

**Common confusions**

- "Terraform runs my config top to bottom" — it doesn't; order comes from the dependency graph, not file position.
- "Add `depends_on` to be safe" — over-using `depends_on` adds edges that **reduce parallelism** and hide the real structure; prefer references.
- "A reference and a `depends_on` are the same" — a reference also *passes the value*; `depends_on` only orders, it passes nothing. Use a reference when you need the value.
- "Data sources are read once up front" — a data source with a dependency on a not-yet-created resource can **race** (read during plan before the resource exists); express the dependency so it reads at the right time.
- "`-target` is a normal way to work" — it prunes the graph to a subset and is a break-glass tool; routine use hides real dependency problems and drifts state.
- "Cycles come from bad luck" — a cycle is always a loop of edges you created; you break it with indirection or by splitting a resource.

**What follows from this topic**

The graph underpins nearly everything else. `create_before_destroy` and `replace_triggered_by` from the **lifecycle** topic literally rewrite graph edges (replacement ordering, replacement propagation). Module composition depends on how modules become nodes and pass dependencies. The **state** topic connects here because destroy ordering and `-target` operate on state through the graph. And the drift/plan-reading skills lean on understanding *why* Terraform sequenced a plan the way it did. Master the DAG and Terraform stops being surprising.

### Q1. How does Terraform decide what order to create resources in?

It doesn't use file order — it builds a **dependency graph** and walks it. Concretely:

1. **Parse** all config into nodes (resources, data sources, modules, variables, outputs, providers).
2. **Draw edges** from the references between them — every `a = b.attr` creates a "a depends on b" edge.
3. **Topologically sort** the graph so every node comes after its dependencies.
4. **Walk it**, creating each node only once everything it depends on exists, and doing **independent nodes in parallel**.

```hcl
resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }

resource "aws_subnet" "web" {
  vpc_id = aws_vpc.main.id            # edge: subnet depends on vpc
}
```

Terraform creates the VPC first *because the subnet references it*, not because it's written first. This is the heart of Terraform's declarative model: **you express relationships, Terraform derives the order.**

### Q2. What's the difference between implicit and explicit dependencies?

An **implicit dependency** is created automatically when one resource **references another's attribute**. This is the preferred way — the edge is accurate because it mirrors a real data flow:

```hcl
resource "aws_instance" "app" {
  subnet_id = aws_subnet.web.id       # implicit dep on the subnet
}
```

An **explicit dependency** is one you declare with `depends_on` when a real ordering requirement exists that **no reference captures**:

```hcl
resource "aws_instance" "app" {
  depends_on = [aws_iam_role_policy.app]   # needed, but no attribute link
}
```

The rule: **prefer implicit.** If A needs a value from B, reference it — you get the ordering *and* the value, and the graph stays honest. Only reach for `depends_on` when the dependency is real but invisible to references (next question).

### Q3. When should you actually use `depends_on`, and why avoid overusing it?

Use `depends_on` when a genuine ordering requirement exists that **isn't expressed through any reference**. The classic case: an IAM role policy must exist before an EC2 instance uses that role, but the instance config has **no attribute** pointing at the policy — the dependency is real but invisible.

```hcl
resource "aws_iam_role_policy" "app" { /* ... */ }

resource "aws_instance" "app" {
  # uses the role at runtime but references nothing about the policy
  depends_on = [aws_iam_role_policy.app]
}
```

Why avoid overusing it:

- **It reduces parallelism** — every `depends_on` edge is a "wait for this" that serialises work Terraform could have done concurrently.
- **It hides the real structure** — a reference documents *why* (data flows from B to A); a blanket `depends_on` just says "later," obscuring intent.
- **It rots** — people add it "to be safe" and never remove it, accumulating false edges.

Reach for it deliberately, for the no-reference case, and prefer restructuring to a reference when one is available.

### Q4. How does the graph enable parallelism?

Because the graph tells Terraform exactly which nodes are **independent**, it can process them **at the same time**. After the topological sort, any nodes with no unsatisfied dependencies are eligible to run concurrently.

```hcl
resource "aws_s3_bucket" "a" {}   # independent
resource "aws_s3_bucket" "b" {}   # independent → created in parallel with a
```

Terraform defaults to **`-parallelism=10`** — up to ten operations at once. You can lower it (to be gentle on provider rate limits) or raise it:

```bash
terraform apply -parallelism=5
```

This is a direct payoff of the DAG: you don't schedule anything, you just express dependencies, and Terraform extracts maximum safe concurrency. It's also why spurious `depends_on` edges hurt — each one removes a chance to parallelise by forcing an artificial "wait."

### Q5. In what order do destroys happen?

**Reverse dependency order.** If creation goes VPC → subnet → instance, destruction goes instance → subnet → VPC. Terraform walks the *same* graph backwards, because you can't delete a resource while things that depend on it still exist (you can't delete the subnet while an instance lives in it).

```text
create:  aws_vpc.main  →  aws_subnet.web  →  aws_instance.app
destroy: aws_instance.app  →  aws_subnet.web  →  aws_vpc.main
```

This is why dependencies must be correct even for teardown — a missing edge can make Terraform try to destroy something out of order and fail (or succeed and orphan a dependent). It's also why `create_before_destroy` matters: it changes how replacement interacts with this reverse-order teardown, and can propagate to dependents so the whole chain replaces cleanly.

### Q6. What causes a "Cycle" error and how do you break it?

A **cycle** means the edges form a loop — A depends on B, B depends on A (possibly through a chain) — so no valid ordering exists and Terraform errors with `Error: Cycle: ...` listing the nodes in the loop.

Common causes: two resources referencing each other's attributes, or a `depends_on` pointing "backwards" into something that already depends on this node. Security groups referencing each other is a classic:

```hcl
# sg_a allows from sg_b, sg_b allows from sg_a → cycle if done via inline rules
```

How to break it:

- **Introduce indirection** — pull the mutual reference into a separate resource. For SGs, use standalone `aws_security_group_rule` / `aws_vpc_security_group_ingress_rule` resources instead of inline rules, so the groups don't reference each other directly.
- **Split the resource** — break a node that's both producing and consuming into two.
- **Remove a needless `depends_on`** — often the loop is a hand-added explicit edge that shouldn't be there.
- **Visualise it** — `terraform graph` (next question) shows the loop.

The fix is always to remove one edge of the loop, usually by routing the relationship through a third node.

### Q7. What does `terraform graph` do?

`terraform graph` outputs the dependency graph in **DOT format**, which you render with Graphviz to *see* the structure:

```bash
terraform graph | dot -Tsvg > graph.svg
```

It's useful for:

- **Debugging cycles** — visually spot the loop the error message references.
- **Understanding a large config** — see what actually depends on what before a risky change.
- **Reviewing blast radius** — see everything downstream of a resource you're about to replace.

The output includes resource nodes and the edges between them (and provider/variable nodes depending on flags). It reflects Terraform's *own* view of dependencies, so it's the ground truth for "why did Terraform order it that way." For big configs the raw graph is noisy; render to SVG and zoom, or graph a targeted subset.

### Q8. How do module dependencies work, and can you use `depends_on` on a module?

A module is a **node (really a subgraph)** in the parent's graph. Dependencies between modules are created the same two ways:

- **Implicit** — pass one module's **output** into another module's input; that draws an edge:

```hcl
module "network" { source = "./modules/network" }

module "app" {
  source    = "./modules/app"
  subnet_id = module.network.subnet_id   # app module depends on network module
}
```

- **Explicit** — yes, `depends_on` works **on module blocks** for the no-reference case:

```hcl
module "app" {
  source     = "./modules/app"
  depends_on = [module.network]
}
```

`depends_on` on a module makes *everything* in that module wait for *everything* in the depended-on module — a coarse, parallelism-reducing edge. So the same guidance holds: prefer wiring modules together through outputs/inputs, and use module-level `depends_on` only when there's a real cross-module ordering requirement no output expresses.

### Q9. How do data sources fit into the graph, and how can they race a resource?

A data source is a node too — it performs a **read**, and it's ordered by the same edges. If a data source references a resource, it reads *after* that resource is created. The problem is when a data source needs data from a resource **it doesn't reference**: Terraform may try to read it **during plan, before the resource exists**, returning stale or empty results — a race.

```hcl
resource "aws_instance" "app" { /* ... */ }

data "aws_instances" "app" {
  filter { name = "tag:Name" values = ["app"] }
  depends_on = [aws_instance.app]   # force the read to happen AFTER creation
}
```

Two fixes:

- **Reference the resource's attribute** in the data source if possible (implicit edge → read happens after).
- **`depends_on` on the data source** when there's no attribute to reference — this defers the read until the depended-on resource is created (Terraform will then read it during apply, not plan).

This is one of the few places `depends_on` on a *data source* is the correct, idiomatic tool.

### Q10. How does the `-target` flag affect the graph?

`-target` **prunes the graph to a subset**: the targeted node **plus everything it depends on** (so the target can actually be built), and nothing else.

```bash
terraform apply -target=aws_instance.app
```

This computes and applies a plan for just that slice. It's a **break-glass tool** — for recovering from a partially-failed apply, or working around a provider bug — not a normal workflow, because:

- It **skips the rest of your config**, so state can end up **inconsistent** with your source (you applied part of a coordinated change).
- It **hides real dependency problems** — if you *need* `-target` to make things apply in order, your dependencies are probably wrong.

Terraform even warns you after a targeted apply to run a full plan/apply to reconcile. Use it sparingly and follow up with an untargeted run.

### Q11. What's the difference between a reference and a `depends_on` — don't they do the same thing?

They overlap on *ordering* but differ fundamentally:

| | Reference (`a = b.attr`) | `depends_on = [b]` |
|---|---|---|
| Creates ordering edge | Yes | Yes |
| Passes a value | **Yes** — you get `b.attr` | **No** — ordering only |
| Documents *why* | Yes — shows the data flow | No — just "after" |
| Affects parallelism | Only where truly needed | Adds a hard wait |

So: if A needs a **value** from B, always reference it — you get the ordering *for free* and the graph reflects the real reason. Use `depends_on` **only** when the dependency is real but there's **no value to pass** (the IAM-policy-before-instance case). Reaching for `depends_on` when a reference would work throws away the value and the documentation, and often means you've missed the natural edge.

### Q12. How does resource replacement propagate through the graph?

When a resource is replaced, things that **depend on it** may need to change too, and the graph is what carries that propagation:

- **Attribute changes flow downstream** — if replacing B gives it a new `id`, and A references `B.id`, A sees a changed input and may update or be replaced in turn.
- **`replace_triggered_by`** explicitly adds a **replacement edge** — replacing (or changing) the referenced node forces *this* node to be replaced:

```hcl
resource "aws_instance" "app" {
  lifecycle { replace_triggered_by = [terraform_data.version] }
}
```

- **`create_before_destroy` propagates** — if a resource with `create_before_destroy` is replaced, its dependents often need the same setting so the graph can order "create all the new, then destroy all the old" without a dependency forcing an early destroy.

So replacement isn't a single-node event; it ripples along dependency edges. Reading the plan shows you the ripple — Terraform prints which downstream resources are affected and why.

### Q13. A data source is reading stale/old values during plan. What's going on and how do you fix it?

The data source is being **read too early** — during plan, before the resource whose output it should reflect has been created or updated. This happens when the data source doesn't have an edge forcing it to wait, so Terraform reads it eagerly at plan time and captures a pre-change snapshot.

Diagnose: check whether the data source depends (via reference or `depends_on`) on the resource whose current state it needs. If not, there's no edge, so no ordering.

Fix:

- **Add a reference** to the relevant resource attribute if one exists — turns the read into a post-create read.
- **Add `depends_on`** to the data source pointing at the resource it must reflect, which defers the read until apply:

```hcl
data "aws_lb" "app" {
  name       = "app-lb"
  depends_on = [aws_lb.app]   # don't read until the LB exists/updates
}
```

The general lesson: a data source without an explicit or implicit dependency is read as early as possible. If it must observe the *result* of a change, give it an edge.

### Q14. How do you debug an ordering problem in Terraform?

Work from the graph outward:

1. **Read the error / plan carefully** — Terraform usually names the resources and says what it was trying to do (create X which needs Y that doesn't exist yet). A `Cycle:` error lists the exact loop.
2. **Check the edges** — is the dependency expressed? A missing reference means a missing edge means wrong order. An accidental mutual reference means a cycle.
3. **Visualise** — `terraform graph | dot -Tsvg > graph.svg` to see the actual structure and spot loops or missing links.
4. **Prefer fixing with a reference** — most ordering bugs are a missing implicit dependency; add the reference so the edge (and the value) are correct.
5. **Break cycles with indirection** — route mutual references through a separate resource (e.g. standalone SG rules).
6. **Use `depends_on` for the genuine no-reference case** — data-source races, IAM-before-use.

Resist the urge to spray `depends_on` until it works — that masks the real missing edge and wrecks parallelism. Diagnose the edge, fix the edge.

### Q15. Why is declarative dependency management better than manually ordering operations?

Because **you can't reliably order infrastructure by hand at scale**, and Terraform can:

- **Accuracy** — you declare relationships once (by referencing); Terraform derives a provably-correct order via topological sort. No forgotten "oh, that needed to come first."
- **Parallelism for free** — the graph exposes every independent node, so Terraform runs the maximum safe concurrency. Manual ordering is inherently serial.
- **Correct teardown** — reverse-order destroy falls out of the same graph; you don't maintain a separate teardown script.
- **Refactor-safe** — move resources around in your files and the order is unchanged, because it comes from references, not line numbers.
- **Self-documenting** — a reference states *why* B comes before A (data flows). A hand-ordered runbook states only *that* it does, and rots.

The declarative model turns "sequence these hundred operations correctly, in both directions, with maximum parallelism" — an error-prone human task — into a solved graph problem. Your only job is to express real dependencies honestly (implicit where possible), and Terraform does the scheduling.
## Testing, Validation & Policy

### Summary

**What this topic covers**

How you gain confidence that a Terraform change is correct, safe, and compliant *before* it touches real infrastructure — and how you keep that confidence over time. This spans a whole ladder of controls, cheapest and fastest first: `terraform fmt` (canonical formatting), `terraform validate` (syntax and internal consistency, no API calls), **tflint** (provider-aware linting for best practices and deprecated syntax), the plan itself as a reviewable artifact, config-level assertions (`precondition` / `postcondition` / `check` blocks), the native **`terraform test`** framework (1.6+), heavier **Terratest** integration tests that spin up real infra, **policy-as-code** (Sentinel, OPA/Conftest), **static security scanning** (checkov, tfsec, Trivy), and **cost estimation** (Infracost). The 16 questions here move from "what does `validate` actually check" through to designing a full test pyramid for a module registry and wiring every gate into CI. The through-line: match the cost of the check to the cost of the failure, and push failures as far left as you can.

**Mental model**

Think of it as a **validation ladder** — each rung is more expensive and slower than the last but catches a different class of problem. `fmt` and `validate` are milliseconds and catch typos and type errors with zero cloud access. `tflint` and static scanners (tfsec/checkov) parse your HCL and known plan JSON to flag misconfigurations — a public S3 bucket, a `0.0.0.0/0` security group — again with no apply. `terraform plan` is the first rung that talks to the provider API: it refreshes state and shows you exactly what will change, and reviewing that plan (or gating on it) is itself a control. `terraform test` runs `plan`-only or full `apply` against ephemeral resources and asserts on outputs and attributes. Terratest sits at the top: real infrastructure, real assertions, real teardown — slow, expensive, high-confidence. Policy engines (Sentinel/OPA) run against the plan to *block* non-compliant changes regardless of intent. The senior instinct is to run the cheap rungs on every commit and reserve the expensive ones for module releases and pre-merge gates.

**Key terms**

- **`terraform fmt`** — rewrites config to canonical style; `-check` in CI fails if unformatted, `-diff` shows what would change.
- **`terraform validate`** — checks syntax and internal consistency (types, references, required args) with **no** provider API calls; catches bad references, not real-world conflicts.
- **tflint** — pluggable linter; provider rulesets catch deprecated syntax, invalid instance types, naming conventions, unused declarations.
- **`terraform test`** — native framework (1.6+); `.tftest.hcl` files with `run` blocks (`command = plan|apply`), `assert` conditions, variables, and provider mocking.
- **Terratest** — Go library that `apply`s real infra, asserts via SDK/HTTP, then `destroy`s; integration-grade, slow, cloud-cost incurring.
- **Sentinel** — HashiCorp's policy language, embedded in Terraform Cloud/Enterprise; runs against plan, enforces advisory/soft-mandatory/hard-mandatory rules.
- **OPA / Conftest** — open-source policy engine; **Rego** rules evaluated against `terraform show -json` plan output.
- **checkov / tfsec / Trivy** — static security scanners for IaC misconfigurations (unencrypted volumes, open SGs, public buckets).
- **precondition / postcondition** — `lifecycle` assertions inside a resource/data block that fail the plan/apply if a guarantee is violated.
- **check block** — top-level (1.5+) assertions and scoped data sources for continuous, non-blocking validation.
- **Infracost** — estimates the monetary delta of a plan; posts a cost diff on the PR.
- **Test pyramid (IaC)** — static analysis at the base, plan-based unit tests in the middle, integration (apply/destroy) tests at the top.

**Why interviewers ask this**

Anyone can run `terraform apply`; the platform-engineering signal is whether you build *guardrails* so that a tired engineer at 5pm on a Friday physically cannot ship a public database. Juniors answer "I read the plan carefully." Seniors answer with a layered strategy: fmt/validate/tflint pre-commit, tfsec + Infracost + policy checks in CI, plan-in-PR review, native `terraform test` for module logic, Terratest for the golden-path integration test, and Sentinel/OPA for organization-wide mandatory rules. They know *what each tool actually catches* — that `validate` never sees the cloud, that `sensitive = true` doesn't help security scanning, that a passing plan can still fail on apply. They also know the economics: you don't Terratest every PR because it costs real money and minutes. Knowing where each control belongs on the ladder is the differentiator.

**Common confusions**

- "`terraform validate` checks my infrastructure" — no. It makes zero API calls. It cannot know your subnet is full or your IAM role lacks permission; it only checks the config is internally coherent.
- "`fmt` catches bugs" — it only reformats whitespace/alignment. It changes zero behavior.
- "`terraform test` needs real cloud credentials" — only for `command = apply` runs; `plan`-only runs and mock providers can run offline in CI.
- "tfsec/checkov and `validate` do the same job" — validate checks HCL correctness; security scanners check for insecure *configurations* that are perfectly valid HCL.
- "Policy-as-code is the same as linting" — linting is advisory best-practice; policy (Sentinel/OPA) is *enforced governance* that blocks the apply.
- "A green plan means apply will succeed" — plan is a proposal computed from current state; apply can still fail mid-way (quota, race, dependency) and leave partial state.

**What follows from this topic**

These controls only have teeth when they run automatically — which is the domain of **CI/CD & Automation** (plan-in-PR, apply-on-merge, where each gate executes). The security scanners and policy engines here overlap heavily with **Security & Secrets** (blocking public buckets, enforcing encryption, keeping secrets out of state). Config-level assertions build on the `lifecycle` and validation mechanics from the state/resources topics, and testing *modules* specifically extends module-authoring conventions. Treat this topic as the quality gate that everything else in a mature Terraform workflow passes through.

### Q1. Walk me through the "validation ladder" — the order you'd run checks in, cheapest to most expensive.

The principle: **fail fast and cheap, and only pay for the expensive checks once the cheap ones pass.** Left to right, cheapest first:

1. **`terraform fmt -check`** — milliseconds, no cloud. Canonical formatting.
2. **`terraform validate`** — sub-second, no cloud. Syntax, types, references, required args.
3. **tflint** — fast, no apply. Provider best practices, deprecated syntax, naming.
4. **Static security scan (tfsec / checkov / Trivy)** — fast, no apply. Insecure configurations.
5. **`terraform plan`** — talks to the provider API; refreshes state, computes the diff. First real-world check.
6. **Policy-as-code (Sentinel / OPA-Conftest)** — runs against the plan JSON; blocks non-compliant changes.
7. **Infracost** — cost delta of the plan.
8. **`terraform test` (plan runs)** — asserts on planned values / outputs.
9. **`terraform test` (apply runs) / Terratest** — real infra, real assertions, teardown. Slowest, costs money.

```bash
# Typical pre-commit / early-CI gate (rungs 1-4)
terraform fmt -check -recursive
terraform validate
tflint --recursive
tfsec .        # or: checkov -d .
```

The senior point: rungs 1–4 run on **every commit** and catch the majority of mistakes for free. Rungs 5–7 run on the **PR**. Rung 9 runs on **module release** or nightly — not every PR — because it burns real cloud spend and minutes.

### Q2. What exactly does `terraform validate` check, and what does it NOT check?

`terraform validate` checks that your configuration is **internally consistent** — and nothing more. It runs entirely offline: **no provider API calls, no state refresh.**

It **catches**: syntax errors, unknown arguments, missing required arguments, type mismatches (passing a string where a number is required), references to undeclared variables/resources, and invalid function calls.

It **cannot catch**: whether the AWS region actually has capacity, whether your IAM role can create the resource, whether a bucket name is already taken, whether a subnet is full, or whether the resource will conflict with something already deployed. Those are all real-world facts that only `plan` (which refreshes against the provider) or `apply` can discover.

```bash
terraform init -backend=false   # validate needs providers, not the backend
terraform validate
```

Note the `-backend=false` trick: in CI you often want to `validate` without configuring remote state. You still need `init` to install providers, but you can skip the backend. A green `validate` means "this could be applied" — not "this will apply successfully."

### Q3. What's the difference between `terraform validate` and tflint? Don't you only need one?

They catch different things and complement each other.

| | `terraform validate` | tflint |
|---|---|---|
| Built-in? | Yes (core) | No, separate binary + plugins |
| Checks | Syntax, types, internal references | Best practices, deprecated syntax, naming, provider-specific errors |
| Provider awareness | Generic | Deep (e.g. "`t2.nano` isn't a valid instance type") |
| API calls | None | None (static) |
| Example catch | Undeclared variable | Invalid AMI format, unused declaration, missing tag |

`validate` answers "is this valid HCL that hangs together?" tflint answers "is this HCL a *good idea* for this provider?" tflint's provider rulesets know that a particular instance type doesn't exist, that an argument is deprecated, or that your naming convention is violated — things `validate` has no opinion on. In practice you run both: `validate` first (it's core and free), then tflint for the deeper, provider-specific lint. Neither touches the cloud, so both belong on the cheap rungs of the ladder.

### Q4. Explain the native `terraform test` framework. What does a test file look like?

Introduced in Terraform 1.6, `terraform test` is a **built-in** framework using `.tftest.hcl` files (conventionally under `tests/`). Each file has `run` blocks; each `run` executes a `command` (`plan` or `apply`) and evaluates `assert` conditions against outputs, variables, or resource attributes.

```hcl
# tests/bucket.tftest.hcl
variables {
  bucket_name = "acme-test-bucket"
}

run "plan_is_valid" {
  command = plan

  assert {
    condition     = aws_s3_bucket.this.bucket == "acme-test-bucket"
    error_message = "Bucket name did not match the input variable"
  }
}

run "apply_and_check_versioning" {
  command = apply

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning must be enabled"
  }
}
```

Key behaviors: `command = plan` runs offline-ish (no real resources created) and asserts on *planned* values — fast unit tests. `command = apply` really creates resources and Terraform **automatically destroys** everything at the end of the run. You can chain `run` blocks to test a sequence, override variables per run, and (1.7+) mock providers so `apply` runs don't touch the cloud at all.

```bash
terraform test              # runs all *.tftest.hcl
terraform test -filter=tests/bucket.tftest.hcl
```

The pitch: it's native (no Go, no extra toolchain), it's HCL you already know, and it auto-cleans up. It's the right default for testing **module logic**.

### Q5. When would you reach for Terratest over `terraform test`?

Use **Terratest** when you need to assert things Terraform can't see, and you're willing to pay for real infrastructure and a Go toolchain.

| | `terraform test` | Terratest |
|---|---|---|
| Language | HCL | Go |
| Speed | Fast (plan) to moderate (apply) | Slow (real apply/destroy) |
| Assertions | Terraform values/outputs/attributes | Anything: HTTP calls, SSH, cloud SDK, DNS, retries |
| Cloud cost | Only on apply runs | Always (spins up real infra) |
| Best for | Module logic, input/output contracts | End-to-end "does the deployed thing actually work" |

`terraform test` asserts that Terraform *planned/created* the resource with the right attributes. Terratest goes further: it applies, then **hits the real endpoint** — curls the load balancer and checks for a 200, SSHes in, queries the cloud API with retries and timeouts, validates DNS resolves — then tears it all down. That's genuine integration testing. The cost is a Go test suite, real cloud spend per run, and minutes not seconds. So: `terraform test` for the many cheap unit tests, one or two Terratest suites for the golden-path "the module produces working infrastructure" check, run on release rather than every PR.

### Q6. What is policy-as-code, and how do Sentinel and OPA/Conftest differ?

Policy-as-code means encoding organizational rules ("no public S3 buckets", "every resource must be tagged with a cost center", "only approved instance types") as **executable policies that block non-compliant plans** — governance that's enforced automatically, not a wiki page people ignore.

**Sentinel** is HashiCorp's proprietary policy language, embedded in Terraform Cloud/Enterprise. It runs against the plan and supports enforcement levels: *advisory* (warn), *soft-mandatory* (override with approval), *hard-mandatory* (cannot proceed). Tightly integrated with TFC's run pipeline.

**OPA (Open Policy Agent) / Conftest** is the open-source alternative. You write rules in **Rego**, then evaluate them against the machine-readable plan (`terraform show -json plan.tfplan`). Conftest is the CLI wrapper that makes this ergonomic in any CI.

```bash
terraform plan -out=tfplan
terraform show -json tfplan > plan.json
conftest test plan.json          # evaluates Rego policies against the plan
```

The key distinction: Sentinel is the paid, deeply-integrated TFC/TFE path; OPA/Conftest is the vendor-neutral, self-hosted path that works with any CI and any backend. Both operate on the **plan**, so they judge intent before anything is applied.

### Q7. Where do checkov, tfsec, and Trivy fit — and how are they different from policy engines?

checkov, tfsec, and Trivy are **static security scanners** for IaC. They parse your HCL (and sometimes plan JSON) and flag insecure configurations against a large library of **built-in rules**: unencrypted EBS volumes, public S3 buckets, security groups open to `0.0.0.0/0`, missing logging, IAM wildcards, and so on.

The difference from Sentinel/OPA is *who writes the rules*. Security scanners ship **hundreds of pre-written, curated security checks** out of the box — you get value with zero policy authoring. Policy engines (Sentinel/OPA) are **frameworks you write your own org-specific rules in**. In practice you run both: a scanner for the well-known security baseline, and a policy engine for your bespoke governance (tagging standards, approved regions, naming).

```bash
tfsec .                      # scans HCL directly
checkov -d .                 # HCL or plan JSON, very large ruleset
trivy config .               # misconfig scanning, also does images/deps
```

Trivy is worth calling out because it's broader — the same tool scans container images, filesystems, and dependencies for CVEs, not just IaC misconfig — so teams often standardize on it to cover more of the supply chain with one tool. All three are fast, need no apply, and belong on the cheap rungs of the ladder.

### Q8. How do precondition, postcondition, and check blocks let you assert things inside the config itself?

These move assertions *into* the configuration so Terraform validates guarantees during plan/apply, not in a separate test file.

**`precondition`** — inside a resource/data `lifecycle` block; checked *before* the object is created/read. Use it to assert an assumption about inputs.

**`postcondition`** — also in `lifecycle`; checked *after*, to guarantee something about the result.

```hcl
data "aws_ami" "app" {
  most_recent = true
  owners      = ["self"]
  # ...
  lifecycle {
    postcondition {
      condition     = self.architecture == "arm64"
      error_message = "Selected AMI must be arm64."
    }
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.app.id
  instance_type = var.instance_type
  lifecycle {
    precondition {
      condition     = contains(["t4g.small", "t4g.medium"], var.instance_type)
      error_message = "instance_type must be an approved Graviton type."
    }
  }
}
```

**`check` block** (1.5+) — a top-level, *non-blocking* assertion (optionally with a scoped data source). It reports a warning if the condition fails but does **not** stop the apply — good for continuous health assertions where you want visibility without breaking the run.

The distinction that catches people: pre/postconditions **fail the run**; `check` blocks only **warn**. Use conditions for invariants that must hold; use checks for "tell me if this drifts but don't block me."

### Q9. Why run fmt/validate/tflint/tfsec as pre-commit hooks instead of only in CI?

Because the cheapest place to catch a mistake is on the developer's machine, before it's ever pushed. Pre-commit hooks give **instant local feedback** — you fix formatting and a flagged open security group in the editor, not after a 3-minute CI round-trip and a red PR.

```yaml
# .pre-commit-config.yaml  (pre-commit framework)
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.x
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_tflint
      - id: terraform_tfsec
```

The nuance a senior adds: pre-commit hooks are **advisory, not a control** — they can be bypassed with `--no-verify`, they depend on each dev installing them, and they only see what's staged. So you run the *same* checks again in CI as the actual enforced gate. Pre-commit is the fast local mirror; CI is the source of truth. Never rely on pre-commit alone for anything security- or policy-critical.

### Q10. How do you test a reusable module, and how is it structured?

A well-tested module ships with two things alongside the module code: an **`examples/`** directory and a **`tests/`** directory.

```
modules/vpc/
  main.tf
  variables.tf
  outputs.tf
  examples/
    basic/        # a minimal, runnable configuration using the module
    complete/     # exercises every optional feature
  tests/
    basic.tftest.hcl
    complete.tftest.hcl
```

The `examples/` serve double duty: they're documentation *and* the fixtures your tests apply. Your `.tftest.hcl` files (or Terratest) point at an example, apply it, and assert on outputs and attributes. This proves the module works as an end user would consume it, not just in isolation.

Test layering for a module:
- **Plan-based unit tests** (`command = plan`) — cheap; assert the module wires inputs to the right resource attributes and computes outputs correctly.
- **Apply-based integration tests** (`command = apply` or Terratest) — expensive; assert the deployed infra actually functions. Run on release.
- **Static scan** — tfsec/checkov over the module and examples so you don't publish an insecure default.

The senior habit: keep an example per major use case, gate module releases on the test suite, and pin the module version so consumers opt into new behavior deliberately.

### Q11. Design a test pyramid for a company's internal module registry.

Same shape as the software test pyramid — a wide, cheap base and a narrow, expensive top:

**Base — static analysis (runs on every commit, seconds):** `fmt -check`, `validate`, `tflint`, and `tfsec`/`checkov` across every module and example. Catches the bulk of mistakes for free. This is 80% of your test volume.

**Middle — plan-based unit tests (`terraform test`, per PR):** for each module, `command = plan` runs that assert inputs map to the correct resource attributes, defaults are sane, and outputs are computed right. Provider mocking keeps these offline and fast. This is your logic-correctness layer.

**Top — integration tests (apply/destroy, on release or nightly):** one or two Terratest (or `command = apply`) suites per module that stand up the golden-path example, verify it actually works (endpoint responds, resource is reachable), and tear it down. Few in number because each costs real money and minutes.

**Cross-cutting — policy and cost:** Sentinel/OPA policies and Infracost run against plans in CI as gates regardless of layer.

The discipline is proportion: hundreds of static checks, dozens of plan tests, a handful of integration tests. Inverting that — Terratest-ing everything — makes your pipeline slow and expensive for little added confidence.

### Q12. What is Infracost and how do you use it as a gate?

Infracost estimates the **monetary cost delta** of a Terraform change and surfaces it where humans can act on it — usually as a comment on the PR. It reads the plan, maps resources to cloud pricing, and reports "this change adds ~$740/month."

```bash
terraform plan -out=tfplan
terraform show -json tfplan > plan.json
infracost breakdown --path plan.json
infracost diff --path plan.json     # the delta vs baseline, for PR comments
```

As a **gate**, you can fail CI (or require an extra approval) when a change exceeds a cost threshold — e.g. block anything adding more than $X/month, or flag a jump from a `t4g.small` to a `m5.24xlarge` that someone typo'd. The value isn't just cost control; it's *visibility at review time* — the reviewer sees the price tag next to the diff instead of discovering it on next month's bill. It's a cheap rung (no apply needed, just the plan JSON), so it's easy to add to any pipeline.

### Q13. How would you use drift detection as a test?

Drift is real infrastructure diverging from state — usually someone made an out-of-band change in the console. You can turn detection into a **scheduled test** that runs `plan` on a cadence and alerts if the plan is non-empty.

```bash
# Nightly drift-detection job
terraform plan -detailed-exitcode -refresh-only
# exit 0 = no changes, 1 = error, 2 = drift detected
```

`-detailed-exitcode` is the key: exit code `2` means "there's a diff" — perfect for CI to branch on and fire an alert. `-refresh-only` scopes it to "has reality diverged from state" without proposing config-driven changes. Terraform Cloud/Enterprise and Env0/Spacelift offer this as a built-in **health assessment** feature.

Treating drift as a test matters because state silently rotting is a classic incident precursor — the next `apply` suddenly wants to "fix" a change someone made deliberately in the console, or worse, clobbers a hotfix. A nightly drift check gives you the chance to reconcile (via `-refresh-only` apply or a `moved`/`import`) deliberately instead of during an emergency. The `check` block is the in-config cousin of this for continuous, non-blocking assertions.

### Q14. Someone says "we run `terraform plan` in the PR, so we don't need any other tests." What's your response?

Plan-in-PR is genuinely valuable — it's the reviewable artifact showing exactly what will change — but it is **not a substitute** for the rest of the ladder, for three reasons.

**Plan doesn't judge, it describes.** A plan will happily show you creating a public S3 bucket or a `0.0.0.0/0` security group. It won't flag that as bad. That's what tfsec/checkov and policy engines are for. A human reviewer *might* catch it; a scanner *always* will.

**Plan doesn't test logic.** It shows the diff for the current inputs. It doesn't prove your module produces the right output for *other* inputs, handles the `count = 0` edge case, or wires a conditional correctly. That's what `terraform test` covers.

**Plan can be wrong about success.** A green plan can still fail on apply (quota, race, mid-apply dependency error) leaving partial state. And it only reflects the *reviewed* inputs — if you don't apply the exact saved plan (`-out`), what merges may differ.

So plan-in-PR is one important control — human review of intent — but you layer static scanning (security), policy (governance), unit tests (logic), and cost checks around it. Defense in depth, not a single gate.

### Q15. How do you mock providers in `terraform test`, and why would you?

Provider mocking (Terraform 1.7+) lets `command = apply` runs execute **without touching any real cloud** — Terraform fabricates plausible values for computed attributes instead of calling the provider API. This turns apply-based tests into fast, free, offline unit tests.

```hcl
# tests/mocked.tftest.hcl
mock_provider "aws" {}

run "apply_with_mocks" {
  command = apply
  assert {
    condition     = aws_s3_bucket.this.bucket == var.bucket_name
    error_message = "bucket name mismatch"
  }
}
```

You can also override specific data sources or resource attributes with `override_data` / `override_resource` when you need a computed value to be deterministic for an assertion.

**Why:** it lets you test module *logic* — conditionals, `for_each` expansion, output wiring, dynamic blocks — in CI on every PR without cloud credentials, cost, or latency, and without the flakiness of real infrastructure. The tradeoff: mocked runs prove your *Terraform* is right, not that the *cloud accepts it*. So mock for the fast logic layer, and keep a small number of real-apply (or Terratest) integration tests for the "does the cloud actually take this" question.

### Q16. Walk me through wiring the whole validation and policy suite into a CI pipeline.

Structure it as escalating gates, aborting at the first failure so you don't waste minutes:

```bash
# 1. Cheap static gates (seconds, no cloud)
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
tflint --recursive
tfsec .                              # or checkov -d .

# 2. Plan (needs read creds — prefer OIDC short-lived, not static keys)
terraform init
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# 3. Policy + cost gates against the plan
conftest test plan.json              # OPA/Rego org policies
infracost diff --path plan.json      # posts cost delta to the PR

# 4. Native tests (mocked = fast; keep real-apply few)
terraform test
```

Wiring principles a senior calls out: authenticate with **OIDC** federation for short-lived credentials, never static keys in CI. Run the cheap gates on **every push**; run plan/policy/cost on the **PR** and post the plan as a comment so reviewers see it. **Apply the saved `tfplan`** on merge so what's reviewed is what ships. Reserve Terratest / real-apply tests for **release or nightly**, not every PR, because of cost and time. And run heavy integration and drift-detection jobs on a **schedule**, gated behind the fast checks. The pipeline is the enforcement point where every rung of the ladder actually has teeth — which flows directly into the CI/CD & Automation topic.

## CI/CD & Automation

### Summary

**What this topic covers**

How Terraform runs when it *isn't* a human typing `apply` on a laptop — the pipelines, tools, and conventions that make infrastructure changes consistent, reviewed, audited, and repeatable. The canonical pattern is **plan-in-PR / apply-on-merge**: `terraform plan` runs automatically on a pull request and posts the plan for review; `terraform apply` runs on merge to `main` after approval, applying the *exact* saved plan artifact. Around that core sit the tools — **Atlantis** (PR-comment-driven automation, OSS, self-hosted), **Terraform Cloud/Enterprise** (managed remote runs, VCS-driven workflow, Sentinel, private registry), and hand-rolled **GitHub Actions / GitLab CI** pipelines — plus the concerns that make them safe: **OIDC** auth instead of static keys, state locking to prevent concurrent runs, approval gates and protected branches, secret handling, monorepo path-filtering, cost checks, notifications, and rollback strategy. The 16 questions here go from "why automate at all" to designing CI for a 50-service monorepo and reasoning about auto-apply's dangers.

**Mental model**

Think of the pipeline as turning an imperative, stateful, dangerous local operation into a **reviewed, gated, auditable Git workflow**. The unit of change is a pull request. The plan is the artifact you review — and critically, you **save that plan (`-out`) and apply that exact file**, so what merges is provably what was reviewed; nothing re-plans against a moved target between approval and apply. Two phases with different trust levels: **plan** needs only read/describe permissions and runs early and often (on every PR push); **apply** needs write permissions, runs once on merge, and is guarded by approvals and branch protection. State locking ensures two pipelines never apply the same state at once. Auth is short-lived (OIDC federation), never long-lived keys baked into the runner. The mental shift from local Terraform: you are no longer the executor — the pipeline is — so your job is to make the pipeline's decision (apply or not) safe, visible, and reversible-by-roll-forward.

**Key terms**

- **Plan-in-PR / apply-on-merge** — plan runs and is posted on the PR; apply runs after merge to the main branch.
- **Saved plan (`-out=tfplan`)** — a binary plan file; applying it guarantees you apply exactly what was reviewed.
- **Atlantis** — OSS server that runs Terraform via PR comments (`atlantis plan`/`atlantis apply`), with locking and per-project config.
- **Terraform Cloud/Enterprise (TFC/TFE)** — managed remote runs, remote state, VCS-driven workflow, run tasks, Sentinel, private module registry, agents.
- **OIDC federation** — CI exchanges a signed identity token for short-lived cloud credentials; no static access keys stored.
- **State locking** — backend lock (e.g. DynamoDB) preventing concurrent applies from corrupting state.
- **Approval gate / protected branch** — required reviews/environments that must pass before apply.
- **GitOps** — Git as the single source of truth for desired infra state; drift detection reconciles reality to Git.
- **Path filtering** — CI runs only for directories that changed (monorepo efficiency).
- **Terragrunt `run-all`** — orchestrates plan/apply across many dependent modules/states.
- **Run task** — TFC hook to call an external system (cost, security) during a run.
- **Roll forward** — the rollback strategy for infra: apply a corrective change (or revert the commit), because there is no `terraform undo`.

**Why interviewers ask this**

Local `apply` doesn't scale past one engineer and doesn't survive an audit. The senior signal is whether you can design a pipeline where infrastructure changes are **consistent** (same tool version, same steps every time), **reviewed** (plan on the PR), **least-privileged** (OIDC short-lived creds, plan-read separated from apply-write), **safe under concurrency** (state locking), and **auditable** (who approved, what applied, when). Juniors describe running Terraform in a single GitHub Actions job with an access key in a secret. Seniors talk about OIDC, saved-plan artifacts, protected environments with required approvers for prod, path-filtered monorepo pipelines, drift detection jobs, and the fact that auto-apply is a loaded gun. They also know the failure modes: the danger of re-planning between approval and apply, two pipelines racing on one state, and secrets leaking into CI logs via plan output.

**Common confusions**

- "Apply-on-merge re-runs plan and applies that" — it *shouldn't*. You apply the **saved plan** from the PR; re-planning risks applying something nobody reviewed.
- "Auto-apply is just apply-on-merge" — apply-on-merge still gates on human approval of the PR; true *auto-apply* (apply with no human in the loop) is far more dangerous.
- "Atlantis and Terraform Cloud do the same thing" — Atlantis is a thin OSS PR-automation layer you host; TFC is a managed platform with remote state, policy, registry, and runs.
- "Rollback = re-apply the old code" — often yes, but infra changes aren't always reversible (a destroyed database is gone); the strategy is roll-*forward*, not assume undo.
- "One state for the whole org is simplest" — it maximizes blast radius and lock contention; split state per service/env.
- "Store the AWS key as a CI secret" — prefer OIDC; static long-lived keys in CI are a top security finding.

**What follows from this topic**

CI/CD is where every control from **Testing, Validation & Policy** actually executes — fmt/validate/tflint/tfsec/policy/cost all run as pipeline gates here. It's inseparable from **Security & Secrets**: OIDC federation, least-privilege execution roles, and keeping secrets out of CI logs and state are core to a safe pipeline. The monorepo/path-filtering and state-locking discussion builds directly on state layout and remote backend topics. Treat this as the operational spine that makes Terraform a team sport rather than a solo act.

### Q1. Why automate Terraform at all? What's wrong with running `apply` locally?

Local applies work for exactly one engineer on day one and become a liability immediately after. The problems:

**Inconsistency.** Different laptops, different Terraform versions, different provider versions, different local state or credentials. "Works on my machine" applied to production infrastructure.

**No review.** A local apply changes production with nobody else seeing the plan. The plan is the single most important review artifact in Terraform, and it's invisible.

**No audit trail.** Who applied what, when, and with whose approval? A local apply leaves nothing an auditor (or an incident review) can reconstruct.

**Credential sprawl.** Every engineer needs powerful cloud credentials on their laptop — a huge attack surface. Centralizing apply behind a pipeline with OIDC means humans never hold long-lived apply credentials.

**Concurrency hazards.** Two engineers applying the same state race and can corrupt it; a pipeline with state locking serializes changes.

Automation replaces all of that with a Git-driven workflow: propose via PR, review the plan, apply through a single audited pipeline with least-privilege short-lived credentials. It's the difference between a hobby and an operable platform.

### Q2. Describe the canonical plan-in-PR / apply-on-merge workflow.

The standard pattern that almost every mature Terraform setup converges on:

1. **Engineer opens a PR** with a config change.
2. **CI runs `terraform plan`** automatically and **posts the plan as a PR comment**, plus runs the cheap gates (fmt/validate/tflint/tfsec) and often policy/cost checks.
3. **Reviewers read the plan** — they're approving the *actual diff*, not just the code.
4. **On approval + merge to `main`**, CI runs **`terraform apply`** — applying the plan that was reviewed.

```bash
# On PR:
terraform init
terraform plan -out=tfplan
terraform show -no-color tfplan   # rendered into the PR comment

# On merge to main:
terraform apply tfplan            # apply the SAVED plan, not a fresh one
```

The load-bearing detail is that final line: you **apply the saved `tfplan` artifact** from the PR, not a freshly-computed plan. Otherwise state could have changed between approval and merge, and you'd apply something nobody reviewed. Phase separation matters too: the plan job needs only read permissions; the apply job needs write and is gated behind branch protection and required approvals.

### Q3. Why is saving the plan with `-out` and applying that exact file so important?

Because it closes the gap between **what was reviewed** and **what gets applied.**

If your apply step runs a *fresh* `terraform plan` at merge time, the world may have moved since the PR was approved: someone else merged a change, a resource drifted in the console, a data source now returns a different value. The fresh plan could create, modify, or **destroy** things nobody looked at. You've turned "reviewed and approved" into "approved something, applied something else."

```bash
# PR job
terraform plan -out=tfplan
# store tfplan as a CI artifact

# Apply job (post-merge)
terraform apply tfplan     # applies EXACTLY the reviewed diff
```

Applying the saved binary plan makes the guarantee: the diff a human approved is byte-for-byte the diff that executes. If state has changed such that the saved plan is now stale, `terraform apply tfplan` will **error rather than silently re-plan** — which is exactly the safety you want. This is the single most important discipline in a Terraform pipeline, and the most commonly skipped.

### Q4. What is Atlantis and when would you choose it?

**Atlantis** is an open-source, self-hosted server that automates Terraform through **pull-request comments**. You run it (a container/server) with access to your VCS and cloud; developers drive it from the PR:

```
# In a PR comment:
atlantis plan          # Atlantis runs terraform plan, posts output on the PR
atlantis apply         # after approval, runs terraform apply and merges
```

It handles **locking** (only one PR can plan/apply a given project at a time, preventing conflicts), per-project config (`atlantis.yaml`), and keeps the plan/apply loop entirely in the PR interface.

Choose Atlantis when you want the plan-in-PR/apply-on-merge workflow **without paying for Terraform Cloud** and are comfortable self-hosting. It's a thin, focused automation layer — it doesn't give you remote state (you still bring your own backend), a private registry, or Sentinel. Its sweet spot: teams that already have S3/DynamoDB state and want a well-trodden, free PR automation experience with locking and clear plan visibility. The tradeoff versus TFC is that you operate the server, the credentials, and the upgrades yourself.

### Q5. What does Terraform Cloud/Enterprise give you over a hand-rolled pipeline?

TFC/TFE is HashiCorp's **managed platform** for Terraform. Beyond running plan/apply for you, it bundles the things you'd otherwise assemble yourself:

- **Remote runs** — plan/apply execute on HashiCorp's (or your agents') infrastructure, not your CI runner, with a consistent environment.
- **Remote state** — managed, encrypted, locked state storage; no S3/DynamoDB to run.
- **VCS-driven workflow** — connect a repo; PRs trigger plans, merges trigger applies, out of the box.
- **Sentinel policy** — enforced policy-as-code with advisory/soft/hard enforcement levels.
- **Private module registry** — versioned internal modules.
- **Run tasks** — hooks to external systems (Infracost, security scanners) during a run.
- **Agents** — for reaching private networks without exposing them.
- **RBAC + audit** — who can plan vs apply, per workspace, with an audit log.

You'd choose TFC/TFE when you want to **not operate the plumbing** — state, runners, policy engine, registry, RBAC — and get a supported, integrated product. You'd choose a hand-rolled GitHub Actions/Atlantis setup when you want full control, no per-seat cost, or already have strong CI. The decision is really "buy the managed platform vs build and operate the pieces."

### Q6. How do you build a Terraform pipeline in GitHub Actions, and how should it authenticate?

Use the official `setup-terraform` action and, critically, authenticate with **OIDC** for short-lived credentials rather than storing static cloud keys.

```yaml
name: terraform
on:
  pull_request:
  push: { branches: [main] }

permissions:
  id-token: write        # required for OIDC
  contents: read
  pull-requests: write   # to post the plan comment

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-plan
          aws-region: us-east-1     # OIDC -> short-lived creds, no static key
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - run: terraform plan -out=tfplan
      # ...render tfplan into a PR comment...
```

Key choices: `permissions.id-token: write` plus the cloud's OIDC trust policy means the runner assumes an IAM role and gets **temporary** credentials — no `AWS_ACCESS_KEY_ID` secret to leak. Separate the **plan** job (assumes a read-only role) from the **apply** job (assumes a write role, only on `main`, gated by a protected environment). For multiple environments/directories, use a **matrix** so each env/dir plans independently. This is the vendor-neutral equivalent of what Atlantis/TFC give you, with you owning the wiring.

### Q7. How do you prevent two pipeline runs from applying to the same state simultaneously?

**State locking** — the backend acquires an exclusive lock for the duration of a plan/apply, and any second run blocks or fails until it's released.

With the S3 backend you use a DynamoDB lock table (native S3 lock support also exists in recent versions); GCS and azurerm lock natively; Terraform Cloud locks the workspace. In CI you rely on this so that if two PRs merge close together, the second apply waits rather than racing.

```hcl
terraform {
  backend "s3" {
    bucket         = "my-tfstate-bucket"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"   # serializes concurrent applies
    encrypt        = true
  }
}
```

Belt-and-braces at the pipeline level: tools like Atlantis add their **own** per-project locking so a second PR can't even start a plan on a project that's mid-apply, and GitHub Actions `concurrency` groups can serialize the apply job per state. But the backend lock is the non-negotiable floor — without it, concurrent applies can interleave writes and corrupt state, which is one of the nastier failure modes to recover from. Never disable locking (`-lock=false`) in automation except for read-only operations where you're certain.

### Q8. How do you handle multiple environments (dev/staging/prod) in one pipeline safely?

The core principle: **prod apply must be harder to trigger than dev apply**, and each environment has isolated state and credentials.

Common structure — a directory per environment, each with its own backend key and its own execution role:

```
environments/
  dev/      -> backend key prod/dev/...,    role terraform-dev
  staging/  -> backend key prod/staging/..., role terraform-staging
  prod/     -> backend key prod/prod/...,    role terraform-prod
```

Pipeline safeguards:
- **Separate state per env** — a dev apply can never touch prod state.
- **Protected environments / required approvers** — the prod apply job requires a manual approval from a designated group; dev can auto-apply on merge.
- **Least-privilege per env** — the prod role is scoped to prod resources; the dev pipeline literally cannot assume it.
- **Promotion flow** — the same module/config is promoted dev → staging → prod via PRs, so prod runs code that already succeeded lower down.

The senior emphasis is on **separation of duties**: the person who writes the change may not be the person who approves the prod apply, and the pipeline enforces that through GitHub environment protection rules or TFC workspace RBAC — not through hoping people follow a runbook.

### Q9. What does GitOps mean for infrastructure, and how does drift detection fit?

**GitOps for infra** means **Git is the single source of truth for desired state**: the `main` branch's Terraform code *is* the declaration of what should exist, every change flows through a reviewed PR, and the pipeline reconciles reality to match Git. No change to production that isn't in a merged commit.

**Drift detection** is the other half of the loop. Because people (or other automation) can change infra out-of-band, you run a scheduled job that `plan`s against `main` and alerts if the plan is non-empty — reality has drifted from Git.

```bash
# Scheduled drift job
terraform plan -detailed-exitcode -refresh-only   # exit 2 => drift
```

When drift is found you decide deliberately: reconcile state to the deliberate console change (via `-refresh-only` apply or `import`/`moved`), or re-apply to force reality back to Git. The point of GitOps is that this is a *conscious* reconciliation, not a surprise the next apply springs on you. It also gives you the audit story auditors want: every production state is traceable to a reviewed, merged commit, and any divergence is detected and closed.

### Q10. How do you manage secrets in a Terraform CI pipeline?

Three rules, in priority order:

**1. Don't store long-lived cloud keys — use OIDC.** The CI runner exchanges its signed identity token for short-lived cloud credentials by assuming a role. No `AWS_ACCESS_KEY_ID` sitting in a CI secret to be exfiltrated. This is the single biggest win.

**2. Pull application secrets at runtime, don't commit them.** Secrets a resource needs (DB passwords, API keys) come from a secret manager via data sources or the Vault provider *at apply time* — never from a committed `.tfvars`. The catch to state clearly: these still land in **state**, so the state backend must be encrypted and access-controlled.

**3. Keep secrets out of logs.** Plan/apply output can echo values; `sensitive = true` redacts them from CLI/plan output (though not from state). Ensure your CI doesn't dump raw plan JSON containing secrets into publicly readable logs, and mask secret env vars.

```yaml
env:
  TF_VAR_db_password: ${{ secrets.DB_PASSWORD }}   # masked by CI, but ends up in state
```

The senior framing: the pipeline should hold **no** durable secret material — identity via OIDC, application secrets fetched just-in-time from Vault/secret manager, and a locked-down encrypted state backend as the one place secrets unavoidably rest. This overlaps heavily with the Security & Secrets topic.

### Q11. Explain separation of duties for plan vs apply. Who should be able to approve a prod apply?

Separation of duties means the **ability to propose a change is decoupled from the ability to enact it in production**, and ideally the author isn't the sole approver.

Concretely:
- **Plan** requires only **read/describe** permissions — safe for anyone, runs on every PR. The plan role literally cannot mutate infra.
- **Apply** requires **write** permissions and is restricted. The apply job assumes a more powerful role that's only available on the protected `main` branch / protected environment.
- **Prod apply approval** should come from a designated group (platform/SRE leads, or a change-approval board for regulated shops) — and, for strong separation, *not* the PR author. GitHub environment protection rules and TFC workspace RBAC let you enforce "requires approval from team X, excluding the requester."

Why it matters: it limits blast radius (a compromised or careless individual can propose but not unilaterally deploy to prod), and it satisfies audit/compliance requirements (SOX, SOC2) that demand documented, enforced approval separation. The mechanism must be **enforced by the platform**, not by convention — an approval gate you can click through yourself isn't separation of duties.

### Q12. Design CI for a monorepo with 50 services, each with its own Terraform. What's the key concern?

The dominant concern is **not re-planning everything on every PR** — with 50 states, a naive pipeline that runs 50 plans per commit is slow, expensive, and noisy. You want to run only what changed.

**Path filtering / change detection.** Determine which directories a PR touched and plan only those. In GitHub Actions this is a dynamic matrix built from `git diff`; some teams use tools like `tf-summarize` or custom scripts to map changed files to affected stacks.

```yaml
# Pseudo: build a matrix of only the changed service dirs, then plan each
jobs:
  detect:
    outputs: { dirs: ${{ steps.changes.outputs.dirs }} }
  plan:
    needs: detect
    strategy: { matrix: { dir: ${{ fromJson(needs.detect.outputs.dirs) }} } }
    steps: [ terraform -chdir=${{ matrix.dir }} plan ... ]
```

**State isolation.** Each service has its own state/backend key so blast radius and lock contention stay small — a change to service A can't lock or break service B.

**Dependency ordering.** Where states depend on each other (network before services), you need ordering. **Terragrunt `run-all`** or an explicit dependency graph handles applying dependent stacks in the right order.

**Alternatives to consider:** if the cross-stack dependency and DRY-config burden is high, Terragrunt (or a tool like Spacelift/env0) manages the many-stack orchestration for you. The interviewer wants to hear "path-filtered plans, isolated state, and a story for cross-stack ordering" — not "one giant state" (max blast radius) or "plan all 50 every time" (unusable).

### Q13. There's no `terraform undo`. What's your rollback strategy when an apply goes wrong?

Accept the premise: Terraform has **no rollback** and infra changes aren't always reversible — a destroyed database or deleted volume is gone. The strategy is **roll forward**, with a couple of variants:

**Revert the commit and re-apply.** If the bad change is reversible (a security group rule, an instance type, a count), `git revert` the PR and let the pipeline apply the previous known-good config. This is the clean, auditable path and works because your desired state is versioned in Git.

**Fix forward.** If reverting isn't sufficient (the old config would also now be wrong, or partial state exists from a failed apply), write a *new* corrective change. A mid-apply failure can leave **partial state** — some resources created, some not — so you may need `terraform plan` to see the actual current position and a targeted fix.

**Guardrails that make rollback rarely needed:** `prevent_destroy` on stateful resources (databases) so an apply *can't* delete them; `create_before_destroy` to avoid downtime on replacements; backups/snapshots so data-loss changes are recoverable outside Terraform.

The senior point: because there's no undo, you invest in **prevention** (plan review, policy, `prevent_destroy`) and design for **roll-forward**, and you never treat "just apply the old code" as a guaranteed escape hatch — verify it's actually reversible first.

### Q14. What are ephemeral / PR environments and how do you build them with Terraform?

An **ephemeral (PR) environment** is a full, isolated copy of your infrastructure stood up automatically for a pull request and destroyed when the PR closes — so reviewers can test the change against real infra without touching shared environments.

Mechanics with Terraform:
- **Isolated state per PR** — key the backend by PR number (`pr/1234/terraform.tfstate`) so each environment has its own state.
- **Parameterize by a unique identifier** — a `var.environment = "pr-1234"` feeds resource names, DNS, tags so nothing collides.
- **Create on open, destroy on close** — the pipeline runs `apply` when the PR opens/updates and `terraform destroy` on the `closed` event.

```yaml
on:
  pull_request: { types: [opened, synchronize, closed] }
# opened/synchronize -> terraform apply (workspace/key = pr-<n>)
# closed             -> terraform destroy (tear it all down)
```

The important discipline is **guaranteed teardown** — ephemeral envs that don't get destroyed become a runaway cloud bill. Wire the `destroy` to the PR-closed event and add a scheduled reaper that destroys any PR environment older than N days as a backstop. Ephemeral environments shine for services where a realistic integration test needs real cloud resources; they're overkill for pure-logic changes better covered by `terraform test`.

### Q15. Why is fully automatic apply (no human in the loop) dangerous, and when is it acceptable?

The danger: Terraform apply can **create, modify, and destroy** real infrastructure, and a plan can propose destruction you didn't intend (a resource rename read as delete-and-recreate, a `for_each` key change, a drifted data source shifting values). Remove the human who reads the plan, and a bad merge — or a malicious/compromised commit — goes straight to production with no chance to catch "wait, why is it destroying the database?"

Auto-apply also amplifies blast radius: a single errant commit can cascade across everything the pipeline manages, instantly, with no approval friction.

**When it's acceptable:**
- **Low-stakes, non-prod** environments (dev sandboxes, ephemeral PR envs) where the cost of a mistake is trivial and fast to fix.
- **Tightly-scoped state** with strong policy guardrails (Sentinel/OPA blocking destructive or insecure changes) and `prevent_destroy` on anything stateful.
- When there's **excellent test coverage** and the change surface is genuinely safe.

For production, the norm is **apply-on-merge with human approval of the plan**, not headless auto-apply. Note the distinction the question is probing: apply-*on-merge* still had a human approve the PR/plan; true auto-apply removes that gate entirely. Reserve the latter for environments where you'd shrug at it being wiped.

### Q16. How do you handle run ordering across dependent states in automation?

When infrastructure is split across multiple states (network → data → services), applies must happen in **dependency order**, and downstream states must read upstream outputs. Options, roughly in order of scale:

**Read outputs via `terraform_remote_state` (or data sources).** A downstream stack reads the upstream state's outputs (VPC id, subnet ids). This creates a logical ordering: you must apply network before services because services need network's outputs.

```hcl
data "terraform_remote_state" "network" {
  backend = "s3"
  config  = { bucket = "my-tfstate-bucket", key = "prod/network/terraform.tfstate", region = "us-east-1" }
}
# use data.terraform_remote_state.network.outputs.vpc_id downstream
```

**Orchestrate with Terragrunt `run-all`.** Terragrunt models inter-stack dependencies explicitly (`dependency` blocks) and `run-all apply` walks them in the correct order, planning/applying the graph — the standard answer for many dependent states in a monorepo.

**Sequence in the pipeline.** For a handful of stacks, encode the order directly (job `needs:` chains, or a scripted sequence) so network applies and succeeds before services starts.

**A managed platform** (TFC run triggers, Spacelift/env0 stack dependencies) does this for you: an upstream apply triggers downstream runs automatically.

The pitfalls to name: prefer **explicit data-source dependencies** over relying on humans to apply in the right order; watch for **circular dependencies** between states (a sign the split is wrong); and remember that a partial failure mid-sequence leaves you with some stacks applied and some not — so make each stack independently safe to re-run.

## Security & Secrets

### Summary

**What this topic covers**

How to keep Terraform from becoming the place your secrets leak and your cloud gets compromised. The central, non-negotiable fact: **Terraform state stores secrets in plaintext.** Any password, private key, certificate, or token that a resource generates or receives is written into state in cleartext — so *securing state is securing secrets*, and whoever can read state can read every secret in it. Everything else follows from that: don't commit secrets to code or `.tfvars`; source secrets at runtime (env vars, Vault provider/data sources, cloud secret managers) while knowing they *still land in state*; understand that `sensitive = true` only redacts CLI/plan output and does **nothing** for state; manage **provider credentials** with short-lived, least-privilege identities (env vars, IAM roles, assume-role, **OIDC** federation) rather than static keys; encrypt the state backend (SSE-KMS, TFC encryption); pin providers/modules via the lock file for supply-chain integrity; and use newer mechanisms — **ephemeral resources/values (1.10+)** — to keep some secrets out of state entirely. The 15 questions span the classic mistakes, the misconceptions, the credential-management ladder, and the blast radius of a leaked state file.

**Mental model**

Picture state as an **unencrypted secrets database that Terraform maintains as a side effect of doing its job.** You didn't set out to build a secrets store, but every apply writes real-world values — including sensitive ones — into `terraform.tfstate` so it can diff them next time. That reframes every security question: the threat model isn't just "someone reads my `.tf` files," it's "someone reads my *state*." So the two pillars are (1) **keep secrets out of the parts you can control** — never in Git, marked `sensitive` in output, sourced at runtime — and (2) **lock down the one place they unavoidably rest** — an encrypted, access-controlled, audited state backend. The second axis is **identity**: Terraform runs with credentials powerful enough to build (and destroy) your infrastructure, so those credentials should be short-lived, federated (OIDC), least-privilege, and never static keys committed anywhere. Secrets-in-state and powerful-execution-identity are the two things a leak turns into a catastrophe.

**Key terms**

- **Secrets in state** — any sensitive value a resource holds is stored in plaintext in `terraform.tfstate`; reading state = reading secrets.
- **`sensitive = true`** — marks a variable/output so its value is redacted from CLI and plan output; does **not** encrypt or omit it from state.
- **`.tfvars` in Git** — the #1 leak: committing a variables file containing real secrets.
- **Vault provider / data sources** — fetch secrets from HashiCorp Vault (or cloud secret managers) at runtime instead of hardcoding.
- **OIDC federation** — CI exchanges a signed identity token for short-lived cloud credentials; no static access keys.
- **Assume-role / IAM role** — Terraform runs as a scoped role rather than with embedded user keys.
- **Least-privilege execution role** — the identity Terraform applies with is scoped to only what it must manage.
- **SSE-KMS / backend encryption** — server-side encryption of the state object (e.g. S3 + KMS), so at-rest state is encrypted.
- **`.terraform.lock.hcl`** — the dependency lock file pinning provider versions and checksums; supply-chain integrity.
- **Ephemeral resources/values (1.10+)** — values that are used during a run but **not persisted to state**, keeping secrets out of state.
- **Policy-as-code (tfsec/checkov/Sentinel)** — blocks insecure resources (public buckets, open SGs, unencrypted storage).
- **Blast radius** — the scope of damage if a credential or state file leaks.

**Why interviewers ask this**

Terraform sits at the intersection of "holds your secrets" and "has god-mode over your cloud," so security questions separate people who've operated it safely from people who've only written HCL. The classic tell is the `sensitive = true` misconception — a junior thinks it secures secrets; a senior knows it only tidies the terminal and that the value is still plaintext in state. The senior answers layer: no secrets in Git, runtime sourcing from Vault/secret managers, encrypted and access-controlled state backend, **OIDC short-lived credentials** for provider auth, least-privilege execution roles with plan-read separated from apply-write, policy-as-code blocking insecure resources, pinned providers via the lock file, and awareness of ephemeral values for keeping secrets out of state entirely. They can also reason about **blast radius**: what an attacker gets from a leaked state file (every secret + a map of your infra) versus a leaked credential (the ability to act as Terraform).

**Common confusions**

- "`sensitive = true` secures my secret" — it **only** redacts CLI/plan output. The value is plaintext in state and visible to anyone who can read state.
- "If I fetch secrets from Vault, they're not in state" — they still land in state once a resource uses them, unless you use ephemeral values.
- "State is just a config cache, it's not sensitive" — state is a plaintext secrets store *and* a full map of your infrastructure; treat it as a crown jewel.
- "Static access keys in the provider block are fine if the repo is private" — no; use env vars/roles/OIDC. Keys in code are the top finding.
- "Encrypting the S3 bucket is enough" — encryption at rest is necessary but not sufficient; you also need tight IAM (who can read state) and audit logging.
- "The lock file is just for reproducibility" — it's also supply-chain security: pinned checksums stop a tampered provider from being silently pulled.

**What follows from this topic**

This is the security lens over the whole primer. It's inseparable from **CI/CD & Automation** (OIDC federation, least-privilege pipeline roles, keeping secrets out of CI logs) and from **Testing, Validation & Policy** (tfsec/checkov/Sentinel blocking insecure resources is the enforcement arm of these principles). The secrets-in-state fact reaches back into the state and remote-backend topics — encryption, locking, and access control on the backend are *the* secret-protection mechanism. Treat Security & Secrets as the constraint that every other Terraform decision has to satisfy.

### Q1. Why is it said that "Terraform state contains your secrets"? What are the implications?

Because it's literally true. When a resource generates or receives a sensitive value — a random password, an RDS master password, a generated TLS private key, an access key, a Vault-sourced secret — Terraform writes that value into `terraform.tfstate` **in plaintext** so it can diff against it on the next run.

```hcl
resource "random_password" "db" {
  length = 32
}
resource "aws_db_instance" "main" {
  password = random_password.db.result   # this password is now plaintext in state
}
```

Implications, all of which reframe your threat model:

- **Reading state = reading secrets.** Anyone with access to the state file — the S3 bucket, the local `terraform.tfstate`, a CI artifact — can read every secret in it. Access control on state *is* access control on secrets.
- **State must be encrypted and locked down.** At-rest encryption (SSE-KMS) plus tight IAM on who can `GetObject` the state, plus audit logging.
- **Never commit state to Git**, never leave it in a world-readable bucket, never attach it to a ticket.
- **`sensitive = true` doesn't help here** — it redacts output, not state.

The mental model: Terraform maintains an unencrypted secrets database as a side effect. Secure that database like the crown jewel it is.

### Q2. What does `sensitive = true` actually do, and what's the common misconception?

`sensitive = true` marks a variable or output as sensitive so Terraform **redacts its value from CLI and plan/apply output** — you'll see `(sensitive value)` instead of the secret in the terminal and in the rendered plan.

```hcl
variable "db_password" {
  type      = string
  sensitive = true
}
output "connection_string" {
  value     = "postgres://admin:${var.db_password}@db.example.com"
  sensitive = true          # required, or Terraform errors that a sensitive value leaks into output
}
```

**The misconception:** that it *secures* the secret. It does not. `sensitive = true`:
- Does **not** encrypt the value.
- Does **not** remove it from state — the value is still there in **plaintext**.
- Only affects what's printed to the console/logs.

So it's a defense against **shoulder-surfing and log leakage**, not against anyone who can read state. A junior cites `sensitive = true` as their secrets-security answer; a senior clarifies it's one thin layer (keeps secrets out of CI logs and terminal scrollback) and that real protection is an encrypted, access-controlled state backend plus runtime sourcing. Getting this distinction right is one of the most reliable senior signals in a Terraform interview.

### Q3. What's the number-one secrets mistake, and how do you avoid it?

**Committing secrets to Git — usually a `.tfvars` file with real passwords/keys in it.** Once it's in history, it's effectively public (especially in a shared or public repo) and stays there until you rewrite history and rotate.

```hcl
# terraform.tfvars  <- DO NOT commit this with real values
db_password = "hunter2-real-production-password"   # now in Git forever
```

How to avoid it:
- **`.gitignore` all `*.tfvars` and `*.tfvars.json`** (except explicitly-safe example files), plus `*.tfstate` and `.terraform/`.
- **Never put real secrets in `.tf` or `.tfvars`.** Pass them via environment variables (`TF_VAR_db_password`) or fetch them at runtime from Vault/a cloud secret manager.
- **Use a secrets scanner** (gitleaks, trufflehog) as a pre-commit hook and CI gate to block commits containing secret-shaped strings.
- **If one leaks: rotate immediately, then scrub history** (`git filter-repo`). Rotation first — assume it's compromised the moment it's pushed.

The senior framing: secrets should enter Terraform at runtime from a proper secret store and only ever rest (encrypted) in the state backend. They should never touch source control. Treat any secret that reaches Git as already burned.

### Q4. How should you source secrets at runtime, and what's the catch with all these methods?

Three common runtime-sourcing approaches, none of which hardcode secrets in config:

**Environment variables** — `TF_VAR_db_password=...` populates `var.db_password`. Simple; the value comes from CI's secret store or your shell, not the repo.

**Vault provider / data sources** — read secrets from HashiCorp Vault at apply time.
```hcl
data "vault_generic_secret" "db" {
  path = "secret/data/prod/db"
}
# use data.vault_generic_secret.db.data["password"]
```

**Cloud secret managers via data sources** — read from AWS Secrets Manager, GCP Secret Manager, Azure Key Vault.
```hcl
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/db/password"
}
```

**The catch — and it's the whole point of the question:** all three still **land the secret in state in plaintext** the moment a resource consumes it (and data source results are themselves stored in state). Runtime sourcing solves "secrets aren't in Git" and "there's a single source of truth with rotation," but it does **not** keep the secret out of state. So you still need an encrypted, access-controlled state backend — and if you genuinely need the secret to never touch state, that's what **ephemeral resources/values (1.10+)** are for. Sourcing at runtime and securing state are complementary, not either/or.

### Q5. How should you manage provider credentials? What's wrong with static keys in the provider block?

**Never put static, long-lived access keys in the provider block** (or anywhere in config). It's the top security finding for a reason: the keys end up in Git, they're long-lived, they're broadly scoped, and rotating them is painful.

```hcl
provider "aws" {
  region     = "us-east-1"
  access_key = "AKIA...."        # ANTI-PATTERN: static key in code
  secret_key = "wJalr...."       # in Git, long-lived, over-scoped
}
```

The ladder of better options, roughly worst-to-best:

- **Environment variables** (`AWS_ACCESS_KEY_ID` etc.) — keeps keys out of code, but still long-lived static keys somewhere.
- **Shared config / SSO profiles** — local dev via `aws sso login`; credentials are short-lived and managed by the identity provider.
- **IAM role / assume-role** — Terraform runs as a scoped role; the provider assumes it, no embedded keys.
- **OIDC federation (best for CI)** — the pipeline exchanges a signed identity token for **short-lived** credentials with no stored key at all.

```hcl
provider "aws" {
  region = "us-east-1"          # no static keys; creds come from env/role/OIDC
  # optionally: assume_role { role_arn = "arn:aws:iam::123456789012:role/terraform" }
}
```

The principle: **identity should be short-lived and externally managed.** Static keys are a durable secret you have to protect, rotate, and hope never leaks. OIDC/roles remove the durable secret entirely.

### Q6. Why does the Terraform execution role need least-privilege, and how do you scope it?

Because the identity Terraform applies with is one of the **most powerful credentials in your environment** — it can create, modify, and *destroy* infrastructure across everything it manages. If that role is over-privileged (or worse, admin), a compromised pipeline, a malicious commit, or a buggy config can do catastrophic, cloud-wide damage.

How to scope it:
- **Per-environment / per-stack roles.** The dev pipeline assumes a role scoped to dev resources; it literally cannot touch prod. The network stack's role can't modify databases.
- **Only the services it manages.** If a stack manages S3 and IAM, its role gets S3 and IAM permissions — not EC2, not RDS.
- **Separate plan-read from apply-write.** The plan job assumes a read/describe-only role (it only needs to refresh state and read resources); the apply job assumes the write role, gated behind approval. A compromised plan job can't mutate anything.
- **Time-bound and federated.** Short-lived credentials via OIDC/assume-role so there's no durable key to steal.

The tension to acknowledge: Terraform sometimes *needs* broad permissions (creating IAM roles requires IAM write, which is inherently powerful), so perfect least-privilege is hard — but scoping by environment and separating plan from apply dramatically shrinks blast radius. The anti-pattern is one admin role shared across every environment and every engineer.

### Q7. How does policy-as-code help you prevent insecure resources from being created?

Policy-as-code and security scanners **block insecure configurations before they're applied**, turning "please don't create public buckets" from a wiki plea into an enforced gate.

The tools catch the well-known dangerous patterns:
- **Public S3 buckets** / world-readable storage.
- **Security groups open to `0.0.0.0/0`** on sensitive ports.
- **Unencrypted storage** (EBS/RDS/S3 without encryption).
- **Overly-permissive IAM** (`"*"` actions/resources).
- **Missing logging / versioning.**

```bash
tfsec .            # static scan of HCL
checkov -d .       # large ruleset, HCL or plan JSON
# and, in Terraform Cloud, Sentinel policies enforced against the plan
```

Two flavors, both useful: **static scanners (tfsec/checkov/Trivy)** ship hundreds of curated security rules out of the box and run on the HCL directly — cheap, no apply. **Policy engines (Sentinel/OPA)** let you write *enforced* org-specific rules against the plan with hard-mandatory levels that literally cannot be overridden. In a mature setup you run scanners on every PR as a fast gate and enforce Sentinel/OPA policies at apply time. This is the enforcement arm of everything in this topic — it stops the insecure resource from ever existing rather than finding it in a post-incident review.

### Q8. Walk me through encrypting the state backend. Is encryption enough?

Encrypt state at rest and in transit, and control who can read it. For S3:

```hcl
terraform {
  backend "s3" {
    bucket         = "my-tfstate-bucket"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true                    # SSE for the state object
    kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/abc"  # SSE-KMS
    dynamodb_table = "terraform-locks"
  }
}
```

`encrypt = true` gives server-side encryption; specifying a KMS key gives you **SSE-KMS** with an auditable, access-controlled key. Terraform Cloud encrypts state for you. TLS protects it in transit.

**Is encryption enough? No.** Encryption at rest protects against someone who gets the raw bytes from storage, but the far more common threat is **someone with legitimate-looking access reading the state through the API.** So you also need:
- **Tight IAM on the bucket/key** — only the Terraform execution roles can `GetObject`/`Decrypt` state; humans generally shouldn't.
- **Audit logging** — CloudTrail on state access so you know who read it.
- **Bucket hardening** — block public access, enforce TLS, enable versioning (recovery) and MFA-delete.

The senior point: encryption is table stakes; the real control is **access control plus audit** on the state backend, because state is a plaintext secrets store and a full map of your infra.

### Q9. What role does `.terraform.lock.hcl` play in security and supply chain?

The dependency lock file (`.terraform.lock.hcl`) pins **exact provider versions and their checksums**, and committing it is a supply-chain control, not just a reproducibility nicety.

```hcl
provider "registry.terraform.io/hashicorp/aws" {
  version     = "5.40.0"
  constraints = "~> 5.40"
  hashes = [
    "h1:....",              # checksums Terraform verifies on init
  ]
}
```

What it buys you:
- **Version pinning** — everyone (and CI) uses the *same* provider version; you don't silently pull a new release that changes behavior or introduces a vulnerability.
- **Checksum verification** — on `terraform init`, Terraform verifies the downloaded provider matches the recorded hashes. A **tampered or substituted provider** (a supply-chain attack on the registry or a mirror) fails verification instead of executing malicious code with your cloud credentials.
- **Deliberate upgrades** — you bump versions via `terraform init -upgrade` in a reviewed PR, so provider changes go through the same scrutiny as code.

The supply-chain framing matters because a malicious provider runs with **your Terraform credentials** — full cloud access. So you commit the lock file, pin module sources to specific versions/refs (git tags/commit SHAs, not `main`), and treat provider/module upgrades as reviewed changes. Combined with a trusted registry and checksums, the lock file is your defense against pulling and executing tampered infrastructure code.

### Q10. What are ephemeral resources and ephemeral values (1.10+), and what problem do they solve?

**Ephemeral resources and values** (Terraform 1.10+) are constructs whose values are used **during** a plan/apply but are **never written to state (or to the plan file).** They directly solve the "secrets always land in state" problem.

Normally, if you fetch a database password from Vault via a data source and pass it to a resource, that password is persisted in state in plaintext. An **ephemeral** data source / value exists only in memory for the duration of the run:

```hcl
ephemeral "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/db/password"
}
# reference ephemeral.aws_secretsmanager_secret_version.db.secret_string
# used at apply time, NOT stored in state
```

Ephemeral values can flow into **write-only arguments** on resources (also newer) so the secret is used to configure the resource without either the input or the resource attribute being persisted.

The problem solved: for genuinely high-sensitivity secrets, ephemerality means the secret **never rests in state at all** — so a leaked state file doesn't expose it. Before this feature, "secrets are always in state" was an unavoidable fact you mitigated only by locking down the backend. Ephemeral resources give you a way to keep specific secrets out of state entirely. It's the modern answer to "how do I use a secret without persisting it," and worth naming in a senior interview as the current best practice for the most sensitive values.

### Q11. How do you handle secret rotation when Terraform manages the secret?

It depends on *who owns* the rotation, and the clean answer usually keeps Terraform out of the rotation loop.

**If Terraform generates the secret** (e.g. `random_password`), rotating it means changing the resource so Terraform generates a new one — often via a `keepers` argument or a changed input that forces regeneration:
```hcl
resource "random_password" "db" {
  length  = 32
  keepers = { rotation = var.rotation_token }   # bump to force a new password
}
```
This works but couples rotation to a Terraform apply, and the new secret still lands in state.

**Better: let a dedicated system own rotation.** Cloud secret managers (AWS Secrets Manager) can **auto-rotate** secrets on a schedule with a Lambda; Vault issues **dynamic, short-lived credentials** that expire automatically. Terraform *provisions the rotation mechanism* (the secret manager, the rotation Lambda, the Vault role) but doesn't perform each rotation — so rotations happen out-of-band without a Terraform run, and don't churn state.

The senior instinct: **don't make Terraform the rotation engine.** Use it to set up auto-rotation or dynamic secrets, so credentials rotate frequently and automatically, are short-lived, and the long-lived plaintext-in-state exposure shrinks. Combine with ephemeral values so the fetched secret doesn't persist. Rotation that requires a human to run `terraform apply` is rotation that won't happen often enough.

### Q12. How can secrets leak through plan output in CI, and how do you prevent it?

Even with secrets sourced correctly, they can **leak into CI logs** through plan/apply output, which is often stored and sometimes world-readable (public repo Actions logs, shared CI dashboards).

Leak paths:
- A plan that shows a sensitive attribute changing prints the value unless it's marked sensitive.
- `terraform show -json` / `terraform plan -json` dumps the **full plan including sensitive values in cleartext** — teams pipe this to policy/cost tools and accidentally log it.
- An output or `local` that interpolates a secret without `sensitive = true`.

Prevention:
- **Mark sensitive variables/outputs `sensitive = true`** so rendered plan output shows `(sensitive value)`.
- **Never echo raw plan JSON to logs.** If you generate plan JSON for Conftest/Infracost, treat that file as secret — don't cat it, don't upload it as a public artifact.
- **Mask secret env vars** in the CI system so they're scrubbed from logs.
- **Restrict who can read CI logs**, especially for public repositories where Actions logs may be visible.

The nuance to state: `sensitive = true` fixes the *rendered human-readable* plan, but the `-json` output still contains the raw value — so the real control is treating plan JSON as sensitive and locking down log access. This is where the CI/CD and secrets topics meet: the pipeline must handle plan artifacts as carefully as it handles state.

### Q13. Why does audit logging of applies matter, and what should you capture?

Because Terraform applies **change production infrastructure with powerful credentials**, and when something breaks (or a security incident happens), the first questions are *who changed what, when, and with whose approval?* Without an audit trail you can't answer them — and you fail compliance (SOX, SOC2, PCI) requirements that demand traceable, approved infrastructure changes.

What to capture:
- **Who** initiated and who **approved** the apply (separation of duties — often different people).
- **What** changed — the plan that was applied, linked to the merged commit/PR.
- **When** — timestamps for plan, approval, and apply.
- **Against which state/environment** — which workspace/stack/env.
- **The cloud-side trail** — CloudTrail/audit logs of the actual API calls the execution role made, including **who read state** (state access is secret access).

Where it comes from:
- The **VCS + CI** give you the code/approval/merge trail (PR, reviewers, merge commit, pipeline run).
- **Terraform Cloud/Enterprise** has a built-in run history and audit log.
- The **cloud provider audit log** (CloudTrail) records the assumed-role actions.

The senior framing: audit is the reconstruction layer. Because Terraform is god-mode over your cloud and its state is a secrets store, you want an immutable record tying every infra change back to a reviewed, approved commit and an identifiable actor — for incident response and for the auditors.

### Q14. Someone pasted a `terraform.tfstate` file into a public Slack channel. Assess the blast radius.

Treat it as a **full compromise** and respond immediately, because a state file is two dangerous things at once:

**1. A plaintext secrets dump.** Every secret any managed resource holds is in there in cleartext — DB master passwords, generated private keys, access keys, tokens, any Vault/secret-manager values that were consumed. Assume **every secret in that state is now compromised.**

**2. A complete map of your infrastructure.** Resource IDs, ARNs, IP ranges, security group rules, bucket names, DNS, account IDs, architecture. That's a reconnaissance goldmine — an attacker now knows exactly what you run and how it's wired.

Response, in order:
- **Rotate every secret** referenced in that state — database passwords, keys, certs, tokens. Don't triage; rotate all of them.
- **Rotate/revoke any credentials** exposed and review IAM for anything the attacker could pivot on.
- **Delete the message and purge** where possible, but assume it was already captured/indexed — deletion is not remediation.
- **Review access logs** (CloudTrail) for suspicious activity against the exposed resources.
- **Post-mortem the process failure** — why did someone have local state they could paste, and why wasn't it in a locked-down encrypted backend? Fix the workflow so it can't recur.

The lesson the interviewer wants: a leaked state file is not "a config file got shared" — it's simultaneously a secrets breach and an infrastructure map, which is exactly why state must live only in an encrypted, access-controlled, audited backend and never on laptops or in chat.

### Q15. Design the end-to-end secrets and security posture for a Terraform-managed platform.

Layer it, because no single control is sufficient. A coherent posture:

**Identity (how Terraform authenticates):**
- **OIDC federation** in CI — short-lived credentials, no static keys anywhere.
- **Least-privilege, per-environment execution roles**; separate plan-read from apply-write; prod role unreachable from non-prod pipelines.

**Secrets (how sensitive values are handled):**
- **No secrets in Git** — `.gitignore` tfvars/tfstate, secret scanning (gitleaks) as a gate.
- **Source at runtime** from Vault / cloud secret managers; prefer **dynamic/auto-rotated** secrets.
- **Ephemeral resources/values (1.10+)** for the most sensitive secrets so they never touch state.
- **`sensitive = true`** on sensitive vars/outputs to keep them out of logs (knowing it doesn't secure state).

**State (the one place secrets rest):**
- **Encrypted backend (SSE-KMS)**, **tight IAM** on who can read state, **audit logging** (CloudTrail), versioning, block-public-access, locking.
- State split per env/stack to limit blast radius.

**Guardrails (blocking bad changes):**
- **tfsec/checkov** on every PR; **Sentinel/OPA** hard-mandatory policies at apply (no public buckets, no `0.0.0.0/0`, encryption required).
- **Pinned providers/modules** via committed `.terraform.lock.hcl` and version-pinned module sources (supply chain).

**Process (humans and audit):**
- Plan-in-PR / apply-on-merge with **separation of duties** on prod approvals.
- **Audit trail** linking every apply to a reviewed commit, an approver, and the cloud API log.

The through-line to state out loud: **secure state = secure secrets, and short-lived least-privilege identity = contained blast radius.** Everything above is defense-in-depth around those two facts, so that a single leaked file or credential is survivable rather than catastrophic.
## Terraform at Scale

### Summary

**What this topic covers**

How Terraform stops being a single `main.tf` and becomes a discipline for a whole organisation. The naive setup — one state file, one root module, one team — works until it doesn't: plans crawl, the blast radius is the entire estate, and every team blocks on the same state lock. This topic is about the structural decisions that keep Terraform sane at 50, 500, or 5000 resources across many teams: **splitting state by component and by environment**, wiring cross-state dependencies without coupling everything together, keeping the code DRY when you have dozens of near-identical roots, and drawing ownership boundaries so teams don't step on each other. The 15 questions here move from "why does one giant state file hurt" through the concrete patterns (state-per-component, `terraform_remote_state` vs data-source lookups, Terragrunt, internal module registries) up to the capstone: "design the Terraform layout for a 50-service org." This is the topic that separates someone who has *used* Terraform from someone who has *operated* it for other people.

**Mental model**

The organising principle at scale is **blast radius**: how much can one `terraform apply` break? A single state holding VPCs, databases, and every app service means one bad plan — or one stale lock — can touch all of it. So you decompose. Think of infrastructure as **layers stacked by rate-of-change and criticality**: a slow-moving networking/foundation layer at the bottom (VPCs, subnets, DNS zones, IAM) that changes monthly; a data layer (databases, buckets, queues) in the middle; and fast-moving application layers on top that deploy many times a day. Each layer gets its **own state file** so its lifecycle, its lock, and its blast radius are independent. Cross the seams, deliberately, with either `terraform_remote_state` (tight, read another state's outputs) or data-source/tag lookups (loose, discover by convention). Then multiply that grid by *environment* (dev/stage/prod), and the challenge becomes keeping all those near-identical roots DRY without copy-paste drift. The whole game is: small states, clear seams, shared modules, thin roots.

**Key terms**

- **State-per-component** — one state file per logical layer or service, not one monolith; the core scaling pattern.
- **Blast radius** — the set of resources a single apply can create/change/destroy; you shrink it by splitting state.
- **Layer / lifecycle boundary** — grouping resources by how often and how riskily they change (networking vs app).
- **`terraform_remote_state`** — a data source that reads another state's outputs; explicit, tight cross-state dependency.
- **Data-source / tag lookup** — discovering another team's resources by querying the cloud API (e.g. by tag/name) instead of reading their state; looser coupling.
- **Root module vs shared module** — a root is an applied unit (has a backend); a shared module is reusable logic with no backend, called by many thin roots.
- **Terragrunt** — a wrapper that generates backend/provider config and manages inter-state dependencies to keep many roots DRY.
- **Monorepo vs multi-repo** — all Terraform in one repo (path-based CI, discoverability) vs a repo per team/service (isolation, independent ownership).
- **Internal module registry** — a versioned catalogue of approved modules (Terraform Cloud, a git-tag convention, or an artefact registry).
- **Policy-as-code** — org-wide guardrails (Sentinel, OPA/Conftest) enforced in the pipeline: no public S3, mandatory tags, allowed instance sizes.
- **Ownership boundary** — which team owns (can apply) which state; usually mapped to CODEOWNERS + separate backends.
- **Code generation / DRY tooling** — Terragrunt, `for_each` over environment maps, or generators that stamp out per-env roots from one template.

**Why interviewers ask this**

Anyone can `terraform apply` a tutorial. The signal at senior/platform level is whether you've felt the pain of a shared monolith state and know the structural fixes. A junior answer optimises for "it works" — one state, workspaces for environments, done. A senior answer optimises for **safety and team throughput**: blast-radius-driven state splitting, explicit ownership, loose coupling between teams' states, DRY without magic, and policy guardrails so 50 engineers can't foot-gun prod. Interviewers use "design the layout for N services/teams" precisely because it has no single right answer — it forces you to reason about tradeoffs (coupling vs discoverability, DRY tooling vs added complexity) out loud. Getting the blast-radius framing out early signals you've operated Terraform, not just written it.

**Common confusions**

- "Just use workspaces for everything" — workspaces separate *state within one config*; they don't reduce blast radius across components and are a poor fit for strong prod/dev isolation. Directory-per-env is usually safer.
- "`terraform_remote_state` is always the right way to share values" — it hard-couples two states and exposes all outputs; data-source/tag lookups are often looser and more robust.
- "One big state is simpler" — simpler to start, catastrophic to operate: slow plans, giant blast radius, constant lock contention.
- "DRY means one giant module" — a mega-module is as coupled as a mega-state. DRY at scale is *many small modules* + thin roots, not one god module.
- "Splitting state means duplicating code" — no: split *state*, share *modules*. Thin roots call the same versioned modules.
- "Terragrunt is required at scale" — it's one good option; plenty of orgs scale with native `for_each`, a module registry, and disciplined CI instead.

**What follows from this topic**

Scaling decisions ripple into every other operational topic. State splitting sets up **Upgrades, Migration & Troubleshooting** (you upgrade and migrate states one component at a time, and cross-state dependencies complicate ordering). It sets up the **Scenario & Best-Practice Playbooks** capstone, where "design the repo for a multi-team org" and "split one monolith state into per-service states" are direct applications of the state-per-component pattern. The module-registry and policy-as-code threads connect to governance and to the modules topic. If the earlier state and backend topics were about *how Terraform tracks reality*, this topic is about *how you carve that reality up so an organisation can change it safely and in parallel*.

### Q1. Why doesn't one giant state file scale? What actually goes wrong?

Four concrete problems, all of which get worse with size:

- **Slow plans/applies** — every plan refreshes every resource against the provider API. A 5000-resource state means thousands of API calls on every `plan`, so a trivial change takes many minutes.
- **Huge blast radius** — one state holds everything, so one bad plan, a wrong `-target`, or a botched refactor can propose destroying unrelated critical infra. The failure domain is the whole estate.
- **Lock contention** — a remote backend serialises applies with a single lock per state. If networking, data, and every app team share one state, only one engineer across all teams can apply at a time; everyone else waits.
- **Coupled lifecycles** — a networking change and an app config change land in the same plan, so unrelated changes review together and fail together. You can't reason about "just the app" in isolation.

The fix is decomposition: split state by component and environment so each piece plans fast, locks independently, and has a bounded blast radius.

### Q2. How do you split state? What's the state-per-component pattern?

Carve infrastructure into **layers by lifecycle and criticality**, and give each its own state (its own backend key / root module):

```
infra/
  networking/    # VPC, subnets, TGW, DNS zones, core IAM — changes monthly
  data/          # RDS, S3, SQS, ElastiCache — changes weekly
  platform/      # EKS/GKE cluster, shared ingress — changes weekly
  services/
    payments/    # one state per service — changes daily
    checkout/
    search/
```

Each directory is a **root module** with its own backend configuration, so each has an independent state file and lock. The rule of thumb: **split along seams where the rate-of-change or the ownership differs**. Networking is stable and centrally owned; app services churn and are team-owned — so they must not share a state. Within very large estates you go further: per-service *and* per-environment states.

The tradeoff you're buying: more roots to manage and cross-state wiring to think about, in exchange for fast plans, small blast radius, and parallel team work.

### Q3. What's the driving principle behind where you draw state boundaries?

**Blast radius reduction.** Every boundary you draw answers "if this apply goes wrong, what's the worst it can destroy?" You want the answer to be "one bounded, owned thing," never "everything."

Concretely, put resources in the *same* state when they share a lifecycle and are applied together (a service and its own IAM role, its own security group). Put them in *different* states when:

- One is far more critical than the other (a shared prod database vs a stateless app).
- They change at very different rates (a VPC vs a deployment).
- Different teams own them.

A useful test: "would I be comfortable if a junior ran `apply` here at 5pm on a Friday?" If the state contains the core VPC *and* an app tweak, no — so split it, so the app root physically cannot propose touching the VPC.

### Q4. `terraform_remote_state` vs data-source/tag lookups for cross-state dependencies — when do you use each?

Two ways for state B to consume something from state A:

```hcl
# Option A: read A's state outputs directly (tight coupling)
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "acme-tfstate"
    key    = "networking/prod/terraform.tfstate"
    region = "us-east-1"
  }
}
# use: data.terraform_remote_state.network.outputs.vpc_id

# Option B: discover by tag via the provider (loose coupling)
data "aws_vpc" "main" {
  tags = { Name = "acme-prod", Layer = "networking" }
}
# use: data.aws_vpc.main.id
```

| | `terraform_remote_state` | data source / tag lookup |
|---|---|---|
| Coupling | Tight — B knows A's backend + output names | Loose — B queries the cloud by convention |
| Requires the output exist | Yes | No, discovers live resource |
| Exposes | *All* of A's outputs to B | Only what you query |
| Breaks if A restructures | Yes (backend/key/output rename) | No, as long as tags hold |
| Best for | Same team, closely related layers | Cross-team, or avoiding state dependencies |

**Rule of thumb:** within a team's own stack of layers, `terraform_remote_state` is fine and explicit. Across team boundaries, prefer tag/data-source lookups — you don't want to hard-wire another team's backend path (or leak their entire outputs) into your config, and a tag contract survives their internal refactors.

### Q5. Monorepo or multi-repo for Terraform?

Both work; pick by org shape.

| | Monorepo | Multi-repo |
|---|---|---|
| Discoverability | High — all infra in one place | Low — spread across repos |
| CI | Path-based (only plan changed dirs) | Per-repo, naturally isolated |
| Ownership | CODEOWNERS per path | Repo = ownership boundary |
| Blast radius of a bad merge | Wider (one repo) | Narrower |
| Cross-cutting change (bump a module everywhere) | One PR | Many PRs |
| Best for | Central platform team, strong CI | Autonomous teams, strict isolation |

Most platform teams start **monorepo** for discoverability and easy cross-cutting changes, with **path-based CI** (a change under `services/payments/` only plans that root) and CODEOWNERS mapping directories to teams. Very large or highly autonomous orgs go multi-repo so each team owns its pipeline and can't be blocked by another's. The state split (per-component) is independent of the repo split — you can have per-component states inside a monorepo.

### Q6. How do you keep things DRY across dozens of near-identical roots?

The anti-pattern is copy-pasting a root per environment and letting them drift. Three DRY strategies:

1. **Shared modules + thin roots** — all the logic lives in versioned modules; each root is ~20 lines: a backend block, a provider, and one module call with env-specific inputs. Environments differ only by `terraform.tfvars`.
2. **`for_each` over an environment/config map** — one config drives multiple near-identical resource sets from a map of settings, avoiding duplicate blocks.
3. **Terragrunt** — generates the backend and provider blocks and injects inputs so you don't repeat them per root; `include` pulls shared config down into each unit.

```hcl
# thin root: services/payments/prod/main.tf
module "payments" {
  source = "git::https://git.acme.com/tf-modules//service?ref=v2.3.0"
  name         = "payments"
  environment  = "prod"
  cpu          = 2048
  desired_count = 6
}
```

Whichever you pick, the invariant is: **duplicate configuration is a bug**. Environments should differ by *data* (tfvars), not by *copied code*.

### Q7. What is Terragrunt and what problem does it solve?

Terragrunt is a thin wrapper around Terraform that targets the DRY-and-dependencies pain of many roots. It does three main things:

- **Generates backend + provider config** — you define the S3 bucket/key pattern once in a root `terragrunt.hcl`; each unit's `include` inherits it, so no per-root backend boilerplate and no copy-paste key mistakes.
- **Manages inter-state dependencies** — a `dependency` block reads another unit's outputs and lets `terragrunt run-all apply` order applies correctly (networking before app) across many states.
- **Keeps inputs DRY** — common inputs defined once and merged into each unit.

```hcl
# services/payments/prod/terragrunt.hcl
include "root" { path = find_in_parent_folders() }
dependency "network" { config_path = "../../networking/prod" }
inputs = {
  vpc_id     = dependency.network.outputs.vpc_id
  subnet_ids = dependency.network.outputs.private_subnet_ids
}
```

It's popular but optional — native Terraform (`for_each`, modules, a module registry, disciplined CI) can achieve the same at the cost of more boilerplate. Interview framing: know *what problem it solves* (DRY backends + cross-state ordering) so you can say why you would or wouldn't reach for it.

### Q8. How do you handle ownership boundaries — who owns which state?

Map each state to exactly one owning team, and enforce it in three places:

- **Backend isolation** — each team's states live under a key prefix (or bucket) they control; IAM restricts who can even read/write that state and its lock table.
- **CODEOWNERS** — the directory owning a root requires that team's review to merge; a networking change can't be self-merged by an app engineer.
- **Apply permissions** — CI applies with a role scoped to that component; the payments pipeline can't touch the VPC even if the code tried.

The shared/foundation layers (networking, IAM, org policy) are owned by the **central platform team** and consumed read-only by everyone else (via outputs or tags). App teams own their service states end-to-end. The goal: for any resource, there's an unambiguous "this team applies this," and no team can apply into another's state. Ambiguous ownership is how you get two teams fighting over one state and drift nobody will own fixing.

### Q9. What naming, tagging, and labelling conventions matter at scale?

At one state it's cosmetic; at 50 services it's load-bearing — tags drive cost allocation, discovery (the data-source/tag lookup pattern), and incident triage.

Establish an **org-wide tagging standard** and enforce it with policy-as-code:

```hcl
# a shared "tags" module or provider default_tags
provider "aws" {
  default_tags {
    tags = {
      Environment = var.environment
      Team        = var.team
      Service     = var.service
      ManagedBy   = "terraform"
      Repo        = var.repo
    }
  }
}
```

Conventions to standardise: resource names (`{org}-{env}-{service}-{role}`), a mandatory tag set (Environment, Team, Service, CostCenter, ManagedBy), and state keys (`{layer}/{env}/terraform.tfstate`). Use `provider default_tags` (AWS) so every resource inherits tags without repetition, and a Sentinel/OPA rule that *fails the plan* if a mandatory tag is missing. Consistent tags are also what make cross-team data-source lookups reliable — if teams tag differently, discovery breaks.

### Q10. What does "layering by lifecycle" mean and why separate a networking layer from an app layer?

Because they change at completely different rates and with completely different risk. A VPC, its subnets, its route tables, and DNS zones might change a handful of times a year and, when they break, take down everything. An app service's task definition, count, and image change many times a day and, when they break, take down one service.

Putting them in the same state means:

- Every trivial app deploy plans against the whole networking layer (slow, and a chance to accidentally propose a network change).
- The networking lock is contended by high-frequency app applies.
- A network refactor's blast radius includes live apps.

Separating them gives the stable layer its own quiet state (rarely touched, tightly reviewed) and the churny layer its own fast state (applied constantly, small blast radius). The app layer consumes the network layer's outputs (VPC id, subnet ids) via remote state or tags — a one-directional dependency, stable at the bottom, churn at the top.

### Q11. With state split across components, how do you handle apply ordering?

Splitting introduces an **ordering dependency**: the app state needs the network state's outputs to exist, so networking must be applied first. Terraform's DAG only orders resources *within one state* — across states, ordering is your responsibility.

Options, roughly in order of sophistication:

- **Manual/documented order** — apply foundation → data → platform → services. Fine for a handful of layers; fragile as it grows.
- **CI pipeline stages** — the pipeline encodes the DAG: a networking change triggers networking apply, then downstream states re-plan. Dependencies expressed as pipeline job ordering.
- **Terragrunt `run-all`** — `dependency` blocks form a graph and `run-all apply` walks it in order automatically.

The consuming side should also **fail loudly if the dependency isn't there** — a `terraform_remote_state` read of a missing output errors clearly, which is better than silently applying against half-built infra. Don't try to make one apply span states; keep each apply single-state and order the *sequence* of applies outside Terraform.

### Q12. Plans are getting slow with thousands of resources. What can you do?

First, the structural fix: **you've outgrown the state — split it** (per-component). A single 3000-resource state is the root cause; smaller states plan in seconds.

Tactical mitigations while a plan is genuinely large:

```bash
# skip refresh when you know state matches reality (faster plan, but risks missing drift)
terraform plan -refresh=false

# scope a plan/apply to a subtree during an incident (a tool, not a habit)
terraform plan -target=module.payments

# increase provider parallelism cautiously (default 10)
terraform apply -parallelism=20
```

- **`-refresh=false`** skips the API round-trip per resource — big speedup, at the cost of not detecting drift that plan. Use knowingly.
- **`-target`** limits the graph to a subtree — legitimate for surgical incident work, but a habit-forming anti-pattern (it hides real diffs); if you *need* it routinely, split state instead.
- **`-parallelism`** raises concurrent resource ops but can hit provider/API rate limits.

The durable answer in an interview is always "these are band-aids; the fix is a smaller state." Reach for the flags to survive today, split state to fix tomorrow.

### Q13. How do you distribute reusable modules across many teams?

Stand up an **internal module registry** so teams consume *versioned, approved* modules instead of copy-pasting HCL. Options:

- **Terraform Cloud / Enterprise private registry** — first-class, versioned, browsable.
- **Git tags as the registry** — `source = "git::https://git.acme.com/tf-modules//vpc?ref=v1.4.0"`; simple, no extra infra, versioned by tag.
- **An artefact registry** (e.g. a package registry that supports Terraform modules).

Key practices: **pin every module to a version** (`?ref=v1.4.0`, never `main`) so a module change doesn't silently ripple into every consumer; **semver the modules** (breaking input change = major bump); ship a README + examples per module; and put shared "golden path" modules (a compliant VPC, a compliant service) behind the registry so teams get security/tagging/policy for free by using them. The registry is where governance meets DRY — one blessed module means one place to fix a security default for the whole org.

### Q14. How do you enforce governance and policy across an org's Terraform?

**Policy-as-code in the pipeline**, applied to the plan before apply. Tools: HashiCorp **Sentinel** (Terraform Cloud/Enterprise) or open-source **OPA/Conftest** against the plan JSON (`terraform show -json plan.out`).

Typical org-wide guardrails:

- No publicly-readable S3 buckets / no `0.0.0.0/0` on sensitive ports.
- Mandatory tags present (Team, CostCenter, Environment).
- Only approved instance types / regions.
- No hardcoded secrets in the plan; encryption enabled on data stores.

```bash
# in CI, after plan
terraform show -json plan.out > plan.json
conftest test plan.json --policy policies/
```

The pattern: the pipeline **fails the plan** if policy is violated, so a non-compliant change can't be applied regardless of what the author wrote. Combine with the module registry (golden-path modules pass policy by construction) and scoped apply roles (a pipeline physically can't create resources outside its remit). This is what lets a platform team say "yes, 200 engineers can write Terraform" without every PR being a manual security review.

### Q15. Design the Terraform layout for a 50-service, multi-team organisation.

Lead with the principle, then the structure. "My north star is **blast radius and team autonomy**: small states, clear ownership, shared golden-path modules, guardrails in CI."

**State layout — layered, per-component, per-env:**

```
foundation/   # org IAM, DNS, org policy   — platform team,  1 state per env
networking/   # VPC, subnets, TGW          — platform team,  1 state per env
data/         # shared DBs, buckets        — platform/data,  1 state per env
platform/     # EKS/GKE, ingress, obs      — platform team,  1 state per env
services/
  <svc>/<env>/  # one state per service per env — owned by the service team
```

**Cross-state wiring:** foundation/networking expose outputs consumed by upper layers — within the platform stack via `terraform_remote_state`, across to service teams via **tag/data-source lookups** (loose, survives refactors).

**DRY:** thin roots + a **private module registry** of versioned golden-path modules (compliant VPC, compliant service). Environments differ by tfvars only. Terragrunt optional for backend generation + `run-all` ordering.

**Collaboration:** monorepo with **path-based CI** and CODEOWNERS = ownership; each pipeline applies with a **scoped role** so it can't touch other components; **remote backend with locking** (S3+DynamoDB / TFC) per state.

**Governance:** **policy-as-code** (Sentinel/OPA) fails non-compliant plans; mandatory tagging via `default_tags`; every module pinned.

**Safe change:** PR → CI `plan` posted for review → gated `apply` on merge; prod applies require approval. Close with: "the point of all of it is that 50 services can change in parallel, safely, and no single apply can take down the estate."

## Upgrades, Migration & Troubleshooting

### Summary

**What this topic covers**

The operational reality of running Terraform past day one: things break, versions move, and infrastructure exists that Terraform didn't create. This topic is the toolbox for all three. **Debugging** — using `TF_LOG` to see what Terraform and the providers are actually doing, and decoding the handful of errors you'll hit repeatedly ("resource already exists," "Error acquiring the state lock," "provider produced inconsistent result," cycle errors). **Upgrades** — moving Terraform core and providers forward safely, one step at a time, honouring version constraints and the lock file. **Migration** — importing brownfield/click-created infrastructure into Terraform, moving state between backends, coming from other IaC tools, and the **OpenTofu** fork and what it means for your choices. And **recovery** — what to do when state is corrupted, lost, or half-applied. The 16 questions here are deliberately practical: an interviewer asking these wants to hear that you've been on call for Terraform, not just written greenfield configs. The through-line is *safe, reversible steps* — verify with a plan, change one thing, keep a backup.

**Mental model**

When Terraform misbehaves, reason in three layers. (1) **Config** — what you wrote. (2) **State** — Terraform's record of what it thinks exists. (3) **Real infrastructure** — what the provider API actually reports. Almost every error is a *mismatch between two of these layers*, and the fix is to figure out which two and reconcile them without touching the wrong one. "Resource already exists" = config wants to create something that reality already has, so state is missing it → **import**. "Provider produced inconsistent result" = state/plan disagrees with what the API returned → usually a provider bug or eventual consistency. Drift = state and reality diverged → refresh. State lock stuck = the lock outlived the process that held it → force-unlock. For upgrades, the mental model is **monotonic, one-step-at-a-time**: never jump versions, always read the upgrade guide, always keep the previous state backed up (a versioned backend does this for you). The cardinal rule underneath all of it: **never hand-edit `terraform.tfstate`** — use `import`, `state mv/rm`, `moved` blocks, and `-refresh-only` so Terraform stays the source of truth.

**Key terms**

- **`TF_LOG`** — env var enabling internal logs at TRACE/DEBUG/INFO/WARN/ERROR; `TF_LOG_PATH` sends them to a file.
- **`import` / import blocks** — adopt existing infrastructure into state; import blocks + `-generate-config-out` can scaffold the HCL.
- **`-generate-config-out`** — flag that writes starter HCL for imported resources so you don't hand-write config for click-created infra.
- **`required_version`** — a constraint pinning which Terraform core versions may run a config.
- **`.terraform.lock.hcl`** — the dependency lock file recording exact provider versions + checksums; committed to VCS.
- **`-upgrade`** — `terraform init -upgrade` re-resolves providers to the newest allowed by constraints and updates the lock file.
- **`-migrate-state`** — `terraform init -migrate-state` moves existing state to a newly-configured backend.
- **`terraform force-unlock <ID>`** — releases a stuck state lock; used carefully, only when you're sure no apply is running.
- **`-refresh-only`** — a plan/apply mode that reconciles state with reality without changing infrastructure.
- **OpenTofu** — the open-source (MPL) fork of Terraform created after HashiCorp's BSL relicense; near drop-in compatible.
- **BSL (Business Source License)** — the source-available licence HashiCorp moved Terraform to in 2023, triggering the fork.
- **Terraformer** — a third-party tool that bulk-imports existing cloud infra and generates HCL + state.
- **`terraform console`** — an interactive REPL for evaluating expressions/functions against your config and state.

**Why interviewers ask this**

Greenfield Terraform is easy; brownfield and breakage are where experience shows. A junior candidate has only ever run `apply` on configs they wrote and panics when state and reality disagree. A senior candidate has **imported a mess of click-ops infra, upgraded a provider across a breaking change, and recovered a corrupted state under pressure** — and can narrate the safe sequence for each. Interviewers probe here to check three things: do you *debug with evidence* (TF_LOG, plan output) rather than guessing; do you understand that **state is precious and never hand-edited**; and do you handle version/backend/tool migrations as careful, backed-up, one-step operations rather than big-bang leaps. The OpenTofu question additionally checks that you're current on the ecosystem. These questions reward calm, procedural answers.

**Common confusions**

- "Just delete and recreate it" — for stateful resources (databases, buckets) that's data loss; import or fix state instead.
- "Editing terraform.tfstate is fine if I'm careful" — it's the fastest way to corrupt state; use `state` subcommands and `import`.
- "`force-unlock` fixes lock errors" — only when no apply is actually running; force-unlocking a live apply causes concurrent writes and corruption.
- "Upgrading Terraform will rewrite my resources" — core upgrades update the *state format*, not your infra; the plan should be empty.
- "OpenTofu and Terraform are incompatible" — they're near drop-in; state and providers are compatible today, migration is essentially swapping the binary.
- "The lock file is optional/ignorable" — `.terraform.lock.hcl` is what makes provider versions reproducible across a team and CI; commit it.
- "Import writes the config for me" — plain `import` only adds to *state*; you still need matching HCL (or use `-generate-config-out`).

**What follows from this topic**

This is the operational backbone the capstone builds on. **Scenario & Best-Practice Playbooks** reuses nearly every technique here — "reconcile console drift," "the state lock is stuck," "adopt click-created infra," "recover a lost state" are the same procedures framed as scenarios. The import and `moved`-block skills connect back to refactoring and to **Terraform at Scale** (you split a monolith state by moving resources between states, and you upgrade each split state independently). Debugging with `TF_LOG` and `terraform console` underpins troubleshooting anywhere. If the earlier topics taught you how Terraform *should* work, this one teaches you what to do the many times it doesn't — which is most of the job on a real platform team.

### Q1. How do you debug Terraform with TF_LOG?

`TF_LOG` turns on Terraform's internal logging so you can see what it and the providers are actually doing — including the raw provider API requests/responses, which is how you diagnose "why does it think this needs to change."

```bash
export TF_LOG=DEBUG          # TRACE|DEBUG|INFO|WARN|ERROR
export TF_LOG_PATH=./tf.log  # write to a file instead of stderr
terraform plan
```

Levels, most to least verbose: **TRACE** (everything, including HTTP wire), **DEBUG** (very useful — provider API calls, graph decisions), **INFO**, **WARN**, **ERROR**. Start at DEBUG; drop to TRACE only when chasing a provider-level mystery (TRACE is a firehose).

What you use it for: seeing the exact API call a provider makes (to understand a permissions error or an unexpected diff), confirming which backend/credentials are in play, and understanding graph/ordering decisions. Split provider vs core logging with `TF_LOG_PROVIDER` and `TF_LOG_CORE` when you need to isolate one. Always send it to `TF_LOG_PATH` for anything non-trivial — the output is huge and you'll want to grep it.

### Q2. Walk through the common Terraform errors and how you fix each.

- **"resource already exists" / 409 on create** — config wants to create something reality already has, but state doesn't know about it. Fix: **`terraform import`** (or an import block) to bring it under management, then plan to confirm no diff.
- **"Error acquiring the state lock"** — a previous apply (often a crashed CI job) left the lock held. Confirm nothing is running, then **`terraform force-unlock <LOCK_ID>`**. Never force-unlock a live apply.
- **"Provider produced inconsistent result after apply"** — the provider returned something different from the plan; usually a provider bug or eventual consistency. Re-run apply (often converges); check the provider's issue tracker; pin/upgrade the provider.
- **"Cycle: A → B → A"** — a dependency cycle in the graph, often from resources referencing each other. Break it by splitting a resource, using a `depends_on` restructure, or moving one side to a data source. `terraform graph` helps visualise.
- **"Saved plan is stale"** — you applied a `-out` plan after state changed underneath it. Re-run `plan` to generate a fresh plan; don't reuse an old plan file.

The meta-approach: read the actual error, decide which of config/state/reality disagree, and reconcile the right pair.

### Q3. How do you upgrade Terraform core safely?

Treat it as a **monotonic, one-minor-at-a-time** operation, backed by version constraints.

```hcl
terraform {
  required_version = ">= 1.6.0, < 2.0.0"
}
```

Steps: read the changelog/upgrade guide for the target version; bump one minor at a time (1.5 → 1.6 → 1.7), not a big leap; run `terraform init`, then `terraform plan` and confirm it's **empty** (a core upgrade changes the *state format*, not your resources — a non-empty plan means something else is up); commit; roll it out to CI and the team so everyone's on the same version. Since **Terraform 1.0**, the 1.x line carries a compatibility promise — configs and state are forward-compatible across 1.x minors, so upgrades are low-drama. The bigger historical jumps were **0.11 → 0.12** (HCL2, expression syntax) and **0.13/0.14** state-format changes, which needed dedicated upgrade tooling. Pin `required_version` so a teammate on a wildly different version can't apply and rewrite state format under everyone.

### Q4. How do you upgrade providers, and how does the lock file fit in?

Providers move independently of core and are where **breaking changes actually bite** (renamed attributes, changed defaults). Pin them and upgrade deliberately.

```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.30" }
  }
}
```

```bash
terraform init -upgrade   # re-resolve to newest allowed, update .terraform.lock.hcl
```

`.terraform.lock.hcl` records the **exact** provider versions and checksums; commit it so the team and CI use identical providers (reproducible plans). To upgrade: read the provider's **upgrade guide** for breaking changes, widen the constraint, run `init -upgrade`, then `plan` and scrutinise the diff — a provider bump can surface new required attributes or reordered defaults. Provider **state schema migrations happen automatically** on first use of a new version (the provider upgrades how it stores its resources in state), so you don't migrate manually — but you *do* want to review the plan and read the guide, because a major version bump (e.g. AWS 4 → 5) can require config changes.

### Q5. How do you import existing/brownfield infrastructure into Terraform?

For infra created by hand/ClickOps or another tool, adopt it with **import blocks** (Terraform 1.5+), which can also scaffold the config:

```hcl
import {
  to = aws_s3_bucket.logs
  id = "acme-prod-logs"
}
```

```bash
terraform plan -generate-config-out=generated.tf   # writes starter HCL for imported resources
terraform apply                                     # brings them into state
```

`-generate-config-out` writes a first draft of the HCL so you don't hand-write config for click-created resources — then you clean it up (remove computed fields, parameterise). The **iterative workflow** is: add an import block → `plan` and generate/adjust config → fix the HCL until `plan` shows **no changes** → apply. "No changes" is the goal: it proves your config exactly matches reality. For a handful of resources, the older imperative `terraform import <addr> <id>` works too, but you write the config yourself. For bulk adoption of a whole account, reach for **Terraformer** (below). Golden rule: never let import *change* the resource — get to a zero-diff plan first.

### Q6. How do you migrate state between backends (e.g. local → remote)?

Reconfigure the backend block, then let Terraform move the state for you — never copy the file by hand.

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-tfstate"
    key            = "networking/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acme-tf-locks"
  }
}
```

```bash
terraform init -migrate-state   # detects the backend change, offers to copy existing state over
```

`terraform init -migrate-state` sees that the configured backend changed, prompts "do you want to copy existing state to the new backend?", and moves it. Before running it: **back up the current state** (`cp terraform.tfstate terraform.tfstate.bak` for local, or note the versioned backend's current version), and make sure the target bucket/table exist. After migrating, run `plan` to confirm no diff. Use `-reconfigure` instead of `-migrate-state` only when you deliberately want to *ignore* existing state and start fresh against the new backend (rare, and dangerous if you mean to keep it). Same procedure moves remote → remote (e.g. re-homing a state to a new bucket).

### Q7. How do you migrate from CloudFormation (or other IaC) to Terraform?

You don't translate templates line-by-line — you **import the live resources** CloudFormation created and describe them in Terraform, then hand ownership over.

Approach: enumerate the real resources (a CloudFormation stack's outputs/resource list), write matching Terraform (or generate it), and `import` each into Terraform state until `plan` is clean. Tools speed this up: **former2** generates Terraform (and CloudFormation) from existing AWS resources by inspecting the account; **Terraformer** bulk-imports and writes HCL + state. Once Terraform manages the resources with a zero-diff plan, **stop managing them in CloudFormation** — the critical step is avoiding two tools owning the same resource (delete the CFN stack with retain policies, or set resources to `Retain` and remove the stack). Do it component-by-component, not all at once, and keep the old tool authoritative until the Terraform side proves a clean plan. The same pattern applies coming from Pulumi, ARM templates, or ClickOps.

### Q8. Explain the OpenTofu split. How does it affect your choices?

In **2023 HashiCorp relicensed Terraform** from the MPL open-source licence to the **Business Source License (BSL)** — source-available but restricting competing commercial use. In response the community **forked the last MPL version into OpenTofu** (now under the Linux Foundation, MPL-licensed).

What matters practically:

- **Compatibility is near drop-in** — OpenTofu forked from Terraform and stays highly compatible; **state and providers are compatible**, HCL is the same, and migration is essentially swapping the `terraform` binary for `tofu`.
- **They're diverging slowly** — OpenTofu has shipped some features independently (e.g. state encryption, early `for_each` in some places), and the two will drift over time, so "100% identical" won't hold forever.
- **Choosing** — pick **OpenTofu** if you want a truly open-source licence and community governance (and to avoid BSL restrictions); stay on **Terraform** if you rely on HashiCorp's ecosystem (Terraform Cloud/Enterprise, Sentinel) or want vendor support. Either way, **pin providers and versions** and don't mix the two tools against one state.

Interview-wise: know *why* the fork happened (BSL), that it's *near drop-in*, and how you'd migrate (swap the binary, re-run init, verify a clean plan).

### Q9. How do you recover from a corrupted or lost state file?

Stay calm and reconstruct — do not start hand-editing or blindly re-applying.

- **Restore from a versioned backend** — S3 with versioning (or TFC's state history) keeps every prior state. Roll back to the last-good version: download the previous object version and restore it, or use the backend's history UI. This is why remote backends must have versioning on — it's your undo button.
- **Restore from the local backup** — Terraform writes `terraform.tfstate.backup` after operations; for local state that's your immediate fallback.
- **Rebuild via import** — if state is truly gone and there's no backup, the infra still exists in the cloud. Recreate the config and **`import` each resource back into a fresh state** until `plan` is clean. Tedious but reliable, and Terraformer can bulk it.

Prevention is the real answer: **versioned, locked remote backend** so corruption is a one-command rollback and concurrent writes can't happen. Never `state rm`/edit under pressure without a backup first (`terraform state pull > state.bak`).

### Q10. What do "resource already exists" and cycle errors specifically tell you?

They diagnose *which layers disagree*:

- **"Resource already exists" (409 on create)** — config + reality both have the resource, but **state doesn't**. Terraform tried to create it and the provider rejected it as a duplicate. Never delete the real resource to "fix" the create — **import** it so state catches up, then plan to zero diff.
- **Cycle error** — a **dependency loop in the graph**: A depends on B which depends on A. Terraform can't order the apply. Common causes: two resources referencing each other's ids, or a bad `depends_on`. Fixes: break the loop by introducing a data source for one side, restructuring which resource holds the reference, or splitting a resource. `terraform graph | dot -Tsvg` visualises the cycle so you can see the edge to cut.

Both reward the same instinct: read the error as a statement about config vs state vs reality, and reconcile the specific mismatch rather than reaching for destroy/recreate.

### Q11. The state lock is stuck after a crashed CI run. What do you do?

Diagnose before you unlock. The error names the lock ID, who/what held it, and when.

```
Error acquiring the state lock
  Lock Info:
    ID:        7f3c...
    Who:       ci-runner@build-1234
    Created:   2026-07-01 14:02:11
```

Steps:

1. **Confirm no apply is genuinely running** — check the CI job that created the lock (build-1234); if it crashed/was cancelled, the lock is orphaned. If it's *still running*, wait — do not unlock.
2. **Force-unlock with the exact ID:**
   ```bash
   terraform force-unlock 7f3c...
   ```
3. Re-run the plan/apply.

The danger: force-unlocking a lock that a live apply still holds lets two applies write state concurrently → corruption. So the whole answer hinges on *verifying the holder is dead first*. Preventatively, CI should release locks on cancellation and use reasonable timeouts. A DynamoDB (or equivalent) lock table with the crashed run's stale entry is exactly what `force-unlock` clears.

### Q12. How do you handle provider deprecation warnings and breaking changes?

Deprecations are early warnings — treat them as scheduled work, not noise. When `plan` prints "argument X is deprecated, use Y," open a ticket and migrate before the attribute is removed in the next major.

Process for a provider **major** bump (where breaking changes live): read the provider's **upgrade guide** (they publish a per-major migration doc listing renamed/removed attributes and default changes); update config to the new attributes; widen the constraint and `init -upgrade`; then `plan` and read every line — a major bump can surface newly-required fields, changed defaults that show as diffs, or resources that now want replacement. Apply in a non-prod env first. Because provider **state schema migrations run automatically**, the *state* upgrades itself, but your *config* must be updated by hand to match the new schema. Pin with `~>` so you get patches automatically but never cross a major unintentionally, and keep `.terraform.lock.hcl` committed so the whole team crosses the version together.

### Q13. An apply failed halfway and left partial state. How do you recover?

Accept the core reality: **a plan is a proposal, but apply is not transactional** — it can fail mid-graph, leaving some resources created and recorded in state and others not. There's no automatic rollback.

Steps:

1. **Read the error** — which resource failed and why (permissions, quota, a bad value). Terraform already wrote the successfully-created resources to state, so you won't re-create them.
2. **Fix the root cause** — correct the config, raise the quota, fix the credential.
3. **Re-run `plan`** — it now shows only the *remaining* work (Terraform reconciles what already exists against desired state). Apply again to converge.
4. If a resource was created but *not* recorded (rare, e.g. crash between create and state write), you'll hit "already exists" → **import** it.

Don't destroy everything and start over for stateful resources. Terraform is designed to be re-run: it's declarative, so a second apply picks up where the first left off. Partial applies are normal operationally — the recovery is "fix and re-apply," backed by a versioned state so you can inspect what was recorded.

### Q14. What is `terraform console` and when do you use it?

An interactive REPL for evaluating expressions, functions, and references against your **current config and state** — the fastest way to debug "what will this expression actually produce?"

```bash
terraform console
> var.environment
"prod"
> [for s in var.subnets : s.cidr if s.public]
["10.0.1.0/24", "10.0.2.0/24"]
> cidrsubnet("10.0.0.0/16", 8, 3)
"10.0.3.0/24"
> aws_instance.web[0].private_ip
"10.0.1.42"
```

Use it to: test a `for` expression or `cidrsubnet`/`lookup`/`merge` call before wiring it into config; inspect what a resource attribute or module output currently holds in state; and sanity-check variable values. It reads state, so it can show live attribute values, and it evaluates functions exactly as Terraform would — no guessing at function behaviour. It's read-only (it won't change state or infra), which makes it a safe scratchpad during a debugging session or an interview whiteboard for "how would you compute this."

### Q15. How do you bulk-import an entire account's worth of click-created infra?

Hand-importing hundreds of resources is impractical, so use a bulk tool and then take ownership properly.

- **Terraformer** — scans a cloud account/provider, generates HCL, *and* writes a matching state file for whole resource types at once (`terraformer import aws --resources=vpc,subnet,sg`). It gets you 80% there fast.
- **Import blocks + `-generate-config-out`** — for a controlled subset, generate config for each resource and iterate to a clean plan.

Then the real work: the generated HCL is verbose and literal (hardcoded ids, computed fields), so you **refactor it** — parameterise, extract modules, remove read-only attributes — while keeping `plan` at zero diff after each change. Do it **component by component** (import networking, prove clean, then data, then apps), not the whole account in one commit. Guard the transition: until the Terraform plan is clean, the resources are still effectively ClickOps-owned; only once Terraform shows no drift do you declare it authoritative and stop touching the console. This is the practical bridge from a brownfield account to the state-per-component layout from the scaling topic.

### Q16. How do you diagnose an unexpected diff — plan wants to change something you didn't touch?

Systematic elimination across config / state / reality:

1. **Read the diff carefully** — Terraform prints old → new for each attribute. Identify *which* attribute is changing; often it's one field, not the whole resource.
2. **Is it drift?** — someone changed it in the console. `terraform plan` refreshes first, so a diff can mean reality moved. Confirm with `-refresh-only` (shows state-vs-reality without proposing config changes).
3. **Is it a provider default/upgrade?** — a provider version bump can add or reorder defaults, showing as a spurious diff. Check whether you recently `init -upgrade`d and read the provider's upgrade guide.
4. **Is it a computed/normalised value?** — some providers normalise input (case, ordering), producing perpetual diffs; the fix is matching the provider's canonical form or `ignore_changes` for genuinely provider-managed fields.
5. **Use `TF_LOG=DEBUG`** to see the exact API response the provider compared against — this reveals whether the drift is real or a provider quirk.

Decide the response based on which layer moved: config change you intended (apply), drift to revert (apply to overwrite) or adopt (`-refresh-only` / `ignore_changes`), or a provider artefact (pin/adjust config). The discipline is *never apply an unexpected diff you can't explain* — plan is a proposal you review first.

## Scenario & Best-Practice Playbooks

### Summary

**What this topic covers**

The capstone: open-ended "design this / debug this / spot the anti-pattern" questions that combine everything from the earlier topics into realistic interview scenarios. There are two flavours here. **Design scenarios** — "structure a Terraform repo for a multi-team, multi-env org," "design a reusable VPC module," "set a new team up from scratch," "manage three environments DRY-ly" — where the interviewer wants an architecture and the reasoning behind it. **Operational/debug scenarios** — "someone changed a resource in the console, reconcile the drift," "the plan wants to destroy the prod database," "the state lock is stuck," "rename a resource into a module without downtime," "a junior committed AWS keys," "review this risky plan" — where they want an exact sequence of commands and decisions. The 17 questions here don't introduce new Terraform features; they test whether you can *apply* them under realistic pressure and whether you instinctively reach for the safe path. Throughout, the answers give concrete command/HCL sequences and name the anti-patterns explicitly, because half of what an interviewer is checking is whether you recognise a bad setup when you see one.

**Mental model**

Approach every scenario from three anchors, in this order. (1) **Blast radius** — what's the worst this change/design could destroy, and how do I bound it? This drives state layout in design questions and caution in debug questions. (2) **State layout** — where does the truth live, who owns it, and is it split so this operation is isolated? (3) **The safe-change workflow** — `plan → review → apply`, never surprise prod. Every operational answer is some version of: look before you leap (`plan`, `-refresh-only`, or `console` to *see* the current reality), decide the intent (revert vs adopt, replace vs protect, unlock vs wait), then make the smallest reversible change, with a backup if state is involved. For design questions, the reflex is: layers + state-per-component + shared versioned modules + per-env thin roots + remote locked backend + CI-gated apply + policy-as-code. If you can articulate *why* each piece exists (and which anti-pattern it prevents), you're answering like a platform engineer, not a tutorial-follower.

**Key terms**

- **Drift reconciliation** — bringing state and reality back in sync after an out-of-band change; revert, adopt, or ignore.
- **`-refresh-only`** — update state to match reality without changing infrastructure; the safe way to *adopt* drift.
- **`prevent_destroy`** — a `lifecycle` flag that makes Terraform error rather than destroy a resource; guardrail for prod data stores.
- **`create_before_destroy`** — replace by standing up the new resource before tearing down the old; avoids downtime on replacement.
- **`moved` block** — refactor a resource's address (rename, move into a module) with no destroy/recreate.
- **`import` block** — adopt existing/click-created infra into state without recreating it.
- **`ignore_changes`** — tolerate specific attributes being managed outside Terraform.
- **Replacement (destroy/recreate)** — when a change to an immutable attribute forces Terraform to delete and re-make a resource; the diff shows `-/+`.
- **Risky-plan review** — scanning a plan for destroys, replacements, secret diffs, and count/index shifts before approving.
- **Anti-pattern** — hardcoded secrets, no state locking, one giant state, unpinned modules, habitual `-target`, manual state edits, ClickOps.
- **CI-gated apply** — plan runs on PR for review; apply only runs post-merge (prod behind approval).
- **State-per-component** — one state per layer/service to bound blast radius; the backbone of every design answer.

**Why interviewers ask this**

This is where they find out if you can operate. Feature-recall questions ("what is `for_each`") have clean answers; scenarios don't, and that's the point — they reveal *judgement*. A junior will say "I'd just re-apply" or "delete and recreate it," blind to data loss and blast radius. A senior narrates: "first I `plan` to see the diff, I check whether this is drift or intended, I confirm the state has a backup, I decide revert-vs-adopt, and I never apply a destroy of a stateful prod resource without `prevent_destroy` and a human in the loop." The scenarios also test **anti-pattern recognition** — handed a plan that destroys a database or a config with hardcoded keys, do you flag it? Interviewers weight these heavily because they map directly to on-call reality: the person who reaches for the safe, reversible, plan-first path is the person you trust with prod. Confident, procedural, blast-radius-first answers win.

**Common confusions**

- "Re-apply to fix drift" — sometimes right (revert), sometimes wrong (you'll clobber a legitimate emergency change); *first see the diff, then decide*.
- "Replacement and update are the same" — a `-/+` replace destroys and recreates; on a database that's data loss. Read the plan symbols.
- "`-target` is a normal tool" — it's an incident scalpel; habitual use hides real diffs and signals a state that should be split.
- "Deleting the resource from config removes it safely" — it schedules a *destroy*; for stateful resources that's data loss unless you `state rm` (to just forget it) intentionally.
- "Committed AWS keys are fine once removed from the file" — they're in git history and must be **rotated**, not just deleted.
- "A moved block recreates the resource" — the opposite: `moved` preserves the resource and only updates its address in state.
- "An empty-looking plan is safe to auto-approve" — scan for replacements and count-shifts; a one-line config change can trigger a fleet replacement.

**What follows from this topic**

Nothing follows — this is the synthesis. It pulls state and backends into the drift/recovery scenarios, `lifecycle` and `moved`/`import` into the refactor/protect scenarios, the module and provider topics into the design scenarios, **Terraform at Scale** into every "design for N teams" answer, and **Upgrades, Migration & Troubleshooting** into every debug sequence. If you can handle these questions, you can handle the primer's whole scope applied to a real problem. The best way to use this topic is as a rehearsal: for each scenario, practise saying the *first move* out loud ("I'd start with a `plan`/`-refresh-only` to see reality") and the *safe sequence* after it — because in the interview, the calm, ordered, blast-radius-first walkthrough is the entire signal.

### Q1. Design a Terraform repo and module structure for a multi-team, multi-env organisation.

Lead with principles, then structure. "I optimise for **bounded blast radius, clear ownership, and DRY without copy-paste**."

**Layout — layers as state-per-component, environments as thin roots:**

```
modules/                 # shared, versioned, reusable (vpc, service, db)
live/
  networking/{dev,stage,prod}/   # one state each — platform team
  data/{dev,stage,prod}/         # one state each — data team
  services/
    payments/{dev,stage,prod}/   # one state each — payments team
    checkout/{dev,stage,prod}/
```

**The pieces and why each exists:**

- **Shared modules** (versioned, in a registry) — DRY logic; a `service` module encodes tagging/policy so teams get the golden path for free.
- **Thin per-env roots** — each is ~20 lines: backend + provider + one module call + env tfvars. Environments differ by *data*, not copied code.
- **State-per-component** — bounds blast radius; payments prod can't touch the VPC.
- **Remote backend + locking** (S3+DynamoDB or TFC) per state — team collaboration, no concurrent applies.
- **CI**: path-based `plan` on PR for review, gated `apply` on merge, prod behind approval.
- **Ownership**: CODEOWNERS per path, scoped apply roles per component.
- **Guardrails**: policy-as-code fails non-compliant plans; every module pinned.

Close: "the whole structure exists so many teams change infra in parallel, safely, and no apply can take down the estate."

### Q2. How do you structure state to minimise blast radius?

Split state along **rate-of-change and ownership seams**, so any single apply touches one bounded, owned thing.

Concretely, one state each for: the foundation/networking layer (stable, platform-owned), the data layer (databases/buckets — highest criticality, isolated), the platform layer (clusters/ingress), and **one state per service per environment** on top. The test for a seam: "would I be nervous if a junior applied here on a Friday?" If the state mixes the core VPC with an app tweak, split it so the app root *physically cannot* propose a network change.

Reinforce the boundary beyond just separate files:

- **Scoped apply roles** — the payments pipeline's credentials can't create/destroy outside payments.
- **`prevent_destroy`** on the crown-jewel resources (prod DB) so even within a state, a destroy errors.
- **Loose cross-state coupling** — upper layers read lower layers by tag/data-source, not by hard-wiring another team's state.

The principle in one line: blast radius = the resources one apply can destroy; you shrink it by splitting state, scoping credentials, and protecting stateful resources.

### Q3. How would you manage three environments (dev/stage/prod) DRY-ly?

**Directory-per-environment with shared modules** — not workspaces, for real prod isolation.

```
modules/service/                 # the logic, versioned
live/services/payments/
  dev/    { main.tf, dev.tfvars }
  stage/  { main.tf, stage.tfvars }
  prod/   { main.tf, prod.tfvars }
```

Each env's `main.tf` is a thin root calling the *same* module version; they differ only by tfvars (sizes, counts, flags) and their backend key. DRY comes from the shared module, isolation from separate states + separate backends + separate credentials.

Why not workspaces? Workspaces share one backend and one config, so a fat-fingered `apply` in the "prod" workspace uses the same code path as dev, and blast-radius/credential isolation is weak. Directory-per-env gives each environment its **own state, own lock, own IAM**, and lets prod pin an older, proven module version while dev tries a new one.

If the per-env boilerplate grows, add **Terragrunt** to generate backend/provider blocks — but the DRY invariant is unchanged: environments differ by *data*, never by copied logic.

### Q4. Set up Terraform for a new team from scratch — what do you stand up?

Bootstrap in this order:

1. **Remote backend with locking** — create the state bucket (versioning + encryption on) and lock table *first*; version-controlled `backend "s3"` config. Versioning is the team's undo button.
2. **Provider pinning + lock file** — `required_version`, `required_providers` with `~>` constraints, commit `.terraform.lock.hcl`.
3. **Repo + state layout** — layers as state-per-component, thin per-env roots (per Q1). Even a small team starts split so it scales.
4. **Shared modules** — pull the org's golden-path modules from the registry (compliant VPC/service) rather than hand-rolling.
5. **CI/CD** — PR runs `plan` (posted for review), merge runs gated `apply`; prod behind approval; apply uses a **scoped role**, not a human's long-lived keys (prefer OIDC).
6. **Policy-as-code** — wire the org's Sentinel/OPA checks so non-compliant plans fail.
7. **Conventions** — tagging standard (`default_tags`), naming, and a README documenting the workflow.

The message: safety rails (backend, locking, pinning, CI-gated apply, policy) come *before* the first resource, so the team never operates without them.

### Q5. Design a reusable VPC module.

A good module has a clear interface, sane defaults, useful outputs, and no environment assumptions baked in.

```hcl
# modules/vpc/variables.tf
variable "name"        { type = string }
variable "cidr_block"  { type = string }
variable "azs"         { type = list(string) }
variable "environment" { type = string }
variable "tags"        { type = map(string), default = {} }

# modules/vpc/main.tf
resource "aws_vpc" "this" {
  cidr_block = var.cidr_block
  tags       = merge(var.tags, { Name = var.name, ManagedBy = "terraform" })
}
resource "aws_subnet" "public" {
  for_each          = { for i, az in var.azs : az => i }   # for_each, not count → stable keys
  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.cidr_block, 8, each.value)
}

# modules/vpc/outputs.tf
output "vpc_id"             { value = aws_vpc.this.id }
output "public_subnet_ids"  { value = [for s in aws_subnet.public : s.id] }
```

Design principles to call out: **inputs for everything that varies** (CIDR, AZs, tags) with sensible defaults; **`for_each` over `count`** for subnets so removing an AZ doesn't shift every index; **outputs for anything a consumer needs** (ids, CIDRs) so upper layers wire in via remote-state/tags; **no hardcoded region/account/env** — pass them in; **tag merging** so callers can add tags. Version it (`?ref=v1.2.0`), document inputs/outputs, ship an example. The module encodes the org's opinions once so every team's VPC is compliant by construction.

### Q6. Someone changed a resource in the AWS console. Walk me through reconciling the drift safely.

**See first, decide second, apply last.** Never blindly re-apply.

1. **See the drift** — `terraform plan` (it refreshes, so it shows state-vs-reality), or `terraform plan -refresh-only` to view drift *without* mixing in config changes. Now you know exactly what changed.
   ```bash
   terraform plan -refresh-only
   ```
2. **Decide intent** — was the console change a mistake or a legitimate emergency fix?
   - **Revert it** (change was wrong): run a normal `terraform apply` — Terraform overwrites reality back to what config says.
   - **Adopt it** (change was correct and should persist): update the *config* to match, then `terraform apply -refresh-only` to sync state without changing infra.
   - **Tolerate it** (an attribute is legitimately managed outside TF, e.g. an autoscaler): add `lifecycle { ignore_changes = [desired_count] }` so future plans stop flagging it.
3. **Apply the chosen path**, then re-plan to confirm zero diff.

The senior signal is refusing to auto-revert: an out-of-band change might be a live incident fix, so you *look at the diff and decide* before overwriting. And the durable fix is prevention — tighten console access so ClickOps drift stops happening.

### Q7. `terraform plan` wants to destroy and recreate the prod database. What do you do?

**Stop.** A `-/+` (destroy-and-recreate) on a database is data loss. Do not apply.

1. **Understand *why* it's replacing** — the plan names the "forces replacement" attribute. Some property (engine version, name, subnet group, an immutable field) changed, and that field can't be updated in place, so Terraform proposes replacement.
2. **Decide if replacement is acceptable** — for a stateless resource, maybe. For a prod DB, almost never without a migration plan.
3. **Prevent the accident** — put a guard on the resource so this can't happen by surprise:
   ```hcl
   lifecycle {
     prevent_destroy = true   # apply errors instead of destroying
   }
   ```
4. **Fix the root cause** — revert the config change that forced replacement, or find the in-place path (e.g. an engine upgrade done through the provider's update, a snapshot-and-restore migration, or `ignore_changes` on the field if it's provider-managed).
5. If replacement is *genuinely* required, plan a real migration (snapshot, `create_before_destroy` where the resource supports it, cutover window) — never a naked destroy.

The interview point: read plan symbols (`-/+` = replace), treat prod stateful replacement as an incident, and use `prevent_destroy` as the standing guardrail.

### Q8. The state lock is stuck after a crashed CI run. Fix it.

Verify the holder is dead, *then* unlock — force-unlocking a live apply corrupts state.

```
Error acquiring the state lock
  ID:   7f3c9a...
  Who:  ci@build-1234
```

1. **Check the run that took the lock** (build-1234). Crashed or cancelled → the lock is orphaned. Still running → **wait**, do not touch it.
2. **Force-unlock with the exact ID:**
   ```bash
   terraform force-unlock 7f3c9a...
   ```
3. Re-run the pipeline.

Then prevent recurrence: CI should release the lock on job cancellation, set sensible timeouts, and avoid two pipelines targeting the same state. The whole safety of this operation rests on step 1 — confirming no apply is actually holding the lock — because two concurrent state writes are exactly what the lock exists to prevent.

### Q9. Rename a resource / move it into a module without downtime.

Use a **`moved` block** — it retargets the address in state, so Terraform updates its records instead of destroying and recreating the real resource.

```hcl
# renamed aws_instance.web  →  aws_instance.api
moved {
  from = aws_instance.web
  to   = aws_instance.api
}

# or moving it into a module
moved {
  from = aws_instance.api
  to   = module.compute.aws_instance.api
}
```

Workflow: rename the resource (or wrap it in the module), add the `moved` block, run `plan` — it should show **"N resources will be moved"** and **zero** create/destroy. Apply. Once merged and applied everywhere, you can delete the `moved` block (it's a one-time instruction, though leaving it is harmless).

Before `moved` blocks existed you'd do this imperatively with `terraform state mv aws_instance.web aws_instance.api` — still valid, but `moved` is declarative, reviewable in the PR, and runs for everyone/every env automatically. Either way the goal is the same: **a plan with moves only, no destroy/recreate** — that's what guarantees no downtime.

### Q10. Adopt a bunch of click-created infrastructure into Terraform.

**Import to a zero-diff plan, component by component** — never recreate what already exists.

1. **Write (or generate) matching config.** For each resource, an import block; use `-generate-config-out` to scaffold HCL for click-created infra:
   ```hcl
   import {
     to = aws_s3_bucket.assets
     id = "acme-prod-assets"
   }
   ```
   ```bash
   terraform plan -generate-config-out=generated.tf
   ```
2. **Iterate to zero diff** — clean up the generated HCL (remove computed fields, parameterise), re-plan until it shows **no changes**. Zero diff proves config matches reality.
3. **Apply** to write them into state.
4. For a whole account, use **Terraformer** to bulk-generate HCL + state, then refactor.

Do it **layer by layer** (networking first, prove clean, then data, then apps), and keep the resources effectively ClickOps-owned until Terraform shows no drift — only then declare Terraform authoritative and stop using the console. The anti-pattern to avoid: two tools (or a human and Terraform) both "owning" a resource.

### Q11. You lost or corrupted the state file. Recover it.

The infra still exists — you're rebuilding Terraform's *record* of it, not the infra.

1. **Restore from the versioned backend** — S3 versioning / TFC state history keeps every prior state; roll back to the last-good version. This is the one-command fix and the reason remote backends must have versioning on.
2. **Restore from local backup** — Terraform writes `terraform.tfstate.backup`; for local state that's an immediate fallback.
3. **If truly gone, rebuild via `import`** — recreate the config and import each live resource into a fresh state until `plan` is clean (Terraformer for bulk).

Do **not** hand-edit state or blind-apply under pressure — a blind apply against empty state could try to *recreate* resources that already exist (or worse). Before any risky state operation, snapshot it: `terraform state pull > state.bak`.

Prevention is the real answer, and worth stating: **versioned + locked remote backend** turns "lost state" from a disaster into a rollback, and locking prevents the concurrent-write corruption that causes many of these incidents in the first place.

### Q12. Split one monolithic state into per-service states.

Move resources out of the monolith into new component states **without destroying anything**, using `terraform state mv` across states (or `moved` blocks with new roots).

1. **Plan the seams** — decide the target states (networking, data, per-service) per the blast-radius rules.
2. **Stand up the new root + backend** for each target component (empty state).
3. **Move resources** between states — pull the resource out of the monolith and into the new state:
   ```bash
   # move within/between state files, no destroy/recreate
   terraform state mv -state-out=../payments/terraform.tfstate \
     aws_ecs_service.payments aws_ecs_service.payments
   ```
   (In practice: `state mv` for cross-state moves, or add the resource to the new root and use `moved`/import.) **Back up both states first** (`terraform state pull`).
4. **Rewire cross-state references** — where the monolith passed values internally, the new states now consume via `terraform_remote_state` or tag lookups.
5. **Verify** — `plan` in *both* the old and new roots shows **zero** create/destroy. That's the proof the split preserved everything.

Do it incrementally (one service at a time), backing up state at each step. The anti-pattern to avoid: destroying and re-creating to "move" a resource — always a state operation, never a destroy.

### Q13. A junior committed AWS keys in a provider block. Remediate.

Treat it as a **credential exposure incident** — removing the line is not enough, the keys are compromised the moment they hit git.

1. **Rotate immediately** — deactivate/delete the exposed IAM keys in the cloud console *first*. They're in git history (and possibly already scraped); rotation is the only real fix.
2. **Purge from history** — `git filter-repo` (or BFG) to strip the secret from every commit, then force-push; the plain file deletion leaves it in history.
3. **Fix the pattern so it can't recur** — never put credentials in HCL:
   ```hcl
   provider "aws" {
     region = "us-east-1"
     # no access_key/secret_key — use the default credential chain:
     # env vars, shared config, IAM role, or (best in CI) OIDC-assumed role
   }
   ```
   CI should assume a **scoped role via OIDC**, not carry long-lived keys at all.
4. **Add guardrails** — pre-commit secret scanning (gitleaks/trufflehog) and a CI check that fails on detected secrets.

The interview signal: you say **rotate first**, then history-scrub, then prevent — in that order. Someone who only deletes the file and re-commits has missed that the secret is already burned.

### Q14. Review this risky plan — what do you look for before approving?

Read a plan like a diff you're accountable for. Scan, in priority order:

- **Destroys (`-`)** — anything being deleted, *especially* stateful resources (databases, buckets, volumes). A destroy of a prod data store is a stop-the-line finding.
- **Replacements (`-/+`)** — a destroy-and-recreate. Check *what forced it* ("forces replacement" line) and whether that resource can tolerate recreation. Immutable-attribute changes on a DB = data loss.
- **Count/index shifts** — if a `count`-based resource had an element removed from the middle, everything after it shows as replaced (the `count` shift bug). A one-line change rippling into a fleet replacement is the classic trap.
- **Secret/sensitive diffs** — values marked `(sensitive)` changing, or secrets appearing in plaintext — flag both the change and the exposure.
- **Scope creep** — a plan that touches far more than the PR claims (a networking change showing app diffs) suggests a state/ownership problem.
- **The summary line** — `Plan: X to add, Y to change, Z to destroy`. If Z > 0 and you didn't expect it, do not approve.

The rule: **an empty-looking plan isn't automatically safe** — a small config change can trigger replacements or count-shifts. Approve only a plan whose every destroy/replace you can explain and intend.

### Q15. Walk me through your safe-change workflow from edit to prod.

**`plan → review → apply`, gated, with prod never surprised.**

1. **Branch + edit** — change config on a feature branch, never directly on the state.
2. **Local sanity** — `terraform fmt`, `validate`, and a `plan` against a non-prod env to eyeball the diff.
3. **PR + CI plan** — CI runs `terraform plan` and posts the output on the PR. Reviewers (CODEOWNERS for that component) read the diff — destroys, replacements, count-shifts (per Q14).
4. **Policy gate** — policy-as-code (Sentinel/OPA) fails the plan if it violates org rules.
5. **Merge → gated apply** — merge triggers `apply`. Non-prod applies automatically; **prod apply requires explicit approval** and applies with a **scoped role**, not human keys.
6. **Post-apply verify** — re-plan shows zero diff; monitor.

The invariants: humans **review a plan before any apply**, prod has a **human approval gate**, applies use **least-privilege credentials**, and everything runs through **locked remote state** so no two changes race. Contrast with the anti-pattern: applying from a laptop straight to prod with admin keys and no review — which is how estates get destroyed. The whole workflow exists so that what reaches prod has been *seen* by a human and a policy engine first.

### Q16. Name the Terraform anti-patterns you watch for in a review, and the fix for each.

A checklist worth reciting:

- **Hardcoded secrets in HCL** → credential-chain/OIDC + secret scanning; rotate anything already committed.
- **No state locking** → remote backend with a lock (S3+DynamoDB / TFC); concurrent applies corrupt state.
- **One giant state** → split state-per-component; giant state = slow plans + huge blast radius + lock contention.
- **Unpinned modules/providers** (`?ref=main`, no version constraint) → pin to versions + commit `.terraform.lock.hcl`; unpinned = a silent upstream change ripples into every consumer.
- **Habitual `-target`** → it's an incident scalpel, not a workflow; routine use hides real diffs — split state instead.
- **Manual state edits** (hand-editing `terraform.tfstate`) → use `import`, `state mv/rm`, `moved` blocks; never a text editor.
- **ClickOps alongside Terraform** → import it and lock down console write access; two owners = perpetual drift.
- **`terraform apply --auto-approve` straight to prod from a laptop** → CI-gated plan/review/apply with prod approval.
- **Workspaces for strong env isolation** → directory-per-env with separate backends/credentials.

The senior move is not just naming them but stating *what each one costs* — every anti-pattern maps to a concrete failure (data loss, corruption, blast radius, drift), and the fix is the corresponding practice from the earlier topics.

### Q17. A plan shows a fleet of instances being replaced after a one-line change. Diagnose it.

This is almost always the **`count` index-shift bug** or an **immutable-attribute change**, and the two have very different fixes.

**If you removed an element from the middle of a `count` list:** `count`-indexed resources are addressed by position (`aws_instance.web[0..N]`). Remove index 2 and every instance after it shifts down one address, so Terraform sees `[3]`→`[2]`, `[4]`→`[3]`, etc. as *different* resources and plans to destroy/recreate the lot.

```hcl
# fragile: identity is positional
resource "aws_instance" "web" { count = length(var.names) }

# robust: identity is the key, removing one leaves the rest untouched
resource "aws_instance" "web" {
  for_each = toset(var.names)
  tags     = { Name = each.key }
}
```

Fix: migrate to **`for_each`** (keyed by a stable map/set) so identities are names, not positions — then removing one only destroys that one. Migrate existing resources with `moved`/`state mv` to avoid the very replacement you're trying to prevent.

**If it's an immutable attribute** (AMI id, instance type on some resources, a field the provider marks force-new): the plan's "forces replacement" line names it. Decide whether the fleet *should* recycle (rolling replacement via `create_before_destroy`) or whether you should avoid touching that field. Either way: read the "forces replacement" reason before approving — a one-line change fanning out into a fleet replace is exactly the plan you catch in review.
