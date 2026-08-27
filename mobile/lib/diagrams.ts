/**
 * Data model for the interactive architecture diagrams.
 *
 * A diagram is data, not drawing: nodes carry their own explanation, so the
 * renderer (components/ArchDiagram.web.tsx) stays generic and adding a new
 * question means writing a spec here rather than hand-authoring SVG.
 *
 * Positions are in an arbitrary grid space; React Flow fits them to the
 * viewport, so only the relative layout matters.
 */

/** Visual role. Drives colour and border treatment, nothing else. */
export type NodeKind =
  | "bus" // durable log / message bus
  | "compute" // stateless worker tier
  | "store" // database, index, object store
  | "external" // outside our trust boundary
  | "group"; // background grouping box, non-interactive

/**
 * Why this particular technology, in the same shape as the "Key decisions"
 * micro-schema used across patterns.md: what was picked, what it was picked
 * over, the measurable thing that decided it, and when the alternative wins.
 */
export interface TechChoice {
  /** What is actually deployed here. */
  pick: string;
  /** The credible alternative, stated fairly. */
  instead: string;
  /** The number or property that settles it. */
  decider: string;
  /** Conditions under which you would pick the alternative instead. */
  flips: string;
}

export interface DiagramNodeDetail {
  /** One line: what this component is. */
  what: string;
  /** Why it exists at all; the design pressure it answers. */
  why: string;
  /** Concrete figures worth quoting in an interview. */
  numbers?: string[];
  /** The failure this component owns. */
  breaks?: string;
  /** Why this technology rather than the obvious alternative. */
  choice?: TechChoice;
}

export interface DiagramNode {
  id: string;
  label: string;
  /** Second line inside the box: the implementation choice. */
  sub?: string;
  kind: NodeKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  detail?: DiagramNodeDetail;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** Dashed = control/metadata path rather than the main data path. */
  dashed?: boolean;
  /** Animated = the hot path the system spends its time on. */
  animated?: boolean;
  /** How far the orthogonal route stands off from the node, in px. */
  offset?: number;
  /** Every edge is clickable; this is what it says when you click it. */
  detail?: DiagramNodeDetail;
  /** Anchor overrides when the default top/bottom routing reads badly. */
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
}

export interface DiagramOverview {
  /** The one-sentence shape of the system. */
  shape: string;
  /** Ordered walk through the design, one beat per paragraph. */
  beats: string[];
  /** The single hardest thing, stated plainly. */
  crux: string;
  numbers?: string[];
}

