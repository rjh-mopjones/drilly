import type { Diagram } from "./types";

export const EMAIL_SERVICE: Diagram = {
  id: "email-service",
  title: "Email Service",
  question: "Design a Distributed Email Service (Gmail)",
  sourceId: "patterns",
  itemId: 20,
  overview: {
    shape:
      "An acceptance decision wrapped around a storage system: SMTP gives you one irreversible bit at the end of DATA, so the architecture is mostly about which signals are allowed to refuse and which are only ever allowed to file.",
    beats: [
      "Ingest is an MX fleet that refuses in three places, cheapest first. On connect it drops known-bad IPs before a byte of body crosses the wire; at RCPT TO it returns 550 for an unknown recipient rather than accepting and bouncing later, because the return path on spam is forged and your bounce makes you the spammer; at end of DATA it refuses only a DMARC failure against a domain that published p=reject. That disposes of roughly 30% of arrivals at close to zero cost.",
      "Everything else gets a 250, and acceptance is a promise about storage, not about the inbox. The body goes to content-addressed object storage under SHA-256 of its content, a 250B metadata row lands on the recipient's shard of a wide-column store carrying subject, participants, thread id, body hash and a wrapped data key, and the label starts as UNSORTED rather than INBOX.",
      "Classification happens off a change stream, where it has unbounded time and features no per-connection decision can see. The strongest is cross-mailbox: the same body hash arriving in 40,000 mailboxes in 90 seconds is trivial to spot and nearly impossible to disguise. The output is a label, never a refusal, so copies already delivered can be retro-relabelled by a bulk update against the metadata rows with no bytes touched.",
      "The storage split is the load-bearing separation. Metadata is 250B, read on every inbox view, and wants strong consistency because marking a message read must show on every device; bodies average 50KB, are typically read once, and deduplicate about 7x on the attachment slice. One store cannot be right for both. The cost is that delete, retention, legal hold and key revocation now have to be correct across two stores plus an index that is only eventually consistent with either.",
      "Search is per user, which removes the hard half of the problem: nobody searches anyone else's mail, so there is no cross-user ranking and no global recall requirement, only a packing problem. One logical index per user, roughly 50k users to a physical shard sorted on user_id, gives 20,000 operable shards instead of a billion unmanageable ones.",
      "Outbound never blocks on a stranger's infrastructure. A send is durable in a replicated queue before the UI says Sent, a worker does the MX lookup and opens SMTP, and failure means growing backoff for up to 72 hours and then a bounce into the sender's own inbox, never a silent drop. Sending addresses are tiered by account reputation so a compromised account burns a quarantine pool rather than the addresses everyone else sends from.",
    ],
    crux:
      "The protocol gives you one bit and no take-backs. A 5xx on legitimate mail is permanent and invisible to the recipient, so only signals running near 1e-6 false positives may produce one. A spam model runs near 1e-3, and at 100B accepted messages a day that is 1e8 legitimate messages destroyed daily, against roughly $45k/month to store the junk instead. That asymmetry, not storage, is what shapes the whole system.",
    numbers: [
      "100B accepted/day, 1.16M/s average",
      "50KB logical vs ~10KB stored per message",
      "index is an eighth of the bytes and 3x the bill",
    ],
  },
  nodes: [
    {
      id: "user-storage-group",
      label: "Per-user storage, sharded by user_id",
      kind: "group",
      x: 424,
      y: 364,
      w: 292,
      h: 218,
      detail: {
        what: "The two tiers keyed by user_id: the mailbox metadata rows and the user's logical search index.",
        why: "Sharding both on user_id makes list, search, label and delete single-partition operations. Every read a mailbox performs is scoped to exactly one user, so there is no reason to let a query touch a partition that user does not own.",
        numbers: ["~50MB metadata per user", "~250MB index per user"],
        breaks:
          "The heaviest mailboxes, roughly 4M messages and 200GB logical, saturate a single partition's IOPS and no amount of extra fleet helps.",
      },
    },
    {
      id: "external-senders",
      label: "External senders",
      sub: "any host on the internet",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "Every mail server on the internet, all of which are legitimate callers by specification and about half of which are hostile.",
        why: "Drawn explicitly because it is the constraint the rest of the design answers to. The write path was specified in 1982, nothing about the caller is known before the message arrives, and the protocol cannot be versioned or upgraded the way an internal API can.",
        numbers: ["143B arrivals/day, 1.65M/s average", "~6.6M SMTP transactions/s at peak"],
        breaks:
          "Peak is the US morning overlapping the European evening plus scheduled newsletter blasts, roughly 4x average, and none of it is under our control or schedulable.",
      },
    },
    {
      id: "mx-fleet",
      label: "MX fleet",
      sub: "SMTP inbound, three refusal points",
      kind: "compute",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "The internet-facing servers named by the domain's MX records, holding the only place in the system where a refusal is possible.",
        why: "This is where the accept-or-refuse boundary lives, and it spends that power sparingly because a refusal is permanent. Connection reputation on connect, unknown recipient at RCPT TO, DMARC failure against a published p=reject at end of DATA, and nothing else.",
        numbers: ["~30% of arrivals disposed of here", "~70% get a 250 and an asynchronous verdict"],
        breaks:
          "Backpressure cascades: when the storage tier slows, every MX starts deferring at once and the whole internet's retry timers converge on our recovery window.",
        choice: {
          pick: "Refuse only on deterministic evidence: IP reputation, unknown RCPT, DMARC p=reject. Defer with 4xx when unsure.",
          instead: "Run the spam classifier inside the SMTP transaction and answer 5xx above a score threshold, so junk is never written or indexed.",
          decider:
            "False-positive rate against storage cost, and the two are three orders of magnitude apart. A production spam model runs near 1e-3; a refusal authorised by the sender's own DMARC policy runs near 1e-6. Moving the model inside the transaction destroys 1e-3 x 1e11 = 1e8 legitimate messages a day, permanently and invisibly, to save storing 30B spam x 10KB = 300TB/day, 9PB standing at 30-day retention, about $45k/month.",
          flips:
            "When you have nowhere to put the message: an inline filtering gateway in front of somebody else's mail server, under a contract forbidding retention of customer content, has to answer inside the transaction because it is not allowed to own a quarantine.",
        },
      },
    },
    {
      id: "reputation-auth",
      label: "Reputation + DNS auth cache",
      sub: "IP table, SPF/DKIM/DMARC records",
      kind: "store",
      x: 440,
      y: 110,
      w: 260,
      detail: {
        what: "The two lookups the MX makes inside the transaction: a connecting-IP reputation table, and cached SPF records, DKIM public keys and DMARC policies from the sending domain's DNS.",
        why: "Only one of the three protocols yields an actionable verdict. SPF authenticates the Return-Path, not the visible From, so it is useless alone as a phishing defence. DKIM signs a canonicalised body and travels with the message, so it survives forwarding. DMARC requires alignment between the visible From and whichever of the two passed, then reads the domain's own published policy.",
        numbers: ["p=none, p=quarantine or p=reject", "pct= stages enforcement, 10% then 50%"],
        breaks:
          "A stale or missing DMARC policy turns a would-be 5xx into an accept, and a wrong IP reputation entry silently blackholes a whole netblock of legitimate senders.",
        choice: {
          pick: "In-memory IP reputation table plus a TTL-bounded DNS cache for SPF, DKIM selectors and DMARC policies.",
          instead: "A live DNS lookup per message, or an RPC to an external blocklist service on every connection.",
          decider:
            "Per-connection budget at 6.6M SMTP transactions/s peak. The connect-time reputation check has to be one memory read, and a DNS round trip per connection is three orders of magnitude too slow to sit there. Policies and selectors change on the order of days, so a TTL cache costs almost no accuracy.",
          flips:
            "A deployment handling a few hundred messages a second, where live DNS per message is comfortably affordable and running a reputation feed locally is not worth the operational weight.",
        },
      },
    },
    {
      id: "accept-writer",
      label: "Acceptance writer",
      sub: "SHA-256 body, convergent DEK, 250B row",
      kind: "compute",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "The post-250 write path: hash the body, derive a data key from that hash, put-if-absent into object storage, insert the metadata row with label UNSORTED.",
        why: "It is drawn separately from the MX because the boundary between them is the whole design. Everything above it is irreversible and must be near-certain; everything below it is revisable and is allowed to be slow. The label starting as UNSORTED rather than INBOX is what makes that explicit.",
        numbers: ["dek = hkdf(sha256(body))", "row inserted with labels=[UNSORTED]"],
        breaks:
          "The write spans two stores plus a stream, so a partial failure leaves a metadata row pointing at a body that was never stored, and the user sees a message that will not open.",
        choice: {
          pick: "Write bodies and metadata to two separate stores, joined by the content hash.",
          instead: "One row per message with the body and attachments inlined alongside the headers.",
          decider:
            "Read amplification on the inbox path. A metadata row is ~250B and is read on every inbox view; a body averages 50KB and is typically read once. Inlining makes a 100-row inbox listing pull ~5MB instead of 25KB, and it destroys the hot cache: 5% of users active per hour at 100 recent rows each is ~1.25TB cacheable when bodies are out, and hopeless when they are in.",
          flips:
            "Small mailboxes and small deployments, where a single store is one fewer thing to keep consistent and the read path never grows large enough for the amplification to bite.",
        },
      },
    },
    {
      id: "object-store",
      label: "Body + attachment store",
      sub: "content-addressed on SHA-256",
      kind: "store",
      x: 440,
      y: 220,
      w: 260,
      detail: {
        what: "The bytes, keyed by content hash, so identical content is stored once regardless of how many mailboxes reference it.",
        why: "This is where deduplication actually pays. One corporate newsletter PDF landing in ten thousand mailboxes is one object, and without that saving the storage arithmetic does not close at all.",
        numbers: ["~7x dedup on the attachment slice", "50KB logical to ~10KB stored", "~2EB stored against 10EB logical"],
        breaks:
          "The reference-counting collector can remove the last reference to a blob mid-read, so deletes are two-phase with a grace period that aborts if read traffic touches the object.",
        choice: {
          pick: "Content-addressed object storage with convergent encryption: the data key is derived from the plaintext hash, then wrapped per recipient.",
          instead: "One encrypted copy per recipient, with each user's own key applied to their own bytes.",
          decider:
            "Stored bytes. Per-recipient encryption makes identical plaintext produce different ciphertext, which kills dedup and takes stored volume from ~10KB to 50KB per message, so 2EB becomes 10EB. At roughly $5/TB/month that is $10M/month becoming $50M/month for content nobody will read twice.",
          flips:
            "When equality leakage is unacceptable. Convergent encryption lets anyone who can write to the store test whether a given plaintext is already present, which is a real weakness for low-entropy templated documents, and it makes provable erasure a key-revocation claim rather than a demonstration that the bytes are gone.",
        },
      },
    },
    {
      id: "metadata-store",
      label: "Mailbox metadata",
      sub: "wide-column, partition key user_id",
      kind: "store",
      x: 440,
      y: 380,
      w: 260,
      detail: {
        what: "One ~250B row per recipient per message: msg id, subject, participants, timestamp, labels, thread id, body hash and the wrapped data key.",
        why: "Partitioning on user_id is what makes list, search, label and delete single-partition operations. Cross-user isolation is enforced here rather than in the application: every query carries the authenticated user_id and the storage client rejects any request whose partition key does not match.",
        numbers: ["~250B/row, ~200k messages/user", "~50MB per user, 50PB total, ~150PB at RF=3"],
        breaks:
          "A 4M-message mailbox saturates its partition's IOPS, so p99 list latency climbs for that one user and their IMAP sync stalls while everyone else is fine.",
        choice: {
          pick: "Shard by user_id, one full row per recipient, with bodies deduplicated underneath by content hash.",
          instead: "One canonical record per delivered message with a thin per-user pointer row carrying only labels and read state.",
          decider:
            "Mean recipients per delivered message, which is 1.3 here because list software expands its recipients before the mail reaches our MX. A shared record therefore removes at most 1 - 1/1.3 = 23% of metadata rows, 23% of 50PB = ~12PB, which is 0.6% of the 2EB corpus. That buys nothing against giving up single-partition reads.",
          flips:
            "Enterprise tenancy, where mean internal fan-out above roughly 15 removes 93% of the row bytes and, more importantly, makes the tenant the unit of legal hold. Holding one copy is the only version of a hold whose completeness you can demonstrate.",
        },
      },
    },
    {
      id: "change-stream",
      label: "Change stream",
      sub: "log-structured bus, three consumers",
      kind: "bus",
      x: 40,
      y: 330,
      w: 280,
      detail: {
        what: "The durable log of accepted-message events that the classifier, the indexer and the notifier all consume independently.",
        why: "Fanning out to three consumers off one log is what keeps the accept path short: the MX and the writer are done once the row is in, and everything slow hangs off here. It also gives the classifier replay, which is what retro-relabelling needs.",
        numbers: ["1.16M events/s average", "consumed by classifier, indexer, notifier"],
        breaks:
          "A consumer falling behind is invisible from the ingest side: mail is still being accepted and stored, so the only symptom is that new messages sit unsorted and unsearchable for longer.",
        choice: {
          pick: "A log-structured bus with independent consumer offsets.",
          instead: "Direct RPC from the acceptance writer to each of classification, indexing and notification.",
          decider:
            "Consumer count and replay. Three consumers at 1.16M/s means an RPC fan-out puts three synchronous dependencies on the accept path, and any one of them being unhealthy then propagates into the SMTP transaction. A log lets a consumer rewind, which is exactly what a re-scoring pass after a bad classifier deploy has to do.",
          flips:
            "A single-consumer deployment where classification, indexing and delivery are the same process, at which point the broker is pure operational cost with nothing to decouple.",
        },
      },
    },
    {
      id: "classifier",
      label: "Asynchronous classifier",
      sub: "labels only, canaried, auto-revert",
      kind: "compute",
      x: 40,
      y: 440,
      w: 280,
      detail: {
        what: "Scores every accepted message on headers, body, URLs against a phishing corpus, attachment hashes, sender velocity and cross-mailbox campaign signals, then sets the label to INBOX or SPAM.",
        why: "Running it off the acceptance path buys features no per-connection decision can see. The same body hash in 40,000 mailboxes in 90 seconds is nearly free to detect and nearly impossible to fake, because varying the body to break the hash also breaks the campaign's economics.",
        numbers: ["~30% of accepted mail foldered as spam", "FP budget 0.1%, measured on 'not spam' clicks"],
        breaks:
          "A bad model build corrupts no data, it silently moves legitimate mail out of sight, and the only symptom is a metric. Hence canary rollout gated on the 'not spam' rate with auto-revert on threshold breach.",
        choice: {
          pick: "Emit a revisable label off the change stream, never a refusal.",
          instead: "Score synchronously at end of DATA so the verdict is available while the connection is still open.",
          decider:
            "Which copy of a campaign you get to judge. A per-connection decision only ever sees copy 1, which is genuinely hard; by copy 12,000 the same body hash in 40,000 mailboxes inside 90 seconds settles it for free. Labelling also keeps the feedback loop, since 'not spam' clicks are training data retrained nightly and a refused message generates no signal at all.",
          flips:
            "When the classifier fleet is down rather than merely degraded, at which point the MX returns 451 and defers. A 4xx is the one refusal you can take back, and RFC 5321 senders retry for days.",
        },
      },
    },
    {
      id: "search-index",
      label: "Per-user search index",
      sub: "~50k users per shard, sorted on user_id",
      kind: "store",
      x: 440,
      y: 490,
      w: 260,
      detail: {
        what: "One logical inverted index per user over extracted text, packed many to a physical shard with user_id as the leading sort key.",
        why: "Nobody searches another user's mail, so there is no global ranking model and no cross-corpus recall requirement, which is the only thing a shared index would buy. Every query is scoped to exactly one user and touches one shard and one contiguous run of postings.",
        numbers: ["~4KB indexable per message, ~250MB/user", "250PB, ~500PB at RF=2 on SSD", "90d hot, 1y warm, then cold"],
        breaks:
          "An index that outgrows affordable hot storage as a mailbox approaches its 5.5-year steady state, at which point search p99 climbs for that one user and nobody else.",
        choice: {
          pick: "One logical index per user, ~50k users packed per physical shard, sorted on user_id.",
          instead: "One physical index per user, fully isolated, with no shared postings and no cross-user skip cost.",
          decider:
            "Per-shard floor cost against user count. A shard costs on the order of 100MB resident plus a slot in cluster state whether it holds 200k or 200M documents, and clusters get unmanageable in the low hundreds of thousands of shards. 1B physical indices is four orders of magnitude past that; packing 50k users gives 20,000 shards, large but operable.",
          flips:
            "Thousands of tenants rather than a billion users, where isolation is contractual: customer-managed keys, per-tenant residency and provable index purge on offboarding. At 10k tenants, 10k physical indices is an ordinary cluster.",
        },
      },
    },
    {
      id: "mailbox-api",
      label: "Mailbox API + sync",
      sub: "REST cursor, IMAP/POP, push",
      kind: "compute",
      x: 40,
      y: 550,
      w: 280,
      detail: {
        what: "The read and sync surface: cursor-paginated folder listings, full message fetch, search, and the push notification fed by the change stream.",
        why: "It is the only tier that joins the three stores back together, and it is where the user_id on every query comes from. Marking a message read has to show on every device at once, which is why the metadata side is the strongly consistent one.",
        numbers: ["list and search under 500ms p95", "never more than 100 rows per page"],
        breaks:
          "IMAP and POP carry per-folder UID sequences and flag state, which constrain how freely a mailbox may be re-sharded underneath a live client session.",
        choice: {
          pick: "Cursor-based pagination over the metadata rows, with IMAP and POP served alongside an HTTP API.",
          instead: "Offset pagination, and an HTTP API only with no legacy protocol support.",
          decider:
            "Behaviour on the heaviest mailboxes. At 4M messages, an offset page deep into the mailbox scans everything before it, so latency grows with position in a partition that is already the hottest one we own. A cursor bounds every request at 100 rows regardless of depth.",
          flips:
            "A consumer-only product with first-party clients, where dropping IMAP and POP removes the UID-sequence constraint entirely and re-sharding a mailbox becomes an internal decision.",
        },
      },
    },
    {
      id: "outbound-queue",
      label: "Outbound queue",
      sub: "durable before Sent, 72h backoff",
      kind: "bus",
      x: 40,
      y: 680,
      w: 280,
      detail: {
        what: "The replicated queue a send lands in before the UI says Sent, holding retry state through growing backoff up to 72 hours.",
        why: "Delivery is never synchronous because the recipient's server is not our problem to make fast. The user's Sent is a promise about our queue, and pretending otherwise blocks a UI on a stranger's infrastructure.",
        numbers: ["10B sends/day, 116k/s average, ~500k/s peak", "backoff 1min, 5min, 15min, 1h, 4h and up", "~50M messages in retry state at any moment"],
        breaks:
          "A message that neither delivers nor bounces is the failure that matters, because the sender has no other way to learn. At 72 hours the queue owes them a bounce into their own inbox.",
        choice: {
          pick: "A durable replicated queue acknowledged before the client is told anything.",
          instead: "Synchronous delivery, holding the client request open until the recipient's MX accepts.",
          decider:
            "In-flight volume. If 3% of sends transiently defer and the mean deferral is 4 hours, 10B x 0.03 x 4/24 = ~50M messages are mid-retry at any moment. There is no version of that which is a held connection, and a queue that is not durable turns a broker restart into silently lost mail the sender believes was sent.",
          flips:
            "An internal-only relay where every recipient MX is yours and reachable, so a failure is a real error the caller should see immediately rather than something to retry for three days.",
        },
      },
    },
    {
      id: "sending-ips",
      label: "Sending workers + IP pools",
      sub: "gold / silver / quarantine tiers",
      kind: "compute",
      x: 40,
      y: 790,
      w: 280,
      detail: {
        what: "The workers that do the MX lookup and open SMTP to the recipient, sending from addresses grouped by sender trust.",
        why: "Outbound reputation is a shared resource and it is the thing a compromised account destroys fastest. Tiering means the addresses a bad actor burns are ones we were prepared to lose, not the pool the rest of the population sends from.",
        numbers: ["three pools: established, new, quarantine", "per-account limits catch 10x the 7-day baseline"],
        breaks:
          "One compromised account on a shared address gets that address listed, and every other user sending from it starts bouncing before anyone notices the compromise.",
        choice: {
          pick: "Reputation-tiered sending pools with automatic demotion on anomalous send behaviour.",
          instead: "One shared pool for all outbound, sized purely for throughput.",
          decider:
            "Blast radius of a single listing. 1,000 compromised accounts blasting from a shared pool take down all 10B sends/day for everyone on it, and delisting is measured in days. Tiering caps the damage at the quarantine pool, and a per-account limit tripping at 10x the 7-day baseline caps it further before detection even fires.",
          flips:
            "Low outbound volume from a single address, where you have one IP, one reputation, and tiering is a pool structure with nothing to put in it.",
        },
      },
    },
    {
      id: "recipient-mx",
      label: "Recipient MX servers",
      sub: "someone else's infrastructure",
      kind: "external",
      x: 440,
      y: 790,
      w: 260,
      detail: {
        what: "The mail servers we deliver to, found by an MX lookup on the recipient's domain.",
        why: "Drawn explicitly because their availability and their opinion of us are the two things outbound cannot control. They decide whether our mail is delivered, deferred or foldered, and the only lever we hold is the reputation of the address we sent from.",
        numbers: ["4xx means retry, 5xx means bounce"],
        breaks:
          "A recipient server that is down or throttling produces deferrals for hours, which is why retry state is durable and why a bounce is owed at 72 hours rather than on first failure.",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "external-senders",
      to: "mx-fleet",
      label: "SMTP, 1.65M/s arrivals",
      animated: true,
      detail: {
        what: "Inbound SMTP connections from anywhere on the internet, carrying EHLO, MAIL FROM, RCPT TO and DATA.",
        why: "This is the write path we did not design and cannot version. Every capacity number downstream is a function of what this edge is allowed to deliver, which is why the refusal policy is decided before the storage tier.",
        numbers: ["143B arrivals/day", "~6.6M transactions/s at peak"],
        breaks: "Peak is 4x average and entirely externally driven, so there is no scheduling lever, only capacity and deferral.",
      },
    },
    {
      id: "e2",
      from: "mx-fleet",
      to: "reputation-auth",
      label: "IP, SPF, DKIM, DMARC",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The lookups made inside the transaction: connecting-IP reputation on connect, then the sending domain's SPF, DKIM and DMARC records at end of DATA.",
        why: "Both have to answer within the SMTP conversation, so both are cached rather than fetched live. This is a control path: it carries no mail, it only decides what happens to it.",
        numbers: ["one memory read on connect", "DNS records cached with a TTL"],
        breaks: "A cache miss on a DKIM selector during key rotation looks like an authentication failure, so the receiver has to try every published selector rather than one.",
      },
    },
    {
      id: "e3",
      from: "mx-fleet",
      to: "external-senders",
      label: "5xx or 550, ~30% refused",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "The refusal itself: 554 on a known-bad IP, 550 on an unknown recipient, 550 on DMARC failure against a published p=reject, 451 when the classifier fleet is unhealthy.",
        why: "This arrow is the only irreversible thing in the diagram. A 5xx on legitimate mail is permanent and invisible to the recipient, so it is reserved for signals near 1e-6 false positives; anything probabilistic gets a 4xx, which is a refusal you can take back.",
        numbers: ["~30% of arrivals disposed of here", "451 defers, and senders retry for days"],
        breaks: "Never accept for an unknown user and bounce afterwards. The return path on spam is forged, so the bounce hits the forged victim and gets you listed as a spam source.",
      },
    },
    {
      id: "e4",
      from: "mx-fleet",
      to: "accept-writer",
      label: "250 ok, ~70% accepted",
      animated: true,
      detail: {
        what: "An accepted message crossing from the SMTP transaction into the storage path.",
        why: "This is the boundary the whole design is built around. Above it, decisions are permanent and must be near-certain; below it, everything is revisable and is allowed to be slow. Acceptance is a promise about storage, not about the inbox.",
        numbers: ["100B accepted/day, 1.16M/s"],
        breaks: "If storage is slow, this edge backs up into the transaction and the MX has to defer with 4xx rather than guess, which converges every sender's retry timer on our recovery.",
      },
    },
    {
      id: "e5",
      from: "accept-writer",
      to: "object-store",
      label: "body by SHA-256",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A put-if-absent of the encrypted body and attachments under the hash of their content.",
        why: "Put-if-absent rather than put is what makes deduplication happen at write time with no separate reconciliation pass. The same newsletter PDF arriving in ten thousand mailboxes writes once and increments a reference count nine thousand nine hundred and ninety-nine times.",
        numbers: ["~7x dedup on attachments", "1PB/day stored against 5PB/day logical"],
        breaks: "The key is derived from the content, so a colliding or truncated hash silently serves one user another user's bytes.",
      },
    },
    {
      id: "e6",
      from: "accept-writer",
      to: "metadata-store",
      label: "250B row, user shard",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The metadata row insert on the recipient's partition, carrying headers, thread id, body hash, wrapped data key and labels=[UNSORTED].",
        why: "It lands on exactly one partition because the shard key is the recipient's user_id, so a delivery is a single-partition write no matter how many recipients the message had. Threading is computed here at write time from In-Reply-To and References.",
        numbers: ["~250B per row", "mean 1.3 of our recipients per delivered message"],
        breaks: "The row is inserted before classification, so anything reading it in the window between insert and label sees a message with no folder.",
      },
    },
    {
      id: "e7",
      from: "accept-writer",
      to: "change-stream",
      label: "accepted message event",
      animated: true,
      detail: {
        what: "The event published once the body and the row are both durable.",
        why: "Publishing after the write, never before, is what stops a consumer racing the data it is meant to process. Everything expensive hangs off this edge so the acceptance path stays short enough to sit inside an SMTP transaction.",
        numbers: ["1.16M events/s average"],
        breaks: "Publish-before-write leaves the classifier scoring a message whose body is not yet readable, and the retry looks like a transient store error rather than an ordering bug.",
      },
    },
    {
      id: "e8",
      from: "change-stream",
      to: "classifier",
      label: "unsorted, needs a label",
      animated: true,
      detail: {
        what: "Accepted messages delivered to the scoring fleet, which reads the body from object storage and the sender history alongside.",
        why: "Consuming from a log rather than being called synchronously is what gives the classifier unbounded time and, more usefully, the ability to rewind and re-score after a bad model deploy.",
        numbers: ["scored well after the 250, not before it"],
        breaks: "Consumer lag here means mail sits unsorted in the mailbox, which users experience as spam in the inbox rather than as an outage.",
      },
    },
    {
      id: "e9",
      from: "classifier",
      to: "metadata-store",
      label: "label: INBOX or SPAM",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A label update against the metadata row, and on a campaign hit a bulk update across every row sharing that body hash.",
        why: "The verdict is a label rather than a deletion precisely so it can be revised in both directions. When the campaign detector fires on copy 12,000, the 11,999 already delivered are moved by a bulk update with no bytes touched.",
        numbers: ["40,000 recipients in 90 seconds is the campaign signal"],
        breaks: "Bulk relabelling has to be rate limited and reversible by the same mechanism, or one false campaign hit silently empties 40,000 inboxes of mail those users asked for.",
      },
    },
    {
      id: "e10",
      from: "change-stream",
      to: "search-index",
      label: "extracted text, ~4KB",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The indexer consuming the same stream and writing analysed subject, body and participants into the user's logical index.",
        why: "It indexes extracted text rather than raw bytes, which is what keeps the index at an eighth of the corpus. Sharing the stream with the classifier means indexing and scoring cannot get out of order with each other.",
        numbers: ["~4KB indexable per 50KB message", "postings run ~30% of source text"],
        breaks: "Index cleanup is a separate job from message deletion, so a purge that completes in the metadata store but not here leaves deleted mail findable by search.",
      },
    },
    {
      id: "e11",
      from: "change-stream",
      to: "mailbox-api",
      label: "new mail push",
      dashed: true,
      detail: {
        what: "The notifier consuming the stream and pushing a new-mail signal to connected clients.",
        why: "Push is a third independent consumer rather than something the accept path does, so a notification backlog can never delay an SMTP acceptance. The client then does an ordinary read to fetch what actually arrived.",
        numbers: ["fires on accept, not on classification"],
        breaks: "Notifying before the label is set means a spam message can buzz a phone before it is foldered, so the push has to carry the message id and let the client re-read.",
      },
    },
    {
      id: "e12",
      from: "mailbox-api",
      to: "metadata-store",
      label: "cursor page, 100 rows",
      animated: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "An inbox listing: a bounded cursor read of the recipient's own partition, plus label and read-state writes.",
        why: "Single-partition by construction, because the shard key is the authenticated user_id. The storage client rejects any request whose partition key does not match the caller, so an authorisation bug in one endpoint cannot become a cross-user read.",
        numbers: ["under 500ms p95", "at most 100 rows per page"],
        breaks: "Offset pagination on a 4M-message mailbox scans everything before the page, so latency grows with depth on the hottest partition we own.",
      },
    },
    {
      id: "e13",
      from: "mailbox-api",
      to: "object-store",
      label: "body bytes on open",
      fromSide: "right",
      toSide: "right",
      offset: 90,
      detail: {
        what: "Fetching and decrypting the body when a user actually opens a message, using the data key unwrapped from their metadata row.",
        why: "It is deliberately a second round trip. Bodies are read roughly once in their life and inbox listings never need them, so paying a fetch on open is far cheaper than carrying 50KB through every list request.",
        numbers: ["DEK unwrapped with the per-user KEK"],
        breaks: "A KMS regional issue makes bodies undecryptable while auth and metadata stay healthy, so the mailbox lists correctly and every message fails to open.",
      },
    },
    {
      id: "e14",
      from: "mailbox-api",
      to: "search-index",
      label: "query scoped to user_id",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A search query routed by user_id to the one shard holding that user's postings, fanning to warm and cold tiers only when the hot tier returns sparse results.",
        why: "Routing on user_id is what turns a packed shard back into a private index: the postings for a common term span 50k users, and sorting on user_id makes skipping the rest a block-level seek rather than a scan.",
        numbers: ["90d hot, 1y warm, archive beyond", "under 500ms p95"],
        breaks: "Common facets (sender, label, has-attachment) must be precomputed as columnar indexes, or every 'find that thing from Bob' query pays the full-text path it did not need.",
      },
    },
    {
      id: "e15",
      from: "mailbox-api",
      to: "outbound-queue",
      label: "durable before Sent",
      detail: {
        what: "A composed message enqueued durably, after which the UI is allowed to say Sent.",
        why: "The acknowledgement follows the queue write, never the delivery attempt, because the recipient's server is not ours to make fast. Sent is a promise about our durability, and saying it any earlier is a lie the sender cannot detect.",
        numbers: ["10B sends/day, 116k/s average"],
        breaks: "Acknowledging before the queue write loses the message with no trace, and the sender has no way to discover it was never sent.",
      },
    },
    {
      id: "e16",
      from: "outbound-queue",
      to: "sending-ips",
      label: "MX lookup, then SMTP",
      animated: true,
      detail: {
        what: "A queued message leased to a sending worker, which resolves the recipient domain's MX record and opens an SMTP connection from a pool address chosen by the sender's reputation tier.",
        why: "Pool selection happens here rather than at compose time because reputation is a property of recent behaviour, and an account can be demoted between composing and sending.",
        numbers: ["~500k/s at peak", "three pools by sender trust"],
        breaks: "If a worker dies holding a lease, that message stalls until the lease expires, so the timeout directly bounds worst-case send latency.",
      },
    },
    {
      id: "e17",
      from: "sending-ips",
      to: "recipient-mx",
      label: "SMTP to recipient",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The outbound SMTP conversation with the recipient's mail server.",
        why: "This is the mirror image of the inbound edge, and we are now the untrusted stranger. Everything about pool tiering, SPF, DKIM and warm-up exists so this connection is accepted rather than deferred or foldered.",
        numbers: ["4xx means retry, 5xx means bounce"],
        breaks: "A cold address emitting a million messages looks exactly like a botnet, which is why new sending addresses are warmed at roughly 1,000/day doubling weekly.",
      },
    },
    {
      id: "e18",
      from: "recipient-mx",
      to: "outbound-queue",
      label: "4xx defer, retry to 72h",
      dashed: true,
      fromSide: "bottom",
      toSide: "bottom",
      offset: 70,
      detail: {
        what: "A temporary failure from the recipient sending the message back into the retry queue with a longer backoff.",
        why: "The recipient's server being busy is a normal condition, not an error, so the queue absorbs it. Growing backoff from a minute to hours is what stops a struggling recipient being hammered by our whole fleet on an identical schedule.",
        numbers: ["1min, 5min, 15min, 1h, 4h and up", "~3% of sends defer at least once"],
        breaks: "Sustained deferral to a large recipient inflates in-flight retry state, which is ~50M messages at steady state and grows without bound if the backoff ladder has no ceiling.",
      },
    },
    {
      id: "e19",
      from: "outbound-queue",
      to: "metadata-store",
      label: "bounce at 72h",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      offset: 40,
      detail: {
        what: "After 72 hours of failed retries, a bounce message written into the sender's own mailbox and the original moved to a failed folder.",
        why: "Never a silent drop, because the sender has no other channel through which to learn. The bounce goes to our own authenticated user, which is exactly the case where a bounce is safe to generate at all.",
        numbers: ["99.9% delivered or bounced within 72h"],
        breaks: "Generating bounces to unauthenticated third parties is backscatter and gets you listed, which is why inbound refuses at RCPT TO rather than accepting and bouncing.",
      },
    },
  ],
};
