---
type: interview-prep
---

# Kubernetes Interview Primer — 332 Questions

Comprehensive Q+A primer for senior Kubernetes / DevOps / SRE interviews. Second entry in the DevOps track — sister note to the [[Linux Interview Primer]] and the cloud primers. Same shape, K8s-flavoured: the architecture & control loop, workloads, services & networking, config & storage, scheduling & resources, autoscaling, RBAC & security, probes & rollouts, observability, Helm/GitOps, operators, cluster ops, and production troubleshooting playbooks.

Each answer is interview-shaped: opinionated, concrete, real `kubectl` and YAML, controller behaviour, failure modes, and what actually happens under the hood. Current Kubernetes (containerd, Gateway API, Pod Security Admission, CSI); cloud-agnostic with EKS/GKE/AKS notes where they matter.

1. [[#Kubernetes Fundamentals & Architecture]]
2. [[#Pods & Workload Basics]]
3. [[#Deployments, ReplicaSets & Rollouts]]
4. [[#StatefulSets, DaemonSets, Jobs & CronJobs]]
5. [[#Services & Cluster Networking]]
6. [[#Ingress & Gateway API]]
7. [[#Configuration: ConfigMaps & Secrets]]
8. [[#Storage: Volumes, PV, PVC, StorageClasses & CSI]]
9. [[#Scheduling]]
10. [[#Resource Management]]
11. [[#Autoscaling]]
12. [[#Namespaces, Labels, Selectors & Annotations]]
13. [[#RBAC & API Access]]
14. [[#Pod & Cluster Security]]
15. [[#Health, Probes & Lifecycle]]
16. [[#Observability & Debugging]]
17. [[#Networking Deep Dive]]
18. [[#Helm, Kustomize & Config Management]]
19. [[#Operators, CRDs & the Controller Pattern]]
20. [[#Cluster Operations]]
21. [[#Troubleshooting & Scenario Playbooks]]

---

## Kubernetes Fundamentals & Architecture

### Summary

**What this topic covers**

The bedrock every Kubernetes conversation stands on: what the system *is*, what problem it solves, and how its pieces fit together. Three concern areas live here — (1) the **orchestration problem**: why running containers at scale needs a control system, and what "declarative desired state" actually buys you over shell scripts and hand-placed containers; (2) the **architecture**: the control plane (kube-apiserver, etcd, kube-scheduler, kube-controller-manager, cloud-controller-manager) and the node components (kubelet, kube-proxy, a container runtime like containerd); and (3) the **operating model**: the reconciliation loop that drives actual state toward desired state, the API object model (apiVersion/kind/metadata, spec vs status), and how a single `kubectl apply` ripples through the whole system to become a running Pod. The 16 questions here are the surface; the reconciliation model underneath is what every later topic — Pods, Deployments, Services, storage, RBAC — silently reuses.

**Mental model**

Think of Kubernetes as a **control system**, not a container launcher. You describe the world you want (in YAML, stored in etcd), and a swarm of controllers continuously works to make reality match that description. The **api-server** is the only front door — everything (kubectl, controllers, kubelets) talks to it, and it's the only thing that talks to etcd. **etcd** is the single source of truth: if it says you want 3 replicas, the system's whole job is to keep 3 running. Controllers run a **reconciliation loop**: observe actual state, compare to desired, take one step to close the gap, repeat forever. Crucially this is **level-triggered, not edge-triggered** — it doesn't react to events once and move on; it re-checks the desired level continuously, which is why Kubernetes self-heals after a missed event, a crash, or a restart. The scheduler places Pods on nodes; the kubelet on each node makes the Pods on *its* node real by driving the container runtime. Nothing is imperative under the hood — even `kubectl delete` just writes a new desired state ("this should not exist") that a controller then enforces.

**Key terms**

- **Control plane** — the brain: kube-apiserver, etcd, kube-scheduler, kube-controller-manager, cloud-controller-manager. Decides *what* should run *where*.
- **kube-apiserver** — the front door and only client of etcd; validates, authenticates, and persists every object. All traffic funnels through it.
- **etcd** — distributed key-value store holding all cluster state; the source of truth. Consistent (Raft), watchable, and the thing you back up.
- **kube-scheduler** — watches for unscheduled Pods and binds each to a node based on resources, affinity, taints, and constraints.
- **kube-controller-manager** — hosts the built-in controllers (Deployment, ReplicaSet, Node, Job…) that run reconciliation loops.
- **cloud-controller-manager** — isolates cloud-provider logic (load balancers, node lifecycle, routes) from the core.
- **kubelet** — the node agent; talks to the api-server, runs the Pods assigned to its node via the CRI, reports status.
- **kube-proxy** — programs node networking (iptables/IPVS) so Service virtual IPs route to Pod backends.
- **container runtime** — the thing that actually runs containers (containerd, CRI-O) via the Container Runtime Interface. Docker/dockershim was removed in 1.24.
- **Object** — a persisted intent record with `apiVersion`, `kind`, `metadata`, `spec` (desired) and `status` (observed).
- **Reconciliation loop** — the observe→diff→act cycle every controller runs; level-triggered, so it converges even after failures.
- **Declarative model** — you declare the end state; controllers figure out the steps. Contrast with imperative "do these commands in order."

**Why interviewers ask this**

Architecture questions separate people who *use* kubectl from people who understand *what happens when they press enter*. The junior answer names components; the senior answer explains the **reconciliation loop** and can trace a request end-to-end — api-server → etcd → scheduler → kubelet → runtime — and reason about failure at each hop. Interviewers (especially for SRE/platform roles) are probing: do you understand that Kubernetes self-heals *because* it's level-triggered? Do you know etcd is the source of truth and therefore the thing whose backup and quorum you protect? Can you explain why the api-server being the sole etcd client matters for security and scaling? Getting the control-plane/node split and the declarative model right early signals you can debug production incidents by reasoning about which loop stopped converging, rather than guessing.

**Common confusions**

- "Kubernetes runs my containers" — the *kubelet* runs them via the *container runtime*; the control plane only decides and records intent. No control-plane component runs your app containers.
- "Docker was removed, so my Docker images won't work" — false. Dockershim (the runtime shim) was removed; OCI images built by Docker run fine on containerd.
- "The scheduler starts the Pod" — it only *binds* the Pod to a node (writes `nodeName`). The kubelet on that node actually starts it.
- "kubectl talks to the nodes" — kubectl only talks to the api-server. So does everything else. The api-server is the single hub.
- "It's event-driven, so a dropped event breaks it" — it's level-triggered; controllers re-list and re-check desired state, so they converge even after missed events or restarts.
- "etcd is just a cache" — etcd is the source of truth. Lose etcd without a backup and you've lost the cluster's declared state.

**What follows from this topic**

Everything. **Pods & Workload Basics** is the smallest unit the scheduler places and the kubelet runs. **Deployments, ReplicaSets & Rollouts** are just controllers running the reconciliation loop you learned here to keep N Pods alive and roll them safely. Services, storage, and RBAC are all more objects with spec/status reconciled by more controllers. If the control-plane/node split and the declarative loop feel fuzzy, fix that first — every later topic is a specialization of "a controller drives actual toward desired via the api-server."

### Q1. What is Kubernetes and what problem does it solve?

Kubernetes is a **container orchestrator**: a system for deploying, scaling, and managing containerized applications across a fleet of machines. You give it a declarative description of what should run; it schedules containers onto nodes, restarts them when they die, scales them, and reroutes traffic — continuously, without you hand-placing anything.

The problem it solves is everything that gets hard once you have more than a handful of containers on more than one machine: **where does each container run?** (scheduling), **what happens when a node dies?** (rescheduling/self-healing), **how do clients find a moving set of backends?** (service discovery), **how do I roll out a new version without downtime?** (rolling updates), **how do I scale up under load?** (horizontal scaling). Before Kubernetes you wired these together with bespoke scripts, config management, and load-balancer glue. Kubernetes makes them first-class, declarative, and self-healing.

The core shift is from **imperative** ("SSH in and run these commands") to **declarative** ("here is the desired state; keep reality matching it"). You stop managing steps and start managing intent.

### Q2. Walk me through the control plane components and what each does.

The control plane is the cluster's brain. Five components:

- **kube-apiserver** — the front door. Every client (kubectl, controllers, kubelets) talks to it; it authenticates, authorizes, validates, and persists objects to etcd. It's the *only* component that talks to etcd. Stateless and horizontally scalable.
- **etcd** — the distributed key-value store that holds *all* cluster state (Raft-consistent). The source of truth; what you back up and protect quorum on.
- **kube-scheduler** — watches for Pods with no assigned node and picks the best node for each based on resource requests, affinity/anti-affinity, taints/tolerations, and topology constraints. It writes the binding; it doesn't start anything.
- **kube-controller-manager** — a single binary hosting many built-in controllers (Node, ReplicaSet, Deployment, Job, EndpointSlice…). Each runs a reconciliation loop driving actual state toward desired.
- **cloud-controller-manager** — houses cloud-provider-specific logic (provisioning load balancers, managing node lifecycle and routes) so the core stays cloud-agnostic.

```
kubectl ──▶ kube-apiserver ──▶ etcd
                 ▲  ▲
      scheduler ─┘  └─ controller-manager
```

### Q3. What runs on a worker node?

Three things make a node a functioning Kubernetes worker:

- **kubelet** — the node agent. It watches the api-server for Pods bound to its node, then drives the container runtime to make them real, mounts volumes, runs probes, and reports Pod/node status back. It is the one component that actually gets your containers running.
- **kube-proxy** — programs the node's networking (iptables or IPVS rules, or is replaced by a CNI's own dataplane) so that traffic to a Service's virtual IP is load-balanced to the backing Pods.
- **container runtime** — the low-level engine that pulls images and runs containers, spoken to via the **CRI** (Container Runtime Interface). In practice **containerd** or **CRI-O**.

The control plane decides; the node's kubelet + runtime execute. On managed clusters (EKS/GKE/AKS) you only manage nodes; the provider runs the control plane.

### Q4. Explain the declarative reconciliation model. Why is it level-triggered?

You declare **desired state** as objects (stored in etcd). Controllers each run a **reconciliation loop**: observe the actual state, diff it against desired, take one action to reduce the gap, and repeat — forever.

**Level-triggered** means the controller reacts to the *current level* of state, not to discrete *edges* (events). It periodically re-lists the world and asks "does reality match desired *right now*?" rather than "did an event just tell me to do something?" This is why Kubernetes self-heals: if a controller misses an event, crashes, or restarts, its next loop still sees the true current state and converges. An edge-triggered system would silently drift after a dropped event.

Concretely: you set a Deployment to 3 replicas. A Pod dies. The ReplicaSet controller's next reconcile sees 2 running vs 3 desired and creates one — it didn't need a "Pod died" event; it just compared level to desired. This convergent, self-correcting behavior is the single most important property to internalize about Kubernetes.

### Q5. What is the Kubernetes API object model? Explain spec vs status.

Everything in Kubernetes is an **API object** with a consistent shape:

```yaml
apiVersion: apps/v1      # which API group + version
kind: Deployment         # what type of object
metadata:                # name, namespace, labels, annotations, uid
  name: my-app
  namespace: prod
spec:                    # DESIRED state — you write this
  replicas: 3
status:                 # OBSERVED state — the controller writes this
  readyReplicas: 3
```

- **spec** is the desired state — *you* author it, declaring what you want.
- **status** is the observed/actual state — the responsible **controller** writes it after reconciling.

The reconciliation loop is precisely the machinery that tries to make `status` match `spec`. When you `kubectl get -o yaml` and see them diverge (e.g. `spec.replicas: 3` but `status.readyReplicas: 1`), that gap *is* the story — the controller is mid-reconcile or stuck. Reading spec-vs-status is the first move in most debugging.

### Q6. Trace what happens when I run `kubectl apply -f deployment.yaml`.

1. **kubectl** reads the file, computes a diff against the last-applied config, and POSTs/PATCHes the object to the **api-server**.
2. The **api-server** authenticates (who are you?), authorizes (RBAC: can you do this?), runs **admission controllers** (mutating then validating webhooks), validates the schema, and **persists** the Deployment to **etcd**. It returns success — the object now *exists as desired state*, but nothing is running yet.
3. The **Deployment controller** (in controller-manager) sees the new Deployment via a watch, and creates a **ReplicaSet**.
4. The **ReplicaSet controller** sees a ReplicaSet wanting 3 replicas and 0 existing, so it creates 3 **Pod** objects (still unscheduled — no node).
5. The **scheduler** sees 3 Pods with no `nodeName`, picks nodes, and writes the binding for each.
6. On each chosen node, the **kubelet** sees a Pod bound to it, calls the **container runtime** (via CRI) to pull images and start containers, sets up networking via CNI, and runs probes.
7. The kubelet reports **status** back to the api-server; once containers are ready, the Pod is Running/Ready.

Every arrow goes *through the api-server*, and each step is a controller reconciling desired→actual. That's the whole system in one request.

### Q7. What is etcd's role and why is it the source of truth?

**etcd** is a distributed, strongly-consistent key-value store (Raft consensus). Kubernetes stores **all** cluster state there — every object's spec and status. It's the single source of truth: if etcd says you want 3 replicas in namespace `prod`, that *is* the desired state the whole system enforces.

Two consequences matter operationally:

- **Back it up.** Lose etcd without a snapshot and you've lost the declared state of the entire cluster — every Deployment, Secret, RBAC binding. Regular `etcdctl snapshot save` is non-negotiable for self-managed clusters.
- **Protect quorum.** etcd needs a majority (odd member counts: 3, 5) to accept writes. Lose quorum and the api-server can't persist changes — the cluster goes read-only for writes even if apps keep running.

Only the **api-server** talks to etcd; nothing else touches it directly. That single-writer-of-record design is why the api-server is the security and consistency chokepoint.

### Q8. Imperative vs declarative — what's the difference and why does Kubernetes prefer declarative?

**Imperative** = you issue commands describing *actions*: `kubectl run`, `kubectl create`, `kubectl scale`, `kubectl delete`. Each is a one-shot instruction.

**Declarative** = you describe the *desired end state* in manifests and `kubectl apply -f` them; Kubernetes figures out the actions to get there and keeps it there.

| | Imperative | Declarative |
|---|---|---|
| You specify | The steps | The end state |
| Command | `kubectl create/run/scale` | `kubectl apply -f` |
| Idempotent | No (create fails if exists) | Yes (apply converges) |
| Source of truth | Your shell history | Git-committed YAML |
| Drift handling | Manual | Continuous reconcile |

Declarative wins because it's **idempotent** (re-applying is safe), **auditable** (YAML in Git = GitOps), and **self-healing** (the reconcile loop fixes drift). Imperative commands are great for quick debugging and experiments, but production runs on declarative manifests.

### Q9. What is kubeconfig and how do contexts work?

**kubeconfig** (default `~/.kube/config`) is the file kubectl uses to know *which cluster to talk to and as whom*. It has three lists:

- **clusters** — api-server URLs + CA certs.
- **users** — credentials (client certs, tokens, exec plugins for cloud auth).
- **contexts** — a named tuple of (cluster + user + default namespace).

A **context** is the active selection. `kubectl config get-contexts` lists them; `kubectl config use-context prod` switches; `kubectl config current-context` shows the active one. Every command runs against the current context, which is why the classic outage story is "I ran it against prod because my context was still pointed there." Tools like `kubectx`/`kubens` and shell prompt indicators exist precisely to prevent that. You can also override per-command with `--context` and `--namespace`.

### Q10. What are API groups and versions, and why do they exist?

Kubernetes organizes its API into **groups**, each versioned independently, so the API can evolve without breaking everyone at once.

- The **core group** (legacy) has an empty group name: `apiVersion: v1` (Pods, Services, ConfigMaps, Secrets, Nodes).
- **Named groups** carry the group in the path: `apps/v1` (Deployments, ReplicaSets, StatefulSets, DaemonSets), `batch/v1` (Jobs/CronJobs), `networking.k8s.io/v1` (Ingress, NetworkPolicy), `rbac.authorization.k8s.io/v1`.

Versions signal stability: **v1** (GA/stable), **v1beta1** (beta — enabled by default, may change), **v1alpha1** (alpha — off by default, may vanish). The same object can be served at multiple versions and the api-server converts between them, which is how features graduate. When you write `apiVersion:`, you're picking group + version; getting it wrong (e.g. `extensions/v1beta1` for a Deployment on a modern cluster) is a common "why won't this apply" error after upgrades deprecate old versions.

### Q11. How is Kubernetes extended? Give a high-level view of CRDs and admission.

Kubernetes is deliberately extensible so you can add your own objects and policies without forking it:

- **Custom Resource Definitions (CRDs)** let you register a new object *kind* (say `kind: Database`). The api-server then stores and serves it like any built-in. Pair a CRD with a **custom controller** (the "operator" pattern) that reconciles it, and you've taught Kubernetes to manage a new thing using the same declarative loop.
- **Admission controllers / webhooks** intercept requests *after* auth but *before* persistence. **Mutating** webhooks can modify objects (inject sidecars, set defaults); **validating** webhooks can reject them (enforce policy — "no `latest` tags," "must have resource limits"). Policy engines like Kyverno/OPA Gatekeeper plug in here.

Together these are how the ecosystem (cert-manager, Istio, Argo, cloud operators) builds on Kubernetes rather than around it. You don't need deep detail for most interviews — just know that CRDs add *nouns* and admission adds *rules*.

### Q12. Managed vs self-hosted control planes — what changes with EKS/GKE/AKS?

With a **self-hosted** control plane you run and maintain the api-server, etcd, scheduler, and controller-manager yourself (e.g. via kubeadm) — including etcd backups, cert rotation, HA, and upgrades. Full control, full operational burden.

With a **managed** control plane (**EKS**, **GKE**, **AKS**) the cloud provider runs and scales the control plane and etcd for you, handles their availability and patching, and charges a small hourly fee. You only manage **nodes** (node groups/pools) and your workloads.

What you gain: no etcd babysitting, provider-managed HA, simpler upgrades. What you give up: you can't SSH into the api-server or etcd, and provider opinions constrain some configuration. Cloud specifics leak in via the **cloud-controller-manager** — `type: LoadBalancer` Services provision a real cloud LB, and identity integrations (IRSA on EKS, Workload Identity on GKE) map Kubernetes ServiceAccounts to cloud IAM. For most teams, managed is the default; self-hosted is for on-prem or strict-control requirements.

### Q13. How do you make the control plane highly available?

The two failure domains are the **stateless components** and **etcd**.

- **api-server** is stateless — run multiple replicas behind a load balancer. Any instance can serve any request; scale horizontally.
- **scheduler** and **controller-manager** run multiple replicas but use **leader election** — only one is active at a time; standbys take over if the leader fails. (You don't want two schedulers both binding Pods.)
- **etcd** is the hard part: run an **odd number** of members (3 or 5) across failure domains so it can tolerate `(N-1)/2` losses while keeping **quorum**. 3 members tolerate 1 failure; 5 tolerate 2. Lose quorum and writes stop.

A production HA control plane is typically 3 nodes, each running an api-server, scheduler, controller-manager, and etcd member, fronted by a load balancer. Managed offerings (EKS/GKE/AKS) do all of this for you across availability zones — one of the main reasons teams choose them.

### Q14. A `kubectl get pods` returns "Unable to connect to the server." Where do you look?

This is an api-server reachability problem, not a Pod problem. Work outward:

1. **Wrong context/cluster.** `kubectl config current-context` — are you pointed at a cluster that exists / is up? The endpoint URL might be stale or the cluster torn down.
2. **Credentials/expiry.** For cloud clusters the kubeconfig often uses an exec plugin (`aws eks get-token`, `gcloud`) — expired creds or missing CLI cause connection/auth failures.
3. **Network path.** Can you reach the api-server URL at all? `curl -k https://<apiserver>:6443/healthz`. Private clusters may require VPN/bastion.
4. **api-server health.** On self-hosted: is the api-server process up? Is **etcd** healthy and holding quorum? A down etcd takes the api-server's writes with it. Check `kubectl get --raw='/healthz'`, control-plane node status, and etcd member health.

The mental model that guides this: kubectl only ever talks to the api-server, and the api-server only works if etcd is reachable and healthy. So the fault is in one of those three hops — client config, network, or control-plane/etcd health.

### Q15. How does authentication and authorization work at the api-server?

Every request hits the api-server and passes through a pipeline:

1. **Authentication** — *who are you?* Mechanisms: client certs, bearer tokens, ServiceAccount tokens (for in-cluster workloads), or OIDC/cloud IAM plugins. Kubernetes has no user database — it trusts external identity.
2. **Authorization** — *are you allowed?* Almost always **RBAC**: your identity's Roles/ClusterRoles (via RoleBindings) grant verbs (get/list/create/delete) on resources. Denied → 403.
3. **Admission control** — *should this specific object be allowed/modified?* Mutating then validating admission webhooks run here (inject sidecars, enforce policy) before the object is persisted.

Only after all three does the object land in etcd. This pipeline is why the api-server is the security chokepoint: it's the single place identity, permission, and policy are enforced. For in-cluster components, identity comes from a mounted **ServiceAccount** token, which is the thread connecting this to RBAC and workload identity.

### Q16. Why is the api-server the only component that talks to etcd?

By design, **etcd** has exactly one client: the **api-server**. Nothing else — not the scheduler, not controllers, not kubelets — touches etcd directly. Several reasons:

- **Single enforcement point.** Auth, authorization, admission, validation, and defaulting all happen in the api-server. If other components wrote to etcd directly they'd bypass every guardrail.
- **Consistency & schema.** The api-server owns encoding, versioning (converting between API versions), and optimistic concurrency (resourceVersion). One writer keeps that coherent.
- **Watchability.** Clients don't poll etcd; they **watch the api-server**, which multiplexes etcd's watch stream efficiently to thousands of controllers and kubelets. Fanning that out from the api-server protects etcd from load.
- **Security blast radius.** etcd holds every Secret in (by default) plaintext-at-rest unless encryption-at-rest is configured. Limiting its clients to one hardened process shrinks the attack surface enormously.

So the shape is: **everyone → api-server → etcd**. That funnel is the reason Kubernetes can be consistent, secure, and scalable at once.

## Pods & Workload Basics

### Summary

**What this topic covers**

The Pod — the atom of Kubernetes scheduling and the unit everything else wraps. Three concern areas: (1) the **Pod itself**: why it exists as a layer above the container, what its containers share (network namespace, IP, localhost, IPC, volumes), and the pause/infra container that anchors it; (2) **composition and startup**: why you'd run multiple containers in one Pod (sidecar/ambassador/adapter, and the native sidecar in modern Kubernetes), and init containers that run to completion in order before the app starts; and (3) the **lifecycle**: Pod phases (Pending/Running/Succeeded/Failed/Unknown), container states (Waiting/Running/Terminated), restartPolicy, and — the big one — why Pods are ephemeral and mortal, so you almost never create bare Pods. The 16 questions span "what is a Pod" up to "a Pod is stuck Pending — debug it" and "its node died — why didn't it come back?"

**Mental model**

A Pod is a **shared execution context for one or more tightly-coupled containers** — think "a logical host" more than "a container." The containers in a Pod share a network namespace (same IP, they reach each other on `localhost`), can share IPC, and can share mounted volumes; but each still has its own filesystem and process space. What holds this together is a hidden **pause container** that owns the shared namespaces so app containers can come and go without tearing down the Pod's identity. The second, harder mental shift: **Pods are cattle, not pets** — ephemeral, mortal, disposable. They get an IP that dies with them; they don't survive their node; you rarely create one directly. Instead a controller (Deployment/ReplicaSet/StatefulSet/DaemonSet/Job) *manages* Pods for you, recreating them as needed. So a Pod is simultaneously the thing that runs your code *and* the thing you're not supposed to hold onto. You design for its death.

**Key terms**

- **Pod** — the smallest deployable unit; one or more containers sharing network, IPC, and storage. Scheduled as a whole to one node.
- **Shared network namespace** — all containers in a Pod share one IP and port space; they talk over `localhost`. Two containers can't bind the same port.
- **pause (infra) container** — the invisible container that holds the Pod's namespaces so app containers can restart without losing the Pod's IP/identity.
- **Sidecar** — a helper container alongside the main app (log shipper, proxy). Modern Kubernetes has *native* sidecars (init containers with `restartPolicy: Always`).
- **Init container** — runs to completion, in order, *before* app containers start; used for setup/waiting on dependencies.
- **Pod phase** — high-level lifecycle: Pending, Running, Succeeded, Failed, Unknown.
- **Container state** — per-container: Waiting, Running, Terminated (each with a reason).
- **restartPolicy** — Always (default, for services), OnFailure, Never (for Jobs). Applies to containers *within* the Pod.
- **Ephemeral / mortal** — a Pod has a finite life; deleted/failed Pods are gone, replaced by *new* Pods with new IPs.
- **Static Pod** — a Pod managed directly by a node's kubelet from a local manifest file, not the api-server; used for control-plane components.
- **Ephemeral container** — a temporary container injected into a running Pod for debugging (`kubectl debug`); can't be declared in the spec.
- **Pod IP** — every Pod gets its own routable cluster IP (via CNI); pods communicate pod-to-pod without NAT.

**Why interviewers ask this**

Pods are where "I've read the docs" and "I've operated this" diverge. The junior answer defines a Pod as "a wrapper around a container." The senior answer explains *why* the wrapper exists (shared namespace, co-scheduling, the pause container), *why* Pods are ephemeral (so the system can freely reschedule and self-heal), and therefore *why you never `kubectl run` a bare Pod in prod*. Interviewers use Pod questions to test whether you understand the reconciliation consequences: a bare Pod isn't recreated when its node dies because nothing owns it. They'll push into lifecycle debugging — Pending vs CrashLoopBackOff vs ImagePullBackOff — because that's the daily bread of on-call. Nail the "ephemeral and mortal, design for death" framing and you signal you think in Kubernetes' grain rather than fighting it.

**Common confusions**

- "A Pod is just a container" — a Pod can hold multiple containers that share network/storage; even single-container Pods add a shared-namespace layer (the pause container).
- "Containers in a Pod are isolated from each other" — they share the network namespace (same IP/localhost) and can share volumes; they're *co-located and coupled*, not isolated.
- "If I create a Pod, Kubernetes keeps it alive forever" — a bare Pod is restarted *on its node* per restartPolicy, but if the node dies the Pod is gone; nothing reschedules it.
- "restartPolicy: Never means the Pod never restarts" — it means *containers* aren't restarted; it's about container restarts within the Pod, not rescheduling.
- "Init containers and sidecars are the same" — init containers run to completion *before* the app; sidecars run *alongside* it for the Pod's life (native sidecars are init containers kept running).
- "Each container gets its own IP" — no; the *Pod* gets one IP shared by all its containers.

**What follows from this topic**

Because Pods are mortal, you need something to *manage* them — that's **Deployments, ReplicaSets & Rollouts** (the next topic), which keep N Pods alive and replace dead ones. Because Pod IPs are ephemeral, you need a stable front — that's **Services**. Because Pods need config, secrets, and storage that outlive them, you get ConfigMaps, Secrets, and PVCs. And because Pods are the scheduling unit, requests/limits, probes, and affinity all attach here. Master the Pod's shared-context and mortality model and the rest of Kubernetes reads as "how do we make a fleet of these mortal Pods into a reliable service?"

### Q1. What is a Pod and why does Kubernetes use Pods instead of raw containers?

A **Pod** is the smallest deployable unit in Kubernetes: one or more containers that are **co-located, co-scheduled, and share a context** — a network namespace (one IP, reachable on `localhost`), optionally IPC, and mounted volumes. It's scheduled onto a single node as an indivisible unit.

Kubernetes wraps containers in Pods rather than scheduling containers directly because some helpers genuinely need to run *right next to* the main process, sharing its network and disk — a log shipper reading the app's volume, a proxy on `localhost`. The Pod is the boundary for "these things live and die together on the same node." Even a single-container Pod uses this model, with a hidden **pause container** owning the shared namespaces so the app container can restart without the Pod losing its identity or IP.

The other reason is uniformity: by making the Pod the atom, every higher-level controller (Deployment, Job, DaemonSet) manages the same thing, and scheduling/networking/storage all attach to one consistent unit.

### Q2. What do containers in the same Pod share, and what don't they?

**Shared:**
- **Network namespace** — one IP for the whole Pod; containers reach each other over `localhost`; they share the port space (so two containers can't both bind :8080).
- **IPC namespace** — they can use shared-memory/semaphores between them.
- **Volumes** — any volume mounted into multiple containers is the same storage (great for a sidecar reading files the app writes).
- **Lifecycle & node** — scheduled together to one node, live and die together.

**Not shared:**
- **Filesystem root** — each container has its own image filesystem; sharing requires an explicit shared volume.
- **PID namespace** — separate by default (can be enabled with `shareProcessNamespace: true`).
- **Resource accounting** — each container has its own requests/limits.

The mental shortcut: containers in a Pod are like processes on the *same host* — same network identity, can share files if they choose, but otherwise their own programs.

### Q3. When would you put multiple containers in one Pod? Name the patterns.

Only when the containers are **tightly coupled and must share a node, network, or volume**. The classic patterns:

- **Sidecar** — augments the main app: a log shipper tailing a shared volume, a service-mesh proxy (Envoy) intercepting the Pod's traffic, a metrics exporter. Runs for the Pod's lifetime.
- **Ambassador** — a proxy container that brokers the app's *outbound* connections (e.g. a local proxy to a sharded database), so the app just talks to `localhost`.
- **Adapter** — transforms the app's output into a standard format (e.g. normalizing logs/metrics for a monitoring system).

Modern Kubernetes formalizes the sidecar as a **native sidecar**: an init container with `restartPolicy: Always`, which starts before the main containers, stays running alongside them, and shuts down after them — fixing old ordering/termination bugs.

The anti-pattern: bundling *unrelated* services in one Pod. If two containers don't need to share a node/network/volume and don't scale together, they belong in separate Pods behind Services.

### Q4. What are init containers and how do they behave?

**Init containers** run **before** the Pod's app containers, **in order**, each **to completion**, and only then do the main containers start. If an init container fails, the kubelet restarts it (per restartPolicy) — the app never starts until all inits succeed.

Uses: waiting for a dependency to be ready, running schema migrations, fetching config/secrets into a shared volume, setting kernel params. They let you keep setup logic out of the app image.

```yaml
spec:
  initContainers:
    - name: wait-for-db
      image: busybox
      command: ['sh', '-c', 'until nc -z db 5432; do sleep 2; done']
  containers:
    - name: app
      image: my-registry/app:1.2.3
```

Key properties: strictly **sequential** (unlike app containers, which start in parallel), **run once** to completion, and each must finish before the next begins. A **native sidecar** is an init container with `restartPolicy: Always` — it starts in the init sequence but *keeps running* alongside the app instead of completing.

### Q5. Walk through the Pod lifecycle phases and container states.

**Pod phase** is a high-level summary:
- **Pending** — accepted by the cluster but not yet running: waiting to be scheduled, pulling images, or running init containers.
- **Running** — bound to a node, all containers created, at least one running/starting/restarting.
- **Succeeded** — all containers terminated successfully and won't restart (Jobs).
- **Failed** — all containers terminated, at least one with failure and won't restart.
- **Unknown** — the node's status can't be reached (usually a node/network problem).

**Container state** is finer-grained, per container:
- **Waiting** — not yet running; the `reason` tells you why (`ContainerCreating`, `ImagePullBackOff`, `CrashLoopBackOff`).
- **Running** — actively executing.
- **Terminated** — finished or was killed; carries exit code and reason (`Completed`, `Error`, `OOMKilled`).

When debugging, the *phase* points you at the layer (Pending → scheduling/image/init; Running-but-not-Ready → probes) and the *container state reason* gives the specific cause. `kubectl describe pod` shows both plus the Events, which is where the real answer usually is.

### Q6. Why are Pods described as ephemeral and mortal, and what's the implication?

A Pod has a **finite life**: it can be evicted, deleted, or lost with its node, and when it goes it's *gone* — it isn't resurrected. Its IP dies with it; the replacement is a **new** Pod with a new name and IP.

The implication drives Kubernetes design:
- **You don't create bare Pods.** You create a controller (Deployment/ReplicaSet/Job/DaemonSet) that *maintains* Pods, so when one dies the controller makes a fresh one.
- **You don't rely on a Pod's IP.** You put a **Service** in front to give a stable virtual IP/DNS over a churning set of Pods.
- **You externalize state.** Anything that must survive a Pod goes into a PersistentVolume, database, or object store — not the Pod's local disk.
- **You design for death.** Graceful shutdown, readiness probes, and idempotent startup all assume Pods come and go constantly.

"Cattle, not pets" is the slogan: you don't nurse an individual Pod back to health; you let it die and get replaced. Fighting this — treating Pods as durable — is the root of a lot of Kubernetes pain.

### Q7. What is the pause (infra) container and what does it do?

The **pause container** is a tiny, near-invisible container the kubelet starts *first* in every Pod. Its whole job is to **hold the Pod's shared Linux namespaces** — principally the **network namespace** (and IPC) — and then do nothing but sleep.

Why it matters: because the pause container owns the network namespace, the Pod's **IP and network identity belong to it, not to your app container**. So your app container (or a sidecar) can **crash and restart** without the Pod losing its IP or the other containers losing connectivity — they all just re-join the namespace the pause container is still holding. Without it, restarting the main container would tear down and recreate the network identity every time.

You normally never see it (`kubectl get pods` hides it), but on a node you'd find a `pause` container per Pod. It's a neat piece of design: a do-nothing process whose sole purpose is to be the stable anchor for everything that *does* do something.

### Q8. How does Pod networking work at a basic level?

The Kubernetes network model has one core rule: **every Pod gets its own unique, routable IP address**, and **every Pod can reach every other Pod directly, without NAT**. This "IP-per-Pod" model is implemented by a **CNI** plugin (Calico, Cilium, the cloud's VPC CNI, etc.).

Consequences:
- Containers *within* a Pod share that one IP and talk over `localhost`.
- Pods on the same or different nodes talk **Pod-IP to Pod-IP** as if on a flat network — the CNI handles the routing/overlay.
- Because Pod IPs are **ephemeral** (they change when Pods are recreated), you don't address Pods by IP in practice — you put a **Service** in front for a stable virtual IP and DNS name.

So the layering is: containers → share a Pod IP; Pods → flat routable network via CNI; clients → reach a stable **Service**, which load-balances to the current Pod IPs. This clean model (no port-mapping gymnastics, no NAT between Pods) is a big part of why Kubernetes networking scales.

### Q9. Explain restartPolicy and its values.

`restartPolicy` (a Pod-level field) controls whether the kubelet **restarts containers within the Pod** when they exit. It does **not** control rescheduling of the Pod to another node.

- **Always** (default) — restart the container whenever it exits, success or failure. For long-running services. Repeated crashes back off (CrashLoopBackOff).
- **OnFailure** — restart only if the container exits non-zero. For Jobs/batch that should retry on error but stop on success.
- **Never** — never restart; the container runs once. For one-shot tasks where retries are handled elsewhere.

The subtlety interviewers probe: restartPolicy is about **container restarts on the same node**, within the same Pod object. If the *node* dies, restartPolicy is irrelevant — the Pod is gone, and only a controller (Deployment/Job) creates a replacement elsewhere. `Always` doesn't make a bare Pod survive node loss; it just keeps its containers running while the Pod exists.

### Q10. What are static Pods and where are they used?

A **static Pod** is managed **directly by a node's kubelet**, not by the api-server. The kubelet watches a local directory (typically `/etc/kubernetes/manifests/`) and runs any Pod manifest it finds there, restarting it if it dies.

Key traits:
- **No controller, no scheduler** — the kubelet owns it entirely; it's tied to that one node.
- The api-server gets a **read-only mirror Pod** so you can *see* it via `kubectl get pods`, but you can't control it through the api-server (deleting the mirror doesn't remove it — you edit the manifest file).

The canonical use is **bootstrapping the control plane**: on a kubeadm cluster, the api-server, scheduler, controller-manager, and etcd themselves run as static Pods. That solves the chicken-and-egg problem — you can't use the api-server to run the api-server, so the kubelet launches it from a static manifest. Outside control-plane bootstrap, static Pods are rare in app workloads.

### Q11. How do Pods get DNS names and hostnames?

By default a Pod's **hostname** is its metadata name, and Pods resolve names via the cluster DNS (**CoreDNS**), whose address the kubelet injects into each container's `/etc/resolv.conf` along with search domains for the Pod's namespace.

- **Services** get DNS records: `my-svc.my-namespace.svc.cluster.local`, and within a namespace you can use the short `my-svc`. This is the normal way Pods find each other — via the Service name, not Pod IPs.
- **Bare Pods** don't get useful DNS by default. But a Pod backed by a **headless Service** (`clusterIP: None`) with a `subdomain` set gets a stable per-Pod DNS record `pod-name.subdomain.namespace.svc.cluster.local`.
- **StatefulSet** Pods get stable, ordinal hostnames (`web-0`, `web-1`) and stable per-Pod DNS via their headless Service — which is exactly why databases and clustered systems use StatefulSets.

So: resolve everything through CoreDNS; address workloads by **Service name** (stable) not Pod IP (ephemeral); reach for headless Services / StatefulSets only when you genuinely need to address individual Pods.

### Q12. How do you inspect a Pod? Show the commands you'd actually use.

The daily toolkit:

```bash
kubectl get pod my-app -o wide            # phase, restarts, node, Pod IP
kubectl get pod my-app -o yaml            # full spec + status (spec vs status!)
kubectl describe pod my-app               # events, container states, probe results
kubectl logs my-app                       # logs of the (default) container
kubectl logs my-app -c sidecar --previous # a specific container; --previous = last crash
kubectl exec -it my-app -- sh             # shell inside a running container
```

The workflow: **`describe` first** — its **Events** section and per-container **State/Reason** usually name the problem (ImagePullBackOff, FailedScheduling, OOMKilled, probe failures). Then **`logs`** for application-level errors, adding `--previous` to see why a crashed container died before its restart. `get -o yaml` when you need to compare **spec vs status** or see exact field values. `exec` to poke around inside. For quick throwaway experiments, `kubectl run tmp --rm -it --image=busybox -- sh` gives a disposable Pod. This describe→logs→exec loop is most of on-call debugging.

### Q13. What are ephemeral containers and when do you use them?

An **ephemeral container** is a temporary container you inject into an **already-running Pod** to debug it, via `kubectl debug`. You can't declare it in the Pod spec and it has no restart guarantees — it exists only for the debugging session.

Why they exist: modern production images are often **distroless/minimal** — no shell, no `curl`, no `ps`. When such a Pod misbehaves you can't `kubectl exec` a shell that isn't there. An ephemeral container lets you attach a container *with* debugging tools that shares the target's namespaces:

```bash
kubectl debug -it my-app --image=busybox --target=app
```

`--target=app` shares the process namespace with the `app` container so you can see and probe its processes; the injected busybox brings the tools the app image lacks. Because it's added to the live Pod (not a copy), you debug the *actual* failing instance without rebuilding images or baking tools into production. It's the sanctioned answer to "how do I debug a distroless Pod in prod?"

### Q14. A Pod is stuck in Pending. Walk me through debugging it.

Pending means **accepted but not running** — almost always it can't be *scheduled* or can't *start*. `kubectl describe pod` and read the **Events**; the reason is usually right there.

Common causes, roughly in order:
- **Insufficient resources** — Events say `FailedScheduling: Insufficient cpu/memory`. No node can satisfy the Pod's **requests**. Fix: lower requests, add nodes, or check the cluster autoscaler.
- **Taints / affinity / selectors** — the Pod's nodeSelector/affinity or unsatisfied tolerations mean no node matches. Events: `node(s) had taint {...} that the pod didn't tolerate` or `didn't match node selector`.
- **Unbound PVC** — the Pod mounts a PersistentVolumeClaim that hasn't bound (no matching PV / StorageClass issue). Events: `pod has unbound immediate PersistentVolumeClaims`.
- **Image pull (if it got scheduled but not started)** — technically the Pod is Pending with container Waiting: `ImagePullBackOff` (bad image name, private registry without imagePullSecret).
- **No nodes Ready** — every node is NotReady/cordoned.

The method is always the same: `describe` → read Events → the message names the layer (scheduling vs storage vs image). This is why understanding the scheduler and requests from the fundamentals topic pays off directly.

### Q15. A Pod's node dies. What happens, and why doesn't a bare Pod come back?

If the node hosting a Pod goes down, the node's kubelet stops reporting status. After a grace period the node is marked **NotReady**, then (via node-lifecycle / pod-eviction logic) its Pods are marked for deletion/eviction.

- **Bare Pod (created directly):** it is simply **gone**. Nothing owns it, so nothing recreates it. `restartPolicy` only ever restarted containers *within* the Pod on its own node — with the node dead, there's no controller watching a desired replica count, so no replacement is scheduled elsewhere. This is the whole reason you don't run bare Pods in production.
- **Pod owned by a controller (Deployment/ReplicaSet/StatefulSet/Job):** the controller's reconciliation loop sees actual replicas < desired and **creates a new Pod**, which the scheduler places on a healthy node. Self-healing — exactly because a controller is continuously enforcing desired state.

So the lesson ties back to the fundamentals: self-healing is a property of **controllers running the reconciliation loop**, not of Pods. A Pod is mortal; only something maintaining a *desired count* brings it back.

### Q16. `kubectl run` vs declaring a Pod in YAML — what's the right practice?

`kubectl run my-app --image=my-registry/app:1.2.3` is the **imperative** shortcut — it creates a single Pod (in older versions it created Deployments; today it makes a bare Pod). It's perfect for **quick experiments and debugging**: `kubectl run tmp --rm -it --image=busybox -- sh` gives you a throwaway shell in the cluster.

For anything real, you use **declarative YAML** applied with `kubectl apply -f`, and you almost never author a bare `kind: Pod`. Instead you write a **Deployment** (or Job/StatefulSet/DaemonSet) whose template *contains* the Pod spec, because:

- The controller keeps the Pod alive / rescheduled when nodes fail (bare Pods don't self-heal).
- The manifest is version-controlled (GitOps), reviewable, and idempotently re-appliable.
- You get rollouts, scaling, and history for free.

A useful trick is to *generate* a starting manifest imperatively and then commit it: `kubectl run my-app --image=my-registry/app:1.2.3 --dry-run=client -o yaml > pod.yaml`. So: imperative `run` for ephemeral debugging; declarative controller-owned YAML for everything that needs to survive.

## Deployments, ReplicaSets & Rollouts

### Summary

**What this topic covers**

How Kubernetes turns mortal Pods into a durable, self-healing, safely-upgradable service. Three concern areas: (1) the **hierarchy** — Deployment → ReplicaSet → Pods, what each layer does, and why you drive it from the Deployment rather than a ReplicaSet directly; (2) **rollouts** — how a rolling update scales two ReplicaSets up and down, the maxSurge/maxUnavailable knobs, Recreate vs RollingUpdate, and how readiness probes make it zero-downtime; and (3) **operating rollouts** — `kubectl rollout status/history/undo`, revision history, `set image`, pausing/resuming, progressDeadlineSeconds and stuck rollouts, plus canary/blue-green and where you outgrow built-in primitives (Argo Rollouts). The 17 questions run from "what's a ReplicaSet" to "walk me through how a rolling update stays available" and "this rollout is stuck — diagnose it."

**Mental model**

A **Deployment** is a controller that manages **ReplicaSets**, and a ReplicaSet is a controller that manages **Pods**. That's the whole spine. You edit the Deployment; it does the choreography. When you change the Pod template (say a new image), the Deployment doesn't mutate existing Pods — it creates a **new ReplicaSet** for the new template and then **gradually scales the new one up while scaling the old one down**, respecting maxSurge (how many *extra* Pods it may create) and maxUnavailable (how many it may take *below* desired). Old ReplicaSets aren't deleted — they're scaled to 0 and kept as **revision history**, which is what makes `rollout undo` instant. The safety comes from **readiness probes**: a new Pod only receives traffic once it reports ready, so the Service never routes to a half-started Pod, and the Deployment won't proceed if new Pods never become ready. Everything is still the reconciliation loop — the Deployment continuously drives actual ReplicaSet/Pod counts toward the desired rollout state.

**Key terms**

- **Deployment** — the workload controller you actually use for stateless apps; manages ReplicaSets to run and update Pods declaratively.
- **ReplicaSet** — ensures a specified number of identical Pods are running, matched by a **label selector**; the layer a Deployment drives.
- **Rolling update** — default strategy: incrementally shift replicas from the old ReplicaSet to a new one with no full outage.
- **Recreate** — strategy that kills all old Pods before creating new ones; causes downtime but avoids two versions running at once.
- **maxSurge** — how many Pods *above* desired count the update may temporarily create (speed).
- **maxUnavailable** — how many Pods *below* desired the update may temporarily run (availability floor).
- **Revision** — a recorded state of the Deployment (a ReplicaSet + template); enables history and rollback.
- **readiness probe** — gates Service endpoint membership; the mechanism behind zero-downtime rollouts.
- **progressDeadlineSeconds** — how long a rollout may make no progress before it's marked failed.
- **ownerReferences** — the parent link (Deployment→ReplicaSet→Pod) that drives garbage collection.
- **`kubectl rollout`** — the verb family: `status`, `history`, `undo`, `pause`, `resume`, `restart`.
- **selector immutability** — a Deployment's `.spec.selector` cannot be changed after creation.

**Why interviewers ask this**

Rollouts are the single most common *and* most dangerous operation in a Kubernetes shop, so this is where SRE/platform interviews spend real time. The junior answer says "a Deployment updates my Pods." The senior answer explains the **two-ReplicaSet dance**, how **maxSurge/maxUnavailable** trade speed against availability, and — critically — how **readiness probes** are the thing that actually makes it zero-downtime (without them you'll happily route traffic to broken Pods and think the rollout succeeded). Interviewers want to see you reason about failure: a rollout stuck because new Pods never go Ready, a bad version needing instant `rollout undo`, a selector you can't change. They're checking whether you can ship changes to production safely and recover fast when a deploy goes wrong — the core of the job.

**Common confusions**

- "A Deployment updates Pods in place" — it doesn't; it creates a *new ReplicaSet* and shifts replicas between old and new. Individual Pods are replaced, never mutated.
- "You should manage ReplicaSets directly" — almost never; the Deployment gives you rollouts, history, and rollback. A raw ReplicaSet has none of that.
- "Rolling updates are automatically zero-downtime" — only if you have **readiness probes** and sane maxUnavailable; without probes, traffic hits not-yet-ready Pods.
- "Rollback re-pulls or rebuilds the old version" — no; the old ReplicaSet is still there scaled to 0, so `undo` just scales it back up. Instant.
- "maxSurge and maxUnavailable are the same knob" — surge adds Pods *above* desired (speed); unavailable removes Pods *below* desired (availability). Different directions.
- "You can edit a Deployment's selector to re-target Pods" — the selector is immutable after creation; you must recreate the Deployment.
- "Old ReplicaSets are deleted after a rollout" — they're kept (up to `revisionHistoryLimit`) precisely to enable rollback.

**What follows from this topic**

Deployments assume stateless, interchangeable Pods — for stable identity/storage you reach for **StatefulSets**, and for one-per-node you use **DaemonSets** (later workload topics). Zero-downtime rollouts depend entirely on **probes** and on **Services/EndpointSlices** removing not-ready Pods from rotation, tying this directly to the networking and health-checking topics. Autoscaling (HPA) adjusts the `replicas` you set here. And when Kubernetes' built-in rollout primitives aren't enough — real canary analysis, automated metric-based promotion, blue-green with traffic shifting — you layer on tools like **Argo Rollouts** or a service mesh. Master the Deployment/ReplicaSet loop and you understand the beating heart of how apps actually ship on Kubernetes.

### Q1. Explain the Deployment → ReplicaSet → Pod hierarchy.

Three layers, each a controller managing the one below:

- **Pod** — runs your containers; mortal and disposable.
- **ReplicaSet** — ensures exactly **N identical Pods** matching its label selector are running; if one dies it creates a replacement. It knows nothing about versions or rollouts.
- **Deployment** — manages **ReplicaSets** to give you declarative updates, rollout control, revision history, and rollback. When you change the Pod template, the Deployment creates a *new* ReplicaSet and orchestrates the transition.

```
Deployment (rollout logic, history)
   └── ReplicaSet (keeps N Pods alive)
          └── Pod, Pod, Pod
```

You interact with the **Deployment**; it creates and drives ReplicaSets; they create and maintain Pods. Each link is an `ownerReference`, and each layer is the reconciliation loop specialized: the ReplicaSet reconciles *Pod count*, the Deployment reconciles *which ReplicaSet is active and at what size*.

### Q2. What exactly does a ReplicaSet do?

A **ReplicaSet** has one job: **keep a specified number of Pods matching its label selector running**. Its reconciliation loop continuously compares actual matching Pods to `.spec.replicas`:

- Too few → create Pods from its template.
- Too many → delete surplus Pods.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
spec:
  replicas: 3
  selector:
    matchLabels: { app: my-app }   # which Pods it owns
  template:                        # what new Pods look like
    metadata: { labels: { app: my-app } }
    spec:
      containers: [{ name: app, image: my-registry/app:1.2.3 }]
```

Note the template labels **must** match the selector. Because it selects by label, a ReplicaSet will "adopt" any bare Pod that matches its selector (and conversely can delete Pods you didn't expect if labels overlap). It has **no** concept of updates or rollouts — change the template and existing Pods are untouched. That gap is exactly why the Deployment exists on top.

### Q3. Why use a Deployment instead of a ReplicaSet directly?

Because a ReplicaSet only maintains a Pod count — it has **no rollout story**. Change a ReplicaSet's template and existing Pods don't update; you'd have to manually create a new ReplicaSet and hand-orchestrate scaling both, with no history or rollback.

A **Deployment** wraps ReplicaSets to add exactly what's missing:
- **Rolling updates** — automatically creates a new ReplicaSet and shifts replicas over safely.
- **Rollback** — keeps old ReplicaSets as revisions; `kubectl rollout undo` is instant.
- **Rollout control** — `pause`/`resume`, `status`, `history`, progress deadlines.
- **Declarative version changes** — `kubectl set image` or editing the template triggers a managed rollout.

So the rule: for stateless apps you create **Deployments**, never bare ReplicaSets. You basically never author a ReplicaSet by hand — the Deployment creates and names them for you. The only time you look at ReplicaSets directly is when *debugging* a rollout.

### Q4. How does a rolling update actually work under the hood?

When you change the Pod template, the Deployment controller:

1. Creates a **new ReplicaSet** (with the new template), initially at 0 replicas.
2. **Scales the new ReplicaSet up** and the **old ReplicaSet down**, a few Pods at a time, respecting `maxSurge` (how far above desired it may go) and `maxUnavailable` (how far below).
3. Waits for new Pods to become **Ready** (readiness probe) before counting them and continuing.
4. Repeats until the new ReplicaSet is at full desired count and the old one is at 0.

```
old RS: 3 → 3 → 2 → 1 → 0
new RS: 0 → 1 → 2 → 3 → 3   (each new Pod must go Ready before proceeding)
```

The old ReplicaSet isn't deleted — it's parked at 0 as a revision for rollback. Throughout, the Service's endpoints only include **Ready** Pods, so clients are always served by working instances of *some* version. That interplay — two ReplicaSets, gated by readiness — is the entire mechanism, and it's just the reconciliation loop driving toward the new desired state.

### Q5. Explain maxSurge and maxUnavailable.

These two `rollingUpdate` parameters bound how aggressive a rolling update can be. Both accept an absolute number or a percentage of desired replicas.

- **maxSurge** — how many Pods the Deployment may run **above** the desired count during the update. Higher = faster rollout (more new Pods spin up before old ones drain) but more temporary resource use.
- **maxUnavailable** — how many Pods may be **below** desired (unavailable) during the update. Higher = faster but less capacity/availability during the roll; `0` means never dip below full capacity.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%
    maxUnavailable: 25%
```

They pull in opposite directions: surge adds headroom *above*, unavailable allows a dip *below*. For a **zero-capacity-loss** rollout set `maxUnavailable: 0` and `maxSurge: >0` (spin up new before removing old — needs spare resources). For **resource-constrained** clusters, `maxSurge: 0` with `maxUnavailable: 1` updates in place but loses a little capacity at a time. They can't both be 0 (the rollout could never make progress).

### Q6. Recreate vs RollingUpdate — when do you use each?

| | RollingUpdate (default) | Recreate |
|---|---|---|
| How | Incrementally shift old→new | Kill all old, then start all new |
| Downtime | None (with probes) | Yes — a gap with no Pods |
| Two versions live at once | Yes, briefly | No |
| Use when | Stateless services, zero-downtime | Can't run v1 and v2 together |

**RollingUpdate** is the default and right choice for almost all stateless web services — no downtime, gradual. Its one caveat: **both versions run simultaneously** during the roll, so your app and its schema must tolerate that (backward/forward-compatible changes).

**Recreate** tears everything down first, causing an availability gap, but guarantees **only one version runs at a time**. You want it when concurrent versions are unsafe — e.g. an incompatible database migration, or a singleton that can't have two instances (an exclusive lock, a non-shareable resource). For stateful/leader-based systems you'd typically use a StatefulSet with its own update strategy instead.

### Q7. What do `kubectl rollout status`, `history`, and `undo` do?

The rollout verb family is how you drive and observe deployments:

```bash
kubectl rollout status deploy/my-app        # block until rollout completes or fails
kubectl rollout history deploy/my-app       # list revisions
kubectl rollout history deploy/my-app --revision=3   # details of a specific revision
kubectl rollout undo deploy/my-app          # roll back to the previous revision
kubectl rollout undo deploy/my-app --to-revision=3   # roll back to a specific one
kubectl rollout pause deploy/my-app         # freeze rollout (for canary/staged changes)
kubectl rollout resume deploy/my-app        # continue
kubectl rollout restart deploy/my-app       # roll all Pods (e.g. to pick up new config)
```

- **status** — watch progress; returns non-zero on failure, so it's the gate in CI/CD pipelines.
- **history** — shows revisions (each old ReplicaSet). Tip: use `--record` or annotations to capture the change cause.
- **undo** — the emergency brake; it scales the previous ReplicaSet back up. Instant because the old ReplicaSet is still there at 0.

This trio — watch, inspect, revert — is the core operational loop for shipping and recovering.

### Q8. How does revision history and rollback work? Why is rollback so fast?

Each time you change a Deployment's Pod template, the Deployment records a **revision** — effectively "which ReplicaSet + template was active." Old ReplicaSets are **not deleted**; they're scaled to **0** and retained (up to `revisionHistoryLimit`, default 10).

Rollback is fast precisely because of this: `kubectl rollout undo` doesn't re-pull an old image, rebuild anything, or reconstruct state — it just **scales the previous ReplicaSet back up and the current one down**, the same rolling motion in reverse. The old Pods' exact spec is already on file.

```bash
kubectl rollout history deploy/my-app          # see revisions 1,2,3...
kubectl rollout undo deploy/my-app --to-revision=2
```

Two practical notes: set `revisionHistoryLimit` sensibly (too high clutters the cluster with 0-replica ReplicaSets; too low loses rollback targets), and rollback only reverts the **workload spec** — it does *not* undo external side effects like a database migration. For anything with irreversible data changes, "just roll back" is a trap.

### Q9. How does a Deployment achieve zero-downtime? What role do readiness probes play?

Zero-downtime hinges on one thing: **traffic only ever goes to Pods that are Ready**, and **readiness probes** are what define "Ready."

The mechanism: a Service selects Pods by label, but the **EndpointSlice** controller only adds a Pod to the Service's endpoints once its **readiness probe passes**. During a rolling update:
1. A new Pod starts but is **not yet Ready** → it's *not* in the Service endpoints → receives no traffic.
2. Its readiness probe passes → it's added to endpoints → starts receiving traffic.
3. Only *then* does the Deployment scale down an old Pod, which is first removed from endpoints (and given a graceful termination period) before it stops.

```yaml
readinessProbe:
  httpGet: { path: /healthz, port: 8080 }
  initialDelaySeconds: 5
  periodSeconds: 5
```

Without a readiness probe, Kubernetes considers a container "ready" the instant it starts, so the Service routes traffic to a Pod that may still be warming up — you'll drop requests mid-rollout and *think* it succeeded. Readiness probes (plus `maxUnavailable` keeping enough Pods serving, and graceful shutdown draining old ones) are collectively what make the rollout invisible to users.

### Q10. What's the label selector immutability gotcha?

A Deployment's `.spec.selector` is **immutable** — once created, you cannot change it. The api-server rejects the update. Same for ReplicaSets, StatefulSets, and Jobs.

Why it's a trap: people try to "re-label" a running app by editing the selector and matching template labels, and the apply fails with a validation error like `field is immutable`. The reason for the restriction is safety — the selector defines *which Pods this controller owns*; changing it mid-flight could orphan running Pods or make the controller adopt/delete the wrong ones.

The fix when you truly need a new selector: **create a new Deployment** (with the new labels) and migrate traffic to it, then delete the old one — often done as a blue-green cutover. You can freely change **template labels that aren't part of the selector**, and you can add labels, but the `matchLabels`/`matchExpressions` in the selector are frozen for the object's life. It's a common surprise during refactors, so call it out when discussing Deployment changes.

### Q11. How do you scale a Deployment?

Two ways, both just changing the desired `replicas`:

```bash
# Imperative — quick, but drifts from your YAML
kubectl scale deploy/my-app --replicas=5

# Declarative — edit replicas in the manifest and apply
kubectl apply -f deployment.yaml
```

The Deployment updates its active ReplicaSet's `replicas`, whose reconciliation loop then creates or deletes Pods to match. Scaling is *not* a rollout — no new ReplicaSet, no revision; it just changes the count on the current one.

Two real-world notes:
- **Autoscaling:** the **HorizontalPodAutoscaler (HPA)** adjusts `replicas` for you based on CPU/memory/custom metrics. If an HPA manages a Deployment, don't also hard-code `replicas` in the YAML you continuously apply — they'll fight (your apply resets it, the HPA re-scales it). Omit `replicas` from the applied manifest when an HPA owns it.
- **Scale to zero:** `--replicas=0` keeps the Deployment but runs no Pods — handy for pausing a workload without deleting it.

### Q12. How do you pause and resume a rollout, and why?

```bash
kubectl rollout pause deploy/my-app
# ... make several changes: set image, edit env, change resources ...
kubectl rollout resume deploy/my-app
```

**Pausing** freezes the Deployment controller so it **stops reconciling template changes into a rollout**. While paused, you can make *multiple* edits (new image, new env vars, new resource limits) and they accumulate without each one triggering its own separate rolling update. **Resuming** then rolls everything out in a single controlled update.

Two main uses:
- **Batching changes** — avoid N sequential rollouts (and N sets of Pod churn) when you're making several related edits at once.
- **Manual canary / staged rollouts** — a common pattern is: bump the image so a *few* new Pods appear, then `pause`, observe metrics/logs on the new version, and either `resume` (promote) or `undo` (abort). It's a poor-man's canary using only built-in primitives; for real metric-driven canaries you'd use Argo Rollouts or a mesh.

Note pausing a Deployment doesn't stop the *ReplicaSet* from maintaining its current Pods — self-healing continues; only new *rollouts* are frozen.

### Q13. How do you do canary and blue-green with Kubernetes primitives, and where do you need more?

**Blue-green** with built-ins: run two Deployments (`blue` = current, `green` = new) and flip a **Service selector** from one to the other to cut traffic over instantly. Rollback = flip back. Simple, but doubles resources and gives an all-or-nothing switch with no gradual exposure.

**Canary** with built-ins: run a small second Deployment of the new version behind the *same* Service (same labels), so it receives a *fraction* of traffic proportional to its Pod count (e.g. 1 canary Pod among 9 stable ≈ 10%). Observe, then scale it up / roll the main Deployment. Crude — traffic split is only as granular as Pod ratios, and there's no automated analysis.

Where you outgrow primitives: you need **precise, percentage-based traffic shifting** (10% → 25% → 50%), **automated promotion/rollback based on metrics** (error rate, latency), or **header/cookie-based routing**. That requires a **service mesh** (Istio/Linkerd for traffic splitting) or a progressive-delivery controller like **Argo Rollouts** or **Flagger**, which add a `Rollout` CRD that does metric-gated canary/blue-green natively. The interview signal: know the built-ins *and* know exactly where they run out.

### Q14. What is progressDeadlineSeconds and what makes a rollout "stuck"?

`progressDeadlineSeconds` (default 600) is how long a rollout may go **without making progress** before the Deployment marks it **failed**. "Progress" means the new ReplicaSet advancing — new Pods becoming Ready. If nothing improves for that long, the Deployment sets a `Progressing=False` condition with reason `ProgressDeadlineExceeded`.

A rollout gets **stuck** when new Pods can't become Ready, so the controller — correctly — refuses to scale down the old ones and keeps serving the old version. Common causes:
- **Failing readiness probe** — new version never reports ready (bad probe path/port, slow start).
- **CrashLoopBackOff** — new image crashes on startup (bad config, missing env/secret).
- **ImagePullBackOff** — wrong image tag or missing registry credentials.
- **Insufficient resources / unschedulable** — new Pods stay Pending.

```bash
kubectl rollout status deploy/my-app          # reports it's stuck / exceeded
kubectl get pods -l app=my-app                # find the not-Ready new Pods
kubectl describe pod <new-pod>                # Events name the cause
```

Note that `ProgressDeadlineExceeded` **doesn't auto-rollback** — it just flags failure; you decide to `rollout undo`. The safety property is that a stuck rollout **leaves the old version serving**, so users aren't affected while you fix it.

### Q15. What does `kubectl set image` do?

`kubectl set image` is the quick, imperative way to change a container's image on a running workload, which triggers a rolling update:

```bash
kubectl set image deploy/my-app app=my-registry/app:1.3.0
```

This patches the Deployment's Pod template (`app` container → new image), which the Deployment controller sees as a template change and rolls out via a new ReplicaSet — exactly as if you'd edited the YAML. It's the fastest way to ship a new version from a CI pipeline or the command line.

Two caveats worth stating:
- **Drift.** Like all imperative edits, it makes the live state diverge from your committed YAML. In a GitOps setup you'd instead update the manifest and let the sync tool apply it, so Git stays the source of truth.
- **Specify the container name.** The `app=` prefix targets a specific container by name — needed for multi-container Pods; getting it wrong silently no-ops or errors.

For record-keeping, older workflows used `--record`; today you'd annotate the change cause or (better) drive it from version control.

### Q16. What happens to old ReplicaSets after a rollout?

They **stick around, scaled to 0**. After a successful rolling update the new ReplicaSet is at full replicas and each previous one is kept at 0 as a **revision** for rollback. They are *not* deleted immediately.

How many are kept is governed by **`revisionHistoryLimit`** (default 10) on the Deployment. Once the number of old (0-replica) ReplicaSets exceeds it, the Deployment controller garbage-collects the oldest ones — trimming history you can no longer roll back to.

```bash
kubectl get rs -l app=my-app     # you'll see the active RS (N) + old ones (0)
```

Tradeoff: a higher limit gives more rollback targets but litters the cluster with dormant ReplicaSets (and some tooling/list noise); a lower limit keeps things tidy but shortens your rollback window. Setting it to `0` disables rollback history entirely. So after a deploy, seeing several `app-xxxx 0 0 0` ReplicaSets alongside your active one is normal and healthy — that's your rollback safety net, not garbage.

### Q17. Explain ownerReferences and garbage collection in this hierarchy.

**ownerReferences** are the parent links that make the hierarchy real: each ReplicaSet has an ownerReference to its Deployment, and each Pod has one to its ReplicaSet. They record "this object is owned by that one."

Kubernetes uses them for **cascading garbage collection**. When you delete a Deployment, you don't manually delete its ReplicaSets and Pods — the **garbage collector** sees objects whose owner is gone and deletes them too:

```bash
kubectl delete deploy/my-app                     # cascades: RS + Pods deleted
kubectl delete deploy/my-app --cascade=orphan    # delete only the Deployment; orphan the RS/Pods
```

- **Foreground/Background cascade** (default background) deletes owned objects.
- **Orphan** cascade cuts the ownerReference, leaving the children running without a parent (occasionally useful for surgery).

This is also why a ReplicaSet "adopts" matching Pods (it sets itself as owner) and why deleting a ReplicaSet cleans up its Pods. The same ownerReference mechanism underlies all controllers — it's the general Kubernetes answer to "when a parent goes away, what happens to its children." Understanding it explains both cascading deletes and the occasional mystery of orphaned Pods lingering after a botched delete.
## StatefulSets, DaemonSets, Jobs & CronJobs

### Summary

**What this topic covers**

Deployments are the right controller for stateless web apps, but Kubernetes ships four other workload controllers for the jobs a ReplicaSet can't express: **StatefulSets** for apps that need stable identity and per-pod storage (databases, Kafka, ZooKeeper, Elasticsearch), **DaemonSets** for a copy of a pod on every node (log shippers, node exporters, CNI/CSI agents), **Jobs** for run-to-completion batch work, and **CronJobs** for Jobs on a schedule. The 16 questions in this topic cover how each controller reconciles, the fields that actually change behaviour (`volumeClaimTemplates`, `serviceName`, `podManagementPolicy`, `partition`, `completions`/`parallelism`, `backoffLimit`, `restartPolicy`, `concurrencyPolicy`, `startingDeadlineSeconds`, `ttlSecondsAfterFinished`), and — most importantly — how to choose the right one. The recurring senior theme: a StatefulSet gives you *identity and ordering*, not high availability. HA is a property of the application, not the controller.

**Mental model**

Every workload controller is a reconciliation loop turning a desired-state spec in etcd into running pods. What differs is the *shape* of "desired". A Deployment says "N interchangeable pods, I don't care which is which" — pods get random name suffixes and can be replaced freely. A StatefulSet says "N pods with *identities*: pod-0, pod-1, pod-2, each with its own sticky storage and DNS name, created and destroyed in order." A DaemonSet says "one pod per matching node, and it's the scheduler-plus-node-lifecycle that decides count, not a replica number." A Job says "run pods until K of them succeed, then stop." A CronJob is a Job factory driven by a cron clock. The mental unlock: pick the controller by the *guarantee the app needs* — interchangeability (Deployment), stable identity + ordered lifecycle + sticky disk (StatefulSet), node-coverage (DaemonSet), or finite completion (Job/CronJob). Everything else follows.

**Key terms**

- **StatefulSet** — controller giving pods stable ordinal names, stable per-pod storage, and ordered, graceful deployment/scaling.
- **Headless Service** — a Service with `clusterIP: None`; its DNS returns individual pod A-records, giving each StatefulSet pod a stable hostname. Referenced by `serviceName`.
- **volumeClaimTemplates** — StatefulSet field that provisions a *separate* PVC per pod (`data-web-0`, `data-web-1`), so each replica keeps its own disk across rescheduling.
- **podManagementPolicy** — `OrderedReady` (default, one-at-a-time) vs `Parallel` (all pods at once, drops the ordering guarantee).
- **DaemonSet** — runs one pod per node (subject to selectors/taints); scales with the cluster, not a replica count.
- **Job** — runs pods to successful completion; controlled by `completions` and `parallelism`.
- **backoffLimit** — number of retries before a Job is marked Failed.
- **restartPolicy** — for Jobs, `Never` (new pod per failure) or `OnFailure` (restart the container in place); `Always` is illegal for Jobs.
- **CronJob** — creates Jobs on a cron `schedule`.
- **concurrencyPolicy** — `Allow` / `Forbid` / `Replace`: what to do when a run is still going at the next tick.
- **ttlSecondsAfterFinished** — auto-deletes finished Jobs (and their pods) after N seconds.
- **Indexed Job** — `completionMode: Indexed` gives each pod a stable completion index (0..N-1) via `JOB_COMPLETION_INDEX`, for static work partitioning.

**Why interviewers ask this**

This topic separates people who've only run `kubectl create deployment` from people who've operated stateful and batch workloads in production. The junior answer is "StatefulSet = for databases." The senior answer explains *why*: stable network identity so peers can find each other, sticky PVCs so a rescheduled pod reattaches its data, and ordered scaling so you don't, say, bootstrap three primaries at once. Interviewers probe the failure modes: "your StatefulSet pod-1 is stuck Pending — why can't pod-2 start?" (ordered rollout), "you deleted the StatefulSet but the data survived — why?" (PVCs aren't garbage-collected by default), "your CronJob missed 200 runs after a control-plane outage — what happens now?" (`startingDeadlineSeconds`, missed-schedule counting). Getting these right signals you've been paged for them.

**Common confusions**

- "StatefulSet gives me high availability" — no. It gives identity, ordering, and sticky storage. HA (leader election, replication, quorum) is the *application's* job. A StatefulSet with a single replica is a single point of failure with a nice name.
- "Deleting a StatefulSet deletes its data" — no. PVCs created from `volumeClaimTemplates` are retained by default; you delete them manually (or use `persistentVolumeClaimRetentionPolicy`).
- "DaemonSet needs a replica count" — no. Its replica count *is* the number of eligible nodes; add a node, you get another pod automatically.
- "Jobs use `restartPolicy: Always`" — illegal. Jobs and CronJobs must use `Never` or `OnFailure`.
- "CronJob schedules are exact" — they're best-effort. A missed window (controller down, `startingDeadlineSeconds` exceeded) can skip runs entirely.
- "`completions` and `parallelism` are the same knob" — `completions` = how many successes you need total; `parallelism` = how many pods run at once.

**What follows from this topic**

StatefulSets lean directly on the two topics either side of this one: **Services & Cluster Networking** (the headless Service that gives each pod its DNS identity) and storage (the per-pod PVCs bound to PVs via a StorageClass). Ordered rollouts here echo the rolling-update mechanics from the Deployments topic, but with the ordering and identity guarantees layered on. Jobs and CronJobs connect to observability and cleanup — finished pods pile up without `ttlSecondsAfterFinished`, and debugging a failed CronJob is a `kubectl get jobs` / `kubectl logs` exercise. If you understand *why* each controller exists, the "which one should I use" interview question answers itself.

### Q1. What problem does a StatefulSet solve that a Deployment can't?

A Deployment treats pods as interchangeable cattle: random name suffixes, no stable network identity, shared or no persistent storage, and replacement in any order. That's perfect for stateless web tiers and wrong for anything where a pod *is* someone — a database replica, a Kafka broker, a ZooKeeper node.

A StatefulSet adds three guarantees:

- **Stable, ordinal identity** — pods are named `<name>-0`, `<name>-1`, `<name>-2`. Pod-0 rescheduled onto another node comes back as pod-0, same hostname, same DNS.
- **Stable per-pod storage** — via `volumeClaimTemplates`, each pod gets its own PVC (`data-<name>-0`) that follows it across rescheduling, so its data persists.
- **Ordered, graceful lifecycle** — pods are created 0→1→2, scaled down 2→1→0, and (by default) each waits for the previous to be Ready before proceeding.

You reach for it when peers must address each other by stable name (clustered databases, message brokers, distributed consensus systems) or when each replica owns durable, non-shareable state.

### Q2. How does a StatefulSet give each pod a stable network identity?

Through a **headless Service** (`clusterIP: None`) named in the StatefulSet's `serviceName`. A normal Service load-balances across a virtual IP; a headless Service instead publishes per-pod DNS A-records. Each pod gets an addressable, stable hostname:

`<pod-name>.<service-name>.<namespace>.svc.cluster.local` → e.g. `web-0.nginx.default.svc.cluster.local`.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  clusterIP: None          # headless
  selector:
    app: nginx
  ports:
  - port: 80
    name: web
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: nginx       # ties the StatefulSet to the headless Service
  replicas: 3
  selector:
    matchLabels: { app: nginx }
  template:
    metadata:
      labels: { app: nginx }
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
```

Because `web-0`'s hostname is stable across rescheduling, peers can hard-code or discover it — exactly what clustered systems need for gossip, replication, and quorum membership.

### Q3. How does per-pod storage work in a StatefulSet?

Via `volumeClaimTemplates`. Instead of one shared PVC, the StatefulSet controller creates a *distinct* PVC per pod, named `<template-name>-<pod-name>`:

```yaml
spec:
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
```

For a 3-replica StatefulSet you get `data-web-0`, `data-web-1`, `data-web-2`. When pod-1 is rescheduled to another node, it re-binds `data-web-1` — its data follows it. Two consequences interviewers care about:

- **PVCs are not deleted when the StatefulSet is deleted** (by default). This protects data but leaves orphaned PVCs to clean up manually. `persistentVolumeClaimRetentionPolicy` (whenDeleted/whenScaled) lets you opt into automatic deletion.
- **Scaling down doesn't delete the PVC** either — scale back up and the pod reattaches its old disk.

### Q4. Why is "StatefulSet = high availability" a misconception?

Because a StatefulSet provides *identity, ordering, and sticky storage* — not availability. Nothing about running `db-0`, `db-1`, `db-2` makes them a replicated, fault-tolerant database. That replication, leader election, failover, and quorum logic lives in the *application* (Postgres with Patroni, Kafka's ISR, etcd's Raft).

A single-replica StatefulSet is a single point of failure. A three-replica StatefulSet where the app doesn't replicate data is three independent single points of failure. Kubernetes gives you the scaffolding (stable names so peers find each other, sticky disks so data survives rescheduling); the app supplies the actual HA. The senior framing: "StatefulSet solves *scheduling and identity* for stateful apps; it does not solve *distributed systems*."

### Q5. Explain ordered deployment and scaling in a StatefulSet.

By default (`podManagementPolicy: OrderedReady`):

- **Scale up / create**: pods start sequentially 0 → 1 → 2. Pod N is not created until pod N-1 is Running *and* Ready.
- **Scale down / delete**: pods terminate in reverse, highest ordinal first: 2 → 1 → 0, one at a time.
- **Rolling update**: pods are updated in reverse ordinal order, one at a time, each waiting for the previous to be Ready.

This matters for systems where bootstrapping order is significant — e.g. pod-0 is the seed/primary and later pods join it. The trade-off is speed: a stuck pod-1 blocks pod-2 forever.

If your app doesn't need ordering (all replicas are peers that self-organise), set `podManagementPolicy: Parallel` to launch/scale all pods at once — you keep stable identity and storage but drop the ordering guarantee.

### Q6. Your StatefulSet is stuck: pod-1 is Pending and pod-2 never appears. Why?

Because `OrderedReady` (the default) blocks strictly on ordinal order — pod-2 is not created until pod-1 is Ready. So the real question is *why pod-1 is Pending*. Debug it like any pending pod:

```bash
kubectl describe pod web-1
kubectl get events --field-selector involvedObject.name=web-1
```

Common causes specific to StatefulSets:

- **Unschedulable PVC** — `data-web-1` can't bind (no available PV, StorageClass can't provision, zone mismatch: the PV is in a zone with no schedulable node).
- **Insufficient resources** — no node satisfies the pod's requests.
- **Readiness never true** — if pod-1 starts but never passes its readiness probe, the rollout stalls there indefinitely.

The fix depends on the cause, but the *lesson* is that ordered management turns one bad pod into a wedged StatefulSet. If ordering isn't required, `podManagementPolicy: Parallel` avoids the head-of-line blocking.

### Q7. What update strategies does a StatefulSet support?

Two, set under `spec.updateStrategy`:

- **RollingUpdate** (default) — updates pods in reverse ordinal order, one at a time, waiting for Ready between each. Supports a **`partition`**: only pods with ordinal ≥ partition are updated. Set `partition: 2` on a 3-replica set and only `web-2` updates; drop it to 1, then 0, to progress a canary manually. Partition = 0 means update everything.
- **OnDelete** — the controller does *not* update pods automatically; you delete a pod and its replacement comes up on the new spec. Full manual control, useful when you need to orchestrate updates yourself (e.g. drain a database node before replacing it).

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 2      # canary: only ordinals >= 2 update
```

The `partition` field is the StatefulSet's built-in canary knob for stateful systems where you want to validate one replica before rolling the rest.

### Q8. What is a DaemonSet and what is it for?

A DaemonSet ensures a copy of a pod runs on **every node** (or every node matching a selector). As nodes join the cluster, they get the pod automatically; as nodes leave, their pods are garbage-collected. There's no replica count — the count *is* the number of eligible nodes.

Canonical uses are per-node infrastructure:

- **Log collection** — Fluent Bit / Fluentd / Vector tailing each node's container logs.
- **Node monitoring** — Prometheus node-exporter, cAdvisor-style metrics agents.
- **Networking** — CNI agents (Cilium, Calico) that program each node's dataplane.
- **Storage** — CSI node plugins that mount volumes on the node.
- **Security** — Falco, per-node runtime security agents.

The mental model: "one agent per machine," managed declaratively so you never hand-place it.

### Q9. How do you run a DaemonSet on control-plane nodes, and how does it schedule?

Control-plane nodes carry taints (e.g. `node-role.kubernetes.io/control-plane:NoSchedule`) so ordinary pods stay off them. A DaemonSet that must cover *every* node (a CNI or monitoring agent) needs matching **tolerations**:

```yaml
spec:
  template:
    spec:
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      nodeSelector:
        kubernetes.io/os: linux
```

Scheduling: modern DaemonSets are scheduled by the **default kube-scheduler** using node affinity that the DaemonSet controller injects per node (not by the controller bypassing the scheduler as in older versions). You restrict which nodes get the pod with `nodeSelector`, `affinity`, and by which taints you tolerate. To *exclude* nodes, simply don't tolerate their taints or don't match their labels.

### Q10. Compare Deployment, StatefulSet, DaemonSet, and Job. When do you use each?

| Controller | Replica model | Identity | Storage | Use when |
|---|---|---|---|---|
| **Deployment** | N interchangeable pods | None (random suffix) | Shared / none | Stateless services, web/API tiers |
| **StatefulSet** | N ordered pods | Stable (pod-0..N) | Per-pod sticky PVC | Databases, brokers, clustered apps needing identity |
| **DaemonSet** | One per node | Per-node | Per-node (often hostPath) | Node agents: logging, metrics, CNI, CSI |
| **Job / CronJob** | Run to completion | Ephemeral | Usually none | Batch, migrations, backups, scheduled tasks |

Decision heuristic: interchangeable and stateless → Deployment. Needs stable name / sticky disk / ordered lifecycle → StatefulSet. Needs to run on every node → DaemonSet. Finite work that ends → Job; on a schedule → CronJob.

### Q11. How do `completions` and `parallelism` control a Job?

- **`completions`** — total number of pods that must succeed for the Job to be complete.
- **`parallelism`** — maximum number of pods running concurrently.

They combine into three common patterns:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: import
spec:
  completions: 10      # need 10 successes
  parallelism: 3       # at most 3 at a time
  backoffLimit: 4
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: worker
        image: my-registry/importer:1.2.3
```

Patterns:

- **Single run-to-completion** — omit both (defaults to 1/1): one pod, succeeds once.
- **Fixed completion count** — `completions: N`, `parallelism: P`: run N successes, P at a time (a work queue draining N items).
- **Work-queue** — set `parallelism` only (no `completions`): pods run in parallel until any pod exits 0 signalling the queue is empty.

### Q12. What do `backoffLimit` and `restartPolicy` mean for a Job?

- **`restartPolicy`** (required to be `Never` or `OnFailure` for Jobs; `Always` is rejected):
  - `Never` — a failed container's pod is left failed and the Job controller creates a *new* pod for the retry. You get one pod per attempt (good for inspecting failed pods' logs).
  - `OnFailure` — the kubelet restarts the container *in place* in the same pod. Fewer pod objects, but you lose the per-attempt pod history.
- **`backoffLimit`** — number of retries before the Job is marked **Failed** (default 6). Retries use exponential back-off (10s, 20s, 40s… capped). Once exceeded, the Job stops creating pods and reports failure.

Interview trap: with `restartPolicy: OnFailure`, in-place container restarts *also* count toward the back-off, and a crash-looping container can burn the whole budget fast. If you want to keep failed pods around to debug, use `Never`.

### Q13. What is an indexed Job and when is it useful?

By default a Job's completions are interchangeable — any pod can satisfy any of the N successes. An **indexed Job** (`completionMode: Indexed`) assigns each completion a stable index 0..N-1, exposed to the pod as the `JOB_COMPLETION_INDEX` env var (and in the pod's hostname/annotation).

```yaml
spec:
  completions: 5
  parallelism: 5
  completionMode: Indexed
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: shard
        image: my-registry/processor:1.2.3
        # container reads JOB_COMPLETION_INDEX to pick its shard
```

This is for **static work partitioning**: each index owns a fixed slice of the work (shard 0 processes partition 0, etc.) without needing an external queue. It's the batch analogue of a StatefulSet's ordinal identity — each pod knows *which* worker it is.

### Q14. Explain CronJob `concurrencyPolicy`, `startingDeadlineSeconds`, and history limits.

A CronJob creates a Job at each cron tick. The knobs that govern its behaviour:

- **`concurrencyPolicy`** — what to do if the previous Job is still running when the next tick fires:
  - `Allow` (default) — run them concurrently.
  - `Forbid` — skip the new run; don't overlap.
  - `Replace` — kill the running Job and start the new one.
- **`startingDeadlineSeconds`** — if a scheduled run is missed (controller was down, cluster busy) by more than this many seconds, skip it rather than running late. Without it, a controller that was down could try to back-fill many missed runs at once.
- **`successfulJobsHistoryLimit` / `failedJobsHistoryLimit`** — how many finished Jobs to retain (default 3 / 1). Prevents completed Jobs and their pods from accumulating forever.
- **`suspend: true`** — pause the CronJob without deleting it (existing Jobs keep running; no new ones are created).

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 300
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: my-registry/backup:1.2.3
```

### Q15. A CronJob's control plane was down for hours. What happens when it recovers, and how do you protect against a thundering herd?

When the CronJob controller comes back, it looks at how many schedule times were missed. Two protections govern the outcome:

- **`startingDeadlineSeconds`** — any missed run older than this deadline is skipped. Without it set, the controller will attempt to start the most recent missed run (and if it counts more than ~100 missed schedules within the deadline window, it gives up and logs an error, refusing to schedule until you fix it).
- **`concurrencyPolicy: Forbid`** — even if multiple runs would fire, they won't stack up overlapping.

The safe production configuration for a job you don't want back-filled: set a tight `startingDeadlineSeconds` (e.g. 200) so stale runs are dropped, and `Forbid` so recovery doesn't launch overlapping copies. The failure mode to avoid: no deadline + `Allow` → the controller fires many catch-up Jobs at once, hammering whatever the job touches (a database, an external API).

### Q16. How do you stop finished Jobs from piling up?

Finished Jobs and their pods are **not** automatically deleted — they linger so you can inspect logs and status, which over time clutters the namespace and consumes etcd objects. Two mechanisms:

- **`ttlSecondsAfterFinished`** — on the Job spec, the TTL-after-finished controller deletes the Job (and cascades to its pods) N seconds after it Completes or Fails:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: one-shot
spec:
  ttlSecondsAfterFinished: 600   # clean up 10 min after finishing
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: task
        image: my-registry/task:1.2.3
```

- **CronJob history limits** — `successfulJobsHistoryLimit` / `failedJobsHistoryLimit` cap how many finished Jobs each CronJob keeps.

Best practice: set `ttlSecondsAfterFinished` on standalone Jobs (migrations, ad-hoc tasks) and rely on history limits for CronJobs. Together they keep the namespace and etcd clean without manual `kubectl delete jobs`.

## Services & Cluster Networking

### Summary

**What this topic covers**

Pods are ephemeral — they die, reschedule, and get new IPs constantly — so you can never point a client at a pod IP and expect it to keep working. The **Service** is Kubernetes' answer: a stable virtual IP and DNS name that fronts a changing set of pods selected by labels. This topic covers the whole request path: why Services exist, how they select pods via **EndpointSlices**, the four Service **types** (ClusterIP, NodePort, LoadBalancer, ExternalName) and when each is right, **headless** Services for stable per-pod DNS, how **kube-proxy** actually implements a Service (iptables vs IPVS, and eBPF dataplanes like Cilium), the flat **Kubernetes networking model** (every pod gets a routable IP, no NAT between pods), **CoreDNS** and service FQDNs, and the operational knobs — `port`/`targetPort`/`nodePort`, `externalTrafficPolicy`, session affinity, multi-port services. The 17 questions run from "what is a Service" to "this Service has no endpoints — debug it" and "why did my client's source IP disappear."

**Mental model**

Think of a Service as a *stable name with a load balancer behind it*, decoupled from the pods it points at by a label selector. The api-server watches pods matching the selector and writes their IPs into **EndpointSlice** objects; kube-proxy on every node watches those and programs the node's kernel (iptables/IPVS rules or eBPF maps) so that traffic to the Service's virtual IP is DNAT'd to a healthy backing pod. CoreDNS gives the Service a DNS name so clients use `my-svc` instead of an IP. The crucial insight: **the ClusterIP isn't a real interface anywhere** — it's a virtual address that exists only as forwarding rules in each node's kernel. Nothing listens on it; packets to it are rewritten to a pod IP by the dataplane. Once you internalise "Service = selector → EndpointSlices → kube-proxy rules → pod," every debugging question (no endpoints, wrong port, lost source IP) becomes a matter of asking which link in that chain broke.

**Key terms**

- **Service** — stable virtual IP + DNS name fronting a set of pods chosen by a label selector.
- **ClusterIP** — the default type; a virtual IP reachable only inside the cluster.
- **EndpointSlice** — the object listing the ready pod IPs/ports behind a Service (the scalable successor to Endpoints).
- **kube-proxy** — node agent that programs the dataplane (iptables/IPVS) to implement Service virtual IPs.
- **Headless Service** — `clusterIP: None`; DNS returns pod IPs directly instead of a virtual IP.
- **NodePort** — exposes the Service on a static port on every node's IP.
- **LoadBalancer** — provisions an external (cloud) load balancer that routes to the NodePorts.
- **ExternalName** — maps a Service name to an external DNS name via a CNAME; no proxying.
- **CoreDNS** — the cluster DNS server; resolves Service and pod names.
- **externalTrafficPolicy** — `Cluster` (spread, may SNAT) vs `Local` (only local pods, preserves client source IP).
- **kube-proxy modes** — `iptables` (default, rule-based), `IPVS` (hash-table, scales to many services), plus eBPF dataplanes (Cilium) that can replace kube-proxy.
- **Service FQDN** — `<svc>.<namespace>.svc.cluster.local`.

**Why interviewers ask this**

Networking is where "I deployed something" turns into "I understand how the request actually reaches my pod." Almost every real Kubernetes outage has a networking component — a Service with no endpoints, a readiness probe removing pods, a source-IP-based allowlist broken by SNAT, DNS resolution failing under load. The junior signal is reciting the four Service types. The senior signal is drawing the data path — selector to EndpointSlice to kube-proxy to pod — and knowing *where* to look when it breaks: `kubectl get endpointslices`, `kubectl describe svc`, checking pod readiness, checking `externalTrafficPolicy` when source IPs vanish. Interviewers also probe the model itself ("does anything actually listen on the ClusterIP?") because understanding that it's virtual, kernel-level forwarding is what lets you reason about performance and failure.

**Common confusions**

- "The ClusterIP is an IP on some pod or node" — no. It's virtual; it exists only as forwarding rules in each node's kernel. Nothing binds to it.
- "NodePort and LoadBalancer are alternatives to ClusterIP" — they *build on* it. A LoadBalancer Service is a NodePort Service is a ClusterIP Service, layered.
- "A Service load-balances at L7" — no, ClusterIP/NodePort/LoadBalancer are L4 (TCP/UDP). L7 routing is Ingress/Gateway.
- "kube-proxy proxies the traffic" — in iptables/IPVS mode it *programs the kernel* to forward; it isn't in the data path per-packet.
- "Headless Services load-balance" — they don't; they hand back all pod IPs and let the client choose.
- "No endpoints means the Service is broken" — usually the *pods* are the problem: selector mismatch or no pod is Ready.
- "Pods talk to each other through NAT" — no; the K8s model is a flat network, pod-to-pod with no NAT.

**What follows from this topic**

Services are the foundation the next topic — **Ingress & Gateway API** — builds on: Ingress is L7 HTTP routing that ultimately forwards to ClusterIP Services, and a LoadBalancer Service is the alternative "one external IP per service" approach Ingress exists to avoid. Headless Services tie back to **StatefulSets** (stable per-pod DNS). The flat networking model here is what **NetworkPolicies** later restrict. And `externalTrafficPolicy`, endpoints, and readiness connect straight to the health-probe and rollout mechanics from the workloads topics — a pod failing readiness silently leaves a Service, which is one of the most common "it's up but getting no traffic" incidents.

### Q1. Why do Services exist? What problem do they solve?

Pods are ephemeral and mortal. They're created and destroyed constantly — during rollouts, scaling, node failures, evictions — and each new pod gets a **new IP**. If a client hard-coded a pod's IP, it would break the moment that pod was replaced. There's also no built-in load balancing across a set of replicas.

A **Service** solves both:

- **Stable endpoint** — a fixed virtual IP (ClusterIP) and a stable DNS name that outlive any individual pod. Clients target the Service, not a pod.
- **Load balancing** — traffic to the Service is spread across all *ready* pods that match its label selector.
- **Decoupling** — the selector means pods can come and go; the Service automatically tracks the current healthy set via EndpointSlices.

So a Service turns "a shifting herd of mortal pods" into "one stable address that always points at the live ones."

### Q2. How does a Service know which pods to send traffic to?

Through a **label selector**. The Service declares `selector:` matching labels on pods; the control plane continuously watches for pods that (a) match the selector and (b) are **Ready**, and records their IP:port into **EndpointSlice** objects (the modern, shard-friendly replacement for the single Endpoints object).

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app          # matches pods labelled app=my-app
  ports:
  - port: 80
    targetPort: 8080
```

```bash
kubectl get endpointslices -l kubernetes.io/service-name=my-app
kubectl describe svc my-app        # shows the resolved endpoints
```

kube-proxy on each node watches those EndpointSlices and programs the dataplane so traffic to the ClusterIP is forwarded to one of the listed pod IPs. Only **Ready** pods appear — a pod failing its readiness probe is pulled out of the set automatically. A Service with a selector that matches nothing (or matches no ready pods) has *no endpoints* and blackholes traffic.

### Q3. Compare the Service types: ClusterIP, NodePort, LoadBalancer, ExternalName.

| Type | Reachable from | How | Use when |
|---|---|---|---|
| **ClusterIP** (default) | Inside cluster only | Virtual IP + DNS, kube-proxy forwards to pods | Internal service-to-service traffic |
| **NodePort** | Outside via `<nodeIP>:<port>` | Opens a static port (30000–32767) on every node | Dev/on-prem, or behind your own LB |
| **LoadBalancer** | Outside via a real LB IP | Cloud provisions an external LB → NodePorts → pods | Exposing a service to the internet on a cloud |
| **ExternalName** | Inside cluster | CNAME to an external DNS name; no proxying, no selector | Aliasing an external dependency by cluster name |

The key relationship: they **stack**. A NodePort Service also has a ClusterIP; a LoadBalancer Service also has a NodePort and a ClusterIP. Each layer adds an exposure mechanism on top of the one below. ExternalName is the odd one out — it's pure DNS indirection (returns a CNAME to, say, `db.example.com`) with no virtual IP and no pods.

### Q4. What is a headless Service and when do you use one?

A headless Service sets `clusterIP: None`. It has **no virtual IP** and does **no load balancing**. Instead, a DNS lookup of the Service name returns the **A-records of all the individual backing pods** directly.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: cassandra
spec:
  clusterIP: None
  selector:
    app: cassandra
  ports:
  - port: 9042
```

Two main uses:

- **StatefulSets** — combined with a StatefulSet's `serviceName`, each pod gets a stable DNS name (`cassandra-0.cassandra.default.svc.cluster.local`), which clustered systems need to address peers directly.
- **Client-side load balancing / discovery** — the client gets the full list of pod IPs and picks its own (useful for gRPC clients that manage their own connection pooling, or databases that connect to specific replicas).

You use it whenever the client needs to know about *individual* pods, not a single virtual endpoint.

### Q5. How does kube-proxy actually implement a Service? Compare iptables, IPVS, and eBPF.

kube-proxy runs on every node, watches Services and EndpointSlices, and programs the node's kernel so packets to a ClusterIP are DNAT'd to a backing pod IP. It is **not** in the per-packet data path — it configures the kernel; the kernel forwards.

- **iptables mode** (default) — installs iptables rules; backend selection is effectively random per connection. Simple and robust, but rule evaluation is O(n) in the number of services/endpoints, so very large clusters (tens of thousands of services) see slower rule updates and matching.
- **IPVS mode** — uses the kernel's IP Virtual Server (a hash table) for O(1) lookups and real load-balancing algorithms (round-robin, least-conn, etc.). Scales to many more services with faster updates. Needs the IPVS kernel modules.
- **eBPF dataplanes (Cilium, and Calico's eBPF mode)** — replace kube-proxy entirely, implementing Service forwarding as eBPF programs attached in the kernel. Lower latency, better scaling, and per-connection load balancing without iptables rule bloat. Increasingly the default on large or performance-sensitive clusters.

The interview point: in all the rule-based modes, kube-proxy is a *control-plane* agent programming the dataplane — the forwarding happens in the kernel, not in a userspace proxy (that old mode is deprecated).

### Q6. Describe the Kubernetes networking model.

Kubernetes mandates a **flat network** with three rules:

1. **Every pod gets its own routable IP.** No shared host IP, no port-mapping gymnastics — a pod's containers share that one IP.
2. **Pods can reach every other pod directly, across nodes, without NAT.** Pod IPs are real and routable cluster-wide; a packet from pod A to pod B arrives with A's actual source IP.
3. **Nodes can reach all pods (and vice-versa) without NAT.**

This "IP-per-pod, no-NAT" model is what makes Kubernetes networking predictable — an app sees the same peer IPs it would on a flat VM network. The model is a *contract*; the implementation is a **CNI plugin** (Cilium, Calico, Flannel, AWS VPC CNI, etc.) that programs routes/overlays to satisfy it. Everything else — Services (virtual IPs layered on top), NetworkPolicies (restrictions on the flat network) — assumes this baseline.

### Q7. How does DNS work in a cluster?

**CoreDNS** runs as a Deployment (fronted by a ClusterIP Service, usually `kube-dns`) and every pod's `/etc/resolv.conf` points at it. It resolves:

- **Services** — `<service>.<namespace>.svc.cluster.local` → the Service's ClusterIP (or, for headless, the pod IPs). Search-domain magic means a pod can use the short name `my-svc` for a Service in its own namespace, or `my-svc.other-ns` cross-namespace.
- **Pods** (headless / StatefulSet) — stable per-pod names like `web-0.nginx.default.svc.cluster.local`.

```bash
# from inside a pod
nslookup my-svc                          # same-namespace short name
nslookup my-svc.prod.svc.cluster.local   # fully-qualified
```

The FQDN structure is `<name>.<namespace>.svc.cluster.local`. Because DNS is on the request path for nearly everything, CoreDNS problems (overloaded, misconfigured, `ndots` retry storms) show up as cluster-wide latency and intermittent connection failures — a classic senior debugging story.

### Q8. Explain `port`, `targetPort`, and `nodePort`.

They're three different ports on the request path — a frequent source of confusion:

- **`port`** — the port the **Service** listens on (what clients hit on the ClusterIP). `my-svc:80`.
- **`targetPort`** — the port on the **pod/container** that traffic is forwarded to. Can be a number or a named port from the container spec.
- **`nodePort`** — (NodePort/LoadBalancer only) the port opened on **every node's IP** for external access (30000–32767).

```yaml
spec:
  type: NodePort
  ports:
  - port: 80          # Service virtual IP :80
    targetPort: 8080  # pod listens on :8080
    nodePort: 30080   # every node exposes :30080 externally
```

Path: external client → `nodeIP:30080` → Service `:80` → pod `:8080`. A common misconfig is `targetPort` not matching the container's actual listening port — the Service has endpoints but every connection is refused/reset.

### Q9. What does `externalTrafficPolicy: Local` vs `Cluster` do?

It controls how external traffic (NodePort/LoadBalancer) is handled once it hits a node — and whether the client's source IP survives:

- **`Cluster`** (default) — a node receiving external traffic may forward it to a pod on *any* node. This spreads load evenly, but the second hop is **SNAT'd**, so the pod sees the *node's* IP as the source, not the real client's. You lose the client source IP; you gain even distribution.
- **`Local`** — a node only routes external traffic to pods **on that same node** (and drops it if there are none). No SNAT, so the pod sees the **real client source IP**. The trade-off: potential imbalance (nodes without a pod get no traffic) — cloud load balancers use the node's health-check response to route only to nodes that have a local pod.

Use `Local` when you need the client IP (source-IP allowlists, geolocation, audit logging) or to avoid the extra hop. Use `Cluster` for the smoothest load spreading when the source IP doesn't matter.

### Q10. A client's real source IP is showing up as a node IP. Why, and how do you fix it?

Because the Service is using `externalTrafficPolicy: Cluster` (the default). When external traffic lands on a node that doesn't host a backing pod, the node forwards it to another node and **SNATs** the packet — so the pod sees the intermediate node's IP instead of the client's.

Fixes:

- **Set `externalTrafficPolicy: Local`** on the NodePort/LoadBalancer Service. This keeps traffic node-local (no second hop, no SNAT), so the client IP is preserved. Accept the load-distribution trade-off.
- **Terminate at L7 and use `X-Forwarded-For`** — if you front the service with an Ingress/L7 load balancer, it can inject the client IP into a header, and the app reads that instead of the socket source IP.
- **Proxy protocol** — some cloud LBs / Ingress controllers support the PROXY protocol to pass the original client IP at L4.

The senior framing: preserving source IP at L4 costs you the free cross-node balancing, so decide whether you actually need it or whether an L7 header is sufficient.

### Q11. What is session affinity and how do you enable it?

By default a Service load-balances per connection, so successive requests from the same client can land on different pods. **Session affinity** pins a client to the same backing pod based on client IP:

```yaml
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800   # 3h stickiness
```

This is L4, client-IP-based stickiness (the only option kube-proxy offers). It's a blunt instrument: it breaks when clients sit behind a shared NAT (many clients look like one IP) and it's not cookie-based like an L7 load balancer. For real sticky sessions in HTTP apps, prefer an Ingress/Gateway with cookie-based affinity, or — better — make the app stateless and externalise session state (Redis) so affinity isn't needed at all.

### Q12. How does a LoadBalancer Service get provisioned on a cloud?

When you create a `type: LoadBalancer` Service, the **cloud-controller-manager** (or an out-of-tree cloud provider controller) sees it and calls the cloud's API to provision an external load balancer (an AWS NLB/ELB, GCP forwarding rule, Azure LB). That LB is configured to forward to the Service's **NodePorts** across the cluster nodes; the external IP/hostname is written back into the Service's `status.loadBalancer.ingress`.

```bash
kubectl get svc my-app        # EXTERNAL-IP is <pending> until the cloud provisions it
```

Notes that come up in interviews:

- On bare-metal there's no cloud LB, so `EXTERNAL-IP` stays `<pending>` unless you run something like **MetalLB** to fulfil the request.
- Provider-specific behaviour (internal vs internet-facing LB, NLB vs ALB, health checks) is driven by **annotations** on the Service.
- One LoadBalancer per Service gets expensive/limited at scale — which is exactly the motivation for **Ingress** (one LB, many services routed by L7).

### Q13. Your Service has no endpoints. Walk through debugging it.

"No endpoints" almost always means the *pods* aren't being matched or aren't Ready — the Service object itself is rarely the culprit.

```bash
kubectl get endpointslices -l kubernetes.io/service-name=my-svc   # empty?
kubectl describe svc my-svc                                       # check Selector + Endpoints
kubectl get pods -l app=my-app -o wide                            # do matching pods exist?
kubectl get pods -l app=my-app                                    # are they READY 1/1?
```

Walk the chain:

1. **Selector mismatch** — the Service's `selector` labels don't match the pods' labels (typo, wrong key). Compare `kubectl describe svc` selector against `kubectl get pods --show-labels`.
2. **No Ready pods** — pods exist but are failing their **readiness probe**, so they're excluded from endpoints. `kubectl describe pod` to see why the probe fails.
3. **Wrong `targetPort`** — endpoints populate but connections fail because `targetPort` doesn't match the container's listening port (this shows as endpoints-present-but-refused rather than no-endpoints).
4. **Pods not scheduled / crashing** — no running pods at all → nothing to select.

The mental model — selector → ready pods → EndpointSlice → kube-proxy — tells you exactly which link to inspect.

### Q14. How do you define a multi-port Service?

When a pod exposes multiple ports (e.g. HTTP and metrics), the Service must **name** each port so they're unambiguous:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
  ports:
  - name: http          # names are required when there's >1 port
    port: 80
    targetPort: 8080
  - name: metrics
    port: 9090
    targetPort: 9090
```

Each entry is an independent `port → targetPort` mapping. Naming lets other resources (Ingress, ServiceMonitor) reference a specific port by name (`http`, `metrics`) rather than number, which is more robust across changes. With a single port, the `name` is optional.

### Q15. What's the difference between a Service and an Ingress?

They operate at different layers and solve different problems:

- A **Service** (ClusterIP/NodePort/LoadBalancer) is **L4** (TCP/UDP). It gives a stable virtual IP and load-balances connections across pods. It knows nothing about HTTP hosts, paths, or TLS.
- An **Ingress** is **L7** HTTP(S) routing. It routes by **host and path** (`api.example.com/v1` → service-a, `/v2` → service-b), terminates **TLS**, and lets many services share a single external entry point — implemented by an Ingress controller that itself usually sits behind one LoadBalancer Service.

So they compose: external client → LoadBalancer → Ingress controller (L7 routing/TLS) → ClusterIP Services → pods. You use a bare LoadBalancer Service when you need raw L4 exposure of one service; you use Ingress when you want host/path routing and TLS for many HTTP services behind one IP. (Details in the next topic.)

### Q16. Can two Services select overlapping pods, and what happens with readiness?

Yes — selectors aren't exclusive. A pod labelled `app=my-app,tier=api` can be selected by both a broad Service (`app=my-app`) and a narrow one (`tier=api`); it'll appear in both Services' EndpointSlices and receive traffic from both. This is normal and useful (e.g. a headless Service for peer discovery *and* a ClusterIP for load-balanced access to the same StatefulSet pods).

**Readiness** governs membership independently for each Service: a pod is only in a Service's endpoints while it passes readiness. The important operational consequence — a pod that flips to not-Ready (failing probe, `preStop` draining) is removed from *all* Services selecting it, immediately stopping new traffic. This is the mechanism behind graceful rollouts and zero-downtime deploys: mark not-Ready → drain from endpoints → terminate.

### Q17. When would you use `ExternalName`, and how does it differ from the other types?

`ExternalName` maps a cluster-internal Service name to an **external DNS name** via a CNAME record — no ClusterIP, no selector, no pods, no proxying:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: prod-db
spec:
  type: ExternalName
  externalName: db.example.com
```

Now in-cluster clients resolve `prod-db.default.svc.cluster.local` and get a CNAME to `db.example.com`. It's pure DNS indirection.

Use it to give an external dependency (a managed database, a third-party API) a stable *in-cluster* name, so app config references `prod-db` regardless of environment, and you can later swap the external target — or point the same name at an in-cluster Service — without changing the app. Differences from the others: it does no load balancing and doesn't touch kube-proxy (it's resolved entirely by CoreDNS), and it only works for name-based (not IP-based) endpoints, since it's a CNAME.

## Ingress & Gateway API

### Summary

**What this topic covers**

A LoadBalancer Service gives you one external IP per service, which gets expensive and unwieldy fast. **Ingress** solves the "one entry point, many services" problem with L7 HTTP routing — route by host and path, terminate TLS, all behind a single load balancer. This topic covers what Ingress is versus the **Ingress controller** you must install to make it do anything, the rule model (host, path, `pathType`), **TLS termination** (secrets and cert-manager for automatic certs), default backends, the **annotation** mess that controller-specific behaviour creates, **IngressClass**, and *why* Ingress's limitations (weak expressiveness, no role separation, HTTP-mostly, annotation sprawl) drove the community to build the **Gateway API**. It then covers the Gateway API model (GatewayClass, Gateway, HTTPRoute/TCPRoute, role-oriented split between infra and app teams), how Ingress compares to a bare LoadBalancer Service and to a full API Gateway, canary/traffic-splitting, path rewriting, and when to stop reaching for Ingress and adopt a **service mesh** instead. The 15 questions run from "what does Ingress solve" to "design routing for a multi-team platform."

**Mental model**

Think in two halves: the **resource** (a piece of desired-state config) and the **controller** (the thing that reads it and does the work). An Ingress *resource* is inert YAML describing routing rules; nothing happens until an **Ingress controller** (nginx, Traefik, HAProxy, or a cloud one) is running to watch those resources and configure an actual proxy/load balancer to match. This is the single most common Ingress "why isn't it working" — the resource exists, but no controller is installed or the `ingressClassName` doesn't match one. The Gateway API keeps this controller-driven model but fixes Ingress's structural weaknesses: instead of one overloaded resource plus vendor annotations, it splits responsibilities into **GatewayClass** (the implementation), **Gateway** (the L4/L7 listener, owned by infra/platform teams), and **HTTPRoute/TCPRoute** (the routing rules, owned by app teams). The whole area is about **L7 traffic management** — get "resource describes intent, controller realises it" and the rest is detail.

**Key terms**

- **Ingress** — an API object describing L7 HTTP routing rules (host/path → Service).
- **Ingress controller** — the component (nginx, Traefik, HAProxy, cloud) that watches Ingress objects and configures a real proxy; **you must install one**.
- **IngressClass** — associates an Ingress with a particular controller (via `ingressClassName`).
- **pathType** — `Prefix`, `Exact`, or `ImplementationSpecific`; controls how the path is matched.
- **TLS termination** — decrypting HTTPS at the Ingress using a certificate from a Secret.
- **cert-manager** — controller that automatically issues/renews TLS certs (e.g. from Let's Encrypt via ACME).
- **default backend** — where unmatched requests go (often a 404 service).
- **annotations** — controller-specific behaviour bolted onto Ingress objects (rewrite, rate-limit, auth) — non-portable.
- **Gateway API** — the successor: role-oriented, more expressive, portable routing API.
- **GatewayClass / Gateway / HTTPRoute** — the Gateway API's split of implementation / listener / routing rules.
- **API Gateway** — a richer edge product (auth, rate limiting, quotas, transformation) beyond simple routing.
- **Service mesh** — sidecar/eBPF-based mTLS, traffic policy, and observability for *service-to-service* (east-west) traffic.

**Why interviewers ask this**

Edge routing is where architecture decisions become visible: how do external users reach your services, how is TLS handled, how do teams share ingress without stepping on each other. The junior answer is "Ingress routes HTTP." The senior answer distinguishes the resource from the controller, explains *why* you'd pick Ingress over N LoadBalancer Services (cost, one entry point, host/path routing, central TLS), recognises the annotation problem as a portability smell, and knows the Gateway API exists specifically to fix Ingress's role-separation and expressiveness gaps. Interviewers use this to test whether you've operated multi-team platforms and whether you understand the north-south (edge) vs east-west (mesh) distinction — a very common muddle. "When would you use Ingress vs a service mesh?" reliably separates people who've drawn a real platform architecture from people who've only followed a tutorial.

**Common confusions**

- "Creating an Ingress exposes my app" — no. Without an Ingress *controller* installed, the Ingress object does nothing.
- "Ingress and a LoadBalancer Service are competing choices" — Ingress usually *runs behind* one LoadBalancer Service; it's the L7 layer that multiplexes many services through that one L4 entry point.
- "pathType doesn't matter" — `Prefix` vs `Exact` changes matching semantics and is a frequent routing bug.
- "Ingress handles gRPC/TCP/UDP natively" — Ingress is HTTP(S)-centric; non-HTTP needs annotations/CRDs or the Gateway API.
- "Annotations are just config" — they're *vendor-specific* config that makes your Ingress non-portable across controllers.
- "Gateway API is just Ingress v2" — it's a redesign with role separation and richer routing, not a version bump.
- "Ingress and a service mesh do the same thing" — Ingress is north-south (edge → cluster); a mesh is east-west (service ↔ service).

**What follows from this topic**

Ingress and Gateway API sit directly on top of **Services & Cluster Networking**: they route L7 traffic to the ClusterIP Services from the previous topic, and the Ingress controller itself is typically fronted by a LoadBalancer Service. TLS termination here connects to secrets management; canary/traffic-splitting connects to progressive-delivery and the rollout mechanics from the workloads topics. The north-south vs east-west distinction opens the door to service mesh and NetworkPolicy topics — this is the boundary of the cluster, where external traffic enters, and understanding it is the prerequisite for reasoning about the internal traffic policies that govern everything behind it.

### Q1. What problem does Ingress solve?

Without Ingress, exposing each HTTP service externally means a `type: LoadBalancer` Service *per service* — each provisioning (and costing) its own cloud load balancer and consuming an external IP. Ten services = ten load balancers. And a bare L4 Service can't route by hostname or URL path, or terminate TLS centrally.

**Ingress** provides **L7 HTTP routing through a single entry point**:

- **Host-based routing** — `app.example.com` → frontend, `api.example.com` → backend.
- **Path-based routing** — `example.com/shop` → one service, `example.com/blog` → another.
- **One load balancer, many services** — the Ingress controller sits behind a single LoadBalancer, multiplexing traffic to many ClusterIP Services.
- **Central TLS termination** — HTTPS certs managed in one place.

So Ingress turns "one LB per service" into "one LB, routed by L7 rules to many services" — cheaper, simpler, and with hostname/path/TLS capabilities a raw Service doesn't have.

### Q2. Explain the difference between an Ingress resource and an Ingress controller.

This is the single most important distinction in the topic:

- The **Ingress resource** is just **declarative config** — a Kubernetes object describing routing rules (hosts, paths, TLS, backend services). On its own it *does nothing*. It's desired state with no actor.
- The **Ingress controller** is the **running component** that watches Ingress resources and configures an actual reverse proxy / load balancer to implement them. You must **install one yourself** — it isn't built into Kubernetes. Common choices: ingress-nginx, Traefik, HAProxy, or cloud controllers (AWS Load Balancer Controller, GKE Ingress).

```bash
kubectl get ingress            # your resources
kubectl get pods -n ingress-nginx   # the controller that realises them
```

The classic failure: you `kubectl apply` an Ingress, get an address of `<none>` or a 404, and nothing routes — because **no controller is installed**, or the `ingressClassName` doesn't match the controller you have. Resource without controller = inert.

### Q3. How do Ingress rules and `pathType` work?

An Ingress is a set of rules, each optionally scoped to a **host** and containing **paths** that map to backend Services:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
spec:
  ingressClassName: nginx
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
```

**`pathType`** controls matching:

- **`Prefix`** — matches by URL path segments. `/api` matches `/api`, `/api/`, `/api/v1`. Most common.
- **`Exact`** — matches the path exactly and case-sensitively. `/api` matches only `/api`.
- **`ImplementationSpecific`** — semantics are up to the controller (nginx regex, etc.) — non-portable.

Getting `Prefix` vs `Exact` wrong is a routine routing bug (e.g. `Exact: /api` silently failing to match `/api/users`).

### Q4. How does TLS termination work in Ingress, and how do you automate certs?

You reference a **Secret** containing a TLS cert/key, and the controller terminates HTTPS at the edge (decrypts, then forwards plain HTTP to the backend Service):

```yaml
spec:
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls        # a kubernetes.io/tls Secret with tls.crt + tls.key
  rules:
  - host: app.example.com
    http: { ... }
```

Managing certs by hand (creating/rotating Secrets) doesn't scale. **cert-manager** automates it: you install cert-manager, define an **Issuer/ClusterIssuer** (e.g. Let's Encrypt via the ACME protocol), and annotate the Ingress. cert-manager then requests, validates (HTTP-01 or DNS-01 challenge), stores the cert in the Secret, and **auto-renews** before expiry:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

Result: TLS certs are provisioned and rotated automatically with no human in the loop.

### Q5. What is a default backend?

The **default backend** is where the Ingress controller sends requests that **match no rule** — an unknown host or an unmatched path. Typically it's a small service returning a 404 page (the controller ships one by default), but you can point it at your own service to serve a custom error page, a catch-all app, or a redirect.

You can set it at the controller level (a global fallback) or per-Ingress via `spec.defaultBackend`:

```yaml
spec:
  defaultBackend:
    service:
      name: fallback-svc
      port:
        number: 80
```

It's the "everything else" branch of the routing table — useful for graceful handling of misrouted traffic instead of a bare connection error.

### Q6. Why are Ingress annotations considered messy?

Because the core Ingress spec only standardises basic host/path routing and TLS. **Everything else** — URL rewriting, rate limiting, authentication, CORS, timeouts, canary weighting, sticky sessions, backend protocol (gRPC/HTTPS) — is expressed through **controller-specific annotations**:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/rate-limit: "100"
```

Problems this creates:

- **Non-portable** — those `nginx.ingress.kubernetes.io/*` annotations mean nothing to Traefik or HAProxy; switching controllers means rewriting them.
- **Untyped / unvalidated** — they're strings, so typos fail silently or at apply time, not at schema validation.
- **Divergent behaviour** — the same conceptual feature has different annotations and semantics per controller.

This annotation sprawl — a genuinely important capability squeezed into unvalidated key-value strings — is one of the main structural reasons the community designed the **Gateway API** to express these things as first-class, typed, portable fields.

### Q7. What is IngressClass?

**IngressClass** decouples an Ingress resource from the specific controller that should handle it — important when a cluster runs more than one Ingress controller (e.g. an internal and an external nginx, or nginx alongside a cloud controller).

You reference it via `spec.ingressClassName`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  ingressClassName: nginx      # this controller handles it
```

An `IngressClass` object names a controller and can be marked the cluster **default** (via the `ingressclass.kubernetes.io/is-default-class` annotation), so Ingresses omitting `ingressClassName` fall to it. It replaced the old `kubernetes.io/ingress.class` annotation. A frequent bug: an Ingress with an `ingressClassName` that no installed controller claims — so nothing picks it up and it never gets an address.

### Q8. What limitations of Ingress led to the Gateway API?

Four structural gaps:

- **Weak expressiveness** — the core spec only does host/path routing + TLS. Header-based routing, traffic splitting, rewrites, and richer matching all require non-standard annotations.
- **No role separation** — one Ingress object mixes concerns owned by different teams: the platform team's listener/TLS/IP config and the app team's routing rules live in the same resource, with no clean RBAC boundary.
- **Limited protocol support** — Ingress is HTTP(S)-centric; TCP/UDP/gRPC are afterthoughts handled via annotations or controller-specific CRDs.
- **Annotation portability** — as above, real capabilities live in vendor annotations, so Ingress configs aren't portable across implementations.

The **Gateway API** was designed to fix all four: expressive typed routing (headers, weights, rewrites as first-class fields), a **role-oriented** resource split, native multi-protocol support (HTTPRoute/TCPRoute/GRPCRoute), and portability across implementations. It's now the recommended direction for new L7 routing.

### Q9. Describe the Gateway API model.

The Gateway API splits routing into layered resources aligned with **organisational roles**:

- **GatewayClass** — the *implementation* (analogous to IngressClass / StorageClass). Installed by the infra provider; says "this is the Cilium/Istio/nginx Gateway implementation." Cluster-scoped.
- **Gateway** — a concrete listener: ports, protocols, TLS config, and the external IP/LB. Owned by the **platform/infra team**. "We expose HTTPS on this address."
- **HTTPRoute** (and `TCPRoute`, `GRPCRoute`, `TLSRoute`) — the actual routing rules: match by host/path/header/method, split traffic by weight, rewrite, redirect, mirror. Attached to a Gateway and owned by **app teams**.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
spec:
  parentRefs:
  - name: prod-gateway         # attaches to a Gateway owned by infra
  hostnames: ["api.example.com"]
  rules:
  - matches:
    - path: { type: PathPrefix, value: /v1 }
    backendRefs:
    - name: api-v1
      port: 80
```

The win: infra owns Gateways (IPs, TLS, listeners) with RBAC control over which namespaces/routes may attach, while app teams independently manage their HTTPRoutes — clean separation Ingress can't express.

### Q10. Compare Ingress, a LoadBalancer Service, and an API Gateway.

| | LoadBalancer Service | Ingress | API Gateway |
|---|---|---|---|
| Layer | L4 (TCP/UDP) | L7 (HTTP/S) | L7+ |
| Routing | None (one service) | Host/path | Host/path + rich (headers, versions) |
| TLS | Passthrough | Terminate | Terminate + mTLS |
| Cost/entry | One LB **per service** | One LB, **many services** | One LB, many services |
| Extra features | — | Basic (annotations) | Auth, rate limit, quotas, transforms, API keys, analytics |
| Typical use | Raw L4 exposure | HTTP multiplexing + TLS | Public product APIs, monetised/partner APIs |

Progression: a **LoadBalancer Service** exposes one thing at L4. **Ingress** adds L7 host/path routing and central TLS so many HTTP services share one entry point. An **API Gateway** (Kong, Ambassador/Emissary, cloud API gateways, or a Gateway API implementation with policy plugins) adds product-grade edge features — authn/authz, rate limiting, quotas, request transformation, API-key management — that go well beyond routing. Pick the least you need: most internal HTTP wants Ingress; public/partner-facing APIs with policy and monetisation want an API Gateway.

### Q11. How do you do canary or traffic splitting with Ingress or the Gateway API?

**With Ingress** — there's no standard field, so it's controller-specific annotations. ingress-nginx, for example, uses a second "canary" Ingress:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"   # 10% to canary
```

Two Ingresses for the same host/path — the primary and the canary — with the controller splitting by weight (or by header/cookie). Non-portable, and different controllers do it differently.

**With the Gateway API** — traffic splitting is a **first-class field**: multiple `backendRefs` with weights on one HTTPRoute:

```yaml
  rules:
  - backendRefs:
    - name: app-v1
      port: 80
      weight: 90
    - name: app-v2
      port: 80
      weight: 10
```

This is portable across implementations and integrates cleanly with progressive-delivery tools (Argo Rollouts, Flagger) that adjust the weights automatically based on metrics. The Gateway API's typed weighting is a big part of why it's preferred for canary workflows.

### Q12. How does path rewriting work, and what's the gotcha?

Path rewriting strips or transforms the URL path before forwarding to the backend — e.g. external `/api/users` should hit the backend as `/users`. In Ingress it's an annotation (again, controller-specific):

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
  - http:
      paths:
      - path: /api(/|$)(.*)      # capture group feeds $2
        pathType: ImplementationSpecific
        backend: { ... }
```

The gotcha: rewrite rules often force `pathType: ImplementationSpecific` and controller-specific regex/capture-group syntax, so behaviour differs across controllers and is easy to get subtly wrong (double slashes, dropped suffixes). In the **Gateway API** it's a typed, portable filter instead of a regex annotation:

```yaml
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
```

Cleaner, validated, portable — another example of Gateway API turning an annotation hack into a first-class field.

### Q13. When would you use a service mesh instead of / alongside Ingress?

Because they handle **different traffic directions**:

- **Ingress / Gateway** = **north-south** — traffic entering the cluster from outside (users → services). Edge routing, TLS termination, external exposure.
- **Service mesh** (Istio, Linkerd, Cilium) = **east-west** — traffic *between* services inside the cluster (service ↔ service).

You reach for a mesh when you need, for internal traffic:

- **Automatic mTLS** — encrypted, authenticated service-to-service comms without app changes.
- **Fine-grained traffic policy** — retries, timeouts, circuit breaking, per-request routing, canary between internal services.
- **Deep observability** — golden-signal metrics, distributed tracing, a traffic topology map, for *every* service call.
- **Zero-trust / authz** — policy on which service may call which.

They're complementary: Ingress/Gateway gets users *into* the cluster; the mesh governs what happens *between* services once inside. Many meshes also provide their own ingress gateway, blurring the line — but the mental split (north-south vs east-west) is what interviewers want. Don't adopt a mesh for its own sake; the operational complexity (sidecars, control plane) is only worth it once east-west security/observability/traffic-control needs are real.

### Q14. You applied an Ingress but requests 404 / the address is `<none>`. How do you debug it?

Walk the resource → controller → backend chain:

```bash
kubectl get ingress my-app                 # ADDRESS empty? CLASS correct?
kubectl describe ingress my-app            # events, rules, backend, TLS
kubectl get pods -n ingress-nginx          # is a controller even running?
kubectl get svc api-svc -o wide            # does the backend Service have endpoints?
kubectl get endpointslices -l kubernetes.io/service-name=api-svc
```

Most common causes, in order:

1. **No controller installed** (or crashing) — the Ingress is inert; `ADDRESS` stays empty. Install/repair the controller.
2. **`ingressClassName` mismatch** — no installed controller claims this class, so none picks it up.
3. **Backend Service has no endpoints** — the routing is fine but the target Service selects no ready pods (see the Services topic's no-endpoints debugging).
4. **Wrong host/path or `pathType`** — request doesn't match any rule → falls to the default backend's 404. Check `Host` header and `Prefix` vs `Exact`.
5. **TLS/Secret missing** — HTTPS fails if the referenced `secretName` doesn't exist or is malformed.

The framing mirrors the whole topic: resource without a matching controller does nothing, and even with routing correct, the request still has to reach a Service *with ready endpoints*.

### Q15. Design edge routing for a multi-team platform. What do you choose and why?

State the requirements first, then justify:

- **Many HTTP services, one entry point, central TLS** → not N LoadBalancer Services (cost, IP sprawl). Use an **Ingress/Gateway layer** behind a single LoadBalancer.
- **Multiple teams sharing ingress without collisions** → this is exactly Ingress's weak spot (one object mixes infra + app concerns, RBAC is coarse). Prefer the **Gateway API**: the platform team owns **Gateways** (IPs, listeners, TLS, and which namespaces may attach routes); each app team owns its **HTTPRoutes** independently. Clean RBAC boundary, no shared object to fight over.
- **Automated TLS** → **cert-manager** issuing/renewing certs (Let's Encrypt) so no team hand-manages certs.
- **Progressive delivery** → Gateway API's weighted `backendRefs` + Argo Rollouts/Flagger for automated canaries, rather than non-portable nginx canary annotations.
- **Public/partner APIs needing auth, rate limits, quotas** → put an **API Gateway** (or a Gateway API implementation with policy) in front of those specific services.
- **Internal service-to-service security/observability** → separately, a **service mesh** for east-west mTLS and traffic policy — *not* the same layer as edge routing.

The senior signal is picking **Gateway API over Ingress for the multi-team case** because of role separation, reserving API Gateway for product-facing edges, and keeping north-south (Gateway) distinct from east-west (mesh) rather than conflating them.
## Configuration: ConfigMaps & Secrets

### Summary

**What this topic covers**

How Kubernetes decouples configuration and sensitive data from container images, and the sharp edges that decoupling introduces. Two objects sit at the centre: **ConfigMaps** (non-confidential key-value or file data) and **Secrets** (the same shape, marked confidential). The 15 questions in this topic drill three concern areas: (1) **producing** config — literal keys, whole files, immutability, size limits; (2) **consuming** config — the deep difference between injecting as environment variables (fixed at pod start) versus mounting as a volume (updates propagate live-ish); and (3) **protecting** secrets — the fact that base64 is encoding, not encryption, what "encryption at rest" actually buys you, and the external secret managers (Vault, External Secrets Operator, CSI Secrets Store) real production clusters lean on. Get the env-vs-volume distinction and the base64 point right and you've cleared the two questions interviewers use to separate people who have run this in anger from people who have only read the docs.

**Mental model**

Think of ConfigMaps and Secrets as **externalised parts of your container image**. The Twelve-Factor rule is "store config in the environment" — Kubernetes gives you first-class objects for that so the *same* image runs in dev, staging and prod with different data injected at runtime. A ConfigMap is just a map of strings living in etcd; a Secret is the identical structure with a `type`, base64-encoded `data`, and a promise from the platform that it *can* be treated more carefully (kept off disk in tmpfs on the node, gated by RBAC, optionally encrypted in etcd). The second axis is **how the data reaches the process**: as env vars, the kubelet reads the object once when it starts the container and bakes the values into the process environment — nothing updates them short of a restart. As a mounted volume, the kubelet keeps the file tree in sync and refreshes it periodically, so a running process that re-reads the file sees new values. That single fork — env is a snapshot, volume is a subscription — drives most real-world config bugs.

**Key terms**

- **ConfigMap** — API object holding non-confidential config as key/value pairs or embedded files; max ~1 MiB.
- **Secret** — like a ConfigMap but for sensitive data; values base64-encoded in `data`, typed, stored in tmpfs on nodes, RBAC-gated.
- **Opaque** — the default arbitrary-key Secret type; other types are `kubernetes.io/tls`, `kubernetes.io/dockerconfigjson`, `kubernetes.io/service-account-token`, `kubernetes.io/basic-auth`, `kubernetes.io/ssh-auth`.
- **envFrom** — inject *every* key of a ConfigMap/Secret as env vars in one line; `env.valueFrom` injects a single key.
- **Projected volume** — one mount that combines keys from several ConfigMaps, Secrets, downwardAPI and serviceAccountToken sources.
- **Immutable ConfigMap/Secret** — `immutable: true`; can't be updated (only deleted/recreated), which lets the kubelet stop watching it — a real performance win at scale.
- **Encryption at rest** — `EncryptionConfiguration` on the api-server encrypts Secret data in etcd, ideally via a **KMS provider** (envelope encryption with a cloud KMS).
- **External Secrets Operator (ESO)** — syncs secrets from Vault/AWS Secrets Manager/GCP/Azure into native K8s Secrets.
- **CSI Secrets Store driver** — mounts secrets straight from an external store as a volume, optionally syncing to a K8s Secret.
- **subPath** — mount a single key from a ConfigMap/Secret as one file without hiding the rest of the target directory (but it defeats live updates).
- **Checksum annotation** — a pod-template annotation holding a hash of the config, so changing config changes the template and triggers a rollout.

**Why interviewers ask this**

Config is where correctness, security and operability collide, so it's a rich signal source. A junior answer stops at "ConfigMaps for config, Secrets for secrets." A senior answer knows Secrets are, by default, only *marginally* safer than ConfigMaps — same etcd, base64 not encryption — and can name the three things that actually harden them: least-privilege RBAC on the `secrets` resource, encryption at rest (KMS envelope, not the weak identity/aescbc-only setup), and pushing secret material out to a dedicated manager entirely. For SRE/platform roles they also want the operational reflex: "I changed a ConfigMap and nothing happened" is a top-five support ticket, and the answer (env vars don't hot-reload; roll the pods, ideally via a checksum annotation) tells them whether you've operated a cluster or just deployed to one. It's also a clean way to probe whether you understand the reconciliation model — the kubelet syncing mounted volumes is the loop in miniature.

**Common confusions**

- "Secrets are encrypted." No — by default they're **base64-encoded**, which is trivially reversible. `echo <blob> | base64 -d` reads them. Encryption at rest is opt-in.
- "Changing a ConfigMap updates my running pods." Only for **volume-mounted** keys, and even then after a sync delay and only if your app re-reads the file. **Env-var** injection is frozen at container start.
- "subPath mounts still get live updates." They don't — subPath breaks the symlink swap the kubelet uses, so subPath'd config is effectively static until restart.
- "Secrets are stored securely on nodes." They're kept in **tmpfs** (memory) on the node, but any pod with the right RBAC — or node/etcd access — can read them.
- "Bigger config? Just use a ConfigMap." There's a hard **~1 MiB** limit (etcd value cap). Large blobs belong in a volume, object store, or init-container fetch.
- "Immutable is just a safety flag." It also stops the kubelet watching the object, cutting api-server load meaningfully on large clusters.

**What follows from this topic**

Config feeds almost everything else. Mounting ConfigMaps and Secrets is a special case of the volume machinery in **Storage** (they're just volume types). Rolling pods on config change is the same rollout mechanism as **Workloads/Deployments** — the checksum-annotation trick is a deliberate hook into it. RBAC on the `secrets` resource is the sharp end of **Security & RBAC**. And when you graduate to Vault or a cloud secrets manager via the CSI driver, you're wiring an external system into the same volume-projection path you learned here. Treat this topic as the bridge between "my app runs" and "my app runs safely and reconfigurably in production."

### Q1. What problem do ConfigMaps solve, and what shapes of data can they hold?

A ConfigMap decouples configuration from the container image so the **same immutable image** runs everywhere with environment-specific data injected at runtime. Without it you'd bake config into the image (rebuild for every environment) or hand-roll config injection.

It holds string data two ways:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"                # simple key/value
  FEATURE_FLAG: "true"
  application.yaml: |              # whole file as a value
    server:
      port: 8080
    cache:
      ttl: 300
```

Simple keys become env vars or individual files; the multi-line `application.yaml` key becomes a whole config file when mounted. There's also `binaryData` (base64) for non-UTF-8 content. Create imperatively too: `kubectl create configmap app-config --from-literal=LOG_LEVEL=info --from-file=application.yaml`.

### Q2. What are the two ways to consume a ConfigMap in a pod, and what's the crucial difference between them?

**As environment variables** (via `env.valueFrom` for one key or `envFrom` for all) or **as a mounted volume** (files in a directory).

The crucial difference is update behaviour:

| | Env vars | Volume mount |
|---|---|---|
| When read | Once, at container start | Kept in sync by kubelet |
| Live updates | **No** — frozen until pod restart | **Yes** — file refreshed (sync delay ~up to a minute) |
| App must | Nothing special | Re-read the file to see changes |
| Good for | Small, stable settings | Config files, values that rotate |

```yaml
# env: fixed at start
env:
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef: { name: app-config, key: LOG_LEVEL }
# envFrom: inject every key
envFrom:
  - configMapRef: { name: app-config }
```

The gotcha interviewers love: "I edited the ConfigMap and nothing changed." If you injected via env vars, that's expected — you must roll the pods.

### Q3. How do I mount a ConfigMap as a volume, and how do updates propagate?

```yaml
volumes:
  - name: config
    configMap:
      name: app-config
containers:
  - name: app
    volumeMounts:
      - name: config
        mountPath: /etc/app     # each key becomes a file here
```

`/etc/app/application.yaml` and `/etc/app/LOG_LEVEL` appear as files. The kubelet periodically syncs the mount (governed by its sync period plus cache TTL, typically under ~1 minute). It swaps the whole directory atomically via a symlink to a timestamped `..data` dir, so readers never see a half-written tree.

Caveat: your **application must re-read the file** to notice changes — Kubernetes updates the bytes on disk, it doesn't signal your process. Many apps need a SIGHUP handler or a file watcher. And `subPath` mounts are excluded from this sync — they're static.

### Q4. Why is base64 in a Secret not encryption, and what does that imply?

`data` in a Secret is base64-**encoded**, not encrypted. Encoding is a reversible transform with no key — `echo aW5mbw== | base64 -d` prints the value. It exists so binary data survives YAML/JSON transport, nothing more.

Implications:
- Anyone who can `kubectl get secret -o yaml` (RBAC allowing) reads your secret in one command.
- Anyone with **etcd access** reads every secret unless encryption at rest is on.
- Committing a Secret manifest to git leaks the secret — base64 is not obfuscation.

So a Secret is only meaningfully protected by **RBAC** (limit who can read the `secrets` resource) and **encryption at rest** (KMS). Out of the box, a Secret is barely safer than a ConfigMap — the difference is convention, tmpfs storage on nodes, and RBAC surface, not cryptography.

### Q5. What are the built-in Secret types and when do you use each?

| Type | Purpose |
|---|---|
| `Opaque` | Default; arbitrary user key/value (passwords, API keys) |
| `kubernetes.io/tls` | TLS cert + key (`tls.crt`, `tls.key`) — used by Ingress |
| `kubernetes.io/dockerconfigjson` | Registry pull credentials for `imagePullSecrets` |
| `kubernetes.io/service-account-token` | A token for a ServiceAccount |
| `kubernetes.io/basic-auth` | `username`/`password` pair |
| `kubernetes.io/ssh-auth` | SSH private key |

Typed Secrets get validation (a `tls` Secret must have both keys) and let controllers find them. Create typed ones with helpers: `kubectl create secret tls my-tls --cert=tls.crt --key=tls.key`, or `kubectl create secret docker-registry regcred --docker-server=... --docker-username=... --docker-password=...`. Reference the pull secret with `imagePullSecrets: [{name: regcred}]` on the pod or ServiceAccount.

### Q6. How do you enable encryption at rest for Secrets in etcd?

By default the api-server writes Secret data to etcd as plaintext (base64). You enable encryption via an `EncryptionConfiguration` passed to the api-server with `--encryption-provider-config`:

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: ["secrets"]
    providers:
      - kms:                 # preferred: envelope encryption via external KMS
          apiVersion: v2
          name: my-kms
          endpoint: unix:///var/run/kms.sock
      - identity: {}         # fallback, needed to read old data
```

The **KMS provider** does envelope encryption: a per-object data key encrypts the secret, and a cloud KMS key encrypts the data key — so the root key never leaves the KMS/HSM. Avoid `aescbc`/`secretbox` with a static local key checked into the api-server config (the key sits on the control-plane node — weak). After enabling, re-encrypt existing secrets: `kubectl get secrets -A -o json | kubectl replace -f -`. On managed clusters (EKS/GKE/AKS) this is a checkbox wired to the cloud KMS.

### Q7. Given etcd encryption is off by default, how are Secrets actually protected — and how do you harden them?

Out of the box, Secrets are protected only by:
- **RBAC** — who can `get`/`list`/`watch` the `secrets` resource;
- **tmpfs on nodes** — mounted secrets live in memory, not on the node's disk;
- **not being logged** in `kubectl get` normal output.

That's thin. Hardening, roughly in order of impact:
1. **Least-privilege RBAC** — very few subjects should read secrets; scope Roles to specific namespaces and secret names. `list` on secrets is nearly as dangerous as reading them.
2. **Encryption at rest with KMS** — so an etcd backup or disk theft doesn't leak everything.
3. **External secret manager** (Vault, cloud secrets manager) via ESO or the CSI driver, so material never sits in etcd at all.
4. **Audit logging** on secret access, and **disable auto-mounted ServiceAccount tokens** where not needed.
5. **Restrict node access** — a compromised node can read the secrets of pods scheduled to it.

### Q8. What is the External Secrets Operator, and how does the CSI Secrets Store driver differ?

Both bridge Kubernetes to an external source of truth (HashiCorp Vault, AWS/GCP/Azure secret managers).

**External Secrets Operator (ESO)** runs a controller that watches `ExternalSecret` CRDs and **materialises a native K8s Secret** by pulling from the backend, keeping it refreshed. Your pods consume an ordinary Secret; the secret still lands in etcd.

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata: { name: db-creds }
spec:
  secretStoreRef: { name: vault-store, kind: SecretStore }
  target: { name: db-creds }       # creates this K8s Secret
  data:
    - secretKey: password
      remoteRef: { key: prod/db, property: password }
```

**CSI Secrets Store driver** mounts secrets **directly as a volume** from the external store at pod start — no K8s Secret required (though it can optionally sync one). Material never needs to touch etcd, which is the stronger security posture, but it only reaches pods that mount it.

Rule of thumb: ESO when things need a real K8s Secret (env vars, Ingress TLS, pull creds); CSI driver when you want secrets to bypass etcd and appear only as files in the consuming pod.

### Q9. What are immutable ConfigMaps and Secrets, and why use them?

Set `immutable: true` and the object can no longer be updated — only deleted and recreated.

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: app-config-v2 }
immutable: true
data:
  LOG_LEVEL: "info"
```

Two wins:
- **Performance** — the kubelet normally *watches* every mounted ConfigMap/Secret for changes. Marking them immutable lets it stop watching, cutting api-server watch load significantly on clusters with thousands of pods.
- **Safety** — you can't accidentally break every consumer by editing shared config in place.

The pattern pairs with **versioned names** (`app-config-v2`): to change config you create a new immutable object and update the Deployment to reference it, which also gives you a clean rollout and easy rollback.

### Q10. A pod won't pick up my config change. Walk me through the causes.

Go through them in order:

1. **Env-var injection** — if the config is consumed via `env`/`envFrom`, it's frozen at container start. Nothing propagates. **Fix:** restart the pods (`kubectl rollout restart deployment/app`).
2. **subPath mount** — subPath'd files don't get the live sync. Same fix: restart.
3. **Volume mount, but too soon** — the kubelet sync has a delay (up to ~1 minute). Wait, then check.
4. **App doesn't re-read** — the file on disk updated but your process cached it in memory at startup. Needs a file watcher or SIGHUP reload — or restart.
5. **Immutable object** — you can't edit it; you must create a new one and repoint the workload.
6. **Wrong object / namespace** — you edited a different ConfigMap, or one in another namespace.

Confirm what's actually mounted: `kubectl exec pod -- cat /etc/app/application.yaml`, and `kubectl describe pod` to see which ConfigMap/Secret is referenced.

### Q11. How do you force a rolling restart when a ConfigMap changes (the checksum annotation pattern)?

Editing a ConfigMap doesn't change the Deployment's pod template, so no rollout happens. The standard trick is to put a **hash of the config into a pod-template annotation** — now changing the config changes the template, and the Deployment controller rolls the pods:

```yaml
spec:
  template:
    metadata:
      annotations:
        checksum/config: "{{ sha256 of the configmap contents }}"
```

Helm does this natively:

```yaml
annotations:
  checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
```

Because the annotation lives in `spec.template`, any change to it is a template change → new ReplicaSet → controlled rolling update. If you're not templating, `kubectl rollout restart deployment/app` achieves the same by stamping a `kubectl.kubernetes.io/restartedAt` annotation.

### Q12. What are the size limits on ConfigMaps/Secrets, and what do you do about large data?

Both are capped at roughly **1 MiB** per object — this comes from etcd's default value-size limit, not something you should tune up. Very large ConfigMaps also bloat the api-server watch cache and slow every consumer.

For larger data:
- Put the file in a **volume** from a PVC or an object store (S3/GCS) and fetch it with an **init container**.
- Bake genuinely-static large assets into the image.
- Split config so only the small, changeable part is a ConfigMap.

If you hit "Request entity too large" or `etcdserver: request is too large` on apply, you've blown the limit.

### Q13. What is a projected volume and when is it useful?

A projected volume combines **multiple sources into a single mounted directory**: ConfigMap keys, Secret keys, `downwardAPI` fields, and a `serviceAccountToken`.

```yaml
volumes:
  - name: combined
    projected:
      sources:
        - configMap: { name: app-config }
        - secret: { name: app-secret }
        - downwardAPI:
            items:
              - path: "podname"
                fieldRef: { fieldPath: metadata.name }
        - serviceAccountToken:
            path: token
            expirationSeconds: 3600
            audience: my-api
```

It's useful when a process expects several config/secret files in one directory, and — importantly — it's how **bound, auto-rotated ServiceAccount tokens** are delivered (short-lived, audience-scoped tokens the kubelet refreshes), which is far safer than the old long-lived token Secrets.

### Q14. What's the difference between `env`, `envFrom`, and mounting for a Secret, and which is safest?

- **`env.valueFrom.secretKeyRef`** — one secret key → one env var. Env vars can leak via `/proc/<pid>/environ`, crash dumps, child processes, and logging of the environment. Frozen at start.
- **`envFrom.secretRef`** — every key of the Secret as env vars; convenient but injects everything and inherits all the env-var leak risks.
- **Volume mount** — keys become files (in tmpfs). Safer: files aren't in the process environment, can have permissions, and rotate live.

Safest is generally a **volume mount** (or the CSI driver), because env vars have a wide leakage surface and can't rotate. Use env vars only for libraries that insist on reading from the environment.

### Q15. What are the best practices for handling secrets in Kubernetes?

- **Never bake secrets into images** or commit Secret manifests / plaintext to git. Use sealed-secrets, SOPS, or an external manager if secrets must live in a repo.
- **Least-privilege RBAC** on the `secrets` resource — treat `get`/`list`/`watch` as high-privilege; scope to namespaces and named secrets.
- **Encryption at rest with a KMS provider**, not a static local key.
- **Prefer an external secret manager** (Vault / cloud) via ESO or the CSI driver so material can bypass etcd and rotate centrally.
- **Prefer volume mounts over env vars** for the smaller leak surface and live rotation.
- **Disable auto-mounted SA tokens** (`automountServiceAccountToken: false`) where a pod doesn't call the API; prefer short-lived bound tokens.
- **Rotate** regularly and on suspected compromise; **audit** secret access.
- **Immutable + versioned** Secrets for stable, rollout-friendly delivery.

## Storage: Volumes, PV, PVC, StorageClasses & CSI

### Summary

**What this topic covers**

How Kubernetes gives ephemeral, mortal pods access to storage that can outlive them — and the abstractions that let a developer say "I need 10 GiB of fast disk" without knowing whether the cluster runs on EBS, PD, Azure Disk, or a Ceph cluster. The 16 questions in this topic move through: (1) the **problem** — a container's filesystem dies with the container, so anything durable needs a **Volume**; (2) the **volume zoo** — emptyDir, hostPath (and its dangers), configMap/secret, and persistent volumes; (3) the **PV/PVC/StorageClass** triangle that separates *what storage exists* from *what a workload claims* from *how it's provisioned*; and (4) the modern plumbing — **CSI** drivers (why in-tree drivers were removed), access modes, reclaim policies, volume binding modes and topology, expansion, snapshots, and `volumeClaimTemplates` for per-replica disks in StatefulSets. The recurring senior theme: storage is where the reconciliation model meets physical reality (a disk can only attach to one node at a time), and that reality is why "just mount the same volume in three pods" usually doesn't work.

**Mental model**

Storage in Kubernetes is a **claim-check system**. A pod doesn't ask for a specific disk; it presents a **PersistentVolumeClaim** — a request for "this much capacity, this access mode, this class" — and the platform hands back a bound **PersistentVolume**, the actual storage resource. The PVC is the coat-check ticket; the PV is the coat. In the old world an admin pre-created PVs by hand (static provisioning) and PVCs bound to whatever fit. In the modern world a **StorageClass** names a **provisioner** (a CSI driver) that **dynamically** creates a PV the moment a PVC appears — no admin in the loop. The second mental anchor is **the node boundary**: most block storage (EBS, PD, Azure Disk) is `ReadWriteOnce` — attachable to exactly one node at a time — because it's a block device, not a shared filesystem. So "share a volume across pods" only works if those pods land on the same node (RWO) or you use genuinely networked storage (NFS/EFS/Filestore, `ReadWriteMany`). Everything else — binding modes, topology, snapshots — is machinery to make that claim-check work safely across zones and failures.

**Key terms**

- **Volume** — storage attached to a pod, outliving the container (but scoped to the pod's lifetime unless it's persistent).
- **emptyDir** — scratch space created empty when the pod starts, deleted when the pod dies; optionally memory-backed (tmpfs).
- **hostPath** — mounts a path from the node's own filesystem into the pod; powerful and dangerous.
- **PersistentVolume (PV)** — a cluster resource representing a real piece of storage; has capacity, access modes, reclaim policy.
- **PersistentVolumeClaim (PVC)** — a namespaced request/claim for storage; binds one-to-one with a PV.
- **StorageClass** — a template naming a provisioner + parameters; enables dynamic provisioning; one is usually the cluster **default**.
- **Provisioner** — the CSI driver that creates/deletes the backing volume (e.g. `ebs.csi.aws.com`).
- **Access modes** — `ReadWriteOnce` (RWO, one node), `ReadOnlyMany` (ROX), `ReadWriteMany` (RWX, many nodes), `ReadWriteOncePod` (exactly one pod).
- **Reclaim policy** — `Delete` (destroy backing storage when PVC is deleted) or `Retain` (keep it for manual recovery).
- **CSI** — Container Storage Interface; the out-of-tree plugin standard that replaced in-tree volume drivers.
- **volumeClaimTemplate** — a StatefulSet field that mints a **per-replica** PVC so each pod gets its own stable disk.
- **volumeBindingMode** — `Immediate` (bind/provision at PVC creation) vs `WaitForFirstConsumer` (defer until a pod schedules, so topology matches).
- **VolumeSnapshot** — a point-in-time copy of a PVC, via a CSI snapshot driver, usable to restore or clone.

**Why interviewers ask this**

Stateful workloads are where teams get burned, so storage questions sort the "I've only run stateless services" candidates from the ones who've operated databases on Kubernetes. A junior answer conflates volume, PV and PVC. A senior answer draws the claim-check triangle cleanly, knows that `ReadWriteOnce` is a node-level not pod-level constraint (until `ReadWriteOncePod`), and can explain *why* a Pending pod with an unbound PVC is often a **topology** problem — the volume was provisioned in zone A but the pod got scheduled to zone B. For platform roles they probe CSI (why in-tree drivers were deprecated and removed), reclaim policies (the classic "I deleted the PVC and my production data vanished" incident maps straight to `Delete` reclaim), and `WaitForFirstConsumer` (the fix for cross-zone binding). It's also a proxy for whether you understand that Kubernetes' declarative model bumps into hard physical constraints — a disk is a physical thing that lives somewhere, and no amount of YAML makes it two places at once.

**Common confusions**

- "Volume, PV and PVC are the same thing." No — a Volume is a pod-level mount; a PV is a cluster storage resource; a PVC is a namespaced request that binds to a PV.
- "ReadWriteOnce means one pod." It means one **node** — several pods on the *same* node can share an RWO volume. `ReadWriteOncePod` is the one that means exactly one pod.
- "I can mount my EBS volume in pods across three nodes." Block storage is RWO; only networked filesystems (NFS/EFS, RWX) span nodes.
- "Deleting the PVC is safe." With the default `Delete` reclaim policy it **destroys the backing storage**. Use `Retain` for anything precious.
- "emptyDir persists across pod restarts." It survives *container* restarts within the pod but dies when the **pod** is deleted or rescheduled.
- "hostPath is a fine way to get persistent storage." It ties the pod to one node, breaks on reschedule, and is a serious security hole (mount the host root and you own the node).
- "The StorageClass default doesn't matter." A PVC with no `storageClassName` uses the default; if there's no default (or two), provisioning silently fails or is ambiguous.

**What follows from this topic**

Storage is the backbone of stateful work. `volumeClaimTemplates` only make sense once you understand PVCs, and they're the reason **StatefulSets** exist (covered in Workloads) — stable network identity plus stable per-replica storage. ConfigMap and Secret mounts from the **Configuration** topic are just volume types riding the same machinery. The topology and `WaitForFirstConsumer` discussion connects directly to **Scheduling** — where a pod can run is constrained by where its volume lives. And reclaim policy plus snapshots are core to any **backup/DR** and operations story. If you can reason about the node boundary and the claim-check triangle, running databases on Kubernetes stops being scary.

### Q1. Why do containers need Volumes at all?

A container's writable filesystem is **ephemeral** — it's a scratch layer that's destroyed when the container is removed, and it's also isolated to that one container. Two problems follow:

1. **Durability** — a crash-and-restart, or any reschedule, wipes anything the app wrote. A database would lose all its data.
2. **Sharing** — two containers in the same pod can't see each other's filesystems by default.

A **Volume** solves both: it's storage mounted into one or more containers that lives at least as long as the pod (and, for persistent volumes, far longer). It's declared at pod level and mounted per container:

```yaml
spec:
  volumes:
    - name: data
      emptyDir: {}
  containers:
    - name: app
      volumeMounts:
        - name: data
          mountPath: /var/data
```

The key mental shift: containers are cattle, but their data often can't be.

### Q2. What is emptyDir and when do you use it?

`emptyDir` is a volume that's **created empty when the pod is assigned to a node and deleted when the pod is removed**. It survives container restarts *within* the pod but not pod deletion/reschedule.

Uses:
- **Scratch space** — sort buffers, temp files, checkpoint working dirs.
- **Cache** that's cheap to rebuild.
- **Sharing files between containers in the same pod** — e.g. an init or sidecar writes, the main container reads.

```yaml
volumes:
  - name: cache
    emptyDir:
      medium: Memory        # optional: tmpfs, counts against pod memory
      sizeLimit: 1Gi
```

`medium: Memory` makes it a RAM-backed tmpfs (fast, but consumes memory and counts toward limits). Don't use emptyDir for anything you need to survive a reschedule — that needs a PVC.

### Q3. What is hostPath and why is it dangerous?

`hostPath` mounts a file or directory **from the node's own filesystem** into the pod.

```yaml
volumes:
  - name: host
    hostPath:
      path: /var/log
      type: Directory
```

Dangers:
- **Node coupling** — the pod is now tied to whatever node has that path with the right contents. Reschedule to another node and the data's gone or different. It defeats the point of a scheduler.
- **Security** — mount `/` or `/var/run/docker.sock` or the kubelet's directory and a compromised pod effectively **owns the node** (and often the cluster). hostPath is a classic privilege-escalation vector, so Pod Security Standards restrict it.
- **No isolation** — pods can stomp on host files or each other.

Legitimate uses are narrow: node-level agents (log shippers, CNI, CSI drivers) running as DaemonSets that genuinely need node access. For application data, use a PVC. Prefer `local` PersistentVolumes over raw hostPath when you need node-local disk with scheduler awareness.

### Q4. Explain the PV / PVC abstraction and how binding works.

It separates **supply from demand**:

- **PersistentVolume (PV)** — a cluster-scoped resource describing an actual piece of storage (capacity, access modes, reclaim policy, the CSI source). The "supply."
- **PersistentVolumeClaim (PVC)** — a namespaced request: "I want 10 GiB, RWO, class fast." The "demand."

Kubernetes **binds** a PVC to a PV that satisfies it, one-to-one and exclusively. The pod then references the PVC, never the PV:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: data }
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: fast
  resources:
    requests:
      storage: 10Gi
---
# pod
volumes:
  - name: data
    persistentVolumeClaim:
      claimName: data
```

This decoupling means developers reason about *claims* (portable across clusters/clouds) while admins/provisioners handle *how* storage is realised. With static provisioning an admin pre-creates PVs; with dynamic provisioning a StorageClass creates the PV on demand.

### Q5. What is a StorageClass and how does dynamic provisioning work?

A StorageClass is a **template for provisioning storage on demand**. It names a **provisioner** (CSI driver) and **parameters** (disk type, IOPS, filesystem):

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

Dynamic provisioning flow:
1. A PVC is created referencing `storageClassName: fast` (or none, so the default is used).
2. The external provisioner for that class sees the pending PVC.
3. It calls the cloud API to create a real disk, creates a matching PV, and binds the PVC to it — no admin intervention.

The `is-default-class` annotation makes a class the fallback for PVCs that omit `storageClassName`. Exactly one default is healthy; zero means unclassed PVCs stay Pending, two is ambiguous.

### Q6. Explain the access modes and which storage supports ReadWriteMany.

| Mode | Short | Meaning |
|---|---|---|
| ReadWriteOnce | RWO | Mounted read-write by a single **node** (multiple pods OK if same node) |
| ReadOnlyMany | ROX | Read-only by many nodes |
| ReadWriteMany | RWX | Read-write by many nodes simultaneously |
| ReadWriteOncePod | RWOP | Read-write by exactly **one pod** in the whole cluster |

The critical point: **RWO is a node constraint, not a pod constraint** — that trips people up constantly. `ReadWriteOncePod` (stable since 1.29) is what you use when you truly need single-pod exclusivity (e.g. a database that must never be double-mounted).

**RWX support depends on the backing tech.** Block devices (AWS EBS, GCP PD, Azure Disk) are RWO — a block volume attaches to one node. RWX needs a **shared filesystem**: NFS, AWS EFS, GCP Filestore, Azure Files, CephFS, GlusterFS. So "I need three pods writing the same volume across nodes" forces a networked filesystem class, usually with a performance cost.

### Q7. What are reclaim policies and what's the classic production mistake?

The reclaim policy decides what happens to the **backing storage** when its PVC is deleted:

- **Delete** (default for dynamically provisioned) — the PV *and the real disk* are destroyed. Data gone.
- **Retain** — the PV moves to `Released` and the underlying disk is kept for manual recovery; you reclaim data by hand.
- (`Recycle` is deprecated/removed.)

The classic incident: someone deletes a PVC (or `kubectl delete -f` a whole namespace) for a database backed by a `Delete`-policy class, and **the production volume is silently deleted** by the provisioner. Recovery depends on cloud snapshots you hopefully took.

Mitigations: use `Retain` for anything precious, protect PVCs (they have a finalizer / `kubernetes.io/pvc-protection` so a PVC in use won't delete until pods release it), take **VolumeSnapshots**, and gate namespace deletes. You can also patch a live PV's policy: `kubectl patch pv <name> -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'`.

### Q8. What is CSI and why were in-tree volume drivers removed?

**CSI (Container Storage Interface)** is a standard gRPC API that lets storage vendors write **out-of-tree** driver plugins that Kubernetes (and other orchestrators) call to provision, attach, mount, snapshot and expand volumes.

Originally, drivers for EBS, GCE PD, Azure Disk, etc. were compiled **in-tree** — inside the Kubernetes codebase itself. That was bad:
- Every storage bug fix required a **Kubernetes release** and cluster upgrade.
- Vendor code lived in core, bloating it and coupling release cycles.
- Third-party vendors couldn't ship on their own cadence.

CSI decoupled this: drivers run as pods (a controller Deployment + a node DaemonSet), version independently, and are installed like any add-on. Kubernetes then ran a **CSI migration** effort that transparently redirects the old in-tree volume types to their CSI equivalents, and the in-tree drivers have since been **removed**. Practically: today you install a CSI driver (e.g. the AWS EBS CSI driver) and point StorageClasses at its provisioner name.

### Q9. What are volumeClaimTemplates and why do StatefulSets use them?

A regular Deployment shares one PVC across all replicas (or none) — no good for stateful apps where each replica needs its **own** durable disk. A StatefulSet's `volumeClaimTemplates` mints a **separate PVC per pod**, with a stable name tied to the pod ordinal:

```yaml
apiVersion: apps/v1
kind: StatefulSet
spec:
  serviceName: db
  replicas: 3
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast
        resources: { requests: { storage: 20Gi } }
```

This creates `data-db-0`, `data-db-1`, `data-db-2`. Each pod always reattaches to its own PVC across reschedules, so `db-0`'s data follows `db-0`. Crucially, these PVCs are **not** deleted when the StatefulSet scales down or is deleted (by default) — deliberately, to protect data. That's why you often clean them up manually after tearing down a stateful workload. This per-replica stable storage, plus stable network identity, is the whole reason StatefulSets exist.

### Q10. How does volume expansion work?

To grow a volume:
1. The StorageClass must have `allowVolumeExpansion: true`.
2. Edit the PVC and increase `spec.resources.requests.storage`.
3. The CSI driver resizes the backing disk; if the filesystem needs growing, it's expanded (online for many drivers, or on next pod restart for filesystem resize).

```bash
kubectl patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}'
```

Constraints: you can only **grow**, never shrink. Some drivers need the pod to restart to complete the filesystem resize (watch the PVC conditions — `FileSystemResizePending`). Expansion is one of the everyday advantages of CSI over the old static-PV world.

### Q11. Explain volume binding modes and how they interact with topology.

`volumeBindingMode` on a StorageClass controls **when** provisioning/binding happens:

- **Immediate** — the PV is provisioned as soon as the PVC is created, before any pod is scheduled. In a **multi-zone** cluster this is a trap: the disk might be created in zone A, then the pod gets scheduled to zone B — and a zonal disk can't attach across zones, so the pod is stuck **Pending / FailedAttachVolume**.
- **WaitForFirstConsumer** — binding/provisioning is **deferred until a pod that uses the PVC is scheduled**. Now the scheduler picks the node first, and the volume is provisioned in that node's zone. Topology matches by construction.

```yaml
volumeBindingMode: WaitForFirstConsumer
```

`WaitForFirstConsumer` is the right default for zonal block storage and is what most cloud CSI StorageClasses ship with. It's the single most common fix for "my StatefulSet pod is Pending because its PVC won't bind in a multi-AZ cluster."

### Q12. What are VolumeSnapshots and what do you use them for?

A **VolumeSnapshot** is a point-in-time copy of a PVC, taken through a CSI snapshot-capable driver. Three objects: `VolumeSnapshotClass` (like a StorageClass, names the driver), `VolumeSnapshot` (the request), and `VolumeSnapshotContent` (the actual snapshot resource).

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata: { name: db-backup-1 }
spec:
  volumeSnapshotClassName: csi-snap
  source:
    persistentVolumeClaimName: data-db-0
```

Uses:
- **Backup / DR** — snapshot before a risky migration; restore by creating a new PVC with `dataSource` pointing at the snapshot.
- **Cloning** — spin up a staging copy of prod data.

```yaml
# restore
spec:
  dataSource:
    name: db-backup-1
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
```

Snapshots are crash-consistent, not application-consistent — for databases, quiesce/flush first (or use the DB's own backup) for a clean restore.

### Q13. Can multiple pods mount the same volume, and what's the catch?

It depends entirely on the **access mode** and where the pods land:

- **RWO block storage** — several pods can share it **only if they're on the same node**. The volume attaches to one node; pods on other nodes get `Multi-Attach error` and stay stuck. In practice, spreading replicas across nodes (which you want for HA) makes RWO sharing impossible.
- **RWX shared filesystem** (NFS/EFS/Filestore/Azure Files/CephFS) — genuinely mountable read-write by many pods across many nodes. This is the only way to fan out writes.
- **ROX** — many pods read-only.
- **RWOP** — deliberately exactly one pod, everywhere.

So the honest answer to "mount this disk in three pods across three nodes" is: not with a normal cloud block volume — you need a networked filesystem, and you should expect lower IOPS and higher latency than a block device.

### Q14. A pod is stuck Pending with an unbound PVC. How do you debug it?

Walk the chain:

1. **Describe the PVC** — `kubectl describe pvc data`. Look at events: `waiting for first consumer` (normal for WaitForFirstConsumer — the pod just hasn't scheduled yet), `no persistent volumes available` (static provisioning, nothing fits), or a provisioner error.
2. **Check the StorageClass** — does the named class exist? Is there a **default** if the PVC omitted one? `kubectl get storageclass`.
3. **Provisioner health** — is the CSI controller running? `kubectl -n kube-system get pods | grep csi`. Its logs show cloud API errors (quota, permissions/IRSA, invalid params).
4. **Capacity / quota** — cloud disk quota exhausted, or a ResourceQuota on the namespace.
5. **Topology** — with Immediate binding, the PV may be in the wrong zone for where the pod can schedule. Switch the class to `WaitForFirstConsumer`.
6. **Access mode mismatch** — asking RWX from a class that only does RWO.

`kubectl get events --sort-by=.lastTimestamp` ties it together. Most real cases are: no default StorageClass, CSI driver misconfigured (IAM), or zone/topology mismatch.

### Q15. What is a projected/ephemeral inline volume and generic ephemeral volume?

Beyond PVCs, there are lighter-weight persistent-ish options:

- **CSI inline ephemeral volumes** — a CSI volume defined **inline in the pod spec**, created and destroyed with the pod (used by things like the Secrets Store CSI driver). No PVC.
- **Generic ephemeral volumes** — a full PVC's worth of features (dynamic provisioning, storage class, expansion, snapshots) but **tied to the pod lifecycle**: the volume is created when the pod starts and deleted when it stops.

```yaml
volumes:
  - name: scratch
    ephemeral:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          storageClassName: fast
          resources: { requests: { storage: 5Gi } }
```

Use generic ephemeral volumes when you want a **large, provisioned scratch disk** (bigger/faster than emptyDir's node disk) that you don't need to survive the pod — e.g. big build caches, ML dataset staging. It's the middle ground between emptyDir and a durable PVC.

### Q16. What are the tradeoffs of running stateful workloads on Kubernetes?

Kubernetes was built stateless-first; running databases and queues on it is doable but has real costs.

**In favour:** unified platform (one control plane for stateless and stateful), StatefulSets + PVCs + volumeClaimTemplates give stable identity and per-replica storage, CSI snapshots for backup, and operators (Postgres, Kafka, etc.) encode operational knowledge as controllers.

**Against / watch out:**
- **The node boundary** — RWO means a pod and its disk are pinned to a zone; a zone outage or node loss needs failover logic the app/operator must provide.
- **Reschedule cost** — moving a stateful pod means detaching and reattaching a volume, which is slow and can hit multi-attach fencing.
- **Reclaim/data-loss footguns** — `Delete` policies and namespace deletes can nuke data.
- **Performance** — RWX networked storage is slower; noisy-neighbour IOPS contention is real.
- **Complexity** — you're now operating both the datastore *and* Kubernetes.

Rule of thumb: use a managed database (RDS/Cloud SQL) unless you have a strong reason (data locality, cost, portability, an excellent operator) to run it in-cluster — and if you do, use a mature operator, not hand-rolled StatefulSets.

## Scheduling

### Summary

**What this topic covers**

How Kubernetes decides **which node** each pod runs on, and every lever you have to influence, constrain or override that decision. The 16 questions in this topic cover: (1) the **scheduler's two-phase algorithm** — filter (predicates: which nodes *can* run this pod) then score (priorities: which node is *best*) then bind; (2) the **attraction** controls — `nodeSelector`, node affinity (required vs preferred), pod affinity/anti-affinity for co-locating or spreading relative to other pods; (3) the **repulsion** controls — taints and tolerations, and how they differ from affinity; (4) **spreading** — topology spread constraints for even distribution across zones/nodes; and (5) the **resource and priority** layer — how requests determine fit, priority classes and preemption, plus the operational reality of debugging a `Pending` pod. The senior throughline: scheduling is where your reliability intentions (spread across zones, keep noisy neighbours apart, protect critical workloads) become concrete placement — and where a single mis-set `requiredDuringScheduling` rule silently wedges a whole rollout.

**Mental model**

The scheduler is a **constraint solver that runs once per pod**. It watches for pods with no assigned node, and for each one runs a pipeline: **filter** the node list down to feasible nodes (enough CPU/mem, tolerates the taints, satisfies required affinity, has the right topology for the volume), then **score** the survivors (spread, least/most allocated, affinity preferences, image locality) and pick the winner, then **bind** by writing `nodeName` to the pod. After that the *kubelet* on that node takes over — the scheduler doesn't move running pods. Two framings matter. First, **attraction vs repulsion are opposite defaults**: affinity/`nodeSelector` are pod-side rules that *pull* a pod toward matching nodes; taints are node-side rules that *push away* pods that don't explicitly tolerate them. Second, **required vs preferred is hard vs soft**: `requiredDuringScheduling` is a filter (violate it and the pod won't schedule at all — it goes Pending), while `preferredDuringScheduling` is a score nudge (best-effort, never blocks). Most scheduling incidents are a "required" rule that can't be satisfied.

**Key terms**

- **Predicates / filtering** — the phase that eliminates nodes a pod *cannot* run on (resources, taints, affinity, volume topology).
- **Priorities / scoring** — ranks feasible nodes to choose the best fit.
- **nodeSelector** — the simplest placement rule: pod runs only on nodes whose labels match exactly.
- **Node affinity** — richer node selection with operators (`In`, `NotIn`, `Exists`) and required/preferred strengths.
- **Pod affinity / anti-affinity** — schedule a pod near / away from *other pods* matching a label selector, relative to a `topologyKey`.
- **topologyKey** — the node label defining the domain of "together" (`kubernetes.io/hostname` = same node, `topology.kubernetes.io/zone` = same zone).
- **Taint** — a mark on a **node** that repels pods; format `key=value:effect`.
- **Toleration** — a mark on a **pod** that lets it ignore a matching taint.
- **Effect** — `NoSchedule` (don't place), `PreferNoSchedule` (avoid if possible), `NoExecute` (also evict already-running pods).
- **Topology spread constraint** — spreads pods evenly across a topology domain within a `maxSkew`.
- **PriorityClass** — a named integer priority; higher-priority pods can **preempt** (evict) lower-priority ones to schedule.
- **Preemption** — the scheduler evicting lower-priority pods to make room for a pending higher-priority pod.
- **cordon / drain** — mark a node unschedulable / evict its pods (for maintenance), interacting with taints and PodDisruptionBudgets.

**Why interviewers ask this**

Scheduling separates people who deploy pods from people who design for failure. A junior can set a `nodeSelector`; a senior reaches for the right tool per intent: **topology spread constraints** to survive a zone outage, **pod anti-affinity** to keep replicas off the same node, **taints** to reserve GPU or control-plane nodes, **priority classes** so a critical service can preempt batch jobs under pressure. For SRE roles the highest-value question is "a pod is Pending — walk me through it," because it exercises the whole model in reverse: insufficient resources, an untolerated taint, an unsatisfiable required affinity, or a volume-topology mismatch. Interviewers also probe the **cost** dimension — that pod anti-affinity is O(pods²)-ish to evaluate and gets expensive at scale (topology spread is the cheaper modern answer), and that aggressive `requiredDuringScheduling` rules trade flexibility for the risk of unschedulable pods. It's a strong proxy for whether you think about placement as a reliability lever, not an afterthought.

**Common confusions**

- "Affinity and taints are the same idea." Opposite defaults: affinity *attracts* a pod to nodes (pod-side, opt-in pull); a taint *repels* pods from a node (node-side, requires explicit toleration to override).
- "A toleration forces a pod onto a tainted node." It only **allows** it — toleration removes the repulsion; you still need affinity/nodeSelector to *attract* the pod there.
- "Preferred affinity guarantees placement." No — `preferredDuringScheduling` is a soft score; if nothing matches, the pod still schedules elsewhere. Only `required` blocks.
- "The scheduler rebalances running pods." It doesn't — placement is a one-time decision. Rebalancing needs the separate **descheduler**.
- "requests and limits both affect scheduling." Only **requests** do — the scheduler fits pods by requests; limits are enforced at runtime by the kubelet.
- "Anti-affinity is free." It's comparatively expensive to evaluate at scale; prefer topology spread constraints for even spreading.
- "NoExecute is just a stronger NoSchedule." NoExecute *also evicts pods already running* on the node that don't tolerate it.

**What follows from this topic**

Scheduling ties the whole primer together. Resource **requests** driving fit connects straight to **Resources/QoS** — over-request and pods go Pending, under-request and nodes get overcommitted and OOM. Volume **topology** (WaitForFirstConsumer) from **Storage** is a scheduling predicate: a pod can't land where its zonal disk can't attach. **DaemonSet** placement, **cordon/drain** for node maintenance, and **PodDisruptionBudgets** connect to Workloads and cluster operations. And priority/preemption is the mechanism behind graceful degradation under pressure that SRE interviews love. Master the filter→score→bind loop and the attraction/repulsion duality, and node placement stops being magic — it becomes a design surface you control.

### Q1. How does the Kubernetes scheduler decide where to place a pod?

The scheduler runs a per-pod pipeline in three stages:

1. **Filter (predicates)** — from all nodes, eliminate those that *can't* run the pod: not enough allocatable CPU/memory for the pod's **requests**, doesn't tolerate the node's taints, fails a `required` node/pod affinity, can't satisfy the volume's topology, wrong OS/arch, node not Ready.
2. **Score (priorities)** — rank the surviving feasible nodes with scoring plugins: resource balance (least/most allocated), affinity preferences, topology spread, image locality (node already has the image), inter-pod affinity. Scores are summed and weighted.
3. **Bind** — pick the highest-scoring node and write it to `pod.spec.nodeName`; the kubelet on that node then pulls images and starts containers.

It's implemented as the **scheduling framework** — a set of plugins at extension points (PreFilter, Filter, Score, Reserve, Permit, Bind). The scheduler only acts on pods with an empty `nodeName`; once bound it never moves them.

### Q2. What is a nodeSelector and what are its limits?

`nodeSelector` is the simplest placement rule: the pod runs **only on nodes whose labels match all the given key/values exactly**.

```yaml
spec:
  nodeSelector:
    disktype: ssd
    topology.kubernetes.io/zone: us-east-1a
```

Only nodes labelled `disktype=ssd` *and* in that zone are feasible. Label nodes with `kubectl label node <node> disktype=ssd`.

Limits: it's **AND-only, equality-only** — no "one of these values," no "not this," no soft preference, no "if possible." The moment you need `In [a,b]`, `NotIn`, `Exists`, or a best-effort preference, you graduate to **node affinity**, which is the strictly more expressive successor. `nodeSelector` is fine for simple, hard "must be on SSD nodes" cases.

### Q3. Explain node affinity, including required vs preferred.

Node affinity is expressive node selection based on node labels, with two strengths:

- **`requiredDuringSchedulingIgnoredDuringExecution`** — a hard filter. If no node matches, the pod stays **Pending**.
- **`preferredDuringSchedulingIgnoredDuringExecution`** — a soft, weighted preference used in scoring. If nothing matches, the pod still schedules elsewhere.

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values: ["us-east-1a", "us-east-1b"]
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        preference:
          matchExpressions:
            - key: disktype
              operator: In
              values: ["ssd"]
```

Operators: `In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`. "IgnoredDuringExecution" means if node labels change *after* the pod is running, it isn't evicted — the rule only gates scheduling. Use `required` for hard constraints (GPU zone), `preferred` for optimisation (prefer SSD).

### Q4. What are pod affinity and anti-affinity, and what is topologyKey?

These schedule a pod relative to **other pods**, not node labels:

- **Pod affinity** — place this pod *near* pods matching a selector (co-locate a cache with its app for latency).
- **Pod anti-affinity** — place this pod *away from* pods matching a selector (spread replicas so one node failure doesn't take them all).

The **`topologyKey`** defines what "near/away" means — it's a node label naming the domain:
- `kubernetes.io/hostname` → same/different **node**
- `topology.kubernetes.io/zone` → same/different **zone**

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels: { app: web }
        topologyKey: kubernetes.io/hostname
```

This says: don't schedule this `web` pod on a node that already runs a `web` pod — one replica per node. Change `topologyKey` to zone and it's one per zone. Required = hard (may go Pending if it can't be satisfied); preferred = soft.

### Q5. Explain taints and tolerations and their effects.

Taints and tolerations are the **repulsion** system. A **taint** on a node repels pods; a **toleration** on a pod lets it ignore a matching taint.

Taint a node: `kubectl taint nodes node1 gpu=true:NoSchedule`. Format is `key=value:effect`.

Three effects:
| Effect | Behaviour |
|---|---|
| `NoSchedule` | Don't schedule non-tolerating pods here |
| `PreferNoSchedule` | Avoid scheduling here if possible (soft) |
| `NoExecute` | Don't schedule **and evict** already-running non-tolerating pods |

Toleration on the pod:

```yaml
tolerations:
  - key: "gpu"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

Common uses: control-plane nodes carry `node-role.kubernetes.io/control-plane:NoSchedule` so normal workloads stay off them; GPU nodes are tainted so only GPU workloads (with the toleration) land there; the node controller adds `NoExecute` taints like `node.kubernetes.io/not-ready` to evict pods off failing nodes. `NoExecute` tolerations can carry `tolerationSeconds` to delay eviction.

### Q6. What's the difference between affinity and taints — when do you use which?

They solve opposite problems:

- **Affinity / nodeSelector = attraction (pod-side, opt-in pull).** The pod declares "I want to be on nodes like this." A node with no matching pods is perfectly happy to take other pods too. Use it to *draw* pods toward suitable nodes.
- **Taints = repulsion (node-side, opt-out push).** The node declares "keep pods off me unless they explicitly tolerate this." Default is exclusion. Use it to *reserve* nodes.

The key insight: **a toleration alone doesn't attract.** Tainting GPU nodes keeps random pods off them, but a GPU pod with the toleration could still be scheduled to a *non*-GPU node (nothing pulls it there). So the production pattern is **both**: taint the special nodes (repel everyone else) **and** add node affinity/nodeSelector on the special pods (attract them to those nodes). Taint = "who's allowed here"; affinity = "where do I want to be."

### Q7. What are topology spread constraints and how do they compare to anti-affinity?

Topology spread constraints control how **evenly** pods of a group are distributed across a topology domain (zones, nodes), bounded by a **`maxSkew`** — the max allowed difference in pod count between the most and least populated domains.

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule       # or ScheduleAnyway (soft)
    labelSelector:
      matchLabels: { app: web }
```

`maxSkew: 1` across zones means the zone counts never differ by more than 1 — even spread for zone-failure resilience. `whenUnsatisfiable: DoNotSchedule` is hard; `ScheduleAnyway` is a soft preference.

Versus **anti-affinity**: anti-affinity is binary and coarse — "not on the same node as another `web`" — and expensive to evaluate at scale (each scheduling decision checks the pod against many others, roughly quadratic). Topology spread is quantitative ("balanced within skew 1"), cheaper, and expresses "spread evenly" directly. For "distribute my replicas across zones/nodes," **prefer topology spread constraints**; reserve anti-affinity for strict "never co-locate" rules.

### Q8. How do resource requests drive scheduling?

The scheduler fits pods onto nodes by **requests**, not limits. When filtering, it checks whether a node's **allocatable** CPU and memory minus the sum of requests of already-placed pods leaves room for this pod's requests. If not, the node is filtered out.

```yaml
resources:
  requests:      # used by the scheduler for fit
    cpu: "500m"
    memory: "512Mi"
  limits:        # enforced at runtime by the kubelet, NOT scheduling
    cpu: "1"
    memory: "1Gi"
```

Consequences:
- **Requests too high** → pods can't fit → **Pending** even though nodes look idle (nodes reserve capacity for requests, not actual usage).
- **Requests too low / missing** → the scheduler thinks nodes are emptier than they are → overcommit → runtime contention and **OOMKills**.
- **Limits don't affect placement at all** — a pod with a huge limit but tiny request schedules based on the tiny request.

This is why accurate requests matter: they're the currency of scheduling. Scoring then balances load (spread pods, or bin-pack, depending on the configured strategy).

### Q9. Explain priority classes and preemption.

A **PriorityClass** assigns pods an integer priority. Higher-priority pending pods can **preempt** — evict — lower-priority running pods to free capacity.

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: high-priority }
value: 1000000
globalDefault: false
description: "Critical user-facing services"
---
# pod
spec:
  priorityClassName: high-priority
```

How preemption works: when a high-priority pod can't schedule anywhere, the scheduler looks for a node where **evicting some lower-priority pods** would let it fit, picks the lowest-disruption victims, and deletes them (honouring graceful termination and, where possible, PodDisruptionBudgets). The evicted pods reschedule elsewhere if they can.

Built-in system classes `system-cluster-critical` and `system-node-critical` protect control-plane and node-critical components. Use priority to guarantee that, under a capacity crunch, user-facing services win over batch/best-effort jobs. Beware runaway preemption — set priorities deliberately, not everything to "high."

### Q10. A pod is stuck Pending / Unschedulable. Walk me through the causes.

Start with `kubectl describe pod <p>` and read the **Events** — the scheduler explains itself there ("0/5 nodes are available: 3 Insufficient cpu, 2 node(s) had untolerated taint...").

Common causes:
1. **Insufficient resources** — no node has enough allocatable CPU/mem for the pod's **requests**. Fix requests, scale the cluster, or free capacity. (Cluster Autoscaler adds nodes here.)
2. **Untolerated taints** — every candidate node is tainted and the pod lacks the toleration (very common with control-plane/GPU nodes).
3. **Unsatisfiable required affinity / nodeSelector** — no node matches a hard node-affinity or a label in `nodeSelector` (typo'd label, no such zone).
4. **Pod anti-affinity / topology spread** can't be satisfied — e.g. "one per node" but replicas > nodes.
5. **Volume topology** — the PVC is (or must be) in a zone with no schedulable node; the classic Immediate-binding cross-zone trap.
6. **PVC unbound** — no StorageClass/default, or provisioner failing.

Read the event message; it almost always names the exact predicate that failed and how many nodes failed each way.

### Q11. How does scheduling work for DaemonSets?

A DaemonSet runs **one pod per (matching) node** — think log shippers, CNI agents, node exporters, CSI node plugins. Its scheduling is special:

- It targets **every** eligible node (optionally filtered by `nodeSelector`/node affinity in the pod template), rather than picking a single best node.
- Modern Kubernetes schedules DaemonSet pods through the **default scheduler** (using node affinity on `metadata.name` under the hood) rather than the old DaemonSet-controller-does-its-own-placement approach — so they respect resource fit and scoring.
- DaemonSet pods usually carry **broad tolerations** (often `operator: Exists` for many effects) so they land on tainted nodes too — you generally *do* want your log agent on control-plane and GPU nodes.

```yaml
tolerations:
  - operator: Exists          # tolerate everything, run everywhere
```

When you add a new node, the DaemonSet controller notices and a pod appears on it; drain/remove the node and its DaemonSet pod goes away. It's the mechanism for "must run on all nodes."

### Q12. What is nodeName and when would you use it?

`nodeName` in the pod spec **bypasses the scheduler entirely** — you name the node directly and the kubelet on that node just runs it:

```yaml
spec:
  nodeName: node-3
```

No filtering, no scoring — if `node-3` lacks resources or the pod violates taints, the pod may fail to run (stuck, or evicted) rather than being placed elsewhere, because nothing rescheduled it.

Use cases are narrow: debugging, static pods (kubelet-managed pods defined by files on the node, used for control-plane components), or bespoke tooling that does its own scheduling. For normal workloads, **never** hardcode `nodeName` — you lose rescheduling, spreading, and resilience. Prefer `nodeSelector`/affinity to *express* placement intent while letting the scheduler still do its job.

### Q13. How do cordon and drain interact with scheduling?

For node maintenance:

- **`kubectl cordon <node>`** marks it **unschedulable** (sets `spec.unschedulable`, effectively an internal `NoSchedule`-style guard). Existing pods keep running; **no new pods** get scheduled there.
- **`kubectl drain <node>`** cordons *and* **evicts** the pods so the node can be taken down (`--ignore-daemonsets`, `--delete-emptydir-data` as needed). Eviction goes through the **eviction API**, which respects **PodDisruptionBudgets** — if evicting would violate a PDB (e.g. drop below minAvailable), drain blocks until it's safe.
- **`kubectl uncordon <node>`** makes it schedulable again.

So the flow ties together: cordon changes scheduling eligibility, drain triggers eviction + rescheduling of those pods onto other nodes (subject to the same filter/score they'd get normally), and PDBs gate how fast that can happen. This is the safe rolling-node-maintenance / upgrade primitive. Cluster autoscaler scale-down uses the same eviction+PDB machinery to remove underused nodes.

### Q14. What is the descheduler and why is it needed?

The scheduler makes a **one-time** placement decision and never revisits it. Over time the cluster drifts: nodes get added (but old pods don't move to balance onto them), pods that were spread get bunched after reschedules, affinity/taint rules that were violated-but-tolerated persist, and nodes become lopsided.

The **descheduler** is a separate, optional component (run as a Deployment or CronJob) that periodically **evicts pods that are "misplaced"** so the scheduler can place them better on the next cycle. It has strategies like:
- `RemoveDuplicates` — spread replicas of the same owner off the same node.
- `LowNodeUtilization` — evict from over-used nodes to let pods land on under-used ones.
- `RemovePodsViolatingInterPodAntiAffinity` / `...NodeAffinity` / `...NodeTaints` — evict pods now violating current rules.
- `RemovePodsViolatingTopologySpreadConstraint` — restore even spread.

It only **evicts** (respecting PDBs and priorities); the normal scheduler does the re-placement. Use it when long-running clusters drift out of balance — it's the missing "rebalance" the scheduler deliberately doesn't do.

### Q15. What are the ways to express "spread my replicas across zones," and which is best?

Three tools, increasing in precision:

1. **Pod anti-affinity** with `topologyKey: topology.kubernetes.io/zone` — "not in a zone that already has one of my pods." Binary, hard to tune for "roughly even," and expensive at scale.
2. **Topology spread constraints** — `maxSkew` across the zone key. Directly expresses "balanced within N," cheap, and the modern default. This is usually the best answer.
3. **Multiple node pools / cluster topology** plus the above — ensure nodes actually exist in each zone (spread can't put a pod in a zone with no capacity).

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway     # soft: don't wedge on capacity gaps
    labelSelector: { matchLabels: { app: web } }
```

Best practice: **topology spread constraints with `maxSkew: 1`**, usually `ScheduleAnyway` (soft) so a temporarily missing zone doesn't wedge the rollout, combined with a Deployment of enough replicas. Many platforms also set cluster-wide default spread constraints so every workload gets zone spreading for free.

### Q16. Explain how scheduling, PodDisruptionBudgets, and rollouts interact for safe operations.

These three combine to keep availability during change:

- **Scheduling** decides initial placement and re-placement after eviction.
- **PodDisruptionBudget (PDB)** — `minAvailable`/`maxUnavailable` for a set of pods — caps how many can be **voluntarily** disrupted at once (drains, autoscaler scale-down). The eviction API refuses to drop below it.
- **Rollouts** (Deployment `maxUnavailable`/`maxSurge`) govern how many pods change during an update.

Put together: during a **node drain** for an upgrade, the eviction API honours the PDB, so pods are evicted only as fast as availability allows, and the scheduler re-places each evicted pod on a healthy node (respecting affinity/spread). During a **Deployment rollout**, the controller replaces pods within `maxUnavailable`, the scheduler places the new ones (spread constraints keep them balanced), and readiness probes gate progress. During **autoscaler scale-down**, PDBs again gate eviction.

The interview-worthy point: PDBs constrain *voluntary* disruptions only — a node *crash* (involuntary) ignores them. So real resilience needs both good **spreading** (survive an involuntary zone/node loss) and **PDBs** (bound voluntary disruption). Placement gets them apart; PDBs keep enough of them up while you operate.
## Resource Management

### Summary

**What this topic covers**

How Kubernetes rations CPU, memory, and other resources across pods sharing a node — and why getting this wrong is the single most common cause of production incidents (OOMKills, throttling, cascading evictions, unschedulable pods). Three concern areas live here: (1) the **per-container contract** — `requests` (what the scheduler reserves and guarantees) versus `limits` (the hard ceiling the runtime enforces), and the crucial asymmetry between how memory limits and CPU limits behave when a container tries to exceed them; (2) **QoS and eviction** — how the requests/limits combination sorts every pod into Guaranteed, Burstable, or BestEffort, and how that class decides who dies first when a node runs out of memory or disk; and (3) **cluster-level governance** — LimitRange and ResourceQuota to enforce sane defaults and caps per namespace, node allocatable vs capacity, overcommit, and right-sizing with real metrics (VPA recommendations). The 16 questions here span the warm-up ("what's the difference between a request and a limit") to the senior debug ("this pod keeps getting OOMKilled but node memory looks fine — why").

**Mental model**

Think of a node as a fixed pool of CPU and memory, minus a slice reserved for the OS and the kubelet (that's the difference between **capacity** and **allocatable**). Every pod you schedule stakes a claim on that allocatable pool equal to its **requests** — the scheduler does bin-packing arithmetic against requests, never against actual usage or limits. So requests are a *scheduling and reservation* concept: guaranteed, reserved, and the thing that makes a pod schedulable or leaves it Pending. **Limits** are a different machine: they're enforced at runtime by the Linux kernel (cgroups) and only bite when a container tries to *use* more than allowed. The asymmetry is the thing to burn into memory: memory is incompressible, so exceeding a memory limit gets your process **OOMKilled** (exit 137); CPU is compressible, so exceeding a CPU limit just gets you **throttled** — slowed down, never killed. Overcommit is the norm: sum of limits can far exceed node capacity because most containers don't use their limit at once. That's efficient until it isn't — which is when eviction and QoS classes decide who pays.

**Key terms**

- **request** — amount of a resource the scheduler reserves for a container; guaranteed available, drives scheduling and QoS.
- **limit** — hard ceiling the runtime enforces via cgroups; memory over → OOMKilled, CPU over → throttled.
- **millicore (m)** — CPU unit; `1000m` = 1 vCPU/core. `500m` = half a core of CPU time.
- **Mi vs M** — `Mi` = mebibyte (1024²), `M` = megabyte (1000²); use `Mi`/`Gi` to avoid off-by-5% surprises.
- **QoS class** — Guaranteed, Burstable, or BestEffort; derived from requests/limits, drives eviction order.
- **OOMKilled** — container killed by the kernel OOM killer for exceeding its memory limit; shows exit code 137.
- **CPU throttling** — cgroup CFS quota slows a container that hits its CPU limit; visible in `container_cpu_cfs_throttled` metrics.
- **allocatable vs capacity** — capacity is the node's raw resources; allocatable subtracts `kube-reserved` + `system-reserved` + eviction thresholds.
- **LimitRange** — namespace object setting default requests/limits and min/max per container/pod.
- **ResourceQuota** — namespace object capping *aggregate* usage (total CPU/memory/object counts) across the namespace.
- **eviction** — kubelet kills pods when the node is under memory/disk pressure, in QoS order.
- **overcommit** — scheduling more limits than the node can physically satisfy, relying on containers not all peaking at once.
- **ephemeral-storage** — the node's local scratch/log/emptyDir space; also requestable and limitable, and a common eviction trigger.
- **extended resources** — non-standard countable resources (e.g. `nvidia.com/gpu`) advertised by device plugins and requested like CPU/memory.

**Why interviewers ask this**

Resource management is where "I've read the docs" separates from "I've been paged at 3am." A junior can recite that requests are minimums and limits are maximums. A senior knows the operational consequences: that setting a memory limit without a request creates a Burstable-but-fragile pod, that CPU limits can *tank latency* on a healthy service via throttling (so many SREs deliberately omit CPU limits), that a namespace with a ResourceQuota will *reject* any pod that doesn't set requests, and that node allocatable — not capacity — is what the scheduler actually sees. Interviewers probe this because misconfigured resources cause the majority of "it works in staging, falls over in prod" incidents. They want to hear you reason about the whole node, the QoS ladder, and the difference between a scheduling problem (Pending) and a runtime problem (OOMKilled/throttled).

**Common confusions**

- "Limits reserve capacity" — they don't; only **requests** reserve. Limits just cap. A node can be scheduled to 100% of requests while limits sum to 400%.
- "Hitting the CPU limit kills the pod" — no, CPU is compressible; you get **throttled**, not killed. Only memory (and ephemeral-storage) limits kill.
- "M and Mi are the same" — `1Gi` = 1073741824 bytes, `1G` = 1000000000; the gap grows with size and causes surprise OOMs.
- "BestEffort pods are safe because they ask for nothing" — the opposite; requesting nothing makes them **first to be evicted** under node pressure.
- "If a pod is Pending it's a runtime bug" — Pending is almost always a *scheduling* problem: insufficient allocatable requests, taints, or affinity — not the container failing.
- "Setting a limit equal to request is wasteful" — for latency-critical or memory-sensitive workloads, `requests == limits` (Guaranteed QoS) is often exactly what you want.

**What follows from this topic**

Resource management is the substrate under **Autoscaling** — HPA divides current usage by requests, so bad requests break autoscaling arithmetic; Cluster Autoscaler adds nodes precisely when pending pods can't fit their requests. It connects to **Scheduling** (the scheduler is a requests-based bin-packer respecting taints/affinity) and to **Namespaces** (ResourceQuota and LimitRange are namespace-scoped governance). If you can reason cleanly about requests vs limits and the QoS ladder, autoscaling and scheduling become straightforward; if you can't, they look like magic.

### Q1. What is the difference between a resource request and a resource limit?

A **request** is what the scheduler reserves for a container — the amount that must be available on a node for the pod to be placed there, and the amount guaranteed to the container. A **limit** is the hard ceiling the container runtime enforces at runtime; the container can never use more.

The key mental split: **requests are a scheduling concern, limits are a runtime concern.** The scheduler does bin-packing against the sum of requests on each node and never looks at limits or actual usage when placing a pod. The kernel (via cgroups) enforces limits while the container runs and never looks at requests.

```yaml
resources:
  requests:
    cpu: "250m"      # scheduler reserves 1/4 core; guaranteed
    memory: "256Mi"  # scheduler reserves 256Mi; guaranteed
  limits:
    cpu: "1000m"     # may burst to 1 core, then throttled
    memory: "512Mi"  # exceed this -> OOMKilled
```

So a pod requesting `250m` CPU is *scheduled* as if it needs a quarter core but is *allowed* to burst to a full core when the node has spare CPU.

### Q2. What happens when a container exceeds its memory limit versus its CPU limit?

This asymmetry is the most important single fact in resource management:

| | Memory over limit | CPU over limit |
|---|---|---|
| Behaviour | Process **OOMKilled** by the kernel | Container **throttled** (slowed) |
| Killed? | Yes | No |
| Exit code | 137 (128 + SIGKILL 9) | n/a — keeps running |
| Why | Memory is *incompressible* — you can't give back what you've allocated | CPU is *compressible* — the scheduler just hands out fewer time slices |

Memory can't be reclaimed from a running process without killing it, so the kernel OOM killer terminates the container; the kubelet restarts it (and you see `OOMKilled` in `kubectl describe pod`). CPU is a rate, not a quantity — the CFS scheduler simply throttles the cgroup, capping how many CPU-microseconds it gets per period. The container runs slower but never dies.

Practical consequence: a too-low **memory** limit causes crash loops; a too-low **CPU** limit causes latency spikes and mysterious slowness that never shows up as a crash. Many teams set memory `requests==limits` but deliberately omit CPU limits to avoid throttling latency-sensitive services.

### Q3. Explain the three QoS classes and how Kubernetes assigns them.

Kubernetes derives a **Quality of Service class** from a pod's requests and limits — you don't set it directly:

- **Guaranteed** — *every* container has `requests == limits` for *both* CPU and memory (and both are set). Highest priority; last to be evicted.
- **Burstable** — at least one container has a request or limit set, but it doesn't meet the Guaranteed bar. The common real-world case.
- **BestEffort** — *no* container sets any request or limit. Lowest priority; first to be evicted.

```yaml
# Guaranteed: requests == limits, both resources
resources:
  requests: { cpu: "500m", memory: "512Mi" }
  limits:   { cpu: "500m", memory: "512Mi" }
```

Check it with `kubectl get pod <name> -o jsonpath='{.status.qosClass}'`.

The class matters because under **node memory pressure** the kubelet evicts in order: BestEffort first, then Burstable (those most over their requests), Guaranteed last. So counterintuitively, asking for *nothing* (BestEffort) makes a pod the most fragile, not the safest.

### Q4. How do CPU units work in Kubernetes?

CPU is measured in **cores**, expressed as **millicores** (`m`): `1000m` = `1` = one full vCPU / core / hyperthread. `500m` = half a core, `100m` = a tenth.

It maps onto two Linux cgroup mechanisms:

- **CPU requests → CPU shares.** A request of `250m` sets relative weight so that under contention this container gets a proportional slice of CPU time. Shares only matter when the CPU is saturated; with spare CPU everyone runs freely.
- **CPU limits → CFS quota.** A limit of `500m` means "at most 50ms of CPU per 100ms period." Hit that quota and the container is throttled until the next period, even if the whole node is otherwise idle.

That's why CPU limits can hurt: a bursty request handler that would finish in 20ms of solid CPU gets sliced across multiple periods and its tail latency balloons. Requests (shares) give you fair scheduling under contention without that penalty, which is why the common SRE pattern is "set CPU requests, be cautious with CPU limits."

### Q5. What is the difference between Mi and M (and Gi and G)?

They're different bases:

- `Mi` / `Gi` — **binary** (mebibyte / gibibyte): `1Mi` = 1024² = 1,048,576 bytes; `1Gi` = 1024³.
- `M` / `G` — **decimal** (megabyte / gigabyte): `1M` = 1000² = 1,000,000 bytes; `1G` = 1000³.

`1Gi` (1,073,741,824) is about 7% larger than `1G` (1,000,000,000), and the gap widens with size. Memory tooling, `free`, and the JVM all think in binary, so mixing units causes off-by-a-bit surprises — you set a limit of `1000M` thinking "1 gig," the process expects `1Gi`, and it OOMKills earlier than you expected.

**Rule: always use `Mi`/`Gi` for memory.** Reserve `m` for CPU (millicores — unrelated to the memory suffix). CPU has no binary/decimal ambiguity.

### Q6. Why is setting only limits, or no limits at all, risky?

**Limits without requests:** If you set a limit but no request, Kubernetes defaults the request *up to equal the limit* for that resource — which may be more than you intended, wasting schedulable capacity, or (if a LimitRange sets a low default request) leaves you Burstable and evictable while looking capped. You lose control of the scheduling half of the contract.

**No limits at all (especially memory):** A container with no memory limit can grow until it consumes the whole node, triggering node-wide memory pressure and evicting *other* pods — the "noisy neighbour" turned node killer. A memory leak in one BestEffort pod can take down healthy neighbours.

**No CPU limit:** Usually *acceptable and often preferred* — the pod can burst into spare CPU, and CPU is compressible so it can't starve the node the way memory can (requests still give fair-share under contention). The dangerous omission is **memory**; the tolerable-to-good omission is **CPU**.

Sane baseline: always set memory `requests` and `limits` (often equal); always set CPU `requests`; be deliberate about whether you want a CPU limit.

### Q7. What is a LimitRange and what problem does it solve?

A **LimitRange** is a namespace-scoped policy that (a) injects **default** requests/limits into containers that don't specify them, and (b) enforces **min/max** bounds per container or pod. It fixes the "developers forget to set resources" problem and stops one pod from claiming an absurd request.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: prod
spec:
  limits:
  - type: Container
    default:            # applied as limit if unset
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:     # applied as request if unset
      cpu: "100m"
      memory: "128Mi"
    max:
      cpu: "2"
      memory: "2Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
```

Now any pod created in `prod` without resources gets the defaults, and any pod asking for more than `max` or less than `min` is **rejected at admission**. This is the mechanism that makes a ResourceQuota requiring requests actually workable — LimitRange supplies the defaults so unannotated pods don't get rejected outright.

### Q8. What is a ResourceQuota and how does it differ from a LimitRange?

A **ResourceQuota** caps the *aggregate* resource consumption of an entire namespace — total CPU/memory requested and limited across all pods, plus counts of objects (pods, Services, PVCs, etc.).

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: prod
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    pods: "100"
```

The distinction:

| | LimitRange | ResourceQuota |
|---|---|---|
| Scope | Per container/pod | Whole namespace (aggregate) |
| Purpose | Defaults + per-object min/max | Total cap for the namespace |
| Enforces | Individual sizes | Sum across all objects |

A subtle gotcha: **once a ResourceQuota sets `requests.cpu`/`limits.cpu`, every new pod in that namespace *must* declare the corresponding request/limit or it's rejected.** That's why you pair a ResourceQuota (the cap) with a LimitRange (the defaults) — the LimitRange fills in what developers omit so the quota doesn't block ordinary deployments.

### Q9. Explain node allocatable versus node capacity.

**Capacity** is the node's total physical resources (e.g. 8 CPU, 32Gi memory). **Allocatable** is what's actually available to pods after the node reserves resources for itself:

```
allocatable = capacity
            − kube-reserved       (kubelet, container runtime)
            − system-reserved     (OS, sshd, systemd)
            − eviction-threshold   (headroom kept free to avoid OOM)
```

So an 8-CPU / 32Gi node might report ~7.6 CPU / ~29Gi allocatable. **The scheduler bin-packs against allocatable, not capacity.** Interviewers love this because it explains a class of "the node has free memory but pods won't schedule" puzzles — the pod's requests exceed remaining *allocatable*, even though `htop` shows idle RAM. Check with `kubectl describe node <n>` (look at Capacity, Allocatable, and "Allocated resources").

### Q10. What is overcommit and why does Kubernetes allow it?

**Overcommit** is scheduling a node such that the sum of pod *limits* exceeds the node's allocatable resources — you can even overcommit requests only up to allocatable, but limits routinely sum to several times capacity.

It's allowed (and desirable) because containers rarely use their full limit simultaneously. Requesting `256Mi` but limiting to `1Gi` lets a pod burst when it needs to while the scheduler only reserves the `256Mi` request — so you pack far more pods onto a node than a limits-based reservation would permit. Bin-packing efficiency comes directly from overcommit.

The cost is risk: if enough containers burst toward their limits at once, the node runs out of real memory and the kubelet starts **evicting** pods (memory) — CPU just throttles everyone. The whole QoS/eviction machinery exists precisely to make overcommit safe by choosing *who* gives way when the bet goes wrong. Guaranteed pods (requests==limits) don't overcommit and are protected; BestEffort pods are the sacrificial layer.

### Q11. Walk me through what happens under node memory and disk pressure (eviction).

The kubelet continuously watches node conditions. When a resource crosses an **eviction threshold** it sets a condition (`MemoryPressure` or `DiskPressure`) and begins reclaiming:

**Memory pressure:**
1. Kubelet tries to reclaim node-level memory (e.g. reclaimable cache).
2. If still over threshold, it ranks pods and **evicts** them — BestEffort first, then Burstable pods most over their memory *request*, Guaranteed last.
3. Evicted pods are killed and (if managed by a controller) rescheduled elsewhere; the node gets the `MemoryPressure` taint, so the scheduler stops placing new pods there.

**Disk pressure** (node `ephemeral-storage` / image filesystem full):
1. Kubelet garbage-collects dead containers and unused images.
2. If still over, it evicts pods — those exceeding their `ephemeral-storage` request, in QoS order.

Two distinctions to state clearly: eviction is **graceful-ish** (pod deleted, controller reschedules) versus **OOMKill** (a single container hard-killed by the kernel for its *own* limit breach). And eviction is a *node-level* decision about the whole node's pressure; OOMKill is a *container-level* enforcement of one limit.

### Q12. What is the "noisy neighbour" problem and how do resources address it?

The **noisy neighbour** is a pod that consumes disproportionate shared node resources — CPU, memory, disk I/O, network — and degrades the other pods packed onto the same node.

Requests and limits are the primary defence:

- **CPU requests** (shares) guarantee each pod a fair slice under contention, so a busy neighbour can't starve you of scheduled CPU time. A **CPU limit** additionally caps a runaway process (at the cost of possible self-throttling).
- **Memory limits** stop a leaking neighbour from consuming all node RAM and triggering evictions of innocent pods.
- **ephemeral-storage limits** stop a pod that writes unbounded logs/temp files from filling the node disk and causing `DiskPressure` for everyone.

What requests/limits *don't* fully solve: disk and network I/O bandwidth aren't cgroup-limited by default in vanilla Kubernetes, so a neighbour hammering the disk or NIC can still hurt you. For hard isolation you reach for dedicated node pools, taints/tolerations + anti-affinity to separate workloads, or Guaranteed QoS to sit at the top of the eviction order. Resources make noisy neighbours *tolerable*; scheduling separates them when tolerable isn't enough.

### Q13. How do you right-size resource requests and limits in practice?

Guessing is the anti-pattern. Right-sizing is data-driven:

1. **Measure actual usage.** `kubectl top pod`/`kubectl top node` (needs metrics-server) for a quick look; Prometheus + `container_memory_working_set_bytes` and `container_cpu_usage_seconds_total` for real percentiles over time.
2. **Set memory request ≈ steady-state working set, memory limit ≈ observed peak + headroom.** Memory is incompressible, so under-provisioning means OOMKills — err slightly generous, and often set `requests == limits` for predictability (Guaranteed QoS).
3. **Set CPU request ≈ typical usage (e.g. p90), and be cautious with CPU limits** — throttling hurts latency, so many teams set requests only, or a generous limit.
4. **Use the VPA in recommendation mode.** The Vertical Pod Autoscaler observes usage and emits suggested requests/limits without acting on them — a great source of ground-truth numbers even if you don't let it mutate pods.

The failure modes to avoid: requests too high wastes money and blocks scheduling (Pending, or Cluster Autoscaler adding needless nodes); requests too low causes throttling, OOMKills, and eviction. Iterate against real percentiles, not vibes.

### Q14. Debug this: a pod is Pending and events say "Insufficient cpu." What's happening and how do you fix it?

`Pending` + `Insufficient cpu` (or memory) is a **scheduling** failure, not a runtime one: no node has enough *allocatable* CPU left to satisfy the pod's CPU **request**. Remember the scheduler sums requests, not usage — nodes can look idle in `top` and still be "full" of requests.

Diagnose:

```bash
kubectl describe pod <pod>            # read the Events for the scheduler message
kubectl describe node <node>          # see "Allocated resources" vs Allocatable
kubectl top nodes                     # actual usage (often far below requests)
```

Then choose a fix:

- **The request is too high** — lower it to match real usage (check `kubectl top`/VPA). Most common and cheapest fix.
- **The cluster is genuinely full** — add a node (or enable/trigger the Cluster Autoscaler, which reacts to exactly this Pending condition).
- **Fragmentation** — total free CPU exists but is split across nodes so no single node fits; consider smaller pods or descheduling to defragment.
- **Also check** taints without matching tolerations, node affinity, and topology-spread constraints — those produce different messages ("node(s) had untolerated taint") but also cause Pending.

### Q15. How do ephemeral-storage requests and limits work, and why do they matter?

**ephemeral-storage** is the node's local scratch space that a pod consumes without a persistent volume: container writable layers, `emptyDir` volumes, and container logs. It's requestable and limitable just like CPU/memory:

```yaml
resources:
  requests:
    ephemeral-storage: "1Gi"
  limits:
    ephemeral-storage: "2Gi"
```

Behaviour: exceed the ephemeral-storage **limit** and the kubelet **evicts** the pod (not an OOMKill — it's a kubelet eviction). Aggregate ephemeral usage crossing the node's eviction threshold triggers **DiskPressure** and node-wide evictions in QoS order.

Why it matters: unbounded application logs, a runaway `emptyDir`, or a build job writing large temp files can fill the node disk and take down *other* pods via DiskPressure — a disk-flavoured noisy-neighbour incident. Because it's the node's disk (not a PV), it's easy to forget. Set ephemeral-storage limits on anything that writes a lot locally, and prefer real PersistentVolumes for data you actually want to keep.

### Q16. How does Kubernetes handle extended resources like GPUs?

CPU and memory are the built-in "compressible/incompressible" resources, but Kubernetes also supports **extended resources** — arbitrary countable resources advertised by nodes and requested by pods. GPUs are the canonical example.

A **device plugin** (e.g. the NVIDIA device plugin, run as a DaemonSet) discovers the hardware and advertises it to the kubelet, which reports it in the node's capacity/allocatable under a vendor-prefixed name:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1    # request 1 GPU
```

Key differences from CPU/memory:

- Extended resources are **integer-only and non-overcommittable** — you can't ask for `0.5` of a GPU (barring vendor time-slicing/MIG features), and `requests` must equal `limits`. A GPU is dedicated, not time-shared by default.
- They're **opaque to the scheduler beyond counting** — the scheduler just matches "node advertises N, pod wants M." Actual isolation is the device plugin's job.

This is how clusters schedule ML/inference workloads onto GPU nodes, and it's usually paired with taints on GPU nodes (so only GPU pods land there) plus tolerations on the pods that need them.

## Autoscaling

### Summary

**What this topic covers**

How a Kubernetes cluster grows and shrinks itself along two independent axes — **more pods** and **more nodes** — plus the machinery that decides *when*. Three concern areas: (1) **pod-level scaling** — the Horizontal Pod Autoscaler (HPA) changing replica count from metrics, and the Vertical Pod Autoscaler (VPA) right-sizing each pod's requests/limits; (2) **node-level scaling** — the Cluster Autoscaler and Karpenter adding/removing nodes when pods can't be placed or nodes sit underused; and (3) **the metrics and event sources** that drive it all — metrics-server for CPU/memory, custom/external metrics adapters (Prometheus Adapter), and KEDA for event-driven, scale-to-zero workloads. The through-line is that **autoscaling is only as good as your resource requests** — HPA's math divides usage by requests, and the Cluster Autoscaler reacts to pods that can't fit their requests. The 15 questions here run from "what does the HPA scale" to "walk me through how HPA and Cluster Autoscaler interact when traffic spikes."

**Mental model**

Picture two nested feedback loops. The **inner loop** is the HPA: every ~15s it reads a metric (say, average CPU across the pods), compares it to your target, and computes a new replica count with a simple ratio. It edits the Deployment's `replicas`; the Deployment controller creates pods. The **outer loop** is the Cluster Autoscaler / Karpenter: if those new pods can't be scheduled (Pending, insufficient allocatable), it provisions nodes; when nodes sit underused, it drains and removes them. The two loops don't talk directly — they're coupled only through the scheduler and the Pending state. HPA scales pods until they don't fit; the node autoscaler notices they don't fit and adds capacity; the new node lets the pending pods schedule. Separately, the VPA works a *different* axis — it changes each pod's *size* (requests/limits) rather than the *count*, which is why running VPA and HPA on the same metric fights itself. Everything downstream depends on requests being sane, because both loops reason in terms of requests.

**Key terms**

- **HPA (HorizontalPodAutoscaler)** — controller that scales a workload's *replica count* based on observed metrics vs a target.
- **VPA (VerticalPodAutoscaler)** — controller that recommends/sets each pod's *requests and limits*; recreates pods to apply.
- **Cluster Autoscaler (CA)** — adds nodes when pods are Pending for lack of capacity; removes underutilised nodes.
- **Karpenter** — just-in-time node provisioner that picks right-sized instance types and bin-packs; faster and more flexible than CA.
- **metrics-server** — cluster add-on serving the resource metrics API (CPU/memory); required for HPA on CPU/memory and for `kubectl top`.
- **custom metrics** — pod-associated metrics beyond CPU/memory (e.g. requests-per-second), served via a custom metrics API adapter.
- **external metrics** — metrics from outside the cluster (queue depth, cloud LB latency) used by HPA.
- **Prometheus Adapter** — exposes Prometheus queries as custom/external metrics for the HPA.
- **KEDA** — event-driven autoscaler; scales on event sources (Kafka lag, queue length) and enables **scale-to-zero**.
- **stabilization window** — HPA delay that damps flapping, especially on scale-down.
- **behavior policies** — HPA v2 rules capping how fast it may scale up/down (pods or percent per period).
- **PodDisruptionBudget (PDB)** — minimum available pods that constrains voluntary disruptions like CA scale-down.

**Why interviewers ask this**

Autoscaling is where cost, reliability, and correctness collide, so it's a rich senior signal. A junior says "HPA scales pods on CPU." A senior knows the *algorithm* (`ceil(replicas × current/target)`), that HPA needs requests set or it can't compute a percentage, that scaling up should be fast but scaling down slow (stabilization window) to avoid thrash, that HPA and VPA on the same signal conflict, and that HPA scaling pods is useless if there's no node capacity — which is where the Cluster Autoscaler or Karpenter comes in. They probe this to see whether you can reason about *systems that change their own shape under load*: the failure modes (flapping, thrash, pods stuck Pending because CA is blocked by a PDB or local storage), the cost implications, and how the pieces compose. It's also a great "explain the interaction" question — how two independent controllers cooperate through shared state.

**Common confusions**

- "HPA and Cluster Autoscaler do the same thing" — no: HPA scales **pods**, CA/Karpenter scale **nodes**. They're different loops that cooperate via Pending pods.
- "You can run HPA and VPA together freely" — not on the same resource metric; they fight (VPA changes requests, which moves HPA's target). Use VPA on memory, HPA on CPU, or KEDA — but don't overlap.
- "HPA works without requests" — HPA's percentage target is `usage / request`; with no request there's nothing to divide by, so CPU/memory HPA can't function.
- "Scale-down should be as fast as scale-up" — no; slow scale-down (stabilization window) prevents flapping when traffic is bursty.
- "Cluster Autoscaler removes any idle node" — it *won't* remove a node running pods with local storage, restrictive PDBs, or non-evictable/system pods; those block scale-down.
- "Autoscaling saves money automatically" — only with good requests and scale-down policies; oversized requests make CA add needless nodes and never remove them.

**What follows from this topic**

Autoscaling sits directly on **Resource Management** — requests are its currency, and QoS/eviction interact with CA scale-down. It leans on **Workloads/Controllers** (HPA drives a Deployment/StatefulSet's replica count via the same reconciliation loop) and on **Scheduling** (CA exists to satisfy the scheduler's Pending pods; PDBs and taints shape what it can do). Understand requests and the reconciliation model and autoscaling is just two feedback loops layered on top; miss those and it's a pile of controllers with confusing interactions.

### Q1. What are the three main autoscalers in Kubernetes and what does each scale?

Three distinct controllers on two axes:

| Autoscaler | Scales | Trigger |
|---|---|---|
| **HPA** (Horizontal Pod Autoscaler) | **Replica count** of a workload | Metric (CPU/memory/custom/external) vs target |
| **VPA** (Vertical Pod Autoscaler) | **Requests/limits** of each pod | Observed usage over time |
| **Cluster Autoscaler / Karpenter** | **Number of nodes** | Pending pods (up) / underutilised nodes (down) |

The mental split: HPA scales **out** (more copies), VPA scales **up** (bigger copies), and the Cluster Autoscaler scales the **infrastructure** underneath both. HPA and CA are the common production pair — HPA adds pods until they don't fit, CA adds nodes so they do. VPA is the odd one out because it changes pod *size* and must recreate pods to apply, so it doesn't compose cleanly with HPA on the same metric.

### Q2. Explain the HPA algorithm. How does it decide the replica count?

The HPA runs a control loop (default every 15s) and applies one formula:

```
desiredReplicas = ceil( currentReplicas × (currentMetricValue / desiredMetricValue) )
```

Example: 4 replicas, target CPU 50%, current average CPU 100% → `ceil(4 × 100/50)` = **8 replicas**. If current drops to 25% → `ceil(4 × 25/50)` = **2 replicas**.

Details that matter in an interview:

- The metric is typically an **average across all the pods**. For CPU/memory it's usage as a percentage of the **request** — which is exactly why requests must be set.
- There's a **tolerance** (default 10%): if the ratio is within ~0.9–1.1 of target, HPA does nothing, to avoid churning on noise.
- The result is clamped to the configured **min/max replicas**.
- Missing/not-ready pod metrics are handled conservatively (they're treated to avoid over-aggressive scaling).

So it's proportional control: how far current usage is from target directly scales the replica count.

### Q3. What does the HPA need in order to work, and what's a common reason it does nothing?

Requirements:

- **metrics-server** installed (for CPU/memory) — the HPA reads the resource metrics API. No metrics-server → HPA shows `<unknown>` for the metric and can't scale.
- **Resource requests set** on the target's containers — for CPU/memory targets, HPA computes usage as a percentage of the request. No request → no denominator → HPA can't compute utilisation.
- A scalable target with a `replicas` field (Deployment, ReplicaSet, StatefulSet).

The classic "HPA does nothing" cause is **missing requests**: you point an HPA at a Deployment whose pods have no CPU request, and `kubectl describe hpa` shows the target metric as `<unknown>/50%`. Fix by adding `resources.requests.cpu`. The second classic cause is **no metrics-server**. Both surface in `kubectl describe hpa` events, which is the first thing to check.

### Q4. What are stabilization windows and behavior policies, and why do they exist?

They exist to stop the HPA **flapping** — rapidly scaling up and down as a noisy metric crosses the target. In autoscaling/v2 the `behavior` block tunes each direction independently:

```yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300   # use the highest recommendation over last 5 min
    policies:
    - type: Percent
      value: 50                       # remove at most 50% of pods
      periodSeconds: 60               #   per minute
  scaleUp:
    stabilizationWindowSeconds: 0     # react immediately
    policies:
    - type: Pods
      value: 4
      periodSeconds: 60               # add at most 4 pods per minute
```

The **stabilization window** makes HPA consider the most conservative recommendation over a trailing window before acting — long on scale-down (default 300s) so a brief dip doesn't drop pods you'll immediately need again; typically zero on scale-up so you respond to spikes fast. **Policies** cap the *rate* of change (N pods or N% per period). The design principle: **scale up eagerly, scale down reluctantly** — the cost of being briefly over-provisioned is far lower than the cost of dropping capacity right before a traffic surge.

### Q5. What is the VPA and how does it differ from the HPA?

The **Vertical Pod Autoscaler** right-sizes a pod's **requests and limits** based on observed usage — it makes each pod *bigger or smaller*, whereas the HPA makes *more or fewer* pods.

It has three components: a **Recommender** (watches usage, computes suggested requests), an **Updater** (evicts pods whose requests are off), and an **Admission Controller** (rewrites requests on pod creation). Crucially, because you can't change a running container's requests in place (historically), the VPA **evicts and recreates** the pod to apply new values — a disruption HPA never causes.

Modes: `Off` (recommend only — hugely useful for right-sizing data without acting), `Initial` (set at creation only), `Auto`/`Recreate` (actively evict and resize).

Use VPA for workloads that are hard to scale horizontally (a single stateful process, a batch job) or to discover correct requests. Use HPA for stateless services that scale by replica count. The `Off` recommendation mode is the most broadly safe way to use it.

### Q6. Why do HPA and VPA conflict, and how do you avoid it?

They conflict when pointed at the **same resource metric** because they form a feedback loop that fights itself:

- HPA scales replicas to keep *CPU-usage-as-a-percentage-of-request* near target.
- VPA changes the *request* to match usage.
- When VPA lowers the request, the same absolute usage now reads as a *higher* percentage → HPA scales up. When VPA raises the request, usage reads *lower* → HPA scales down. They chase each other.

Avoidance strategies:

- **Split the metrics.** Run HPA on CPU and VPA on memory (or vice-versa) so they don't share a signal.
- **HPA on custom metrics** (e.g. requests-per-second via KEDA/Prometheus Adapter) while VPA handles CPU/memory requests — now HPA's signal is independent of the requests VPA changes.
- **VPA in `Off` (recommendation) mode** alongside HPA — you get sizing suggestions without VPA acting, so no conflict.

The one thing not to do is run HPA and VPA both actively on CPU for the same workload.

### Q7. What does the Cluster Autoscaler do and what triggers scale-up versus scale-down?

The **Cluster Autoscaler** changes the number of **nodes** by growing/shrinking cloud node groups (ASGs / MIGs / node pools).

**Scale-up trigger:** one or more pods are **Pending** because no existing node has enough allocatable resources to fit their requests. CA simulates which node group, if enlarged, would let those pods schedule, and increases that group's desired size. New node joins → scheduler places the pending pods.

**Scale-down trigger:** a node is **underutilised** (its pods' requests sum below a threshold, default ~50%) for a sustained period *and* every pod on it can be safely rescheduled elsewhere. CA cordons and drains the node, then removes it.

It reasons entirely in terms of **requests**, not actual usage — a node "full" of over-requested but idle pods won't be scaled down, and a pod Pending for a too-large request triggers scale-up even if the cluster has spare real capacity. That coupling to requests is the recurring theme.

### Q8. Why might the Cluster Autoscaler refuse to remove an underutilised node?

Scale-down is blocked whenever a pod on the node **can't be safely evicted and rescheduled**. Common blockers:

- **Pods with local storage** (`emptyDir` or hostPath holding data) — evicting loses the data, so by default CA won't remove the node unless the pod carries the "safe to evict" annotation.
- **Restrictive PodDisruptionBudgets** — if draining the node would violate a PDB's `minAvailable`, CA can't evict and the node stays.
- **Pods without a controller** (bare pods) — nothing would recreate them, so CA won't evict.
- **kube-system / system pods** not backed by a PDB, or pods with restrictive affinity/anti-affinity that can't be placed elsewhere.
- Pods explicitly annotated `cluster-autoscaler.kubernetes.io/safe-to-evict: "false"`.

This is a very common "why is my cluster not saving money?" answer: one DaemonSet-adjacent pod, a stateful pod with local storage, or an over-tight PDB pins an otherwise-empty node. Diagnose with the CA's status configmap/logs, which name the exact blocking pod.

### Q9. What is Karpenter and how does it differ from the Cluster Autoscaler?

**Karpenter** is a node-provisioning autoscaler (originally AWS, now broader) that replaces the Cluster Autoscaler's node-group model with **just-in-time, right-sized provisioning**.

Key differences:

| | Cluster Autoscaler | Karpenter |
|---|---|---|
| Node selection | Scales predefined node **groups** (fixed instance types) | Picks the **best instance type** per pending workload on the fly |
| Speed | Slower (goes through ASG/MIG) | Faster (provisions instances directly) |
| Bin-packing | Limited to group shapes | Actively bin-packs pods onto optimally-sized nodes |
| Consolidation | Node-group-bounded | Continuously **consolidates** — replaces many small/underused nodes with fewer right-sized ones |

Because Karpenter looks at the actual resource shape of pending pods and provisions a node sized to fit (including spot/diverse instance types), it typically achieves better utilisation and lower cost, and reacts faster, than the Cluster Autoscaler's "enlarge this fixed group" approach. Both solve the same problem — pending pods need nodes — but Karpenter does it with per-workload instance selection and ongoing consolidation.

### Q10. How do you scale on custom or external metrics? What's KEDA for?

CPU/memory often aren't the right signal — you want to scale on **requests-per-second**, **queue depth**, or **consumer lag**. Two categories:

- **Custom metrics** — associated with pods/objects in the cluster (e.g. HTTP RPS), served through the custom metrics API, commonly by the **Prometheus Adapter**, which maps a PromQL query to a metric the HPA can target.
- **External metrics** — from outside the cluster (cloud queue length, load-balancer latency), served through the external metrics API.

```yaml
metrics:
- type: External
  external:
    metric: { name: queue_messages }
    target: { type: AverageValue, averageValue: "30" }
```

**KEDA** (Kubernetes Event-Driven Autoscaling) is the popular layer on top: it ships dozens of **scalers** (Kafka, RabbitMQ, SQS, Prometheus, cron…) and creates/manages an HPA for you from a simple `ScaledObject`. Its headline feature is **scale-to-zero** — plain HPA can't go below 1 replica, but KEDA can scale a consumer to **zero** when there are no events and spin it back up when messages arrive. That's ideal for bursty, event-driven, or cost-sensitive workloads.

### Q11. Walk me through how the HPA and Cluster Autoscaler cooperate during a traffic spike.

They're two independent loops coupled by the **Pending** state:

1. Traffic rises → average CPU across the Deployment's pods climbs above the HPA target.
2. **HPA** computes `ceil(replicas × current/target)` and bumps the Deployment's `replicas`.
3. The Deployment controller creates the new pods; the scheduler tries to place them.
4. If existing nodes have allocatable room, they schedule immediately — done, no node change.
5. If not, the new pods sit **Pending** (`Insufficient cpu/memory`).
6. **Cluster Autoscaler** (or Karpenter) sees the Pending pods, provisions a node whose addition would let them fit, and the node joins.
7. The scheduler places the pending pods on the new node; capacity now matches demand.

On the way down the loops reverse: HPA scales replicas back (slowly, via the scale-down stabilization window), nodes become underutilised, and CA drains and removes them. The important interview point: **HPA never knows or cares about nodes, and CA never knows or cares about metrics** — they compose purely through the scheduler and pod Pending status. Get the ordering and the coupling right and you've demonstrated systems thinking.

### Q12. Why does good autoscaling depend so heavily on correct resource requests?

Requests are the shared currency of every autoscaler:

- **HPA** on CPU/memory measures usage as a **percentage of the request**. Wrong request → wrong percentage → wrong replica count. Requests too low make pods look 300% utilised and HPA over-scales; too high make them look idle and it under-scales.
- **Cluster Autoscaler** decides scale-up from pods Pending against **requests**, and scale-down from node utilisation measured in **requests**. Over-requested pods make CA add nodes it doesn't need and keep nodes it could remove — you pay for phantom capacity.
- **The scheduler** bin-packs on requests, so requests determine whether autoscaled pods even fit.

So a single mis-set request cascades: bad HPA math, needless nodes, blocked scale-down, wasted spend. This is why right-sizing (Resource Management topic — VPA recommendations, real percentiles) is a *prerequisite* for autoscaling, not an afterthought. "We turned on the HPA and costs went up" is almost always a requests problem.

### Q13. How do you avoid autoscaler thrashing (rapid scale up/down flapping)?

Thrashing wastes resources and, worse, churns pods/nodes right when you need stability. Defences at each layer:

- **HPA:** use the scale-down **stabilization window** (default 300s) so brief metric dips don't drop pods; add **behavior policies** to cap how many pods/percent can be removed per period; keep the target-utilisation **tolerance** so it ignores small fluctuations. Choose a metric that isn't itself noisy (average over pods, smoothed).
- **Cluster Autoscaler:** it has its own scale-down delay after scale-up and after a node becomes empty, plus a utilisation threshold — tune these so nodes aren't yanked immediately.
- **General:** set sensible **min replicas** so you never drop below a floor; scale up fast, down slow; and if a metric is inherently spiky, aggregate it (p90 over a window) rather than reacting to instantaneous values.

The unifying principle again: asymmetry. Reacting fast upward and slowly downward damps oscillation because you tolerate brief over-provisioning to avoid the far costlier flap.

### Q14. How do you autoscale stateful workloads, and why is it harder?

Stateful workloads (StatefulSets — databases, queues, anything with per-pod identity and storage) resist naive autoscaling for several reasons:

- **Horizontal scaling isn't transparent.** Adding a replica to a database means joining a cluster, rebalancing shards/partitions, and replicating data — not something the HPA's "bump `replicas`" can safely do on its own. Scale-down is worse: removing a member may need graceful hand-off of data.
- **Per-pod persistent volumes** complicate node scale-down — pods with attached storage or local data block the Cluster Autoscaler (see the scale-down blockers), and rescheduling must respect volume topology/zone.
- **Ordering and identity** — StatefulSets create/delete pods in order with stable network IDs; abrupt scaling can violate quorum.

Practical approaches: prefer **VPA (vertical)** for stateful pods — make the single pod bigger rather than adding members. When you must scale horizontally, use an **operator** that understands the application (e.g. a database operator that rebalances on scale). Use HPA/KEDA cautiously and only where the app tolerates it (e.g. stateless consumers reading from a partitioned queue, scaled to partition count). Guard everything with PDBs so autoscaling can't break quorum.

### Q15. What are the cost implications of autoscaling, and how do you keep it economical?

Autoscaling is a cost *lever*, not automatically a cost *saver* — pointed wrong it increases spend.

Where cost leaks:

- **Oversized requests** → CA provisions nodes for capacity you never use and can't scale them back down; the biggest single waste.
- **No/weak scale-down** → nodes and pods linger after load drops (missing stabilization tuning, PDBs or local-storage pods pinning nodes empty).
- **min replicas too high** → you pay for a floor larger than baseline demand.

Where cost is saved:

- **Right-sized requests** (VPA recommendations) so both loops provision what's actually needed.
- **Karpenter consolidation / spot instances** — right-sized, diverse, interruptible nodes bin-packed tightly.
- **KEDA scale-to-zero** for bursty/event-driven workloads — pay nothing while idle.
- **Aggressive but safe scale-down** — short-enough CA delays, no needless PDB blocks, `safe-to-evict` annotations where appropriate.

The framing to give an interviewer: autoscaling converts a *fixed* capacity cost into a *demand-shaped* one, but only if requests are honest and scale-down actually works. Otherwise you get the elasticity of scaling up without the savings of scaling down.

## Namespaces, Labels, Selectors & Annotations

### Summary

**What this topic covers**

The organising and grouping primitives that turn a flat pile of Kubernetes objects into a navigable, multi-tenant, selectable system. Three concern areas: (1) **namespaces** — virtual clusters that scope names, RBAC, quotas, and limits, and the sharp distinction between namespaced and cluster-scoped resources; (2) **labels and selectors** — the key/value metadata that is the *backbone of how Kubernetes wires objects together* (a Service finds its pods, a Deployment owns its pods, all via label selection); and (3) **annotations** — non-identifying metadata for tooling and humans. The recurring theme is *identifying vs non-identifying* metadata: labels are for selection and grouping (small, indexed, queryable), annotations are for attaching arbitrary information (large, free-form, never selected on). The 15 questions here run from "what is a namespace" to "a Deployment's selector doesn't match its pod template — what happens" and "why is my namespace stuck Terminating?"

**Mental model**

Two orthogonal ideas. **Namespaces** slice the cluster into named compartments — think folders that scope object *names* (two `Deployments` named `api` can coexist in `dev` and `prod`) and act as the unit for RBAC, ResourceQuota, and LimitRange. But they're a *soft* boundary: pods in different namespaces can still reach each other over the flat pod network unless a NetworkPolicy says otherwise. **Labels** are a completely different mechanism — they don't scope, they *select*. A label is a key/value tag stuck on an object; a **selector** is a query over those tags. Kubernetes' core wiring is nothing but selectors matching labels: a Service's selector finds the pods to route to, a Deployment's selector claims the pods it owns, a ReplicaSet counts pods matching its selector. Nothing is hard-linked by name — everything is a loose, label-driven query, which is what makes the system so flexible (and what makes a mismatched selector silently break things). **Annotations** are the third thing: metadata you attach but never select on — ingress configs, checksums, "managed by" hints, tool state.

**Key terms**

- **namespace** — a virtual cluster scoping object names, RBAC, quotas, and limits for a subset of resources.
- **namespaced resource** — object that lives in a namespace (Pod, Service, Deployment, ConfigMap, Secret, PVC, Role).
- **cluster-scoped resource** — object with no namespace (Node, PersistentVolume, StorageClass, ClusterRole, Namespace itself, CRD definitions).
- **label** — identifying key/value metadata used for grouping and selection; small and indexed.
- **selector** — a query over labels; equality-based (`app=api`) or set-based (`env in (prod,staging)`).
- **annotation** — non-identifying key/value metadata for tooling/humans; can be large, never selected on.
- **default namespaces** — `default`, `kube-system`, `kube-public`, `kube-node-lease`.
- **service FQDN** — `<service>.<namespace>.svc.cluster.local`; how you reach a Service in another namespace.
- **recommended labels** — the `app.kubernetes.io/*` convention (`name`, `instance`, `component`, `part-of`, `managed-by`).
- **selector immutability** — a Deployment's `spec.selector` cannot be changed after creation.
- **finalizer** — a key that blocks deletion until a controller removes it; the usual cause of stuck-Terminating namespaces.
- **NetworkPolicy** — the object that turns a namespace's soft isolation into real network isolation.

**Why interviewers ask this**

This topic reveals whether you understand *how Kubernetes actually connects things*. A junior treats labels as documentation and namespaces as security boundaries — both misconceptions. A senior knows selectors are the load-bearing mechanism (break the selector, break the Service), that namespaces are an organisational/RBAC boundary but **not** a network one (you need NetworkPolicies for that), which resources are cluster-scoped (so you don't waste time looking for a Node "in" a namespace), and the operational traps: an immutable Deployment selector, a Service routing to nothing because its selector has a typo, a namespace wedged in Terminating because of a finalizer. It's also where multi-tenancy design lives — how you'd carve a cluster for several teams with quotas, RBAC, and network isolation. Strong answers show you can both *build* with these primitives and *debug* when a label typo silently drops traffic.

**Common confusions**

- "Namespaces provide network isolation" — they don't by default; pods across namespaces reach each other freely until a **NetworkPolicy** restricts it.
- "Everything lives in a namespace" — Nodes, PersistentVolumes, StorageClasses, ClusterRoles, and Namespaces themselves are **cluster-scoped**.
- "Labels and annotations are interchangeable" — labels are *selectable and indexed* (keep them small); annotations are *not selectable* and hold arbitrary/large data.
- "You can edit a Deployment's selector" — `spec.selector` is **immutable**; changing it requires recreating the Deployment.
- "A Service reaches pods in any namespace by name" — a selector-based Service only selects pods **in its own namespace**; cross-namespace access is via the FQDN.
- "A stuck-Terminating namespace is a bug in Kubernetes" — almost always a **finalizer** on a resource inside it that no controller is clearing.

**What follows from this topic**

Labels and selectors underpin **Services & Networking** (a Service is a selector over pods), **Workloads** (Deployment/ReplicaSet own pods by selector), **Scheduling** (nodeSelector, affinity, and topology spread all query node labels), and **Resource Management** (ResourceQuota/LimitRange are namespace-scoped). Namespaces are the canvas for **RBAC** (Roles are namespaced) and multi-tenancy, and the gap they leave — no network isolation — is filled by **Network Policies**. Master this and the rest of Kubernetes reads as "objects loosely joined by label queries within namespace compartments."

### Q1. What is a namespace and what problem does it solve?

A **namespace** is a virtual cluster inside a physical cluster — a named scope for a group of resources. It solves several problems at once:

- **Name scoping** — object names must be unique *within* a namespace, not across the whole cluster. So `dev` and `prod` can each have a Deployment called `api`.
- **Multi-tenancy / organisation** — carve one cluster among teams/environments without separate clusters.
- **Policy attachment point** — **RBAC Roles**, **ResourceQuota**, and **LimitRange** are namespaced, so a namespace becomes the unit you grant access to, cap resources on, and set defaults for.

```bash
kubectl create namespace prod
kubectl get pods -n prod
kubectl config set-context --current --namespace=prod   # default the context
```

The critical caveat to state up front: a namespace is an **organisational and policy** boundary, **not** a network or hard security boundary. Pods in different namespaces share one flat network and can reach each other unless a NetworkPolicy intervenes.

### Q2. Which resources are namespaced and which are cluster-scoped?

A fundamental split every candidate should have memorised:

| Namespaced (live in a namespace) | Cluster-scoped (no namespace) |
|---|---|
| Pod, Deployment, ReplicaSet, StatefulSet | **Node** |
| Service, Endpoints, Ingress | **PersistentVolume** |
| ConfigMap, Secret | **StorageClass** |
| PersistentVolumeClaim | **Namespace** itself |
| ServiceAccount, Role, RoleBinding | **ClusterRole, ClusterRoleBinding** |
| Job, CronJob | **CustomResourceDefinition** |
|  | IngressClass, PriorityClass, Node metrics |

The logic: things that are *infrastructure* or *cluster-wide* (nodes, the storage supply side, cluster-wide permissions, API extensions) are cluster-scoped; things that are *workload/tenant* concerns are namespaced. Note the storage asymmetry — a **PVC** is namespaced (a tenant's claim) but the **PV** and **StorageClass** it binds to are cluster-scoped (shared supply). Check any type with:

```bash
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
```

### Q3. What are the default namespaces in a fresh cluster?

Four ship out of the box:

- **`default`** — where your objects go if you don't specify a namespace. Fine for learning; in production you should create explicit namespaces rather than dumping everything here.
- **`kube-system`** — the control-plane and system components: CoreDNS, kube-proxy, the CNI DaemonSet, metrics-server, autoscaler pods. Treat as hands-off.
- **`kube-public`** — world-readable (even unauthenticated) namespace, used for cluster info like the public cluster CA bundle. Rarely used by apps.
- **`kube-node-lease`** — holds **Lease** objects, one per node, for node heartbeats. Lets the control plane detect node health cheaply and scalably (replaced the old "update the Node object" heartbeat).

The two you interact with are `default` (yours by default) and `kube-system` (know it's there, don't break it).

### Q4. How do pods in different namespaces communicate?

They're on the **same flat pod network**, so connectivity is there by default — namespaces don't wall off traffic. What changes across namespaces is **DNS naming**. Kubernetes DNS gives every Service a fully-qualified name:

```
<service>.<namespace>.svc.cluster.local
```

- **Same namespace:** short name works — `http://api/`.
- **Different namespace:** qualify it — `http://api.prod.svc.cluster.local/` (or the shorter `api.prod`).

So a pod in `dev` reaching a Service `api` in `prod` calls `api.prod.svc.cluster.local`. No special permission is needed — which is exactly why "namespaces aren't a security boundary." To *restrict* cross-namespace traffic you add a **NetworkPolicy** (e.g. deny ingress except from pods labelled in certain namespaces). Isolation is opt-in via policy, not implied by the namespace.

### Q5. What are labels and why are they described as the backbone of Kubernetes?

**Labels** are identifying key/value pairs attached to objects:

```yaml
metadata:
  labels:
    app: api
    tier: backend
    env: prod
```

They're the backbone because **Kubernetes wires objects together almost entirely through labels, not names or hard references**:

- A **Service** finds the pods it load-balances via its `selector` matching pod labels.
- A **Deployment/ReplicaSet** owns and counts the pods matching its selector.
- **Scheduling** (nodeSelector, affinity, topology spread) queries *node* labels.
- Operators, `kubectl get -l`, dashboards, and monitoring all group by labels.

Nothing is bolted together by name — everything is a loose *query* over labels, which is what gives Kubernetes its flexibility: you can swap the pods behind a Service just by matching labels, with no reconfiguration. The flip side (a recurring debug theme) is that a single mistyped label silently breaks the wiring — a Service whose selector matches nothing routes to nothing, with no error.

### Q6. Explain the difference between equality-based and set-based label selectors.

Two selector syntaxes:

**Equality-based** — match exact key/value (`=`, `==`, `!=`):

```bash
kubectl get pods -l app=api
kubectl get pods -l 'app=api,env=prod'      # comma = AND
kubectl get pods -l tier!=frontend
```

**Set-based** — match against a set of values (`in`, `notin`, existence):

```bash
kubectl get pods -l 'env in (prod,staging)'
kubectl get pods -l 'tier notin (cache)'
kubectl get pods -l 'app'                     # key exists
kubectl get pods -l '!canary'                 # key does NOT exist
```

In manifests, older objects (like a bare ReplicationController) supported only equality via a plain `selector:` map; modern controllers (Deployment, ReplicaSet, Job) use `selector.matchLabels` (equality) and `selector.matchExpressions` (set-based) together:

```yaml
selector:
  matchLabels:
    app: api
  matchExpressions:
  - { key: env, operator: In, values: [prod, staging] }
```

Set-based is strictly more expressive; multiple requirements are ANDed.

### Q7. What are annotations and how do they differ from labels?

**Annotations** are also key/value metadata, but they're **non-identifying** — you attach information to an object that you never *select* on:

```yaml
metadata:
  annotations:
    kubernetes.io/change-cause: "roll out v1.2.3"
    nginx.ingress.kubernetes.io/rewrite-target: /
    prometheus.io/scrape: "true"
```

The differences that matter:

| | Labels | Annotations |
|---|---|---|
| Purpose | Identify & **select/group** | Attach arbitrary info for tooling/humans |
| Selectable? | **Yes** (selectors query them) | **No** — never used in selectors |
| Size | Small (indexed; 63-char value limit) | Can be large (config blobs, JSON) |
| Typical use | `app`, `tier`, `env`, ownership | Ingress config, checksums, change-cause, tool state, "last-applied-configuration" |

Rule of thumb: **if a controller or `kubectl` needs to find or group the object by it, it's a label; if it's information *for* a tool or a human that nothing selects on, it's an annotation.** Ingress controllers, service meshes, and cert-manager are heavy annotation users because they read per-object config that would be nonsensical as selectable labels.

### Q8. When should you use a label versus an annotation?

Decide by one question: **will anything select, group, or route on this value?**

Use a **label** when:

- A Service/Deployment/selector must match it (`app`, `tier`, `role`).
- You want to `kubectl get -l` / filter dashboards / group metrics by it (`env`, `team`, `version`).
- Scheduling should key off it (node labels for affinity).
- Keep it short, low-cardinality, and semantically stable.

Use an **annotation** when:

- It's configuration for a controller/tool (ingress rewrite rules, `prometheus.io/scrape`, sidecar-injection flags).
- It's provenance/audit info for humans (`change-cause`, build SHA, git commit, contact/owner email).
- It's large or structured (a JSON blob, the `last-applied-configuration`).
- High cardinality or free-form values that would pollute label indexes.

A common mistake is stuffing a build timestamp or a long description into a **label**, bloating the selectable index and hitting the 63-char limit — that belongs in an annotation. Conversely, putting the thing a Service needs to route on into an annotation means the Service selects nothing.

### Q9. What are the recommended `app.kubernetes.io/*` labels?

Kubernetes publishes a set of **recommended common labels** so tools (dashboards, Helm, kubectl, service meshes) can understand *any* application uniformly:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: api          # the application name
    app.kubernetes.io/instance: api-prod # a unique instance of it
    app.kubernetes.io/version: "1.2.3"   # the app version
    app.kubernetes.io/component: backend # role within the app architecture
    app.kubernetes.io/part-of: shop      # the higher-level app it belongs to
    app.kubernetes.io/managed-by: helm   # what manages this object
```

They're a *convention*, not enforced — but adopting them means tooling can group and visualise your workloads consistently (e.g. "show everything `part-of: shop`"). The `app.kubernetes.io/` prefix marks them as the shared standard so they don't collide with your own labels. Helm charts set several of these automatically. Interviewers like this because it signals you've worked in real, tool-integrated clusters rather than hand-rolled `app: myapp` labels only.

### Q10. How must a Deployment's selector relate to its pod template labels, and what's the immutability trap?

A Deployment has **two** label-bearing spots that must agree:

```yaml
spec:
  selector:
    matchLabels:
      app: api            # (1) what pods this Deployment claims
  template:
    metadata:
      labels:
        app: api          # (2) labels stamped on the pods it creates
```

The rule: **`spec.selector.matchLabels` must match `spec.template.metadata.labels`.** The template labels must be a superset of the selector; if the pods it creates don't match its own selector, the Deployment can't recognise/own them and the API server rejects it.

The **trap**: `spec.selector` is **immutable** after creation. You can freely change the template labels' *supersets* and other fields, but you cannot alter the selector on an existing Deployment — attempting it errors. To change a selector you must **delete and recreate** the Deployment (ideally with a new name or an orphan-and-adopt dance to avoid downtime). This bites people trying to re-label a running app; plan for a recreate, not an edit.

### Q11. How do RBAC, ResourceQuota, and LimitRange relate to namespaces?

The namespace is the **attachment point** for per-tenant policy — this is a big part of *why* namespaces exist:

- **RBAC (namespaced):** a **Role** grants permissions *within one namespace*; a **RoleBinding** grants a user/group/ServiceAccount those permissions there. (Cluster-wide equivalents are **ClusterRole**/**ClusterRoleBinding**.) So you give team A `edit` in namespace `team-a` and nothing elsewhere.
- **ResourceQuota (namespaced):** caps the *aggregate* CPU/memory/object counts a namespace may consume — the resource budget for that tenant.
- **LimitRange (namespaced):** sets default and min/max requests/limits per container/pod in that namespace.

Together they make a namespace a *governable tenant*: who can do what (RBAC), how much total they can use (ResourceQuota), and sane per-pod sizing (LimitRange). A typical multi-tenant setup is "one namespace per team, each with a RoleBinding, a ResourceQuota, and a LimitRange." What's still missing is network isolation — that's NetworkPolicies, not namespaces.

### Q12. Is a namespace a hard or soft isolation boundary?

**Soft** by default. A namespace isolates:

- **Names** (scoped uniqueness),
- **RBAC** (who can act on objects in it),
- **Resource budgets** (ResourceQuota/LimitRange).

It does **not** isolate:

- **Network** — all pods share one flat network; a pod in `dev` can hit a Service in `prod` via FQDN. You need **NetworkPolicies** for real traffic isolation.
- **Nodes/kernel** — pods from different namespaces can co-schedule on the same node and share the kernel; a container escape crosses namespaces. Hard workload isolation needs node pools + taints, or stronger sandboxing (gVisor/Kata), and for true separation, **separate clusters**.
- **Cluster-scoped resources** — Nodes, PVs, CRDs are shared and visible cluster-wide.

So the accurate framing: namespaces give you *administrative and organisational* isolation, not *security* isolation. For a hostile-multi-tenant scenario you layer NetworkPolicies (network), RBAC (API), ResourceQuota (noisy-neighbour), and often dedicated nodes — or you use separate clusters when the trust boundary is real.

### Q13. Why does a namespace get stuck in Terminating, and how do you resolve it?

When you delete a namespace, Kubernetes marks it `Terminating` and deletes everything inside it, then removes the namespace. It **hangs in Terminating** when something blocks that cleanup — almost always a **finalizer**:

- A resource in the namespace (or the namespace's own `spec.finalizers`) has a finalizer key, and the controller responsible for removing it is gone, broken, or never ran. Deletion can't complete until the finalizer clears.
- Common culprit: a **CRD's custom resource** whose operator has been uninstalled, so nothing removes its finalizer; or an APIService for aggregated metrics that's unavailable, so the namespace can't enumerate/delete resources.

Diagnose and resolve:

```bash
kubectl get namespace prod -o json | jq '.status'      # see remaining finalizers/conditions
kubectl api-resources --verbs=list --namespaced -o name \
  | xargs -n1 kubectl get -n prod                        # find lingering objects
```

Fix the *root cause* first — reinstall the operator or restore the failing APIService so finalizers clear naturally. **Force-removing** the finalizer (editing the namespace's `spec.finalizers` to `[]` via the API) unblocks it but **orphans** any real resources that finalizer was protecting — a last resort, not the default move.

### Q14. How do you add, change, and remove labels and annotations with kubectl?

Imperative commands for quick edits (the declarative way is editing the manifest, but interviewers want the CLI too):

```bash
# Labels
kubectl label pod mypod env=prod                 # add
kubectl label pod mypod env=staging --overwrite  # change (must pass --overwrite)
kubectl label pod mypod env-                     # remove (trailing minus)
kubectl label pods --all tier=backend            # bulk across selection
kubectl get pods -l env=prod --show-labels       # view/select

# Annotations
kubectl annotate pod mypod owner=alice
kubectl annotate pod mypod owner=bob --overwrite
kubectl annotate pod mypod owner-                # remove
```

Two gotchas worth calling out: changing an existing label/annotation **requires `--overwrite`** or the command errors (a guard against clobbering); and the **trailing minus** (`env-`) is the remove syntax for both. In real workflows you'd change labels/annotations in the manifest and `kubectl apply` so the change is versioned — imperative `label`/`annotate` is for ad-hoc ops and scripting.

### Q15. Debug this: a Service returns no endpoints even though the pods are Running. What's the likely cause?

The overwhelmingly common cause is a **selector/label mismatch** — the Service's `selector` doesn't match the pods' labels, so it selects nothing and its EndpointSlice is empty. Pods being `Running` is irrelevant; the Service wires to pods purely by label query.

Diagnose:

```bash
kubectl get endpoints my-svc          # empty / <none> confirms it selects nothing
kubectl get endpointslices -l kubernetes.io/service-name=my-svc
kubectl describe svc my-svc           # read the Selector line
kubectl get pods --show-labels        # compare pod labels to that selector
```

Line up the Service's selector against the pod labels and you'll usually spot a typo, a missing label, or a case/version mismatch (`app: api` vs `app: API`, or the Service selecting `version=v1` while pods are `version=v2`).

Other suspects if labels *do* match:

- **Pods failing readiness probes** — an unready pod is deliberately removed from Service endpoints (Running ≠ Ready). Check `kubectl get pods` Ready column.
- **Wrong `targetPort`** — the Service points at a container port the pod doesn't expose (endpoints populate but traffic fails).
- **Cross-namespace assumption** — a selector-based Service only selects pods in **its own namespace**.

Fix the label mismatch (align selector and pod template) or the failing probe, and the endpoints populate automatically — the endpoints controller reconciles continuously.
## RBAC & API Access

### Summary

**What this topic covers**

How Kubernetes decides *who* can do *what* to the API. Every action against a cluster — `kubectl`, a controller, a pod's in-cluster client — is an HTTP request to the kube-apiserver, and each one runs a three-stage gauntlet: **authentication** (who are you?), **authorization** (are you allowed?), and **admission control** (should this specific object be allowed/mutated?). This topic's 16 questions walk that pipeline: the authn methods Kubernetes actually supports (client certs, bearer tokens, ServiceAccount tokens, OIDC, webhooks — and the crucial fact that **Kubernetes has no `User` object**), how pods get an identity via ServiceAccounts and projected bound tokens, the four RBAC objects (`Role`/`RoleBinding`, `ClusterRole`/`ClusterRoleBinding`) and what each of the four combinations grants, how a rule is built from verbs + resources + apiGroups, least-privilege discipline, checking access with `kubectl auth can-i`, impersonation, admission webhooks and policy engines (OPA/Gatekeeper, Kyverno), and cloud IAM bridges (IRSA on EKS, Workload Identity on GKE).

**Mental model**

Picture the api-server as the *only* door into the cluster — etcd sits behind it and nothing talks to etcd directly. Every request is stateless HTTPS. The api-server runs it through an ordered chain: first a stack of **authenticators** (it tries each until one succeeds and produces a username + groups; failure = 401), then a stack of **authorizers** (RBAC is the usual one; if any authorizer says "allow" the request proceeds; none allowing = 403), then **admission controllers** (mutating ones can rewrite the object, validating ones can reject it), and only then is the object validated and persisted to etcd. The key insight for RBAC: it is **purely additive and allow-only** — there are no deny rules. You start from zero and grant. A subject's effective permissions are the union of every binding that names it. So debugging access is always "which binding grants this?" not "which rule denies it?".

**Key terms**

- **kube-apiserver** — the front door; the only component that reads/writes etcd. Enforces authn → authz → admission.
- **Authentication** — establishing identity (username + groups). Client certs, bearer/ServiceAccount tokens, OIDC, or auth webhook.
- **ServiceAccount (SA)** — an in-cluster identity for pods (a real API object, namespaced). Every namespace has a `default` SA.
- **Bound / projected token** — a short-lived, audience-scoped JWT minted by the TokenRequest API and projected into the pod; replaces legacy long-lived secret tokens.
- **Role / RoleBinding** — namespaced permission set and the grant that ties it to subjects *within one namespace*.
- **ClusterRole / ClusterRoleBinding** — cluster-scoped permission set and grant; covers all namespaces and cluster-scoped resources (nodes, PVs).
- **Rule** — `apiGroups` + `resources` + `verbs` (+ optional `resourceNames`); the atomic unit of an RBAC role.
- **Verb** — the action: `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, plus `bind`, `escalate`, `impersonate`.
- **Aggregated ClusterRole** — a ClusterRole auto-assembled from others via `aggregationRule` label selectors.
- **Admission controller** — a plugin (or webhook) that validates/mutates objects after authz; where policy engines like Gatekeeper/Kyverno hook in.
- **IRSA / Workload Identity** — EKS/GKE mechanisms that map a Kubernetes SA to a cloud IAM role so pods get cloud credentials without static keys.
- **Impersonation** — acting as another user/group/SA via `--as` (itself gated by the `impersonate` verb).

**Why interviewers ask this**

RBAC is where security and operability meet, so it's a high-signal topic. A junior answer stops at "you make a Role and bind it." A senior answer knows the *pipeline* (authn ≠ authz ≠ admission), knows Kubernetes has no user database so identity comes from certs/OIDC/SAs, and can reason about blast radius: "who could this token reach if leaked?" Interviewers for SRE/platform roles want to hear least-privilege instincts — never `cluster-admin` for a workload, no wildcards, watch out for `escalate`/`bind`/`impersonate` — and awareness that a pod with a mounted SA token is a credential an attacker inherits on RCE. They're also probing whether you can *debug* a 403 (`kubectl auth can-i`, describe the binding) versus a 401 (authn/cert/token problem), because confusing the two wastes an incident.

**Common confusions**

- "There's a User object I can `kubectl create`" — there isn't. Users are external identities asserted by certs/OIDC; only ServiceAccounts are in-cluster API objects.
- "RBAC can deny access" — it can't. RBAC is allow-only and additive; you remove access by removing bindings, not by adding deny rules.
- "A RoleBinding can grant a Role in another namespace" — no; a RoleBinding is namespaced and grants within its own namespace (though it *can* reference a ClusterRole).
- "401 and 403 are interchangeable" — 401 = authentication failed (bad/expired token, unknown identity); 403 = authenticated but not authorized (missing RBAC grant).
- "The SA token in a pod is harmless" — it's a live API credential; anyone who compromises the pod inherits exactly its permissions.
- "Admission control is part of RBAC" — separate stage; RBAC says *who can act*, admission says *whether this object is acceptable*.

**What follows from this topic**

RBAC is the "who" of cluster security; **Pod & Cluster Security** is the "what runs and how contained it is" — SecurityContext, Pod Security Admission, NetworkPolicies, image trust. The two interlock: locking down RBAC but leaving a privileged pod (or vice versa) leaves an obvious escalation path. Impersonation and the `escalate` verb connect to the privilege-escalation scenarios there, and admission webhooks introduced here are exactly where policy engines enforce the pod-security rules of the next topic.

### Q1. Walk me through what happens to an API request from `kubectl` before it changes anything.

Three ordered stages inside the kube-apiserver, then persistence:

1. **Authentication** — the api-server tries each configured authenticator (client cert, bearer token, ServiceAccount token, OIDC, webhook) until one succeeds, yielding a `username` and `groups`. If none succeed → **401**.
2. **Authorization** — authorizers (typically RBAC, sometimes Node, Webhook) are consulted; if any returns "allow" the request proceeds. If none allow → **403**.
3. **Admission control** — mutating admission plugins/webhooks may rewrite the object (inject sidecars, defaults), then validating ones may reject it (policy violations). This is *after* authz.

Only then is the object schema-validated and written to **etcd**. Nothing touches etcd except the api-server. The mental cheat: 401 = "I don't know you", 403 = "I know you but no", admission rejection = "I know you and you're allowed to act, but this *object* is unacceptable."

### Q2. How does Kubernetes authenticate users? Is there a User object?

There is **no `User` (or `Group`) object** in Kubernetes — you can't `kubectl create user`. Identity is asserted by an external mechanism and the api-server just extracts a username + groups from it:

- **Client certificates** — CN → username, O (organization) fields → groups. Common for `kubectl` admins and kubeconfig.
- **Bearer tokens** — static token file (legacy), or…
- **ServiceAccount tokens** — JWTs for in-cluster workloads (the one real in-cluster identity type).
- **OIDC** — the standard for human SSO; the api-server validates an ID token from your IdP (Okta, Google, Azure AD, Dex) and maps claims to username/groups.
- **Authentication webhook** — delegate to an external service (e.g. cloud IAM: EKS uses a webhook to map AWS IAM identities).

So "add a user" in practice means "issue them a cert" or "wire OIDC and bind their group." ServiceAccounts are the exception — they *are* API objects.

### Q3. What is a ServiceAccount and how does a pod use it?

A **ServiceAccount** is a namespaced identity for processes running in pods. Every namespace ships a `default` SA, and every pod runs as one (the `default` unless you set `serviceAccountName`).

The api-server projects a **token** into the pod at `/var/run/secrets/kubernetes.io/serviceaccount/` (token, CA cert, namespace). The in-cluster Kubernetes client library reads these automatically, plus the `KUBERNETES_SERVICE_HOST/PORT` env vars, to build a config and call the api-server via the `kubernetes` Service in `default`.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: alice-app
  namespace: prod
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alice-app
spec:
  template:
    spec:
      serviceAccountName: alice-app
      automountServiceAccountToken: true  # set false if the pod never calls the API
```

Give each workload its **own** SA with a tight Role, rather than piling permissions on `default`.

### Q4. Legacy SA secret tokens vs projected bound tokens — what changed and why does it matter?

**Legacy (pre-1.24):** creating a ServiceAccount auto-created a `Secret` holding a **long-lived, never-expiring** JWT. If that secret leaked, it was a permanent credential — no expiry, no audience binding, valid until the SA was deleted.

**Now (bound tokens via the TokenRequest API):** the kubelet requests a token that is **time-limited** (auto-rotated, e.g. hourly), **audience-scoped**, and **bound** to the specific pod/SA (invalidated when the pod is deleted). It's projected via a `projected` volume, not stored in a standalone Secret. Auto-creation of the legacy secret was disabled by default in 1.24+.

```yaml
volumes:
- name: token
  projected:
    sources:
    - serviceAccountToken:
        audience: vault
        expirationSeconds: 3600
        path: token
```

Why it matters: bound tokens shrink the blast radius of a leak from "forever" to "until it expires and is unbound." If you still see auto-generated SA secrets, that's tech debt to clean up.

### Q5. Explain the four combinations of Role/ClusterRole and RoleBinding/ClusterRoleBinding.

Two axes: the *permission set* is namespaced (`Role`) or cluster-wide (`ClusterRole`); the *grant* is namespaced (`RoleBinding`) or cluster-wide (`ClusterRoleBinding`).

| Binding \ Role | Role (namespaced) | ClusterRole (cluster) |
|---|---|---|
| **RoleBinding** (in ns X) | Grants the Role's perms **in ns X only** | Grants the ClusterRole's perms **but scoped to ns X** — reuse one ClusterRole across namespaces |
| **ClusterRoleBinding** | ❌ invalid | Grants the ClusterRole's perms **cluster-wide** + on cluster-scoped resources (nodes, PVs, namespaces) |

The useful non-obvious one is **RoleBinding → ClusterRole**: define a reusable ClusterRole (e.g. "view deployments") once, then bind it per-namespace to different teams. ClusterRoles are also the *only* way to grant access to cluster-scoped resources and to non-resource URLs (`/healthz`).

### Q6. What are the components of an RBAC rule?

A rule is the atomic grant inside a Role/ClusterRole, combining:

- **apiGroups** — which API group the resource lives in. `""` (empty) is the **core** group (pods, services, configmaps); `apps` (deployments, statefulsets); `rbac.authorization.k8s.io`; etc.
- **resources** — the object type(s): `pods`, `deployments`, `secrets`. Subresources use a slash: `pods/log`, `pods/exec`, `deployments/scale`.
- **verbs** — actions: `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, `deletecollection`.
- **resourceNames** (optional) — restrict to named instances, e.g. only the configmap `alice-config`.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: prod
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
```

A common trap: forgetting the resource lives in a non-core group and leaving `apiGroups: [""]` for `deployments` (it's `apps`), so the grant silently does nothing.

### Q7. Write a Role and RoleBinding that lets a ServiceAccount read pods and their logs in one namespace.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-log-reader
  namespace: prod
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: alice-app-pod-log-reader
  namespace: prod
subjects:
- kind: ServiceAccount
  name: alice-app
  namespace: prod
roleRef:
  kind: Role
  name: pod-log-reader
  apiGroup: rbac.authorization.k8s.io
```

Note `roleRef` is immutable — to point a binding at a different role you delete and recreate it. Subjects can be `ServiceAccount`, `User`, or `Group`.

### Q8. How does a pod talk to the Kubernetes API from inside the cluster?

Via **in-cluster config**, assembled automatically by the client library:

- The projected SA token at `/var/run/secrets/kubernetes.io/serviceaccount/token` (the bearer credential).
- The cluster CA at `.../ca.crt` (to verify the api-server's TLS).
- The `KUBERNETES_SERVICE_HOST` / `KUBERNETES_SERVICE_PORT` env vars, which point at the `kubernetes` `ClusterIP` Service in the `default` namespace — a stable in-cluster endpoint for the api-server.

`client-go`'s `rest.InClusterConfig()` (and equivalents in every language SDK) reads all of this with no configuration. The pod then makes ordinary HTTPS calls; the api-server authenticates the SA token and authorizes via the SA's RBAC. If the pod doesn't need API access, set `automountServiceAccountToken: false` so there's no token to steal.

### Q9. How do you check what a subject is allowed to do?

`kubectl auth can-i` queries the authorization stack directly:

```bash
kubectl auth can-i create deployments -n prod
kubectl auth can-i delete pods --all-namespaces
# Check on behalf of a ServiceAccount (needs impersonate perms):
kubectl auth can-i list secrets -n prod \
  --as=system:serviceaccount:prod:alice-app
# Dump everything the current user can do:
kubectl auth can-i --list -n prod
```

For auditing *who* has a permission, tools like `rbac-lookup`, `rbac-tool`, or `kubectl who-can` (an rakkess/krew plugin) invert the question. When debugging a 403, `auth can-i --as=...` reproduces the exact subject and tells you yes/no without trial-and-error deploys.

### Q10. What are aggregated ClusterRoles?

A ClusterRole whose rules are **assembled automatically** from other ClusterRoles that match a label selector, via `aggregationRule`. The controller keeps the aggregate's `rules` in sync as matching roles come and go.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.example.com/aggregate-to-monitoring: "true"
rules: []  # filled in automatically
```

Kubernetes itself uses this for the built-in `view`, `edit`, and `admin` ClusterRoles — a CRD's operator can ship a ClusterRole labelled `rbac.authorization.k8s.io/aggregate-to-edit: "true"` and its resources instantly become editable by anyone with `edit`, without patching the core role. It's the extension mechanism for "let this new resource type participate in standard roles."

### Q11. What does least privilege look like in RBAC, and which verbs are dangerous?

Principles: grant the narrowest `verbs` on the narrowest `resources` in the narrowest scope (namespaced Role over ClusterRole; `resourceNames` when you can); one SA per workload; **never** bind `cluster-admin` to a workload; avoid wildcards (`resources: ["*"]`, `verbs: ["*"]`, `apiGroups: ["*"]`).

Verbs that enable privilege escalation, treat as radioactive:

- **`escalate`** — lets a subject create/update a Role with *more* permissions than they hold (normally RBAC blocks that).
- **`bind`** — lets a subject create bindings to roles they don't themselves have, granting others (or themselves) more.
- **`impersonate`** — act as any user/group/SA, i.e. become someone more privileged.
- **`create` on pods** + a permissive PodSecurity posture — a pod can mount host paths or another SA's token and pivot.
- **Read on `secrets`** cluster-wide — often equivalent to reading every credential in the cluster.

Interviewers love "you have `get secrets` cluster-wide — why is that basically admin?" (because it exposes SA tokens, TLS keys, DB passwords).

### Q12. What's impersonation and when is it used?

Impersonation lets an authorized subject act **as** another user, group, or ServiceAccount for a single request:

```bash
kubectl get pods -n prod --as=alice --as-group=developers
kubectl auth can-i --list --as=system:serviceaccount:prod:alice-app
```

The api-server checks the *caller* holds the `impersonate` verb on `users`/`groups`/`serviceaccounts` before honoring it. Legitimate uses: an admin verifying "what can this SA actually do?", audit tooling, dashboards that act on a logged-in user's behalf. Because it's a straight path to privilege escalation, `impersonate` should be granted extremely sparingly and its use audited.

### Q13. What is admission control and how do policy engines fit in?

Admission control is the **third** stage, after authz, operating on the object itself:

- **Mutating admission** runs first — can rewrite objects (inject sidecars, set defaults, add labels). Built-ins plus `MutatingAdmissionWebhook`.
- **Validating admission** runs second — accept or reject, no mutation. Built-ins plus `ValidatingAdmissionWebhook`.

Policy engines register as webhooks (or, increasingly, as the in-tree **ValidatingAdmissionPolicy** using CEL) to enforce org rules the built-in RBAC/PodSecurity can't express:

- **OPA/Gatekeeper** — policies in Rego, delivered as `ConstraintTemplate` + `Constraint` CRDs (e.g. "all images must come from `my-registry`", "every namespace needs an owner label").
- **Kyverno** — Kubernetes-native YAML policies; can validate, mutate, and generate.

This is the layer that enforces the pod-security guardrails from the next topic — "no privileged pods," "must set resource limits," "only signed images."

### Q14. How do pods get cloud credentials without static keys (IRSA / Workload Identity)?

You federate a Kubernetes ServiceAccount to a cloud IAM identity so pods get **short-lived, auto-rotated** cloud credentials — no long-lived access keys baked into images or secrets.

- **EKS — IRSA (IAM Roles for Service Accounts):** the cluster exposes an OIDC provider; you annotate the SA with an IAM role ARN (`eks.amazonaws.com/role-arn`). A projected SA token is exchanged (via STS `AssumeRoleWithWebIdentity`) for temporary AWS creds scoped to that role.
- **GKE — Workload Identity:** bind a Kubernetes SA to a Google SA; pods using that KSA automatically receive GCP credentials via the metadata server.
- **AKS — Workload Identity:** analogous, federating the KSA token to an Entra ID (Azure AD) app registration.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: alice-app
  namespace: prod
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::111122223333:role/alice-app-s3
```

Benefit: the pod's cloud permissions are per-workload and credentials never sit at rest. The tradeoff to mention: it ties K8s RBAC identity to cloud IAM, so both must be reasoned about together.

### Q15. What are the most common RBAC misconfigurations you look for?

- **`cluster-admin` bound to a ServiceAccount** — often left over from an operator install; total cluster compromise if the pod is popped.
- **Wildcards** — `verbs: ["*"]`, `resources: ["*"]`, or a ClusterRoleBinding to a wildcard ClusterRole. Almost never justified.
- **`get`/`list` on `secrets` cluster-wide** — effectively reads every credential; frequently over-granted to logging/monitoring agents.
- **Using the `default` ServiceAccount for real workloads** and piling permissions on it, so everything in the namespace inherits them.
- **`automountServiceAccountToken: true`** on pods that never call the API — a free credential for an attacker.
- **`escalate`/`bind`/`impersonate`** granted broadly, giving a path to self-promotion.
- **Leftover legacy SA secret tokens** — long-lived, non-expiring, still valid.

Tooling: `kubectl auth can-i --list`, `rbac-tool`, `kube-bench` (CIS checks), and OPA/Kyverno policies that reject these at admission time.

### Q16. Debug this: a pod's app gets `403 Forbidden` calling the API, but the same call works from your laptop with `kubectl`. What's going on?

Your laptop uses **your** kubeconfig identity (probably an admin cert/OIDC); the pod uses its **ServiceAccount**, which has different (usually far narrower) RBAC. A 403 means authentication *succeeded* — the SA token is valid — but authorization failed: the SA lacks a binding for that verb/resource.

Debug path:

```bash
# 1. Which SA does the pod run as?
kubectl get pod alice-app-xxxx -n prod -o jsonpath='{.spec.serviceAccountName}'
# 2. Reproduce the exact check as that SA:
kubectl auth can-i list configmaps -n prod \
  --as=system:serviceaccount:prod:alice-app     # -> "no"
# 3. Find (or add) the binding:
kubectl get rolebindings,clusterrolebindings -A \
  -o wide | grep alice-app
```

Fix by granting the missing permission via a Role + RoleBinding scoped to what the app needs — not by giving it `cluster-admin`. If it were a **401** instead, the story would be different (missing/expired token, `automountServiceAccountToken: false`, or a projected-token audience mismatch).

## Pod & Cluster Security

### Summary

**What this topic covers**

How to make a workload — and the cluster around it — hard to break out of. Where RBAC governs API access, this topic is about **runtime containment and supply-chain trust**: the pod/container `SecurityContext` (run as non-root, drop capabilities, read-only root filesystem, no privilege escalation, and why `privileged: true` is essentially "root on the node"), **Pod Security Admission** (the built-in replacement for PodSecurityPolicy, with its privileged/baseline/restricted profiles and enforce/audit/warn modes applied via namespace labels), **NetworkPolicies** (default-allow until a policy selects a pod, then default-deny for that pod; needs a CNI that enforces them), **seccomp** and **AppArmor** profiles, image security (scanning, signing with cosign, trusted-registry admission, avoiding `:latest` and root images), secrets handling, the **4Cs** of cloud native security, supply-chain concerns (SBOM), etcd encryption and api-server hardening, host-namespace sharing risks, and multi-tenancy isolation. The 16 questions run from "what's a SecurityContext" to "harden this pod spec."

**Mental model**

Assume the container *will* be compromised and ask: what does the attacker get? Defense is layered — the **4Cs**: **Cloud** (or corporate datacenter — node/network/API-endpoint security), **Cluster** (RBAC, PodSecurity, NetworkPolicies, etcd encryption), **Container** (image provenance, scanning, non-root, minimal), **Code** (your app's own security). Each outer layer contains the blast radius of the inner one. Within a pod, the guiding rule is **minimize privilege at every layer**: run as an unprivileged user, drop every Linux capability then add back only what's needed, make the root filesystem read-only, forbid privilege escalation, and confine syscalls with seccomp. A container is *not* a security boundary the way a VM is — it shares the host kernel — so a privileged container, a host mount, or a host namespace is a direct path to the node, and from a node's kubelet credentials, often to the wider cluster. Networking follows the same posture: flat and open by default, so you impose **default-deny** and allow only intended flows.

**Key terms**

- **SecurityContext** — per-pod or per-container settings controlling UID/GID, capabilities, privilege, filesystem, and escalation.
- **runAsNonRoot / runAsUser** — refuse to run as UID 0 / pin a specific non-root UID.
- **allowPrivilegeEscalation** — whether a process can gain more privileges than its parent (`no-new-privs`); set `false`.
- **Capabilities** — fine-grained slices of root's power; best practice is `drop: ["ALL"]` then add back the minimum.
- **privileged** — `true` disables most isolation; the container gets near-full host access. Almost never needed.
- **Pod Security Admission (PSA)** — built-in admission controller enforcing the Pod Security Standards via namespace labels.
- **Pod Security Standards** — three profiles: **privileged** (unrestricted), **baseline** (blocks known escalations), **restricted** (hardened best practice).
- **NetworkPolicy** — namespaced object selecting pods and allowing specific ingress/egress; enforced by the CNI.
- **CNI** — the network plugin (Calico, Cilium); only some enforce NetworkPolicy.
- **seccomp** — syscall filter; `RuntimeDefault` blocks dangerous syscalls.
- **AppArmor** — Linux MAC profiles restricting file/capability access per container.
- **cosign / SBOM** — image signing (Sigstore) and a Software Bill of Materials listing image contents/dependencies.

**Why interviewers ask this**

Security is where "it works" and "it's safe to run in prod" diverge, and it's a fast way to sort candidates. Juniors think a container *is* a security boundary and run everything as root because "it's just a container." Seniors know containers share the host kernel, that `privileged: true` is effectively root on the node, and that the real question is blast radius after compromise. Interviewers want the layered instinct (4Cs), knowledge that **PodSecurityPolicy is gone** and PSA/policy engines replaced it, and the reflex to reach for non-root + drop-ALL + read-only-rootfs + default-deny NetworkPolicy. For platform/SRE roles they'll probe multi-tenancy ("how do you isolate two teams on one cluster?") and supply chain ("how do you know this image is trustworthy?"). Getting "a container is not a VM" right early sets the tone.

**Common confusions**

- "A container is a security boundary" — it shares the host kernel; a kernel exploit or a privileged/host-namespace container escapes to the node. Namespaces + cgroups are isolation, not a hard boundary.
- "PodSecurityPolicy secures pods" — PSP was **removed** (1.25). Use Pod Security Admission or a policy engine (Kyverno/Gatekeeper).
- "NetworkPolicies work out of the box" — they need a CNI that enforces them; on a non-enforcing CNI they're silently ignored.
- "Applying any NetworkPolicy locks the namespace down" — a policy only affects pods it *selects*; unselected pods stay fully open.
- "Secrets are encrypted" — base64 is encoding, not encryption; enable etcd encryption-at-rest and restrict `get secrets` RBAC.
- "`runAsNonRoot: true` picks a user for me" — no; it only *refuses* UID 0. You still need the image to define a non-root user or set `runAsUser`.

**What follows from this topic**

This is the containment half of the security story that **RBAC & API Access** began — RBAC limits who can act on the API, PodSecurity/NetworkPolicy/image trust limit what a running workload can do and reach. Admission webhooks from the RBAC topic are the enforcement mechanism for many rules here (trusted registries, no-privileged). And it connects forward to **Health, Probes & Lifecycle**: a hardened, read-only, non-root pod still has to start, pass probes, and shut down gracefully, so security constraints and lifecycle behavior have to be designed together.

### Q1. What is a SecurityContext and what are the settings that matter?

A `securityContext` defines privilege and access-control settings, at pod level (applies to all containers, plus `fsGroup`) or per-container (overrides). The ones that matter:

```yaml
spec:
  securityContext:            # pod-level
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000             # group owner for mounted volumes
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    securityContext:          # container-level
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      privileged: false
      capabilities:
        drop: ["ALL"]
```

- **runAsNonRoot / runAsUser / runAsGroup** — refuse root / pin UID/GID.
- **fsGroup** — supplemental group that owns mounted volumes so a non-root process can write.
- **allowPrivilegeEscalation: false** — sets `no-new-privs`, blocking setuid escalation.
- **readOnlyRootFilesystem: true** — image FS is immutable; mount `emptyDir` for the few writable paths.
- **capabilities.drop: ["ALL"]** — start from zero root powers; add back only what's needed (e.g. `NET_BIND_SERVICE`).
- **privileged** — keep `false`.

### Q2. Why is a privileged container dangerous?

`privileged: true` disables most of the isolation that makes a container a container: the process gets **all Linux capabilities**, sees all host devices (`/dev`), can bypass seccomp/AppArmor, and can manipulate the host kernel. Combined with a host mount or host namespace it's a trivial escape — mount the host's root filesystem, chroot in, add an SSH key, or write to the kubelet's credentials and pivot to the whole cluster.

Because containers share the host kernel, "privileged" is not "a bit more access," it's effectively **root on the node**. Legitimate needs are rare (some CNI/CSI agents, node-level monitoring) and should run as narrowly-scoped DaemonSets, ideally with specific capabilities rather than blanket `privileged`. In app workloads it's a red flag; policy engines and the `restricted` PodSecurity profile forbid it outright.

### Q3. What replaced PodSecurityPolicy? Explain Pod Security Admission.

**PodSecurityPolicy was removed in 1.25.** Its built-in successor is **Pod Security Admission (PSA)** — an admission controller that enforces the **Pod Security Standards** at the namespace level via labels. No CRDs, no ordering/RBAC footguns that plagued PSP.

Three **profiles**:
- **privileged** — no restrictions (system/infra namespaces).
- **baseline** — blocks known privilege escalations (no privileged, no host namespaces, limited caps) while staying broadly compatible.
- **restricted** — hardened best practice: non-root, drop ALL caps, `seccompProfile: RuntimeDefault`, no privilege escalation, read-only-ish.

Three **modes**, each settable to a profile independently:
- **enforce** — reject violating pods.
- **audit** — allow but record in the audit log.
- **warn** — allow but return a `kubectl` warning.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
```

A common rollout is `warn`+`audit` first to find violators, then flip `enforce`. For rules PSA can't express, layer Kyverno/Gatekeeper.

### Q4. How do NetworkPolicies work? Explain the default-allow-then-deny behavior.

By default the pod network is **flat and open** — any pod can reach any other pod. A `NetworkPolicy` is a namespaced object that **selects** pods (via `podSelector`) and specifies allowed **ingress** and/or **egress**. The critical semantics:

- A pod with **no** policy selecting it is **default-allow** (open).
- As soon as **any** policy selects a pod for a direction, that pod becomes **default-deny** for that direction — only explicitly allowed traffic passes.

So you switch a namespace to zero-trust by applying a catch-all deny, then adding allow policies:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: prod
spec:
  podSelector: {}          # selects every pod in the namespace
  policyTypes: ["Ingress", "Egress"]
  # no ingress/egress rules => deny all in both directions
```

Then allow specific flows with `podSelector`/`namespaceSelector`/`ipBlock`. **Caveat:** enforcement is the CNI's job — Calico and Cilium enforce; some plugins don't, and then policies are silently ignored. Also remember to allow DNS egress to CoreDNS or everything breaks.

### Q5. Write a NetworkPolicy that lets only the frontend talk to the backend on port 8080.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-allow-frontend
  namespace: prod
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes: ["Ingress"]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
```

This selects `app: backend` pods and, because a policy now selects them for Ingress, denies all ingress *except* TCP/8080 from `app: frontend` pods in the same namespace. To allow a *different* namespace, add a `namespaceSelector` (combined with `podSelector` in the same `from` element = AND; as separate elements = OR). Egress from backend is untouched here — add an egress policy (and a DNS allow) if you want to lock that down too.

### Q6. What are seccomp and AppArmor and how do you use them?

Both confine what a container can do at the kernel level, complementing capabilities:

- **seccomp (secure computing mode)** filters the **syscalls** a process may make. The easy win is `RuntimeDefault`, the container runtime's curated profile that blocks dangerous/obscure syscalls while allowing normal app behavior. You can also supply a `Localhost` custom profile.

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault
```

- **AppArmor** is a Linux MAC system applying a **profile** that restricts file paths, capabilities, and network per program. Load the profile on the node, then reference it (via the `appArmorProfile` field in the securityContext on recent versions, or the legacy annotation).

Both follow the same philosophy as capabilities: default-deny, allow the minimum. `RuntimeDefault` seccomp is basically free hardening and is required by the `restricted` PodSecurity profile — turn it on everywhere.

### Q7. How do you secure container images?

Trust nothing you didn't build and verify:

- **Scan** images for CVEs in CI and again at admission (Trivy, Grype, Clair); fail builds on critical vulns.
- **Sign and verify** with **cosign** (Sigstore) so only images signed by your pipeline run; enforce the signature check at admission (Kyverno/Gatekeeper/Connaisseur).
- **Restrict registries** — admission policy that only allows pulls from `my-registry.example.com`, blocking arbitrary Docker Hub images.
- **Minimal base images** — distroless or `scratch`; fewer packages = smaller attack surface and fewer CVEs.
- **Non-root by default** — set `USER` in the Dockerfile; don't rely on runtime overrides alone.
- **Pin by digest, not `:latest`** — `my-app@sha256:...` is immutable and reproducible; `:latest` is a moving, unauditable target.
- **SBOM** — generate a Software Bill of Materials (Syft) so you can answer "are we affected by CVE-X?" fast.

### Q8. What are the 4Cs of cloud native security?

A layered model — each outer layer secures and contains the inner one:

1. **Cloud** (or corporate datacenter) — the infrastructure: node OS hardening, private control plane, restricted api-server endpoint, network/firewall, IAM. If this is wrong, nothing above it matters.
2. **Cluster** — Kubernetes itself: RBAC, Pod Security Admission, NetworkPolicies, etcd encryption at rest, api-server auditing, TLS everywhere.
3. **Container** — image provenance and hardening: scanning, signing, minimal non-root images, no unnecessary capabilities.
4. **Code** — your application: input validation, dependency management, secrets handling, TLS, avoiding OWASP-class bugs.

The point in an interview: you can't "secure the container" in isolation. A perfectly hardened image on a cluster with `cluster-admin` bound to every SA, on a node with a public kubelet port, is not secure. Defense in depth across all four.

### Q9. How does Kubernetes handle secrets and what are the limits?

A `Secret` is a namespaced object for sensitive data, mounted as a volume or exposed as env vars. Key facts and limits:

- **base64 is encoding, not encryption** — anyone with `get secrets` reads the value; by default it sits in etcd effectively in plaintext.
- **Enable etcd encryption at rest** (`EncryptionConfiguration`) so secrets are encrypted on disk — ideally with a KMS provider (cloud KMS) so the key isn't on the node.
- **Restrict RBAC** — `get`/`list` on secrets is high-value; scope it tightly (see RBAC topic).
- **Prefer volume mounts over env vars** — env vars leak into logs, crash dumps, and child processes.
- **External secret stores** — Vault, AWS/GCP Secrets Manager via the External Secrets Operator or Secrets Store CSI driver keep the source of truth outside etcd and rotate automatically.
- **Never commit secrets to git**; if you do GitOps, use sealed-secrets or SOPS-encrypted values.

### Q10. Why are host namespace sharing and hostPath dangerous?

They punch holes in the container's isolation straight to the node:

- **hostNetwork: true** — the pod uses the node's network stack directly: it sees all host interfaces, can bind host ports, sniff traffic, and reach node-local services (like the kubelet or metadata endpoint).
- **hostPID: true** — the pod sees and can signal **all processes on the node**, including other tenants' containers and host daemons.
- **hostIPC: true** — shares the host's IPC namespace (shared memory) with everything on the node.
- **hostPath volumes** — mount an arbitrary node directory into the pod. Mount `/` or `/var/lib/kubelet` and you can read every other pod's secrets, or write to the host and escalate. Mounting the container runtime socket (`/var/run/docker.sock` / containerd socket) is game over — you can launch privileged containers.

All are blocked by the `baseline`/`restricted` PodSecurity profiles. Legitimate uses exist (CNI/CSI/monitoring DaemonSets) but should be tightly scoped and few.

### Q11. How do you harden etcd and the API server?

etcd holds the entire cluster state (including secrets), and the api-server is the only door to it — both are top-priority:

- **etcd:** encryption at rest (KMS-backed `EncryptionConfiguration`); mutual TLS between api-server and etcd; etcd bound to localhost / a private network, never public; restrict node access; regular encrypted backups.
- **api-server:** don't expose it publicly if you can avoid it (private endpoint + bastion/VPN); enable **audit logging** to capture who did what; disable anonymous auth and insecure ports; keep only necessary admission plugins on; strong authn (OIDC/certs) and least-privilege RBAC; enable the `NodeRestriction` admission plugin so a kubelet can only modify its own node/pods.
- Keep the control plane **patched** — CVEs here are cluster-wide.

On managed clusters (EKS/GKE/AKS) the provider handles etcd/api-server oper/patching, but you still choose private vs public endpoints, audit config, and encryption settings.

### Q12. How do you achieve multi-tenancy / isolation between teams on one cluster?

**Namespaces are the primary soft boundary** but not a hard security boundary by themselves; layer controls:

- **Namespace per team/tenant**, with **RBAC** scoped so each team can only act in its own.
- **ResourceQuotas + LimitRanges** so one tenant can't starve others (noisy-neighbor).
- **NetworkPolicies** default-denying cross-namespace traffic, so tenants can't reach each other's pods.
- **Pod Security Admission** (`restricted`) per namespace to prevent host access / privileged pods that would break out to shared nodes.
- **Node isolation** for stronger boundaries — dedicated node pools with taints/tolerations, or per-tenant clusters when isolation must be hard.

Be honest in the interview: because pods share a kernel, namespace-based multi-tenancy is *soft* isolation. For strong (hostile) tenant isolation you use separate clusters or sandboxed runtimes (gVisor, Kata Containers) that give each pod a stronger boundary.

### Q13. What supply-chain risks apply to Kubernetes and how do you mitigate them?

The risk is running code you can't vouch for — a compromised base image, a typosquatted dependency, a tampered image in transit, or a malicious Helm chart/operator.

Mitigations:
- **SBOM** for every image (Syft) so you know exactly what's inside and can respond to new CVEs fast.
- **Provenance/attestations** (SLSA, in-toto) proving the image came from your pipeline unaltered.
- **Signing + admission verification** (cosign) so only signed artifacts run.
- **Pin dependencies and base images by digest**; vendor/lock chart versions.
- **Scan continuously** — new CVEs land against images you built months ago.
- **Vet third-party operators/charts** — they often ship broad RBAC (`cluster-admin`); review what they request before installing.

The interview point: security shifts *left* to the build pipeline and *runtime* admission together — you verify provenance before the pod is ever scheduled.

### Q14. What's the difference between capabilities, privileged, and runAsUser?

They're three independent knobs people often conflate:

| Control | What it governs | Best practice |
|---|---|---|
| **runAsUser / runAsNonRoot** | Which **UID** the process runs as | Non-root; pin an explicit UID |
| **capabilities** | Which **slices of root's power** the process holds (e.g. `NET_ADMIN`, `SYS_TIME`) | `drop: ["ALL"]`, add back the minimum |
| **privileged** | Master switch that **grants everything** + host device access | Always `false` for apps |

A process can be **root (UID 0) but with all capabilities dropped** (limited), or **non-root but privileged** (still dangerous via host access) — the axes are orthogonal. `allowPrivilegeEscalation: false` is a fourth, related knob preventing a process from *gaining* capabilities it didn't start with. The senior answer: don't rely on any single one; combine non-root + drop-ALL + no-escalation + not-privileged.

### Q15. Harden this pod spec — what's wrong with it?

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: bad
spec:
  hostNetwork: true
  containers:
  - name: app
    image: my-app:latest
    securityContext:
      privileged: true
    volumeMounts:
    - name: host
      mountPath: /host
  volumes:
  - name: host
    hostPath:
      path: /
```

Problems: `hostNetwork: true` (node network access), `privileged: true` (root on node), `hostPath: /` mounting the entire host filesystem (read/write everything, escape), `image: :latest` (unpinned, unauditable), no user set (runs as root), no capability drops, no seccomp, writable root FS. Hardened:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: good
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: my-registry/my-app@sha256:abc123...   # pinned, from trusted registry
    securityContext:
      allowPrivilegeEscalation: false
      privileged: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
```

No host access, non-root, drop-ALL, read-only rootfs with a scoped writable `emptyDir`, `RuntimeDefault` seccomp, pinned trusted image. This is essentially the `restricted` PodSecurity profile.

### Q16. What tools would you use to audit cluster security?

- **kube-bench** — checks the cluster against the **CIS Kubernetes Benchmark** (control-plane flags, file permissions, etc.).
- **kube-hunter** — actively probes a cluster for exploitable weaknesses (attacker's-eye view).
- **Trivy / Grype** — image and (Trivy) cluster/IaC vulnerability scanning; Trivy also does misconfig scanning of manifests.
- **Polaris / kubeaudit / kubescape** — scan workloads for missing securityContext, `:latest`, no limits, privileged, etc., mapped to frameworks like NSA/CISA hardening guidance.
- **OPA Gatekeeper / Kyverno** — not just enforcement but continuous *audit* of existing resources against policy.
- **`kubectl auth can-i --list` + rbac-tool** — RBAC exposure review.
- **Falco** — runtime threat detection (unexpected syscalls, shells in containers, sensitive mounts).

The layered answer: static scanning at build, admission enforcement at deploy, and runtime detection (Falco) once live — mapped back to the 4Cs.

## Health, Probes & Lifecycle

### Summary

**What this topic covers**

How Kubernetes decides whether a container is healthy, ready for traffic, and how it starts and stops cleanly. The heart of it is the **three probes** and their genuinely distinct jobs: **liveness** (is it alive? failure → kubelet **restarts** the container), **readiness** (is it ready for traffic? failure → **removed from Service endpoints** but *not* restarted), and **startup** (protect slow starters by holding off liveness/readiness until the app has booted). Around that sits the **pod lifecycle**: how termination actually works (`SIGTERM` → grace period → `SIGKILL`), `preStop` hooks and the endpoint-removal-versus-SIGTERM race that forces a `preStop` sleep, graceful shutdown in the app, **PodDisruptionBudgets** protecting availability during voluntary disruptions, restart policy and backoff (`CrashLoopBackOff`), init-container failures, and why readiness gates matter for safe rollouts. The 16 questions go from "what are the three probes" to "why does my rollout drop requests" and "walk me through a graceful shutdown."

**Mental model**

Kubernetes is a control loop acting on **signals**, and probes are how your container *reports its own state* into that loop. Get the two questions separate in your head: **"should I kill and restart this?"** (liveness) and **"should I send it traffic?"** (readiness) are answered by different probes with different consequences. Conflating them is the single most common — and most damaging — health-check mistake, because a liveness probe that checks a downstream dependency turns a dependency blip into a cluster-wide restart storm. Then think about *time*: a pod is mortal, and both **coming up** (startup probe, init containers, readiness gating) and **going down** (endpoint removal, SIGTERM, grace period, preStop, SIGKILL) are multi-step sequences where ordering matters. The subtle race — traffic can still arrive for a moment *after* SIGTERM because endpoint removal is asynchronous — is exactly what a `preStop` sleep exists to paper over. Design health and lifecycle together, from the app's signal handling outward.

**Key terms**

- **Liveness probe** — "is the process healthy?" On failure the kubelet **restarts** the container.
- **Readiness probe** — "can it serve traffic now?" On failure the pod is **removed from Service endpoints**; it is *not* restarted.
- **Startup probe** — "has it finished booting?" Disables liveness/readiness until it passes; protects slow-starting apps.
- **Probe handlers** — `httpGet`, `tcpSocket`, `exec`, `grpc`.
- **Probe tuning** — `initialDelaySeconds`, `periodSeconds`, `timeoutSeconds`, `failureThreshold`, `successThreshold`.
- **terminationGracePeriodSeconds** — time between `SIGTERM` and `SIGKILL` (default 30s).
- **preStop hook** — a command/HTTP call run *before* SIGTERM is sent to the container's main process.
- **PodDisruptionBudget (PDB)** — caps how many pods can be voluntarily disrupted at once (`minAvailable` / `maxUnavailable`).
- **restartPolicy** — `Always` (default, Deployments), `OnFailure`, `Never`.
- **CrashLoopBackOff** — repeated crash-restart with exponential backoff (up to 5 min).
- **Init container** — runs to completion before app containers start; a failure blocks the pod.
- **Voluntary vs involuntary disruption** — planned (drain, upgrade) vs unplanned (node crash); PDBs guard the former.

**Why interviewers ask this**

Probes are deceptively simple and catastrophically easy to misconfigure, so they're a favorite for separating "I copied a YAML snippet" from "I've been paged at 3am." The classic tell is a candidate who can't articulate why liveness and readiness are different, or who puts a database check in a liveness probe. Seniors know the failure modes: cascading restarts from dependency-checking liveness probes, requests dropped during rollouts because there's no readiness probe or no `preStop` sleep, and pods evicted en masse during a node drain because no PDB was set. For SRE roles, graceful shutdown and the SIGTERM/endpoint-removal race are bread-and-butter — they directly cause user-visible 502s during deploys. Interviewers also probe lifecycle debugging: reading `CrashLoopBackOff`, spotting a stuck init container, understanding backoff timing.

**Common confusions**

- "Liveness and readiness are basically the same" — no. Liveness failure **restarts**; readiness failure **removes from endpoints**. Different consequence, different intent.
- "Put the dependency check in liveness" — dangerous. If the DB blips, every replica fails liveness and restarts simultaneously — a self-inflicted outage. Dependency checks belong in **readiness** (or nowhere).
- "SIGTERM immediately stops traffic" — endpoint removal is asynchronous and races with SIGTERM; without a `preStop` sleep, requests arrive at a shutting-down pod → 502s.
- "A startup probe is just a liveness probe with a delay" — it's a separate probe that *gates* the others, better for wildly variable boot times than a fixed `initialDelaySeconds`.
- "PDBs stop node crashes from taking pods down" — PDBs only constrain **voluntary** disruptions (drains, upgrades), not hardware failures.
- "`CrashLoopBackOff` is an error state" — it's a *backoff* state; the container keeps being restarted with growing delay. The real error is in the logs of the previous run.

**What follows from this topic**

Probes and lifecycle are what make everything else in the primer *safe in motion*. Rolling updates depend on readiness probes to know a new pod is actually serving before shifting traffic; without them a rollout happily replaces healthy pods with broken ones. Services depend on readiness to keep endpoints accurate. The graceful-shutdown and PDB material ties directly to safe node drains and cluster upgrades. And the hardened, non-root, read-only pods from **Pod & Cluster Security** still have to start, pass probes, and terminate cleanly — so security constraints (e.g. a read-only rootfs, a dropped `SYS_PTRACE` cap) and lifecycle design have to be reasoned about together.

### Q1. What are the three probe types and how do their consequences differ?

| Probe | Question | Failure consequence |
|---|---|---|
| **Liveness** | Is the container healthy? | kubelet **restarts** the container |
| **Readiness** | Can it serve traffic now? | Pod **removed from Service endpoints**; *not* restarted |
| **Startup** | Has it finished booting? | While failing, liveness/readiness are **disabled**; on final failure the container is restarted |

The distinction is everything. **Liveness** recovers a *stuck* process (deadlock, wedged event loop) by restarting it. **Readiness** manages *traffic* — a pod that's alive but temporarily busy (warming cache, at capacity, lost a dependency) should stop receiving requests without being killed. **Startup** solves slow boots: it holds the other two back so a container that takes 90s to initialize isn't killed by an impatient liveness probe. Wrong choice = wrong outcome: use liveness where you meant readiness and a busy pod gets needlessly restarted mid-request.

### Q2. Explain the classic liveness-probe anti-pattern.

Putting a **dependency check** (database, cache, downstream API) in a **liveness** probe. Here's the failure: the shared database has a 30-second hiccup. Every replica's liveness probe fails. The kubelet restarts **all of them simultaneously**. Now you have a thundering herd of cold-starting pods hammering the recovering database, plus zero capacity while they restart — you've converted a brief dependency blip into a full self-inflicted outage. And restarting the pod does nothing to fix a *downstream* problem.

Rules:
- **Liveness** = "is *this process* wedged?" Check only local, in-process health (can the HTTP server respond at all). No external dependencies.
- **Readiness** = "should I get traffic?" *This* is where a dependency check can live — a pod that can't reach its DB removes itself from endpoints without dying, and rejoins when the DB recovers.
- When in doubt, prefer **no liveness probe** over a bad one. A missing liveness probe just means "never auto-restart"; a bad one means "restart storm."

### Q3. What are the probe handler types?

Four ways a probe can check health:

- **httpGet** — GET a path/port; success = HTTP 200–399. The most common; add a dedicated `/healthz` (liveness) and `/readyz` (readiness) endpoint.
- **tcpSocket** — success if the TCP connection opens. For non-HTTP services (databases, brokers) where "port is accepting" is a sufficient signal.
- **exec** — run a command inside the container; success = exit code 0. Flexible but heaviest (forks a process each period) — use for checks that can't be expressed as HTTP/TCP.
- **grpc** — native gRPC health-checking protocol (`grpc.health.v1`), so gRPC services don't need an HTTP sidecar for probes.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
```

### Q4. What do the probe tuning parameters mean?

- **initialDelaySeconds** — wait this long after the container starts before the first probe. (Prefer a startup probe over a large value here.)
- **periodSeconds** — how often to probe (default 10s).
- **timeoutSeconds** — how long to wait for a response before counting it a failure (default 1s — often too tight).
- **failureThreshold** — consecutive failures before acting (restart/remove-from-endpoints). Default 3.
- **successThreshold** — consecutive successes to be considered passing again (default 1; must be 1 for liveness/startup, can be higher for readiness).

Time-to-restart on liveness ≈ `initialDelaySeconds + periodSeconds × failureThreshold`. Tune so transient GC pauses or brief spikes don't trip a restart, but a truly wedged process is caught reasonably fast.

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 8080 }
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
```

### Q5. When and why do you need a startup probe?

For apps with **slow or highly variable startup** — a JVM warming up, a large cache to load, migrations on boot — where you can't pick a good fixed `initialDelaySeconds`. Too small and the liveness probe kills the app mid-boot (restart loop that never completes); too large and a genuinely dead container isn't caught for minutes after it's up.

A **startup probe** decouples the two: while it's failing, liveness and readiness are suspended, so the app gets up to `periodSeconds × failureThreshold` to boot without being killed. Once it passes **once**, it never runs again and liveness/readiness take over at their normal (tight) cadence.

```yaml
startupProbe:
  httpGet: { path: /healthz, port: 8080 }
  failureThreshold: 30
  periodSeconds: 10          # allows up to 300s to start
livenessProbe:
  httpGet: { path: /healthz, port: 8080 }
  periodSeconds: 10          # kicks in only after startup succeeds
```

That gives 5 minutes to start but a 30-second liveness reaction once running — impossible to express with `initialDelaySeconds` alone.

### Q6. Walk me through what happens when a pod is deleted.

Termination is a sequence, not an instant kill:

1. The pod's `deletionTimestamp` is set; it goes to **Terminating**. The api-server tells the endpoints controller to **remove the pod from Service endpoints** — *and* the kubelet begins the shutdown, concurrently.
2. If a **preStop** hook is defined, the kubelet runs it **first** and waits for it to finish.
3. The kubelet sends **SIGTERM** to the container's main process (PID 1). The app should begin graceful shutdown.
4. Kubernetes waits up to **terminationGracePeriodSeconds** (default 30s).
5. If the process hasn't exited by then, the kubelet sends **SIGKILL** and it's force-killed.

The critical subtlety: steps for **endpoint removal** and **SIGTERM** happen in parallel and endpoint removal is *eventually consistent* across kube-proxy/CNI on every node — so for a brief window traffic can still be routed to a pod that has already received SIGTERM.

### Q7. Why do you need a preStop sleep, and what race does it solve?

Because **endpoint removal is asynchronous** and races with SIGTERM. When a pod terminates, two things start at once: (a) it's removed from Service endpoints, which must propagate to kube-proxy/iptables/IPVS or the CNI on *every* node, and (b) it receives SIGTERM and starts shutting down. If the app shuts down faster than the endpoint removal propagates, in-flight and just-arriving requests hit a dead pod → connection resets / **502s during every deploy**.

The fix is a `preStop` hook that just **sleeps**, delaying SIGTERM long enough for endpoint removal to propagate everywhere:

```yaml
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 5"]
```

During the sleep the pod is still serving but no *new* traffic is being routed to it (endpoints are updating), so it drains cleanly. Make `terminationGracePeriodSeconds` comfortably larger than `sleep + real shutdown time`. This one trick eliminates most deploy-time error spikes.

### Q8. How should an application handle graceful shutdown?

The app must treat **SIGTERM** as "start draining," not ignore it:

1. **Catch SIGTERM** (don't rely on the default, which is immediate exit).
2. **Stop accepting new work** — stop the HTTP listener from accepting new connections, stop pulling new messages off the queue.
3. **Finish in-flight requests** — let active requests/handlers complete (up to a deadline).
4. **Close resources cleanly** — flush buffers, close DB connections and pools, commit offsets.
5. **Exit 0** before the grace period expires, so you're never SIGKILLed mid-write.

Two gotchas: (1) ensure your process is **PID 1** or that signals are forwarded — a shell-wrapped entrypoint or missing init (`tini`/`--init`) can swallow SIGTERM so the app never drains and always gets SIGKILLed. (2) Combine with the `preStop` sleep so shutdown only begins after the pod has been de-registered from endpoints. Set `terminationGracePeriodSeconds` to cover your longest legitimate request.

### Q9. What is a PodDisruptionBudget and what does it protect against?

A **PDB** limits how many pods of an application can be **voluntarily** taken down at once, so cluster operations don't accidentally destroy availability. You express it as `minAvailable` (keep at least N up) or `maxUnavailable` (take at most N down):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: alice-app
spec:
  minAvailable: 2          # or: maxUnavailable: 1
  selector:
    matchLabels:
      app: alice-app
```

It guards **voluntary disruptions**: `kubectl drain` (node maintenance), cluster autoscaler scale-down, node-pool upgrades. The eviction API respects the PDB — a drain will *block/wait* rather than evict a pod if doing so would violate the budget. Crucially it does **not** protect against **involuntary** disruptions (a node hardware failure, kernel panic, OOM) — nothing can, those already happened. Set a PDB for anything where you care about availability during upgrades, but don't set `minAvailable` equal to the replica count or you'll deadlock drains.

### Q10. Explain restart policy and CrashLoopBackOff.

`restartPolicy` controls whether the kubelet restarts a container that exits:

- **Always** (default; the only option for Deployment pods) — restart regardless of exit code.
- **OnFailure** — restart only on non-zero exit (used for Jobs).
- **Never** — never restart.

When a container keeps crashing, the kubelet doesn't hot-loop it — it applies **exponential backoff**: 0s, then 10s, 20s, 40s… doubling up to a **5-minute cap**, and the pod shows `CrashLoopBackOff`. That status is *not* the error itself; it means "this container has crashed repeatedly and I'm waiting before the next restart." The actual cause is in the **previous** container's logs:

```bash
kubectl logs <pod> --previous          # logs from the crashed instance
kubectl describe pod <pod>             # events, exit code, reason (Error/OOMKilled)
```

Common causes: bad config/missing env, a failing dependency at boot, exit code 1 from the app, or OOMKilled (memory limit too low).

### Q11. What happens when an init container fails?

**Init containers** run to completion, **in order**, *before* any app container starts — used for setup (waiting on a dependency, running migrations, fetching config/secrets). If an init container **fails** (non-zero exit), the pod does **not** proceed to app containers; the kubelet restarts the failed init container per the pod's `restartPolicy` (with the same exponential backoff), and the pod sits in status **Init:CrashLoopBackOff** or **Init:Error**.

So a broken init container blocks the whole pod indefinitely — nothing in the main app ever runs. Debug it explicitly by naming the init container:

```bash
kubectl logs <pod> -c <init-container-name>
kubectl describe pod <pod>     # shows which init container is stuck and why
```

A classic case: an init container that waits for a database that never comes up — the pod stays in `Init:` forever, and the mistake is looking at the app container's logs (empty) instead of the init container's.

### Q12. Why does a rolling update drop requests, and how do probes prevent it?

Two failure modes, both about probes/lifecycle:

- **No readiness probe:** the rollout considers a new pod "available" as soon as its container *starts*, not when the app is actually serving. Traffic is routed to a pod that's still booting → errors. A **readiness probe** makes the Deployment wait until the pod reports ready before counting it available and sending traffic, and (with `maxUnavailable`) before terminating old pods.
- **No preStop sleep / graceful shutdown:** as old pods terminate, the endpoint-removal race (Q7) means traffic briefly hits pods that already got SIGTERM → 502s.

So a safe rollout needs **both**: readiness so new pods only get traffic when truly ready, and preStop-sleep + graceful shutdown so old pods drain cleanly. The Deployment's `maxSurge`/`maxUnavailable` then control the pace, but they're only *safe* because the readiness probe is telling the truth about each pod.

### Q13. What are readiness gates and when do they matter?

A standard readiness probe reflects the **container's** own view of readiness. A **readiness gate** (`spec.readinessGates`) lets an *external* controller contribute an additional condition that must also be `True` before the pod is considered Ready — the pod is only in Service endpoints when both the probe **and** every gate condition pass.

The canonical use is **cloud load balancers**: on EKS/GKE, an AWS ALB or GCP LB target-registration controller sets a custom pod condition to `True` only once the pod is actually **registered and healthy in the external LB's target group**. Without the gate, Kubernetes would mark the pod Ready (and shift traffic during a rollout) before the cloud LB had finished registering it — dropping requests at the LB layer even though the pod looked fine to the cluster.

```yaml
spec:
  readinessGates:
  - conditionType: target-health.elbv2.k8s.aws/my-tg
```

So gates matter whenever readiness depends on something outside the pod that Kubernetes can't probe directly.

### Q14. Liveness vs readiness — give a concrete example of using each correctly.

Take a web API that depends on a database:

- **Liveness** = "is the *process itself* wedged?" Point it at a trivial `/healthz` that just confirms the HTTP server responds — **no DB call**. If the event loop deadlocks or the process hangs, this fails and the kubelet restarts it, which actually fixes the problem.
- **Readiness** = "should this pod get traffic *right now*?" Point it at `/readyz`, which *can* check the DB connection pool, whether the app finished warming, or whether it's over capacity. If the DB is briefly unreachable, the pod fails readiness, is pulled from endpoints (no traffic, no errors served), and **rejoins** automatically when the DB recovers — no restart, no thundering herd.

The rule of thumb: **liveness restarts, readiness reroutes.** Anything that a restart can't fix (a downstream dependency) must never be in liveness; anything transient that just means "don't send me traffic yet" belongs in readiness.

### Q15. A Deployment shows pods as Running but the Service returns no responses. How do you debug?

`Running` means the container process is up; it does **not** mean the pod is in the Service's endpoints. The usual culprit is readiness (or label mismatch). Work the chain:

```bash
# 1. Are pods actually Ready (not just Running)? READY column = ready/total containers
kubectl get pods -o wide
# 2. Does the Service have any endpoints? Empty => nothing to route to
kubectl get endpointslices -l kubernetes.io/service-name=alice-app
kubectl describe svc alice-app        # check selector
# 3. Why aren't pods ready? readiness probe failing?
kubectl describe pod <pod>            # Events: "Readiness probe failed..."
```

Common findings: the **readiness probe is failing** (wrong path/port, too-tight `timeoutSeconds`, or a dependency check that never passes), so pods are `Running` but `0/1 READY` and excluded from endpoints; or the **Service selector doesn't match** the pod labels, so endpoints are empty regardless of readiness; or a **NetworkPolicy** is blocking the traffic. `kubectl get endpointslices` empty vs populated instantly tells you whether it's a readiness/selector problem (empty) or a routing/network problem (populated but unreachable).

### Q16. How do probes, PDBs, and preStop hooks work together during a node drain?

A `kubectl drain` (for maintenance/upgrade) is a **voluntary disruption**, and all three cooperate to keep it non-disruptive:

1. The **PDB** gates the eviction: the drain evicts pods via the eviction API, which refuses to take a pod down if doing so would drop below `minAvailable`. So pods are evicted gradually, never all at once, keeping capacity up.
2. Each evicted pod goes through normal termination: **endpoint removal** starts, the **preStop sleep** holds off SIGTERM until that propagates, then the app **gracefully shuts down** within the grace period — so in-flight requests finish and no new ones are dropped.
3. Meanwhile the Deployment schedules replacements on other nodes, and their **readiness probes** ensure they only receive traffic once actually serving — so total ready capacity stays at or above the PDB floor throughout.

Miss any one and the drain hurts: no PDB → all replicas evicted together (outage); no preStop/graceful shutdown → 502s as pods drain; no readiness probe → traffic to not-yet-ready replacements. Together they make node upgrades invisible to users.
## Observability & Debugging

### Summary

**What this topic covers**

How you find out what a cluster is actually doing — and how you dig a stuck workload out of the mud when the reconciliation loop isn't giving you what you asked for. Three concern areas: (1) the **hands-on debugging toolkit** — the `kubectl` verbs (`get`, `describe`, `logs`, `exec`, `port-forward`, `cp`, `top`, `debug`, `events`) and which one answers which question; (2) the **telemetry pillars** — logs, metrics, and traces, plus the cluster-level infrastructure you need because pod-local data evaporates when pods die; and (3) the **methodology** — golden signals, USE/RED, and the repeatable "how would you debug X" flow that separates someone who pattern-matches from someone who guesses. The 16 questions in this topic move from "how do I read logs" to "a pod is CrashLooping on a distroless image with no shell — get me inside."

**Mental model**

Kubernetes is a control loop, so debugging is *comparing desired state to actual state and finding where the loop stalled.* Every object has a `.spec` (what you asked for) and a `.status` (what the controllers achieved). `kubectl describe` is your primary instrument because it prints both plus the **Events** stream — the running commentary of the scheduler, kubelet, and controllers explaining their decisions. Most "why won't this start" answers are sitting in `describe` events: `FailedScheduling`, `ImagePullBackOff`, `FailedMount`, `Unhealthy`. Above the single-object view sits the telemetry plane: containers write to stdout/stderr, the kubelet captures it, but that's node-local and mortal — so you ship it somewhere durable. Metrics are sampled counters and gauges scraped over time. Traces stitch a single request across services. The senior instinct is to reach for `describe`/events *first*, treat logs as second, and only shell into a container when the declarative layer has run out of things to tell you.

**Key terms**

- **Events** — namespaced, time-limited (default ~1h TTL) records emitted by components; the "why" behind most failures. `kubectl get events` or the bottom of `describe`.
- **kubectl describe** — human-readable dump of spec + status + events for one object; first stop for almost every incident.
- **kubectl logs** — container stdout/stderr; `-f` to follow, `--previous`/`-p` for the last crashed container, `-c` to pick a container in a multi-container pod.
- **kubectl exec** — run a process inside a running container (`-it -- sh`); requires a shell in the image.
- **Ephemeral / debug container** — a temporary container injected into a running pod via `kubectl debug`; how you get tooling into a distroless or crashlooping pod.
- **metrics-server** — lightweight cluster aggregator that powers `kubectl top` and the HPA; not a monitoring system, no history.
- **Prometheus** — pull-based time-series monitoring; scrapes `/metrics` endpoints, stores samples, evaluates alert rules via PromQL.
- **kube-state-metrics** — exposes cluster *object* state (deployment replicas, pod phase) as metrics; distinct from **node-exporter** (host CPU/mem/disk) and **cAdvisor** (per-container resource usage, built into kubelet).
- **Golden signals** — latency, traffic, errors, saturation (the four you alert on).
- **USE / RED** — USE (Utilization, Saturation, Errors) for resources; RED (Rate, Errors, Duration) for request-driven services.
- **Log aggregator** — cluster-level pipeline (Fluent Bit/Fluentd → Loki/Elasticsearch/OpenSearch) that persists logs off-node so they survive pod death.

**Why interviewers ask this**

Observability is where "I've read the docs" and "I've carried the pager" diverge. A junior answer to "the pod won't start" is `kubectl logs`; a senior answer is `kubectl describe pod` first, because a pod that never started has no logs — the failure is in the events (image pull, scheduling, volume mount). Interviewers probe whether you understand that **pod logs are ephemeral** and therefore whether you've actually run a real cluster, where the first outage teaches you that `kubectl logs` returns nothing on the pod that already died. They want to see a methodology, not a grab-bag of commands: do you narrow scope (cluster → node → pod → container), do you correlate a latency spike (metric) with an error log and a trace, and do you know the difference between debugging a pod that *won't start* versus one that starts and *misbehaves*. Naming the golden signals and knowing metrics-server ≠ Prometheus are cheap senior signals.

**Common confusions**

- "Just check the logs" — a pod stuck `Pending` or `ImagePullBackOff` has no application logs; the answer is in `describe`/events, not `logs`.
- "metrics-server is my monitoring" — it's a short-lived aggregator for `top`/HPA with no storage and no history; it is not Prometheus.
- "`kubectl logs` shows me the crash" — after a restart you need `--previous` to see the container that actually died; the current one may be a fresh healthy retry.
- "I'll just exec in" — distroless/scratch images have no shell; `exec` fails and you need `kubectl debug` with an ephemeral container instead.
- "node-exporter and kube-state-metrics are the same" — one measures the *host* (CPU/mem), the other measures *Kubernetes object state* (replica counts, pod phase). You usually run both.
- "Events are permanent" — they're namespaced and expire (~1h); if you didn't capture them, they're gone. Ship them to your aggregator.

**What follows from this topic**

Observability is the lens over everything else. Debugging a `Pending` pod pulls in **Scheduling & Resources** (requests, taints, affinity); an `ImagePullBackOff` pulls in registries and secrets; a failing readiness probe pulls in **Networking** (is the Service routing to a not-ready pod?). Metrics feed the **HPA** and capacity planning; the golden signals inform your **rollout** safety (do you halt a canary on error-rate?). And the "logs vanish when pods die" lesson is the direct motivation for treating pods as cattle in the first place. If you can't see the cluster, every other topic is guesswork.

### Q1. A pod isn't running — what's your first command and why?

`kubectl describe pod <name>` — not `logs`.

`describe` prints the spec, the current `.status`, the container states, and — critically — the **Events** at the bottom. A pod that isn't running usually never started a container, so there are no application logs to read. The reason lives in the events:

- `FailedScheduling` → no node fits (resources, taints, affinity, PVC unbound).
- `ImagePullBackOff` / `ErrImagePull` → bad image name, private registry without a pull secret.
- `CrashLoopBackOff` → container starts then exits; *now* you go to `logs --previous`.
- `FailedMount` / `FailedAttachVolume` → PVC/CSI problem.
- `Unhealthy` → a probe is failing.

```bash
kubectl describe pod my-app-7d9f-abcde
kubectl get events --sort-by=.lastTimestamp    # cluster-wide event stream
```

The discipline: read the declarative state and the events *first*, because the control plane already told you why it couldn't reconcile.

### Q2. Walk me through the kubectl commands you reach for during an incident.

The core toolkit, roughly in order of use:

- `kubectl get pods -o wide` — phase, restarts, node, IP at a glance. High `RESTARTS` is a red flag.
- `kubectl describe <obj>` — spec + status + events; explains most failures.
- `kubectl logs <pod> [-f] [--previous] [-c container]` — application output.
- `kubectl exec -it <pod> -- sh` — poke around inside a running container.
- `kubectl port-forward <pod> 8080:8080` — hit a pod directly from your laptop, bypassing the Service, to isolate whether the problem is the app or the routing.
- `kubectl cp <pod>:/path ./local` — pull a heap dump / config out.
- `kubectl top pod/node` — live CPU/memory (needs metrics-server).
- `kubectl debug` — attach an ephemeral toolbox container or debug a node.
- `kubectl events` — the dedicated events view with better filtering than `get events`.

The mental grouping: `get`/`describe`/`events` observe declaratively; `logs` reads output; `exec`/`debug`/`port-forward`/`cp` are hands-on intrusions you escalate to when the declarative layer is exhausted.

### Q3. Why are Events so important, and what are their limitations?

Events are the control plane narrating its own decisions — the scheduler saying "no node fit," the kubelet saying "image pull failed" or "liveness probe failed, restarting," a controller saying "scaled ReplicaSet." They answer *why* an object is in its current state, which is exactly what you need in an incident.

Two limitations that bite:

1. **They're namespaced.** `kubectl get events` only shows the current namespace's events; add `-A`/`--all-namespaces` or you'll miss cluster-scoped drama.
2. **They expire.** Events have a TTL (default ~1 hour). If the incident happened overnight and nobody captured them, they're gone. This is the direct argument for shipping events into your logging/aggregation stack (e.g. an event exporter → Loki) so post-mortems have data.

```bash
kubectl get events -A --sort-by=.lastTimestamp
kubectl events --for pod/my-app-abcde     # events scoped to one object
```

### Q4. Explain how logging works in Kubernetes and why you need a cluster-level solution.

At the base level: a container writes to **stdout/stderr**, the container runtime redirects that to a file on the node, and the kubelet exposes it via `kubectl logs`. That's the whole native story — and it's node-local and ephemeral.

The problem: **when a pod dies, its logs die with it** (or after a rotation/eviction). Pods are cattle — they get rescheduled, OOMKilled, drained during a node upgrade — so any log you actually care about will eventually be on a pod that no longer exists. `kubectl logs` is fine for live debugging and useless for "what happened at 3am."

So you run a **cluster-level aggregation pipeline**:

- A **node-level agent** as a DaemonSet — **Fluent Bit** (lightweight) or Fluentd — tails every container's log files.
- Ships to a **durable backend** — **Loki** (label-indexed, cheap, Grafana-native), **Elasticsearch/OpenSearch** (full-text, the ELK/EFK stack), or a managed service (CloudWatch, Cloud Logging).
- You query historical logs there, across all pods and restarts, long after the pod is gone.

The senior point: application code should just log to stdout as structured JSON and stay ignorant of where logs go — the platform owns collection.

### Q5. What's the difference between metrics-server and Prometheus?

They solve different problems and people constantly conflate them.

| | metrics-server | Prometheus |
|---|---|---|
| Purpose | Feed `kubectl top` and the HPA/VPA | Real monitoring, alerting, dashboards |
| Data | Live CPU/mem, current only | Full time-series history |
| Storage | None (in-memory, ~last scrape) | TSDB with retention |
| Query | None (API only) | PromQL |
| Scope | Resource metrics API | Anything exposing `/metrics` |

**metrics-server** is a small aggregator that pulls resource usage from each kubelet and exposes the Metrics API. Without it, `kubectl top` and CPU-based HPAs don't work. It has no history — ask it "what was memory an hour ago" and it can't answer.

**Prometheus** is a pull-based monitoring system: it scrapes `/metrics` endpoints on a schedule, stores samples in its TSDB, and lets you write PromQL alerts and Grafana dashboards. This is your actual observability backbone. You run *both* — metrics-server for the HPA loop, Prometheus for humans.

### Q6. How does Prometheus discover and scrape targets in Kubernetes?

Prometheus is **pull-based**: it fetches `/metrics` from targets on an interval, rather than targets pushing to it. In Kubernetes it uses the API server for **service discovery** — it watches pods, services, and endpoints and scrapes whatever matches its config.

With the **Prometheus Operator** you don't hand-edit scrape config; you declare intent as CRDs:

- **ServiceMonitor** — "scrape the pods behind Services matching these labels, on this port/path." The operator translates it into Prometheus scrape config.
- **PodMonitor** — same idea but selects pods directly.
- **PrometheusRule** — alerting/recording rules as a CRD.

The three metric sources you'll be asked to distinguish:

- **kube-state-metrics** — Kubernetes *object* state: desired vs available replicas, pod phase, deployment conditions, PVC status. "Is the cluster in the shape I declared?"
- **node-exporter** — *host* metrics: node CPU, memory, disk, filesystem, network. Runs as a DaemonSet.
- **cAdvisor** — *per-container* resource usage, built into the kubelet, exposed at `/metrics/cadvisor`.

You typically scrape all three plus your apps' own instrumentation.

### Q7. What are the four golden signals, and how do you apply USE and RED to Kubernetes?

The **four golden signals** (Google SRE) are what you alert on for any user-facing service:

- **Latency** — how long requests take (split success vs error latency).
- **Traffic** — demand (requests/sec, connections).
- **Errors** — rate of failed requests (5xx, timeouts).
- **Saturation** — how full the system is (CPU, memory, queue depth) — your leading indicator of trouble.

Two complementary frameworks:

- **RED** — *Rate, Errors, Duration* — for request-driven services. Applied per Deployment/Service: request rate, error rate, and p50/p95/p99 latency. This is your app-level dashboard.
- **USE** — *Utilization, Saturation, Errors* — for resources. Applied to nodes and pods: CPU/memory utilization, throttling/OOM saturation, and hardware/kernel errors.

In practice: RED tells you *the service is hurting*; USE tells you *the resource that's causing it*. A p99 latency spike (RED) that correlates with CPU throttling on the pods (USE) points straight at a too-low CPU limit.

### Q8. A container is CrashLooping on a distroless image with no shell. How do you get inside?

`kubectl exec` won't help — there's no `sh` to exec, and the container keeps restarting anyway. This is exactly what **ephemeral debug containers** are for.

```bash
kubectl debug -it my-app-abcde \
  --image=busybox:1.36 \
  --target=my-app \
  -- sh
```

`kubectl debug` injects a *new* temporary container into the running pod. Because containers in a pod share network and (with `--target`) the process namespace, your busybox/netshoot toolbox can inspect the crashing container's processes, hit `localhost`, check env, and probe the network — even though the app image itself has nothing in it.

For a pod that's already fully dead/crashlooping, use `--copy-to` to spin up a copy with the entrypoint overridden so it *doesn't* crash, then inspect it:

```bash
kubectl debug my-app-abcde --copy-to=my-app-debug \
  --container=my-app --image=busybox --set-image=my-app=busybox -- sleep 1d
```

Ephemeral containers are the modern, sanctioned answer to "the image is minimal and I can't get a shell." Distroless images are a security win; `kubectl debug` is how you keep them debuggable.

### Q9. How do you debug a problem at the node level — not the pod?

Two angles.

**`kubectl debug node/...`** gives you a privileged debug pod on a specific node with the host filesystem mounted at `/host`:

```bash
kubectl debug node/ip-10-0-1-23 -it --image=busybox
# inside: chroot /host, then run host tools — check kubelet, disk, dmesg
```

This is how you inspect a node without SSH: look at `df` (disk pressure), `dmesg` (OOM killer, kernel), kubelet logs, and container runtime state.

**Standard node triage** without a debug pod:

```bash
kubectl get nodes                          # Ready / NotReady / SchedulingDisabled
kubectl describe node ip-10-0-1-23         # conditions: MemoryPressure, DiskPressure, PIDPressure; allocatable vs allocated
kubectl top node                           # live utilization
```

Node conditions are the tell: `DiskPressure` triggers image GC and eviction; `MemoryPressure` triggers pod eviction; `NotReady` usually means the kubelet lost contact with the API server or the container runtime is wedged. If pods on one node all misbehave, suspect the node, cordon it (`kubectl cordon`), drain it (`kubectl drain --ignore-daemonsets`), and let the scheduler reschedule.

### Q10. What's your approach when a *running* pod is misbehaving (vs one that won't start)?

Different failure class, different playbook.

**Won't start** → the problem is in the reconciliation/lifecycle: scheduling, image pull, volume mount, init container, failing startup probe. You live in `describe`/events.

**Starts but misbehaves** (slow, wrong responses, intermittent 500s) → the app is running, so the declarative layer looks healthy and you shift to telemetry:

1. **Metrics** — is it saturated? `kubectl top pod`; check the RED dashboard (error rate, latency) and USE (CPU throttling, memory near limit, OOM restarts).
2. **Logs** — `kubectl logs -f`, and `--previous` if it's been restarting under the radar. Look for stack traces, timeouts, connection resets.
3. **Isolate the layer** — `kubectl port-forward` straight to the pod. If it's healthy directly but broken via the Service, the problem is routing/endpoints/readiness, not the app.
4. **Dependencies** — DNS resolution, downstream service reachability, DB connections. `kubectl exec`/`debug` to test from inside the pod's network.
5. **Correlate** — line up the latency spike (metric), the error log, and the trace to find the actual culprit rather than the symptom.

The senior move is stating *which* class of problem you're in first, because it tells you whether to open `describe` or open Grafana.

### Q11. Why does structured (JSON) logging matter in Kubernetes?

Because logs from hundreds of pods land in one aggregated stream, and you need to slice them by fields, not grep prose.

Plain-text logs (`ERROR something bad happened`) are murder to query at scale — you can't reliably filter by request ID, user, status code, or latency. **Structured logs** emit each line as JSON:

```json
{"ts":"2026-07-01T10:00:00Z","level":"error","msg":"upstream timeout","trace_id":"abc123","route":"/checkout","status":504,"latency_ms":3001}
```

Now your aggregator (Loki, Elasticsearch) indexes those fields and you can query `status=504 AND route=/checkout` or pivot on `trace_id` to jump from a log to its full trace. It also plays nicely with the platform: the app logs JSON to stdout, Fluent Bit ships it, the backend parses it, and correlation across pillars becomes trivial. The rule of thumb: **log to stdout, as structured JSON, and include a trace/correlation ID** — everything downstream gets easier.

### Q12. What is distributed tracing and when do you need it?

Metrics tell you *a* service is slow; logs tell you *what one pod* did; **tracing tells you where the time went across a whole request** as it fans out through microservices.

A trace is a tree of **spans**, each span a unit of work (an HTTP handler, a DB query, a downstream call) tagged with a shared **trace ID** propagated via headers (W3C `traceparent`). When a checkout request touches gateway → auth → cart → payments → DB, the trace shows the latency contribution of each hop, so a "checkout is slow" complaint resolves to "payments' DB call is taking 2s."

- **OpenTelemetry** is the vendor-neutral standard for instrumentation and propagation; you export to **Jaeger**, **Tempo**, or a SaaS.
- You need it once you have more than a couple of services calling each other — in a monolith, a profiler suffices; in a mesh of pods, tracing is the only way to attribute latency.
- A **service mesh** (Istio/Linkerd) can generate spans automatically at the sidecar, though app-level instrumentation gives richer, business-aware spans.

### Q13. How do metrics, logs, and traces correlate, and why does that matter?

They're the **three pillars of observability**, and their value multiplies when linked rather than used in isolation:

- **Metrics** — cheap, aggregate, always-on. Great for alerting and "is something wrong," bad for "why."
- **Logs** — detailed, per-event. Great for "what exactly happened," expensive at volume.
- **Traces** — per-request causal path across services. Great for "where in the call graph."

The workflow that makes this powerful: an **alert fires on a metric** (p99 latency up) → you pivot to the **trace** to see which service/span owns the latency → you jump from that span to the **logs** of that specific pod and request via a shared **trace ID**. Modern stacks wire this together (Grafana linking Prometheus → Tempo → Loki through the `trace_id` label). The enabling discipline is putting a **correlation/trace ID** into your structured logs and propagating it in headers — without it, the three pillars are three disconnected silos and every investigation starts from scratch.

### Q14. What role do dashboards and alerting play, and what makes a good alert?

**Dashboards (Grafana)** are for humans exploring — the RED view per service, USE view per node, cluster capacity, rollout health. They're for investigation and situational awareness, *not* for catching problems (nobody watches a screen at 3am).

**Alerting** is what actually pages you. In a Prometheus stack, **Alertmanager** takes rules evaluated by Prometheus (PromQL `PrometheusRule` CRDs) and handles routing, grouping, deduplication, silencing, and escalation to PagerDuty/Slack.

What makes a good alert:

- **Symptom-based, not cause-based** — alert on "error rate > 2% for 5m" (a golden signal users feel), not on "CPU > 80%" (which may be fine). Cause metrics belong on dashboards.
- **Actionable** — every page implies a human action; if there's nothing to do, it's noise and it trains people to ignore pages.
- **Has a `for` duration** — require the condition to hold (e.g. 5m) to avoid flapping on transient blips.
- **Tied to SLOs / error budgets** — page when you're burning error budget fast, not on every transient spike.

Alert fatigue kills on-call; the goal is few, meaningful pages.

### Q15. Walk me through debugging an intermittent 502/503 coming from a Service.

Intermittent means *some* backends are bad, which points at the Service→endpoints→pod path rather than the app being uniformly broken.

1. **Check endpoints.** `kubectl get endpointslices -l kubernetes.io/service-name=my-svc` — are all expected pods listed and *ready*? A pod failing its **readiness probe** is silently removed from the endpoint set; if readiness is flapping, the Service oscillates between routing and not routing to it.
2. **Check pod health spread.** `kubectl get pods -o wide` — is one pod restarting or on a bad node? Intermittent often = one unhealthy replica in rotation.
3. **Bypass the Service.** `kubectl port-forward` to each pod individually. Healthy direct but 5xx via Service → routing/readiness. Broken direct on one pod → that replica.
4. **Probe config.** A too-aggressive liveness probe restarts pods mid-request; a readiness probe that lags real health flaps endpoints. Check `describe` for `Unhealthy` events.
5. **Rollout timing.** During a rolling update, if `readinessProbe` is missing or too loose, the Service sends traffic to pods that aren't actually ready — classic source of transient 502s. Also check `terminationGracePeriod` / `preStop` — pods killed before draining connections cause 502s on scale-down.

The theme: intermittent Service errors are usually a **readiness/endpoint** story, not an application-logic story.

### Q16. What is `kubectl top`, what does it require, and what are its limits?

`kubectl top pod` / `kubectl top node` shows live CPU and memory usage — the quick "what's hot right now" check.

```bash
kubectl top nodes
kubectl top pods -A --sort-by=memory
kubectl top pod my-app-abcde --containers   # per-container breakdown
```

Requirements and caveats:

- **Needs metrics-server** installed; without it you get `error: Metrics API not available`. Managed clusters (GKE/EKS/AKS) often ship it or need it enabled.
- **No history** — it's the current snapshot only. "Was it OOM'd an hour ago?" → go to Prometheus, not `top`.
- **CPU is instantaneous** and can look spiky; don't autoscale decisions off a single reading.
- It reads from cAdvisor via the kubelet, so it reflects **actual usage**, which you compare against **requests/limits** to spot a pod throttling (near CPU limit) or heading for OOM (near memory limit).

Use `top` for a fast pulse; use Prometheus + Grafana for anything involving trends, alerting, or capacity planning.

## Networking Deep Dive

### Summary

**What this topic covers**

How a packet actually gets from one pod to another, from the flat network model up through DNS, Service VIPs, policy, and the mesh. Three concern areas: (1) the **model and its plumbing** — the flat-IP rules Kubernetes mandates and the CNI plugins that implement them; (2) **discovery and routing** — CoreDNS, how a Service's virtual IP is realized by kube-proxy or eBPF, and EndpointSlices; and (3) the **policy and mesh layers** — NetworkPolicies for segmentation and service meshes for mTLS, traffic management, and observability, plus the sober judgment of when a mesh is *not* worth it. The 15 questions in this topic run from "what IP does a pod get" to "DNS resolution is intermittently failing under load — diagnose it."

**Mental model**

Kubernetes deliberately mandates a **flat network**: every pod gets its own routable IP, and any pod can reach any other pod *without NAT*, as if they were VMs on one big L2/L3 network. Kubernetes itself doesn't implement this — it defines the contract and delegates to a **CNI plugin**. So the mental split is: the *model* is fixed and simple; the *implementation* (overlay vs native routing, iptables vs eBPF) is a pluggable choice with real performance and feature consequences. On top of that flat pod network sit two abstractions. **DNS** (CoreDNS) turns stable names into IPs, because pod IPs churn. A **Service** is a *virtual* IP — no process listens on it; it's a load-balancing rule installed on every node (by kube-proxy or eBPF) that DNATs to a real pod IP chosen from the Service's EndpointSlices. Once you internalize "Service IP is a rule, not a host," most networking questions unlock.

**Key terms**

- **Pod IP** — every pod gets one cluster-routable IP; containers in a pod share it (same netns).
- **CNI** — Container Network Interface; the plugin API the kubelet calls to wire a pod's networking (IP allocation, routes). Implemented by Calico, Cilium, Flannel, AWS VPC CNI.
- **Overlay vs native routing** — overlay (VXLAN/IP-in-IP) encapsulates pod traffic to cross node boundaries; native routing puts pod IPs directly in the underlying network's routing table (no encap, lower overhead).
- **CoreDNS** — the cluster DNS server; resolves Service and pod names, runs as a Deployment behind a Service.
- **kube-proxy** — per-node agent that programs iptables or IPVS rules to realize Service VIPs; being replaced by eBPF in Cilium.
- **Service VIP (ClusterIP)** — stable virtual IP fronting a set of pods; DNAT'd to a pod IP per connection.
- **EndpointSlice** — scalable list of the ready backend IPs/ports for a Service (replaced monolithic Endpoints).
- **NetworkPolicy** — namespaced firewall rules selecting pods by label; **enforced only if the CNI supports it**.
- **east-west vs north-south** — pod-to-pod traffic inside the cluster vs traffic entering/leaving it (via Ingress/LoadBalancer).
- **Service mesh** — sidecar (Istio/Linkerd) or sidecar-less/eBPF (Cilium/Istio ambient) layer adding mTLS, traffic management, and telemetry to pod-to-pod calls.
- **ndots:5** — the resolv.conf setting that makes short names try several search-domain suffixes first, a common DNS-latency source.
- **NodeLocal DNSCache** — a per-node DNS cache DaemonSet that cuts CoreDNS load and conntrack/latency issues.

**Why interviewers ask this**

Networking is where Kubernetes abstractions get abused as magic and where production outages hide. Interviewers want to know whether you understand that a **Service IP isn't a machine** — juniors think traffic goes *to* the ClusterIP; seniors know it's a DNAT rule on the node kernel and can therefore reason about why a Service works but pod-to-pod doesn't, or vice versa. They probe DNS because DNS-related latency (the `ndots:5` five-lookup tax) is one of the most common and most misdiagnosed Kubernetes performance problems, and knowing NodeLocal DNSCache signals real operational scars. NetworkPolicy questions test whether you know it's *default-allow* and *CNI-dependent* — a policy that does nothing because Flannel doesn't enforce it is a classic gotcha. And the service-mesh question is really a judgment test: can you articulate the genuine benefits (mTLS, retries, observability) *and* the cost (latency, complexity, operational burden), rather than cargo-culting Istio into a three-service app.

**Common confusions**

- "Traffic goes to the Service" — nothing listens on a ClusterIP; it's a load-balancing rule that rewrites the destination to a real pod IP.
- "NetworkPolicies block by default" — the opposite: all traffic is allowed until a policy selects a pod, then that pod becomes default-deny for the covered direction.
- "Any CNI enforces NetworkPolicy" — only policy-aware CNIs (Calico, Cilium) do; Flannel silently ignores them.
- "kube-proxy load-balances the traffic path" — kube-proxy only *programs the rules* (iptables/IPVS); the kernel does the actual per-packet forwarding. Cilium's eBPF can replace kube-proxy entirely.
- "DNS is instant" — `ndots:5` means a lookup for `api` can fire 4-5 failed queries before the real one; at scale this saturates CoreDNS and adds latency.
- "A mesh is free observability/security" — sidecars add a hop, CPU/memory per pod, and a large operational surface; for a small cluster the complexity often outweighs the benefit.

**What follows from this topic**

Networking underpins nearly everything else. **Services** and **Ingress** are the north-south front door built on this model; **Observability** debugging of intermittent 5xx almost always comes back to endpoints/DNS/readiness; **Security** leans on NetworkPolicies for segmentation and mesh mTLS for encryption-in-transit. The CNI choice constrains what NetworkPolicy and mesh features you even *have*. And the DNS/ndots lesson recurs the moment anyone reports "the app is randomly slow." Get the model right and the rest of the cluster's behavior stops being mysterious.

### Q1. Describe the Kubernetes network model and its core rules.

Kubernetes imposes a deliberately simple, flat model with three hard requirements every conforming network must satisfy:

1. **Every pod gets its own unique, cluster-routable IP.** Not a shared host IP with port juggling — a real IP per pod.
2. **Pods communicate pod-to-pod without NAT.** Pod A sees pod B's real IP, and B sees A's real source IP — no address translation between them.
3. **Agents on a node (kubelet, system daemons) can reach all pods on that node**, and vice versa.

The consequence: pods behave like VMs on one big flat network, which makes application networking simple — no port-mapping gymnastics, no "which host is this on."

Kubernetes **does not implement** this itself. It defines the contract and delegates the actual wiring to a **CNI plugin**. Within a pod, all containers share one network namespace (one IP, same `localhost`), which is why sidecars talk to the main container over `127.0.0.1`. This flat model is the foundation Services, DNS, and NetworkPolicy all build on.

### Q2. What is CNI and what does the kubelet do with it?

**CNI (Container Network Interface)** is the plugin standard for wiring up container networking. When the kubelet creates a pod's sandbox, it calls the configured CNI plugin, which is responsible for:

- **IPAM** — allocating an IP for the pod from the cluster's pod CIDR.
- **Wiring** — creating the veth pair, moving one end into the pod's netns, and setting up routes so the pod's IP is reachable across the cluster.
- **Teardown** — releasing the IP and cleaning up when the pod dies.

The kubelet knows *nothing* about how networking is implemented — it just invokes the plugin binary/daemon per the CNI spec (`ADD`/`DEL`). This is the clean separation: the kubelet owns the pod lifecycle, the CNI owns the network. Swapping Calico for Cilium changes *how* pods get connectivity without changing the kubelet or your workloads. The plugin is what actually delivers the flat-network guarantees from Q1.

### Q3. Compare the common CNI plugins — how do they differ?

The axes that matter: overlay vs native routing, policy support, and the dataplane (iptables vs eBPF).

| Plugin | Dataplane | Networking | NetworkPolicy | Notes |
|---|---|---|---|---|
| **Flannel** | iptables | Overlay (VXLAN) | ✗ (no) | Simplest; no policy enforcement |
| **Calico** | iptables/eBPF | Native routing (BGP) or overlay | ✓ (rich) | The policy workhorse; can go encap-free |
| **Cilium** | eBPF | Native/overlay | ✓ (L3-L7) | eBPF dataplane, can replace kube-proxy, mesh features |
| **AWS VPC CNI** | ENI | Native (real VPC IPs) | via Calico add-on | Pods get VPC IPs; ties into SGs, IP exhaustion risk |

The distinctions to name:

- **Overlay vs native routing** — overlay (Flannel VXLAN) encapsulates pod packets to tunnel across nodes; simple, works anywhere, but adds encap overhead and MTU headaches. Native routing (Calico BGP, AWS VPC CNI) puts pod IPs directly in the network fabric — faster, but needs the underlay to cooperate.
- **eBPF** (Cilium) — programs the Linux kernel dataplane directly instead of maintaining thousands of iptables rules; better performance at scale, richer observability, and it can subsume kube-proxy.
- **Policy** — Flannel can't enforce NetworkPolicy at all; Calico/Cilium can, and Cilium extends to L7.

### Q4. How does DNS work in a cluster, and what are the search domains about?

**CoreDNS** runs as a Deployment fronted by a Service (`kube-dns`, a ClusterIP), and every pod's `/etc/resolv.conf` points its `nameserver` at that IP. It resolves:

- **Services** → `my-svc.my-namespace.svc.cluster.local` → the Service's ClusterIP (or, for headless Services, the pod IPs).
- **Pods** and **StatefulSet** stable hostnames.
- External names → forwarded upstream.

The **search domains** let you use short names. A pod's resolv.conf looks like:

```
nameserver 10.96.0.10
search my-ns.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

So `my-svc` from within `my-ns` expands against the search list until it hits `my-svc.my-ns.svc.cluster.local`. That's the convenience that lets same-namespace code just call `http://my-svc`. The catch is the `ndots:5` interaction (next question), which turns that convenience into a latency tax for external lookups.

### Q5. Explain the ndots:5 problem and how you'd fix DNS latency.

`options ndots:5` means: **if a name has fewer than 5 dots, try the search domains first before treating it as absolute.** This makes intra-cluster short names work, but it punishes external lookups.

Resolving `api.example.com` (2 dots, < 5) first tries every search suffix:

```
api.example.com.my-ns.svc.cluster.local   NXDOMAIN
api.example.com.svc.cluster.local          NXDOMAIN
api.example.com.cluster.local              NXDOMAIN
api.example.com                            (finally) A record
```

That's 4-5 queries (and doubled for A + AAAA) per external hostname. At scale this hammers CoreDNS, fills conntrack tables, and adds tail latency — a notoriously misdiagnosed "the app is randomly slow" cause.

Fixes:

- **Fully-qualify external names** with a trailing dot (`api.example.com.`) so the resolver skips the search list.
- **Deploy NodeLocal DNSCache** — a per-node DNS cache (DaemonSet) that answers most queries locally over TCP to CoreDNS, slashing latency and CoreDNS load, and sidestepping a Linux conntrack race on UDP DNS.
- **Tune `ndots`** per-pod via `dnsConfig` for workloads that mostly hit external names.
- **Scale CoreDNS** and enable caching in its Corefile.

### Q6. How is a Service's virtual IP actually implemented?

A ClusterIP is a **virtual IP that nothing listens on** — there's no process, no interface holding it. It's realized as **load-balancing rules installed on every node**.

The classic mechanism is **kube-proxy**, which watches Services and EndpointSlices and programs the node's kernel:

- **iptables mode** — installs DNAT rules; a packet to the ClusterIP is rewritten to a randomly-chosen backend pod IP. Simple, but rule evaluation is O(n) and rules balloon with many Services.
- **IPVS mode** — uses the kernel's L4 load balancer (hash tables), O(1) lookup and real LB algorithms (round-robin, least-conn); better at scale.

The key insight: kube-proxy **only programs rules** — the **kernel** does the per-packet DNAT and forwarding. kube-proxy is not in the data path.

The modern alternative is **Cilium's eBPF**, which programs the dataplane directly and can **replace kube-proxy entirely** — no iptables/IPVS, lower latency, better scaling. Either way, "connecting to a Service" means "the kernel rewrote your destination to a live pod IP from the EndpointSlice."

### Q7. What are EndpointSlices and why did they replace Endpoints?

Both track the **ready backend pod IPs/ports** behind a Service — the list kube-proxy/eBPF DNATs to. The difference is scalability.

The old **Endpoints** object crammed *all* of a Service's backends into a **single object**. For a Service with thousands of pods, every pod change rewrote that one huge object and pushed the entire thing to every node's kube-proxy — a control-plane and network hotspot.

**EndpointSlices** shard the backends across multiple smaller objects (default up to 100 endpoints each). A pod coming or going updates only its slice, so the churn and the watch traffic are bounded. They also carry richer per-endpoint metadata — topology/zone hints (for topology-aware routing), readiness/terminating conditions, and dual-stack address families.

For debugging, this is where you look to answer "is my Service actually pointing at ready pods":

```bash
kubectl get endpointslices -l kubernetes.io/service-name=my-svc
```

If a pod fails readiness, it drops out of the slice and stops receiving traffic — the mechanism behind rolling updates and the intermittent-5xx debugging story.

### Q8. How are NetworkPolicies enforced, and what's the default behavior?

A **NetworkPolicy** is a namespaced, label-selected firewall for pods — "pods with label `app=api` may receive traffic only from pods labeled `app=frontend` on port 8080."

Two things people get wrong:

1. **Default is allow-all.** With no policies, every pod can talk to every other pod. A NetworkPolicy is **additive isolation**: the moment a policy *selects* a pod for a direction (ingress/egress), that pod becomes **default-deny for that direction** and only the listed traffic is permitted. So you achieve zero-trust by adding a default-deny policy per namespace, then allowing specific flows.
2. **Enforcement is the CNI's job.** The API object always accepts — but nothing enforces it unless your CNI is policy-aware. **Calico** and **Cilium** enforce; **Flannel does not**, so your carefully-written policy silently does nothing. This is a brutal gotcha: the manifest applies cleanly and offers zero protection.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: prod
spec:
  podSelector: {}          # all pods in prod
  policyTypes: [Ingress]   # deny all ingress unless another policy allows
```

Cilium extends this to **L7** (HTTP paths/methods) via its own CRDs. Always verify enforcement with a connectivity test, not just `kubectl apply`.

### Q9. What's the difference between east-west and north-south traffic?

A directional vocabulary for reasoning about where traffic flows and where you apply controls.

- **North-south** — traffic crossing the cluster boundary: users → your app (ingress), or your app → external APIs (egress). Handled by **Ingress controllers / Gateway API**, **LoadBalancer** Services, and cloud LBs. This is where TLS termination, WAF, and external auth live.
- **East-west** — traffic *between* pods/services inside the cluster: service A calling service B. This is the pod network + ClusterIP Services, and it's where **NetworkPolicies** and **service-mesh mTLS** apply.

Why it matters: they have different threat models and tools. North-south you guard at the edge (Ingress, cloud firewall, WAF); east-west you guard with segmentation (NetworkPolicy) and encryption/identity (mesh mTLS). Interviewers use the terms to check you can place a control at the right layer — e.g. "encrypt service-to-service traffic" is an east-west mesh/mTLS answer, "block that malicious client" is a north-south edge answer. In microservice architectures east-west volume typically dwarfs north-south, which is exactly why meshes exist.

### Q10. What is a service mesh, and when is it NOT worth the complexity?

A **service mesh** adds a programmable layer to east-west traffic without changing app code, giving you three things: **mTLS** (automatic encryption + workload identity between pods), **traffic management** (retries, timeouts, circuit breaking, canary/weighted routing, fault injection), and **observability** (uniform golden-signal metrics, traces, and topology for every call).

Architecturally:

- **Sidecar model** (Istio classic, Linkerd) — inject a proxy (Envoy/linkerd2-proxy) into every pod; all traffic flows through it. Powerful, but a proxy per pod costs CPU/memory and adds a network hop.
- **Sidecar-less / ambient / eBPF** (Istio ambient, Cilium Service Mesh) — push L4 mTLS into a per-node component and eBPF, with an optional per-namespace L7 proxy. Aims to keep the features while cutting the sidecar tax.

**When it's NOT worth it:** a small cluster with a handful of services. The mesh brings a large operational surface (control plane, cert rotation, upgrades, sidecar lifecycle, debugging an extra proxy in every path) and real latency/resource overhead. If you can get encryption from NetworkPolicy + TLS, retries from your client library, and metrics from Prometheus, a mesh is complexity you'll pay for daily. Reach for it when the *number* of services makes uniform mTLS, traffic policy, and observability impossible to do per-app — not before. "We might need it later" is not a reason to run Istio in a three-service app.

### Q11. How does pod-to-pod traffic cross node boundaries?

Within a node it's trivial — both pods hang off the same virtual bridge/veth setup, so it's local L2/routing. **Across nodes** is where the CNI's design shows:

- **Overlay (VXLAN / IP-in-IP)** — the source node **encapsulates** the pod-to-pod packet inside a node-to-node packet, ships it over the existing network, and the destination node **decapsulates** and delivers it to the target pod. The underlay only ever sees node IPs, so it works on any network — but encapsulation costs CPU and shrinks the usable MTU.
- **Native routing (BGP / cloud VPC)** — pod CIDRs are advertised into the real network's routing table (Calico BGP) or pods get real VPC IPs (AWS VPC CNI), so packets route directly node-to-node with **no encapsulation**. Faster and simpler to trace, but requires the underlay to know the pod routes.

Either way the flat-network contract from Q1 holds: the destination pod sees the real source pod IP with no NAT. When cross-node traffic breaks but same-node works, suspect the overlay (MTU, encapsulation, blocked VXLAN port 4789) or missing routes.

### Q12. What are the MTU issues with overlay networks?

**MTU (Maximum Transmission Unit)** is the largest packet a link carries. Overlays break because **encapsulation adds header bytes**: VXLAN adds ~50 bytes, IP-in-IP ~20. If the underlay MTU is 1500 and the pod interface is also 1500, an encapsulated full-size packet becomes ~1550 — too big.

Symptoms are nasty because it's not a clean failure: small packets (pings, DNS) work fine, but **large transfers hang or are slow** — the classic "TLS handshake works, then the connection stalls on a big response." That's fragmentation or silently dropped oversized packets (especially when Path MTU Discovery is blocked by dropped ICMP "fragmentation needed" messages — a **PMTUD black hole**).

Fixes: set the **pod MTU below the underlay MTU** minus the encap overhead (e.g. pod MTU 1450 for a 1500 underlay with VXLAN), which most CNIs auto-detect but can get wrong on clouds with jumbo frames or nested networking. On clouds supporting **jumbo frames** (9000 MTU), raise the underlay so the overhead disappears. The debugging tell: intermittent hangs on large payloads while small requests succeed → suspect MTU before you suspect the app.

### Q13. What is dual-stack networking and when do you need IPv6?

**Dual-stack** means pods and Services get **both an IPv4 and an IPv6 address** simultaneously, and can communicate over either family.

You configure it cluster-wide (the CNI, kube-proxy, and API server must support it) with dual pod and service CIDRs, then per-Service choose the families and policy:

```yaml
spec:
  ipFamilyPolicy: PreferDualStack   # or RequireDualStack / SingleStack
  ipFamilies: [IPv4, IPv6]
```

When you actually need it:

- **IPv4 exhaustion at scale** — large clusters (especially AWS VPC CNI, where every pod consumes a real VPC IP) run out of RFC1918 space; IPv6's vast address space removes the constraint.
- **IPv6-native environments** — telco, edge, or org mandates requiring IPv6 reachability.
- **External IPv6 clients** that must reach workloads without NAT64.

For most clusters single-stack IPv4 is simpler and sufficient — dual-stack adds configuration and testing surface (every policy, Service, and probe now has two families). Adopt it when address exhaustion or an external IPv6 requirement forces the issue, not by default.

### Q14. DNS resolution is intermittently failing under load. How do you diagnose it?

Intermittent DNS-under-load is a signature problem; work it systematically.

1. **Confirm it's DNS, not the app.** From inside a pod, `kubectl exec ... -- nslookup my-svc` and try both a cluster name and an external name. Test the pod IP directly (bypassing DNS) — if that works, it's resolution.
2. **Check CoreDNS health.** `kubectl -n kube-system get pods -l k8s-app=kube-dns`, `kubectl logs` for SERVFAIL/throttling, and `kubectl top` — is CoreDNS CPU-saturated or getting OOMKilled? Under load, too few CoreDNS replicas is a common cause.
3. **Suspect the ndots tax.** Heavy external lookups × `ndots:5` = 5× query amplification hammering CoreDNS. Check whether hot paths use short names.
4. **conntrack / UDP race.** The classic Linux kernel race on UDP DNS via DNAT causes ~5s timeout stalls under load. The fix is **NodeLocal DNSCache** (moves queries to TCP + local cache) — its presence/absence is the biggest lever.
5. **Scale and cache.** Add CoreDNS replicas (or the cluster-proportional autoscaler), raise its cache TTL, and deploy NodeLocal DNSCache.

The senior answer names **NodeLocal DNSCache** and the **conntrack UDP race** — that's the specific, battle-tested root cause behind "DNS randomly times out under load."

### Q15. A Service works but direct pod-to-pod communication doesn't (or vice versa). What does each tell you?

The two paths exercise different layers, so which one breaks localizes the fault.

**Service works, pod-to-pod fails** — unusual, since Services *depend* on pod connectivity, but it points at: a **NetworkPolicy** allowing traffic to the Service's port but not the direct path you tried, or you're targeting a wrong/stale pod IP, or the app only binds on the Service-advertised port. Effectively the routing rule is fine; the specific pod-to-pod flow is filtered.

**Pod-to-pod works, Service fails** — the far more common case, and it isolates the fault to the **Service abstraction**, not the pod network:

- **Empty/stale EndpointSlice** — the selector doesn't match any *ready* pods (label typo, or all pods failing readiness). `kubectl get endpointslices` shows no endpoints. The single most common cause.
- **Port mismatch** — Service `targetPort` doesn't match the container's actual listening port.
- **kube-proxy broken** — rules not programmed on that node (kube-proxy crashed, or an eBPF/kube-proxy config conflict). `kubectl -n kube-system get pods -l k8s-app=kube-proxy`.
- **DNS** — the name won't resolve even though the pod IP is reachable.

The diagnostic value: **pod-to-pod reachable but the Service isn't → skip the CNI, go straight to selectors, readiness, endpoints, and kube-proxy.** That single split saves you from debugging the wrong layer.

## Helm, Kustomize & Config Management

### Summary

**What this topic covers**

How you take a wall of YAML and make it maintainable, environment-aware, and deployable without a human running `kubectl apply` from a laptop. Three concern areas: (1) the **config problem** — why raw manifests don't scale across dev/staging/prod; (2) the **two dominant tools** — Helm (templating + packaging) and Kustomize (template-free overlays), their tradeoffs, and when to use which (or both); and (3) **GitOps** — putting declarative desired state in Git as the single source of truth and letting a controller (ArgoCD/FluxCD) reconcile the cluster to it, plus the sub-problems that follow: secrets, promotion, rollbacks, and manifest testing. The 15 questions in this topic run from "what is a Helm chart" to "design a GitOps promotion pipeline with secrets across three environments."

**Mental model**

Start from the pain: a real app is dozens of manifests (Deployment, Service, Ingress, ConfigMap, HPA, RBAC), and you need slightly different versions per environment — more replicas in prod, a different image tag in staging, a different hostname. Copy-pasting YAML per environment is how drift and 3am mistakes happen. The two philosophies to fix this are **templating** and **overlays**. **Helm** treats manifests as **Go templates** filled from `values.yaml`, and packages the result as a versioned, redistributable **chart** with release history and rollback — powerful, but you're now templating whitespace-sensitive YAML, which is error-prone. **Kustomize** keeps manifests as **plain valid YAML** and layers environment-specific **patches** on top of a shared **base** — no templating language, but less power for complex parameterization and packaging. Layer **GitOps** over either: instead of pushing changes *to* the cluster, you commit desired state to Git and a controller *pulls* and reconciles continuously — so Git is the source of truth, the cluster self-heals toward it, and every change is a reviewable, revertable commit.

**Key terms**

- **Chart** — a Helm package: templated manifests + `values.yaml` + metadata (`Chart.yaml`), versioned and shareable via a repository.
- **values.yaml** — a chart's default parameters; overridden per-install with `--set` or `-f overrides.yaml`.
- **Release** — a deployed instance of a chart in a cluster; Helm tracks its **revision history** for `rollback`.
- **Subchart / dependency** — a chart pulled in as a building block (e.g. bundling a Redis chart) declared in `Chart.yaml`.
- **Helm hooks** — lifecycle points (pre-install, post-upgrade) to run Jobs like migrations.
- **Base / overlay** — Kustomize's shared manifests (base) and per-environment directories (overlays) that patch them.
- **Strategic merge vs JSON patch** — Kustomize's two patch styles: merge YAML fragments by field, or apply precise RFC6902 operations.
- **GitOps** — Git as the single source of truth for desired state; a controller reconciles the cluster to match, with drift detection.
- **ArgoCD / FluxCD** — the two GitOps controllers; pull-based reconcilers running *in* the cluster.
- **Sync wave / app-of-apps** — ordering hints for resource sync, and a pattern where one ArgoCD Application manages many others.
- **Sealed Secrets / SOPS / External Secrets** — the three ways to keep secrets out of plaintext Git.
- **Drift** — divergence between the live cluster and Git; GitOps detects and (optionally) auto-corrects it.

**Why interviewers ask this**

This topic separates "I can `kubectl apply` a YAML file" from "I run a fleet across environments safely." Interviewers want to hear that you understand the **problem** before the tool — that the real issue is environment variance and drift, not "which templating engine." They probe Helm-vs-Kustomize because a strong answer is *nuanced* ("Helm for packaging/distribution and complex parameterization, Kustomize for owning your own manifests cleanly, often both together") rather than tribal. GitOps is the big senior signal: can you explain **why pull-based reconciliation from Git beats `kubectl apply` from CI** — auditability, drift correction, revert-by-Git, no cluster credentials in CI — and can you handle the awkward parts (secrets don't belong in Git in plaintext; promotion across environments; rollbacks). Getting the **secrets-in-GitOps** question right (Sealed Secrets/SOPS/External Secrets) is a concrete "I've actually built this" tell, because it's the first wall everyone hits.

**Common confusions**

- "Helm vs Kustomize is either/or" — they compose; a common pattern is Kustomize patching a Helm-rendered base, or Helm for third-party charts + Kustomize for your own apps.
- "Helm needs Tiller" — **Helm 3 removed Tiller**; it's now a client-side binary using your kubeconfig, no in-cluster server component.
- "GitOps is just CI running kubectl" — no; GitOps is a controller *in the cluster pulling* from Git and continuously reconciling, which gives drift detection and self-healing that push-CI can't.
- "Just commit the Secret to Git" — plaintext Secrets in Git leak; you need Sealed Secrets, SOPS-encrypted values, or External Secrets pulling from a vault.
- "Kustomize templates YAML" — it doesn't; it's template-*free*, patching plain valid YAML. No `{{ }}`.
- "Rollback means re-run the pipeline" — in GitOps you `git revert` and the controller reconciles back; in Helm you `helm rollback` to a prior revision.

**What follows from this topic**

Config management is the delivery layer over everything else in the primer. The manifests you're templating are the **Deployments, Services, and RBAC** from earlier topics; the **secrets** question ties into Security; the **rollout** behavior (surge/unavailable, canary) is what GitOps automates safely; and **drift detection** is an observability-of-desired-state complement to the runtime observability topic. Master this and you've closed the loop: code → declarative manifests → Git → controller → reconciled cluster, all auditable and revertable. It's the difference between operating Kubernetes and just poking it.

### Q1. Why doesn't raw YAML scale, and what problem are Helm and Kustomize solving?

A production app isn't one manifest — it's a Deployment, Service, Ingress, ConfigMap, Secret, HPA, ServiceAccount, and RBAC, easily dozens of resources. Now multiply by environments: dev/staging/prod need different replica counts, image tags, hostnames, resource limits, and feature flags. The naive approach — a folder of YAML per environment — means **copy-paste divergence**: you fix a bug in prod's Deployment, forget staging, and now they've silently drifted. There's no single source of the "shape" of the app, no parameterization, and no packaging to hand someone else.

Both tools attack this with a **DRY** principle but opposite philosophies:

- **Helm** — parameterize with **templates + values**: one templated chart, different `values.yaml` per environment. Plus packaging: a versioned, installable, redistributable artifact.
- **Kustomize** — a shared **base** of plain YAML plus per-environment **overlays** that patch only what differs.

The shared goal: define the app once, express only the *deltas* per environment, and eliminate drift. Which philosophy fits depends on whether you value packaging/parameterization power (Helm) or template-free clarity and owning plain manifests (Kustomize).

### Q2. Explain the anatomy of a Helm chart.

A chart is a directory (or packaged `.tgz`) with a fixed structure:

```
my-app/
  Chart.yaml        # name, version, appVersion, dependencies
  values.yaml       # default parameters
  templates/        # templated manifests
    deployment.yaml
    service.yaml
    _helpers.tpl     # reusable template snippets
  charts/           # vendored subcharts (dependencies)
```

- **`Chart.yaml`** — metadata: chart `version` (the package version), `appVersion` (the app it deploys), and `dependencies` (subcharts).
- **`values.yaml`** — the default configuration surface; everything a user can tune.
- **`templates/`** — Kubernetes manifests with **Go template** directives that pull from values:

```yaml
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
```

At install, Helm **renders** the templates against merged values and applies the result. `helm template` renders locally without applying — essential for review and CI. The chart is the unit you version, publish to a repo, and reuse.

### Q3. How do Helm releases, upgrades, and rollbacks work?

A **release** is an *installed instance* of a chart in a cluster — one chart can be installed many times (`my-app-staging`, `my-app-prod`) as distinct releases. Helm records each action as a **revision** and stores that history (as Secrets in the release's namespace by default).

```bash
helm install my-app ./chart -n prod -f values-prod.yaml   # revision 1
helm upgrade my-app ./chart -n prod --set image.tag=1.4.0 # revision 2
helm history my-app -n prod                                # list revisions
helm rollback my-app 1 -n prod                             # back to revision 1
```

On `upgrade`, Helm renders the new manifests, diffs against the stored release state, and applies the changes. Because it remembers prior revisions, `helm rollback` re-applies a previous rendered state — a fast escape hatch when a deploy goes bad. `--atomic` makes an upgrade automatically roll back if it fails to become healthy, and `--wait` blocks until resources are ready. This revision history + one-command rollback is a major Helm selling point over hand-applied YAML — though in a GitOps world you'd often prefer `git revert` so Git stays the source of truth (Q13).

### Q4. What are chart repositories, dependencies, and subcharts?

**Chart repositories** are how charts are distributed — an HTTP server (or, increasingly, an **OCI registry**, since Helm supports pushing charts as OCI artifacts) hosting packaged charts and an index. This is what lets you `helm install bitnami/redis` instead of writing Redis manifests yourself.

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install cache bitnami/redis
# OCI style:
helm push my-app-1.0.0.tgz oci://my-registry/charts
```

**Dependencies / subcharts** let a chart build on others. You declare them in `Chart.yaml`:

```yaml
dependencies:
  - name: redis
    version: "18.x.x"
    repository: https://charts.bitnami.com/bitnami
```

`helm dependency update` vendors them into `charts/`. The parent can configure a subchart through its own `values.yaml` (nested under the subchart's name), and shared values can be passed via `global`. This is how an umbrella chart deploys an app *and* its Redis and Postgres as one release. The tradeoff: deep dependency trees get hard to reason about, and a subchart's values surface leaks into yours.

### Q5. What are Helm's tradeoffs, and what changed with Helm 3?

**Strengths:** true parameterization (loops, conditionals, functions via Go templates), packaging and versioned distribution, release history with one-command rollback, and a massive ecosystem of ready-made charts for third-party software. For "install this off-the-shelf thing," Helm is unmatched.

**Weaknesses:**

- **You're templating YAML** — a whitespace/indentation-sensitive format via a text templating engine. Miss an indent inside a `{{ if }}` and you get invalid YAML or, worse, silently wrong manifests. Debugging rendered output (`helm template | kubectl apply --dry-run`) becomes a routine.
- **Values sprawl** — deeply nested, weakly-typed `values.yaml` with no schema (unless you add `values.schema.json`) is easy to misconfigure.
- **Logic in templates** — complex charts accrete `if/range/with` logic that's hard to read and test.

**Helm 3's headline change: Tiller was removed.** Helm 2 ran a privileged in-cluster server (**Tiller**) that held god-mode cluster access — a notorious security and RBAC problem. Helm 3 is **client-only**: the `helm` binary talks to the API server using *your* kubeconfig/RBAC, and release state lives in Secrets in the release namespace. Helm 3 also added OCI registry support and 3-way strategic merge on upgrades. If someone mentions Tiller as current, they're on outdated knowledge.

### Q6. What are Helm hooks and when do you use them?

**Hooks** let a chart run resources at specific points in the release lifecycle, rather than all at once. You annotate a resource (usually a Job) with a hook type:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
```

Common hook points: `pre-install`, `post-install`, `pre-upgrade`, `post-upgrade`, `pre-delete`, `post-delete`, plus `test` for `helm test`.

Canonical uses:

- **Database migrations** — a `pre-upgrade` Job runs schema migrations *before* the new pods roll out.
- **Setup/teardown** — seed data on install, clean up external resources on delete.
- **Smoke tests** — a `test` hook validates the release post-deploy.

**Hook weights** order multiple hooks; **delete policies** control cleanup of hook resources. The caveat: hooks run *outside* the normal declarative reconcile, so they're imperative side-effects Helm won't manage or roll back like regular resources — a failed post-install hook can leave you in a messy state. In GitOps land, ArgoCD's **sync hooks/waves** cover similar ground more declaratively.

### Q7. Explain Kustomize's base-and-overlay model.

Kustomize is **template-free**: no `{{ }}`, just plain valid Kubernetes YAML plus **patches**. You keep one **base** (the common manifests) and per-environment **overlays** that patch it:

```
base/
  kustomization.yaml
  deployment.yaml
  service.yaml
overlays/
  staging/
    kustomization.yaml     # points at ../../base, patches replicas=2
  prod/
    kustomization.yaml     # patches replicas=10, prod image tag
```

The prod overlay's `kustomization.yaml`:

```yaml
resources:
  - ../../base
patches:
  - path: replica-patch.yaml     # sets replicas: 10
images:
  - name: my-app
    newTag: 1.4.0
namespace: prod
```

`kubectl apply -k overlays/prod` (or `kustomize build overlays/prod`) renders the base with the overlay applied. Because everything is real YAML, the base file is itself a valid, appliable manifest — your editor, linters, and schema validators all understand it, unlike a half-templated Helm file. Overlays express *only the deltas* per environment, so there's one source of truth for the app's shape and no copy-paste drift.

### Q8. What patch strategies does Kustomize offer, and what are its built-in transformers?

Two patching styles:

- **Strategic merge patch** — write a YAML fragment mirroring the target's structure; Kustomize merges it field-by-field (and knows list semantics, e.g. merging containers by name). Most readable for "change this field":

```yaml
spec:
  replicas: 10
```

- **JSON patch (RFC 6902)** — precise operations for surgical or list-index changes strategic merge can't express:

```yaml
- op: replace
  path: /spec/template/spec/containers/0/image
  value: my-app:1.4.0
- op: add
  path: /spec/template/spec/tolerations/-
  value: {key: gpu, operator: Exists}
```

Beyond patches, Kustomize has **built-in transformers/generators** that cover the common cases without any patch:

- `images:` — swap image names/tags.
- `namespace:`, `namePrefix:`/`nameSuffix:`, `commonLabels:`/`commonAnnotations:` — blanket transforms.
- `configMapGenerator` / `secretGenerator` — generate ConfigMaps/Secrets from files/literals, with a content **hash suffix** appended to the name so a config change forces a rolling update automatically.
- `replicas:` — set replica counts.

These declarative transformers are what make Kustomize feel clean for the 80% case; you drop to patches only for the rest.

### Q9. Helm vs Kustomize — how do you choose, and can you use both?

They're different philosophies, and the mature answer is "it depends, and often both."

| | Helm | Kustomize |
|---|---|---|
| Approach | Go templating + values | Template-free overlays/patches |
| Packaging | Yes — versioned, redistributable charts | No packaging concept |
| Parameterization | Powerful (loops, conditionals, functions) | Limited (patches + transformers) |
| Learning curve | Steeper (template language) | Gentler (just YAML) |
| Files | Not directly appliable (templated) | Base is valid YAML |
| Distribution | Repos / OCI | Git directories |
| Built into | Separate binary | `kubectl -k` |

**Reach for Helm** when you need packaging/distribution (shipping an app to others), installing third-party software, or genuinely complex parameterization. **Reach for Kustomize** when you own the manifests, want them to stay plain readable YAML, and mostly need per-environment deltas without a templating language.

**Using both** is common and idiomatic: use Helm for third-party charts and Kustomize for your own apps; or run `helm template` to render a chart and then let Kustomize patch the output (post-render), so you consume upstream charts while owning environment-specific tweaks declaratively. Both ArgoCD and Flux support Helm, Kustomize, and the combination natively, so you're not forced to pick tribally.

### Q10. What is GitOps and why is it better than `kubectl apply` from CI?

**GitOps** makes **Git the single source of truth for desired state**: your manifests (raw/Helm/Kustomize) live in a repo, and an in-cluster **controller continuously reconciles** the live cluster to match that repo. You never `kubectl apply` by hand or from CI — you `git push`, and the controller pulls and converges.

Why it beats push-based CI running `kubectl apply`:

- **Auditability** — every change is a reviewed, signed, timestamped Git commit. The repo *is* the change log and the audit trail; `git log` answers "who changed prod and when."
- **Drift detection & self-healing** — the controller constantly compares live vs Git. If someone `kubectl edit`s prod at 3am, GitOps flags the **drift** and (if configured) reverts it. Push-CI has no idea the cluster drifted after its last run.
- **No cluster credentials in CI** — the reconciler runs *inside* the cluster and pulls; your CI never holds `kubeconfig`/admin creds, shrinking the attack surface. (Pull > push for security.)
- **Trivial rollback** — `git revert` and the controller reconciles back to the prior state.
- **Consistency** — the same declarative flow for every environment, reproducible from an empty cluster by pointing the controller at the repo.

The mental shift: stop *doing* deployments; declare the desired end state and let a control loop achieve it — GitOps is Kubernetes' reconciliation philosophy extended to delivery.

### Q11. Compare ArgoCD and FluxCD.

Both are **pull-based GitOps reconcilers** running in the cluster; they differ in shape and UX.

| | ArgoCD | FluxCD |
|---|---|---|
| Model | `Application` CRD, opinionated app-centric | Composable controllers (source, kustomize, helm, image) |
| UI | Rich web UI + visualization | CLI/CRD-first, no built-in UI (use Weave GitOps) |
| Multi-tenancy | Projects, RBAC, SSO built-in | Namespace/RBAC-scoped |
| Patterns | App-of-apps, sync waves/hooks | Kustomization/HelmRelease dependencies |
| Feel | Dashboard-driven, great for teams/visibility | Modular, GitOps-toolkit, automation-friendly |

**ArgoCD** centers on the **Application** resource (a pointer to a repo path + target cluster/namespace), a strong web UI showing sync/health status and live-vs-desired diffs, and features like **app-of-apps**, **sync waves**, and manual/auto sync with self-heal. Great when you want visibility and a UI for many teams.

**FluxCD** is a set of composable controllers (GitRepository/OCIRepository sources, Kustomization, HelmRelease, and an image-automation controller that can bump image tags in Git automatically). It's CLI/CRD-native and leans toward automation and modularity.

In practice both are CNCF-graduated and production-solid; choose ArgoCD for the UI/multi-tenant dashboard experience, Flux for a lean, composable, automation-first setup. The GitOps *principles* are identical.

### Q12. How do you handle secrets in a GitOps world?

The core tension: GitOps wants *everything* in Git, but a plaintext `Secret` (base64 is **not** encryption) in a repo is a credential leak. Three established patterns:

- **Sealed Secrets** (Bitnami) — a controller in the cluster holds a private key; you encrypt a Secret into a `SealedSecret` CRD with the public key and commit *that*. Only the in-cluster controller can decrypt it into a real Secret. Simple, Git-safe, cluster-scoped keys.
- **SOPS** (with age/KMS) — encrypt the secret *values* in a YAML file so the file stays diff-able (keys visible, values encrypted) and commit it; Flux (native) or an ArgoCD plugin decrypts at apply time using a KMS/age key. Good when you want encrypted values living alongside manifests.
- **External Secrets Operator** — don't store the secret in Git at all; commit an `ExternalSecret` CRD that *references* a secret in a real vault (AWS Secrets Manager, Vault, GCP Secret Manager). The operator fetches it and materializes a Kubernetes Secret. Best when a vault is already your system of record and you want central rotation.

Rule of thumb: **SOPS/Sealed Secrets** when Git should hold the (encrypted) secret; **External Secrets** when an external vault owns it and Git only holds a reference. Never commit a raw `Secret`. This question is a strong "have you actually run GitOps" tell, because it's the first wall everyone hits.

### Q13. How do rollbacks work under GitOps, and how do you promote across environments?

**Rollback = revert the commit.** Because Git is the source of truth, undoing a bad deploy is `git revert <sha>` (or reset the environment's ref); the controller detects the change and reconciles the cluster back to the previous state — no imperative `helm rollback`, and the rollback itself is an auditable commit. This is cleaner than push-CI because the "how to roll back" is just normal Git.

**Promotion across environments** — the common models:

- **Directory/branch per environment** — `overlays/dev`, `overlays/staging`, `overlays/prod` (or per-env branches). Promoting = a PR that bumps the image tag (or a pointer) from one env's path to the next. The change is reviewable and the diff shows exactly what's advancing.
- **Config repo separate from app repo** — CI builds and pushes an image, then opens a PR to the **config repo** updating the tag for the target environment; merging triggers the GitOps sync. This decouples "build" from "deploy" and keeps deploys human-gated.
- **Image automation** (Flux image-reflector/automation) can auto-open commits bumping tags per policy, so dev auto-promotes while prod stays PR-gated.

The through-line: promotion is a **Git change moving a version reference forward**, environment by environment, each one a reviewable PR — so "what's in prod" is always answerable from the repo, and promotion has the same audit trail as any code change.

### Q14. What is the app-of-apps pattern and what are sync waves?

Both are ArgoCD patterns for managing *many* resources/apps coherently.

**App-of-apps** — a single parent ArgoCD **Application** whose Git path contains *other* Application manifests. ArgoCD syncs the parent, which creates the children, each pointing at its own repo/path. This bootstraps an entire cluster's worth of apps (ingress controller, cert-manager, monitoring, your services) from **one root Application** — point ArgoCD at the root repo and the whole platform materializes. It's how teams manage fleets declaratively and onboard new clusters reproducibly.

**Sync waves** — ordering hints for *within* a sync. Resources are annotated with a wave number:

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"   # earlier waves apply first
```

ArgoCD applies lower waves before higher ones and waits for each wave to be healthy before proceeding. Canonical use: create a namespace and CRDs (wave -1) before the resources that depend on them (wave 0), or run a database migration Job before rolling the app. Combined with **sync hooks** (PreSync/PostSync), waves give you ordered, dependency-aware rollout declaratively — the GitOps analogue of Helm hooks. Flux expresses the same idea via `dependsOn` between Kustomizations/HelmReleases.

### Q15. How do you test and validate Kubernetes manifests before they hit the cluster?

You validate in layers, shifting failures left so a bad manifest fails in CI, not in prod.

- **Schema validation** — `kubeconform` (the maintained successor to `kubeval`) checks manifests against the Kubernetes OpenAPI schemas: catches typos, wrong field names, invalid types, and unknown API versions offline. Fast, runs on every PR.
- **Policy / conventions** — **conftest** (OPA/Rego) or **kyverno test** / **Datree** enforce *organizational* rules: "every Deployment must set resource limits," "no `:latest` tags," "must have a readiness probe," "images only from `my-registry`." This is where you encode the standards a schema can't.
- **Render + dry-run** — for Helm/Kustomize, render first (`helm template`, `kustomize build`) then `kubectl apply --dry-run=server`, which validates against the *actual cluster's* admission controllers and CRDs (catches what offline tools can't, like webhook rejections).
- **Chart/unit tests** — `helm unittest` asserts rendered output for given values; `helm lint` catches chart mistakes.
- **In GitOps** — the reconciler's **diff/dry-run** and health checks act as a final gate, and a **PR-based flow** means every change is reviewed and CI-validated before merge triggers a sync.

The pipeline shape: **lint → schema (kubeconform) → policy (conftest/kyverno) → render → server dry-run → PR review → GitOps sync.** Each stage is cheap and catches a distinct class of error before it can touch a running cluster.
## Operators, CRDs & the Controller Pattern

### Summary

**What this topic covers**

The extension story: how Kubernetes lets you teach it about resources it has never heard of, and how the same control loop that runs Deployments runs your own automation. Three concern areas live here: (1) the **controller / reconciliation pattern** — the level-triggered loop that observes actual state, compares it to desired state, and acts to converge, backed by informers, watches, and work queues; (2) **CustomResourceDefinitions (CRDs)** — extending the API server with your own kinds, complete with OpenAPI schema validation, versioning, printer columns, and status/scale subresources; and (3) the **Operator pattern** — a CRD plus a bespoke controller that encodes day-2 operational knowledge (backups, failover, upgrades) for a stateful system. The 15 questions here move from "what is a controller" to "design a controller for X", plus finalizers, owner references, admission webhooks, and the other extension points (aggregated API servers, CNI/CSI/CRI). If you understand the reconciliation loop, you understand Kubernetes; operators are just that loop pointed at your problem.

**Mental model**

Kubernetes is not a system that *does* things once; it is a system that *keeps* things true. Every object in etcd is a statement of desired state. A controller is a program that runs a loop forever: read desired state (the spec), read observed state (the world), compute the difference, and take one step toward closing it — then do it again. This is **level-triggered**, not edge-triggered: the controller reacts to the *current level* of the system, not to the *event* that changed it. That is why Kubernetes self-heals — if it misses an event, the next resync still sees the discrepancy and fixes it. An operator is this same idea with domain knowledge baked in: instead of "make N replicas exist," it's "make a healthy 3-node database exist, take nightly backups, and fail over on primary loss." You are not scripting steps; you are declaring an invariant and writing the code that continuously enforces it. Reconcile must be idempotent, because it will run thousands of times.

**Key terms**

- **Controller** — a control loop that watches one or more resource types and drives actual state toward desired state.
- **Reconciliation** — one iteration of that loop: observe → diff → act → requeue.
- **Level-triggered** — react to current state, not to the event that changed it; robust to missed events.
- **Informer** — a client-side cache that watches the API server and keeps a local, indexed copy of objects, feeding a work queue on changes.
- **Work queue** — a rate-limited, deduplicating queue of object keys to reconcile.
- **CRD (CustomResourceDefinition)** — an object that registers a new API kind; the api-server then serves CRUD + watch for it.
- **CR (Custom Resource)** — an instance of a CRD's kind (e.g. a `Database` object).
- **Operator** — a CRD + a controller that encodes operational knowledge for a specific application.
- **Owner reference** — a field linking a child object to its owner; enables cascading garbage collection.
- **Finalizer** — a string key on an object that blocks deletion until a controller removes it, giving you a cleanup hook.
- **Subresource** — a sub-path like `/status` or `/scale` with its own RBAC and update semantics.
- **Admission webhook** — an HTTP callback the api-server invokes to validate (`ValidatingWebhook`) or mutate (`MutatingWebhook`) objects on write.

**Why interviewers ask this**

This topic separates people who *use* Kubernetes from people who *understand* it. Anyone can `kubectl apply`; the signal is whether you know *why* the thing you applied eventually happens — that some controller in a loop noticed and acted. Junior answers describe operators as "a way to install databases." Senior answers describe the reconcile function's contract: idempotent, level-triggered, requeue on transient error, use owner references so garbage collection is automatic, use finalizers for external cleanup. For platform and SRE roles this is the core competency — you will build controllers to automate toil, and you must reason about their failure modes (a wedged reconciler, a hot-looping requeue, a finalizer that never clears and blocks deletion forever). The "design a controller for X" question tests whether you can turn an operational runbook into a convergent loop.

**Common confusions**

- "Controllers are event-driven" — they *use* events to know *when* to look, but they act on *state*. Missing an event is survivable; that is the whole point of level-triggering.
- "A CRD is an operator" — a CRD is just a new API type with storage and validation. Without a controller reconciling it, it is inert data. The operator is CRD + controller.
- "Reconcile runs once per change" — it runs many times per object, on resyncs and requeues. It must be idempotent and safe to re-run.
- "Finalizers delete things" — finalizers *block* deletion; your controller does the cleanup and then removes the finalizer to allow deletion to complete.
- "Webhooks and controllers do the same job" — webhooks run *synchronously in the admission path* (validate/mutate on write); controllers run *asynchronously* after the object is stored. Use webhooks for immediate rejection, controllers for convergence.
- "Operators are always the answer" — for stateless apps a Helm chart or Deployment is simpler. Operators earn their complexity on stateful, day-2-heavy systems.

**What follows from this topic**

This is the conceptual spine of the whole primer. Deployments, StatefulSets, and Jobs are all just built-in controllers, so everything in the workloads topics is a special case of what's here. RBAC matters because your controller runs as a ServiceAccount with a Role granting it watch/update on its resources. Cluster Operations builds on owner references and finalizers when you reason about upgrades and cleanup. And Troubleshooting leans on this model constantly: when something is "stuck," the question is always *which controller is failing to reconcile, and why*.

### Q1. Explain the controller pattern and the reconciliation loop.

A **controller** watches a resource type and runs a loop that drives the world toward the declared desired state. One iteration — a **reconcile** — does three things:

1. **Observe** — read desired state (the object's `spec`) and actual state (query the API / external systems).
2. **Diff** — compute what differs.
3. **Act** — take one action to close the gap (create/update/delete a child object, call an external API), then update `status` and requeue.

The canonical shape:

```
for {
  key := workqueue.Get()          // an object needs reconciling
  desired := getSpec(key)         // from the informer cache
  actual := observeWorld(key)     // real state
  if actual != desired {
    takeOneStepTowardDesired()    // idempotent
  }
  updateStatus(key)
  workqueue.Done(key)             // or AddRateLimited(key) to retry
}
```

The key property: reconcile does not assume it knows the current state from the last run — it *re-derives* it every time. That makes it self-healing and idempotent. Built-in controllers (Deployment, ReplicaSet, Node, Job) all follow this exact pattern; your operator is one more of them.

### Q2. What is the difference between edge-triggered and level-triggered, and why does Kubernetes prefer level-triggered?

**Edge-triggered** = react to the *event* (the transition). If you miss the event, you miss the work forever.
**Level-triggered** = react to the *current state* (the level). Even if you missed every event, the next look still shows the discrepancy and you fix it.

Kubernetes controllers are **level-triggered**. They use watches/events only as a hint about *when* to re-examine state, but every reconcile re-reads actual state and converges toward desired. Combined with periodic **resync** (the informer re-lists everything on an interval), this makes the system robust: a dropped watch event, a controller restart, or a brief api-server outage cannot leave the cluster permanently wrong — the next reconcile catches up.

Concretely: if a ReplicaSet wants 3 pods and a node dies taking one pod, the controller doesn't need the "pod deleted" event to arrive reliably. On its next look it simply sees 2 running vs 3 desired and creates one. That is why "declare desired state and let the loop converge" is the whole Kubernetes philosophy.

### Q3. How do informers, watches, and work queues fit together?

They are the plumbing that makes reconcile efficient instead of a hammering poll.

- **Watch** — a long-lived streaming connection to the api-server that pushes object add/update/delete events. Cheaper than polling.
- **Informer** — wraps a watch (plus an initial LIST) into a **local cache** (a thread-safe store) that stays in sync with the api-server. Your reconcile reads from this cache, not the api-server, so reads are fast and don't overload the control plane. Informers also maintain **indexers** for fast lookups (e.g. by label).
- **Work queue** — when the informer sees a change, its event handler doesn't reconcile inline; it enqueues the object's **key** (`namespace/name`). The queue **deduplicates** (many events for one object collapse to one item) and **rate-limits** (exponential backoff on repeated failures).

Flow: `api-server → watch → informer cache updated → event handler enqueues key → worker dequeues → reconcile reads from cache → acts`. This decoupling is what lets one controller handle thousands of objects without melting the api-server, and it's why controller-runtime and client-go are built around SharedInformers (one informer shared across controllers watching the same type).

### Q4. What is a CustomResourceDefinition (CRD) and what does creating one give you?

A **CRD** registers a new API kind with the api-server. Once applied, the api-server serves full CRUD + watch for that kind at `/apis/<group>/<version>/<kind>`, stores instances in etcd, and enforces your schema — all with zero code.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.acme.io
spec:
  group: acme.io
  scope: Namespaced
  names:
    kind: Database
    plural: databases
    singular: database
    shortNames: [db]
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                size: { type: integer, minimum: 1 }
                version: { type: string }
              required: [size]
      subresources:
        status: {}          # enables /status subresource
      additionalPrinterColumns:
        - name: Size
          type: integer
          jsonPath: .spec.size
```

What you get for free: `kubectl get databases`, validation (a `size` of 0 is rejected), RBAC (`Role` on `databases`), watch/informers, and `kubectl get db` showing your custom columns. What you *don't* get: any behaviour. A CRD is inert storage until a controller reconciles it — that's the operator.

### Q5. What is the Operator pattern and when is it worth building one?

An **operator** = a CRD (the desired-state API) + a custom controller (the code that makes it real), encoding the **operational knowledge** a human SRE would otherwise apply by hand. Instead of a runbook that says "to upgrade the database: quiesce writes, snapshot, upgrade replicas one at a time, fail over, verify," you write a controller that does exactly that whenever the CR's `spec.version` changes.

**Build an operator when** the workload is **stateful and day-2-heavy** — it needs automated backups, restores, failover, resharding, version-aware upgrades, or topology management. Databases (Postgres, MySQL, Cassandra), message brokers (Kafka), and stateful stores are the classic cases. The value is that the loop enforces the invariant continuously: primary dies at 3am → controller promotes a replica → no page.

**Don't build one when** a **Helm chart or plain Deployment suffices** — stateless services, simple config, no complex lifecycle. Operators are real code you must maintain, secure (they often need broad RBAC), and debug. Reach for one when the alternative is a human running a runbook repeatedly; otherwise the complexity isn't earned. Rule of thumb: Helm packages *install-time* config; operators automate *ongoing operations*.

### Q6. Operator vs Helm — compare them directly.

| | Helm | Operator |
|---|---|---|
| What it is | A templating + packaging tool | A CRD + a running controller |
| When it acts | At `install`/`upgrade` (imperative, one-shot) | Continuously (level-triggered loop) |
| Day-2 ops | You run `helm upgrade` by hand | Controller automates backups, failover, upgrades |
| State drift | Not corrected until you re-run | Continuously reconciled back to desired |
| Best for | Stateless apps, config bundling | Stateful, complex lifecycle systems |
| Cost | A chart | Real Go code to write, secure, and maintain |

They compose: many operators are *installed* via a Helm chart (the CRD + controller Deployment + RBAC), then take over ongoing operations. Helm gets the operator running; the operator runs the workload. The interview trap is treating them as competitors — the right framing is "Helm for packaging/install, operator for continuous operations."

### Q7. Walk through the anatomy of a Reconcile function.

A controller-runtime `Reconcile` receives a request (namespace/name) and returns a result telling the loop when to run again. The contract:

```go
func (r *DBReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var db acmev1.Database
    if err := r.Get(ctx, req.NamespacedName, &db); err != nil {
        // NotFound => object was deleted; owner refs GC'd children. Nothing to do.
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // Handle deletion via finalizer (see finalizer question).
    if !db.DeletionTimestamp.IsZero() {
        return r.cleanup(ctx, &db)
    }

    // Reconcile children idempotently: create-or-update the StatefulSet, Service, etc.
    if err := r.ensureStatefulSet(ctx, &db); err != nil {
        return ctrl.Result{}, err            // return error => requeue with backoff
    }

    // Update status to reflect observed state.
    db.Status.ReadyReplicas = observed
    if err := r.Status().Update(ctx, &db); err != nil {
        return ctrl.Result{}, err
    }

    // Requeue periodically to re-verify even without events.
    return ctrl.Result{RequeueAfter: time.Minute}, nil
}
```

Return-value semantics matter:
- `return ctrl.Result{}, nil` — success, don't requeue (an event will bring me back).
- `return ctrl.Result{}, err` — requeue with **rate-limited exponential backoff**.
- `return ctrl.Result{RequeueAfter: d}, nil` — requeue after a fixed delay (for polling external state).

The body must be **idempotent** — it runs many times. "Ensure" (create-or-update), never "create" blindly.

### Q8. Why must a reconciler be idempotent, and how do you handle transient errors?

**Idempotent** because reconcile runs repeatedly for the same object — on every watch event, on periodic resync, after a controller restart, and after any requeue. If reconcile assumed "I'm being called because X just changed, so do the X action," it would double-create children, re-send notifications, or corrupt state. Instead each run must compute "does the world match spec? if not, take the *next* step" — running it twice with no changes must be a no-op.

Practical patterns: use **create-or-update** helpers (`controllerutil.CreateOrUpdate`), name children deterministically so you can look them up instead of blindly creating, and make external calls check-then-act (does the backup for today already exist?).

**Transient errors** (api-server 500, external API timeout, optimistic-concurrency conflict) → **return the error**. controller-runtime requeues with exponential backoff via the rate-limited work queue, so you retry later without hot-looping. **Terminal errors** (bad spec that will never succeed) → don't requeue endlessly; record the failure in `status` and/or emit an Event so a human sees it, and return `nil`. The anti-pattern is swallowing errors (silent divergence) or returning errors on unfixable conditions (infinite hot loop hammering the api-server).

### Q9. What are owner references and how do they drive garbage collection?

An **owner reference** is a field in an object's metadata pointing at its owner (kind, name, UID). When your controller creates a child (a StatefulSet for a `Database` CR), you set the CR as the child's owner via `controllerutil.SetControllerReference`.

```yaml
metadata:
  ownerReferences:
    - apiVersion: acme.io/v1
      kind: Database
      name: my-db
      uid: 1234-...
      controller: true
      blockOwnerDeletion: true
```

Two payoffs:

1. **Cascading garbage collection** — when the owner is deleted, the **garbage collector controller** automatically deletes the children. You delete one `Database` CR and its StatefulSet, Service, and ConfigMaps vanish, no cleanup code needed. This is exactly how deleting a Deployment removes its ReplicaSet and Pods.
2. **Automatic re-reconcile** — controller-runtime's `Owns(&appsv1.StatefulSet{})` uses owner refs to enqueue the *owner* when a *child* changes, so if someone deletes the StatefulSet, your reconciler wakes up and recreates it.

Deletion propagation has three modes: **Foreground** (owner stays in "deleting" until children gone), **Background** (owner deleted first, children cleaned async — the default), **Orphan** (children survive). This is why owner references are the backbone of clean operator lifecycle: express the tree once, get cleanup for free.

### Q10. What are finalizers and when do you need one?

A **finalizer** is a string in `metadata.finalizers` that **blocks actual deletion**. When you `kubectl delete` an object with a finalizer, the api-server does *not* remove it — it sets `metadata.deletionTimestamp` and leaves the object in place. It stays until every finalizer is removed. That gives your controller a hook to do **external cleanup** before the object disappears.

You need one whenever an object owns state that Kubernetes garbage collection can't reach: cloud resources (an S3 bucket, a load balancer, a DNS record), rows in an external database, entries in a third-party API. Owner references handle *in-cluster* children; finalizers handle *out-of-cluster* side effects.

The pattern in reconcile:

```go
if db.DeletionTimestamp.IsZero() {
    // Not being deleted: ensure our finalizer is present.
    controllerutil.AddFinalizer(&db, "acme.io/cleanup")
} else {
    // Being deleted: run cleanup, then remove finalizer to unblock deletion.
    if err := r.deleteCloudBackups(ctx, &db); err != nil {
        return ctrl.Result{}, err          // retry; object stays until this succeeds
    }
    controllerutil.RemoveFinalizer(&db, "acme.io/cleanup")
}
r.Update(ctx, &db)
```

The classic production incident: a finalizer whose cleanup can never succeed (permissions revoked, external API gone) leaves the object **stuck Terminating forever**. Emergency escape hatch: `kubectl patch ... -p '{"metadata":{"finalizers":[]}}' --type=merge` to force-remove it — but that skips cleanup, so understand what you're orphaning.

### Q11. Admission webhooks vs controllers — what's the difference and when do you use each?

Both extend behaviour, but they run at different times with different guarantees.

**Admission webhooks** run **synchronously inside the write path**, after authn/authz but before the object is persisted:
- **MutatingAdmissionWebhook** — can *modify* the object (inject a sidecar, set defaults, add labels). Runs first.
- **ValidatingAdmissionWebhook** — can *reject* the write (enforce policy: "no privileged pods", "images must be from acme registry"). Cannot modify.

Because they're in the request path, a rejection is **immediate** and the object never gets stored. But they must be fast and highly available — a down webhook with `failurePolicy: Fail` can block all writes to that resource.

**Controllers** run **asynchronously after** the object is stored, reconciling it toward desired state over time.

Use a **webhook** when you need to *prevent* or *shape* a write synchronously (policy enforcement, defaulting, immediate rejection with a clear error to the user). Use a **controller** when you need to *converge* the world to match a stored object (create children, call external systems). Many operators use both: a validating webhook rejects an invalid `Database` spec up front (better UX than a status error), and the controller reconciles valid ones. Note: for simple validation, **CEL validation rules** in the CRD schema or **ValidatingAdmissionPolicy** (in-tree CEL, no webhook server) increasingly replace custom webhooks.

### Q12. What frameworks would you use to build an operator, and what do they give you?

You almost never write raw client-go. The stack:

- **controller-runtime** — the foundational library (managers, reconcilers, clients, informers, leader election, webhook servers). Everything else builds on it.
- **Kubebuilder** — a scaffolding CLI on top of controller-runtime. `kubebuilder init` + `kubebuilder create api` generates the project layout, CRD types (Go structs → OpenAPI via markers), a `Reconcile` stub, RBAC markers, and manifests. The mainstream choice for Go operators.
- **Operator SDK** (from the Operator Framework) — wraps Kubebuilder and adds packaging for **OLM**, plus Helm-based and Ansible-based operators for teams that don't want to write Go.
- **Metacontroller** — lets you write operators as simple webhooks (a function that takes observed state and returns desired children) in any language, if you want to avoid Go entirely.

What they give you: struct-tag markers generate the CRD schema and RBAC (`// +kubebuilder:validation:Minimum=1`, `// +kubebuilder:rbac:...`), a manager wires up informers/caches/leader-election, and you mostly just fill in `Reconcile` and declare `Owns()`/`Watches()`. The 90% path is Kubebuilder + controller-runtime; reach for Operator SDK when you specifically need OLM/OperatorHub packaging.

### Q13. What is the Operator Lifecycle Manager (OLM) and OperatorHub?

**OLM** is a system for *installing, upgrading, and managing operators themselves* — an operator for operators. Instead of `kubectl apply`-ing an operator's CRDs, RBAC, and Deployment by hand, OLM manages that lifecycle declaratively:

- A **ClusterServiceVersion (CSV)** describes an operator version: its CRDs, required RBAC, install strategy, and dependencies.
- **Subscriptions** and **catalogs** let OLM auto-upgrade operators along a channel (like package-manager channels: `stable`, `alpha`), resolving CRD/version dependencies.
- It handles **CRD upgrades** safely (validating that new schemas don't break existing CRs) and surfaces install status.

**OperatorHub** is the public catalog (operatorhub.io, and the embedded catalog in OpenShift) of packaged operators you can install via OLM — databases, monitoring, service meshes, etc.

Interview framing: OLM solves the meta-problem of "how do I manage the dozen operators running in my cluster, their versions, their RBAC, and their upgrades" the same declarative way operators manage apps. You'll mostly encounter it on OpenShift; on vanilla EKS/GKE many teams install operators via Helm and skip OLM. Know it exists and what problem it solves.

### Q14. Beyond CRDs and controllers, what other extension points does Kubernetes offer?

CRDs are the common path, but the platform is extensible at many layers:

- **Aggregated API servers** — instead of a CRD, you run your *own* API server and register it via `APIService` so the kube-apiserver proxies a URL path to it. Use when you need custom storage, non-etcd backends, or behaviour a CRD's declarative storage can't express (e.g. `metrics.k8s.io` is an aggregated API, not a CRD).
- **Admission webhooks** — mutate/validate on write (covered above); plus **ValidatingAdmissionPolicy** (in-tree CEL, no external server).
- **Scheduler extenders / scheduling framework plugins** — customize how pods are placed (filter/score plugins) or run a second scheduler entirely.
- **The interfaces** — Kubernetes deliberately delegates hard problems to pluggable interfaces:
  - **CRI** (Container Runtime Interface) — the kubelet talks to containerd/CRI-O via CRI.
  - **CNI** (Container Network Interface) — pod networking is a plugin (Calico, Cilium, AWS VPC CNI).
  - **CSI** (Container Storage Interface) — storage drivers plug in out-of-tree.
- **Custom controllers on built-in types** — you don't always need a CRD; you can write a controller that watches ConfigMaps or Services and acts on annotations.

The theme: Kubernetes is a *framework* for building platforms, not a fixed product. The api-server is extensible (CRDs, aggregation, admission), the scheduler is extensible (framework), and the node is extensible (CRI/CNI/CSI).

### Q15. Design a controller for X — e.g. an operator that keeps a ConfigMap synced across all namespaces. Walk me through it.

Start by naming the **invariant**: "every namespace should contain a copy of a designated 'source' ConfigMap, kept in sync." Then design the loop around it.

**API shape** — I might not even need a CRD here; I can drive it off an annotation on the source ConfigMap (`sync.acme.io/replicate: "true"`), or add a small `ReplicatedConfig` CRD if I want richer control (target namespace selectors, exclusions).

**Watches** — the reconciler must wake on three kinds of change: (1) the source ConfigMap changes → re-push everywhere; (2) a *copy* is edited or deleted → restore it (`Owns` via owner references gets me this); (3) a *new namespace* is created → seed it. So I `Watches(&corev1.Namespace{})` and map a namespace event to "reconcile the source config."

**Reconcile (idempotent)**:
1. Get the source ConfigMap; if gone or annotation removed, delete all copies (owner refs make this automatic) and return.
2. List target namespaces (respecting any exclude selector).
3. For each, **create-or-update** a copy with identical data, setting an owner reference so deletion cascades and edits get reverted.
4. Prune copies in namespaces that no longer qualify.
5. Update `status` with count synced; requeue periodically as a backstop.

**Edge cases I'd raise unprompted**: idempotency (create-or-update, never blind create); avoiding a hot loop (don't write if data already matches — compare first, or you'll trigger your own watch endlessly); RBAC (the controller's ServiceAccount needs `get/list/watch/create/update/delete` on ConfigMaps cluster-wide and `watch` on Namespaces); race with namespace deletion (ignore NotFound); and a finalizer only if I need external cleanup (here I don't — owner refs suffice). That structure — invariant, watches, idempotent reconcile, RBAC, failure modes — is the answer to *any* "design a controller for X."

## Cluster Operations

### Summary

**What this topic covers**

The day-2 job: running an existing cluster safely over time, not spinning one up. Concern areas: (1) **upgrades** — the strict order (control plane before nodes), the version skew policy, one-minor-at-a-time, and migrating off deprecated APIs; (2) **node lifecycle** — cordon, drain (respecting PodDisruptionBudgets), replace, uncordon, and how managed node pools do rolling/surge upgrades; (3) **etcd** — backup, restore, quorum, and why it's the one component whose loss is catastrophic; (4) **managed vs self-managed** — what EKS/GKE/AKS take off your plate (control plane, etcd) and what stays yours (workloads, often nodes); (5) **capacity, bin-packing, and cost** — right-sizing, spot/preemptible pools, cluster-autoscaler and Karpenter; (6) **multi-tenancy** — namespaces + quotas + RBAC + NetworkPolicy vs separate clusters; and (7) **day-2 hygiene** — certificate rotation, backups (Velero), and monitoring the control plane. The 16 questions here are the operational reality behind the tidy declarative API: keeping the plane healthy while workloads keep running.

**Mental model**

Treat the cluster as a system with a **stateful brain** (etcd, behind the api-server) and a **fleet of cattle** (nodes). Almost every operation reduces to two rules. First, **protect the brain**: etcd holds all cluster state; back it up, keep quorum (odd member counts), upgrade it carefully, and never let it run out of disk. Second, **nodes are replaceable, workloads must stay available**: any node operation is cordon (stop new pods landing) → drain (evict existing pods *gracefully*, honoring PodDisruptionBudgets) → do the work → uncordon or replace. Upgrades flow **top-down**: control plane first (it must support the node versions), then nodes, one minor version at a time, within the skew policy. On managed clusters the cloud owns the brain and gives you node pools with auto-upgrade; you still own workload availability. The throughline: change the fleet continuously and safely, while the control plane and workloads never lose availability.

**Key terms**

- **Control plane** — kube-apiserver, etcd, scheduler, controller-manager; the cluster's brain.
- **Version skew policy** — the allowed version gaps between components (kubelet may trail api-server by up to 3 minors, never lead).
- **Cordon** — mark a node `Unschedulable` so no new pods are placed on it.
- **Drain** — evict a node's pods gracefully, respecting PodDisruptionBudgets, before maintenance.
- **PodDisruptionBudget (PDB)** — a policy capping how many pods of a set may be voluntarily unavailable at once.
- **etcd** — the distributed key-value store holding all cluster state; needs quorum of an odd member count.
- **Quorum** — majority of etcd members required to serve writes; `(N/2)+1`.
- **Node pool / node group** — a managed group of identical nodes (EKS managed node group, GKE node pool) with lifecycle automation.
- **Cluster Autoscaler** — adds/removes nodes based on pending (unschedulable) pods and underused nodes.
- **Karpenter** — a just-in-time provisioner that launches right-sized nodes directly (AWS), replacing node-group-based autoscaling.
- **Velero** — a backup tool for cluster objects and persistent volumes.
- **Bin-packing** — scheduling pods densely onto fewer nodes to cut cost.

**Why interviewers ask this**

Anyone can create a cluster; keeping one healthy for years is the actual SRE job, and this topic is where production scars show. Junior answers say "I'd upgrade the cluster" with no mention of order, skew, or draining. Senior answers lead with "control plane first, respect the skew policy, drain nodes honoring PDBs, and I've got a tested etcd restore." Interviewers probe for the failure modes you've actually hit: an upgrade that broke because a deprecated API was still in use, an etcd backup nobody had tested restoring, a drain that took down a service because the PDB was missing, a runaway bill from un-bin-packed nodes. For platform/SRE roles this is core: it tests whether you can perform risky, irreversible operations on a live system without an outage — and whether you have a recovery plan when it goes wrong anyway.

**Common confusions**

- "Upgrade nodes and control plane together" — no: **control plane first**, then nodes. The api-server must support the kubelet versions, and kubelets may trail but never lead.
- "You can skip minor versions on upgrade" — no: go **one minor at a time** (1.29 → 1.30 → 1.31), never 1.29 → 1.31.
- "Managed control plane means nothing to do" — EKS/GKE/AKS run the control plane and etcd, but you still own node upgrades (often), workload availability, RBAC, quotas, and deprecated-API migration.
- "`kubectl delete node` drains it" — it does not evict gracefully; you **cordon then drain** first, *then* remove.
- "etcd with 2 members is more reliable than 1" — 2 members is *worse*: quorum is 2, so losing either kills writes. Use **odd** counts (3, 5).
- "Velero backs up etcd" — Velero backs up *API objects and PVs* via the API; it is not an etcd snapshot. On managed clusters you can't touch etcd anyway, so Velero is your DR path.

**What follows from this topic**

This is where the abstractions meet hardware and money. PodDisruptionBudgets and graceful termination tie back to the workloads and availability topics — a safe drain depends on well-configured readiness probes and preStop hooks. The controller/reconciliation model underpins the cluster autoscaler and Karpenter (they're controllers watching for unschedulable pods). RBAC, quotas, and NetworkPolicy from the security topics are the tools of multi-tenancy. And everything here feeds Troubleshooting: "node NotReady," "pod stuck Terminating during a drain," and "rollout stuck during an upgrade" are all cluster-operations failures seen from the debugging side.

### Q1. Walk me through upgrading a Kubernetes cluster safely.

The order is non-negotiable: **control plane first, then nodes**, one minor version at a time.

1. **Pre-flight** — read the target version's changelog for removed/deprecated APIs. Run something like `kubectl deprecations` tooling / `pluto` / `kubent` to find manifests using APIs that disappear in the new version. Fix them *before* upgrading (see the deprecated-API question). Confirm you have a working etcd backup.
2. **Upgrade the control plane** — api-server, controller-manager, scheduler, etcd. On kubeadm: `kubeadm upgrade plan` then `kubeadm upgrade apply v1.30.x` on the first control-plane node, then `kubeadm upgrade node` on the rest. On managed: trigger the control-plane upgrade via the console/CLI; the cloud rolls it. The api-server must be upgraded before any kubelet reaches the new version.
3. **Upgrade nodes, one at a time** — for each node: `kubectl cordon`, `kubectl drain` (respecting PDBs), upgrade the kubelet/runtime (or replace the node with a new-version image), `kubectl uncordon`. On managed clusters, roll the node pool (surge/rolling upgrade does cordon+drain+replace for you).
4. **Go one minor at a time** — 1.29 → 1.30 → 1.31, never skipping. Repeat the whole cycle per minor.
5. **Verify** — nodes `Ready` on the new version, workloads healthy, no PDB violations, deprecated APIs gone.

The senior notes: always upgrade control plane first (skew policy), never batch-drain all nodes, and have the etcd restore tested before you start.

### Q2. Explain the version skew policy.

Kubernetes guarantees interoperability only within bounded version gaps, and the direction matters — **the control plane leads, everything else trails**.

- **kube-apiserver** — the reference. In HA, api-server instances may differ by at most 1 minor.
- **kubelet** — may be **up to 3 minor versions older** than the api-server, but **never newer**. (This widened from 2 to 3 in recent releases.) So a 1.31 api-server tolerates 1.28–1.31 kubelets.
- **kube-controller-manager / kube-scheduler / cloud-controller-manager** — may trail the api-server by 1 minor, never lead.
- **kube-proxy** — matches its node's kubelet range.
- **kubectl** — supported within 1 minor of the api-server either direction.

Two operational consequences: (1) **upgrade the control plane first** — if you upgraded a node's kubelet ahead of the api-server, you'd violate "never newer" and behaviour is undefined. (2) **You cannot skip minors** — because each component only tolerates a bounded skew, you must step through every minor so the control plane and nodes are never further apart than the policy allows. The whole "control plane first, one minor at a time" ritual falls directly out of this policy.

### Q3. How do you handle deprecated / removed APIs during an upgrade?

Removed APIs are the number-one cause of upgrades breaking workloads. An API version (e.g. `networking.k8s.io/v1beta1` Ingress, `policy/v1beta1` PDB, `batch/v1beta1` CronJob) gets **deprecated**, then **removed** in a later minor. On the removal release, any manifest or controller still using it stops working.

Process:

1. **Detect** — before upgrading, scan for doomed API versions. Tools: `pluto detect-files`/`pluto detect-helm`, `kubent` (kube-no-trouble), and the api-server's own **deprecated API usage metrics** (`apiserver_requested_deprecated_apis`) which tell you what clients are still calling.
2. **Convert** — update manifests to the stable version. `kubectl convert -f old.yaml --output-version networking.k8s.io/v1` rewrites a manifest to a newer API version. Update Helm charts, operators, and CI templates too.
3. **Re-apply and verify** — apply the converted manifests, confirm objects are stored under the new version. Note that etcd stores objects in a single **storage version**; on read the api-server converts, so old objects auto-migrate as you re-apply.
4. **Then upgrade.**

The trap: you can be running fine on 1.28 with a `v1beta1` Ingress because the api-server still serves it — the breakage only lands when you jump to the minor that *removes* it. That's why you scan *before* every upgrade, not after something breaks.

### Q4. Walk through the node drain process and what can go wrong.

Draining safely evicts a node's pods without dropping traffic:

```bash
kubectl cordon node-1                          # stop NEW pods landing here
kubectl drain node-1 \
  --ignore-daemonsets \                        # DaemonSet pods are expected to stay
  --delete-emptydir-data \                     # allow evicting pods with emptyDir
  --grace-period=60 \                          # respect termination grace
  --timeout=300s                               # give up after 5 min
# ... do maintenance / upgrade / replace ...
kubectl uncordon node-1                        # allow scheduling again
```

`drain` issues **Eviction API** calls, which is what makes it honor **PodDisruptionBudgets** — if evicting a pod would breach a PDB, the eviction is *rejected* and drain retries until it can proceed safely. Each evicted pod gets a graceful shutdown (SIGTERM → grace period → SIGKILL), and readiness gates pull it from Service endpoints first.

What goes wrong:
- **No PDB** → drain evicts all replicas at once → outage. Always define PDBs for real services.
- **PDB too strict** (`minAvailable: 100%`) → drain **blocks forever**; nothing can be evicted.
- **Pods with no controller** (bare pods) → drain refuses unless `--force`; they won't be recreated elsewhere.
- **Long/absent `preStop` or slow SIGTERM handling** → in-flight requests dropped; the pod dies before connections drain.
- **emptyDir data** → drain refuses without `--delete-emptydir-data`; you may lose scratch data.

The senior point: a clean drain depends on good *workload* config (PDBs, readiness, graceful shutdown) as much as the drain command itself.

### Q5. What are PodDisruptionBudgets and how do they interact with cluster operations?

A **PDB** caps **voluntary disruptions** — how many pods of a selected set may be down *at once* due to operations like node drains, cluster autoscaler scale-down, or rolling node upgrades. It does **not** protect against *involuntary* disruptions (a node hardware failure, an OOMKill).

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: web-pdb }
spec:
  minAvailable: 2            # or maxUnavailable: 1
  selector:
    matchLabels: { app: web }
```

During a drain, the **Eviction API** consults the PDB: if evicting the next pod would drop availability below `minAvailable` (or above `maxUnavailable`), the eviction is **rejected** and drain waits/retries. This is what lets you roll an entire node fleet during an upgrade without ever taking a service below its safe replica count — pods migrate a few at a time as capacity allows.

Guidance: set `minAvailable` to your true minimum serving capacity (e.g. `minAvailable: 2` for a 3-replica service, or use a percentage). Two anti-patterns: **no PDB** (drains/scale-downs can nuke all replicas simultaneously) and **`minAvailable` == replica count** (nothing can *ever* be evicted, so drains hang forever and the autoscaler can't reclaim nodes). PDBs are the contract between "the platform wants to move your pods" and "your service must stay up."

### Q6. Explain etcd's role and why it's the critical component.

**etcd** is the distributed key-value store that holds **all cluster state** — every object you've ever created (Pods, Deployments, Secrets, ConfigMaps, RBAC, CRDs). The api-server is the *only* component that talks to it; everything else goes through the api-server. So etcd is the single source of truth: lose it and you've lost the entire cluster's desired state, even if the nodes and workloads are still running.

Key properties:
- **Raft consensus** — etcd replicates via the Raft protocol and requires a **quorum** (majority) of members to serve writes. With `N` members, quorum is `(N/2)+1`.
- **Odd member counts** — run **3 or 5** members. Odd counts maximize fault tolerance per node: 3 members tolerate 1 failure, 5 tolerate 2. A 4-member cluster tolerates only 1 failure (same as 3) while costing more and being more likely to lose quorum — never use even counts.
- **Latency-sensitive** — etcd wants fast disks (SSD) and low-latency networking between members; slow disk = slow api-server = cluster-wide latency.
- **Sensitive data** — Secrets live here; enable **encryption at rest** and restrict access.

Because it's the crown jewels, the two etcd disciplines are **quorum** (odd members, spread across failure domains) and **backups** (tested snapshot + restore). On managed clusters the cloud runs etcd for you — you can't snapshot it, which is *why* you also need object-level backups (Velero).

### Q7. How do you back up and restore etcd?

On a self-managed cluster you snapshot etcd directly with `etcdctl`:

```bash
# Backup
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%F).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

etcdctl snapshot status /backup/etcd-2026-07-02.db -w table   # verify
```

**Restore** (disaster recovery):

```bash
# Stop the api-server and etcd, then restore into a fresh data dir:
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-2026-07-02.db \
  --data-dir=/var/lib/etcd-restored
# Point etcd's static pod manifest at the new data dir, restart etcd, then the api-server.
```

Discipline that matters:
- **Automate and schedule** snapshots (e.g. a CronJob or systemd timer), and **ship them off-cluster** (object storage) — a backup on the failed node is useless.
- **Test restores regularly.** An untested backup is a hope, not a plan; the classic incident is discovering during an outage that restores never worked.
- Restoring **rewinds cluster state** to the snapshot moment — objects created after the snapshot vanish. Understand the data-loss window (RPO) your backup interval implies.
- On **managed clusters** you cannot run `etcdctl`; the provider owns etcd. Your DR path is object-level backup (Velero) plus GitOps-declared manifests you can re-apply.

### Q8. Managed (EKS/GKE/AKS) vs self-managed clusters — what changes?

The dividing line is the **control plane**. Managed offerings run and SLA the api-server, scheduler, controller-manager, and **etcd** for you — including their upgrades, backups, HA, and patching. You lose direct access (no `etcdctl`, no api-server flags beyond what they expose) but gain not operating the hardest, most stateful part.

| Concern | Managed (EKS/GKE/AKS) | Self-managed (kubeadm/kops) |
|---|---|---|
| Control plane + etcd | Cloud runs it (SLA'd) | You run, upgrade, back up etcd |
| Nodes | You manage (or use auto-provisioned pools) | You manage entirely |
| Control-plane upgrade | One click/API call | `kubeadm upgrade` yourself |
| Node upgrades | Managed node groups / auto-upgrade channels | Manual cordon/drain/replace |
| Networking/identity | Cloud CNI + IRSA/Workload Identity | You pick and wire CNI |
| Cost | Control-plane fee + nodes | Just nodes (but your ops time) |

What stays yours on managed: **workload availability, node capacity/cost, RBAC, quotas, NetworkPolicy, deprecated-API migration, and application-level backups (Velero)**. Node lifecycle is often shared: **node groups/pools** with **auto-upgrade channels** (GKE release channels: rapid/regular/stable) roll nodes for you, or **Karpenter/cluster-autoscaler** provisions them just-in-time. The interview point: "managed" removes control-plane toil, not *all* toil — you still own everything above the api-server, and you must design workloads (PDBs, probes) so the provider's node rolls don't hurt you.

### Q9. How does the Cluster Autoscaler work, and how does Karpenter differ?

Both add and remove nodes so pods have somewhere to run without paying for idle capacity — but at different granularities.

**Cluster Autoscaler (CA)** works at the **node-group** level. It watches for **pending (unschedulable) pods**: when a pod can't be scheduled because no node has room, CA increases the desired size of a matching node group (ASG/MIG), the cloud launches an identical node, and the pod schedules. For scale-down, it finds nodes that are underused and whose pods can be moved elsewhere (respecting PDBs and `do-not-evict` annotations), drains them, and removes them. Constraint: you pre-define node groups with fixed instance types, so CA can only scale within those shapes.

**Karpenter** (AWS-origin, now broader) works **node-group-less**. Instead of resizing predefined groups, it looks at the *actual resource requirements* of pending pods and **provisions a right-sized node just-in-time** — picking the cheapest instance type (including spot) that fits, from a broad set. It also does **consolidation**: continuously repacking pods onto fewer/cheaper nodes and terminating the emptied ones. This yields tighter bin-packing, faster scale-up (no ASG round-trip), and lower cost, at the price of more churn.

| | Cluster Autoscaler | Karpenter |
|---|---|---|
| Unit | Predefined node groups | Individual, right-sized nodes |
| Instance choice | Fixed per group | Picks optimal type per workload |
| Scale-up trigger | Pending pods → grow group | Pending pods → launch fitted node |
| Cost optimization | Coarse | Fine (consolidation, spot) |

Both are just controllers reacting to unschedulable pods — level-triggered reconciliation applied to capacity.

### Q10. How do you approach capacity planning, bin-packing, and cost optimization?

The goal is high **utilization** (few idle nodes) without starving workloads. Levers, in order of impact:

1. **Right-size requests.** The scheduler bin-packs on **requests**, so wrong requests wreck utilization. Over-requesting strands capacity (nodes look full but sit idle); under-requesting causes overcommit and eviction. Measure actual usage (metrics-server / Prometheus) and set requests near real usage; use **VPA** (Vertical Pod Autoscaler) in recommendation mode to guide it.
2. **Autoscale the fleet.** Cluster Autoscaler or Karpenter to match node count to demand; scale to near-zero off-peak.
3. **Use cheap capacity for the right workloads.** **Spot/preemptible** node pools for fault-tolerant, stateless, or batch work (they can be reclaimed with ~2 min notice) — big savings; keep stateful/critical pods on on-demand. Steer with taints + tolerations and nodeAffinity.
4. **Bin-pack densely.** Karpenter consolidation or CA scale-down repacks pods onto fewer nodes. Watch for anti-affinity/topology-spread rules that *prevent* packing (sometimes intentionally, for HA).
5. **Over-provision deliberately** for burst: run low-priority "pause" pods that the scheduler evicts instantly when real pods arrive, so scale-up latency doesn't stall traffic.
6. **HPA** for horizontal scaling on load, so you're not sized for peak 24/7.

The framing: requests drive packing, autoscalers drive node count, spot drives price, and PDBs/anti-affinity are the guardrails that keep cost optimization from breaking availability. Always measure before squeezing.

### Q11. How do you handle multi-tenancy — one big cluster or many small ones?

Two models, chosen by how much **isolation** the tenants need.

**Soft multi-tenancy (shared cluster)** — separate tenants by **namespace**, and stack the isolation primitives:
- **Namespaces** — the boundary for names, RBAC, quotas, policies.
- **ResourceQuota + LimitRange** — cap each namespace's CPU/mem/object counts so one tenant can't starve others.
- **RBAC** — scope each tenant's ServiceAccounts/users to their namespace only.
- **NetworkPolicy** — default-deny cross-namespace traffic so tenants can't reach each other's pods.
- **PriorityClasses / node taints** — optionally pin tenants to node pools.

Cheap and dense, but the **kernel and control plane are shared** — a node compromise or a noisy CRD can cross tenant lines. Good for trusted internal teams.

**Hard multi-tenancy (cluster-per-tenant)** — give each tenant (or each security domain) its **own cluster**. Strong isolation (separate control plane, etcd, nodes), independent upgrade cadence, blast-radius contained — at higher cost and operational overhead (N clusters to run, patch, and observe; fleet tooling like Fleet/Argo/Cluster API helps). Required for untrusted tenants, strict compliance boundaries, or hostile workloads.

The senior answer names the tradeoff explicitly: shared clusters optimize cost and density but rely on soft boundaries; separate clusters optimize isolation and blast-radius at operational cost. Many orgs land in the middle — shared clusters per environment/team, separate clusters across trust and compliance boundaries.

### Q12. What day-2 concerns beyond upgrades keep a cluster healthy? (certificates, monitoring)

The unglamorous maintenance that prevents 3am pages:

- **Certificate rotation.** The control plane runs on a web of TLS certs (api-server, etcd peers, kubelet client certs). Many default to **1-year** expiry. Expired certs are a classic self-managed outage — the api-server or kubelets suddenly can't talk. kubeadm auto-renews most on `kubeadm upgrade`; otherwise `kubeadm certs renew all` and monitor `kubeadm certs check-expiration`. Kubelet certs can auto-rotate (`--rotate-certificates`). Managed clusters handle control-plane certs for you.
- **Monitor the control plane.** Watch api-server latency and error rates, etcd disk/latency/quorum, scheduler scheduling latency, and controller-manager work-queue depth. Alert on `apiserver_request_duration`, etcd `fsync` latency, and certificate expiry approaching.
- **Backups.** Both etcd snapshots (self-managed) and object/PV backups (Velero) — tested restores, off-cluster storage.
- **Node hygiene.** Watch disk/memory/PID pressure; garbage-collect unused images; monitor kubelet health.
- **Resource governance.** Keep ResourceQuotas and LimitRanges current so namespaces can't exhaust the cluster.
- **Security patching.** Node OS/kernel patches, runtime (containerd) updates, and rotating any exposed credentials.

The theme: a cluster is a living system with expiring certs, filling disks, and drifting capacity. Day-2 SRE is monitoring these and acting *before* they cause an outage, not after.

### Q13. What is Velero and how does it differ from an etcd backup?

**Velero** backs up and restores **Kubernetes API objects and persistent volumes** by talking to the api-server — not by snapshotting etcd. It lists resources (optionally filtered by namespace/label), serializes them to object storage (S3/GCS/Azure Blob), and for stateful workloads snapshots the underlying PVs (via cloud volume snapshots or its file-level backup, restic/Kopia).

```bash
velero backup create prod-daily --include-namespaces prod
velero restore create --from-backup prod-daily
velero schedule create nightly --schedule="0 2 * * *" --ttl 168h
```

Difference from etcd snapshot:

| | etcd snapshot | Velero |
|---|---|---|
| Layer | Raw datastore | Kubernetes API objects + PVs |
| Granularity | Whole cluster, all-or-nothing | Per-namespace / per-label selective |
| PV data | No (just object metadata) | Yes (volume snapshots) |
| Managed clusters | Not possible (no etcd access) | Works (API-level) |
| Use case | Full self-managed cluster DR | Namespace migration, selective restore, PV backup, managed-cluster DR |

Because etcd holds only object *definitions*, an etcd restore brings back Deployments and PVCs but **not the data inside the volumes** — you'd still need PV snapshots. And on EKS/GKE/AKS you can't snapshot etcd at all, so **Velero is the practical backup/DR tool** for most teams: it also enables cluster-to-cluster **migration** (back up namespace here, restore there) and selective recovery of a single accidentally-deleted namespace.

### Q14. How do you migrate workloads between clusters (blue-green clusters)?

When an in-place upgrade is too risky (major version jump, CNI change, region move), stand up a **new (green) cluster** alongside the old (blue) one and shift traffic:

1. **Build green** at the target version/config; install the same platform stack (ingress, CNI, operators, observability) via GitOps so it's reproducible.
2. **Replicate workloads.** Apply the same manifests (ideally from a Git source of truth) to green; migrate persistent data — via **Velero** backup/restore, storage-level replication, or app-level replication (e.g. database followers promoted in green).
3. **Warm and validate** green: run smoke tests, replay traffic, confirm parity.
4. **Shift traffic gradually** at the layer above the cluster — DNS weighting, a global load balancer, or a service mesh — moving a small percentage first, watching error rates, then ramping. This is the cluster-level analogue of a canary/blue-green deploy.
5. **Cut over and keep blue as rollback** until confident; then decommission blue.

Advantages: near-zero-downtime, instant rollback (shift traffic back to blue), and you avoid mutating a running control plane. Cost: you pay for two clusters during the migration and must handle **stateful data** carefully (the hard part — coordinating the data cutover so you don't split-brain or lose writes). GitOps (Argo CD/Flux) makes this tractable because the entire cluster's desired state is declarative and re-appliable to any cluster. Use blue-green clusters for risky changes; use in-place rolling upgrades for routine minor bumps.

### Q15. A drain is hanging and won't complete. How do you diagnose it?

`kubectl drain` blocking almost always means the **Eviction API is refusing to evict** something. Work through the usual suspects:

```bash
kubectl get pods -o wide --field-selector spec.nodeName=node-1   # what's left on the node
kubectl get pdb -A                                               # the likely culprit
```

1. **PDB won't allow it.** Check `kubectl get pdb -A` — if `ALLOWED DISRUPTIONS` is `0`, evictions are blocked. Causes: `minAvailable` equals the replica count, or the app already has unhealthy pods so there's no headroom. Fix by scaling up first, relaxing the PDB, or healing the existing pods. This is the most common cause.
2. **No controller / bare pods.** Drain won't evict a pod not managed by a controller (nothing would recreate it). It errors unless you add `--force` (accepting the pod won't come back).
3. **emptyDir data.** Drain refuses pods with `emptyDir` unless `--delete-emptydir-data`.
4. **Slow graceful shutdown.** A pod with a long grace period or a `preStop` hook that hangs takes the full timeout. Check `terminationGracePeriodSeconds` and the app's SIGTERM handling.
5. **Stuck Terminating pod.** A pod that won't finish terminating (finalizer, unresponsive kubelet) stalls the drain — see the "pod stuck Terminating" playbook.

Diagnostic command: `kubectl drain node-1 --dry-run=server` (or watch its stderr) tells you *which* pod it can't evict and why. The fix is usually PDB headroom, not force-deleting — reaching for `--force`/`--disable-eviction` bypasses the very safety the drain exists to provide.

### Q16. How do you deal with cluster-wide resource pressure — the cluster is full?

"Full" means the scheduler can't place pods (they sit **Pending** with `Insufficient cpu/memory`) and/or nodes are evicting pods under memory/disk pressure. Triage from symptom to lever:

1. **Confirm the shape of the pressure.**
   ```bash
   kubectl get pods -A --field-selector status.phase=Pending
   kubectl describe node | grep -A5 Allocated          # requests vs capacity per node
   kubectl top nodes                                    # actual usage
   kubectl get events -A | grep -i 'evict\|pressure\|Insufficient'
   ```
   Distinguish **requests exhausted** (scheduler math full, even if actual usage is low) from **real usage pressure** (nodes OOMing/evicting).
2. **If requests are the bottleneck** — you're likely **over-requesting**. Right-size requests down to real usage; that frees schedulable capacity immediately without new nodes.
3. **Add capacity** — if genuinely out of resources, let **Cluster Autoscaler/Karpenter** add nodes; if not autoscaled, grow the node group. Karpenter provisions right-sized nodes for the pending pods directly.
4. **Shed or prioritize** — use **PriorityClasses** so critical pods **preempt** low-priority ones when full; move batch/best-effort work to spot pools or off-peak. Node pressure evicts BestEffort then Burstable pods first, so QoS class determines who dies.
5. **Fix the root cause** — a memory leak filling nodes, a runaway Job creating thousands of pods, or disk pressure from unrotated logs/unpruned images (`kubelet` image GC, log rotation).

The senior framing: separate **scheduling pressure** (requests vs capacity — fix with right-sizing + autoscaling) from **runtime pressure** (actual mem/disk — fix with limits, QoS/priority, and finding the leak). Reaching for "add nodes" without checking whether requests are inflated just scales the waste.

## Troubleshooting & Scenario Playbooks

### Summary

**What this topic covers**

The capstone: "here's a broken cluster, debug it." This is where every prior topic gets exercised under pressure. The `### Summary` lays out a **systematic method** — describe the object first, read events, then logs, then work outward to node/scheduler/network — and the 17 questions are concrete **playbooks** for the failures you'll actually be handed in an interview and on-call: Pending pods, CrashLoopBackOff, ImagePullBackOff, OOMKilled, a Service returning nothing, DNS failures, pods stuck Terminating, NotReady nodes, stuck rollouts, unschedulable-despite-capacity, intermittent 5xx during deploys, api-server/etcd latency, evicted pods, and failing `kubectl exec`. Each answer is a command sequence and a decision tree, not hand-waving. The goal is to show you don't *guess* — you follow evidence: the events and status fields almost always tell you what's wrong before you ever open the logs.

**Mental model**

Debugging Kubernetes is reading a state machine, not divining. Every workload flows through a pipeline: **admitted → scheduled → image pulled → container started → probes pass → endpoints added → traffic served.** A failure is always *stuck at one stage*, and Kubernetes tells you which stage in plain text. So the method is mechanical: **`kubectl describe` the object first** — its `Status`, `Conditions`, and especially the **Events** at the bottom explain the majority of failures (FailedScheduling, Failed pull, BackOff, Unhealthy probe). Only if events don't resolve it do you go to **logs** (`kubectl logs`, and `--previous` for a crashed container), then **the node** (kubelet, pressure), then **networking** (endpoints, DNS, policy). Always ask "which stage of the pipeline is this pod stuck at, and what did the controller responsible for that stage say?" You move *outward* from the object: pod → its controller → node → scheduler → network. Guessing skips stages; the discipline is to let each layer's events point you to the next.

**Key terms**

- **`kubectl describe`** — dumps an object's spec, status, conditions, and recent **Events**; the first command in almost every playbook.
- **Events** — timestamped records (from scheduler, kubelet, controllers) explaining what happened to an object; TTL'd (~1h), namespaced.
- **Pod phase** — `Pending` / `Running` / `Succeeded` / `Failed` / `Unknown`; the coarse lifecycle state.
- **CrashLoopBackOff** — a container keeps exiting; kubelet restarts it with exponential backoff.
- **ImagePullBackOff / ErrImagePull** — kubelet can't pull the image (name, tag, auth, or network).
- **OOMKilled (exit 137)** — the kernel killed a container for exceeding its memory limit.
- **Endpoints / EndpointSlice** — the ready pod IPs behind a Service; **empty** = no traffic served.
- **`kubectl logs --previous`** — logs from the *prior* (crashed) container instance — essential for CrashLoopBackOff.
- **`kubectl debug`** — attach an ephemeral debug container to a running pod, or a node debug pod.
- **Readiness probe** — gates whether a pod is in Service endpoints; a failing one silently removes traffic.
- **progressDeadlineSeconds** — how long a Deployment rollout may stall before it's marked failed.
- **Exit code** — the container's exit status; 0 clean, 1 app error, 137 SIGKILL/OOM, 143 SIGTERM.

**Why interviewers ask this**

This is the highest-signal topic because it's unfakeable — you either have the muscle memory or you don't. Junior candidates jump to a guess ("restart it," "it's probably DNS") and start changing things. Senior candidates run `kubectl describe`, read the events aloud, and let the evidence narrow the cause before touching anything. Interviewers hand you a symptom ("pod's been Pending for 10 minutes") to watch your *process*: do you check scheduling constraints methodically, or flail? For SRE/on-call roles this is the job — a calm, ordered method under pressure, knowing exactly which command reveals which fact, and reasoning about blast radius before acting. The best answers also state what they'd check *to rule things out*, showing hypothesis-driven debugging rather than pattern-matching.

**Common confusions**

- "Check logs first" — for scheduling/pull/crash-on-start failures there are **no logs yet**; **events** (`describe`) are the first source. Logs come after the container has actually run.
- "CrashLoopBackOff is an error" — it's a *state*: the container exits and kubelet keeps restarting it with backoff. The real cause is the exit code + `logs --previous`.
- "A Service problem means the Service is broken" — usually the **endpoints are empty** (selector mismatch or no ready pods); the Service object is fine.
- "OOMKilled means a memory leak" — maybe, or the **limit is just set too low** for normal usage. Compare actual usage to the limit before assuming a leak.
- "Pending means the cluster is full" — one possible cause; also taints, affinity, unbound PVC, or quota. Read the FailedScheduling event; it says which.
- "`kubectl exec` failing means the pod is down" — could be the container has no shell, isn't running yet, or a kubelet/node issue — different fixes.

**What follows from this topic**

This topic is the integration test for the whole primer. Pending-pod debugging exercises scheduling, taints, affinity, requests, and PVCs. CrashLoopBackOff and OOMKilled exercise probes, resources, and QoS. Service/DNS/NetworkPolicy playbooks exercise the networking topic end to end. Stuck rollouts and 5xx-during-deploys exercise Deployments, readiness, and graceful shutdown. NotReady nodes and stuck-Terminating pods exercise Cluster Operations and the finalizer/controller model. If any earlier topic felt abstract, these playbooks are where it becomes concrete — because in an incident you don't get to pick which layer broke.

### Q1. What is your systematic approach to debugging a broken pod?

Follow the pod's lifecycle pipeline and let each stage's evidence point to the next. **Describe first, guess never.**

```bash
kubectl get pod my-pod -o wide            # phase, restarts, node, age
kubectl describe pod my-pod               # STATUS + CONDITIONS + EVENTS (read the events!)
kubectl logs my-pod                       # if the container has actually run
kubectl logs my-pod --previous            # if it crashed/restarted
kubectl get events --sort-by=.lastTimestamp -n <ns>   # cluster-level context
```

The ordered method:

1. **Status/phase** — `Pending` (not scheduled or not started), `Running` (started; maybe failing probes), `CrashLoopBackOff` (restarting), `Terminating` (stuck deleting), `Failed`.
2. **Events** (bottom of `describe`) — this resolves most cases: `FailedScheduling`, `Failed to pull image`, `Back-off restarting`, `Unhealthy` (probe), `OOMKilled`.
3. **Logs** — only meaningful once the container ran; use `--previous` for the crashed instance and check the **exit code** in `describe` (137 = OOM, 1 = app error).
4. **Node** — if the pod's fine but the node's sick: `kubectl describe node`, check pressure conditions and kubelet.
5. **Networking** — for connectivity issues: endpoints, DNS, NetworkPolicy.

The throughline: identify **which pipeline stage the pod is stuck at** (scheduled? pulled? started? ready? endpointed?), read what the controller for that stage reported, and only then act. This is the method the remaining questions apply to specific symptoms.

### Q2. A pod is stuck in Pending. Diagnose it.

`Pending` means **not yet scheduled** (or scheduled but containers not started). The scheduler writes the exact reason as a `FailedScheduling` event — read it first:

```bash
kubectl describe pod my-pod        # look at Events: "0/6 nodes are available: ..."
```

The event text names the cause; map it to the fix:

- **`Insufficient cpu/memory`** — no node has enough *requestable* capacity. Lower requests, free capacity, or add nodes (autoscaler). Note it's about **requests**, not actual usage.
- **`node(s) had untolerated taint`** — nodes are tainted and the pod lacks the toleration. Add a toleration or target untainted nodes.
- **`node(s) didn't match node affinity/selector`** — `nodeSelector`/`nodeAffinity` matches no node (e.g. `disktype: ssd` label absent). Fix the selector or label a node.
- **`node(s) didn't match pod affinity/anti-affinity`** or **`didn't satisfy topology spread`** — placement constraints unsatisfiable. Relax them or add topology.
- **`pod has unbound immediate PersistentVolumeClaims`** — the PVC isn't bound (no matching PV / StorageClass issue / zone mismatch). `kubectl get pvc` and `describe pvc`.
- **`exceeded quota`** — namespace ResourceQuota is full. `kubectl describe resourcequota -n <ns>`.

```bash
kubectl get nodes                                  # any nodes at all?
kubectl describe node | grep -A5 'Allocated\|Taints'
kubectl get pvc -n <ns>                            # Bound?
kubectl describe resourcequota -n <ns>
```

Decision tree: read the FailedScheduling event → it tells you resources vs taints vs affinity vs PVC vs quota → apply the matching fix. Don't assume "cluster full"; the event is specific.

### Q3. A pod is in CrashLoopBackOff. Walk me through it.

CrashLoopBackOff is a **state**, not a root cause: the container starts, **exits**, and kubelet restarts it with exponential backoff (10s, 20s, 40s… capped at 5min). Your job is to find *why it exits*.

```bash
kubectl logs my-pod --previous          # logs from the CRASHED instance — the key command
kubectl describe pod my-pod             # Last State: Terminated, Reason, Exit Code
```

Read the **exit code** (in `describe` under `Last State`) plus the previous logs:

- **Exit 1 / app stack trace** — application error: bad config, missing env var, can't reach a dependency (DB, secret), unhandled exception on startup. Logs show it.
- **Exit 137 (OOMKilled)** — memory limit too low or a leak — see the OOM playbook.
- **Exit 143 (SIGTERM)** — being terminated externally; often a failing **liveness probe** killing a slow-starting app.
- **Config/secret missing** — `describe` shows `CreateContainerConfigError` (missing ConfigMap/Secret key).
- **Liveness probe too aggressive** — app needs 30s to start but liveness fires at 5s → kubelet kills it repeatedly → crash loop that isn't the app's fault. Fix with a **startupProbe** or a longer `initialDelaySeconds`.

Decision tree: `logs --previous` → is it an app error (fix config/deps) or a kill (check exit code)? → 137 → OOM path; 143 + healthy app → probe misconfig; app trace → fix the app/config. If the container has no logs at all, it's dying before app code runs — check the command/entrypoint and `CreateContainerError`. To poke around without the crash loop, override the command: `kubectl debug` or run a copy with `command: ["sleep","3600"]`.

### Q4. A pod shows ImagePullBackOff / ErrErrImagePull. What's wrong?

The kubelet can't pull the container image. `describe` gives the precise reason; it's one of four things:

```bash
kubectl describe pod my-pod    # Events: "Failed to pull image ...: <reason>"
```

1. **Wrong image name or tag** — typo, or a tag that doesn't exist (`my-app:latset`, or `:v2.0` never pushed). Event: `manifest unknown` / `not found`. Fix the reference; verify with `docker/crane manifest inspect`.
2. **Registry authentication** — private registry, no/invalid credentials. Event: `unauthorized` / `authentication required`. The pod needs an **imagePullSecret**:
   ```bash
   kubectl create secret docker-registry regcred \
     --docker-server=my-registry.example.com \
     --docker-username=alice --docker-password=... 
   # reference it in the pod spec or the ServiceAccount's imagePullSecrets
   ```
   On EKS/GKE, prefer node IAM / Workload Identity to the registry (ECR/GAR) over static secrets.
3. **Network / registry unreachable** — node can't reach the registry (egress firewall, no NAT, DNS). Event: `dial tcp ... i/o timeout`. Check node egress and private-registry endpoints.
4. **Rate limiting** — Docker Hub anonymous pull limits: `toomanyrequests`. Authenticate or mirror the image.

Decision tree: read the event reason → `not found` = name/tag → `unauthorized` = imagePullSecret/IAM → `timeout` = network/egress → `toomanyrequests` = rate limit. Note `imagePullPolicy: Always` re-pulls every start; `IfNotPresent` uses cached layers (relevant when the registry is flaky).

### Q5. A container was OOMKilled (exit code 137). How do you investigate?

Exit **137** = 128 + 9 (SIGKILL): the kernel's OOM killer terminated the container for exceeding its **memory limit** (or the node ran out of memory). Confirm and then decide *leak vs undersized limit*.

```bash
kubectl describe pod my-pod        # Last State: Terminated, Reason: OOMKilled, Exit Code: 137
kubectl top pod my-pod             # current usage vs limit
```

Investigate:

1. **Compare actual usage to the limit.** Look at usage over time (metrics-server/Prometheus). Two very different root causes:
   - **Limit too low** — the app legitimately needs more than the limit under normal load. The limit was guessed. Raise `resources.limits.memory` (and requests) to fit real usage plus headroom.
   - **Memory leak** — usage climbs steadily until it hits the limit, restarts, climbs again (sawtooth). Fix the app; the limit is doing its job by containing the blast radius.
2. **Node-level OOM vs container-level.** If the *container* exceeded its own limit → OOMKilled on that container. If the **node** ran out of memory, the kubelet evicts pods (different: `Evicted`, node MemoryPressure) — check `kubectl describe node`. A pod with `limits > requests` (Burstable) can get killed when the node is squeezed even below its own limit.
3. **JVM/runtime specifics** — runtimes that don't respect cgroup limits will over-allocate; ensure container-aware flags (modern JVMs auto-detect cgroup memory).

Decision tree: 137 confirmed → chart usage → flat-but-above-limit = raise the limit; steadily-climbing = leak (fix app); node pressure/`Evicted` = node capacity, not this container. Set requests≈limits (Guaranteed QoS) for memory-sensitive workloads so they're last to be evicted.

### Q6. A Service returns nothing / connection refused. Debug the whole path.

A Service is a virtual IP that load-balances to its **endpoints** (ready pod IPs). "Nothing comes back" almost always means **the endpoints list is empty** or traffic is blocked. Check endpoints first — it bisects the problem instantly.

```bash
kubectl get endpoints my-svc          # or: kubectl get endpointslices -l kubernetes.io/service-name=my-svc
kubectl describe svc my-svc           # selector + ports
```

Decision tree:

1. **Endpoints empty?** The Service isn't finding ready pods. Causes:
   - **Selector mismatch** — the Service's `selector` labels don't match the pods' labels. Compare `kubectl describe svc` selector to `kubectl get pods --show-labels`. Most common cause.
   - **No ready pods** — pods exist but fail **readiness probes**, so they're excluded from endpoints. `kubectl get pods` (READY column 0/1), check the readiness probe. Traffic to a Service with zero ready endpoints gets connection refused / times out.
2. **Endpoints present but still failing?**
   - **Port mapping wrong** — `targetPort` doesn't match the container's actual listening port, or the container listens on `127.0.0.1` not `0.0.0.0`. Verify with `kubectl exec` + `curl localhost:<port>` inside a pod.
   - **NetworkPolicy** — a default-deny policy blocks the client → pod traffic. `kubectl get networkpolicy -n <ns>`; check whether an ingress rule allows the caller.
   - **Wrong Service type/path** — for external access, is it ClusterIP (in-cluster only) when you expected LoadBalancer? Is the LB provisioned (`EXTERNAL-IP` pending)?
3. **Test from inside the cluster** to isolate DNS vs routing:
   ```bash
   kubectl run tmp --rm -it --image=nicolaka/netshoot -- \
     sh -c 'curl -v my-svc.my-ns.svc.cluster.local:80'
   ```

The bisection: empty endpoints → selector/readiness problem (control plane); populated endpoints but no response → port/policy/network problem (data plane).

### Q7. DNS resolution is failing inside pods. How do you troubleshoot?

Cluster DNS is **CoreDNS** (pods behind the `kube-dns` Service, usually at `10.96.0.10`). Pods get it via `/etc/resolv.conf`. Isolate whether it's CoreDNS, config, or a specific record.

```bash
kubectl run tmp --rm -it --image=nicolaka/netshoot -- bash
# inside:
cat /etc/resolv.conf                          # nameserver = kube-dns ClusterIP? search domains? ndots?
nslookup kubernetes.default                    # in-cluster name
nslookup google.com                            # external name
nslookup my-svc.my-ns.svc.cluster.local
```

Decision tree:

1. **Is CoreDNS healthy?**
   ```bash
   kubectl get pods -n kube-system -l k8s-app=kube-dns
   kubectl logs -n kube-system -l k8s-app=kube-dns
   kubectl get svc -n kube-system kube-dns          # ClusterIP present?
   ```
   Crashed/overloaded CoreDNS → all lookups fail. Check for CoreDNS OOM or high QPS; scale it or add caching (NodeLocal DNSCache).
2. **`resolv.conf` wrong?** `nameserver` should be the kube-dns ClusterIP. If a pod uses `dnsPolicy: Default` it inherits the *node's* resolv.conf (no cluster DNS) — usually a misconfig. `ClusterFirst` is the norm.
3. **The `ndots:5` gotcha** — cluster resolv.conf sets `ndots:5`, so any name with fewer than 5 dots is first tried with every search suffix (`.my-ns.svc.cluster.local`, etc.) before being tried as-is. This makes **external lookups slow** (many failed queries first) and amplifies CoreDNS load. Fix: use FQDNs with a trailing dot (`google.com.`) for external, or tune `ndots`.
4. **NetworkPolicy blocking DNS** — a default-deny egress policy that doesn't allow UDP/TCP 53 to kube-system breaks DNS. Ensure egress to CoreDNS is permitted.
5. **Intermittent failures** — classic conntrack/UDP race on older setups; NodeLocal DNSCache mitigates.

The bisection: in-cluster names fail → CoreDNS/resolv.conf/policy; only external names fail → upstream/ndots; everything slow → ndots or CoreDNS load.

### Q8. A pod is stuck in Terminating. What's happening and how do you fix it?

When you delete a pod it goes to `Terminating`: kubelet sends SIGTERM, waits `terminationGracePeriodSeconds`, then SIGKILL. Stuck `Terminating` means something is blocking that completion. Diagnose the blocker:

```bash
kubectl get pod my-pod -o yaml | grep -A3 finalizers       # any finalizers?
kubectl describe pod my-pod                                 # events, grace period
kubectl get node <its-node>                                 # is the node Ready?
```

Common causes:

1. **Finalizers.** The pod has a `metadata.finalizers` entry and the controller responsible hasn't removed it (or is down). The pod won't delete until the finalizer clears. Find out *why* the finalizer isn't clearing (its controller); as a last resort force-remove it:
   ```bash
   kubectl patch pod my-pod -p '{"metadata":{"finalizers":null}}' --type=merge
   ```
2. **Node is gone / NotReady.** If the node hosting the pod is unreachable, the kubelet can't confirm the pod actually stopped, so the api-server won't finalize deletion. Once the node recovers it resolves; if the node is truly dead, force-delete:
   ```bash
   kubectl delete pod my-pod --grace-period=0 --force
   ```
   Caveat: `--force` tells the api-server to drop the pod object *without* confirmation that the container stopped — dangerous for StatefulSet pods (risk of two instances with the same identity if the node is actually alive). Use only when certain the node is dead.
3. **Long grace period / hanging preStop.** A `preStop` hook that never returns, or a process ignoring SIGTERM, makes it wait the full grace period. Check the app's signal handling.
4. **Unmounting volumes** — a volume that won't unmount (stuck NFS/CSI) blocks termination; check kubelet logs on the node.

Decision tree: finalizer present → find/fix its controller (force-patch last resort); node NotReady → recover node or `--force` (careful with StatefulSets); neither → slow preStop/SIGTERM or stuck volume.

### Q9. A node is NotReady. Walk me through diagnosing it.

`NotReady` means the kubelet isn't reporting healthy to the api-server; pods on it stop being trusted and (after a timeout) get rescheduled elsewhere. Work from the node's conditions down to the kubelet.

```bash
kubectl get nodes                                  # which node, how long
kubectl describe node node-1                       # Conditions + Events (the key view)
```

Read the node **Conditions**:

- **`MemoryPressure` / `DiskPressure` / `PIDPressure` = True** — the node is resource-starved; kubelet starts **evicting** pods. Fix the pressure: disk full (unrotated logs, unpruned images — kubelet image GC, `crictl rmi`), memory exhausted (a leaking pod), too many processes.
- **`Ready = Unknown`** — the api-server hasn't heard from the kubelet (node-lease not renewed): network partition between node and control plane, or kubelet crashed.

Then go to the node itself (SSH or `kubectl debug node/node-1 -it --image=busybox`):

```bash
systemctl status kubelet          # is kubelet running?
journalctl -u kubelet -n 200      # kubelet errors: cert expired, CNI not ready, runtime down
systemctl status containerd       # container runtime healthy?
df -h ; free -m                    # disk / memory
```

Decision tree: `describe node` conditions → pressure? → clear disk/mem/PID. `Ready=Unknown`? → check network to control plane and kubelet process. On the node → kubelet down (restart, check journal), containerd down (restart runtime), **expired certs** (kubelet client cert — renew; classic self-managed cause), or **CNI not ready** (kubelet stays NotReady until the network plugin is up). On managed clusters, a persistently sick node is often best **cordoned, drained, and replaced** rather than repaired.

### Q10. A Deployment rollout is stuck / not progressing. Diagnose it.

`kubectl rollout status deploy/my-app` hangs. A rollout stalls when new pods never become **Ready**, so the Deployment can't proceed past its `maxUnavailable`/`maxSurge` window.

```bash
kubectl rollout status deploy/my-app
kubectl describe deploy my-app          # Conditions: Progressing / Available; ProgressDeadlineExceeded?
kubectl get pods -l app=my-app          # what state are the NEW pods in?
```

Trace it to the new pods and diagnose *them* (they're the blocker):

1. **New pods failing readiness** — the most common cause. The new version's readiness probe never passes (app misconfig, can't reach a dependency, wrong probe path/port), so they never enter endpoints and the old pods can't be retired. Debug the new pods as CrashLoopBackOff/readiness cases.
2. **New pods can't schedule** — Pending (insufficient resources for the surge, taints, PVC). The extra surge pod has nowhere to go. See the Pending playbook; check quota — a `maxSurge` pod may exceed a ResourceQuota.
3. **Image problem** — new tag is ImagePullBackOff; rollout waits forever.
4. **`ProgressDeadlineExceeded`** — after `progressDeadlineSeconds` (default 600s) of no progress, the Deployment marks the rollout **Failed** in its Conditions (but does *not* auto-rollback). That condition confirms the stall.
5. **CrashLoopBackOff on the new version** — bad release; new pods start and die.

Fix path: identify why the new pods aren't Ready (probe / schedule / image / crash), fix forward, or **roll back**:

```bash
kubectl rollout undo deploy/my-app                 # revert to previous ReplicaSet
kubectl rollout history deploy/my-app
```

The safe production reflex: if a rollout is stuck and users are affected, `rollout undo` first (restore service), then diagnose the bad version at leisure. Because old pods are only retired as new ones go Ready, a stuck rollout usually *doesn't* cause an outage by itself — that's the design.

### Q11. A pod won't schedule onto a node that clearly has capacity. Why?

Free CPU/memory isn't sufficient for scheduling — the scheduler also enforces taints, affinity, and topology constraints. The `FailedScheduling` event names which:

```bash
kubectl describe pod my-pod        # "node(s) had untolerated taint {...}" etc.
kubectl describe node node-1 | grep -i taint
kubectl get node node-1 --show-labels
```

Reasons a node with spare capacity is still rejected:

1. **Taints without tolerations** — the node is tainted (e.g. `dedicated=gpu:NoSchedule`, or control-plane `node-role.kubernetes.io/control-plane:NoSchedule`, or a `NoSchedule` from an ongoing condition). The pod needs a matching **toleration**. This is the classic "capacity but won't land" cause.
2. **Node affinity / nodeSelector** — the pod requires labels the node lacks (`nodeSelector: {zone: us-east-1a}` but this node is `1b`).
3. **Pod anti-affinity** — the pod refuses to co-locate with pods it's anti-affine to, and such a pod is already on that node.
4. **Topology spread constraints** — `topologySpreadConstraints` with `whenUnsatisfiable: DoNotSchedule` forces even distribution; placing here would violate the spread.
5. **Extended resources** — the pod requests a resource the node doesn't advertise (`nvidia.com/gpu: 1` on a non-GPU node), regardless of CPU/mem.
6. **Node unschedulable (cordoned)** — `kubectl get nodes` shows `SchedulingDisabled`; someone cordoned it.

Decision tree: read the FailedScheduling event → taint (add toleration) / affinity-selector (fix labels or selector) / anti-affinity-topology (relax constraint) / extended resource (wrong node type) / cordoned (uncordon). "It has capacity" is a red herring; the scheduler weighs many predicates beyond raw resources.

### Q12. Users see intermittent 5xx errors during deploys. What's the cause?

Intermittent 5xx *only during rollouts* is almost always a **graceful-shutdown / readiness gap** — traffic hitting pods that are starting up or shutting down. Two failure windows:

**Shutdown race (most common).** When a pod is terminated, two things happen roughly in parallel: (1) the endpoint controller removes it from Service endpoints, and (2) the kubelet sends SIGTERM. These aren't synchronized — kube-proxy/LB may still route to the pod for a moment *after* SIGTERM, so if the app exits immediately on SIGTERM, in-flight requests get connection-refused → 5xx. Fixes:
- Add a **`preStop` hook** that sleeps briefly (`sleep 5–15`) so the pod keeps serving while it's being removed from endpoints, *then* the app gets SIGTERM.
- Make the app **drain gracefully** on SIGTERM: stop accepting new connections, finish in-flight, then exit — within `terminationGracePeriodSeconds`.

```yaml
lifecycle:
  preStop:
    exec: { command: ["sh","-c","sleep 10"] }
terminationGracePeriodSeconds: 30
```

**Startup race.** New pods enter endpoints as soon as **readiness** passes. If the readiness probe is too lenient (passes before the app can really serve — connection pools warm, caches loaded, JIT warmed), traffic arrives too early → 5xx. Fix: a **readiness probe that reflects true readiness**, plus a **startupProbe** for slow starters.

Also check: `maxUnavailable` too high (too many pods cycling at once), missing PodDisruptionBudget, and load-balancer health-check intervals lagging behind pod churn (for `externalTrafficPolicy: Local` / cloud LBs).

Decision tree: 5xx at the *end* of a pod's life → shutdown race → preStop + graceful SIGTERM. 5xx at the *start* → readiness too eager → tighten readiness/startupProbe. The tell is that it's **only during deploys**; steady state is fine.

### Q13. You're seeing high API server latency / etcd problems. How do you approach it?

High api-server latency degrades *everything* (kubectl slow, controllers lagging, rollouts crawling) because every component funnels through it — and the usual root is **etcd**, since the api-server's writes and reads bottom out there.

```bash
kubectl get --raw /metrics | grep apiserver_request_duration_seconds   # latency by verb/resource
kubectl get --raw /metrics | grep etcd_disk_wal_fsync_duration          # etcd disk latency
kubectl top nodes                                                       # control-plane node pressure
```

Work through likely causes:

1. **etcd disk latency.** etcd is fsync-bound; slow disks spike `etcd_disk_wal_fsync_duration` and `backend_commit_duration`, dragging every api-server write. Fix: fast SSDs, dedicated disk for etcd, low-latency peer network.
2. **etcd size / too many objects.** A huge number of objects (e.g. millions of Events, or a controller creating objects in a hot loop) bloats etcd and slows range queries. Check the DB size; etcd has a default ~2–8GB quota — hitting it triggers **`NOSPACE`** alarms and read-only mode. Compact and defrag; find the object flood.
3. **Expensive LIST calls.** Clients doing frequent unpaginated `LIST` of large resources (or `kubectl get pods -A` in a huge cluster) hammer the api-server. Look for a misbehaving controller not using informers/watches. Use **API Priority and Fairness** to isolate/limit noisy clients.
4. **Quorum / member health.** An etcd member down or a slow peer link degrades consensus. `etcdctl endpoint status --cluster` (self-managed) for leader, DB size, raft term.
5. **Control-plane resource pressure.** api-server CPU/mem throttling under load — scale it up.

On **managed clusters** you can't touch etcd, but you can still cause this: object floods and expensive LISTs are *your* doing. The fix is usually finding the client/controller generating the load. Decision tree: fsync/commit latency high → etcd disk; DB size huge / NOSPACE → object flood + compact/defrag; specific verbs slow → expensive LISTs (APF, fix the client); member unhealthy → quorum/peers.

### Q14. Pods are being Evicted. What does that mean and how do you respond?

`Evicted` (pod status `Failed`, reason `Evicted`) means the **kubelet** proactively killed pods to reclaim a starved **node** resource — this is *node pressure eviction*, distinct from an OOMKill of a single container or an API-driven eviction from a drain.

```bash
kubectl get pods -A | grep Evicted
kubectl describe pod <evicted-pod>       # "The node was low on resource: memory/ephemeral-storage"
kubectl describe node <node>             # Conditions: MemoryPressure / DiskPressure = True
```

What's happening: when a node crosses an eviction threshold (**memory**, **ephemeral-storage/disk**, or **inodes/PIDs**), the kubelet evicts pods to save the node, choosing victims by **QoS class and how far each exceeds its requests**:

- **BestEffort** (no requests/limits) → evicted first.
- **Burstable** (requests < limits) → next, those most over their requests.
- **Guaranteed** (requests == limits) → last.

Response:

1. **Relieve the pressure at its source.** Disk: unrotated container logs, unpruned images (kubelet image GC / `crictl rmi`), a pod filling `emptyDir` or writable layer. Memory: a leaking/over-using pod. `describe node` says which resource.
2. **Fix QoS so the right pods survive.** Set proper **requests** (so the scheduler doesn't overpack) and consider **Guaranteed** QoS for critical pods (requests==limits) to make them last-evicted.
3. **Right-size the node / add capacity** if it's genuinely undersized for the workload.
4. **Clean up evicted pod objects** — they linger as `Failed`; `kubectl delete pod --field-selector status.phase=Failed`.

The key distinction to state: **OOMKilled** = one container exceeded *its own* memory limit (exit 137); **Evicted** = the *node* was under pressure and the kubelet shed pods by QoS priority. Different triggers, different fixes — one is about the container's limit, the other about the node's capacity.

### Q15. `kubectl exec` into a pod fails. What could be wrong?

`kubectl exec` runs a process inside a container via api-server → kubelet → runtime. Failures fall into a few buckets; the error message points at which:

```bash
kubectl exec -it my-pod -- sh
kubectl exec -it my-pod -c my-container -- sh    # multi-container: specify -c
```

1. **No shell in the container.** Distroless/scratch images have no `/bin/sh`. Error: `exec: "sh": executable file not found`. Fix: use **`kubectl debug`** to attach an **ephemeral container** with a shell to the running pod — this is the modern way to debug minimal images:
   ```bash
   kubectl debug -it my-pod --image=busybox --target=my-container
   ```
2. **Pod not running.** You can't exec into a Pending, CrashLooping, or Terminating pod (no running container). `kubectl get pod` — if it's not `Running`, fix *that* first.
3. **Wrong/ambiguous container.** Multi-container pod without `-c` may target the wrong container or error. Specify `-c`.
4. **Node/kubelet unreachable.** exec needs the api-server to reach the kubelet on the node (port 10250). Error: `error dialing backend: ... timeout`. The node is NotReady, or a firewall/network issue blocks control-plane→node. Check node health.
5. **RBAC.** You may lack `pods/exec` permission. Error: `cannot exec ... forbidden`. `kubectl auth can-i create pods/exec`.
6. **Container filesystem read-only / seccomp** — the command runs but can't write; less common.

Decision tree: `executable not found` → no shell → `kubectl debug` ephemeral container; pod not `Running` → fix the pod; `forbidden` → RBAC; `error dialing backend` → node/kubelet network. `kubectl debug` (ephemeral containers, and node debug pods via `kubectl debug node/<n>`) is the tool that replaced "SSH to the node and `docker exec`" — know it.

### Q16. A cron/batch Job isn't running or keeps failing. How do you debug it?

CronJobs create Jobs on a schedule; Jobs create Pods and retry until success or `backoffLimit`. Debug at whichever layer is stuck:

```bash
kubectl get cronjob my-cron                 # LAST SCHEDULE, SUSPEND, ACTIVE
kubectl get jobs                            # COMPLETIONS, spawned Jobs
kubectl describe job my-cron-28xxxxx        # events + pod template
kubectl get pods -l job-name=my-cron-28xxxxx
kubectl logs job/my-cron-28xxxxx            # the actual failure
```

Cases:

1. **CronJob never fires.** Check `SUSPEND` (true = paused). Check the **schedule** syntax (cron format, and the cluster/controller timezone — CronJobs use the controller's zone unless `spec.timeZone` is set). Check `startingDeadlineSeconds` — if the controller missed too many starts (e.g. control-plane downtime), it may skip. Also `concurrencyPolicy: Forbid` skips a run if the previous Job is still active.
2. **Job runs but Pod fails.** Debug the pod normally (`logs`, exit code) — usual CrashLoop/config/image issues. The Job retries up to `backoffLimit` (default 6) then marks the Job `Failed`.
3. **Job hangs forever.** No `activeDeadlineSeconds` and the pod never completes → the Job runs indefinitely. Set `activeDeadlineSeconds` to bound it.
4. **Too many old Jobs/Pods piling up.** Tune `successfulJobsHistoryLimit` / `failedJobsHistoryLimit`; without cleanup, thousands of completed Job pods accumulate (and can even pressure etcd).
5. **Completions/parallelism confusion** — for parallel Jobs, check `completions` vs `parallelism` and whether the indexed completion mode is expected.

Decision tree: nothing scheduled → suspend/schedule/timezone/concurrency; Job created but Pod fails → debug the pod; Job never finishes → add `activeDeadlineSeconds`; clutter → history limits. Start at `describe cronjob`/`describe job` — the events say whether the problem is *scheduling* the Job or *running* the Pod.

### Q17. Give me a general framework: you're paged that "the app is down" with no other detail. Walk me through it.

Stay ordered and move outward — resist guessing. The goal is to localize which pipeline stage broke, fastest.

**1. Confirm scope and blast radius.**
```bash
kubectl get pods -n <ns> -o wide         # are pods Running & Ready? restarts?
kubectl get deploy,sts -n <ns>           # desired vs available replicas
```
Is it one pod, one Deployment, one node, or the whole namespace/cluster? That immediately narrows it.

**2. Is it the workload or the routing?** Check both ends:
- **Workload:** are pods `Ready`? If `0/N` ready → probe/crash/image issue → describe + logs (Q3–Q5). If Pending → scheduling (Q2).
- **Routing:** are there **endpoints**? `kubectl get endpoints my-svc`. Empty → selector/readiness (Q6). Populated but failing → NetworkPolicy/DNS/ingress (Q6–Q7). Is the Ingress/LB healthy (`EXTERNAL-IP`, ingress controller pods)?

**3. What changed?** Most incidents are a change. Recent deploy? `kubectl rollout history deploy/my-app` — if a bad rollout lines up with the outage, **`kubectl rollout undo`** first (restore, then diagnose). Recent node/cluster op, config change, secret rotation, cert expiry?

**4. Widen if not localized.** Cluster-level: `kubectl get nodes` (NotReady?), `kubectl get events -A --sort-by=.lastTimestamp`, control-plane/api-server latency (Q13). Dependencies: is a database/queue/downstream the real cause (pods Ready but erroring)?

**5. Mitigate, then root-cause.** For active user impact, prioritize **restoring service** — roll back, scale up, cordon a bad node, shift traffic — *then* investigate the underlying cause without the pressure. Capture logs/events before they TTL out.

The framing that scores: a calm, ordered method (scope → workload vs routing → what changed → widen → mitigate) driven by `describe`/events/endpoints rather than guessing, plus the on-call instinct to **mitigate first, root-cause second** when users are down. Every specific playbook above plugs into step 2 or 4 of this framework.
