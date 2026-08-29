import type { Diagram } from "./types";

export const CDN: Diagram = {
  id: "cdn",
  title: "CDN",
  question: "Design a Content Delivery Network (CDN)",
  sourceId: "patterns",
  itemId: 51,
  overview: {
    shape:
      "Three tiers of cache falling down the page under a request router, and a control plane beside them whose only real job is telling 13,000 machines that something they are already holding is now wrong.",
    beats: [
      {
        text: "Routing happens before any of your code runs. One prefix is announced by BGP from all 200 PoPs, so the internet's own routing delivers the packet to a PoP roughly 8ms away and draining a PoP is a route withdrawal rather than a DNS record you wait out. GeoDNS stays on top as a coarse per-customer steering knob between a handful of independently announced rings.",
        lights: ["client", "router", "e1", "e2"],
      },
      {
        text: "The hit path is dull and that is the point. The edge server builds a cache key from host, path, allowlisted query parameters and normalised headers, consistent-hashes it to the owning server inside the PoP, and answers from page cache or NVMe in about 12ms. Roughly 95% of requests stop here and the origin never learns they happened.",
        lights: ["edge", "cachestore", "cachekey", "e3", "e4", "e5"],
      },
      {
        text: "The miss path is where the tiers earn their keep. A single-flight lock, key ownership inside the PoP, mid-tier coalescing and a per-customer origin shield apply in series and collapse 1,000,000 concurrent fetches for one hot URL down to 1, while stale-while-revalidate means nobody waited for any of it. The mid-tier adds latency to a miss and is still correct: its job is fan-out collapse, not speed.",
        lights: ["coalesce", "midtier", "shield", "origin", "e6", "e7", "e8", "e9"],
      },
      {
        text: "The cache key is a finance decision rather than a tuning decision. At 345 PB/day delivered, one point of byte hit ratio is about 3.5 PB/day of extra edge misses and roughly $420k a month of origin egress, so a tracking parameter or a Vary on User-Agent that multiplies one object into thousands of entries shows up on the bill before it shows up anywhere else.",
        lights: ["cachekey", "e4", "e5"],
      },
      {
        text: "Invalidation is the actual system. Where you own the URL you remove the problem instead of solving it: hash the bytes into the filename, serve it immutable, and change the reference. What is left over gets an eager push over a durable replayable log, idempotent because you cannot collect 13,000 acknowledgements, with tag generation counters so 'purge everything tagged product-1234' is one 40B counter bump rather than an enumeration of ten million objects.",
        lights: ["control-zone", "purgelog", "relay", "taggen", "e11", "e12", "e13", "e14"],
      },
      {
        text: "State the guarantee honestly. Freshness is a promise about when, not whether: the fresh window, plus the stale window, plus about two seconds of purge propagation, plus an unbounded tail for whichever PoP happens to be partitioned right now and will replay the log when it returns.",
        lights: ["purgelog", "relay", "edge", "e11", "e12"],
      },
    ],
    crux:
      "One object now exists on thousands of unsupervised machines in hundreds of datacentres, holding somebody else's mutable data, and when it changes you have to correct all of them without consensus on the request path and without ever collecting an acknowledgement.",
    numbers: [
      "1,000,000 concurrent origin fetches for one URL at expiry, collapsed to 1",
      "~$420k/month per point of byte hit ratio at 345 PB/day delivered",
      "purge reaches 99.9% of ~13,000 edge servers in ~2s",
    ],
  },
  nodes: [
    {
      id: "control-zone",
      label: "Purge control plane",
      kind: "zone",
      detail: {
        what: "The boundary around everything that tells a cache it is wrong: the durable purge log a customer's API writes to, and the fan-out tree that relays each record to every PoP.",
        why: "It never touches a byte of the response: nothing inside it sits between a request and its answer. That isolation is what lets a control-plane outage degrade purge freshness without touching the 12ms hit path.",
        numbers: ["~1,000 purges/s accepted", "p99 ~2s to 99.9% of ~13,000 servers"],
        breaks:
          "A stall here is invisible from the request path: every PoP keeps answering quickly with content it has already been told to forget, which is why propagation is checked with a synthetic canary rather than trusted from a healthy dashboard.",
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
        why: "It is drawn because it sets two constraints the rest of the design answers to: the user is paying for every millisecond of the miss path, and the client's own resolver and connection lifetime decide how much control you actually have over which PoP it reaches.",
        numbers: ["~8ms to the nearest PoP", "~12ms TTFB on an in-region hit"],
        breaks:
          "Client and resolver caching of DNS records is not yours to control, which is exactly why the data plane does not depend on it.",
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
        numbers: ["~200 PoPs", "BGP reconverges in under 30s", "5 minute incident SLO"],
        breaks:
          "Anycast gives you no per-request steering, so a degraded PoP cannot be selectively drained; you de-preference its announcement rather than withdrawing it, which is coarser and slower than DNS would be.",
        choice: {
          pick: "Anycast /24s announced from all 200 PoPs, with GeoDNS on top selecting between a handful of rings",
          instead: "Give every PoP its own address and steer entirely in DNS, answering each resolver with a chosen PoP.",
          decider:
            "How fast you must move traffic off a PoP, measured against how much DNS TTLs are actually obeyed. A BGP withdrawal reconverges the internet in seconds; a 30s DNS TTL is held for minutes to hours by a meaningful share of resolvers, so a drained PoP keeps taking traffic well past a 5 minute incident SLO.",
          flips:
            "Long-lived flows. Multi-GB downloads, WebSockets or live streams held open for minutes turn a mid-flow reconvergence RST from a cheap retry into a real failure. DNS steering is also the only option if you rent transit and have no ASN or portable prefixes, or if routing must satisfy a per-customer constraint such as EU data residency that BGP cannot express.",
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
        why: "This tier exists purely for latency: it is the only one a user's clock ever sees. An L4 balancer hashes the connection to one of ~50 servers, and the cache key is consistent-hashed to a single owning server so that one object has one home inside the PoP.",
        numbers: ["~2.5M req/s at a tier-1 PoP", "50k req/s and 40 Gbps per server", "~13,000 edge servers globally"],
        breaks:
          "A viral object concentrates on its owning box and 50k req/s of a 100KB object is a full 40 Gbps NIC, so hot keys have to be detected and replicated to every server in the PoP.",
        choice: {
          pick: "Terminate TLS at the edge, resolving the SNI hostname against the control-plane KV lazily and caching the chain in a per-server LRU",
          instead: "Ship every customer certificate to every edge server.",
          decider:
            "Copy count. 40,000 hostnames across 13,000 servers is 520M certificate copies to keep rotated, and a single renewal becomes a fleet-wide push. A lazy lookup adds a sub-millisecond read to a cold handshake and nothing at all to a resumed one.",
          flips:
            "A customer who will not surrender a private key, where keyless TLS keeps the key in their datacentre and the edge makes an RPC for the one signing operation: one extra round trip on connection setup, zero on resumption.",
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
        why: "A TTL is not a per-object timer, it is a timer that fires at 200 PoPs within a second or two of each other because all 200 fetched from the same origin response. Without coalescing, expiry of one hot object is a synchronised global event aimed at an origin provisioned for 2% of delivered bytes.",
        numbers: ["25k req/s per PoP x 0.2s x 200 PoPs = 1,000,000", "revalidation ~270ms of machine time, 0ms of user time"],
        breaks:
          "Stale-while-revalidate makes staleness guaranteed rather than possible: every expiry of every object serves at least one stale response per PoP by construction.",
        choice: {
          pick: "Serve stale under stale-while-revalidate behind a per-key single-flight lock, with TTL jittered +/-10% at storage time",
          instead: "Block the request on revalidation, or refresh eagerly the moment the timer fires.",
          decider:
            "What the user pays for correctness you do not gain. Blocking turns a 12ms response into a 270ms one while the same bytes were being served to somebody else a millisecond earlier, and it puts 1,000,000 concurrent fetches for one URL at the origin the instant the TTL expires.",
          flips:
            "Correctness-critical routes such as an inventory count or a price, which opt out per route and pay the full 270ms miss. That opt-out has to be per route rather than per customer.",
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
        numbers: ["~20 regions, ~250TB each, ~5PB globally", "union working set ~1.5B objects per region", "edge to mid-tier ~35ms"],
        breaks:
          "Lose a regional mid-tier and its 10 PoPs lose their shield at once, so origin fill for that region spikes about 5x until edges fail over to the next-nearest mid-tier.",
        choice: {
          pick: "Three tiers: edge, regional mid-tier, per-customer origin shield",
          instead: "Flat routing, where every edge PoP fetches the customer origin directly. Simpler, one fewer component to operate and lose, and a materially faster miss.",
          decider:
            "Miss fan-out against what a customer origin can actually absorb. Flat routing sends ~35 PB/day and a 5% share of 100M req/s at the origin; the tiers cut origin egress ~80% to ~7 PB/day, which is 840 PB/month avoided, roughly $17M/month at $0.02/GB.",
          flips:
            "A private CDN with 5 to 10 PoPs, where fan-out is 10 rather than 200 and the mid-tier buys almost nothing. Also an origin that is already a globally replicated object store, and mostly-uncacheable API traffic at a 20% hit ratio, where the extra hop adds ~90ms to nearly every request and collapses nothing.",
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
        numbers: ["collapses 20 fetches to 1", "shield to origin ~40ms", "origin sees ~7 PB/day, ~2% of delivered bytes"],
        breaks:
          "It is a single point of concentration per customer: if the shield PoP is degraded, every mid-tier's fill for that origin degrades with it.",
        choice: {
          pick: "Soft purge by default, with a per-origin fill token bucket at the shield capping concurrent origin fetches",
          instead: "Hard purge that deletes, with the tiers refilling as fast as they can.",
          decider:
            "What a purge-all does to an origin sized for ~2% of delivered bytes. Hard purge takes hit ratio to zero and points the full 100M req/s at it; marking objects stale instead lets stale-while-revalidate cover the refill while single-flight holds origin concurrency at one fetch per object.",
          flips:
            "A legal takedown or a leaked secret, where continuing to serve the old bytes is itself the failure. Hard purge stays available for that, rate-limited to a few thousand URLs and behind an explicit flag.",
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
        why: "It sits outside our trust boundary, which is the whole difficulty. You do not control the writer, so you learn about a change either by asking (conditional revalidation) or by being told through a customer-facing purge API, never by observing the write.",
        numbers: ["~7 PB/day of origin egress at a 90% byte hit ratio", "provisioned for ~2% of delivered bytes", "304 responses ~200B against 100KB fills"],
        breaks:
          "If it returns 5xx or times out, stale-if-error has to serve expired copies for a configured window and the shield has to break the circuit, or the error itself becomes a herd.",
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
        what: "The per-origin rules that decide what an object's identity is: host, normalised path, allowlisted query parameters, keyed headers, plus the TTL and stale-while-revalidate windows. Where the customer owns the URL, the real policy is to make invalidation unnecessary: their build hashes bytes into the filename (app.7f3c9a2b.js) and serves it immutable, so a changed object is a different object at a different address no cache has heard of yet.",
        why: "The key is the product. Anything you fail to strip multiplies one object into thousands of entries and the hit ratio falls; anything you wrongly strip makes two different responses share an identity, which is a security incident rather than a caching bug. Content-hashed naming is not a cheaper broadcast, it is the absence of one: nothing in the fleet is ever wrong, because the whole freshness problem concentrates into one short-TTL HTML shell that references the hashed assets instead of spreading over millions of objects.",
        numbers: [
          "one point of byte hit ratio ~ $420k/month",
          "TTL jittered +/-10% at storage time",
          "SLO >=95% by request, >=90% by byte",
          "hashed assets: max-age=31536000 immutable, 0 purge messages, ~100% hit ratio",
        ],
        breaks:
          "Cache poisoning: an origin returns one user's page with Set-Cookie and no Cache-Control: private, the edge stores it under a key with no identity in it, and the next user is served that session. Never-store on Set-Cookie, private and Authorization has to be enforced inside the engine where no config change can switch it off. And hashed naming only covers URLs the customer owns; their /index.html, API paths and anything SEO-visible keep fixed names and fall back to purge.",
        choice: {
          pick: "Allowlist query parameters, canonicalise their order, normalise User-Agent to a device class",
          instead: "Key on the full URL and honour whatever Vary the origin happens to send.",
          decider:
            "Cardinality against money. Tracking parameters or a Vary on User-Agent multiply one object into thousands of entries, and at 345 PB/day delivered one point of byte hit ratio is ~$420k/month of origin egress. Cache-key hygiene is a finance problem, not a tuning problem.",
          flips:
            "A customer whose parameter genuinely varies the response, which is why the allowlist ships in shadow mode with a response diff before it is enforced.",
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
        why: "Under Zipf with alpha ~0.9 there is no small hot set: reaching a 95% request hit ratio means holding roughly 320M objects, about 32TB, which is most of what a PoP sees in a day. So the cache is sized for residency and the interesting question becomes what you refuse to admit.",
        numbers: ["~750TB per tier-1 PoP, ~150PB globally", "~70% of hits served from RAM", "~400GB of index per PoP at ~200B per object"],
        breaks:
          "Index metadata, not disk, is what caps residency: ~2B resident objects at ~200B each is ~8GB of RAM per server sitting next to the page cache.",
        choice: {
          pick: "S3-FIFO on disk with W-TinyLFU admission in front of the page cache",
          instead: "Plain LRU across RAM and disk.",
          decider:
            "Scan resistance and flash endurance. A crawler pulling 50M cold URLs marches straight through LRU and evicts the hot set on behalf of a workload that got zero hits from it, and admitting every miss writes ~12.5 GB/s per tier-1 PoP to flash that is mostly never read again. Second-hit promotion keeps those in a ~10% probationary queue.",
          flips:
            "A small fixed catalogue that fits in RAM with no scans and no one-hit wonders, where LRU is simpler and the admission filter only costs a genuinely new object one request of delay.",
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
        why: "You cannot collect acknowledgements from 13,000 machines, some of which are unreachable right now, so you stop trying. The log makes the absence of an ack survivable: forgetting an object twice is the same as forgetting it once, and a PoP that was partitioned replays from its offset rather than needing to be told again.",
        numbers: ["7-day retention", "~1,000 customer purges/s", "purge SLO p99 <5s to 99.9% of servers"],
        breaks:
          "It buys durability, not completeness. A partitioned PoP keeps serving the old bytes until it reconnects, and you cannot bound how long that is.",
        choice: {
          pick: "A durable append-only log partitioned by origin_id, with per-PoP consumer offsets",
          instead: "RPC the invalidation out to every server and collect acknowledgements.",
          decider:
            "13,000 acknowledgements you cannot collect. Reporting servers_acked: 12987 is a statement about the servers that answered, not about the fleet, so the design has to make a missing ack harmless rather than treat it as a completion signal. Offsets plus idempotence do that; an RPC fan-out does not.",
          flips:
            "A single-datacentre cache tier where the writer sits next to the cache and invalidation is a delete issued at the moment of the write, roughly synchronous and cheap. That is the synchronous single-datacentre case, and none of this machinery is warranted there.",
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
        why: "A five second SLO across 13,000 servers is only affordable if the fan-out is hierarchical. The tree turns a global broadcast into one message per PoP plus local delivery, which is the difference between a control plane that survives a purge burst and one that becomes the outage.",
        numbers: ["~13,000 servers reached", "200k control-plane messages/s at ~200B", "~40 MB/s leaving the control plane", "p99 ~2s"],
        breaks:
          "If the fan-out stalls, stale content stays live past the SLO and nothing upstream notices, which is why propagation is measured with a synthetic canary re-fetched from every PoP rather than as a control-plane send count.",
        choice: {
          pick: "Hierarchical push: control plane, then 200 PoP relays, then in-PoP multicast",
          instead: "Flat fan-out from the control plane straight to all 13,000 edge servers.",
          decider:
            "Message rate at the source. At 1,000 purges/s, flat delivery is 13M messages/s from one place; the tree makes it 200 x 1,000 = 200k messages/s at ~200B each, about 40 MB/s, with the 13M/s server-local deliveries absorbed inside each PoP.",
          flips:
            "Small fleets. Below a few hundred servers the relay tier is another thing to operate and lose for no benefit, and a flat push is easier to reason about when it stalls.",
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
        why: "Bulk invalidation cannot be an enumeration. Purging a tag becomes one counter bump and the comparison is deferred to read time, where a server that finds a stored generation behind the current one simply treats the entry as a miss.",
        numbers: ["~40B pushed globally per tag purge", "one tag may match ten million objects across ~150PB"],
        breaks:
          "A tag-purged object still occupies disk until it is requested or evicted, so this mechanism means 'will never be served again', not 'deleted', which is exactly the distinction a takedown cares about.",
        choice: {
          pick: "Generation counters compared lazily at read time",
          instead: "Enumerate the index at every PoP and delete the matching entries.",
          decider:
            "Work per purge. 'Everything tagged product-1234' may match ten million objects spread across ~150PB of disk, and scanning the index for them is minutes of work repeated at 200 PoPs. The counter bump is ~40B and O(1), with the cost paid one lookup at a time.",
          flips:
            "When the operation has to mean physical deletion, for a legal takedown or a leaked secret, where deferring the work to read time leaves the bytes exactly where the customer paid you to remove them.",
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
      label: "SYN to the anycast IP",
      detail: {
        what: "The user's resolver returns one anycast address and the connection is opened to it, with no per-PoP address anywhere in the answer.",
        why: "Routing decisions that live in DNS are held by resolvers and client runtimes for far longer than the TTL says, so the data plane deliberately does not depend on them. GeoDNS only chooses which ring the user gets, not which PoP.",
        numbers: ["one prefix announced from 200 PoPs"],
        breaks:
          "A resolver that appears far from the user steers a whole population to the wrong ring, and a global p99 hides it because it is one country's problem.",
      },
    },
    {
      id: "e2",
      from: "router",
      to: "edge",
      tier: "hot",
      label: "nearest PoP, ~8ms",
      detail: {
        what: "BGP delivers the packet to whichever PoP is topologically nearest the client, and an L4 balancer inside it hashes the connection to one of ~50 servers.",
        why: "The internet's own routing is doing the work, which is why removing a PoP is a route withdrawal that reconverges in seconds rather than a record you wait out. It is also why a distributed attack spreads itself across all 200 PoPs for free.",
        numbers: ["~8ms to the PoP", "~2.5M req/s at a tier-1 PoP"],
        breaks:
          "A reconvergence mid-flow lands packets on a PoP with no socket state and returns a RST, which is a cheap retry for a short request and a truncated transfer for a large download.",
      },
    },
    {
      id: "e3",
      from: "edge",
      to: "cachestore",
      tier: "hot",
      label: "key lookup, ~95% hit",
      detail: {
        what: "The cache key is consistent-hashed to its owning server inside the PoP and the object is read from page cache or NVMe.",
        why: "One key having exactly one home inside the PoP is what makes single-flight work later: without it, 50 servers each hold their own copy and each independently decides to refill it when the TTL fires.",
        numbers: ["~12ms TTFB", "~70% of hits from RAM", "~15k IOPS per server on fall-through"],
        breaks:
          "Consistent hashing concentrates a viral object on one box, and 50k req/s of a 100KB object saturates a 40 Gbps NIC, so hot keys have to be replicated across the PoP.",
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
        numbers: ["1 partition key: origin_id", "~2-5GB of config and tag generations globally"],
        breaks:
          "A config change that removes a keyed header makes personalised responses shared, which shows up as a sudden hit-ratio jump on a dynamic route and is a security incident, not a caching win.",
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
        numbers: ["+/-10% jitter", "early-refresh odds rise inside the final 10% of TTL"],
        breaks:
          "Jitter widens the staleness window for some PoPs by up to 10% of the TTL, which routes that opted out of stale-while-revalidate also have to account for.",
      },
    },
    {
      id: "e6",
      from: "edge",
      to: "coalesce",
      tier: "hot",
      label: "miss or stale, ~5%",
      detail: {
        what: "The ~5% of requests where the entry is absent or past its TTL, handed to the miss handler rather than answered directly.",
        why: "This is the branch where the user's latency is decided. The handler's first move is to answer from the stale copy, so the fact that a miss is about to traverse three hops and ~270ms never reaches the client.",
        numbers: ["~5% of requests", "~35 PB/day of edge misses at a 90% byte hit ratio"],
        breaks:
          "A cold PoP, a fleet restart or a purge-all takes this branch to 100%, which is how you take a customer's site down against an origin sized for 2% of delivered bytes.",
      },
    },
    {
      id: "e7",
      from: "coalesce",
      to: "midtier",
      tier: "hot",
      label: "one fetch per key",
      detail: {
        what: "The single background revalidation that survives the per-server single-flight lock and the PoP's key ownership, sent over a pooled HTTP/2 connection.",
        why: "1,000,000 would-be fetches have already become 200 by this point, one per PoP. Pooling matters as much as coalescing: without long-lived connections every miss pays a fresh TCP and TLS handshake, three round trips and ~200ms across an ocean.",
        numbers: ["1,000,000 to 12,800 to 200", "edge to mid-tier ~35ms"],
        breaks:
          "Lose connection pooling and the miss penalty roughly triples while the next tier's TLS terminator is handed a handshake rate it cannot absorb.",
      },
    },
    {
      id: "e8",
      from: "midtier",
      to: "shield",
      tier: "hot",
      label: "200 to 20 to 1",
      detail: {
        what: "The regional fetch that missed regionally, forwarded to the single shield PoP designated for this customer origin.",
        why: "Two more orders of magnitude of collapse happen on this hop. It is also where the origin's source-IP allowlist becomes small and stable, because everything now converges on one PoP per customer.",
        numbers: ["mid-tier to shield ~180ms", "20 concurrent fetches become 1"],
        breaks:
          "If a mid-tier is lost, its 10 PoPs fail over to the next-nearest one, which is further away and holds a different working set, so the collapse ratio degrades before it recovers.",
      },
    },
    {
      id: "e9",
      from: "shield",
      to: "origin",
      tier: "hot",
      label: "1 conditional GET",
      detail: {
        what: "One conditional GET with If-None-Match for the entire planet, usually answered with a ~200B 304 rather than a 100KB body.",
        why: "This is the only request the origin sees, and the whole hierarchy exists to make that sentence true. Revalidation traffic is a rounding error against fill traffic, which is what lets a customer plan capacity against a stable ~2% of delivered bytes.",
        numbers: ["~40ms shield to origin", "~270ms total miss path", "origin sees ~7 PB/day"],
        breaks:
          "If the origin 5xxs or times out, stale-if-error covers it and the shield breaks the circuit, but 5xx responses must be negative-cached for a few seconds or the error becomes its own herd.",
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
        why: "The offset is the entire recovery story. A PoP that was partitioned when a purge was pushed resumes exactly where it stopped instead of needing the control plane to remember who missed what, which is what makes the fan-out safe to run without acknowledgements.",
        numbers: ["200 relays", "alert when any PoP's offset lag exceeds 30s"],
        breaks:
          "Offset lag is the metric that matters and it is invisible from the request path: the PoP looks perfectly healthy while serving content it has already been told to forget.",
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
        why: "It is idempotent by construction, because forgetting an object twice is the same as forgetting it once, and that is what allows replay after a partition without any bookkeeping about what was already applied.",
        numbers: ["p99 ~2s to 99.9% of servers", "SLO <5s"],
        breaks:
          "Two PoPs can disagree about a purged object for tens of seconds and that is the published contract, not a bug. Making it never happen would mean a WAN round trip on every 12ms hit.",
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
        why: "Purging only the edge would be worse than useless: the next request misses at the edge, fetches the old bytes from a mid-tier that still holds them, and re-caches the thing you just purged. Every tier holding a copy has to be told.",
        numbers: ["~20 mid-tiers plus one shield per origin"],
        breaks:
          "Ordering between tiers is not guaranteed, so an edge that refills after its own purge but before the mid-tier's will reintroduce stale content until the next purge or expiry.",
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
        numbers: ["~40B pushed globally", "O(1) regardless of how many objects match"],
        breaks:
          "It deliberately leaves the bytes on disk, so the operation means 'never served again' rather than 'deleted', which is not what a customer issuing a takedown believes they bought.",
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
        numbers: ["generation compare costs <1µs per lookup"],
        breaks:
          "The comparison is on the hot path of every single lookup, so the generation table has to be local to the PoP and read-mostly; a remote read here would put a WAN hop inside a 12ms hit.",
      },
    },
  ],
};
