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
      "Ingest is one MX service that refuses in three places inside a single transaction, cheapest first. On connect it drops known-bad IPs before a byte of body crosses the wire; at RCPT TO it returns 550 for an unknown recipient rather than accepting and bouncing later, because the return path on spam is forged and your bounce makes you the spammer; at end of DATA it refuses only a DMARC failure against a domain that published p=reject. That disposes of roughly 30% of arrivals at close to zero cost.",
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
    // --- inbound: the one service that is allowed to say no ---------------
    {
      id: "external-senders",
      label: "External senders",
      sub: "any host on the internet",
      kind: "external",
      x: 40,
      y: 0,
      w: 300,
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
      kind: "serviceGroup",
      x: 40,
      y: 86,
      w: 300,
      h: 432,
      detail: {
        what: "The internet-facing servers named by the domain's MX records: one SMTP transaction with three hooks, on_connect, on_rcpt and on_data_end, in one process.",
        why: "Drawn as one service with three stages rather than three services because the stages share a TCP connection and a transaction. There is no network hop between them, nothing can be deployed or scaled without the others, and the whole point is that each hook is cheaper than the one after it, which is only true if they run in the same process in order.",
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
      id: "p-connect",
      label: "on_connect",
      sub: "peer IP against reputation",
      kind: "process",
      x: 60,
      y: 130,
      w: 260,
      detail: {
        what: "The first refusal point: the peer IP is checked against a reputation table and known botnet space is dropped with a 554 before a byte of message has crossed the wire.",
        why: "It runs first because it is the cheapest rejection available and it disposes of the most raw connection volume. Everything downstream costs a round trip, a body read or a DNS lookup; this costs one memory access on data we already had.",
        numbers: ["one memory read per connection", "runs before MAIL FROM"],
        breaks:
          "A wrong entry blackholes a whole netblock of legitimate senders silently, and the senders it hits are exactly the ones with no other channel to tell us.",
      },
    },
    {
      id: "p-rcpt",
      label: "on_rcpt",
      sub: "550 unknown user, never bounce",
      kind: "process",
      x: 60,
      y: 260,
      w: 260,
      detail: {
        what: "The second refusal point: resolve the recipient locally, return 550 immediately if the address does not exist, and 421 rather than 5xx if the sender is over its per-IP or per-domain rate limit.",
        why: "This is where the difference between the two kinds of no is enforced. A non-existent recipient is deterministic, so it earns a 5xx; a rate limit is our own opinion about volume, so it gets a 4xx the sender can retry past.",
        numbers: ["550 for no such user", "421 for over the rate limit"],
        breaks:
          "Accepting for an unknown user and bouncing afterwards is the single most common self-inflicted wound in mail operations, and it is invisible until the blocklists arrive.",
        choice: {
          pick: "Refuse an unknown recipient inside the transaction, at RCPT TO.",
          instead: "Accept everything the syntax allows and generate a bounce afterwards when delivery finds no such mailbox.",
          decider:
            "Who receives the bounce. The return path on spam is forged, so a bounce for a message we should never have taken goes to the forged victim rather than the sender. That is backscatter, and it gets us listed as a spam source by the same feeds the connect-time check depends on.",
          flips:
            "A relay that genuinely cannot resolve recipients at the edge, such as a gateway in front of a directory it may only query asynchronously. Then the only honest answer is 451 and a retry, not an accept.",
        },
      },
    },
    {
      id: "p-data",
      label: "on_data_end",
      sub: "SPF, DKIM, DMARC, then 250",
      kind: "process",
      x: 60,
      y: 390,
      w: 260,
      detail: {
        what: "The third and last refusal point: with the whole message in hand, evaluate SPF, DKIM and DMARC, refuse with 550 only on a DMARC failure against a published p=reject, defer with 451 if the classifier fleet is unhealthy, and otherwise return 250.",
        why: "This is the only place a content-aware decision is possible and the only place we deliberately decline to make one. A 550 here is not our judgement of the message, it is the sending domain instructing us to refuse mail that fails its own authentication, which moves the false-positive risk to the party that can actually fix it.",
        numbers: ["DMARC p=none, p=quarantine, p=reject", "pct= stages enforcement, 10% then 50%"],
        breaks:
          "A stale or missing DMARC policy turns a would-be 5xx into an accept, so an outage in DNS resolution shows up as a spam wave rather than as an error.",
        choice: {
          pick: "Act only on DMARC: alignment between the visible From and whichever of SPF or DKIM passed, then the domain's own published policy.",
          instead: "Act on SPF or DKIM directly, refusing anything that fails either check.",
          decider:
            "What each protocol actually authenticates. SPF authenticates the Return-Path, not the From: header the user sees, so a message can pass SPF for attacker.example while displaying From: security@yourbank.com, and SPF fails on every forward because the forwarder is now the connecting IP. DKIM survives forwarding but breaks the moment a list appends a footer. Only DMARC yields an aligned verdict plus a policy the sender authorised.",
          flips:
            "Inside a closed relay where every sender is yours and every path is known, an SPF failure really is conclusive and the extra DMARC lookup buys nothing.",
        },
      },
    },
    {
      id: "ip-reputation",
      label: "IP reputation table",
      sub: "in memory, rebuilt from feeds",
      kind: "cache",
      x: 420,
      y: 130,
      w: 280,
      detail: {
        what: "The connecting-IP verdict the MX reads on every connection: known-bad netblocks, per-IP rate state and reputation tier, held in memory on each MX host.",
        why: "It is a cache and not a system of record on purpose. It is rebuilt from reputation feeds and our own observed traffic, so losing a node's copy costs a warm-up rather than data, and that is what lets it live in memory next to the SMTP process instead of behind an RPC.",
        numbers: ["one memory read at 6.6M transactions/s peak", "limits tightened dynamically by tier"],
        breaks:
          "It is authoritative for a refusal it can never be corrected on: a stale bad entry keeps refusing a rehabilitated netblock, and nothing in the protocol tells us that is happening.",
        choice: {
          pick: "In-process reputation table refreshed from feeds out of band.",
          instead: "An RPC to an external blocklist service on every connection.",
          decider:
            "Per-connection budget at 6.6M SMTP transactions/s peak. The connect-time check has to cost one memory access; a network round trip per connection is three orders of magnitude too slow to sit in front of the cheapest rejection we own, and it makes the door depend on a third party's availability.",
          flips:
            "A deployment handling a few hundred messages a second, where a live query is comfortably affordable and running a reputation feed locally is not worth the operational weight.",
        },
      },
    },
    {
      id: "dns-auth-cache",
      label: "SPF / DKIM / DMARC cache",
      sub: "TTL-bounded, from sender DNS",
      kind: "cache",
      x: 420,
      y: 260,
      w: 280,
      detail: {
        what: "Cached SPF records, DKIM public keys by selector and DMARC policies, keyed by sending domain and bounded by the TTL the domain published.",
        why: "All three answers have to arrive inside the SMTP conversation, and all three are somebody else's DNS records. Caching them is what makes an authentication decision affordable per message; the records change on the order of days, so a TTL cache costs almost no accuracy.",
        numbers: ["records cached to their published TTL", "one lookup set per message, not per recipient"],
        breaks:
          "A miss on a DKIM selector during key rotation looks exactly like an authentication failure, which is why the receiver has to try every published selector rather than the one it remembers.",
        choice: {
          pick: "TTL-bounded cache of the sending domain's published records.",
          instead: "A live DNS lookup per message, inside the transaction.",
          decider:
            "Latency budget inside the transaction against how fast the records change. A DNS round trip is milliseconds against a per-connection budget measured in microseconds at peak, and SPF, selectors and policies change on the order of days, so almost every live lookup would return the answer we already had.",
          flips:
            "Enforcing a policy the moment it changes, which matters when you are the domain rolling out p=reject with pct= staging and want each step to take effect now rather than a TTL later.",
        },
      },
    },
    {
      id: "sender-dns",
      label: "Sending domain DNS",
      sub: "TXT records, DKIM selectors",
      kind: "external",
      x: 800,
      y: 260,
      w: 280,
      detail: {
        what: "The sending domain's own DNS, holding the SPF TXT record, the DKIM public key at selector._domainkey.domain, and the DMARC policy at _dmarc.domain.",
        why: "Drawn explicitly because the policy we enforce at the door is published by somebody else, on their schedule, in infrastructure we neither own nor page for. Every 550 we issue on DMARC grounds is authorised by a record fetched from here.",
        numbers: ["multiple selectors are normal during rotation", "rua aggregate reports go back daily"],
        breaks:
          "If the sending domain's DNS is unreachable, DMARC cannot be evaluated and the message is accepted, so their outage becomes our spam problem rather than their delivery problem.",
      },
    },

    // --- acceptance: everything below here is revisable -------------------
    {
      id: "accept-writer",
      label: "Acceptance writer",
      sub: "SHA-256 body, convergent DEK",
      kind: "service",
      x: 40,
      y: 560,
      w: 300,
      detail: {
        what: "The post-250 write path: hash the body, derive a data key from that hash, put-if-absent into object storage, insert the metadata row with label UNSORTED, then publish the event.",
        why: "It is a separate service from the MX because the two sides of the 250 have opposite requirements. The MX is bounded by a connection it cannot hold open; this side has no deadline and is allowed to be slow, which is also why a short internal queue between them can absorb a storage hiccup without the door having to refuse.",
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
      kind: "blob",
      x: 800,
      y: 390,
      w: 280,
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
      id: "user-storage-zone",
      label: "Per-user storage, sharded by user_id",
      kind: "zone",
      x: 780,
      y: 520,
      w: 320,
      h: 298,
      detail: {
        what: "The two tiers keyed by user_id: the mailbox metadata rows and the user's logical search index. They deploy, scale and fail apart, which is why this is a boundary rather than one service.",
        why: "Sharding both on user_id makes list, search, label and delete single-partition operations. Every read a mailbox performs is scoped to exactly one user, so there is no reason to let a query touch a partition that user does not own. The body store is deliberately outside this frame: it is content-addressed and global, and one object is referenced by many users.",
        numbers: ["~50MB metadata per user", "~250MB index per user"],
        breaks:
          "The two tiers are only eventually consistent with each other, so a delete that completes in the metadata store and not in the index leaves mail that is gone from the mailbox and still findable by search.",
      },
    },
    {
      id: "metadata-store",
      label: "Mailbox metadata",
      sub: "wide-column, key user_id",
      kind: "database",
      x: 800,
      y: 560,
      w: 280,
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
      id: "search-index",
      label: "Per-user search index",
      sub: "~50k users per shard",
      kind: "database",
      x: 800,
      y: 690,
      w: 280,
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

    // --- the asynchronous side: three independent consumers ---------------
    {
      id: "change-stream",
      label: "Change stream",
      sub: "one log, three consumers",
      kind: "queue",
      x: 40,
      y: 820,
      w: 300,
      detail: {
        what: "The durable log of accepted-message events that the classifier, the indexer and the notifier all consume independently, each at its own offset.",
        why: "Fanning out to three consumers off one log is what keeps the accept path short: the MX and the writer are done once the row is in, and everything slow hangs off here. It also gives the classifier replay, which is what retro-relabelling needs.",
        numbers: ["1.16M events/s average", "three independent consumer offsets"],
        breaks:
          "A consumer falling behind is invisible from the ingest side: mail is still being accepted and stored, so the only symptom is that new messages sit unsorted, unsearchable or unannounced for longer.",
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
      sub: "labels only, canaried",
      kind: "service",
      x: 420,
      y: 690,
      w: 280,
      detail: {
        what: "Scores every accepted message on headers, body, URLs against a phishing corpus, attachment hashes, sender velocity and cross-mailbox campaign signals, then sets the label to INBOX or SPAM.",
        why: "Running it off the acceptance path buys features no per-connection decision can see. The same body hash in 40,000 mailboxes in 90 seconds is nearly free to detect and nearly impossible to fake, because varying the body to break the hash also breaks the campaign's economics.",
        numbers: ["~30% of accepted mail foldered as spam", "FP budget 0.1%, measured on 'not spam' clicks"],
        breaks:
          "A bad model build corrupts no data, it silently moves legitimate mail out of sight, and the only symptom is a metric that is itself a lower bound: 'not spam' clicks only count the mistakes somebody happened to notice. Hence canary rollout with auto-revert, plus human review of a sampled slice of spam-foldered mail.",
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
      id: "indexer",
      label: "Indexer",
      sub: "extracted text, not raw bytes",
      kind: "service",
      x: 420,
      y: 820,
      w: 280,
      detail: {
        what: "The second stream consumer: extract subject, body text and participants, analyse them, and write postings into the user's logical index.",
        why: "Drawn as its own service rather than an arrow into the index because it owns work the store does not: deciding what is indexable, and running the purge that has to follow every delete. Indexing off the same log as classification is also what stops the two getting out of order with each other.",
        numbers: ["~4KB indexable per 50KB message", "postings run ~30% of source text"],
        breaks:
          "Index cleanup is a separate job from message deletion, so a purge that completes in the metadata store but not here leaves deleted mail findable by search, and nobody notices until somebody searches for it.",
        choice: {
          pick: "Index extracted text only, and time-tier the result.",
          instead: "Index everything, including attachment contents, in one hot tier.",
          decider:
            "Cost per byte. The index covers ~4KB per 50KB message, so it is an eighth of the corpus, but it lives on SSD at roughly $60/TB/month against $5/TB/month for the bodies: 500PB of index is ~$30M/month against ~$10M/month for 2EB of mail. The index is an eighth of the bytes and three times the bill, so age tiering it matters more than age tiering the mail.",
          flips:
            "A compliance deployment where attachment contents must be discoverable, which changes the indexable fraction and the bill with it, and is paid for by the obligation rather than the feature.",
        },
      },
    },
    {
      id: "notifier",
      label: "Push notifier",
      sub: "message id only, on accept",
      kind: "service",
      x: 420,
      y: 950,
      w: 280,
      detail: {
        what: "The third stream consumer: turn an accepted-message event into a new-mail signal for the recipient's connected devices.",
        why: "Push is an independent consumer rather than something the accept path does, so a notification backlog can never delay an SMTP acceptance. It fires on acceptance, which is before the label exists, so the signal carries a message id and the client does an ordinary read to find out what actually arrived.",
        numbers: ["fires on accept, not on classification"],
        breaks:
          "Because it runs ahead of the label, a message the classifier is about to folder as spam can still buzz a phone, so the notification must never carry content that would make that mistake visible.",
      },
    },

    // --- read and send: the side where the caller is ours ------------------
    {
      id: "mailbox-api",
      label: "Mailbox API + sync",
      sub: "cursor REST, IMAP/POP",
      kind: "service",
      x: 1180,
      y: 390,
      w: 300,
      detail: {
        what: "The read and send surface: cursor-paginated folder listings, full message fetch, search, label and read-state writes, and message submission.",
        why: "It is the only tier that joins the three stores back together, and it is where the user_id on every query comes from. IMAP and POP are served here rather than as their own system because they are a protocol surface over the same single-partition reads, not a separately scaled product.",
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
      id: "metadata-cache",
      label: "Hot metadata cache",
      sub: "recent rows, look-aside",
      kind: "cache",
      x: 1560,
      y: 260,
      w: 280,
      detail: {
        what: "A look-aside cache of the most recent metadata rows for the users currently reading mail, invalidated by label and read-state writes.",
        why: "The hot set is people reading right now, not the corpus, and that is only small because bodies are not in the row. This is the component that turns the storage split from an argument into a number.",
        numbers: ["5% of users active/hour x 100 rows x 250B = ~1.25TB", "0.0025% of the 50PB corpus serves most reads"],
        breaks:
          "It caches exactly the fields the classifier rewrites, so a retro-relabel that does not invalidate leaves a spam campaign sitting in the inbox on every device that already listed it.",
        choice: {
          pick: "Cache the raw 250B rows, look-aside, invalidated on write.",
          instead: "No cache at all: serve every inbox view straight from the wide-column tier.",
          decider:
            "Where the read load lands. Every inbox view is a read against the same partitions ingest is writing to at 1.16M/s, and the hot set is ~1.25TB, so almost all of it fits in a modest cache tier. Without the metadata/body split the same hot set would be ~250TB and there would be nothing worth caching, which is why this box and the acceptance writer's decision are the same decision.",
          flips:
            "Mailboxes read by machines rather than people, where there is no recency skew to exploit and the cache is a hit-rate of nearly zero plus an invalidation bug waiting to happen.",
        },
      },
    },
    {
      id: "clients",
      label: "Webmail, mobile, IMAP",
      sub: "authenticated, one user_id",
      kind: "client",
      x: 1180,
      y: 950,
      w: 300,
      detail: {
        what: "The devices a person is holding: the web client, the mobile apps and third-party IMAP or POP clients, plus the push channel they receive on.",
        why: "Drawn as a client rather than an external because this is the side of the trust boundary where we know who is calling. Every request carries an authenticated user_id, which is what makes single-partition routing and cross-user isolation possible at all, and it is the exact opposite of the inbound SMTP side where nothing about the caller is known.",
        numbers: ["10B sends/day, ~10 per user", "'not spam' clicks are the only FP signal we get"],
        breaks:
          "A POP client that downloads and deletes, or an IMAP client holding UID sequences, pins mailbox layout decisions we would otherwise be free to change.",
      },
    },

    // --- outbound: we are the untrusted stranger now -----------------------
    {
      id: "outbound-queue",
      label: "Outbound queue",
      sub: "durable before Sent, 72h backoff",
      kind: "queue",
      x: 1560,
      y: 560,
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
      id: "sending-workers",
      label: "Sending workers + IP pools",
      sub: "gold / silver / quarantine",
      kind: "service",
      x: 1560,
      y: 690,
      w: 280,
      detail: {
        what: "The workers that lease a queued message, do the MX lookup and open SMTP to the recipient, sending from addresses grouped by sender trust.",
        why: "Outbound reputation is a shared resource and it is the thing a compromised account destroys fastest. Tiering means the addresses a bad actor burns are ones we were prepared to lose, not the pool the rest of the population sends from.",
        numbers: ["three pools: established, new, quarantine", "per-account limits catch 10x the 7-day baseline", "new addresses warmed at ~1,000/day, doubling weekly"],
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
      x: 1560,
      y: 820,
      w: 280,
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
    // --- inbound, and the three refusals ---------------------------------
    {
      id: "e-arrive",
      from: "external-senders",
      to: "p-connect",
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
      id: "e-ipcheck",
      from: "p-connect",
      to: "ip-reputation",
      label: "peer IP, one memory read",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The connect-time lookup: is this peer in known-bad space, and what rate limit does its tier get.",
        why: "A control path, not a mail path: it carries no message, it only decides whether one is allowed to start. It has to answer in the time it takes to accept a TCP connection, which is why the table is in memory on the MX itself.",
        numbers: ["before MAIL FROM, before any body bytes"],
        breaks: "A cold table after a restart makes a host briefly accept traffic it should have dropped, so warm-up order matters on deploy.",
      },
    },
    {
      id: "e-refuse-connect",
      from: "p-connect",
      to: "external-senders",
      label: "554 known-bad IP",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 30,
      detail: {
        what: "The cheapest refusal in the system: a 554 to a connection from known botnet space, issued before a byte of message has been read.",
        why: "It is deterministic and it is ours to be wrong about, which is why it is bounded to netblocks with observed behaviour rather than to anything inferred from content. The bulk of raw connection volume dies here at the cost of one memory read.",
        numbers: ["one memory read to decide"],
        breaks: "A wrong entry is permanent and silent for the sender: they get a hard refusal with no route to appeal it and no bounce anybody will read.",
      },
    },
    {
      id: "e-connect-rcpt",
      from: "p-connect",
      to: "p-rcpt",
      label: "connection accepted",
      detail: {
        what: "The same SMTP conversation continuing into MAIL FROM and RCPT TO, in the same process on the same socket.",
        why: "Drawn as a stage boundary rather than a hop because that is exactly what it is. The ordering is the design: each stage is more expensive than the one before it, and that only saves anything if the cheap one runs first and can end the conversation.",
        numbers: ["no network hop, no serialisation"],
        breaks: "Reordering the stages, or making one of them a remote call, silently converts the cheapest rejection in the system into the most expensive.",
      },
    },
    {
      id: "e-refuse-rcpt",
      from: "p-rcpt",
      to: "external-senders",
      label: "550 no such user",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "A 550 for an address that does not resolve locally, and a 421 for a sender over its rate limit.",
        why: "Refusing here rather than accepting is what keeps us off the blocklists. The return path on spam is forged, so a bounce generated later would go to the forged victim, and that backscatter gets us listed by the same feeds the connect-time check depends on.",
        numbers: ["550 for unknown user, 421 for rate limit"],
        breaks: "Never accept for an unknown user and bounce afterwards. It is the most common self-inflicted wound in mail operations and it is invisible until the listings arrive.",
      },
    },
    {
      id: "e-rcpt-data",
      from: "p-rcpt",
      to: "p-data",
      label: "recipient resolves",
      detail: {
        what: "The transaction proceeding to DATA now that the recipient is known to exist and the sender is within its limits.",
        why: "This is the point where reading the body becomes worth paying for. Everything before it was decided on the envelope, which costs nothing; everything after it needs the whole message in hand.",
        numbers: ["body read starts here"],
        breaks: "Message size limits belong here, not later: reading an unbounded body before deciding anything is how a single sender consumes an MX host's memory.",
      },
    },
    {
      id: "e-dnsauth",
      from: "p-data",
      to: "dns-auth-cache",
      label: "SPF, DKIM, DMARC",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "The authentication lookups at end of DATA: the sending domain's SPF record, the DKIM public key for the selector in the signature, and the DMARC policy for the visible From domain.",
        why: "All three have to answer inside the SMTP conversation, so all three are served from cache. This is a control path: it carries no mail, it only decides what happens to it.",
        numbers: ["one lookup set per message", "relaxed alignment is what almost everyone publishes"],
        breaks: "A miss on a DKIM selector during key rotation looks like an authentication failure, so the receiver has to try every published selector rather than one.",
      },
    },
    {
      id: "e-dnsfill",
      from: "dns-auth-cache",
      to: "sender-dns",
      label: "TTL miss, TXT lookup",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The refill on a miss or an expired TTL: TXT for SPF and for _dmarc.domain, and the key at selector._domainkey.domain.",
        why: "Deliberately off the hot path. A DNS round trip is milliseconds against a per-connection budget measured in microseconds at peak, so it may happen on a miss but never on every message.",
        numbers: ["records cached to their published TTL"],
        breaks: "If the sending domain's DNS is unreachable the policy cannot be read, and the safe answer is to accept, so their outage arrives as our spam wave.",
      },
    },
    {
      id: "e-refuse-data",
      from: "p-data",
      to: "external-senders",
      label: "550 DMARC, or 451 defer",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "The last refusal: 550 on a DMARC failure against a published p=reject, or 451 when the classifier fleet is unhealthy and we would rather not guess.",
        why: "This arrow is the only irreversible thing in the diagram, and the only 5xx here is one the sending domain authorised. Anything probabilistic gets the 4xx instead, which is a refusal you can take back and which RFC 5321 senders retry for days.",
        numbers: ["~1e-6 false positives on a p=reject refusal", "1e-3 for a model score, which is why it never lands here"],
        breaks: "A 5xx on legitimate mail is permanent and invisible to the recipient. There is no bounce they will see and no channel through which the mistake can be reported.",
      },
    },

    // --- acceptance and the write path ------------------------------------
    {
      id: "e-accept",
      from: "p-data",
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
      id: "e-body",
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
      id: "e-row",
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
      id: "e-event",
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

    // --- three consumers, three independent offsets ------------------------
    {
      id: "e-cs-classifier",
      from: "change-stream",
      to: "classifier",
      label: "unsorted, needs a label",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Accepted messages delivered to the scoring fleet, which reads the body from object storage and the sender history alongside.",
        why: "Consuming from a log rather than being called synchronously is what gives the classifier unbounded time and, more usefully, the ability to rewind and re-score after a bad model deploy.",
        numbers: ["scored well after the 250, not before it"],
        breaks: "Consumer lag here means mail sits unsorted in the mailbox, which users experience as spam in the inbox rather than as an outage.",
      },
    },
    {
      id: "e-cs-indexer",
      from: "change-stream",
      to: "indexer",
      label: "same log, own offset",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The indexer reading the same events at its own offset, independent of how far behind or ahead the classifier is.",
        why: "Separate offsets are the point of the log: a slow indexer must not delay a label, and a re-scoring pass that rewinds the classifier must not re-index everything it touches.",
        numbers: ["1.16M events/s", "offsets tracked per consumer"],
        breaks: "Indexer lag is invisible to everything except search, so the symptom is a user who cannot find a message they are looking at.",
      },
    },
    {
      id: "e-cs-notifier",
      from: "change-stream",
      to: "notifier",
      label: "new mail, on accept",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The notifier consuming the same stream to push a new-mail signal to connected devices.",
        why: "Push is a third independent consumer rather than something the accept path does, so a notification backlog can never delay an SMTP acceptance.",
        numbers: ["fires on accept, before the label exists"],
        breaks: "Because it runs ahead of classification, a spam message can buzz a phone before it is foldered, which is why the push carries an id and not content.",
      },
    },
    {
      id: "e-label",
      from: "classifier",
      to: "metadata-store",
      label: "label: INBOX or SPAM",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "A label update against the metadata row, and on a campaign hit a bulk update across every row sharing that body hash.",
        why: "The verdict is a label rather than a deletion precisely so it can be revised in both directions. When the campaign detector fires on copy 12,000, the 11,999 already delivered are moved by a bulk update with no bytes touched.",
        numbers: ["40,000 recipients in 90 seconds is the campaign signal"],
        breaks: "Bulk relabelling has to be rate limited and reversible by the same mechanism, or one false campaign hit silently empties 40,000 inboxes of mail those users asked for.",
      },
    },
    {
      id: "e-index",
      from: "indexer",
      to: "search-index",
      label: "postings, ~4KB per msg",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Analysed subject, body text and participants written into the user's logical index, on the shard that holds their user_id range.",
        why: "Indexing extracted text rather than raw bytes is what keeps the index at an eighth of the corpus, which matters because it is the most expensive byte in the system.",
        numbers: ["postings run ~30% of source text", "~250MB per user at steady state"],
        breaks: "The write is not transactional with the metadata row, so a crash between them leaves a message that lists but does not search, or the reverse after a purge.",
      },
    },
    {
      id: "e-push",
      from: "notifier",
      to: "clients",
      label: "push: message id only",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The new-mail signal delivered to the device, carrying the message id rather than the message.",
        why: "The push fires on acceptance, before the label exists, so it cannot say anything about what arrived. The client re-reads, which also means the notification path never becomes a second, differently-consistent copy of the mailbox.",
        numbers: ["one signal per accepted message"],
        breaks: "A push that carried subject and sender would show a phishing message on a lock screen a second before the classifier foldered it.",
      },
    },

    // --- the read and send side --------------------------------------------
    {
      id: "e-client-api",
      from: "clients",
      to: "mailbox-api",
      label: "read, search, send",
      animated: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Everything the user does: list a folder, open a message, search, mark read, relabel, and submit a new message.",
        why: "Every one of these carries an authenticated user_id, which is what makes single-partition routing possible. This is the side of the system where the caller is known, and the contrast with the inbound SMTP edge is the whole point of the question.",
        numbers: ["100 rows per page", "under 500ms p95 for list and search"],
        breaks: "IMAP and POP sessions hold state across requests, so a client can be mid-sync when a mailbox is re-sharded underneath it.",
      },
    },
    {
      id: "e-feedback",
      from: "clients",
      to: "classifier",
      label: "'not spam' click",
      dashed: true,
      fromSide: "bottom",
      toSide: "bottom",
      detail: {
        what: "User feedback: 'Report spam' and 'Not spam' clicks, written as a label change and captured as a training label, retrained nightly.",
        why: "This loop is the reason labelling beats refusing. A refused message generates no signal and teaches the system nothing, whereas a mis-filed one reaches a human who can correct it, and that correction is the only false-positive measurement we have.",
        numbers: ["retrained nightly", "gates the canary: auto-revert on FP threshold breach"],
        breaks: "It counts only the mistakes somebody noticed. Most people never open the spam folder, and the mail most likely to be mis-filed is exactly the mail nobody is watching for, so the 0.1% budget is a lower bound with an unknown multiplier.",
      },
    },
    {
      id: "e-read-meta",
      from: "mailbox-api",
      to: "metadata-store",
      label: "cursor page, 100 rows",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "An inbox listing: a bounded cursor read of the recipient's own partition, plus label and read-state writes.",
        why: "Single-partition by construction, because the shard key is the authenticated user_id. The storage client rejects any request whose partition key does not match the caller, so an authorisation bug in one endpoint cannot become a cross-user read.",
        numbers: ["under 500ms p95", "at most 100 rows per page"],
        breaks: "Offset pagination on a 4M-message mailbox scans everything before the page, so latency grows with depth on the hottest partition we own.",
      },
    },
    {
      id: "e-read-body",
      from: "mailbox-api",
      to: "object-store",
      label: "body bytes on open",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Fetching and decrypting the body when a user actually opens a message, using the data key unwrapped from their metadata row.",
        why: "It is deliberately a second round trip. Bodies are read roughly once in their life and inbox listings never need them, so paying a fetch on open is far cheaper than carrying 50KB through every list request.",
        numbers: ["DEK unwrapped with the per-user KEK"],
        breaks: "A KMS regional issue makes bodies undecryptable while auth and metadata stay healthy, so the mailbox lists correctly and every message fails to open.",
      },
    },
    {
      id: "e-search",
      from: "mailbox-api",
      to: "search-index",
      label: "query scoped to user_id",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A search query routed by user_id to the one shard holding that user's postings, fanning to warm and cold tiers only when the hot tier returns sparse results.",
        why: "Routing on user_id is what turns a packed shard back into a private index: the postings for a common term span 50k users, and sorting on user_id makes skipping the rest a block-level seek rather than a scan.",
        numbers: ["90d hot, 1y warm, archive beyond", "under 500ms p95"],
        breaks: "Common facets (sender, label, has-attachment) must be precomputed as columnar indexes, or every 'find that thing from Bob' query pays the full-text path it did not need.",
      },
    },
    {
      id: "e-cache",
      from: "mailbox-api",
      to: "metadata-cache",
      label: "hot rows, look-aside",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A look-aside read of the recent rows for this user, filled on miss and invalidated whenever a label or read-state write lands.",
        why: "Inbox views are overwhelmingly recent and overwhelmingly repeated, so a small cache absorbs most of the read load that would otherwise hit the same partitions ingest is writing to.",
        numbers: ["~1.25TB hot set", "5% of users active per hour"],
        breaks: "The cached fields are the ones the classifier rewrites, so a missed invalidation shows the user a folder the store no longer agrees with.",
      },
    },
    {
      id: "e-send",
      from: "mailbox-api",
      to: "outbound-queue",
      label: "durable before Sent",
      fromSide: "right",
      toSide: "top",
      detail: {
        what: "A composed message enqueued durably, after which the UI is allowed to say Sent.",
        why: "The acknowledgement follows the queue write, never the delivery attempt, because the recipient's server is not ours to make fast. Sent is a promise about our durability, and saying it any earlier is a lie the sender cannot detect.",
        numbers: ["10B sends/day, 116k/s average"],
        breaks: "Acknowledging before the queue write loses the message with no trace, and the sender has no way to discover it was never sent.",
      },
    },

    // --- outbound ----------------------------------------------------------
    {
      id: "e-lease",
      from: "outbound-queue",
      to: "sending-workers",
      label: "lease, then MX lookup",
      animated: true,
      detail: {
        what: "A queued message leased to a sending worker, which resolves the recipient domain's MX record and picks a pool address by the sender's reputation tier.",
        why: "Pool selection happens here rather than at compose time because reputation is a property of recent behaviour, and an account can be demoted between composing and sending.",
        numbers: ["~500k/s at peak", "three pools by sender trust"],
        breaks: "If a worker dies holding a lease, that message stalls until the lease expires, so the timeout directly bounds worst-case send latency.",
      },
    },
    {
      id: "e-smtp-out",
      from: "sending-workers",
      to: "recipient-mx",
      label: "SMTP to recipient",
      detail: {
        what: "The outbound SMTP conversation with the recipient's mail server.",
        why: "This is the mirror image of the inbound edge, and we are now the untrusted stranger. Everything about pool tiering, SPF, DKIM and warm-up exists so this connection is accepted rather than deferred or foldered.",
        numbers: ["4xx means retry, 5xx means bounce"],
        breaks: "A cold address emitting a million messages looks exactly like a botnet, which is why new sending addresses are warmed at roughly 1,000/day doubling weekly.",
      },
    },
    {
      id: "e-defer",
      from: "recipient-mx",
      to: "outbound-queue",
      label: "4xx defer, retry to 72h",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 60,
      detail: {
        what: "A temporary failure from the recipient sending the message back into the retry queue with a longer backoff.",
        why: "The recipient's server being busy is a normal condition, not an error, so the queue absorbs it. Growing backoff from a minute to hours is what stops a struggling recipient being hammered by our whole fleet on an identical schedule.",
        numbers: ["1min, 5min, 15min, 1h, 4h and up", "~3% of sends defer at least once"],
        breaks: "Sustained deferral to a large recipient inflates in-flight retry state, which is ~50M messages at steady state and grows without bound if the backoff ladder has no ceiling.",
      },
    },
    {
      id: "e-bounce",
      from: "outbound-queue",
      to: "metadata-store",
      label: "bounce at 72h",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "After 72 hours of failed retries, a bounce message written into the sender's own mailbox and the original moved to a failed folder.",
        why: "Never a silent drop, because the sender has no other channel through which to learn. The bounce goes to our own authenticated user, which is exactly the case where a bounce is safe to generate at all.",
        numbers: ["99.9% delivered or bounced within 72h"],
        breaks: "Generating bounces to unauthenticated third parties is backscatter and gets you listed, which is why inbound refuses at RCPT TO rather than accepting and bouncing.",
      },
    },
  ],
};
