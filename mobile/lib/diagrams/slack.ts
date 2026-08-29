import type { Diagram } from "./types";

export const SLACK: Diagram = {
  id: "slack",
  title: "Slack",
  question: "Design Slack (Workplace Messaging)",
  sourceId: "patterns",
  itemId: 32,
  overview: {
    shape:
      "This is a tenancy problem with a chat front end: the workspace is the unit of placement, and every box below the edge belongs to exactly one tenant's shard.",
    forces: [
      {
        constraint: "the median workspace has 10 DAU, the largest has 150,000, a 15,000x spread on the same code",
        decision: "bimodal placement: pool small tenants on shared shards, give the top 2% a dedicated shard",
        lights: ["shard", "placement"],
      },
      {
        constraint: "one missing WHERE clause on a pooled fleet of 750k tenants returns another company's messages",
        decision: "resolve the tenant once at the edge, before auth, and route so nothing downstream can reach another tenant",
        lights: ["edge", "directory"],
      },
      {
        constraint: "search's cost floor is set by history depth: ~380TB of index against 128TB/year of messages",
        decision: "share physical indices behind a workspace routing key for the long tail, dedicate only above ~50M documents",
        lights: ["search", "indexer"],
      },
      {
        constraint: "a 100,000-member channel would be 100,000 individual pushes per message at per-recipient delivery",
        decision: "publish once per channel topic; each gateway holding a subscriber consumes once and fans out locally",
        lights: ["topics", "gateway"],
      },
      {
        constraint: "a workspace growing from 1,000 to 100,000 seats after an acquisition degrades its 20,000 shard neighbours",
        decision: "make live migration routine maintenance: snapshot, tail the change stream, flip the directory row",
        lights: ["placement", "directory"],
      },
    ],
    naive: {
      text: "A reader defaults to one pooled fleet: every table keyed by workspace_id, one deploy, tenants sharing everything. That breaks the moment an enterprise customer asks for provable deletion or data residency. 'Delete this tenant within 30 days and prove it' on a pooled fleet is a full-corpus scan with no way to demonstrate completeness. The design homes each tenant on a named shard instead. One workspace's shard bundles a gateway pool, keyspace, search index and object-store prefix, so every enterprise obligation is one operation, not a scan.",
      lights: ["shard", "edge"],
    },
    beats: [
      {
        text: "Resolution happens before anything else. The edge terminates TLS, takes the workspace from the hostname or the token, and looks it up in a 150MB directory it holds entirely in memory. A request that does not resolve to a tenant is rejected there, because a default tenant and a fallback shard are how cross-tenant bugs get in.",
        lights: ["edge", "directory", "e1", "e2"],
      },
      {
        text: "A shard is a named bundle of five things: a gateway pool, a database keyspace, a search index home, an object-store prefix and a key alias. They stay together because every enterprise obligation, delete and retain and hold and re-key and prove residency, is one operation across all five at once. The alternative is a scan of everybody's data.",
        lights: ["shard"],
      },
      {
        text: "Delivery is the standard chat shape and gets one line: the gateway writes to the keyspace, acknowledges only after the write commits, then publishes once to the channel's topic. Every gateway holding a subscriber consumes once and pushes down the sockets it owns, so a 100,000-member #general costs 300 consumes rather than 100,000 pushes.",
        lights: ["gateway", "messages", "topics", "e5", "e6", "e7"],
      },
      {
        text: "Read state is the write load nobody budgets for. In a workplace tool people read roughly ten times more than they write, so unread is tracked as a high-water cursor per user per channel. A server-side mute flag rides alongside it, letting the gateway decline to push at all to people who muted the channel.",
        lights: ["readstate", "e8", "e9"],
      },
      {
        text: "Search is the cost centre and it is where tenancy stops being physical. Five years of history is around 380TB of index, comparable to the message store in bytes and far worse per byte. The long tail shares indices behind a workspace routing key, and only the top two percent get their own.",
        lights: ["indexer", "search", "e10", "e11"],
      },
      {
        text: "Placement is a forecast, and forecasts go stale, so moving a live workspace between shards has to be routine maintenance. Snapshot the keyspace, tail the change stream, flip the directory row when tail lag is under a second, and let clients reconnect from their cursors.",
        lights: ["placement", "directory", "e17", "e18"],
      },
    ],
    crux: {
      problem:
        "The customers are not the same size. The median workspace has 10 daily actives and the largest has 150,000, a 15,000x spread running the same code, and no single placement strategy is right at both ends.",
      handled:
        "Hash tenants across a pool and one tenant swamps its bucket; give every tenant its own bundle and 735,000 small workspaces cost more to run than they pay. So the answer is bimodal on purpose, and the price is a placement problem plus live migration machinery you have to keep exercising.",
    },
    numbers: [
      {
        value: "750k workspaces, median 10 DAU, largest 150k",
        explain: "The population size and the extreme spread in activity across it, the figure that rules out any single uniform placement strategy.",
      },
      {
        value: "380TB search index vs 128TB/year of messages",
        explain: "Search history costs more to store than the messages themselves, which is why search, not messaging, sets the system's cost floor.",
      },
      {
        value: "100k-member channel: 1 publish + 300 consumes",
        explain: "Fan-out cost scales with the number of gateways holding subscribers, not with channel membership, which is what makes even the largest channels affordable.",
      },
    ],
  },
  nodes: [
    {
      id: "shard",
      label: "One workspace's shard",
      kind: "zone",
      detail: {
        what: "A named bundle of a gateway pool, a database keyspace, a search index home, an object-store prefix and an encryption key alias, holding every tenant homed here.",
        why: "The five parts are bundled because every per-customer obligation is an operation over all five at once. Deleting a customer is a keyspace drop, an index drop, a prefix delete and a key destruction; retention is a compaction setting plus a lifecycle rule. Split them across differently partitioned systems and each becomes a distributed transaction with no shared coordinator.",
        numbers: [
          { value: "~300 gateway boxes across the fleet", explain: "The socket-holding capacity one shard's gateway pool is sized to, enough to absorb rolling deploys and a zone loss." },
          { value: "tens of thousands of small tenants per shared shard", explain: "How densely the long tail of small workspaces packs onto a pooled shard, keeping utilisation high where dedicated capacity would be wasted." },
          { value: "top 2% get a dedicated shard", explain: "2% of 750k workspaces is ~15,000 — the same dedicated-index count the search tier lists below, so placement and index dedication track the same threshold." },
        ],
        breaks: {
          failure: "Blast radius is every tenant homed here.",
          handled: "A pooled shard incident is a small outage for 20,000 customers. A dedicated shard incident is a total outage for one named account with a contract, an accepted tradeoff of bimodal placement.",
        },
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "socket + cursor per channel",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "Desktop, mobile or web client holding one persistent socket and, per open channel, the last message id it has seen.",
        why: "Holding a cursor rather than a session is what makes every disruption cheap. A deploy, a zone loss or a tenant migration costs one range read per open channel instead of a history resync. That is why dropping sockets is a reconnect event rather than a data event.",
        numbers: [
          { value: "~40% of DAU connected in their working day", explain: "14M ÷ 40% ≈ 35M, the same daily-active figure the read-state store below is sized against — this ratio turns DAU into peak socket count." },
          { value: "14M concurrent sockets at global peak", explain: "The peak connection count the gateway fleet has to hold simultaneously, the top-level number the whole socket tier is sized against." },
        ],
        breaks: {
          failure: "Without jittered backoff, 14M clients retry inside the same second.",
          handled: "The boxes that survived the original fault go down under the reconnects, which is why every client backoff is randomised rather than fixed.",
        },
      },
    },
    {
      id: "edge",
      label: "Edge resolver",
      sub: "workspace to shard, before auth",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "Terminates TLS, reads the workspace from the hostname or the token, resolves it to a shard from the in-memory directory, and routes. Nothing downstream can reach another tenant.",
        why: "This is where tenant correctness stops being a predicate a feature team can forget and becomes a routing decision made once. On a pooled fleet a missing WHERE workspace_id returns another company's messages, and the only defences are review and testing, both probabilistic.",
        numbers: [
          { value: "resolution: 0 network hops, a memory lookup", explain: "Tenant resolution costs nothing but a local memory read, since the whole directory is cached in full at every edge node." },
          { value: "0 default tenant, 0 fallback shard", explain: "There is no default or fallback path an unresolvable request could silently fall into; it is rejected instead." },
        ],
        breaks: {
          failure: "An unresolvable tenant must fail closed.",
          handled: "A rise in the resolve error rate usually means directory staleness, and the tempting fix, a fallback shard, is the exact bug the layer exists to prevent.",
        },
        choice: {
          pick: "Resolve the tenant at the edge and home it on a named shard",
          instead: "One pooled fleet with workspace_id as the leading key on every table.",
          decider:
            "How many tenant-scoped operations must be complete and provable. At 750k tenants and 128TB of new messages a year, 'delete this customer within 30 days and attest to it' is the test. A pooled fleet answers with a full-corpus scan and no way to demonstrate completeness. Homed, it is a keyspace drop plus a key destruction: minutes, with an artifact.",
          flips: "Tenants within roughly 10x of each other and no customer contracted for residency, key control or attested deletion. Pooling is genuinely better there: higher utilisation, one deploy, no placement to get wrong. The mistake is not starting pooled, it is failing to budget the migration for the first enterprise contract.",
        },
      },
    },
    {
      id: "directory",
      label: "Tenant directory",
      sub: "750k rows, 150MB, cached in full",
      kind: "database",
      col: 1,
      row: 0,
      detail: {
        what: "One strongly consistent table mapping workspace_id to (shard_id, region, plan, key_alias, state). The only globally scoped store in the system.",
        why: "Keeping the global list at exactly one entry is the discipline every other guarantee rests on. Residency becomes a row you can read to an auditor, and migration becomes a row you flip, because placement is data rather than configuration spread across services.",
        numbers: [
          { value: "750k rows x ~200B = 150MB", explain: "The full directory size at current scale, small enough to cache entirely in memory on every edge node." },
          { value: "a few thousand writes a day", explain: "The write rate this table sees, driven by new workspace creation and migrations rather than any per-message traffic." },
          { value: "150MB fits in memory on every edge node", explain: "The consequence of the directory's small size: every edge node holds a complete, current copy rather than querying a remote service." },
        ],
        breaks: {
          failure: "Version skew across edge nodes after a migration flip.",
          handled: "Some edges route to the old shard and their writes fail retryably until the refresh lands, accepted since a retryable failure is far safer than a silent cross-tenant write.",
        },
        choice: {
          pick: "Small strongly consistent store, full copy cached at every edge behind a version counter",
          instead: "A directory service the edge calls per request, or sharded routing config baked into deploys.",
          decider:
            "Size against write rate. 750k rows at ~200B is 150MB and takes a few thousand writes a day, so the whole thing fits in memory everywhere and resolution costs nothing. An RPC per request would put a network hop and a hard dependency in front of every single connection.",
          flips: "Tens of millions of tenants, where the table no longer fits at the edge and you need a real lookup tier with its own cache and its own failure story.",
        },
      },
    },
    {
      id: "limiter",
      label: "Per-tenant admission",
      kind: "service",
      col: 1,
      row: 1,
      sub: "token bucket per app+ws",
      detail: {
        what: "Token buckets keyed by (app, workspace) applied at the edge, refusing with 429 and a retry-after once a bucket empties.",
        why: "This is the noisy-neighbour control. A shard's capacity is shared by 20,000 tenants, so a limit has to be per tenant and applied before the shard. Otherwise one runaway integration spends a budget belonging to everyone else on the bundle.",
        numbers: [
          { value: "1,000 msgs/min from a bot is 17/s", explain: "17/s is 0.03% of the 60k msgs/s fleet-wide peak — invisible to any aggregate alarm, why the limit is enforced per tenant instead." },
          { value: "20,000 tenants can share one pooled shard", explain: "The density of a pooled shard, why a single misbehaving tenant's traffic has to be capped before it reaches shared capacity." },
        ],
        breaks: {
          failure: "17/s is invisible to the bus and severe for the 20,000 humans in the channel.",
          handled: "Volume alarms tuned to infrastructure load never fire on the failure that matters, which is why admission is limited per tenant rather than only monitored fleet-wide.",
        },
        choice: {
          pick: "Token bucket per app per workspace, enforced at the edge",
          instead: "Fleet-wide or per-endpoint rate limits applied inside the shard.",
          decider:
            "Where the cost lands. A bot posting 1,000 messages a minute is 17/s, which no global limit sized for 60k msgs/s peak will ever notice, and which is severe for the tenant it targets. Enforcing after routing also means the shard has already paid for the traffic.",
          flips: "Single-tenant deployments, where there are no neighbours to protect and a global limit sized to the box is both simpler and sufficient.",
        },
      },
    },
    {
      id: "gateway",
      label: "Gateway pool",
      kind: "service",
      col: 1,
      row: 2,
      parent: "shard",
      sub: "workspace-sticky, 100k/box",
      detail: {
        what: "Long-lived servers holding the sockets for the tenants homed on this shard, sticky by workspace so a reconnect lands where the channel list and presence are already warm.",
        why: "Stickiness by workspace rather than by user is what keeps a tenant's subscription state concentrated. A shard's gateways collectively hold every subscriber for that shard's channels, so a channel topic only has to reach the gateways in one pool.",
        numbers: [
          { value: "14M sockets / 100k per box = 140 boxes", explain: "The baseline fleet size needed just to hold every concurrent socket at peak, before any redundancy is added." },
          { value: "~40KB of socket, TLS and subscription state each", explain: "The per-connection memory cost that sets how many sockets one box can hold." },
          { value: "2x for rolling deploys and zone loss = ~300 boxes", explain: "The actual provisioned fleet size, doubled over the bare minimum so a deploy or a zone loss never runs out of capacity." },
        ],
        breaks: {
          failure: "A rollout that drops a large share of the pool at once: the survivors take the reconnects and fall over.",
          handled: "Drain a fixed percentage at a time and never a whole workspace's pool, so a deploy never concentrates enough reconnect load on the survivors to cascade.",
        },
        choice: {
          pick: "Workspace-sticky long-lived gateway pool, one per shard",
          instead: "A globally shared socket tier with a session registry mapping user to box.",
          decider:
            "Whether a socket can reach the wrong tenant. Sticky-by-workspace makes the pool part of the shard bundle, so the 5-part delete and re-key story stays intact, and it keeps fan-out to 300 boxes rather than the whole fleet. A shared tier needs a per-message registry lookup and puts every tenant in one failure domain.",
          flips: "A uniform consumer population with no tenant above the others, where a shared tier packs sockets more densely and stickiness only costs you utilisation.",
        },
      },
    },
    {
      id: "messages",
      label: "Message store",
      kind: "database",
      col: 1,
      row: 3,
      parent: "shard",
      sub: "messages + thread_replies",
      detail: {
        what: "The shard's keyspace. messages partitioned by channel_id and sorted by message ulid, plus thread_replies partitioned by (channel_id, thread_parent_id) as a denormalised second copy.",
        why: "This is the record and the bus is not, so the acknowledgement follows the commit. The second table exists because the partitioning that is right for scrolling a channel is wrong for loading a thread, and no single sort order serves both.",
        numbers: [
          { value: "700M messages/day x 500B = 350GB/day raw", explain: "The daily write volume at current scale, the baseline every storage and replication figure downstream is built from." },
          { value: "128TB/year raw, ~385TB replicated", explain: "The annual accumulation before and after replication, the figure that sizes long-term storage capacity for the whole fleet." },
          { value: "800-reply thread = one partition read", explain: "The payoff of the second thread_replies table: even a very active thread resolves in a single bounded read rather than a scan." },
        ],
        breaks: {
          failure: "A write timeout on the tenant's keyspace.",
          handled: "Retry idempotently on the client-supplied message id, and never acknowledge or publish before the write commits, so a timeout costs a retry rather than a duplicate.",
        },
        choice: {
          pick: "Wide-column keyspace, channel-partitioned, with a second thread_replies table",
          instead: "One messages table with a thread_parent_id column, filtered at read time.",
          decider:
            "Thread reads. Filtering a channel partition holding 4 million messages to find 800 replies scans all 4 million rows and degrades linearly with channel size forever. The double write is nearly free because both writes hit the same cluster and the same commit log.",
          flips: "Channels small enough that a partition scan is bounded, or a product with no threading at all, where the second table is pure write amplification.",
        },
      },
    },
    {
      id: "topics",
      label: "Per-channel topics",
      sub: "1 publish, 1 consume per gateway",
      kind: "queue",
      col: 0,
      row: 2,
      parent: "shard",
      detail: {
        what: "The bus between gateways within a shard. One topic per channel; a gateway subscribes once for every socket it holds that is in that channel.",
        why: "Fan-out cost becomes the number of gateways involved rather than the number of channel members, which is the entire reason a 100,000-member #general is affordable. It carries only what is being delivered right now, so a stalled topic degrades to catch-up reads rather than data loss.",
        numbers: [
          { value: "14M sockets x ~8 channels = 112M live subscriptions", explain: "The total subscription load across the fleet, the figure that sizes how much state gateways collectively hold." },
          { value: "100k-member channel: 1 publish + 300 consumes", explain: "The concrete payoff of gateway-level fan-out: even the largest channel costs a few hundred consumes, not a hundred thousand pushes." },
          { value: "a 300x saving over per-recipient delivery", explain: "The reduction this design buys over naive per-recipient delivery for the largest channels, where the saving matters most." },
        ],
        breaks: {
          failure: "A topic stalls and live delivery for that channel stops.",
          handled: "Detection is per-topic consumer lag; the recovery is that clients catch up from the store, because the bus was never the record.",
        },
        choice: {
          pick: "A topic per channel, consumed once per gateway holding a subscriber",
          instead: "Per-recipient delivery: look up each member's connection and push to it.",
          decider:
            "Fan-out arithmetic on the biggest channel. 100,000 members spread over 300 gateways is 1 publish plus 300 consumes, against 100,000 individual pushes for the same message. The cost stops scaling with membership and starts scaling with fleet size.",
          flips: "Mostly 1:1 conversations, where per-recipient routing through a session registry is simpler and a topic per two-person chat is pure overhead.",
        },
      },
    },
    {
      id: "readstate",
      label: "Read state + mute",
      sub: "cursor per (user, channel)",
      kind: "database",
      col: 2,
      row: 2,
      parent: "shard",
      detail: {
        what: "A high-water message id per user per channel, plus server-side mute and notification preference flags the gateway consults before it pushes.",
        why: "In a workplace tool people read roughly ten times more than they write, so unread has to be a cursor rather than per-message state. Mute lives server-side for the same reason: the cheapest push is the one the gateway declines to send.",
        numbers: [
          { value: "~200 messages read per active user per day", explain: "The typical read volume per user, roughly ten times the message volume the system actually has to durably store." },
          { value: "35M x 200 = 7B views/day, collapsed to a cursor per channel", explain: "The naive per-view write volume this design avoids by tracking only a high-water mark instead of every individual read." },
          { value: "~8 open channels per connected user", explain: "The typical number of distinct channels one user's cursor state has to span at any time." },
        ],
        breaks: {
          failure: "The badge is the thing users trust, so a lost or reordered cursor write shows unread counts that do not match the channel.",
          handled: "They notice that faster than they notice a late message, which is why cursor writes must move strictly monotonically, never backwards.",
        },
        choice: {
          pick: "High-water cursor per (user, channel) plus server-side mute",
          instead: "Per-message read rows, or computing unread on the client from local history.",
          decider:
            "Read volume against write volume. 35M daily actives reading ~200 messages each is 7B views a day. A row per view is two orders of magnitude more writes than the 700M sends the system exists to carry. A cursor bounds it to one write per channel visit and answers the same question.",
          flips: "Products that sell per-message read receipts as a feature, where you owe the sender who has read it and the cursor cannot answer that.",
        },
      },
    },
    {
      id: "indexer",
      label: "Search indexer",
      sub: "off the persist stream",
      kind: "service",
      col: 1,
      row: 4,
      parent: "shard",
      detail: {
        what: "Consumes the message keyspace's change stream and writes documents into the workspace's index, per-tenant backpressured.",
        why: "It hangs off the durable stream rather than the bus because indexing must not be lost when a topic stalls or a pool is drained. Everything that must survive a deploy consumes the persist stream; only live delivery hangs off the bus.",
        numbers: [
          { value: "target index lag under 10s", explain: "The freshness bar this indexer is held to, tight enough that search rarely lags noticeably behind live delivery." },
          { value: "1.28T documents over five years", explain: "The cumulative document count this indexer has produced at current message volume over a five-year retention horizon." },
        ],
        breaks: {
          failure: "Indexer lag on one tenant.",
          handled: "Backpressure per tenant so one backlog cannot starve others, and note the lag window is also the window a deleted message could still surface in search.",
        },
        choice: {
          pick: "Index from the keyspace change stream",
          instead: "Index from the pub/sub bus alongside the delivery fan-out.",
          decider:
            "Whether a document may be lost. The bus carries only what is being delivered right now, and a stalled topic is an accepted degradation. Indexing off it would silently lose messages during exactly the incidents you most need history for. Over 700M messages a day the change stream is the record, at the cost of under 10s of lag.",
          flips: "Search over a recent window only, where the index is disposable and rebuilding it from the store is cheaper than maintaining a durable consumer.",
        },
      },
    },
    {
      id: "search",
      label: "Search tier",
      sub: "shared index routed on workspace",
      kind: "database",
      col: 2,
      row: 3,
      parent: "shard",
      detail: {
        what: "Shared physical indices with workspace_id as the routing key for the long tail, dedicated indices above roughly 50M documents, dedicated clusters for the top tier.",
        why: "Search sets the cost floor, not messaging, and it is the one place the tenant boundary is logical rather than physical. Every query carries a mandatory tenant filter injected by a builder that exposes no way to construct an unscoped query, and hits are filtered again against current channel membership.",
        numbers: [
          { value: "~380TB of index over five years", explain: "The accumulated index size at current scale, larger than the message store itself and the actual cost driver for the whole system." },
          { value: "~50M docs is ~1,370 DAU, the 98th percentile", explain: "The document count threshold that triggers dedicated placement, translated into the daily-active-user scale it corresponds to." },
          { value: "~15,000 dedicated indices, 735,000 shared", explain: "The split between tenants large enough to warrant their own index and the long tail packed onto shared ones." },
        ],
        breaks: {
          failure: "One tenant running an unbounded wildcard query competes for the same heap and query threads as thousands of others on a shared index.",
          handled: "Per-tenant query budgets, a circuit breaker, and promotion to a dedicated index on query cost rather than document count contain the damage to that tenant's own share.",
        },
        choice: {
          pick: "Hybrid: shared indices routed on workspace_id, dedicated above ~50M documents",
          instead: "One index per workspace, so tenancy in search is physical like everywhere else.",
          decider:
            "Shard count against node capacity. A node holds 500 to 1,000 shards before cluster state and heap overhead dominate, so 750,000 workspaces at one shard each is ~1,000 nodes carrying a median of 110MB. A shard is comfortable at ~50M documents, which is a workspace of ~1,370 daily actives.",
          flips: "Tenant counts in the thousands rather than the hundreds of thousands, or a customer contracting for physical index separation. A 99% empty shard is affordable at a few thousand tenants and not at 750,000.",
        },
      },
    },
    {
      id: "notifier",
      label: "Notification dispatcher",
      kind: "service",
      col: 0,
      row: 3,
      parent: "shard",
      sub: "off persist stream, deduped",
      detail: {
        what: "Consumes the same durable stream, resolves mentions and DMs against channel membership and notification preferences, and pushes to people with no live socket.",
        why: "A mention has to fire whether or not the recipient is connected, which is exactly why it is sized off the persist stream rather than the socket path. Push is a best-effort wake-up; what actually guarantees the alert is the stored message and an unread cursor that has not passed it.",
        numbers: [
          { value: "~8% of messages are a DM or a mention", explain: "700M messages/day × 8% ≈ 56M, matching the figure below — the filter that keeps this dispatcher sized to notifications, not the full stream." },
          { value: "56M/day, ~1.6k/s busy hour, ~5k/s peak", explain: "The resulting notification volume at current scale, the figure this dispatcher's fleet is sized against." },
        ],
        breaks: {
          failure: "Push provider errors during a mention storm.",
          handled: "Per-provider retry queue, dedupe on (user id, message id) so a reconnect plus a push is not two alerts, and degrade to an in-app badge when a provider is down.",
        },
        choice: {
          pick: "Consume the persist stream, dedupe on (user id, message id)",
          instead: "Fire notifications from the gateway when a recipient has no live socket.",
          decider:
            "Coverage. 56M notifications a day must reach people who are offline, mid-deploy or mid-migration, and the gateway only knows about the sockets it holds. Deciding from the durable stream makes connectivity irrelevant to whether the alert exists.",
          flips: "Presence-driven products where a notification is only meaningful to a connected user, and firing from the gateway saves a whole consumer.",
        },
      },
    },
    {
      id: "placement",
      label: "Placement + migration",
      sub: "load score, snapshot then tail",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "Places a new workspace on the least loaded shard in its region by weighted score, and moves live tenants between shards by snapshot, change-stream tail and a directory flip.",
        why: "Homing a tenant turns compliance from a query problem into a routing problem, and the bill for that is paid here. The score is a forecast, tenants grow, so placement is continuously slightly wrong and rebalancing has to be maintenance rather than an incident.",
        numbers: [
          { value: "score: 4 inputs — sockets, msgs/s, index bytes, plan", explain: "The signals this placement decision weighs, chosen because seat count alone does not predict a tenant's actual load." },
          { value: "write unavailability 500ms to 2s", explain: "The brief write pause a live migration costs the moving tenant at cutover, small enough to be routine maintenance rather than an incident." },
          { value: "flip gated on tail lag under 1s", explain: "The freshness bar the change-stream tail must clear before the directory is allowed to flip to the new shard." },
        ],
        breaks: {
          failure: "Flipping the directory before the tail drains.",
          handled: "Gate on tail lag, keep the flip reversible for the length of the window, and make source writes fail retryably rather than be lost.",
        },
        choice: {
          pick: "Weighted-score placement plus online migration: snapshot, tail, flip, reconnect",
          instead: "Static assignment by seat count, with moves done in a maintenance window.",
          decider:
            "The 15,000x spread between the median workspace at 10 daily actives and the largest at 150,000. A seat count does not predict socket load or index bytes, and a workspace that grows from 1,000 to 100,000 seats after an acquisition degrades its 20,000 neighbours first. 500ms to 2s of write unavailability beats a window nobody in a global tenant will agree to.",
          flips: "A tenant base small enough that manual placement and an agreed window are realistic, where building and exercising migration machinery costs more than it saves.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "edge",
      tier: "hot",
      step: 1,
      label: "connect, workspace in host",
      detail: {
        what: "The client opening its persistent socket, carrying the workspace in the hostname or the token.",
        why: "The workspace is never a request parameter. A tenant identifier a caller can set is a tenant identifier a caller can change, so it comes from the host or the credential and nowhere else.",
        numbers: [{ value: "14M concurrent sockets at global peak", explain: "The peak connection volume this arrow carries, the top-level figure the whole edge and gateway tier is sized against." }],
        breaks: {
          failure: "A reconnect storm arrives here first.",
          handled: "This is why admission is token-bucketed on the receiving box: it must accept no faster than it can build subscription state.",
        },
      },
    },
    {
      id: "e2",
      from: "edge",
      to: "directory",
      tier: "control",
      label: "workspace to shard",
      detail: {
        what: "The tenant resolution lookup: workspace_id to (shard_id, region, plan, key_alias, state).",
        why: "It runs before authentication does any real work, because everything downstream is scoped by the answer. It is a control path because it carries no message data and it is a memory read rather than a hop.",
        numbers: [{ value: "150MB held in full on every edge node", explain: "750k rows × ~200B ≈ 150MB, matching the directory node's own figure — small enough for every edge to hold it whole, zero network hops." }],
        breaks: {
          failure: "An unknown tenant must fail closed and a stale directory must serve its last known version.",
          handled: "The alternative defaults are a fallback shard and a cross-tenant read, exactly the failure mode this whole layer exists to prevent.",
        },
      },
    },
    {
      id: "e3",
      from: "edge",
      to: "limiter",
      tier: "control",
      label: "per app, per workspace",
      detail: {
        what: "Charging the request against the token bucket for this (app, workspace) pair before it is routed.",
        why: "It has to happen before the shard, or the tenant has already spent capacity shared with 20,000 others by the time anyone counts it. The tenant is known at this point precisely because resolution ran first.",
        numbers: [{ value: "429 with a retry-after when the bucket empties", explain: "The explicit signal a rate-limited caller receives, telling it exactly how long to wait rather than leaving it to guess." }],
        breaks: {
          failure: "An admin needs a way to suspend an app's scopes without uninstalling it.",
          handled: "Uninstalling destroys the configuration, so admins hesitate to use it mid-incident, which is why a distinct suspend action exists.",
        },
      },
    },
    {
      id: "e4",
      from: "edge",
      to: "gateway",
      tier: "hot",
      step: 2,
      label: "routed to the shard pool",
      detail: {
        what: "The resolved connection handed to a gateway box in this workspace's pool, sticky so a reconnect lands warm.",
        why: "Past this arrow the connection physically cannot reach another tenant's keyspace, index or object-store prefix. That is the property the whole design is buying, and it is why the query predicate is defence in depth rather than the defence.",
        breaks: {
          failure: "Stickiness means a box is not interchangeable while it holds sockets.",
          handled: "Deploys drain a fixed percentage rather than restarting the pool, so a rollout never forces every socket on a box to reconnect at once.",
        },
      },
    },
    {
      id: "e5",
      from: "gateway",
      to: "messages",
      tier: "hot",
      step: 3,
      label: "durable write, then ack",
      detail: {
        what: "The send path: write to messages and thread_replies, commit, and only then acknowledge the sender.",
        why: "The tick has to mean the record exists rather than that one process accepted it. Acknowledging first would make the socket the record, and the socket is an accelerator.",
        numbers: [
          { value: "write p99 under 50ms per shard keyspace", explain: "The latency this write path is held to, fast enough that the durable commit is not the dominant cost of sending a message." },
          { value: "~60k msgs/s at peak across the fleet", explain: "The aggregate write volume this path sustains at peak, the figure the message store's throughput is provisioned against." },
        ],
        breaks: {
          failure: "A timeout here is retried idempotently on the client-supplied message id.",
          handled: "Retrying without it is how one send becomes two messages, which is why the client-supplied id is mandatory on every retry.",
        },
      },
    },
    {
      id: "e6",
      from: "gateway",
      to: "topics",
      tier: "hot",
      step: 4,
      label: "publish once per message",
      detail: {
        what: "One publish to the channel's topic, after the write commits.",
        why: "Publishing after the commit is what makes the ordering of the two paths a design rule rather than an accident. Nothing is delivered that is not already durable, so a crash mid-flight loses delivery and never loses the message.",
        numbers: [{ value: "1 publish regardless of channel size", explain: "The publish cost of this arrow never scales with channel membership, only the downstream consume count does." }],
        breaks: {
          failure: "Publish-before-commit delivers messages that a failed write means never existed.",
          handled: "The clients that received them have no way to learn that, which is exactly why the publish always happens strictly after the write commits.",
        },
      },
    },
    {
      id: "e7",
      from: "topics",
      to: "gateway",
      tier: "hot",
      step: 5,
      label: "1 consume per gateway",
      offset: 90,
      detail: {
        what: "Every gateway holding a subscriber to that channel consumes the message once and pushes it down the sockets it owns locally.",
        why: "This is the arrow that makes a 100,000-member channel affordable. Cost scales with the number of gateways in the pool, which is bounded by fleet size, rather than with membership, which is not.",
        numbers: [
          { value: "300 consumes rather than 100,000 pushes", explain: "The concrete saving this fan-out scheme buys on the largest channels, where per-recipient delivery would be least affordable." },
          { value: "112M live subscriptions across the fleet", explain: "The total subscription state this consume pattern operates over, distributed across gateways rather than requiring a central lookup." },
        ],
        breaks: {
          failure: "It still costs every recipient a wake, a render and a badge update.",
          handled: "This is why mute is enforced before the push rather than on the device, removing the cost entirely rather than just hiding the result.",
        },
      },
    },
    {
      id: "e8",
      from: "gateway",
      to: "readstate",
      tier: "data",
      label: "cursor advance",
      detail: {
        what: "The per-channel high-water message id moving forward as a user reads, written from the gateway that holds their socket.",
        why: "Collapsing reads into a cursor is what keeps a read-heavy product from generating an order of magnitude more writes than sends. One write per channel visit answers the same question as a row per message viewed.",
        numbers: [
          { value: "~200 messages read per active user per day", explain: "The typical read volume this cursor mechanism collapses into a single per-visit write instead of one write per message viewed." },
          { value: "~8 open channels per connected user", explain: "This write happens once per open channel, not per message — real write load caps near 8/session, not the 200 messages a user reads." },
        ],
        breaks: {
          failure: "Cursors must move monotonically.",
          handled: "An out-of-order write walks the badge backwards and resurfaces messages the user has already read, which is why cursor writes are validated before being applied.",
        },
      },
    },
    {
      id: "e9",
      from: "readstate",
      to: "gateway",
      tier: "data",
      label: "mute + unread on connect",
      offset: 90,
      detail: {
        what: "Mute flags and unread positions read back into the gateway when a socket attaches, and consulted before every push.",
        why: "Holding mute server-side removes most of the traffic in a busy channel before it leaves the building. Seeding unread at connect time is what makes a reconnect one range read per channel rather than a resync.",
        numbers: [{ value: "one range read per open channel on reconnect", explain: "At ~8 open channels per user, that's at most 8 range reads to reseed a reconnect — same whether offline ten seconds or ten days." }],
        breaks: {
          failure: "Stale mute state in a gateway's memory keeps pushing to people who muted the channel.",
          handled: "The symptom is a notification complaint rather than an alert, which is why mute state is refreshed on every reconnect rather than cached indefinitely.",
        },
      },
    },
    {
      id: "e10",
      from: "messages",
      to: "indexer",
      tier: "data",
      label: "change stream",
      detail: {
        what: "The keyspace's change stream feeding the indexer: new messages, edits and deletes.",
        why: "Everything that must not be lost hangs off this stream rather than off the bus. A drained gateway pool or a stalled topic is a delivery event and never an indexing event.",
        numbers: [{ value: "index lag target under 10s", explain: "The freshness bar this stream's consumer is held to, tight enough that search rarely visibly lags behind live delivery." }],
        breaks: {
          failure: "The gap between a delete committing and the index dropping the document is seconds normally and minutes under lag.",
          handled: "During it a search can match deleted content, an accepted window since closing it entirely would mean gating live delivery on the indexer's own health.",
        },
      },
    },
    {
      id: "e11",
      from: "indexer",
      to: "search",
      tier: "data",
      label: "index, routed on workspace",
      detail: {
        what: "Documents written into the workspace's index: a shared physical index with workspace_id as the routing key, or a dedicated one above the threshold.",
        why: "Routing on workspace id means a tenant's query touches one shard rather than all of them. That is what makes sharing an index survivable for the 735,000 workspaces too small to justify their own.",
        numbers: [
          { value: "~300B indexed per message", explain: "The typical document size written per message, the unit the whole search index's total footprint scales from." },
          { value: "~50M documents per shard", explain: "The rough capacity threshold a shared index shard can carry before query performance and cluster overhead start to degrade." },
        ],
        breaks: {
          failure: "This is the one path where a tenant filter bug leaks across the boundary.",
          handled: "It needs a live canary planting a document in one tenant and asserting another tenant's search never returns it, the single point where the boundary is logical, not physical.",
        },
      },
    },
    {
      id: "e12",
      from: "search",
      to: "messages",
      tier: "data",
      label: "hydrate hits",
      offset: 110,
      detail: {
        what: "Every search hit resolved back to the message row rather than served from the index's stored fields.",
        why: "It makes a stale index entry a miss instead of a leak of deleted content, and it is the only version of this that is correct rather than merely fast. Results are also filtered against current channel membership at this point, never against ACLs frozen at index time.",
        numbers: [{ value: "one point read per hit, ~20 per result page", explain: "The hydration cost per search result page, small enough to keep result rendering fast even after the index-time ACL is discarded." }],
        breaks: {
          failure: "Filtering at query time means relevance is scored over documents the user cannot see.",
          handled: "Ranking is subtly wrong and deep pagination over-fetches by a factor nobody can predict, an accepted cost of never trusting an ACL snapshot frozen at index time.",
        },
      },
    },
    {
      id: "e13",
      from: "messages",
      to: "notifier",
      tier: "data",
      label: "mentions and DMs",
      detail: {
        what: "The same durable stream consumed a second time, filtered to the ~8% of messages that are a DM or carry a mention.",
        why: "Notifications must fire for people with no connection at all, so they are decided from the record rather than from the fan-out. That one choice covers offline users, deploys, migrations and dead push tokens with no special cases.",
        numbers: [{ value: "56M/day, ~1.6k/s busy hour", explain: "700M × 8% ≈ 56M/day; spread across a day that's ~648/s average, so busy-hour's 1.6k/s is about 2.5x the average load." }],
        breaks: {
          failure: "Dedupe on (user id, message id) or a reconnect that replays the tail produces a second alert for a message the user has already seen.",
          handled: "The dedupe key is what makes a replayed tail safe to process again without risking a duplicate notification reaching the user.",
        },
      },
    },
    {
      id: "e14",
      from: "notifier",
      to: "client",
      fromSide: "left",
      toSide: "left",
      tier: "control",
      label: "push if no live socket",
      offset: 130,
      detail: {
        what: "A push to a device with no open socket, waking the client so it reconnects and catches up from its cursor.",
        why: "It is a wake-up rather than a delivery. What actually guarantees the mention is that the message is in the store and the user's unread cursor has not passed it. The badge is right even if every push is dropped.",
        breaks: {
          failure: "Provider outages during a mention storm degrade to an in-app badge.",
          handled: "This is correct precisely because push was never the delivery guarantee, only a best-effort accelerator on top of the store and cursor that actually guarantee the alert.",
        },
      },
    },
    {
      id: "e15",
      from: "gateway",
      to: "messages",
      tier: "data",
      label: "shared channel, cross-shard",
      detail: {
        what: "For a channel homed on another workspace's shard, a lookup against a bridge row (home shard, local name, membership). This is followed by a read or write routed to that home shard's keyspace.",
        why: "The bridge is the third and last deliberate puncture of the tenancy boundary, after the directory and global identity, and it holds no messages. There is still exactly one authoritative log per channel, and it belongs to exactly one tenant.",
        numbers: [
          { value: "20 to 80ms cross-region hop", explain: "The latency cost this bridge lookup adds when the home shard sits in a different region from the visiting one." },
          { value: "~1% of message volume", explain: "700M × 1% ≈ 7M messages/day pay the 20-80ms cross-region cost — small enough that single-homing beats replicating the log to avoid it." },
          { value: "budget under 1s", explain: "The latency ceiling this cross-shard path is held to, generous relative to the 20-80ms typical cost to absorb worst-case conditions." },
          { value: "3 punctures total: directory, identity, shared channels", explain: "The complete list of deliberate exceptions to strict tenant isolation in this design, each one named and bounded rather than accidental." },
        ],
        breaks: {
          failure: "Home shard down means the visiting side cannot read or write.",
          handled: "Reads fall back to the bridge's cached tail and writes return retryable errors; the log is never replicated to work around it, since that risks two logs disagreeing about order.",
        },
        choice: {
          pick: "One home shard per shared channel plus a bridge row on the visiting side",
          instead: "Replicate the channel's message log into both workspaces' shards.",
          decider:
            "Whether two logs may disagree about order. Replication needs a single ordering authority anyway, or concurrent posts, edits and deletes interleave differently with no basis for reconciling. Single-home costs 20 to 80ms on ~1% of volume.",
          flips: "Two organisations in different regulatory regimes each contractually required to hold its own copy, where the honest shape is one side authoritative and the second copy a compliance archive.",
        },
      },
    },
    {
      id: "e17",
      from: "placement",
      to: "messages",
      tier: "data",
      label: "snapshot + tail",
      offset: 190,
      detail: {
        what: "A live move: snapshot the tenant's keyspace to the target shard, then tail the change stream behind it until the lag is under a second.",
        why: "Placement is a forecast, so tenants outgrow their shards and the move has to be routine. The search index moves separately and asynchronously, because search is already seconds behind by design and must not gate the flip.",
        numbers: [
          { value: "tail lag under 1s before the flip", explain: "The freshness bar the change-stream tail must clear before the directory is allowed to flip the tenant to its new shard." },
          { value: "write unavailability 500ms to 2s", explain: "The brief pause the moving tenant experiences at cutover, small enough to be routine maintenance rather than a customer-visible incident." },
        ],
        breaks: {
          failure: "Run it outside the tenant's working hours, which you know because the directory row carries their region.",
          handled: "Doing it blind turns a 2s write pause into a support ticket, so migrations are scheduled against the tenant's own local time.",
        },
      },
    },
    {
      id: "e18",
      from: "placement",
      to: "directory",
      tier: "control",
      label: "flip shard_id at cut-over",
      offset: 60,
      detail: {
        what: "The directory row moved to a migrating state, then to the target shard, which is the moment the tenant actually changes home.",
        why: "The whole migration reduces to one strongly consistent row write because placement is data rather than configuration. Migrating state makes writes on the source fail retryably instead of user-visibly during the drain.",
        numbers: [{ value: "a few thousand directory writes a day", explain: "The write rate this table sees from new workspace creation and migrations combined, tiny compared to any message traffic." }],
        breaks: {
          failure: "Edge nodes refresh on a version counter, so between the flip and the refresh some edges still route to the source shard.",
          handled: "Their writes bounce instead of landing on the wrong shard, a retryable failure that resolves itself as soon as each edge picks up the new directory version.",
        },
      },
    },
  ],
  figures: {
    "thread-write": {
      title: "Write once to the timeline, once to the thread's own partition",
      nodes: [
        { id: "reply", label: "Thread reply", kind: "service", col: 0, row: 0 },
        { id: "timeline", label: "Channel timeline", sub: "4M rows, by message id", kind: "database", col: 0, row: 1 },
        {
          id: "threadtbl",
          label: "(channel, thread_parent)",
          sub: "800 rows, this thread",
          kind: "database",
          col: 1,
          row: 1,
          detail: {
            what: "The second table each reply is written to, partitioned by channel and thread parent.",
            why: "Loading a thread reads only this partition, so an 800-reply thread costs 800 rows regardless of how many messages sit in the surrounding channel.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "reply", to: "timeline", tier: "hot", step: 1, label: "write 1: scroll order" },
        { id: "e2", from: "reply", to: "threadtbl", tier: "hot", step: 2, label: "write 2: thread order" },
      ],
    },
  },
};
