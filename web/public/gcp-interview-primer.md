---
type: interview-prep
---

# Google Cloud (GCP) Interview Primer — 343 Questions

Comprehensive Q+A primer for senior GCP backend / cloud-architecture interviews. Sister note to the [[AWS Interview Primer]] and the language primers — same shape, GCP-flavoured: resource hierarchy & IAM, the compute/storage/networking core, databases (Cloud SQL / Spanner / Firestore / Bigtable), BigQuery & data, Pub/Sub eventing, observability, security, cost, and Architecture-Framework resilience.

Each answer is interview-shaped: opinionated, concrete, real service limits and pricing models, failure modes, and architecture tradeoffs — not a service glossary. Current Google Cloud; mapped to the Architecture Framework pillars where it helps, with the AWS analogue noted where useful.

1. [[#GCP Fundamentals & Resource Hierarchy]]
2. [[#IAM & Access Management]]
3. [[#Compute Engine]]
4. [[#Serverless Compute: Cloud Run, Cloud Functions & App Engine]]
5. [[#Containers: GKE]]
6. [[#Object Storage: Cloud Storage]]
7. [[#Block & File Storage: Persistent Disk, Hyperdisk, Local SSD, Filestore]]
8. [[#Networking: VPC]]
9. [[#DNS, CDN & Edge: Cloud DNS, Cloud CDN, Certificate Manager]]
10. [[#Load Balancing]]
11. [[#Relational Databases: Cloud SQL, AlloyDB & Cloud Spanner]]
12. [[#NoSQL: Firestore & Bigtable]]
13. [[#Data & Analytics: BigQuery]]
14. [[#Messaging & Streaming: Pub/Sub, Pub/Sub Lite & Eventarc]]
15. [[#Caching & In-Memory: Memorystore]]
16. [[#Observability: Cloud Operations]]
17. [[#Security Services: Cloud KMS, Secret Manager, Cloud Armor, IAP & more]]
18. [[#Infrastructure as Code & CI/CD]]
19. [[#Cost Optimization & Billing]]
20. [[#Architecture Framework, Reliability & Multi-Region DR]]
21. [[#Scenario Design & Common Pitfalls]]

---

## GCP Fundamentals & Resource Hierarchy

### Summary

**What this topic covers**

The scaffolding every other GCP topic hangs off: how Google Cloud organises *who owns what* and *where things run*. Three concern areas live here. (1) The **resource hierarchy** — organization → folders → projects → resources — and the way IAM policy and org policy flow *downward* through it. (2) The **project** as the fundamental unit of isolation, billing, quota, and API enablement — including the three ways to name one (ID vs number vs display name). (3) The **physical and access surface** — regions, zones, multi-regions, Google's global network and points of presence, and the tools you drive it all with (Console, `gcloud`, Cloud SDK, Cloud Shell, client libraries). The 16 questions here are deliberately broad and warm-up-shaped, but every later topic — IAM, Compute Engine, VPC, Storage, BigQuery — silently assumes you can place a resource correctly in the hierarchy and reason about its regional scope.

**Mental model**

Think of GCP as a **tree of ownership** with a **map of geography** laid across it. The tree: an **organization** node (tied to a Cloud Identity or Workspace domain) at the root, optional **folders** for departments/teams/environments, then **projects**, then the actual resources (VMs, buckets, datasets). IAM allow policies set at any node are *inherited* by everything beneath — grant `roles/viewer` at a folder and every project in it inherits it. The project is the real workhorse: it's the trust boundary, the billing target, the quota bucket, and the unit where you *enable APIs*. Nothing works in a project until its API is turned on. The geography is orthogonal: a **region** (e.g. `europe-west2`) is a metro area; a **zone** (`europe-west2-a`) is a failure domain within it; a **multi-region** (`EU`, `US`) spans several regions for durability. Resources are **global** (VPC, IAM, images), **regional** (subnets, regional MIGs, regional disks), or **zonal** (a single VM, a zonal disk). Get an object's scope wrong and you'll design an outage in.

**Key terms**

- **Organization** — root node of the hierarchy, one per Cloud Identity/Workspace domain; owns all folders and projects.
- **Folder** — optional grouping under the org for departments, teams, or environments; can nest.
- **Project** — the fundamental unit of isolation, billing, quota, and API enablement; the thing almost every resource belongs to.
- **Project ID** — globally-unique, user-chosen, immutable string (e.g. `acme-prod`); what you pass to `gcloud` and APIs.
- **Project number** — globally-unique, auto-assigned integer; used in some IAM and service-agent contexts.
- **Billing account** — a payment instrument linked to one or more projects; managed separately from resource IAM.
- **Region / zone / multi-region** — metro area / failure domain within a region / durability span across regions.
- **Global vs regional vs zonal resource** — the scope at which a resource lives and fails.
- **Labels** — key/value metadata for organising and billing breakdown (no access-control effect).
- **Tags** — hierarchy-attached key/value pairs that *can* drive IAM conditions and firewall/org-policy decisions.
- **Cloud Shell** — a free browser VM with `gcloud`, tools, and 5 GB persistent home pre-installed.

**Why interviewers ask this**

This is the "do you actually operate GCP or just read about it" filter. Junior candidates blur project ID vs number, think a zone and a region are the same thing, or believe you administer billing through the same roles as resources. Senior candidates instinctively reach for the hierarchy: "put shared VPC and org policy at the org/folder level, isolate each app's blast radius in its own project, and separate billing admin from resource admin." They also know the operational gotchas — you must *enable an API per project before use*, quotas are *per project per region*, and a project ID is *immutable once chosen*. The signal isn't trivia; it's whether you'll design an account/project layout that scales to hundreds of teams without turning into a permissions swamp.

**Common confusions**

- "A project ID and project number are interchangeable" — both are globally unique, but the ID is a human-chosen immutable string and the number is an auto-assigned integer; some service agents key off the number.
- "Region and zone are the same" — a region contains multiple zones; a zone is a single failure domain. Multi-zone deployment is your first HA lever.
- "Billing and IAM are one thing" — billing account management and resource IAM are deliberately separate so finance can pay bills without touching production.
- "Labels control access" — labels are just metadata for grouping and cost breakdown; **tags** (the hierarchy kind) are what bind to IAM conditions and org policy.
- "GCP projects are like AWS accounts" — a project is a *tighter, cheaper* isolation boundary; you spin up projects freely where AWS teams agonise over account sprawl.
- "APIs are on by default" — almost none are; you enable each service API per project (`gcloud services enable`).

**What follows from this topic**

Everything. **IAM & Access Management** builds directly on policy inheritance down this tree. **Compute Engine**, **VPC networking**, and **Cloud Storage** all depend on getting regional/zonal scope right. Billing separation previews the security topics, and API-enablement-per-project is the first thing that bites you in every hands-on task. If you can't confidently place a resource in the hierarchy and state its scope, fix that before drilling the service-specific topics.

### Q1. Describe the GCP resource hierarchy and why it matters.

Top to bottom: **Organization → Folders → Projects → Resources**.

- **Organization** — the root, created from a Cloud Identity or Google Workspace domain. One per domain. Owns everything.
- **Folders** — optional, nestable groupings under the org. Model departments, teams, or environments (`prod`/`nonprod`).
- **Projects** — the fundamental unit resources belong to. Billing, quota, API enablement, and most IAM anchor here.
- **Resources** — VMs, buckets, datasets, etc., living inside a project.

Why it matters: **IAM allow policies and org policies are inherited downward**. A role granted at the org or folder level applies to every project beneath. This lets you set broad guardrails high up (org policy: "no external IPs", "only allow these regions") and delegate finer grants low down. It also gives you clean blast-radius control — put each app's prod in its own project so a compromised credential can't reach a sibling.

### Q2. What is a GCP project, and what's the difference between project ID, project number, and project name?

A **project** is the fundamental container and isolation boundary. It scopes billing, quota, API enablement, and IAM. Almost every resource lives in exactly one project.

Three identifiers:

| Identifier | Set by | Format | Mutable? | Used for |
|---|---|---|---|---|
| Project ID | You (at creation) | Globally-unique string, e.g. `acme-prod` | No — immutable | `gcloud`, API calls, most references |
| Project number | Google | Globally-unique integer | No | Service agents, some IAM member strings |
| Display name | You | Non-unique string | Yes | Human-friendly label in the Console |

The gotcha: the **ID is immutable** — choose it carefully, because you can't rename it, only create a new project and migrate. The **number** shows up in service-account principals like `service-<number>@...`, so don't be surprised when automation references it instead of the ID.

### Q3. Explain regions, zones, and multi-regions. How do they relate?

- **Region** — an independent geographic area (e.g. `europe-west2` = London). Contains multiple zones.
- **Zone** — a deployment/failure domain within a region (`europe-west2-a`). Roughly maps to isolated power/cooling/network. Spread instances across zones for HA.
- **Multi-region** — a large area spanning several regions (`EU`, `US`, `ASIA`), used by services like Cloud Storage and BigQuery for higher durability and availability.

Relationship: a multi-region contains regions; a region contains zones. Your HA ladder is: single zone → multiple zones in a region → multiple regions. Latency and data-residency go the other way — staying in one region is cheaper and lower-latency but less resilient.

### Q4. What's the difference between global, regional, and zonal resources? Give examples.

**Scope** determines where a resource lives and what its failure domain is.

- **Global** — not tied to any one region. Examples: **VPC networks**, firewall rules, IAM policies, images, global load balancers, Cloud DNS.
- **Regional** — pinned to one region, replicated across its zones. Examples: **subnets**, regional persistent disks, regional MIGs, regional external IPs.
- **Zonal** — pinned to a single zone. Examples: a **Compute Engine VM instance**, zonal persistent disks, zonal MIGs, local SSDs.

Why it matters: a zonal resource dies with its zone. A regional resource survives a single-zone outage. Design HA by choosing the right scope — e.g. a regional MIG spreads instances across zones automatically, whereas a zonal MIG doesn't. Note the classic GCP twist: **VPC is global, subnets are regional** — one VPC can span every region without peering.

### Q5. How do you interact with GCP? Compare the Console, gcloud, Cloud SDK, Cloud Shell, and client libraries.

- **Cloud Console** — the web UI. Best for exploration, one-off tasks, and dashboards. Not reproducible.
- **`gcloud` CLI** — the scriptable command-line tool for managing resources. The backbone of automation and CI.
- **Cloud SDK** — the downloadable bundle that ships `gcloud`, `gsutil` (Storage), `bq` (BigQuery), and `kubectl` helpers.
- **Cloud Shell** — a free, ephemeral browser VM with the SDK pre-installed and a 5 GB persistent `$HOME`. Zero local setup; great for quick admin.
- **Client libraries** — idiomatic SDKs (Go, Python, Java, Node, etc.) for calling GCP APIs from application code; handle auth, retries, pagination.

Rule of thumb: **Console to learn, `gcloud` to automate, client libraries in app code, Cloud Shell when you have no local tooling.**

```bash
gcloud config set project acme-prod
gcloud compute instances list
gcloud services enable compute.googleapis.com
```

### Q6. How do billing accounts work, and why are billing and IAM kept separate?

A **billing account** is a payment instrument (a credit card or invoiced account) that pays for usage. One billing account can be **linked to many projects**; a project can be linked to at most one at a time. Disable or unlink billing and the project's resources stop.

Billing is deliberately decoupled from resource IAM:

- **Billing roles** (`roles/billing.admin`, `roles/billing.user`) control who can create/link billing accounts and see costs.
- **Resource roles** (`roles/owner`, `roles/editor`, service-specific roles) control who can touch VMs, buckets, etc.

The separation lets a finance team own spend without production access, and lets engineers deploy without seeing or changing the payment method. A common enterprise pattern: a central billing admin links every team's project to one org-level billing account, while each team self-administers only its own resources. Use **budgets and alerts** plus **billing export to BigQuery** for cost visibility.

### Q7. What is the organization node, and how does it relate to Cloud Identity / Google Workspace?

The **organization** is the root of the resource hierarchy. It's created automatically the first time a user from a **Cloud Identity** or **Google Workspace** domain interacts with GCP — the domain *is* the org's identity backbone (it owns the users and groups).

Why it matters:

- Without an org node, projects are owned by individual accounts — fragile, no central control, no org policy.
- With an org, you get **centralised IAM and org policy inheritance**, lifecycle control over projects (they can't just disappear with a personal account), and folders for structure.
- **Cloud Identity** is the free identity layer (users/groups/SSO) you provision if you don't already have Workspace.

Senior takeaway: for anything beyond a hobby project, establish the org node early. Retrofitting a hierarchy onto orphaned projects is painful.

### Q8. Labels vs tags — what's the difference and when do you use each?

Both are key/value metadata, but they do different jobs.

| | Labels | Tags |
|---|---|---|
| Purpose | Organisation, cost breakdown, filtering | Conditional access control & policy |
| Bind to IAM/org policy? | No | Yes |
| Scope | Per-resource | Attached to hierarchy nodes, inherited |
| Typical use | Billing export grouping, `env=prod` filters | "deny public IP unless tag `exception=true`" |

**Labels** are for humans and cost reports — slice your BigQuery billing export by `team` or `cost-center`. They have **no security effect**. **Tags** are governance primitives: they can be referenced in **IAM conditions**, **org policy**, and **firewall rules** to make allow/deny decisions. Don't reach for labels expecting them to gate access — that's a tags job.

### Q9. Why must APIs be enabled per project, and what breaks if you forget?

GCP services are exposed as APIs that are **disabled by default** in every new project. You must explicitly enable each one (via **Service Usage**) before using it:

```bash
gcloud services enable run.googleapis.com \
  bigquery.googleapis.com \
  compute.googleapis.com
```

Why: it's least-privilege at the service level — a project only exposes the surface it actually needs, reducing attack surface and accidental spend. It also scopes quotas per enabled service.

What breaks if you forget: API calls fail with a `SERVICE_DISABLED` / 403 error, often surfacing as a confusing "permission denied" in an app or Terraform run. The first debugging step for a "why can't I create this resource" issue in a fresh project is frequently "is the API enabled?" Terraform/IaC pipelines usually enable required APIs explicitly for exactly this reason.

### Q10. What are quotas, and how do they relate to Service Usage?

**Quotas** are limits on resource consumption, enforced **per project** (and often per region and per service). Two kinds:

- **Rate quotas** — requests per unit time (e.g. API calls per minute).
- **Allocation quotas** — a ceiling on concurrent resources (e.g. CPUs per region, in-use external IPs).

They're managed through **Service Usage** alongside API enablement. Quotas protect Google's infrastructure from runaway usage *and* protect you from a bug that spins up 10,000 VMs.

Operational reality: default quotas are conservative. Scaling a workload often means **requesting a quota increase** ahead of time (they aren't instant). A classic incident is an autoscaler that can't add capacity during a traffic spike because it hit the regional CPU quota — so senior engineers pre-raise quotas for expected peaks and monitor quota usage.

### Q11. How do you choose which region to deploy in?

Balance five factors:

- **Latency** — pick the region closest to your users; every extra 1000 km adds round-trip time.
- **Price** — regions are priced differently; some (e.g. certain US regions) are cheaper than others for the same machine type.
- **Data residency / compliance** — regulations (GDPR, data-sovereignty) may *require* data stay in a specific country/region.
- **Service & feature availability** — not every service, machine family, or GPU is in every region; check before committing.
- **Carbon footprint** — Google publishes per-region carbon data; some regions run on higher percentages of carbon-free energy.

Senior answer: it's rarely a single region. For global apps you deploy to multiple regions behind a **global load balancer**, keeping data in-region for residency while serving low-latency traffic everywhere. Also weigh the second region for **DR** early — cross-region failover is far cheaper to design up front than to retrofit.

### Q12. How does GCP's global network and points of presence benefit your architecture?

Google runs a **private global backbone** connecting its regions, plus **points of presence (PoPs)** / edge locations peered with ISPs worldwide.

Benefits:

- **Global VPC** — one VPC spans every region on Google's backbone; no peering or VPN to connect regions internally.
- **Global load balancing with anycast** — a single global anycast IP routes users to the nearest healthy backend over Google's network, not the public internet.
- **Cold-potato routing** — traffic enters Google's network at the PoP nearest the user and rides the private backbone the rest of the way, improving latency and reliability versus hot-potato public routing.
- **Cloud CDN** — caches content at the edge PoPs, close to users.

Architecturally this means you can build a genuinely global front door on one IP with in-region backends, and inter-region traffic stays on a fast private network rather than the public internet.

### Q13. Explain GCP's pricing model and the free tier.

Core principles:

- **Pay-as-you-go** — billed for what you consume (compute-seconds, GB stored, GB egress, API calls). No upfront commitment required.
- **Per-second billing** for compute (Compute Engine, with a 1-minute minimum), so short-lived workloads are cheap.
- **Automatic discounts** — **sustained-use discounts** apply automatically the longer a VM runs in a month; **committed-use discounts** give bigger savings for a 1- or 3-year commitment.
- **Egress is the sneaky cost** — data *into* GCP is free; data *out* to the internet or across regions is charged. Design to minimise egress.

The **free tier** has two parts: a **12-month $300 credit** for new accounts, and an **"Always Free"** set of limited resources (e.g. a small `e2-micro` VM in certain US regions, a modest Cloud Storage allowance, some Cloud Functions invocations) that never expires within limits. Use the free tier to learn, but design production with egress and committed-use in mind.

### Q14. How do GCP projects compare to AWS accounts as isolation boundaries?

They play a similar role — a billing, quota, and IAM boundary — but differ in weight and philosophy.

| | GCP project | AWS account |
|---|---|---|
| Creation cost | Cheap, fast, meant to be numerous | Heavier; account sprawl is a real concern |
| Isolation | Tight — natural per-app/per-env boundary | Strong, but teams hesitate to make many |
| Grouping | Folders under an org | Organizational Units (OUs) under AWS Organizations |
| Typical pattern | Many small projects per team/env | Fewer, larger accounts with more inside |

Key point for interviews: a **GCP project is a *tighter* isolation boundary that you create freely** — the idiomatic GCP pattern is one project per app per environment (`acme-web-prod`, `acme-web-staging`), giving clean blast-radius separation. AWS teams historically pack more into fewer accounts. The org/folder structure in GCP maps conceptually to AWS Organizations/OUs, and org policy ≈ Service Control Policies (SCPs) as inherited guardrails.

### Q15. You're setting up GCP for a company with three teams and prod/nonprod environments. How do you structure the hierarchy?

A clean, common layout:

```text
Organization (acme.com)
├── Folder: prod
│   ├── Project: team-a-prod
│   ├── Project: team-b-prod
│   └── Project: team-c-prod
└── Folder: nonprod
    ├── Project: team-a-staging
    ├── Project: team-b-staging
    └── Project: team-c-staging
```

Design reasoning:

- **Folders by environment** let you set strict org policy on `prod` (e.g. no external IPs, restricted regions, require CMEK) that's looser on `nonprod`.
- **One project per team per environment** gives each team an isolated blast radius, its own quotas, and its own API surface.
- **IAM at the folder level** — grant each team's group `roles/editor` on their nonprod folder but tighter, reviewed roles on prod.
- **Shared VPC** hosted in a central project, shared down to team projects, keeps networking centrally governed.
- **Central billing account** linked to all projects; **labels** (`team`, `cost-center`) on resources for cost breakdown.

This scales: adding a team is "create two projects, grant one group." Alternatively fold by team first then environment — the choice depends on whether governance is stronger per-environment (usually yes) or per-team.

### Q16. What's the difference between organization policy (constraints) and IAM, at the hierarchy level?

They answer different questions and both inherit down the tree.

- **IAM** answers *"who can do what."* It grants principals roles (permissions) on resources. It's **additive** — you add allow bindings.
- **Org policy** answers *"what is allowed to exist / happen at all,"* regardless of who. It applies **constraints** (guardrails) like "disable service account key creation," "restrict VM external IPs," "allowed regions = EU only," "require OS Login."

The distinction: IAM can grant a user permission to create a VM, but org policy can still forbid that VM from having a public IP. Org policy is a *boundary* that even project owners can't cross; IAM is *delegation* within those boundaries. Both are set at org/folder/project and inherit downward, so you enforce broad guardrails high in the hierarchy and delegate specific permissions lower down. In AWS terms, org policy ≈ SCPs, IAM ≈ IAM.

## IAM & Access Management

### Summary

**What this topic covers**

How GCP decides **who can do what to which resource** — the security spine of the entire platform. Five concern areas live here. (1) The **IAM model** itself — the member + role + resource → policy-binding triangle, and the crucial rule that *permissions are only ever granted through roles*, never directly. (2) **Members and roles** — the taxonomy of principals (Google accounts, service accounts, groups, domains, special identifiers) and the three role tiers (basic/primitive, predefined, custom). (3) **Inheritance and resolution** — how allow policies flow down the org → folder → project → resource tree and how **IAM deny policies** interact with allow. (4) **Service accounts** — the most consequential and most abused identity in GCP, plus the modern keyless alternatives (**Workload Identity Federation**, GKE Workload Identity). (5) **Governance** — org policy vs IAM, **IAM Conditions**, and tooling like Policy Analyzer and the Recommender. The 18 questions here move from "what is a role" to "design least-privilege for a multi-team org and eliminate service-account keys."

**Mental model**

An IAM **allow policy** is a list of **bindings**, each binding = one **role** granted to a set of **members** on a **resource**. Ask three questions for any access decision: *who* (member), *what* (role → permissions), *where* (resource, plus everything it inherits from). Permissions are fine-grained (`compute.instances.start`) and are **bundled into roles**; you never grant a raw permission to a user, you grant a role that contains it. Policies **inherit downward** and are **additive** — the effective access at a resource is the union of every allow binding from the resource up to the org. Deny is the exception: **IAM deny policies** are evaluated first and can veto access an allow would otherwise grant. The single most important operational idea: **service accounts are both an identity your workloads act as *and* a resource others get permissions on** — and their **keys are long-lived secrets you should avoid**, replacing them with impersonation or Workload Identity Federation. Least privilege is the north star: start from predefined roles, tighten with custom roles and conditions, and let the Recommender pull back what's unused.

**Key terms**

- **Member / principal** — an identity: Google account, service account, Google group, Workspace/Cloud Identity domain, or a special identifier.
- **Role** — a named bundle of permissions; the only way permissions reach a member.
- **Permission** — a fine-grained action (`service.resource.verb`, e.g. `storage.objects.get`); granted only via roles.
- **Binding** — (role, members, optional condition) tuple within an allow policy.
- **Basic/primitive roles** — Owner, Editor, Viewer; broad, legacy, discouraged in production.
- **Predefined roles** — Google-curated, service-scoped roles (e.g. `roles/storage.objectViewer`); the default choice.
- **Custom roles** — you define the exact permission set; for tight least-privilege.
- **Service account** — a non-human identity that workloads run as; both an identity and a resource.
- **Workload Identity Federation** — lets external/CI identities (GitHub Actions, AWS, OIDC) get GCP access with **no keys**.
- **IAM Conditions** — attribute-based conditions (time, resource, request) attached to a binding.
- **Deny policy** — explicit deny rules evaluated before allow; a hard veto.
- **allUsers / allAuthenticatedUsers** — special members meaning "anyone on the internet" / "any authenticated Google identity."

**Why interviewers ask this**

IAM is where most real cloud breaches and misconfigurations happen, so it's the highest-signal security topic. Junior candidates default to Owner/Editor because "it just works," store service-account JSON keys in the repo, and open buckets to `allUsers` by accident. Senior candidates recoil at basic roles in prod, know that a leaked service-account key is a durable, hard-to-rotate credential, and reach first for **Workload Identity Federation** so there's no key to leak. They can explain inheritance and deny-vs-allow resolution precisely, use **IAM Conditions** for time-boxed or resource-scoped grants, and lean on **Policy Analyzer/Recommender** to enforce least privilege continuously. The interviewer is checking whether you'll design access that's both *usable* and *not a breach waiting to happen*.

**Common confusions**

- "You grant permissions to users" — you don't; you grant **roles**, which contain permissions. There's no direct user→permission binding.
- "Editor is fine for the app's service account" — basic roles are enormous; a compromised Editor SA can rewrite most of the project. Use predefined/custom.
- "Service accounts need keys" — for most cases, no. Attach the SA to the resource (VM/GKE/Cloud Run) or use impersonation/WIF; downloaded JSON keys are the thing to avoid.
- "Deny and allow are just merged" — deny is evaluated **first** and overrides allow; it's a veto, not another vote.
- "allAuthenticatedUsers means my org" — it means *any* Google-authenticated identity on the internet, not just your domain. `allUsers` means literally anyone. Both are public-exposure footguns.
- "Org policy and IAM are the same control" — IAM grants who-can-do-what; org policy sets what-can-exist-at-all. Different layers.

**What follows from this topic**

IAM underpins every other topic. **Compute Engine** VMs run as service accounts (default vs user-managed matters). **Cloud Storage** bucket exposure is an IAM decision (`allUsers` = public). **GKE Workload Identity** is IAM applied to pods. **BigQuery**, **Pub/Sub**, and every data service gate access through these same bindings. Get the deny/allow/inheritance model and the service-account/keyless story right here, and the security reasoning in every later topic follows.

### Q1. Explain GCP's IAM model: members, roles, and resources.

IAM answers "who can do what on which resource" via an **allow policy** attached to a resource. The policy is a set of **bindings**, each binding tying:

- **Member(s)** — the *who*: a Google account, service account, group, domain, or special identifier.
- **Role** — the *what*: a named bundle of permissions.
- **Resource** — the *where*: the org, folder, project, or specific resource the policy is attached to.

```json
{
  "bindings": [
    { "role": "roles/storage.objectViewer",
      "members": ["group:data-readers@acme.com"] }
  ]
}
```

The defining rule: **permissions are only granted through roles.** You never bind a raw permission like `storage.objects.get` to a member directly — you grant a role that contains it. Policies inherit down the hierarchy and are additive.

### Q2. What are the different member/principal types?

- **Google account** — an individual human (`user:alice@acme.com`).
- **Service account** — a non-human identity for workloads (`serviceAccount:app@acme-prod.iam.gserviceaccount.com`).
- **Google group** — a collection of accounts/SAs (`group:devs@acme.com`); the *right* unit to grant to, so membership changes don't require policy edits.
- **Cloud Identity / Workspace domain** — everyone in a domain (`domain:acme.com`).
- **`allAuthenticatedUsers`** — anyone signed in with a Google identity (anywhere, not just your org).
- **`allUsers`** — literally anyone on the internet, unauthenticated.

Best practice: **grant roles to groups, not individuals** — you manage access by changing group membership in one place, and audits are far cleaner. The two special identifiers are public-exposure footguns; use them only for genuinely public resources.

### Q3. Compare basic, predefined, and custom roles. Which should you use?

| Role type | Who defines | Granularity | Use when |
|---|---|---|---|
| Basic (primitive) | Google (legacy) | Huge — Owner/Editor/Viewer, project-wide | Almost never in prod; quick sandboxes only |
| Predefined | Google | Service-scoped, curated | Default choice for nearly everything |
| Custom | You | Exact permission set you list | Tightest least-privilege, unusual needs |

- **Basic roles** — **Owner**, **Editor**, **Viewer**. Coarse and dangerous: Editor can change most resources across the whole project. Avoid in production.
- **Predefined roles** — e.g. `roles/pubsub.publisher`, `roles/storage.objectAdmin`. Google maintains them as services evolve. Start here.
- **Custom roles** — you enumerate permissions for the rare case where no predefined role fits without granting too much. You own maintenance as APIs add permissions.

Rule: **default to predefined, tighten with custom, avoid basic.**

### Q4. How does IAM policy inheritance work down the hierarchy?

Allow policies set at any node — **org, folder, project, or resource** — are **inherited by all descendants**, and grants are **additive (union)**. The **effective policy** on a resource is every binding from that resource up to the organization, combined.

Consequences:

- Grant `roles/viewer` at a **folder**, and every project and resource under it inherits read access.
- You **cannot subtract** an inherited allow with another allow — a lower binding can only *add*. To remove access you must either change the grant higher up or use a **deny policy**.
- This is why you set broad, safe grants high (e.g. `roles/logging.viewer` for an SRE group at the org) and specific, powerful grants low (e.g. `roles/storage.admin` on one bucket).

The mental check for "can Alice do X on resource R?" is: walk from R up to the org, union all allow bindings for Alice, then apply any deny policies.

### Q5. How do IAM allow and deny policies resolve together?

**Deny policies are evaluated first and override allow.**

Resolution order:

1. Gather applicable **deny** rules (inherited down the hierarchy). If any denies the permission for this principal (and no exception applies), access is **denied** — full stop.
2. Otherwise gather all inherited **allow** bindings. If any grants the permission, access is **allowed**.
3. Otherwise, **denied by default** (no allow = no access).

So the model is: default-deny, allow-adds, **deny-vetoes**. Deny policies are the tool for "no one — not even a project Owner — may do X," e.g. "deny `iam.serviceAccountKeys.create` to everyone except the security group." They express guardrails that a broad allow (or an accidental Owner grant) can't punch through. Use them sparingly and precisely; they're powerful and can lock people out if misscoped.

### Q6. What is a service account, and why is it "both an identity and a resource"?

A **service account (SA)** is a non-human identity that applications, VMs, and services **run as**. It has its own email (`app@acme-prod.iam.gserviceaccount.com`) and gets IAM roles like any principal.

Two hats:

- **As an identity** — the SA is the *actor*. Your Cloud Run service or VM authenticates *as* the SA and inherits its roles to call other APIs (e.g. read a bucket).
- **As a resource** — the SA is also a *thing others have permissions on*. Granting a user `roles/iam.serviceAccountUser` on an SA lets them **act as** it; granting `roles/iam.serviceAccountTokenCreator` lets them **impersonate** it.

This duality is the crux of many IAM designs: who can *use* an SA is itself an IAM decision on that SA. Mismanaging "act-as" permissions is a classic privilege-escalation path — a user with act-as on a powerful SA effectively has that SA's power.

### Q7. Default vs user-managed service accounts — what's the difference and the risk?

- **Default service accounts** — auto-created (e.g. the Compute Engine default SA, `<number>-compute@developer.gserviceaccount.com`). Convenient but historically granted the broad **Editor** basic role on the project.
- **User-managed service accounts** — ones you create per workload with exactly the roles that workload needs.

The risk: a VM or GKE node running as the **default SA with Editor** means a single app compromise = near-full project compromise. Best practice:

- Create a **dedicated, least-privilege SA per workload**.
- Don't rely on the default SA; if you must, strip its broad roles.
- Combine with **restricted access scopes** and org policy (`iam.automaticIamGrantsForDefaultServiceAccounts` disabled) so new default SAs don't get Editor automatically.

Senior answer: "one purpose-built SA per service, minimal roles, never the default Editor SA in prod."

### Q8. Why should you avoid service-account keys, and what are the alternatives?

A **service-account key** is a downloaded JSON file containing a long-lived private key. Problems:

- **Long-lived** — it doesn't expire; a leak is a durable breach until you find and revoke it.
- **Easy to leak** — committed to git, baked into images, pasted in CI config, shared in Slack.
- **Hard to rotate** — you must track every place it's used.

Alternatives, in order of preference:

1. **Attach the SA to the resource** — VMs, Cloud Run, Cloud Functions, and GKE (via Workload Identity) get short-lived tokens from the metadata server automatically. No key exists.
2. **Impersonation** — a human or CI principal with `serviceAccountTokenCreator` mints short-lived tokens on demand (`gcloud ... --impersonate-service-account`).
3. **Workload Identity Federation** — external identities (GitHub Actions, AWS, any OIDC provider) exchange their native token for a short-lived GCP token — **keyless**.

Org policy `iam.disableServiceAccountKeyCreation` enforces this by blocking key creation outright.

### Q9. What is service account impersonation and when do you use it?

**Impersonation** lets principal A obtain a **short-lived access token for service account B** without B's key. A needs `roles/iam.serviceAccountTokenCreator` on B.

```bash
gcloud storage ls gs://acme-secure-bucket \
  --impersonate-service-account=app@acme-prod.iam.gserviceaccount.com
```

Uses:

- **Local dev / CI without keys** — engineers authenticate as themselves, then impersonate the app's SA to test with its exact permissions. No JSON key anywhere.
- **Privilege boundaries** — humans hold low privilege day-to-day and impersonate a more-privileged SA only for specific, audited operations.
- **Cross-project access** — impersonate an SA that has rights in another project.

Benefits: tokens are **short-lived** (typically ~1 hour), every impersonation is **logged** in Cloud Audit Logs, and there's **no static secret**. It's the keyless answer for human and CI workflows that can't use metadata-server auth directly.

### Q10. Explain Workload Identity Federation. What problem does it solve?

**Workload Identity Federation (WIF)** lets identities from **outside GCP** — GitHub Actions, GitLab CI, AWS, Azure, or any OIDC/SAML provider — access GCP resources **without a service-account key**.

The problem it solves: CI/CD and external workloads used to authenticate with a downloaded SA key stored as a secret — a long-lived credential that leaks. WIF removes the key entirely.

How it works:

1. You configure a **workload identity pool** and a **provider** trusting the external IdP (e.g. GitHub's OIDC issuer).
2. The external workload presents its **native token** (e.g. GitHub's OIDC token for a specific repo/branch).
3. GCP's **Security Token Service** validates it against attribute conditions and exchanges it for a **short-lived GCP token** (optionally impersonating an SA).

You can scope trust tightly — e.g. "only tokens from `repo:acme/app` on branch `main`." Result: your GitHub Actions deploy to GCP with **zero stored secrets**, and access is bounded to exactly the repo/branch you specified.

### Q11. What is GKE Workload Identity and why use it?

**GKE Workload Identity** binds a **Kubernetes service account (KSA)** to a **GCP service account (GSA)**, so pods authenticate to Google APIs as the GSA **without any key**.

Why it exists: the alternatives are worse — mounting a service-account JSON key into pods (leakable secret) or letting every pod use the **node's** SA (all pods share one over-broad identity, no per-workload separation).

How it works: you annotate a KSA to impersonate a GSA and grant the binding; pods using that KSA get short-lived GCP tokens from the metadata server automatically, scoped to that GSA's roles.

```bash
gcloud iam service-accounts add-iam-policy-binding \
  app@acme-prod.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:acme-prod.svc.id.goog[my-ns/app-ksa]"
```

Benefit: **per-pod least privilege with no keys** — each workload gets exactly the GCP permissions its GSA holds, and there's no secret to rotate or leak. It's the recommended way for GKE workloads to call GCP APIs.

### Q12. Org policy vs IAM — what's the difference?

They're complementary controls, both inherited down the hierarchy.

- **IAM** — *who can do what.* Additive grants of roles to principals. "Alice can create VMs in this project."
- **Org policy** — *what is allowed to exist or happen at all,* independent of identity. Constraints/guardrails. "No VM in this folder may have an external IP." "Only `europe-*` regions allowed." "Service-account key creation disabled."

The interplay: IAM might grant Alice permission to create a VM, but org policy can still forbid that VM from having a public IP or being in `us-central1`. Org policy is a **boundary even Owners can't cross**; IAM is **delegation within** those boundaries. Set org policy high (org/folder) for company-wide guardrails; use IAM for per-team, per-resource delegation. In AWS terms: org policy ≈ Service Control Policies, IAM ≈ IAM.

### Q13. What are IAM Conditions and give a practical use case.

**IAM Conditions** attach an **attribute-based condition** to a role binding, so the grant applies only when the condition is true. Attributes include **request time**, **resource name/type**, and request context.

```json
{
  "role": "roles/storage.objectViewer",
  "members": ["group:contractors@acme.com"],
  "condition": {
    "title": "temporary-until-q3",
    "expression": "request.time < timestamp('2026-09-30T00:00:00Z')"
  }
}
```

Practical uses:

- **Time-boxed access** — a contractor gets read access that auto-expires, no cleanup task required.
- **Resource-scoped grants** — grant a role only on buckets whose name starts with `acme-public-`, not every bucket.
- **Just-in-time / conditional admin** — elevate access only during a change window.

Conditions are how you get **fine-grained, self-expiring least privilege** without minting a custom role for every scenario. They're evaluated as part of the allow binding.

### Q14. How do you design and enforce least privilege in GCP?

A layered approach:

- **Start from predefined roles**, never basic (Owner/Editor). Grant the narrowest predefined role that works.
- **Grant to groups, not individuals** — manage access by membership; audits stay clean.
- **One dedicated service account per workload**, with only its required roles — no shared default Editor SA.
- **Tighten with custom roles and IAM Conditions** where predefined roles over-grant or access should be time/resource-scoped.
- **Eliminate keys** — attach SAs to resources or use WIF/impersonation.
- **Guardrails via org policy** — restrict regions, block SA-key creation, disallow external IPs.
- **Measure and prune** — use the **IAM Recommender** to surface unused permissions and the **Policy Analyzer** to answer "who can access what."

The mindset: grant the minimum, prefer groups and short-lived credentials, put guardrails high in the hierarchy, and continuously pull back what isn't used. Least privilege isn't a one-time setup — it's a loop.

### Q15. What are the Policy Analyzer and IAM Recommender?

Two tooling pillars for governing access at scale:

- **Policy Analyzer** — answers the audit question *"who can access what?"* You query, e.g., "which principals have `storage.objects.get` on this bucket?" and it computes the effective access across inheritance, conditions, and group memberships. Essential for access reviews and incident scoping ("who could have read this data?").
- **IAM Recommender** — analyses actual usage (via audit logs) and **recommends removing unused roles/permissions**, suggesting a tighter role that matches real behaviour. It surfaces over-privileged principals and helps you converge on least privilege without guessing.

Together they close the least-privilege loop: **Recommender** tells you where you over-granted, **Analyzer** lets you verify the effective access before and after. Both are part of the **Policy Intelligence** suite. Senior teams wire Recommender findings into periodic access-review workflows rather than treating IAM as set-and-forget.

### Q16. What is Cloud Identity and how does it relate to IAM?

**Cloud Identity** is Google's standalone **identity and access management layer** — the source of **users and groups** — for organisations that don't use Google Workspace. It provides account lifecycle, groups, SSO/SAML federation, 2-step verification, and device/endpoint management.

Relationship to GCP IAM:

- Cloud Identity (or Workspace) **owns the principals** — the `user:` and `group:` members you grant roles to.
- It's what **establishes the organization node** (the org is tied to a Cloud Identity/Workspace domain).
- GCP **IAM** then grants those identities roles on resources.

So the split is: **Cloud Identity = authentication + identity lifecycle** (who exists), **IAM = authorization** (what they can do in GCP). You typically federate Cloud Identity with an existing IdP (Okta, Azure AD) via SSO so people use one corporate login, and manage GCP access by placing them in **groups** that hold the IAM roles.

### Q17. Why separate billing administration from resource administration, and how?

**Principle:** the person who pays the bills shouldn't need production access, and the engineer who deploys shouldn't control the payment method or see org-wide spend. Separating them limits blast radius and satisfies segregation-of-duties requirements.

How:

- **Billing roles** are distinct: `roles/billing.admin` (manage billing accounts, link projects), `roles/billing.user` (link a project to a billing account), `roles/billing.viewer` (see costs). These live on the **billing account**, not the project resources.
- **Resource roles** (`roles/owner`, service-specific roles) live on projects/folders/org and control the actual infrastructure.

A typical setup: a **finance/FinOps group** holds `billing.admin` at the org's billing account and can see all spend and manage budgets, but has **no** resource roles. Engineering groups hold resource roles on their projects but at most `billing.user` to link a project. This way finance controls money, engineering controls infrastructure, and neither can quietly overreach into the other's domain.

### Q18. A leaked service-account key is discovered in a public repo. Walk through your response.

Treat it as an active credential compromise:

1. **Disable/revoke the key immediately** — `gcloud iam service-accounts keys delete <KEY_ID> --iam-account=<sa-email>`. This stops further use even before you understand blast radius.
2. **Scope the blast radius** — check the SA's roles (what could the attacker do?) and use **Cloud Audit Logs** / **Policy Analyzer** to see what the SA *did* while the key was live — data accessed, resources created, other identities touched.
3. **Rotate downstream** — if the SA could read secrets/keys, rotate those too; assume anything it could reach is compromised.
4. **Purge the key from history** — remove from the repo *and* rewrite git history (the commit still holds it); the repo being public means assume it's already scraped.
5. **Prevent recurrence** — enforce org policy `iam.disableServiceAccountKeyCreation`, migrate the workload to **Workload Identity Federation** or attached-SA/impersonation so **no key exists**, add secret scanning (pre-commit + server-side) to CI.

The senior framing: revoke first, investigate second, then eliminate the *class* of problem by going keyless — a leaked key that was never created can't hurt you.

## Compute Engine

### Summary

**What this topic covers**

GCP's **Infrastructure-as-a-Service** virtual machines — the most configurable, most "you own the OS" compute option, and the baseline every other compute service is compared against. Four concern areas live here. (1) **Machine shape** — the machine families (general-purpose E2/N-series, compute-optimised C-series, memory-optimised M-series, accelerator-optimised A/G-series), custom machine types, and the disk story (persistent disk vs local SSD, boot disks, images, instance templates). (2) **Scaling and resilience** — **managed instance groups (MIGs)** with autoscaling, autohealing, rolling updates/canary, and regional vs zonal placement. (3) **Cost** — **Spot/preemptible** VMs, **sustained-use** vs **committed-use** discounts, sole-tenant nodes, and right-sizing. (4) **Operations and security** — live migration and host maintenance, shielded and confidential VMs, the metadata server and default SA scopes, startup scripts, stopping vs deleting. The 17 questions run from "what machine family do I pick" to "design a resilient, cost-optimised fleet" and "when should this *not* be Compute Engine at all."

**Mental model**

Compute Engine is **rentable Linux/Windows boxes on Google's infrastructure**, and the whole game is choosing the right *shape*, the right *resilience*, and the right *price lever*. Shape = machine family (which balances vCPU:memory:accelerator) + size, with **custom machine types** when no predefined size fits. Resilience is almost never a single VM: you bake an **image**, describe the VM in an **instance template**, and let a **MIG** run N copies with **autohealing** (recreate unhealthy VMs) and **autoscaling** (add/remove on load), spread across zones with a **regional MIG**. Price has three big levers: run **Spot VMs** for interruptible work (deep discount, can be reclaimed), let **sustained-use discounts** apply automatically for steady VMs, and buy **committed-use discounts** for predictable baseline. The final mental check is *"should this even be a VM?"* — Compute Engine is the right answer when you need full OS control, GPUs, specific licensing, or lift-and-shift; **Cloud Run** or **GKE** are better when you have containers and want to stop managing machines.

**Key terms**

- **Machine family/type** — a shape (vCPU:memory ratio, accelerators). E2/N = general, C = compute-optimised, M = memory-optimised, A/G = accelerator.
- **Custom machine type** — pick your own vCPU/memory when predefined sizes waste money.
- **Persistent disk (PD)** — durable, network-attached, zonal or regional block storage; survives VM stop/delete (if kept).
- **Local SSD** — physically-attached, very fast, **ephemeral** — data lost on stop/terminate.
- **Image** — a bootable disk snapshot (OS + config) used to create instances.
- **Instance template** — an immutable spec (machine type, image, disks, network) used by MIGs.
- **Managed instance group (MIG)** — a fleet of identical VMs with autoscaling, autohealing, and rolling updates.
- **Autohealing** — MIG recreates VMs failing a health check.
- **Spot / preemptible VM** — deeply-discounted VMs Google can reclaim; preemptible has a 24h cap, Spot has no fixed cap.
- **Sustained-use discount (SUD)** — automatic discount for running a VM a large fraction of the month.
- **Committed-use discount (CUD)** — 1- or 3-year spend/resource commitment for a bigger discount.
- **Shielded / Confidential VM** — verified-boot integrity features / memory encrypted in use.

**Why interviewers ask this**

Compute Engine is where cloud fundamentals get concrete — cost, resilience, and security all show up in one place. Junior candidates provision a single big VM, put data on local SSD and lose it on a restart, run the default over-privileged SA, and never touch discounts. Senior candidates think in **fleets and templates** (MIG + autohealing + regional spread), pick the **cheapest correct machine family** and reach for **Spot for stateless/batch**, layer **CUDs on the steady baseline**, and lock down VMs with **least-privilege SAs**, minimal scopes, and shielded/confidential options where warranted. Crucially they know when *not* to use Compute Engine at all. The interviewer is probing whether you can build compute that's resilient, cheap, and secure — and whether you know the tradeoffs against Cloud Run and GKE.

**Common confusions**

- "Local SSD is just fast persistent disk" — it's **ephemeral**; stop or lose the VM and the data is gone. PD persists.
- "Preemptible and Spot are the same" — Spot is the newer model with **no 24-hour cap**; legacy preemptible VMs are force-stopped after 24h.
- "I have to apply sustained-use discounts" — SUDs are **automatic**; CUDs are the ones you actively purchase.
- "Stopping a VM stops all charges" — you stop paying for **vCPU/RAM** but still pay for **attached persistent disks** and reserved static IPs.
- "A MIG needs manual scaling" — MIGs autoscale on CPU/LB/custom metrics/schedule and autoheal on health checks; that's the point.
- "The default service account is fine" — it historically carries broad Editor; a compromised VM then owns the project. Use a dedicated least-privilege SA.

**What follows from this topic**

Compute Engine ties back to **IAM** (VMs run as service accounts; scopes and least privilege matter), to **VPC networking** (VMs live in regional subnets, firewall rules gate them), and to **Cloud Storage/disks** for state. The MIG + load balancer + autoscaling pattern is the classic resilient web tier. The "Compute Engine vs Cloud Run vs GKE" decision recurs across the whole compute story. Master the shape/resilience/cost/security quadrants here and the managed-compute topics read as "the same tradeoffs, less to operate."

### Q1. Walk through the Compute Engine machine families and when you'd pick each.

- **General-purpose (E2, N2/N2D, N4)** — balanced vCPU:memory for web servers, app backends, small-medium databases. **E2** is the cheap default; **N-series** offers more performance and features. Start here unless you have a specific need.
- **Compute-optimised (C-series, e.g. C3)** — highest per-core performance, high clock speeds. For CPU-bound work: gaming servers, HPC, ad-serving, tight-latency compute.
- **Memory-optimised (M-series)** — very high memory-to-core ratios. For large in-memory databases, SAP HANA, big caches.
- **Accelerator-optimised (A-series, G-series)** — attached GPUs/TPods for ML training/inference (**A** for large-scale training with high-end GPUs, **G** for cost-effective inference/graphics).

Plus **custom machine types** when predefined sizes waste vCPU or RAM.

Interview framing: default to **E2/N general-purpose**, move to **C** when CPU-bound, **M** when memory-bound, **A/G** when you need GPUs. Picking the wrong family is a common cost or performance mistake.

### Q2. What are custom machine types and when do they save money?

A **custom machine type** lets you specify exact **vCPU and memory** instead of accepting a predefined size (within family ratio limits).

They save money when your workload's resource profile **doesn't match predefined shapes** — the classic case being an app that needs, say, 6 vCPUs but only 8 GB RAM. A predefined type with 6 vCPUs might come with 24 GB RAM you don't use but still pay for. A custom type sizes to what you actually need, cutting waste.

Guidance: reach for custom types after **right-sizing analysis** shows predefined shapes leave you paying for idle vCPU or RAM. For steady workloads, combine a right-sized custom type with a **committed-use discount** for compounding savings. Don't over-optimise prematurely — start predefined, measure, then trim to custom if the waste is real.

### Q3. Persistent disk vs local SSD — what's the difference and when do you use each?

| | Persistent disk (PD) | Local SSD |
|---|---|---|
| Attachment | Network-attached | Physically attached to the host |
| Durability | Durable; survives VM stop/delete | **Ephemeral** — lost on stop/terminate/migrate |
| Performance | Good; scales with size/type | Very high IOPS, very low latency |
| Scope | Zonal or **regional** (replicated) | Tied to the specific host |
| Use for | Boot disks, databases, anything you must keep | Scratch space, caches, temp compute data |

**Persistent disk** is the default and the only safe place for state — it's network storage that persists independently of the VM (you can detach and reattach it, snapshot it, and a **regional PD** synchronously replicates across two zones for HA). **Local SSD** is blazing fast but **ephemeral**: perfect for scratch, swap, or a cache you can rebuild, catastrophic for anything you can't afford to lose. The classic junior mistake is putting a database on local SSD and losing it on the first host maintenance event.

### Q4. Explain images and instance templates.

- **Image** — a **bootable disk snapshot** capturing an OS and any baked-in configuration/software. You create VMs from public images (Debian, Ubuntu, Windows), from Google-provided or Marketplace images, or from **custom images** you build (e.g. with Packer) to bake in your app and dependencies for fast, consistent boots.
- **Instance template** — an **immutable specification** of a VM: machine type, boot image, disks, network, service account, metadata/startup script, tags. It's the blueprint a **MIG** uses to stamp out identical instances.

How they fit together: bake a **custom image** with your app, reference it in an **instance template**, and point a **MIG** at the template. To roll out a change you create a **new template** (templates are immutable) with a new image and do a **rolling update**. This image → template → MIG chain is the backbone of immutable, reproducible fleets on Compute Engine.

### Q5. What is a managed instance group (MIG) and what does it give you?

A **MIG** manages a fleet of **identical VMs** created from an **instance template**. It turns individual VMs into a self-managing, resilient group. Core capabilities:

- **Autoscaling** — add/remove instances based on CPU utilisation, load-balancer serving capacity, custom metrics, or schedules.
- **Autohealing** — a health check detects unhealthy instances and the MIG **recreates** them automatically.
- **Rolling updates & canary** — deploy a new template gradually, optionally to a subset first (canary), with configurable surge and disruption limits.
- **Regional or zonal placement** — a **regional MIG** spreads instances across multiple zones for HA; a zonal MIG lives in one zone.
- **Load-balancer integration** — MIGs are the backend for GCP load balancers.

In short, a MIG is how you run a **resilient, elastic, self-updating** tier on Compute Engine instead of babysitting individual VMs. It's the standard building block for a web/app tier behind a load balancer.

### Q6. Regional vs zonal MIGs — which and why?

- **Zonal MIG** — all instances in a **single zone**. Simpler, but the entire group dies if that zone has an outage.
- **Regional MIG** — instances **spread across multiple zones** in a region (typically three). Survives a single-zone failure; the recommended default for production.

Choose **regional** for anything that needs HA: if one zone goes down, the MIG still serves from the others and autohealing/autoscaling rebuilds capacity in healthy zones. Choose **zonal** only when you have a specific reason — e.g. tight coupling to a zonal resource, or a dev/batch workload where a zone outage is acceptable.

Senior note: a regional MIG behind a **global or regional load balancer** with **autohealing** is the canonical resilient web tier — no single zone is a point of failure, and capacity self-repairs.

### Q7. What signals can drive MIG autoscaling?

A MIG autoscaler can scale on:

- **CPU utilisation** — target an average CPU (e.g. keep the fleet at 60%); simplest and most common.
- **Load-balancer serving capacity** — scale to keep each instance within its configured request/utilisation target from the LB.
- **Custom / Cloud Monitoring metrics** — scale on an application-specific signal (queue depth, requests-in-flight, latency).
- **Schedule-based** — pre-scale for known traffic patterns (business hours, a launch, a nightly batch).

You can combine signals; the autoscaler takes the recommendation that requires the **most** instances (scale-out is aggressive, scale-in is cautious to avoid thrashing).

Design tip: **CPU or LB capacity** covers most web tiers; **custom metrics** shine for queue-worker fleets (scale on backlog); **scheduled** scaling handles predictable spikes so you're not waiting on reactive scale-out during a known peak. Pre-raise **CPU quota** for the region so autoscaling can actually reach its max.

### Q8. Preemptible vs Spot VMs — explain the discount and the tradeoffs.

Both are **deeply discounted** (often 60–91% off) VMs that Google can **reclaim** when it needs the capacity. Differences:

| | Preemptible (legacy) | Spot (current) |
|---|---|---|
| Max lifetime | **Forced stop after 24h** | **No 24-hour cap** — runs until reclaimed |
| Reclaim notice | ~30s termination signal | ~30s termination signal |
| Recommendation | Legacy; prefer Spot | The modern choice |

Tradeoff: you trade **reliability for cost**. They can vanish with ~30 seconds notice, so they suit **fault-tolerant, stateless, or checkpointable** work: batch/ETL, CI runners, rendering, big-data processing, stateless web behind a MIG that mixes Spot with on-demand.

Handling termination: catch the preemption notice (metadata/ACPI signal) to **checkpoint work, drain connections, and exit cleanly**. Never put un-checkpointed state or a stateful database on Spot. Pattern: a MIG with a **mix of Spot and standard VMs** gets most of the savings while keeping a reliable floor of capacity.

### Q9. Sustained-use vs committed-use discounts — how do they differ?

Two automatic-vs-purchased cost levers for **steady** workloads (not Spot):

- **Sustained-use discounts (SUDs)** — **applied automatically** the longer a VM (certain families) runs within a month. Run it a large fraction of the month and Google discounts it incrementally, up to a meaningful percentage, with **no commitment and no action** from you.
- **Committed-use discounts (CUDs)** — you **commit** to a certain amount of resource (or spend) for **1 or 3 years** in exchange for a **larger discount** (often up to ~57% for resource commitments, more for 3-year). You pay whether or not you use it.

Strategy: SUDs reward you automatically for steady usage; **CUDs are the deliberate optimisation** — analyse your stable **baseline** capacity and cover it with CUDs, let SUDs handle the rest, and use **Spot** for the interruptible peak. Layering all three against baseline/variable/interruptible tiers is how mature teams cut a big compute bill.

### Q10. What are sole-tenant nodes and when do you need them?

A **sole-tenant node** is a **physical server dedicated entirely to your project** — no other customers' VMs share the hardware. Your VMs run on host hardware you don't share.

When you need them:

- **Compliance / regulatory** requirements mandating physical isolation (some finance, healthcare, government workloads).
- **Licensing** — bring-your-own-license models tied to physical cores/sockets (some enterprise software licenses per physical CPU).
- **Performance predictability** — eliminating "noisy neighbour" effects for latency-sensitive workloads.

Tradeoff: you pay a premium for the dedicated hardware and take on some placement management. For the vast majority of workloads, standard multi-tenant VMs (already strongly isolated by the hypervisor) are fine — reach for sole-tenant only when **physical isolation** is an explicit requirement, not a vague performance wish.

### Q11. Explain live migration and host maintenance.

Google periodically performs **host maintenance** (hardware/software updates) on the physical servers your VMs run on. **Live migration** moves a running VM to another host **without rebooting it** — the VM keeps running, memory and connections intact, through the maintenance event.

You control behaviour via the VM's **on-host-maintenance** policy:

- **MIGRATE** (default for most VMs) — Google live-migrates the VM; no downtime.
- **TERMINATE** — the VM is stopped (and optionally auto-restarted). Required for VMs with **GPUs** or **local SSD** and for some configurations that can't be migrated.

Why it matters: live migration is a big reliability advantage — your general-purpose VMs survive routine maintenance transparently. But know the exceptions: **GPU VMs and local-SSD VMs terminate** rather than migrate, so those workloads must tolerate scheduled restarts (checkpoint, use MIGs, design for it). Spot VMs, of course, can be terminated at any time regardless.

### Q12. What are shielded VMs and confidential VMs?

Two distinct hardening features:

- **Shielded VM** — protects against **boot- and kernel-level rootkits/bootkits** using **Secure Boot**, **vTPM** (virtual Trusted Platform Module), and **measured boot / integrity monitoring**. It verifies the boot chain hasn't been tampered with. Low overhead; enable it broadly as a baseline for sensitive workloads.
- **Confidential VM** — encrypts the VM's memory **while in use** (data-in-use protection) using hardware-based memory encryption (e.g. AMD SEV). Even Google (and a compromised hypervisor) can't read the VM's in-memory data. For workloads processing highly sensitive data where you must protect data even from the infrastructure operator.

Distinction: **shielded = boot integrity** (is my VM booting untampered?), **confidential = data-in-use confidentiality** (is my running memory encrypted?). They're complementary — a confidential VM can also be shielded. Use shielded as a cheap default; add confidential when data-in-use protection is a real requirement.

### Q13. Explain the metadata server and default service account scopes.

Every VM can reach the **metadata server** at `http://metadata.google.internal` (`169.254.169.254`) — an internal-only endpoint exposing instance metadata and, importantly, **short-lived OAuth tokens** for the VM's attached service account. This is how a VM authenticates to GCP APIs **without any key**: the client library fetches a token from the metadata server automatically.

```bash
curl -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
```

**Access scopes** are a legacy OAuth-based coarse limit on *which APIs* the VM's token can call (e.g. read-only storage). Modern practice: rely on **IAM roles on a dedicated service account** for fine-grained control and set scopes to **cloud-platform**, letting IAM do the real gating — but understand scopes still cap what tokens can do on older setups.

Security note: because the metadata server hands out tokens, an **SSRF** vulnerability that can reach it is dangerous; that's part of why you run a **least-privilege SA**, not the broad default.

### Q14. What are startup scripts and what are they for?

A **startup script** is code (shell or PowerShell) that runs **automatically when a VM boots**, provided via instance metadata (inline or from a Cloud Storage object).

Uses:

- **Bootstrap configuration** — install packages, pull config, register with a service, mount disks, start the app.
- **Fleet consistency** — combined with an instance template, every MIG instance runs the same startup script, so new/replaced VMs come up identically.
- **Late-binding config** — fetch secrets or environment-specific settings at boot rather than baking them into the image.

```bash
gcloud compute instances create web-1 \
  --metadata-from-file startup-script=./startup.sh
```

Best practice: keep startup scripts **thin**. For anything non-trivial, **bake a custom image** (Packer) so boot is fast and deterministic, and use the startup script only for the small amount of late-binding config. Fat startup scripts make boots slow and flaky and are hard to debug at scale.

### Q15. What are right-sizing recommendations and how do you use them?

**Right-sizing recommendations** (part of Compute Engine / Recommender) analyse a VM's **actual CPU and memory usage over time** and suggest a **smaller (or occasionally larger) machine type** that fits the real load — flagging over-provisioned instances you're overpaying for.

How to use them:

- **Review regularly** — surface VMs running at, say, 10% CPU and downsize them (or move to a **custom machine type** matched to usage).
- **Feed a FinOps loop** — right-sizing is one of the highest-ROI cost actions because idle capacity is pure waste.
- **Combine with discounts** — right-size first, *then* buy committed-use discounts on the correct baseline (don't commit to oversized VMs).

Caution: right-size to **real peaks**, not just averages — a VM that idles but spikes at month-end needs headroom for the spike. Automate the review but keep a human check on latency-sensitive workloads before shrinking them.

### Q16. Stopping vs deleting a VM — what happens to charges and data?

- **Stopping** — the VM is powered off. You **stop paying for vCPU and memory**, but you **keep paying for**: attached **persistent disks** (they persist), any **reserved static external IPs**, and snapshots/images. The instance and its config remain; you can start it again with the same disks and (internal) identity.
- **Deleting** — the instance is removed. By default its **boot disk is deleted** too (unless you set "keep disk" / the disk's auto-delete is off). Additional PDs persist or not per their auto-delete setting. Static IPs remain reserved (and billable) until released.

Key gotchas: **stopping is not "free"** — disks and static IPs keep billing, so a fleet of stopped VMs with big disks still costs money. And **deleting can lose data** if a disk's auto-delete is on. To pause a workload cheaply, stop it *and* consider whether the disks are worth keeping; to fully decommission, delete and explicitly clean up disks and IPs.

### Q17. Compute Engine vs Cloud Run vs GKE — how do you choose?

| | Compute Engine | Cloud Run | GKE |
|---|---|---|---|
| Abstraction | VMs (you own the OS) | Serverless containers | Managed Kubernetes |
| You manage | OS, patching, scaling infra | Just a container | Cluster/workloads (less with Autopilot) |
| Scaling | MIG autoscaling | Auto, to zero | HPA/cluster autoscaler |
| Best for | Full OS control, GPUs, licensing, lift-and-shift | Stateless HTTP/event services, fast to ship | Complex microservices, portability, fine control |

Decision guide:

- **Cloud Run** — default for a **stateless containerised** service or API. Scales to zero, no infra to manage, fastest path to production. Start here unless you have a reason not to.
- **GKE** — when you have **many microservices**, need Kubernetes primitives (service mesh, complex networking, StatefulSets), want **multi-cloud portability**, or need fine-grained control. Use **Autopilot** to shed node management.
- **Compute Engine** — when you need **full OS control**, specific **GPUs/drivers**, **licensing tied to VMs**, non-containerised or legacy apps, or a straight **lift-and-shift**.

Senior framing: prefer the **most managed option that fits** — Cloud Run < GKE < Compute Engine in operational burden — and drop to a lower level only when a real requirement forces it. Don't run a single hand-managed VM for something Cloud Run would host for less effort and cost.
## Serverless Compute: Cloud Run, Cloud Functions & App Engine

### Summary

**What this topic covers**

GCP's serverless compute spectrum — the three products you reach for when you don't want to manage VMs or Kubernetes. **Cloud Run** (run any container, request-driven, scale-to-zero) is the modern default and the centre of gravity for this topic. **Cloud Functions** (function-as-a-service, event-driven glue) — where gen2 is now literally Cloud Run underneath. **App Engine** (the original 2008 PaaS, standard vs flexible) — still supported, rarely the right new-build choice. The 17 questions here cover concurrency (Cloud Run's headline differentiator vs AWS Lambda), cold starts and how to kill them, CPU allocation modes, jobs vs services, traffic splitting across revisions, VPC connectivity, IAM invoker semantics, secrets, idempotency, and the "when do I pick each" decision. The through-line: **containers everywhere** — GCP's serverless story converged on the container as the unit of deployment.

**Mental model**

Think of GCP serverless as one spectrum ordered by how much you hand over. App Engine hands over the most (you give it code, it decides almost everything) but is the most opinionated and legacy. Cloud Functions hands over a single function and an event source. Cloud Run hands over a **container that speaks HTTP** and nothing else — you keep full control of the runtime, base image, and binaries, but Google runs the fleet, autoscaler, and TLS. The key insight that trips up people coming from AWS Lambda: **Cloud Run instances handle many concurrent requests** (default 80, up to 1000), not one-at-a-time. So one warm instance serves a burst; you're billed for instance-time, not per-invocation-times-duration. This changes cost math, connection-pool sizing, and how you reason about cold starts entirely. Everything scales **to zero** by default (you pay nothing idle), and everything scales **up** by adding instances. Set **min-instances** to trade money for latency (no cold starts); set **max-instances** to protect downstream databases from a scale-out stampede.

**Key terms**

- **Cloud Run service** — request-driven, autoscaling HTTP/gRPC container endpoint; scales 0→N on traffic.
- **Cloud Run job** — run-to-completion container (batch/ETL/migrations); no request listener, exits when done.
- **Concurrency** — max simultaneous requests one Cloud Run instance handles (default 80). Lambda is effectively 1.
- **Cold start** — latency when a new instance boots from zero; mitigated by min-instances, gen2, slim images.
- **Min instances** — warm pool kept alive to eliminate cold starts (you pay for idle CPU/memory).
- **CPU allocation** — "CPU always allocated" (background work, billed for lifetime) vs "CPU only during requests" (cheaper, throttled between requests).
- **Revision** — immutable snapshot of a Cloud Run deploy; traffic is split across revisions by percentage.
- **Cloud Functions gen2** — FaaS built *on* Cloud Run + Eventarc; inherits concurrency, longer timeouts, bigger instances.
- **Eventarc** — routes events (Cloud Audit Logs, Pub/Sub, direct sources) to Cloud Run/Functions via CloudEvents.
- **Serverless VPC Access connector** — bridge letting serverless reach private VPC IPs (Cloud SQL private IP, Memorystore).
- **Direct VPC egress** — newer connector-less path from Cloud Run into a VPC (lower latency, no connector to size).
- **Buildpacks** — `--source` deploy path: Google builds an OCI image from your source, no Dockerfile needed.

**Why interviewers ask this**

Serverless compute is where architecture judgement shows. A junior answer is "Cloud Run runs containers, Functions runs functions." A senior answer explains **why concurrency changes the cost and connection-pooling story**, when scale-to-zero hurts (latency-sensitive, JVM cold starts, database connection storms), and how to bound a Cloud Run service so it doesn't exhaust a Cloud SQL connection limit under load. Interviewers also probe the convergence story — knowing that Functions gen2 *is* Cloud Run signals you're current, not repeating 2019 knowledge. And the "when do I pick each" question separates people who cargo-cult serverless from people who know its failure modes (long-running work, stateful workloads, sub-10ms latency floors, unpredictable spend under abuse).

**Common confusions**

- "Cloud Run handles one request per instance like Lambda" — no, it's concurrent (default 80). This is the single biggest AWS-transfer mistake.
- "Scale-to-zero is always good" — it means cold starts on the first request after idle, and it opens a connection storm when it scales back up.
- "Cloud Functions and Cloud Run are unrelated" — gen2 Functions run on Cloud Run; the line is mostly packaging and trigger ergonomics now.
- "Cloud Run needs a Dockerfile" — `gcloud run deploy --source .` uses buildpacks; no Dockerfile required.
- "min-instances = max-instances = fixed fleet" — min is the warm floor, max is the ceiling; they're independent knobs.
- "CPU is always available" — with "CPU only during requests," CPU is throttled between requests, so background timers/async work silently stall.

**What follows from this topic**

Cloud Run is the pivot point of GCP compute: it competes downward with App Engine and Functions, and upward with **GKE** (the next topic) — the "Cloud Run vs GKE" decision is a recurring interview scenario. Its VPC connectivity ties into networking; its need for a database ties into Cloud SQL/Spanner; its event triggers tie into Pub/Sub and Eventarc; and its container images live in **Artifact Registry**, which the GKE topic also leans on. Get the concurrency and scaling model solid here — it recurs everywhere serverless meets a stateful backend.

### Q1. What is Cloud Run and how does it differ from AWS Lambda?

**Cloud Run** runs any stateless container that listens on a port (HTTP/gRPC/WebSocket). You hand Google an OCI image; it runs a fleet, autoscales 0→N on request volume, terminates TLS, and gives you a URL. Roughly Fargate + App Runner in one product.

The headline difference from Lambda is **concurrency**. A Lambda instance processes **one** event at a time; N concurrent requests = N instances. A Cloud Run instance handles **many** concurrent requests (default 80, configurable up to 1000). So:

- One warm Cloud Run instance absorbs a burst; you provision far fewer instances.
- **Billing** is per-instance-time (vCPU-seconds + memory-seconds while an instance exists), not per-invocation × duration.
- **Connection pooling** actually works — one instance amortises a DB pool across many requests, unlike Lambda where each concurrent invocation opens its own connections.

Other differences: Cloud Run takes **any** container (any language/binary), request timeout up to 60 minutes, up to 32 GiB / 8 vCPU per instance. Lambda is 15-minute max and a curated runtime set.

### Q2. Explain Cloud Run's concurrency model and why it matters.

Concurrency is the max number of requests a single instance serves simultaneously. Default **80**, tunable 1–1000.

Why it's the most important knob:

- **Cost.** At concurrency 80, 80 concurrent requests cost one instance. At concurrency 1 (Lambda-style), they cost 80 instances. Higher concurrency = fewer instances = lower bill — *if* your code is genuinely concurrent (async I/O, not CPU-bound).
- **Downstream pressure.** Each instance holds one DB connection pool. Fewer instances (higher concurrency) = fewer total connections to Cloud SQL. This is often the deciding factor when Cloud SQL has a hard connection cap.
- **When to set it to 1.** If your container isn't thread-safe, uses a per-request global, or is CPU-bound (image processing, ML inference) so overlapping requests just fight over CPU — pin concurrency to 1 and scale by instances instead.

Rule of thumb: I/O-bound web service → high concurrency (60–100). CPU-bound or non-thread-safe → low concurrency (1–4).

### Q3. What is a cold start and how do you mitigate it on Cloud Run?

A **cold start** is the latency when a request arrives and no warm instance exists — Google must schedule an instance, pull the image, boot the container, and run your startup code before the first response.

Mitigations, in order of leverage:

1. **Min instances.** Keep a warm floor (`--min-instances=1+`). The first request never pays a cold start. You pay for idle instances (at a reduced idle CPU rate), so it's a money-for-latency trade.
2. **Startup CPU boost** (`--cpu-boost`) — temporarily gives extra CPU during startup to speed JVM/Node bootstrap.
3. **Slim images.** A 1 GB image pulls slower than a 100 MB distroless one. Multi-stage builds, distroless/alpine bases.
4. **Lazy-init heavy work** or move it out of the request path; defer connection-pool warmup where safe.
5. **gen2 execution environment** — better cold-start and CPU behaviour for many workloads.

For a latency-SLO service, `min-instances` is the real answer; everything else shaves the tail.

### Q4. Explain Cloud Run's CPU allocation modes.

Two modes:

- **CPU only allocated during request processing** (default) — CPU is available while handling a request and **throttled to near-zero between requests**. Cheapest. Correct for pure request/response services. Gotcha: background work (setInterval timers, async flushes, queue consumers, telemetry batching) *stalls* between requests because the CPU is throttled.
- **CPU always allocated** — CPU stays available for the instance's whole lifetime. Required if you do background processing, run a Pub/Sub pull subscriber inside the service, stream, or need reliable async flushing. Costs more (billed for CPU the whole time) but enables always-on behaviour and is also required/priced differently for min-instance idle.

Pick "always allocated" when work happens outside the request lifecycle; otherwise default to request-only and save money.

### Q5. What's the difference between Cloud Run services and jobs?

- **Service** — listens for requests, autoscales on traffic, meant to run indefinitely, has a URL. For APIs, web apps, event consumers.
- **Job** — runs a container **to completion** and exits. No request listener, no URL. For batch work: DB migrations, nightly ETL, report generation, backfills. Supports parallelism (multiple tasks) and array-style task indices, plus retries. Triggered manually, by Cloud Scheduler, or from a workflow.

Anti-pattern: hosting a "batch endpoint" as a service and hitting it with a scheduler — a **job** is the right primitive; it doesn't need to stay warm, doesn't need an HTTP surface, and reports task success/failure natively.

### Q6. What is Cloud Run gen2 and how does it differ from gen1?

Cloud Run has two **execution environments**:

- **gen1** — fast cold starts, lightweight, but a partial Linux emulation (some syscalls, no full network filesystem support, no in-container GPU).
- **gen2** — full Linux compatibility: network file system mounts (e.g. Cloud Storage FUSE, Filestore/NFS), faster CPU/network for sustained work, larger memory, GPU support. Slightly slower minimal cold start than gen1 but better under real workloads.

Choose gen2 when you need filesystem mounts, GPUs, or heavier compute; gen1 for the lightest, spikiest request/response services. (Note this is distinct from Cloud *Functions* gen1/gen2, which is a different versioning of the Functions product.)

### Q7. How does traffic splitting and revision management work in Cloud Run?

Every deploy creates an immutable **revision**. Traffic is a percentage map over revisions, so you get progressive delivery natively:

```bash
# Deploy without taking traffic
gcloud run deploy my-svc --image=REGION-docker.pkg.dev/my-project/repo/app:v2 --no-traffic --tag=canary
# Send 10% to the new revision
gcloud run services update-traffic my-svc --to-tags=canary=10
# Promote to 100% when healthy
gcloud run services update-traffic my-svc --to-latest
```

You get: **canary** rollouts, **blue/green** (split 0/100 then flip), instant **rollback** (shift traffic back to the prior revision — it's still there), and per-revision **tagged URLs** for testing a revision directly without taking production traffic. This is one of Cloud Run's best features and worth calling out in a design answer.

### Q8. When would you choose Cloud Run over GKE?

**Cloud Run** when: the workload is a stateless HTTP/event container, you want zero cluster ops, scale-to-zero economics, and per-request autoscaling. It's the default for most services and internal APIs.

**GKE** when you need something Cloud Run can't give:

- Non-HTTP or long-lived stateful workloads (StatefulSets, databases, daemons).
- Fine-grained control: sidecars, service mesh (Istio/Anthos), custom schedulers, DaemonSets, node-level tuning, GPUs at scale with bin-packing.
- Many services sharing a cluster where per-service Cloud Run overhead or cost doesn't fit.
- Existing Kubernetes investment / portability across clouds.

Rule of thumb: **start on Cloud Run; graduate to GKE when you hit its ceiling** (mesh, stateful, complex scheduling, cost at very high steady utilisation). Don't reach for GKE's operational burden speculatively.

### Q9. What are Cloud Functions, and what's the difference between gen1 and gen2?

**Cloud Functions** is function-as-a-service: deploy a single handler, GCP wires it to a trigger and runs it.

- **gen1** — the original FaaS. One request per instance (no concurrency), 9-minute max timeout, smaller instances, triggers via legacy event sources.
- **gen2** — built **on top of Cloud Run and Eventarc**. It inherits Cloud Run's superpowers: **request concurrency**, up to 60-minute timeouts, larger instances (up to 32 GiB / 8 vCPU), traffic splitting/revisions, and a much broader trigger surface via Eventarc.

Because gen2 *is* Cloud Run under the hood, the practical guidance is: use **gen2** for new work unless you specifically need a gen1-only behaviour. The distinction between "Function" and "Run service" is increasingly about packaging ergonomics (source-based single handler vs full container) rather than capability.

### Q10. What triggers can invoke Cloud Functions?

- **HTTP** — direct HTTPS endpoint; authenticated (IAM invoker) or public.
- **Pub/Sub** — message on a topic invokes the function (classic async fan-out).
- **Cloud Storage** — object finalize/delete/archive/metadata-update events (via Eventarc in gen2).
- **Eventarc / Cloud Audit Logs** — react to almost any GCP admin action (e.g. "a BigQuery job completed," "a VM was created") as a CloudEvent. This is gen2's big reach.
- **Firestore** document changes, **Firebase** events (auth, RTDB), and **Cloud Scheduler** (via HTTP or Pub/Sub) for cron.

gen2 routes most non-HTTP events through **Eventarc**, which normalises everything to CloudEvents and is the same plumbing Cloud Run uses.

### Q11. When would you pick App Engine, and what's standard vs flexible?

**App Engine** is GCP's original PaaS (2008). Two environments:

| | Standard | Flexible |
|---|---|---|
| Runtime | Sandboxed, curated languages | Any runtime in a container (Docker) |
| Scaling | Scales to zero, very fast | Runs on managed Compute Engine VMs; slower scale, no true scale-to-zero |
| Startup | Milliseconds | Minutes (VM boot) |
| Use | Spiky web apps, legacy | Custom runtimes, background/socket needs |

**Positioning today:** App Engine is **legacy-favoured**. For new builds, Cloud Run supersedes both environments — it gives you flexible's "any container" plus standard's scale-to-zero, with better tooling. Pick App Engine mainly when maintaining an existing app or when a team is deeply invested in its bundled services (Task Queues, memcache, `ndb`). In an interview, framing App Engine as "the PaaS Cloud Run learned from, now the default only for legacy" is the right altitude.

### Q12. How do serverless services connect to resources in a private VPC?

By default Cloud Run/Functions run outside your VPC and can only reach public endpoints. To reach private IPs (Cloud SQL private IP, Memorystore Redis, internal load balancers, on-prem via VPN/Interconnect) you need one of:

- **Serverless VPC Access connector** — a managed set of instances that bridges serverless egress into a VPC subnet. You size it (throughput scales with instance count/type). Longer-standing option; the connector is a resource you provision and pay for.
- **Direct VPC egress** — newer, **connector-less**. The Cloud Run service gets an interface directly in the VPC subnet. Lower latency, no connector to size or pay for, better scaling. Preferred for new setups where available.

You also control **egress settings**: route *all* traffic through the VPC (so even internet egress uses your NAT/firewall/static IP) vs only private-range traffic. Routing all egress through Cloud NAT is how you give a serverless service a **stable outbound IP** for allowlisting.

### Q13. Explain Cloud Run IAM: authenticated vs public, and the invoker role.

Access is gated by the **`roles/run.invoker`** IAM role on the service:

- **Public** — grant `run.invoker` to `allUsers`. Anyone can hit the URL. Fine for public websites/APIs.
- **Authenticated** — don't grant `allUsers`; grant `run.invoker` only to specific identities (users, groups, or **service accounts**). Callers must present a Google-signed **ID token** with the right audience.

Service-to-service is the important pattern: service A calls service B using **A's service account identity**, and B is configured to require auth and only allows A's SA the invoker role:

```bash
gcloud run services add-iam-policy-binding service-b \
  --member="serviceAccount:svc-a@my-project.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

This gives you zero-trust service auth without managing keys or an API gateway. For public internet exposure with WAF/rate limiting, front it with an external HTTPS Load Balancer + Cloud Armor and keep the service itself authenticated to the LB.

### Q14. How should serverless workloads handle secrets?

Use **Secret Manager**, not environment-variable plaintext or baked-into-image secrets.

Two integration styles on Cloud Run/Functions:

- **Mount as environment variable** — bind a secret version to an env var; the platform fetches it at instance start. Simple, but the value sits in the process env.
- **Mount as a file (volume)** — the secret appears at a path; you read it at runtime. Supports rotation better (mount `latest` and re-read).

```bash
gcloud run deploy my-svc \
  --set-secrets=DB_PASSWORD=my-db-password:latest \
  --image=REGION-docker.pkg.dev/my-project/repo/app:v1
```

The service's **runtime service account** needs `roles/secretmanager.secretAccessor` on the secret. Reference `:latest` to pick up rotations (with a restart), or pin a version for reproducibility. Never put secrets in build args or the image — they're extractable from layers.

### Q15. Why does idempotency matter for event-driven serverless, and how do you achieve it?

Because event delivery is **at-least-once**. Pub/Sub (and therefore Eventarc-triggered Functions/Run) can deliver the same message more than once — on retry after a timeout, on redelivery, or on ack-deadline expiry. If your handler isn't idempotent, duplicates cause double charges, double emails, duplicate rows.

Achieve idempotency by:

- **Dedup on a stable key.** Use the Pub/Sub `messageId` or a business key; record processed IDs in Firestore/Redis/a DB unique constraint and skip if seen.
- **Make writes idempotent.** Upserts keyed by the event ID; conditional writes; `INSERT ... ON CONFLICT DO NOTHING`.
- **Design side effects to be safe to repeat** (set-to-value rather than increment; or increment guarded by a dedup table).

Also set a sensible **ack deadline** and a **dead-letter topic** so a poison message doesn't retry forever. "The system is at-least-once, so my handler is idempotent" is exactly the sentence a senior candidate says here.

### Q16. What does "containers everywhere" mean for GCP serverless, and how do you deploy from source?

GCP's serverless story **converged on the container** as the deployment unit. Cloud Run runs containers; Cloud Functions gen2 packages your function *into* a container and runs it on Cloud Run; App Engine flexible is containers. One artifact type, one registry (Artifact Registry), one autoscaler model. The benefit: no lock-in to a proprietary packaging format, full control of the runtime, and easy local reproduction (`docker run`).

You don't have to write a Dockerfile, though. **Buildpacks** (Google Cloud Buildpacks, CNCF standard) turn source into an OCI image automatically:

```bash
gcloud run deploy my-svc --source .   # detects language, builds an image, deploys
```

This detects Node/Python/Go/Java/etc., produces a hardened image, pushes it to Artifact Registry, and deploys — no Dockerfile. Write a Dockerfile only when you need custom system packages or a specific base. This is the sweet spot: FaaS-like ergonomics with container portability underneath.

### Q17. Design: a spiky public API backed by Cloud SQL that must not exhaust DB connections. What Cloud Run settings do you use?

The failure mode: traffic spikes → Cloud Run scales out to many instances → each instance opens a DB pool → Cloud SQL hits its connection limit → everything errors. Fix it with the scaling and concurrency knobs:

1. **Cap `--max-instances`** so `max_instances × pool_size_per_instance ≤ Cloud SQL max_connections` (leaving headroom for admin/other clients). This is the primary guardrail.
2. **Raise concurrency** (e.g. 80–100) so fewer instances serve the same load — fewer instances = fewer total connections. Higher concurrency directly reduces DB pressure for I/O-bound work.
3. **Small per-instance pool** (e.g. 2–5 connections) sized so the product stays under the cap.
4. **Connect over private IP** via Direct VPC egress (or the Cloud SQL connector), not public IP.
5. **`--min-instances=1+`** to avoid cold starts and a connection storm on the first spike, and to keep pools warm.
6. Consider **Cloud SQL Auth Proxy / connection pooler (PgBouncer)** or a managed pooler in front if instance count must stay high.

The senior insight is that on Cloud Run you defend the database primarily by bounding **max-instances** and lifting **concurrency**, because instances — not requests — are what open connections.

## Containers: GKE

### Summary

**What this topic covers**

Google Kubernetes Engine — Google's managed Kubernetes, and the "real Kubernetes" tier of GCP compute above Cloud Run. The 16 questions cover the decision that dominates GKE today: **Autopilot vs Standard** (who owns the nodes, per-pod vs per-node billing). Then the scaling stack (cluster autoscaler, node auto-provisioning, HPA, VPA), cluster topology (regional vs zonal control-plane HA), GKE networking (VPC-native/alias IPs, the three CIDR ranges, private clusters, Gateway API, container-native load balancing via NEGs), **Workload Identity** (the correct pods-to-GCP-auth mechanism), release channels and auto-upgrade/repair, the config/fleet management layer (Config Connector, Config Sync, Anthos/fleets), Artifact Registry + image scanning + Binary Authorization, secrets via CSI, and cost optimisation (Spot node pools, bin-packing, Autopilot). GKE ≈ EKS, but with deeper Google integration and the Autopilot mode AWS has no direct equal for.

**Mental model**

Kubernetes has a **control plane** (API server, scheduler, etcd, controllers) and **data plane** (worker nodes running your pods). GKE always manages the control plane for you. The Autopilot-vs-Standard choice is about the **data plane**: in **Standard** you own node pools — you pick machine types, count, autoscaling, and you pay per node (even for unused capacity). In **Autopilot** Google owns the nodes entirely — you just submit pods with resource requests, and you pay **per pod's requested resources**. Autopilot is "Kubernetes as an API without node ops"; Standard is "managed control plane, your nodes, your knobs." The second mental shift: GKE is **VPC-native** — pods and services get real VPC IPs from **alias IP ranges**, so they're first-class in your network (routable, firewall-able, load-balanceable via NEGs) rather than hidden behind node NAT. The third: authentication from pods to GCP APIs should go through **Workload Identity** (federating a Kubernetes service account to a GCP service account), never through mounted SA key files.

**Key terms**

- **Autopilot** — fully-managed nodes; pay per pod resource request; Google enforces security/best-practice defaults.
- **Standard** — you manage node pools and pay per node; maximum control and flexibility.
- **Node pool** — a group of identically-configured nodes (machine type, disk, labels); the unit of node scaling/upgrade.
- **Node auto-provisioning (NAP)** — cluster autoscaler creates *new node pools* automatically to fit pending pods' shapes.
- **Cluster Autoscaler** — adds/removes *nodes* based on unschedulable pods and utilisation.
- **HPA / VPA** — Horizontal Pod Autoscaler scales replica *count*; Vertical Pod Autoscaler tunes pod CPU/memory *requests*.
- **Regional cluster** — control plane replicated across 3 zones (HA); zonal cluster has a single-zone control plane.
- **VPC-native / alias IPs** — pods and services get VPC IP ranges (secondary ranges on the subnet), not host-routed overlay.
- **Workload Identity** — bind a Kubernetes SA to a GCP SA so pods get short-lived GCP credentials, no keys.
- **Release channel** — Rapid/Regular/Stable auto-upgrade track that governs version cadence and auto-upgrade/repair.
- **NEG (Network Endpoint Group)** — lets Google's load balancer send traffic **directly to pod IPs** (container-native LB), skipping the node hop.
- **Binary Authorization** — deploy-time policy that only lets attested/trusted images run.

**Why interviewers ask this**

GKE questions separate "I ran `kubectl apply`" from "I operate clusters." The Autopilot-vs-Standard question is the single best signal — it forces you to reason about cost model (per-pod vs per-node), operational burden, and control tradeoffs simultaneously. Workload Identity is the security litmus test: a candidate who says "mount a service-account JSON key into the pod" fails it; the right answer is Workload Identity, and knowing *why* (no long-lived keys to leak or rotate) shows security maturity. Interviewers also probe scaling (do you know HPA scales replicas while the cluster autoscaler scales nodes, and that they cooperate?), networking (VPC-native, private clusters), and cost (Spot pools, bin-packing) — because GKE bills are where naive setups bleed money.

**Common confusions**

- "Autopilot is just Standard with autoscaling on" — no; in Autopilot you can't SSH to nodes or manage node pools at all, and you're billed per pod request, not per node.
- "HPA and the cluster autoscaler are the same" — HPA adds *pods*; the cluster autoscaler adds *nodes* to fit those pods. They work together.
- "Regional cluster means my workloads are HA" — regional refers to the **control plane** (and lets you spread nodes across zones); you still must schedule replicas across zones for workload HA.
- "Use a service-account key file for pod auth" — use **Workload Identity**; keys are a leak/rotation liability.
- "Services get overlay IPs" — GKE is VPC-native; pods/services get real VPC alias IPs and can be load-balanced directly via NEGs.
- "Private cluster means no internet" — it means nodes have no public IPs; egress still works via Cloud NAT, and you reach the API via authorized networks / private endpoint.

**What follows from this topic**

GKE sits directly above **Cloud Run** — the "Cloud Run vs GKE" decision recurs and should be answered from the serverless topic's ceiling. Its images live in **Artifact Registry** (shared with serverless). Its networking (VPC-native, private clusters, NAT, load balancing) is the container-shaped view of the networking topic. Its identity story (Workload Identity, service accounts) is IAM applied to workloads. And its cost levers (Spot, bin-packing, Autopilot) preview the cost-optimisation pillar that runs through the whole primer. If you understand GKE's control-plane/data-plane split and VPC-native networking, the rest of GCP compute slots in around it.

### Q1. Explain GKE Autopilot vs Standard.

The core difference is **who manages the nodes and how you're billed**.

| | Autopilot | Standard |
|---|---|---|
| Nodes | Google-managed; no node pools to size, no SSH | You own node pools, machine types, counts |
| Billing | Per **pod** resource requests (CPU/mem/storage) | Per **node** (you pay for the whole VM, used or not) |
| Ops burden | Minimal; Google enforces hardened defaults | You patch, size, and tune nodes |
| Flexibility | Constrained (no DaemonSets on system nodes, limited privileged, restricted node access) | Full: custom kernels, GPUs any config, DaemonSets, privileged pods |
| Best for | Most workloads; teams wanting less ops | Special hardware, node-level control, tight bin-packing you manage yourself |

**Autopilot** is "give me pods, I don't want to think about nodes" and you stop paying for idle node headroom. **Standard** is the right choice when you need node-level control — specific GPU topologies, DaemonSet-based agents, privileged workloads, or when you can bin-pack more aggressively than Autopilot's per-pod pricing allows. Default recommendation for new clusters is **Autopilot** unless a concrete requirement forces Standard.

### Q2. What are node pools and node auto-provisioning?

A **node pool** is a set of nodes with identical config — machine type, disk, image, labels, taints. It's the unit you scale and upgrade. You typically run several: e.g. a general pool, a high-memory pool, a Spot pool, a GPU pool. Pods land on the right pool via nodeSelectors/taints/affinity.

**Node auto-provisioning (NAP)** extends the cluster autoscaler: instead of only scaling existing pools, NAP **creates entirely new node pools automatically** with a machine shape that fits pending pods. So if a pod requests a shape no current pool offers (e.g. lots of memory, or a GPU), NAP spins up an appropriately-sized pool, then removes it when no longer needed. It saves you from pre-defining every pool shape and improves bin-packing. (In Autopilot this is all implicit — you never see node pools at all.)

### Q3. How do the cluster autoscaler, HPA, and VPA work together?

Three different axes:

- **Horizontal Pod Autoscaler (HPA)** — scales the **number of pod replicas** based on CPU, memory, or custom/external metrics (e.g. requests/sec, queue depth). "Traffic up → more pods."
- **Cluster Autoscaler (CA)** — scales the **number of nodes**. When HPA creates pods that can't be scheduled (no room), CA adds nodes; when nodes sit underutilised, CA drains and removes them.
- **Vertical Pod Autoscaler (VPA)** — adjusts a pod's **CPU/memory requests** to match real usage (recommend or auto-apply). "This pod actually needs 1.5 GB, not 512 MB."

They compose: HPA adds replicas → those replicas need capacity → CA adds nodes to host them. Caution: **don't run HPA and VPA on the same metric** (CPU) for the same workload — they fight. Use HPA on CPU/custom metrics and VPA for memory, or VPA in recommendation-only mode. In Autopilot the cluster autoscaler is fully automatic; you mostly just set HPA.

### Q4. Regional vs zonal clusters — what's the difference and when does it matter?

The distinction is primarily about the **control plane**:

- **Zonal cluster** — a single control plane in one zone. If that zone has an outage, the **API server is unavailable** (running pods keep running, but you can't deploy, scale, or self-heal). Cheaper.
- **Regional cluster** — control plane **replicated across three zones** in the region. Survives a zone failure with no control-plane downtime; also gives higher API server availability and no-downtime control-plane upgrades.

Crucially, **regional ≠ your workloads are HA**. Regional guarantees the control plane; you still must spread your **worker nodes and pod replicas across zones** (multi-zone node pools + pod anti-affinity / topology spread constraints) so a zone outage doesn't take your app down. For production, use a **regional cluster with multi-zone node pools and topology-spread replicas**. Zonal clusters are fine for dev/test or when cost outweighs control-plane HA.

### Q5. Explain GKE VPC-native networking and the three CIDR ranges.

GKE clusters are **VPC-native**: pods and services get real IPs from the VPC via **alias IP ranges** (secondary ranges on the subnet), rather than a host-routed overlay. This makes pod IPs routable, firewall-able, and directly load-balanceable.

Three IP ranges to plan:

- **Node CIDR** — the subnet's primary range; each node gets a VPC IP here.
- **Pod CIDR** — a secondary range; every pod gets an IP from it. Size generously — it's the one that runs out (pods-per-node × max nodes). Undersizing it caps cluster growth.
- **Service (ClusterIP) CIDR** — a secondary range for in-cluster Service virtual IPs.

Benefits of VPC-native: pod IPs are first-class (no double-NAT), you can use **container-native load balancing** (NEGs → pod IPs directly), and firewall rules/Cloud Armor see pod traffic properly. The classic mistake is **undersizing the Pod CIDR**, which silently caps how large the cluster can scale.

### Q6. What is a private GKE cluster and how do you still access it?

A **private cluster** gives nodes **only internal IPs** — no public IPs on the worker VMs, reducing attack surface. The control-plane endpoint can also be private.

You still get connectivity:

- **Egress to the internet** (pull images, call APIs) via **Cloud NAT**.
- **Reach the Kubernetes API**: use **authorized networks** (allowlisted source ranges) for the public endpoint, or a **fully private endpoint** reached over VPC/VPN/Interconnect or a bastion/proxy.
- **Google APIs** (Artifact Registry, logging) via **Private Google Access** so nodes reach `*.googleapis.com` without public IPs.

Private clusters are standard for production/regulated workloads. The common confusion — "private means no internet" — is wrong: it means no *inbound-reachable public node IPs*; outbound still works through NAT.

### Q7. How does load balancing and ingress work in GKE (Ingress, Gateway API, NEGs)?

Three layers to know:

- **Service type LoadBalancer** — provisions an L4 (TCP/UDP) Google Cloud Load Balancer to a Service.
- **Ingress** — the older L7 HTTP(S) object; GKE's Ingress controller provisions a Google Cloud HTTP(S) Load Balancer, supports Google-managed certs, Cloud Armor, IAP.
- **Gateway API** — the modern, more expressive successor to Ingress (roles split across GatewayClass/Gateway/HTTPRoute), supports multi-cluster, traffic splitting, header-based routing. Preferred for new setups.

**Container-native load balancing via NEGs** is the key optimisation: a **Network Endpoint Group** lets the Google load balancer send traffic **directly to pod IPs**, skipping the extra node→kube-proxy→pod hop. Result: accurate health checks per pod, better load distribution, lower latency, and correct client-IP/session handling. VPC-native clusters enable this by default for container-native LB. Mentioning NEGs when asked about GKE ingress signals real operational depth.

### Q8. What is Workload Identity and why is it the right way to authenticate pods to GCP?

**Workload Identity** federates a **Kubernetes service account (KSA)** to a **Google service account (GSA)**, so pods automatically get **short-lived, auto-rotated GCP credentials** via the metadata server — no key files anywhere.

Setup: bind the KSA to the GSA and annotate the KSA:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  my-gsa@my-project.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:my-project.svc.id.goog[my-namespace/my-ksa]"
kubectl annotate serviceaccount my-ksa \
  iam.gke.io/gcp-service-account=my-gsa@my-project.iam.gserviceaccount.com
```

Why it's correct vs the alternative (mounting a `key.json`):

- **No long-lived keys** to leak, commit, or rotate — credentials are short-lived and issued on demand.
- **Least privilege per workload** — each KSA maps to a GSA with exactly the roles that workload needs.
- **Auditable** — actions trace to a specific workload identity.

"Mount a service-account JSON key" is the anti-pattern; Workload Identity is the interview-correct answer, and it's on by default in Autopilot.

### Q9. Explain GKE release channels and auto-upgrade/auto-repair.

**Release channels** put your cluster on a managed version track, and Google auto-upgrades the control plane and (optionally) nodes on that cadence:

- **Rapid** — newest features/versions soonest; least soak time. For testing/early adoption.
- **Regular** — balanced; the default recommendation. Reasonable soak before rollout.
- **Stable** — most conservative; longest validation. For risk-averse production.

**Auto-upgrade** keeps nodes in sync with the control plane version (Kubernetes only supports a limited version skew, so you can't let nodes drift). **Auto-repair** detects unhealthy nodes (failing health checks) and automatically recreates them. Use **maintenance windows / exclusions** to control *when* upgrades happen, and **PodDisruptionBudgets** to ensure upgrades don't take down too many replicas at once. On Autopilot, upgrades/repairs are fully managed. Turning auto-upgrade *off* to "stay stable" is a trap — you accumulate version debt and eventually hit forced upgrades on a deadline.

### Q10. What are Config Connector, Config Sync, and Anthos/fleets?

The config-and-fleet management layer:

- **Config Connector** — manage **GCP resources** (Cloud SQL, buckets, Pub/Sub topics, IAM) **as Kubernetes objects**. You `kubectl apply` a CRD and it provisions the real GCP resource — Infrastructure-as-Code through the K8s API instead of Terraform.
- **Config Sync** — **GitOps** for clusters: a git repo is the source of truth for cluster config/policy; Config Sync continuously reconciles clusters to match it. Drift is auto-corrected.
- **Anthos / fleets** — a **fleet** is a logical grouping of clusters (across GKE, on-prem, other clouds) managed together. **Anthos** adds multi-cluster services, config management, and service mesh across the fleet — for hybrid/multi-cloud consistency.

Together they're "manage many clusters and their GCP dependencies declaratively from git." For an interview, knowing Config Sync = GitOps reconciliation and Config Connector = GCP-resources-as-CRDs is the useful level.

### Q11. When would you choose GKE over Cloud Run (and vice versa)?

**Cloud Run** for stateless HTTP/event containers with zero cluster ops and scale-to-zero. It's the default.

**GKE** when you need what Cloud Run can't do:

- **Stateful workloads** — StatefulSets, databases, systems needing stable identity/storage.
- **Non-HTTP or long-lived** processes, DaemonSet agents (logging/security on every node), custom schedulers.
- **Service mesh** (Istio/Anthos), sidecars, advanced traffic policy.
- **Fine-grained node control** — specific GPUs, node tuning, aggressive self-managed bin-packing.
- **High steady-state utilisation** where per-node pricing beats per-request, or a large microservice estate sharing a cluster.

Decision heuristic: **start on Cloud Run; move to GKE at its ceiling.** Choosing GKE first means paying Kubernetes' operational tax before you've hit a wall that justifies it. Conversely, forcing a stateful mesh-heavy platform onto Cloud Run fights the tool.

### Q12. How do you manage container images for GKE — Artifact Registry, scanning, Binary Authorization?

- **Artifact Registry** — the current image (and package) registry, successor to Container Registry (gcr.io). Regional/multi-region repos, IAM-controlled, integrated with GKE, Cloud Build, and Cloud Run. Store images as `REGION-docker.pkg.dev/my-project/repo/app:tag`.
- **Vulnerability scanning** — Artifact Registry scans images for CVEs (on push and continuously), surfacing known vulnerabilities in your OS packages and language deps.
- **Binary Authorization** — a **deploy-time admission policy**: GKE will only run images that satisfy your policy — e.g. signed by a trusted **attestor**, built by an approved pipeline, and free of critical CVEs. It blocks unsigned/untrusted images from ever being scheduled.

Together: images live in Artifact Registry, get scanned, are **attested** by your CI after passing checks, and Binary Authorization enforces that only attested images run. This is the supply-chain-security answer interviewers want — "only provably-built, provably-scanned images reach production."

### Q13. How do you handle secrets in GKE?

Options, roughly in order of preference:

- **Secret Manager + Secret Manager CSI driver** — mount secrets from **Google Secret Manager** into pods as files via the CSI Secret Store driver, authenticated with **Workload Identity**. Central rotation, audit, no secret material in etcd. Preferred.
- **Kubernetes Secrets with application-layer / envelope encryption** — native `Secret` objects, but enable **etcd encryption with a Cloud KMS key** so they're not stored in plaintext at rest. Base64 is *not* encryption; without KMS envelope encryption a `Secret` is effectively plaintext to anyone with etcd/API access.
- **External Secrets Operator** — syncs from Secret Manager into K8s Secrets if you need the native Secret shape.

Anti-patterns: secrets in ConfigMaps, secrets baked into images, or relying on base64 as "encryption." The clean modern answer is **Secret Manager via CSI + Workload Identity**, with KMS-backed etcd encryption as the baseline for any native Secrets you do use.

### Q14. How do you optimise GKE cost?

Main levers:

- **Spot node pools** — preemptible/Spot VMs at up to ~60–91% discount for fault-tolerant, restartable workloads (batch, stateless with replicas, CI). Use taints so only tolerant pods land there, and keep critical pods on on-demand.
- **Right-size requests + bin-pack.** Over-requested CPU/memory wastes nodes. Use VPA recommendations to set accurate requests so the scheduler packs pods densely. Poor requests are the #1 GKE cost leak.
- **Autopilot** — you pay per pod request, so you stop paying for idle node headroom entirely (as long as requests are accurate).
- **Cluster autoscaler + NAP** — scale nodes to zero on empty pools; provision fitting shapes on demand.
- **Committed-use discounts (CUDs)** for steady baseline capacity; **Spot** for the elastic top.
- **Cost visibility** — GKE cost allocation / usage metering to attribute spend per namespace/team.

The senior framing: cost on Standard is mostly a **bin-packing and requests-accuracy** problem; Autopilot converts it into a per-pod-request problem, which is easier to reason about but only cheap if your requests are honest.

### Q15. What are multi-cluster and fleet concepts in GKE?

A **fleet** is a group of clusters managed as a unit — across regions, and even across GKE, on-prem, and other clouds. It's the foundation for:

- **Multi-cluster Services (MCS)** — export a Service so it's reachable across clusters in the fleet (cross-cluster service discovery).
- **Multi-cluster Ingress / Gateway** — a single global load balancer fronting the same app in multiple regional clusters, routing users to the nearest healthy cluster and failing over on regional outage.
- **Fleet-wide config & policy** — Config Sync + Policy Controller apply consistent config/guardrails to every cluster from git.
- **Fleet-wide service mesh** (Anthos Service Mesh) — mТLS and traffic policy spanning clusters.

Use cases: global low-latency (users hit nearest region), regional DR/HA (survive a region outage), and hybrid/multi-cloud consistency. For an interview, "a fleet lets me run and manage many clusters — multi-region for HA/latency and hybrid for portability — with one config/policy/mesh plane" is the right summary.

### Q16. Design: a production GKE cluster for a regulated, security-sensitive service. What choices do you make?

Layered choices across HA, security, and ops:

**Topology & HA**
- **Regional cluster** (3-zone control plane) with **multi-zone node pools**; spread replicas via topology-spread constraints and set **PodDisruptionBudgets**.

**Networking & isolation**
- **Private cluster** (no public node IPs), **authorized networks** or private endpoint for the API, **Cloud NAT** for egress, **Private Google Access** for Google APIs. Generously-sized **Pod CIDR**.

**Identity & supply chain**
- **Workload Identity** for all pod→GCP auth (no key files).
- **Artifact Registry** with **vulnerability scanning** + **Binary Authorization** so only attested, scanned images run.
- **Secret Manager via CSI**; KMS-encrypted etcd for any native Secrets.

**Operations**
- **Regular or Stable release channel** with **auto-upgrade/auto-repair**, maintenance windows, and PDBs to bound disruption.
- **Config Sync (GitOps)** + **Policy Controller** for declarative, auditable config and guardrails.
- **Network Policies** for pod-to-pod segmentation; Cloud Armor + managed certs on the ingress/Gateway.

**Cost**
- On-demand for critical pods, **Spot pool** (tainted) for batch/fault-tolerant work, VPA-accurate requests for bin-packing, CUDs for baseline.

The narrative: **regional + private + Workload Identity + Binary Authorization + GitOps** is the backbone of a defensible, auditable, self-healing production GKE platform.

## Object Storage: Cloud Storage

### Summary

**What this topic covers**

Cloud Storage — GCP's object store (≈ S3), and one of the highest-frequency interview topics because almost every architecture touches it. The 18 questions cover the object/bucket model, **location types** (region / dual-region / multi-region) and their availability-latency-cost tradeoff, the four **storage classes** (Standard, Nearline, Coldline, Archive) with their minimum-storage-duration and retrieval economics, **Autoclass**, GCP's **strong (read-after-write) consistency**, **object lifecycle management**, **versioning**, access control (**uniform bucket-level access** vs legacy ACLs, **public access prevention**), **signed URLs** and signed policy documents, encryption (**Google-managed / CMEK / CSEK**), **retention policies + bucket lock** (WORM/compliance) and object holds, **turbo replication**, **Storage Transfer Service**, **requester pays**, composite objects / parallel composite uploads, performance and request-rate ramp-up, **Pub/Sub notifications / Eventarc** triggers, and the cost pitfalls that bite (early-deletion fees, egress, retrieval charges).

**Mental model**

Cloud Storage is a **flat key-value store of immutable objects** grouped into **globally-unique-named buckets** — "folders" are just a UI convention over `/` in key names; there are no real directories. Two independent axes define a bucket: **where it lives** (location type — one region, two regions, or a continent-wide multi-region) and **how each object is priced for access** (storage class). Location trades durability-of-availability and latency against cost; storage class trades cheap at-rest storage against retrieval fees and minimum-duration commitments. Unlike S3's historical eventual consistency, **Cloud Storage is strongly consistent globally** — a successful write is immediately readable everywhere, list operations are consistent, no read-after-write surprises. Two more pillars: **lifecycle management** automates the storage-class-down-and-delete journey over an object's life, and **access control** should be **uniform bucket-level (IAM)**, not per-object ACLs. Think "durable bytes with policy attached," and most questions answer themselves.

**Key terms**

- **Bucket** — top-level container; globally-unique name; fixes location and default storage class.
- **Object** — an immutable blob + metadata; identified by its key; overwrites create a new version.
- **Location type** — **region** (one region), **dual-region** (two specific regions), **multi-region** (a continent — US/EU/ASIA).
- **Storage class** — Standard / Nearline (30-day min) / Coldline (90-day min) / Archive (365-day min); colder = cheaper storage, pricier retrieval.
- **Autoclass** — automatically moves objects between classes based on access, so you don't hand-tune lifecycle for access patterns.
- **Uniform bucket-level access (UBLA)** — IAM-only access, ACLs disabled; the recommended model.
- **Public access prevention** — enforces that a bucket/objects can never be made public (org-policy enforceable).
- **Signed URL** — time-limited URL granting object access without an IAM identity, signed by a key.
- **Retention policy + bucket lock** — minimum retention period; **bucket lock** makes it immutable (WORM/compliance).
- **CMEK / CSEK** — Customer-Managed (via Cloud KMS) / Customer-Supplied encryption keys; vs default Google-managed.
- **Turbo replication** — dual-region option guaranteeing fast (15-min RPO) cross-region replication.
- **Requester pays** — the *requester*, not the bucket owner, is billed for egress/operation costs.

**Why interviewers ask this**

Object storage questions test whether you can reason about **cost, durability, and access control together** — the everyday tradeoffs of cloud architecture. The class/location matrix reveals whether you understand that "cheap storage" (Archive) hides retrieval and minimum-duration fees that make it expensive for the wrong access pattern. Access control questions (UBLA vs ACLs, public access prevention, signed URLs) are a **security** signal — the classic incident is an accidentally-public bucket, and a senior candidate reaches for public access prevention and UBLA reflexively. Retention/bucket-lock questions probe **compliance** literacy (WORM, legal hold). And lifecycle/Autoclass questions show whether you automate cost management or leave money on the floor. It's the topic where a candidate demonstrates end-to-end cloud judgement on a service everyone claims to know.

**Common confusions**

- "Cloud Storage is eventually consistent like old S3" — it's **strongly consistent** globally, read-after-write included.
- "Archive is just cheaper, so use it for everything cold" — Archive has a **365-day minimum** and real **retrieval** costs; deleting/reading early can cost *more* than Standard.
- "Multi-region and dual-region are the same" — multi-region is continent-wide (Google picks placement); dual-region is two **specific** regions you choose (predictable, supports turbo replication).
- "Use ACLs for fine-grained control" — prefer **uniform bucket-level access** (IAM); ACLs are legacy and error-prone.
- "A retention policy stops me deleting, so it's locked" — not until you apply **bucket lock**; before lock, the policy can be shortened/removed.
- "Signed URLs need the user to have IAM access" — the opposite: signed URLs grant access **without** an identity, for a bounded time.

**What follows from this topic**

Cloud Storage is the substrate under most of GCP: it's the landing zone for **BigQuery** loads and external tables, the artifact store adjacent to **Artifact Registry**, a trigger source for **Cloud Functions/Run via Eventarc** (the serverless topic), and the target of **Storage Transfer Service** for migrations. Its IAM model is the object-shaped view of the IAM topic; its CMEK story ties to **Cloud KMS**; its encryption/retention features are the compliance backbone. Master the class/location/lifecycle economics and the access-control defaults, and you'll answer cost and security questions correctly across the rest of the primer.

### Q1. What are buckets and objects, and how is the namespace structured?

A **bucket** is the top-level container. Its **name is globally unique** across all of Cloud Storage (not just your project), and it fixes two things at creation: the **location** and the **default storage class**. Buckets can't be renamed or moved (you copy to a new one).

An **object** is an immutable blob plus metadata, addressed by a **key** (its full name). Objects are immutable — you don't edit in place; you overwrite, which creates a new object (or a new version, if versioning is on).

The namespace is **flat**: there are no real directories. A key like `logs/2026/07/app.log` is a single string; the `/`s are convention, and the console renders pseudo-folders by prefix. This matters for performance and listing — you filter by **prefix**, and there's no cost to "deep" hierarchies because they're just names. Key design (prefix distribution) affects request-rate scaling, covered later.

### Q2. Explain location types: region, dual-region, and multi-region.

Three location types, trading availability/latency/cost:

| Location type | Placement | Availability | Latency | Cost |
|---|---|---|---|---|
| **Region** | One region (e.g. `us-central1`) | Zone-redundant within region | Lowest, if co-located with compute | Lowest storage |
| **Dual-region** | Two **specific** regions you choose | Survives a region outage | Low in either region | Higher |
| **Multi-region** | A continent (US / EU / ASIA); Google places it | Highest; survives region loss | Low across the continent | Higher; higher egress considerations |

**Region** — cheapest, lowest latency when your compute is in the same region; the default for most workloads (data-plus-compute co-location). **Dual-region** — you pick two regions for geo-redundancy with predictable placement, and it's the only option supporting **turbo replication**. **Multi-region** — Google spreads data across a continent for maximum availability and continent-wide low-latency reads (great for content serving), at higher cost. Choose region unless you specifically need cross-region resilience or continent-wide read distribution.

### Q3. Explain the storage classes and their tradeoffs.

Four classes, all with the **same durability** (11 nines) — they differ on **storage price, retrieval cost, and minimum storage duration**:

| Class | Min storage duration | Storage cost | Retrieval cost | Use for |
|---|---|---|---|---|
| **Standard** | None | Highest | None | Hot / frequently accessed |
| **Nearline** | 30 days | Lower | Per-GB retrieval fee | Accessed ~monthly (backups) |
| **Coldline** | 90 days | Lower still | Higher retrieval fee | Accessed ~quarterly (DR) |
| **Archive** | 365 days | Lowest | Highest retrieval fee | Rarely accessed (compliance, long-term) |

The tradeoff: **colder classes cost less to store but more to read, and charge you if you delete/rewrite before the minimum duration** (early-deletion fee). So Archive is cheapest at rest but expensive if you actually access it or churn it. Match class to **access frequency**, not just "is it old." Availability SLA also steps down slightly for colder classes. All classes offer millisecond first-byte latency (no Glacier-style thaw wait), which is a nice Cloud Storage differentiator vs some competitors.

### Q4. What is Autoclass and when should you use it?

**Autoclass** automatically moves each object between storage classes based on its **access pattern** — objects that go untouched migrate toward colder classes (Nearline → Coldline → Archive), and if a cold object is accessed it moves back to Standard. You enable it per bucket and stop hand-writing lifecycle rules for class transitions.

Use it when access patterns are **unpredictable or per-object variable** — e.g. a bucket of user uploads where some stay hot and others go cold, and you can't write a single time-based rule that fits all. Autoclass optimises each object individually and, importantly, **doesn't charge early-deletion or retrieval fees for its own transitions**, removing the risk that a naive lifecycle rule pushes something to Archive right before it's read (incurring a retrieval fee).

Trade-off: Autoclass has a small per-object management fee. If your access pattern is simple and uniform (clearly time-based), explicit lifecycle rules can be cheaper. Rule of thumb: **unpredictable access → Autoclass; predictable time-based aging → lifecycle rules**.

### Q5. Explain Cloud Storage's consistency model.

Cloud Storage is **strongly consistent, globally**:

- **Read-after-write** — once a write (upload) returns success, any subsequent read from anywhere returns that object immediately. No propagation delay.
- **Read-after-metadata-update** and **delete** are likewise strongly consistent.
- **List operations are consistent** — a newly written object appears in a list right after its write succeeds; a deleted object disappears.

This is a genuine differentiator worth stating in an interview (S3 only became strongly consistent for new objects in 2020; GCS was strongly consistent from early on). Practical implication: you **don't need to build read-after-write workarounds** — e.g. a job that writes an object then a second job that reads it can rely on immediate visibility; a listing-based pipeline won't miss just-written files. The one thing that isn't instant is **bucket/IAM configuration** changes (cache/propagation), but object data operations are strongly consistent.

### Q6. What is object lifecycle management and what can it do?

**Lifecycle management** is a set of bucket rules that automatically act on objects based on conditions. Two action types:

- **SetStorageClass** — transition to a colder class (e.g. Standard → Nearline after 30 days → Coldline after 90 → Archive after 365).
- **Delete** — remove objects meeting conditions.

Conditions include **age**, **createdBefore**, **number of newer versions** (with versioning), **days since noncurrent** (for old versions), **matchesStorageClass**, and prefix/suffix. Example: keep the current version hot, move versions older than 30 days to Nearline, delete noncurrent versions after 365 days.

```json
{"rule": [
  {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
   "condition": {"age": 30}},
  {"action": {"type": "Delete"},
   "condition": {"age": 365, "isLive": false}}
]}
```

It's the core **cost-automation** tool: aged data migrates to cheaper classes and eventually deletes without manual work. Caution: transitioning to a cold class then deleting soon after can trigger **early-deletion fees** — design rules around minimum-storage durations. (Or use Autoclass to sidestep that risk.)

### Q7. How does object versioning work?

With **versioning** enabled on a bucket, overwriting or deleting an object doesn't destroy the old bytes — it creates a **noncurrent version**:

- **Overwrite** → previous content becomes a noncurrent version; the new upload is the live version.
- **Delete** → the live version becomes noncurrent (soft delete); the object isn't truly gone. To hard-delete you delete the specific version (generation).

Each version has a **generation number**; you address a specific version by generation. This protects against accidental deletes/overwrites and enables point-in-time recovery.

Cost implication: **you pay for every retained version**, so versioning without cleanup grows cost unbounded. Pair it with a **lifecycle rule** to delete noncurrent versions after N days or keep only the last K versions:

```json
{"action": {"type": "Delete"},
 "condition": {"numNewerVersions": 3, "isLive": false}}
```

Use versioning for buckets where accidental loss is costly (config, data lake landing zones), always with a noncurrent-version cleanup rule.

### Q8. Explain uniform bucket-level access vs ACLs, and which to use.

Two access-control models:

- **Uniform bucket-level access (UBLA)** — access is governed **only by IAM**, applied at the bucket level; per-object ACLs are **disabled**. One consistent, auditable model. **Recommended.**
- **Legacy ACLs (fine-grained)** — each object (and the bucket) carries its own ACL alongside IAM. Powerful but error-prone — it's easy to make a single object public by accident, and auditing "who can read what" across millions of objects is impractical.

Prefer **UBLA** for essentially all new buckets: it simplifies reasoning (grant `roles/storage.objectViewer` on the bucket or project, done), integrates with IAM Conditions and org policy, and eliminates the "one object got a public ACL" incident class. Reach for ACLs only for genuine legacy interop or the rare need for truly per-object grants that IAM can't express. Interviewers want to hear **"turn on uniform bucket-level access"** as the default.

### Q9. What is public access prevention and how do you stop accidental public buckets?

**Public access prevention (PAP)** is a setting that **guarantees a bucket and its objects can never be made public** — it blocks any IAM grant or ACL to `allUsers` / `allAuthenticatedUsers`. Even if someone tries to add a public grant, it's rejected.

Two levels:

- **Per-bucket** — enforce PAP on individual buckets.
- **Org policy** (`storage.publicAccessPrevention`) — enforce it **organisation-wide**, so no one in the org can ever expose a bucket, regardless of project-level permissions.

This is the defence against the archetypal cloud breach — the accidentally-public storage bucket. The senior answer to "how do you prevent public buckets" is: **enforce public access prevention via org policy, plus uniform bucket-level access**, so accidental exposure is structurally impossible rather than relying on people not making mistakes. Combine with VPC Service Controls for exfiltration protection on sensitive data.

### Q10. What are signed URLs and signed policy documents, and when do you use them?

A **signed URL** grants **time-limited access to a specific object** (GET/PUT/DELETE) **without the caller having any IAM identity**. You sign the URL with a key (typically a service account); anyone holding the URL can perform that operation until it expires.

Uses:
- Let an unauthenticated end-user **download** a private object (e.g. a paid PDF) via a short-lived link.
- Let a browser/mobile client **upload directly** to a bucket (`PUT` signed URL) without proxying bytes through your server or handing out credentials.

```bash
gsutil signurl -d 15m -m PUT service-account-key.json gs://my-bucket/uploads/file.png
```

A **signed policy document** is the richer form for **browser POST uploads**: it constrains the upload with a policy — allowed key prefix, content-type, **max file size**, expiry — so a client can upload directly but only within those bounds. Use signed policy documents when you want direct-to-bucket uploads *with server-enforced constraints* (size/type limits) that a plain signed PUT URL can't express.

### Q11. Explain the encryption options: Google-managed, CMEK, and CSEK.

All objects are **encrypted at rest by default** — the question is who controls the key:

- **Google-managed encryption (default)** — Google creates and manages the keys entirely. Zero config; fine for most data.
- **CMEK (Customer-Managed Encryption Keys)** — you supply a **Cloud KMS** key; Cloud Storage uses it to encrypt objects. You control rotation, disable/destroy (which makes data unreadable), and get KMS audit logs. The usual choice for compliance/regulated data — control and auditability without handling raw key bytes.
- **CSEK (Customer-Supplied Encryption Keys)** — you provide the **raw key material** on each request; Google uses it but never stores it. Maximum control (Google literally cannot decrypt without your key each call) but maximum operational burden — lose the key and the data is gone forever, and every request must carry it.

Guidance: default Google-managed for ordinary data; **CMEK via Cloud KMS** when compliance requires key control, rotation policies, or the ability to revoke access by disabling the key; **CSEK** only when you truly must hold the keys outside Google. CMEK is the pragmatic middle and the most common interview answer.

### Q12. Explain retention policies, bucket lock, and object holds (WORM/compliance).

For compliance / immutability:

- **Retention policy** — sets a **minimum age** an object must reach before it can be deleted or overwritten. While within the retention period, deletion is blocked. By itself, though, the *policy* can be shortened or removed by an admin.
- **Bucket lock** — **locks the retention policy permanently**. Once locked, the policy can be *lengthened* but **never shortened or removed** — this makes it true **WORM** (write-once-read-many) storage for regulatory compliance (SEC 17a-4, financial/healthcare records). Irreversible, so lock deliberately.
- **Object holds** — flags on an individual object that block deletion regardless of retention: **temporary hold** (release when done) and **event-based hold** (holds until an event resets the object's retention clock, e.g. "retain 7 years *after* account closure"). A **legal hold** use case: freeze specific objects for litigation independent of the bucket policy.

The combination — **retention policy + bucket lock** for baseline WORM, plus **holds** for per-object legal/event exceptions — is the compliant-immutable-storage answer. Note locked retention means you can't delete the bucket until all objects satisfy retention.

### Q13. What is turbo replication and when do you need it?

**Turbo replication** is a **dual-region** feature that guarantees data is replicated to the second region within a **strict RPO of 15 minutes** (target for the 100th percentile), versus default (best-effort, typically fast but no tight SLA that can lag under heavy write bursts).

You need it when your **RPO requirement is tight** — a regional outage must lose at most ~15 minutes of data — for critical workloads: financial records, primary data lakes, anything where the recovery-point objective is contractual. It's only available on **dual-region** buckets (you choose the two regions), which is one reason to pick dual-region over multi-region when replication SLA matters.

Trade-off: turbo replication costs extra (a replication surcharge on top of dual-region pricing). For non-critical data, default dual-region or multi-region replication is enough. In a DR design, call out turbo replication specifically when the interviewer sets a low RPO for storage.

### Q14. What is Storage Transfer Service and when would you use it over gsutil/gcloud?

**Storage Transfer Service (STS)** is a **managed, scalable data-movement service** for bulk transfers into/within Cloud Storage:

- From **other clouds** (S3, Azure Blob) into Cloud Storage.
- From **on-prem / HTTP sources** (via agents) into Cloud Storage.
- **Bucket-to-bucket** within GCP (region migration, class change, consolidation).

Why over `gsutil -m cp` / `gcloud storage cp`: STS is **managed and server-side** — Google runs the transfer workers, handles **retries, parallelism, bandwidth, checksums/validation, and scheduling** (one-off or recurring), and can do **incremental** syncs (only changed objects) and **delete-after-transfer**. For **large** (TB–PB) or **ongoing scheduled** migrations, or moving from another cloud, STS is far more robust than scripting `gsutil` on a VM (which you'd have to babysit, retry, and scale yourself). For truly massive offline data there's also **Transfer Appliance** (ship a physical device). Use `gcloud storage`/`gsutil` for interactive, small, or ad-hoc copies; **STS for scale, cross-cloud, and recurring** transfers.

### Q15. What is requester pays, and why use it?

Normally the **bucket owner** pays for storage, operations, and **egress**. With **requester pays** enabled, the **requester** (the project making the request) is billed for the **operation and egress/network** costs — the owner still pays for storage-at-rest.

Requesters must acknowledge they'll pay by including their billing project (`-u <project>` / `userProject`) on each request; requests without it are rejected.

Use it when you **share data publicly or with many parties** and don't want to foot their access/egress bill — the canonical case is **public datasets** (research data, open geospatial/genomic data). The data provider hosts it; each consumer pays for what *they* pull. It shifts the (potentially large and unpredictable) egress cost to whoever benefits, making it economically viable to publish big datasets without an open-ended bill. It's a cost-allocation tool, not a security control.

### Q16. Explain composite objects and parallel composite uploads.

**Composite objects** are built by **concatenating** existing objects server-side via the `compose` operation (up to 32 components per compose, chained for more). Uses: assemble a large object from parts, or append-style patterns (compose old + new).

**Parallel composite uploads** apply this to **speed up large uploads**: the client splits a big file into chunks, uploads them **in parallel** as temporary objects, then `compose`s them into the final object and deletes the temporaries. This saturates bandwidth far better than a single-stream upload for large files.

Caveats to know:
- The final object is a **composite**, which carries a **crc32c** checksum but **not an MD5** — tools/consumers that require MD5 validation can break.
- Some client tools disable it by default for that reason; you enable it via config (e.g. a size threshold). Older-class or CMEK considerations can apply.

So: parallel composite uploads = big-file upload throughput win, at the cost of the object being a composite (MD5 caveat and cleanup of temp parts). Mention the checksum caveat to show depth.

### Q17. How does Cloud Storage scale for request rate, and what is auto request-rate ramp-up?

Cloud Storage scales to very high request rates, but there's a **ramp-up**: a bucket (or key-range) starts at a baseline QPS and **auto-scales upward** as sustained load grows, redistributing the keyspace internally. If you slam a **cold** bucket with a huge instantaneous spike, you can get **503/429 (slow down)** responses before it has ramped.

Two practical rules:

- **Ramp gradually** — increase request rate stepwise (Google's guidance is roughly doubling every ~20 minutes) so the backend splits the keyspace to keep up; and implement **exponential backoff** on 429/503.
- **Distribute keys** — since scaling partitions by key range, **sequential/monotonic prefixes** (timestamps, incrementing IDs at the *start* of the key) concentrate load on one range and throttle. Add **randomness/hashing early in the key** (or reverse the timestamp) to spread writes across ranges.

This mirrors the old S3 prefix-hotspotting lesson. For predictable extreme spikes, pre-warm by ramping, and design key names for even distribution from the start. Reads of the same hot object are served from **Cloud CDN**/edge caching if fronted appropriately.

### Q18. How do you trigger downstream processing when objects change — Pub/Sub notifications vs Eventarc?

Two mechanisms to react to object events (create/finalize, delete, archive, metadata update):

- **Pub/Sub notifications** — configure the bucket to publish an event message to a **Pub/Sub topic** on object changes. Consumers subscribe (push or pull) — Cloud Functions, Cloud Run, Dataflow, custom services. Direct, high-throughput, and you own the fan-out via Pub/Sub. Good when you already build on Pub/Sub or need multiple/decoupled consumers.
- **Eventarc** — a higher-level eventing layer that delivers Cloud Storage events (as **CloudEvents**) to **Cloud Run / Cloud Functions gen2 / GKE / Workflows**, either via the direct Cloud Storage source or via Cloud Audit Logs. It normalises the event format and wiring, and is the standard trigger path for **serverless** consumers.

Guidance: for **serverless functions reacting to uploads**, Eventarc is the idiomatic, least-glue option (it's what Functions gen2 uses). For **custom fan-out, multiple subscribers, replay, or high-throughput pipelines**, use **Pub/Sub notifications** directly for control. Classic pattern: user uploads an image → object-finalize event → Eventarc → Cloud Run resizes it → writes thumbnails back. Both are at-least-once, so make the handler **idempotent**.
## Block & File Storage: Persistent Disk, Hyperdisk, Local SSD, Filestore

### Summary

**What this topic covers**

The block and file storage that sits *underneath* your compute — the disks a Compute Engine VM or GKE node actually boots from and writes to, and the shared filesystems multiple machines mount at once. This is distinct from **Cloud Storage** (object storage, a separate topic): here we care about POSIX filesystems, IOPS and throughput, latency, and durability of the volume attached to a VM. The 15 questions in this topic cover the **Persistent Disk (PD)** family (pd-standard / balanced / ssd / extreme) and how to choose; **regional PD** for synchronous cross-zone replication; **Hyperdisk**, the modern successor that decouples IOPS, throughput, and capacity as independently-provisioned knobs; **Local SSD** (ephemeral, physically-attached NVMe); **snapshots** (incremental, global, schedulable) versus **machine images** versus **custom images**; live resizing; multi-attach read-only disks; the three encryption models (Google-managed / CMEK / CSEK); **Filestore** managed NFS and its tiers; the **Backup and DR** service; and the recurring interview move — matching a storage product to a workload (database, shared web content, HPC scratch, GKE `ReadWriteMany` volume).

**Mental model**

Think in three axes: **attachment**, **durability**, and **performance shape**. *Attachment*: Persistent Disk and Hyperdisk are **network-attached block storage** — they live on Google's storage fabric, not inside the physical server, so a VM can stop and its disk survives, and the disk can be re-attached elsewhere. Local SSD is **physically attached** to the host — blazing fast and ultra-low-latency, but it evaporates the moment the VM stops, is live-migrated, or terminates. *Durability*: zonal PD survives a VM but not a zone failure; **regional PD** synchronously replicates every write to a second zone so you can force-attach in a surviving zone. *Performance shape*: legacy PD ties performance to the size you provision (bigger disk = more IOPS), which wastes money when you need IOPS but not capacity — **Hyperdisk breaks that coupling**, letting you dial capacity, IOPS, and throughput independently. For a *shared* filesystem across many VMs or GKE pods, block storage is the wrong tool — reach for **Filestore** (managed NFS).

**Key terms**

- **Persistent Disk (PD)** — network-attached, durable block storage; types pd-standard (HDD), pd-balanced, pd-ssd, pd-extreme.
- **Zonal vs regional PD** — regional PD synchronously replicates writes to two zones in a region for HA (roughly the on-disk analogue of a hot standby).
- **Hyperdisk** — next-gen block storage with independently-provisioned IOPS/throughput/capacity; families Balanced, Extreme, Throughput, plus Balanced High Availability and ML variants.
- **Local SSD** — ephemeral NVMe physically attached to the host; 375 GB per device, lost on stop/terminate/live-migrate.
- **Snapshot** — incremental, compressed, **global** backup of a disk; only changed blocks stored after the first.
- **Snapshot schedule** — a resource policy that automates periodic snapshots with retention.
- **Custom image** — a bootable OS template for creating new VMs; **machine image** captures a full VM (config + all disks + metadata).
- **Multi-attach** — attaching one disk to multiple VMs; supported **read-only** for PD, and read-write only on specific SSD/Hyperdisk configs with a clustering filesystem.
- **CMEK / CSEK** — Customer-Managed (Cloud KMS) and Customer-Supplied Encryption Keys; the default is Google-managed.
- **Filestore** — fully-managed NFSv3 file storage; tiers Basic HDD/SSD, Zonal, Enterprise (regional, HA).
- **Backup and DR** — managed backup/DR service (application-consistent backups, retention, recovery orchestration).

**Why interviewers ask this**

Storage is where cost and reliability quietly go wrong, so it separates people who've run production from people who've only launched VMs. A junior answer says "use an SSD disk." A senior answer asks *what the workload needs*: capacity or IOPS or throughput; can it tolerate losing a zone; is the data reconstructable (scratch) or precious (a database); does it need to be shared. The strongest signal is knowing that **Local SSD is ephemeral** — candidates who'd put a database on Local SSD "because it's fast" get filtered here. The second signal is understanding why **Hyperdisk exists**: recognising the waste in size-coupled provisioning shows you've felt the pain of over-buying a 3 TB disk just to get the IOPS. Snapshots-vs-images and the encryption tiers test whether you know the operational primitives for backup, cloning, and compliance.

**Common confusions**

- "Persistent Disk is on the VM" — no, it's **network-attached** over Google's fabric; that's why it survives a stopped VM and can be re-attached elsewhere. Local SSD is the physically-attached one.
- "Local SSD is just a fast persistent disk" — it's **ephemeral**; stop or terminate the VM (or a live-migration/host event) and the data is gone. It's for scratch, caches, and swap.
- "Regional PD is a backup" — it's **synchronous replication for HA**, not a point-in-time backup; you still need snapshots. Replication faithfully copies corruption and `rm -rf` too.
- "Snapshots are per-zone" — snapshots are a **global** resource; you can restore into any zone/region, which makes them a DR and migration tool.
- "Bigger disk just means more space" — on legacy PD, size also buys **IOPS and throughput**; Hyperdisk decouples them so you provision each independently.
- "Filestore is object storage" — Filestore is **NFS** (POSIX file semantics, `ReadWriteMany`); Cloud Storage is objects over HTTP. Different consistency, latency, and access models.

**What follows from this topic**

Storage choices ripple everywhere. The zonal-vs-regional-PD question is the compute-layer version of the reliability tradeoffs in the **Networking / VPC** topic and the HA patterns you'll design for **Cloud SQL / Spanner** databases. Snapshots and machine images feed the golden-image and autoscaling patterns in the **Compute** topic. Encryption tiers (CMEK/CSEK) connect straight to **IAM and Cloud KMS** in the security topic. And Filestore's `ReadWriteMany` role shows up again whenever a **GKE** workload needs shared state — object storage (a separate topic) is the usual first answer for durable shared data, with Filestore reserved for genuine POSIX filesystem needs.

### Q1. Walk me through the Persistent Disk types and how you'd choose between them.

Four PD types, trading cost against performance:

| Type | Media | Use case | Rough performance |
|---|---|---|---|
| pd-standard | HDD | Sequential I/O, cold data, throughput-oriented batch | Low IOPS, cheap per GB |
| pd-balanced | SSD | The sensible default for most VMs and boot disks | Good IOPS/$, balanced |
| pd-ssd | SSD | Latency-sensitive, high random IOPS (databases) | High IOPS, higher cost |
| pd-extreme | SSD | Largest DBs (SAP HANA, big Oracle/Postgres) | Provisioned IOPS, highest |

Default to **pd-balanced** — it covers boot disks and the majority of general workloads at a good price/performance point. Step up to **pd-ssd** for latency-sensitive databases doing lots of small random reads/writes. Reserve **pd-extreme** for genuinely huge, IOPS-hungry databases where you want to provision IOPS explicitly. Drop to **pd-standard** only for throughput-bound sequential workloads or cold storage where you're paying for capacity, not speed. Note that on all PD types except extreme, IOPS scale with provisioned size — so a tiny pd-ssd may not deliver the IOPS you expect. If you find yourself over-sizing a disk purely to buy IOPS, that's the signal to move to **Hyperdisk**.

### Q2. What is regional Persistent Disk and when would you use it?

Regional PD **synchronously replicates every write to a second zone** in the same region. An acknowledged write is durable in both zones before the application sees success, so if a zone fails you can **force-attach** the disk to a VM in the surviving zone and resume with an RPO of effectively zero.

Use it for **zonal-failure resilience** on stateful single-writer workloads — the classic case is a self-managed database VM (Postgres, MySQL) where you want cross-zone HA without app-level replication, or a stateful GKE workload that must survive losing a zone.

Two caveats. First, synchronous cross-zone replication adds **write latency** versus zonal PD — you're paying a round trip. Second, **it is not a backup**: it faithfully replicates deletes and corruption to the other zone. You still schedule snapshots for point-in-time recovery. For many database workloads a managed service (Cloud SQL HA, which does this for you) is the better answer than hand-rolling regional PD.

### Q3. What is Hyperdisk and why did Google introduce it?

Hyperdisk is Google's **next-generation block storage** that **decouples capacity, IOPS, and throughput** so you provision each independently. On classic Persistent Disk, performance is tied to provisioned size — to get high IOPS you over-buy capacity you don't need. Hyperdisk removes that coupling: you can have a modest-capacity volume with very high provisioned IOPS, and adjust performance on the fly without resizing.

The families:

| Family | Optimised for | Typical use |
|---|---|---|
| Hyperdisk Balanced | Balanced IOPS + throughput | General-purpose, most databases and apps |
| Hyperdisk Extreme | Highest IOPS | Largest, most demanding databases |
| Hyperdisk Throughput | Cost-efficient throughput | Scale-out analytics, Hadoop/Kafka, cost-sensitive throughput |
| Hyperdisk Balanced High Availability | Cross-zone HA block storage | HA workloads needing the Hyperdisk model |

Treat Hyperdisk as the **modern successor to PD** for supported machine families — reach for it when you want to tune performance and capacity separately, right-size cost, or dynamically raise IOPS/throughput without touching capacity. It's available only on newer machine types, so PD is still what you use on older families.

### Q4. Can you resize a disk that's in use, and how?

Yes for growing — **PD and Hyperdisk support live grow** with no downtime. You increase the disk size (console, `gcloud`, or API), then extend the **filesystem/partition inside the guest** (`resize2fs`, `xfs_growfs`, or the Windows disk manager) so the OS actually sees the new space.

```bash
gcloud compute disks resize my-disk --size=500GB --zone=us-central1-a
# then inside the VM:
sudo resize2fs /dev/sdb   # ext4 example
```

Key constraints: you can **grow but not shrink** a disk — to shrink, snapshot and restore into a smaller disk. With Hyperdisk you can additionally raise **provisioned IOPS/throughput** live, independent of capacity. Plan a bit of headroom so you're not resizing under pressure, and remember the guest-side filesystem step — the extra capacity is invisible until you extend the filesystem.

### Q5. How do snapshots work, and how are they different from images?

**Snapshots** are **incremental, compressed, global** backups of a disk. The first snapshot copies all used blocks; subsequent ones store **only changed blocks**, so they're cheap and fast. Being a global resource, a snapshot can be restored into **any zone or region**, which makes it both a backup and a migration tool.

Three related-but-different artifacts:

| Artifact | Captures | Primary use |
|---|---|---|
| **Snapshot** | One disk, point-in-time, incremental | Backup / DR / clone a single volume |
| **Custom image** | A bootable OS template (from a disk) | Golden image for launching new VMs / MIGs |
| **Machine image** | A **whole VM** — config + all attached disks + metadata | Clone or back up a complete VM |

Rule of thumb: **snapshot** to back up or move a single disk; **custom image** to bake a reusable OS/app template that autoscaled instances boot from; **machine image** when you want to capture an entire multi-disk VM including its configuration. Automate snapshots with a **snapshot schedule** (a resource policy) so backups aren't a manual chore.

### Q6. How would you automate a backup strategy for Compute Engine disks?

Use **snapshot schedules** — resource policies that create periodic incremental snapshots with a retention window, attached to the disks you care about:

```bash
gcloud compute resource-policies create snapshot-schedule daily-backup \
  --region=us-central1 \
  --max-retention-days=14 \
  --daily-schedule --start-time=03:00 \
  --storage-location=us

gcloud compute disks add-resource-policies my-disk \
  --resource-policies=daily-backup --zone=us-central1-a
```

Design points: pick a **retention** that meets your RPO/compliance needs (e.g. 14 daily + a few weekly); set a **storage location** for the snapshots (multi-region for DR, or a specific region for data-residency); and use a schedule so it's hands-off. For **application-consistent** backups of databases (flushing buffers, quiescing the app) and coordinated multi-resource recovery, step up to the **Backup and DR** service rather than raw disk snapshots — plain snapshots are crash-consistent, which is fine for many apps but not for every database.

### Q7. Explain Local SSD and its main limitation.

Local SSD is **NVMe storage physically attached to the host machine**, giving the lowest latency and highest IOPS/throughput of any option — because there's no network hop to the storage fabric. Each device is 375 GB and you can attach several for more capacity and performance.

The limitation that dominates every design decision: **it is ephemeral**. The data is lost when the VM is **stopped, terminated, or the host has a maintenance/live-migration event**. It's tied to the physical host, so it can't follow the VM. That makes it strictly for **reconstructable** data: scratch space, temp files, local caches, swap, shuffle space for analytics, or a replicated tier where losing one node's copy is fine. Never put anything you can't recreate on Local SSD — no primary database data, no single source of truth. If you need speed *and* durability, that's Hyperdisk Extreme / pd-ssd, not Local SSD.

### Q8. Can a disk be attached to multiple VMs at once?

Yes, with important constraints. **Read-only multi-attach**: a Persistent Disk (or Hyperdisk) can be attached to many VMs simultaneously as long as **every attachment is read-only** — great for serving a shared, immutable dataset (reference data, static assets) to a fleet without copying it to each VM.

**Read-write multi-attach** is far more restricted: supported only on specific SSD/Hyperdisk configurations, and it does **not** give you a POSIX-consistent shared filesystem for free — the OS-level filesystems don't coordinate, so writing from multiple VMs to a normal filesystem corrupts it. You'd need a **clustering/shared-disk filesystem** (e.g. a cluster-aware FS) that manages locking across nodes.

For the common "many machines need to read *and* write shared files" requirement, don't force multi-attach block storage — use **Filestore** (managed NFS) or Cloud Storage. Multi-attach block is a niche tool for read-only fan-out or clustered databases that expect shared block devices.

### Q9. What encryption options exist for Persistent Disks?

Three models, all encrypting data at rest; they differ in **who controls the key**:

| Model | Key managed by | When to use |
|---|---|---|
| **Google-managed (default)** | Google | No compliance requirement to hold keys; zero effort |
| **CMEK** | You, in **Cloud KMS** | You need key rotation control, audit, and the ability to disable/destroy keys (revoke access to data) |
| **CSEK** | You, supplied at API call | You must keep keys entirely outside Google; you pass the raw key on each operation |

All disks are **always encrypted at rest** — the choice is only about key custody. **CMEK** is the usual answer for regulated workloads: keys live in Cloud KMS, you control rotation and IAM on the key, and destroying the key cryptographically shreds the data. **CSEK** goes further (Google never stores your key), but the operational burden is high — lose the key and the data is unrecoverable, and you must supply it on every attach/snapshot. Default to Google-managed unless a compliance or key-control requirement pushes you to CMEK; reach for CSEK only when a policy forbids Google holding the key material at all.

### Q10. What is Filestore and when would you use it over Cloud Storage or Persistent Disk?

Filestore is **fully-managed NFSv3 file storage** — a POSIX filesystem that many VMs or GKE pods mount concurrently with standard file semantics (directories, permissions, `ReadWriteMany`). Google runs the NFS servers; you get an IP and a mount point.

Choose by access pattern:

- **Persistent Disk** — block storage for a **single** VM (or read-only fan-out). One writer.
- **Filestore** — a **shared POSIX filesystem** for **many** readers/writers at once. Lift-and-shift apps expecting an NFS mount, shared content/home directories, GKE `ReadWriteMany` volumes.
- **Cloud Storage** — massively scalable **object** storage over HTTP; unlimited capacity, but not a filesystem (no in-place partial writes, different consistency/latency).

Reach for Filestore specifically when the workload **requires filesystem semantics shared across machines** — a legacy app that mounts NFS, a render farm sharing assets, or multiple GKE pods that must read/write the same files. If the app can speak the object API, Cloud Storage is cheaper and scales further; Filestore is the answer when you genuinely need POSIX + shared + concurrent writes.

### Q11. What are the Filestore tiers and how do you pick one?

| Tier | Availability | Performance | Use case |
|---|---|---|---|
| **Basic HDD** | Zonal | Lower, capacity-oriented | Bulk file shares, cost-sensitive |
| **Basic SSD** | Zonal | Higher IOPS/throughput | Latency-sensitive shared workloads |
| **Zonal** | Zonal, scalable | High, scales with capacity | High-performance zonal workloads, large scratch |
| **Enterprise** | **Regional (HA)** | High, low-latency | Production, mission-critical, GKE `ReadWriteMany` needing HA |

Pick on **availability** first, then performance. If losing a zone is unacceptable — production stateful workloads, critical GKE volumes — go **Enterprise** for its regional, highly-available replication. For high-performance but zone-tolerant workloads (HPC scratch, big shared datasets), **Zonal** scales performance with capacity. **Basic** tiers are the economical choice for straightforward shared file needs where you don't need regional HA — SSD when latency matters, HDD when you're optimising for cost per GB. As always, HA and performance cost more, so match the tier to the actual RPO/latency requirement rather than defaulting to Enterprise everywhere.

### Q12. What's the difference between a snapshot, a custom image, and a machine image?

All three let you capture and recreate state, but at different granularity:

- **Snapshot** — a point-in-time, incremental backup of **one disk**. Use it to back up, restore, or clone a single volume, and (because it's global) to move data between zones/regions.
- **Custom image** — a **bootable OS template** created from a disk. This is your **golden image**: bake the OS + agents + app once, then have every autoscaled VM in a managed instance group boot from it identically.
- **Machine image** — captures an **entire VM**: its configuration, **all** attached disks, and metadata in one artifact. Use it to clone or back up a complete multi-disk instance faithfully.

Quick decision: backing up *data on a disk* → snapshot; building a *reusable launch template* for many VMs → custom image; capturing *one specific VM in full* (all disks + config) → machine image. Golden-image pipelines typically build a **custom image** with a tool like Packer, version it, and point instance templates at it.

### Q13. When would you reach for the Backup and DR service instead of plain snapshots?

Plain disk snapshots are **crash-consistent** (like pulling the power) and operate per-disk. That's fine for many stateless or resilient apps, but it's not enough when you need:

- **Application-consistent** backups — quiescing a database so buffers are flushed and the backup is transactionally clean, not just crash-consistent.
- **Centralised backup management** — policies, retention, and reporting across many resources (VMs, databases, disks) in one place, with backup data stored in an isolated backup vault.
- **Orchestrated recovery / DR** — recovering whole applications and their dependencies together to meet a defined RPO/RTO, including cross-region recovery.
- **Compliance** — provable retention, immutability, and audit for regulated data.

So: **snapshots** for simple, per-disk, self-managed backup of tolerant workloads; **Backup and DR** when you need application consistency, fleet-wide policy, coordinated recovery, and compliance guarantees. For managed databases (Cloud SQL, Spanner) you'd usually lean on the service's own built-in backups first.

### Q14. Design the storage for a mixed workload: a transactional database VM, a shared web-content directory, HPC scratch space, and GKE volumes that need ReadWriteMany.

Match each need to the right primitive:

- **Transactional database VM** — **pd-ssd** or **Hyperdisk Balanced/Extreme** for the random-IOPS profile; **regional PD** (or better, a managed DB with HA) if it must survive a zone; scheduled snapshots plus **Backup and DR** for application-consistent recovery; **CMEK** if regulated.
- **Shared web content** — if it can be served as objects, **Cloud Storage** (durable, scalable, cheap, CDN-friendly). If the app truly needs a mounted filesystem shared across servers, **Filestore** (Basic SSD or Enterprise for HA).
- **HPC scratch** — **Local SSD** for maximum IOPS/throughput on reconstructable intermediate data; if it must survive a stop, **Hyperdisk Throughput** or a **Zonal Filestore** for shared scratch. Never anything precious on Local SSD.
- **GKE `ReadWriteMany`** — block storage (PD/Hyperdisk) is `ReadWriteOnce`; for many pods reading and writing shared files use **Filestore** (Enterprise tier for HA) via the CSI driver, or Cloud Storage (via the GCS FUSE CSI driver) if object semantics suffice.

The through-line: durability requirement, access pattern (single-writer block vs shared file vs object), and performance shape drive the choice — not "which one is fastest."

### Q15. A candidate puts a production PostgreSQL data directory on Local SSD "because it's the fastest option." What's wrong and what would you do instead?

The fatal flaw: **Local SSD is ephemeral**. Its contents are lost whenever the VM is stopped, terminated, or the host has a maintenance/live-migration event. A production database's data directory is the **single source of truth** — putting it on storage that can vanish means one host event or accidental stop **destroys the database**. Speed is irrelevant if the data isn't durable.

What to do instead:

1. **Durable block storage** for the data directory — **pd-ssd** or **Hyperdisk Extreme/Balanced** for the high random IOPS Postgres wants; these survive VM stops and can be re-attached.
2. **HA** — **regional PD** for synchronous cross-zone replication, or better, use **Cloud SQL** (managed Postgres with automated HA, backups, and patching) unless there's a hard reason to self-manage.
3. **Backups** — scheduled snapshots and/or **Backup and DR** for application-consistent, point-in-time recovery.
4. **Legitimate Local SSD use** — you *can* use it for **reconstructable** pieces: temp/scratch tablespaces, sort/hash spill space, or a read cache — never the primary data files or WAL that you can't afford to lose.

The senior instinct is "durability first, then optimise performance within durable options," not "fastest wins."

## Networking: VPC

### Summary

**What this topic covers**

The virtual network that everything else runs on — the GCP **Virtual Private Cloud** and its surrounding connectivity services. This is one of the highest-leverage topics in a cloud interview because networking is where GCP diverges most sharply from AWS, and where "it works on my laptop" quietly becomes "the VM can't reach the internet" in production. The 18 questions cover the fundamentals — **VPC is a global resource**, **subnets are regional**, auto-mode vs custom-mode, and firewall rules that live on the VPC; the egress and private-connectivity story — **Cloud NAT**, **Private Google Access**, **Private Service Connect**, **Private Service Access**; the org-scale patterns — **Shared VPC** vs **VPC Network Peering**; hybrid connectivity — **Cloud VPN**, **Cloud Interconnect** (Dedicated/Partner), and **Cloud Router** with BGP; IP addressing (internal/external, static reservations, alias ranges); observability (**VPC Flow Logs**, **Firewall Insights**); **network tiers** (Premium vs Standard); MTU; IPv6; and the connectivity-troubleshooting questions every interviewer eventually asks.

**Mental model**

Start from the single fact that reframes everything: **a VPC is global**. Unlike AWS where a VPC is region-scoped, a GCP VPC spans every region, and you carve out **regional subnets** inside it. Two VMs in different regions on the same VPC talk over Google's private backbone using internal IPs — no peering, no gateways. **Firewall rules are attached to the VPC** (not to subnets or instances directly) and are **stateful** — allow the inbound and the return traffic is automatically permitted. There's an **implied allow-egress** and **implied deny-ingress** at priority 65535 that your rules override by priority. Instances get private internal IPs by default; reaching the internet requires either an **external IP** or, for private VMs, **Cloud NAT** for egress. Reaching Google APIs privately is **Private Google Access**; reaching Google/third-party *services* privately is **Private Service Connect**. For connecting VPCs or on-prem, you're choosing among **peering**, **Shared VPC**, **VPN**, and **Interconnect** — each with different transitivity, scale, and cost.

**Key terms**

- **VPC** — a **global** virtual network; a resource in a project, spanning all regions.
- **Subnet** — a **regional** IP range within a VPC; has a **primary** range and optional **secondary (alias)** ranges (used for GKE pods/services).
- **Auto mode vs custom mode** — auto creates one subnet per region automatically with fixed ranges; custom gives you full control (recommended for production).
- **Firewall rule** — stateful allow/deny on the VPC, with priority, direction (ingress/egress), and targets by **network tag** or **service account**.
- **Hierarchical firewall policy** — firewall rules applied at the org/folder level, inherited by projects.
- **Route** — determines next hop for traffic; **system-generated** (subnet + default) and **custom** (static or dynamic via Cloud Router).
- **Cloud NAT** — managed, distributed NAT for **egress** from private VMs; no NAT instances to run.
- **Private Google Access / Private Service Connect / Private Service Access** — three distinct ways to reach Google APIs / published services / managed services over private IPs.
- **Shared VPC** — one **host project** owns the network; **service projects** attach and deploy into it; the standard org networking pattern.
- **VPC Network Peering** — private RFC 1918 connectivity between two VPCs; **non-transitive**.
- **Cloud VPN / Cloud Interconnect** — IPsec-over-internet vs private physical (Dedicated/Partner) connections to on-prem.
- **Cloud Router** — dynamic route exchange via **BGP** for VPN/Interconnect and Cloud NAT.

**Why interviewers ask this**

Networking is the fastest way to tell a cloud-native engineer from someone who only knows the console. The **global-VPC / regional-subnet** distinction is a litmus test: get it wrong and you clearly haven't internalised GCP's model. Beyond trivia, interviewers probe *design judgement*: do you reach for Shared VPC or peering at org scale, and do you know peering is **non-transitive** (the single most common design trap)? Can you get a private VM to the internet without giving it a public IP (Cloud NAT)? Do you know the difference between reaching Google's *APIs* privately (Private Google Access) versus reaching a *managed service* privately (PSC / Private Service Access)? And the universal senior signal: given "the VM can't reach the internet," can you walk a **methodical troubleshooting path** — routes, firewall rules, NAT, external IP, DNS — instead of guessing?

**Common confusions**

- "A VPC is regional" — **no**, the VPC is **global**; only **subnets** are regional. This is the #1 GCP networking correction.
- "Firewall rules are stateful but I still need a return rule" — you don't; GCP firewall is **stateful**, so an allowed connection's return traffic flows automatically.
- "VPC peering is transitive" — it's **not**. If A peers B and B peers C, A cannot reach C. This forces hub-and-spoke designs or Shared VPC / NCC.
- "Cloud NAT gives inbound access" — it's **egress only**. Inbound from the internet still needs an external IP or a load balancer.
- "Private Google Access = Private Service Connect" — different: PGA lets private VMs reach **Google APIs** via their public endpoints over internal routing; PSC creates a **private endpoint** in your VPC for a service.
- "External IPs are free/permanent" — a static external IP costs money **when unattached**; ephemeral IPs change on stop/start. Reserve static IPs you depend on.
- "Firewall targets are IPs" — you can target by **network tag** or **service account**, which scales far better than IP lists.

**What follows from this topic**

The VPC is the substrate for nearly everything else. Firewall rules and the private-connectivity primitives connect directly to **IAM and security** (least-privilege, service-account-scoped rules, VPC Service Controls). Cloud NAT, subnets, and secondary ranges are prerequisites for **GKE** networking (pods and services live in alias ranges) and for private **Cloud SQL / managed services** (Private Service Access). The load-balancing, Cloud DNS, and Cloud CDN topics all sit *on top* of the VPC and its global external IPs. And the hybrid-connectivity story (VPN/Interconnect/Cloud Router) is the foundation for the migration and multi-cloud scenarios you'll design in later topics.

### Q1. Explain how a VPC works in GCP and how it differs from AWS.

A **GCP VPC is a global resource**. It's a single virtual network that spans **every region** simultaneously; you don't create a VPC per region. Inside it you create **subnets, which are regional** — each subnet has an IP range tied to one region. Two VMs in different regions on the same VPC communicate over **Google's private backbone using internal IPs**, with no gateway, peering, or VPN between them.

The headline contrast with AWS:

| | GCP | AWS |
|---|---|---|
| VPC scope | **Global** | Regional |
| Subnet scope | Regional | Availability-Zone (zonal) |
| Cross-region private traffic | Same VPC, internal IPs | Requires peering / TGW |
| Firewall | Stateful rules on the VPC | Security groups + NACLs |

Practical consequences: a single VPC can host a global application without stitching regions together, and your firewall model is one layer (stateful VPC firewall rules) rather than AWS's two (security groups + subnet NACLs). This is the fact interviewers most want you to state confidently.

### Q2. What's the difference between auto-mode and custom-mode VPCs?

**Auto-mode**: when you create the VPC, GCP automatically creates **one subnet in every region** using predefined, fixed IP ranges (from the 10.128.0.0/9 block), and new regions get subnets automatically. It's convenient for quick starts and labs.

**Custom-mode**: **no subnets are created automatically** — you define every subnet, its region, and its IP range yourself.

For production, **use custom mode**. Auto mode's fixed ranges are hard to control, overlap-prone when you later peer or connect to on-prem (their predictable ranges collide across projects), and give you subnets in regions you don't use. Custom mode lets you plan a non-overlapping IP scheme that won't fight future peering, Shared VPC, or hybrid connectivity. You can convert auto → custom (one-way), which is a common first hardening step. The `default` network every new project gets is auto-mode; serious environments delete or replace it with a custom-mode design.

### Q3. How do firewall rules work in GCP?

GCP firewall rules are **stateful** and attached to the **VPC network** (not to subnets or instances). Each rule has:

- **Direction** — ingress or egress.
- **Action** — allow or deny.
- **Priority** — 0–65535, lower wins; ties broken by deny-over-allow.
- **Targets** — which instances it applies to: all instances, instances with a **network tag**, or instances using a **service account**.
- **Source/destination** — IP ranges, tags, or service accounts.
- **Protocols/ports**.

Because rules are **stateful**, allowing an inbound connection automatically permits its return traffic — you don't write a matching reverse rule. Every VPC has two **implied rules** at priority 65535: **allow all egress** and **deny all ingress**, which your higher-priority rules override.

```bash
gcloud compute firewall-rules create allow-web \
  --network=my-vpc --direction=INGRESS --action=ALLOW \
  --rules=tcp:443 --source-ranges=0.0.0.0/0 --target-tags=web
```

The senior move is targeting by **service account** rather than tags or IPs — tags can be added by anyone who can edit an instance, whereas service-account targeting ties the rule to identity and is much harder to spoof.

### Q4. What are hierarchical firewall policies and why use them?

Standard firewall rules live on a single VPC in a single project. **Hierarchical firewall policies** attach rules at the **organization or folder** level, and they're **inherited** by all projects and VPCs beneath that node. Evaluation goes top-down: org policies are enforced before folder policies, which are enforced before project/VPC-level rules.

Why they matter: they let a **central security team enforce guardrails** that individual project owners can't override — for example, "deny all ingress from known-bad ranges," "always allow health-check and IAP ranges," or "block egress to a sanctioned country" — applied consistently across the whole org without copying rules into every VPC. Rules can be **allow**, **deny**, or **goto_next** (delegate the decision downward), so you can mandate some things centrally while leaving the rest to teams. This is a governance-at-scale answer: the same instinct as **hierarchical IAM** and **org policies**, applied to the network.

### Q5. How does routing work, and what are the types of routes?

Routes decide the **next hop** for a packet leaving an instance. GCP has two categories:

**System-generated routes** (automatic):
- A **subnet route** for every subnet, so instances can reach each other within the VPC.
- A **default route** (0.0.0.0/0) to the internet gateway, used when a VM has an external IP or Cloud NAT.

**Custom routes** (you create):
- **Static routes** — fixed next hop: an instance (e.g. a NAT/appliance VM), an internal load balancer, a VPN tunnel, etc.
- **Dynamic routes** — learned via **BGP** through a **Cloud Router**, used with Cloud VPN and Cloud Interconnect so on-prem prefixes are exchanged automatically.

Routes are matched by **most-specific prefix**, then priority. Common design uses: send a subnet's egress through a firewall/NAT appliance via a static route with an instance next hop, or route on-prem CIDRs over a VPN tunnel. When traffic mysteriously doesn't flow, routes are one of the first three things to check (routes, firewall, then NAT/IP).

### Q6. A VM has no external IP but needs to download OS updates from the internet. What do you configure?

**Cloud NAT.** It's a **managed, distributed NAT service** that provides **outbound (egress) internet access for private VMs** — those with only internal IPs — without giving them public addresses and without running NAT gateway instances yourself. Because it's software-defined across the network, there's no single NAT box to become a bottleneck or SPOF.

Setup: create a **Cloud Router** in the region, then a **Cloud NAT** gateway associated with the VPC/subnets:

```bash
gcloud compute routers create my-router --network=my-vpc --region=us-central1
gcloud compute routers nats create my-nat \
  --router=my-router --region=us-central1 \
  --nat-all-subnet-ip-ranges --auto-allocate-nat-external-ips
```

Two things to remember: Cloud NAT is **egress only** — it does nothing for inbound connections (those need a load balancer or external IP). And if the VM only needs to reach **Google APIs** (not the general internet), you may not need NAT at all — **Private Google Access** covers that case more cheaply. For OS package mirrors on the public internet, Cloud NAT is the right answer.

### Q7. Compare Private Google Access, Private Service Connect, and Private Service Access.

Three different "reach it privately" tools that candidates constantly conflate:

| Feature | What it does |
|---|---|
| **Private Google Access** | Lets VMs with **only internal IPs** reach **Google APIs and services** (Cloud Storage, BigQuery, etc.) without an external IP or NAT — enabled per-subnet. |
| **Private Service Connect (PSC)** | Creates a **private endpoint (an internal IP) inside your VPC** that maps to a Google API or a **published service** (Google's, a partner's, or your own in another VPC). Traffic never traverses the internet. |
| **Private Service Access (PSA)** | Reserves an internal IP range and sets up **VPC peering to a Google-managed producer network** so you can privately reach **managed services** like Cloud SQL, Memorystore, and Vertex AI. |

The distinctions: **PGA** is about letting private VMs use Google's **public API endpoints** via internal routing (subnet flag). **PSC** gives you a **private IP endpoint you control** for a specific service — the modern, granular, DNS-friendly approach. **PSA** is the older peering-based mechanism used to attach **Google-managed backing services** (notably Cloud SQL private IP). In interviews: private VM needs Google APIs → PGA; want a private endpoint for a service (including cross-VPC published services) → PSC; giving Cloud SQL/Memorystore a private IP → PSA.

### Q8. When would you use Shared VPC versus VPC Network Peering?

Both connect workloads across projects privately, but they solve different problems:

**Shared VPC** — one **host project** owns the VPC and subnets; multiple **service projects** attach to it and deploy resources (VMs, GKE, LBs) **into the host's network**. Networking is **centrally administered** (one team owns IP planning, firewall, connectivity) while application teams work in their own projects. This is the **standard org-scale pattern** — one network, many teams, clean separation of network admin from resource admin.

**VPC Network Peering** — connects **two independent VPCs** so they exchange traffic over private IPs. Each side keeps its own VPC and admin. Crucially, peering is **non-transitive** — A↔B and B↔C does **not** give A↔C — and you can't have overlapping ranges.

Choose **Shared VPC** when you want one centrally-governed network for the whole org (the common enterprise answer). Choose **peering** for connecting a small number of independently-owned VPCs (e.g. to a partner, or a SaaS producer network) where you don't want to merge administration. For many-VPC transitive connectivity, neither scales well by hand — that's where **Network Connectivity Center** (hub-and-spoke) comes in.

### Q9. Why is VPC peering being non-transitive a problem, and how do you work around it?

**Non-transitive** means peering relationships don't chain: if VPC-A peers with hub VPC-B, and VPC-C also peers with B, then **A cannot reach C** through B. Each pair needs its own direct peering. With N VPCs that need full connectivity you'd need N·(N-1)/2 peerings — a mesh that explodes and hits per-VPC peering limits.

This bites in hub-and-spoke designs: teams expect the "hub" to route between spokes, and it silently doesn't. Workarounds:

- **Network Connectivity Center (NCC)** — Google's managed hub-and-spoke that *does* provide transitive connectivity between spoke VPCs and hybrid links.
- **Shared VPC** — put everyone in **one** VPC (host + service projects); there's no peering to be non-transitive because it's a single network.
- **A routing appliance / NVA** in the hub with custom routes to forward between spokes (more operational overhead).

In interviews, naming the non-transitivity *and* immediately reaching for **Shared VPC or NCC** is the senior answer — it shows you've hit the wall in practice.

### Q10. How do you connect a GCP VPC to an on-premises data center? Compare the options.

Two families, differing in whether traffic rides the public internet or a private circuit:

| Option | Path | Bandwidth | Use when |
|---|---|---|---|
| **Cloud VPN (HA VPN)** | **IPsec over the internet** | Up to ~3 Gbps per tunnel, aggregate more | Quick to set up, moderate bandwidth, encrypted; good default / backup |
| **Dedicated Interconnect** | **Private physical** link into Google | 10/100 Gbps circuits | High, steady bandwidth; you meet Google in a colo facility |
| **Partner Interconnect** | Private via a **service provider** | 50 Mbps–50 Gbps | Private connectivity without colo presence; smaller increments |

**HA VPN** gives you an SLA with redundant tunnels and is the fastest to stand up — encrypted over the internet, fine for many hybrid workloads and as a backup path. **Dedicated Interconnect** is a private, high-bandwidth, lower-latency circuit for heavy, sustained traffic (data migration, chatty hybrid apps) — but requires physical presence in a Google colocation facility. **Partner Interconnect** gets you private connectivity through a telco when you can't/won't do colo, in flexible bandwidth tiers. All of them use a **Cloud Router** to exchange routes via BGP. A common production design: Interconnect for the primary path plus HA VPN as an encrypted failover.

### Q11. What is Cloud Router and what role does BGP play?

**Cloud Router** is GCP's **managed dynamic-routing** service. It speaks **BGP** to exchange routes automatically between your VPC and an external network (on-prem over VPN/Interconnect, or another cloud), so you don't maintain static routes by hand. When you add or remove subnets on either side, BGP advertises the change and both sides update.

Its jobs:

- **Dynamic route exchange** for **Cloud VPN** and **Cloud Interconnect** — advertise your VPC subnets to on-prem and learn on-prem prefixes.
- **Underpin Cloud NAT** — a Cloud Router is required to configure a Cloud NAT gateway (even though NAT itself isn't about BGP).
- **Failover and ECMP** — with redundant tunnels/circuits, BGP handles path selection and reconvergence when one path drops.

Why it matters: at any real scale, static routes are brittle — every subnet change is a manual edit on both sides, and failover is painful. Cloud Router + BGP makes hybrid connectivity **self-adjusting and resilient**, which is exactly what interviewers want to hear for a production hybrid design.

### Q12. Explain internal vs external IPs and when you'd reserve a static IP.

Every VM gets an **internal IP** (RFC 1918, private) from its subnet — used for all VPC-internal and private-connectivity traffic. **External IPs** are public, internet-routable addresses, needed only when something must be reachable from, or reach, the public internet directly.

Both come in **ephemeral** and **static (reserved)** flavours:

- **Ephemeral external IP** — assigned at start, **released and changed** when the VM is stopped/started. Fine for throwaway VMs.
- **Static external IP** — **reserved**, stable across restarts. Reserve one when clients, DNS records, firewall allowlists, or licences depend on the address not changing — e.g. a public-facing endpoint, a NAT egress IP partners allowlist, or an LB front end.

A cost gotcha: a **reserved static external IP that isn't attached** to a running resource is **billed** (Google charges for holding an unused public IP), whereas one in active use is typically free. So reserve static IPs you truly depend on, and release ones you're not using. Best practice for public services is to front them with a **load balancer** on a reserved (often global, anycast) IP rather than putting external IPs on individual VMs.

### Q13. What are VPC Flow Logs and Firewall Insights, and how do they help?

**VPC Flow Logs** record a **sample of the network flows** (5-tuple, bytes, packets, timing, and RTT/latency metadata) to and from your VM interfaces. Enabled per-subnet, exported to Cloud Logging and optionally BigQuery. They're your primary tool for:

- **Troubleshooting** — is traffic actually reaching the VM? From where?
- **Security forensics / anomaly detection** — unexpected talkers, exfiltration patterns, connections to bad IPs.
- **Cost and capacity** — top talkers, cross-region/egress traffic driving bill.

**Firewall Insights** analyses your firewall rules and observed traffic to surface **shadowed rules** (a higher-priority rule makes another unreachable), **overly-permissive rules** (e.g. 0.0.0.0/0 allows that nothing uses), and **unused rules**. It turns "we have 200 firewall rules and nobody knows which matter" into actionable cleanup.

Together they close the loop: Flow Logs tell you what traffic is *actually happening*, Firewall Insights tell you whether your *rules match reality* — essential for both incident response and least-privilege hygiene.

### Q14. What's the difference between Premium and Standard network tiers?

They control **how your traffic traverses Google's network** on the way to/from the internet:

| | Premium (default) | Standard |
|---|---|---|
| Path | Rides **Google's global backbone** end-to-end; exits/enters at the POP nearest the user (cold-potato) | Uses the **public internet** for most of the path; exits near the source region (hot-potato) |
| Performance | Lower latency, more consistent, global anycast LBs | Higher/variable latency |
| Availability | Global load balancing, global external IPs | Regional only |
| Cost | Higher egress pricing | Cheaper egress |

**Premium** keeps packets on Google's private fibre for as long as possible, giving lower and more consistent latency and enabling **global** load balancers with a single anycast IP — the right choice for user-facing, latency-sensitive, or global services. **Standard** hands traffic to the public internet sooner and is **regional only**, trading performance for lower egress cost — fine for internal tools, batch, or cost-sensitive workloads that don't need global reach or premium latency. The tradeoff is simply performance/reach versus price.

### Q15. What is MTU in the context of VPC and why might you tune it?

**MTU (Maximum Transmission Unit)** is the largest packet size the network will carry without fragmentation. A GCP VPC has a configurable MTU (the default has historically been 1460 bytes, with support for **jumbo frames up to 8896 bytes**). All resources on a VPC should agree on the MTU.

Why tune it: **larger frames (jumbo frames) improve throughput and reduce CPU overhead** for high-bandwidth, intra-VPC workloads — big data transfers, HPC, storage traffic, GKE east-west — because each packet carries more payload with less per-packet processing. So you'd raise MTU for throughput-heavy internal traffic between VMs on the same VPC.

The catches: the MTU must be **consistent across the VPC and endpoints**, and **path MTU matters for anything leaving the VPC** — traffic over VPN/Interconnect or to the internet may need a **smaller** MTU, and mismatches cause fragmentation, black-holed packets, or performance cliffs (especially with "don't fragment" set). So jumbo frames are a win for controlled intra-VPC paths, but you size conservatively for hybrid/internet egress.

### Q16. A newly created VM can't reach the internet. Walk me through how you'd debug it.

Work the path methodically rather than guessing:

1. **Does it even need an external path?** Confirm the requirement — public internet vs just Google APIs (Private Google Access) vs another VPC.
2. **External connectivity** — does the VM have an **external IP**? If not, is there a **Cloud NAT** gateway covering its subnet/region? No external IP and no NAT = no internet egress.
3. **Routes** — is there a **default route (0.0.0.0/0)** to the internet gateway? A custom route (e.g. sending 0.0.0.0/0 through an appliance or VPN) could be black-holing egress.
4. **Firewall rules** — remember egress is **implicitly allowed** unless you added a deny; check for an **egress deny** rule, and for *inbound* problems check ingress allows. Verify **target tags/service accounts** actually match this VM.
5. **DNS** — can it resolve names? A working route but broken DNS looks like "no internet." Test with an IP (`ping 8.8.8.8`) vs a hostname to isolate.
6. **Guest-side** — OS firewall (iptables/ufw), NIC config, or a proxy setting.
7. **Evidence** — use **VPC Flow Logs** and connectivity tests (Network Intelligence Center **Connectivity Tests**) to see where packets actually stop.

The senior signal is the **ordered elimination** — external IP/NAT → routes → firewall → DNS → guest — not randomly toggling settings.

### Q17. Does GCP VPC support IPv6, and what should you know about it?

Yes. GCP supports **IPv6** on VPC subnets, in two flavours:

- **External IPv6** — globally-routable addresses for internet-facing resources.
- **Internal IPv6** — ULA (unique local address) ranges for private, VPC-internal IPv6 traffic.

You enable IPv6 at the **subnet** level (choosing internal or external), which makes it **dual-stack** (IPv4 + IPv6) or IPv6-capable, and instances get IPv6 addresses accordingly. Firewall rules and routes support IPv6 ranges, so your security model extends to it — but note the implied rules and your allowlists must explicitly account for IPv6 or you'll accidentally leave it open/closed.

When it matters: IPv6 is increasingly required for **public-facing services** (mobile carriers, some markets and compliance regimes mandate IPv6 reachability) and for **large-scale networks** that are exhausting RFC 1918 space. The interview point is knowing it's configured **per-subnet as dual-stack**, that VPC remains global while these subnet ranges are regional, and that firewall/routing must be reviewed for IPv6 just as for IPv4.

### Q18. Design the network for a multi-team organization running dozens of projects on GCP.

The canonical answer is **Shared VPC with centralized network administration**:

- **Host project** owns the **Shared VPC**, subnets, IP plan, firewall rules, and hybrid connectivity. A central **network/platform team** administers it.
- **Service projects** (one per team/app/environment) attach to the Shared VPC and deploy VMs, GKE, and load balancers into its subnets. App teams get autonomy over their resources but **not** over the network.
- **Custom-mode VPC** with a deliberately-planned, **non-overlapping IP scheme** (leaving room for GKE alias ranges and future peering/on-prem CIDRs).
- **Hierarchical firewall policies** at org/folder level for guardrails (deny bad ranges, always-allow health checks/IAP), with project-level rules for app specifics — targeted by **service account**, not IP.
- **Hybrid connectivity** (HA VPN and/or Interconnect with **Cloud Router**) terminates in the host project so all teams share it.
- **Private connectivity**: **Private Google Access** and **Private Service Access/PSC** so workloads reach Google and managed services without public IPs; **Cloud NAT** for controlled egress.
- **Observability & governance**: **VPC Flow Logs**, **Firewall Insights**, and **VPC Service Controls** to build a security perimeter around data.
- For **transitive** connectivity across separate networks (partners, acquisitions), reach for **Network Connectivity Center** rather than a peering mesh.

The through-line: **one centrally-governed network, many autonomous teams**, least-privilege by identity, private by default, and governance enforced from the org down.

## DNS, CDN & Edge: Cloud DNS, Cloud CDN, Certificate Manager

### Summary

**What this topic covers**

The edge of your architecture — how users **find** your service (DNS), how content is **served fast from near them** (CDN), and how the connection is **secured and protected** (certificates and edge security). These sit *in front of* the VPC and compute from the previous topics: a request resolves a name via **Cloud DNS**, hits a **global external load balancer** on an **anycast IP**, is served from **Cloud CDN**'s cache if possible, terminates TLS using a cert from **Certificate Manager**, and is screened by **Cloud Armor** — before ever reaching a backend service or bucket. The 15 questions cover Cloud DNS (public/private zones, record types, **DNSSEC**, split-horizon, hybrid forwarding/peering, and **routing policies** — weighted/geolocation/failover); Cloud CDN (integration with the external HTTP(S) LB, cache modes, cache keys, TTL/invalidation, **signed URLs/cookies**, negative caching, custom origins); **Cloud CDN vs Media CDN**; **Certificate Manager** and Google-managed vs self-managed certs; **SSL policies** and TLS versions; serving static content from a **backend bucket**; **Cloud Armor** at the edge; and how the LB, CDN, certs, and backends compose.

**Mental model**

Think of a request's journey from the outside in. **(1) Name resolution** — the client asks DNS for your hostname; **Cloud DNS** is the authoritative server, and its **routing policies** can hand back different answers by weight, geography, or health (failover). **(2) Anycast front door** — the answer is a **global anycast IP** fronting Google's **global external Application Load Balancer**; every user hits the *nearest* Google POP for the *same* IP. **(3) Edge cache** — **Cloud CDN** is a feature you enable on an LB **backend**; cacheable responses are served straight from the POP (a cache hit never touches your origin). **(4) Security & TLS** — **Certificate Manager** provides the SSL cert the LB uses to terminate HTTPS, an **SSL policy** pins minimum TLS version/ciphers, and **Cloud Armor** filters at the edge before traffic proceeds. **(5) Origin** — on a cache miss, the LB routes to a **backend service** (VMs/GKE/Cloud Run) or a **backend bucket** (Cloud Storage for static assets). The key mental shift: **CDN, certs, and Armor are all attached to the load balancer**, not standalone products.

**Key terms**

- **Cloud DNS** — managed, authoritative, 100%-SLA DNS with **public** and **private** zones; anycast name servers.
- **Public vs private zone** — public zones answer on the internet; private zones answer only inside specified VPCs (internal names).
- **DNSSEC** — cryptographically signs DNS responses so resolvers can detect tampering/spoofing.
- **Split-horizon (split-brain) DNS** — same name resolves differently for internal vs external clients (private zone vs public zone).
- **DNS routing policy** — Cloud DNS returns different records by **weighted** (traffic split), **geolocation** (by client region), or **failover** (health-checked) policy.
- **DNS forwarding / peering** — private zones forward to on-prem resolvers (and back) or peer between VPCs for hybrid name resolution.
- **Cloud CDN** — edge caching integrated with the **external HTTP(S) load balancer**; enabled per backend.
- **Cache mode** — `CACHE_ALL_STATIC`, `USE_ORIGIN_HEADERS`, or `FORCE_CACHE_ALL`, controlling what gets cached.
- **Cache key** — the set of request attributes (host, path, query, headers) that identify a cached object; tuning it raises hit ratio.
- **Signed URLs / signed cookies** — time-limited, cryptographically-signed access to CDN/private content.
- **Backend bucket** — a Cloud Storage bucket wired as an LB backend to serve static content (and be CDN-cached).
- **Certificate Manager** — manages TLS certs (Google-managed or self-managed) at scale for the LB.
- **Cloud Armor** — edge WAF/DDoS protection attached to backend services (a security topic, but it lives at this edge).
- **Media CDN** — Google's separate, higher-scale CDN for **video/large media** streaming, on the YouTube edge.

**Why interviewers ask this**

The edge is where **performance, availability, and security intersect**, and it's a favourite system-design area because it forces you to compose services rather than name one. A junior answer treats DNS, CDN, and certs as three unrelated checkboxes; a senior answer describes the **request path** and shows how they attach to a single global load balancer. Interviewers probe whether you understand that **Cloud CDN is a feature of the LB backend** (not a standalone endpoint), whether you can reason about **cache hit ratio** and cache-key/TTL tuning, whether you'd use **signed URLs** for private media, and whether you know **DNS routing policies** enable global traffic management and failover. The strongest signal is being able to draw the whole front door — DNS → anycast IP → global LB → CDN → Armor → cert → backend service/bucket — and explain *why each piece is there*.

**Common confusions**

- "Cloud CDN is a separate service you point at your origin" — it's a **feature you enable on a backend of the external HTTP(S) load balancer**; the LB *is* the origin front end.
- "The CDN cache is per-region" — it's served from Google's **global POPs**; a hit near the user never reaches your origin regardless of where the origin lives.
- "Invalidation is instant and free" — cache **invalidation** is best-effort and rate-limited; prefer **versioned URLs / cache-busting** and correct TTLs over frequent invalidation.
- "Cloud DNS load-balances traffic" — DNS **routing policies** influence which *answer* a client gets (weighted/geo/failover), but it's not a substitute for a real load balancer's health-based routing at connection time.
- "Use Cloud CDN for video streaming" — for large-scale **media/video**, **Media CDN** is the purpose-built product; Cloud CDN suits web assets and APIs.
- "Google-managed certs work anywhere" — they're issued/renewed automatically **for use on the load balancer** and require your DNS/domain to validate; they aren't exportable for arbitrary use.
- "Anycast means multiple IPs" — a **global** external LB uses a **single anycast IP** advertised from many locations; that's what makes one IP fast worldwide.

**What follows from this topic**

This topic is the outward-facing cap on the whole primer. The **anycast global IP** and **backend service/bucket** concepts come straight from **load balancing** (and reference the **VPC / network tiers** topic — global LBs need Premium tier). **Backend buckets** connect to **Cloud Storage** (object storage). **Certificate Manager**, **SSL policies**, and **Cloud Armor** are the edge face of the **security & IAM** story (defense in depth, WAF, DDoS). **Cloud DNS private zones, forwarding, and peering** tie back to **hybrid connectivity** (VPN/Interconnect) from the VPC topic. Master this and you can narrate an end-to-end request from the user's browser all the way to a backend — the exact walkthrough senior system-design interviews ask for.

### Q1. What is Cloud DNS and what are public versus private zones?

**Cloud DNS** is Google's **managed authoritative DNS** service — you host your domain's zones on Google's globally-distributed **anycast** name servers, and it's backed by a **100% availability SLA**. You manage records via API/`gcloud`/Terraform rather than running BIND.

Two zone types:

- **Public zone** — authoritative for a domain on the **public internet**; anyone on the internet resolving `example.com` gets answers from here. This is your externally-visible DNS.
- **Private zone** — resolves names **only inside the VPC(s)** you authorize; the records are invisible to the internet. Use it for **internal service names** (e.g. `db.internal.acme`, `api.svc.internal`) that should only resolve for your workloads.

The same name can exist in both a public and a private zone with different answers — that's **split-horizon** DNS (Q3). Cloud DNS also underpins the private DNS that GKE and internal load balancers rely on. In interviews: authoritative + managed + anycast + a strict split between internet-facing (public) and VPC-internal (private) resolution.

### Q2. Which DNS record types should you know, and what is DNSSEC?

Core record types:

- **A / AAAA** — hostname → IPv4 / IPv6 address.
- **CNAME** — alias one name to another name.
- **MX** — mail exchangers for the domain.
- **TXT** — arbitrary text; used for SPF/DKIM/DMARC and domain-ownership verification.
- **NS** — delegates a zone to name servers.
- **SOA** — zone authority/serial metadata.
- **SRV** — service location (host + port), common in service discovery.
- **PTR** — reverse DNS (IP → name).

**DNSSEC** (DNS Security Extensions) **cryptographically signs** your zone's records so a resolver can **verify the answer wasn't forged or tampered with** in transit. It defends against **cache poisoning / spoofing**, where an attacker injects fake DNS answers to redirect users to malicious hosts. Cloud DNS can enable DNSSEC on a public zone with a toggle and manages the signing keys; you then publish a **DS record** at your registrar to complete the chain of trust. It protects **integrity/authenticity**, not confidentiality — DNS queries themselves aren't encrypted by DNSSEC. Enable it for any domain where spoofing would be damaging (auth, payments, anything phishing-sensitive).

### Q3. What is split-horizon DNS and how do you implement it in GCP?

**Split-horizon** (a.k.a. split-brain) DNS means **the same hostname resolves to different answers depending on who's asking** — typically internal clients get a private/internal IP while external clients get a public IP.

Why: you want `api.acme.com` to route **internal** traffic to a **private internal load balancer / internal IP** (staying on the VPC backbone, avoiding internet egress and exposure) while **external** users resolve it to the **public** front end.

In GCP you implement it with **two zones for the same name**:

- A **private zone** for `api.acme.com` authorized on your VPC(s), returning the **internal** IP.
- A **public zone** for `api.acme.com` on the internet, returning the **public** IP.

VMs in the authorized VPCs consult the private zone (internal answer); everyone else hits the public zone (public answer). This keeps internal service-to-service traffic private and low-latency, avoids hair-pinning through the public internet, and lets you present a clean single hostname to both audiences. It's a very common enterprise pattern and a good signal you understand private zones.

### Q4. Explain Cloud DNS routing policies and give a use case for each.

Cloud DNS **routing policies** let a zone return **different records based on rules**, turning DNS into a global traffic-management tool:

| Policy | Behaviour | Use case |
|---|---|---|
| **Weighted round-robin** | Split answers by configured weights | **Canary / gradual rollout** or A/B — send 90% to v1, 10% to v2 |
| **Geolocation** | Answer based on the **client's region** | Send EU users to the EU endpoint, US users to the US endpoint (latency, data residency) |
| **Failover** | Health-checked primary; fall back to secondary if unhealthy | **DR** — resolve to the standby region only when primary fails |

**Weighted** is your knob for controlled traffic shifting between versions or backends without touching clients. **Geolocation** directs users to the nearest/appropriate regional stack for latency and compliance. **Failover** ties DNS answers to **health checks** so clients stop being handed a dead endpoint. Caveat to state: DNS-level routing is subject to **resolver/record caching (TTL)**, so it reacts more slowly than connection-time load-balancer health checks — use it for coarse geo/version/DR steering, and rely on the **global load balancer** for fast, per-request health-based routing.

### Q5. How do you set up hybrid DNS resolution between GCP and on-premises?

You bridge Cloud DNS private zones with the on-prem resolver so names resolve **both directions** over your VPN/Interconnect:

- **Outbound DNS forwarding** — a **forwarding zone** in Cloud DNS sends queries for on-prem domains (e.g. `corp.internal`) to your **on-prem DNS servers'** IPs, so GCP workloads can resolve on-prem hostnames.
- **Inbound DNS forwarding** — an **inbound server policy** creates resolver endpoints (internal IPs) in your VPC that **on-prem systems point to**, so on-prem can resolve your GCP private zone names.
- **DNS peering** — lets one VPC's Cloud DNS use another VPC's zones/forwarding, useful in **Shared VPC / hub-and-spoke** so spokes inherit centralized DNS.

This requires private connectivity (**Cloud VPN or Interconnect**) already in place, since the forwarding traffic rides that link. The result is seamless name resolution across the hybrid estate: GCP VMs resolve `db.corp.internal`, on-prem hosts resolve `svc.gcp.internal`, and centralized DNS is administered once. It's the DNS complement to the hybrid networking you set up in the VPC topic.

### Q6. How does Cloud CDN integrate with load balancing?

**Cloud CDN is a feature you enable on a backend of the global external HTTP(S) (Application) Load Balancer** — it is *not* a standalone product you point at an origin. You flip `--enable-cdn` on a **backend service** (VMs/GKE/Cloud Run via a NEG) or a **backend bucket** (Cloud Storage), and Google's edge caches then front that backend.

The flow: a request hits the LB's **global anycast IP** at the **nearest Google POP**; if Cloud CDN has a fresh cached copy (**cache hit**), it's served from the edge and **never reaches your origin**; on a **miss**, the LB fetches from the backend, caches it per your cache mode/TTL, and returns it.

```bash
gcloud compute backend-services update my-backend \
  --enable-cdn --cache-mode=CACHE_ALL_STATIC --global
```

Why this design matters: because CDN rides the **same LB** that already does global routing, TLS termination, URL maps, and Cloud Armor, you get caching "for free" on top of your existing front door — one IP, one cert, one set of routing rules, with edge caching layered in. The interview point is that **the LB is the origin front end and CDN is an attribute of its backends**.

### Q7. Explain Cloud CDN cache modes and how you'd choose one.

Three cache modes govern **what** gets cached:

| Mode | Behaviour |
|---|---|
| **`USE_ORIGIN_HEADERS`** | Cache **only** what your origin explicitly marks cacheable via `Cache-Control`/`Expires`. You're in full control from the origin. |
| **`CACHE_ALL_STATIC`** | Automatically cache common **static** content types (based on content type/extension) **plus** anything the origin marks cacheable. Sensible default. |
| **`FORCE_CACHE_ALL`** | Cache **all** successful responses regardless of origin headers, using the CDN's default TTLs. |

Choose by how much you trust/control your origin headers:

- **`CACHE_ALL_STATIC`** is the pragmatic default — it caches images, CSS, JS, etc. without you perfecting every origin header, while still honouring explicit directives.
- **`USE_ORIGIN_HEADERS`** when you want **precise, origin-driven control** (mixed dynamic/static apps, correctness-sensitive caching).
- **`FORCE_CACHE_ALL`** only for **backends serving exclusively cacheable content** (e.g. a static asset bucket) — dangerous elsewhere because it will happily cache personalized or dynamic responses, serving one user's content to another. Never point `FORCE_CACHE_ALL` at an app that returns per-user pages.

### Q8. What are cache keys and how do they affect hit ratio?

The **cache key** is the set of request attributes Cloud CDN uses to decide whether two requests are "the same object." By default it includes **host + path + query string** (and protocol). If two requests produce the same key, the second is a **hit**.

Tuning the cache key directly moves your **hit ratio**:

- **Dropping the query string** (or including only specific params) means URLs that differ only by irrelevant params — tracking tags like `?utm_source=…`, session junk — all collapse to **one** cached object instead of many near-duplicates. Big hit-ratio win.
- **Excluding the host** lets multiple hostnames share cache entries for identical content.
- **Excluding/including specific headers or cookies** controls whether variants are cached separately.

The tension: an **over-specific** key (includes volatile params/headers) fragments the cache — low hit ratio, more origin load. An **over-broad** key risks serving the **wrong variant** (e.g. ignoring a param that actually changes the response, or ignoring a language header). So you widen the key only for attributes that genuinely change the content, and strip the ones that don't. A low hit ratio is very often a **cache-key hygiene** problem (unstripped query params) before it's anything else.

### Q9. How does TTL and cache invalidation work in Cloud CDN?

**TTL** decides how long an object stays fresh in the cache before the CDN revalidates/refetches from origin. It comes from origin `Cache-Control`/`Expires` headers (in header-respecting modes) or from configurable **default/max/client TTLs** on the backend. Longer TTLs = higher hit ratio and less origin load, but staler content.

**Invalidation** proactively purges cached objects before their TTL expires (e.g. after a deploy):

```bash
gcloud compute url-maps invalidate-cdn-cache my-url-map --path="/assets/*"
```

Two things interviewers want you to know: invalidation is **best-effort and rate-limited** — it's for occasional "oops, purge that" moments, **not** a routine per-deploy mechanism at scale. The **better pattern is versioned/fingerprinted URLs** (`/assets/app.9f2c1a.js`) plus long TTLs: new deploys reference new URLs, so there's **nothing to invalidate** — old objects age out naturally and clients fetch the new immutable ones immediately. Design so you rarely need invalidation; rely on cache-busting URLs and correct TTLs instead.

### Q10. When would you use signed URLs or signed cookies with Cloud CDN?

Use them when you need to serve **private, cacheable content** through the CDN to **authorized users only**, without making the objects public. Both grant **time-limited, cryptographically-signed** access:

- **Signed URL** — a single URL with an embedded signature and expiry; good for **one specific resource** (a paywalled PDF, a single video file, a download link). Share/expire per object.
- **Signed cookie** — a signed cookie authorizes access to **many objects under a path prefix** for a session; better for **streaming or apps** where a user pulls **lots of segments/assets** (e.g. HLS/DASH video chunks) and you don't want to sign every URL.

The benefit over origin-only auth: content is still **cached at the edge** (fast, offloads origin) yet **access-controlled** — the CDN validates the signature/cookie before serving. Typical use: premium media, paid downloads, or member-only assets. Rule of thumb: **one item → signed URL; a whole session/many segments → signed cookie**. Keep expiries short and rotate signing keys.

### Q11. What is negative caching and why does it matter?

**Negative caching** is caching **error/redirect responses** (e.g. `404 Not Found`, `301`, `410`, `5xx`) at the edge for a short TTL, instead of forwarding every failing request to your origin.

Why it matters: without it, a flood of requests for a missing or bad URL — a hot broken link, a scanning bot, or a viral 404 — hammers your **origin** repeatedly for responses that won't change. Negative caching lets the **CDN absorb those** by serving the cached error from the edge, **protecting the origin** from being overwhelmed by failures. This is both a **performance/cost** and a **resilience** feature: it shields backends during error storms and reduces useless origin traffic.

Cloud CDN lets you configure negative-caching TTLs **per status code**, so you can cache a `404` for, say, 120s but keep `5xx` TTLs very short (you *want* to retry transient server errors quickly, not pin a stale error). The interview nuance: negative-cache aggressively for stable client errors (404/410), conservatively for server errors (5xx), so you don't prolong an outage by caching it.

### Q12. What's the difference between Cloud CDN and Media CDN?

Both are Google edge-caching products, but they target different workloads:

| | Cloud CDN | Media CDN |
|---|---|---|
| Best for | Web assets, APIs, general HTTP(S) content | **Large-scale video / media streaming** |
| Edge network | Google's CDN edge (integrated with the external LB) | The **YouTube/Google media edge** — massive scale/capacity |
| Integration | A feature of the **external HTTP(S) LB** backends | Separate product, media-optimized (large egress, streaming) |
| Use when | Websites, single-page apps, downloads, API responses | VOD/live streaming, huge concurrent audiences, big files |

**Cloud CDN** is the right default for **websites and APIs** — it's baked into your load balancer and caches your static/dynamic HTTP content. **Media CDN** is purpose-built for **streaming video at scale** (VOD and live) and huge file distribution, running on the same edge infrastructure that serves YouTube, with capabilities tuned for high-throughput media delivery to very large audiences. In an interview: web/app/API caching → **Cloud CDN**; a global video-streaming platform → **Media CDN**. Choosing Cloud CDN for a large streaming service (or Media CDN for a small website) is the anti-pattern.

### Q13. Compare Google-managed and self-managed certificates in Certificate Manager.

**Certificate Manager** provisions and manages TLS certificates for your load balancers at scale.

| | Google-managed | Self-managed |
|---|---|---|
| Issuance & renewal | **Automatic** — Google obtains and **auto-renews** | You obtain from a CA and **upload**; you track expiry/renewal |
| Validation | DNS or load-balancer authorization | You handle CA validation yourself |
| Effort / risk | Low; no expiry outages if DNS stays valid | Higher; **manual renewal = risk of expiry outages** |
| Use when | You own the domain and just need TLS on the LB | You need a specific CA, EV/OV cert, or an existing cert/key |

**Google-managed certificates** are the default choice: Google issues and **automatically renews** them, eliminating the classic "the cert expired at 2am" outage, and they scale to many domains (including wildcard and large SAN sets via Certificate Manager). You just prove domain control (via DNS authorization) and attach the cert to the LB.

Reach for **self-managed** only when you have a hard requirement Google-managed can't meet — a specific corporate CA, an **EV/OV** certificate, or a pre-existing cert/private key you must reuse — accepting that you now own **renewal**, which is the main operational hazard. For most services: Google-managed, and let auto-renewal remove a whole class of incidents.

### Q14. What are SSL policies and why configure minimum TLS versions?

An **SSL policy** attaches to the load balancer's HTTPS/SSL front end and controls **which TLS versions and cipher suites** clients are allowed to negotiate. You set a **minimum TLS version** (e.g. TLS 1.2 or 1.3) and a profile:

- **COMPATIBLE** — broadest client support (older ciphers/versions allowed).
- **MODERN** — modern clients, drops the weakest options.
- **RESTRICTED** — only strong, current ciphers (for strict compliance).
- **CUSTOM** — you pick the exact cipher list.

Why configure it: **compliance and security posture**. Standards like **PCI-DSS** require disabling old, vulnerable protocol versions (SSLv3, TLS 1.0/1.1) and weak ciphers. Without an SSL policy the LB may accept downgrade-prone legacy TLS, exposing you to attacks and failing audits. Setting **minimum TLS 1.2 (or 1.3)** with a MODERN/RESTRICTED profile enforces strong crypto for every connection.

The tradeoff to acknowledge: the stricter the policy, the more **very old clients** you cut off. So you choose the minimum version by balancing your compliance requirements against the real client population — but for most modern services **TLS 1.2 minimum** is the floor, trending to 1.3.

### Q15. Design the edge for a global website that serves both a dynamic app and static assets, and must be protected from attacks. Walk through the components.

Compose the front door around a **single global external Application Load Balancer** on an **anycast IP** (requires **Premium network tier**):

1. **Cloud DNS (public zone)** — resolve `www.acme.com` to the LB's **global anycast IP**; add **DNSSEC**; optionally **geolocation/failover routing policies** for multi-region DR.
2. **Global external HTTP(S) Load Balancer** — one anycast IP, one URL map routing by path:
   - `/*` (dynamic) → a **backend service** (Cloud Run / GKE / MIG via NEGs).
   - `/static/*`, images, JS/CSS → a **backend bucket** (Cloud Storage) for static assets.
3. **Cloud CDN** — enable on **both** backends. `CACHE_ALL_STATIC` (or `FORCE_CACHE_ALL` on the pure static bucket) for assets; header-driven caching for cacheable dynamic responses. Tune **cache keys** (strip tracking params) for a high **hit ratio**; use **versioned URLs** + long TTLs, negative caching for 404s, and **signed URLs/cookies** for any private assets.
4. **Certificate Manager** — a **Google-managed** TLS cert on the LB (auto-renewing), with an **SSL policy** enforcing **TLS 1.2+**.
5. **Cloud Armor** — attach a security policy to the backend services for **edge DDoS mitigation and WAF** rules (rate limiting, geo/IP blocking, OWASP rules), screening traffic **at the POP** before it reaches origins.
6. **Origins in the VPC** — backends run privately (Cloud NAT/Private Google Access as needed); the LB is the only public entry point.

The narrative: **DNS → anycast IP → global LB (TLS termination + URL map) → Cloud Armor filtering → Cloud CDN edge cache → backend service or backend bucket**. Every edge concern — performance (CDN/anycast), security (Armor/certs/SSL policy), and availability (global LB, DNS failover) — hangs off that one load balancer.
## Load Balancing

### Summary

**What this topic covers**

How Google Cloud fronts traffic — the Cloud Load Balancing family, how requests reach your backends, and how you pick the right load balancer for a given scenario. The 15 questions here span the modern LB taxonomy (global vs regional, external vs internal, application L7 vs network L4), the global anycast VIP model that makes Google LBs behave differently from AWS ELBs (no pre-warming), backend services and backend types (managed instance groups and the four NEG flavours), health checks and their firewall-range gotcha, cross-region failover, the Cloud CDN + Cloud Armor stack that bolts onto the external Application LB, session affinity, URL-map host/path routing, SSL termination with Certificate Manager, serverless NEGs fronting Cloud Run/Functions/App Engine, and the Premium-vs-Standard network tier decision. If you can draw the request path from a user's browser through the anycast VIP, forwarding rule, target proxy, URL map, backend service, health check, and NEG to a running container, you can answer almost everything here.

**Mental model**

Think of a Google Cloud load balancer as a **stack of decomposed resources**, not one appliance. A *forwarding rule* binds an IP + port to a *target proxy* (HTTP(S)/TCP/SSL) or directly to a *backend service* (for passthrough L4). The target proxy consults a *URL map* (L7 only) that host/path-routes to one of several *backend services*. Each backend service points at *backends* — managed instance groups or NEGs — and is guarded by a *health check*. The killer property of Google's external L7/L4 proxy load balancers is that the VIP is a **global anycast address** announced from every Google edge PoP: a user in Tokyo and a user in Frankfurt hit the *same IP* but land on the nearest healthy backend. The LB is software-defined and effectively infinitely scalable — there is **no pre-warming** (unlike AWS ELB), and you never manage LB instances. Regional and passthrough LBs are the exceptions to "global". Internally, a load balancer is where CDN, Cloud Armor (WAF/DDoS), TLS termination, and identity-aware proxy all attach.

**Key terms**

- **Forwarding rule** — the IP+protocol+port entry point; maps traffic to a target proxy or backend service.
- **Target proxy** — terminates the client connection for L7/SSL LBs and hands off to the URL map.
- **URL map** — L7 host/path routing rules choosing a backend service (the "router").
- **Backend service** — logical group of backends + health check + LB policy (affinity, timeout, Cloud CDN toggle).
- **NEG (Network Endpoint Group)** — backend type addressing endpoints directly: **zonal** (IP:port), **serverless** (Cloud Run/Functions/App Engine), **internet** (external origins), **hybrid** (on-prem/other-cloud).
- **MIG (Managed Instance Group)** — autoscaled/autohealed VM backend, the classic instance-group backend.
- **Health check** — probes backends; only healthy ones receive traffic. Google probers come from `35.191.0.0/16` and `130.211.0.0/22`.
- **Global anycast VIP** — one IP announced from all edges; nearest-PoP routing, no pre-warming.
- **Cloud CDN** — edge caching flag on a backend service (external App LB only).
- **Cloud Armor** — WAF + DDoS + geo/IP rules attached to an external App LB backend service.
- **Certificate Manager** — managed TLS certs (incl. wildcard/SAN, thousands of domains) for LB SSL termination.
- **Network tier** — Premium (Google backbone, global) vs Standard (public internet egress, regional, cheaper).

**Why interviewers ask this**

Load balancing is where networking, reliability, and cost intersect, so it separates candidates who *provisioned* an LB from ones who *understand* it. Junior signal: "I created an HTTP load balancer" with no idea what a URL map or backend service is. Senior signal: reasoning about the global anycast model ("no pre-warming, so I don't need to warm the LB before a launch spike"), knowing serverless NEGs are how you put Cloud Armor in front of Cloud Run, and immediately citing the `35.191.0.0/16`/`130.211.0.0/22` firewall ranges when someone's backends are all unhealthy. The strongest tell is scenario fluency: given "global web app, needs WAF and caching," they say *Global external Application LB + Cloud CDN + Cloud Armor* without hesitating, and given "internal microservice-to-microservice TCP," they say *Internal passthrough Network LB*.

**Common confusions**

- "All Google load balancers are global" — only the external Application LB, external Application/Proxy, and classic global LBs are global anycast; passthrough Network LBs and internal/regional LBs are regional.
- "I need to pre-warm the LB for a traffic spike" — no; the external LBs are software-defined and scale instantly. Pre-warming is an AWS ELB concept.
- "Health checks come from my subnet" — they come from Google's prober ranges `35.191.0.0/16` and `130.211.0.0/22`; forgetting to allow these is the #1 "all backends unhealthy" cause.
- "A NEG is just an instance group" — NEGs address endpoints (IP:port, serverless services, internet origins) directly and are how you front Cloud Run/Functions or hybrid backends.
- "Cloud CDN and Cloud Armor work on any LB" — they attach to the **external Application LB** backend service, not internal or passthrough L4 LBs.
- "L4 passthrough terminates TLS" — passthrough Network LBs don't terminate anything; the client connection reaches the backend intact. TLS termination is an L7/SSL proxy feature.

**What follows from this topic**

Load balancing sits on top of **VPC networking** (subnets, firewall rules, network tiers) and fronts every compute surface — **GKE** (via ingress and container-native NEGs), **Compute Engine** MIGs, and **serverless** (Cloud Run/Functions via serverless NEGs). The health-check and failover material connects to **reliability/SRE** design (multi-region, SLOs). Cloud Armor and Certificate Manager connect to the **security** topics (WAF, TLS, IAP). And the database topics that follow assume traffic has already been routed and terminated here before it reaches an app tier that talks to Cloud SQL, Spanner, or Firestore.

### Q1. What load balancers does Google Cloud offer, and how are they organised?

Google organises Cloud Load Balancing along three axes: **traffic layer** (Application/L7 vs Network/L4), **exposure** (external/internet-facing vs internal/private), and **scope** (global vs regional). The modern names encode all three:

| Name | Layer | Exposure | Scope | Typical use |
|---|---|---|---|---|
| Global external Application LB | L7 | External | Global | Global web apps, APIs; CDN + Cloud Armor |
| Regional external Application LB | L7 | External | Regional | L7 in one region, data-residency needs |
| Internal Application LB | L7 | Internal | Regional (cross-region option) | Internal microservices, host/path routing |
| External passthrough Network LB | L4 | External | Regional | TCP/UDP, preserve client IP, non-HTTP |
| Internal passthrough Network LB | L4 | Internal | Regional | Internal TCP/UDP, service-to-service |
| Global external Proxy Network LB | L4 (proxy) | External | Global | Global TCP with proxy, TLS offload (SSL proxy) |

The mental split: **Application LBs** terminate HTTP(S), give you URL maps, and can attach CDN/Armor. **Network LBs** are L4 — passthrough ones preserve the client source IP and don't terminate TLS; proxy ones terminate the TCP/SSL connection. Global = anycast VIP; regional/internal = single-region.

### Q2. Why are Google Cloud external load balancers "global," and what does that give you that AWS ELB doesn't?

The external Application LB uses a **global anycast IP**: one VIP is announced via BGP from every Google edge PoP worldwide. A client's packets enter Google's network at the *nearest* PoP and ride the Google backbone to the closest healthy backend region. Two practical consequences:

1. **No pre-warming.** The LB is a software-defined, globally distributed system, not a fleet of appliances you scale. You can go from zero to a massive spike with no warm-up request to support — unlike classic AWS ELB, which historically needed pre-warming (or a support ticket) for sudden large spikes.
2. **One IP, global failover.** You point DNS at a single anycast address; cross-region routing and failover happen inside the LB. No latency-based DNS or Route 53 health-check dance needed for the basic case.

The tradeoff: this "global" behaviour requires the **Premium network tier** (Google backbone). Standard tier is regional and egresses over the public internet.

### Q3. Walk through the request path of a Global external Application LB.

```text
Client → anycast VIP (forwarding rule) → target HTTP(S) proxy
      → URL map (host/path routing) → backend service
      → backend (MIG or NEG), filtered by health check → instance/container
```

- **Forwarding rule**: binds the global VIP + port 443 to the target HTTPS proxy.
- **Target HTTPS proxy**: terminates TLS (using a cert from Certificate Manager or a self-managed cert), then consults the URL map.
- **URL map**: routes by host and path — e.g. `api.acme.com/v1/*` → `api-backend`, `/static/*` → `static-backend`.
- **Backend service**: holds the LB policy — session affinity, timeout, Cloud CDN toggle, Cloud Armor policy — and lists backends with a health check.
- **Backend**: a managed instance group or a NEG. Only endpoints passing the health check receive traffic.

Cloud Armor evaluates at the edge before the backend service; Cloud CDN can serve cacheable responses without hitting the backend at all.

### Q4. What is a backend service and what backend types can it hold?

A **backend service** is the configuration object that binds a group of backends to a health check and an LB policy (balancing mode, session affinity, timeouts, connection draining, Cloud CDN, Cloud Armor, IAP). Backend types:

- **Managed instance groups (MIGs)** — autoscaled/autohealed Compute Engine VMs. Balance by CPU utilisation, rate (RPS), or connections.
- **NEGs (Network Endpoint Groups)**:
  - **Zonal NEG** — raw `IP:port` endpoints, used for **container-native LB** in GKE (traffic goes straight to pods, skipping kube-proxy hops).
  - **Serverless NEG** — points at Cloud Run, Cloud Functions, or App Engine services.
  - **Internet NEG** — an external origin (public FQDN/IP), e.g. to front a third-party or on-prem origin behind Google's CDN.
  - **Hybrid NEG** — endpoints in on-prem or another cloud, reached over Cloud Interconnect/VPN.

One backend service can spread across multiple regions' backends (global LB), which is how cross-region balancing works.

### Q5. How do health checks work, and what is the classic firewall misconfiguration?

A **health check** probes each backend on a port/path at an interval; a backend must pass N consecutive checks to be marked healthy and receive traffic, and fail M to be drained. Types: HTTP, HTTPS, HTTP/2, TCP, SSL, and gRPC.

The classic failure: **all backends show unhealthy** even though the app is fine. Cause: Google's health-check probers originate from the ranges **`35.191.0.0/16`** and **`130.211.0.0/22`**, and the VPC firewall doesn't allow ingress from them to the backend port.

```bash
gcloud compute firewall-rules create allow-health-checks \
  --network=my-vpc \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:8080 \
  --source-ranges=35.191.0.0/16,130.211.0.0/22
```

Memorise both ranges — it's a near-guaranteed interview and on-call question. (Internal passthrough LBs also use `35.191.0.0/16`; legacy/target-pool health checks may use `35.191.0.0/16` + `209.85.152.0/22` + `209.85.204.0/22`.)

### Q6. What are Network Endpoint Groups (NEGs) and why do they matter for serverless and GKE?

A **NEG** is a backend that addresses endpoints directly rather than via an instance group. Two matter most:

- **Serverless NEG** — the *only* way to put a Google load balancer in front of **Cloud Run, Cloud Functions, or App Engine**. This is how you get **Cloud Armor (WAF/DDoS), Cloud CDN, a custom domain, and a static anycast IP** in front of a serverless service. Without it, Cloud Run just has its `run.app` URL.
- **Zonal NEG (GNEG)** — enables **container-native load balancing** in GKE: the LB sends traffic straight to pod IPs (via the NEG) instead of to a node port and then an extra kube-proxy hop. Result: accurate health checking per-pod, better load distribution, and correct client-IP/session-affinity behaviour.

```bash
gcloud compute network-endpoint-groups create cr-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=my-service
```

### Q7. How does cross-region load balancing and failover work?

With a **global** external (or cross-region internal) Application LB, a single backend service references backends in **multiple regions**. Normal operation: the anycast VIP routes each client to the *closest* healthy region. Failover: if a region's backends fail health checks or hit capacity, the LB automatically **spills traffic to the next-closest healthy region** — no DNS change, no manual step.

You tune this with the backend **balancing mode** and **capacity scaler** (e.g. cap a region at 80% then overflow) and with **failover policies** on internal passthrough LBs (primary/backup backend groups). For active-passive DR you set the standby region's capacity scaler low so it only takes traffic when the primary is unavailable. This is materially simpler than AWS's Route 53 health-check + latency/failover-routing approach because the failover lives in the anycast data plane, not in DNS.

### Q8. How do Cloud CDN and Cloud Armor integrate with the load balancer?

Both attach to the **backend service of an external Application LB**:

- **Cloud CDN** — a toggle on the backend service. Cacheable responses are served from Google's edge caches at ~100+ PoPs, honouring `Cache-Control`/`ETag`, with cache modes (`CACHE_ALL_STATIC`, `USE_ORIGIN_HEADERS`, `FORCE_CACHE_ALL`), signed URLs/cookies, and negative caching. Cuts origin load and latency.
- **Cloud Armor** — a security policy attached to the backend service. Provides always-on **DDoS** protection, a **WAF** (preconfigured OWASP rules for SQLi/XSS/LFI), custom rules (IP allow/deny, geo-blocking, rate limiting/throttling), and **Adaptive Protection** (ML-based L7 DDoS detection). Rules evaluate at the edge *before* traffic reaches your backend.

Because these live on the LB, fronting a **Cloud Run** service with them just means adding a **serverless NEG** behind a Global external Application LB.

### Q9. What is session affinity and when do you need it?

**Session affinity** makes the LB send requests from the same client to the same backend, trading even distribution for stickiness. Options on the backend service:

- **None** (default) — pure load spreading.
- **Client IP** — hash of source IP; coarse (NAT/proxies collapse many users to one backend).
- **Client IP + protocol / + port** — finer-grained hashing.
- **Generated cookie (`GCLB`)** — LB sets a cookie; most reliable for HTTP.
- **Header-based / HTTP cookie-based** — affinity on a named header or app cookie.

Use it for **stateful** backends (in-memory session, sticky websockets, upload assembly). The senior take: prefer **stateless** backends with shared state in Memorystore/Redis or a database so you *don't* need affinity — affinity undermines even load distribution and complicates draining. Reach for it only when the backend genuinely can't be made stateless.

### Q10. How does URL-map based host and path routing work?

The **URL map** is the L7 router on Application LBs. It matches on **host** then **path** to pick a backend service, so one VIP + one cert can serve many services:

```text
host: api.acme.com
  /v1/*        → api-v1-backend
  /v2/*        → api-v2-backend
host: www.acme.com
  /static/*    → gcs-static-backend (Cloud CDN on)
  /*           → web-frontend-backend
default        → web-frontend-backend
```

It also supports advanced routing: header/query-param matching, weighted traffic splitting (canary/blue-green — e.g. 95% v1 / 5% v2), URL rewrites, redirects, and fault injection (via route actions). This is what lets you run a **canary** or **blue-green** rollout at the LB layer, and to consolidate microservices behind a single hostname.

### Q11. How is SSL/TLS handled, and what does Certificate Manager add?

On Application and SSL-proxy LBs, the **target HTTPS/SSL proxy terminates TLS** at the edge; backend connections can be plaintext or re-encrypted. You attach one or more SSL certificates to the proxy.

- **Self-managed certs** — you upload key + cert (and rotate them).
- **Google-managed certs** — Google provisions and auto-renews via ACME; classic managed certs cap at ~100 domains.
- **Certificate Manager** — the scalable path: manage **thousands** of domains, **wildcard** and **SAN** certs, DNS-authorised issuance, and certificate maps that pick a cert by SNI hostname. Use it for multi-tenant/large-domain fleets.

You also set an **SSL policy** (min TLS version, cipher profile: `COMPATIBLE`/`MODERN`/`RESTRICTED`/custom) to enforce, say, TLS 1.2+ and strong ciphers. Passthrough Network LBs do **not** terminate TLS — encryption stays end-to-end to the backend.

### Q12. How do you choose the right load balancer for a scenario?

Decision flow:

1. **Is it HTTP(S) and do you want L7 features (URL routing, CDN, WAF)?** → **Application LB**. External-facing + global → **Global external Application LB**. Internal service mesh ingress → **Internal Application LB**.
2. **Non-HTTP (TCP/UDP), or must you preserve the client source IP / not terminate TLS?** → **passthrough Network LB** (external or internal).
3. **Global TCP with TLS offload but not HTTP?** → **Proxy Network LB / SSL Proxy**.
4. **Fronting Cloud Run/Functions with a custom domain + Armor + CDN?** → **Global external Application LB + serverless NEG**.
5. **Internal microservice-to-microservice TCP?** → **Internal passthrough Network LB**.

Quick mappings: *global web app + WAF + cache* → Global external App LB + Cloud Armor + Cloud CDN. *Internal gRPC/HTTP microservices* → Internal Application LB with container-native NEGs. *Gaming/UDP or SMTP* → external passthrough Network LB.

### Q13. What's the effect of Premium vs Standard network tier on load balancing?

The **network tier** controls which network path traffic takes and gates which LBs you can use:

| | Premium tier | Standard tier |
|---|---|---|
| Path | Google global backbone (cold-potato) | Public internet (hot-potato), egress near source |
| LB scope | Global anycast LBs available | Regional LBs only |
| Latency/reliability | Lower, more consistent | Variable (public internet) |
| Cost | Higher egress | Cheaper egress |

If you want a **global external Application LB with one anycast VIP**, you need **Premium**. Standard tier caps you at regional load balancing and a regional external IP — fine for cost-sensitive, single-region, latency-tolerant workloads. The interview point: "global anycast" and "Premium tier" are coupled — you can't get global behaviour on Standard.

### Q14. A team fronts Cloud Run with a Global external Application LB but every request 502s / backends are "unhealthy." What do you check?

Ordered checklist:

1. **Serverless NEG wiring** — is the backend service actually backed by a **serverless NEG** pointing at the correct Cloud Run service and region? A mismatched region/service silently fails.
2. **Cloud Run ingress setting** — if ingress is set to **"Internal and Cloud Load Balancing"** vs "All," ensure it permits LB traffic; if set to internal-only without LB allowance, the LB can't reach it.
3. **Health checks** — for serverless NEGs health checking is managed, but for VM/zonal-NEG backends, verify the firewall allows **`35.191.0.0/16`** and **`130.211.0.0/22`** to the serving port.
4. **Host header / URL map** — does the URL map's host rule match the domain the client uses? A missing default route sends unmatched hosts nowhere.
5. **TLS cert status** — a managed cert stuck in `PROVISIONING` (DNS not pointed at the VIP yet) causes handshake failures.
6. **Cloud Armor** — an over-broad deny or geo rule can 403/return errors before the backend.

For serverless-specific 502s, the top two are almost always the NEG region mismatch and Cloud Run ingress restriction.

### Q15. What's the anti-pattern in "we put an internal passthrough Network LB in front of our public web app and added Cloud Armor to it"?

Two mistakes compounded:

1. **Internal passthrough LB is not internet-facing.** It only serves traffic from within the VPC (and connected networks). A public web app needs an **external** LB. So the "public web app" isn't actually reachable from the internet through it.
2. **Cloud Armor and Cloud CDN attach to external Application LB backend services, not to passthrough Network LBs.** Passthrough L4 LBs don't terminate the connection, have no backend-service HTTP context, and can't run a WAF. So the Cloud Armor policy isn't doing what they think.

The correct design: **Global external Application LB** (L7) with the backend service carrying the **Cloud Armor** policy (WAF/rate limiting) and optionally **Cloud CDN**, TLS terminated at the proxy via Certificate Manager, backends as MIGs or serverless NEGs. Passthrough Network LBs are for internal or non-HTTP L4 traffic where you must preserve the client IP and don't need L7 features — the opposite of this use case.

## Relational Databases: Cloud SQL, AlloyDB & Cloud Spanner

### Summary

**What this topic covers**

Google Cloud's three managed relational databases and, critically, **when to reach for each**. The 17 questions here cover Cloud SQL (managed MySQL/PostgreSQL/SQL Server — HA regional config with a synchronous standby and automatic failover, read replicas including cross-region, backups and point-in-time recovery, connection options, and the ~64 TB ceiling where you outgrow it), AlloyDB (PostgreSQL-compatible with a columnar engine for analytics and much higher throughput — its positioning against Cloud SQL and against AWS Aurora), and Cloud Spanner (globally distributed, horizontally scalable, strongly consistent relational with TrueTime, external consistency, splits, processing units/nodes, and multi-region configs). Cross-cutting: HA vs read scaling, connection pooling for serverless, encryption and CMEK, Database Migration Service, and the equally important question of when Spanner is overkill.

**Mental model**

Picture a **capability ladder**. **Cloud SQL** is "a managed VM running MySQL/Postgres/SQL Server" — single primary, vertical scaling, HA via a hot standby, read replicas for read scaling. It's the default for OLTP that fits on one machine (up to ~64 TB) and speaks stock SQL wire protocols. **AlloyDB** is the next rung for PostgreSQL: it disaggregates compute from a distributed storage layer, adds an in-memory **columnar engine** so the *same* database serves fast transactions *and* analytical queries, and scales reads far past Cloud SQL — Google's answer to Amazon Aurora. **Cloud Spanner** is a different species: a horizontally scalable, globally distributed relational database that keeps **strong (external) consistency** across regions using **TrueTime** (GPS + atomic clocks bounding clock uncertainty). You add nodes/processing units and it re-shards ("splits") automatically; there's no single primary to outgrow. The tradeoff ladder is: pick the *lowest* rung that meets your scale/availability needs, because each rung up costs more and constrains schema/query flexibility.

**Key terms**

- **Cloud SQL** — managed MySQL, PostgreSQL, SQL Server; regional HA, read replicas, up to ~64 TB.
- **HA configuration** — a **synchronous standby** in another zone with **automatic failover** (~60s); doubles cost.
- **Read replica** — asynchronous copy for read scaling; can be **cross-region**; not for HA/failover by itself.
- **PITR (point-in-time recovery)** — restore to any second within the retention window using binary/WAL logs.
- **Cloud SQL Auth Proxy** — sidecar giving IAM-authenticated, encrypted connections without allow-listing IPs.
- **AlloyDB** — PostgreSQL-compatible; disaggregated storage, **columnar engine** for HTAP, high read scale.
- **Cloud Spanner** — globally distributed, horizontally scalable, strongly consistent relational DB.
- **TrueTime** — Google's globally synchronised clock (bounded uncertainty) enabling external consistency.
- **External consistency** — the strongest guarantee: transactions appear in real-time commit order globally.
- **Split** — Spanner's unit of horizontal sharding; the system re-splits by load automatically.
- **Processing units / nodes** — Spanner capacity (1 node = 1000 PUs); scale independently of storage.
- **CMEK** — customer-managed encryption keys (Cloud KMS) layered over default encryption at rest.
- **DMS (Database Migration Service)** — managed, near-zero-downtime migrations into Cloud SQL/AlloyDB.

**Why interviewers ask this**

Choosing a database is one of the highest-leverage, hardest-to-reverse architecture decisions, so it's a favourite senior signal. Junior candidates reach for the most powerful tool ("we'll use Spanner so we never have scaling problems") and burn money and flexibility. Senior candidates right-size: Cloud SQL until you have a concrete reason to leave, AlloyDB when Postgres needs more read/analytics throughput than one machine, Spanner only when you genuinely need horizontal write scaling *and* strong global consistency (payments ledgers, global inventory, multi-region OLTP). Interviewers also probe operational depth: do you know HA (synchronous standby) is different from read replicas (async, read scaling)? Can you explain why Spanner hotspots on monotonic keys and how to avoid it? Do you connect serverless functions through a pooler because Postgres connections are expensive? Those distinctions reveal whether you've *run* these in production.

**Common confusions**

- "Read replicas give me HA" — no. A read replica is **async** and for read scaling; HA is a **synchronous standby** with automatic failover. You can promote a replica in a DR pinch, but that's not the same as automatic HA failover.
- "Spanner is just a bigger Cloud SQL" — different engine entirely: horizontal sharding, no single primary, TrueTime-based external consistency, different (subset) SQL and schema rules (interleaving, no arbitrary DDL patterns).
- "AlloyDB is Google's Spanner" — no; AlloyDB is **single-region, PostgreSQL-compatible**, competing with Aurora. Spanner is the globally distributed one.
- "Spanner has no scaling limits so it's always safe" — it scales, but **monotonic keys hotspot** a single split and throttle you; schema design matters enormously.
- "Cloud SQL scales horizontally" — it scales **vertically** (bigger machine) + read replicas. Write scaling is bounded by one primary and the ~64 TB ceiling.
- "Just connect Cloud Functions straight to Postgres" — serverless concurrency exhausts Postgres connection slots; you need a **pooler** (PgBouncer/AlloyDB Auth Proxy/Cloud SQL connectors) or you'll hit "too many connections."

**What follows from this topic**

This pairs with the **NoSQL** topic (Firestore & Bigtable) — together they cover the full "which datastore" decision, and the cross-service comparison question (Cloud SQL vs Spanner vs Firestore vs Bigtable) spans both. It connects to **BigQuery** for the analytics side (AlloyDB's columnar engine vs a dedicated warehouse), to **IAM/security** for CMEK and IAM database authentication, to **VPC/networking** for Private IP and the Auth Proxy, and to **serverless** for the connection-pooling constraints that shape how Cloud Run/Functions talk to a relational DB.

### Q1. What is Cloud SQL and what are its main capabilities and limits?

**Cloud SQL** is Google's fully managed relational database service for **MySQL, PostgreSQL, and SQL Server**. Google runs the OS, patching, backups, replication, and failover; you get a standard SQL endpoint. Capabilities:

- **HA** via a synchronous standby in a second zone with automatic failover.
- **Read replicas** (async), including **cross-region**, for read scaling and DR.
- **Automated backups + PITR**, on-demand backups, and one-click restore.
- **Vertical scaling** — resize CPU/RAM; storage auto-grows.
- **Connectivity**: Public IP (allow-listed), **Private IP** (VPC), and the **Cloud SQL Auth Proxy**/connectors with IAM auth.

Limits: it's a **single-primary** engine that scales **vertically + read replicas**, not horizontally for writes. Instance storage tops out around **64 TB**. When you exceed one machine's write throughput or need multi-region strong consistency, you've outgrown Cloud SQL and look to AlloyDB (Postgres, more scale) or Spanner (horizontal + global).

### Q2. How does Cloud SQL high availability work?

HA (the "regional" configuration) provisions a **standby instance in a different zone** in the same region, kept in sync via **synchronous replication** (Postgres/MySQL) at the storage/DB layer. If the primary's zone or instance fails, Cloud SQL performs an **automatic failover**: the standby is promoted and the same connection name/IP now points at it, typically within ~60 seconds. Applications reconnect; no data is lost because replication is synchronous.

Key points for interviews:
- HA is **zonal redundancy within one region**, not multi-region.
- It roughly **doubles cost** (you pay for the standby).
- The standby is **not** a readable replica — you can't offload reads to it.
- For cross-region DR you additionally use **cross-region read replicas** you can promote.

### Q3. What's the difference between HA (standby) and a read replica?

| | HA standby | Read replica |
|---|---|---|
| Replication | Synchronous | Asynchronous |
| Purpose | Failover / availability | Read scaling / DR |
| Readable? | No | Yes |
| Failover | Automatic | Manual promote |
| Data loss on failover | None | Possible (async lag) |
| Cross-region | No (same region) | Yes |

The trap interviewers set: "you have read replicas, so you're highly available, right?" No — read replicas are async and won't auto-fail-over; you could lose the last few seconds of writes and must manually promote. Use **HA standby** for availability and **read replicas** for read throughput; use a **cross-region replica** as a DR target you promote deliberately.

### Q4. Explain backups and point-in-time recovery in Cloud SQL.

Cloud SQL takes **automated daily backups** (in a chosen window) plus **on-demand** backups, retained per your policy. On top of backups, **point-in-time recovery (PITR)** uses continuously archived write-ahead/binary logs to let you restore to **any second within the retention window** — essential for recovering from a bad deploy or an accidental `DELETE`/`DROP` at 14:32:07.

```bash
gcloud sql instances clone my-instance my-instance-recovered \
  --point-in-time '2026-07-01T14:32:00Z'
```

PITR restores into a **new instance** (a clone), so you can inspect/extract data without clobbering production. Backups are geo-redundant-storable and can be used to seed replicas. The senior note: enabling PITR requires binary/WAL logging on, which has a small write-throughput and storage cost — worth it for any production OLTP database.

### Q5. What are the connection options for Cloud SQL and which is preferred?

- **Public IP + authorized networks** — allow-list client IP ranges. Simple, but exposes a public endpoint; avoid for production unless combined with the Auth Proxy.
- **Private IP (VPC peering)** — the instance gets a private RFC 1918 address reachable only inside your VPC. Preferred for security; no public exposure.
- **Cloud SQL Auth Proxy / language connectors** — a local proxy (or in-process connector) that opens an **IAM-authenticated, TLS-encrypted** tunnel to the instance without managing SSL certs or IP allow-lists. Works with Private or Public IP.
- **IAM database authentication** — log in with an IAM identity/service account instead of a DB password.

Preferred production pattern: **Private IP + Auth Proxy/connector + IAM auth**, so there's no public surface, no static passwords, and connections are encrypted and identity-scoped. For serverless (Cloud Run/Functions), use the built-in connectors, which handle this for you.

### Q6. What is AlloyDB and how does it differ from Cloud SQL for PostgreSQL?

**AlloyDB** is a fully managed, **PostgreSQL-compatible** database engineered for higher performance and scale than Cloud SQL Postgres. Key differences:

- **Disaggregated storage** — a distributed, log-based storage layer separate from compute, enabling fast reads, instant recovery, and cheap replicas.
- **Columnar engine** — an in-memory columnar cache that transparently accelerates **analytical** queries, so one database handles **transactional + analytical (HTAP)** workloads. Google cites large speedups vs stock Postgres on analytics.
- **Read scaling** — many read pool instances scaling reads far beyond Cloud SQL.
- **Better price/performance for demanding Postgres** workloads; still PostgreSQL wire-compatible, so most apps and extensions "just work."

Choose AlloyDB over Cloud SQL Postgres when you've **outgrown Cloud SQL's read/analytics throughput** but want to stay on PostgreSQL and don't need Spanner's horizontal write scaling or global consistency. It's single-region-primary (with cross-region replication options), not globally distributed.

### Q7. How is AlloyDB positioned against AWS Aurora?

AlloyDB is Google's direct answer to **Amazon Aurora**: both **disaggregate compute from a distributed storage layer**, offer PostgreSQL compatibility, fast failover, and cheap read replicas via shared storage. Differentiators AlloyDB emphasises:

- The **in-memory columnar engine** for real-time analytics on the same instance (Aurora leans on separate analytics paths / Aurora + Redshift).
- Google-published performance claims (transactional and analytical throughput vs stock Postgres).
- Tight integration with the Google ecosystem (Vertex AI in-database ML, BigQuery federation).

For an interview, the crisp framing: **AlloyDB ≈ Aurora for Postgres on GCP, with an added columnar/HTAP engine**. You'd pick it when migrating a demanding PostgreSQL workload to GCP that needs more than Cloud SQL but doesn't require Spanner's global horizontal scale.

### Q8. What is Cloud Spanner and what makes it unique?

**Cloud Spanner** is a fully managed relational database that is simultaneously **horizontally scalable** (like a NoSQL system) and **strongly consistent with full SQL, schemas, and ACID transactions** (like a traditional RDBMS) — across **regions and continents**. Historically you had to give up one of those; Spanner gives you both.

What makes it possible: **TrueTime**, an API backed by **GPS receivers and atomic clocks** in Google datacenters that bounds clock uncertainty to a small, known interval. Spanner uses TrueTime to assign globally meaningful commit timestamps and provide **external consistency** — the strongest isolation, where transactions appear to execute in real-time order globally. Data is automatically sharded into **splits** distributed across nodes; you scale by adding **nodes/processing units** with no re-architecture. Use it for global, mission-critical OLTP: payments/ledgers, global inventory, financial systems, and any app that would otherwise need painful sharding.

### Q9. What is TrueTime and external consistency, and why do they matter?

**TrueTime** exposes time as an **interval** `[earliest, latest]` rather than a single value, guaranteeing the true time lies within it (uncertainty typically a few milliseconds, kept small by GPS + atomic clocks). Spanner leverages this to order transactions globally.

**External consistency** (a.k.a. linearizability across the whole database) means: if transaction T1 commits before T2 starts in real time, then T1's commit timestamp is earlier, and any observer sees them in that order — **globally, across regions**. Spanner achieves it by, at commit, waiting out the TrueTime uncertainty ("commit wait") so timestamps never overlap ambiguously.

Why it matters: it lets you reason about a globally distributed database as if it were a single machine — no eventual-consistency anomalies, no "read your own write" surprises across regions. That's the guarantee financial and inventory systems need, and it's why Spanner can replace hand-rolled sharded MySQL for global apps.

### Q10. How does Spanner scale, and what are splits and processing units/nodes?

Spanner stores rows sorted by primary key and partitions them into **splits** — contiguous key ranges that are the unit of distribution and replication. As data grows or a range gets hot, Spanner **automatically re-splits** and rebalances splits across the underlying servers. You never manually shard.

Capacity is provisioned as **nodes** or finer-grained **processing units** (1 node = 1000 PUs; you can provision as little as 100 PUs). More nodes/PUs = more CPU, more throughput, and higher storage limits. Compute scales roughly linearly, and each node adds a known throughput budget (Google publishes per-node QPS/storage guidance). Because scaling is horizontal and online, you add capacity without downtime — the opposite of Cloud SQL's "resize the one machine."

The catch: performance depends on splits being **evenly loaded**, which is entirely a function of primary-key design (next question).

### Q11. What is hotspotting in Spanner and how do you design schemas to avoid it?

**Hotspotting**: because rows are ordered by primary key and distributed by key-range splits, a **monotonically increasing key** (timestamp, `AUTO_INCREMENT`-style sequence) sends every new write to the **same last split** on one server — you can't scale past that one machine's throughput regardless of node count.

Avoidance techniques:
- **Don't use sequential/timestamp-leading keys** for high-write tables.
- **Hash or bit-reverse** the leading key component to spread writes across splits.
- Use a **UUID** (v4) or a **hash prefix** as the leading key column.
- **Interleave** child tables in parents to co-locate related rows for locality (`INTERLEAVE IN PARENT`), reducing cross-split joins.
- Avoid low-cardinality leading columns that funnel writes.

Interviewers love asking "you built an events table keyed by insert timestamp and it won't scale past X QPS — why?" The answer is a monotonic-key hotspot; fix it by hashing/reordering the key. This is the single most important Spanner design principle.

### Q12. What are Spanner's multi-region configurations and their tradeoffs?

Spanner offers **regional** and **multi-region** instance configurations:

- **Regional** — replicas across zones in one region; strong consistency, lowest write latency, survives zone failure. Cheapest Spanner option.
- **Multi-region** — replicas across multiple regions (e.g. `nam3`, `eur6`); survives a **region** failure, serves low-latency **reads** near users globally, and still provides **external consistency**. Writes must reach a quorum across regions, so **write latency is higher** (cross-region round trips), and cost is significantly higher.

Multi-region uses a leader region plus read-write and read-only replicas; a **witness** replica participates in quorum without a full data copy. Choose multi-region only when you truly need cross-region availability and global low-latency reads with strong consistency — it's expensive. For a single-region app, regional Spanner (or, more likely, Cloud SQL/AlloyDB) is the right call.

### Q13. How do you choose between Cloud SQL, AlloyDB, and Spanner?

| Need | Choose |
|---|---|
| Standard OLTP, MySQL/Postgres/SQL Server, fits one machine (≤64 TB) | **Cloud SQL** |
| Demanding **PostgreSQL** — high read scale and/or in-DB analytics (HTAP) | **AlloyDB** |
| **Horizontal write scaling** + **strong global consistency**, multi-region OLTP | **Cloud Spanner** |

Decision heuristic: **start at Cloud SQL.** Move to **AlloyDB** when a Postgres workload needs more read throughput or real-time analytics than Cloud SQL can give but you don't need global horizontal writes. Move to **Spanner** only when you have a concrete need for horizontal write scale beyond one primary *and/or* strongly consistent multi-region operation (payments, global inventory). Don't jump to Spanner for "future-proofing" — it costs more, constrains schema/SQL, and demands hotspot-aware key design.

### Q14. How should serverless apps (Cloud Run/Functions) connect to a relational database?

The problem: serverless platforms scale to **many concurrent instances**, each opening database connections. PostgreSQL/MySQL have a **bounded connection limit**, and each Postgres connection is a heavyweight process — a spike can exhaust connections ("too many clients") and starve the DB.

Solutions:
- **Connection pooling** — put a pooler in front (PgBouncer, or AlloyDB/Cloud SQL built-in pooling) so thousands of function instances share a small pool of real DB connections.
- **Cloud SQL / AlloyDB language connectors** — handle IAM-auth, TLS, and pooling from the function.
- **Cap concurrency** — limit max instances and per-instance connections so the math (`instances × conns`) stays under the DB limit.
- **Reuse connections** across invocations (module-scope client) rather than connecting per request.

The senior answer names the connection-exhaustion failure mode explicitly and reaches for a **pooler**, not "just raise max_connections," which trades one bottleneck (connections) for another (memory/CPU on the DB).

### Q15. How is encryption handled, and what does CMEK add?

All three services **encrypt data at rest by default** with Google-managed keys and **encrypt in transit** (TLS). For stronger control:

- **CMEK (customer-managed encryption keys)** — you own the KMS key in **Cloud KMS**; the database uses it to encrypt data. You control rotation, and **disabling/destroying the key renders the data unreadable** — useful for compliance and a hard "kill switch." Supported by Cloud SQL, AlloyDB, and Spanner.
- **CSEK** (customer-supplied) is a Compute-Engine-disk concept, not the managed-DB path — don't confuse them.
- **In transit**: enforce TLS (Cloud SQL SSL modes / Auth Proxy), and use **Private IP** to keep traffic off the public internet.

For an interview: default encryption is automatic; **CMEK** is the answer when the requirement is "we must control/rotate/revoke the encryption keys ourselves" (regulated industries, key-custody policies).

### Q16. What is Database Migration Service and when do you use it?

**Database Migration Service (DMS)** is a managed service for migrating databases into Cloud SQL and AlloyDB with **minimal downtime**. It performs an initial **full dump/load** then switches to **continuous replication (CDC)** from the source, keeping the target in sync until you cut over — so downtime is just the final promotion, not the whole copy.

Use it for:
- **Lift-and-shift** of self-managed MySQL/PostgreSQL (on-prem or another cloud) into Cloud SQL/AlloyDB.
- **Homogeneous** migrations (Postgres→Cloud SQL Postgres) with near-zero downtime via CDC.
- Consolidating databases onto managed infrastructure.

It's serverless and free for like-to-like migrations in many cases. For heterogeneous engine changes (e.g. Oracle→Postgres) you pair it with schema-conversion tooling. The interview point: DMS's value is **continuous replication → tiny cutover window**, versus a naive dump/restore that requires a long maintenance outage.

### Q17. When should you NOT use Cloud Spanner?

Spanner is powerful but frequently **over-chosen**. Avoid it when:

- **Your data fits on one machine and one primary handles the writes.** Cloud SQL/AlloyDB is far cheaper and gives you full standard SQL and extensions. Spanner has a **non-trivial cost floor** (even 100-PU/1-node instances add up, and multi-region multiplies it).
- **You need rich, unconstrained SQL / Postgres extensions.** Spanner's SQL is a subset with schema constraints (interleaving, no arbitrary features); porting a complex Postgres app can be painful.
- **Workload is analytical, not transactional** — use **BigQuery**, not Spanner.
- **Single-region, moderate scale** — the global-consistency machinery is wasted; you pay for capability you don't use.
- **Team lacks hotspot-aware schema discipline** — misused Spanner (monotonic keys) performs *worse* than a well-tuned Cloud SQL instance.

The senior framing: Spanner earns its cost only when you need **horizontal write scaling and/or strong multi-region consistency**. Absent both, it's an expensive way to run a database you could serve on Cloud SQL or AlloyDB.

## NoSQL: Firestore & Bigtable

### Summary

**What this topic covers**

Google Cloud's two flagship NoSQL databases and how to choose between them (and against the relational options). The 18 questions here cover **Firestore** — a serverless document database with Native mode vs Datastore mode, collections/documents, strong consistency, real-time listeners, offline mobile/web SDKs, its query model (every query is index-backed, no ad-hoc joins), composite indexes, transactions, security rules for direct client access, multi-region vs regional, and per-operation pricing — and **Bigtable** — a wide-column, petabyte-scale store for single-key lookups and range scans, the HBase API, the make-or-break **row-key design** and how to avoid hotspots, the absence of secondary indexes and cross-row transactions, SSD vs HDD, nodes and throughput, replication, and where it fits (time-series, IoT, AdTech, analytics serving). Cross-cutting: the Firestore vs Bigtable vs Cloud SQL vs Spanner decision, Memorystore for caching, designing for access patterns, hotspotting pitfalls, and consistency/cost tradeoffs.

**Mental model**

Firestore and Bigtable solve opposite problems, so never treat "NoSQL" as one thing. **Firestore** is a **document database for application state and client apps** — think a JSON tree of collections and documents, with a serverless, pay-per-operation model, **strong consistency**, **real-time sync** to phones/browsers, offline support, and **security rules** so untrusted clients can talk to it directly. It's optimised for **many entities, modest per-entity size, and rich point/query access** — the backend for a mobile app, chat, or a SaaS document store. **Bigtable** is a **wide-column, sparse, sorted map** (`row key → column families → cells`) built for **massive scale and throughput**: petabytes, millions of reads/writes per second, single-digit-millisecond latency, driven almost entirely by a **carefully designed row key**. It has **no secondary indexes, no cross-row transactions, and no SQL** — you get fast lookups and range scans by row key and nothing else. Its home is time-series, IoT telemetry, AdTech, financial ticks, and serving features to analytics/ML. The design axis: Firestore optimises for **developer ergonomics and flexible queries at app scale**; Bigtable optimises for **raw scale and predictable latency at the cost of query flexibility and up-front key design**.

**Key terms**

- **Firestore** — serverless document DB: collections → documents → fields (and subcollections).
- **Native mode vs Datastore mode** — Native adds real-time listeners + offline + mobile SDKs; Datastore mode is the server-centric successor to the old Datastore API.
- **Composite index** — a multi-field index Firestore requires for compound queries; **every query is index-backed**.
- **Real-time listener** — a subscription that pushes document changes to clients live.
- **Security rules** — declarative auth logic letting untrusted clients query Firestore directly and safely.
- **Bigtable** — wide-column NoSQL: `row key → column family:qualifier → timestamped cells`.
- **Row key** — the *only* index; sorted lexicographically; determines locality and hotspots.
- **Column family** — a group of columns stored together; defined up front, tuned for access/GC.
- **Tablet** — a contiguous row-key range Bigtable distributes across nodes (analogous to a Spanner split).
- **Node** — Bigtable compute unit; throughput scales ~linearly with node count (storage is separate).
- **SSD vs HDD** — Bigtable storage tier: SSD for low-latency serving, HDD for cheap high-throughput batch.
- **Memorystore** — managed Redis/Memcached for sub-millisecond caching (not a primary DB).

**Why interviewers ask this**

Datastore choice is a design-interview staple, and NoSQL is where candidates most often pick wrong. Junior signal: "NoSQL scales, so I'll use it for everything," or conflating Firestore and Bigtable as interchangeable. Senior signal: matching the datastore to the **access pattern** — Firestore for app/document workloads that need flexible queries, real-time sync, and direct client access; Bigtable for high-throughput single-key/range workloads (time-series, IoT) where you can design the row key. The deepest tell is **row-key reasoning**: a strong candidate immediately warns that a timestamp-leading Bigtable row key hotspots one node and proposes field-promotion/salting/reversed-timestamp designs. Interviewers also probe whether you know Firestore's query constraints (no joins, every query needs an index, no `!=`/`OR` across fields historically) and its per-operation pricing model — knowing these means you've hit their edges in production, not just read the marketing page.

**Common confusions**

- "Firestore and Bigtable are both 'GCP NoSQL,' so pick either" — opposite tools: document DB for apps vs wide-column store for petabyte-scale throughput.
- "Firestore is eventually consistent" — Firestore in Native mode is **strongly consistent** for document reads and queries (Datastore mode historically had eventual query consistency; Firestore fixed that).
- "I can run any query in Firestore" — no; **every query needs an index**, there are **no joins**, and compound queries need **composite indexes**. You model for your queries up front.
- "Bigtable has secondary indexes" — it doesn't. The **row key is the only index**; you design multiple row-key schemes or duplicate data for other access paths.
- "Bigtable does transactions" — only **single-row** atomic mutations; no cross-row/multi-row ACID transactions.
- "A timestamp row key is fine" — it **hotspots**: sequential keys funnel all writes to one tablet/node, capping throughput. Salt or field-promote the key.
- "Bigtable is cheap to start" — it has a **minimum node cost** and isn't serverless; low-traffic apps overpay vs Firestore.

**What follows from this topic**

This is the NoSQL half of the "which datastore" decision whose relational half is the **Cloud SQL/AlloyDB/Spanner** topic; the cross-service comparison question spans both. Firestore connects to **serverless/mobile** (direct client access via security rules, offline sync) and to **IAM** (rules + IAM). Bigtable connects to **analytics/ML** (serving features, time-series) and to **Dataflow/Dataproc** for ingestion, and its HBase API ties to the broader Hadoop ecosystem. **Memorystore** links to the caching/performance topics. And the row-key hotspot theme rhymes with Spanner's monotonic-key hotspot from the relational topic — the same physics of sorted, sharded keys.

### Q1. What is Firestore and what is its data model?

**Firestore** is Google's fully managed, **serverless document database**. Data is a hierarchy of **collections → documents → fields**:

- A **document** is a JSON-like record (map of fields; supports nested maps, arrays, references, geopoints, timestamps), capped at **1 MiB**.
- Documents live in **collections**; a document can contain **subcollections**, forming a tree.
- There are **no schemas** enforced — documents in a collection can differ — and **no server-side joins**.

You address data by path (`users/alice/orders/order123`) and query within a collection (or across same-named collections via **collection group** queries). It's **serverless** — no capacity to provision; you pay per operation and per GB stored — and it scales automatically. Its differentiators are **strong consistency**, **real-time listeners**, **offline SDKs**, and **security rules** that make it safe for untrusted clients (mobile/web) to query directly.

### Q2. What's the difference between Firestore Native mode and Datastore mode?

Both are the same underlying system exposed two ways; you pick **one per database**:

| | Native mode | Datastore mode |
|---|---|---|
| Real-time listeners | Yes | No |
| Offline / mobile & web SDKs | Yes | No |
| API style | Document/collection | Entity/kind (Datastore API) |
| Best for | Mobile/web apps, client-direct | Server backends migrating from Datastore |
| Query consistency | Strong | Strong (Firestore engine) |

**Native mode** is the default for new apps — it adds real-time sync, offline persistence, and the mobile/web SDKs, and is what most greenfield projects want. **Datastore mode** is for server-side workloads and existing App Engine Datastore apps; it keeps the Datastore API but runs on the modern Firestore storage engine (gaining strong consistency over the legacy Datastore). Rule of thumb: **new app or any client-facing app → Native mode.**

### Q3. Is Firestore strongly or eventually consistent?

Firestore in **Native mode is strongly consistent**: a document read returns the latest committed value, and **queries are strongly consistent** too (they reflect all prior writes). This is a deliberate improvement over the **legacy Cloud Datastore**, whose non-ancestor queries were **eventually consistent** (a source of classic "I wrote it but the list query doesn't show it yet" bugs). Firestore's index and storage design gives strong consistency without you choosing a consistency level.

Practical implications: you get **read-your-writes** semantics, transactions are ACID, and real-time listeners deliver a consistent view. The one nuance interviewers may probe: multi-region Firestore replicates synchronously enough to keep strong consistency, at some write-latency cost versus a single region. But you don't tune consistency knobs the way you would in an eventually-consistent store like Cassandra/DynamoDB (eventual).

### Q4. How do real-time listeners and offline support work in Firestore?

**Real-time listeners** let a client **subscribe** to a document or query; Firestore pushes an update whenever matching data changes, so UIs update live without polling:

```javascript
db.collection('rooms/general/messages')
  .orderBy('createdAt')
  .onSnapshot(snap => render(snap.docs)); // fires on every change
```

**Offline support** (mobile/web SDKs): the SDK keeps a **local cache**, serves reads from it when offline, and **queues writes** to sync when connectivity returns — with the same listeners firing against local data. This makes Firestore excellent for chat, collaborative apps, and mobile apps on flaky networks.

These features are **Native-mode only** and are a big reason to pick Firestore over a relational DB for client-facing apps: you get live sync and offline for free instead of building a websocket/sync layer yourself. The cost side: every listener update and read is a **billed operation**, so a chatty listener on a hot collection can get expensive.

### Q5. Explain Firestore's query model and why every query needs an index.

Firestore queries run **only against indexes** — there are **no table scans**. Two index types:

- **Single-field indexes** — created automatically for every field; power simple equality/range/order queries.
- **Composite indexes** — required for queries that **filter/order on multiple fields**; you must define them (the SDK/console gives you the exact index to create when a query fails).

Consequences and constraints:
- **No joins** — you denormalise or do multiple lookups client-side.
- Compound queries need a matching composite index or they **error** (with a link to create it).
- Historically limited `OR`/`!=`/`array-contains` semantics (improved over time, but still index-bound).
- Query cost and latency scale with the **result set size, not the collection size** — indexes make it fast regardless of total documents.

The upside of "every query is indexed": queries are **fast and predictable at any scale**. The discipline it imposes: you **model for your queries up front** and maintain composite indexes as query patterns grow.

### Q6. How do transactions and batched writes work in Firestore?

Firestore supports **ACID transactions** across multiple documents (even in different collections), with optimistic concurrency:

- A **transaction** reads documents, computes new values, and commits atomically; if a read document changed underneath it, Firestore **retries** the transaction. Good for read-modify-write (e.g. decrement inventory).
- **Batched writes** apply up to 500 writes atomically without reads — all succeed or all fail.

```javascript
await db.runTransaction(async tx => {
  const ref = db.doc('items/widget');
  const snap = await tx.get(ref);
  const left = snap.get('stock') - 1;
  if (left < 0) throw new Error('out of stock');
  tx.update(ref, { stock: left });
});
```

Limits to know: transactions/batches historically cap at **500 documents**, and a transaction's reads must precede its writes. Because there are no joins, transactions are how you keep **denormalised copies** consistent. Contrast with Bigtable, which only offers **single-row** atomicity — no multi-row transactions at all.

### Q7. What are Firestore security rules and why are they important?

**Security rules** are a declarative language that governs **who can read/write which documents**, evaluated on Google's servers on every request. They're what make it safe for **untrusted clients (mobile/web) to query Firestore directly** — no backend API tier required:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/orders/{order} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }
  }
}
```

Rules can check authentication (`request.auth`), document contents, and even other documents. This is a **major architectural difference** from relational DBs: with Firestore + Firebase Auth + rules, a mobile app talks straight to the database with per-document authorisation, eliminating a whole CRUD backend. The failure mode interviewers probe: **default-open or overly broad rules** (`allow read, write: if true`) expose the entire database publicly — a common real-world breach. Rules are security-critical and must be tested.

### Q8. Regional vs multi-region Firestore — how do you choose?

Firestore location is chosen at **database creation and is immutable**:

- **Regional** — data in one region. **Lower write latency and lower cost**; survives zone failures but not a full region outage.
- **Multi-region** — data replicated across regions (e.g. `nam5`, `eur3`). **Higher availability** (survives a region failure) and stronger durability, at **higher cost and slightly higher write latency**.

Choose **multi-region** for apps where availability/durability is paramount (you can't tolerate a regional outage) and you serve a broad user base. Choose **regional** when cost/latency matters, your users are concentrated, or data-residency requires a specific region. Because it's **immutable**, this is a decision you make deliberately up front — migrating later means exporting/importing to a new database.

### Q9. How is Firestore priced, and what's the cost gotcha?

Firestore is **pay-per-use** with no provisioned capacity:

- **Document operations** — you pay per **read, write, and delete**.
- **Storage** — per GB-month.
- **Network egress** and, for multi-region, replication.

The gotcha: **cost scales with operation count**, and it's easy to explode. A query returning 1,000 documents bills **1,000 reads**. A real-time listener re-reads changed documents (billed). Fan-out patterns (write to many documents on each event) multiply writes. A poorly designed "load everything" screen can rack up huge read counts.

Design implications:
- **Denormalise/aggregate** so a screen reads few documents, not thousands.
- Use **counters/aggregation documents** instead of counting via reads.
- Be careful with **broad listeners** on hot collections.

This is the opposite of Bigtable/Cloud SQL where you pay for **provisioned capacity**; Firestore's model rewards access-pattern-aware modelling and punishes naive "SELECT *" thinking.

### Q10. What is Bigtable and what is its data model?

**Cloud Bigtable** is a fully managed, **wide-column NoSQL** database for **massive** analytical and operational workloads — **petabytes** of data, **millions of ops/sec**, single-digit-millisecond latency. Its data model is a **sparse, distributed, sorted multi-dimensional map**:

```text
row key → column family → column qualifier → timestamped cell value
```

- Rows are identified by a single **row key** and **sorted lexicographically** by it.
- Columns are grouped into **column families** (defined up front); within a family, **column qualifiers** are dynamic and sparse (a row only stores the cells it has).
- Each cell can keep **multiple timestamped versions**.

It's the same design as the internal Bigtable that inspired **HBase** and Cassandra, and it exposes the **HBase API**. There's **no SQL, no joins, no secondary indexes** — you access data by **row key lookup or row-key range scan**, which is why row-key design is everything.

### Q11. Why is row-key design the most important decision in Bigtable?

Because the **row key is the only index** and rows are stored **sorted by key**, the row key determines both **how you can query** (point lookup or contiguous range scan) and **how load distributes** across nodes. Get it right and Bigtable is blisteringly fast and scalable; get it wrong and you hotspot one node or can't serve your queries at all.

Principles:
- **Design the key for your read pattern** — put the fields you filter/scan on into the key, in the order you'll query, so common queries become **range scans** (e.g. `deviceId#reverseTimestamp` to scan a device's recent readings).
- **Ensure even write distribution** — avoid monotonic prefixes (raw timestamps, sequential IDs) that funnel writes to one tablet.
- **Field promotion** — move high-cardinality identifying fields to the **front** of the key.
- **Keep keys reasonably short** (they're stored with every cell).

There are no secondary indexes to bail you out, so if you need a second access path you design a **second table / second row-key scheme** or duplicate data. This up-front modelling is the price of Bigtable's scale.

### Q12. What is hotspotting in Bigtable and how do you avoid it?

**Hotspotting**: because rows are sorted by key and split into **tablets** served by nodes, a **sequential/monotonic row key** (timestamp-leading, incrementing counter) sends all new writes to the **same tablet/node**, so throughput is capped by one node no matter how many you provision — and that node's latency spikes.

Avoidance techniques:
- **Field promotion** — lead with a high-cardinality field (e.g. `userId`, `deviceId`) before any timestamp.
- **Salting** — prefix the key with a hash bucket (`hash(id) % N`) to spread writes across N ranges (trade: scans must fan out across buckets).
- **Reversed timestamps** — use `Long.MAX - timestamp` so newest sorts first for efficient "recent" scans, but still front the key with an identifier to distribute.
- **Avoid** raw timestamps or sequential IDs as the leading component.

The classic interview question: "you store IoT readings keyed by `timestamp` and writes bottleneck — why?" Monotonic-key hotspot; fix with `deviceId#reversedTimestamp`. Google's **Key Visualizer** heatmap tool helps you *see* hotspots. This mirrors Spanner's monotonic-key problem — same sorted-shard physics.

### Q13. What are Bigtable's key limitations (indexes, transactions, SQL)?

Bigtable trades flexibility for scale. Limitations to state plainly:

- **No secondary indexes** — the row key is the only index; other access paths require separate tables or data duplication.
- **No cross-row / multi-row transactions** — only **single-row** mutations are atomic. No ACID across rows.
- **No SQL, no joins** — access is programmatic (get by key, scan by range) via the HBase or Cloud Bigtable API.
- **No server-side aggregations** (beyond limited operations) — you aggregate in your app or a processing layer (Dataflow).
- **Minimum cost** — you provision **nodes**; it isn't serverless and has a floor, so it's overkill for small datasets.
- **Schema rigidity around column families** — families are defined up front.

These are exactly why Bigtable is **not** an app database. If you need queries by many fields, transactions, or SQL, use Firestore or a relational DB. Bigtable is for **known-access-pattern, high-throughput** workloads.

### Q14. SSD vs HDD, nodes, and replication in Bigtable — what should you know?

**Storage type** (chosen at cluster creation, immutable):
- **SSD** — low-latency, high-throughput; the default for **serving** and latency-sensitive workloads.
- **HDD** — cheaper, higher-latency; for **large, cold, throughput-oriented batch/archival** data you scan rather than random-read.

**Nodes**: Bigtable separates **compute (nodes) from storage**. You add **nodes** to increase throughput (reads/writes per second) and the system rebalances tablets across them; throughput scales roughly **linearly** with node count. Storage grows independently.

**Replication**: add clusters (in other zones/regions) to the same instance for **high availability, higher aggregate throughput, and read locality**. Replication is **eventually consistent** by default; you can route reads to a specific cluster (via **app profiles**) and use single-cluster routing for read-your-writes. This enables active-active serving and HA. Interview point: you scale Bigtable by **adding nodes** (throughput) and **clusters** (availability/locality), not by resizing a single machine.

### Q15. When does Bigtable fit? Give canonical use cases.

Bigtable fits **high-throughput workloads with a known key-based access pattern** and huge data volumes:

- **Time-series & IoT** — sensor/device telemetry keyed by `deviceId#reversedTimestamp`, scanned by device and time range.
- **AdTech / MarTech** — user profiles, real-time bidding, clickstream at millions of ops/sec.
- **Financial data** — market ticks, transaction histories, fraud-feature serving.
- **Monitoring/metrics** — storing and range-scanning metric streams (it backs Google's own monitoring).
- **Analytics/ML feature serving** — low-latency lookup of precomputed features by entity key.
- **Graph/personalisation** at scale where access is by key.

Common thread: **massive scale, predictable single-key or range access, low-latency at high QPS, no need for joins/secondary indexes/transactions**. If your workload is a mobile app's state, flexible querying, or modest data — that's Firestore or Cloud SQL, not Bigtable.

### Q16. How do you choose between Firestore, Bigtable, Cloud SQL, and Spanner?

| Need | Choose |
|---|---|
| App/document store, mobile/web, real-time sync, flexible-ish queries, direct client access | **Firestore** |
| Petabyte-scale, high-throughput, single-key/range access (time-series, IoT, AdTech) | **Bigtable** |
| Standard relational OLTP, SQL, joins, transactions, fits one machine | **Cloud SQL** |
| Global, horizontally scalable, strongly consistent relational OLTP | **Cloud Spanner** |

Heuristics:
- **Need SQL/joins/transactions?** → relational (Cloud SQL, or Spanner for global horizontal scale). Not Bigtable/Firestore.
- **Client-facing app, real-time, offline, per-document auth?** → **Firestore**.
- **Huge throughput, key-based access, no joins?** → **Bigtable**.
- **Global writes + strong consistency + relational?** → **Spanner**.

The senior move is to drive from the **access pattern and consistency/scale needs**, not from "NoSQL vs SQL" as a religion. Say what queries you must serve, at what scale and latency, with what consistency — the datastore falls out of that.

### Q17. Where does Memorystore fit, and what about MongoDB compatibility?

**Memorystore** is Google's **managed Redis and Memcached** — an **in-memory cache**, not a primary datastore. Use it for **sub-millisecond** caching in front of Cloud SQL/Spanner/Firestore/Bigtable, session storage, rate limiting, leaderboards, and pub/sub-style ephemeral data. It's the standard answer to "how do I cache DB reads / offload a hot key / share session state across serverless instances." It's volatile (with optional persistence/HA tiers) — you don't use it as the system of record.

**MongoDB compatibility**: Google offers **Firestore in MongoDB-compatible mode** (and there are marketplace/partner options like MongoDB Atlas on GCP) so teams with MongoDB apps/drivers can run on managed GCP infrastructure. For an interview, the crisp points: **Memorystore = managed Redis/Memcached cache** (pair it with any of the databases above), and if a workload demands the MongoDB API specifically, there's a **Firestore MongoDB-compatible** path or Atlas on GCP rather than forcing a rewrite.

### Q18. Design the datastore for a global IoT platform ingesting millions of sensor readings per second, plus a customer-facing dashboard app. What do you use and why?

Split by **access pattern** — no single database is right for both halves:

**Ingestion + time-series storage → Bigtable.**
- Millions of writes/sec with low latency is exactly Bigtable's sweet spot.
- Row key: `deviceId#reversedTimestamp` (field-promote the device to distribute writes and avoid a timestamp hotspot; reversed timestamp so recent readings scan first). Salt further if a few devices are extremely hot.
- SSD storage for serving recent data; optionally a second HDD cluster or export to **BigQuery** for historical analytics.
- Replicate across regions for HA and read locality.

**Customer dashboard / app state → Firestore.**
- Device metadata, user accounts, alert configs, and the app UI benefit from Firestore's **real-time listeners** (live dashboard updates), **offline** mobile support, and **security rules** for direct client access.
- Strongly consistent, serverless, pay-per-operation — fine for the lower-volume app-state workload.

**Supporting pieces:** **Pub/Sub** to buffer the firehose, **Dataflow** to process/aggregate before writing to Bigtable/BigQuery, **Memorystore** to cache hot dashboard queries, and **BigQuery** for ad-hoc analytics over history. The interview payoff is showing you **route each workload to the store built for it** — Bigtable for high-throughput key/range telemetry, Firestore for the interactive app — rather than forcing one database to do both jobs badly.
## Data & Analytics: BigQuery

### Summary

**What this topic covers**

GCP's analytics crown jewel and the services that feed it. BigQuery is a **serverless, columnar, petabyte-scale data warehouse** where storage and compute are fully decoupled — you don't provision or manage clusters, you run SQL and Google runs it across thousands of machines. This topic covers three concern areas: (1) **the engine** — how BigQuery works under the hood (Dremel query engine, Colossus distributed storage, Jupiter network, Borg), and why "serverless" changes the cost and scaling story; (2) **cost & performance control** — the two pricing models (on-demand per-TB-scanned vs capacity/slots), and the levers that actually move the bill (partitioning, clustering, avoiding `SELECT *`, dry-runs, custom quotas, BI Engine); and (3) **the surrounding data platform** — ingestion (batch loads, streaming inserts, the Storage Write API), external/federated data (BigLake, Cloud Storage), materialized views, scheduled queries, BigQuery ML, nested/repeated fields, and the ETL/streaming services (Dataflow, Dataproc, Pub/Sub) that surround it. The 17 questions run from "what is BigQuery" to "design a streaming analytics pipeline" and "spot the query that will cost $4,000."

**Mental model**

Think of BigQuery as **"SQL over object storage with a giant elastic query engine bolted on."** Your table data lives as compressed columnar files in Colossus (Google's distributed filesystem), completely separate from the compute that queries it. When you run a query, Dremel shatters it into a tree of thousands of parallel workers ("slots") that each scan a slice of the relevant columns, and the Jupiter network shuffles intermediate results between them. Two consequences fall out of this: first, **you pay for columns scanned, not rows returned** — `SELECT one_col` from a billion-row table is cheap, `SELECT *` is expensive; second, **there is no index to tune** — you shape cost and speed by pruning what gets scanned (partitions and clusters), not by building B-trees. The other mental shift: BigQuery is an **OLAP / analytics** engine, not a database. It is built for scanning huge datasets in seconds, not for single-row lookups or high-frequency updates. If your access pattern is "fetch user 12345 by primary key in 5ms," BigQuery is the wrong tool — reach for Cloud SQL, Spanner, or Bigtable instead.

**Key terms**

- **Slot** — a unit of BigQuery compute (a virtual CPU); queries consume slots in parallel. On-demand gives you a large shared pool; capacity pricing lets you reserve them.
- **On-demand pricing** — pay per TB of data *scanned* (~$6.25/TB), no commitment; a 1 MB result from a full-table scan still bills the whole scan.
- **Capacity / Editions pricing** — buy slots (Standard / Enterprise / Enterprise Plus editions) with autoscaling and reservations; predictable spend for heavy workloads.
- **Partitioning** — physically splitting a table by a column (date/timestamp, ingestion time, or integer range) so queries with a filter scan only relevant partitions.
- **Clustering** — sorting data within partitions by up to 4 columns so BigQuery can skip blocks; complements partitioning, reduces scanned bytes on filtered/aggregated queries.
- **Streaming inserts / Storage Write API** — row-by-row real-time ingestion; the Storage Write API is the newer, cheaper, higher-throughput unified stream+batch write path.
- **External / federated table (BigLake)** — query data that lives outside BigQuery-managed storage (Cloud Storage, Bigtable, Sheets) without loading it; BigLake adds fine-grained security over object storage.
- **Materialized view** — a precomputed, incrementally-refreshed result BigQuery can transparently substitute into queries to cut cost.
- **Nested & repeated fields** — arrays (`REPEATED`) and structs (`RECORD`) let you model one-to-many relationships in a single denormalized row instead of joining.
- **Dataflow** — managed Apache Beam; unified batch + stream ETL. **Dataproc** — managed Spark/Hadoop for lift-and-shift or Spark-native workloads.
- **BI Engine** — in-memory acceleration layer for sub-second dashboard queries (Looker Studio, Looker).

**Why interviewers ask this**

BigQuery is where GCP most differs from a "run a database on a VM" mental model, so it's a strong discriminator. Junior candidates describe it as "Google's data warehouse" and stop. Senior candidates explain the **storage/compute separation** and immediately connect it to cost control — "you're billed on bytes scanned, so I'd partition by event_date and cluster by customer_id, and never `SELECT *` in production." The best signal is **cost awareness**: an engineer who has been paged over a $10k accidental full-scan will reflexively mention dry-runs, `--maximum_bytes_billed`, partition-required tables, and custom quotas. Interviewers also probe the **"wrong tool" boundary** — knowing that BigQuery is not for OLTP or low-latency point lookups is a maturity marker. Finally, streaming design (Pub/Sub → Dataflow → BigQuery) tests whether you can assemble the whole platform, not just one box.

**Common confusions**

- "BigQuery is a database" — it's an analytics warehouse. No enforced primary keys/indexes (they're advisory/unenforced), no low-latency point lookups, DML is throttled — not an OLTP store.
- "Partitioning and clustering are the same" — partitioning physically segments into separately-prunable chunks (great for a single date/range column); clustering sorts within partitions (great for high-cardinality filter columns). Use both together.
- "Streaming inserts and the Storage Write API are interchangeable" — the Storage Write API is the modern, cheaper, exactly-once-capable path; legacy `tabledata.insertAll` streaming is being superseded.
- "On-demand is always cheaper" — for steady heavy workloads, reserved slots (capacity pricing) are far cheaper and give predictable spend; on-demand shines for spiky/low volume.
- "`SELECT *` is fine, I'll just filter in the app" — you're billed for every column scanned regardless of what you return; column pruning is the single biggest cost lever.
- "Dataflow and Dataproc are the same" — Dataflow is serverless Apache Beam (no cluster to manage, great for streaming); Dataproc is managed Spark/Hadoop (you size a cluster, ideal for existing Spark jobs).

**What follows from this topic**

BigQuery is the sink for most GCP data pipelines, so it connects outward everywhere. The streaming ingestion story (**Pub/Sub → Dataflow → BigQuery**) links straight to the Messaging & Streaming topic. Its IAM/dataset/authorized-view model builds on the Identity & Security topic's members-and-roles foundation. The "wrong tool" boundary points at the Databases topic (Cloud SQL, Spanner, Bigtable, Firestore) — knowing when to reach for an OLTP or NoSQL store instead is the flip side of knowing BigQuery. And BI Engine / Looker connect analytics to the presentation layer.

### Q1. What is BigQuery and how does its architecture differ from a traditional data warehouse?

BigQuery is GCP's **serverless, fully-managed, columnar data warehouse** for petabyte-scale analytics. The defining architectural choice is **separation of storage and compute**:

- **Storage** — your tables live as compressed, columnar files (Capacitor format) in **Colossus**, Google's distributed filesystem, replicated across a region. You never provision or manage it.
- **Compute** — queries run on **Dremel**, a massively parallel query engine that fans a query out into a tree of thousands of workers ("slots") across Google's **Borg**-managed fleet.
- **Network** — the **Jupiter** petabit network shuffles intermediate data between compute nodes fast enough that storage and compute can live apart.

In a traditional warehouse (or a self-managed cluster) storage and compute are coupled on the same nodes, so scaling compute means resizing the cluster and rebalancing data. In BigQuery you just submit SQL — Google elastically allocates compute per query and bills you for bytes scanned (on-demand) or reserved slots (capacity). No clusters, no vacuuming, no index tuning. AWS analogue: BigQuery ≈ Redshift Serverless / Athena, but more deeply serverless than either.

### Q2. Explain BigQuery's two pricing models and when you'd choose each.

| | On-demand | Capacity (Editions) |
|---|---|---|
| Bills on | TB scanned (~$6.25/TB) | Slots (compute) over time |
| Commitment | None | Optional 1-yr/3-yr; or autoscaling |
| Predictability | Variable — spiky bill | Predictable spend |
| Best for | Spiky, low/medium volume, ad-hoc | Steady heavy workloads, many concurrent users |

**On-demand** — you pay purely for bytes scanned per query, with a large shared slot pool. Zero management, great for bursty or exploratory work. Risk: a careless `SELECT *` on a huge table is an instant large bill.

**Capacity pricing** — you buy **slots** via Editions (**Standard / Enterprise / Enterprise Plus**), with **autoscaling slots** and **reservations** to carve capacity between teams/workloads. Enterprise/Enterprise Plus add features like column-level security, materialized view refresh, and multi-region reliability. Cheaper and predictable once you have sustained volume.

Rule of thumb: start on-demand; once monthly on-demand spend is consistently high or you need concurrency guarantees, switch to capacity with autoscaling and set a baseline + max slots. You can mix — reserve slots for production dashboards, leave ad-hoc analysts on-demand.

### Q3. How do partitioning and clustering reduce cost, and how do they differ?

Both prune the bytes a query scans, but at different granularities.

**Partitioning** physically splits a table into segments by a single column — a **date/timestamp**, **ingestion time** (`_PARTITIONTIME`), or an **integer range**. A query with a filter on the partition column scans only matching partitions.

```sql
-- Table partitioned by event_date. This scans ONE day, not the whole table.
SELECT user_id, COUNT(*)
FROM `my-project.analytics.events`
WHERE event_date = '2026-07-01'
GROUP BY user_id;
```

**Clustering** sorts data *within* each partition by up to **4 columns**. BigQuery stores block-level metadata so it can skip blocks that can't match a filter — ideal for **high-cardinality** columns like `customer_id`.

Use them together: partition by the low-cardinality time dimension you always filter on, cluster by the high-cardinality columns you filter/aggregate on. You can also set the table to **require a partition filter** so no one can accidentally scan everything. Clustering is free; partitioning is free — the savings come from scanning less.

### Q4. What levers do you have to control BigQuery cost?

In rough order of impact:

- **Never `SELECT *`** — you're billed per column scanned. Select only needed columns.
- **Partition + cluster** tables and filter on those columns so queries prune data.
- **Set `--maximum_bytes_billed`** (per-query) or **custom quotas** (per-user/project daily) so a runaway query fails instead of costing thousands.
- **Dry-run** every new query to see bytes scanned before running it:

```bash
bq query --dry_run --use_legacy_sql=false \
  'SELECT col_a FROM `my-project.ds.big_table` WHERE event_date = "2026-07-01"'
# → "Query successfully validated. Would process 4.2 GB"
```

- **Materialized views** and **scheduled queries** to precompute expensive aggregations once instead of on every dashboard load.
- **BI Engine** to serve dashboards from in-memory cache (sub-second, avoids re-scanning).
- **Capacity pricing** (reserved slots) for steady heavy workloads instead of per-TB on-demand.
- **Table expiration / partition expiration** to auto-delete old data and its storage cost.
- Leverage **query result caching** (free, automatic for identical queries within 24h).

### Q5. Compare streaming inserts, batch loads, and the Storage Write API.

Three ways to get data into BigQuery:

**Batch loads** — load files (CSV, JSON, Avro, Parquet, ORC) from Cloud Storage or locally via `bq load`. **Free** (no per-load charge, just storage), high throughput, but not real-time — data appears after the load job finishes. Default choice for periodic ETL.

**Legacy streaming inserts** (`tabledata.insertAll`) — row-by-row real-time ingestion. Data is queryable within seconds. Costs per row (~$0.05/GB streamed), at-least-once by default, and has a streaming buffer. Being superseded.

**Storage Write API** — the modern unified write path for both streaming and batch. Higher throughput, lower cost than legacy streaming, and supports **exactly-once** delivery via stream offsets, plus **pending mode** for atomic batch commits. This is the recommended API for new real-time pipelines.

Guidance: use **batch loads** for scheduled bulk ingestion (cheapest), and the **Storage Write API** for real-time. Only fall back to legacy streaming for compatibility. In a Pub/Sub → Dataflow → BigQuery pipeline, Dataflow's BigQueryIO uses the Storage Write API under the hood.

### Q6. What are federated queries and external tables (including BigLake)?

An **external table** points BigQuery at data that lives *outside* BigQuery-managed storage — most commonly files in **Cloud Storage** (Parquet, CSV, Avro), but also Bigtable or Google Sheets. You query it with SQL without loading/copying it first. A **federated query** goes further, letting BigQuery reach into external databases (e.g. Cloud SQL, Spanner) live via connections.

Tradeoff: no ingestion step and always-fresh data, but queries are slower (no columnar optimization, no clustering) and you pay for the scan each time.

**BigLake** is the evolution: BigLake tables put a governance and performance layer over object-storage data — **fine-grained security** (row/column-level, IAM) applied to Cloud Storage files, plus metadata caching for speed. It unifies data warehouse (BigQuery-managed) and data lake (Cloud Storage) under one security and access model, so analysts query lake data with the same controls as native tables. Use external/BigLake tables when data must stay in Cloud Storage (shared with Spark/Dataproc, or too large to load); use native tables when you want best query performance and cost.

### Q7. What are materialized views and scheduled queries, and when do you use each?

**Materialized views** are precomputed query results that BigQuery **stores and incrementally refreshes** as the base table changes. Crucially, BigQuery's optimizer can **automatically rewrite** a query to read from a materialized view even if the query targets the base table — so you get the speedup transparently. Use them for expensive aggregations queried repeatedly (e.g. daily rollups feeding a dashboard). Limitations: restricted SQL (aggregations, no arbitrary joins historically), and they cost storage + refresh compute.

**Scheduled queries** run a SQL statement on a cron-like schedule and write results to a destination table. They're a lightweight, managed alternative to standing up Dataflow/Composer for simple transforms — e.g. "every hour, aggregate raw events into a summary table." No automatic query rewrite; you point consumers at the output table.

Rule of thumb: **materialized view** when you want transparent acceleration of the *same* base table with fresh incremental data; **scheduled query** when you want a periodic ETL/transform step producing a new table on a fixed cadence.

### Q8. What is BigQuery ML and what problems does it solve?

BigQuery ML (**BQML**) lets you **train and run machine-learning models using plain SQL**, directly on data already in BigQuery — no exporting to a separate ML platform.

```sql
CREATE OR REPLACE MODEL `my-project.ds.churn_model`
OPTIONS(model_type='LOGISTIC_REG', input_label_cols=['churned']) AS
SELECT tenure_months, monthly_spend, support_tickets, churned
FROM `my-project.ds.customers`;

SELECT * FROM ML.PREDICT(MODEL `my-project.ds.churn_model`,
  (SELECT * FROM `my-project.ds.new_customers`));
```

It supports linear/logistic regression, k-means clustering, matrix factorization (recommendations), time-series forecasting (ARIMA_PLUS), boosted trees (XGBoost), deep neural nets, and can import TensorFlow models or call remote Vertex AI / Gemini models.

The value proposition: **data gravity**. Moving terabytes to an external ML system is slow and costly; BQML trains in place, so data analysts who know SQL can build models without a data-engineering handoff. It's not a replacement for full Vertex AI custom training on huge deep-learning workloads, but for tabular models on warehouse data it removes enormous friction.

### Q9. How do nested and repeated fields work, and why use them?

BigQuery natively supports **structs** (`RECORD`) and **arrays** (`REPEATED` mode), letting you model one-to-many relationships **inside a single row** instead of normalizing into separate tables and joining.

```sql
-- One order row contains an array of line-item structs
SELECT order_id, item.sku, item.qty
FROM `my-project.ds.orders`,
UNNEST(line_items) AS item
WHERE order_date = '2026-07-01';
```

Why it matters: in a columnar warehouse, **joins are expensive and denormalization is cheap** (storage is cheap, columns are compressed). Embedding line items as a repeated struct means an order and its items are colocated, read together, and never require a shuffle-heavy join. You query them by `UNNEST`-ing the array to "flatten" it back into rows.

This is the opposite instinct from OLTP normalization. In an OLTP database you'd split orders and order_items to avoid update anomalies; in BigQuery you nest them for query performance. It's a common interview trap — candidates who reflexively normalize in BigQuery signal they're applying OLTP thinking to an OLAP system.

### Q10. How does access control work in BigQuery — datasets, IAM, authorized views, and column/row-level security?

BigQuery security operates at several layers:

- **IAM at project/dataset/table level** — grant predefined roles (`bigquery.dataViewer`, `bigquery.dataEditor`, `bigquery.jobUser` to run queries). Datasets are the primary access-control container; you grant roles on a dataset to control who sees its tables.
- **Authorized views** — a view in dataset A can be granted access to query tables in dataset B *without* the view's users getting direct access to B. This is the classic pattern for exposing a filtered/aggregated slice of sensitive data: analysts query the view, never the raw table.
- **Column-level security** — attach **policy tags** (from Data Catalog / Dataplex) to sensitive columns (e.g. `ssn`, `email`); only principals with the tag's Fine-Grained Reader role see those columns, others get an error or masked values.
- **Row-level security** — `CREATE ROW ACCESS POLICY` filters which rows a principal can see (e.g. a regional analyst sees only `region = 'EU'` rows).

Layer them: dataset IAM for coarse access, authorized views for cross-dataset exposure, and column/row-level security for fine-grained masking on shared tables. This builds directly on the org → folder → project → resource IAM inheritance model.

### Q11. What are slots and how do they affect query concurrency?

A **slot** is BigQuery's unit of compute — effectively a virtual CPU that executes one unit of a query's work. A single query is decomposed into stages, each parallelized across many slots.

- **On-demand** gives you access to a large **shared** slot pool (with a soft per-project cap, historically ~2,000). Google schedules your query's slots dynamically; under heavy shared contention a query may get fewer slots and run slower.
- **Capacity pricing** lets you **reserve** a fixed number of slots (with autoscaling), guaranteeing capacity and isolating workloads. You create **reservations** and assign projects/folders to them, so production dashboards don't starve when analysts run heavy ad-hoc queries.

Concurrency impact: slots are shared *fairly* across concurrently-running queries. If 10 queries run at once against a 1,000-slot reservation, they split the slots — each gets fewer, so throughput per query drops. This is why heavy multi-tenant environments buy reservations and split them per team, and why you offload dashboard serving to **BI Engine** (in-memory, doesn't consume the main slot pool). Idle slots are automatically shared to other queries in the same reservation, so utilization stays high.

### Q12. When is BigQuery the *wrong* tool?

BigQuery is an OLAP scan engine; it's wrong whenever your workload is transactional or latency-sensitive:

- **OLTP / high-frequency writes & updates** — BigQuery DML is throttled and not built for many small concurrent transactions. Use **Cloud SQL** or **Spanner**.
- **Low-latency point lookups** — "get row by key in single-digit ms." BigQuery has query startup overhead and no point-lookup index; even a tiny result requires spinning up a query. Use **Bigtable** (wide-column, ms lookups) or **Firestore/Cloud SQL**.
- **Serving layer for an app** — user-facing reads at high QPS should hit a serving database, not BigQuery. Precompute in BigQuery, then export aggregates to a serving store (Bigtable, Memorystore, Firestore).
- **Small data with frequent tiny queries** — the per-query overhead and per-TB minimums make it uneconomical vs a small managed database.
- **Strong transactional consistency across rows** — that's Spanner's job.

The senior framing: BigQuery is the **analytics/warehouse** tier. Pair it with an OLTP store (Cloud SQL/Spanner) for transactions and a serving store (Bigtable/Memorystore) for hot reads — the classic pattern is OLTP → CDC/stream → BigQuery for analytics, and BigQuery → export → serving store for low-latency reads.

### Q13. Compare Dataflow and Dataproc — when would you choose each?

| | Dataflow | Dataproc |
|---|---|---|
| Engine | Apache Beam (Google-hosted) | Spark / Hadoop / Presto / Flink |
| Model | Serverless, autoscaling | Managed cluster you size |
| Batch + stream | Unified (one Beam pipeline for both) | Batch-focused (Spark Streaming possible) |
| Best for | New pipelines, streaming ETL, no ops | Lift-and-shift existing Spark/Hadoop jobs |
| Cost model | Per-job autoscaled workers | Per-cluster (can use Spot, ephemeral clusters) |

**Dataflow** is fully serverless Apache Beam. You write one pipeline and run it in **batch or streaming** mode; Google autoscales workers, handles windowing/watermarks for out-of-order streaming data, and there's no cluster to manage. Choose it for greenfield ETL and especially real-time streaming (Pub/Sub → Dataflow → BigQuery).

**Dataproc** is managed Spark/Hadoop. You still think in terms of a cluster (though you can spin up **ephemeral, job-scoped clusters** on Spot VMs for cost). Choose it when you already have Spark/Hadoop/Hive jobs to migrate, need a specific OSS engine or library, or your team's expertise is Spark. AWS analogues: Dataflow ≈ nothing exactly (Beam), Dataproc ≈ EMR.

Decision rule: **new streaming pipeline → Dataflow; existing Spark job → Dataproc.**

### Q14. What are Looker, Looker Studio, and BI Engine, and how do they relate to BigQuery?

- **Looker Studio** (formerly Data Studio) — free, self-service dashboarding/visualization tool. Connects to BigQuery and other sources, good for quick reports and shareable dashboards. Lightweight, no modeling layer.
- **Looker** — the enterprise BI platform. Its differentiator is **LookML**, a modeling layer where you define metrics, dimensions, and joins once in code; all reports then use consistent, governed definitions (a single source of truth for "what does revenue mean"). It queries BigQuery live (in-database) rather than extracting.
- **BI Engine** — an **in-memory analysis acceleration** layer inside BigQuery. You reserve memory capacity, and BI Engine caches hot data so dashboard queries return sub-second without re-scanning storage or heavily consuming the slot pool. It transparently accelerates Looker Studio, Looker, and other BI tools hitting BigQuery.

How they fit: BigQuery is the warehouse; **BI Engine** accelerates repeated dashboard queries; **Looker Studio** is the free ad-hoc viz; **Looker** is the governed enterprise BI with a modeling layer. For a fast executive dashboard on BigQuery, you'd enable BI Engine and build in Looker Studio; for company-wide governed metrics, you'd invest in Looker + LookML.

### Q15. Design a real-time streaming analytics pipeline on GCP. What does each stage do?

The canonical GCP streaming pattern is **Pub/Sub → Dataflow → BigQuery** (with BI Engine + Looker for serving):

1. **Ingest — Pub/Sub.** Producers (app servers, IoT devices, clickstream) publish events to a Pub/Sub topic. Pub/Sub is global, serverless, decouples producers from consumers, buffers spikes, and gives at-least-once delivery.
2. **Process — Dataflow.** A streaming Apache Beam pipeline subscribes to the topic, parses/validates/enriches events, applies **windowing** (e.g. tumbling 1-min windows) with watermarks to handle late/out-of-order data, deduplicates, and aggregates. Autoscales with load.
3. **Store — BigQuery.** Dataflow writes to a partitioned/clustered BigQuery table via the **Storage Write API** (exactly-once). Data is queryable within seconds.
4. **Serve — BI Engine + Looker/Looker Studio.** Dashboards query BigQuery, accelerated by BI Engine for sub-second refresh.

Add-ons: a **dead-letter topic** for messages Dataflow can't parse; **Pub/Sub schemas** (Avro/Protobuf) to enforce event structure; optionally a **BigQuery subscription** (Pub/Sub writes straight to BigQuery) for simple pass-through cases without Dataflow. The key senior points are exactly-once via the Storage Write API, windowing for correctness on out-of-order data, and decoupling via Pub/Sub so a Dataflow outage doesn't drop events (they buffer in the subscription).

### Q16. A query on a 5 TB table scans the whole table every time a dashboard loads, costing thousands per month. What's wrong and how do you fix it?

This is the classic **cost anti-pattern**. Root causes and fixes:

1. **No partitioning/clustering** — the dashboard filters (e.g. by date and customer) but the table isn't partitioned, so every filter scans all 5 TB. Fix: recreate the table **partitioned by date** and **clustered by the high-cardinality filter columns**; queries then scan only relevant partitions/blocks.
2. **`SELECT *`** — the dashboard pulls all columns when it needs a few. Fix: select only required columns (columnar storage means unused columns aren't scanned).
3. **Re-scanning on every load** — the same aggregation runs for every viewer. Fix: precompute with a **materialized view** or **scheduled query** into a small summary table, and point the dashboard there. Enable **BI Engine** so repeated dashboard queries serve from memory.
4. **No guardrails** — nothing stopped this. Fix: set **`--maximum_bytes_billed`** / custom per-user quotas, and mark the table **require partition filter** so no query can accidentally full-scan.
5. **Pricing model mismatch** — if sustained heavy usage, move to **capacity/reserved slots** for predictable cost instead of per-TB on-demand.

The combined effect: partition + cluster + materialized view + BI Engine typically cuts such a bill by one to two orders of magnitude, because the dashboard now scans megabytes of precomputed summary instead of terabytes of raw data.

### Q17. How would you load streaming data into BigQuery with exactly-once semantics, and what are the pitfalls?

Use the **Storage Write API** (directly, or via Dataflow's BigQueryIO which uses it). Its **committed** stream mode with per-stream **offsets** gives exactly-once: you assign each row an offset, and BigQuery deduplicates on retry so a redelivered message isn't double-written. For atomic batches, **pending mode** buffers rows and commits them all-or-nothing.

Pitfalls:

- **Legacy streaming inserts are only at-least-once** by default and rely on best-effort `insertId` dedup within a short window — don't assume exactly-once there.
- **Upstream duplicates from Pub/Sub** — Pub/Sub is at-least-once, so the *pipeline* must dedup. Dataflow does this with the message ID + windowing; if you write directly, carry an idempotency key.
- **Streaming buffer semantics** — recently streamed rows sit in a buffer and can't immediately be updated/deleted by DML; design around eventual availability.
- **Out-of-order / late data** — use Dataflow windowing with watermarks and allowed lateness, or you'll under-count late-arriving events.
- **Cost** — real-time streaming costs more than batch loads; if you don't truly need seconds-fresh data, micro-batch loads from Cloud Storage are far cheaper.

The clean design: Pub/Sub (at-least-once) → Dataflow (dedup + window) → BigQuery Storage Write API (exactly-once commit), giving end-to-end exactly-once into a partitioned table.

## Messaging & Streaming: Pub/Sub, Pub/Sub Lite & Eventarc

### Summary

**What this topic covers**

GCP's asynchronous messaging backbone — the services that decouple producers from consumers and move events between systems. **Pub/Sub** is the flagship: a **global, serverless, publish-subscribe messaging service** that functions as GCP's answer to "SNS + SQS combined" and, at scale, a Kafka alternative. This topic covers three concern areas: (1) **Pub/Sub core mechanics** — topics, subscriptions, publishers/subscribers, push vs pull delivery, at-least-once delivery and idempotency, ack deadlines and redelivery, ordering keys, exactly-once, dead-letter topics, retention, replay/seek, snapshots, filtering, and schemas; (2) **the variants and neighbors** — Pub/Sub vs **Pub/Sub Lite** (throughput-provisioned, zonal, cheaper), and **Eventarc** (event routing from Google sources and Audit Logs into Cloud Run/Functions/GKE using CloudEvents); and (3) **patterns and comparisons** — fan-out, the decoupling pattern, the streaming pipeline into Dataflow/BigQuery, and how Pub/Sub compares to Apache Kafka (and Managed Service for Kafka). The 16 questions run from "what is Pub/Sub" to "design an event-driven system" and "why are my messages being redelivered forever."

**Mental model**

Think of Pub/Sub as a **globally-distributed, infinitely-scalable buffer between systems that shouldn't know about each other.** Publishers send messages to a **topic** and immediately move on — they don't know or care who's listening. Each **subscription** attached to a topic gets its own independent copy of every message, and subscribers consume from subscriptions. That single design gives you two superpowers: **decoupling** (producer and consumer scale, deploy, and fail independently) and **fan-out** (add a new subscription and a whole new consumer starts getting every message without touching the publisher). The mental shift from a queue like SQS is that Pub/Sub combines pub-sub *topics* (SNS-style fan-out) and durable *subscriptions* (SQS-style buffered consumption) into one product — one topic, many subscriptions, each a durable independent stream. Two hard truths to internalize: delivery is **at-least-once** (so consumers must be **idempotent**), and messages are unordered by default (opt into ordering keys). Everything else — retention, replay, dead-letter, exactly-once — is a refinement on top of "durable, at-least-once, decoupled fan-out."

**Key terms**

- **Topic** — the named channel publishers send messages to.
- **Subscription** — a durable, independent stream of a topic's messages that one logical consumer reads; each subscription tracks its own acks and backlog.
- **Push vs pull** — push: Pub/Sub POSTs messages to your HTTPS endpoint. Pull: your subscriber requests messages (incl. high-throughput **StreamingPull**).
- **Ack / ack deadline** — the consumer must acknowledge a message within the deadline (default 10s, extendable to 10 min); unacked messages are redelivered.
- **At-least-once delivery** — a message is delivered one or more times; consumers must be idempotent. **Exactly-once** is an opt-in subscription feature (within a subscription).
- **Ordering key** — messages sharing a key are delivered in publish order to a subscriber (requires enabling message ordering).
- **Dead-letter topic (DLT)** — after N failed delivery attempts, a message is forwarded here instead of retrying forever.
- **Retention / seek / snapshot** — messages retained up to 7 days (31 with config); **seek** rewinds a subscription to a timestamp or **snapshot** to replay.
- **Filtering** — a subscription can filter by message attributes so it only receives matching messages.
- **Schema** — enforce message structure with **Avro** or **Protobuf** schemas attached to a topic.
- **Pub/Sub Lite** — a lower-cost, **zonal**, **throughput-provisioned** variant; you pre-provision capacity, trading elasticity for price.
- **Eventarc** — managed event routing that delivers **CloudEvents** from Google sources, Cloud Audit Logs, and Pub/Sub to Cloud Run/Functions/GKE.

**Why interviewers ask this**

Messaging is where distributed-systems maturity shows. Junior candidates describe Pub/Sub as "a queue." Senior candidates immediately name the consequences: **at-least-once means idempotent consumers**, **fan-out via multiple subscriptions**, and **decoupling** as the architectural goal. The strongest signal is how a candidate handles failure modes — do they mention **ack deadlines and redelivery storms**, **dead-letter topics** for poison messages, and **exponential backoff** retry policies? Do they know that **ordering is opt-in** and costs you throughput/locality? Interviewers also probe the **Pub/Sub vs Kafka** and **Pub/Sub vs Pub/Sub Lite** decisions — picking serverless-elastic vs provisioned-cheap is a cost/ops judgment call that separates people who've run these systems from people who've only read about them. Finally, Eventarc tests awareness of GCP's event-driven glue for serverless.

**Common confusions**

- "Pub/Sub guarantees exactly-once and ordering" — no. Default is at-least-once and unordered. Exactly-once and ordering are opt-in features with tradeoffs; you still design for idempotency.
- "A topic delivers a message once total" — each *subscription* gets its own copy. One topic with three subscriptions delivers each message three times, once per subscription.
- "Push is always better than pull" — push suits low-volume webhooks to public endpoints; pull (StreamingPull) suits high-throughput consumers that control their own flow.
- "Pub/Sub and Pub/Sub Lite are interchangeable" — Lite is zonal, capacity-provisioned, and much cheaper at high steady volume, but you manage capacity and lose global/elastic behavior.
- "Dead-letter topics retry the message" — no; a DLT is where messages go *after* max retries, so a human/process can inspect them. It stops infinite redelivery.
- "Eventarc is a different messaging system" — it's a routing layer that often uses Pub/Sub under the hood; it standardizes event *sources* into CloudEvents for serverless targets.

**What follows from this topic**

Pub/Sub is the front door of most event-driven and streaming architectures on GCP, so it links everywhere. **Pub/Sub → Dataflow → BigQuery** is the streaming pipeline from the Data & Analytics topic. **Eventarc → Cloud Run/Functions** ties into the Compute/Serverless topics as the trigger mechanism. The idempotency and at-least-once discussion connects to the Caching topic (using Redis to dedupe/store idempotency keys). And the decoupling pattern underpins microservices architecture discussions — Pub/Sub is how services communicate without synchronous coupling.

### Q1. What is Pub/Sub and what problem does it solve?

Pub/Sub is GCP's **global, serverless, fully-managed publish-subscribe messaging service**. Publishers send messages to a **topic**; **subscriptions** attached to that topic durably buffer the messages; **subscribers** consume from subscriptions. Google manages all the infrastructure — it scales automatically from zero to millions of messages/second with no provisioning.

The problem it solves is **decoupling**: producers and consumers don't call each other directly. A publisher fires a message and moves on; it doesn't know who consumes it, whether consumers are up, or how fast they process. This buys you:

- **Independent scaling & deployment** — services evolve separately.
- **Buffering** — spikes absorb into the subscription backlog instead of overwhelming consumers.
- **Fan-out** — many subscriptions per topic, so adding a consumer needs no publisher change.
- **Resilience** — a down consumer doesn't drop messages; they wait in the subscription (up to retention).

AWS analogue: Pub/Sub ≈ **SNS + SQS combined** — SNS-style topic fan-out with SQS-style durable per-subscription buffering in one product. It's the default async/event backbone on GCP.

### Q2. Explain push vs pull delivery, including StreamingPull.

**Pull** — the subscriber calls Pub/Sub to fetch messages, processes them, and acks. With the **StreamingPull** API the subscriber holds an open gRPC stream and Pub/Sub pushes messages down it as they arrive, giving very high throughput and low latency while the *client* still controls flow (via the client library's flow-control settings). Pull suits high-volume backend consumers (Dataflow, worker fleets) that manage their own concurrency.

**Push** — Pub/Sub **POSTs** each message to an HTTPS endpoint you register on the subscription. The endpoint returns 2xx to ack, or a non-2xx/timeout to nack (triggering retry with backoff). Push suits low-to-moderate volume, event-driven targets — especially serverless like Cloud Run/Functions that scale on incoming requests — and cases where the consumer can't run a long-lived puller.

Rule of thumb: **pull/StreamingPull** for high-throughput or when consumers control the rate; **push** for serverless webhook-style delivery to an endpoint. Push has a flow-control challenge (Pub/Sub controls the rate, so you rely on the endpoint's autoscaling), whereas pull lets the consumer throttle itself.

### Q3. Pub/Sub delivers at-least-once. What does that mean for consumer design?

At-least-once means a message will be delivered **one or more times** — under retries, redelivery after a missed ack, or network hiccups, a consumer can see the same message twice. Therefore **consumers must be idempotent**: processing the same message twice must produce the same result as processing it once.

Practical idempotency techniques:

- **Dedup on a business key or message ID** — record processed `messageId`s (e.g. in Redis/Memorystore or a database) and skip duplicates.
- **Idempotent operations** — design writes as upserts keyed by a stable ID, or use conditional writes so a replay is a no-op.
- **Idempotency keys** — carry a unique key in the message attributes and enforce uniqueness at the sink.

GCP also offers an opt-in **exactly-once delivery** subscription feature that guarantees, *within a subscription*, no successful redelivery of an acked message — but even then, cross-system exactly-once (end-to-end) still requires idempotent sinks, because your downstream write and the ack aren't one atomic transaction. The senior takeaway: **never assume exactly-once; build idempotent consumers regardless.**

### Q4. How do ack deadlines and redelivery work, and how do you avoid redelivery storms?

When Pub/Sub delivers a message, the consumer has until the **ack deadline** (default **10 seconds**, configurable up to **600s**) to acknowledge it. If it doesn't ack in time, Pub/Sub assumes failure and **redelivers** the message (to that or another subscriber on the subscription).

The classic failure is a **redelivery storm**: processing takes longer than the ack deadline, so Pub/Sub redelivers while the first attempt is still running, doubling load, which makes everything slower, which triggers more redeliveries — a feedback loop. Fixes:

- **Extend the deadline** for legitimately long work — the client libraries auto-extend via **modifyAckDeadline** (lease management) up to a max; ensure it's enabled/tuned.
- **Set a realistic ack deadline** on the subscription for your workload.
- **Ack fast, process async carefully** — but only ack after durable handoff, or you'll lose messages.
- **Use a dead-letter topic** so a message that repeatedly fails stops retrying after N attempts instead of looping forever.
- **Tune flow control** (max outstanding messages) so a consumer doesn't pull more than it can process within the deadline.

The root cause is almost always "ack deadline < actual processing time." Measure processing time and set the deadline (or lease extension) above the p99.

### Q5. What subscription types does Pub/Sub offer?

Pub/Sub subscriptions come in several delivery styles:

- **Pull** — consumers fetch via the pull/StreamingPull API; you run the subscriber.
- **Push** — Pub/Sub POSTs to your HTTPS endpoint.
- **BigQuery subscription** — Pub/Sub writes messages **directly into a BigQuery table** with no code/Dataflow in between; great for simple pass-through ingestion (optionally validating against the topic schema).
- **Cloud Storage subscription** — Pub/Sub batches messages into files (e.g. Avro/text) written to a Cloud Storage bucket, for cheap archival/batch landing.

Each subscription is **independent**: it has its own backlog, ack state, retention, filter, dead-letter policy, and retry policy. So one topic can have a pull subscription feeding Dataflow, a BigQuery subscription for raw archival, and a push subscription triggering a Cloud Run alerting service — all consuming every message independently. Choosing the type is about the consumer: managed sink (BigQuery/GCS subscriptions) removes glue code; pull/push are for custom processing.

### Q6. How do ordering keys and exactly-once delivery work, and what do they cost?

**Ordering keys** — by default Pub/Sub does not guarantee order. If you enable **message ordering** on a subscription and publishers set an **ordering key** on each message, Pub/Sub delivers messages with the *same key* in the order they were published (to a single subscriber). Different keys can still be processed in parallel/out of order relative to each other. Cost/tradeoff: ordering ties same-key messages to sequential processing, reducing parallelism and throughput for that key, and requires publishing to the same region; a stuck message blocks later ones for that key.

**Exactly-once delivery** — an opt-in subscription setting guaranteeing that, within that subscription, an acknowledged message is **not redelivered**, and redeliveries of unacked messages are deduplicated. It uses the message's stable ID and stronger ack tracking. Tradeoff: slightly higher latency and it applies only to **pull** subscriptions; it does not extend across systems (your downstream sink still needs idempotency for true end-to-end exactly-once).

Practical guidance: enable ordering only when business logic truly needs per-entity sequence (e.g. account balance events for one account); enable exactly-once to simplify dedup logic, but still design idempotent sinks. Both narrow Pub/Sub's default elasticity, so use them deliberately.

### Q7. What are dead-letter topics and retry policies?

A **retry policy** controls how Pub/Sub redelivers a message after a nack or expired ack deadline. You configure **exponential backoff** with a minimum and maximum backoff (e.g. min 10s, max 600s), so repeated failures back off instead of hammering the consumer.

A **dead-letter topic (DLT)** is the escape hatch for **poison messages** — messages that keep failing (bad payload, a bug, a permanently-unavailable dependency). You set a **max delivery attempts** (5–100) on the subscription; once a message exceeds it, Pub/Sub **forwards it to the dead-letter topic** instead of retrying forever. You then attach a subscription to the DLT to inspect, alert on, or reprocess those messages.

```bash
gcloud pubsub subscriptions create orders-sub \
  --topic=orders \
  --dead-letter-topic=orders-dlt \
  --max-delivery-attempts=5 \
  --min-retry-delay=10s --max-retry-delay=600s
```

Without a DLT, a single un-processable message can loop forever, consuming resources and blocking progress (especially with ordering). With one, transient failures retry with backoff, and permanent failures land in the DLT for humans to handle. Note: Pub/Sub needs its service account granted publish rights on the DLT and subscribe on the source for dead-lettering to work.

### Q8. Explain message retention, seek, snapshots, and replay.

Pub/Sub durably retains messages so you can reprocess history:

- **Retention** — unacknowledged messages are retained on a subscription up to **7 days** by default (configurable up to **31 days**). You can also enable **retain acked messages** so already-acked messages stay available for replay within the window.
- **Seek** — rewind (or fast-forward) a subscription to a **timestamp**: `seek` to 2 hours ago re-delivers everything since then (assuming retention covers it), or seek forward to skip a backlog. This is how you **replay** after a consumer bug — fix the code, seek back, reprocess.
- **Snapshot** — capture a subscription's current ack state at a moment in time; later you can seek the subscription (or a different one) **to that snapshot** to restore exactly that position. Useful before a risky deploy: snapshot, deploy, and if the new consumer misbehaves, seek back to the snapshot and no messages are lost.

Together these give **time-travel over your message stream**: replay for recovery, reprocessing for backfills (e.g. a new downstream needs historical events), and safe rollbacks. The constraint is the retention window — you can only seek/replay within retained history, so set retention to cover your worst-case recovery/backfill need.

### Q9. How does message filtering work and why use it?

A subscription can specify a **filter** on message **attributes** (metadata key/value pairs set by the publisher). Pub/Sub then delivers to that subscription only messages whose attributes match — non-matching messages are auto-acked and never delivered (and you're not billed for their delivery).

```bash
gcloud pubsub subscriptions create eu-orders-sub \
  --topic=orders \
  --message-filter='attributes.region = "EU" AND attributes.type = "order.created"'
```

Why use it: instead of one topic per event variant, publish everything to a single topic with descriptive attributes, and let each consumer subscribe with a filter for just what it cares about. A fraud service filters `type = "payment"`, an EU analytics service filters `region = "EU"`, and so on — all off one topic. This simplifies the publisher (one topic, rich attributes) and keeps consumers lean (no filtering logic in code, no wasted processing on irrelevant messages).

Note filtering is on **attributes only**, not the message body — so put routing-relevant fields in attributes at publish time. Filters are immutable per subscription (set at creation).

### Q10. What schema support does Pub/Sub provide?

Pub/Sub lets you attach a **schema** to a topic — **Avro** or **Protocol Buffers (Protobuf)** — and enforce that every published message conforms to it. Publishers whose messages don't match the schema are rejected at publish time.

Benefits:

- **Contract enforcement** — producers and consumers agree on message structure; a producer can't accidentally ship a malformed or breaking payload.
- **Evolution safety** — schemas support compatible evolution (adding optional fields) so you can change message shape without breaking existing consumers.
- **Downstream integration** — a schema'd topic can feed a **BigQuery subscription** that maps fields directly to table columns, or Dataflow with typed parsing.

Without schemas, Pub/Sub messages are opaque byte blobs and any structure agreement is informal (and easily broken). With schemas, the messaging layer validates the contract, which is critical in event-driven systems where many independent teams produce/consume the same events. It's the messaging analogue of enforcing a table schema in a database — cheap insurance against a producer breaking every downstream at once.

### Q11. What is flow control and backpressure in Pub/Sub?

**Flow control** limits how many messages (or bytes) a subscriber will have **outstanding** (delivered but not yet acked) at once. In the pull/StreamingPull client libraries you set `maxOutstandingMessages` / `maxOutstandingBytes`; the client stops requesting more until it acks what it holds. This prevents a consumer from pulling more than it can process, which would otherwise cause memory blowups and ack-deadline expiries (→ redelivery storms).

**Backpressure** is the system-level effect: when consumers slow down, unprocessed messages accumulate in the subscription **backlog** rather than overwhelming the consumer. Because Pub/Sub durably buffers, a slow or down consumer just grows its backlog (up to retention) — the pressure is absorbed by the buffer, not pushed onto the consumer as dropped messages or OOM crashes. When the consumer catches up, it drains the backlog.

The interaction matters: with **pull**, the consumer sets its own flow control, so backpressure is natural and safe. With **push**, Pub/Sub controls the send rate and adjusts based on your endpoint's success/latency, so you rely on the endpoint (e.g. Cloud Run) autoscaling to handle load, and on retries/backoff when it returns errors. For high, spiky load, pull with tuned flow control gives you the most predictable behavior.

### Q12. Explain fan-out and the decoupling pattern with Pub/Sub.

**Fan-out** = one message reaching many independent consumers. In Pub/Sub you attach **multiple subscriptions to one topic**; each subscription receives its own copy of every message. So a single `order.created` event published once can simultaneously drive: an inventory service (subscription A), an email/notification service (B), an analytics pipeline into BigQuery (C), and a fraud check (D) — the publisher does none of this coordination and doesn't even know these consumers exist.

**The decoupling pattern** is the architectural payoff. The publisher's only job is "emit that an order was created." Adding a fifth consumer (say a loyalty-points service) means creating a new subscription — **zero changes to the publisher or existing consumers**. Consumers can be added, removed, redeployed, or fail independently. This is the foundation of event-driven microservices: services communicate by **publishing facts** ("order created") rather than **commanding** each other ("send this email now") over synchronous calls.

Contrast with synchronous coupling: if the order service directly called inventory, email, analytics, and fraud APIs, it would be slow (sum of latencies), fragile (any callee down fails the order), and rigid (new consumer = code change). Pub/Sub fan-out replaces that with an asynchronous, resilient, extensible broadcast. This is exactly why "use a message bus to decouple services" is the standard answer to scaling event-driven systems.

### Q13. Compare Pub/Sub and Pub/Sub Lite. When would you choose Lite?

| | Pub/Sub | Pub/Sub Lite |
|---|---|---|
| Scaling | Serverless, elastic, auto | Provisioned capacity you set |
| Location | Global | Zonal (or regional) |
| Cost model | Pay per message volume | Pay for provisioned throughput/storage |
| Cost at high steady volume | Higher | Much lower (up to ~10x cheaper) |
| Ops | Zero capacity management | You provision & monitor capacity |
| Availability | Higher (multi-zone) | Lower (zonal) |

**Pub/Sub** auto-scales globally with no capacity planning — you pay per message and it just works. **Pub/Sub Lite** is a **cost-optimized** variant where you **pre-provision** throughput (publish/subscribe MB/s) and storage capacity in a specific **zone**. Because you commit to capacity and forgo global elasticity, it's dramatically cheaper for **high, predictable, steady-state volume**.

Choose **Lite** when: you have very high, stable throughput; cost is the dominant concern; you can tolerate zonal availability (or add your own redundancy); and you're willing to manage capacity (and eat the risk of throttling if you under-provision). Choose **standard Pub/Sub** when: throughput is spiky/unpredictable, you need global reach or higher availability, or you don't want to manage capacity — which is most use cases. In practice, standard Pub/Sub is the default; Lite is a deliberate cost optimization for known heavy pipelines (and Google has signaled Lite is a niche/legacy-leaning option, so weigh long-term support).

### Q14. What is Eventarc and what does it enable?

**Eventarc** is GCP's managed **event routing** layer. It delivers events, in the standardized **CloudEvents** format, from many **sources** to serverless **targets** — **Cloud Run, Cloud Functions, GKE, and Workflows** — without you wiring up the plumbing.

Event sources include:

- **Cloud Audit Logs** — trigger on almost any Google Cloud API action (e.g. "a Cloud Storage object was created," "a BigQuery job completed," "a VM was deleted"). This is the powerful part: hundreds of Google services become event sources via Audit Logs.
- **Pub/Sub** — route messages from a topic to a target (Eventarc uses Pub/Sub under the hood as its transport).
- **Direct sources** — some services emit events directly to Eventarc.

Why it matters: instead of each service inventing its own trigger mechanism, Eventarc gives a **uniform CloudEvents-based way to run serverless code in response to things happening across GCP**. Example: "when a file lands in a Cloud Storage bucket, run a Cloud Run service to process it" — Eventarc delivers that as a CloudEvent to your service. It's GCP's event-driven glue tying the platform's activity to serverless compute. AWS analogue: Eventarc ≈ **EventBridge** (routing Google-source and audit events to compute).

### Q15. Compare Pub/Sub to Apache Kafka, and mention Managed Service for Kafka.

| | Pub/Sub | Apache Kafka |
|---|---|---|
| Model | Serverless, fully managed | You (or a provider) run brokers |
| Scaling | Automatic, global | Manual partition/broker sizing |
| Abstraction | Topics + subscriptions | Topics + partitions + consumer groups + offsets |
| Ordering | Per-ordering-key (opt-in) | Per-partition (native) |
| Replay | Seek/snapshot within retention | Offset-based, log retained |
| Ecosystem | GCP-native (Dataflow, BigQuery) | Huge OSS ecosystem (Connect, Streams, ksqlDB) |

**Pub/Sub** wins on **zero operations and elastic global scale** — no brokers, partitions, or capacity planning; it just scales. It's the default for GCP-native event-driven and streaming systems. **Kafka** gives you a **partitioned commit log** with fine-grained control (consumer groups, per-partition ordering, offset management) and a massive ecosystem (Kafka Connect, Streams, Schema Registry, ksqlDB), plus portability across clouds/on-prem.

Choose **Pub/Sub** for new GCP-native workloads where you want serverless simplicity. Choose **Kafka** when you need its specific semantics (log compaction, strict per-partition ordering, exactly-once streams processing via Kafka Streams), have existing Kafka investment, need multi-cloud portability, or rely on the Connect ecosystem.

If you want Kafka's semantics without self-managing brokers, GCP offers **Managed Service for Apache Kafka** — Google runs the Kafka clusters (provisioning, scaling, patching, HA) while you keep the standard Kafka API and ecosystem. It's the bridge for teams committed to Kafka but wanting managed ops on GCP.

### Q16. Design an event-driven order-processing system and explain how you'd handle poison messages.

**Design.** The order service publishes an `order.created` event (with a topic **schema**, and attributes like `region`, `type` for filtering) to a Pub/Sub **topic**. Multiple **subscriptions** fan out to independent consumers:

- **Inventory service** (pull subscription on Cloud Run) — reserves stock; **idempotent** via order ID.
- **Notification service** (push subscription to Cloud Run) — sends confirmation email.
- **Analytics** (subscription → Dataflow → BigQuery) — real-time order metrics.
- **Fraud check** (filtered subscription, `type = "payment"`).

Publisher and consumers scale and fail independently (decoupling). If a consumer is down, its subscription backlog holds messages up to retention; when it recovers, it drains.

**Reliability details.** At-least-once delivery → every consumer is **idempotent** (dedupe on order ID, e.g. via a Memorystore/Redis processed-set or conditional DB upsert). Set realistic **ack deadlines** with client-side lease extension for slow steps. Use **ordering keys** (key = account or order ID) only where per-entity sequence matters (e.g. order state transitions).

**Poison messages.** A malformed or permanently-failing message must not loop forever. Configure each subscription with a **retry policy** (exponential backoff) and a **dead-letter topic** with **max delivery attempts** (e.g. 5). After 5 failed attempts, Pub/Sub forwards the message to the DLT. A dedicated subscription on the DLT alerts on-call and stores the message for inspection/manual reprocessing. This isolates one bad message from blocking the pipeline (critical with ordering) and turns "silent infinite retry" into "visible, actionable failure." Optionally, seek/snapshot lets you replay history after fixing a consumer bug.

## Caching & In-Memory: Memorystore

### Summary

**What this topic covers**

GCP's managed in-memory data store — **Memorystore** — and the caching thinking that surrounds it. Memorystore is GCP's fully-managed **Redis** and **Memcached** offering (Redis, Redis Cluster, and Memcached flavors), used to put a fast, in-memory tier in front of databases and services. This topic covers three concern areas: (1) **the products** — Memorystore for Redis vs Memorystore for Memcached vs Memorystore for Redis Cluster, their tiers (Basic vs Standard HA), read replicas, and failover; (2) **caching strategy** — cache-aside/lazy-loading, write-through, write-behind, TTLs, cache invalidation, and the classic failure modes (thundering herd / cache stampede, hot keys, staleness); and (3) **operating it well** — sizing, eviction policies (`maxmemory-policy`), connectivity from GKE/Cloud Run (private IP, Serverless VPC Access), monitoring hit ratio, persistence/durability caveats, Redis beyond caching (sessions, rate limiting, leaderboards, locks, pub/sub), and when self-managing Redis on GCE makes sense instead. The 15 questions run from "why cache" to "diagnose a cache stampede" and "pick Redis vs Memcached for this workload."

**Mental model**

A cache is a **bet that reads repeat**: you keep a small, hot slice of data in fast memory so most reads never touch the slow, expensive backing store. The economics are stark — a Redis lookup is sub-millisecond in RAM; a database query or cross-service call is milliseconds to tens of milliseconds and consumes precious DB connections/CPU. So caching does three things at once: **cuts latency**, **offloads the database** (fewer queries, so the DB scales further), and **reduces cost** (a cheap cache node absorbs load that would otherwise need a bigger, pricier database). The mental discipline is that a cache is **not a source of truth** — it's a disposable, best-effort copy. That reframes every hard problem: staleness (the copy drifts from truth), invalidation (when to throw the copy away), and durability (you must be able to lose the whole cache and still be correct, just slower). Design so that a cold or wiped cache degrades performance, never correctness. And know the two canonical caches: **Redis** (rich data structures, replication, persistence, HA — a "data structure server") vs **Memcached** (dead-simple, multi-threaded, sharded key-value — pure ephemeral cache).

**Key terms**

- **Memorystore for Redis** — managed Redis with data structures, replication, optional persistence, and HA (Standard tier).
- **Memorystore for Memcached** — managed, multi-threaded, horizontally-sharded key-value cache; no persistence/replication — a simple volatile cache.
- **Memorystore for Redis Cluster** — sharded Redis for **horizontal scaling** beyond a single node's memory/throughput, with data partitioned across shards.
- **Basic vs Standard tier** — Basic = single node (cache only, no failover); Standard = replicated with **automatic failover** for HA.
- **Read replica** — a replica serving reads to scale read throughput (and provide failover targets).
- **Cache-aside (lazy loading)** — app checks cache, on miss reads the DB and populates the cache. The default pattern.
- **Write-through / write-behind** — write-through updates cache and DB synchronously; write-behind updates cache now and DB asynchronously later.
- **TTL** — per-key expiry that bounds staleness and reclaims memory.
- **Eviction policy (`maxmemory-policy`)** — what Redis discards when full: `allkeys-lru`, `allkeys-lfu`, `volatile-ttl`, `noeviction`, etc.
- **Cache stampede / thundering herd** — many concurrent misses on the same hot key all hit the DB at once when it expires.
- **Hot key** — a single key with disproportionate traffic that overloads one shard/node.
- **Hit ratio** — fraction of reads served from cache; the primary health metric of a cache.

**Why interviewers ask this**

Caching separates engineers who've *operated* systems from those who've only built happy-path features. Anyone can say "add Redis." The signal is in the failure modes: does the candidate know **cache invalidation** is famously hard, that **stampedes** take down databases when a hot key expires, that **hot keys** overload a single shard, and that a cache must be **correct when empty**? Interviewers probe the **Redis vs Memcached** decision (data structures/HA vs simple sharded speed) as a judgment call, and the **strategy** choice (cache-aside vs write-through) as a consistency/latency tradeoff. Senior candidates also talk **connectivity** (Memorystore uses private IPs — how does Cloud Run reach it?), **sizing and eviction**, and **monitoring hit ratio** to know if the cache is even earning its keep. And they know the durability caveat: a cache is not a database, and Memorystore persistence is a convenience, not a durability guarantee.

**Common confusions**

- "Redis is durable storage" — treat it as an ephemeral cache. Even with RDB/AOF persistence enabled, design so losing the cache costs performance, not data correctness.
- "Redis and Memcached are interchangeable" — Memcached is a simple multi-threaded sharded key-value cache; Redis is a data-structure server with replication, persistence, and HA. Different tools.
- "A cache is always consistent with the DB" — no. Caches are eventually consistent at best; you manage staleness with TTLs and invalidation, and accept a window of drift.
- "Just add a cache and everything is faster" — only if reads repeat and hit ratio is high; a low-hit-ratio cache adds latency and cost with little benefit.
- "TTL solves invalidation" — TTL bounds staleness but doesn't give immediate correctness after a write; for that you invalidate/update on write.
- "Bigger cache = fewer stampedes" — stampedes are about *concurrent misses on a hot key at expiry*, not total size; you fix them with locking, jittered TTLs, or early recomputation.
- "Basic tier is fine for production" — Basic is a single node with no failover; production usually needs Standard (HA) so a node failure doesn't wipe the cache and hammer the DB.

**What follows from this topic**

Caching sits between the app and its data stores, so it links across the platform. The **database offload** angle connects to the Databases topic (Cloud SQL/Spanner) — a cache is how you protect an OLTP store from read load, complementing BigQuery's role as the analytics tier. The **idempotency/dedup** use of Redis ties back to the Messaging topic (storing processed message IDs). **Connectivity** (Serverless VPC Access, private IP) links to the Networking topic. And Redis-beyond-caching (rate limiting, sessions, leaderboards, distributed locks, pub/sub) shows the cache tier doubling as lightweight infrastructure for the Compute/serverless topics.

### Q1. Why cache? What does an in-memory cache actually buy you?

A cache trades a little memory and complexity for three concrete wins:

- **Latency** — a Redis/Memcached lookup is **sub-millisecond** (data in RAM), versus milliseconds to tens of milliseconds for a database query or downstream API call. For read-heavy paths that's often a 10–100x speedup on the hot path.
- **Database offload** — every read served from cache is a query the database never runs. That frees DB CPU, IO, and (crucially) scarce connections, so the same database supports far more traffic. A cache is often what lets a single Cloud SQL instance survive a traffic spike.
- **Cost** — a small Memorystore node is far cheaper than scaling up the database (or adding read replicas) to handle the same read volume. You absorb load on cheap RAM instead of expensive database capacity.

The prerequisite is **read repetition**: caching only pays off when the same data is read many times relative to how often it changes. A high **hit ratio** (say >80–90%) means the cache is doing its job; a low hit ratio means you're adding a hop and eviction churn for little benefit. So cache **hot, frequently-read, infrequently-changed** data — product catalogs, user profiles, config, computed aggregates — not unique-per-request data.

### Q2. Compare Memorystore for Redis and Memorystore for Memcached.

| | Memorystore for Redis | Memorystore for Memcached |
|---|---|---|
| Data model | Rich structures (strings, hashes, lists, sets, sorted sets, streams) | Simple key → value only |
| Threading | Mostly single-threaded per node | Multi-threaded (scales on cores) |
| Replication / HA | Yes (Standard tier, auto failover) | No replication, no failover |
| Persistence | Optional (RDB snapshots) | None (purely in-memory) |
| Scaling | Vertical + Redis Cluster (sharded) | Horizontal sharding across nodes |
| Best for | Caching + sessions, leaderboards, locks, pub/sub, anything needing structures or HA | Simple, large, ephemeral key-value cache |

**Redis** is a **data-structure server**: it gives you sorted sets (leaderboards), atomic counters (rate limiting), hashes, TTLs, pub/sub, and Lua scripting, plus **replication with automatic failover** and optional persistence. Choose it when you need more than dumb key-value, or need high availability.

**Memcached** is a **simple, multi-threaded, sharded key-value cache** with no persistence, replication, or structures. It scales horizontally by adding nodes and is excellent as a large, cheap, purely-ephemeral cache — its multi-threading can push very high throughput per node.

Rule of thumb: default to **Redis** (it does more, including HA); pick **Memcached** when you specifically want a simple, wide, throwaway cache and value its multi-threaded simplicity over Redis features. Most teams pick Redis because the extra capabilities are usually worth it.

### Q3. What is Memorystore for Redis Cluster and when do you need it?

**Memorystore for Redis Cluster** runs Redis in **cluster mode**, **sharding** your keyspace across multiple nodes (shards). Data and throughput are partitioned, so total capacity scales roughly linearly with the number of shards — you're no longer bounded by a single node's memory or (largely single-threaded) CPU.

You need it when a single Redis node can't hold your working set or handle your request rate:

- **Memory** — your hot data exceeds what one node can store (a single instance tops out at a fixed max memory).
- **Throughput** — request volume exceeds one node's single-threaded ceiling; sharding spreads load across shards.
- **Horizontal scalability** — you want to scale by adding shards (and it supports scaling out/in) rather than resizing one big node.

Tradeoffs vs a single instance: **multi-key operations** (transactions, `MGET`, Lua) only work if the keys hash to the same shard (use **hash tags** `{...}` to co-locate related keys), and cross-slot operations are restricted. So cluster mode adds a data-locality constraint your key design must respect. Use a single (Standard-tier) instance until you actually hit its memory/throughput limits; move to Redis Cluster for genuine horizontal scale, designing keys so related data shares a slot.

### Q4. Explain Basic vs Standard tiers, read replicas, and failover.

**Basic tier** — a **single Redis node**. It's a pure cache: if the node fails or is restarted (maintenance), the data is **gone** and there's **no automatic failover**. Cheapest, but a node loss means a cold cache and a load spike on the database. Fine for non-critical caches where a wipe is tolerable.

**Standard tier** — a **replicated** setup with a primary and one or more replicas in **different zones**, with **automatic failover**. If the primary fails, Memorystore promotes a replica and updates the endpoint, so the cache survives a zone/node failure with minimal disruption. This is the production default when a cache wipe would be damaging (e.g. it would stampede the database).

**Read replicas** — Standard tier (and Redis Cluster) can serve **reads from replicas** to scale read throughput beyond the primary, and those replicas double as failover targets. You direct read-heavy traffic to the read endpoint while writes go to the primary. Note the usual caveat: replicas are **asynchronously** replicated, so a replica read can be slightly stale.

Guidance: use **Standard** (HA) for any cache whose sudden loss would harm the system — which is most production caches, precisely because a cold cache dumps load onto the database exactly when you can least afford it. Reserve Basic for throwaway/dev caches.

### Q5. Walk through the main caching strategies: cache-aside, write-through, write-behind.

**Cache-aside (lazy loading)** — the default. The app checks the cache; on a **hit** it returns; on a **miss** it reads the database, writes the value into the cache (with a TTL), and returns it. The cache only fills with data that's actually requested.

- Pros: simple, resilient (cache down ≠ app down, just slower), only caches what's used.
- Cons: first read per key is a miss (cold-start latency); risk of staleness after writes unless you invalidate.

**Write-through** — on a write, the app updates the **cache and the database synchronously** (cache is always populated with fresh data).

- Pros: cache never stale relative to writes; reads always hot.
- Cons: every write pays cache + DB latency; caches data that may never be read.

**Write-behind (write-back)** — the app writes to the **cache immediately** and the cache **asynchronously** flushes to the database later (often batched).

- Pros: very fast writes, absorbs write spikes, batches DB load.
- Cons: risk of **data loss** if the cache dies before flushing; added complexity; eventual consistency in the DB.

In practice, **cache-aside is the workhorse** (often combined with TTLs and explicit invalidation on write). Write-through suits read-heavy data where you want reads always warm. Write-behind is for write-heavy, loss-tolerant workloads (metrics, counters) where throughput beats durability.

### Q6. How do you handle cache invalidation and staleness?

Cache invalidation — deciding when a cached copy is no longer valid — is famously one of the hard problems. The tools:

- **TTL (expiry)** — set a time-to-live so entries auto-expire and get re-fetched fresh. This **bounds** staleness (data is at most TTL-old) without any explicit signaling. Simple and robust; the tradeoff is a staleness window and a miss at expiry.
- **Explicit invalidation on write** — when the app updates the underlying data, it **deletes (or updates) the cache key** in the same operation. This gives near-immediate freshness. Deleting (invalidate) is usually safer than updating (write-through) because it avoids caching a value that might race with concurrent writes.
- **Event-driven invalidation** — a change stream / Pub/Sub message fans out cache-invalidation events to all app instances (useful across many nodes or services sharing a cache).
- **Versioned keys** — embed a version/hash in the key (`user:123:v7`); a new version means new keys, old ones expire out. Avoids in-place invalidation races.

**Staleness** is inherent: a cache is eventually consistent with the source of truth. You engineer the **acceptable window** — short TTLs and write-time invalidation for data that must be fresh (prices, inventory), longer TTLs for tolerant data (product descriptions). The senior mindset: pick the weakest consistency the business can tolerate, because tighter freshness costs hit ratio and complexity. And always design so stale-but-available beats fresh-but-down where appropriate.

### Q7. What are the thundering herd / cache stampede, and how do you mitigate them?

A **cache stampede** (a.k.a. thundering herd or dogpile) happens when a **hot key expires** (or the cache restarts cold) and **many concurrent requests all miss at the same instant**, so they **all hit the database simultaneously** to recompute the same value. The database gets a sudden flood of identical expensive queries and can be knocked over — ironically, right when the cache was supposed to protect it.

Mitigations:

- **Request coalescing / mutex lock** — on a miss, the first requester acquires a lock (e.g. a Redis `SET NX` key) and recomputes; others wait briefly and read the freshly-populated value instead of all querying the DB. Only one DB hit per key per expiry.
- **Jittered / randomized TTLs** — add random spread to expiry times so many keys don't expire at the exact same second; prevents synchronized mass misses.
- **Early / probabilistic recomputation** — refresh a key **before** it expires (e.g. XFetch: probabilistically recompute as expiry approaches), so it's renewed by one request in the background while others still read the old value.
- **Stale-while-revalidate** — serve the stale value while a single background task recomputes; readers never see a miss.
- **Pre-warming** — populate known-hot keys before traffic arrives (after a deploy or cache flush).

The key insight: stampedes are about **synchronized concurrent misses on hot keys**, not cache size. The fixes all reduce concurrent recomputation to (ideally) one per key.

### Q8. What are hot keys and how do you deal with them?

A **hot key** is a single key that receives a hugely disproportionate share of traffic — e.g. the cache entry for a celebrity's profile, a viral product, or a global config value everyone reads. Because a given key lives on **one node/shard** (its hash slot), all that traffic concentrates on a single node, creating a bottleneck: that node saturates CPU/network while others idle, so sharding doesn't help — the hot key can't be spread by adding shards.

Mitigations:

- **Local/in-process cache** — cache the hot value in each app instance's memory for a short TTL, so most reads never even reach Redis (a two-tier cache: local → Redis → DB). Hugely effective for a handful of very hot keys.
- **Key replication / sharding the value** — store N copies under keys `hotkey:0..N` and have clients read a random one, spreading load across shards. Adds write fan-out complexity.
- **Client-side caching** — Redis client-side caching (tracking) keeps a local copy invalidated by the server.
- **Read replicas** — serve hot reads from replicas to spread the read load off the primary.

Detection: Memorystore/Redis lets you find hot keys via monitoring and tools like `redis-cli --hotkeys` or the `MONITOR`/keyspace metrics; watch for one shard's CPU far above the others. The go-to fix is usually the **local cache layer** — for a truly hot, rarely-changing key, keeping it in app memory eliminates the single-node bottleneck entirely.

### Q9. What can Redis do beyond caching?

Redis is a data-structure server, so it doubles as lightweight infrastructure for many patterns:

- **Sessions** — store user session state (a hash per session) with a TTL; fast, shared across stateless app instances (so any Cloud Run/GKE instance can serve any user).
- **Rate limiting** — atomic counters (`INCR` with `EXPIRE`) or sliding-window/token-bucket algorithms enforce "N requests per minute per user" without hitting a database.
- **Leaderboards / ranking** — **sorted sets** (`ZADD`/`ZRANGE`) maintain real-time ranked lists (top scores, trending) in O(log n) — a textbook Redis use case.
- **Distributed locks** — `SET key val NX PX ttl` (or Redlock) coordinates exclusive access across processes (e.g. "only one worker runs this job"). Use with care around expiry/fencing.
- **Pub/Sub & Streams** — Redis pub/sub for lightweight real-time fan-out; Redis Streams for a durable append log with consumer groups (a lighter alternative to Pub/Sub for in-cluster messaging).
- **Queues / job buffers** — lists (`LPUSH`/`BRPOP`) as simple work queues.
- **Deduplication / idempotency** — a set of processed IDs to dedupe at-least-once messages (ties into the Pub/Sub idempotency pattern).
- **Real-time counters & analytics** — HyperLogLog for cardinality (unique visitors), bitmaps for presence.

This versatility is why teams pick **Redis over Memcached** — the same node caching your data can also hold sessions, enforce rate limits, and power a leaderboard. Just remember durability caveats: for anything you can't afford to lose, Redis is a fast working store, not the system of record.

### Q10. How do you size a cache and choose an eviction policy?

**Sizing** — pick memory to hold your **working set** (the hot data actually read repeatedly) plus headroom. Undersize and you evict useful data constantly (low hit ratio, thrash); oversize and you waste money. Practically: estimate hot-key count × average value size, add ~25–30% overhead for Redis metadata/fragmentation and replication buffers, then validate against the live **hit ratio** and eviction metrics — if evictions are high and hit ratio low, grow it (or move to Redis Cluster for horizontal capacity).

**Eviction policy** (`maxmemory-policy`) — what Redis discards when it hits `maxmemory`:

- **`allkeys-lru`** — evict least-recently-used across all keys. The go-to for a general cache.
- **`allkeys-lfu`** — evict least-**frequently**-used; better when some keys are persistently hot and you want to keep them regardless of recency.
- **`volatile-lru` / `volatile-lfu` / `volatile-ttl`** — evict only among keys **with a TTL** (LRU/LFU, or the nearest-expiry); use when some keys must never be evicted (mark those with no TTL).
- **`noeviction`** — reject writes when full (returns errors). Use only when Redis is a store of record you must not silently drop from — dangerous for a cache.

For a pure cache, **`allkeys-lru`** (or `allkeys-lfu` for skewed hot sets) is the sensible default: it keeps the hottest data and sheds the cold tail automatically. Set TTLs so entries also expire on time, not just under memory pressure.

### Q11. How do you connect to Memorystore from GKE and Cloud Run?

Memorystore instances have a **private IP** on your **VPC** — they are **not** reachable over the public internet. So connectivity is about getting your compute onto (or peered with) that VPC.

- **GKE** — clusters run in your VPC, so pods can reach the Memorystore private IP directly, provided the cluster's network/subnet can route to the instance's network (same VPC or peered) and firewall rules allow the Redis port (6379). For instances using private services access, ensure the peering is set up. This is the straightforward case.
- **Cloud Run (and Cloud Functions)** — these are serverless and run outside your VPC by default, so they **can't** hit a private IP directly. You attach **Serverless VPC Access** (a **VPC connector**, or Direct VPC egress) to the service, which gives it an interface into your VPC; then it can reach the Memorystore private IP as if it were in-network.

```bash
# Cloud Run reaching a private Memorystore Redis via a VPC connector
gcloud run deploy my-api \
  --vpc-connector=my-connector \
  --set-env-vars=REDIS_HOST=10.0.0.3,REDIS_PORT=6379
```

Also: keep the cache and compute in the **same region** (Memorystore is regional; cross-region adds latency and isn't the intended pattern), enable **AUTH** and **in-transit encryption (TLS)** for security, and size the VPC connector for your throughput. The recurring gotcha is a Cloud Run service that "can't connect to Redis" — almost always a missing Serverless VPC Access connector.

### Q12. Why monitor hit ratio, and what does a low hit ratio tell you?

**Hit ratio** = cache hits ÷ (hits + misses) — the fraction of reads served from cache. It's the single most important cache health metric because it directly measures whether the cache is doing its job. A high ratio (say 90%+) means 9 of 10 reads skip the database; a low ratio means most reads still pay full database cost *plus* the wasted cache round-trip.

A **low hit ratio** points to one of:

- **Cache too small** — the working set doesn't fit, so useful entries get evicted before they're re-read (check the eviction rate alongside hit ratio). Fix: increase memory or shard (Redis Cluster).
- **TTLs too short** — entries expire before they're reused. Fix: lengthen TTLs where staleness allows.
- **Poor cacheability** — the workload is mostly unique-per-request reads (low repetition), so caching fundamentally can't help. Fix: cache a different layer, or don't cache.
- **Cold cache** — recently flushed/restarted (Basic tier failure); ratio recovers as it warms. Fix: Standard tier + pre-warming.
- **Bad key design** — over-specific keys that rarely repeat. Fix: coarser cache granularity.

Watch it alongside **evictions**, **memory usage**, **latency**, and **connections**. Rising evictions + falling hit ratio = undersized cache. A persistently low hit ratio that sizing doesn't fix means the data just isn't cache-friendly — and a cache that isn't hit is pure added latency and cost, so you either fix cacheability or remove it.

### Q13. When and where should you cache in an architecture?

**When to cache** — when reads are **frequent, repeated, and tolerant of some staleness**, and the backing operation is **slow or expensive**. Ideal targets: read-heavy data with a high read:write ratio (product catalogs, user profiles, config, computed aggregates, rendered fragments). **Don't** cache: unique-per-request data (low reuse → low hit ratio), data that must be perfectly consistent every read, or write-heavy data that churns faster than it's read.

**Where to cache** — caching is layered, and you often use several tiers:

- **Client / browser** — HTTP caching, CDN (**Cloud CDN**) for static assets and cacheable responses at the edge — closest to the user, biggest latency win.
- **Application in-process** — a local memory cache in each instance for tiny, ultra-hot, rarely-changing data (great for hot keys; avoids even the network hop to Redis).
- **Distributed cache (Memorystore)** — the shared cache tier between app and database, holding the hot working set consistently across all instances. This is the main "add a cache" layer.
- **Database-level** — query/result caching, materialized views (in BigQuery), read replicas.

The general principle: **cache as close to the consumer as staleness allows.** Edge/CDN for static and public content, a shared Memorystore tier for dynamic-but-repeated data, and a small in-process tier for the hottest keys. Each layer absorbs load so the next one down (ultimately the database) sees only the traffic it truly must.

### Q14. What are the persistence and durability caveats of Memorystore/Redis?

Redis is **in-memory first** — data lives in RAM, and persistence is a bolt-on, not the core guarantee:

- **RDB snapshots** — Memorystore for Redis can take periodic **RDB** point-in-time snapshots to disk (e.g. every N hours). On a restart it reloads from the last snapshot, so you recover *most* data. But anything written **since the last snapshot is lost** — RDB is coarse, not continuous.
- **No/limited AOF in managed Memorystore** — self-managed Redis offers AOF (append-only file) for near-continuous durability, but managed Memorystore's durability options are more limited (RDB-style), so you can't assume every write survives a crash.
- **Replication is not durability** — Standard-tier replication protects against a *node/zone* failure (failover to a replica), but a correlated failure or a data-corrupting bug can still lose recent writes; replicas are async, so the newest writes may not have propagated.

The senior conclusion: **treat Memorystore as a cache, not a system of record.** Persistence/snapshots reduce cold-start pain (a restarted node reloads warm data instead of starting empty, avoiding a stampede) — that's their real value. They are **not** a promise that no write is ever lost. So any data you cannot afford to lose must live in a durable store (Cloud SQL, Spanner, Firestore, Cloud Storage), with Redis as the fast copy in front. Design every cache path to be **correct when the cache is empty or has lost recent writes** — degraded performance, never data loss.

### Q15. When would you self-host Redis on Compute Engine instead of using Memorystore?

**Default to Memorystore** — it's fully managed: provisioning, patching, replication, automatic failover, monitoring, and scaling are Google's problem, which is the right tradeoff for almost everyone. You'd only self-host Redis on **GCE VMs** when you need something managed Memorystore doesn't offer:

- **Redis features/modules Memorystore lacks** — e.g. **RediSearch, RedisJSON, RedisBloom, RedisTimeSeries**, or a specific Redis version/config not exposed by Memorystore. Managed services restrict tunables and modules; self-hosting gives full control.
- **Full config control** — arbitrary `redis.conf` settings, custom persistence (AOF everysec for stronger durability), Lua/module loading, or a topology Memorystore doesn't support.
- **Cost at scale with in-house expertise** — if you already run Redis ops well, self-hosting on Spot/committed-use VMs *can* be cheaper at large scale — but you're now on the hook for HA, failover, upgrades, and monitoring.
- **Specific version pinning / migration** — matching an existing on-prem Redis exactly during a lift-and-shift.

The cost is real: you own **failover** (Sentinel/Cluster setup), **patching/upgrades**, **backups**, **monitoring**, and **on-call**. That operational burden is exactly what Memorystore removes. So the honest answer in most interviews is "**use Memorystore unless you have a concrete feature (module/version/config) or scale-economics reason it can't meet** — and if you self-host, budget for the HA and maintenance work you've just taken on." Choosing self-hosted without such a reason is an anti-pattern.
## Observability: Cloud Operations

### Summary

**What this topic covers**

Google Cloud's built-in observability stack — formerly branded **Stackdriver**, then the **Cloud Operations suite**, now **Google Cloud Observability** — and how it maps onto the three pillars of observability: **metrics** (Cloud Monitoring), **logs** (Cloud Logging), and **traces** (Cloud Trace). Around those three sit the higher-level products: **Error Reporting** (aggregates exceptions), **Cloud Profiler** (continuous CPU/heap profiling), **SLO monitoring** (SLIs, error budgets, burn-rate alerts), and the **Ops Agent** you install on VMs to get memory, disk, and app metrics that the hypervisor can't see. This topic's 16 questions run from "what are the three pillars and which product serves each" through alerting-policy design, log routing/sinks and cost control, audit logs, and a senior scenario where you correlate a latency spike across all three signals. The recurring theme: observability is a first-class, mostly-managed platform on GCP, but log volume and Data Access audit logs make it a real line item you must engineer for cost, not just switch on.

**Mental model**

Think of it as **collect → route → analyze → alert**, with three parallel pipelines. Metrics are time-series (a metric type + labels + points) that Cloud Monitoring scrapes or receives; you query them with **MQL** or **PromQL** and watch them on dashboards, uptime checks, and alerting policies. Logs are structured JSON entries that flow into the **Log Router**, which evaluates **sinks** — every log first hits the `_Default` and `_Required` buckets, and you add sinks to export elsewhere (BigQuery for SQL analysis, Cloud Storage for cheap archive, Pub/Sub for streaming to third parties) or exclusion filters to drop noise before you pay to store it. Traces are spans stitched into a request timeline. The senior mental shift: these are not three separate tools you check in isolation — an incident is a *correlation* exercise. A metric alert ("p99 latency up") sends you to traces (which span got slow) and logs (what error that service logged at that trace ID). Design your telemetry so that pivot is one click: consistent labels, trace context propagated, log-based metrics bridging logs into the metrics world.

**Key terms**

- **Cloud Monitoring** — metrics, dashboards, uptime checks, and alerting policies; the metrics pillar (≈ CloudWatch metrics).
- **Metrics scope** — a Monitoring project that can read metrics from multiple monitored projects, giving one pane of glass across an org.
- **MQL / PromQL** — Monitoring Query Language and the Prometheus query language; both query time-series, with Managed Service for Prometheus bridging the ecosystems.
- **Cloud Logging** — centralized log ingestion, storage in **log buckets**, and the **Logging query language**; the logs pillar (≈ CloudWatch Logs).
- **Log Router / sink** — routes every entry; sinks export to BigQuery/Cloud Storage/Pub/Sub or to other buckets; exclusion filters drop entries pre-storage.
- **`_Required` vs `_Default` bucket** — `_Required` holds admin/audit logs for 400 days and can't be modified; `_Default` holds everything else, 30-day default retention.
- **Log-based metric** — a counter or distribution metric derived from matching log entries; bridges logs into Monitoring/alerting.
- **Cloud Trace** — distributed tracing and latency analysis across services (≈ X-Ray).
- **Error Reporting / Cloud Profiler** — automatic exception grouping; continuous statistical profiling of CPU and memory.
- **Cloud Audit Logs** — Admin Activity (always on, free) vs Data Access (opt-in, high volume); GCP's answer to AWS CloudTrail.
- **SLI / SLO / error budget** — the indicator, the target, and the allowable failure headroom that drives burn-rate alerting.
- **Ops Agent** — the unified agent on Compute Engine VMs that ships guest metrics (memory, disk, swap) and application logs.

**Why interviewers ask this**

Observability separates people who *deploy* systems from people who *operate* them. A junior answer names the products ("we use Cloud Monitoring and Logging"). A senior answer reasons about signal-to-noise: how to design alerting policies that page on symptoms not causes, why alert fatigue kills on-call teams, how error budgets convert reliability from a vibe into a number you can spend. Interviewers also probe cost awareness — Cloud Logging bills on ingestion volume, and turning on **Data Access audit logs** naively can multiply your bill and drown real signal. Knowing to filter/exclude at the router, sample traces, and route to cheap storage is a strong senior signal. Finally, the correlation question ("latency spiked, walk me through the investigation") reveals whether you actually think in the three pillars or just stare at one dashboard.

**Common confusions**

- **"Stackdriver / Cloud Operations / Cloud Observability are different products"** — same stack, three names across rebrands. Use the current name but recognize all three.
- **"Logs are free"** — ingestion into Cloud Logging is billed by volume; the `_Required` bucket is free but `_Default` and custom buckets past the free tier are not. Exclusion filters cut cost.
- **"Audit logs are one thing you toggle"** — Admin Activity logs are always on and free; Data Access logs are off by default, per-service opt-in, and can be enormous.
- **"You get VM memory metrics for free"** — the hypervisor sees CPU/network/disk but **not** guest memory or disk-fill; you must install the **Ops Agent**.
- **"An SLO is just an uptime target"** — an SLO is an SLI measured against a target over a window, and its real value is the **error budget** it produces for alerting and release decisions.
- **"A sink stores logs"** — the Log Router *routes*; log **buckets** store. A sink points routed logs at a destination.

**What follows from this topic**

Observability is the feedback loop for everything else in this primer. It ties to **Compute** (Ops Agent on VMs, MIG autoscaling on custom metrics), **Networking** (uptime checks, LB logging), **Security** (audit logs feed Security Command Center), and **IaC/CI-CD** (dashboards and alerting policies as Terraform). The audit-logs discussion is the natural bridge into the security topic, and log-based metrics + SLOs connect straight into reliability engineering. If you can't observe it, you can't operate it — this is the topic that makes the rest runnable in production.

### Q1. What is Google Cloud Observability, and how does it map to the three pillars of observability?

**Google Cloud Observability** (formerly **Stackdriver**, then the **Cloud Operations suite**) is GCP's integrated, mostly-managed telemetry platform. It maps cleanly onto the three pillars:

- **Metrics → Cloud Monitoring** — numeric time-series (latency, QPS, CPU), dashboards, uptime checks, alerting.
- **Logs → Cloud Logging** — structured event records, searchable, routable, retainable.
- **Traces → Cloud Trace** — distributed request timelines across services for latency analysis.

On top sit **Error Reporting** (groups exceptions), **Cloud Profiler** (continuous CPU/heap profiling), and **SLO monitoring**. The AWS analogue is roughly CloudWatch (metrics + logs) + X-Ray (traces), but tighter-integrated and with a stronger SRE/SLO story out of the box.

The point of naming all three: real operations means *correlating* them. A metric tells you *something* is wrong; the trace tells you *where*; the log tells you *what*.

### Q2. Walk me through Cloud Monitoring — metric types, dashboards, and metrics scopes.

**Metrics** are time-series identified by a **metric type** (e.g. `compute.googleapis.com/instance/cpu/utilization`) plus **resource** and **metric labels**. Kinds:

- **GAUGE** — value at a point in time (CPU %, memory used).
- **DELTA** — change over an interval.
- **CUMULATIVE** — monotonically increasing counter (request count since start).

Value types are BOOL/INT64/DOUBLE/DISTRIBUTION — distributions power latency histograms and percentiles.

**Dashboards** are collections of charts built on those time-series; you build them in the console or as code (JSON / Terraform). **Uptime checks** probe an endpoint from multiple global locations and feed availability metrics + alerts.

**Metrics scope** is the senior concept: a Monitoring "scoping project" can read metrics from *many* monitored projects, giving one dashboard across an org without duplicating data. Set the scope up so an SRE team sees every service, not one project at a time.

### Q3. What query languages does Cloud Monitoring support, and when would you use each?

Two main options:

| | MQL | PromQL |
|---|---|---|
| Origin | Google's Monitoring Query Language | Prometheus |
| Best for | Complex GCP-native queries, joins across metrics | Teams already on Prometheus / k8s |
| Backing | Native Monitoring time-series | **Managed Service for Prometheus** |

**PromQL** matters because of **Google Cloud Managed Service for Prometheus** — a scalable, managed backend that ingests Prometheus metrics (via the managed collector or self-deployed) and lets you keep your existing PromQL queries, Grafana dashboards, and alerting rules while Google handles storage/scaling. For a Kubernetes shop this is usually the path of least resistance; MQL is for deep GCP-native analysis and metric math the console UI can't express.

### Q4. Explain alerting policies and notification channels. How do you avoid alert fatigue?

An **alerting policy** = one or more **conditions** (metric threshold, absence, forecast, or SLO burn rate) + a combining logic + **notification channels** (email, SMS, Slack, PagerDuty, Pub/Sub, webhook). When conditions hold for the configured duration, it opens an **incident** and notifies.

**Avoiding alert fatigue** is the senior half:

- **Alert on symptoms, not causes** — page on "users see errors / latency" (SLO burn), not "CPU is 80%". High CPU that isn't hurting anyone shouldn't wake someone.
- **Tie paging alerts to SLO burn rates** — fast-burn (budget gone in an hour) pages; slow-burn opens a ticket.
- **Use duration windows** to ride out transient blips.
- **Severity tiers** — page vs ticket vs dashboard-only. Not everything is a page.
- **Deduplicate/group** so one bad deploy is one incident, not fifty.

The failure mode: dozens of low-value CPU/disk alerts, on-call mutes the channel, then misses the real one.

### Q5. Describe Cloud Logging: log buckets, the `_Required` and `_Default` buckets, and retention.

Logs land in **log buckets** — regional storage containers. Two exist by default in every project:

- **`_Required`** — holds Admin Activity audit logs, System Event, and Access Transparency. **400-day** retention, **cannot** be modified or deleted, **free**.
- **`_Default`** — everything else not explicitly routed elsewhere. **30-day** default retention (configurable up to 3650 days), billed for storage beyond the free allotment.

You can create custom buckets with your own retention and route specific logs to them (e.g. a 7-day bucket for chatty debug logs, a 1-year bucket for security logs). Retention is set per bucket. Longer retention = more storage cost, so tier deliberately rather than blanket-keeping everything for a year.

### Q6. What is the Log Router, and how do sinks work? Give the common export destinations.

The **Log Router** receives *every* log entry and evaluates the sinks configured in the project/folder/org. A **sink** = an inclusion filter + a destination. Entries matching a sink's filter are exported there (a sink can also exclude).

Common destinations:

- **BigQuery** — for SQL analysis, dashboards, joining logs with other data. The default for "I need to query logs analytically."
- **Cloud Storage** — cheap long-term archive / compliance (write to a bucket, apply lifecycle rules).
- **Pub/Sub** — stream to a SIEM, Splunk, Datadog, or custom processing.
- **Another log bucket** — including cross-project aggregation.

```bash
gcloud logging sinks create errors-to-bq \
  bigquery.googleapis.com/projects/my-project/datasets/logs \
  --log-filter='severity>=ERROR'
```

Remember: the sink's service account needs write permission on the destination — a classic "sink created but nothing arrives" gotcha.

### Q7. How do you control Cloud Logging costs?

Logging bills primarily on **ingestion volume**, so control it at the front of the pipe:

- **Exclusion filters on the Log Router** — drop high-volume, low-value logs (health-check 200s, verbose debug) *before* they're ingested/stored. This is the biggest lever.
- **Don't blanket-enable Data Access audit logs** — they can dwarf everything else; enable per-service, per-need.
- **Right-size retention per bucket** — 7 days for debug, not 400.
- **Route to Cloud Storage for archive** instead of paying log-bucket storage for cold data.
- **Sample or reduce app log verbosity** at the source — the cheapest log is the one you never emit.

Anti-pattern: shipping `INFO`-level request logs for every health check from an autoscaled fleet, then wondering why Logging is your third-biggest bill.

### Q8. What are log-based metrics and when would you use them?

A **log-based metric** turns matching log entries into a Monitoring time-series. Two kinds:

- **Counter** — counts entries matching a filter (e.g. count of `"payment declined"` per minute).
- **Distribution** — extracts a numeric value from entries (e.g. latency parsed from a log field) into a histogram.

Use them to **alert on things that only appear in logs** — a specific exception string, a business event, an error code your app logs but doesn't emit as a metric. Once it's a metric, you get it on dashboards and in alerting policies with percentiles and rates.

Example: create a counter metric on `severity=ERROR AND jsonPayload.code="AUTH_FAIL"`, then alert when its rate crosses a threshold. It's the bridge from unstructured logs into the metrics/alerting world.

### Q9. Explain the Logging query language with a couple of examples.

The **Logging query language** filters entries by resource, severity, time, and payload fields. It's field-path based with boolean operators:

```
resource.type="cloud_run_revision"
severity>=ERROR
timestamp>="2026-01-01T00:00:00Z"
jsonPayload.status=500
```

Combine with `AND`/`OR`/`NOT`, substring `:` matching, comparisons, and regex via `=~`:

```
resource.type="gce_instance" AND
(jsonPayload.message=~"timeout" OR httpRequest.status>=500)
```

Key fields: `resource.type` / `resource.labels.*` (what emitted it), `severity`, `logName`, `httpRequest.*`, and `jsonPayload.*` / `textPayload` (your content). Senior tip: structure your app logs as JSON so you can filter on `jsonPayload` fields instead of regex-scraping a text blob — structured logging makes everything downstream (filters, log-based metrics, sinks) cleaner.

### Q10. What are Cloud Audit Logs, and what's the difference between Admin Activity and Data Access logs?

**Cloud Audit Logs** record *who did what, where, and when* on GCP resources — the CloudTrail equivalent. Four types, two you must know cold:

| | Admin Activity | Data Access |
|---|---|---|
| Records | Config/metadata changes (create VM, set IAM) | Reads/writes of *data* (read a GCS object, query BigQuery) |
| Default | **Always on**, can't disable | **Off by default** (except BigQuery), opt-in per service |
| Cost | Free | Billed — can be **very** high volume |
| Retention | 400 days (`_Required`) | Configurable |

(Also: **System Event** and **Policy Denied** logs.)

The senior point: Data Access logs are where compliance meets cost. You often *need* them for sensitive services (who read this PII bucket?) but enabling them fleet-wide without filtering can explode both your bill and your signal-to-noise. Enable selectively, route to a dedicated retained bucket, and exclude the rest.

### Q11. What is Cloud Trace and how does it help with latency analysis?

**Cloud Trace** is distributed tracing: it collects **spans** — timed segments of work — and stitches them into a **trace** representing one request's path across services. You see a waterfall of where time went: 20ms in the frontend, 150ms waiting on a downstream API, 300ms in a database call.

It's the pillar that answers *"where is the latency?"* A metric says p99 is up; the trace shows the specific hop that got slow. It auto-instruments some GCP runtimes (App Engine, and via OpenTelemetry elsewhere) and surfaces latency distributions, so you can spot a slow dependency or an N+1 fan-out.

Practical value: **trace context propagation** (the trace ID flows through headers) lets you link a slow trace to the exact log lines emitted during it — the metrics→traces→logs pivot in action. Sample traces (you rarely need 100%) to keep cost sane.

### Q12. What do Error Reporting and Cloud Profiler each give you?

**Error Reporting** automatically **aggregates and de-duplicates** exceptions/stack traces from your logs into grouped issues, with counts, first/last-seen, affected versions, and notifications on new error types. Instead of grepping logs for stack traces, you get a ranked list of "these are your top crashing errors." It's the "what's actually breaking" view.

**Cloud Profiler** is **continuous, low-overhead statistical profiling** in production — CPU time, wall time, heap allocation, contention — sampled across your running fleet with negligible overhead (~a few %). It shows flame graphs of where CPU and memory actually go, so you optimize the real hot path instead of guessing. Unlike a one-off local profiler, it runs continuously against real traffic, so you catch regressions between releases.

Together: Error Reporting for correctness/crashes, Profiler for efficiency/cost. Both are "always-on" and near-free to enable.

### Q13. Explain SLIs, SLOs, and error budgets, and how they drive alerting.

- **SLI (Service Level Indicator)** — a measured signal of user-visible health, e.g. *proportion of requests served < 300ms with 2xx/3xx status*.
- **SLO (Service Level Objective)** — a target for that SLI over a window, e.g. *99.9% of requests good over 28 days*.
- **Error budget** — the allowed failure: 100% − SLO. At 99.9%, you may "spend" 0.1% (~43 min/month) of badness.

Cloud Monitoring has native SLO monitoring: define the SLI, the target, and it tracks budget consumption and **burn rate**.

Why it's powerful:

- **Burn-rate alerting** replaces threshold guessing — page on *fast burn* (budget gone in 1h → 14× burn), ticket on *slow burn*. This is symptom-based alerting done right.
- **Release decisions** — budget left → ship features; budget exhausted → freeze and fix reliability. It turns reliability into a shared number instead of an argument.

This is the SRE tie-in interviewers love.

### Q14. How do you correlate logs, metrics, and traces to debug a production latency spike?

The scenario answer. Walk the pillars in order:

1. **Metrics (detect + scope)** — an SLO burn / p99-latency alerting policy fires. Dashboard shows *which* service and *when* it started; correlate with a deploy or traffic change.
2. **Traces (localize)** — open Cloud Trace for the affected service in that window. The waterfall reveals the slow span — say, a downstream call or DB query that jumped from 20ms to 400ms.
3. **Logs (root cause)** — pivot from the slow trace to its logs via the shared **trace ID**; filter Logging on that trace/time and read what the service actually logged — a timeout, a retry storm, a lock, a bad query plan.
4. **Confirm + act** — Error Reporting shows a spiking exception; Profiler shows a CPU/heap change if it's compute-bound.

The enabler is **design**: propagate trace context, use structured logs with consistent labels, and keep dashboards/alerts pointed at symptoms. Without that, step 3's pivot is a manual grep and the investigation stalls.

### Q15. Why do Compute Engine VMs need the Ops Agent, and what does it collect?

Because the **hypervisor can only see the VM from outside**. It reports CPU utilization, network, and disk I/O — but it **cannot** see *inside* the guest OS. So **memory usage, swap, disk space used, per-process metrics, and application logs** are invisible until you install the **Ops Agent**.

The **Ops Agent** is the unified agent (it replaced the legacy separate Monitoring and Logging agents) that runs on the VM and ships:

- **Guest metrics** — memory, swap, disk utilization, processes.
- **Logs** — syslog, application logs, and structured logs to Cloud Logging.
- **Third-party integrations** — Nginx, MySQL, Redis, etc.

The classic gotcha: a VM runs out of memory and OOM-kills a process, but there was **no memory alert** because no Ops Agent was installed — the platform never saw guest memory. On managed products (Cloud Run, App Engine, GKE) this is handled for you; on raw VMs it's your job.

### Q16. Design an observability strategy for a multi-service application on GCP, balancing coverage and cost.

A layered, cost-aware design:

**Coverage (the three pillars):**
- **Metrics** — Cloud Monitoring; for a k8s/Prometheus shop use **Managed Service for Prometheus** to keep PromQL/Grafana. Install the **Ops Agent** on any raw VMs for memory/disk.
- **Traces** — instrument every service with **OpenTelemetry → Cloud Trace**, propagating trace context end-to-end. **Sample** (e.g. 1–10%, higher for errors) rather than 100%.
- **Logs** — **structured JSON** logs everywhere so downstream filtering and log-based metrics work.

**Org structure:**
- A **metrics scope** in a central monitoring project for one pane of glass across service projects.
- **Aggregated log sinks** at the folder/org level routing security/audit logs to a dedicated retained bucket.

**Alerting:**
- Define **SLOs** per service; page on **burn-rate**, ticket on slow burn, everything else dashboard-only. Route via notification channels to on-call (PagerDuty/Slack).

**Cost control:**
- **Exclusion filters** drop health-check and debug noise before ingestion.
- **Tiered retention** — short for debug buckets, long only for audit/security.
- Enable **Data Access audit logs** selectively, not fleet-wide.
- Archive cold logs to **Cloud Storage** with lifecycle rules; sample traces.

**Manage as code** — dashboards, alerting policies, SLOs, and sinks in Terraform, so observability ships with the service, not bolted on after an incident.

## Security Services: Cloud KMS, Secret Manager, Cloud Armor, IAP & more

### Summary

**What this topic covers**

The dedicated security services that sit *alongside* IAM to give you encryption, secret management, network/application protection, zero-trust access, and posture management on GCP. IAM answers *who can do what*; these services answer *how is data protected, how are secrets stored, how are apps shielded from attack, and how do you prove the whole thing is secure*. The 16 questions span **Cloud KMS** (keys, versions, rotation, CMEK, HSM, EKM) and **envelope encryption**; **Secret Manager** (versions, rotation, access from Cloud Run/GKE); **Cloud Armor** (WAF + DDoS on the external load balancer); **Identity-Aware Proxy (IAP)** and the BeyondCorp zero-trust model; **VPC Service Controls** (data-exfiltration perimeters — a GCP-distinctive control); **Security Command Center** (CSPM + threat detection); **Binary Authorization** (only trusted images run); **Cloud DLP / Sensitive Data Protection**; **org policy constraints**; and **Workload Identity** as a security posture over service-account keys. The through-line: layered defense — encryption at rest and in transit, least privilege, secrets never in code, attack surface shielded at the edge, and continuous posture visibility.

**Mental model**

Think in **layers of defense**, each a different service. **Data at rest** — everything on GCP is encrypted by default with Google-managed keys; you upgrade control with **CMEK** (your key in KMS) or **CSEK/EKM** (your key material, even off-platform). Under the hood it's **envelope encryption**: data is encrypted with a data key, and the data key is encrypted by a key-encryption key in KMS. **Secrets** (API keys, DB passwords) don't belong in code or env-var configs — they live in **Secret Manager**, versioned and IAM-controlled, fetched at runtime. **The network edge** — the external Application Load Balancer fronts your app, and **Cloud Armor** applies WAF rules, OWASP protection, rate limiting, and DDoS absorption before traffic reaches you. **Access** — instead of a VPN, **IAP** brokers per-request, identity-and-context-aware access (BeyondCorp: trust the identity + device, not the network location). **Blast-radius containment** — **VPC Service Controls** draw a perimeter so even a valid credential can't exfiltrate BigQuery/GCS data to a project outside the boundary. **Posture** — **Security Command Center** continuously scans for misconfigurations and threats. No single control is sufficient; you compose them.

**Key terms**

- **Cloud KMS** — managed key management: key rings → keys → key versions; symmetric/asymmetric; software, **Cloud HSM** (FIPS 140-2 L3), or **EKM** (external) protection levels.
- **CMEK** — Customer-Managed Encryption Keys: you own the KMS key that encrypts a service's data (GCS, BigQuery, disks, etc.).
- **Envelope encryption** — data encrypted by a DEK, DEK encrypted by a KEK in KMS; the pattern behind default encryption at rest.
- **EKM / Cloud HSM** — External Key Manager (key stays with a third-party/on-prem HSM) and Google's managed HSM.
- **Secret Manager** — versioned secret store with IAM access control and rotation, replacing secrets-in-code.
- **Cloud Armor** — WAF + DDoS protection attached to the external Application Load Balancer; security policies, preconfigured OWASP rules, rate limiting, **Adaptive Protection**.
- **Identity-Aware Proxy (IAP)** — context-aware, zero-trust access to apps and VMs without a VPN; the BeyondCorp implementation.
- **VPC Service Controls** — service perimeters that stop data exfiltration of managed-service data across a boundary.
- **Security Command Center (SCC)** — CSPM + threat detection; findings, Standard vs Premium/Enterprise tiers.
- **Binary Authorization** — deploy-time policy that only lets attested/trusted container images run on GKE/Cloud Run.
- **Sensitive Data Protection (Cloud DLP)** — discovers, classifies, and de-identifies PII/sensitive data.
- **Org policy constraints** — org/folder/project guardrails (e.g. disable SA key creation, restrict regions).

**Why interviewers ask this**

Security is where "it works" and "it's safe to run" diverge, and it's a strong seniority discriminator. Juniors list services; seniors reason about **defense in depth and blast radius** — *if this credential leaks, what stops the damage?* The answer weaves several of these controls together. Interviewers probe whether you know the GCP-distinctive controls (**VPC Service Controls**, **IAP/BeyondCorp**, **Workload Identity** over SA keys) rather than just generic "encrypt everything." They also test practical judgment: secrets in Secret Manager not env vars, CMEK when compliance demands key control (and the operational cost of managing keys), Cloud Armor on the *external* LB, org policies as preventive guardrails vs SCC as detective controls. Getting the layering and the tradeoffs right — control vs operational burden, prevention vs detection — is the senior signal.

**Common confusions**

- **"CMEK means Google can't see my key / it's more secure math"** — CMEK changes *who controls the key lifecycle*, not the crypto strength. Default encryption is already strong; CMEK is about control, compliance, and revocation.
- **"Secret Manager and KMS do the same thing"** — KMS manages *keys*; Secret Manager stores *secret values* (and uses KMS-grade encryption under the hood). Different jobs.
- **"Cloud Armor protects any VM/service"** — it attaches to the **external Application Load Balancer**; traffic must flow through that LB for the policy to apply.
- **"IAP is a VPN"** — it's the opposite: no network tunnel, per-request identity/context checks at Google's edge (zero trust / BeyondCorp).
- **"IAM prevents exfiltration"** — IAM controls *permissions*, not *data boundaries*. A user with legitimate BigQuery read can still copy data out — **VPC Service Controls** is what stops that.
- **"SCC Standard = SCC Premium"** — Standard gives basic findings; Premium/Enterprise adds threat detection (Event Threat Detection, Container Threat Detection), attack path, compliance reports.
- **"Workload Identity and Workload Identity Federation are the same"** — related but distinct: the former binds k8s SAs to Google SAs on GKE; the latter lets external identities (GitHub Actions, AWS) get GCP access keylessly.

**What follows from this topic**

This topic is the security spine tying the primer together. It builds on **IAM** (identities and roles that these controls constrain), **Networking** (Cloud Armor on the LB, VPC Service Controls around the VPC), and **Observability** (audit logs and log-based metrics feed SCC and threat detection). It feeds directly into **IaC/CI-CD**, where **Binary Authorization**, **Workload Identity Federation** for keyless CI, and **secrets in pipelines** live — security controls belong in the delivery pipeline, not bolted on after. Master the layering here and the "design a secure architecture" scenario in later topics answers itself.

### Q1. What is Cloud KMS, and how are key rings, keys, and key versions organized?

**Cloud KMS** is GCP's managed key-management service — it generates, stores, rotates, and controls access to cryptographic keys so you never handle raw key material. The hierarchy:

- **Key ring** — a regional (or global/multi-regional) grouping container for keys. Location-bound and can't be deleted.
- **Key (CryptoKey)** — a logical key with a purpose (encrypt/decrypt, sign/verify) and a rotation schedule.
- **Key version** — the actual cryptographic material. Rotation creates a *new version*; the key keeps a **primary** version for new encryptions while old versions remain to decrypt old data.

**Protection levels**: `SOFTWARE`, `HSM` (**Cloud HSM**, FIPS 140-2 Level 3), and `EXTERNAL`/`EXTERNAL_VPC` (**EKM** — key stays with an external manager).

```bash
gcloud kms keyrings create my-ring --location=us-east1
gcloud kms keys create my-key --keyring=my-ring \
  --location=us-east1 --purpose=encryption \
  --rotation-period=90d --next-rotation-time=...
```

Access is pure IAM: grant `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the key to the service account that needs it — and *only* that one.

### Q2. Explain default encryption at rest and envelope encryption on GCP.

**Everything on GCP is encrypted at rest by default** — GCS objects, persistent disks, BigQuery, everything — with Google-managed keys, at no extra cost or config. You cannot turn it off.

It works via **envelope encryption**:

1. Data is encrypted with a **DEK** (Data Encryption Key), typically AES-256.
2. The DEK is itself encrypted by a **KEK** (Key Encryption Key) held in KMS.
3. The encrypted DEK is stored next to the data; the KEK never leaves KMS.

To read data, the service asks KMS to unwrap the DEK, then decrypts. Benefits: the small KEK is what's protected/rotated in KMS (cheap), and rotating a KEK doesn't require re-encrypting all data — you just re-wrap DEKs. **CMEK** slots in by making *you* own the KEK in KMS, so you can rotate, disable, or destroy it and thereby cryptographically revoke access to everything it wraps.

### Q3. What is CMEK, and when would you choose it over Google-managed keys?

**CMEK (Customer-Managed Encryption Keys)** = you create and control the KMS key that a service uses to encrypt its data (GCS buckets, BigQuery datasets, persistent disks, Cloud SQL, Pub/Sub, and many more support it). Google still does the encrypting; *you* own the key lifecycle.

Choose CMEK when you need:

- **Compliance** — regulations requiring customer control of keys (finance, healthcare, gov).
- **Revocation** — disable/destroy the key to cryptographically render data inaccessible (crypto-shredding).
- **Rotation on your schedule** and centralized key policy/audit across services.
- **Separation of duties** — a security team controls keys independently of data owners.

The tradeoff is **operational burden**: if you disable or destroy a CMEK key (or lose access), the data it protects becomes **unreadable** — that's the point, but it's also a foot-gun. Default (Google-managed) keys are already strong; reach for CMEK when *control*, not crypto strength, is the requirement. **CSEK** (customer-*supplied*) and **EKM** (external) go further, keeping key material off-platform.

### Q4. What are Cloud HSM and External Key Manager (EKM)?

Both are **protection levels** for KMS keys that raise the control/assurance bar:

- **Cloud HSM** — keys are generated and used inside Google-managed, **FIPS 140-2 Level 3** hardware security modules. Same KMS API and IAM; the key material never exists in software. Use when a compliance regime mandates HSM-backed keys. Slightly higher cost per key/operation.
- **EKM (External Key Manager)** — the key material lives **outside Google**, in a supported third-party key manager (Thales, Fortanix, etc.) or your own. GCP calls out to it (over internet or via VPC for **EKM via VPC**) to perform crypto. This gives **hold-your-own-key** assurance — you can cut Google off from your data by withholding the key, satisfying the strictest "the cloud provider must never be able to decrypt our data" requirements.

Ladder of control: Google-managed → CMEK (software) → Cloud HSM → EKM. Each step adds control and operational responsibility.

### Q5. What is Secret Manager, and why use it instead of environment variables or a config file?

**Secret Manager** is a managed store for **secret values** — API keys, DB passwords, TLS private keys, tokens — with:

- **Versioning** — every secret has immutable versions; you reference `latest` or a pinned version and roll forward/back.
- **IAM access control** — grant `roles/secretmanager.secretAccessor` per secret to specific service accounts; least privilege at the secret level.
- **Rotation** — schedule rotation with Pub/Sub notifications to trigger your rotation logic.
- **Encryption** — encrypted at rest (optionally with CMEK), full **audit logging** of every access.

Why not env vars / config files:

- Env vars and baked config **leak** — into logs, crash dumps, `docker inspect`, source control, and process listings. No per-access audit, no rotation, no fine-grained IAM.
- Secret Manager gives you *who accessed which secret when*, central rotation, and revocation.

Berglas was the older community pattern; Secret Manager is the first-party answer. Fetch secrets **at runtime**, don't bake them into images.

### Q6. How do you access secrets from Cloud Run and GKE securely?

The principle: the workload authenticates as a **service account**, and that SA is granted `secretAccessor` on **only** the specific secrets it needs. No secret material in the image.

**Cloud Run** — two native options:

- **Mount as environment variable** or **as a file/volume** referencing a Secret Manager version directly in the service config. Cloud Run fetches it at deploy/start using the service's SA.

```bash
gcloud run deploy my-svc \
  --set-secrets=DB_PASSWORD=my-db-secret:latest
```

**GKE** — use **Workload Identity** so the pod's Kubernetes SA impersonates a Google SA with `secretAccessor`, then either call the Secret Manager API from the app or use the **Secret Manager CSI driver** to mount secrets as files. Avoid storing them in plain Kubernetes Secrets (base64, not encrypted by default) where possible.

Common anti-patterns to call out: baking secrets into the container image, committing them to Git, or granting `secretAccessor` at the project level instead of per-secret.

### Q7. Explain Cloud Armor. What protections does it provide and where does it attach?

**Cloud Armor** is GCP's **WAF and DDoS protection**, attached to the **external Application Load Balancer** (and, at the edge, backed by Google's global network that absorbs volumetric DDoS). Traffic must pass through that LB for policies to apply.

A **security policy** is a set of prioritized rules matched on IP/CIDR, geo, headers, or expressions, with actions `allow` / `deny(403/404/502)` / `throttle` / `rate-based-ban`:

- **DDoS protection** — always-on L3/L4 volumetric absorption via Google's edge; L7 protections in the policy.
- **Preconfigured WAF rules** — OWASP Top 10 signatures (SQLi, XSS, LFI/RFI, RCE) you enable by reference with tunable sensitivity.
- **Rate limiting / rate-based bans** — throttle or temporarily ban clients exceeding a request rate (per IP/key).
- **Adaptive Protection** — ML-based detection of anomalous L7 attack patterns with suggested mitigation rules.
- **Edge security policies** for cached content on Cloud CDN.

```bash
gcloud compute security-policies rules create 1000 \
  --security-policy=my-policy \
  --expression="evaluatePreconfiguredExpr('sqli-v33-stable')" \
  --action=deny-403
```

Key exam point: it protects what's behind the **external HTTP(S) LB** — not arbitrary VMs reachable directly.

### Q8. What is Identity-Aware Proxy (IAP), and how does it implement zero-trust / BeyondCorp?

**IAP** brokers access to your applications and VMs based on **identity and context**, not network location. It sits in front of App Engine, Cloud Run, GCE/GKE behind a load balancer, and even TCP (SSH/RDP) via **IAP TCP forwarding**. Every request is intercepted and only forwarded if the user is authenticated and **authorized** (`roles/iap.httpsResourceAccessor`), optionally gated by **context-aware access** (device posture, IP range, region).

This is Google's **BeyondCorp** model — **zero trust**:

- **No VPN**. There's no network tunnel; trust is established per-request from the *identity + device context*, not from being "inside the network."
- The internal network is not implicitly trusted — a request from inside the VPC gets no free pass.

Practical wins: expose an internal admin app to the internet safely (auth enforced at Google's edge before traffic reaches the app), grant contractors scoped access without VPN accounts, and SSH to VMs with **no public IP** via IAP tunneling. It shrinks attack surface dramatically versus "put it behind the VPN."

### Q9. What are VPC Service Controls and what problem do they solve?

**VPC Service Controls (VPC-SC)** draw a **service perimeter** around a set of projects and managed services (BigQuery, Cloud Storage, etc.) to prevent **data exfiltration** — the risk IAM alone can't address.

The problem: IAM controls *permissions*, not *data boundaries*. A user or service account with a **legitimate** `bigquery.dataViewer` role can still copy data to a personal project, or a leaked credential can pull GCS objects out to the internet. IAM says "yes, you may read" — it has no concept of "but only from inside this boundary."

VPC-SC adds that boundary: API calls to protected services are only allowed if they originate from **inside the perimeter** (specific projects, VPC networks, or via configured **ingress/egress rules** and **access levels**). A stolen credential used from outside the perimeter is rejected even though IAM would allow it.

```
Perimeter { projects: [acme-data-prod], services: [bigquery, storage] }
→ read from acme-data-prod ✓
→ same identity reading from attacker-project ✗ (blocked by perimeter)
```

It's a **GCP-distinctive control** interviewers love because it demonstrates you understand exfiltration ≠ access control.

### Q10. What is Security Command Center, and what's the difference between Standard and Premium?

**Security Command Center (SCC)** is GCP's centralized **security and risk platform** — CSPM (Cloud Security Posture Management) plus threat detection. It aggregates **findings** across your org: misconfigurations, vulnerabilities, and active threats, with asset inventory and attack-path analysis.

| | Standard | Premium / Enterprise |
|---|---|---|
| Cost | Free | Paid |
| Security Health Analytics | Basic misconfig checks | Full CSPM + managed benchmarks (CIS) |
| Threat detection | — | **Event Threat Detection**, **Container Threat Detection**, VM Threat Detection |
| Attack path / exposure | — | Attack path simulation, risk scoring |
| Compliance reports | — | CIS/PCI/NIST mapping |
| Vuln scanning | — | Web Security Scanner, etc. |

**Standard** gives baseline posture findings (public buckets, open firewall rules, over-privileged SAs). **Premium/Enterprise** adds *active threat detection* — it consumes Cloud Audit Logs and telemetry to flag things like crypto-mining, anomalous IAM grants, or data exfiltration attempts, plus attack-path analysis and compliance dashboards. For any regulated workload, Premium is effectively table stakes.

### Q11. What is Binary Authorization and how does it fit a secure deployment pipeline?

**Binary Authorization** is a **deploy-time gate** that ensures only **trusted container images** run on GKE, Cloud Run, and Anthos. You define a **policy** requiring images to carry **attestations** — cryptographic signatures asserting the image passed required steps (built by your trusted CI, vulnerability-scanned, passed tests). At deploy, the admission controller verifies the attestations against the policy and **blocks** anything unsigned or from an untrusted source.

How it fits the pipeline:

1. CI (Cloud Build) builds the image and pushes to **Artifact Registry**.
2. A vulnerability scan runs; on pass, an **attestor** signs an attestation with a KMS key.
3. On deploy, Binary Authorization checks the attestation — no valid signature, no deploy.

This stops **untrusted or tampered images** — e.g. someone `kubectl apply`-ing a random public image, or a compromised build artifact — from reaching production. Combined with **Workload Identity** and **VPC-SC**, it's a core supply-chain-security control. Policies support `dryrun` mode so you can observe before enforcing.

### Q12. What is Cloud DLP / Sensitive Data Protection, and where would you use it?

**Sensitive Data Protection** (formerly **Cloud DLP**) discovers, classifies, and de-identifies **sensitive data** — PII like names, emails, credit-card and national-ID numbers, credentials — across BigQuery, Cloud Storage, Datastore, and arbitrary content you send it. It ships 150+ built-in **infoTypes** plus custom detectors.

Two main jobs:

- **Discovery / classification** — scan data stores to find *where* sensitive data lives and generate risk findings (feeds compliance and SCC). Answers "do we have unprotected PII in this bucket/table?"
- **De-identification** — transform data in-flight or at rest: **masking**, **tokenization / format-preserving encryption**, **redaction**, **date shifting**, and **k-anonymity/l-diversity** risk analysis. Used to safely share or analyze data without exposing raw PII.

Typical uses: scrub PII from logs before storage, de-identify a production dataset before copying it to a test project, or gate an ingestion pipeline that redacts credit-card numbers before they land in the warehouse.

### Q13. What are org policy constraints, and how do they differ from IAM?

**Organization Policy constraints** are **guardrails** applied at the org, folder, or project level that restrict *what configurations are allowed* — regardless of who has IAM permission. They're **preventive** controls on resource *shape*, not on identity.

The distinction from IAM:

- **IAM** — *who* can do *what* (grant `compute.instances.create` to alice).
- **Org policy** — *what is permitted at all*, e.g. even a Project Owner **cannot** create a VM with an external IP if a constraint forbids it.

High-value examples:

- `iam.disableServiceAccountKeyCreation` — block long-lived SA keys org-wide (push people to Workload Identity).
- `compute.vmExternalIpAccess` — deny public IPs on VMs.
- `gcp.resourceLocations` — restrict resource creation to approved regions (data residency).
- `iam.allowedPolicyMemberDomains` — only allow members from your domain (block external sharing).
- `storage.publicAccessPrevention` — prevent public buckets.

They inherit down the hierarchy and are the primary way to enforce **secure-by-default** at scale, complementing IAM (permissions) and SCC (detection).

### Q14. How is data encrypted in transit on GCP?

Multiple layers, mostly automatic:

- **Google-internal traffic** — data moving between Google services and within Google's network is **encrypted in transit by default** (at one or more network layers), including cross-datacenter traffic on the private backbone.
- **User → Google front end** — terminate **TLS** at the **external Load Balancer / Google Front End**; use Google-managed or self-managed certs, enforce modern TLS via SSL policies, redirect HTTP→HTTPS.
- **Within your VPC / to backends** — you control this: HTTPS/mTLS to backends, and for service-to-service, **mTLS via a service mesh** (Anthos Service Mesh / Istio) gives automatic mutual TLS and identity between workloads.
- **Private connectivity** — **Private Google Access**, **Private Service Connect**, and VPN/Interconnect keep traffic off the public internet; Interconnect can be paired with MACsec.

Senior point: "encrypted in transit" isn't one switch — Google handles its backbone, you're responsible for TLS termination policy and backend/service-to-service encryption. Combine with encryption at rest (KMS/CMEK) for end-to-end coverage.

### Q15. Why is Workload Identity a better security posture than service account keys?

**Service account keys** are long-lived JSON files containing a private key. They're a top source of breaches because they:

- **Never expire** unless you rotate them, and are easily leaked (committed to Git, pasted in CI configs, left in images).
- Are **bearer credentials** — whoever holds the file *is* the service account, from anywhere.
- Are hard to audit and rotate at scale.

**Workload Identity** eliminates the key file:

- **Workload Identity (GKE)** — binds a Kubernetes service account to a Google service account; pods get **short-lived, auto-rotated tokens** via the metadata server. No key to leak.
- **Workload Identity Federation** — lets **external** identities (GitHub Actions, GitLab, AWS, any OIDC provider) impersonate a Google SA using their *own* short-lived tokens — **keyless CI/CD auth**, no downloaded SA key.

The posture win: no long-lived secret exists to steal, credentials are short-lived and automatically rotated, and access is tied to a verifiable identity/context. Pair it with the org policy `disableServiceAccountKeyCreation` to *prevent* anyone from creating keys in the first place — that's the senior move.

### Q16. Design a layered (defense-in-depth) security architecture for a public web application handling sensitive data.

Compose the controls in layers; no single one is sufficient:

**Edge / network:**
- Front with the **external Application Load Balancer** + **Cloud Armor** — OWASP WAF rules, rate limiting, **Adaptive Protection**, geo/IP rules, always-on DDoS absorption.
- Terminate **TLS** at the LB, HTTP→HTTPS, modern SSL policy.

**Access / identity:**
- Put internal/admin surfaces behind **IAP** (zero-trust, context-aware, no VPN).
- Least-privilege **IAM** with predefined/custom roles; **no basic roles**; **Workload Identity / Workload Identity Federation** instead of SA keys; org policy `disableServiceAccountKeyCreation`.

**Data protection:**
- Encryption at rest with **CMEK** in **Cloud KMS** (Cloud HSM/EKM if compliance demands); enable revocation.
- **Secret Manager** for all secrets, per-secret `secretAccessor`, fetched at runtime — nothing in images or Git.
- **Sensitive Data Protection (DLP)** to discover/classify PII and de-identify it before it reaches logs/analytics.

**Blast-radius containment:**
- **VPC Service Controls** perimeter around data services (BigQuery/GCS) so a leaked credential can't exfiltrate.
- Private IPs only (org policy denies external IPs), **Private Service Connect** for service access.

**Supply chain / deploy:**
- **Binary Authorization** so only scanned, attested images run; images from **Artifact Registry** with vulnerability scanning.

**Posture / detection:**
- **Security Command Center Premium** for CSPM + threat detection + attack-path analysis.
- **Org policy constraints** as preventive guardrails; **Cloud Audit Logs** (incl. selective Data Access) feeding SCC and alerting.

The narrative for the interviewer: **prevent** (org policy, IAM, Binary Authz), **protect** (KMS, Secret Manager, TLS, DLP), **contain** (VPC-SC, private networking), **shield** (Cloud Armor, IAP), and **detect** (SCC, audit logs) — assume any one layer fails and make sure another catches it.

## Infrastructure as Code & CI/CD

### Summary

**What this topic covers**

How you **provision GCP infrastructure declaratively** and how you **build, test, and ship** applications onto it — the automation layer that turns "click-ops in the console" into repeatable, reviewable, version-controlled delivery. The 16 questions span **Infrastructure as Code** (why it matters, **Terraform** as the de-facto standard with the `google` provider, remote state in a GCS backend with locking, modules, workspaces, plan/apply, importing existing resources) and the deprecated **Deployment Manager**; the **Kubernetes-native** options — **Config Connector** (GCP resources as k8s CRDs) and **Config Sync / Anthos Config Management** (GitOps); and the **CI/CD** stack — **Cloud Build** (pipelines, triggers, `cloudbuild.yaml`, substitutions, private pools, pushing images to **Artifact Registry**), **Cloud Deploy** (managed continuous delivery with delivery pipelines, targets, promotion, approvals, rollbacks, canary), **Skaffold** for GKE, deployment strategies (rolling/blue-green/canary), **Binary Authorization** in the pipeline, **secrets in pipelines** (Secret Manager, not baked in), and **Workload Identity Federation** for keyless CI auth. The theme: everything as code, promoted through environments with policy gates and no long-lived credentials.

**Mental model**

Split it into two loops that meet at the artifact. The **infra loop**: describe desired state in **Terraform**, store state remotely in **GCS with locking**, `plan` to preview the diff, `apply` to converge reality — review it like code, modularize for reuse, separate environments by project/workspace. Terraform *provisions the platform*. The **app loop**: **Cloud Build** (or GitHub Actions) builds and tests on every commit, produces an immutable container **pushed to Artifact Registry**, and then **Cloud Deploy** *promotes* that one artifact through a **delivery pipeline** — dev → staging → prod — with approvals, canary rollouts, and one-click rollback. The two loops meet because CI produces an artifact and CD deploys it, while IaC created the targets it deploys to. The senior overlay: **no manual steps and no long-lived keys** — CI authenticates via **Workload Identity Federation** (keyless), secrets come from **Secret Manager** at runtime, and **Binary Authorization** ensures only attested artifacts run. Config that lives in Git can be reviewed, audited, rolled back, and reproduced; config that lives in someone's console session cannot.

**Key terms**

- **Terraform** — HashiCorp's declarative IaC tool; the `google`/`google-beta` provider manages GCP; the de-facto standard over Deployment Manager.
- **Remote state / backend** — Terraform state stored in a **GCS bucket** with **state locking** (via GCS object generation) so teams don't corrupt state concurrently.
- **Module / workspace** — reusable parameterized Terraform packages; workspaces (or separate state) isolate environments.
- **Deployment Manager** — GCP's native, now **deprecated** YAML/Python IaC service; Terraform is recommended instead.
- **Config Connector** — GKE add-on that manages GCP resources as **Kubernetes CRDs** (`kubectl apply` a `SQLInstance`).
- **Config Sync / Anthos Config Management** — **GitOps**: continuously reconcile cluster/GCP config from a Git repo.
- **Cloud Build** — serverless CI/CD build service; steps in `cloudbuild.yaml`, **triggers**, **substitutions**, **private pools**.
- **Artifact Registry** — successor to Container Registry; stores container images and language packages, with **vulnerability scanning**.
- **Cloud Deploy** — managed continuous delivery: **delivery pipeline** → **targets**, promotion/approvals, canary, rollback.
- **Skaffold** — build/deploy tool for Kubernetes dev loops; underpins Cloud Deploy's GKE renders.
- **Workload Identity Federation** — keyless auth for external CI (GitHub Actions, etc.) to GCP via short-lived tokens.
- **Deployment strategies** — rolling, blue-green, canary (via MIGs, Cloud Run traffic splitting, or GKE).

**Why interviewers ask this**

IaC and CI/CD are where operational maturity shows. A junior can deploy by clicking; a senior makes deployments **boring, repeatable, and reversible**. Interviewers probe whether you understand *why* state management and locking matter (corrupt state is a real outage), how to structure Terraform for teams (modules, environment separation, no monolithic state file), and how to promote a *single immutable artifact* through environments rather than rebuilding per stage. They test the security overlay hard: **keyless CI** via Workload Identity Federation (not a downloaded SA key in a CI secret), **secrets from Secret Manager**, **Binary Authorization** gates. And they want deployment-strategy judgment — when canary beats blue-green, how you roll back, how you separate prod from dev by project. Weak answers describe tools; strong answers describe a **pipeline with gates, provenance, and rollback** and the tradeoffs at each step.

**Common confusions**

- **"Deployment Manager is the GCP-native way to do IaC"** — it's **deprecated**; Terraform (with the Google provider) is the recommendation, and Config Connector/Infrastructure Manager for k8s-native/managed needs.
- **"Terraform state is just a local file"** — for any team it must be **remote (GCS backend) with locking**; local state means conflicts, drift, and lost infrastructure.
- **"Container Registry and Artifact Registry are interchangeable"** — Container Registry is **deprecated/shut down**; Artifact Registry is the successor (more formats, per-repo IAM, regional, scanning).
- **"Cloud Build and Cloud Deploy do the same thing"** — Cloud Build is **CI** (build/test/produce artifact); Cloud Deploy is **CD** (promote that artifact through environments with approvals/rollback).
- **"CI needs a service-account key"** — external CI should use **Workload Identity Federation** for short-lived keyless tokens; a downloaded SA key in a CI secret is the anti-pattern.
- **"Rebuild the image per environment"** — you **promote the same immutable artifact**; rebuilding per stage means dev-tested ≠ prod-shipped.
- **"GitOps is just CI/CD"** — GitOps (**Config Sync**) *continuously reconciles* actual state to Git, correcting drift, not just applying on push.

**What follows from this topic**

This is the delivery backbone that operationalizes the whole primer. It consumes **Security** (Workload Identity Federation, Binary Authorization, Secret Manager, org policies as policy-as-code), targets **Compute** (GKE, Cloud Run, MIGs) with the deployment strategies each supports, provisions **Networking** and data services, and should emit **Observability** as code (dashboards, alerting policies, SLOs in Terraform). Getting IaC + CI/CD right is what lets every other capability in this primer be created reproducibly, reviewed, and rolled back — it's the difference between a design that exists in a diagram and one that ships safely, repeatedly, to production.

### Q1. Why use Infrastructure as Code on GCP?

**IaC** means describing your infrastructure — projects, networks, GKE clusters, IAM, buckets — in version-controlled declarative files, then letting a tool converge reality to that description. The wins:

- **Reproducibility** — spin up an identical staging or DR environment from the same code; no snowflake environments.
- **Version control + review** — infra changes go through PRs, code review, and history; you can see who changed the firewall rule and when, and revert it.
- **Drift detection & consistency** — the tool shows and corrects divergence from desired state; no undocumented console tweaks.
- **Auditability & compliance** — the repo *is* the audit trail; policy-as-code can gate changes.
- **Speed & safety** — automate provisioning and tear-down; couple with CI to test infra changes.

The alternative — **click-ops** in the console — is unrepeatable, unreviewable, and invisible: nobody knows why a resource exists or how to recreate it after an incident. On GCP, Terraform is the standard tool for this.

### Q2. Why is Terraform the de-facto IaC standard on GCP, and what happened to Deployment Manager?

**Terraform** dominates GCP IaC because it's:

- **Cloud-agnostic + huge ecosystem** — one tool/skillset across GCP, AWS, Azure, and hundreds of providers; teams already know it.
- **Mature `google` / `google-beta` provider** — comprehensive, fast-updated coverage of GCP resources, plus curated Google **Cloud Foundation Fabric** and module registry.
- **Strong workflow** — `plan` previews diffs, state tracks reality, modules enable reuse.

**Deployment Manager** was GCP's *native* IaC service (YAML + Jinja/Python templates) but is now **deprecated** — Google itself steers customers to Terraform, and offers **Infrastructure Manager** (a managed Terraform service) for a Google-hosted execution option. So the modern stack is: Terraform for general IaC, **Infrastructure Manager** to run it managed, and **Config Connector** when you want GCP resources managed Kubernetes-natively. Deployment Manager is legacy — mention it only to say you'd migrate off it.

### Q3. Explain Terraform remote state, the GCS backend, and state locking.

**State** is Terraform's record of what it manages — a JSON file mapping your config to real resource IDs. It must be shared and protected:

- **Remote state** — store it centrally, not on a laptop, so the whole team/CI works from one source of truth.
- **GCS backend** — Terraform's first-class GCP backend stores state in a **Cloud Storage bucket** (versioned, encrypted, optionally CMEK).
- **State locking** — the GCS backend locks automatically (using object generation/preconditions) so two concurrent `apply`s can't corrupt state — the second waits or fails.

```hcl
terraform {
  backend "gcs" {
    bucket = "acme-tfstate"
    prefix = "prod/network"
  }
}
```

Why it matters: **local state = disaster** — conflicts, lost tracking, and the classic "two engineers applied at once and mangled the state." Enable bucket **versioning** so you can recover a prior state, and lock the bucket down with tight IAM (state contains sensitive values).

### Q4. What are Terraform modules and workspaces, and how do you separate environments?

**Modules** are reusable, parameterized packages of Terraform — e.g. a `gke-cluster` module you instantiate with different variables. They enforce consistency (every cluster built the same way) and DRY. Use Google's registry modules or write your own; keep a thin root config that composes modules.

**Environment separation** — two common patterns:

| Approach | How | Best for |
|---|---|---|
| **Separate state per env** (recommended) | Distinct backend prefix/bucket + `.tfvars` per env, ideally **separate GCP projects** | Strong isolation, blast-radius control |
| **Workspaces** | One config, multiple named states (`terraform workspace new prod`) | Lightweight, similar envs |

The senior take: prefer **project-per-environment** (dev/staging/prod as separate GCP projects) with **separate state** — it gives real IAM/quota/billing isolation and a much smaller blast radius than one giant state file. Workspaces are handy but share the same config and can lull you into cross-env mistakes. Never keep prod and dev in one state file.

### Q5. How do you bring existing (click-ops) GCP resources under Terraform management?

Use **`terraform import`** (or `import` blocks in modern Terraform) to bind an already-existing resource to a Terraform resource address, so state starts tracking it — Terraform does **not** create it, just adopts it.

Workflow:

1. Write the resource block in config (matching the real resource).
2. `terraform import google_storage_bucket.my_bucket my-existing-bucket`.
3. `terraform plan` — reconcile: adjust config until the plan shows **no changes** (meaning config matches reality).
4. Repeat per resource; tools like `terraformer` can bulk-generate config/imports.

Gotchas: import brings *one* resource at a time (dependencies must be imported too), the generated/hand-written config must match exactly or `plan` will want to destroy/recreate, and you must import into the right state. For large estates, adopt incrementally by domain (network first, then IAM, then workloads) rather than big-bang.

### Q6. What are Config Connector and Config Sync / Anthos Config Management?

Both bring GCP management into the **Kubernetes / GitOps** world:

- **Config Connector** — a GKE add-on that lets you manage **GCP resources as Kubernetes CRDs**. You `kubectl apply` a `SQLInstance`, `StorageBucket`, or `PubSubTopic` manifest, and the controller reconciles the actual GCP resource. Great when your team already lives in Kubernetes and wants one control plane for app + infra.
- **Config Sync** (part of **Anthos Config Management**) — a **GitOps** engine that continuously **reconciles** cluster and GCP config from a Git repo. It doesn't just apply on push; it *watches* Git and *corrects drift*, enforcing that actual state always matches the repo. Add **Policy Controller** (OPA/Gatekeeper) for guardrails.

Together: Config Connector expresses GCP infra as k8s objects; Config Sync GitOps-manages those objects across fleets. The contrast with Terraform is push-based converge-on-apply (Terraform) vs continuous pull-based reconciliation (GitOps) — many orgs use Terraform for foundational infra and GitOps/Config Sync for cluster-scoped resources.

### Q7. Explain Cloud Build — its pipeline model, triggers, and substitutions.

**Cloud Build** is GCP's serverless CI/CD build service. A build is a sequence of **steps**, each a container that runs a command, sharing a `/workspace` volume:

```yaml
steps:
  - name: gcr.io/cloud-builders/go
    args: ['test', './...']
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/$PROJECT_ID/app/api:$SHORT_SHA', '.']
  - name: gcr.io/cloud-builders/docker
    args: ['push', '${_REGION}-docker.pkg.dev/$PROJECT_ID/app/api:$SHORT_SHA']
images: ['${_REGION}-docker.pkg.dev/$PROJECT_ID/app/api:$SHORT_SHA']
```

Key mechanics:

- **Triggers** — start builds on events: push/PR to a branch, tag, or on a schedule, wired to GitHub/GitLab/Cloud Source Repos.
- **Substitutions** — built-in vars (`$PROJECT_ID`, `$SHORT_SHA`, `$BRANCH_NAME`) and user vars (`${_REGION}`) parameterize builds.
- **Private pools** — run builds on a **private worker pool** inside your VPC to reach private resources (internal registries, VPC-only DBs) — the default pool can't.

It runs as a **service account**, so grant it least-privilege access to Artifact Registry, deploy targets, etc.

### Q8. When would you choose Cloud Build vs GitHub Actions?

Both are capable CI/CD; the choice is about ecosystem and integration:

| | Cloud Build | GitHub Actions |
|---|---|---|
| Best when | Deep GCP integration, code on Cloud Source / any repo | Code already on GitHub, rich marketplace |
| GCP auth | Native SA identity | **Workload Identity Federation** (keyless) |
| VPC access | **Private pools** reach VPC resources | Self-hosted runners for private access |
| Ecosystem | GCP-builders, simpler | Huge Actions marketplace |
| Billing | GCP build minutes | GitHub minutes |

Choose **Cloud Build** when you want tight, first-party GCP integration (private pools into your VPC, native SA identity, straight into Cloud Deploy/Binary Authorization). Choose **GitHub Actions** when your team lives on GitHub and wants its marketplace and PR ergonomics — but wire it to GCP with **Workload Identity Federation**, never a downloaded SA key. Many teams run Actions for CI (build/test) and hand off to **Cloud Deploy** for CD. It's not either/or.

### Q9. What is Cloud Deploy and how does its delivery pipeline model work?

**Cloud Deploy** is GCP's **managed continuous delivery** service. You define a **delivery pipeline** as a sequence of **targets** (environments — GKE clusters, Cloud Run services, or GKE fleets), and Cloud Deploy manages **promotion** of a single **release** through them:

- **Release** — an immutable, rendered version of your app (Skaffold renders the manifests per target). Built once, promoted everywhere.
- **Promotion** — advance the release dev → staging → prod along the pipeline.
- **Approvals** — require a manual gate before a target (typically prod).
- **Rollback** — one-click roll back to a previous release; Cloud Deploy tracks rollout history.
- **Canary** — built-in canary strategy: shift a percentage of traffic, verify, then full rollout.

```yaml
serialPipeline:
  stages:
    - targetId: dev
    - targetId: staging
    - targetId: prod
      strategy: { canary: { runtimeConfig: {...}, canaryDeployment: { percentages: [25, 50] } } }
```

The value over hand-rolled scripts: **provenance, approvals, consistent promotion, and audited rollback** as a managed service. CI (Cloud Build) produces the artifact; Cloud Deploy owns getting it safely to prod.

### Q10. What is Skaffold and where does it fit?

**Skaffold** is an open-source CLI that automates the **build → push → deploy** loop for Kubernetes. Locally it gives a fast inner dev loop (`skaffold dev` watches source, rebuilds, and redeploys to a cluster on save). Its config (`skaffold.yaml`) declares how to build images (Docker/Buildpacks/Bazel) and how to render/deploy manifests (kubectl, Helm, Kustomize).

Where it fits on GCP: **Cloud Deploy uses Skaffold under the hood** to render and deploy manifests per target. So Skaffold is both the local dev-loop tool *and* the rendering engine that makes a Cloud Deploy release reproducible across environments — the same `skaffold.yaml` renders dev, staging, and prod variants. Knowing this connects the local developer experience to the managed CD pipeline: what you run with `skaffold dev` is the same machinery Cloud Deploy runs in production.

### Q11. What is Artifact Registry, and how does it differ from Container Registry?

**Artifact Registry** is GCP's managed repository for **container images and language packages** (Docker/OCI, plus Maven, npm, Python, Go, apt/yum) — the **successor to Container Registry**, which is deprecated and being shut down.

Improvements over Container Registry:

- **More formats** — not just Docker; language and OS packages too.
- **Regional / multi-regional repos** — control where artifacts live (locality, data residency).
- **Per-repository IAM** — granular access per repo, vs GCR's coarse GCS-bucket-based permissions.
- **Vulnerability scanning** — integrated **Artifact Analysis** scans images for CVEs on push and continuously; feeds Binary Authorization attestations.
- **Cleanup policies** — auto-delete old/untagged versions to control cost.

```bash
gcloud artifacts repositories create app \
  --repository-format=docker --location=us-east1
# image path: us-east1-docker.pkg.dev/my-project/app/api:tag
```

Always target Artifact Registry for new work; migrating off Container Registry (the old `gcr.io` paths) is a common modernization task.

### Q12. How does Binary Authorization fit into the CI/CD pipeline?

**Binary Authorization** enforces that **only trusted, attested images deploy** — a deploy-time supply-chain gate. In the pipeline:

1. **Cloud Build** builds the image, runs tests, pushes to **Artifact Registry**.
2. **Artifact Analysis** scans for vulnerabilities; on pass, an **attestor** signs an **attestation** (a KMS-signed claim: "this digest passed scanning/tests/built-by-trusted-CI").
3. At deploy (GKE/Cloud Run), the **Binary Authorization admission controller** checks the policy — it requires attestations from the configured attestors for the image **digest**. No valid attestation → **deploy blocked**.

This stops untrusted or tampered images (a random public image, an unscanned build, a manually pushed artifact) from reaching prod. Use `dryrun` mode first to observe what *would* be blocked, then enforce. Combined with **Workload Identity** and immutable digests (not mutable tags), it gives strong deployment provenance — a core part of a secure delivery pipeline and a frequent "how do you secure your pipeline" answer.

### Q13. Compare rolling, blue-green, and canary deployment strategies on GCP.

| Strategy | How | Pros | Cons |
|---|---|---|---|
| **Rolling** | Replace instances incrementally | No extra infra, simple | Mixed versions during rollout, slower rollback |
| **Blue-green** | Stand up full new env, switch all traffic | Instant cutover + rollback | Double the resources briefly |
| **Canary** | Shift small % traffic, verify, ramp | Limits blast radius, real-signal validation | More orchestration/observability needed |

**How each maps to GCP compute:**

- **Managed Instance Groups (MIGs)** — rolling updates natively (`maxSurge`/`maxUnavailable`); blue-green via two MIGs behind an LB and swapping backends.
- **Cloud Run** — first-class **traffic splitting** by revision: deploy a new revision with `--no-traffic`, then shift `--to-revisions=NEW=10` for canary or `=100` for blue-green-style cutover.
- **GKE** — rolling updates by default (Deployments); canary/blue-green via multiple Deployments + a service mesh (Anthos Service Mesh) or **Cloud Deploy**'s canary strategy for weighted traffic.

Senior judgment: **canary** for high-risk prod changes where you can measure real user impact and auto-rollback on SLO burn; **blue-green** when you need instant, clean cutover/rollback and can afford duplicate capacity; **rolling** as the low-ceremony default for low-risk changes.

### Q14. How should secrets be handled in a CI/CD pipeline?

Never bake secrets into images, `cloudbuild.yaml`, or repo files. The right approach:

- **Store in Secret Manager**, fetch at build/deploy time as the pipeline's service account:

```yaml
availableSecrets:
  secretManager:
    - versionName: projects/my-project/secrets/npm-token/versions/latest
      env: 'NPM_TOKEN'
steps:
  - name: node
    entrypoint: npm
    args: ['ci']
    secretEnv: ['NPM_TOKEN']
```

- **Least privilege** — grant the build/deploy SA `secretAccessor` on only the specific secrets it needs.
- **Runtime injection, not image baking** — deliver secrets to the running service via Secret Manager (Cloud Run `--set-secrets`, GKE CSI driver), so they never live in the artifact.
- **No secrets in logs** — Cloud Build masks declared secrets; avoid `echo`-ing them.
- **Prefer keyless** — for cross-cloud/registry auth use **Workload Identity Federation** short-lived tokens over stored credentials.

The anti-pattern to flag: a DB password in an env var in the build config, or an SA key JSON committed as a CI secret — both leak and can't be rotated cleanly.

### Q15. How do you give CI/CD keyless access to GCP, and why does it matter?

Use **Workload Identity Federation (WIF)**. Instead of downloading a service-account **key** and pasting it into your CI secrets, WIF lets your external CI (GitHub Actions, GitLab, or any OIDC/SAML provider) exchange **its own short-lived OIDC token** for **short-lived GCP credentials** that impersonate a service account — **no key ever exists**.

How it works:

1. Create a **workload identity pool** + **provider** trusting your CI's OIDC issuer.
2. Grant the CI's identity permission to impersonate a least-privilege deploy SA, with attribute conditions (e.g. only `repo:acme/app:ref:refs/heads/main`).
3. CI presents its token; GCP validates it against the provider and issues a short-lived access token.

```yaml
# GitHub Actions
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/123/locations/global/workloadIdentityPools/gh/providers/gh-oidc
    service_account: deployer@my-project.iam.gserviceaccount.com
```

Why it matters: **long-lived SA keys are the #1 credential leak vector** — they never expire, get committed to Git, and grant standing access from anywhere. WIF eliminates the stored secret, scopes access by repo/branch, and issues auto-expiring tokens. Pair with the org policy `disableServiceAccountKeyCreation` to make keyless mandatory.

### Q16. How do you separate environments (dev/staging/prod) and test infrastructure code?

**Environment separation** — use **separate GCP projects per environment** (dev/staging/prod), which gives real isolation of IAM, quotas, billing, and blast radius, all under a folder hierarchy with inherited org policies. Back each with **separate Terraform state** (distinct GCS backend prefix) and per-env `.tfvars`; reuse the same **modules** so environments are structurally identical but independently deployable. Promote the *same* immutable artifact across them via Cloud Deploy — don't rebuild per stage.

**Testing IaC / policy-as-code:**

- **`terraform validate` + `fmt`** in CI for syntax/style; **`terraform plan`** on PRs so reviewers see the diff before merge.
- **Policy-as-code gates** — **Sentinel**, **OPA/Conftest**, or `gcloud terraform vet` (Config Validator) to enforce rules ("no public buckets", "only approved regions", "must have labels") *before* apply.
- **Preview environments** — `plan` (or apply to an ephemeral dev project) to catch drift and destructive changes.
- **Org policy constraints** as the runtime backstop even if a bad plan slips through.

The senior framing: infra changes flow through the **same PR/review/CI discipline as app code** — plan on PR, policy checks as required status, apply on merge via a pipeline using **Workload Identity Federation**, never a human running `apply` against prod from a laptop.
## Cost Optimization & Billing

### Summary

**What this topic covers**

How money actually flows on Google Cloud and how to keep the bill from surprising you. GCP's pricing model is genuinely different from a data centre or from a naive AWS mental model: billing is **per-second**, **sustained-use discounts are automatic**, and there is no upfront reservation you must buy to get a fair price. On top of that base sit the deliberate levers — **committed-use discounts**, **Spot VMs**, **right-sizing**, **storage class tiering**, and the two silent killers that dominate real bills: **network egress** and **BigQuery bytes scanned**. This topic's 15 questions walk from the pricing mindset, through the discount families, into storage/network/BigQuery cost control, the Cloud Billing tooling (budgets, exports, labels), and the anti-patterns that quietly leak money — forgotten external IPs, orphaned disks, un-tiered logs, always-on Cloud Run CPU, and cross-region chatter.

**Mental model**

Think of every GCP bill as three stacked layers. **Layer 1 — compute you asked for**: VMs, GKE nodes, Cloud Run instances. Here the discounts live (sustained-use is free and automatic; committed-use and Spot are opt-in). **Layer 2 — storage you accumulated**: Cloud Storage objects, persistent disks, snapshots, BigQuery active/long-term storage. This layer grows silently because nothing forces you to delete. **Layer 3 — data in motion**: egress to the internet, between regions, across zones, plus BigQuery query bytes and Pub/Sub throughput. Layer 3 is where engineers who "only provisioned a small VM" get a four-figure surprise. The FinOps discipline is: *make cost a first-class design constraint, not a month-end autopsy*. You attach **labels** to everything, **export billing to BigQuery**, set **budgets with alerts**, and let **Recommender** flag idle resources — so cost is observable the same way latency is.

**Key terms**

- **Sustained-use discount (SUD)** — automatic discount (up to ~30% on N-series) for running a VM a large fraction of the month; no commitment, no action.
- **Committed-use discount (CUD)** — you commit to 1yr or 3yr of spend or resources for a steep discount (up to ~57% compute, higher for memory-optimized). Two flavours: **resource-based** (specific vCPU/RAM in a region) and **spend-based** (a dollar/hour commitment, more flexible).
- **Spot VMs** — preemptible capacity at 60–91% off, can be reclaimed with 30s notice; the successor to "preemptible VMs" (which had a 24h cap; Spot has no max lifetime).
- **Recommender / Active Assist** — ML-driven recommendations: idle VM, idle disk, right-size machine type, idle Cloud SQL, unattached IP.
- **Autoclass** — Cloud Storage feature that auto-transitions objects between Standard/Nearline/Coldline/Archive based on access, avoiding manual lifecycle rules.
- **Egress** — data leaving a boundary; **internet egress** and **inter-region** cost money, **ingress is free**, **same-zone** internal is free, **cross-zone** internal is charged.
- **Network Service Tiers** — **Premium** (Google's global backbone, default) vs **Standard** (cheaper, uses public internet, region-scoped).
- **Billing export** — streaming your Cloud Billing detail into BigQuery for querying spend by label/service/SKU.
- **Budget & alert** — a threshold on a billing account or project that fires Pub/Sub/email at % of budget; it does **not** cap spend.
- **On-demand vs slots (BigQuery)** — pay per TB scanned vs buy dedicated compute capacity (Editions: Standard/Enterprise/Enterprise Plus) for predictable cost.

**Why interviewers ask this**

Cost is where senior engineers separate from juniors fastest. A junior can build something that works; a senior builds something that works *and* doesn't cost 10x what it should. Interviewers probe this to see whether you understand the *shape* of GCP pricing (do you know egress and BigQuery scan are the usual culprits, not the VM?), whether you reach for the right lever (CUD for steady baseline, Spot for fault-tolerant batch, SUD you get for free), and whether you'd instrument cost proactively (labels, budgets, billing export) rather than react to a bill. Getting "networking egress is often the biggest line item" and "BigQuery charges for bytes scanned, so partition and avoid SELECT *" right signals real operational scars, not just cert flashcards.

**Common confusions**

- "I have to buy reserved instances to get a good price" — no; **sustained-use discounts are automatic** and require zero commitment. CUDs are an *additional* lever on top.
- "Budgets stop spending" — they **don't**; a budget only alerts. To actually cap, you must wire the budget's Pub/Sub notification to automation that disables billing.
- "Ingress and egress both cost money" — **ingress is free**; egress (internet + inter-region + cross-zone) is what you pay for.
- "BigQuery is expensive because of storage" — usually it's the **queries** (bytes scanned) that dominate, not the cheap columnar storage.
- "Preemptible and Spot are the same" — Spot replaced preemptible; Spot has **no 24h maximum runtime**.
- "A stopped VM costs nothing" — the VM's vCPU/RAM stops billing, but its **persistent disk, reserved static IP, and snapshots keep charging**.

**What follows from this topic**

Cost never stands alone. It trades directly against **Architecture Framework, Reliability & Multi-Region DR** (multi-region and hot standby buy availability with money — you must justify the RTO/RPO you're paying for) and against the design choices in **Scenario Design & Common Pitfalls** (always-on Cloud Run CPU, single-zone-to-multi-region, over-broad BigQuery scans are all cost anti-patterns you must be able to spot on sight). Treat cost optimization as the fifth pillar of every design answer, not an afterthought.

### Q1. How does GCP's pricing model differ from a traditional reserved-instance model, and what do you get "for free"?

GCP's defaults are deliberately friendlier than the old buy-reservations-or-overpay model:

- **Per-second billing** (after a 1-minute minimum) on Compute Engine, GKE, Dataproc — you pay for what you use, not rounded-up hours.
- **Sustained-use discounts are automatic** — run a general-purpose (N-series) VM most of the month and Google applies up to ~30% off with no action from you. This is the big mental shift from AWS's "you must buy an RI/Savings Plan to get the discount."
- **No upfront** required for the base discount. Commitments (CUDs) are an *optional* extra lever, not a prerequisite for fair pricing.

So the baseline is: you already get a decent discount for steady usage without doing anything. The levers below (CUD, Spot, right-sizing) are how you go *further*. In an interview, leading with "sustained-use is automatic, so I don't need to reserve anything to get a fair price" immediately signals you understand GCP's model rather than porting AWS assumptions.

### Q2. Compare sustained-use discounts, committed-use discounts, and Spot VMs. When do you use each?

| Lever | Discount | Commitment | Reclaim risk | Best for |
|---|---|---|---|---|
| **Sustained-use (SUD)** | up to ~30% (N-series) | none, automatic | none | Any steady workload — you get it free |
| **Committed-use (CUD)** | up to ~57% compute (more for memory-optimized) | 1yr or 3yr | none | Predictable **baseline** capacity |
| **Spot VMs** | 60–91% off | none | preempted w/ 30s notice, any time | **Fault-tolerant** batch, CI, stateless workers |

**Decision rule:** Take SUD for free on everything. Cover your **steady baseline** (the floor of your usage graph) with **CUDs** for the deepest guaranteed discount. Run **fault-tolerant, interruptible** work (batch rendering, data processing, CI runners, GKE Spot node pools) on **Spot** for the biggest headline saving. The classic pattern is CUD for baseline + Spot for burst — never buy CUD for capacity you only need occasionally, and never put a stateful database on Spot.

### Q3. What's the difference between resource-based and spend-based committed-use discounts?

- **Resource-based CUD** — you commit to a specific quantity of **vCPUs and memory (or GPUs/local SSD) in a particular region** for 1 or 3 years. Deepest discount, least flexible: it's tied to a machine family and region. Good when your shape is stable and known.
- **Spend-based CUD** — you commit to a **dollar amount per hour** of spend on a service (e.g. Compute, Cloud SQL, or the flexible "Compute Flexible CUD"). Slightly less discount, far more flexible: it follows you across machine types and (for flexible CUDs) regions.

**Interview framing:** "If I know I'll run 100 vCPUs of N2 in `us-central1` for three years, resource-based gives the best rate. If I want the discount to survive a migration to a new machine family or region, I pay a little more for spend-based (flexible) CUDs for the portability." Senior candidates note that flexible CUDs reduce the risk of stranding a commitment when architecture changes.

### Q4. How do you find and eliminate waste from over-provisioned or idle resources?

Two workflows:

**Recommender / Active Assist** surfaces this automatically — idle VM, idle persistent disk, unattached external IP, idle Cloud SQL instance, and **machine-type right-sizing** recommendations based on actual CPU/RAM utilization. Pull these via the console, `gcloud recommender`, or the API and act on them regularly.

```bash
gcloud recommender recommendations list \
  --project=my-project --location=us-central1-a \
  --recommender=google.compute.instance.MachineTypeRecommender
```

**Manual hygiene** for what Recommender doesn't catch: unattached persistent disks (they bill even when detached), snapshot sprawl, forgotten static external IPs (a reserved-but-unused IP is billed precisely to discourage hoarding), stale dev environments left running overnight/weekends. Wire a scheduled job or org policy to catch these. The senior signal is treating cost cleanup as a *recurring process* with ownership, not a one-time cleanup.

### Q5. Walk through Cloud Storage cost optimization — storage classes, Autoclass, and the gotchas.

Cloud Storage has four classes, priced storage-cheap → retrieval-expensive as you go colder:

| Class | Use | Min storage duration | Retrieval cost |
|---|---|---|---|
| **Standard** | hot, frequent | none | free |
| **Nearline** | ~monthly access | 30 days | low |
| **Coldline** | ~quarterly | 90 days | higher |
| **Archive** | backup/compliance | 365 days | highest |

**The early-deletion trap:** each colder class has a **minimum storage duration**. Delete or overwrite a Coldline object after 10 days and you're still billed for the full 90. So lifecycle rules that move data too aggressively can *cost* money.

**Autoclass** solves the guessing: enable it on a bucket and GCP automatically moves each object between classes based on its own access pattern, with **no retrieval or early-deletion fees for the transitions**. It's the right default when access patterns are unpredictable; the trade-off is a small per-object management fee. For known patterns, hand-written **lifecycle rules** are cheaper.

### Q6. Why is network egress often the biggest surprise on a GCP bill, and how do you control it?

Because compute is visible and egress is invisible until the invoice. The rules:

- **Ingress is free.** **Same-zone** internal traffic is free.
- **Cross-zone within a region** internal traffic is **charged** (per GB).
- **Inter-region** traffic is charged, more for farther regions.
- **Internet egress** is charged and scales with volume; it's the classic culprit for chatty APIs and media serving.

**Controls:** keep chatty services in the **same zone** where possible; use **Cloud CDN** to serve static/media so egress is cached at the edge instead of billed from origin repeatedly; choose the **Standard network tier** for cost-insensitive, region-local traffic (cheaper, but no global backbone); keep **Premium tier** for global low-latency needs. Use **Private Google Access / Private Service Connect** so traffic to Google APIs stays internal rather than routing out and back. The senior move in a design interview: explicitly call out "where does data cross a zone/region/internet boundary?" as a cost review step.

### Q7. What's the difference between Premium and Standard network tiers, cost-wise?

- **Premium tier (default)** — traffic rides **Google's private global backbone** end-to-end; global load balancing and anycast IPs work; lowest latency and best reliability; **higher egress price**.
- **Standard tier** — traffic exits to the **public internet** at the region nearest the source; **cheaper egress**; only regional load balancing; latency and reliability depend on the public internet.

Use Premium for user-facing global apps where latency and a single global anycast IP matter. Use Standard for cost-sensitive, region-bound workloads (internal tools, region-local services) where you don't need the global backbone. You can even set tier per-resource. Interviewers like candidates who know network tier is a *cost knob*, not just a quality setting.

### Q8. BigQuery cost control is a classic interview topic — how do you keep query costs down?

BigQuery separates storage from compute, and two pricing models exist for the compute:

- **On-demand** — you pay **per TB scanned** (bytes read from the columns/partitions your query touches). Simple, but a runaway `SELECT *` on a huge table is expensive.
- **Capacity (slots / Editions)** — you buy dedicated compute (Standard/Enterprise/Enterprise Plus editions, with autoscaling and commitments). Predictable cost for heavy, steady workloads.

**Core cost-control levers (mostly for on-demand):**
- **Partition** tables (by date/ingestion time) and **cluster** them so queries prune to a slice instead of a full scan.
- **Never `SELECT *`** — columnar storage means you're billed only for the columns you read; naming columns can cut scan cost by 10x+.
- **Preview with the dry-run estimate** (`--dry_run` / the UI's "This query will process X bytes") before running.
- **Custom quotas** — cap bytes-scanned per user/project per day to prevent a single bad query from blowing the budget.
- **BI Engine** — in-memory acceleration for dashboards, reducing repeated scans.
- Use **materialized views** and **table expiration** to avoid re-scanning and to auto-clean scratch data.

The interview-winning line: "BigQuery bills bytes *scanned*, not rows returned — so partitioning, clustering, and avoiding `SELECT *` are the primary cost controls, and I'd set per-user custom quotas as a guardrail."

### Q9. When would you move a BigQuery workload from on-demand to slot-based (Editions) pricing?

When spend becomes **predictable and high**. On-demand's per-TB model is great for spiky, exploratory, or low-volume analytics — you pay nothing when idle. But once you have steady heavy usage (dashboards, scheduled ELT, many analysts), on-demand cost becomes both **high and volatile**.

Switching to **capacity pricing** (buy slots via Editions, optionally with 1yr/3yr commitments and autoscaling) gives you a **fixed, predictable** compute bill and isolates workloads into reservations so one team can't starve another. The break-even is roughly: model both against a month of real query bytes; if slots are cheaper and you value predictability, commit. Enterprise Plus adds features (cross-region DR, higher security). The senior answer names the trade: on-demand = pay-per-use + volatility; slots = fixed cost + capacity management overhead.

### Q10. How do you set up cost visibility and governance with Cloud Billing?

The toolkit:

- **Billing accounts** sit above projects; one billing account pays for many projects. This is your top-level cost boundary.
- **Budgets & alerts** — set a monthly budget on a billing account or project; get email/Pub/Sub notifications at 50/90/100% (and forecasted). Remember: **alerts only, no hard cap** — wire the Pub/Sub message to automation if you truly need to stop spend.
- **Billing export to BigQuery** — stream detailed usage + pricing into BigQuery so you can query spend by service, SKU, project, and **label**. This is the foundation of any real FinOps practice.
- **Cost Table & Reports** in the console — interactive breakdowns and trend charts without writing SQL.
- **Labels** — key/value tags on resources (`team:payments`, `env:prod`) that flow into the billing export so you can allocate cost per team/feature/environment.

The mature setup: label everything, export to BigQuery, build a spend dashboard (or use Looker Studio on the export), and set budgets per project. That turns cost from a surprise into a metric.

### Q11. How do labels help with cost allocation, and what's the discipline around them?

**Labels** are key/value pairs on resources that propagate into the **billing export**, letting you slice spend by `team`, `env`, `cost-center`, `service`, or `feature`. Without them, a shared project's bill is an undifferentiated blob and you can't answer "what does the payments team cost?"

The discipline:
- Define a **label taxonomy** up front (e.g. mandatory `team`, `env`, `app`).
- **Enforce** with organization policy / IaC so resources can't be created unlabelled.
- Query the billing export grouped by label to produce per-team showback/chargeback.

The interview signal: labels are a *governance* tool, not decoration. A senior answer mentions enforcing them via policy/Terraform because voluntary labelling always decays.

### Q12. What are the most common cost anti-patterns you look for in a GCP environment?

The usual suspects, in rough order of how often they bite:

- **Over-provisioned VMs/GKE nodes** — machine types sized for peak that runs at 10% — fix with right-sizing recommendations and autoscaling.
- **Forgotten external static IPs** — a reserved-but-unattached IP is billed specifically to discourage hoarding.
- **Orphaned persistent disks & snapshot sprawl** — detached disks and years of unmanaged snapshots keep billing.
- **Un-tiered logs** — everything shipped to Cloud Logging at full retention; route low-value logs to cheaper buckets or drop them with exclusion filters.
- **Always-allocated Cloud Run CPU** — CPU billed even when no request is in flight; use request-based (CPU-only-during-request) billing unless you truly need background work.
- **Cross-region / cross-zone chatter** — services gossiping across boundaries, racking up egress.
- **BigQuery `SELECT *` on huge tables** — full scans billed per TB.
- **Idle non-prod environments** — dev/staging running 24/7; schedule them off nights/weekends.

The senior framing: most waste is *entropy* — resources that outlived their purpose — so the fix is recurring automated hygiene (Recommender + scheduled cleanup), not heroics.

### Q13. How should Cloud Run be configured to avoid wasting money?

Cloud Run's default billing is **request-based**: you pay for CPU/memory only while a request is being handled, and scale to **zero** when idle — that's the cheap, correct default for request/response services.

The money leak is switching to **"CPU always allocated"** (instance-based billing) without needing it — now you pay for CPU 24/7 even with zero traffic. Only use always-allocated CPU if you genuinely run background work between requests (streaming, async processing).

Other levers:
- **Set `min-instances` to 0** for cost, or a small number only if you need to avoid cold starts on a latency-critical path (min-instances keep warm and *do* cost money).
- **Right-size CPU/memory** per revision; don't allocate 4 vCPU for a JSON API.
- **Cap `max-instances`** to bound both cost and downstream load.

```bash
gcloud run deploy my-svc --min-instances=0 --max-instances=20 \
  --cpu=1 --memory=512Mi --no-cpu-throttling  # omit --no-cpu-throttling to keep request-based billing
```

The anti-pattern to name in interviews: always-allocated CPU + high min-instances on a low-traffic service is paying for an always-on VM while thinking you're serverless.

### Q14. What is the Pricing Calculator and how does it fit a design discussion?

The **Google Cloud Pricing Calculator** is the public tool for estimating a proposed architecture's monthly cost *before you build it* — you add VMs, storage, BigQuery, egress, load balancers, etc., and it produces a line-item estimate (including SUD/CUD assumptions).

In a design interview, referencing it signals cost-consciousness at the *design* stage: "I'd model this in the Pricing Calculator to compare the multi-region hot standby against a pilot-light setup before committing." It's also how you sanity-check the egress and BigQuery lines that dominate real bills. Pair it with **billing export + budgets** for the runtime side: calculator for *forecast*, export for *actuals*, budget alerts for *drift*.

### Q15. Design a cost-optimized architecture for a batch data-processing pipeline that runs nightly.

A worked answer that ties the levers together:

- **Compute on Spot VMs / GKE Spot node pools** — batch is fault-tolerant and restartable, so take the 60–91% discount; checkpoint progress so preemption just resumes.
- **Or serverless: Dataflow / Dataproc Serverless / Cloud Run Jobs** — no idle cost between nightly runs; you pay only for the run. For a fixed nightly job, this often beats a standing cluster.
- **Storage in Cloud Storage with Autoclass or lifecycle rules** — raw inputs land in Standard, age to Nearline/Coldline automatically; delete intermediates with an expiration rule.
- **Land results in BigQuery, partitioned + clustered** — so downstream queries scan slices, not the whole table; set table expiration on scratch tables.
- **Keep compute, storage, and BigQuery in the same region** — kill cross-region egress.
- **Right-size and cap** — bound worker count; don't over-provision for a job that finishes in an hour.
- **Instrument** — label every resource `app:nightly-etl`, export billing to BigQuery, budget-alert the project.

The through-line: batch is the *ideal* Spot/serverless workload (interruptible, scheduled, no idle need), so the design should never leave capacity standing between runs, and every data hop should be checked for a billed boundary.

## Architecture Framework, Reliability & Multi-Region DR

### Summary

**What this topic covers**

How Google frames "good architecture" and how you engineer for failure. Two threads run through this topic's 16 questions. First, the **Google Cloud Architecture Framework** — the six pillars (operational excellence; security, privacy & compliance; reliability; cost optimization; performance optimization; sustainability) that give you a checklist to reason about any design. Second, the concrete **reliability and disaster-recovery** machinery: the zonal/regional/multi-regional resource model and the availability each buys, the four canonical DR patterns (backup & restore → cold/pilot-light → warm standby → hot active-active) with their RTO/RPO/cost trade-offs, cross-region data replication (Spanner, Cloud Storage dual/multi-region, Cloud SQL cross-region replicas), global load balancing for failover, and the SRE practices (SLOs, error budgets, toil, incident response) that operationalize all of it. This is the "design for failure" topic.

**Mental model**

Reliability on GCP is about **choosing your failure domain deliberately**. A **zone** is Google's smallest failure domain — a single zone can fail, so anything zonal (a single VM, a zonal disk) is a single point of failure. A **region** is a set of isolated zones; a **regional** resource (regional MIG, regional PD, Cloud SQL HA) survives losing one zone automatically. A **multi-region** deployment survives losing an entire region — the domain of serious DR. Every reliability decision is: *what failure domain am I willing to lose, and what does surviving the next-larger one cost?* You climb that ladder only as far as your **RTO/RPO** and budget justify. The second half of the model is **SRE thinking**: you don't chase 100% uptime, you set an **SLO**, spend the resulting **error budget** on velocity, and reduce **toil** through automation. Reliability is a negotiated target with a cost, not an absolute.

**Key terms**

- **Architecture Framework pillars** — operational excellence, security/privacy/compliance, reliability, cost optimization, performance optimization, sustainability.
- **Zone** — a single failure domain within a region (power/cooling/network isolated).
- **Region** — a collection of (usually 3+) zones; regional resources replicate across them.
- **Multi-region** — resources or deployments spanning regions for region-loss survival (e.g. Spanner multi-region, Cloud Storage multi-region buckets).
- **RTO (Recovery Time Objective)** — max acceptable **downtime** before recovery.
- **RPO (Recovery Point Objective)** — max acceptable **data loss**, measured in time.
- **DR patterns** — backup & restore, cold/pilot-light, warm standby, hot (active-active), in ascending cost and descending RTO/RPO.
- **Blast radius** — the scope of impact when a component fails; you design to shrink it.
- **SLO / SLI / error budget** — target reliability, the measured indicator, and the allowed unreliability you're free to "spend."
- **Toil** — manual, repetitive, automatable operational work; SRE aims to cap and reduce it.
- **Turbo replication** — Cloud Storage dual-region option guaranteeing an RPO of ~15 minutes for cross-region object replication.
- **Live migration** — Compute Engine moves a running VM off a host during maintenance with no reboot, so host maintenance isn't downtime.

**Why interviewers ask this**

This is the topic that most cleanly separates "can build a feature" from "can be trusted with production." Interviewers want to hear you reason about failure *before* it happens: do you know a single-zone database is a prod SPOD, that regional ≠ multi-region, that RTO and RPO are different numbers driving different (and differently-priced) DR patterns? They're probing whether you'll over-engineer (hot multi-region active-active for an internal tool that could tolerate an hour of downtime) or under-engineer (single zone for a payment system). Senior signal is *matching the reliability investment to the business requirement*, quantified in RTO/RPO and dollars, and speaking SRE (SLOs and error budgets) rather than promising "100% uptime," which is the junior tell.

**Common confusions**

- "Regional means multi-region" — no. **Regional** survives a *zone* loss; you need **multi-region** to survive a *region* loss.
- "RTO and RPO are the same" — RTO is **downtime** tolerance; RPO is **data-loss** tolerance. A system can want zero data loss (RPO≈0) but tolerate an hour to recover (RTO=1h), or vice versa.
- "More nines is always better" — beyond your SLO it's wasted money; the point of an **error budget** is to *stop* over-investing in reliability.
- "Multi-region is just a checkbox" — active-active multi-region forces you to solve data replication, conflict handling, and consistency; it's the most expensive and complex pattern, not a free toggle.
- "Retries make things reliable" — naive retries cause **retry storms**; you need exponential backoff **with jitter** plus **idempotency**, or retries amplify an outage.
- "Google handles maintenance so I don't need HA" — **live migration** covers *host* maintenance, not *zone* failure; you still design for zone loss.

**What follows from this topic**

Every reliability choice is also a **cost** choice — the DR ladder is literally an ascending cost curve, so this topic and **Cost Optimization & Billing** are two sides of one trade-off you must state explicitly in any design. And the patterns here (stateless design, global load balancing, decoupling with Pub/Sub, retries with backoff) are exactly what you'll apply in **Scenario Design & Common Pitfalls**, where the anti-patterns (single-zone prod DB, no dead-letter topic, state trapped in a Cloud Run instance) are reliability failures waiting to happen.

### Q1. What are the pillars of the Google Cloud Architecture Framework and how do you use them?

The framework has six pillars, and they're best used as a **review checklist** for any design:

1. **Operational excellence** — can you deploy, monitor, and operate it? (CI/CD, observability, incident response.)
2. **Security, privacy & compliance** — least privilege, encryption, data residency, defence in depth.
3. **Reliability** — does it meet its availability target under failure? (redundancy, DR, SLOs.)
4. **Cost optimization** — is it economical for the value delivered?
5. **Performance optimization** — does it meet latency/throughput needs and scale?
6. **Sustainability** — carbon efficiency (region choice, right-sizing, using Google's low-carbon regions).

The senior move in a design interview is to *narrate against the pillars*: "Here's my design; on reliability I've made the DB regional-HA; on cost I'm using Spot for the workers; on security I'm using per-service accounts with least privilege." It shows structured thinking rather than an ad-hoc box diagram. No single pillar wins — you explicitly trade them (reliability vs cost being the classic tension).

### Q2. Explain zonal vs regional vs multi-regional resources and the availability each provides.

A ladder of failure domains:

| Scope | Survives | Example | Typical availability |
|---|---|---|---|
| **Zonal** | nothing above process/instance | single VM, zonal PD, single-zone GKE | a zone outage takes it down |
| **Regional** | one **zone** loss | regional MIG, regional PD, Cloud SQL HA, regional GKE | high within a region |
| **Multi-regional** | one **region** loss | Spanner multi-region, GCS multi-region bucket, global LB | highest, DR-grade |

The design rule: **a zone is a failure domain**, so anything zonal in production is a single point of failure. Move to **regional** to ride out a zone outage automatically (this covers the overwhelming majority of real incidents). Reach for **multi-region** only when the business can't tolerate a full region loss — it costs more and adds cross-region consistency/replication complexity. Naming this ladder and placing your components on it is the core of any GCP reliability answer.

### Q3. Define RTO and RPO and explain how they drive DR design.

- **RTO (Recovery Time Objective)** — the maximum tolerable **downtime**. "We must be back within 1 hour."
- **RPO (Recovery Point Objective)** — the maximum tolerable **data loss**, in time. "We can lose at most 5 minutes of data."

They're independent axes and they *drive the pattern*: a tight RPO (near-zero data loss) forces **synchronous or near-continuous replication**; a tight RTO (near-zero downtime) forces **warm/hot standby** so there's nothing to spin up. A system can want RPO≈0 (a bank ledger) but accept RTO of tens of minutes, or want fast RTO but tolerate some data loss. In an interview, *always ask for RTO and RPO first* when a DR question comes up — they determine which of the four patterns and how much you'll spend. Quoting them back turns a vague "make it reliable" into an engineering spec.

### Q4. Describe the four disaster-recovery patterns and their trade-offs.

An ascending ladder of cost vs recovery speed:

| Pattern | RTO | RPO | Cost | How |
|---|---|---|---|---|
| **Backup & restore** | hours+ | hours | lowest | periodic backups to GCS; rebuild in DR region on disaster |
| **Cold / pilot-light** | tens of min | minutes | low | core data replicated + minimal infra pre-provisioned; scale up on failover |
| **Warm standby** | minutes | seconds–min | higher | a scaled-down but running copy in the DR region; scale up on failover |
| **Hot / active-active** | ~0 | ~0 | highest | full capacity live in multiple regions serving simultaneously |

**Choosing:** map RTO/RPO to the cheapest pattern that meets both. Backup & restore for non-critical/internal systems. Pilot-light when you need core data warm but can tolerate spin-up. Warm standby for important customer-facing systems. Hot active-active only for systems where any downtime is unacceptable (payments, global APIs) — and note it forces you to solve multi-region data consistency. The senior answer refuses to default to hot: "active-active is the most expensive and complex; I'd only pay for it if RTO≈0 is a hard requirement."

### Q5. How do you replicate data across regions on GCP? Compare the managed options.

Pick the option that matches your data store and consistency needs:

- **Spanner (multi-region config)** — globally distributed, **strongly consistent** relational with synchronous replication across regions via TrueTime. Best when you need a transactional DB that survives region loss with **RPO≈0** and no application-level replication logic. Expensive but turnkey.
- **Cloud Storage dual-region / multi-region buckets** — objects replicated across regions automatically; add **turbo replication** on dual-region for a guaranteed ~15-minute RPO. Strong consistency for the object namespace.
- **Cloud SQL cross-region read replicas** — asynchronous replicas in another region; promote on disaster. RPO is the replication lag (seconds), RTO is the promote time. Cheaper than Spanner but async (possible small data loss) and manual/automated promotion.
- **BigQuery** — dataset-level cross-region replication (Enterprise Plus) or managed DR for the warehouse.

The trade to state: **Spanner = synchronous, strongly consistent, RPO≈0, priciest**; **Cloud SQL replica = asynchronous, cheaper, small RPO and manual failover**; **GCS turbo = objects, ~15-min RPO guarantee**. Match to the store you're already using and the RPO you must hit.

### Q6. How does global load balancing enable failover, and what role do health checks play?

Google's **Global External Application Load Balancer** uses a **single global anycast IP** on Google's Premium-tier backbone. It routes each user to the **nearest healthy backend** across regions. That gives you two things at once: latency-based routing *and* automatic failover.

**Health checks** are the mechanism: the LB continuously probes each backend (per backend service). When a backend/region fails its checks, the LB **stops sending traffic there** and shifts to the next-nearest healthy region — no DNS change, no client action, failover in seconds because the anycast IP never moves.

This is the backbone of hot/warm multi-region designs: put a regional backend in each region, front them with the global LB, and region failover becomes automatic. Contrast with DNS-based failover (slow, TTL-bound). In an interview, "global LB + health checks give me automatic cross-region failover behind one anycast IP" is the crisp answer for HA web architectures.

### Q7. Why is stateless design central to reliability and scaling, and how do you externalize state?

Because **stateless instances are disposable** — any instance can handle any request, so you can scale horizontally, replace failed instances freely, and load-balance without stickiness. The moment an instance holds state (a session, an upload buffer, a cache the client depends on), losing that instance loses data and you can't freely scale or fail over.

**Externalize state** to purpose-built managed services:
- **Sessions / ephemeral state** → Memorystore (Redis) or Firestore.
- **Uploaded files / blobs** → Cloud Storage, not local disk.
- **Durable data** → Cloud SQL / Spanner / Firestore.
- **In-flight work** → Pub/Sub or a task queue, not in-memory.

This is exactly why Cloud Run and GKE autoscaling work: instances come and go, state lives elsewhere. The anti-pattern (storing state in a Cloud Run instance) shows up in the pitfalls topic — it breaks the instant an instance is recycled or scaled. "Make compute stateless, push state to managed services" is a reliability *and* scalability principle in one.

### Q8. What is graceful degradation and how do you build it in?

Graceful degradation means the system **loses features, not availability**, when a dependency fails — instead of a total outage. If the recommendations service is down, still serve the product page without recommendations; if the ratings DB is slow, show cached ratings or hide the widget.

How to build it:
- **Timeouts + circuit breakers** on every downstream call, so a slow dependency doesn't cascade into your request threads.
- **Fallbacks** — cached/stale data, default values, or feature flags that hide non-critical features.
- **Decouple non-critical work** — push it to Pub/Sub so a failure there doesn't block the core request path.
- **Prioritize the core journey** — identify the must-work path (checkout) vs the nice-to-have (recommendations) and protect the former.

The senior framing: "I identify the critical path and make everything off it fail *open* — degrade to a lesser experience rather than an error page." It pairs with blast-radius reduction: one failing dependency should shrink the product, not kill it.

### Q9. How should retries be implemented so they help rather than hurt?

Naive retries are dangerous: when a service is struggling, every client retrying immediately creates a **retry storm** that keeps it down. Do it properly:

- **Exponential backoff** — wait 1s, 2s, 4s, 8s… between attempts, giving the dependency room to recover.
- **Jitter** — add randomness to the backoff so clients don't all retry in synchronized waves (the thundering herd). Full jitter is the standard.
- **Idempotency** — retries can duplicate work, so the operation must be safe to repeat (idempotency keys, dedup, upserts). Especially critical for payments and message processing.
- **Retry budgets / caps** — bound total retries and fail fast past a limit; combine with a circuit breaker.
- **Only retry retryable errors** — 5xx/timeout yes; 4xx (bad request) no.

The interview one-liner: "exponential backoff **with jitter** plus **idempotency** — retries without those two amplify outages instead of surviving them." Pub/Sub, for example, redelivers messages, so consumers must be idempotent by design.

### Q10. Why are quotas a reliability risk, and how do you manage them?

Because a quota is a **hard ceiling** that fails your workload with the same effect as an outage — except it's self-inflicted and often invisible until you scale. Every GCP service has quotas (API requests/min, CPUs per region, Pub/Sub throughput, in-flight functions). Hit one during a traffic spike or a large batch and requests get rejected even though the infrastructure is healthy.

Management:
- **Monitor quota usage** proactively (Cloud Monitoring exposes quota metrics) and alert before you're at the ceiling.
- **Request increases ahead of growth** — quota bumps aren't always instant, so don't wait for the incident.
- **Design within quotas** — batch calls, use backoff on `RESOURCE_EXHAUSTED`, spread load across regions.
- **Account for DR** — your failover region needs enough quota to absorb the *whole* load, not just its normal share; a common DR failure is failing over into a region whose quota can't hold the traffic.

Senior signal: treating quota as a **capacity-planning and DR** concern, not a support ticket you file after it breaks.

### Q11. What are SLOs and error budgets, and how do they change engineering decisions?

- **SLI (indicator)** — a measured signal of health, e.g. proportion of requests served <200ms, or success rate.
- **SLO (objective)** — the target for that SLI, e.g. "99.9% of requests succeed over 28 days."
- **Error budget** — the allowed *unreliability*: 99.9% means 0.1% of requests may fail — that 0.1% is a budget you're free to **spend**.

Why it matters: the error budget turns reliability into a **shared, quantified decision**. If you're within budget, you ship features fast (you have room to risk). If you've **burned** the budget, you freeze risky changes and pour effort into reliability until it recovers. It ends the "dev wants speed, ops wants stability" fight by making the trade explicit and data-driven. It also stops over-investment: chasing 99.99% when the SLO is 99.9% is spending money the business didn't ask for. Quoting SLO/error-budget thinking is the clearest senior/SRE signal in a reliability interview.

### Q12. What is toil, and how does the SRE approach to it improve reliability?

**Toil** is operational work that is **manual, repetitive, automatable, tactical, and scales linearly with the service** — restarting a service by hand, manually provisioning, running the same runbook every incident. It's not "hard work"; it's *low-value* work that grows with the system.

SRE's stance: **cap toil** (a common guideline is <50% of an SRE's time) and relentlessly automate it away, because toil left unchecked (a) burns out the team, (b) doesn't scale — human ops can't keep pace with a growing service, and (c) is error-prone under pressure. Reducing toil frees engineers for *engineering* (better automation, better SLOs) which compounds reliability. Practically: automate deploys, self-healing (autoscaling, auto-restart, health-check-driven replacement), and turn every repeated manual fix into code. The reliability payoff is fewer human-error incidents and faster, consistent recovery.

### Q13. Walk through incident response — what does good look like on GCP?

Good incident response is **structured, not heroic**:

- **Detection** — alerts fire off SLO burn rate (Cloud Monitoring alerting), not just raw metrics, so you page on user impact.
- **Roles** — an **Incident Commander** coordinates, comms lead updates stakeholders, ops leads investigate. Clear roles prevent chaos.
- **Mitigate before diagnose** — stop the bleeding first (roll back, shift traffic with the global LB, scale up, disable the bad feature flag) *before* root-causing.
- **Communicate** — status updates on a known cadence; a status page for external users.
- **Blameless postmortem** — after recovery, document timeline, root cause, and *action items*, focusing on **systems not people**. The output feeds toil reduction and better SLOs.

GCP tooling: Cloud Monitoring/Alerting for detection, Cloud Logging + Error Reporting + Cloud Trace for diagnosis, the global LB and deployment rollbacks for mitigation. Senior signal: "mitigate first, blameless postmortem after, and every incident produces action items that reduce future toil."

### Q14. What is chaos engineering / DiRT, and why would you deliberately break production?

**Chaos engineering** (Google runs it as **DiRT — Disaster Recovery Testing**) is deliberately injecting failure — kill a zone, add latency, drop a dependency, fail over a region — to **verify your reliability assumptions before a real outage does**.

The rationale: a DR plan or HA design is a *hypothesis* until tested. Systems drift, dependencies change, runbooks rot. The only way to know your regional failover actually works, your quotas in the DR region are sufficient, and your alerts fire is to **practice the failure** in a controlled way. DiRT exercises also train the humans — incident response is a skill that atrophies.

Practically: start small and blast-radius-limited (one instance, then one zone), in non-peak windows, with a rollback ready, and measure whether you met your RTO/RPO. The senior insight: "untested DR is not DR — it's a document." Regularly killing a zone is how you find the single-zone dependency you forgot before your customers do.

### Q15. How does decoupling with Pub/Sub improve reliability and blast-radius?

**Pub/Sub** (global, managed, ≈ SNS+SQS combined) puts an asynchronous buffer between producers and consumers, and that buffer is a reliability tool:

- **Absorbs spikes** — producers publish at burst rate; consumers pull at their own pace. A traffic spike fills the queue instead of overwhelming (and taking down) the downstream service.
- **Isolates failure** — if a consumer is down, messages **persist** (retained, redelivered) rather than being lost; the producer keeps working. The failure's blast radius stops at the subscription.
- **Enables independent scaling & deploys** — producer and consumer scale and release independently.
- **Fan-out** — one topic, many subscriptions, so adding a consumer doesn't touch the producer.

Caveats you must name: Pub/Sub is **at-least-once**, so consumers must be **idempotent**; and you need a **dead-letter topic** so poison messages don't retry forever (that omission is a classic pitfall). The design principle: replace synchronous coupling with a durable queue and a single slow/failed component degrades throughput instead of cascading into an outage.

### Q16. Explain cell-based / regional isolation and how it reduces blast radius.

**Cell-based (a.k.a. regional/shard) architecture** partitions your system into independent **cells** — self-contained stacks each serving a slice of traffic (a set of tenants, a region, a shard). A failure — a bad deploy, a poison workload, a resource exhaustion — is **contained to one cell** instead of taking down all users.

Why it beats one big deployment:
- **Bounded blast radius** — an incident hits 1/N of users, not everyone.
- **Safe progressive rollout** — deploy to one cell, watch it, then proceed; a bad release is caught at cell scope.
- **Independent scaling and failure domains** — a hot tenant in one cell can't starve others.

On GCP this maps naturally onto **regional isolation** (independent regional stacks behind a global LB) or per-tenant/per-shard cells. The trade-off is operational complexity and some capacity overhead (each cell needs headroom). Senior framing: "I'd shard into cells so one bad tenant or one bad deploy degrades a fraction of users, and I get progressive rollout for free" — it's the same instinct as blast-radius reduction, applied at the architecture level.

## Scenario Design & Common Pitfalls

### Summary

**What this topic covers**

The capstone. This topic's 16 questions are the "put it all together" and "spot what's wrong" exercises that a GCP architecture interview actually runs on. Half are **design scenarios** — image-upload pipelines, global low-latency APIs, real-time analytics ingestion, multi-tenant SaaS backends, HA web apps, batch pipelines, monolith migrations, event-driven order processing — where you must name concrete GCP services and *justify* them against the constraints. The other half are **anti-pattern spotting** — over-broad Owner grants, service-account keys in repos, public buckets, single-zone prod databases, missing Cloud NAT/Private Google Access, BigQuery `SELECT *`, no dead-letter topic, hot-key Bigtable/Firestore designs, always-allocated Cloud Run CPU, state trapped in a Cloud Run instance — where you must identify the flaw, say *what breaks at scale or in production*, and give the fix. It synthesizes every earlier topic: compute, storage, data, networking, security, reliability, and cost.

**Mental model**

A GCP design interview is not a service trivia quiz — it's a **structured conversation**. The loop is: **(1) clarify requirements** (scale, latency, consistency, budget, RTO/RPO, compliance) before drawing anything; **(2) pick services against those constraints** — Cloud Run vs GKE, Firestore vs Spanner, Pub/Sub vs direct call — naming *why* each fits; **(3) justify the trade-offs** you're making and the ones you're rejecting; **(4) cover the cross-cutting pillars** — security (least privilege, no public buckets, no keys), cost (serverless-to-zero, no cross-region egress), reliability (regional-HA, decoupling, DR); and **(5) know the anti-patterns** so you don't design one and can spot one instantly. The senior habit is thinking in *defaults with reasons*: "serverless first (Cloud Run) unless I need node-level control (GKE); managed DB unless I have a reason not to; async via Pub/Sub to decouple." You're demonstrating judgment, not memorization.

**Key terms**

- **Reference architecture** — a known-good service composition for a common problem (e.g. upload → Eventarc → Cloud Run → GCS).
- **Eventarc** — routes events (GCS object created, Pub/Sub, audit logs) to Cloud Run/Workflows; the glue for event-driven designs.
- **Global External Application LB** — single anycast IP, cross-region routing + failover; the front door for global apps.
- **Cloud NAT** — managed egress NAT so private-IP instances reach the internet **without external IPs**.
- **Private Google Access / Private Service Connect** — reach Google APIs (and managed services) over internal IPs, no internet round-trip.
- **Dead-letter topic (DLQ)** — where Pub/Sub sends messages that repeatedly fail, so poison messages don't retry forever.
- **Hot key / hotspot** — a Bigtable row-key or Firestore document pattern that funnels traffic to one node/range, capping throughput.
- **Least privilege** — grant the narrowest role (predefined/custom) to the narrowest scope, never primitive **Owner/Editor** broadly.
- **Workload Identity / Workload Identity Federation** — get short-lived credentials to workloads (GKE pods, CI) instead of downloadable **service-account keys**.
- **Stateless service** — instance holds no durable state, so it's disposable and horizontally scalable (Cloud Run/GKE default assumption).

**Why interviewers ask this**

Because this is the closest proxy to the actual job. Anyone can recite that Spanner is globally consistent; the test is whether you'll *reach for it appropriately* and *not* over-build. Scenario questions reveal whether you clarify before designing (junior candidates start drawing immediately), whether you justify choices or name-drop, and whether you weigh security/cost/reliability or only the happy path. The anti-pattern questions are even sharper: they check whether you've operated real systems — you only viscerally know why a single-zone prod DB or a service-account key in a repo is bad if you've felt the consequences (or reviewed the code of someone who has). Getting these right signals you can be handed an ambiguous problem and produce a defensible, production-grade design — which is the whole point of hiring a senior engineer.

**Common confusions**

- "Just use GKE / Spanner / multi-region for everything" — over-engineering is as much a red flag as under-engineering; match the tool to the requirement and *say why the simpler option is insufficient*.
- "The design is the diagram" — the diagram is 40%; clarifying requirements and justifying trade-offs is the rest.
- "Owner role is fine for the app's service account" — it's a massive over-grant and a top security finding; use least-privilege predefined/custom roles.
- "Service-account keys are how workloads authenticate" — prefer **Workload Identity**; downloadable keys are long-lived secrets that leak.
- "A public bucket is convenient" — public read on a data bucket is a classic breach vector; front with signed URLs or a CDN + private bucket.
- "Async is overkill, just call the service directly" — synchronous coupling is what turns one slow dependency into a full outage; decouple the non-critical path.

**What follows from this topic**

Nothing — this is where the primer lands. It draws on **Cost Optimization & Billing** (every scenario has a cost story; every anti-pattern list includes a cost leak) and **Architecture Framework, Reliability & Multi-Region DR** (the pillars and DR patterns are the scoring rubric for your designs). If you can run the five-step loop, name concrete services with reasons, and spot the ten anti-patterns on reflex, you're ready for the whiteboard.

### Q1. How do you approach an open-ended "design X on GCP" interview question?

Run a repeatable loop; don't start drawing boxes:

1. **Clarify requirements** — scale (RPS, data volume), latency targets, consistency needs, budget, RTO/RPO, compliance/data-residency, read-vs-write ratio. This alone separates seniors from juniors.
2. **State assumptions** — pin the numbers you'll design to so the interviewer can correct you early.
3. **Pick services against constraints** — and *say why*: "Cloud Run because it scales to zero and I don't need node-level control; Firestore because access is key-based and I want serverless."
4. **Walk the data flow** — request → compute → data → response, plus the async paths.
5. **Cover the pillars** — security (IAM, no public data, no keys), reliability (regional HA, DR), cost (serverless, egress), performance (caching, CDN).
6. **Name the trade-offs and the rejected alternatives** — "I chose Firestore over Spanner because I don't need cross-region strong consistency, which would triple the cost."

The meta-point: you're demonstrating **judgment under ambiguity**, so think aloud and justify. A slightly simpler design, well-reasoned, beats a maximal one name-dropped.

### Q2. Design a scalable image-upload and processing pipeline.

**Reference architecture:** client → **Cloud Storage** (upload via **signed URL**) → **Eventarc**/Pub/Sub on the object-created event → **Cloud Run** (or a Cloud Run Job) does the processing (thumbnails, transcode, moderation) → writes outputs back to GCS and metadata to **Firestore**.

Why each:
- **Signed URLs** let clients upload **directly to GCS**, bypassing your compute (no bandwidth/egress through your service, and it scales infinitely). Never proxy large uploads through Cloud Run.
- **Cloud Storage** is the durable, cheap object store; the object-created event is the natural trigger.
- **Eventarc / Pub/Sub** decouples upload from processing — spikes queue up, processing scales independently, and a failed processor doesn't lose the event.
- **Cloud Run** scales to zero (cheap when idle) and out under load; processing is stateless and idempotent (same object processed twice = same result).
- **Firestore/BigQuery** for metadata / analytics.

Cost/reliability notes: request-based Cloud Run billing, a **dead-letter topic** for images that fail processing, and lifecycle rules to tier old originals to Nearline/Coldline. This is the canonical GCP event-driven pattern.

### Q3. Design a global, low-latency API.

**Reference architecture:** **Global External Application Load Balancer** (single anycast IP, Premium tier) → **Cloud Run** deployed in **multiple regions** (or GKE) as backends → **Spanner** (if you need global strong consistency) or **Firestore in multi-region** (if document/key access suffices) → **Cloud CDN** on the LB for cacheable responses.

Why:
- **Global LB** gives one IP worldwide, routes each user to the nearest healthy region, and **fails over automatically** on health-check failure — latency *and* HA in one component.
- **Multi-region Cloud Run** puts compute close to users; stateless so any region serves any request.
- **Data layer is the hard choice:** **Spanner multi-region** if you need transactional, strongly-consistent global writes (RPO≈0, priciest); **Firestore multi-region** if access is key/document-based and eventual cross-region is fine (cheaper, serverless). Name the trade explicitly.
- **Cloud CDN** offloads reads to the edge, cutting latency and egress.

Add **Cloud Armor** at the LB for WAF/DDoS. The senior signal: choosing the data store deliberately (Spanner's cost/consistency vs Firestore's simplicity) rather than defaulting to the most powerful option.

### Q4. Design a real-time analytics ingestion pipeline.

**Reference architecture — the canonical GCP streaming stack:** producers → **Pub/Sub** (ingest buffer) → **Dataflow** (Apache Beam, streaming transform/enrich/window) → **BigQuery** (analytics warehouse), with dashboards on **Looker Studio / BI Engine**.

Why each:
- **Pub/Sub** absorbs bursty ingest and decouples producers from processing; global, scales to millions of messages/sec.
- **Dataflow** is serverless streaming ETL — windowing, deduplication, enrichment, exactly-once into BigQuery — and autoscales workers to throughput.
- **BigQuery** is the serverless columnar warehouse; **partition + cluster** the destination tables so downstream queries scan slices, not everything. Use the **Storage Write API** for efficient streaming inserts.
- **BI Engine** accelerates dashboard queries in memory.

Reliability/cost notes: a **dead-letter topic** for un-parseable events; partitioning to control BigQuery scan cost; for simple pass-through you can even use Pub/Sub's **BigQuery subscription** and skip Dataflow. If you need sub-second serving rather than analytics, swap BigQuery for **Bigtable**. This "Pub/Sub → Dataflow → BigQuery" trio is the single most expected GCP data answer.

### Q5. Design a multi-tenant SaaS backend.

Start by clarifying the **isolation requirement** — that drives everything. Then pick a tenancy model:

| Model | Isolation | Cost | Use |
|---|---|---|---|
| **Shared DB, tenant_id column** | low | lowest | many small tenants |
| **Schema/DB per tenant** | medium | medium | mid-market, some compliance |
| **Project/infra per tenant** | high | highest | enterprise, strict compliance |

**Reference architecture:** Global LB + **Cloud Run**/GKE (stateless, tenant resolved from auth token) → data layer per the model above (**Spanner** or **Cloud SQL** with `tenant_id`, or Firestore with per-tenant collections). Enforce isolation with **row-level security / query scoping** and, for higher tiers, separate service accounts and projects. Use **labels** per tenant for **cost allocation** (chargeback). Consider **cell-based** sharding so one hot tenant can't degrade others, and so you can rollout progressively.

Cross-cutting: **per-tenant rate limiting** (a noisy tenant shouldn't exhaust shared quota — quotas are a reliability risk), strong **authN/Z** with tenant scoping on every query, and encryption/data-residency per tenant if required. The senior move: tie the tenancy model to the *stated* isolation/compliance need rather than defaulting to shared or fully-isolated.

### Q6. Design a highly available web application on GCP.

**Reference architecture:** **Cloud DNS** → **Global External App LB** (+ **Cloud Armor** WAF) → **Cloud CDN** for static → **stateless compute in ≥2 regions** (Cloud Run multi-region, or regional managed instance groups / regional GKE with autoscaling) → **Cloud SQL with HA (regional, automatic failover)** or **Spanner** for the DB → **Memorystore** for sessions/cache → **Cloud Storage** for user assets.

The HA reasoning, layer by layer:
- **Regional** compute survives a **zone** loss automatically; **multi-region** behind the global LB survives a **region** loss.
- **Stateless** instances mean any one can die and be replaced — sessions live in Memorystore, files in GCS, not on the instance.
- **Cloud SQL HA** gives a synchronous standby in another zone with automatic failover; go **Spanner** or cross-region replicas if you need region-loss survival.
- **Global LB health checks** route around failed backends in seconds.

State the **DR posture** in RTO/RPO terms and pick the matching pattern (warm standby vs active-active) — don't pay for hot active-active unless the requirement demands it. Cover **cost** (autoscale, CDN cuts egress) and **security** (Cloud Armor, least-privilege service accounts) to hit all the pillars.

### Q7. Design an event-driven order-processing system.

**Reference architecture:** API (**Cloud Run**) accepts the order and publishes to **Pub/Sub** → separate consumers (Cloud Run / Cloud Functions) handle **payment**, **inventory**, **fulfilment**, **notifications**, each on its own **subscription** → durable state in **Firestore/Spanner** → **Eventarc** or a **Workflows** orchestration if steps must be sequenced.

Why event-driven here:
- **Pub/Sub decouples** the order intake from the (slower, failure-prone) downstream steps — the customer gets a fast ack, processing happens async.
- **Fan-out**: one `order-created` topic, many independent subscribers; add "loyalty points" later without touching intake.
- **Resilience**: if fulfilment is down, its messages persist and retry; payment keeps working. Failure blast-radius is one subscription.

Non-negotiables to name:
- **Idempotency** — Pub/Sub is at-least-once, so "charge card" must dedupe on an idempotency key (double delivery must not double-charge).
- **Dead-letter topic** — poison orders go to a DLQ instead of retrying forever.
- **Ordering** — if per-customer order matters, use an **ordering key**.
- For a multi-step transaction spanning services, use the **saga** pattern (compensating actions) via **Workflows**, since you can't hold a distributed ACID transaction across them.

### Q8. Design a batch data pipeline.

**Reference architecture:** source data in **Cloud Storage** (or Cloud SQL export) → **Dataflow (batch)** or **Dataproc Serverless** (managed Spark) or **Cloud Composer** (Airflow) for orchestration → transformed output to **BigQuery** (partitioned/clustered) and/or back to GCS.

Choosing the engine:
- **Dataflow (batch)** — serverless Beam, autoscaling, best when you want no cluster management and unified batch/stream code.
- **Dataproc Serverless** — when the team already has **Spark/Hadoop** jobs; serverless so no standing cluster.
- **Cloud Composer (Airflow)** — orchestration/DAG scheduling across steps and systems.
- **BigQuery scheduled queries** — if the transform is just SQL, skip the cluster entirely.

Cost is the headline for batch (see the cost topic): **Spot VMs / serverless** so nothing stands idle between runs, same-region to avoid egress, and partitioned BigQuery output. Reliability: make jobs **idempotent and checkpointed** so a retry (or a Spot preemption) resumes cleanly. Interview signal: reaching for **serverless/Spot** because batch is interruptible and scheduled — never a 24/7 cluster for a nightly job.

### Q9. How would you approach migrating a monolith to GCP?

Lead with **strategy before services** — the "6 R's" framing, then the incremental path:

1. **Rehost (lift-and-shift)** to **Compute Engine** / **Migrate to Virtual Machines** first — fastest, lowest risk, gets you off the old data centre. Often the right *first* step.
2. **Replatform** — containerize and move to **GKE** or **Cloud Run**, adopt managed data services (**Cloud SQL** instead of self-managed MySQL) for less ops.
3. **Refactor/rearchitect** — carve the monolith into services incrementally using the **strangler-fig** pattern: put a facade (API Gateway / LB) in front, peel off one capability at a time into Cloud Run/GKE, route that path to the new service, repeat. Never a big-bang rewrite.

Cross-cutting: migrate the **database** carefully (**Database Migration Service** for minimal-downtime Cloud SQL migrations; dual-write or CDC for zero-downtime), establish **networking** (VPC, Cloud VPN/Interconnect to the old environment during transition), and set up **CI/CD, IAM, and observability** before you scale the migration. The senior answer resists "rewrite it as microservices" — it stages the migration to deliver value early and de-risk, and picks the least-effort R that meets the goal.

### Q10. Spot the anti-pattern: the application's service account has the primitive Owner role, granted at the project level. What's wrong and what's the fix?

**What's wrong:** the primitive/basic **Owner** (also Editor/Viewer) roles are enormously broad — Owner can do *anything* in the project including managing IAM, deleting resources, and changing billing. Handing that to an app's service account means a single compromised workload (an SSRF, an RCE, a leaked key) yields **full project takeover**. It's the top finding in most GCP security reviews and a direct violation of **least privilege**.

**The fix:**
- Grant **predefined roles** scoped to exactly what the app does (e.g. `roles/storage.objectAdmin` on one bucket, `roles/cloudsql.client`), or a **custom role** if no predefined one fits.
- Scope grants to the **narrowest resource** (a bucket, a dataset), not the whole project.
- Use a **dedicated service account per service** so blast radius is one service's permissions, not everything.

```bash
# Instead of roles/owner:
gcloud storage buckets add-iam-policy-binding gs://acme-uploads \
  --member="serviceAccount:img-proc@my-project.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Least privilege isn't a nicety — it's what bounds the blast radius of every future compromise.

### Q11. Spot the anti-pattern: service-account JSON keys are committed to the repo (or baked into a container). Why is this dangerous and what should you do instead?

**Why it's dangerous:** an exported service-account **key is a long-lived, static credential** with no expiry. Committed to a repo (even a private one) or baked into an image, it *will* leak — via a fork, a compromised laptop, a public mirror, a pushed image layer — and it grants whatever the SA can do, indefinitely, from anywhere. This is one of the most common real-world GCP breaches. Keys also rot: nobody rotates them, so they linger for years.

**The fix — stop downloading keys:**
- **Workload Identity (GKE)** — pods assume a Google service account via the metadata server; **no key file**.
- **Workload Identity Federation** — external CI/CD (GitHub Actions, on-prem) exchanges its own OIDC token for short-lived GCP credentials; no long-lived key.
- **Attached service accounts** — Compute Engine / Cloud Run / Cloud Functions get credentials automatically from the metadata server; the app calls Google APIs with zero secrets.

If you *absolutely* must use a key (rare, external system with no federation), store it in **Secret Manager**, rotate it, and **never** in source. Add an **org policy** (`iam.disableServiceAccountKeyCreation`) to block key creation entirely. The principle: prefer **short-lived, automatically-supplied** credentials over any static secret.

### Q12. Spot the anti-pattern: a Cloud Storage bucket is configured with `allUsers` read access to serve user data. What breaks and what's the safe pattern?

**What breaks:** granting `allUsers` (or `allAuthenticatedUsers`) makes the bucket/objects **publicly readable to the entire internet**. For user data that's a data breach — anyone who guesses or enumerates an object URL reads it, and crawlers index it. Public buckets are a perennial source of leaks. It also removes any audit trail of *who* accessed what.

**Safe patterns depending on the use case:**
- **Private downloads for a specific user** → generate a **signed URL** with a short TTL; the client gets time-limited access to exactly one object, bucket stays private.
- **Public static assets behind a CDN** → keep the bucket **private**, put **Cloud CDN + a load balancer** in front (or use a backend bucket); users hit the CDN, not the bucket directly, and you get caching + control.
- **App-to-app access** → grant a **service account** the narrow role on the bucket, not `allUsers`.

Enforce it org-wide with the **Public Access Prevention** org policy so no one can make a bucket public by accident, and use **uniform bucket-level access**. Truly-public content (a marketing site's images) is the only legitimate case — and even then, front it with a CDN.

### Q13. Spot the anti-pattern: the production database runs on a single-zone instance. Why is this a problem and what's the fix?

**Why it's a problem:** a **zone is Google's smallest failure domain** — zones do go down (power, network, maintenance gone wrong). A single-zone database is a **single point of failure**: when that zone fails, your entire application is down until the zone recovers or you restore from backup (hours), and you may lose data written since the last backup. For anything production, that's an unacceptable RTO/RPO.

**The fix — climb the availability ladder to match the requirement:**
- **Cloud SQL: enable HA (regional)** — a synchronous standby in a **different zone** with **automatic failover** in ~60s. This is the baseline fix; it survives a zone loss with near-zero data loss.
- **Add cross-region read replicas** for **region-loss** DR (promote on disaster) — RPO = replication lag, RTO = promote time.
- **Spanner** if you need **multi-region strong consistency** and RPO≈0 out of the box.
- Regardless, keep **automated backups + PITR** as the safety net.

The senior framing: single-zone is fine for dev/scratch, never for prod. State the target **RTO/RPO**, then pick regional HA (zone loss) vs multi-region/replicas (region loss) accordingly — don't over-buy Spanner if regional HA meets the requirement.

### Q14. Spot the anti-pattern: private VMs are given external IPs just so they can reach the internet for updates. What's the issue and the right design?

**The issue:** attaching an **external IP** to every instance so it can pull packages or call external APIs (a) **enlarges the attack surface** — each instance is now directly reachable from the internet and must be firewalled carefully, (b) **costs money** — external IPs are billed, and (c) is simply unnecessary. It's a common but backwards way to get egress.

**The right design:**
- **Cloud NAT** — a managed NAT gateway lets instances with **only private IPs** make **outbound** connections to the internet (updates, external APIs) while remaining **unreachable from the internet inbound**. No external IPs needed.
- **Private Google Access** — for reaching **Google APIs/services** (Cloud Storage, BigQuery, Artifact Registry), enable it on the subnet so private-IP VMs reach Google over **internal** routes without any internet path at all.
- **Private Service Connect** — reach Google/partner-managed services over private IPs.

So: **Cloud NAT for general egress, Private Google Access for Google APIs, no external IPs on workloads.** This shrinks the attack surface, cuts cost, and keeps traffic to Google services on the internal backbone. Missing NAT/PGA and defaulting to external IPs is a classic networking anti-pattern.

### Q15. Spot the anti-pattern: a scheduled query runs `SELECT *` over a multi-terabyte BigQuery table every hour, and a Pub/Sub pipeline has no dead-letter topic. Explain both.

Two independent production smells:

**`SELECT *` on a huge table (cost + performance):** BigQuery bills by **bytes scanned**, and its **columnar** storage means `SELECT *` reads *every column* — often 10–100x more data than the few columns you actually need. Run hourly over multiple TB, that's a large, recurring bill for data you discard. **Fix:** select only needed columns; **partition** (e.g. by date) and **cluster** the table so the query prunes to a slice; use `--dry_run` to see the byte estimate; set **custom quotas** as a guardrail. Also question whether it needs to be full-table hourly — incremental on the latest partition is usually enough.

**No dead-letter topic (reliability):** without a **DLQ**, a "poison" message that always fails processing is **redelivered forever** — it wastes consumer capacity, can block progress, and floods your logs/alerts. **Fix:** configure a **dead-letter topic** with a **max delivery attempts** on the subscription so a message that fails N times is diverted to the DLQ for later inspection, and the main flow keeps moving. Pair with **idempotent** consumers (at-least-once delivery) and monitoring on DLQ depth. Both anti-patterns share a theme: defaults that work in a demo but fail at scale/in production.

### Q16. Spot the anti-pattern: a Cloud Run service stores session/upload state in the instance's memory or local disk, and a Bigtable table keys rows by a monotonically increasing timestamp. Explain what breaks.

Two classic scale failures:

**State in a Cloud Run instance (statefulness):** Cloud Run instances are **ephemeral and horizontally scaled** — they're created and destroyed on demand, requests hit *any* instance, and there's no stickiness guarantee. Storing a session or an in-progress upload in instance memory/local disk means: the next request may land on a **different instance** (state gone), or the instance **scales down/recycles** (state lost), or you can never scale past one instance without breaking users. **Fix:** externalize state — sessions/cache in **Memorystore (Redis)** or Firestore, uploads in **Cloud Storage**, durable data in a managed DB. Compute must be **stateless** for autoscaling and reliability to work at all.

**Monotonic Bigtable row key (hotspotting):** Bigtable (and Firestore) distribute data by key range across nodes. A key that **always increases** (a timestamp, a sequential ID) sends **every new write to the same node/range** — the "tablet" holding the current max — so one node is saturated while the rest sit idle. Throughput is capped at a single node no matter how many you provision; this is a **hotspot**. **Fix:** design a **well-distributed key** — field-promotion (prefix with a high-cardinality attribute like `userId#timestamp`), salting/hashing a prefix, or reversing the timestamp — so writes spread across the key space. Same principle for Firestore: avoid sequential document IDs and monotonic indexed fields. Both anti-patterns come from ignoring how the platform *physically distributes* work.