export interface Diagram {
  id: string;
  title: string;
  /** The question this diagram answers, worded exactly as in the source. */
  question: string;
  overview: DiagramOverview;
  /** Deep link back to the question this diagram belongs to. */
  sourceId: string;
  itemId: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const WEB_CRAWLER: Diagram = {
  id: "web-crawler",
  title: "Web Crawler",
  question: "Design a Web Crawler",
  sourceId: "patterns",
  itemId: 6,
  overview: {
    shape:
      "A crawler is a loop, not a pipeline: every page you fetch produces the URLs that feed the next fetch, so the system's job is deciding what to pull next without drowning in duplicates or getting itself blocked.",
    beats: [
      "Discovery is a hand-off. A parser on one shard constantly finds links belonging to another, so new URLs go onto a partitioned log keyed by hash(domain) rather than being handled locally. Sharding by domain is what keeps all politeness state for a host on one machine.",
      "Admission is where the money is saved. Before a URL can occupy queue space it must clear the seen index and the robots rules. Every rejection here avoids a TCP connection, a download and a parse, which is why the cheap checks sit in front.",
      "The frontier is two tiers because it answers two different questions. Front queues decide what is worth crawling (value); back queues decide when you are allowed to (politeness). Keeping them separate means one queue per host makes the rate limit structural rather than something a lock has to enforce.",
      "Fetch and parse are the easy part, and deliberately stateless. The interesting constraint is that they are almost entirely I/O wait, so concurrency comes from async sockets rather than threads.",
      "Storage closes the loop safely. The acknowledgement must follow the write, never the fetch, or a crash leaves a URL marked crawled with no page behind it and nothing downstream will ever notice.",
    ],
    crux:
      "Politeness and throughput pull in opposite directions. You want maximum parallelism globally and strict serialisation per host, and the only way to have both is to make the host the unit of scheduling rather than the URL.",
    numbers: [
      "~300 links extracted per page",
      "12GB Bloom vs ~240GB exact index",
      "one request per second per domain",
    ],
  },
  nodes: [
    {
      id: "frontier-group",
      label: "Frontier shard",
      kind: "group",
      x: 16,
      y: 112,
      w: 344,
      h: 336,
      detail: {
        what: "One shard's worth of frontier: the admission gate plus both queue tiers, owning every domain that hashes to this shard.",
        why: "Politeness is per host, so the scheduling state for a host has to live in exactly one place. Sharding by hash(domain) guarantees that, which is why cross-shard discoveries go over the bus instead of being handled locally.",
        numbers: ["shard key = hash(domain)", "all politeness state stays node-local"],
        breaks:
          "Rebalancing shards moves domains between nodes, and their next-fetch timestamps have to move with them or the new owner will crawl too fast.",
        choice: {
          pick: 'Shard the whole crawler by hash(domain)',
          instead: 'Shard by URL hash, or a shared global frontier.',
          decider: 'Politeness is per host, so all scheduling state for a host must live in one place. Sharding by URL scatters one domain across every node, and enforcing one request per second then needs distributed coordination on the hot path. Hashing the domain makes it node-local by construction.',
          flips: 'When no politeness constraint exists, for example crawling your own infrastructure, where URL-hash sharding balances load more evenly.',
        },
      },
    },
    {
      id: "kafka",
      label: "Kafka discovery bus",
      sub: "URL hand-off, partitioned by hash(domain)",
      kind: "bus",
      x: 40,
      y: 0,
      w: 640,
      detail: {
        what: "A partitioned durable log carrying newly discovered URLs to whichever shard owns their domain.",
        why: "The crawler is sharded by hash(domain) so all politeness state for a host lives on one node. A parser on shard 3 constantly finds links belonging to shard 17, and that hand-off has to survive a restart, so it is a log rather than an RPC.",
        numbers: ["~300 links extracted per page", "partition key = hash(domain)"],
        breaks:
          "Partition skew: one enormous domain pins a single partition, so that shard falls behind while the rest idle.",
        choice: {
          pick: 'Kafka, partitioned by hash(domain)',
          instead: 'Direct RPC between shards, or a work queue like SQS or RabbitMQ.',
          decider: 'Whether a hand-off may be lost when a shard restarts. At ~300 links per page across a fleet that restarts routinely, RPC drops discoveries silently and a queue gives you no replay once consumed. A partitioned log survives restarts and lets a shard rewind.',
          flips: 'A single-node crawler, or one small enough that the whole frontier fits on one machine. Then there is no hand-off at all and a broker is pure operational cost.',
        },
      },
    },
    {
      id: "admission",
      label: "Admission gate",
      sub: "seen? robots allowed?",
      kind: "compute",
      x: 40,
      y: 150,
      w: 280,
      detail: {
        what: "The single entry point into a shard's frontier. Rejects a URL before it can ever occupy queue space.",
        why: "Every filter here is cheaper than the fetch it prevents. Checking the seen index costs a memory probe; fetching a duplicate costs a TCP connection, a page download and a parse.",
        numbers: ["~1% Bloom false-positive rate", "rejects the large majority of discovered links"],
        breaks:
          "A Bloom false positive says 'seen' for a page never crawled, and nothing ever revisits it. That is the accepted cost of the 20x memory saving.",
        choice: {
          pick: 'Bloom probe first, robots check second, both before the URL is queued',
          instead: 'Admitting first and filtering at fetch time, or checking robots before dedup.',
          decider: 'Relative cost per rejection. The Bloom probe is a memory access and rejects the large majority of discovered links, so it must run first; the robots lookup may touch disk. Filtering at fetch time instead means every rejected URL has already consumed queue space and a scheduling slot.',
          flips: 'A crawl with no dedup requirement, such as a deliberate recrawl sweep, where the seen check would reject exactly the URLs you are trying to revisit.',
        },
      },
    },
    {
      id: "front-queues",
      label: "Front queues",
      sub: "10 priority bands",
      kind: "compute",
      x: 40,
      y: 250,
      w: 280,
      detail: {
        what: "Ten queues, one per priority band. A router maps each admitted URL's score to a band and appends.",
        why: "Bands rather than a total order is deliberate. A global priority queue over 100M entries costs a heap operation per insert and demands a total order across signals that share no units: change-rate and domain authority are not commensurable. Ten bands means the score only has to be right to one significant figure.",
        numbers: ["F = ~10 bands", "selection is weighted random, not strict"],
        breaks:
          "Strict selection across bands starves the low bands forever, which is why selection is weighted random instead.",
        choice: {
          pick: '10 discrete priority bands',
          instead: 'A single global priority queue ordered by a computed score.',
          decider: 'Cost and honesty of the ordering. A heap over ~100M entries costs a log-n operation per insert, and it demands a total order across signals with no common unit: change-rate and domain authority are not commensurable. 10 bands means the score only has to be right to one significant figure, which is all those estimates are worth.',
          flips: 'Small frontiers, or when the priority genuinely is one measurable quantity (say, pure recency), where a real ordering is both cheap and meaningful.',
        },
      },
    },
    {
      id: "back-queues",
      label: "Back queues + min-heap",
      sub: "one host per queue, Redis",
      kind: "compute",
      x: 40,
      y: 350,
      w: 280,
      detail: {
        what: "One queue per host, plus a min-heap ordered by each host's next-fetch time.",
        why: "This is what makes politeness structural rather than enforced by a lock. A worker pops the heap for a host whose cooldown has elapsed and leases it, so one request per second per domain falls out of the data structure instead of out of coordination.",
        numbers: ["one queue per live host", "lease held for the fetch duration"],
        breaks:
          "A hot host with a deep queue drains slowly no matter how much fleet you add, because its own politeness delay is the ceiling.",
        choice: {
          pick: 'Redis sorted sets, one per host, with a min-heap on next-fetch time',
          instead: 'Keeping the schedule in process memory, or as rows in the metadata database.',
          decider: 'Whether the schedule must outlive a worker. In-memory is fastest but a crash loses every cooldown and the crawler resumes impolitely; a relational table survives but a poll-for-ready-hosts query at this rate is a table scan. A sorted set gives O(log n) next-ready in a store that persists.',
          flips: 'A single-process crawler where the frontier is already in memory and a crash means a full restart anyway.',
        },
      },
    },
    {
      id: "seen",
      label: "Seen index",
      sub: "Bloom in RAM + RocksDB",
      kind: "store",
      x: 440,
      y: 150,
      w: 240,
      detail: {
        what: "Two tiers: an in-memory Bloom filter as the fast reject, RocksDB on disk as ground truth for confirmed-seen URLs.",
        why: "An exact index of 10 billion URLs is roughly 240GB and cannot sit in RAM. The Bloom filter answers the same question in 12GB with a 1% false-positive rate and no false negatives, so a 'not seen' answer is always trustworthy.",
        numbers: ["12GB Bloom vs ~240GB exact", "10B URLs", "~1% false positives"],
        breaks:
          "The filter cannot delete. Recrawl policy has to live elsewhere, or the structure has to be rebuilt periodically.",
        choice: {
          pick: 'Bloom filter in RAM, RocksDB as ground truth',
          instead: 'An exact index in Redis, or a plain database lookup per URL.',
          decider: "Memory. 10 billion URLs exactly indexed is roughly 240GB; the same question answered probabilistically is 12GB at a 1% false-positive rate, a 20x saving. False negatives are impossible, so 'not seen' is always trustworthy and only a fetch is ever wasted, never lost.",
          flips: 'When missing a page is unacceptable, for example a compliance or archival crawl, where you cannot accept 1% of URLs being silently dropped forever.',
        },
      },
    },
    {
      id: "robots",
      label: "Robots + politeness",
      sub: "RocksDB, per domain",
      kind: "store",
      x: 440,
      y: 270,
      w: 240,
      detail: {
        what: "Per-domain crawl rules and next-fetch timestamps, fetched on first contact and cached with a TTL.",
        why: "robots.txt is a per-host round trip you must not repeat per URL. Caching it per domain turns a fetch into a lookup, and it is the same record that carries the crawl delay the back queues schedule against.",
        numbers: ["one fetch per host per TTL", "crawl-delay honoured per domain"],
        breaks:
          "A stale cache keeps you crawling paths the site has since disallowed, which is the failure that gets a crawler blocked.",
        choice: {
          pick: 'RocksDB, keyed by domain',
          instead: 'Redis, or an in-memory map per shard.',
          decider: "Working-set size against persistence. Rules and next-fetch timestamps for tens of millions of hosts exceed comfortable RAM, and they must survive restarts or the crawler wakes up with no memory of anyone's crawl delay. An embedded LSM store keeps hot domains in memory and spills the long tail to disk with no extra service to run.",
          flips: 'A crawl scoped to a few thousand known hosts, where the whole table is a few MB and Redis or a plain map is simpler.',
        },
      },
    },
    {
      id: "fetcher",
      label: "Fetcher pool",
      sub: "async I/O + DNS cache",
      kind: "compute",
      x: 40,
      y: 480,
      w: 280,
      detail: {
        what: "The worker tier that actually performs HTTP GETs, on async I/O with a local DNS cache.",
        why: "Fetching is almost entirely waiting, so threads are the wrong unit: async I/O holds tens of thousands of sockets per node. DNS is cached because an uncached lookup can cost more than the page fetch.",
        numbers: ["thousands of concurrent sockets per node", "DNS cached per host"],
        breaks:
          "Retry state belongs to the host, not the URL. Without that, a host returning 503 pulls the whole fleet back on an identical schedule.",
        choice: {
          pick: 'Async I/O with a local DNS cache',
          instead: 'A thread per in-flight request.',
          decider: 'Fetching is almost entirely waiting, so the unit of concurrency should not cost a stack. Threads cap out in the low thousands per node; async sockets reach tens of thousands on the same hardware. An uncached DNS lookup can also cost more than the page fetch it precedes.',
          flips: 'Very low concurrency, or a language without decent async support, where thread-per-request is dramatically simpler and the ceiling never binds.',
        },
      },
    },
    {
      id: "web",
      label: "The web",
      sub: "origin servers",
      kind: "external",
      x: 440,
      y: 480,
      w: 240,
      detail: {
        what: "Everyone else's servers. The only part of this diagram you do not control.",
        why: "It is drawn explicitly because it sets the constraints the rest of the design answers to: rate limits, robots.txt, hostile responses, and latency you cannot budget for.",
        breaks:
          "Crawler traps, infinite calendars and session-id URLs generate unbounded distinct links that all look new to the seen index.",
      },
    },
    {
      id: "parser",
      label: "HTML parser",
      kind: "compute",
      x: 40,
      y: 580,
      w: 280,
      detail: {
        what: "Extracts links and text from fetched HTML, normalises the URLs, and publishes discoveries back to the bus.",
        why: "Link extraction is what closes the loop: this is the step that makes a crawler a crawler rather than a downloader. URL normalisation happens here because the seen index is only as good as the canonical form fed to it.",
        numbers: ["~300 links per page"],
        breaks:
          "Missed normalisation (trailing slashes, sort params, session ids) inflates the frontier with duplicates the seen index cannot recognise.",
        choice: {
          pick: 'Streaming HTML parser with URL normalisation at extraction',
          instead: 'Regex link extraction, or building a full DOM per page.',
          decider: 'Robustness against cost. Regex breaks on real-world malformed HTML, and a full DOM allocates far more than is needed to pull ~300 anchors. Normalising here matters more than either: the seen index is only as good as the canonical form fed to it.',
          flips: 'When you need the rendered page rather than the source, at which point you are running a headless browser and this is a different, far more expensive system.',
        },
      },
    },
    {
      id: "filter",
      label: "Content filter",
      sub: "SimHash near-dup",
      kind: "compute",
      x: 40,
      y: 680,
      w: 280,
      detail: {
        what: "Near-duplicate detection over page content using SimHash fingerprints.",
        why: "URL dedup and content dedup are different problems. Mirrors, print views and syndicated articles are distinct URLs with identical bodies, and only a content fingerprint catches them. SimHash keeps similar documents close in Hamming distance, so near-duplicates collapse too.",
        numbers: ["64-bit fingerprint", "match within a small Hamming distance"],
        breaks:
          "Too tight a threshold keeps mirrors, too loose discards genuinely distinct pages that share boilerplate.",
        choice: {
          pick: 'SimHash fingerprints, matched within a small Hamming distance',
          instead: 'An exact content hash such as SHA-256, or MinHash/shingling.',
          decider: 'Whether near-duplicates count. An exact hash catches byte-identical mirrors and nothing else, so a page differing only by a timestamp or an ad slot passes as new. SimHash keeps similar documents close in Hamming distance, which is the property you actually want, in 64 bits.',
          flips: 'When only exact duplicates matter, where a cryptographic hash is cheaper, simpler and has no threshold to tune.',
        },
      },
    },
    {
      id: "object-store",
      label: "Object store",
      sub: "WARC, ack after write",
      kind: "store",
      x: 440,
      y: 680,
      w: 240,
      detail: {
        what: "The page archive: raw responses written as WARC records.",
        why: "The acknowledgement must follow the storage write, not the fetch. A crash between the two leaves a URL marked crawled with no page behind it, and nothing downstream ever notices because the seen set agrees it is done.",
        numbers: ["ack strictly after the write completes"],
        breaks:
          "Ack-before-write silently loses pages, and the loss is invisible precisely because the seen index says the work was finished.",
        choice: {
          pick: 'WARC records in object storage',
          instead: 'Individual files per page, or blobs in a database.',
          decider: 'Object count. One object per page at billions of pages is a metadata problem in its own right; WARC concatenates many responses into large sequential files and preserves headers alongside bodies, which is the archival format the rest of the ecosystem already reads.',
          flips: 'Small crawls where per-page addressability matters more than object count, and the convenience of one file per URL wins.',
        },
      },
    },
    {
      id: "metadata",
      label: "Metadata DB",
      sub: "status, hashes, timestamps",
      kind: "store",
      x: 440,
      y: 780,
      w: 240,
      detail: {
        what: "Per-URL bookkeeping: fetch status, content hash, timestamps, retry counts.",
        why: "Recrawl scheduling and freshness estimation both need history, and the object store is the wrong place to query it. Keeping hashes here is also how you detect that a page changed without re-parsing it.",
        numbers: ["one row per crawled URL"],
        breaks:
          "Without per-host retry state alongside it, backoff decisions get made per URL and a dead host is hammered by every worker at once.",
        choice: {
          pick: 'A wide-column store keyed by URL',
          instead: 'PostgreSQL.',
          decider: 'Write rate and access pattern. This is one row per crawled URL at fetch rate, almost entirely blind writes and single-key reads with no joins. Postgres handles it happily until the row count and write rate outgrow one machine, and this table is the one that does so first.',
          flips: 'Below roughly 100M URLs. Postgres is simpler to operate and gives you real queries for freshness analysis, which is worth more than headroom you are not using yet.',
        },
      },
    },
  ],
  edges: [
    { id: "e1", from: "kafka", to: "admission", label: "to owning shard", animated: true,
      detail: {
        what: 'Newly discovered URLs travelling from whichever shard found them to the shard that owns their domain.',
        why: 'A parser has no idea which shard owns the links it just extracted, and a direct call would couple every shard to every other. The log decouples them and survives a restart, so a hand-off is never lost mid-flight.',
        numbers: ['partitioned by hash(domain)'],
        breaks: 'If the consumer falls behind, discovery lag grows silently: the crawl still looks healthy because fetching continues, but it is working from stale discoveries.',
      },
    },
    { id: "e2", from: "admission", to: "front-queues",
      detail: {
        what: 'An admitted URL being placed into a priority band.',
        why: 'Admission and prioritisation are separate concerns. By this point the URL is known to be new and allowed, so the only remaining question is how much it is worth, which is what the band encodes.',
        breaks: 'Scoring at admission time means the score is frozen; a page that becomes important later keeps its old band until it is rediscovered.',
      },
    },
    { id: "e3", from: "front-queues", to: "back-queues",
      detail: {
        what: "A URL moving from its value band into its host's politeness queue.",
        why: "This is the hand-off from 'what is worth crawling' to 'when am I allowed to crawl it'. The two tiers exist precisely so these questions do not have to be answered by the same structure.",
        breaks: 'A flood of URLs for one host piles into a single back queue, so a high band cannot make that host go faster; value cannot buy politeness.',
      },
    },
    { id: "e4", from: "admission", to: "seen", label: "seen?", fromSide: "right", toSide: "left",
      detail: {
        what: 'The dedup check: has this URL been crawled before?',
        why: 'This is the cheapest possible rejection and it happens before anything is queued. A memory probe here saves a full fetch and parse downstream.',
        numbers: ['~1% false-positive rate', 'answered from RAM'],
        breaks: 'A false positive silently drops a page forever. There is no error and no retry, which is the accepted cost of the 20x memory saving.',
      },
    },
    { id: "e5", from: "admission", to: "robots", dashed: true, fromSide: "right", toSide: "left",
      detail: {
        what: 'Checking the cached robots rules before a URL is admitted.',
        why: 'Rejecting a disallowed path at admission stops it consuming queue space and guarantees it can never be fetched by accident later.',
        breaks: 'If the rules are missing for a host, admission has to decide whether to block or to optimistically allow, and getting that default wrong is how crawlers get banned.',
      },
    },
    { id: "e6", from: "back-queues", to: "robots", dashed: true, fromSide: "right", toSide: "left",
      detail: {
        what: "Reading a host's crawl delay and next-fetch timestamp to schedule it.",
        why: "The back queue's min-heap is ordered by next-fetch time, and that value comes from here. This is the read that turns a published crawl-delay into actual scheduling behaviour.",
        numbers: ['one entry per live host'],
        breaks: 'A missing or stale delay makes the heap schedule a host too early, which is a politeness violation rather than a performance bug.',
      },
    },
    { id: "e7", from: "back-queues", to: "fetcher", label: "ready host, leased", animated: true,
      detail: {
        what: 'A host whose cooldown has elapsed being leased to a fetcher.',
        why: 'Leasing rather than handing out the URL outright is what stops two workers crawling the same host at once. The lease is the mutual exclusion, so no global lock is needed.',
        numbers: ['lease held for the fetch duration'],
        breaks: 'If a worker dies holding a lease, that host stalls until the lease expires, so the timeout directly bounds recovery time.',
      },
    },
    { id: "e8", from: "fetcher", to: "web", label: "HTTP GET", fromSide: "right", toSide: "left",
      detail: {
        what: "The actual HTTP request to somebody else's server.",
        why: 'Everything upstream exists to make this one call safe to make: known-new, allowed, and correctly paced.',
        breaks: 'Timeouts, redirects and hostile responses all land here, and retry state has to belong to the host rather than the URL or a dead host pulls the whole fleet back at once.',
      },
    },
    {
      id: "e9",
      from: "web",
      to: "robots",
      label: "robots.txt, cached with TTL",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: 'Fetching robots.txt on first contact with a host and caching it with a TTL.',
        why: 'It is one request per host rather than per URL. This is drawn as a control path because it does not carry crawl output; it exists purely to constrain the crawler.',
        numbers: ['one fetch per host per TTL'],
        breaks: 'A stale cache keeps you crawling paths a site has since disallowed, which is the specific failure that gets a crawler blocked.',
      },
    },
    { id: "e10", from: "fetcher", to: "parser", label: "HTML", animated: true,
      detail: {
        what: 'Fetched HTML handed to the parser.',
        why: 'The split keeps fetching (I/O bound, high concurrency) separate from parsing (CPU bound), so the two can be scaled and failed independently.',
        breaks: 'Malformed or enormous pages are a parser problem, not a fetch problem, and need their own size and time bounds or one page can stall a worker.',
      },
    },
    {
      id: "e11",
      from: "parser",
      to: "kafka",
      label: "~300 links/page",
      animated: true,
      offset: 90,
      fromSide: "right",
      toSide: "right",
      detail: {
        what: 'Extracted links published back onto the discovery bus. This is the arrow that makes it a crawl.',
        why: 'Without this edge the system is a downloader with a fixed input list. Every link goes back to the bus rather than into the local frontier because most of them belong to other shards.',
        numbers: ['~300 links per page'],
        breaks: 'URL normalisation happens before publishing; miss it and the same page arrives under endlessly many spellings that the seen index cannot recognise as duplicates.',
      },
    },
    { id: "e12", from: "parser", to: "filter",
      detail: {
        what: 'Parsed content passed to near-duplicate detection.',
        why: 'URL dedup already happened upstream and is not sufficient: mirrors and syndicated copies are distinct URLs with identical bodies, and only a content fingerprint catches them.',
        breaks: 'Fingerprinting cost is paid on every page, including the large majority that turn out to be unique.',
      },
    },
    { id: "e13", from: "filter", to: "object-store", fromSide: "right", toSide: "left",
      detail: {
        what: 'Writing the page itself to durable storage.',
        why: 'This write is the one that must complete before the URL is acknowledged as crawled, because the acknowledgement is what makes the work unrepeatable.',
        numbers: ['ack strictly after the write'],
        breaks: 'Ack-before-write loses pages invisibly: the seen index insists the work is done, so nothing ever retries.',
      },
    },
    { id: "e14", from: "filter", to: "metadata", fromSide: "right", toSide: "left",
      detail: {
        what: 'Recording status, content hash and timestamps for the URL.',
        why: 'Recrawl scheduling and change detection both need history, and comparing a stored hash tells you a page changed without re-parsing it.',
        breaks: 'Without per-host retry counts alongside this, backoff is decided per URL and a dead host is hammered by every worker independently.',
      },
    },
  ],
};

