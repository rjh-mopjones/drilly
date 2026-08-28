import type { Diagram } from "./types";

export const GITHUB: Diagram = {
  id: "github",
  title: "GitHub",
  question: "Design GitHub (Source Code Hosting)",
  sourceId: "patterns",
  itemId: 39,
  overview: {
    shape:
      "Four subsystems that share nothing but a repository id and a set of SHAs: a stateful git storage layer, a small relational metadata store, a large derived search index, and an event fan-out into CI.",
    beats: [
      "Start from the unit of storage. A git repository is already a database: a content-addressed Merkle DAG of objects plus a small mutable set of refs pointing into it. That means you are not sharding blobs, you are placing stateful databases, and the repository is the shard.",
      "So each repository is assigned three file servers holding a real bare git repo on local NVMe, deliberately placed so no majority sits in one data centre. A stateless proxy resolves owner and name to a repo id, then to the current primary, and forwards the raw git byte stream to it.",
      "A push is a transaction in two phases. Objects first, because they are content-addressed and an unreferenced object is garbage rather than corruption, so an abandoned upload leaves the repository exactly as valid as it was. Then the ref compare-and-swap, which is the commit point, acked only after 2 of 3 replicas have fsynced.",
      "The web application path never touches that transaction. Pull requests, issues and reviews are ordinary relational rows holding two SHAs, and the diff is not stored at all: it is computed on demand from base and head and cached by repo plus those two SHAs, because a force-push moves head out from under an open review.",
      "Forks share one object pool per fork network mounted as a git alternate, so 10,000 forks are 10,000 ref namespaces over one copy of the history rather than 50TB of duplicates. Pools are partitioned by visibility class, because a shared pool makes any object fetchable by raw SHA from every member.",
      "Everything downstream of the ack is deliberately asynchronous. The push publishes an event, and CI, webhook delivery and search indexing consume it, because CI clones alone are 75M/day against 15M pushes and a slow webhook receiver must never be able to fail somebody's push.",
    ],
    crux:
      "The repository is not divisible. Every other storage system in this book spreads load by splitting the unit, but a single git operation walks an arbitrary reachable subgraph and needs every object it reaches present locally, so a popular repository is one stateful thing that must fit on one machine. Read replicas dilute the read side; nothing dilutes the write side.",
    numbers: [
      "~100M repos, ~5PB unique, ~15PB at RF=3",
      "~2,000 git ops/s average, ~175 pushes/s",
      "10,000 forks x 5GB = 50TB, or ~5GB pooled",
    ],
  },
  nodes: [
    {
      id: "replica-set",
      label: "Repository replica set",
      kind: "zone",
      detail: {
        what: "The three file servers that own one repository: an elected primary plus two replicas, spread so no majority sits in a single data centre.",
        why: "This box is the whole answer. Placement, replication, failover and capacity are all per repository, because a git operation needs the reachability closure of what it touches to be locally present.",
        numbers: ["3 replicas per repo", "ack after 2-of-3 fsync", "~15PB across the fleet"],
        breaks:
          "Availability is a fleet number while outages are per repository: a customer can be fully down while two of their three replicas re-replicate a 30GB working set, and the 99.99% SLO never notices.",
      },
    },
    {
      id: "client",
      label: "Git client + browser",
      sub: "HTTPS and SSH",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "Developers running git push, fetch and clone, plus everyone loading a pull request page in a browser.",
        why: "Drawn explicitly because the client owns the half of the protocol the server refuses to do: it supplies the expected old SHA on every ref update, and it is where merge conflict resolution happens.",
        numbers: ["10M DAU x 10 git ops each", "85% fetch or clone, 15% push"],
        breaks:
          "A client that force-pushes sends an all-zeros old SHA, which defeats the compare-and-swap and loses work the server had no way to protect.",
      },
    },
    {
      id: "git-proxy",
      label: "Git proxy fleet",
      sub: "stateless, 30s route cache",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "Stateless L7 servers that terminate TLS or SSH, authenticate the token, translate owner/name into (repo_id, primary, generation) and proxy the bidirectional git byte stream.",
        why: "It exists so that the only stateful thing in the read and write path is the file server itself. Any instance handles any repository, so a crashed proxy costs one retry and the fleet sits behind an ordinary L4 load balancer.",
        numbers: ["~2,000 git ops/s average, ~10,000/s peak", "30s TTL on the route cache"],
        breaks:
          "An in-flight git stream dies with the instance. That is safe only because both upload-pack and receive-pack are retryable at the request level.",
        choice: {
          pick: "Stateless proxies with a cached repo_id to primary lookup, 30s TTL",
          instead: "Route by DNS or a consistent hash straight from the client to the file server.",
          decider:
            "How fast the mapping changes. Primary assignment moves on every failover and every migration, which is routine at 100M repositories, and DNS caching measured in minutes would send pushes to a demoted primary. A 30s cache plus a generation stamp on every forwarded request makes a stale route safe rather than merely unlikely.",
          flips:
            "A single-region deployment of a few thousand repositories where placement is effectively static, so a config file or DNS entry per repository is honest and cheaper to run.",
        },
      },
    },
    {
      id: "primary",
      label: "Primary file server",
      sub: "bare git on local NVMe",
      kind: "database",
      col: 0,
      row: 2,
      parent: "replica-set",
      detail: {
        what: "The elected owner of this repository. Receives the packfile, verifies every object hash, fsyncs, replicates, then compare-and-swaps the ref.",
        why: "Ordering is the design. Objects are written before the ref moves because unreferenced objects are garbage the next GC collects, whereas a ref pointing at objects the fleet does not all have is corruption nobody can repair.",
        numbers: ["~175 pushes/s fleet-wide, ~900/s peak", "p50 repo 5MB, p99 2GB, tail 30GB+"],
        breaks:
          "Per-repository write throughput is one machine and one primary, so a repository whose write rate exceeds a single server has no answer in this design short of splitting the repository, which is a product decision.",
        choice: {
          pick: "A real bare git repository on local NVMe, stateful placement",
          instead: "Stateless interchangeable git servers over a distributed POSIX filesystem or an object store with a filesystem shim.",
          decider:
            "Random object reads per operation against per-read latency. A diff, blame or ancestry walk on a large repository does tens of thousands of random reads scattered through the pack. At 50,000 reads, local NVMe at ~80us is ~4s of I/O; a network filesystem at 500us to 1ms is 25 to 50s, and no shared cache tier holds a busy repository's working set.",
          flips:
            "Below roughly 10,000 total repositories, where you never hit the placement problems that make statefulness expensive, or when a single repository exceeds one machine's disk and stateful placement is simply not available to you.",
        },
      },
    },
    {
      id: "replicas",
      label: "Two replicas, other DCs",
      sub: "quorum before the ref CAS",
      kind: "database",
      col: 0,
      row: 3,
      parent: "replica-set",
      detail: {
        what: "The other two members of the replica set, each holding a full bare git repo, acknowledging an fsync before the primary is allowed to move the ref.",
        why: "Quorum sits before the compare-and-swap, not after. If the ref moved first and the primary died, a promoted replica would hold a ref history the fleet disagrees on; with objects first, the worst case after any crash is unreachable objects.",
        numbers: ["1 to 3ms metro round trip per push", "replica lag SLO p99 under 5s"],
        breaks:
          "One lagging replica means the next failure loses write quorum, and re-replicating a 30GB repository consumes the exact disk bandwidth the survivors need to serve reads.",
        choice: {
          pick: "Three replicas with a cross-DC majority",
          instead: "Five replicas inside one data centre, or erasure coding the objects across the fleet.",
          decider:
            "What a data-centre event costs. Five in one DC removes the 1 to 3ms metro round trip from every push, but a DC-level event becomes a data-loss event. Erasure coding is worse than wrong here: a clone touches hundreds of thousands of objects, so spreading them turns every operation into a distributed traversal and the durability unit is the reachability closure, not the object.",
          flips:
            "Cold or archival repositories nobody runs live git against, where the packfiles can be erasure-coded as opaque blobs, which is exactly what several hosts do for dormant storage.",
        },
      },
    },
    {
      id: "diff-service",
      label: "Diff + merge service",
      sub: "cached by (repo, base, head)",
      kind: "service",
      col: 0,
      row: 4,
      detail: {
        what: "Computes a pull request's diff and merge preview from two SHAs by reading trees out of a replica, and caches the result keyed by repository, base and head.",
        why: "A diff is a pure function of two immutable SHAs, which makes the cache key exact and the entry permanently valid. Storing diffs instead would mean rewriting them every time a force-push moved head.",
        numbers: ["cache key = (repo_id, base_sha, head_sha)", "read from a replica, never the primary"],
        breaks:
          "A force-push moves head_sha out from under an open review, so review comments can be attached to a commit no ref reaches any more.",
        choice: {
          pick: "Compute on demand from the two SHAs, cache by (repo_id, base_sha, head_sha)",
          instead: "Materialise and store the diff on the pull request row when it is opened or updated.",
          decider:
            "Immutability of the key against write amplification. Two SHAs name exactly one diff forever, so a cache hit is free and correct and never invalidates; a stored diff has to be regenerated against ~175 pushes/s of moving heads and is wrong in the window before that happens, on ~1M new PRs and issues a day.",
          flips:
            "Very large diffs that are read constantly and never invalidated, such as a release comparison pinned in a changelog, where paying once to materialise beats recomputing on every view.",
        },
      },
    },
    {
      id: "event-queue",
      label: "Push event queue",
      sub: "durable, published after the ack",
      kind: "queue",
      col: 0,
      row: 5,
      detail: {
        what: "A durable log carrying push_event records of (repo_id, ref, old_sha, new_sha) to CI, webhook delivery and the search indexer.",
        why: "It exists to put every consequence of a push strictly after the ack. CI fan-out and webhook delivery are several times the git traffic humans generate, and a receiver having a bad day must never be able to fail somebody's push.",
        numbers: ["~26M events/day", "15M pushes vs 75M CI clones/day"],
        breaks:
          "Delivery is at-least-once, so every consumer has to be idempotent on (repo_id, new_sha); a duplicated push event means a duplicated CI run unless the scheduler dedupes on SHA.",
        choice: {
          pick: "Durable queue, published after the client has been acked",
          instead: "Fan out to CI, webhooks and the indexer synchronously inside the push.",
          decider:
            "Blast radius against latency budget. A push is acked in about 1s and each one triggers ~5 CI workflows plus ~3 webhook deliveries; doing that inline couples push availability to the slowest external receiver on the internet, which is the one thing in this system you do not control.",
          flips:
            "A single-tenant install where the only consumer is an in-process indexer, and the queue is pure operational cost for a hop that never fails independently.",
        },
      },
    },
    {
      id: "ci",
      label: "CI scheduler + runners",
      sub: "per-org caps, dedup on SHA",
      kind: "service",
      col: 0,
      row: 6,
      detail: {
        what: "Reads .github/workflows at the pushed SHA, enqueues jobs, and runs untrusted code in isolated per-job runners placed near the replica they will clone from.",
        why: "CI is the largest reader in the system, not the largest compute problem. At 870 jobs/s each cloning once, the clone bandwidth against the git layer saturates before the runner CPU does.",
        numbers: ["~870 jobs/s average, ~4,300/s peak", "CI is 43% of all git reads"],
        breaks:
          "A monorepo push can trigger thousands of workflows at once, and without a ceiling the runner pool collapses and takes the git read path with it.",
        choice: {
          pick: "Per-org concurrency caps, priority queues, workflow dedup on SHA, region-local runners",
          instead: "Autoscale runners without a ceiling and let the pool absorb the spike.",
          decider:
            "Where the spike actually lands. One push producing 1,000 jobs is 1,000 clones, and at 870 jobs/s steady state that traffic is already 43% of fleet git reads, so unbounded autoscale converts a CI spike into a storage-layer outage. Dedup on SHA is the single biggest win because repeat triggers collapse into one run.",
          flips:
            "Self-hosted runners owned by the customer, where the pool is their capacity problem and the host's job is only to hand out jobs.",
        },
      },
    },
    {
      id: "web-app",
      label: "Web + API frontend",
      sub: "REST + GraphQL",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The stateless application tier behind the web UI, REST and GraphQL: pull requests, issues, reviews, org and team management.",
        why: "It is a separate path from the git protocol on purpose. The product surface looks unified, but a PR page reads relational rows and a cached diff, and never touches the push transaction.",
        numbers: ["~500M authenticated API and web actions/day", "~1M new issues and PRs/day"],
        breaks:
          "Nothing makes a merge atomic across the git store and the database, so a crash between them leaves a merged branch whose pull request still says open.",
        choice: {
          pick: "Merge takes the expected head_sha and returns 409 if it moved",
          instead: "Server-side merge that resolves whatever is at the tip when the request lands.",
          decider:
            "Mirror the storage layer rather than paper over it. The ref update underneath is already a compare-and-swap on 2 SHAs, so surfacing a 409 gives the API caller exactly the guarantee git gives the CLI; hiding it means the API can merge a commit the reviewer never saw.",
          flips:
            "An internal automation API where the caller genuinely wants last-write-wins on a bot-owned branch, and a 409 is just a retry loop with extra steps.",
        },
      },
    },
    {
      id: "metadata",
      label: "Metadata database",
      sub: "PRs, issues, permissions",
      kind: "database",
      col: 1,
      row: 1,
      detail: {
        what: "A transactional relational store holding pull requests, issues, comments, reviews, check runs, labels and permissions. A PR is (pr_id, repo_id, head_sha, base_sha, state, author_id).",
        why: "Nothing here is git-specific. The rows reference the object graph by hash and never contain it, which is what keeps a small transactional store from inheriting the scaling properties of a 5PB one.",
        numbers: ["~1M issues and PRs/day at ~5KB", "~10TB hot history, ~30TB at RF=3"],
        breaks:
          "It drifts from git and cannot be transactionally tied to it, so a reconciler treats git as authoritative and the UI is eventually consistent on a horizon of seconds to minutes.",
        choice: {
          pick: "A transactional relational store, sharded by repo_id for comments and reviews",
          instead: "Put PR and issue state in the same content-addressed store as the code.",
          decider:
            "Volume and access shape. This is ~5GB/day growing to ~10TB of hot history, joined constantly across users, repos, labels and permissions, which is a relational workload by any measure. It is four orders of magnitude smaller than the git data and shares none of its consistency rules.",
          flips:
            "A design that wants issues to travel with a clone, which some distributed forges do by storing them as git refs, trading queryability for offline completeness.",
        },
      },
    },
    {
      id: "router",
      label: "Routing table",
      sub: "etcd: primary + generation",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "A small consensus store holding repo_id to (primary, replicas[], generation). The controller promotes on primary loss and bumps the generation.",
        why: "Content addressing does not protect you from split brain. Two primaries both accepting pushes to main produce two valid DAG extensions with no hash mismatch to detect, so one of them is a silently lost update. The generation is the fence.",
        numbers: ["~30s RTO for in-region failover", "generation stamped on every forwarded request"],
        breaks:
          "If the lookup is unavailable the proxy serves a stale route, which is safe only because a demoted primary rejects writes stamped with an older generation.",
        choice: {
          pick: "A consensus store (etcd) with a monotonic generation per repository",
          instead: "Keep the routing row in the metadata database, or elect by heartbeat with no fencing token.",
          decider:
            "Whether a demoted primary can still take a write. Promotion is a linearizable decision on 1 row per repository, and without a fencing token an old primary that comes back after a network partition accepts pushes that are then silently lost. A database row gives you the storage but not the election.",
          flips:
            "Deployments small enough for a single-writer control plane, where an operator promotes by hand and the fencing is a human closing a valve.",
        },
      },
    },
    {
      id: "object-pool",
      label: "Fork network object pool",
      sub: "one per visibility class",
      kind: "database",
      col: 1,
      row: 3,
      detail: {
        what: "One shared object store per fork network, mounted by every member as a git alternate. Each fork owns only its own refs plus the objects it uniquely added.",
        why: "A fork is not a copy. Ten thousand forks are ten thousand ref namespaces over one copy of the history, and fork fan-out concentrates on exactly the largest and most-cloned repositories, so the saving lands where storage hurts most.",
        numbers: ["10,000 forks x 5GB = 50TB unpooled", "~5GB pooled, roughly 1,000x less"],
        breaks:
          "A pool leaks: git serves any object by raw SHA regardless of reachability, so a commit pushed to one member is fetchable through any other by anyone who learns the hash, and deleting a repository does not delete its objects.",
        choice: {
          pick: "One shared pool per fork network, partitioned by visibility class",
          instead: "Every fork is a complete independent repository with its own copy of the object graph.",
          decider:
            "Fork fan-out against repository size. 10,000 forks of a 5GB project is 50TB as independent copies versus ~5GB plus per-fork divergence, about 1,000x. Below roughly 10 forks per project the pooling machinery costs more complexity than it saves.",
          flips:
            "When isolation must win: a private fork of a public repository, a repository that must be provably deleted for a takedown or erasure request, or a hard fork that keeps the pool alive for history nobody uses. Each is detached at the cost of a full copy.",
        },
      },
    },
    {
      id: "search",
      label: "Code search index",
      sub: "ngram index, sharded by repo",
      kind: "database",
      col: 1,
      row: 5,
      detail: {
        what: "An inverted ngram index over default-branch working trees, built and served on its own cluster, with shards keyed by repository.",
        why: "Sharding by repository is what makes access control a shard filter rather than a post-filter. Filtering after retrieval leaks existence through timing and result counts, so an inaccessible shard must never be read at all.",
        numbers: ["~50TB unique indexable text", "~150 to 200TB index at 3 to 4x"],
        breaks:
          "Freshness. It has to absorb ~175 pushes/s while a full rebuild takes days, and a stale result is worse than a slow one, so a stale shard degrades to unavailable rather than answering quietly.",
        choice: {
          pick: "A separate ngram inverted index, entirely off the git servers",
          instead: "Run git grep against a warm checkout on the file server that already owns the repository.",
          decider:
            "Corpus size times query rate. git grep over a 200MB tree is ~1 core-second, so one unscoped query over a ~50TB corpus is on the order of 50,000 core-seconds; at 100 queries/s that is 5M cores. The index only pays above roughly 10,000 repositories in scope per query.",
          flips:
            "Repository-scoped search, which should grep the checkout even when the global index exists: at 10 QPS against one repository it needs ~10 cores, never serves a stale result, and handles arbitrary regexes with no trigram rewrite.",
        },
      },
    },
    {
      id: "webhooks",
      label: "Webhook delivery",
      sub: "backoff within 24h window",
      kind: "service",
      col: 1,
      row: 6,
      detail: {
        what: "Workers that deliver HMAC-signed push, pull_request and check_run payloads to subscriber endpoints, with exponential backoff and per-receiver circuit breaking.",
        why: "The queue is not the problem here; delivery concurrency against slow receivers is. One integrator timing out on every request will consume the whole worker pool unless its failures are isolated per receiver.",
        numbers: ["~78M deliveries/day, ~900/s average, ~4,500/s peak", "~550GB at 1KB and 7-day retention"],
        breaks:
          "A persistently failing receiver backs up its own queue, so it is circuit-broken and surfaced to the repository admin rather than retried forever.",
        choice: {
          pick: "At-least-once with HMAC signatures and exponential backoff in a 24h window",
          instead: "Best-effort fire-and-forget, or exactly-once delivery with per-receiver acknowledgement state.",
          decider:
            "What the receiver can do for itself. At ~78M deliveries/day, exactly-once costs dedup state per subscriber for a guarantee the receiver can reconstruct itself from the signed payload id. Fire-and-forget instead drops deploys silently whenever a receiver restarts.",
          flips:
            "Internal consumers on the same message bus, where you already have the log and its offsets and an HTTP delivery hop buys nothing.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "git-proxy",
      label: "git push / fetch",
      animated: true,
      detail: {
        what: "The git smart-HTTP or SSH stream, carrying a packfile on a push and a negotiated set of objects on a fetch.",
        why: "This is the hot path by volume: 85% of git operations are fetches or clones, and the proxy is the only stateless thing standing between the internet and a stateful file server.",
        numbers: ["~2,000 ops/s average, ~10,000/s peak", "85% fetch or clone, 15% push"],
        breaks:
          "Anonymous clones are bandwidth-heavy and free to request, so this edge needs separate rate-limit buckets per IP and per authenticated user or it is an easy target.",
      },
    },
    {
      id: "e2",
      from: "client",
      to: "web-app",
      label: "web + API request",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Ordinary HTTPS traffic for the web UI, REST and GraphQL, entirely separate from the git protocol path.",
        why: "Drawing it as its own arrow is the point: a pull request page is a database read plus a cached diff, and it can be served while the repository's primary is mid-failover.",
        numbers: ["~500M authenticated web and API actions/day"],
        breaks:
          "The two paths have no shared transaction, so the page can show a state the git store has already moved past.",
      },
    },
    {
      id: "e3",
      from: "git-proxy",
      to: "router",
      label: "resolve primary + gen",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Translating owner/name into repo_id, then into the current primary, its replica set and the generation number.",
        why: "It is drawn as a control path because it carries no git data. It exists so the proxy can stay stateless while the thing it routes to moves on every failover and every migration.",
        numbers: ["30s TTL cache at the proxy"],
        breaks:
          "When the consensus store is unavailable the proxy serves the last-known primary and probes in the background, which is only safe because the generation stamp fences a demoted target.",
      },
    },
    {
      id: "e4",
      from: "git-proxy",
      to: "primary",
      label: "receive-pack stream",
      animated: true,
      detail: {
        what: "The forwarded bidirectional git byte stream, stamped with the routing generation the proxy resolved.",
        why: "The proxy forwards rather than terminates because git's protocol is a negotiation: the client and server work out what is missing between them, and nothing in the middle can usefully summarise that.",
        numbers: ["generation stamped per request"],
        breaks:
          "A stream stamped with an old generation is rejected by a primary that has since been demoted, which turns a routing race into a retry rather than a lost update.",
      },
    },
    {
      id: "e5",
      from: "primary",
      to: "replicas",
      label: "packfile, 2-of-3 fsync",
      animated: true,
      detail: {
        what: "Objects streamed to both replicas, with the primary waiting for 2 of 3 fsync acknowledgements before it performs the ref compare-and-swap.",
        why: "The ordering is the entire durability argument. Objects before refs means the worst case after any crash is unreachable objects on some subset of replicas, which the next GC collects rather than a ref history the fleet disagrees on.",
        numbers: ["1 to 3ms metro round trip", "cross-continent would be 30ms+"],
        breaks:
          "Every push pays this round trip, which is tolerable only because pushes are ~175/s fleet-wide and each is dominated by upload time rather than by the quorum.",
      },
    },
    {
      id: "e6",
      from: "primary",
      to: "object-pool",
      label: "shared history alternate",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Object lookups falling through to the fork network's shared pool when the object is not in this repository's own storage.",
        why: "This is the mechanism that makes forking free: a fork contributes only its own new objects, and everything it inherits is resolved through the alternate rather than copied.",
        numbers: ["one pool per fork network per visibility class"],
        breaks:
          "The alternate is a physical sharing relationship, so an object pushed to any member is present for every member and git will serve it by raw SHA whether or not a ref points at it.",
      },
    },
    {
      id: "e7",
      from: "primary",
      to: "event-queue",
      label: "push_event after ack",
      fromSide: "left",
      toSide: "left",
      offset: 70,
      detail: {
        what: "A durable (repo_id, ref, old_sha, new_sha) record published once the ref compare-and-swap has committed and the client has been acked.",
        why: "It is deliberately after the ack. Everything downstream of this arrow, CI, webhooks and indexing, is a consequence of the push rather than part of it, and none of it is allowed to make a push fail.",
        numbers: ["~26M events/day", "push acked in ~1s, mostly upload"],
        breaks:
          "There is no transaction spanning the ref update and the publish, so a crash between them loses the event and the consequences are reconciled from ref state later.",
      },
    },
    {
      id: "e8",
      from: "replicas",
      to: "diff-service",
      label: "objects at base + head",
      detail: {
        what: "Trees and blobs read out of a replica so the diff service can compute a pull request's changes from two SHAs.",
        why: "Diff traffic reads from a replica rather than the primary because it is pure read load, and keeping it off the primary leaves that machine's disk for the write path it alone can serve.",
        numbers: ["tens of thousands of random object reads per diff"],
        breaks:
          "A lagging replica may not yet hold the head SHA the PR row names, so the diff service has to fall back to another replica rather than render an empty diff.",
      },
    },
    {
      id: "e9",
      from: "web-app",
      to: "metadata",
      label: "PR rows, two SHAs",
      detail: {
        what: "Reading and writing pull request, issue, review and permission rows, each carrying base_sha and head_sha rather than any content.",
        why: "The metadata store holds pointers into the object graph, never the graph itself. That is what keeps a transactional relational database at ~10TB while the code it describes is ~5PB.",
        numbers: ["~1M new issues and PRs/day at ~5KB each"],
        breaks:
          "A merge writes a ref on the file server and a state change here with nothing making them atomic, so one of the two can land alone.",
      },
    },
    {
      id: "e10",
      from: "web-app",
      to: "diff-service",
      label: "diff for base..head",
      fromSide: "left",
      toSide: "right",
      offset: 40,
      detail: {
        what: "A request for the diff or merge preview between the two SHAs the pull request row names.",
        why: "Diffs are computed rather than stored, so this hop exists on every PR page view and is what the (repo_id, base_sha, head_sha) cache is protecting.",
        numbers: ["cache key is exact, entries never invalidate"],
        breaks:
          "A force-push moves head_sha, so the next request is a different cache key and the previous diff, along with the review comments anchored in it, refers to a commit no ref reaches.",
      },
    },
    {
      id: "e11",
      from: "event-queue",
      to: "ci",
      label: "workflow jobs at SHA",
      animated: true,
      detail: {
        what: "The push event triggering workflow evaluation: the scheduler reads .github/workflows at the pushed SHA and enqueues jobs.",
        why: "Reading the workflow definition at the pushed SHA rather than at the branch tip is what makes a run reproducible, because the tip may have moved by the time the job starts.",
        numbers: ["~5 workflows per push", "~870 jobs/s average, ~4,300/s peak"],
        breaks:
          "One push can produce thousands of jobs, so this arrow needs per-org caps and SHA-level dedup or it is an amplifier pointed at the git read path.",
      },
    },
    {
      id: "e12",
      from: "event-queue",
      to: "webhooks",
      label: "fan-out, HMAC signed",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Push, pull_request and check_run events handed to the delivery workers for at-least-once HTTP delivery to subscriber endpoints.",
        why: "The queue absorbs the difference between an event rate we control and a delivery rate somebody else's server controls, which is the only reason a slow integrator is their problem rather than ours.",
        numbers: ["~3 subscribers per event", "~78M deliveries/day"],
        breaks:
          "Retries mean receivers see duplicates, which is why payloads are signed and carry an id the receiver can dedupe on.",
      },
    },
    {
      id: "e13",
      from: "event-queue",
      to: "search",
      label: "index update",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "An incremental index update for pushes that touch an indexed default branch.",
        why: "The index is a derived view, so it is fed from the event stream rather than by scanning the git store. Nothing about a push waits for it.",
        numbers: ["~175 pushes/s to absorb", "full rebuild takes days"],
        breaks:
          "If this pipeline falls behind, search silently serves results from a corpus that no longer exists, which is why build lag is a paged metric rather than a dashboard one.",
      },
    },
    {
      id: "e14",
      from: "ci",
      to: "replicas",
      label: "clone at pushed SHA",
      fromSide: "right",
      toSide: "right",
      offset: 90,
      animated: true,
      detail: {
        what: "Every runner cloning the repository at the SHA it was triggered for, served by a read replica in the same region as the runner.",
        why: "This arrow is the largest single consumer of the git layer, and it points back up into the storage the humans are also using. Placing runners next to the replica they clone from is a storage decision dressed as a scheduling one.",
        numbers: ["75M CI clones/day", "43% of all git reads"],
        breaks:
          "At 870 jobs/s the clone bandwidth saturates before the runner compute does, so a fan-out spike degrades everyone's fetches on those replicas.",
      },
    },
  ],
};
