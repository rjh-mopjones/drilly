import type { Diagram } from "./types";

export const WEB_CRAWLER: Diagram = {
  id: "web-crawler",
  title: "Web Crawler",
  question: "Design a Web Crawler",
  sourceId: "patterns",
  itemId: 6,
  overview: {
    shape:
      "A crawler is a loop, not a pipeline: every page you fetch produces the URLs that feed the next fetch, without drowning in duplicates or getting blocked.",
    forces: [
      {
        constraint: "A parser on one shard constantly discovers links belonging to another shard's domain",
        decision: "New URLs travel over the Kafka discovery bus, partitioned by hash(domain), rather than being handled locally",
        lights: ["kafka", "frontier-shard", "e1", "e18"],
      },
      {
        constraint: "120k discovered URLs/s arrive, but over 90% are already-seen duplicates",
        decision: "Admission runs four rejections cheapest-first: a Bloom probe, robots, then a trap guard, before anything is scored",
        lights: ["admission", "p-dedup", "p-robots", "p-trap", "p-router"],
      },
      {
        constraint: "Maximum throughput globally and strict one-request-per-second serialisation per host pull in opposite directions",
        decision: "Front queues rank by value; back queues enforce one queue per host, making the rate limit structural",
        lights: ["front-queues", "back-queues", "e8", "e9"],
      },
      {
        constraint: "Uncached DNS resolution costs ~50ms, dwarfing the roughly 1ms a plain fetch itself needs once resolved",
        decision: "Fetch, parse, normalise and fingerprint run as one coroutine per worker, with an in-process DNS cache",
        lights: ["crawl-worker", "dns", "p-fetch"],
      },
      {
        constraint: "A crash between fetch and store within the 60s lease window must lose nothing, yet the seen index would never notice",
        decision: "The acknowledgement always follows the storage write, never the fetch",
        lights: ["p-fingerprint", "object-store", "back-queues", "e20", "e22"],
      },
    ],
    naive: {
      text: "Keep one global queue of discovered URLs and a shared seen table workers check before fetching. Any idle worker pops the next URL, fetches it, and pushes new links onto the same queue. This has no notion of which host a URL belongs to, so nothing stops ten workers hitting the same domain in the same second. A real crawler doing this gets banned within minutes. It also races on the seen check: two workers can both check, then insert, the same URL before either commits, fetching it twice. A single global queue makes ~10^8 domains contend for the same structure. The Frontier shard replaces this by sharding the whole crawler by hash(registrable_domain), putting all of one host's politeness state on one machine. The Back queues' one-host-per-queue invariant then makes the rate limit a property of the data layout, never a lock.",
      lights: ["frontier-shard", "back-queues", "seen"],
    },
    beats: [
      {
        text: "Discovery is a hand-off. A parser on one shard constantly finds links belonging to another, so new URLs go onto a partitioned log keyed by hash(domain) rather than being handled locally. Sharding by domain is what keeps all politeness state for a host on one machine.",
        lights: ["kafka", "frontier-shard", "e1", "e18"],
      },
      {
        text: "Admission is one service with four rejections in it, cheapest first. The Bloom probe is a memory access, the robots lookup may touch disk, the trap guard needs per-domain counters. Only what survives all three gets scored into a priority band. Every rejection here avoids a TCP connection, a download and a parse.",
        lights: ["admission", "p-dedup", "p-robots", "p-trap", "p-router", "e3", "e5", "e7"],
      },
      {
        text: "The frontier is two tiers because it answers two different questions. Front queues decide what is worth crawling, value; back queues decide when you are allowed to, politeness. Keeping them separate means one queue per host makes the rate limit structural rather than something a lock has to enforce.",
        lights: ["front-queues", "back-queues", "e8", "e9"],
      },
      {
        text: "Fetch, parse, normalise and fingerprint are one worker, not four services. Fetching and parsing run in the same coroutine, and the lease contract only closes if the process that fetched is the process that stores. Concurrency comes from async sockets, not threads, because the work is almost entirely I/O wait, and DNS, uncached at 50ms, is most of that wait.",
        lights: ["crawl-worker", "p-fetch", "p-parse", "dns", "e11", "e12", "e13", "e15"],
      },
      {
        text: "Storage closes the loop safely. The acknowledgement must follow the write, never the fetch, or a crash leaves a URL marked crawled with no page behind it and nothing downstream will ever notice.",
        lights: ["p-fingerprint", "object-store", "back-queues", "e20", "e22"],
      },
    ],
    crux: {
      problem:
        "Politeness and throughput pull in opposite directions. You want maximum parallelism globally and strict serialisation per host.",
      handled:
        "The only way to have both is to make the host the unit of scheduling rather than the URL. Sharding by hash(registrable_domain) puts all of one host's state on one machine. The back queues' one-host-per-queue invariant then makes one request in flight to this host a property of the data layout rather than something a lock has to enforce.",
    },
    numbers: [
      { value: "~300 links extracted per page", explain: "The average fan-out of one fetch, the number that turns a fixed input list into a growing frontier and sets the discovery bus's throughput." },
      { value: "12GB Bloom vs ~240GB exact index", explain: "The memory cost of the probabilistic seen check against holding all 10B known URLs exactly, a 20x saving traded for a 1% false-positive rate." },
      { value: "one request per second per domain", explain: "The default politeness ceiling per host, the constraint the whole back-queue design exists to enforce structurally." },
      { value: "50ms per uncached DNS lookup", explain: "The dominant latency cost per fetch before caching, larger than the HTTP request itself for a never-seen host." },
    ],
  },
  nodes: [
    // ---- the discovery bus: global, not shard-local ----
    {
      id: "kafka",
      label: "Kafka discovery bus",
      sub: "partitioned by hash(domain)",
      kind: "queue",
      col: 0,
      row: 0,
      detail: {
        what: "A partitioned durable log carrying newly discovered URLs to whichever shard owns their domain.",
        why: "The crawler is sharded by hash(domain) so all politeness state for a host lives on one node. A parser on shard 3 constantly finds links belonging to shard 17, and that hand-off has to survive a restart, so it is a log rather than an RPC.",
        numbers: [
          { value: "~300 links extracted per page", explain: "The average number of outbound links a single fetched page produces, the source of this bus's whole traffic volume." },
          { value: "120k URL messages/s fleet-wide at ~200B each", explain: "The aggregate publish rate across the fleet and typical message size." },
          { value: "~24MB/s, against ~40MB/s of page bytes", explain: "The bandwidth this bus carries, comparable in magnitude to the raw page traffic itself." },
        ],
        breaks: {
          failure: "Partition skew: one enormous domain pins a single partition, so that shard falls behind while the rest idle.",
          handled: "This is why mega-domains are sub-sharded separately by the frontier shard's own rebalancing, rather than left to overload one partition indefinitely.",
        },
        choice: {
          pick: "Kafka, partitioned by hash(registrable_domain)",
          instead: "Direct RPC between shards, or a work queue like SQS or RabbitMQ.",
          decider:
            "Whether a hand-off may be lost when a shard restarts. At ~300 links per page across a fleet that restarts routinely, RPC drops discoveries silently and a queue gives you no replay once consumed. A partitioned log survives restarts and lets a shard rewind.",
          flips:
            "A single-node crawler, or one small enough that the whole frontier fits on one machine. Then there is no hand-off at all and a broker is pure operational cost.",
        },
      },
    },

    // ---- FRAME: everything keyed by host lives on one shard ----
    {
      id: "frontier-shard",
      label: "Frontier shard — owns hash(domain)",
      kind: "zone",
      detail: {
        what: "One shard's worth of the crawler: the admission service, both queue tiers, this shard's slice of the seen index, and the per-domain host state. Everything inside is keyed by host.",
        why: "Politeness is per host, so the scheduling state for a host has to live in exactly one place. Sharding by hash(registrable_domain) guarantees that. This is why cross-shard discoveries go over the bus instead of being handled locally, and why no politeness decision needs a lock or a remote read.",
        numbers: [
          { value: "~256 shards, one bucket per hash(registrable_domain)", explain: "The fleet size that spreads the crawl's domains, chosen to balance load across nodes." },
          { value: "~10^8 registrable domains in rotation", explain: "The corpus of hosts the crawler tracks across all shards combined." },
          { value: "~200GB of politeness + robots state fleet-wide", explain: "2KB × ~10^8 domains ≈ 200GB total, ~800MB per shard across 256 shards — small enough that no single shard runs out of RAM for host state." },
        ],
        breaks: {
          failure: "Mega-domains. Wikipedia, YouTube and GitHub each hold hundreds of millions of URLs, so hashing by domain drops all of it on one shard.",
          handled: "A daily rebalance sub-shards them by hash(domain + path_prefix), and moving a domain has to move its next-fetch timestamps with it or the new owner crawls too fast.",
        },
        choice: {
          pick: "Shard the whole crawler by hash(registrable_domain)",
          instead: "Shard by URL hash, or a shared global frontier.",
          decider:
            "Politeness is per host, so all scheduling state for a host must live in one place. Sharding by URL scatters one domain across every node, and enforcing one request per second then needs a distributed counter on the hot path. Hashing the domain makes it node-local by construction.",
          flips:
            "When no politeness constraint exists, for example crawling your own infrastructure, where URL-hash sharding balances load more evenly.",
        },
      },
    },

    // ---- FRAME: the admission service and its four stages ----
    {
      id: "admission",
      label: "Admission service",
      kind: "serviceGroup",
      col: 1,
      row: 0,
      parent: "frontier-shard",
      detail: {
        what: "The single entry point into a shard's frontier: four rejections in a fixed order, then a score.",
        why: "Every filter here is cheaper than the fetch it prevents, and the order is the design. The Bloom probe is a memory access and rejects the large majority of links. The robots lookup may touch disk, and the trap guard needs per-domain counters. Running them cheapest-first is what makes admission affordable at 120k discovered URLs per second.",
        numbers: [
          { value: "rejects over 90% of discovered links", explain: "At 120k discovered URLs/s, a 90% reject rate leaves only ~12k/s reaching scoring — the fetch tier only has to sustain that tenth, not the raw firehose." },
          { value: "~1% Bloom false-positive rate", explain: "The error rate of the first, cheapest rejection stage." },
          { value: "under 10% of known URLs are ever fetched", explain: "Most of the 10B-URL corpus is deliberately never (re)fetched — the 70/30 refresh/discovery quota targets change and novelty, not exhaustive coverage." },
        ],
        breaks: {
          failure: "This is one deployable unit, so a slow robots lookup stalls dedup behind it.",
          handled: "The stages are ordered, not independently scaled; if one needs its own fleet the split is treated as a real refactor rather than patched in place.",
        },
        choice: {
          pick: "Four rejections as ordered stages inside one service, cheapest first",
          instead: "Four independent services chained by queues, each scaled on its own.",
          decider:
            "How the traffic thins as it passes through. Dedup rejects over 90% of the 120k discovered URLs a second, so the robots and trap stages only ever see a small fraction of that. Queueing between four separately-scaled services would pay a hop at each stage for traffic that is already mostly gone by stage two.",
          flips:
            "When one stage's cost genuinely diverges from the rest, for example a robots lookup that starts hitting a slow external service at a rate the other three stages never will. It then earns its own fleet and its own scaling knob.",
        },
      },
    },
    {
      id: "p-dedup",
      label: "Seen check",
      sub: "Bloom probe, then RocksDB",
      kind: "process",
      col: 1,
      row: 0,
      parent: "admission",
      detail: {
        what: "First stage: probe the Bloom filter, and for URLs discovered from a high-band parent, confirm a positive against the on-disk index.",
        why: "It runs first because it is the cheapest rejection available and it rejects the most. A memory probe costs nanoseconds; the fetch it prevents costs a TCP connection, a page download and a parse.",
        numbers: [
          { value: "~1% false positives", explain: "The error rate of this probe, biased entirely toward false rejections rather than false acceptances." },
          { value: "0 disk reads for a negative", explain: "A negative answer never touches disk, keeping the common case as cheap as a memory access." },
        ],
        breaks: {
          failure: "A false positive says 'seen' for a page never crawled, and nothing ever revisits it.",
          handled: "There is no error and no retry, so the loss is invisible by construction, an accepted cost bounded by the ~1% false-positive rate.",
        },
        choice: {
          pick: "Probe always; confirm on disk only for high-band parents",
          instead: "Confirm every positive against the KV index, or never confirm.",
          decider:
            "Read amplification. On a mature crawl over 90% of extracted links are already known, so confirming every positive means a disk read on most of 120k checks a second. That is exactly what the filter was bought to avoid. Confirming only for top-band parents bounds the cost while conceding real loss in the tail.",
          flips:
            "A compliance or archival crawl, where silently dropping 1% of genuinely new URLs is unacceptable and the disk reads are simply the price.",
        },
      },
    },
    {
      id: "p-robots",
      label: "Robots check",
      sub: "cached rules + crawl-delay",
      kind: "process",
      col: 1,
      row: 1,
      parent: "admission",
      detail: {
        what: "Second stage: look up the cached robots rules for the URL's host and reject disallowed paths.",
        why: "Rejecting a disallowed path at admission stops it consuming queue space and guarantees it can never be fetched later by accident. It runs after dedup because the lookup may touch disk while the Bloom probe does not.",
        numbers: [{ value: "one robots.txt fetch per host per TTL", explain: "The refresh cadence for cached rules; a URL-level check reads the cache rather than re-fetching the file." }],
        breaks: {
          failure: "When the rules are missing for a host, admission has to choose between blocking and optimistically allowing.",
          handled: "Getting that default wrong is how crawlers get banned, so the choice is made deliberately per deployment rather than left to fall through.",
        },
        choice: {
          pick: "Honour disallow and Crawl-Delay, treating huge delays as a deprioritisation signal",
          instead: "Respect every declared Crawl-Delay literally, or ignore robots.txt entirely.",
          decider:
            "Some sites declare Crawl-Delay: 86400 to discourage crawling. Respecting it literally stalls that domain forever at one page per day; ignoring it gets the IP range banned. Dropping such domains to the lowest band keeps the crawl moving while staying compliant in intent.",
          flips:
            "Compliance-bound corpora such as web archives, where the literal value has to be respected and the rate accepted.",
        },
      },
    },
    {
      id: "p-trap",
      label: "Trap guard",
      sub: "depth cap, novelty ceiling",
      kind: "process",
      col: 1,
      row: 2,
      parent: "admission",
      detail: {
        what: "Third stage: per-domain depth cap, URL-pattern blocklist for session ids and pagination explosions, and a throttle on domains whose novelty rate sits near 100% while their content fingerprints stay near-identical.",
        why: "A spider trap produces legitimately distinct URLs, so neither URL dedup nor content dedup stops the enqueueing, only the storing. The bounds that work are structural and they have to be applied before the URL takes queue space, which is why the guard lives here rather than downstream.",
        numbers: [
          { value: "novelty rate near 100% is the trap signature", explain: "The specific statistical pattern this stage watches for: almost every URL from a domain being new." },
          { value: "thresholds learned per domain across ~10^8 domains, never 1 global setting", explain: "How finely tuned the novelty ceiling is, avoiding a single threshold that would misjudge both traps and legitimately prolific sites." },
        ],
        breaks: {
          failure: "This fights the discovery budget directly: an aggressive novelty ceiling also suppresses genuinely prolific sites.",
          handled: "The ceiling is learned per domain rather than set once, so a large legitimate news site and a trap are distinguished by more than raw novelty rate alone.",
        },
        choice: {
          pick: "Per-domain learned novelty ceiling plus a depth cap",
          instead: "A global novelty threshold, or relying on content dedup to absorb traps.",
          decider:
            "Content dedup stops the storing but not the enqueueing, so the frontier still grows without bound and the ~30% of budget reserved for discovery still goes on noise. A global threshold cannot separate a calendar script from a large news site, because both look like unbounded novelty from outside.",
          flips:
            "A crawl scoped to an allowlist of known hosts, where traps cannot be reached at all and the guard is pure overhead.",
        },
      },
    },
    {
      id: "p-router",
      label: "Priority router",
      sub: "score → 1 of 10 bands",
      kind: "process",
      col: 1,
      row: 3,
      parent: "admission",
      detail: {
        what: "Last stage: turn the surviving URL's score, domain authority, observed change rate, overdue-ness, into one of ten bands and append it there.",
        why: "By this point the URL is known to be new, allowed and not part of a trap, so the only remaining question is how much it is worth. A fixed quota, roughly 70/30 refresh against discovery, is enforced here rather than letting one score decide. A URL due for refresh has measured history, and a new URL only has what it inherits.",
        numbers: [
          { value: "F = ~10 bands", explain: "The granularity of the priority scheme, deliberately coarse rather than a total order." },
          { value: "~70% refresh / ~30% discovery quota", explain: "The hard split between recrawling known pages and pursuing new ones, enforced structurally rather than emerging from a single score." },
        ],
        breaks: {
          failure: "Scoring at admission freezes the score. A page that becomes important later keeps its old band until it is rediscovered.",
          handled: "This staleness is an accepted tradeoff of scoring once rather than continuously, since continuous rescoring at this volume would itself be prohibitively expensive.",
        },
        choice: {
          pick: "10 discrete priority bands with a hard refresh/discovery quota",
          instead: "A single global priority queue ordered by one computed score.",
          decider:
            "Cost and honesty of the ordering. A heap over ~100M entries costs a log-n operation per insert, and it demands a total order across signals with no common unit. Worse, refresh demand at even a monthly cadence over 10B known URLs is 10x the entire 1B/month budget. A unified score gives discovery zero, and the crawl silently stops growing within weeks.",
          flips:
            "Below roughly 10^7 pages, where the budget covers refresh demand with slack and one score is strictly better than a hand-set ratio.",
        },
      },
    },

    // ---- shard-local stores ----
    {
      id: "seen",
      label: "Seen index",
      sub: "Bloom in RAM + RocksDB",
      kind: "database",
      col: 2,
      row: 0,
      parent: "frontier-shard",
      detail: {
        what: "Two tiers: an in-memory Bloom filter as the fast reject, RocksDB on disk as ground truth for confirmed-seen URLs.",
        why: "An exact index of 10 billion URLs is roughly 240GB and cannot sit in RAM. The Bloom filter answers the same question in 12GB with a 1% false-positive rate and no false negatives, so a not-seen answer is always trustworthy.",
        numbers: [
          { value: "12GB Bloom vs ~240GB exact", explain: "The size gap between the probabilistic and exact structures for the same 10B-URL corpus." },
          { value: "10B URLs", explain: "The full scale of the seen corpus this index tracks." },
          { value: "~50MB/shard across ~256 workers", explain: "The per-shard share of the Bloom filter once split across the fleet." },
        ],
        breaks: {
          failure: "The filter cannot delete, so accumulated drift has to be cleared by rebuilding it from the KV index.",
          handled: "A sampled audit can estimate the loss rate but cannot recover the URLs, so periodic rebuilds are the only correction mechanism available.",
        },
        choice: {
          pick: "Bloom filter in RAM, RocksDB as ground truth",
          instead: "An exact index in Redis, or a cuckoo filter.",
          decider:
            "Memory. 10 billion URLs exactly indexed is roughly 240GB; the same question answered probabilistically is 12GB at a 1% false-positive rate, a 20x saving. False negatives are impossible, so a not-seen answer is always trustworthy and only a fetch is ever wasted, never lost.",
          flips:
            "When deletion matters, recrawl policy, or clearing a domain, where a cuckoo filter buys similar space at a lower FPR and supports removal.",
        },
      },
    },
    {
      id: "robots",
      label: "Host state",
      sub: "RocksDB, per registrable domain",
      kind: "database",
      col: 2,
      row: 1,
      parent: "frontier-shard",
      detail: {
        what: "Everything keyed by host: parsed robots rules, crawl delay, next-fetch timestamp, per-host retry counts and the novelty counters the trap guard reads.",
        why: "robots.txt is a per-host round trip you must not repeat per URL. The same record carries the crawl delay the back queues schedule against, and the retry state that has to belong to the host rather than the URL. Keeping them in one place makes a backoff decision one decision per host instead of a race between workers.",
        numbers: [
          { value: "~2KB per domain × ~10^8 domains ≈ 200GB", explain: "Too big for an in-memory map on one node — why host state lives in RocksDB, which keeps the hot ~10^7 domains resident and spills the rest to disk." },
          { value: "hot ~10^7 domains ≈ 50GB in memory", explain: "The active subset kept resident, far smaller than the full corpus." },
        ],
        breaks: {
          failure: "A stale cache keeps you crawling paths a site has since disallowed.",
          handled: "This is the specific failure that gets a crawler blocked, so cache TTLs on this store are tuned conservatively rather than optimised purely for hit rate.",
        },
        choice: {
          pick: "RocksDB, keyed by registrable domain",
          instead: "Redis, or an in-memory map per shard.",
          decider:
            "Working-set size against persistence. 10^8 hosts at ~2KB each is ~200GB, well past comfortable RAM, and it must survive restarts or the crawler wakes with no memory of anyone's crawl delay. An embedded LSM store keeps hot domains in memory and spills the long tail to disk with no extra service to run.",
          flips:
            "A crawl scoped to a few thousand known hosts, where the whole table is a few MB and Redis or a plain map is simpler.",
        },
      },
    },

    // ---- the two frontier tiers ----
    {
      id: "front-queues",
      label: "Front queues",
      sub: "10 priority bands",
      kind: "queue",
      col: 1,
      row: 2,
      parent: "frontier-shard",
      detail: {
        what: "Ten append-only queues, one per priority band, holding admitted URLs waiting for a host slot.",
        why: "Bands rather than a total order is deliberate: ten bands means the score only has to be right to one significant figure. That is all a change-rate estimate and a domain authority score are worth. Selection across bands is weighted random rather than strict, so the low bands drain slowly instead of never.",
        numbers: [
          { value: "F = ~10 bands", explain: "Matches the router's 10-band output exactly — coarse enough that a change-rate estimate only has to be right to one significant figure, not ranked precisely." },
          { value: "~100M URLs queued, ~3 days of admitted work", explain: "The typical standing backlog and how long it represents at current crawl throughput." },
        ],
        breaks: {
          failure: "Strict selection across bands starves the low bands forever.",
          handled: "Selection across the ten bands is weighted random, not strict priority order, so every band keeps draining slowly instead of the lowest waiting forever.",
        },
        choice: {
          pick: "Weighted-random selection across bands",
          instead: "Strict highest-band-first selection.",
          decider:
            "Starvation. Strict selection never reaches band 10 as long as band 1 is non-empty, and band 1 is never empty on an open-web crawl. Weighted random makes the low bands slow rather than unreachable, which is the difference between a long tail and a dead one.",
          flips:
            "A crawl with a hard deadline on a known-important set, where deliberately starving the tail is the point.",
        },
      },
    },
    {
      id: "back-queues",
      label: "Back queues + min-heap",
      sub: "one host per queue, Redis",
      kind: "queue",
      col: 1,
      row: 3,
      parent: "frontier-shard",
      detail: {
        what: "B queues, each holding URLs from exactly one host, plus a min-heap ordered by each host's next-fetch time. A host appears in at most one back queue.",
        why: "That invariant is the entire politeness mechanism: it makes one request in flight to this host a property of the data layout rather than something a lock enforces. A worker pops the heap root and, if that time is still in the future, sleeps until it rather than scanning for something better.",
        numbers: [
          { value: "B ≈ 3 × fetcher threads", explain: "3x, not 1x, so a fetcher is never stuck waiting on its one queue's host to clear cooldown — enough spares stay ready without idling unused host slots." },
          { value: "one request per second per domain", explain: "The default politeness rate this structure enforces per host." },
          { value: "60s lease against a 10s fetch timeout", explain: "The two timing windows: how long a lease lasts against how long a fetch attempt is allowed to take." },
        ],
        breaks: {
          failure: "Priority is approximate by construction. A top-band URL behind 40,000 queued URLs on its own host at 1 req/s waits over eleven hours.",
          handled: "Whatever its score says, the frontier orders host admission, not URLs, so priority governs which hosts get attention rather than the order within one.",
        },
        choice: {
          pick: "Redis sorted sets, one per host, with a min-heap on next-fetch time",
          instead: "Keeping the schedule in process memory, or as rows in the metadata database.",
          decider:
            "Whether the schedule must outlive a worker. In-memory is fastest but a crash loses every cooldown and the crawler resumes impolitely; a relational table survives but a poll-for-ready-hosts query against ~100M queued URLs is a table scan. A sorted set gives O(log n) next-ready in a store that persists.",
          flips:
            "A single-process crawler where the frontier is already in memory and a crash means a full restart anyway.",
        },
      },
    },

    // ---- FRAME: the crawl worker and its four stages ----
    {
      id: "crawl-worker",
      label: "Crawl worker",
      kind: "serviceGroup",
      col: 3,
      row: 2,
      detail: {
        what: "The stateless worker tier: lease a host, fetch, parse, normalise, fingerprint, store, then acknowledge. One deployable unit, four stages.",
        why: "These are one service rather than four because the lease contract only closes if the process that fetched is the process that stores. The acknowledgement has to follow the storage write, and splitting the stages across services turns that into a distributed transaction. Fetching and parsing run in the same coroutine, so the fetch returns already-parsed links rather than a raw body handed off elsewhere.",
        numbers: [
          { value: "thousands of concurrent sockets per node", explain: "The concurrency level async I/O achieves per worker node." },
          { value: "10s per-fetch timeout, 60s lease", explain: "The two bounds that limit how long a stalled fetch or a crashed worker can hold a host hostage." },
          { value: "~400 pages/s steady, ~2k/s peak", explain: "The throughput this worker tier sustains at typical and peak load." },
        ],
        breaks: {
          failure: "A slow domain answering in 30s ties up a worker slot for 30s and starves fast domains.",
          handled: "The per-fetch timeout and a per-domain in-flight quota of 1 bound this, so one slow host cannot monopolise a worker's capacity indefinitely.",
        },
        choice: {
          pick: "One stateless worker owning fetch through store, recovered by lease expiry",
          instead: "Separate fetcher, parser and dedup services chained by queues.",
          decider:
            "Where the acknowledgement lives. A crash between fetch and store must lose nothing. The cheapest way to guarantee that is for one process to hold the lease across the whole path and ack at the end. Splitting the chain means every hop needs its own at-least-once semantics, and the ack point becomes ambiguous.",
          flips:
            "When parsing genuinely needs different hardware from fetching, a headless render farm is exactly that case, which is why it is a separate service here.",
        },
      },
    },
    {
      id: "p-fetch",
      label: "Fetch",
      sub: "async I/O, 10s timeout",
      kind: "process",
      col: 3,
      row: 2,
      parent: "crawl-worker",
      detail: {
        what: "Lease a ready host from the back queues, resolve it against the DNS cache, and issue the HTTP GET.",
        why: "Fetching is almost entirely waiting, so threads are the wrong unit of concurrency: async sockets reach tens of thousands per node where threads cap out in the low thousands. Leasing rather than dequeuing is what stops two workers touching the same host at once, with no global lock.",
        numbers: [
          { value: "thousands of concurrent sockets per node", explain: "The scale async I/O reaches versus a thread-based approach on the same hardware." },
          { value: "10s timeout", explain: "The maximum time a single fetch attempt is allowed to run before being abandoned." },
          { value: "one in-flight request per domain", explain: "The politeness invariant this stage enforces at fetch time, backed by the back-queue lease." },
        ],
        breaks: {
          failure: "A domain returning 503 to the whole fleet draws every worker back on an identical schedule.",
          handled: "Backoff is jittered as base × 2^n × random(0.5, 1.5), and the retry re-enters that host's back queue. It stays one decision per host rather than a synchronized retry storm.",
        },
        choice: {
          pick: "Async I/O with connection pooling and a 10s timeout",
          instead: "A thread per in-flight request.",
          decider:
            "Fetching is almost entirely waiting, so the unit of concurrency should not cost a stack. Threads cap out in the low thousands per node; async sockets reach tens of thousands on the same hardware.",
          flips:
            "Very low concurrency, or a language without decent async support, where thread-per-request is dramatically simpler and the ceiling never binds.",
        },
      },
    },
    {
      id: "p-parse",
      label: "Parse + extract",
      sub: "streaming, ~300 links/page",
      kind: "process",
      col: 3,
      row: 3,
      parent: "crawl-worker",
      detail: {
        what: "Stream the fetched HTML, pull out the text content and the outbound anchors.",
        why: "Link extraction is what closes the loop: this is the step that makes a crawler a crawler rather than a downloader. Streaming rather than building a DOM matters because ~300 anchors do not justify allocating the whole tree at 400 pages/s.",
        numbers: [
          { value: "~300 links per page", explain: "The typical fan-out of one page, the source of new URLs for the next iteration of the loop." },
          { value: "~100KB average page, ~20KB gzipped", explain: "The typical size of an HTML document this stage processes." },
        ],
        breaks: {
          failure: "Malformed or enormous pages are a parser problem, not a fetch problem.",
          handled: "They need their own size and time bounds, or one page stalls a worker for the whole lease window instead of just failing its own fetch.",
        },
        choice: {
          pick: "Streaming HTML parser",
          instead: "Regex link extraction, or building a full DOM per page.",
          decider:
            "Robustness against cost. Regex breaks on real-world malformed HTML, and a full DOM allocates far more than is needed to pull ~300 anchors out of a 100KB document.",
          flips:
            "When you need the rendered page rather than the source, at which point you are running a headless browser and the economics change entirely.",
        },
      },
    },
    {
      id: "p-normalise",
      label: "URL normalise",
      sub: "canonical form for dedup",
      kind: "process",
      col: 3,
      row: 4,
      parent: "crawl-worker",
      detail: {
        what: "Canonicalise every extracted link, scheme and host case, trailing slashes, sort and tracking parameters, session ids, fragments, before publishing it to the bus.",
        why: "The seen index is only as good as the canonical form fed to it. This is its own stage because it is the single cheapest place to lose the entire dedup guarantee. A missed rule does not error; it just makes one page arrive under endlessly many spellings the Bloom filter cannot recognise as duplicates.",
        numbers: [
          { value: "~300 links normalised per page", explain: "300/page × ~400 pages/s fleet-wide ≈ 120k/s, matching this stage's own throughput number and the discovery bus's ingest rate below." },
          { value: "~120k normalised URLs/s fleet-wide", explain: "The aggregate throughput this stage sustains across the whole crawl." },
        ],
        breaks: {
          failure: "Over-aggressive normalisation is the mirror failure: stripping a parameter that is actually significant collapses distinct pages into one.",
          handled: "They are never fetched again, an accepted risk balanced against the far more common problem of under-normalisation, so rules are tuned conservatively.",
        },
        choice: {
          pick: "Normalise at extraction, before the URL reaches the bus",
          instead: "Normalise at admission, on the shard that owns the domain.",
          decider:
            "Where the duplicate costs you. Normalising at extraction means one canonical form is published, so the bus carries fewer messages and the partition key is stable. Normalising at admission means the same page can be routed under several spellings and each one pays a Bloom probe before being recognised.",
          flips:
            "When normalisation rules are domain-specific and only the owning shard knows them, which pushes the work to admission.",
        },
      },
    },
    {
      id: "p-fingerprint",
      label: "Content fingerprint",
      sub: "SimHash, 64-bit",
      kind: "process",
      col: 3,
      row: 5,
      parent: "crawl-worker",
      detail: {
        what: "Near-duplicate detection over page content using SimHash, then the storage write and the acknowledgement.",
        why: "URL dedup and content dedup are different problems. Mirrors, print views and syndicated articles are distinct URLs with identical bodies, and only a content fingerprint catches them. SimHash keeps similar documents close in Hamming distance, so near-duplicates collapse too.",
        numbers: [
          { value: "64-bit fingerprint", explain: "The compact size of this fingerprint, cheap to compute and store per page." },
          { value: "match within a Hamming distance of ~3 bits", explain: "The similarity threshold used to treat two fingerprints as near-duplicates." },
        ],
        breaks: {
          failure: "Too tight a threshold keeps mirrors, too loose discards genuinely distinct pages that share boilerplate.",
          handled: "The fingerprinting cost is paid on every page, including the majority that turn out unique, an accepted overhead for catching the near-duplicate cases exact hashing would miss.",
        },
        choice: {
          pick: "SimHash fingerprints, matched within a small Hamming distance",
          instead: "An exact content hash such as SHA-256, or MinHash/shingling.",
          decider:
            "Whether near-duplicates count. An exact hash catches byte-identical mirrors and nothing else, so a page differing only by a timestamp or an ad slot passes as new. SimHash keeps similar documents close in Hamming distance, which is the property you actually want, in 64 bits.",
          flips:
            "When only exact duplicates matter, where a cryptographic hash is cheaper, simpler and has no threshold to tune.",
        },
      },
    },

    // ---- outside the worker ----
    {
      id: "web",
      label: "The web",
      sub: "origin servers",
      kind: "external",
      col: 3,
      row: 0,
      detail: {
        what: "Everyone else's servers. The only part of the system you do not control.",
        why: "It is drawn explicitly because it sets the constraints the rest of the design answers to: rate limits, robots.txt, hostile responses, and latency you cannot budget for.",
        numbers: [
          { value: "~10^8 registrable domains in rotation", explain: "The full breadth of hosts the crawler interacts with, none of which it controls." },
          { value: "sustained 403/429 means you are being banned", explain: "The observable signal that a host has begun actively rejecting the crawler's traffic." },
        ],
        breaks: {
          failure: "Crawler traps, infinite calendars and session-id URLs generate unbounded distinct links that all look new to the seen index.",
          handled: "The politeness contract is also with the wrong entity in some cases. Thousands of small domains behind one IP each receive the crawler's full per-domain rate, an accepted mismatch this design does not fully solve.",
        },
      },
    },
    {
      id: "dns",
      label: "DNS cache",
      sub: "in-process resolver, 1h TTL",
      kind: "process",
      col: 3,
      row: 6,
      parent: "crawl-worker",
      detail: {
        what: "An in-process resolver with an hour-scale TTL cache, queried before every fetch.",
        why: "This is easy to overlook because it never shows up as its own line item, yet uncached resolution at ~50ms per lookup dominates wall time at 1000 fetches/second. The page fetch itself becomes the small part of the latency. Warm hits are sub-microsecond.",
        numbers: [
          { value: "~50ms uncached, sub-microsecond warm", explain: "The two very different costs of a cold versus warm DNS resolution." },
          { value: "~5GB for ~10^8 domain→IP at 50B/entry", explain: "The memory cost of caching resolution results for the full domain corpus." },
          { value: "1-hour TTL", explain: "How long a resolved entry stays valid before requiring a fresh lookup." },
        ],
        breaks: {
          failure: "Resolver flakiness shows up as a cache-miss latency spike rather than an error.",
          handled: "This needs a secondary resolver and a per-domain circuit breaker. Losing the cache itself is survivable, since it simply refills, which is exactly why this is a cache and not a store.",
        },
        choice: {
          pick: "In-process resolver with a 1-hour TTL cache",
          instead: "The system resolver, or a shared caching resolver on the network.",
          decider:
            "Round trips. A shared resolver still costs a network hop per lookup, and at 400-2000 fetches/s that hop is on the critical path of every fetch. In-process makes a warm hit free; the cost is one cache per node, which at ~5GB is affordable.",
          flips:
            "Low fetch rates, where a shared resolver's hit rate across the fleet beats per-node caches and the hop is invisible.",
        },
      },
    },
    {
      id: "render",
      label: "Headless render pool",
      sub: "escalation only, verdict cached",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "A browser farm that renders JS-heavy pages the plain HTTP fetch could not read, entered only on escalation.",
        why: "Modern single-page apps return near-empty HTML and assemble content in the browser, so the HTTP fetcher sees nothing useful. This is a separate service rather than a stage of the worker, precisely because its cost model differs by three orders of magnitude. It must scale and be capped independently.",
        numbers: [
          { value: "1-3 CPU-seconds and 2-5MB per render", explain: "The compute and memory cost of one escalated render, orders of magnitude above a plain fetch." },
          { value: "~1ms and 100KB for a plain fetch", explain: "The equivalent cost of the cheap path, for comparison." },
          { value: "rendering everything at 400 pages/s ≈ 800 cores", explain: "What full-scale rendering would cost if applied to every page rather than selectively." },
        ],
        breaks: {
          failure: "Escalating too eagerly turns an 800-core bill into the crawl's dominant cost.",
          handled: "The verdict is cached per domain so the second pass is not paid twice, bounding repeat escalation cost on the same SPA host.",
        },
        choice: {
          pick: "Selective escalation, gated on extracted text under ~500 bytes with high script density",
          instead: "Render every page, or never render.",
          decider:
            "Cost per page. A render is 1-3 CPU-seconds against ~1ms for a plain fetch, so rendering everything at 400 pages/s needs roughly 800 cores continuously. Never rendering silently drops whole classes of modern sites from the corpus.",
          flips:
            "A crawl targeting SPAs specifically, where almost every page needs rendering and the gate only adds a wasted first fetch.",
        },
      },
    },
    {
      id: "object-store",
      label: "Page archive",
      sub: "WARC records in object storage",
      kind: "blob",
      col: 3,
      row: 3,
      detail: {
        what: "The page archive: raw responses written as WARC records into object storage.",
        why: "The acknowledgement must follow this write, not the fetch. A crash between the two leaves a URL marked crawled with no page behind it, and nothing downstream ever notices because the seen set agrees it is done.",
        numbers: [
          { value: "~100TB/month raw, ~20TB/month compressed", explain: "The monthly volume this store ingests before and after compression." },
          { value: "~240TB/yr in the cold tier", explain: "The annual growth of this archive." },
          { value: "glacial after 90d", explain: "The tiering policy that moves older archives to the cheapest, slowest storage class." },
        ],
        breaks: {
          failure: "Ack-before-write silently loses pages.",
          handled: "The loss is invisible precisely because the seen index says the work was finished, which is exactly why write-then-ack ordering is treated as non-negotiable.",
        },
        choice: {
          pick: "WARC records in object storage",
          instead: "Individual files per page, or blobs in a database.",
          decider:
            "Object count. One object per page at 10^9 pages/month is a metadata problem in its own right. WARC concatenates many responses into large sequential files and preserves headers alongside bodies, the archival format the rest of the ecosystem already reads.",
          flips:
            "Small crawls where per-page addressability matters more than object count, and one file per URL is simply more convenient.",
        },
      },
    },
    {
      id: "metadata",
      label: "Page metadata",
      sub: "status, hashes, timestamps",
      kind: "database",
      col: 3,
      row: 4,
      detail: {
        what: "Per-URL bookkeeping: fetch status, content hash, SimHash, timestamps, retry counts.",
        why: "Recrawl scheduling and freshness estimation both need history, and the object store is the wrong place to query it. Keeping hashes here is also how you detect that a page changed without re-parsing it.",
        numbers: [
          { value: "~80B per row", explain: "The compact footprint of one URL's bookkeeping record." },
          { value: "~80GB/month, ~1TB/yr", explain: "The growth rate of this table at current crawl volume." },
        ],
        breaks: {
          failure: "The change-rate model trained from this table is a closed loop: a page we deprioritise is sampled rarely, looks unchanged when finally sampled, and is deprioritised further.",
          handled: "~2% of refresh throughput goes to uniformly random recrawls purely to keep the model unbiased, breaking the loop with a small deliberate sampling tax.",
        },
        choice: {
          pick: "A wide-column store keyed by url_hash",
          instead: "PostgreSQL.",
          decider:
            "Write rate and access pattern. This is one row per crawled URL at fetch rate, almost entirely blind writes and single-key reads with no joins. Postgres handles it happily until the row count and write rate outgrow one machine, and at ~1TB/yr this table is the one that does so first.",
          flips:
            "Below roughly 100M URLs. Postgres is simpler to operate and gives you real queries for freshness analysis, which is worth more than headroom you are not using yet.",
        },
      },
    },
  ],

  edges: [
    {
      id: "e1",
      from: "kafka",
      to: "p-dedup",
      tier: "hot",
      step: 1,
      label: "to owning shard",
      detail: {
        what: "Newly discovered URLs travelling from whichever shard found them to the shard that owns their domain.",
        why: "A parser has no idea which shard owns the links it just extracted, and a direct call would couple every shard to every other. The log decouples them and survives a restart, so a hand-off is never lost mid-flight.",
        numbers: [
          { value: "partitioned across ~256 shards by hash(registrable_domain)", explain: "How the log routes each URL to the shard responsible for its host." },
          { value: "~120k messages/s fleet-wide", explain: "The aggregate throughput this arrow carries across the whole crawl." },
        ],
        breaks: {
          failure: "If the consumer falls behind, discovery lag grows silently.",
          handled: "The crawl still looks healthy because fetching continues, but it is working from stale discoveries, so consumer lag is monitored as its own signal rather than inferred from fetch throughput.",
        },
      },
    },
    {
      id: "e2",
      from: "p-dedup",
      to: "seen",
      tier: "data",
      label: "seen?",
      detail: {
        what: "The dedup check: has this URL been crawled before?",
        why: "This is the cheapest possible rejection and it happens before anything is queued. A memory probe here saves a full fetch and parse downstream.",
        numbers: [
          { value: "~1% false-positive rate", explain: "The error rate of this check, biased entirely toward incorrectly saying a URL is already seen." },
          { value: "0 disk reads for a negative, RAM only", explain: "The common-case cost of this lookup." },
        ],
        breaks: {
          failure: "A false positive silently drops a page forever.",
          handled: "Link-graph redundancy is the usual defence, but pages linked from many places are the popular ones we would have found anyway. The pages lost are the single-inbound-link ones the crawl exists to find.",
        },
      },
    },
    {
      id: "e3",
      from: "p-dedup",
      to: "p-robots",
      tier: "data",
      detail: {
        what: "A URL that the seen index says is new, passed to the robots check.",
        why: "The order is deliberate and it is the whole reason admission is cheap. The Bloom probe is a memory access and rejects the large majority, so whatever reaches the robots lookup, which may touch disk, is already a small fraction of the input.",
        breaks: {
          failure: "Reversing these two makes admission disk-bound.",
          handled: "Every discovered link, including the ~99% that are duplicates, would pay a robots lookup first, which is exactly what running dedup first is designed to prevent.",
        },
      },
    },
    {
      id: "e4",
      from: "p-robots",
      to: "robots",
      tier: "control",
      label: "crawl rules",
      detail: {
        what: "Reading the cached robots rules for the URL's host.",
        why: "One fetch of robots.txt per host per TTL, turned into a lookup for every URL on that host. Rejecting a disallowed path here stops it consuming queue space and guarantees it can never be fetched later by accident.",
        numbers: [{ value: "one robots.txt fetch per host per TTL", explain: "The refresh cadence this cached lookup relies on." }],
        breaks: {
          failure: "If the rules are missing for a host, admission has to decide whether to block or optimistically allow.",
          handled: "Getting that default wrong is how crawlers get banned, so the default is chosen deliberately per deployment rather than left implicit.",
        },
      },
    },
    {
      id: "e5",
      from: "p-robots",
      to: "p-trap",
      tier: "data",
      detail: {
        what: "An allowed URL passed to the spider-trap guard.",
        why: "The trap guard runs last of the three rejections because it is the only one that needs mutable per-domain counters rather than a lookup. It is also the only one that can be wrong about a legitimate site.",
        breaks: {
          failure: "A trap that clears this stage consumes budget indefinitely.",
          handled: "Its URLs are genuinely new, genuinely allowed, and genuinely distinct, so nothing else in the system will stop them without the trap guard catching it here.",
        },
      },
    },
    {
      id: "e6",
      from: "p-trap",
      to: "robots",
      tier: "control",
      label: "novelty + depth",
      detail: {
        what: "Reading and updating the per-domain novelty rate, crawl depth and pattern blocklist.",
        why: "Trap detection is a per-domain statistic, not a per-URL one: a domain where almost every URL is new but almost every page is a near-duplicate is a trap by definition. Those counters live with the rest of the host state so one shard owns the whole verdict.",
        numbers: [{ value: "novelty near 100% with near-identical fingerprints is the signature", explain: "The combined signal this stage watches: high novelty plus low content diversity." }],
        breaks: {
          failure: "The counters are written on the admission hot path, so a slow store here throttles admission for the whole shard.",
          handled: "This is an accepted coupling, since keeping trap-detection state co-located with other host state is what lets one shard own the whole verdict without a remote call.",
        },
      },
    },
    {
      id: "e7",
      from: "p-trap",
      to: "p-router",
      tier: "data",
      detail: {
        what: "A URL that survived all three rejections, handed to the priority router for scoring.",
        why: "Scoring is deliberately last. It is the only stage that cannot reject anything. Running it before the filters would compute a score for the large majority of URLs about to be thrown away.",
        breaks: {
          failure: "The score is frozen at this moment.",
          handled: "A page that becomes important later keeps its old band until something rediscovers it, an accepted staleness given how expensive continuous rescoring would be.",
        },
      },
    },
    {
      id: "e8",
      from: "p-router",
      to: "front-queues",
      tier: "data",
      label: "priority band",
      detail: {
        what: "An admitted, scored URL appended to one of ten priority bands.",
        why: "By this point the URL is known to be new, allowed and not part of a trap. The only remaining question is how much it is worth, which is what the band encodes, to one significant figure.",
        numbers: [{ value: "~70% of the budget to refresh, ~30% to discovery", explain: "The hard quota split enforced at this point, rather than left to emerge from the score." }],
        breaks: {
          failure: "The quota is enforced here rather than emerging from the score.",
          handled: "A URL due for refresh has measured history, and a new URL has only what it inherits. In one ranking the measured always outbids the guessed, which is why the split is structural instead.",
        },
      },
    },
    {
      id: "e9",
      from: "front-queues",
      to: "back-queues",
      tier: "data",
      label: "one host per queue",
      detail: {
        what: "Refilling a drained back queue: pull from a weighted-random front queue until a URL for an unassigned host appears, then that host owns the queue until it empties.",
        why: "This is the hand-off from what is worth crawling to when am I allowed to crawl it, and it happens once per host rather than once per URL. Priority therefore governs which hosts are admitted; within a host, order is arrival order.",
        numbers: [{ value: "B ≈ 3 × fetcher threads", explain: "Enough spare queues that a front-queue pull finds an unassigned host without stalling, but not so many that host slots sit idle waiting to be claimed." }],
        breaks: {
          failure: "A flood of URLs for one host piles into a single back queue.",
          handled: "A high band cannot make that host go faster; value cannot buy politeness, which is exactly the intended structural limit.",
        },
      },
    },
    {
      id: "e10",
      from: "back-queues",
      to: "robots",
      tier: "control",
      label: "next-fetch time",
      detail: {
        what: "Reading a host's crawl delay and next-fetch timestamp to order the min-heap.",
        why: "The heap is keyed on next_allowed_time, and that value comes from here. This is the read that turns a published Crawl-Delay into actual scheduling behaviour.",
        numbers: [{ value: "one heap entry per non-empty back queue", explain: "The scheduling granularity: one ordering slot per active host, not per queued URL." }],
        breaks: {
          failure: "A missing or stale delay makes the heap schedule a host too early.",
          handled: "That is a politeness violation rather than a performance bug, which is why host-state freshness is monitored separately from queue throughput.",
        },
      },
    },
    {
      id: "e11",
      from: "back-queues",
      to: "p-fetch",
      tier: "hot",
      step: 2,
      fromSide: "right",
      toSide: "left",
      label: "ready host, leased",
      detail: {
        what: "A host whose cooldown has elapsed, leased to a worker: the URL is hidden for a 60s lease window rather than dequeued.",
        why: "Leasing rather than handing out the URL outright is what stops two workers crawling the same host at once. The lease is the mutual exclusion and no global lock is needed. It is also the crash-recovery mechanism: anything unacknowledged reappears when its lease expires, making restart and retry the same code path.",
        numbers: [
          { value: "60s lease against a 10s fetch timeout", explain: "The lease window is generously longer than the expected fetch time, absorbing normal variance without expiring prematurely." },
          { value: "10,000 ready hosts × 1/s = 10,000 req/s ceiling", explain: "The theoretical throughput ceiling if every ready host were fetched at exactly its politeness rate." },
        ],
        breaks: {
          failure: "If a worker dies holding a lease, that host stalls until the lease expires.",
          handled: "The timeout directly bounds recovery time, which is why the lease duration is set as a deliberate tradeoff between crash-recovery speed and false-expiry risk.",
        },
      },
    },
    {
      id: "e12",
      from: "p-fetch",
      to: "web",
      tier: "hot",
      step: 3,
      label: "HTTP GET",
      detail: {
        what: "The actual HTTP request to somebody else's server.",
        why: "Everything upstream exists to make this one call safe to make: known-new, allowed, not a trap, and correctly paced.",
        numbers: [
          { value: "10s timeout", explain: "The maximum time this call is allowed before being abandoned." },
          { value: "one in-flight request per domain", explain: "The politeness invariant this call always respects, enforced upstream by the lease." },
        ],
        breaks: {
          failure: "Timeouts, redirects and hostile responses all land here.",
          handled: "A domain answering in 30s occupies a worker slot for 30s, which is what the timeout and the per-domain in-flight quota of 1 exist to bound.",
        },
      },
    },
    {
      id: "e13",
      from: "p-fetch",
      to: "dns",
      tier: "control",
      label: "resolve host",
      detail: {
        what: "Resolving the host to an IP before the request goes out.",
        why: "Drawn explicitly because it is the step that dominates real deployments and appears in no textbook diagram. Uncached at ~50ms, resolution is most of the wall clock, and the page fetch becomes the small part.",
        numbers: [
          { value: "~50ms uncached", explain: "Roughly 50x the ~1ms a plain fetch needs once resolved — that gap is why the in-process DNS cache is load-bearing, not a nice-to-have." },
          { value: "under 1µs warm", explain: "The cost once cached, effectively free." },
          { value: "1-hour TTL", explain: "How long a resolved entry remains valid before requiring a fresh lookup." },
        ],
        breaks: {
          failure: "A cache miss storm, a resolver restart, or a wave of never-seen hosts, puts 50ms back on the front of every fetch at once.",
          handled: "It shows up as a latency spike rather than an error, which is why DNS latency is monitored as its own dimension separate from fetch success rate.",
        },
      },
    },
    {
      id: "e14",
      from: "web",
      to: "robots",
      tier: "control",
      label: "robots.txt, TTL cached",
      detail: {
        what: "Fetching robots.txt on first contact with a host and caching the parsed rules with a TTL.",
        why: "One request per host rather than per URL. This is a control path: it carries no crawl output and exists purely to constrain the crawler.",
        numbers: [
          { value: "one fetch per host per TTL", explain: "The refresh cadence for this control-path fetch." },
          { value: "~2KB of rules per domain", explain: "The typical size of a parsed robots.txt document." },
        ],
        breaks: {
          failure: "A stale cache keeps you crawling paths a site has since disallowed, the specific failure that gets a crawler blocked.",
          handled: "Robots.txt was only standardised as RFC 9309 in 2022, so rule-precedence conflicts are resolved by convention rather than specification, an accepted source of ambiguity.",
        },
      },
    },
    {
      id: "e15",
      from: "p-fetch",
      to: "p-parse",
      tier: "hot",
      step: 4,
      label: "HTML",
      detail: {
        what: "The fetched response body handed to the parser, in-process.",
        why: "This stays inside one worker rather than crossing a queue because the lease is still held. The worker cannot acknowledge until the page is stored, so handing the body to another service would only move the ack problem somewhere harder.",
        numbers: [{ value: "~100KB average page", explain: "The typical size of the data handed off at this in-process boundary." }],
        breaks: {
          failure: "Enormous or malformed pages are a parser problem, not a fetch problem.",
          handled: "They need their own size and time bounds, or one page stalls the worker for the whole lease window rather than just failing its own parse.",
        },
      },
    },
    {
      id: "e16",
      from: "p-parse",
      to: "render",
      tier: "control",
      fromSide: "left",
      toSide: "right",
      label: "thin HTML, JS-heavy",
      detail: {
        what: "Escalating a page to the browser pool when the extracted text is under ~500 bytes but script density is high.",
        why: "The verdict cannot be made before fetching, because a single-page app is indistinguishable from a normal page until you have its HTML. Deciding here, after parsing, means the cheap path is always tried first and only the failures cost a render.",
        numbers: [
          { value: "escalation threshold ~500 bytes of extracted text", explain: "The specific signal that triggers escalation to the more expensive rendering path." },
          { value: "1-3 CPU-seconds per render", explain: "At ~2 CPU-seconds average and 400 pages/s fleet-wide, rendering everything would need ~800 cores continuously — why escalation is selective, not default." },
        ],
        breaks: {
          failure: "Without caching the verdict per domain, every page on an SPA host pays the plain fetch before escalating.",
          handled: "The cheap attempt becomes pure waste at scale in that case, which is why the escalation decision is cached and reused for the rest of that domain.",
        },
      },
    },
    {
      id: "e17",
      from: "p-parse",
      to: "p-normalise",
      tier: "data",
      label: "links + text",
      detail: {
        what: "The ~300 extracted anchors passed to normalisation before anything is published.",
        why: "Normalising before publishing means the bus carries one canonical spelling per page and the hash(domain) partition key is stable. Normalising after would route the same page to the same shard under several spellings, each paying its own Bloom probe.",
        numbers: [{ value: "~300 links per page", explain: "The typical volume of links handed off at this stage." }],
        breaks: {
          failure: "Anything the parser fails to extract, links assembled by script, or inside attributes it does not read, is invisible to the whole rest of the system.",
          handled: "This is an accepted limitation of the plain HTTP fetch path, one of the reasons the render pool exists as an escalation option for script-heavy pages.",
        },
      },
    },
    {
      id: "e18",
      from: "p-normalise",
      to: "kafka",
      tier: "hot",
      step: 5,
      fromSide: "right",
      toSide: "top",
      label: "~300 links/page",
      offset: 100,
      detail: {
        what: "Canonicalised links published back onto the discovery bus. This is the arrow that makes it a crawl.",
        why: "Without this edge the system is a downloader with a fixed input list. Every link goes back to the bus rather than into the local frontier because most of them belong to other shards. The shard that found them owns no politeness state for their hosts.",
        numbers: [
          { value: "~300 links per page", explain: "The multiplier that turns a linear fetch rate into ~120k msg/s, ~24MB/s of bus load — this compounding is what makes crawling a loop, not a fixed download job." },
          { value: "~120k messages/s fleet-wide, ~24MB/s", explain: "The aggregate throughput this arrow sustains across the whole crawl." },
        ],
        breaks: {
          failure: "Miss a normalisation rule and the same page arrives under endlessly many spellings that the seen index cannot recognise as duplicates.",
          handled: "This is a spider trap you built yourself, which is why normalisation correctness is treated as load-bearing for the dedup guarantee, not a cosmetic cleanup step.",
        },
      },
    },
    {
      id: "e19",
      from: "p-normalise",
      to: "p-fingerprint",
      tier: "data",
      label: "canonical URL",
      detail: {
        what: "The page content, now with its canonical URL, passed to content dedup.",
        why: "URL dedup already happened at admission and is not sufficient: mirrors, print views and syndicated copies are distinct URLs with identical bodies, and only a content fingerprint catches them.",
        breaks: {
          failure: "Fingerprinting cost is paid on every page, including the large majority that turn out to be unique.",
          handled: "This is an accepted overhead, since the alternative of skipping fingerprinting would let near-duplicate mirrors and syndicated copies through undetected.",
        },
      },
    },
    {
      id: "e20",
      from: "p-fingerprint",
      to: "object-store",
      tier: "hot",
      step: 6,
      label: "WARC write",
      detail: {
        what: "Writing the page itself to durable storage as a WARC record.",
        why: "This write is the one that must complete before the URL is acknowledged as crawled, because the acknowledgement is what makes the work unrepeatable.",
        numbers: [
          { value: "~20KB compressed per page", explain: "The typical size of one archived page after compression." },
          { value: "~20TB/month", explain: "The aggregate archive growth rate this write path produces." },
        ],
        breaks: {
          failure: "Ack-before-write loses pages invisibly.",
          handled: "The seen index insists the work is done, so nothing ever retries, which is exactly why this write is ordered strictly before the acknowledgement, never after.",
        },
      },
    },
    {
      id: "e21",
      from: "p-fingerprint",
      to: "metadata",
      tier: "data",
      label: "status, hash, ts",
      detail: {
        what: "Recording fetch status, content hash, SimHash and timestamps for the URL.",
        why: "Recrawl scheduling and change detection both need history, and comparing a stored hash tells you a page changed without re-parsing it.",
        numbers: [{ value: "~80B per row", explain: "The compact size of one bookkeeping record written by this arrow." }],
        breaks: {
          failure: "Without per-host retry counts alongside this, backoff is decided per URL.",
          handled: "A dead host is hammered by every worker independently in that case, which is why retry state is kept with the host record rather than the URL record.",
        },
      },
    },
    {
      id: "e22",
      from: "p-fingerprint",
      to: "back-queues",
      tier: "control",
      fromSide: "right",
      toSide: "bottom",
      label: "ack, lease released",
      detail: {
        what: "The acknowledgement back to the frontier, sent strictly after the storage write completes.",
        why: "This edge is the whole crash-safety story and it is drawn because its ordering is the design. Ack after the write means a crash anywhere before it simply lets the lease expire and the URL become visible again. Ack after the fetch instead means a crash leaves a URL marked crawled with no page behind it.",
        numbers: [{ value: "60s lease window", explain: "The recovery bound this ordering relies on: an unacknowledged lease expires and the URL becomes retryable." }],
        breaks: {
          failure: "Nothing downstream ever notices an ack-before-write bug.",
          handled: "The seen index agrees the work is finished, so the only detection is a sampled audit of the archive against the seen set. This is why write-then-ack ordering is enforced structurally rather than trusted to code review.",
        },
      },
    },
  ],
};