export const DIAGRAMS: Record<string, Diagram> = {
  "web-crawler": WEB_CRAWLER,
};

export function getDiagram(id: string): Diagram | undefined {
  return DIAGRAMS[id];
}

/** The diagram belonging to a reader item, if one exists. */
export function getDiagramForItem(sourceId: string, itemId: number): Diagram | undefined {
  return Object.values(DIAGRAMS).find(
    (d) => d.sourceId === sourceId && d.itemId === itemId,
  );
}

/**
 * Flatten a diagram to Markdown so the reader's copy-all action carries the
 * explanations, not just the link. Everything a component says on screen ends
 * up here, in reading order.
 */
export function diagramToMarkdown(d: Diagram): string {
  const out: string[] = [`## Interactive diagram: ${d.title}`, ""];
  const o = d.overview;
  out.push("### Overview", "", `**The shape of it.** ${o.shape}`, "");
  out.push("**How it works.**", "");
  o.beats.forEach((b, i) => out.push(`${i + 1}. ${b}`));
  out.push("");
  if (o.numbers?.length) out.push(`**Numbers.** ${o.numbers.join(" · ")}`, "");
  out.push(`**The hard part.** ${o.crux}`, "");

  const byId = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? id;

  out.push("### Components", "");
  for (const n of d.nodes) {
    if (!n.detail) continue;
    out.push(`#### ${n.label}${n.sub ? ` (${n.sub})` : ""}`, "");
    out.push(`- **What it is.** ${n.detail.what}`);
    out.push(`- **Why it exists.** ${n.detail.why}`);
    if (n.detail.numbers?.length)
      out.push(`- **Numbers.** ${n.detail.numbers.join(" · ")}`);
    if (n.detail.breaks) out.push(`- **What breaks.** ${n.detail.breaks}`);
    const c = n.detail.choice;
    if (c) {
      out.push(`- **Why this technology.**`);
      out.push(`  - Choice: ${c.pick}`);
      out.push(`  - Instead of: ${c.instead}`);
      out.push(`  - Decider: ${c.decider}`);
      out.push(`  - Alternative wins when: ${c.flips}`);
    }
    out.push("");
  }

  out.push("### Connections", "");
  for (const e of d.edges) {
    if (!e.detail) continue;
    const hop = `${byId(e.from)} -> ${byId(e.to)}`;
    out.push(`#### ${hop}${e.label ? ` (${e.label})` : ""}`, "");
    out.push(`- **What it is.** ${e.detail.what}`);
    out.push(`- **Why it exists.** ${e.detail.why}`);
    if (e.detail.numbers?.length)
      out.push(`- **Numbers.** ${e.detail.numbers.join(" · ")}`);
    if (e.detail.breaks) out.push(`- **What breaks.** ${e.detail.breaks}`);
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}
