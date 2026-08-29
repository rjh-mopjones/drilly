import type { Diagram } from "./types";

export const CDN: Diagram = {
  id: "cdn",
  title: "CDN",
  question: "Design a Content Delivery Network (CDN)",
  sourceId: "patterns",
  itemId: 51,
  overview: {
    shape:
      "Three tiers of cache falling down the page under a request router, and a control plane whose only real job is telling 13,000 machines that something they hold is wrong.",
    forces: [
      {
        constraint: "a degraded PoP has to drain inside a 5 minute incident SLO, but some resolvers hold a DNS TTL for hours",
        decision: "One prefix is announced by BGP from all 200 PoPs, so draining a PoP is a route withdrawal, not a DNS record to wait out",
        lights: ["router", "e1", "e2"],
      },
      {
        constraint: "one hot object's TTL firing at 200 PoPs within the same second is 1,000,000 concurrent origin fetches",
        decision: "A single-flight lock, mid-tier coalescing and a per-customer origin shield collapse that to 1, while stale-while-revalidate means nobody waits",
        lights: ["coalesce", "midtier", "shield", "e7", "e8", "e9"],
      },
      {
        constraint: "at 345 PB/day delivered, one point of byte hit ratio is about $420k/month of origin egress",
        decision: "The cache key allowlists query parameters and normalises headers rather than keying on the full URL",
        lights: ["cachekey", "e4", "e5"],
      },
      {
        constraint: "you cannot collect an acknowledgement from 13,000 machines, some of which are unreachable right now",
        decision: "Purges are written once to a durable, replayable log and applied idempotently, so a missed ack is harmless",
        lights: ["purgelog", "relay", "e11", "e12"],
      },
      {
        constraint: "one purge tag can match ten million objects spread across ~150PB of disk",
        decision: "The tag generation table turns 'purge everything tagged X' into one 40B counter bump, compared lazily at read time",
        lights: ["taggen", "e14", "e15"],
      },
    ],
    naive: {
      text: "Treat the CDN like a single cache in front of one origin: let each server refetch independently whenever its own TTL timer fires. At 25k req/s per PoP, a shared TTL means all 200 PoPs expire the same hot object within a second or two of each other. That is 1,000,000 concurrent fetches landing on an origin sized for roughly 2% of delivered bytes, taking it down at the exact moment the object is popular. The design instead runs three cache tiers plus a single-flight lock, collapsing that storm down to one fetch.",
      lights: ["coalesce", "origin"],
    },
    beats: [
      {
        text: "Routing happens before any of your code runs. One prefix is announced by BGP, the routing protocol between networks, from all 200 PoPs. The internet's own routing delivers the packet to a PoP roughly 8ms away. Draining a PoP is a route withdrawal rather than a cached lookup you wait out. A geo-aware layer sits on top as a coarse per-customer steering knob between a handful of independently announced rings.",
        lights: ["client", "router", "e1", "e2"],
      },
      {
        text: "The hit path is dull and that is the point. The edge server builds a cache key from host, path, allowlisted query parameters and normalised headers, then consistent-hashes it to the owning server inside the PoP. It answers from page cache or NVMe in about 12ms. Roughly 95% of requests stop here and the origin never learns they happened.",
        lights: ["edge", "cachestore", "cachekey", "e3", "e4", "e5"],
      },
      {
        text: "The miss path is where the tiers earn their keep. A single-flight lock, key ownership inside the PoP, mid-tier coalescing and a per-customer origin shield apply in series and collapse 1,000,000 concurrent fetches for one hot URL down to 1. Stale-while-revalidate means nobody waited for any of it. The mid-tier adds latency to a miss and is still correct: its job is collapsing concurrent requests, not speed.",
        lights: ["coalesce", "midtier", "shield", "origin", "e6", "e7", "e8", "e9"],
      },
      {
        text: "The cache key is a finance decision rather than a tuning decision. At 345 PB/day delivered, one point of byte hit ratio is about 3.5 PB/day of extra edge misses and roughly $420k a month of origin egress. A tracking parameter or a Vary on User-Agent that multiplies one object into thousands of entries shows up on the bill before it shows up anywhere else.",
        lights: ["cachekey", "e4", "e5"],
      },
      {
        text: "Invalidation is the actual system. Where you own the URL you remove the problem instead of solving it: hash the bytes into the filename, serve it immutable, and change the reference. What is left over gets an eager push over a durable replayable log, idempotent because you cannot collect 13,000 acknowledgements. Tag generation counters mean 'purge everything tagged product-1234' is one 40B counter bump rather than an enumeration of ten million objects.",
        lights: ["control-zone", "purgelog", "relay", "taggen", "e11", "e12", "e13", "e14"],
      },
      {
        text: "State the guarantee honestly. Freshness is a promise about when, not whether. It is the fresh window, plus the stale window, plus about two seconds of purge propagation, plus an unbounded tail for whichever PoP happens to be partitioned right now. That PoP will replay the log when it returns.",
        lights: ["purgelog", "relay", "edge", "e11", "e12"],
      },
    ],
    crux: {
      problem:
        "One object now exists on thousands of unsupervised machines in hundreds of datacentres, holding somebody else's mutable data.",
      handled:
        "When it changes, every copy has to be corrected without consensus on the request path and without ever collecting an acknowledgement. The durable purge log makes a missing ack harmless: a partitioned PoP simply replays from its last offset once it reconnects, rather than needing to be told again.",
    },
    numbers: [
      {
        value: "1,000,000 concurrent origin fetches for one URL at expiry, collapsed to 1",
        explain: "25k req/s per PoP x 0.2s x 200 PoPs is roughly the herd a synchronised TTL would send at origin; single-flight and the tiers reduce it to exactly one fetch.",
      },
      {
        value: "~$420k/month per point of byte hit ratio at 345 PB/day delivered",
        explain: "1% of 345 PB/day is ~3.5 PB/day of extra edge misses, billed at roughly $0.02/GB of origin egress, which is why cache-key hygiene is tracked as a finance metric.",
      },
      {
        value: "purge reaches 99.9% of ~13,000 edge servers in ~2s",
        explain: "The measured propagation time for the hierarchical fan-out tree, well inside the published 5-second SLO.",
      },
    ],
  },
  nodes: [
    {
      id: "control-zone",
      label: "Purge control plane",
      kind: "zone",
      detail: {
        what: "The boundary around everything that tells a cache it is wrong: the durable purge log a customer's API writes to, and the tree that relays each record to every PoP.",
        why: "It never touches a byte of the response: nothing inside it sits between a request and its answer. That isolation is what lets a control-plane outage degrade purge freshness without touching the 12ms hit path.",
        numbers: [
          { value: "~1,000 purges/s accepted", explain: "The write rate this plane is provisioned to accept from every customer's purge API combined." },
          { value: "p99 ~2s to 99.9% of ~13,000 servers", explain: "The measured freshness this plane delivers, well inside its own 5-second SLO." },
        ],
        breaks: {
          failure: "A stall here is invisible from the request path: every PoP keeps answering quickly with content it has already been told to forget.",
          handled: "Propagation is therefore checked with a synthetic canary re-fetched from every PoP, rather than trusted from a healthy-looking control-plane dashboard.",
        },
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "TLS 1.3, resumed",
      kind: "external",
      col: 1,
      row: 0,
      detail: {
        what: "A browser or player asking for one object, over a connection it would rather resume than establish.",
        why: "It is drawn because it sets two constraints the rest of the design answers to. The user is paying for every millisecond of the miss path. The client's own resolver and connection lifetime also decide how much control you actually have over which PoP it reaches.",
        numbers: [
          { value: "~8ms to the nearest PoP", explain: "The typical network latency from client to the anycast-selected PoP, before any TLS or cache work happens." },
          { value: "~12ms TTFB on an in-region hit", explain: "The time-to-first-byte on the common case, dominated by network round trip rather than server processing." },
        ],
        breaks: {
          failure: "Client and resolver caching of DNS records is not yours to control.",
          handled: "That is exactly why the data plane does not depend on it: BGP, not DNS, decides which PoP a packet actually reaches.",
        },
      },
    },
    {
      id: "router",
      label: "Anycast BGP + GeoDNS",
      sub: "one prefix from 200 PoPs",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "The request router: a small number of /24s announced from every PoP, with GeoDNS choosing between a few independently announced anycast rings.",
        why: "Somebody has to decide which of 200 PoPs a user reaches, and the decision has to be revocable in seconds during an incident. Letting BGP deliver the packet means there is no client-side state to wait out when you take a PoP away.",
        numbers: [
          { value: "~200 PoPs", explain: "13,000 edge servers / 200 PoPs is ~65 per PoP, the granularity BGP withdrawal drains at, one PoP's worth at a time." },
          { value: "BGP reconverges in under 30s", explain: "How quickly the internet's own routing moves traffic once an announcement is withdrawn." },
          { value: "5 minute incident SLO", explain: "The response time a degraded PoP has to be drained within, which BGP withdrawal comfortably meets." },
        ],
        breaks: {
          failure: "Anycast gives you no per-request steering, so a degraded PoP cannot be selectively drained.",
          handled: "You de-preference its announcement rather than withdrawing it, which is coarser and slower than per-request DNS steering would be, but still fast enough for the SLO.",
        },
        choice: {
          pick: "Anycast /24s announced from all 200 PoPs, with GeoDNS on top selecting between a handful of rings",
          instead: "Give every PoP its own address and steer entirely in DNS, answering each resolver with a chosen PoP.",
          decider:
            "How fast you must move traffic off a PoP, against how much DNS TTLs are actually obeyed. A BGP withdrawal reconverges the internet in seconds; a 30s DNS TTL is held for minutes to hours by a meaningful share of resolvers.",
          flips:
            "Long-lived flows. Multi-GB downloads, WebSockets or live streams held open for minutes turn a mid-flow reconvergence RST into a real failure. DNS steering is also the only option without a portable prefix, or where routing must satisfy per-customer residency rules.",
        },
      },
    },
    {
      id: "edge",
      label: "Edge PoP (x200)",
      sub: "TLS + cache key, ~50 servers",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "A rack of commodity servers in a carrier-neutral facility that terminates TLS, builds the cache key, and serves ~95% of requests without a single upstream byte.",
        why: "This tier exists purely for latency: it is the only one a user's clock ever sees. An L4 balancer hashes the connection to one of ~50 servers, and the cache key is consistent-hashed to a single owning server. That way one object has one home inside the PoP.",
        numbers: [
          { value: "~2.5M req/s at a tier-1 PoP", explain: "The peak load one of the busiest PoPs is provisioned to handle." },
          { value: "50k req/s and 40 Gbps per server", explain: "The per-server ceiling this fleet is sized against, the figure a viral object can saturate on its owning box." },
          { value: "~13,000 edge servers globally", explain: "The total fleet size the purge control plane has to reach on every invalidation." },
        ],
        breaks: {
          failure: "A viral object concentrates on its owning box, and 50k req/s of a 100KB object is a full 40 Gbps NIC.",
          handled: "Hot keys are detected and replicated to every server in the PoP, spreading the load instead of leaving one box to saturate.",
        },
        choice: {
          pick: "Terminate TLS at the edge, resolving the SNI hostname against the control-plane KV lazily and caching the chain in a per-server LRU",
          instead: "Ship every customer certificate to every edge server.",
          decider:
            "Copy count. 40,000 hostnames across 13,000 servers is 520M certificate copies to keep rotated, and a single renewal becomes a fleet-wide push. A lazy lookup adds a sub-millisecond read to a cold handshake and nothing to a resumed one.",
          flips: "A customer who will not surrender a private key, where keyless TLS keeps the key in their datacentre and the edge makes an RPC for the one signing operation.",
        },
      },
    },
    {
      id: "coalesce",
      label: "Single-flight + SWR",
      sub: "stale served, refresh behind",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "The miss handler: claim a per-key lock, return the stale copy immediately under stale-while-revalidate, and revalidate upstream in the background.",
        why: "A TTL is not a per-object timer. It is a timer that fires at 200 PoPs within a second or two of each other, because all 200 fetched from the same origin response. Without coalescing, expiry of one hot object is a synchronised global event aimed at an origin provisioned for 2% of delivered bytes.",
        numbers: [
          { value: "25k req/s per PoP x 0.2s x 200 PoPs = 1,000,000", explain: "That herd would hit an origin sized for only 2% of delivered bytes; single-flight collapses it to exactly one fetch." },
          { value: "revalidation ~270ms of machine time, 0ms of user time", explain: "The revalidation cost is real but paid entirely in the background, never on the request the user is waiting for." },
        ],
        breaks: {
          failure: "Stale-while-revalidate makes staleness guaranteed rather than possible.",
          handled: "Every expiry of every object serves at least one stale response per PoP by construction, which is the accepted trade for never blocking a user on an origin round trip.",
        },
        choice: {
          pick: "Serve stale under stale-while-revalidate behind a per-key single-flight lock, with TTL jittered +/-10% at storage time",
          instead: "Block the request on revalidation, or refresh eagerly the moment the timer fires.",
          decider:
            "What the user pays for correctness you do not gain. Blocking turns a 12ms response into a 270ms one for bytes served to somebody else a millisecond earlier. It also puts 1,000,000 concurrent fetches at the origin the instant a TTL expires.",
          flips: "Correctness-critical routes such as an inventory count or a price, which opt out per route and pay the full 270ms miss.",
        },
      },
    },
    {
      id: "midtier",
      label: "Regional mid-tier (x20)",
      sub: "10 PoPs fetch through each",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "A bigger, disk-heavy cache that roughly 10 edge PoPs fetch through, one per region.",
        why: "It exists for exactly one reason: fan-out collapse. The same object missed at 200 edges is 200 origin requests without it and 20 with it. It is a hop that adds ~35ms to a miss and earns its place by making the origin's load profile stable rather than spiky.",
        numbers: [
          { value: "~20 regions, ~250TB each, ~5PB globally", explain: "The size of this tier, one instance per region shared by roughly 10 edge PoPs each." },
          { value: "union working set ~1.5B objects per region", explain: "How much of a region's traffic this tier is sized to hold resident at once." },
          { value: "edge to mid-tier ~35ms", explain: "The price of collapsing up to 200 potential origin fetches into 20 stable ones per miss, a 10x reduction for one hop's latency." },
        ],
        breaks: {
          failure: "Lose a regional mid-tier and its 10 PoPs lose their shield at once, so origin fill for that region spikes about 5x.",
          handled: "Edges fail over to the next-nearest mid-tier, which recovers the collapse ratio at the cost of a further hop until the region's own tier returns.",
        },
        choice: {
          pick: "Three tiers: edge, regional mid-tier, per-customer origin shield",
          instead: "Flat routing, where every edge PoP fetches the customer origin directly.",
          decider:
            "Miss fan-out against what a customer origin can actually absorb. Flat routing sends ~35 PB/day at the origin; the tiers cut origin egress ~80% to ~7 PB/day, roughly $17M/month avoided at $0.02/GB.",
          flips: "A private CDN with 5 to 10 PoPs, where fan-out is 10 rather than 200 and the mid-tier buys almost nothing. Also mostly-uncacheable API traffic, where the extra hop adds latency and collapses nothing.",
        },
      },
    },
    {
      id: "shield",
      label: "Origin shield",
      sub: "1 PoP per origin, fill bucket",
      kind: "service",
      col: 2,
      row: 4,
      detail: {
        what: "One PoP per customer origin, chosen for network proximity to it, that all 20 mid-tiers fetch through and that rate-limits refill.",
        why: "It takes 20 concurrent fetches to 1 and gives the origin a small, stable set of source IPs to allowlist. It is also the only place where a per-origin concurrency cap can be enforced, which is what stops a bulk purge or a cold start from becoming an outage.",
        numbers: [
          { value: "collapses 20 fetches to 1", explain: "The reduction this hop applies on top of everything already collapsed upstream." },
          { value: "shield to origin ~40ms", explain: "The added latency of the final hop before an actual origin request." },
          { value: "origin sees ~7 PB/day, ~2% of delivered bytes", explain: "How small the origin's real traffic is kept relative to what the fleet actually delivers." },
        ],
        breaks: {
          failure: "It is a single point of concentration per customer.",
          handled: "If the shield PoP is degraded, every mid-tier's fill for that origin degrades with it, which is why shield health is monitored per customer rather than fleet-wide.",
        },
        choice: {
          pick: "Soft purge by default, with a per-origin fill token bucket at the shield capping concurrent origin fetches",
          instead: "Hard purge that deletes, with the tiers refilling as fast as they can.",
          decider:
            "What a purge-all does to an origin sized for ~2% of delivered bytes. Hard purge takes hit ratio to zero and points the full request rate at it; marking objects stale instead lets stale-while-revalidate cover the refill.",
          flips: "A legal takedown or a leaked secret, where continuing to serve the old bytes is itself the failure. Hard purge stays available, rate-limited and behind an explicit flag.",
        },
      },
    },
    {
      id: "origin",
      label: "Customer origin",
      sub: "object store, not yours",
      kind: "external",
      col: 3,
      row: 4,
      detail: {
        what: "The customer's own object store or application, the source of truth for every byte in the fleet and the only writer of the data you are caching.",
        why: "It sits outside our trust boundary, which is the whole difficulty. You do not control the writer. You learn about a change either by asking through conditional revalidation, or by being told through a customer-facing purge API, never by observing the write.",
        numbers: [
          { value: "~7 PB/day of origin egress at a 90% byte hit ratio", explain: "The traffic level the customer's origin actually sees, sized for a small fraction of total delivery." },
          { value: "provisioned for ~2% of delivered bytes", explain: "The design assumption that lets a customer run a modest origin instead of one sized for the whole fleet's traffic." },
          { value: "304 responses ~200B against 100KB fills", explain: "Why revalidation traffic is cheap: most conditional requests confirm freshness rather than transferring the object again." },
        ],
        breaks: {
          failure: "If it returns 5xx or times out, stale-if-error has to serve expired copies for a configured window.",
          handled: "The shield also breaks the circuit on sustained failure, or the error itself becomes a herd hammering an already-struggling origin.",
        },
      },
    },
    {
      id: "cachekey",
      label: "Cache key + TTL policy",
      sub: "allowlist, jitter, SWR window",
      kind: "service",
      col: 0,
      row: 2,
      detail: {
        what: "The per-origin rules that decide what an object's identity is: host, normalised path, allowlisted query parameters, keyed headers, plus the TTL and stale-while-revalidate windows.",
        why: "The key is the product. Anything you fail to strip multiplies one object into thousands of entries and the hit ratio falls. Anything you wrongly strip makes two different responses share an identity, a security incident rather than a caching bug. Where the customer owns the URL, the real policy is to make invalidation unnecessary. Their build hashes bytes into the filename and serves it immutable, so a changed object is a different object at an address no cache has heard of yet.",
        numbers: [
          { value: "one point of byte hit ratio ~ $420k/month", explain: "The financial weight one percentage point of hit ratio carries at this delivery volume." },
          { value: "TTL jittered +/-10% at storage time", explain: "How much each object's expiry is spread out, so 200 PoPs do not expire the same object in the same second." },
          { value: "SLO >=95% by request, >=90% by byte", explain: "The two published hit-ratio targets the whole cache-key policy is tuned to meet." },
          { value: "hashed assets: max-age=31536000 immutable, 0 purge messages, ~100% hit ratio", explain: "Content-hashed assets need no invalidation at all, because a change is a new address rather than a mutation." },
        ],
        breaks: {
          failure: "Cache poisoning: an origin returns one user's page with Set-Cookie and no Cache-Control: private, and the edge stores it under a key with no identity in it.",
          handled: "Never-store on Set-Cookie, private and Authorization is enforced inside the engine where no config change can switch it off. Hashed naming also only covers URLs the customer owns; fixed-name paths still fall back to purge.",
        },
        choice: {
          pick: "Allowlist query parameters, canonicalise their order, normalise User-Agent to a device class",
          instead: "Key on the full URL and honour whatever Vary the origin happens to send.",
          decider:
            "Cardinality against money. Tracking parameters or a Vary on User-Agent multiply one object into thousands of entries, and at 345 PB/day delivered one point of byte hit ratio is ~$420k/month of origin egress.",
          flips: "A customer whose parameter genuinely varies the response, which is why the allowlist ships in shadow mode with a response diff before it is enforced.",
        },
      },
    },
    {
      id: "cachestore",
      label: "Edge object cache",
      sub: "S3-FIFO on NVMe, W-TinyLFU",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "Two tiers per server: a 256GB page cache in RAM over 15TB of NVMe, with W-TinyLFU deciding what is admitted and S3-FIFO deciding what survives.",
        why: "Under Zipf with alpha ~0.9 there is no small hot set. Reaching a 95% request hit ratio means holding roughly 320M objects, about 32TB, most of what a PoP sees in a day. So the cache is sized for residency, and the interesting question becomes what you refuse to admit.",
        numbers: [
          { value: "~750TB per tier-1 PoP, ~150PB globally", explain: "The total capacity this tier represents across the fleet." },
          { value: "~70% of hits served from RAM", explain: "256GB is under 2% of the 15TB tier, yet it absorbs 70% of hits, confirmation the working set really is Zipf-hot." },
          { value: "~400GB of index per PoP at ~200B per object", explain: "The metadata overhead of tracking every resident object, which is what actually caps how many objects a server can hold." },
        ],
        breaks: {
          failure: "Index metadata, not disk, is what caps residency.",
          handled: "~2B resident objects at ~200B each is ~8GB of RAM per server sitting next to the page cache, so index size is watched as its own capacity limit.",
        },
        choice: {
          pick: "S3-FIFO on disk with W-TinyLFU admission in front of the page cache",
          instead: "Plain LRU across RAM and disk.",
          decider:
            "Scan resistance and flash endurance. A crawler pulling 50M cold URLs marches straight through LRU and evicts the hot set for a workload that got zero hits from it. Admitting every miss also writes ~12.5 GB/s per tier-1 PoP to flash that is mostly never read again.",
          flips: "A small fixed catalogue that fits in RAM with no scans and no one-hit wonders. There LRU is simpler, and the admission filter only costs a genuinely new object one request of delay.",
        },
      },
    },
    {
      id: "purgelog",
      label: "Durable purge log",
      sub: "Kafka, per-PoP offsets",
      kind: "queue",
      col: 3,
      row: 1,
      parent: "control-zone",
      detail: {
        what: "An append-only log partitioned by origin_id that every purge is written to before it is acknowledged to the customer, with each PoP tracking its own offset.",
        why: "You cannot collect acknowledgements from 13,000 machines, some of which are unreachable right now, so you stop trying. The log makes the absence of an ack survivable: forgetting an object twice is the same as forgetting it once. A partitioned PoP replays from its offset rather than needing to be told again.",
        numbers: [
          { value: "7-day retention", explain: "How long a PoP can stay disconnected and still catch up by replaying, rather than needing a full resync." },
          { value: "~1,000 customer purges/s", explain: "The write rate this log is provisioned to absorb from every customer combined." },
          { value: "purge SLO p99 <5s to 99.9% of servers", explain: "The published freshness target the whole fan-out design is held to." },
        ],
        breaks: {
          failure: "It buys durability, not completeness.",
          handled: "A partitioned PoP keeps serving the old bytes until it reconnects, and that tail is unbounded, which is why the design states the guarantee as 'when', not 'whether'.",
        },
        choice: {
          pick: "A durable append-only log partitioned by origin_id, with per-PoP consumer offsets",
          instead: "RPC the invalidation out to every server and collect acknowledgements.",
          decider:
            "13,000 acknowledgements you cannot collect. Reporting servers_acked: 12987 describes the servers that answered, not the fleet, so the design has to make a missing ack harmless rather than treat it as a completion signal.",
          flips: "A single-datacentre cache tier where the writer sits next to the cache and invalidation is a delete issued at the moment of the write, roughly synchronous and cheap.",
        },
      },
    },
    {
      id: "relay",
      label: "Fan-out tree",
      sub: "200 relays, in-PoP multicast",
      kind: "service",
      col: 3,
      row: 2,
      parent: "control-zone",
      detail: {
        what: "The push path: the control plane writes once, 200 PoP relays consume, and each relay multicasts inside its own PoP to reach every edge server.",
        why: "A five second SLO across 13,000 servers is only affordable if the fan-out is hierarchical. The tree turns a global broadcast into one message per PoP plus local delivery. That is the difference between a control plane that survives a purge burst and one that becomes the outage.",
        numbers: [
          { value: "~13,000 servers reached", explain: "The full fleet this tree's local multicast step ultimately delivers to." },
          { value: "200k control-plane messages/s at ~200B", explain: "The message rate the control plane itself has to sustain, one per PoP rather than one per server." },
          { value: "~40 MB/s leaving the control plane", explain: "The bandwidth this tier design keeps small enough for a modest fleet of relays to absorb." },
          { value: "p99 ~2s", explain: "The measured end-to-end propagation time this hierarchy achieves in practice." },
        ],
        breaks: {
          failure: "If the fan-out stalls, stale content stays live past the SLO and nothing upstream notices.",
          handled: "Propagation is measured with a synthetic canary re-fetched from every PoP, rather than as a control-plane send count that would look healthy regardless.",
        },
        choice: {
          pick: "Hierarchical push: control plane, then 200 PoP relays, then in-PoP multicast",
          instead: "Flat fan-out from the control plane straight to all 13,000 edge servers.",
          decider:
            "Message rate at the source. At 1,000 purges/s, flat delivery is 13M messages/s from one place. The tree makes it 200 x 1,000 = 200k messages/s at ~200B each, with the rest absorbed inside each PoP.",
          flips: "Small fleets. Below a few hundred servers the relay tier is another thing to operate and lose for no benefit, and a flat push is easier to reason about when it stalls.",
        },
      },
    },
    {
      id: "taggen",
      label: "Tag generation table",
      sub: "global KV, O(1) counter bump",
      kind: "database",
      col: 3,
      row: 0,
      detail: {
        what: "A globally replicated read-mostly KV of tag to generation counter, pushed to every PoP, with every cached object recording the generations of its tags at fetch time.",
        why: "Bulk invalidation cannot be an enumeration. Purging a tag becomes one counter bump, and the comparison is deferred to read time. A server that finds a stored generation behind the current one simply treats the entry as a miss.",
        numbers: [
          { value: "~40B pushed globally per tag purge", explain: "The entire fleet-wide cost of a bulk invalidation, regardless of how many objects the tag actually matches." },
          { value: "one tag may match ten million objects across ~150PB", explain: "The scale of work this mechanism avoids doing eagerly by deferring it to read time." },
        ],
        breaks: {
          failure: "A tag-purged object still occupies disk until it is requested or evicted.",
          handled: "This mechanism means 'will never be served again', not 'deleted', which is exactly the distinction that matters when a customer's takedown actually needs bytes physically removed.",
        },
        choice: {
          pick: "Generation counters compared lazily at read time",
          instead: "Enumerate the index at every PoP and delete the matching entries.",
          decider:
            "Work per purge. 'Everything tagged product-1234' may match ten million objects spread across ~150PB of disk, and scanning the index for them is minutes of work repeated at 200 PoPs. The counter bump is ~40B and O(1).",
          flips: "When the operation has to mean physical deletion, for a legal takedown or a leaked secret. Deferring the work to read time would leave the bytes exactly where the customer paid you to remove them.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "router",
      tier: "hot",
      step: 1,
      label: "SYN to the anycast IP",
      detail: {
        what: "The user's resolver returns one anycast address and the connection is opened to it, with no per-PoP address anywhere in the answer.",
        why: "Routing decisions that live in DNS are held by resolvers and client runtimes for far longer than the TTL says, so the data plane deliberately does not depend on them. GeoDNS only chooses which ring the user gets, not which PoP.",
        numbers: [{ value: "one prefix announced from 200 PoPs", explain: "The entire routing surface a client's connection can land on, decided by BGP rather than by this request." }],
        breaks: {
          failure: "A resolver that appears far from the user steers a whole population to the wrong ring.",
          handled: "A global p99 latency metric hides this, because it looks like one country's problem rather than a systemic issue, so per-region latency is tracked separately.",
        },
      },
    },
    {
      id: "e2",
      from: "router",
      to: "edge",
      tier: "hot",
      step: 2,
      label: "nearest PoP, ~8ms",
      detail: {
        what: "BGP delivers the packet to whichever PoP is topologically nearest the client, and an L4 balancer inside it hashes the connection to one of ~50 servers.",
        why: "The internet's own routing is doing the work, which is why removing a PoP is a route withdrawal that reconverges in seconds rather than a record you wait out. It is also why a distributed attack spreads itself across all 200 PoPs for free.",
        numbers: [
          { value: "~8ms to the PoP", explain: "The typical network latency this hop adds, dominated by physical distance rather than processing." },
          { value: "~2.5M req/s at a tier-1 PoP", explain: "The peak volume the busiest PoPs receive over this hop." },
        ],
        breaks: {
          failure: "A reconvergence mid-flow lands packets on a PoP with no socket state and returns a RST.",
          handled: "That is a cheap retry for a short request, but a truncated transfer for a large download. Long-lived flows are the case that argues against pure anycast steering.",
        },
      },
    },
    {
      id: "e3",
      from: "edge",
      to: "cachestore",
      tier: "hot",
      step: 3,
      label: "key lookup, ~95% hit",
      detail: {
        what: "The cache key is consistent-hashed to its owning server inside the PoP and the object is read from page cache or NVMe.",
        why: "One key having exactly one home inside the PoP is what makes single-flight work later. Without it, 50 servers each hold their own copy and each independently decides to refill it when the TTL fires.",
        numbers: [
          { value: "~12ms TTFB", explain: "The time-to-first-byte on a cache hit, the number the entire hit path is optimised around." },
          { value: "~70% of hits from RAM", explain: "How much of the hit path never touches disk at all." },
          { value: "~15k IOPS per server on fall-through", explain: "The disk load a server absorbs when a lookup falls through the page cache to NVMe." },
        ],
        breaks: {
          failure: "Consistent hashing concentrates a viral object on one box, and 50k req/s of a 100KB object saturates a 40 Gbps NIC.",
          handled: "Hot keys are detected and replicated across the PoP, spreading a viral object's traffic instead of leaving one owning server to absorb it alone.",
        },
      },
    },
    {
      id: "e4",
      from: "cachekey",
      to: "edge",
      tier: "control",
      label: "key rules, TTL, SWR",
      detail: {
        what: "Per-origin configuration mirrored into a global KV that every PoP reads: which query parameters are keyed, which headers are keyed, the default TTL and the stale-while-revalidate window.",
        why: "It is a control path rather than a request-path dependency: the PoP reads it locally, so a control-plane outage degrades config changes and purges rather than the serving of bytes.",
        numbers: [
          { value: "1 partition key: origin_id", explain: "How this configuration is sharded, keeping one customer's policy independent of every other's." },
          { value: "~2-5GB of config and tag generations globally", explain: "Small enough to mirror in full to all 13,000 edge servers instead of fetched per-request, so a control-plane outage never touches byte serving." },
        ],
        breaks: {
          failure: "A config change that removes a keyed header makes personalised responses shared.",
          handled: "That shows up as a sudden hit-ratio jump on a dynamic route, a security incident rather than a caching win, so hit-ratio spikes on non-static routes are alerted on directly.",
        },
      },
    },
    {
      id: "e5",
      from: "cachekey",
      to: "cachestore",
      tier: "control",
      label: "TTL +/-10% at write",
      detail: {
        what: "The TTL is jittered by +/-10% at the moment the object is stored, and the stale window is recorded alongside it.",
        why: "200 PoPs that fetched the same object within the same second would otherwise expire within the same second. Jitter turns a synchronised global edge into a smear, which is what the coalescers downstream actually want.",
        numbers: [
          { value: "+/-10% jitter", explain: "The spread applied to every object's expiry, tuned to smear a synchronised fetch across a wider window." },
          { value: "early-refresh odds rise inside the final 10% of TTL", explain: "The probabilistic mechanism that spreads refetches even further, so no single second sees a spike." },
        ],
        breaks: {
          failure: "Jitter widens the staleness window for some PoPs by up to 10% of the TTL.",
          handled: "Routes that opted out of stale-while-revalidate have to account for that extra spread explicitly, since they do not get the smoothing single-flight otherwise provides.",
        },
      },
    },
    {
      id: "e6",
      from: "edge",
      to: "coalesce",
      tier: "hot",
      step: 4,
      label: "miss or stale, ~5%",
      detail: {
        what: "The ~5% of requests where the entry is absent or past its TTL, handed to the miss handler rather than answered directly.",
        why: "This is the branch where the user's latency is decided. The handler's first move is to answer from the stale copy, so the fact that a miss is about to traverse three hops and ~270ms never reaches the client.",
        numbers: [
          { value: "~5% of requests", explain: "The inverse of the ~95% hit ratio the cache is sized for; at fleet volume it's still what feeds the single-flight collapse downstream." },
          { value: "~35 PB/day of edge misses at a 90% byte hit ratio", explain: "What that 5% of requests amounts to at the fleet's total delivery volume." },
        ],
        breaks: {
          failure: "A cold PoP, a fleet restart or a purge-all takes this branch to 100%.",
          handled: "That is how you take a customer's site down against an origin sized for 2% of delivered bytes, which is why cold-start and purge-all events are rate-limited and staged.",
        },
      },
    },
    {
      id: "e7",
      from: "coalesce",
      to: "midtier",
      tier: "hot",
      step: 5,
      label: "one fetch per key",
      detail: {
        what: "The single background revalidation that survives the per-server single-flight lock and the PoP's key ownership, sent over a pooled HTTP/2 connection.",
        why: "1,000,000 would-be fetches have already become 200 by this point, one per PoP. Pooling matters as much as coalescing: without long-lived connections every miss pays a fresh TCP and TLS handshake.",
        numbers: [
          { value: "1,000,000 to 12,800 to 200", explain: "The successive collapse ratios applied by single-flight, then by key ownership, before this hop is even reached." },
          { value: "edge to mid-tier ~35ms", explain: "Small next to the ~180ms mid-tier-to-shield leg that follows on a full miss, why mid-tier hit rate matters more than this hop's cost." },
        ],
        breaks: {
          failure: "Lose connection pooling and the miss penalty roughly triples.",
          handled: "The next tier's TLS terminator is also handed a handshake rate it cannot absorb, so pooled connections are treated as load-bearing infrastructure, not an optimisation.",
        },
      },
    },
    {
      id: "e8",
      from: "midtier",
      to: "shield",
      tier: "hot",
      step: 6,
      label: "200 to 20 to 1",
      detail: {
        what: "The regional fetch that missed regionally, forwarded to the single shield PoP designated for this customer origin.",
        why: "Two more orders of magnitude of collapse happen on this hop. It is also where the origin's source-IP allowlist becomes small and stable, because everything now converges on one PoP per customer.",
        numbers: [
          { value: "mid-tier to shield ~180ms", explain: "Over five times the ~35ms edge-to-mid-tier hop before it, the single largest leg, why shield hit rate matters most for tail latency." },
          { value: "20 concurrent fetches become 1", explain: "The collapse this hop applies on top of everything already reduced upstream." },
        ],
        breaks: {
          failure: "If a mid-tier is lost, its 10 PoPs fail over to the next-nearest one, which is further away and holds a different working set.",
          handled: "The collapse ratio degrades before it recovers, so a lost mid-tier is treated as a regional-capacity incident, not merely a latency blip.",
        },
      },
    },
    {
      id: "e9",
      from: "shield",
      to: "origin",
      tier: "hot",
      step: 7,
      label: "1 conditional GET",
      detail: {
        what: "One conditional GET with If-None-Match for the entire planet, usually answered with a ~200B 304 rather than a 100KB body.",
        why: "This is the only request the origin sees, and the whole hierarchy exists to make that sentence true. Revalidation traffic is a rounding error against fill traffic, which is what lets a customer plan capacity against a stable ~2% of delivered bytes.",
        numbers: [
          { value: "~40ms shield to origin", explain: "The final leg of the miss path, direct to the customer's own infrastructure." },
          { value: "~270ms total miss path", explain: "The end-to-end cost of a full miss, from edge through mid-tier and shield to origin and back." },
          { value: "origin sees ~7 PB/day", explain: "The traffic this single conditional-GET pattern lets the origin be provisioned for." },
        ],
        breaks: {
          failure: "If the origin 5xxs or times out, stale-if-error covers it and the shield breaks the circuit.",
          handled: "5xx responses must be negative-cached for a few seconds too, or the error itself becomes a herd hammering an already-struggling origin.",
        },
      },
    },
    {
      id: "e11",
      from: "purgelog",
      to: "relay",
      tier: "control",
      label: "consume by offset",
      detail: {
        what: "Each of the 200 PoP relays consumes the purge log at its own offset and applies records in order.",
        why: "The offset is the entire recovery story. A PoP that was partitioned when a purge was pushed resumes exactly where it stopped, instead of needing the control plane to remember who missed what.",
        numbers: [
          { value: "200 relays", explain: "One relay per PoP, each independently tracking its own consumption offset." },
          { value: "alert when any PoP's offset lag exceeds 30s", explain: "The threshold that turns a slow relay from background noise into a paged incident." },
        ],
        breaks: {
          failure: "Offset lag is the metric that matters and it is invisible from the request path.",
          handled: "The PoP looks perfectly healthy while serving content it has already been told to forget, which is why offset lag itself is the alert, not request success rate.",
        },
      },
    },
    {
      id: "e12",
      from: "relay",
      to: "edge",
      tier: "control",
      label: "purge to 13k in ~2s",
      detail: {
        what: "The in-PoP multicast that marks the named objects stale on every server in the PoP, including the replicas of hot keys.",
        why: "It is idempotent by construction, because forgetting an object twice is the same as forgetting it once. That is what allows replay after a partition without any bookkeeping about what was already applied.",
        numbers: [
          { value: "p99 ~2s to 99.9% of servers", explain: "The measured propagation speed of this final delivery hop." },
          { value: "SLO <5s", explain: "The published commitment this hop's performance is held against." },
        ],
        breaks: {
          failure: "Two PoPs can disagree about a purged object for tens of seconds.",
          handled: "That is the published contract, not a bug, because making it never happen would mean a WAN round trip on every 12ms hit.",
        },
      },
    },
    {
      id: "e13",
      from: "relay",
      to: "midtier",
      tier: "control",
      label: "invalidate regional copy",
      detail: {
        what: "The same purge applied at the regional mid-tier and the shield, not only at the edge.",
        why: "Purging only the edge would be worse than useless. The next request misses at the edge, fetches the old bytes from a mid-tier that still holds them, and re-caches the thing you just purged.",
        numbers: [{ value: "~20 mid-tiers plus one shield per origin", explain: "Every additional tier this purge has to reach to actually remove a stale copy from the fleet." }],
        breaks: {
          failure: "Ordering between tiers is not guaranteed.",
          handled: "An edge that refills after its own purge but before the mid-tier's will reintroduce stale content until the next purge or expiry corrects it.",
        },
      },
    },
    {
      id: "e14",
      from: "purgelog",
      to: "taggen",
      tier: "control",
      label: "tag purge, 40B bump",
      offset: 60,
      detail: {
        what: "A purge-by-tag record turning into a single increment of that tag's counter in the globally replicated generation table.",
        why: "Enumeration is not available at this scale, so bulk invalidation is expressed as a version bump and the matching is deferred to whenever each object is next looked up. One record replaces ten million deletions.",
        numbers: [
          { value: "~40B pushed globally", explain: "The entire network cost of a bulk tag purge, independent of how many objects the tag actually matches." },
          { value: "O(1) regardless of how many objects match", explain: "The core property that makes this mechanism affordable at any scale of catalogue." },
        ],
        breaks: {
          failure: "It deliberately leaves the bytes on disk.",
          handled: "The operation means 'never served again' rather than 'deleted'. That is not what a customer issuing a takedown believes they bought, so hard purge exists as a separate, slower path for that case.",
        },
      },
    },
    {
      id: "e15",
      from: "taggen",
      to: "cachestore",
      tier: "data",
      label: "generation compare on read",
      detail: {
        what: "On every lookup the server compares the tag generations stored with the object against the current ones and treats any mismatch as a miss.",
        why: "This is where the deferred work from a tag purge is finally paid, one request at a time, on the objects that are actually being asked for. Objects nobody requests cost nothing and are eventually evicted.",
        numbers: [{ value: "generation compare costs <1µs per lookup", explain: "The per-request overhead this deferred check adds, negligible against a 12ms hit path." }],
        breaks: {
          failure: "The comparison is on the hot path of every single lookup.",
          handled: "The generation table has to stay local to the PoP and read-mostly, since a remote read here would put a WAN hop inside a 12ms hit.",
        },
      },
    },
  ],
};
