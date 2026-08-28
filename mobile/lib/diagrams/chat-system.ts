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
      "On send, the edge does not write. It hands the frame to a persist path that assigns a conversation-scoped Snowflake id and does a quorum write, and only then does an ack come back. The tick means stored, never that one process accepted it.",
      "Delivery starts after the commit. The record goes onto a partitioned bus and a routing consumer expands group membership, then asks the session registry which of 60 edges currently holds each recipient's socket. That lookup is the whole reason edges never have to know about each other.",
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
    {
      id: "durable-path",
      label: "Durable path (commit before ack)",
      kind: "zone",
      x: 24,
      y: 194,
      w: 672,
      h: 208,
      detail: {
        what: "The write path: id assignment, the idempotency check, and the quorum write into the conversation log.",
        why: "Every hard question in this interview lives here rather than in the socket. What the sender's tick promises, what a device asks for after three weeks away, and what happens to a message written but never pushed are all decided inside this box.",
        numbers: ["~10ms quorum write", "1TB/day raw, 3TB/day at RF=3"],
        breaks:
          "Move the ack outside this boundary and the whole delivery contract collapses: a tick that can be retracted is worse than a slow tick.",
      },
    },
    {
      id: "sender-device",
      label: "Sender device",
      sub: "WebSocket + client_msg_id",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "Alice's phone: one long-lived socket, a locally generated client_msg_id per send, and a cursor per conversation.",
        why: "The client is the only place that can make retries safe, because it is the only actor present for every attempt. Exactly-once over a mobile network is not on offer, so idempotency keys and the apply-by-id cursor both have to live on the device.",
        numbers: [
          "client_msg_id generated before the first attempt",
          "one cursor per conversation per device",
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
      sub: "sticky WebSocket, Go or Elixir",
      kind: "service",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "The box holding Alice's socket. Terminates TLS, frames the protocol, and hands sends to the persist path.",
        why: "HTTP is request-response and closes; a chat server has to push at any moment without being asked, so the connection stays open for the life of the app session. Sub-second delivery is bought with a stateful tier, and that is the trade.",
        numbers: [
          "1M sockets per box planned, 2M demonstrated by WhatsApp in 2012",
          "16KB per tuned socket, 16GB of connection state on a 128GB box",
          "60 boxes for 30M peak sockets, 2x for deploys and a lost AZ",
        ],
        breaks:
          "An edge is not interchangeable while it holds sockets, so a rolling deploy has to drain over ~5 minutes rather than restart, or it is a self-inflicted reconnect storm.",
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
    {
      id: "persist",
      label: "Persist path",
      sub: "Snowflake id, then quorum write",
      kind: "service",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "Assigns a conversation-scoped monotonic msg_id and performs the quorum write, before anything acks.",
        why: "The sender's tick has to mean the message exists durably, not that one server process accepted it. Ordering comes from the same place, which is why one component owns both: every recipient renders the same sequence regardless of which edge delivered their copy.",
        numbers: [
          "~10ms for the quorum write",
          "175k sends/s at peak, 58k average",
          "id assigned before the record reaches the bus",
        ],
        breaks:
          "Acking at the edge and writing asynchronously shaves 10ms and makes ticks retractable; against a 60 to 120ms mobile round trip that 10ms is invisible anyway.",
        choice: {
          pick: "Conversation-scoped Snowflake id at the persist path, quorum write, then ack",
          instead: "Client timestamps for ordering, or a global per-user sequencer, or ack first and write asynchronously",
          decider:
            "Phone clocks are wrong by seconds, so client timestamps cannot order a conversation. A global order needs a per-user sequencer, which is a write bottleneck on exactly the most active users, and nothing a client renders needs more than per-conversation order. The quorum write costs ~10ms out of a 300ms p99 budget.",
          flips:
            "Single-replica acknowledgement is only acceptable when a node loss silently deleting acked messages is acceptable, and for chat it never is: the symptom is a conversation where one side sees a message the other never will.",
        },
      },
    },
    {
      id: "dedupe",
      label: "Dedupe index",
      sub: "(chat_id, client_msg_id), TTL 24h",
      kind: "database",
      x: 440,
      y: 210,
      w: 240,
      detail: {
        what: "Maps (chat_id, client_msg_id) to the msg_id already assigned, so a retried send returns the original ack rather than writing again.",
        why: "The common mobile failure is a lost ack followed by a client retry, not an exotic one. Without this the retry produces a second genuinely distinct message, and no downstream dedupe can undo it because by then both have valid ids and both have been delivered.",
        numbers: [
          "24h TTL, covering the client's retry horizon",
          "one extra read on every write",
        ],
        breaks:
          "Too short a window and a phone that retried after hours without signal creates a duplicate that lives forever.",
        choice: {
          pick: "A real 24-hour index in the same wide-column store, keyed (chat_id, client_msg_id)",
          instead: "A small in-process LRU on the persist node",
          decider:
            "The window has to cover the client's whole retry horizon, which on mobile is hours, so 24 hours rather than the lifetime of one process. An LRU also dies with the node that holds it, and the retry will usually land on a different one.",
          flips:
            "A desktop-only client on a stable network, where the retry horizon is seconds and an in-process cache genuinely covers it.",
        },
      },
    },
    {
      id: "conversation-log",
      label: "Conversation log",
      sub: "Cassandra/Scylla, (chat_id, time_bucket)",
      kind: "database",
      x: 440,
      y: 310,
      w: 240,
      detail: {
        what: "The durable store, partitioned by (chat_id, time_bucket) and clustered by msg_id, so one read returns a conversation in send order.",
        why: "This is the product; everything else is delivery. One shared log per conversation means one write per message rather than one per member, which is what stops a 1,024-member room turning a single send into 1,024 writes on whichever shards its members happen to hash to.",
        numbers: [
          "1TB/day raw, 3TB/day at RF=3 across AZs",
          "30-day hot retention: 30TB raw, 90TB replicated on SSD",
          "partitions kept under ~100MB",
        ],
        breaks:
          "A hot room grows one partition without bound, which is why the key carries a time bucket: (chat_id, day) for busy rooms, (chat_id, year) for a two-person chat.",
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
      id: "bus",
      label: "Routing bus",
      sub: "Kafka, one partition per edge",
      kind: "queue",
      x: 40,
      y: 410,
      w: 640,
      detail: {
        what: "A partitioned durable log carrying committed records out to whichever edge holds each recipient's socket.",
        why: "A direct mesh needs every edge to know every other edge, and it breaks during a rolling deploy, which is exactly when connections are moving. Publishing makes edge membership a subscription rather than a topology anyone has to maintain.",
        numbers: [
          "one partition per edge, 60 partitions",
          "~5ms bus hop inside the 300ms budget",
          "435k delivered copies/s at peak",
        ],
        breaks:
          "A lagging partition delays every recipient on one edge while the rest of the fleet looks healthy. Durability is untouched, because the message committed before it ever got here.",
        choice: {
          pick: "Kafka, one partition per edge, consumed by the edge that owns it",
          instead: "Direct RPC from the sending edge to the recipient's edge",
          decider:
            "Deploy behaviour and replay. With 60 edges rolling continuously, a mesh needs every edge tracking every other edge's liveness, and a dropped call loses a delivery with no way to rewind. A log lets a restarted edge replay its own partition.",
          flips:
            "A single-edge deployment, where there is no cross-edge hop at all and a broker is pure operational cost.",
        },
      },
    },
    {
      id: "router",
      label: "Routing consumer",
      sub: "membership + registry lookup",
      kind: "service",
      x: 40,
      y: 520,
      w: 280,
      detail: {
        what: "Consumes committed records, expands group membership, looks each recipient up in the session registry, and republishes onto the owning edge's partition.",
        why: "The registry lookup is the interesting hop: it is the only thing that knows which of 60 boxes currently holds Bob's socket. Keeping the expansion in a consumer tier rather than at the sending edge keeps fan-out off the sender's latency path entirely.",
        numbers: [
          "2.5 recipients per send on an 85% 1:1, 15% group mix",
          "group cap 1,024 members",
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
      id: "members",
      label: "Group membership",
      sub: "chat_members, cap 1,024",
      kind: "database",
      x: 440,
      y: 500,
      w: 240,
      detail: {
        what: "(chat_id, user_id, joined_at, role), read once per message to expand a group into its recipient list.",
        why: "Fan-out has to be bounded by something, and the bound lives here. The cap is a design parameter rather than a product whim: it is what keeps the shared-log choice correct and worst-case delivery arithmetic rather than hope.",
        numbers: [
          "cap 1,024 members",
          "15% of sends are group, averaging 12 members",
          "adding someone is one write",
        ],
        breaks:
          "Above the cap this stops being a group and becomes a broadcast channel, a different product: subscribers pull from a channel partition and receipts degrade to aggregate counts.",
        choice: {
          pick: "A membership table read per message, behind a hard 1,024 cap",
          instead: "Denormalising the member list onto each message, or dropping the cap",
          decider:
            "5,000 members at 100 messages/s is 500k delivered copies/s from one room, more than the whole fleet's 435k peak. The cap is what turns the worst case into a number you can plan against.",
          flips:
            "Very large public rooms, where the model changes to pull-based subscription rather than routed delivery and membership stops being read on the hot path.",
        },
      },
    },
    {
      id: "session-registry",
      label: "Session registry",
      sub: "Redis, user to edge, TTL 60s",
      kind: "database",
      x: 440,
      y: 600,
      w: 240,
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
      id: "edge-b",
      label: "Edge server B",
      sub: "holds Bob's socket, serves reconnect",
      kind: "service",
      x: 40,
      y: 630,
      w: 280,
      detail: {
        what: "The edge that currently owns the recipient's socket. Pushes the receive frame and serves the reconnect catch-up.",
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
            "A device back after three months in a busy group would take tens of thousands of messages down a socket that times out mid-stream, then retry from the same cursor and fail identically. The marker jumps the cursor forward and the client pages older history 50 at a time over REST.",
          flips:
            "Low-volume conversations where the worst backlog is a few hundred messages, and full streaming is always cheaper than maintaining a second code path.",
        },
      },
    },
    {
      id: "push",
      label: "APNs / FCM",
      sub: "best-effort wakeup",
      kind: "external",
      x: 440,
      y: 710,
      w: 240,
      detail: {
        what: "Apple and Google's notification services, used to wake a device that has no live socket.",
        why: "iOS suspends the app so a socket exists only in the foreground, and on Android a 60-second keepalive to survive carrier NAT rebinding keeps the radio awake and drains the battery. Push exists as much for backgrounded devices as for genuinely offline ones.",
        numbers: [
          "~45% of 12.5B delivered copies find no socket: 5.6B push-eligible/day",
          "30s coalescing removes ~60%, leaving ~2.2B/day",
          "26k/s average, ~78k/s peak",
        ],
        breaks:
          "Best-effort by contract and outside our control, so an APNs outage is a latency incident rather than a data incident. A duplicate push is a duplicate buzz even when the duplicate message is discarded.",
        choice: {
          pick: "Push as a best-effort wakeup, coalesced per device on a 30-second floor",
          instead: "Treating push as the delivery mechanism for offline users, tracked per message",
          decider:
            "Coalescing collapses a phone asleep for eight hours into one notification rather than forty, removing ~60% of 5.6B daily push-eligible events. Per-message reliability tracking buys nothing, because the message is already durable and the cursor delivers it.",
          flips:
            "Only if there is no durable store behind the notification, so the payload genuinely is the message rather than a hint to reconnect.",
        },
      },
    },
    {
      id: "recipient-device",
      label: "Recipient device",
      sub: "applies by msg_id, advances cursor",
      kind: "external",
      x: 40,
      y: 740,
      w: 280,
      detail: {
        what: "Bob's phone. Applies each frame by msg_id with an upsert, advances its per-conversation cursor, and emits receipts.",
        why: "At-least-once is all the transport offers, so the idempotent apply has to live here. The cursor is simultaneously the sync state and the delivered receipt, which is why those are one write rather than two.",
        numbers: [
          "~5,000 messages and ~1MB of text per user per 30 days",
          "receipts debounced on a 5-second window",
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
      sub: "(chat_id, device_id) to applied_msg_id",
      kind: "database",
      x: 440,
      y: 820,
      w: 240,
      detail: {
        what: "One high-water mark per device per conversation, doubling as the delivery receipt and the catch-up state.",
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
      from: "sender-device",
      to: "edge-a",
      label: "WebSocket",
      animated: true,
      detail: {
        what: "One long-lived TLS connection carrying sends, cursors, presence and typing in both directions.",
        why: "The server has to be able to speak first, which request-response cannot do. Opening a connection per message would also pay a handshake per message on a network where the handshake is the expensive part.",
        numbers: ["auth via JWT at the handshake", "keepalive ~every 60s to survive carrier NAT rebinding"],
        breaks:
          "Corporate proxies that strip the Upgrade header and captive portals that kill idle connections cost a low single-digit percentage of sessions, which is why long polling ships as a fallback on day one.",
      },
    },
    {
      id: "e2",
      from: "edge-a",
      to: "persist",
      label: "send + client_msg_id",
      animated: true,
      detail: {
        what: "The send frame handed off the socket to the write path, carrying the client-generated idempotency key.",
        why: "The edge deliberately does not write. Keeping persistence in one component is what makes commit-before-ack an enforced invariant rather than a convention every edge is trusted to honour.",
        breaks:
          "If the edge acks here instead of waiting for the commit, a crash in the next 10ms turns a delivered tick into a message that never existed.",
      },
    },
    {
      id: "e3",
      from: "persist",
      to: "dedupe",
      label: "(chat_id, client_msg_id)",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The conditional check that this client_msg_id has not already been written for this conversation.",
        why: "A lost ack plus a retry is the common case on mobile, not the exotic one, and it is the only duplicate that no downstream dedupe can repair. This read is what turns the retry into the same message.",
        numbers: ["one extra read on the write path", "24h window"],
        breaks:
          "It costs a read on every single send, including the large majority that are not retries at all.",
      },
    },
    {
      id: "e4",
      from: "persist",
      to: "conversation-log",
      label: "quorum write",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The write that must commit before anything acknowledges the sender.",
        why: "The quorum matters as much as the write. A single-replica acknowledgement means a node loss silently deletes acked messages, and the symptom is a conversation where one side sees a message the other never will.",
        numbers: ["~10ms", "RF=3 across AZs"],
        breaks:
          "A stalled quorum surfaces to the client as a retryable failure, which is the right answer: no tick beats a wrong tick.",
      },
    },
    {
      id: "e5",
      from: "persist",
      to: "edge-a",
      label: "ack, after commit",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 100,
      detail: {
        what: "The acknowledgement carrying the assigned server msg_id, emitted only once the quorum write has committed.",
        why: "This is the invariant the whole design exists to defend. The ordering of these two operations, not their speed, is the delivery contract: the tick means stored, never that one process accepted it.",
        numbers: ["ack strictly after the commit"],
        breaks:
          "Reversing the order shaves 10ms off a 300ms budget and makes every tick retractable, which is a worse product than a slightly slower tick.",
      },
    },
    {
      id: "e6",
      from: "edge-a",
      to: "sender-device",
      label: "one tick",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 40,
      detail: {
        what: "The ack forwarded down the socket, rendering as the sender's first tick.",
        why: "Three independent facts travel back to a sender (stored, reached a device, a human looked), each produced by a different actor and each losable on its own. Conflating any two of them is the classic failure.",
        breaks:
          "If the socket died between commit and this frame, the client retries with the same client_msg_id and resolves to the original message rather than a duplicate.",
      },
    },
    {
      id: "e7",
      from: "persist",
      to: "bus",
      label: "committed record",
      animated: true,
      detail: {
        what: "The committed record published for routing, once the id exists and the write has landed.",
        why: "Delivery only starts after durability is settled, which is what makes the offline branch free: when the recipient turns out to be unreachable there is nothing left to make durable.",
        breaks:
          "If the bus is unavailable the message is still stored and still arrives on reconnect, so the incident is delivery latency rather than data loss.",
      },
    },
    {
      id: "e8",
      from: "bus",
      to: "router",
      label: "one partition per edge",
      animated: true,
      detail: {
        what: "Routing consumers reading committed records off their partitions.",
        why: "A consumer group lets routing scale independently of both the edge tier and the write path, and a restarted consumer rewinds to its offset rather than losing whatever was in flight.",
        numbers: ["~5ms hop", "435k delivered copies/s at peak"],
        breaks:
          "Consumer lag per partition is the metric that shows cross-edge routing falling behind before any user notices anything.",
      },
    },
    {
      id: "e9",
      from: "router",
      to: "members",
      label: "expand to recipients",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading chat_members to turn one chat_id into up to 1,024 recipient user_ids.",
        why: "Fan-out has to happen somewhere, and this is the cheapest place for it: after the commit, off the sender's socket, on a tier that can be scaled on its own.",
        numbers: ["2.5 recipients per send on average", "cap 1,024"],
        breaks:
          "A membership read per message hammers one row for a hot group, so it wants a short-TTL cache, and a stale entry means a just-added member misses messages until their next reconnect.",
      },
    },
    {
      id: "e10",
      from: "router",
      to: "session-registry",
      label: "which edge holds Bob?",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The routing lookup: user_id to the edge currently holding that user's socket.",
        why: "This is the hop that makes cross-edge delivery possible without any edge knowing about any other. It is a cache read on the delivery path and deliberately not on the write path, so its staleness can never cost a message.",
        numbers: ["8GB of entries", "TTL 60s"],
        breaks:
          "A stale answer routes at a dead edge. Nothing is lost: the recipient falls through to push and asks for everything after their cursor when they return.",
      },
    },
    {
      id: "e11",
      from: "router",
      to: "edge-b",
      label: "publish to owning edge",
      animated: true,
      detail: {
        what: "The routed event landing on the partition that the recipient's edge consumes.",
        why: "The edge subscribes rather than being addressed, so a rolling deploy can move sockets around without anyone recomputing a topology or tracking edge liveness.",
        breaks:
          "If the recipient reconnects to a different edge mid-flight, the event lands on the old edge's partition and is dropped; cursor replay covers it.",
      },
    },
    {
      id: "e12",
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
      id: "e13",
      from: "router",
      to: "push",
      label: "no live socket",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The handoff to APNs or FCM when the registry has no edge for this user.",
        why: "With no socket the message is already durable, so the only work left is waking the device. That is why the offline branch adds no durability work at all and the sender's experience is identical either way.",
        numbers: ["~45% of delivered copies", "coalesced on a 30-second floor"],
        breaks:
          "Push is rate-limited and lossy by contract. Treating it as delivery is how you build a system where a provider outage loses messages.",
      },
    },
    {
      id: "e14",
      from: "push",
      to: "recipient-device",
      label: "wakeup, best effort",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The platform notification that wakes the app so it can reconnect.",
        why: "The notification's only job is to get the user to open the app; the app then reconnects and asks for everything after its cursor. Demoting push to a wakeup is what stops its unreliability costing a message.",
        breaks:
          "A duplicate push is a duplicate buzz even when the duplicate message is discarded, so the push service dedupes on msg_id per device with a short TTL of its own.",
      },
    },
    {
      id: "e15",
      from: "recipient-device",
      to: "cursors",
      label: "applied_msg_id",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The device raising its high-water mark for a conversation, which is both the sync state and the delivered receipt.",
        why: "One write instead of two. The reconnect path and the receipt path want exactly the same fact, so they share a row, and a burst of forty messages collapses into a single update.",
        numbers: ["debounced on 5 seconds", "one row per (chat_id, device_id)"],
        breaks:
          "Send these only on change and a lost receipt strands the sender on one tick forever; sending cursors on a heartbeat repairs it.",
      },
    },
    {
      id: "e16",
      from: "recipient-device",
      to: "edge-b",
      label: "reconnect + cursors",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "On reconnect the device presents its per-conversation cursors and asks for everything after them.",
        why: "This single mechanism covers crashes, deploys, flaky mobile networks and users offline for months, and it is what demotes push notifications from delivery to wakeups.",
        numbers: ["up to 30s of client jitter before reconnecting", "resync marker above ~500 messages or 7 days"],
        breaks:
          "Beyond the resync bound the server jumps the cursor forward instead of streaming, so those messages are never individually acked and their senders' ticks never complete.",
      },
    },
    {
      id: "e17",
      from: "edge-b",
      to: "conversation-log",
      label: "backlog after cursor",
      fromSide: "right",
      toSide: "right",
      offset: 120,
      detail: {
        what: "The catch-up read: everything in a conversation after the device's cursor, plus paginated scroll-back history.",
        why: "The store is partitioned by chat_id and clustered by msg_id, so send order comes back for free and a range scan after a cursor is one query rather than a merge across partitions.",
        numbers: ["50 messages per history page", "coalescing turns 1,000 devices opening a room into one query"],
        breaks:
          "Without a coalescing layer in front, 1,000 devices opening the same hot room at once is 1,000 identical range scans; Discord reported that layer as the larger win of its 2022 storage work, ahead of the database change itself.",
      },
    },
    {
      id: "e18",
      from: "edge-b",
      to: "session-registry",
      label: "SET user:bob edge_B EX 60",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "The edge claiming ownership of a user's socket on connect, refreshed by heartbeat every 30 seconds.",
        why: "The registry is written by whoever holds the socket, which makes recovery self-healing: a client that lands on a new box after a crash rewrites its own routing entry as a side effect of connecting.",
        numbers: ["TTL 60s, heartbeat every 30s"],
        breaks:
          "An edge that dies without expiring its entries leaves routing aiming at it for up to 60 seconds, and the TTL is the only cleanup there is.",
      },
    },
  ],
};
