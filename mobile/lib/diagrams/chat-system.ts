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
    beats: [
      "Every device holds one long-lived TLS connection to an edge server, because a push system needs the server able to speak first. That single decision makes the edge tier stateful, and connection count rather than requests per second becomes the number that sizes the fleet.",
      "On send, the edge does not write. It hands the frame to a persist path that checks the idempotency index, assigns a conversation-scoped Snowflake id and does a quorum write, and only then does an ack come back. The tick means stored, never that one process accepted it.",
      "Delivery starts after the commit. The record goes onto a partitioned bus and a routing consumer expands group membership, then asks the session registry which of 60 edges currently holds each recipient's socket, and republishes onto that edge's partition. That lookup is the whole reason edges never have to know about each other.",
      "If there is no live socket, nothing special happens, because the message is already durable. APNs or FCM wakes the device, the app reconnects and asks for everything after its cursor, and that one mechanism covers crashes, deploys, flaky mobile networks and users offline for months.",
      "Receipts travel back up the same pipe and are the half that actually saturates. A per-device high-water mark, debounced on five seconds, is both the delivery receipt and the sync cursor, so a burst of forty messages collapses into one write instead of forty rows.",
      "The cost of all of it is that connection ownership is now architecture. An edge is not interchangeable while it holds a million sockets, so deploys drain rather than restart, failover needs a reconnect storm plan, and capacity is planned in connections.",
    ],
    crux:
      "The connection tier is stateful, so losing one box is a fleet event rather than a node event. An edge holding 1M sockets dies, every client detects it within seconds, and 17,000 reconnects per second per surviving box, each carrying a ~1ms TLS handshake, is 17 cores of pure handshake on boxes that were already busy. Jittered client backoff is not a polish item; it is what stops one failure taking the fleet.",
    numbers: [
      "30M concurrent sockets x 16KB = 480GB across 60 boxes",
      "175k sends/s peak, 435k delivered copies/s peak",
      "p99 300ms end to end, ~80% of it the two mobile radio legs",
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
        why: "Every hard question in this interview lives inside this boundary rather than in the socket. What the sender's tick promises, what a device asks for after three weeks away, and what happens to a message written but never pushed are all decided here.",
        numbers: ["~10ms quorum write", "1TB/day raw, 3TB/day at RF=3", "175k sends/s at peak"],
        breaks:
          "Move the ack outside this boundary and the whole delivery contract collapses: a tick that can be retracted is worse than a slow tick.",
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
        why: "The order is the product, so the three stages live in one process rather than three services. Drawing them as peers would invite an async hop between them, and an async hop between 'id assigned' and 'write committed' is exactly the bug the design exists to prevent.",
        numbers: [
          "58k sends/s average, 175k at peak",
          "one extra read plus one quorum write per send",
          "scales horizontally: no state between requests",
        ],
        breaks:
          "It is stateless, so its failure is a retryable error on the client rather than a lost message. The dangerous failure is a code change that reorders the stages.",
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
          "client_msg_id generated before the first attempt",
          "one cursor per conversation per device",
          "keepalive ~every 60s to survive carrier NAT rebinding",
        ],
        breaks:
          "Without jittered backoff a million of these reconnect inside a second after an edge dies, and the client is the only place that fix can be applied.",
        choice: {
          pick: "Client-generated client_msg_id, plus jittered reconnect backoff of 0 to 30 seconds uniform",
          instead: "Server-assigned ids only, and reconnecting immediately on drop",
          decider:
            "1M dropped sockets reconnecting inside a second is 17k/s per surviving box at ~1ms of TLS handshake CPU each, so 17 cores of handshake. Uniform 0 to 30s jitter flattens the same million to 570/s per box, about 0.6 of a core.",
          flips:
            "Small fleets where losing a node drops thousands rather than millions of sockets, and the thundering herd fits inside spare capacity.",
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
        what: "The box holding Alice's socket. Terminates TLS, frames the protocol, and hands sends to the persist path. It never writes to the log itself. It also runs the ephemeral presence/typing fan-out: whichever edge holds a socket publishes heartbeats with a TTL, and edges holding interested peers subscribe.",
        why: "HTTP is request-response and closes; a chat server has to push at any moment without being asked, so the connection stays open for the life of the app session. Sub-second delivery is bought with a stateful tier, and that is the trade. Presence rides the same socket but must never touch the durable path: it is worthless the moment it is stale, so writing it durably would buy nothing and cost 30M writes every heartbeat interval.",
        numbers: [
          "1M sockets per box planned, 2M demonstrated by WhatsApp in 2012",
          "16KB per tuned socket, 16GB of connection state on a 128GB box",
          "60 boxes for 30M peak sockets, 2x for deploys and a lost AZ",
          "presence: TTL 30s, ~1M heartbeat events/s fleet-wide",
        ],
        breaks:
          "An edge is not interchangeable while it holds sockets, so a rolling deploy has to drain over ~5 minutes rather than restart, or it is a self-inflicted reconnect storm. Lost presence shows a stale 'online' dot for up to one TTL, which is the correct failure: wrong-but-harmless rather than blocking a message.",
        choice: {
          pick: "One long-lived TLS connection per device on an event-loop runtime (Go goroutines or Erlang's BEAM)",
          instead:
            "Long polling: an ordinary HTTP request held open for up to 30 seconds, plus a separate POST for upstream sends",
          decider:
            "Concurrent connection count. Long polling occupies the same socket and the same 480GB, then adds a second connection upstream and a re-establishment every 30 seconds: 30M / 30 = 1M setups/s fleet-wide, ~17k/s per box, and a 10% session-resumption miss is 100k full handshakes/s at ~1ms CPU, roughly 100 cores burned on nothing.",
          flips:
            "Around 100k concurrent, where the same formula gives 3.3k setups/s fleet-wide and plain HTTP wins on operational simplicity. Ship long polling as a day-one fallback regardless, for the low single-digit percentage of sessions behind proxies that strip the Upgrade header.",
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
        why: "The common mobile failure is a lost ack followed by a client retry, not an exotic one. This is the only point in the system where a retry can still be turned back into the same message, because after the next stage it has an id and after the one following it has been delivered.",
        numbers: [
          "one extra read on every send, including the majority that are not retries",
          "24h window, covering the client's retry horizon",
          "a hit short-circuits: no id, no write, no bus record",
        ],
        breaks:
          "Skip it and a lost ack produces two genuinely distinct messages. No downstream dedupe can repair that, because by the time anyone notices both have valid ids and both have been delivered.",
        choice: {
          pick: "A conditional check before id assignment, returning the prior ack on a hit",
          instead: "Letting both writes land and de-duplicating at delivery or on the client",
          decider:
            "Where the duplicate is still reversible. Before an id exists it is one row; after, it is two valid messages in two clients' render order, and nothing can merge them. The cost of getting it right is one read on 5B sends/day.",
          flips:
            "Never for user-visible messages. It flips only for genuinely idempotent side-effect-free traffic, such as presence, where a duplicate is invisible.",
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
          "monotonic per chat_id, not globally",
          "id exists before the quorum write and before the bus",
          "doubles as the clustering key in the conversation log",
        ],
        breaks:
          "Two devices of the same user sending concurrently get their ids in the order the persist path happened to see them, which may not be the order the human experienced. Accepted, not solved.",
        choice: {
          pick: "Conversation-scoped Snowflake ids assigned on the write path",
          instead: "Client timestamps for ordering, or a global per-user sequencer",
          decider:
            "Phone clocks are wrong by seconds, so client timestamps cannot order a conversation at all. A global order needs a per-user sequencer, which is a write bottleneck on exactly the most active users, and nothing a client renders needs more than per-conversation order.",
          flips:
            "Products where a user's whole timeline must be totally ordered — a unified inbox across conversations — which is where you pay for the per-user sequencer deliberately.",
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
        why: "This is the product; everything else is delivery. One shared log per conversation means one write per message rather than one per member, which is what stops a 1,024-member room turning a single send into 1,024 writes on whichever shards its members happen to hash to.",
        numbers: [
          "1TB/day raw, 3TB/day at RF=3 across AZs",
          "30-day hot retention: 30TB raw, 90TB replicated on SSD",
          "partitions kept under ~100MB; ~200B per row",
        ],
        breaks:
          "A hot room grows one partition without bound, which is why the key carries a time bucket: (chat_id, day) for busy rooms, (chat_id, year) for a two-person chat. JVM GC on this tier is also the source of p99 read spikes no application tuning hides.",
        choice: {
          pick: "One shared log per conversation plus a per-device cursor",
          instead: "Fan out a row into every recipient's own inbox partition at send time",
          decider:
            "The tail of the group size distribution, not the mean. Mean amplification is 2.5, so fan-out is 12.5B inbox writes/day against 5B log writes and is affordable. One 100k-member room at 10 messages/minute is 16k writes/s from a single conversation. Past roughly 1,000 members the shared log wins, and the cap is 1,024 precisely so that stays true.",
          flips:
            "Hard-capped small groups where read latency is the SLO. At a 100-member cap the amplification is bounded and a client's unread set is one sequential scan, which matters when a user is in 200 conversations. That is Slack's shape rather than this one.",
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
        why: "The sender's tick has to mean the message exists durably, not that one server process accepted it. This ordering, not its speed, is the delivery contract, and keeping it inside one process is what makes it an enforced invariant rather than a convention every caller is trusted to honour.",
        numbers: [
          "~10ms for the quorum write out of a 300ms p99 budget",
          "RF=3 across availability zones",
          "ack strictly after commit; bus publish strictly after ack",
        ],
        breaks:
          "A stalled quorum surfaces to the client as a retryable failure, which is the right answer: no tick beats a wrong tick.",
        choice: {
          pick: "Quorum write, then ack, then publish",
          instead: "Ack from the edge on receipt and write asynchronously",
          decider:
            "Acking first shaves 10ms off a 300ms budget where 60 to 120ms is mobile radio on each leg, so the saving is invisible to the user. What it buys instead is a retractable tick: a crash in that 10ms window turns a delivered tick into a message that never existed. Single-replica acknowledgement is the same bug slowed down — a node loss silently deletes acked messages.",
          flips:
            "Systems where the message is a hint rather than a record, such as presence or typing, where losing one after acking it costs nothing.",
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
          "175k records/s at peak, one per send",
          "~5ms hop inside the 300ms budget",
          "retention long enough for a consumer tier restart, not for history",
        ],
        breaks:
          "If the bus is unavailable the message is still stored and still arrives on reconnect, so the incident is delivery latency rather than data loss.",
        choice: {
          pick: "A replayable log between the write path and routing",
          instead: "Calling the routing tier synchronously from the persist path",
          decider:
            "What happens on a routing failure. A synchronous call makes routing's availability part of the send SLO and loses the delivery on a dropped call with no way to rewind; a log lets a restarted consumer resume from its offset and keeps the sender's latency budget independent of fan-out.",
          flips:
            "Deployments small enough that routing is a library call inside the persist process, where a broker is pure operational cost.",
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
          "2.5 recipients per send on an 85% 1:1, 15% group mix",
          "435k delivered copies/s at peak",
          "~45% of copies find no live socket",
        ],
        breaks:
          "A stale registry entry routes at a dead edge. That is a latency bug rather than a correctness one, because the copy falls through to push and the cursor is the backstop.",
        choice: {
          pick: "A routing consumer group that resolves membership, then reads the registry",
          instead: "Fanning out at the sending edge, before the bus",
          decider:
            "Where the amplification lands. Recipients per send average 2.5 but the cap is 1,024, so doing it at the edge puts a 1,024-way expansion on a socket thread that is simultaneously holding a million other connections.",
          flips:
            "1:1 only, where routing is a single registry lookup with no membership resolution on the hot path and a separate consumer tier earns nothing.",
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
          "100M entries x ~80B = 8GB",
          "TTL 60s, heartbeat every 30s",
          "one in-memory shard, replicated 3x",
        ],
        breaks:
          "If an edge dies without expiring its entries, routing keeps aiming at a dead box for up to 60 seconds; the TTL is the only cleanup, which is why it is short.",
        choice: {
          pick: "Redis, SET user:{bob} edge_B EX 60, refreshed on heartbeat",
          instead: "A replicated database table, or gossip between edges",
          decider:
            "Durability buys nothing here, because the truth is rewritten on every reconnect and every entry is wrong within 60 seconds of a phone changing network. A database write per connect and heartbeat is 30M writes every 30 seconds for 8GB of data that expires anyway.",
          flips:
            "Small fleets where the whole map fits in each edge's memory and gossip is cheaper than running another service.",
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
        why: "An edge subscribes rather than being addressed. That is what removes the mesh: no edge needs to know any other edge exists, and a rolling deploy can move sockets around without anyone recomputing a topology or tracking liveness.",
        numbers: [
          "60 partitions for 60 edges",
          "435k delivered copies/s at peak",
          "a restarted edge replays its own partition from its offset",
        ],
        breaks:
          "A lagging partition delays every recipient on one edge while the rest of the fleet looks healthy. Consumer lag per partition is the metric that catches it before any user does.",
        choice: {
          pick: "One partition per edge, consumed by the edge that owns it",
          instead: "Direct RPC from the routing tier to the recipient's edge",
          decider:
            "Deploy behaviour and replay. With 60 edges rolling continuously, direct calls need every caller tracking every edge's liveness, and a dropped call loses a delivery with no way to rewind. A log lets a restarted edge replay its own partition, which is exactly the case a deploy creates every time.",
          flips:
            "A single-edge deployment, where there is no cross-edge hop at all and a broker is pure operational cost.",
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
        what: "Ours, not Apple's. Takes the copies that found no live socket, coalesces them per device on a 30-second floor, de-duplicates on msg_id, holds the device tokens, and calls APNs or FCM.",
        why: "Without this box the offline branch would send one provider call per delivered copy into services we do not control and that rate-limit us. It is also the only place that can turn a phone asleep for eight hours into one buzz instead of forty, because it is the only component that sees all of a device's pending copies at once.",
        numbers: [
          "5.6B push-eligible events/day in, ~2.2B/day out",
          "coalescing removes ~60% on this traffic mix",
          "26k/s average, ~78k/s peak to the providers",
        ],
        breaks:
          "Its own failure is invisible from the message path: everything is already durable and every message still arrives on reconnect, so nothing alerts except a push send rate that quietly falls to zero while offline users go silent.",
        choice: {
          pick: "Coalesce per device on a 30-second floor and dedupe on msg_id before calling the provider",
          instead: "One provider call per delivered copy, with per-message delivery tracking",
          decider:
            "5.6B push-eligible events/day against ~2.2B after coalescing, so 60% of the provider calls are removed for a 30-second worst-case delay on a path that is already best-effort. Per-message reliability tracking buys nothing on top, because the message is already durable and the cursor is what actually delivers it.",
          flips:
            "Only where there is no durable store behind the notification, so the payload genuinely is the message rather than a hint to reconnect.",
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
          "resync marker above ~500 messages or 7 days of gap",
          "drain mode closes sockets over ~5 minutes",
          "registry entry written on connect, TTL 60s",
        ],
        breaks:
          "This is the box whose death is the design problem. 1M sockets drop, and without client jitter that is 17k reconnects/s per surviving box at ~1ms of TLS handshake each.",
        choice: {
          pick: "A server-side resync marker once the gap exceeds ~500 messages or 7 days",
          instead: "Always streaming the full backlog from the cursor",
          decider:
            "A device back after three months in a busy group would take tens of thousands of messages down a socket that times out mid-stream, then retry from the same cursor and fail identically. The marker jumps the cursor forward and the client pages older history 50 at a time over REST. State the cost: those messages are never individually acked, so their senders' ticks never complete.",
          flips:
            "Low-volume conversations where the worst backlog is a few hundred messages, and full streaming is always cheaper than maintaining a second code path.",
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
          "~5,000 messages and ~1MB of text per user per 30 days",
          "receipts debounced on a 5-second window",
          "one cursor per conversation per device",
        ],
        breaks:
          "Delivered is a per-device fact, read is the maximum over a user's devices. Getting that backwards is the familiar bug where reading on a laptop leaves the phone badged forever.",
        choice: {
          pick: "Apply by msg_id with an upsert, accepting at-least-once delivery",
          instead: "Chasing exactly-once at the transport",
          decider:
            "The socket can die after the server writes a frame and before the client applies it, and neither side can distinguish that from the frame never arriving. Any protocol claiming exactly-once is doing at-least-once with a dedupe you have not been told about; done explicitly it costs one upsert per frame across 12.5B delivered copies/day.",
          flips:
            "Never over a mobile network. Exactly-once needs a single transaction boundary spanning both parties, which a phone on a train is not.",
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
          "500-member group: 500 delivered plus 500 read events per message, 1,000x amplification",
          "5-second debounce per conversation per device",
          "aggregate counts rather than per-member lists above ~50 members",
        ],
        breaks:
          "Receipt storms are what saturate first in production, well before the forward path does. Three mitigations compose here and all three are needed.",
        choice: {
          pick: "A per-device high-water mark that is also the sync cursor",
          instead: "One receipt row per message per recipient",
          decider:
            "Amplification. A row per message in a 500-member group is up to 1,000 reverse events per forward message; a high-water mark is one row per device per conversation regardless of message rate, and it costs one write rather than two because the sync state shares it.",
          flips:
            "Very small conversations where per-message read state is a product feature, for example showing exactly who read which message in a five-person thread.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      to: "edge-a",
      label: "connect, discover edge",
      from: "sender-device",
      dashed: true,
      detail: {
        what: "The connect-time request: authenticate, then ask where this device's socket should live.",
        why: "Placement happens once per socket rather than once per message, because a stateful tier cannot be balanced per request. Everything after this point talks to one specific box.",
        numbers: ["one round trip per socket, not per message", "JWT presented at the handshake"],
        breaks:
          "This is the request a million clients make simultaneously after an edge dies, which is why the answer can be a Retry-After rather than an address.",
      },
    },
    {
      id: "e3",
      from: "sender-device",
      to: "edge-a",
      label: "WebSocket",
      animated: true,
      detail: {
        what: "One long-lived TLS connection carrying sends, cursors, presence and typing in both directions.",
        why: "The server has to be able to speak first, which request-response cannot do. Opening a connection per message would also pay a handshake per message on a network where the handshake is the expensive part.",
        numbers: ["16KB of tuned state per socket", "keepalive ~every 60s to survive carrier NAT rebinding"],
        breaks:
          "Corporate proxies that strip the Upgrade header and captive portals that kill idle connections cost a low single-digit percentage of sessions, which is why long polling ships as a fallback on day one.",
      },
    },
    {
      id: "e4",
      from: "edge-a",
      to: "p-idempotency",
      label: "send + client_msg_id",
      animated: true,
      detail: {
        what: "The send frame handed off the socket to the persist path, carrying the client-generated idempotency key.",
        why: "The edge deliberately does not write. Keeping persistence in one component is what makes commit-before-ack an enforced invariant rather than a convention every edge is trusted to honour.",
        numbers: ["175k/s at peak", "~200B on the wire"],
        breaks:
          "If the edge acks here instead of waiting for the commit, a crash in the next 10ms turns a delivered tick into a message that never existed.",
      },
    },
    {
      id: "e6",
      from: "p-idempotency",
      to: "p-sequencer",
      label: "not seen before",
      detail: {
        what: "The in-process hand-off to id assignment, taken only when the idempotency check missed.",
        why: "A hit short-circuits here and returns the original ack, so a retry never reaches the sequencer and never produces a second id. That is the whole point of putting the check first.",
        breaks:
          "Reorder these two stages and every retry gets a fresh id before anything can notice it is a retry.",
      },
    },
    {
      id: "e7",
      from: "p-sequencer",
      to: "p-commit",
      label: "msg_id assigned",
      detail: {
        what: "The record, now carrying its conversation-scoped monotonic id, handed to the commit stage.",
        why: "The id exists before the write so that the store can cluster on it and the bus can carry it. Assigning it after the write would mean a second write to attach it.",
        numbers: ["monotonic within chat_id"],
        breaks:
          "This hand-off is in-process on purpose. An async hop here would allow a gap where an id exists for a message that was never committed.",
      },
    },
    {
      id: "e8",
      from: "p-commit",
      to: "conversation-log",
      label: "quorum write",
      detail: {
        what: "The write that must commit before anything acknowledges the sender.",
        why: "The quorum matters as much as the write. A single-replica acknowledgement means a node loss silently deletes acked messages, and the symptom is a conversation where one side sees a message the other never will.",
        numbers: ["~10ms", "RF=3 across AZs", "58k writes/s average, 175k at peak"],
        breaks:
          "A stalled quorum surfaces to the client as a retryable failure, which is the right answer: no tick beats a wrong tick.",
      },
    },
    {
      id: "e9",
      from: "p-commit",
      to: "edge-a",
      label: "ack, after commit",
      dashed: true,
      offset: 90,
      detail: {
        what: "The acknowledgement carrying the assigned server msg_id, emitted only once the quorum write has committed.",
        why: "This is the invariant the whole design exists to defend. The ordering of these two operations, not their speed, is the delivery contract: the tick means stored, never that one process accepted it.",
        numbers: ["ack strictly after the commit"],
        breaks:
          "Reversing the order shaves 10ms off a 300ms budget and makes every tick retractable, which is a worse product than a slightly slower tick.",
      },
    },
    {
      id: "e10",
      from: "edge-a",
      to: "sender-device",
      label: "one tick",
      dashed: true,
      offset: 40,
      detail: {
        what: "The ack forwarded down the socket, rendering as the sender's first tick.",
        why: "Three independent facts travel back to a sender (stored, reached a device, a human looked), each produced by a different actor and each losable on its own. Conflating any two of them is the classic failure.",
        breaks:
          "If the socket died between commit and this frame, the client retries with the same client_msg_id and resolves to the original message rather than a duplicate.",
      },
    },
    {
      id: "e12",
      from: "p-commit",
      to: "commit-topic",
      label: "committed record",
      animated: true,
      detail: {
        what: "The committed record published for routing, once the id exists and the write has landed.",
        why: "Delivery only starts after durability is settled, which is what makes the offline branch free: when the recipient turns out to be unreachable there is nothing left to make durable.",
        numbers: ["175k records/s at peak"],
        breaks:
          "If the bus is unavailable the message is still stored and still arrives on reconnect, so the incident is delivery latency rather than data loss.",
      },
    },
    {
      id: "e13",
      from: "commit-topic",
      to: "router",
      label: "consumer group, by chat_id",
      animated: true,
      detail: {
        what: "Routing consumers reading committed records off their partitions.",
        why: "A consumer group lets routing scale independently of both the edge tier and the write path, and a restarted consumer rewinds to its offset rather than losing whatever was in flight.",
        numbers: ["~5ms hop", "175k records/s in, 435k copies/s out"],
        breaks:
          "Consumer lag per partition is the metric that shows routing falling behind before any user notices anything.",
      },
    },
    {
      id: "e15",
      from: "router",
      to: "session-registry",
      label: "which edge holds Bob?",
      dashed: true,
      detail: {
        what: "The routing lookup: user_id to the edge currently holding that user's socket.",
        why: "This is the hop that makes cross-edge delivery possible without any edge knowing about any other. It is a cache read on the delivery path and deliberately not on the write path, so its staleness can never cost a message.",
        numbers: ["8GB of entries", "TTL 60s", "435k lookups/s at peak"],
        breaks:
          "A stale answer routes at a dead edge. Nothing is lost: the recipient falls through to push and asks for everything after their cursor when they return.",
      },
    },
    {
      id: "e16",
      from: "router",
      to: "edge-partitions",
      label: "publish to owning partition",
      animated: true,
      detail: {
        what: "The routed copy written onto the partition belonging to the edge that holds the recipient's socket.",
        why: "Addressing an edge by partition rather than by RPC is what lets the edge subscribe instead of being called, so a rolling deploy moves sockets around without anyone maintaining a topology.",
        numbers: ["60 partitions", "435k copies/s at peak"],
        breaks:
          "If the recipient reconnects to a different edge mid-flight, the copy lands on the old edge's partition and is dropped; cursor replay covers it.",
      },
    },
    {
      id: "e17",
      from: "edge-partitions",
      to: "edge-b",
      label: "edge consumes its own",
      animated: true,
      detail: {
        what: "The recipient's edge consuming the partition it owns.",
        why: "One consumer per partition means an edge only ever sees traffic for sockets it actually holds, and a restarted edge replays from its own offset rather than asking anyone to resend.",
        numbers: ["one partition per edge", "lag per partition is the alerting signal"],
        breaks:
          "A lagging partition delays every recipient on one edge while the rest of the fleet looks healthy. Durability is untouched, because the message committed before it ever got here.",
      },
    },
    {
      id: "e18",
      from: "edge-b",
      to: "recipient-device",
      label: "WS push",
      animated: true,
      detail: {
        what: "The receive frame pushed down the recipient's open socket.",
        why: "This is the only genuinely real-time part of the system, and it is a latency optimisation over a store-and-forward path that would have delivered the message anyway, just later.",
        numbers: ["~50ms p99 in the data centre", "135 to 255ms end to end including both radio legs"],
        breaks:
          "The server cannot distinguish a frame never received from one received and not applied, which is why delivery is at-least-once and the client applies by msg_id.",
      },
    },
    {
      id: "e19",
      from: "router",
      to: "push-service",
      label: "no live socket",
      dashed: true,
      detail: {
        what: "The branch taken when the registry has no edge for this user: hand the copy to the push service instead of a partition.",
        why: "With no socket the message is already durable, so the only work left is waking the device. That is why the offline branch adds no durability work at all and the sender's experience is identical either way.",
        numbers: ["~45% of 12.5B delivered copies/day", "5.6B push-eligible events/day"],
        breaks:
          "This branch is also taken for a stale registry entry pointing at a dead edge, which is why it must be cheap: it is the fallback for a routing miss, not only for genuinely offline users.",
      },
    },
    {
      id: "e21",
      to: "recipient-device",
      label: "APNs/FCM wakeup, best effort",
      from: "push-service",
      dashed: true,
      detail: {
        what: "The platform notification that wakes the app so it can reconnect.",
        why: "The notification's only job is to get the user to open the app; the app then reconnects and asks for everything after its cursor. Demoting push to a wakeup is what stops its unreliability costing a message.",
        numbers: ["unacknowledged by contract", "~2.2B/day"],
        breaks:
          "Rate-limited and lossy, and outside our control. Treating it as delivery is how you build a system where a provider outage loses messages.",
      },
    },
    {
      id: "e22",
      from: "recipient-device",
      to: "edge-b",
      label: "reconnect + cursor + receipt",
      dashed: true,
      offset: 60,
      detail: {
        what: "The reverse channel up the socket: on reconnect the device presents its per-conversation cursors, and in steady state it raises the same high-water mark as a receipt.",
        why: "The reconnect path and the receipt path want exactly the same fact, so they are one message rather than two. That single mechanism covers crashes, deploys, flaky mobile networks and users offline for months, and it is what demotes push notifications from delivery to wakeups.",
        numbers: [
          "receipts debounced on 5 seconds",
          "up to 30s of client jitter before reconnecting",
          "resync marker above ~500 messages or 7 days",
        ],
        breaks:
          "Beyond the resync bound the server jumps the cursor forward instead of streaming, so those messages are never individually acked and their senders' ticks never complete.",
      },
    },
    {
      id: "e23",
      from: "edge-b",
      to: "session-registry",
      label: "SET user:bob edge_B EX 60",
      dashed: true,
      detail: {
        what: "The edge claiming ownership of a user's socket on connect, refreshed by heartbeat every 30 seconds.",
        why: "The registry is written by whoever holds the socket, which makes recovery self-healing: a client that lands on a new box after a crash rewrites its own routing entry as a side effect of connecting.",
        numbers: ["TTL 60s, heartbeat every 30s", "30M refreshes every 30s at peak"],
        breaks:
          "An edge that dies without expiring its entries leaves routing aiming at it for up to 60 seconds, and the TTL is the only cleanup there is.",
      },
    },
    {
      id: "e24",
      from: "edge-b",
      to: "cursors",
      label: "high-water mark",
      detail: {
        what: "The server-side mirror of the device's cursor: (chat_id, device_id) to applied_msg_id, written when a receipt arrives.",
        why: "One write instead of two. The same row is the delivered receipt the sender sees as a second tick and the sync state the reconnect path needs, and a burst of forty messages collapses into a single update.",
        numbers: ["debounced on 5 seconds", "one row per (chat_id, device_id)"],
        breaks:
          "Send these only on change and a lost receipt strands the sender on one tick forever; sending cursors on a heartbeat repairs it.",
      },
    },
    {
      id: "e26",
      to: "conversation-log",
      label: "backlog after cursor",
      from: "edge-b",
      detail: {
        what: "One range query per hot (chat_id, range), served from the partition and clustering key rather than a merge across partitions.",
        why: "The store is partitioned by chat_id and clustered by msg_id, so send order comes back for free and a range scan after a cursor is one query. That is the read shape the shared-log choice was made for.",
        numbers: ["30-day hot window on SSD", "partitions kept under ~100MB"],
        breaks:
          "Beyond the hot window the read falls through to object storage at roughly 10x cheaper per GB and materially higher latency, which is acceptable for scroll-back and not for catch-up.",
      },
    },
  ],
};
