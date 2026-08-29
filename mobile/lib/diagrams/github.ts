import type { Diagram } from "./types";

export const GITHUB: Diagram = {
  id: "github",
  title: "GitHub",
  question: "Design GitHub (Source Code Hosting)",
  sourceId: "patterns",
  itemId: 39,
  overview: {
    shape:
      "Four subsystems share nothing but a repository id and a set of SHAs: git storage, relational metadata, a derived search index, and an event fan-out into CI.",
    forces: [
      {
        constraint: "A single git operation on a 30GB repository needs every reachable object present locally, all at once",
        decision: "Each repository is placed on its own Repository replica set of three file servers rather than sharded across many",
        lights: ["replica-set", "primary", "replicas"],
      },
      {
        constraint: "~2,000 git ops/s average, with 85% fetches and only 15% pushes",
        decision: "A stateless Git proxy fleet resolves routing and forwards the byte stream, so only the file server itself holds state",
        lights: ["git-proxy", "e1", "e4"],
      },
      {
        constraint: "10,000 forks of a 5GB project would be 50TB as independent copies",
        decision: "Forks share one Fork network object pool per visibility class, mounted as a git alternate",
        lights: ["object-pool", "e6"],
      },
      {
        constraint: "CI clones alone are 75M/day against 15M pushes/day",
        decision: "Everything past the ack, CI, webhook delivery and search indexing, consumes the Push event queue asynchronously",
        lights: ["event-queue", "ci", "webhooks", "search", "e7"],
      },
      {
        constraint: "A diff is requested on every one of ~1M new PR and issue views a day",
        decision: "The Diff + merge service computes on demand from two SHAs and caches by (repo, base, head) rather than storing diffs",
        lights: ["diff-service", "e9", "e10"],
      },
    ],
    naive: {
      text: "Store everything, git history, pull requests and search, in one distributed database keyed by repository, and treat a repository like any other row of user data. A large repository does tens of thousands of random object reads per operation. At ~80 microseconds on local NVMe that is already seconds of I/O. Spread across a network filesystem or a shared object store it becomes 25 to 50 seconds. The Primary file server instead holds a real bare git repository on local disk. Read replicas and a Diff + merge service cache keep everything that is not the write path off that one machine.",
      lights: ["primary", "replicas", "diff-service"],
    },
    beats: [
      {
        text: "Start from the unit of storage. A git repository is already a database: a content-addressed Merkle DAG of objects plus a small mutable set of refs pointing into it. That means you are not sharding blobs, you are placing stateful databases, and the repository is the shard.",
        lights: ["replica-set", "primary"],
      },
      {
        text: "So each repository is assigned three file servers holding a real bare git repo on local NVMe, deliberately placed so no majority sits in one data centre. A stateless proxy resolves owner and name to a repo id, then to the current primary, and forwards the raw git byte stream to it.",
        lights: ["git-proxy", "primary", "replicas", "e1", "e4"],
      },
      {
        text: "A push is a transaction in two phases. Objects first, because they are content-addressed and an unreferenced object is garbage rather than corruption, so an abandoned upload leaves the repository exactly as valid as it was. Then the ref compare-and-swap, which is the commit point, acked only after 2 of 3 replicas have fsynced.",
        lights: ["primary", "replicas", "e5"],
      },
      {
        text: "The web application path never touches that transaction. Pull requests, issues and reviews are ordinary relational rows holding two SHAs. The diff is not stored at all: it is computed on demand from base and head, and cached by repo plus those two SHAs. That is because a force-push moves head out from under an open review.",
        lights: ["web-app", "metadata", "diff-service", "e9", "e10"],
      },
      {
        text: "Forks share one object pool per fork network, mounted as a git alternate. That means 10,000 forks are 10,000 ref namespaces over one copy of the history, rather than 50TB of duplicates. Pools are partitioned by visibility class, because a shared pool makes any object fetchable by raw SHA from every member.",
        lights: ["object-pool", "primary", "e6"],
      },
      {
        text: "Everything downstream of the ack is deliberately asynchronous. The push publishes an event, and CI, webhook delivery and search indexing consume it. CI clones alone are 75M/day against 15M pushes, and a slow webhook receiver must never be able to fail somebody's push.",
        lights: ["event-queue", "ci", "webhooks", "search", "e7", "e11", "e12", "e13"],
      },
    ],
    crux: {
      problem:
        "The repository is not divisible. Most storage systems spread load by splitting the unit, but a single git operation walks an arbitrary reachable subgraph. It needs every object it reaches present locally, so a popular repository is one stateful thing that must fit on one machine. Read replicas dilute the read side. Nothing dilutes the write side.",
      handled:
        "Placement keeps a repository's replica set spread so no majority sits in one data centre, which survives a single data-centre failure without splitting the repository. Per-repository write throughput still has a one-machine ceiling with no answer inside this design. A repository whose write rate exceeds one server would need an actual repository split, which is a product decision the design does not make for you.",
    },
    numbers: [
      {
        value: "~100M repos, ~5PB unique, ~15PB at RF=3",
        explain: "The total repository count and the unique git object volume; three-way replication for durability triples it to the number the fleet actually stores.",
      },
      {
        value: "~2,000 git ops/s average, ~175 pushes/s",
        explain: "The steady-state git traffic split between reads and writes; 85% of it is fetches or clones, which is why the proxy fleet and the primary are sized so differently.",
      },
      {
        value: "10,000 forks x 5GB = 50TB, or ~5GB pooled",
        explain: "The cost of one popular repository's fork network as independent copies versus a shared object pool; roughly a 1,000x difference.",
      },
      {
        value: "CI clones alone are 75M/day against 15M pushes/day",
        explain: "CI is the largest reader of the git layer by volume, five times the human push traffic it was triggered by.",
      },
      {
        value: "ack after 2-of-3 fsync",
        explain: "The quorum a push waits for before its ref moves; objects are already durable on two of three replicas by the time a client sees success.",
      },
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
        numbers: [
          { value: "3 replicas per repo", explain: "The replication factor for every repository regardless of size; placement and failover are planned per repository at this same number." },
          { value: "ack after 2-of-3 fsync", explain: "The quorum the primary waits for before the ref moves, which bounds data loss to unreachable objects rather than a disputed history." },
          { value: "~15PB across the fleet", explain: "The unique git object volume at three-way replication; the number the whole storage tier is provisioned against." },
        ],
        breaks: {
          failure: "Availability is a fleet number while outages are per repository.",
          handled: "A customer can be fully down while two of their three replicas re-replicate a 30GB working set, and the 99.99% SLO never notices, since it is measured fleet-wide.",
        },
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
        why: "Drawn explicitly because the client owns the half of the protocol the server refuses to do. It supplies the expected old SHA on every ref update, and it is where merge conflict resolution happens.",
        numbers: [
          { value: "10M DAU x 10 git ops each", explain: "The daily active users and their average git activity; multiplied together this is the baseline load the proxy fleet is sized for." },
          { value: "85% fetch or clone, 15% push", explain: "The split between read and write traffic; it is why 85% of capacity planning is about fetch bandwidth, not write throughput." },
        ],
        breaks: {
          failure: "A client that force-pushes sends an all-zeros old SHA.",
          handled: "That defeats the compare-and-swap and loses work the server had no way to protect, since the client owns the expected-old-SHA half of the protocol.",
        },
      },
    },
    {
      id: "git-proxy",
      label: "Git proxy fleet",
      kind: "service",
      col: 1,
      row: 0,
      sub: "stateless; etcd routes, 30s cache",
      detail: {
        what: "Stateless L7 servers that terminate TLS or SSH, authenticate the token, translate owner/name into (repo_id, primary, generation) and proxy the bidirectional git byte stream.",
        why: "It exists so that the only stateful thing in the read and write path is the file server itself. Any instance handles any repository, so a crashed proxy costs one retry and the fleet sits behind an ordinary L4 load balancer.",
        numbers: [
          {
            value: "~2,000 git ops/s average, ~10,000/s peak",
            explain: "The steady-state and peak load one stateless proxy fleet has to absorb; any instance can serve any repository, so this number sizes the fleet directly.",
          },
          {
            value: "30s TTL on the route cache",
            explain: "How long a cached repo_id-to-primary mapping is trusted before a fresh lookup, chosen to be safe against a failover happening mid-window.",
          },
        ],
        breaks: {
          failure: "An in-flight git stream dies with the instance.",
          handled: "That is safe only because both upload-pack and receive-pack are retryable at the request level, so a dropped connection costs one retry, not a corrupted transfer.",
        },
        choice: {
          pick: "Stateless proxies with a cached repo_id to primary lookup, 30s TTL",
          instead: "Route by DNS or a consistent hash straight from the client to the file server.",
          decider:
            "How fast the mapping changes. Primary assignment moves on every failover and every migration, which is routine at 100M repositories, and DNS caching measured in minutes would send pushes to a demoted primary. A 30s cache plus a generation stamp on every forwarded request makes a stale route safe rather than merely unlikely.",
          flips: "A single-region deployment of a few thousand repositories where placement is effectively static, so a config file or DNS entry per repository is honest and cheaper to run.",
        },
      },
    },
    {
      id: "primary",
      label: "Primary file server",
      sub: "bare git on local NVMe",
      kind: "database",
      col: 2,
      row: 0,
      parent: "replica-set",
      detail: {
        what: "The elected owner of this repository. Receives the packfile, verifies every object hash, fsyncs, replicates, then compare-and-swaps the ref.",
        why: "Ordering is the design. Objects are written before the ref moves because unreferenced objects are garbage the next GC collects. A ref pointing at objects the fleet does not all have is corruption nobody can repair.",
        numbers: [
          { value: "~175 pushes/s fleet-wide, ~900/s peak", explain: "The write rate one machine per repository has to sustain at steady state and at peak; there is no second tier to spread this onto." },
          {
            value: "p50 repo 5MB, p99 2GB, tail 30GB+",
            explain: "The repository-size distribution; the tail is what forces local NVMe rather than a shared or networked store, since a 30GB repo still needs fast random reads.",
          },
        ],
        breaks: {
          failure: "Per-repository write throughput is one machine and one primary.",
          handled: "A repository whose write rate exceeds a single server has no answer in this design short of splitting the repository, which is a product decision, not an engineering one.",
        },
        choice: {
          pick: "A real bare git repository on local NVMe, stateful placement",
          instead: "Stateless interchangeable git servers over a distributed POSIX filesystem or an object store with a filesystem shim.",
          decider:
            "Random object reads per operation against per-read latency. A diff, blame or ancestry walk on a large repository does tens of thousands of random reads scattered through the pack. At 50,000 reads, local NVMe at ~80us is ~4s of I/O. A network filesystem at 500us to 1ms is 25 to 50s, and no shared cache tier holds a busy repository's working set.",
          flips: "Below roughly 10,000 total repositories, where you never hit the placement problems that make statefulness expensive. Or when a single repository exceeds one machine's disk, where stateful placement is simply not available to you.",
        },
      },
    },
    {
      id: "replicas",
      label: "Two replicas, other DCs",
      sub: "quorum before the ref CAS",
      kind: "database",
      col: 3,
      row: 0,
      parent: "replica-set",
      detail: {
        what: "The other two members of the replica set, each holding a full bare git repo, acknowledging an fsync before the primary is allowed to move the ref.",
        why: "Quorum sits before the compare-and-swap, not after. If the ref moved first and the primary died, a promoted replica would hold a ref history the fleet disagrees on. With objects first, the worst case after any crash is unreachable objects.",
        numbers: [
          { value: "1 to 3ms metro round trip per push", explain: "The price of surviving a DC-level event: five replicas in one DC would remove this round trip, but turn any DC outage into a data-loss event instead." },
          { value: "replica lag SLO p99 under 5s", explain: "The freshness bound a replica must meet to keep serving reads; past it a replica risks answering with objects the primary has already moved beyond." },
        ],
        breaks: {
          failure: "One lagging replica means the next failure loses write quorum.",
          handled: "Re-replicating a 30GB repository consumes the exact disk bandwidth the survivors need to serve reads, so a second failure during recovery is the real risk being managed.",
        },
        choice: {
          pick: "Three replicas with a cross-DC majority",
          instead: "Five replicas inside one data centre, or erasure coding the objects across the fleet.",
          decider:
            "What a data-centre event costs. Five in one DC removes the 1 to 3ms metro round trip from every push, but a DC-level event becomes a data-loss event. Erasure coding is worse than wrong here. A clone touches hundreds of thousands of objects, so spreading them turns every operation into a distributed traversal. The durability unit is the reachability closure, not the object.",
          flips: "Cold or archival repositories nobody runs live git against, where the packfiles can be erasure-coded as opaque blobs, which is exactly what several hosts do for dormant storage.",
        },
      },
    },
    {
      id: "diff-service",
      label: "Diff + merge service",
      sub: "cached by (repo, base, head)",
      kind: "service",
      col: 3,
      row: 1,
      detail: {
        what: "Computes a pull request's diff and merge preview from two SHAs by reading trees out of a replica, and caches the result keyed by repository, base and head.",
        why: "A diff is a pure function of two immutable SHAs, which makes the cache key exact and the entry permanently valid. Storing diffs instead would mean rewriting them every time a force-push moved head. It always reads from a replica, never the primary, which keeps diff traffic off the one machine the write path needs.",
        numbers: [
          { value: "3-part cache key: repo id, base SHA, head SHA", explain: "The cache key's three components; because two SHAs name exactly one diff forever, a hit never needs invalidating." },
        ],
        breaks: {
          failure: "A force-push moves head_sha out from under an open review.",
          handled: "Review comments can be attached to a commit no ref reaches any more, so the diff service must serve the old comparison rather than silently render nothing.",
        },
        choice: {
          pick: "Compute on demand from the two SHAs, cache by (repo_id, base_sha, head_sha)",
          instead: "Materialise and store the diff on the pull request row when it is opened or updated.",
          decider:
            "Immutability of the key against write amplification. Two SHAs name exactly one diff forever, so a cache hit is free, correct and never invalidates. A stored diff has to be regenerated against ~175 pushes/s of moving heads, and is wrong in the window before that happens, across ~1M new PRs and issues a day.",
          flips: "Very large diffs that are read constantly and never invalidated, such as a release comparison pinned in a changelog, where paying once to materialise beats recomputing on every view.",
        },
      },
    },
    {
      id: "event-queue",
      label: "Push event queue",
      sub: "durable, published after the ack",
      kind: "queue",
      col: 2,
      row: 2,
      detail: {
        what: "A durable log carrying push_event records of (repo_id, ref, old_sha, new_sha) to CI, webhook delivery and the search indexer.",
        why: "It exists to put every consequence of a push strictly after the ack. CI fan-out and webhook delivery are several times the git traffic humans generate, and a receiver having a bad day must never be able to fail somebody's push.",
        numbers: [
          { value: "~26M events/day", explain: "The event volume flowing through the queue; small next to what it triggers downstream, since one push event fans out to several consumers." },
          { value: "15M pushes vs 75M CI clones/day", explain: "Pushes against the CI clone traffic they trigger; CI alone reads five times more than humans write, which is why this hop exists at all." },
        ],
        breaks: {
          failure: "Delivery is at-least-once, so every consumer has to be idempotent on (repo_id, new_sha).",
          handled: "A duplicated push event means a duplicated CI run unless the scheduler dedupes on SHA, which is why dedup lives in the consumer, not the queue.",
        },
        choice: {
          pick: "Durable queue, published after the client has been acked",
          instead: "Fan out to CI, webhooks and the indexer synchronously inside the push.",
          decider:
            "Blast radius against latency budget. A push is acked in about 1s, and each one triggers ~5 CI workflows plus ~3 webhook deliveries. Doing that inline couples push availability to the slowest external receiver on the internet, the one thing in this system nobody controls.",
          flips: "A single-tenant install where the only consumer is an in-process indexer, and the queue is pure operational cost for a hop that never fails independently.",
        },
      },
    },
    {
      id: "ci",
      label: "CI scheduler + runners",
      sub: "per-org caps, dedup on SHA",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "Reads .github/workflows at the pushed SHA, enqueues jobs, and runs untrusted code in isolated per-job runners placed near the replica they will clone from.",
        why: "CI is the largest reader in the system, not the largest compute problem. At 870 jobs/s each cloning once, the clone bandwidth against the git layer saturates before the runner CPU does.",
        numbers: [
          { value: "~870 jobs/s average, ~4,300/s peak", explain: "The job rate CI runs at steady state and at peak; each job clones once, so this number drives clone bandwidth more than runner CPU." },
          { value: "CI is 43% of all git reads", explain: "How much of total git read traffic CI alone accounts for, which is why an unbounded runner pool is a storage risk, not just a compute one." },
        ],
        breaks: {
          failure: "A monorepo push can trigger thousands of workflows at once.",
          handled: "Without a ceiling the runner pool collapses and takes the git read path with it, so per-org caps and SHA-level dedup exist to bound exactly this.",
        },
        choice: {
          pick: "Per-org concurrency caps, priority queues, workflow dedup on SHA, region-local runners",
          instead: "Autoscale runners without a ceiling and let the pool absorb the spike.",
          decider:
            "Where the spike actually lands. One push producing 1,000 jobs is 1,000 clones. At 870 jobs/s steady state that traffic is already 43% of fleet git reads, so unbounded autoscale converts a CI spike into a storage-layer outage. Dedup on SHA is the single biggest win because repeat triggers collapse into one run.",
          flips: "Self-hosted runners owned by the customer, where the pool is their capacity problem and the host's job is only to hand out jobs.",
        },
      },
    },
    {
      id: "web-app",
      label: "Web + API frontend",
      sub: "REST + GraphQL",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The stateless application tier behind the web UI, REST and GraphQL: pull requests, issues, reviews, org and team management.",
        why: "It is a separate path from the git protocol on purpose. The product surface looks unified, but a PR page reads relational rows and a cached diff, and never touches the push transaction.",
        numbers: [
          { value: "~500M authenticated API and web actions/day", explain: "The total authenticated traffic this tier serves daily, entirely separate from git protocol volume." },
          { value: "~1M new issues and PRs/day", explain: "The write volume landing in the metadata store from this tier; small next to git traffic but the number relational capacity is planned from." },
        ],
        breaks: {
          failure: "Nothing makes a merge atomic across the git store and the database.",
          handled: "A crash between them leaves a merged branch whose pull request still says open, so a reconciler has to treat git as authoritative and correct the row afterward.",
        },
        choice: {
          pick: "Merge takes the expected head_sha and returns 409 if it moved",
          instead: "Server-side merge that resolves whatever is at the tip when the request lands.",
          decider:
            "Mirror the storage layer rather than paper over it. The ref update underneath is already a compare-and-swap on 2 SHAs, so surfacing a 409 gives the API caller exactly the guarantee git gives the CLI. Hiding it means the API can merge a commit the reviewer never saw.",
          flips: "An internal automation API where the caller genuinely wants last-write-wins on a bot-owned branch, and a 409 is just a retry loop with extra steps.",
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
        numbers: [
          { value: "~1M issues and PRs/day at ~5KB", explain: "The daily write volume and row size; small enough that this store never approaches the scale of the object graph it points into." },
          { value: "~10TB hot history, ~30TB at RF=3", explain: "The hot data size and its replicated total; four orders of magnitude smaller than the git layer it references by hash." },
        ],
        breaks: {
          failure: "It drifts from git and cannot be transactionally tied to it.",
          handled: "A reconciler treats git as authoritative, so the UI is eventually consistent on a horizon of seconds to minutes rather than instantly correct.",
        },
        choice: {
          pick: "A transactional relational store, sharded by repo_id for comments and reviews",
          instead: "Put PR and issue state in the same content-addressed store as the code.",
          decider:
            "Volume and access shape. This is ~5GB/day growing to ~10TB of hot history, joined constantly across users, repos, labels and permissions, which is a relational workload by any measure. It is four orders of magnitude smaller than the git data and shares none of its consistency rules.",
          flips: "A design that wants issues to travel with a clone, which some distributed forges do by storing them as git refs, trading queryability for offline completeness.",
        },
      },
    },
    {
      id: "object-pool",
      label: "Fork network object pool",
      sub: "one per visibility class",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "One shared object store per fork network, mounted by every member as a git alternate. Each fork owns only its own refs plus the objects it uniquely added.",
        why: "A fork is not a copy. Ten thousand forks are ten thousand ref namespaces over one copy of the history. Fork fan-out concentrates on exactly the largest and most-cloned repositories, so the saving lands where storage hurts most.",
        numbers: [
          { value: "10,000 forks x 5GB = 50TB unpooled", explain: "What a popular repository's fork network would cost as independent copies; the number pooling exists specifically to avoid." },
          { value: "~5GB pooled, roughly 1,000x less", explain: "The pooled cost for the same fork network, since every fork contributes only the objects it uniquely added." },
        ],
        breaks: {
          failure: "A pool leaks: git serves any object by raw SHA regardless of reachability.",
          handled: "A commit pushed to one member is fetchable through any other by anyone who learns the hash, and deleting a repository does not delete its objects. That is why pools are partitioned by visibility class.",
        },
        choice: {
          pick: "One shared pool per fork network, partitioned by visibility class",
          instead: "Every fork is a complete independent repository with its own copy of the object graph.",
          decider:
            "Fork fan-out against repository size. 10,000 forks of a 5GB project is 50TB as independent copies versus ~5GB plus per-fork divergence, about 1,000x. Below roughly 10 forks per project the pooling machinery costs more complexity than it saves.",
          flips:
            "When isolation must win: a private fork of a public repository, or a repository that must be provably deleted for a takedown or erasure request. A hard fork also detaches, at the cost of a full copy, once the pool would otherwise keep alive history nobody uses.",
        },
      },
    },
    {
      id: "search",
      label: "Code search index",
      sub: "ngram index, sharded by repo",
      kind: "database",
      col: 0,
      row: 2,
      detail: {
        what: "An inverted ngram index over default-branch working trees, built and served on its own cluster, with shards keyed by repository.",
        why: "Sharding by repository is what makes access control a shard filter rather than a post-filter. Filtering after retrieval leaks existence through timing and result counts, so an inaccessible shard must never be read at all.",
        numbers: [
          { value: "~50TB unique indexable text", explain: "The unique text across every indexed default branch; the corpus size the whole index is built from." },
          { value: "~150 to 200TB index at 3 to 4x", explain: "The index's actual footprint once ngram expansion inflates the raw text by 3 to 4x." },
        ],
        breaks: {
          failure: "Freshness. It has to absorb ~175 pushes/s while a full rebuild takes days.",
          handled: "A stale result is worse than a slow one, so a stale shard degrades to unavailable rather than answering quietly from an out-of-date corpus.",
        },
        choice: {
          pick: "A separate ngram inverted index, entirely off the git servers",
          instead: "Run git grep against a warm checkout on the file server that already owns the repository.",
          decider:
            "Corpus size times query rate. git grep over a 200MB tree is ~1 core-second, so one unscoped query over a ~50TB corpus is on the order of 50,000 core-seconds. At 100 queries/s that is 5M cores. The index only pays above roughly 10,000 repositories in scope per query.",
          flips: "Repository-scoped search should grep the checkout even when the global index exists. At 10 QPS against one repository that needs ~10 cores, never serves a stale result, and handles arbitrary regexes with no trigram rewrite.",
        },
      },
    },
    {
      id: "webhooks",
      label: "Webhook delivery",
      sub: "backoff within 24h window",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "Workers that deliver HMAC-signed push, pull_request and check_run payloads to subscriber endpoints, with exponential backoff and per-receiver circuit breaking.",
        why: "The queue is not the problem here; delivery concurrency against slow receivers is. One integrator timing out on every request will consume the whole worker pool unless its failures are isolated per receiver.",
        numbers: [
          {
            value: "~78M deliveries/day, ~900/s average, ~4,500/s peak",
            explain: "The delivery volume this tier sustains at steady state and peak; several times human push volume since each push fans out to multiple subscribers.",
          },
          { value: "~550GB at 1KB and 7-day retention", explain: "The retained payload size at the design's typical event size and retention window; what a receiver can re-fetch after an outage." },
        ],
        breaks: {
          failure: "A persistently failing receiver backs up its own queue.",
          handled: "It is circuit-broken and surfaced to the repository admin rather than retried forever, which keeps one bad integrator from starving delivery capacity for everyone else.",
        },
        choice: {
          pick: "At-least-once with HMAC signatures and exponential backoff in a 24h window",
          instead: "Best-effort fire-and-forget, or exactly-once delivery with per-receiver acknowledgement state.",
          decider:
            "What the receiver can do for itself. At ~78M deliveries/day, exactly-once costs dedup state per subscriber for a guarantee the receiver can reconstruct itself from the signed payload id. Fire-and-forget instead drops deploys silently whenever a receiver restarts.",
          flips: "Internal consumers on the same message bus, where you already have the log and its offsets and an HTTP delivery hop buys nothing.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "git-proxy",
      tier: "hot",
      step: 1,
      label: "git push / fetch",
      detail: {
        what: "The git smart-HTTP or SSH stream, carrying a packfile on a push and a negotiated set of objects on a fetch.",
        why: "This is the hot path by volume: 85% of git operations are fetches or clones. The proxy is the only stateless thing standing between the internet and a stateful file server.",
        numbers: [
          { value: "~2,000 ops/s average, ~10,000/s peak", explain: "The traffic level this edge carries at steady state and peak; it is the number the proxy fleet is provisioned against." },
          { value: "85% fetch or clone, 15% push", explain: "The read/write split on this edge; it is why rate limiting has to treat fetch and push traffic very differently." },
        ],
        breaks: {
          failure: "Anonymous clones are bandwidth-heavy and free to request.",
          handled: "This edge needs separate rate-limit buckets per IP and per authenticated user, or an anonymous clone flood is an easy way to exhaust bandwidth meant for real traffic.",
        },
      },
    },
    {
      id: "e2",
      from: "client",
      to: "web-app",
      tier: "data",
      label: "web + API request",
      detail: {
        what: "Ordinary HTTPS traffic for the web UI, REST and GraphQL, entirely separate from the git protocol path.",
        why: "Drawing it as its own edge is the point: a pull request page is a database read plus a cached diff. It can be served while the repository's primary is mid-failover.",
        numbers: [{ value: "~500M authenticated web and API actions/day", explain: "The daily volume on this path; entirely disjoint from git protocol traffic even though both reach the same repository." }],
        breaks: {
          failure: "The two paths have no shared transaction.",
          handled: "The page can show a state the git store has already moved past, which the design accepts since a PR page reads relational rows, not the object graph directly.",
        },
      },
    },
    {
      id: "e4",
      from: "git-proxy",
      to: "primary",
      tier: "hot",
      step: 2,
      label: "receive-pack stream",
      detail: {
        what: "The forwarded bidirectional git byte stream, stamped with the routing generation the proxy resolved.",
        why: "The proxy forwards rather than terminates because git's protocol is a negotiation: the client and server work out what is missing between them. Nothing in the middle can usefully summarise that.",
        numbers: [{ value: "1 generation stamp per forwarded request", explain: "The single piece of routing metadata that makes a stale route detectable rather than silently wrong." }],
        breaks: {
          failure: "A stream stamped with an old generation is rejected by a primary that has since been demoted.",
          handled: "That turns a routing race into a retry rather than a lost update, since the client simply asks the proxy to re-resolve and forward again.",
        },
      },
    },
    {
      id: "e5",
      from: "primary",
      to: "replicas",
      tier: "hot",
      step: 3,
      label: "packfile, 2-of-3 fsync",
      detail: {
        what: "Objects streamed to both replicas, with the primary waiting for 2 of 3 fsync acknowledgements before it performs the ref compare-and-swap.",
        why: "The ordering is the entire durability argument. Objects before refs means the worst case after any crash is unreachable objects on some replicas. The next GC collects those, rather than the fleet disagreeing on a ref history.",
        numbers: [
          { value: "1 to 3ms metro round trip", explain: "The latency this edge adds to every push; small because replicas are placed within metro distance of the primary." },
          { value: "cross-continent would be 30ms+", explain: "What the same quorum would cost across continents instead, which is why replica placement stays regional rather than global." },
        ],
        breaks: {
          failure: "Every push pays this round trip.",
          handled: "That is tolerable only because pushes are ~175/s fleet-wide and each is dominated by upload time rather than by the quorum wait itself.",
        },
      },
    },
    {
      id: "e6",
      from: "primary",
      to: "object-pool",
      tier: "data",
      label: "shared history alternate",
      detail: {
        what: "Object lookups falling through to the fork network's shared pool when the object is not in this repository's own storage.",
        why: "This is the mechanism that makes forking free: a fork contributes only its own new objects, and everything it inherits is resolved through the alternate rather than copied.",
        numbers: [{ value: "one pool per fork network per visibility class", explain: "The granularity object sharing happens at; a fork inherits everything through this fallback rather than copying it." }],
        breaks: {
          failure: "The alternate is a physical sharing relationship.",
          handled: "An object pushed to any member is present for every member, and git will serve it by raw SHA whether or not a ref points at it. That is why visibility classes stay separate pools.",
        },
      },
    },
    {
      id: "e7",
      from: "primary",
      to: "event-queue",
      tier: "data",
      label: "push_event after ack",
      offset: 70,
      detail: {
        what: "A durable (repo_id, ref, old_sha, new_sha) record published once the ref compare-and-swap has committed and the client has been acked.",
        why: "It is deliberately after the ack. Everything downstream of this edge, CI, webhooks and indexing, is a consequence of the push rather than part of it. None of it is allowed to make a push fail.",
        numbers: [
          { value: "~26M events/day", explain: "The volume flowing through this edge daily; the seed for everything CI, webhooks and search consume downstream." },
          { value: "push acked in ~1s, mostly upload", explain: "The typical time to acknowledge a push, dominated by upload rather than by anything on this edge, since the event publishes only after the ack." },
        ],
        breaks: {
          failure: "There is no transaction spanning the ref update and the publish.",
          handled: "A crash between them loses the event, and the consequences are reconciled from ref state later rather than replayed from a transactional log.",
        },
      },
    },
    {
      id: "e8",
      from: "replicas",
      to: "diff-service",
      tier: "data",
      label: "objects at base + head",
      detail: {
        what: "Trees and blobs read out of a replica so the diff service can compute a pull request's changes from two SHAs.",
        why: "Diff traffic reads from a replica rather than the primary because it is pure read load. Keeping it off the primary leaves that machine's disk for the write path it alone can serve.",
        numbers: [{ value: "tens of thousands of random object reads per diff", explain: "The read cost of computing one diff; the reason this traffic is routed to a replica rather than the write-serving primary." }],
        breaks: {
          failure: "A lagging replica may not yet hold the head SHA the PR row names.",
          handled: "The diff service has to fall back to another replica rather than render an empty diff, since a missing object is a routing problem, not a data problem.",
        },
      },
    },
    {
      id: "e9",
      from: "web-app",
      to: "metadata",
      tier: "data",
      label: "PR rows, two SHAs",
      detail: {
        what: "Reading and writing pull request, issue, review and permission rows, each carrying base_sha and head_sha rather than any content.",
        why: "The metadata store holds pointers into the object graph, never the graph itself. That is what keeps a transactional relational database at ~10TB while the code it describes is ~5PB.",
        numbers: [{ value: "~1M new issues and PRs/day at ~5KB each", explain: "The write volume on this edge; small and relational, which is what keeps the metadata store from inheriting the git layer's scale." }],
        breaks: {
          failure: "A merge writes a ref on the file server and a state change here with nothing making them atomic.",
          handled: "One of the two can land alone, which is why a reconciler treats the ref as the source of truth and corrects the row afterward.",
        },
      },
    },
    {
      id: "e10",
      from: "web-app",
      to: "diff-service",
      tier: "data",
      label: "diff for base..head",
      offset: 40,
      detail: {
        what: "A request for the diff or merge preview between the two SHAs the pull request row names.",
        why: "Diffs are computed rather than stored, so this hop exists on every PR page view and is what the (repo_id, base_sha, head_sha) cache is protecting.",
        numbers: [{ value: "0 invalidations: a SHA pair names exactly one diff forever", explain: "Why this edge never needs a cache-busting mechanism; the key itself is immutable by construction." }],
        breaks: {
          failure: "A force-push moves head_sha, so the next request is a different cache key.",
          handled: "The previous diff, along with the review comments anchored in it, refers to a commit no ref reaches, which the UI has to flag rather than hide.",
        },
      },
    },
    {
      id: "e11",
      from: "event-queue",
      to: "ci",
      tier: "hot",
      step: 4,
      label: "workflow jobs at SHA",
      detail: {
        what: "The push event triggering workflow evaluation: the scheduler reads .github/workflows at the pushed SHA and enqueues jobs.",
        why: "Reading the workflow definition at the pushed SHA rather than at the branch tip is what makes a run reproducible. The tip may have moved by the time the job starts.",
        numbers: [
          { value: "~5 workflows per push", explain: "The typical fan-out from one push into workflow runs; the multiplier that turns push volume into job volume." },
          { value: "~870 jobs/s average, ~4,300/s peak", explain: "The resulting job rate at steady state and peak; each job clones once, so this is also roughly the CI-driven clone rate." },
        ],
        breaks: {
          failure: "One push can produce thousands of jobs.",
          handled: "This edge needs per-org caps and SHA-level dedup, or it is an amplifier pointed straight at the git read path.",
        },
      },
    },
    {
      id: "e12",
      from: "event-queue",
      to: "webhooks",
      tier: "data",
      label: "fan-out, HMAC signed",
      detail: {
        what: "Push, pull_request and check_run events handed to the delivery workers for at-least-once HTTP delivery to subscriber endpoints.",
        why: "The queue absorbs the difference between an event rate we control and a delivery rate somebody else's server controls. That is the only reason a slow integrator is their problem rather than ours.",
        numbers: [
          { value: "~3 subscribers per event", explain: "The typical fan-out from one event to webhook subscribers; the multiplier behind the delivery volume below." },
          { value: "~78M deliveries/day", explain: "The resulting daily delivery count this edge carries, several times the underlying push volume." },
        ],
        breaks: {
          failure: "Retries mean receivers see duplicates.",
          handled: "Payloads are signed and carry an id the receiver can dedupe on, so an at-least-once retry never requires exactly-once bookkeeping on this side.",
        },
      },
    },
    {
      id: "e13",
      from: "event-queue",
      to: "search",
      tier: "control",
      label: "index update",
      detail: {
        what: "An incremental index update for pushes that touch an indexed default branch.",
        why: "The index is a derived view, so it is fed from the event stream rather than by scanning the git store. Nothing about a push waits for it.",
        numbers: [
          { value: "~175 pushes/s to absorb", explain: "The steady-state update rate this edge feeds into the index; small next to a full rebuild's cost." },
          { value: "1 full rebuild spans several days", explain: "How long re-indexing everything from scratch takes, which is why incremental updates off this edge are the only affordable path." },
        ],
        breaks: {
          failure: "If this pipeline falls behind, search silently serves results from a corpus that no longer exists.",
          handled: "Build lag is a paged metric rather than a dashboard one, since a stale result looks identical to a correct one until someone notices what is missing.",
        },
      },
    },
    {
      id: "e14",
      from: "ci",
      to: "replicas",
      tier: "hot",
      step: 5,
      label: "clone at pushed SHA",
      offset: 90,
      detail: {
        what: "Every runner cloning the repository at the SHA it was triggered for, served by a read replica in the same region as the runner.",
        why: "This arrow is the largest single consumer of the git layer, and it points back up into the storage the humans are also using. Placing runners next to the replica they clone from is a storage decision dressed as a scheduling one.",
        numbers: [
          { value: "75M CI clones/day", explain: "The daily clone volume this edge alone carries; roughly five times the human push volume that triggered it." },
          { value: "43% of all git reads", explain: "How much of total git read traffic this single edge accounts for, which is why runner placement is treated as a storage decision." },
        ],
        breaks: {
          failure: "At 870 jobs/s the clone bandwidth saturates before the runner compute does.",
          handled: "A fan-out spike degrades everyone's fetches on those replicas, which is why runners are placed next to the replica they clone from rather than anywhere with spare CPU.",
        },
      },
    },
  ],
};
