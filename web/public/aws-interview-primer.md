---
type: interview-prep
---

# AWS Interview Primer — 343 Questions

Comprehensive Q+A primer for senior AWS backend / cloud-architecture interviews. Sister note to the language primers ([[Java Interview Primer]], [[C++ Interview Primer]]) — same shape, cloud-flavoured: global infrastructure, IAM, the compute/storage/networking core, databases, event-driven integration, observability, security, cost, and Well-Architected resilience.

Each answer is interview-shaped: opinionated, concrete, real service limits and pricing models, failure modes, and architecture tradeoffs — not a service glossary. Current AWS; mapped to the Well-Architected pillars where it helps.

1. [[#AWS Fundamentals & Global Infrastructure]]
2. [[#IAM & Access Management]]
3. [[#Compute: EC2]]
4. [[#Serverless Compute: Lambda]]
5. [[#Containers: ECS, Fargate & EKS]]
6. [[#Object Storage: S3]]
7. [[#Block & File Storage: EBS, EFS, FSx, Instance Store]]
8. [[#Networking: VPC]]
9. [[#DNS, CDN & Edge: Route 53, CloudFront, Global Accelerator]]
10. [[#Load Balancing: ELB]]
11. [[#Relational Databases: RDS & Aurora]]
12. [[#NoSQL: DynamoDB]]
13. [[#Caching & In-Memory: ElastiCache & DAX]]
14. [[#Messaging & Streaming: SQS, SNS, EventBridge, Kinesis]]
15. [[#Application Integration & Orchestration: API Gateway, Step Functions, AppSync]]
16. [[#Observability: CloudWatch, X-Ray & CloudTrail]]
17. [[#Security Services: KMS, Secrets Manager, WAF, Shield, GuardDuty, Cognito]]
18. [[#Infrastructure as Code & CI/CD]]
19. [[#Cost Optimization & Billing]]
20. [[#Well-Architected, Resilience & Multi-Region DR]]
21. [[#Scenario Design & Common Pitfalls]]

---

## AWS Fundamentals & Global Infrastructure

### Summary

**What this topic covers**

The physical and organizational skeleton every other AWS service hangs off — and the vocabulary every AWS interview opens with before it drills into specific services. Three concern areas live here: (1) the **geography** — Regions, Availability Zones (AZs), edge locations, Local Zones, and Wavelength, and how you choose among them; (2) the **operating contract** — the shared responsibility model, the account/root-user structure, service quotas, the Health Dashboard, and how AWS actually bills you; and (3) the **service taxonomy** — global vs regional vs zonal services and what "highly available" concretely means (multi-AZ). The 16 questions in this topic are the surface; the mental model underneath — *isolation boundaries and blast radius* — is what every later topic (IAM, EC2, VPC, databases) silently assumes you already carry.

**Mental model**

Think of AWS as nested isolation boundaries, largest to smallest: **partition** (aws, aws-cn, aws-us-gov) → **Region** (a physical geography like `eu-west-1`, fully isolated from other Regions) → **Availability Zone** (one or more discrete data centers with independent power/cooling/networking, within a Region, connected by low-latency links) → **data center** → **rack/host**. The single most important design instinct: **a Region is a hard failure and compliance boundary; an AZ is your unit of fault tolerance.** You get reliability by spreading across *multiple AZs* inside one Region; you get disaster recovery and data-residency compliance by choosing *which Region(s)*. Edge locations are a fourth thing entirely — hundreds of PoPs for CloudFront/Route 53, close to users, not where you run workloads. The other shift from on-prem thinking: **AWS runs the infrastructure, you run what's on it** (shared responsibility), and almost everything is soft-limited by a service quota you can raise — capacity is an API call, not a purchase order.

**Key terms**

- **Region** — an isolated geographic area (e.g. `us-east-1`, `eu-west-1`) containing multiple AZs; the primary data-residency and blast-radius boundary. ~30+ Regions globally.
- **Availability Zone (AZ)** — one or more physically separate data centers within a Region, with independent power/cooling/network; your fault-tolerance unit. Each Region has ≥3 (usually 3–6). AZ names (`us-east-1a`) are randomized per account.
- **Edge location / PoP** — 400+ sites serving CloudFront (CDN), Route 53 DNS, and Global Accelerator; caching and DNS, not compute.
- **Local Zone** — an AWS-managed extension of a Region placed in a metro area for single-digit-ms latency to end users; runs a subset of services.
- **Wavelength Zone** — AWS compute/storage embedded in telco 5G networks for ultra-low-latency mobile/edge apps.
- **Shared responsibility model** — AWS is responsible for security *of* the cloud (hardware, hypervisor, facilities); you're responsible for security *in* the cloud (data, IAM, patching guest OS, config).
- **Service quota (limit)** — per-account, usually per-Region caps (e.g. default 5 VPCs/Region, 1000 Lambda concurrency); most are soft and raisable via Service Quotas console/API.
- **AWS Health Dashboard** — Service Health (global status) plus your Account Health (events affecting *your* resources); the authoritative source during an incident.
- **Global vs regional vs zonal service** — IAM/Route 53/CloudFront are global; EC2/S3/RDS are regional; an EC2 instance or EBS volume is zonal (lives in one AZ).
- **Root user** — the identity created with the account, tied to the sign-up email, with unrestricted power; to be locked away, MFA'd, and never used for daily work.

**Why interviewers ask this**

Two signals. (1) **Do you understand blast radius?** Juniors say "AWS is highly available" as if it's automatic; seniors know availability is something *you architect* by spanning AZs, and that a Region-wide event (they happen — `us-east-1` especially) takes down single-Region designs. Asking "AZ vs Region" is really asking "where does your fault tolerance actually come from?" (2) **Operational maturity** — the shared responsibility model, quotas, and the Health Dashboard separate people who've *operated* AWS in production (and been paged) from people who've only deployed a tutorial. Getting the shared responsibility line right — "AWS patches the hypervisor, I patch my EC2 guest OS" — signals you know where your job starts.

**Common confusions**

- "An AZ is a data center" — an AZ is *one or more* data centers; and `us-east-1a` in your account may be a different physical AZ than in mine (names are randomized to balance load).
- "Multi-AZ means multi-Region" — no. Multi-AZ is high availability within one Region; multi-Region is disaster recovery / geo-latency and is a separate, harder problem.
- "Edge locations run my code" — they run CloudFront caching, Route 53, and Lambda@Edge/CloudFront Functions, not your EC2/containers.
- "AWS backs up my data / secures my app" — under shared responsibility, *you* own data durability config, IAM, and app security. AWS owns the infrastructure.
- "Limits are hard caps" — most quotas are soft and raisable; a few (like max EBS volume size) are hard. Assuming a soft limit is permanent leads to bad architecture.

**What follows from this topic**

This is the substrate for everything else. **IAM & Access Management** builds on the account/root-user structure and the "security *in* the cloud" half of shared responsibility. **Compute: EC2** lives inside AZs and inherits the multi-AZ availability story. VPC, RDS, and DynamoDB all express the regional/zonal split you learn here. If you can't cleanly say "Region vs AZ vs edge" and "who's responsible for what," fix that before drilling services — every later answer leaks this vocabulary.

### Q1. What is the difference between a Region, an Availability Zone, and an edge location?

**Region** — an isolated geographic area (e.g. `eu-west-1` in Ireland) containing multiple AZs. It's the top-level blast-radius and data-residency boundary: resources in one Region don't implicitly replicate to another, and a Region-wide outage is your worst realistic AWS failure. You choose a Region; you deploy into it.

**Availability Zone (AZ)** — one or more discrete data centers *within* a Region, with independent power, cooling, and networking, interconnected by high-bandwidth, low-latency links (typically <1–2 ms between AZs). Each Region has at least three. The AZ is your unit of fault tolerance: put instances/subnets in ≥2 AZs and a single-AZ failure doesn't take you down.

**Edge location** — one of 400+ points of presence used by CloudFront (CDN), Route 53 (DNS), and Global Accelerator. They cache content and terminate connections close to users for latency; they are *not* where you run EC2, containers, or databases.

One-liner: **Region = geography + compliance; AZ = fault tolerance; edge = latency to users.**

### Q2. What are Local Zones and Wavelength Zones, and when would you use them?

Both extend AWS closer to users than a full Region can.

**Local Zone** — an AWS-managed infrastructure deployment in a large metro (e.g. Los Angeles, connected to `us-west-2`) offering a subset of services (some EC2 families, EBS, ECS, EKS) with single-digit-millisecond latency to that metro. Use it for latency-sensitive workloads — real-time gaming, media rendering, interactive AR/VR, or local data-processing — where routing to the parent Region adds too much latency.

**Wavelength Zone** — AWS compute and storage embedded *inside* a telecom carrier's 5G network. Traffic from mobile devices reaches your app without leaving the carrier network to hit the internet, giving ultra-low latency. Use it for 5G edge apps: connected vehicles, live video, IoT with tight latency budgets.

Rule of thumb: start in a Region; reach for a Local Zone when a specific metro needs sub-10-ms latency; reach for Wavelength only when the latency budget is dominated by the mobile/carrier hop. Both are opt-in and cost more per unit than the parent Region.

### Q3. How do you choose which AWS Region to deploy in?

Four factors, roughly in priority order:

1. **Compliance / data residency** — if regulation (GDPR, data-sovereignty laws, sector rules) requires data to stay in a jurisdiction, that often *decides* the Region outright. This trumps the rest.
2. **Latency to users** — pick the Region geographically closest to your primary user base; test with real latency, not just a map.
3. **Service availability** — new services and features launch in `us-east-1` first and roll out unevenly. Confirm every service you need exists in the target Region before committing.
4. **Cost** — pricing varies by Region (often `us-east-1` is cheapest; regions like São Paulo or some APAC regions cost more). For a fixed architecture, Region choice can swing the bill 10–30%.

Secondary considerations: proximity to other AWS services/accounts you integrate with, and disaster-recovery pairing (a second, geographically distant Region). Don't default blindly to `us-east-1` — it's cheap and feature-complete but also the most outage-prone and busiest Region.

### Q4. Explain the AWS shared responsibility model.

AWS splits security and operational responsibility into two halves:

- **AWS — security *of* the cloud**: physical facilities, hardware, the hypervisor, the network backbone, and the managed-service software AWS operates. You never patch a hypervisor or guard a data center door.
- **Customer — security *in* the cloud**: your data, IAM configuration, network/firewall rules (security groups, NACLs), encryption choices, and — for IaaS like EC2 — the guest OS, its patches, and everything you install on it.

The line **moves with the service abstraction**:

| Service type | You manage | AWS manages |
|---|---|---|
| EC2 (IaaS) | Guest OS + patches, app, data, IAM, firewall | Hypervisor, hardware, facilities |
| RDS (managed) | Data, IAM, network, some config | OS patching, DB engine patching, hardware |
| S3 / Lambda (serverless) | Data, IAM, access policy | OS, runtime, scaling, hardware |

The senior tell is naming *concrete* items: "AWS patches the RDS engine, but I still own who can connect and whether it's encrypted." The most common breach cause on AWS — public S3 buckets and over-broad IAM — sits squarely on the customer side.

### Q5. What's the difference between global, regional, and zonal AWS services?

- **Global** — one namespace across all Regions. **IAM** (users, roles, policies), **Route 53** (DNS), **CloudFront** (CDN), and **WAF** for CloudFront are global. An IAM role is visible from every Region.
- **Regional** — scoped to a single Region; you provision the same service independently in each Region you use. **S3** (bucket names are global, but the data and bucket live in one Region), **DynamoDB**, **SQS**, **Lambda**, and the **EC2 service** are regional.
- **Zonal** — pinned to a single AZ. A specific **EC2 instance**, an **EBS volume**, and a subnet all live in exactly one AZ; if that AZ fails, they're unavailable.

Why it matters: it tells you *where redundancy has to come from*. A zonal resource (EC2 instance, EBS volume) needs you to run copies across AZs. A regional service (DynamoDB) is already multi-AZ under the hood. A global service (Route 53) you configure once. Mislabeling — e.g. assuming S3 is global and cross-Region by default — leads to broken DR assumptions (S3 is regional; cross-Region replication is opt-in).

### Q6. How do you access and interact with AWS?

Four primary interfaces, same underlying APIs:

- **Management Console** — the web UI. Great for exploration, one-off tasks, and viewing dashboards; poor for anything repeatable or auditable.
- **AWS CLI** — command-line access (`aws s3 ls`, `aws ec2 describe-instances`). Scriptable, uses named profiles/credentials, ideal for automation and CI.
- **SDKs** — language libraries (boto3 for Python, AWS SDK for JS/Java/Go, etc.) for building AWS calls into applications.
- **CloudShell** — a browser-based shell with the CLI and your console credentials pre-loaded; handy for quick commands without configuring local credentials.

Under all four, calls hit the same REST/JSON APIs and are authenticated with SigV4 signatures and authorized by IAM. In production you almost never click the console for changes — you use **infrastructure as code** (CloudFormation, CDK, Terraform) on top of these APIs, so changes are versioned, reviewed, and reproducible. Interactive console changes ("ClickOps") are a drift-and-audit hazard.

### Q7. What are service quotas (limits) and how do you handle hitting them?

**Service quotas** are per-account, usually per-Region caps on resource usage — e.g. a default of 5 VPCs per Region, 1000 concurrent Lambda executions, or a default vCPU limit for On-Demand EC2. They exist to protect AWS capacity and to protect *you* from runaway spend from a bug or attack.

Two kinds:
- **Soft limits** — the default that can be raised on request via the **Service Quotas** console or API (and historically via support). Most limits are soft.
- **Hard limits** — architectural caps that can't be raised (e.g. maximum EBS volume size, S3 object max size).

Handling them well: (1) **know your defaults before launch** — a marketing launch that needs 3000 concurrent Lambdas will throttle at the default 1000; (2) **request increases ahead of time** — raises aren't always instant; (3) **monitor with CloudWatch** — Service Quotas integrates so you can alarm at, say, 80% of a quota; (4) **design around hard limits** rather than fighting them. Treating a soft quota as a permanent constraint (or ignoring it until launch day) is a classic self-inflicted outage.

### Q8. What is the AWS Health Dashboard and how does it differ from the public status page?

There are two views:

- **Service Health (public)** — the global, all-customers status page showing broad service/Region health. It's conservative and often lags a real incident, because it only turns red for widespread events.
- **Your Account Health** — personalized events that affect *your specific resources*: scheduled maintenance on your instances, deprecations, resource-impacting incidents, and required actions. This is the one that matters operationally.

During an incident, the Account Health view (backed by the **AWS Health API**, available on Business+ support) is the authoritative source for "is this AWS or is this me?" You can wire the Health API into EventBridge to auto-trigger runbooks — e.g. drain traffic from an AZ AWS flags as impaired. The junior mistake is refreshing the public status page (green while you're clearly broken) instead of checking your account-scoped events. Also: your own dashboards/alarms often detect impact before AWS posts anything.

### Q9. Explain the AWS account root user and how it should be managed.

The **root user** is the identity created when the account is opened, tied to the sign-up email address and password. It has **complete, unrestricted access** and a handful of actions *only* it can perform (closing the account, changing the account name/email, changing support plan, restoring certain IAM misconfigurations, some billing settings).

Because it can't be scoped down by IAM policy, treat it as a break-glass credential:

- **Enable MFA on it** (ideally a hardware key), immediately.
- **Delete or never create root access keys** — programmatic root keys are one of the most dangerous credentials that can exist.
- **Don't use it for daily work** — create IAM users/roles (or, better, IAM Identity Center) for humans and workloads.
- **Lock away the credentials** and use it only for the few root-only tasks.

In an AWS Organizations setup, the management (payer) account's root user is especially sensitive. A compromised root user is effectively game-over for the account, which is why every security baseline (CIS, Well-Architected) leads with "secure the root user."

### Q10. What does high availability mean on AWS, and how do you achieve it?

**High availability (HA)** means the system keeps serving despite the failure of individual components. On AWS the primary lever is **multi-AZ deployment**: run redundant capacity in ≥2 (ideally 3) Availability Zones behind a load balancer or a managed service that spans AZs, so losing one AZ degrades capacity but not availability.

Concretely:
- **Compute** — an Auto Scaling Group spanning multiple AZs behind an ALB/NLB; if an AZ or instance dies, health checks reroute and ASG replaces capacity.
- **Databases** — RDS Multi-AZ (synchronous standby in another AZ with automatic failover); DynamoDB and S3 are multi-AZ by default.
- **Stateless design** — keep app servers stateless so any AZ can serve any request; push state to multi-AZ stores.

HA (within a Region) is distinct from **disaster recovery** (surviving a whole-Region loss, which needs multi-Region). And HA isn't free or automatic — a single-AZ RDS instance or a one-AZ ASG *looks* fine until that AZ has a bad day. The Well-Architected reliability pillar is largely "have you actually spread across AZs, and have you tested failover?"

### Q11. What are CloudFront and edge networking, at a high level?

**CloudFront** is AWS's content delivery network (CDN): a globally distributed set of edge locations that cache content close to users. A request goes to the nearest edge; on a cache hit it's served from the edge (fast, and it offloads your origin); on a miss the edge fetches from the origin (S3, an ALB, or any HTTP server) and caches it.

Why it matters beyond static assets:
- **Latency** — TLS termination and caching near users cut round trips.
- **Origin offload & cost** — fewer requests reach your origin; egress via CloudFront is often cheaper than direct from S3/EC2.
- **Security** — integrates with AWS WAF and Shield for DDoS/app-layer protection, and enforces HTTPS.
- **Edge compute** — CloudFront Functions (lightweight, viewer request/response) and Lambda@Edge (heavier logic) let you run code at the edge for redirects, header manipulation, or auth.

Related edge services: **Route 53** (global DNS with latency/geo/failover routing) and **Global Accelerator** (anycast IPs that pull user traffic onto the AWS backbone early). Together they form the "get the user onto AWS's network fast" layer that sits in front of your regional workloads.

### Q12. How does AWS billing work at a high level?

AWS is **pay-as-you-go and metered per service** — you're billed for what you consume, with no upfront commitment by default. The dominant cost dimensions:

- **Compute** — per second/hour for EC2, per request + duration (GB-seconds) for Lambda.
- **Storage** — per GB-month (S3, EBS), tiered by storage class.
- **Data transfer** — inbound is generally free; **outbound to the internet and cross-Region/cross-AZ transfer costs money** and is a notorious surprise on bills.
- **Requests/operations** — per-request charges (S3 GET/PUT, API Gateway calls, DynamoDB read/write units).

Cost-saving levers: **Reserved Instances / Savings Plans** (commit 1–3 years for big discounts), **Spot** (spare capacity, up to ~90% off), storage-class tiering, and turning off idle resources. Tooling: **Cost Explorer** (analysis/forecasts), **Budgets** (alerts at thresholds), **Cost and Usage Reports** (granular data), and **cost allocation tags** to attribute spend to teams/projects. Consolidated billing under **AWS Organizations** aggregates accounts and pools volume/commitment discounts. The classic senior insight: *data transfer and idle/over-provisioned resources — not compute rates — are where bills quietly balloon.*

### Q13. What are AWS support plans and how do you choose one?

Four tiers, increasing in price and speed:

| Plan | Best for | Key features |
|---|---|---|
| **Basic** (free) | Everyone | Docs, forums, Health Dashboard, core Trusted Advisor checks |
| **Developer** | Experimentation / non-prod | Business-hours email support, general guidance |
| **Business** | Production workloads | 24/7 phone/chat/email, **full Trusted Advisor**, **Health API**, <1h response for production-down |
| **Enterprise On-Ramp / Enterprise** | Business/mission-critical | Everything above + a **Technical Account Manager (TAM)**, <15-min critical response, well-architected reviews, IEM |

Rule of thumb: any real **production** workload wants at least **Business** (you need 24/7 support and the Health API for automation). **Enterprise** is for organizations that need a TAM, proactive guidance, and the fastest SLAs. Note the two commonly-tested Business-plan unlocks: **full Trusted Advisor** (all cost/security/fault-tolerance/limit checks) and the **AWS Health API** for programmatic incident response.

### Q14. What is data residency and sovereignty on AWS, and how do you enforce it?

**Data residency** = *where* your data physically lives; **data sovereignty** = which country's laws govern it. Because a **Region is a hard geographic boundary**, Region choice is your primary control — data you put in `eu-west-1` stays in the EU unless you explicitly move it.

Enforcement mechanisms:
- **Pick compliant Region(s)** and don't deploy the workload elsewhere.
- **Service Control Policies (SCPs)** in AWS Organizations to *deny* actions outside approved Regions org-wide (e.g. deny all requests where `aws:RequestedRegion` isn't in an allow-list).
- **S3 Block Public Access + bucket policies**, and disabling/limiting cross-Region replication so data doesn't silently egress.
- **AWS Control Tower / guardrails** to codify region and encryption requirements across accounts.
- For strict sovereignty needs, the **AWS European Sovereign Cloud** and specialized partitions (GovCloud, China) provide stronger isolation and operator controls.

The subtlety interviewers probe: some services are **global** (IAM, some CloudFront/Route 53 metadata) and edge caching can move content globally — so "just pick an EU Region" isn't automatically sufficient; you must also constrain global-service usage and CDN behavior.

### Q15. You deployed an app in a single Availability Zone and it went down when AWS had an AZ issue. What went wrong and how do you fix it?

**What went wrong:** the app had **no fault tolerance below the Region level.** Everything — instances, and likely a single-AZ database and single-AZ dependencies — lived in one AZ, so an AZ-level power/network event took the whole app offline. This is the single most common self-inflicted availability failure on AWS.

**The fix — spread across AZs:**
1. **Compute** — put an **Auto Scaling Group across ≥2–3 AZs** behind an **ALB/NLB**. Health checks detect the dead AZ's instances and route around them; ASG relaunches capacity in healthy AZs.
2. **Subnets** — create subnets in each AZ so the load balancer and instances actually have somewhere to live per AZ.
3. **Database** — switch to **RDS Multi-AZ** (synchronous standby + automatic failover) or use a natively multi-AZ store (DynamoDB, Aurora).
4. **State** — make app servers stateless; push sessions/state to a multi-AZ store (DynamoDB, ElastiCache Multi-AZ) so any AZ can serve any request.

**Then test it:** actually fail an AZ (or an instance) in a game day and confirm recovery. HA you haven't tested is a hypothesis. For surviving a *whole-Region* outage you'd go further — multi-Region DR — but AZ redundancy is the non-negotiable baseline and would have prevented this outage.

### Q16. When would you choose a multi-Region architecture over a multi-AZ one, and what does it cost you?

**Multi-AZ is the default** for high availability and handles the overwhelming majority of failures (instance, rack, whole-AZ) within one Region, cheaply and with managed-service support (RDS Multi-AZ, cross-AZ ASGs). Reach past it to **multi-Region** only for specific drivers:

- **Disaster recovery** from a full-Region outage (rare but real — `us-east-1` has had them).
- **Global low latency** — serving users on multiple continents from a nearby Region.
- **Data-residency** requirements that force data into specific geographies.
- **Regulatory/RTO-RPO mandates** demanding regional independence.

The cost is steep and worth stating plainly: **cross-Region data transfer charges**, **data-replication complexity and lag** (async replication means potential data loss / eventual consistency on failover), **doubled infrastructure spend** for warm/hot standbys, **harder consistency and routing** (Route 53 failover, Global Accelerator), and **much harder testing**. DR strategies scale in cost/complexity: **backup-and-restore < pilot light < warm standby < active-active**. The senior answer resists jumping to multi-Region: most teams asking for it actually need solid multi-AZ plus tested backups first. Choose multi-Region when a *quantified* RTO/RPO or a compliance rule demands it — not for a vague sense of "extra safe."

## IAM & Access Management

### Summary

**What this topic covers**

AWS's authorization system — the single most security-critical and most frequently misconfigured part of the platform. Three concern areas live here: (1) the **identities** — users, groups, roles, and the machine-to-machine trust that roles enable; (2) the **policies** — the JSON documents that grant or deny access, their structure, and the exact evaluation logic AWS runs on every request; and (3) the **guardrails and patterns** — permission boundaries, SCPs, IAM Identity Center, federation, MFA, ABAC, and least-privilege tooling. The 18 questions in this topic map to where real breaches happen: over-broad policies, leaked long-lived access keys, and confused-deputy cross-account holes. If you can reason about *"principal + action + resource + condition, evaluated as explicit-deny-wins,"* you can reason about AWS security.

**Mental model**

Every AWS API call is an **authorization decision**: a *principal* (who) requests an *action* (what) on a *resource* (which), possibly with *conditions* (context — source IP, MFA, tags, time). IAM answers **allow or deny** by evaluating all applicable policies. The mental model that unlocks everything: **deny by default; you need an explicit `Allow`; a single explicit `Deny` anywhere overrides every `Allow`.** Prefer **roles over users** — a role is a set of permissions with *no long-lived credentials*; principals *assume* it and get **temporary credentials** from STS (minutes to hours), which is dramatically safer than static access keys that leak into git and stay valid forever. The second shift: **stop thinking "give the human/app keys," start thinking "let the identity assume a role."** EC2 gets an instance profile, a Lambda gets an execution role, a user in another account assumes a cross-account role, an employee federates via IAM Identity Center into a role. Long-lived access keys are the exception you should be able to justify — and usually can't.

**Key terms**

- **IAM user** — a long-lived identity for a person or app, with a password and/or access keys. Use sparingly; prefer roles/Identity Center.
- **IAM group** — a collection of users for attaching shared policies. Not a principal — you can't "assume" a group.
- **IAM role** — an identity with permissions but *no permanent credentials*; assumed by principals to get temporary STS credentials. The workhorse of good AWS security.
- **Identity-based policy** — attached to a user/group/role, granting it permissions ("what can this identity do?").
- **Resource-based policy** — attached to a resource (S3 bucket, SQS queue, KMS key), naming who may access it, including cross-account principals.
- **STS (Security Token Service)** — issues temporary, expiring credentials via `AssumeRole`, federation, etc.
- **Permission boundary** — an identity-based policy that sets the *maximum* permissions a user/role can have; effective perms = intersection of boundary and granted policy.
- **Service Control Policy (SCP)** — an Organizations-level guardrail capping permissions for whole accounts/OUs; never *grants*, only limits.
- **IAM Identity Center** — successor to AWS SSO; central workforce sign-in and role assignment across many accounts, with federation to your IdP.
- **Instance profile** — the container that delivers a role's temporary credentials to an EC2 instance.
- **ABAC** — attribute-based access control: authorize on **tags** (on principal and resource) instead of enumerating resources.
- **Principle of least privilege** — grant only the permissions actually needed, and no more.

**Why interviewers ask this**

IAM is where cloud security lives, so it's a proxy for "will you cause a breach?" (1) **Do you default to safe patterns?** The junior instinct is "create a user, generate access keys, paste them in." The senior instinct is "roles and temporary credentials; keys only when unavoidable." That single reflex — plus knowing *why* (leaked static keys are the #1 AWS credential-compromise vector) — is worth more than memorizing policy syntax. (2) **Can you reason about policy evaluation precisely?** The explicit-deny-wins rule, the intersection semantics of permission boundaries and SCPs, and the confused-deputy problem separate people who've *debugged* an access issue from people who've only read the docs. (3) **Do you know least privilege operationally** — Access Analyzer, generating policies from CloudTrail, tightening over time — versus reciting the phrase?

**Common confusions**

- "Roles and users are interchangeable" — no. Users have long-lived credentials; roles have none and issue *temporary* ones on assumption. Roles are the safer default.
- "SCPs grant permissions" — they never grant. An SCP can only *cap* what identity-based policies could otherwise allow. You still need an `Allow` somewhere.
- "Permission boundary = the permissions" — a boundary is a ceiling, not a grant; effective permissions are the *intersection* of the boundary and the attached policies.
- "Deny and allow are symmetric" — they're not. An explicit `Deny` always wins; there's no "allow override." Order doesn't matter, deny does.
- "Cross-account access needs shared credentials" — no; the other account assumes a **role** you trust, or you use a resource-based policy. Never share keys across accounts.
- "MFA protects the API" — MFA protects sign-in, but API calls need MFA enforced via a policy `Condition` (`aws:MultiFactorAuthPresent`); it's not automatic.

**What follows from this topic**

IAM underpins every other AWS service. **Compute: EC2** relies on instance profiles/roles to grant apps access without embedded keys. Every data service (S3, DynamoDB, KMS) is governed by the identity- and resource-based policy interplay you learn here. **AWS Fundamentals**' root-user and account structure is the identity foundation this topic extends. Get the evaluation logic and the roles-over-keys reflex solid — nearly every "how would you secure X" answer in later topics resolves to an IAM policy and a role.

### Q1. What's the difference between IAM users, groups, and roles?

- **User** — a long-lived identity for one person or application, with permanent credentials (console password and/or access keys). Because those credentials don't expire on their own, users are the *riskiest* identity type and should be minimized.
- **Group** — a container for users so you can attach one policy to many people (e.g. an `Admins` or `Developers` group). A group is **not a principal** — nothing assumes a group, it just organizes users and their permissions. Users can belong to multiple groups.
- **Role** — an identity with a permission set but **no permanent credentials**. Principals (an EC2 instance, a Lambda, a user in another account, a federated employee) *assume* the role and receive **temporary credentials from STS** that expire in minutes to hours.

The senior framing: **prefer roles.** Users/groups fit a small set of humans or legacy apps that genuinely need static keys; everything else — workloads, cross-account access, federated humans — should assume roles and use temporary credentials. That's the difference between "keys that leak into git and stay valid forever" and "credentials that expire in an hour."

### Q2. Explain identity-based vs resource-based policies.

Both are JSON policies, but they attach to different things and answer different questions.

- **Identity-based policy** — attached to an IAM user, group, or role. It answers *"what can this identity do?"* Example: a role's policy allowing `s3:GetObject` on `arn:aws:s3:::my-bucket/*`.
- **Resource-based policy** — attached to the *resource* (S3 bucket policy, SQS queue policy, KMS key policy, Lambda resource policy). It answers *"who can access this resource?"* and names a `Principal` explicitly — including principals in **other accounts**.

Key differences and why it matters:
- Resource-based policies are the clean way to grant **cross-account** access — the bucket in account A names a principal in account B; no role assumption or shared keys needed for that resource.
- Only *some* services support resource-based policies (S3, SQS, SNS, KMS, Lambda, etc.); most don't, so cross-account there means AssumeRole.
- For access to succeed **within the same account**, an allow in *either* the identity-based *or* resource-based policy is generally sufficient; **across accounts**, you typically need an allow in *both* (the identity in account B must be allowed, and account A's resource policy must permit account B). And an explicit deny in either kills it.

### Q3. Walk through the structure of an IAM policy JSON document.

A policy is a document of one or more **statements**, each with these elements:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadOneBucket",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "IpAddress": { "aws:SourceIp": "203.0.113.0/24" }
      }
    }
  ]
}
```

- **Version** — always `"2012-10-17"` (the policy language version, not a date you pick).
- **Sid** — optional statement identifier for readability.
- **Effect** — `Allow` or `Deny`.
- **Action** — the API actions (`s3:GetObject`), supporting wildcards (`s3:*`).
- **Resource** — the ARN(s) the statement applies to; `*` means all. Note some actions need the bucket ARN *and* the object ARN (`/*`).
- **Principal** — *who* the statement applies to. Required in **resource-based** policies; omitted in identity-based ones (the identity it's attached to is the principal).
- **Condition** — optional gating on request context: source IP, `aws:MultiFactorAuthPresent`, tags (`aws:RequestTag`, `aws:PrincipalTag`), `aws:RequestedRegion`, etc.

The senior habit: scope `Action` and `Resource` tightly (no `"*":"*"`), and reach for `Condition` to add MFA/IP/tag constraints rather than granting broadly.

### Q4. Explain IAM policy evaluation logic. What wins — allow or deny?

AWS evaluates **all applicable policies together** for each request and resolves to allow or deny by these rules, in order of precedence:

1. **Explicit `Deny`** — if *any* policy (identity, resource, SCP, permission boundary, session policy) contains a matching `Deny`, the request is **denied**. Nothing overrides an explicit deny.
2. **Explicit `Allow`** — if there's no explicit deny and at least one policy grants a matching `Allow` (and it isn't capped out by an SCP or boundary), the request is **allowed**.
3. **Implicit deny (default)** — if nothing explicitly allows it, it's **denied** by default.

So the mantra is **explicit deny > explicit allow > implicit deny (default deny).** Order within a document doesn't matter — a deny anywhere beats an allow anywhere.

For an allow to actually go through, the request must survive *every* relevant boundary simultaneously: the identity policy allows it, the resource policy doesn't deny it (and for cross-account, allows it), the **SCP** permits it, and the **permission boundary** permits it. Any one of them saying deny — or simply not allowing, in the case of SCPs/boundaries — blocks the call. This layered "AND of allows, OR of denies" is exactly why debugging "access denied" means checking *all* the layers, not just the identity policy.

### Q5. What is the confused-deputy problem and how does AWS mitigate it?

The **confused deputy** is a privileged intermediary tricked into using its authority on behalf of an attacker. On AWS the classic case is cross-account roles: you let a third-party SaaS (the "deputy") assume a role in your account to do its job. If the SaaS assumes that role using only a predictable identifier, an attacker who's *also* their customer could trick the SaaS into assuming *your* role instead of theirs — the deputy is confused about whose behalf it's acting on.

**Mitigations:**
- **External ID** — the trust policy requires an `sts:ExternalId` condition; the SaaS must present a secret value unique to your account when assuming the role. An attacker doesn't know your External ID, so they can't induce the deputy to assume your role.
- **`aws:SourceArn` / `aws:SourceAccount` conditions** — for AWS service principals (e.g. an S3 bucket triggering your SNS/Lambda), constrain the trust/resource policy so only the *specific* source resource/account can invoke, not any resource of that service.

```json
"Condition": {
  "StringEquals": { "sts:ExternalId": "unique-secret-per-tenant" }
}
```

The interview signal: recognizing that "let a third party assume a role in my account" is inherently a confused-deputy risk, and that the External ID condition (not a shared secret in code) is the correct fix.

### Q6. What is STS and how does AssumeRole work?

**STS (Security Token Service)** issues **temporary, expiring security credentials** — an access key ID, secret key, and *session token* — that grant a role's permissions for a limited time (15 minutes up to 12 hours; default 1 hour).

**AssumeRole flow:**
1. A principal calls `sts:AssumeRole` on a target role's ARN.
2. AWS checks the role's **trust policy** (who is *allowed* to assume it) and the caller's permission to call AssumeRole.
3. If permitted, STS returns temporary credentials scoped to the role's permissions (optionally further narrowed by a **session policy**).
4. The caller uses those credentials until they expire, then re-assumes for fresh ones.

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/CrossAccountRead \
  --role-session-name alice-session
```

Why it matters: this is the mechanism behind **almost all good AWS access patterns** — EC2 instance profiles, Lambda execution roles, cross-account access, and federated humans all boil down to STS handing out short-lived credentials. Because they expire, a leaked session token is far less dangerous than a leaked long-lived access key. Variants: `AssumeRoleWithSAML` (enterprise SAML IdP) and `AssumeRoleWithWebIdentity` (OIDC — Google, Cognito, and EKS IRSA/pod identity).

### Q7. What is an instance profile and why not just put access keys on the EC2 instance?

An **instance profile** is the container that lets an EC2 instance assume an **IAM role**. You attach a role (wrapped in an instance profile) to the instance; AWS then delivers the role's **temporary credentials** to the instance via the **Instance Metadata Service (IMDS)**, and the SDK/CLI on the instance picks them up automatically and rotates them before expiry.

Why this beats baking access keys onto the box:
- **No long-lived secrets on disk** — nothing to leak in an AMI, a snapshot, a log, or a compromised app. Static keys in `~/.aws/credentials` on an instance are a breach waiting to happen.
- **Automatic rotation** — IMDS refreshes credentials continuously; you never manage or rotate keys.
- **Least privilege per workload** — each instance/ASG gets exactly the role it needs.

```bash
# On the instance, the SDK auto-discovers creds; nothing hardcoded:
aws s3 ls s3://my-bucket
```

The correct answer to "how does my app on EC2 get AWS access?" is *always* an instance profile/role — never embedded access keys. (And protect IMDS itself with **IMDSv2**, session-token-based, to defend against SSRF exfiltration of those credentials.)

### Q8. What are permission boundaries and when do you use them?

A **permission boundary** is an identity-based policy that defines the **maximum permissions** an IAM user or role can ever have. It doesn't *grant* anything — it *caps*. The identity's **effective permissions = the intersection** of (its attached permission policies) AND (its permission boundary). If the boundary doesn't allow an action, no attached policy can enable it.

The primary use case is **safe delegation**: you let developers create their own IAM roles/users (e.g. for their Lambdas) but require every one they create to have a permission boundary you define. That way a developer can grant their function `dynamodb:*` on their tables, but *cannot* create a role that grants `iam:*` or touches production billing — the boundary caps it. It's how you decentralize IAM management without handing out privilege escalation.

Contrast with **SCPs**: SCPs cap whole *accounts/OUs* (Organizations level); permission boundaries cap *individual users/roles* (account level). They stack — effective permissions must satisfy the identity policy AND the boundary AND the SCP. Boundaries are the tool when the answer to "how do I let this team self-serve IAM without them being able to escalate?" comes up.

### Q9. What are Service Control Policies and how do they relate to AWS Organizations?

**AWS Organizations** lets you manage many AWS accounts centrally under a management (payer) account, grouped into **Organizational Units (OUs)**. **Service Control Policies (SCPs)** are guardrails you attach to the org root, an OU, or an account that **define the maximum permissions available to everything in that scope**.

Critical properties:
- **SCPs never grant permissions** — they only *cap* what identity-based policies in those accounts could otherwise allow. You still need an `Allow` in an IAM policy for anything to work.
- **They apply to everyone in the account, including admins** — even the account's IAM administrators can't exceed the SCP. (The management account itself is exempt, which is why you don't run workloads there.)
- **Effective permission = intersection** of SCP ∩ identity policy ∩ permission boundary.

Typical uses: deny access to Regions you don't operate in (`aws:RequestedRegion` guardrail for data residency), block disabling of CloudTrail/GuardDuty, prevent leaving the org, or restrict expensive/dangerous services org-wide.

```json
{ "Effect": "Deny", "Action": "*", "Resource": "*",
  "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1"] } } }
```

The signal: knowing SCPs are a **ceiling, not a grant**, and that they're the tool for org-wide, un-overridable guardrails — the thing you reach for when "no account in this org may ever do X" is the requirement.

### Q10. What is IAM Identity Center and why use it over IAM users?

**IAM Identity Center** (the successor to AWS SSO) is the central place to manage **workforce access across many AWS accounts**. Instead of creating IAM users in each account, you connect an identity source — the built-in directory, or (better) your corporate IdP via **SAML/OIDC** (Okta, Entra ID, Google) — and assign people to **permission sets** (reusable role templates) in the accounts they need.

Why it's the modern default:
- **No long-lived IAM users for humans** — people sign in through your IdP and get **temporary credentials** for a role in the target account. Nothing to leak, everything expires.
- **Central lifecycle** — deprovision someone in your IdP and their AWS access vanishes everywhere; no per-account cleanup.
- **One login across all accounts** — a portal listing every account/role a person can use, plus CLI/SDK access via short-lived sessions (`aws sso login`).
- **MFA and Conditional Access** enforced at your IdP.

The one-liner: **IAM users are for the small set of legacy apps/service accounts that truly need static keys; humans should sign in via Identity Center and assume roles.** In a multi-account org, provisioning IAM users per account is an anti-pattern — Identity Center replaces it.

### Q11. Explain the principle of least privilege and how IAM Access Analyzer helps.

**Least privilege** means granting an identity only the permissions it actually needs to do its job — no more — and tightening over time. It shrinks blast radius: a compromised credential or a buggy app can only do what its narrow policy allows. The anti-pattern is the `"Action":"*","Resource":"*"` "just make it work" policy, which turns any compromise into a full account takeover.

**IAM Access Analyzer** helps operationalize it:
- **External access findings** — it continuously analyzes resource policies (S3, IAM roles, KMS, SQS, etc.) and flags anything granting access to **outside your account/org** — the fast way to catch a bucket or role accidentally shared publicly or cross-account.
- **Policy generation** — it can generate a **least-privilege policy from CloudTrail history**, i.e. "here are the actions this role *actually used* in the last N days" — so you start tight instead of guessing.
- **Policy validation** — lints policies against best practices and warns on overly broad grants.
- **Unused access findings** — flags permissions/roles that haven't been used, so you can prune.

The senior workflow: start restrictive, generate/refine from real CloudTrail usage, run Access Analyzer to catch external exposure and unused grants, and iterate — rather than granting broad and never revisiting.

### Q12. How does MFA work in IAM and how do you enforce it for API calls?

**MFA (multi-factor authentication)** adds a second factor — a TOTP app, a hardware key (FIDO2/U2F), or a hardware TOTP device — on top of the password, so a leaked password alone can't grant access. First priority: **enable MFA on the root user** and on all privileged identities.

The subtlety interviewers probe: MFA protects **console sign-in** automatically, but it does **not** automatically gate **API/CLI** calls. To require MFA for sensitive API actions you add a **policy condition** on `aws:MultiFactorAuthPresent`:

```json
{
  "Effect": "Deny",
  "Action": ["iam:*", "ec2:TerminateInstances"],
  "Resource": "*",
  "Condition": { "BoolIfExists": { "aws:MultiFactorAuthPresent": "false" } }
}
```

This denies the actions unless the caller's session was established with MFA. A common pattern is a role you can only *assume* with MFA (`aws:MultiFactorAuthPresent` in the trust/permission policy), so privileged operations require the user to re-authenticate with their second factor. The mistake is assuming "we turned on MFA" covers programmatic access — it doesn't unless you enforce it in policy.

### Q13. Access keys vs roles — when is it ever OK to use long-lived access keys?

**Default answer: almost never for anything that can use a role.** Long-lived access keys (an access key ID + secret) don't expire on their own, so they're the credential most likely to leak into git, CI logs, container images, or a laptop — and stay valid until someone notices. Compromised static keys are the leading cause of AWS account takeovers.

**Use roles / temporary credentials instead:**
- **On EC2/ECS/EKS** → instance profile / task role / IRSA.
- **On Lambda** → execution role.
- **For humans** → IAM Identity Center federation → assume role.
- **Cross-account** → AssumeRole or resource-based policy.
- **CI/CD (e.g. GitHub Actions)** → **OIDC federation** to assume a role — no stored keys at all.

**The narrow legitimate cases for static keys:** a truly on-premises or third-party system that *cannot* assume a role and has no OIDC/SAML path, or a legacy tool with no IAM-role support. Even then: scope them minimally, **rotate regularly**, store them in a secrets manager (never in code), and monitor with CloudTrail/Access Analyzer for unused keys. If you're reaching for `aws configure` and pasting a static key into an app, the interviewer wants you to first ask "why can't this assume a role?"

### Q14. Explain federation and the roles of OIDC and SAML in AWS access.

**Federation** lets identities from an **external identity provider (IdP)** access AWS without AWS-native IAM users — they authenticate with the IdP and receive **temporary AWS credentials** by assuming a role. It's how you avoid creating (and leaking) per-user IAM credentials.

Two protocols:
- **SAML 2.0** — the enterprise/workforce standard. Your corporate IdP (Okta, Entra ID, ADFS) asserts identity via a SAML assertion; the user calls `sts:AssumeRoleWithSAML` (usually behind IAM Identity Center) to get role credentials. Used for employees signing into AWS via corporate SSO.
- **OIDC (OpenID Connect)** — the modern, token-based (JWT) standard, common for **web/mobile apps and CI/CD and workloads**. `sts:AssumeRoleWithWebIdentity` exchanges an OIDC token for AWS credentials. Examples: **Amazon Cognito** for app users, **GitHub Actions OIDC** to assume a deploy role with zero stored secrets, and **EKS IRSA / Pod Identity** where a Kubernetes service account's OIDC token maps to an IAM role.

The unifying idea: **federation replaces long-lived AWS credentials with "authenticate at your IdP, then assume a role for short-lived credentials."** SAML for workforce SSO, OIDC for apps and automation. Naming GitHub Actions OIDC as the fix for "stop storing AWS keys in CI secrets" is a strong senior signal.

### Q15. What is ABAC and how does it differ from RBAC on AWS?

**ABAC (attribute-based access control)** authorizes based on **tags** (attributes) on the principal and the resource, evaluated in policy conditions — rather than enumerating specific resources. **RBAC (role-based)** grants permissions to named resources or resource patterns per role.

The canonical ABAC pattern: a single policy that grants access **only when the principal's tag matches the resource's tag**:

```json
{
  "Effect": "Allow",
  "Action": "ec2:StartInstances",
  "Resource": "*",
  "Condition": {
    "StringEquals": { "aws:ResourceTag/team": "${aws:PrincipalTag/team}" }
  }
}
```

Here any user tagged `team=payments` can start any instance tagged `team=payments` — one policy, no per-team edits.

**Why ABAC scales better:** with RBAC you create/maintain a role per team/project and edit policies whenever resources are added. With ABAC you **tag new resources and users**, and the *same* policy automatically grants the right access — no policy churn as the org grows. It shines in large, multi-team, fast-growing environments and pairs naturally with Identity Center (map IdP attributes → principal tags). Tradeoff: it demands **disciplined, enforced tagging** (often via SCPs/Tag Policies requiring tags on creation) — sloppy tags mean broken or over-broad access. RBAC stays simpler for small, stable environments.

### Q16. What's the difference between authentication and authorization in AWS?

- **Authentication (AuthN)** — *proving who you are.* Verifying the identity behind a request: signing in with a password + MFA, presenting valid access keys, or exchanging a SAML/OIDC token. AWS validates the request's **SigV4 signature** / session token to establish the principal.
- **Authorization (AuthZ)** — *determining what that proven identity may do.* Once AWS knows the principal, **IAM policy evaluation** decides whether the specific action on the specific resource is allowed (identity policies, resource policies, SCPs, boundaries, and the explicit-deny-wins logic).

Sequence on every API call: AWS first **authenticates** (is this a valid, correctly-signed request from a known principal?), then **authorizes** (does policy permit this action on this resource under these conditions?). Both must pass. A valid credential with no permissions authenticates fine but gets `AccessDenied`; a permission-laden policy is useless if the credential can't be authenticated.

Why the distinction matters in interviews: it maps cleanly onto AWS's split — **STS/Identity Center/federation handle authentication**, **IAM policies handle authorization** — and diagnosing an access problem starts with "is this an auth*n* failure (bad/expired credentials) or an auth*z* failure (valid identity, denied by policy)?" Conflating them sends you debugging the wrong layer.

### Q17. A developer hardcoded AWS access keys in the application and pushed them to a public repo. Walk through your response.

Treat it as an active incident — those keys are compromised the moment they hit a public repo (bots scan GitHub for AWS keys within minutes).

**Immediate containment:**
1. **Deactivate/delete the exposed access key** in IAM right away (deactivate first if you fear breaking prod, then delete). Rotating alone isn't enough — the old key must be killed.
2. **Investigate usage in CloudTrail** — search for the access key ID to see what it did: unexpected regions, `RunInstances` (crypto-mining is the classic), IAM changes, data exfil. Assume compromise if the repo was public for any length of time.
3. **Contain damage** — terminate rogue resources, revoke suspicious sessions, check for backdoor IAM users/roles the attacker may have created.

**Remediate the leak:**
4. **Remove the keys from the codebase *and* git history** (`git filter-repo` / BFG) and force-push — deleting the file in a new commit leaves the secret in history. Then rotate again to be safe.
5. **Notify security/billing**; open an AWS support case if there's fraudulent usage (they can sometimes waive charges).

**Prevent recurrence — fix the root cause:**
6. **Stop using static keys** — the app on AWS should use an **instance profile / task role / Lambda execution role**; CI should use **OIDC federation**. There should be no long-lived key to leak.
7. **Add guardrails** — secret scanning (GitHub secret scanning / push protection, `git-secrets`, pre-commit hooks), and IAM Access Analyzer / GuardDuty for anomaly detection.

The senior close: the real fix isn't "be more careful with keys," it's "eliminate the long-lived keys entirely so there's nothing to leak."

### Q18. How would you design cross-account access for a shared logging/audit account?

Goal: many workload accounts (dev, staging, prod) need to write logs/telemetry into one central **security/audit account**, without sharing credentials and without over-granting.

**Design (role-assumption + resource policy pattern):**
1. **Central account owns the resources** — e.g. a central S3 log bucket and/or CloudWatch/CloudTrail org trail.
2. **Cross-account role or resource policy** — either (a) each workload account assumes a **role in the audit account** scoped to `s3:PutObject` on its own log prefix, with a **trust policy** naming the workload accounts; or (b) the central **S3 bucket policy** (resource-based) directly allows the specific workload accounts/roles to write to their prefixes.
3. **Constrain tightly** — scope `Resource` to per-account prefixes (`.../AWSLogs/${account-id}/*`), add conditions (source account/ARN to avoid confused deputy), and keep the audit account's admins separate from workload admins so logs can't be tampered with.
4. **Use Organizations for scale** — an **organization CloudTrail trail** and **Config aggregator** deliver from all member accounts to the audit account automatically; you don't wire each one by hand.
5. **Guardrails** — an **SCP** preventing member accounts from disabling CloudTrail or deleting log resources, so the audit trail is tamper-resistant.

Key principles demonstrated: **no shared long-lived credentials** (roles/resource policies with temporary creds), **least privilege** (write-only, per-prefix), **confused-deputy protection** (source conditions), and **separation of duties** (the audit account is isolated so a compromised workload account can't erase its own logs). This "central security account other accounts deliver into, protected by SCPs" is the standard AWS multi-account landing-zone pattern.

## Compute: EC2

### Summary

**What this topic covers**

The foundational compute service — virtual machines — and the surprisingly deep set of decisions around running them cost-effectively and reliably. Three concern areas live here: (1) **choosing the machine** — instance families, AMIs, the Nitro system, EBS-backed vs instance-store, burstable T-instances; (2) **paying for it** — the purchasing options (On-Demand, Reserved, Savings Plans, Spot, Dedicated) and the right-sizing/cost-optimization discipline that separates a sane bill from a horror story; and (3) **operating it at scale** — Auto Scaling Groups, launch templates, load balancer integration, placement groups, the metadata service (and its IMDSv2/SSRF security dimension), and the lifecycle of stopping vs terminating vs hibernating. The 17 questions map to the two things interviewers most want to see: **can you pick the right purchasing model for a workload, and can you make EC2 highly available and cost-efficient?**

**Mental model**

Think of every EC2 decision as trading **cost against flexibility, performance, and resilience.** On purchasing: **On-Demand** = maximum flexibility, maximum price; **Reserved/Savings Plans** = commit for 1–3 years, trade flexibility for ~30–72% savings on steady baseline; **Spot** = rent spare capacity for up to ~90% off but AWS can reclaim it with a 2-minute warning, so only for interruption-tolerant work. The right architecture usually **blends** them: Reserved/Savings Plans for the always-on baseline, On-Demand for normal variability, Spot for fault-tolerant bursty batch. On the instances themselves: they're **cattle, not pets** — stateless, disposable, behind an Auto Scaling Group and a load balancer, replaced automatically when they fail health checks. State lives on EBS (persistent, network-attached, AZ-scoped) or, better, off-instance in managed stores. The **Nitro system** (AWS's lightweight hypervisor + dedicated hardware cards) is why modern instances get near-bare-metal performance and better security isolation. And an instance lives in exactly one AZ, so availability comes from spreading an ASG across AZs — the same multi-AZ instinct from the fundamentals topic.

**Key terms**

- **Instance family** — categories tuned to a workload profile: general purpose (M/T), compute-optimized (C), memory-optimized (R/X), storage-optimized (I/D), accelerated (P/G, GPU/ML).
- **On-Demand** — pay per second/hour, no commitment; the flexible, expensive default.
- **Reserved Instance (RI)** — 1- or 3-year commitment to a config for a large discount; Standard (cheapest, rigid) vs Convertible (flexible).
- **Savings Plan** — commit to a $/hour spend for 1–3 years for RI-like discounts with more flexibility (Compute SP covers EC2/Fargate/Lambda across families/Regions).
- **Spot Instance** — spare capacity at up to ~90% off, reclaimable with a 2-minute interruption notice.
- **Dedicated Host / Dedicated Instance** — physical isolation for licensing (BYOL) or compliance; Host gives you visibility/control of the physical server.
- **AMI (Amazon Machine Image)** — the template (OS + config + software) an instance boots from; the unit of "golden image" / immutable infrastructure.
- **User data** — a script run at first boot for bootstrapping; retrieved via the metadata service.
- **IMDS (Instance Metadata Service)** — `169.254.169.254` endpoint exposing instance metadata and role credentials; **IMDSv2** is the session-hardened version that defends against SSRF.
- **EBS** — persistent, network-attached block storage, AZ-scoped, survives instance stop/terminate (if not delete-on-termination); vs **instance store** = ephemeral local disk that vanishes on stop/terminate.
- **Auto Scaling Group (ASG)** — maintains a target count of instances across AZs, replaces unhealthy ones, and scales in/out on policies.
- **Placement group** — a control over how instances are physically placed: cluster (low latency), spread (isolation), partition (large distributed systems).
- **Burstable (T-family)** — cheap instances that earn/spend **CPU credits**, giving baseline performance with the ability to burst.

**Why interviewers ask this**

EC2 is where cloud cost and reliability decisions become concrete, so it's a strong proxy for operational judgment. (1) **Can you match purchasing to workload?** The senior signal is not reciting the five options but *choosing* correctly: "steady baseline → Savings Plan; spiky fault-tolerant batch → Spot; unpredictable short-term → On-Demand." Getting Spot's interruption model right — and knowing *not* to run a stateful database on it — separates people who've paid an AWS bill from people who haven't. (2) **Can you make compute resilient and elastic?** ASGs across AZs, launch templates, target-tracking scaling, and ELB health checks are the bread and butter of "design a scalable web tier." (3) **Do you know the security and cost traps** — IMDSv2 vs SSRF, delete-on-termination surprises, over-provisioned instances, stop-vs-terminate data loss?

**Common confusions**

- "Spot instances are just cheap On-Demand" — no; AWS reclaims them with a 2-minute warning. They're for fault-tolerant, interruptible work, not your primary database.
- "Stopping and terminating are the same" — stop = shut down, keep the EBS root volume and data (you still pay for EBS). Terminate = delete the instance and, by default, its root volume. Instance-store data is lost on *both* stop and terminate.
- "Reserved Instances reserve capacity" — RIs are primarily a *billing discount*; only *zonal* RIs also reserve capacity. Savings Plans give the discount with no capacity reservation.
- "EBS is local to the instance" — EBS is *network-attached* storage in an AZ; it survives the instance and can be re-attached. Instance store is the local, ephemeral disk.
- "Bigger instance = better" — over-provisioning is the #1 EC2 cost leak; right-size to actual CPU/memory utilization and use burstable/Spot where fitting.
- "IMDS is harmless" — IMDSv1 is exploitable via SSRF to steal role credentials; IMDSv2's session tokens are why you enforce it.

**What follows from this topic**

EC2 is the substrate the rest of compute builds on. Auto Scaling + ELB here is the same elasticity story that containers (ECS/EKS) and serverless (Lambda) refine. **IAM**'s instance profiles are how these instances get credentials without embedded keys — the IMDSv2 discussion is the intersection. The multi-AZ availability from **AWS Fundamentals** becomes concrete here as "ASG across AZs behind an ALB." Networking (VPC, subnets, security groups) is where these instances actually live. Master the purchasing-model decision and the ASG-behind-a-load-balancer pattern, and you can answer most "design a scalable, cost-efficient compute tier" questions.

### Q1. Explain the EC2 instance families and how you choose among them.

Families are optimized for a resource profile; pick by your workload's bottleneck:

| Family | Optimized for | Typical use |
|---|---|---|
| **General purpose** (M, T) | Balanced CPU:memory | Web/app servers, small DBs, dev |
| **Compute optimized** (C) | High CPU per $ | Batch, HPC, gaming servers, media transcode, high-traffic web |
| **Memory optimized** (R, X, z) | High RAM per $ | In-memory DBs, caches, big-data analytics, large RDBMS |
| **Storage optimized** (I, D, H) | High local IOPS/throughput | NoSQL, data warehouses, log/search, high random I/O |
| **Accelerated** (P, G, Inf, Trn) | GPUs/accelerators | ML training/inference, graphics, rendering |

Naming decodes as `<family><generation><attributes>.<size>` — e.g. `m6g.large`: general-purpose, gen 6, `g` = Graviton (ARM), large size. The `g` suffix (Graviton/ARM) is frequently the right cost-performance pick.

**How to choose:** profile the workload — is it CPU-bound (C), memory-bound (R), I/O-bound (I), or balanced (M/T)? Start from a reasonable guess, then **right-size from real CloudWatch metrics** rather than guessing big. For steady, non-bursty work reach for M/C/R; for cheap, bursty, low-average-CPU work use burstable **T** instances. Consider **Graviton** for a ~20–40% price/performance win when your stack runs on ARM.

### Q2. Walk through the EC2 purchasing options and when to use each.

Five models, trading commitment for cost:

- **On-Demand** — pay per second/hour, no commitment. Maximum flexibility, highest price. Use for unpredictable/short-lived workloads, dev/test, spiky traffic, or anything you can't forecast.
- **Reserved Instances (RI)** — commit to a specific config for **1 or 3 years** for up to ~72% off. **Standard** RIs are cheapest but rigid; **Convertible** RIs allow changing family/OS for a smaller discount. Use for steady, predictable baseline load.
- **Savings Plans** — commit to a **$/hour spend** for 1–3 years for RI-like discounts with more flexibility. **Compute Savings Plans** cover EC2, Fargate, and Lambda across any family/Region; **EC2 Instance Savings Plans** are cheaper but family/Region-locked. The modern default over RIs for most teams.
- **Spot** — spare capacity at up to ~90% off, reclaimable with a **2-minute warning**. Use for fault-tolerant, interruptible work: batch, CI, big-data, stateless web behind an ASG.
- **Dedicated Hosts / Instances** — physical isolation for **BYOL licensing** (per-socket/core) or **compliance/regulatory** isolation requirements. Most expensive.

**The senior answer is a blend:** cover the always-on **baseline with Savings Plans/RIs**, absorb normal variability with **On-Demand**, and run fault-tolerant burst/batch on **Spot**. A common real mix is ~60–70% commitment coverage on baseline, On-Demand for the rest, Spot layered on for interruptible workloads.

### Q3. How do Spot instances work and how do you handle interruptions gracefully?

**How they work:** Spot lets you use AWS's spare capacity at a steep discount (often 70–90% off On-Demand). The price floats with supply/demand, but the defining constraint is that **AWS can reclaim the instance when it needs the capacity**, giving a **2-minute interruption notice** (via the metadata service / an EventBridge event) before terminating (or stopping/hibernating, depending on config).

**Handling interruptions gracefully:**
- **Only run interruption-tolerant workloads** — stateless web tiers behind an ASG, batch/CI jobs, big-data (EMR/Spark), containerized tasks, rendering. Never a primary stateful database.
- **Watch for the 2-minute notice** — poll `http://169.254.169.254/latest/meta-data/spot/instance-action` or subscribe to the EventBridge Spot interruption event, then **checkpoint work, drain connections, deregister from the load balancer, and finish/requeue** before termination.
- **Diversify** — use a **Spot Fleet / ASG with mixed instances policy** across many instance types and AZs so a shortage in one pool doesn't kill everything; set the **capacity-optimized** allocation strategy to pick pools least likely to be interrupted.
- **Fall back** — mixed-instances ASGs can blend On-Demand + Spot (e.g. base capacity On-Demand, extra on Spot) so a Spot drought degrades gracefully instead of going to zero.

The key insight to state: **design for interruption as normal**, and Spot's savings are essentially free; treat Spot as reliable and you'll get burned when capacity is reclaimed mid-job.

### Q4. What is an AMI and how does it fit into immutable infrastructure?

An **AMI (Amazon Machine Image)** is the template an instance boots from: the root volume snapshot (OS + installed software + configuration), launch permissions, and block-device mappings. Types by source: AWS-provided, Marketplace, community, and — most importantly — **your own custom AMIs**.

**Role in immutable infrastructure:** instead of launching a base OS and configuring it live (mutable, drift-prone), you **bake a "golden AMI"** — a pre-configured image with your OS hardening, agents, runtime, and app baked in (built with **EC2 Image Builder** or Packer) — and launch instances from it. New deploys mean **new AMI → new instances → replace old ones** (via the ASG), never patching in place. Benefits:
- **No configuration drift** — every instance is byte-identical from the same image.
- **Fast, reliable scaling** — instances boot ready-to-serve; no long user-data provisioning on the critical path.
- **Easy rollback** — roll back by launching the previous AMI.
- **Security** — patch by rebuilding the image on a cadence, not by SSHing into fleets.

AMIs are **Region-scoped** (copy them cross-Region for DR/multi-Region) and backed by EBS snapshots. The pattern to name in interviews: **golden AMI + launch template + ASG** = repeatable, drift-free, immutable compute.

### Q5. What is the instance metadata service, and what is IMDSv2 defending against?

The **Instance Metadata Service (IMDS)** is a link-local endpoint at **`169.254.169.254`** that an instance queries to learn about itself — instance ID, AZ, networking, **user data**, and critically the **temporary IAM role credentials** from its instance profile. SDKs use it automatically to get credentials without hardcoded keys.

**The threat — SSRF credential theft:** with the original **IMDSv1**, any simple GET to that URL returns data, including role credentials. If an app has a **server-side request forgery (SSRF)** vulnerability — e.g. a URL-fetch feature an attacker can point at `169.254.169.254` — the attacker makes the instance fetch its *own* role credentials and exfiltrates them. This was the mechanism behind a major 2019 cloud breach.

**IMDSv2** hardens this by requiring a **session token**: the client must first make a `PUT` to get a short-lived token, then include it as a header on metadata requests. This defeats naive SSRF because:
- SSRF vulnerabilities typically can only force **GET** requests, not the required `PUT`.
- The token must travel in a **header**, which simple SSRF can't set.
- A **default hop limit of 1** on the response TTL stops the token/response from being proxied off the host.

Best practice: **enforce IMDSv2 (`HttpTokens: required`)** on all instances, set the **hop limit** appropriately, and where an instance never needs metadata, disable IMDS entirely. This is the canonical EC2 security hardening item — expect it in any security-flavored EC2 question.

### Q6. Compare EBS-backed and instance-store-backed instances.

Two very different storage models for the root/data volumes:

| | EBS-backed | Instance store |
|---|---|---|
| **Persistence** | Network-attached, **survives stop/terminate** (if not delete-on-termination) | **Ephemeral** — data lost on stop, terminate, or host failure |
| **Location** | AZ-scoped, independent of the host | Physically attached to the host |
| **Stop/start** | Can stop & restart the instance | **Cannot stop** (only terminate) — restart may move host and wipe data |
| **Performance** | Very good; consistent (esp. Provisioned IOPS io2) | Highest possible local IOPS/throughput, very low latency |
| **Snapshots** | Yes, to S3 | No native snapshot |
| **Use** | Default for almost everything | Scratch space, caches, temp data, high-IOPS local buffers |

**Rule of thumb: use EBS-backed by default** — persistence, the ability to stop/start, snapshots, and re-attachment make it the sane choice for nearly all workloads. Reach for **instance store** only for **truly ephemeral, high-performance local data** you can afford to lose — scratch/temp files, local caches, replicated shards where the data also lives elsewhere. A frequent gotcha: putting important data on instance store and losing it when the instance stops or the host fails. Often the best of both is EBS root + instance-store scratch.

### Q7. Explain the placement group strategies and when to use each.

Placement groups control how AWS physically places your instances relative to each other:

- **Cluster** — packs instances **close together in one AZ** on the same high-bandwidth, low-latency network segment. Use for **tightly-coupled HPC / low-latency** workloads (MPI, big-data with heavy node-to-node traffic). Tradeoff: everything's in one rack-ish domain, so **correlated failure risk** is higher, and you may hit capacity limits scaling it.
- **Spread** — places instances on **distinct underlying hardware (racks)**, each with independent power/network, **max 7 instances per AZ per group**. Use for a **small number of critical instances** that must not share a failure domain (e.g. individual replicas of a quorum). Maximizes isolation.
- **Partition** — divides instances into **partitions**, each on a separate rack set; instances in different partitions don't share hardware, and AWS exposes which partition each is in. Use for **large distributed/replicated systems** (HDFS, Cassandra, Kafka) that are **partition/rack-aware** — you spread replicas across partitions so no single rack failure loses a quorum. Scales to many instances (unlike spread's 7).

Choosing: **cluster = low latency (accept correlated risk); spread = a few instances, max isolation; partition = many instances, rack-aware replication.** Cluster optimizes performance; spread and partition optimize fault isolation at different scales.

### Q8. What are Auto Scaling Groups and what scaling policies are available?

An **Auto Scaling Group (ASG)** maintains a fleet of EC2 instances at a desired size across multiple AZs. You set **min / desired / max** capacity; the ASG launches instances from a **launch template**, spreads them across the AZs you specify, runs **health checks** (EC2 status and/or ELB), and **automatically replaces** instances that fail — giving you both self-healing and elasticity.

**Scaling policies:**
- **Target tracking** — keep a metric at a target (e.g. average CPU at 50%, or requests-per-target on the ALB); the ASG adds/removes capacity to hold the target. The **default recommendation** — simplest and self-tuning.
- **Step scaling** — add/remove a *specified amount* based on how far a CloudWatch alarm breaches (e.g. +2 instances at 70% CPU, +4 at 85%). More control for non-linear responses.
- **Simple scaling** — one adjustment per alarm with a cooldown; the older, coarser option, mostly superseded by target tracking/step.
- **Scheduled scaling** — change capacity at known times (scale up before a 9am business peak, down overnight). For predictable, time-based patterns.
- **Predictive scaling** — ML forecasts load from history and pre-provisions ahead of anticipated demand; pairs well with target tracking for spiky-but-cyclical traffic.

**Best-practice combo:** **target tracking** for reactive scaling + **scheduled or predictive** for known/forecastable patterns, all **across ≥2–3 AZs** behind a load balancer. This is the canonical "elastic, self-healing web tier" answer.

### Q9. What are launch templates and how do they differ from launch configurations?

A **launch template** defines *how to launch an instance*: the AMI, instance type(s), key pair, security groups, IAM instance profile, user data, EBS mappings, network settings, and advanced options (Spot settings, IMDS/metadata config, placement, tags). ASGs and the `RunInstances` API use it as the blueprint for every instance they create.

**Vs launch configurations (the legacy predecessor):**
- **Versioning** — launch templates are **versioned**; you can iterate, roll forward/back, and point an ASG at a specific or `$Latest`/`$Default` version. Launch configs are **immutable** — to change anything you create a whole new one.
- **Feature coverage** — templates support newer features launch configs never got: **mixed instances policies** (blend On-Demand + Spot across multiple types), **T-instance unlimited mode**, placement groups, IMDSv2 enforcement, multiple network interfaces, and more.
- **Reuse** — templates work across ASGs, Spot Fleet, and direct launches; launch configs are ASG-only.

AWS has **deprecated launch configurations** and recommends launch templates for everything new. The interview-ready statement: *use launch templates — they're versioned, support Spot/mixed-instances and IMDSv2, and are the current standard; launch configurations are legacy and immutable.*

### Q10. How do EC2 instances integrate with Elastic Load Balancing and health checks?

An **Elastic Load Balancer (ELB)** sits in front of an ASG's instances, distributing incoming traffic across healthy targets in multiple AZs — the front door of a highly available compute tier. Types: **ALB** (layer 7, HTTP/HTTPS, path/host routing), **NLB** (layer 4, TCP/UDP, ultra-high throughput and static IPs), and the legacy **CLB**.

**Integration pattern:** the ASG registers/deregisters instances with a **target group** automatically as it scales in/out; the load balancer only sends traffic to targets that pass health checks.

**Health checks — two layers that matter:**
- **EC2 status checks** — is the instance/host healthy at the infrastructure level?
- **ELB health checks** — does the *application* respond correctly (e.g. HTTP 200 on `/health`)? An instance can be "running" (EC2-healthy) but broken (app crashed) — the ELB check catches that.

**Wire the ASG to use ELB health checks**, not just EC2 checks, so the ASG **replaces app-unhealthy instances**, not merely dead hosts. Supporting features: **connection draining / deregistration delay** to let in-flight requests finish before an instance is removed, **cross-zone load balancing** to spread evenly across AZs, and **sticky sessions** when needed. The complete pattern: **ALB → target group → ASG across AZs, using ELB health checks** = self-healing, elastic, highly available.

### Q11. How do you optimize EC2 costs?

Cost optimization is a Well-Architected pillar; the main levers, roughly by impact:

1. **Right-size** — the #1 leak is over-provisioning. Use CloudWatch metrics and **AWS Compute Optimizer** to match instance size to actual CPU/memory/network use; downsize or switch families. Many fleets run at <20% utilization.
2. **Commit for the baseline** — cover steady load with **Savings Plans / Reserved Instances** (up to ~72% off). Aim for high coverage on predictable baseline, not on spiky peaks.
3. **Use Spot for interruption-tolerant work** — batch, CI, stateless tiers on Spot (up to ~90% off) via mixed-instances ASGs.
4. **Turn off idle resources** — stop/terminate dev and non-prod instances off-hours (Instance Scheduler); scale ASGs down at night.
5. **Modernize** — move to **Graviton (ARM)** for ~20–40% better price/performance, and to newer generations (better perf per dollar).
6. **Watch data transfer & EBS** — cross-AZ/inter-Region transfer and over-provisioned/orphaned EBS volumes and old snapshots quietly add up; delete unattached volumes and stale snapshots.
7. **Elasticity over static fleets** — Auto Scaling so you pay for demand, not peak-sized always-on capacity.

The senior framing: **right-size first (don't buy discounts on waste), then commit on the baseline, then Spot the interruptible burst, and keep data-transfer/idle-resource hygiene** — and make it continuous with Cost Explorer/Budgets, not a one-off.

### Q12. What is right-sizing and how do you approach it?

**Right-sizing** is matching instance type and size to a workload's *actual* resource needs — eliminating both over-provisioning (paying for idle capacity) and under-provisioning (throttling performance). It's the highest-ROI cost lever because most fleets are over-provisioned from "guess big to be safe."

**Approach:**
1. **Measure real utilization** — collect CloudWatch metrics over a representative period (include peaks): CPU, memory (needs the CloudWatch agent — memory isn't a default metric), network, and disk I/O. A box sitting at 10% CPU is a downsizing candidate.
2. **Use tooling** — **AWS Compute Optimizer** analyzes history and recommends specific instance types/sizes with projected savings and performance risk; Cost Explorer's rightsizing recommendations flag idle/underused instances.
3. **Consider the whole shape** — if it's CPU-idle but memory-bound, switch *family* (M→R), don't just shrink. Consider **burstable T** for low-average-with-spikes, and **Graviton** for a price/performance jump.
4. **Change safely** — right-sizing needs a stop/start (or replacement via ASG/launch template); validate performance after, and re-check periodically since workloads drift.

The key nuance to raise: **memory utilization isn't captured by default** — teams that right-size on CPU alone can under-size memory-bound apps. And right-sizing is **continuous**, not a one-time cleanup — bake it into a regular cost review.

### Q13. What is the AWS Nitro system and why does it matter?

The **Nitro system** is the modern foundation underlying current-generation EC2 instances. Instead of a heavy software hypervisor consuming host resources, Nitro **offloads virtualization functions — networking, storage (EBS), and security — onto dedicated hardware (Nitro Cards)**, paired with a **lightweight KVM-based hypervisor** and a hardware-rooted **Nitro Security Chip**.

Why it matters:
- **Performance** — offloading I/O to dedicated cards means **almost all** the host CPU/memory goes to *your* workload; you get near-bare-metal performance and consistent, high network/EBS throughput. It also enables **bare-metal instances** (`.metal`).
- **Security** — a minimized attack surface (tiny hypervisor), hardware root of trust, and no operator interactive access to the host. It also underpins **Nitro Enclaves** — isolated compute environments for processing sensitive data (keys, PII) with no persistent storage or external network, even shielded from the parent instance's own admins.
- **Faster innovation** — decoupling functions onto cards let AWS ship new instance types and features much faster.

For an interview it's enough to say: **Nitro = hardware-offloaded virtualization + a thin hypervisor, giving near-bare-metal performance and stronger isolation**, and it's why modern instances (and Enclaves, and bare-metal) exist. You rarely configure it directly — it's the platform beneath you.

### Q14. Explain burstable (T-family) instances and CPU credits.

**Burstable (T-family: t3, t3a, t4g) instances** are low-cost general-purpose instances designed for workloads with **low average CPU but occasional spikes** — small web/app servers, microservices, dev boxes, low-traffic sites. They provide a modest **baseline** CPU level continuously and let you **burst above it using CPU credits**.

**CPU credits:**
- Each instance **earns credits at a fixed rate per hour** (bigger sizes earn more) while running.
- Running **below** baseline **accumulates** credits (up to a cap); running **above** baseline **spends** them. One credit ≈ one vCPU-minute at 100%.
- If credits are exhausted in **Standard mode**, the instance is **throttled to baseline** — the classic failure mode where a T-instance mysteriously slows under sustained load.
- **Unlimited mode** (default for t3/t4g) lets it keep bursting after credits run out, **charging a small surcharge** for the extra CPU rather than throttling.

**When to use / avoid:** great for spiky, low-average-utilization workloads where you get real savings. **Avoid for sustained high-CPU workloads** — you'll either throttle (Standard) or pay surcharges that make a C/M instance cheaper (Unlimited). The interview trap: putting a steadily busy service on a T-instance and being surprised by throttling or a surprise Unlimited-mode bill — for consistent load, a right-sized M/C instance is the correct call.

### Q15. What's the difference between stopping, terminating, and hibernating an EC2 instance?

Three distinct lifecycle actions with very different data and billing consequences:

- **Stop** — shuts the instance down like powering off a machine. The **EBS root volume and data persist** (you keep paying for EBS storage but **not** for instance compute). On start it may launch on a **different host**, so **public IP changes** (unless Elastic IP) and **instance-store data is lost**. Use to pause a workload and resume later.
- **Terminate** — permanently deletes the instance. By default the **root EBS volume is deleted** (`DeleteOnTermination=true`); the instance and its ID are gone. Use for disposable/replaceable instances (ASG replacements, finished jobs). Enable **termination protection** for critical instances to prevent accidents.
- **Hibernate** — saves the **in-memory (RAM) state to the EBS root volume**, then stops. On start it **restores RAM**, so the OS and applications resume where they were (warm caches, running processes) — faster than a cold boot for apps with long startup/warm-up. Requires setup (encrypted EBS root, supported instance/OS, RAM-sized root volume) and has size/duration constraints.

**Gotchas to name:** **instance-store data is lost on both stop and terminate** (only EBS persists); **terminate deletes the root volume by default** — a classic "where did my data go?"; and you **still pay for EBS** (and Elastic IPs, and provisioned storage) on stopped/hibernated instances even though compute is free.

### Q16. Design a highly available, cost-efficient web application tier on EC2.

**Architecture (the canonical answer):**
1. **ALB across ≥2–3 AZs** as the front door, terminating TLS and routing to a target group.
2. **Auto Scaling Group spanning those AZs**, launching from a **launch template** referencing a **golden AMI** (app baked in for fast boot), using **ELB health checks** so app-unhealthy instances are replaced.
3. **Stateless instances** — no local session/state; push sessions to **DynamoDB/ElastiCache** and data to a **Multi-AZ RDS/Aurora** or DynamoDB. Any instance in any AZ can serve any request.
4. **Scaling** — **target tracking** on CPU or ALB requests-per-target for reactive scaling, plus **scheduled/predictive** scaling for known peaks.
5. **IAM instance profile** so instances get AWS access via temporary role credentials (no embedded keys), with **IMDSv2 enforced**.

**Cost efficiency layered on:**
- **Savings Plan / RIs** cover the always-on **baseline** capacity.
- **Mixed-instances ASG** blends **On-Demand (base) + Spot (extra)** across several instance types/AZs for cheap, resilient burst capacity.
- **Graviton (ARM)** instances for price/performance; **right-sized** from real metrics.
- Scale in during low traffic so you pay for demand, not peak.

**Front and back:** CloudFront + WAF in front for latency/caching/security; security groups locking the tier down (ALB → app SG only). This single design demonstrates the whole topic — multi-AZ HA, self-healing ASG, elasticity, immutable AMIs, IAM roles, IMDSv2, and a blended purchasing model for cost. The reason it's the "textbook" answer is that it hits every Well-Architected pillar at once.

### Q17. Your team runs a large stateless batch job on On-Demand instances and the bill is huge. How do you cut costs without hurting throughput?

This is a near-perfect **Spot** use case — **stateless, interruption-tolerant batch** is exactly what Spot exists for, and On-Demand for it is leaving ~70–90% on the table.

**Plan:**
1. **Move the batch fleet to Spot** via an **ASG with a mixed-instances policy** (or Spot Fleet / AWS Batch on Spot). Because the work is stateless and (ideally) idempotent/checkpointed, a reclaimed instance just means a re-queued task — no correctness impact.
2. **Diversify heavily** — allow **many instance types and sizes across all AZs** with the **capacity-optimized** allocation strategy, so a shortage in one pool doesn't stall the job and interruptions stay rare.
3. **Handle the 2-minute interruption notice** — on the Spot interruption signal, **checkpoint progress and requeue** the in-flight unit (e.g. via SQS visibility timeouts so unfinished messages reappear). Design tasks to be **idempotent and resumable**.
4. **Keep a small On-Demand base if there's a deadline** — a mixed-instances policy can guarantee, say, a baseline of On-Demand for SLA-critical throughput while the bulk runs on Spot, so a Spot drought degrades speed rather than halting.
5. **Right-size the workers and consider Graviton** — smaller/ARM instances often finish the same work cheaper; and **AWS Batch or EMR on Spot** can manage the orchestration for you.

**Throughput protection:** because you diversify across pools and requeue interrupted units, aggregate throughput holds while cost drops sharply. Optionally cover a predictable *baseline* of batch volume with a **Compute Savings Plan** and burst the rest on Spot. The headline: **stateless batch → Spot with diversification and checkpointing = up to ~90% cheaper at the same throughput.**
## Serverless Compute: Lambda

### Summary

**What this topic covers**

AWS Lambda is the flagship function-as-a-service (FaaS) offering and the mental anchor for "serverless" on AWS. This topic's 17 questions walk from the warm-up ("what is Lambda, what's the execution model") through the operational realities that bite in production — cold starts, concurrency and throttling, the hard service limits, the pricing model — and out to the senior-level design judgement: when Lambda is the right tool versus Fargate or EC2, how it behaves inside a VPC, how you make handlers idempotent, and how you wire retries, DLQs, and destinations so failures don't silently vanish. Lambda is deceptively simple to start and surprisingly deep to run well; interviewers use it to separate "I deployed a hello-world function" from "I've operated event-driven systems at scale."

**Mental model**

Think of Lambda as a **stateless function bound to an event source**, run inside a short-lived, AWS-managed micro-VM (Firecracker). You don't manage servers, patching, or capacity — you hand AWS a zip or container image and an IAM role, and AWS runs one concurrent invocation per **execution environment**. The unit of scaling is the concurrent invocation: 100 simultaneous events means up to 100 environments spun up in parallel, each handling exactly one request at a time (no in-process request multiplexing like a threaded server). An environment is reused across invocations when warm — which is why you initialise SDK clients and DB connections *outside* the handler, in the init phase, so they're amortised. The three invocation styles — **synchronous** (caller waits for the result), **asynchronous** (fire-and-forget, Lambda queues and retries), and **poll-based** (Lambda polls a stream/queue and batches records) — each have different retry, ordering, and error semantics, and confusing them is the most common production bug. The whole model optimises for spiky, event-driven, short-lived work; it fights you the moment work is long-running, stateful, or steady-state high-throughput.

**Key terms**

- **Execution environment** — the isolated micro-VM that runs your function; reused when warm, one concurrent invocation each.
- **Cold start** — latency added when a new environment must be created and your init code run before the first invocation.
- **Provisioned concurrency** — pre-warmed environments kept ready so invocations skip cold starts (you pay for them idle).
- **Reserved concurrency** — a concurrency cap/floor carved out of the account limit for one function.
- **Account concurrency limit** — default **1000** concurrent executions per account per Region (soft, raisable).
- **SnapStart** — snapshot-and-restore of an initialised environment to cut JVM/other cold starts (Java, and later runtimes).
- **Event source mapping** — the poller Lambda runs for stream/queue sources (Kinesis, DynamoDB Streams, SQS, Kafka).
- **DLQ / destinations** — where failed async events go: dead-letter queue (SQS/SNS) or on-success/on-failure destinations.
- **Layer** — a zip of shared libraries/runtime dependencies mounted at `/opt`, shared across functions.
- **GB-second** — the billing unit: allocated memory (GB) × execution duration (seconds), plus a per-request charge.
- **Powertools** — AWS's opinionated helper library (Python/Java/TS/.NET) for logging, tracing, metrics, idempotency.

**Why interviewers ask this**

Lambda is where "serverless enthusiasm" meets operational scar tissue. A junior candidate describes the happy path: upload code, it runs, it scales, you pay per request. A senior candidate immediately reaches for the failure and cost edges — "how do cold starts affect a latency-sensitive API," "what happens to the 1001st concurrent request when your account limit is 1000," "where does a poisoned async event end up after retries," "why did putting the function in a VPC make things worse." Interviewers probe Lambda to test whether you understand the *event-driven* paradigm (retries, at-least-once delivery, idempotency) rather than treating a function as a tiny always-on server. The strongest signal is a candidate who can articulate **when not to use Lambda** — steady high-throughput, long-running, or latency-floor-sensitive workloads — because that shows they've felt the sharp edges, not just read the marketing.

**Common confusions**

- "Lambda scales infinitely" — it scales to your **account concurrency limit** (1000 default), then throttles; and burst scaling has ramp limits.
- "One environment handles many requests at once" — no; **one concurrent invocation per environment**. Ten parallel requests need ten environments.
- "Provisioned concurrency eliminates cost" — it eliminates cold starts but you **pay for pre-warmed environments while idle**.
- "Reserved and provisioned concurrency are the same" — reserved is a **cap** on how much of the pool a function can use; provisioned is **pre-warmed capacity**.
- "Lambda in a VPC can reach the internet" — only via a **NAT gateway / VPC endpoints**; an ENI in private subnets has no public egress by default.
- "Async invocations return a result" — they return a 202 immediately; the result goes nowhere unless you configure **destinations**.

**What follows from this topic**

Lambda is the compute half of event-driven AWS; its natural companions are the messaging and storage topics — **S3 event notifications**, **SQS/SNS/EventBridge** as event sources, and **DynamoDB Streams** for change-data capture. The concurrency and VPC discussions connect to the **Networking** and **IAM** topics (execution roles, ENIs, security groups). The "when not to use Lambda" answer hands off directly to the **Containers: ECS, Fargate & EKS** topic, which covers the long-running and steady-throughput workloads Lambda is wrong for. If you're designing an ingestion or fan-out pipeline, this topic plus the messaging topic are the two you'll lean on hardest.

### Q1. What is AWS Lambda and what is its execution model?

Lambda is a **function-as-a-service** platform: you upload code (a handler function) plus an IAM role, choose a memory size and timeout, and AWS runs your code in response to events without you provisioning or managing servers.

The execution model is **event-driven and stateless**. AWS creates an **execution environment** (a Firecracker micro-VM), runs your **init code** once (imports, client setup, module-level constants), then invokes your **handler** per event. One environment serves **one concurrent invocation at a time** — parallelism comes from AWS spinning up more environments, not from threading within one. Environments are **reused** while warm (so subsequent invocations skip init), and torn down after idle. You pay only while code runs, billed in GB-seconds plus per request. Because nothing on the local filesystem or in memory is guaranteed to survive between invocations, all durable state must live in an external store (DynamoDB, S3, RDS).

### Q2. What causes a cold start, and how do you mitigate it?

A **cold start** happens when an invocation arrives and no warm environment is available, so Lambda must: download your package, start the runtime, and run your init code before the handler executes. That added latency ranges from ~100ms to several seconds depending on runtime, package size, and VPC config.

**What makes cold starts worse:**
- Heavy runtimes (JVM, .NET) with long init.
- Large deployment packages / many dependencies.
- VPC-attached functions (historically ENI setup; largely improved since 2019 with shared ENIs, but still non-zero).
- Lots of module-level initialisation.

**Mitigations:**
- **Provisioned concurrency** — pre-warm N environments so a fixed capacity never cold-starts (best for latency-SLA APIs).
- **SnapStart** — Lambda snapshots a fully-initialised environment and restores from it, cutting Java (and newer runtimes') cold starts dramatically at no extra charge.
- Slim the package, lazy-load rarely-used dependencies, use lighter runtimes (Go, Node, Python start faster than JVM).
- Keep init code minimal; move optional work out of the module scope.
- Right-size memory — more memory also means proportionally more CPU, so init runs faster.

### Q3. Explain reserved concurrency vs provisioned concurrency.

They solve different problems and are often confused.

| | Reserved concurrency | Provisioned concurrency |
|---|---|---|
| What it does | Caps (and guarantees) how many concurrent executions a function may use | Pre-warms a set number of environments so they never cold-start |
| Purpose | Protect other functions / downstream systems from one function hogging the pool | Eliminate cold-start latency for predictable traffic |
| Cost | Free (it's a carve-out of the account pool) | You pay per hour for the provisioned environments, warm or idle |
| Effect on cold starts | None | Removes them (up to the provisioned count) |

**Reserved** = "this function can use *at most* (and reserves *at least*) this slice of the 1000-limit pool." Setting it to 0 effectively disables the function. **Provisioned** = "keep this many environments hot." You typically layer them: reserve concurrency to bound blast radius *and* provision some of it for latency. Auto-scaling can adjust provisioned concurrency on a schedule or target-tracking metric.

### Q4. What are Lambda's key limits?

The ones that shape architecture:

- **Timeout**: max **15 minutes** per invocation. Longer work must be chunked, moved to Step Functions, or run on Fargate/ECS.
- **Memory**: **128 MB to 10 GB**, in 1 MB steps. CPU scales linearly with memory (≈1 vCPU per 1769 MB; ~6 vCPUs at 10 GB).
- **Ephemeral `/tmp`**: **512 MB default, up to 10 GB** (configurable). The only writable local disk.
- **Payload**: **6 MB** for synchronous invoke (request+response), **256 KB** for asynchronous. Larger data goes via S3 (pass a pointer).
- **Deployment package**: **50 MB** zipped direct upload, **250 MB unzipped**; container images up to **10 GB**.
- **Concurrency**: **1000** concurrent executions per account/Region by default (soft limit, raise via support).
- **Environment variables**: 4 KB total.

Hitting the 15-minute or 10 GB ceiling is usually the signal to move to a container-based compute.

### Q5. How is Lambda priced?

Two components:

1. **Requests** — a flat charge per million invocations (first 1M/month free on the perpetual free tier).
2. **Duration** — **GB-seconds**: allocated memory in GB × billed duration in ms (billed to the millisecond). A 512 MB function running 200ms costs 0.5 GB × 0.2 s = 0.1 GB-s.

Because CPU scales with memory, **more memory can be cheaper** if it finishes proportionally faster — a function that halves its runtime by doubling memory costs the same in duration but pays fewer request-seconds of downstream waiting. This is why the "power tuning" exercise (measuring cost/latency across memory sizes) is worthwhile. **Provisioned concurrency** adds a separate hourly charge for kept-warm capacity. Data transfer, and any services the function calls (S3, DynamoDB), are billed separately.

### Q6. What's the difference between synchronous, asynchronous, and poll-based (stream) event sources?

| Style | Examples | Retry behaviour | Ordering |
|---|---|---|---|
| **Synchronous** | API Gateway, ALB, Cognito, direct Invoke | Caller handles retries; Lambda returns result/error to caller | Caller-controlled |
| **Asynchronous** | S3 events, SNS, EventBridge | Lambda retries **twice** (3 attempts total), then DLQ/on-failure destination | No ordering guarantee |
| **Poll-based / stream** | SQS, Kinesis, DynamoDB Streams, MSK/Kafka | Lambda's **event source mapping** polls and batches; retries per batch until success or record expiry | Kinesis/DynamoDB: **ordered per shard**; SQS FIFO: ordered per group |

The distinction drives everything downstream. Sync means the client eats latency and failure. Async means Lambda queues the event internally and you must configure a **DLQ or destination** or failures vanish after retries. Stream sources batch records and, for Kinesis/DynamoDB, a poison record can **block the shard** until it expires unless you set `BisectBatchOnFunctionError`, a max-retry, and an on-failure destination.

### Q7. How do retries, DLQs, and destinations work for failed invocations?

For **asynchronous** invocations, Lambda automatically retries a failed event **twice** (with delays), for 3 attempts total. If all fail:
- A configured **dead-letter queue** (SQS or SNS) receives the failed event, or
- An **on-failure destination** (SQS, SNS, EventBridge, or another Lambda) receives a richer record including the response/error context.

**Destinations** are the modern, preferred mechanism — they support both **on-success** and **on-failure** routing and carry more metadata than a bare DLQ. For **stream/poll** sources, the event source mapping controls retries: you set maximum retry attempts, maximum record age, batch bisection on error, and an on-failure destination for discarded batches. If you configure none of this, a failing async event or a poison stream record is silently dropped (async) or blocks the shard until expiry (streams) — a classic production incident.

### Q8. What are the implications of running Lambda inside a VPC?

By default Lambda runs in an AWS-managed network with direct internet access. Attaching it to **your VPC** (to reach RDS, ElastiCache, or private endpoints) changes several things:

- Lambda creates **Hyperplane ENIs** in your subnets; since 2019 these are shared and set up at function-config time, so the old per-cold-start ENI penalty is largely gone — but there's still some overhead.
- The function is now bound by your **subnet route tables and security groups**. It has **no internet egress** unless the subnets route `0.0.0.0/0` through a **NAT gateway** (in a public subnet) or you use **VPC endpoints** for AWS services (S3, DynamoDB gateway endpoints; interface endpoints for others).
- **IP exhaustion** becomes a real risk at high concurrency — ensure the subnets have enough addresses.
- Best practice: put Lambda in **private subnets**, use **VPC gateway/interface endpoints** to reach AWS services without a NAT, and only add a NAT if you genuinely need public internet egress (it's an extra hourly + per-GB cost).

### Q9. What are Lambda layers and when should you use them?

A **layer** is a zip archive of libraries, a custom runtime, or other dependencies that Lambda mounts read-only at **`/opt`**. A function can use up to **5 layers**, and the combined unzipped size (function + layers) must stay under **250 MB**.

Use layers to:
- Share common dependencies (SDKs, Powertools, native binaries like `ffmpeg`) across many functions without duplicating them in every package.
- Keep your function's own deployment package small (faster uploads, cleaner diffs).
- Distribute a shared internal library with independent versioning.

Caveats: layers don't reduce cold-start *unzipped* size (they still count toward the 250 MB), versioning is immutable (you publish new versions), and for complex dependency trees many teams now prefer **container images** instead, which give full control over the image and a familiar Docker workflow.

### Q10. When would you package a Lambda as a container image instead of a zip?

Lambda supports **container images up to 10 GB** (vs 250 MB unzipped for zip packages), using AWS-provided base images or your own that implement the Runtime API.

Choose container images when:
- Dependencies exceed the 250 MB zip limit (ML models, large native libs).
- You want a **consistent Docker-based build/CI pipeline** shared with your ECS/EKS workloads.
- You need full control over the OS packages and runtime.
- Your team already thinks in Dockerfiles.

Trade-offs: larger images can mean **slower cold starts** (mitigated by AWS's image caching and layer optimisation), and you're responsible for base-image patching. Zip packages remain simpler and start faster for small functions. It's a packaging choice, not a runtime difference — the execution model, limits (except size), and pricing are identical.

### Q11. How should you handle secrets and configuration in Lambda?

**Configuration** (non-secret): use **environment variables** (4 KB total). Simple and fast — they're available at init with no runtime call.

**Secrets** (DB passwords, API keys): do **not** put plaintext secrets in environment variables. Options, best to worst for most cases:
- **AWS Secrets Manager** — with automatic rotation; fetch at init and cache. There's a Secrets Manager/Parameters **Lambda extension** that caches locally to avoid per-invocation API calls.
- **SSM Parameter Store** (SecureString) — cheaper, KMS-encrypted, good for config + secrets without rotation.
- Environment variables encrypted with a **customer-managed KMS key** — acceptable for low-sensitivity values; still decrypt at init.

Grant the function's **execution role** least-privilege access to only the specific secret ARNs. Cache decrypted secrets at init scope (not per invocation) to cut latency and API cost, and rely on rotation rather than baking secrets into the package.

### Q12. Why does idempotency matter in Lambda, and how do you achieve it?

Lambda delivery is **at-least-once** for async and stream sources — the same event can be delivered more than once (retries, source re-drives). If your handler isn't **idempotent**, a duplicate delivery double-charges a card, double-sends an email, or double-writes a record.

Make handlers idempotent by:
- Deriving or requiring an **idempotency key** (order ID, a client-supplied token, or a hash of the event).
- Recording processed keys in a store — **DynamoDB with a conditional put** (or `attribute_not_exists`) and a TTL is the canonical pattern; the write succeeds only the first time.
- Using the **Powertools idempotency utility**, which implements exactly this (persistence layer + in-progress locking + configurable TTL) so you don't hand-roll it.
- Designing downstream operations to be naturally idempotent where possible (upserts, set-membership, conditional writes) rather than blind appends.

Never assume exactly-once delivery — build for duplicates.

### Q13. Compare Lambda, Fargate, and EC2 for running compute.

| | Lambda | Fargate (ECS/EKS) | EC2 |
|---|---|---|---|
| Unit | Function per event | Long-running container/task | Virtual machine |
| Scaling | Per-invocation, automatic, to concurrency limit | Task count via autoscaling | Instances via ASG |
| Max runtime | 15 min | Unbounded | Unbounded |
| Ops burden | None (no servers/patching) | Low (no nodes, patch containers) | High (patch OS, capacity) |
| Cost shape | Per request + GB-s; scales to zero | Per vCPU/GB-second per task; can't scale to zero cheaply | Per instance-hour, pay for idle |
| Best for | Spiky, event-driven, short jobs | Steady containers, long jobs, needs full control of runtime | Legacy, GPU, licensing, max control |

Rule of thumb: **Lambda** for event-driven and bursty work under 15 min; **Fargate** when you outgrow Lambda's limits but still want serverless containers; **EC2** when you need GPUs, specific instance types, licensing, or the lowest steady-state cost at high utilisation.

### Q14. What is Lambda Powertools and why use it?

**Powertools for AWS Lambda** is an official, opinionated utility library (available for Python, Java, TypeScript, .NET) that standardises the cross-cutting concerns every serious Lambda accrues:

- **Structured logging** — JSON logs with correlation IDs and Lambda context injected.
- **Tracing** — X-Ray annotations/subsegments with a decorator.
- **Metrics** — custom CloudWatch EMF metrics without extra API calls.
- **Idempotency** — the DynamoDB-backed exactly-once utility from Q12.
- **Batch processing** — partial-batch-failure handling for SQS/Kinesis/DynamoDB so one bad record doesn't fail the whole batch.
- **Parameters** — cached retrieval from SSM/Secrets Manager.

Use it because it encodes best practices you'd otherwise reinvent (and get subtly wrong), it's maintained by AWS, and it produces observability that's consistent across a fleet of functions. Interviewers like hearing it because it signals you've operated Lambdas beyond hello-world.

### Q15. When should you NOT use Lambda?

Lambda is the wrong tool when:

- **Long-running work** — anything over 15 minutes (big ETL, video transcoding of large files, long ML training). Use Fargate/Batch/EC2.
- **Sustained high throughput** — at steady high RPS, always-on containers/instances are cheaper than per-invocation billing, and you avoid concurrency-limit management.
- **Ultra-low, predictable latency floors** — cold starts (even mitigated) can violate tight P99 SLAs; a warm always-on service is more predictable.
- **Heavy stateful or long-lived connections** — WebSockets with lots of state, connection pooling to databases at scale (Lambda's per-environment connections can exhaust DB limits; RDS Proxy helps but adds cost).
- **Specialised hardware** — GPUs, large memory beyond 10 GB, specific instance families.
- **Predictable, constant load** — if utilisation is high and flat, you're paying serverless premium for elasticity you don't need.

The senior move is naming the boundary explicitly rather than defaulting to Lambda for everything.

### Q16. How does Lambda throttling work and what happens when you exceed concurrency?

Each account has a **default 1000 concurrent executions** per Region (raisable). When concurrent invocations exceed the available limit, Lambda **throttles** — and the behaviour depends on the invocation type:

- **Synchronous** (API Gateway, direct invoke): the caller gets a **429 TooManyRequestsException** immediately. The client must retry/back off.
- **Asynchronous**: Lambda **queues** the event internally and retries the invocation for up to ~6 hours with backoff; sustained throttling eventually sends events to the DLQ/destination.
- **Stream (Kinesis/DynamoDB)**: the poller retries the batch, applying backpressure — the shard's records wait, potentially increasing iterator age.

There's also a **burst limit** (an initial burst of concurrency then a gradual ramp of +500/min or so per Region). **Reserved concurrency** both caps a function (protecting the shared pool) and guarantees it a floor. Monitor the `Throttles` and `ConcurrentExecutions` CloudWatch metrics; if you're throttling legitimately, request a limit increase or add reserved/provisioned concurrency.

### Q17. Design a serverless image-processing pipeline and note the failure modes.

**Flow**: user uploads to an **S3 bucket** → S3 **event notification** (async) triggers a Lambda → Lambda reads the object, generates thumbnails, writes them to a derived bucket, and records metadata in **DynamoDB**.

**Design choices:**
- Use **S3 → EventBridge** (or SQS between S3 and Lambda) rather than S3 → Lambda directly, so you get buffering, retries, and can fan out to multiple consumers.
- Set **reserved concurrency** on the Lambda to protect downstream systems and the shared pool during upload spikes.
- Pass the object **by reference** (bucket/key in the event) — never inline the image (6 MB sync / 256 KB async payload limits).
- Make the handler **idempotent** keyed on the object version/ETag (S3 can deliver duplicate events) so reprocessing is safe.

**Failure modes to call out:**
- **Poison object** (corrupt image) fails every retry → configure an **on-failure destination / DLQ** so it doesn't vanish, and alarm on DLQ depth.
- **Large image** exceeds the 15-min timeout or 10 GB `/tmp` → route big files to **Fargate/Batch** instead.
- **Concurrency spike** on viral upload → S3→SQS→Lambda absorbs the burst; without it you throttle.
- **Duplicate delivery** → the idempotency key prevents double-writes.
- Watch **cost**: per-object Lambda + S3 PUT/GET + DynamoDB writes add up at volume; batch where possible.

## Containers: ECS, Fargate & EKS

### Summary

**What this topic covers**

This is the container-orchestration half of AWS compute — where you land when a workload outgrows Lambda's 15-minute, event-driven model but you still don't want to hand-manage servers. The 16 questions span the two orchestrators AWS offers (**ECS**, its own simpler scheduler, and **EKS**, managed upstream Kubernetes), the two ways to run their containers (on **EC2** instances you manage, or on **Fargate** serverless capacity you don't), and the supporting cast: **ECR** for images, **Cloud Map** for service discovery, load balancers, task vs execution IAM roles, autoscaling, secrets injection, sidecars, and **App Runner** for the "just run my container from a repo" case. The recurring interview theme is *decision-making*: ECS vs EKS, Fargate vs EC2 launch type — each a genuine trade of operational simplicity against control and cost.

**Mental model**

Separate two axes that beginners conflate. **Axis 1 — the orchestrator** (the control plane that decides *what* runs *where*, handles scheduling, health, rollout): ECS or EKS. **Axis 2 — the compute** (the actual capacity your containers run on): self-managed **EC2** instances, or **Fargate** serverless capacity. Any combination is valid — ECS on Fargate, ECS on EC2, EKS on Fargate, EKS on EC2. **ECS** is AWS-proprietary, deeply integrated, and simple: define a **task definition** (like a pod spec — image, CPU/memory, env, roles), run it as a **task** (a running instance) inside a **service** (which keeps N tasks alive behind a load balancer) in a **cluster**. **EKS** is conformant Kubernetes: you get the full k8s API, ecosystem (Helm, operators, CRDs), and portability, but you also inherit its complexity and pay for the managed control plane. **Fargate** removes the node layer entirely — no patching, no capacity planning, you're billed per vCPU-second and GB-second per task. The trade is always the same: managing your own EC2 nodes gives you cost control, GPUs, and instance-level tuning at the price of operational burden; Fargate gives you serverless simplicity at a per-task premium.

**Key terms**

- **Cluster** — a logical grouping of capacity/tasks; the top-level ECS/EKS boundary.
- **Task definition** — immutable blueprint: container image(s), CPU/memory, ports, env, IAM roles, log config (≈ a k8s pod spec).
- **Task** — a running instance of a task definition (one or more containers scheduled together).
- **Service** — keeps a desired count of tasks running, integrates with load balancers, handles rolling deploys.
- **Launch type** — where tasks run: **EC2** (your instances) or **Fargate** (serverless).
- **Fargate** — serverless container compute; no nodes to manage, billed per vCPU/GB-second.
- **EKS node group** — a managed or self-managed set of EC2 worker nodes joined to an EKS cluster.
- **Fargate profile (EKS)** — rules mapping pods (by namespace/labels) to run on Fargate instead of nodes.
- **ECR** — Elastic Container Registry; private Docker registry with image scanning and lifecycle policies.
- **Task role vs execution role** — the app's own AWS permissions vs the permissions the agent needs to pull images/write logs.
- **Cloud Map** — service discovery (DNS/API) for ECS services.
- **Capacity provider** — ECS abstraction that manages/scales the underlying capacity (Fargate, Fargate Spot, or EC2 ASG).
- **Karpenter** — open-source Kubernetes node autoscaler that provisions right-sized EC2 just-in-time for EKS.

**Why interviewers ask this**

Container questions test architectural judgement more than trivia. Anyone can `docker run`; the signal is in the *choices*. Do you reach for EKS when the team has no Kubernetes experience and no multi-cloud requirement (over-engineering), or do you rightly pick ECS for its lower operational surface? Can you explain why Fargate costs more per unit but often less in total once you price in the ops time, the idle EC2 capacity, and the patching? Do you know the **task role vs execution role** distinction — a favourite because getting it wrong is a real security/operations bug? Senior candidates also reason about **cost at scale** (Fargate Spot, EC2 reservations, bin-packing), **networking modes**, and **how rollout/health checks actually work**. The container topic is where "I can deploy a service" becomes "I can choose and operate the right platform for the org."

**Common confusions**

- "Fargate is a different orchestrator than ECS" — no; Fargate is a **launch type / compute mode**. ECS and EKS are the orchestrators; Fargate is *where* their tasks/pods can run.
- "EKS is just ECS with more features" — EKS is **real Kubernetes** (portable, huge ecosystem, more complex); ECS is AWS-proprietary and simpler. Different mental models.
- "Task role and execution role are interchangeable" — the **execution role** lets the agent pull images and write logs; the **task role** grants *your app code* AWS permissions. Mixing them breaks least privilege.
- "Fargate lets you SSH into the box" — there's no host to manage; you get **ECS Exec** into the container, not node access.
- "You must run your own nodes for EKS" — **Fargate profiles** let pods run serverless; you can run a nodeless-ish EKS for suitable workloads.
- "ECR is just Docker Hub on AWS" — it's a private registry with **IAM auth, image scanning, and lifecycle policies** integrated into the AWS permission model.

**What follows from this topic**

Containers sit between the **Lambda** topic (the event-driven compute you graduate *from*) and the **Networking / IAM** topics (VPC subnets, security groups, `awsvpc` ENIs, and the task/execution role split all live there). Image storage and scanning connect to the **security** posture; load balancing connects to the **ELB** discussion; autoscaling connects to observability and cost. If you're designing a long-running microservice platform, this topic plus networking and IAM are the core; if you're weighing serverless-first vs container-first for a new service, pair this with the Lambda "when not to use" answer.

### Q1. Explain the core ECS concepts: cluster, service, task, and task definition.

- **Task definition** — the immutable blueprint. It declares one or more container definitions (image, CPU/memory reservations, port mappings, environment variables, secrets, log configuration) plus the task-level CPU/memory, network mode, and the **task role** and **execution role**. Versioned as revisions. Analogous to a Kubernetes pod spec.
- **Task** — a running instantiation of a task definition. One task can hold multiple containers that are always co-scheduled and share networking (useful for sidecars).
- **Service** — a long-running controller that maintains a **desired count** of tasks, replaces unhealthy ones, registers them with a load balancer / Cloud Map, and orchestrates **rolling or blue-green deployments**. This is what you use for web services and always-on workers.
- **Cluster** — the logical boundary grouping capacity (Fargate and/or EC2) and the services/tasks running on it. It's mostly an organisational and IAM/permissions boundary.

For one-off or batch jobs you `run-task` directly (no service); for anything that must stay up, you run it as a service.

### Q2. Compare the EC2 and Fargate launch types.

| | EC2 launch type | Fargate launch type |
|---|---|---|
| Who manages the host | You (patching, scaling the ASG, AMIs) | AWS — no host to see |
| Billing | Per EC2 instance-hour (pay for whole instances, incl. idle) | Per task's vCPU-second + GB-second |
| Bin-packing | You pack many tasks per instance for efficiency | One "right-sized" microVM per task |
| GPUs / special instances | Yes | No (Fargate has no GPU support) |
| Startup | Fast (host already running) | Slightly slower (provision microVM) |
| Best when | High steady utilisation, cost-sensitive, need instance control | Variable load, small teams, want zero node ops |

**EC2** wins on cost at high, steady utilisation and when you need instance types Fargate doesn't offer (GPU, huge memory, specific families) — at the price of managing the fleet. **Fargate** wins on operational simplicity and for spiky or low-volume services where a full instance would sit idle. Many teams run **Fargate for most services** and reserve EC2 clusters for the few cost- or hardware-sensitive workloads.

### Q3. What is Fargate and what problem does it solve?

**Fargate** is serverless compute for containers. You give ECS or EKS a task/pod with its CPU and memory requirements, and Fargate provisions a right-sized, isolated microVM to run it — **no EC2 instances to provision, patch, scale, or bin-pack**. Each task gets its own kernel-level isolation, its own ENI (in `awsvpc` mode), and you're billed **per vCPU-second and per GB-second** for exactly the resources the task requested, from launch to stop.

It solves the "I don't want to run a node fleet" problem: no capacity planning, no AMI patching, no cluster autoscaler to tune, no idle instances. The trade-off is a **higher per-unit price** than well-utilised EC2 and **no access to the host** (no GPUs, no privileged host tuning, ECS Exec instead of SSH). **Fargate Spot** offers a discount for interruption-tolerant tasks. Fargate is the default recommendation for teams that value engineering time over squeezing the last cent of compute cost.

### Q4. What is EKS and how does it differ from ECS?

**EKS (Elastic Kubernetes Service)** is AWS's managed Kubernetes: AWS runs the highly-available **control plane** (API server, etcd) for a flat hourly fee, and you run workloads on **node groups** (EC2) and/or **Fargate profiles**. You interact with it through the standard Kubernetes API — kubectl, Helm, operators, CRDs, the whole ecosystem — so workloads are portable across any conformant Kubernetes.

Differences from **ECS**:

| | ECS | EKS |
|---|---|---|
| API / model | AWS-proprietary, simpler | Upstream Kubernetes |
| Portability | AWS-only | Runs anywhere k8s runs |
| Ecosystem | AWS-native integrations | Full CNCF ecosystem (Helm, operators) |
| Complexity | Lower | Higher (you own more moving parts) |
| Control-plane cost | Free | Hourly per cluster |
| Best for | Teams wanting simple AWS containers | Teams with k8s skills, multi-cloud, or needing k8s features |

Pick **ECS** when you want the least operational surface and you're all-in on AWS. Pick **EKS** when you have Kubernetes expertise, need its ecosystem/portability, or standardise on k8s across clouds. Choosing EKS without k8s experience is a common over-engineering trap.

### Q5. How would you decide between ECS and EKS for a new platform?

Drive it off the team and requirements, not fashion:

**Lean ECS when:**
- The team has little/no Kubernetes experience.
- You're committed to AWS (no multi-cloud/portability need).
- You want the smallest operational surface and fastest time-to-production.
- Your needs are "run some containers behind load balancers with autoscaling."

**Lean EKS when:**
- You already have Kubernetes skills/tooling and standards.
- You need the k8s ecosystem (Helm charts, operators, service meshes, CRDs) or specific k8s features.
- You want **workload portability** across clouds/on-prem.
- You're a large org where a common k8s platform amortises across many teams.

The honest senior answer notes that **EKS carries real ongoing cost** — the control-plane fee, plus the human cost of upgrades, add-ons, and CVE patching. If nothing requires Kubernetes, ECS usually wins on total cost of ownership. Both can run on Fargate to remove the node-management burden.

### Q6. Explain ECS task networking modes.

The `networkMode` in the task definition:

- **`awsvpc`** — each task gets its **own ENI and private IP** in your VPC, its own security group, and is a first-class network citizen. **Required for Fargate** and strongly recommended for EC2 too. Cleanest security model (per-task SGs) but consumes VPC IPs and, on EC2, is bounded by the instance's ENI limit.
- **`bridge`** — the classic Docker bridge network on EC2; containers share the host's networking via a virtual bridge, using **dynamic port mapping** so multiple tasks can share ports (the ALB maps to them). More packing per host, weaker isolation.
- **`host`** — containers bind directly to the **host's network interface** (best raw performance, no port flexibility since ports collide). EC2 only.
- **`none`** — no external networking.

Modern designs default to **`awsvpc`** for the per-task security group and clean integration with ALB/NLB target groups and VPC flow logs; `bridge`/`host` are legacy or performance-corner choices on EC2.

### Q7. How do service discovery and load balancing work for ECS services?

Two complementary mechanisms:

**Load balancing** — an ECS service registers its tasks as targets in an **ALB** (HTTP/HTTPS, path/host routing) or **NLB** (TCP/UDP, ultra-low latency) target group. In `awsvpc` mode each task's ENI IP is a target; the LB health-checks tasks and the service replaces failing ones. This is how external/north-south traffic reaches the service.

**Service discovery (AWS Cloud Map)** — for **service-to-service (east-west)** traffic, ECS integrates with Cloud Map to register each task under a DNS name (e.g. `orders.internal`) or a discoverable API, updating records as tasks come and go. Callers resolve the name to healthy task IPs without a load balancer in the path. **ECS Service Connect** is the newer layer on top, adding a proxy that gives client-side load balancing, retries, and richer telemetry between services.

Rule of thumb: **ALB/NLB** for ingress and public endpoints; **Cloud Map / Service Connect** for internal microservice-to-microservice discovery.

### Q8. What's the difference between a task role and an execution role?

This distinction is a frequent interview trap because getting it wrong is a real security bug.

- **Task execution role** — assumed by the **ECS agent / Fargate infrastructure**, *not your app*. It grants the permissions needed to **start** the task: pull the image from ECR, fetch secrets from Secrets Manager/SSM for injection, and write logs to CloudWatch. Think "platform bootstrap permissions."
- **Task role** — assumed by **your application code running inside the container**. It grants what your app needs at runtime: read an S3 bucket, write to DynamoDB, publish to SNS. Delivered via the task metadata endpoint, so the SDK picks up temporary credentials automatically — **no static keys in the container**.

Keeping them separate enforces least privilege: the platform can pull images and read the specific secrets, while the app gets only its own data-plane permissions. A common mistake is dumping all permissions into the execution role (or reusing one role for both), which over-privileges the platform layer and muddies the security boundary.

### Q9. What does ECR provide beyond being a private Docker registry?

**ECR (Elastic Container Registry)** is AWS's private OCI/Docker registry, but its value is the AWS integration:

- **IAM-based authentication** — no separate registry credentials; pulls/pushes are authorised by IAM policies and repository policies, and tasks pull via the execution role.
- **Image scanning** — **basic scanning** (Clair-based CVE scan on push) and **enhanced scanning** via Amazon Inspector for continuous, deeper OS + language-package vulnerability detection.
- **Lifecycle policies** — automatically expire old/untagged images to control storage cost and keep repos tidy.
- **Immutable tags** — optionally prevent tag overwriting so a deployed digest can't silently change.
- **Cross-region/cross-account replication** and **pull-through cache** (proxy/cache upstream registries like Docker Hub to dodge rate limits).
- **Encryption at rest** (SSE-S3 or KMS) and VPC interface endpoints for private pulls.

So ECR isn't just storage; it's the registry wired into AWS auth, security scanning, and cost controls that a production container platform needs.

### Q10. How does autoscaling work for ECS and EKS?

There are two layers — scale the *tasks/pods*, and scale the *capacity* underneath.

**ECS:**
- **Service Auto Scaling** — adjusts the service's desired task count via **target tracking** (e.g. keep CPU at 60%, or requests-per-target on the ALB), step scaling, or scheduled scaling.
- **Capacity providers** — manage the underlying capacity: **Fargate/Fargate Spot** (capacity is just there), or an **EC2 Auto Scaling group** with **managed scaling** that grows/shrinks the instance fleet to fit pending tasks.

**EKS:**
- **Horizontal Pod Autoscaler (HPA)** scales pod replicas on CPU/memory/custom metrics; **VPA** adjusts pod resource requests.
- Node scaling via the **Cluster Autoscaler** (scales node groups) or, increasingly, **Karpenter**, which provisions **right-sized EC2 just-in-time** for pending pods — faster, more bin-packing-efficient, and consolidates underused nodes. On Fargate profiles, node scaling is moot (each pod gets its own capacity).

The senior point: scaling tasks/pods without scaling the capacity underneath just produces pending tasks — you need **both** layers configured, and metrics that reflect actual load (RPS or queue depth often beat raw CPU).

### Q11. How do you inject secrets into containers on ECS?

Reference them in the **task definition** and let the platform inject them at task start — never bake secrets into the image or plaintext env vars:

- **`secrets`** in a container definition maps an environment variable (or, for some, a file) to a **Secrets Manager** ARN or **SSM Parameter Store** (SecureString) parameter. The **execution role** must have permission to read those specific ARNs, and the value is fetched and injected at launch so it never appears in the task definition or image.
- Secrets Manager adds **automatic rotation**; SSM Parameter Store is cheaper for config-style secrets without rotation.
- For app-runtime access to secrets (as opposed to launch-time env injection), the app can call Secrets Manager directly using the **task role**.

Best practices: scope the execution role to exact secret ARNs, prefer injection over app-side fetch for simple env values, encrypt with a customer-managed KMS key where compliance requires it, and rotate rather than long-live credentials.

### Q12. What are sidecars and how are they used in ECS/EKS?

A **sidecar** is an auxiliary container that runs **alongside** your main application container in the same task/pod, sharing its network and lifecycle, to provide a cross-cutting capability without changing the app:

- **Logging/telemetry** — e.g. the **FireLens/Fluent Bit** sidecar routes container logs to CloudWatch, OpenSearch, or third parties; the **CloudWatch/ADOT** agent collects metrics/traces.
- **Service mesh proxy** — **App Mesh Envoy** (or Istio on EKS) intercepts traffic for mTLS, retries, and observability.
- **Auth/refresh helpers** — a sidecar that renews tokens or credentials for the app.

In ECS you add a second container definition to the same **task definition** and use **container dependencies** (`dependsOn` with `START`/`HEALTHY` conditions) so the sidecar is ready before the app starts and shuts down cleanly. The pattern keeps the application image focused on business logic while platform concerns live in reusable sidecars — at the cost of extra CPU/memory per task and more moving parts.

### Q13. Fargate vs EC2 launch type — how do the cost and control trade-offs actually play out?

**Cost:** Fargate charges **per task's vCPU-second + GB-second** — you pay for exactly what each task requests, with zero idle-instance waste, but at a **higher unit rate**. EC2 charges **per instance-hour** regardless of packing, so if you **bin-pack many tasks** onto well-utilised instances (and use Savings Plans/Reserved Instances or Spot), the per-unit cost drops well below Fargate. The crossover is utilisation: at low/spiky utilisation Fargate is cheaper in *total* (no idle waste, no ops); at high steady utilisation, packed EC2 wins on raw compute cost.

**Control:** EC2 gives you the host — GPU/large-memory instance types, kernel tuning, daemonsets, custom AMIs, host-level agents. Fargate abstracts the host away — **no GPUs, no privileged host access, ECS Exec instead of SSH**, and per-task resource ceilings.

**The honest total-cost view:** Fargate's premium often disappears once you price in the **engineering time** for patching AMIs, tuning the cluster autoscaler, and carrying idle capacity headroom. Default to Fargate; move specific workloads to EC2 when hardware needs or proven high-utilisation cost math justify the operational burden. **Fargate Spot** and **EC2 Spot** further cut cost for interruption-tolerant work.

### Q14. What is AWS App Runner and when would you choose it?

**App Runner** is a fully-managed service that takes a **container image (from ECR) or source code (from a repo)** and runs it as a scalable HTTPS web service — building, deploying, load-balancing, TLS, and autoscaling (including **scale-to-zero**-ish idle behaviour) all handled for you. You don't touch clusters, task definitions, load balancers, or networking primitives.

Choose App Runner when:
- You have a **stateless web app or API** and want the absolute minimum config — "point at my repo/image and give me a URL."
- The team doesn't want to learn ECS/EKS concepts at all.
- Traffic is variable and you value automatic request-based scaling.

Skip it when you need fine-grained control over networking, sidecars, non-HTTP workloads, batch jobs, or complex service topologies — that's ECS/EKS territory. Think of App Runner as sitting **between Lambda and ECS/Fargate**: more than a function, less to manage than a full container platform, but less flexible than either.

### Q15. What is Karpenter and why do teams adopt it for EKS?

**Karpenter** is an open-source Kubernetes node autoscaler (originated at AWS) that replaces the traditional **Cluster Autoscaler**. Instead of scaling pre-defined node groups up and down, Karpenter watches for **unschedulable pods** and provisions **right-sized EC2 instances just-in-time** — choosing instance types, sizes, and purchase options (On-Demand/Spot) that best fit the pending pods' actual resource requests.

Why teams adopt it:
- **Faster scale-up** — it launches instances directly rather than nudging ASGs.
- **Better bin-packing / lower cost** — it picks efficient instance types and **consolidates** underutilised nodes by rescheduling pods onto fewer/cheaper instances.
- **Flexibility** — provisioner/NodePool constraints (instance families, zones, Spot vs On-Demand) without hand-maintaining many node groups.

It shifts EKS node management toward "declare constraints, let Karpenter optimise capacity," which is why it's become the default recommendation for cost- and scale-conscious EKS clusters. (On **Fargate profiles** there are no nodes to autoscale, so Karpenter is for the EC2-backed portion of a cluster.)

### Q16. Design a container platform for a set of microservices and justify the choices.

**Baseline recommendation** for a team without deep Kubernetes investment: **ECS on Fargate**.

- **Orchestrator: ECS** — lowest operational surface, deep AWS integration, no control-plane fee, fast to production. Reach for **EKS** only if the org already runs Kubernetes or needs its ecosystem/portability.
- **Compute: Fargate** — no node fleet to patch or bin-pack; scale-to-need per service. Use **Fargate Spot** for stateless/interruption-tolerant workers. Carve out an **EC2 capacity provider** only for workloads that need GPUs or have proven high, steady utilisation where packed EC2 is cheaper.
- **Networking: `awsvpc`** — per-task ENIs and security groups in private subnets; VPC endpoints for AWS services; NAT only where public egress is truly needed.
- **Ingress: ALB** for HTTP services; **Cloud Map / Service Connect** for east-west service discovery.
- **Images: ECR** with enhanced scanning, immutable tags, and lifecycle policies to expire old images.
- **IAM:** distinct **execution role** (pull images, read the specific secrets, write logs) and per-service **task roles** (only that service's data-plane permissions).
- **Secrets:** injected from Secrets Manager/SSM via the task definition, not baked into images.
- **Autoscaling:** Service Auto Scaling on **RPS/queue-depth** (not just CPU); capacity providers handle capacity.
- **Observability:** FireLens/Fluent Bit + ADOT sidecars to CloudWatch/OpenSearch and X-Ray.

The justification thread throughout: **minimise operational surface first, add control (EKS, EC2) only where a concrete requirement pays for the complexity.**

## Object Storage: S3

### Summary

**What this topic covers**

Amazon S3 is the foundational object store of AWS and shows up in nearly every architecture — as a data lake, a static site host, a backup target, an event source, and the overflow store for everything that won't fit in a payload limit. This topic's 18 questions cover the object model (buckets, keys, objects), the two numbers everyone conflates (**durability** vs **availability**), the full **storage-class** ladder and its retrieval trade-offs, **lifecycle** automation, the (since-2020) **strong read-after-write consistency**, **versioning** and protection, the layered **security** model (Block Public Access, policies vs ACLs vs IAM, presigned URLs), the **encryption** options, **replication**, **performance** at scale (prefix parallelism, multipart, Transfer Acceleration, byte-range), static hosting behind **CloudFront/OAC**, **event notifications**, **Object Lock/WORM** for compliance, **S3 Select**, and the **cost pitfalls** (retrieval, request, and egress charges) that turn a cheap store into a surprise bill.

**Mental model**

S3 is a **flat key-value object store**, not a filesystem. A bucket holds objects; each object has a **key** (a string like `logs/2025/01/app.log`), the object bytes, and metadata. The `/` in a key is pure convention — the console *renders* prefixes as folders, but there are no real directories, which is why "listing a folder" is really "list keys with this prefix." Design around three ideas. (1) **Durability is about not losing data** — S3 Standard is **11 nines (99.999999999%)** durable, replicating across ≥3 AZs; **availability** is a separate, lower number about whether you can reach it right now. (2) **You pick a storage class per object based on access pattern**, trading retrieval latency and per-request cost against storage price — hot data in Standard, cold archives in Glacier tiers, unknown patterns in Intelligent-Tiering. (3) **Security is deny-by-default and layered** — Block Public Access, bucket policies, IAM, and (legacy) ACLs stack, and *explicit deny always wins*. Since December 2020, S3 gives **strong read-after-write consistency** for all operations, so the old "eventually consistent, might read a stale object" caveat is gone. The cost model punishes the naive: you pay to store, to request, to retrieve from cold tiers, and — most painfully — to **egress** data out to the internet.

**Key terms**

- **Bucket** — the globally-named top-level container for objects (name unique across all of AWS, region-bound).
- **Object / key** — the stored bytes plus metadata, addressed by a unique key string within the bucket.
- **Durability** — probability data survives; Standard is **11 nines**, backed by multi-AZ replication.
- **Availability** — probability you can access it now (e.g. Standard's SLA is lower than its durability).
- **Storage class** — the tier (Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, Glacier Instant/Flexible/Deep Archive) trading price vs retrieval.
- **Lifecycle policy** — rules to transition objects between classes or expire them automatically by age.
- **Versioning** — keep every version of an object under one key; protects against overwrite/delete.
- **Block Public Access** — account/bucket-level master switch that overrides any policy/ACL granting public access.
- **Presigned URL** — a time-limited URL granting temporary object access using the signer's credentials.
- **SSE-S3 / SSE-KMS / SSE-C / DSSE** — server-side encryption variants differing in who manages the key.
- **Replication (CRR/SRR)** — asynchronous copy of objects to another bucket, cross-region or same-region.
- **Multipart upload** — split a large object into parts uploaded in parallel and reassembled.
- **Object Lock (WORM)** — write-once-read-many retention for compliance (governance vs compliance mode).

**Why interviewers ask this**

S3 is universal, so it's a reliable probe for depth. The junior answer is "it's cheap object storage, you put and get files." The senior answer distinguishes **durability from availability** without prompting, knows the **storage-class retrieval trade-offs** cold (Glacier Deep Archive is dirt cheap to store but costs money and hours to retrieve), reaches immediately for **Block Public Access + bucket policy + presigned URLs** when asked to secure data, and — crucially — anticipates the **cost traps**: cross-region egress, per-request charges at billions of small objects, and retrieval fees on IA/Glacier that make a "cheap" tier expensive if you actually read the data. Interviewers also test whether you know what changed: **strong consistency since 2020** and **ACLs being effectively deprecated** in favour of policies + Object Ownership. A candidate who models S3 as a filesystem, or who thinks 11 nines means "always reachable," reveals the ceiling of their experience quickly.

**Common confusions**

- "Durability and availability are the same" — durability (**11 nines**) is *not losing* data; availability is *reaching* it now (a lower SLA number). Different guarantees.
- "S3 is a filesystem with folders" — it's **flat key-value**; folders are a console illusion over key prefixes.
- "S3 is eventually consistent" — **not since Dec 2020**; all reads are now strongly consistent read-after-write.
- "Cheaper storage classes are just cheaper" — IA/Glacier add **per-GB retrieval fees, minimum storage durations, and (Glacier) retrieval latency**; frequent access to IA can cost *more* than Standard.
- "One Zone-IA is fine for critical data" — it stores in a **single AZ**, so an AZ loss can lose it; only for reproducible/secondary data.
- "Use ACLs to grant access" — ACLs are **legacy**; AWS now recommends disabling them (Object Ownership = bucket-owner-enforced) and using bucket policies + IAM.
- "Making a bucket public is how you serve a website" — prefer **CloudFront + Origin Access Control** with a private bucket; Block Public Access should stay on.

**What follows from this topic**

S3 threads into nearly every other topic. Its **event notifications** feed the **Lambda** and messaging topics (S3 → Lambda/SQS/SNS/EventBridge). Its **encryption** and **access-control** model connect to the **IAM/security** and **KMS** topics (SSE-KMS, bucket policies, VPC gateway endpoints). Static hosting hands off to **CloudFront/CDN**. As a data-lake store it underpins analytics (Athena queries S3, S3 Select projects columns). And its cost pitfalls tie into the **cost-optimization** pillar of Well-Architected. If you understand S3's consistency, security, and cost model deeply, a large fraction of AWS architecture questions become tractable.

### Q1. What are buckets, objects, and keys in S3?

- **Bucket** — the top-level container. Its name is **globally unique across all of AWS** (not just your account) and it lives in a specific **Region**, though the namespace is global. You address objects through the bucket.
- **Object** — the stored entity: the bytes (up to **5 TB**), plus system metadata (size, last-modified, storage class, ETag) and optional user metadata. Objects are **immutable** — you replace, not edit in place.
- **Key** — the unique string that identifies an object within a bucket, e.g. `images/2025/cat.png`. The full address is bucket + key.

Critically, S3 is a **flat key-value store**, not a hierarchical filesystem. The `/` characters in a key are just characters; the console *renders* common prefixes as "folders" for convenience, but there is no directory object. "Listing a folder" is a **prefix query** (`list-objects --prefix images/2025/`). This flatness is what makes S3 scale to trillions of objects — there's no directory tree to traverse.

### Q2. Explain durability vs availability in S3.

They're two different guarantees that beginners merge:

- **Durability** = probability your data **survives** over time. S3 Standard offers **99.999999999% (11 nines)** durability, achieved by redundantly storing each object across **at least three Availability Zones**. Practically, you're far more likely to lose data to a bad `PUT` or a mis-scoped delete than to S3 losing it.
- **Availability** = probability you can **access** the data at a given moment. This is a lower, separate number backed by an **SLA** (e.g. Standard targets 99.99% availability). Availability varies by storage class — One Zone-IA has lower availability because it lives in a single AZ.

So "11 nines" does **not** mean "always reachable" — it means "essentially never lost." A transient outage can dent availability without touching durability. When someone asks how you'd protect *critical* data, you address durability (which class, replication, versioning) *and* availability (multi-AZ classes, cross-region replication) separately.

### Q3. Walk through the S3 storage classes and their trade-offs.

| Class | Use case | Retrieval | Key trade-off |
|---|---|---|---|
| **Standard** | Hot, frequently accessed | Instant | Highest storage price, no retrieval fee |
| **Intelligent-Tiering** | Unknown/changing access | Instant (auto-tiers) | Small monitoring fee; auto-moves objects between tiers, no retrieval fee |
| **Standard-IA** | Infrequent but needs instant access | Instant | Lower storage, **per-GB retrieval fee**, 30-day min, 128 KB min billable |
| **One Zone-IA** | Infrequent + reproducible | Instant | ~20% cheaper than Standard-IA but **single AZ** (lose AZ = lose data) |
| **Glacier Instant Retrieval** | Archive, rare access, instant | Instant (ms) | Cheap storage, higher retrieval fee, 90-day min |
| **Glacier Flexible Retrieval** | Archive, minutes-to-hours OK | Minutes to 12h (expedited/standard/bulk) | Very cheap storage, retrieval latency + fee, 90-day min |
| **Glacier Deep Archive** | Cold compliance archive | **12+ hours** | Cheapest storage, longest retrieval, 180-day min |

The governing trade-off is **storage price vs retrieval cost + latency**. Moving down the ladder slashes per-GB storage but adds retrieval fees, minimum storage durations, and (for Glacier) hours of latency. **Intelligent-Tiering** is the safe default when you can't predict access, because it auto-tiers without retrieval fees. Choosing Glacier for data you actually read often is a classic cost mistake.

### Q4. How do lifecycle policies work?

A **lifecycle configuration** is a set of rules on a bucket (scoped by prefix and/or tags) that **automatically manages objects by age**, without you writing any code:

- **Transition actions** — move objects to a cheaper class after N days: e.g. Standard → Standard-IA after 30 days → Glacier Flexible after 90 → Deep Archive after 365.
- **Expiration actions** — permanently delete objects after N days (great for logs and temp data).
- **Version-specific rules** — expire **noncurrent versions** after N days, and **clean up incomplete multipart uploads** (a silent cost leak if you don't).

Rules run asynchronously (roughly daily). Watch the **minimum storage durations**: transitioning to IA/Glacier before their 30/90/180-day minimums still bills the minimum, and each transition is a small per-object request charge — so transitioning billions of tiny objects can cost more than it saves. Lifecycle policies are the primary lever for the **cost-optimization** pillar on S3.

### Q5. What consistency model does S3 provide?

Since **December 2020**, S3 provides **strong read-after-write consistency** for **all** operations — PUTs of new objects, overwrites, and deletes — across all Regions, automatically and at no extra cost.

Concretely: after a successful `PUT` (new object or overwrite) you are **guaranteed** to read the latest data on a subsequent `GET`, and `LIST` operations immediately reflect the change. There is **no window** where you might read a stale version or a 404 for an object you just wrote.

This matters because the **old** model (pre-2020) was *eventually consistent* for overwrites and deletes, which forced awkward workarounds — write-then-read retry loops, external consistency layers (S3Guard/EMRFS), or versioned keys — in data pipelines. Those are now unnecessary. If an interviewer or old design doc mentions S3 eventual consistency, that's outdated. (Note: features layered *on top*, like cross-region replication, are still asynchronous — the *replica* is eventually consistent even though the source is strongly consistent.)

### Q6. How do versioning and MFA delete protect your data?

**Versioning** (enabled per bucket) keeps **every version** of an object under the same key. An overwrite creates a new version rather than replacing; a "delete" just adds a **delete marker** (the object is hidden but recoverable by removing the marker or requesting the version ID). This protects against **accidental overwrites and deletes** and application bugs — you can always roll back to a prior version. Once enabled, versioning can be suspended but not fully disabled, and you pay to store every version (pair it with a lifecycle rule to expire noncurrent versions).

**MFA Delete** adds a second factor: when enabled, **permanently deleting a version** or **suspending versioning** requires an MFA token from the bucket owner (root) in addition to normal permissions. This hardens against a compromised credential or a malicious insider wiping history. It's stricter to operate (root + MFA, CLI-only to configure) so it's reserved for high-value buckets (audit logs, compliance data). Together, versioning + MFA Delete + lifecycle give you recoverability plus a tamper barrier.

### Q7. Explain the S3 security model: Block Public Access, bucket policies, ACLs, and IAM.

S3 access is **deny-by-default** and evaluated across layered controls; **explicit deny always wins**.

- **Block Public Access (BPA)** — a master **override switch** at account and bucket level. When on (the modern default), it **blocks any public access** regardless of what policies or ACLs say. This is the guardrail that prevents the classic "accidentally public bucket" leak; keep it on unless you have a deliberate, reviewed reason.
- **IAM policies** — attached to *principals* (users/roles); "what can this identity do." Best for controlling access from within your account.
- **Bucket policies** — resource-based policies attached to the *bucket*; "who can do what to this bucket," including cross-account grants and conditions (source VPC, IP, TLS-only, encryption-required). The primary modern access mechanism.
- **ACLs** — the **legacy** per-object/bucket grant system. AWS now recommends **disabling ACLs** via **Object Ownership = bucket-owner-enforced** and using policies + IAM instead.

The recommended posture: **BPA on**, ACLs disabled, access via IAM + bucket policies, and temporary access via presigned URLs (Q8). Public web hosting goes through **CloudFront + OAC** with the bucket private (Q15).

### Q8. What is a presigned URL and when would you use one?

A **presigned URL** is a time-limited URL that embeds a signature derived from an IAM principal's credentials, granting **temporary, specific access** to a single object (a `GET` to download or a `PUT` to upload) **without** the caller having any AWS credentials or the bucket being public.

Typical uses:
- Let an end user **download** a private object (an invoice, a paid asset) directly from S3 for a few minutes, without proxying the bytes through your servers.
- Let a browser/mobile client **upload directly** to S3 (`PUT` presigned URL, or presigned POST) so large files bypass your backend entirely.

Key properties: the URL inherits the **signer's permissions** (so sign with a least-privilege role), it **expires** (seconds to a few hours; capped by the signer's credential lifetime), and anyone with the URL can use it until it expires — so treat it like a bearer token, keep TTLs short, and scope to the exact key/operation. It's the standard way to give controlled access while keeping **Block Public Access on** and the bucket private.

### Q9. Compare the S3 server-side encryption options.

All objects can be encrypted at rest server-side; the options differ in **who controls the key**:

| Option | Key management | When to use |
|---|---|---|
| **SSE-S3** | S3-managed keys (AES-256), fully automatic | Default baseline encryption, no key control needed |
| **SSE-KMS** | AWS KMS customer-managed key | You need **audit trails (CloudTrail), key rotation policies, and per-key access control** |
| **SSE-C** | You supply the key on every request | You must hold the keys yourself; S3 never stores them |
| **DSSE-KMS** | **Double** layer of KMS encryption | Regulatory requirements mandating two independent encryption layers |

**SSE-S3** is the zero-effort default (and S3 now encrypts all new objects by default). **SSE-KMS** is the common enterprise choice because it gives you **CloudTrail logging of decrypts, key-policy access control, and rotation** — but each object operation calls KMS, which adds latency and cost at scale. That's what **S3 Bucket Keys** fix: they generate a short-lived bucket-level key so S3 makes **far fewer KMS calls**, cutting KMS request cost by up to ~99% for high-volume buckets — enable them whenever you use SSE-KMS at scale. **SSE-C** is niche (you manage keys entirely), and **DSSE-KMS** is for strict compliance mandates.

### Q10. What is S3 replication and what are CRR vs SRR?

**Replication** asynchronously copies objects from a source bucket to a destination bucket, automatically as they're written:

- **Cross-Region Replication (CRR)** — destination in a **different Region**. Used for **DR/resilience**, reducing latency for geographically-distributed readers, and meeting data-residency/compliance requirements.
- **Same-Region Replication (SRR)** — destination in the **same Region**. Used for aggregating logs into one bucket, replicating between accounts (prod → audit account), or keeping a copy with different lifecycle/ownership.

Both require **versioning enabled** on source and destination, replicate only objects written *after* replication is configured (unless you run S3 Batch Replication to backfill), and are **eventually consistent** on the replica (the source stays strongly consistent). You can filter by prefix/tags, change storage class or owner on the destination, and use **Replication Time Control (RTC)** for a 15-minute replication SLA. Note replication copies data across Regions/accounts, incurring **transfer and request costs**, so scope it to what actually needs replicating.

### Q11. How do you get high performance out of S3?

S3 scales enormously, but a few techniques matter:

- **Prefix parallelism** — S3 now supports **≥3,500 PUT/COPY/POST/DELETE and ≥5,500 GET/HEAD requests per second *per prefix***, and scales automatically. Spreading keys across many prefixes multiplies throughput. (Modern S3 auto-partitions, so the old "randomise the key prefix" hack is far less necessary, but distributing load across prefixes still helps at extreme scale.)
- **Multipart upload** — split objects (>100 MB recommended, required >5 GB) into parts uploaded **in parallel**, improving throughput and resilience (retry a failed part, not the whole file). Remember to abort incomplete uploads via lifecycle to avoid paying for orphaned parts.
- **Byte-range fetches** — `GET` a specific range to parallelise large downloads or read just a header/section of a big object.
- **S3 Transfer Acceleration** — routes uploads through the nearest **CloudFront edge** and over AWS's backbone, speeding long-distance transfers (for a fee).
- **CloudFront** in front of S3 for read-heavy public content — caches at the edge, cutting latency and S3 GET/egress cost.

The senior framing: pick the technique for the bottleneck — latency (edge/CloudFront), throughput (prefixes + multipart + range), or distance (Transfer Acceleration).

### Q12. How do you host a static website on S3, and why put CloudFront in front?

S3 can serve a static site two ways. The **legacy S3 static website hosting** feature gives you a website endpoint with index/error document support — but it requires making the bucket **public** (HTTP only, no custom TLS), which conflicts with Block Public Access best practice.

The **recommended architecture** is **CloudFront + a private S3 bucket with Origin Access Control (OAC)**:

- The bucket stays **private** (Block Public Access on); only CloudFront can read it, enforced by a bucket policy scoped to the distribution via **OAC** (the modern replacement for the older Origin Access Identity).
- **CloudFront** provides **HTTPS with your own ACM certificate**, edge caching (lower latency + far less S3 egress/GET cost), custom domains, compression, and security headers.
- You get WAF, geo-restriction, and signed URLs/cookies for private content on top.

So CloudFront isn't just a speed-up — it's how you serve a static site **securely (private origin, TLS) and cheaply (edge caching cuts egress)** while keeping the bucket locked down. Direct S3 website hosting is only acceptable for throwaway/internal cases.

### Q13. How do S3 event notifications work and where can they go?

S3 can emit events when objects change — `s3:ObjectCreated:*` (PUT/POST/COPY/multipart complete), `s3:ObjectRemoved:*`, restore events, replication events — filtered by **prefix and suffix** (e.g. only `uploads/*.jpg`).

Destinations:
- **Lambda** — run code per object (thumbnailing, indexing, validation).
- **SQS** — queue events for buffered/decoupled processing (good for absorbing bursts and controlling consumer concurrency).
- **SNS** — fan out one event to multiple subscribers.
- **EventBridge** — the most flexible: richer event schema, **content-based filtering rules**, and routing to dozens of targets (Step Functions, cross-account, third parties).

Design notes: notifications are **at-least-once** (design consumers to be **idempotent** — duplicates happen), and delivery is near-real-time but not guaranteed ordered. For fan-out or complex routing prefer **EventBridge**; for buffering and backpressure use **SQS**; for a single direct action, **Lambda**. This event model is what makes S3 the front door of event-driven pipelines (tie-in to the Lambda and messaging topics).

### Q14. What is S3 Object Lock and when do you need it?

**S3 Object Lock** enforces **WORM (Write-Once-Read-Many)** — once written, an object version **cannot be deleted or overwritten** until its retention period expires or its legal hold is removed. It requires **versioning** and is typically set at bucket creation.

Two retention modes:
- **Governance mode** — protects objects, but users with a specific `s3:BypassGovernanceRetention` permission can override/shorten retention. Good for internal "don't accidentally delete" protection with an admin escape hatch.
- **Compliance mode** — **no one, including the root account, can delete or shorten** retention until it expires. This is the mode for regulatory mandates.

Plus **Legal Hold** — an indefinite lock independent of any retention period, toggled on/off with a permission, used to preserve data for litigation/investigation.

You need Object Lock for **regulatory compliance** (SEC 17a-4, FINRA, HIPAA-style retention), **ransomware protection** (attackers can't delete immutable backups), and **audit/legal preservation**. It's the answer whenever the requirement is "this data must be provably tamper-proof and undeletable for N years."

### Q15. What is S3 Select and when is it useful?

**S3 Select** lets you retrieve **only a subset of an object's data** using **SQL expressions**, pushed down into S3, instead of downloading the whole object and filtering client-side. It works on individual objects in **CSV, JSON, or Parquet** (optionally compressed) and returns just the matching rows/columns.

Example: an object is a 1 GB CSV, but you only need three columns where `region = 'eu-west-1'`. With S3 Select you send a `SELECT s.col1, s.col2 FROM s3object s WHERE s.region = 'eu-west-1'` and S3 returns only those bytes — dramatically less data transferred and less client CPU.

When it's useful:
- Extracting a slice from large flat files without a query engine.
- Cutting **data-transfer and compute** cost/latency for simple filter/project queries.

Its limits: it's **single-object** (no joins, no cross-file queries, no aggregation across objects). For querying **many** objects, partitioned datasets, or complex SQL, use **Athena** (which queries whole S3 datasets) or a real analytics engine. Think of S3 Select as a lightweight per-object projection, not a database.

### Q16. What are the main cost pitfalls with S3?

S3 storage is cheap; the **surrounding charges** are where bills explode:

- **Egress / data transfer out** — moving data **out to the internet** (or cross-Region) is billed per GB and is often the single largest S3-related cost. Serving downloads directly from S3 instead of through **CloudFront** (which is cheaper and caches) is a classic mistake. Same-Region traffic to other AWS services is usually free — via **VPC gateway endpoints** for S3, avoid routing through a NAT gateway (which bills per GB).
- **Request charges** — PUT/GET/LIST are billed per thousands/millions of requests. At **billions of tiny objects** this dominates; aggregate small files where possible.
- **Retrieval fees + minimum durations** — IA and Glacier charge **per-GB retrieval** and enforce **30/90/180-day minimum storage**; frequently reading "cold" data, or transitioning objects you delete quickly, can cost *more* than Standard.
- **Incomplete multipart uploads** — orphaned parts silently accrue storage cost; expire them with a lifecycle rule.
- **Versioning + no lifecycle** — every version and delete marker is billable; noncurrent versions pile up.
- **Cross-Region replication** — doubles storage plus transfer cost.

The senior habit: model the **access pattern and egress path**, not just the per-GB storage price, and put **CloudFront + VPC endpoints + lifecycle rules** in place before volume grows.

### Q17. What is requester pays and when would you use it?

**Requester Pays** is a bucket setting that shifts the **request and data-transfer (egress) costs** from the bucket **owner** to the **requester** who downloads the data. The owner still pays for **storage**; the accessing account pays for the GET requests and the bytes transferred out.

To access a Requester Pays bucket, the caller must explicitly acknowledge it by including `x-amz-request-payer: requester` (or `--request-payer requester` on the CLI) — anonymous/unacknowledged access is denied — and they must be an authenticated AWS principal (so their account can be billed).

When to use it:
- **Sharing large public datasets** (genomics, satellite imagery, ML training corpora) where the owner is happy to host the data but doesn't want to pay the potentially massive **egress bill** every time someone downloads terabytes.
- Distributing data to **partner accounts** where the consumer should bear their own transfer cost.

It's the standard mechanism behind the AWS Open Data program — the data provider stores it, and each consumer pays for what they pull.

### Q18. Design secure, cost-efficient storage for a data lake and user-uploaded content.

**Buckets and layout:** separate buckets (or clear prefixes) for **raw ingest**, **processed/curated** data, and **user uploads** — different access, lifecycle, and encryption needs. Use meaningful **key prefixes** (`raw/YYYY/MM/DD/…`) both for lifecycle scoping and for parallelism/partitioning by Athena.

**Security:**
- **Block Public Access on** at account level; **ACLs disabled** (Object Ownership = bucket-owner-enforced).
- Access via **IAM + bucket policies**; require **TLS** and **encryption** via policy conditions.
- **SSE-KMS** with a customer-managed key + **S3 Bucket Keys** for auditability without KMS cost blowup.
- User content: browsers upload via **presigned PUT URLs** (backend never touches the bytes); downloads via short-lived **presigned GET** or **CloudFront + OAC**.
- For compliance data, enable **Object Lock (compliance mode)** and **versioning**.

**Cost & lifecycle:**
- **Intelligent-Tiering** for lake data with unpredictable access; **lifecycle** rules to transition curated data to Glacier tiers and **expire raw** ingest after processing.
- Expire **noncurrent versions** and **incomplete multipart uploads**.
- **VPC gateway endpoint** for S3 so internal traffic skips NAT egress charges; **CloudFront** for any public content to cut egress.

**Data access:** query in place with **Athena** (partitioned, Parquet) and use **S3 Select** for lightweight per-object projections; store analytics-ready data as **compressed columnar** to slash scan cost.

**Resilience:** **CRR** to a second Region only for the datasets that genuinely need DR/residency, since it doubles storage + transfer cost. The throughline: **lock it down (BPA, KMS, presigned), tier it intelligently (Intelligent-Tiering + lifecycle), and control egress (endpoints + CloudFront)** — security and cost, the two pillars S3 questions always probe.
## Block & File Storage: EBS, EFS, FSx, Instance Store

### Summary

**What this topic covers**

The storage that attaches to your compute — as opposed to object storage (S3), which is a separate topic. Three families live here: (1) **block storage** — EBS volumes (network-attached, persistent, single-instance by default) and instance store (physically-attached, ephemeral); (2) **file storage** — EFS (managed NFS, Linux, multi-AZ, elastic) and the FSx family (Windows SMB, Lustre for HPC, NetApp ONTAP, OpenZFS); and (3) the **operational glue** — snapshots, encryption, live resizing, RAID, and backups via AWS Backup. The 15 questions in this topic are really one recurring decision: *given a workload, which storage primitive, which volume type, and how do I size IOPS/throughput without over-paying?* Get the block-vs-file-vs-object distinction and the gp3-vs-io2 tradeoff right and most of the rest follows.

**Mental model**

Think in three axes: **persistence**, **sharing**, and **performance shape**. Persistence: EBS and EFS/FSx survive instance termination; instance store dies with the instance (stop, terminate, or underlying-hardware failure). Sharing: EBS is single-attach block (one instance at a time, except io1/io2 multi-attach in one AZ); EFS/FSx are multi-attach file (thousands of instances, a real filesystem with POSIX/SMB semantics). Object (S3) is neither — it's an HTTP API, no filesystem, no block device. Performance shape: block storage gives you raw IOPS and low latency for a database or boot volume; file storage gives you shared throughput for web content, home directories, or HPC scratch; instance store gives you the highest raw IOPS/lowest latency of all (NVMe on the host) but zero durability. The senior instinct: default to **gp3** for general block, reach for **io2 Block Express** only when a single volume genuinely needs >16k IOPS or sub-millisecond consistency, use **EFS** when more than one instance must see the same files, and use **instance store** only for scratch/cache you can rebuild.

**Key terms**

- **EBS** — Elastic Block Store; network-attached block volumes, persist independently of the instance, live in one AZ.
- **gp3** — current general-purpose SSD; baseline 3,000 IOPS / 125 MB/s free, IOPS and throughput provisioned *independently* of size. Cheaper than gp2.
- **io2 Block Express** — highest-performance SSD; up to 256k IOPS, 4,000 MB/s, 64 TiB, sub-ms latency, 99.999% durability. For critical databases.
- **st1 / sc1** — throughput-optimized HDD (big sequential, e.g. logs/big-data) and cold HDD (infrequent access); cheap per GB, low IOPS.
- **Instance store** — ephemeral NVMe/SSD physically attached to the host; highest IOPS, lost on stop/terminate/hardware failure.
- **EBS snapshot** — incremental, block-level backup stored in S3 (in AWS-managed buckets); only changed blocks are stored after the first.
- **EFS** — managed elastic NFS (v4), Linux-only, multi-AZ, grows/shrinks automatically, POSIX permissions.
- **FSx** — managed file systems: FSx for Windows (SMB/AD), FSx for Lustre (HPC scratch), FSx for NetApp ONTAP, FSx for OpenZFS.
- **Multi-Attach** — attach one io1/io2 volume to up to 16 instances in the *same AZ*; needs a cluster-aware filesystem.
- **Throughput vs performance mode (EFS)** — Bursting/Elastic/Provisioned throughput; General Purpose vs Max I/O performance modes.

**Why interviewers ask this**

Storage choice is where cloud bills quietly explode and where reliability quietly fails. The junior answer is "use EBS" for everything; the senior answer distinguishes block from file from object, picks a volume type from an IOPS/throughput/cost budget, and knows the failure modes cold — that instance store data vanishes on a stop/start, that an EBS volume is pinned to one AZ (so cross-AZ HA means snapshots or replication), that EFS latency is higher than EBS and will wreck a latency-sensitive database. Interviewers also probe whether you know gp3 decoupled IOPS from size (the single most common cost win: migrating gp2 → gp3), whether you reach for snapshots vs AWS Backup for a real DR story, and whether you can spot the anti-pattern of putting a shared workload on single-attach EBS.

**Common confusions**

- "Instance store is just cheap EBS" — no; instance store is ephemeral and dies with the instance. Never put anything you can't rebuild on it.
- "EBS is multi-AZ" — an EBS volume lives in exactly one AZ. Only snapshots (in S3) are regional; to move a volume across AZs you snapshot and restore.
- "EFS and EBS are interchangeable" — EFS is shared file (NFS, higher latency); EBS is single-attach block (lower latency). A database wants EBS; a fleet of web servers sharing uploads wants EFS.
- "gp3 costs more than gp2" — gp3 is ~20% cheaper per GB *and* lets you provision IOPS without growing the volume. Migrating is a near-free win.
- "You must stop the instance to resize a volume" — EBS Elastic Volumes let you grow size and change type/IOPS live; you then extend the filesystem online.
- "Snapshots are full copies" — they're incremental at the block level; deleting an old snapshot doesn't break newer ones (AWS tracks block references).

**What follows from this topic**

Block and file storage sit next to **Object Storage (S3)** — the three-way block/file/object choice is a recurring interview frame. Snapshots and AWS Backup connect to **reliability/DR** and to **Networking** (cross-region snapshot copy for DR). Encryption here (KMS-backed EBS/EFS encryption) links to the **Security & IAM** topic. And the compute pairing — which volume for which instance — feeds directly into **EC2 & Compute**.

### Q1. What are the EBS volume types and how do you choose between them?

Two SSD families (IOPS-oriented) and two HDD families (throughput-oriented):

| Type | Media | Best for | Key limits |
|---|---|---|---|
| **gp3** | SSD | Default general purpose; boot volumes, most workloads | Baseline 3,000 IOPS / 125 MB/s free; up to 16,000 IOPS / 1,000 MB/s, provisioned independently of size |
| **gp2** | SSD | Legacy general purpose | IOPS scale with size (3 IOPS/GB); burst to 3,000. Migrate to gp3 |
| **io2 Block Express** | SSD | Critical databases needing high IOPS / low latency | Up to 256,000 IOPS, 4,000 MB/s, 64 TiB, 99.999% durability, sub-ms |
| **io1** | SSD | Older provisioned-IOPS workloads | Up to 64,000 IOPS; io2 supersedes it |
| **st1** | HDD | Big sequential: log processing, data warehouse, streaming | Throughput-optimized; low IOPS, cheap/GB |
| **sc1** | HDD | Cold, infrequently accessed | Cheapest/GB; lowest throughput |

**How to choose:** start at **gp3** — it covers the vast majority of workloads and lets you dial IOPS/throughput without buying capacity. Move to **io2 Block Express** only when a single volume genuinely needs >16k IOPS, consistent sub-millisecond latency, or the extra durability (databases like a busy PostgreSQL/Oracle). Use **st1** for large sequential scans where GB/s matters but random IOPS don't (Kafka, big-data, log stores). Use **sc1** for cold archives you rarely touch. Never use HDD for a boot volume or a random-access database.

### Q2. On EBS, how are size, IOPS, and throughput related — and where does gp3 change the game?

On **gp2**, IOPS were tied to size: 3 IOPS per GB, so a 100 GB volume got 300 IOPS and to get more IOPS you had to over-provision capacity you didn't need. That coupling drove a lot of waste.

**gp3 decouples them.** You get a baseline 3,000 IOPS and 125 MB/s free at *any* size, then provision more IOPS (up to 16,000) and throughput (up to 1,000 MB/s) as separate, independently-priced dials. So a 20 GB volume can have 16,000 IOPS — impossible on gp2 without buying ~5 TB.

Practical implications:
- **Cost win:** migrating gp2 → gp3 is typically ~20% cheaper per GB and often removes the "grow the disk just for IOPS" hack.
- **IOPS-to-throughput ceiling:** on gp3 there's a ratio limit (max 500 IOPS per MB/s of throughput), and throughput also depends on I/O size. A workload doing large sequential I/O is throughput-bound; small random I/O is IOPS-bound — size the dial that's actually your bottleneck.
- **Instance ceiling:** the instance's EBS bandwidth (Nitro EBS-optimized limit) can cap you below the volume's provisioned numbers. A tiny instance won't push a 16k-IOPS volume. Match instance size to volume ambition.

### Q3. How do EBS snapshots work, and how do you use them for backup and DR?

**Incremental, block-level, stored in S3** (in AWS-managed storage, not a bucket you see). The first snapshot copies all written blocks; each subsequent snapshot copies only blocks that changed since the last. Deleting an intermediate snapshot is safe — AWS re-parents block references so remaining snapshots stay complete.

Key operational facts:
- **Crash-consistent by default.** A snapshot captures the volume as-is; for a database, either quiesce/flush first or use application-consistent tooling so you don't restore a torn write.
- **Cross-region copy** for DR: `CopySnapshot` to another region (optionally re-encrypting with a region-local KMS key). This is the backbone of a low-cost DR posture — you don't pay for standby compute, only snapshot storage.
- **Cross-account copy/share** for isolation (e.g. a separate backup account); share the snapshot or copy it, re-encrypting with the target account's KMS key.
- **Fast Snapshot Restore (FSR)** pre-warms a snapshot so restored volumes have full performance immediately instead of lazy-loading blocks from S3 on first read (which otherwise causes a cold-start latency hit).

For anything beyond ad-hoc snapshots, use **AWS Backup** (Q13) to get scheduled policies, retention, and centralized reporting rather than hand-rolling snapshot lifecycle.

### Q4. What is EBS Multi-Attach and when would you actually use it?

Multi-Attach lets a single **io1/io2** volume attach to up to **16 instances simultaneously — within the same AZ**. Each instance gets full read/write block access to the same volume.

The catch that trips people up: **the block device is shared, but the filesystem is not coordinated for you.** A normal filesystem (ext4, XFS) assumes it owns the device exclusively and will corrupt data if two instances mount it read/write. So Multi-Attach is only usable with a **cluster-aware filesystem or application** that manages concurrent access — GFS2, OCFS2, or a clustered database that does its own I/O fencing.

When to use it: high-availability clustered applications that need shared block storage with their own coordination layer (some clustered databases, SAN-style HA setups being lifted to AWS). When *not* to use it: if you just want shared files across instances, that's **EFS** (or FSx), not Multi-Attach — EFS gives you a real shared filesystem with no coordination burden. Multi-Attach is also single-AZ only, so it's not a cross-AZ HA story on its own.

### Q5. How does EBS encryption work?

EBS encryption is **KMS-backed, transparent, and near-zero-overhead** (handled on the Nitro hardware). When a volume is encrypted, so is the data at rest on the volume, all data in transit between the volume and the instance, all snapshots of that volume, and all volumes created from those snapshots.

Details that matter:
- Encryption is chosen at **create time**; you can't toggle it on an existing volume in place. To encrypt an unencrypted volume you snapshot it, then create an encrypted copy of the snapshot (or restore to a new encrypted volume).
- Uses a **KMS CMK** — the AWS-managed `aws/ebs` key by default, or a customer-managed key for your own rotation/policy/audit control.
- **Encryption by default** can be enabled per-region so every new volume and snapshot is encrypted automatically — a common guardrail/Config-rule requirement.
- Copying an encrypted snapshot lets you **re-encrypt with a different KMS key**, which is exactly how you move encrypted data across accounts/regions.

### Q6. EBS vs instance store — what's the difference and when do you use instance store?

| | EBS | Instance store |
|---|---|---|
| Attachment | Network-attached (over Nitro) | Physically attached to the host |
| Persistence | Survives stop/terminate (persists independently) | **Ephemeral** — lost on stop, terminate, or host failure |
| Performance | High, but network-bound | Highest raw IOPS, lowest latency (local NVMe) |
| Resize/snapshot | Yes, live resize + snapshots | No snapshots; fixed with the instance type |
| Cost | Separate charge per GB + IOPS | Included in the instance price |
| AZ | One AZ, movable via snapshot | Tied to the physical host |

**Use instance store for** scratch data you can lose and rebuild: caches, buffers, temporary processing, scratch space for a shuffle/sort, a local replica of data whose source of truth is elsewhere. The killer trap: a **stop/start** moves the instance to new hardware and **wipes instance store** (a *reboot* keeps it, but stop/start does not). Never put a database's only copy, application state, or anything you can't regenerate on instance store. When you need the local-NVMe speed *and* durability, you replicate at the application layer (e.g. a distributed database that keeps N copies across nodes).

### Q7. What is EFS and when should you reach for it?

**EFS (Elastic File System)** is managed **NFS v4** for Linux: a shared, elastic, multi-AZ filesystem that thousands of EC2 instances (and Lambda, and containers) can mount at once with POSIX semantics. It grows and shrinks automatically as you add/remove files — you never provision capacity.

Reach for EFS when **multiple instances need to see the same files**: shared application uploads/content across an Auto Scaling group, home directories, CMS media, shared config, or container persistent volumes that must survive across tasks and be shared between them.

Knobs to know:
- **Throughput modes:** *Elastic* (default now; pay per use, scales automatically — best for spiky/unknown workloads), *Provisioned* (fixed throughput regardless of size, for steady high throughput), *Bursting* (legacy; throughput scales with stored size).
- **Performance modes:** *General Purpose* (lowest latency, default) vs *Max I/O* (higher aggregate throughput at the cost of latency, for massively parallel workloads) — legacy distinction; Elastic throughput mostly supersedes the concern.
- **Storage classes + lifecycle:** Standard vs Infrequent Access (IA) vs Archive; a **lifecycle policy** transitions files not touched for N days to IA/Archive for big cost savings, and can move them back on access.
- **Multi-AZ by design:** data is stored redundantly across AZs (Standard), so it survives an AZ loss — unlike a single EBS volume.

Trade-off: EFS latency is higher than local EBS, so it's wrong for a latency-sensitive database; it's right for shared files.

### Q8. EFS vs EBS — how do you decide?

| | EBS | EFS |
|---|---|---|
| Type | Block device | Shared file system (NFS) |
| Attach | One instance (multi-attach = 1 AZ, special) | Thousands of instances, multi-AZ |
| Protocol | Raw block | NFS v4, POSIX |
| Latency | Lowest (single-digit ms / sub-ms io2) | Higher (network file system) |
| Scaling | Provision + resize manually | Fully elastic, automatic |
| Durability scope | One AZ | Multi-AZ (Standard) |
| Typical use | Boot volume, database, single-instance app | Shared content, home dirs, container PVs |

Decision rule: **if only one instance needs the storage and you care about latency → EBS.** **If many instances need the same files, or you want automatic multi-AZ durability for a filesystem → EFS.** A classic anti-pattern is putting shared web uploads on an EBS volume and then discovering you can't scale the fleet horizontally because only one instance can mount it. The inverse anti-pattern is running a transactional database on EFS and being surprised by the latency.

### Q9. What is the FSx family and what is each member for?

FSx is a set of **managed third-party/high-performance file systems** — you pick the one whose protocol/feature set matches the workload:

| FSx flavor | Protocol | Use it for |
|---|---|---|
| **FSx for Windows File Server** | SMB, integrates with Active Directory | Windows workloads needing shared files, home folders, .NET apps, lift-and-shift Windows file servers |
| **FSx for Lustre** | Lustre (POSIX) | HPC, ML training, genomics, seismic — massive parallel throughput, and can link to an S3 bucket as the data repository |
| **FSx for NetApp ONTAP** | NFS, SMB, iSCSI | Enterprises wanting ONTAP features (snapshots, dedup, SnapMirror, multi-protocol); lift-and-shift from on-prem NetApp |
| **FSx for OpenZFS** | NFS | ZFS features (snapshots, clones) for Linux workloads wanting low-latency NFS with point-in-time clones |

Key differentiators to name in an interview: **Windows** = SMB + AD (EFS can't do this — EFS is Linux/NFS only). **Lustre** = HPC scratch throughput with S3 integration — you mount an S3 bucket as a high-speed scratch filesystem, run the job, write results back. **ONTAP/OpenZFS** = you specifically want those vendors' filesystem features (multi-protocol access, dedup, cheap clones). If someone just says "shared Linux files, keep it simple," that's **EFS**, not FSx.

### Q10. Can you resize or modify EBS volumes live?

Yes — **Elastic Volumes** let you increase size, change volume type, and adjust IOPS/throughput **without detaching or stopping the instance**. The steps:

1. Modify the volume (grow size, e.g. gp3 → gp3 bigger, or gp2 → gp3, or bump IOPS) via console/CLI.
2. The volume enters an `optimizing` state — usually still fully usable, just background-migrating.
3. **Extend the filesystem inside the OS** — the block device is now bigger but the filesystem isn't; run `growpart` + `resize2fs` (ext4) or `xfs_growfs` (XFS) online.

Constraints: you can only **grow**, never shrink, an EBS volume (to shrink, create a smaller volume and copy data). There's a cooldown (~6 hours) before you can modify the same volume again. If you forget step 3, you've paid for capacity the OS can't see — a very common "why didn't my disk get bigger" gotcha.

### Q11. Should you use RAID on EBS?

Usually **no**, and knowing why is the senior signal.

- **RAID 0 (striping)** across multiple EBS volumes can aggregate IOPS/throughput beyond a single volume — but modern **io2 Block Express** (256k IOPS, 4,000 MB/s) makes this rarely necessary, and RAID 0 multiplies your failure surface (lose any one volume, lose the array).
- **RAID 1 (mirroring)** for redundancy is pointless: EBS already replicates within its AZ and gives you 99.8–99.999% durability. You'd be paying double for redundancy AWS already provides.
- The real HA/DR story for EBS is **snapshots + cross-AZ/region restore**, not RAID.

So the answer is: reach for RAID 0 only in the narrow case where you genuinely need more IOPS/throughput than the largest single volume can deliver and you accept the failure-surface trade-off; otherwise a single large gp3/io2 volume is simpler, safer, and usually cheaper. Never RAID 1 on EBS for durability — that's solving a problem AWS already solved.

### Q12. How do you handle data transfer and migration for these storage types?

Depends on direction and volume:

- **Into EFS/FSx from on-prem:** **AWS DataSync** — a managed agent that does fast, incremental, checksum-verified transfers into EFS, FSx, or S3. It's the default for bulk file migration and ongoing sync.
- **Into FSx for Lustre from S3:** link the filesystem to an **S3 data repository** — Lustre lazy-loads objects on access and can export results back to S3.
- **Very large offline transfers:** **AWS Snowball / Snow family** — physical appliances shipped to you for petabyte-scale data that would take too long over the wire.
- **EBS across AZ/region/account:** **snapshots** — snapshot, copy (cross-region/account, re-encrypting), restore.
- **Between file systems / to S3:** DataSync again, or plain `rsync` for small jobs.

The interview point: don't hand-roll `scp` loops for large migrations — DataSync handles retries, incremental deltas, and verification, and Snowball exists precisely because the network is the bottleneck at petabyte scale.

### Q13. How does AWS Backup fit in, versus rolling your own snapshots?

**AWS Backup** is the centralized, policy-driven backup service. Instead of scripting EBS snapshots and EFS/FSx backups per-resource, you define **backup plans** (schedule, retention, lifecycle to cold storage) and **assign resources by tag**. It covers EBS, EFS, FSx, RDS/Aurora, DynamoDB, and more from one place.

Why it beats hand-rolled snapshots:
- **Centralized policy + retention** with lifecycle transitions to cold storage — no cron jobs to maintain.
- **Backup Vault Lock (WORM)** — immutable, compliance-grade retention that even admins can't delete early; the answer to ransomware/insider-deletion scenarios.
- **Cross-region and cross-account copy** built into the plan for DR and account isolation.
- **Centralized auditing/reporting** (AWS Backup Audit Manager) to prove coverage for compliance.

Roll your own only for trivial ad-hoc needs. For anything with a compliance or DR requirement, AWS Backup + Vault Lock is the expected answer.

### Q14. Design the storage layer for a mixed workload: a relational database, a horizontally-scaled web tier sharing user uploads, and an HPC batch job. Which storage for each?

- **Relational database (e.g. PostgreSQL on EC2):** **EBS io2 Block Express** — single-attach block, low latency, high provisioned IOPS, 99.999% durability. Snapshot regularly via AWS Backup; for cross-AZ HA, replicate at the DB layer (or just use RDS/Aurora, which manages this for you). *Not* EFS — the latency would tank transaction throughput.
- **Web tier sharing user uploads across an Auto Scaling group:** **EFS** — every instance mounts the same NFS filesystem, it's multi-AZ durable, and it scales elastically as uploads grow. Add a **lifecycle policy** to move cold uploads to IA/Archive. *Not* EBS — single-attach can't back a horizontally-scaled fleet. (Even better for static assets: put them in **S3 + CloudFront** and skip a shared filesystem entirely.)
- **HPC batch job (e.g. genomics/ML training):** **FSx for Lustre** linked to an **S3 bucket** — stage input from S3, run the parallel job against Lustre's high throughput, write results back to S3, then tear the filesystem down. Use **instance store** on the compute nodes for local scratch/shuffle space you don't need to keep.

The through-line: match **sharing** (single vs many instances) and **latency vs throughput** to the primitive, and push anything that can be object storage to S3 to cut cost and coupling.

### Q15. A team reports they lost data after "restarting" an instance. What most likely happened and how do you prevent it?

The overwhelmingly likely cause: the data was on **instance store**, and they did a **stop/start**, not a reboot. A *reboot* keeps instance store; a *stop then start* migrates the instance to different physical hardware and **wipes the ephemeral volumes**. Same outcome if the underlying host failed. People conflate "restart" with "reboot" and get burned.

**Prevention / remediation:**
- Move any data that must persist to **EBS** (survives stop/start) or, if shared, **EFS/FSx**.
- Treat instance store strictly as scratch/cache with a rebuildable source of truth elsewhere.
- If you need local-NVMe performance *and* durability, replicate at the application layer (distributed DB, or write-through to EBS/S3).
- Enable **termination protection** and, more importantly, back the real data with **EBS snapshots via AWS Backup** so even a full instance loss is recoverable.
- Educate the team on the reboot-vs-stop/start distinction — it's the single most common instance-store data-loss cause.

Bonus senior nuance: even *EBS* root volumes can be set to `DeleteOnTermination=true` (the default for the root volume), so terminating an instance deletes its root EBS volume too — check that flag for anything you care about.

## Networking: VPC

### Summary

**What this topic covers**

The virtual network your resources live in, and every mechanism for controlling traffic into, out of, and across it. This is the densest AWS topic and the one interviewers use to separate people who've *operated* AWS from people who've only launched a few instances. The 18 questions span: VPC/subnet/CIDR design, routing (route tables, Internet Gateway, NAT), the two firewalls (stateful security groups vs stateless NACLs), connecting VPCs and networks (peering, Transit Gateway, VPC endpoints/PrivateLink, VPN, Direct Connect), private access to AWS services, observability (Flow Logs), DNS inside a VPC, IPv6, secure access patterns (bastion vs SSM), and — the question that ties it all together — *why can't my instance reach the internet?*

**Mental model**

A **VPC is a software-defined network scoped to one region**, carved into **subnets that each live in exactly one AZ**. "Public" vs "private" subnet isn't a checkbox — it's entirely determined by routing: a subnet is *public* if its route table sends `0.0.0.0/0` to an **Internet Gateway** *and* the instance has a public/elastic IP. Everything else is private. Traffic flow is governed at two layers: **security groups** wrap the ENI (instance) and are **stateful** (return traffic is auto-allowed); **NACLs** wrap the subnet and are **stateless** (you must allow both directions). To reach AWS services privately (no internet), you use **VPC endpoints**. To connect VPCs you use **peering** (simple, non-transitive) or **Transit Gateway** (hub-and-spoke at scale). To reach on-prem you use **VPN** (over internet, encrypted) or **Direct Connect** (private dedicated line). Almost every connectivity bug is a mismatch between *route table*, *security group*, *NACL*, and *IP/gateway* — check those four in order.

**Key terms**

- **VPC** — regional virtual network defined by a CIDR block (e.g. `10.0.0.0/16`).
- **Subnet** — a CIDR slice of the VPC in a single AZ; public or private by routing.
- **Route table** — rules mapping destination CIDRs to targets (IGW, NAT, peering, endpoint, TGW).
- **Internet Gateway (IGW)** — horizontally-scaled, no-bottleneck gateway giving a subnet internet access (in + out).
- **NAT Gateway** — managed, AZ-scoped device letting *private* subnets make *outbound* internet connections; no inbound.
- **Security group** — **stateful** virtual firewall on the ENI; allow rules only; return traffic auto-allowed.
- **NACL** — **stateless** subnet-level firewall; allow *and* deny rules; evaluated by rule number; both directions explicit.
- **VPC peering** — 1:1 private connection between two VPCs; **non-transitive**.
- **Transit Gateway** — regional hub connecting many VPCs, VPNs, and Direct Connect in a hub-and-spoke.
- **VPC endpoint** — private access to AWS services: **gateway** (S3/DynamoDB, via route table, free) or **interface/PrivateLink** (ENI with private IP, hourly + data).
- **VPC Flow Logs** — capture of accepted/rejected IP traffic metadata for a VPC/subnet/ENI.
- **Direct Connect** — dedicated private physical link from on-prem to AWS; consistent low latency.

**Why interviewers ask this**

VPC is where security misconfigurations and outages are born, so it's the highest-signal networking topic. Interviewers want to see that you can (1) design a **multi-AZ, multi-tier** network with correct public/private separation, (2) explain **security groups vs NACLs** precisely — the stateful/stateless distinction is the single most-asked networking question and getting it wrong is a red flag, (3) reason about **cost** (NAT Gateway data-processing charges and cross-AZ traffic are classic surprise bills), and (4) **troubleshoot** methodically. The senior tell is troubleshooting order: route table → SG → NACL → IGW/NAT → IP, rather than guessing. Junior candidates memorize service names; senior candidates can draw the packet's path and name exactly which control would block it.

**Common confusions**

- "Security groups and NACLs are redundant" — SGs are stateful and per-instance; NACLs are stateless and per-subnet. Different layers, different behavior.
- "A NAT Gateway lets the internet reach my private instances" — no; NAT is *outbound only*. Inbound from the internet needs an IGW + public IP (or a load balancer).
- "VPC peering is transitive" — it is **not**. A↔B and B↔C does not give A↔C. Use Transit Gateway for transit.
- "Making a subnet public just means flipping a setting" — it means an IGW route plus a public IP. No IGW route = private, regardless of any flag.
- "One subnet spans multiple AZs" — a subnet is in exactly one AZ. Multi-AZ = multiple subnets.
- "VPC endpoints cost nothing" — *gateway* endpoints are free; *interface* (PrivateLink) endpoints bill hourly per AZ plus data processing.

**What follows from this topic**

VPC underpins nearly everything: load balancing and Auto Scaling (**Compute**) live in subnets; RDS/ElastiCache (**Databases**) sit in private subnets with SGs; **DNS/CDN** (Route 53 private hosted zones, CloudFront origins) connects here; and **Security & IAM** governs who can change all of it. VPC endpoints and PrivateLink are the bridge to accessing **S3/DynamoDB** privately. If VPC is shaky, security-design questions elsewhere collapse.

### Q1. How do you plan a VPC and its CIDR blocks?

Start from the **address space**. A VPC gets a primary IPv4 CIDR between `/16` (65,536 addresses) and `/28` (16). Pick a block from RFC1918 private space (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) that **won't overlap** with your other VPCs, on-prem networks, or partners — because overlapping CIDRs make peering, TGW, and VPN impossible later. A common convention: `10.<env-or-region>.0.0/16` per VPC.

Then **carve subnets** so that each tier (public/private/data) has one subnet per AZ across 2–3 AZs. Leave headroom — you can add secondary CIDRs to a VPC later, but you can't renumber existing subnets. AWS reserves **5 addresses per subnet** (network, VPC router, DNS, future use, broadcast), so a `/24` gives you 251 usable, not 256.

Senior notes: plan for **growth and connectivity** — reserve non-overlapping ranges across your whole estate up front (IPAM helps), because the expensive mistakes are address collisions discovered when you try to connect two VPCs a year later.

### Q2. Explain public vs private subnets — what actually makes a subnet public?

A subnet is **not** intrinsically public or private; it's determined by **routing plus IP addressing**:

- **Public subnet:** its route table has a route `0.0.0.0/0 → Internet Gateway`, *and* instances have a public or Elastic IP. Both conditions required — an instance with no public IP in an IGW-routed subnet still can't be reached from the internet.
- **Private subnet:** no route to an IGW. For outbound internet (patches, API calls) it routes `0.0.0.0/0 → NAT Gateway`; for no internet at all, it has no default route out.

Each subnet lives in **exactly one AZ**. A standard 3-tier design uses, per AZ: a public subnet (load balancers, NAT), a private app subnet (EC2/containers), and a private data subnet (RDS/ElastiCache). The whole public/private concept is a routing decision — this is why "why is my instance reachable from the internet?" almost always comes down to an unexpected IGW route plus an auto-assigned public IP.

### Q3. What's the difference between a NAT Gateway and a NAT instance, and how do you make NAT highly available?

Both let **private subnets initiate outbound** internet connections (e.g. `apt update`, calling a public API) while blocking unsolicited inbound.

| | NAT Gateway | NAT instance |
|---|---|---|
| Management | Fully managed by AWS | You run/patch an EC2 instance |
| Availability | Highly available *within its AZ* | Single instance = single point of failure |
| Bandwidth | Scales automatically to 100 Gbps | Bounded by instance type |
| Cost | Hourly + per-GB data processing | Just the EC2 cost (cheaper, more work) |
| Effort | Zero | Manage AMI, source/dest check off, failover scripts |

Use **NAT Gateway** by default. **High availability:** a NAT Gateway lives in one AZ, so deploy **one NAT Gateway per AZ** and point each AZ's private route table at its *local* NAT Gateway. That both survives an AZ failure *and* avoids cross-AZ data charges (routing all AZs through one NAT means paying cross-AZ transfer plus a single point of failure). NAT instances survive only as a legacy/cost-optimization for tiny workloads.

**Cost trap:** NAT Gateway **data processing charges** (per GB through the gateway) are a classic surprise bill. Traffic to AWS services should bypass NAT via **VPC endpoints** (Q8) — sending S3 traffic through a NAT Gateway pays twice (NAT processing + the transfer) for no reason.

### Q4. Security groups vs NACLs — give the full comparison.

This is the most-asked VPC question. The core distinction is **stateful vs stateless**.

| | Security Group | Network ACL |
|---|---|---|
| Scope | ENI / instance level | Subnet level |
| State | **Stateful** — return traffic auto-allowed | **Stateless** — must allow return traffic explicitly |
| Rules | **Allow only** | **Allow and deny** |
| Evaluation | All rules evaluated; if any allows → allowed | Rules processed **in number order**; first match wins |
| Default | Deny all inbound, allow all outbound | Default NACL allows all; custom NACL denies all |
| Applies to | Only instances you attach it to | Every instance in the subnet automatically |

**Stateful (SG):** if you allow inbound port 443, the response goes out automatically — you don't add an outbound rule for the reply. **Stateless (NACL):** if you allow inbound 443, you *also* need an outbound rule for the ephemeral response ports (1024–65535), or replies are dropped. This ephemeral-port gotcha is the classic NACL bug.

**When to use NACLs:** they're a coarse, subnet-wide backstop — most teams leave the default (allow-all) NACL in place and do all real control with security groups, reaching for NACLs only to **explicitly deny** something (block an IP range) or enforce a subnet-wide guardrail, because SGs can't express deny.

### Q5. What is VPC peering and what's its big limitation?

VPC peering is a **direct, private, one-to-one network connection** between two VPCs (same or different account/region), using AWS's backbone — no IGW, no VPN, no bandwidth bottleneck, and traffic never traverses the public internet. You update both VPCs' route tables to send the peer's CIDR across the peering connection, and SGs can even reference peer security groups.

The **big limitation: peering is non-transitive.** If VPC A peers with B, and B peers with C, **A cannot reach C** through B. Each pair needs its own peering connection. For N VPCs fully meshed, that's N(N-1)/2 connections — 10 VPCs = 45 connections to manage. That mesh explosion is exactly why **Transit Gateway** exists (Q6). Peering is the right tool for a **small number** of VPCs that need to talk; beyond a handful, move to a hub.

Other constraints: peered VPCs must have **non-overlapping CIDRs**, and you can't route a peer's traffic through your IGW/NAT (no "edge to edge" routing).

### Q6. When do you use Transit Gateway instead of peering?

**Transit Gateway (TGW)** is a **regional hub** that connects many VPCs, VPN connections, and Direct Connect gateways in a **hub-and-spoke** topology. Each VPC attaches once to the TGW; the TGW routes between them. This replaces the N(N-1)/2 peering mesh with N attachments, and unlike peering it **is transitive** — spoke A can reach spoke C through the hub (subject to TGW route tables).

Use TGW when:
- You have **more than a handful of VPCs** and the peering mesh becomes unmanageable.
- You need **centralized connectivity** — one place to attach on-prem (VPN/DX) and have all VPCs reach it.
- You want **segmentation** — TGW route tables let you isolate groups of VPCs (e.g. prod can't reach dev) while sharing common services.
- You need **cross-region** peering of hubs (TGW peering) for a global network.

Cost note: TGW charges per attachment-hour plus per-GB data processing, so for just two VPCs, plain peering is cheaper. The crossover is when the operational cost of the mesh outweighs TGW's per-GB fee.

### Q7. What are VPC endpoints, and what's the difference between gateway and interface endpoints?

VPC endpoints let resources in your VPC reach **AWS services privately** — traffic stays on the AWS network, never touching the internet or a NAT Gateway. Two kinds:

| | Gateway endpoint | Interface endpoint (PrivateLink) |
|---|---|---|
| Services | **S3 and DynamoDB only** | Most AWS services + your own/partner services |
| Mechanism | A **route table** entry to the service | An **ENI with a private IP** in your subnet |
| DNS | Uses public service DNS (via route) | Private DNS resolves the service name to the ENI |
| Cost | **Free** | Hourly per-AZ + per-GB data processing |
| Cross-region/on-prem | No | Reachable from peered VPCs / on-prem via DX/VPN |

The two big wins: **security** (private subnets can use S3/DynamoDB/KMS/SSM/etc. without any internet path — you can lock the SG/NACL fully closed to `0.0.0.0/0`) and **cost** (S3 traffic via a **gateway endpoint** is free and skips NAT Gateway data-processing charges). The common cost mistake is routing S3 traffic through NAT; add the free gateway endpoint instead. Gateway endpoints also support **endpoint policies** to restrict which buckets/tables can be reached.

### Q8. What is PrivateLink and when would you build an endpoint service?

**PrivateLink** is the technology behind **interface endpoints**: it exposes a service as an **ENI with a private IP inside your VPC**, so consumers reach it as if it were local, with traffic never leaving the AWS network. You use it two ways:

1. **Consuming** AWS or third-party (marketplace) services privately — an interface endpoint to, say, SQS, Secrets Manager, or a SaaS vendor's API.
2. **Providing** your own service: put your application behind a **Network Load Balancer**, create a **VPC endpoint service**, and other VPCs/accounts create interface endpoints to it. They reach your service by its private endpoint DNS name; you never expose it to the internet and there's **no VPC peering, no CIDR-overlap concern** (PrivateLink is one-directional and doesn't join the networks).

This is the standard pattern for **exposing an internal API across accounts/organizations securely** — e.g. a platform team offering a shared service to many product-team VPCs without meshing everyone's networks together. It's more secure and more scalable than peering for a *service* (as opposed to full network connectivity).

### Q9. What are VPC Flow Logs and what would you use them for?

**Flow Logs** capture **metadata about IP traffic** (not packet contents) going to and from network interfaces — you can enable them at the **VPC, subnet, or ENI** level. Each record includes source/dest IP and port, protocol, packet/byte counts, and the **action (ACCEPT/REJECT)**. Logs go to **CloudWatch Logs, S3, or Kinesis Data Firehose**.

Uses:
- **Troubleshooting connectivity** — see whether traffic is being *rejected* (and by which layer) versus never arriving. If you see REJECTs, a SG/NACL is blocking; if you see nothing, it's a routing/reachability problem upstream. This is the single most useful "why can't X talk to Y" tool.
- **Security analysis / forensics** — detect port scans, unexpected egress, traffic to known-bad IPs; feed into GuardDuty/SIEM.
- **Cost and traffic analysis** — find surprise cross-AZ or NAT traffic.

Caveat: Flow Logs are metadata only (no payload), and they don't capture certain traffic (e.g. to the Amazon DNS server, DHCP, instance-metadata). For payload inspection you'd need **VPC Traffic Mirroring**.

### Q10. How does DNS work inside a VPC?

Every VPC has a built-in **Route 53 Resolver** (the "Amazon-provided DNS" / AmazonProvidedDNS) at the VPC CIDR base **+2** address (e.g. `10.0.0.2` for `10.0.0.0/16`). Instances get their DNS from it via DHCP. Two VPC attributes govern behavior: **`enableDnsSupport`** (turns on the resolver) and **`enableDnsHostnames`** (assigns public DNS names to instances with public IPs) — both must be on for public DNS names and for many features (like interface-endpoint private DNS) to work.

- **Public names** resolve normally via the resolver.
- **Private hosted zones (Route 53)** let you define internal names (e.g. `db.internal.acme`) that resolve *only* inside associated VPCs.
- **Hybrid DNS:** **Resolver inbound endpoints** let on-prem resolve AWS private names; **outbound endpoints + forwarding rules** let VPC instances resolve on-prem names — the standard hybrid-cloud DNS bridge.

Common gotcha: **interface endpoint private DNS** and many services silently need `enableDnsHostnames`/`enableDnsSupport` on; if they're off, name resolution to the endpoint fails and you connect to the public endpoint (or not at all).

### Q11. What is an egress-only Internet Gateway, and how does IPv6 change things?

In **IPv6**, there's no NAT — every IPv6 address is globally routable, so the "private IP behind NAT" trick doesn't exist. To give IPv6 instances **outbound-only** internet access (the IPv6 equivalent of a NAT Gateway's role — allow them to reach out, block unsolicited inbound), you use an **egress-only Internet Gateway (EIGW)**. It's stateful and IPv6-only.

Key IPv6 points for a VPC:
- You add an **IPv6 CIDR** (Amazon-provided `/56`, subnets get `/64`) alongside IPv4 — VPCs are dual-stack; you can't run IPv6-only for everything yet (some services still need IPv4).
- A regular **IGW** handles IPv6 inbound+outbound (for public IPv6 resources); an **EIGW** handles IPv6 outbound-only for private ones.
- **Security groups/NACLs** need explicit IPv6 rules (`::/0`) — allowing `0.0.0.0/0` does *not* cover IPv6, a frequent security oversight where people lock down IPv4 but leave IPv6 wide open.

### Q12. Bastion host vs SSM Session Manager — how should you give admins access to private instances?

**Bastion host (jump box):** a hardened EC2 instance in a public subnet; admins SSH to it, then hop to private instances. The downside: it's an internet-facing SSH endpoint you must patch, harden, key-manage, and monitor — an attack surface and an operational burden.

**SSM Session Manager (preferred):** the SSM Agent (preinstalled on modern AMIs) makes an **outbound** connection to the Systems Manager service; admins open a shell through the AWS API/console. Advantages:
- **No inbound ports, no public IP, no bastion** — the instance can be fully private (works over interface endpoints with zero internet).
- **IAM-controlled** access (no SSH keys to distribute/rotate) and **full session logging** to CloudWatch/S3 for audit.
- Works for port forwarding and even RDP tunneling.

The modern answer is **SSM Session Manager**: it removes the bastion attack surface entirely and gives you IAM authЗ + audit logging for free. Reach for a bastion only in legacy setups or when a tool genuinely needs a raw SSH path and SSM's SSH-over-Session-Manager isn't an option.

### Q13. VPN vs Direct Connect — how do you connect on-prem to AWS?

Both connect your data center to your VPC(s); they trade off cost, setup time, and consistency.

| | Site-to-Site VPN | Direct Connect (DX) |
|---|---|---|
| Medium | IPsec tunnel over the **public internet** | **Dedicated private** physical circuit |
| Latency/throughput | Variable (internet-dependent) | Consistent, low latency, up to 100 Gbps |
| Encryption | Encrypted (IPsec) by default | Not encrypted by default (private, add a VPN/MACsec over it for encryption) |
| Setup time | Minutes | Weeks–months (physical provisioning) |
| Cost | Low, hourly + data | Port fee + provisioning; cheaper egress per GB at scale |
| Resilience | Two tunnels built-in | Single circuit = SPOF; need a second DX or VPN backup |

Use **VPN** for quick, encrypted connectivity, moderate/variable traffic, or as a **backup** to DX. Use **Direct Connect** when you need **consistent low latency and high, predictable throughput** (large data transfer, latency-sensitive hybrid apps) and lower per-GB egress at scale. The robust production pattern is **DX with a VPN failover**, and terminating both on a **Transit Gateway** so all VPCs share the on-prem link.

### Q14. Explain Elastic IPs and ENIs.

**Elastic Network Interface (ENI):** a virtual network card in a subnet. It carries a primary private IP (plus optional secondaries), a MAC address, security groups, and optionally a public/Elastic IP. Every instance has at least one (`eth0`); you can attach additional ENIs (e.g. a management interface on a separate subnet, or to move a "network identity" between instances for failover). An ENI is bound to **one AZ** (the subnet's).

**Elastic IP (EIP):** a **static, public IPv4 address** you own in your account and can remap between instances/ENIs. Because it's fixed, it survives instance replacement — useful when something external is hard-coded to your IP. Caveats: EIPs are a **scarce, billed resource** — AWS now charges for *all* public IPv4 (including in-use EIPs), and an **unattached EIP still bills** (the classic small surprise charge). Prefer a load balancer or DNS (Route 53) over handing out EIPs; reach for an EIP only when you genuinely need a fixed IP (e.g. an allowlist partner, a NAT/VPN endpoint).

### Q15. Design a secure multi-tier network for a typical web application.

A standard **3-tier, multi-AZ** VPC:

- **VPC** `10.0.0.0/16`, spanning **3 AZs** for resilience.
- **Public subnets** (one per AZ): hold the **Application Load Balancer** and **NAT Gateways** (one per AZ). Route table: `0.0.0.0/0 → IGW`.
- **Private app subnets** (one per AZ): the EC2/ECS/EKS compute in an Auto Scaling group. Route table: `0.0.0.0/0 → the AZ-local NAT Gateway`. No public IPs.
- **Private data subnets** (one per AZ): RDS (Multi-AZ), ElastiCache. **No** default route to internet at all.

**Security layering:**
- ALB SG allows 443 from the internet.
- App SG allows traffic **only from the ALB's SG** (reference the SG, not an IP range).
- DB SG allows the DB port **only from the App SG**.
- Add **VPC endpoints** (gateway for S3/DynamoDB, interface for SSM/Secrets Manager/etc.) so private tiers reach AWS services with no internet path.
- **SSM Session Manager** for admin access (no bastion).
- **Flow Logs** on for observability; **WAF** on the ALB.

The key principles: **least privilege via SG chaining** (each tier only accepts traffic from the tier above), **one NAT per AZ** for HA + cost, **no public IPs below the ALB**, and **endpoints instead of NAT** for AWS-service traffic.

### Q16. How do you approach network segmentation for compliance or blast-radius control?

Segmentation limits what a compromised or misbehaving component can reach. Layered options, from fine to coarse:

- **Security-group chaining** (finest): each tier's SG only accepts from the SG of the tier that's allowed to call it. This is your primary micro-segmentation tool.
- **Subnet + NACL boundaries:** separate subnets per tier/sensitivity, with NACLs as a coarse subnet-wide *deny* backstop (e.g. data subnet NACL denies all egress to the internet).
- **Separate VPCs / accounts:** the strongest boundary — put prod, dev, and PCI/regulated workloads in **separate accounts** (AWS Organizations) so IAM and network are hard-isolated, and connect only what's needed via **Transit Gateway route tables** (which can keep prod and dev VPCs from routing to each other) or **PrivateLink** (expose a single service, not the whole network).
- **Endpoint policies + SCPs:** restrict which S3 buckets/services a segment can reach, and use **Service Control Policies** to prevent whole categories of action org-wide.

The senior framing: **account-level isolation for hard trust boundaries, TGW/PrivateLink for controlled cross-segment access, SG chaining for intra-VPC least privilege.** Compliance regimes (PCI, HIPAA) usually push you toward separate accounts/VPCs plus Flow Logs for evidence.

### Q17. Walk through troubleshooting: an instance in a private subnet can't reach the internet. How do you debug it?

Work the packet's path **in order** — don't guess. For **outbound** internet from a *private* subnet, check:

1. **Route table:** does the subnet's route table have `0.0.0.0/0 → NAT Gateway`? Missing or pointing at an IGW (which a private instance with no public IP can't use) is the #1 cause.
2. **NAT Gateway health:** is the NAT Gateway in a **public** subnet whose route table points `0.0.0.0/0 → IGW`? A NAT in a private subnet, or one whose subnet lacks an IGW route, can't egress. Is it in the right AZ?
3. **Security group (outbound):** SGs are stateful, and the default allows all egress — but if it's been locked down, ensure outbound to the destination is allowed.
4. **NACL (both directions):** stateless — allow outbound to the destination *and* **inbound on ephemeral ports (1024–65535)** for the return traffic. The ephemeral-port omission is a classic NACL trap.
5. **DNS:** if it's "can't resolve" not "can't connect," check `enableDnsSupport`/`enableDnsHostnames` and the resolver.
6. **The target:** is it actually an AWS service that should go via a **VPC endpoint** instead? If so, the "fix" is adding the endpoint, not opening internet access.

Use **VPC Flow Logs** to see whether traffic is REJECTed (a SG/NACL is blocking) or absent (routing problem). This route → NAT → SG → NACL → DNS ordering is the disciplined approach interviewers look for.

### Q18. What are common connectivity pitfalls between VPCs or to on-prem, and how do you catch them?

The recurring ones:

- **Overlapping CIDRs:** two VPCs (or a VPC and on-prem) with the same/overlapping address ranges **cannot** be peered or connected via TGW/VPN — routing is ambiguous. Catch it at *design* time with an IP plan (IPAM); it's painful to fix after the fact (you must renumber).
- **Expecting transitive routing over peering:** A↔B and B↔C does **not** give A↔C. If you need transit, use **Transit Gateway**, and confirm the TGW **route tables** actually associate/propagate the spokes.
- **Route table gaps:** peering/TGW/VPN connections require routes on **both sides**. A one-sided route means traffic goes out but replies have no path back.
- **Security group / NACL asymmetry:** the destination VPC's SGs must allow the *source* CIDR (or, for peering, you can reference the peer SG same-region). NACL ephemeral-port rules bite here too.
- **DNS across the boundary:** cross-VPC/on-prem name resolution needs **Route 53 Resolver inbound/outbound endpoints** and forwarding rules; without them, connectivity works by IP but breaks by hostname.
- **Asymmetric routing with DX+VPN:** when both exist, route preference/BGP misconfig can black-hole return traffic.

Diagnostics: **VPC Reachability Analyzer** traces a path between two resources and tells you exactly which hop/control blocks it; **Flow Logs** show REJECT vs missing traffic. Lead with those instead of trial-and-error.

## DNS, CDN & Edge: Route 53, CloudFront, Global Accelerator

### Summary

**What this topic covers**

The edge of your architecture: how users find your application (**DNS via Route 53**), how content is served fast and close to them (**CDN via CloudFront**), and how you route traffic over AWS's global network for non-HTTP or ultra-low-latency needs (**Global Accelerator**). The 15 questions cover Route 53 as authoritative DNS (record types, the Alias-vs-CNAME distinction, and its seven routing policies), health checks and DNS failover, hybrid/private DNS, CloudFront's caching model (origins, cache behaviors, TTLs, invalidations, signed URLs, OAC), edge compute (Lambda@Edge vs CloudFront Functions), CloudFront for dynamic content and security (WAF, geo-restriction), the CloudFront-vs-Global-Accelerator decision, origin failover, cache-hit-ratio optimization, and TLS/ACM at the edge.

**Mental model**

Three layers between the user and your origin. **Route 53** answers "where is `acme.com`?" — it's the authoritative DNS that turns a name into an address (or an Alias to an AWS resource) and can make that answer *smart* (latency-based, weighted, failover). **CloudFront** is the **content delivery** layer: a global fleet of edge locations that cache your responses close to users and terminate TLS at the edge — it's HTTP(S)-only and cache-oriented. **Global Accelerator** is the **network** layer: static anycast IPs that pull user traffic onto the AWS backbone at the nearest edge and route it to the healthiest regional endpoint — protocol-agnostic (TCP/UDP), no caching. The mental sort: *DNS routing decisions* live in Route 53; *cache and HTTP content* live in CloudFront; *raw global network acceleration for any protocol* lives in Global Accelerator. Most web stacks use Route 53 + CloudFront; Global Accelerator enters for gaming, IoT, VoIP, or when you need fixed IPs.

**Key terms**

- **Route 53** — AWS's authoritative, highly-available DNS service (100% SLA) plus domain registration and health checks.
- **Alias record** — Route 53-specific record pointing a name at an AWS resource (ALB, CloudFront, S3); works at the **zone apex**, free, auto-tracks the target's IP.
- **CNAME** — standard DNS alias to another *name*; **cannot** be used at the zone apex.
- **Routing policy** — how Route 53 chooses an answer: simple, weighted, latency, failover, geolocation, geoproximity, multivalue.
- **Health check** — Route 53 probe of an endpoint; drives DNS failover by pulling unhealthy records from answers.
- **CloudFront** — global CDN caching content at **edge locations**, terminating TLS, fronting S3/ALB/custom origins.
- **OAC (Origin Access Control)** — restricts an S3 origin so it's reachable **only** through CloudFront (successor to OAI).
- **Cache behavior** — per-path-pattern config (TTL, allowed methods, which headers/cookies/query strings key the cache).
- **Invalidation** — force-expire cached objects before their TTL (first 1,000 paths/month free, then billed).
- **Signed URL / signed cookie** — grant time-limited access to private CloudFront content.
- **Lambda@Edge / CloudFront Functions** — run code at the edge; heavier (regional) vs lightweight (viewer-only, sub-ms).
- **Global Accelerator** — two static **anycast IPs**; routes TCP/UDP over the AWS backbone to the healthiest endpoint.

**Why interviewers ask this**

The edge is where **performance, availability, and cost** visibly meet, so it's rich for scenario questions. Interviewers check whether you know the **Alias-vs-CNAME-at-apex** rule (a near-universal gotcha), whether you can pick the right **routing policy** for a scenario (blue/green → weighted; global low latency → latency; DR → failover; compliance → geolocation), and whether you understand what CloudFront actually *does* (cache + TLS termination + edge security, not just "make it faster"). The senior signals: reasoning about **cache-hit ratio** (the lever for both performance and origin cost), knowing when **Global Accelerator** beats CloudFront (non-HTTP, fixed IPs), and designing **origin failover + health-checked DNS failover** for real resilience. Junior answers stop at "Route 53 is DNS, CloudFront is a CDN"; senior answers reason about invalidations, TTL tuning, OAC, and TLS/ACM regions.

**Common confusions**

- "CNAME works at the apex" — it does **not**. Use a Route 53 **Alias** for `acme.com` (apex); CNAME only for subdomains.
- "CloudFront and Global Accelerator are the same" — CloudFront **caches HTTP** at the edge; Global Accelerator **routes any TCP/UDP** over the backbone with **static IPs** and doesn't cache.
- "CloudFront is only for static content" — it accelerates **dynamic** content too (TLS termination at edge + backbone path to origin), even with caching disabled.
- "Invalidations are how you deploy new content" — prefer **versioned object names** (cache-busting); invalidations are billed beyond 1,000/month and are slower.
- "Route 53 latency routing uses the user's geography" — it uses **measured network latency** to regions, not physical distance (that's geoproximity/geolocation).
- "The CloudFront cert can live in any region" — a custom-domain ACM cert for CloudFront **must be in us-east-1**.

**What follows from this topic**

The edge sits on top of everything: CloudFront origins are the **Compute/Load Balancing** (ALB) and **Object Storage (S3)** layers; Route 53 private hosted zones tie back to **VPC** DNS; **WAF** and geo-restriction connect to **Security**; and TLS/ACM links to certificate management. Health-checked DNS failover and origin failover are core to the **reliability** pillar. This is where a well-architected app becomes fast and resilient globally.

### Q1. What is Route 53 and why is it more than "just DNS"?

**Route 53** is AWS's authoritative DNS service — it hosts your zones and answers queries for your domains — but it bundles three things: (1) **domain registration** (buy/manage domains), (2) **authoritative DNS hosting** with a **100% availability SLA** (the only AWS service with one, achieved via anycast across a global fleet of DNS servers), and (3) **health checking + traffic management** through seven routing policies.

What makes it "more than DNS" is that the *answer* can be **dynamic and health-aware**: instead of always returning the same IP, Route 53 can return the lowest-latency region for this user, split traffic 90/10 for a canary, fail over to a DR site when a health check trips, or restrict answers by geography for compliance. It also integrates natively with AWS via **Alias records** (point at an ALB/CloudFront/S3 with no IP to manage) and supports **private hosted zones** for internal DNS inside VPCs. So it's simultaneously a registrar, a globally-resilient resolver, and a traffic-routing engine.

### Q2. Explain the main DNS record types and the Alias-vs-CNAME distinction.

**Core record types:**
- **A** — name → IPv4 address.
- **AAAA** — name → IPv6 address.
- **CNAME** — name → another *name* (alias to a hostname). Resolver then re-resolves the target.
- **MX** — mail servers; **TXT** — arbitrary text (SPF, domain verification); **NS/SOA** — zone delegation/authority.

**Alias (Route 53-specific):** points a name directly at an **AWS resource** (CloudFront distribution, ALB, S3 website, another Route 53 record) and Route 53 resolves the target's current IPs for you.

The critical distinction, and a favorite interview gotcha — **at the zone apex** (`acme.com`, no subdomain), you **cannot use a CNAME** (DNS forbids a CNAME coexisting with the apex's required SOA/NS records). So to point `acme.com` at a CloudFront distribution or ALB, you **must use an Alias** record. Aliases also (a) are **free** (no charge per query, unlike some), (b) auto-track the target's changing IPs, and (c) can point at AWS resources a CNAME can too but at the apex. Use **CNAME** for subdomains (`www.acme.com → …`) when you must, but Alias is preferred for AWS targets everywhere.

### Q3. Walk through Route 53's routing policies and when to use each.

Seven policies, each for a different traffic goal:

| Policy | What it does | Use for |
|---|---|---|
| **Simple** | One record, one (set of) answer(s) | Basic single-resource mapping |
| **Weighted** | Split traffic by assigned weights (e.g. 90/10) | Canary / blue-green / A-B testing |
| **Latency** | Return the region with lowest *measured network latency* to the user | Global apps, serve from nearest region |
| **Failover** | Primary → secondary based on a health check | Active-passive DR |
| **Geolocation** | Answer by the user's *continent/country* | Compliance, localization, geo-licensing |
| **Geoproximity** | Route by geographic distance, with a *bias* to expand/shrink a region's reach | Fine-grained geographic traffic shaping |
| **Multivalue answer** | Return up to 8 healthy records at random | Simple client-side load spreading with health checks |

Key nuances: **latency ≠ geolocation** — latency uses AWS's measured network latency to regions (usually but not always the nearest), while geolocation uses the *user's* location and is for compliance/content rules. **Multivalue** is not a substitute for a real load balancer — it's health-checked DNS round-robin. **Geoproximity** (needs Route 53 Traffic Flow) adds a bias knob geolocation lacks. For a canary rollout, reach for **weighted**; for "serve EU users from Frankfurt for GDPR," reach for **geolocation**; for "nearest/fastest," reach for **latency**.

### Q4. How do Route 53 health checks and DNS failover work?

**Health checks** are Route 53 probes (from a global set of checkers) against an endpoint — an IP/domain on a port/path (HTTP/HTTPS/TCP), a **CloudWatch alarm** state, or a **calculated** check combining child checks. An endpoint is deemed unhealthy after a configurable number of failed probes.

**DNS failover** ties a health check to a record: if the primary's check is unhealthy, Route 53 **stops returning that record** and returns the secondary instead (failover policy), or drops it from a multivalue/weighted answer set. So traffic reroutes automatically at the DNS layer.

The gotcha every senior candidate names: **DNS failover is bounded by TTL and resolver caching.** Clients (and intermediate resolvers) cache the old answer until the record's **TTL** expires, so failover isn't instant — set a **low TTL** (e.g. 60s) on records you intend to fail over, accepting slightly more query volume/cost. Also, health checks on a **private** endpoint need a CloudWatch-alarm-based check (the public checkers can't reach private IPs). Failover gives you **regional/DR** resilience at the DNS layer; for sub-second in-region failover you rely on load balancers instead.

### Q5. How does Route 53 support hybrid and private DNS?

Two mechanisms:

**Private hosted zones (PHZ):** a Route 53 zone **associated with one or more VPCs** that resolves names **only inside** those VPCs. You define internal records (`db.internal.acme → 10.0.5.20`) that aren't visible on the public internet — the standard way to give internal services stable names. A name can exist in both a public and a private zone (**split-horizon DNS**), returning different answers inside vs outside the VPC.

**Route 53 Resolver endpoints** bridge to on-prem:
- **Inbound endpoint** — an ENI in your VPC that **on-prem** DNS can forward queries to, so your data center can resolve AWS private names.
- **Outbound endpoint + forwarding rules** — forward queries for specified domains (e.g. `corp.acme`) from your VPC **to on-prem** DNS servers, so EC2 can resolve internal on-prem names.

Together these give **hybrid DNS**: seamless name resolution in both directions across the AWS↔on-prem boundary, which is essential once you're running Direct Connect/VPN hybrid architectures. This connects directly to the VPC DNS mechanics (the `.2` resolver).

### Q6. What is CloudFront and how does its caching model work?

**CloudFront** is AWS's global **CDN**: a fleet of **edge locations** (and regional edge caches behind them) that cache your content close to users and terminate TLS at the edge. A request flow: user → nearest edge → (cache hit? serve it : fetch from **origin**, cache per TTL, serve). This cuts latency (short RTT to the edge), offloads the origin (fewer origin requests), and absorbs traffic spikes.

**Origins** can be an **S3 bucket** (static assets), an **ALB/EC2** (dynamic apps), or **any custom HTTP origin** (even non-AWS). You configure **cache behaviors** per **path pattern** (e.g. `/images/*` cached long, `/api/*` not cached), each controlling: allowed HTTP methods, which **headers/cookies/query strings** are part of the **cache key**, and the **TTL** (min/default/max, or honoring the origin's `Cache-Control`).

Caching model essentials:
- **TTL** governs how long an object stays fresh at the edge before revalidation/refetch.
- The **cache key** determines hit ratio — including too many varying headers/cookies/query strings fragments the cache and tanks the hit rate (Q13).
- **Invalidation** force-expires objects before TTL (Q9).

It's HTTP(S)-only and cache-centric — that's the line that separates it from Global Accelerator (Q11).

### Q7. What is Origin Access Control (OAC) and why lock down an S3 origin?

By default, an S3 bucket used as a CloudFront origin could still be reachable **directly** via its S3 URL — letting users bypass CloudFront (skipping your WAF, signed-URL checks, caching, and logging) and hit S3 directly. **OAC (Origin Access Control)** fixes this: it makes CloudFront sign requests to S3 with SigV4, and you set the **bucket policy to allow access only from that CloudFront distribution** (and block all other principals). Result: the bucket is private, and the *only* path to its objects is through CloudFront.

OAC is the **successor to OAI (Origin Access Identity)** — OAC is newer, supports **SSE-KMS** encrypted objects, all regions, and dynamic requests; AWS now recommends OAC for all new distributions. The pattern matters because it's how you (a) keep an S3 bucket fully private while still serving it globally, and (b) **enforce** that security/signed-URL/WAF controls at the edge can't be sidestepped. A classic anti-pattern is a "private" site whose S3 bucket is actually world-readable because OAC/OAI was never configured.

### Q8. How do TTL and cache invalidation work, and what's the better pattern?

**TTL** controls freshness at the edge. You set **min/default/max TTL** on a cache behavior; if the origin sends `Cache-Control`/`Expires`, CloudFront honors it within those bounds. High TTL = better hit ratio and less origin load, but staler content; low TTL = fresher but more origin traffic.

**Invalidation** force-expires cached objects **before** their TTL — you submit paths (`/index.html`, `/images/*`) and CloudFront purges them from all edges. But: the first **1,000 invalidation paths per month are free**, then you're **billed per path**, and invalidations take time to propagate.

The **better pattern for deploys** is **versioned / fingerprinted object names** (cache-busting): serve `app.a1b2c3.js` instead of `app.js`, and reference the new name in your HTML. New deploy = new filename = automatically a cache miss that fetches fresh content, while old versions age out naturally — **no invalidation needed**, and you can set very long TTLs on the immutable assets. Reserve invalidations for the small set of unversioned files (like `index.html`) or emergency purges. Relying on invalidations for every deploy is both costly and slow.

### Q9. How do signed URLs and signed cookies restrict access to CloudFront content?

Both grant **time-limited, controlled access** to **private** CloudFront content (paid media, user documents, premium downloads) so it isn't freely fetchable:

- **Signed URL** — a single URL with an appended signature and policy (expiry time, optional IP restriction). Grants access to **one specific file**. Use for individual downloads (a software installer, one video).
- **Signed cookie** — a cookie carrying the same kind of signed policy. Grants access to **multiple files matching a pattern** without changing each URL. Use when you're protecting a whole library (e.g. all segments of an HLS stream, or a set of course assets) and don't want to sign every URL.

You generate them with a **CloudFront key pair / key group** (the private key stays with your app/backend, which decides who gets a signature). The policy can constrain **expiry**, **path**, and **source IP**. Pair this with **OAC** (Q7) so the origin can't be reached directly — otherwise the signing is pointless because users could bypass CloudFront. This is the standard "authenticated access to static media at CDN scale" pattern.

### Q10. Lambda@Edge vs CloudFront Functions — when do you use each?

Both run code **at the edge** to customize requests/responses, but they're very different weight classes:

| | CloudFront Functions | Lambda@Edge |
|---|---|---|
| Runtime | Lightweight JS, edge-location (closest to user) | Node.js/Python, regional edge cache |
| Latency/scale | **Sub-millisecond**, extreme scale | Milliseconds, heavier |
| Triggers | **Viewer** request/response only | Viewer *and* **origin** request/response |
| Capabilities | Header/URL manipulation, redirects, auth-token checks | Full compute: network calls, larger payloads, bundles |
| Limits | ~1 ms CPU, small memory, no network | Up to several seconds, network access, bigger code |
| Cost | Much cheaper | More expensive |

**Use CloudFront Functions** for high-volume, ultra-light viewer-side logic: header rewrites, URL normalization/redirects, simple request auth (JWT/HMAC header checks), A/B cookie assignment. **Use Lambda@Edge** when you need real compute or an **origin-side** trigger: calling an external service, dynamic origin selection, fetching from a DB, complex request/response transformation, or SSR-ish edge rendering. Rule of thumb: reach for **CloudFront Functions first** (cheaper, faster, runs at every edge); escalate to **Lambda@Edge** only when you need network access, origin triggers, or heavier logic.

### Q11. Global Accelerator vs CloudFront — how do you choose?

Both use AWS's global edge network and improve performance, but they solve different problems:

| | CloudFront | Global Accelerator |
|---|---|---|
| Layer | HTTP(S) CDN — **caches content** | Network — **routes traffic**, no caching |
| Protocols | HTTP/HTTPS only | **Any TCP/UDP** |
| IPs | Distribution domain (DNS) | **Two static anycast IPs** |
| Best for | Web content, static + dynamic HTTP | Gaming, VoIP, IoT, non-HTTP, fixed-IP needs |
| Mechanism | Cache at edge + backbone to origin | Ingress at nearest edge, backbone to healthiest regional endpoint |
| Failover | Origin failover / groups | Fast **regional** failover via health checks |

Choose **CloudFront** for anything HTTP that benefits from **caching** — websites, APIs, media, static assets (the vast majority of web workloads). Choose **Global Accelerator** when you need: a **non-HTTP protocol** (UDP game traffic, MQTT, SIP), **static IP addresses** (allowlisting by partners/firewalls, or you can't hand out changing CDN domains), or **fast IP-level regional failover** for a stateful backend. Key line: **CloudFront caches; Global Accelerator does not** — Global Accelerator just gets packets onto the AWS backbone at the nearest edge and to the best-performing healthy endpoint. They can be **combined** (Global Accelerator in front of an HTTP setup for static IPs), but the default web answer is CloudFront.

### Q12. How does CloudFront handle dynamic content and edge security?

**Dynamic content:** CloudFront isn't only a static cache. For dynamic/personalized responses you can set a cache behavior to **not cache** (or cache very briefly) while still routing the request over the **AWS backbone** from the edge to your origin — which is faster and more reliable than the open internet, and lets you **terminate TLS at the edge** (shorter handshake RTT). So even an uncacheable API benefits from CloudFront. You control caching granularly by **path pattern** and by which headers/cookies/query strings key the cache.

**Edge security** stacked at CloudFront:
- **AWS WAF** attaches to the distribution to filter SQLi/XSS, bad bots, and apply **rate limiting** — blocking attacks at the edge before they reach the origin.
- **Geo-restriction** — allow/deny by country at the CloudFront layer (licensing/compliance).
- **OAC** (Q7) so the origin can't be bypassed; **signed URLs/cookies** (Q9) for private content.
- **TLS/ACM** at the edge (Q14) with modern cipher policies; plus **field-level encryption** for sensitive form fields.
- **Origin shielding + Shield/Shield Advanced** for DDoS absorption.

So CloudFront doubles as a **security perimeter** (WAF + geo + DDoS + TLS) — a point juniors miss when they call it "just a cache."

### Q13. How do you optimize CloudFront's cache hit ratio?

Cache hit ratio drives both **performance** (more edge hits = lower latency) and **cost** (fewer origin fetches, less origin load and data transfer). Levers:

- **Minimize the cache key.** Only include headers, cookies, and query strings that genuinely change the response. Forwarding *all* headers/cookies (or high-cardinality query params) fragments the cache into near-unique entries and destroys the hit rate — the #1 cause of a bad ratio. Use **cache policies** to forward only what matters.
- **Raise TTLs** on content that changes rarely (static assets, images) and use **cache-busting versioned filenames** so you can set very long TTLs safely (Q8).
- **Normalize requests** with a CloudFront Function (lowercase, strip tracking query params, canonicalize) before they hit the cache.
- **Separate cache behaviors** by path so `/static/*` can cache aggressively while `/api/*` stays uncached — don't let uncacheable paths pollute policy for cacheable ones.
- **Enable compression** (Gzip/Brotli) — cached compressed objects also reduce transfer.
- **Use Origin Shield** to add a centralizing caching layer that further collapses origin requests across edges.
- **Monitor** the CloudFront cache-statistics reports / CloudWatch to find which paths miss and why.

The senior instinct: a low hit ratio is almost always an **over-broad cache key**, not a TTL problem — fix what varies the cache before touching TTLs.

### Q14. How do TLS and ACM certificates work at the edge?

CloudFront **terminates TLS at the edge**, so the user's HTTPS handshake completes at the nearest edge location (low RTT), and CloudFront then talks to your origin over a separate (also-encryptable) connection. To serve HTTPS on your **custom domain** (`www.acme.com`) you attach an **ACM (AWS Certificate Manager)** certificate.

The rule everyone must remember: **for CloudFront, the ACM certificate must be in `us-east-1`** (N. Virginia), regardless of where your origin lives — because CloudFront is a global service managed from that region. (By contrast, an **ALB**'s cert must be in the ALB's *own* region.) ACM certs are **free** and **auto-renew** (for DNS-validated certs), removing manual rotation.

Other edge-TLS points:
- Choose a **security policy** (minimum TLS version / cipher suite) — enforce TLS 1.2+.
- **SNI** is the default (no extra cost); a dedicated IP for legacy non-SNI clients costs extra and is rarely needed now.
- You can also secure the **origin leg** (CloudFront → origin over HTTPS) and enforce it.

The interview trap is provisioning the cert in the wrong region and wondering why CloudFront won't accept it — it's **always us-east-1** for CloudFront.

### Q15. Design a resilient, fast global delivery setup with origin and DNS failover.

Layer the edge for both **speed** and **resilience**:

**DNS (Route 53):**
- Apex `acme.com` → **Alias** to the CloudFront distribution (CNAME can't sit at the apex).
- For multi-region active-passive, use a **failover** routing policy with **health checks** (low TTL ~60s) so DNS reroutes to a standby region if the primary's health check trips. For active-active global, use **latency-based** routing across regional endpoints.

**CDN (CloudFront):**
- One distribution fronting the app; **cache behaviors** per path (`/static/*` long TTL with versioned filenames; `/api/*` uncached but still backbone-accelerated with TLS-at-edge).
- **Origin failover (origin groups):** configure a **primary and secondary origin**; on defined failure responses (5xx/timeouts), CloudFront automatically retries the secondary — e.g. primary ALB in `us-east-1`, secondary ALB in `us-west-2`, or an S3 static fallback. This gives resilience *below* the DNS layer, reacting in real time rather than waiting on TTL.
- **OAC** locking any S3 origin private; **WAF** + **geo-restriction** for security; **ACM cert in us-east-1**.

**Resilience summary:** two independent failover layers — **CloudFront origin failover** (fast, per-request, region-to-region at the CDN) and **Route 53 health-checked DNS failover** (whole-endpoint, DR-grade). Add **Global Accelerator** in front only if you also need static IPs or non-HTTP protocols. The result is content served fast from the nearest edge, private and WAF-protected, with automatic failover at both the request and DNS levels.
## Load Balancing: ELB

### Summary

**What this topic covers**

Elastic Load Balancing (ELB) is how AWS spreads incoming traffic across a fleet of targets, does health checking, and terminates TLS at the edge of your compute tier. This topic has 15 questions covering the three modern load balancers — **Application Load Balancer (ALB)**, **Network Load Balancer (NLB)**, and **Gateway Load Balancer (GWLB)** — plus the legacy **Classic Load Balancer (CLB)** you'll still meet in old accounts. The through-line is the OSI layer each one operates at: ALB is a **layer-7 (HTTP/HTTPS)** proxy that understands hosts, paths, headers and cookies; NLB is a **layer-4 (TCP/UDP/TLS)** pass-through that moves packets at ultra-low latency; GWLB is a **layer-3 (IP)** bump-in-the-wire for inserting third-party firewalls and IDS/IPS appliances. Around that spine sit target groups, listeners and rules, health checks, cross-zone load balancing, connection draining, SSL/TLS termination with SNI and ACM, and the security-group and health-check misconfigurations that generate most real-world "why are all my targets unhealthy" incidents.

**Mental model**

A load balancer is two things at once: a **stable front door** (a DNS name, and for NLB optionally a fixed IP) that clients hit, and a **health-aware fan-out** that only sends traffic to targets currently passing checks. Think of the pipeline as *listener → rules → target group → target*. The **listener** binds a port/protocol; its **rules** (ALB) decide which **target group** gets the request based on host/path/header; the **target group** holds the registered targets and runs the health check that decides who is "in". Everything else is a variation on that pipeline. The layer you operate at determines what you can route on: at layer 7 the LB reads the HTTP request, so it can path-route, rewrite, redirect, authenticate, and inject headers — at the cost of terminating and re-originating the connection. At layer 4 it barely looks at the packet, so it's faster and protocol-agnostic but blind to HTTP semantics. Pick the lowest layer that still gives you the routing feature you need.

**Key terms**

- **ALB (Application Load Balancer)** — layer-7 HTTP/HTTPS/gRPC load balancer; host/path routing, redirects, auth, WebSocket, HTTP/2.
- **NLB (Network Load Balancer)** — layer-4 TCP/UDP/TLS load balancer; static IP/EIP, ultra-low latency, millions of connections/sec, source-IP preservation.
- **GWLB (Gateway Load Balancer)** — layer-3 load balancer using GENEVE (port 6081) to transparently insert third-party security appliances.
- **CLB (Classic Load Balancer)** — legacy previous-generation LB (layer 4 + basic layer 7); avoid for new work.
- **Listener** — a process that checks for connection requests on a configured protocol + port.
- **Target group** — a set of registered targets (instance / IP / Lambda) plus a health-check definition; routing destination.
- **Health check** — periodic probe (HTTP path, TCP handshake) that marks each target healthy/unhealthy.
- **Cross-zone load balancing** — evenly distributes across targets in *all* AZs, not just the AZ that received the request.
- **Deregistration delay (connection draining)** — grace period letting in-flight requests finish before a target leaves rotation.
- **SNI (Server Name Indication)** — TLS extension letting one ALB/NLB listener serve many certificates for many hostnames.
- **ACM (AWS Certificate Manager)** — issues/renews free public TLS certs bound to ELB listeners.
- **Target type** — `instance` (routes to EC2 by ID), `ip` (routes to any reachable IP incl. on-prem/ECS), or `lambda` (ALB only).

**Why interviewers ask this**

Load balancing is the single most common component in any AWS architecture diagram, so it's a fast way to separate people who've *operated* systems from people who've only read about them. The junior answer is "ALB is layer 7, NLB is layer 4" and stops. The senior answer picks the right LB for a *stated* scenario (gRPC? WebSocket? static IP for a firewall allowlist? preserve client source IP?), knows why targets go unhealthy (security-group chain, wrong health-check path returning 302/401, the target's own app not listening), and understands the cost and latency tradeoffs — including the notorious NLB cross-zone data-transfer charge. Interviewers also probe TLS termination (where does the cert live, what does the backend see) and the security-group model, because misconfiguring those is how production outages actually happen.

**Common confusions**

- "ALB gives you a static IP" — it does **not**; ALB's IPs float, you must use its DNS name (or front it with an NLB / Global Accelerator for a static IP).
- "Cross-zone load balancing is always on" — it's **on by default for ALB, off by default for NLB/GWLB**, and enabling it on NLB adds inter-AZ data-transfer cost.
- "The load balancer being healthy means my targets are reachable" — health checks fail silently if the target's security group doesn't allow the LB's traffic, or the health path returns a non-2xx.
- "NLB does TLS, so it's layer 7" — NLB can *terminate* TLS but still routes at layer 4; it never reads the HTTP request.
- "Sticky sessions live on the instance" — ALB stickiness is cookie-based at the LB (`AWSALB` / app cookie), not on the backend.
- "GWLB is just another way to load-balance web traffic" — it exists specifically to insert inline security appliances; it's not a general web LB.

**What follows from this topic**

Load balancers sit in front of nearly everything else in this primer. They front **Auto Scaling groups** and **ECS/EKS** services (compute), depend on **VPC** subnets, security groups and NACLs (networking), and their TLS story ties into **ACM** and **Route 53** (DNS + health-based failover). The health-check discipline here reappears in **reliability** and **Well-Architected** design, and the layer-4-vs-7 decision recurs whenever you place **API Gateway**, **CloudFront**, or **Global Accelerator** in a request path. Get the listener → target-group → target pipeline solid and the rest of the edge stack is variations on it.

### Q1. What are the different types of Elastic Load Balancer and when do you use each?

Four types, three of them current:

| LB | Layer | Protocols | Use it for |
|---|---|---|---|
| **ALB** | 7 | HTTP, HTTPS, gRPC | Web apps, microservices, host/path routing, auth, WebSocket |
| **NLB** | 4 | TCP, UDP, TLS | Ultra-low latency, static IP, millions of connections, non-HTTP protocols |
| **GWLB** | 3 | IP (GENEVE) | Inserting third-party firewalls / IDS/IPS transparently |
| **CLB** | 4 + basic 7 | HTTP, HTTPS, TCP | **Legacy only** — don't use for new work |

Default to **ALB** for anything HTTP. Reach for **NLB** when you need a static/elastic IP, source-IP preservation, extreme throughput, or a non-HTTP protocol. Use **GWLB** only when you're deploying vendor security appliances. CLB is previous-generation — migrate off it.

### Q2. ALB vs NLB — walk me through the differences.

The core split is **layer 7 vs layer 4**:

| | ALB | NLB |
|---|---|---|
| OSI layer | 7 (application) | 4 (transport) |
| Protocols | HTTP/HTTPS/gRPC | TCP/UDP/TLS |
| Routing on | host, path, header, query, method | port only |
| IP address | dynamic (DNS name only) | static per-AZ, or bring your own EIP |
| Latency | higher (full proxy) | ultra-low (~microseconds) |
| Source IP | replaced (X-Forwarded-For) | **preserved** (with instance targets) |
| Throughput | high | millions of connections/sec |
| Target types | instance, IP, **Lambda** | instance, IP, ALB |
| TLS | terminates, reads HTTP | passthrough or terminate |

**Pick ALB** when you need content-based routing, redirects, authentication, or WebSocket/gRPC. **Pick NLB** when you need a fixed IP for a firewall allowlist, want the client's real source IP at the instance, run a non-HTTP protocol, or need raw speed.

### Q3. What routing features does an ALB give you?

ALB reads the HTTP request, so it can route and manipulate on layer-7 content:

- **Host-based routing** — `api.acme.com` → one target group, `app.acme.com` → another, on one listener.
- **Path-based routing** — `/api/*` → service A, `/images/*` → service B.
- **Header / query-string / HTTP-method / source-IP conditions** — combine up to several conditions per rule.
- **Listener rules** — ordered by priority; first match wins, with a default action fallthrough.
- **Redirects** — e.g. HTTP→HTTPS or path rewrites, returned by the LB with no backend hop.
- **Fixed responses** — return a canned 503 / maintenance page without a target.
- **Authentication** — offload OIDC / Amazon Cognito auth at the listener before the request reaches your app.
- **Protocol support** — WebSocket, HTTP/2, and gRPC (with gRPC health checks and status-code mapping).

That routing power is exactly what NLB lacks — it can only send a port to a target group.

### Q4. What does NLB give you that ALB doesn't?

- **Static IP per AZ** — one stable IP per subnet, or **bring your own Elastic IP** (BYOIP). Great for firewall allowlists and clients that hardcode IPs.
- **Ultra-low latency** — it's a flow router, not a proxy; adds microseconds, not milliseconds.
- **Massive scale** — handles millions of connections per second, scales without pre-warming.
- **Source IP preservation** — with `instance` targets the backend sees the client's real IP (no X-Forwarded-For needed).
- **TCP/UDP** — supports non-HTTP protocols (DNS, syslog, game servers, MQTT).
- **TLS termination or passthrough** — terminate TLS at the NLB with an ACM cert, or pass encrypted TCP straight through to the backend.

The trade: no content-based routing, no header manipulation, no auth offload — it's blind to HTTP.

### Q5. What are target types, and when would you use `ip` or `lambda` instead of `instance`?

A target group registers targets by one of three types:

- **`instance`** — routes to EC2 instances by instance ID. Simplest; preserves source IP on NLB. Traffic follows the instance's primary IP.
- **`ip`** — routes to any IP reachable from the VPC: ECS tasks, pods, containers with their own ENI, on-prem hosts over VPN/Direct Connect, or instances in a peered VPC. Required for `awsvpc`-mode ECS and for cross-VPC/on-prem targets.
- **`lambda`** — **ALB only**; the ALB invokes a Lambda function per request, passing an event and mapping the function's response to HTTP. Good for lightweight serverless endpoints behind the same hostname as your containers.

Rule of thumb: `instance` for plain EC2, `ip` for containers/on-prem, `lambda` for serverless behind ALB.

### Q6. How do health checks work, and why do targets go unhealthy?

Each target group defines a health check — protocol, port, path (HTTP), interval, timeout, and healthy/unhealthy thresholds. The LB probes each target; a target must pass *N* consecutive checks to enter rotation and fail *M* to leave it. Only **healthy** targets receive traffic.

Common reasons targets flap to unhealthy:

- **Security-group chain broken** — the target's SG doesn't allow the LB (for ALB, allow the LB's SG; for NLB, allow the health-check subnet CIDRs).
- **Wrong health-check path** — path returns 301/302/401/403 instead of 200; you must configure the expected success codes or point at a real `/healthz`.
- **App not listening** — the process isn't up on the health-check port, or binds `127.0.0.1` instead of `0.0.0.0`.
- **Timeout too aggressive** — a slow endpoint exceeds the timeout under load and gets marked down.
- **NACL** — a stateless NACL blocks the ephemeral return traffic.

A healthy LB with all-unhealthy targets returns **503**.

### Q7. Explain cross-zone load balancing and its cost implications.

Without cross-zone, each LB node distributes only to targets **in its own AZ**. If AZ-a has 2 targets and AZ-b has 8, and traffic arrives evenly across the two zone nodes, the AZ-a targets each get far more load — imbalance. **Cross-zone** load balancing lets every LB node distribute to targets in **all** AZs, so load is even regardless of per-AZ target counts.

Defaults and cost:

- **ALB** — cross-zone is **always on**, free (inter-AZ traffic is not charged for ALB).
- **NLB / GWLB** — cross-zone is **off by default**; enabling it balances better but **charges inter-AZ data transfer**, which can be significant at high volume.

So on NLB it's an explicit cost/evenness tradeoff. A common fix instead of enabling it: keep target counts balanced across AZs.

### Q8. What is connection draining / deregistration delay?

When you deregister a target (scale-in, deploy, patch), you don't want to drop its in-flight requests. **Deregistration delay** (the ALB/NLB term; "connection draining" on CLB) puts the target into `draining` state: it stops receiving *new* connections but existing ones keep flowing until they complete or the timer expires (default **300s**, range 0–3600s).

Tuning: set it to just above your longest normal request. Too short and you cut off long uploads or streaming responses; too long and deploys/scale-in crawl. For WebSocket or long-poll workloads, either raise it or handle graceful shutdown in the app so connections close cleanly.

### Q9. How does SSL/TLS termination work on ELB, and where does SNI fit?

**Termination** means the LB holds the certificate and private key, decrypts TLS at the edge, and forwards plaintext (or re-encrypts) to the backend. Benefits: offloads crypto from your instances, centralizes cert management, and lets ALB read the HTTP request to route.

- **Certs** come from **ACM** (free, auto-renewing public certs) bound to the HTTPS/TLS listener.
- **SNI** lets a single listener present **multiple certificates**: the client sends the target hostname in the TLS handshake and the LB selects the matching cert. This is how one ALB serves `app.acme.com`, `api.acme.com`, and `admin.acme.com` each with its own cert.
- **Backend encryption** — for end-to-end TLS, use HTTPS between ALB and target (re-encrypt), or on NLB use **TLS passthrough** so the backend terminates.

Termination vs passthrough is the key decision: terminate for routing + offload, pass through when the backend must own the TLS (compliance, mTLS to the app).

### Q10. What is a Gateway Load Balancer and what problem does it solve?

**GWLB** exists to insert **third-party network security appliances** (firewalls, IDS/IPS, deep packet inspection) transparently into your traffic path — without you re-architecting routing for each vendor. It operates at **layer 3**, load-balancing across a fleet of appliances while keeping flow stickiness so a connection always hits the same appliance.

Mechanics: GWLB uses the **GENEVE protocol on port 6081** to encapsulate original packets and hand them to appliances via a **GWLB endpoint (GWLBE)** in your VPC. You steer traffic to the GWLBE with route tables, the appliances inspect/filter, and clean traffic continues. It's a "bump in the wire" — the appliances see the original packets intact. You'd never use GWLB for ordinary web load balancing; it's specifically the vendor-appliance insertion pattern.

### Q11. A client needs a fixed IP to allowlist in their on-prem firewall, but you also want HTTP path routing. How do you design it?

ALB gives path routing but has **floating IPs**; NLB gives a static IP but no layer-7 routing. Resolve the tension by stacking them:

- **NLB in front of ALB** — put an **NLB with an Elastic IP** as the internet-facing entry point and register the **ALB as a target** of the NLB (ALB-as-target is supported). The client allowlists the NLB's EIP; the ALB behind it does the host/path routing. Clean and fully within ELB.
- **AWS Global Accelerator in front of ALB** — Global Accelerator provides two static anycast IPs and routes to the ALB, adding edge acceleration and fast regional failover. The client allowlists the two accelerator IPs.

I'd default to **NLB→ALB** for a simple static-IP requirement, and Global Accelerator when I also want global performance/failover. Avoid trying to force a static IP directly onto an ALB — it isn't a supported model.

### Q12. How do sticky sessions work on an ALB, and when are they a smell?

ALB stickiness pins a client to one target so session state on that target stays reachable:

- **Duration-based** — ALB issues an `AWSALB` cookie; subsequent requests with that cookie go to the same target for the configured duration.
- **Application-based** — your app sets a custom cookie the ALB honors, giving you control over session lifetime.

They work, but they're often a **design smell**: they concentrate load (a hot user pins a hot target), break clean scale-in (draining a sticky target disrupts pinned users), and defeat even distribution. The senior move is to make targets **stateless** — externalize session state to **ElastiCache/Redis** or **DynamoDB** — so any target can serve any request. Reach for stickiness only when you genuinely can't externalize state (e.g. an in-memory legacy app you can't refactor yet).

### Q13. Your ALB returns 503 for every request but the instances look fine. Walk through debugging.

A 503 from an ALB almost always means **no healthy targets in the target group**. Debug in order:

1. **Target group health tab** — are targets `unhealthy` or `unused`? `unused` means nothing is registered (Auto Scaling not wired to the TG, or the TG is empty).
2. **Security groups** — does the *target's* SG allow inbound from the *ALB's* SG on the target port and the health-check port? This is the #1 cause.
3. **Health-check path & codes** — hit the path yourself on the instance; is it returning 200, or a 302 redirect / 401? Fix the path or the expected success codes.
4. **App binding** — is the process listening on `0.0.0.0:<port>`, not `127.0.0.1`?
5. **NACLs** — do subnet NACLs allow the health-check request *and* the ephemeral-port response (they're stateless)?
6. **Cross-AZ / subnets** — is the ALB enabled in the same AZs where targets live?

503 = LB has nowhere to send it; 502 = target answered with something malformed; 504 = target too slow (timeout).

### Q14. Give me the SSL termination + backend encryption options end-to-end.

Three common patterns for the TLS story front-to-back:

1. **Terminate at ALB, plaintext to backend** — ALB holds the ACM cert, decrypts, sends HTTP to targets. Simplest, offloads crypto, ALB routes on HTTP. Fine when the ALB→target hop is inside a trusted VPC. Not acceptable if you need encryption-in-transit *everywhere* (some compliance regimes).
2. **Terminate at ALB, re-encrypt to backend (HTTPS target)** — ALB decrypts to route, then re-encrypts to the target over HTTPS. End-to-end encryption *and* layer-7 routing. Slightly more CPU on both ends.
3. **NLB TLS passthrough** — NLB forwards encrypted TCP untouched; the **backend terminates** TLS (owns cert, can do mTLS). No layer-7 routing at the LB, but full end-to-end control and the app sees the raw TLS session.

Choose by requirement: routing + offload → (1); encryption-everywhere + routing → (2); app must own TLS / mTLS → (3).

### Q15. When would you deliberately NOT use ELB at all?

Load balancers aren't free — they add cost, a hop, and operational surface. Skip or replace ELB when:

- **Single instance / dev** — a lone EC2 or a Lightsail box doesn't need an LB; use an Elastic IP.
- **Serverless HTTP APIs** — **API Gateway** or a **Lambda Function URL** already front Lambda; adding an ALB is redundant unless you specifically want ALB features (WAF at ALB, existing hostname, path routing across mixed compute).
- **Static sites** — **CloudFront + S3** serves static content globally; no LB in the path.
- **Global low-latency TCP/UDP** — **Global Accelerator** may replace or augment an NLB for anycast entry and cross-region failover.
- **Internal service mesh** — with **ECS Service Connect** or **App Mesh / Cloud Map**, service-to-service traffic can route without a per-service LB.

The senior signal is recognizing ELB as one tool among several edge/entry options, and choosing by cost, protocol, and whether you actually need health-aware fan-out.

## Relational Databases: RDS & Aurora

### Summary

**What this topic covers**

Managed relational databases are where most application state ultimately lives, and AWS gives you two tiers: **RDS**, which runs standard engines (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server) as a managed service, and **Aurora**, AWS's cloud-native reimplementation of MySQL and PostgreSQL with a distributed storage layer. This topic has 17 questions covering the two pillars of RDS availability — **Multi-AZ** (a synchronous standby for failover) versus **read replicas** (asynchronous copies for read scaling) — and everything operational around them: automated backups and point-in-time recovery, storage autoscaling, RDS Proxy for connection pooling, parameter and option groups, maintenance windows and version upgrades, and blue/green deployments. On Aurora it goes deeper into the architecture that makes it special: **6-way replicated storage across 3 AZs**, fast replica failover, **Serverless v2** autoscaling, and **Global Database** for cross-region DR. Throughout, the emphasis is on the reliability, performance, cost, and security tradeoffs a senior engineer is expected to reason about — and on how the *application* handles a failover.

**Mental model**

Separate the two axes interviewers constantly conflate: **availability** and **read scaling**. **Multi-AZ** is an *availability* feature — a hot **synchronous** standby in another AZ that you never read from; if the primary dies, RDS flips a DNS CNAME to the standby (typically 60–120s) and your app reconnects to the *same endpoint*. **Read replicas** are a *scaling* feature — **asynchronous** copies you *do* read from, with replication lag, reached via a different endpoint. Multi-AZ protects durability/uptime; read replicas offload read traffic. Aurora collapses much of this: it decouples compute from a shared, distributed **storage volume** that all instances mount, so "replicas" are just additional compute pointing at the same data — which is why Aurora failover and replica creation are far faster than classic RDS, and why it stores **six copies of every 10 GB segment across three AZs**. When you reason about an RDS design, always ask: what's my availability story, what's my read-scaling story, and how does the app behave the instant a failover happens?

**Key terms**

- **RDS** — managed relational DB service for standard engines; AWS handles patching, backups, failover plumbing.
- **Aurora** — AWS-built MySQL/PostgreSQL-compatible engine with a distributed, auto-healing storage layer.
- **Multi-AZ** — synchronous standby in another AZ for automatic failover; **not** readable.
- **Read replica** — asynchronous copy for scaling reads; readable via its own endpoint; can be promoted.
- **PITR (point-in-time recovery)** — restore to any second within the backup retention window using automated backups + transaction logs.
- **RDS Proxy** — managed connection pool that fronts RDS/Aurora; essential for Lambda's connection storms.
- **Parameter group** — engine configuration (e.g. `max_connections`); **option group** — extra features (e.g. Oracle TDE, SQL Server audit).
- **Aurora replica** — compute instance sharing the cluster storage volume; up to 15 per cluster; sub-30s failover.
- **Aurora Serverless v2** — capacity in **ACUs** that autoscales in fine-grained steps with load.
- **Aurora Global Database** — one primary region + up to 5 secondary regions, storage-level replication with typically **<1s** lag.
- **Cluster / reader endpoint** — Aurora writer endpoint (always the primary) vs reader endpoint (load-balances across replicas).
- **Blue/green deployment** — a synchronized green copy you upgrade/change and then cut over to with minimal downtime.

**Why interviewers ask this**

Databases are the hardest thing to get right in a distributed system and the most expensive to get wrong, so this topic is a strong senior filter. The single most-asked question is **Multi-AZ vs read replicas**, and getting it wrong — thinking Multi-AZ scales reads, or that a read replica gives you HA — is a classic junior tell. Beyond that, interviewers want to see that you understand **the application-side reality of failover** (connection strings, endpoint types, connection pool resets, retry logic), the **cost model** (Multi-AZ roughly doubles instance cost; replicas add instances; Aurora's storage and I/O billing differ), and **when to reach for Aurora** versus plain RDS versus self-managing on EC2. Backup/PITR and encryption questions probe reliability and security fluency. The senior signal is reasoning about tradeoffs and blast radius, not reciting feature lists.

**Common confusions**

- "Multi-AZ scales reads" — **no**. The standby is passive; you cannot read from it. Reads scale via *read replicas* (or Aurora's reader endpoint / Multi-AZ **cluster** — a newer readable variant).
- "A read replica is my failover" — async replicas can lag and lose data; they're for scaling. You *can* promote one, but that's a manual DR step, not automatic HA.
- "Aurora is just RDS MySQL" — Aurora reimplements the storage engine (distributed, log-structured, 6-way replicated); it isn't stock MySQL under the hood.
- "Backups cause downtime" — automated backups on Multi-AZ snapshot the *standby*, so no I/O suspension on the primary.
- "Encryption can be turned on later with a click" — you **cannot** encrypt an existing unencrypted RDS instance in place; you snapshot, copy the snapshot with encryption, and restore.
- "Serverless means no capacity to think about" — Serverless v2 still has a min/max ACU range you must set; a too-low min throttles, a too-high max surprises the bill.

**What follows from this topic**

RDS/Aurora sits behind almost every stateful workload in this primer. Its **VPC** placement (private subnets, security groups) ties to networking; **RDS Proxy** connects directly to the **Lambda** and serverless story (connection storms); **PITR, Multi-AZ, and Global Database** are core to the **reliability** and disaster-recovery discussion (RPO/RTO); **KMS encryption** links to the security topic; and the read-scaling patterns here contrast directly with **DynamoDB**'s partitioned model in the NoSQL topic. When an interview asks you to "design the data tier," this is the toolkit you reach into first.

### Q1. What database engines does RDS support, and what's the difference between RDS and Aurora?

**RDS** runs six engines as a managed service: **MySQL, PostgreSQL, MariaDB, Oracle, SQL Server**, and **Aurora** (MySQL- and PostgreSQL-compatible). For the first five, RDS runs the *stock* engine on EBS-backed instances and manages patching, backups, and failover for you.

**Aurora** is different: it's AWS's own engine that's *wire-compatible* with MySQL/PostgreSQL but replaces the storage layer with a distributed, log-structured volume shared across instances and replicated six ways across three AZs. That architecture gives Aurora faster failover, faster replica creation, up to 15 low-lag replicas, and better throughput than the equivalent RDS engine — at a different (often higher, sometimes cheaper at scale) price point.

Rule of thumb: use **RDS** when you need a specific engine/version or licensing (Oracle, SQL Server) or a simple small DB; use **Aurora** when you want MySQL/PostgreSQL compatibility with cloud-native availability and scale.

### Q2. Explain Multi-AZ versus read replicas — this is the one that trips people up.

They solve **different problems**:

| | Multi-AZ | Read replica |
|---|---|---|
| Purpose | **Availability / failover** | **Read scaling** |
| Replication | **Synchronous** | **Asynchronous** (has lag) |
| Readable? | **No** (standby is passive)* | **Yes** |
| Failover | Automatic (~60–120s, DNS flip) | Manual promotion |
| Endpoint | Same endpoint after failover | Separate endpoint per replica |
| Cross-region | No (same region, different AZ) | Yes |

Multi-AZ keeps a hot standby you can't touch; if the primary fails, RDS repoints the endpoint. Read replicas are copies you actively read from to offload the primary, at the cost of replication lag. **You often use both**: Multi-AZ for HA *and* one or more read replicas for scale.

*The newer **Multi-AZ DB cluster** variant adds two *readable* standbys — a middle ground.

### Q3. How do RDS backups and point-in-time recovery work?

Two mechanisms:

- **Automated backups** — RDS takes a daily snapshot plus continuously ships transaction logs to S3, giving **point-in-time recovery (PITR)** to any second within your retention window (**1–35 days**, 0 disables it). Deleting the instance can delete these (unless you take a final snapshot).
- **Manual snapshots** — user-initiated, full-volume, **retained until you delete them**, and shareable across accounts/regions.

**PITR** works by restoring the nearest automated snapshot and replaying transaction logs forward to your chosen timestamp — this creates a **new instance** with a new endpoint (you don't restore in place). Great for "someone dropped a table at 14:32" recovery. On Multi-AZ, backups run against the standby so there's no primary I/O hit. For long-term/compliance retention, copy snapshots to another region or use AWS Backup.

### Q4. What is RDS storage autoscaling and what are its limits?

RDS storage autoscaling lets the DB grow its allocated storage automatically when free space runs low, so you don't page at 2am for a full disk. You set a **maximum storage threshold**; RDS bumps capacity (typically by ~10% or 10 GiB, whichever is larger) when free space stays under ~10% for several minutes.

Caveats worth stating:

- Storage can **only grow, never shrink** — to reclaim space you must dump/reload into a smaller instance.
- There's a cooldown (~6 hours) between scaling events, so a sudden flood can still fill the disk faster than it scales.
- Set the max threshold sensibly — it's your cost guardrail.

It solves the "ran out of disk" failure mode but isn't a substitute for capacity planning on write-heavy workloads.

### Q5. What problem does RDS Proxy solve, and why is it critical for Lambda?

Relational databases have a **hard connection ceiling** (`max_connections`), and each connection is relatively heavyweight. **Lambda** breaks this model: under load, thousands of concurrent function instances each open their own DB connection, exhausting `max_connections` and causing "too many connections" errors — a **connection storm**.

**RDS Proxy** sits between clients and the database as a **managed connection pool**: it maintains a warm set of DB connections and multiplexes many client connections onto them, so a spike of Lambdas shares a bounded pool instead of hammering the DB. Bonus wins:

- **Faster failover** — Proxy holds the client connection and reconnects to the new primary, cutting failover-visible downtime.
- **IAM auth + Secrets Manager** integration for credential handling.

Use it whenever serverless or highly-concurrent short-lived clients talk to RDS/Aurora. It's practically mandatory for Lambda + RDS.

### Q6. What are parameter groups and option groups?

Two separate configuration objects:

- **Parameter group** — engine *configuration* knobs, equivalent to `my.cnf` / `postgresql.conf`: `max_connections`, `work_mem`, `innodb_buffer_pool_size`, timeouts, logging. Changes are either **dynamic** (apply live) or **static** (require a reboot). You attach one parameter group per instance/cluster.
- **Option group** — additional *features* beyond core config, engine-specific: Oracle **TDE** or Native Network Encryption, SQL Server **audit**/TDE, MySQL memcached plugin. Not all engines use them meaningfully (PostgreSQL relies on parameters/extensions instead).

Practical note: the **default** groups are read-only, so to change anything you create a *custom* group, associate it, and (for static params) reboot. Mismanaging static parameters is a common cause of "why didn't my change take effect."

### Q7. How do maintenance windows and version upgrades work?

RDS applies OS/engine patching in a weekly **maintenance window** you choose (a 30-min block). Two upgrade classes:

- **Minor version upgrades** — bug/security fixes; can be **auto-applied** during the window (with `auto minor version upgrade` on). Usually low-risk, short.
- **Major version upgrades** — new features and possible breaking changes; **never automatic** — you initiate them, and they can require parameter-group changes and application testing. On Multi-AZ they still incur a failover/downtime blip.

Best practice: test major upgrades against a snapshot-restored clone or a **blue/green deployment** first, schedule them explicitly, and keep the maintenance window off your peak hours. Deferring upgrades indefinitely is risky — AWS eventually forces upgrades on deprecated versions.

### Q8. Describe Aurora's storage architecture — what makes it different?

Aurora **decouples compute from storage**. Instead of each instance owning an EBS volume, all instances in a cluster mount a shared, distributed **storage volume** built as a purpose-built log-structured service:

- Every **10 GB "protection group" segment** of the volume is stored as **6 copies across 3 AZs** (2 per AZ).
- Writes need only a **4-of-6 quorum** to be durable; reads use a **3-of-6** quorum; so it tolerates losing an entire AZ *plus* one more copy without losing write availability.
- The storage layer is **self-healing** — it continuously scrubs and re-replicates lost segments.
- Aurora ships **redo log records**, not full pages, to storage; the storage tier materializes pages, which slashes write amplification and network traffic.

Because storage is shared, adding a replica doesn't copy data — it's just new compute pointing at the same volume. That's the root of Aurora's fast failover, fast replica creation, and low replica lag.

### Q9. How fast is Aurora failover and how does it compare to RDS Multi-AZ?

**Aurora** failover is typically **under ~30 seconds**, often ~10–15s. Because replicas already share the same storage volume, failover is just promoting an existing reader to writer and repointing the cluster (writer) endpoint — no data movement, no standby to catch up. You can set **failover priority (tiers)** to control which replica gets promoted first.

**RDS Multi-AZ** (classic) is typically **60–120s**, because it flips a DNS CNAME to a separate synchronous standby.

Two senior points: (1) faster failover only helps if the **application reconnects quickly** — DNS caching and stale connection pools can dominate the real downtime, which is exactly what **RDS Proxy** mitigates; (2) put at least one Aurora replica in another AZ, or an AZ loss leaves you with a single-instance cluster to rebuild.

### Q10. What is Aurora Serverless v2 and when would you use it?

Aurora Serverless v2 scales **compute** automatically in fine-grained steps measured in **ACUs (Aurora Capacity Units)** — roughly 2 GiB RAM plus proportional CPU/network per ACU. You set a **min and max ACU** range; it scales up and down in-place within seconds as load changes, without dropping connections.

Good fits:

- **Spiky / unpredictable** workloads (dev/test, batch, variable SaaS tenants) where fixed provisioning wastes money or throttles.
- **Infrequently used** databases you don't want to run at full size 24/7.

Watch-outs versus v1: v2 does **not scale to zero** (min ACU keeps a warm instance costing money), scales much more smoothly than v1, and supports Multi-AZ, replicas, and Global Database. Set the min high enough to avoid throttling your baseline and the max as your cost/perf ceiling. For steady, predictable load, provisioned instances are usually cheaper.

### Q11. Explain Aurora Global Database and what DR story it gives you.

**Aurora Global Database** spans regions: **one primary region** (read/write) plus up to **five secondary regions** (read-only), with replication at the **storage layer** — typically **under one second** of lag — and dedicated infrastructure that offloads replication from the DB engine.

DR value:

- **Cross-region disaster recovery** with low **RPO** (often <1s of data at risk) and low **RTO** — you can **promote a secondary** to primary, typically in **under a minute** (managed planned failover) or via unplanned detach-and-promote.
- **Local low-latency reads** in each region for a global user base.

Contrast with a plain **cross-region read replica** (also possible on RDS): Global Database replicates at storage level with lower lag and purpose-built plumbing, and gives managed failover. It's the go-to for regulated or global apps that need a warm standby region. The cost is running compute + storage in every region.

### Q12. When would you choose RDS over Aurora, and vice versa?

**Choose Aurora when:**
- You're on MySQL/PostgreSQL and want cloud-native HA, fast failover, up to 15 low-lag replicas, and read scaling via the reader endpoint.
- You need **Global Database** cross-region DR or **Serverless v2** autoscaling.
- Throughput/scale on the storage tier matters.

**Choose plain RDS when:**
- You need **Oracle or SQL Server**, or a specific MySQL/PostgreSQL version/extension Aurora doesn't support.
- The workload is small/steady and you want the **simplest, cheapest** managed option (a small `db.t` RDS instance can be cheaper than Aurora's minimums).
- You have licensing (BYOL) or tooling constraints tied to the stock engine.

**Cost nuance:** Aurora bills storage + I/O (or a fixed-I/O "Aurora I/O-Optimized" mode for I/O-heavy workloads) and higher instance minimums, but often wins at scale by needing fewer/smaller replicas. Match the tool to engine, scale, and DR needs.

### Q13. How do you scale reads, and how does the app split reads from writes?

Two approaches depending on engine:

- **RDS** — create **read replicas** and point read traffic at each replica's endpoint. You (or your ORM/driver) must route reads to replicas and writes to the primary explicitly; replicas have async lag, so reads may be stale.
- **Aurora** — use the built-in **reader endpoint**, which **load-balances across all replicas** automatically; writes go to the **writer (cluster) endpoint**. Aurora replica lag is typically single-digit milliseconds.

Application splitting patterns:
- **Two connection pools** — a writer pool and a reader pool, chosen per query. Most common and explicit.
- **Driver/proxy-level splitting** — some drivers (e.g. MySQL replication driver) or **RDS Proxy** endpoints route by read/write intent.

The key caveat is **replication lag / read-your-writes**: after a write, an immediate read on a replica may not see it. Route reads that must reflect a just-committed write to the primary, or use session pinning.

### Q14. How does encryption work at rest and in transit for RDS/Aurora?

**At rest** — encryption uses **KMS**; it covers the underlying storage, automated backups, snapshots, and read replicas. Critical gotcha: you **enable it at creation time only** — you cannot encrypt an existing unencrypted instance in place. To encrypt an existing DB: take a snapshot, **copy the snapshot with encryption enabled** (choosing a KMS key), then **restore** from the encrypted copy. Encrypted snapshots can be shared cross-account by sharing the CMK.

**In transit** — TLS/SSL between client and DB using the **RDS-provided CA certificates**; you download the CA bundle and configure the client to require SSL (e.g. `sslmode=verify-full` for PostgreSQL). Enforce it via a parameter (`rds.force_ssl`) so no plaintext connections are allowed. Rotate/trust the newer RDS CA before AWS expires the old one, or clients break.

Together these cover the security pillar's encryption-everywhere requirement.

### Q15. What are RDS/Aurora blue/green deployments and what do they protect against?

A **blue/green deployment** creates a **green** environment that's a synchronized copy of your **blue** (current production) database, kept in sync via replication. You apply your risky change — a **major version upgrade**, schema change, or parameter change — to green, test it thoroughly while blue keeps serving traffic, then **switch over** (promote green to production) in a controlled cutover measured in **~a minute**, with safeguards that block the switch if replication lag or health checks look wrong.

What it protects against:
- **Upgrade risk** — validate a major upgrade on a real, in-sync copy before committing.
- **Long downtime** — cutover is fast and reversible-ish (blue is retained), versus an in-place upgrade's extended outage.

It's the safe way to do otherwise-scary database changes. The main limits: some replication constraints per engine, and you pay for two environments during the transition.

### Q16. When a failover happens, what does the application need to do?

Failover is only "seamless" if the app is built for it. The instant a primary flips:

- **Endpoints, not IPs** — always connect via the RDS/Aurora **endpoint DNS name**, never a resolved IP. On failover the endpoint repoints to the new primary; hardcoded IPs break.
- **Connection pool reset** — existing connections are dead after failover; the pool must **detect broken connections and reconnect**. Configure short validation/keepalive and sane timeouts so stale connections are evicted fast.
- **Retry with backoff** — wrap writes in retry logic; there's a window (seconds) where no primary is accepting writes. Idempotent, retried writes ride through it.
- **Reader vs writer endpoints (Aurora)** — after failover a former reader is now the writer; make sure write traffic uses the **writer/cluster endpoint** which tracks the current primary, not a specific replica endpoint.
- **RDS Proxy** — offloads much of this: it holds client connections and reconnects to the new primary under the hood, shrinking app-visible downtime.

The senior insight: real failover downtime is usually dominated by **client reconnection behavior**, not AWS's failover time.

### Q17. What is Performance Insights and how do you use it to debug a slow database?

**Performance Insights** is RDS/Aurora's built-in database performance monitoring. Its core view is **Average Active Sessions (AAS)** plotted over time and broken down by **wait event** and by SQL statement — so you can see *what the database is actually waiting on*, not just CPU%.

Using it to debug:
- A tall band of **CPU** wait → queries are compute-bound; look at the top SQL, missing indexes, bad plans.
- **I/O waits** (e.g. `io/*`, buffer/read) → working set doesn't fit in memory, or a scan-heavy query; consider more RAM, indexes, or query rewrites.
- **Lock / `Lock:*` waits** → contention; a hot row, long transactions, or missing index causing lock escalation.
- Slice by **top SQL, top waits, top hosts/users** to find the offender fast.

Combine it with the **slow query log**, `EXPLAIN` on the offending SQL, and CloudWatch metrics. Performance Insights answers "which queries and which wait types are hurting me right now" — the first question in any DB latency incident.

## NoSQL: DynamoDB

### Summary

**What this topic covers**

DynamoDB is AWS's fully-managed, serverless key-value and document database — single-digit-millisecond latency at any scale, no servers to manage, and a data model that forces you to design around **access patterns** rather than normalized relations. This topic has 18 questions covering the fundamentals (partition key, sort key, how hashing and partitioning actually work, hot partitions), the modeling discipline that makes or breaks a DynamoDB project (**access-pattern-first design**, **single-table design**, primary-key choice), the two index types (**GSIs vs LSIs**), the two capacity modes (**on-demand vs provisioned** with auto scaling, RCU/WCU math, consistency and its cost), and the ecosystem around the table: **Streams** for change data capture, **TTL**, **transactions**, **conditional writes / optimistic locking**, **DAX** caching, **global tables** for multi-region active-active, the hard **400 KB item limit**, **Query vs Scan** and why Scan is usually wrong, **adaptive capacity**, **PartiQL**, **backup/PITR**, and — critically — **when DynamoDB is the wrong choice**.

**Mental model**

Stop thinking like a relational modeler. In SQL you model entities first and query however you like later; in DynamoDB you **enumerate your access patterns first** and design keys so every pattern is a direct **Query** on a partition key (plus maybe a sort-key condition) — no joins, no scans, no ad-hoc queries. The physical reality underneath: DynamoDB **hashes the partition key** to pick a physical partition (each partition holds ~10 GB and serves up to 3,000 RCU / 1,000 WCU). Items with the same partition key live together, sorted by **sort key** — that's what makes range queries (`begins_with`, `between`) fast. Two consequences follow directly: (1) if one partition key gets disproportionate traffic you create a **hot partition** and get throttled even with capacity to spare; (2) because there are no joins, you either denormalize or you pack **multiple entity types into one table** (single-table design) with generic `PK`/`SK` attributes and overloaded GSIs so related items co-locate and one query returns them together. Design keys for reads; writes fall out of it.

**Key terms**

- **Partition key (hash key)** — attribute hashed to choose a physical partition; determines data distribution.
- **Sort key (range key)** — orders items within a partition; enables range queries and item collections.
- **Item / attribute** — a row (max **400 KB**) and its typed fields; schemaless beyond the key attributes.
- **GSI (Global Secondary Index)** — alternate partition+sort key, its own capacity, **eventually consistent**, can be added anytime.
- **LSI (Local Secondary Index)** — alternate *sort* key sharing the table's partition key; **create-time only**; supports strong consistency.
- **RCU / WCU** — read/write capacity units; 1 RCU = one 4 KB strongly-consistent read/s (½ for eventually consistent); 1 WCU = one 1 KB write/s.
- **On-demand vs provisioned** — pay-per-request auto-scaling mode vs pre-provisioned capacity (± auto scaling).
- **Adaptive capacity** — automatic redistribution of throughput toward hot partitions to smooth skew.
- **DynamoDB Streams** — ordered, 24-hour change log per table for CDC, triggers, and replication.
- **DAX** — DynamoDB Accelerator; in-memory write-through cache giving microsecond reads.
- **Global tables** — multi-region, active-active replicated tables (last-writer-wins).
- **TTL** — per-item expiry timestamp; DynamoDB deletes expired items free (best-effort, within ~48h).
- **PartiQL** — SQL-compatible query language over DynamoDB (still bound by key/index physics).

**Why interviewers ask this**

DynamoDB is the clearest test of whether a candidate can **think in access patterns** instead of forcing relational habits onto a NoSQL store — the most common and most expensive DynamoDB mistake. Juniors describe it as "a fast key-value store" and then design a table they can only query with **Scan** (a table-wide read that ignores your key design and burns capacity linearly). Seniors start by asking "what are the queries?", choose partition keys that **distribute load** while **co-locating** related items, know the GSI/LSI tradeoffs cold, and can reason about **capacity math, consistency cost, hot partitions, and the 400 KB limit**. Interviewers also probe the operational surface — Streams, TTL, transactions, global tables, DAX — and, tellingly, **when *not* to use DynamoDB**. Knowing the anti-patterns (analytics, ad-hoc queries, large blobs, relational joins) is a strong senior signal because it shows judgment, not just recall.

**Common confusions**

- "DynamoDB has no schema, so I don't need to plan" — the opposite: because you can't join or ad-hoc query, you must plan **access patterns up front** more rigorously than in SQL.
- "GSI and LSI are basically the same" — LSIs share the base partition key, must be created *with the table*, count against the item collection's 10 GB limit, and can be strongly consistent; GSIs have their own keys and capacity, are added anytime, and are **only eventually consistent**.
- "Scan is fine for small tables" — it is, but it doesn't stay small; a Scan-based access pattern is a scaling time bomb.
- "Strongly consistent reads cost the same" — they cost **2×** an eventually-consistent read and aren't available on GSIs.
- "On-demand is always more expensive" — for spiky or unknown traffic it's often cheaper *and* safer than over-provisioning; provisioned wins for steady, predictable, high volume.
- "Global tables give me strong global consistency" — they're **eventually consistent, last-writer-wins**; concurrent cross-region writes to the same item can clobber each other.

**What follows from this topic**

DynamoDB is the serverless data backbone that pairs with the rest of this primer. **Streams** feed **Lambda** for change-data-capture pipelines and fan-out; **DAX** and consistency choices echo the caching and performance-efficiency themes from **ElastiCache** and the compute topics; **global tables** connect to the multi-region reliability/DR discussion alongside **Aurora Global Database**; **on-demand vs provisioned** mirrors the serverless cost-model reasoning throughout. Most importantly, DynamoDB is the deliberate contrast to **RDS/Aurora**: partitioned key-value access-pattern-first design versus normalized relational flexibility. Knowing *which* to reach for — and being able to defend it — is exactly the data-tier judgment senior interviews are testing.

### Q1. What are the partition key and sort key, and what's the difference?

Every DynamoDB item is identified by a **primary key**, which is one of two shapes:

- **Partition key alone (simple primary key)** — the key's value is hashed to place the item on a partition; each value must be unique. Good for pure key-value lookups (e.g. `userId`).
- **Partition key + sort key (composite primary key)** — items sharing a partition key are stored **together, sorted by the sort key**. The *combination* must be unique. This unlocks range queries and "item collections."

The **partition key** decides **where** an item lives (distribution); the **sort key** decides **order within** that partition and enables efficient `begins_with`, `between`, `>`, `<` queries. Classic example: `PK = userId`, `SK = orderDate` lets you fetch "all of a user's orders in a date range" in one Query. Choosing these two well is 80% of DynamoDB design.

### Q2. How does partitioning and hashing work under the hood, and what's a hot partition?

DynamoDB runs an internal **hash function over the partition key** to assign each item to a **physical partition**. Each partition holds up to ~**10 GB** and can serve up to ~**3,000 RCU** and ~**1,000 WCU**. As data or throughput grows, DynamoDB **splits** partitions and spreads them across storage nodes automatically.

A **hot partition** happens when your key choice sends disproportionate traffic to **one** partition key value — a celebrity user, today's date as a partition key, a single "status = PENDING" bucket. Because per-partition throughput is capped, that key gets **throttled** even though the table as a whole has plenty of capacity. Fixes: choose a **high-cardinality, evenly-accessed** partition key; **write-shard** a hot key by suffixing (`STATUS#PENDING#<0-9>`); or rely on **adaptive capacity** to lean throughput toward the hot partition (helps, but doesn't beat a fundamentally skewed key). Hot partitions are the #1 DynamoDB performance pitfall.

### Q3. Explain access-pattern-first modeling — how is it different from relational design?

In **relational** design you model normalized entities and tables first, then write whatever `JOIN`/`WHERE` queries you need later — the query engine is flexible, the schema is the star. In **DynamoDB** there are **no joins and no efficient ad-hoc queries**, so you invert the process:

1. **List every access pattern** the application needs ("get user by id", "list a user's orders by date", "get all items in an order").
2. **Design keys and indexes** so each pattern is a single **Query** on a partition key (+ optional sort-key condition).
3. Denormalize / duplicate data as needed so reads are cheap; writes maintain the duplication.

The consequence is you **must know your queries before you create the table**, and adding a genuinely new access pattern later may require a new GSI or a data migration. This up-front rigor is exactly why people who treat DynamoDB like "schemaless, figure it out later" get burned.

### Q4. What is single-table design and why do people use it?

**Single-table design** packs **multiple entity types** (users, orders, order-items, etc.) into **one** DynamoDB table using **generic key attributes** (`PK`, `SK`) whose values are overloaded per entity:

```
PK              SK                  ...attributes
USER#alice      PROFILE             name, email
USER#alice      ORDER#2025-01-02    total, status
ORDER#123       ITEM#sku-9          qty, price
```

Because related items share a partition key, **one Query returns a user and all their orders together** — you recover "join-like" access with a single request and no server-side join. **GSIs are overloaded** the same way to serve inverse or alternate access patterns.

Why bother: fewer round trips (related data co-located), lower latency, one set of capacity/alarms to manage, and it plays to DynamoDB's strengths. The cost is **conceptual complexity** — the model is harder to read, migrations are fiddly, and it's easy to over-apply. Many teams pragmatically use a *few* tables; single-table is a powerful tool, not a mandate.

### Q5. GSI vs LSI — what are the differences and when do you use each?

| | GSI (Global) | LSI (Local) |
|---|---|---|
| Partition key | **Different** from base table | **Same** as base table |
| Sort key | Different | Different |
| When created | **Anytime** | **Table creation only** |
| Consistency | **Eventual only** | Strong or eventual |
| Capacity | **Its own** RCU/WCU | Shares table capacity |
| Item collection limit | No 10 GB limit | Counts toward **10 GB** per partition key |
| Count per table | 20 (default) | 5 |

**Use a GSI** for the common case: a completely different query dimension (e.g. query orders by `status` when the table is keyed by `orderId`), or any index you realize you need *after* launch. **Use an LSI** only when you need an **alternate sort key on the same partition key** *and* you need **strongly consistent** reads on it — and you must decide at table-creation time. In practice GSIs dominate; LSIs are rarer because of the create-time and 10 GB constraints.

### Q6. How do index projections work, and why do they matter?

When you create a GSI/LSI you choose which attributes get **projected** (copied) into the index:

- **KEYS_ONLY** — only the index + base keys. Smallest/cheapest; you get pointers and must fetch the rest from the base table.
- **INCLUDE** — keys plus a named subset of attributes.
- **ALL** — every attribute is copied into the index.

It matters for **cost and latency**. If a query reads an attribute **not** projected into the GSI, DynamoDB must do an extra fetch back to the base table (for GSIs this isn't even automatic — you simply won't have the attribute). Projecting **ALL** makes queries self-contained but **doubles storage and write cost** (every base write also writes the index). The senior move: project exactly the attributes your index's access patterns read — usually **INCLUDE** with a tight list — balancing read convenience against write/storage amplification.

### Q7. Explain on-demand vs provisioned capacity, including RCU/WCU.

Two billing/capacity modes:

- **Provisioned** — you set **RCU** and **WCU**; you pay for that capacity whether used or not, and requests beyond it **throttle** (unless burst/adaptive absorbs it). Add **auto scaling** to track a target utilization. Cheapest for **steady, predictable** high volume; you can also buy reserved capacity.
- **On-demand** — no capacity to set; you **pay per request** and it scales instantly to any load. Best for **spiky, unknown, or new** workloads and dev/test. Costs more per request but eliminates throttling-from-under-provisioning and planning overhead.

**Capacity math:**
- **1 WCU** = one write up to **1 KB/s** (round up; a 3 KB write = 3 WCU).
- **1 RCU** = one **strongly consistent** read up to **4 KB/s**, or **two eventually consistent** reads of 4 KB/s. So eventually consistent reads are **half price**.
- Transactions cost **2×** (2 RCU/2 WCU per item).

You can switch modes (limited frequency). Start on-demand when unsure; move to provisioned + auto scaling once traffic is predictable enough to save money.

### Q8. Strong vs eventual consistency — what's the cost and where can't you get strong?

By default DynamoDB reads are **eventually consistent**: a read right after a write *might* return slightly stale data (replicas across the 3 AZs converge in ~milliseconds). You can request a **strongly consistent** read to always see the latest committed write.

Costs and limits:
- A strongly consistent read costs **2× the RCU** of an eventually consistent one (1 RCU per 4 KB vs 2 reads per RCU).
- **GSIs are always eventually consistent** — you **cannot** do a strongly consistent read on a GSI, ever. (LSIs *can* be strongly consistent.)
- Strong consistency is per-request (a flag on `GetItem`/`Query`), and slightly higher latency / lower availability during partitions.

Rule of thumb: default to eventual (cheaper, fine for most reads); use strongly consistent only where **read-your-writes** correctness matters (e.g. reading a balance immediately after debiting it), and remember you can't get it via a GSI.

### Q9. What are DynamoDB Streams and what do you build with them?

**DynamoDB Streams** is an ordered, per-table **change log**: every item-level **insert/modify/remove** is captured as a record and retained for **24 hours**. You choose what each record contains via the **stream view type**: `KEYS_ONLY`, `NEW_IMAGE`, `OLD_IMAGE`, or `NEW_AND_OLD_IMAGES`. Records are ordered **per partition key**.

Common uses (change data capture):
- **Trigger Lambda** on changes — send a welcome email on user insert, update a search index, invalidate a cache.
- **Replication / materialized views** — fan a change out to another store, or maintain an aggregate/rollup table.
- **Global tables** are built on Streams under the hood.
- **Audit / event sourcing** — stream mutations into an event log or analytics pipeline (via Lambda → Kinesis/Firehose → S3).

A Lambda trigger reads the stream in **batches per shard**, in order, with at-least-once delivery — so make consumers **idempotent**. Kinesis Data Streams is an alternative stream target with longer retention.

### Q10. How does TTL work?

**TTL (Time To Live)** auto-deletes expired items to keep tables lean and cheap. You designate a numeric attribute holding a **Unix epoch timestamp**; when that time passes, DynamoDB deletes the item **for free** (no WCU cost).

Key caveats:
- Deletion is **best-effort background** — items typically vanish within a few hours but **can linger up to ~48h** past expiry. So filter expired-but-not-yet-deleted items out in your queries if correctness depends on it.
- The attribute must be a **Number** in epoch **seconds** (a common bug is using milliseconds — nothing expires).
- TTL deletes appear in **Streams** as system deletes, so you can archive expiring items (e.g. stream → Lambda → S3) before they're gone.

Great for sessions, carts, short-lived tokens, and any "expire after N days" data. It offloads a whole category of cleanup jobs.

### Q11. How do transactions work in DynamoDB?

DynamoDB supports **ACID transactions** across one or more items (and even multiple tables in the same account/region) via **`TransactWriteItems`** and **`TransactGetItems`**. A transaction is **all-or-nothing**: up to **100 items** (or 4 MB), with per-item **condition checks**; if any condition fails or a conflict occurs, the whole thing rolls back.

Details that matter:
- Each item in a transaction costs **2× the normal capacity** (2 WCU/2 RCU), because it's a two-phase prepare/commit under the hood.
- Transactions are **serializable** but **not** a general-purpose locking system — a `TransactWriteItems` that conflicts with a concurrent transaction is rejected (you retry).
- Use them for genuinely atomic multi-item invariants: debit one account and credit another, create an order and decrement inventory, enforce uniqueness across two items.

Don't wrap everything in transactions — they cost double and reduce throughput. Reach for them only where multi-item atomicity is a real requirement.

### Q12. What are conditional writes and optimistic locking?

A **conditional write** only applies if a **condition expression** on the item is true at write time (checked atomically on the server). Examples: `attribute_not_exists(PK)` to insert-only (prevent overwrite), or `#status = :expected` to update only from an expected state.

**Optimistic locking** builds on this to handle concurrent updates without a lock: keep a **version** attribute, and on update require `version = :currentVersion` while setting `version = :currentVersion + 1`. If another writer bumped the version first, your condition fails, you re-read and retry. This is exactly how the DynamoDBMapper/enhanced client's `@DynamoDbVersionAttribute` works.

Why it's powerful: it prevents **lost updates** (two readers overwriting each other) with **no locks, no coordination**, and only costs a failed write on contention. The pattern is: read → modify → conditional-write-with-version → retry on `ConditionalCheckFailedException`. It's the idiomatic DynamoDB concurrency-control tool.

### Q13. What is DAX and when do you use it?

**DAX (DynamoDB Accelerator)** is a fully-managed, in-memory **write-through cache** that sits in front of DynamoDB and speaks the **same API**, so adopting it is mostly a client change — no query rewrites. It turns single-digit-**millisecond** reads into **microsecond** reads and can slash RCU cost for read-heavy, repetitive workloads.

Use it when:
- You have **read-heavy, hot-key** traffic (product catalogs, leaderboards, config) where the same items are read repeatedly.
- You want to reduce read capacity cost or smooth read spikes.

Caveats:
- It caches **eventually consistent** reads; **strongly consistent** reads pass through to DynamoDB (no acceleration).
- It's a **cluster in your VPC** (nodes to size/pay for), so it fits sustained high read volume, not tiny tables.
- Write-through means writes go to DynamoDB *and* update the cache; stale windows exist for out-of-band changes.

For simple app-side caching of small data, **ElastiCache** or in-process caches may be simpler; DAX shines when you specifically want a DynamoDB-transparent cache at scale.

### Q14. Explain global tables and their consistency model.

**Global tables** replicate a DynamoDB table across **multiple regions**, **active-active** — every region accepts reads *and* writes, and changes propagate to the others (built on Streams) typically within a second.

The consistency model is the crucial nuance: replication is **asynchronous and eventually consistent** across regions, with **last-writer-wins** conflict resolution (by timestamp). So:

- Within a region, you still get normal read consistency options.
- **Across regions**, a read may briefly see stale data, and **concurrent writes to the same item in different regions can clobber each other** — the latest timestamp wins, the other is silently lost.

Use global tables for **multi-region low-latency access** and **regional DR/failover** where per-item write conflicts are rare or tolerable (user sessions localized to a region, per-region-partitioned data). **Avoid** them when you need a single global source of truth with strong cross-region consistency (e.g. a global counter or inventory that multiple regions decrement) — that's a correctness trap. Pair with **partitioning writes by region** to avoid conflicts.

### Q15. What's the item size limit and how do you handle large items?

A single DynamoDB item — all attribute names and values combined — is capped at **400 KB**. There's no way to raise it. Large items also cost more (capacity is per KB) and hurt latency.

Handling data that doesn't fit:

- **Store the blob in S3, keep a pointer in DynamoDB** — the canonical pattern: put the large payload (images, documents, big JSON) in **S3** and store just the **S3 key + metadata** in the item. Best for anything genuinely large.
- **Split across multiple items** — model a large logical object as an item collection (same partition key, multiple sort keys) and stitch it together with a Query.
- **Compress** — gzip a large attribute into a Binary field if it's near the limit and you don't need to query into it.

Trying to cram large blobs directly into items is an anti-pattern: it blows capacity cost, throttles partitions, and eventually hits 400 KB. S3-plus-pointer is the reflexive senior answer.

### Q16. Query vs Scan — why is Scan usually an anti-pattern?

- **Query** targets a **single partition key** (with optional sort-key condition) and reads only the matching item collection — efficient, capacity scales with **results returned**, and it uses your key/index design as intended.
- **Scan** reads the **entire table** (or index) and filters afterward. Its cost scales with **table size**, not result size — a filter that returns 5 items on a 10M-item table still **reads all 10M** and burns capacity accordingly. It's slow, expensive, and can throttle other traffic.

So Scan is an anti-pattern for **application access patterns** — if you find yourself needing a Scan, your **key design is wrong**; add a **GSI** so the query becomes a Query. Legitimate Scan uses are rare and operational: one-off migrations, exports, or full-table maintenance — and even then use **parallel Scan** with segments and rate-limit it. **Pagination:** both Query and Scan return **1 MB per page** with a `LastEvaluatedKey`; you loop using `ExclusiveStartKey` to page through — so a "Scan the table" is really many paged, capacity-hungry calls.

### Q17. What is adaptive capacity, and does it eliminate hot partitions?

**Adaptive capacity** is DynamoDB's automatic mechanism for coping with **unbalanced access**. Two parts: (1) it **redistributes throughput** toward partitions receiving more traffic, letting a hot partition temporarily borrow unused capacity from the table; and (2) **isolation** — it can **split a hot partition** and even move a single hot key onto its own partition. It's automatic and instantaneous-ish, no config.

But it does **not** fully eliminate hot partitions:
- A **single partition key** still has a hard per-partition ceiling (~3,000 RCU / 1,000 WCU); adaptive capacity can't exceed the physics for one key.
- It smooths **moderate** skew; a genuinely pathological key (one celebrity user taking 90% of traffic) still throttles.

So adaptive capacity buys headroom and hides mild imbalance, but the real fix for severe skew is **better key design** — high-cardinality partition keys and **write-sharding** hot keys. Treat adaptive capacity as a safety net, not a design excuse.

### Q18. When is DynamoDB the wrong choice?

DynamoDB is superb for **known access patterns at scale with predictable, key-based lookups** — and a poor fit when you need flexibility it deliberately gives up:

- **Ad-hoc / analytical queries** — aggregations, GROUP BY, arbitrary filtering, reporting. Use **Athena/Redshift** (or a relational DB); forcing this onto DynamoDB means Scans and pain.
- **Complex relational integrity / joins** — many-to-many relationships, foreign keys, multi-table joins → **RDS/Aurora**.
- **Unknown or frequently-changing access patterns** — if you can't enumerate queries up front, a flexible SQL store is safer than repeated DynamoDB migrations.
- **Large objects / blobs** — files, media → **S3** (pointer in Dynamo at most).
- **Search / full-text** — → **OpenSearch**.
- **Strong global consistency** — a single global counter/inventory decremented from many regions fights global tables' last-writer-wins model.
- **Small, low-traffic apps where SQL familiarity wins** — the modeling overhead may not pay off.

The senior signal is naming these anti-patterns confidently: DynamoDB rewards access-pattern discipline and punishes relational/analytical flexibility. Match the tool to the query shape.
## Caching & In-Memory: ElastiCache & DAX

### Summary

**What this topic covers**

Everything that sits between your compute and your database to make reads fast and cheap: **ElastiCache** (managed Redis / Valkey and Memcached), **MemoryDB for Redis** (durable, multi-AZ Redis as a primary database), and **DAX** (DynamoDB Accelerator, a DynamoDB-specific write-through cache). The 15 questions here cover *why* you cache at all (latency, database offload, cost), the two ElastiCache engines and how they differ, the canonical caching strategies (cache-aside / lazy loading, write-through, write-behind), the hard parts nobody mentions until production (invalidation, staleness, cache stampede, hot keys), Redis as far more than a cache (rate limiters, leaderboards, sessions, distributed locks), and the newer serverless / durable options. A senior answer here is never "add Redis" — it's "cache *this* data, with *this* strategy, at *this* layer, and here's how it fails."

**Mental model**

A cache is a **bet that the same data will be read many times before it changes**. The whole discipline is managing that bet: what happens on a miss, what happens on a write, and what happens when your assumption about staleness is wrong. Think of three axes. (1) **Placement** — client-side, a dedicated cache tier (ElastiCache), or in front of a specific store (DAX in front of DynamoDB, CloudFront in front of S3). Closer to the reader = faster but harder to invalidate. (2) **Strategy** — who populates the cache and when: the application on a miss (cache-aside), or the write path (write-through / write-behind). (3) **Consistency** — a cache is a second copy of the truth, so every cache decision is really a staleness-tolerance decision. Data that must never be stale (account balances at settlement) either isn't cached or is cached with invalidation you trust. Data that tolerates seconds of staleness (product catalog, a user's follower count) is the sweet spot. The senior instinct: reach for a cache to *offload* a bottleneck you've measured, not as a reflex, and always be able to answer "what's the worst thing that happens if this entry is stale?"

**Key terms**

- **ElastiCache** — managed, in-memory cache service; two engines: Redis/Valkey and Memcached. You manage nodes, AWS manages patching/failover/backups.
- **Redis vs Memcached** — Redis: rich data structures, persistence, replication, pub/sub, transactions, single-threaded core. Memcached: pure key-value, multi-threaded, simple sharding, no persistence or replication.
- **Cluster mode (Redis)** — data sharded across multiple primary shards (hash slots); enables horizontal scale and >1 node's worth of data/throughput.
- **Cache-aside (lazy loading)** — app reads cache, on miss reads DB and populates cache. Only requested data is cached.
- **Write-through** — app writes to cache and DB together, so the cache is always warm but writes are slower and you cache data that may never be read.
- **Write-behind (write-back)** — write to cache, asynchronously flush to DB; fast writes, risk of loss on node failure.
- **TTL** — time-to-live; automatic expiry that bounds staleness and is the simplest invalidation mechanism.
- **Eviction policy** — what to drop when memory is full: `allkeys-lru`, `allkeys-lfu`, `volatile-ttl`, `noeviction`, etc.
- **Cache stampede / thundering herd** — many concurrent misses on the same hot key hammer the DB simultaneously when an entry expires.
- **Hot key** — a single key receiving disproportionate traffic, saturating one shard/node.
- **DAX** — DynamoDB Accelerator; in-region, write-through, DynamoDB-API-compatible cache giving microsecond reads with an item cache + query cache.
- **MemoryDB for Redis** — Redis-compatible, *durable* (multi-AZ transaction log) database — usable as a primary store, not just a cache.
- **Hit ratio** — fraction of requests served from cache; the primary health metric for a cache tier.

**Why interviewers ask this**

Caching separates people who've operated systems from people who've only built them. Anyone can say "put Redis in front of the database"; the signal is in the follow-ups. Do you know *when* a cache makes things worse (write-heavy, low-reuse, strict-consistency data)? Can you name a concrete invalidation strategy and its failure mode? Junior answers stop at "it's faster." Senior answers reason about hit ratio, staleness budgets, stampede protection, and hot-key mitigation — and know that "cache invalidation is one of the two hard problems" is a real operational cost, not a joke. Interviewers also probe *placement*: choosing DAX vs ElastiCache vs CloudFront tells them whether you match the tool to the access pattern. Cost shows up too — a well-placed cache can cut a DynamoDB or RDS bill dramatically, and knowing that is Well-Architected cost-optimization signal.

**Common confusions**

- "Redis and Memcached are basically the same" — only for the trivial string-KV case. The moment you need atomic counters, sorted sets, pub/sub, replication, or persistence, it's Redis (or Valkey). Memcached's edge is multi-threaded simplicity and easy horizontal scale-out.
- "ElastiCache Redis is durable" — by default it's a cache; even with AOF/snapshots a failover can lose recent writes. If you need durability, that's **MemoryDB**, not ElastiCache.
- "DAX is a general-purpose cache" — no. DAX only fronts DynamoDB and speaks the DynamoDB API. You don't put arbitrary app data in it.
- "Write-through keeps the cache consistent, so I never have stale data" — it keeps *written* data fresh but says nothing about data changed by another path (batch job, second service) that bypasses the cache.
- "A higher TTL is always better because it improves hit ratio" — it also widens the staleness window and worsens stampede when many long-lived keys expire together.
- "Adding a cache always improves performance" — for write-heavy or low-reuse workloads it adds latency, cost, and a consistency problem for negative benefit.

**What follows from this topic**

Caching connects to nearly everything else. The DynamoDB topic explains the read patterns DAX accelerates and why single-digit-millisecond DynamoDB still isn't microsecond DAX. The CloudFront/CDN topic is *caching at the edge* — same discipline, different layer. Redis-as-infrastructure (rate limiters, locks, leaderboards, sessions) feeds the messaging and application-integration topics, where distributed coordination recurs. And every staleness decision here is really a **consistency** decision, tying back to the data-store consistency models. Get the mental model — a cache is a managed bet on reuse and staleness — and the specific services become implementation details.

### Q1. Why cache at all? What problems does a cache actually solve?

Three distinct wins, and you should be able to separate them:

- **Latency** — in-memory reads (microseconds for DAX, sub-millisecond for ElastiCache in-region) versus milliseconds-to-tens-of-milliseconds for a database round trip. For read-heavy paths this is the headline.
- **Database offload / throughput** — every cache hit is a query your primary database *didn't* run. This protects a bottlenecked RDS instance or a DynamoDB table from read hotspots and lets you serve far higher read QPS than the DB alone could.
- **Cost** — offloaded reads mean smaller RDS instances or fewer DynamoDB read capacity units. A cache node is often dramatically cheaper than scaling the database to absorb the same read volume.

The tradeoff you're buying: a second copy of the data (staleness risk), an extra moving part (operational complexity), and a new failure mode (what happens when the cache is down or cold?). Cache when reads dominate, the same data is reused before it changes, and some staleness is acceptable. Don't cache write-heavy, low-reuse, or strict-consistency data — you pay all the costs for little benefit.

### Q2. ElastiCache Redis vs Memcached — how do you choose?

| | Redis / Valkey | Memcached |
|---|---|---|
| Data model | Strings, hashes, lists, sets, sorted sets, streams, bitmaps, HLL | Strings (opaque blobs) only |
| Threading | Single-threaded core (per shard) | Multi-threaded (scales on vCPUs in one node) |
| Replication | Yes — read replicas, multi-AZ failover | No |
| Persistence | Snapshots + AOF | None |
| Cluster/sharding | Cluster mode (hash slots) | Client-side sharding |
| Pub/sub, transactions, Lua | Yes | No |
| Best for | Rich structures, HA, leaderboards, queues, sessions with failover | Simple, large, horizontally-sharded KV cache |

**Default to Redis/Valkey.** It's the strictly more capable engine and covers almost every real requirement — replication and multi-AZ failover alone usually decide it. Reach for **Memcached** only when you want a pure, dead-simple object cache, want to exploit multiple cores in a single large node, and genuinely need nothing beyond `get`/`set`. Note AWS now offers **Valkey** (the open-source Redis fork) on ElastiCache, typically cheaper — treat it as Redis for interview purposes.

### Q3. Explain Redis cluster mode. When do you need it, and what does it cost you?

**Cluster mode** shards your keyspace across multiple primary shards using 16,384 hash slots; each shard owns a slot range and can have its own replicas. You need it when a single node can't hold your dataset in memory, or a single primary can't sustain your write/read throughput — i.e. you've outgrown vertical scaling.

What it costs you:

- **Multi-key operations must be same-slot.** Commands touching multiple keys (transactions, `MGET`, Lua scripts) only work if the keys land in the same slot. You control this with **hash tags** — `{user123}:profile` and `{user123}:sessions` share a slot because the `{...}` portion is hashed.
- **Client complexity** — clients must be cluster-aware and follow `MOVED`/`ASK` redirects.
- **Resharding** — rebalancing slots across shards is an online operation but adds operational care.

Cluster-mode-disabled (single shard + replicas) is simpler and fine until you hit the single-node ceiling. Don't reach for cluster mode prematurely — a big single primary with replicas handles a lot.

### Q4. Walk through the cache-aside (lazy loading) pattern and its tradeoffs.

Cache-aside puts the application in charge:

```text
read(key):
  v = cache.get(key)
  if v is not None: return v          # hit
  v = db.query(key)                    # miss
  cache.set(key, v, ttl)              # populate
  return v
```

**Pros:**
- Only data that's actually requested is cached — no wasted memory on cold data.
- Cache failure is survivable — a down cache just means every read is a miss that hits the DB (slower, not broken).

**Cons:**
- **Miss penalty** — a miss costs cache-lookup + DB-query + cache-write; three hops instead of one.
- **Stale on update** — when the DB changes, the cached copy is stale until its TTL expires or you explicitly invalidate. You must add invalidation on writes.
- **Cold start / stampede** — after a flush or expiry, a burst of concurrent misses can all hit the DB for the same key (see thundering herd).

Cache-aside is the **default** strategy — most systems use it, usually paired with TTLs and explicit invalidation on write. It pairs naturally with the write path deleting or updating the key.

### Q5. Compare write-through and write-behind (write-back) caching.

**Write-through** — the write path updates cache and database synchronously (or the cache library writes both). The cache is always warm for data that's been written.
- Pros: reads after a write are always fresh from cache; no lazy-load miss penalty for recently-written keys.
- Cons: every write pays two writes; you cache data that may never be read again (wasted memory); adds write latency.

**Write-behind (write-back)** — write to the cache immediately, acknowledge, and flush to the database asynchronously in the background.
- Pros: very fast, low-latency writes; can batch/coalesce writes to the DB (good for write-heavy bursty workloads).
- Cons: **durability risk** — a cache node failure before flush loses acknowledged writes; complex to get consistency and ordering right. Rarely used with a plain ElastiCache cache precisely because it isn't durable — this is where **MemoryDB** (durable log) or an application-managed queue comes in.

In practice: cache-aside + TTL is the workhorse; write-through is a nice add-on for hot recently-written data; write-behind is a specialist tool you reach for deliberately and back with something durable.

### Q6. How do you handle cache invalidation and staleness?

There's no free lunch — pick your poison per data type:

- **TTL expiry** — simplest and most common. Set a TTL that matches your staleness budget (catalog: minutes; rarely-changing config: hours). Bounds worst-case staleness without any write-path coordination. Downside: data can be stale up to the TTL, and mass-expiry causes stampedes.
- **Explicit invalidation on write** — when the DB changes, delete (or update) the cache key in the same operation. Deleting is safer than updating (avoids caching a value that races with a concurrent read). Downside: any write path that bypasses this (batch jobs, a second service) leaves stale data.
- **Event-driven invalidation** — publish change events (DynamoDB Streams, database CDC, SNS) and have consumers invalidate. Scales to many caches and out-of-band writers, at the cost of infrastructure and eventual-consistency lag.
- **Versioned / immutable keys** — bake a version or content hash into the key (`user:123:v7`). Old versions age out via LRU; you never invalidate, you just stop referencing. Great for content that changes rarely and must never be stale.

State the staleness budget first, then choose. "How stale can this be?" drives everything.

### Q7. What is a cache stampede (thundering herd) and how do you mitigate it?

A **stampede** happens when a popular key expires (or the cache restarts cold) and many concurrent requests all miss at once, so they *all* fall through to the database simultaneously — a self-inflicted DDoS on your DB right when traffic is highest.

Mitigations, roughly in order of reach:

- **Request coalescing / single-flight** — only let one caller recompute a missing key; others wait for that result. Redis-side you can approximate this with a short-lived lock key (`SET key lock NX EX 5`) so only the lock-winner queries the DB.
- **Early / probabilistic recomputation** — refresh a key *before* it expires (e.g. XFetch: recompute with a probability that rises as TTL approaches) so the population happens under low contention, not at the expiry cliff.
- **Jittered TTLs** — add randomness to TTLs so a batch of keys written together doesn't all expire in the same instant.
- **Stale-while-revalidate** — serve the slightly-stale value while one background worker refreshes it, instead of blocking every reader.
- **Warm the cache** — pre-populate hot keys after a deploy/flush rather than letting production traffic cold-start them.

A senior answer names the *mechanism* (locking/single-flight or jitter), not just "add more cache."

### Q8. What is a hot key problem, and how do you deal with it in ElastiCache?

A **hot key** is a single key (or small set) getting a wildly disproportionate share of traffic — a viral post's like count, a global config flag, a celebrity user. In Redis cluster mode a key maps to one slot on one shard, so no amount of sharding helps: one node saturates while others idle. Redis's single-threaded core makes this worse — that one shard is CPU-bound on the hot key.

Mitigations:

- **Client-side / local caching** — cache the hot value in-process (short TTL) so most reads never reach Redis at all. Very effective for read-hot keys.
- **Key splitting / fan-out** — replicate the value across N suffixed keys (`counter:5:{shard0..N}`) and have clients read/write a random shard, then aggregate. Spreads a single logical key across many slots.
- **Read replicas** — serve reads of the hot key from replicas to spread read load (writes still bottleneck the primary).
- **Approximate / batched writes** — for hot counters, buffer increments locally and flush periodically rather than hammering one key on every event.

Detect them first: ElastiCache/CloudWatch metrics and Redis's `--hotkeys` sampling reveal skew. The design lesson: a per-shard throughput ceiling means uniform key distribution matters as much as total capacity.

### Q9. Redis is often "more than a cache." Give concrete non-cache uses.

Redis's data structures make it a general-purpose coordination and real-time engine:

- **Rate limiting** — `INCR` a per-user key with a TTL window, or a sliding-window/token-bucket via sorted sets. Atomic and fast enough to gate every request.
- **Leaderboards / rankings** — sorted sets (`ZADD`/`ZRANGE`/`ZREVRANK`) give O(log n) ranked queries; the canonical "top N players / trending posts" use case.
- **Session store** — hashes keyed by session ID with a TTL; centralized sessions let stateless app servers scale horizontally behind a load balancer.
- **Distributed locks** — `SET key val NX PX ttl` for mutual exclusion (Redlock for multi-node, with well-known caveats — don't use it for correctness-critical locking without understanding the failure modes).
- **Pub/sub and Streams** — `PUBLISH`/`SUBSCRIBE` for fire-and-forget fan-out; **Redis Streams** for a durable, consumer-group log (a lightweight Kafka-lite).
- **Deduplication / feature flags / real-time counters** — sets for "have I seen this ID," bitmaps for compact per-user flags, `HyperLogLog` for cardinality (unique visitors) in ~12 KB.

The interview point: choosing Redis is often about the *data structure*, not the caching. But note durability — for anything you can't afford to lose on a node failure, use MemoryDB or back it with a durable store.

### Q10. What is ElastiCache Serverless and when would you use it?

**ElastiCache Serverless** removes node/shard management: you create a cache, get a single endpoint, and it **auto-scales capacity** (memory and compute) up and down with your traffic, billing per GB-hour of data stored plus ECPUs (processing units) consumed. No choosing instance types, no manual sharding, no scaling operations.

Use it when:
- Traffic is **spiky or unpredictable** and you don't want to provision for peak (pay-for-what-you-use wins).
- You want to **ship fast** without capacity planning — new services, prototypes, variable workloads.
- Operational simplicity matters more than squeezing the last cent of price-performance.

Stick with **node-based (provisioned) ElastiCache** when you have steady, predictable high throughput where reserved nodes are cheaper, or when you need fine-grained control (specific instance families, custom parameter groups, precise shard topology). The tradeoff mirrors Aurora Serverless vs provisioned: convenience and elasticity vs cost-efficiency at steady high scale.

### Q11. What is MemoryDB for Redis and how is it different from ElastiCache Redis?

**MemoryDB** is a Redis-compatible, **durable, primary database** — not just a cache. The key difference is a **multi-AZ transactional log**: every write is committed to a distributed log across Availability Zones before it's acknowledged, giving you **strong consistency on the primary and durability across failures**. ElastiCache Redis, even with snapshots/AOF, is a cache — a failover can lose recent writes.

| | ElastiCache Redis | MemoryDB |
|---|---|---|
| Role | Cache (in front of a DB) | Primary durable database |
| Durability | Best-effort (snapshots/AOF) | Multi-AZ transaction log, durable |
| Consistency | Async replica lag | Strong on primary, eventual on replicas |
| Latency | Sub-ms reads/writes | Microsecond reads, single-digit-ms writes |
| Cost | Lower | Higher (you pay for durability) |

Use MemoryDB when you want Redis's data structures and speed **as your system of record** — you'd otherwise run Redis-as-cache plus a separate database and fight to keep them consistent. Use ElastiCache when a slower durable store (RDS/DynamoDB) is the source of truth and Redis is just accelerating it.

### Q12. What is DAX and how does it differ from ElastiCache in front of DynamoDB?

**DAX (DynamoDB Accelerator)** is a fully-managed, in-memory, **write-through** cache that speaks the **DynamoDB API**. You point the DAX client at your cluster instead of DynamoDB and get **microsecond** reads (vs single-digit-millisecond for DynamoDB itself) for cached items — a 10x+ latency improvement for read-heavy or bursty-hot workloads.

Two caches inside DAX:
- **Item cache** — results of `GetItem`/`BatchGetItem` keyed by primary key.
- **Query cache** — results of `Query`/`Scan` keyed by the request parameters.

Because it's **write-through**, writes go through DAX to DynamoDB and the item cache is updated, so read-after-write on the same item is consistent through DAX.

**DAX vs ElastiCache in front of DynamoDB:**
- DAX is **API-transparent** — minimal app changes, no separate serialization/invalidation logic; it's purpose-built for DynamoDB. ElastiCache needs you to hand-roll cache-aside, invalidation, and key design.
- DAX only helps **eventually-consistent reads** — strongly-consistent reads bypass the cache and go to DynamoDB. Don't cache with DAX if every read must be strongly consistent.
- ElastiCache is more flexible (arbitrary data, richer structures, cross-source data) and can be cheaper for very specific patterns, but you own the caching logic.

Rule of thumb: DynamoDB + read-heavy + eventual-consistency-OK → **DAX**. Need Redis data structures or to cache more than DynamoDB items → **ElastiCache**.

### Q13. Where in the architecture should the cache live?

Match the layer to the access pattern and staleness tolerance:

- **Client / in-process (local) cache** — fastest, zero network hop, but per-instance and hard to invalidate. Good for small, hot, slowly-changing data (feature flags, config, hot keys). Combine with a shared cache to reduce its load.
- **Dedicated cache tier (ElastiCache / MemoryDB)** — a shared cache all app instances hit. The default for application-data caching; consistent across instances, invalidatable centrally. Put it in the same VPC/AZs as your compute to keep latency sub-millisecond.
- **Database-adjacent cache (DAX)** — in front of a specific store, transparent to the app. Best when the access pattern is dominated by that one store's reads.
- **Edge / CDN (CloudFront)** — cache at the network edge, closest to the user. For static assets and cacheable HTTP responses; lowest latency for geographically distributed reads, but the coarsest invalidation.

Real systems layer these: CloudFront for static content, ElastiCache/DAX for data, and a small in-process cache for the very hottest keys. Each layer catches a class of traffic before it reaches the next; the design question is which class of data each layer should own.

### Q14. How do eviction policies work, and how do you size an ElastiCache node?

When memory fills, Redis applies the configured **eviction policy** (`maxmemory-policy`):

- **`allkeys-lru`** — evict least-recently-used across all keys. The sensible default for a general cache.
- **`allkeys-lfu`** — evict least-*frequently*-used; better when a stable hot set should survive occasional scans of cold data.
- **`volatile-lru` / `volatile-ttl` / `volatile-lfu`** — evict only among keys that have a TTL set. Useful when some keys are "persistent" and only expiring keys are evictable.
- **`noeviction`** — reject writes when full (returns errors). Right for MemoryDB/queue-like uses where silently dropping data is unacceptable, wrong for a pure cache.

**Sizing:** estimate working-set size (hot data you want resident) plus overhead. Leave **headroom** — Redis needs free memory for replication buffers, client output buffers, and (if enabled) fork-based snapshotting, which can transiently need up to ~2x during a save. `reserved-memory-percent` guards this. Undersize and you evict your hot set (hit ratio collapses) or OOM; oversize and you overpay. Monitor `Evictions`, `DatabaseMemoryUsagePercentage`, and hit ratio, and scale (bigger node, or add shards in cluster mode) when evictions climb while hit ratio falls.

### Q15. How do you measure whether a cache is doing its job?

The headline metric is **hit ratio** = hits / (hits + misses). A healthy read cache is typically well above 80–90%; a low hit ratio means you're paying for the cache and still hitting the DB — misconfigured TTLs, too-small a node (evicting the hot set), or genuinely low-reuse data that shouldn't be cached.

Read it alongside:

- **Evictions** — rising evictions with a falling hit ratio = the working set doesn't fit; scale up or out.
- **Latency (server + client)** — `GetTypeCmds`/`SetTypeCmds` latency and, crucially, end-to-end request latency. A high hit ratio that doesn't move p99 means you cached the wrong thing.
- **CPU per shard** — single-threaded Redis can be CPU-bound on one hot shard even with memory to spare (hot-key tell).
- **Database load before/after** — the offload metric: did the cache actually reduce DB read QPS / capacity consumption? That's often the real business justification (cost).
- **Connection count / memory usage %** — capacity and stability guardrails.

The senior framing: don't celebrate a high hit ratio in isolation. Tie it to the thing you were trying to fix — p99 latency, DB load, or cost. A cache that doesn't move one of those isn't earning its keep, even at 99% hits.

## Messaging & Streaming: SQS, SNS, EventBridge, Kinesis

### Summary

**What this topic covers**

The asynchronous backbone of AWS: **SQS** (queues), **SNS** (pub/sub topics), **EventBridge** (event bus + routing + scheduling), and **Kinesis** (streaming — Data Streams and Firehose), with **MSK** (managed Kafka) as the heavyweight sibling. These are the services you use to **decouple** producers from consumers, absorb bursts (backpressure), fan out events, and process high-volume streams. The 17 questions cover SQS standard vs FIFO and its knobs (visibility timeout, DLQs, polling, retention, size limits), SNS pub/sub and the SNS+SQS fan-out pattern, EventBridge vs SNS, the Kinesis family and how it compares to SQS and Kafka, and the cross-cutting concerns that decide whether an event-driven system actually works in production: ordering, idempotency, poison messages, and choosing the right service for a given scenario. The recurring senior question is not "which service" but "what are the delivery and ordering guarantees, and how does my consumer stay correct under retries?"

**Mental model**

Think along two axes: **queue vs stream**, and **point-to-point vs pub/sub**. A **queue** (SQS) is *work to be done once* — a message is consumed and deleted; each message goes to one worker; it's about distributing tasks and smoothing load. A **stream** (Kinesis/Kafka) is an *ordered, replayable log* — records persist for a retention window, many independent consumers each read at their own offset, and order is preserved per shard/partition; it's about event history and multiple views over the same firehose. **Pub/sub** (SNS/EventBridge) is *fan-out* — one event, many interested subscribers, publisher doesn't know or care who's listening. The design instinct: if consumers *compete* for work and each item is handled once, use a **queue**. If you need *replay*, *ordering*, or *many independent consumers* of the same data, use a **stream**. If one event should notify *N decoupled subscribers*, use **pub/sub**, and if that routing is rich (content filtering, schemas, SaaS sources, scheduling), reach past SNS to **EventBridge**. Everything else — visibility timeouts, DLQs, dedup — is machinery to make those guarantees hold under failure and retry.

**Key terms**

- **SQS** — managed queue; producers send, one consumer receives, processes, and deletes. Decouples and buffers.
- **Standard vs FIFO queue** — Standard: at-least-once, best-effort ordering, near-unlimited throughput. FIFO: exactly-once processing (via dedup), strict ordering per message group, limited throughput.
- **Visibility timeout** — after a receive, a message is hidden from other consumers for this window; if not deleted in time it reappears (redelivery).
- **Dead-letter queue (DLQ)** — a queue that receives messages that failed processing after `maxReceiveCount` attempts, isolating poison messages.
- **Long polling** — `WaitTimeSeconds` up to 20s; the receive call waits for a message instead of returning empty, cutting cost and empty responses vs short polling.
- **SNS** — pub/sub topics; a published message is fanned out to all subscribers (SQS, Lambda, HTTP, email, SMS).
- **Fan-out (SNS+SQS)** — SNS topic with multiple SQS queue subscribers so each consumer gets its own durable copy.
- **EventBridge** — serverless event bus with rule-based routing, content filtering, a schema registry, SaaS partner sources, and a scheduler.
- **Kinesis Data Streams** — ordered, sharded, replayable record stream; partition key routes to a shard; consumers read via KCL or enhanced fan-out.
- **Kinesis Firehose** — fully-managed delivery stream that buffers and loads data into S3/Redshift/OpenSearch, with optional transforms; no consumer code.
- **Shard / partition key** — unit of throughput and ordering in Kinesis; the partition key hashes to a shard and order is guaranteed within a shard.
- **Idempotency** — the property that processing the same message twice has the same effect as once; essential under at-least-once delivery.

**Why interviewers ask this**

Async messaging is where distributed-systems maturity shows. The give-away junior mistake is assuming exactly-once, in-order delivery everywhere and writing consumers that break on a duplicate or a reorder. Seniors internalize that **most of these services are at-least-once** and design **idempotent** consumers as a reflex. Interviewers probe whether you can (1) pick the right primitive — queue vs stream vs pub/sub — for a described scenario, (2) reason about ordering and delivery guarantees precisely (SQS FIFO's throughput cost, Kinesis per-shard ordering), and (3) handle failure — visibility timeouts, DLQs, poison messages, backpressure. This maps directly onto the reliability and performance Well-Architected pillars. A strong candidate turns a vague "process these events" prompt into concrete guarantees and failure handling; a weak one names a service and stops.

**Common confusions**

- "SQS FIFO is exactly-once delivery" — it's exactly-once *processing* within the dedup window (5 minutes) and ordering *per message group*; it's not a magic global exactly-once. And it caps throughput (300 msg/s per group, 3,000 with batching, higher with high-throughput mode).
- "SNS and EventBridge are interchangeable" — SNS is high-throughput, low-latency fan-out with simple filtering; EventBridge adds rich content-based routing, schemas, SaaS/partner sources, archive/replay, and scheduling, at higher latency and lower throughput.
- "Kinesis is just a faster SQS" — different model: Kinesis is a *replayable, ordered, multi-consumer log*; SQS is *consume-and-delete work distribution*. You choose Kinesis for replay/ordering/fan-out to many consumers, not for raw speed.
- "Visibility timeout is how long a message lives" — no; that's **retention** (up to 14 days). Visibility timeout is how long a received message is hidden before redelivery.
- "Standard SQS preserves order" — it's *best-effort*; you can and will get out-of-order and duplicate delivery. Use FIFO if order matters.
- "Firehose is a stream you write consumers against" — Firehose is *delivery* (buffer-and-load to a destination); you don't run consumers. For consumer code and replay, that's Data Streams.

**What follows from this topic**

Messaging is the connective tissue for the compute topics (Lambda event source mappings, SQS/SNS/Kinesis/EventBridge triggers), the application-integration topic (Step Functions and API Gateway often bookend these queues and streams), and any event-driven or microservices architecture. Idempotency ties back to the DynamoDB conditional-write and caching topics (dedup tables, idempotency keys). The queue-vs-stream distinction recurs whenever you design data pipelines or decouple services. Master the guarantees here and the architecture questions — "design an order-processing pipeline," "how do you decouple these services" — become a matter of naming the right primitive and its failure handling.

### Q1. Standard vs FIFO SQS queues — what's the real difference?

| | Standard | FIFO |
|---|---|---|
| Ordering | Best-effort | Strict, per message group |
| Delivery | At-least-once (dups possible) | Exactly-once processing (dedup) |
| Throughput | Nearly unlimited | 300 msg/s/group (3,000 batched); high-throughput mode much higher |
| Naming | any | must end in `.fifo` |
| Use when | Max throughput, dups/reorder tolerable | Order & no-duplicate processing matter |

**Standard** is the default: cheap, effectively unlimited throughput, but you *will* occasionally get duplicates and out-of-order delivery — so your consumer must be **idempotent** regardless.

**FIFO** guarantees strict ordering within a **message group ID** (messages with the same group ID are delivered in order; different groups are parallelizable) and exactly-once processing via a **deduplication ID** (dups within a 5-minute window are dropped). The cost is throughput and the requirement to think about group IDs. Choose FIFO only when ordering or dedup is a real requirement — e.g. a per-user command sequence — and use the group ID to preserve parallelism across independent entities.

### Q2. Explain visibility timeout and the failure it prevents (and causes).

When a consumer receives a message, SQS hides it from other consumers for the **visibility timeout** (default 30s, max 12h). The consumer is expected to process and **delete** the message within that window. If it does, the message is gone. If it crashes or takes too long, the timeout lapses and the message becomes visible again for redelivery — that's how SQS guarantees at-least-once delivery despite consumer failures.

The failure it *causes*: if your processing sometimes takes longer than the visibility timeout, the message reappears and a **second** consumer starts processing it while the first is still working — duplicate processing. Fixes:
- Set the timeout comfortably above your p99 processing time.
- **Extend it dynamically** with `ChangeMessageVisibility` (heartbeating) for variable/long jobs.
- Make processing **idempotent** so a duplicate is harmless anyway.

Too long a timeout has its own cost: if a consumer dies, that message is stuck invisible for the whole timeout before anyone retries it. Tune it to your actual processing distribution.

### Q3. What is a dead-letter queue and how do you use it well?

A **DLQ** is a separate queue you attach via a **redrive policy** with a `maxReceiveCount`. When a message has been received (and not deleted) that many times — i.e. it keeps failing — SQS moves it to the DLQ instead of redelivering forever. This isolates **poison messages** (malformed or un-processable) so they stop blocking the queue and burning consumer cycles.

Operate it like this:
- Set `maxReceiveCount` to a small number (3–5) — enough to ride out transient errors, not so many you waste effort on a doomed message.
- **Alarm** on DLQ depth (`ApproximateNumberOfMessagesVisible` > 0) — a non-empty DLQ is a bug signal.
- Inspect messages to find the root cause, then **redrive** them back to the source queue (SQS has native DLQ redrive) once you've fixed the consumer.
- Give the DLQ a *longer* retention than the source so you don't lose failures before you investigate.

DLQs exist on SQS, SNS, and Lambda/EventBridge async invokes — the pattern is universal: don't retry poison forever, quarantine and alert.

### Q4. Long polling vs short polling — which and why?

**Short polling** (the default if `WaitTimeSeconds=0`) returns immediately — even with an empty response if no message is instantly available, and it only samples a subset of SQS's servers, so you can get an empty response even when messages exist.

**Long polling** (`WaitTimeSeconds` 1–20) holds the receive call open until a message arrives or the timeout elapses, and it queries all servers.

Almost always use **long polling**:
- Fewer empty responses → **lower cost** (SQS bills per request; empty short polls are wasted API calls).
- Lower latency to *actually* get a message when one arrives (you're already waiting).
- Less consumer CPU spinning on empty receives.

Set `WaitTimeSeconds=20` unless you have a specific reason to poll faster. Short polling is only defensible when you genuinely need a non-blocking check-and-return with sub-second cadence, which is rare.

### Q5. What are the message size and retention limits, and how do you send large payloads?

- **Max message size:** 256 KB (SQS and SNS).
- **Retention:** 1 minute to 14 days (default 4 days) — how long an unconsumed message survives.
- **In-flight limit:** up to 120,000 in-flight (received, not deleted) messages for standard queues.

For payloads larger than 256 KB, use the **SQS Extended Client Library**: it stores the payload in **S3** and sends a *reference* (S3 pointer) through SQS; the receiving side transparently fetches the body from S3. Same pattern works for SNS. The alternative is to redesign so the message carries only an identifier and the consumer looks up the data — often cleaner. Don't try to base64-cram large blobs into the message; you'll hit the limit and pay for it. The senior note: keep messages small and reference large data externally — messaging systems are for *events/commands*, not bulk data transfer.

### Q6. Explain the SNS fan-out pattern and why you pair SNS with SQS.

**Fan-out** = one event, many consumers. Publish a single message to an **SNS topic**; SNS delivers a copy to every subscriber. Subscribers can be SQS queues, Lambda functions, HTTP endpoints, email, SMS, or Kinesis Firehose.

The classic robust pattern is **SNS → multiple SQS queues**:

```text
                 ┌──> SQS: billing-queue ──> billing worker
publisher ─> SNS ┼──> SQS: analytics-queue ─> analytics worker
                 └──> SQS: search-queue ────> search indexer
```

Why put SQS between SNS and each consumer instead of subscribing consumers (e.g. Lambdas) directly?

- **Durability / buffering** — each queue holds the message until its consumer is ready; a slow or down consumer doesn't lose events, and bursts are absorbed.
- **Independent retry & DLQ per consumer** — each queue has its own visibility timeout, retry count, and DLQ. One failing consumer doesn't affect the others.
- **Backpressure** — consumers drain at their own pace; SNS→Lambda direct would push at the event rate and can throttle.

This is the textbook decoupled, resilient fan-out. Use SNS-direct-to-Lambda only for simple, low-stakes notifications where per-consumer buffering isn't needed.

### Q7. When would you use SNS FIFO?

**SNS FIFO topics** provide strict ordering and deduplication for fan-out, mirroring SQS FIFO. You use them when you need **ordered, de-duplicated fan-out to multiple consumers** — e.g. a stream of per-account state changes that several downstream services must apply *in order*.

Constraints and pairing:
- SNS FIFO topics can only deliver to **SQS FIFO** queues (not standard queues, not raw Lambda/HTTP), preserving end-to-end ordering.
- Same knobs as SQS FIFO: **message group ID** for ordering scope, **deduplication ID** (or content-based dedup) for exactly-once within the 5-minute window.
- Throughput is capped like SQS FIFO (much lower than standard SNS).

The mental check: do you need ordering *and* fan-out? If you only need fan-out and can tolerate reordering, standard SNS is far higher throughput and cheaper. If you need ordering but only one consumer, an SQS FIFO queue alone suffices. SNS FIFO is specifically the intersection: ordered delivery to several consumers.

### Q8. EventBridge vs SNS — when do you use each?

Both do pub/sub fan-out, but they target different needs.

| | SNS | EventBridge |
|---|---|---|
| Model | Topics + subscriptions | Event bus + rules |
| Routing/filtering | Message-attribute filter policies | Rich content-based filtering on full event body |
| Throughput/latency | Very high, low latency | Lower throughput, higher latency |
| Schema | None | Schema registry + discovery |
| Sources | Your publishers | Your apps + AWS services + 3rd-party SaaS partners |
| Extras | — | Archive & replay, Scheduler, input transformation |
| Targets | SQS, Lambda, HTTP, email, SMS, Firehose | 20+ AWS targets (Lambda, SQS, SFN, ECS…) |

**Use SNS** when you need fast, high-fan-out, low-latency delivery with simple filtering — notifications, the SNS+SQS fan-out pattern, mobile/SMS/email push.

**Use EventBridge** when routing is the point: content-based rules that dispatch different events to different targets, integrating **SaaS partner** events (Datadog, Zendesk, etc.), enforcing **schemas**, needing **archive/replay** of events, or **scheduling** (cron/rate) invocations. It's the backbone of event-driven microservices where a central bus routes domain events. The tradeoff is throughput and latency vs routing richness. Many systems use both: EventBridge as the routing brain, SNS where raw fan-out volume matters.

### Q9. Explain Kinesis Data Streams — shards, partition keys, and ordering.

**Kinesis Data Streams** is an ordered, replayable log of records. Producers `PutRecord(s)`; each record carries a **partition key** that hashes to one of the stream's **shards**. Order is guaranteed **within a shard**, not across shards. Consumers read records in order from each shard and track their own position, so multiple independent consumer applications can read the same stream at their own pace.

- **Shard capacity:** 1 MB/s or 1,000 records/s **in** per shard; 2 MB/s **out** per shard (shared across standard consumers). Scale by adding shards (resharding / split-merge), or use **On-Demand** mode to auto-scale.
- **Partition key choice matters:** all records with the same key go to the same shard and stay ordered — good for per-entity ordering (`userId`), bad if one key is hot (hot shard, throughput limit). Poor key distribution is the classic Kinesis scaling failure.
- **Retention:** default 24 hours, extendable to 365 days — this is what makes records **replayable** (reprocess history, add a new consumer that reads from the start).
- **Consumers:** the **KCL** manages shard assignment/checkpointing across a fleet; **enhanced fan-out** gives each consumer its own dedicated 2 MB/s/shard pipe with push delivery instead of sharing the 2 MB/s.

Reach for Data Streams when you need ordering, replay, or many independent consumers over a high-volume feed.

### Q10. Kinesis Data Streams vs Firehose — what's the difference?

They solve different problems and are often used together.

| | Data Streams | Firehose |
|---|---|---|
| Purpose | Real-time, replayable stream for custom consumers | Managed **delivery** to a destination |
| Consumers | Your code (KCL/Lambda/enhanced fan-out) | None — Firehose delivers for you |
| Destinations | Whatever you build | S3, Redshift, OpenSearch, Splunk, HTTP endpoints |
| Latency | Sub-second (real-time) | Near-real-time (buffered, ~60s+ typical) |
| Replay | Yes (retention window) | No (fire-and-forget delivery) |
| Scaling | Manage shards (or On-Demand) | Fully managed, auto-scales |
| Transforms | In your consumer | Optional Lambda transform + format conversion (e.g. to Parquet) |

**Data Streams** = "I need to process records in real time, in order, possibly replay, with my own consumer logic." **Firehose** = "I just need to reliably land this data in S3/Redshift/OpenSearch, batched and maybe transformed, with zero consumer code." Firehose **buffers** by size (e.g. 5 MB) or time (e.g. 300s) then flushes. A common pipeline: producers → Data Streams (real-time processing + fan-out) → Firehose subscribed as a consumer to also archive everything to S3.

### Q11. Kinesis vs SQS vs Kafka (MSK) — how do you choose?

- **SQS** — decoupled *work distribution*. Consume-and-delete, one worker per message, no ordering (Standard) or per-group ordering (FIFO), no replay. Simplest, serverless, cheapest for task queues. Choose when items are independent jobs handled once.
- **Kinesis Data Streams** — *streaming log*. Ordered per shard, replayable (up to 365 days), multiple independent consumers, high throughput. Fully managed. Choose for real-time analytics, event sourcing, multi-consumer fan-out of a high-volume feed, when you need replay/ordering.
- **MSK (managed Kafka)** — like Kinesis but Kafka: richer ecosystem (Kafka Connect, Streams, Schema Registry, exactly-once semantics), higher throughput ceilings, portable off-AWS, longer/compacted retention. Choose when you already run Kafka, need its ecosystem/semantics, or need very high scale with fine control. Cost is more operational overhead than Kinesis (though MSK Serverless narrows this).

Decision shortcut: **task queue → SQS. Streaming/replay/multi-consumer, want managed simplicity → Kinesis. Need Kafka's ecosystem/portability/scale → MSK.** Don't default to Kafka's operational weight when SQS or Kinesis fits.

### Q12. How do you handle ordering and idempotency across these services?

**Ordering:**
- SQS **FIFO** — order within a message group ID; parallelism across groups.
- Kinesis/Kafka — order within a **shard/partition**, routed by partition key. Same key → same shard → ordered.
- SNS standard / SQS standard / EventBridge — **no ordering guarantee**; design for it.
The lever is always a *key* that scopes ordering to an entity (per-user, per-order) so you keep throughput while preserving the order that matters.

**Idempotency** (the more important half, because almost everything is at-least-once):
- Attach an **idempotency key** (message ID, business key) and record processed keys in a store (a DynamoDB table with a conditional `PutItem`/`attribute_not_exists`, or Redis with a TTL). If the key's already there, skip.
- Make the *effect* naturally idempotent where possible — upserts instead of inserts, `SET` instead of `INCR`, absolute state instead of deltas.
- Design so duplicates and (for unordered services) reorders are safe. This is non-negotiable: SQS Standard, SNS, and Kinesis (a shard split/consumer restart can redeliver) all permit duplicates.

The senior stance: assume at-least-once and reordering by default; make consumers idempotent; only pay for FIFO/ordering where the business truly requires it.

### Q13. What is a poison message and how do you deal with it?

A **poison message** is one your consumer can never successfully process — malformed payload, a reference to deleted data, a bug that always throws on that input. Left unchecked it's redelivered forever: it repeatedly fails, becomes visible again (SQS), and either blocks the queue (especially FIFO, where head-of-line blocking stalls the whole group) or endlessly burns consumer cycles and money.

Handling:
- **DLQ with `maxReceiveCount`** (SQS/SNS/Lambda) — after N failed attempts the message is quarantined to a dead-letter queue instead of retried forever. This is the primary defence.
- **Alarm** on DLQ depth so a poison message triggers investigation, not silence.
- **Catch-and-route in code** — validate early; on a permanent (non-retryable) error, explicitly move the message aside / log it and delete it rather than throwing, so you distinguish "transient, retry" from "poison, don't."
- For **FIFO**, poison messages are especially dangerous (head-of-line blocking) — a DLQ is essential so one bad message doesn't freeze an entire message group.

The principle: separate **transient** failures (retry) from **permanent** ones (quarantine). Infinite retries on a doomed message is a classic outage cause.

### Q14. Design decoupling with backpressure. How do queues protect a slow consumer?

**Backpressure** is letting a fast producer and a slow consumer coexist without overwhelming the consumer or losing data. A queue is the buffer that absorbs the mismatch.

Pattern: producer → SQS → consumer fleet (often Lambda or Auto Scaling workers).
- During a **burst**, messages accumulate in the queue instead of hammering the consumer; queue depth rises but nothing is dropped (retention up to 14 days).
- Consumers pull at their **own rate** (pull-based) — they never receive more than they ask for, unlike push systems that can overwhelm.
- **Scale consumers on queue depth** — CloudWatch `ApproximateNumberOfMessagesVisible` (or Lambda's built-in scaling) adds workers as backlog grows and removes them as it drains.
- **Protect the downstream** — if the consumer writes to a rate-limited DB/API, control Lambda **reserved concurrency** or worker count so you don't just move the overload one hop further. The queue lets you meter the flow.

Contrast with a synchronous call chain, where a slow downstream propagates latency and failures back to the caller. The queue converts a *coupled* failure into a *bounded backlog* you can drain and scale against. That's the core reliability argument for async decoupling.

### Q15. Walk through choosing a service for: real-time clickstream analytics feeding a dashboard and an S3 archive.

Reason from the requirements:
- **High volume, real-time, multiple independent consumers** (live dashboard + archival), and you may want **replay** → this is a **streaming** problem, so **Kinesis Data Streams**, not SQS. SQS's consume-and-delete and lack of replay/multi-consumer rule it out.
- **Consumer 1 (dashboard):** a Lambda or KCL app reads the stream in near-real-time, aggregates, and updates the dashboard store (e.g. DynamoDB/OpenSearch). Use **enhanced fan-out** if multiple consumers would otherwise contend for the 2 MB/s/shard read budget.
- **Consumer 2 (archive):** subscribe **Kinesis Firehose** to the same data to batch records and land them in **S3** (converting to **Parquet** for cheap Athena queries), buffering by size/time. Zero consumer code.
- **Partition key:** choose one that spreads load evenly (e.g. a high-cardinality session/user ID) to avoid hot shards, while keeping per-session events ordered if that matters.
- **Scaling:** On-Demand mode (or shard autoscaling) for unpredictable clickstream volume.

So: **Data Streams** as the real-time ordered backbone, **Firehose** for the managed S3 archive, Lambda/KCL for live aggregation. This showcases the queue-vs-stream instinct and the Data-Streams-plus-Firehose combo the interviewer is fishing for.

### Q16. What are the main event-driven architecture patterns these services enable?

- **Fan-out / pub-sub** — one event, many reactors. SNS or EventBridge to multiple targets; SNS+SQS for durable, independently-retried fan-out. Decouples producers from an evolving set of consumers.
- **Event bus / routing** — EventBridge as a central bus where services emit domain events and rules route them to interested targets. Enables adding consumers without touching producers.
- **Queue-based load leveling** — SQS between producer and consumer to absorb bursts and enable independent scaling (backpressure).
- **Streaming / event sourcing** — Kinesis/Kafka as an append-only log that's the source of truth; consumers build materialized views; replay rebuilds state. Pairs with CQRS.
- **Choreography vs orchestration** — services reacting to each other's events (choreography, via EventBridge/SNS) vs a central coordinator driving steps (orchestration, via Step Functions). Choreography scales loosely-coupled autonomy; orchestration gives visibility and explicit error handling.
- **Claim-check** — put a large payload in S3, pass a reference through the message (SQS Extended Client), consumer fetches it. Keeps messages small.
- **DLQ / retry** — quarantine failures out of the main flow for later redrive.

The unifying idea: replace synchronous coupling with events, gaining resilience and independent scaling, at the cost of eventual consistency and the need for idempotency and observability.

### Q17. What are the anti-patterns and scaling traps in AWS messaging?

- **Assuming exactly-once / in-order everywhere** — most services are at-least-once and (Standard) unordered. Non-idempotent consumers corrupt data on the first duplicate. This is the #1 trap.
- **Hot partition/shard keys** — a low-cardinality partition key in Kinesis (or message group in FIFO) funnels traffic to one shard/group, capping throughput regardless of total capacity. Choose high-cardinality keys.
- **Visibility timeout shorter than processing time** — causes duplicate processing under load; heartbeat with `ChangeMessageVisibility` or size the timeout to p99.
- **No DLQ** — poison messages retry forever, blocking FIFO groups and burning cost; always attach a DLQ and alarm on it.
- **Using FIFO for throughput-heavy workloads that don't need ordering** — you throttle yourself to 300/3,000 msg/s per group for no benefit. Only pay for FIFO when order/dedup is required.
- **Polling with short polling** — wasted empty API calls and cost; use long polling.
- **Cramming large payloads into messages** — hits the 256 KB limit; use the claim-check (S3 reference) pattern.
- **Synchronous thinking in an async system** — expecting immediate consistency, tight coupling of consumers to producers, or blocking on downstream — defeats the point of decoupling.
- **Firehose where you needed replay/real-time** (or Data Streams where you just needed managed delivery) — matching the wrong Kinesis flavor to the requirement.

Naming these — and the fix for each — is exactly the senior signal interviewers want.

## Application Integration & Orchestration: API Gateway, Step Functions, AppSync

### Summary

**What this topic covers**

The services that expose and coordinate your backend: **API Gateway** (managed front door for REST/HTTP/WebSocket APIs), **Step Functions** (serverless workflow orchestration), and **AppSync** (managed GraphQL). The 16 questions span API Gateway's three API types and when to use each, its integrations (Lambda proxy, HTTP, AWS-service, VPC link) and authorization options (IAM, Cognito, Lambda authorizers, JWT), the operational controls (throttling, usage plans, API keys, caching, request/response mapping, stages, canary), API Gateway vs ALB, Step Functions (standard vs express, state types, error handling, Map/Parallel, the saga pattern for distributed transactions, direct SDK integrations), when to orchestrate vs choreograph, and AppSync's GraphQL model with resolvers, subscriptions, and caching. The through-line: these are the **coordination and exposure** layer — the questions test whether you can put a managed, secure, observable boundary in front of compute and reliably sequence multi-step work.

**Mental model**

Two jobs live here: **exposing** an API and **orchestrating** a workflow. For **exposure**, API Gateway (and AppSync for GraphQL) is a managed proxy that handles the cross-cutting concerns you'd otherwise rebuild per service — auth, throttling, request validation, caching, TLS, mapping — so your backend stays focused on business logic. Pick the *thinnest* front door that meets the need: HTTP API if you just need a fast, cheap proxy to Lambda; REST API when you need the full toolbox (API keys, request validation, WAF, private endpoints); WebSocket for bidirectional; AppSync when the client wants GraphQL with subscriptions. For **orchestration**, the choice is *who owns the control flow*. Step Functions makes the workflow **explicit and durable** — a state machine you can see, retry, and debug, ideal for multi-step processes with error handling, human approval, or long durations. The alternative is embedding coordination in Lambda code (fine for a couple of steps, a nightmare at ten) or **choreography** via events (loose coupling, but no central view). The senior instinct: reach for orchestration when a *process* must be reliable, visible, and recoverable; reach for choreography when *services* should stay autonomous and loosely coupled; and always make long-running or retried steps **idempotent**.

**Key terms**

- **API Gateway** — managed API front door; three types: REST, HTTP, WebSocket.
- **REST API vs HTTP API** — REST: full-featured (API keys, request validation, caching, WAF, private). HTTP API: cheaper (~70% less), lower latency, fewer features.
- **Lambda proxy integration** — API Gateway passes the raw request to Lambda and returns its response verbatim; minimal config, logic lives in the function.
- **VPC link** — lets API Gateway reach private resources (an internal ALB/NLB / service) inside a VPC.
- **Lambda authorizer** — a function that runs per request to make a custom authN/authZ decision and return an IAM policy (token or request based).
- **Usage plan / API key** — throttle and quota per client; API keys identify callers and map them to a usage plan.
- **Stage** — a named deployment of an API (`dev`, `prod`) with its own config, throttling, and variables; supports **canary** traffic splitting.
- **Step Functions** — serverless orchestrator; a state machine defined in Amazon States Language (ASL).
- **Standard vs Express workflows** — Standard: durable, up to 1 year, exactly-once, per-transition billing. Express: high-volume, up to 5 min, at-least-once, per-duration billing.
- **State types** — Task, Choice, Parallel, Map, Wait, Pass, Succeed, Fail.
- **Saga pattern** — manage a distributed transaction as a sequence of steps each with a compensating action to undo prior steps on failure.
- **AppSync** — managed GraphQL: resolvers map a schema to data sources, with real-time subscriptions and server-side caching.

**Why interviewers ask this**

This topic reveals whether you can design *systems*, not just functions. Exposure questions test security and operational maturity — do you know how to authenticate, throttle, and validate at the edge instead of trusting every caller, and can you pick REST vs HTTP API on cost/feature grounds rather than habit? Orchestration questions are the real depth check: can you turn a tangle of Lambdas calling Lambdas into a visible, retryable state machine, and do you understand distributed-transaction failure (the saga pattern, compensating actions, idempotency)? The orchestration-vs-choreography question specifically separates senior architects — there's no single right answer, and the reasoning about coupling, visibility, and failure handling is the signal. It maps to operational excellence and reliability: explicit workflows are observable and recoverable; ad-hoc coordination isn't. A strong candidate matches the tool to the coordination need and always raises idempotency for retried steps.

**Common confusions**

- "Always use REST API" — HTTP APIs are cheaper and faster and cover most Lambda/HTTP proxy needs; reach for REST only when you need its specific features (API keys/usage plans, request validation, private APIs, WAF, edge-optimized).
- "Step Functions is just Lambda with extra steps" — it's *durable orchestration*: state persists across steps, built-in retry/catch, waits up to a year, visual execution history. Coordinating that in Lambda code means you rebuild all of it, badly.
- "Standard and Express workflows are interchangeable" — different guarantees, durations, and pricing. Express is at-least-once (needs idempotency) and ≤5 min; Standard is exactly-once and ≤1 year.
- "API Gateway and ALB do the same thing" — ALB is a load balancer (L7 routing to targets, cheap at high steady volume); API Gateway is an API *management* layer (auth, throttling, keys, validation, per-request pricing). Different jobs.
- "AppSync is just API Gateway for GraphQL" — AppSync natively resolves a GraphQL schema against multiple data sources and provides real-time **subscriptions**; you don't hand-build that on API Gateway.
- "Orchestration is always better than choreography" — orchestration adds a central coordinator (visibility, but coupling to it); choreography keeps services autonomous (loose coupling, but no single view). It's a tradeoff, not a ranking.

**What follows from this topic**

This layer sits on top of everything else. API Gateway and AppSync front the compute topic (Lambda, containers) and enforce the security topic's auth at the edge. Step Functions orchestrates the messaging topic's async services (it integrates directly with SQS, SNS, EventBridge, DynamoDB, and 200+ AWS APIs) and is the orchestration counterpart to EventBridge's choreography. Idempotency recurs from the messaging topic — Express workflows and any retried Task demand it. Saga and compensating transactions connect to the data-consistency discussion across DynamoDB and RDS. Master this and the big "design a system" questions resolve into: expose it safely (API Gateway/AppSync), coordinate it reliably (Step Functions or events), and make every retried step idempotent.

### Q1. REST API vs HTTP API vs WebSocket API — how do you choose?

| | REST API | HTTP API | WebSocket API |
|---|---|---|---|
| Cost | Highest | ~70% cheaper | Per-message + connection-minutes |
| Latency | Higher | Lower | — |
| Protocol | Request/response | Request/response | Bidirectional, persistent |
| Auth | IAM, Cognito, Lambda authorizers, API keys | IAM, JWT (OIDC/OAuth), Lambda authorizers | IAM, Lambda authorizers |
| Features | API keys/usage plans, request validation, caching, WAF, private, edge-optimized | Core proxying, JWT, CORS — leaner | Connection routing (`$connect`/`$disconnect`/routes) |

**HTTP API** is the modern default for simple, fast, cheap proxying to Lambda or an HTTP backend, with built-in JWT auth and CORS. Choose it unless you need something it lacks.

**REST API** when you need the full management toolbox: **API keys + usage plans**, **request/response validation and transformation (VTL)**, **response caching**, **private APIs** (VPC-only), **WAF** integration, or edge-optimized endpoints.

**WebSocket API** for bidirectional, stateful, push use cases — chat, live notifications, collaborative apps — where the server must push to clients over a persistent connection. Decide on features and cost, not habit.

### Q2. Explain API Gateway integration types.

- **Lambda proxy** — the common one. API Gateway forwards the entire request (method, path, headers, body) to Lambda as an event, and returns whatever the function outputs (with a `statusCode`/`headers`/`body` shape). Minimal config; all logic in code. Simplest and most flexible.
- **Lambda (non-proxy) / custom integration** — you use mapping templates (VTL) to transform the request into what the function expects and shape the response. More control, more config; useful for strict contracts and validation at the gateway.
- **HTTP / HTTP proxy** — forward to any HTTP endpoint (a public API or a backend), optionally transforming. Turns API Gateway into a managed reverse proxy.
- **AWS service integration** — call an AWS service API directly (e.g. drop a message into SQS, put an item in DynamoDB, start a Step Functions execution) **without a Lambda in between**. Removes a hop and its cost/latency for simple pass-throughs.
- **VPC link** — reach **private** resources (an internal ALB/NLB fronting ECS/EKS or an on-prem service) inside a VPC, so a public API can front private compute.
- **Mock** — return a canned response with no backend; handy for stubbing/CORS preflight.

The senior move: use **AWS service** or **HTTP** integrations to skip needless "glue" Lambdas.

### Q3. Walk through the authorization options for API Gateway.

- **IAM authorization** — callers sign requests with SigV4; API Gateway checks their IAM permissions. Best for **service-to-service** and internal callers already in AWS (or apps using Cognito Identity Pool credentials). No custom code.
- **Cognito User Pools** — the API validates a Cognito-issued JWT; users authenticate against the user pool and pass the token. Turnkey for user-facing auth when you use Cognito.
- **JWT authorizer (HTTP API)** — validate any OIDC/OAuth2 JWT (Cognito, Auth0, Okta, etc.) natively — issuer + audience + scopes — no Lambda needed. The clean choice for HTTP APIs with a standard IdP.
- **Lambda authorizer** — a function you write that runs per request and returns an **IAM policy** (allow/deny) plus optional context. Two flavors: **token-based** (inspect an `Authorization` token) and **request-based** (inspect headers/query/context). Use it for **custom** logic — legacy tokens, per-request entitlement checks, third-party auth. Cache the policy (by token) to avoid invoking it on every request.

Rule of thumb: standard JWT/OIDC → JWT authorizer (HTTP) or Cognito; AWS-internal callers → IAM; anything bespoke → Lambda authorizer, with caching enabled.

### Q4. How do throttling, usage plans, and API keys work together?

API Gateway protects your backend with **token-bucket throttling** at multiple levels:
- **Account/stage/method-level rate + burst limits** — steady-state requests/second plus a burst allowance. Excess gets `429 Too Many Requests`.
- **Usage plans** — attach **rate limits and quotas** (e.g. 100 req/s, 1M requests/month) to a group of clients.
- **API keys** — identify a caller; a key is associated with a usage plan so that client's traffic is metered and throttled to that plan.

Typical setup: define usage plans (`free`: 10 req/s, 10k/day; `pro`: 1,000 req/s, 10M/month), issue API keys to customers, map each key to a plan. This gives you per-customer rate limiting, quotas, and the basis for tiered/monetized APIs.

Important caveats:
- API keys are **not authentication** — they identify and meter, they don't securely authenticate. Pair them with real auth (IAM/Cognito/authorizer).
- Throttling is a **reliability control** — it shields your backend (and downstream DB) from overload and abusive clients, a Well-Architected reliability practice. Note usage plans/API keys are a **REST API** feature (HTTP APIs don't have them).

### Q5. When and how do you use API Gateway caching?

**REST API** stage caching stores endpoint responses in a managed cache (0.5 GB–237 GB) keyed by request parameters, with a configurable **TTL** (default 300s, 0–3600s). On a hit, API Gateway returns the cached response without invoking your backend.

Use it for:
- **Read-heavy, cacheable GETs** whose data tolerates some staleness (reference data, catalogs) — it cuts backend invocations (Lambda cost, DB load) and latency.

Get it right:
- **Cache key** — include the query string params / headers that vary the response; otherwise different requests collide on one cache entry.
- **Per-method TTL** and **cache invalidation** — clients can bypass with a header if granted `InvalidateCache` permission; you can flush the stage cache on deploy.
- **Don't cache authenticated, per-user, or mutating responses** unless the key fully captures the user — a classic bug is serving user A's cached response to user B.

It's a paid, provisioned cache (billed per GB-hour), so weigh cost vs the backend savings. For per-user or richer caching, an application cache (ElastiCache) or CloudFront may fit better. HTTP APIs don't offer built-in response caching — front them with CloudFront if needed.

### Q6. What are stages and how do you do safe deployments (canary) on API Gateway?

A **stage** is a named, independently-configured deployment of an API — `dev`, `staging`, `prod` — each with its own endpoint URL, throttling, caching, logging, and **stage variables** (key-value config, e.g. which Lambda alias or backend URL to call). Stage variables let one API definition point at environment-specific backends.

**Canary releases:** a stage can split traffic between the current deployment and a new **canary** — e.g. send 10% of requests to the new version while 90% stay on the stable one. You watch metrics/errors on the canary slice, then **promote** (shift 100%) if healthy or **roll back** by deleting the canary if not. Combined with **Lambda aliases + weighted versions** (via stage variables), you get end-to-end gradual rollout of both the API config and the function.

This is the operational-excellence answer: change production in small, reversible increments with a fast rollback, rather than a big-bang deploy. Pair with CloudWatch alarms on the canary to automate the go/no-go.

### Q7. What is request/response mapping (VTL) and when do you need it?

**Mapping templates** use **VTL (Velocity Template Language)** to transform the request before it reaches the backend and the response before it returns to the client — in **non-proxy** integrations. You can reshape JSON, rename/inject fields, pull values from path/query/headers, set status codes, and adapt between the client's contract and the backend's expected format.

When you need it:
- **AWS service integrations** — e.g. mapping an incoming HTTP request into the exact `SendMessage`/`PutItem`/`StartExecution` payload so you can skip a glue Lambda entirely.
- **Contract adaptation** — front a legacy backend with a clean modern API shape, or normalize responses.
- **Request validation** — reject malformed requests at the gateway (models + validation) before they cost you a Lambda invocation.

When to avoid it: VTL is powerful but **hard to test and debug**, and logic buried in templates is opaque. For anything non-trivial, most teams prefer **Lambda proxy** and do the transformation in code where it's testable. Use VTL for thin, stable mappings (especially to skip a Lambda for a simple AWS-service passthrough); use code for real logic.

### Q8. API Gateway vs ALB for fronting an API — which and why?

They overlap but solve different problems.

| | API Gateway | ALB |
|---|---|---|
| Role | API management layer | Layer-7 load balancer |
| Pricing | Per request (+ data) | Per hour + LCU (cheap at steady high volume) |
| Auth | IAM, Cognito, JWT, Lambda authorizers | OIDC/Cognito (basic), else app-level |
| Features | Throttling, API keys/quotas, request validation, caching, WAF, per-stage | Path/host routing, target groups, health checks, sticky sessions |
| Targets | Lambda, HTTP, AWS services, VPC | EC2/ECS/EKS/IP/Lambda targets in a VPC |
| Scale-to-zero | Yes (serverless) | No (always-on) |

Choose **API Gateway** when you want managed API features — authN/Z, throttling, keys/quotas, validation, caching — and especially with **Lambda** or spiky/low-baseline traffic where per-request pricing and scale-to-zero win.

Choose **ALB** when you're routing to **long-running containers/instances** (ECS/EKS/EC2) at **steady high volume**, where its hourly+LCU pricing is far cheaper than per-request, and you mainly need L7 routing and health checks rather than API management. Common hybrid: API Gateway (or CloudFront) at the edge for management, ALB inside for container fan-out. At very high, steady request volume, API Gateway's per-request cost is the deciding factor against it.

### Q9. What is AWS Step Functions and what problem does it solve?

**Step Functions** is a serverless **orchestrator**: you define a **state machine** (in Amazon States Language) whose states call services and pass data between them, and AWS runs it durably — persisting state across every transition, retrying failures, waiting (up to a year), and recording a full visual execution history.

The problem it solves is **coordinating multi-step workflows** without burying the control flow in application code. Without it, a process like "validate order → charge payment → reserve inventory → notify" becomes Lambdas invoking Lambdas, with hand-rolled retries, error handling, timeouts, and state passing — brittle, invisible, and hard to debug ("Lambda pinball"). Step Functions makes the workflow:

- **Explicit & visual** — you can *see* the graph and every execution's path, inputs/outputs, and failures.
- **Durable** — state survives; a step can wait for a callback (human approval, async job) for up to a year.
- **Resilient** — declarative `Retry`/`Catch` per state, with backoff, instead of custom code.
- **Integrated** — directly calls 200+ AWS services (Lambda, SQS, SNS, DynamoDB, ECS, EventBridge, SageMaker…) without glue code.

Use it whenever a *process* needs to be reliable, observable, and recoverable — ETL, order processing, approval flows, ML pipelines, saga transactions.

### Q10. Standard vs Express workflows — how do you choose?

| | Standard | Express |
|---|---|---|
| Max duration | 1 year | 5 minutes |
| Execution semantics | Exactly-once | At-least-once |
| Rate | ~2,000 starts/s (soft) | 100,000+ starts/s |
| Pricing | Per state transition | Per execution: duration + memory |
| History | Full visual history, 90 days | Via CloudWatch Logs (no built-in visual history) |
| Best for | Long-running, auditable, low-to-moderate volume | High-volume, short, event-processing |

**Standard** — long-running, durable, auditable workflows where you want exactly-once transitions and a visual history: order fulfillment, human-approval steps, ETL, anything spanning minutes to months. Priced per transition, so it's expensive for very high volume.

**Express** — high-throughput, short (<5 min) workflows: processing streaming/event data, IoT ingestion, quick request handling. Priced by duration, cheap at massive volume, but **at-least-once**, so steps must be **idempotent**, and there's no built-in visual history (use CloudWatch Logs). 

Decision: long or needs exactly-once/audit → **Standard**; short, high-volume, idempotent → **Express**. You can even nest an Express workflow inside a Standard one for a high-volume sub-step.

### Q11. Explain the Step Functions state types and error handling.

**State types (ASL):**
- **Task** — do work: invoke a Lambda, call an AWS service, or run an Activity. The workhorse.
- **Choice** — branch on input (if/else routing).
- **Parallel** — run multiple branches concurrently and join their results.
- **Map** — run the same steps over each item of an array, concurrently (with a configurable concurrency limit); **Distributed Map** scales to millions of items (e.g. per-object processing over S3).
- **Wait** — pause for a duration or until a timestamp.
- **Pass** — inject/transform data without doing work.
- **Succeed / Fail** — terminate the execution.

**Error handling** is declarative, per-state:
- **`Retry`** — on matching error types, retry with `IntervalSeconds`, `BackoffRate`, and `MaxAttempts` (exponential backoff built in).
- **`Catch`** — on failure (after retries exhausted), transition to a fallback state instead of failing the whole execution — e.g. route to a cleanup/compensation branch.
- Catch specific errors (`States.TaskFailed`, `States.Timeout`, custom names) and pass the error into the handler.

This replaces hand-written try/catch/retry sprawl with a visible, testable contract. Pattern: wrap risky Tasks with `Retry` for transience and `Catch` to a compensation path for permanent failure — the foundation of the saga pattern.

### Q12. How do you implement the saga pattern for distributed transactions in Step Functions?

A **distributed transaction** spans multiple services (charge payment, reserve inventory, book shipping) with no shared ACID transaction. The **saga pattern** models it as a sequence of local steps, each paired with a **compensating action** that undoes it, so that if a later step fails you run the compensations for the already-completed steps in reverse — achieving *eventual* atomicity without 2-phase commit.

In Step Functions:

```text
ChargePayment ──ok──> ReserveInventory ──ok──> BookShipping ──ok──> Succeed
     │Catch                 │Catch                  │Catch
     ▼                      ▼                       ▼
 (nothing to           RefundPayment          ReleaseInventory
  undo) → Fail              │                       ▼
                            ▼                   RefundPayment
                          Fail                       ▼
                                                    Fail
```

- Each **Task** has a **`Catch`** that routes to a compensation branch.
- The compensation branch invokes the **undo** for each prior successful step (refund the charge, release the reservation), then fails the execution cleanly.
- Compensations **must be idempotent** and should tolerate "already undone" (the step may have partially applied).

Step Functions is ideal here because it makes the compensation flow **explicit and durable** — you can see exactly where a saga failed and that its compensations ran. The alternative (choreographed sagas via events) works but scatters the logic across services with no central view.

### Q13. Step Functions vs orchestrating in Lambda vs EventBridge — when each?

- **Step Functions (orchestration)** — a **central coordinator** owns the multi-step flow: explicit sequence, built-in retry/catch, durable state, visual history, waits. Use when the *process* must be reliable, observable, and recoverable, or has branching, parallelism, long waits, or human steps. The cost is a coupling to the orchestrator and per-transition price.
- **Lambda-coded orchestration** — fine for **2–3 tightly-related steps** with trivial error handling, where a state machine is overkill. Beyond that it degrades into unobservable "Lambda pinball" with hand-rolled retries — a smell that you should have used Step Functions.
- **EventBridge (choreography)** — **no central coordinator**; services emit events and others react. Use for **loose coupling** between autonomous services/teams, where you want to add consumers without touching producers. You gain autonomy and extensibility but lose a single view of the end-to-end flow and must trace it across services.

Heuristic: a **well-defined process with error handling and visibility** → Step Functions. **Autonomous services reacting to domain events** → EventBridge. **A couple of quick steps** → just Lambda. Real systems mix them: EventBridge routes a domain event that *starts* a Step Functions workflow.

### Q14. What is AppSync and when would you use it over API Gateway?

**AppSync** is managed **GraphQL**. You define a GraphQL **schema**; **resolvers** (VTL or JavaScript) map each field to a **data source** — DynamoDB, Lambda, RDS (via Data API), OpenSearch, HTTP, or EventBridge. AppSync handles parsing, resolution, auth, and — its standout feature — **real-time subscriptions** over WebSockets, pushing updates to subscribed clients automatically.

Use AppSync over API Gateway when:
- **The client wants GraphQL** — one endpoint, clients request exactly the fields they need, and AppSync can **fan out one query to multiple data sources**, avoiding over/under-fetching and the N REST endpoints you'd otherwise build.
- **Real-time is a first-class need** — chat, live dashboards, collaborative apps — subscriptions are built in, versus hand-building a WebSocket API.
- **Mobile/offline sync** — pairs with Amplify DataStore for offline-capable clients.

Stick with **API Gateway** for REST/HTTP contracts, webhooks, simple proxying, or when consumers expect REST. AppSync also offers **auth** (API key, IAM, Cognito, OIDC, Lambda) and **server-side caching** per-resolver. The tradeoff: GraphQL's flexibility and real-time power vs REST's ubiquity and simplicity — choose by what the *client* needs.

### Q15. How do you handle idempotency and long-running work in orchestration?

**Idempotency** — retries are pervasive here (Step Functions `Retry`, Express at-least-once, API Gateway/client retries), so any step that mutates state must be safe to run twice:
- Pass an **idempotency key** (execution ID, business key) into each Task and have the downstream operation dedupe on it — e.g. a DynamoDB conditional write (`attribute_not_exists`) that no-ops on a repeat, or "charge with this idempotency key" (Stripe-style).
- Prefer naturally idempotent operations (upserts, set-absolute-state) over deltas.
- Saga compensations especially must tolerate being run when the original partly or never applied.

**Long-running work** — Step Functions is built for it: Standard workflows run up to a **year**, and the **callback pattern** (`.waitForTaskToken`) pauses a Task until an external system (a human approval, an async job, a third-party callback) returns the task token — no polling, no cost while waiting. **`Wait`** states handle time-based delays. For work that outlives a single Lambda's 15-minute limit, orchestrate it as multiple steps or hand off to a container/Batch job and wait for its callback.

The principle: assume every step can be retried and every wait can be long; design steps to be idempotent and use callbacks/waits rather than holding compute open.

### Q16. Orchestration vs choreography — how do you decide?

Both coordinate multiple services; they differ in **where the control logic lives**.

**Orchestration** — a central coordinator (Step Functions) explicitly drives the steps.
- Pros: end-to-end **visibility** (see the whole flow and where it failed), centralized **error handling** and retries, easy to reason about and modify the sequence, clear ownership of the process.
- Cons: the coordinator is a **coupling point** and can become a bottleneck/god-object; the orchestrator must know about every participant.

**Choreography** — services react to each other's **events** (EventBridge/SNS) with no central brain.
- Pros: **loose coupling** and autonomy — services (and teams) evolve independently; add a new reactor without touching producers; naturally scalable and resilient (no central dependency).
- Cons: **no single view** of the end-to-end flow — debugging means tracing events across services; emergent behavior is harder to reason about; distributed error handling (sagas) is scattered.

Decide by:
- **Process clarity & need for visibility/error handling** → orchestration (order processing, financial transactions, anything auditable).
- **Service autonomy & loose coupling across teams** → choreography (large event-driven microservice estates).

They're **complementary**: use choreography for coarse inter-domain events, and orchestration within a domain for a well-defined process — e.g. an EventBridge event triggers a Step Functions saga. The senior answer names the tradeoff (coupling vs visibility) rather than declaring a winner.
## Observability: CloudWatch, X-Ray & CloudTrail

### Summary

**What this topic covers**

How you *see* what a distributed AWS system is doing — and how you prove what it *did*. Three concern areas: (1) the **three pillars** — metrics (numeric time series), logs (event records), and traces (per-request causal chains) — mapped onto AWS services: CloudWatch Metrics, CloudWatch Logs, and X-Ray; (2) **alerting and dashboards** — CloudWatch Alarms (static, anomaly, composite), dashboards, Logs Insights queries, metric filters, and how you turn raw telemetry into an on-call signal that maps to an SLO rather than to noise; (3) **audit and compliance** — CloudTrail (who called which API), AWS Config (what did resource state look like over time and is it compliant), and the sharp distinction between *monitoring* (is it healthy right now?) and *auditing* (who did what, when, and can I prove it later?). The 16 questions span the mechanics of each service, the "which tool for which job" decisions interviewers love, and the cost traps — observability is one of the top three surprise line-items on an AWS bill.

**Mental model**

Split observability into two orthogonal questions. First, **operational health**: is the system working, and if not, where is it broken? That is metrics → alarms → traces → logs, in that order of drill-down. You alert on a metric (latency, error rate), you find the failing dependency on the X-Ray service map, and you read the logs of that specific component to get the actual exception. Second, **governance**: who did what, and does the account still comply with policy? That is CloudTrail (API-call audit trail) plus AWS Config (resource-configuration history and compliance rules). The trap juniors fall into is treating CloudTrail as a monitoring tool — it is an *audit* log, delivered with delay, not a real-time alerting stream. The other core idea is **correlation**: a single request should be findable across all three pillars via a shared trace ID, so an alarm leads you to a trace which links to the exact log lines. Observability that can't correlate is just three separate haystacks.

**Key terms**

- **Metric** — a namespaced, dimensioned numeric time series (e.g. `AWS/EC2` `CPUUtilization` per `InstanceId`). Standard resolution = 1-minute; high resolution = 1-second.
- **Namespace / dimension** — namespace groups metrics (`AWS/Lambda`); dimensions are key-value filters (`FunctionName=checkout`) that identify a specific stream.
- **EMF (Embedded Metric Format)** — structured JSON log lines that CloudWatch auto-extracts into metrics; the cheap way to emit custom metrics from Lambda without a separate API call.
- **Alarm** — evaluates a metric against a threshold (static/anomaly/composite) over N datapoints, transitions between OK / ALARM / INSUFFICIENT_DATA, and triggers actions (SNS, Auto Scaling, EC2 action).
- **Log group / log stream** — a log group is a retention+permission boundary; a stream is an ordered sequence within it (one per instance/container).
- **Metric filter** — a pattern over log events that increments a CloudWatch metric (e.g. count of `ERROR` lines) so you can alarm on log content.
- **Logs Insights** — a query language over log groups for ad-hoc investigation (`fields`, `filter`, `stats`, `parse`).
- **Subscription filter** — near-real-time stream of matching log events to Lambda / Kinesis / Firehose for custom processing or centralisation.
- **X-Ray segment / subsegment** — a segment is one service's work on a request; subsegments are downstream calls (DynamoDB, HTTP) within it. The service map is built from these.
- **Sampling** — X-Ray records a *fraction* of requests (default 1 req/sec + 5% of the rest) to control cost and overhead.
- **CloudTrail management vs data events** — management events (control-plane API calls, e.g. `RunInstances`) are on by default and free for one copy; data events (S3 object-level `GetObject`, Lambda `Invoke`) are high-volume and paid.
- **AWS Config** — records resource configuration over time and evaluates compliance rules; answers "what did this look like last Tuesday and is it compliant".

**Why interviewers ask this**

Observability separates people who *build* systems from people who *operate* them. A junior signals by listing services ("CloudWatch does metrics and logs"). A senior signals by reasoning about the *workflow*: which pillar you reach for first during an incident, how you keep alert noise down, and — critically — the cost model, because naive observability (1-second metrics on everything, infinite log retention, 100% X-Ray sampling, data-event logging on a hot bucket) can cost more than the workload it watches. The CloudTrail-vs-CloudWatch distinction is a favourite discriminator: candidates who conflate audit with monitoring get filtered fast. The strongest signal is tying alarms to SLOs/SLIs rather than to arbitrary resource thresholds.

**Common confusions**

- "CloudTrail is for monitoring" — no; it's an *audit* log of API calls, delivered with minutes of latency. Use CloudWatch for real-time health. You *can* route CloudTrail to CloudWatch Logs to alarm on specific API calls, but that's a bridge, not CloudTrail's purpose.
- "CloudWatch gives me memory and disk on EC2 for free" — it does not. Host-level CPU/network are free, but **memory and disk usage require the CloudWatch Agent** publishing custom metrics.
- "Metrics and logs are the same data" — metrics are pre-aggregated numeric series (cheap to store/query long-term); logs are raw events (expensive at volume). Alarm on metrics, investigate with logs.
- "X-Ray traces every request" — sampling means it traces a fraction by default; a rare error may not be captured unless you tune sampling rules.
- "Config and CloudTrail are redundant" — CloudTrail says *who made the API call*; Config says *what the resource state became and whether it's compliant*. You want both for a full audit story.
- "Longer log retention is safer" — it's mostly *more expensive*. Set retention deliberately (log groups default to never-expire, which silently accumulates cost).

**What follows from this topic**

Observability underpins every reliability and operations story. It links to **IaC & CI/CD** (alarms and dashboards as code; deployment rollback triggered by CloudWatch alarms in CodeDeploy), to **Security Services** (GuardDuty and Config findings feed the same alerting pipeline; CloudTrail is the security audit backbone), and to compute topics (Auto Scaling and Lambda concurrency are driven by CloudWatch metrics). If you can't observe a system, you can't operate, secure, or scale it — so treat this as the connective tissue rather than a bolt-on.

### Q1. What are the three pillars of observability and how do they map to AWS services?

The three pillars are **metrics**, **logs**, and **traces** — each answers a different question.

| Pillar | Question it answers | AWS service | Data shape |
|---|---|---|---|
| Metrics | "Is something wrong, and how bad?" | CloudWatch Metrics | Aggregated numeric time series |
| Logs | "What exactly happened in this component?" | CloudWatch Logs | Raw timestamped events |
| Traces | "Where in the request path is the problem?" | AWS X-Ray | Per-request causal chain across services |

The incident workflow uses all three in order: a **metric** alarm fires (p99 latency up), the **trace** service map shows *which* dependency got slow, and the **logs** of that component give the actual error. Metrics are cheap and long-lived (good for alarms and trends); logs are expensive at volume (good for detail); traces show causality across service boundaries that neither metrics nor logs can reconstruct. "Observability" specifically means you can answer *novel* questions from this telemetry without shipping new code — the correlation between the three (shared trace/request IDs) is what makes that possible.

### Q2. Explain CloudWatch metric namespaces, dimensions, and resolution.

A metric is identified by **namespace + name + dimensions**.

- **Namespace** — a container that groups related metrics. AWS services use `AWS/<Service>` (e.g. `AWS/EC2`, `AWS/Lambda`); your custom metrics use any namespace you choose (e.g. `Acme/Checkout`).
- **Dimensions** — up to 30 key-value pairs that scope a metric to a specific resource (e.g. `InstanceId=i-0abc`, `FunctionName=checkout`). Each unique combination of dimensions is a *separate* metric — this matters for cost, because custom metrics are billed per metric (per unique namespace+name+dimension combination).
- **Resolution** — standard resolution stores 1-minute granularity; **high-resolution** metrics store down to 1-second (published with `StorageResolution=1`). High resolution costs more and is only worth it for fast-reacting alarms (e.g. scaling on a spiky workload).

Retention is automatic and tiered: 1-second data is kept ~3 hours, 1-minute for 15 days, 5-minute for 63 days, 1-hour for 15 months — CloudWatch aggregates older data to coarser granularity rather than deleting it, so long-term trends survive but fine detail doesn't.

Anti-pattern: putting a **high-cardinality** value (like a user ID or request ID) into a dimension. That explodes the number of billed custom metrics and is exactly what logs (or EMF) are for.

### Q3. What is the Embedded Metric Format (EMF) and why use it?

EMF lets you emit **metrics *as* structured log lines**, and CloudWatch automatically extracts the numeric values into metrics — no separate `PutMetricData` API call.

You write a JSON log line containing an `_aws` metadata block that declares which fields are metrics and their dimensions:

```json
{
  "_aws": {
    "Timestamp": 1700000000000,
    "CloudWatchMetrics": [{
      "Namespace": "Acme/Checkout",
      "Dimensions": [["Service"]],
      "Metrics": [{"Name": "OrderLatency", "Unit": "Milliseconds"}]
    }]
  },
  "Service": "checkout",
  "OrderLatency": 142,
  "orderId": "abc-123"
}
```

Why it wins, especially in Lambda:

- **No extra API call / latency** — `PutMetricData` is a synchronous network round-trip in your critical path; EMF just writes to stdout (which Lambda already ships to CloudWatch Logs).
- **Metrics + context in one place** — the same line carries the metric *and* high-cardinality context (`orderId`) you can query with Logs Insights, without paying to make `orderId` a metric dimension.
- **Cheaper at scale** — one log line vs one metric API call per event.

Use the `aws-embedded-metrics` library rather than hand-rolling the JSON.

### Q4. How do CloudWatch Alarms work — static, anomaly detection, and composite?

An alarm watches a metric (or metric math expression) and transitions between three states — **OK**, **ALARM**, **INSUFFICIENT_DATA** — based on M-out-of-N datapoints crossing a threshold.

- **Static threshold** — classic: `CPUUtilization > 80% for 3 of 3 datapoints`. Simple and predictable; brittle for metrics with daily/weekly seasonality.
- **Anomaly detection** — CloudWatch trains a band model on the metric's history; the alarm fires when the value leaves the expected band (`> 2 std deviations`). Good for seasonal metrics (traffic that's naturally low at 3am) where a fixed threshold is wrong at some times of day.
- **Composite** — combines other alarms with boolean logic (`ALARM(A) AND ALARM(B)`). Used to **cut noise**: only page if the error-rate alarm *and* the latency alarm are both firing, or suppress child alarms during a known dependency outage.

Alarm **actions** target SNS (→ email/PagerDuty/Lambda), Auto Scaling policies, or EC2 actions (stop/terminate/reboot). Critically, configure **missing-data treatment** (`missing`, `notBreaching`, `breaching`, `ignore`) — a Lambda that stops being invoked emits *no* datapoints, and the wrong setting either hides a dead function or pages you for an idle one. Senior tip: alarm on the SLI that maps to user pain (error rate, latency), not on proxy resource metrics (CPU) that don't reliably indicate an outage.

### Q5. Explain CloudWatch Logs: log groups, streams, retention, and metric filters.

- **Log group** — the unit of retention, access control, and encryption. One per application/component (e.g. `/aws/lambda/checkout`). Retention is a group-level setting.
- **Log stream** — an ordered sequence of events within a group, typically one per source (an EC2 instance, an ECS task, a Lambda execution environment).
- **Retention** — **defaults to "Never Expire"**, which is the #1 silent cost leak. Set it explicitly (1 day … 10 years). Storage is billed per GB-month plus ingestion per GB — long retention on chatty logs adds up fast.
- **Metric filters** — a pattern applied to incoming log events that increments a CloudWatch **metric** (e.g. count occurrences of `"ERROR"` or extract a latency number). This is how you *alarm on log content*: metric filter counts `5xx` lines → alarm on that metric. Metric filters only apply to logs ingested *after* the filter is created.

For cost control at scale, ship raw logs to S3 (via subscription filter → Firehose) for cheap long-term storage and query with Athena, keeping CloudWatch retention short for hot investigation.

### Q6. What is CloudWatch Logs Insights and when do you use it?

Logs Insights is an **interactive query language** over one or more log groups — for *ad-hoc investigation*, not standing alerts.

```
fields @timestamp, @message, latency, orderId
| filter status = 500
| stats count() as errors by bin(5m)
| sort errors desc
| limit 20
```

Key operators: `fields`, `filter`, `parse` (regex extract from unstructured lines), `stats` (aggregate), `sort`, `limit`. It automatically discovers fields from JSON logs, which is why **structured (JSON) logging** pays off — you can `filter status = 500` instead of grepping strings.

When to use it vs alternatives:

- **Logs Insights** — "why did checkout fail for these users in the last hour" — exploratory, scoped, you pay per GB *scanned* per query.
- **Metric filter + alarm** — a *known* recurring signal you want to page on. Cheaper for repeated evaluation than re-running a query.
- **Athena/OpenSearch** — very large volumes or cross-account/long-retention analytics; move logs to S3 first.

Cost note: Insights bills on data scanned, so tight time ranges and specific log groups matter.

### Q7. What are subscription filters and what do you use them for?

A subscription filter delivers matching log events from a log group in **near real time** to a destination for further processing:

- **Lambda** — custom processing/alerting on each event.
- **Kinesis Data Streams / Firehose** — buffer and fan out; the standard way to **centralise logs** from many accounts into a security/observability account or into S3/OpenSearch.
- **Cross-account** destinations via a destination ARN.

Typical uses: aggregating all org logs into one account for a SIEM, real-time transformation before landing in a data lake, or triggering remediation when a specific pattern appears. One "live" subscription filter per log group historically (the limit has since increased, but keep it simple). Contrast with **metric filters** (which produce a metric to alarm on) and **export tasks** (batch one-time dump to S3) — subscription filters are the *streaming* path.

### Q8. Do you get EC2 memory and disk metrics by default? Explain the CloudWatch Agent.

**No.** Out of the box, CloudWatch collects only what the *hypervisor* can see: CPU utilisation, network I/O, disk *I/O at the volume level*, and status checks. **Memory usage, memory-backed swap, disk *space* used, and per-process metrics are invisible from outside the guest OS** — they require software running *inside* the instance.

That software is the **CloudWatch Agent** (the modern unified agent, replacing the old CloudWatch Logs agent + collectd scripts). It:

- Publishes **custom metrics** for memory, disk usage, and per-process stats (billed as custom metrics).
- Ships **log files** from the instance to CloudWatch Logs.
- Can scrape StatsD and collectd, and Prometheus metrics.
- Is configured via a JSON config (often distributed through SSM Parameter Store) and deployed/managed with SSM.

Interview trap: candidates who say "I'll alarm on EC2 memory" without mentioning the agent reveal they haven't run production EC2. Same gap applies to on-instance disk-full alarms.

### Q9. Explain AWS X-Ray: segments, subsegments, service map, and sampling.

X-Ray is **distributed tracing** — it reconstructs a single request's path across multiple services.

- **Segment** — one service's slice of work for a request (e.g. the API Gateway → Lambda handler). Carries timing, annotations, and metadata.
- **Subsegment** — a downstream call *within* a segment: a DynamoDB query, an HTTP call to another service, an SQS publish. Subsegments give you the latency breakdown *inside* a service.
- **Service map** — X-Ray stitches segments across services (via a propagated trace ID) into a visual dependency graph with per-edge latency and error rates. This is what lets you say "checkout is slow because the payments service's DynamoDB call regressed" in seconds.
- **Sampling** — to bound cost and overhead, X-Ray records a *subset* of requests. Default rule: 1 request/second (the reservoir) plus 5% of everything above that. You define custom sampling rules to capture more of a specific route or error class.

The trace ID propagates via the `X-Amzn-Trace-Id` header (and equivalents for SQS/SNS), which is what ties the segments together. **Annotations** are indexed key-values you can filter traces by (e.g. `customerId`); **metadata** is unindexed context. (AWS is steering new work toward the OpenTelemetry-based **ADOT / CloudWatch Application Signals**, but the X-Ray model — segments, subsegments, service map, sampling — is what interviews test.)

### Q10. How does trace context propagation work across services and async boundaries?

For tracing to stitch a request together, every hop must **forward the trace ID**. Synchronously, that's the `X-Amzn-Trace-Id` HTTP header — API Gateway generates or forwards it, the Lambda/ECS SDK reads it, and each outbound call re-sends it. The X-Ray SDK (or OpenTelemetry/ADOT) instruments the AWS SDK and common HTTP clients so this is mostly automatic.

The hard part is **async boundaries**, where there's no HTTP header:

- **SQS/SNS** — the trace header is carried in message system attributes; X-Ray links producer and consumer if instrumented. Beware that SQS batching and long queue dwell time can make the trace timeline confusing (queue wait shows as latency).
- **EventBridge / Kinesis** — propagation is weaker; you often carry a correlation ID in the payload yourself and rely on annotations to join traces.
- **Step Functions** — integrates with X-Ray to trace the whole state machine.

Practical guidance: standardise on one trace/correlation ID, propagate it through *both* the tracing system *and* your structured logs (log the trace ID on every line). That's what lets an alarm → trace → logs drill-down actually work across sync and async hops.

### Q11. CloudTrail vs CloudWatch — what's the difference and when do you use each?

They answer fundamentally different questions.

| | CloudWatch | CloudTrail |
|---|---|---|
| Purpose | **Monitoring** — is it healthy/performing? | **Auditing** — who called which API, when? |
| Data | Metrics, logs, traces | API-call records (identity, source IP, params, response) |
| Timeliness | Real-time (seconds) | Minutes of delay; not for real-time alerting |
| Primary consumer | On-call / SRE / autoscaling | Security, compliance, forensics |
| Retention | Metric/log retention settings | Event history 90 days; trail to S3 for years |

CloudTrail records the *control plane* (and optionally data plane) — e.g. "IAM user `alice` called `DeleteBucket` on `my-bucket` from IP x at time y." You use it for forensics ("who deleted the security group?"), compliance evidence, and detecting suspicious API activity. You *can* bridge them — send CloudTrail events to CloudWatch Logs and set a metric filter + alarm on, say, `DeleteTrail` or root-account usage — but CloudTrail itself is not a monitoring system. If an interviewer asks "how do you find who terminated an instance," the answer is CloudTrail, not CloudWatch.

### Q12. Explain CloudTrail management events vs data events, org trails, and log file integrity.

- **Management events** — control-plane operations: creating/modifying/deleting resources, IAM changes, config changes (`RunInstances`, `AttachRolePolicy`). **On by default**, and one copy is free. This is your baseline audit.
- **Data events** — data-plane, object-level, high-volume operations: S3 `GetObject`/`PutObject`, Lambda `Invoke`, DynamoDB item-level API. **Off by default and paid** because volume is enormous. Enable selectively (e.g. data events only on a sensitive bucket), or the bill and log volume explode.
- **Org trail** — a single trail defined in the AWS Organizations management account that captures events from **all member accounts** into one central S3 bucket. Standard practice — you don't want per-account trails you have to remember to configure.
- **Log file integrity validation** — CloudTrail can produce **digest files** (SHA-256 hashes, signed) so you can *prove* logs weren't tampered with after delivery — essential for the audit chain of custody. You validate with `aws cloudtrail validate-logs`.

Best practice: org trail → dedicated, locked-down logging account S3 bucket, with **S3 Object Lock / MFA delete** and integrity validation on, so even a compromised admin can't quietly erase the trail.

### Q13. AWS Config vs CloudTrail — how do they differ and when do you need Config?

They're complementary halves of governance.

- **CloudTrail** = the **verb**: *who made which API call*. Point-in-time events.
- **AWS Config** = the **state**: *what configuration each resource had over time, and whether it's compliant*.

AWS Config continuously records resource configurations, builds a **configuration timeline** (you can see exactly what a security group's rules were last Tuesday), and evaluates **Config Rules** (managed or custom Lambda) that flag non-compliant resources — e.g. "S3 bucket is public," "EBS volume unencrypted," "security group allows 0.0.0.0/0 on port 22." It can **auto-remediate** via SSM Automation documents.

You need Config specifically when:

- You must **prove continuous compliance** (PCI/SOC2/HIPAA) — "show me every time a resource drifted from encrypted."
- You want **drift/compliance dashboards** across the org (aggregators roll up multiple accounts/regions).
- You need to answer "*what did this resource look like* at the time of the incident," which CloudTrail's call log alone can't reconstruct.

Rule of thumb: CloudTrail catches the *action*, Config catches the *resulting state and its compliance*. Serious environments run both, feeding **Security Hub**.

### Q14. What are CloudWatch Synthetics canaries and RUM, and how do they differ?

Both measure the *user's* experience, from opposite ends.

- **Synthetics canaries** — **synthetic (active) monitoring**. Scripted Node/Python (Puppeteer/Selenium) "canaries" run on a schedule from AWS, hitting your endpoints or clicking through a user flow, and emit availability/latency metrics plus screenshots on failure. They catch outages **before** real users do and work even at 3am with zero traffic. Use for critical paths (login, checkout heartbeat) and API health.
- **RUM (Real User Monitoring)** — **passive monitoring**. A JS snippet in your web app reports *actual* users' page-load times, Core Web Vitals, JS errors, and geography/browser breakdown. It reflects reality (real networks, real devices) but only tells you about paths users actually take, and only when there's traffic.

They're complementary: canaries give you deterministic, always-on coverage and early warning; RUM gives you real-world performance distribution and error rates you can't script. Canary failures make great composite-alarm inputs ("page only if the checkout canary is failing *and* error rate is up").

### Q15. Design an alerting strategy tied to SLOs. How do you avoid alert fatigue?

Start from **SLIs/SLOs**, not from resources. Define what "working" means to the user — e.g. SLI = fraction of checkout requests served < 500ms with a 2xx; SLO = 99.9% over 30 days. That yields an **error budget** (0.1% ≈ 43 min/month). Alert on **burn rate** of that budget, not on raw CPU.

Concretely:

- **Page** only on user-facing symptoms with fast burn (multi-window, multi-burn-rate alarms: e.g. 2% budget burned in 1 hour → page; slower burn → ticket, not a page). Implement with metric-math + composite alarms.
- **Symptom over cause** — alarm on error rate/latency (the symptom), not on the 12 possible causes (CPU, memory, queue depth). Causes go on the *dashboard* for drill-down, not the pager.
- **Composite alarms** to suppress noise — don't page for a downstream alarm when the parent dependency is already known-down.
- **Missing-data handling** — decide explicitly so a dead component pages and an idle one doesn't.
- **Runbook per alert** — if an alert has no action, delete it. Every page should map to "here's what to do."

The failure mode to name in an interview: alarming on every resource metric produces so many pages that on-call ignores them, and the real outage gets lost. Fewer, symptom-based, SLO-linked alerts beat comprehensive resource coverage.

### Q16. What does observability cost, and how do you keep the bill sane?

Observability is billed on **volume**, and naive setups can rival the workload's own cost. The main levers:

- **Custom metrics** — billed per metric (unique namespace+name+dimensions) per month. High-cardinality dimensions (user IDs, request IDs) explode this. Use **EMF** and put high-cardinality context in *logs*, not dimensions.
- **High-resolution metrics** — 1-second resolution costs more than 1-minute; only use it where a fast alarm truly needs it.
- **Logs ingestion + storage** — billed per GB ingested and per GB-month stored. Set **retention** (default is never-expire — a silent leak), drop debug logs in prod, and archive to **S3** (cheap) via subscription filter for long-term, querying with Athena instead of paying CloudWatch retention.
- **Logs Insights** — billed per GB **scanned per query**; scope time ranges and log groups.
- **X-Ray** — billed per trace recorded/retrieved; **sampling** is your cost control — you rarely need 100%.
- **CloudTrail data events** — high volume and paid; enable only on sensitive resources.

Senior framing: right-size observability like any other resource — full fidelity on critical paths, sampled/short-retention elsewhere. The Well-Architected cost-optimisation pillar applies to telemetry too, and "we log everything forever at 1-second resolution" is a red flag, not diligence.

## Security Services: KMS, Secrets Manager, WAF, Shield, GuardDuty, Cognito

### Summary

**What this topic covers**

The AWS-managed services that implement the **security** pillar of Well-Architected — encompassing both *preventive* controls (stop the bad thing) and *detective* controls (notice the bad thing). Three concern areas: (1) **data protection** — KMS for encryption keys and envelope encryption, Secrets Manager vs SSM Parameter Store for secrets, and ACM for TLS certificates (encryption in transit vs at rest); (2) **edge and network defence** — WAF for application-layer (L7) filtering, and Shield Standard/Advanced for DDoS (L3/L4) protection, on CloudFront/ALB/API Gateway; and (3) **threat detection and identity** — GuardDuty (behavioural threat detection), Macie (PII discovery in S3), Inspector (vulnerability scanning), Security Hub (aggregation and posture/CSPM), and Cognito (user authentication and federated identity). The 16 questions cover the mechanics of each, the "which service for which problem" mapping interviewers probe, and how these compose into **defence in depth** rather than a single silver bullet.

**Mental model**

Two axes organise everything here. First, **preventive vs detective**: KMS, WAF, Shield, Secrets Manager, IAM, security groups *prevent*; GuardDuty, Macie, Inspector, CloudTrail, Config *detect*. You need both — prevention fails, and detection is how you find out. Second, the **layers you're defending**: network/DDoS (Shield), application L7 (WAF), identity/access (IAM, Cognito), data at rest (KMS), data in transit (ACM/TLS), and secrets (Secrets Manager). A real architecture stacks these — an attacker must beat every layer, and each is cheap insurance against the failure of the one below it. The single most important primitive is **envelope encryption**: KMS doesn't encrypt your terabytes directly (that would be slow and expensive) — it protects small *data keys* that encrypt your data locally, which is how nearly all AWS encryption ("SSE-KMS," EBS encryption, RDS encryption) actually works under the hood. Understanding that unlocks most KMS questions.

**Key terms**

- **KMS CMK / KMS key** — a managed encryption key. Three ownership types: **AWS-owned** (invisible, free, AWS's own), **AWS-managed** (`aws/service`, auto-created per service, free, AWS controls rotation), **customer-managed** (you create, set key policy, control rotation — the one you pay for and audit).
- **Envelope encryption** — encrypt data with a locally-generated **data key**, then encrypt that data key with a KMS key; store the encrypted data key alongside the ciphertext. KMS only ever handles the small key.
- **Key policy vs IAM policy** — a KMS key's *resource* policy (key policy) is the root of its access control; IAM policies grant use *only if* the key policy allows it. Grants are a third, temporary, fine-grained mechanism.
- **Secrets Manager** — stores secrets with **built-in automatic rotation** (via Lambda) and fine-grained access; billed per secret + per API call.
- **SSM Parameter Store** — hierarchical config/secret store; standard params free, `SecureString` uses KMS; rotation is **not** built in.
- **WAF (Web ACL)** — L7 firewall of **rules** (IP match, rate-based, SQLi/XSS, geo, managed rule groups) attached to CloudFront, ALB, API Gateway, or AppSync.
- **Shield Standard vs Advanced** — Standard is free, automatic L3/L4 DDoS protection for all AWS; Advanced is paid, adds L7 protection, cost-protection, and the DDoS Response Team (DRT/SRT).
- **GuardDuty** — continuous threat detection analysing CloudTrail, VPC Flow Logs, and DNS logs (plus optional S3/EKS/malware) for anomalies; produces **findings**.
- **Macie** — ML-based discovery and classification of **sensitive data (PII)** in S3.
- **Inspector** — automated **vulnerability scanning** of EC2, ECR container images, and Lambda for CVEs and network exposure.
- **Security Hub** — aggregates findings from GuardDuty/Inspector/Macie/Config into one place; runs **CSPM** posture standards (CIS, AWS FSBP).
- **Cognito user pool vs identity pool** — user pool = an authentication directory (sign-up/in, returns JWTs); identity pool (federated identities) = exchanges an identity token for **temporary AWS credentials**.
- **ACM** — provisions and auto-renews TLS certificates for encryption in transit on ALB/CloudFront/API Gateway.

**Why interviewers ask this**

Security is where seniority shows most starkly, because the *defaults* are usually insecure-until-configured, and the failure modes are catastrophic and irreversible (a leaked key, an exfiltrated bucket). Juniors name services; seniors reason about **layering, blast radius, and cost tradeoffs** — e.g. why Shield Advanced's DDoS *cost protection* can be worth $3k/month, when Secrets Manager's rotation justifies its per-secret cost over free Parameter Store, or how key policies gate IAM. The "which of these overlapping services solves my problem" mapping (GuardDuty vs Macie vs Inspector vs Security Hub) is a favourite, because a candidate who can't disentangle them will misconfigure them. The strongest signal is designing **defence in depth** and knowing which controls are preventive vs detective.

**Common confusions**

- "KMS encrypts my data" — it mostly encrypts *data keys* (envelope encryption); your data is encrypted locally by those data keys. KMS caps at 4 KB of direct payload.
- "IAM alone controls KMS key access" — no; the **key policy** is authoritative. An IAM allow does nothing if the key policy doesn't also permit it.
- "Secrets Manager and Parameter Store are interchangeable" — Parameter Store `SecureString` is free-ish but has **no built-in rotation**; Secrets Manager costs more but rotates automatically. Choose on rotation need and cost.
- "WAF stops DDoS" — WAF is L7 filtering (SQLi, bots, rate limits); volumetric L3/L4 DDoS is **Shield's** job. They overlap only at the L7 flood boundary.
- "GuardDuty/Macie/Inspector do the same thing" — GuardDuty = behavioural threat detection, Macie = PII discovery in S3, Inspector = CVE/vuln scanning. Different inputs, different questions.
- "Cognito user pool and identity pool are one thing" — user pool authenticates *who you are* (returns JWTs); identity pool exchanges that for *temporary AWS credentials* to call AWS services directly.

**What follows from this topic**

Security ties into nearly everything: **Observability** (CloudTrail is the audit backbone; GuardDuty/Config findings flow into Security Hub and your alerting pipeline), **IaC & CI/CD** (secrets in pipelines, encryption and WAF rules deployed as code, Inspector in the build), IAM and networking (key policies, VPC endpoints, security groups), and storage (SSE-KMS on S3/EBS/RDS). Treat these services as the enforcement layer for the policies IAM expresses — and remember that the cheapest security is the layered, boring kind applied by default.

### Q1. Explain the three types of KMS keys and when each applies.

KMS keys differ by **who owns and controls them**:

| Type | Who controls it | Visible to you | Rotation | Cost |
|---|---|---|---|---|
| **AWS-owned** | AWS (shared across accounts) | No — not in your account | AWS | Free |
| **AWS-managed** (`aws/<service>`) | AWS, per-service, in your account | Yes (view only) | AWS, automatic (yearly) | Free (usage API calls billed) |
| **Customer-managed (CMK)** | You | Yes, fully | You choose (auto or manual) | ~$1/month + API calls |

**AWS-owned** keys back "encryption on by default" where you never see the key (e.g. some S3 default encryption). Zero control, zero cost, zero audit visibility.

**AWS-managed** keys (like `aws/s3`, `aws/rds`) are auto-created the first time you enable encryption for that service. Convenient, free, but you **can't edit the key policy** or use them cross-account, and rotation/scheduling is out of your hands.

**Customer-managed keys** are the ones you reach for when you need: your own **key policy**, **cross-account** sharing, **grants**, manual rotation control, imported key material, or **CloudTrail auditing of every use**. They cost ~$1/month each plus per-request charges. Rule of thumb: use CMKs for anything regulated or requiring key-level audit/isolation; AWS-managed for convenience where you don't need control.

### Q2. What is envelope encryption and why does KMS use it?

Envelope encryption means you **encrypt data with a data key, then encrypt the data key with a KMS key** — wrapping one key inside another like an envelope.

The flow (`GenerateDataKey`):

1. Ask KMS for a data key. KMS returns it **twice**: once in plaintext, once encrypted under your KMS key.
2. Encrypt your data *locally* with the plaintext data key (fast, no size limit), then **discard the plaintext key** from memory.
3. Store the **encrypted** data key next to the ciphertext.
4. To decrypt: send the encrypted data key to KMS (`Decrypt`), get the plaintext key back, decrypt your data locally.

Why KMS works this way:

- **Performance & size** — KMS can only directly encrypt ≤ 4 KB and every call is a network round-trip. You can't stream a 5 GB object through it. Envelope encryption keeps the bulk crypto local and only sends the tiny key to KMS.
- **Security** — the master key never leaves KMS (backed by FIPS 140-2 HSMs); only data keys transit, and plaintext data keys are ephemeral.
- **Key rotation without re-encrypting data** — rotating the KMS key re-wraps data keys, not the terabytes underneath.

Every "SSE-KMS," EBS/RDS encryption, and the AWS Encryption SDK use this pattern.

### Q3. KMS key policies vs IAM policies vs grants — how does access control actually work?

Access to a KMS key is governed by up to three mechanisms, and the **key policy is the root of trust**:

- **Key policy** (resource policy on the key) — *authoritative*. Unlike most AWS resources, if the key policy doesn't grant access (directly or by delegating to IAM), **no IAM policy can grant it**. The default key policy delegates to the account root, which then lets IAM policies work — omit that delegation and IAM is powerless over the key.
- **IAM policies** — grant principals `kms:Encrypt`/`Decrypt`/etc., but **only take effect if the key policy allows IAM to** (via the `"AWS": "arn:aws:iam::ACCOUNT_ID:root"` delegation). So it's key policy *AND* IAM.
- **Grants** — temporary, programmatic, fine-grained delegations (often used by AWS services on your behalf, e.g. an EBS grant). Good for time-bounded or narrowly-scoped access without editing the key policy; revocable.

The gotcha that locks people out of their own keys: writing a restrictive key policy that removes the root-account delegation. There's no "break glass" — you'd need AWS Support. Best practice: keep the root delegation, use IAM/grants for day-to-day access, and add `kms:GrantIsForAWSResource`/condition keys to scope service use.

### Q4. Symmetric vs asymmetric KMS keys, and multi-region keys — when do you use each?

**Symmetric keys** (AES-256) are the default and cover ~95% of use cases: the same key encrypts and decrypts, the key material never leaves KMS, and all the envelope-encryption integrations (S3, EBS, RDS, Secrets Manager) use them. Prefer symmetric unless you have a specific need for the alternative.

**Asymmetric keys** (RSA or ECC key pairs) expose a **public key you can distribute**, so a party *without* KMS access can encrypt-to-you or verify a signature. Use them for: encryption by external clients that can't call KMS, or **digital signing/verification** (signing artefacts, JWTs) where you want the private key to never leave KMS. Downside: slower, more limited integration, and you manage the public key distribution.

**Multi-region keys** are a set of keys in different regions sharing the **same key ID and key material**, so ciphertext encrypted in one region can be decrypted in another *without a cross-region KMS call*. Use them for: cross-region **disaster recovery**, active-active multi-region apps, and global data replication (e.g. DynamoDB global tables, S3 CRR of encrypted objects). The tradeoff is a weaker isolation boundary — the same key material now exists in multiple regions, so a regional blast-radius argument for separate keys is lost. Default to single-region keys unless you genuinely replicate encrypted data across regions.

### Q5. How does KMS key rotation work — automatic vs manual?

- **Automatic rotation** — enable it on a customer-managed symmetric key and KMS generates **new backing key material once a year** (configurable interval since 2024) while keeping the **same key ID and ARN**. Old material is retained so previously-encrypted data still decrypts — you never re-encrypt anything. It's transparent to applications. AWS-managed keys rotate automatically (yearly) with no action from you.
- **Manual rotation** — you create a **brand-new key** (new key ID/ARN) and update aliases/apps to use it. You must keep the old key enabled to decrypt old data, and re-encrypt data if you truly want to retire the old key. This is the path for **asymmetric keys** and **imported key material** (which don't support automatic rotation), or when compliance mandates a *new key ID*.

Key subtlety: automatic rotation rotates the *backing material*, not the key identity — so it satisfies "rotate keys annually" audits without any data migration, but if your requirement is literally "issue a new key," you need manual rotation with alias re-pointing. Rotation does **not** re-encrypt existing ciphertext; it only affects *new* encryptions.

### Q6. Secrets Manager vs SSM Parameter Store — when do you use each?

Both store secrets encrypted with KMS; they differ on rotation, cost, and scope.

| | Secrets Manager | SSM Parameter Store |
|---|---|---|
| Built-in rotation | **Yes** — Lambda-driven, native RDS/Redshift/DocDB integration | **No** (roll your own) |
| Cost | ~$0.40/secret/month + API calls | Standard params **free**; `SecureString` free; Advanced tier paid |
| Size limit | 64 KB | 4 KB (standard), 8 KB (advanced) |
| Cross-account/resource policy | Yes | Limited |
| Generate random secret | Yes (`get-random-password`) | No |
| Best for | DB creds, API keys needing **rotation** | App config, feature flags, secrets without rotation |

Decision rule:

- **Use Secrets Manager** when you need **automatic rotation** (database credentials are the canonical case — it rotates and updates the secret atomically), cross-account secret sharing, or generated secrets. The per-secret cost buys you not writing/maintaining rotation Lambdas.
- **Use Parameter Store** for the long tail of configuration and low-sensitivity secrets, especially at high count where per-secret pricing would hurt. `SecureString` gives you KMS encryption for free.

Hybrid is common: config in Parameter Store, rotated credentials in Secrets Manager (which can even be *referenced* from Parameter Store via the `/aws/reference/secretsmanager/` path). Don't pay Secrets Manager pricing for hundreds of static config values, and don't hand-roll rotation you could get for $0.40.

### Q7. Explain AWS WAF — web ACLs, rules, managed rule groups, and rate limiting.

WAF is a **layer-7 (HTTP/HTTPS) firewall** you attach to CloudFront, ALB, API Gateway, AppSync, or Cognito. The unit of deployment is a **Web ACL** containing an ordered list of **rules**, each of which inspects requests and does `Allow`, `Block`, `Count`, or `CAPTCHA/Challenge`.

Rule types:

- **IP set / geo match** — allow/block by IP CIDR or country.
- **String / regex / size / SQLi / XSS match** — inspect URI, headers, body, query string for injection patterns and malformed input.
- **Rate-based rules** — block a source IP that exceeds N requests in a 5-minute sliding window (basic app-layer flood/brute-force protection).
- **Managed rule groups** — pre-built, AWS-maintained or **Marketplace** (e.g. AWS Managed Rules Core rule set, Known Bad Inputs, admin protection, anonymous IP list, plus vendor rules). These give you OWASP-style coverage without hand-writing signatures.

Rules evaluate in priority order; first terminating action wins. A common structure: allow-list your own IPs → block known-bad managed groups → rate-limit → default allow. Use **Count mode** first to measure a rule's impact before switching it to Block (avoids accidentally blocking legitimate traffic). WAF logs go to CloudWatch/S3/Firehose for tuning. WAF is L7 only — it will not stop a volumetric L3/L4 flood (that's Shield).

### Q8. Shield Standard vs Advanced — what do you get and is Advanced worth it?

**Shield Standard** is **free and automatic** for every AWS account — it defends against common **L3/L4 volumetric DDoS** (SYN floods, reflection attacks) at the network edge (CloudFront, Route 53, ELB). You get it whether you know it exists or not; no config.

**Shield Advanced** is a **paid subscription (~$3,000/month, 1-year commit, plus data transfer)** that adds:

- **L7 (application-layer) DDoS protection** with more sophisticated detection and automatic WAF rule application.
- **DDoS cost protection** — AWS refunds the scaling/data-transfer charges incurred *because* of a DDoS (autoscaling spikes, ELB/CloudFront usage) — often the real justification, since a big attack can otherwise generate a huge surprise bill.
- **DDoS Response Team (DRT / SRT)** — 24/7 access to AWS DDoS experts who help mitigate during an attack.
- **Global/enhanced visibility**, health-based detection, and protection grouping across resources.
- WAF included at no extra charge on protected resources.

Is it worth it? For most workloads, **no** — Standard + WAF + CloudFront is enough. Advanced makes sense for high-value, internet-facing, attack-prone targets (gaming, finance, high-profile brands, regulated availability SLAs) where the **cost-protection refund and expert support** justify $36k/year. The interview-worthy point: you buy Advanced primarily for *L7 protection, cost insurance, and the response team* — not because Standard doesn't protect L3/L4 (it does).

### Q9. What is GuardDuty and what does it detect?

GuardDuty is a **managed threat-detection service** that continuously analyses account and network activity for malicious or anomalous behaviour — no agents, no infrastructure. It ingests, without you configuring log delivery:

- **CloudTrail management (and optionally S3 data) events** — anomalous API usage (e.g. credentials suddenly used from a new country, disabling security services).
- **VPC Flow Logs** — traffic to known-bad IPs, unusual ports, crypto-mining patterns.
- **DNS query logs** — resolution of malware/C2 domains.
- Optional add-ons: **S3 protection, EKS/runtime protection, Malware Protection (EBS scan), RDS/Lambda protection**.

It applies ML baselining plus AWS/third-party **threat intelligence** to produce **findings** — typed, severity-scored alerts like `UnauthorizedAccess:EC2/SSHBruteForce`, `Recon:IAMUser/*`, `CryptoCurrency:EC2/BitcoinTool.B`, `Exfiltration:S3/*`. Findings flow to EventBridge (→ automated remediation via Lambda) and to **Security Hub** for aggregation.

Its value is being **enable-in-one-click, org-wide, low-false-positive** detection you'd otherwise build with a SIEM. It's purely **detective** — it tells you something's wrong, it doesn't block. You pair it with automated response (isolate the instance, revoke the key) via EventBridge. Interview contrast: GuardDuty watches *behaviour/logs*; Inspector scans for *vulnerabilities*; Macie classifies *data*.

### Q10. Distinguish Macie, Inspector, and Security Hub.

These three are frequently confused; each answers a different question.

| Service | Question it answers | Input | Output |
|---|---|---|---|
| **Macie** | "Where is my sensitive data (PII/PHI/secrets)?" | **S3** objects (ML classification) | Sensitive-data findings, bucket risk posture |
| **Inspector** | "Are my compute resources vulnerable?" | **EC2, ECR images, Lambda** | CVE/vulnerability + network-reachability findings |
| **Security Hub** | "What's my overall security posture?" | **Aggregates** GuardDuty/Inspector/Macie/Config + partners | Prioritised, deduped findings + **CSPM** compliance scores |

- **Macie** discovers and classifies sensitive data in S3 — it'll flag a bucket full of credit-card numbers or credentials, and surface public/unencrypted/shared buckets. Data-protection focused.
- **Inspector** (v2) continuously scans EC2, container images in ECR, and Lambda for known **CVEs** and unintended network exposure, scoring findings so you patch the exploitable-and-reachable ones first. Vulnerability-management focused.
- **Security Hub** is the **single pane of glass** — it ingests findings from GuardDuty, Inspector, Macie, Config, and third parties into a normalised format (ASFF), deduplicates, and runs **CSPM** posture checks against standards (CIS Benchmark, AWS Foundational Security Best Practices, PCI). It's where you *manage* the aggregate, not a detector itself.

Mental shortcut: **Macie = data, Inspector = vulns, GuardDuty = threats/behaviour, Security Hub = the aggregator and compliance scorer.**

### Q11. Cognito user pools vs identity pools — what's the difference?

Cognito has two distinct components that solve two different problems, and mixing them up is a classic tell.

- **User pool** = **authentication (authN) — a user directory**. It handles sign-up, sign-in, MFA, password policies, hosted UI, and federation with social/SAML/OIDC IdPs (Google, Apple, corporate SSO). On success it issues **JWTs** (ID token, access token, refresh token). Think "the login system for *your* app's users." Your API (e.g. API Gateway with a Cognito authorizer, or an ALB) validates those JWTs.
- **Identity pool** (a.k.a. **federated identities**) = **authorization to AWS — credential exchange**. It takes a proof of identity (a Cognito user-pool token, or a Google/Facebook/SAML token) and exchanges it for **temporary, limited AWS credentials** (via STS) tied to an IAM role. Think "let a signed-in mobile user upload directly to *their* S3 prefix or write to DynamoDB" without a backend proxying every call.

You often use **both together**: user pool authenticates the user → its token is fed to the identity pool → identity pool returns scoped AWS creds. Identity pools also support **guest (unauthenticated) roles** for anonymous access. Summary: user pool = *who are you* (JWTs for your app), identity pool = *here are temporary AWS keys scoped to your identity*.

### Q12. Encryption in transit vs at rest, and how does ACM fit in?

They protect data in two different states:

- **At rest** — data sitting in storage (S3, EBS, RDS, DynamoDB, snapshots, backups). Protected by encrypting it on disk, almost always via **KMS/SSE** (envelope encryption). Threat model: someone gets the disk/snapshot/bucket but not the keys.
- **In transit** — data moving over a network (client↔ALB, service↔service, app↔RDS). Protected by **TLS**. Threat model: someone on the network path sniffs or MITMs the traffic.

You need **both** — encrypting at rest does nothing for a sniffed connection, and TLS does nothing for a stolen snapshot. Serious environments enforce at-rest encryption by default (Config rules, bucket policies denying unencrypted `PutObject`) and TLS-only (bucket policy `aws:SecureTransport = false → Deny`).

**ACM (AWS Certificate Manager)** is the in-transit enabler: it **provisions, stores, and auto-renews** public TLS certificates for free, and deploys them to CloudFront, ALB, API Gateway, and App Runner — eliminating manual cert renewal (the classic "prod went down because the cert expired" outage). ACM public certs can't be exported (they live on AWS-integrated endpoints); for certs you need on EC2/on-prem, use ACM Private CA or import. So: **KMS = at rest, ACM/TLS = in transit**, and both are table stakes for the security pillar.

### Q13. Preventive vs detective controls — give examples and explain why you need both.

- **Preventive controls** stop a bad action from happening: IAM policies (deny by default), SCPs, security groups/NACLs, KMS encryption, WAF rules, Shield, MFA, S3 Block Public Access, resource policies. They're your first line — they reduce the *probability* of a breach.
- **Detective controls** notice when something bad has happened (or a preventive control failed): CloudTrail, GuardDuty, Config rules, Security Hub, Macie, Inspector, CloudWatch alarms, VPC Flow Logs. They reduce *time-to-detect* and give you the audit trail.

Why both, always: **prevention is never perfect**. A misconfigured bucket policy, a leaked long-lived key, a zero-day, an over-permissive role, an insider — every preventive control has a failure mode, and the ones that fail silently are the dangerous ones. Detective controls are how you find out *before* the attacker is done. There's also a third bucket — **responsive/corrective** controls (EventBridge → Lambda auto-remediation, Config auto-remediation, isolating a compromised instance) — that acts on what detection finds.

The senior framing is **defence in depth across the control types**: assume any single control fails, layer preventive controls so an attacker must beat several, and back them with detective controls so a failure is caught and corrected quickly. "We have IAM, we're secure" (prevention only, no detection) is the answer that fails an interview.

### Q14. What is a VPC endpoint's security role, and how do you keep traffic off the public internet?

Keeping traffic private is a preventive control that shrinks your attack surface. By default, an instance in a private subnet reaching S3, DynamoDB, or another AWS API goes out via a NAT gateway to the **public** AWS endpoints — traversing the internet edge and requiring egress.

**VPC endpoints** keep that traffic on the AWS network:

- **Gateway endpoints** (S3, DynamoDB only) — a route-table entry; free. Traffic to S3/DynamoDB never leaves the AWS backbone.
- **Interface endpoints (PrivateLink)** — an ENI with a private IP in your subnet for most other AWS services (and third-party/your own services); hourly + data cost. Traffic stays private and you can even disable public access to the service.

Security benefits and controls:

- **No internet exposure** — no NAT/IGW needed for those calls; data doesn't transit the public internet.
- **Endpoint policies** — attach a resource policy to the endpoint to restrict *which* buckets/actions can be reached through it, and use `aws:sourceVpce` conditions in **bucket policies** to deny access *except* via your endpoint — a strong control against data exfiltration to attacker-controlled accounts.

This composes with encryption in transit (TLS still applies) and at rest, and with security groups on interface endpoints. It's the network-layer piece of defence in depth for data access.

### Q15. Design layered security for a public-facing web app (defence in depth).

Walk the request from the edge inward, applying a control at each layer:

**Edge / network (L3-L4)** — Front with **CloudFront** + **Shield** (Standard free; Advanced if high-value) to absorb volumetric DDoS and terminate TLS close to users using an **ACM** cert. Route 53 with health checks for failover.

**Application (L7)** — Attach **WAF** to CloudFront/ALB: AWS managed rule groups (SQLi/XSS/known-bad-inputs), **rate-based rules** for brute-force/flood, geo/IP allow-lists, bot control. Run new rules in Count mode first.

**Identity & access** — **Cognito** (or your IdP) for user authN issuing JWTs; API Gateway/ALB authorizers validate them. Backend services assume **least-privilege IAM roles** (no long-lived keys); enforce MFA and SCPs org-wide.

**Compute & data** — Private subnets, **security groups** as stateful allow-lists (only the ALB can reach app, only app can reach DB), **VPC endpoints** to keep AWS-API traffic private. **KMS/SSE** encryption at rest on S3/RDS/EBS; **TLS everywhere** in transit. Secrets in **Secrets Manager** with rotation — never in env vars/code.

**Detection & response** — **GuardDuty** (threat detection), **Config** (compliance/drift), **Inspector** (CVE scanning of images), **Macie** (PII in S3), all aggregated in **Security Hub**; **CloudTrail** org trail to a locked logging account. **EventBridge → Lambda** auto-remediation (isolate instance, revoke key) on high-severity findings.

The theme: **assume each layer can be breached**, so every layer has both a preventive control and a detective backstop, and no single misconfiguration is game-over.

### Q16. Your S3 bucket with sensitive data was accessed by an unexpected principal. Walk the investigation and hardening.

**Investigate (detective controls):**

1. **CloudTrail** — query data events (if enabled on this bucket) and management events: *which principal*, from *what IP/role*, *when*, and *what actions* (`GetObject`, `ListBucket`). If data events weren't on, you have management-plane context only — a lesson to enable them on sensitive buckets.
2. **GuardDuty** — check for `Exfiltration:S3` / `UnauthorizedAccess` findings and anomalous-access alerts on that bucket; it may already have flagged it.
3. **Access analysis** — run **IAM Access Analyzer** to see what external/cross-account principals *can* reach the bucket, and review the **bucket policy**, ACLs, and any presigned URLs or access points.
4. **Macie** — confirm what sensitive data actually lives there to scope the blast radius.

**Contain & harden (preventive controls):**

- **Revoke the access path** — tighten/rescind the offending bucket policy statement or IAM permission; rotate any leaked credentials/keys; invalidate presigned URLs by rotating the signing key/role.
- **Enable S3 Block Public Access** (account + bucket) if not already.
- **Enforce encryption + TLS** — SSE-KMS with a CMK (so key-policy access is separately auditable/revocable), and a bucket policy denying `aws:SecureTransport=false` and denying access except via your **VPC endpoint** (`aws:sourceVpce`).
- **Least privilege** — scope IAM to specific prefixes/actions; prefer roles over long-lived keys.
- **Turn on data-event logging + Object Lock** for the audit trail going forward.

**Follow-up:** wire **EventBridge → Lambda** to auto-remediate future GuardDuty S3 findings, add a **Config rule** to catch public/unencrypted buckets, and feed everything to **Security Hub**. The narrative to convey: detect with the audit/threat services, contain by cutting the access path and rotating creds, then harden with layered preventive controls so it can't recur silently.

## Infrastructure as Code & CI/CD

### Summary

**What this topic covers**

How you define, version, and safely deploy AWS infrastructure and application changes *as code* rather than by clicking in the console — the operational-excellence pillar of Well-Architected. Three concern areas: (1) **infrastructure as code (IaC)** — CloudFormation (templates, stacks, change sets, drift, nested stacks, StackSets), the CDK (constructs that synthesise to CloudFormation), Terraform on AWS (state, backends, tradeoffs vs CFN), and SAM for serverless; (2) **CI/CD pipelines** — the AWS Code* suite (CodePipeline, CodeBuild, CodeDeploy, CodeCommit) and modern alternatives (GitHub Actions), plus artifact stores (ECR, CodeArtifact, S3); and (3) **deployment safety** — rolling, blue/green, and canary strategies on ECS/Lambda/EC2, CodeDeploy lifecycle hooks and automatic rollback, immutable infrastructure, environment/account separation, secrets in pipelines, testing IaC, and GitOps. The 16 questions move from "why IaC" through the mechanics of each tool to senior scenarios about safe, auditable, low-blast-radius delivery across many accounts.

**Mental model**

Two ideas anchor everything. First, **infrastructure is code you can review, version, test, and roll back** — the same discipline you apply to application code applies to the platform it runs on. That means Git as the source of truth, pull requests as the change-control gate, and *no manual console changes* (which cause **drift** — the real infrastructure diverging from the declared template). Second, **deployments are risk events, and the whole job of CI/CD is to shrink the blast radius of a bad change** — through gradual rollout (canary/blue-green), automated verification (health checks, alarms, tests), and **automatic rollback** so a bad deploy self-heals in minutes rather than paging a human at 3am. The unifying theme is **declarative + immutable**: describe the desired end state, let the tool converge to it, and replace resources rather than mutate them in place — because a fleet of identically-built, throwaway instances is far easier to reason about, secure, and roll back than a set of hand-patched pets.

**Key terms**

- **CloudFormation (CFN)** — AWS's native declarative IaC; a **template** (YAML/JSON) describes resources, deployed as a **stack** (the managed unit you create/update/delete atomically).
- **Change set** — a preview/diff of what a stack update will do *before* you execute it — the "dry run" that prevents surprise replacements.
- **Drift detection** — CFN comparing the actual resource state to the template to find out-of-band (console/manual) changes.
- **Nested stacks vs StackSets** — nested = stacks-within-a-stack for modularity in *one* account/region; **StackSets** = deploy the same stack across **many accounts/regions** from a management account.
- **Intrinsic functions** — CFN built-ins (`!Ref`, `!GetAtt`, `!Sub`, `!If`, `Fn::ImportValue`) for wiring values between resources/stacks.
- **CDK** — define infra in a real language (TypeScript/Python/etc.) using **constructs** (**L1** raw CFN, **L2** sensible-defaults resources, **L3** patterns); `cdk synth` compiles to a CloudFormation template.
- **SAM** — a CFN transform/CLI specialised for serverless (Lambda/API GW/DynamoDB) with local testing.
- **Terraform state** — Terraform's record of managed resources; on AWS, stored in an **S3 backend with DynamoDB state locking**.
- **CodePipeline / CodeBuild / CodeDeploy** — orchestration / build+test / deployment-to-compute stages of the AWS CI/CD suite.
- **Deployment strategies** — **rolling** (replace in batches), **blue/green** (stand up a parallel environment, cut traffic over), **canary** (shift a small % first, then the rest).
- **CodeDeploy hooks** — lifecycle event scripts (`BeforeAllowTraffic`, `AfterAllowTraffic`, validation hooks) that gate and verify a deployment, enabling automatic rollback.
- **Immutable infrastructure** — never patch a running server; build a new image/version and replace it.
- **GitOps** — Git is the single source of truth; a controller continuously reconciles real state to what's declared in the repo.

**Why interviewers ask this**

CI/CD and IaC are where "can this person operate a system safely at scale" gets tested. Juniors describe deploying by hand or a single `cloudformation deploy`; seniors reason about **blast radius, rollback, and multi-account governance** — how a bad change is caught *before* it hits all users, how you deploy the same guardrails across 40 accounts, and how you keep secrets out of build logs. Favourite discriminators: CloudFormation vs Terraform tradeoffs (state management, provider ecosystem, drift, lock-in), when CDK earns its complexity over raw CFN, and how blue/green and canary actually work on ECS/Lambda with CodeDeploy. The strongest signal is treating deployment as a **safety-engineering** problem — change sets, automated rollback on CloudWatch alarms, environment/account separation — rather than a scripting problem.

**Common confusions**

- "CloudFormation and Terraform are basically the same" — both are declarative IaC, but CFN is AWS-only with AWS-managed state and native drift; Terraform is multi-cloud with **self-managed state** (S3+DynamoDB) and a huge provider ecosystem. The tradeoffs are real and worth articulating.
- "The CDK is a different way to deploy" — no; CDK **synthesises to CloudFormation** and deploys via it. It's a higher-level *authoring* layer, not a separate engine.
- "Blue/green and canary are the same" — blue/green flips *all* traffic to a fully parallel environment (fast, clean rollback); canary shifts a *percentage* first and observes before completing. Different risk/cost profiles.
- "Rolling deployments give clean rollback" — they don't; you're mutating the live fleet in place, so rollback means another rolling deploy. Blue/green rolls back by flipping traffic back instantly.
- "Change sets are optional cosmetic" — they're your guard against CFN silently *replacing* a resource (e.g. an RDS instance) and destroying data. Read them.
- "Secrets can live in the pipeline config" — never; inject at runtime from Secrets Manager/Parameter Store, never bake into images or echo into build logs.

**What follows from this topic**

IaC and CI/CD are the delivery mechanism for everything else in this primer. It links to **Observability** (deploy dashboards/alarms as code; CodeDeploy rolls back on a CloudWatch alarm), **Security Services** (encryption, WAF, IAM, and Config rules defined and enforced as code; Inspector and secret-scanning in the build; least-privilege pipeline roles), multi-account governance (StackSets + Organizations + SCPs), and every compute topic (how ECS/Lambda/EC2 actually get their new versions). Master this and you can ship *any* of the earlier services safely, repeatably, and reversibly — which is the whole point.

### Q1. Why use Infrastructure as Code at all? What problems does it solve?

IaC replaces click-ops with **declarative, version-controlled definitions** of your infrastructure, and it solves several concrete problems:

- **Repeatability & consistency** — spin up identical dev/staging/prod (or a new region) from the same template. Eliminates "works in staging, breaks in prod" caused by config drift between hand-built environments.
- **Version control & review** — infra changes go through Git + pull requests, so you get history ("who added that open security group and why"), code review, and blame — the same change control as application code.
- **Auditability & compliance** — the repo *is* the record of what should exist; combined with drift detection you can prove and enforce the declared state.
- **Rollback** — a bad change is a `git revert` + redeploy, not a frantic manual reconstruction.
- **Disaster recovery** — rebuild an entire environment from code if a region/account is lost.
- **Speed & self-service** — teams provision via templates/modules instead of ticketing an ops team.

The failure mode it eliminates is the **hand-built snowflake**: infrastructure nobody can reproduce, whose config lives only in someone's memory and the console. The moment infra is code, it inherits testing, review, and reproducibility — which is why "no manual console changes in prod" is a mature-org rule.

### Q2. Explain CloudFormation core concepts: templates, stacks, and change sets.

- **Template** — a declarative YAML/JSON document describing the resources you want (`Resources:` section) plus `Parameters`, `Mappings`, `Conditions`, `Outputs`, and `Metadata`. It expresses *desired end state*, not steps.
- **Stack** — a deployed instance of a template; the **unit of management**. Create/update/delete operate on the whole stack atomically — CFN provisions resources in dependency order, and on failure **rolls the stack back** to the last good state. Delete a stack and (subject to deletion policies) it tears down everything it created — no orphaned resources.
- **Change set** — a **preview** of what an update will do before you execute it: which resources are added, modified, or — critically — **replaced** (replacement can destroy data, e.g. renaming an RDS instance's identifier). You create the change set, *read the diff*, then execute or discard.

The workflow that separates pros from amateurs: never `update-stack` blind on production — generate a **change set**, review it (especially "Replacement: True" rows), and only then execute. CFN also tracks resource dependencies via intrinsic functions so it orders and parallelises provisioning correctly, and its rollback-on-failure behaviour means a botched update generally leaves you where you started rather than half-deployed.

### Q3. What is drift detection and why does it matter?

**Drift** is when the *actual* state of a resource diverges from what its CloudFormation template declares — almost always because someone made an **out-of-band change** in the console or via CLI (opened a security-group port, changed an instance type, edited a policy) instead of updating the template.

**Drift detection** is CFN comparing live resource properties against the template and reporting each resource as `IN_SYNC` or `MODIFIED/DELETED`, with the specific property differences.

Why it matters:

- **The template stops being the source of truth** — your "code" no longer describes reality, so reviews and DR rebuilds are based on a lie.
- **Silent breakage on next deploy** — the next `update-stack` may *revert* the manual fix (or fail), causing a surprise outage, or CFN may refuse because it can't reconcile.
- **Security & compliance gaps** — a manually-widened security group won't show up in code review because it isn't in code.

Mature practice: **detect drift on a schedule** (or via Config rules / AWS Config's `cloudformation-drift-detection`), alarm on it, and treat any drift as an incident — either codify the change (update the template) or revert it. The deeper fix is *preventing* drift: lock down console write access in prod (SCPs, read-only roles) so the only path to change infra is through the pipeline. GitOps takes this further with continuous reconciliation.

### Q4. Nested stacks vs StackSets — what's the difference and when do you use each?

They solve different scaling problems.

| | Nested stacks | StackSets |
|---|---|---|
| Purpose | **Modularity** within one deployment | **Distribution** across many targets |
| Scope | One account, one region | **Many accounts and/or regions** |
| Structure | A parent stack that references child stacks as resources | A single definition deployed to N target accounts/regions |
| Driven by | `AWS::CloudFormation::Stack` resources | AWS Organizations / admin+target roles |
| Use for | Breaking a big template into reusable components (a VPC module, a DB module) reused across your stacks | Rolling out the *same* baseline everywhere — guardrails, IAM roles, Config rules, GuardDuty enablement org-wide |

**Nested stacks** let you decompose a monolithic template into maintainable, reusable pieces (a networking child stack, a security child stack) that a parent orchestrates — the values flow via `Outputs` and `!GetAtt`. It's about *code organisation* in a single environment.

**StackSets** are about *fan-out*: from a management account you deploy one stack definition into dozens of accounts and multiple regions in one operation, with controlled rollout (concurrency, failure tolerance) and **automatic deployment to new accounts** that join the Organization. This is the standard mechanism for landing-zone guardrails — deploy the baseline IAM roles, logging config, and Config rules to every account without touching each one.

Rule of thumb: **nested = build one thing from parts; StackSets = deploy one thing to many places.**

### Q5. What is the AWS CDK and how do constructs (L1/L2/L3) relate to CloudFormation?

The **CDK (Cloud Development Kit)** lets you define infrastructure in a **general-purpose programming language** (TypeScript, Python, Java, Go, C#) instead of raw YAML. You write code, run `cdk synth`, and it **synthesises a CloudFormation template**, which `cdk deploy` then deploys via CloudFormation. So CDK is an *authoring* layer on top of CFN — the engine underneath is still CloudFormation (same stacks, change sets, drift, rollback).

**Constructs** are the building blocks, at three levels of abstraction:

- **L1 (Cfn* / "raw")** — 1:1 mappings to CloudFormation resources (`CfnBucket`). Full control, no defaults, verbose — you drop to L1 for resources/properties L2 doesn't cover yet.
- **L2** — curated, opinionated resources with **sensible defaults, helper methods, and less boilerplate** (`s3.Bucket` with `encryption`, `.grantRead(role)` convenience methods that wire up IAM for you). The everyday level.
- **L3 (patterns)** — high-level, multi-resource **patterns** encoding best practice (`ApplicationLoadBalancedFargateService` stands up an ALB + ECS service + task def + security groups in a few lines).

The win is **abstraction, reuse, and real programming** — loops, conditionals, functions, unit tests, IDE autocomplete, and `.grant*()` methods that generate least-privilege IAM automatically. The cost is another toolchain, a build step, and the leakiness of debugging generated CFN. You reach for CDK when your infra has real logic/repetition and your team is comfortable in code; the everyday sweet spot is L2 constructs, dropping to L1 where needed and using L3 for common patterns.

### Q6. When would you choose the CDK over raw CloudFormation, and vice versa?

**Choose CDK when:**

- Your infra has **logic and repetition** — loops over N environments/queues, conditionals, shared helper functions — that YAML expresses painfully.
- You want **least-privilege IAM generated for you** (`.grantRead()`, `.grantInvoke()`) rather than hand-writing policy JSON.
- You want **unit tests** on infra (assert "the bucket is encrypted") and IDE support (types, autocomplete, refactoring).
- Your team already lives in TypeScript/Python and prefers one language across app + infra; you want L3 patterns to stand up common architectures fast.

**Choose raw CloudFormation when:**

- You want **zero build step and full transparency** — the template *is* the artifact, no synth to reason about, easier for reviewers/ops who don't know the CDK language.
- The team isn't comfortable with the CDK's programming model, or you need to hand templates to customers/other teams as-is.
- You want to avoid CDK version churn and the "debug the generated CFN" tax.
- Simple, static stacks where the abstraction earns nothing.

The honest tradeoff: CDK trades **YAML verbosity for a programming toolchain and generated output you sometimes have to debug**. For complex, DRY, IAM-heavy infra it's a clear win; for a handful of static resources, raw CFN is simpler. Note CDK deploys *via* CFN either way, so you keep change sets, rollback, and drift regardless — the choice is purely about the authoring experience.

### Q7. Compare Terraform and CloudFormation on AWS. What are the real tradeoffs?

Both are declarative IaC; the differences are consequential.

| | CloudFormation | Terraform |
|---|---|---|
| Scope | AWS-only (native) | **Multi-cloud** + huge provider ecosystem (SaaS, k8s, DNS) |
| State | **AWS-managed** (invisible) | **You manage** — state file in S3 + DynamoDB lock |
| Drift | Native drift detection | `terraform plan` shows drift on each run |
| Language | YAML/JSON (+ CDK) | HCL (+ CDKTF) |
| Preview | Change sets | `terraform plan` (excellent diff) |
| Modules/reuse | Nested stacks / modules | Rich module registry |
| New AWS features | Sometimes lags at launch | Provider often fast, but can also lag |
| Lock-in | AWS-native | Portable tooling, still cloud-specific resources |

**Terraform's edges:** one tool and one workflow across AWS + other providers (Cloudflare, Datadog, GitHub, k8s) in a single plan; a superb `plan` diff; a mature module ecosystem; and no AWS lock-in on the *tooling*. Its cost is **owning state** — the state file is sensitive (may contain secrets), must live in a locked remote backend (**S3 + DynamoDB for locking**) to prevent concurrent-apply corruption, and state manipulation (`import`, `mv`, `rm`) is a real operational skill.

**CloudFormation's edges:** state is fully managed by AWS (nothing to secure or lock), native drift detection, deep AWS integration (StackSets across an Org, service-managed permissions), no extra tooling, and rollback-on-failure built in. Its cost is AWS-only and YAML verbosity (mitigated by CDK).

Senior answer: pick **Terraform** for multi-cloud/multi-provider estates and teams that value one portable workflow; pick **CloudFormation/CDK** for AWS-only shops that want managed state, tight Org/StackSet integration, and no state-file operational burden. Both are correct choices in the right context — the interviewer wants the *reasoning*, not a tribal answer.

### Q8. What is AWS SAM and when do you use it over plain CloudFormation?

**SAM (Serverless Application Model)** is a **CloudFormation transform** — a shorthand syntax specialised for serverless. A template declares `Transform: AWS::Serverless-2016-10-09`, then uses terse resource types like `AWS::Serverless::Function`, `::Api`, `::HttpApi`, and `::SimpleTable`. At deploy time SAM **expands into full CloudFormation** (a Lambda function + its IAM role + event-source mappings + API Gateway + permissions from a few lines). So it *is* CloudFormation, just with serverless boilerplate collapsed.

What it adds beyond terser templates is the **SAM CLI** for the serverless dev loop:

- `sam local invoke` / `sam local start-api` — run Lambdas and API Gateway **locally in Docker** for fast iteration without deploying.
- `sam build` — package functions and dependencies.
- `sam deploy --guided` — package to S3/ECR and deploy the stack.
- Built-in **safe deployment** — `AutoPublishAlias` + `DeploymentPreference` wire up CodeDeploy canary/linear traffic shifting and alarm-based rollback for Lambda in a few lines.

Use SAM when your workload is **primarily serverless** (Lambda/API GW/DynamoDB/EventBridge) and you want the local testing loop and concise templates. Use plain CFN/CDK when infra is broad and not serverless-centric — SAM's sugar only covers serverless resource types (you can still drop to raw CFN inside a SAM template). CDK is the alternative if you'd rather author serverless infra in a real language; SAM is lighter-weight and template-first.

### Q9. Walk through the AWS Code* CI/CD suite and modern alternatives.

The AWS-native pipeline is four services that compose:

- **CodeCommit** — managed Git hosting. (AWS has de-emphasised it; most teams use **GitHub/GitLab/Bitbucket** instead, and CodeCommit is effectively legacy for new projects.)
- **CodeBuild** — managed build/test compute. Runs a `buildspec.yml` (install → build → test → package) in a container, producing artifacts. Pay-per-build-minute, no build servers to maintain.
- **CodeDeploy** — deploys artifacts to **EC2 (via agent), ECS, or Lambda** with rolling/blue-green/canary strategies, lifecycle hooks, and automatic rollback.
- **CodePipeline** — the **orchestrator**: models the flow as stages (Source → Build → Test → Deploy → Approve) wiring the above together, with manual-approval gates and cross-account deploy roles.

Supporting services: **ECR** (container image registry), **CodeArtifact** (npm/pip/Maven package registry), **S3** (artifact store), and **CodeDeploy agent** on EC2.

**Modern alternatives / reality:** most teams run **GitHub Actions** (or GitLab CI) for source+build+test — richer ecosystem, better DX, cheaper to start — and either deploy directly (via OIDC-federated IAM roles, avoiding long-lived keys) or hand off to CodeDeploy for the ECS/Lambda traffic-shifting it does well. A common hybrid: GitHub Actions builds and pushes an image to ECR, then triggers CodeDeploy/CodePipeline for the safe, alarm-gated rollout. The senior point is that the Code* suite's *deployment* half (CodeDeploy's blue/green + rollback) is genuinely valuable, while its *source/build* half (CodeCommit) has largely lost to GitHub — pick per-stage rather than all-in.

### Q10. Explain rolling, blue/green, and canary deployments and their tradeoffs.

Three strategies, trading speed, cost, and rollback safety.

| Strategy | How it works | Rollback | Cost | Risk exposure |
|---|---|---|---|---|
| **Rolling** | Replace instances/tasks in **batches** in place | Slow — another rolling deploy | Low (no extra fleet) | Mixed versions live; a bad build hits users gradually |
| **Blue/green** | Stand up a **full parallel** (green) environment, cut all traffic over, keep blue as fallback | **Instant** — flip traffic back to blue | High — 2x fleet during deploy | All-or-nothing at cutover, but instant undo |
| **Canary** | Shift a **small % first** (e.g. 10%), observe, then the rest | Fast — shift back before completion | Moderate | Smallest — only a fraction sees a bad build |

- **Rolling** is the cheapest and simplest (default for ECS, EC2 ASG rolling updates), but you run **mixed versions simultaneously** (needs backward-compatible changes / DB migrations), and rollback means deploying again — no instant undo.
- **Blue/green** gives the **cleanest, fastest rollback** (flip the load balancer/target group back) and no mixed-version window, at the cost of temporarily running two full environments. Great for stateful/risky cutovers.
- **Canary** minimises blast radius by exposing a small slice first and **watching metrics/alarms** before proceeding — the safest for high-traffic services, and what you want gated on CloudWatch alarms with automatic abort.

On AWS: ECS and Lambda support all three via **CodeDeploy** (Lambda does canary/linear traffic shifting on aliases); EC2 ASGs do rolling or blue/green. The right choice depends on rollback-speed needs, cost tolerance, and whether the change is backward-compatible.

### Q11. How do CodeDeploy lifecycle hooks and automatic rollback work?

CodeDeploy runs a deployment as a sequence of **lifecycle events**, and you attach **hooks** (scripts or Lambda validation functions) to gate and verify each phase. The power is that traffic only shifts if your hooks pass, and if anything fails it **rolls back automatically**.

For a blue/green (ECS/Lambda) deploy, the key hooks are:

- **`BeforeInstall` / `AfterInstall`** (EC2) — prep the new revision.
- **`BeforeAllowTraffic`** — run *before* any user traffic hits the new version: smoke tests, warm caches, integration checks. Fail here and traffic never shifts.
- **`AllowTraffic`** — CodeDeploy shifts traffic per your config (all-at-once, canary 10%-then-rest, or linear).
- **`AfterAllowTraffic`** — validate the new version *is* serving real traffic correctly.

**Automatic rollback** triggers on: a failed hook, a failed deployment, or — most importantly — a **CloudWatch alarm** you associate with the deployment group breaching (e.g. error rate or p99 latency alarm). On rollback, blue/green simply **shifts traffic back to the original (blue) version**, which is why it's near-instant and clean. You can also enable rollback on deployment stop and set a **bake time** — keep the old version around for N minutes after cutover so a delayed regression still triggers an automatic revert.

This is the core of safe delivery: **deploy behind hooks, watch an alarm, auto-revert on breach** — the deployment self-heals without a human in the loop. It ties CI/CD directly to the Observability topic (the alarm doing the gating).

### Q12. How do you handle secrets in a CI/CD pipeline?

The rule: **secrets are injected at runtime from a secrets store, never baked into code, images, or pipeline config, and never printed to logs.**

Concretely:

- **Store** secrets in **Secrets Manager** or **SSM Parameter Store (`SecureString`)**, encrypted with KMS. The pipeline/build role gets scoped, least-privilege read access to *only* the secrets it needs.
- **Inject at runtime**, not build time — the running task/function fetches the secret via IAM role (ECS task role, Lambda execution role) or the platform injects it (ECS `secrets` from Secrets Manager into env vars, resolved at container start). Don't bake secrets into a Docker image layer (they're extractable forever) or into the CFN/Terraform template.
- **No long-lived cloud keys in CI** — use **OIDC federation** (GitHub Actions → an IAM role via `sts:AssumeRoleWithWebIdentity`) so the pipeline gets short-lived STS credentials instead of a static `AWS_SECRET_ACCESS_KEY` sitting in repo secrets.
- **Keep secrets out of logs** — mask them (CI "masked/secret" variables), never `echo` them, and beware build tools that print environment on error. Terraform **state** can contain secrets — encrypt the S3 backend and lock down access.
- **Scan for leaks** — run secret scanners (git-secrets, trufflehog) in CI and enable push protection to catch committed credentials.

The failure mode to name: a secret hardcoded in a template or an image layer, or echoed into a public build log — both are effectively permanent leaks requiring rotation. Rotation (Secrets Manager's native rotation) is the backstop when a leak does happen.

### Q13. What is immutable infrastructure and why is it a good idea?

**Immutable infrastructure** means you **never modify a running server** — no SSH-in to patch, no in-place package upgrades, no config edits on live hosts. To change anything, you **build a new machine image / container version and replace** the old instances entirely ("cattle, not pets").

The workflow: bake a versioned artifact (AMI via Packer, or a container image), deploy it as a *new* set of instances/tasks (rolling or blue/green), and terminate the old ones. Configuration is baked in at build time, not applied at runtime.

Why it's better than mutable (patch-in-place) infrastructure:

- **Eliminates configuration drift** — every instance of a version is byte-identical, built by the same pipeline. No "instance 3 was patched by hand in 2022 and nobody remembers."
- **Predictable, testable deploys** — you test the exact image that goes to prod; what you validated is what runs.
- **Trivial, reliable rollback** — roll back = deploy the previous image; no un-patching, no partial state.
- **Better security** — short-lived instances shrink the window for persistence; you rebuild from a hardened base regularly rather than accumulating cruft, and you can disable SSH entirely.
- **Reproducibility / DR** — rebuild the whole fleet from the artifact anytime.

It pairs naturally with **blue/green** (replace, don't mutate) and Auto Scaling (launch templates referencing a versioned AMI/image). The tradeoff is you need a solid **image build pipeline** and to externalise state (data in RDS/S3, not on the instance) so instances are genuinely disposable — but that's the same discipline good cloud architecture wants anyway.

### Q14. How do you separate environments and accounts, and why does it matter?

The mature pattern is **separate AWS accounts per environment/workload**, not just separate VPCs or tags within one account — organised under **AWS Organizations**.

Typical layout: a management (payer) account, a shared **logging/security** account, and per-environment accounts (`dev`, `staging`, `prod`) — often per team/product too. Why account-level separation beats in-account separation:

- **Hard blast-radius boundary** — an account is the strongest isolation AWS offers. A runaway script, a compromised credential, or a Terraform `destroy` in dev **cannot touch prod** resources in another account.
- **Clean IAM & least privilege** — no risk of a `dev` policy accidentally matching a `prod` resource ARN; access is via cross-account role assumption with explicit trust.
- **Independent limits & billing** — per-account service quotas and cost attribution; one env can't exhaust another's Lambda concurrency or API limits, and cost shows up per account.
- **Org-wide guardrails** — **SCPs** (Service Control Policies) enforce boundaries centrally (e.g. deny disabling CloudTrail, restrict regions), and **StackSets** deploy baseline config to every account uniformly.

Deployment-wise, the pipeline lives in a tooling account and **assumes deploy roles into each target account**, promoting the same artifact dev → staging → prod through approval gates. This gives you consistent, auditable promotion with strong isolation. The anti-pattern is one giant account with everything separated only by naming conventions — one fat-fingered wildcard policy or a shared limit becomes a cross-environment incident.

### Q15. Where do build artifacts live — ECR, CodeArtifact, S3 — and how do you manage them?

Different artifact types have purpose-built stores:

- **ECR (Elastic Container Registry)** — **Docker/OCI container images**. Private per-account (or public gallery), integrated with ECS/EKS/Lambda-container and IAM for pull auth. Features that matter: **image scanning** (Inspector integration for CVEs on push), **lifecycle policies** to expire old/untagged images (cost + hygiene), immutable tags to prevent overwriting a released tag, and cross-region/cross-account replication.
- **CodeArtifact** — **language package registry**: npm, pip/PyPI, Maven, NuGet, generic. It proxies/caches upstream public repos and hosts your **internal packages**, so builds are reproducible (pinned, not at the mercy of a public registry outage) and you control which upstream packages are allowed. This is your defence against supply-chain risk in dependencies.
- **S3** — **generic build artifacts** and pipeline hand-off: zipped Lambda deployment packages, CloudFormation/CDK templates, static site bundles, and the default **CodePipeline artifact store** between stages. Versioning + lifecycle rules manage retention.

Management principles across all three:

- **Immutability & versioning** — a released artifact version/tag is never mutated; you promote the *same* artifact dev→staging→prod (build once, deploy many) rather than rebuilding per environment.
- **Retention/lifecycle policies** — expire old images/artifacts to control cost and reduce confusion.
- **Least-privilege access** — scoped IAM for who can push vs pull; encrypt at rest (SSE-KMS).
- **Scanning** — CVE scanning on images (ECR/Inspector) and dependency scanning in the pipeline.

The through-line is **build once, store immutably, promote the identical artifact** — rebuilding per environment reintroduces the drift IaC was meant to kill.

### Q16. How do you test infrastructure as code, and what is GitOps?

**Testing IaC** has a layered pyramid, mirroring application testing:

- **Static analysis / linting** — `cfn-lint`, `terraform validate`/`fmt`, `cdk synth` (catches template errors before deploy). Fast, run on every commit.
- **Policy-as-code / security scanning** — `checkov`, `tfsec`, `cfn-guard`, `cdk-nag` assert guardrails: "no public S3 buckets," "encryption enabled," "no `0.0.0.0/0` on SSH." This shifts compliance *left*, before resources exist.
- **Unit tests** — especially with **CDK**, assert on the synthesised template ("the bucket has encryption; the role grants only `s3:GetObject`") using the assertions library. Terraform has similar via `terraform test`/Terratest.
- **Integration / deploy tests** — deploy to an **ephemeral test account/environment**, run **Terratest** or **`sam local` / integration checks** against the real resources, then tear down. Confirms it actually provisions and works.
- **Change-set / `plan` review** — human review of the diff before prod apply, watching for destructive replacements.

**GitOps** is the operating model that ties it together: **Git is the single source of truth for desired state**, and a **controller continuously reconciles** the real environment to match the repo — so all changes flow through pull requests (reviewed, audited, revertible), and any manual drift is automatically corrected back to the declared state. On AWS/Kubernetes this is tools like **Argo CD or Flux** watching a repo; the CloudFormation analogue is pipelines that redeploy on merge plus drift detection alarming on divergence. The payoff: your deployment history *is* your Git history, rollback is `git revert`, and "what's supposed to be running" is always answerable by reading the repo — no snowflakes, no undocumented console changes.
## Cost Optimization & Billing

### Summary

**What this topic covers**

The discipline of making AWS cost a first-class design input rather than a month-end surprise. This topic has 15 questions spanning three concern areas: (1) the **pricing mindset** — pay-per-use is only cheap if you actually stop paying when idle, and the meter runs on dimensions people forget (egress, cross-AZ traffic, NAT data processing, idle provisioned capacity); (2) the **cost levers** per resource class — compute (Savings Plans / Reserved Instances / Spot / Graviton / scale-to-zero), storage (S3 class tiering, gp3 over gp2, snapshot hygiene, lifecycle policies), and data transfer (the single most misunderstood line item on the bill); and (3) the **tooling and process** — Cost Explorer, Budgets, anomaly detection, the Cost and Usage Report (CUR), tagging for cost allocation, Compute Optimizer, Trusted Advisor, and the FinOps loop that ties them together. This maps directly to the Well-Architected **cost optimization** pillar, and senior candidates are expected to reason about cost the way they reason about latency: as a measurable, designed-for property.

**Mental model**

Think of the bill as the sum of three meters running continuously: **compute-time**, **stored-bytes-months**, and **moved-bytes**. Optimising cost is optimising each meter independently. For compute, the lever is *commitment vs. flexibility*: Spot is cheapest but interruptible, on-demand is most flexible but priciest, and Savings Plans/RIs trade a 1-3 year commitment for 30-70% off. The senior instinct is "right-size *before* you commit" — a Savings Plan on an over-provisioned fleet just locks in waste. For storage, the lever is *access frequency*: hot data on Standard, cold data tiered down (or Intelligent-Tiering if the pattern is unknown), and ruthless deletion of orphaned snapshots and un-lifecycled logs. For data transfer, the lever is *architecture*: keep chatty traffic inside an AZ, avoid routing everything through a NAT Gateway, and never let internet egress be an afterthought. The through-line: **cost is a function of architecture, not a billing setting**. You can't discount your way out of a design that shuffles terabytes across AZs.

**Key terms**

- **Savings Plans** — flexible spend commitment ($/hour for 1 or 3 years) for a discount; Compute Savings Plans apply across EC2, Fargate, and Lambda regardless of instance family/region.
- **Reserved Instances (RI)** — older commitment model tied to instance attributes; Standard RIs give the deepest discount, Convertible RIs allow family changes.
- **Spot Instances** — spare capacity at up to ~90% off, reclaimable with a 2-minute warning; ideal for fault-tolerant, stateless, or batch work.
- **Graviton** — AWS ARM64 processors; typically ~20% cheaper and better price/performance than equivalent x86 for most workloads.
- **S3 Intelligent-Tiering** — storage class that auto-moves objects between access tiers based on usage; a small monitoring fee per object, no retrieval charges for the frequent/infrequent tiers.
- **gp3 vs gp2** — gp3 EBS decouples IOPS/throughput from size and is ~20% cheaper per GB than gp2; there is rarely a reason to stay on gp2.
- **NAT Gateway data processing** — charged per GB *processed* on top of the hourly cost; a classic surprise for private-subnet egress and cross-AZ NAT routing.
- **Cost and Usage Report (CUR)** — the most granular billing dataset, delivered to S3, queryable via Athena/QuickSight; the source of truth for FinOps analysis.
- **Cost Explorer** — visual console tool for trends, forecasts, and RI/SP recommendations.
- **AWS Budgets** — threshold alerts on cost or usage, with actions (e.g. stop resources) on breach.
- **Compute Optimizer** — ML-driven right-sizing recommendations for EC2, Auto Scaling, EBS, and Lambda.
- **Cost allocation tags** — tags activated in billing to slice the bill by team/env/project.

**Why interviewers ask this**

Cost is where junior and senior separate cleanly. A junior answer is "use Reserved Instances" — a single lever, applied blindly. A senior answer sequences the levers: *measure with Cost Explorer/CUR → right-size with Compute Optimizer → eliminate waste (idle, orphaned) → then commit with Savings Plans on the steady-state baseline → cover the spiky top with Spot/on-demand*. Interviewers also probe whether you understand the **non-obvious meters** — asking "you have two EC2 instances talking across AZs, where's the cost?" separates people who've read a bill from people who haven't. And they're checking cultural fit for FinOps: do you tag resources, do you set budgets, do you treat a 40% month-over-month spike as an incident? The signal is whether cost is something you *design*, or something that happens to you.

**Common confusions**

- "Serverless is always cheaper" — Lambda/Fargate win for spiky/low-duty-cycle workloads; a steadily-busy service can be cheaper on right-sized, Savings-Plan-covered EC2/Graviton.
- "Reserved Instances and Savings Plans are the same" — Savings Plans are more flexible (apply across families/regions/compute types); RIs can be sold on the marketplace but are attribute-locked.
- "Data transfer is free" — inbound is generally free; *outbound to the internet*, *cross-AZ*, and *inter-region* all cost money, and NAT processing is charged per GB.
- "S3 is cheap so I don't need lifecycle policies" — un-tiered logs and forgotten multipart uploads accumulate into real money; lifecycle + Intelligent-Tiering fix it.
- "Buying an RI right-sizes my fleet" — a commitment on an oversized instance locks in the waste; right-size first, commit second.
- "Cross-AZ traffic is free within a region" — it is *not*; it's billed in both directions and is a top hidden cost in chatty microservice meshes.

**What follows from this topic**

Cost optimization is inseparable from architecture, so it threads into every other AWS topic. The compute-commitment discussion connects to **compute and auto scaling**; storage tiering to the **S3/storage** topic; cross-AZ and NAT costs to **networking and VPC**; and the "design for scale without designing for a huge bill" tension is central to the **Scenario Design & Common Pitfalls** capstone. It also pairs with the **Well-Architected** topic, where cost optimization is one of six pillars — the two topics are two views of the same discipline.

### Q1. How should you think about the AWS pricing model — where does the cost actually come from?

AWS pricing is **pay-per-use across three meters**: compute-time (instance-hours, Lambda GB-seconds, Fargate vCPU/GB-hours), stored-bytes-months (S3, EBS, snapshots, RDS storage), and moved-bytes (data transfer). The trap is that pay-per-use only saves money if you actually *stop* paying when idle — a provisioned EC2 instance or RDS database bills 24/7 whether it serves one request or a million.

Three categories of cost bite people who only budget for the obvious "compute + storage":

- **Egress** — data leaving AWS to the internet is billed per GB (roughly $0.09/GB for the first tier, declining with volume). Inbound is free. This is why serving large media directly from EC2 without CloudFront is expensive.
- **Idle provisioned capacity** — over-provisioned instances, unattached EBS volumes, idle NAT Gateways, and forgotten dev environments run the meter with zero business value.
- **Cross-AZ traffic** — traffic between AZs in the same region is billed (~$0.01/GB each direction). Chatty microservices spread across AZs can rack up a surprising transfer bill.

The senior framing: **cost is a designed property**. You right-size, you scale to zero where possible, you keep traffic local, and you *measure* — you don't discover the cost driver from an angry finance email.

### Q2. Compare Savings Plans, Reserved Instances, and Spot Instances. When do you use each?

| | On-Demand | Spot | Savings Plans | Reserved Instances |
|---|---|---|---|---|
| Discount | 0% (baseline) | up to ~90% | ~30-70% | ~30-72% |
| Commitment | none | none | 1 or 3 yr $/hr | 1 or 3 yr instance |
| Flexibility | full | full | high (family/region/compute) | low (attribute-locked) |
| Interruptible | no | **yes (2-min warning)** | no | no |
| Best for | spiky/unknown | fault-tolerant batch | steady baseline | steady, stable-shape |

**Spot** for anything stateless and interruption-tolerant: CI runners, batch processing, big-data workers, stateless web tiers behind an ASG with a mix of Spot + on-demand. Never for a stateful database or a workload that can't checkpoint.

**Savings Plans** for your steady-state baseline compute. Compute Savings Plans are the default recommendation now because they apply across EC2 families, regions, Fargate, and Lambda — you commit to a dollars-per-hour spend, not a specific instance.

**Reserved Instances** are the older model; still useful for RDS/ElastiCache/OpenSearch (which don't have Savings Plans) and where you want marketplace resale. For EC2, Savings Plans have largely superseded them.

The pattern: **cover the steady baseline with Savings Plans, absorb the spiky top with on-demand or Spot, right-size before committing.**

### Q3. What is right-sizing and why do it before buying a commitment?

Right-sizing is matching instance/resource capacity to actual utilization. AWS Compute Optimizer and Cost Explorer's rightsizing recommendations analyse CloudWatch metrics (CPU, memory with the agent, network) and flag instances running at, say, 8% CPU that could drop two sizes.

The reason to right-size **first** is arithmetic: a Savings Plan or RI is a commitment to *spend*. If you buy a 3-year commitment on an `m5.4xlarge` that should be an `m5.large`, you've locked in the waste for three years — the discount applies to money you shouldn't be spending. The correct sequence is:

1. Right-size (eliminate over-provisioning).
2. Eliminate idle/orphaned resources.
3. Consider Graviton/ARM for another ~20%.
4. *Then* commit with Savings Plans on the resulting steady-state baseline.

Right-sizing is also continuous — traffic patterns drift, so it's a recurring FinOps activity, not a one-time cleanup.

### Q4. When is serverless (Lambda/Fargate) cheaper than EC2, and when is it not?

Serverless wins on **duty cycle**. Lambda bills per request + GB-second of execution; Fargate bills per vCPU/GB-hour while a task runs. If your workload is spiky, bursty, or low-utilization, you pay near-zero when idle — no server sitting at 3% CPU billing 24/7.

Serverless *loses* when the workload is **steadily busy**. A service pinned at high utilization all day is often cheaper on a right-sized, Savings-Plan-covered EC2 (especially Graviton) instance, because you're paying the per-invocation premium continuously. The rough mental model:

- **Spiky / event-driven / unpredictable** → Lambda or Fargate (scale to zero, pay per use).
- **Steady high utilization** → EC2 with Savings Plans + Graviton.
- **Container workloads, moderate duty cycle** → Fargate for operational simplicity, EKS/ECS-on-EC2 with Spot for cost-sensitive scale.

The other half of the equation is **operational cost** — serverless removes patching, scaling, and capacity planning. Even when compute is marginally pricier, the total cost of ownership can favour serverless for small teams.

### Q5. How do you optimise S3 storage cost?

Two levers: **storage class** and **lifecycle**.

**Storage classes** by access pattern:

| Class | Use for | Retrieval cost |
|---|---|---|
| S3 Standard | hot, frequent access | none |
| Intelligent-Tiering | unknown/changing patterns | none (auto-tiers) |
| Standard-IA | infrequent, needs instant access | per-GB retrieval fee |
| One Zone-IA | infrequent, reproducible (single AZ) | per-GB, less durable |
| Glacier Instant Retrieval | archive, rare but instant | higher per-GB |
| Glacier Flexible / Deep Archive | cold archive, minutes-to-hours restore | cheapest storage, slow/costly restore |

**Intelligent-Tiering** is the default recommendation when you don't know the access pattern — it auto-moves objects between tiers for a small per-object monitoring fee and no retrieval charges on the frequent/infrequent tiers, so you can't get burned by a wrong guess.

**Lifecycle policies** automate the transitions (Standard → IA after 30 days → Glacier after 90) and *expire* old objects, incomplete multipart uploads, and old versions. Un-lifecycled logs and orphaned multipart uploads are a classic silent cost leak — always set a lifecycle rule to abort incomplete multipart uploads after ~7 days.

### Q6. Why prefer gp3 over gp2 EBS volumes, and how do you manage snapshot cost?

**gp3 over gp2**: gp3 is roughly 20% cheaper per GB and, crucially, **decouples performance from size**. gp2's IOPS scaled with volume size (3 IOPS/GB), so getting more IOPS meant over-provisioning storage. gp3 gives a baseline 3,000 IOPS and 125 MB/s free, with IOPS/throughput tunable independently. There is almost no reason to stay on gp2 — migration is a simple volume modification with no downtime.

**Snapshot sprawl** is the EBS equivalent of un-lifecycled S3. Snapshots are incremental (you only pay for changed blocks), but automated backup policies with no retention limit accumulate thousands of snapshots. Fixes:

- Use **Data Lifecycle Manager (DLM)** or AWS Backup with explicit retention policies.
- Delete snapshots of terminated instances' volumes.
- Watch for orphaned snapshots whose source volume is long gone — they still bill.

Also delete **unattached EBS volumes** — a volume left behind when an instance is terminated (if `DeleteOnTermination` was false) keeps billing at full rate.

### Q7. Explain data transfer costs. Where do people get surprised?

Data transfer is the most misunderstood part of the bill. The rules:

- **Inbound from internet** — free.
- **Outbound to internet** — billed per GB (~$0.09/GB first tier), declining with volume. Reduced dramatically by fronting with CloudFront (cheaper egress + caching).
- **Cross-AZ, same region** — billed ~$0.01/GB *each direction*. Two services chatting across AZs pay both ways.
- **Inter-region** — billed per GB, more than cross-AZ.
- **Within a single AZ using private IPs** — free.

The classic surprises:

1. **NAT Gateway data processing** — every GB through a NAT Gateway is charged (~$0.045/GB) *on top of* the hourly charge. High-egress private workloads (e.g. pulling large container images or datasets) rack this up. Fix with **VPC Gateway Endpoints** for S3/DynamoDB (free) and Interface Endpoints for other services, so traffic doesn't traverse the NAT.
2. **Cross-AZ chatter** — a microservice mesh spread across three AZs for HA pays cross-AZ transfer on every internal call. Sometimes worth co-locating chatty services, or accepting the cost as the price of HA — but you must *know* it's there.
3. **Cross-AZ NAT routing** — a private subnet in AZ-a routing through a NAT Gateway in AZ-b pays cross-AZ *plus* NAT processing. Deploy one NAT per AZ to avoid the cross-AZ leg.

### Q8. What tools does AWS give you to monitor and control cost?

A layered toolkit:

- **Cost Explorer** — the console dashboard for trends, forecasts, and grouping by service/tag/account. First stop for "where is the money going." Also surfaces RI/Savings Plan recommendations.
- **AWS Budgets** — set thresholds on cost or usage, get alerts (and optional *budget actions* like applying a restrictive IAM policy or stopping instances) when you breach or forecast to breach.
- **Cost Anomaly Detection** — ML-based; flags unusual spend spikes and emails you, catching the "someone left a GPU cluster running" incident within a day instead of at month-end.
- **Cost and Usage Report (CUR)** — the most granular data (hourly, per-resource), delivered to S3 and queried via Athena or visualised in QuickSight. The foundation for serious FinOps.
- **Compute Optimizer** — right-sizing recommendations from ML on your utilization metrics.
- **Trusted Advisor** — cost checks (idle load balancers, underutilized instances, unassociated Elastic IPs, etc.), plus security/reliability/performance checks.

The workflow: **Anomaly Detection + Budgets catch surprises → Cost Explorer investigates trends → CUR does the deep analysis → Compute Optimizer/Trusted Advisor recommend fixes.**

### Q9. What is the Cost and Usage Report (CUR) and when do you reach for it?

The **CUR** is AWS's most detailed billing dataset: line-item, hourly (or daily/monthly) granularity for every resource, delivered as compressed files to an S3 bucket. It includes usage type, operation, resource IDs, tags, pricing, and RI/Savings Plan amortization.

You reach for it when **Cost Explorer isn't granular enough**. Cost Explorer is great for visual trends but caps at certain groupings; the CUR lets you write arbitrary SQL. Typical setup: CUR → S3 → AWS Glue/Athena for ad-hoc SQL, or → QuickSight for dashboards. Common analyses:

- Per-team/per-service showback and chargeback using cost allocation tags.
- Amortized RI/Savings Plan cost attribution (spreading the upfront commitment across the resources that consumed it).
- Finding the exact resource IDs driving a spike that Anomaly Detection flagged.

For a FinOps practice at any scale, the CUR is the source of truth; Cost Explorer is the quick-look layer on top.

### Q10. How does tagging support cost management?

Tags are the primary mechanism for **slicing the bill by dimension you care about** — team, environment, project, cost center, application. Without tags, the bill is one undifferentiated blob and you can't answer "how much does the payments service cost?"

The mechanics:

1. Apply consistent tags (`team`, `env`, `project`, `owner`) to resources — ideally enforced.
2. Activate them as **cost allocation tags** in the Billing console (user-defined tags must be explicitly activated; there are also AWS-generated tags).
3. Once active, they appear as grouping dimensions in Cost Explorer and columns in the CUR.

Enforcement is the hard part — untagged resources are invisible in showback. Use **tag policies** (via Organizations) and **Service Control Policies** or IAM conditions to require tags at creation, and **AWS Config** rules to flag non-compliant resources. A mature setup can *deny* creation of untagged resources. The payoff is accountability: teams that can see their own spend optimise it; a shared blob nobody owns just grows.

### Q11. How do consolidated billing and AWS Organizations help with cost?

**AWS Organizations** lets you manage many accounts under one management (payer) account, and **consolidated billing** rolls all member-account charges into a single bill. This helps cost in several ways:

- **Volume discounts aggregate** — tiered pricing (S3, data transfer) is calculated on combined usage across all accounts, so many small accounts reach cheaper tiers together.
- **RI/Savings Plan sharing** — a commitment bought in one account can apply to matching usage in *any* account in the org (unless you turn sharing off), so unused reservation capacity in one team covers another.
- **Per-account isolation with unified visibility** — each team/environment gets its own account (blast-radius and security isolation), while the payer account sees the whole bill and can allocate by account, the cleanest cost-allocation boundary there is.
- **Governance** — Service Control Policies can restrict expensive services/regions org-wide; tag policies enforce cost-allocation hygiene.

The multi-account-with-consolidated-billing pattern is the standard enterprise landing-zone design (AWS Control Tower automates it), and it's both a security and a cost best practice.

### Q12. Which services benefit from reserved capacity beyond EC2, and how?

Savings Plans cover EC2, Fargate, and Lambda. Several **stateful data services have their own Reserved model** because they don't fit Savings Plans:

- **RDS Reserved Instances** — commit 1 or 3 years to a DB instance class/region for ~30-60% off. Ideal for production databases that run continuously.
- **ElastiCache Reserved Nodes** — same idea for Redis/Memcached node hours.
- **OpenSearch (Elasticsearch) Reserved Instances** — for continuously-running search/analytics clusters.
- **Redshift Reserved Nodes** — for steady data-warehouse clusters.
- **DynamoDB reserved capacity** — for provisioned-capacity tables with predictable throughput (though on-demand mode is often better for spiky patterns).

The decision rule mirrors compute: if the service runs **continuously with a stable shape**, reserve it. If usage is spiky or you're still finding the steady-state size, stay on-demand and reserve later. These reservations are pure commitment — there's no interruptible/Spot equivalent for managed databases — so right-size the instance class first.

### Q13. What are the most common AWS cost anti-patterns?

The recurring offenders:

- **Over-provisioned instances** — sized for a peak that never comes, running at single-digit CPU. Fix: Compute Optimizer + right-size.
- **Forgotten / orphaned resources** — idle dev environments, unattached EBS volumes, unassociated Elastic IPs (billed when not attached to a running instance), idle load balancers, old snapshots. Fix: tagging + Trusted Advisor + scheduled cleanup.
- **Un-tiered logs and storage** — everything in S3 Standard forever, no lifecycle policy, incomplete multipart uploads accumulating. Fix: lifecycle + Intelligent-Tiering.
- **Cross-AZ chatter** — HA architecture spreading chatty services across AZs, paying transfer on every internal call, unmeasured. Fix: measure it, co-locate or accept knowingly, use endpoints.
- **NAT Gateway for high-volume egress** — pulling large images/datasets through NAT and paying per-GB processing. Fix: VPC gateway endpoints for S3/DynamoDB.
- **Committing before right-sizing** — Savings Plans/RIs on oversized fleets, locking in waste.
- **No budgets or anomaly detection** — discovering a 3x spike at month-end instead of day-one.
- **Running 24/7 dev/test environments** — non-prod that could be scheduled off nights/weekends. Fix: instance scheduler.

The meta-pattern: **cost visibility precedes cost control.** Almost every anti-pattern is really "nobody was looking."

### Q14. What is FinOps and what does a healthy cost-optimization loop look like?

**FinOps** is the practice of bringing financial accountability to cloud spend — a collaboration between engineering, finance, and product to make cost a shared, engineering-owned metric rather than a finance-only concern. It's cultural as much as technical.

The healthy loop has three phases (the FinOps Foundation's **Inform → Optimize → Operate**):

1. **Inform** — visibility and allocation. Tag everything, build showback/chargeback from the CUR, so every team sees its own spend. You can't optimise what you can't see.
2. **Optimize** — act on the visibility: right-size, eliminate waste, tier storage, commit to Savings Plans on the steady baseline, adopt Graviton/Spot. Prioritise by impact.
3. **Operate** — make it continuous: budgets and anomaly detection as guardrails, cost as a metric in dashboards and even PR review ("this change adds a NAT-routed egress path"), periodic right-sizing reviews.

The senior signal is treating cost like reliability or latency: **measured, owned, designed-for, and continuously improved** — not a quarterly panic. A team where engineers can see the cost of their own services and are empowered to change them will beat any top-down cost-cutting mandate.

### Q15. How do you estimate cost for a new architecture before building it?

Use the **AWS Pricing Calculator** (calculator.aws) — you model each service (instance types and hours, S3 GB and requests, data transfer GB, Lambda invocations and duration) and it produces a monthly estimate you can share and save. The discipline matters more than the tool:

1. **Enumerate the three meters** for your design: compute-time, stored-bytes, moved-bytes. Miss the third and your estimate is fiction.
2. **Model data transfer explicitly** — internet egress, cross-AZ, NAT processing. This is where estimates are most often wrong.
3. **Model at realistic scale** — not just steady state but peak, and check whether scale-to-zero applies (serverless) or you're paying for provisioned idle.
4. **Include the "hidden" line items** — NAT Gateway hourly + processing, data transfer, CloudWatch logs ingestion/storage, load balancer LCUs, KMS requests.
5. **Sanity-check with a small real deployment** — deploy a slice, watch the actual bill for a day via Cost Explorer, extrapolate. Real usage beats a spreadsheet.

The senior move is presenting **cost alongside the architecture diagram** — "here's the design, here's the estimated monthly cost, here's the biggest driver and how we'd reduce it." Cost as a design deliverable, not an afterthought.

## Well-Architected, Resilience & Multi-Region DR

### Summary

**What this topic covers**

How AWS wants you to think about building systems that survive failure, and the framework it provides for reasoning about it. This topic has 16 questions across three concern areas: (1) the **AWS Well-Architected Framework** — its six pillars and how they turn "build it well" into a reviewable checklist; (2) **resilience design** — designing for failure, blast-radius reduction, availability math, statelessness, graceful degradation, retries with backoff/jitter, idempotency, decoupling, and chaos engineering; and (3) **multi-region disaster recovery** — the four DR strategies (backup & restore, pilot light, warm standby, multi-site active-active), RTO vs RPO, cross-region replication (Aurora Global, DynamoDB Global Tables, S3 CRR), and failover mechanics. The core distinction the topic hammers: **multi-AZ is high availability *within* a region; multi-region is disaster recovery / global reach** — they solve different problems at very different costs, and conflating them is a senior-level red flag.

**Mental model**

Resilience is **assuming things will fail and designing so that failure is survivable and localised**. Werner Vogels' line — "everything fails all the time" — is the mindset: instances die, AZs have outages, dependencies time out, and occasionally a whole region degrades. You design for each failure *domain* at the right level. Within a region, you get HA by spreading across **Availability Zones** (physically separate data centers with independent power/network) — a multi-AZ deployment survives losing an AZ automatically. That handles the common case. Across regions, you get **DR and global reach** — protection against a region-wide event or the need to serve users near them — but at the cost of data-replication complexity, latency, and roughly doubled spend. The second axis is **blast radius**: partition the system so one failure can't cascade — bulkheads, cell-based architecture, decoupling via queues, circuit breakers. The third is **the recovery contract**: **RTO** (how fast you recover) and **RPO** (how much data you can lose) are business decisions that determine which DR strategy — and cost — you choose. You don't build the most resilient thing possible; you build the resilience the business is willing to pay for, and you *know the number*.

**Key terms**

- **Availability Zone (AZ)** — one or more discrete data centers with independent power/cooling/network within a region; the unit of HA within a region.
- **Region** — a geographic collection of AZs; the unit of DR and data-residency isolation.
- **Well-Architected Framework** — AWS's six-pillar best-practice framework and review process.
- **RTO (Recovery Time Objective)** — maximum acceptable downtime to restore service after a disaster.
- **RPO (Recovery Point Objective)** — maximum acceptable data loss, measured as time (e.g. "5 minutes of data").
- **Backup & Restore / Pilot Light / Warm Standby / Multi-Site** — the four DR strategies, from cheapest/slowest to priciest/fastest.
- **Aurora Global Database** — Aurora replicated across regions with ~1s lag and fast cross-region failover.
- **DynamoDB Global Tables** — multi-region, multi-active DynamoDB replication (last-writer-wins).
- **S3 Cross-Region Replication (CRR)** — async object replication to a bucket in another region.
- **Route 53 health checks & failover routing** — DNS-level health checking that fails traffic over to a healthy endpoint/region.
- **AWS Fault Injection Service (FIS)** — managed chaos-engineering service for controlled failure experiments.
- **Idempotency** — an operation that can be safely retried without changing the result beyond the first application.
- **Backoff with jitter** — retry strategy that spaces retries exponentially and randomizes them to avoid synchronized retry storms.
- **Cell-based architecture** — partitioning into independent cells so a failure affects one cell's users, not all.

**Why interviewers ask this**

Resilience is the clearest senior/junior discriminator in a design interview. A junior "makes it work"; a senior "makes it survive failure" and can *quantify* the trade-off. The multi-AZ vs multi-region question is a favourite filter — a candidate who reaches for multi-region to solve an AZ-failure problem is over-engineering and burning money; one who thinks multi-AZ covers a regional outage is under-designing. Interviewers want to hear RTO/RPO framed as *business* decisions that drive *technical* choices, not the other way around. They probe whether you design for failure proactively (health checks, retries with jitter, idempotency, DLQs, circuit breakers) or bolt reliability on afterward. And "how would you know it works?" — game days, chaos engineering, actually testing failover — separates people who've operated production systems from people who've only drawn diagrams.

**Common confusions**

- "Multi-AZ protects against a region failure" — no; multi-AZ is HA *within* one region. A region-wide event needs multi-region DR.
- "RTO and RPO are the same" — RTO is *downtime* tolerance; RPO is *data-loss* tolerance. A system can have a 5-minute RPO but a 4-hour RTO, or vice versa.
- "More nines is always better" — each nine multiplies cost and complexity; you buy the availability the business needs, not the maximum achievable.
- "Retries make things more reliable" — naive retries without backoff/jitter and idempotency cause retry storms and duplicate side effects, making outages *worse*.
- "Active-active is just active-passive with both sides on" — active-active needs conflict resolution, data consistency strategy, and traffic-splitting; it's materially harder.
- "We have backups, so we have DR" — untested backups aren't DR; DR is a tested, time-bounded recovery process with a known RTO/RPO.

**What follows from this topic**

This topic is the reliability spine of the whole primer. The availability math and multi-AZ patterns connect to **compute, load balancing, and databases**; cross-region replication to the **storage and database** topics; decoupling and DLQs to **messaging (SQS/SNS/EventBridge)**; and the whole thing is one of the six **Well-Architected** pillars, so it overlaps with the **Cost Optimization** topic on the classic cost-vs-resilience trade-off. It feeds directly into the **Scenario Design & Common Pitfalls** capstone, where "single-AZ database" and "no DLQ" are canonical anti-patterns.

### Q1. What are the six pillars of the AWS Well-Architected Framework?

The Well-Architected Framework is AWS's set of best practices for building on the cloud, organised into six pillars, each with a set of design principles and a review questionnaire:

1. **Operational Excellence** — running and monitoring systems, continuous improvement. IaC, observability, runbooks, learning from failure (game days, post-incident reviews).
2. **Security** — protecting data and systems. Least privilege, defence in depth, encryption everywhere, traceability, automated security.
3. **Reliability** — recovering from failure and meeting demand. Multi-AZ, automatic recovery, testing recovery, managing quotas, horizontal scaling.
4. **Performance Efficiency** — using resources efficiently as demand changes. Right service for the job, serverless where it fits, experimenting, global reach via edge.
5. **Cost Optimization** — avoiding unnecessary spend. Right-sizing, managed services, pay-per-use, measuring and attributing cost.
6. **Sustainability** — minimizing environmental impact. Efficient resource use, Graviton, right-sizing, region choice.

The **Well-Architected Tool** in the console walks you through the questions and produces a list of risks. The senior insight is that the pillars **trade off against each other** — more reliability often costs more, more security can hurt performance — and architecture is the art of balancing them against business priorities, not maximizing all six.

### Q2. What does "design for failure" mean in practice on AWS?

"Design for failure" (Werner Vogels: "everything fails all the time") means **assuming every component will fail and ensuring the system survives it** rather than hoping it won't. Concretely:

- **No single points of failure** — run across multiple AZs, multiple instances behind a load balancer, replicated data.
- **Automatic recovery** — Auto Scaling replaces dead instances, ELB health checks route around unhealthy targets, managed services (RDS Multi-AZ) fail over automatically.
- **Timeouts and retries everywhere** — never wait forever on a dependency; retry transient failures with backoff and jitter.
- **Graceful degradation** — when a dependency is down, serve a reduced experience (cached data, default response) instead of failing entirely.
- **Decoupling** — queues and events between components so a slow/failed downstream doesn't take down upstream.
- **Idempotency** — so retries and at-least-once delivery don't corrupt state.
- **Test the failure** — actually kill instances and AZs (chaos engineering / game days) to prove the recovery works.

The mindset flip: reliability isn't a feature you add; it's a property you design in from the failure-mode up.

### Q3. Explain the difference between multi-AZ and multi-region. When do you need each?

This is the central distinction:

| | Multi-AZ | Multi-Region |
|---|---|---|
| Solves | HA within a region | DR + global reach + data residency |
| Protects against | instance/AZ failure | region-wide outage |
| Latency between | ~single-digit ms | tens-hundreds of ms |
| Data replication | synchronous (usually) | asynchronous (usually) |
| Cost | ~2x within region | ~2x+ overall, more complexity |
| Default for | virtually all production | high-criticality / global apps |

**Multi-AZ** is the baseline for any production workload: spread compute across AZs behind a load balancer, run RDS Multi-AZ, use a regional service like S3 or DynamoDB (which are already multi-AZ). It survives losing a data center automatically and costs little extra thought. **This is what "highly available" almost always means.**

**Multi-region** is for when you need to survive an entire region failing (DR for critical systems), serve users globally with low latency, or meet data-residency requirements. It's materially more expensive and complex — async replication means potential data loss (RPO > 0), and you need failover orchestration (Route 53) and conflict handling for active-active.

The senior answer: **reach for multi-AZ by default; justify multi-region with a specific business requirement** (RTO/RPO for a region outage, global latency, compliance) — never as reflexive gold-plating.

### Q4. What are the four disaster-recovery strategies and how do they trade off?

AWS defines four DR strategies along a cost-vs-recovery-speed spectrum:

| Strategy | How it works | RTO | RPO | Cost |
|---|---|---|---|---|
| **Backup & Restore** | back up data (snapshots, S3), rebuild in DR region on disaster | hours | hours | lowest |
| **Pilot Light** | core data replicated + minimal infra idle; scale up on disaster | 10s of min | minutes | low |
| **Warm Standby** | scaled-down but *running* full stack in DR; scale up on failover | minutes | seconds | medium |
| **Multi-Site Active-Active** | full stack live in both regions serving traffic | near-zero | near-zero | highest |

**Backup & Restore** — cheapest; you keep backups cross-region and rebuild everything when disaster strikes. Accept hours of downtime. Fine for non-critical systems.

**Pilot Light** — the critical data is continuously replicated and a minimal "pilot light" (e.g. a database replica, AMIs ready) is kept warm; on disaster you provision and scale the rest. Faster than backup/restore, still cheap.

**Warm Standby** — a fully functional but under-scaled copy runs continuously in the DR region; failover means scaling it up and redirecting traffic. Fast recovery, moderate cost.

**Multi-Site Active-Active** — both regions serve production traffic simultaneously; a region loss is just a capacity reduction. Near-zero RTO/RPO but the highest cost and complexity (data conflict resolution, global routing).

The choice is driven by the business's **RTO/RPO tolerance vs. budget** — you pick the cheapest strategy that meets the required recovery numbers.

### Q5. Define RTO and RPO. How do they drive DR design?

- **RTO (Recovery Time Objective)** — the maximum acceptable *downtime*. "We must be back up within 1 hour." Drives how *fast* your recovery mechanism must be.
- **RPO (Recovery Point Objective)** — the maximum acceptable *data loss*, expressed as time. "We can lose at most 5 minutes of data." Drives how *frequently* you replicate/back up.

They're **independent business decisions**. A system might tolerate 4 hours of downtime (loose RTO) but no data loss (tight RPO) — that needs continuous replication but not a hot standby. Another might need instant failover (tight RTO) but tolerate losing the last minute (loose RPO).

They map directly onto DR strategy:

- Tight RTO **and** RPO (minutes/seconds) → warm standby or active-active.
- Loose RTO, tight RPO → continuous replication with slower recovery (pilot light with good replication).
- Loose both → backup & restore.

The senior discipline is **getting the numbers from the business first**, then choosing the cheapest architecture that meets them — not picking an architecture and hoping the recovery characteristics are acceptable. "What's your RTO and RPO?" is the first question a good architect asks in a DR conversation.

### Q6. How do health checks and failover work at the DNS and load-balancer level?

Two layers, different scopes:

**Load balancer (within region)** — an ALB/NLB continuously health-checks its registered targets (HTTP path or TCP port). Unhealthy targets are pulled from rotation automatically; combined with Auto Scaling health checks, dead instances are replaced. This handles instance/AZ-level failover *inside* a region, transparently and fast (seconds).

**Route 53 (cross-region / global)** — DNS-level. Route 53 health checks probe endpoints and, combined with routing policies, fail traffic over:

- **Failover routing** — primary/secondary; if the primary's health check fails, DNS returns the secondary. Classic active-passive DR.
- **Latency-based / geolocation routing** — send users to the nearest healthy region (active-active or global reach).
- **Weighted routing** — split traffic by percentage (canary, gradual region shift).

The catch with DNS failover is **TTL and client caching** — resolvers cache the record for the TTL, so failover isn't instant; keep TTLs low (e.g. 60s) on records you intend to fail over. For truly fast global failover, **AWS Global Accelerator** uses anycast IPs and health-checks at the network layer, shifting traffic without DNS propagation delay.

### Q7. How do you replicate data across regions? Compare the main options.

Different data stores, different mechanisms:

- **Aurora Global Database** — one primary region + up to 5 read-only secondary regions, storage-level replication with typically <1s lag, and cross-region failover in ~1 minute. RPO near-zero, RTO low. The go-to for relational DR with tight objectives.
- **DynamoDB Global Tables** — fully managed multi-region, **multi-active** (write in any region) replication, last-writer-wins conflict resolution, ~sub-second propagation. Great for globally-distributed low-latency apps and active-active DR.
- **S3 Cross-Region Replication (CRR)** — asynchronous object replication to a bucket in another region; used for DR of object data, compliance, and lower-latency global reads. Optionally with Replication Time Control (RTC) for a 15-minute SLA.
- **RDS cross-region read replicas** — async replica in another region you can promote on disaster (higher RPO/RTO than Aurora Global).
- **ElastiCache Global Datastore** — cross-region Redis replication for global caching/DR.

The trade-off axis is **synchronous vs asynchronous**. Cross-region is essentially always **async** (the speed of light makes synchronous cross-region writes too slow), which means **RPO > 0** — some in-flight data can be lost on a sudden region failure. Aurora Global and DynamoDB Global Tables minimize the lag; you choose based on how much loss and latency the business tolerates.

### Q8. Why is stateless design important for resilience, and how do you externalize state?

Stateless design means an application instance holds **no client-specific state between requests** — any instance can serve any request. This is foundational to resilience and scaling because:

- **Any instance is disposable** — kill one and the load balancer routes to another with no lost session; Auto Scaling can add/remove freely.
- **Horizontal scaling just works** — no sticky sessions pinning users to a box that might die.
- **Failover is trivial** — there's no per-instance state to reconstruct.

The state has to live *somewhere*, so you **externalize** it:

- **Session state** → ElastiCache (Redis) or DynamoDB, not local memory.
- **Uploaded files / artifacts** → S3, not the local disk.
- **Application data** → the database.
- **Caches** → shared ElastiCache, not per-instance in-memory (or accept per-instance cache as a performance optimization that's safe to lose).

The anti-pattern is storing state in a Lambda's `/tmp`, an EC2 instance's local disk, or in-process memory and assuming it persists — it doesn't survive the instance dying, which *will* happen. Stateless-plus-externalized-state is what makes the "cattle not pets" model work.

### Q9. What is graceful degradation, and how do circuit breakers help?

**Graceful degradation** is continuing to serve a *reduced* experience when a dependency fails, rather than failing the whole request. If the recommendations service is down, show generic popular items instead of a 500. If the live inventory service times out, show cached inventory with a "may be out of date" note. The user gets a working (if diminished) product instead of an error.

The **circuit breaker** pattern is a key enabler. Instead of hammering a failing dependency with requests that will time out (wasting resources and slowing your own service), the circuit breaker:

1. **Closed** (normal) — requests flow through.
2. **Open** (tripped after N failures) — requests fail fast immediately (or return a fallback) without calling the dependency, giving it room to recover and keeping *your* service responsive.
3. **Half-open** (after a cooldown) — let a trial request through; if it succeeds, close the circuit; if not, stay open.

Without a circuit breaker, a slow downstream causes threads/connections to pile up waiting on timeouts, and the failure **cascades** upstream until the whole system is unresponsive. The breaker contains the blast radius. Combined with **bulkheads** (isolating resource pools per dependency), it stops one sick dependency from sinking the whole ship.

### Q10. What is chaos engineering, and what does AWS Fault Injection Service do?

**Chaos engineering** is the practice of deliberately injecting failures into a system to verify it behaves as designed — turning "we think it's resilient" into "we've proven it's resilient." You form a hypothesis ("if we lose an AZ, traffic shifts and latency stays under X"), inject the failure in a controlled way, and observe whether reality matches. Netflix's Chaos Monkey popularized it.

**AWS Fault Injection Service (FIS)** is the managed tool for running these experiments. It can inject controlled, realistic failures:

- Terminate EC2 instances or stop them.
- Simulate AZ failures (network disruption).
- Inject latency or errors, throttle API calls.
- Stress CPU/memory, fail over RDS, kill ECS tasks.

Crucially FIS has **stop conditions (guardrails)** — CloudWatch alarms that automatically halt and roll back the experiment if it causes real customer harm, so you can experiment safely, even in production. The discipline is to run experiments as **game days** with a hypothesis, monitoring, and a blast-radius limit — starting small (one instance) and expanding confidence (an AZ) as you validate. The value is finding the resilience gaps *on your schedule* rather than at 3am during a real outage.

### Q11. How do you implement retries correctly with backoff and jitter?

Naive retries make outages *worse*: if every client retries immediately and in lockstep, a briefly-overloaded service gets hammered by a synchronized **retry storm** the moment it tries to recover — a self-inflicted DDoS.

The correct pattern is **exponential backoff with jitter**:

- **Exponential backoff** — wait increasingly longer between retries (e.g. 100ms, 200ms, 400ms, 800ms), giving the dependency time to recover.
- **Jitter** — randomize the wait so retries *spread out* instead of all firing at the same instant. Without jitter, exponential backoff still synchronizes clients. AWS's guidance is "full jitter": `sleep = random(0, base * 2^attempt)`.

Additional rules:

- **Cap the number of retries and the max delay** — don't retry forever.
- **Only retry retryable errors** — transient (throttling, 503, timeout) yes; a 400 bad request, no.
- **Combine with idempotency** — retries mean an operation may execute more than once; it must be safe to (see next question).
- **Respect Retry-After / throttling signals** from the service.

Most AWS SDKs implement exponential backoff with jitter by default — the interview point is knowing *why* (avoid retry storms) and that your own inter-service calls need the same discipline.

### Q12. What is idempotency and why does it matter for reliable systems?

An **idempotent** operation produces the same result whether applied once or many times. `SET balance = 100` is idempotent; `ADD 50 to balance` is not.

It matters because distributed systems have **at-least-once delivery and retries everywhere**: SQS can deliver a message more than once, a client may retry after a timeout even though the first request actually succeeded, and Lambda/queue consumers can re-process. Without idempotency, these duplicates cause double-charges, duplicate orders, or corrupted counters.

How you achieve it:

- **Idempotency keys** — the client sends a unique key per logical operation; the server records processed keys (e.g. in DynamoDB with a conditional write) and ignores duplicates. This is how payment APIs (and API Gateway's idempotency support) work.
- **Natural idempotency** — design operations as "set to this state" rather than "increment," so re-applying is harmless.
- **Deduplication** — SQS FIFO queues offer a 5-minute dedup window via message dedup IDs; DynamoDB conditional writes reject duplicates.
- **Upserts** — `PUT` semantics keyed on a business ID.

The senior point: **at-least-once + idempotent consumer = effectively-once processing**, which is far cheaper and more robust than trying to guarantee exactly-once delivery (which is nearly impossible in distributed systems). Idempotency is how you make retries and duplicate delivery *safe*.

### Q13. How can service quotas become a reliability risk?

Every AWS service has **service quotas (limits)** — default caps on things like Lambda concurrent executions (1000 by default per region), EC2 instances per type, API request rates, VPC counts, EBS volume totals, etc. These are a **silent reliability risk** because you hit them exactly when you're scaling to handle load — the worst moment.

Failure modes:

- **Lambda hitting concurrency limit** → throttled invocations, dropped events, backed-up queues during a traffic spike.
- **API throttling** (e.g. hitting a DynamoDB or a control-plane API rate limit) → cascading retries and failures.
- **Running out of Elastic IPs / ENIs / NAT capacity** → new instances can't launch during a scale-out.

Managing it:

- **Monitor quota usage** — Service Quotas dashboard and CloudWatch metrics; alarm on approaching limits (e.g. 80%).
- **Request increases proactively** — before a launch or known traffic event, not during the incident.
- **Design with quotas in mind** — reserved concurrency for critical Lambdas, spread across regions/accounts if you'll exceed a per-account cap.
- **Account for quotas in DR** — your DR region needs the same quota increases as prod, or failover will throttle. This is a commonly-missed DR gap.

The senior signal: treating quotas as a **capacity-planning input**, not a surprise error message.

### Q14. How does decoupling improve resilience? What tools does AWS provide?

Decoupling means components communicate **asynchronously through an intermediary** rather than calling each other directly and synchronously. It improves resilience because a failure or slowdown in one component doesn't immediately propagate to its callers — the intermediary absorbs the shock.

Concretely, put a **queue or event bus** between a producer and consumer:

- **SQS** — a queue buffers work. If the consumer is down or slow, messages accumulate safely instead of erroring; the consumer processes them when it recovers. This *smooths spikes* (load leveling) and *isolates failure*.
- **SNS / EventBridge** — pub/sub fan-out; producers don't know or care who consumes, so adding/removing/failing consumers doesn't affect the producer.
- **Kinesis** — buffered streaming for high-throughput event pipelines.

Key resilience patterns this enables:

- **Load leveling** — a queue in front of a database or downstream absorbs bursts the downstream couldn't handle directly.
- **Dead-letter queues (DLQs)** — messages that repeatedly fail processing get shunted aside for investigation instead of blocking the queue or being lost. *Every* async consumer should have a DLQ.
- **Retry isolation** — the queue handles retry/visibility-timeout mechanics, so a transient consumer failure just re-delivers later.

The anti-pattern decoupling fixes is the **synchronous call chain** where a slow service N levels deep stalls everything upstream. Buffer it with a queue and the blast radius shrinks.

### Q15. What is a game day and how do you run one?

A **game day** is a scheduled exercise where a team deliberately triggers failures (or simulates an incident) in a controlled way to test both the *system's* resilience and the *team's* response — runbooks, alerting, on-call procedures, communication.

Why: architecture that's "resilient on paper" often isn't, and the only way to know is to try. Game days surface gaps — a missing alarm, a runbook step that's wrong, a failover that takes 3x the assumed RTO, a dependency nobody knew was single-region.

How to run one:

1. **Hypothesis** — "if the primary RDS instance fails, we recover within our 5-minute RTO with no data loss." State the expected behaviour.
2. **Blast radius & guardrails** — start in staging or a limited prod slice; define stop conditions (CloudWatch alarms via FIS) to auto-abort if real harm occurs.
3. **Inject the failure** — kill the instance/AZ (FIS), sever a dependency, exhaust a quota.
4. **Observe** — does the system recover? Do alarms fire? Does the on-call get paged? Does the runbook work?
5. **Measure vs. hypothesis** — was the actual RTO/RPO within target?
6. **Post-mortem & fix** — capture gaps, file action items, improve, and repeat regularly.

Game days are a core **operational excellence** practice. The cultural payoff is a team that has *rehearsed* incidents responds calmly to real ones — the difference between a practiced fire drill and panic.

### Q16. What is cell-based architecture and how does it reduce blast radius?

**Cell-based architecture** partitions a system into multiple independent, self-contained **cells**, each a full stack (compute + data) serving a subset of users/tenants, with no shared state between cells. A router maps each request to its cell.

The point is **blast-radius reduction**. In a monolithic shared architecture, a bad deploy, a poison-pill request, a hot partition, or a resource-exhaustion bug takes down *all* users. With cells, such a failure is contained to **one cell** — only that fraction of users is affected, while every other cell keeps serving. It converts a total outage into a partial one.

Benefits and mechanics:

- **Fault isolation** — a failure (or a noisy/malicious tenant) can't escape its cell.
- **Independent scaling and deploys** — roll out to one cell first (a natural canary); if it breaks, blast radius is one cell.
- **Bounded, known cell capacity** — each cell is tested to a known limit, so behaviour under load is predictable, and you scale by *adding cells* rather than growing one shared system into the unknown.
- **Cell routing** — a thin, highly-reliable routing layer (this is the one shared component, so it's kept deliberately simple) assigns users to cells.

It's the logical extreme of the bulkhead pattern applied at the system level, and it's how large multi-tenant AWS services themselves are built. The trade-off is operational complexity — many cells to manage — so it's justified when the cost of a *total* outage is unacceptable.

## Scenario Design & Common Pitfalls

### Summary

**What this topic covers**

The capstone: putting the whole primer together to *design* systems on AWS and to *spot* the anti-patterns that sink them. This topic has 16 questions in two flavours: (a) **short architecture-design scenarios** — image-upload pipelines, multi-tenant SaaS, URL shorteners, real-time analytics ingestion, HA web apps, serverless REST APIs, monolith migration, event-driven order processing — each answered with a concrete reference architecture that names real services and *justifies* each choice against constraints; and (b) **"spot the anti-pattern / what breaks at scale / what's the security or cost problem here"** questions — hardcoded credentials, public S3 buckets, single-AZ databases, cross-AZ NAT cost, Lambda-in-VPC without endpoints, DynamoDB Scan in a hot path, missing DLQs, over-broad IAM, state stored in Lambda. The goal is to think like an interviewer's whiteboard demands: clarify the requirements, pick services against constraints, justify the trade-offs, and address security, cost, and reliability without being asked.

**Mental model**

An AWS design interview is not a trivia quiz; it's a **structured conversation about trade-offs**. The reliable method: (1) **clarify requirements** — scale (RPS, data volume, users), latency, consistency, availability targets (RTO/RPO), budget, and constraints (compliance, existing stack). Never start drawing before you know these. (2) **Sketch the happy path** — a simple end-to-end design that works, naming concrete services. (3) **Address the cross-cutting concerns unprompted** — security (IAM least privilege, encryption, no public buckets), reliability (multi-AZ, DLQs, retries), cost (the three meters, cross-AZ, NAT), and scale (where it breaks and how you'd shard/cache/queue). (4) **Justify every service choice** — "SQS here because we need to decouple and absorb spikes; DynamoDB because the access pattern is key-based and we need single-digit-ms at scale." The senior differentiator is **naming the trade-off you're making and why it's acceptable here** — and knowing the anti-patterns cold, because half of real architecture is *not doing the dumb thing*. When you see a design, run the same checklist backward: where's the single point of failure, the open security hole, the hidden cost, the thing that melts at 10x?

**Key terms**

- **Reference architecture** — a proven service composition for a common problem shape.
- **Anti-pattern** — a common design that seems reasonable but fails on security, cost, reliability, or scale.
- **Blast radius** — how much breaks when one component fails; you design to minimize it.
- **Hot path** — the latency-critical code path serving live requests; must not contain slow/unbounded operations.
- **DLQ (Dead-Letter Queue)** — where messages go after repeated processing failures, so they're not lost or blocking.
- **Least privilege** — granting exactly the permissions needed, no more; the default IAM posture.
- **VPC endpoint** — private connectivity to AWS services (Gateway for S3/DynamoDB, Interface for others) avoiding NAT/internet.
- **Fan-out** — one event triggering many parallel consumers (SNS/EventBridge → multiple targets).
- **Single-table design** — DynamoDB pattern modeling multiple entity types in one table around access patterns.
- **Presigned URL** — a time-limited, signed S3 URL letting a client upload/download directly without proxying through your backend.
- **Idempotency key** — a client-supplied key making a repeated request safe to process once.

**Why interviewers ask this**

This is where everything converges and where senior candidates pull away. Interviewers watch *process*: do you clarify before designing, or bolt straight into services? Do you name concrete AWS services and justify them, or hand-wave "a database" and "some queues"? Can you reason about where the design breaks at 10x and evolve it? Crucially, do you address **security, cost, and reliability without being prompted** — the senior tells. The anti-pattern questions test whether you've operated real systems: anyone can recite "S3 is object storage," but only someone who's been burned instantly flags a public bucket, a single-AZ prod database, or a DynamoDB Scan in the request path. A great candidate treats "design X" and "what's wrong with this?" as the same skill viewed from two directions — construction and code review of architecture.

**Common confusions**

- "There's one right architecture" — there isn't; there's the right architecture *for these constraints*. The trade-off reasoning is the answer, not the diagram.
- "More services = better design" — over-engineering (multi-region for an internal tool, microservices for an MVP) is as much a red flag as under-engineering.
- "Make it work first, secure it later" — security and cost are design inputs, not post-hoc patches; retrofitting is expensive and leaky.
- "Scan and Query are interchangeable in DynamoDB" — Scan reads the whole table (slow, expensive, throttles); Query hits a key. Scan in a hot path is a canonical anti-pattern.
- "Public S3 bucket = the easy way to serve files" — it's a data-breach headline waiting to happen; use CloudFront + OAC or presigned URLs.
- "Lambda can hold state between invocations" — the execution environment is ephemeral and reused unpredictably; never rely on it for correctness.

**What follows from this topic**

This topic is the integration point for the entire primer. Every design pulls from the others: compute (Lambda/ECS/EC2), storage (S3/EBS), databases (DynamoDB/RDS/Aurora), networking (VPC/endpoints), messaging (SQS/SNS/EventBridge), security (IAM), observability (CloudWatch), the **Cost Optimization** topic (the three meters, cross-AZ, NAT), and the **Well-Architected & Resilience** topic (multi-AZ, DLQs, RTO/RPO). If you can move fluently between "design this" and "spot what's wrong with this," you've internalized the whole primer — which is exactly the signal an AWS interview is built to detect.

### Q1. How should you approach an AWS system-design interview question?

Follow a repeatable method rather than diving into services:

1. **Clarify requirements** — functional (what does it do?) and non-functional: expected scale (RPS, users, data volume, growth), latency targets, consistency needs, availability/DR targets (RTO/RPO), budget sensitivity, compliance/data-residency, and any existing-stack constraints. Ask before you draw. This alone signals seniority.
2. **State assumptions** — pin down the numbers you'll design against ("assume 10k RPS peak, 100 GB/day ingest, single region for now").
3. **Sketch the happy path** — a simple end-to-end architecture naming concrete services, data flowing from client to storage and back.
4. **Address cross-cutting concerns unprompted** — security (IAM least privilege, encryption, no public data), reliability (multi-AZ, decoupling, DLQs, retries), cost (the three meters, cross-AZ, NAT), scaling (caching, sharding, queues).
5. **Justify each choice and its trade-off** — "DynamoDB not RDS because access is key-based and we need predictable single-digit-ms at scale; the trade-off is we lose ad-hoc queries, acceptable because our patterns are known."
6. **Evolve under pressure** — "at 10x this bottlenecks here; I'd add a cache / shard / queue."

The senior differentiator is **owning the trade-offs** — every choice costs something, and naming that cost is the signal.

### Q2. Design a scalable image-upload and processing pipeline.

**Requirements to clarify**: expected upload rate, image sizes, processing types (thumbnails, ML tagging), latency (sync vs async result).

**Reference architecture**:

1. **Client → S3 directly via presigned URL.** The backend issues a time-limited presigned PUT URL; the client uploads straight to S3. This keeps large binaries *out* of your compute — no proxying uploads through EC2/Lambda (which have payload limits and cost).
2. **S3 event → SQS → processing.** The `s3:ObjectCreated` event lands in an SQS queue (buffering + decoupling), consumed by Lambda (for light processing) or Fargate/ECS (for heavy/long jobs beyond Lambda's 15-min limit).
3. **Processing writes outputs** — thumbnails/derivatives back to S3, metadata to DynamoDB.
4. **DLQ** on the queue for images that fail processing repeatedly.
5. **Serve via CloudFront** in front of S3 (OAC-secured) for cached, cheap global delivery.

**Why these choices**: presigned URLs offload bandwidth and decouple upload from processing; S3 events + SQS give durable, spike-absorbing decoupling; Lambda for cheap scale-to-zero (or Fargate when jobs exceed Lambda limits); DynamoDB for fast metadata lookups; CloudFront to cut egress cost and latency. The pattern scales horizontally at every stage and the queue absorbs bursts.

### Q3. Design a multi-tenant SaaS backend.

**Clarify**: number/size of tenants, isolation requirements (compliance-driven hard isolation vs. soft), noisy-neighbour concerns, per-tenant customization.

The central decision is the **isolation model**:

| Model | Isolation | Cost/ops | Use when |
|---|---|---|---|
| **Silo** (resources per tenant) | strongest | high (per-tenant infra) | strict compliance, large enterprise tenants |
| **Pool** (shared resources, tenant ID on rows) | weakest | lowest | many small tenants, cost-sensitive |
| **Bridge** (hybrid — pooled compute, some siloed data) | medium | medium | mixed tenant sizes |

**Reference architecture (pooled, common case)**:

- **API Gateway + Lambda/ECS** — shared compute; every request carries a **tenant ID** from the JWT (Cognito).
- **DynamoDB single-table** with tenant ID as the partition key prefix — cheap, scalable, tenant-isolated by key.
- **Enforce isolation in code/IAM** — dynamic IAM policies or a data-access layer that *always* scopes queries by tenant ID (the critical correctness/security control — a leak here is a cross-tenant breach).
- **Per-tenant cost tracking** via tags/usage metering.
- **Address noisy neighbours** — per-tenant throttling (API Gateway usage plans), and for premium tenants, consider silo/bridge.

**Why**: pooled maximizes cost efficiency at scale; the trade-off is that isolation becomes a *software* responsibility you must get exactly right. Silo isolation for tenants who pay for and require it.

### Q4. Design a URL shortener.

**Clarify**: scale (reads vs writes — heavily read-skewed), latency (must be fast redirect), custom aliases, analytics, link expiry.

**Reference architecture**:

1. **Write path**: `POST /shorten` → API Gateway → Lambda → generate a short key (base62 of a counter/UUID, or hash) → store `shortKey → longURL` in **DynamoDB** (partition key = shortKey). DynamoDB because the access pattern is a pure key lookup at massive scale with single-digit-ms latency.
2. **Read path (the hot path)**: `GET /{shortKey}` → API Gateway → Lambda → DynamoDB `GetItem` → 301/302 redirect. Front with **CloudFront/caching** since the same popular links are hit repeatedly — cache the redirects to cut latency and DynamoDB reads.
3. **Scale considerations**: reads dwarf writes, so optimize reads (cache, DynamoDB on-demand or well-provisioned). Use **302** if you want analytics on every hit (no caching of the redirect) or **301 + edge cache** for max performance.
4. **Analytics** (optional): emit click events to Kinesis/EventBridge → async aggregation, keeping the redirect path fast.
5. **Expiry**: DynamoDB TTL attribute auto-deletes expired links.

**Why**: DynamoDB fits the key-value access pattern and scales effortlessly; caching handles the read skew; keeping analytics async keeps the hot redirect path minimal. Avoid RDS here — you don't need relational queries, you need a fast key lookup.

### Q5. Design a real-time analytics ingestion pipeline.

**Clarify**: event volume (events/sec), latency requirement (true real-time vs near-real-time), query patterns, retention.

**Reference architecture**:

1. **Ingest**: producers → **Kinesis Data Streams** (or Kafka/MSK for very high throughput). Kinesis buffers high-throughput event streams durably and lets multiple consumers read independently. (For simpler needs, **Kinesis Data Firehose** direct to S3.)
2. **Process**:
   - **Real-time path**: Kinesis → Lambda or Kinesis Data Analytics (Flink) for windowed aggregations/alerts.
   - **Batch/storage path**: **Firehose → S3** (partitioned by date) as the raw data lake.
3. **Store/serve**:
   - Ad-hoc SQL over S3 via **Athena**; dashboards in **QuickSight**.
   - Hot aggregates in DynamoDB or **OpenSearch** for low-latency dashboards.
   - Warehouse in **Redshift** for heavy analytical queries.
4. **Reliability**: Kinesis retains data (24h–365d) so consumers can replay; enable enhanced fan-out for multiple low-latency consumers.

**Why**: Kinesis (not SQS) because you need **ordered, replayable, high-throughput streaming** with multiple independent consumers — SQS is for decoupled work queues, not stream analytics. Firehose+S3 gives cheap durable storage and a lake; Athena avoids standing up a warehouse for occasional queries. Split the real-time and batch paths so each is optimized for its latency/cost profile (the classic Lambda/Kappa architecture idea).

### Q6. Design a highly available web application across Availability Zones.

**Clarify**: traffic, statefulness, database needs, availability target.

**Reference architecture** (the canonical multi-AZ three-tier):

1. **DNS**: Route 53 → **CloudFront** (edge caching, TLS, DDoS protection via Shield) → **Application Load Balancer**.
2. **Web/app tier**: **Auto Scaling Group across ≥2 AZs**, instances (or Fargate/ECS) behind the ALB. ALB health checks pull unhealthy targets; ASG replaces dead instances and scales on load. **Stateless** app tier — sessions in ElastiCache/DynamoDB, not local memory.
3. **Data tier**: **RDS Multi-AZ** (synchronous standby in another AZ, automatic failover) or Aurora (multi-AZ by design). Read replicas for read scaling.
4. **Static assets**: S3 + CloudFront.
5. **Caching**: ElastiCache (Redis) for sessions and hot data.
6. **Networking**: public subnets for the ALB, private subnets for app + data tiers; NAT Gateway (one per AZ) for outbound.

**Why**: spreading every tier across ≥2 AZs behind a load balancer with Auto Scaling gives automatic HA — losing an AZ is transparent. Stateless compute makes instances disposable. RDS Multi-AZ handles database failover automatically. This is *the* baseline pattern; note it's **multi-AZ (HA within a region)** — a full region outage would need multi-region DR, justified only if the business requires it.

### Q7. Design a serverless REST API.

**Clarify**: expected RPS, latency, auth, data model, spiky vs steady traffic.

**Reference architecture**:

1. **API Gateway** (REST or HTTP API) — the front door: routing, throttling, request validation, and auth integration. HTTP APIs are cheaper/faster for simple proxying; REST APIs add more features (request/response transformation, API keys, usage plans).
2. **Lambda** per route (or a lightweight framework in one Lambda) for business logic — scale-to-zero, pay-per-request, auto-scaling.
3. **DynamoDB** for data — the natural serverless database, single-digit-ms, on-demand capacity that scales with the API. Single-table design around access patterns.
4. **Auth**: **Cognito** (or a Lambda authorizer / JWT) at API Gateway.
5. **Async work** offloaded to SQS/EventBridge so the API responds fast.

**Scale/reliability notes**:

- **Lambda concurrency** default 1000/region — request increases and use **reserved/provisioned concurrency** for critical or latency-sensitive routes (provisioned to avoid cold starts).
- **DynamoDB on-demand** so capacity tracks the spiky API.
- Idempotency keys for safe retries on writes.

**Why**: this stack is fully managed, scales automatically, costs near-zero when idle (ideal for spiky/unpredictable APIs), and has minimal ops. The trade-offs to acknowledge: cold starts (mitigate with provisioned concurrency), the 15-min/payload Lambda limits (offload long jobs), and DynamoDB's access-pattern-first modeling.

### Q8. How would you migrate a monolith to AWS?

Don't boil the ocean. Use a **phased strategy** (the "6 R's" framework — rehost, replatform, refactor, repurchase, retire, retain):

1. **Rehost ("lift and shift")** first — move the monolith onto EC2 (or containerize onto ECS/Fargate) largely as-is. Fastest path to the cloud; get off the old data center, establish networking (VPC), and stabilize.
2. **Replatform** — swap components for managed services with minimal code change: self-managed DB → **RDS/Aurora**, self-managed cache → **ElastiCache**, file storage → **S3/EFS**. Cuts ops burden immediately.
3. **Refactor incrementally** — apply the **strangler-fig pattern**: put an API Gateway/ALB in front, and peel off one capability at a time into a Lambda/microservice, routing that path to the new service while the monolith shrinks. Decouple with SQS/EventBridge as you extract.
4. **Modernize the data layer** — split the shared database per service only where it earns its keep (don't distribute a monolith's DB reflexively).

**Cross-cutting**: multi-AZ from the start, IAM least privilege, CI/CD, observability (CloudWatch/X-Ray), and cost tracking.

**Why phased**: a big-bang rewrite is the classic migration failure. Rehost de-risks by decoupling "move to cloud" from "re-architect," then you modernize *incrementally* with the strangler pattern so you're always shippable and can stop when the ROI flattens. Not everything needs to become microservices — refactor where it pays.

### Q9. Design an event-driven order-processing system.

**Clarify**: order volume, steps (payment, inventory, fulfillment, notification), consistency needs, failure handling.

**Reference architecture**:

1. **Order intake**: API Gateway → Lambda → write order to DynamoDB, then publish an `OrderPlaced` event to **EventBridge** (or SNS).
2. **Fan-out to services**: EventBridge routes the event to independent consumers — **payment**, **inventory**, **fulfillment**, **notification** — each its own Lambda/service with its own SQS queue. Producers don't know consumers (loose coupling).
3. **Each consumer has a DLQ** for messages that fail after retries — no silent loss.
4. **Multi-step workflows with ordering/rollback**: use **Step Functions** to orchestrate a saga — payment → reserve inventory → ship — with compensating actions (refund, release inventory) if a step fails. Step Functions gives visibility, retries, and error handling for the coordinated flow.
5. **Idempotency**: each consumer uses idempotency keys — events may be delivered more than once.

**Choreography vs orchestration**: pure event fan-out (EventBridge) is **choreography** — simple, loosely coupled, but hard to see the end-to-end flow. **Step Functions** is **orchestration** — explicit, observable, easier error/rollback handling, at the cost of centralizing the flow. Real systems mix both: EventBridge for cross-service routing, Step Functions for a service's internal multi-step transaction.

**Why**: event-driven decouples services so they scale and fail independently; queues+DLQs make delivery reliable; Step Functions handles the saga where a distributed transaction needs coordination and rollback. Idempotency makes at-least-once delivery safe.

### Q10. Spot the anti-pattern: an application with AWS access keys hardcoded in its source code.

**The problem**: hardcoded long-lived credentials are a top cause of AWS breaches. They leak via committed source (public GitHub is scanned by attackers within minutes), logs, images, and backups; they're long-lived (no rotation); and they usually carry broad permissions. A leaked key can mean crypto-mining bills or data exfiltration.

**The fix — never embed credentials; use identity-based, short-lived ones**:

- **On EC2/ECS/Lambda** → **IAM roles** (instance profile / task role / execution role). The SDK automatically retrieves temporary, auto-rotated credentials from the instance metadata service — zero secrets in code.
- **For humans/CI** → **IAM Identity Center (SSO)** and temporary STS credentials, not long-lived IAM user keys.
- **For app secrets** (DB passwords, API keys) → **Secrets Manager** (auto-rotation) or SSM Parameter Store, fetched at runtime.
- **Cross-account** → assume-role with STS.
- **Guardrails**: git-secrets/pre-commit scanning, GuardDuty for anomalous credential use, and **never create IAM user access keys** if a role will do.

The one-line answer an interviewer wants: **"Use an IAM role — the workload gets temporary, auto-rotated credentials from the metadata service, so there's no secret to leak."**

### Q11. Spot the anti-pattern: an S3 bucket made public to serve files to users.

**The problem**: a public bucket is a recurring data-breach headline — public buckets have leaked millions of records. "Public" often means *listable and readable by anyone*, and it's easy to accidentally expose more than intended (whole bucket vs. specific objects). It also bypasses any access control, logging of *who* accessed what, and egress control.

**The fix**:

- **Keep the bucket private** — **Block Public Access** on (account-level too), and serve via **CloudFront with Origin Access Control (OAC)**. CloudFront reads from the private bucket; users hit CloudFront. This adds caching, cheaper egress, TLS, and WAF/DDoS protection.
- **For user-specific or temporary access** → **presigned URLs** (time-limited, signed) rather than public objects.
- **Encrypt** (SSE-S3/SSE-KMS, on by default now) and enable **access logging**.
- **Least-privilege bucket policies** — grant to the CloudFront OAC principal, not `"Principal": "*"`.
- **Detect** — Trusted Advisor, IAM Access Analyzer, and Config rules flag public buckets.

The interview answer: **"Never make the bucket public — front it with CloudFront + OAC for shared content, or presigned URLs for private/temporary access, and turn on Block Public Access."**

### Q12. Spot the anti-pattern: a production database running in a single Availability Zone.

**The problem**: a single-AZ database is a **single point of failure**. AZs *do* have outages (power, network, hardware). If your only DB instance is in the failed AZ, your whole application is down until it recovers or you manually restore from backup — potentially hours of downtime and, without recent backups, data loss.

**The fix**:

- **RDS Multi-AZ** — a synchronous standby replica in a *different* AZ; on primary failure, RDS **automatically fails over** (updates the DNS endpoint) in ~1-2 minutes with no data loss (synchronous replication). One checkbox.
- **Aurora** is multi-AZ by design — storage is replicated 6 ways across 3 AZs; failover is even faster.
- **Read replicas** additionally offload read traffic (and can be promoted), but note a *read replica is async and for scaling*, not the same as the synchronous Multi-AZ standby for HA.
- **Backups**: automated backups + point-in-time recovery as the deeper safety net.

The trade-off to acknowledge: Multi-AZ roughly doubles the DB cost (you pay for the standby). That's the price of HA, and for production it's non-negotiable. The interview answer: **"Enable Multi-AZ — a synchronous standby in another AZ with automatic failover. Single-AZ prod is a single point of failure."**

### Q13. Spot the cost problem: private-subnet instances routing all outbound traffic through a NAT Gateway, with one NAT in a single AZ.

**Two problems here — cost and reliability**:

**Cost**: NAT Gateway charges an hourly rate *plus* a per-GB **data processing** charge (~$0.045/GB) on every byte. High-egress workloads (pulling large container images, datasets, OS packages, or sending lots of data out) rack up serious money. And if instances in AZ-b route through a NAT Gateway in AZ-a, you *also* pay **cross-AZ transfer** on top — a double hit.

**Reliability**: a single NAT Gateway in one AZ is a single point of failure — if that AZ fails, every private instance in *every* AZ loses outbound connectivity.

**The fixes**:

- **VPC Gateway Endpoints for S3 and DynamoDB** — *free*, keep that traffic off the NAT entirely. This alone eliminates a huge chunk of NAT processing for the common case of talking to S3.
- **Interface (PrivateLink) Endpoints** for other AWS services (ECR, Secrets Manager, etc.) so image pulls and API calls skip the NAT.
- **One NAT Gateway per AZ**, with each AZ's private route table pointing at its *own* NAT — removes the cross-AZ charge and the single-AZ SPOF.
- Question whether the instances need internet egress at all.

The senior answer names **both** the endpoint fix (cost) and per-AZ NAT (cost + reliability).

### Q14. Spot the anti-pattern: a Lambda function that does a DynamoDB `Scan` on every request to look up an item.

**The problem**: `Scan` reads the **entire table** and filters afterward. It's O(table size), consumes read capacity proportional to *all* items scanned (not just matches), gets slower and more expensive as the table grows, and will throttle/blow your RCU budget under load. In a per-request hot path it's a latency and cost time-bomb that looks fine in dev with 100 rows and melts at a million.

**The fix — design the access pattern into the keys**:

- If you look up by a specific attribute, make it a **key**: `GetItem` on the partition key (and sort key) is O(1) and cheap.
- If you filter by a non-key attribute, create a **Global Secondary Index (GSI)** with that attribute as its key and `Query` the GSI — Query reads only matching items.
- **Model the table around your access patterns** (single-table design) — in DynamoDB you design the keys *from* the queries, unlike relational where you normalize then query.
- Reserve `Scan` for rare full-table operations (batch export, migration), ideally off the hot path and with pagination/parallelism.

The interview answer: **"Never Scan on the hot path — restructure so the lookup is a `GetItem` or a `Query` on a GSI. Scan reads the whole table and doesn't scale."** This is one of the most common DynamoDB mistakes and a reliable senior-vs-junior tell.

### Q15. Spot the anti-pattern: an async message consumer with no dead-letter queue.

**The problem**: without a **DLQ**, a message that repeatedly fails processing (a "poison pill" — malformed data, a bug, a permanently-down dependency) has two bad fates. On a queue with retries, it gets retried forever — blocking the queue (especially FIFO), wasting compute, and potentially masking that anything's wrong. When retries exhaust, the message is **silently dropped** — you've lost an order/event with no record. Either way you have data loss or a stuck pipeline and no visibility.

**The fix**:

- **Configure a DLQ** — for SQS, set a redrive policy with a `maxReceiveCount` (e.g. 5); after that many failed receives the message moves to the DLQ instead of being lost or retried endlessly. Lambda (async invocation and event-source mappings), SNS, and EventBridge all support DLQs/failure destinations too.
- **Alarm on DLQ depth** (CloudWatch) — a non-empty DLQ is an incident signal; page on it.
- **Build a redrive/replay path** — inspect DLQ messages, fix the bug or data, and redrive them back to the source queue (the SQS console has a built-in redrive).
- Combine with **idempotency** so replays are safe.

The interview answer: **"Every async consumer needs a DLQ plus an alarm on its depth — otherwise poison messages either block the queue forever or get silently lost, and you have no way to recover them."**

### Q16. Spot the anti-pattern: an IAM role with `Action: "*"` on `Resource: "*"`.

**The problem**: `"Action": "*", "Resource": "*"` is **admin on everything** — the opposite of least privilege. If that identity is compromised (leaked credential, SSRF into the metadata service, a vulnerable dependency), the attacker can do *anything* in the account: read all data, delete resources, spin up crypto-mining, escalate privileges, exfiltrate. It also violates the principle that blast radius should be bounded — one compromised component shouldn't equal total account compromise.

**The fix — least privilege**:

- **Grant only the specific actions and resources needed**: e.g. `s3:GetObject`/`s3:PutObject` on `arn:aws:s3:::my-bucket/*`, not `s3:*` on `*`.
- **Scope resources** to specific ARNs; use **conditions** (source IP, VPC endpoint, tag-based access, MFA) to tighten further.
- **Start from zero and add** what breaks, or use **IAM Access Analyzer** to generate a policy from actual CloudTrail usage.
- **Use permission boundaries and SCPs** (Organizations) to cap what any role in an account can do, even if someone writes an over-broad policy.
- **Separate roles per workload** so each has its own minimal permissions — no shared god-role.
- Remember IAM evaluation: **explicit deny always wins**, so SCPs/boundaries are a hard ceiling.

The interview answer: **"Least privilege — scope actions and resources to exactly what the workload needs, use Access Analyzer to right-size from real usage, and cap with SCPs/permission boundaries. A wildcard role turns any compromise into a full account takeover."**
