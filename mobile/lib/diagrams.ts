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

export interface DiagramNodeDetail {
  /** One line: what this component is. */
  what: string;
  /** Why it exists at all; the design pressure it answers. */
  why: string;
  /** Concrete figures worth quoting in an interview. */
  numbers?: string[];
  /** The failure this component owns. */
  breaks?: string;
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
  /** Anchor overrides when the default top/bottom routing reads badly. */
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
}

export interface Diagram {
  id: string;
  title: string;
  subtitle: string;
  /** Deep link back to the question this diagram belongs to. */
  sourceId: string;
  itemId: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const WEB_CRAWLER: Diagram = {
  id: "web-crawler",
  title: "Web Crawler",
  subtitle: "Frontier, fetch, parse, store. The loop that keeps discovering.",
  sourceId: "patterns",
  itemId: 6,
  nodes: [
    {
      id: "frontier-group",
      label: "Frontier shard",
      kind: "group",
      x: 16,
      y: 112,
      w: 344,
      h: 336,
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
      },
    },
  ],
  edges: [
    { id: "e1", from: "kafka", to: "admission", label: "to owning shard", animated: true },
    { id: "e2", from: "admission", to: "front-queues" },
    { id: "e3", from: "front-queues", to: "back-queues" },
    { id: "e4", from: "admission", to: "seen", label: "seen?", fromSide: "right", toSide: "left" },
    { id: "e5", from: "admission", to: "robots", dashed: true, fromSide: "right", toSide: "left" },
    { id: "e6", from: "back-queues", to: "robots", dashed: true, fromSide: "right", toSide: "left" },
    { id: "e7", from: "back-queues", to: "fetcher", label: "ready host, leased", animated: true },
    { id: "e8", from: "fetcher", to: "web", label: "HTTP GET", fromSide: "right", toSide: "left" },
    {
      id: "e9",
      from: "web",
      to: "robots",
      label: "robots.txt, cached with TTL",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
    },
    { id: "e10", from: "fetcher", to: "parser", label: "HTML", animated: true },
    {
      id: "e11",
      from: "parser",
      to: "kafka",
      label: "~300 links/page",
      animated: true,
      offset: 90,
      fromSide: "right",
      toSide: "right",
    },
    { id: "e12", from: "parser", to: "filter" },
    { id: "e13", from: "filter", to: "object-store", fromSide: "right", toSide: "left" },
    { id: "e14", from: "filter", to: "metadata", fromSide: "right", toSide: "left" },
  ],
};

export const DIAGRAMS: Record<string, Diagram> = {
  "web-crawler": WEB_CRAWLER,
};

export function getDiagram(id: string): Diagram | undefined {
  return DIAGRAMS[id];
}
