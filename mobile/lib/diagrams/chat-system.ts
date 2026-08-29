import type { Diagram } from "./types";

export const CHAT_SYSTEM: Diagram = {
  id: "chat-system",
  title: "Chat System",
  question: "Design a Chat System (WhatsApp, Messenger)",
  sourceId: "patterns",
  itemId: 9,
  overview: {
    shape:
      "Chat is a store-and-forward system wearing a real-time coat: the durable write is the product, and the socket is a latency optimisation bolted on top of it.",
    forces: [
      {
        constraint: "a push system needs the server able to speak first at any of the ~30M concurrent sessions",
        decision: "Every device holds one long-lived WebSocket to an edge server, making the edge tier stateful and sized in connections",
        lights: ["sender-device", "edge-a", "e3"],
      },
      {
        constraint: "a lost ack followed by a client retry is the common mobile failure, not an exotic one",
        decision: "The persist path checks an idempotency index before assigning an id, so a retry resolves to the original message",
        lights: ["p-idempotency", "e4", "e6"],
      },
      {
        constraint: "the sender's tick has to mean the message exists durably, not that one process accepted it",
        decision: "Quorum write, then ack commits at RF=3 before any acknowledgement is sent, even at ~10ms of the 300ms budget",
        lights: ["p-commit", "e8", "e9"],
      },
      {
        constraint: "1M sockets dropping from one dead edge is up to 1,000,000 reconnects, ~17k/s per surviving box",
        decision: "Clients back off with 0-30s uniform jitter, cutting the reconnect storm to about 570/s per box",
        lights: ["sender-device", "e1"],
      },
      {
        constraint: "a 500-member group can turn one message into 1,000 reverse receipt events",
        decision: "Cursors + receipts collapse to one per-device high-water mark, debounced on 5 seconds",
        lights: ["cursors", "e22", "e24"],
      },
    ],
    naive: {
      text: "Have the edge server holding a socket write the message directly to storage the moment it receives it, then push it straight to the recipient's edge over RPC. A lost ack followed by a client retry is the common mobile failure, not an exotic one. With no idempotency check, a retry becomes a second, permanently distinct message. Losing an edge that holds 1M sockets also means every one of those clients reconnects at once. That is ~17k/s per surviving box at roughly 1ms of TLS handshake CPU each, about 17 cores of pure handshake. The design instead moves persistence into a separate persist path with an idempotency check, and adds jittered client backoff to flatten the reconnect storm.",
      lights: ["persist", "p-idempotency", "sender-device"],
    },
    beats: [
      {
        text: "Every device holds one long-lived TLS connection to an edge server, because a push system needs the server able to speak first. That single decision makes the edge tier stateful, and connection count rather than requests per second becomes the number that sizes the fleet.",
        lights: ["sender-device", "edge-a", "e1", "e3"],
      },
      {
        text: "On send, the edge does not write. It hands the frame to a persist path that checks the idempotency index, assigns a conversation-scoped Snowflake id and does a quorum write. Only then does an ack come back. The tick means stored, never that one process accepted it.",
        lights: ["persist", "p-idempotency", "p-sequencer", "p-commit", "conversation-log", "e4", "e6", "e7", "e8", "e9", "e10"],
      },
      {
        text: "Delivery starts after the commit. The record goes onto a partitioned bus and a routing consumer expands group membership. It then asks the session registry which of 60 edges currently holds each recipient's socket, and republishes onto that edge's partition. That lookup is the whole reason edges never have to know about each other.",
        lights: ["commit-topic", "router", "session-registry", "edge-partitions", "e12", "e13", "e15", "e16"],
      },
      {
        text: "If there is no live socket, nothing special happens, because the message is already durable. A push provider wakes the device, the app reconnects and asks for everything after its cursor. That one mechanism covers crashes, deploys, flaky mobile networks and users offline for months.",
        lights: ["push-service", "recipient-device", "edge-b", "e19", "e21", "e22"],
      },
      {
        text: "Receipts travel back up the same pipe and are the half that actually saturates. A per-device high-water mark, debounced on five seconds, is both the delivery receipt and the sync cursor. A burst of forty messages collapses into one write instead of forty rows.",
        lights: ["cursors", "edge-b", "e22", "e24"],
      },
      {
        text: "The cost of all of it is that connection ownership is now architecture. An edge is not interchangeable while it holds a million sockets, so deploys drain rather than restart, failover needs a reconnect storm plan, and capacity is planned in connections.",
        lights: ["edge-a", "edge-b", "sender-device"],
      },
    ],
    crux: {
      problem:
        "The connection tier is stateful, so losing one box is a fleet event rather than a node event. An edge holding 1M sockets dies, and every client detects it within seconds.",
      handled:
        "17,000 reconnects per second per surviving box, each carrying a ~1ms TLS handshake, is 17 cores of pure handshake on boxes that were already busy. Jittered client backoff is not a polish item. It is what stops one failure taking the fleet, flattening the same herd to roughly 570 reconnects/s per box.",
    },
    numbers: [
      {
        value: "30M concurrent sockets x 16KB = 480GB across 60 boxes",
        explain: "The total connection-state footprint the edge fleet holds in memory at peak, the number that makes connection count the real capacity unit.",
      },
      {
        value: "175k sends/s peak, 435k delivered copies/s peak",
        explain: "The gap between the two is the fan-out: 2.5 recipients per send on average across an 85% 1:1, 15% group traffic mix.",
      },
      {
        value: "p99 300ms end to end, ~80% of it the two mobile radio legs",
        explain: "Most of the delivery budget is spent on network the design does not control, which is why shaving server-side milliseconds barely moves the number.",
      },
    ],
  },
  nodes: [
    // --- frames -------------------------------------------------------------
    {
      id: "durable-path",
      label: "Durable path — commit before ack",
      kind: "zone",
      detail: {
        what: "Everything that must happen before the sender's tick: the idempotency check, id assignment, the quorum write, and the two stores they touch.",
        why: "Every hard problem in this system lives inside this boundary rather than in the socket. What the sender's tick promises, what a device asks for after three weeks away, and what happens to a message written but never pushed are all decided here.",
        numbers: [
          { value: "~10ms quorum write", explain: "The latency this boundary spends buying durability, a small slice of the overall 300ms send budget." },
          { value: "1TB/day raw, 3TB/day at RF=3", explain: "The daily write volume this boundary commits, replicated three ways across availability zones." },
          { value: "175k sends/s at peak", explain: "The peak throughput every stage inside this boundary has to sustain without reordering." },
        ],
        breaks: {
          failure: "Move the ack outside this boundary and the whole delivery contract collapses.",
          handled: "A tick that can be retracted is worse than a slow tick, which is why nothing acknowledges a send before the quorum write has actually committed.",
        },
      },
    },
    {
      id: "persist",
      label: "Persist path",
      kind: "serviceGroup",
      col: 2,
      row: 0,
      parent: "durable-path",
      sub: "idempotency · sequence · commit",
      detail: {
        what: "One deployable that runs three stages in order for every send: check the idempotency index, assign the id, commit at quorum and only then ack.",
        why: "The order is the product, so the three stages live in one process rather than three services. Drawing them as peers would invite an async hop between them. An async hop between 'id assigned' and 'write committed' is exactly the bug the design exists to prevent.",
        numbers: [
          { value: "58k sends/s average, 175k at peak", explain: "The throughput this single deployable is horizontally scaled to sustain." },
          { value: "one extra read plus one quorum write per send", explain: "The total work one send costs this path: an idempotency check and a durable write, nothing more." },
          { value: "0 state carried between requests, so it scales horizontally", explain: "Statelessness at this layer is what lets it scale by adding instances rather than by careful partitioning." },
        ],
        breaks: {
          failure: "It is stateless, so its failure is a retryable error on the client rather than a lost message.",
          handled: "The dangerous failure is a code change that reorders the stages, which is guarded against by keeping all three inside one process rather than as independently deployable services.",
        },
        choice: {
          pick: "One deployable running all three stages (idempotency, sequencer, commit) in one process",
          instead: "Three independently scaled services with a queue or RPC between each stage",
          decider:
            "Whether the ordering invariant can be broken by a deploy. Splitting into three services puts an async hop between 'id assigned' and 'write committed'. A bug or a partial rollout can then let a message get an id with no durable write behind it.",
          flips: "When one stage's load profile genuinely diverges from the others by an order of magnitude or more. Shared fate then starts costing more than the ordering guarantee is worth.",
        },
      },
    },

    // --- connect and send ---------------------------------------------------
    {
      id: "sender-device",
      label: "Sender device",
      sub: "WebSocket + client_msg_id",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "Alice's phone: one long-lived socket, a locally generated client_msg_id per send, and a cursor per conversation.",
        why: "The client is the only place that can make retries safe, because it is the only actor present for every attempt. Exactly-once over a mobile network is not on offer, so idempotency keys and the apply-by-id cursor both have to live on the device.",
        numbers: [
          { value: "one client_msg_id generated before the first attempt", explain: "The key that lets any retry of this same send resolve back to the original message." },
          { value: "one cursor per conversation per device", explain: "The state that lets the device ask for exactly what it is missing after a reconnect." },
          { value: "keepalive ~every 60s to survive carrier NAT rebinding", explain: "How often the client pings the socket to stop a mobile carrier's NAT table from silently dropping the mapping." },
        ],
        breaks: {
          failure: "Without jittered backoff a million of these reconnect inside a second after an edge dies.",
          handled: "The client is the only place that fix can be applied, so reconnect backoff is client logic rather than something the server can enforce after the fact.",
        },
        choice: {
          pick: "Client-generated client_msg_id, plus jittered reconnect backoff of 0 to 30 seconds uniform",
          instead: "Server-assigned ids only, and reconnecting immediately on drop",
          decider:
            "1M dropped sockets reconnecting inside a second is 17k/s per surviving box at ~1ms of TLS handshake CPU each, so 17 cores of handshake. Uniform 0 to 30s jitter flattens the same million to 570/s per box, about 0.6 of a core.",
          flips: "Small fleets where losing a node drops thousands rather than millions of sockets, and the thundering herd fits inside spare capacity.",
        },
      },
    },
    {
      id: "edge-a",
      label: "Edge server A",
      kind: "service",
      col: 1,
      row: 0,
      sub: "sticky WebSocket, presence pub/sub",
      detail: {
        what: "The box holding Alice's socket, terminating TLS, framing the protocol, and handing sends to the persist path while also running the ephemeral presence and typing fan-out.",
        why: "HTTP is request-response and closes; a chat server has to push at any moment without being asked, so the connection stays open for the life of the app session. Sub-second delivery is bought with a stateful tier, and that is the trade. Presence rides the same socket but must never touch the durable path, because it is worthless the moment it is stale.",
        numbers: [
          { value: "1M sockets per box planned, 2M demonstrated by WhatsApp in 2012", explain: "The per-box connection ceiling this fleet is planned against, with headroom below a demonstrated real-world figure." },
          { value: "16KB per tuned socket, 16GB of connection state on a 128GB box", explain: "How much of a box's memory holding a million sockets actually consumes." },
          { value: "60 boxes for 30M peak sockets, 2x for deploys and a lost AZ", explain: "The fleet size, doubled over the bare peak requirement to absorb a rolling deploy or a zone failure." },
          { value: "presence: TTL 30s, ~1M heartbeat events/s fleet-wide", explain: "30M sockets / 30s TTL ≈ 1M/s; at ~6x the 175k/s message write rate, this would swamp the durable path if it touched it." },
        ],
        breaks: {
          failure: "An edge is not interchangeable while it holds sockets, so a rolling deploy has to drain over ~5 minutes rather than restart.",
          handled: "A restart instead of a drain is a self-inflicted reconnect storm. Lost presence shows a stale 'online' dot for up to one TTL, wrong but harmless rather than blocking a message.",
        },
        choice: {
          pick: "One long-lived TLS connection per device on an event-loop runtime (Go goroutines or Erlang's BEAM)",
          instead: "Long polling: an ordinary HTTP request held open for up to 30 seconds, plus a separate POST for upstream sends",
          decider:
            "Concurrent connection count. Long polling occupies the same socket and the same 480GB, then adds a second connection upstream and a re-establishment every 30 seconds: 30M / 30 = 1M setups/s fleet-wide.",
          flips: "Around 100k concurrent, where the same formula gives 3.3k setups/s fleet-wide and plain HTTP wins on operational simplicity. Long polling still ships as a day-one fallback for proxies that strip the Upgrade header.",
        },
      },
    },

    // --- persist path stages ------------------------------------------------
    {
      id: "p-idempotency",
      label: "Idempotency check",
      kind: "process",
      col: 2,
      row: 0,
      parent: "persist",
      sub: "conditional on client_msg_id",
      detail: {
        what: "The first stage of every send: look up (chat_id, client_msg_id) and, on a hit, return the msg_id already assigned instead of continuing.",
        why: "The common mobile failure is a lost ack followed by a client retry, not an exotic one. This is the only point where a retry can still be turned back into the same message. After the next stage it has an id, and after the one following it has been delivered.",
        numbers: [
          { value: "one extra read on every send, including the majority that are not retries", explain: "The fixed cost this check adds to every send, paid even when there is nothing to deduplicate." },
          { value: "24h window, covering the client's retry horizon", explain: "How long the idempotency key stays valid, long enough to cover any realistic retry delay." },
          { value: "on a hit: 0 ids, 0 writes, 0 bus records", explain: "What a detected retry actually costs downstream: nothing, because it never proceeds past this stage." },
        ],
        breaks: {
          failure: "Skip it and a lost ack produces two genuinely distinct messages.",
          handled: "No downstream dedupe can repair that. By the time anyone notices, both have valid ids and both have been delivered, which is why the check runs before an id is ever assigned.",
        },
        choice: {
          pick: "A conditional check before id assignment, returning the prior ack on a hit",
          instead: "Letting both writes land and de-duplicating at delivery or on the client",
          decider:
            "Where the duplicate is still reversible. Before an id exists it is one row; after, it is two valid messages in two clients' render order, and nothing can merge them. The cost of getting it right is one read on 5B sends/day.",
          flips: "Never for user-visible messages. It flips only for genuinely idempotent side-effect-free traffic, such as presence, where a duplicate is invisible.",
        },
      },
    },
    {
      id: "p-sequencer",
      label: "Snowflake sequencer",
      sub: "conversation-scoped msg_id",
      kind: "process",
      col: 2,
      row: 1,
      parent: "persist",
      detail: {
        what: "Assigns a monotonic msg_id scoped to the conversation, before the record reaches the store or the bus.",
        why: "Ordering and durability come from the same component so that every recipient renders the same sequence regardless of which edge delivered their copy or how the bus interleaved things. Assigning the id here, and not at the edge, is what makes that true across 60 edges.",
        numbers: [
          { value: "one monotonic sequence per chat_id, not global", explain: "Ordering is scoped to a conversation, avoiding a single global sequencer that every send would contend on." },
          { value: "64-bit id: timestamp, chat shard, sequence", explain: "The composition of the id itself, encoding both rough time and strict per-conversation order." },
          { value: "1 id doubles as the clustering key in the conversation log", explain: "The same id that orders the message also determines its storage position, avoiding a second sort at read time." },
        ],
        breaks: {
          failure: "Two devices of the same user sending concurrently get their ids in the order the persist path happened to see them.",
          handled: "That may not be the order the human experienced, and it is accepted rather than solved, since resolving it would need a stronger, slower ordering guarantee for a rare case.",
        },
        choice: {
          pick: "Conversation-scoped Snowflake ids assigned on the write path",
          instead: "Client timestamps for ordering, or a global per-user sequencer",
          decider:
            "Phone clocks can drift by 10+ seconds, so client timestamps cannot order a conversation at all. A global order needs a per-user sequencer, a write bottleneck on exactly the most active users.",
          flips: "Products where a user's whole timeline must be totally ordered, a unified inbox across conversations, which is where you pay for the per-user sequencer deliberately.",
        },
      },
    },
    {
      id: "conversation-log",
      label: "Conversation log",
      kind: "database",
      col: 3,
      row: 0,
      parent: "durable-path",
      sub: "Cassandra, (chat_id, bucket)",
      detail: {
        what: "The durable store, partitioned by (chat_id, time_bucket) and clustered by msg_id, so one read returns a conversation in send order. Media never lands here; the row carries a 32B blob reference.",
        why: "This is the product; everything else is delivery. One shared log per conversation means one write per message rather than one per member, which is what stops a 1,024-member room turning a single send into 1,024 writes.",
        numbers: [
          { value: "1TB/day raw, 3TB/day at RF=3 across AZs", explain: "The total write volume this store absorbs daily, replicated for durability." },
          { value: "30-day hot retention: 30TB raw, 90TB replicated on SSD", explain: "How much of that volume stays on fast storage before falling through to a cheaper tier." },
          { value: "partitions kept under ~100MB; ~200B per row", explain: "The sizing target that keeps a single hot partition from growing without bound." },
        ],
        breaks: {
          failure: "A hot room grows one partition without bound.",
          handled: "The key carries a time bucket, (chat_id, day) for busy rooms and (chat_id, year) for a two-person chat, to keep partitions bounded regardless of a room's activity level.",
        },
        choice: {
          pick: "One shared log per conversation plus a per-device cursor",
          instead: "Fan out a row into every recipient's own inbox partition at send time",
          decider:
            "The tail of the group size distribution, not the mean. Mean amplification is 2.5, so fan-out is affordable at 12.5B inbox writes/day. One 100k-member room at 10 messages/minute is 16k writes/s from a single conversation under the alternative.",
          flips: "Hard-capped small groups where read latency is the SLO. At a 100-member cap the amplification is bounded and a client's unread set is one sequential scan, which matters when a user is in 200 conversations.",
        },
      },
    },
    {
      id: "p-commit",
      label: "Quorum write, then ack",
      kind: "process",
      col: 2,
      row: 2,
      parent: "persist",
      sub: "RF=3 across AZs, ~10ms",
      detail: {
        what: "The stage that commits the record at quorum and, only afterwards, emits the ack carrying the assigned msg_id.",
        why: "The sender's tick has to mean the message exists durably, not that one server process accepted it. This ordering, not its speed, is the delivery contract, and keeping it inside one process is what makes it an enforced invariant.",
        numbers: [
          { value: "~10ms for the quorum write out of a 300ms p99 budget", explain: "How much of the overall latency budget durability actually costs." },
          { value: "RF=3 across availability zones", explain: "The replication factor this write commits at before anything is acknowledged." },
          { value: "3-step order: commit, then ack, then bus publish", explain: "The strict sequence that makes the tick trustworthy and the delivery pipeline safe to start." },
        ],
        breaks: {
          failure: "A stalled quorum surfaces to the client as a retryable failure.",
          handled: "That is the right answer, since no tick beats a wrong tick, and a retry is cheap compared to a message that silently never existed.",
        },
        choice: {
          pick: "Quorum write, then ack, then publish",
          instead: "Ack from the edge on receipt and write asynchronously",
          decider:
            "Acking first shaves 10ms off a 300ms budget where 60 to 120ms is mobile radio on each leg, so the saving is invisible to the user. What it buys instead is a retractable tick: a crash in that 10ms window turns a delivered tick into a message that never existed.",
          flips: "Systems where the message is a hint rather than a record, such as presence or typing, where losing one after acking it costs nothing.",
        },
      },
    },

    // --- routing ------------------------------------------------------------
    {
      id: "commit-topic",
      kind: "queue",
      col: 2,
      row: 1,
      sub: "Kafka, partitioned by chat_id",
      label: "Committed messages",
      detail: {
        what: "The durable log of committed records, partitioned by chat_id so one conversation's records stay in order, consumed by the routing tier.",
        why: "Delivery starts only after durability is settled, so this topic carries records that are already safe. That is what makes the offline branch free: when a recipient turns out to be unreachable there is nothing left to make durable.",
        numbers: [
          { value: "175k records/s at peak, one per send", explain: "The rate committed messages flow off the durable path into routing." },
          { value: "~5ms hop inside the 300ms budget", explain: "The added latency of this bus hop, small against the overall delivery target." },
          { value: "~24h retention, sized for a restart, not for history", explain: "Retention is tuned for consumer recovery, not for serving as a system of record." },
        ],
        breaks: {
          failure: "If the bus is unavailable the message is still stored and still arrives on reconnect.",
          handled: "The incident becomes delivery latency rather than data loss, since the conversation log already holds the message regardless of routing's health.",
        },
        choice: {
          pick: "A replayable log between the write path and routing",
          instead: "Calling the routing tier synchronously from the persist path",
          decider:
            "What happens on a routing failure. A synchronous call makes routing's availability part of the 300ms send SLO, and a dropped call loses the delivery with no way to rewind. A log lets a restarted consumer resume from its offset instead.",
          flips: "Deployments small enough that routing is a library call inside the persist process, where a broker is pure operational cost.",
        },
      },
    },
    {
      id: "router",
      label: "Routing consumer",
      kind: "service",
      col: 2,
      row: 2,
      sub: "membership + registry lookup",
      detail: {
        what: "Consumes committed records, expands group membership, looks each recipient up in the session registry, and republishes onto the owning edge's partition or hands the copy to the push service.",
        why: "The registry lookup is the interesting hop: it is the only thing that knows which of 60 boxes currently holds Bob's socket. Keeping the expansion in a consumer tier rather than at the sending edge keeps fan-out off the sender's latency path entirely.",
        numbers: [
          { value: "2.5 recipients per send on an 85% 1:1, 15% group mix", explain: "The average fan-out factor between sends and delivered copies." },
          { value: "435k delivered copies/s at peak", explain: "The output rate this consumer produces after expanding group membership." },
          { value: "~45% of copies find no live socket", explain: "How often a delivered copy falls through to the offline branch instead of a live socket." },
        ],
        breaks: {
          failure: "A stale registry entry routes at a dead edge.",
          handled: "That is a latency bug rather than a correctness one, because the copy falls through to push and the cursor is the backstop that eventually delivers it.",
        },
        choice: {
          pick: "A routing consumer group that resolves membership, then reads the registry",
          instead: "Fanning out at the sending edge, before the bus",
          decider:
            "Where the amplification lands. Recipients per send average 2.5 but the cap is 1,024, so doing it at the edge puts a 1,024-way expansion on a socket thread simultaneously holding a million other connections.",
          flips: "1:1 only, where routing is a single registry lookup with no membership resolution on the hot path and a separate consumer tier earns nothing.",
        },
      },
    },
    {
      id: "session-registry",
      label: "Session registry",
      kind: "cache",
      col: 3,
      row: 1,
      sub: "Redis, user → edge, TTL 60s",
      detail: {
        what: "An in-memory map user_id to [edge_id], written by the edge on connect with a 60-second TTL and refreshed by heartbeat every 30 seconds.",
        why: "Routing needs to know which of 60 boxes holds Bob's socket, and that answer changes every time a phone changes network. It sits deliberately off the write path, so a stale entry costs a round trip through push rather than a lost message.",
        numbers: [
          { value: "100M entries x ~80B = 8GB", explain: "Smaller than one edge box's own 16GB of socket state; replicating it 3x over is still cheap next to a single box's sockets." },
          { value: "TTL 60s, heartbeat every 30s", explain: "The freshness contract: an entry is refreshed twice within its own expiry window, so it rarely lapses while the socket is alive." },
          { value: "one in-memory shard, replicated 3x", explain: "The store's own resilience, kept simple because every entry can be regenerated on the next connect anyway." },
        ],
        breaks: {
          failure: "If an edge dies without expiring its entries, routing keeps aiming at a dead box for up to 60 seconds.",
          handled: "The TTL is the only cleanup, which is why it is kept short, trading a little staleness risk for a bounded worst case.",
        },
        choice: {
          pick: "Redis, SET user:{bob} edge_B EX 60, refreshed on heartbeat",
          instead: "A replicated database table, or gossip between edges",
          decider:
            "Durability buys nothing here, because the truth is rewritten on every reconnect and every entry is wrong within 60 seconds of a phone changing network. A database write per connect and heartbeat is 30M writes every 30 seconds for data that expires anyway.",
          flips: "Small fleets where the whole map fits in each edge's memory and gossip is cheaper than running another service.",
        },
      },
    },
    {
      id: "edge-partitions",
      kind: "queue",
      col: 1,
      row: 2,
      sub: "Kafka, one partition per edge",
      label: "Per-edge partitions",
      detail: {
        what: "The routed output: one partition per edge, each consumed only by the edge that owns it, carrying the copies destined for the sockets that edge holds.",
        why: "An edge subscribes rather than being addressed. That is what removes the mesh: no edge needs to know any other edge exists, and a rolling deploy can move sockets around without anyone recomputing a topology.",
        numbers: [
          { value: "60 partitions for 60 edges", explain: "One partition per edge, a direct mapping that needs no separate routing table to maintain." },
          { value: "435k delivered copies/s at peak", explain: "The total throughput spread across all 60 partitions combined." },
          { value: "one partition replayed per restarted edge, from its own offset", explain: "How a restarted edge recovers: by resuming exactly where it left off, not by asking anyone to resend." },
        ],
        breaks: {
          failure: "A lagging partition delays every recipient on one edge while the rest of the fleet looks healthy.",
          handled: "Consumer lag per partition is the metric that catches it before any user does, since fleet-wide averages would hide a single stuck edge.",
        },
        choice: {
          pick: "One partition per edge, consumed by the edge that owns it",
          instead: "Direct RPC from the routing tier to the recipient's edge",
          decider:
            "Deploy behaviour and replay. With 60 edges rolling continuously, direct calls need every caller tracking every edge's liveness, and a dropped call loses a delivery with no way to rewind.",
          flips: "A single-edge deployment, where there is no cross-edge hop at all and a broker is pure operational cost.",
        },
      },
    },

    // --- offline branch -----------------------------------------------------
    {
      id: "push-service",
      label: "Push service",
      kind: "service",
      col: 0,
      row: 2,
      sub: "coalesce 30s, APNs / FCM",
      detail: {
        what: "Ours, not the platform's. Takes the copies that found no live socket, coalesces them per device on a 30-second floor, de-duplicates on msg_id, holds the device tokens, and calls the mobile push providers.",
        why: "Without this box the offline branch would send one provider call per delivered copy into services we do not control and that rate-limit us. It is also the only place that can turn a phone asleep for eight hours into one buzz instead of forty.",
        numbers: [
          { value: "5.6B push-eligible events/day in, ~2.2B/day out", explain: "The reduction coalescing achieves before any call ever reaches a provider." },
          { value: "coalescing removes ~60% on this traffic mix", explain: "The measured savings this component delivers against a naive one-call-per-copy design." },
          { value: "26k/s average, ~78k/s peak to the providers", explain: "The real call rate the providers actually see, well below the raw event rate." },
        ],
        breaks: {
          failure: "Its own failure is invisible from the message path: everything is already durable and every message still arrives on reconnect.",
          handled: "Nothing alerts except a push send rate that quietly falls to zero while offline users go silent, which is why that rate is monitored as its own signal.",
        },
        choice: {
          pick: "Coalesce per device on a 30-second floor and dedupe on msg_id before calling the provider",
          instead: "One provider call per delivered copy, with per-message delivery tracking",
          decider:
            "5.6B push-eligible events/day against ~2.2B after coalescing, so 60% of the provider calls are removed for a 30-second worst-case delay on a path that is already best-effort.",
          flips: "Only where there is no durable store behind the notification, so the payload genuinely is the message rather than a hint to reconnect.",
        },
      },
    },

    // --- receive ------------------------------------------------------------
    {
      id: "edge-b",
      label: "Edge server B",
      kind: "service",
      col: 1,
      row: 3,
      sub: "holds the socket, coalesced reads",
      detail: {
        what: "The edge that currently owns the recipient's socket. Consumes its partition, pushes the receive frame, claims the registry entry, records receipts and serves the reconnect catch-up.",
        why: "One mechanism covers crashes, deploys, flaky mobile networks and months offline: the client presents its cursors and this box streams everything after them. That backstop is precisely what lets the fast path be lossy.",
        numbers: [
          { value: "resync marker above ~500 messages or 7 days of gap", explain: "The threshold at which the reconnect path stops streaming a full backlog and jumps the cursor instead." },
          { value: "drain mode closes sockets over ~5 minutes", explain: "How a deploy retires this box's connections gracefully rather than dropping them all at once." },
          { value: "registry entry written on connect, TTL 60s", explain: "The self-healing ownership record this edge claims the moment it accepts a socket." },
        ],
        breaks: {
          failure: "This is the box whose death is the design problem.",
          handled: "1M sockets drop, and without client jitter that is 17k reconnects/s per surviving box at ~1ms of TLS handshake each. Jittered backoff on the device exists precisely to flatten that.",
        },
        choice: {
          pick: "A server-side resync marker once the gap exceeds ~500 messages or 7 days",
          instead: "Always streaming the full backlog from the cursor",
          decider:
            "A device back after three months in a busy group would take tens of thousands of messages down a socket that times out mid-stream. It would then retry from the same cursor and fail identically, so the marker jumps the cursor forward instead.",
          flips: "Low-volume conversations where the worst backlog is a few hundred messages, and full streaming is always cheaper than maintaining a second code path.",
        },
      },
    },
    {
      id: "recipient-device",
      label: "Recipient device",
      kind: "client",
      col: 0,
      row: 3,
      sub: "applies by msg_id, cursor",
      detail: {
        what: "Bob's phone. Applies each frame by msg_id with an upsert, advances its per-conversation cursor, and emits receipts up the same socket.",
        why: "At-least-once is all the transport offers, so the idempotent apply has to live here. The cursor is simultaneously the sync state and the delivered receipt, which is why those are one write rather than two.",
        numbers: [
          { value: "~5,000 messages and ~1MB of text per user per 30 days", explain: "A typical user's monthly message volume, the scale the client's local storage is sized against." },
          { value: "receipts debounced on a 5-second window", explain: "How often the client actually sends its receipt update rather than one per message." },
          { value: "one cursor per conversation per device", explain: "The per-device state that lets each of a user's devices track its own catch-up position independently." },
        ],
        breaks: {
          failure: "Delivered is a per-device fact, read is the maximum over a user's devices.",
          handled: "Getting that backwards is the familiar bug where reading on a laptop leaves the phone badged forever, so the two are computed with deliberately different aggregation.",
        },
        choice: {
          pick: "Apply by msg_id with an upsert, accepting at-least-once delivery",
          instead: "Chasing exactly-once at the transport",
          decider:
            "The socket can die after the server writes a frame and before the client applies it, and neither side can distinguish that from the frame never arriving. Any protocol claiming exactly-once is doing at-least-once with a dedupe you have not been told about.",
          flips: "Never over a mobile network. Exactly-once needs a single transaction boundary spanning both parties, which a phone on a train is not.",
        },
      },
    },
    {
      id: "cursors",
      label: "Cursors + receipts",
      kind: "database",
      col: 2,
      row: 3,
      sub: "(chat_id, device) → applied_id",
      detail: {
        what: "One high-water mark per device per conversation, doubling as the delivery receipt and the catch-up state. Read receipts are the maximum over a user's devices; delivered is per device.",
        why: "A receipt is a message travelling the other way, and the reverse channel is where the arithmetic goes wrong. A high-water mark collapses a burst of 40 messages into one update, and it happens to be the same row the reconnect path already reads.",
        numbers: [
          { value: "500-member group: 500 delivered plus 500 read events per message, 1,000x amplification", explain: "What a naive per-message receipt design would cost in a large group, the number this collapsed design avoids." },
          { value: "5-second debounce per conversation per device", explain: "The window receipts are batched over before a single update is written." },
          { value: "aggregate counts rather than per-member lists above ~50 members", explain: "Above a size threshold the UI shows a count instead of a full read-by list, keeping the payload bounded." },
        ],
        breaks: {
          failure: "Receipt storms are what saturate first in production, well before the forward path does.",
          handled: "Three mitigations compose here, the high-water mark, the debounce and the aggregate count, and all three are needed to keep this path from becoming the bottleneck.",
        },
        choice: {
          pick: "A per-device high-water mark that is also the sync cursor",
          instead: "One receipt row per message per recipient",
          decider:
            "Amplification. A row per message in a 500-member group is up to 1,000 reverse events per forward message. A high-water mark is one row per device per conversation instead, regardless of message rate.",
          flips: "Very small conversations where per-message read state is a product feature, for example showing exactly who read which message in a five-person thread.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      to: "edge-a",
      tier: "control",
      label: "socket attach + resume",
      from: "sender-device",
      detail: {
        what: "The connect-time handshake: TLS termination, JWT authentication, and, on a reconnect, presenting cursors so the socket resumes the existing session rather than starting cold.",
        why: "An anycast layer in front of the fleet picks which edge answers the connection. Placement happens once per socket rather than once per message, because a stateful tier cannot be balanced per request.",
        numbers: [
          { value: "one round trip per socket, not per message", explain: "The one-time cost of establishing a session, amortised over every send that follows it." },
          { value: "one JWT presented at the handshake, not on every frame", explain: "Authentication happens once per connection rather than being re-verified on every message." },
        ],
        breaks: {
          failure: "This is the request a million clients make simultaneously after an edge dies.",
          handled: "The answer can be a Retry-After rather than an address, letting jittered client backoff spread the reconnect load instead of the server trying to schedule it.",
        },
      },
    },
    {
      id: "e3",
      from: "sender-device",
      to: "edge-a",
      tier: "hot",
      step: 1,
      label: "WebSocket",
      detail: {
        what: "One long-lived TLS connection carrying sends, cursors, presence and typing in both directions.",
        why: "The server has to be able to speak first, which request-response cannot do. Opening a connection per message would also pay a handshake per message on a network where the handshake is the expensive part.",
        numbers: [
          { value: "16KB of tuned state per socket", explain: "The memory footprint each open connection costs the edge holding it." },
          { value: "keepalive ~every 60s to survive carrier NAT rebinding", explain: "The interval that keeps the connection alive through mobile network address translation changes." },
        ],
        breaks: {
          failure: "Corporate proxies that strip the Upgrade header and captive portals that kill idle connections cost a low single-digit percentage of sessions.",
          handled: "Long polling ships as a fallback on day one specifically for that minority of sessions, so they still get service even without a real WebSocket.",
        },
      },
    },
    {
      id: "e4",
      from: "edge-a",
      to: "p-idempotency",
      tier: "hot",
      step: 2,
      label: "send + client_msg_id",
      detail: {
        what: "The send frame handed off the socket to the persist path, carrying the client-generated idempotency key.",
        why: "The edge deliberately does not write. Keeping persistence in one component is what makes commit-before-ack an enforced invariant rather than a convention every edge is trusted to honour.",
        numbers: [
          { value: "175k/s at peak", explain: "The rate this hop carries sends off the socket layer into the durable path." },
          { value: "~200B on the wire", explain: "The typical size of a send frame, small enough to add negligible overhead to this hop." },
        ],
        breaks: {
          failure: "If the edge acks here instead of waiting for the commit, a crash in the next 10ms turns a delivered tick into a message that never existed.",
          handled: "That is exactly why the edge never acknowledges anything itself, only ever forwarding the ack it later receives from the persist path.",
        },
      },
    },
    {
      id: "e6",
      from: "p-idempotency",
      to: "p-sequencer",
      tier: "data",
      label: "not seen before",
      detail: {
        what: "The in-process hand-off to id assignment, taken only when the idempotency check missed.",
        why: "A hit short-circuits here and returns the original ack, so a retry never reaches the sequencer and never produces a second id. That is the whole point of putting the check first.",
        breaks: {
          failure: "Reorder these two stages and every retry gets a fresh id before anything can notice it is a retry.",
          handled: "That reordering is prevented by keeping both stages inside the same process, where the sequence of calls is a code path rather than a convention across services.",
        },
      },
    },
    {
      id: "e7",
      from: "p-sequencer",
      to: "p-commit",
      tier: "data",
      label: "msg_id assigned",
      detail: {
        what: "The record, now carrying its conversation-scoped monotonic id, handed to the commit stage.",
        why: "The id exists before the write so that the store can cluster on it and the bus can carry it. Assigning it after the write would mean a second write to attach it.",
        numbers: [{ value: "one monotonic sequence within chat_id", explain: "The ordering guarantee this id carries forward into storage and delivery." }],
        breaks: {
          failure: "This hand-off is in-process on purpose.",
          handled: "An async hop here would allow a gap where an id exists for a message that was never committed, which is exactly what keeping it in-process prevents.",
        },
      },
    },
    {
      id: "e8",
      from: "p-commit",
      to: "conversation-log",
      tier: "data",
      label: "quorum write",
      detail: {
        what: "The write that must commit before anything acknowledges the sender.",
        why: "The quorum matters as much as the write. A single-replica acknowledgement means a node loss silently deletes acked messages, and the symptom is a conversation where one side sees a message the other never will.",
        numbers: [
          { value: "~10ms", explain: "The latency this quorum write typically takes, a small fraction of the overall send budget." },
          { value: "RF=3 across AZs", explain: "The replication level this write commits at before anyone is told it succeeded." },
          { value: "58k writes/s average, 175k at peak", explain: "The throughput this store absorbs from the write path." },
        ],
        breaks: {
          failure: "A stalled quorum surfaces to the client as a retryable failure.",
          handled: "That is the right answer, since no tick beats a wrong tick, and the client already knows how to retry a send safely.",
        },
      },
    },
    {
      id: "e9",
      from: "p-commit",
      to: "edge-a",
      tier: "control",
      label: "ack, after commit",
      offset: 90,
      detail: {
        what: "The acknowledgement carrying the assigned server msg_id, emitted only once the quorum write has committed.",
        why: "This is the invariant the whole design exists to defend. The ordering of these two operations, not their speed, is the delivery contract: the tick means stored, never that one process accepted it.",
        numbers: [{ value: "one strict order: commit before ack", explain: "The single rule this hop enforces, never relaxed for latency." }],
        breaks: {
          failure: "Reversing the order shaves 10ms off a 300ms budget and makes every tick retractable.",
          handled: "That trade is refused, since a retractable tick is a worse product than a slightly slower one, and the 10ms is a small share of the overall latency.",
        },
      },
    },
    {
      id: "e10",
      from: "edge-a",
      to: "sender-device",
      tier: "control",
      label: "one tick",
      offset: 40,
      detail: {
        what: "The ack forwarded down the socket, rendering as the sender's first tick.",
        why: "Three independent facts travel back to a sender, stored, reached a device, a human looked, each produced by a different actor and each losable on its own. Conflating any two of them is the classic failure.",
        breaks: {
          failure: "If the socket died between commit and this frame, the client sees no tick at all.",
          handled: "The client simply retries with the same client_msg_id, which resolves to the original message rather than a duplicate.",
        },
      },
    },
    {
      id: "e12",
      from: "p-commit",
      to: "commit-topic",
      tier: "hot",
      step: 3,
      label: "committed record",
      detail: {
        what: "The committed record published for routing, once the id exists and the write has landed.",
        why: "Delivery only starts after durability is settled, which is what makes the offline branch free: when the recipient turns out to be unreachable there is nothing left to make durable.",
        numbers: [{ value: "175k records/s at peak", explain: "The pre-fanout rate; e13's consumer group turns this into 435k copies/s downstream, ~2.5x from average chat membership." }],
        breaks: {
          failure: "If the bus is unavailable the message is still stored and still arrives on reconnect.",
          handled: "The incident is delivery latency rather than data loss, since durability was already settled before this publish was even attempted.",
        },
      },
    },
    {
      id: "e13",
      from: "commit-topic",
      to: "router",
      tier: "hot",
      step: 4,
      label: "consumer group, by chat_id",
      detail: {
        what: "Routing consumers reading committed records off their partitions.",
        why: "A consumer group lets routing scale independently of both the edge tier and the write path. A restarted consumer rewinds to its offset rather than losing whatever was in flight.",
        numbers: [
          { value: "~5ms hop", explain: "The added latency of this consume step, a small slice of the delivery path." },
          { value: "175k records/s in, 435k copies/s out", explain: "The fan-out this stage performs by expanding group membership." },
        ],
        breaks: {
          failure: "Consumer lag per partition is the metric that shows routing falling behind before any user notices anything.",
          handled: "That lag is alerted on directly, per partition, since a healthy-looking fleet average would otherwise hide one struggling partition until users notice missed messages.",
        },
      },
    },
    {
      id: "e15",
      from: "router",
      to: "session-registry",
      tier: "control",
      label: "which edge holds Bob?",
      detail: {
        what: "The routing lookup: user_id to the edge currently holding that user's socket.",
        why: "This is the hop that makes cross-edge delivery possible without any edge knowing about any other. It is a cache read on the delivery path and deliberately not on the write path, so its staleness can never cost a message.",
        numbers: [
          { value: "8GB of entries", explain: "Small enough to be a pure memory lookup, not a round trip to a bigger store — why this hop barely dents the 300ms delivery budget." },
          { value: "TTL 60s", explain: "How stale an answer from this lookup can be before it is guaranteed to expire." },
          { value: "435k lookups/s at peak", explain: "Matches e13's 435k copies/s exactly — one lookup per delivered copy, so group chats multiply registry load, not commit-topic load." },
        ],
        breaks: {
          failure: "A stale answer routes at a dead edge.",
          handled: "Nothing is lost: the recipient falls through to push and asks for everything after their cursor when they return.",
        },
      },
    },
    {
      id: "e16",
      from: "router",
      to: "edge-partitions",
      tier: "hot",
      step: 5,
      label: "publish to owning partition",
      detail: {
        what: "The routed copy written onto the partition belonging to the edge that holds the recipient's socket.",
        why: "Addressing an edge by partition rather than by RPC is what lets the edge subscribe instead of being called. A rolling deploy can then move sockets around without anyone maintaining a topology.",
        numbers: [
          { value: "60 partitions", explain: "One per edge, the entire addressing scheme this hop relies on." },
          { value: "435k copies/s at peak", explain: "The total throughput spread across those 60 partitions." },
        ],
        breaks: {
          failure: "If the recipient reconnects to a different edge mid-flight, the copy lands on the old edge's partition and is dropped.",
          handled: "Cursor replay covers it: the recipient's new edge streams everything after its last applied id once it reconnects.",
        },
      },
    },
    {
      id: "e17",
      from: "edge-partitions",
      to: "edge-b",
      tier: "hot",
      step: 6,
      label: "edge consumes its own",
      detail: {
        what: "The recipient's edge consuming the partition it owns.",
        why: "One consumer per partition means an edge only ever sees traffic for sockets it actually holds. A restarted edge replays from its own offset rather than asking anyone to resend.",
        numbers: [
          { value: "one partition per edge", explain: "The direct one-to-one mapping that removes any need for cross-edge coordination." },
          { value: "one alert per lagging partition", explain: "How consumer lag on this hop is surfaced, per partition rather than as a fleet average." },
        ],
        breaks: {
          failure: "A lagging partition delays every recipient on one edge while the rest of the fleet looks healthy.",
          handled: "Durability is untouched, because the message committed before it ever got here, so the worst outcome of this failure is latency, not loss.",
        },
      },
    },
    {
      id: "e18",
      from: "edge-b",
      to: "recipient-device",
      tier: "hot",
      step: 7,
      label: "WS push",
      detail: {
        what: "The receive frame pushed down the recipient's open socket.",
        why: "This is the only genuinely real-time part of the system, and it is a latency optimisation over a store-and-forward path that would have delivered the message anyway, just later.",
        numbers: [
          { value: "~50ms p99 in the data centre", explain: "The server-side latency of this final push, negligible compared to the mobile network legs." },
          { value: "135 to 255ms end to end including both radio legs", explain: "The realistic total delivery time once the client's mobile network is included." },
        ],
        breaks: {
          failure: "The server cannot distinguish a frame never received from one received and not applied.",
          handled: "That is why delivery is at-least-once and the client applies by msg_id, so a duplicate push is harmless rather than a correctness bug.",
        },
      },
    },
    {
      id: "e19",
      from: "router",
      to: "push-service",
      tier: "control",
      label: "no live socket",
      detail: {
        what: "The branch taken when the registry has no edge for this user: hand the copy to the push service instead of a partition.",
        why: "With no socket the message is already durable, so the only work left is waking the device. That is why the offline branch adds no durability work at all and the sender's experience is identical either way.",
        numbers: [
          { value: "~45% of 12.5B delivered copies/day", explain: "How much of total delivery traffic actually takes this branch instead of a live socket." },
          { value: "5.6B push-eligible events/day", explain: "The volume this branch hands to the push service before coalescing reduces it." },
        ],
        breaks: {
          failure: "This branch is also taken for a stale registry entry pointing at a dead edge.",
          handled: "It must be cheap because of that, since it is the fallback for a routing miss as much as for genuinely offline users.",
        },
      },
    },
    {
      id: "e21",
      to: "recipient-device",
      tier: "control",
      label: "wakeup, best effort",
      from: "push-service",
      detail: {
        what: "The platform notification that wakes the app so it can reconnect.",
        why: "The notification's only job is to get the user to open the app; the app then reconnects and asks for everything after its cursor. Demoting push to a wakeup is what stops its unreliability costing a message.",
        numbers: [
          { value: "zero acknowledgement, by contract", explain: "No confirmation is ever expected from this hop, which is why it is never trusted as delivery." },
          { value: "~2.2B/day", explain: "The daily volume of wakeups this hop actually sends after coalescing." },
        ],
        breaks: {
          failure: "Rate-limited and lossy, and outside our control.",
          handled: "Treating it as delivery is how you build a system where a provider outage loses messages, so it is treated purely as a wakeup hint instead.",
        },
      },
    },
    {
      id: "e22",
      from: "recipient-device",
      to: "edge-b",
      tier: "control",
      label: "reconnect + cursor + receipt",
      offset: 60,
      detail: {
        what: "The reverse channel up the socket: on reconnect the device presents its per-conversation cursors, and in steady state it raises the same high-water mark as a receipt.",
        why: "The reconnect path and the receipt path want exactly the same fact, so they are one message rather than two. That single mechanism covers crashes, deploys, flaky mobile networks and users offline for months.",
        numbers: [
          { value: "receipts debounced on 5 seconds", explain: "How often this channel actually sends an update in steady state." },
          { value: "up to 30s of client jitter before reconnecting", explain: "The spread applied client-side before a reconnect attempt lands here." },
          { value: "resync marker above ~500 messages or 7 days", explain: "The threshold past which this reconnect switches from streaming to a jump-forward marker." },
        ],
        breaks: {
          failure: "Beyond the resync bound the server jumps the cursor forward instead of streaming.",
          handled: "Those skipped messages are never individually acked, so their senders' ticks never complete, an accepted cost of bounding catch-up work.",
        },
      },
    },
    {
      id: "e23",
      from: "edge-b",
      to: "session-registry",
      tier: "control",
      label: "SET user:bob edge_B EX 60",
      detail: {
        what: "The edge claiming ownership of a user's socket on connect, refreshed by heartbeat every 30 seconds.",
        why: "The registry is written by whoever holds the socket, which makes recovery self-healing. A client that lands on a new box after a crash rewrites its own routing entry as a side effect of connecting.",
        numbers: [
          { value: "TTL 60s, heartbeat every 30s", explain: "The write cadence that keeps this entry fresh for as long as the socket stays open." },
          { value: "30M refreshes every 30s at peak", explain: "The total heartbeat volume this hop generates fleet-wide at peak connection count." },
        ],
        breaks: {
          failure: "An edge that dies without expiring its entries leaves routing aiming at it for up to 60 seconds.",
          handled: "The TTL is the only cleanup there is; an accepted bound rather than active detection, since watching every edge's liveness would add a whole monitoring system.",
        },
      },
    },
    {
      id: "e24",
      from: "edge-b",
      to: "cursors",
      tier: "data",
      label: "high-water mark",
      detail: {
        what: "The server-side mirror of the device's cursor: (chat_id, device_id) to applied_msg_id, written when a receipt arrives.",
        why: "One write instead of two. The same row is the delivered receipt the sender sees as a second tick, and also the sync state the reconnect path needs. A burst of forty messages collapses into a single update.",
        numbers: [
          { value: "debounced on 5 seconds", explain: "The batching window this write applies before actually landing an update." },
          { value: "one row per (chat_id, device_id)", explain: "The compact shape of this state, regardless of how many messages have accumulated." },
        ],
        breaks: {
          failure: "Send these only on change and a lost receipt strands the sender on one tick forever.",
          handled: "Sending cursors on a periodic heartbeat repairs it, not just on change; that resend eventually corrects any dropped receipt without a dedicated retry path or ack tracking.",
        },
      },
    },
    {
      id: "e26",
      to: "conversation-log",
      tier: "data",
      label: "backlog after cursor",
      from: "edge-b",
      detail: {
        what: "One range query per hot (chat_id, range), served from the partition and clustering key rather than a merge across partitions.",
        why: "The store is partitioned by chat_id and clustered by msg_id, so send order comes back for free and a range scan after a cursor is one query. That is the read shape the shared-log choice was made for.",
        numbers: [
          { value: "30-day hot window on SSD", explain: "How far back this read can go before falling through to a cheaper storage tier." },
          { value: "partitions kept under ~100MB", explain: "The sizing target that keeps this range scan fast regardless of a conversation's total history." },
        ],
        breaks: {
          failure: "Beyond the hot window the read falls through to object storage at roughly 10x cheaper per GB.",
          handled: "That tier carries materially higher latency, acceptable for scroll-back but not for catch-up, which is why the hot window is sized to cover realistic reconnect gaps.",
        },
      },
    },
  ],
  figures: {
    delivery: {
      title: "Delivery state machine: sending to read, with retry",
      nodes: [
        { id: "sending", label: "Sending", kind: "database", col: 0, row: 0 },
        { id: "sent", label: "Sent", sub: "persists + msg_id", kind: "database", col: 0, row: 1 },
        { id: "delivered", label: "Delivered", sub: "device acks", kind: "database", col: 0, row: 2 },
        { id: "read", label: "Read", sub: "opens chat", kind: "database", col: 0, row: 3 },
        { id: "failed", label: "Failed", sub: "timeout / net err", kind: "database", col: 1, row: 0 },
      ],
      edges: [
        { id: "e1", from: "sending", to: "sent", tier: "hot", step: 1, label: "persists + msg_id" },
        { id: "e2", from: "sent", to: "delivered", tier: "hot", step: 2, label: "device acks" },
        { id: "e3", from: "delivered", to: "read", tier: "hot", step: 3, label: "opens chat" },
        { id: "e4", from: "sending", to: "failed", tier: "data", label: "timeout / net error" },
        { id: "e5", from: "failed", to: "sending", tier: "data", label: "retry, exp backoff" },
      ],
    },
    "e2ee-fork": {
      title: "One fork, four subsystems reshaped at once",
      nodes: [
        {
          id: "decision",
          label: "E2EE: yes or no",
          kind: "service",
          col: 0,
          row: 1,
          detail: {
            what: "The single decision, taken before anything else, over whether the server can ever read message content.",
            why: "Search, new-device history, group delivery and abuse detection are all built assuming the server can read content. Retrofitting the fork later means rebuilding all four, not adding a library.",
          },
        },
        {
          id: "search",
          label: "Search",
          sub: "server index → on-device",
          kind: "service",
          col: 1,
          row: 0,
          detail: {
            what: "Full-text search over message history.",
            why: "Under the encryption fork, server-side search stops existing and becomes an on-device index, workable at the roughly one megabyte of text a typical user holds, but it can only search what that one device has ever received.",
          },
        },
        { id: "history", label: "New-device history", sub: "server read → transfer/backup", kind: "service", col: 1, row: 1 },
        { id: "fanout", label: "Group fan-out", sub: "1 write → 1 per device", kind: "service", col: 1, row: 2 },
        { id: "abuse", label: "Abuse detection", sub: "content → metadata only", kind: "service", col: 1, row: 3 },
      ],
      edges: [
        { id: "e1", from: "decision", to: "search", tier: "data", label: "reshapes" },
        { id: "e2", from: "decision", to: "history", tier: "data", label: "reshapes" },
        { id: "e3", from: "decision", to: "fanout", tier: "data", label: "reshapes" },
        { id: "e4", from: "decision", to: "abuse", tier: "data", label: "reshapes" },
      ],
    },
  },
};
