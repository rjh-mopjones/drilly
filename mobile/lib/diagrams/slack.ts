import type { Diagram } from "./types";

export const SLACK: Diagram = {
  id: "slack",
  title: "Slack",
  question: "Design Slack (Workplace Messaging)",
  sourceId: "patterns",
  itemId: 32,
  overview: {
    shape:
      "This is a tenancy problem with a chat front end: the workspace, not the user and not the channel, is the unit of placement, and every box below the edge belongs to exactly one tenant's shard.",
    beats: [
      {
        text: "Resolution happens before anything else. The edge terminates TLS, takes the workspace from the hostname or the token, and looks it up in a 150MB directory it holds entirely in memory. A request that does not resolve to a tenant is rejected there, because a default tenant and a fallback shard are how cross-tenant bugs get in.",
        lights: ["edge", "directory", "e1", "e2"],
      },
      {
        text: "A shard is a named bundle of five things: a gateway pool, a database keyspace, a search index home, an object-store prefix and a key alias. They stay together because every enterprise obligation, delete and retain and hold and re-key and prove residency, is one operation across all five at once rather than a scan of everybody's data.",
        lights: ["shard"],
      },
      {
        text: "Delivery is the standard chat shape and gets one line: the gateway writes to the keyspace, acknowledges only after the write commits, then publishes once to the channel's topic. Every gateway holding a subscriber consumes once and pushes down the sockets it owns, so a 100,000-member #general costs 300 consumes rather than 100,000 pushes.",
        lights: ["gateway", "messages", "topics", "e5", "e6", "e7"],
      },
      {
        text: "Read state is the write load nobody budgets for. In a workplace tool people read roughly ten times more than they write, so unread is tracked as a high-water cursor per user per channel plus a server-side mute flag, which also lets the gateway decline to push at all to people who muted the channel.",
        lights: ["readstate", "e8", "e9"],
      },
      {
        text: "Search is the cost centre and it is where tenancy stops being physical. Five years of history is around 380TB of index, comparable to the message store in bytes and far worse per byte, so the long tail shares indices behind a workspace routing key and only the top two percent get their own.",
        lights: ["indexer", "search", "e10", "e11"],
      },
      {
        text: "Placement is a forecast and forecasts go stale, so moving a live workspace between shards has to be routine maintenance: snapshot the keyspace, tail the change stream, flip the directory row when tail lag is under a second, let clients reconnect from their cursors.",
        lights: ["placement", "directory", "e17", "e18"],
      },
    ],
    crux:
      "The customers are not the same size. The median workspace has 10 daily actives and the largest has 150,000, a 15,000x spread running the same code, and no single placement strategy is right at both ends. Hash tenants across a pool and one tenant swamps its bucket; give every tenant its own bundle and 735,000 small workspaces cost more to run than they pay. So the answer is bimodal on purpose, and the price is a placement problem plus live migration machinery you have to keep exercising.",
    numbers: [
      "750k workspaces, median 10 DAU, largest 150k",
      "380TB search index vs 128TB/year of messages",
      "100k-member channel: 1 publish + 300 consumes",
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
          "~300 gateway boxes across the fleet",
          "tens of thousands of small tenants per shared shard",
          "top 2% get a dedicated shard",
        ],
        breaks:
          "Blast radius is every tenant homed here. A pooled shard incident is a small outage for 20,000 customers; a dedicated shard incident is a total outage for one named account with a contract.",
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
        why: "Holding a cursor rather than a session is what makes every disruption cheap. A deploy, a zone loss or a tenant migration costs one range read per open channel instead of a history resync, which is why dropping sockets is a reconnect event rather than a data event.",
        numbers: ["~40% of DAU connected in their working day", "14M concurrent sockets at global peak"],
        breaks:
          "Without jittered backoff, 14M clients retry inside the same second and the boxes that survived the original fault go down under the reconnects.",
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
        numbers: ["resolution: 0 network hops, a memory lookup", "0 default tenant, 0 fallback shard"],
        breaks:
          "An unresolvable tenant must fail closed. A rise in the resolve error rate usually means directory staleness, and the tempting fix, a fallback shard, is the exact bug the layer exists to prevent.",
        choice: {
          pick: "Resolve the tenant at the edge and home it on a named shard",
          instead: "One pooled fleet with workspace_id as the leading key on every table.",
          decider:
            "How many tenant-scoped operations must be complete and provable. At 750k tenants and 128TB of new messages a year, 'delete this customer within 30 days and attest to it' on a pooled fleet is a full-corpus scan with no way to demonstrate completeness; homed, it is a keyspace drop plus a key destruction, minutes, with an artifact.",
          flips:
            "Tenants within roughly 10x of each other and no customer contracted for residency, key control or attested deletion. Pooling is genuinely better there: higher utilisation, one deploy, no placement to get wrong. The mistake is not starting pooled, it is failing to budget the migration for the first enterprise contract.",
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
        numbers: ["750k rows x ~200B = 150MB", "a few thousand writes a day", "150MB fits in memory on every edge node"],
        breaks:
          "Version skew across edge nodes after a migration flip: some edges route to the old shard and their writes fail retryably until the refresh lands.",
        choice: {
          pick: "Small strongly consistent store, full copy cached at every edge behind a version counter",
          instead: "A directory service the edge calls per request, or sharded routing config baked into deploys.",
          decider:
            "Size against write rate. 750k rows at ~200B is 150MB and takes a few thousand writes a day, so the whole thing fits in memory everywhere and resolution costs nothing. An RPC per request would put a network hop and a hard dependency in front of every single connection.",
          flips:
            "Tens of millions of tenants, where the table no longer fits at the edge and you need a real lookup tier with its own cache and its own failure story.",
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
        why: "This is the noisy-neighbour control. A shard's capacity is shared by 20,000 tenants, so a limit has to be per tenant and applied before the shard or one runaway integration spends a budget belonging to everyone else on the bundle.",
        numbers: ["1,000 msgs/min from a bot is 17/s", "20,000 tenants can share one pooled shard"],
        breaks:
          "17/s is invisible to the bus and severe for the 20,000 humans in the channel, so volume alarms tuned to infrastructure load never fire on the failure that matters.",
        choice: {
          pick: "Token bucket per app per workspace, enforced at the edge",
          instead: "Fleet-wide or per-endpoint rate limits applied inside the shard.",
          decider:
            "Where the cost lands. A bot posting 1,000 messages a minute is 17/s, which no global limit sized for 60k msgs/s peak will ever notice, and which is severe for the tenant it targets. Enforcing after routing also means the shard has already paid for the traffic.",
          flips:
            "Single-tenant deployments, where there are no neighbours to protect and a global limit sized to the box is both simpler and sufficient.",
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
        why: "Stickiness by workspace rather than by user is what keeps a tenant's subscription state concentrated: a shard's gateways collectively hold every subscriber for that shard's channels, so a channel topic only has to reach the gateways in one pool.",
        numbers: ["14M sockets / 100k per box = 140 boxes", "~40KB of socket, TLS and subscription state each", "2x for rolling deploys and zone loss = ~300 boxes"],
        breaks:
          "A rollout that drops a large share of the pool at once: the survivors take the reconnects and fall over. Drain a fixed percentage at a time and never a whole workspace's pool.",
        choice: {
          pick: "Workspace-sticky long-lived gateway pool, one per shard",
          instead: "A globally shared socket tier with a session registry mapping user to box.",
          decider:
            "Whether a socket can reach the wrong tenant. Sticky-by-workspace makes the pool part of the shard bundle, so the 5-part delete and re-key story stays intact, and it keeps fan-out to 300 boxes rather than the whole fleet. A shared tier needs a per-message registry lookup and puts every tenant in one failure domain.",
          flips:
            "A uniform consumer population with no tenant above the others, where a shared tier packs sockets more densely and stickiness only costs you utilisation.",
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
        numbers: ["700M messages/day x 500B = 350GB/day raw", "128TB/year raw, ~385TB replicated", "800-reply thread = one partition read"],
        breaks:
          "A write timeout on the tenant's keyspace. Retry idempotently on the client-supplied message id, and never acknowledge or publish before the write commits.",
        choice: {
          pick: "Wide-column keyspace, channel-partitioned, with a second thread_replies table",
          instead: "One messages table with a thread_parent_id column, filtered at read time.",
          decider:
            "Thread reads. Filtering a channel partition holding 4 million messages to find 800 replies scans all 4 million rows and degrades linearly with channel size forever. The double write is nearly free because both writes hit the same cluster and the same commit log.",
          flips:
            "Channels small enough that a partition scan is bounded, or a product with no threading at all, where the second table is pure write amplification.",
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
        numbers: ["14M sockets x ~8 channels = 112M live subscriptions", "100k-member channel: 1 publish + 300 consumes", "a 300x saving over per-recipient delivery"],
        breaks:
          "A topic stalls and live delivery for that channel stops. Detection is per-topic consumer lag; the recovery is that clients catch up from the store, because the bus was never the record.",
        choice: {
          pick: "A topic per channel, consumed once per gateway holding a subscriber",
          instead: "Per-recipient delivery: look up each member's connection and push to it.",
          decider:
            "Fan-out arithmetic on the biggest channel. 100,000 members spread over 300 gateways is 1 publish plus 300 consumes, against 100,000 individual pushes for the same message. The cost stops scaling with membership and starts scaling with fleet size.",
          flips:
            "Mostly 1:1 conversations, where per-recipient routing through a session registry is simpler and a topic per two-person chat is pure overhead.",
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
        numbers: ["~200 messages read per active user per day", "35M x 200 = 7B views/day, collapsed to a cursor per channel", "~8 open channels per connected user"],
        breaks:
          "The badge is the thing users trust, so a lost or reordered cursor write shows unread counts that do not match the channel, and they notice that faster than they notice a late message.",
        choice: {
          pick: "High-water cursor per (user, channel) plus server-side mute",
          instead: "Per-message read rows, or computing unread on the client from local history.",
          decider:
            "Read volume against write volume. 35M daily actives reading ~200 messages each is 7B views a day, so a row per view is two orders of magnitude more writes than the 700M sends the system exists to carry. A cursor bounds it to one write per channel visit and answers the same question.",
          flips:
            "Products that sell per-message read receipts as a feature, where you owe the sender who has read it and the cursor cannot answer that.",
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
        numbers: ["target index lag under 10s", "1.28T documents over five years"],
        breaks:
          "Indexer lag on one tenant. Backpressure per tenant so one backlog cannot starve others, and note that the lag window is also the window in which a deleted message could still surface in search.",
        choice: {
          pick: "Index from the keyspace change stream",
          instead: "Index from the pub/sub bus alongside the delivery fan-out.",
          decider:
            "Whether a document may be lost. The bus carries only what is being delivered right now and a stalled topic is an accepted degradation, so indexing off it silently loses messages during exactly the incidents you most need history for. Over 700M messages a day the change stream is the record, at the cost of under 10s of lag.",
          flips:
            "Search over a recent window only, where the index is disposable and rebuilding it from the store is cheaper than maintaining a durable consumer.",
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
        numbers: ["~380TB of index over five years", "~50M docs is ~1,370 DAU, the 98th percentile", "~15,000 dedicated indices, 735,000 shared"],
        breaks:
          "One tenant running an unbounded wildcard query competes for the same heap and query threads as thousands of others on a shared index. Per-tenant query budgets, a circuit breaker, and promotion to a dedicated index on query cost rather than document count.",
        choice: {
          pick: "Hybrid: shared indices routed on workspace_id, dedicated above ~50M documents",
          instead: "One index per workspace, so tenancy in search is physical like everywhere else.",
          decider:
            "Shard count against node capacity. A node holds 500 to 1,000 shards before cluster state and heap overhead dominate, so 750,000 workspaces at one shard each is ~1,000 nodes carrying a median of 110MB. A shard is comfortable at ~50M documents, which is a workspace of ~1,370 daily actives.",
          flips:
            "Tenant counts in the thousands rather than the hundreds of thousands, or a customer contracting for physical index separation. A 99% empty shard is affordable at a few thousand tenants and not at 750,000.",
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
        numbers: ["~8% of messages are a DM or a mention", "56M/day, ~1.6k/s busy hour, ~5k/s peak"],
        breaks:
          "Push provider errors during a mention storm. Per-provider retry queue, dedupe on (user id, message id) so a reconnect plus a push is not two alerts, and degrade to an in-app badge.",
        choice: {
          pick: "Consume the persist stream, dedupe on (user id, message id)",
          instead: "Fire notifications from the gateway when a recipient has no live socket.",
          decider:
            "Coverage. 56M notifications a day must reach people who are offline, mid-deploy or mid-migration, and the gateway only knows about the sockets it holds. Deciding from the durable stream makes connectivity irrelevant to whether the alert exists.",
          flips:
            "Presence-driven products where a notification is only meaningful to a connected user, and firing from the gateway saves a whole consumer.",
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
        numbers: ["score: 4 inputs — sockets, msgs/s, index bytes, plan", "write unavailability 500ms to 2s", "flip gated on tail lag under 1s"],
        breaks:
          "Flipping the directory before the tail drains. Gate on tail lag, keep the flip reversible for the length of the window, and make source writes fail retryably rather than be lost.",
        choice: {
          pick: "Weighted-score placement plus online migration: snapshot, tail, flip, reconnect",
          instead: "Static assignment by seat count, with moves done in a maintenance window.",
          decider:
            "The 15,000x spread between the median workspace at 10 daily actives and the largest at 150,000. A seat count does not predict socket load or index bytes, and a workspace that grows from 1,000 to 100,000 seats after an acquisition degrades its 20,000 neighbours first. 500ms to 2s of write unavailability beats a window nobody in a global tenant will agree to.",
          flips:
            "A tenant base small enough that manual placement and an agreed window are realistic, where building and exercising migration machinery costs more than it saves.",
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
      label: "connect, workspace in host",
      detail: {
        what: "The client opening its persistent socket, carrying the workspace in the hostname or the token.",
        why: "The workspace is never a request parameter. A tenant identifier a caller can set is a tenant identifier a caller can change, so it comes from the host or the credential and nowhere else.",
        numbers: ["14M concurrent sockets at global peak"],
        breaks:
          "A reconnect storm arrives here first, which is why admission is token-bucketed on the receiving box: it must accept no faster than it can build subscription state.",
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
        numbers: ["150MB held in full on every edge node"],
        breaks:
          "An unknown tenant must fail closed and a stale directory must serve its last known version, because the alternative defaults are a fallback shard and a cross-tenant read.",
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
        numbers: ["429 with a retry-after when the bucket empties"],
        breaks:
          "An admin needs a way to suspend an app's scopes without uninstalling it, because uninstalling destroys the configuration and admins therefore hesitate to use it mid-incident.",
      },
    },
    {
      id: "e4",
      from: "edge",
      to: "gateway",
      tier: "hot",
      label: "routed to the shard pool",
      detail: {
        what: "The resolved connection handed to a gateway box in this workspace's pool, sticky so a reconnect lands warm.",
        why: "Past this arrow the connection physically cannot reach another tenant's keyspace, index or object-store prefix. That is the property the whole design is buying, and it is why the query predicate is defence in depth rather than the defence.",
        breaks:
          "Stickiness means a box is not interchangeable while it holds sockets, so deploys drain a fixed percentage rather than restarting the pool.",
      },
    },
    {
      id: "e5",
      from: "gateway",
      to: "messages",
      tier: "hot",
      label: "durable write, then ack",
      detail: {
        what: "The send path: write to messages and thread_replies, commit, and only then acknowledge the sender.",
        why: "The tick has to mean the record exists rather than that one process accepted it. Acknowledging first would make the socket the record, and the socket is an accelerator.",
        numbers: ["write p99 under 50ms per shard keyspace", "~60k msgs/s at peak across the fleet"],
        breaks:
          "A timeout here is retried idempotently on the client-supplied message id; retrying without it is how one send becomes two messages.",
      },
    },
    {
      id: "e6",
      from: "gateway",
      to: "topics",
      tier: "hot",
      label: "publish once per message",
      detail: {
        what: "One publish to the channel's topic, after the write commits.",
        why: "Publishing after the commit is what makes the ordering of the two paths a design rule rather than an accident: nothing is delivered that is not already durable, so a crash mid-flight loses delivery and never loses the message.",
        numbers: ["1 publish regardless of channel size"],
        breaks:
          "Publish-before-commit delivers messages that a failed write means never existed, and the clients that received them have no way to learn that.",
      },
    },
    {
      id: "e7",
      from: "topics",
      to: "gateway",
      tier: "hot",
      label: "1 consume per gateway",
      offset: 90,
      detail: {
        what: "Every gateway holding a subscriber to that channel consumes the message once and pushes it down the sockets it owns locally.",
        why: "This is the arrow that makes a 100,000-member channel affordable. Cost scales with the number of gateways in the pool, which is bounded by fleet size, rather than with membership, which is not.",
        numbers: ["300 consumes rather than 100,000 pushes", "112M live subscriptions across the fleet"],
        breaks:
          "It still costs every recipient a wake, a render and a badge update, which is why mute is enforced before the push rather than on the device.",
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
        numbers: ["~200 messages read per active user per day", "~8 open channels per connected user"],
        breaks:
          "Cursors must move monotonically. An out-of-order write walks the badge backwards and resurfaces messages the user has already read.",
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
        why: "Holding mute server-side removes most of the traffic in a busy channel before it leaves the building, and seeding unread at connect time is what makes a reconnect one range read per channel rather than a resync.",
        numbers: ["one range read per open channel on reconnect"],
        breaks:
          "Stale mute state in a gateway's memory keeps pushing to people who muted the channel, and the symptom is a notification complaint rather than an alert.",
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
        why: "Everything that must not be lost hangs off this stream rather than off the bus, so a drained gateway pool or a stalled topic is a delivery event and never an indexing event.",
        numbers: ["index lag target under 10s"],
        breaks:
          "The gap between a delete committing and the index dropping the document is seconds normally and minutes under lag, and during it a search can match deleted content.",
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
        why: "Routing on workspace id means a tenant's query touches one shard rather than all of them, which is what makes sharing an index survivable for the 735,000 workspaces too small to justify their own.",
        numbers: ["~300B indexed per message", "~50M documents per shard"],
        breaks:
          "This is the one path where a tenant filter bug leaks across the boundary, so it needs a live canary planting a document in one tenant and asserting another tenant's search never returns it.",
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
        numbers: ["one point read per hit, ~20 per result page"],
        breaks:
          "Filtering at query time means relevance is scored over documents the user cannot see, so ranking is subtly wrong and deep pagination over-fetches by a factor nobody can predict.",
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
        numbers: ["56M/day, ~1.6k/s busy hour"],
        breaks:
          "Dedupe on (user id, message id) or a reconnect that replays the tail produces a second alert for a message the user has already seen.",
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
        why: "It is a wake-up rather than a delivery. What actually guarantees the mention is that the message is in the store and the user's unread cursor has not passed it, so the badge is right even if every push is dropped.",
        breaks:
          "Provider outages during a mention storm degrade to an in-app badge, which is correct precisely because push was never the delivery guarantee.",
      },
    },
    {
      id: "e15",
      from: "gateway",
      to: "messages",
      tier: "data",
      label: "shared channel, cross-shard",
      detail: {
        what: "For a channel homed on another workspace's shard, a lookup against a bridge row (home shard, local name, membership) followed by a read or write routed to that home shard's keyspace.",
        why: "The bridge is the third and last deliberate puncture of the tenancy boundary, after the directory and global identity, and it holds no messages: there is still exactly one authoritative log per channel, and it belongs to exactly one tenant.",
        numbers: ["20 to 80ms cross-region hop", "~1% of message volume", "budget under 1s", "3 punctures total: directory, identity, shared channels"],
        breaks:
          "Home shard down means the visiting side cannot read or write. Reads fall back to the bridge's cached tail and writes return retryable errors; never replicate the log to work around it.",
        choice: {
          pick: "One home shard per shared channel plus a bridge row on the visiting side",
          instead: "Replicate the channel's message log into both workspaces' shards.",
          decider:
            "Whether two logs may disagree about order. Replication needs a single ordering authority anyway, or concurrent posts, edits and deletes interleave differently with no basis for reconciling. Single-home costs 20 to 80ms on ~1% of volume.",
          flips:
            "Two organisations in different regulatory regimes each contractually required to hold its own copy, where the honest shape is one side authoritative and the second copy a compliance archive.",
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
        numbers: ["tail lag under 1s before the flip", "write unavailability 500ms to 2s"],
        breaks:
          "Run it outside the tenant's working hours, which you know because the directory row carries their region. Doing it blind turns a 2s write pause into a support ticket.",
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
        numbers: ["a few thousand directory writes a day"],
        breaks:
          "Edge nodes refresh on a version counter, so between the flip and the refresh some edges still route to the source shard and their writes bounce.",
      },
    },
  ],
};
