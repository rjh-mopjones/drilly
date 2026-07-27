## Messaging Fundamentals & Why Brokers

### Summary

**What this topic covers**

This topic frames the whole primer: what a message broker actually *is*, what problem it solves that a plain network call does not, and — just as important — when reaching for one is a mistake. Before you argue Kafka vs RabbitMQ vs SQS, you need the vocabulary and the decision framework. We cover synchronous request/response versus asynchronous messaging, the three things a broker buys you (temporal decoupling, spatial decoupling, buffering/load-leveling plus fan-out), the semantic difference between a *message*, an *event*, and a *command*, the three storage shapes brokers come in (queue, log, topic), push versus pull delivery, and the honest anti-cases where a broker adds latency, ops burden, and moving parts you did not need.

**Mental model**

A synchronous call is a phone call: both parties must be present, and the caller waits on the line until the callee answers. A broker turns that phone call into a *postal system*. The producer drops a message in a mailbox and walks away; the consumer collects it whenever it is ready. Neither has to be online at the same instant, neither needs the other's address, and if the consumer is slow or dead the mail piles up in the box rather than being lost or blocking the sender. That single indirection — put a durable buffer *between* producer and consumer — is the whole idea. Everything else (ordering, delivery guarantees, partitioning, replication) is engineering to make that mailbox reliable, fast, and multi-reader. Hold the mailbox picture and most broker behavior becomes derivable: backpressure is a full mailbox, a consumer group is many clerks sharing one set of boxes, a dead-letter queue is the "return to sender" bin.

**Key terms**

- **Broker** — a server (or cluster) that accepts messages from producers and holds them until consumers retrieve them; the intermediary that decouples the two sides.
- **Producer / publisher** — the party that writes messages in.
- **Consumer / subscriber** — the party that reads messages out.
- **Synchronous (request/response)** — caller blocks waiting for a reply; failure is immediate and visible.
- **Asynchronous messaging** — caller hands off and continues; the reply, if any, arrives on a separate channel later.
- **Temporal decoupling** — producer and consumer need not be running at the same time.
- **Spatial decoupling** — producer and consumer need not know each other's location, address, or even count.
- **Load-leveling (buffering)** — the broker absorbs traffic spikes so a bursty producer does not overwhelm a steady consumer.
- **Fan-out** — one message delivered to many independent consumers.
- **Queue** — a message store where each message is consumed once by one worker (work distribution).
- **Log** — an append-only, ordered, retained sequence that many consumers read independently by offset (Kafka's model).
- **Topic** — a named channel; in pub/sub, a subscription target for fan-out.
- **Message vs event vs command** — a message is the envelope; an *event* states a fact that already happened; a *command* requests an action.
- **Push vs pull** — broker delivers to consumers (push) vs consumers fetch on their own cadence (pull).

**Why interviewers ask this**

This is the altitude check. A junior answer jumps straight to "use Kafka" and lists features. A senior answer starts with the *coupling problem* and treats the broker as one tool among several — sometimes the wrong one. Interviewers want to hear you name temporal and spatial decoupling unprompted, distinguish an event from a command (because it dictates ownership and coupling direction), and — the real signal — volunteer when *not* to add a broker. Anyone who says "just add a queue" to every latency or reliability problem has not felt the operational cost of running one. The strong candidate reasons about the tradeoff: what does async buy here, and what does it cost in end-to-end latency, debuggability, and infrastructure?

**Common confusions**

- "A broker makes things faster." → It usually makes each individual request *slower* (an extra network hop plus persistence); it improves throughput, resilience, and burst tolerance, not per-message latency.
- "Queue and topic are the same thing." → A queue is consume-once work distribution; a topic (log/pub-sub) supports independent fan-out to many readers. Different delivery semantics.
- "Async means fire-and-forget / no reliability." → Async says nothing about durability; a durable broker is *more* reliable than a naked RPC because it survives consumer downtime.
- "Events and commands are interchangeable." → An event is past-tense and has many possible reactors; a command is imperative and targets one handler. Confusing them inverts your coupling.
- "Push is always better because it's real-time." → Pull gives the consumer flow control (backpressure for free); Kafka is deliberately pull-based for this reason.

**What follows from this topic**

Once you accept the mailbox model, the rest of the primer is detail. The Delivery Semantics topic makes the mailbox reliable (at-most/at-least/exactly-once, acks, idempotence). The Kafka, RabbitMQ, and Redis/NATS topics are three concrete mailbox implementations optimized for different shapes (log vs queue vs lightweight). Messaging Patterns builds work queues, pub/sub, and request-reply on top. For in-process channels and actors (no network broker) see the Concurrency primer; for Kafka as a streaming-ETL substrate see the Data Engineering primer; this topic stays on *why and when* you put a networked broker between two services at all.

### Q1. Synchronous request/response vs asynchronous messaging — what actually changes?

In synchronous request/response (HTTP, gRPC, a direct RPC) the caller opens a connection and **blocks until the callee replies**. Coupling is tight in three ways: both must be up at the same instant (temporal), the caller must know where the callee lives (spatial), and the caller's throughput is capped by the callee's speed (a slow downstream directly slows the upstream, and failures cascade).

Asynchronous messaging inserts a broker. The producer writes a message and returns immediately; a consumer processes it later on its own schedule. The reply, if one exists, comes back on a separate channel (a reply queue, a callback, an event the caller subscribes to).

What changes concretely:

- **Failure model** — sync fails *now*, in the caller's face, easy to reason about. Async fails *later*, somewhere else; you need dead-letter queues, retries, and monitoring to notice.
- **Latency vs throughput** — sync minimizes per-call latency; async trades a latency hit (extra hop + persist) for burst absorption and higher sustained throughput.
- **Backpressure** — sync propagates load upstream instantly (good and bad); async buffers it, which smooths spikes but hides a struggling consumer until the queue depth blows up.

Rule of thumb: if the caller genuinely needs the answer *before it can proceed* (a price quote, an auth check), stay synchronous. If the work can happen out of band (send email, update a search index, emit an event), go async.

### Q2. What exactly does a broker buy you? Name the properties precisely.

Four distinct wins — be able to name each, because interviewers probe whether you know they are separable:

1. **Temporal decoupling** — producer and consumer need not be alive simultaneously. The consumer can be redeployed, crash for ten minutes, or scale from zero, and messages wait in the broker instead of being lost or bounced back to the producer.
2. **Spatial decoupling** — the producer addresses a *topic/queue name*, not a host. Consumers can be added, removed, relocated, or multiplied and the producer's code never changes. This is what lets you evolve topology without touching the sender.
3. **Buffering / load-leveling** — the broker is a shock absorber. A producer that bursts to 50k msg/s feeding a consumer that steadily does 5k msg/s works fine; the backlog drains during the trough. Without the broker the consumer would be overwhelmed or the producer would have to implement its own retry/queue.
4. **Fan-out** — one publish, many independent consumers (analytics, audit, cache-invalidation) each getting their own copy without the producer knowing they exist. Adding a fifth consumer is a config change, not a code change to the producer.

A fifth, often-cited benefit is **durability/replay** for log-shaped brokers: because the log is retained, a new or recovered consumer can re-read history — but that is Kafka/Pulsar-specific, not a universal broker property (a classic queue deletes on ack). Keep that distinction sharp.

### Q3. Message vs event vs command — why does the distinction matter?

All three travel as the same wire artifact (a *message* = headers + payload). The distinction is **semantic and about coupling direction**:

- **Command** — "do this." Imperative, addressed to a specific handler that is expected to act: `ChargeCard`, `SendEmail`, `ReserveInventory`. The sender knows a consumer exists and expects the action. Coupling points *from sender to receiver*. Naturally maps to a **queue** (one handler, consume-once).
- **Event** — "this happened." Past tense, a statement of fact the emitter has already committed: `OrderPlaced`, `PaymentCaptured`, `UserSignedUp`. The emitter does *not* know or care who reacts — zero, one, or ten consumers. Coupling is inverted: consumers depend on the producer's event schema, the producer depends on nobody. Naturally maps to a **topic / pub-sub** (fan-out).
- **Message / document** — the neutral term, or a payload passed for the receiver to interpret (a plain data transfer) with no imperative or historical connotation.

Why interviewers care: choosing *event* over *command* is an architecture decision. Events give you loose coupling and easy extension (add a consumer, the producer never learns). Commands give you clear intent and a single owner but couple the sender to knowing the action must happen. A very common design smell is a "command" dressed as an event (`ShouldSendEmail`) — that inverts the ownership and usually signals the boundary is in the wrong place.

### Q4. Queue vs log vs topic — the three storage shapes at a high level.

These are the three fundamental broker models; almost every product is one or a blend:

| Shape | Semantics | Read model | Canonical example |
|---|---|---|---|
| **Queue** | Consume-once; each message goes to exactly one worker; deleted on ack | Competing consumers share the queue (work distribution) | RabbitMQ classic/quorum queue, SQS |
| **Log** | Append-only, ordered, *retained*; messages are not deleted on read | Each consumer tracks its own **offset**; many read the same data independently | Kafka partition, Pulsar, Kinesis |
| **Topic (pub/sub)** | Named channel for fan-out; copy per subscriber | Subscribers each get their own copy | SNS, NATS subjects, MQTT topics, Redis pub/sub |

The load-bearing difference is **what happens on read**. A queue *removes* the message when a worker acks it — so ten workers on one queue split the load (each message done once). A log *leaves the message in place*; the consumer just advances a cursor, so ten independent consumer groups each see every message, and one group's workers split the partitions among themselves. That is why Kafka does both fan-out *and* work distribution with the same primitive (topic = fan-out across groups, partitions = work-split within a group), whereas RabbitMQ separates them (exchange = fan-out, queue = work-split).

"Topic" is overloaded: in Kafka a topic is a log; in RabbitMQ a "topic exchange" is a routing rule; in JMS/SNS a topic is pub/sub fan-out. Always pin down which model someone means.

### Q5. Push vs pull delivery — what's the tradeoff?

**Push**: the broker sends messages to the consumer as they arrive (RabbitMQ's default `basic.consume`, SNS→HTTP, MQTT). Low latency, simple consumer, but the broker must guess the consumer's capacity — so it needs a **prefetch / QoS** limit (`basic.qos prefetch_count`) to avoid burying a slow consumer, and flow control gets complicated.

**Pull**: the consumer fetches on its own cadence (Kafka `poll()`, SQS `ReceiveMessage` long-poll). The consumer sets its own pace, so **backpressure is automatic** — a busy consumer simply polls less. Cost is a little latency (poll interval) and wasted empty polls, which long-polling mitigates.

The senior point: Kafka is deliberately **pull**. It wanted consumers to control their own rate and to be able to *replay* from an arbitrary offset — both natural for pull, awkward for push. RabbitMQ is push-first (with a pull `basic.get` that is discouraged for throughput) because it targets low-latency work queues where the broker actively balances across workers. Neither is "better"; pull favors consumer-controlled flow and replay, push favors low latency and broker-driven balancing.

### Q6. When should you NOT introduce a broker?

The most senior thing you can say. A broker is not free — it adds a network hop, a persistence step, an at-least-once retry/idempotency burden, eventual-consistency debugging, and a stateful clustered system to operate, patch, and monitor. Skip it when:

- **You need a synchronous answer.** Auth checks, price quotes, "is this username taken" — the caller cannot proceed without the reply. A broker just adds latency to a fundamentally request/response interaction. Use HTTP/gRPC.
- **A direct call is fine and volumes are modest.** Two services, low traffic, no fan-out, no burst — a direct call with a retry is simpler and easier to debug than standing up and operating a cluster.
- **The database already is your queue (at small scale).** A `SELECT ... FOR UPDATE SKIP LOCKED` outbox/jobs table handles thousands of jobs/day with transactional consistency and no new infrastructure. Reach for a broker when this stops scaling or you need real fan-out — not before.
- **You need strong ordering + transactional consistency with the write.** Cross-system exactly-once is hard; sometimes a transactional outbox or a single DB transaction is the correct, simpler answer.
- **Team can't operate it.** An under-monitored Kafka/RabbitMQ cluster is a liability. If nobody owns partitions, ISR, disk alerts, and consumer-lag dashboards, a managed queue (SQS) or no queue beats a self-run one.

Anti-pattern to call out: adding a broker purely "to decouple" microservices when the real need is a synchronous call — you get eventual consistency and distributed-debugging pain for no benefit. Decoupling is a means, not a goal.

### Q7. "Just add a queue to fix our latency" — how do you respond?

Push back, because the premise is usually wrong. A broker does **not** reduce the latency of the underlying work — it *hides* it by making the caller's part async. If the user is waiting on the result, moving the work to a queue only helps if you can honestly return "accepted, we'll finish it in the background" (a 202) and the user does not need the answer inline.

Walk through it:

- If the slow thing is **on the critical path of a user-facing response** (the user stares at a spinner until it's done), a queue does not help — you have just added a hop. Fix the actual slowness: cache, index, parallelize, optimize the downstream.
- If the slow thing is **fire-and-forget side work** (send the receipt email, reindex, warm a cache) that got jammed onto the request path, then yes — a queue is exactly right. Return fast, do it async.
- If the pain is **spiky load**, a queue's load-leveling genuinely helps the *system* survive, though individual messages may sit longer during a spike (worse tail latency, better availability).

So the question I ask back: *does the caller need the result before it can respond to the user?* If yes, a queue is the wrong tool. If no, a queue is likely right — and now we discuss which one.

### Q8. Give a concrete before/after: direct call vs broker.

Order service needs to (a) charge the card, (b) send a confirmation email, (c) update the analytics warehouse.

**Direct/synchronous (all inline):**

```text
POST /order
  -> charge card        (must succeed, user waits)     ~300ms
  -> call email service (user waits, can fail)          ~200ms
  -> call analytics API (user waits, can fail)          ~400ms
total user-facing latency ~900ms; email OR analytics being down fails the order
```

Charging must be synchronous — the user needs to know it worked. But email and analytics are side effects; a blip in either should not fail a paid order, and the user should not wait 600ms for them.

**Broker for the side effects:**

```text
POST /order
  -> charge card                         (sync, user waits)   ~300ms
  -> publish OrderPlaced event to broker (async, ~2ms)
  return 200 to user                                          ~302ms
email-consumer   subscribes to OrderPlaced -> sends email   (later, retried on failure)
analytics-consumer subscribes to OrderPlaced -> loads warehouse (later, independent)
```

User-facing latency drops to ~300ms; email/analytics outages no longer fail orders (messages wait and retry); adding a fraud-check consumer later is a subscribe, not a code change to the order service. Note what stayed synchronous — the part where the caller genuinely needs the answer. That is the discipline: async the side effects, keep the critical-path answer sync.

### Q9. The interview one-liner: the topic in one crisp paragraph.

A message broker is a durable mailbox you put between a producer and a consumer, trading a bit of per-message latency and real operational cost for temporal decoupling (they need not be online together), spatial decoupling (they address a name, not each other), load-leveling (a buffer that absorbs bursts), and fan-out (one publish, many independent readers) — reach for it when work can happen out of band or one event must fan out to many reactors, model that work as past-tense **events** (fan-out, a log or topic) versus imperative **commands** (consume-once, a queue), prefer pull delivery when consumers need to control their own rate or replay, and *don't* introduce one at all when the caller needs a synchronous answer, a direct call or a DB outbox table already suffices, or nobody on the team is prepared to operate a stateful cluster.


## Messaging Patterns & Topologies

### Summary

**What this topic covers**

The reusable *shapes* that messaging systems fall into, independent of which broker you run. Before you argue Kafka versus RabbitMQ, you should be able to name the topology you need: is this a **point-to-point queue** (one message, one worker) or **publish/subscribe** (one message, every subscriber)? Are you scaling out with **competing consumers**, fanning one event out to many services (**fan-out**) and collecting results back (**fan-in**), doing **request-reply** over async transport, routing by **content or topic**, chaining stages as **pipes and filters**, or issuing a **scatter-gather** across a pool? This topic is the pattern vocabulary — largely the *Enterprise Integration Patterns* (Hohpe & Woolf) lineage — plus which brokers implement each shape naturally. Delivery-guarantee mechanics (acks, idempotence, exactly-once) live in the Delivery Semantics topic; here we care about *who gets the message and how it flows*, not how many times.

**Mental model**

Every messaging topology is an answer to two questions: **fan-out** (does this message go to one consumer or many?) and **grouping** (which consumers share the work versus each get their own copy?). A **queue** is one logical destination where consumers *compete* — the broker load-balances, each message delivered once to one of them. A **topic** is a broadcast destination — every independent subscriber gets its own copy. The clever part is that real brokers compose these two primitives. Kafka's **consumer group** is exactly "competing consumers *within* a group, pub/sub *across* groups": partitions split among a group's members (scale-out), while a second group independently reads the same log (broadcast). RabbitMQ splits them into separate objects: an **exchange** does the routing/fan-out, a **queue** does the competing-consumers part, and a **binding** wires them together. Once you see topologies as compositions of "fan or don't fan" and "compete or copy," most patterns are just those primitives wired into a graph.

**Key terms**

- **Point-to-point (queue)** — one destination, many consumers compete; each message processed by exactly one consumer. Work distribution.
- **Publish/subscribe (topic)** — one message delivered to *every* interested subscriber; decoupled broadcast.
- **Competing consumers** — multiple workers pull from one queue to scale throughput; the broker balances load. Also called a work queue.
- **Fan-out** — one input message multiplied to N destinations (one per downstream service/subscriber).
- **Fan-in** — many producers/streams converge into one queue or aggregator.
- **Request-reply** — async RPC over messaging: a request carries a `reply-to` address and a `correlation-id`; the responder posts the answer to that address.
- **Routing (content/topic-based)** — the broker selects destinations from message attributes (a routing key, a header, or payload content).
- **Pipes and filters** — a processing chain where each stage (filter) consumes, transforms, and republishes to the next pipe (queue/topic).
- **Scatter-gather** — broadcast a request to a pool of responders, then aggregate their replies (often with a timeout / quorum).
- **Claim-check** — store a large payload in a blob store and put only a reference (the "claim ticket") on the bus.
- **Message-driven vs event-driven** — a *command/message* targets a known consumer ("do this"); an *event* is a fact broadcast to whoever cares ("this happened").
- **Dead-letter** — the sidetrack destination for messages that can't be delivered or repeatedly fail; not a pattern of flow but of failure.

**Why interviewers ask this**

Pattern questions separate people who reach for one broker reflexively from people who first name the topology and *then* pick the tool. The junior answer is "use Kafka"; the senior answer is "this is competing-consumers with at-least-once, so a partitioned log or a work queue both work — but I need per-key ordering, so I'll partition by key." Interviewers want the EIP vocabulary, an honest mapping to real broker features (consumer groups, exchanges, bindings), and awareness of the failure modes each shape introduces — a stuck scatter-gather waiting on a dead responder, ordering lost when you scale competing consumers, unbounded fan-out amplification. Naming the pattern first signals that you design flows, not just wire libraries.

**Common confusions**

- "Pub/sub means multiple consumers" — no. Multiple *consumers on one queue* is competing consumers (each message once). Pub/sub means each *subscriber* gets its own copy.
- "Kafka is pub/sub, RabbitMQ is queues" — both do both. Kafka does queue-like scale-out via consumer groups; RabbitMQ does pub/sub via a fanout exchange.
- "Request-reply doesn't belong on a message broker" — it's a standard EIP; you just need a correlation-id and a reply-to address to match responses to requests.
- "Fan-out is free" — every extra subscriber multiplies load and storage; a naive fan-out to many topics can amplify write volume dramatically.
- "Events and commands are the same message" — a command names its handler and expects action; an event is a published fact with no assumption anyone is listening.
- "Big payloads just go on the bus" — past a broker's message-size sweet spot you use claim-check; putting 50MB blobs on Kafka wrecks latency and retention math.

**What follows from this topic**

Pick the topology here and the rest of the primer tells you how to run it safely. **Delivery Semantics** covers how many times each consumer in these shapes sees a message (at-least-once, idempotence, exactly-once). The **Kafka** and **RabbitMQ** deep-dives show the concrete knobs — consumer groups and partitions, exchanges/bindings and prefetch — that implement competing consumers, fan-out, and routing. **Reliability & Ops** covers the failure sidetracks (dead-letter, retry, poison messages) that every one of these flows needs in production. Routing and pipes-and-filters lead directly into streaming/ETL, where the Data Engineering primer picks up the Kafka analytics-pipeline angle.

### Q1. Point-to-point queue vs publish/subscribe — what's the actual difference?

They differ in **how many consumers get each message**, not in how many consumers exist.

- **Point-to-point (queue)**: one logical destination, and consumers **compete**. The broker hands each message to *exactly one* consumer. Add consumers and you scale throughput — the work is divided, not duplicated. This is a *work queue*. Example: order-processing workers pulling jobs.
- **Publish/subscribe (topic)**: one message is delivered to *every* interested **subscriber**, each getting its own independent copy. Adding subscribers adds *fan-out*, not throughput. Example: an `order.placed` event that billing, inventory, and analytics all need.

The classic trap: "I put five consumers on my queue, so it's pub/sub." No — five consumers on *one queue* is competing consumers; each message still goes to only one of them. Pub/sub requires each subscriber to have its own delivery stream (its own queue in RabbitMQ, its own consumer group in Kafka).

Brokers compose these. RabbitMQ: a `fanout` exchange bound to N queues gives pub/sub; one queue with N consumers gives point-to-point. Kafka: N consumer groups on a topic gives pub/sub; N members *inside* one group gives point-to-point over the partitions.

### Q2. Explain the competing-consumers pattern and how you scale it.

**Competing consumers** = multiple worker instances pull from one logical destination; the broker balances messages across them so each message is processed once. It's how you scale a work queue horizontally: throughput grows roughly linearly with worker count until you hit a shared bottleneck (the DB, the broker, or the partition count).

Two broker styles:

- **RabbitMQ work queue**: many consumers subscribe to one queue. Set `prefetch` (QoS) so a slow consumer doesn't hoard unacked messages — `channel.basic_qos(prefetch_count=10)` gives fair dispatch instead of round-robin regardless of speed. Ack after processing so a crash re-queues the message.
- **Kafka consumer group**: the unit of parallelism is the **partition**. Members of a group are each assigned a subset of partitions; the broker rebalances on join/leave. Critical limit: **you cannot have more active consumers in a group than partitions** — extra consumers sit idle. So partition count is your max parallelism; size it up front (e.g. 12–24 partitions) because increasing it later reshuffles key→partition mapping and breaks ordering.

The tradeoff competing consumers forces: **scaling out breaks global ordering**. If order matters, you must confine it — Kafka gives per-partition (per-key) ordering, so partition by the key whose order you care about (e.g. `accountId`), accepting that different keys interleave.

### Q3. Fan-out and fan-in — what are they and where do they bite?

**Fan-out**: one message becomes N — delivered to N subscribers or copied to N destinations. It's how one domain event feeds many independent consumers. **Fan-in**: many producers/streams converge onto one queue or aggregator — e.g. logs from 500 hosts into one ingestion topic, or many microservices emitting into a shared audit queue.

Where fan-out bites: **amplification**. Each subscriber multiplies delivery and storage cost. A "fan-out on write" design (copy each event into every subscriber's own queue/topic) can turn one write into hundreds — fine until you have thousands of subscribers, then it's a write storm. The alternative, "fan-out on read" (one shared log, consumers each track their own offset — Kafka's model), keeps a single copy and lets each reader progress independently, which is why Kafka scales fan-out so much better than per-subscriber-queue brokers.

Where fan-in bites: **hot spots and head-of-line blocking**. Converging everything onto one queue/partition serializes it; you lose the parallelism you had upstream and one poison message can stall the lot. Partition or shard the fan-in target, and give it a dead-letter path.

Broker mapping: RabbitMQ fan-out = a `fanout` exchange (or `topic` exchange for selective fan-out) bound to many queues. Kafka fan-out = many consumer groups reading one topic (cheap, single copy).

### Q4. How do you do request-reply over an async broker?

Async messaging is one-way by default, so you rebuild the RPC round-trip with two IDs:

1. **`reply-to`** — the request message carries the address (queue/topic) where the responder should post the answer.
2. **`correlation-id`** — a unique token the requester generates and stamps on the request; the responder copies it onto the reply so the requester can match the answer to the outstanding request (essential because replies may arrive out of order on a shared reply channel).

```
producer: publish(request, reply_to="rpc.replies.svcA", correlation_id="c-8f3a")
responder: consume(request) -> publish(response, routing_key=request.reply_to,
                                        correlation_id=request.correlation_id)
requester: match incoming.correlation_id against pending futures, resolve
```

Design choices:
- **Temporary/exclusive reply queue per client** (RabbitMQ's classic RPC): auto-deleted, simple, but a new queue per request is chatty. Better: one durable reply queue per *client instance*, demultiplexed by correlation-id.
- **Shared reply topic + correlation-id filter**: scales but every client sees every reply and filters — wasteful at high fan-out.
- **Timeouts are mandatory**: the responder may be dead. The requester must time out and either retry (idempotently) or fail. There's no TCP RST to tell you nobody's home.

Honest take: if you need low-latency synchronous request-reply at scale, gRPC/HTTP is usually the right tool; do request-reply over a broker when you specifically want the decoupling, buffering, or load-leveling the broker provides.

### Q5. Content-based vs topic-based routing — how do brokers decide where a message goes?

**Routing** is the broker selecting destinations from message attributes rather than the producer naming a queue directly.

- **Topic-based routing**: destinations are chosen by matching a **routing key** against subscription patterns. RabbitMQ's `topic` exchange is the canonical example: publish with key `order.eu.created`, and queues bound with patterns like `order.#` (all orders) or `*.eu.*` (all EU) receive it. `*` matches one word, `#` matches zero-or-more. Kafka's coarser equivalent is topic *name* selection (you subscribe to whole topics or a regex over topic names), not per-message keys.
- **Content-based routing**: the destination depends on message **content or headers**, evaluated by a rule/predicate. RabbitMQ's `headers` exchange routes on header key/value matches (`x-match: all|any`); more elaborate content routing (inspecting the payload body) is usually done by a small router service or a stream processor that reads and republishes.
- **Direct routing**: exact routing-key match (RabbitMQ `direct` exchange) — effectively named queues.

Rule of thumb: RabbitMQ's exchange types (`direct`, `topic`, `fanout`, `headers`) make it the routing-rich broker — it's built for expressive, per-message routing. Kafka deliberately keeps routing dumb (partition by key, subscribe by topic) and pushes content routing into the consumer or a stream processor, trading flexibility for throughput.

### Q6. What is the pipes-and-filters pattern and when do you use it?

**Pipes and filters** decomposes a processing task into a chain of independent **filters** (transformation stages) connected by **pipes** (queues/topics). Each filter consumes from its input pipe, does one thing, and publishes to the next. A raw-events topic → `validate` → `enrich` → `deduplicate` → `persist`, each stage its own consumer group writing to the next topic.

Why it's good:
- **Independent scaling** — a slow `enrich` stage gets more workers without touching the others.
- **Loose coupling** — stages don't know their neighbors, only the pipe contract (message schema). You can insert, reorder, or replace a filter.
- **Backpressure and buffering** — the pipe absorbs bursts; a stage that falls behind just builds queue depth rather than dropping data.
- **Resilience** — a crash in one filter doesn't lose upstream work; unacked/uncommitted messages replay.

Costs: **latency** (each hop adds serialization + network + queue time) and **ordering/exactly-once complexity** across the chain — each stage is an at-least-once boundary, so filters must be idempotent or you need per-stage dedup. Kafka Streams and Flink are essentially productized pipes-and-filters with state and exactly-once between stages; the Data Engineering primer covers that streaming side.

### Q7. Explain scatter-gather and its failure modes.

**Scatter-gather** broadcasts one request to a *pool* of responders (scatter) and aggregates their replies into a single result (gather). Think "quote this shipment across five carriers, return the cheapest," or a search query fanned to many shards and merged.

Mechanics: it's fan-out (the scatter) plus request-reply (each responder replies with the shared correlation-id) plus an **aggregator** that collects replies keyed by correlation-id until a **completion condition** fires. The completion condition is the hard part:

- **Wait for all N** — simplest, but one dead responder hangs the whole request forever. Never do this without a timeout.
- **Timeout-bounded** — collect whatever arrived by deadline T, proceed with a partial result. Standard for "best-effort aggregate" (price comparison, search).
- **Quorum / first-K** — resolve as soon as K of N reply (e.g. first cheapest, or majority agreement).

Failure modes to name in an interview: **stragglers** (one slow responder dominates tail latency — mitigate with hedged requests or timeouts), **incomplete aggregates** (decide up front whether partial is acceptable), **aggregator state** (it holds in-flight requests — needs to be durable or the request is lost on aggregator crash), and **duplicate replies** (at-least-once means a responder may answer twice — dedup by correlation-id).

### Q8. What is the claim-check pattern and why do large payloads need it?

**Claim-check**: instead of putting a large payload on the broker, you store it in an external blob store (S3, GCS, a DB) and put only a **reference** — the claim ticket (a URL or key) — on the message bus. The consumer reads the message, then fetches the blob using the reference.

Why: brokers are tuned for small messages. Kafka's default `message.max.bytes` is ~1MB and pushing it up (`max.message.bytes`, matching `replica.fetch.max.bytes`) hurts — big messages blow out replication latency, page cache efficiency, and retention math (a 50MB message occupies the log × replication factor). RabbitMQ holds messages in memory and large ones cause memory pressure and flow-control stalls. As a rule, once payloads exceed a broker's sweet spot (single-digit MB), claim-check.

```
producer: key = blobstore.put(bigPayload)      // e.g. s3://bucket/uuid
          publish({ claim: "s3://bucket/uuid", type: "video.transcoded" })
consumer: msg -> payload = blobstore.get(msg.claim); process(payload)
```

Tradeoffs to mention: you now have **two systems** and their consistency to manage — orphaned blobs if the publish fails after upload (reconcile with a TTL/GC), and the blob must outlive the message's retention + replay window (a Kafka consumer replaying week-old offsets must still find the blob). It also breaks strict end-to-end ordering guarantees if blob fetches vary in latency. But for images, video, large documents, and batch files, it's the standard move.

### Q9. Message-driven vs event-driven — is there a real difference?

Yes, and it's about **intent and coupling**, not transport.

- A **command / message** is directed: "charge this card," "resize this image." It names (implicitly) the handler, expects it to act, and often expects a result. The sender is coupled to *what should happen*. Naturally point-to-point (competing consumers): one handler should do it.
- An **event** is a **fact**: "OrderPlaced," "PaymentFailed." It states that something happened, past-tense, with no assumption about who (if anyone) is listening or what they'll do. The publisher is decoupled from consumers. Naturally pub/sub: zero-to-many subscribers each react as they see fit.

The design consequence: **command topologies couple the sender to the receiver's existence and semantics; event topologies invert that** — publishers know nothing about subscribers, so you add new reactions (a new fraud-check service on `OrderPlaced`) without touching the producer. That inversion is the whole appeal of event-driven architecture. The failure trade is that with events, *nobody owns the outcome* — if no one handles `OrderPlaced`, nothing errors; the order just silently doesn't ship. Commands fail loudly (a dead-letter, a timeout); missing event handlers fail silently. Choose commands when one specific thing *must* happen; events when you're announcing a fact and want open-ended reaction.

### Q10. Where does the enterprise-integration-patterns vocabulary come from, and why does it still matter?

Most of these names — message channel, competing consumers, content-based router, message translator, aggregator, splitter, scatter-gather, claim-check, dead-letter channel — come from Gregor Hohpe and Bobby Woolf's *Enterprise Integration Patterns* (2003), which catalogued how systems glue together over messaging. It predates Kafka and the cloud, and that's exactly why it's durable: the patterns are **topology-level**, not product-level, so they map cleanly onto whatever broker you use this decade.

Why it still matters in interviews: it gives you and the interviewer a **shared, precise vocabulary**. Saying "I'll use a content-based router feeding competing consumers, with a dead-letter channel and a claim-check for the attachments" communicates an entire design in one sentence, and it's tool-agnostic — you can then map each element to Kafka or RabbitMQ or SQS/SNS. The lineage also anchors modern frameworks: **Apache Camel**, **Spring Integration**, and **Mulesoft** are direct EIP implementations, and Kafka Streams / Flink operators (map, filter, join, window, aggregate) are the streaming descendants of the same splitter/router/aggregator ideas. Knowing the pattern names means you recognize the same shape whether it shows up as a Camel route, a Spring Integration flow, or a Kafka Streams topology.

### Q11. Which brokers naturally implement which patterns?

A cheat-sheet of the natural fits (details in the per-broker topics):

| Pattern | Kafka | RabbitMQ |
|---|---|---|
| Point-to-point / competing consumers | Members within a consumer group split partitions | Many consumers on one queue + `prefetch` |
| Publish/subscribe | Multiple consumer groups on a topic | `fanout` exchange → many queues |
| Content/topic routing | Coarse: topic name / regex; content routing in the consumer | Rich: `topic`, `direct`, `headers` exchanges |
| Fan-out | Cheap: one log, many groups read it (fan-out on read) | `fanout`/`topic` exchange (fan-out on write) |
| Request-reply | Reply topic + correlation-id (awkward) | Reply queue + correlation-id (idiomatic RPC) |
| Pipes and filters | Topic-per-stage; Kafka Streams for stateful | Queue-per-stage |
| Dead-letter | Manual (a DLQ topic + consumer logic) | Native (`x-dead-letter-exchange`) |
| Ordering under scale-out | Per-partition (per-key) | Per-queue only; lost across competing consumers |

The one-line heuristics: **Kafka** = a durable, replayable *log* — brilliant at pub/sub-with-scale-out (consumer groups = competing consumers *and* pub/sub in one primitive), fan-out on read, ordered streams, and pipes-and-filters; deliberately weak at per-message routing and RPC. **RabbitMQ** = a *smart router* — exchanges + bindings give expressive content/topic routing, native request-reply, native dead-lettering, and per-message TTL/priority; weaker at high-throughput replay and long retention. Reach for Kafka when the flow is a stream you may replay; RabbitMQ when the flow needs rich routing, per-message control, or classic RPC.

### Q12. The interview one-liner.

Messaging topologies reduce to two questions — does a message go to one consumer or many (**point-to-point/queue vs publish/subscribe**), and do consumers **compete** for work or each get a **copy** — and every richer pattern is those primitives wired into a graph: **competing consumers** to scale out, **fan-out/fan-in** to multiply and converge, **request-reply** (via `correlation-id` + `reply-to`) to fake RPC, **content/topic routing** to steer by attributes, **pipes-and-filters** to chain stages, **scatter-gather** to broadcast-and-aggregate with a timeout, and **claim-check** to keep big payloads off the bus; the senior move is to name the pattern first from the *Enterprise Integration Patterns* vocabulary and *then* map it to the broker whose primitives fit — Kafka's consumer groups (competing consumers + pub/sub in one, fan-out on read, ordered replayable streams) or RabbitMQ's exchanges and bindings (rich routing, native request-reply and dead-lettering) — because choosing the topology is design, and choosing the broker is just implementation.


## Delivery Semantics & Guarantees

### Summary

**What this topic covers**
Every message system makes a promise about how many times a message can be delivered relative to how many times it was sent: **at-most-once**, **at-least-once**, or **exactly-once**. That promise is the single most consequential design decision in a broker-backed system — it dictates whether you can lose money, double-charge a card, or send a notification twice. This topic covers what each guarantee actually means, why at-least-once plus idempotent consumers is the pragmatic default almost everyone lands on, how acknowledgements and their ordering *are* the mechanism that produces the semantic, why true exactly-once *delivery* is impossible over an unreliable network, and how Kafka, RabbitMQ, and Redis each expose these knobs.

**Mental model**
Delivery semantics are not a broker feature you switch on — they *emerge* from where you put the acknowledgement relative to your side effect. Picture two moments: the consumer does its work (writes the DB row, charges the card) and the consumer acks (tells the broker "done, delete it"). If you **ack first, then process**, a crash between the two loses the message → at-most-once. If you **process first, then ack**, a crash after processing but before the ack means the broker re-delivers → at-least-once, hence duplicates. There is no ordering that gives zero-loss *and* zero-duplicate across an arbitrary crash, because the ack itself is a network message that can be lost. So "exactly-once" is never achieved by clever delivery; it is achieved by making at-least-once *safe* — the consumer detects and absorbs the duplicate (idempotency), so re-delivery has no visible effect. Internalise this and every vendor's "exactly-once" marketing claim becomes readable: they mean exactly-once *processing* within a bounded scope, built on at-least-once delivery underneath.

**Key terms**
- **At-most-once** — deliver zero or one time; may lose messages, never duplicates. Ack-before-process, or fire-and-forget producer.
- **At-least-once** — deliver one or more times; never loses, may duplicate. Process-before-ack. The workhorse default.
- **Exactly-once (processing / "effectively once")** — the *effect* happens once, achieved by at-least-once delivery + dedup/idempotency/transactions.
- **Acknowledgement (ack)** — consumer signal that a message is handled and may be removed / offset committed. Manual vs auto.
- **Idempotency key** — a stable unique id (e.g. `payment-id`) letting a consumer recognise and drop a re-delivery.
- **Dedup store** — where seen keys live (DB unique constraint, Redis set with TTL, Kafka state store).
- **Idempotent producer** — producer that stamps sequence numbers so the broker drops retries that would otherwise duplicate on the write side.
- **fsync / durability** — flushing the message to disk before acking the producer; the line between "accepted" and "actually safe".
- **Replication factor / ISR** — how many replicas hold the message before it counts as committed (Kafka `acks=all` + in-sync replicas).
- **Two Generals Problem** — the theoretical result that two parties cannot reach certain agreement over a lossy channel; why exactly-once delivery is impossible.
- **Poison message / DLQ** — a message that fails repeatedly, routed aside so at-least-once retries don't loop forever.

**Why interviewers ask this**
It separates people who've *operated* messaging from those who've read the docs. A junior says "we use exactly-once so we're fine." A senior says "there's no such thing as exactly-once delivery; we run at-least-once and make the consumer idempotent with a unique-constraint dedup, because the ack can always be lost after we've already committed." The follow-ups probe whether you understand ack ordering, producer retries, and where the durability boundary sits — knobs like `acks=all`, `enable.idempotence`, manual ack, and prefetch. It's also a proxy for reasoning about partial failure, which is the whole game in distributed systems.

**Common confusions**
- "Exactly-once means the broker delivers once." → No. It means the *observable effect* is once; delivery underneath is at-least-once.
- "Kafka EOS makes my HTTP call to Stripe exactly-once." → No. EOS covers reads+writes *within Kafka* (transactional consume-process-produce). External side effects still need your own idempotency.
- "Auto-ack is convenient and safe." → Auto-ack is at-most-once (RabbitMQ) — a crash after delivery but before processing silently drops the message.
- "At-least-once is a bug to be eliminated." → It's the *correct* default; the fix is idempotent consumers, not chasing a stronger delivery guarantee.

**What follows from this topic**
Delivery guarantees only hold if messages survive crashes, so this connects directly to durability (persistence, fsync, replication factor 3, ISR) covered here and to reliability patterns — retries, DLQs, and backoff — in the reliability topic. Idempotency is deep enough to be its own subject (see the Idempotency topic). Ordering guarantees interact with all of this: exactly-once processing usually assumes per-key ordering, covered in the ordering/partitioning topic.

### Q1. What are the three delivery semantics, and which does each favour — losing or duplicating?

- **At-most-once** — 0 or 1 delivery. Favours *never duplicating* at the cost of *possible loss*. You get it by acking (or committing the offset) *before* processing, or by a fire-and-forget producer that doesn't wait for confirmation. Fine for high-volume, loss-tolerant telemetry (metrics, sampled logs) where a dropped sample is invisible.
- **At-least-once** — 1 or more deliveries. Favours *never losing* at the cost of *possible duplication*. You get it by processing *before* acking. This is the default for anything that matters — orders, payments, state changes.
- **Exactly-once** — the effect is applied once and only once. Not a delivery mode you can select over a network; it's at-least-once delivery made *safe* by deduplication/idempotency/transactions on the consumer side.

The crisp framing: you choose between the risk of loss and the risk of duplication, because you cannot eliminate both over an unreliable channel. Almost everyone chooses "may duplicate" and then engineers the duplicates away.

### Q2. Walk me through exactly how ack ordering determines the semantic.

Two operations on the consumer: **process** (the side effect) and **ack** (tell broker to remove / commit offset). The crash window between them decides everything.

Ack-then-process (at-most-once):
```
msg = broker.receive()
broker.ack(msg)      # broker now considers it done and will NOT redeliver
process(msg)         # CRASH here -> message is gone forever
```

Process-then-ack (at-least-once):
```
msg = broker.receive()
process(msg)         # CRASH here -> broker never got ack -> redelivers later
broker.ack(msg)      # if this ack is LOST -> broker also redelivers -> duplicate
```

Notice the second failure mode in the at-least-once path: even a *successful* `process()` produces a duplicate if the ack packet is lost, because the broker can't distinguish "consumer crashed before processing" from "consumer processed but the ack didn't arrive." That indistinguishability is the whole reason exactly-once delivery is impossible — and why the consumer must be idempotent.

### Q3. Why is true exactly-once *delivery* impossible? Bring in the Two Generals.

The **Two Generals Problem**: two generals must agree to attack simultaneously, communicating only via messengers who can be captured (a lossy channel). General A sends "attack at dawn." Did it arrive? A needs an ack. B sends the ack — did *that* arrive? B now needs an ack of the ack. This regresses infinitely; no finite exchange of messages over a lossy channel produces *certain* mutual agreement.

Map it onto delivery: the broker (A) sends a message; the consumer (B) processes and acks. If the ack is lost, the broker cannot know whether B saw the message. Its only safe options are (a) redeliver — risking a duplicate — or (b) don't — risking loss. There is no third option that guarantees exactly one delivery, because that would require certain agreement over a lossy channel, which the Two Generals result forbids. Hence: exactly-once *delivery* is provably impossible; exactly-once *processing* is achievable by making the redelivery harmless.

### Q4. So how do you actually achieve "exactly-once processing" / effectively-once?

Three mutually reinforcing techniques, layered on at-least-once delivery:

1. **Idempotency keys + dedup.** Every message carries a stable unique id. Before applying the effect, check whether you've seen it. The cheapest, most robust form is a **database unique constraint**: `INSERT INTO processed(msg_id) VALUES (?)` — a duplicate throws a constraint violation and you skip. Or a Redis `SET key val NX EX 86400` returning nil on a repeat. TTL the dedup store to the max possible redelivery window.
2. **Make the effect naturally idempotent.** Prefer `SET balance = 100` (idempotent) over `balance = balance + 10` (not). An upsert keyed by message id is inherently safe to replay.
3. **Transactions / atomic commit.** Bundle the side effect and the offset/ack commit into one atomic unit so they succeed or fail together. Kafka's transactional API and consume-process-produce EOS do exactly this *within Kafka*. For an external DB, use the **transactional outbox / inbox** pattern: dedup-insert and business write in one DB transaction.

The honest caveat: for effects on systems you don't control (charging a card, sending an SMS), you rely on *their* idempotency key support (Stripe's `Idempotency-Key` header) — you can't transactionally couple your commit to their charge.

### Q5. What does message durability mean, and where exactly is the "safe" boundary?

Durability is whether a message survives a broker crash. Three levels, increasingly strong:

- **In-memory only** — fastest, lost on restart. Redis pub/sub, RabbitMQ non-durable/transient.
- **Persisted to disk** — written to the OS, but possibly still in the page cache, not yet fsynced. Survives a process crash, *not* a power loss.
- **fsynced + replicated** — flushed to stable storage and copied to N replicas before the producer is told "accepted." Survives node loss.

The critical subtlety: a producer ack tells you the message reached the *durability level you configured*, not automatically "on disk on three machines." In Kafka, `acks=1` means "the leader has it" (leader dies before replication → lost); `acks=all` with `min.insync.replicas=2` and replication factor 3 means a quorum holds it before ack. RabbitMQ: the message must be marked **persistent** (`delivery_mode=2`) *and* the queue **durable**, *and* you must use **publisher confirms** — miss any one and a "delivered" message can vanish on restart. Durability is the floor delivery guarantees stand on: at-least-once is meaningless if the broker can lose the message it promised to redeliver.

### Q6. How does Kafka implement its delivery guarantees end to end?

Kafka splits the problem into producer-side and consumer-side, and offers real exactly-once *within Kafka*:

Producer side — **idempotent producer** (`enable.idempotence=true`, the default since Kafka 3.0):
```
enable.idempotence=true
acks=all                  # wait for all in-sync replicas
retries=2147483647        # safe to retry aggressively now
max.in.flight.requests.per.connection=5
```
Each producer gets a PID and per-partition sequence numbers; the broker drops a retry whose sequence it already wrote, so producer retries don't create duplicate records. `acks=all` + ISR gives the durability floor.

Consumer side — the default is **at-least-once**: process the record, *then* commit the offset (`enable.auto.commit=false`, commit manually after work). A crash before commit reprocesses.

**Exactly-once semantics (EOS)** — the transactional API (`transactional.id`, `initTransactions`, `sendOffsetsToTransaction`, `commitTransaction`) atomically writes output records *and* the input offsets in one transaction; consumers reading with `isolation.level=read_committed` never see aborted or partial output. This makes **consume-process-produce** pipelines exactly-once — but only for effects that live inside Kafka. An external HTTP call inside the transaction is *not* covered.

### Q7. How do RabbitMQ and Redis compare on delivery guarantees?

**RabbitMQ** — guarantees come from **publisher confirms** (broker → producer: "I've got it, and persisted if configured") plus **consumer acks** (consumer → broker: "handled, delete it"):
- Producer: enable `confirm_select`; treat a message as safe only after the confirm. Mark messages persistent and queues durable (or use quorum queues, which are durable+replicated by default and have replaced classic mirrored queues).
- Consumer: use **manual ack** (`autoAck=false`) and ack *after* processing → at-least-once. Auto-ack → at-most-once. Set a **prefetch** (`basic.qos`, e.g. `prefetch=20`) so an unacked backlog doesn't pile onto one slow consumer. Unacked messages on a dropped connection are **requeued** (hence duplicates). RabbitMQ has **no built-in exactly-once** — you dedup in the consumer.

**Redis** — two mechanisms with very different guarantees:
- **Pub/sub** is fire-and-forget, at-most-once: no persistence, no acks; a disconnected subscriber misses everything. Never use it where loss matters.
- **Streams** (`XADD` / `XREADGROUP` / `XACK`) give at-least-once with consumer groups: entries persist in the stream, unacked entries sit in the Pending Entries List and are reclaimed via `XCLAIM`/`XAUTOCLAIM`. You still dedup yourself. Durability is bounded by Redis persistence (AOF `appendfsync everysec` loses ≤1s on power loss) — see the Redis topic for internals.

Rule of thumb: Kafka for high-throughput log-structured EOS pipelines; RabbitMQ for flexible routing with per-message ack; Redis Streams for lightweight at-least-once when you already run Redis.

### Q8. A worked example: design a payment-processing consumer that can't double-charge.

Requirements: never lose a payment, never charge twice, despite at-least-once redelivery.

1. **At-least-once delivery** — process before ack/commit. Accept that duplicates will arrive.
2. **Idempotency key** — the message carries a `payment_id` generated upstream at request time (not by the consumer).
3. **Dedup via DB transaction (inbox pattern)**:
```
BEGIN;
  INSERT INTO processed_payments(payment_id) VALUES (:id);  -- UNIQUE column
  UPDATE accounts SET balance = balance - :amt WHERE ...;    -- the effect
COMMIT;
```
A redelivery hits the unique-constraint violation on the INSERT, the whole transaction rolls back, and you simply ack — the charge is not repeated.
4. **External charge** — if calling a payment gateway, pass `payment_id` as *their* idempotency key so their side also dedups; store the gateway result keyed by `payment_id` so a replay returns the cached outcome instead of re-calling.
5. **Ack only after commit.** If the ack is lost, redelivery is harmless because step 3 absorbs it.
6. **Poison handling** — cap retries and route persistent failures to a DLQ so at-least-once doesn't loop forever.

This is exactly-once *processing* built entirely on at-least-once delivery — no broker "exactly-once" flag involved.

### Q9. Debugging scenario: customers report occasional duplicate emails. Walk your diagnosis.

Duplicates are the fingerprint of at-least-once delivery meeting a non-idempotent consumer. Work the chain:

- **Is the consumer idempotent?** Almost always the real bug. If "send email" has no dedup key, any redelivery double-sends. Add a dedup store keyed by a stable message id with a TTL longer than your max redelivery window.
- **Why is it redelivering at all?** Check: is `process()` slower than the ack/visibility timeout, so the broker thinks the consumer died and redelivers while it's still working? (RabbitMQ delivery timeout, SQS visibility timeout, Kafka `max.poll.interval.ms`.) Tune the timeout or shorten processing.
- **Is the ack path failing?** Look for connection drops causing RabbitMQ requeues, or offset commits failing so Kafka replays from the last committed offset. A rebalancing consumer group that commits offsets too late reprocesses a batch on every rebalance.
- **Is the *producer* duplicating?** Retries without an idempotent producer stamp the same event twice at the source. Enable `enable.idempotence=true` (Kafka) or dedup on a producer-supplied event id.
- **Ordering of side effect vs ack.** Confirm you're not acking before the email actually left the outbound queue.

Fix priority: make the consumer idempotent first (correctness), then tune timeouts (reduce redelivery rate). Don't chase "turn on exactly-once" — it doesn't exist for an external email API.

### Q10. When is at-most-once the *right* choice, not a mistake?

When the cost of a lost message is lower than the cost of the machinery to prevent loss, and duplicates would be actively harmful or expensive. Concretely:

- **High-frequency telemetry / metrics** — a dropped CPU sample among thousands is invisible; you'd never pay for acks and dedup to save it. UDP-style statsd, sampled tracing.
- **Live dashboards / presence** — you want the *latest* value; a stale-but-delivered-twice update is worse than a skipped one. Redis pub/sub fits.
- **Cache invalidation where you also have a TTL backstop** — a missed invalidation self-heals when the TTL expires.

The judgement call is about the *asymmetry* of loss vs duplication for that specific effect. Money, orders, and notifications sit on the "never lose" side → at-least-once. Firehose observability sits on the "never block, occasional loss fine" side → at-most-once. Naming this tradeoff explicitly is a senior signal; defaulting everything to the strongest guarantee is not.

### Q11. The interview one-liner: delivery semantics in one crisp paragraph.

There is no exactly-once *delivery* over an unreliable network — the Two Generals Problem guarantees you can't distinguish "consumer crashed" from "the ack was lost," so a broker must choose between risking loss (at-most-once, ack-before-process) or risking duplicates (at-least-once, process-before-ack); everyone sane picks at-least-once and engineers the duplicates away with idempotent consumers — a stable idempotency key checked against a dedup store (a DB unique constraint is the gold standard), backed by durable, replicated messages (`acks=all`, replication factor 3, ISR) so redelivery is always possible — which is what "exactly-once processing" or "effectively once" actually means, and it's why Kafka's EOS only covers effects *inside* Kafka while RabbitMQ (confirms + manual acks) and Redis Streams (`XACK` + PEL) leave the deduplication to you.


## Ordering, Partitioning & Message Keys

### Summary

**What this topic covers**

How brokers order messages, and why "in order" is a much weaker guarantee than most people assume. The central fact: a distributed topic that scales across machines cannot cheaply give you one global sequence. Instead brokers offer *per-partition* (Kafka), *per-queue*, or *per-key* ordering, and you buy scale by shredding a topic into partitions that are each independently ordered. This topic covers partitioning mechanics, how a message key routes to a partition, the ordering-versus-parallelism tradeoff that sits under every capacity decision, and the pitfalls (producer retries, in-flight requests, requeues, and multiple consumers) that silently reorder messages even when the broker itself is behaving.

**Mental model**

Think of a partition as a single append-only log with a monotonically increasing offset. Within that one log, order is total and free — it is just an array index. Across partitions there is *no* order at all; offset 5 in partition 0 and offset 5 in partition 1 have no defined relationship. So the design question is never "is my topic ordered?" but "what is my unit of ordering, and does every set of messages that must stay in order share that unit?" You pick a message key (customer ID, account ID, order ID) so that all events for one entity hash to the same partition and therefore land on the same log in the sequence you sent them. Everything else — throughput, consumer parallelism, rebalancing — falls out of how many partitions you chose and how evenly your keys spread across them. Ordering is a property of a key, not of a topic.

**Key terms**

- **Partition** — one ordered, append-only log; the atomic unit of ordering, storage, and parallelism in Kafka.
- **Offset** — position of a record within a partition; unique and monotonic *per partition only*.
- **Message key** — value hashed to select a partition; same key → same partition → ordered.
- **Partitioner** — producer-side function mapping key to partition (`murmur2(key) % numPartitions` by default in Kafka).
- **Total order** — one global sequence across the whole topic; only achievable with a single partition.
- **Partial (per-key) order** — order preserved within a key's partition; the practical guarantee at scale.
- **Consumer group** — set of consumers sharing a topic; each partition is consumed by exactly one member.
- **`max.in.flight.requests.per.connection`** — unacked producer requests allowed at once; >1 with retries can reorder.
- **Hot partition / key skew** — one key or partition taking disproportionate traffic, capping throughput.
- **Consistent-hash exchange** — RabbitMQ plugin that routes by key hash to give Kafka-like per-key affinity.
- **Sticky partitioning** — Kafka's default for *null-key* records: batch to one partition until full, then rotate.

**Why interviewers ask this**

Ordering is where distributed-systems intuition meets a real API. A junior answer is "Kafka is ordered" — full stop, and wrong. A mid answer knows ordering is per-partition and keys route by hash. The senior signal is understanding the *tradeoff* — that ordering and parallelism are in direct tension, that one partition means one consumer means no horizontal scale — and being able to name the subtle reorderings that happen *above* the broker: a producer retry that overtakes an earlier batch, a requeue that jumps a message to the front, two threads draining one queue. They want to see you reason about the ordering unit for a specific domain ("do payments for *different* customers need mutual ordering? no — so key by customer") rather than reciting a guarantee.

**Common confusions**

- "Kafka guarantees message order" → only *within a partition*; across partitions there is none.
- "More partitions is always better" → more partitions = more parallelism but weaker practical ordering, more open files, longer rebalances, and higher end-to-end latency.
- "Keys are for deduplication" → keys are for *routing/ordering* (and log compaction); dedup is idempotence, a separate mechanism.
- "Retries are safe" → with `max.in.flight > 1` and retries, a re-sent batch can land *after* a later one, reordering the partition. Idempotent producer fixes this.
- "RabbitMQ preserves order" → a classic queue with one consumer does; add a second consumer or a requeue and order breaks.

**What follows from this topic**

Keys and partitions are the substrate for everything downstream. Consumer-group rebalancing and scaling (see the Consumers & Consumer Groups topic) are constrained by partition count — you can never have more active consumers than partitions. Exactly-once and idempotent delivery (see the Delivery Semantics topic) depend on the idempotent producer, which is also what keeps retries from reordering a partition. Log compaction and retention (see the Storage & Retention topic) key off the same message key. Get partitioning wrong and no amount of tuning elsewhere recovers the lost order or the capped throughput.

### Q1. Why can't a distributed topic give you cheap global total ordering?

Total order means every consumer agrees on one sequence for *all* messages. To maintain that across machines you would need a single serialization point — one leader that stamps every message with a global sequence number — which is exactly the bottleneck distribution was meant to remove. That leader caps your throughput at what one machine can write, and it becomes a single point of failure requiring consensus to fail over. So brokers make a deliberate trade: they shard the topic into partitions, each an independent ordered log with its own leader, and give you total order *only within* a partition. Global order is still achievable — set the partition count to 1 — but then the whole topic runs at single-partition throughput and is consumed by a single consumer. Almost no real system needs global order; it needs order *per entity*, which partitioning delivers for free.

### Q2. How does a message key route to a partition in Kafka?

The producer computes the partition before sending. With a non-null key the default partitioner hashes it: `partition = murmur2(keyBytes) % numPartitions`. Same key bytes → same partition, deterministically, so all events for one key form an ordered sub-stream. With a null key, modern Kafka uses the *sticky* partitioner: it fills one partition's batch, then rotates to another — this improves batching versus the old round-robin without any ordering claim (there is no key to order by). You can supply a custom `Partitioner` if you need geo-affinity or to avoid a known hot key. The critical corollary: the mapping is `% numPartitions`, so if you *change* the partition count, existing keys re-map to different partitions and per-key order is broken across the resize boundary. That is a big reason partition counts are painful to change.

```java
props.put("enable.idempotence", "true");
var record = new ProducerRecord<>("payments", customerId, event); // key = customerId
producer.send(record); // all events for one customer → one partition, in order
```

### Q3. Explain the ordering-versus-parallelism tradeoff.

They pull in opposite directions and partition count is the single dial between them. One partition gives you perfect total order but exactly one consumer can read it, so throughput is capped at one machine and you cannot scale out. N partitions give you N-way consumer parallelism and N× write throughput, but now order only holds *within* each partition — messages for different keys interleave arbitrarily, and if two related messages hash to different partitions their relative order is lost. So the real design move is to choose a **key whose granularity matches your ordering requirement**: if events must be ordered per customer, key by customer, and you get both order (per customer) and parallelism (across customers) simultaneously. The tradeoff only bites when your ordering unit is coarser than your key — e.g. you need *all* orders globally sequenced, which forces one partition and kills scale. Right-sizing is really "find the finest-grained ordering unit the business actually requires."

### Q4. How do RabbitMQ and Redis Streams handle keyed ordering compared to Kafka?

Kafka bakes keying into the model — every record has an optional key and the partitioner is built in. RabbitMQ is queue-based: a classic/quorum queue preserves order FIFO *as long as* one consumer drains it, but routing is by exchange, not by a partition key, so to get Kafka-style per-key affinity you install the **consistent-hash exchange** plugin, which hashes the routing key across a set of bound queues — each queue is then your "partition" with one consumer for order. Redis Streams is a *single* append-only stream per key (the stream name); entries get monotonic IDs (`<ms>-<seq>`) and are globally ordered within that one stream, with consumer groups (`XREADGROUP`) distributing entries — but distribution across consumers means the *processing* order across consumers is no longer the stream order. If you need per-entity order in Redis Streams you shard by using multiple streams (one per key bucket), mirroring Kafka partitions manually. Net: Kafka partitions ≈ consistent-hash-bound RabbitMQ queues ≈ multiple Redis streams — same idea, different ergonomics.

### Q5. Producer retries reordered my messages. What happened and how do I fix it?

Classic footgun. With `max.in.flight.requests.per.connection > 1`, the producer has several batches to the same partition unacknowledged at once. Batch A fails transiently and is retried; meanwhile batch B (sent after A) already succeeded. A's retry now lands *after* B — the partition is reordered even though you sent them in order. The old advice was to set `max.in.flight=1`, which serializes and kills throughput. The correct modern fix is the **idempotent producer**: set `enable.idempotence=true`. Kafka then tags each batch with a producer ID and sequence number; the broker rejects out-of-order or duplicate sequences and the client transparently re-orders retries, preserving order *and* allowing up to 5 in-flight requests. In recent Kafka this is the default. So the answer is rarely "turn off pipelining" — it is "turn on idempotence."

```properties
enable.idempotence=true
acks=all
max.in.flight.requests.per.connection=5   # safe because idempotence reorders retries
retries=2147483647
```

### Q6. Two consumers are pulling from one RabbitMQ queue and order is broken. Why?

A single queue delivers messages FIFO, but "in order" only holds end-to-end if *one* consumer processes them serially. Put two consumers on the same queue and the broker round-robins deliveries: consumer 1 gets msg 1, consumer 2 gets msg 2, and now their processing races — msg 2 can commit before msg 1. Prefetch makes it worse: with `prefetch=10` each consumer buffers ten messages, so even a brief stall on one consumer lets the other run far ahead. And RabbitMQ's **requeue-on-nack/reject sends a message back toward the front** of the queue by default, so a failed msg 3 can be redelivered *before* msg 4 that already went out — order gone. Fixes: for strict order use a single consumer with `prefetch=1`, or shard into per-key queues (consistent-hash exchange) so each ordered sub-stream has its own single consumer. There is no "ordered fan-out to many consumers on one queue" — that is a contradiction.

### Q7. How do I choose a partition count, and why is it hard to reduce later?

Size from three constraints. First, **target throughput** ÷ per-partition throughput — a partition sustains roughly tens of MB/s, so plan MB/s ÷ that. Second, **peak consumer parallelism**: partition count is the hard ceiling on active consumers in a group, so pick at least your maximum expected consumer instances (people often go 2–3× to leave headroom). Third, **key cardinality and skew** — partitions only help if keys spread; a few hot keys create hot partitions regardless of count. Reducing count later is the painful part: Kafka *cannot decrease* partitions on a topic at all (only increase), because shrinking would require re-shuffling existing data and would silently break per-key order — key K currently lives on `hash % oldN` and would need to move. Even *increasing* is disruptive: new records for existing keys re-map to different partitions, so per-key ordering is only guaranteed *going forward*, not across the resize. Practically you over-provision modestly at creation (e.g. 12–30 for a busy topic) and treat partition count as near-immutable; if you truly must re-partition, you create a new topic and migrate.

### Q8. Does keying guarantee even load across partitions?

No — keying guarantees *co-location and order*, not balance. Load is even only if your key distribution is uniform and no single key dominates. A "customer ID" key is fine when traffic is spread across millions of customers, but if one whale customer sends 40% of events, its partition is a **hot partition**: one consumer maxed out while others idle, and you cannot split that key without breaking its order. Detect it with per-partition lag and byte-rate metrics — a persistently lagging single partition is the tell. Mitigations all trade some ordering: add a salt/bucket to the hot key (`customerId + "-" + (n % 4)`) to spread it across 4 partitions *if* sub-ordering within the customer is acceptable; use a custom partitioner that special-cases known hot keys; or accept that the true ordering unit for that customer must be single-threaded. There is no free lunch — you cannot have per-key order *and* spread a single hot key.

### Q9. When is losing global order actually a correctness bug, and how do you design around it?

It bites when downstream state depends on sequence *across* what you partitioned by. Example: you key an "account balance" event stream by `transactionId` for even spread — now two events for the *same account* land on different partitions and can be applied out of order, corrupting the balance. The account is the real ordering unit, not the transaction. Fix: key by `accountId`. General rule: **partition by the entity whose event order matters**, even at some skew cost, because reordering within that entity is a correctness bug while skew is only a performance problem. When two *different* entities genuinely must be jointly ordered (rare — e.g. a transfer touching two accounts), you cannot express that with one key; you either route both to a deterministic single partition (e.g. `min(accountA, accountB)`), serialize through a single-partition "control" topic, or handle the cross-entity ordering in application logic with sequence numbers and buffering. Recognizing that the broker won't do cross-key ordering for you is the senior insight.

### Q10. The interview one-liner: sum up ordering and partitioning.

Brokers don't order topics, they order *partitions*: a partition is a single append-only log where order is total and free, and you scale a topic by hashing a message key across many such logs — so the only ordering guarantee at scale is per-key (all events for one key share one partition, in send order), bought at the cost of no order *across* keys. That makes partition count the one dial between ordering and parallelism (one partition = ordered but single-consumer and unscalable; N partitions = N-way parallel but only per-key ordered), and it makes your key choice a correctness decision — key by the entity whose sequence actually matters. Then watch the reordering that happens *above* the broker: producer retries with multiple in-flight requests (fix with `enable.idempotence=true`), RabbitMQ requeue-to-front, and any time more than one consumer drains a single ordered stream.


## Backpressure, Flow Control & Consumer Lag

### Summary

**What this topic covers**

This topic is about what happens when producers are faster than consumers — the single most common failure mode in any broker deployment. It covers the two structural approaches (push vs pull) and how each copes with a slow consumer, the concrete knobs that bound in-flight work (RabbitMQ prefetch/QoS, Kafka `max.poll.records`), the health metric that tells you a mismatch exists (Kafka consumer lag), and the strategies for surviving overload without falling over (bounded buffers, pause/resume, drop/sample, load-shedding, spill-to-disk). It also covers RabbitMQ's flow-control and resource alarms that block publishers, and why treating a broker as an infinite buffer is an anti-pattern rather than a solution.

**Mental model**

Backpressure is the mechanism by which a slow stage tells fast stages upstream to slow down. In a healthy pipeline, pressure propagates: a slow consumer stops acking, the broker's queue stops draining, and eventually the producer is throttled or blocked. The broker sits in the middle as a shock absorber — it smooths bursts, but its buffer is finite, so it can only decouple producer and consumer *rates* if those rates match *on average*. If mean produce rate exceeds mean consume rate, no buffer size saves you; the queue grows without bound until it hits a resource limit, and then something fails abruptly. The design question is never "how do I make the buffer big enough" — it's "when the buffer fills, do I block the producer, drop data, or shed load, and is that the correct choice for this data?" Push brokers must implement flow control explicitly because the broker controls the pace; pull brokers get backpressure almost for free because the consumer controls the pace and simply polls slower.

**Key terms**

- **Backpressure** — a downstream-to-upstream signal that throttles producers when consumers can't keep up.
- **Push vs pull** — broker decides delivery pace (RabbitMQ) vs consumer decides delivery pace by polling (Kafka).
- **Prefetch / QoS** — RabbitMQ `basic.qos(prefetch_count=N)` caps the number of unacked messages a consumer may hold.
- **Consumer lag** — Kafka's `log-end-offset − committed-offset` per partition; how far behind a consumer is.
- **Bounded buffer** — a queue with a hard capacity that forces a decision (block/drop) when full.
- **Load-shedding** — deliberately rejecting or dropping work at the edge to protect the system's ability to serve the rest.
- **Flow control** — RabbitMQ throttling publishers when the server can't keep up internally (TCP backpressure on the connection).
- **Resource alarm** — RabbitMQ memory/disk watermark that blocks *all* publishing connections until pressure clears.
- **Spill-to-disk** — paging queued messages to disk when memory fills, trading latency for capacity.
- **Unbounded-queue anti-pattern** — relying on the broker as an infinite buffer to mask a persistent rate mismatch.

**Why interviewers ask this**

Anyone can wire a producer to a consumer; the senior signal is knowing what happens under sustained overload. A junior answer is "increase the queue size" or "add more consumers" without reasoning about whether the mismatch is transient (a burst — buffering is correct) or structural (mean rates diverge — buffering only delays the crash). Seniors reach for the right lever: prefetch to bound RabbitMQ memory, lag monitoring plus partition/consumer scaling for Kafka, and an explicit overflow policy (block, drop, or shed) chosen from the data's value. They also know the failure signatures — a RabbitMQ node OOM-killed because prefetch was unlimited, a Kafka consumer group whose lag climbs linearly forever, publishers mysteriously blocking because a disk alarm fired. Naming those puts you ahead.

**Common confusions**

- "Bigger buffer fixes it" → a buffer only absorbs *bursts*; a mean-rate mismatch overflows any finite buffer.
- "Kafka has no backpressure" → it does, implicitly: a slow consumer polls slower and lag grows, but the broker is never overwhelmed because it's not pushing.
- "Prefetch is a throughput tuning knob" → it primarily bounds unacked messages (memory and fairness); too low starves throughput, too high hoards messages and defeats fair dispatch.
- "Lag in bytes vs lag in messages vs lag in time" → offset lag is a count; what usually matters operationally is time-lag (how old is the oldest unprocessed record).

**What follows from this topic**

Backpressure is where delivery guarantees meet operations: the Delivery Semantics topic explains why unacked messages redeliver, and prefetch decides how many can be in flight when that happens. The partitioning and scaling topics explain why you can only add Kafka consumers up to the partition count. For the in-process version of these same ideas (bounded channels, blocking queues), cross-reference the Concurrency primer.

### Q1. Push vs pull: how does each model handle a consumer that's suddenly too slow?

In a **push** broker (RabbitMQ, classic JMS), the broker decides when to deliver. If nothing bounded it, the broker would keep shoving messages at a slow consumer's socket, and either the broker's queue or the consumer's in-memory buffer grows until something OOMs. So push brokers need *explicit* flow control — RabbitMQ uses per-consumer prefetch (only N unacked messages outstanding) plus TCP backpressure and server-side resource alarms.

In a **pull** broker (Kafka), the consumer calls `poll()` in a loop and gets records only when it asks. A slow consumer simply polls less often. The broker is never overwhelmed — it just keeps the log on disk and the consumer's committed offset falls further behind (lag grows). Backpressure is automatic and local: the consumer self-throttles by construction. The cost is that the mismatch is invisible unless you *monitor lag* — nothing pushes back on the producer, so data quietly piles up in the retained log until retention deletes it (and you lose unread messages).

One-line rule: push needs engineered flow control; pull gives you backpressure for free but hides the mismatch behind a lag metric you must watch.

### Q2. What does RabbitMQ prefetch (`basic.qos`) actually do, and how do you tune it?

`basic.qos(prefetch_count=N)` tells RabbitMQ: never have more than `N` delivered-but-unacked messages outstanding to this channel/consumer at once. The broker dispatches up to N, then waits for acks before sending more.

```python
channel.basic_qos(prefetch_count=20)      # at most 20 unacked in flight
channel.basic_consume(queue="orders", on_message_callback=handle)  # manual ack in handle
```

It does two things. First, it **bounds memory and blast radius**: without it (prefetch 0 = unlimited), the broker will fire the entire queue at a single consumer, buffering everything in that consumer's memory — a classic OOM. Second, it drives **fair dispatch**: with `prefetch=1` across a worker pool, a slow worker won't get a second message until it acks the first, so fast workers naturally pull more.

Tuning tradeoff:
- Too low (`1`) — safe and fair, but adds a network round-trip per message; throughput suffers on fast, short tasks.
- Too high — throughput is great but one consumer hoards messages, fairness collapses, and memory grows.

Rule of thumb: for slow/heterogeneous tasks use a low prefetch (1–10); for fast uniform tasks raise it (100+) so the pipeline stays full. Prefetch only bites when you use **manual acks** — with auto-ack there's no unacked state to bound.

### Q3. What is Kafka consumer lag and why is it THE health metric?

Consumer lag, per partition, is `log-end-offset − last-committed-offset` — how many records have been produced that this consumer group hasn't yet processed and committed. Summed across a group's partitions, it's the group's total backlog.

It's the key metric because in a pull system it's the *only* thing that tells you produce rate exceeds consume rate. A flat, low lag that oscillates with bursts is healthy. Lag that trends **monotonically upward** means a structural mismatch — the group will never catch up on its own, and once the backlog exceeds `retention.ms`/`retention.bytes`, you start silently losing unread data (records get deleted before they're consumed).

Two flavours matter:
- **Offset lag** (count) — easy to read, but 10k records could be milliseconds or hours depending on throughput.
- **Time lag** — timestamp of newest record minus timestamp of the record at the committed offset. This is what SLOs are written against ("consumers within 30s of head").

Watch lag *per partition*, not just group total — one hot or stuck partition (skewed key, poison message) hides inside a healthy-looking aggregate.

### Q4. How do you monitor Kafka lag in production?

You never eyeball it manually. Standard options:

- `kafka-consumer-groups.sh --bootstrap-server ... --describe --group my-group` — ad-hoc, shows current-offset / log-end-offset / LAG per partition. Fine for debugging, not for alerting.
- **Burrow** (LinkedIn) — evaluates lag *trend* and consumer status (OK/WARNING/STOPPED/STALLED) rather than a raw threshold, so it distinguishes "temporarily behind but catching up" from "stuck". Threshold alerts are noisy; trend evaluation is why Burrow exists.
- **kafka-lag-exporter / kafka_exporter** — Prometheus exporters that publish per-group, per-partition lag (offset and, with kafka-lag-exporter, interpolated **time lag** in seconds). Alert in Prometheus on `sum by (group) (kafka_consumergroup_lag) > threshold` or on time-lag SLO breach, dashboard in Grafana.

Alerting tip: alert on **sustained rising lag over a window** (derivative > 0 for N minutes), not on an instantaneous absolute number — bursts spike lag legitimately and a static threshold pages you at 3am for nothing.

### Q5. Lag is climbing steadily. Walk through diagnosis and fixes.

First classify: **transient** (a burst — lag spikes then drains) or **structural** (monotone rise). Steady climb = structural: mean consume rate < mean produce rate.

Diagnose:
1. Look per-partition. Is it *all* partitions (global under-capacity) or *one* (skew/poison/stuck consumer)?
2. Check consumer processing time and whether it's I/O-bound (slow downstream DB/API) or CPU-bound.
3. Check for frequent rebalances (lag resets/instability) — a consumer failing `max.poll.interval.ms` gets kicked, causing a rebalance storm that makes lag worse.

Fixes, in order of leverage:
- **Add consumers** — but only up to the partition count. A group can't have more active consumers than partitions; extras sit idle. If you're already at 1 consumer per partition, adding more does nothing.
- **Add partitions** — raises the parallelism ceiling so you *can* add consumers. Caveat: repartitioning changes key→partition mapping and breaks per-key ordering for in-flight keys; do it deliberately.
- **Speed up processing** — batch downstream writes, increase `max.poll.records`, parallelize work within a consumer (careful with offset commit correctness and ordering), remove a synchronous per-record call.
- **Raise `max.poll.interval.ms`** if long processing is triggering rebalances.
- If a single poison record stalls a partition, route it to a dead-letter topic and move on (see the Delivery Semantics topic).

The trap: scaling consumers past partition count. Partitions are the unit of parallelism; that ceiling is the real constraint.

### Q6. What backpressure strategies exist when the buffer fills, and how do you choose?

When a bounded buffer hits capacity, you must pick a policy — there is no fourth option:

- **Block / throttle producer** — apply real backpressure upstream (producer blocks or gets a "busy" signal). Correct when data is valuable and losslessness matters (payments, orders). Risk: backpressure propagates all the way to a user-facing request that now hangs.
- **Drop / sample** — discard newest (or oldest) messages, or keep 1-in-N. Correct for high-volume, low-value, replaceable data (metrics, telemetry, live positions where only the latest matters). Cheap and keeps the system responsive.
- **Load-shed** — reject work at the *edge* before it enters the pipeline (return 503, refuse enqueue) to preserve capacity for the work already accepted. Protects overall availability under a spike.
- **Spill to disk** — page the buffer to disk to extend capacity (Kafka is disk-first by design; RabbitMQ pages queues to disk under memory pressure). Buys time and smooths bursts, but only defers the problem if the mismatch is structural, and adds latency.

The decision key is **data value × replaceability**: irreplaceable + valuable → block/spill; cheap + replaceable → drop/sample; protect-the-whole → shed. Choosing "make the buffer bigger" instead of choosing a policy is how you turn a slowdown into an outage.

### Q7. Explain RabbitMQ flow control and its memory/disk alarms.

RabbitMQ has two distinct throttling mechanisms.

**Internal flow control**: RabbitMQ is built on Erlang processes connected by bounded mailboxes. When a downstream process (queue, channel) can't keep up, its mailbox fills and it stops granting *credit* to upstream processes, which propagates back to the connection and ultimately slows the publisher via TCP backpressure. You'll see connections in `flow` state in `rabbitmqctl list_connections` or the management UI — that's normal, self-healing throttling, not an error.

**Resource alarms** are blunter and global. RabbitMQ watches two watermarks:
- **Memory** — `vm_memory_high_watermark` (default ~0.4 of RAM). Cross it and the broker **blocks all publishing connections** until memory drops.
- **Disk** — `disk_free_limit`. When free disk falls below it (so the broker can't safely persist), it again **blocks publishers**.

Crucially, an alarm blocks *every* publisher on the node, including ones publishing to unrelated queues, while consumers keep draining. The signature is "all my producers suddenly hang and nothing's obviously broken" — check `rabbitmqctl status` for `{alarms, [...]}`. The fix is to stop the queue backlog that's eating memory (usually an absent or too-slow consumer, or unbounded prefetch), not to raise the watermark and pretend.

### Q8. Why is using a broker as an "infinite buffer" an anti-pattern?

Because a broker's decoupling only works if producer and consumer rates match *on average*. A queue absorbs the variance (bursts) around that mean; it cannot absorb a mean difference. If producers persistently out-run consumers, the backlog grows linearly forever, and the broker's "buffer" just hides a throughput mismatch until it converts, without warning, into a hard failure:

- RabbitMQ: memory watermark trips → all publishers blocked → an unrelated part of the system stalls.
- Kafka: backlog exceeds `retention.ms`/`retention.bytes` → unread records are deleted → silent data loss, plus recovery now means processing hours of stale backlog.

The anti-pattern is treating the queue depth as free capacity instead of as a **rate-mismatch alarm**. Growing queue depth is a symptom to be alerted on, not a resource to be consumed. The right response is to fix the mismatch (scale consumers, speed processing, or shed/drop load) — and to make the buffer *bounded* precisely so that overflow forces the block/drop/shed decision rather than deferring it into an OOM. A queue that "never fills up" isn't healthy; it just hasn't hit its ceiling yet.

### Q9. Compare Kafka and RabbitMQ specifically on backpressure and slow-consumer handling.

Same problem, opposite defaults:

| Aspect | Kafka (pull) | RabbitMQ (push) |
| --- | --- | --- |
| Who paces delivery | Consumer polls | Broker pushes |
| Slow consumer effect | Lag grows; broker unaffected | Broker/consumer memory grows unless bounded |
| Backpressure mechanism | Implicit (poll slower) | Explicit: prefetch + flow control + alarms |
| Data retention while behind | Kept on disk until `retention.ms` | Kept in queue until consumed (or TTL) |
| Failure mode under overload | Silent data loss when retention expires | Publishers blocked by memory/disk alarm |
| Key knob | `max.poll.records`, partitions, consumer count | `prefetch_count`, watermarks |
| Health signal | Consumer lag (offset/time) | Queue depth, unacked count, `flow` state, alarms |

The mental shortcut: Kafka's overload risk is **losing data quietly** (retention deletes the unread backlog), RabbitMQ's is **blocking loudly** (an alarm halts producers). Kafka wants you watching lag; RabbitMQ wants you bounding prefetch and watching queue depth.

### Q10. The interview one-liner: backpressure in one crisp paragraph.

Backpressure is the downstream-to-upstream signal that forces fast producers to slow when consumers can't keep up; a broker is a shock absorber that smooths bursts but cannot fix a mean-rate mismatch, so a persistently growing queue is a rate-mismatch alarm, not spare capacity. Push brokers like RabbitMQ must engineer flow control explicitly — `basic.qos` prefetch to bound unacked messages, internal credit-based throttling, and memory/disk alarms that block all publishers — while pull brokers like Kafka get backpressure for free because consumers set the pace, at the cost that the mismatch is invisible until you monitor **consumer lag** (`log-end-offset − committed-offset`, ideally as time-lag), which you fix by adding partitions and consumers up to the partition ceiling or speeding processing. When a bounded buffer fills you must choose block, drop/sample, or load-shed based on the data's value and replaceability — and the one wrong answer is "make the buffer bigger", which just defers a slowdown into an outage.


## Broker Landscape & Choosing One

### Summary

**What this topic covers**

The comparison view: given a real problem, *which broker do you reach for and why*. This topic sits on top of the delivery-semantics, ordering, and patterns topics and turns them into a selection decision across the six brokers a senior engineer is expected to have opinions on — **Apache Kafka**, **RabbitMQ**, **Redis** (pub/sub and Streams), **NATS / JetStream**, **Apache Pulsar**, and the **cloud managed** options (AWS SQS/SNS and Kinesis, GCP Pub/Sub). The framing axes are the ones interviewers actually probe: the underlying **model** (append-only log vs. queue/smart-broker vs. lightweight pub/sub), **ordering** guarantees, **delivery** guarantees, **retention and replay**, **routing flexibility**, **throughput and latency**, and **operational burden**. The goal is not to memorise a feature matrix — it is to internalise the two or three structural distinctions that make the matrix fall out, so you can defend a choice under follow-up questions. For the streaming-ETL angle on Kafka see the Data Engineering primer; for Redis internals and persistence see the Redis primer; this topic keeps Redis and Kafka in their *messaging* lane.

**Mental model**

There are really three families, and everything else is detail. **Log-based** brokers (Kafka, Pulsar) are an append-only, retained, replayable commit log: the broker is dumb and fast, the *consumer* is smart and tracks its own offset, and messages are **not** deleted on read — they age out by time or size. That is what makes replay, event-sourcing, fan-out to many independent consumer groups, and huge throughput natural. **Queue / smart-broker** systems (RabbitMQ, and SQS at the simple end) are the mirror image: the *broker* is smart — it does routing, per-message acknowledgement, redelivery, priorities, dead-lettering — and a message is **deleted once acked**. That is what makes task queues, RPC, work distribution, and complex conditional routing natural. **Lightweight** systems (Redis pub/sub, core NATS) are neither: they are in-memory, blindingly fast, and either fire-and-forget or only lightly durable — you reach for them for ephemeral signalling, cache invalidation, and low-latency service chatter, and you add JetStream or Redis Streams when you need durability. Ask "log or queue?" first and 80% of the decision is made.

**Key terms**

- **Log-based broker** — append-only partitioned log; consumers track offsets; messages retained and replayable (Kafka, Pulsar).
- **Queue/smart-broker** — broker does routing and per-message ack; message removed on ack (RabbitMQ, SQS).
- **Consumer group** — a set of consumers sharing a subscription; Kafka assigns one partition per consumer for parallel, ordered consumption.
- **Offset** — a consumer's position in a log; committing it is how a log-broker records progress (contrast: an ack that deletes a message).
- **Retention** — how long a broker keeps a message (`retention.ms`, `retention.bytes`); the enabler of replay.
- **Routing** — how a message reaches consumers: RabbitMQ exchanges (direct/topic/fanout/headers) vs. a Kafka topic-partition key.
- **Delivery guarantee** — at-most-once / at-least-once / effectively-once; nearly every broker defaults to at-least-once.
- **Segment/tiered storage** — log split into files that age out; Pulsar and modern Kafka can offload cold segments to object storage.
- **JetStream** — NATS' persistence layer adding streams, replay, and at-least-once on top of fire-and-forget core NATS.
- **Managed/serverless** — cloud brokers (SQS, SNS, Kinesis, Pub/Sub) where the provider runs the cluster; you trade control and cost for zero ops.
- **Ops burden** — the standing cost: ZooKeeper/KRaft, partition rebalancing, disk sizing, upgrades, DLQ plumbing.

**Why interviewers ask this**

This is the single best question for separating juniors from seniors, because there is no right answer — only defensible ones. A junior names the broker they have used and lists features. A senior starts from the *workload*: "Is this event-sourcing or a task queue? Do I need replay? What's my ordering requirement? What throughput?" — and derives the broker from the answers. The strongest signal is honesty about *when a broker is the wrong choice*: admitting Kafka is overkill for a 200-message-a-day email queue, that RabbitMQ struggles past ~50k msg/s and doesn't replay, that Redis pub/sub silently drops messages for offline subscribers, that "we already run Kafka" is a legitimate reason to use Kafka for something Rabbit would fit better. Interviewers also listen for the operational reflex — that choosing a broker is choosing an on-call burden.

**Common confusions**

- "Kafka is a message queue" → it's a *distributed log*; consumers read at their own pace and messages persist after being read, which changes everything downstream.
- "RabbitMQ can replay messages" → no; once acked, a message is gone. You need a log broker or an explicit event store for replay.
- "Redis pub/sub is durable" → core pub/sub is fire-and-forget; offline subscribers miss everything. Redis *Streams* is the durable option.
- "Kinesis is just AWS Kafka" → same log model, but shards, 24h–365d retention, and a very different (lower) throughput/partition ceiling and API.
- "SNS is a queue" → SNS is pub/sub fan-out; you fan out *to* SQS queues. The classic pattern is SNS→SQS.
- "More durable is always better" → durability costs latency and money; ephemeral signalling should stay ephemeral.

**What follows from this topic**

Once you can place a workload into log / queue / lightweight, the other topics sharpen the choice: Delivery Semantics tells you what "at-least-once" costs on each, Ordering & Partitioning explains why Kafka trades global order for parallelism, and the Reliability and Patterns topics cover the DLQ, idempotency, and outbox machinery you bolt on regardless of broker. Treat this as the map; the rest is the terrain.

### Q1. What is the single most important distinction between brokers, and how do you use it to choose?

Log vs. queue. It decides most of the rest.

A **log-based** broker (Kafka, Pulsar, Kinesis) is an append-only commit log. The broker is deliberately dumb — it appends bytes to partitions and serves them — while the *consumer* is smart: it holds an **offset** and reads forward at its own pace. Messages are retained by policy (`retention.ms=604800000` for 7 days) and are **not** deleted when read, so any number of independent consumer groups can read the same data, and you can rewind to reprocess. This is why logs own event-sourcing, streaming, CDC, audit trails, and fan-out to many teams.

A **queue / smart-broker** (RabbitMQ, SQS) inverts it: the *broker* is smart — it routes via exchanges, tracks per-message acks, redelivers on failure, supports priorities and TTLs — and a message is **deleted once a consumer acks it**. This is why queues own task distribution, RPC, and complex conditional routing.

Decision rule: **need replay, multiple independent readers, or very high throughput → log. Need rich per-message routing, priorities, or a simple "do this work once" queue → smart-broker.** If neither and you just need fast ephemeral signalling, drop to Redis/NATS.

### Q2. Give me the comparison table you'd sketch on a whiteboard.

| Broker | Model | Ordering | Delivery (default) | Retention / replay | Routing flexibility | Throughput / latency | Ops burden |
|---|---|---|---|---|---|---|---|
| **Kafka** | Partitioned log | Per-partition | At-least-once (effectively-once w/ txns) | Time/size; full replay | Low — topic + partition key | Very high (millions/s), low-ms | High — partitions, KRaft, rebalancing |
| **RabbitMQ** | Queue / smart broker | Per-queue | At-least-once | None once acked | High — direct/topic/fanout/headers | Moderate (tens of k/s), low-ms | Medium — quorum queues, DLX |
| **Redis pub/sub** | Ephemeral pub/sub | None guaranteed | At-most-once (drops if offline) | None | Channel + pattern match | Extreme, sub-ms | Low (if Redis already run) |
| **Redis Streams** | In-memory log | Per-stream | At-least-once (consumer groups) | Capped by `MAXLEN`/memory | Consumer groups | Very high, sub-ms | Low–medium |
| **NATS core** | Ephemeral pub/sub | None | At-most-once | None | Subject wildcards | Extreme, sub-ms | Very low |
| **NATS JetStream** | Log (streams) | Per-stream | At-least-once (exactly-once dedup) | Time/size/count; replay | Subject filters | High, low-ms | Low–medium |
| **Pulsar** | Log + queue hybrid | Per-partition/key | At-least-once (effectively-once) | Tiered to object store; replay | Topic + subscription types | Very high, low-ms | High — brokers + BookKeeper + ZK |
| **SQS** | Managed queue | FIFO queues only | At-least-once (exactly-once FIFO) | Up to 14 days, no replay | Minimal | High (unbounded, managed) | Near-zero |
| **SNS** | Managed pub/sub | None (FIFO opt) | At-least-once | None | Topic + subscription filters | High, managed | Near-zero |
| **Kinesis** | Managed log | Per-shard | At-least-once | 24h–365d; replay | Shard by partition key | High (per-shard capped) | Low (managed shards) |
| **GCP Pub/Sub** | Managed pub/sub+ | None (ordering keys opt) | At-least-once (exactly-once opt) | 7 days default; replay via seek | Topic + filters | Very high, auto-scaled | Near-zero |

The honest caveat: exact throughput numbers depend wildly on message size, batching, and hardware — treat the ranges as orders of magnitude, not benchmarks.

### Q3. When do you reach for Kafka, and when is it the wrong choice?

**Reach for Kafka when** you have high-throughput event streams, multiple independent consumers of the same data, a need to **replay** history (reprocessing, new consumers backfilling, event-sourcing), or you're doing stream processing / CDC. Its partitioned log gives you horizontal scale and durable, replayable ordering-per-key that nothing else matches at volume. Replication factor 3 with `acks=all` and `min.insync.replicas=2` gives strong durability; KRaft mode (GA, now the default — ZooKeeper is being removed) simplifies the control plane.

**Wrong choice when**: your volume is low and your need is a simple task queue — Kafka's operational weight (partition planning, consumer-group rebalancing, disk sizing, monitoring lag) is pure overhead for 200 emails a day; use SQS or RabbitMQ. It's also poor at per-message priorities, complex conditional routing, per-message TTL, and delayed delivery — all of which RabbitMQ does natively. And Kafka's ordering is only *per-partition*: if you need strict global ordering you're down to one partition and you've thrown away the parallelism you paid for.

### Q4. When RabbitMQ over Kafka?

When the *broker* should be doing the thinking. RabbitMQ shines at **flexible routing** — topic exchanges with routing keys like `order.eu.priority`, fanout, headers matching — and at **per-message workflow**: acks/nacks, requeue, priorities, per-message TTL, delayed delivery (via plugin), and dead-letter exchanges (`x-dead-letter-exchange`) for poison messages. It's the natural fit for **task queues** (Celery-style workers), **RPC** (reply-to queues + correlation IDs), and any "route this message to the right worker based on its content" problem.

Modern RabbitMQ note: **quorum queues** (Raft-based) have replaced classic mirrored queues for HA — mirroring is deprecated. Set a queue to quorum type for replicated, data-safe queues.

Where it loses to Kafka: throughput (comfortable in the tens of thousands msg/s, not millions), and **no replay** — once a message is acked it's gone, so it's a bad event store. If you need many independent consumers reading the same stream repeatedly, that's a log's job.

### Q5. Redis pub/sub vs. Redis Streams — when is Redis a legitimate broker?

Redis is a legitimate broker when it's *already in your stack* and you want low latency without standing up new infrastructure — but you must pick the right primitive.

**Pub/sub** (`PUBLISH`/`SUBSCRIBE`) is **fire-and-forget**: messages go only to currently-connected subscribers, nothing is stored, and an offline consumer misses everything. Great for live cache invalidation, presence, ephemeral notifications — anything where a missed message is harmless.

**Streams** (`XADD`/`XREAD`/`XREADGROUP`) is a proper in-memory **append log** with IDs, **consumer groups**, and per-message acknowledgement (`XACK`) plus a pending-entries list for redelivery. That gives at-least-once delivery and bounded replay (cap with `MAXLEN ~ 100000`). It's a real lightweight queue/log for moderate volume.

The catch for both: durability is memory-bound and tied to Redis persistence (RDB/AOF), so under a crash you can lose recent messages. Reach for Redis Streams for a fast, simple durable queue at small-to-medium scale; reach for Kafka when you need multi-day retention, huge throughput, or strong durability guarantees. See the Redis primer for persistence internals.

### Q6. Where do NATS and Pulsar fit?

**NATS** is the lightweight speed play. **Core NATS** is fire-and-forget pub/sub with subject-based addressing and wildcards (`orders.*.created`) — extreme throughput, sub-millisecond latency, tiny operational footprint. It's excellent for microservice request/reply and control-plane chatter where you don't need durability. **JetStream** is the persistence layer bolted on top: it adds durable **streams**, replay, at-least-once (with exactly-once dedup via message IDs), and retention policies — turning NATS into a credible log broker while staying far lighter to operate than Kafka. Reach for NATS when you want a single system spanning ephemeral messaging *and* light durable streaming with minimal ops.

**Pulsar** is the "why not both" broker: a log at the storage layer (Apache BookKeeper) with a serving layer that supports both **log-style** and **queue-style** subscriptions (exclusive, shared, failover, key-shared) on the same topic. Its headline strengths are **separation of compute and storage** (scale brokers and storage independently), native **tiered storage** to object stores, geo-replication, and multi-tenancy. Reach for Pulsar when you want Kafka-class streaming *plus* queue semantics and multi-tenant isolation in one system. The cost is a heavier architecture — brokers **plus** BookKeeper **plus** (historically) ZooKeeper — so the ops burden rivals or exceeds Kafka's.

### Q7. Compare the cloud managed options — SQS, SNS, Kinesis, GCP Pub/Sub.

The pitch is the same everywhere: **the provider runs the cluster, you run zero servers** — which is often the deciding factor regardless of the feature checklist.

- **SQS** — the managed *queue*. Standard queues: at-least-once, best-effort ordering, effectively unlimited throughput. **FIFO** queues: strict ordering + exactly-once within a message-group, capped around 300 msg/s (3000 batched). Retention up to 14 days but **no replay** (a delivered+deleted message is gone). Built-in DLQ via redrive policy. The default answer for a simple, durable task queue on AWS.
- **SNS** — the managed *pub/sub fan-out*. Publish once, deliver to many subscribers (SQS queues, Lambda, HTTP). The canonical durable fan-out pattern is **SNS → multiple SQS**, giving each consumer its own durable queue. Message filtering by attributes narrows delivery.
- **Kinesis** — the managed *log*. Shards (each a partition with fixed read/write capacity), partition-key ordering per shard, 24h–365d retention with **replay**. It's AWS's Kafka analogue for streaming, but with a lower per-shard throughput ceiling and a different API/scaling model (you manage shard counts).
- **GCP Pub/Sub** — global, auto-scaling pub/sub with push *and* pull, 7-day default retention, **replay via seek/snapshots**, optional ordering keys, and optional exactly-once. It leans "just works at any scale" and hides partitioning entirely.

Reach for managed when ops headcount is the constraint or you're already all-in on a cloud; accept the tradeoffs of less control, potential per-message cost at scale, and lock-in. See the aws/gcp primers for service-specific detail.

### Q8. A team says "we need a message queue for background jobs." Walk through your recommendation.

I'd interrogate the requirements before naming a product:

1. **Volume?** Hundreds/day → almost anything; millions/s → log territory.
2. **Replay / audit?** If they ever need to reprocess or new consumers must backfill → Kafka/Pulsar/Kinesis. If "do the work once and forget" → a queue.
3. **Routing complexity?** Content-based routing, priorities, delayed jobs → RabbitMQ. Flat "workers pull the next job" → SQS or Redis Streams.
4. **Ops appetite?** No platform team → managed (SQS). Already running Kafka/Redis → reuse it rather than add a system.
5. **Ordering?** Per-entity ordering (all events for `order-42` in order) → partition/group by that key (Kafka partition key, SQS FIFO message-group, Rabbit consistent-hash exchange).

For a *typical* background-job queue, my default is **SQS if they're on AWS** (zero ops, DLQ built in) or **RabbitMQ if self-hosted and they want routing/retry control**. I'd explicitly push back on Kafka unless replay or throughput justifies it — reaching for Kafka because it's fashionable is the classic over-engineering trap. And whatever we pick, I'd bolt on a **dead-letter queue** and **idempotent consumers** from day one (see the Reliability and Patterns topics).

### Q9. "We already run Kafka" — is that a good reason to use it for a new task queue?

Often yes, and it's a mature answer to give. Operational simplicity is a real, quantifiable value: one system to monitor, patch, secure, and be on-call for beats a second best-fit system that adds a whole new failure domain, dashboards, and 3am pages. If the new workload fits Kafka *adequately* — decent volume, per-key ordering is fine, you don't need per-message priorities or complex routing — reusing it is the pragmatic call.

Where I'd push back: if the workload genuinely needs what Kafka is bad at — per-message priority, delayed/scheduled delivery, complex conditional routing, or millions of *low-latency single-consumer* tasks — then bending Kafka to fit costs more in application complexity than running a small SQS/RabbitMQ alongside. The senior judgement is weighing **"one more system to operate"** against **"application-level workarounds for a broker mismatch."** Name that tradeoff explicitly rather than reflexively reusing or reflexively adding.

### Q10. What operational costs do people underestimate when choosing a broker?

The broker you pick is an on-call rota you sign up for. Underestimated costs:

- **Kafka**: partition-count planning (hard to increase later without breaking key-ordering), consumer-group **rebalancing** storms, disk capacity for retention, monitoring **consumer lag**, and the KRaft/ZooKeeper control plane. Cross-region replication (MirrorMaker) is its own project.
- **RabbitMQ**: memory/disk alarms under backpressure, choosing quorum vs. classic queues, and **queue-length blowups** when consumers fall behind (unbounded queues can OOM the broker).
- **Redis**: it's memory-bound — Streams growth needs `MAXLEN` capping or it eats RAM; persistence config (AOF/RDB) determines how much you lose on crash.
- **Pulsar**: three moving parts (brokers, BookKeeper, ZooKeeper) to understand and tune.
- **Managed (SQS/Kinesis/Pub/Sub)**: near-zero ops but **per-message/shard cost** can dominate at high volume, plus provider lock-in and quota limits that surprise you at scale.

Across all of them: **DLQ plumbing, idempotency, schema evolution, and observability** are your job regardless of broker, and they're where most of the real engineering time goes.

### Q11. How does ordering differ across these brokers, and why does it constrain the choice?

Ordering is almost never *global* — it's scoped, and the scope shapes your design.

- **Kafka / Kinesis / Pulsar**: ordering is guaranteed **only within a partition/shard**. You get ordered delivery for a given key by hashing it to a partition; across partitions there's no order. More partitions = more parallelism but weaker global ordering. Strict total order means one partition, which caps throughput.
- **RabbitMQ**: FIFO **per queue** with a single consumer; add competing consumers and ordering is no longer guaranteed across them. A consistent-hash exchange lets you shard by key while preserving per-key order.
- **SQS**: standard queues are best-effort ordering; **FIFO queues** give strict order within a **message-group-id** (and throughput is capped accordingly).
- **Redis Streams / JetStream**: ordered per stream by ID.
- **SNS / core NATS / GCP Pub/Sub (default)**: no ordering guarantee unless you opt into ordering keys / FIFO.

The constraint: **if your business needs "all events for entity X processed in order," you must be able to route X's events to a single ordered lane**, and every broker forces the same tradeoff — the finer you shard for throughput, the more you rely on keying to preserve the order you care about. See the Ordering & Partitioning topic for the mechanics.

### Q12. The interview one-liner: sum up broker selection in one crisp paragraph.

Brokers split into three families — **log-based** (Kafka, Pulsar, Kinesis) that retain and replay an append-only log so smart consumers read at their own offset, ideal for high-throughput streaming, event-sourcing, and fan-out to many independent readers; **queue / smart-broker** (RabbitMQ, SQS) where the broker does routing and per-message acking and deletes on ack, ideal for task queues, RPC, priorities, and complex routing but with no replay; and **lightweight** (Redis pub/sub, core NATS) that are blazing fast and ephemeral for signalling, upgraded to durability via Redis Streams or JetStream when needed — so the selection method is to ask **"log or queue?"**, then layer on your requirements for **replay, ordering scope, throughput, routing, and how much operational burden you're willing to own**, and to be honest that the best broker is often the one you already run rather than the theoretically perfect fit.


## Kafka Architecture

### Summary

**What this topic covers**
This topic is Kafka the *system*: what it actually is under the hood, why it scales, and how its storage and replication design produce the durability and throughput guarantees you build on. We stay on broker internals — the commit-log abstraction, topics/partitions/offsets, brokers and the cluster, leaders/followers/ISR, the controller (KRaft vs the old ZooKeeper), on-disk segments, the page-cache/zero-copy path, and how consumers track position. Delivery semantics (exactly-once, transactions, idempotent producers) and consumer-group mechanics get their own topics; here we build the mental model everything else sits on. For the analytics-pipeline and streaming-ETL angle (Spark, Flink, ingestion into a lakehouse), see the Data Engineering primer.

**Mental model**
Kafka is not a queue — it is a **distributed, replicated, append-only commit log** with a pub/sub API bolted on. Picture a giant write-ahead log sharded into partitions. Each partition is an ordered, immutable sequence of records; every record gets a monotonically increasing 64-bit **offset** that is its address forever. Producers append to the tail; the broker never mutates or reorders what is written. Consumers are just cursors reading forward from an offset they choose — the broker keeps *no* per-consumer, per-message state, which is the trick that lets one partition feed thousands of readers cheaply. Data is retained by time or size (`retention.ms`, `retention.bytes`), not by "was it consumed", so the same bytes can be replayed by a new consumer next week. Because a partition is literally a file being appended and read sequentially, Kafka rides the OS page cache and `sendfile` instead of fighting the disk. Ordering is guaranteed *within a partition only* — never across a topic. Internalize "log, not queue" and the rest (replication, replay, consumer groups, compaction) stops being surprising.

**Key terms**
- **Topic** — a named logical stream; a category of records. Split into partitions.
- **Partition** — the unit of parallelism, ordering, and replication: one ordered append-only log.
- **Offset** — the immutable position of a record within its partition; consumers commit these.
- **Broker** — one Kafka server process holding a subset of partition replicas; brokers form a cluster.
- **Leader / follower** — per partition, one replica is leader (serves all reads/writes); followers replicate it.
- **Replication factor** — number of copies of each partition across brokers (production default: 3).
- **ISR** — in-sync replicas: the leader plus followers currently caught up within `replica.lag.time.max.ms`.
- **min.insync.replicas** — with `acks=all`, how many replicas must ack a write or the producer errors.
- **Controller** — the broker managing metadata, leader election, and partition assignment.
- **KRaft** — Kafka's built-in Raft metadata quorum; GA and the default, replacing ZooKeeper.
- **Segment** — the on-disk file a partition is chunked into (`.log` + `.index`); the unit of retention/deletion.
- **Log-end offset / high-water mark** — the tail vs the highest offset replicated to all ISR (the read ceiling).

**Why interviewers ask this**
"Explain Kafka's architecture" is the fastest way to separate people who have *used* Kafka from people who *understand* it. A junior answers "it's a message queue with topics." A senior says "commit log, partitions are the ordering/replication/parallelism unit, retention is decoupled from consumption, and the leader/ISR machinery is what turns `acks` and `min.insync.replicas` into a real durability contract." Interviewers push on the tradeoffs: why replication factor 3 with `min.insync.replicas=2`, what unclean leader election costs you, why ordering is only per-partition, why adding partitions is a one-way door for keyed data. Getting the storage/replication model right is what lets you reason about the reliability and delivery-semantics questions that follow.

**Common confusions**
- **"Kafka is a message queue."** → It's a replayable log. Consumers don't drain messages; reading doesn't delete anything. Retention is time/size-based.
- **"Kafka guarantees global ordering."** → Only *within a partition*. Cross-partition order is undefined; use a partition key to co-locate records that must stay ordered.
- **"Replication factor 3 means 3 copies always accept writes."** → Only the leader takes writes; followers pull. Durability comes from ISR + `min.insync.replicas`, not RF alone.
- **"Kafka still needs ZooKeeper."** → No — KRaft is GA and the default; new clusters ship without ZooKeeper.
- **"More partitions = strictly better."** → More partitions cost open file handles, controller metadata, and end-to-end latency; and you can't easily reduce them.

**What follows from this topic**
Once the log/partition/ISR model is solid, the Delivery Semantics topic explains how `acks`, idempotent producers, and transactions turn it into at-least-once / exactly-once; the Consumer Groups topic covers how offsets and rebalancing distribute partitions across readers; and Kafka vs RabbitMQ compares this log model against a broker that *does* treat messages as a queue to be drained. For Kafka inside batch/stream analytics pipelines, cross-reference the Data Engineering primer.

### Q1. What actually is a Kafka topic, and what is a partition?

A **topic** is a logical name for a stream of records — purely an addressing convenience. The real object is the **partition**: an ordered, immutable, append-only log stored as files on a broker. A topic is just a set of partitions (`--partitions N` at creation). Producers append records to the tail of a partition; each record is assigned the next **offset** (a 64-bit integer) which is its permanent address. The broker never edits or reorders committed records — the only mutation is retention deleting old *segments* from the head.

Partitions are simultaneously the unit of three things: **ordering** (guaranteed within a partition, never across), **parallelism** (one partition is consumed by at most one consumer in a group), and **replication** (each partition is replicated independently). Which partition a record lands in is chosen by the producer: `hash(key) % numPartitions` if a key is set, otherwise sticky/round-robin batching. That means all records with the same key (e.g. one `account_id`) land in the same partition and stay strictly ordered relative to each other — the standard trick for per-entity ordering.

```bash
kafka-topics.sh --create --topic payments --partitions 12 \
  --replication-factor 3 --config min.insync.replicas=2 \
  --bootstrap-server broker1:9092
```

### Q2. Walk me through what happens when a producer sends a record.

1. The producer serializes key/value and picks a partition (key hash, or sticky batching if keyless).
2. It buffers the record into a per-partition batch (`linger.ms`, `batch.size`) and, on flush, sends the batch to the **leader** broker for that partition — the client learns the leader from cluster metadata it fetches and caches.
3. The leader appends the batch to its active log segment (into the page cache; the OS flushes to disk lazily) and assigns offsets.
4. **Followers** in the ISR pull the new records via fetch requests and append them to their own logs.
5. Acknowledgement depends on `acks`: `acks=0` (fire-and-forget, no wait), `acks=1` (leader has written it — data loss if the leader dies before a follower replicates), `acks=all`/`-1` (leader waits until all in-sync replicas have it, subject to `min.insync.replicas`).
6. Once acked, the leader advances the **high-water mark** — the highest offset visible to consumers.

The durable production config is `acks=all`, `enable.idempotence=true`, RF 3, `min.insync.replicas=2`. That survives one broker failure with no acknowledged-write loss and no duplicates from producer retries.

### Q3. Explain leaders, followers, replication factor, and ISR.

Every partition has **replication factor** copies spread across different brokers. Exactly one replica is the **leader** — it handles *all* reads and writes for that partition. The others are **followers** that continuously fetch from the leader to stay current. Followers don't serve clients (with the classic model); they exist for failover.

The **ISR (in-sync replica set)** is the leader plus every follower that is caught up — specifically, replicas whose fetch lag is within `replica.lag.time.max.ms` (default ~30s). A follower that falls behind (slow disk, GC pause, network) drops out of the ISR; when it catches up it rejoins. The ISR is the beating heart of durability: with `acks=all`, a write is only acknowledged once every ISR member has it, and **min.insync.replicas** sets the floor on ISR size for writes to be accepted at all.

The canonical setup: RF=3, `min.insync.replicas=2`, `acks=all`. Now one broker can die and the partition keeps taking writes (2 replicas still in sync ≥ the min of 2). If a *second* replica drops, the ISR shrinks below `min.insync.replicas` and producers get `NotEnoughReplicas` errors — Kafka refuses the write rather than risk acknowledging data it can't protect. That "fail the write" behavior is the whole point: it's a hard durability contract, not best-effort.

### Q4. What does the controller do, and what changed with KRaft vs ZooKeeper?

The **controller** is the brain of cluster metadata: it tracks which brokers are alive, owns the assignment of partitions to brokers, and drives **leader election** when a broker fails (picking a new leader from the surviving ISR and propagating the new metadata to all brokers).

Historically Kafka stored this metadata in **ZooKeeper**, a separate distributed system you had to run, secure, and operate. One elected controller broker watched ZooKeeper and pushed changes out. It worked but had a scaling ceiling — metadata operations funneled through ZooKeeper, and very large clusters (tens of thousands of partitions) hit slow failover and recovery.

**KRaft** (Kafka Raft) replaces ZooKeeper with a **Raft consensus quorum built into Kafka itself**. A small set of controller nodes maintain the metadata as their own internal replicated log (topic `__cluster_metadata`); the active controller is the Raft leader. Brokers *replicate* metadata from that log instead of being told about it, so failover is faster and the cluster scales to millions of partitions. KRaft is **GA and the default** — new clusters ship ZooKeeper-free, and recent Kafka drops ZooKeeper support entirely. In an interview, say KRaft is the current standard; only mention ZooKeeper as the legacy path you might still meet in an old cluster.

### Q5. Why is Kafka so fast? Explain segments, page cache, and zero-copy.

Kafka's throughput comes from doing the *simplest possible thing with the disk* and letting the kernel help.

**Segments**: each partition log is split into fixed-size **segment** files (`log.segment.bytes`, default 1 GiB, or `log.segment.ms`). Only the newest segment is active/appended; older ones are immutable. Each segment has an accompanying sparse `.index` mapping offsets → byte positions, so a fetch for offset N is a quick lookup then a sequential read. Retention and log compaction operate at *segment* granularity — deleting expired data is just unlinking whole files, which is cheap.

**Sequential I/O + page cache**: appends and reads are sequential, which is dramatically faster than random I/O even on SSDs. Kafka doesn't maintain its own in-process message cache — it writes through to the **OS page cache** and lets the kernel handle flushing and read caching. For the common "consumers are roughly caught up" case, the data a consumer wants is still in page cache, so reads never touch disk.

**Zero-copy (`sendfile`)**: to serve a fetch, Kafka would normally read file bytes into a userspace buffer then write them to the socket — copying data kernel→user→kernel. Instead it uses the `sendfile` syscall, which sends bytes straight from the page cache to the network socket **without a userspace round-trip**. Fewer copies, no serialization on the broker, less CPU — which is why a single broker can push gigabytes/second. (This also constrains features: broker-side transformation is deliberately avoided because it would break the zero-copy path.)

### Q6. How do consumers track their position? Why is there no per-message broker state?

Consumers are **cursors**, not queue-drainers. Each consumer reads forward from an **offset** it controls and periodically **commits** its position — stored in the internal `__consumer_offsets` topic, keyed by (group, topic, partition). The broker holds essentially no per-consumer, per-message state: no ack-per-message, no redelivery table, no "in flight" set like a traditional queue. All the broker tracks per group is "you're up to offset 4712 on partition 3."

This is a **pull** model: consumers `fetch` batches from the leader at their own pace. Contrast RabbitMQ, which *pushes* messages and tracks per-message acknowledgement and redelivery. Kafka's design has big consequences:

- **Cheap fan-out** — N independent consumer groups read the same partition with no extra broker bookkeeping; each just has its own offset.
- **Replay** — reset an offset to re-process history (`kafka-consumer-groups.sh --reset-offsets --to-earliest`), because the data is still there and the broker doesn't "consume" it.
- **Backpressure is the consumer's problem** — a slow consumer just falls behind (lag grows); it can't overwhelm the broker.
- **Delivery semantics live in offset-commit timing** — commit *after* processing → at-least-once (crash re-reads); commit *before* → at-most-once. That's why exactly-once needs transactions tying processing and commit together (see the Delivery Semantics topic).

### Q7. What is unclean leader election, and what's the tradeoff?

When a partition leader fails, Kafka elects a new leader. **Clean** leader election picks a new leader only from the **ISR** — a replica guaranteed to have every acknowledged write, so **no committed data is lost**. But if *all* ISR replicas are down (e.g. rack outage) and only an out-of-sync follower remains, clean election has no candidate: the partition goes **offline** and rejects reads and writes until an in-sync replica returns.

**Unclean leader election** (`unclean.leader.election.enable=true`) lets Kafka promote an **out-of-sync** replica to leader to restore availability. The cost: that replica was *behind*, so every record it hadn't replicated is **silently lost**, and offsets can effectively be rewound — consumers may see truncation. It's the classic CAP tradeoff made concrete:

- **`false` (default, recommended for durable data)** — choose consistency: no data loss, but the partition can be unavailable during a total ISR outage. Right for payments, ledgers, anything where losing an acknowledged write is unacceptable.
- **`true`** — choose availability: the partition stays writable through worse failures, at the price of possible data loss. Defensible only for tolerant streams like metrics or clickstream where a gap beats an outage.

Senior signal: name it as an explicit consistency-vs-availability knob and tie the choice to the data's value, rather than reaching for a default.

### Q8. When is Kafka the *wrong* choice?

Kafka is superb for high-throughput, ordered, replayable event streams — and overkill or a poor fit elsewhere. Be honest about this in interviews:

- **Low-volume task/job queues with per-message routing and retries** — you want RabbitMQ's push, per-message ack, priorities, TTLs, and dead-letter exchanges. Kafka has no per-message ack or native priority; retry/DLQ patterns are bolt-on (retry topics).
- **Request/reply or RPC-style messaging** — Kafka's log model fits fan-out streaming, not correlated request/response. Use a broker built for it or plain RPC.
- **Tiny scale / operational simplicity** — a 3-broker (or KRaft-quorum) cluster is real infrastructure. For a small app, a managed SQS or Redis Streams is far less to run.
- **Huge individual payloads** — Kafka is tuned for many small records; multi-MB blobs belong in object storage with a *pointer* on the topic (claim-check pattern).
- **Strict cross-topic / global ordering** — you only get per-partition order; if you truly need total order you're funneling to one partition and losing parallelism.

The reach-for-Kafka signal: high sustained throughput, durable retention, multiple independent consumers, replay, and stream processing. Otherwise a simpler broker usually wins — see the Kafka vs RabbitMQ and Choosing a Broker topics.

### Q9. The interview one-liner: describe Kafka's architecture in one crisp paragraph.

Kafka is a distributed, replicated **commit log**: each topic is sharded into **partitions**, and a partition is an ordered, immutable, append-only sequence of records addressed by monotonic **offsets**, stored on disk as segment files and served straight from the OS page cache via zero-copy `sendfile`. Each partition is replicated (RF 3 in production) across **brokers** with one **leader** taking all reads and writes and **followers** pulling to stay in the **ISR**; `acks=all` plus `min.insync.replicas=2` gives a hard durability contract that survives one broker failure with no acknowledged-write loss. A **controller** — now the built-in **KRaft** Raft quorum, GA and default, no more ZooKeeper — manages metadata and leader election, choosing between clean election (no data loss, possible unavailability) and unclean election (availability at the cost of losing un-replicated writes). Consumers are stateless **cursors** that pull batches and commit their own offsets, so the broker keeps no per-message state — which is exactly what makes cheap fan-out, replay, and time-based retention possible.


## Kafka Producers

### Summary

**What this topic covers**

The producer is the write half of Kafka and the place where most durability and ordering decisions are actually made. This topic covers the produce path from `send()` to broker acknowledgment, the `acks` durability/latency knob and how it interacts with `min.insync.replicas`, the idempotent producer (default since Kafka 3.0) that dedups retries, batching and compression for throughput, how keys route to partitions via the partitioner, and the subtle `max.in.flight.requests.per.connection` / ordering interaction. It stays on the client-side broker-protocol view; for Kafka's storage internals, ISR, and replication mechanics see the Kafka Architecture topic, and for streaming ETL pipelines see the Data Engineering primer.

**Mental model**

A producer is not a thin `write()` wrapper — it is an asynchronous batching engine. When you call `send()`, the record is serialized, assigned a partition, and appended to an in-memory **RecordAccumulator** batch for that partition. `send()` returns a `Future` immediately; it does not block on the network. A background **sender/IO thread** drains full batches (or batches that hit `linger.ms`) and ships them to the partition leader in produce requests, one in-flight request per broker connection up to `max.in.flight.requests.per.connection`. The leader appends to its log, waits for replicas per `acks`, then returns offsets. Durability, ordering, and throughput all fall out of how you tune this pipeline: `acks` decides how many replicas must confirm, `batch.size`/`linger.ms` decide how much you amortize per network round trip, and idempotence decides whether a retried batch can silently duplicate or reorder. Get these four right and the producer is boringly reliable; get them wrong and you get dupes, gaps, or reordered records under retry.

**Key terms**

- **acks** — how many replicas must acknowledge a write: `0`, `1`, or `all`(=`-1`).
- **min.insync.replicas** — broker/topic setting; minimum in-sync replicas that must be live for an `acks=all` write to succeed.
- **enable.idempotence** — dedup + ordering guarantee via producer ID and per-partition sequence numbers; default `true`.
- **RecordAccumulator** — the in-memory buffer of per-partition batches awaiting send.
- **batch.size** — max bytes per partition batch (default 16 KB).
- **linger.ms** — how long to wait accumulating a batch before sending (default 0).
- **buffer.memory** — total client-side buffer; when full, `send()` blocks up to `max.block.ms`.
- **partitioner** — maps a record to a partition; default is sticky-partition + murmur2 hash of the key.
- **max.in.flight.requests.per.connection** — unacked produce requests allowed per connection (default 5).
- **delivery.timeout.ms** — upper bound on total time from `send()` to success/failure (default 2 min); supersedes raw `retries`.
- **producer ID (PID) + epoch** — broker-assigned identity that makes idempotence and transactions possible.

**Why interviewers ask this**

Producers are where a candidate reveals whether they actually understand delivery guarantees or just recite "at-least-once." A junior answer stops at "set `acks=all` for reliability." A senior answer explains that `acks=all` alone is not durable — it only means "all *in-sync* replicas," so with `min.insync.replicas=1` and two replicas down you still lose data on an ack'd write; you need `acks=all` **and** `min.insync.replicas=2` (with RF 3) together. Seniors also know idempotence is now on by default, why `max.in.flight>1` used to break ordering under retry, and how batching trades tail latency for throughput. It's a compact way to test distributed-systems reasoning about the CAP-style durability/availability/latency tradeoffs on the write path.

**Common confusions**

- "`acks=all` guarantees no data loss" → only if `min.insync.replicas ≥ 2`; otherwise "all replicas" can be just the leader.
- "Retries cause duplicates" → true only with idempotence off; the idempotent producer dedups retried batches by sequence number.
- "`retries=0` means no retries so it's safe" → it just makes you lose data on transient errors; prefer `delivery.timeout.ms` to bound retrying.
- "More in-flight requests reorders messages" → only when idempotence is off; idempotence preserves order up to 5 in-flight.
- "`send()` blocks until the broker acks" → no, it's async; it only blocks when `buffer.memory` is exhausted.
- "Keys guarantee ordering globally" → ordering is per-partition only; a key pins a record to one partition, which is why same-key records stay ordered.

**What follows from this topic**

The producer sets up everything downstream: the Consumers topic covers the read side and offset commits that pair with these guarantees; the Delivery Semantics topic builds exactly-once on top of the idempotent producer plus transactions; and the Kafka Architecture topic explains the ISR and replication that `acks=all` depends on. For a RabbitMQ contrast on publisher confirms, see the RabbitMQ topic.

### Q1. Walk through what happens when I call `producer.send(record)`.

`send()` is asynchronous. Steps: (1) the key/value are run through the configured serializers; (2) the **partitioner** picks a partition — by key hash if a key is present, else the sticky partitioner; (3) the record is appended to the in-memory batch for that `(topic, partition)` in the **RecordAccumulator**, and `send()` returns a `Future<RecordMetadata>` right away; (4) a background **sender thread** wakes when a batch is full (`batch.size`) or `linger.ms` elapses, groups batches by destination broker, and sends produce requests to each partition **leader**; (5) the leader appends to its log and, per `acks`, waits for followers before responding with the base offset; (6) the callback fires or the `Future` completes. The only time `send()` itself blocks is when `buffer.memory` is exhausted — then it waits up to `max.block.ms` (also covers initial metadata fetch) before throwing `TimeoutException`.

### Q2. Explain `acks=0` vs `1` vs `all`, and the tradeoff.

`acks` controls how many replicas confirm before the write is considered done:

| acks | Confirmed by | Durability | Latency | Loss window |
|------|--------------|------------|---------|-------------|
| `0` | nobody (fire-and-forget) | none | lowest | any failure loses data silently |
| `1` | leader only | weak | low | leader crashes before replicating → lost |
| `all` (`-1`) | all in-sync replicas | strong | highest | none, *if* `min.insync.replicas ≥ 2` |

`acks=0` doesn't even wait for the leader — the producer never learns of failures, so retries and idempotence are effectively moot. `acks=1` is durable against consumer restarts but not against leader loss: a write acked by the leader that hasn't yet replicated is gone if that leader dies. `acks=all` waits for every in-sync replica, which is the only setting suitable for data you can't lose. The senior nuance: `acks=all` is necessary but not sufficient — see Q3.

### Q3. `acks=all` and I still lost data. How?

Because `acks=all` means "all replicas **currently in the ISR**," not "all configured replicas." If replicas fall out of the ISR (slow, restarting) until only the leader is in-sync, then `acks=all` degenerates to `acks=1` — the leader alone acks, and if it then dies you lose the write even though the producer got a success.

The fix is to pair it with `min.insync.replicas` on the topic/broker:

```properties
acks=all
```
```properties
replication.factor=3        # topic
min.insync.replicas=2       # topic/broker override
```

With RF 3 and `min.insync.replicas=2`, an `acks=all` write requires at least two in-sync replicas to succeed; if only the leader is in-sync, the producer gets `NotEnoughReplicasException` and can retry rather than silently accepting a fragile write. RF 3 / min-ISR 2 tolerates one broker down while still guaranteeing every ack'd write lives on two replicas. This trio — `acks=all`, RF≥3, min-ISR=2 — is the canonical "no data loss" producer config.

### Q4. What does the idempotent producer actually do, and how?

With `enable.idempotence=true` (default since 3.0), the broker assigns each producer a **producer ID (PID)** and epoch on init. Every record batch carries the PID plus a monotonic **sequence number** per partition. The partition leader tracks the last sequence it accepted per PID; if a batch arrives with a sequence it has already seen (because the producer retried after a network hiccup where the ack was lost), the broker **discards the duplicate** and re-acks. If a sequence arrives out of order (a gap), it rejects with `OutOfOrderSequenceException`. This turns at-least-once retries into **effectively-once per partition per session** — no duplicates from retries, and ordering preserved. It's cheap (a few bytes per batch, no cross-broker coordination) which is why it's now on by default. Enabling it forces `acks=all`, `retries>0`, and `max.in.flight.requests.per.connection ≤ 5`; if you set those to conflicting values the client throws at construction. Note the guarantee is per producer *session* — a full producer restart gets a new PID, so cross-session dedup needs transactions (see the Delivery Semantics topic).

### Q5. How do batching and compression improve throughput? What are the knobs?

Throughput on Kafka is dominated by per-request overhead, so you amortize by sending fewer, bigger requests. Two knobs:

- **`batch.size`** (default 16384 bytes) — max bytes accumulated per partition before the batch is eligible to send. Bigger batches = better compression and fewer requests, at the cost of memory.
- **`linger.ms`** (default 0) — how long the sender waits for a batch to fill before sending anyway. `0` means send as soon as the sender thread is free; setting `5`–`50`ms deliberately trades a little latency for far bigger batches under load.

Then compress the batch end-to-end:

```properties
batch.size=65536
linger.ms=20
compression.type=lz4
```

`compression.type` options: `lz4` and `snappy` (fast, moderate ratio — good default), `zstd` (best ratio, tunable, slightly more CPU — increasingly the pick for bandwidth-bound loads), `gzip` (highest CPU, avoid). Compression happens on the whole batch, so bigger batches compress better — batching and compression compound. The batch is stored and served compressed, so brokers and consumers also save disk and network. Rule of thumb: `linger.ms` of a few ms plus `lz4`/`zstd` often multiplies throughput several-fold versus defaults.

### Q6. How do keys map to partitions, and when would I write a custom partitioner?

The partition choice comes from the record key:

- **Key present** → `murmur2(keyBytes) % numPartitions`. Deterministic: the same key always lands on the same partition (as long as partition count is stable), which is how Kafka gives you **per-key ordering**.
- **No key** → the **sticky partitioner** (default since 2.4): fill one partition's batch, then "stick" to the next, rather than round-robining every record. This produces bigger batches and better throughput while still spreading load over time.

You write a **custom partitioner** (`partitioner.class`) when hash distribution isn't what you want: e.g. route by a field that isn't the key, keep a hot tenant on dedicated partitions, or implement locality. Watch out: partition count changing (adding partitions) breaks the key→partition mapping, so records for a key can reorder across the resize — design partition counts up front for keyed topics.

```java
public class TenantPartitioner implements Partitioner {
  public int partition(String topic, Object key, byte[] keyBytes,
                       Object value, byte[] valueBytes, Cluster cluster) {
    int n = cluster.partitionCountForTopic(topic);
    return Math.floorMod(tenantId((String) key), n);
  }
  public void close() {}
  public void configure(Map<String,?> cfgs) {}
}
```

### Q7. Why can `max.in.flight.requests.per.connection > 1` reorder records, and why is it safe with idempotence?

`max.in.flight.requests.per.connection` (default 5) is how many produce requests can be unacknowledged on a single connection at once. It matters under **retry**: suppose batch A and batch B are both in flight to the same partition; A fails transiently, B succeeds, then A is retried and succeeds — now B is written before A, reordering the log. Historically the only safe fixes were `max.in.flight=1` (kills pipelining and throughput) or accept reordering.

The idempotent producer solves this: because each batch has a monotonic **sequence number**, the broker rejects any batch that arrives out of sequence and the producer re-sends in order, so ordering is preserved for **up to 5 in-flight requests**. That's exactly why enabling idempotence caps `max.in.flight` at 5 — beyond that the broker can't guarantee it can reorder the retry window. So with idempotence on (the default) you keep pipelined throughput *and* ordering; only turn `max.in.flight` down to 1 if you've deliberately disabled idempotence.

### Q8. How should I handle retries and failures — `retries` vs `delivery.timeout.ms`?

Prefer `delivery.timeout.ms` as the primary knob. It bounds the **total** time from `send()` returning to a terminal success/failure — covering the initial request, all retries, and backoff. Default is 120000 (2 min). Internally the client retries until either it succeeds or `delivery.timeout.ms` expires, so the raw `retries` count (default effectively `Integer.MAX_VALUE` with idempotence) is usually left alone; `delivery.timeout.ms` is the real ceiling. Related: `retry.backoff.ms` (wait between retries), `request.timeout.ms` (per-request network wait). 

Errors split into **retriable** (leader election, `NotEnoughReplicas`, transient network — the client retries automatically) and **non-retriable** (serialization error, record too large, auth — fail fast). Don't set `retries=0` thinking it's "safer"; it just drops data on any transient blip. With idempotence on, retries are dedup-safe, so a generous `delivery.timeout.ms` plus default retries is the right posture. Surface terminal failures via the callback and decide: dead-letter, alert, or block.

### Q9. Sync vs async send — how do I know a write succeeded?

`send()` always returns a `Future<RecordMetadata>`; how you consume it defines the mode.

- **Fire-and-forget**: ignore the future. Fastest, but you never see failures. Only for lossy telemetry.
- **Async with callback** (recommended): pass a `Callback`; the sender thread invokes it with either `RecordMetadata` (offset/partition/timestamp) or an `Exception`. Non-blocking, and you still handle errors.
- **Synchronous**: call `future.get()` — blocks the calling thread until ack. Gives you strict per-call confirmation but destroys throughput (one record per round trip) and, with `max.in.flight=1`, serializes everything.

```java
producer.send(record, (metadata, ex) -> {
  if (ex != null) {
    log.error("send failed for key {}", record.key(), ex);   // dead-letter / alert
  } else {
    log.debug("ok p{} @ offset {}", metadata.partition(), metadata.offset());
  }
});
```

Use async + callback for production throughput; reserve `.get()` for tests, low-volume control messages, or when a caller genuinely must not proceed until the write is durable.

### Q10. Give me a solid production producer config and a minimal stub.

Durable, ordered, high-throughput producer (Kafka 3.x+ defaults already give you idempotence):

```properties
bootstrap.servers=broker1:9092,broker2:9092,broker3:9092
acks=all
enable.idempotence=true
max.in.flight.requests.per.connection=5
delivery.timeout.ms=120000
linger.ms=20
batch.size=65536
compression.type=zstd
buffer.memory=67108864
key.serializer=org.apache.kafka.common.serialization.StringSerializer
value.serializer=org.apache.kafka.common.serialization.StringSerializer
```

Pair with topic settings `replication.factor=3` and `min.insync.replicas=2` for the no-loss guarantee. Minimal Java stub:

```java
var props = new Properties();
props.put("bootstrap.servers", "broker1:9092,broker2:9092");
props.put("acks", "all");
props.put("enable.idempotence", "true");
props.put("compression.type", "zstd");
props.put("linger.ms", "20");
props.put("key.serializer", StringSerializer.class.getName());
props.put("value.serializer", StringSerializer.class.getName());

try (var producer = new KafkaProducer<String,String>(props)) {
  var record = new ProducerRecord<>("orders", orderId, payload);   // key pins partition
  producer.send(record, (md, ex) -> {
    if (ex != null) handleFailure(record, ex);
  });
  producer.flush();   // force any buffered batches out before close
}
```

Quick smoke test from the CLI: `kafka-console-producer --bootstrap-server broker1:9092 --topic orders --property parse.key=true --property key.separator=:`.

### Q11. The interview one-liner: producers in one crisp paragraph.

A Kafka producer is an async batching engine where durability and ordering are configuration, not defaults you can ignore: `send()` buffers records into per-partition batches that a background thread ships to partition leaders, keys hash (murmur2) to pin same-key records to one partition for per-key ordering, and `acks=all` **plus** `min.insync.replicas=2` on an RF-3 topic is the only combination that truly won't lose an acknowledged write; the idempotent producer (default since 3.0, using a producer ID and per-partition sequence numbers) makes retries dedup-safe and preserves order up to 5 in-flight requests, while `batch.size`/`linger.ms` and `zstd`/`lz4` compression trade a little latency for large throughput gains — so a production producer is `acks=all`, idempotence on, bounded by `delivery.timeout.ms`, and confirmed via async callbacks.


## Kafka Consumers & Consumer Groups

### Summary

**What this topic covers**

How Kafka's *consumer* side works: the single-threaded poll loop, the consumer-group protocol that divides partitions among cooperating members, offset management (where "how far have I read" actually lives and who is responsible for committing it), the rebalancing machinery that reassigns partitions when membership changes, and the operational knobs — static membership, session timeouts, heartbeats, `max.poll.interval.ms` — that keep a group stable under real workloads. It also covers seeking: replaying a partition from an arbitrary offset or timestamp. Consumers are where Kafka's delivery guarantees are actually *earned or lost* — the broker gives you an ordered log, but at-least-once vs at-most-once vs effectively-once is decided by how your consumer commits. This is the broker/messaging-infrastructure lens; see the Data Engineering primer for Kafka-in-Spark streaming pipelines, and the Delivery Semantics topic in this primer for the end-to-end guarantee picture.

**Mental model**

A Kafka topic is a set of partitions, each an ordered, append-only log with a monotonic offset. A consumer *group* is a named cohort of processes that collectively read a topic, with the invariant: **each partition is assigned to exactly one consumer in the group at a time**. So the group is a set of competing consumers (work is divided, throughput scales with member count up to the partition count), while running multiple *different* groups over the same topic gives pub/sub — each group gets its own full copy of the stream and its own independent offsets. Consumers pull; they are not pushed to. Progress is a per-partition integer (the committed offset) stored server-side in the `__consumer_offsets` topic. The group has a broker-side *coordinator* that tracks liveness via heartbeats and orchestrates rebalances. That is nearly the whole model: partitions divided among members, offsets committed per partition, coordinator reshuffles on membership change.

**Key terms**

- **Consumer group** — set of consumers sharing a `group.id`; partitions are divided among members, offsets are shared.
- **Group coordinator** — the broker managing a group's membership and offset commits.
- **`__consumer_offsets`** — internal compacted topic where committed offsets are durably stored.
- **Committed offset** — the last offset the group has acknowledged as processed for a partition; where a new/restarted member resumes.
- **Poll loop** — `consumer.poll(timeout)` fetches batches; it also drives heartbeats and rebalance callbacks.
- **Rebalance** — reassignment of partitions across members when the group changes (join/leave/timeout).
- **Assignor** — the strategy (range, round-robin, sticky, cooperative-sticky) computing member→partition mapping.
- **`session.timeout.ms`** — how long the coordinator waits without a heartbeat before evicting a member.
- **`max.poll.interval.ms`** — max gap between `poll()` calls before the member is considered stuck and removed.
- **Static membership (`group.instance.id`)** — a stable member identity that survives restarts without triggering a rebalance.
- **Consumer lag** — `log-end-offset − committed-offset`; the backlog a group hasn't yet processed.
- **Seek** — repositioning a consumer to an explicit offset or a timestamp to replay or skip.

**Why interviewers ask this**

Consumer groups are the single most misunderstood part of Kafka, and the questions separate people who "used Kafka" from people who *operated* it. A junior answer stops at "consumers read messages." A senior answer knows that the partition count is the hard ceiling on group parallelism, that a slow message handler triggers a `max.poll.interval.ms` eviction and a rebalance storm, that `enable.auto.commit=true` quietly gives you at-most-*or*-at-least-once depending on failure timing, and that cooperative rebalancing exists precisely so a rolling deploy doesn't stop the whole group. It's also where you demonstrate you understand exactly-once is really "commit offsets and outputs atomically," not magic.

**Common confusions**

- "More consumers = more throughput" → only up to the partition count; extra members sit **idle**.
- "Offsets live in ZooKeeper" → not since long ago; they live in `__consumer_offsets` (KRaft clusters have no ZooKeeper at all).
- "Auto-commit means at-least-once" → auto-commit fires on a timer, so a crash can commit *before* processing (loss) or *after* (dup); it guarantees neither cleanly.
- "A rebalance is cheap" → an *eager* (stop-the-world) rebalance pauses **every** member; cooperative rebalancing was added to avoid exactly that.
- "Committing offset N means N is done" → the committed offset is the *next* offset to read, i.e. `last_processed + 1`.

**What follows from this topic**

Offsets and commit timing feed directly into the Delivery Semantics topic (at-least-once / exactly-once, the transactional producer + `read_committed` consumer). Lag and rebalance behaviour feed the Observability/Ops topic. The producer side (partitioning, `acks`, idempotence) is its own topic and is what determines the ordering and durability guarantees your consumers inherit.

### Q1. Walk me through the consumer poll loop. Why is it single-threaded per consumer?

A `KafkaConsumer` is **not thread-safe** and is designed around one thread calling `poll()` in a loop. `poll(Duration)` does far more than fetch records: it (1) sends fetch requests and returns buffered batches, (2) sends heartbeats to the group coordinator, (3) triggers rebalance join/sync and fires your `ConsumerRebalanceListener` callbacks, and (4) drives auto-commit if enabled. If you stop calling `poll()` — because you're blocked processing a batch — you stop heartbeating *and* you blow `max.poll.interval.ms`, and the coordinator evicts you.

```java
props.put("group.id", "orders-worker");
props.put("enable.auto.commit", "false");
props.put("max.poll.records", "500");
consumer.subscribe(List.of("orders"));
while (running) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    for (ConsumerRecord<String, String> r : records) {
        process(r);                       // your work
    }
    consumer.commitSync();                // commit AFTER processing -> at-least-once
}
```

Rule of thumb: keep per-`poll` work bounded (tune `max.poll.records`) or offload slow work to a worker pool while the poll thread keeps heartbeating — but if you offload, you must pause/resume partitions and manage commits yourself, which is fiddly.

### Q2. What exactly is a consumer group, and how does it give you both competing-consumers and pub/sub?

A consumer group is a set of consumers that share a `group.id`. The coordinator divides the topic's partitions among the group's live members so that **each partition has exactly one owner in the group**. That's the competing-consumers pattern: add members, work spreads out, throughput scales — up to the partition count.

Pub/sub falls out of running *multiple* groups over the same topic. Each group has its own committed offsets in `__consumer_offsets`, so `group.id=fraud-detector` and `group.id=billing` each receive the **full** stream independently and progress at their own pace. One topic, N groups, N independent copies of the stream. This is the key difference from RabbitMQ, where you'd model competing consumers with multiple consumers on one queue and pub/sub with a fanout exchange to multiple queues — in Kafka both come from the same partition-assignment primitive.

### Q3. Why does having more consumers than partitions leave some idle?

Because the assignment invariant is one-partition-to-one-member. If a topic has 6 partitions and you start 8 consumers in one group, 6 own a partition each and **2 sit idle** — they've joined the group but the assignor has nothing to give them. They aren't a hot standby that shares load; they only pick up work when an active member dies and a rebalance hands them a partition.

The practical consequences: (1) partition count is a capacity-planning decision made at topic-creation time and is the ceiling on a group's parallelism, so over-provision partitions if you expect to scale consumers; (2) you can add partitions later, but that changes key→partition mapping for keyed data and breaks per-key ordering across the split, so it's not free. Sizing partitions ≈ 2–3× your expected peak consumer count is a common heuristic.

### Q4. Where do offsets live, and what's the difference between auto-commit and manual commit?

Committed offsets are stored server-side in the internal `__consumer_offsets` topic (a compacted topic keyed by group/topic/partition), keyed so only the latest commit per partition survives compaction. The committed value is the offset to **resume from** — conventionally `last_processed_offset + 1`.

Two modes:

- **Auto-commit** (`enable.auto.commit=true`, `auto.commit.interval.ms=5000`): the consumer commits the current position on a timer inside `poll()`. Simple, but the commit is decoupled from whether you actually processed the records. Crash right after an auto-commit but before processing → those records are **lost** (at-most-once flavour). Crash after processing but before the next auto-commit → **redelivery** on restart (dup). So auto-commit gives you *neither* clean guarantee.
- **Manual commit** (`enable.auto.commit=false`): you call `commitSync()`/`commitAsync()` yourself. Commit **after** processing → at-least-once (a crash before commit just replays the batch — your handler must be idempotent). Commit **before** processing → at-most-once.

```java
props.put("enable.auto.commit", "false");
records.forEach(this::process);
consumer.commitAsync((offsets, ex) -> {   // async: fast, no blocking
    if (ex != null) log.warn("commit failed, will retry next round", ex);
});
```

`commitSync()` blocks and retries (safe, slower); `commitAsync()` is fire-and-forget (fast, may silently lose a commit — so a common pattern is `commitAsync` in the loop and a final `commitSync` in the `finally`/close path).

### Q5. Explain rebalancing. What's the difference between eager and cooperative rebalancing?

A rebalance is the coordinator recomputing partition→member assignments. It's triggered by a member joining, leaving, timing out (missed heartbeat or blown `max.poll.interval.ms`), or a subscription/partition-count change.

- **Eager (stop-the-world)** — the classic protocol. On *any* membership change, **every** member revokes **all** its partitions, everyone rejoins, and the assignor hands out a fresh mapping. During the revoke→reassign window the *entire group stops consuming*. On a 20-member group, one pod restarting freezes all 20.
- **Cooperative / incremental** (`cooperative-sticky` assignor, the modern default choice) — rebalancing happens in phases and only the partitions that actually need to move are revoked. Members that keep their partitions keep processing throughout. A rolling deploy of one member only briefly pauses that member's soon-to-move partitions, not the whole group.

Always prefer `partition.assignment.strategy=org.apache.kafka.clients.consumer.CooperativeStickyAssignor` for anything with more than a couple of members or frequent deploys.

### Q6. Compare the assignors: range, round-robin, sticky, cooperative-sticky.

- **Range** (historical default) — assigns *per topic*: for each topic, lays partitions out in range and gives contiguous ranges to members sorted by id. Simple, but **skews** when you subscribe to multiple topics with few partitions — the first members get partition 0 of every topic, so load is lopsided.
- **Round-robin** — lays all partitions across all subscribed topics in one list and deals them out round-robin. More even than range, but any membership change reshuffles almost everything.
- **Sticky** — aims for an even distribution *while minimising movement* from the previous assignment, so a rebalance disturbs as few partitions as possible (preserves warm state/caches). Still eager (stop-the-world) in its revoke phase.
- **Cooperative-sticky** — sticky's even+minimal-movement goal *plus* the incremental cooperative protocol, so members that keep partitions never pause. This is the one to reach for in production.

### Q7. What is a "rebalance storm" and how do you avoid it?

A rebalance storm is a group thrashing through back-to-back rebalances, spending more time reassigning than consuming. Typical causes:

- **Slow processing** blowing `max.poll.interval.ms` (default 5 min): a handler that occasionally takes 6 minutes gets evicted, triggers a rebalance, the replacement inherits the same slow work, and it cascades.
- **Aggressive `session.timeout.ms`** relative to GC pauses / network blips: transient stalls look like death.
- **Frequent scaling / crash-looping pods**: every join and leave is a membership change.

Fixes: raise `max.poll.interval.ms` or lower `max.poll.records` so a batch fits comfortably in the interval; use `cooperative-sticky` so a single flap doesn't stop the world; use **static membership** so a pod restart within `session.timeout.ms` doesn't rebalance at all; and fix the actual slow handler (offload, batch smaller). Watch the rebalance-rate and `time-between-poll` JMX metrics.

### Q8. What is static membership and how do session timeout, heartbeat, and max.poll.interval interact?

Three separate timers govern liveness:

- **`heartbeat.interval.ms`** (~3s) — how often a background thread pings the coordinator. Tune it to ~1/3 of the session timeout.
- **`session.timeout.ms`** (~10–45s) — if no heartbeat arrives within this window, the coordinator declares the member dead and rebalances. This detects *crashed/network-partitioned* members.
- **`max.poll.interval.ms`** (~5 min) — max wall-clock gap between successive `poll()` calls. This detects a member that's *alive and heartbeating but stuck* processing (the background heartbeat thread keeps beating even while your app thread is wedged). Blow it and you're evicted.

**Static membership** (`group.instance.id=worker-3`, KIP-345) gives a member a *stable, operator-assigned identity*. When a statically-identified member leaves and rejoins within `session.timeout.ms` (e.g. a normal pod restart / rolling deploy), the coordinator recognises it and **reassigns it the same partitions with no rebalance**. Combined with a generous session timeout, this makes routine restarts free. The tradeoff: if a static member *actually* dies for good, the group waits out the full `session.timeout.ms` before reassigning its partitions, so don't set the timeout absurdly high.

### Q9. Debugging: consumer lag is climbing and throughput is flat even though I added consumers. What's going on?

Systematic checks:

1. **Partition ceiling** — how many partitions vs consumers? If `consumers > partitions`, the extras are idle; adding them does nothing. `kafka-consumer-groups --describe --group g` shows per-partition assignment and lag; idle members show partitions owned by others.
2. **Skew** — is lag concentrated on a few partitions? A hot key funnels most traffic to one partition (one consumer), so the group is bottlenecked on a single member regardless of count. Fix the partitioning/key.
3. **Rebalance thrash** — check the rebalance rate. If the group keeps rebalancing (slow handler blowing `max.poll.interval.ms`), it spends its time reassigning, not consuming. Lower `max.poll.records` or raise the interval.
4. **Slow downstream** — the handler itself (DB writes, external API) is the ceiling; consumers are I/O-bound on something else. Batch or parallelise the sink.

```bash
kafka-consumer-groups --bootstrap-server broker:9092 \
  --describe --group orders-worker
```

The `LAG` column per partition tells you immediately whether it's a ceiling problem (uniform lag, fully assigned) or a skew problem (one partition's lag exploding).

### Q10. How do I replay or reprocess data — seek by offset and by timestamp?

Because offsets are just positions in a retained log, you can reposition a consumer anywhere within the retention window. Programmatically:

```java
consumer.assign(List.of(tp));                       // manual assignment
consumer.seekToBeginning(List.of(tp));              // replay from earliest
consumer.seek(tp, 42000);                           // jump to a specific offset

Map<TopicPartition, Long> query = Map.of(tp, ts);   // ts = epoch millis
OffsetAndTimestamp o = consumer.offsetsForTimes(query).get(tp);
if (o != null) consumer.seek(tp, o.offset());       // seek by time
```

`offsetsForTimes` maps a timestamp to the first offset at or after it — invaluable for "reprocess everything since 09:00 after we fixed the bug." Operationally the same is done with `kafka-consumer-groups --reset-offsets --to-datetime <ts> --to-earliest --shift-by -1000 --execute` (dry-run without `--execute`), which rewrites the committed offset in `__consumer_offsets` for the whole group. Caveats: you can only seek within `retention.ms`/`retention.bytes`; and `auto.offset.reset` (`earliest`/`latest`/`none`) only decides where a group with **no** committed offset starts — it's a first-run fallback, not a replay mechanism.

### Q11. The interview one-liner: sum up Kafka consumers in one crisp paragraph.

A Kafka consumer group is a cohort of single-threaded pollers sharing a `group.id`, over which the broker coordinator divides a topic's partitions so each partition has exactly one owner — giving you competing-consumers within a group (parallelism capped at the partition count) and pub/sub across groups (each group holds its own offsets in `__consumer_offsets`); delivery semantics are decided by *when you commit* — commit after processing for at-least-once, before for at-most-once, auto-commit for "neither cleanly" — and the whole thing stays stable only if you keep calling `poll()` inside `max.poll.interval.ms`, use cooperative-sticky assignment and static membership to keep routine restarts from triggering stop-the-world rebalance storms, and remember that offsets are just log positions you can `seek()` by offset or timestamp to replay.


## Kafka Retention, Compaction & Transactions

### Summary

**What this topic covers**
Kafka's log is not a queue that deletes on consume — it is a durable, replayable commit log whose lifetime is governed by *retention policy*, and whose per-key state can be collapsed by *compaction*. On top of that log, Kafka layers *transactions* to give exactly-once semantics (EOS) across the consume-transform-produce loop. This topic covers how long data lives (`retention.ms`, `retention.bytes`), the two cleanup policies (`delete` vs `compact`), how the transaction coordinator and read-committed isolation deliver atomic multi-partition writes, tiered storage for cheap long retention, and the crucial caveat that "exactly once" is scoped to the Kafka boundary — external side effects still need idempotency.

**Mental model**
Think of a Kafka partition as an append-only ledger, not a mailbox. A consumer reading a record does *not* remove it; consumers just advance their own offset. What removes data is the *log cleaner*, driven by policy. With `cleanup.policy=delete` (the default), Kafka drops whole *segments* once every record in them is older than `retention.ms` or the partition exceeds `retention.bytes` — this is time/size-bounded history. With `cleanup.policy=compact`, Kafka instead guarantees it keeps *at least the latest value for every key*, garbage-collecting superseded versions — this turns the topic into a durable key-value changelog you can replay to rebuild state. Transactions sit above all this: a producer with a `transactional.id` writes to many partitions, and a *transaction coordinator* commits or aborts them atomically. Consumers set `isolation.level=read_committed` to see only committed records. The log stays the same append-only structure; transactions just add control markers that hide aborted data.

**Key terms**
- **retention.ms** — how long (ms) a record is kept before it is eligible for deletion; default 7 days (604800000).
- **retention.bytes** — max size per *partition* before oldest segments are pruned; `-1` = unlimited.
- **segment** — the unit of the log on disk (`segment.bytes`, `segment.ms`); retention/compaction act at segment granularity, so data never deletes below segment size.
- **cleanup.policy** — `delete` (age/size pruning), `compact` (keep latest per key), or `compact,delete` (both).
- **tombstone** — a record with a non-null key and *null value*; signals "delete this key" in a compacted topic, retained for `delete.retention.ms` (default 24h) then removed.
- **log cleaner** — background threads that recompact dirty segments; tuned by `min.cleanable.dirty.ratio` and `min.compaction.lag.ms`.
- **transactional.id** — stable producer identity enabling cross-session fencing and atomic writes; distinct from `enable.idempotence`.
- **transaction coordinator** — broker-side component (backed by the `__transaction_state` topic) that tracks and commits/aborts transactions.
- **read_committed / read_uncommitted** — consumer isolation level; committed hides aborted + in-flight records up to the last stable offset (LSO).
- **exactly-once semantics (EOS)** — no duplicates and no loss within Kafka, via idempotent producer + transactions.
- **tiered storage** — offloads old closed segments to object storage (S3/GCS) so retention can be effectively infinite at low cost.

**Why interviewers ask this**
It separates people who use Kafka as a message queue from people who understand it as a *log*. A junior says "the consumer reads the message and it's gone." A senior says "consumers just track offsets; retention deletes data, not consumption, so I can replay by resetting offsets, and I use compaction for changelogs." Compaction vs deletion is a favorite because it maps directly to real design choices (event streams vs state topics, KTables, CDC). Transactions probe whether you actually understand EOS: many candidates claim "Kafka is exactly-once" without knowing it requires `read_committed` consumers, a `transactional.id`, and that it does *not* extend to your database or REST call downstream.

**Common confusions**
- "Reading a message deletes it" → wrong; only retention/compaction delete data, consumers just move offsets.
- "Compaction removes duplicates" → no; it keeps the latest value *per key*, and only after the active segment rolls — recent duplicate keys can coexist briefly.
- "Compaction guarantees exactly one record per key" → no; it guarantees *at least* the latest; older versions in the head/active segment survive until cleaned.
- "Exactly-once means my whole pipeline is exactly-once" → only within Kafka; external writes still need idempotency or the outbox pattern.
- "`enable.idempotence` = transactions" → idempotence dedupes retries to one partition/session; transactions add multi-partition atomicity and cross-session fencing.
- "A tombstone deletes immediately" → it deletes the key's value on next compaction and is itself retained for `delete.retention.ms`.

**What follows from this topic**
Retention and offsets underpin the Delivery Semantics topic (at-least-once, exactly-once) and consumer-group replay. Compaction is the mechanism behind changelog/state topics used by the Kafka Streams and CDC patterns discussed in the Streaming topic — see the Data Engineering primer for the analytics-pipeline use of these same changelogs. Transactions connect to the idempotency and outbox patterns in the Reliability topic. Tiered storage relates to the Ops/cost tradeoffs covered later.

### Q1. Is Kafka a queue? What actually happens when a consumer reads a message?

No — Kafka is a **replayable, append-only log**, not a delete-on-consume queue. When a consumer reads a record, nothing is removed. The consumer group just advances its committed **offset** (stored in the internal `__consumer_offsets` topic). Multiple independent consumer groups read the same partition at their own offsets without interfering. Data is removed only by **retention policy** (age/size) or **compaction** — never by the act of consuming. This is why you can reset a group's offset and reprocess history:

```
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group billing --topic orders --reset-offsets --to-earliest --execute
```

Contrast with RabbitMQ, where an ack removes the message from the queue. Kafka decouples consumption from deletion — the superpower behind replay, multiple readers, and event sourcing.

### Q2. How does time and size retention work? What are the real knobs?

Retention (with the default `cleanup.policy=delete`) prunes data at **segment** granularity:

- `retention.ms` — records older than this become eligible for deletion. Default `604800000` (7 days). `-1` = keep forever.
- `retention.bytes` — max bytes **per partition**; when exceeded, oldest segments are dropped. Default `-1` (unlimited). Note it's *per partition*, so a topic with 12 partitions and `retention.bytes=1073741824` can hold ~12 GB total.
- `segment.bytes` / `segment.ms` — control when the active segment rolls closed; a segment can only be deleted once it's closed and *all* its records are past retention. So actual on-disk data can exceed `retention.ms` briefly.

Whichever limit hits first triggers deletion. Set per-topic:

```
kafka-configs --bootstrap-server localhost:9092 --alter \
  --topic events --add-config retention.ms=259200000,retention.bytes=5368709120
```

Gotcha: because deletion is segment-granular, a low-throughput topic with a large `segment.ms` can retain data far longer than `retention.ms` suggests — the segment simply hasn't rolled.

### Q3. What is log compaction and when do you use it?

`cleanup.policy=compact` changes the guarantee: instead of deleting by age, Kafka guarantees it retains **at least the latest value for every key**. Older values for a key are garbage-collected by the log cleaner. The result is a topic whose *tail* is a full snapshot of current state keyed by message key — a durable, replayable changelog.

Use compaction when the topic represents **current state per entity**, not an event stream:
- Kafka Streams / ksqlDB **KTable changelogs** and state-store backups.
- **CDC** topics (Debezium) where you want the latest row per primary key.
- Config/lookup topics a service replays on startup to rebuild an in-memory cache.

Requirements: records **must have a non-null key** (the compaction key). Tune with `min.cleanable.dirty.ratio` (default 0.5 — compact when half the log is "dirty") and `min.compaction.lag.ms` (keep recent records uncompacted so consumers can see intermediate values). Compaction never touches the **active segment**, so the very latest writes always survive and duplicate keys can coexist transiently — compaction is eventual, not instantaneous.

### Q4. How do you delete a key from a compacted topic?

Write a **tombstone**: a record with the same **key** and a **null value**. On the next compaction pass, the tombstone signals the cleaner to drop all prior values for that key. The tombstone itself is retained for `delete.retention.ms` (default 86400000 = 24h) so that downstream consumers that are behind still observe the delete, then it too is removed.

```
kafka-console-producer --bootstrap-server localhost:9092 \
  --topic users --property parse.key=true --property key.separator=:
> user-42:
```

(Empty value after the separator = null = tombstone.) A common bug: setting `delete.retention.ms` too low, so a lagging consumer misses the tombstone and never learns the key was deleted, leaving stale state in its local store.

### Q5. delete vs compact vs compact,delete — when do you combine them?

- `delete` — pure event log; drop old data by time/size. Use for streams where history beyond a window has no value (metrics, clicks, raw events).
- `compact` — pure changelog; keep latest per key **forever** by default. Use for state/CDC/config topics.
- `compact,delete` — keep latest per key **but also** age out keys not updated within `retention.ms`. Use when you want a changelog that self-cleans stale keys — e.g. sessions or accounts that go inactive and should eventually disappear even without an explicit tombstone.

```
kafka-configs --bootstrap-server localhost:9092 --alter \
  --topic sessions --add-config cleanup.policy=compact,delete,retention.ms=2592000000
```

Rule of thumb: "event = delete, state = compact." Reach for `compact,delete` only when unbounded key growth is a real concern.

### Q6. What does "exactly-once" actually mean in Kafka, and what does it require?

EOS in Kafka means: within the consume-transform-produce loop, each input record affects the output **exactly once** — no duplicates from producer retries, no loss. It requires three things working together:

1. **Idempotent producer** (`enable.idempotence=true`, on by default in modern Kafka) — dedupes retries to a partition using a producer ID + sequence number, so a retried send isn't written twice.
2. **Transactions** — a producer with a `transactional.id` writes to multiple partitions (including the `__consumer_offsets` topic) atomically; all or nothing.
3. **read_committed consumers** — downstream consumers set `isolation.level=read_committed` so they never see records from aborted or in-flight transactions.

Idempotence alone gives EOS for a *single producer session to single partitions*. Transactions add **multi-partition atomicity** and **cross-session fencing** (a restarted producer with the same `transactional.id` fences the old zombie). Miss any leg — e.g. leave consumers at `read_uncommitted` — and you're back to at-least-once with visible duplicates.

### Q7. Walk through consume-transform-produce with transactions. What's the atomic unit?

The pattern: read from input topic, transform, write to output topic, and record the input offsets — **all in one transaction**. The key insight is that the consumer offset commit is *part of the transaction*, written to `__consumer_offsets` alongside the output records. So either the output *and* the offset advance together, or neither does — no reprocessing gap.

```java
producer.initTransactions();
while (true) {
  var records = consumer.poll(Duration.ofMillis(100));
  producer.beginTransaction();
  for (var r : records)
    producer.send(transform(r));
  // send input offsets to the transaction, not consumer.commitSync()
  producer.sendOffsetsToTransaction(offsetsFor(records), consumer.groupMetadata());
  producer.commitTransaction();   // atomic: outputs + offsets
}
```

If `commitTransaction()` fails or the process dies mid-loop, the transaction aborts, `read_committed` consumers never see the partial output, and on restart the consumer re-reads from the last *committed* offset. In Kafka Streams this whole dance is automatic: set `processing.guarantee=exactly_once_v2` and it manages the transactional producer, offset commits, and state-store changelogs for you.

### Q8. How does the transaction coordinator work, and what is the last stable offset (LSO)?

The **transaction coordinator** is a broker component (one per `transactional.id`, chosen by hashing the ID onto a partition of the internal `__transaction_state` topic). It durably logs each transaction's state: Ongoing → PrepareCommit/PrepareAbort → CompleteCommit/CompleteAbort. On commit, it writes **transaction markers** (control records) into every partition the transaction touched, telling consumers "everything up to here is committed/aborted."

`read_committed` consumers rely on the **Last Stable Offset (LSO)** — the offset up to which *all* transactions are decided. A consumer will not deliver records beyond the LSO, because a still-open transaction could later abort them. This means a long-running (or stuck) transaction **blocks read_committed consumers** from advancing on that partition — a real latency gotcha. `transaction.timeout.ms` (default 60s) bounds this: the coordinator aborts transactions that hang, unblocking the LSO. This is also why `transactional.id` must be **stable across restarts** — a new random ID each restart leaks producer state and can't fence zombies.

### Q9. What is tiered storage and how does it change retention economics?

**Tiered storage** (KIP-405, GA in recent Kafka) splits the log into two tiers: recent segments stay on broker **local disk** (hot, low-latency), while older **closed** segments are offloaded to cheap **object storage** (S3, GCS, Azure Blob). Consumers reading old offsets fetch transparently from the remote tier — the API is unchanged. Enable per topic with `remote.storage.enable=true`, then set `local.retention.ms` (how long to keep locally) separately from `retention.ms` (total, including remote).

Why it matters:
- **Retention becomes cheap and effectively unbounded** — keep months of history for replay/reprocessing without buying broker disk.
- **Faster rebalancing/recovery** — brokers hold less local data, so partition reassignment and broker replacement move far less bytes.
- **Decoupled scaling** — storage scales independently of broker compute.

Tradeoff: reading cold data is slower (object-store latency), so it suits replay/backfill, not latency-critical hot paths. It doesn't change compaction semantics — compacted topics can also tier.

### Q10. Kafka claims exactly-once, but my database still got a duplicate write. Why?

Because Kafka's EOS is **scoped to the Kafka boundary** — atomic reads/writes *among Kafka topics and offsets*. The moment your transform makes an **external side effect** (a DB insert, an HTTP POST, an email), that action is outside the transaction. If the process crashes after the external write but before `commitTransaction()`, the Kafka transaction aborts and re-runs — but your DB row was already written, giving a duplicate.

Fixes:
- Make the external write **idempotent** — upsert on a natural/business key, or dedupe on a stored message ID / offset.
- Use the **transactional outbox pattern**: write the side effect *into* the same database transaction as your state, then a CDC connector (Debezium) publishes it to Kafka — so the DB is the source of truth and Kafka mirrors committed state.
- For sinks, use connectors with their own idempotent/exactly-once support (e.g. Kafka Connect sinks that track offsets in the target).

The senior framing: "Kafka EOS makes the *stream processing* exactly-once; end-to-end exactly-once requires every external boundary to be idempotent or transactional too."

### Q11. Debug: a compacted topic keeps growing on disk and old keys never disappear. What do you check?

Walk the compaction pipeline:

1. **Do records have non-null keys?** Compaction keys on the message key; null-key records break the guarantee and pile up. Producer bug is the #1 cause.
2. **Is the log cleaner running/enabled?** Check `log.cleaner.enable=true` (default) and broker logs for cleaner threads dying — a single poison record historically could stall the cleaner. Monitor the `kafka.log:type=LogCleanerManager` metrics and `max-clean-time-secs`.
3. **`min.cleanable.dirty.ratio`** too high, or `min.compaction.lag.ms` too long — the cleaner won't run until enough dirt accumulates.
4. **Active segment** — the head is never compacted. If `segment.ms`/`segment.bytes` are large and throughput is low, the segment rarely rolls, so recent keys look uncompacted. Lower `segment.ms` to force rolls.
5. **Tombstones vanishing too early** via a small `delete.retention.ms`, or deletes never sent at all.

```
kafka-configs --bootstrap-server localhost:9092 --describe --topic users
```

Verify `cleanup.policy=compact` is actually set on the topic (not inherited `delete`), and check `min.cleanable.dirty.ratio`. Nine times out of ten it's null keys or a stalled cleaner.

### Q12. The interview one-liner: Kafka retention, compaction & transactions.

Kafka is a **durable, replayable log, not a delete-on-consume queue** — consuming only advances an offset; data lives until retention (`retention.ms`/`retention.bytes`) ages it out or compaction (`cleanup.policy=compact`) collapses it to the latest value per key, with tombstones for deletes — so you pick `delete` for event streams and `compact` for state/changelog/CDC topics. On top of the log, **transactions** (a stable `transactional.id`, a broker transaction coordinator, and `read_committed` consumers) give exactly-once across the consume-transform-produce loop by committing output records and input offsets atomically — but that guarantee stops at the Kafka boundary, so external side effects still need idempotency or the outbox pattern, while tiered storage offloads old segments to object storage to make long retention cheap.


## Kafka Ecosystem & Ops

### Summary

**What this topic covers**

Kafka the broker is only half the story — the reason it dominates is the **ecosystem** around it and the **operational discipline** needed to run it. This topic covers four ecosystem pillars — **Kafka Connect** (declarative source/sink integration, including CDC with Debezium), **Kafka Streams and ksqlDB** (a stream-processing library and its SQL front-end that run *inside* your app, not on a cluster), **Schema Registry** (Avro/Protobuf/JSON-Schema management with compatibility enforcement), and **replication tooling** (MirrorMaker 2 and cluster linking for multi-region and DR). It then covers day-2 reality: **rack awareness**, the **metrics that predict incidents** (under-replicated partitions, consumer lag, request latency, ISR shrink rate), the **routine ops tasks** (adding partitions, reassigning replicas, rolling upgrades), and **sizing limits**. The deep streaming-pipeline / analytics angle lives in the Data Engineering primer — here the lens is the messaging platform and its operation.

**Mental model**

Think of Kafka as a **dumb, fast log at the center** and everything else as **satellites that move data in, transform it, or copy it elsewhere**. Connect is the **ETL edge**: config-file connectors pull from databases and push to sinks with zero bespoke code, offsets tracked in Kafka itself so it survives restarts. Streams/ksqlDB is **compute that lives in your consumer**: no separate cluster, just a library that reads topics, keeps local state in RocksDB, and writes results back — scaling by consumer-group rebalance. Schema Registry is the **contract enforcer** beside the brokers, refusing incompatible schemas so producers can't break consumers. MirrorMaker/cluster linking is the **copy machine** between clusters. Operationally, the broker's whole promise rests on the **ISR (in-sync replica) set**: while replicas stay in sync you have durability and availability; the moment they fall behind you get under-replicated partitions — your earliest warning something is wrong.

**Key terms**

- **Kafka Connect** — a distributed runtime for running source/sink connectors declaratively via JSON config; workers form a cluster, tasks are the parallelism unit.
- **Debezium** — the standard CDC source connectors (Postgres, MySQL, Mongo…) that stream row-level changes off the DB write-ahead log into Kafka topics.
- **Kafka Streams** — a JVM library for stateful stream processing embedded in your app; primitives are `KStream` (event stream) and `KTable` (changelog/compacted view).
- **ksqlDB** — a SQL layer over Kafka Streams: `CREATE STREAM`/`CREATE TABLE` and continuous `SELECT`s, compiled to Streams topologies.
- **Schema Registry** — a service storing versioned schemas by subject, enforcing compatibility; messages carry a schema ID, not the schema.
- **Compatibility mode** — `BACKWARD` (default), `FORWARD`, `FULL`, `NONE` — governs which schema evolutions the registry allows.
- **MirrorMaker 2** — Connect-based cross-cluster replication (topics, offsets, ACLs) for DR and multi-region.
- **ISR** — in-sync replicas: the replica set caught up to the leader within `replica.lag.time.max.ms`; only ISR members are eligible leaders.
- **Under-replicated partitions (URP)** — partitions whose live replica count is below replication factor; the single most important health metric.
- **Consumer lag** — end log offset minus committed offset; how far behind a consumer group is.
- **Rack awareness** — `broker.rack` config so the replica placer spreads replicas across racks/AZs for fault tolerance.
- **Partition reassignment** — moving partition replicas between brokers via `kafka-reassign-partitions` for rebalancing or decommissioning.

**Why interviewers ask this**

Anyone can produce and consume; the platform question is *can you run this thing and integrate it without writing glue for every system*. The junior answer treats Kafka as a queue and hand-rolls a consumer to copy DB rows in. The senior answer reaches for **Connect + Debezium** for CDC, knows **Streams runs in-process** (no cluster to operate), enforces contracts with **Schema Registry** compatibility modes, and — critically — can name the **three or four metrics that page you**: under-replicated partitions, ISR shrink/expand rate, consumer lag, request latency. Interviewers probe ops maturity: what breaks when you add partitions to a keyed topic, why you cap partitions per broker, how you do a rolling upgrade without dropping availability, and how you handle multi-region. These separate people who've *used* a managed Kafka from people who've *carried the pager* for one.

**Common confusions**

- "Kafka Streams needs its own cluster" — no. It's a library; it runs wherever your app runs and scales via consumer-group rebalance. Only Connect and ksqlDB have their own worker runtimes.
- "Adding partitions is free" — it breaks key-to-partition mapping for keyed topics: existing keys rehash to new partitions, destroying per-key ordering going forward. Size partitions up front.
- "The message carries the Avro schema" — it carries a 4-byte schema **ID**; the consumer fetches the schema from the registry and caches it.
- "MirrorMaker gives you a synchronous hot standby" — it's asynchronous; the remote cluster lags, and topic names are prefixed (`source.topic`) unless you configure identity replication.
- "URP just means slow" — sustained URP means you're one broker failure away from data loss or unavailability; treat non-zero URP as an incident.
- "More partitions is always better" — past a point they raise latency, recovery time, and controller load; there are practical ceilings.

**What follows from this topic**

This is where the broker internals from the Kafka Architecture and Delivery Semantics topics meet production. Connect's and Streams' exactly-once build directly on the idempotent-producer and transaction machinery from the delivery-guarantees topic; Schema Registry is the operational half of the schema-evolution topic. For the analytics and Spark-pipeline view of these tools, see the Data Engineering primer — here the lens is the platform operator: keep the ISR healthy, watch lag and URP, integrate via config not code.

### Q1. What is Kafka Connect and when do you reach for it instead of a custom consumer?

Kafka Connect is a **distributed runtime for moving data between Kafka and external systems declaratively**. You POST a JSON config naming a connector class and its settings; Connect runs it as **tasks** spread across a worker cluster, handling offset tracking, restarts, rebalancing, and scaling for you. **Source connectors** pull data into Kafka (databases, message queues, files); **sink connectors** push Kafka data out (Elasticsearch, S3, JDBC, data warehouses).

Reach for Connect over a hand-written consumer whenever a maintained connector exists for your system. You get **fault tolerance and offset management for free** — Connect stores source offsets and sink consumer offsets in Kafka, so a crashed worker resumes exactly where it left off. A minimal S3 sink:

```json
{
  "name": "s3-sink",
  "config": {
    "connector.class": "io.confluent.connect.s3.S3SinkConnector",
    "tasks.max": "4",
    "topics": "orders,payments",
    "s3.bucket.name": "prod-events",
    "flush.size": "10000"
  }
}
```

Write a custom consumer only when no connector fits or you need transformation logic beyond Connect's Single Message Transforms (SMTs). For anything heavier than per-message tweaks, use Kafka Streams downstream instead.

### Q2. How does change-data-capture with Debezium work, and why is it better than polling?

Debezium is a set of **CDC source connectors** that stream row-level changes out of a database's **write-ahead log** (Postgres logical replication slot, MySQL binlog, Mongo oplog) into Kafka topics — one topic per table by default. Each message is a structured change event with `before`, `after`, and `op` (create/update/delete) fields.

Why it beats a polling query (`SELECT * WHERE updated_at > ?`):

- **No missed updates** — the WAL captures every change including deletes; a polling query silently misses rows deleted between polls and rows updated twice in one interval.
- **No load on the primary's query path** — reading the replication log is far cheaper than repeated table scans, and it doesn't need an indexed `updated_at` column.
- **Ordering and completeness** — you get the exact commit order, and an initial **snapshot** seeds history before switching to streaming.

Gotchas: the DB must have logical replication enabled; a paused connector holds the replication slot open, which can **pin WAL and fill the primary's disk** — monitor slot lag. Debezium underpins most "sync my database into Kafka" architectures and the outbox pattern for reliable event publishing.

### Q3. Kafka Streams vs ksqlDB vs Connect — what runs where, and how do they scale?

Three different runtimes people constantly conflate:

- **Kafka Streams** — a **JVM library** you embed in your own service. No cluster. It reads topics, maintains local state (RocksDB + a changelog topic for recovery), and writes results back. Scales by running more instances in the same **consumer group**: partitions and state are rebalanced across them.
- **ksqlDB** — a **server** that accepts SQL (`CREATE STREAM`, `CREATE TABLE`, continuous `SELECT`) and compiles it into Streams topologies under the hood. You operate a ksqlDB cluster; it's Streams with a SQL front-end and REST API.
- **Connect** — a **worker cluster** for connectors (integration in/out), not transformation. Scales by `tasks.max` across workers.

Rule of thumb: **Connect to get data in/out, Streams/ksqlDB to transform it, in that order.** The key insight for interviews: Streams needs no infrastructure of its own — its scaling and fault tolerance are just Kafka consumer-group mechanics. For the analytics/Spark-scale pipeline treatment of stream processing, see the Data Engineering primer.

### Q4. Explain KStream vs KTable and give a stateful operation example.

A **`KStream`** is an unbounded **stream of independent events** — every record is a fact ("user clicked"). A **`KTable`** is a **changelog interpreted as a table** — each record is an upsert keyed by its key, so later records for the same key *replace* earlier ones ("user's current cart total"). A KTable is backed by a **compacted** topic; a KStream by a normal retention topic.

The classic stateful op is a windowed aggregation:

```java
KStream<String, Order> orders = builder.stream("orders");
orders
  .groupByKey()
  .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))
  .count()
  .toStream()
  .to("orders-per-user-5min");
```

State lives locally in RocksDB and is backed by a changelog topic so an instance that dies restores its state elsewhere. Stream-table **joins** (enrich a KStream with a KTable lookup) and table-table joins are the other heavy-lifting patterns. Streams supports **exactly-once** (`processing.guarantee=exactly_once_v2`) built on Kafka transactions — reads, state updates, and output writes commit atomically.

### Q5. What does Schema Registry do, and what do the compatibility modes mean?

Schema Registry is a service that **stores versioned schemas** (Avro, Protobuf, JSON Schema) keyed by **subject** (usually `<topic>-value`). Producers register/lookup a schema and embed only a **schema ID** (4 bytes) in each message; consumers resolve and cache the schema by ID. This keeps messages small and gives you one enforced contract per topic.

Its real value is **compatibility enforcement** — the registry rejects a new schema version that would break existing readers or writers:

- **BACKWARD** (default) — new schema can read data written by the previous schema. Safe to **add optional fields / remove fields**. Upgrade **consumers first**.
- **FORWARD** — old schema can read data written by the new one. Add fields, don't remove required ones. Upgrade **producers first**.
- **FULL** — both directions.
- **NONE** — no checks (avoid in prod).

Choosing the wrong mode is a classic outage: someone removes a field under FORWARD-only thinking and old consumers break. This topic is only the operational surface — schema evolution rules are covered in depth in the serialization/schema topic.

### Q6. How do you replicate across clusters — MirrorMaker 2 vs cluster linking?

Two approaches for cross-cluster / multi-region:

- **MirrorMaker 2 (MM2)** — built on Kafka Connect. It replicates topics, **consumer offsets** (via offset translation), topic configs, and ACLs. By default it uses **remote topic naming** (`primary.orders` on the DR cluster) so bidirectional replication doesn't loop; you can enable `IdentityReplicationPolicy` to keep names identical for active/passive DR. It's async, open-source, and the standard OSS choice.
- **Cluster linking** (Confluent) — brokers pull directly from the source cluster with **no Connect layer**, preserving offsets and topic names natively. Lower overhead and simpler for failover, but a Confluent feature.

Both are **asynchronous** — the remote cluster lags, so on failover you may lose the in-flight tail. Design for it: use offset translation so consumers can resume near where they were, and understand your RPO is non-zero. For true multi-region active/active you also need to solve write conflicts at the application layer; Kafka replication alone doesn't.

### Q7. What is rack awareness and why does it matter?

Rack awareness tells Kafka's replica placer to **spread a partition's replicas across failure domains**. You set `broker.rack=us-east-1a` (etc.) per broker, and when topics are created the placer ensures the leader and followers land on **different racks/AZs**. Without it, all replicas of a partition can land in one AZ, and an AZ outage takes that partition fully offline despite replication factor 3.

It also enables **follower fetching** (`client.rack` on consumers), letting a consumer read from a nearby replica to cut cross-AZ network cost and latency — significant on cloud bills where inter-AZ traffic is charged.

The catch: rack awareness only holds at creation/reassignment time. If you add brokers or lose one and reassignments cluster replicas back into one rack, you've silently lost the guarantee — verify placement after any topology change.

### Q8. Which metrics actually tell you Kafka is unhealthy?

A short list that catches most incidents:

- **Under-replicated partitions (`UnderReplicatedPartitions`)** — should be **0**. Non-zero means a replica has fallen out of ISR; you're degraded and possibly one failure from data loss. The single most important alert.
- **ISR shrink/expand rate (`IsrShrinksPerSec`)** — frequent shrinks signal brokers struggling to keep up (slow disk, GC pauses, network), often the leading indicator before URP.
- **Consumer lag** — end-log-offset minus committed-offset per group. Steadily growing lag means consumers can't keep up; this is what business owners actually feel.
- **Request latency (`RequestQueueTimeMs`, `TotalTimeMs`)** — rising produce/fetch latency points at broker saturation.
- **Active controller count** — must be exactly **1** across the cluster; 0 or 2 means a controller problem.
- **Offline partitions** — must be 0; non-zero means partitions with no available leader (unavailable).

Check lag from the CLI:

```bash
kafka-consumer-groups --bootstrap-server broker:9092 --describe --group payments-svc
```

Junior monitoring watches CPU/disk; senior monitoring watches URP, ISR churn, and lag — the metrics that predict user-visible failure.

### Q9. Walk through adding partitions and reassigning replicas — what are the risks?

**Adding partitions** (`kafka-topics --alter --partitions N`) increases parallelism but is **one-way and dangerous for keyed topics**: partition assignment is `hash(key) % partitionCount`, so raising the count **rehashes every key to a different partition**. All ordering guarantees per key are broken for messages after the change, and stateful consumers (Streams) may double-count. Size partitions generously up front instead of growing them later.

**Reassigning replicas** moves partition replicas between brokers — for rebalancing after adding brokers, or draining one for decommission. You generate and execute a plan:

```bash
kafka-reassign-partitions --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --execute --throttle 50000000
```

Risks: reassignment **copies data**, saturating network and disk; always set a **throttle** or you'll starve live produce/fetch traffic and trigger ISR shrink. Reassignment is also how you fix rack-awareness drift. Do it during low traffic, watch URP, and throttle conservatively.

### Q10. How do you do a rolling upgrade without downtime?

Kafka is designed for **rolling restarts** because replication survives one broker being down at a time. The sequence:

1. **One broker at a time.** Confirm URP is 0 before touching each broker — never restart a second while the first's partitions are still catching up.
2. **Bump `inter.broker.protocol.version` (and `log.message.format.version` on older clusters) last.** Upgrade the binaries across all brokers first while keeping the protocol version pinned to the old value, verify stability, then raise the protocol version in a second rolling pass. This lets you **roll back** cleanly if something breaks — once you bump the protocol you can't downgrade.
3. **Prefer controlled shutdown** (`controlled.shutdown.enable=true`, default) so the broker migrates leadership off itself gracefully before stopping.
4. **Watch ISR and URP between each step**, and give under-replicated partitions time to rejoin ISR before proceeding.

For KRaft clusters the same one-at-a-time discipline applies to controllers too; with the old ZooKeeper mode you'd upgrade brokers and ZK separately. KRaft is now GA and the default deployment mode, removing ZooKeeper entirely.

### Q11. How many partitions can a broker/cluster handle, and how do you size them?

Partitions are cheap but not free — each is an open file handle set, a memory buffer, and a unit of replication and leader election. Practical guidance:

- **Per broker:** on the order of **1,000–4,000 partitions** is comfortable; problems (slow leader election, long recovery, high controller load) appear as you push toward and past that.
- **Per cluster:** modern KRaft clusters handle **hundreds of thousands to low millions** of partitions — a big improvement over ZooKeeper-era clusters (which strained around tens of thousands) because KRaft removed the ZK metadata bottleneck. Treat exact ceilings as version- and hardware-dependent — these are representative ranges, not hard constants.

Sizing a topic: target throughput divided by per-partition throughput, floored by your **max consumer parallelism** (a consumer group can't have more active consumers than partitions). Rule of thumb start: `max(target_MBps / ~10 MBps, desired_consumer_count)`, rounded up. **Over-partitioning hurts**: more partitions raise end-to-end latency, lengthen failover (more leader elections), and inflate controller state. Since you can't cleanly *reduce* partitions and *increasing* them breaks keyed ordering, size with headroom (say 2–3x current) but resist the urge to pick a huge number "just in case."

### Q12. The interview one-liner: Kafka Ecosystem & Ops in one crisp paragraph.

Kafka wins on its **ecosystem and operability**, not just the broker: **Connect** moves data in and out declaratively (with **Debezium** for log-based CDC), **Kafka Streams/ksqlDB** transform it in-process with no cluster to run, **Schema Registry** enforces producer/consumer contracts via compatibility modes, and **MirrorMaker 2 / cluster linking** copy data across regions for DR. Running it well means protecting the **ISR**: alert on **under-replicated partitions** (should be 0), **ISR shrink rate**, and **consumer lag**; use **rack awareness** to survive AZ loss; do everything **one broker at a time** with throttled reassignments and protocol-version-pinned rolling upgrades; and **size partitions up front** (roughly a few thousand per broker, KRaft scaling the cluster to the millions) because you can't shrink them and growing them breaks keyed ordering.


## RabbitMQ Architecture & the AMQP Model

### Summary

**What this topic covers**

RabbitMQ is the canonical "smart broker" — a message-routing engine built on the AMQP 0-9-1 protocol where producers never touch queues directly. They publish to an *exchange*, and the broker's routing logic decides which queues the message lands in. This topic covers the AMQP model (exchanges, bindings, queues, routing keys), the connection/channel multiplexing model, the message lifecycle from publish to ack, virtual hosts, RabbitMQ's Erlang/OTP foundation, and — crucially for interviews — where the smart-routing philosophy shines versus where it hits a wall. Kafka's internals and log semantics live in the Kafka Architecture topic; here the contrast is the *design philosophy*, not a re-teach.

**Mental model**

Think of RabbitMQ as a **post office**, and Kafka as a **newspaper archive**. In RabbitMQ the producer hands a letter to a sorting facility (the exchange) with an address on it (the routing key). The post office reads its routing table (bindings) and drops copies into the right mailboxes (queues). Once you collect and sign for a letter (ack), it's gone from the mailbox. The intelligence lives in the *broker's* routing table; the consumer is dumb — it just drains its queue. This is the inverse of Kafka, where the broker is a dumb append-only log and every consumer tracks its own offset and decides what to read. That single inversion — **smart broker, dumb consumer** vs **dumb broker, smart consumer** — explains almost every downstream difference: RabbitMQ excels at complex per-message routing and task distribution but destroys messages on ack (no replay); Kafka retains everything and lets you rewind but pushes routing/filtering onto consumers.

**Key terms**

- **Exchange** — the entry point; producers publish here, never to a queue. Types: `direct`, `topic`, `fanout`, `headers`.
- **Binding** — a rule linking an exchange to a queue, optionally with a routing/binding key or header match.
- **Routing key** — a string on the published message the exchange matches against bindings.
- **Queue** — the buffer messages sit in until a consumer acks them; ordered FIFO per queue.
- **Connection** — one TCP connection from client to broker.
- **Channel** — a lightweight virtual connection multiplexed over one TCP connection; the real unit of work.
- **Ack / nack** — consumer acknowledgement; `basic.ack` deletes the message, `basic.nack`/`reject` can requeue or dead-letter it.
- **Prefetch (QoS)** — `basic.qos prefetch_count`, caps unacked messages per consumer for fair dispatch.
- **Virtual host (vhost)** — a namespace isolating exchanges, queues, users, and permissions within one broker.
- **Dead-letter exchange (DLX)** — where rejected/expired/overflowed messages get routed (`x-dead-letter-exchange`).
- **Quorum queue** — the modern replicated, Raft-based durable queue that replaces classic mirrored queues.

**Why interviewers ask this**

RabbitMQ is the default reach-for when a system needs *routing* and *task distribution* rather than a replayable event log, so interviewers use it to test whether you understand messaging semantics beyond "put thing on queue." A junior describes RabbitMQ as "a queue you push to." A senior explains that you *can't* push to a queue — you publish to an exchange, and routing is a first-class concern; they'll reach for the right exchange type, reason about ack modes and prefetch to avoid poison-message storms and unbounded memory, and know when RabbitMQ's throughput ceiling (tens to low-hundreds of thousands msg/s per node, well below Kafka's millions) makes it the wrong tool. Naming quorum queues over deprecated mirrored queues, or explaining publisher confirms, is a strong senior signal.

**Common confusions**

- "Producers send to a queue" → No. Producers publish to an *exchange*; bindings route to queues. A queue with no binding never receives anything.
- "A fanout exchange is pub/sub, direct is point-to-point" → Both can do either; fanout ignores routing keys and copies to all bound queues, direct matches keys exactly. Competing consumers on *one* queue gives work-queue semantics regardless of exchange type.
- "RabbitMQ can replay like Kafka" → No. Once acked, a message is deleted. There is no offset to rewind. Streams (below) are the exception.
- "Channels are just connections" → Channels multiplex over one TCP connection; opening a connection per operation is an anti-pattern that exhausts file descriptors.
- "Mirrored queues are how you get HA" → Deprecated. Use quorum queues (Raft) for replication.

**What follows from this topic**

This sets up the Delivery Semantics topic (RabbitMQ's ack/confirm model gives at-least-once by default), the Reliability & DLQ topic (dead-letter exchanges, quorum queues, publisher confirms), and the cross-broker comparison — every "Kafka vs RabbitMQ" question traces back to the smart-broker/dumb-consumer inversion described here.

### Q1. Walk me through the AMQP 0-9-1 model. Where does a producer send a message?

A producer **never sends to a queue** — it publishes to an **exchange**, tagging the message with a **routing key**. The exchange consults its **bindings** (rules connecting it to queues) and copies the message into every queue whose binding matches. Consumers subscribe to queues and receive messages pushed to them. So the four moving parts are: *exchange* (receives publishes), *binding* (routing rule), *queue* (buffer), *consumer* (drains queue).

Four exchange types cover routing needs:

- **direct** — deliver to queues whose binding key exactly equals the routing key. Point-to-point / routed-by-severity.
- **topic** — wildcard matching on dotted routing keys: `*` matches one word, `#` matches zero-or-more. e.g. binding `logs.*.error` matches `logs.auth.error`.
- **fanout** — ignore the routing key, broadcast to every bound queue. Pub/sub.
- **headers** — match on message header attributes instead of the routing key.

```text
producer --publish(routing_key)--> [exchange] --binding--> [queue] --> consumer
```

The default (nameless `""`) exchange is a special direct exchange where every queue is auto-bound by its own name as routing key — which is why beginners *think* they're publishing to a queue when they publish with `routing_key="my_queue"`. They're actually going through the default exchange.

### Q2. Connections vs channels — what's the difference and why does it matter?

A **connection** is a single TCP connection to the broker (with the AMQP handshake, auth, heartbeats). A **channel** is a lightweight virtual connection multiplexed *inside* that TCP connection. Almost every AMQP operation — declaring a queue, publishing, consuming, acking — happens on a channel, not the raw connection.

Why it matters: TCP connections are expensive (file descriptors, memory, TLS handshakes, heartbeats). Opening a connection per publish exhausts the broker and is the single most common RabbitMQ scaling mistake. The idiom is **one long-lived connection per process, one channel per thread**. Channels are cheap to open and close; connections are not. Channels are also *not thread-safe* — sharing one channel across threads corrupts the framing protocol, so give each thread its own.

```python
conn = pika.BlockingConnection(pika.ConnectionParameters('broker'))
ch = conn.channel()                 # one channel per worker thread
ch.basic_qos(prefetch_count=20)     # fair dispatch, cap unacked
ch.basic_consume('tasks', on_message)
```

### Q3. Explain the "smart broker, dumb consumer" philosophy and contrast it with Kafka.

RabbitMQ puts the intelligence in the **broker**. Routing, filtering, per-message TTL, priority, retry-via-DLX, and delivery tracking all happen server-side. The consumer is simple: it opens a channel, consumes from a queue, processes, acks. It holds no offset, makes no routing decisions, and once it acks, the broker forgets the message.

Kafka is the inverse — a **dumb broker, smart consumer**. The broker is an append-only log that does almost nothing but persist and serve byte ranges. Every consumer tracks its own **offset**, decides where to read, and does any filtering client-side. The broker never deletes on read; messages live until retention expires.

Consequences that fall out of this inversion:

| Concern | RabbitMQ (smart broker) | Kafka (smart consumer) |
|---|---|---|
| Routing | Server-side, rich (topic/headers) | Client-side; partition by key only |
| After consume | Message deleted on ack | Retained until retention window |
| Replay | No (except Streams) | Yes — reset offset |
| Throughput | ~tens–hundreds K msg/s/node | Millions msg/s |
| Best at | Task queues, RPC, complex routing | High-volume event streaming, replay |

Neither is "better" — they optimize for different questions. "Which worker should do this job?" is RabbitMQ. "Let me replay yesterday's events into a new service" is Kafka.

### Q4. Trace the full lifecycle of a message from publish to deletion.

1. **Publish** — producer sends to an exchange with a routing key. Optionally uses **publisher confirms** (`confirm.select`) so the broker acks back that it took responsibility.
2. **Route** — the exchange evaluates bindings and copies the message into zero or more matching queues. *Zero* is important: an unroutable message is silently dropped unless the publish set the `mandatory` flag or an **alternate exchange** is configured.
3. **Queue** — the message sits in the queue, ordered FIFO. If the queue and message are both marked durable/persistent, it's written to disk so it survives a broker restart.
4. **Deliver** — the broker pushes the message to a consumer on that queue (respecting `prefetch_count` so it won't overload one consumer).
5. **Ack** — with manual acks, the consumer processes then sends `basic.ack`. Only *now* does the broker delete it. If the consumer dies before acking (channel closes), the message is redelivered to another consumer.
6. **Delete** — on ack, the message is removed. If the consumer `nack`s/`reject`s with `requeue=false`, and a DLX is set, it's re-routed to the dead-letter exchange instead of vanishing.

The gap between step 4 and step 5 is where **at-least-once** delivery lives: a crash after processing but before ack means the message is redelivered, so consumers must be idempotent. Using `autoAck` (ack-on-delivery) turns this into at-most-once and risks silent message loss.

### Q5. What are virtual hosts and when do you use them?

A **vhost** is a logical namespace inside a single broker. Each vhost has its own set of exchanges, queues, bindings, users, and permissions — they're completely isolated from other vhosts even though they share the same broker process and port. A queue named `orders` in vhost `/prod` is a totally different queue from `orders` in `/staging`.

Use them for **multi-tenancy and environment isolation** without standing up separate clusters: separate `/team-a` and `/team-b`, or `/prod` and `/test`, granting each user permissions scoped to their vhost. The default vhost is `/`. You reference a vhost in the connection URI: `amqp://user:pass@broker:5672/%2Fprod` (the `%2F` is a URL-encoded leading slash).

```bash
rabbitmqctl add_vhost prod
rabbitmqctl set_permissions -p prod app_user ".*" ".*" ".*"
rabbitmqctl list_queues -p prod name messages
```

They're an access-control and isolation boundary, **not** a scaling mechanism — all vhosts contend for the same node's CPU, memory, and disk.

### Q6. Why is RabbitMQ built on Erlang/OTP, and does it matter operationally?

RabbitMQ is written in **Erlang** and runs on the **BEAM** VM using the **OTP** framework — a platform designed by Ericsson for telecom switches that must stay up for years. This is a deliberate fit: Erlang's lightweight processes (millions of them, cheap to spawn), share-nothing message passing, and "let it crash" supervision trees map almost perfectly onto a message broker, where each connection/channel/queue is naturally an isolated process supervised by OTP. Built-in distribution (Erlang's node clustering) is how RabbitMQ nodes discover and talk to each other with relatively little bespoke code.

Operationally it means:

- **Clustering is native** — nodes form an Erlang cluster; the **Erlang cookie** (`~/.erlang.cookie`) must match across nodes or they refuse to connect (a classic gotcha).
- **Per-connection isolation** — one misbehaving connection crashing rarely takes down the broker; its supervising process restarts it.
- **You inherit the BEAM** — tuning sometimes means Erlang VM flags, and diagnostics use Erlang tooling. `rabbitmqctl` is itself an Erlang node that connects to the running broker.

You don't need to write Erlang, but recognizing "cookie mismatch" and "the BEAM VM" in a debugging scenario is a senior tell.

### Q7. Give a concrete routing example — how would you fan work out vs broadcast events?

Two different needs, two different topologies.

**Work queue (competing consumers)** — one queue, many consumers. The broker round-robins messages across consumers; each message goes to exactly one worker. Add `prefetch_count` so a slow worker doesn't hoard messages:

```python
ch.queue_declare('image_resize', durable=True)
ch.basic_qos(prefetch_count=1)          # fair dispatch: one in-flight per worker
ch.basic_consume('image_resize', worker, auto_ack=False)
```

**Broadcast (pub/sub)** — a fanout exchange, one queue *per* subscriber. Every subscriber gets its own copy:

```python
ch.exchange_declare('events', 'fanout', durable=True)
q = ch.queue_declare('', exclusive=True).method.queue   # server-named, per-consumer
ch.queue_bind(q, 'events')
```

**Selective routing** — topic exchange so subscribers pick what they want:

```python
ch.exchange_declare('logs', 'topic', durable=True)
ch.queue_bind(alerts_q, 'logs', routing_key='*.*.critical')
ch.queue_bind(audit_q,  'logs', routing_key='auth.#')
```

The key insight: **competing-consumers vs pub/sub is decided by queue topology, not exchange type**. Sharing one queue = work distribution; one queue per consumer = broadcast.

### Q8. How do you make RabbitMQ durable and highly available? What replaced mirrored queues?

Durability and HA are two different things.

**Durability (survive a restart)** needs three flags aligned: declare the queue `durable=True`, publish with `delivery_mode=2` (persistent), and ideally use **publisher confirms** so you know the broker actually persisted it. Miss any one and messages can evaporate on restart — a durable queue holding non-persistent messages still loses them.

**High availability (survive a node loss)** used to mean **classic mirrored queues**, which are now **deprecated**. The modern answer is **quorum queues**, backed by the **Raft** consensus algorithm. A quorum queue replicates across an odd number of nodes (typically 3 or 5); writes are confirmed once a majority (quorum) has them, and leader election is automatic on failure. They trade a bit of throughput for correctness and predictable failover, and they don't suffer the split-brain and sync-latency pathologies mirrored queues were notorious for.

```bash
rabbitmqctl set_policy ha-quorum "^orders\." \
  '{"queue-type":"quorum","initial-cluster-size":3}' --apply-to queues
```

For interviews: if someone mentions mirrored/HA-policy queues as the current best practice, correcting them to quorum queues is the signal. **Streams** (below) are a separate replicated primitive for high-throughput, replayable workloads.

### Q9. When is RabbitMQ the wrong choice? Where does the smart-broker model hit its limits?

Be honest about the ceilings:

- **Throughput** — the smart-broker model does per-message work (routing, tracking, acking), so a node tops out around tens to low-hundreds of thousands of msg/s. Kafka does millions because the broker barely thinks. High-volume telemetry/clickstream → Kafka.
- **No replay after ack** — messages are deleted on ack. If you need to re-process history, add a new consumer group that reads from the beginning, or do event sourcing, classic RabbitMQ can't. That's Kafka (or RabbitMQ **Streams**).
- **Large backlogs hurt** — queues are meant to be near-empty. Millions of unacked messages sitting in a queue push RabbitMQ into memory/disk pressure and flow-control (it throttles publishers). Kafka is happy holding terabytes because it's just a log on disk.
- **Fan-out to many consumers** — each subscriber needs its own queue, so broadcasting to hundreds of consumers multiplies storage and routing cost; Kafka's shared log is cheaper here.

RabbitMQ *shines* at: task/work queues with per-message ack and retry, complex conditional routing, request/reply **RPC** (via a reply-to queue and correlation id), priority queues, delayed/TTL messages, and anywhere you need the broker to make delivery decisions. Choose it when routing complexity and per-message reliability matter more than raw volume or replay.

### Q10. Briefly — AMQP 1.0 and Streams. How do they change the picture?

Two things worth knowing so you're current:

**AMQP 1.0** is a different, standardized (OASIS/ISO) protocol — *not* an incremental upgrade of 0-9-1. It's a peer-to-peer, symmetric messaging protocol without the fixed exchange/binding model baked into the wire format; brokers like Azure Service Bus speak it natively. RabbitMQ has supported it via plugin and, in recent versions, as a first-class protocol alongside 0-9-1. For most RabbitMQ interview questions, **0-9-1 is still the model you reason about** (exchanges/bindings/queues) — mention 1.0 as "the newer standardized protocol, different model, good for interop."

**Streams** (RabbitMQ 3.9+) are a separate, **append-only, replayable log** primitive bolted onto RabbitMQ — deliberately Kafka-like. Messages aren't deleted on consume; consumers read by **offset** and can rewind, and streams are replicated for HA. They're for high-throughput, large-fan-out, replayable workloads that classic queues can't serve, accessed via the dedicated stream protocol (or AMQP). The mental model: RabbitMQ grew a Kafka-shaped tool for the cases where its smart-broker queues hit a wall — but the two coexist in one broker.

### Q11. The interview one-liner.

RabbitMQ is the **smart broker**: producers publish to an *exchange* (never a queue), which routes via *bindings* to *queues* that dumb consumers drain and ack — messages are deleted on ack, so the broker owns routing, delivery tracking, and retry while the consumer stays simple. Built on Erlang/OTP for native clustering and crash-isolation, it multiplexes work over *channels* on one TCP *connection*, isolates tenants with *vhosts*, and replicates durably with Raft-based *quorum queues* (mirrored queues are deprecated). It's the right tool for task queues, RPC, and complex routing, and the wrong tool when you need Kafka-scale throughput or post-ack replay — for which RabbitMQ now offers *Streams*.


## RabbitMQ Exchange Types & Routing

### Summary

**What this topic covers**

RabbitMQ's defining feature is that producers never publish to queues — they publish to an *exchange*, and the exchange's *type* plus a set of *bindings* decides which queues (if any) receive a copy. This topic covers the four exchange types (direct, fanout, topic, headers), the special default exchange, how bindings and routing keys actually match, and the operational routing machinery that senior interviews probe: dead-letter exchanges, message and queue TTL, priority queues, alternate exchanges, and the consistent-hash exchange for partition-like ordering. It's the AMQP 0-9-1 routing model, which is what makes RabbitMQ far more flexible than a flat topic log like Kafka — at the cost of more moving parts. For quorum-queue replication and delivery-ack mechanics see the RabbitMQ Architecture topic; here the lens is *how a message finds its queue*.

**Mental model**

Think of an exchange as a mail-sorting room. A producer drops an envelope with a *routing key* written on it into a named sorting room (the exchange). The room doesn't store anything — it only *routes*. Clerks (bindings) have standing instructions: "anything matching this pattern, drop into queue X." The exchange *type* is the sorting algorithm the room uses. A `direct` room matches the routing key exactly against each binding key. A `fanout` room ignores the key entirely and copies the envelope into every bound queue. A `topic` room treats the key as dotted words (`orders.eu.paid`) and matches binding patterns with wildcards. A `headers` room ignores the key and matches on envelope header attributes instead. Crucially: if no binding matches, the message is *dropped silently* (or routed to an alternate exchange if configured) — unroutable messages are a classic silent-data-loss bug. One publish can fan into many queues, or zero. Queues are where messages actually live and get consumed; exchanges are stateless routing rules in front of them.

**Key terms**

- **exchange** — stateless router; producers publish here, never to queues directly.
- **binding** — a rule linking an exchange to a queue (or another exchange), with a binding key and optional arguments.
- **routing key** — a string the producer stamps on each message; how direct/topic exchanges match.
- **direct exchange** — routes on exact routing-key == binding-key match.
- **fanout exchange** — copies to every bound queue, ignoring the key (pub/sub broadcast).
- **topic exchange** — dotted routing keys matched by wildcard patterns using `*` (one word) and `#` (zero or more words).
- **headers exchange** — matches on message header key/values via `x-match: all|any`, ignores routing key.
- **default exchange** — the nameless (`""`) direct exchange every queue is auto-bound to by its own name.
- **dead-letter exchange (DLX)** — where messages go when rejected, expired, or overflowed (`x-dead-letter-exchange`).
- **TTL** — per-message or per-queue expiry (`x-message-ttl`); expired messages dead-letter or drop.
- **alternate exchange (AE)** — catch-all for otherwise-unroutable messages (`alternate-exchange` arg).
- **consistent-hash exchange** — plugin exchange that hashes the routing key across bound queues for ordered partitioning.

**Why interviewers ask this**

Routing is where RabbitMQ's flexibility lives, so it separates people who've clicked "create queue" in the UI from people who've designed a real topology. A junior answer names the exchange types. A senior answer knows *when* each is the right tool (fanout for pub/sub, topic for a flexible workhorse, direct for simple work routing), knows that unroutable messages vanish unless you set an alternate exchange, and can wire a dead-letter exchange plus TTL to build retry-with-backoff and parking-lot queues from primitives. The consistent-hash and mandatory-flag details signal someone who's operated RabbitMQ under load and hit its ordering and silent-drop foot-guns.

**Common confusions**

- "Producers send to queues" → no, producers send to exchanges; the default exchange just *looks* like publishing to a queue by name.
- "`*` and `#` are like shell globs" → no, they match *whole dot-delimited words*: `*` is exactly one word, `#` is zero or more words.
- "A DLX retries messages" → a DLX only *re-routes* dead messages; you build retry by combining DLX + TTL + a return path yourself.
- "Unroutable messages error out" → they're dropped silently unless you set `mandatory` (get a return) or an alternate exchange.
- "Priority queues reorder already-queued messages" → priority only affects *ready* messages not yet delivered; in-flight/prefetched ones aren't reordered.

**What follows from this topic**

Once routing is clear, the Delivery Semantics topic explains acks, redelivery and idempotency for the messages these bindings deliver; the RabbitMQ Architecture topic covers quorum queues and the replication behind those queues; and the Broker Comparison topic contrasts this rich routing model against Kafka's leaner partitioned log — the reason you reach for RabbitMQ when routing logic, not raw throughput, is the hard problem.

### Q1. Walk through the four exchange types and when you'd pick each.

- **direct** — routes on an *exact* routing-key match against binding keys. Use for straightforward routed work: a task published with key `pdf` goes only to queues bound with `pdf`. It's the simplest and the type behind the default exchange.
- **fanout** — ignores the routing key and copies every message to *all* bound queues. This is pub/sub broadcast: publish an "order placed" event once, and independent consumers (email service, analytics, fraud check) each get their own copy on their own queue. Adding a subscriber is just binding a new queue — the producer never changes.
- **topic** — the flexible workhorse. Routing keys are dot-delimited words (`logs.error.auth`), and binding patterns use `*` (exactly one word) and `#` (zero or more words). A queue bound with `logs.error.*` gets `logs.error.auth` and `logs.error.db` but not `logs.error` or `logs.info.auth`. Bound with `logs.#` it gets everything under `logs`. Use it whenever routing is multi-dimensional (severity × subsystem × region).
- **headers** — ignores the routing key and matches on message *header* attributes, with `x-match: all` (AND) or `x-match: any` (OR). Rarely used because topic covers most cases and header matching is slower, but it shines when routing depends on several non-hierarchical attributes (`format=pdf`, `locale=en`) that don't compose into a clean dotted key.

Rule of thumb: **direct** for one-key routed work, **fanout** for broadcast, **topic** for anything with structure, **headers** only when a dotted key genuinely can't express the match.

### Q2. How do bindings and routing keys actually work? Give a worked topic example.

A binding connects an exchange to a queue with a *binding key*. When a message arrives, the exchange compares the message's *routing key* to each binding key using its type's algorithm, and delivers a copy to every queue whose binding matches. Zero matches means the message is dropped (unless an alternate exchange is set). Multiple matches to the *same* queue still deliver only one copy.

Worked topic example — a logging topology where routing keys are `<subsystem>.<severity>.<region>`:

```
Exchange: logs (type=topic)

Queue: all-errors        binding: *.error.*
Queue: eu-anything       binding: #.eu
Queue: auth-audit        binding: auth.#
Queue: firehose          binding: #
```

Publish these routing keys and see where they land:

```
auth.error.eu   -> all-errors (*.error.*), eu-anything (#.eu), auth-audit (auth.#), firehose (#)
db.info.us      -> firehose (#)
auth.info.eu    -> eu-anything (#.eu), auth-audit (auth.#), firehose (#)
payment.error.us-> all-errors (*.error.*), firehose (#)
```

Note `*` must match *exactly one* word, so `*.error.*` does **not** match `auth.error` (only two words) or `auth.error.eu.west` (four words). `#` matches zero-or-more, so `#.eu` matches both `auth.error.eu` and a bare `eu`. Declaring the same binding key twice for one queue is idempotent; different binding keys to one queue are OR-ed.

### Q3. What is the default (nameless) exchange and why does "publish to a queue" seem to work?

Every RabbitMQ broker has a pre-declared **default exchange**: a direct exchange with the empty-string name `""`. Every queue is *automatically* bound to it with a binding key equal to the queue's own name. So when a client "publishes to a queue," it's really publishing to the default exchange with the routing key set to the queue name:

```python
channel.queue_declare(queue="tasks")
channel.basic_publish(exchange="", routing_key="tasks", body="job-1")
```

`exchange=""` is the default exchange; `routing_key="tasks"` matches the auto-binding to the `tasks` queue. This is why simple examples and work-queue tutorials never mention exchanges — the default one is doing invisible direct routing. You can't delete it, can't bind to it explicitly, and it has no wildcard behaviour (it's direct). For anything beyond point-to-point, declare your own exchange.

### Q4. What is a dead-letter exchange, and what causes a message to be dead-lettered?

A **dead-letter exchange (DLX)** is a normal exchange nominated as the destination for messages a queue rejects. Set it per queue at declare time:

```python
channel.queue_declare(
    queue="orders",
    arguments={
        "x-dead-letter-exchange": "orders.dlx",
        "x-dead-letter-routing-key": "orders.dead"  # optional key override
    }
)
```

A message is dead-lettered from a queue for exactly these reasons:

- **Rejected** — the consumer calls `basic.reject` or `basic.nack` with `requeue=false`.
- **TTL expired** — the message sat longer than its per-message or per-queue TTL.
- **Queue length limit hit** — the queue reached `x-max-length` or `x-max-length-bytes` and this message was dropped from the head to make room (overflow behaviour `drop-head`, the default).
- (There's also *delivery-limit exceeded* on quorum queues via `x-delivery-limit`, which dead-letters a message that's been redelivered too many times — the clean way to cap poison-message retries.)

When dead-lettered, RabbitMQ republishes the message to the DLX, using the original routing key unless `x-dead-letter-routing-key` overrides it, and stamps an `x-death` header recording the count, reason, original exchange and queue. The DLX is just an exchange — bind an inspection/parking-lot queue to it. A DLX by itself does **not** retry; it only relocates. Also watch the classic infinite-loop trap: if a message dead-letters back into a queue that dead-letters to the same DLX with the same expiry, it can cycle.

### Q5. Show how to build retry-with-backoff using DLX + TTL (a "delay queue").

RabbitMQ has no native delayed delivery in core (the delayed-message plugin exists, but the primitive pattern is worth knowing). You bounce messages between a work queue and a *wait* queue whose TTL is the backoff, using DLX to route them back:

```
work exchange  -> work queue  (consumers here)
work queue     x-dead-letter-exchange = retry.dlx   (on nack)

retry.dlx      -> wait queue
wait queue     x-message-ttl = 30000                # hold 30s
wait queue     x-dead-letter-exchange = work.exchange   # expire -> back to work
```

Flow: consumer fails, `nack(requeue=false)` → message dead-letters to `retry.dlx` → lands in `wait` queue → sits for the 30s TTL → expires → dead-letters back to `work.exchange` → redelivered. For exponential backoff, run several wait queues with TTLs `1s / 10s / 60s` and route by the `x-death` count. Cap attempts with `x-delivery-limit` (quorum queues) or by inspecting the `x-death` count and shunting to a permanent parking-lot queue. This whole retry machine is just DLX + TTL composed — a favourite "build it from primitives" interview question.

### Q6. Explain message TTL vs queue TTL, and priority queues.

**Message/queue TTL** controls expiry:

- **Per-message TTL** — set on publish via the `expiration` property (a string of milliseconds). Only enforced when the message reaches the head of the queue, so a short TTL behind a long backlog may outlive its nominal deadline.
- **Per-queue message TTL** — `x-message-ttl` on the queue; applies to *all* messages in it and is evaluated more promptly.
- **Queue TTL** — `x-expires`: auto-delete the *whole queue* after it's been unused (no consumers, no gets) for that long. Different concept — it garbage-collects idle queues, useful for per-session reply queues.

Expired messages are discarded, or dead-lettered if a DLX is set — that's exactly what powers the delay-queue pattern in Q5.

**Priority queues** — declare with `x-max-priority` (e.g. `1–10`; keep the range small, 1–5 is plenty, since each priority level costs resources):

```python
channel.queue_declare(queue="jobs", arguments={"x-max-priority": 5})
channel.basic_publish(exchange="", routing_key="jobs",
    body="urgent", properties=pika.BasicProperties(priority=5))
```

Higher priority messages are delivered ahead of lower ones — but only among messages that are *ready* and not yet sent to a consumer. Messages already prefetched into a consumer's buffer won't be preempted, so keep the consumer `prefetch` (QoS) low if priority must be responsive. Priority is *not* strict starvation-free scheduling; a flood of high-priority messages can starve low ones.

### Q7. What is an alternate exchange and why does it matter for reliability?

By default, a message that matches *no* binding is silently dropped — a real source of "we never got the event" incidents. Two defences:

- **`mandatory` flag on publish** — if the message is unroutable, the broker *returns* it to the producer via a `basic.return` (which you must handle in a return listener). Good for producers that can react, but it's per-publish and requires client code.
- **Alternate exchange (AE)** — a broker-side catch-all. Declare an exchange with an `alternate-exchange` argument; any message it can't route goes to the alternate exchange instead of being dropped:

```python
channel.exchange_declare(exchange="orders", exchange_type="topic",
    arguments={"alternate-exchange": "unrouted"})
channel.exchange_declare(exchange="unrouted", exchange_type="fanout")
channel.queue_bind(queue="unrouted-inbox", exchange="unrouted", routing_key="")  # capture strays
```

The AE is typically a fanout feeding an `unrouted` queue you monitor/alert on. It's the belt-and-braces answer: use an AE so nothing silently vanishes, and optionally `mandatory` where the producer can meaningfully respond. A queue with a growing `unrouted` backlog is your early warning that a producer changed its routing keys or a binding was deleted.

### Q8. How do you get partition-like ordering across consumers in RabbitMQ? (consistent-hash exchange)

RabbitMQ preserves order within a *single* queue consumed by a *single* consumer. Scale to multiple consumers on one queue and ordering across them is gone (competing consumers). To get Kafka-like "same key → same consumer, ordered" you use the **consistent-hash exchange plugin** (`rabbitmq_consistent_hash_exchange`):

```
rabbitmq-plugins enable rabbitmq_consistent_hash_exchange
```

Declare an exchange of type `x-consistent-hash` and bind N queues to it, where each binding key is a *weight* (integer). The exchange hashes each message's routing key (or a chosen header/property) and maps it to a queue via a consistent-hash ring, so all messages with the same key always land in the same queue — and each queue is drained by one consumer, giving per-key ordering:

```python
channel.exchange_declare(exchange="events", exchange_type="x-consistent-hash")
for q in ["p0", "p1", "p2", "p3"]:
    channel.queue_declare(queue=q)
    channel.queue_bind(queue=q, exchange="events", routing_key="1")  # weight 1
channel.basic_publish(exchange="events", routing_key="customer-42", body="...")  # key = partition key
```

Consistent hashing means adding/removing a queue only remaps a fraction of keys, not everything. Caveats: it's approximate load balancing (hot keys still land on one queue), and rebalancing on queue add/remove can briefly reorder across the boundary. It's the honest answer to "how would you do Kafka-style keyed ordering in RabbitMQ" — possible, but you're bolting on what Kafka gives natively with partitions (see the Broker Comparison topic).

### Q9. Compare RabbitMQ topic routing to Kafka topics for the same problem.

They sound similar but are architecturally opposite:

- **Where routing lives** — RabbitMQ routes on the *broker* via exchange type + bindings; a producer can publish once and fan to many queues by different rules, and you add/change routing without touching producers or consumers. Kafka has no server-side content routing: a "topic" is a fixed partitioned log, and any filtering/fan-out is the *consumer's* job (or a stream processor's).
- **Fan-out** — RabbitMQ fanout/topic gives per-consumer copies natively. Kafka gives fan-out via *consumer groups*: every group independently reads the whole partition set, so N independent readers = N groups.
- **Ordering** — Kafka guarantees order per partition out of the box. RabbitMQ guarantees order only per queue/single-consumer and needs the consistent-hash exchange (Q8) to approximate keyed partitioning.
- **Retention/replay** — Kafka retains the log and lets you rewind by offset. RabbitMQ queues are destructive-read: once acked, a message is gone; there's no replay (that's a frequent reason to pick Kafka).

Pick RabbitMQ when the *routing logic* is the hard part — complex conditional delivery, per-message TTL, priorities, request/reply. Pick Kafka when *throughput, ordering, and replay* over a stream dominate. Using RabbitMQ as a firehose event log, or Kafka as a flexible task router, is fighting the tool.

### Q10. Debugging scenario: messages are published successfully but a consumer's queue stays empty. How do you diagnose it?

"Published successfully" only means the broker accepted the publish into the *exchange* — it says nothing about routing. Work outward:

- **Check the binding, not the publish.** In the management UI or `rabbitmqctl list_bindings`, confirm a binding exists from the exchange to that queue and that its binding key actually matches the routing key being used. For topic exchanges, re-check `*`/`#` word semantics — `*.error` won't match `auth.error.eu`.
- **Look for unroutable drops.** If there's no alternate exchange, mismatched keys are silently discarded. Add an AE (Q7) or publish with `mandatory` and a return listener to *see* the strays; a filling `unrouted` queue confirms a routing-key/binding mismatch.
- **Confirm the right exchange.** A very common bug: the producer publishes to `exchange=""` (default/direct, keyed by queue name) while the consumer bound its queue to a *custom* topic exchange — the two never meet.
- **Check publisher confirms.** Without publisher confirms, `basic_publish` returning doesn't even guarantee the broker durably accepted it. Enable confirms to distinguish "never reached broker" from "reached broker, didn't route."
- **Check the queue itself.** `rabbitmqctl list_queues name messages consumers` — if `messages` is climbing but `consumers` is 0, it's a consumer problem, not routing; if `messages` stays 0, it's routing.

The mental split: *did the message reach the broker* (publisher confirms) vs *did the exchange route it* (bindings + AE) vs *is anyone consuming* (queue consumer count). Almost every "empty queue" bug is a routing-key/binding mismatch on an exchange with no alternate exchange.

### Q11. The interview one-liner: RabbitMQ routing in one crisp paragraph.

Producers publish to a stateless *exchange*, never to a queue, and the exchange *type* plus its *bindings* decide which queues get a copy: `direct` matches the routing key exactly (routed work), `fanout` copies to every bound queue (broadcast pub/sub), `topic` matches dotted routing keys with `*` (one word) and `#` (zero-or-more words) as the flexible workhorse, and `headers` matches on attributes (rarely used); the nameless default exchange auto-binds every queue by name for simple point-to-point. Unrouted messages vanish unless you set an alternate exchange, and the reliability toolkit — dead-letter exchanges (on reject/`nack`, TTL expiry, or queue-length overflow), message/queue TTL, priority queues, and the consistent-hash exchange for keyed partition-like ordering — is all composed from these same routing primitives, which is exactly why you reach for RabbitMQ when *how a message finds its queue* is the hard problem rather than raw throughput.


## RabbitMQ Reliability & Clustering

### Summary

**What this topic covers**

RabbitMQ is a broker built around AMQP 0-9-1 semantics: producers publish to *exchanges*, exchanges route copies into *queues* via bindings, and consumers pull from queues. That routing flexibility is its selling point, but it also means "did my message survive?" has several independent answers — one for the publish leg, one for storage, one for the consume leg, and one for what happens when a node dies. This topic is about wiring all of those together so the broker actually gives at-least-once delivery with no silent loss: publisher **confirms**, the **mandatory** flag, consumer **acks** and prefetch, message/queue **durability**, and the replicated queue types (**quorum queues**, which replaced classic mirroring, plus **streams**) that keep data alive across a node failure or network partition.

**Mental model**

Think of a message crossing three trust boundaries, each with its own acknowledgement. First boundary: producer to broker — the broker sends a **publisher confirm** (`basic.ack`) only once the message is safely routed and, for a durable message on a durable queue, fsync'd to disk (or replicated to a quorum). No confirm means assume it did not land; republish. Second boundary: sitting in a queue — survives a broker restart only if the queue is `durable` *and* the message is `persistent`. Third boundary: broker to consumer — the message stays "unacked" and redeliverable until the consumer sends `basic.ack`; only then does the broker discard it. Break any link and you lose messages: a transient (non-durable) queue evaporates on restart, an unacked message on a crashed non-mirrored node is gone, and publishing without confirms means the broker can drop a message and the producer never knows. Reliability is the *conjunction* of all three plus replication — one weak link defeats the rest.

**Key terms**

- **Publisher confirm** — async `basic.ack` from broker to producer that a publish was persisted/routed; enabled per-channel with `confirm.select`. The RabbitMQ analogue of Kafka `acks=all`.
- **`mandatory` flag** — publish option; if the message can't be routed to any queue, the broker returns it via a `basic.return` (return callback) instead of silently dropping it.
- **Consumer ack** — `basic.ack` after processing; with `basic.nack`/`basic.reject` you can requeue or dead-letter. Manual acks are the safe default; auto-ack means fire-and-forget.
- **Prefetch (`basic.qos`)** — cap on unacked messages the broker will push to one consumer; bounds in-flight work and prevents one greedy consumer hogging the queue.
- **Durable queue** — queue metadata survives broker restart. Orthogonal to message persistence.
- **Persistent message** — `delivery_mode=2`; the message body is written to disk. Needs a durable queue to matter.
- **Quorum queue** — Raft-based replicated FIFO queue, the modern default for reliability; survives node loss with a majority of replicas up.
- **Classic mirrored queue** — deprecated (removed in 4.0) leader/mirror replication; superseded by quorum queues.
- **Stream** — append-only replicated log queue type (non-destructive reads, offset-based), for high-throughput fan-out and replay.
- **`pause_minority`** — partition-handling mode that pauses nodes in a minority partition to prevent split-brain.

**Why interviewers ask this**

RabbitMQ makes it *easy* to build something that looks reliable and silently isn't — the defaults (transient queue, auto-ack, no confirms) lose data cheerfully. A junior says "RabbitMQ persists messages" and stops. A senior knows persistence is four independent switches that must *all* be on, can explain why a confirm can arrive before a consumer ever sees the message, knows quorum queues replaced mirroring and why (mirroring had unbounded sync times and data-loss edge cases under partition), and can reason about the CAP tradeoff during a network split. The signal is whether you can name the exact failure mode for each missing guarantee, not recite that RabbitMQ is "reliable."

**Common confusions**

- "Durable queue means messages survive" → No. Durable queue + persistent message + confirms are three separate things; a durable queue full of transient messages loses them on restart.
- "Publisher confirm means the consumer got it" → No. A confirm only means the *broker* accepted/stored it; consumer acks are a separate leg.
- "Mirrored queues are the HA option" → Deprecated and removed in 4.0. Use quorum queues.
- "Persistent = written to disk immediately" → Persistence can still be buffered; only a confirm guarantees it's safe.

**What follows from this topic**

This is the RabbitMQ-specific cut of the broader Delivery Semantics topic — confirms + acks give at-least-once, and idempotent consumers get you to effectively-once. Contrast with the Kafka topics (replication factor + ISR + `acks=all` are Kafka's equivalent of durable + quorum + confirms) and the routing topic (exchanges/bindings decide *which* queues a confirmed message reached).

### Q1. Walk me through everything required for a published message to survive a broker crash and be delivered exactly once-ish.

Four things, all mandatory, plus an idempotent consumer:

1. **Durable queue** — declared with `durable=true` so the queue definition survives restart.
2. **Persistent message** — published with `delivery_mode=2` so the body is written to disk.
3. **Publisher confirms** — channel in confirm mode (`confirm.select`); the producer treats a publish as successful *only* after the broker `basic.ack`s it, and republishes on nack/timeout.
4. **Replication** — a **quorum queue** (or stream) so the data survives losing the node that held it, not just a restart of a single node.

Then on the consume side, **manual acks after processing** give at-least-once. RabbitMQ has no exactly-once delivery, so the consumer must be **idempotent** (dedupe on a message ID) to make redelivery harmless. Miss any one — say you skip confirms — and the broker can accept then drop a message during the fsync window and the producer never learns.

### Q2. Publisher confirms vs the `mandatory` flag — what does each protect against?

They cover different failures and you usually want both:

- **Confirms** answer "did the broker durably accept this message?" The broker sends an async `basic.ack` (with the message's delivery tag) once it's safely enqueued — persisted to disk for a durable/persistent combo, or replicated for a quorum queue. A `basic.nack` means the broker couldn't take responsibility; republish.
- **`mandatory`** answers "did it route to *any* queue?" A message can be perfectly accepted by the broker yet match no binding — an exchange with no queue bound for that routing key. Without `mandatory`, the broker silently discards it (and still confirms it!). With `mandatory=true`, an unroutable message triggers a `basic.return` to a return callback so you can log/redirect it.

Classic gotcha: a message gets confirmed *and* returned. Confirm = "I took it"; return = "…but it went nowhere." Handle returns before confirms in your client logic.

```python
ch.confirm_delivery()  # channel in confirm mode
ch.add_on_return_callback(on_returned)  # unroutable handler
ch.basic_publish(
    exchange="orders", routing_key="new",
    body=payload,
    properties=pika.BasicProperties(delivery_mode=2),  # persistent
    mandatory=True,
)
```

### Q3. Explain consumer acks: manual ack, nack/reject, requeue, and the ack-after-processing rule.

A delivered message is held in an "unacked" state until the consumer resolves it — it is *not* removed from the queue on delivery. Options:

- **`basic.ack`** — done, discard it. The rule: **ack only after you've fully processed** (persisted the side effect). Ack-before-processing turns a crash mid-work into silent loss.
- **`basic.nack`** / **`basic.reject`** — processing failed. `requeue=true` puts it back for redelivery; `requeue=false` drops it or routes to a dead-letter exchange if configured. `basic.nack` can batch (`multiple=true`); `reject` handles one message.
- **auto-ack (`no_ack=true`)** — broker considers it delivered the instant it's sent. Fire-and-forget; any consumer crash loses in-flight messages. Only for metrics/telemetry where loss is fine.

Watch out for **poison-message requeue loops**: `nack` with `requeue=true` on a message that always fails will spin forever. Cap redeliveries (track `x-death` count) and dead-letter after N attempts.

### Q4. What is prefetch and why does it matter?

Prefetch (`basic.qos(prefetch_count=N)`) caps how many **unacked** messages the broker will push to a single consumer channel before it must ack some. It's flow control:

- **Default / prefetch=0 (unlimited)** — the broker floods one consumer with the whole queue. That consumer's memory balloons, and work is unevenly distributed because everything lands on whoever grabbed it first.
- **prefetch=1** — strict fairness, each consumer holds exactly one; safe but throughput suffers on fast-network/slow-many-consumer setups from the ack round-trip.
- **A moderate value (e.g. 10–100)** — the usual sweet spot: enough in flight to hide network latency, low enough to spread load and bound memory.

Tune it against processing time: `prefetch ≈ (round-trip latency / processing time) + buffer`. For slow, heavy handlers keep it low; for tiny fast messages go higher.

### Q5. Quorum queues vs classic mirrored queues — what changed and why?

**Classic mirrored queues** (HA policy with a leader and mirror replicas) were the old HA story and are **deprecated and removed in RabbitMQ 4.0**. **Quorum queues** — introduced in 3.8, the reliability default since — replaced them. Why the switch:

- **Consensus, not ad-hoc sync.** Quorum queues use the **Raft** algorithm: a leader plus followers, writes committed once a **majority** acknowledges. Mirroring used a bespoke sync protocol with no formal consistency guarantee.
- **Predictable failure behavior.** Mirror synchronization could take unbounded time and had genuine data-loss edge cases under partition and during mirror promotion. Raft's majority rule gives deterministic, well-understood semantics.
- **Partition safety.** A quorum queue keeps serving only while a majority of its replicas are reachable; a minority partition can't accept writes, so no split-brain divergence.

Cost: quorum queues need an **odd replica count** (typically 3 or 5) for a clean majority, they're always durable (no transient quorum queue), and they use more memory/disk than a single classic queue. Declare with `x-queue-type: quorum`. Rule of thumb: **any queue you actually care about should be a quorum queue.**

```bash
rabbitmqadmin declare queue name=payments durable=true \
  arguments='{"x-queue-type":"quorum"}'
```

### Q6. When would you use streams instead of a quorum queue?

**Streams** (RabbitMQ 3.9+) are a separate, append-only **replicated log** queue type — think a Kafka-style commit log inside RabbitMQ. Key differences from queues:

- **Non-destructive reads.** Consuming doesn't delete; messages stay until a retention limit (size/age). Multiple independent consumers read the same stream at their own **offset**, and you can rewind/replay.
- **High throughput, large fan-out.** Optimized for millions of messages and many consumers, where a classic/quorum queue (delete-on-ack, per-consumer competition) would struggle.
- **Retention-based, not ack-based cleanup.** You set `max-length-bytes` / `max-age`; old segments are truncated.

Use a stream when you want a durable, replayable log with fan-out (event sourcing, audit trails, feeding many consumers). Use a quorum queue for classic work-queue semantics (compete for messages, ack, delete). Streams are RabbitMQ answering "what if I want Kafka semantics without leaving RabbitMQ" — see the Kafka topics for when you'd reach for Kafka proper instead.

### Q7. How does RabbitMQ handle a network partition, and what is `pause_minority`?

In a cluster, a network partition splits nodes into groups that can't see each other — the classic split-brain risk where both sides accept writes and diverge. RabbitMQ's `cluster_partition_handling` setting decides the policy:

- **`pause_minority`** (recommended) — nodes in the **minority** side of a partition **pause** (stop serving) until they can rejoin the majority. This preserves consistency: only the majority partition stays live, so there's no divergence. Requires 3+ nodes to have a meaningful majority.
- **`autoheal`** — both sides keep running; when the partition heals, RabbitMQ picks a winning partition and **restarts the losers**, discarding their state. Favors availability over consistency.
- **`ignore`** — do nothing; you get split-brain and must reconcile manually. Almost never what you want.

Quorum queues reinforce `pause_minority`: their Raft majority rule already refuses writes without a quorum, so the queue layer and the cluster layer agree. This is a CAP choice — `pause_minority` chooses CP (consistency, sacrifice availability on the minority side).

```ini
cluster_partition_handling = pause_minority
```

### Q8. When does RabbitMQ actually lose messages?

Enumerate the failure modes — this is what interviewers probe:

- **Transient queue on broker restart.** Non-durable queue → the queue and everything in it is gone after a restart.
- **Non-persistent message.** Durable queue but `delivery_mode=1` → messages evaporate on restart even though the queue definition survives.
- **No publisher confirms.** Broker accepts then crashes during the pre-fsync window → message lost and producer never knows. Confirms close this gap.
- **Auto-ack + consumer crash.** Broker discards on delivery; consumer dies mid-processing → in-flight messages lost.
- **Unacked messages on a lost non-replicated node.** A classic (single-node) queue's host dies → its unacked and stored messages are gone. Quorum queues survive this by replicating to a majority.
- **Unroutable without `mandatory`.** Message matches no binding → silently dropped (and still confirmed).

Every one maps to a missing switch. Reliability = durable queue + persistent message + confirms + quorum replication + manual acks + `mandatory`, together.

### Q9. Compare RabbitMQ's reliability model to Kafka's at a high level.

Same guarantees, different mechanisms:

| Concern | RabbitMQ | Kafka |
|---|---|---|
| Durable accept | publisher confirm | `acks=all` |
| Replication | quorum queue (Raft, majority) | replication factor + ISR |
| Consumer progress | ack removes message | committed offset; log retained |
| Redelivery unit | per-message (unacked → requeue) | per-partition offset rewind |
| Ordering | per-queue (single active consumer for strict) | per-partition |
| No-loss recipe | durable + persistent + confirms + quorum + acks | RF≥3 + `acks=all` + `min.insync.replicas=2` + manual commit |

The deep difference: RabbitMQ **deletes on ack** (a work queue), so redelivery is per-message and consumers compete; Kafka **retains the log** and consumers track offsets, so replay is trivial and consumers are independent. Reach for RabbitMQ when you want rich routing (topic/headers exchanges) and per-message ack/requeue/dead-letter semantics; reach for Kafka when you want a high-throughput replayable log with per-partition ordering. Streams blur this — see the Kafka and Delivery Semantics topics.

### Q10. The interview one-liner: RabbitMQ reliability in one crisp paragraph.

RabbitMQ gives no-loss at-least-once delivery only when every leg is secured: the producer runs the channel in confirm mode and treats a message as sent only on the broker's `basic.ack` (with `mandatory=true` so unroutable messages come back rather than vanish); the queue is `durable`, the message is `persistent`, and — because durability alone only survives a restart, not a dead node — the queue is a Raft-based **quorum queue** (which replaced the deprecated classic mirrored queues, removed in 4.0) so data survives losing a minority of nodes; the consumer uses **manual acks after processing** with bounded **prefetch**, nacks/dead-letters poison messages instead of requeue-looping, and is **idempotent** because redelivery is guaranteed and exactly-once is not; and the cluster runs `pause_minority` so a network partition pauses the minority side instead of splitting the brain. Miss any single switch and RabbitMQ silently drops messages — its defaults are fast, not safe.


## Redis Pub/Sub & Streams

### Summary

**What this topic covers**
Redis ships two completely different messaging primitives that interviewers love to conflate: classic **Pub/Sub** (`SUBSCRIBE`/`PUBLISH`) and **Streams** (`XADD`/`XREADGROUP`, added in Redis 5.0). Pub/Sub is a fire-and-forget broadcast bus with *no* persistence and at-most-once delivery. Streams are a durable, append-only log with consumer groups, acknowledgements, and replay — a genuine lightweight broker that competes with Kafka and RabbitMQ for a certain class of workload. This topic covers both, their failure modes, sharded pub/sub (`SPUBLISH`) in Redis Cluster, keyspace notifications, and — the money question — when Redis Streams is *enough* versus when you reach for a real broker. For Redis internals, persistence (RDB/AOF), and cluster mechanics, see the Redis primer; here we treat Redis purely as a messaging option.

**Mental model**
Pub/Sub is a **radio broadcast**: if your receiver isn't switched on the moment a message airs, that message is gone forever. The broker holds nothing. `PUBLISH` returns the count of subscribers that received it *right now* — zero subscribers means the message evaporated, and Redis is fine with that. Streams are a **logbook**: every `XADD` appends an immutable entry with a monotonic ID (`<ms>-<seq>`), the log survives, and readers name their position. Consumer groups add a per-group cursor plus a **Pending Entries List (PEL)** — a record of "delivered but not yet `XACK`'d" entries — so a crashed consumer's in-flight work can be reclaimed by a peer via `XCLAIM`. Pub/Sub optimises for latency and simplicity at the cost of any guarantee; Streams give you Kafka-shaped semantics (durable log, groups, replay, redelivery) at Redis operational cost, capped by Redis's single-primary throughput and memory-bound retention.

**Key terms**
- **Pub/Sub channel** — an ephemeral named topic; no creation, no retention, no backlog.
- **at-most-once** — Pub/Sub's guarantee: delivered zero or one times, never redelivered.
- **stream entry** — an immutable `XADD` record with a `<ms>-<seq>` ID and field/value pairs.
- **consumer group** — a named cohort (`XGROUP CREATE`) sharing one cursor; each entry goes to exactly one member.
- **PEL (Pending Entries List)** — per-consumer set of delivered-but-unacked entry IDs; the basis for redelivery.
- **XACK** — marks an entry processed, removing it from the PEL.
- **XPENDING / XCLAIM** — inspect stuck entries and reassign ownership from a dead consumer to a live one.
- **XAUTOCLAIM** — one-call scan-and-claim of idle pending entries (Redis 6.2+).
- **MAXLEN / MINID** — trim knobs on `XADD`/`XTRIM` to cap stream size (Redis is memory-bound, so trimming is mandatory).
- **SPUBLISH / SSUBSCRIBE** — sharded pub/sub (Redis 7.0+) so messages stay on one cluster shard instead of fanning across all nodes.
- **keyspace notifications** — Pub/Sub events on data mutations (`__keyspace@0__:foo`), gated by `notify-keyspace-events`.

**Why interviewers ask this**
This separates candidates who pattern-match "Redis = fast" from those who reason about delivery guarantees. A junior reaches for Pub/Sub as a task queue and silently drops messages whenever a worker restarts. A senior knows Pub/Sub is at-most-once with *zero* buffering, that keyspace notifications inherit that same lossiness (so they're a hint, not a source of truth), and that Streams — not Pub/Sub — is the durable option. The strongest signal is knowing the *boundary*: articulating exactly when Redis Streams is the right tool and when its single-primary throughput ceiling, memory-bound retention, and thinner ecosystem mean you must pay for Kafka.

**Common confusions**
- "Redis Pub/Sub is a message queue" → no; it's fire-and-forget broadcast with no persistence. Use Streams for a queue.
- "Streams and Pub/Sub are two APIs over the same thing" → no; entirely separate subsystems with opposite guarantees.
- "`XREAD` gives me a consumer group" → no; plain `XREAD` is a fanout tail. Groups need `XREADGROUP` + `XACK`.
- "Streams persist automatically" → only as well as your Redis persistence config (AOF/RDB) and replication; an unreplicated primary failover can still lose recent writes.
- "MAXLEN keeps my last N exactly" → `MAXLEN ~ N` is *approximate* (radix-tree-node aligned) and much cheaper; use exact `MAXLEN N` only if you truly need it.

**What follows from this topic**
Streams pull directly on the Delivery Semantics and Ordering topics — its PEL is at-least-once, and idempotent consumers turn that into effective exactly-once. The Kafka topics are the natural contrast: same log-and-group shape, radically different durability and throughput envelope. See the RabbitMQ topics for the competing "smart broker, routing, DLX" model, and the Broker Landscape topic for where Redis sits among NATS, Pulsar, and the cloud queues.

### Q1. What are the delivery guarantees of classic Redis Pub/Sub, and what breaks?

Classic Pub/Sub is **at-most-once with no persistence**. `PUBLISH channel msg` pushes to every client currently subscribed and returns the receiver count; Redis stores nothing. The failure modes follow directly:

- **Offline subscribers miss everything.** A subscriber that disconnects (crash, deploy, network blip) loses every message published while it was away. There is no backlog to catch up on.
- **Slow consumers get dropped.** If a subscriber can't drain its socket buffer, it hits `client-output-buffer-limit pubsub` (default `32mb 8mb 60`) and Redis *disconnects it* to protect the server.
- **No consumer groups.** Every subscriber to a channel gets every message; you cannot load-balance a channel across N workers. Fanout only, never work-sharing.
- **No acks, no redelivery, no ordering guarantees across channels.**

Where that's genuinely fine: live notifications, chat/presence fanout, cache invalidation broadcasts ("evict key X on all app nodes"), config-change signals — anything where a missed message is self-correcting or momentary. Where it's a footgun: task queues, event sourcing, anything needing durability. For those, use Streams.

### Q2. Walk through Redis Streams with a consumer group — the commands.

Streams give you a durable log plus at-least-once group semantics. The core loop:

```
XADD orders '*' user 42 total 19.99          # append; '*' auto-generates the ms-seq ID
XGROUP CREATE orders fulfil '$' MKSTREAM      # group starting at new messages; create stream if absent
XREADGROUP GROUP fulfil worker-1 COUNT 10 BLOCK 5000 STREAMS orders '>'   # '>' = never-delivered entries
XACK orders fulfil 1719-0                     # confirm processed; removes from this consumer's PEL
```

The `'>'` ID is special: it means "give me entries never delivered to this group." Passing an explicit ID instead (e.g. `0`) re-reads *this consumer's own pending* entries — how a restarted worker resumes its in-flight batch. Every delivered-but-unacked entry sits in the consumer's PEL until `XACK`. If a consumer dies with entries in its PEL, a peer recovers them:

```
XAUTOCLAIM orders fulfil worker-2 60000 0     # claim entries idle > 60s, reassign to worker-2
XPENDING orders fulfil                        # summary: count, min/max ID, per-consumer breakdown
```

Cap the log or it grows unbounded — Redis is memory-resident:

```
XADD orders MAXLEN '~' 1000000 '*' user 42    # keep ~1M entries, node-aligned trim (cheap)
```

### Q3. Redis Streams vs plain Pub/Sub — when each?

| Dimension | Pub/Sub | Streams |
|---|---|---|
| Persistence | none | append-only log (AOF/RDB + replication) |
| Delivery | at-most-once | at-least-once (via PEL + XACK) |
| Offline reader | loses messages | replays from stored ID |
| Consumer groups | no (fanout only) | yes (`XREADGROUP`) |
| Redelivery | no | `XCLAIM`/`XAUTOCLAIM` |
| Backpressure | drops slow clients | reader-paced pull |
| Ordering | per-channel best-effort | strict per-stream by ID |
| Use case | live signals, cache-bust | queues, event log, jobs |

Rule of thumb: if losing a message is unacceptable, or you need to load-balance work across workers, or a consumer must catch up after downtime — Streams. If it's a transient live signal and simplicity wins — Pub/Sub.

### Q4. What is the Pending Entries List and how does redelivery actually work?

When a consumer reads via `XREADGROUP` with `'>'`, each entry is (a) delivered to that consumer and (b) recorded in the group's PEL against that consumer's name, with a delivery timestamp and delivery count. It stays there until `XACK`. This is the entire basis of at-least-once: the entry is *owned* but unconfirmed.

If `worker-1` crashes mid-processing, its entries are still in the PEL, still owned by a dead consumer, and no `'>'` read will ever re-serve them (they're not "never-delivered"). Recovery is explicit: another consumer runs `XPENDING orders fulfil - + 100 worker-1` to list them, then `XCLAIM orders fulfil worker-2 60000 <id>...` (or `XAUTOCLAIM`) to transfer ownership of entries idle beyond a threshold. The `min-idle-time` guard prevents two live consumers from stealing each other's freshly-read work. Delivery count (visible in `XPENDING`) lets you route poison messages to a dead-letter stream after N attempts — Redis won't do that automatically, you implement it.

### Q5. Streams give at-least-once. How do you get effective exactly-once?

You don't get true exactly-once from Redis — you get at-least-once plus **idempotent consumers**. A redelivered entry (crash between processing and `XACK`, or an `XCLAIM` after a slow-but-alive consumer) must be safe to reprocess. Standard approaches:

- **Idempotency key**: derive a deterministic key from the entry (its stream ID works) and `SET dedup:<id> 1 NX EX 86400`; skip if the `SET` returns nil. This dedups on the write path.
- **Idempotent side effects**: make the downstream operation naturally repeatable — upsert by primary key, `INCR` guarded by the dedup key, conditional writes.
- **Ack ordering**: process, commit the side effect, *then* `XACK`. Ack-before-process turns at-least-once into at-most-once (you'll drop on crash).

This is the same discipline as Kafka consumers — see the Delivery Semantics topic. Redis adds no transactional outbox of its own; if you need the write and the ack atomic, you build it (e.g. a Lua script or `MULTI`/`EXEC` around the dedup-set and the state change).

### Q6. What is sharded Pub/Sub (`SPUBLISH`) and why does it exist?

In Redis Cluster, classic `PUBLISH` is **cluster-wide**: a message published on any node is propagated to *every* node so that a subscriber connected anywhere receives it. That broadcast scales badly — every publish touches every node's bus, so pub/sub throughput doesn't improve as you add shards; it gets worse.

Sharded Pub/Sub (Redis 7.0) fixes this. `SPUBLISH`/`SSUBSCRIBE` hash the channel name to a slot exactly like keys do, so a sharded channel lives on **one shard only**. Publishers and subscribers for that channel must connect to the node owning its slot; messages never cross shards. You trade the "subscribe anywhere" convenience for linear scaling of pub/sub across the cluster. Use it when pub/sub volume is high enough that cross-node propagation is the bottleneck — and route clients with the same slot-aware logic you use for keyed commands.

### Q7. What are keyspace notifications, and what's the catch?

Keyspace notifications let clients subscribe to *data mutations* as Pub/Sub events. Enable them (off by default, they cost CPU):

```
CONFIG SET notify-keyspace-events KEA     # K=keyspace, E=keyevent, A=all command classes
```

Then subscribe to either view of the same event:

```
SUBSCRIBE __keyspace@0__:session:42       # events about ONE key: which command fired
SUBSCRIBE __keyevent@0__:expired          # events of ONE type: which keys expired
```

Common use: react to key **expiry** (`expired` events) for TTL-driven workflows — session cleanup, delayed tasks. The catch is fundamental: **notifications ride classic Pub/Sub, so they're at-most-once and lossy.** If no one is subscribed when a key expires, that event is gone. Worse, expiry events fire when Redis *actually* evicts the key (lazy expiry on access, or the background cycle), which can lag the logical TTL. So keyspace notifications are a *hint to trigger work*, never a reliable event source — reconcile against real state. For a durable "key expired" signal, write to a Stream yourself instead.

### Q8. When is Redis Streams *enough*, and when do you need Kafka or RabbitMQ?

Reach for **Redis Streams** when: you already run Redis; throughput is moderate (tens to low-hundreds of thousands msg/s on one primary); retention is short and bounded (minutes to hours, memory-capped via `MAXLEN`); you want sub-millisecond latency and simple ops; and you need groups + replay without standing up a broker cluster. It's excellent for job queues, per-service event buffers, and glue between services.

Reach for **Kafka** when: you need high sustained throughput and long/large retention (days-to-forever, disk-backed at TB scale); partition-level parallelism beyond one node; strong durability (`acks=all`, replication factor 3, ISR) that survives broker loss; log compaction; or the ecosystem (Connect, Streams, Schema Registry, ksqlDB). Redis's single-primary write path and RAM-bound retention are the hard ceilings Kafka removes — see the Kafka Architecture topic.

Reach for **RabbitMQ** when you need rich routing (topic/header exchanges), per-message TTL, dead-letter exchanges, priorities, and competing-consumer work queues with broker-side complexity handled for you — see the RabbitMQ topics.

The honest summary: Streams is a *lightweight* broker. It wins on latency and operational simplicity when you already have Redis; it loses on durability guarantees, horizontal throughput, and ecosystem the moment the workload gets serious.

### Q9. Debugging: messages are being processed twice. Where do you look?

Duplicate processing in a Streams consumer group is almost always one of:

- **Ack-after-slow-processing racing XCLAIM.** A consumer takes longer than another worker's `min-idle-time`, the entry gets `XCLAIM`'d and reprocessed while the original still finishes. Fix: raise `min-idle-time` above your worst-case processing time, or shorten processing.
- **Crash between side effect and `XACK`.** Inevitable in at-least-once; the entry stays in the PEL and gets redelivered. Fix: idempotent consumer (Q5), not "try to ack faster."
- **Reading `'>'` after a restart when you meant to resume.** If you re-`XREADGROUP` with `'>'` you get new entries, but your old PEL entries are still pending and will be claimed/redelivered elsewhere — looks like dupes across workers. Confirm with `XPENDING orders fulfil` (delivery count > 1 is the tell).
- **Multiple groups.** Two consumer groups on the same stream each get their own copy by design — check you didn't create `fulfil` twice or add a stray group.

Start with `XPENDING orders fulfil` and `XINFO GROUPS orders`; the delivery counts and per-consumer PEL sizes tell the story.

### Q10. How do you cap a stream's memory, and what does approximate trimming mean?

Streams live in RAM, so unbounded `XADD` will OOM Redis. Trim on write or periodically:

```
XADD events MAXLEN '~' 100000 '*' k v         # approximate: keep ~100k, aligned to radix-tree macro-nodes
XADD events MAXLEN 100000 '*' k v             # exact: precise count, more CPU to trim
XTRIM events MINID 1719000000000-0            # drop everything older than a timestamp-derived ID
```

`MAXLEN ~ N` is the idiomatic choice: Redis stores entries in radix-tree nodes holding many entries each, and exact trimming may have to split a node, while approximate trimming only drops whole nodes — far cheaper, and it never keeps *fewer* than N, only slightly more. Use `MINID` for time-based retention (compute the ID from `now - window`). Note trimming deletes entries **even if they're unacked in some group's PEL** — the PEL then references gone entries, which `XACK`/`XCLAIM` handle gracefully but which means aggressive trimming can silently discard un-processed work. Size retention above your slowest consumer's lag.

### Q11. The interview one-liner: Redis Pub/Sub & Streams in one crisp paragraph.

Redis gives you two opposite messaging tools: **Pub/Sub** is fire-and-forget broadcast — at-most-once, zero persistence, no consumer groups, and it drops offline or slow subscribers, which makes it perfect for live signals like cache invalidation and presence but a footgun as a queue; **Streams** is an append-only, ID-ordered durable log with consumer groups, a Pending Entries List for at-least-once redelivery via `XCLAIM`/`XAUTOCLAIM`, replay from any position, and `MAXLEN` trimming — a genuine lightweight broker. Add `SPUBLISH` for shard-local pub/sub that scales in Redis Cluster, and keyspace notifications for lossy (Pub/Sub-based, so hint-only) reactions to data changes. Streams is enough when you already run Redis and want groups, replay, and sub-ms latency at moderate, memory-bounded volume; you graduate to Kafka for high throughput with long disk-backed retention and strong replicated durability, or to RabbitMQ for rich routing and dead-lettering.


## Other Brokers & Protocols

### Summary

**What this topic covers**

Kafka and RabbitMQ dominate interviews, but a senior engineer is expected to place the rest of the landscape: NATS (and JetStream), Apache Pulsar, ActiveMQ/Artemis with JMS, MQTT for IoT/mobile, the wire protocols underneath (AMQP, MQTT, STOMP, Kafka's binary protocol), and the cloud-managed offerings (AWS SQS/SNS/Kinesis, GCP Pub/Sub, Azure Service Bus/Event Hubs). The goal is not to master each product but to know what problem each one is *for*, where it sits on the queue-vs-log spectrum, and which one you'd reach for. Managed cloud services are covered as concepts and selection criteria — see the aws and gcp primers for per-service API detail.

**Mental model**

Everything here is a variation on two primitives you already know: the **queue** (a message is consumed once, then gone — competing consumers, load-share, RabbitMQ/SQS/JMS) and the **log** (an append-only, replayable, offset-addressed stream — Kafka/Kinesis/Event Hubs/Pulsar). The wire protocol is orthogonal to the model: AMQP and STOMP are open messaging protocols brokers *speak*, MQTT is a tiny pub/sub protocol for constrained devices, and Kafka has its own bespoke binary TCP protocol. Cloud services just take one of these two models and remove the ops burden: SQS is a hosted queue, SNS is hosted fan-out, Kinesis/Event Hubs are hosted logs. Once you classify any broker as "queue or log?" and "self-hosted or managed?", the tradeoffs — ordering, replay, throughput, delivery guarantee — fall out almost mechanically.

**Key terms**

- **NATS** — ultra-lightweight, cloud-native messaging; core NATS is fire-and-forget (at-most-once) pub/sub.
- **JetStream** — NATS' persistence layer adding streams, at-least-once, consumers, and replay.
- **Pulsar** — log-based broker with compute/storage separation via Apache BookKeeper.
- **BookKeeper** — Pulsar's distributed storage layer; brokers are stateless, "bookies" store data.
- **JMS** — Java Message Service, the Java API standard for queues and topics (ActiveMQ/Artemis).
- **MQTT** — lightweight pub/sub protocol for IoT/mobile over TCP, with QoS levels 0/1/2.
- **QoS** — MQTT delivery guarantee: 0 at-most-once, 1 at-least-once, 2 exactly-once.
- **Retained message** — MQTT: the last message on a topic, delivered instantly to new subscribers.
- **Last Will (LWT)** — MQTT message the broker publishes if a client disconnects ungracefully.
- **AMQP / STOMP** — open wire protocols (binary / text) for interoperable messaging.
- **SQS / SNS / Kinesis** — AWS hosted queue / pub-sub fan-out / hosted log.
- **Service Bus / Event Hubs** — Azure hosted queue+topic / Kafka-compatible hosted log.

**Why interviewers ask this**

Junior candidates know "Kafka" and stop. Senior signal is breadth with judgement: knowing that NATS is the right call for low-latency internal microservice RPC/eventing where you don't need Kafka's retention, that MQTT — not Kafka — is what a fleet of a million battery-powered sensors speaks, that Pulsar's storage/compute split is what lets it scale brokers independently, and that reaching for a managed service (SQS/Pub/Sub) is usually correct until you have a concrete reason not to. It also tests whether you understand protocols vs products — a common muddle, since MQTT and AMQP are protocols while Mosquitto and RabbitMQ are the brokers that speak them. The best answers pick the *simplest* tool that meets the requirement, place it on the queue-vs-log axis, and can say plainly why the flashier option is overkill.

**Common confusions**

- "MQTT is a broker" → MQTT is a *protocol*; Mosquitto, HiveMQ, EMQX are the brokers that speak it.
- "Pulsar is just Kafka" → both are logs, but Pulsar separates broker (serving) from BookKeeper (storage), so you scale them independently and get built-in tiered storage and geo-replication.
- "SNS is a queue" → SNS is pub/sub *fan-out*; you pair SNS→SQS so each consumer gets its own durable queue.
- "Kinesis == Kafka" → same log model, but Kinesis is shard-based with a hard 24h–365d retention and AWS-managed scaling, not a drop-in Kafka.
- "Core NATS is durable" → it isn't; you need JetStream for persistence and replay.

**What follows from this topic**

This closes the loop opened by the Landscape and Kafka/RabbitMQ topics: you now have the whole menu. Pair it with the Delivery Semantics topic (every product here maps to at-most / at-least / exactly-once) and the Messaging Patterns topic (fan-out, work queues, request/reply). For the cloud services, the aws and gcp primers carry the service-level API and quota detail this topic deliberately skips.

### Q1. What is NATS, and how do core NATS and JetStream differ?

NATS is a very lightweight, high-throughput messaging system written in Go, designed for cloud-native microservice communication — a single small binary, millions of messages/sec, sub-millisecond latency. **Core NATS** is pure pub/sub with subject-based addressing (`orders.eu.new`, wildcards `orders.*.new` / `orders.>`) and is **at-most-once**: if no subscriber is connected, the message is dropped — there is no persistence. It also supports request/reply natively and "queue groups" for competing-consumer load balancing.

**JetStream** is the persistence layer built into modern NATS servers. It adds durable **streams** (append-only, retention-bound), **consumers** with acks, replay from a sequence/time, and at-least-once (with dedup windows approaching exactly-once). Rule of thumb: reach for core NATS when you want blazing-fast, ephemeral internal signalling/RPC and can tolerate loss; enable JetStream when you need durability, replay, or work-queue semantics. NATS is a great Kafka alternative when you want the streaming model without ZooKeeper/KRaft-scale operational weight.

### Q2. What is Apache Pulsar and how does it differ architecturally from Kafka?

Pulsar is a log-based streaming platform like Kafka, but with a key architectural difference: **separation of serving and storage**. Kafka brokers hold both roles — they serve clients *and* store partition data on their local disks, so scaling one scales the other and rebalancing shuffles data. Pulsar splits them: stateless **brokers** handle client connections and dispatch, while **Apache BookKeeper** "bookies" store the actual log segments. Because brokers are stateless, you can add/remove them instantly with no data movement, and storage scales independently.

That design gives Pulsar three things it markets heavily: native **multi-tenancy** (tenants/namespaces/topics with per-namespace isolation and quotas), built-in **tiered storage** (offload cold segments to S3/GCS transparently), and built-in **geo-replication** across clusters. Pulsar also **unifies queue and stream** semantics — the same topic can be consumed as an exclusive/failover stream (Kafka-style, ordered) or as a shared subscription (RabbitMQ-style competing consumers) just by picking a subscription type. Tradeoff: Pulsar has more moving parts (brokers + bookies + ZooKeeper/metadata) and a smaller ecosystem/community than Kafka, so Kafka is still the default unless you specifically need multi-tenancy, elastic broker scaling, or the unified queue+stream model.

### Q3. What are ActiveMQ/Artemis and JMS, and when do they still matter?

**JMS (Java Message Service)** is the standard Java API for messaging — a vendor-neutral interface with two models: **queues** (point-to-point, one consumer per message) and **topics** (publish/subscribe, durable or non-durable subscriptions). It's an API, not a wire protocol, so a JMS app can talk to any compliant broker. **ActiveMQ Classic** and its successor **ActiveMQ Artemis** (the modern, high-performance rewrite; also the engine behind Red Hat AMQ) are the canonical JMS brokers. Artemis speaks multiple protocols — AMQP, MQTT, STOMP, OpenWire, and Core — so it can bridge a JMS Java app to an MQTT sensor fleet.

Where it still matters: enterprise Java / Spring Boot / Jakarta EE shops with existing JMS investment, transactional messaging tied to XA/two-phase commit, and cases where the JMS abstraction (`@JmsListener`, message selectors, request/reply with `JMSReplyTo`) is already the team's idiom. It's rarely the choice for a greenfield high-throughput streaming system — that's Kafka/Pulsar territory — but for reliable enterprise integration and request/reply within a Java estate, it's solid and well-understood.

### Q4. What is MQTT and why is it the default for IoT and mobile?

MQTT is a deliberately tiny publish/subscribe protocol layered on TCP, built for constrained devices and flaky, low-bandwidth networks — millions of sensors, phones, cars. The design centres on a **broker** (Mosquitto, EMQX, HiveMQ, or AWS IoT Core) that all clients connect to; publishers send to a **topic** (`home/livingroom/temp`), subscribers subscribe with wildcards (`+` single level, `#` multi-level). Its header is only ~2 bytes, so it's radically cheaper on the wire than HTTP.

Three features make it fit IoT: **QoS levels** let each message pick a delivery guarantee (see next card); **retained messages** — the broker keeps the last message per topic and hands it to any new subscriber immediately, so a device that just woke up gets the current state without waiting for the next publish; and **Last Will and Testament (LWT)** — a message the client registers at connect time that the broker publishes automatically if the client drops without a clean disconnect, giving you cheap presence/offline detection. Kafka is the *wrong* tool at the edge (too heavy, connection-hungry); a common architecture is MQTT at the edge bridged into Kafka/Kinesis for backend processing.

### Q5. Explain MQTT's three QoS levels.

MQTT lets the publisher choose a per-message quality of service:

- **QoS 0 — at-most-once ("fire and forget")**: one send, no ack, no retry. Fastest and cheapest; message may be lost if the network drops. Fine for frequent telemetry where the next reading supersedes the last (e.g. a temperature every second).
- **QoS 1 — at-least-once**: the broker acks (`PUBACK`); if the publisher doesn't see the ack it re-sends, so the subscriber may get **duplicates**. Use when you must not lose the message and your consumer is idempotent.
- **QoS 2 — exactly-once**: a four-part handshake (`PUBLISH` → `PUBREC` → `PUBREL` → `PUBCOMP`) guarantees the message is delivered once and only once. Highest overhead and latency; reserve it for commands you cannot afford to duplicate (e.g. "unlock the door", billing events).

The effective QoS is the minimum of the publisher's and subscriber's requested levels. Most real fleets run QoS 0 for high-rate telemetry and QoS 1 for events that matter, treating QoS 2 as a rarely-needed special case because of its cost.

### Q6. AMQP vs MQTT vs STOMP vs Kafka's protocol — what's each for?

These are wire protocols, distinct from the products that speak them:

- **AMQP (Advanced Message Queuing Protocol)** — a rich, binary, open standard for interoperable enterprise messaging. AMQP 0-9-1 is what RabbitMQ built its exchange/binding/queue model on; AMQP 1.0 is a different, broker-agnostic standard (Azure Service Bus, Artemis, Qpid). Feature-rich: transactions, flow control, delivery guarantees, routing. Reach for it when you want reliable, structured queueing with interop.
- **MQTT** — minimal pub/sub for constrained devices (above). Optimised for tiny footprint and lossy links, not for rich routing or transactions.
- **STOMP (Simple Text-Oriented Messaging Protocol)** — a plain-text, HTTP-like protocol (`CONNECT`, `SEND`, `SUBSCRIBE` frames). Its whole appeal is simplicity and being trivially implementable in any language / from a browser (over WebSockets). Low performance, but great for scripting and web clients.
- **Kafka's protocol** — a custom, versioned **binary TCP protocol** specific to Kafka, built for high-throughput batched log I/O (produce/fetch with offsets, consumer group coordination). Not a general messaging protocol — it exists to make Kafka fast, and clients must speak it (or use a REST/HTTP proxy).

The interview point: MQTT/STOMP/AMQP are *open* protocols multiple brokers implement, while Kafka's is proprietary to Kafka. A broker like Artemis can speak several at once and translate between them.

### Q7. Compare AWS SQS, SNS, and Kinesis.

Three different primitives, frequently combined:

- **SQS (Simple Queue Service)** — a hosted, fully-managed **queue**. A message is delivered to one consumer, then deleted after it's acked (visibility timeout + delete). Two flavours: **Standard** (near-unlimited throughput, at-least-once, best-effort ordering) and **FIFO** (strict ordering + exactly-once processing within a message group, lower throughput). Use it for decoupling and durable work queues.
- **SNS (Simple Notification Service)** — hosted **pub/sub fan-out**. Publishers send to a topic; SNS pushes to many subscribers (SQS queues, Lambda, HTTP, email/SMS). No storage/replay — it's push, not pull.
- **Kinesis Data Streams** — a hosted **log** (Kafka-like): shard-based, ordered per shard, replayable within a 24h–365d retention window, multiple independent consumers read at their own offset. Use it for high-volume streaming/analytics.

The canonical pattern is **SNS → SQS fan-out**: publish once to SNS, have it deliver to several SQS queues so each downstream service gets its own durable, independently-consumed copy. Queue (SQS) vs fan-out (SNS) vs replayable log (Kinesis) is the decision axis. See the aws primer for quotas, ordering keys, and API detail.

### Q8. What are the GCP and Azure equivalents, and how do you choose?

**GCP Pub/Sub** is a fully-managed, globally-scalable **pub/sub** service that blends queue and log traits: publishers send to a **topic**, and each **subscription** is an independent, durable consumer view (at-least-once by default, with ordering keys and exactly-once available). One topic with multiple subscriptions gives you SNS-style fan-out *and* per-subscriber durable queues in a single service — no SNS+SQS wiring needed. Pub/Sub Lite is a cheaper, zonal, lower-SLA variant.

**Azure** splits it explicitly: **Service Bus** is the enterprise **queue + topic/subscription** broker (AMQP 1.0, sessions for ordering, dead-letter queues, transactions, duplicate detection) — the Azure answer to SQS/SNS and JMS-style messaging; **Event Hubs** is the **log** — a Kafka-compatible, partitioned, high-throughput ingestion stream with replay (it even exposes a Kafka endpoint so Kafka clients connect unchanged).

Choosing: default to the managed service on whatever cloud you're on unless you need portability or a feature it lacks. Pick a **queue** service (SQS / Service Bus) for decoupled work distribution, a **pub/sub** service (SNS / Pub/Sub) for fan-out, and a **log** service (Kinesis / Event Hubs / Pub/Sub) when you need replay, multiple independent readers, and stream processing. Managed almost always beats self-hosting Kafka until scale, cost, or control forces the switch — and even then, Event Hubs' Kafka API or Confluent Cloud often splits the difference.

### Q9. Quick decision guide — which broker for which job?

A compressed cheat sheet:

| Need | Reach for |
|---|---|
| Blazing internal microservice pub/sub & RPC, loss-tolerant | Core NATS |
| Same but durable/replayable, lighter than Kafka | NATS JetStream |
| High-throughput replayable log, huge ecosystem | Kafka |
| Log with elastic brokers, multi-tenancy, geo-replication, tiered storage | Pulsar |
| Rich routing / work queues / enterprise Java (JMS) | RabbitMQ / ActiveMQ Artemis |
| Millions of constrained IoT/mobile devices at the edge | MQTT broker (EMQX/Mosquitto/HiveMQ) |
| Managed queue, zero ops (AWS/GCP/Azure) | SQS / (Pub/Sub) / Service Bus |
| Managed pub/sub fan-out | SNS / Pub/Sub / Service Bus topics |
| Managed replayable log | Kinesis / Event Hubs / Pub/Sub |

The meta-rule: start with the cloud-managed option, drop to self-hosted Kafka/Pulsar/RabbitMQ only when a concrete requirement (cost at scale, latency, feature, portability) forces it, and use MQTT/NATS when the workload's shape (edge devices, ultra-low-latency internal eventing) doesn't fit the Kafka/queue mould.

### Q10. A team says "we'll just use Kafka for everything." When is that the wrong call?

Kafka is a fantastic replayable log, but "everything" is a smell. Push back in these cases:

- **IoT/mobile edge**: a million intermittently-connected, battery-powered devices should speak MQTT to a purpose-built broker, not hold Kafka connections. Bridge MQTT→Kafka on the backend.
- **Simple decoupling / low volume**: if you just need a durable work queue between two services on AWS, SQS is a few clicks and zero ops — Kafka is a cluster to run, patch, and monitor.
- **Complex per-message routing / priority / TTL / dead-letter workflows**: RabbitMQ's exchanges/bindings and per-message features model this far more naturally than Kafka topics.
- **Low-latency internal RPC/eventing**: NATS gives sub-ms request/reply without Kafka's batching latency and operational heft.
- **Strict per-message ack + redelivery of individual messages**: Kafka's offset model makes selective redelivery awkward; a queue (SQS/RabbitMQ) handles it cleanly.

Kafka shines when you genuinely need high-throughput, ordered, **replayable** streams consumed by multiple independent consumer groups. If you don't need replay or multiple readers, you're paying Kafka's operational tax for nothing. The senior move is matching the tool to the workload's shape, not standardising on one hammer.

### Q11. The interview one-liner: the whole landscape in one paragraph.

Every broker is a spin on two primitives — the **queue** (consume-once, competing consumers: RabbitMQ, ActiveMQ/JMS, SQS, Service Bus) and the **replayable log** (offset-addressed, multi-reader: Kafka, Pulsar, Kinesis, Event Hubs, NATS JetStream) — dressed in a wire protocol (AMQP for rich interop, MQTT for constrained IoT devices with its QoS/retained/LWT tricks, STOMP for dead-simple text/browser clients, Kafka's own binary protocol for throughput); NATS gives you ultra-light internal pub/sub (core = at-most-once, JetStream = durable), Pulsar is a Kafka-shaped log that separates stateless brokers from BookKeeper storage to win multi-tenancy, geo-replication and elastic scaling, and the cloud services just host these same models so you skip the ops — so in an interview, classify any broker by "queue or log?" and "managed or self-hosted?", then default to the simplest managed option that meets the delivery, ordering, and replay requirements.


## Reliability Patterns

### Summary

**What this topic covers**

Brokers give you delivery mechanics — acks, retries, redelivery — but on their own they do not make an end-to-end workflow *correct*. This topic is the application-level layer that sits on top of any broker (Kafka, RabbitMQ, SQS, NATS, Pulsar) to turn "the message probably got delivered" into "the business effect happened exactly once, in order, and nothing silently vanished." The core patterns: the **transactional outbox** (and its mirror, the **inbox**) to fix the dual-write problem; **idempotent consumers** to make at-least-once redelivery harmless; **dead-letter queues** and **poison-message** handling to quarantine what can't be processed; **retry with backoff + jitter** and retry/delay topics for transient failures; and the **saga** pattern for multi-service transactions via compensations. These are the patterns a senior engineer reaches for before touching any broker config, and they're broker-agnostic — the same shapes recur whether you're on Kafka or Rabbit.

**Mental model**

Almost every messaging bug traces back to one root cause: you have **two things to update and no single transaction spanning both** — your database and the broker. If you write the DB row then publish, a crash in between loses the message. Publish first then write, and a crash loses the state. This is the **dual-write problem**, and it has no reliable "just try harder" fix. The outbox pattern collapses two writes into one: you write the *message* into an outbox table **in the same DB transaction** as the state change, so they commit or roll back atomically. A separate relay (poll or CDC) reads committed outbox rows and publishes to the broker — retrying freely, because at-least-once to the broker is now safe. The other half is the consumer: because delivery is at-least-once, every consumer must be **idempotent** — processing the same message twice yields the same result as once. Outbox (safe produce) + idempotent consumer (safe consume) is the backbone of exactly-once *effects* over at-least-once *transport*. Everything else — DLQs, retries, sagas — handles the failures that remain.

**Key terms**

- **Dual-write problem** — updating a DB and a broker without a shared transaction; a crash between the two leaves them inconsistent.
- **Transactional outbox** — a DB table written in the same transaction as the state change; a relay publishes its rows to the broker.
- **Relay / message relay** — the process that reads outbox rows and publishes them (polling publisher or CDC-based).
- **CDC (Change Data Capture)** — tailing the DB write-ahead log (e.g. Debezium reading Postgres WAL) to stream row changes, used to drive the outbox without polling.
- **Inbox pattern** — consumer-side table of processed message ids; the dedup store that makes a consumer idempotent.
- **Idempotency key** — a stable id (message id, business key) used to detect and skip duplicate processing.
- **Dead-letter queue (DLQ)** — a side queue/topic where messages land after exhausting retries, for alerting and manual/automated replay.
- **Poison message** — a message that always fails processing; left unhandled it blocks its partition/queue head.
- **Exponential backoff + jitter** — retry delays that grow (`base * 2^n`) with randomization to avoid synchronized retry storms (thundering herd).
- **Retry topic / delay queue** — a dedicated topic/queue that holds a message for a delay before re-delivering, so retries don't block live traffic.
- **Saga** — a long-running distributed transaction expressed as a sequence of local transactions, each with a compensating action to undo it.
- **Compensating transaction** — the semantic "undo" for a completed saga step (refund, not rollback).

**Why interviewers ask this**

This is the single most reliable senior/staff signal in a messaging interview. A junior answer is "the broker guarantees delivery, so I publish after I save." That answer *contains* the dual-write bug and doesn't know it. The senior answer names the dual-write problem unprompted, reaches for the outbox, and immediately pairs it with an idempotent consumer — because they know exactly-once *delivery* is largely a myth across systems, but exactly-once *effect* is achievable with dedup. Interviewers probe the follow-ups: what breaks if the relay double-publishes (nothing — consumer dedups)? Where does the dedup key come from? What do you do with a message that fails 50 times (DLQ + alert, don't retry forever)? How do you undo step 3 of a 5-step workflow when step 4 fails (compensation, not rollback)? Getting these right shows you've operated a real system through failures, not just read the Kafka docs.

**Common confusions**

- "Exactly-once delivery solves this" → No broker gives true exactly-once across a DB boundary. You get at-least-once transport + idempotent consumers = exactly-once *effect*. Kafka's transactions are exactly-once *within Kafka* (read-process-write between topics), not to your Postgres.
- "The outbox needs distributed 2PC" → No — its whole point is to *avoid* 2PC by using one local DB transaction plus an idempotent relay.
- "A DLQ is where messages go to die" → It's an operational queue: alert on depth, inspect, fix, and replay. A silently growing DLQ is data loss with extra steps.
- "Retries make me reliable" → Blind in-place retries on a poison message block the partition and amplify load. Retries need backoff, jitter, a cap, and a DLQ terminus.
- "A saga is a database transaction" → It has no isolation and no atomic rollback; you design explicit compensations and tolerate intermediate visible states.

**What follows from this topic**

These patterns build directly on the Delivery Semantics topic (at-least-once is *why* idempotency is mandatory) and the Ordering topic (per-key ordering plus idempotency is how you keep replays safe). The outbox relay is a natural CDC use case — see the Data Engineering primer for Debezium/streaming ETL. DLQ and retry mechanics are broker-specific in the details: the Kafka and RabbitMQ topics show the concrete config (`x-dead-letter-exchange`, retry topics), and the Observability topic covers the metrics — DLQ depth, redelivery rate, consumer lag — that tell you these patterns are actually working.

### Q1. What is the dual-write problem, and why can't you just retry your way out of it?

You have two systems to update in one logical operation: your database (state) and your broker (notify others). There's no transaction spanning both. Two orderings, both broken:

- **DB first, then publish**: `INSERT order; publish OrderCreated`. Crash after the insert commits but before the publish — the order exists but no one is told. Downstream (payment, email, inventory) never fires.
- **Publish first, then DB**: `publish OrderCreated; INSERT order`. Crash after publish but before commit — consumers act on an order that doesn't exist in your DB.

Retrying doesn't fix it because the crash can land in the gap *and lose the retry intent too* — after a process crash you don't reliably know whether you'd published. Wrapping both in application code (`try { publish } catch { rollback }`) doesn't help either: the broker ack can be lost on the network even when the broker did receive the message. The only robust fixes are (a) make the message part of the DB transaction — the **outbox** — or (b) full distributed 2PC across DB and broker, which is slow, operationally painful, and often not even supported. Everyone picks the outbox.

### Q2. Sketch the transactional outbox pattern end to end.

Write the message into an `outbox` table **in the same transaction** as the business state change. Because it's one local ACID transaction, the message and the state commit or roll back together — no gap.

```sql
CREATE TABLE outbox (
  id            UUID PRIMARY KEY,
  aggregate_id  UUID NOT NULL,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);
```

The write path:

```sql
BEGIN;
  INSERT INTO orders (id, customer_id, total, status)
    VALUES ('o-123', 'c-9', 4200, 'CREATED');
  INSERT INTO outbox (id, aggregate_id, event_type, payload)
    VALUES ('m-777', 'o-123', 'OrderCreated',
            '{"orderId":"o-123","total":4200}');
COMMIT;
```

A separate **relay** publishes committed rows and marks them done:

```sql
SELECT id, event_type, payload FROM outbox
  WHERE published_at IS NULL
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 100;
-- publish each to the broker, then:
UPDATE outbox SET published_at = now() WHERE id = $1;
```

`FOR UPDATE SKIP LOCKED` lets you run several relay workers without them stepping on each other. Key property: the relay is **at-least-once** — if it crashes after publishing but before the `UPDATE`, it republishes on restart. That's fine, because consumers are idempotent (Q4). Use the outbox row `id` as the message id so consumers can dedup. Two relay flavors: **polling publisher** (the query above — simple, adds DB load, small latency) or **CDC** (Debezium tails the WAL and emits outbox inserts to Kafka — no polling, lower latency, more moving parts). A background job prunes `published_at` rows older than, say, a few days.

### Q3. Polling relay vs CDC (log-tailing) relay — when do you pick which?

Both read committed outbox rows and publish them; they differ in *how* they notice new rows.

| | Polling publisher | CDC / log-tailing (Debezium) |
|---|---|---|
| Mechanism | `SELECT … WHERE published_at IS NULL` on an interval | Reads DB WAL/binlog, streams row inserts |
| Latency | Interval-bound (e.g. 100ms–1s) | Near-real-time |
| DB load | Extra query load, index churn | Minimal — reads the log the DB already writes |
| Ops complexity | Trivial — it's just SQL | Connector infra (Kafka Connect), schema/registry, WAL retention tuning |
| Ordering | You control via `ORDER BY` | Log order = commit order, naturally per-partition |
| Failure surface | Small | WAL slot fills if the connector lags — can wedge the DB |

Pick **polling** for a single service, modest throughput, no existing Kafka Connect — it's the boring, correct choice and you can ship it in an afternoon. Pick **CDC** when you already run Kafka Connect, need low latency at high volume, or want to avoid polling load on a hot DB. A real gotcha with CDC: an un-consumed Postgres replication slot pins WAL and can fill the disk — monitor slot lag as aggressively as consumer lag.

### Q4. How do you build an idempotent consumer? Show the check.

At-least-once means you *will* see duplicates (relay republish, broker redelivery, rebalance). Idempotent = processing a message twice has the same effect as once. Two broad strategies:

**1. Dedup table (inbox).** Record processed message ids; skip if seen. Do the dedup insert and the business write in one transaction so they're atomic:

```sql
BEGIN;
  INSERT INTO processed_messages (message_id, consumer, processed_at)
    VALUES ('m-777', 'billing', now())
    ON CONFLICT (message_id, consumer) DO NOTHING;
  -- rows affected == 0 -> duplicate, COMMIT and skip the side effect
  UPDATE accounts SET balance = balance - 4200 WHERE id = 'c-9';
COMMIT;
```

If the `INSERT` conflicts (already processed), you skip the `UPDATE` and ack. Because both are in one transaction, a crash mid-way rolls back cleanly and redelivery retries safely.

**2. Naturally idempotent operations.** Design the write so repeats are harmless: **upsert** by business key (`INSERT … ON CONFLICT DO UPDATE`), set-absolute-value instead of increment (`SET status='PAID'` not `balance = balance - x`), or condition the write (`UPDATE … WHERE status='PENDING'`). This avoids the dedup table entirely when the domain allows it. Prefer this when you can — it's cheaper than a growing dedup store.

The dedup key must be a **stable message id**, not something you regenerate per delivery. The producer (or outbox row id) sets it once. Bound the dedup store: a TTL/partition by time window works if redelivery can't outlast the window; otherwise keep it durable and prune conservatively.

### Q5. What's the inbox pattern, and how does it pair with the outbox?

The **inbox** is the consumer-side mirror of the outbox: a table where you atomically record "I have processed message X" together with the resulting state change. It's the durable backing for idempotency (Q4's `processed_messages`). The symmetry: the **outbox** guarantees a producer's state change and its outgoing message commit together; the **inbox** guarantees a consumer's dedup record and its state change commit together. Put them end to end and you get a reliable pipeline over plain at-least-once transport — producer can't lose the event, consumer can't double-apply it. This combo is how systems achieve **exactly-once effect** without any broker-level exactly-once magic. It also makes the whole chain replay-safe: you can re-publish the entire outbox (say, to rebuild a downstream store) and consumers absorb the duplicates via their inbox.

### Q6. Dead-letter queues: what they're for and how to configure one.

A DLQ is where a message goes after it has exhausted its retries — you stop retrying, move it aside so it doesn't block the queue, and **alert**. Without a terminus, a poison message either loops forever or wedges the partition.

RabbitMQ — declare a DLX and route the main queue's rejects to it, capping attempts:

```
rabbitmqadmin declare queue name=orders \
  arguments='{"x-dead-letter-exchange":"dlx","x-delivery-limit":5}'
rabbitmqadmin declare queue name=orders.dlq
rabbitmqadmin declare binding source=dlx destination=orders.dlq
```

With quorum queues, `x-delivery-limit` counts redeliveries and dead-letters past the cap. On `basic.reject`/`nack` with `requeue=false`, the message routes to the DLX.

SQS — attach a redrive policy; after `maxReceiveCount` receives, SQS moves the message to the DLQ automatically:

```json
{
  "RedrivePolicy": {
    "deadLetterTargetArn": "arn:aws:sqs:...:orders-dlq",
    "maxReceiveCount": 5
  }
}
```

Kafka has no built-in DLQ — you publish to a `orders.DLT` topic yourself (Spring Kafka's `DeadLetterPublishingRecoverer` does this) after retries fail. Operational rules regardless of broker: **alert on DLQ depth > 0** (or a rate), attach failure context (exception, attempt count, original topic/offset) as headers, and build a **replay** path — fix the bug, then re-inject DLQ messages into the main flow. A DLQ nobody watches is silent data loss.

### Q7. Retries done right — backoff, jitter, and retry topics. Why not just retry immediately in a loop?

Immediate in-place retries are how a transient blip becomes an outage. Three failures:

1. **Head-of-line blocking** — synchronously retrying message N in a Kafka partition stalls N+1, N+2… behind it. Consumer lag explodes.
2. **Thundering herd** — a downstream hiccup makes every consumer retry in lockstep, hammering it exactly when it's weakest.
3. **No terminus** — a genuinely bad (poison) message retries forever.

Fixes:

- **Exponential backoff**: delay = `base * 2^attempt`, capped (e.g. 1s, 2s, 4s, 8s, … max 5m).
- **Jitter**: randomize each delay (`random(0, backoff)` — "full jitter") so retries desynchronize. Backoff without jitter still herds.
- **Cap attempts**, then **DLQ**. Retries are for *transient* faults (timeout, 503); a 400/validation error should skip retries and go straight to the DLQ — retrying it is pure waste.
- **Retry topics / delay queues** to avoid blocking live traffic: on failure, publish to `orders.retry.5s`, `orders.retry.30s`, `orders.retry.5m` (each with a consumer that waits the delay), finally `orders.DLT`. RabbitMQ does the same with per-queue TTL + DLX chaining, or the delayed-message plugin. This moves the waiting *off* the main partition so throughput isn't held hostage by one slow message.

Distinguish retryable from non-retryable errors explicitly — it's the difference between a self-healing system and a DLQ full of garbage.

### Q8. A single "poison" message is stuck at the head of a Kafka partition and lag is climbing. Walk me through it.

Symptom: consumer lag rising on one partition, the consumer logging the same offset failing over and over, other partitions healthy. That's a poison message — a record that deterministically throws (bad schema, unparseable payload, a bug on that shape of data). In Kafka, because a partition is consumed in order and you commit offsets sequentially, you **cannot skip it by just moving on** without deciding to advance the offset — retrying in place blocks everything behind it forever.

Response:

1. **Confirm** it's poison (deterministic) vs a downstream outage (transient): is it *one* offset failing, or all of them? Check the exception — parse/validation error is poison; timeout is transient.
2. **Stop the bleeding**: route that record to a retry topic or DLT and **commit the offset past it** so the partition drains. Spring Kafka's `DefaultErrorHandler` + `DeadLetterPublishingRecoverer` automates exactly this — N retries then publish-to-DLT-and-advance.
3. **Preserve context**: DLT message carries the exception, stack, original topic-partition-offset as headers for diagnosis.
4. **Alert** and fix the root cause (deploy a parser fix / handle the null).
5. **Replay** the DLT messages once the fix is out.

The staff-level point: never let one bad record halt a partition. The system must be able to *quarantine and advance* autonomously; a human then triages the DLT out-of-band. Guarding this at design time (error handler + DLT wired from day one) is the difference between a 2am page and a dashboard blip.

### Q9. Explain the saga pattern. Orchestration vs choreography, and where do compensations come in?

A saga models a business transaction spanning multiple services where a single ACID transaction is impossible (each service owns its own DB). You break it into a sequence of **local transactions**; if a later step fails, you run **compensating transactions** to semantically undo the earlier ones. Order flow: reserve inventory → charge card → schedule shipment. If shipment fails, compensate: refund the card, release the inventory. Compensation is not a DB rollback — the earlier steps already committed — it's a domain-level *undo* (a refund is a new transaction, not a reversal).

Two coordination styles:

- **Choreography** — no central coordinator. Each service reacts to events and emits the next: `InventoryReserved` → payment service listens, charges, emits `PaymentCompleted` → shipping listens… Failure emits a compensating event (`PaymentFailed` → inventory releases). Decentralized, no single bottleneck, but the end-to-end flow is *implicit* — smeared across services, hard to see or debug, and prone to cyclic event dependencies. Good for 2–4 steps.
- **Orchestration** — a central **saga orchestrator** (often a state machine / durable workflow — Temporal, Step Functions, Camunda) explicitly issues commands and awaits replies, driving compensations on failure. The flow lives in one place: readable, testable, easy to reason about; cost is a central component to build and run. Better for complex, many-step, or evolving workflows.

Critical properties: compensations must be **idempotent** (they may be retried) and ideally **commutative/order-tolerant**; a saga has **no isolation** — intermediate states are visible (an order can briefly be "paid but not shipped"), so design the domain to tolerate that (pending states, `SAGA_FAILED` terminal status). Reach for a saga only when you genuinely can't keep the operation in one service/transaction — they're powerful but add real complexity.

### Q10. Ordering and idempotency together — why do you often need both, and where do they collide?

They solve different halves of "process this correctly." **Ordering** ensures related events apply in the right sequence (`AccountOpened` before `MoneyDeposited`); you get it via a partition/routing key so same-key messages share one partition and one consumer (see the Ordering topic). **Idempotency** ensures a redelivered message doesn't double-apply. You need both because at-least-once *and* ordered means: same key, in order, but possibly with duplicates and possibly reprocessed from an earlier offset after a rebalance.

Where they interact: after a consumer crash/rebalance, Kafka redelivers from the last committed offset — you may reprocess a *run* of already-applied messages in order. Idempotency must be **order-aware** so replays are safe. Two clean approaches:

- **Version/sequence check**: store the last applied sequence per aggregate; on each message `if msg.seq <= last_applied: skip`. This dedups *and* rejects out-of-order stragglers in one check.
- **Absolute-state writes**: `SET balance = 4200` (event carries the resulting state) rather than `balance -= x`, so re-applying in order is a no-op.

The collision to avoid: a pure "have I seen this message id" dedup table handles duplicates but *not* reordering, and per-key ordering handles reordering but *not* duplicates. Real systems combine partition-key ordering with a per-aggregate version guard — that pair is replay-safe, redelivery-safe, and the standard answer when an interviewer pushes on "what happens after a rebalance?"

### Q11. The interview one-liner: reliability patterns in one crisp paragraph.

Brokers deliver at-least-once, so correctness lives in your application: kill the dual-write problem with a **transactional outbox** (write the event into a DB table in the same transaction as the state change; a polling or CDC relay publishes it at-least-once), make every consumer **idempotent** via an inbox/dedup table or naturally idempotent upserts so redelivery is harmless — together that's exactly-once *effect* over at-least-once *transport* — then wrap failures with **retry (exponential backoff + jitter, retryable errors only)**, a **dead-letter queue** as the terminus for **poison messages** so one bad record never blocks a partition, and **sagas with compensating transactions** for multi-service workflows that can't share a single ACID transaction; ordering (partition key) plus a per-aggregate version guard makes the whole chain replay-safe.


## Schema, Serialization & Evolution

### Summary

**What this topic covers**
A message on a broker is just bytes. The producer and the consumer are usually different services, owned by different teams, deployed on different schedules — so the shape of those bytes is a *contract* between them. This topic covers how you encode messages (JSON, Avro, Protobuf), how a **schema registry** turns that contract into something enforceable, and how you evolve a schema over months without a coordinated deploy that stops the world. If you take one idea away: on a durable, replayable log like Kafka the schema outlives any single deploy — old data sits in the topic for `retention.ms` (often days or forever with compaction), so a consumer built today may read a message a producer wrote a year ago. Compatibility is not politeness; it is a correctness requirement.

**Mental model**
Think of a topic as a shared, append-only database column whose readers and writers you can never upgrade atomically. At any instant you have producers on schema v5 and consumers still on v3, plus year-old records on the wire. The registry is the referee: before a producer can publish a new schema it must pass a **compatibility check** against the versions already registered for that subject, and the check is what guarantees the mixed fleet keeps working. Each message carries a small **schema id** (Avro/Confluent wire format: a magic byte, then a 4-byte id, then the payload), so the consumer never guesses — it fetches the exact writer schema by id, then decodes it into its own reader schema. Evolution becomes a discipline: make changes **additive** (new optional fields with defaults), never rename or retype in place, and let the registry reject anything that would break a reader or writer still in flight.

**Key terms**
- **Serialization format** — how a message becomes bytes: JSON, Avro, Protobuf, etc.
- **Schema** — the typed contract (fields, types, defaults) for a message.
- **Schema registry** — a service (Confluent Schema Registry, Apicurio) storing versioned schemas and enforcing compatibility.
- **Subject** — the registry's unit of versioning; usually `<topic>-value` (and `<topic>-key`) under the default `TopicNameStrategy`.
- **Schema id** — the integer embedded in each message pointing at the exact writer schema.
- **Writer schema / reader schema** — the schema the data was written with vs the one the consumer expects; Avro resolves between them.
- **Backward compatible** — a *new consumer* can read data written by the *old* schema.
- **Forward compatible** — an *old consumer* can read data written by a *new* schema.
- **Full compatibility** — both backward and forward.
- **Default value** — the value a field takes when absent; the linchpin of safe evolution.
- **Transitive check** — compatibility validated against *all* prior versions, not just the latest.

**Why interviewers ask this**
It separates people who have run Kafka in anger from people who have read about it. A junior answer stops at "we use Avro, it's compact." A senior answer knows *why* the registry exists (independent deploys over a replayable log), can name the compatibility modes and say which field changes are safe under each, knows the schema id is embedded per-message so decoding is deterministic, and can reason about a rollout: which side (producer or consumer) do you deploy first for a given change, and what does the compatibility mode need to be set to for that to be safe? It's also a proxy for whether you think about operational blast radius — a bad schema change is a silent poison-pill that only shows up as consumer deserialization exceptions in production.

**Common confusions**
- "Backward = old, forward = new" — no. Compatibility is named from the *reader's* perspective: **backward** means the new schema can read old data (safe to upgrade *consumers first*); **forward** means the old schema can read new data (safe to upgrade *producers first*).
- "JSON needs no schema so it's safest" — schemaless just means the breakage moves from a registry rejection at deploy time to a `null` or a parse error at 3am.
- "The registry ships the schema in every message" — it ships a 4-byte *id*; the consumer caches the schema after one lookup.
- "Adding a field is always safe" — only if it has a default. A required field with no default breaks backward compatibility.
- "Renaming a field is fine, it's the same data" — to the registry a rename is a delete plus an add, breaking both directions unless you use aliases.

**What follows from this topic**
Schema is where the Delivery Semantics and Idempotency topics get teeth — an idempotent producer is worthless if a schema change silently drops the dedup key. It connects to the Dead Letter Queue topic (a deserialization failure is a classic poison message that must be routed aside, not retried forever) and to the Kafka internals topic (schema id lives in the record value, registry is a separate service, not part of the broker). For the analytics-pipeline side of Avro/Parquet in Spark ETL, see the Data Engineering primer.

### Q1. Why do message contracts even need a formal schema and registry — can't producers and consumers just agree?

They *do* agree — the question is how you keep them agreeing over two years of independent deploys. Producers and consumers are separate services with separate release cadences, so you can never upgrade both atomically. On a durable log like Kafka the problem is worse: a record written today is readable for `retention.ms` (days, or forever under log compaction), so a consumer must be able to decode data from a schema version that no longer runs anywhere. "Just agree in a wiki" fails because nothing *enforces* it — the first breaking change surfaces as a deserialization exception in a consumer at runtime, on data already committed to the log, which you cannot un-write. A registry makes the contract executable: it stores every version of the schema per subject and refuses to register a new one that would break readers or writers still in flight. That moves the failure from production runtime to the producer's deploy pipeline, where it's a fast, cheap rejection.

### Q2. Compare JSON, Avro, and Protobuf for broker messages.

- **JSON** — human-readable, self-describing, zero setup, every language parses it. But it's verbose (field names repeated in every message), has no enforced schema, and weak typing (`42` vs `"42"`, no int/long distinction). Fine for low-volume events, webhooks, and debugging; expensive at millions of msg/s and dangerous as a long-lived contract because nothing catches a breaking change.
- **Avro** — compact binary, schema is *mandatory* to encode/decode, and it's the native fit for the Confluent registry. Its killer feature is **schema resolution**: the consumer decodes with the writer schema *and* its own reader schema, so defaults and aliases let old and new coexist. Schema is data (JSON-defined), which suits dynamic/data-engineering pipelines. Downside: you must have the writer schema to read a byte at all.
- **Protobuf** — compact binary, schema in `.proto` IDL, first-class in gRPC, excellent cross-language codegen and ergonomics. Field numbers (tags) drive evolution — every field is optional in proto3 with type-based defaults, which makes additive change natural. Slightly less registry-integrated historically than Avro but fully supported now.

Rule of thumb: **JSON** for human-facing/low-volume, **Avro** when you're already in a registry-backed Kafka data platform, **Protobuf** when you share contracts with gRPC services or want strong codegen.

### Q3. What does a schema registry actually do, and what's the message wire format?

The registry is a standalone service (Confluent Schema Registry, Red Hat Apicurio) — *not* part of the broker. It stores schemas versioned per **subject** (default `<topic>-value`), assigns each a globally unique integer **id**, and runs a **compatibility check** on registration. The flow:

- Producer serializes a record, asks the registry "register this schema for subject `orders-value`", gets back id `142`, caches it.
- It writes the message as: `[magic byte 0x00][4-byte big-endian schema id = 142][Avro-encoded payload]`.
- Consumer reads the bytes, pulls id `142`, fetches schema 142 from the registry (cached after first lookup), and decodes using that writer schema resolved against its own reader schema.

So the schema travels as 5 bytes of overhead, not a full copy. The registry is on the *deploy/first-message* path, not the hot path — steady-state produce/consume hits the local cache. It exposes a REST API (`GET /subjects/orders-value/versions/latest`, `POST /compatibility/subjects/...`) you can drive in CI to pre-validate a schema before shipping the producer.

### Q4. Explain the compatibility modes and which one lets me deploy producers vs consumers first.

Named from the reader's perspective:

- **BACKWARD** (Confluent default) — a consumer using the *new* schema can read data written with the *old* schema. Safe changes: delete a field, add an **optional** field with a default. Rollout: **upgrade consumers first**, then producers.
- **FORWARD** — a consumer using the *old* schema can read data written with the *new* schema. Safe changes: add a field, delete an **optional** field. Rollout: **upgrade producers first**, then consumers.
- **FULL** — both hold simultaneously. Safe changes reduce to: add/remove **optional fields with defaults** only. Most conservative, and what I'd set for a widely-shared topic with many independent consumers I don't control.
- **NONE** — no checks; you're on your own. Only for greenfield or throwaway topics.

Each has a `*_TRANSITIVE` variant that checks against **all** prior versions, not just the latest — important because a chain of individually-compatible steps can still break a very old consumer. For anything long-lived I default to `FULL_TRANSITIVE`.

### Q5. Which specific field changes are safe, and which are breaking?

| Change | Backward (consumer-first) | Forward (producer-first) |
|---|---|---|
| Add field **with default** | safe | safe |
| Add field **without default** | breaks | safe |
| Remove **optional** field | safe | safe (if had default) |
| Remove **required** field | safe | breaks |
| Rename a field | breaks both (delete+add) — use **aliases** in Avro | breaks both |
| Change type (e.g. `int`→`string`) | breaks | breaks |
| Widen numeric (`int`→`long`) | safe (Avro promotion) | breaks |
| Add enum symbol | breaks (old readers) unless default set | — |

The through-line: **additive, defaulted changes are safe; renames and retypes are not.** A rename looks harmless but the registry sees a removed field and a new field, so the old name's data no longer maps. Avro's `"aliases": ["old_name"]` is the escape hatch — it tells schema resolution the two names are the same field.

### Q6. Show an Avro schema and a concrete evolution scenario.

Version 1, registered for subject `orders-value`:

```json
{
  "type": "record",
  "name": "Order",
  "namespace": "com.acme.orders",
  "fields": [
    {"name": "orderId", "type": "string"},
    {"name": "amountCents", "type": "long"},
    {"name": "currency", "type": "string"}
  ]
}
```

Version 2 — add a customer tier. Under **BACKWARD** compatibility, add it as optional with a default:

```json
{
  "type": "record",
  "name": "Order",
  "namespace": "com.acme.orders",
  "fields": [
    {"name": "orderId", "type": "string"},
    {"name": "amountCents", "type": "long"},
    {"name": "currency", "type": "string"},
    {"name": "customerTier", "type": ["null", "string"], "default": null}
  ]
}
```

New consumers reading old (v1) data see `customerTier = null` via the default — backward holds. If you also need old consumers to survive v2 data (FULL), the default is exactly what lets them skip the unknown-to-them field cleanly. Now the *breaking* version — renaming `amountCents` to `amountMinor`:

```json
{"name": "amountMinor", "type": "long", "aliases": ["amountCents"]}
```

Without the `aliases`, the registry rejects it under any non-NONE mode; with the alias, resolution maps old data's `amountCents` onto the new `amountMinor`.

### Q7. What's the recommended versioning and rollout strategy in practice?

- **Make every change additive.** New optional fields with defaults; deprecate rather than delete; never reuse or retype a field. Treat the schema like a public API — because it is one.
- **Pin a compatibility mode per subject and enforce it in CI.** For shared topics I use `FULL_TRANSITIVE`; for a topic with a single tightly-coupled consumer, `BACKWARD` is enough. Run the registry's `POST /compatibility` check in the producer's pipeline so a bad schema fails the build, not production.
- **Sequence deploys by mode.** BACKWARD → consumers first. FORWARD → producers first. FULL → either order.
- **Own your subjects.** Default `TopicNameStrategy` versions per topic; `RecordNameStrategy` lets multiple event types share a topic keyed by record name — useful for an event-sourcing topic, but think before you use it.
- **Retire old versions deliberately**, only once you're certain no data that old remains within `retention.ms` and no consumer needs it.

### Q8. Debugging scenario: consumers start throwing deserialization errors after a deploy. Walk me through it.

First, classify: is it *every* message or *some*? Every message on a topic usually means a schema-id mismatch — the consumer can't fetch the writer schema (registry unreachable, wrong registry URL, or the id genuinely unknown). Check registry connectivity and that the consumer's `schema.registry.url` matches the producer's. *Some* messages means a subset written under a schema your reader can't resolve — almost always a change that slipped in under `NONE` compatibility or via a producer pointed at a different subject.

Concretely: pull the failing message's bytes and read the id from bytes 1–4, then `GET /schemas/ids/<id>` to see the actual writer schema; diff it against what the consumer expects. Nine times out of ten it's a required field added without a default, a retype, or a rename without an alias — a change that should have been rejected but wasn't because someone set the subject to `NONE` or bumped a schema out-of-band. Fixes: set the mode back to at least `BACKWARD`, and route the poison messages to a dead-letter topic (see the Dead Letter Queue topic) so the consumer group isn't stuck retrying one un-decodable record forever. The lasting fix is a CI compatibility gate so this fails at build time.

### Q9. The interview one-liner: schema, serialization, and evolution in one paragraph.

On a broker a message is just bytes, so its schema is a contract between independently-deployed producers and consumers that must survive across a replayable log where old data outlives every deploy; you encode with a compact, schema-carrying format (Avro or Protobuf over verbose JSON), register each version in a schema registry that embeds a tiny schema id in every message and enforces a compatibility mode — backward (new consumer reads old data, deploy consumers first), forward (old consumer reads new data, deploy producers first), or full — and you keep the whole thing working by making every change strictly additive: new optional fields with defaults, never a rename or retype in place.


## Event-Driven Architecture

### Summary

**What this topic covers**

Event-driven architecture (EDA) is the style where services communicate by producing and consuming *events* — immutable records of things that already happened — rather than by calling each other synchronously. The broker is the backbone: it decouples producers from consumers in time (consumers can be down and catch up later), in space (producer doesn't know who listens), and in throughput (the log absorbs bursts). This topic covers the vocabulary (events vs commands vs documents), the three flavors of EDA (notification, state transfer, event sourcing), CQRS and projections, choreography vs orchestration, and the honest benefit/cost ledger — because "just add Kafka" is where a lot of over-engineered systems go to die.

**Mental model**

Think of the event log as the system's *shared source of truth about what happened*, and each service's local state as a *materialized opinion* derived from that log. In a synchronous RPC world, state lives in one place and everyone queries it; coupling is direct and temporal — if the callee is down, the caller fails. In EDA you invert this: a service emits a fact ("OrderPlaced") and moves on. Downstream services each keep whatever local view they need by folding the event stream into their own store. The broker guarantees the events are durable and ordered (within a partition), so a consumer that crashes just resumes from its committed offset and replays. The mental unlock: **an event is a fact stated in the past tense that the emitter cannot un-say, and consumers are free to interpret however they like.** A command ("PlaceOrder") is a request that can be rejected; an event ("OrderPlaced") says it already succeeded. Get that distinction right and most design arguments resolve themselves.

**Key terms**

- **Event** — an immutable record of something that happened, past tense (`PaymentCaptured`), broadcast to zero-or-more interested consumers. The emitter doesn't care who reacts.
- **Command** — a directed request for something to happen (`CapturePayment`), sent to one owner, can be rejected/validated. Often carried over a queue, not a pub/sub topic.
- **Document / message** — a data blob passed for its own sake (a batch file, an enrichment payload) with no "happened" or "do this" semantics.
- **Event notification** — a thin event ("thing X changed, id=42") that carries an ID and little else; consumers call back for detail.
- **Event-carried state transfer** — a fat event that carries the changed data inline, so consumers need no callback.
- **Event sourcing** — persisting the *event log itself* as the system of record; current state is a fold (left-reduce) over events.
- **CQRS** — Command Query Responsibility Segregation: separate the write model from one-or-more read models (projections) optimized for queries.
- **Projection / read model** — a query-optimized view built by consuming events; disposable and rebuildable by replay.
- **Choreography** — services react to each other's events with no central brain; workflow is emergent.
- **Orchestration** — a central coordinator (e.g. a saga orchestrator) explicitly drives the steps and compensations.
- **Eventual consistency** — read models lag the write by the propagation delay; there is no instant after which everyone agrees, only *eventually*.
- **Idempotent consumer** — safe to hand the same event twice; mandatory because brokers deliver at-least-once.

**Why interviewers ask this**

EDA separates people who've *deployed* async systems from people who've read a blog post. A junior will describe the happy path — "producer sends event, consumer receives it, loose coupling, great." A senior immediately reaches for the failure modes: at-least-once delivery means consumers must be idempotent; eventual consistency means the UI can read its own stale write; ordering only holds per partition so your key choice is a correctness decision, not a perf tweak; event schemas are a public contract you can't casually break. Interviewers also probe judgment: can you say *no* to EDA? The strong signal is someone who'll tell you a two-service CRUD app doesn't need Kafka, and that choreography past ~4 services becomes a distributed program with no stack trace.

**Common confusions**

- **"Events and commands are the same thing"** → No. A command can be rejected and has one owner; an event is a done deal broadcast to anyone. Naming a topic `create-order` (imperative) usually means you've modeled a command as an event.
- **"EDA gives you loose coupling for free"** → It trades *runtime* coupling for *schema* coupling. Every consumer now depends on your event's shape; you need a schema registry and compatibility rules or you've just moved the coupling somewhere harder to see.
- **"Event sourcing = using Kafka"** → Unrelated. Event sourcing is a persistence pattern (state = fold over events). You can event-source into Postgres; you can use Kafka without event sourcing.
- **"CQRS requires event sourcing"** → No. CQRS just means separate read/write models. It pairs *well* with events but plenty of CQRS systems write to a relational store and project synchronously.

**What follows from this topic**

EDA is the *why* that the rest of this primer supplies the *how* for. Loose coupling and replay only hold up if delivery and ordering are understood — see the Delivery Semantics and Ordering topics. Log-based brokers make event-carried state transfer and event sourcing practical because the log is retained and replayable — see the Kafka topics. Choreographed workflows lean on the saga pattern and idempotency — see the Messaging Patterns topic. For the analytics side of streaming events (Spark, stream ETL) cross-reference the Data Engineering primer, and the Functional Programming primer covers event sourcing from the "state as a fold over events" angle.

### Q1. Events vs commands vs documents — what's the distinction and why does it matter?

Three message intents, and conflating them is the most common EDA design smell:

- **Command** — "please do X" (`ReserveInventory`). Imperative, directed at exactly one owner, *can be rejected*. The sender expects it to be acted on and often cares about the outcome. Naturally a point-to-point queue.
- **Event** — "X happened" (`InventoryReserved`). Past tense, a statement of fact, broadcast to zero-or-more consumers the emitter doesn't know about. Cannot be rejected — it already happened. Naturally a pub/sub topic.
- **Document** — a plain data payload (`CustomerRecordSnapshot`) moved for its own sake, no "do this" or "happened" semantics — common in batch/ETL handoffs.

Why it matters: intent dictates topology and coupling. Commands centralize decision-making (one validator), events decentralize it (each consumer decides what to do). If you publish `OrderCreated` and secretly expect *exactly one* service to charge the card, you've smuggled a command into an event and coupled the emitter to that consumer's existence — the thing EDA was supposed to prevent. Rule of thumb: name events past-tense (`Shipped`, `Cancelled`), commands imperative (`Ship`, `Cancel`), and if you catch yourself writing `create-thing` on a broadcast topic, you probably meant a command.

### Q2. Walk me through the three flavors of EDA and their tradeoffs.

**1. Event notification** — the event is thin: "Customer 42 changed, type=address." Consumers that care call back to the source service (or its API) for the detail.
- *Pros*: tiny events; source stays the single source of truth for the full record; low schema surface.
- *Cons*: reintroduces runtime coupling (the callback) — the source must be up when the consumer processes; a fan-out of consumers becomes a fan-in of callbacks (a read stampede); harder to replay historically because the *current* record has moved on since the event fired.

**2. Event-carried state transfer** — the event is fat: it carries the changed data inline (`CustomerAddressChanged{ id, oldAddress, newAddress, effectiveAt }`). Consumers keep a local replica and never call back.
- *Pros*: eliminates the callback and its runtime coupling; each consumer reads its own store at its own SLA; the source can be down and consumers keep working.
- *Cons*: data duplication across services; events get large; schema evolution is now a hard contract (every consumer parses the payload); you must handle out-of-order/stale updates (that's why real events carry `effectiveAt`/version).

**3. Event sourcing** — you don't store current state at all; you store the *ordered log of events* as the system of record, and derive current state by folding over it. `balance = events.reduce(apply, 0)`.
- *Pros*: perfect audit trail (the log *is* the truth); time-travel/replay to any past state; you can build brand-new projections retroactively from history; natural fit for CQRS.
- *Cons*: real operational tax — you need snapshots so you don't replay millions of events on every load; schema/versioning of *historical* events is forever (you can never delete a shape you once wrote); querying "current state" requires a projection, not a `SELECT`; and GDPR "delete my data" fights an append-only log (you end up with crypto-shredding or tombstones).

Most systems want #2 for inter-service decoupling and reach for #3 only in domains where the audit log is genuinely the product (ledgers, trading, compliance).

### Q3. What is CQRS and how does it relate to events?

CQRS — Command Query Responsibility Segregation — splits the model you *write* through from the model(s) you *read* through. The write side accepts commands, enforces invariants, and emits events. The read side consumes those events and maintains one or more **projections**: denormalized, query-shaped views (a search index, a dashboard rollup, a per-customer summary table), each optimized for its access pattern.

Events are the glue: the write model emits, projections fold. The payoff is that reads and writes scale and evolve independently — you can add a new read model (say, a graph view for a fraud team) by spinning up a fresh consumer from the log's start, with zero change to the write path. It also lets you pick different stores per side: normalized Postgres for writes, Elasticsearch or a wide denormalized table for reads.

The cost is **eventual consistency between write and read**: a user POSTs an order, then GETs their order list and it's not there yet because the projection hasn't caught up. You handle this with read-your-writes tricks (serve the just-written value from the write side, or have the client hold the new item optimistically) — not by pretending the lag is zero. CQRS does *not* require event sourcing; you can emit events from a plain CRUD write. But event sourcing + CQRS is a natural pairing because the event log you already keep is exactly what projections need.

### Q4. Choreography vs orchestration — when do you pick each?

Two ways to run a multi-service workflow (say: order → payment → inventory → shipping).

**Choreography** — no central brain. Each service listens for events and emits its own: `OrderPlaced` → payment service reacts, emits `PaymentCaptured` → inventory reacts, emits `StockReserved` → shipping reacts. The workflow is *emergent* from local reactions.
- *Pros*: maximally decoupled; no single point of failure or bottleneck; easy to add a new reactor (analytics just subscribes) without touching anyone.
- *Cons*: the end-to-end flow exists in nobody's code — it's an emergent property you can only reconstruct by tracing. Past ~4-5 steps it becomes a distributed program with no stack trace; "why did order 42 never ship?" means correlating logs across five services. Cyclic event dependencies and unclear ownership of the *overall* outcome are real risks.

**Orchestration** — a central coordinator (a **saga orchestrator**) explicitly drives the steps: it sends a `CapturePayment` command, waits for `PaymentCaptured`, sends `ReserveStock`, and on failure issues **compensating actions** (`RefundPayment`) to unwind. The workflow lives in one readable state machine.
- *Pros*: the business process is explicit, testable, observable; failure handling and compensation are centralized; easy to answer "where is order 42."
- *Cons*: the orchestrator is a coupling point and can become a god-service; it must be made durable/restartable (crash mid-saga must resume) — this is where durable-execution engines (Temporal, and saga frameworks) earn their keep.

Heuristic: choreography for simple, few-step, broadcast-y reactions; orchestration once the workflow has real branching, compensation, and someone needs to *own* the outcome. Both ride the same broker — the difference is where the control logic lives.

### Q5. What are the concrete benefits of going event-driven?

- **Loose coupling** — producers don't know consumers exist. You add a fraud-detection consumer to an existing `PaymentCaptured` topic with zero changes to the payment service. This is the headline win.
- **Independent scalability & elasticity** — the log buffers bursts; a slow consumer just builds lag and catches up instead of pushing back on the producer. You scale consumers (partitions/consumer-group members) independently of producers.
- **Temporal decoupling / resilience** — a consumer can be down for maintenance and resume from its committed offset with no lost work. The producer never blocks on the consumer being alive.
- **Auditability** — with a retained log, the sequence of events *is* an audit trail. For event-sourced systems it's the source of truth.
- **Replay** — reprocess history to backfill a new service, rebuild a corrupted projection, or test a new algorithm against real past traffic. This is the superpower log-based brokers unlock that queue brokers can't.
- **Extensibility** — new capabilities are new subscribers, not modifications to existing code (open/closed at the architecture level).

### Q6. And the costs? Be honest about what EDA makes worse.

- **Eventual consistency** — there's no instant when everyone agrees. Read-your-writes needs deliberate handling; "the data's not there yet" bugs are endemic. If your domain needs strong global consistency on every read, EDA fights you.
- **Debugging and tracing are harder** — a request's causal chain is scattered across services and time. Without correlation/trace IDs propagated through every event and distributed tracing, "why did this happen?" is archaeology. Budget for observability from day one.
- **Schema governance** — every event is a public contract. Without a schema registry and enforced compatibility rules (backward/forward-compatible evolution), one careless field rename breaks silent downstream consumers. This coupling is subtler and more dangerous than an RPC signature change because it fails asynchronously.
- **At-least-once → idempotency tax** — brokers redeliver on failure, so every consumer must dedupe/be idempotent. Exactly-once is narrow and expensive (see the Delivery Semantics topic).
- **Operational complexity** — you now run and tune a broker (partitions, retention, replication, consumer lag monitoring) that becomes tier-0 infrastructure. That's a real team cost.
- **Ordering constraints leak into design** — ordering only holds per partition, so your partition-key choice is a correctness decision (all events for one aggregate must share a key).

The senior move is naming these upfront and asking whether the domain actually needs the decoupling — a two-service CRUD app usually doesn't.

### Q7. Why do log-based brokers (Kafka) enable EDA better than traditional queues?

The distinction is **retention + replay + independent consumers**. A classic queue (RabbitMQ classic, SQS) is a *destructive read*: a message is delivered, ack'd, and gone. That's great for work distribution (a command hitting one worker) but poor for EDA, where the same event must reach many independent consumers and stay available for replay.

A log-based broker keeps events in an append-only, offset-indexed log retained by policy (`retention.ms=604800000` for 7 days, or `retention.ms=-1` / compaction for "keep forever"). Consumers track their *own* offset, so:

- **Many independent consumers** each read the full stream at their own pace — payments, fraud, analytics, and audit all consume `OrderPlaced` without competing (separate consumer groups).
- **Replay** — a new consumer, or a rebuilt projection, starts from offset 0 (`--from-beginning`) and re-derives its state from history. Impossible with a destructive queue; the messages are long gone.
- **Log compaction** — for state-transfer events keyed by entity, Kafka can retain the *latest* value per key forever, giving you a replayable "current state" changelog — the backbone of event-carried state transfer and Kafka Streams' KTables.
- **Ordering per partition** — the log gives a total order within a partition, which is exactly the guarantee event sourcing needs (events for one aggregate apply in order).

This is why "event-driven at scale" almost always means a log-based broker. Cross-reference the Data Engineering primer for the streaming-analytics/Spark side of the same Kafka log, and the Redis and Message Broker Landscape topics for where lighter tools (Redis Streams, NATS JetStream) fit for smaller-scale EDA.

### Q8. Design an order-processing system with EDA. Where do the boundaries and consistency lines fall?

Sketch: an `orders` topic keyed by `orderId`, partitioned so all events for one order land on one partition (per-order ordering). The order service owns writes and emits facts:

```
OrderPlaced { orderId, customerId, lines[], total, ts }
    -> Payment service (consumer group "payments") reacts
PaymentCaptured { orderId, amount, ts }   // fat event, state transfer
    -> Inventory service reserves stock, emits StockReserved
    -> Shipping service, on StockReserved + PaymentCaptured, emits Shipped
```

Design decisions an interviewer wants to hear:

- **Partition key = `orderId`** — guarantees a single order's events are ordered; different orders parallelize across partitions.
- **Event-carried state transfer** for `PaymentCaptured` (carry `amount`, `currency`, `effectiveAt`) so shipping/analytics never call back to payments.
- **Idempotent consumers** — payment must dedupe on `orderId` (an at-least-once redelivery must not double-charge); store a processed-event table or use the DB's unique constraint.
- **Saga for the cross-service invariant** — "don't ship unless paid AND reserved." Either choreograph (shipping waits for both events) or, if compensation gets hairy (refund on out-of-stock), use an orchestrator that issues `RefundPayment` / `ReleaseStock` compensations.
- **CQRS for the customer's "my orders" view** — a projection consuming the topic into a denormalized read table; accept that it lags the write by ms-to-seconds and handle read-your-writes in the UI.
- **The write must be atomic with the emit** — don't "save order then publish" (crash between = lost event). Use the **transactional outbox**: write the order and the outbound event in one DB transaction, a relay ships the outbox to Kafka. (See the Messaging Patterns / Reliability topics.)

### Q9. Debugging scenario: "an event was published but a downstream service never reacted." How do you diagnose it?

Work the path from broker outward, cheapest checks first:

1. **Did it actually get published?** Consume the topic directly from the tail: `kafka-console-consumer --topic orders --from-beginning --property print.key=true`. If the event isn't there, the bug is upstream — check the producer's ack (`acks=all`?), and whether a transactional/outbox write committed. A silent producer swallow is common.
2. **Is the consumer even subscribed / assigned?** `kafka-consumer-groups --describe --group shipping` shows assignment and, critically, **lag**. High and growing lag = consumer is up but too slow or stuck on a poison message. No members = the consumer isn't running or joined a different group.
3. **Wrong partition / key?** If ordering matters and the consumer "sees nothing," check whether the event went to a partition this member isn't assigned, or the key routed it away from where you expected.
4. **Poison message / stuck offset** — the consumer keeps failing on one event, never commits the offset, and appears frozen. Look for a repeating exception at a fixed offset; you likely lack a dead-letter path.
5. **Committed offset skipped it** — auto-commit fired before processing finished (processed=false but offset advanced), so the event was "consumed" and dropped. Check the commit strategy (commit *after* processing).
6. **Schema mismatch** — the consumer deserializes with an incompatible schema and drops/errs. Check the schema registry compatibility and the consumer's logs for deserialization errors.

The meta-point: without correlation IDs on events and consumer-lag dashboards, this whole exercise is guesswork — which is exactly why observability is non-negotiable in EDA.

### Q10. How do you evolve an event schema without breaking consumers?

Events are a public, append-only contract read by consumers you may not control, so treat schema like a public API. Use a **schema registry** (Confluent Schema Registry with Avro/Protobuf, or JSON Schema) enforcing a compatibility mode:

- **Backward compatible** (new consumer reads old events) — you may *add optional fields with defaults* and *remove fields*. Lets consumers upgrade before producers.
- **Forward compatible** (old consumer reads new events) — you may *add fields* (old readers ignore them). Lets producers upgrade before consumers.
- **Full** — both; the safe default for widely-consumed events.

Concrete rules: never rename or repurpose a field (that's a delete + add, and it breaks anyone parsing the old name); never change a field's type or tighten its meaning; add new fields as optional with sensible defaults; for a genuinely breaking change, publish a **new event type / topic version** (`OrderPlaced.v2`) and run both until consumers migrate, rather than mutating v1. In event-sourced systems this is stricter still — you can *never* stop being able to read a historical event shape, so you carry an event-version field and an upcaster that transforms old versions into the current one on read. The failure mode to fear is the silent one: a field rename that compiles fine and quietly drops data in an async consumer nobody's watching.

### Q11. The interview one-liner.

Event-driven architecture has services communicate through immutable past-tense *events* on a broker instead of synchronous calls, trading runtime coupling for schema coupling to gain loose coupling, independent scaling, temporal resilience, auditability, and replay; you choose how fat the event is (thin *notification* with a callback, fat *state-transfer* to kill the callback, or full *event sourcing* where the log is the source of truth), often split reads from writes with CQRS projections, and coordinate multi-service workflows by *choreography* (decentralized reactions) or *orchestration* (a durable saga coordinator) — paying for it all in eventual consistency, harder tracing, mandatory idempotency, and event-schema governance, which is why it's the right call for genuinely decoupled, high-fan-out, replay-hungry domains and the wrong call for a two-service CRUD app.


## Operations, Scaling, Security & Observability

### Summary

**What this topic covers**

Running a broker in production is a different skill from designing a topology. This topic is the operator's view: how to size a cluster (partition count, consumer count, throughput math), how to scale it horizontally without downtime, how to trade throughput against latency with real tuning knobs, what to put on a dashboard and alert on, how to lock it down (TLS, auth, ACLs, encryption at rest), and how to survive the loss of a broker, a rack, or a whole region. The through-line: a message broker is durable infrastructure with a persistence layer, so it fails and is operated more like a database than a stateless service. Treat consumer lag as your primary SLO, capacity-plan against the slowest consumer, and never let a "temporary" partition count become permanent — you can add partitions but you can almost never remove them cleanly.

**Mental model**

Picture the broker as a pipe with a reservoir. Producers pour in, the reservoir (log/queue) buffers, consumers drain. Three numbers govern everything. **Ingest rate** — how fast producers write. **Drain rate** — aggregate consumer throughput, which in Kafka equals `partitions × per-partition consume rate` (one partition maps to at most one consumer in a group, so partition count is your parallelism ceiling). **Reservoir depth** — retention (Kafka keeps messages `retention.ms` regardless of consumption; RabbitMQ holds until acked and can hit `x-max-length`). Health is simply: is drain ≥ ingest over any sustained window? If not, the reservoir fills — lag grows in Kafka, the queue grows and eventually blocks/drops in RabbitMQ. Scaling = widening the pipe (more partitions/consumers) or deepening the reservoir (more retention/disk). Every tuning decision is really "how much do I fill the reservoir to smooth bursts (throughput, latency up) versus drain eagerly (latency down, throughput down)." Ops is keeping drain ≥ ingest with headroom, and keeping the reservoir from silently overflowing.

**Key terms**

- **Consumer lag** — messages between the consumer's committed offset and the log's end (Kafka). The single most important health metric.
- **Under-replicated partitions (URP)** — partitions where the ISR is smaller than the replication factor; signals a broker or replication problem.
- **ISR (in-sync replicas)** — replicas caught up to the leader; `min.insync.replicas` gates `acks=all` writes.
- **Partition reassignment** — moving partition replicas across brokers to rebalance load when you add or drain a node.
- **Queue depth** — ready + unacked messages in a RabbitMQ queue; the RabbitMQ analogue of lag.
- **DLQ rate** — messages landing in a dead-letter queue/topic per unit time; a rising DLQ rate means a poison-message or downstream failure.
- **Prefetch (QoS)** — RabbitMQ `basic.qos` cap on unacked messages per consumer; the batching/latency knob on the consume side.
- **Linger / batch** — producer-side `linger.ms` + `batch.size` (Kafka): wait to fill batches for throughput at the cost of latency.
- **RPO / RTO** — recovery point (data you can lose) and recovery time (downtime you can tolerate); the two numbers that drive DR design.
- **MirrorMaker 2 / Cluster Linking** — Kafka cross-cluster replication for geo-DR and migration.
- **SASL / mTLS / ACL** — authentication mechanisms (SCRAM, OAuth, mutual TLS) and per-resource authorization rules.

**Why interviewers ask this**

Anyone can draw a topic and a consumer group on a whiteboard. The senior signal is knowing what happens at 3am when lag spikes. Juniors answer "just add more consumers"; seniors know consumers past the partition count sit idle, so you must first add partitions — and that reshuffles keyed ordering and can't be undone. Juniors say "it's encrypted"; seniors distinguish TLS in transit from at-rest and name the auth mechanism (SCRAM vs mTLS vs OAuth) and the authorization model (ACL per topic). Juniors treat DR as "we have backups"; seniors quote an RPO/RTO and pick active-passive vs active-active accordingly. The question is really "have you operated one of these, or only read about it?"

**Common confusions**

- "More consumers = more throughput" → only up to partition count; beyond that they idle. Widen partitions first.
- "More partitions is always safer" → over-partitioning adds per-partition memory, open file handles, longer leader-election and rebalance times, and end-to-end latency; tens of thousands per broker is a real ceiling.
- "Replication protects against data loss" → only with `acks=all` and `min.insync.replicas ≥ 2`; with `acks=1` a leader crash loses unreplicated writes.
- "TLS means we're secure" → TLS is transport only; without authentication + ACLs any client on the network can read every topic.
- "We'll just remove partitions later" → Kafka has no supported shrink; plan the count up front.

**What follows from this topic**

Capacity and scaling build directly on the delivery-guarantee choices from the Delivery Semantics topic (`acks`/ISR are both a durability and a throughput knob) and on the broker-internals topic (the log/segment model is why retention costs disk). The alerting side connects to the Observability primer for general metrics/tracing/SLO practice — this topic covers the broker-specific signals; xref Observability for the dashboarding and on-call framework around them.

### Q1. How do you size the number of partitions for a Kafka topic?

Start from throughput. If you need `T` MB/s of consume throughput and a single partition/consumer sustains `t` MB/s, you need at least `T/t` partitions — that sets the parallelism floor because a partition is consumed by at most one consumer in a group. Then apply constraints: partitions is also your max consumer parallelism (plan for peak, not average), and keyed ordering is per-partition so the count fixes your ordering granularity. A common rule of thumb: `max(desired_throughput/per_partition_throughput, peak_consumer_count)`, then add ~30% headroom for growth. Bias slightly high because you can add partitions but not remove them — but don't wildly over-provision: each partition costs a leader, replicas, open files, and memory on every broker, and huge counts slow rebalances and leader elections. For most topics tens to low hundreds of partitions is plenty; reserve thousands for genuinely high-volume streams. RabbitMQ has no partitions — you scale a queue with more competing consumers, and shard across queues manually if a single queue's single-threaded processing becomes the bottleneck.

### Q2. Walk through adding a broker to a running Kafka cluster.

Adding a broker does not automatically move data — new brokers only host new partitions until you rebalance. The steps: (1) provision and start the broker with a unique `broker.id`/node id joined to the same cluster (KRaft controller quorum or ZooKeeper on older clusters); (2) generate a reassignment plan that spreads existing partition replicas onto the new node; (3) apply it, throttled, so replication traffic doesn't starve live produce/consume.

```
kafka-reassign-partitions --bootstrap-server broker:9092 \
  --topics-to-move-json-file topics.json \
  --broker-list "1,2,3,4" --generate  > plan.json
kafka-reassign-partitions --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --execute \
  --throttle 50000000
kafka-reassign-partitions --bootstrap-server broker:9092 \
  --reassignment-json-file plan.json --verify
```

Always set a `--throttle` (bytes/s) — an unthrottled reassignment can saturate disk and network and cause a lag storm. Watch under-replicated partitions during the move; they should trend to zero as new replicas catch up and enter the ISR. RabbitMQ scales differently: vertically first (bigger node), then horizontally by clustering nodes and placing quorum queues with replicas across them, or by sharding a hot queue into multiple queues behind a consistent-hash exchange.

### Q3. What's the difference between tuning for throughput and tuning for latency?

They pull in opposite directions, and the knobs are explicit. **Producer, throughput:** raise `batch.size` and `linger.ms` (e.g. `linger.ms=20`) so the producer waits to fill larger batches, and enable `compression.type=lz4` (or zstd) — bigger, compressed batches amortize network and disk. **Producer, latency:** `linger.ms=0`, smaller batches, ship immediately. **Consumer, throughput:** larger `fetch.min.bytes` / `max.poll.records`, or in RabbitMQ a higher prefetch (`basic.qos` of, say, 100–500) so consumers pull a backlog and stay busy. **Consumer, latency:** `fetch.min.bytes=1` and prefetch of 1–10 so each message is delivered and processed promptly and work spreads evenly. Durability sits on top: `acks=all` with `min.insync.replicas=2` costs a round-trip to replicas versus `acks=1`. The honest framing in an interview: name the workload. A metrics firehose wants big batches, compression, high prefetch. A payment authorization wants `linger.ms=0`, low prefetch, and `acks=all` — you pay latency and throughput for correctness.

### Q4. Which metrics do you put on the dashboard and alert on?

Consumer-facing first, because that's what users feel:

- **Consumer lag** (per group, per partition) — the top-line SLO. Alert on absolute lag over a threshold *and* on lag that's trending up (drain < ingest). RabbitMQ equivalent: **queue depth** (ready + unacked).
- **DLQ / dead-letter rate** — any sustained flow into a DLQ is a poison message or a failing downstream; page on it.
- **Under-replicated partitions** and **offline partitions** — non-zero URP means a broker or disk is unhealthy; offline means data is unavailable. Alert immediately.
- **End-to-end latency** — produce-time to consume-time, ideally traced; distinguishes "broker slow" from "consumer slow."
- **Request latency & throughput** on the broker (produce/fetch p99).
- **Resource saturation** — disk usage and disk-free (a full disk takes a broker down and is a classic outage), page-cache/memory, network, and CPU. Retention × ingest rate must fit the disk with headroom.
- **Rebalance frequency** — frequent consumer-group rebalances mean flapping members and stall consumption.

Alert on symptoms users feel (lag, DLQ, latency) as pages; alert on leading indicators (disk %, URP) early enough to act. Xref the Observability primer for turning these into SLOs, burn-rate alerts, and dashboards.

### Q5. How do you secure a broker — transit, authentication, authorization, at rest?

Four independent layers; you need all of them:

- **Encryption in transit** — TLS on every listener (client↔broker and broker↔broker). Stops passive network sniffing. This alone is *not* access control.
- **Authentication** — prove who the client is. Kafka: SASL/SCRAM (username+password with salted hashing), mTLS (client certificates), or SASL/OAUTHBEARER (OAuth tokens, common with an IdP). RabbitMQ: username/password, mTLS, or OAuth2 plugin. Pick mTLS or OAuth for service-to-service; SCRAM is fine and simple for many shops.
- **Authorization** — what an authenticated principal may do. Kafka ACLs are per-resource: `Read`/`Write`/`Describe` on a topic, `Read` on a consumer group, etc. `kafka-acls --add --allow-principal User:orders-svc --operation Write --topic orders`. RabbitMQ uses per-vhost permissions (configure/write/read regex) and, in managed offerings, RBAC. Grant least privilege per service — no wildcard admin for app clients.
- **Encryption at rest** — the log/queue files on disk. Usually delivered by disk/volume encryption (LUKS, cloud KMS-backed EBS/PD) rather than the broker itself; managed services (MSK, CloudAMQP, Confluent Cloud) offer it as a checkbox with KMS keys.

The classic interview trap: "we have TLS" as the whole answer. TLS without auth+ACLs means anyone who can reach the port reads every topic.

### Q6. Design multi-region DR: active-passive vs active-active, and how do RPO/RTO drive it?

Start from the two numbers. **RPO** = how much data you can afford to lose; **RTO** = how long you can be down. Cross-region replication is asynchronous (physics — you won't do synchronous acks across an ocean without killing latency), so your RPO is bounded by replication lag.

**Active-passive:** producers/consumers run in region A; a tool (MirrorMaker 2 or Confluent Cluster Linking) mirrors topics + consumer-offset state to region B, which stands idle. On failover you cut clients to B. Simpler, no write conflicts; RPO = the async lag (seconds), RTO = however long failover + offset-translation takes. Good default.

**Active-active:** both regions take writes and mirror to each other. Lower RTO (users always have a local cluster) but you inherit conflict and loop problems — the same key written in both regions, and messages echoing back. You need topic naming/prefixing to prevent replication loops and an app design that tolerates concurrent writes (idempotency, last-writer-wins, or partition-by-region). Only pay this complexity when RTO must be near-zero. For RabbitMQ, cross-region is typically active-passive with federation/shovel plugins mirroring specific exchanges/queues. Whatever you pick, rehearse the failover — an untested DR plan has an unknown RTO.

### Q7. How do you do a zero-downtime rolling upgrade of a broker cluster?

Because the cluster is replicated, you upgrade one broker at a time and let replication cover the gap. The pattern: (1) confirm the cluster is fully healthy first — zero under-replicated partitions, all ISRs full; upgrading into an unhealthy cluster risks data loss. (2) Optionally move leadership off the target broker so it's serving no leaders, then stop it gracefully (a controlled shutdown migrates leaders and lets it leave the ISR cleanly). (3) Upgrade the binary/config, restart, and **wait for it to fully rejoin the ISR** (URP back to zero) before touching the next broker. Rushing to the next node while replicas are still catching up is how a rolling upgrade becomes an outage. For version jumps, mind protocol/log-format compatibility (`inter.broker.protocol.version` bumped only after all brokers are on the new version) and read the release notes. Producers with `acks=all` + `min.insync.replicas=2` and RF=3 keep writing throughout because a single broker down still leaves two in-sync replicas. RabbitMQ quorum queues (Raft) tolerate a single node restart the same way — one at a time, wait for the queue to report a full membership before the next.

### Q8. What's the actual cost of over-partitioning, and how do you recover from it?

Over-partitioning feels free and isn't. Each partition is a set of files (index + log segments) open on the leader and every replica, plus metadata the controller tracks. Costs that bite: more open file descriptors and memory per broker; longer controller failover and leader election (every partition needs a new leader elected); slower and more disruptive consumer-group rebalances; higher end-to-end latency because producer batching is spread thinner across more partitions; and more replication connections. At tens of thousands of partitions per broker you hit real limits — KRaft raised the ceiling versus ZooKeeper but it's not infinite. And the recovery is painful: Kafka has **no supported way to reduce** a topic's partition count (shrinking would break keyed ordering and offset semantics). To "fix" it you create a new topic with the right count and migrate producers/consumers — a full cutover. So the practical advice is to size deliberately with modest headroom, not to spray partitions "just in case." When in doubt, fewer partitions and revisit — growing is cheap, shrinking is a migration.

### Q9. Debugging scenario: consumer lag is climbing steadily. Walk your triage.

Lag climbing means drain < ingest — work through the pipe. First, **did ingest spike or did drain drop?** Compare produce rate now vs baseline. If producers surged (a batch job, a traffic event), you may just need more consumers/partitions. If ingest is flat, the consumers slowed. Then: **are all partitions lagging or a few?** A single hot partition points to a skewed key (poor partition-key distribution) — one consumer is overloaded while others idle; fix the key or repartition. Uniform lag across partitions points to the consumer side: check whether a **downstream dependency** (a DB, an API the handler calls) got slow — the consumer is blocked in `poll()` processing. Check for **frequent rebalances** (a member failing `max.poll.interval.ms` because processing a batch takes too long, getting kicked, triggering a rebalance, making everyone worse) — reduce `max.poll.records` or raise the interval. Check **consumer count vs partitions** — if consumers < partitions, add consumers (up to the partition count); if already equal, add partitions. And check the **DLQ/error rate** — if handlers are throwing and retrying, that's both the lag and a bug. The order — ingest, skew, downstream, rebalance, parallelism — resolves most cases fast.

### Q10. When is scaling the broker the wrong fix?

Reaching for "add brokers/partitions" is often treating a symptom. If lag comes from a **slow downstream** (the consumer waits on a database), more consumers just pile more load onto the same database — you scale the bottleneck, not the broker. If it comes from a **poison message** looping through retries, scaling multiplies the retries; you need a DLQ and a fix. If ordering constraints force everything onto one key/partition, more partitions can't help — the parallelism is capped by your own semantics, and the answer is rethinking the key. And if the real problem is a burst you could absorb, deepening retention (buffer) beats widening consumers you'll only need for ten minutes. The senior move is to find where drain is actually blocked before adding capacity — otherwise you spend money and add operational surface without moving the metric.

### Q11. The interview one-liner: operating a broker.

A message broker is durable, replicated infrastructure, so you run it like a database: size partitions from throughput (`partitions ≥ target/per-partition rate`, they cap consumer parallelism and can't be shrunk), scale out by adding brokers and throttled partition reassignment, tune the throughput-versus-latency dial with batching/linger/compression/prefetch and the durability dial with `acks`+ISR, watch consumer lag/queue-depth as your top SLO alongside under-replicated partitions, DLQ rate, end-to-end latency and disk, secure it in four independent layers (TLS in transit, SASL/mTLS/OAuth auth, per-topic ACLs, KMS encryption at rest), and design DR to an explicit RPO/RTO — async cross-region replication, active-passive by default and active-active only when near-zero RTO justifies the conflict complexity — upgrading one broker at a time and always waiting for replicas to rejoin the ISR before moving on.


## Scenario & Interview Playbooks

### Summary

**What this topic covers**
This is the closing synthesis topic: it stitches every earlier subject — fundamentals, delivery semantics, ordering, backpressure, reliability, Kafka/RabbitMQ/Redis internals, patterns, schema, and ops — into the reasoning you actually perform under interview pressure. The individual topics taught you the *knobs*; this one teaches you the *decision procedure*. A senior messaging interview is rarely "define at-least-once." It's "here's a payment system, design the pipeline," or "consumers are seeing duplicates in prod, walk me through it." Those questions have no single right answer — they reward a structured chain of reasoning that surfaces the requirement, names the tradeoff, picks a mechanism, and states what breaks. This topic gives you that chain and a set of worked scenario drills that recombine the earlier material the way real questions do.

**Mental model**
Every messaging design question is really a question about **where you put durability and where you put idempotency**, driven by two axes: *what does loss cost* and *what does a duplicate cost*. Everything else — broker choice, partition count, ack mode, DLQ, outbox — falls out of those two answers. So run every scenario through the same funnel: (1) **Requirements first** — throughput, ordering scope, latency budget, and the cost of loss vs the cost of duplication; do not name a broker yet. (2) **Delivery contract** — almost always at-least-once + idempotent consumer; say so and say why exactly-once *delivery* is a myth. (3) **Mechanism** — the specific knobs: `acks=all`, replication factor 3, manual ack, partition key, DLQ, outbox, consumer-group scaling. (4) **Failure walk** — narrate a broker crash, a consumer crash, a slow consumer, a poison message, and show the design survives each. Candidates who jump straight to "use Kafka" fail; candidates who derive Kafka (or RabbitMQ, or SQS) from the requirements pass. The broker is the *last* decision, not the first.

**Key terms**
- **Requirement funnel** — throughput → ordering scope → loss cost → duplicate cost → latency; the order you should ask questions in.
- **Loss-cost vs duplicate-cost** — the two numbers that pick your delivery contract and durability level.
- **Outbox pattern** — write the domain change and the outgoing message in one DB transaction, relay to the broker after commit; kills dual-write inconsistency.
- **Idempotent consumer** — dedups on a stable key (unique constraint, Redis `SETNX` with TTL) so redelivery is harmless.
- **DLQ (dead-letter queue)** — sideline for messages that fail past a retry budget, so at-least-once retries don't loop forever.
- **Consumer-group scaling** — add consumers up to the partition count to grow throughput and drain lag.
- **Partition/routing key** — the field that defines the ordering unit and the fan-out shape.
- **Backpressure lever** — prefetch/`max.poll.records`, pause/resume, and lag as the signal (see the backpressure topic).
- **Replay** — re-reading a log (Kafka/Streams) to rebuild state or reprocess after a bug; queues can't do this natively.
- **Migration seam** — dual-write or CDC bridge that lets you move brokers without a big-bang cutover.

**Why interviewers ask this**
Scenario questions are the highest-signal filter they have. Anyone can recite delivery semantics; only someone who has *operated* a broker can debug growing lag or design a payment pipeline that survives a crash mid-charge. The junior answer names a technology ("use Kafka, it's exactly-once"). The senior answer names a *tradeoff* and a *failure mode* ("at-least-once with an outbox and a dedup table on `payment_id`, because a lost ack after we've charged the card would otherwise double-charge"). Interviewers are probing whether you reason from requirements, whether you know the mechanisms concretely enough to configure them, and whether you instinctively narrate partial failure. The scenario is a vehicle; the reasoning chain is the thing being scored.

**Common confusions**
- "Pick the broker first." → Broker is the *last* decision; derive it from throughput, ordering, and loss/duplicate cost.
- "Exactly-once solves duplicates, so I don't need idempotency." → No — see the delivery topic; you always make the consumer idempotent.
- "Kafka is always the answer." → Fan-out to millions of end-user devices, per-message TTL/priority, or simple task queues often favour RabbitMQ, SQS/SNS, or Redis.
- "More partitions = more speed, free." → Partitions bound consumer parallelism but cost rebalance time, ordering scope, and end-to-end latency (see ordering topic).
- "A DLQ fixes poison messages." → A DLQ *contains* them; you still need alerting and a reprocessing plan, or the DLQ becomes a silent graveyard.

**What follows from this topic**
This topic is the join across the whole primer: broker selection leans on the landscape/comparison topic, exactly-once effects on the delivery-semantics and idempotency topics, lag debugging on the backpressure topic, out-of-order on the ordering/partitioning topic, and poison handling on the reliability topic. For the analytics-pipeline flavour of these scenarios (streaming ETL into a warehouse) cross-reference the Data Engineering primer; for Redis internals behind Redis Streams answers, the Redis primer. Treat the drills below as templates — swap the domain, keep the funnel.

### Q1. Choose a broker for four systems and justify each: an order-processing system, a real-time notification fan-out, an IoT fleet, and a click-stream analytics pipeline.

Run each through the funnel — throughput, ordering, loss cost, duplicate cost, fan-out shape — then let the broker fall out.

- **Order processing (e-commerce checkout).** Moderate throughput, **per-customer ordering matters**, loss is unacceptable, duplicates are catastrophic (double-charge). Either **Kafka** (partition by `customer_id` for per-key order, `acks=all`, RF 3, log retention lets you replay after a bug) or **RabbitMQ quorum queues** (per-queue order, publisher confirms). I lean Kafka when you also want replay/audit; RabbitMQ when you want rich routing and per-message TTL and volumes are modest. Pair with an outbox + idempotent consumer either way.
- **Real-time notification fan-out (one event → many subscribers).** The shape is **one-to-many broadcast**. `SNS → many SQS` or **Kafka with multiple consumer groups** (each group is an independent copy of the stream) both fit; for pushing to millions of connected mobile/web clients, **RabbitMQ or a pub/sub layer / Redis pub/sub** at the edge is common. Key insight: consumer groups (Kafka) or fanout exchanges (RabbitMQ) give you N independent readers without N copies of the producer.
- **IoT fleet (huge number of devices, telemetry).** Very high fan-*in*, small messages, often **loss-tolerant** and needs a lightweight device protocol. **MQTT** at the edge bridging into **Kafka** (or **Kinesis/Pub/Sub**) for the backbone. NATS is a strong lightweight option. Partition by `device_id`. At-least-once, and you usually accept some loss on sampled telemetry.
- **Click-stream analytics.** Extreme throughput, **ordering barely matters**, some loss is fine, the consumer is a warehouse/stream processor. **Kafka or Kinesis** — a replayable, retained log feeding Spark/Flink/Streams. This is the Data Engineering primer's home turf; xref it for the ETL side. Here the broker is a durable buffer, not a work queue.

The meta-point interviewers want: *the requirement picks the broker*, and you can articulate a scenario where each broker is the wrong choice.

### Q2. Design a payment pipeline with exactly-once effects — no lost charges, no double charges.

State up front: there is no exactly-once *delivery* (see the delivery topic); we build exactly-once *effects* on at-least-once delivery. Three mechanisms compose:

1. **Outbox on the producer side.** In one DB transaction, write the `order` row *and* an `outbox` row (the "charge requested" event). A relay (CDC via Debezium, or a poller) publishes committed outbox rows to the broker. This eliminates the dual-write problem — you never have "charged in DB but message lost" or vice versa, because both live in the same commit.
2. **At-least-once transport** with `acks=all`, RF 3, idempotent producer (`enable.idempotence=true`) so producer retries don't duplicate on the write side. Partition by `customer_id` for per-customer ordering.
3. **Idempotent consumer** at the charge step. Before calling the payment provider, `INSERT` the `payment_id` into a dedup table with a unique constraint (or `SETNX payment:{id}` in Redis with TTL). If it already exists, the message is a redelivery — skip and ack. The external call itself should carry an **idempotency key** so even the provider dedups.

```
outbox -> broker(acks=all, RF3) -> consumer:
  begin
    insert into processed(payment_id) values (?)   -- unique constraint
    call provider.charge(idempotency_key = payment_id)
    commit
  ack
```

Failures that must be survived: consumer crashes after `charge` but before `ack` → redelivery hits the unique-constraint / provider idempotency and no second charge occurs. Provider call fails transiently → retry with backoff; exceed the budget → route to **DLQ** and alert (see reliability topic). This is the canonical answer: **outbox + idempotency + DLQ**, at-least-once underneath.

### Q3. Consumers are seeing duplicate messages in production — diagnose and fix.

Duplicates are *expected* under at-least-once; the real question is why they now cause visible harm. Walk it:

- **Confirm it's at-least-once, not a bug.** Almost every broker redelivers on un-acked messages. Duplicates appearing is normal; the consumer being *non-idempotent* is the defect.
- **Find the redelivery trigger.** Common causes: (a) consumer processing slower than the ack/visibility timeout — RabbitMQ redelivers, SQS re-shows after visibility timeout, Kafka rebalances and reprocesses from the last committed offset; (b) offsets/acks committed *after* a crash window; (c) a rebalance storm from `max.poll.interval.ms` being exceeded because a poll batch takes too long.
- **Fix in two layers.** *Stop-the-bleeding*: extend the visibility/ack timeout or reduce batch size (`max.poll.records`, prefetch) so processing finishes before redelivery — this is a backpressure lever (see backpressure topic). *Correct fix*: make the consumer **idempotent** — dedup on a stable business key (unique constraint or Redis `SETNX` with TTL), not on broker metadata. Never "solve" duplicates by chasing exactly-once delivery.
- **If duplicates spiked suddenly**, suspect a slow downstream (DB, external API) pushing processing past the timeout, or a deploy that changed batch size / commit placement.

### Q4. Consumer lag is growing — walk the diagnosis.

Lag = produced offset − committed offset; growing lag means consumers can't keep up (see backpressure topic). Diagnose top-down:

1. **Measure.** `kafka-consumer-groups --describe --group g` (or RabbitMQ queue depth, SQS `ApproximateNumberOfMessagesVisible`). Is lag on *all* partitions or a *few*? A hot partition points to a skewed key (see ordering topic).
2. **Producer spike or consumer slowdown?** Compare produce rate to consume rate over time. A step-up in produce rate (traffic, backfill) vs a step-down in consume rate (slow DB, GC pauses, a bad deploy, an external dependency).
3. **Are consumers parallel-bound?** Consumers in a group can't exceed the **partition count** — if you have 6 partitions and 6 consumers, adding a 7th does nothing. Fix: add partitions *and* consumers (accepting rebalance + ordering-scope cost), or speed up per-message work.
4. **Per-message cost.** Profile the handler — a synchronous external call or an unindexed query is the usual culprit. Batch DB writes, add caching, parallelise I/O.
5. **Rebalance thrash.** Frequent rebalances (from long poll intervals) mean consumers spend time re-fetching instead of processing; tune `max.poll.records` down and `max.poll.interval.ms` appropriately.

Escalation order: scale consumers → add partitions → optimise the handler → shed/sample load. Lag is the pressure gauge; don't just add consumers blindly if the bottleneck is a single hot partition or a slow downstream.

### Q5. Messages are arriving out of order — why, and how do you fix it?

Order is only ever guaranteed **within a partition/queue for a given key** (see ordering topic) — never globally across a topic. Out-of-order almost always means the ordering *unit* is wrong. Diagnose:

- **No partition key / random key.** If the producer doesn't set a key, Kafka round-robins across partitions and related events scatter — `order-created` and `order-paid` for the same order land on different partitions and race. Fix: **partition by the entity id** (`order_id` / `customer_id`) so all events for one entity share a partition and stay ordered.
- **Multiple consumers on one logical stream.** With a work queue and competing consumers (RabbitMQ, SQS), two consumers process two messages concurrently and finish out of order. Fix: use a **key-affine** consumer (SQS FIFO with `MessageGroupId`, RabbitMQ consistent-hash exchange, or Kafka's per-partition single-consumer guarantee).
- **Producer retries reordering.** Without idempotence, a retried message can land after a later one. Fix: `enable.idempotence=true` and `max.in.flight.requests.per.connection` bounded (Kafka guarantees order with idempotence on).
- **You genuinely need cross-key total order.** Then you need a single partition (throughput ceiling) or ordering downstream by a sequence number / event-time. Usually the right answer is: you *don't* need global order, only per-entity order — confirm the requirement.

### Q6. A poison message is stuck at the head of the queue — how do you handle it?

A poison message fails every time it's processed; under at-least-once it redelivers forever and, in an ordered partition, **blocks everything behind it** (head-of-line blocking). Handle it:

- **Retry with a budget, not infinitely.** Track a delivery/attempt count. RabbitMQ exposes redelivery count / `x-death` headers; Kafka you track attempts in the payload or a side store. Retry a few times with **exponential backoff** (transient failures — a blipping DB — recover).
- **After the budget, dead-letter it.** Route to a **DLQ** (`x-dead-letter-exchange` in RabbitMQ, SQS redrive policy `maxReceiveCount`, a `topic.DLT` in Kafka) so the main flow unblocks. The DLQ preserves the message + failure metadata for inspection.
- **Alert on DLQ arrivals.** A DLQ nobody watches is a silent data-loss graveyard. Wire an alert on DLQ depth > 0.
- **Kafka nuance.** You can't skip a single offset in place without committing past it; the standard pattern is the consumer *catches* the failure, produces the record to a DLT topic, commits the offset, and moves on — so one poison record never wedges the partition. Reprocess from the DLT after fixing the bug (a schema mismatch, a null field — see schema topic).

The framing: retry (transient) → DLQ (permanent) → alert → reprocess. Never let at-least-once retry a poison message unbounded.

### Q7. How would you migrate from RabbitMQ to Kafka — or add a broker to a synchronous monolith — without a big-bang cutover?

Both are the same problem: introduce a messaging seam incrementally, never flip everything at once.

**Adding a broker to a monolith:** find a synchronous call that doesn't need a response — e.g. "send confirmation email" after checkout. Replace the direct call with a published event and a consumer. Use the **outbox pattern** so the event is written in the same transaction as the business change (no dual-write gap). This is the strangler approach: peel off one async-friendly interaction at a time, each shipping independently.

**RabbitMQ → Kafka:** never a flag-day rewrite. Options:
- **Dual-write / bridge.** Producers publish to both, or a bridge consumer forwards RabbitMQ → Kafka (or vice versa) so old and new consumers coexist. Migrate consumers one at a time onto Kafka, verify parity, then move producers.
- **Consumer-first.** Stand up Kafka, mirror traffic into it, build and validate the new consumers against real data while RabbitMQ remains the source of truth. Cut over reads once you trust it, then retire the Rabbit path.
- **Mind the semantic gap.** Rabbit is a *queue* (message deleted on ack, rich routing, per-message TTL/priority); Kafka is a *retained log* (offset-based, replayable, partition-ordered). Consumers that relied on competing-consumer load balancing within a queue must be re-modelled onto partitions + consumer groups; routing logic on exchanges moves to topic design or a stream processor. Call this out — it's the part naive migrations miss.

Guiding principle: a reversible, per-interaction migration with a bridge and a verification window, not a cutover you can't roll back.

### Q8. Design a system to guarantee no order is ever lost — end to end.

"Never lost" means tracing durability across **four handoffs**, because a message can be lost at any of them:

1. **Client → service.** The accept must be durable *before* you ack the client. Write to the DB (or broker) with the request, then respond 200. If you 200 first and crash, the order is lost. Idempotency key on the request so a client retry doesn't create two orders.
2. **Service → broker (the dual-write trap).** Do **not** write the DB then separately publish — a crash between them loses or orphans the event. Use the **outbox pattern**: DB change + outbox row in one transaction, relay to the broker after commit. Producer config: `acks=all`, `enable.idempotence=true`, RF ≥ 3, `min.insync.replicas=2` so a single broker loss can't lose an acknowledged write.
3. **Broker durability.** Replication factor 3 with `min.insync.replicas=2` (Kafka) or quorum queues (RabbitMQ) so the message survives a node failure; persistent/durable messages, not transient. Retention long enough to replay.
4. **Broker → consumer.** At-least-once: **process, then ack/commit** — never ack first. Idempotent consumer so the resulting duplicates are harmless. Failures past the retry budget go to a DLQ (not dropped) with an alert.

Then narrate the failure walk: broker node dies → ISR/quorum covers it; consumer crashes mid-process → redelivery + idempotency; producer crashes after DB commit → outbox relay still delivers; poison message → DLQ, not loss. The chain is only as strong as its weakest handoff, and the two that candidates forget are **outbox** (handoff 2) and **ack-after-process** (handoff 4).

### Q9. The interview one-liner: how do you structure any messaging / system-design answer?

**Requirements before brokers.** Run every messaging question through one funnel — throughput, ordering scope, and the cost of loss versus the cost of a duplicate — then pick **at-least-once delivery plus an idempotent consumer** as the default contract (because exactly-once *delivery* is a myth; you engineer exactly-once *effects* with outbox + idempotency + DLQ). Only *then* let the broker fall out of the requirements — Kafka for a replayable high-throughput log, RabbitMQ for rich routing and work queues, SQS/SNS for managed fan-out, Redis/NATS for lightweight low-latency — and prove the design by narrating four failures: a broker node dies, a consumer crashes mid-process, a consumer falls behind, and a poison message arrives. If your answer names a tradeoff and survives that failure walk, you're reasoning like someone who has operated messaging in production — which is exactly the signal the question exists to detect.


