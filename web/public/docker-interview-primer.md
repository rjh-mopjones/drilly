---
type: interview-prep
---

# Docker / Containers Interview Primer — 338 Questions

Comprehensive Q+A primer for senior Docker / containers / DevOps interviews. Fifth entry in the DevOps track — sister note to the [[Linux Interview Primer]], [[Kubernetes Interview Primer]], [[Observability Interview Primer]], and [[Terraform / IaC Interview Primer]]. Everything the container workflow rests on: images & layers, the Dockerfile, builds (BuildKit/multi-stage), registries, running containers, networking, volumes, Compose, resource limits, and container/image security.

Each answer is interview-shaped: opinionated, concrete, real Dockerfiles, `docker` CLI, and compose files, with failure modes and production tradeoffs. Current Docker/OCI (BuildKit default, containerd, Compose v2, rootless); Podman/nerdctl noted where relevant.

1. [[#Container Fundamentals & Architecture]]
2. [[#Images & the Image Model]]
3. [[#Layers & the Union Filesystem]]
4. [[#Dockerfile Fundamentals]]
5. [[#Dockerfile Best Practices & Layer Caching]]
6. [[#Multi-Stage Builds]]
7. [[#Image Size & Base Images]]
8. [[#CMD vs ENTRYPOINT & Container Startup]]
9. [[#Building Images: BuildKit & buildx]]
10. [[#Registries & Distribution]]
11. [[#Running Containers]]
12. [[#Networking Fundamentals]]
13. [[#Networking Deep Dive]]
14. [[#Volumes & Storage]]
15. [[#Compose Fundamentals]]
16. [[#Compose in Depth]]
17. [[#Container Resource Management & Runtime]]
18. [[#Container Security]]
19. [[#Image Security & Supply Chain]]
20. [[#Debugging & Troubleshooting]]
21. [[#Scenario & Best-Practice Playbooks]]

---

## Container Fundamentals & Architecture

### Summary

**What this topic covers**

The bedrock every Docker interview stands on: what a container actually *is*, how it differs from a virtual machine, and the moving parts that turn `docker run` into a running process. Three concern areas live here: (1) the **container model** — a container is an ordinary Linux process that the kernel has been told to lie to, isolated by namespaces, capped by cgroups, and given a private filesystem by a union mount; it is NOT a lightweight VM. (2) The **architecture** — the client-server split where the `docker` CLI talks over a socket to the `dockerd` daemon, which delegates to `containerd`, which spawns `runc` (an OCI runtime) to actually create the process. (3) The **ecosystem** — the OCI standards that mean Docker isn't the only implementation, and the alternatives (Podman, nerdctl, containerd) that reuse the same primitives. The 16 questions here move from "what is a container" to "walk me through what happens between `docker run` and a running process," and why container isolation is not the security boundary a VM is.

**Mental model**

Stop picturing a tiny computer. A container is **one (or a few) normal processes on the host, running directly on the host kernel**, that have been placed inside a set of Linux **namespaces** (so they see their own PID 1, their own network interfaces, their own mount tree, their own hostname) and constrained by **cgroups** (so they can't use more than their share of CPU, memory, or IO). The filesystem they see is a **union mount** — a stack of read-only image layers with a thin writable layer on top. That's it. There is no guest kernel, no hypervisor, no emulated hardware. `ps aux` on the host shows the container's processes as ordinary PIDs; the container just can't *see* them because its PID namespace hides them. This is why containers boot in milliseconds and pack hundreds to a host: they're processes, not machines. It's also why a container built for Linux can't run natively on a Mac kernel — Docker Desktop quietly runs a Linux VM to host the daemon.

**Key terms**

- **Container** — an isolated process (group) sharing the host kernel, bounded by namespaces + cgroups + a union filesystem.
- **Image** — a read-only, layered template; a container is a running instance of one plus a writable layer.
- **Namespace** — kernel feature that isolates *what a process can see*: `pid`, `net`, `mnt`, `uts` (hostname), `ipc`, `user`.
- **cgroup** — kernel feature that limits *what a process can use*: CPU, memory, block IO, PIDs.
- **Union filesystem** — overlays read-only layers into one view (overlay2 is the default driver).
- **dockerd** — the Docker daemon; the long-running server that manages images, containers, networks, volumes.
- **containerd** — the container runtime dockerd delegates to; manages the container lifecycle and pulls images.
- **runc** — the low-level OCI runtime that actually sets up namespaces/cgroups and `exec`s the process.
- **OCI** — Open Container Initiative; the standards (image spec, runtime spec, distribution spec) that decouple "container" from "Docker."
- **Podman** — a daemonless, rootless, drop-in Docker-compatible engine.
- **Docker Desktop VM** — on macOS/Windows there is no Linux kernel, so Docker runs a lightweight Linux VM to host the daemon.
- **Rootless Docker** — running the daemon/containers as a non-root user via user namespaces, shrinking the blast radius.

**Why interviewers ask this**

This is the single fastest way to separate someone who *uses* Docker from someone who *understands* it. The junior answer to "container vs VM" is "containers are lighter." The senior answer explains the mechanism: shared kernel vs hypervisor, namespaces for isolation, cgroups for limits, and — crucially — the *consequence*: weaker isolation, no cross-kernel portability, and that a kernel exploit escapes a container in a way it doesn't escape a VM. Interviewers also probe the architecture because operators who don't know that `dockerd` → `containerd` → `runc` exist can't debug a hung daemon, understand why Kubernetes dropped dockershim, or reason about the security implications of the Docker socket. Getting the "container is just a process" framing right up front makes the rest of the interview flow.

**Common confusions**

- "A container is a lightweight VM." It isn't — there's no guest OS or kernel. It's a process.
- "Docker and containers are the same thing." Docker is one implementation of OCI standards; containerd, Podman, and CRI-O run the same containers.
- "Containers are as isolated as VMs." No — they share the host kernel; a kernel vulnerability is a shared attack surface. Use a VM or gVisor/Kata for hard multi-tenant isolation.
- "The kernel inside the container is different from the host's." There is no kernel inside; every container on a host shares that one host kernel.
- "The Docker daemon runs the process directly." It delegates through containerd to runc; dockerd is an orchestrating API server.

**What follows from this topic**

Everything. "A container = image + writable layer" sets up **Images & the Image Model** and **Layers & the Union Filesystem**. The namespaces recap seeds the networking and volumes topics (net namespace → Docker networking; mnt namespace → bind mounts and volumes). The lifecycle (create/start/stop/rm) previews process management, signals, and PID 1 handling. And "isolation is not a security boundary" previews the security topic (non-root `USER`, dropped capabilities, `--read-only`). Get the mechanism right here and later topics stop feeling like disconnected trivia.

### Q1. What is a container, really?

A **container is an isolated process** (or small group of processes) running directly on the host's Linux kernel. Three kernel features make it a "container":

- **Namespaces** isolate what the process can *see* — its own PID tree (it thinks it's PID 1), its own network stack, its own mounted filesystem, its own hostname.
- **cgroups** limit what the process can *use* — CPU shares, memory ceiling, IO bandwidth.
- **A union filesystem** gives it a private root filesystem, assembled from read-only image layers plus a thin writable layer.

No hypervisor, no guest OS, no emulated hardware. On the host, `ps aux` shows the containerized process as an ordinary PID — the container just can't see the rest of the host because its namespaces hide them. That's why containers start in milliseconds and you can run hundreds on one host.

### Q2. How is a container different from a virtual machine?

| | Container | Virtual machine |
|---|---|---|
| Kernel | Shares the host kernel | Runs its own guest kernel |
| Isolation mechanism | Namespaces + cgroups | Hypervisor + virtual hardware |
| Weight | MBs, one process | GBs, full OS |
| Boot time | Milliseconds | Seconds to minutes |
| Density | Hundreds per host | Tens per host |
| Isolation strength | Weaker (shared kernel) | Stronger (hardware-enforced) |
| Portability | Same-kernel-family only | Any guest OS on any host |

**When to use which:** containers for packaging and scaling application workloads on a shared platform (the default). VMs (or Kata/gVisor sandboxes) when you need hard isolation — untrusted multi-tenant code, different kernels, or a compliance boundary. In practice you often run containers *inside* VMs: the VM is the security boundary, containers are the packaging unit.

### Q3. Which Linux kernel features make containers possible?

Two families plus a filesystem:

**Namespaces** isolate the *view* — each answers "what can this process see?":
- `pid` — its own process tree; the container's main process is PID 1.
- `net` — its own interfaces, routing table, iptables rules.
- `mnt` — its own mount points / filesystem tree.
- `uts` — its own hostname and domain name.
- `ipc` — its own System V IPC / POSIX message queues.
- `user` — maps container UIDs to host UIDs (the basis of rootless containers).

**cgroups** (control groups) limit the *resources* — CPU, memory, block IO, and the number of PIDs a container may use.

**A union/overlay filesystem** (overlay2) stacks the read-only image layers and the writable layer into a single root filesystem.

Namespaces = isolation, cgroups = limits, union FS = the filesystem. Remove any one and it stops being a container.

### Q4. Why does "it works on my machine" stop being a problem with Docker?

Because the **image bundles the entire userland** the application needs — the exact binaries, shared libraries, interpreter version, config files, and directory layout — into an immutable, content-addressed artifact. When you `docker run` it on any host, the process sees the *same* filesystem it saw in development, regardless of what's installed on the host.

The one thing the image does *not* carry is the kernel — that's shared with the host. So "works on my machine" is solved for everything in userspace; the residual differences are kernel version, CPU architecture, and mounted host state (which is exactly why you pin base images and manage data via volumes).

The image is the unit of reproducibility: build once, run identically everywhere a compatible kernel exists.

### Q5. Walk me through what happens between `docker run nginx` and a running process.

```bash
docker run nginx
```

1. The `docker` **CLI** parses the command and sends an HTTP request over the Docker **socket** (`/var/run/docker.sock`) to the daemon. Client and server are separate processes — this is a client-server architecture.
2. **dockerd** (the daemon) checks whether the `nginx` image is present locally; if not, it pulls it from the registry (fetch manifest → pull missing layers).
3. dockerd calls **containerd** (via gRPC) to create the container: prepare the filesystem snapshot (the union mount), set up networking, apply config.
4. containerd spawns a **shim** and invokes **runc** (the OCI runtime).
5. **runc** creates the namespaces and cgroups, sets the root filesystem, then `exec`s the container's entrypoint — becoming the containerized process. runc then exits; the shim keeps the container's stdio and reports its exit status.
6. You now have an ordinary host process, isolated and constrained, serving nginx.

Knowing this chain is what lets you debug a wedged daemon or understand why Kubernetes talks to containerd directly and dropped the Docker shim.

### Q6. What is the Docker daemon (`dockerd`) actually responsible for?

`dockerd` is a **long-running server process** exposing the Docker API. It owns the high-level object model and orchestration:

- **Images** — building, storing, tagging, pull/push to registries.
- **Containers** — create/start/stop/rm, but it *delegates the actual running* to containerd/runc.
- **Networks** — creating bridges, managing the embedded DNS, wiring up `-p` port publishing via iptables.
- **Volumes** — creating and mounting Docker-managed volumes.
- **The API** — everything the CLI does is an HTTP call to this daemon over a socket.

Critically, dockerd does **not** create namespaces or run your process itself — it hands off to `containerd`, which hands off to `runc`. dockerd is the API/orchestration layer; the low-level runtime is separate. This separation is why containerd can be driven directly (e.g. by Kubernetes) without Docker at all.

### Q7. What is the OCI and why does it matter?

The **Open Container Initiative** is a set of vendor-neutral standards that decouple "container" from "Docker." Three specs:

- **Image spec** — the on-disk/registry format of an image: layers, config, manifest.
- **Runtime spec** — how to take an unpacked filesystem + config and run it as a container (what `runc` implements).
- **Distribution spec** — how registries serve images (the pull/push protocol).

Why it matters: because these are standards, **any compliant tool can build, ship, and run the same images**. Docker builds an OCI image; Podman, containerd, CRI-O, and Kubernetes all run it. You aren't locked into Docker's engine. It's also why the ecosystem could evolve — Kubernetes dropped the Docker shim and talks to containerd directly, and nothing broke, because the *images and runtime* are standardized.

### Q8. How does Docker compare to Podman?

| | Docker | Podman |
|---|---|---|
| Architecture | Client → long-running daemon | Daemonless — CLI forks runc directly |
| Root | Traditionally root daemon | Rootless-first (user namespaces) |
| Compatibility | The reference | Drop-in: `alias docker=podman` |
| Pods | No native pod concept | Native pods (Kubernetes-like) |
| Systemd | External | Generates systemd units |

Podman's headline difference is **daemonless and rootless by default**: there's no privileged always-on daemon, so a compromised CLI or container has a smaller blast radius, and each user runs their own containers without root. The CLI is deliberately Docker-compatible, so most `docker` commands work verbatim. `nerdctl` is a third option — a Docker-compatible CLI over `containerd` directly. All three run the same OCI images.

### Q9. If containers share the host kernel, how strong is the isolation?

Weaker than a VM, and you must design around that. A container is isolated by **namespaces and cgroups, both kernel features** — so the isolation is only as strong as the kernel enforcing it. Consequences:

- A **kernel vulnerability** is a shared attack surface: a container escape via a kernel bug lands you on the host. A VM would still contain it because the guest kernel is separate.
- A misconfigured container (`--privileged`, mounting the Docker socket, running as root, excess capabilities) can trivially escape.

Container isolation is a **strong operational boundary, not a strong security boundary** for untrusted code. For hostile multi-tenant workloads, add a real sandbox: run containers inside VMs, or use **gVisor** (user-space kernel) or **Kata Containers** (lightweight VMs per container). The senior instinct is to say "containers isolate, but I don't rely on them alone for hostile tenants."

### Q10. What is the difference between an image and a container? (preview)

An **image** is a read-only, immutable template — a stack of filesystem layers plus config (entrypoint, env, exposed ports). A **container** is a **running (or stopped) instance** of an image: the same read-only layers, plus a **thin writable layer** on top where all runtime changes go.

The analogy: image is to container as a class is to an object, or as a program on disk is to a running process. One image spawns many containers; each gets its own isolated writable layer but shares the underlying read-only layers. When you `docker rm` a container, its writable layer is destroyed — which is why persistent data belongs in volumes, not the container. The **Images** and **Layers** topics unpack both halves.

### Q11. Why does Docker Desktop run a Linux VM on Mac and Windows?

Because **containers share the host kernel, and that kernel must be Linux** (namespaces/cgroups are Linux features). macOS and Windows don't have a Linux kernel, so there's nothing for a Linux container to share.

Docker Desktop solves this by running a **lightweight Linux VM** (via Apple's Virtualization framework / HyperKit on Mac, WSL2 or Hyper-V on Windows). `dockerd` and all your containers actually run *inside that VM*; the `docker` CLI on your host talks to the daemon in the VM. This is invisible day-to-day but explains real behavior: bind-mount performance is slower (crossing the host↔VM boundary), the VM has its own resource limits you configure in Desktop, and "the host" your containers see is the VM, not macOS. On native Linux there's no VM — the daemon runs directly.

### Q12. What is rootless Docker and why would you use it?

**Rootless Docker** runs the daemon and containers as an **unprivileged user** instead of root, using the **user namespace** to map the container's root (UID 0) to a normal, unprivileged UID on the host.

Why: it shrinks the blast radius. In classic Docker, the daemon runs as root and a container escape or a compromised daemon means host root. Rootless means the worst case is compromise of an ordinary user account — no host root. It also lets users run containers on shared systems without being granted access to the root-owned Docker socket (itself equivalent to root).

Trade-offs: some features are harder (binding low ports, certain network/storage drivers, cgroup limits need extra setup). Podman is rootless-first, which is a big part of its appeal. For hardening, rootless + dropped capabilities + non-root `USER` inside the container is the strong stack.

### Q13. What is the Docker socket and why is access to it dangerous?

The **Docker socket** (`/var/run/docker.sock`) is the Unix socket the daemon listens on; every CLI command is an API call over it. 

Access to it is effectively **root on the host**. Anyone who can talk to the socket can `docker run` a container that bind-mounts the host's `/` and runs as root, or mounts in the host's filesystem and rewrites anything — trivially escaping to full host control.

That's why:
- **Never** mount `/var/run/docker.sock` into an untrusted container.
- Mounting the socket into a CI runner or "Docker-in-Docker" convenience container is a common but serious privilege escalation vector.
- Rootless Docker mitigates this (the socket maps to an unprivileged user).

If you must give a container Docker access, prefer a rootless setup or a proxy that restricts the API surface.

### Q14. Describe the lifecycle of a container.

The core states and transitions:

```bash
docker create nginx     # created: filesystem + config prepared, not running
docker start <id>       # running: process is executing
docker pause <id>       # paused: processes frozen via cgroup freezer
docker unpause <id>     # back to running
docker stop <id>        # SIGTERM, grace period, then SIGKILL -> exited
docker kill <id>        # SIGKILL immediately -> exited
docker rm <id>          # removed: writable layer destroyed
docker run nginx        # = create + start in one step
```

Key points: `create` sets everything up but doesn't run the process; `start` runs it. `stop` sends **SIGTERM** first (giving the app a grace period, default 10s, to shut down cleanly) then **SIGKILL** — which is why your PID 1 should handle SIGTERM (see the entrypoint/signals topic). An `exited` container still exists (you can inspect logs, `start` it again) until you `rm` it — and `rm` destroys the writable layer, so unsaved data is gone. Use `docker ps -a` to see stopped containers.

### Q15. What roles do `containerd` and `runc` play?

They're the layers *below* `dockerd`:

- **containerd** is the **container runtime** — a daemon that manages the complete container lifecycle: pulling and unpacking images, managing snapshots (the layer stack), setting up the container, supervising it, handling networking hooks. dockerd delegates to it over gRPC. containerd is a graduated CNCF project and can run standalone — Kubernetes talks to it directly (via CRI), no Docker needed.
- **runc** is the **low-level OCI runtime** — a small binary that does the actual kernel work: create the namespaces and cgroups, set the root filesystem, apply the OCI runtime config, and `exec` the process. It runs once per container start, then exits.

The chain is `dockerd → containerd → runc → your process`. Understanding it demystifies why "Docker" and "the thing running your container" are separable, and why Kubernetes' dockershim removal was a non-event for the containers themselves.

### Q16. Can you run the same image on ARM and x86? What has to be true?

Not automatically — a container **shares the host kernel and executes native machine code**, so an image built for `amd64` won't run on an `arm64` kernel without emulation. What has to be true:

- **Matching (or emulated) architecture.** The image's binaries must match the host CPU. An x86 image on an Apple Silicon (ARM) Mac only runs because Docker Desktop uses QEMU emulation — slow and sometimes buggy.
- **Same kernel family.** It must be a Linux image on a Linux kernel; a Linux image can't run on a Windows kernel natively.

The real solution is **multi-arch images**: one tag (`myregistry/app:1.2.3`) backed by a **manifest list** that points to a per-architecture manifest. `docker pull` picks the right one for your platform automatically. You build these with `docker buildx build --platform linux/amd64,linux/arm64`. The **Images** topic covers manifest lists in detail. This is why cross-building and testing on the target arch matters before you ship.

## Images & the Image Model

### Summary

**What this topic covers**

The image is Docker's unit of distribution, and this topic is about what one actually *is* underneath the tag you type. Three concern areas: (1) the **image vs container distinction** — an image is an immutable, read-only, content-addressed stack of layers plus config; a container is a running instance with a writable layer. (2) The **identity model** — how images are named (`registry/repository:tag`), and the critical difference between a mutable **tag**, an internal **image ID**, and an immutable **digest** (`@sha256:…`) that you pin for reproducibility and supply-chain safety. (3) The **on-the-wire structure** — manifests, the multi-arch manifest list / OCI index, the config blob vs layer blobs, and how `docker pull` uses content-addressing to fetch only what's missing and deduplicate the rest. The 17 questions run from "image vs container" to "why do you pin by digest" and "walk me through what `docker pull` actually downloads."

**Mental model**

An image is a **content-addressed bundle**, not a file. At the top sits a **manifest**: a small JSON document listing (a) a **config blob** — the image's env, entrypoint, working dir, and the ordered list of layer digests — and (b) the **layer blobs** themselves, each a compressed tarball of filesystem changes, each identified by its SHA-256 **digest**. Because everything is named by the hash of its content, identical layers are the *same object* everywhere — pulled once, reused across every image and container that references them. A **tag** (`:latest`, `:1.2.3`) is just a human-friendly, *mutable* pointer to a manifest; the manifest's own digest is *immutable*. For multi-arch, the tag can point to a **manifest list** (OCI index) that fans out to one manifest per platform, and the client picks the match. This is why `docker pull` is fast on a warm cache (most layers already exist) and why pinning `@sha256:…` guarantees you get *exactly* the bytes you tested.

**Key terms**

- **Image** — a read-only, layered template + config; immutable and content-addressed.
- **Container** — a running instance of an image plus a thin writable layer.
- **Repository** — a named collection of related images (e.g. `library/nginx`), holding many tags.
- **Tag** — a mutable, human-readable pointer to a specific image version (`:1.2.3`, `:latest`).
- **Image ID** — the local content hash of the image's *config blob*; what `docker images` shows.
- **Digest** — `@sha256:…`, the immutable content hash of the manifest; pin this for reproducibility.
- **Manifest** — JSON listing the config blob + ordered layer blobs for one platform.
- **Manifest list / OCI index** — a multi-arch index mapping one tag to per-platform manifests.
- **Config blob** — JSON holding env, entrypoint, cmd, workdir, and the layer digest list.
- **Layer blob** — a compressed tarball of filesystem changes, addressed by digest.
- **Registry** — content-addressable storage serving images (Docker Hub, GHCR, ECR, `myregistry/`).
- **Dangling image** — an untagged image (`<none>`), usually an orphaned intermediate build.

**Why interviewers ask this**

Because how someone talks about images predicts how they'll behave in production. The junior mental model is "an image is like a zip file I download by tag." The senior model is "an image is a content-addressed manifest, tags are mutable, and I pin digests in production so a re-pushed `:latest` can't silently change what I deploy." That single distinction — tag vs digest — is a supply-chain security question in disguise: mutable tags are how a compromised or careless upstream ships you different bytes than you tested. Interviewers also probe manifests and multi-arch because operators who don't understand them get baffling "exec format error" failures on the wrong architecture, and probe `docker pull`/dedup because it explains registry costs, cache behavior, and why layer ordering matters.

**Common confusions**

- "A tag uniquely identifies an image." No — tags are mutable pointers; the same tag can point to different images over time. Only a **digest** is immutable.
- "`:latest` means the newest version." It doesn't — it's just the default tag name, updated (or not) at the pusher's discretion. It can be years old.
- "The image ID is the same as the digest." They differ: the **ID** is the local config hash; the **digest** is the registry manifest hash. They're computed over different things.
- "`docker save` and `docker export` are the same." `save` preserves an image with all layers and history; `export` flattens a *container's* filesystem into one layer, losing history and metadata.
- "Pulling an image downloads the whole thing every time." No — content-addressing means already-present layers are skipped; only missing layer blobs are fetched.

**What follows from this topic**

The image is a stack of layers, so this topic hands directly to **Layers & the Union Filesystem** — where "layer blob," dedup, and copy-on-write are unpacked. The config blob's entrypoint/env/cmd fields preview the Dockerfile and runtime-config topics. Digest pinning and provenance preview the security/supply-chain topic (signing, SBOMs, scanning). And "one tag, per-platform manifests" ties back to the multi-arch build discussion from **Container Fundamentals**. If images feel like opaque blobs, this topic makes them transparent.

### Q1. What's the difference between an image and a container?

An **image** is a read-only, immutable template: a stack of filesystem layers plus a config (entrypoint, env, exposed ports, default command). It's built once and never changes.

A **container** is a **running or stopped instance** of an image. It reuses the image's read-only layers unchanged and adds a **thin writable layer** on top, where every runtime file change lands (via copy-on-write).

```bash
docker pull nginx          # now you have an image
docker run --name a nginx  # a container (instance) of it
docker run --name b nginx  # a second, independent container of the SAME image
```

Both containers share the underlying read-only layers; each has its own private writable layer. Analogy: image = class / program on disk; container = object / running process. `docker rm` a container and its writable layer is destroyed — the image is untouched. This is why one image spawns many containers and why persistent data belongs in volumes, not the writable layer.

### Q2. How is an image named, and what are the defaults?

The full form is `registry/repository:tag`:

```
myregistry.example.com:5000/acme/app:1.2.3
└──────── registry ───────┘ └repo┘ └tag┘
```

When you omit parts, Docker fills in defaults, which is why short names work:

```bash
docker pull nginx
# expands to: docker.io/library/nginx:latest
```

- **Registry** defaults to `docker.io` (Docker Hub).
- **Namespace** defaults to `library/` for official images.
- **Tag** defaults to `:latest`.

So `nginx` → `docker.io/library/nginx:latest`, and `alice/app` → `docker.io/alice/app:latest`. For any non-Hub registry you must spell it out: `ghcr.io/acme/app:1.2.3`. The implicit `:latest` is the trap — it's why you should always specify an explicit tag in anything reproducible.

### Q3. Explain the difference between an image ID, a tag, and a digest.

Three different identifiers, often confused:

- **Tag** (`nginx:1.25`) — a **mutable, human-friendly pointer** to an image version. The same tag can point to different images over time; someone can re-push `:1.25` tomorrow.
- **Image ID** (`sha256:abc…`) — the **local** content hash of the image's *config blob*. What `docker images` shows in the ID column. Stable for a given built image, but it's a local/config identity.
- **Digest** (`nginx@sha256:def…`) — the **immutable content hash of the manifest** as stored in the registry. Pinning a digest guarantees you get *exactly* those bytes, forever.

```bash
docker pull nginx@sha256:def...   # pin by digest — reproducible & tamper-evident
docker pull nginx:1.25            # pin by tag — could change under you
```

Rule of thumb: use tags for humans and convenience, **pin digests for reproducibility and supply-chain safety** in production and CI.

### Q4. Why would you pin an image by digest instead of by tag?

Because a **tag is mutable and a digest is not**. Two reasons, both serious:

**Reproducibility.** `FROM node:20` today and `FROM node:20` in three months can resolve to different bytes as the maintainer re-pushes the tag with patches. Your build is no longer deterministic. `FROM node:20@sha256:…` always resolves to the exact image you tested.

**Supply-chain safety.** A mutable tag is the attack surface for a compromised or careless upstream: re-push `:latest` (or even a version tag) with malicious content and everyone pulling by tag silently ships it. A digest is **content-addressed and tamper-evident** — if the bytes change, the digest changes, so you can't be swapped without noticing.

```dockerfile
FROM node:20.11-slim@sha256:abc123...
```

The trade-off: digests are opaque and you must consciously bump them (ideally via automation like Renovate/Dependabot) to get security patches. That's a feature — updates become explicit, reviewed events, not silent drift.

### Q5. What is an image manifest, and what does it contain?

A **manifest** is the small JSON document at the top of an image for a *single platform*. It doesn't contain the image data — it *references* it by digest:

- A reference to the **config blob** (media type + digest + size).
- An ordered list of **layer blobs** (each: media type + digest + size).

```json
{
  "schemaVersion": 2,
  "config": { "digest": "sha256:aaa...", "size": 7023 },
  "layers": [
    { "digest": "sha256:bbb...", "size": 2814000 },
    { "digest": "sha256:ccc...", "size": 1200 }
  ]
}
```

The manifest's *own* SHA-256 is the image **digest** you pin with `@sha256:…`. When you `docker pull`, the client fetches the manifest first, then downloads whichever referenced blobs it doesn't already have. This indirection is what makes content-addressing and deduplication work.

### Q6. How do multi-arch images work — one tag, many architectures?

Via a **manifest list** (a.k.a. **OCI image index**): a top-level document that maps one tag to *multiple* per-platform manifests.

```
myregistry/app:1.2.3   (manifest list / OCI index)
├── linux/amd64  -> manifest -> config + layers
├── linux/arm64  -> manifest -> config + layers
└── windows/amd64 -> manifest -> config + layers
```

When you `docker pull myregistry/app:1.2.3`, the client reads the manifest list, matches your host's **OS/architecture**, and pulls only that platform's manifest and layers. Same tag, right binaries, automatically — this is why the official images "just work" on both an Intel server and an Apple Silicon laptop.

You build these with buildx:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t myregistry/app:1.2.3 --push .
```

Understanding this is the antidote to "exec format error" — that's a mismatched arch, usually a single-arch image on the wrong platform.

### Q7. What's the difference between the config blob and the layer blobs?

They serve completely different roles inside an image:

- **Layer blobs** are the *data* — each is a compressed tarball of filesystem changes (files added/modified/deleted) produced by one build instruction. Stacked, they form the container's root filesystem.
- **The config blob** is the *metadata* — one JSON document holding the runtime configuration and the recipe: environment variables, `ENTRYPOINT`, `CMD`, `WORKDIR`, exposed ports, and the **ordered list of layer digests** plus the build history.

```bash
docker inspect nginx   # shows config-blob contents: Env, Entrypoint, Cmd, layers
```

The manifest references both. When a container starts, Docker stacks the layer blobs into a filesystem and applies the config blob's settings to the process. The **image ID** is the hash of this config blob — which is why two images with identical layers but different entrypoints have different IDs.

### Q8. Walk me through what `docker pull` actually does.

```bash
docker pull myregistry/app:1.2.3
```

1. **Resolve the name** to `registry / repository : tag` and authenticate to the registry if needed.
2. **Fetch the manifest** for the tag. If it's a manifest list (multi-arch), select the manifest matching your platform, then fetch that.
3. **Read the layer digests** from the manifest.
4. **Diff against local storage** — for each layer digest, check whether that content already exists locally (from another image or a prior pull).
5. **Download only the missing layer blobs**, in parallel, by digest. Already-present layers are skipped entirely.
6. **Verify** each blob's content against its digest (integrity/tamper check) and unpack it into the layer store.
7. **Fetch the config blob**, register the image, and point the local tag at it.

The takeaways: pulls are **incremental** (content-addressing → only missing layers download), **verified** (digests catch corruption/tampering), and **deduplicated** (shared base layers are stored once). This is why the *second* pull of anything based on the same base image is nearly instant.

### Q9. What are dangling images and how do you clean them up?

A **dangling image** is an image with **no tag** — it shows as `<none>:<none>` in `docker images`. They're almost always **orphaned layers from rebuilds**: you build `myapp:latest`, then rebuild it; the old image loses its tag (the tag moves to the new build) but its layers still occupy disk as an untagged image.

```bash
docker images -f dangling=true      # list them
docker image prune                  # remove dangling images
docker image prune -a               # remove ALL unused images (not just dangling) — careful
docker system df                    # see how much space images/containers/volumes use
```

`docker image prune` (no `-a`) is safe — it only removes untagged, unreferenced images. `-a` removes every image not currently used by a container, which can force big re-pulls. On build servers, dangling images silently eat disk; a scheduled `prune` (or BuildKit's garbage collection) keeps it in check.

### Q10. In what sense is a registry "content-addressable storage"?

Because a registry stores and serves blobs **by the hash of their content**, not by a filename or a mutable key. Every layer and config blob is addressed as `sha256:<hash>`. This has direct consequences:

- **Deduplication** — if two images share a base layer, that layer's blob is stored *once*; both manifests reference the same digest.
- **Integrity** — the client re-hashes each downloaded blob and checks it against the requested digest, so corruption or tampering is detected.
- **Immutability** — you cannot change a blob's content without changing its address; a given digest always means the same bytes.

Tags are the *only* mutable layer — they're names that point at (immutable) manifest digests. So a registry is really an immutable content store with a thin mutable naming layer (tags) on top. This is exactly why pinning `@sha256:…` is safe and why the same base image doesn't cost you storage across dozens of app images.

### Q11. What does `docker tag` do — does it copy the image?

No copy — `docker tag` just creates **another pointer** to the same image:

```bash
docker tag myapp:latest myregistry.example.com/acme/myapp:1.2.3
```

This adds a new name/tag referencing the exact same image ID and the exact same underlying layers. No data is duplicated; both tags resolve to identical content. It's how you prepare an image for a different registry before `docker push`, or alias a build.

Because it's just a pointer, tagging is instant and free regardless of image size. It also means multiple tags can drift or converge freely — retagging `latest` to point at a new build simply moves the pointer, orphaning the old image (creating a dangling image if nothing else references it). Think of tags as symlinks to content, not copies of it.

### Q12. What's the difference between `docker save`/`load` and `docker export`/`import`?

They operate on different things and preserve different amounts of information:

| | `save` / `load` | `export` / `import` |
|---|---|---|
| Operates on | An **image** (all its layers) | A **container's** filesystem |
| Preserves layers | Yes — full layer stack | No — flattened to one layer |
| Preserves history/metadata | Yes (entrypoint, env, history) | No (loses config; can set some on import) |
| Use case | Move an image between hosts offline | Snapshot a container's current fs |

```bash
docker save myapp:1.2.3 -o myapp.tar     # export image with layers + history
docker load -i myapp.tar                 # import it, layers intact

docker export mycontainer -o fs.tar      # flatten a container's filesystem
cat fs.tar | docker import - myapp:flat  # single-layer image, history lost
```

Use `save`/`load` to transfer real images (air-gapped installs, CI artifacts). Use `export`/`import` when you deliberately want a **flattened single-layer image** from a running container — occasionally handy to drop build history/secrets, but you lose the layer sharing and metadata.

### Q13. What are image labels and what are they good for?

**Labels** are key-value metadata baked into an image's config blob via the `LABEL` instruction:

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/acme/app"
LABEL org.opencontainers.image.version="1.2.3"
LABEL org.opencontainers.image.revision="abc123"
LABEL maintainer="team@acme.example.com"
```

They're metadata-only (no filesystem change) and queryable:

```bash
docker inspect --format '{{json .Config.Labels}}' myapp:1.2.3
docker images --filter "label=maintainer=team@acme.example.com"
```

Good for: **provenance** (link an image back to the exact git commit and source repo — the OCI `org.opencontainers.image.*` predefined labels are the standard), automation/filtering (find images by team, environment, or build), and policy (admission controllers can require certain labels). Labels are cheap and don't add layers, so richly labeling images with source, revision, and build metadata is a low-cost, high-value habit for auditability.

### Q14. How do images relate to layers? (preview)

An image *is* an ordered stack of layers plus a config that names them. Each layer is a **filesystem diff** produced by one image-building instruction — a set of files added, changed, or removed. Stacked bottom-to-top and merged by a **union filesystem**, they present as a single root filesystem to the container.

```bash
docker history myapp:1.2.3   # see each layer, its size, and the instruction that made it
```

Two properties make this powerful: layers are **content-addressed** (identical layers are stored once and **shared** across images and containers), and the top layer of a *container* is a writable copy-on-write layer while all the image layers stay read-only. The next topic, **Layers & the Union Filesystem**, unpacks overlayfs, copy-on-write, and why deleting a file in a later layer doesn't shrink the image.

### Q15. What is a base image, and how should you choose one?

A **base image** is what your `FROM` line starts from — the foundation layers your image builds on:

```dockerfile
FROM python:3.12-slim   # base image
COPY . /app
```

Choosing one is a real engineering decision with three axes:

- **Size** — `alpine` (musl libc, ~5MB) and `-slim` variants are small but can hit glibc-vs-musl compatibility issues; full `debian`/`ubuntu` are bigger but predictable. **Distroless** (Google's) ships just your runtime + app, no shell or package manager — smallest attack surface.
- **Security** — fewer packages = fewer CVEs. Distroless/slim images have dramatically smaller vulnerability surfaces than full distros.
- **Maintenance** — pick an **official, actively patched** base and pin it (ideally by digest). Track upstream so you get security fixes.

The senior move: start from `-slim` or distroless, pin by digest, and only add what you need. `FROM scratch` (empty) is the extreme for static binaries (Go). The base image choice dominates your final image's size and CVE count.

### Q16. Why is relying on the `:latest` tag a trap?

Because `:latest` is **not** "the newest version" — it's just the **default tag name**, a mutable pointer the pusher may or may not keep current. The traps:

- **Non-determinism** — `FROM postgres:latest` resolves to different images over time; a build that worked yesterday can break today, and two machines building "the same" Dockerfile can get different bases.
- **Silent, unreviewed upgrades** — you can be pulled onto a new major version with breaking changes without changing a line.
- **Rollback confusion** — if prod runs `myapp:latest`, "roll back to the previous latest" is meaningless; there's no stable reference.
- **It can be stale** — nothing forces `:latest` to be recent; it can point at an ancient build.

The fix: always use **explicit, immutable references** — a specific version tag (`postgres:16.2`) and, for anything reproducible or security-sensitive, a **digest pin** (`postgres:16.2@sha256:…`). Reserve `:latest` for throwaway local experiments.

### Q17. How would you establish the provenance of an image you're about to deploy?

Provenance = "where did these exact bytes come from, and can I trust them?" The layered answer:

- **Pin by digest** — reference `@sha256:…` so you deploy exactly the audited bytes, not whatever a tag currently points to.
- **Read the metadata** — `docker inspect` and OCI labels (`org.opencontainers.image.source`, `.revision`) should link the image to a source repo and git commit.
- **Verify a signature** — image signing (Docker Content Trust / Notation / Sigstore `cosign`) lets you cryptographically verify the image was published by who you expect and hasn't been altered.
- **Check the SBOM and scan** — a Software Bill of Materials (`docker sbom` / Syft) lists components; a scanner (Trivy, Grype, Docker Scout) flags known CVEs.
- **Prefer trusted, minimal bases** — distroless/official images from registries you control or trust, ideally built in a reproducible pipeline that attests how the image was produced (SLSA provenance).

The senior framing: mutable tags are a supply-chain risk; production images should be **digest-pinned, signed, scanned, and traceable to source**. The full security topic goes deeper.

## Layers & the Union Filesystem

### Summary

**What this topic covers**

How an image's filesystem is actually assembled and why that design drives build speed, image size, and data durability. Three concern areas: (1) **layers** — what a single layer is (a filesystem diff from one build instruction), which instructions create them, and how to inspect them. (2) The **union filesystem** — how overlayfs stacks read-only lower layers plus a writable upper layer into one merged view, and how **copy-on-write** governs reads and writes. (3) The **consequences** — layer sharing/dedup across images and containers, why the writable layer is ephemeral, why deleting a file in a later layer doesn't shrink the image (the secret-leak trap), squashing, and how CoW hurts write-heavy workloads. The 16 questions run from "what's a layer" to "this image is huge even though we `rm` the file — why," and "why is the container's data gone after `docker rm`."

**Mental model**

Picture a stack of transparent sheets. Each **layer** is one sheet holding only the *changes* from an instruction — files added, modified, or whited-out (deleted). The **union filesystem** (overlay2/overlayfs) looks down through the stack from the top and presents the merged result as a single filesystem: `lowerdir` = the read-only image layers, `upperdir` = the container's thin writable layer. Reads resolve to the topmost sheet that has the file. Writes obey **copy-on-write**: to modify a file that lives in a read-only lower layer, the whole file is first *copied up* into the writable layer, then edited there — the lower layer never changes. Two big implications fall out. First, **sharing**: because layers are content-addressed by digest, the same base layer is stored once and shared read-only across every image and running container that references it — pull once, reuse everywhere. Second, **ephemerality**: everything a container writes lands in its private upper layer, which is destroyed on `docker rm` — so data you care about must go in a **volume**, which sits *outside* the union filesystem.

**Key terms**

- **Layer** — the filesystem diff (added/changed/deleted files) produced by one image-building instruction.
- **Union filesystem** — merges multiple layers into one view; overlay2 is Docker's default driver.
- **overlayfs** — the kernel filesystem doing the merge: `lowerdir` (read-only) + `upperdir` (writable) → `merged`.
- **Copy-on-write (CoW)** — reads come from lower layers; writing a lower-layer file copies it up first, then edits the copy.
- **Writable layer** — the thin per-container upper layer where all runtime changes go; destroyed on `rm`.
- **Whiteout** — a special marker in an upper layer that hides a file present in a lower layer (a "deletion").
- **Layer sharing / dedup** — identical layers (same digest) stored once, reused across images and containers.
- **`docker history`** — shows an image's layers, their sizes, and the instruction that created each.
- **Storage driver** — the component implementing layering; overlay2 is the modern default.
- **Squashing** — collapsing many layers into one to reduce count / hide intermediate content.
- **Ephemeral** — the writable layer's lifetime is the container's; not durable storage.
- **Volume** — Docker-managed storage outside the union filesystem for persistent data.

**Why interviewers ask this**

Because layers are where three production problems are born: bloated images, cache misses, and lost data — and a candidate's grasp of the union filesystem predicts whether they'll cause or fix them. The junior answer is "layers are just steps in the Dockerfile." The senior answer connects the mechanism to consequences: *why* a 2GB image is 2GB (a big file added then `rm`'d in a later layer still ships), *why* the build cache and layer ordering matter, *why* `docker rm` loses data (ephemeral upper layer), and *why* the same base image doesn't cost disk 50 times over (content-addressed sharing). The classic trap question — "we deleted the secret/large file in a `RUN` step, so it's gone, right?" — instantly separates people who understand that layers are additive diffs from those who don't. It's also a security question: secrets baked into a lower layer persist regardless of later deletion.

**Common confusions**

- "Deleting a file in a later layer removes it from the image." No — the file still exists in the lower layer; the upper layer just adds a *whiteout* that hides it. The bytes (and any secret) still ship.
- "More layers means a bigger image." Not really — image size is the sum of layer *content*; layer *count* barely matters. A file added then deleted across two layers still counts twice.
- "Each container gets its own full copy of the image." No — containers share the read-only image layers; each only owns its small writable layer.
- "The writable layer is where I should keep my database data." No — it's ephemeral (gone on `rm`) and slow for heavy writes (CoW overhead). Use a volume.
- "`ENV`/`CMD`/`WORKDIR` create filesystem layers." In modern Docker they're metadata-only — they change the config, not the filesystem.
- "Squashing always helps." It shrinks/hides content but destroys layer sharing and cache reuse — often a net loss.

**What follows from this topic**

CoW and the ephemeral writable layer set up the **volumes & persistence** topic (why data lives outside the container). Which instructions create layers, and why order matters, hand directly to the **Dockerfile & build cache** topic — the cache is keyed per layer, so this is its foundation. The "deleted file still ships" trap previews **image slimming / multi-stage builds** (the real fix for secrets and bloat) and the **security/supply-chain** topic. And layer sharing ties back to the registry dedup story from **Images & the Image Model**. Master layers here and the build-optimization topics become obvious rather than magical.

### Q1. What is a layer in a Docker image?

A **layer is a filesystem diff** — the set of changes (files added, modified, or deleted) produced by a single image-building instruction. It's stored as a compressed tarball, addressed by its content digest.

When you build with a Dockerfile, each filesystem-changing instruction (`RUN`, `COPY`, `ADD`) produces one layer capturing *only what changed*:

```dockerfile
FROM debian:12          # base layers
RUN apt-get update && apt-get install -y curl   # layer: the new/changed files from installing curl
COPY app.py /app/       # layer: /app/app.py added
```

Layers are **additive and immutable**: each records a delta on top of the ones below. An image is just an ordered stack of these diffs plus a config that names them. This "diff, not snapshot" nature is the key to everything else in this topic — sharing, copy-on-write, and the "deleted file still ships" trap all follow from layers being diffs.

### Q2. How do layers combine into a single filesystem?

Via a **union filesystem** — Docker's default driver is **overlay2**, built on the kernel's **overlayfs**. It mounts multiple directories as one merged view:

- **`lowerdir`** — the read-only image layers, stacked.
- **`upperdir`** — the container's thin writable layer.
- **`merged`** — the unified filesystem the container actually sees.

overlayfs looks *down* through the stack: to resolve a path, it returns the file from the topmost layer that has it. So a file in an upper layer shadows the same path in a lower layer, and the container sees one coherent root filesystem with no idea it's assembled from a dozen diffs.

```
merged view (what the container sees)
├── upperdir  = writable layer  (container's changes)
└── lowerdir  = image layers    (read-only, shared)
```

This is why hundreds of containers can share one image's read-only layers while each writes independently into its own upper layer.

### Q3. Explain copy-on-write in the context of container storage.

**Copy-on-write (CoW)** governs how writes work across read-only lower layers and the writable upper layer:

- **Reading** a file: overlayfs returns it from wherever it lives — usually a read-only lower layer. No copying, no cost.
- **Writing/modifying** a file that lives in a lower layer: the *entire file* is first **copied up** into the writable `upperdir`, and the modification is applied to that copy. The lower layer is never touched.
- **Deleting** a lower-layer file: a **whiteout** marker is written to the upper layer to hide it; the original still exists below.

The performance and size implications: the **first write** to a large file is expensive (whole-file copy-up), and every byte you write lives in the writable layer. This is why write-heavy workloads (databases) should use a **volume** (which bypasses CoW), and why the same base layers can be shared read-only across many containers — nobody mutates them in place.

### Q4. Why is the container's writable layer ephemeral, and what should you do about it?

Because the writable layer's **lifetime is tied to the container**. It's the `upperdir` created when the container starts; when you `docker rm` the container, that directory is deleted and **everything written to it is gone** — logs, uploaded files, database data, all of it.

```bash
docker run --name db postgres
# ... writes data into the writable layer ...
docker rm -f db     # writable layer destroyed -> data lost
```

The fix is to keep persistent data **outside** the union filesystem, in a **volume** (or bind mount):

```bash
docker run -v pgdata:/var/lib/postgresql/data postgres
```

Now the data lives in a Docker-managed volume that survives `rm`, `docker run` of a new container, and image upgrades. The rule: **treat containers as disposable; put anything you'd miss in a volume.** The writable layer is scratch space, not storage.

### Q5. How are layers shared and deduplicated across images and containers?

Layers are **content-addressed by digest**, so identical content is stored exactly once and reused everywhere:

- **Across images** — if `app-a` and `app-b` both `FROM debian:12`, the Debian base layers have the same digests, so they're stored once. Pulling `app-b` after `app-a` skips the shared base entirely.
- **Across containers** — every container started from an image **shares that image's read-only layers**. Ten `nginx` containers don't make ten copies of nginx; they share one read-only layer stack and each adds a tiny writable layer.

```bash
docker system df   # shows "SHARED SIZE" — how much is deduplicated
```

This is why the *second* pull of anything on a common base is fast, why running many containers of one image is cheap on disk, and why registries store base layers once. Content-addressing turns "the same bytes" into "literally the same object" — the foundation of Docker's efficiency. It's also why layer *order* and *reuse* (put the stable base layers low) pays off.

### Q6. What does `docker history` tell you?

It shows the **layer-by-layer construction** of an image — each layer, the instruction that created it, and its size:

```bash
docker history myapp:1.2.3
```
```
IMAGE      CREATED BY                                      SIZE
<hash>     COPY . /app                                     4.2MB
<hash>     RUN pip install -r requirements.txt             120MB
<hash>     RUN apt-get install -y build-essential          280MB
<hash>     /bin/sh -c #(nop) FROM debian:12                74MB
```

It's the primary tool for **debugging image bloat**: read from the bottom up, find the fat layers (here, `build-essential` at 280MB), and target them (multi-stage build, `--no-install-recommends`, remove the build toolchain). It also reveals *how* an image was made — the instructions are visible, which is a reminder that **anything you put in a layer, including secrets, is inspectable**. Missing/`0B` entries are metadata-only instructions (`ENV`, `CMD`). `docker history` + `docker inspect` are how you audit an image you didn't build.

### Q7. Which Dockerfile instructions create layers, and which don't?

Only instructions that **change the filesystem** create a layer. Metadata-only instructions just update the config blob.

| Creates a layer (filesystem change) | Metadata-only (no layer) |
|---|---|
| `RUN` (executes, alters fs) | `ENV` |
| `COPY` (adds files) | `CMD` |
| `ADD` (adds files) | `ENTRYPOINT` |
| | `LABEL` |
| | `WORKDIR`* |
| | `EXPOSE` |
| | `USER`, `ARG`, `VOLUME`, `STOPSIGNAL` |

So `RUN`, `COPY`, and `ADD` are the ones that grow your image; the rest are essentially free config settings. (`WORKDIR` may create the directory if absent, but it's effectively negligible.) 

The practical upshot: to control image size and cache behavior, you focus on the `RUN`/`COPY`/`ADD` lines — combining related `RUN` commands, ordering `COPY` for cache hits, and cleaning up *within* the same `RUN` that created the mess (so the cleanup lands in the same layer).

### Q8. We deleted a large file in a later `RUN`, but the image is still huge. Why?

Because **layers are additive diffs, and deletion in a later layer doesn't remove the bytes from the earlier layer** — it only adds a *whiteout* that hides the file in the merged view. The file still physically ships inside the lower layer.

```dockerfile
RUN wget https://example.com/big-dataset.tar    # layer A: +2GB
RUN rm big-dataset.tar                           # layer B: whiteout, hides it — but A still contains 2GB
```

The image still carries all 2GB. The **fix is to add and remove within a single layer** so the file never gets committed:

```dockerfile
RUN wget https://example.com/big-dataset.tar \
 && tar xf big-dataset.tar \
 && rm big-dataset.tar
```

This is also the **secret-leak trap**: `COPY`ing a credential, using it, and `RUN rm`ing it in a later step leaves the secret sitting in a lower layer, fully recoverable with `docker history`/`docker save`. The real fixes are BuildKit `--secret` mounts or multi-stage builds — never "add then delete in a later layer."

### Q9. What is squashing, and is it a good idea?

**Squashing** collapses multiple layers into a single layer — either at build time (`docker build --squash`, an experimental/BuildKit feature) or by exporting and re-importing a container's flattened filesystem.

What it buys you:
- **Smaller images** in the "deleted a big file in a later layer" case — squashing merges add+delete so the removed bytes don't ship.
- **Hiding intermediate content** — secrets or build junk in intermediate layers don't survive into the single squashed layer.

What it costs you — and why it's usually the wrong tool:
- **Destroys layer sharing** — a squashed image no longer shares base layers with other images, so pulls and storage get *worse* across many images.
- **Kills build-cache reuse** — one giant layer invalidates entirely on any change.

The senior take: prefer a **multi-stage build** (only `COPY --from=` the final artifact into a clean stage) over squashing. Multi-stage gives you a small final image *and* preserves sensible layering and cache behavior. Reach for squashing rarely, if at all.

### Q10. What matters more for image size — layer count or layer content?

**Content, overwhelmingly.** Image size is the sum of the *bytes in each layer's diff*; the number of layers is almost irrelevant (there's a tiny per-layer metadata overhead, but it's noise).

The common mistake is `RUN`-chaining everything into one line "to reduce layers" for size reasons — that's misguided. You chain `RUN` commands not to cut layer count but to **clean up within the same layer** (so a file added and removed in one `RUN` never ships) and to **control the cache boundary**. 

```dockerfile
# Not about "fewer layers" — about not shipping the apt cache
RUN apt-get update && apt-get install -y curl \
 && rm -rf /var/lib/apt/lists/*
```

A file added in layer 1 and "deleted" in layer 2 still costs its full size (it lives in layer 1). So: optimize *what's in* your layers (small base, no build toolchain in the final image, clean up in-place), not *how many* there are. Multi-stage builds are the biggest lever.

### Q11. What is the storage driver, and why is overlay2 the default?

The **storage driver** is the component that implements image layering and the container's copy-on-write filesystem on top of the host's storage. Historically Docker supported several (aufs, devicemapper, btrfs, zfs, overlay); today the default and recommended one on Linux is **overlay2**.

Why overlay2 won:
- It's built on the kernel's mature **overlayfs**, so it's fast and well-supported (no separate userspace layer like aufs, no thin-pool complexity like devicemapper).
- Efficient **page-cache sharing** — multiple containers sharing a read-only layer share the same cached pages in memory.
- Simple `lowerdir`/`upperdir`/`merged` model that maps cleanly onto how images and writable layers work.

```bash
docker info | grep "Storage Driver"   # -> overlay2
```

You rarely change it; the main reason to know it exists is debugging (finding layer data under `/var/lib/docker/overlay2/`) and understanding that CoW performance characteristics come from this driver. The older drivers survive only for legacy kernels/setups.

### Q12. How does copy-on-write affect write-heavy workloads?

It penalizes them, sometimes badly. Under CoW, the **first modification of any file that lives in a read-only lower layer triggers a whole-file copy-up** into the writable layer before the write can proceed. For workloads that repeatedly modify large files — databases, log-heavy apps, anything doing lots of in-place writes — this means:

- **Latency spikes** on first write to each large file (copy the whole file up, even to change one byte).
- **Write amplification and disk bloat** — modified data accumulates in the writable layer.
- **No sharing** for that data — every container writes its own copy.

The fix is to **bypass the union filesystem entirely for hot data by using a volume** (or bind mount):

```bash
docker run -v pgdata:/var/lib/postgresql/data postgres
```

A volume is a normal filesystem outside the overlay stack — no CoW copy-up, native write performance, and durability across `rm`. This is exactly why the official database images declare `VOLUME` for their data directories: CoW is great for immutable image content and terrible for a busy write path.

### Q13. How do you inspect the layers of an image?

Several complementary tools:

```bash
docker history myapp:1.2.3            # layers, sizes, and the instruction that made each
docker inspect myapp:1.2.3           # config: the RootFS.Layers digest list, env, entrypoint
docker save myapp:1.2.3 -o app.tar   # unpack the tar to see per-layer tarballs + manifest
```

`docker history` is the quick read for **sizes and provenance** (find the fat/leaky layer). `docker inspect` shows the **ordered layer digests** under `RootFS.Layers` and the config. For a deep audit, `docker save` produces a tarball you can extract to see each layer's actual file contents and the manifest — useful for verifying a secret didn't leak into a layer, or diffing two images.

Third-party tools go further: **dive** gives an interactive per-layer file browser showing exactly what each instruction added and how much space is "wasted" (e.g. files added then deleted later). For CI, dive can even fail a build whose efficiency drops below a threshold. Between `history`, `inspect`, and `dive` you can fully account for every byte in an image.

### Q14. What is a whiteout file?

A **whiteout** is a special marker that a union filesystem writes into an **upper layer to represent the deletion of a file that exists in a lower layer**. Since layers are immutable additive diffs, you can't actually remove a file from a read-only lower layer — so "deleting" it means recording, in the layer above, "this path is now hidden."

In overlayfs, a whiteout is implemented as a character device with device number 0/0 at the file's path (and "opaque directory" markers for whole-directory deletions). When overlayfs merges the stack and hits a whiteout, it stops looking down and reports the file as absent.

The crucial consequence for interviews: a whiteout **hides but does not remove** — the original file's bytes still occupy the lower layer and still ship in the image. This is the mechanism behind "we `rm`'d the secret but it's still in the image." To actually eliminate content you must avoid committing it in the first place (single `RUN`, BuildKit secrets, or multi-stage builds), not delete it in a later layer.

### Q15. How do layers relate to the build cache? (preview)

The **build cache is keyed per layer**. When you build, Docker (BuildKit) processes each instruction and asks "have I already built this exact layer?" — if the instruction and its inputs are unchanged, it **reuses the cached layer** instead of re-running the step. The catch: **cache invalidation cascades** — the moment one instruction's inputs change, that layer and *every layer after it* are rebuilt.

This is why **instruction order matters enormously**:

```dockerfile
COPY package.json package-lock.json ./   # changes rarely -> cache hits
RUN npm ci                               # expensive -> stays cached
COPY . .                                 # changes every commit -> only this + below rebuild
```

Copying dependency manifests and installing *before* copying source code keeps the expensive `npm ci` layer cached across code changes. Put the volatile `COPY . .` last. Because each layer is content-addressed, an unchanged layer is a guaranteed cache hit. The **Dockerfile & build cache** topic develops this fully — layer ordering, cache mounts, and why CI caches miss — but it all rests on "a layer is the unit of caching."

### Q16. A colleague says "fewer layers = faster containers." Are they right?

No — that conflates several things and gets the mechanism wrong. Layer count has **essentially no effect on container runtime speed**. At runtime, overlayfs merges all the read-only layers into one view once at start; whether that's 5 layers or 25, reads resolve through the merged filesystem the same way. Startup is dominated by pulling missing layers and starting the process, not layer count.

Where layer count has minor effects:
- **Very high** layer counts add small metadata/mount overhead and there are historical driver limits — but you'd need dozens before it mattered.
- **Build cache** granularity — more, well-ordered layers can mean *better* cache reuse, not worse.

What people *should* optimize is **layer content**: small base image, no build toolchain in the final image, clean up within `RUN` steps, multi-stage builds. Those cut size and attack surface, which speeds up *pulls* (the thing that's actually slow). So the accurate version is: "smaller layer *content* means faster pulls; layer *count* barely matters and chasing it can hurt cache reuse." Correcting this misconception cleanly is a nice senior signal.
## Dockerfile Fundamentals

### Summary

**What this topic covers**

The Dockerfile is the recipe that turns source code into an image. This topic covers the file itself and every instruction you will meet in an interview: how a build works (the `docker build` handshake with the daemon), the **build context**, and the instructions in depth — `FROM`, `RUN`, `COPY`/`ADD`, `CMD`/`ENTRYPOINT`, `ENV`/`ARG`, `WORKDIR`, `EXPOSE`, `USER`, `LABEL`, `VOLUME`, `HEALTHCHECK`, `SHELL`, `ONBUILD`, `STOPSIGNAL` — plus the two forms (exec vs shell) that trip up almost everyone. The 17 questions here move from "what is a Dockerfile" to "why does this instruction belong in that position." Layer caching and multi-stage builds each get their own topic; here we only preview them, because you cannot write a sane Dockerfile without knowing that *every* instruction that touches the filesystem becomes a cached layer.

**Mental model**

A Dockerfile is a sequence of instructions, read top to bottom, each producing a new **layer** stacked on the one before. Think of it as a series of `docker commit`s you never have to type: start `FROM` a base image, and each `RUN`/`COPY`/`ADD` runs against the result of the previous step and freezes the diff as a new read-only layer. Instructions like `ENV`, `WORKDIR`, `EXPOSE`, `CMD`, `LABEL` only change **image metadata/config**, not the filesystem — they are effectively free. When you run `docker build .`, the CLI tars up the **build context** (that trailing `.`) and ships it to the daemon; the daemon executes each instruction in a throwaway container and snapshots the result. Two consequences fall out of this and explain half of all Dockerfile behaviour: (1) the daemon can only see files inside the context, so `COPY ../thing` fails; (2) order matters, because the layer for each instruction is cached and reused only until an input changes.

**Key terms**

- **Base image** — the image named in `FROM`; the starting filesystem. `scratch` is the empty base (nothing, not even a shell).
- **Build context** — the directory (or URL/tarball) sent to the daemon; `COPY`/`ADD` sources resolve inside it.
- **Instruction** — one directive (`FROM`, `RUN`, ...); most produce a layer or set config.
- **Layer** — a read-only filesystem diff produced by `RUN`/`COPY`/`ADD`; content-addressed and shareable.
- **Exec form** — JSON-array form `["nginx","-g","daemon off;"]`; runs the binary directly, no shell.
- **Shell form** — string form `nginx -g 'daemon off;'`; wrapped in `/bin/sh -c`.
- **CMD** — default arguments for the container; easily overridden at `docker run`.
- **ENTRYPOINT** — the executable that always runs; `CMD` becomes its default args.
- **ARG** — build-time variable, only exists during build; not present at runtime.
- **ENV** — environment variable baked into the image; present at build *and* runtime.
- **.dockerignore** — excludes paths from the build context (like `.gitignore`).
- **ONBUILD** — a deferred instruction that fires when *another* image builds `FROM` this one.

**Why interviewers ask this**

Everyone can copy a Dockerfile off Stack Overflow; the interview is checking whether you understand *why* each line is there. The tells are specific. A junior uses `ADD` for everything and `RUN cd /app`; a senior uses `COPY`, sets `WORKDIR`, and knows `ADD`'s auto-extract/URL behaviour is a footgun. A junior thinks `EXPOSE` publishes a port; a senior knows it is documentation only and you publish with `-p`. A junior confuses `CMD` and `ENTRYPOINT`; a senior explains the interaction and reaches for exec form so PID 1 gets SIGTERM. The DevOps signal is whether you can read a Dockerfile and predict its image size, cache behaviour, and runtime process — because that is exactly what you do in code review.

**Common confusions**

- "`EXPOSE` publishes the port" — no, it is metadata; `-p`/`--publish` (or `-P`) actually maps ports.
- "`ADD` and `COPY` are interchangeable" — `ADD` also fetches URLs and auto-extracts local tars; prefer `COPY` and be explicit.
- "`CMD` and `RUN` are similar" — `RUN` executes at **build** time (creates a layer); `CMD` sets the **runtime** default command.
- "`ENV` and `ARG` are the same" — `ARG` is build-time only and gone at runtime; `ENV` persists into the running container.
- "`WORKDIR` is cosmetic" — it sets and *creates* the directory, and persists across instructions; `RUN cd /app` does not.
- "Each `RUN` shares a shell with the previous one" — no; every instruction is a fresh layer, so `RUN cd /app` then `RUN ls` runs `ls` back at the old directory.

**What follows from this topic**

Once you know each instruction produces a layer and that layers are cached, the next topic — Dockerfile Best Practices & Layer Caching — is just the disciplined application of that fact (order least-to-most-volatile, clean up in the same `RUN`). Multi-Stage Builds then uses multiple `FROM`s to throw away the fat build layers. The `CMD`/`ENTRYPOINT` preview here gets its own deep dive in the container-runtime topic (signals, PID 1, graceful shutdown). Get the instruction semantics solid first; the optimization topics assume them.

### Q1. What is a Dockerfile and what happens when you run `docker build`?

A **Dockerfile** is a plain-text recipe: an ordered list of instructions that describe how to assemble an image. It is declarative in spirit but executed imperatively, top to bottom.

When you run `docker build -t my-app .`, the CLI does three things: (1) tars up the **build context** (the `.`) and sends it to the Docker daemon; (2) the daemon reads the Dockerfile and executes each instruction in turn, running each in a temporary container and snapshotting the filesystem diff as a **layer**; (3) it tags the final layer stack as `my-app`. With BuildKit (the default engine) the graph is analysed so independent steps can run in parallel and only needed context is transferred.

The key mental note: the daemon, not your shell, runs the build. That is why paths outside the context are invisible and why a huge context slows every build.

### Q2. What is the build context and why does a large context hurt?

The **build context** is the set of files sent to the daemon for a build — normally the directory you pass as the final argument (`docker build .` → the current directory). `COPY` and `ADD` can only reference files *inside* this context; `COPY ../secrets .` fails because `..` is outside it.

A large context hurts for two reasons:

- **Transfer cost** — the entire context is tarred and streamed to the daemon before the build even starts. A repo with a 2 GB `node_modules`, `.git`, and build artifacts means gigabytes moved on every build, even if the Dockerfile only `COPY`s one file.
- **Cache and correctness** — a broad `COPY . .` pulls in junk that busts the cache whenever anything changes and can leak secrets into layers.

The fix is a `.dockerignore` file listing what to exclude (`.git`, `node_modules`, `dist`, `*.log`, `.env`). Keep the context to what the build actually needs.

```dockerfile
# minimal context: only the build needs app/ and package files
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
```

### Q3. What does `FROM` do, and what is `scratch`?

`FROM` sets the **base image** — the starting filesystem your build extends. It must be the first instruction (after any `ARG`s used in it). Everything you add is layered on top of it.

- `FROM node:22-alpine` — start from a small Node image.
- `FROM scratch` — start from **nothing**: an empty image with no shell, no libc, no package manager. Used for static binaries (Go, Rust) to get the tiniest possible image.
- `FROM golang:1.23 AS builder` — the `AS builder` names this **stage** so a later `COPY --from=builder` can pull artifacts out of it (multi-stage builds).

You can have multiple `FROM` lines in one file; each starts a new stage. Pin the tag (or digest) — `FROM node:22-alpine`, not `FROM node:latest` — for reproducibility.

### Q4. Explain the difference between the exec form and the shell form.

Several instructions (`RUN`, `CMD`, `ENTRYPOINT`) accept two syntaxes:

| | Exec form | Shell form |
|---|---|---|
| Syntax | JSON array: `["nginx","-g","daemon off;"]` | String: `nginx -g 'daemon off;'` |
| Runs via | The binary directly (no shell) | `/bin/sh -c "..."` |
| PID 1 | Your process is PID 1 | The shell is PID 1 |
| Signals | Process receives `SIGTERM` directly | Shell may swallow signals → no graceful shutdown |
| Shell features | No `$VAR` expansion, no pipes | `$VAR`, pipes, `&&` all work |

Prefer **exec form** for `CMD`/`ENTRYPOINT` so your process is PID 1 and receives `SIGTERM` on `docker stop` (graceful shutdown). Use **shell form** only when you need shell features like variable expansion or pipes. Note: exec form does *not* expand environment variables unless you explicitly invoke a shell (`["sh","-c","exec myapp --port $PORT"]`).

### Q5. What is the difference between `RUN`, `CMD`, and `ENTRYPOINT`?

They fire at different times and serve different roles:

- **`RUN`** — executes a command at **build time**, in a new layer. Used to install packages, compile code, create directories. `RUN apt-get update && apt-get install -y curl`.
- **`CMD`** — sets the **default command/args** run when the container starts. Overridden by anything you pass to `docker run`. Only the last `CMD` wins.
- **`ENTRYPOINT`** — sets the **executable** that always runs at container start. Not overridden by `docker run` args (those become arguments to it); replace it only with `--entrypoint`.

`RUN` builds the image; `CMD` and `ENTRYPOINT` define what the container *does* when it runs. A common pattern combines them: `ENTRYPOINT ["python","app.py"]` + `CMD ["--help"]` so the container runs `python app.py --help` by default but `docker run img --serve` runs `python app.py --serve`.

### Q6. `COPY` vs `ADD` — which should you use and why?

Use **`COPY`** by default. Both copy files from the build context into the image, but `ADD` has two extra behaviours that surprise people:

| Feature | COPY | ADD |
|---|---|---|
| Copy local files/dirs | Yes | Yes |
| Auto-extract local tar archives | No | **Yes** (silently) |
| Fetch remote URLs | No | Yes (but discouraged) |

`AD`D's magic is the footgun: `ADD app.tar.gz /app` silently unpacks the tarball, and `ADD https://... /app` downloads a file you can't verify or cache well. Both make builds harder to reason about. Docker's own guidance is: use `COPY` for local files; if you genuinely need to fetch and extract, use an explicit `RUN curl ... && tar ...` (or a BuildKit `--mount`) so the behaviour is visible. The one legitimate `ADD` use is auto-extracting a local tar you control.

### Q7. What is the difference between `ENV` and `ARG`?

Both define variables, but their lifetime differs:

- **`ARG`** — a **build-time** variable. Available only during the build, set with `--build-arg`. It does **not** exist in the running container. Use for things like a version number or a base-image tag.
- **`ENV`** — an environment variable baked into the image. Available at **build time and runtime** — the process sees it via `process.env` / `os.environ`. Use for runtime config defaults like `NODE_ENV=production`.

```dockerfile
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
```

Two gotchas: an `ARG` declared **before** `FROM` is only usable in `FROM` lines — to use it later you must re-declare `ARG` after `FROM`. And never put secrets in `ARG` or `ENV`; both persist in the image history (`docker history` shows `ARG` values passed at build).

### Q8. What does `WORKDIR` do, and why not `RUN cd`?

`WORKDIR /app` sets the working directory for every subsequent `RUN`, `CMD`, `ENTRYPOINT`, `COPY`, and `ADD`. If the directory doesn't exist, it is **created**. It persists across instructions.

`RUN cd /app` does not work the way beginners expect, because each `RUN` is a **separate layer executed in its own shell invocation**:

```dockerfile
RUN cd /app        # this cd is lost when the RUN finishes
RUN npm install    # runs back in / — wrong directory
```

The `cd` affects only that one `RUN`'s shell and is discarded. `WORKDIR` is stateful across instructions and is the idiomatic, cache-friendly way to set the location. Use absolute paths.

### Q9. Does `EXPOSE` publish a port?

No — this is the most common misconception. `EXPOSE 8080` is **documentation/metadata only**: it records that the container listens on 8080, and tools/`docker run -P` can read it, but it opens nothing by itself.

To actually make a port reachable you publish it at run time:

```bash
docker run -p 8080:8080 my-app     # host:container, explicit
docker run -P my-app               # publish all EXPOSEd ports to random host ports
```

`-p` sets up the DNAT (via iptables) that maps a host port to the container port. So `EXPOSE` is a helpful hint for humans and for `-P`, but the port mapping is a runtime decision, not a build-time one.

### Q10. What do `USER`, `LABEL`, and `STOPSIGNAL` do?

- **`USER`** — switches the user (and optionally group) for subsequent instructions and the running container. Images default to `root`; adding `USER app` (a non-root user you created) is a core security practice — a container process running as root that escapes is far more dangerous.
- **`LABEL`** — attaches key/value **metadata** to the image: `LABEL org.opencontainers.image.source="https://github.com/acme/app"`. Used for provenance, ownership, automated tooling. No runtime effect.
- **`STOPSIGNAL`** — sets which signal `docker stop` sends to PID 1 (default `SIGTERM`). Override it if your app expects a different signal, e.g. `STOPSIGNAL SIGQUIT` for nginx-style graceful drain.

```dockerfile
RUN adduser -D app
USER app
LABEL maintainer="platform@acme.example"
STOPSIGNAL SIGTERM
```

### Q11. What does `VOLUME` do in a Dockerfile, and what's the surprise?

`VOLUME /data` declares that `/data` should be a **mount point** backed by an anonymous volume rather than the container's writable layer. The intent is to mark data that should live outside the image lifecycle (databases, uploads).

The surprising side effects:

- **It auto-creates an anonymous volume** every time you `docker run` the image if you don't mount your own — and these pile up, orphaned, eating disk. `docker volume ls` fills with unnamed volumes.
- **Writes to that path after the `VOLUME` line are discarded.** Once a path is declared a volume, any `RUN` that writes there in a *later* instruction has no effect on the image — because the data is meant to live in the volume, not the layer. This silently breaks Dockerfiles that `VOLUME /data` then `RUN` seed data into `/data`.

Because of this, many teams avoid `VOLUME` in Dockerfiles entirely and instead mount volumes at run time (`-v`) or in Compose, where the behaviour is explicit.

### Q12. What is `HEALTHCHECK` and why is it useful?

`HEALTHCHECK` tells Docker how to test whether the container is actually working, not just running. Docker runs the command periodically and marks the container `healthy`, `unhealthy`, or `starting`.

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

Exit 0 = healthy, exit 1 = unhealthy. This matters because "the process is up" is not the same as "the app is serving." Orchestrators and Compose can gate on it: `depends_on` with `condition: service_healthy` waits for the healthcheck before starting dependents, and swarm/other schedulers can restart or reroute around unhealthy containers. Keep the check cheap and specific to real readiness (hits a `/health` endpoint that verifies dependencies), and set `--start-period` so slow-booting apps aren't killed during startup.

### Q13. What do `SHELL`, `ONBUILD`, and multiple `RUN` layering imply?

- **`SHELL`** — changes the default shell used for shell-form `RUN`/`CMD`/`ENTRYPOINT`. Mostly used on Windows to switch to PowerShell, or on Linux to enable `bash` strict mode: `SHELL ["/bin/bash","-o","pipefail","-c"]` so a failing command in a pipe fails the build.
- **`ONBUILD`** — registers an instruction that does **not** run now, but fires when *another* image is built `FROM` this one. Used by base-image authors: `ONBUILD COPY . /app` means every child image auto-copies its source. Powerful but surprising (invisible to whoever writes the child Dockerfile), so use sparingly.

The layering implication: because each `RUN` is its own layer, splitting install steps across many `RUN`s bloats the image and slows builds. Combine related commands with `&&` in one `RUN` (covered fully in the caching topic).

### Q14. How does variable substitution work in a Dockerfile?

Docker supports `${var}` substitution in most instructions, using values from `ARG` and `ENV`:

```dockerfile
ARG APP_VERSION=1.2.3
ENV APP_HOME=/opt/app
WORKDIR ${APP_HOME}
COPY dist/app-${APP_VERSION}.jar ${APP_HOME}/app.jar
```

Key points: substitution works in `FROM`, `COPY`, `ADD`, `ENV`, `WORKDIR`, `EXPOSE`, `USER`, `VOLUME`, `LABEL`, and the shell form of `RUN`/`CMD`/`ENTRYPOINT`. It does **not** happen automatically in the **exec form** — `CMD ["echo","$APP_HOME"]` prints the literal string, because there is no shell to expand it. Bash-style defaults are supported: `${VAR:-default}` (use default if unset) and `${VAR:+value}`. Values come from `ENV` (runtime + build) and `ARG` (build only); if both define the same name, `ENV` wins during build.

### Q15. Walk me through a simple end-to-end Dockerfile.

Here is an idiomatic single-stage Node service, annotated:

```dockerfile
# 1. pin the base image
FROM node:22-alpine

# 2. set (and create) the working dir
WORKDIR /app

# 3. copy dependency manifests first (cache-friendly)
COPY package*.json ./

# 4. install deps as a distinct, cacheable layer
RUN npm ci --omit=dev

# 5. copy the application source
COPY . .

# 6. run as a non-root user for safety
RUN adduser -D app
USER app

# 7. document the port (does not publish)
EXPOSE 3000

# 8. runtime health probe
HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1

# 9. exec-form entrypoint so the process is PID 1 and gets SIGTERM
CMD ["node", "server.js"]
```

Every choice maps to a principle from this topic: pinned base, `WORKDIR` not `cd`, manifests before source for caching, non-root `USER`, `EXPOSE` as docs, exec-form `CMD`.

### Q16. Why does the placement of each instruction matter?

Because of the **build cache** (its own topic, previewed here): Docker reuses a cached layer only if that instruction *and its inputs* are unchanged, and the cache invalidates from the first changed instruction to the end of the file. So order determines how often you get cache hits.

The canonical rule is **least-to-most-frequently-changing**. Your base image and OS packages change rarely → near the top. Dependency manifests change occasionally → next. Application source changes constantly → last. If you `COPY . .` before `RUN npm ci`, then editing one line of source busts the copy layer *and* forces a full reinstall every build. Copy `package.json` first, install, *then* copy source, and a code change reuses the cached dependency layer.

Placement also affects correctness (`VOLUME` before a `RUN` that writes to it discards the write) and metadata-vs-filesystem cost, but caching is the dominant reason.

### Q17. What are the most common Dockerfile mistakes you look for in review?

A quick checklist of red flags:

- **`FROM ...:latest`** — non-reproducible; pin a version or digest.
- **`ADD` where `COPY` would do** — hidden URL/tar behaviour.
- **`RUN cd /app`** — lost between layers; use `WORKDIR`.
- **`COPY . .` before installing deps** — busts the dependency cache on every source change.
- **Running as root** — no `USER`; a compromise runs as root.
- **`apt-get install` without cleanup in the same `RUN`** — leaves package-cache bloat.
- **Secrets in `ARG`/`ENV`** — persist in image history; use BuildKit secrets.
- **`EXPOSE` assumed to publish** — it doesn't.
- **Shell-form `CMD`** for the main process — signals swallowed, no graceful shutdown.
- **Huge build context** — missing `.dockerignore`.

Each of these is cheap to spot and expensive to leave in; naming them signals you've actually operated images, not just built them once.

## Dockerfile Best Practices & Layer Caching

### Summary

**What this topic covers**

This is where you turn a working Dockerfile into a *fast, small, reproducible, secure* one — the difference between a build that takes 8 minutes on every commit and one that takes 15 seconds. The 17 questions cover the mechanics of the **build cache** (when a layer is reused and when it's busted), the single most valuable optimization (install dependencies before copying source), `.dockerignore`, combining and cleaning up `RUN` commands in one layer, pinning versions and digests, keeping secrets out of layers, BuildKit cache mounts, the "one concern per image" principle, and the common Dockerfile smells reviewers flag on sight. This topic assumes Dockerfile Fundamentals (every instruction is a layer) and previews Multi-Stage Builds (the ultimate size win).

**Mental model**

Picture the image as a stack of layers, each keyed by a **cache key** = the instruction text plus a hash of its inputs (for `COPY`/`ADD`, the file contents; for `RUN`, just the command string). Docker walks the Dockerfile top-down: as long as each instruction's key matches a previously built layer, it reuses the cache — **for free**. The moment one instruction's key differs, that layer and *every layer after it* are rebuilt, because each layer depends on the exact filesystem produced by the one before. This is the whole game. It means two things: **order least-to-most-volatile** so the volatile stuff (your source) is last and rarely-changing stuff (base image, deps) is cached; and **be deliberate about inputs**, because a stray `COPY . .` early means any file change rebuilds everything. Cleanup has the same logic: deleting a file in a *later* layer doesn't shrink the image, because the earlier layer still contains it — you must create and clean in the *same* `RUN`.

**Key terms**

- **Cache key** — instruction text + hash of inputs; identical key → cache hit.
- **Cache invalidation** — the first changed instruction busts itself and all following layers.
- **Layer** — a filesystem diff; kept in the image even if a later layer deletes its contents.
- **`.dockerignore`** — excludes paths from the context so they can't bust cache or leak in.
- **Cache bust** — deliberately forcing a rebuild (change an `ARG`, `--no-cache`).
- **`--no-cache`** — build flag that ignores all cached layers.
- **BuildKit** — default build engine; enables secrets, SSH, and cache mounts.
- **`--mount=type=cache`** — a persistent, cross-build cache dir for package managers (not baked into the image).
- **`--mount=type=secret`** — injects a secret at build time without writing it to a layer.
- **Digest pin** — `image@sha256:...`, an immutable reference for reproducibility.
- **One concern per image** — each image runs a single service/process.
- **Reproducible build** — same inputs → same image, achieved via pinning.

**Why interviewers ask this**

Caching is the fastest way to tell a candidate who has *operated* CI from one who has only built an image on their laptop. "Our Docker builds take 12 minutes on every PR — why, and how would you fix it?" is a real, common question, and the answer is almost always "you're copying source before installing dependencies, so the cache never hits." Beyond speed, this topic probes cost-awareness (image size = pull time, storage, cold-start latency) and security (secrets baked into layers are a classic leak: they survive even after a later `RM`). A senior answer connects the mechanics (cache key, layer immutability) to the operational outcome (build minutes, registry cost, blast radius). A junior recites "use small base images" without knowing why order matters.

**Common confusions**

- "Deleting a file in a later `RUN` shrinks the image" — no; the earlier layer still holds it. Clean up in the *same* `RUN`.
- "`--no-cache` and a fresh `docker build` are the same" — a normal build reuses cache; `--no-cache` ignores it entirely.
- "Fewer layers always means smaller" — layer *count* barely matters; what's *in* them does. Readability sometimes wins over cramming.
- "Secrets in build args are safe if I don't push the image" — they're in `docker history` and every intermediate layer; use BuildKit secrets.
- "`:latest` is fine" — it's a mutable pointer; today's `latest` ≠ next week's. Pin tags or digests.
- "Cache mounts are baked into the image" — no; `--mount=type=cache` lives outside the image and speeds installs without bloating layers.

**What follows from this topic**

Best practices plus caching lead directly into **Multi-Stage Builds**, which apply the same "keep only what production needs" logic at the image level — a fat builder stage (cached) and a tiny final stage. The security thread (non-root, no secrets in layers) continues into the container hardening topic. And the CI angle — leveraging the cache across ephemeral runners with registry-backed cache — is the operational payoff of everything here. Master ordering and cleanup first; multi-stage is the amplifier, not a substitute.

### Q1. How does the Docker build cache work?

Docker builds layer by layer, and each layer has a **cache key**. For most instructions the key is the instruction text itself; for `COPY`/`ADD` it also includes a hash of the copied files' contents. During a build, Docker walks the Dockerfile top to bottom: if an instruction's key matches a layer from a previous build, it **reuses that cached layer** instead of executing the instruction.

The crucial rule is **invalidation cascades**: the moment one instruction's key differs from the cached build, that layer is rebuilt — and so is *every layer after it*, because each layer is built on the exact filesystem the previous one produced. You can't reuse a layer whose parent changed.

```dockerfile
FROM node:22-alpine       # cached
WORKDIR /app              # cached
COPY package*.json ./     # cached IF package.json unchanged
RUN npm ci                # cached IF the COPY above was cached
COPY . .                  # busts here whenever ANY source file changes
RUN npm run build         # always rebuilt after a source change
```

This single mechanism dictates every ordering decision in the next questions.

### Q2. What's the single most impactful caching optimization?

**Copy dependency manifests and install dependencies before copying application source.** Dependencies change rarely; source changes on every commit. If you install *after* copying source, every code change busts the install layer and re-downloads the entire dependency tree.

Wrong (slow):

```dockerfile
COPY . .
RUN npm ci        # re-runs on EVERY source change
```

Right (fast):

```dockerfile
COPY package*.json ./
RUN npm ci        # cached until package.json changes
COPY . .          # only this layer rebuilds on a code change
RUN npm run build
```

The same pattern applies everywhere: Go `COPY go.mod go.sum` → `RUN go mod download` → `COPY . .`; Python `COPY requirements.txt` → `RUN pip install -r requirements.txt` → `COPY . .`; Maven `COPY pom.xml` → `RUN mvn dependency:go-offline` → `COPY src ./src`. This one change routinely takes CI builds from minutes to seconds.

### Q3. What is `.dockerignore` and why does it matter for caching?

`.dockerignore` works like `.gitignore` but for the **build context**: it lists paths that are *not* sent to the daemon and therefore can't be `COPY`d, can't bust the cache, and can't leak into the image.

```
.git
node_modules
dist
*.log
.env
**/*.md
Dockerfile
```

Three payoffs:

- **Smaller/faster context** — the daemon isn't shipped your `.git` history or local `node_modules`.
- **Cache stability** — a `COPY . .` hashes only relevant files, so touching a log file or `.git` HEAD doesn't invalidate the layer.
- **Security** — `.env`, credentials, and keys never enter the context, so they can't accidentally be copied into a layer.

Without it, `COPY . .` silently sweeps in gigabytes and secrets, and the cache breaks on unrelated changes. It's the cheapest high-value file in the repo.

### Q4. Why combine `RUN` commands, and why clean up in the same layer?

Because **a file deleted in a later layer still exists in the earlier layer** — layers are immutable diffs, and the image contains all of them. Cleaning up in a separate `RUN` adds a "delete" layer but doesn't remove the bytes from the layer that added them.

Wrong — the apt cache is baked into the image forever:

```dockerfile
RUN apt-get update && apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*    # too late; the cache is in the layer above
```

Right — install and clean in one layer so the cache never becomes part of any committed layer:

```dockerfile
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

Combining also reduces layer overhead and keeps related steps atomic. The rule: anything you create *and* delete during a build must live in the same `RUN`.

### Q5. Why pin base image versions and digests?

`:latest` (and even a floating minor tag) is a **mutable pointer** — the image it resolves to changes over time. A build that passed yesterday can break or subtly change tomorrow because `node:latest` moved. That destroys reproducibility.

Pin progressively tighter depending on how much determinism you need:

```dockerfile
FROM node:latest                         # never — unpredictable
FROM node:22                             # better — but still moves within 22.x
FROM node:22.11-alpine                   # good — specific minor
FROM node:22.11-alpine@sha256:abc123...  # best — immutable digest, byte-for-byte
```

A **digest** (`@sha256:...`) is content-addressed and immutable: it always resolves to the exact same image, guaranteeing that CI, staging, and production build from identical bytes. The tradeoff is you must bump the digest deliberately (tools like Renovate/Dependabot automate this). For production and compliance-sensitive builds, pin the digest; for casual dev, a specific minor tag is usually enough.

### Q6. How do you keep secrets out of image layers?

Never pass secrets via `ARG`, `ENV`, or a `COPY`d file — they persist in the image history and intermediate layers, and `docker history` (or anyone who pulls the image) can read them, *even if a later instruction deletes the file*.

The correct tool is **BuildKit build secrets**, which mount the secret into a single `RUN` without writing it to any layer:

```dockerfile
RUN --mount=type=secret,id=npmtoken \
    NPM_TOKEN=$(cat /run/secrets/npmtoken) npm ci
```

```bash
docker build --secret id=npmtoken,src=$HOME/.npm_token .
```

The secret exists only for that `RUN`'s duration and leaves no trace in the final image. For SSH-based private dependencies, use `--mount=type=ssh`. This is a favourite interview trap: "you did `ARG GITHUB_TOKEN` and deleted the file afterward — is the token safe?" The answer is no; it's in the layer history. Use secrets mounts.

### Q7. What are BuildKit cache mounts and when do you use them?

`--mount=type=cache` gives an instruction a **persistent directory that survives across builds but is not part of the image**. It's ideal for package-manager caches (npm, pip, Go, apt, Maven) so repeated installs reuse downloaded artifacts without bloating the image or being invalidated by the layer cache.

```dockerfile
RUN --mount=type=cache,target=/root/.npm \
    npm ci

RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
```

The difference from ordinary layer caching: even when the layer *is* rebuilt (say `package.json` changed slightly), the package manager still finds previously downloaded tarballs in the cache mount and skips re-fetching them. And because the mount lives outside the image, the download cache never ends up in a shipped layer. It's the best of both worlds — fast installs, small images — and requires BuildKit (default in modern Docker).

### Q8. How do you deliberately bust the cache when you need to?

Sometimes you *want* to force a rebuild — e.g. to pull the latest OS security patches even though the instruction text is unchanged. Options:

- **`--no-cache`** — ignore all cached layers for the whole build: `docker build --no-cache .`.
- **A cache-busting `ARG`** — change a build arg whose value feeds an early `RUN`:

```dockerfile
ARG CACHE_BUST=0
RUN echo "$CACHE_BUST" && apt-get update && apt-get upgrade -y
```

```bash
docker build --build-arg CACHE_BUST=$(date +%s) .
```

- **Change an input** — touching a file a `COPY` depends on invalidates from there.

The mirror-image skill is *avoiding* accidental busts: keep volatile instructions late, and don't put a timestamp or random value early in the file or you'll never get a cache hit.

### Q9. Does minimizing the number of layers actually matter?

Less than people think. Modern Docker (with BuildKit) handles many layers efficiently, and layer *count* has little effect on image size — what matters is the *content* of the layers. The real reasons to combine instructions are: (1) cleaning up in the same layer (so deleted files don't linger), and (2) atomicity of related steps.

So don't cram everything into one unreadable `RUN` for the sake of "fewer layers":

```dockerfile
# readable and correct — the && chain matters for cleanup, not layer count
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
```

Split logically distinct concerns into separate `RUN`s when it aids caching (e.g. deps vs build) and readability. Optimize for **what's in the layers and cache behaviour**, not a golf score on layer count.

### Q10. What is the "one concern per image" principle?

Each image should run **a single primary process/service**. Don't bake your app *and* a database *and* nginx *and* cron into one image. Reasons:

- **Scaling** — you scale the web tier independently of the database; you can't if they're one container.
- **Lifecycle** — one process = clear PID 1, clean signal handling, sensible restart semantics.
- **Caching/size** — smaller, focused images build and pull faster.
- **Observability** — one log stream, one healthcheck, one thing to reason about.

If you need multiple processes together, compose them as separate containers (Docker Compose / a pod), not as one fat image with a shell script juggling background jobs. The classic anti-pattern is a container running `supervisord` to babysit three daemons — it works, but you've thrown away most of what containers give you. One concern per image keeps the unit of deployment aligned with the unit of scaling.

### Q11. What makes a Docker build reproducible?

Reproducibility means the same inputs produce the same image. The enemies are anything non-deterministic:

- **Floating tags** — pin base images to a digest (`@sha256:...`).
- **Unpinned packages** — pin versions: `apt-get install -y curl=7.88.*`, `pip install flask==3.0.3`, a committed lockfile (`package-lock.json`, `go.sum`, `poetry.lock`).
- **Network-fetched artifacts** — vendored or checksum-verified, not "download latest."
- **Timestamps/ordering** — avoid embedding build time; use `SOURCE_DATE_EPOCH` if you need deterministic timestamps.

```dockerfile
FROM python:3.12.6-slim@sha256:...
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt   # requirements pinned with ==
```

The payoff: CI, staging, and prod build byte-identical (or at least behaviour-identical) images, so "works in staging, breaks in prod" stops being a Docker problem. It's also a supply-chain requirement — pinned digests let you audit exactly what shipped.

### Q12. Walk me through slimming a 2 GB image.

A structured attack, roughly in order of payoff:

1. **Switch to a smaller base** — `node:22` (~1 GB) → `node:22-alpine` (~150 MB) or a distroless/slim variant. Biggest single win.
2. **Multi-stage build** — compile/install in a fat builder stage, `COPY --from=builder` only the artifact into a minimal final stage. Drops all build tools.
3. **`.dockerignore`** — stop copying `node_modules`, `.git`, tests, docs into the image.
4. **Prune dev dependencies** — `npm ci --omit=dev`, `pip install --no-cache-dir`, don't ship compilers or test frameworks.
5. **Clean package caches in the same `RUN`** — `rm -rf /var/lib/apt/lists/*`, `--no-install-recommends`.
6. **Remove build-only files** — source, intermediate objects, `.pyc`, caches.

```bash
docker history my-app        # find the fat layers
dive my-app                  # inspect what each layer contains
```

Use `docker history` and `dive` to find *where* the weight is before guessing. Most 2 GB images are a heavy base + build tooling + dev deps — multi-stage plus an alpine/distroless base usually gets you to double-digit MB.

### Q13. "The layer cache never hits in CI — why?" How do you fix it?

The usual cause: **CI runners are ephemeral**, so each build starts with an empty local cache and every layer is rebuilt from scratch. Nothing is wrong with your Dockerfile ordering — there's just no cache to hit.

Fixes:

- **Registry-backed cache** with BuildKit: export and import the cache to/from a registry.

```bash
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/acme/app:buildcache \
  --cache-to   type=registry,ref=ghcr.io/acme/app:buildcache,mode=max \
  -t ghcr.io/acme/app:latest --push .
```

- **GitHub Actions cache** — `--cache-from type=gha --cache-to type=gha`.
- **Persistent builders** — a long-lived buildx builder or self-hosted runner that keeps the local cache warm.

The second, compounding cause is a Dockerfile that busts its own cache (source copied before deps, a timestamp `ARG` early on) — fix ordering *and* give CI a persistent/remote cache. Both are needed: good ordering is worthless if there's no cache store to reuse across runs.

### Q14. What are the most common Dockerfile smells you flag in review?

- **`apt-get upgrade` / `apt-get dist-upgrade`** — non-reproducible; pin the base image instead of upgrading at build time.
- **`ADD https://...`** — un-cacheable, unverified download; use `COPY` or an explicit checksummed `RUN curl`.
- **Running as `root`** — no `USER`; hardening gap.
- **`:latest` base tag** — mutable, non-reproducible.
- **Huge context / missing `.dockerignore`** — slow builds, leak risk.
- **`COPY . .` before dependency install** — kills caching.
- **Cleanup in a separate `RUN`** — doesn't shrink the image.
- **Secrets in `ARG`/`ENV`** — persist in history.
- **Unpinned package installs** — `apt-get install curl` with no version.

Reciting this list credibly signals you've reviewed real Dockerfiles. Each smell maps to a concrete failure mode: build time, image size, reproducibility, or security.

### Q15. How should you order `ENV` and `ARG` to protect the cache?

Both `ENV` and `ARG` create a layer/metadata entry, and changing their value invalidates everything after. So place them by volatility, just like other instructions.

- Put **stable** `ENV`s (e.g. `ENV NODE_ENV=production`) early — they rarely change.
- Put **volatile** `ARG`s (e.g. a build number, git SHA, cache-bust token) **as late as possible**, ideally after the expensive dependency install, so they don't invalidate the install layer.

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci                      # expensive — keep its cache
ARG GIT_SHA                     # changes every commit — placed AFTER npm ci
ENV GIT_SHA=$GIT_SHA
COPY . .
```

If `ARG GIT_SHA` sat before `RUN npm ci`, every commit's new SHA would bust the install layer and re-download dependencies. Push per-build volatile values as far down as their use allows.

### Q16. When would you accept a larger image or more layers for readability?

Optimization has diminishing returns and real costs to maintainability. Accept a bit more size/layers when:

- **Readability of `RUN` chains** — a clearly structured multi-line `RUN` (or two logical `RUN`s) beats one incomprehensible mega-command, since layer count barely affects size anyway.
- **Debuggability** — keeping `curl`/`bash` in a dev/debug image is fine; ship the slim one to prod.
- **Build speed vs size tradeoff** — sometimes an extra cached layer saves minutes of CI for a few MB.
- **Team velocity** — a 120 MB image that everyone understands can beat a 40 MB one only its author can modify.

The judgement is *economic* (Tidy First thinking): spend optimization effort where it pays — the base image and multi-stage split give 90% of the win. Micro-optimizing layer count for a few MB while making the file unreadable is a bad trade. Optimize the things that move image size and cache hit-rate materially; leave the rest legible.

### Q17. How do you leverage the cache across a CI pipeline?

Combine three levers so ephemeral runners still build fast:

1. **Good ordering** (from this topic) so the cache *can* hit — deps before source, volatile args late.
2. **A shared cache store** so there's something to hit — registry cache (`--cache-to/--cache-from type=registry,mode=max`), GHA cache, or a persistent buildx builder.
3. **Cache mounts** (`--mount=type=cache`) for package managers so even a rebuilt layer skips re-downloading.

```bash
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/acme/app:cache \
  --cache-to   type=registry,ref=ghcr.io/acme/app:cache,mode=max \
  --tag ghcr.io/acme/app:${GIT_SHA} --push .
```

`mode=max` exports intermediate layers too, not just the final image, so more of the build is reusable next run. Also warm the cache from the main branch and let PR builds import it. The full payoff lands in **Multi-Stage Builds**, where the fat builder stage is exactly what you want cached in the registry.

## Multi-Stage Builds

### Summary

**What this topic covers**

Multi-stage builds are the single most effective technique for producing small, secure production images, and a near-guaranteed interview topic. The 16 questions cover the problem they solve (build tooling bloats and endangers the final image), the mechanics (multiple `FROM` stages, naming with `AS`, `COPY --from=`), copying artifacts between stages and from external images, targeting a specific stage, the canonical language patterns (Go → scratch/distroless, Node → build then runtime, Java → Maven then JRE), combining with distroless/scratch, caching and parallelizing stages under BuildKit, using a stage for tests, the security and size wins, and when *not* to bother. This topic is the payoff of Dockerfile Fundamentals and the caching topic — it applies "ship only what production needs" at the whole-image level.

**Mental model**

Think of a multi-stage Dockerfile as several independent mini-Dockerfiles in one file, each starting with its own `FROM`, where later stages can reach back and **copy files out of earlier ones** — but only the **last stage** becomes the image you ship. Everything in the earlier "builder" stages (compilers, SDKs, dev dependencies, source code, intermediate artifacts, build secrets) is used to *produce* an artifact and then **thrown away**. The final stage starts from a clean, minimal base and does nothing but `COPY --from=builder /app/binary /app/binary` and set the entrypoint. So the fat JDK/gcc/`node_modules`-dev that you needed to *build* never reaches production. This is why a Go service can compile in a 900 MB `golang` image and ship as a 10 MB `scratch` image containing one static binary. The mental shift: separate *build environment* from *runtime environment*, in one file, with the artifact as the only bridge.

**Key terms**

- **Stage** — a section beginning with `FROM`; has its own filesystem, discarded unless it's the final stage or is copied from.
- **`AS <name>`** — names a stage (`FROM golang:1.23 AS builder`) so others can reference it.
- **`COPY --from=<stage>`** — copies files out of a named/numbered stage into the current one.
- **`COPY --from=<image>`** — copies out of an *external* image (e.g. `COPY --from=nginx:latest ...`).
- **Final stage** — the last `FROM` block; its layers alone form the shipped image.
- **`--target`** — `docker build --target builder` builds only up to a chosen stage (for tests/debug).
- **Builder stage** — the fat stage with compilers/SDKs that produces the artifact.
- **Runtime stage** — the minimal final stage that only runs the artifact.
- **distroless** — Google's minimal base with just the runtime, no shell/package manager.
- **scratch** — the empty base; for fully static binaries.
- **Base stage** — a shared stage other stages build `FROM` to avoid repetition.
- **Artifact** — the compiled binary / built assets copied from builder to runtime.

**Why interviewers ask this**

Because it's the clearest demonstration that a candidate understands the *lifecycle* difference between building and running software. "Your production image is 1.5 GB and includes gcc, the full JDK, and your npm dev dependencies — walk me through fixing it" is a standard prompt, and multi-stage is the answer. It touches everything DevOps cares about at once: **image size** (pull time, cold-start latency, registry cost), **security** (a smaller attack surface, no compilers or build secrets for an attacker to use), and **build hygiene** (dev deps and source not shipped). A senior candidate names the concrete patterns per language, knows the final image contains *only* the last stage, and can explain `--target` for testing and BuildKit stage parallelism. A junior has heard of it but can't explain why the builder stage disappears.

**Common confusions**

- "All stages end up in the image" — no; only the **final** stage's layers ship. Earlier stages are discarded (used only as copy sources).
- "You need one Dockerfile per stage" — no; multiple `FROM`s live in one file.
- "`COPY --from` only works with named stages" — it also works with stage indices and *external images*.
- "Multi-stage makes builds slower" — the builder stage still caches; and BuildKit can build independent stages in parallel.
- "The final base can be anything" — pick the *minimal* one (distroless/scratch/slim); a fat final base defeats the purpose.
- "Multi-stage removes the need to order instructions" — no; caching rules from the previous topic still apply within each stage.

**What follows from this topic**

Multi-stage is where Dockerfile Fundamentals and caching pay off — and it feeds directly into image-security topics (distroless, non-root, minimal attack surface) and CI (caching the builder stage in a registry so only the cheap final stage rebuilds). It also sets up the runtime topics: a scratch/distroless final image has no shell, which changes how you debug and how signals/PID 1 behave. If you can explain and write a multi-stage Dockerfile for the language you work in, you've demonstrated the core of production Docker.

### Q1. What problem do multi-stage builds solve?

They solve the tension between **what you need to build** software and **what you need to run** it. Building typically requires a heavyweight toolchain — compilers (gcc, the Go toolchain), SDKs (the full JDK, .NET SDK), dev dependencies, and your source code. Running usually needs almost none of that: just the compiled binary or built assets plus a minimal runtime.

Without multi-stage, all that build tooling ends up baked into the shipped image:

- **Bloat** — a 1 GB+ image full of compilers and dev packages, slow to pull and store.
- **Security** — every extra tool is attack surface; a compromised container with gcc, curl, and a package manager is far more useful to an attacker.
- **Leakage** — source code, build secrets, and dev credentials linger in layers.

Multi-stage lets you use a fat builder stage to produce the artifact, then copy *only that artifact* into a clean, minimal final image — throwing the toolchain away.

### Q2. How does a multi-stage build actually work?

You put **multiple `FROM` instructions** in one Dockerfile. Each `FROM` starts a new **stage** with its own filesystem. You name a stage with `AS`, and a later stage pulls artifacts out of an earlier one with `COPY --from=`. Only the **last** stage becomes the shipped image.

```dockerfile
# builder stage — has the full Go toolchain
FROM golang:1.23 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/server ./cmd/server

# final stage — minimal, only the binary
FROM scratch
COPY --from=builder /app/server /server
ENTRYPOINT ["/server"]
```

The `golang` builder (~900 MB) compiles the binary; the final `scratch` image contains just that one static binary (~10 MB). Everything in the builder — the compiler, module cache, source — is discarded. The `COPY --from=builder` is the only bridge between them.

### Q3. How do you copy artifacts between stages?

With `COPY --from=<stage>`, where the stage is referenced by its `AS` name or its numeric index (0-based, in file order):

```dockerfile
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # produces /app/dist

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

`COPY --from=build /app/dist ...` reaches into the `build` stage's filesystem and copies the built assets into the nginx image. You can copy multiple things, set ownership with `--chown`, and preserve permissions. Prefer **named** stages (`--from=build`) over indices (`--from=0`) — names survive reordering and read clearly. Only what you explicitly copy crosses the boundary; nothing else from the builder comes along.

### Q4. Can you copy from an external image, not just a stage?

Yes. `COPY --from=` accepts an **image reference**, not only a build stage. This lets you pull a file straight out of a published image without a separate stage:

```dockerfile
FROM alpine:3.20
# grab a static tool from an official image
COPY --from=nginx:1.27 /usr/sbin/nginx /usr/sbin/nginx
# or CA certs / a CLI binary from a known image
COPY --from=hashicorp/terraform:1.9 /bin/terraform /usr/local/bin/terraform
```

It's handy for grabbing a single binary or config from an upstream image (CA certificates from an official image into a `scratch` build is a common trick), or reusing a prebuilt artifact image from an earlier CI job. The mechanics are identical to copying from a stage — the source is just an image reference that Docker pulls if needed.

### Q5. What does the final image actually contain?

**Only the last stage's layers.** Every earlier stage is used purely to produce things you copy out; once the build finishes, those stages are discarded and never become part of the tagged image.

So in a Go build ending with `FROM scratch` + `COPY --from=builder /app/server /server`, the final image contains exactly one file (plus whatever else you copied, e.g. CA certs) — not the Go compiler, not the module cache, not your `.go` source. You can verify:

```bash
docker build -t my-app .
docker history my-app     # only final-stage layers appear
docker image ls my-app    # tiny size confirms the builder was dropped
```

This is the whole point and the most common misconception to correct in an interview: intermediate stages do **not** ship. The builder can be gigabytes; the final image is only as big as its own base plus the artifacts you deliberately copied.

### Q6. How do you build or target a specific stage?

Use `docker build --target <stage>` to stop at a named stage instead of building the whole file. This is invaluable for debugging, testing, or producing a dev variant:

```bash
# build only up to the builder stage (has the toolchain, source, tests)
docker build --target builder -t my-app:build .

# build the full thing (final stage)
docker build -t my-app .
```

Common uses: a `test` stage you can run in CI (`--target test`) that has dev deps and runs the suite; a `debug` stage with a shell and tooling for interactive poking; or building the `builder` stage to reproduce a compile failure with the full environment available. Because stages cache independently, `--target builder` reuses the same cached layers the full build uses — you're not rebuilding, just stopping earlier.

### Q7. Show the canonical Go multi-stage pattern.

Go compiles to a static binary, so the final image can be `scratch` or distroless — often under 15 MB:

```dockerfile
FROM golang:1.23 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# static build: no libc dependency, so it runs on scratch
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/server /server
USER nonroot
ENTRYPOINT ["/server"]
```

Key details: `CGO_ENABLED=0` produces a fully static binary (no dynamic libc) so it runs on `scratch`/distroless; `-ldflags="-s -w"` strips debug info to shrink it; distroless-static (or `scratch` plus copied CA certs) gives a tiny, shell-less, non-root final image. The 900 MB `golang` toolchain never ships.

### Q8. Show the canonical Node multi-stage pattern.

Node needs a runtime, so the final stage is a slim Node base with only production dependencies and built assets:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                       # all deps, incl. dev, for the build
COPY . .
RUN npm run build                # produces /app/dist

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev            # prod deps only
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

The build stage installs *all* dependencies (including build-time dev deps like TypeScript and bundlers) and compiles; the runtime stage installs **only production** dependencies and copies just `dist`. So `typescript`, test frameworks, and build tooling never reach production. For a pure static frontend, the runtime stage would be `nginx:alpine` serving `dist` instead.

### Q9. Show the canonical Java multi-stage pattern.

Build with the full JDK + Maven/Gradle, ship on a JRE or distroless Java base:

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline      # cache deps before source
COPY src ./src
RUN mvn -q clean package -DskipTests

FROM gcr.io/distroless/java21-debian12:nonroot
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
USER nonroot
ENTRYPOINT ["java", "-jar", "app.jar"]
```

The builder carries the full JDK, Maven, and the local `.m2` repo; the final image carries only a JRE (or distroless Java runtime) plus the fat jar. That takes a Spring Boot image from ~700 MB (JDK + Maven) down to ~200 MB or less, with no compiler or build tool in production. Copying `pom.xml` and resolving dependencies before `COPY src` preserves the dependency cache across code changes.

### Q10. How do you get the smallest possible images with distroless or scratch?

Pair a multi-stage build with the most minimal viable final base:

- **`scratch`** — completely empty. Only works for fully static binaries (static Go/Rust). You must copy in anything you need, e.g. CA certificates and timezone data:

```dockerfile
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server
ENTRYPOINT ["/server"]
```

- **distroless** — Google's minimal images (`gcr.io/distroless/...`): contain the language runtime and CA certs but **no shell, no package manager, no busybox**. Great for Java, Python, Node, Go — smaller attack surface than alpine while still supporting a runtime.

The tradeoff is debuggability: no shell means no `docker exec ... sh`. Mitigate with distroless `:debug` variants or ephemeral debug containers (`docker debug` / `kubectl debug`). For most production services, distroless-nonroot is the sweet spot; `scratch` is for truly static single binaries.

### Q11. How does caching work across multiple stages?

Each stage caches its layers **independently**, following the same rules as any single-stage build: order instructions least-to-most-volatile, copy dependency manifests before source, clean up in-layer. A change in the builder stage doesn't necessarily rebuild the final stage — and vice versa — unless the copied artifact changes.

Two important points:

- **The builder stage stays cached**, so an unchanged dependency layer isn't rebuilt even though the builder is "thrown away" from the final image. The cache and the shipped-image contents are separate concerns.
- **In CI**, you often want to cache the expensive builder stage in a registry. With BuildKit, `--cache-to mode=max` exports *intermediate* stage layers (not just the final image), so the next run reuses the builder's dependency-download layer.

```bash
docker buildx build \
  --cache-to type=registry,ref=ghcr.io/acme/app:cache,mode=max \
  --cache-from type=registry,ref=ghcr.io/acme/app:cache -t app .
```

So multi-stage doesn't cost you caching — you keep it, and BuildKit lets you persist it across ephemeral runners.

### Q12. Can stages build in parallel?

Yes — with **BuildKit** (the default engine), independent stages are built **concurrently**. BuildKit analyses the Dockerfile as a dependency graph: stages that don't depend on each other's output have no ordering constraint and run in parallel, up to available resources.

```dockerfile
FROM node:22-alpine AS frontend
# ...builds the web assets...

FROM golang:1.23 AS backend
# ...builds the Go binary...

FROM alpine:3.20 AS final
COPY --from=frontend /app/dist /web
COPY --from=backend /app/server /server
```

Here `frontend` and `backend` are independent, so BuildKit builds them simultaneously; `final` waits only because it copies from both. This is a real speed win for polyglot images and one reason multi-stage doesn't have to mean slower builds. (The old legacy builder built stages sequentially — another reason BuildKit is the default now.)

### Q13. How do you use a stage for tests or linting?

Add a dedicated stage that runs your checks; build it with `--target` in CI so a test failure fails the build, without shipping test tooling in the final image:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM build AS test
RUN npm run lint && npm test

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node","dist/server.js"]
```

```bash
docker build --target test .     # CI: fails if lint/tests fail
docker build -t app .            # prod: builds runtime, skips the test stage
```

The `test` stage builds `FROM build`, so it reuses everything already compiled. Because the default build target is the last stage (`runtime`), the test stage is skipped for production unless explicitly targeted. Dev tools and test deps never reach the shipped image.

### Q14. What's the security win of multi-stage builds?

A smaller **attack surface** and no build-time secrets in the shipped image:

- **No build tools** — the final image has no compiler, package manager, or shell (if distroless/scratch). An attacker who lands in the container can't `apt-get install`, can't compile an exploit, can't spawn a shell.
- **No source or dev dependencies** — proprietary source code, dev-only packages (with their own CVEs), and test fixtures stay in the discarded builder.
- **No build secrets** — tokens/SSH keys used during the build live only in the builder stage (better still, in BuildKit secret mounts) and never reach production layers.
- **Non-root** — pair with a `nonroot` distroless base or an explicit `USER`.

Fewer packages also means **fewer CVEs** to patch — vulnerability scanners flag far less on a 20 MB distroless image than a 1 GB one full of build tooling. Smaller image, smaller blast radius.

### Q15. Quantify the before/after — how much smaller?

Concrete, typical numbers make the case:

| Language | Single-stage (build tools included) | Multi-stage (minimal final) |
|---|---|---|
| Go | ~900 MB (`golang` base) | ~10-15 MB (`scratch`/distroless-static) |
| Node (API) | ~1.1 GB (`node` + dev deps) | ~150-200 MB (`node-alpine`, prod deps) |
| Node (static site) | ~1.1 GB | ~25-50 MB (`nginx:alpine` + `dist`) |
| Java (Spring Boot) | ~700 MB (JDK + Maven) | ~180-250 MB (JRE/distroless) |
| Python | ~1 GB (with build deps) | ~120-150 MB (`slim` + wheels) |

The Go case is the showstopper: two orders of magnitude, because a static binary needs *nothing* else. Smaller images pull faster (matters for autoscaling and cold starts), cost less to store, and expose fewer CVEs. Use `docker image ls` and `dive` to measure your own before/after — interviewers like candidates who quantify rather than hand-wave.

### Q16. When would you NOT bother with multi-stage?

Multi-stage isn't free complexity — skip or defer it when it doesn't pay:

- **Interpreted apps with no build step and no compiled deps** — a plain Python/Ruby script with pure-Python deps on a `slim` base may already be small; a single stage is simpler. (Though even here, separating build deps from runtime often helps.)
- **The final base equals the build base** — if you genuinely need the full runtime *and* there's no toolchain to shed, a second stage adds nothing.
- **Throwaway/local dev images** — for a quick local experiment, the extra structure isn't worth it.
- **When the build tools ARE the product** — a CI image or a dev container is *meant* to contain compilers.

But these are the minority. For any compiled language (Go, Rust, Java, C#) or any app with a build step (bundling, transpiling), multi-stage is close to mandatory. The default should be "use it"; the exception is "this image is already minimal and has nothing to discard."
## Image Size & Base Images

### Summary

**What this topic covers**

How to choose a base image and keep the final image small, secure, and debuggable — the single most common source of "why is my image 2GB?" pain. Three concern areas live here: (1) the **base-image spectrum** — full distros (`ubuntu`/`debian`), `debian-slim`, `alpine`, `distroless`, and `scratch`, and the tradeoffs between size, familiarity, and libc compatibility; (2) **slimming strategy** — multi-stage builds, `.dockerignore`, cache removal, `--no-install-recommends`, stripping binaries, static linking, and tooling like `dive` and `docker-slim`; and (3) the **security and operability angle** — fewer packages means fewer CVEs and a smaller attack surface, but a shell-less image is harder to debug. The 15 questions here range from "why does image size matter" to "this Go binary image is 900MB — walk me through getting it to 10MB." This topic is where the layer/cache mechanics from earlier become concrete decisions.

**Mental model**

Image size is a **tax you pay on every operation**: every `docker pull` and `docker push`, every node that cold-starts a pod, every CI job that builds or pulls the base. A 1GB image pulled onto 50 fresh nodes is 50GB of network transfer and slow autoscaling; a 20MB image is invisible. So the goal is: **ship only what the app needs to run at runtime — nothing to build it, nothing to debug it, nothing you forgot to delete.** The dominant lever is the **multi-stage build**: a fat "builder" stage with compilers, headers, and package managers, then a minimal final stage that `COPY --from=builder` only the compiled artifact. The base image you land that artifact on sits on a spectrum from `ubuntu` (familiar, glibc, ~70MB+) down through `debian-slim` and `alpine` (~5MB, but musl libc) to `distroless` (no shell/package manager) and `scratch` (literally empty). Smaller is better *until* it costs you more in debugging time or compatibility bugs than it saves. The senior move is picking the right point on that spectrum for your language and team.

**Key terms**

- **Base image** — the `FROM` your image starts from; everything you add layers on top of it.
- **debian-slim** — Debian with docs, man pages, and extras stripped; still glibc, still `apt`, much smaller than full Debian.
- **alpine** — a ~5MB distro built on **musl libc** and BusyBox; tiny, but musl differs from glibc in DNS resolution, threading, and locale.
- **musl vs glibc** — two C standard library implementations; musl is smaller but trips up glibc-only binaries, some Python wheels (not manylinux-compatible), and edge-case DNS behaviour.
- **distroless** — Google's images containing only your app, its runtime, and CA certs — **no shell, no package manager**; small and secure but hard to `exec` into.
- **scratch** — the empty base; nothing at all. Only works for **statically linked** binaries (Go, Rust) that need no OS.
- **Static vs dynamic linking** — a static binary bundles its libraries and runs on `scratch`; a dynamic binary needs the loader + shared libs present at runtime.
- **`docker history`** — shows per-layer size and the instruction that created it; first stop for attributing bloat.
- **`dive`** — a TUI that shows what each layer adds/wastes; finds duplicated and orphaned files.
- **`.dockerignore`** — excludes files from the build context so `COPY . .` doesn't drag in `.git`, `node_modules`, or build artifacts.
- **Attack surface** — every package, shell, and tool in the image is something a CVE scanner flags and an attacker can use.

**Why interviewers ask this**

Image size is a proxy for whether you understand the **layer model, the build/runtime split, and the operational cost of what you ship**. A junior reaches for `FROM ubuntu`, `apt install`s everything, `COPY . .`, and produces a 1.5GB image with the source tree, build tools, and `apt` cache baked in. A senior instinctively separates build from runtime with a multi-stage build, knows the base-image spectrum cold, and can explain *why* alpine's musl might bite a Python or glibc-linked app — and when `debian-slim` or `distroless` is the safer default. The strongest signal is nuance: not "always use alpine" but "alpine for Go, `debian-slim` or distroless for Python/Node/Java because musl compatibility isn't worth the debugging pain." That, plus knowing `docker history`/`dive` to *measure* rather than guess, marks someone who's actually shrunk a real image in production.

**Common confusions**

- "Alpine is always the right choice" — it's tiny, but musl libc causes real bugs (DNS, some Python wheels, glibc-only binaries). Many teams use `debian-slim` or distroless instead.
- "Deleting files in a later layer shrinks the image" — it doesn't. If you `apt install` in one `RUN` and `rm` in a later `RUN`, the files still live in the earlier layer; the image only grows. Delete in the **same** `RUN`, or use multi-stage.
- "Distroless means no OS" — it still has libc, CA certs, and the language runtime; it just has no shell or package manager.
- "`scratch` works for any static-looking binary" — only truly static ones. A cgo-enabled Go binary is dynamically linked and will crash on `scratch` for a missing loader.
- "`.dockerignore` and `.gitignore` are the same" — different files; forgetting `.dockerignore` sends your whole `.git` and `node_modules` into the build context.
- "Smaller is always better" — a shell-less image you can't `exec` into at 3am can cost more than the megabytes saved.

**What follows from this topic**

Slimming is inseparable from **multi-stage builds** and the layer/cache mechanics covered earlier — the build/runtime split *is* the size story. The base you pick also drives **CMD vs ENTRYPOINT** decisions (distroless/scratch have no shell, so shell-form CMD and entrypoint wrapper scripts simply won't run). Fewer packages ties directly into image **security** — a smaller attack surface and fewer CVEs. And the tooling here (`--secret`, cache mounts) connects to **BuildKit & buildx**, the next topic, which makes slim multi-stage builds fast and safe.

### Q1. Why does image size matter?

Size is a tax on every operation the image touches:

- **Pull/push time** — every deploy pulls the image onto every node. A 1GB image across an autoscaling fleet is gigabytes of transfer and slow scale-up; a 20MB image is near-instant.
- **Cold start** — Kubernetes can't start a pod until the image is pulled. Big images mean slow rollouts and slow reactions to traffic spikes.
- **Storage** — registry storage and per-node disk. Layers are shared, but fat unique layers add up.
- **CI speed** — every build pulls the base and pushes the result. Slow images slow the whole pipeline.
- **Attack surface / security** — every package, shell, and library is a potential CVE and a tool an attacker can use post-breach. Fewer things installed = fewer things to patch and scan.

The through-line: size costs you **repeatedly**, in production and CI, so it's worth engineering down once.

### Q2. Walk me through the base-image spectrum from largest to smallest.

| Base | Approx size | libc | Shell / pkg mgr | Best for |
|---|---|---|---|---|
| `ubuntu` / `debian` | 70–120MB+ | glibc | yes (`apt`) | familiarity, complex system deps |
| `debian:*-slim` | ~30–80MB | glibc | yes (`apt`) | safe default for most runtimes |
| `alpine` | ~5MB | **musl** | yes (`apk`, BusyBox) | Go, static tools, size-critical |
| `distroless` | ~2–20MB | glibc | **no** | secure runtime, Node/Java/Python/Go |
| `scratch` | 0 | none | none | static binaries (Go, Rust) |

As you go down: smaller and more secure, but less familiar and harder to debug. `ubuntu`/`debian` give you a full userland; `debian-slim` trims docs and extras but keeps glibc and `apt`; `alpine` is tiny but swaps in musl; `distroless` drops the shell and package manager; `scratch` is nothing at all.

### Q3. What's the difference between alpine and debian-slim, and when would you pick each?

Both are small; the real difference is **libc**. `debian-slim` is Debian with docs/extras stripped — still **glibc**, still `apt`. `alpine` is built on **musl libc** and BusyBox — smaller (~5MB base) but musl differs from glibc in DNS resolution, threading defaults, and locale handling.

Pick **alpine** when the app is a static binary or has no glibc-specific needs and size is critical (Go, small tools). Pick **debian-slim** when you want small *and* glibc compatibility with zero surprises — the common case for Python, Node, and Java, where musl can cause subtle bugs or force slow source builds of native deps.

Rule of thumb: `debian-slim` is the boring, safe default; alpine is the deliberate size optimization for workloads you've verified against musl.

### Q4. What are the musl-vs-glibc gotchas with alpine?

Alpine uses **musl libc** instead of glibc, and the differences bite in production:

- **DNS resolution** — musl historically resolved DNS differently (parallel A/AAAA queries, no `search`-domain edge cases handled the same way), causing intermittent lookup failures in some clusters.
- **Python wheels** — precompiled manylinux wheels are built against glibc. On alpine, pip can't use them, so it **compiles from source** — slow builds, and you need `gcc`/headers installed, ballooning the image (defeating the point).
- **Glibc-only binaries** — a third-party binary dynamically linked against glibc simply won't run on musl.
- **Subtle bugs** — stack size defaults, locale/encoding differences, and threading behaviour differ enough to cause rare, hard-to-reproduce failures.

The interview point: alpine's 5MB base is a false economy if you spend hours debugging musl issues or re-bloat it with a compiler to build wheels. That's why many teams standardize on `debian-slim` or distroless.

### Q5. What is a distroless image and what are its tradeoffs?

**Distroless** (from Google) is a base image containing only what your app needs to *run*: the language runtime, its shared libraries, CA certificates, and timezone data — **no shell, no package manager, no `ls`, no `apt`**. It still has glibc, so it's more compatible than alpine.

**Pros:** small, and a dramatically reduced attack surface — no shell for an attacker to drop into, far fewer packages for CVE scanners to flag. Great for production.

**Cons:** **debugging is harder**. You can't `docker exec -it ... sh` — there's no shell. You debug via the `:debug` variants (which add BusyBox), ephemeral debug containers (`kubectl debug`), or by testing thoroughly before shipping.

Distroless is the sweet spot for many teams: nearly as small as alpine, glibc-compatible, and more secure — at the cost of losing the interactive shell.

### Q6. What is `scratch` and when can you use it?

`scratch` is the **empty base** — a reserved, zero-byte image with no filesystem, no libc, no shell, nothing. `FROM scratch` gives you a truly minimal image containing only what you `COPY` in.

You can use it only for **statically linked binaries** that need no operating system at runtime — a Go binary built with `CGO_ENABLED=0`, or a static Rust binary. Multi-stage build compiles the binary in a builder stage, then:

```dockerfile
FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

FROM scratch
COPY --from=build /app /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
ENTRYPOINT ["/app"]
```

Note you must copy CA certs yourself (for outbound TLS) since scratch has none. The catch: **no shell, no debugging**, and if your binary is secretly dynamic (cgo enabled) it'll crash on a missing loader.

### Q7. Explain static vs dynamic linking in the context of base images.

A **dynamically linked** binary depends on shared libraries (`libc.so`, etc.) being present at runtime; the dynamic loader resolves them when the process starts. A **statically linked** binary bundles all its dependencies into the executable — it needs nothing from the OS.

This is the difference between being able to use `scratch`/distroless or not:

- A **static** Go binary (`CGO_ENABLED=0 go build`) runs on `scratch` — nothing else needed.
- A **dynamic** binary (default C, cgo-enabled Go, most compiled languages) needs the loader and its shared libs present, so it needs at least a distroless/slim base with glibc.

The classic trap: building Go with cgo enabled (the default when you import a C-dependent package), then putting it on `scratch` — it fails at startup because the glibc loader isn't there. Set `CGO_ENABLED=0` or land on a base that has glibc.

### Q8. How would you choose a base image for Go vs Node vs Python vs Java?

- **Go** — compile a static binary (`CGO_ENABLED=0`) in a builder stage, then `FROM scratch` or distroless-static. Tiny (~10MB) and no runtime needed.
- **Rust** — same story: static (musl target) binary on `scratch`/distroless.
- **Node** — you need the Node runtime, so `node:*-slim` for the build and a distroless Node or `-slim` for runtime; alpine works but watch native modules built against musl.
- **Python** — `debian-slim` or distroless Python. **Avoid alpine** unless you enjoy compiling wheels from source (manylinux wheels are glibc). Use a builder stage for anything with C extensions.
- **Java** — a JRE (not full JDK) on distroless-java or `-slim`, ideally with `jlink` to build a custom minimal runtime containing only the modules you use.

Pattern across all: **multi-stage build** — fat toolchain stage, minimal runtime stage — and pick the runtime base by whether the language ships a static binary (scratch) or needs a runtime (distroless/slim).

### Q9. This image is 2GB. Walk me through slimming it.

First **measure**, don't guess: `docker history <image>` to see which layers are fat, and `dive <image>` to see wasted/duplicated files. Then attack the usual suspects:

1. **Multi-stage build** — the biggest win. Move compilers, dev headers, and package managers into a builder stage; the final stage only `COPY --from=build` the artifact.
2. **`.dockerignore`** — stop `COPY . .` from dragging in `.git`, `node_modules`, test fixtures, and local build output.
3. **Slim/distroless base** — swap `ubuntu` for `debian-slim`, distroless, or `scratch` where the runtime allows.
4. **Clean caches in the same `RUN`** — `apt-get install ... && rm -rf /var/lib/apt/lists/*`, `npm ci --omit=dev`, `pip --no-cache-dir`.
5. **`--no-install-recommends`** on apt to skip suggested extras.
6. **Strip binaries** and drop dev-only deps from the runtime stage.

Re-measure after each change. Most 2GB images are fat because build tooling and source landed in the runtime image — multi-stage plus `.dockerignore` usually cuts the bulk.

### Q10. Why doesn't deleting files in a later layer reduce image size?

Because **each layer is immutable and additive**. If one `RUN` installs a package and a *later* `RUN` deletes it, the delete only records a "whiteout" in the new layer — the files still physically exist in the earlier layer, and the image is the sum of all layers. You've made it *bigger* (original files plus the deletion metadata).

```dockerfile
# WRONG — build cache still contains the 500MB, image doesn't shrink
RUN apt-get update && apt-get install -y build-essential
RUN rm -rf /var/lib/apt/lists/*   # too late, in a new layer

# RIGHT — install and clean in the same layer
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*
```

For build *tools* you need but don't want at runtime, the correct fix is a **multi-stage build** — leave them behind in the builder stage entirely.

### Q11. What slimming strategies do you know beyond multi-stage builds?

- **`.dockerignore`** — shrink the build context so junk never enters the image.
- **`--no-install-recommends`** (apt) — skip recommended-but-unneeded packages.
- **Clean package caches in the same `RUN`** — `rm -rf /var/lib/apt/lists/*`, `pip --no-cache-dir`, `npm cache clean`, `apk --no-cache`.
- **Prune dev dependencies** — `npm ci --omit=dev`, install only runtime Python deps.
- **Strip binaries** — remove debug symbols (`strip`, or build flags like Go's `-ldflags="-s -w"`).
- **Combine and order layers** — group related `RUN`s so caches are cleaned in-layer.
- **Slim/distroless/scratch base** — the base choice itself.
- **`docker-slim` / slim toolkit** — analyzes a running container and produces a minimized image containing only observed-used files (powerful, but test carefully — it can strip things used on rare code paths).

Combine these with a multi-stage build for the biggest effect.

### Q12. How do you measure and attribute what's taking up space in an image?

Two tools:

- **`docker history <image>`** — lists every layer, its size, and the instruction that created it. Instantly shows which `RUN`/`COPY` is fat.
- **`dive <image>`** — an interactive TUI that walks layers and shows exactly which files each one adds, plus "wasted space" from files added then modified/removed in later layers. It gives an efficiency score and is the best way to find duplicated or orphaned files.

```bash
docker history --no-trunc myregistry/app:1.2.3
dive myregistry/app:1.2.3
```

The principle: **measure before optimizing.** Guessing at what's big wastes time; `docker history` points you at the exact instruction and `dive` at the exact files.

### Q13. How does base-image choice affect security?

Fewer packages means **fewer CVEs and a smaller attack surface**. Every binary, library, and shell in the image is:

- something a scanner (Trivy, Grype) flags when a CVE lands, generating patch work;
- a tool an attacker can use after a breach (a shell to pivot from, `curl`/`wget` to pull payloads, a package manager to install tools).

A distroless or scratch image has **no shell and no package manager**, so a compromised process can't drop into `sh` or install anything — a meaningful reduction in blast radius. It also means fewer rebuilds chasing CVEs in packages you never used.

The tradeoff is debuggability, but from a pure security standpoint, "install only what runtime needs" is one of the highest-leverage hardening moves — it complements running as non-root `USER`, dropping capabilities, and `--read-only`.

### Q14. Why should you pin base-image digests and how do you keep bases patched?

**Pinning:** tags like `python:3.12-slim` are **mutable** — the maintainers repush them, so the same Dockerfile can produce different images over time, breaking reproducibility and supply-chain integrity. Pinning the **digest** freezes exactly what you build on:

```dockerfile
FROM python:3.12-slim@sha256:abc123...
```

**Keeping patched:** pinning creates the opposite risk — you get stuck on an old, vulnerable base. So pair pinning with a process that **rebuilds regularly**: automation (Renovate/Dependabot) that bumps the digest when a new patched base ships, plus scheduled rebuilds so CVE fixes in the base actually reach your image. The image only gets a patched base when you rebuild — a base image doesn't self-update. So: pin for reproducibility, automate the bumps, and rebuild on a cadence (and on CVE alerts) to stay patched.

### Q15. When is chasing a smaller image *not* worth it?

When the debugging and compatibility cost exceeds the size saving. Concretely:

- **Alpine on Python/glibc apps** — the musl pain (compiling wheels, DNS quirks, rare bugs) can cost far more engineering time than the megabytes save.
- **Scratch/distroless when you frequently need to debug live** — no shell means no `docker exec sh` at 3am. If your on-call story depends on interactive debugging and you don't have `kubectl debug`/ephemeral containers set up, a `-slim` base with a shell may be the pragmatic choice.
- **Micro-optimizing an already-small image** — shaving 5MB off a 30MB image while adding complex, fragile build steps is a poor trade.

The senior framing: optimize size until the **marginal megabyte costs more in maintainability than it saves in pull time and attack surface** — then stop. Correctness and operability beat a smaller number.

## CMD vs ENTRYPOINT & Container Startup

### Summary

**What this topic covers**

How a container actually starts, what runs as its main process, and why containers so often "ignore Ctrl-C" or take exactly 10 seconds to stop. Three concern areas: (1) **CMD vs ENTRYPOINT** — what each does, how they combine, and the ENTRYPOINT-plus-CMD pattern (fixed executable + overridable default args); (2) **exec form vs shell form** — the JSON-array form that makes your process PID 1 versus the string form that wraps it in `/bin/sh -c` and swallows signals; and (3) **PID 1 responsibilities** — signal handling, graceful shutdown, and zombie reaping, plus `--init`/tini and entrypoint wrapper scripts. The 16 questions run from "what's the difference between CMD and ENTRYPOINT" to the classic "my container takes 10s to stop — why." This is the topic that explains real production shutdown bugs.

**Mental model**

A container is **one main process** — the thing you point `ENTRYPOINT`/`CMD` at — running as **PID 1** inside the container's PID namespace. When Docker stops a container it sends **SIGTERM to PID 1**, waits a grace period (default 10s), then **SIGKILL**s. So graceful shutdown depends entirely on PID 1 (a) *being* your app and (b) *receiving and handling* SIGTERM. Two things break this. First, **shell form** (`CMD nginx -g '...'`) wraps your command in `/bin/sh -c`, making the **shell** PID 1; the shell doesn't forward SIGTERM to its child, so your app never hears the stop signal, sits through the 10s grace period, and gets SIGKILLed — no clean shutdown. Second, **PID 1 is special**: the kernel doesn't give it default signal handlers, and it's responsible for **reaping zombie** (orphaned, exited) child processes — jobs a normal app process isn't built for. The fixes: use **exec form** so your app *is* PID 1 and gets signals directly, use `exec "$@"` in wrapper scripts to hand off PID 1, and use `--init`/tini when you need a real init to reap zombies and forward signals.

**Key terms**

- **CMD** — the **default command/args**, easily overridden by appending a command to `docker run image ...`.
- **ENTRYPOINT** — the executable that **always** runs; `docker run` args become *its* arguments rather than replacing it.
- **Exec form** — JSON array (`["nginx","-g","daemon off;"]`); runs the binary directly, so it becomes PID 1 and receives signals.
- **Shell form** — a bare string (`nginx -g 'daemon off;'`); wrapped in `/bin/sh -c`, so the **shell** is PID 1 and signals aren't forwarded.
- **PID 1** — the first process in the container; has special signal semantics and must reap orphaned children.
- **Zombie process** — a child that has exited but whose exit status hasn't been reaped; accumulates if PID 1 doesn't `wait()` for it.
- **`--init` / tini** — a tiny init process Docker injects as PID 1 that reaps zombies and forwards signals to your app.
- **`exec "$@"`** — in a wrapper script, replaces the shell with your app so *it* becomes PID 1 (and inherits signals).
- **STOPSIGNAL** — the signal Docker sends on stop (default SIGTERM); overridable per image.
- **Graceful shutdown** — trapping SIGTERM to drain connections, flush, and exit cleanly before the SIGKILL deadline.
- **`docker stop`** — sends STOPSIGNAL (SIGTERM), waits the grace period (`-t`, default 10s), then SIGKILL.
- **`--entrypoint`** — a `docker run` flag to override the image's ENTRYPOINT.

**Why interviewers ask this**

This is the single best filter for "has this person actually operated containers." The junior answer is "CMD and ENTRYPOINT both set the startup command." The senior answer explains how they **combine** (ENTRYPOINT = binary, CMD = default args), why you'd prefer **exec form**, and can diagnose the real-world symptom — *"my container ignores Ctrl-C / takes 10 seconds to stop"* — down to shell form making `/bin/sh` PID 1 and swallowing SIGTERM. It also reaches into distributed-systems maturity: graceful shutdown (drain, deregister, finish in-flight requests) is what makes a rolling deploy not drop traffic. Someone who knows about zombie reaping, `--init`/tini, and `exec "$@"` in entrypoint scripts has debugged production container lifecycle issues, not just written a Dockerfile that runs.

**Common confusions**

- "CMD and ENTRYPOINT are interchangeable" — they combine: ENTRYPOINT is the executable, CMD supplies default args you can override.
- "Shell form and exec form are just style" — no; shell form breaks signal delivery and graceful shutdown. It matters a lot.
- "`docker run image bash` replaces everything" — with an ENTRYPOINT set, `bash` becomes an *argument* to the entrypoint; you need `--entrypoint bash` to actually replace it.
- "My app handles SIGTERM but shutdown still isn't clean" — check whether it's actually PID 1; if it's under `/bin/sh -c`, it never receives the signal.
- "Zombie processes are a leak in my app" — they're a PID-1 reaping problem; a normal process made PID 1 doesn't reap orphans. Use `--init`.
- "The 10s stop delay is Docker being slow" — it's the grace period expiring because your app never got (or never handled) SIGTERM.

**What follows from this topic**

PID 1 and signal handling connect straight to **Kubernetes**, where the same SIGTERM→grace→SIGKILL sequence drives pod termination, `preStop` hooks, and zero-downtime rollouts. The distroless/scratch bases from the **Image Size** topic have no shell — so shell-form CMD and shell wrapper scripts *cannot run there*, forcing exec form and making this knowledge mandatory. And entrypoint wrapper scripts that do first-run setup then `exec "$@"` tie into config/secrets injection and the **BuildKit** build patterns.

### Q1. What's the difference between CMD and ENTRYPOINT?

**CMD** sets the **default command and/or arguments** for the container. It's easily overridden: anything you append to `docker run image ...` *replaces* CMD entirely.

**ENTRYPOINT** sets the executable that **always runs**. Arguments you pass to `docker run image ...` become *arguments to the entrypoint* rather than replacing it (you need `--entrypoint` to override the executable itself).

```dockerfile
# CMD only — overridable
CMD ["python", "app.py"]
# docker run img            -> python app.py
# docker run img echo hi    -> echo hi   (CMD replaced)

# ENTRYPOINT only — fixed
ENTRYPOINT ["python", "app.py"]
# docker run img            -> python app.py
# docker run img --debug    -> python app.py --debug   (appended)
```

Rule of thumb: **ENTRYPOINT** for the thing the image *is* (the fixed binary/tool); **CMD** for default arguments a user might want to override.

### Q2. How do CMD and ENTRYPOINT combine?

When both are set, **ENTRYPOINT provides the executable and CMD provides the default arguments** — and those args are overridable at `docker run` time.

```dockerfile
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
# docker run img               -> nginx -g "daemon off;"
# docker run img -v            -> nginx -v          (CMD replaced by -v)
```

The container runs `ENTRYPOINT + CMD` concatenated. If the user passes their own args to `docker run`, those **replace CMD** but keep ENTRYPOINT. This is the idiomatic pattern: a fixed tool with sensible default arguments you can override without having to restate the binary.

Both should be **exec form** (JSON arrays) for this to behave predictably — mixing shell form here leads to surprising concatenation.

### Q3. Explain exec form vs shell form.

Two ways to write CMD/ENTRYPOINT:

- **Exec form** — a JSON array: `CMD ["nginx", "-g", "daemon off;"]`. Docker runs the binary **directly** (via `execve`), so your process becomes **PID 1** and receives signals.
- **Shell form** — a bare string: `CMD nginx -g 'daemon off;'`. Docker wraps it as `/bin/sh -c "nginx -g 'daemon off;'"`, so **`/bin/sh` is PID 1** and your process is its child.

```dockerfile
CMD ["nginx", "-g", "daemon off;"]   # exec form  — nginx is PID 1
CMD nginx -g 'daemon off;'           # shell form — sh is PID 1, nginx is a child
```

The consequence is huge: in shell form, the shell doesn't forward SIGTERM to nginx, so `docker stop` can't shut it down gracefully. **Prefer exec form** for CMD/ENTRYPOINT. Shell form is only worth it when you specifically need shell features (env var expansion, pipes) — and even then, prefer an explicit `sh -c` with `exec`.

### Q4. Why does shell form break signal handling / graceful shutdown?

Because shell form makes **`/bin/sh -c` PID 1**, not your app. When `docker stop` sends **SIGTERM to PID 1**, it hits the shell. A basic `sh` does **not forward signals** to the child process it launched, so your app never receives SIGTERM. It keeps running through the entire grace period, and after (default) 10 seconds Docker sends **SIGKILL**, which the app can't catch — no draining, no clean flush, abrupt death.

```dockerfile
# BAD — sh is PID 1, app never gets SIGTERM, dies by SIGKILL after 10s
CMD python app.py

# GOOD — python is PID 1, gets SIGTERM immediately, shuts down cleanly
CMD ["python", "app.py"]
```

This is *the* explanation for "my container takes 10 seconds to stop" and "my app never runs its shutdown handler." Fix: use exec form so the app is PID 1 and gets the signal directly.

### Q5. What are the special responsibilities of PID 1?

PID 1 is the **init process** of the container's PID namespace and the kernel treats it specially:

1. **Signal handling** — the kernel does *not* install default signal handlers for PID 1. If your app is PID 1 but doesn't explicitly handle SIGTERM, the signal is ignored by default (rather than terminating the process). So PID 1 must handle signals deliberately.
2. **Reaping zombies** — when a child process exits, it becomes a **zombie** until its parent `wait()`s for it. If the child's parent has died, the child is re-parented to **PID 1**, which is then responsible for reaping it. A normal application isn't written to reap arbitrary orphaned children, so zombies accumulate.

Normal apps assume a real init exists to do these jobs. Making an ordinary process PID 1 means it silently inherits duties it wasn't built for — the reason `--init`/tini exist.

### Q6. What is the zombie process problem in containers and how do you fix it?

A **zombie** is a child process that has exited but hasn't been **reaped** (its parent hasn't called `wait()` to collect the exit status). When a process's parent dies, the orphan is re-parented to **PID 1**, whose job is to reap it. Normal apps don't reap arbitrary orphans, so if your app is PID 1 and spawns subprocesses (or those subprocesses spawn their own), zombies can pile up and exhaust the PID table.

The fix is to run a **real init as PID 1** that reaps children:

```bash
docker run --init myimage        # Docker injects tini as PID 1
```

Or bake **tini** into the image as the entrypoint. `--init` is the easy button; it inserts a tiny init (tini) that both reaps zombies and forwards signals to your app. You mainly need it for apps that fork child processes; a single-process app that never forks rarely hits this.

### Q7. What does the `--init` flag do?

`docker run --init` inserts a **minimal init process (tini) as PID 1**, and runs your command as its child. Tini does the two things a normal app-as-PID-1 doesn't:

- **Reaps zombie processes** — `wait()`s on orphaned children so they don't accumulate.
- **Forwards signals** — passes SIGTERM/SIGINT through to your app, so graceful shutdown works even if your process wasn't designed to be PID 1.

```bash
docker run --init myimage
```

It's the low-effort fix for both the zombie-reaping problem and (partial) signal issues, without editing the Dockerfile. The alternative is baking tini in yourself (`ENTRYPOINT ["/tini", "--"]`). Use `--init` when your container forks subprocesses or when you can't guarantee your PID 1 handles signals and reaping properly.

### Q8. Why do people write entrypoint wrapper scripts, and why is `exec "$@"` critical?

An **entrypoint wrapper script** runs setup work before the app starts — rendering config from env vars, waiting for a dependency, running migrations, fixing permissions — then launches the real process:

```bash
#!/bin/sh
set -e
# ...do setup: render config, wait for db, etc...
exec "$@"     # replace the shell with the real command (CMD)
```

The **`exec`** is critical. Without it, the script (a shell) stays **PID 1** and runs your app as a *child*. Then SIGTERM hits the shell, isn't forwarded, and your app never shuts down gracefully — the shell-form problem all over again. With `exec "$@"`, the shell **replaces itself** with your app via `execve`, so the app *becomes* PID 1 and inherits signals directly. `"$@"` passes through the ENTRYPOINT/CMD args. Every good entrypoint script ends in `exec "$@"`.

### Q9. How do you implement graceful shutdown in a containerized app?

Graceful shutdown means: on SIGTERM, stop accepting new work, finish in-flight work, release resources, then exit — all before the SIGKILL deadline.

1. **Be PID 1** (exec form / `exec "$@"`) so you actually *receive* SIGTERM.
2. **Trap SIGTERM** and run a shutdown handler:

```javascript
process.on('SIGTERM', async () => {
  server.close();              // stop accepting new connections
  await drainInflight();       // finish in-flight requests
  await db.close();            // release resources
  process.exit(0);
});
```

3. **Drain within the grace period** — finish faster than the stop timeout (default 10s; tune with `docker stop -t` or Kubernetes `terminationGracePeriodSeconds`).
4. In Kubernetes, also deregister from the load balancer (readiness/`preStop`) so no new traffic arrives mid-shutdown.

The reward is zero-downtime rolling deploys: old pods drain cleanly while new ones take traffic.

### Q10. What is STOPSIGNAL and when would you change it?

`STOPSIGNAL` sets which signal Docker sends to PID 1 on `docker stop` (and container stop generally). The default is **SIGTERM**.

```dockerfile
STOPSIGNAL SIGQUIT
```

You change it when the app's clean-shutdown signal isn't SIGTERM. Classic example: **nginx** shuts down *gracefully* on **SIGQUIT** and does a *fast* (abrupt) shutdown on SIGTERM — so some nginx images set `STOPSIGNAL SIGQUIT`. Other software has its own conventions (e.g. some expect SIGINT). Setting STOPSIGNAL to match the app's expected shutdown signal ensures `docker stop` triggers the graceful path rather than an abrupt one or a wait-then-SIGKILL. It's a small but important detail for clean lifecycle behaviour.

### Q11. How do you override the ENTRYPOINT at runtime?

Use the `--entrypoint` flag on `docker run`. This is necessary because when an image has an ENTRYPOINT, positional args to `docker run` become *arguments to* the entrypoint, not a replacement for it.

```bash
# Image has ENTRYPOINT ["python","app.py"]

docker run img bash                    # runs: python app.py bash  (not a shell!)
docker run --entrypoint bash img       # actually runs bash
docker run --entrypoint sh img -c 'ls' # override entrypoint AND pass args
```

This is a common debugging move: an image's entrypoint launches the app, but you want a shell inside it to poke around — `--entrypoint sh` (or `bash`) does it. Note it won't help on distroless/scratch images that have no shell. In Kubernetes the equivalent is overriding `command:` in the pod spec.

### Q12. `docker run img bash` — with an ENTRYPOINT set, why don't I get a shell?

Because with an ENTRYPOINT defined, the arguments you pass to `docker run` are appended as **arguments to the entrypoint**, not treated as a new command. So `bash` becomes an argument to your entrypoint binary:

```dockerfile
ENTRYPOINT ["python", "app.py"]
# docker run img bash  ->  python app.py bash    (bash is an ARG, not the command)
```

`python app.py` runs with `bash` as an argument (which it probably ignores or errors on) — you never get an interactive shell. To actually run a shell you must override the entrypoint:

```bash
docker run --entrypoint bash img
```

This trips people up constantly. The mental model: **CMD is replaced by run args; ENTRYPOINT is not** — run args extend the entrypoint. To replace the executable you need `--entrypoint`.

### Q13. When do you actually need shell form?

When you need the **shell's features** at runtime — primarily **environment variable expansion**, pipes, redirects, or command chaining — because exec form does *not* invoke a shell and so won't expand `$VARS`:

```dockerfile
# exec form does NOT expand $PORT — passes the literal string "$PORT"
CMD ["sh", "-c", "exec myapp --port $PORT"]   # explicit sh -c, but exec hands off PID 1
```

The idiom is: still use JSON/exec form, but explicitly invoke `sh -c` **with `exec`** so the final app replaces the shell and becomes PID 1 (keeping signal handling intact). Plain shell form (`CMD myapp --port $PORT`) does the same wrapping but *without* `exec`, so the shell stays PID 1 and swallows signals. So the rule is: if you need shell expansion, write `["sh","-c","exec ... $VAR"]`, not the bare-string shell form.

### Q14. Walk me through the `docker stop` sequence.

`docker stop` performs a **graceful-then-forceful** shutdown:

1. Sends **STOPSIGNAL** (default **SIGTERM**) to **PID 1** of the container.
2. **Waits** the grace period — default **10 seconds**, configurable with `docker stop -t <seconds>`.
3. If the container is still running when the timer expires, sends **SIGKILL** (uncatchable, immediate termination).

```bash
docker stop mycontainer          # SIGTERM, wait 10s, SIGKILL
docker stop -t 30 mycontainer    # give it 30s to drain
docker kill mycontainer          # SIGKILL immediately, no grace
```

So a well-behaved container catches SIGTERM, drains within the grace window, and exits 0 *before* SIGKILL. A container that ignores or never receives SIGTERM (shell-form trap) always eats the full 10s and dies by SIGKILL. Kubernetes mirrors this exactly with `terminationGracePeriodSeconds`.

### Q15. My container ignores Ctrl-C / takes 10 seconds to stop. Why?

Almost always: **your app isn't receiving SIGTERM**, so it never shuts down, and Docker SIGKILLs it after the 10s grace period. Two usual root causes:

1. **Shell form CMD/ENTRYPOINT** — `CMD python app.py` wraps in `/bin/sh -c`, making the shell PID 1. The shell doesn't forward SIGTERM to your app. Fix: use **exec form** `CMD ["python","app.py"]`.
2. **Wrapper script without `exec`** — an entrypoint script that runs `python app.py` (as a child) instead of `exec python app.py` stays PID 1 itself and swallows the signal. Fix: end the script with `exec "$@"`.

Secondary causes: the app *is* PID 1 but doesn't install a SIGTERM handler (some runtimes ignore it by default at PID 1), or it needs `--init`. Diagnose by checking what's actually PID 1 (`docker top` / `ps` inside the container) — if it's `sh`, that's your bug.

### Q16. Describe the ENTRYPOINT-plus-CMD "fixed tool with default args" pattern.

Use **ENTRYPOINT for the fixed executable** the image is built around, and **CMD for default arguments** the user can override without restating the binary:

```dockerfile
ENTRYPOINT ["curl"]
CMD ["--help"]
# docker run img                      -> curl --help
# docker run img https://example.com  -> curl https://example.com  (CMD replaced)
```

The image behaves like the tool itself: `docker run myimage <args>` feels like running `curl <args>`. The ENTRYPOINT guarantees `curl` always runs; CMD gives a friendly default when no args are supplied.

The same pattern suits app images: `ENTRYPOINT ["./myserver"]`, `CMD ["--config","/etc/app/prod.yaml"]` — always start the server, with a default config that's easy to override at run time. Keep both in **exec form** so signals and arg concatenation behave correctly.

## Building Images: BuildKit & buildx

### Summary

**What this topic covers**

The modern Docker build engine and how to use it to build fast, secure, multi-architecture images. Three concern areas: (1) **BuildKit** — the default builder, its parallel stage execution and improved caching, and the advanced `RUN --mount` features it unlocks; (2) **build-time secrets and caching** — `--secret` and `--ssh` (get credentials into a build *without baking them into a layer*), `--mount=type=cache` for package-manager caches, and build args (and why they're *not* for secrets); and (3) **buildx** — multi-architecture builds, registry cache for CI, build drivers, and attestations. The 16 questions run from "what is BuildKit" to "the layer cache never hits in CI — fix it." This topic is where slimming and multi-stage builds become *fast and secure*, and it's the source of the most important supply-chain answer: never put secrets in image history.

**Mental model**

Old-Docker built a Dockerfile **linearly**, one instruction at a time, with a crude cache. **BuildKit** models the build as a **dependency graph (DAG)**: independent stages run **in parallel**, unused stages are skipped, and caching is content-addressed and far smarter. On top of that graph, BuildKit adds **`RUN --mount`**: you can mount things *for the duration of a single `RUN`* that **don't become part of any layer** — a **secret** (a token available only while that command runs), an **SSH agent** socket (for `git clone` of private deps), a **cache** directory (persist npm/apt/go caches across builds), or a **bind** of the build context. The crucial security consequence: a `--secret` mounted into a `RUN` is *gone* when the layer is committed — it never lands in image history — whereas an `ARG`/`ENV`/`COPY`'d secret persists **forever** in a layer, recoverable by anyone with the image. **buildx** is the CLI front-end that drives BuildKit and adds **multi-arch** builds (one `docker buildx build --platform linux/amd64,linux/arm64` producing a manifest list), plus **registry cache** (`--cache-to/--cache-from`) so ephemeral CI runners share a build cache. The mental shift: builds are a graph, secrets are mounts not layers, and cache is something you export and import.

**Key terms**

- **BuildKit** — Docker's modern build engine (default); parallel DAG execution, better caching, `RUN --mount`, secrets, multi-arch.
- **buildx** — the CLI plugin (`docker buildx build`) that drives BuildKit and adds multi-platform, drivers, and cache export/import.
- **`--secret`** — mounts a secret file/env into a single `RUN` (`RUN --mount=type=secret,id=...`); never written to a layer.
- **`--ssh`** — forwards your SSH agent into a `RUN` so it can clone private git repos/deps without embedding keys.
- **Cache mount** — `RUN --mount=type=cache,target=...` persists a package-manager cache across builds without baking it into the image.
- **Bind mount (build)** — `RUN --mount=type=bind` mounts context files into a `RUN` without a `COPY` layer.
- **Build arg (`ARG`)** — a build-time variable set with `--build-arg`; **visible in `docker history`**, so never a secret.
- **Multi-arch build** — one build producing images for several CPU architectures, published as a manifest list.
- **Manifest list** — a multi-arch index; a `docker pull` auto-selects the image matching the host's architecture.
- **Registry cache** — `--cache-to/--cache-from type=registry`; stores build cache in a registry so ephemeral CI runners can reuse it.
- **Build driver** — the BuildKit backend: `docker` (default, limited), `docker-container` (full features), `kubernetes` (build in a cluster).
- **Attestation (SBOM/provenance)** — signed metadata about how the image was built and what it contains, emitted at build time.

**Why interviewers ask this**

Build knowledge separates people who *ship containers in a real pipeline* from people who only build locally. The highest-value signal is **secret handling**: a junior does `ARG NPM_TOKEN` or `COPY id_rsa .` and leaks a credential into image history forever; a senior reaches for `RUN --mount=type=secret` or `--ssh` and can explain *why* the layer-persistence of ARG makes it unsafe. The second signal is **CI performance**: "the cache never hits in CI" is a real, common problem (ephemeral runners have no local cache) with a specific fix (`--cache-to/--cache-from type=registry`). The third is **multi-arch** awareness (arm64 laptops + amd64 servers) via `buildx`. Cache mounts, build drivers, and attestations round out someone who has genuinely optimized and hardened a build pipeline — not just written a working Dockerfile.

**Common confusions**

- "Build args are fine for secrets" — no. `ARG`/`--build-arg` values are visible in `docker history` and build logs. Use `--secret`.
- "`COPY`ing a key then `rm`-ing it removes it" — it doesn't; the key persists in the earlier layer forever. Use `--ssh` or `--secret`.
- "BuildKit and buildx are the same thing" — BuildKit is the *engine*; buildx is the *CLI* that drives it and adds multi-arch/cache features.
- "Cache mounts get baked into the image" — they don't; a `--mount=type=cache` dir is *not* part of any layer, just reused across builds.
- "CI cache misses mean my Dockerfile is wrong" — often the runner is just ephemeral; you need registry (remote) cache to share across runs.
- "Multi-arch just works" — you either emulate other arches (QEMU, slow) or build on native nodes; either way it's a `buildx` multi-platform build producing a manifest list.

**What follows from this topic**

Secrets-as-mounts and multi-stage caching make the **Image Size** slimming strategies both *fast* (cache mounts) and *safe* (no leaked credentials in a slim final image). Multi-arch builds feed directly into **Kubernetes** on mixed-architecture clusters. Build-time provenance/SBOM attestations connect to image **security and supply chain** — signing and scanning what you built. And the `--ssh`/`--secret` patterns for pulling private dependencies tie back to the private-registry and auth concerns elsewhere in the primer.

### Q1. What is BuildKit and why is it the modern default?

**BuildKit** is Docker's modern build engine, the default since Docker 23. It replaced the old linear builder and brings:

- **Parallel execution** — it models the build as a dependency graph (DAG), so independent stages of a multi-stage build run **concurrently** and unused stages are skipped entirely.
- **Better caching** — smarter, content-addressed cache with fine-grained invalidation, plus exportable/importable cache (`--cache-to/--cache-from`).
- **`RUN --mount`** — mounts for a single command: **secrets**, **SSH agent**, **cache** dirs, and **bind** mounts — none of which land in a layer.
- **Multi-arch** builds via buildx, and **build attestations** (SBOM/provenance).

The practical payoff is faster, more secure builds: parallel stages, cached package installs, and secrets that never get baked into image history. It's on by default now, but you can be explicit with `DOCKER_BUILDKIT=1` or by using `docker buildx build`.

### Q2. How do you enable BuildKit and what's the difference from the legacy builder?

On recent Docker it's **on by default**. To be explicit:

```bash
export DOCKER_BUILDKIT=1        # env toggle for `docker build`
docker buildx build .           # buildx always uses BuildKit
# or set { "features": { "buildkit": true } } in daemon.json
```

Differences from the legacy builder:

- **Parallelism** — legacy built strictly top-to-bottom; BuildKit runs independent stages concurrently.
- **Skips unused stages** — legacy built every stage; BuildKit builds only what the target needs.
- **Advanced mounts** — `--secret`, `--ssh`, `--mount=type=cache` require BuildKit; legacy can't do them.
- **Cache export** — BuildKit can push/pull cache to a registry.

Note the Dockerfile `# syntax=docker/dockerfile:1` directive at the top opts into the current Dockerfile frontend, enabling the newest `RUN --mount` syntax regardless of daemon version.

### Q3. How do you pass a secret into a build without baking it into the image?

Use BuildKit's **`--secret`**. The secret is **mounted into a single `RUN`** and is gone once that command finishes — it never becomes part of any layer or `docker history`.

```dockerfile
# syntax=docker/dockerfile:1
FROM alpine
RUN --mount=type=secret,id=npmtoken \
    NPM_TOKEN=$(cat /run/secrets/npmtoken) npm ci
```

```bash
docker build --secret id=npmtoken,src=$HOME/.npmtoken .
# or from an env var:
docker build --secret id=npmtoken,env=NPM_TOKEN .
```

The token exists only at `/run/secrets/npmtoken` **during that RUN**. Nothing is written to the filesystem that gets committed, so pulling the image reveals nothing. This is the correct, safe way to authenticate to a private package registry or API during a build.

### Q4. Why is passing a secret via ARG or COPY dangerous?

Because it **persists in the image forever**:

- **`ARG`/`--build-arg`** values are recorded in **`docker history`** and appear in build logs. Anyone who can pull the image (or read CI logs) can read the value.
- **`COPY secret .`** writes the file into a **layer**. Even if a later `RUN rm secret` deletes it, the file still exists in the earlier layer (layers are immutable and additive), and `docker save` / layer extraction recovers it trivially.

```dockerfile
# BOTH LEAK — never do this
ARG NPM_TOKEN                 # visible in `docker history`
COPY id_rsa /root/.ssh/       # persists in the layer even after `rm`
```

The mental model: **anything that touches a layer or build metadata is permanent and extractable.** Secrets must be provided via ephemeral mounts (`--secret`, `--ssh`) that BuildKit guarantees never get committed. Treat a leaked build-arg secret as compromised — rotate it.

### Q5. How do you clone a private git repo or install private dependencies during a build?

Use **`--ssh`** to forward your local SSH agent into the build's `RUN`, so it can authenticate to private git without ever embedding a key:

```dockerfile
# syntax=docker/dockerfile:1
FROM alpine
RUN apk add --no-cache openssh-client git
RUN --mount=type=ssh git clone git@github.com:acme/private-lib.git
```

```bash
docker build --ssh default .    # forwards your ssh-agent
```

The SSH agent socket is available only during that `RUN`; **no private key is copied into the image**. This is the right pattern for `go mod download`, `npm ci`, `pip install` etc. that pull private git dependencies. For token-based private registries, use `--secret` instead. Both avoid the fatal mistake of `COPY id_rsa` — which would leave the key in a layer permanently.

### Q6. What are cache mounts and what problem do they solve?

A **cache mount** (`RUN --mount=type=cache`) gives a `RUN` a persistent directory that survives across builds but is **not baked into any layer**. It's for **package-manager caches** — the downloaded packages you want to reuse but not ship.

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.23
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
```

Other examples: `--mount=type=cache,target=/root/.cache/pip` for pip, `.../var/cache/apt` for apt, `.../root/.npm` for npm. The problem it solves: without it, a cache-invalidating change (e.g. adding one dependency) forces re-downloading *everything* into a new layer. With a cache mount, the downloads persist on the builder and are reused — dramatically faster rebuilds — while the image stays slim because the cache never becomes a layer.

### Q7. What are bind mounts during a build used for?

`RUN --mount=type=bind` mounts files from the **build context** (or another stage) into a `RUN` **without creating a `COPY` layer**. It's useful when you need files *available during a command* but don't want them persisted in the image.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-slim
WORKDIR /app
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
```

Here `package.json` is available to `npm ci` but isn't `COPY`'d into its own layer. You can also bind from an earlier stage (`from=builder`). Combined with cache mounts, this is a common pattern for dependency installs that are both fast (cache) and clean (no stray layers). It avoids the older trick of `COPY`ing manifests just to run install, then having them in a layer.

### Q8. What are build args and why aren't they for secrets?

**Build args** (`ARG`) are build-time variables, set with `--build-arg`, used to parameterize a build (versions, feature flags, base-image tags):

```dockerfile
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim
ARG APP_ENV=production
```

```bash
docker build --build-arg NODE_VERSION=22 .
```

They're **not for secrets** because their values are recorded in **`docker history`** and visible in build output — anyone who can inspect the image can read them. They're for non-sensitive configuration only. For anything secret (tokens, keys), use `--secret`/`--ssh`, which are ephemeral mounts that never persist. Also note `ARG` scope: an `ARG` before `FROM` is only usable in the `FROM` line unless re-declared after it — a common gotcha.

### Q9. What is buildx and how does it relate to BuildKit?

**BuildKit is the engine; buildx is the CLI front-end that drives it.** `docker buildx build` is the extended build command that exposes BuildKit's full feature set, most of which the plain `docker build` path historically couldn't reach:

- **Multi-platform builds** (`--platform linux/amd64,linux/arm64`).
- **Cache export/import** (`--cache-to`/`--cache-from`), including registry cache.
- **Build drivers** — run BuildKit in a container or a Kubernetes cluster, not just the default daemon.
- **Attestations** — SBOM and provenance.

```bash
docker buildx create --use            # create a builder (docker-container driver)
docker buildx build --platform linux/amd64,linux/arm64 -t acme/app:1.0 --push .
```

So the relationship is: buildx orchestrates one or more BuildKit builder instances and gives you the advanced flags. On modern Docker, `docker build` is increasingly an alias into buildx anyway, but reaching for `docker buildx build` guarantees the full feature set.

### Q10. How do you build a multi-architecture image?

Use `docker buildx build --platform` with a builder that supports multiple platforms, and `--push` to publish a **manifest list**:

```bash
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myregistry/app:1.2.3 --push .
```

This produces one image per architecture plus a **manifest list** (a multi-arch index) under the single tag. When someone runs `docker pull myregistry/app:1.2.3`, Docker automatically selects the image matching their host architecture.

Two ways to build the non-native arches:

- **QEMU emulation** — buildx emulates the other CPU (easy, single machine, but **slow** for compile-heavy builds).
- **Native nodes** — attach real arm64 and amd64 builder nodes; each builds its own arch (fast, more setup).

Multi-arch matters because dev laptops are arm64 (Apple Silicon) while servers are often amd64 — you want one tag that works everywhere.

### Q11. The layer cache never hits in CI — why, and how do you fix it?

The usual cause: **CI runners are ephemeral.** Each job starts on a fresh machine with **no local build cache**, so every build starts cold — even though nothing changed. BuildKit's local cache lives on the builder, which CI throws away.

The fix is **remote (registry) cache** — export the build cache to a registry and import it on the next run:

```bash
docker buildx build \
  --cache-to type=registry,ref=myregistry/app:buildcache,mode=max \
  --cache-from type=registry,ref=myregistry/app:buildcache \
  -t myregistry/app:1.2.3 --push .
```

`--cache-to` pushes the cache (use `mode=max` to cache *all* stages, not just the final one); `--cache-from` pulls it at the start of the next build so layers hit across ephemeral runners. Alternatives: `type=gha` (GitHub Actions cache), `type=inline` (embeds cache metadata in the image — simpler but only final-stage), or a persistent runner/cache volume. Registry cache is the standard CI answer.

### Q12. What is inline cache and how does it differ from registry cache?

**Inline cache** embeds the cache metadata *inside the pushed image itself* (`--cache-to type=inline`), so the image doubles as its own cache source:

```bash
docker buildx build \
  --cache-to type=inline \
  --cache-from myregistry/app:latest \
  -t myregistry/app:latest --push .
```

It's simple — no separate cache artifact — but it only captures the **final stage's** layers, so intermediate/build-stage cache isn't shared. **Registry cache** (`type=registry`) stores cache as a **separate** artifact and, with `mode=max`, captures **all stages** including builder stages — better hit rates for multi-stage builds, at the cost of managing a separate cache ref.

Rule of thumb: inline for simple single-stage or when you want the image to be self-contained; **registry cache with `mode=max`** for multi-stage builds where you want the expensive builder-stage work cached too.

### Q13. What are build drivers?

A **build driver** is the backend BuildKit runs on. buildx supports several:

- **`docker`** (default) — uses the BuildKit bundled in the Docker daemon. Zero setup, but **limited**: no multi-platform in one build, no cache export.
- **`docker-container`** — runs BuildKit in a dedicated container. **Full feature set**: multi-arch, cache export/import, all mounts. The usual choice for real pipelines (`docker buildx create --driver docker-container --use`).
- **`kubernetes`** — runs BuildKit pods in a cluster, so builds scale across nodes (useful for shared CI build farms).
- **`remote`** — connects to an already-running BuildKit instance.

```bash
docker buildx create --driver docker-container --use
```

The interview point: if someone says "`--platform` multi-arch doesn't work" or "`--cache-to` is rejected," the cause is usually the default `docker` driver — switching to `docker-container` unlocks those features.

### Q14. What are heredocs in RUN and why are they useful?

BuildKit's Dockerfile frontend supports **heredocs**, letting you write multi-line scripts inside a single `RUN` without `&&`/backslash chains:

```dockerfile
# syntax=docker/dockerfile:1
FROM debian:12-slim
RUN <<EOF
set -eux
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl
rm -rf /var/lib/apt/lists/*
EOF
```

Benefits: it's readable (no trailing `\` and `&&` noise), keeps the whole script in **one layer** (so cache cleanup happens in-layer, as slimming requires), and you can add `set -e` for fail-fast behaviour. You can also heredoc file contents (`COPY <<EOF /path`). It requires the `# syntax=docker/dockerfile:1` frontend directive at the top. It's a quality-of-life feature that makes complex `RUN` blocks far cleaner than the classic single-line-with-backslashes idiom.

### Q15. What are provenance and SBOM attestations at build time?

**Attestations** are signed metadata BuildKit can attach to an image describing *how it was built* and *what's in it* — key supply-chain artifacts:

- **Provenance** — records the build inputs: the Dockerfile, base images (by digest), build args, source commit, and builder. Answers "how was this image produced?" (SLSA-style provenance).
- **SBOM (Software Bill of Materials)** — an inventory of the packages/dependencies inside the image. Answers "what's in this image?" — feeds vulnerability scanning and license auditing.

```bash
docker buildx build \
  --provenance=true --sbom=true \
  -t myregistry/app:1.2.3 --push .
```

They're published alongside the image in the registry (as attestation manifests). Downstream, tools verify provenance (was this built by our pipeline from our source?) and scan the SBOM for CVEs. This ties into image **signing** (cosign) and policy enforcement — proving an image is trustworthy, not just that it runs.

### Q16. What is the Dockerfile syntax directive and what are BuildKit frontends?

A **frontend** is the component that parses a Dockerfile and turns it into BuildKit's build graph. The `# syntax=` directive at the very top of a Dockerfile selects **which frontend version** to use — pulled as an image at build time — independent of your Docker daemon version:

```dockerfile
# syntax=docker/dockerfile:1
FROM alpine
RUN --mount=type=cache,target=/var/cache/apk apk add curl
```

`docker/dockerfile:1` pins the current stable frontend and auto-updates to the latest 1.x, so you get the newest Dockerfile features (`RUN --mount`, heredocs, `--secret`, etc.) **even on an older daemon**. Without it, you're limited to whatever syntax your local BuildKit shipped with. Best practice is to always include `# syntax=docker/dockerfile:1` as line 1 — it future-proofs the Dockerfile and unlocks the advanced mount/secret/heredoc syntax this topic relies on. (Frontends are pluggable — you could point at a custom one, but the Dockerfile frontend is the standard.)
## Registries & Distribution

### Summary

**What this topic covers**

How images get from a build machine to wherever they run — the **registry** layer of the Docker ecosystem. A registry stores and distributes images over the **OCI distribution spec** (a standardised HTTP API), and everything you do with `docker push`/`pull`/`login` talks to one. The 15 questions here cover: what a registry actually is and the public-vs-private landscape (Docker Hub, GHCR, ECR, Google Artifact Registry, Azure ACR, Harbor, GitLab); the anatomy of an image reference (`registry-host/namespace/repo:tag` and the implicit `docker.io/library` defaults); **tagging strategy** (immutable version tags vs the mutable `:latest` trap); **digests** (`@sha256:…`) for true immutability and supply-chain safety; Docker Hub **rate limits** and how to survive them in CI; **image signing / content trust** (cosign, Notary); pull-through caches and registry mirrors; private-registry auth in CI and Kubernetes; promoting one image across environments; retention/garbage collection; multi-arch manifests; registry-side vulnerability scanning; and air-gapped `save`/`load` distribution.

**Mental model**

Treat a registry as a **content-addressable blob store with a naming layer on top**. Underneath, an image is a set of layer blobs and a config blob, each addressed by its `sha256` digest, plus a **manifest** that lists them. On top of that immutable content sits a **mutable tag** — a human-friendly pointer (`app:1.2.3`) that can be re-pointed at any time. That single distinction drives every senior decision in this topic: **tags lie, digests don't**. When you `docker pull app:1.2.3`, the registry resolves the tag to a manifest digest and streams down only the layers you don't already have (content-addressing means shared base layers are downloaded once). "Promoting" an image between dev/staging/prod should therefore mean **moving the same digest forward**, never rebuilding — a rebuild produces different bytes and voids everything you tested. Think of the registry as the boundary between *build-time* and *run-time*: build once, push once, pull that exact artifact everywhere.

**Key terms**

- **Registry** — a server implementing the OCI distribution API that stores and serves images (Docker Hub, GHCR, ECR, Harbor).
- **Repository** — a named collection of related images inside a registry (e.g. `acme/app`); tags live under it.
- **Tag** — a mutable, human-readable pointer to a manifest (`:1.2.3`, `:latest`). Can be moved.
- **Digest** — an immutable content hash (`@sha256:…`) identifying exact bytes; never changes.
- **Manifest** — the JSON listing an image's layers + config; what a tag/digest resolves to.
- **Manifest list / image index** — a multi-arch manifest mapping platforms (`linux/amd64`, `linux/arm64`) to per-arch manifests.
- **`docker.io/library`** — the implicit default registry + namespace for official images (`ubuntu` = `docker.io/library/ubuntu`).
- **Pull-through cache / mirror** — a registry that caches upstream images locally to cut bandwidth and dodge rate limits.
- **Content trust / signing** — cryptographic provenance (Docker Content Trust/Notary, cosign/sigstore) proving who published an image.
- **imagePullSecret** — a Kubernetes secret holding registry credentials so nodes can pull private images.
- **Garbage collection** — reclaiming disk by deleting layer blobs no longer referenced by any tag/manifest.

**Why interviewers ask this**

Registries are where "it works on my machine" becomes "it works in production" — so this is a **operational maturity** probe. A junior answer stops at "you push to Docker Hub with `docker push`." A senior answer reasons about the **supply chain**: pinning by digest for reproducibility, why `:latest` in a Kubernetes manifest is a rollback nightmare, how Docker Hub rate limits silently break CI at scale and the three fixes (authenticate, mirror, pull-through cache), how images are signed and verified, and how credentials reach a CI runner or a Kubernetes node without being baked into a layer. Interviewers also listen for **promotion discipline** — do you rebuild per environment (wrong) or move a tested digest forward (right)? Getting registries right signals you've run real deployment pipelines, not just `docker run` on a laptop.

**Common confusions**

- "`:latest` means the newest image" — it doesn't; it's just a tag that happens to be named `latest`, and it points wherever it was last pushed. Nothing auto-updates it.
- "Tags are immutable" — no, tags are **mutable pointers**. Only digests are immutable.
- "`docker pull ubuntu` hits some special Ubuntu server" — it's `docker.io/library/ubuntu`; the registry and `library` namespace are just defaulted in.
- "Rate limits only affect anonymous users" — free authenticated accounts are also capped; heavy CI needs paid auth, a mirror, or a cache.
- "Scanning at build time is enough" — new CVEs are disclosed daily, so registry-side rescanning of *already-pushed* images matters too.
- "Pushing to two registries duplicates my testing" — only if you rebuild. Copy the same digest (`crane`/`skopeo`) to keep the artifact identical.

**What follows from this topic**

Registries sit downstream of **image building** (the layers you push were produced by a Dockerfile) and upstream of **running containers** (every `docker run`/`kubectl apply` resolves a reference against a registry). Digest pinning connects to reproducibility everywhere; signing and scanning connect to the **security** topic; multi-arch manifests connect to `buildx`. If you understand that a registry is just addressable content with mutable names on top, the rest — promotion, caching, trust — falls out naturally.

### Q1. What is a container registry, and what protocol does it speak?

A **registry** is a server that stores and distributes container images. It's the distribution hub between building an image and running it: you `push` images to it and `pull` them from it.

Registries implement the **OCI distribution specification** — a standardised HTTP(S) API for uploading and downloading image manifests and layer blobs. Because it's a standard, any compliant client (Docker, Podman, containerd, `crane`, `skopeo`) can talk to any compliant registry (Docker Hub, GHCR, ECR, Harbor).

Under the hood it's a **content-addressable blob store**: layers and config are stored by their `sha256` digest, and a manifest ties them together. Tags are a naming layer on top. Pulling an image resolves the tag to a manifest, then downloads only the layer blobs the client doesn't already have.

### Q2. What's the difference between a public and a private registry, and what are the main options?

**Public** registries serve images anyone can pull (subject to rate limits); **private** registries require authentication and are for your proprietary images.

| Registry | Type | Notes |
|---|---|---|
| Docker Hub (`docker.io`) | Public + private | Default; hosts official images; strict pull rate limits |
| GitHub Container Registry (`ghcr.io`) | Public + private | Tied to GitHub repos/orgs; great for CI |
| Amazon ECR | Private (public option) | AWS-native; IAM auth; per-region |
| Google Artifact Registry | Private | GCP-native; supersedes GCR |
| Azure Container Registry (ACR) | Private | Azure-native |
| Harbor | Self-hosted | Open-source; adds scanning, signing, RBAC, replication |
| GitLab Container Registry | Private | Bundled with GitLab projects |

Most orgs use their cloud provider's registry (ECR/GAR/ACR) for proximity and IAM integration, or self-host **Harbor** for full control (air-gapped, on-prem policy). Docker Hub is mostly a source of base images, not a place to push app images at scale — because of rate limits.

### Q3. Walk me through `docker login`, `push`, and `pull`.

```bash
# authenticate (credentials stored in ~/.docker/config.json, ideally via a helper)
docker login ghcr.io -u alice   # prompts for token/password

# tag a local image with the full target reference
docker tag my-app ghcr.io/acme/my-app:1.2.3

# upload it — pushes each layer blob then the manifest
docker push ghcr.io/acme/my-app:1.2.3

# download it elsewhere
docker pull ghcr.io/acme/my-app:1.2.3
```

`docker login` stores an auth token (base64 by default — prefer a **credential helper** so plaintext secrets don't sit in `config.json`). `push` uploads only layers the registry doesn't already have, then writes the manifest. `pull` does the reverse, resolving the tag to a manifest and fetching missing layers. Note the image must be **tagged with the full reference** (`registry/namespace/repo:tag`) before it can be pushed.

### Q4. Break down an image reference like `ghcr.io/acme/app:1.2.3`. What are the implicit defaults?

An image reference has up to four parts: `[REGISTRY-HOST[:PORT]/]NAMESPACE/REPOSITORY[:TAG][@DIGEST]`.

- **Registry host** — `ghcr.io`. If omitted, defaults to **`docker.io`** (Docker Hub).
- **Namespace** — `acme` (user/org). For Docker Hub official images it defaults to **`library`**.
- **Repository** — `app`.
- **Tag** — `1.2.3`. Defaults to **`latest`** if omitted.

So `ubuntu` fully expands to **`docker.io/library/ubuntu:latest`**, and `acme/app` expands to `docker.io/acme/app:latest`. This is why `docker pull ubuntu` "just works" — Docker fills in the registry, namespace, and tag. A reference can also pin a **digest**: `app@sha256:abc…`, which overrides the tag and identifies exact bytes.

### Q5. What tagging strategy would you use, and why is `:latest` a trap?

Use **immutable, meaningful tags** and treat `:latest` as untrustworthy.

A solid scheme layers several tags on the same build:
- **Semantic version** — `app:1.4.2` (and moving `app:1.4`, `app:1` if you like) for humans.
- **Git SHA** — `app:git-9f3a1c` for exact traceability back to source.
- **Environment** (optional, mutable) — `app:staging` as a promotable pointer.

The `:latest` trap: it's just a tag named "latest" that points wherever you last pushed. It's **mutable**, so two `docker pull app:latest` a week apart can silently return different images. In a Kubernetes manifest, `image: app:latest` means you can't reproduce or roll back reliably — the tag may have moved. Rule: **pin runtime deployments to immutable tags or digests**; reserve `:latest` for casual local convenience.

### Q6. What's an image digest, and why deploy by digest instead of by tag?

A **digest** is the `sha256` hash of an image's manifest — `app@sha256:abcd…`. Because it's a content hash, it identifies **exact bytes** and can never change. A tag can be re-pointed; a digest cannot.

Deploy by digest when you need **guaranteed reproducibility and supply-chain safety**:

```bash
# what actually shipped, resolvable forever
docker pull ghcr.io/acme/app@sha256:9f3a1c...
```

If prod pins `app:1.2.3` and someone (or an attacker) re-pushes `1.2.3` to different content, your next pull silently runs different code. Pinning `@sha256:…` closes that hole — a moved tag can't change what runs. This is the core of **reproducible deploys** and a key supply-chain control: you tested a specific digest, so you deploy that digest. Tags are for humans; digests are for machines and audits.

### Q7. Docker Hub rate limits keep breaking our CI. What's happening and how do you fix it?

Docker Hub caps **pulls per time window** by identity: anonymous pulls are limited by source IP, and free authenticated accounts get a modest allowance. CI is a perfect storm — many parallel jobs behind a **shared NAT IP** all pulling base images anonymously blow through the anonymous limit fast, and you get `toomanyrequests: You have reached your pull rate limit`.

Three fixes, best combined:
1. **Authenticate** in CI (`docker login` with a paid/team account) so the limit is per-account, not per-shared-IP, and higher.
2. **Run a pull-through cache / registry mirror** so repeated base-image pulls hit your local cache, not Docker Hub.
3. **Vendor base images into your own registry** (ECR/GHCR/Harbor) and pull from there — no Docker Hub dependency at all in the hot path.

Long term, senior teams stop pulling public base images directly in CI and mirror them internally, both for rate limits and for supply-chain control.

### Q8. What is image signing / content trust, and why does it matter?

Signing attaches a **cryptographic signature** to an image so consumers can verify **who published it** and that it **hasn't been tampered with** — provenance for the supply chain.

Two ecosystems:
- **Docker Content Trust (DCT) / Notary** — the older Docker-native mechanism (`DOCKER_CONTENT_TRUST=1`) signing tags via TUF.
- **cosign / sigstore** — the modern, widely-adopted approach; signs images (and attestations/SBOMs) with keys or keyless OIDC identities, storing signatures alongside the image in the registry.

```bash
cosign sign ghcr.io/acme/app@sha256:9f3a1c...
cosign verify ghcr.io/acme/app@sha256:9f3a1c... --certificate-identity ...
```

Why it matters: without verification, anyone who compromises a registry or does a MITM can serve a malicious image under a trusted name. Signing lets an **admission controller** (e.g. in Kubernetes) refuse to run unsigned or untrusted images — the "only run what we built and approved" policy. Note you sign the **digest**, tying trust to immutable content.

### Q9. What's a pull-through cache / registry mirror, and when do you use one?

A **pull-through cache** is a registry configured to proxy an upstream (usually Docker Hub): the first pull of an image fetches it from upstream and **caches the layers locally**; subsequent pulls are served from the cache without touching upstream.

Use it to:
- **Dodge rate limits** — repeated CI/cluster pulls hit the local cache, not Docker Hub.
- **Cut bandwidth and latency** — layers travel over the LAN after the first fetch.
- **Add resilience** — builds keep working if upstream is briefly down.

You run one (e.g. the registry's proxy mode, or Harbor's proxy cache projects) and point Docker's daemon at it via `registry-mirrors` in `daemon.json`, or reference it explicitly. It's transparent for reads. Distinct from a **private registry** (which stores *your* images) — a pull-through cache mirrors *someone else's* public images. Big clusters run both.

### Q10. How do you handle private-registry authentication in CI and Kubernetes?

**In CI**, authenticate before pulling/pushing:
- Static: `docker login` with a scoped token stored as a CI secret.
- Cloud-native / short-lived (preferred): a **credential helper** or OIDC exchange — e.g. `aws ecr get-login-password` for ECR, or GitHub Actions' OIDC token traded for cloud creds. No long-lived secrets on disk.

**In Kubernetes**, nodes need creds to pull private images:
- Create an **`imagePullSecret`** (a `docker-registry` secret) and reference it in the pod spec or attach it to a ServiceAccount:

```yaml
spec:
  imagePullSecrets:
    - name: ghcr-creds
```

- For cloud registries, prefer **workload identity / node IAM** (ECR credential helper, GKE Workload Identity) so pulls use short-lived, auto-rotated tokens instead of a stored secret.

The senior instinct: avoid long-lived static credentials; use OIDC/IAM-based short-lived auth wherever the platform supports it.

### Q11. How do you promote an image from dev to staging to prod correctly?

**Build once, promote the same digest — never rebuild per environment.**

The anti-pattern is running the build in each environment's pipeline, producing different bytes each time. Then "the artifact that passed staging" isn't the artifact in prod, and your testing guarantees evaporate.

The correct flow:
1. Build **one** image in CI, push it (e.g. `ghcr.io/acme/app@sha256:9f3a1c…`).
2. Run tests/scans against **that digest**.
3. "Promote" by adding a tag or copying the **same digest** forward — e.g. `crane copy … staging`, then `… prod`, or just point the environment's deployment at the tested digest.

```bash
crane copy ghcr.io/acme/app@sha256:9f3a1c... ghcr.io/acme/app:prod
```

The bytes never change from dev to prod — only where they're pointed. This is the whole reason digests exist. Environment-specific config comes from env vars/secrets/ConfigMaps at runtime, **not** from a rebuilt image.

### Q12. How do registries handle retention and garbage collection?

Because every push adds layer blobs and manifests, registries grow without bound unless you clean up. Two mechanisms:

- **Retention / cleanup policies** — rules that *untag* old images: "keep the last N tags per repo", "delete untagged manifests older than 30 days", "keep anything tagged `prod-*`". Most registries (GHCR, ECR lifecycle policies, Harbor tag-retention) support these declaratively.
- **Garbage collection** — the actual reclamation step that deletes **blobs no longer referenced** by any manifest/tag. Deleting a tag only removes the pointer; the underlying layers persist until GC runs. On self-hosted registries GC may require read-only/maintenance mode.

The subtlety: **untagging ≠ freeing disk**. You need both — a retention policy to decide what's garbage, and a GC pass to actually reclaim it. Shared base layers are only collected when *no* remaining image references them, thanks to content-addressing.

### Q13. What is a multi-arch image, and how is it represented in a registry?

A **multi-arch** (multi-platform) image is one reference that resolves to the right binary for the puller's CPU architecture — so `docker pull app:1.0` on an amd64 laptop and on an arm64 CI runner each get the correct build.

It's represented as a **manifest list** (OCI **image index**): a top-level manifest that maps platforms to per-arch child manifests:

```
app:1.0  (image index)
 ├── linux/amd64 → sha256:aaa...
 ├── linux/arm64 → sha256:bbb...
```

When a client pulls, the registry serves the index; the client picks the entry matching its `os/arch` and pulls that child manifest's layers. You build these with **`docker buildx build --platform linux/amd64,linux/arm64 --push`**, which builds each arch and assembles the index. Increasingly essential now that Apple Silicon dev machines are arm64 while much prod is amd64 (or the reverse on Graviton).

### Q14. What role does vulnerability scanning play at the registry level?

Registry-side scanning inspects **pushed images** for known CVEs in their OS packages and language dependencies, so you catch vulnerabilities on artifacts that are already stored and potentially deployed.

Why do it at the registry (not only at build):
- **Continuous rescanning** — new CVEs are disclosed daily against packages that were "clean" when built. The registry can re-scan existing images and flag ones that became vulnerable.
- **Policy gates** — block pulls/promotion of images above a severity threshold (Harbor, ECR enhanced scanning, GHCR/Trivy integrations).
- **Central inventory** — one place to see the risk posture of everything deployable.

It complements, not replaces, build-time scanning and SBOM generation. The senior framing: scanning at build catches "was it born vulnerable"; scanning at the registry catches "did it *become* vulnerable" — you need both, plus an admission policy to enforce results.

### Q15. How do you distribute images to an air-gapped environment?

An air-gapped environment has **no network path** to your registry, so you can't `pull`. Two approaches:

**`docker save` / `docker load`** — serialise an image (all layers + manifest) to a tar you physically carry across the gap:

```bash
# on the connected side
docker save ghcr.io/acme/app:1.2.3 -o app-1.2.3.tar
# transfer the tar via approved media, then on the air-gapped side:
docker load -i app-1.2.3.tar
```

**Mirror into an internal registry** — run a registry (Harbor, a plain registry) *inside* the air-gapped network and bulk-import images with `skopeo copy`/`crane` from an export bundle. This scales far better than hand-carrying tars for many images and preserves the pull-by-name workflow internally.

Key point: `save`/`load` preserves the image faithfully (including digests for a single-arch manifest), so you don't rebuild inside the gap. For anything beyond a handful of images, stand up an internal registry rather than juggling tarballs.

## Running Containers

### Summary

**What this topic covers**

The single most-used command in Docker — `docker run` — and everything around getting a container to start, stay alive, and be debugged. The 16 questions here cover: `run` in depth (the flags interviewers actually ask about); foreground vs `-d` detached; `-it` (interactive + TTY); `--rm`; naming; port publishing; env vars and `--env-file`; volume mounts; `--network`; **restart policies**; a preview of resource limits; the full **container lifecycle** (create → start → running → stop → exited → rm); reading **exit codes** (0, 137, 143, 139, 125/126/127); `docker ps`; `exec` vs `attach`; stopping (`stop` vs `kill`, SIGTERM vs SIGKILL); `logs`; overriding CMD/ENTRYPOINT/user/workdir; and the classic "why does my container exit immediately?"

**Mental model**

A container is **one main process (PID 1) plus its isolated environment** — namespaces, cgroups, and a writable layer over the image. `docker run` = *create a container from an image, then start it, running its entrypoint/command as PID 1*. The container lives **exactly as long as PID 1 lives**. When that process exits, the container exits — full stop. This one rule dissolves most confusion in this topic: containers aren't little VMs you log into; they're a process wrapper. "It exited immediately" almost always means PID 1 ran and finished (or crashed). "It won't stop gracefully" usually means PID 1 isn't receiving SIGTERM. `docker exec` doesn't restart or re-run the entrypoint; it **injects an additional process** into the already-running namespace. The **exit code** of PID 1 is surfaced as the container's exit code, and Linux signal conventions (`128 + signal`) let you read *how* it died. Keep "a container is a process" in your head and `run`, `stop`, `exec`, exit codes, and restart policies all become obvious.

**Key terms**

- **`docker run`** — create + start a container from an image in one step.
- **Detached (`-d`)** — run in the background, returning the container ID; foreground (default) streams output to your terminal.
- **`-it`** — `-i` keeps STDIN open, `-t` allocates a pseudo-TTY; together you get an interactive shell.
- **`--rm`** — auto-remove the container's filesystem when it exits (one-off/dev tasks).
- **PID 1** — the container's main process; the container lives and dies with it.
- **Restart policy** — daemon rule for restarting a container on exit (`no`, `on-failure[:max]`, `always`, `unless-stopped`).
- **Exit code** — PID 1's exit status, surfaced as the container's; `128+N` means killed by signal N.
- **`docker exec`** — run an *additional* command inside a running container (does not re-run the entrypoint).
- **`docker attach`** — connect your terminal to PID 1's existing STDIN/STDOUT.
- **SIGTERM → SIGKILL** — `stop` sends SIGTERM, waits (default 10s), then SIGKILL; `kill` sends SIGKILL immediately.
- **`docker ps` / `ps -a`** — list running / all (including exited) containers.
- **CMD override** — trailing args to `docker run` replace the image's default CMD.

**Why interviewers ask this**

This is the **daily-driver competence** check — can you actually operate containers, not just build them? Juniors know `docker run image` and `docker ps`. Seniors fluently reach for the right flags (`--rm` for throwaway, `-d` for services, `-it` for a shell), read an **exit code 137 as an OOM kill** without googling, know that `docker stop` gives the app 10 seconds to shut down cleanly before SIGKILL (and why that matters for connection draining), and can debug a crash-looping container with `logs` + `exec` + `inspect`. The "why does it exit immediately?" question is a favourite precisely because it tests whether you understand the *process model* rather than treating containers as magic. Strong answers here signal someone who has actually operated services in containers.

**Common confusions**

- "A container is a lightweight VM you log into" — no, it's a **process**. There's no login; `exec` injects a process into its namespaces.
- "`docker exec` runs the entrypoint" — it doesn't; it runs whatever command you give, alongside the existing PID 1.
- "`docker stop` kills the container instantly" — it sends **SIGTERM first**, waits (default 10s), *then* SIGKILL. `docker kill` is the instant one.
- "The container keeps running after the command finishes" — it can't; PID 1 exiting = container exiting.
- "`-d` and `--rm` do the same background thing" — unrelated: `-d` = detached, `--rm` = auto-cleanup on exit.
- "`restart: always` will restart a container I manually stopped" — no; a manual `docker stop` is respected until the daemon restarts. `unless-stopped` also honours manual stops across daemon restarts.

**What follows from this topic**

Running containers sits between **images/registries** (what you run) and **networking/volumes/compose** (how running containers connect and persist). Port flags preview the networking topic; `-v` previews volumes; restart policies preview orchestration (an orchestrator like Kubernetes *replaces* Docker restart policies with its own controllers). The process/PID-1 model here is the same one that makes ENTRYPOINT exec-form and signal handling matter in the image-building topic. Master "a container is a process" and everything downstream is easier.

### Q1. Explain `docker run` and the flags you reach for most.

`docker run` **creates and starts** a container from an image in one command (it's `docker create` + `docker start`). The image's ENTRYPOINT/CMD becomes PID 1.

The flags that come up constantly:

```bash
docker run -d --name web \
  -p 8080:80 \
  -e NODE_ENV=production \
  --env-file .env \
  -v app-data:/data \
  --restart unless-stopped \
  --memory 512m --cpus 1.5 \
  ghcr.io/acme/app:1.2.3
```

- `-d` detached (background) vs foreground (default).
- `-it` interactive + TTY, for a shell.
- `--rm` auto-remove on exit.
- `--name` a stable name instead of a random one.
- `-p host:container` publish a port.
- `-e` / `--env-file` environment.
- `-v` / `--mount` volumes/bind mounts.
- `--network` attach to a network.
- `--restart` restart policy.
- `--memory` / `--cpus` resource limits.

Anything after the image name **overrides CMD**.

### Q2. Foreground vs detached (`-d`) — when do you use each?

**Foreground** (the default) attaches your terminal to the container's STDOUT/STDERR and blocks until it exits. **Detached** (`-d`) starts it in the background and immediately returns the container ID, leaving it running.

- Use **foreground** for one-off commands, quick tests, and anything where you want to watch output live (`docker run --rm alpine echo hi`).
- Use **`-d`** for long-running **services** you want to keep running independently of your shell (a web server, a database).

With `-d` you retrieve output later via `docker logs`. A common gotcha: running a service in the foreground and then closing the terminal — the container may stop. For services, `-d` (or an orchestrator) is correct. Note `-d` and `-it` are usually mutually exclusive in intent: you either background it or interact with it.

### Q3. What do `-i` and `-t` do, and when do you need each?

- **`-i` (`--interactive`)** keeps **STDIN open** so you can send input to the container.
- **`-t` (`--tty`)** allocates a **pseudo-TTY**, giving you terminal features: a prompt, line editing, colours, job control.

Combined as **`-it`** you get an interactive shell:

```bash
docker run -it ubuntu bash      # a real interactive shell
```

When you need which:
- **Both (`-it`)** — interactive shell / REPL you type into.
- **`-i` only** — piping data in without a terminal: `docker run -i alpine sh < script.sh` (a TTY would interfere with piped input).
- **`-t` only** — rarely alone; you want TTY formatting but no interactive input.
- **Neither** — non-interactive commands and services (`-d`).

Symptom of getting it wrong: run `bash` without `-it` and it exits immediately — no STDIN attached, so the shell reaches EOF and quits.

### Q4. What does `--rm` do and when should you use it?

`--rm` tells Docker to **automatically remove the container** (its writable layer and metadata) as soon as it **exits**. Without it, stopped containers pile up and must be cleaned with `docker rm`.

```bash
docker run --rm -it alpine sh    # vanishes when you exit the shell
```

Use it for:
- **One-off / throwaway** commands — a quick tool run, a `psql` client, a script.
- **Local development / experimentation** where you don't want cruft accumulating.
- **CI jobs** that run a container to do one task then discard it.

Do **not** use it for services whose stopped state you might want to inspect, or where you rely on the container filesystem post-exit for debugging. Note `--rm` only removes the container — **named volumes persist** (anonymous volumes attached to it are removed). It's about container-instance cleanup, not data.

### Q5. `--name` vs auto-generated names — does it matter?

If you don't pass `--name`, Docker assigns a random human-readable name like `sleepy_hopper`. With `--name web` you get a stable, predictable name.

It matters for:
- **Referencing the container** in commands: `docker logs web`, `docker exec -it web sh`, `docker stop web` — no need to copy IDs.
- **DNS on a user-defined network** — other containers resolve it **by name**, so a stable name is effectively its hostname for service-to-service calls.
- **Scripts and compose** — deterministic names are automatable.

The catch: names are **unique per host** — you can't start a second container named `web` until the first is removed (you'll get a name conflict). So for scaling/replicas, auto-generated names (or compose's numbered naming) are the norm, and stable `--name` is for singletons you interact with directly.

### Q6. How does port publishing work with `-p` and `-P`?

By default a container's ports are reachable only within its Docker network — **not from the host**. Publishing maps a host port to a container port so outside traffic can reach it.

```bash
docker run -p 8080:80 nginx        # host 8080 → container 80
docker run -p 127.0.0.1:8080:80 nginx  # bind to loopback only
docker run -p 80 nginx             # random host port → container 80
docker run -P nginx                # publish all EXPOSEd ports to random host ports
```

- `-p hostPort:containerPort` is the explicit form. Docker sets up a **DNAT rule via iptables** so traffic to the host port forwards into the container.
- Omitting the host IP binds to **`0.0.0.0`** (all interfaces) — publicly reachable. Bind to `127.0.0.1:` to keep it host-local.
- `-P` (capital) auto-publishes every port the image `EXPOSE`s to random high host ports (see them with `docker ps`).

Crucial: **`EXPOSE` alone publishes nothing** — you still need `-p`/`-P`.

### Q7. How do you pass environment variables into a container?

Three ways, most specific wins:

```bash
docker run -e NODE_ENV=production -e PORT=3000 app   # inline
docker run -e HOME app                               # pass through host's HOME
docker run --env-file .env app                       # from a file
```

- **`-e KEY=value`** sets one variable inline.
- **`-e KEY`** (no value) passes through the value from the host environment.
- **`--env-file path`** loads many at once from a `KEY=value` file (one per line, no quotes-processing surprises).

Guidance: use env vars for **config that varies by environment** (URLs, feature flags, ports) — this is the twelve-factor pattern that lets one image run everywhere. Do **not** put secrets on the command line (`-e PASSWORD=...` is visible in `docker inspect` and process listings); prefer Docker/orchestrator **secrets** or a mounted secret file. `--env-file` keeps secrets off the shell history but the file itself must be protected.

### Q8. What's the difference between `-v` and `--mount`, and what do they do?

Both attach storage into a container; `--mount` is the newer, explicit syntax.

```bash
docker run -v app-data:/data app                 # named volume (short syntax)
docker run -v $(pwd):/src app                     # bind mount (host path)
docker run --mount type=volume,src=app-data,dst=/data app
docker run --mount type=bind,src=$(pwd),dst=/src,readonly app
```

- **`-v`** is terse but overloaded — the same flag means a **named volume**, a **bind mount**, or an **anonymous volume** depending on the source, and it will silently *create* a host path if it doesn't exist.
- **`--mount`** is verbose `key=value` and explicit about `type=` (`volume`/`bind`/`tmpfs`), fails loudly on mistakes, and is the recommended form for scripts and clarity.

Rule of thumb: **volumes** (Docker-managed) for persistent app data, **bind mounts** for dev (mount your source into the container), **tmpfs** for in-memory scratch. Prefer `--mount` in anything you commit; `-v` is fine for quick interactive use.

### Q9. What are Docker's restart policies and how do they behave?

`--restart` tells the **daemon** whether to restart a container when it stops:

| Policy | Behaviour |
|---|---|
| `no` (default) | Never restart automatically. |
| `on-failure[:N]` | Restart only on non-zero exit; optional max `N` attempts. |
| `always` | Always restart, regardless of exit code; also on daemon start. |
| `unless-stopped` | Like `always`, but does **not** restart if you manually stopped it. |

Key subtleties:
- `always` and `unless-stopped` cause the container to come back when the **Docker daemon restarts** (e.g. host reboot) — good for services.
- A **manual `docker stop`** is respected: `unless-stopped` won't bring it back, and `always` won't restart it *until the daemon itself restarts*.
- `on-failure` is right for **batch jobs** that should retry on crash but not loop forever (cap with `:5`).

In an **orchestrator** (Kubernetes, Swarm), you generally *don't* use Docker restart policies — the orchestrator's controller handles restarts and rescheduling instead, and mixing them causes confusion.

### Q10. How do you read a container's exit code? Walk through 137, 143, 139.

The container's exit code is **PID 1's exit status**, shown in `docker ps -a` and `docker inspect`. The convention: a normal exit is `0`; **anything killed by a signal is `128 + signal number`**.

| Code | Meaning |
|---|---|
| `0` | Success / clean exit. |
| `137` | `128 + 9` → **SIGKILL**. Usually an **OOM kill** (hit the memory limit) or `docker kill`. |
| `143` | `128 + 15` → **SIGTERM**. Graceful stop (e.g. `docker stop`). |
| `139` | `128 + 11` → **SIGSEGV**, a segfault (bad native code). |
| `125` | The **Docker daemon itself** failed (bad flag/run error) — the container never started. |
| `126` | Command found but **not executable** (permission/format). |
| `127` | Command **not found** (bad path/entrypoint, or missing shell). |

So `137` on a container that "just disappears under load" is the classic **OOMKilled** signature — check `docker inspect` for `OOMKilled: true` and raise `--memory` or fix the leak. `143` after `docker stop` is normal. `125/126/127` point at your command/entrypoint, not your app logic.

### Q11. What's the difference between `docker ps` and `docker ps -a`?

`docker ps` lists **only running** containers. `docker ps -a` lists **all** containers including **stopped/exited** ones.

```bash
docker ps       # currently running
docker ps -a    # running + exited (with their exit codes)
```

This matters constantly in debugging: a container that crashed on startup **won't appear in `docker ps`** — it's already exited — so it looks like "nothing happened." `docker ps -a` reveals it along with its **exit code** and status (`Exited (137) 2 minutes ago`), which tells you *how* it died. From there `docker logs <id>` shows why. Useful columns: STATUS (up/exited + code), PORTS (what's published), NAMES. Add `-q` for just IDs (scripting) and `--filter` to narrow (e.g. `--filter status=exited`).

### Q12. What does `docker exec` do, and why doesn't it run the entrypoint?

`docker exec` runs an **additional command inside an already-running container**, joining its namespaces (filesystem, network, PIDs). It's the primary way to **debug or inspect** a live container:

```bash
docker exec -it web sh          # interactive shell inside 'web'
docker exec web cat /etc/hosts  # one-off command
```

It **doesn't run the entrypoint** because the entrypoint already ran when the container started — it *is* PID 1 and still running. `exec` spawns a **new, separate process** (a child in the same namespaces), it doesn't restart or replace PID 1. That's exactly why it's safe for debugging: you can pop a shell alongside the running app without disturbing it.

Corollary: you **can't `exec` into a stopped container** — there's no running process/namespace to join. For that you'd inspect the filesystem another way or start a new container. Also: if the image has no shell (distroless/scratch), `exec … sh` fails — nothing to run.

### Q13. `docker attach` vs `docker exec` — what's the difference?

Both connect you to a running container, but very differently:

- **`docker attach`** connects your terminal to the **existing PID 1's** STDIN/STDOUT/STDERR. You're looking at the *main process's* streams — there's no new process. Typing may send input to PID 1, and **Ctrl-C can signal and kill it** (you're attached to the real thing).
- **`docker exec`** starts a **brand-new process** inside the container (e.g. a shell). Exiting it leaves PID 1 untouched.

```bash
docker attach web     # watch/interact with the main process (risky: can kill it)
docker exec -it web sh  # separate shell, safe to exit
```

For debugging, **almost always use `exec`** — it's non-destructive. `attach` is for the rarer case where you genuinely need to interact with the main process's own console. To leave `attach` without killing PID 1, use the detach sequence `Ctrl-P Ctrl-Q` (only if the container was started with a TTY).

### Q14. How do you stop a container — `stop` vs `kill`, SIGTERM vs SIGKILL?

- **`docker stop`** is the **graceful** shutdown: it sends **SIGTERM** to PID 1, waits a **grace period** (default 10s, tune with `-t`), and only if the process hasn't exited does it send **SIGKILL**.
- **`docker kill`** sends **SIGKILL immediately** (or a signal of your choice with `--signal`) — no grace period.

```bash
docker stop -t 30 web   # SIGTERM, wait up to 30s, then SIGKILL
docker kill web         # SIGKILL now
```

Why it matters: SIGTERM lets the app **drain connections, flush buffers, and release resources** cleanly. This only works if PID 1 actually **receives** the signal — which requires the **exec form** of ENTRYPOINT/CMD (shell form runs under `/bin/sh -c`, which often doesn't forward SIGTERM, so your app never gets it and always ends up SIGKILLed at 10s). Prefer `stop` in production; reserve `kill` for a wedged container. A container ending via `stop` typically exits **143** (128+15).

### Q15. How do you view a container's logs?

```bash
docker logs web            # all logs so far
docker logs -f web         # follow (stream) live
docker logs --tail 100 web # last 100 lines
docker logs --since 10m web  # last 10 minutes, --timestamps for times
```

`docker logs` shows whatever the container wrote to **STDOUT and STDERR** — which is exactly why the twelve-factor convention is to **log to stdout/stderr**, not to files inside the container. Docker's default `json-file` logging driver captures those streams; other drivers (`journald`, `fluentd`, `awslogs`) ship them elsewhere.

Caveats:
- If the app logs to a **file inside the container** instead of stdout, `docker logs` shows nothing — a common "why are my logs empty?" gotcha.
- Without log rotation, `json-file` logs can fill the disk; set `max-size`/`max-file`.
- For a crashed container, `docker logs <id>` still works on the exited container (until it's removed) — the first stop when debugging a crash loop.

### Q16. Why does my container "exit immediately"?

Because **the container lives only as long as its PID 1**, and PID 1 finished. Docker didn't kill it — the main process simply **ran to completion or crashed**. Common causes:

- **The command is short-lived.** `docker run ubuntu` exits at once because the default command finishes instantly. There's no long-running process to keep it alive — a base OS image isn't a service.
- **A shell with no input.** `docker run ubuntu bash` without `-it` hits EOF on STDIN and exits. Add `-it`.
- **The app crashed on startup** — check `docker ps -a` for the exit code and `docker logs` for the stack trace (config error, missing env var, port bind failure).
- **The main process forks/daemonises into the background**, leaving PID 1 to exit (e.g. running a server with a `-d`/background flag *inside* the container). The container should run the process in the **foreground**.
- **Wrong entrypoint** — exit `127` (command not found) or `126` (not executable).

Diagnosis flow: `docker ps -a` → read the **exit code** → `docker logs` → decide whether it's "nothing to keep it alive" (design) or "it crashed" (bug).

## Networking Fundamentals

### Summary

**What this topic covers**

How containers get network connectivity and talk to each other, the host, and the outside world. The 17 questions here cover: the Docker networking model; the built-in **drivers** — `bridge` (default), `host`, `none`; the critical difference between the **default bridge** (no automatic DNS) and a **user-defined bridge** (name-based service discovery); **port publishing** (`-p`, DNAT via iptables, `0.0.0.0` vs `127.0.0.1`); **`EXPOSE` vs publish** (metadata vs actually opening a port); container-to-container communication; multi-network containers; inspecting networks; the **embedded DNS** server; why `localhost` inside a container is the container itself (and `host.docker.internal`); the classic "my two containers can't talk to each other"; published-port security; and inter-container communication (ICC).

**Mental model**

Each container gets its **own network namespace** — its own interfaces, IP, routing table, and loopback. So **`localhost` inside a container means *that container*, never the host**. By default, containers attach to the **`bridge`** network: Docker creates a virtual Linux bridge (`docker0`), gives each container a private IP on it, and NATs their outbound traffic to the host's IP. To reach a container **from outside**, you must **publish** a port (`-p`), which installs an iptables **DNAT** rule forwarding a host port to the container's IP:port. The single most important nuance: the **default** bridge gives containers IPs but **no DNS** — they can only reach each other by raw IP. A **user-defined** bridge adds Docker's **embedded DNS** (at `127.0.0.11`) so containers resolve **each other by name/alias**. That's why the modern answer to "how do my services find each other" is *put them on a user-defined network (or a compose network) and call them by name* — never hardcode container IPs.

**Key terms**

- **Network namespace** — the per-container isolated network stack (own interfaces, IP, loopback).
- **`bridge` driver** — default; a private virtual network via the `docker0` bridge, containers NAT out to the host.
- **`host` driver** — container shares the host's network namespace directly; no isolation, no port mapping.
- **`none` driver** — no networking at all (only loopback).
- **Default bridge** — the built-in `bridge` network; containers get IPs but **no DNS** name resolution.
- **User-defined bridge** — a bridge you create; adds **automatic DNS** so containers resolve each other by name.
- **Embedded DNS** — Docker's resolver at `127.0.0.11` inside containers on user-defined networks.
- **Port publishing (`-p`)** — maps `hostPort:containerPort` via an iptables **DNAT** rule.
- **`EXPOSE`** — image metadata documenting a port; opens nothing by itself.
- **DNAT** — destination NAT; how published ports forward host traffic into a container.
- **`host.docker.internal`** — special DNS name letting a container reach the host machine.
- **ICC (inter-container communication)** — whether containers on the default bridge may talk to each other.

**Why interviewers ask this**

Networking is where multi-container apps break, so it's a **debugging-under-pressure** signal. The archetypal question — "my app container can't reach my database container, why?" — instantly separates people who've operated Docker from those who haven't. The senior answer names the cause (they're on the **default bridge**, which has no DNS, so a hostname lookup fails) and the fix (a **user-defined network** or compose, then connect by service name). Interviewers also probe the **`EXPOSE` vs `-p`** confusion (a huge fraction of candidates think `EXPOSE` opens a port), the **`localhost` inside a container** trap (why your app can't reach a service on the host via `localhost`), and **security** (publishing to `0.0.0.0` accidentally exposing a database to the internet). Getting these right shows you can reason about namespaces, DNS, and iptables — not just copy compose files.

**Common confusions**

- "`EXPOSE` opens/publishes the port" — no, it's **documentation only**. You still need `-p` to publish.
- "Containers can find each other by name on the default bridge" — they **can't**; the default bridge has no DNS. You need a **user-defined** network (or the deprecated `--link`).
- "`localhost` inside a container is the host" — it's the **container itself**. Reach the host via `host.docker.internal` (or the gateway IP).
- "`host` networking still needs `-p`" — no; with `host` the container uses the host's ports directly, `-p` is ignored (and ports can collide).
- "Publishing a port is internal-only" — `-p 5432:5432` binds to **`0.0.0.0`** by default, exposing it on **all host interfaces** (potentially the internet). Bind to `127.0.0.1:` to keep it local.
- "Two containers on different networks can talk if they're on the same host" — they can't, unless one is **connected to both** networks.

**What follows from this topic**

Networking underpins **Compose** (which auto-creates a user-defined network so services resolve by name — the reason compose "just works"), connects to **running containers** (the `-p` flags from that topic), and to **security** (published-port exposure, binding to loopback). The user-defined-bridge/DNS insight is the single most load-bearing fact for multi-service local development. Once you internalise "each container is its own network namespace, default bridge has no DNS, publish is DNAT," most Docker networking bugs become one-line diagnoses.

### Q1. Give me an overview of the Docker networking model.

Docker networking is built on **Linux network namespaces**: each container gets its **own isolated network stack** — its own interfaces, IP address, routing table, and loopback — so containers are network-isolated from each other and the host by default.

Containers attach to **networks**, which are created by **drivers**. The built-in single-host drivers are:
- **`bridge`** — the default; a private virtual network, containers get IPs and NAT out to the host.
- **`host`** — the container shares the host's network namespace (no isolation).
- **`none`** — no networking except loopback.

(There are also multi-host drivers like **`overlay`** for Swarm, and **`macvlan`** to give containers real LAN IPs.)

Two mechanisms tie it together: **publishing** (`-p`) exposes container ports to the outside via iptables DNAT, and **embedded DNS** (on user-defined networks) lets containers resolve each other by name. Everything else in this topic is a detail of these pieces.

### Q2. Explain the three built-in network drivers: bridge, host, none.

**`bridge`** (default) — Docker creates a virtual Linux bridge (`docker0`) acting as a private internal network. Each container gets a **private IP** on that bridge and reaches the outside world via **NAT** through the host. To reach a container from outside you must **publish** ports. This is the normal single-host mode.

**`host`** — the container **shares the host's network namespace** directly. No separate IP, no NAT, and **no port mapping** — if the app listens on `:8080`, it's on the host's `:8080` immediately. Pros: **best performance** (no NAT/bridge overhead), useful for network-heavy or port-scanning workloads. Cons: **no isolation**, and **port conflicts** with the host and other host-mode containers. (Linux-only in the classic sense.)

**`none`** — the container gets **no networking** beyond its own loopback. Fully isolated; used for batch/compute jobs that must not touch the network, or when you'll wire networking manually.

### Q3. What's the difference between the default bridge and a user-defined bridge?

This is the single most important networking distinction in Docker.

| | Default bridge (`bridge`) | User-defined bridge |
|---|---|---|
| DNS / name resolution | **None** — containers reach each other only by **IP** | **Yes** — containers resolve each other **by name/alias** |
| Isolation | All containers share one flat network | Scoped; only attached containers see each other |
| Legacy linking | Needs the deprecated `--link` for names | Not needed — DNS is automatic |
| Recommended? | No (legacy default) | **Yes** — the modern way |

On the **default** bridge, container IPs are dynamic and there's **no embedded DNS**, so you'd have to hardcode IPs (fragile) or use `--link` (deprecated). On a **user-defined** bridge (`docker network create mynet`), Docker runs an **embedded DNS server** so containers resolve each other by **container name** automatically:

```bash
docker network create mynet
docker run -d --name db --network mynet postgres
docker run --network mynet app  # can reach the db at hostname 'db'
```

The rule: **always use a user-defined network** for multi-container apps. Compose does this for you.

### Q4. How does port publishing (`-p`) actually work under the hood?

`-p hostPort:containerPort` tells Docker to **forward traffic from a host port into the container**. Mechanically, Docker installs an iptables **DNAT (destination NAT)** rule: packets arriving at the host port have their destination rewritten to the container's private IP and port, and the reply path is un-NATed back.

```bash
docker run -p 8080:80 nginx
# host :8080 → (DNAT) → container 172.17.0.2:80
```

Details that matter:
- **Bind address** — `-p 8080:80` binds `0.0.0.0` (all host interfaces). `-p 127.0.0.1:8080:80` binds loopback only (host-local).
- **Random host port** — `-p 80` (container port only) picks a random free host port; see it with `docker ps`.
- **Protocol** — append `/udp` for UDP (`-p 53:53/udp`).

Because it's iptables DNAT on the host, publishing is a **host-level** action — it's how the container's private network gets a door to the outside. Without publishing, the container's ports are reachable only from within its Docker network.

### Q5. `EXPOSE` in a Dockerfile vs publishing with `-p` — what's the difference?

They're completely different, and conflating them is one of the most common Docker misconceptions.

- **`EXPOSE 80`** is **metadata / documentation only**. It records "this image's app listens on port 80" so humans and tooling know. **It does not open, forward, or publish anything.** A container with `EXPOSE 80` is *not* reachable from the host.
- **`-p 8080:80`** (publish) is what **actually opens a path** from the host into the container (via iptables DNAT).

```dockerfile
EXPOSE 80          # just says "I listen on 80" — opens nothing
```
```bash
docker run -p 8080:80 img   # THIS is what makes it reachable
```

The only functional link: **`docker run -P`** (capital P) reads the image's `EXPOSE`d ports and auto-publishes them to **random** host ports. Otherwise `EXPOSE` is purely informational. Interviewers love this because so many candidates believe `EXPOSE` makes a container accessible — it doesn't.

### Q6. How do two containers communicate with each other?

It depends entirely on their networks:

- **Same user-defined network** → they resolve and reach each other **by container name** via embedded DNS. This is the normal, correct pattern:

```bash
docker network create appnet
docker run -d --name db --network appnet postgres
docker run --network appnet app   # connects to 'db:5432'
```

- **Same default bridge** → they can reach each other **by IP only** (no DNS). Fragile — avoid.
- **Different networks** → they **cannot** talk at all, even on the same host, unless one container is **connected to both** networks (`docker network connect`).

So the answer interviewers want: put the containers on a **shared user-defined network** and call each other **by name**. Never hardcode container IPs (they change on restart). Note you address the **container port** directly (`db:5432`) — you do **not** need `-p` for container-to-container traffic; publishing is only for reaching in from *outside* Docker.

### Q7. Can a container be on multiple networks at once?

Yes. A container can be attached to **several networks simultaneously**, getting one interface/IP per network. This is common for **segmentation** — e.g. a reverse proxy on both a public-facing `frontend` network and a private `backend` network, bridging the two while keeping the backend isolated from the internet.

```bash
docker network create frontend
docker network create backend
docker run -d --name proxy --network frontend nginx
docker network connect backend proxy   # now on both
```

You can attach at run time (`--network`, repeated in some workflows or set post-start) and add more with **`docker network connect <net> <container>`** (and remove with `docker network disconnect`). On each network the container follows that network's rules (DNS on user-defined ones). This is how you build tiered topologies: services on `backend` can't be reached from `frontend` unless something is deliberately connected to both.

### Q8. How do you inspect Docker networks?

```bash
docker network ls                 # list all networks + drivers + scope
docker network inspect appnet     # full detail: subnet, gateway, connected containers + their IPs
docker network create appnet      # create a user-defined bridge
docker network connect appnet web # attach a running container
docker network rm appnet          # remove
```

`docker network ls` shows the networks and their **driver** (bridge/host/none/overlay) — you'll always see the three defaults (`bridge`, `host`, `none`) plus any you or compose created.

`docker network inspect` is the debugging workhorse: it shows the **subnet and gateway**, and crucially the **`Containers` map** listing every attached container with its **IP and MAC** on that network. When "container A can't reach container B," `inspect` immediately tells you whether they're even on the **same network** — the most common root cause. You can also inspect from the container side with `docker exec app cat /etc/resolv.conf` (to see the `127.0.0.11` embedded DNS) or `getent hosts db`.

### Q9. What is Docker's embedded DNS server?

On **user-defined networks**, Docker runs an **embedded DNS server** reachable inside each container at **`127.0.0.11`**. It resolves **container names, network aliases, and service names** to the right container IP on that network — which is what makes name-based service discovery work.

Inside such a container, `/etc/resolv.conf` points at `127.0.0.11`; Docker intercepts those queries. Names it knows (other containers on shared networks, aliases) resolve to container IPs; everything else is **forwarded to the host's upstream DNS** so external name resolution still works.

Two key consequences:
- It exists **only on user-defined networks** — the **default bridge has no embedded DNS**, which is exactly why containers there can't resolve each other by name.
- You can add extra names with **`--network-alias`**, and compose gives each service its service name as a resolvable alias automatically. Round-robin DNS across replicas sharing an alias gives simple client-side load distribution.

### Q10. Inside a container, what does `localhost` refer to?

**The container itself** — never the host. Because each container has its own network namespace with its own loopback, `localhost`/`127.0.0.1` inside a container is that container's own loopback, isolated from the host's and from other containers'.

This trips people up constantly:
- An app in a container trying to reach a database on the **host** via `localhost:5432` **fails** — there's nothing on the container's own loopback. Use **`host.docker.internal`** (resolves to the host from inside a container, on Docker Desktop and via `--add-host=host.docker.internal:host-gateway` on Linux) or the host's LAN IP / the bridge gateway.
- Two containers can't reach each other via `localhost` — each has its own. Use the **container name** on a shared user-defined network.

```bash
# app in a container reaching a service running on the host:
docker run --add-host=host.docker.internal:host-gateway app
# then connect to host.docker.internal:5432
```

Rule: inside a container, `localhost` = this container; the host = `host.docker.internal`; another container = its name on a shared network.

### Q11. My two containers can't talk to each other. Walk me through debugging it.

The overwhelmingly common cause: they're on the **default bridge**, which has **no DNS**, so name lookups (`db`) fail — or they're on **different networks** entirely.

Diagnosis and fix:
1. **Are they on the same network?** `docker network inspect <net>` — check both appear in `Containers`. If not, that's it.
2. **Are they on the default bridge?** If they were started without `--network`, they're on the default bridge → **no name resolution**. `getent hosts db` inside the container returns nothing.
3. **Fix:** create a **user-defined network**, attach both, and connect by name:

```bash
docker network create appnet
docker run -d --name db --network appnet postgres
docker run --network appnet app     # 'db' now resolves
```

Or just use **Compose**, which puts all services on one user-defined network automatically.

Other checks: is the target app actually **listening on 0.0.0.0** (not `127.0.0.1`) inside its container? Is the **port** right (use the container port, not a published host port)? Is a firewall/`--icc=false` policy blocking it? But 90% of the time it's "default bridge, no DNS → use a user-defined network."

### Q12. What are the security implications of publishing a port?

Publishing binds a container port to a **host interface**, and the default host is **`0.0.0.0`** — **all interfaces**, including public ones. So `-p 5432:5432` on a cloud VM can **expose your database to the entire internet** if the host has a public IP and no firewall in front. This is a frequent real-world breach vector.

Mitigations:
- **Bind to loopback** when the service only needs to be reached locally: `-p 127.0.0.1:5432:5432` — now only the host itself can connect.
- **Publish only what must be public** — front-end/proxy ports, not databases and admin interfaces.
- **Don't rely on `EXPOSE`** for isolation (it opens nothing) and don't rely on a lack of `-p` if you're using **`host`** networking (which bypasses publishing entirely).
- **Layer host firewalls / security groups** — but note Docker's iptables DNAT rules can **bypass some host firewall rules** (a known gotcha), so use the bind-address control plus cloud security groups.

The senior instinct: publish the minimum, bind sensitive ports to `127.0.0.1`, and never assume "internal" until you've checked the bind address.

### Q13. What is ICC (inter-container communication) and can you disable it?

**ICC** governs whether containers on the **default bridge** are allowed to talk to **each other**. By default `--icc=true` (a daemon setting), so all containers on the default bridge can freely reach one another's ports.

Setting **`--icc=false`** on the daemon makes the default bridge **deny** container-to-container traffic unless explicitly allowed — a hardening measure so a compromised container can't freely pivot to its neighbours.

In practice, the **modern approach is user-defined networks** rather than fiddling with the global `icc` flag: user-defined bridges give you **network segmentation** as the isolation primitive — only containers you place on the same network can reach each other, and you control the topology per-app. So instead of one flat default bridge with `icc` on/off, you create separate networks (`frontend`, `backend`) and attach containers deliberately. That's cleaner, more granular, and the pattern compose encourages. `--icc=false` is legacy hardening for the default bridge specifically.

### Q14. How does a container reach the internet by default?

Via **NAT through the host**. On the default (or any user-defined) **bridge** network, the container has a **private IP** (e.g. `172.17.0.x`) that isn't routable outside the host. When it sends outbound traffic, the packets go to the bridge's **gateway**, and the host applies **SNAT (masquerade)** via iptables, rewriting the source to the **host's IP**. Replies come back to the host and are un-NATed to the container.

So **outbound** connectivity works out of the box — a container can `curl` the internet with no flags — precisely because of this NAT masquerade, the same mechanism (in reverse) as published-port DNAT. The container's DNS queries go to Docker's embedded resolver (`127.0.0.11`), which forwards external names to the host's upstream DNS.

Contrast: **inbound** does *not* work by default (the private IP is unreachable from outside) — that's why you need **`-p`** to publish. And with the **`none`** driver there's no gateway at all, so no internet.

### Q15. How do you connect a container to a service running on the host machine?

Because `localhost` inside the container is the container itself, you need an address that points at the **host**:

- **`host.docker.internal`** — a special DNS name that resolves to the host. Works out of the box on **Docker Desktop** (Mac/Windows); on **Linux** add it explicitly:

```bash
docker run --add-host=host.docker.internal:host-gateway app
# inside the container: connect to host.docker.internal:5432
```

- **The bridge gateway IP** — the host is the gateway of the bridge network (often `172.17.0.1`); you can connect to that, though it's less portable than the DNS name.
- **`--network host`** — with host networking the container shares the host's stack, so `localhost` *does* reach host services (at the cost of isolation).

The common scenario: an app in a container needs a database running natively on your laptop. Point it at **`host.docker.internal`**, not `localhost`. And make sure the host service is **listening on an interface the container can reach** (not bound solely to `127.0.0.1` if you're using the gateway IP route).

### Q16. When would you choose host networking over bridge?

Reach for **`--network host`** when:
- **Performance is critical** — no bridge/NAT overhead means lower latency and higher throughput for network-heavy workloads.
- **You need the host's exact network** — apps that must see the host's real IPs/interfaces, do their own port binding across a wide range, or use protocols that don't survive NAT (some discovery/multicast, VPNs).
- **Dynamic/large port ranges** where enumerating `-p` mappings is impractical.

The trade-offs you accept:
- **No network isolation** — the container is on the host's stack directly.
- **No port mapping** — the app binds host ports directly, so **port conflicts** with the host and other host-mode containers are possible, and `-p` is ignored.
- **Reduced portability/security** — you lose the tidy per-container namespace boundary.

Default to **bridge** (isolation + explicit publishing) and use **host** only when you've measured a real need or hit a NAT-incompatible protocol. Note it's a Linux-native feature; behaviour differs under Docker Desktop's VM.

### Q17. A colleague put `EXPOSE 3000` in the Dockerfile but the app isn't reachable from their browser. What's wrong?

`EXPOSE` **doesn't publish anything** — it's documentation only. It records that the app listens on 3000, but it does **not** open a path from the host (or the browser) into the container. Nothing is actually mapped, so `http://localhost:3000` on the host hits nothing.

The fix is to **publish** the port at run time:

```bash
docker run -p 3000:3000 my-app        # now host :3000 → container :3000
```

Or, to lean on the `EXPOSE` metadata, `docker run -P my-app` (auto-publishes exposed ports to *random* host ports — check `docker ps` for the mapping).

Two follow-up checks if it's still unreachable after publishing:
- Is the app **listening on `0.0.0.0`** inside the container, not `127.0.0.1`? A server bound to container-loopback can't be reached even through a published port.
- Right **host port** in the browser URL (if you used `-P`, it's a random one).

The one-line takeaway: **`EXPOSE` documents, `-p` publishes** — you always need `-p` (or `-P`) to reach a container from outside.
## Networking Deep Dive

### Summary

**What this topic covers**

How Docker actually connects containers — to each other, to the host, and to the outside world. Most engineers use `-p 8080:80` and a Compose network without ever knowing what happens beneath. This topic goes underneath: the `docker0` bridge and the `veth` pairs that wire each container's network namespace into it, the iptables rules (MASQUERADE for egress, DNAT for published ports) that make it all route, the embedded DNS server at 127.0.0.11 that gives you service discovery, and the full set of network drivers (bridge, host, none, overlay, macvlan, ipvlan) with when to reach for each. It also covers cross-host networking (overlay + VXLAN), giving a container a real LAN presence (macvlan), reaching the host, isolation between user-defined networks, the `DOCKER-USER` firewall chain, rootless networking, IPv6, and how to actually debug connectivity when it breaks. The 15 questions run from "how does the default bridge work" to "why can't these two containers on different networks talk to each other."

**Mental model**

A container is just a process in its own **network namespace** — its own interfaces, routing table, and iptables rules, isolated from the host. Docker connects that namespace to the rest of the world with a **virtual ethernet (veth) pair**: think of it as a virtual cable with two ends. One end lands inside the container (as `eth0`), the other end attaches to a Linux **bridge** on the host (`docker0` for the default bridge, `br-<id>` for user-defined ones). The bridge is a virtual L2 switch: containers plugged into the same bridge can talk directly; containers on different bridges cannot, because there's no L2 path and Docker's iptables rules drop the cross-bridge traffic. For a container to reach the internet, its private IP (say 172.17.0.2) has to be translated to the host's IP — that's the **MASQUERADE** (source NAT) rule on the `POSTROUTING` chain. For the outside world to reach a container, a published port needs **DNAT** on `PREROUTING` rewriting `host:8080` to `container:80`. Once you hold "namespace + veth + bridge + iptables NAT" in your head, every Docker networking behaviour — DNS, isolation, published ports, host mode — is a variation on that theme.

**Key terms**

- **Network namespace** — the kernel isolation primitive giving each container its own interfaces, routes, and firewall rules.
- **veth pair** — a virtual cable; one end in the container's netns as `eth0`, the other on the host attached to a bridge.
- **`docker0`** — the default bridge (a virtual L2 switch) created by the Docker daemon; containers on it get IPs from 172.17.0.0/16 by default.
- **Bridge network** — the default driver: private, single-host, NAT to the outside via the host.
- **User-defined bridge** — a bridge you create; unlike `docker0` it provides **embedded DNS** so containers resolve each other by name.
- **Overlay network** — multi-host container networking (Swarm / across daemons) using VXLAN tunnels over the physical network.
- **macvlan / ipvlan** — give a container its own MAC/IP directly on the physical LAN, appearing as a real device.
- **Embedded DNS (127.0.0.11)** — the per-network resolver providing service discovery and network aliases.
- **MASQUERADE** — iptables source-NAT rule that rewrites a container's private IP to the host's for egress.
- **DNAT** — destination-NAT rule that maps a published `host:port` to a `container:port`.
- **`DOCKER-USER`** — the iptables chain Docker leaves untouched for your custom firewall rules.
- **Publish (`-p`) vs expose (`EXPOSE`)** — publish creates a host-reachable port mapping; expose is metadata only.

**Why interviewers ask this**

Networking is where the "I've used Docker" candidates separate from the "I've operated Docker" candidates. A junior says "you map a port with `-p` and containers can talk." A senior can draw the packet path — veth into the bridge, DNAT rewriting the destination, the reply masqueraded back — and can debug a container that can't resolve DNS or reach another service. Interviewers probe this because production incidents are disproportionately networking: two services can't reach each other because they're on different Compose networks, a published port conflicts with the host, an overlay's MTU is wrong over a VPN and large packets silently drop. Being able to reason from "which namespace, which bridge, which iptables rule" to a root cause is the exact skill that shortens a 2am outage. It also signals security awareness: understanding that `--privileged` and `host` networking remove isolation, and that `DOCKER-USER` is where you actually enforce firewall policy.

**Common confusions**

- "Containers on the default bridge can resolve each other by name" — **no**; the default `docker0` bridge has no DNS. Only **user-defined** networks do. This trips up everyone using raw `docker run` without a custom network.
- "`EXPOSE` publishes a port" — it does not; it's documentation. Only `-p`/`-P` (or Compose `ports:`) actually publishes.
- "Containers on different user-defined networks can talk if they know the IP" — they're **isolated by default**; Docker's iptables rules block cross-network traffic unless a container is attached to both.
- "`host.docker.internal` works everywhere" — it's reliable on Docker Desktop; on native Linux you must add `--add-host=host.docker.internal:host-gateway`.
- "Host networking is just faster bridge networking" — it removes NAT *and* isolation; you inherit the host's ports and can collide with them.
- "Overlay is for making containers faster" — overlay is for **multi-host** connectivity, and it adds encapsulation overhead, not speed.

**What follows from this topic**

Networking underpins Compose (which auto-creates a user-defined network so services resolve by name), Swarm/orchestration (overlay networks), and security hardening (network isolation, `DOCKER-USER`, avoiding `host`/`--privileged`). The DNS-by-service-name behaviour you meet here is the single biggest convenience Compose gives you over raw `docker run`, and understanding *why* it works — embedded DNS on a user-defined network — makes the Compose topic click. The NAT/iptables mechanics also connect to Volumes & Storage only loosely, but strongly to any topic touching published ports, reverse proxies, and reaching databases.

### Q1. Walk me through what actually happens under the hood when you run a container on the default bridge network.

When the daemon starts it creates the `docker0` bridge — a virtual L2 switch on the host with an IP like 172.17.0.1 (the gateway for that subnet). When you `docker run` a container:

1. The container gets its **own network namespace** — isolated interfaces, routing table, iptables.
2. Docker creates a **veth pair**: one end goes inside the container's namespace and is renamed `eth0`; the other end stays on the host and is attached to `docker0`.
3. Docker's IPAM assigns the container a private IP from the bridge subnet (e.g. 172.17.0.2) and sets `docker0`'s address as its default gateway.
4. For **egress**, an iptables `MASQUERADE` (source-NAT) rule on `POSTROUTING` rewrites the container's private source IP to the host's IP so replies can find their way back.
5. For any **published port** (`-p 8080:80`), a `DNAT` rule on `PREROUTING`/`OUTPUT` rewrites traffic hitting `host:8080` to `172.17.0.2:80`.

```bash
docker run -d -p 8080:80 nginx
# host:8080 --DNAT--> 172.17.0.2:80 (via docker0, over the veth pair)
# container egress --MASQUERADE--> host IP
```

So a container is a normal process whose packets are switched by a bridge and translated by iptables. No magic — just namespaces, a veth cable, a virtual switch, and NAT.

### Q2. Compare the built-in network drivers: bridge, host, none, overlay, macvlan, ipvlan.

| Driver | Scope | Isolation | Use it for |
|---|---|---|---|
| **bridge** | single host | private subnet, NAT to outside | the default; most single-host apps |
| **host** | single host | none (shares host netns) | perf-sensitive apps; no NAT, no port mapping |
| **none** | single host | total (loopback only) | batch jobs needing zero network |
| **overlay** | multi-host | private, VXLAN-encapsulated | Swarm services / containers across daemons |
| **macvlan** | single host (L2) | container gets own MAC/IP on physical LAN | legacy apps needing to look like a real device |
| **ipvlan** | single host (L2/L3) | shares host MAC, own IP | like macvlan without MAC proliferation |

Default to **bridge** (use a *user-defined* bridge for DNS). Reach for **host** only when NAT overhead genuinely matters and you accept losing isolation. Use **overlay** for multi-host. Use **macvlan/ipvlan** when a container must be a first-class device on the physical network.

### Q3. What's the difference between the default bridge and a user-defined bridge network?

The headline difference is **DNS**. On the default `docker0` bridge, containers can only reach each other by **IP** — there is no name resolution (legacy `--link` aside, which is deprecated). On a **user-defined** bridge, Docker runs an embedded DNS server (127.0.0.11) so containers resolve each other by **container name or network alias** automatically.

```bash
docker network create appnet
docker run -d --name db --network appnet postgres
docker run --network appnet alpine ping db   # resolves by name — works
```

Other user-defined benefits: better isolation (each user-defined network is its own bridge, isolated from others), you can attach/detach containers at runtime, and you control the subnet. Rule of thumb: **never rely on the default bridge for multi-container apps** — always create a user-defined network (which is exactly what Compose does for you).

### Q4. How does Docker's embedded DNS work and what are network aliases?

Every container on a user-defined network has `/etc/resolv.conf` pointing at **127.0.0.11**, an embedded resolver the daemon runs per network. It resolves:

- **Container names** — `ping db` finds the container named `db`.
- **Network aliases** — additional names you assign with `--network-alias`, so several containers can share a lookup name (useful for round-robin or a stable service name).
- External names are forwarded to the host's configured upstream resolvers.

```bash
docker run -d --name api1 --network appnet --network-alias api myapp
docker run -d --name api2 --network appnet --network-alias api myapp
# "api" now resolves to both — a poor-man's load-balance target
```

In Compose, the **service name** is the DNS name, and Compose adds it as an alias automatically. This is why `postgresql://db:5432` "just works" between services — no hardcoded IPs.

### Q5. What is an overlay network and when would you use one?

An **overlay** network spans **multiple Docker hosts**, letting containers on different machines communicate as if on one L2 segment. It's the driver behind Docker Swarm services and multi-daemon setups.

Mechanically it uses **VXLAN**: container-to-container packets are encapsulated inside UDP datagrams and tunnelled across the physical (underlay) network to the peer host, where they're decapsulated. A distributed control plane (the Swarm managers' gossip/KV store) shares the mapping of which container IP lives on which host.

Use it when you have a **cluster** and services on different nodes must talk over a private, portable network without you hand-wiring routes. Caveats: encapsulation adds overhead and an **MTU** consideration (the VXLAN headers eat ~50 bytes, so the effective payload MTU shrinks — a classic source of "large requests hang" bugs). For single-host apps, overlay is overkill; use a bridge.

### Q6. What are macvlan and ipvlan networks, and why would you use them?

Both give a container a presence **directly on the physical LAN** rather than behind NAT.

- **macvlan** — the container gets its **own MAC address and IP** on the physical network, appearing to switches/routers as a distinct physical device. Great for legacy apps that expect to be a real host on the L2 network, or that need to be reachable without port mapping.
- **ipvlan** — the container gets its own IP but **shares the host's MAC**. Use when the network/switch restricts the number of MACs per port (many do), avoiding "MAC flooding" concerns.

```bash
docker network create -d macvlan \
  --subnet=192.168.1.0/24 --gateway=192.168.1.1 \
  -o parent=eth0 lan
```

Tradeoffs: no NAT (the container is on the real network, addressable directly), but you lose Docker's port-mapping convenience, you need the physical network to hand out or reserve IPs, and the **host itself often can't talk to its own macvlan containers** without an extra sub-interface. Reach for these only when an app genuinely needs an L2/L3 identity on the physical LAN.

### Q7. What's the difference between publishing a port and exposing a port?

They sound alike; they're not.

- **`EXPOSE 80`** (Dockerfile) or `expose:` (Compose) is **documentation/metadata**. It records that the app listens on 80. It does **not** open anything to the host. Other containers on the same network can already reach 80 regardless — expose changes nothing functionally.
- **`-p 8080:80`** (or `-P`, or Compose `ports:`) **publishes**: it installs the DNAT rule that makes `host:8080` route to `container:80`, making the service reachable from outside the Docker network (from the host and, unless firewalled, the wider network).

```bash
docker run -p 8080:80 nginx     # reachable at host:8080
docker run -P nginx             # publishes EXPOSEd ports to random high host ports
```

The interview trap: candidates say `EXPOSE` "opens the port." It opens nothing — you need `-p`. Also worth knowing: publishing to `127.0.0.1:8080:80` binds only to loopback, a common security hardening step so a service isn't reachable from the network.

### Q8. How does a published port actually traverse iptables? What is docker-proxy?

Two mechanisms cooperate:

1. **iptables DNAT** — the primary path. A `-p 8080:80` installs a `DNAT` rule in the `DOCKER` chain (hooked into `PREROUTING`/`OUTPUT`) that rewrites the destination to the container's IP:port. This is fast, in-kernel, and handles the bulk of traffic.
2. **docker-proxy** — a small **userland** process the daemon spawns per published port. It exists as a fallback for cases iptables DNAT can't cover cleanly — e.g. connections from the host to `localhost:8080` (hairpin/loopback), or environments where the iptables path doesn't apply. It literally accepts connections and forwards them to the container.

The userland proxy is slower (data copies through user space), so it's a fallback, not the hot path. You can disable it (`"userland-proxy": false` in daemon.json), which removes those helper processes and relies purely on iptables — some operators do this to save memory when running thousands of published ports, accepting that certain loopback edge cases behave differently.

### Q9. When would you use host networking, and what do you give up?

`--network host` puts the container in the **host's** network namespace — no separate netns, no veth, no bridge, no NAT.

**Gains:**
- **No NAT overhead** and no port-mapping translation — the container binds host ports directly. Meaningful for high-throughput / low-latency workloads (packet processors, some databases, load generators).
- Simpler for apps that open many/dynamic ports where enumerating `-p` mappings is painful.

**Costs:**
- **No network isolation** — the container sees and can bind every host interface and port.
- **Port conflicts** — if the container's app wants port 80 and the host already uses it, it fails; two host-net containers can't both bind 80.
- `-p` is **ignored** entirely (there's nothing to map).
- Weaker security posture; a compromised container has direct host network access.

Use it deliberately for perf-sensitive single-tenant workloads, not as a default. (Note: on Docker Desktop for Mac/Windows, host networking behaves differently because the daemon runs inside a VM.)

### Q10. How does a container reach a service running on the host machine?

- **Docker Desktop (Mac/Windows) and modern Docker Engine:** use the special DNS name **`host.docker.internal`**, which resolves to the host.
- **Native Linux:** `host.docker.internal` isn't automatic. Add it explicitly:

```bash
docker run --add-host=host.docker.internal:host-gateway myapp
# host-gateway resolves to the host's gateway IP on the bridge (e.g. 172.17.0.1)
```

The magic token **`host-gateway`** maps to the host's address as seen from the container (the bridge gateway). Alternatively you can hit the bridge gateway IP directly (often 172.17.0.1) or, in `--network host`, just use `localhost`. The `--add-host … host-gateway` form is the portable, self-documenting way and works the same in Compose via `extra_hosts:`.

### Q11. How do you control a container's IP address and subnet? What is IPAM?

**IPAM** (IP Address Management) is Docker's subsystem for allocating addresses. By default it picks a private subnet and hands out the next free IP. You can control it:

```bash
docker network create --subnet=10.10.0.0/24 --gateway=10.10.0.1 mynet
docker run --network mynet --ip 10.10.0.5 myapp   # static IP
```

- `--subnet` / `--gateway` / `--ip-range` shape the network's addressing.
- `--ip` pins a container to a specific address (only on user-defined networks).
- You can specify a custom IPAM driver for external address management.

In practice you rarely pin container IPs — you rely on **DNS by name** instead, because IPs are ephemeral (a recreated container may get a different address). Static IPs are for the rare case (a legacy peer that has an IP hardcoded, or firewall rules keyed to an address). Subnet control matters more: you set `--subnet` to avoid **collisions** with your corporate/VPN ranges, a frequent cause of "the container can't reach the office network."

### Q12. Two containers on different user-defined networks can't talk to each other. Why, and how do you fix it?

By design. Each user-defined network is a separate bridge, and Docker's iptables rules **isolate networks from each other** — a container on `net-a` cannot reach a container on `net-b`, even by IP. This isolation is a feature: it's how you segment tiers (e.g. keep a database off the public-facing network).

Fixes, depending on intent:

```bash
# Attach the container to BOTH networks
docker network connect net-b my-container
```

Now the container has an interface on each network and can bridge between them. In Compose you list multiple networks under a service. The correct design is usually deliberate: put the web tier and db on a shared `backend` network, and only the web tier on the `frontend`/public network — so the database is unreachable from outside by construction. If two things "should" talk but can't, first check they're on the **same** network (`docker network inspect <net>` lists connected containers).

### Q13. How would you debug connectivity between two containers that should be able to talk?

Work from the outside in:

```bash
# 1. Are they on the SAME network? (isolation is the #1 cause)
docker network inspect appnet          # lists connected containers + IPs

# 2. Does DNS resolve? (must be a user-defined network)
docker exec web nslookup db
docker exec web getent hosts db

# 3. Is the port reachable / is the app listening?
docker exec web curl -v http://db:5432
docker exec db ss -tlnp                # is something bound on the port?

# 4. Drop into the container's network namespace for deeper checks
docker exec web ip addr
sudo nsenter -t $(docker inspect -f '{{.State.Pid}}' web) -n ss -tlnp
```

The usual root causes, in order: (1) containers on **different networks** (isolation), (2) using the **default bridge** so DNS doesn't resolve, (3) the app isn't actually **listening** on 0.0.0.0 (bound to 127.0.0.1 inside the container, so unreachable from peers), (4) a published-port/firewall issue for host-facing traffic, (5) MTU. `docker network inspect`, `exec` + `curl`/`nslookup`, and `nsenter` into the netns are the core toolkit.

### Q14. What causes MTU problems with overlay networks or over a VPN, and how do you spot them?

MTU is the largest packet a link carries. Overlay/VXLAN wraps each packet in extra headers (~50 bytes), and VPNs (WireGuard/IPsec) add their own. If a container still thinks its MTU is 1500 but the real path can only carry ~1400 after encapsulation, **large packets get dropped** while small ones (pings, DNS, the TCP handshake) succeed — so the connection *establishes* but then **hangs** on the first big response. Classic symptoms: `curl` connects then stalls, TLS handshakes hang, `git clone` freezes partway.

Diagnose with a "don't fragment" ping to find the real MTU:

```bash
ping -M do -s 1400 <peer>   # increase size until it fails; that's your ceiling
```

Fix by lowering the Docker/overlay MTU to fit the path (e.g. set `com.docker.network.driver.mtu` on the network, or the daemon MTU) so it accounts for the encapsulation overhead. This is one of the most common and most baffling Docker networking bugs precisely because small traffic works fine.

### Q15. How does Docker manage iptables, and how do you add your own firewall rules safely?

Docker **actively manages** iptables: it creates the `DOCKER`, `DOCKER-ISOLATION-STAGE-*`, and `DOCKER-USER` chains and rewrites NAT/filter rules as containers come and go. If you add rules directly to the standard chains, Docker may **reorder or clobber** them.

The safe extension point is the **`DOCKER-USER`** chain: Docker guarantees it's evaluated **before** its own rules and never overwrites it. Put your custom filtering there.

```bash
# Only allow the corporate subnet to reach published container ports
iptables -I DOCKER-USER -i eth0 ! -s 10.0.0.0/8 -j DROP
```

Two more things a senior mentions: (1) Docker's published-port DNAT can **bypass** a host firewall like `ufw` because it inserts rules ahead of it — a well-known "my firewall didn't block the container port" surprise; `DOCKER-USER` is the correct fix. (2) You can tell Docker to stop touching iptables entirely (`"iptables": false` in daemon.json) if you manage networking yourself, but then egress NAT and port publishing become your responsibility. Also worth knowing: **rootless** Docker and IPv6 have their own rule handling — see the rootless question.

## Volumes & Storage

### Summary

**What this topic covers**

How data survives — or doesn't — in Docker. A container's filesystem is a stack of read-only image layers with a **thin writable layer** on top, and that writable layer is **deleted when the container is removed**. So anything you want to keep (database files, uploads, logs) must live **outside** the container's lifecycle. This topic covers the three mount types (named volumes, bind mounts, tmpfs) and when to use each, the `-v` short syntax vs the explicit `--mount` syntax, anonymous volumes and the `VOLUME` instruction's gotchas, the volume lifecycle (created on demand, *not* cleaned up automatically — dangling volumes eating disk), sharing volumes between containers, the ever-painful **permission/UID mismatch** problem, volume drivers/plugins for networked storage, backup and restore, read-only mounts, SELinux relabeling (`:z`/`:Z`), and the Docker Desktop bind-mount performance cliff on Mac/Windows. The 16 questions span "why do I even need volumes" to "files created in the container are owned by root on my host — fix it."

**Mental model**

Picture the container filesystem as a stack: **read-only image layers** at the bottom, a **thin writable layer** (copy-on-write via overlayfs) on top. Writes go to that top layer; it's born with the container and **dies with it**. A **mount** punches a hole in that stack: at a chosen path, the container sees storage that lives *outside* the union filesystem and therefore outlives the container. That's the entire point of volumes. The three flavours differ only in *where* that outside storage lives: a **named volume** is a directory Docker manages under `/var/lib/docker/volumes` (portable, lifecycle-managed, driver-pluggable); a **bind mount** is a specific **host path** you choose (great for editing source live in dev); a **tmpfs** is **RAM** (fast, never hits disk, gone on stop — for secrets and scratch). Hold onto "the writable layer is ephemeral; mounts are how data escapes it," and every rule — why prod uses named volumes, why bind mounts are a dev tool, why anonymous volumes surprise you — follows.

**Key terms**

- **Writable (container) layer** — the ephemeral copy-on-write top layer; deleted with the container.
- **Named volume** — Docker-managed storage under `/var/lib/docker/volumes/<name>`; the preferred way to persist data.
- **Bind mount** — a host path mounted into the container; host-path-dependent, ideal for dev live-reload.
- **tmpfs mount** — in-memory storage, never written to disk; for secrets and scratch data.
- **Anonymous volume** — a named volume with a random name, created implicitly (e.g. by a `VOLUME` instruction); easy to leak.
- **`VOLUME` instruction** — Dockerfile directive declaring a mount point; auto-creates an anonymous volume if none is supplied.
- **Volume driver/plugin** — pluggable backend (NFS, cloud block storage) for networked/cluster volumes.
- **Dangling volume** — a volume no container references; consumes disk until pruned.
- **`--volumes-from`** — mount all of another container's volumes into a new container.
- **`:ro` / `:z` / `:Z`** — mount options: read-only, shared SELinux relabel, private SELinux relabel.
- **`--mount` vs `-v`** — explicit key=value syntax vs terse colon-separated syntax.
- **IPAM of storage (UID/GID)** — not a Docker term, but the crux: files inherit the *container* process's UID, which may mismatch the host user.

**Why interviewers ask this**

Data persistence is where a container mistake becomes a **data-loss incident**. A junior runs a database in a container with no volume, removes the container, and the data is gone — interviewers want to know you'd never do that. Beyond the basics, storage separates people who've operated stateful containers: do you know that removing a container leaves its named volume behind (silently filling disk)? That bind-mounting into a directory *hides* the image's files there? That a root process in the container writes root-owned files onto your host, breaking your non-root workflow? That Docker Desktop bind mounts on Mac are slow because of the VM boundary? Storage questions also test judgment: named volume vs bind mount is a real design decision (portability and managed lifecycle vs direct host access), and knowing *when* each is appropriate — bind mounts for dev, named volumes for prod data — is exactly the operational maturity interviewers screen for.

**Common confusions**

- "Volumes and bind mounts are the same thing" — both persist data outside the container, but a **volume** is Docker-managed and portable; a **bind mount** is tied to a specific host path.
- "Removing a container removes its data" — the **writable layer** goes, but **named volumes persist** and must be pruned separately. This cuts both ways: surprise data loss *and* surprise disk usage.
- "`VOLUME` in a Dockerfile is harmless documentation" — it silently creates **anonymous volumes** at runtime, can **break build caching** for later writes to that path, and persists data you didn't mean to keep.
- "Bind mounts are fine in production" — they couple you to host layout and are hard to back up/migrate; prefer **named volumes** for prod data.
- "Mounting onto an image directory merges the files" — a mount **overlays/hides** what the image put there (an empty volume shows empty, though *named* volumes get seeded from the image on first use).
- "Files are owned by whoever ran `docker run`" — no; they're owned by the **container process's UID**, which is often root, producing host-side permission pain.

**What follows from this topic**

Storage feeds directly into Compose (named volumes and bind mounts are first-class in the Compose file, and `down -v` is how you wipe them) and into security (read-only root filesystems, tmpfs for secrets, avoiding leaking host paths). The UID/permission material connects to the non-root `USER` hardening you meet in security topics. And the "writable layer is ephemeral" mental model reinforces the core image/layer model from the fundamentals: a container is a running instance of an immutable image plus a disposable scratch layer, and volumes are how state outlives that scratch layer.

### Q1. Why do you need volumes? What happens to data written inside a container?

A container's filesystem is the image's read-only layers plus a **thin writable layer** on top. Every file the app writes lands in that writable layer — which is **created with the container and destroyed when the container is removed**. So:

```bash
docker run --name db postgres      # writes data to the writable layer
docker rm db                       # data is GONE
```

That's fine for stateless apps (a web server that writes nothing important) but catastrophic for databases, uploads, or anything you need to keep. **Volumes** (and bind mounts) solve this by mounting storage that lives *outside* the container's lifecycle at a path inside it, so the data survives container removal, upgrades (you replace the container, keep the volume), and can be shared or backed up. Rule: **any stateful workload needs its data on a volume**, never in the writable layer.

### Q2. Compare named volumes, bind mounts, and tmpfs mounts.

| | Named volume | Bind mount | tmpfs |
|---|---|---|---|
| Location | Docker-managed (`/var/lib/docker/volumes`) | any host path you pick | RAM (never on disk) |
| Portability | high — Docker owns it | low — tied to host layout | n/a (ephemeral) |
| Lifecycle | managed; survives container rm | you manage the host dir | gone on stop |
| Best for | **prod persistent data** (DB files) | **dev** live-reload of source | secrets, scratch |
| Drivers/plugins | yes (NFS, cloud) | no | no |
| Backup | easy (managed) | direct host access | not applicable |

Default to **named volumes** for data you must keep; they're portable, lifecycle-managed, and driver-pluggable. Use **bind mounts** in development to edit source on the host and see it live in the container. Use **tmpfs** for sensitive or throwaway data you never want touching disk.

### Q3. What's the difference between the `-v` short syntax and the `--mount` syntax? Which should I prefer?

Both create mounts; they differ in clarity.

```bash
# -v / --volume: terse, positional, colon-separated
docker run -v myvol:/data -v /host/src:/app:ro myapp

# --mount: explicit key=value, self-documenting
docker run \
  --mount type=volume,source=myvol,target=/data \
  --mount type=bind,source=/host/src,target=/app,readonly \
  myapp
```

**Prefer `--mount`.** It's verbose but unambiguous: you state `type=volume|bind|tmpfs` explicitly, so there's no guessing. A subtle `-v` gotcha: with `-v`, if the source **host path doesn't exist**, Docker silently creates it as an (empty) directory; with `--mount type=bind`, a missing source **errors out** — which is what you want, because a typo'd path silently mounting an empty dir is a nasty class of bug. `-v` is fine for quick interactive use and is what most people type; `--mount` is what you use in anything you'll maintain.

### Q4. What are anonymous volumes and the VOLUME instruction, and what are their gotchas?

An **anonymous volume** is a named volume with a **random hash** for a name, created implicitly rather than by you. The most common source is the Dockerfile **`VOLUME`** instruction:

```dockerfile
VOLUME /var/lib/postgresql/data
```

At runtime, if you don't explicitly mount something there, Docker **auto-creates an anonymous volume** for that path. Gotchas:

- **Surprise persistence** — data you didn't intend to keep survives in an orphan volume with an unreadable name.
- **Disk leaks** — every `docker run` without an explicit mount spawns a *new* anonymous volume; they pile up as dangling volumes.
- **Breaks build cache / later writes** — any `RUN` that writes to a `VOLUME`-declared path **after** the `VOLUME` line has its changes discarded (writes to a declared volume path during build don't persist into the image), a genuinely confusing footgun.

Best practice: **avoid `VOLUME` in your own Dockerfiles**; let the *operator* decide mounts at run time (via `-v`/Compose). Clean up anonymous volumes with `docker run --rm -v ...` or `docker volume prune`.

### Q5. Walk me through the volume lifecycle. Why is my disk filling up with volumes?

Volumes are **created on demand** and, crucially, are **not removed with the container**:

```bash
docker run --name app -v data:/data myapp
docker rm app          # container gone; volume "data" STILL EXISTS
```

This is intentional — Docker won't delete your database because you removed a container. But it means volumes accumulate:

- **Named volumes** stick around until you `docker volume rm` them.
- **Anonymous volumes** (from `VOLUME` or `-v /path` with no source name) pile up invisibly each run.
- A volume no container references is **dangling**.

Cleanup:

```bash
docker rm -v app                 # remove container AND its anonymous volumes
docker run --rm -v ... myapp     # auto-remove container + anon volumes on exit
docker volume ls -f dangling=true
docker volume prune              # remove all dangling volumes
docker system df                 # see how much disk volumes are eating
```

"My disk is full" in a long-running Docker host is very often accumulated dangling volumes (and images). `docker system df` shows it; `prune` reclaims it — carefully, since prune is destructive.

### Q6. How do you share a volume between multiple containers?

Two ways:

```bash
# 1. Mount the SAME named volume into each container
docker run -d --name writer -v shared:/data myapp
docker run -d --name reader -v shared:/data myapp

# 2. --volumes-from: inherit another container's mounts
docker run -d --name reader --volumes-from writer myapp
```

Mounting the same **named volume** is the clean, explicit approach and what you'd use in Compose (two services referencing one top-level volume). **`--volumes-from`** copies all of a source container's mounts into the new one — handy for backup/utility containers ("give me exactly what that container has mounted") but more implicit.

Caveat: sharing a volume means **concurrent access**. Two processes writing the same files need application-level coordination (most databases explicitly forbid two engines over one data dir). Sharing is safe for one-writer/many-readers or for backup jobs; it is *not* a substitute for a clustered filesystem or a real database replication story.

### Q7. Files created by a container are owned by root on my host. Explain and fix the UID/permission problem.

A process in a container writes files with **its own UID/GID**. By default containers run as **root (UID 0)**, so files it creates in a bind-mounted host directory are owned by **root on the host** — and your regular host user can't edit or delete them without `sudo`. Conversely, if you run the container as a **non-root** user (say UID 1000) but the host directory is owned by a different UID, the container gets **permission denied**.

This is a UID-*number* match problem: the kernel only compares numeric IDs across the boundary; names are irrelevant.

Fixes:

```bash
# Run the container as your host UID:GID
docker run -u $(id -u):$(id -g) -v "$PWD":/app myapp

# Or chown to the expected UID in an entrypoint before dropping privileges
# entrypoint: chown -R appuser:appuser /data && exec gosu appuser "$@"
```

Other tools: **user namespaces** (`userns-remap`) map container root to an unprivileged host UID; building the image with a `USER` whose UID matches the host; or `chown` in an entrypoint. In dev, `-u $(id -u):$(id -g)` is the quickest fix. For named volumes it's less painful because Docker manages the directory, but bind mounts expose the mismatch directly.

### Q8. What are volume drivers/plugins and when would you use them?

By default a named volume is a local directory on the Docker host. A **volume driver** swaps that backend for something else — network or cloud storage — while keeping the same `-v name:/path` interface:

```bash
docker volume create --driver local \
  --opt type=nfs --opt o=addr=10.0.0.5,rw \
  --opt device=:/exports/data nfsdata

docker run -v nfsdata:/data myapp
```

Use them when the data must be **available beyond a single host**: NFS/CIFS shares, cloud block storage (EBS-style), or clustered/distributed filesystems. In an orchestrated cluster this is essential — a container that reschedules to another node needs its storage to follow it, which local volumes can't do. Plugins (installed via `docker plugin install`) extend this to managed providers. For a single-host app, the default `local` driver is fine; reach for drivers when you need **shared, networked, or portable-across-nodes** storage.

### Q9. How do you back up and restore a Docker volume?

Volumes have no built-in backup command; the idiom is a **throwaway container** that mounts the volume plus a bind mount for the archive:

```bash
# Back up: tar the volume's contents to a host file
docker run --rm \
  -v myvol:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/myvol.tar.gz -C /data .

# Restore: untar into a (new) volume
docker run --rm \
  -v myvol:/data \
  -v "$PWD":/backup \
  alpine tar xzf /backup/myvol.tar.gz -C /data
```

The pattern: spin up a minimal image (`alpine`/`busybox`), mount the volume read-only for backup (or read-write for restore) and a host directory for the archive, run `tar`, let `--rm` clean up. For **databases**, prefer the DB's native dump tool (`pg_dump`, `mysqldump`) over tarring the data directory, since tarring live files can capture an inconsistent state — or stop the container first. This tar-via-container trick works for any volume regardless of driver.

### Q10. What does mounting a volume onto a directory that already has files in the image do?

Depends on the mount type:

- **Named volume, empty, first use** — Docker **seeds** the volume with the image's existing contents at that path. So `VOLUME /app/data` where the image shipped defaults there: the fresh volume gets copies of those files. This only happens for empty *named* volumes on first mount.
- **Named volume that already has data** — the volume's contents win; the image's files at that path are **hidden**.
- **Bind mount** — **no seeding, ever**. The host directory completely **overlays** the image path. If the host dir is empty, the container sees an empty directory there, **hiding** whatever the image put there.

```bash
# Image has /app/node_modules baked in; bind-mounting the source over /app
# hides node_modules -> "module not found". Classic dev bug.
docker run -v "$PWD":/app node   # /app/node_modules from the image is now hidden
```

That last case is a famous gotcha: bind-mounting your project over `/app` masks the image's installed `node_modules`. The fix is an anonymous volume for `node_modules` (`-v /app/node_modules`) so it isn't shadowed, or installing deps at runtime.

### Q11. How do you make a mount read-only, and why would you?

Append `:ro` (short syntax) or `readonly` (`--mount`):

```bash
docker run -v config:/etc/app:ro myapp
docker run --mount type=bind,source=/host/certs,target=/certs,readonly myapp
```

The container can read but **not write** the mounted path; write attempts fail with EROFS. Reasons:

- **Security** — a compromised app can't tamper with mounted config, certificates, or code.
- **Safety** — prevent a container from accidentally modifying source or shared data it should only consume.
- **Correctness** — enforce that a data volume is consumed read-only by a reader container while a single writer owns writes.

Related hardening: `--read-only` makes the container's **entire root filesystem** read-only (then you mount a small `tmpfs` for the few paths it must write, like `/tmp`). Read-only mounts and read-only root filesystems are cheap, high-value hardening steps that catch both attacks and bugs.

### Q12. When should you NOT use bind mounts?

Avoid bind mounts in **production**, and here's the reasoning:

- **Host coupling** — a bind mount hardcodes a host path (`/opt/app/data`), so the container only works on hosts laid out that way. Move to another node and it breaks. Named volumes are portable.
- **Backup/lifecycle** — Docker doesn't manage a bind-mounted directory; there's no `docker volume` tooling around it, no clean migration story.
- **Security/exposure** — bind mounting host directories (especially `/`, `/var/run/docker.sock`, or system paths) hands the container access to the host; a bind mount of the Docker socket is effectively root on the host.
- **Permission surprises** — the UID mismatch pain (see the permissions question) hits bind mounts hardest.

Bind mounts shine in **development**: mount your source so edits reload live, mount local config for quick iteration. For **persistent production data**, use **named volumes** (portable, managed, driver-pluggable); for cluster storage, a volume driver. Rule of thumb: bind mount = dev convenience; named volume = prod data.

### Q13. What are the main `docker volume` commands?

```bash
docker volume create myvol                 # create explicitly
docker volume ls                           # list volumes
docker volume ls -f dangling=true          # only unreferenced volumes
docker volume inspect myvol                # mountpoint, driver, labels, options
docker volume rm myvol                     # remove (fails if in use)
docker volume prune                        # remove all dangling volumes
docker volume prune -a                     # include named unused volumes (careful)
```

`inspect` is the one people forget — it tells you the actual `Mountpoint` on the host (under `/var/lib/docker/volumes/<name>/_data`), the driver, and any options, which is invaluable for debugging or manual inspection. `prune` is the disk-reclaimer but is **destructive** — it deletes data in dangling volumes irreversibly, so confirm nothing important is dangling first (`docker volume ls -f dangling=true`). In Compose, `docker compose down -v` removes the project's named volumes.

### Q14. How do you mount a single file instead of a directory?

Bind mounts can target an individual file, not just a directory:

```bash
docker run \
  -v /host/path/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx

# --mount form
docker run \
  --mount type=bind,source=/host/nginx.conf,target=/etc/nginx/nginx.conf,readonly \
  nginx
```

Common for injecting a single **config file** (nginx.conf, an app's `.env`, a certificate) without replacing the whole directory. Two caveats:

- The **source file must exist** on the host beforehand; if it doesn't, Docker (with `-v`) creates a *directory* at that path, and the container then sees a directory where it expected a file — a confusing failure. `--mount` errors instead, which is safer.
- Some editors **replace** a file on save (write-new-then-rename) rather than editing in place, which **breaks** the bind mount because the inode changes — the container keeps seeing the old file. Mounting the parent directory avoids this.

Named volumes and tmpfs mount directories, not single files — single-file mounting is a bind-mount feature.

### Q15. What are the `:z` and `:Z` mount options and when do you need them?

On **SELinux-enforcing** hosts (RHEL, Fedora, CentOS), the kernel labels every file, and a container is denied access to host files that don't carry a matching label. Without relabeling you get "permission denied" on a bind mount **even as root** — because SELinux, not standard permissions, is blocking it. The `:z` / `:Z` suffixes tell Docker to **relabel** the mounted content:

```bash
docker run -v /host/data:/data:Z myapp    # private label (this container only)
docker run -v /host/config:/config:z myapp # shared label (multiple containers)
```

- **`:z`** (lowercase) — apply a **shared** SELinux label, so the content can be mounted into **multiple** containers.
- **`:Z`** (uppercase) — apply a **private, exclusive** label for a single container.

Warning: **`:Z` on a system directory is dangerous** — relabeling something like `/usr` or `/var` recursively can break the host, because you're rewriting labels the host itself relies on. Only relabel directories you own for the container's data. If SELinux is permissive/disabled (or on Docker Desktop), you won't need these. The symptom that points here: bind mount denied on an SELinux host despite correct Unix permissions.

### Q16. Why are bind mounts slow on Docker Desktop for Mac/Windows, and what can you do?

On Linux, the Docker daemon and your filesystem share the same kernel, so bind mounts are essentially free. On **Mac/Windows**, Docker runs inside a **lightweight VM**, and a bind mount has to cross the **host ↔ VM boundary** — historically via a userspace file-sharing protocol (osxfs/gRPC-FUSE). Every file operation (stat, read, write) pays that crossing, which is brutal for workloads that touch **many small files**: `node_modules`, PHP/Ruby projects, large git trees. Symptoms: builds and test suites that are seconds on Linux take minutes on a Mac.

Mitigations:

- Use the newer **VirtioFS** file-sharing backend (Docker Desktop setting) — a large improvement over gRPC-FUSE.
- Add the **`:cached` / `:delegated`** consistency flags (relax read/write ordering guarantees for speed) — legacy but still helpful.
- **Keep hot paths off the bind mount**: put `node_modules`/build artifacts in a **named volume** (which lives *inside* the VM and is fast), bind-mounting only the source you edit.
- For heavy cases, sync source into the VM (mutagen-style) instead of live bind-mounting.

The general principle: minimize how much frequently-accessed I/O crosses the VM boundary. This problem essentially doesn't exist on native Linux hosts.

## Compose Fundamentals

### Summary

**What this topic covers**

Docker Compose — defining and running a **multi-container application declaratively** in one YAML file. Where `docker run` is imperative and one-container-at-a-time, Compose lets you describe a whole app (web + database + cache + queue), their networks, volumes, and config, then bring it all up with one command. This topic covers the modern `docker compose` (v2 plugin) vs the legacy `docker-compose` (v1 Python), the Compose file structure (`services`, `networks`, `volumes` top-level keys; the obsolete `version` field), what a service definition contains (`image` vs `build`, ports, environment/`env_file`, volumes, `depends_on`, command, restart), the core commands (`up`, `down`, `ps`, `logs`, `exec`, `build`), the **implicit user-defined network** that lets services reach each other **by service name**, the project name and how it namespaces everything, environment-variable interpolation and the `.env` file, named volumes, the **`depends_on` readiness trap** (it waits for *start*, not *ready*) and healthcheck conditions, scaling, one-off `run` commands, and why Compose is a **dev / single-host** tool rather than production HA (that's Kubernetes). The 17 questions run from "what is Compose" to a full web+db+cache example.

**Mental model**

Think of Compose as **`docker run` for a whole application, written down**. Every flag you'd pass to `docker run` — image, ports, env vars, volumes, network, restart policy — becomes a **key under a service** in `docker-compose.yml`. Compose reads that file and reconciles reality to match it: it creates a dedicated **project** (namespaced by the directory/`-p` name), an implicit **user-defined bridge network** all services join, any declared **volumes**, and one container per service. The single most valuable thing it does is that network: because services share a user-defined network, Compose's embedded DNS lets them reach each other **by service name** (`db`, `redis`, `api`) with zero hardcoded IPs — the exact convenience that raw `docker run` lacks. Compose is **declarative and idempotent**: `up` again after an edit and it recreates only what changed. And it's **local-first**: brilliant for standing up your app's full stack on one machine for development or CI, deliberately *not* a production cluster orchestrator.

**Key terms**

- **Docker Compose** — a tool to define and run multi-container apps from a YAML file.
- **`docker compose` (v2)** — the current Go plugin subcommand; replaces the v1 Python `docker-compose`.
- **Service** — one component of the app (a container spec): its image/build, ports, env, volumes, etc.
- **`services:` / `networks:` / `volumes:`** — the top-level keys of the Compose file.
- **`version` field** — now **obsolete**; the Compose Spec ignores it (don't add it).
- **Project name** — the namespace (default: the directory name) prefixing container/network/volume names.
- **Implicit network** — the user-defined bridge Compose auto-creates so services resolve each other by name.
- **`depends_on`** — declares start order; by default waits only for **start**, not readiness.
- **`build:` vs `image:`** — build from a Dockerfile locally vs pull a prebuilt image.
- **`env_file` / `${VAR}` / `.env`** — supply environment variables and interpolate them into the file.
- **`docker compose up` / `down`** — create-and-start the stack / stop-and-remove it (`-v` also removes volumes).
- **Healthcheck condition** — `condition: service_healthy` under `depends_on` to wait for actual readiness.

**Why interviewers ask this**

Compose is the daily driver of local development, so knowing it well signals you can actually stand up and iterate on a real multi-service app. But the questions that separate levels are about the **subtleties**: do you know `depends_on` doesn't wait for a database to be *ready*, only *started* — the single most common Compose bug, where the app races the DB and crashes on boot? Do you understand *why* services talk by name (the implicit user-defined network + embedded DNS), rather than treating it as magic? Do you know the difference between `down` and `down -v` (one keeps your data, one destroys it — a data-loss footgun)? And critically, do you know Compose's **boundary** — that it's a single-host dev/CI tool, and reaching for it as a production orchestrator instead of Kubernetes is an architecture mistake? Interviewers use Compose to test both hands-on fluency and the judgment to know when a tool stops being the right one.

**Common confusions**

- "`depends_on` waits for the database to be ready" — **no**; by default it waits only for the container to **start**. Use `condition: service_healthy` + a HEALTHCHECK, or app-level retries.
- "You still need the `version:` field" — it's **obsolete** in the current Compose Spec; leave it out.
- "`docker-compose` and `docker compose` are interchangeable" — v1 (hyphen, Python) is **deprecated**; v2 (space, Go plugin) is current.
- "`docker compose down` deletes my data" — plain `down` keeps **named volumes**; only `down -v` removes them.
- "Services find each other by container IP" — they find each other by **service name** via the implicit network's DNS; IPs are ephemeral.
- "Compose is a production orchestrator" — it's **single-host dev/CI**; production HA/scheduling is Kubernetes' job.
- "`ports:` and `expose:` are the same" — `ports:` publishes to the host; `expose:` is metadata (services already reach each other on the internal network).

**What follows from this topic**

Compose is the practical payoff of everything earlier: it stitches together **images** (the build/image key), **networking** (the implicit user-defined network and service-name DNS from the networking topic), and **volumes** (named volumes and bind mounts, and `down -v`). The `depends_on`/healthcheck material previews orchestration readiness concepts that Kubernetes formalizes (readiness probes). And recognizing Compose's single-host limit is the natural on-ramp to **Kubernetes** — when you outgrow "one machine, declared in YAML" and need multi-node scheduling, self-healing, and rolling updates, you graduate from Compose to a real orchestrator.

### Q1. What is Docker Compose and what problem does it solve?

Docker Compose is a tool for **defining and running multi-container applications** from a single declarative YAML file (`docker-compose.yml`). Instead of running each container by hand with long `docker run` commands and wiring up networks manually, you describe the whole application — its services, their config, networks, and volumes — and bring it up with **one command**:

```bash
docker compose up -d
```

The problem it solves: real apps aren't one container. A typical stack is a web app **plus** a database **plus** a cache **plus** maybe a queue. Orchestrating those by hand — creating a shared network, starting them in order, passing the right env vars, mapping ports — is tedious and error-prone. Compose makes it **declarative, repeatable, and version-controllable**: the file lives in your repo, so any developer (or CI) gets the identical stack with `up`. It's the standard tool for **local development and testing** of multi-service apps.

### Q2. What's the difference between `docker compose` (v2) and `docker-compose` (v1)?

- **`docker-compose`** (with a hyphen) is **v1**: a standalone **Python** tool, installed separately. It's **deprecated** and no longer developed.
- **`docker compose`** (a space — a subcommand of the Docker CLI) is **v2**: rewritten in **Go**, shipped as a **CLI plugin**, and the current supported version.

Functionally they're close, but v2 is faster, better integrated, and the only one receiving updates. Practical differences: v2 uses the **Compose Spec** (which drops the `version:` field), and container names default to `project-service-N` (hyphens) rather than v1's `project_service_1` (underscores) — a small thing that occasionally breaks scripts grepping container names. The takeaway for an interview: **use `docker compose` (v2)**; treat `docker-compose` as legacy you'd migrate off. If you see the hyphenated form in old docs or CI, that's a modernization target.

### Q3. Describe the structure of a Compose file.

A Compose file has a few **top-level keys**:

```yaml
services:            # the containers that make up your app
  web:
    build: .
    ports: ["8080:80"]
  db:
    image: postgres:16
    volumes: [dbdata:/var/lib/postgresql/data]

networks:            # optional; custom networks (a default one is auto-created)
  backend:

volumes:             # named volumes declared for reuse/persistence
  dbdata:
```

- **`services:`** — the heart of the file; each key is a service (a container spec).
- **`networks:`** — optional custom networks; if omitted, Compose creates a default one that all services join.
- **`volumes:`** — declares named volumes so services can reference and persist data.
- **`configs:` / `secrets:`** — for config and secret injection (more advanced).

Note there's **no `version:` field** anymore — the modern Compose Spec ignores it; adding it just prints a warning. You start straight at `services:`.

### Q4. What can a service definition contain?

A service maps to a container spec — essentially every `docker run` option as YAML:

```yaml
services:
  api:
    build:                     # build from a Dockerfile...
      context: .
      dockerfile: Dockerfile
    # image: ghcr.io/acme/api:1.2.3   # ...or pull a prebuilt image
    ports:
      - "8080:80"              # publish host:container
    environment:
      - NODE_ENV=production
    env_file: .env             # load env vars from a file
    volumes:
      - ./src:/app/src         # bind mount for dev
      - appdata:/data          # named volume
    depends_on:
      - db                     # start order
    command: ["node", "server.js"]   # override the image's default
    restart: unless-stopped    # restart policy
```

Key fields: **`image`** vs **`build`** (pull vs build locally), **`ports`** (publish), **`environment`**/**`env_file`** (config), **`volumes`** (persistence/dev mounts), **`depends_on`** (ordering), **`command`** (override the default), and **`restart`** (`no` / `on-failure` / `always` / `unless-stopped`). This is the vocabulary of almost every Compose file.

### Q5. Walk through the core Compose commands you use day to day.

```bash
docker compose up -d          # create + start everything, detached
docker compose up --build     # rebuild images first, then up
docker compose down           # stop + remove containers/networks (keeps volumes)
docker compose down -v        # ...and remove named volumes too (DESTROYS data)
docker compose ps             # list this project's containers + status
docker compose logs -f web    # tail logs for a service (follow)
docker compose exec web sh    # shell into a running service
docker compose build          # build/rebuild service images
docker compose stop / start   # stop/start without removing
docker compose restart web    # restart one service
```

The daily loop: **`up -d`** to launch, **`logs -f`** to watch, **`exec`** to poke inside, **`down`** to tear down. The two you must not confuse are **`down`** (keeps your named volumes / data) and **`down -v`** (also deletes them). `up --build` forces a rebuild when your Dockerfile or source changed; without it, Compose reuses the existing image. `compose run` (below) is for one-off commands.

### Q6. How do services in a Compose file find and talk to each other?

Compose automatically creates an **implicit user-defined bridge network** and attaches every service to it. Because it's a *user-defined* network, Docker's embedded DNS is active, and each service is reachable by its **service name**:

```yaml
services:
  web:
    build: .
    environment:
      DATABASE_URL: postgres://db:5432/app   # "db" resolves to the db service
      REDIS_URL: redis://cache:6379
  db:
    image: postgres:16
  cache:
    image: redis:7
```

Here `web` connects to `db:5432` and `cache:6379` **by name** — no IP addresses, no `--link`. Compose registers each service name (and any aliases) in the network's DNS, so the names resolve to whichever container currently backs that service (surviving restarts that change IPs). This is **the** big convenience over raw `docker run`, where you'd have to create a network and manage names yourself. It's also why you configure connection strings with service names, not `localhost` — `localhost` inside a container is the container itself, not its neighbours.

### Q7. What is the project name and how does it namespace things?

Compose groups everything it creates under a **project**, and the project name **prefixes** all resource names. By default the project name is the **directory** the Compose file lives in (lowercased). So a `web` service in a `myapp/` folder becomes container `myapp-web-1`, on network `myapp_default`, with volume `myapp_dbdata`.

```bash
docker compose -p acme up -d        # explicit project name "acme"
COMPOSE_PROJECT_NAME=acme docker compose up -d
```

Why it matters:

- **Isolation** — you can run the **same** Compose file twice under different project names (`-p staging`, `-p test`) and get two independent stacks that don't collide.
- **Cleanup** — `docker compose down` only touches *this project's* resources, keyed by the name.
- **Gotcha** — rename the directory and Compose thinks it's a *new* project, "losing" the old containers/volumes (they still exist under the old prefix). Pin `COMPOSE_PROJECT_NAME` if you need stability.

### Q8. When do you use `build:` vs `image:` in a service?

- **`image:`** — pull a **prebuilt** image from a registry. Use for off-the-shelf dependencies (Postgres, Redis, nginx) and for deploying an image your CI already built and pushed.
- **`build:`** — **build** the image locally from a Dockerfile as part of `compose up`/`build`. Use for **your own** application code during development.

```yaml
services:
  db:
    image: postgres:16          # pull it
  api:
    build:                      # build it from source
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
      target: runtime           # stop at a specific multi-stage target
```

You can specify both `build` and `image` together — Compose then builds and **tags** the result with that image name (useful so you can later push it). The `build` block supports `context` (the build directory), `dockerfile` (a non-default filename), `args` (build-time `ARG`s), and `target` (which multi-stage stage to stop at). Rule: **`image` for dependencies, `build` for your code** during dev.

### Q9. How does port mapping work in Compose — `ports` vs `expose`?

```yaml
services:
  web:
    ports:
      - "8080:80"          # host:container — reachable from the host at :8080
      - "127.0.0.1:5432:5432"  # bind to loopback only (hardening)
  internal:
    expose:
      - "9000"             # metadata only; NOT published to the host
```

- **`ports:`** publishes to the **host** — it installs the DNAT mapping so `host:8080` reaches the container. This is how *you* (or the outside world) reach the service.
- **`expose:`** is **documentation only** — it does not open a host port. It's redundant for service-to-service traffic, because services on the Compose network can already reach **any** port on each other regardless of `expose`.

The practical implication: you only need `ports:` for services that must be reachable **from outside the Compose network** (your web frontend). Backend services like the database usually need **no** `ports:` at all — the `web` service reaches `db:5432` over the internal network, and *not* publishing the DB port keeps it off the host, which is more secure. Publishing a database port to the host is a common, avoidable exposure.

### Q10. How do environment variables and the `.env` file work in Compose?

Two distinct mechanisms people conflate:

**1. Variables passed into containers** — `environment:` (inline) or `env_file:` (from a file):

```yaml
services:
  api:
    environment:
      - LOG_LEVEL=debug
    env_file:
      - ./api.env          # KEY=VALUE lines injected into the container
```

**2. Interpolation into the Compose file itself** — Compose reads a file named **`.env`** in the project directory and substitutes `${VAR}` in the YAML **before** running:

```yaml
services:
  db:
    image: postgres:${PG_VERSION:-16}    # from .env, default 16
    ports:
      - "${DB_PORT}:5432"
```

```bash
# .env
PG_VERSION=16
DB_PORT=5432
```

The `${VAR:-default}` syntax supplies a fallback. The trap: **`.env` interpolates the file; `env_file:` injects into the container** — they're not the same. And `.env` is only auto-loaded for interpolation, not automatically passed into containers unless you reference it. Never commit secrets in `.env` for a public repo.

### Q11. How do you define and use named volumes in Compose?

Declare them under the top-level `volumes:` key, then reference them from services:

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - dbdata:/var/lib/postgresql/data   # named volume -> persistent
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro  # bind mount

volumes:
  dbdata:                                  # Compose manages this (namespaced)
```

The named volume `dbdata` becomes `<project>_dbdata` and **persists across `up`/`down`** — your database survives recreating the container. That's exactly what you want for stateful services. Bind mounts (`./init.sql:...`) point at host paths, used here to seed init scripts or mount source in dev.

Two things to remember: (1) named volumes **survive `docker compose down`** but are **removed by `down -v`** — so `down -v` is the "wipe my database and start fresh" command (and a data-loss risk if you fat-finger it). (2) You can point a Compose volume at an external/driver-backed volume with `external: true` or a `driver:` block for NFS/cloud storage.

### Q12. `depends_on` — what does it actually guarantee, and what's the classic trap?

The trap: **`depends_on` only waits for the dependency container to *start*, not to be *ready*.** So this looks correct but races:

```yaml
services:
  api:
    build: .
    depends_on:
      - db          # waits for db to START, not to accept connections
  db:
    image: postgres:16
```

Postgres takes a few seconds to initialize after its container starts. `api` starts the instant the `db` **container** is up — often *before* Postgres accepts connections — so `api` crashes on its first query. This is the single most common Compose bug.

The proper fix is a **healthcheck condition**:

```yaml
services:
  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5
  api:
    build: .
    depends_on:
      db:
        condition: service_healthy   # now waits for db to be READY
```

Even better, make the app **resilient**: retry the DB connection with backoff on startup, so it doesn't depend on perfect ordering at all. Interviewers love this one because it separates "used Compose" from "debugged Compose in anger."

### Q13. What happens on `docker compose up` after you change something? Describe the rebuild/recreate behavior.

Compose is **declarative and idempotent**: `up` reconciles running containers to the file, changing only what differs.

- **Change env/ports/volumes/command** in the file → Compose **recreates** the affected container(s) with the new config; untouched services are left running.
- **Change your Dockerfile or source** → Compose does **not** automatically rebuild by default; the existing image is reused. You need **`up --build`** (or `compose build` first) to pick up code changes. This surprises people: "I edited my code and `up` didn't change anything" — because it reused the cached image.
- **Change nothing** → `up` is a no-op for already-correct services.

```bash
docker compose up -d --build      # rebuild images, then reconcile
docker compose up -d --force-recreate   # recreate even if config unchanged
```

So the mental model: `up` makes reality match the file, recreating containers whose **spec** changed, but it treats the **image** as a given unless you ask it to rebuild. In dev with bind-mounted source and a watching dev server, you often don't need rebuilds; for compiled apps or dependency changes, `--build` is required.

### Q14. How do you override the command a service runs?

Set **`command:`** in the service (overrides the image's `CMD`), or **`entrypoint:`** (overrides `ENTRYPOINT`):

```yaml
services:
  worker:
    image: myapp:1.0
    command: ["python", "worker.py", "--queue", "high"]   # replaces CMD
  debug:
    image: myapp:1.0
    entrypoint: ["/bin/sh"]     # replaces ENTRYPOINT (e.g. to get a shell)
```

`command:` supplies the arguments (or full command) the container runs, exactly like appending a command to `docker run`. Prefer the **exec form** (a YAML list) so signals reach the process directly and it becomes PID 1 cleanly, rather than the shell form which wraps it in `/bin/sh -c`.

For a **one-off** override without editing the file, use `compose run`:

```bash
docker compose run --rm worker python worker.py --once
```

This starts a new container for that service with your command, runs it, and (with `--rm`) removes it — handy for migrations, REPLs, or debugging, distinct from `up` which runs the service's normal command.

### Q15. How do you scale a service to multiple instances?

Two ways:

```bash
# CLI: run N replicas of a service
docker compose up -d --scale worker=3
```

```yaml
# File: deploy.replicas (honored by compose up in recent versions)
services:
  worker:
    image: myapp:1.0
    deploy:
      replicas: 3
```

Compose starts N containers for that service (`project-worker-1/2/3`), all on the same network and load-balanced by the embedded DNS if reached by service name. Caveats:

- **You can't scale a service that publishes a fixed host port** — three containers can't all bind `host:8080`. Either drop the host `ports:` (reach them internally) or use a port range / a reverse proxy in front.
- Scaling in Compose gives you **replicas on one host**, not real orchestration — no rescheduling, no rolling updates, no cross-node spread. It's useful for local load testing or running several workers off a queue, but it is **not** production autoscaling.

For genuine multi-instance production scaling with health-based scheduling, that's **Kubernetes**, not Compose.

### Q16. Why is Compose a development/single-host tool and not a production HA orchestrator?

Compose runs everything on **one host** and does no cluster-level orchestration. It lacks what production HA needs:

- **No multi-node scheduling** — everything lives on the single machine running Compose; if that host dies, the whole app is down. No spreading across nodes.
- **No self-healing/rescheduling** — a restart policy can restart a crashed container *on the same host*, but Compose won't move workloads off a failed node (there are no other nodes).
- **No rolling updates / rollbacks / declarative health-gated deploys** as first-class primitives.
- **No horizontal autoscaling**, no service mesh, no built-in secrets/RBAC at cluster scale.

That's precisely what **Kubernetes** (or Nomad/ECS) provides: a control plane scheduling containers across many nodes, restarting and rescheduling them, doing rolling updates, and scaling on demand. Compose's sweet spot is **local development and CI**: stand up your whole app's stack on your laptop or a build agent, identically and repeatably, in seconds. Use it there; graduate to an orchestrator for production. (Docker Swarm reuses Compose file syntax for multi-host, but Kubernetes won the production race.)

### Q17. Write a complete Compose file for a web app with a database and a cache.

```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:80"                    # only the web tier is published
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@db:5432/appdb
      REDIS_URL: redis://cache:6379
    depends_on:
      db:
        condition: service_healthy   # wait for readiness, not just start
      cache:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: appdb
    volumes:
      - dbdata:/var/lib/postgresql/data   # persist the database
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d appdb"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  cache:
    image: redis:7
    restart: unless-stopped

volumes:
  dbdata:
```

What this demonstrates: **`web`** is built from source and is the **only** service publishing a host port; it reaches **`db`** and **`cache`** by **service name** over the implicit network. **`depends_on` with `condition: service_healthy`** avoids the readiness race. The database uses a **named volume** so data survives `down`, plus a **HEALTHCHECK** so dependents wait correctly. Secrets come from a **`.env`** file via `${DB_PASSWORD}` interpolation (never hardcoded, never committed). `restart: unless-stopped` keeps services up across daemon restarts. Bring it up with `docker compose up -d --build`; tear it down keeping data with `docker compose down`, or wipe everything with `docker compose down -v`.
## Compose in Depth

### Summary

**What this topic covers**

Compose beyond the first `docker compose up` — the parts that separate someone who scaffolded a tutorial from someone who runs a real multi-service stack. This topic has 16 questions covering: **service dependency and startup ordering** (`depends_on` with `condition: service_healthy` vs the old `wait-for-it`/`dockerize` scripts), **healthchecks** in a compose service, **profiles** for opt-in services, **multiple compose files and overrides** (the auto-merge of `docker-compose.override.yml`, and `-f base.yml -f prod.yml` layering), **environment management** (the `.env` file, `${VAR:-default}` interpolation, `env_file` vs `environment`, precedence), **DRY techniques** (`extends`, YAML anchors/aliases), **dev vs prod** patterns (bind-mounting source + live reload vs baked images), **scaling/resource limits** (`--scale`, the `deploy` key and why plain compose ignores most of it), networks and volumes in depth, restart policies, `docker compose config`, `run` vs `exec`, secrets, `container_name` pitfalls, and `compose watch`.

**Mental model**

Think of Compose as a **declarative front-end over the same `docker run` you'd type by hand** — every key maps to a flag or an API field. A `compose.yaml` describes a *desired state* for a set of services on one host: their images, env, ports, mounts, networks, and dependencies. Compose is a **single-host** orchestrator — it is superb for local dev and small deployments, and deliberately limited in production (no rescheduling, no rolling updates across nodes, no self-healing beyond `restart:`). The two ideas that trip people up: (1) **`depends_on` orders *start*, not *readiness*** — the container being "up" says nothing about the app inside being able to serve traffic, so you either gate on a healthcheck or make the app retry; (2) **compose files *merge*** — a base file plus overrides combine field-by-field, which is how you keep one source of truth and vary it per environment. Everything else — profiles, anchors, `config` — is machinery for keeping that one desired-state document DRY and environment-aware.

**Key terms**

- **service** — one container definition (image, ports, env, mounts); the unit compose manages.
- **`depends_on`** — declares start-order between services; only waits for *readiness* when paired with `condition: service_healthy`.
- **healthcheck** — a `test` command compose runs periodically to compute a service's `healthy`/`unhealthy` status.
- **profile** — a label that makes a service opt-in; it only starts when its profile is activated with `--profile`.
- **override file** — `docker-compose.override.yml`, auto-merged on top of the base file unless you pass explicit `-f` flags.
- **`.env` file** — key/value file compose reads for `${VAR}` interpolation *in the YAML itself* (host-side).
- **`env_file`** — a file whose vars are injected *into the container's* environment.
- **anchor/alias** — YAML `&name` / `*name` for reusing a block within one file; `<<:` merges a mapping.
- **`extends`** — compose-native reuse of a service block, across files.
- **`deploy` key** — Swarm-oriented config (replicas, resource limits); mostly ignored by plain `docker compose`.
- **`compose watch`** — dev feature that syncs source or rebuilds on file change.
- **`docker compose config`** — renders the fully-merged, interpolated, effective configuration.

**Why interviewers ask this**

Compose is where DevOps candidates reveal whether they've actually operated a stack or only followed a README. The junior answer to "my app starts before the DB is ready" is "add `depends_on`" — which is *wrong* and the interviewer knows it. The senior answer distinguishes start-order from readiness, reaches for `condition: service_healthy` *and* argues app-level retries are the more robust fix. Similarly, "how do you configure the same stack for dev and prod?" separates people who copy-paste two YAML files from people who use override files, profiles, and `.env` interpolation to keep one source of truth. Interviewers also probe the **limits** of compose — a candidate who thinks `deploy.replicas: 3` scales in plain compose, or who sets `container_name` and then can't scale, hasn't shipped it. It's a proxy for "can I hand you a `compose.yaml` and trust it in CI and staging."

**Common confusions**

- "`depends_on` waits for the database to be ready" — no, it waits for the container to *start*. Add `condition: service_healthy` (with a healthcheck) for readiness.
- "`deploy.replicas` scales my services" — only under Swarm. Plain `docker compose` ignores `deploy` except a few keys; use `--scale` or `deploy` via the Swarm/`docker stack` path.
- "`environment` and `env_file` are the same" — `environment` is inline in YAML (and wins on precedence); `env_file` points at a file. Both set *container* env, distinct from the host-side `.env` used for `${VAR}` interpolation.
- "`.env` variables are available inside my container" — the root `.env` is for interpolating the compose file itself. Use `environment`/`env_file` to reach the container.
- "Setting `container_name` is good practice" — it prevents scaling (two containers can't share one name) and breaks in CI where names collide.
- "Compose is a production orchestrator" — it's single-host with no rescheduling; for multi-node use Swarm or Kubernetes.

**What follows from this topic**

Healthchecks reappear in **Container Resource Management & Runtime** (how health status is computed and used by orchestrators). The readiness discussion connects to networking (a user-defined bridge gives DNS between services). Resource limits in the `deploy` key foreshadow the cgroup limits topic. And the "compose isn't a real orchestrator" caveat is the on-ramp to Kubernetes — `kompose` gives a preview, but the model shift (declarative reconciliation, self-healing) is the reason the Kubernetes primer exists.

### Q1. My app container crashes on startup because the database isn't ready yet. Does `depends_on` fix this?

Not by itself. Plain `depends_on` only controls **start order** — it waits until the DB container has *started*, not until Postgres inside it is accepting connections. The container can be "up" while the database is still running its init scripts, so your app races ahead and crashes.

The correct compose-level fix is `depends_on` with a **condition** tied to a **healthcheck**:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
  app:
    image: myregistry/app:1.2.3
    depends_on:
      db:
        condition: service_healthy
```

Now `app` won't start until `db` reports `healthy`. This replaces the old `wait-for-it.sh` / `dockerize` wrapper scripts that polled the DB port before exec'ing the app.

That said, the **most robust** fix is app-level: your app should retry its DB connection with backoff on startup, because databases also disappear *after* startup (restarts, failovers) and `depends_on` does nothing for that. `depends_on` is a dev-convenience; connection retry is production-grade.

### Q2. How do you define a healthcheck in a Compose service, and what do the fields mean?

Under a service's `healthcheck` key:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
  interval: 30s      # time between checks
  timeout: 5s        # a check taking longer than this counts as a failure
  retries: 3         # consecutive failures before status flips to "unhealthy"
  start_period: 40s  # grace window at boot; failures here don't count toward retries
```

Field meanings:

- **`test`** — the command. `["CMD", ...]` runs it directly; `["CMD-SHELL", "..."]` runs via the shell (so you can use pipes/`$`). `["NONE"]` disables a healthcheck inherited from the image.
- **`interval`** — how often the check runs once the container is up.
- **`timeout`** — a single check that exceeds this is a failure.
- **`retries`** — how many consecutive failures flip the status to `unhealthy`.
- **`start_period`** — a startup grace period (added in modern Docker): failing checks during it don't count, but a *passing* check immediately marks the container healthy. Essential for slow-booting apps (JVMs, migrations).

The computed status (`starting` → `healthy`/`unhealthy`) is what `depends_on: condition: service_healthy` and orchestrators consume. Use a check the app actually serves (an HTTP endpoint or `pg_isready`), not just "is the port open."

### Q3. What are Compose profiles and when would you use them?

**Profiles** make services **opt-in**. A service tagged with one or more profiles does *not* start on a plain `docker compose up` — only when you activate its profile.

```yaml
services:
  app:
    image: myregistry/app:1.2.3      # always starts (no profile)
  db:
    image: postgres:16               # always starts
  pgadmin:
    image: dpage/pgadmin4
    profiles: ["debug"]              # only with --profile debug
  loadtest:
    image: myregistry/k6:latest
    profiles: ["tools"]
```

- `docker compose up` → starts `app` + `db` only.
- `docker compose --profile debug up` → also starts `pgadmin`.
- `COMPOSE_PROFILES=debug,tools docker compose up` → activates both via env.

Use profiles for **optional tooling** — admin UIs, seed/migration jobs, load-test runners, a mock third-party service — that you want in the same file but not running by default. It keeps one compose file for the whole team instead of a proliferation of `docker-compose.debug.yml` variants. Note: if a service with a profile is named as a `depends_on` target of an active service, it gets pulled in automatically.

### Q4. How do multiple Compose files merge? Explain override files and `-f` layering.

Two mechanisms:

**Automatic override.** If both `docker-compose.yml` (or `compose.yaml`) and `docker-compose.override.yml` exist, `docker compose` reads them and **merges override on top of base** automatically. Convention: base holds the shared definition; the override holds local-dev tweaks (bind mounts, exposed ports, dev env). The override is often git-ignored or dev-only.

**Explicit `-f` layering.** You can pass multiple files; later files merge over earlier ones:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

Merge semantics matter:

- **Scalars** (image, single values) — later file **replaces** earlier.
- **Mappings** (`environment`, `labels`) — **merged** key by key; later keys win.
- **Sequences** (`ports`, `volumes`, `command` args) — **appended/replaced** depending on key; historically lists like `ports` are concatenated, so watch for duplicates.

The pattern: a neutral base, plus `compose.prod.yaml` that swaps `build:` for a pinned `image:`, drops dev bind mounts, adds resource limits and `restart: always`. Run `docker compose -f ... -f ... config` to see exactly what the merge produced before you trust it.

### Q5. Explain environment variable handling: `.env`, `${VAR:-default}`, `env_file`, and `environment`.

There are **two distinct layers**, and conflating them is a classic mistake:

**Host-side interpolation (the root `.env`).** Compose reads a `.env` file next to the compose file and substitutes `${VAR}` *in the YAML itself* before parsing:

```yaml
services:
  app:
    image: myregistry/app:${APP_TAG:-latest}   # :-default if unset/empty
    ports:
      - "${HOST_PORT:-8080}:8080"
```

Interpolation forms: `${VAR}` (empty if unset), `${VAR:-default}` (default if unset **or** empty), `${VAR-default}` (default only if unset), `${VAR:?err}` (fail with message if unset).

**Container-side environment.** What the process inside the container sees:

```yaml
    environment:
      - NODE_ENV=production
      - DB_HOST=db
    env_file:
      - .env.app          # a file of KEY=VALUE lines injected into the container
```

**Precedence (container env), highest first:** `environment` in the compose file → `env_file` → the image's baked `ENV`. And shell/host env can feed the `${VAR}` interpolation. Keep them straight: the root `.env` configures *the compose file*; `env_file`/`environment` configure *the container*.

### Q6. How do you keep a Compose file DRY with `extends` and YAML anchors?

Two tools:

**YAML anchors/aliases** (pure YAML, single file):

```yaml
x-common: &common
  restart: unless-stopped
  networks: [backend]
  logging:
    driver: json-file
    options: { max-size: "10m", max-file: "3" }

services:
  api:
    <<: *common           # merge the anchored mapping
    image: myregistry/api:1.0.0
  worker:
    <<: *common
    image: myregistry/worker:1.0.0
```

`&common` defines an anchor, `*common` references it, and `<<:` merges it into the mapping. The `x-` prefix marks a custom top-level extension block compose ignores as a service.

**`extends`** (compose-native, works across files):

```yaml
services:
  api:
    extends:
      file: common-service.yaml
      service: base
    image: myregistry/api:1.0.0
```

`extends` is more surgical (inherit one service, override fields) and can pull from another file, but it does **not** merge `depends_on`, `volumes_from`, or networks — those are intentionally not inherited. Anchors are simpler for within-file repetition (shared logging/restart/labels); `extends` is better for a shared service template across projects. Don't over-engineer — a little repetition beats an unreadable anchor soup.

### Q7. How does a dev Compose setup differ from a production one?

They optimize for opposite things.

**Dev** — fast feedback, source on the host:

```yaml
services:
  app:
    build: .                     # build locally
    volumes:
      - ./src:/app/src           # bind-mount source for live edits
    environment:
      NODE_ENV: development
    command: npm run dev         # watcher / hot reload
    ports:
      - "8080:8080"
```

**Prod** — reproducible, immutable, hardened:

```yaml
services:
  app:
    image: myregistry/app:1.2.3  # pinned, pre-built image; no bind mount
    environment:
      NODE_ENV: production
    restart: always
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }
    read_only: true
```

Key differences: dev **bind-mounts source** and runs a reloader; prod **bakes the code into the image** and pins a tag/digest. Dev exposes ports freely; prod locks them down. Prod adds `restart:`, resource limits, read-only FS, non-root user, dropped capabilities.

The usual implementation is base + override: `compose.yaml` (neutral) + `compose.override.yml` (dev) auto-merged locally, and `-f compose.yaml -f compose.prod.yml` in prod. **Caveat:** plain compose in production is limited (single host, no rolling updates, no self-healing) — many teams use compose for dev and Kubernetes/Swarm for prod.

### Q8. Can Compose scale services? Explain `--scale`, `replicas`, and the `deploy` key.

Yes, but with sharp caveats.

**`--scale` (plain compose, single host):**

```bash
docker compose up -d --scale worker=4
```

runs 4 instances of `worker` on this host. Requirements: the service must **not** set `container_name` (names would collide) and must not `-p` a fixed host port to a single container port (port conflicts) — publish a range or let the load balancer/reverse proxy handle it.

**The `deploy` key** is Swarm-oriented:

```yaml
services:
  worker:
    image: myregistry/worker:1.0.0
    deploy:
      replicas: 3
      resources:
        limits: { cpus: "0.5", memory: 256M }
      restart_policy:
        condition: on-failure
```

Under `docker stack deploy` (Swarm), `deploy.replicas` schedules 3 tasks. Under plain `docker compose up`, **`deploy.replicas` is ignored** — you must use `--scale`. Some `deploy` sub-keys (`resources.limits`) *are* honored by recent compose, but treat `deploy` as "for Swarm" unless you've verified otherwise.

Bottom line: for real horizontal scaling with scheduling, health-based rescheduling, and rolling updates, you want Swarm or Kubernetes. `--scale` is a single-host convenience.

### Q9. How do you set CPU and memory limits in Compose?

Two paths, and which works depends on your compose version/mode.

**Modern `deploy.resources`** (honored by recent `docker compose`, and by Swarm):

```yaml
services:
  app:
    image: myregistry/app:1.2.3
    deploy:
      resources:
        limits:            # hard ceiling
          cpus: "1.5"
          memory: 512M
        reservations:      # soft guarantee / scheduling hint
          cpus: "0.5"
          memory: 256M
```

**Legacy top-level keys** (older compose v2 file format, always honored by plain compose):

```yaml
services:
  app:
    image: myregistry/app:1.2.3
    mem_limit: 512m
    memswap_limit: 512m
    cpus: 1.5
    cpu_shares: 512
```

`limits` map to cgroup hard caps: exceeding **memory** gets the process OOM-killed (exit 137); **CPU** is throttled, not killed. `reservations` are soft — a scheduling hint under Swarm, not an enforced floor on a single host.

Practical advice: **always set at least a memory limit** in shared environments to contain the noisy-neighbor problem, and verify with `docker stats`. Confirm your compose version actually applies `deploy.resources` on plain `up` (it has historically been a point of confusion) — if unsure, use the legacy keys or test with `docker inspect`.

### Q10. Explain networks in Compose: default network, custom networks, aliases, and external networks.

By default, Compose creates **one network per project** and attaches every service to it. On that user-defined bridge, services reach each other by **service name** (built-in DNS) — `app` connects to `db:5432` with no `links` needed.

Custom networks let you segment:

```yaml
services:
  proxy:
    image: nginx
    networks: [frontend]
  app:
    image: myregistry/app:1.2.3
    networks: [frontend, backend]
  db:
    image: postgres:16
    networks: [backend]          # not reachable from proxy
networks:
  frontend:
  backend:
```

Here the DB sits only on `backend`, so `proxy` can't reach it — a simple isolation tier.

**Aliases** give a service extra DNS names on a network:

```yaml
    networks:
      backend:
        aliases: [database, primary-db]
```

**External networks** attach to a network created outside this compose project:

```yaml
networks:
  shared:
    external: true      # must already exist; compose won't create/remove it
```

Use `external: true` to join a network another stack owns (e.g. a shared reverse proxy). Without it, compose creates and tears down the network with the project.

### Q11. Explain volumes in Compose: named, bind, and external.

Three mount types plus the `external` flag.

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - db-data:/var/lib/postgresql/data   # named volume (Docker-managed)
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro  # bind mount (host path)
      - type: tmpfs                        # tmpfs (in memory)
        target: /tmp
volumes:
  db-data:                                 # declared named volume
```

- **Named volume** (`db-data:/path`) — Docker manages storage under `/var/lib/docker/volumes`. Preferred for persistent data (databases); survives `down` unless you pass `-v`, portable, backup-friendly.
- **Bind mount** (`./host/path:/container/path`) — maps a host directory in. Great for dev (live source, config files, init scripts). Path is host-specific and non-portable; can clobber container contents.
- **tmpfs** — RAM-backed, wiped on stop. For secrets/scratch you don't want on disk.

**External volumes** reference a volume created outside the project:

```yaml
volumes:
  db-data:
    external: true      # must pre-exist; compose won't create or delete it
```

`external: true` protects shared/production data — compose won't accidentally delete it on `down -v`. Gotcha: `docker compose down` keeps named volumes; `docker compose down -v` **deletes** them. Never run `-v` casually against a stack holding real data.

### Q12. What restart policies are available in Compose and how do they differ?

Set per service with `restart:` (or `deploy.restart_policy` under Swarm):

```yaml
services:
  app:
    image: myregistry/app:1.2.3
    restart: unless-stopped
```

| Policy | Restarts on crash? | Restarts on daemon/boot restart? | Notes |
|---|---|---|---|
| `no` (default) | No | No | Container stays dead |
| `always` | Yes | Yes — even if you manually stopped it | Comes back on `dockerd` restart regardless |
| `on-failure[:N]` | Only non-zero exit | Yes, if previously failing | Optional max retry count `on-failure:5` |
| `unless-stopped` | Yes | Yes, **unless** you explicitly stopped it | Like `always` but respects a manual stop |

Practical guidance: **`unless-stopped`** is the sensible default for long-running services — it self-heals on crashes and host reboots but honors a deliberate `docker stop`. Use **`on-failure`** for jobs that should retry only on error and stay down on clean exit (`exit 0`). Avoid `always` if you ever want a manual stop to stick. Docker applies an increasing backoff delay between restart attempts to avoid crash-loop hammering. Note restart policies don't count healthchecks — an `unhealthy` container isn't restarted by compose (that's an orchestrator behavior); restart policies react to the process *exiting*.

### Q13. What does `docker compose config` do and why is it useful?

It renders the **fully-resolved, effective configuration** — after merging all `-f` files and the override, interpolating every `${VAR}` from `.env`/the shell, and applying defaults — and prints the canonical YAML without starting anything.

```bash
docker compose -f compose.yaml -f compose.prod.yaml config
```

Why it's indispensable:

- **See the actual merge.** When you layer base + prod files, list-vs-map merge semantics are subtle. `config` shows exactly what compose will act on.
- **Catch interpolation bugs.** A missing `.env` var silently becomes empty and breaks a port or image tag. `config` surfaces it (and `${VAR:?}` makes it fail loudly).
- **Validate before deploy.** Non-zero exit + error message on invalid YAML/schema — perfect as a CI lint step.
- **Variants:** `config --services` lists service names, `config --volumes` lists volumes, `config --images` lists resolved image refs, `config --hash` helps detect config drift.

Treat `docker compose config` as the "explain plan" of compose: never trust a multi-file, heavily-interpolated stack in CI or staging without running it first.

### Q14. What's the difference between `docker compose run` and `docker compose exec`?

They both run a command against your stack, but at different times and on different containers.

**`docker compose run <service> <cmd>`** starts a **new, one-off container** from the service's definition:

```bash
docker compose run --rm app npm run migrate
```

Used for one-shot tasks — migrations, seeds, a REPL, tests — that need the service's image/env/networks but shouldn't touch the running instance. It does **not** publish the service's ports by default (add `--service-ports` if needed) and doesn't run `depends_on` unless required. `--rm` cleans up the throwaway container.

**`docker compose exec <service> <cmd>`** runs a command **inside the already-running container**:

```bash
docker compose exec db psql -U postgres
```

Used for interacting with a live service — opening a shell, inspecting state, tailing something. The service must already be `up`.

Rule of thumb: **`run` = spawn a fresh container for a task; `exec` = attach into a live one.** Migrations at deploy time → `run` (the app container may not be up yet, or you want isolation). Debugging a running service → `exec`.

### Q15. How do secrets and configs work in Compose, and how is that better than environment variables?

Compose supports `secrets` and `configs` that mount as **files** into the container rather than exposing values via environment:

```yaml
services:
  app:
    image: myregistry/app:1.2.3
    secrets:
      - db_password        # mounted at /run/secrets/db_password
    configs:
      - source: app_config
        target: /etc/app/config.yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt   # or external: true (Swarm-managed)
configs:
  app_config:
    file: ./config.yaml
```

The app reads `/run/secrets/db_password` (many images support a `_FILE` convention, e.g. `POSTGRES_PASSWORD_FILE`).

Why this beats `environment: DB_PASSWORD=...`:

- **Env vars leak.** They show up in `docker inspect`, in `/proc/<pid>/environ`, in child processes, in crash dumps, and often in logs. A mounted secret file is scoped and not dumped by `inspect`.
- **File permissions** can restrict access; env is inherited by every subprocess.
- **Under Swarm**, `external: true` secrets are stored encrypted in the raft log and delivered in-memory (`tmpfs`), never on the node's disk.

For plain single-host compose, file-based secrets are still an improvement over `-e`, but the strongest story (encryption at rest, rotation) needs Swarm secrets or an external secrets manager.

### Q16. Why is setting `container_name` a pitfall, and what is Compose `watch` mode?

**The `container_name` pitfall.** Explicitly naming a container:

```yaml
services:
  worker:
    image: myregistry/worker:1.0.0
    container_name: worker   # BAD for anything you might scale
```

pins the container to a fixed name. That breaks in two ways: (1) you **can't scale** — `docker compose up --scale worker=3` fails because three containers can't share the name `worker`; (2) parallel CI runs or a second project **collide** on the global name. Let compose auto-generate names (`project-worker-1`, `-2`, …) and reach services by **service name** via DNS instead. Only set `container_name` for a genuine singleton you must reference by a stable name from outside compose — rare.

**Compose `watch`.** A dev feature (`docker compose watch` / `develop.watch`) that reacts to source changes without a manual rebuild:

```yaml
services:
  app:
    build: .
    develop:
      watch:
        - action: sync            # copy changed files into the container
          path: ./src
          target: /app/src
        - action: rebuild         # rebuild the image on dependency changes
          path: package.json
```

`sync` pushes edited files into the running container (fast, for hot-reloading apps); `rebuild` triggers a fresh build when manifests change. It's a cleaner alternative to bind-mounting everything, giving near-instant feedback while keeping the image the source of truth. Dev-only — never in prod.

## Container Resource Management & Runtime

### Summary

**What this topic covers**

How a container is bounded and observed at runtime — the cgroup limits, the runtime awareness gotchas, and the operational tooling. This topic has 16 questions covering: **memory limits** (`--memory`/`-m`, the OOM kill, exit code 137, `--memory-swap`, `--memory-reservation`, the danger of `--oom-kill-disable`), **CPU limits** (`--cpus`, `--cpu-shares`, `--cpuset-cpus`, throttling vs killing), how these map to **cgroups v2**, the **noisy-neighbor** problem, the **runtime-awareness gotcha** (JVM/Node seeing host resources instead of the cgroup limit), **OOMKilled diagnosis**, **restart policies** and backoff at runtime, **HEALTHCHECK** and how health is computed, **logging drivers** and the unbounded-disk problem, log rotation, **ulimits** (the "too many open files" fix), `pids-limit` (fork bombs), `docker stats`/`docker top`/`docker events` for live introspection, **tmpfs/`--shm-size`** (the Chrome/Postgres gotcha), `--init`, and stop timeouts.

**Mental model**

A container is **just a host process** wearing three costumes: namespaces (what it can *see*), a union filesystem (what it *reads/writes*), and **cgroups** (what it can *consume*). Resource management is entirely the cgroups costume. The single most important distinction: **memory is a hard wall, CPU is a rubber band.** Blow past the memory limit and the kernel's OOM killer terminates your process — instantly, exit 137, no negotiation. Blow past the CPU limit and the kernel simply *throttles* you — the process runs slower but never dies. That asymmetry drives everything: memory limits must be sized with real headroom or you get mysterious 137s; CPU limits are safer to set aggressively because the failure mode is latency, not death. The second big idea: **a limit is only useful if the software inside knows about it.** For years the JVM and Node.js read `/proc/meminfo` and saw the *host's* RAM, sized their heaps for that, and got OOM-killed inside a small cgroup. Modern runtimes read the cgroup — but you must verify. Everything else — logging drivers, ulimits, `--shm-size`, `docker stats` — is about not letting a container quietly exhaust a shared host resource, and being able to *see* it when it does.

**Key terms**

- **cgroup (control group)** — the kernel mechanism that limits/accounts a process group's CPU, memory, PIDs, IO; cgroups v2 is the unified hierarchy on modern hosts.
- **`--memory` / `-m`** — hard memory ceiling; exceeding it triggers the OOM killer.
- **exit 137** — 128 + signal 9 (SIGKILL); the fingerprint of an OOM kill (or a forced kill).
- **`--memory-swap`** — total memory + swap; set equal to `--memory` to forbid swap.
- **`--memory-reservation`** — a *soft* limit honored under host memory pressure.
- **`--cpus`** — fractional CPU quota via the CFS scheduler (`--cpus=1.5` = 1.5 cores' worth).
- **`--cpu-shares`** — *relative* weight, only matters under contention.
- **`--cpuset-cpus`** — pin the container to specific physical cores.
- **OOMKilled** — the `State.OOMKilled=true` flag on a container the kernel killed for memory.
- **HEALTHCHECK** — a periodic probe defining `healthy`/`unhealthy`; distinct from a restart-triggering liveness check.
- **logging driver** — where stdout/stderr go (`json-file` default, `local`, `journald`, `syslog`, `fluentd`, `awslogs`).
- **ulimit** — per-process kernel resource limit (e.g. `nofile` open file descriptors).
- **`--shm-size`** — size of `/dev/shm` (shared memory); default 64MB bites Chrome/Postgres.

**Why interviewers ask this**

This is the topic that separates "I can run a container" from "I can run containers *in production without 3am pages*." Interviewers love the OOMKilled scenario because it's ubiquitous and has a precise answer chain: symptom (exit 137, container restarts) → diagnosis (`docker inspect .State.OOMKilled`, `dmesg`) → root cause (limit too low **or** runtime not cgroup-aware) → fix. A senior candidate names the JVM/Node awareness gotcha unprompted — it's the single most common "why does my perfectly-sized container die" story. They also probe operational hygiene: unbounded `json-file` logs filling the disk is a real outage many teams have suffered, and `--shm-size` breaking headless Chrome is a rite of passage. Getting these right signals you've been on call for containers, not just deployed them once.

**Common confusions**

- "The container crashed, must be a bug" — exit 137 usually means the **kernel OOM-killed** it for exceeding the memory limit, not an app crash.
- "CPU limits kill the container" — no, CPU is **throttled**; only memory limits cause kills.
- "I set `-m 512m`, so the JVM will use 512MB" — only if the runtime is cgroup-aware. Old JVMs saw host RAM, sized the heap for that, and got OOM-killed.
- "Docker rotates my logs" — the default `json-file` driver grows **unbounded** unless you set `max-size`/`max-file`.
- "`docker logs` always works" — only with `json-file`/`local` drivers; with `syslog`/`fluentd`/`awslogs` the CLI can't read them back.
- "`--cpu-shares` limits CPU" — it's a *relative weight* that only matters under contention; it's not a cap. Use `--cpus` for a cap.
- "Reservation guarantees memory" — `--memory-reservation` is soft; only `--memory` is a hard enforced ceiling.

**What follows from this topic**

Memory/CPU limits are exactly what the `deploy.resources` and `mem_limit` keys in **Compose in Depth** configure declaratively. HEALTHCHECK here is the same status that Compose's `condition: service_healthy` consumes. The cgroup model and OOM behavior scale directly into Kubernetes requests/limits (a "reservation" is a *request*, a "limit" is a *limit*, and OOMKilled looks identical). And the noisy-neighbor / isolation discussion sets up **Container Security** — cgroups bound *consumption*, but they are not a security boundary; a shared kernel is.

### Q1. A container keeps dying with exit code 137. What's happening and how do you confirm it?

Exit **137 = 128 + 9**, i.e. the process received **SIGKILL**. In a container context the overwhelmingly common cause is the **kernel OOM killer** terminating the process for exceeding its memory cgroup limit.

Confirm it:

```bash
docker inspect <container> --format '{{.State.OOMKilled}}'   # -> true if OOM-killed
docker inspect <container> --format '{{.State.ExitCode}}'     # -> 137
dmesg | grep -i -E 'oom|killed process'                        # kernel OOM log on the host
```

`State.OOMKilled: true` is the smoking gun — the kernel, not your app, killed it. `dmesg` shows the OOM event with the process and the cgroup's memory usage.

Two root causes, and the fix differs:

1. **Limit genuinely too low** — the app legitimately needs more than `--memory`. Raise the limit (after measuring with `docker stats`), or reduce the app's footprint.
2. **Runtime not cgroup-aware** — the app sized itself for the *host's* RAM (classic old-JVM/Node problem), so it tries to use far more than the cgroup allows and gets killed. Fix by using a cgroup-aware runtime or explicitly capping the heap (`-XX:MaxRAMPercentage`, `--max-old-space-size`).

Note: not *every* 137 is OOM — a forced `docker kill` or an orchestrator SIGKILL after a failed graceful stop also yields 137. Check `OOMKilled` to disambiguate.

### Q2. Explain Docker's memory limit flags: `-m`, `--memory-swap`, `--memory-reservation`, `--oom-kill-disable`.

```bash
docker run -m 512m --memory-swap 512m --memory-reservation 256m myapp
```

- **`-m` / `--memory`** — the **hard limit** on RAM. Cross it and the container's processes are OOM-killed. This is the one that matters.
- **`--memory-swap`** — the limit on **memory + swap combined**. If `--memory-swap` equals `--memory`, the container gets **no swap** (recommended for predictable perf — swapping a container is usually a pathology). If unset, it defaults to 2× memory; `-1` allows unlimited swap.
- **`--memory-reservation`** — a **soft limit**. Not enforced normally; when the *host* is under memory pressure the kernel tries to shrink containers toward their reservation. Use it as a "target" while `-m` is the "ceiling." Reservation must be ≤ the hard limit.
- **`--oom-kill-disable`** — disables the OOM killer for the container. **Dangerous:** instead of killing the offending process, the kernel *freezes* it when it hits the limit, and with no memory limit set this can hang the whole host. Almost never use it; if you do, always pair it with a hard `-m`.

Sizing rule: set `-m` with real headroom above steady-state (measured, not guessed), set `--memory-swap` = `-m` to disable swap, and leave `--oom-kill-disable` alone.

### Q3. Explain Docker's CPU limit flags and why CPU limits behave differently from memory limits.

```bash
docker run --cpus=1.5 --cpu-shares=512 --cpuset-cpus=0,1 myapp
```

- **`--cpus=1.5`** — a **hard quota** via the CFS scheduler: the container may use up to 1.5 cores' worth of CPU time per scheduling period. Exceed it and the container is **throttled** (paused until the next period) — never killed.
- **`--cpu-shares`** — a **relative weight** (default 1024) that only matters **under contention**. A container with 512 shares gets half the CPU of one with 1024 *when the CPU is saturated*; when it's idle, either can use everything. It's a priority, not a cap.
- **`--cpuset-cpus=0,1`** — **pins** the container to specific physical cores. Useful for cache locality, NUMA, or isolating latency-sensitive workloads.

The crucial contrast with memory: **CPU is throttled, memory is killed.** There is no such thing as a "CPU OOM" — a CPU-starved container just runs slower and racks up throttled time (visible in cgroup stats as `nr_throttled`). That makes CPU limits *safe to set aggressively* — worst case is added latency. Memory limits are the dangerous ones because the failure mode is sudden death (exit 137). So: cap CPU freely, size memory carefully.

### Q4. How do Docker resource limits map to cgroups (v2)?

Docker doesn't implement limits itself — it configures **cgroups**, a Linux kernel feature that groups processes and meters/limits their resource use. Every container gets its own cgroup; the flags translate to cgroup controller settings.

On **cgroups v2** (the unified hierarchy on modern distros), for a container's cgroup under `/sys/fs/cgroup/...`:

- `-m 512m` → writes `memory.max` (hard limit). `--memory-reservation` → `memory.low` (soft). Swap → `memory.swap.max`.
- `--cpus=1.5` → `cpu.max` = `"150000 100000"` (150ms quota per 100ms period = 1.5 cores).
- `--cpu-shares` → `cpu.weight` (v2 uses a 1–10000 weight scale, remapped from the old shares).
- `--cpuset-cpus` → `cpuset.cpus`.
- `--pids-limit` → `pids.max`.

Accounting lives in the same tree: `memory.current` (live usage), `memory.events` (`oom`/`oom_kill` counters), `cpu.stat` (throttling counts). `docker stats` reads these.

Key points for interviews: v2 is a **single unified hierarchy** (v1 had separate per-controller trees, which caused inconsistencies); the OOM decision is made **per-cgroup** by the kernel, not by Docker; and because it's kernel-level, the limits apply to the process *and all its children*. This is also why a container is *not* a security boundary — cgroups bound resources but the processes still share the host kernel.

### Q5. What is the noisy-neighbor problem and how do resource limits address it?

The **noisy neighbor**: multiple containers share one host's CPU, memory, disk IO, and network. Without limits, one misbehaving container — a memory leak, a runaway batch job, a fork loop — can starve every *other* container on the box, degrading or killing workloads that did nothing wrong. Because containers share the kernel and host resources (unlike VMs with hard-partitioned resources), the blast radius is the whole node.

Limits contain it:

- **Memory limit (`-m`)** — a leaking container hits its own ceiling and gets OOM-killed *in isolation*, instead of consuming all host RAM and triggering a host-wide OOM that kills random victims.
- **CPU limit (`--cpus`)** — a CPU-hungry container is throttled to its quota, leaving cycles for neighbors. `--cpu-shares` sets fair relative priority under contention.
- **`--pids-limit`** — caps process count, so a fork bomb can't exhaust the host PID table.
- **ulimits** — cap per-process file descriptors etc.
- **IO throttling** (`--device-read-bps` etc.) — bounds disk bandwidth.

The senior framing: **always set limits on shared hosts**, and reserve rather than only cap for latency-critical services. Unbounded containers are fine on a laptop and a liability in production. This is exactly what Kubernetes requests/limits formalize per node.

### Q6. Explain the JVM/Node "container awareness" gotcha.

The classic production mystery: you give a container `-m 512m`, the JVM (or Node) inside promptly gets OOM-killed even though the app "isn't doing much." Cause: for years, runtimes read `/proc/meminfo` and `/proc/cpuinfo` to size themselves — and those report the **host's** total RAM and CPU count, **not the cgroup limit**.

So on a 64GB host, an old JVM in a 512MB container saw 64GB, defaulted its max heap to ~16GB (¼ of "available" RAM), sized thread pools and GC threads for many CPUs, and tried to use gigabytes — instantly blowing the 512MB cgroup and getting exit-137'd. Same story for Node's default old-space sizing and libuv thread pool.

The fix, two eras:

- **Old runtimes** — cap explicitly: `-Xmx`/`-XX:MaxRAMPercentage` for the JVM, `--max-old-space-size` for Node, or set `-XX:ActiveProcessorCount`.
- **Modern runtimes** — JVM 10+ (backported to late 8) has **`UseContainerSupport`** (on by default): it reads the cgroup memory/CPU limits and sizes the heap and thread pools to the *container*, not the host. Node.js (recent versions) similarly respects cgroup memory for its heap defaults.

Interview signal: naming this unprompted marks you as someone who's debugged real container OOMs. The takeaway — *the limit only helps if the software inside honors it* — is the whole point of the topic.

### Q7. How do you diagnose an OOMKilled container end to end?

A repeatable chain:

1. **Symptom** — the container restarts repeatedly, or `docker ps -a` shows it Exited (137).
2. **Confirm OOM** — 

```bash
docker inspect <c> --format 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}}'
```

`oom=true` confirms the kernel killed it for memory.

3. **Host-level evidence** —

```bash
dmesg -T | grep -i 'killed process'      # shows the killed PID, RSS, and cgroup
journalctl -k | grep -i oom              # same via journald
```

4. **Watch usage live** to see it climb toward the limit:

```bash
docker stats <c>          # MEM USAGE / LIMIT and MEM %
```

5. **Root-cause it** — two branches:
   - Usage genuinely exceeds a reasonable limit → the app has a **leak** or is under-provisioned. Profile the app; raise `-m` only after understanding steady state.
   - Usage exceeds the limit *right at startup* or the runtime clearly thinks it has more RAM than the cgroup → **container-awareness gotcha**. Cap the heap explicitly or upgrade to a cgroup-aware runtime.

6. **Fix and verify** — adjust the limit or heap flags, redeploy, and confirm `memory.current` stays below `memory.max` under load, and `memory.events` `oom_kill` stops incrementing.

The discipline is: *confirm it's OOM before touching anything*, then decide leak-vs-undersize-vs-awareness rather than blindly bumping the limit.

### Q8. How do restart policies behave at runtime, including backoff?

Set with `--restart` on `docker run` (or `restart:` in compose):

```bash
docker run --restart on-failure:5 myapp
```

- **`no`** (default) — never auto-restart.
- **`on-failure[:N]`** — restart only on a **non-zero** exit, optionally up to N attempts. A clean `exit 0` stays down.
- **`always`** — restart on any exit, and also when `dockerd` restarts (even after a manual stop).
- **`unless-stopped`** — like `always`, but a deliberate `docker stop` sticks across daemon restarts.

**Backoff:** Docker doesn't hammer a crash-looping container. It applies an **exponential-ish backoff** starting around 100ms and doubling, so a container that keeps dying is retried with growing delays instead of pegging the CPU in a tight restart loop. `docker inspect` exposes `.RestartCount`. The container status shows as `Restarting` between attempts.

Important nuance: restart policies react to the **process exiting**, not to healthchecks. A container that is `unhealthy` but whose process is still alive is **not** restarted by Docker's restart policy — acting on health is an orchestrator (Swarm/Kubernetes) behavior. For a single host, if you want "restart when unhealthy," you need an external watcher or an orchestrator; the restart policy alone only catches actual exits.

### Q9. How does HEALTHCHECK work, how is health computed, and how does health differ from liveness?

`HEALTHCHECK` defines a command Docker runs periodically to judge whether the container is *working*, not just running.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=40s \
  CMD curl -f http://localhost:8080/healthz || exit 1
```

The check command's **exit code** drives status: `0` = healthy, `1` = unhealthy. Docker computes a state machine: the container starts `health: starting`; during `start-period` failures are ignored; after that, `retries` consecutive failures flip it to `unhealthy`, and any success returns it to `healthy`. Inspect it:

```bash
docker inspect --format '{{.State.Health.Status}}' <c>   # starting|healthy|unhealthy
```

**Health vs liveness:**

- **Health status** (Docker HEALTHCHECK) is *information* — it's surfaced in `docker ps`, consumed by compose `condition: service_healthy`, and by orchestrators for routing/scheduling. On plain Docker, an `unhealthy` container is **not automatically restarted**.
- **Liveness** (a Kubernetes concept) is *action* — a failing liveness probe **restarts** the container.

So on a single host, HEALTHCHECK tells you and dependent services that the app is broken; making something *happen* (restart, remove from load balancer) requires an orchestrator or an external supervisor. Design the check to be cheap and to test real readiness (hit an endpoint that touches critical deps lightly), not a trivial `true`.

### Q10. Explain Docker logging drivers and the unbounded-disk problem.

By default Docker captures each container's **stdout/stderr** and writes it via the **`json-file`** driver to `/var/lib/docker/containers/<id>/*-json.log`. `docker logs` reads that file.

**The problem:** `json-file` is **unbounded by default** — a chatty container writes forever and eventually **fills the host disk**, which takes down *every* container and often `dockerd` itself. This is one of the most common self-inflicted container outages.

**The fix — always cap it:**

```bash
docker run --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 myapp
```

or set it daemon-wide in `/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```

That keeps at most 3 × 10MB rotated files per container.

**Other drivers:**

| Driver | Use | `docker logs` works? |
|---|---|---|
| `json-file` | default, local files | Yes |
| `local` | like json-file, more efficient, rotates by default | Yes |
| `journald` | systemd journal | No (use `journalctl`) |
| `syslog` | remote/local syslog | No |
| `fluentd` | ship to Fluentd/Fluent Bit | No |
| `awslogs` / `gcplogs` | cloud log services | No |

Key gotcha: **`docker logs` only works with `json-file` and `local`.** Switch to `syslog`/`fluentd`/`awslogs` and you must read logs from the destination system instead. `local` is often the best default — efficient and it rotates out of the box.

### Q11. What are ulimits in Docker and when do you need to set them?

**ulimits** are per-process kernel resource limits (from `setrlimit`) — max open file descriptors, max processes, core file size, locked memory, etc. Containers inherit defaults from the daemon; you override per container:

```bash
docker run --ulimit nofile=65536:65536 myapp   # soft:hard open-file limit
```

The one you'll actually hit is **`nofile`** (open file descriptors). Symptoms: the app logs **"too many open files"**, `accept()`/`socket()`/`open()` start failing, connections get refused under load. High-connection servers (databases, proxies, event-driven apps with many sockets) blow through a low default (often 1024). Raising `nofile` is the fix.

Others worth knowing:

- **`nproc`** — max processes/threads for the user; bounds thread-heavy apps (and, combined with `--pids-limit`, fork bombs).
- **`memlock`** — locked memory; databases like Elasticsearch/Postgres sometimes need it raised.
- **`core`** — core dump size; set to 0 to suppress core dumps.

Set daemon-wide defaults in `/etc/docker/daemon.json` (`default-ulimits`) or per container with `--ulimit`. Note `nofile` takes `soft:hard`. Don't set it absurdly high blindly — extremely large `nofile` can slow some programs that iterate the fd table, though modern kernels mitigate this. Diagnose first (the "too many open files" error), then raise deliberately.

### Q12. What is `--pids-limit`, and how do `docker stats`, `docker top`, and `docker events` help at runtime?

**`--pids-limit`** caps the number of processes/threads a container may create (via the pids cgroup controller):

```bash
docker run --pids-limit=200 myapp
```

Its main job is defense against **fork bombs** and runaway thread creation — without it, a container spinning up processes can exhaust the host's PID space and take down the node. Set a sane ceiling for shared hosts.

Live introspection tools:

- **`docker stats`** — a live stream of per-container **CPU %, memory usage/limit, memory %, network IO, block IO, and PIDs**, read straight from cgroup accounting. The first thing to run when a container is "slow" or "using too much." `docker stats --no-stream` for a one-shot snapshot.
- **`docker top <c>`** — the **process list inside** a container (like `ps`), run from the host — useful when you can't `exec` in (no shell in a distroless image) but need to see what's running and its PIDs.
- **`docker events`** — a real-time **stream of daemon events**: container `start`/`die`/`oom`/`kill`/`health_status`, image pulls, volume mounts. Invaluable for catching *why* a container restarted — e.g. an `oom` event immediately before a `die`, or repeated `health_status: unhealthy` events. `docker events --filter event=oom` narrows it.

Together: `stats` for resource pressure, `top` for what's running, `events` for the timeline of what happened.

### Q13. Explain tmpfs and `--shm-size`, including the Chrome/Postgres gotcha.

**tmpfs mounts** are RAM-backed filesystems mounted into a container — nothing touches disk, and everything is wiped on stop:

```bash
docker run --tmpfs /tmp:rw,size=64m myapp
```

Good for scratch space, caches, or secrets you don't want persisted. In compose it's `type: tmpfs`.

**`--shm-size`** sizes `/dev/shm`, the POSIX **shared-memory** mount. Its default is a tiny **64MB**, and that default causes two infamous failures:

- **Headless Chrome/Chromium** (Puppeteer, Selenium, Playwright) uses `/dev/shm` heavily for rendering. With 64MB it crashes with "session deleted because the browser has closed the connection" or similar. Fixes: `--shm-size=1g` (or `2g`), or run Chrome with `--disable-dev-shm-usage` so it uses `/tmp` instead.

```bash
docker run --shm-size=1g my-chrome-image
```

- **Postgres** uses shared memory for its buffers and parallel workers; heavy configs can exceed 64MB and error with "could not resize shared memory segment." Bumping `--shm-size` resolves it.

The interview point: **the 64MB `/dev/shm` default is a footgun** for any workload that leans on shared memory. If a browser-automation or database container behaves erratically or crashes under load with shared-memory errors, `--shm-size` is the first thing to check. Distinguish it from tmpfs generally — `/dev/shm` is a specific shared-memory mount that many libraries assume is generously sized on a normal host but is throttled inside a container.

### Q14. Why would you use `--init`, and what problem does PID 1 create?

Inside a container the first process is **PID 1**, and PID 1 has special kernel responsibilities: it must **reap zombie (defunct) child processes** and it gets **special signal handling** (the kernel doesn't apply default signal actions to PID 1). Most application processes were never written to be PID 1, which causes two problems:

1. **Zombie accumulation** — when a process's children exit, their exit status must be `wait()`ed by their parent; if the parent (PID 1, your app) doesn't reap them, they linger as zombies. In a long-running container that spawns subprocesses (shells, workers), zombies pile up and can exhaust the PID table.
2. **Signals swallowed** — because PID 1 gets no default signal handling, a `SIGTERM` from `docker stop` may be ignored if your app doesn't explicitly handle it, so the container never shuts down gracefully and eats the full stop-timeout before being SIGKILL'd.

**`--init`** inserts a tiny init process (tini) as PID 1:

```bash
docker run --init myapp
```

tini becomes PID 1, forwards signals to your app, and reaps zombies. Your app runs as a child, freed from PID-1 duties.

When you need it: apps that fork child processes (CI runners, anything shelling out) or that don't handle signals themselves. If your app *is* a proper init-aware process, or you already use an exec-form ENTRYPOINT with correct signal handling, you may not need it — but `--init` is a cheap, safe default. Note this ties into the shell-form vs exec-form ENTRYPOINT signal discussion.

### Q15. How do stop timeouts work, and what happens during `docker stop`?

`docker stop` performs a **graceful shutdown**: it sends **SIGTERM** to the container's PID 1, waits a grace period, then sends **SIGKILL** if the process hasn't exited.

```bash
docker stop --time 30 <c>        # send SIGTERM, wait 30s, then SIGKILL
docker run --stop-timeout 30 myapp   # bake the default grace period into the container
```

- The default grace period is **10 seconds**.
- `--time` / `-t` on `docker stop` overrides it for that call; `--stop-timeout` on `docker run` sets the container's default.
- `--stop-signal` changes the signal sent (e.g. some apps want `SIGQUIT`).

The sequence: **SIGTERM → (grace window for cleanup) → SIGKILL**. Your app should trap SIGTERM to finish in-flight requests, flush buffers, close DB connections, then exit — that's graceful drain. If it exits cleanly within the window, no SIGKILL. If it ignores SIGTERM or takes too long, it gets SIGKILL'd (exit 137) and loses in-flight work.

Two gotchas tie back to earlier topics: (1) **shell-form** `CMD`/`ENTRYPOINT` wraps the app in `/bin/sh -c`, so `sh` is PID 1 and **doesn't forward SIGTERM** — the app never sees it and always eats the full timeout. Use **exec form** so the app is PID 1 and receives signals. (2) A too-short stop-timeout truncates graceful drain for slow-shutdown apps (long-running requests, big flushes) — size it to the real drain time. This matters in orchestrators too, where the termination grace period works the same way.

### Q16. What's the difference between reserving and limiting resources, and when do you use each?

Two different intents:

- **Limiting** (a **ceiling**) — the maximum a container may use. `-m 512m`, `--cpus=1.5`. Enforced hard: memory over-limit → OOM kill; CPU over-limit → throttle. Limits protect *the rest of the host* from this container.
- **Reserving** (a **floor / guarantee**) — resources set aside *for* this container. `--memory-reservation` (soft, honored under pressure), and under Swarm/`deploy.resources.reservations` or Kubernetes `requests`, a scheduling guarantee. Reservations protect *this container* from everyone else, and drive **scheduling** (where the container can be placed).

Concretely:

- **Latency-critical service** — set a **reservation** so it always has headroom, plus a **limit** slightly above so a bug can't run away. Reservation ≈ steady-state, limit ≈ safe max.
- **Best-effort batch job** — set a **limit** (contain the blast radius) but a low/no reservation, so it soaks up spare capacity without displacing important work.
- **Noisy-neighbor defense** — everything on a shared host gets a **limit**; important things also get a **reservation**.

On a single Docker host, `--memory-reservation` is only a *soft* hint enforced under memory pressure — it doesn't truly guarantee capacity the way an orchestrator scheduler does. That's exactly the model Kubernetes formalizes: `requests` (reservation, used for scheduling and QoS class) vs `limits` (ceiling). The senior instinct: **limit everything, reserve what's critical**, and size both from measured steady-state, not guesses.

## Container Security

### Summary

**What this topic covers**

Hardening containers against escape and compromise — the practices that turn a default `docker run` (root, all-caps, writable, host-trusting) into something you'd expose to hostile traffic. This topic has 16 questions covering: the **isolation caveat** (shared kernel, not a VM), **running as non-root** (`USER`, rootless Docker, userns-remap), **Linux capabilities** (drop-all-add-back), why **`--privileged` is dangerous**, **`--read-only` root filesystem** with tmpfs for writable paths, **`no-new-privileges`**, **seccomp** and **AppArmor/SELinux** MAC profiles, avoiding **host namespace sharing** (`--pid=host`, `--net=host`, and the mounted **Docker socket** = root escape), **secrets handling** (never bake into images/ENV/ARG; BuildKit `--secret`, runtime mounted files/managers), the **docker group = root** equivalence, device access, big-base-image attack surface, defense in depth, and a "harden this `docker run`/Dockerfile" scenario.

**Mental model**

Start from the uncomfortable truth: **a container is a process, and the isolation is a kernel feature, not a hardware wall.** Every container on a host shares one kernel; namespaces restrict what a process *sees* and cgroups restrict what it *consumes*, but a kernel vulnerability turns a container breakout into host root. So container security is **defense in depth** — you assume any single layer can fail and stack independent controls so a breakout has to defeat all of them. The mental checklist has a natural shape: reduce **who** you are (non-root `USER`), reduce **what you can do** (drop capabilities, `no-new-privileges`, seccomp/AppArmor), reduce **what you can touch** (read-only FS, no host namespaces, no docker socket, minimal devices), and reduce **what's even present to attack** (small base image, no secrets baked in). The single highest-leverage move is **not running as root**, because most of the scary capabilities and escape paths require root inside the container. And the single most dangerous mistake is **mounting `/var/run/docker.sock`** into a container — that's not a container anymore, it's a root shell on the host with extra steps.

**Key terms**

- **shared kernel** — all containers use the host's one kernel; a kernel exploit escapes the container. Not a VM boundary.
- **non-root `USER`** — a Dockerfile instruction to run the process as an unprivileged UID instead of root (the default).
- **rootless Docker** — running the daemon *and* containers as an unprivileged host user, so a breakout lands as nobody, not root.
- **userns-remap** — maps container root to an unprivileged host UID via user namespaces.
- **Linux capabilities** — root's powers split into ~40 units (`NET_BIND_SERVICE`, `SYS_ADMIN`…); containers get a reduced default set.
- **`--cap-drop ALL` / `--cap-add`** — drop everything, then add back only what's needed.
- **`--privileged`** — disables nearly all isolation: all caps, all devices, writable sysfs. Near host-equivalent.
- **`--read-only`** — mount the container root filesystem read-only; writable paths come from tmpfs/volumes.
- **`no-new-privileges`** — security-opt blocking setuid/privilege escalation inside the container.
- **seccomp** — syscall filter; Docker's default profile blocks ~44 dangerous syscalls.
- **AppArmor / SELinux** — mandatory access control (MAC) profiles restricting file/capability access.
- **docker socket / docker group** — access to `/var/run/docker.sock` (or membership of the `docker` group) is **root-equivalent** on the host.

**Why interviewers ask this**

Security is where a candidate either recites "use a small image" or demonstrates a real threat model. The killer question is "is a container a security boundary?" — the wrong answer ("yes, like a VM") ends the conversation; the right one (shared kernel, defense in depth, containers *complement* but don't replace VM/gVisor/Kata isolation for hostile multi-tenancy) opens it. Interviewers probe the docker-socket trap because it's a real, common, catastrophic misconfiguration (CI systems and "docker-in-docker" setups mount it constantly) and because understanding *why* it's root-equivalent proves you understand the daemon's trust model. They give "harden this Dockerfile/`docker run`" scenarios because it's exactly the day-job task: take a default container and make it non-root, cap-dropped, read-only, no-new-privileges, with no baked secrets. Strong answers show a *layered* instinct, not a single silver bullet.

**Common confusions**

- "Containers are as isolated as VMs" — no. VMs virtualize hardware with a separate kernel; containers share the host kernel. For hostile multi-tenancy add a VM/microVM layer (gVisor, Kata, Firecracker).
- "Root in a container isn't real root" — with default caps and a writable docker socket or a kernel bug, container root readily becomes host root. Treat it as real.
- "`--privileged` is just convenient" — it removes almost all isolation. Almost nothing legitimately needs it; add specific caps/devices instead.
- "Secrets in ENV/ARG are fine" — they persist in image layers and `docker history`/`inspect`. Baked secrets leak even after you "remove" them.
- "Dropping capabilities breaks everything" — most apps need *none*; `--cap-drop ALL` and add back only what's required (often just `NET_BIND_SERVICE`).
- "Mounting the docker socket read-only is safe" — it isn't; the API it exposes lets you start a privileged container that owns the host. Read-only doesn't help.
- "The docker group is a convenience group" — membership is **root-equivalent**; guard it like sudo.

**What follows from this topic**

Non-root `USER` and minimal base images tie straight back to Dockerfile authoring and multi-stage/distroless builds (smaller image = smaller attack surface). The read-only-filesystem and no-host-namespace practices are the runtime counterparts to the resource limits in the Runtime topic — same "constrain the process" instinct, aimed at compromise instead of consumption. Secrets handling connects to BuildKit `--secret` from the build topic and to Compose/Swarm secrets. And "scan your images" is the natural next topic — hardening the *config* is half the job; hardening the *contents* (known CVEs in packages) is the other half.

### Q1. Is a container a security boundary? Why or why not?

**Not a strong one.** The defining fact: **all containers share the host's single kernel.** Namespaces limit what a container can *see* (its own PID tree, network stack, mounts) and cgroups limit what it can *consume*, but there is no hardware-level separation. A **VM** virtualizes hardware and runs its *own* kernel behind a hypervisor — a much stronger boundary. A container is "a fancy, isolated process," not a virtual machine.

The practical consequence: a **kernel vulnerability** — a bug in a syscall, a namespace, a driver — can let a process **escape the container** and gain code execution on the host, potentially as host root. Containers have had real breakout CVEs (in the runtime, `runc`, and via misconfiguration). So you should assume the boundary *can* fail.

That doesn't mean containers are insecure — it means their security model is **defense in depth**: layer non-root, dropped capabilities, seccomp, read-only FS, and MAC profiles so that a single failure doesn't equal host compromise. And for genuinely **hostile multi-tenancy** (running untrusted code from strangers), add a real isolation layer: a VM per tenant, or a sandboxed runtime like **gVisor** (intercepts syscalls in userspace) or **Kata Containers / Firecracker** (a lightweight VM per container). Containers *complement* that isolation; they don't replace it. Getting this nuance right — not "insecure," not "as good as a VM," but "shared kernel, so layer your defenses" — is the whole point of the question.

### Q2. Why do containers run as root by default, what's the risk, and how do you fix it?

**Why root by default:** unless a Dockerfile specifies `USER`, the container's main process runs as **UID 0 (root)** inside the container. It's the historical default and many base images assume it (to `apt install`, bind low ports, write anywhere).

**The risk:** container root is *host* root's UID (0) — only namespaced. If a kernel bug, a misconfiguration (mounted docker socket, `--privileged`, a host bind mount), or a capability lets the process cross the boundary, it does so **as root**. Root inside also means an app compromise (RCE in your web server) immediately owns the whole container, can install tools, and has every default capability. Running as root is the amplifier that makes every other weakness worse.

**The fix — `USER` in the Dockerfile** (the #1 hardening practice):

```dockerfile
FROM node:20-slim
RUN useradd -r -u 10001 appuser
WORKDIR /app
COPY --chown=appuser:appuser . .
RUN npm ci --omit=dev
USER appuser              # drop to non-root for runtime
EXPOSE 8080
CMD ["node", "server.js"]
```

Now an app compromise lands as an unprivileged user with no capabilities, unable to write most of the filesystem or escalate easily.

**Going further:** **rootless Docker** runs the *daemon itself* as an unprivileged host user, so even container "root" maps to a non-root host user — a breakout lands as nobody. **User-namespace remapping** (`userns-remap`) similarly maps container UID 0 to a high, unprivileged host UID. Non-root `USER` is the baseline everyone should do; rootless/userns-remap are the stronger, host-level versions.

### Q3. Explain Linux capabilities in containers and the drop-all-add-back pattern.

Historically a process was either root (can do everything) or not. **Capabilities** split root's powers into ~40 distinct units so you can grant a sliver instead of all of it. Examples: `NET_BIND_SERVICE` (bind ports <1024), `NET_ADMIN` (configure networking), `SYS_ADMIN` (a huge grab-bag, effectively near-root), `CHOWN`, `SETUID`, `SYS_PTRACE`, `SYS_TIME`.

Docker already **drops many** capabilities by default, running with a reduced set — but that default set is still broader than most apps need. The hardening pattern is **drop everything, add back only what's required**:

```bash
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE myapp
```

Here the container has *no* capabilities except the one that lets it bind port 80/443 — a plain web server needs nothing more. Most application containers actually need **zero** capabilities (they don't bind low ports if you publish `-p 8080:8080` and use `NET_BIND_SERVICE`-free high ports).

Why this beats trusting the default: it's **least privilege made explicit**. Instead of "whatever Docker happens to leave on," you declare exactly the powers the app uses, so a compromised process can't, say, load kernel modules or change file ownership. In compose it's `cap_drop: [ALL]` / `cap_add: [NET_BIND_SERVICE]`. The senior instinct is to start from `--cap-drop ALL` and add back the *minimum*, testing what actually breaks — usually nothing.

### Q4. Why is `--privileged` dangerous, and what are the alternatives?

**`--privileged` essentially turns off container isolation.** It grants **all capabilities**, gives access to **all host devices** (`/dev`), mounts `sysfs`/`cgroupfs` writable, and drops the seccomp/AppArmor confinement. A privileged container can load kernel modules, access raw disks, reconfigure the host network, and mount host filesystems — it is, for practical purposes, **root on the host**. A single RCE in a privileged container is a full host compromise.

**Almost nothing legitimately needs it.** The usual excuses and their real fixes:

- "I need one device" → use **`--device=/dev/foo`** to pass just that device, not all of them.
- "I need a specific capability" (e.g. `NET_ADMIN` for a VPN sidecar) → **`--cap-add NET_ADMIN`**, not `--privileged`.
- "Docker-in-Docker for CI" → prefer a rootless/sysbox runtime, a **mounted daemon via a controlled proxy**, or Kaniko/Buildah for image builds without privilege. (And never solve DinD by mounting the docker socket — see the socket question.)
- "I need to mount something" → grant **`SYS_ADMIN`** narrowly, or use a volume.

The rule: **`--privileged` is a last resort you should be able to justify to a security reviewer.** If you can't name the exact device or capability you need, you don't need privileged — you need to figure out which specific grant solves the problem. In an interview, reaching for `--device`/`--cap-add` instead of `--privileged` is the senior tell.

### Q5. How and why do you run a container with a read-only root filesystem?

**`--read-only`** mounts the container's root filesystem read-only, so the running process **cannot modify the image's files** — no dropping a webshell, no tampering with binaries, no writing malware to disk:

```bash
docker run --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --tmpfs /run:rw,noexec,nosuid \
  -v app-data:/var/lib/app \
  myapp
```

Since almost every app needs *some* writable path, you carve out exactly those:

- **`--tmpfs`** for ephemeral scratch (`/tmp`, `/run`) — RAM-backed, wiped on stop, and you can add `noexec,nosuid` so nothing dropped there can even run.
- **named volumes / bind mounts** for genuine persistent state (`/var/lib/app`, a database dir), which remain writable.

In compose it's `read_only: true` plus `tmpfs:` and `volumes:`.

**Why it matters — immutability as defense:** a read-only rootfs enforces the *cattle, not pets* principle at the security layer. An attacker who achieves code execution can't persist by modifying the filesystem, can't overwrite config or binaries, and is constrained to a couple of well-known writable, `noexec` paths. It also catches your *own* app accidentally writing where it shouldn't. Combined with non-root `USER` and dropped capabilities, read-only turns a compromised container into a nearly inert box: the attacker is unprivileged, capability-less, and can't even write to disk. The main work is discovering which paths the app legitimately writes to (logs, temp, caches) and mounting just those.

### Q6. What does `no-new-privileges` do and when do you need it?

```bash
docker run --security-opt no-new-privileges myapp
```

It sets the kernel's **`no_new_privs`** bit on the container's processes, which **prevents any process from gaining more privileges than it started with** — specifically, it neutralizes **setuid/setgid** binaries and file capabilities. Normally, executing a setuid-root binary (like `sudo`, `ping`, `passwd`, `mount`) elevates the caller to the binary's owner. With `no-new-privileges`, that elevation is **blocked** — the setuid bit is ignored.

**Why it matters:** even if you run as a non-root `USER`, an attacker who gets code execution might try to escalate by invoking a setuid-root binary present in the image. `no-new-privileges` slams that door — the classic "drop to non-root, then abuse setuid to get back to root" escalation path stops working. It's a cheap, near-zero-downside hardening flag.

**When you need it:** basically always for hardened containers, *especially* alongside a non-root `USER` — it's what makes "non-root" stick by preventing re-escalation. The only time to omit it is if your app genuinely relies on a setuid binary to do legitimate privilege transitions at runtime (rare in a well-designed container; usually a smell). In compose: `security_opt: ["no-new-privileges:true"]`. It pairs naturally with `--cap-drop ALL`, non-root `USER`, and `--read-only` as part of the standard hardening bundle.

### Q7. Explain seccomp, AppArmor, and SELinux in the container context.

These are kernel-level confinement layers Docker uses to restrict what a container can *do*, beyond capabilities.

**seccomp (secure computing mode)** — a **syscall filter**. Docker ships a **default seccomp profile** applied to every container that **blocks ~44 dangerous syscalls** (out of 300+) — things like `mount`, `reboot`, `kexec_load`, `ptrace` in ways that could harm the host or aid an escape, while allowing the syscalls normal apps need. This shrinks the kernel attack surface: fewer reachable syscalls means fewer exploitable kernel bugs. You can supply a **custom profile** (`--security-opt seccomp=profile.json`) to lock it down further (whitelist only the syscalls your app uses) — but never disable it (`seccomp=unconfined`) casually, as that exposes the full syscall surface.

**AppArmor** and **SELinux** are **Mandatory Access Control (MAC)** systems — the kernel enforces a policy that even root can't override:

- **AppArmor** (Debian/Ubuntu) — **path-based** profiles restricting which files a container can read/write/execute and which capabilities it can use. Docker applies a default `docker-default` profile; you can attach a custom one with `--security-opt apparmor=myprofile`.
- **SELinux** (RHEL/Fedora) — **label-based** MAC. Every process and file gets a label, and policy governs which labels may interact. Docker uses type enforcement and MCS labels so containers can't touch each other's or the host's files. Enable with `--security-opt label=...`; on SELinux hosts it's often on by default.

The theme: **capabilities say what powers you have; seccomp says which syscalls you may call; AppArmor/SELinux say which files/resources you may touch.** They're independent layers — defense in depth. Keep the defaults on (disabling them is a common, dangerous shortcut) and tighten with custom profiles for high-value workloads.

### Q8. Why is mounting the Docker socket into a container so dangerous?

**`/var/run/docker.sock`** is the Unix socket the Docker CLI talks to — it *is* the Docker daemon's full API. The daemon runs as **root on the host**. So any process that can talk to that socket can tell the daemon to do anything Docker can do — including **start a new container that mounts the host's root filesystem and runs privileged**:

```bash
# From inside a container that has the socket mounted, an attacker can effectively do:
docker run -v /:/host --privileged alpine chroot /host sh
# -> now they have a root shell on the HOST filesystem
```

That's the whole game: **access to the docker socket = root on the host.** Mounting it read-only does **not** help — the danger is the *API operations* it exposes (create/run containers with arbitrary mounts and privileges), not writes to the socket file itself.

Yet people mount it constantly — CI runners that build images, "watchtower"-style auto-updaters, docker-in-docker setups, monitoring agents. Each one is a container whose compromise means host compromise, and it collapses the entire container isolation model.

**Safer alternatives:**

- For image builds in CI, use **Kaniko**, **Buildah**, or BuildKit's rootless mode — no daemon socket needed.
- If a container truly must issue Docker commands, put a **socket proxy** (e.g. an authorizing proxy) in front that whitelists only the specific, safe API endpoints (`GET /containers/json`) and blocks `create`/`exec`/privileged runs.
- Reconsider the design — often the need for the socket signals the work belongs on the host or in the orchestrator, not in a container.

The interview point: recognizing that a mounted docker socket is a **root-equivalent escape**, not a convenience, and that read-only doesn't save you.

### Q9. How should secrets be handled in Docker builds and at runtime — and how do they leak?

**The core rule: never bake secrets into the image.** An image is a stack of **immutable, cached layers**, and its build history is inspectable. So these all leak:

- **`ENV SECRET=...`** — persists in the image config; visible in `docker inspect` and to every process/child in the container.
- **`ARG SECRET` + using it in a `RUN`** — the ARG value and any file you wrote can persist in a layer; **`docker history`** exposes build args and commands.
- **`COPY secret.pem .` then `RUN ... && rm secret.pem`** — the secret is **still in the earlier layer**; deleting it in a later layer doesn't remove it from history. Anyone who pulls the image can extract it.

**At build time — BuildKit `--secret`:** mounts a secret into a single `RUN` **without writing it to any layer**:

```dockerfile
# syntax=docker/dockerfile:1
FROM alpine
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci        # .npmrc is available only during this RUN, never persisted
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

The secret is used to install/authenticate and vanishes — nothing in the final image. (BuildKit `--ssh` does the same for SSH agent forwarding.)

**At runtime — deliver secrets as files or via a manager, not `-e`:**

- **Mounted files** — a tmpfs-mounted file the app reads (`/run/secrets/...`), so it's not in image layers or `docker inspect`.
- **Docker/Swarm secrets** — under Swarm, secrets are stored encrypted and mounted in-memory at `/run/secrets/<name>`.
- **A secrets manager** — Vault, cloud secret stores, or the orchestrator's secret mechanism, fetched at startup.

Avoid `-e SECRET=...` for sensitive values: env is exposed in `docker inspect`, `/proc/<pid>/environ`, child processes, and frequently logged. The senior answer: **BuildKit `--secret` at build, mounted files / a secrets manager at runtime, never in layers or env.**

### Q10. Why is membership in the `docker` group equivalent to root, and why does it matter?

Anyone in the host's **`docker` group** can talk to the Docker daemon socket without `sudo`. But as established, the daemon runs as **root** and its API lets you start a container that mounts the host root filesystem privileged. So a `docker`-group user can trivially become host root:

```bash
docker run -v /:/host -it alpine chroot /host sh   # root shell on the host, no sudo
```

Therefore **adding a user to the `docker` group is equivalent to giving them passwordless root.** It matters because it's routinely treated as a mere "convenience" — admins add developers to the `docker` group so they don't have to `sudo docker`, not realizing they've handed out root. There's no privilege separation: the group is all-or-nothing host root.

Implications and mitigations:

- **Guard `docker` group membership like `sudo`/`wheel`** — audit it, minimize it, and understand that CI agents or service accounts in the group are root-equivalent identities.
- Prefer **rootless Docker**, where the daemon runs as the unprivileged user, so socket access no longer means host root.
- On multi-user hosts, consider not exposing the daemon socket broadly and using an authorizing proxy for the few operations users need.

The interview signal is recognizing that "just add them to the docker group" is a **privilege-escalation grant**, the same class of issue as the mounted socket — because it *is* the same underlying trust: access to the root-owned daemon.

### Q11. How does image size and base image choice affect the attack surface?

Every package, binary, shell, and library in an image is **code an attacker can use or exploit** — and each one may carry known CVEs. A big base image (a full `ubuntu`/`debian` with a shell, package manager, `curl`, `git`, compilers, `ssh`) is a large **attack surface**: more binaries for a compromised process to abuse (living-off-the-land: `curl` to exfiltrate, `gcc` to compile an exploit, `bash` for interactive shells), and more packages to patch and scan.

Shrinking the image is a security measure, not just an efficiency one:

- **Slim/alpine bases** cut most of the extras.
- **Distroless** images (just the runtime + your app, *no shell, no package manager*) mean an attacker who gets code execution has **no shell to spawn**, no `apt` to install tools, drastically limiting post-exploitation.
- **`scratch`** (empty base) for static binaries (Go, Rust) — literally nothing but your binary; almost no attack surface.

You get there with **multi-stage builds**: a fat build stage with all the toolchain, then a minimal final stage that `COPY --from=build` only the compiled artifact into distroless/scratch.

```dockerfile
FROM golang:1.22 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

FROM gcr.io/distroless/static:nonroot
COPY --from=build /app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

Bonus: fewer packages means **fewer CVEs** for your scanner to flag and fewer patches to chase. The instinct — *the smallest image that runs your app* — reduces both attack surface and operational toil, and is why distroless/scratch appear in every serious hardening answer.

### Q12. What are the risks of sharing host namespaces (`--pid=host`, `--net=host`, `--ipc=host`)?

Namespaces are *what isolates* a container; sharing a host namespace **removes that isolation** for that dimension, exposing the host to the container.

- **`--pid=host`** — the container shares the host's PID namespace: it can **see and signal every process on the host** (`ps` shows host processes; it can `kill` them, `ptrace` them, and read `/proc/<pid>/environ` of host processes — leaking their secrets/env). A compromised container can now interfere with host and sibling processes.
- **`--net=host`** — the container shares the host's network namespace: it binds directly on host interfaces (no `-p` needed), can **sniff host traffic**, reach services bound to `localhost` on the host (often assumed private — databases, admin endpoints, the metadata service on cloud VMs), and bypass network policies. It also removes the network isolation between it and the host.
- **`--ipc=host`** — shares System V IPC / shared memory with the host, so the container can read/write host shared-memory segments (potential data leakage or tampering between the container and host processes).
- **`--uts=host`** — shares the hostname/domain namespace (lower risk, but still a leak of host identity).

The rule: **don't share host namespaces unless you have a concrete, justified need** (e.g. a monitoring agent that genuinely must see host processes — and even then, treat that container as high-trust and lock everything else down). Each shared namespace is a hole in the isolation you're otherwise carefully building, and combined with root-in-container they become escape aids (e.g. `--pid=host` + `SYS_PTRACE` lets you attack host processes directly).

### Q13. What are the risks of `--device` and giving containers hardware access?

**`--device=/dev/foo`** exposes a specific host device node into the container:

```bash
docker run --device=/dev/ttyUSB0 myapp        # just one serial device
```

It's the *correct*, narrow alternative to `--privileged` when a container legitimately needs hardware (a serial port, a GPU via the right runtime, a specific block device). But device access carries real risk because a device node is often a **direct path to the kernel or to raw data**:

- **Raw block/disk devices** (`--device=/dev/sda`) let the container **read or write the host's disk directly**, bypassing filesystem permissions — it can read other tenants' data or corrupt the host filesystem. Effectively a host compromise.
- **`/dev/mem`, `/dev/kmem`** — direct memory access; game over.
- **Devices with buggy drivers** widen the **kernel attack surface** — talking to a device driver means reaching kernel code that a malicious `ioctl` might exploit to escape.
- By default `--device` grants read/write/mknod; you can restrict with permission suffixes (`--device=/dev/foo:/dev/foo:r` for read-only).

Guidance: pass **only the specific device** the app needs (never `--privileged` to "just get the device"), grant the **minimum permissions** (`r`/`w`/`m`), and treat any container with raw disk or memory device access as **high-trust / near-privileged** — harden it accordingly, and never combine broad device access with untrusted workloads. The interview point is knowing `--device` is the *scoped* answer to `--privileged`, but that "scoped" still can mean "root-equivalent" depending on *which* device.

### Q14. Walk through hardening this container: `docker run -d -p 80:80 -v /var/run/docker.sock:/sock myapp`. What's wrong and how do you fix it?

This run line has several serious problems. Let me triage.

**What's wrong:**

1. **`-v /var/run/docker.sock:/sock`** — mounts the Docker socket into the container. This is **root-on-the-host**: a compromised container spawns a privileged container mounting `/`. Almost certainly unnecessary. **Remove it.** If it truly needs Docker API access, front it with an authorizing socket proxy.
2. **Runs as root** (implicit — no `USER`). An app compromise lands as root with default capabilities.
3. **All default capabilities**, writable filesystem, setuid escalation possible, default (not tightened) confinement.
4. **Binds host port 80** — needs `NET_BIND_SERVICE` if run non-root; better to publish a high port and let a reverse proxy terminate 80/443.

**Hardened version:**

```bash
docker run -d \
  -p 8080:8080 \                      # high port; proxy handles 80/443
  --user 10001:10001 \                # non-root
  --cap-drop ALL \                    # no capabilities...
  --read-only \                       # immutable rootfs
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --security-opt no-new-privileges \  # block setuid escalation
  --pids-limit 200 \                  # fork-bomb guard
  -m 512m --cpus 1.0 \                # resource limits (noisy-neighbor)
  --restart unless-stopped \
  myapp
```

Plus, ensure the **image itself** is hardened: a non-root `USER` and minimal/distroless base in the Dockerfile, no baked secrets (use mounted files or a secrets manager for config), and keep the default seccomp/AppArmor profiles on.

The reasoning to voice: **drop the socket (the catastrophic one) first**, then apply defense in depth — non-root, cap-drop-all, read-only, no-new-privileges, resource limits — so that even a full app compromise yields an unprivileged, capability-less, non-persistent process with no path to the host.

### Q15. What does "defense in depth" mean for containers, and what's the baseline hardened container?

**Defense in depth** = assume any single control can fail, so stack **independent** layers such that a breakout must defeat all of them. No one setting makes a container "secure"; the security comes from the *combination*. If an attacker gets RCE in the app, non-root stops them being root; if they're somehow root, dropped capabilities stop them doing much; if they have a capability, seccomp blocks the dangerous syscall; if they call it, AppArmor/SELinux denies the file access; if they want persistence, the read-only FS refuses the write; and if they escape anyway, rootless Docker means they land as an unprivileged host user. Each layer is cheap; together they're formidable.

**The baseline hardened container** — the "boring, do-this-every-time" bundle:

- **Non-root** `USER` in the Dockerfile (and rootless Docker / userns-remap on the host if possible).
- **`--cap-drop ALL`**, add back only what's needed (often nothing, sometimes `NET_BIND_SERVICE`).
- **`--read-only`** rootfs with `--tmpfs` for the few writable paths (`noexec,nosuid`).
- **`--security-opt no-new-privileges`**.
- **Default seccomp + AppArmor/SELinux left on** (custom profiles for high-value apps).
- **No `--privileged`, no host namespaces, no mounted docker socket, minimal `--device`.**
- **Minimal/distroless base image**, **no secrets in the image**, and **resource limits** (`-m`, `--cpus`, `--pids-limit`) to bound the blast radius.

Layer it into compose (`user:`, `cap_drop`, `read_only`, `security_opt`, `tmpfs`) so it's the default, not a special case. The senior framing: security isn't a flag you flip, it's a **posture** — start from maximally-constrained and relax only where the app provably needs it.

### Q16. Beyond runtime hardening, what else belongs in a container security strategy?

Runtime flags harden the *configuration*; a complete strategy also secures the **contents**, the **supply chain**, and the **operations** around the container.

- **Image scanning** — scan images for known **CVEs** in OS packages and app dependencies (Trivy, Grype, Docker Scout, registry scanning) in CI, and *fail the build* on high-severity fixable vulns. Hardening the config doesn't help if the base image ships a critical OpenSSL CVE. (This is essentially the next topic.)
- **Minimal, pinned, trusted base images** — small (distroless/slim) to cut attack surface, and **pinned by digest** (`@sha256:...`) so you get reproducible, un-swappable bases; avoid `:latest`.
- **Supply-chain integrity** — **sign images** (Sigstore/cosign, Docker Content Trust) and **verify signatures** on deploy, so only images you built run. Generate an **SBOM** so you can answer "which images contain log4j" instantly.
- **Keep bases patched** — rebuild regularly to pull security updates; an image built once and never rebuilt accumulates CVEs.
- **Registry hygiene** — private registry, access controls, no secrets in pushed images, scan on push.
- **Runtime detection** — tools like Falco watch for anomalous container behavior (unexpected shells, syscalls, network) as a last line when prevention fails.
- **Least privilege at the orchestrator** — RBAC, network policies, pod security standards (in Kubernetes) extend the same principles above the single host.

The framing: container security spans **build** (scan, sign, SBOM, minimal base), **ship** (signed images, controlled registry), and **run** (the hardening bundle + runtime detection). Runtime flags are necessary but not sufficient — a hardened config on a CVE-riddled, unsigned image is still a liability.
## Image Security & Supply Chain

### Summary

**What this topic covers**

Container images are a **software supply chain**, and this topic is about securing every link in it — from the base image you inherit, through the dependencies you install, to the artifact you sign and admit into a cluster. The threat model is simple and unforgiving: **you inherit everything in your base image and every layer you add**. A vulnerable `openssl`, a compromised npm transitive dependency, a leaked AWS key baked into layer 3 — all of it ships to production inside the image and runs with whatever privileges the container has. The 15 questions in this topic cover **vulnerability scanning** (Trivy, Grype, Docker Scout, Clair, Snyk), keeping images **patched** (the pin-for-reproducibility vs patch-for-security tension), **minimal base images** to shrink the CVE surface, **image signing** (Docker Content Trust / Notary, and cosign / sigstore), **SBOMs** (Software Bill of Materials via syft), **provenance / SLSA attestations**, **secrets-in-layer** scanning, **registry security**, and **admission control** that lets only signed-and-scanned images run. The capstone question is the operational one every senior candidate gets: "you have 200 images in production — how do you keep them secure?"

**Mental model**

Think of image security as a **pipeline of trust gates**, not a one-time scan. An image is untrusted until proven otherwise, and "proven" is a chain: (1) **build** from a pinned, minimal base by digest; (2) **generate an SBOM** so you always know what's inside; (3) **scan** the image against CVE databases and fail the build on criticals; (4) **sign** the image and **attest** its provenance (who built it, from what commit, on what runner); (5) at deploy time, an **admission controller verifies** the signature and scan result and rejects anything that fails. The key insight is that security is a **property of the pipeline**, not of a single command. The other half of the model is **patch velocity**: a scanned image is only "clean" the day you scanned it — new CVEs are disclosed daily against packages already in your image, so an old pinned base **rots**. Security therefore requires **rebuilding regularly**, not just building once. Digests give you reproducibility; a rebuild pipeline gives you patches; you need both.

**Key terms**

- **Supply chain** — everything that goes into your image: base image, OS packages, language dependencies (and their transitive deps), build tools. You inherit all of it.
- **CVE** — Common Vulnerabilities and Exposures; a numbered public flaw (e.g. `CVE-2024-xxxx`) that scanners match against packages in your image.
- **Vulnerability scanner** — Trivy, Grype, Docker Scout, Clair, Snyk; inventories packages in an image and cross-references known-CVE databases.
- **SBOM** — Software Bill of Materials; a machine-readable list (SPDX or CycloneDX) of every component in an image. Generated by `syft` / `docker sbom`.
- **Image signing** — cryptographically attesting an image digest so consumers can verify it hasn't been swapped. cosign (sigstore) is the modern standard; Docker Content Trust / Notary v1 is the legacy one.
- **Keyless signing** — cosign signs using a short-lived OIDC identity (via Fulcio) instead of a long-lived private key; the signature is logged in a public transparency log (Rekor).
- **Provenance / attestation** — signed metadata about *how* an image was built (source commit, builder, timestamp). BuildKit emits it via `--provenance`; **SLSA** is the framework grading build integrity.
- **Distroless / scratch** — minimal base images with no shell/package manager; fewer packages means fewer CVEs and less to patch.
- **Admission control** — a cluster gate (Kyverno, OPA/Gatekeeper, Kubernetes Binary Authorization) that only admits images meeting signing/scanning policy.
- **Digest pin** — referencing an image by `@sha256:…` instead of a mutable tag; immutable and reproducible, but does not auto-update, so it must be paired with a rebuild pipeline.
- **Trivy / Grype** — the two most common open-source scanners; scan images, filesystems, and IaC for CVEs and misconfigurations.
- **Registry immutability** — a registry setting that forbids overwriting an existing tag, preventing tag-swap attacks.

**Why interviewers ask this**

Supply-chain security is where **DevOps meets security engineering**, and it separates candidates who ship containers from candidates who ship them *responsibly*. A junior answer stops at "I run a scanner in CI." A senior answer describes the **full lifecycle**: minimal base → SBOM → scan-and-gate → sign → attest provenance → admission-verify → **and a rebuild cadence** because scanning once is worthless. Interviewers probe the tensions on purpose: "if you pin by digest for reproducibility, how do you ever get security patches?" tests whether you understand that pinning and patching pull in opposite directions and how a rebuild pipeline resolves it. They ask "how do you keep 200 images secure?" to see if you think in **automation and policy** (base-image golden pipeline, automated rebuilds, org-wide admission policy) rather than heroics. Post-SolarWinds and post-Log4Shell, this is a board-level concern, and teams expect infra engineers to speak it fluently.

**Common confusions**

- "I scanned the image, so it's secure" — a scan is a **point-in-time** snapshot; new CVEs land daily against packages already inside. Without rebuilds, a green scan silently goes red.
- "Pinning by digest keeps me safe" — pinning keeps you **reproducible**, not **patched**. A pinned base that you never rebuild only accumulates CVEs.
- "Alpine is always more secure because it's small" — smaller surface, yes, but musl libc and its own CVE stream apply; distroless is often the better minimal choice, and glibc bugs still matter.
- "`docker rm` / a later `RUN rm secret` removes the secret" — no. Every layer is immutable; a secret written in one layer persists in image history even if a later layer deletes it. Use BuildKit `--secret` or runtime injection.
- "Signing proves the image is safe" — signing proves **provenance and integrity** (it's the image the signer vouched for), not that it's free of vulnerabilities. Scanning and signing are complementary.
- "SBOM is compliance paperwork" — an SBOM is the thing that lets you answer "am I affected by this new CVE?" in minutes instead of days across hundreds of images.

**What follows from this topic**

This topic sits on top of the security fundamentals introduced earlier (non-root `USER`, dropped capabilities, `--read-only`, avoiding `--privileged`) and the minimal-image techniques from multi-stage builds — a distroless final stage is both a size win and a CVE-surface win. Admission control ties directly into the Kubernetes primer's policy story. The scanning/signing pipeline connects to the CI/CD topic (where the scan-and-sign gates actually run) and to **Debugging & Troubleshooting** (triaging scanner findings and false positives). The capstone **Scenario & Best-Practice Playbooks** topic reuses everything here — "secrets baked into the image" and "running untrusted images" are anti-patterns you'll be asked to spot and fix.

### Q1. What is the software supply-chain threat model for containers?

The core principle: **an image is the sum of everything you inherit plus everything you add, and all of it runs in production.** When you write `FROM node:20`, you inherit the entire Debian userland, its OpenSSL, its libc, plus Node itself — hundreds of packages, any of which may carry a CVE or, in a compromise scenario, malware. Then `npm install` pulls your direct dependencies *and their transitive dependencies* — often thousands of packages authored by strangers.

The attack surface has three layers:

- **Base image** — a vulnerable or backdoored base infects every image built on it. This is why golden, vetted base images matter.
- **Dependencies** — a compromised package (typosquat, dependency-confusion, or a hijacked maintainer account) executes with your app's privileges.
- **Build process** — a compromised CI runner or build tool can inject artifacts you never wrote (the SolarWinds pattern).

The defensive answer is **defense in depth across the lifecycle**: minimal pinned bases, SBOMs to know what's inside, scanning to catch known CVEs, signing + provenance to prove integrity, and admission control to enforce all of it at deploy time. No single control is sufficient — the point is that a break in one layer is caught by another.

### Q2. How do you scan a container image for vulnerabilities? What tools?

You run a scanner that inventories the packages in the image (OS packages via the package DB, plus language dependencies via lockfiles) and cross-references public CVE databases.

The common tools:

| Tool | Notes |
|---|---|
| **Trivy** (Aqua) | Most popular OSS scanner; images, filesystems, repos, IaC, secrets, SBOMs. Fast, easy CI integration. |
| **Grype** (Anchore) | OSS; pairs with `syft` for SBOM-driven scanning. |
| **Docker Scout** | Docker's built-in; `docker scout cves <image>`, integrates with Docker Hub/Desktop. |
| **Clair** | Server-based; historically powers registry scanning (e.g. Harbor, Quay). |
| **Snyk** | Commercial; strong dev-workflow and remediation advice. |

A typical Trivy invocation:

```bash
# fail the build if any CRITICAL/HIGH CVE has a fix available
trivy image --severity CRITICAL,HIGH --exit-code 1 --ignore-unfixed myregistry/app:1.2.3
```

Scan in **two places**: in **CI** (fast feedback, gate the build) and at the **registry** (continuous re-scanning as new CVEs are disclosed against images already pushed). `--ignore-unfixed` is a pragmatic switch — there's little point failing a build on a CVE with no available patch.

### Q3. Should a failed vulnerability scan block a build? How do you handle false positives?

Yes for **criticals with a fix available** — that's the whole point of a gate. But an absolutist "fail on any CVE" policy is unworkable and teams quickly learn to ignore a red pipeline, which is worse than no scanning.

A realistic policy:

- **Fail** on `CRITICAL`/`HIGH` **with a fix available** (`--ignore-unfixed`) — these are actionable.
- **Warn** on unfixed or medium/low — track them, don't block.
- **Triage** the rest. Scanners produce **false positives** (a CVE flagged in a package that your code path never invokes, or a backported fix the scanner doesn't recognize) and **irrelevant findings** (a CVE in a build-stage-only tool that isn't in the final image).

For accepted findings, use a **`.trivyignore`** file or VEX (Vulnerability Exploitability eXchange) documents to suppress specific CVEs with a documented justification and an expiry. The senior signal here is acknowledging the **triage reality** — scanning without a triage process just generates noise that the team learns to route around.

### Q4. How do you keep container images patched over time?

By **rebuilding regularly** so each rebuild pulls the latest security patches into the base image and dependencies. An image is only as clean as the day it was built; new CVEs are disclosed daily against packages already inside it, so a build that never gets rebuilt **rots**.

The tension: you pin the base by digest for **reproducibility**, but a pinned digest never changes, so it never gets patches. This is the pin-vs-patch conflict.

The resolution is a **rebuild pipeline**:

- Keep the base pinned by digest in the Dockerfile for reproducibility.
- Run an **automated job** (nightly/weekly, or triggered by upstream base-image updates) that bumps the pin to the latest digest of the same tag, rebuilds, re-scans, and re-signs.
- Tools like **Dependabot** / **Renovate** open PRs to update base-image and dependency pins; **Docker Scout** and registry scanners flag when a newer, patched base is available.

So you get both properties: any single build is reproducible from its pinned digest, and the fleet stays patched because the pins are continuously and automatically advanced. Pinning is for *reproducibility*; the rebuild cadence is for *security*.

### Q5. Why do minimal base images reduce your security exposure?

**Fewer packages = fewer CVEs = less to patch.** Every package in the image is potential attack surface and a potential source of a future CVE. A full `ubuntu` or `debian` base carries hundreds of packages — a shell, a package manager, coreutils, libraries — most of which your app never uses but all of which can be vulnerable and must be patched.

The minimal-base ladder:

- **`scratch`** — literally empty. Perfect for a statically linked binary (Go, Rust). Zero OS CVEs because there's zero OS.
- **distroless** (`gcr.io/distroless/...`) — just your language runtime and its libs, no shell, no package manager. Drastically fewer CVEs and nothing for an attacker to pivot with (no `sh`, no `curl`).
- **`alpine`** — ~5 MB, musl libc + busybox; small but has a shell and its own CVE stream (and musl vs glibc quirks).
- **`-slim` variants** — trimmed Debian; a middle ground when you need glibc and apt but want less bulk.

Smaller images also pull faster, cost less to store, and reduce the blast radius if a container is compromised (no tools for an attacker to use). The trade-off is debuggability — no shell means you can't `exec` in, which is a Debugging-topic concern.

### Q6. What does running as a non-root user buy you, and how do you do it?

Running as non-root means that even if an attacker achieves code execution inside the container, they land as an **unprivileged user**, not `root` — which sharply limits what they can do (no writing to protected paths, harder to exploit kernel bugs, no fiddling with the container's own filesystem if you also set `--read-only`).

By default a container runs as `root` (UID 0), and that root is (absent user namespaces) the **same UID 0 as the host** — so a container breakout gives host root. You fix this in the Dockerfile:

```dockerfile
FROM node:20-slim
# create an unprivileged user and own the app dir
RUN useradd --system --uid 10001 appuser
WORKDIR /app
COPY --chown=appuser:appuser . .
RUN npm ci --omit=dev
USER appuser
CMD ["node", "server.js"]
```

Key points: set `USER` **after** the steps that need root (installing packages), bind to a port `>1024` (non-root can't bind privileged ports), and `chown` files the app must write. Enforce it at runtime too — `--user 10001`, `--read-only`, `--cap-drop ALL`, and reject `--privileged`. Distroless images ship a `nonroot` user (UID 65532) precisely for this.

### Q7. What is image signing and how does cosign / sigstore work?

Image signing cryptographically binds a **signature to an image digest**, so a consumer can verify the image they're about to run is exactly the one a trusted party vouched for — it hasn't been tampered with or swapped in the registry.

**cosign** (part of the **sigstore** project) is the modern standard. Basic keypair flow:

```bash
cosign generate-key-pair
cosign sign --key cosign.key myregistry/app@sha256:abc123...
cosign verify --key cosign.pub myregistry/app@sha256:abc123...
```

The more powerful mode is **keyless signing**: instead of managing a long-lived private key, cosign authenticates via a short-lived **OIDC identity** (e.g. the CI job's identity), gets a short-lived certificate from **Fulcio**, signs, and records the signature in **Rekor**, a public **transparency log**. Verification then checks "was this image signed by the expected CI identity from the expected repo?" — no key to leak or rotate.

The **legacy** approach is **Docker Content Trust (DCT)** / **Notary v1**, enabled with `DOCKER_CONTENT_TRUST=1`; it's largely superseded by cosign/Notary v2 in modern pipelines. Signing proves **integrity and provenance**, not absence of vulnerabilities — pair it with scanning.

### Q8. What is an SBOM and why do you need one?

An **SBOM (Software Bill of Materials)** is a complete, machine-readable inventory of every component in your image — OS packages, language dependencies, versions, and licenses — in a standard format (**SPDX** or **CycloneDX**).

You generate it from the image:

```bash
syft myregistry/app:1.2.3 -o cyclonedx-json > sbom.json
# or Docker's built-in
docker sbom myregistry/app:1.2.3
# BuildKit can attach it as an attestation at build time
docker buildx build --sbom=true -t myregistry/app:1.2.3 --push .
```

Why it matters:

- **CVE response** — when the next Log4Shell drops, you query your SBOMs and know in minutes which of your images contain the affected package and version, instead of manually rebuilding and scanning everything.
- **Compliance** — regulators and customers increasingly require an SBOM (US Executive Order 14028 pushed this into government procurement).
- **License auditing** — know what licenses you're shipping.

The best practice is to **attach the SBOM as a signed attestation** to the image so it travels with the artifact and can be verified. An SBOM is what turns "I think we might be affected" into a definitive, fast answer.

### Q9. What is build provenance / SLSA and how do attestations work?

**Provenance** is signed metadata that proves *how and where* an image was built: which source commit, which builder, which parameters, at what time. It answers "can I trust that this artifact came from the pipeline I think it did, and wasn't tampered with in between?"

**SLSA** (Supply-chain Levels for Software Artifacts, "salsa") is the framework that grades build integrity in levels — higher levels require things like a hardened, isolated builder and non-falsifiable provenance. It's the response to attacks like SolarWinds, where the *build system* itself was compromised.

BuildKit generates provenance as an **attestation** attached to the image:

```bash
docker buildx build --provenance=true --sbom=true -t myregistry/app:1.2.3 --push .
```

An **attestation** is a signed statement *about* an artifact (provenance, SBOM, test results, scan results). At deploy time an admission controller (or `cosign verify-attestation`) checks these — e.g. "only run images with provenance showing they were built from the `main` branch of the approved repo by the official builder." Provenance closes the loop: signing proves *who vouched for* the image, provenance proves *how it was produced*.

### Q10. Why is pinning by digest better than pinning by tag?

Because **tags are mutable pointers and digests are immutable content addresses.** `myregistry/app:1.2.3` can be re-pushed to point at completely different bytes tomorrow; `:latest` is the worst offender, changing constantly. `myregistry/app@sha256:abc123…` refers to *exactly* one image manifest, forever.

```dockerfile
# reproducible: this is exactly one set of bytes, always
FROM node:20-slim@sha256:0a1b2c3d...
```

Benefits of digest pinning:

- **Reproducibility** — the same Dockerfile builds the same image tomorrow, next year, on any machine.
- **Tamper resistance** — a tag-swap attack (attacker re-pushes a malicious image under a trusted tag) can't affect you; the digest wouldn't match.
- **Auditability** — you know precisely what shipped.

The catch, again, is that a digest **never updates**, so pinning alone leaves you unpatched — you pair it with an automated rebuild/bump pipeline (Q4). Registry **tag immutability** settings give you some of the same protection for tags, but a digest is the strongest guarantee. Pin both your **base image** and, via lockfiles, your **dependencies** by exact version/hash.

### Q11. How do secrets end up leaked in an image, and how do you scan for them?

Secrets leak into images in a few classic ways, all rooted in the fact that **image layers are immutable and preserved in history**:

- `COPY . .` sweeps a `.env`, `.pem`, or `.aws/credentials` into a layer (a missing `.dockerignore`).
- `ARG API_KEY` or `ENV API_KEY=...` bakes the value into image metadata, visible via `docker history` / `docker inspect`.
- A `RUN` that uses a secret and then `rm`s it — the secret **still lives in the earlier layer**; deletion in a later layer doesn't erase it.

Detection: run a **secret scanner** over the image and its history — `trufflehog`, `gitleaks`, or Trivy's secret scanner (`trivy image --scanners secret ...`). These grep layers and blobs for high-entropy strings and known key formats (AWS keys, private keys, tokens).

Prevention is the real fix: a strict `.dockerignore`, **BuildKit build secrets** (`RUN --mount=type=secret,id=...` — the secret is mounted only for that step and never persisted to a layer), and injecting runtime secrets via environment/secret managers, never `ARG`/`ENV` at build time. If a secret did ship, treat it as **compromised and rotate it** — you cannot un-ship a layer.

### Q12. How do you secure a container registry?

A registry is a high-value target — it's where trusted images live and what clusters pull from. Hardening:

- **Private, authenticated access** — no anonymous pulls/pushes; require auth for everything.
- **RBAC** — least-privilege roles: most identities pull-only; only CI pushes; separate namespaces/projects per team.
- **Tag immutability** — forbid overwriting an existing tag so an attacker (or a mistake) can't re-point `1.2.3` at different bytes.
- **Scanning at the registry** — continuously re-scan pushed images as new CVEs are disclosed (Harbor/Quay integrate Clair/Trivy).
- **Signing + verification** — require signed images (cosign) and verify signatures on pull/admission.
- **Short-lived credentials** — use OIDC/workload identity (e.g. GitHub Actions OIDC to the registry) instead of long-lived registry passwords.
- **Network controls** — private endpoints, restrict egress, audit logging.

Managed registries (ECR, GCR/Artifact Registry, ACR, GHCR, Harbor) provide most of this out of the box. The senior point: the registry is a **trust boundary** — everything downstream assumes images from it are trustworthy, so its access control and immutability directly determine your supply-chain integrity.

### Q13. How do you enforce that only signed and scanned images run?

With **admission control** — a policy gate that intercepts deployment requests and **rejects** any image that doesn't meet policy, before it ever runs. This moves security from "we hope people scanned" to "unsigned/unscanned images are structurally impossible to deploy."

In Kubernetes:

- **Kyverno** or **OPA/Gatekeeper** — policy engines that verify image signatures (cosign), require a passing scan attestation, forbid `:latest`, block `--privileged`, require non-root, etc. Kyverno has native cosign verification.
- **Kubernetes Binary Authorization** (GKE) / **AWS Signer + admission** — cloud-native equivalents that only admit attested images.

A Kyverno policy conceptually says: "for every image in an incoming Pod, verify it has a valid cosign signature from our CI identity and a provenance attestation from the approved repo; otherwise deny." The verification uses the transparency log / public key from Q7 and the attestations from Q9.

This is the **enforcement point** that makes the rest of the pipeline meaningful — SBOMs, scans, and signatures are only guarantees if something *checks* them at deploy time. It ties Docker's supply-chain story directly into Kubernetes governance.

### Q14. Walk me through a secure build-scan-sign-deploy pipeline.

End to end, each stage a gate:

- **Build** — `FROM` a pinned-by-digest, minimal base (distroless/slim), multi-stage so build tools don't ship. Non-root `USER`. Use BuildKit `--secret` for any build-time credentials. `.dockerignore` in place.
- **Generate SBOM + provenance** — `docker buildx build --sbom=true --provenance=true` so the image carries a bill of materials and build attestation.
- **Scan** — `trivy image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1`. Fail the pipeline on actionable criticals; triage/track the rest.
- **Sign** — `cosign sign` (keyless, using the CI job's OIDC identity), recording in Rekor. Optionally `cosign attest` the SBOM and scan results.
- **Push** — to a private registry with tag immutability and RBAC; CI is the only pusher.
- **Deploy** — an admission controller (Kyverno/OPA) **verifies** the signature and attestations; unsigned or unscanned images are rejected.
- **Continuous** — the registry re-scans stored images; an automated rebuild pipeline bumps base/dependency pins on a cadence and re-runs the whole flow so images stay patched.

The through-line: **every artifact is minimal, inventoried, scanned, signed, and verified**, and the pipeline runs continuously so security doesn't decay.

### Q15. You have 200 images in production. How do you keep them all secure?

This is the automation-and-policy question — the answer must scale, not rely on per-image heroics.

- **Golden base images** — maintain a small set of vetted, minimal, hardened base images that all 200 build `FROM`. Patch once at the base, and every downstream image inherits the fix on rebuild. This collapses 200 patch problems into a handful.
- **Automated rebuilds** — a scheduled pipeline (and Renovate/Dependabot PRs) rebuilds images when a base or dependency updates, re-scans, and re-signs. Nothing stays static long enough to rot.
- **Centralized, continuous scanning** — registry-side scanning re-evaluates every stored image as new CVEs land; a dashboard shows fleet-wide exposure and prioritizes by severity × exploitability × reachability.
- **SBOMs everywhere** — so the next zero-day query is "which of the 200 contain package X?" answered in minutes.
- **Org-wide admission policy** — Kyverno/OPA rules (signed, scanned, non-root, no `:latest`, no `--privileged`) enforced uniformly so a non-compliant image can't reach prod regardless of team.
- **Ownership + SLAs** — each image has an owner and a remediation SLA for criticals; the platform team owns the pipeline, not the fixing of every app.

The senior framing: security at 200 images is a **platform problem** — you solve it with golden bases, automated rebuilds, centralized scanning, SBOM-driven response, and enforced policy, so that "secure" is the default path and drift is caught automatically.

## Debugging & Troubleshooting

### Summary

**What this topic covers**

When a container misbehaves — exits instantly, won't start, can't reach another service, gets OOMKilled, or the build fails — you need a **systematic triage flow** and fluency with the debugging toolkit. This topic covers the core commands (`docker logs`, `exec`, `inspect`, `ps -a`, `stats`, `events`, `top`, `diff`), the canonical failure modes (**"container exits immediately"**, reading **exit codes** like 137/143/1/125), **build failure** debugging, debugging **shell-less distroless/scratch** containers, **disk bloat** (`docker system df` / `prune` — the #1 ops annoyance), **networking** debugging, permission/mount issues, and the classic **"works locally but not in CI."** Across the 16 questions the theme is the same: containers fail in a small number of well-understood ways, and knowing *which command tells you which thing* turns a mystery into a five-minute diagnosis.

**Mental model**

A container is **a single process (PID 1) with an isolated view of the filesystem, network, and resources.** Almost every failure maps to one of those: **the process** (it exited, crashed, or was never long-running), **the filesystem** (missing file, wrong path, permission, bad mount), **the network** (wrong host, no DNS, wrong port), or **resources** (OOM, CPU throttling). So the triage flow is always: *is the container running or exited?* (`docker ps -a`) → *why did it exit?* (exit code via `inspect`, was it `OOMKilled`?) → *what did it say?* (`docker logs`) → *what's its actual config?* (`inspect` for mounts, env, networks, entrypoint) → *get inside and reproduce* (`exec` into a running one, or override the entrypoint with a shell for a crashing one). The single most important reframe for beginners: a container **is not a machine that stays up** — it lives exactly as long as PID 1 lives. If PID 1 exits, the container exits. Most "it won't stay running" bugs are really "your main process finished or died."

**Key terms**

- **`docker logs`** — stdout/stderr of PID 1; `-f` follow, `--tail N`, `--since`, `--timestamps`. Only works with the `json-file`/`local` logging drivers; useless if logs go elsewhere.
- **`docker exec -it <c> sh`** — run a shell (or any command) inside a *running* container to poke around. `-it` = interactive TTY.
- **`docker inspect`** — full JSON of config/state/mounts/networks. `.State.ExitCode`, `.State.OOMKilled`, `.State.Error` are the money fields.
- **`docker ps -a`** — list all containers including **exited** ones (plain `ps` hides them); shows status and exit code.
- **`docker stats`** — live CPU/mem/net/IO per container.
- **`docker events`** — real-time stream of daemon events (create, die, oom, kill).
- **`docker top` / `docker diff`** — processes inside a container / filesystem changes vs the image.
- **Exit code** — PID 1's exit status. 137 = SIGKILL (often OOM), 143 = SIGTERM, 139 = SIGSEGV, 125/126/127 = docker/exec errors.
- **`OOMKilled`** — the kernel killed the container for exceeding its memory limit; surfaces as exit 137 and `.State.OOMKilled=true`.
- **`docker system df` / `prune`** — show disk usage / reclaim space from stopped containers, dangling images, unused volumes, and build cache.
- **`--progress=plain`** — full, unfolded BuildKit build output for debugging build failures.
- **`docker debug` / ephemeral container** — attach a shell/toolbox to a container that has no shell of its own (distroless/scratch).

**Why interviewers ask this**

Debugging is where **real operational experience** shows immediately — you cannot fake it from a textbook. A junior candidate says "I'd check the logs" and stops. A senior candidate has a **flow**: `ps -a` to see it exited, `inspect` for the exit code and OOM flag, `logs` for the last words, override the entrypoint with a shell to reproduce, and they can *read* exit code 137 as "the kernel OOM-killed it, check the memory limit." Interviewers love the "container exits immediately" and "two services can't connect" prompts because they instantly reveal whether you understand the PID-1 model and Docker networking. And the disk-bloat question ("the Docker host is full") is asked because it's the single most common real-world ops incident — everyone who has run Docker in anger has fought `docker system df` and dangling build cache. Fluency here signals you've actually operated containers, not just built them.

**Common confusions**

- "The container crashed" when it actually **exited 0** — a one-shot process that finished successfully. Nothing crashed; nothing kept PID 1 alive.
- "`docker logs` shows nothing, so nothing happened" — the app may log to a file inside the container, or use a logging driver that doesn't support `docker logs`. Absence of logs isn't absence of output.
- "Exit 137 always means OOM" — 137 = 128 + 9 (SIGKILL). OOM is the common cause, but any `SIGKILL` (e.g. `docker kill`, a failed healthcheck-triggered kill, a manual `kill -9`) produces 137. Check `.State.OOMKilled` to disambiguate.
- "I'll just `exec` in to debug" — works only if the container is **running** and **has a shell**. A crash-looping or distroless container gives you neither; you override the entrypoint or use an ephemeral debug container.
- "`docker system prune` is safe" — plain prune removes stopped containers, dangling images, and unused networks; **`-a` also removes all unused images**, and adding `--volumes` deletes unused volumes (your data). The `-a`/`--volumes` flags are the dangerous ones.
- "Works locally so it's fine" — CI differs in architecture (arm64 vs amd64), cold build cache, and build context (`.dockerignore` / uncommitted files). "Works on my machine" is usually one of those three.

**What follows from this topic**

Debugging draws on every earlier topic: reading exit codes requires the **PID 1 / signals** model from ENTRYPOINT vs CMD; "exits immediately" is the flip side of the container-lifecycle basics; networking debugging needs the **user-defined bridge / DNS** knowledge; OOM debugging needs **cgroup resource limits**; the shell-less-container problem is the debuggability cost of the **minimal images** from the security topic. This topic is the practical bridge into the capstone **Scenario & Best-Practice Playbooks**, where several questions ("container exits with code 0", "OOMKilled 137", "two compose services can't connect", "disk full on the host") are exactly these failure modes presented as scenarios to diagnose and fix.

### Q1. What is your toolkit for debugging a container? Name the commands.

The core kit, roughly in order of use:

- **`docker ps -a`** — is it running or exited, and with what status/exit code? (`-a` shows exited containers that plain `ps` hides.)
- **`docker logs -f --tail 100 --timestamps <c>`** — what did the process say on stdout/stderr? Follow live, show the tail, add timestamps.
- **`docker inspect <c>`** — the full config/state JSON: `.State.ExitCode`, `.State.OOMKilled`, `.State.Error`, mounts, env, networks, entrypoint/cmd.
- **`docker exec -it <c> sh`** — get a shell inside a *running* container to inspect the filesystem, env, and network from the inside.
- **`docker stats`** — live CPU/memory/IO; is it hitting its limit?
- **`docker events`** — real-time daemon event stream (create/die/oom/kill) — great for catching *why* something died.
- **`docker top <c>`** — processes running inside the container.
- **`docker diff <c>`** — files added/changed/deleted vs the image (spot unexpected writes).
- **`docker cp <c>:/path ./`** — pull a file out for inspection.

The mental flow: `ps -a` (state) → `inspect` (exit code / OOM / config) → `logs` (what it said) → `exec` or entrypoint-override (get inside and reproduce).

### Q2. `docker logs` shows nothing. What's going on?

Several possibilities, all worth checking:

- **The app doesn't log to stdout/stderr.** `docker logs` only shows PID 1's stdout/stderr. If the app writes to a file inside the container (`/var/log/app.log`), `docker logs` sees nothing — `exec` in and read the file, or reconfigure the app to log to stdout (the twelve-factor way).
- **The logging driver isn't `json-file`/`local`.** `docker logs` only works with those drivers. If the daemon or container uses `syslog`, `journald`, `awslogs`, `gelf`, etc., `docker logs` returns an error or nothing — the logs are in that destination instead. Check `docker inspect --format '{{.HostConfig.LogConfig.Type}}' <c>`.
- **The container exited instantly** and buffered output was lost, or it never got far enough to log. Check `docker ps -a` for the exit code.
- **Output buffering** — some runtimes buffer stdout when not a TTY, so logs appear only on flush/exit. Force unbuffered (`PYTHONUNBUFFERED=1`, `stdbuf`, or the language's flush).

The reframe: no logs ≠ nothing happened. Confirm *where* the app logs and *which driver* is configured before concluding it's silent.

### Q3. A container exits immediately. How do you diagnose it?

The root cause is almost always: **PID 1 finished or died.** A container lives exactly as long as its main process. Diagnose in order:

- **`docker ps -a`** — confirm it exited and read the **exit code**. Code 0 = the process finished normally (it wasn't a long-running server — e.g. you ran `bash` with no TTY, or a script that just completed). Non-zero = it crashed.
- **`docker logs <c>`** — the last words before it died. A stack trace, "config not found", "bind: permission denied", etc.
- **`docker inspect <c>`** — check `.State.ExitCode` and `.State.Error`, and verify `.Config.Cmd`/`.Config.Entrypoint` are what you expect (a typo'd CMD is a classic).
- **Override the entrypoint and get a shell** to reproduce interactively:

```bash
docker run -it --entrypoint sh myregistry/app:1.2.3
# now run the real command by hand and watch it fail
node server.js
```

Common causes: the CMD is a one-shot command not a server; the app crashes on startup (missing env/config/file); the wrong CMD or a shell-form quoting bug; a foreground process that daemonizes and exits (e.g. running a service with a `-D`/background flag so PID 1 returns immediately). The fix is usually to make PID 1 a real, foreground, long-running process.

### Q4. What do container exit codes mean? Read a few for me.

The exit code is PID 1's status; the `128 + N` ones mean "killed by signal N."

| Code | Meaning |
|---|---|
| **0** | Success — the process finished normally (for a server, usually means it wasn't meant to exit). |
| **1** | Generic application error / unhandled exception. |
| **125** | The `docker run` command itself failed (bad flag, image issue) — Docker-level, before the container started. |
| **126** | The command was found but **not executable** (permission, not a binary). |
| **127** | The command was **not found** (bad path, missing binary/shell — common with `sh` vs `bash` in minimal images). |
| **137** | 128 + 9 = **SIGKILL**. Usually **OOMKilled** (check `.State.OOMKilled`), or a `docker kill`/`kill -9`. |
| **139** | 128 + 11 = **SIGSEGV** — segfault (native crash, bad memory access). |
| **143** | 128 + 15 = **SIGTERM** — graceful stop signal (e.g. `docker stop`); normal shutdown. |

Reading them: 137 with `OOMKilled=true` → raise the memory limit or fix the leak. 143 → it was asked to stop (normal). 127 → your CMD path/binary is wrong (often `sh` when the image only has `bash`, or a distroless image with no shell). 126 → forgot `chmod +x` on an entrypoint script. These codes turn "it died" into a specific, actionable diagnosis.

### Q5. How do you debug a Docker build that fails?

- **Read which layer/step failed.** BuildKit prints the failing instruction; the error is usually right there (a failed `RUN`, a missing `COPY` source).
- **`--progress=plain`** — BuildKit folds output by default; plain mode shows the full, unabbreviated command output so you can see the actual error:

```bash
docker build --progress=plain --no-cache -t myregistry/app:1.2.3 .
```

- **`--no-cache`** — rule out a stale cache masking or causing the issue.
- **Build up to a stage with `--target`** and run *that* as a container to poke around at the point just before failure:

```bash
docker build --target builder -t debug-build .
docker run -it debug-build sh   # inspect state right before the failing step
```

- **Run the last successful layer.** BuildKit prints image IDs for completed steps; `docker run -it <that-id> sh`, then execute the failing command by hand and watch it fail with full output.
- **Check the build context** — a `COPY` that fails "not found" is often a `.dockerignore` excluding the file, a wrong path relative to the context, or an uncommitted file.

The pattern: isolate the failing step, reproduce it interactively at that exact point, and read the real (unfolded) error.

### Q6. How do you debug a distroless or scratch container that has no shell?

You can't `exec ... sh` because there's no shell (and no `ls`, `cat`, etc.) — that's the whole point of distroless/scratch. Options:

- **`docker debug <container>`** (Docker Desktop / recent Docker) — attaches a debugging toolbox (shell + tools) to the running container's namespaces without modifying the image. The cleanest option.
- **Ephemeral / sidecar debug container** — in Kubernetes, `kubectl debug -it <pod> --image=busybox --target=<container>` attaches an ephemeral container sharing the target's process/network namespace, giving you tools against the same environment.
- **A debug build target** — keep a `debug` stage in your Dockerfile that uses a shell-bearing base (`FROM alpine`) with the same app, and run that when you need to poke around, shipping the distroless stage to prod.
- **`nsenter` from the host** — enter the container's namespaces from the host with host tools: `nsenter -t <pid> -m -n -p sh` (needs host access and the container's PID from `docker inspect`).
- **`docker cp`** — pull files out (or copy a static `busybox` in) for offline inspection.

The trade-off to name in the interview: distroless minimizes CVE surface and attack tooling but costs you in-container debuggability — so you shift debugging to ephemeral containers and host-side tools rather than baking a shell back into prod.

### Q7. The Docker host is out of disk. What's eating it and how do you reclaim it?

Start with the map, then reclaim selectively.

```bash
docker system df          # summary: images, containers, volumes, build cache
docker system df -v       # verbose: per-object sizes, what's dangling
```

The usual culprits, in rough order of surprise:

- **Build cache** — BuildKit cache layers accumulate silently and are often the biggest consumer. `docker builder prune`.
- **Dangling images** — untagged `<none>` layers from rebuilds. `docker image prune`.
- **Stopped containers** — exited containers still hold their writable layer. `docker container prune`.
- **Unused volumes** — orphaned named/anonymous volumes; **these hold data**, so prune with care. `docker volume prune`.

Reclaim, escalating carefully:

```bash
docker system prune              # stopped containers + dangling images + unused networks + build cache
docker system prune -a           # ALSO removes ALL unused images (not just dangling) — aggressive
docker system prune -a --volumes # ALSO deletes unused volumes — DANGER: data loss
```

The danger flags to call out: **`-a`** removes every image not currently used by a container (you'll re-pull/rebuild), and **`--volumes`** deletes data. In CI/ephemeral runners, aggressive pruning is fine and often necessary; on a shared or stateful host, prune conservatively and never `--volumes` without checking what's in them. This is the single most common Docker ops incident, so having the `system df` → targeted `prune` flow ready is a strong signal.

### Q8. How do you debug container-to-container networking?

Work from inside the containers and inspect the network config:

- **`exec` in and test connectivity:**

```bash
docker exec -it web sh
nslookup db          # does the service name resolve? (needs a user-defined network)
ping db              # is it reachable?
curl http://db:5432  # can you actually connect on the right port?
```

- **Check they share a user-defined network.** On the default `bridge`, containers get **no DNS** — name resolution (`db`) only works on a **user-defined bridge**. `docker network inspect <net>` shows which containers are attached and their IPs. If `nslookup db` fails, they're likely on different networks or on the default bridge.
- **Verify the port.** Confirm the target actually listens on the port you're hitting (and on `0.0.0.0`, not `127.0.0.1` — a service bound to loopback inside its container is unreachable from peers). `EXPOSE` is documentation only; it doesn't publish or open anything.
- **Host vs container port.** `-p 8080:80` only matters for host→container; container→container uses the **container** port on the shared network, not the published host port.
- **DNS/name.** In Compose, the service *name* is the hostname; a typo or using `localhost` (which means "this container", not the peer) is the classic bug.

The flow: same network? → does the name resolve? → is the peer listening on that port and interface? → firewall/iptables only if all that checks out.

### Q9. A container has permission or mount errors. How do you debug?

Permission and mount problems come from the collision between the **container's UID** and **host file ownership**, or a misconfigured mount.

- **`docker inspect` the mounts** — check `.Mounts` for the source, destination, type (bind vs volume), and `RW`/`RO`. A read-only mount (or `--read-only` root) turns writes into `EACCES`/`EROFS`.
- **UID mismatch on bind mounts** — the file's owner UID on the host must be writable by the container's user. A container running as UID 10001 can't write a host directory owned by UID 0. Check with `exec -it <c> id` and `ls -ln` the mount path inside. Fix by `chown`ing the host dir, running the container with a matching `--user`, or (dev only) relaxing perms.
- **SELinux/`:z`/`:Z`** — on SELinux hosts, bind mounts need the `:z` (shared) or `:Z` (private) relabel suffix or the container gets "permission denied" despite correct UNIX perms.
- **Named volume vs empty dir** — mounting a fresh named volume over a populated image path can shadow the image's files (or, on first use, copy them in — behavior differs between volumes and bind mounts). `docker diff` and listing the path inside help spot this.
- **Non-root can't bind low ports** — an app as non-root failing to bind port 80 needs a port >1024 or added capability.

Diagnose from inside (`exec ... id`, `ls -ln`, try the write by hand) and cross-check against the host ownership.

### Q10. "It works locally but fails in CI." How do you approach it?

CI differs from your laptop in a few predictable ways — check them in order:

- **Architecture / platform.** Your Mac may be arm64, the CI runner amd64 (or vice versa). An image or binary built for one arch fails on the other. Reproduce with `docker build --platform linux/amd64` locally, or use `buildx` for multi-arch. `exec ... uname -m` to confirm.
- **Cold build cache.** Locally your cache is warm and hides ordering bugs or a step that only works because a cached layer had something. CI starts cold — `docker build --no-cache` locally to reproduce, and check for steps that depend on cached state.
- **Build context / `.dockerignore`.** Locally you may have uncommitted files, a populated `.env`, or `node_modules` that `COPY` into the image; CI has only what's committed. A `COPY` that "works locally" but fails in CI is usually copying something not in git, or `.dockerignore` differs. Do a clean `git clone` to a temp dir and build there.
- **Env / secrets / network.** CI may lack env vars, registry credentials, or network access your laptop has.
- **Resource limits.** CI runners often have less RAM — a build or test that passes locally may OOM (exit 137) in CI.

The unifying idea: make your local build match CI (clean checkout, same platform, cold cache) and the divergence reveals itself.

### Q11. How do you diagnose an OOMKilled container?

Confirm it, then decide leak vs limit.

- **Confirm OOM:** `docker inspect <c>` → `.State.OOMKilled == true` and `.State.ExitCode == 137`. `docker events` also emits an `oom` event at kill time. (137 alone isn't proof — any SIGKILL yields 137; the `OOMKilled` flag disambiguates.)
- **Find the limit:** the container exceeded its memory cgroup limit (`--memory` / compose `mem_limit` / K8s limit). `docker stats` shows live usage vs limit — watch it climb toward the ceiling before the kill.
- **Leak vs under-provisioned:** if usage grows unbounded over time → a **memory leak** in the app; profile it. If it spikes to a steady high plateau that's simply above the limit → the limit is **too low**; raise it. A JVM/Node process that ignores the cgroup limit and sizes its heap to the *host's* memory is a classic cause — set `-Xmx`/`--max-old-space-size` or use container-aware runtime flags.
- **Fix:** raise the limit if legitimately needed, fix the leak if unbounded, and make the runtime cgroup-aware so it sizes itself to the container, not the host.

Name the nuance: without a memory limit, the container can consume host memory until the **host** OOM-kills something — so limits protect the host, and 137+`OOMKilled` is the container hitting *its* limit specifically.

### Q12. A HEALTHCHECK keeps failing / marking the container unhealthy. How do you debug?

A HEALTHCHECK runs a command inside the container on an interval; non-zero marks it `unhealthy`. Debug the command itself:

- **See the status and last output:** `docker inspect --format '{{json .State.Health}}' <c>` shows the current health state and the **last few probe results with their output** — the actual error the check returned is right there.
- **Run the check by hand:** `exec` in and run the exact healthcheck command; watch it fail. Common issues: the check uses `curl`/`wget` but the **minimal image has neither**; it hits `localhost:PORT` but the app binds a different interface/port; the app is slow to start and the `--start-period` is too short so it's killed during warmup.
- **Timing knobs:** `--interval`, `--timeout`, `--retries`, `--start-period`. A check that's correct but too aggressive (short timeout on a slow endpoint, no start period on a slow-booting app) flaps. Tune these.
- **Dependency, not health:** if the check passes standalone but the container is marked unhealthy under load, the endpoint may be genuinely failing (DB down, thread pool exhausted) — that's the app, and the healthcheck is doing its job.

The gotcha to call out: this matters beyond cosmetics — compose `depends_on: condition: service_healthy` and orchestrator restart/routing decisions all key off health, so a broken healthcheck can block dependent services from starting or cause restart loops.

### Q13. How do you inspect what changed in a running container's filesystem?

**`docker diff <container>`** lists every path that has been **A**dded, **C**hanged, or **D**eleted relative to the image, in the container's writable layer:

```bash
docker diff web
# A /app/tmp/upload-123
# C /etc/nginx/nginx.conf
# D /app/cache/stale
```

It's invaluable for spotting **unexpected writes** — an app writing to a path you thought was read-only, a process filling the writable layer (and thus disk), a config being mutated at runtime, or confirming whether data is going to a volume (won't appear in `diff`) vs the ephemeral writable layer (will).

Pair it with:

- **`docker exec -it <c> sh`** then `ls`/`cat` to inspect the actual contents of changed paths.
- **`docker cp <c>:/path/file ./`** to extract a file for offline inspection or comparison.
- **`docker inspect`** `.Mounts` to see which paths are volumes/binds (persistent) vs part of the writable layer (ephemeral).

The insight `diff` reinforces: everything not on a mount lives in the throwaway writable layer — so if you see important data showing up in `docker diff`, it's **not persisted** and will vanish when the container is removed.

### Q14. Give me a systematic triage flow for "my container isn't working."

A repeatable order that narrows the cause fast:

- **1. State — is it running or exited?** `docker ps -a`. Exited → read the **exit code** immediately (0 = finished normally, 137 = killed/OOM, 1 = app error, 127 = bad command).
- **2. Why did it exit?** `docker inspect <c>` → `.State.ExitCode`, `.State.OOMKilled`, `.State.Error`. This distinguishes OOM from crash from config error.
- **3. What did it say?** `docker logs --tail 100 --timestamps <c>`. The last log lines usually name the cause (missing config, bind failure, stack trace).
- **4. What's the actual config?** `docker inspect` for the real entrypoint/cmd, env vars, mounts, and networks — verify they're what you *think* they are (typo'd CMD, missing env, wrong mount are all common).
- **5. Reproduce inside.** If running: `exec -it <c> sh` and probe. If crash-looping: `docker run -it --entrypoint sh <image>` and run the command by hand.
- **6. Resources / network if relevant.** `docker stats` for CPU/mem pressure; from inside, `nslookup`/`curl` peers and `docker network inspect` for connectivity.

The discipline: **state → reason → output → config → reproduce → resources**. Most problems are solved by step 3 or 4; the flow stops you thrashing and makes the diagnosis mechanical rather than a guessing game.

### Q15. `docker stats`, `docker top`, `docker events` — when do you reach for each?

Three different lenses on a running system:

- **`docker stats`** — live **resource** view: per-container CPU %, memory usage/limit, network and block IO, streaming. Reach for it when a container is slow, suspected of a leak, or you're checking headroom against limits before an OOM. `docker stats --no-stream` for a one-shot snapshot (e.g. in scripts).
- **`docker top <c>`** — the **processes** running inside a specific container (like `ps` scoped to that container's PID namespace). Reach for it to answer "is my process actually running / did it fork children / is PID 1 what I expect?" — e.g. confirming a shell-form CMD spawned `sh` as PID 1 with your app as a child (the signal-handling trap).
- **`docker events`** — the daemon's real-time **event stream** across all containers: `create`, `start`, `die`, `kill`, `oom`, `destroy`, health status changes. Reach for it to catch *why and when* something happened — leave `docker events` running and reproduce the fault to see the exact sequence (e.g. an `oom` immediately followed by `die` with exit 137). Filter with `--filter event=die` / `--since`.

Rule of thumb: **stats** = how much is it using, **top** = what's running inside, **events** = what just happened to it.

### Q16. How do you get files into and out of a container for debugging?

**`docker cp`** copies between the host and a container's filesystem, in either direction, and works on **running or stopped** containers:

```bash
docker cp web:/var/log/app.log ./app.log      # pull a log/artifact OUT
docker cp ./fixed-config.yml web:/app/config.yml  # push a file IN
docker cp web:/app/. ./container-app-dump/      # copy a whole directory out
```

Use it to extract logs the app wrote to a file (not stdout), pull a core dump or heap dump for offline analysis, grab a generated artifact from a build container, or inject a corrected config/test fixture without rebuilding the image.

Alternatives and when they're better:

- **`exec` + redirect** for quick reads when the container is running and has a shell: `docker exec web cat /app/config.yml`.
- **Volumes/bind mounts** if you need *ongoing* file access during a debug session (mount a host dir so changes are live both ways) rather than one-shot copies.
- **`docker export`** to dump a container's entire filesystem as a tar for forensic inspection, or **`docker save`** for the image layers.

Note that `docker cp` into a running container bypasses the image and writes to the live writable layer — handy for debugging, but not a substitute for rebuilding the image with the fix. And you can `cp` a static `busybox` into a shell-less container as a quick way to get basic tools.

## Scenario & Best-Practice Playbooks

### Summary

**What this topic covers**

This is the **capstone** — the interview segment where you stop reciting definitions and start **writing Dockerfiles, spotting anti-patterns, and debugging broken setups live.** The 17 questions split into two kinds. **Write/design tasks:** produce a production Dockerfile for a Go service (multi-stage → scratch/distroless, static binary, non-root), a Node app (build stage + prod-only deps, `--init`/dumb-init, cached `node_modules` layer), a Python app (slim base, no dev deps, the alpine/wheels caveat); compose a local stack (web + Postgres + Redis with a user-defined network, healthchecks + `depends_on` conditions, a named volume, `.env`); and make CI builds fast (layer ordering, registry cache, `.dockerignore`). **Spot-the-anti-pattern / debug-and-fix tasks:** slim a 2GB image, fix a cache that never hits in CI, explain a container that exits 0 immediately, diagnose an OOMKill (137), fix two Compose services that can't connect, remove secrets baked into layers, fix a container that won't stop gracefully, harden one running as root / `--privileged` / mounting `docker.sock`, reclaim a full Docker host, choose between Docker-in-Docker options for CI, and map Compose to Kubernetes. Every answer here is **concrete** — real snippets, real fixes, named anti-patterns.

**Mental model**

For **any** Docker design or debug question, evaluate against five axes — they're your checklist and your decision tree:

- **What runs as PID 1?** Is it a real, foreground, long-running process in **exec form** so it receives SIGTERM and shuts down gracefully? (Signals, `--init`, zombie reaping.)
- **How small and secure is the image?** Multi-stage build, minimal base (distroless/scratch/slim), non-root `USER`, no secrets in layers, pinned base. (Size = CVE surface = pull time.)
- **Is data persisted correctly?** Named volumes for stateful data, the writable layer is ephemeral, `.env` for config.
- **How do services find each other?** User-defined network for DNS-by-name, correct ports, healthchecks + `depends_on: condition` for ordering.
- **Is the build cacheable?** Copy dependency manifests and install deps *before* copying source; a `.dockerignore`; registry cache for ephemeral CI runners.

When you write, you satisfy all five. When you debug, you find which one is violated. That's the whole topic in one frame: **PID 1, image, data, networking, cache.**

**Key terms**

- **Multi-stage build** — a fat build stage compiles/installs; a minimal final stage `COPY --from=` only the artifact. The single biggest size and security lever.
- **Exec form vs shell form** — `CMD ["app"]` (PID 1 is the app, gets signals) vs `CMD app` (wrapped in `/bin/sh -c`, swallows SIGTERM → no graceful shutdown).
- **`--init` / dumb-init / tini** — a tiny init as PID 1 to forward signals and reap zombies.
- **`.dockerignore`** — excludes files from the build context; prevents secrets/`node_modules`/`.git` bloating the image and busting the cache.
- **Layer ordering** — least-to-most-frequently-changing; deps before source so a code edit doesn't reinstall dependencies.
- **Registry build cache** — `--cache-from`/`--cache-to` pushing BuildKit cache to a registry so ephemeral CI runners get cache hits.
- **BuildKit secret** — `RUN --mount=type=secret` uses a credential at build time without persisting it to a layer.
- **User-defined bridge network** — provides DNS resolution between containers by service name (the default bridge does not).
- **Named volume** — Docker-managed persistent storage that survives container removal; for databases and stateful data.
- **`depends_on: condition: service_healthy`** — Compose ordering that waits for a dependency's HEALTHCHECK to pass, not just for it to start.
- **DinD vs socket-mount vs Kaniko/Buildah** — the three ways to build images inside CI, with different security/isolation trade-offs.
- **Anti-patterns** — root user, `:latest`, no `.dockerignore`, secrets in layers, single-stage fat images, multiple processes per container, unpinned bases, `--privileged`, mounting `docker.sock`.

**Why interviewers ask this**

This is the **hands-on filter** — the segment that can't be crammed. Reciting "multi-stage builds reduce size" is worthless if you can't *write one* that produces a 10MB Go image, or *look at a fat Dockerfile* and immediately say "single-stage, root user, `latest` base, no `.dockerignore` — here's the rewrite." Interviewers give you a bad Dockerfile and watch you find the anti-patterns; they give you a broken Compose file and watch you diagnose the network; they say "this image is 2GB" and watch whether you reach for multi-stage, a smaller base, layer cleanup, and `dive`. The senior signal is **fluency and judgment under an open prompt**: you write idiomatic, secure, cacheable Dockerfiles by reflex, you name anti-patterns precisely, and you make defensible trade-offs (distroless vs alpine, DinD vs socket-mount, when Compose stops and Kubernetes starts). Everything from every prior topic converges here into "can you actually do this?"

**Common confusions**

- "Slimming an image = using alpine" — base choice is one lever; the big one is **multi-stage** (don't ship the compiler/SDK), plus cleaning up in the same layer and a `.dockerignore`. Alpine on a single-stage build is still fat.
- "The cache doesn't hit in CI, so caching is broken" — CI runners are **ephemeral**, so the local layer cache is empty every run. You need **registry cache** (`--cache-from`/`--cache-to`) or a persistent cache, not a config fix.
- "Exit 0 means it crashed" — exit 0 is **success**; the process finished because it wasn't a long-running server, or the CMD was one-shot. Not a crash.
- "Compose services share `localhost`" — no. Each service is its own network namespace; they reach each other by **service name** over a user-defined network, never `localhost`.
- "`RUN rm secret` removes the secret" — the secret persists in the earlier **layer** and in `docker history`. Use BuildKit secrets or runtime injection, and rotate the leaked value.
- "One container should run my whole app (app + nginx + cron)" — one concern per container; use multiple services. Cramming processes in breaks signals, scaling, and observability.

**What follows from this topic**

Nothing follows — this **is** the integration point. It pulls the PID-1/signals model (ENTRYPOINT vs CMD), multi-stage builds and layer caching (Dockerfile/build topics), volumes and networking (storage/networking topics), resource limits and OOM (runtime topic), security hardening and secrets (Image Security topic), and the triage commands (Debugging topic) into a single applied skill. Treat these questions as a rehearsal: given any prompt, run the five-axis checklist, write or fix the artifact, and name the anti-patterns explicitly. If you can do that fluently, you can handle essentially any Docker interview segment. The natural next step beyond Docker itself is orchestration — the "from Compose to Kubernetes" question is the bridge into the Kubernetes primer.

### Q1. Write a production Dockerfile for a Go service.

Go compiles to a **static binary**, so the ideal is a multi-stage build ending in `scratch` or distroless — a tiny, near-zero-CVE image.

```dockerfile
# build stage
FROM golang:1.22 AS build
WORKDIR /src
# deps first for cache: only re-download when go.mod/go.sum change
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# static, stripped binary; CGO off so it needs no libc
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app ./cmd/server

# final stage: nothing but the binary
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /app /app
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app"]
```

Key choices to call out: **`CGO_ENABLED=0`** makes a fully static binary so `scratch`/`distroless-static` works (no libc needed); **distroless `:nonroot`** gives a minimal base with a built-in non-root user and no shell (tiny CVE surface); **deps copied before source** so the `go mod download` layer caches; **`-ldflags="-s -w"`** strips debug info to shrink the binary; **exec-form `ENTRYPOINT`** so the binary is PID 1 and receives SIGTERM. Result: a few-MB image with no OS packages to patch. Use `scratch` instead of distroless if you also want to drop CA certs management (then `COPY --from=build /etc/ssl/certs ...` if you make HTTPS calls).

### Q2. Write a production Dockerfile for a Node.js app.

Node needs a runtime (can't go to `scratch`), so aim for a slim base, prod-only dependencies, a cached `node_modules` layer, non-root, and a proper init for signals.

```dockerfile
# build stage: full toolchain for native modules / TS build
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# production stage
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
# prod-only deps: smaller, fewer CVEs
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# tini as PID 1 for signal forwarding + zombie reaping
RUN useradd --system --uid 10001 appuser
USER appuser
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
```

Highlights: **`npm ci` from the lockfile** (reproducible, faster than `install`); **copy `package*.json` before source** so deps only reinstall when they change; **`--omit=dev` in the prod stage** so dev/build deps don't ship; **non-root `USER`**; and either **`--init`** at `docker run`/compose or **tini/dumb-init** in the image so Node (which doesn't handle PID-1 signal/zombie duties well) shuts down cleanly on SIGTERM. If you don't add tini, run with `docker run --init`. Node itself needs the exec-form CMD so it gets signals directly.

### Q3. Write a production Dockerfile for a Python app.

Aim for a slim base, no dev dependencies, non-root, and be deliberate about the **alpine/wheels** trap.

```dockerfile
FROM python:3.12-slim AS build
WORKDIR /app
# deps first for cache
COPY requirements.txt .
# install into a venv/prefix we can copy cleanly
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY --from=build /install /usr/local
COPY . .
RUN useradd --system --uid 10001 appuser
USER appuser
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

Points to make: use **`python:3.12-slim`, not `alpine`** — this is the key Python caveat. Alpine uses musl, and many Python packages ship prebuilt **manylinux wheels** for glibc but **not** musl, so on alpine `pip` falls back to **compiling from source**, which means installing a full build toolchain, slower builds, larger images, and occasional breakage. Slim (Debian glibc) gets the fast binary wheels. Also: **`--no-cache-dir`** so pip's cache doesn't bloat the layer, **`PYTHONUNBUFFERED=1`** so logs flush to `docker logs`, **deps before source** for caching, **non-root**, and a real WSGI/ASGI server (gunicorn/uvicorn) not the dev server. Multi-stage keeps build-only artifacts out of the final image.

### Q4. Compose a local dev stack: web app + Postgres + Redis.

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@db:5432/app
      REDIS_URL: redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    networks: [appnet]

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: app
    volumes:
      - dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks: [appnet]

  cache:
    image: redis:7
    networks: [appnet]

volumes:
  dbdata:

networks:
  appnet:
```

What makes this correct: a **user-defined network** (`appnet`) so `web` reaches Postgres as `db` and Redis as `cache` by name (DNS); a **named volume** (`dbdata`) so database data survives `docker compose down` (it wouldn't in the ephemeral writable layer); a **healthcheck + `depends_on: condition: service_healthy`** so `web` waits until Postgres actually accepts connections, not just until the container starts (plain `depends_on` only waits for start — a classic race where the app connects before Postgres is ready); and **`.env`** (`${DB_PASSWORD}`) so the password isn't hardcoded. Note the connection strings use the **service names** as hosts, never `localhost`.

### Q5. How do you make CI Docker builds fast?

Attack it on three fronts — context, ordering, and cache — because CI runners start cold.

- **`.dockerignore`** — exclude `.git`, `node_modules`, `dist`, test data, `.env`. A bloated build context is uploaded to the daemon on every build and can bust the cache; trimming it is the cheapest win.
- **Layer ordering** — copy dependency manifests and install deps **before** copying source, so a code change doesn't re-run `npm ci` / `pip install` / `go mod download`. Order instructions least-to-most-frequently-changing.
- **Registry build cache** — CI runners are **ephemeral**, so the local layer cache is empty every run. Push/pull the cache to a registry with buildx:

```bash
docker buildx build \
  --cache-from=type=registry,ref=myregistry/app:buildcache \
  --cache-to=type=registry,ref=myregistry/app:buildcache,mode=max \
  -t myregistry/app:1.2.3 --push .
```

- **BuildKit cache mounts** for package caches (`RUN --mount=type=cache,target=/root/.npm ...`) so downloaded packages persist across builds.
- **Multi-stage + parallelism** — BuildKit builds independent stages in parallel; only rebuild what changed.
- **Pin the base by digest** to avoid surprise cache invalidation from a moving tag.

The key insight for interviewers: "the cache doesn't work in CI" is almost always the **ephemeral runner** problem, solved by **registry cache**, not by tweaking the Dockerfile.

### Q6. This image is 2GB. Walk me through slimming it.

Diagnose first, then apply the levers in order of impact.

- **Measure** — `docker images` for the total, and **`dive myregistry/app`** (or `docker history`) to see which layers are huge and where space is wasted.
- **Multi-stage build (biggest lever)** — if it's single-stage, you're shipping the compiler/SDK/build deps. Split into a build stage and a minimal final stage that `COPY --from=` only the artifact. This alone often takes GBs to tens of MBs.
- **Smaller base** — `node:20`→`node:20-slim`, `python:3.12`→`slim`, or distroless/scratch for compiled languages. A full `ubuntu`/`debian` base carries hundreds of MB you don't need.
- **Clean up in the same layer** — `apt-get install ... && rm -rf /var/lib/apt/lists/*` in one `RUN` (a separate `RUN rm` doesn't shrink the earlier layer — the bytes persist). `--no-install-recommends`, `npm ci --omit=dev && npm cache clean`, `pip --no-cache-dir`.
- **`.dockerignore`** — stop `COPY . .` from sweeping in `node_modules`, `.git`, build artifacts, test fixtures.
- **Prod-only deps** — don't ship dev/test dependencies.

Order of attack: multi-stage → base image → same-layer cleanup → `.dockerignore` → prod deps. Verify with `dive` that each layer earns its space. The anti-pattern you're fixing is the **single-stage fat image on a full base with no cleanup.**

### Q7. The layer cache never hits in CI. Why, and how do you fix it?

The dominant cause: **CI runners are ephemeral.** Each build runs on a fresh runner with **no local Docker layer cache**, so every layer rebuilds from scratch — it's not a Dockerfile bug, it's that there's no cache to hit.

Fixes, in order:

- **Registry cache with buildx** — export and import the cache to a registry so cold runners can pull it:

```bash
docker buildx build \
  --cache-from=type=registry,ref=myregistry/app:buildcache \
  --cache-to=type=registry,ref=myregistry/app:buildcache,mode=max \
  --push -t myregistry/app:1.2.3 .
```

Or use the CI provider's cache backend (`type=gha` for GitHub Actions).

- **Fix layer ordering** — even with cache available, a bad order kills hit rate: if you `COPY . .` before installing deps, every code change invalidates the dependency layer. Copy manifests → install → then copy source.
- **`.dockerignore`** — an unignored `.git`/`node_modules`/timestamped file changes the context hash every build, invalidating cache. Trim the context so it's stable.
- **Deterministic builds** — non-reproducible steps (unpinned `apt`/`pip`, timestamps, `:latest` bases) invalidate cache unpredictably. Pin versions/digests.

So: **give the ephemeral runner a cache to pull (registry cache), then order layers and trim context so the cache actually hits.**

### Q8. A container exits with code 0 immediately. What's happening?

Exit 0 means **the main process finished successfully** — nothing crashed. The container did exactly what it was told; the "problem" is that PID 1 wasn't a long-running process.

Common causes:

- **The CMD is a one-shot command**, not a server — e.g. `CMD ["echo", "hi"]`, a script that runs and returns, or a REPL/`bash` with no TTY attached (so it reads EOF and exits).
- **The real server was started in the background** and PID 1 returned — e.g. a shell script that launches the app with `&` or a daemon flag (`nginx` without `-g "daemon off;"`, `apache -k start`, a `service ... start` wrapper). The daemon detaches, PID 1 finishes, the container stops.
- **A process manager expected but absent** — the app forks workers and the parent exits.

Diagnose: `docker ps -a` shows exit 0; `docker logs` shows it ran and finished. Fix: make PID 1 a **real foreground process** — `nginx -g "daemon off;"`, run the app directly in the foreground, remove `&`/background flags, or use exec form pointing at the long-running binary. The rule: a container stays up **only** as long as PID 1 runs, so PID 1 must be your actual foreground workload.

### Q9. A container gets OOMKilled (exit 137). Diagnose and fix.

**Confirm it's really OOM:** `docker inspect <c>` → `.State.OOMKilled == true` (exit 137 is `128+9` SIGKILL, which OOM causes but so does any `kill -9`; the flag disambiguates). `docker stats` shows memory climbing toward the limit; `docker events` emits an `oom` event.

**Decide leak vs limit** using the memory curve:

- **Unbounded growth over time** → a **memory leak** in the app. Profile it (heap dumps, language profiler) and fix the leak; raising the limit only delays the kill.
- **Spikes to a high but stable plateau above the limit** → the limit is simply **too low** for legitimate working set. Raise `--memory` / compose `mem_limit` / the K8s limit.

**The classic container cause:** a runtime that sizes itself to the **host's** memory, not the container's cgroup limit. A JVM or Node process picks a heap based on total host RAM and blows past a small container limit. Fix by making the runtime cgroup-aware — JVM: `-XX:MaxRAMPercentage` (or a recent JDK that respects cgroups) / `-Xmx`; Node: `--max-old-space-size`.

**Also note:** with **no** memory limit set, a leaky container can exhaust host memory and trigger the *host* OOM killer, taking down neighbors — so setting limits protects the host, and hitting 137+`OOMKilled` means the container reached *its own* limit.

### Q10. Two Compose services can't connect to each other. Debug it.

Almost always one of three things. Walk the network path:

- **Wrong host — using `localhost`.** Each service is its own network namespace, so `localhost` means "this container," not the peer. `web` must reach Postgres as **`db`** (the service name), not `localhost:5432`. This is the #1 cause.
- **Not on a shared user-defined network.** Compose puts services on a default network with DNS, but if you defined custom `networks:` and a service isn't attached to the shared one, name resolution fails. Confirm both are on the same network; `docker network inspect <net>` lists attached containers. (On the raw default `bridge` outside Compose, there's **no DNS at all** — you'd need a user-defined bridge.)
- **Wrong port / not listening.** The target must listen on the port you're hitting and bind `0.0.0.0`, not `127.0.0.1` (a service bound to loopback inside its container is unreachable from peers). And container→container uses the **container** port, not the published `-p` host port.

Debug from inside:

```bash
docker compose exec web sh
nslookup db          # resolves? -> same network confirmed
nc -zv db 5432       # listening on that port?
```

Fixes: use the **service name** as the host, put both services on the **same network**, hit the **container port**, and make the server **bind 0.0.0.0**.

### Q11. There are secrets baked into the image. How did that happen and how do you fix it?

**How it happens** — image layers are immutable and preserved in `docker history`, so a secret written at build time is permanent even if "removed" later:

- `COPY . .` sweeps in a `.env` / `.pem` / credentials file (missing `.dockerignore`).
- `ARG TOKEN` / `ENV TOKEN=...` bakes the value into image metadata (`docker history --no-trunc` / `docker inspect` reveals it).
- `RUN curl -H "Authorization: $TOKEN" ... && ... ` where the token came via `ARG` — visible in the build history.
- `RUN rm secret` after using it — the secret **still lives in the earlier layer**; deleting in a later layer doesn't erase the bytes.

**Fix:**

- **BuildKit build secrets** — mount the secret only for the step that needs it, never persisting it:

```dockerfile
RUN --mount=type=secret,id=npmtoken \
    NPM_TOKEN=$(cat /run/secrets/npmtoken) npm ci
```

`docker build --secret id=npmtoken,src=./token .`

- **Runtime injection** for app secrets — pass via environment/secret manager (`-e`, Docker/K8s secrets, Vault) at `docker run`, not build time.
- **`.dockerignore`** every secret file so `COPY` can't grab it.
- **Rotate the leaked secret** — you cannot un-ship a layer; treat any baked secret as compromised.

The anti-pattern named: **secrets in `ARG`/`ENV`/copied files** — replace with BuildKit secrets (build) or runtime injection (runtime).

### Q12. The app takes ~10 seconds to stop / doesn't shut down gracefully. Why?

The signal isn't reaching your app as PID 1 — so `docker stop` sends SIGTERM, your app never sees it, waits out the 10s grace period, and Docker SIGKILLs it (exit 137).

The usual cause is **shell-form CMD/ENTRYPOINT**:

```dockerfile
CMD npm start          # shell form -> PID 1 is /bin/sh -c, which does NOT forward SIGTERM
```

`/bin/sh -c "npm start"` runs as PID 1; SIGTERM goes to the shell, which doesn't propagate it to the child, so your app never gets a chance to drain connections and exit. Fixes:

- **Use exec form** so your process is PID 1 and receives signals directly:

```dockerfile
CMD ["node", "server.js"]
```

- **Add an init** for runtimes that don't handle PID-1 duties well (reaping zombies, forwarding signals): `docker run --init`, or bake **tini/dumb-init** as the entrypoint (`ENTRYPOINT ["/usr/bin/tini","--"]`).
- **Handle SIGTERM in the app** — trap it and shut down gracefully (stop accepting new work, drain in-flight, close DB pools, exit). Even with exec form, an app that ignores SIGTERM will still be SIGKILLed after the grace period.
- **Tune `--stop-timeout`/`stop_grace_period`** if graceful drain legitimately needs longer.

The anti-pattern: **shell-form PID 1 swallowing signals.** Exec form + signal handling (+ `--init` where needed) gives clean, fast shutdown.

### Q13. A container runs as root, with `--privileged`, mounting `docker.sock`. Harden it.

Three serious anti-patterns; address each.

- **Running as root** — the container's UID 0 is (without user namespaces) the **host's** UID 0, so a breakout is host root. Fix: create and switch to a non-root `USER` in the Dockerfile, `--user 10001` at runtime, add `--read-only` root FS + a `tmpfs` for scratch, and `--cap-drop ALL` then add back only what's needed (`--cap-add NET_BIND_SERVICE` for low ports).
- **`--privileged`** — disables essentially all isolation (all capabilities, device access, can manipulate the host). Almost never justified. Fix: remove it; grant only the **specific** capability or device the workload truly needs (`--cap-add`, `--device`). If something "needs" privileged, that's usually a design smell to investigate.
- **Mounting `/var/run/docker.sock`** — gives the container **full control of the Docker daemon**, i.e. root on the host (it can start a privileged container mounting `/`). Fix: don't mount it. If the container must build/run images (CI), use a **rootless/socket-less** approach — Kaniko or Buildah for builds, a rootless DinD sidecar, or a remote BuildKit daemon — rather than handing over the host socket.

The through-line: **least privilege** — non-root, drop capabilities, read-only FS, no privileged, no host socket. Enforce it fleet-wide via admission control (Kyverno/OPA rejecting privileged/root/socket-mounting pods).

### Q14. The Docker host disk is full. Fix it now, then prevent it.

**Diagnose:**

```bash
docker system df        # where the space went: images / containers / volumes / build cache
docker system df -v     # per-object detail; spot dangling images and huge build cache
```

Build cache and dangling images are usually the biggest offenders. **Reclaim, escalating carefully:**

```bash
docker builder prune                 # build cache (often the #1 consumer)
docker image prune                   # dangling (<none>) images
docker container prune               # stopped containers
docker system prune                  # the above combined
docker system prune -a               # ALSO all unused images (aggressive; re-pull needed)
docker volume prune                  # unused volumes -- DANGER: this is data
```

Flag the danger: **`-a`** removes every image not in use by a running container, and **volume pruning deletes data** — safe on ephemeral CI hosts, risky on stateful/shared hosts.

**Prevent recurrence:**

- **Scheduled prune** on CI/build hosts (cron `docker system prune -af --filter "until=24h"`), or ephemeral runners that reset each job.
- **Log rotation** — configure the daemon's `json-file` driver with `max-size`/`max-file` so container logs don't grow unbounded (a sneaky disk filler).
- **Build cache caps** — `docker builder prune --keep-storage` / BuildKit GC policy.
- **Monitoring/alerts** on disk usage so it never reaches 100%.

This is the most common Docker ops incident, so the strong answer pairs the immediate `df`→`prune` fix with the preventive automation.

### Q15. You need to build images inside CI. DinD vs socket-mount vs Kaniko/Buildah — pick one.

Three approaches, trading isolation against convenience:

| Approach | How | Trade-offs |
|---|---|---|
| **Socket-mount** (`-v /var/run/docker.sock`) | Container talks to the **host** daemon | Fast, simple, shares host cache. **Insecure** — socket access = host root; builds run on shared host daemon. Avoid on multi-tenant CI. |
| **Docker-in-Docker (DinD)** | A `docker:dind` sidecar runs its own daemon | Isolated from host; clean per-job daemon. Needs **`--privileged`** (a security cost), cache doesn't persist across ephemeral jobs, nested-storage overhead. |
| **Kaniko / Buildah** | **Daemonless** image builders that build from a Dockerfile in userspace | No daemon, **no privileged, no socket** — the most secure for CI/Kubernetes. Buildah is rootless-friendly; Kaniko runs as a pod. Some Dockerfile edge cases and different caching. |

**Recommendation:** for modern CI, especially on Kubernetes, prefer **Kaniko or Buildah** (or a rootless **BuildKit** daemon) — you get image builds **without** handing over the host socket or requiring `--privileged`, which are the two things security teams reject. Use **socket-mount** only on trusted single-tenant runners where you accept the risk for speed. **DinD** when you need a real isolated daemon and can tolerate privileged; pair it with registry cache since its layer cache is ephemeral. The decision axis is **how much privilege you're willing to grant the build** — daemonless builders grant the least.

### Q16. Moving from Compose to Kubernetes — what maps and what doesn't?

Compose and Kubernetes both declare multi-container apps, but K8s is an orchestrator with concerns Compose doesn't have. What **maps** fairly directly:

- **service (Compose)** → **Deployment + Pod** (the container spec, image, env, ports, resource limits carry over).
- **`ports`/publishing** → a **Service** (ClusterIP/NodePort/LoadBalancer) and/or **Ingress**.
- **service-name DNS** → K8s **Service DNS** (`db` → `db.namespace.svc.cluster.local`); the name-based discovery concept survives.
- **named volume** → **PersistentVolumeClaim** (though storage classes/provisioning are more involved).
- **`environment`/`.env`** → **ConfigMap** and **Secret**.
- **healthcheck** → **liveness/readiness/startup probes**.
- **`deploy: replicas`** → Deployment `replicas` (+ HPA for autoscaling).

What **doesn't map / needs rethinking:**

- **`depends_on` ordering** — K8s has no startup ordering; you design for **eventual consistency** (readiness probes, retries, init containers), not "start db before web."
- **`build:`** — K8s doesn't build images; you build in CI and push to a registry first.
- **local bind mounts** for dev — replaced by ConfigMaps/PVCs; the dev-loop is different.
- **single-host networking** — becomes cluster networking (CNI, NetworkPolicies, cross-node).
- **scaling/self-healing/rollouts** — Compose has little; this is K8s's core value-add.

Tools like **Kompose** auto-convert Compose to K8s manifests as a starting point, but you'll hand-tune probes, resources, storage, and ordering. The framing: Compose is **single-host dev orchestration**; Kubernetes is **multi-host production orchestration** — the container images are identical, the surrounding orchestration is a step up.

### Q17. Look at this Dockerfile and list every anti-pattern, then rewrite it.

Given:

```dockerfile
FROM ubuntu:latest
COPY . .
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install -r requirements.txt
ENV API_KEY=sk-secret-123
CMD python3 app.py
```

**Anti-patterns:**

- **`ubuntu:latest`** — unpinned + moving tag → non-reproducible builds and surprise breakage. Use a pinned, purpose-built base (`python:3.12-slim@sha256:...`).
- **`COPY . .` before installing deps** — busts the cache on every code change (deps reinstall) and, with no `.dockerignore`, sweeps in `.git`/secrets/junk. Copy `requirements.txt` first.
- **No `.dockerignore`** — bloat and secret-leak risk.
- **Secret in `ENV API_KEY`** — baked into image metadata forever; inject at runtime instead.
- **Runs as root** — no `USER`; breakout = host root.
- **Single-stage on a full base** — larger than needed; installing pip/apt into the runtime image.
- **`apt-get` without `--no-install-recommends` and no cache cleanup** — extra MBs.
- **Shell-form `CMD`** — PID 1 is `/bin/sh`, swallows SIGTERM → no graceful shutdown.

**Rewrite:**

```dockerfile
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --system --uid 10001 appuser
USER appuser
EXPOSE 8000
CMD ["python3", "app.py"]
```

Plus a `.dockerignore` (`.git`, `__pycache__`, `.env`, tests), the **API key injected at runtime** (`-e API_KEY=...` / secret manager), and for a real service a proper server (gunicorn) and multi-stage if there's a build step. Named the anti-patterns: **latest, cache-busting copy order, no .dockerignore, secret in ENV, root, single-stage fat, shell-form PID 1.**
