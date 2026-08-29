import type { Diagram } from "./types";

export const EMAIL_SERVICE: Diagram = {
  id: "email-service",
  title: "Email Service",
  question: "Design a Distributed Email Service (Gmail)",
  sourceId: "patterns",
  itemId: 20,
  overview: {
    shape:
      "An acceptance decision wrapped around a storage system. SMTP gives one irreversible bit at the end of DATA, so the architecture is mostly about which signals may refuse and which are only ever allowed to file.",
    forces: [
      {
        constraint: "SMTP gives one irreversible bit at the end of DATA, so a 5xx on legitimate mail is permanent and invisible to the recipient",
        decision: "Only signals near 1e-6 false positives, like a domain's own published DMARC policy, are allowed to refuse; a 1e-3 model only labels",
        lights: ["p-data", "classifier", "e-refuse-data", "e-label"],
      },
      {
        constraint: "the return path on spam is forged on roughly half of all traffic, so a bounce for a message that should never have been accepted hits a forged victim",
        decision: "on_rcpt refuses an unknown recipient with 550 at RCPT TO rather than accepting and bouncing later",
        lights: ["p-rcpt", "e-refuse-rcpt"],
      },
      {
        constraint: "identical mail landing in 40,000 mailboxes in 90 seconds is nearly free to detect but invisible to any single connection",
        decision: "Classification runs off a change stream with unbounded time, so it can use cross-mailbox signal a per-connection verdict never could",
        lights: ["change-stream", "classifier", "e-cs-classifier"],
      },
      {
        constraint: "a metadata row is 250B and read on every inbox view, while a body averages 50KB and is read about once",
        decision: "Metadata and bodies live in two separate stores, joined only by a content hash",
        lights: ["metadata-store", "object-store", "accept-writer", "e-row", "e-body"],
      },
      {
        constraint: "1 compromised account sending from a shared pool can get all 10B sends/day listed, with delisting measured in days",
        decision: "Sends are durable in a queue before the UI says Sent, and sending addresses are tiered so a compromised account burns only its own pool",
        lights: ["outbound-queue", "sending-workers", "e-send", "e-lease"],
      },
    ],
    naive: {
      text: "Score every message for spam right there in the SMTP transaction, and 5xx-refuse anything above the threshold, so junk is never even written or indexed. A production spam model runs its false positives near 1e-3, and at 100B accepted messages a day that is 1e8 legitimate messages destroyed daily. That happens permanently and invisibly, since a 5xx on legitimate mail has no bounce the sender will ever see. The design instead lets almost everything through with a 250, and only refuses on evidence running near 1e-6 false positives, like a domain's own published DMARC policy. A spam verdict becomes a label applied off the acceptance path, which can be revised or reversed with no bytes lost.",
      lights: ["mx-fleet", "classifier"],
    },
    beats: [
      {
        text: "Ingest is one mail gateway that refuses in three places inside a single transaction, cheapest first. On connect it drops known-bad IPs before a byte of body crosses the wire. At RCPT TO it returns 550 for an unknown recipient rather than accepting and bouncing later, because the return path on spam is forged. Your bounce would make you the spammer. At end of DATA it refuses only a DMARC failure against a domain that published p=reject. That disposes of roughly 30% of arrivals at close to zero cost.",
        lights: ["mx-fleet", "p-connect", "p-rcpt", "p-data", "external-senders", "e-refuse-connect", "e-refuse-rcpt", "e-refuse-data"],
      },
      {
        text: "Everything else gets a 250, and acceptance is a promise about storage, not about where a message ends up sorted. The body is written under a hash of its own content, so identical bytes are never stored twice. A 250B metadata row lands on the recipient's own partition, carrying subject, participants, thread id, body hash and a wrapped data key, labelled UNSORTED until classification runs.",
        lights: ["accept-writer", "object-store", "metadata-store", "e-accept", "e-body", "e-row"],
      },
      {
        text: "Classification happens off a change stream, where it has unbounded time and features no per-connection decision can see. The strongest is cross-mailbox: the same body hash arriving in 40,000 mailboxes in 90 seconds is trivial to spot and nearly impossible to disguise. The output is a label, never a refusal, so copies already delivered can be retro-relabelled by a bulk update against the metadata rows with no bytes touched.",
        lights: ["change-stream", "classifier", "e-event", "e-cs-classifier", "e-label"],
      },
      {
        text: "The storage split is the load-bearing separation. Metadata is 250B, read on every inbox view, and wants strong consistency because marking a message read must show on every device. Bodies average 50KB, are typically read once, and deduplicate about 7x on the attachment slice. One store cannot be right for both. The cost is that delete, retention, legal hold and key revocation now have to be correct across two stores plus an index that is only eventually consistent with either.",
        lights: ["metadata-store", "object-store", "user-storage-zone"],
      },
      {
        text: "Search is per user, which removes the hard half of the problem. Nobody searches anyone else's mail, so there is no cross-user ranking and no global recall requirement, only a packing problem. One logical index per user, roughly 50k users to a physical shard sorted on user_id, gives 20,000 operable shards instead of a billion unmanageable ones.",
        lights: ["search-index", "change-stream", "e-cs-search"],
      },
      {
        text: "Outbound never blocks on a stranger's infrastructure. A send is durable in a replicated queue before the UI says Sent, and a worker does the MX lookup and opens SMTP. Failure means growing backoff for up to 72 hours and then a bounce into the sender's own inbox, never a silent drop. Sending addresses are tiered by account reputation so a compromised account burns a quarantine pool rather than the addresses everyone else sends from.",
        lights: ["outbound-queue", "sending-workers", "mailbox-api", "e-send", "e-lease", "e-defer", "e-bounce"],
      },
    ],
    crux: {
      problem:
        "The protocol gives you one bit and no take-backs. A 5xx on legitimate mail is permanent and invisible to the recipient, so only signals running near 1e-6 false positives may produce one.",
      handled:
        "A spam model runs near 1e-3, and at 100B accepted messages a day that is 1e8 legitimate messages destroyed daily, against roughly $45k/month to store the junk instead. That asymmetry, not storage, is what shapes the whole system: everything probabilistic becomes a revisable label, never a refusal.",
    },
    numbers: [
      {
        value: "100B accepted/day, 1.16M/s average",
        explain: "The volume that actually clears all three refusal points and enters storage, out of 143B raw arrivals a day.",
      },
      {
        value: "50KB logical vs ~10KB stored per message",
        explain: "The gap content-addressed deduplication buys once identical attachments and bodies are counted once instead of once per recipient.",
      },
      {
        value: "index is an eighth of the bytes and 3x the bill",
        explain: "The search index is smaller per message than the metadata plus body corpus, but its per-byte storage cost is higher, making it a disproportionate share of spend.",
      },
    ],
  },
  nodes: [
    // --- inbound: the one service that is allowed to say no ---------------
    {
      id: "external-senders",
      label: "External senders",
      sub: "any host on the internet",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "Every mail server on the internet, all of which are legitimate callers by specification and about half of which are hostile.",
        why: "Drawn explicitly because it is the constraint the rest of the design answers to. The write path was specified in 1982. Nothing about the caller is known before the message arrives, and the protocol cannot be versioned or upgraded the way an internal API can.",
        numbers: [
          { value: "143B arrivals/day, 1.65M/s average", explain: "The raw volume this edge is provisioned to accept connections from, before any refusal is applied." },
          { value: "~6.6M SMTP transactions/s at peak", explain: "The peak transaction rate this design has to sustain during overlapping time-zone peaks." },
        ],
        breaks: {
          failure: "Peak is the US morning overlapping the European evening plus scheduled newsletter blasts, roughly 4x average.",
          handled: "None of it is under our control or schedulable, which is why capacity and refusal policy, not demand shaping, are the only levers available here.",
        },
      },
    },
    {
      id: "mx-fleet",
      label: "MX fleet",
      kind: "serviceGroup",
      col: 1,
      row: 0,
      detail: {
        what: "The internet-facing servers named by the domain's MX records: one SMTP transaction with three hooks, on_connect, on_rcpt and on_data_end, in one process.",
        why: "It is one service with three stages rather than three services because the stages share a TCP connection and a transaction. Each hook is cheaper than the one after it, which is only true if they run in the same process in order. Both caches live in-process because a network round trip is three orders of magnitude too slow to sit in a per-message budget measured in microseconds.",
        numbers: [
          { value: "~30% of arrivals disposed of here", explain: "100B accepted / 0.7 ≈ 143B total arrivals/day; the other ~43B/day are refused here, before storage ever sees them." },
          { value: "~70% get a 250 and an asynchronous verdict", explain: "The majority that pass all three checks and proceed to acceptance." },
          { value: "IP reputation: one memory read at 6.6M transactions/s peak", explain: "1.16M/s average x 4 (peak) / 0.7 accept rate ≈ 6.6M/s total arrivals — the rate this check must hold at, not just accepted mail." },
          { value: "SPF/DKIM/DMARC cache: TTL-bounded from sender DNS, one lookup set per message", explain: "Caching turns a network-bound check into memory, since a live DNS lookup is three orders of magnitude too slow for a microsecond hook." },
        ],
        breaks: {
          failure: "Backpressure cascades: when the storage tier slows, every MX starts deferring at once and the whole internet's retry timers converge on our recovery window.",
          handled: "A stale reputation entry keeps refusing a rehabilitated netblock silently. If the sending domain's own DNS is unreachable the safe default is to accept, turning their outage into our spam problem.",
        },
        choice: {
          pick: "Refuse only on deterministic evidence: IP reputation, unknown RCPT, DMARC p=reject. Defer with 4xx when unsure.",
          instead: "Run the spam classifier inside the SMTP transaction and answer 5xx above a score threshold, so junk is never written or indexed.",
          decider:
            "False-positive rate against storage cost, and the two are three orders of magnitude apart. A production spam model runs near 1e-3; a refusal authorised by the sender's own DMARC policy runs near 1e-6. Moving the model inside the transaction destroys 1e8 legitimate messages a day to save roughly $45k/month.",
          flips: "When you have nowhere to put the message: an inline filtering gateway under a contract forbidding retention of customer content has to answer inside the transaction.",
        },
      },
    },
    {
      id: "p-connect",
      label: "on_connect",
      sub: "peer IP against reputation",
      kind: "process",
      col: 0,
      row: 1,
      parent: "mx-fleet",
      detail: {
        what: "The first refusal point: the peer IP is checked against a reputation table. Known botnet space is dropped with a 554 before a byte of message has crossed the wire.",
        why: "It runs first because it is the cheapest rejection available and it disposes of the most raw connection volume. Everything downstream costs a round trip, a body read or a DNS lookup; this costs one memory access on data we already had.",
        numbers: [
          { value: "one memory read per connection", explain: "The full cost of this check, negligible even at peak transaction rate." },
          { value: "runs before the 1st MAIL FROM byte", explain: "How early this check happens, before any protocol exchange beyond the initial connection." },
        ],
        breaks: {
          failure: "A wrong entry blackholes a whole netblock of legitimate senders silently.",
          handled: "The senders it hits are exactly the ones with no other channel to tell us, which is why reputation feed quality is treated as its own operational concern.",
        },
      },
    },
    {
      id: "p-rcpt",
      label: "on_rcpt",
      sub: "550 unknown user, never bounce",
      kind: "process",
      col: 0,
      row: 2,
      parent: "mx-fleet",
      detail: {
        what: "The second refusal point: resolve the recipient locally, and return 550 immediately if the address does not exist. It returns 421 rather than 5xx if the sender is over its rate limit.",
        why: "This is where the difference between the two kinds of no is enforced. A non-existent recipient is deterministic, so it earns a 5xx; a rate limit is our own opinion about volume, so it gets a 4xx the sender can retry past.",
        numbers: [
          { value: "550 for no such user", explain: "The deterministic refusal this stage issues for an address that simply does not exist." },
          { value: "421 for over the rate limit", explain: "The retryable refusal this stage issues when the sender is over a volume limit rather than genuinely wrong." },
        ],
        breaks: {
          failure: "Accepting for an unknown user and bouncing afterwards is the single most common self-inflicted wound in mail operations.",
          handled: "It is invisible until the blocklists arrive, which is why this check runs synchronously here rather than being deferred to a later delivery attempt.",
        },
        choice: {
          pick: "Refuse an unknown recipient inside the transaction, at RCPT TO.",
          instead: "Accept everything the syntax allows and generate a bounce afterwards when delivery finds no such mailbox.",
          decider:
            "Who receives the bounce. The return path on spam is forged on most of the ~50% of traffic that is hostile. A bounce for a message we should never have taken goes to the forged victim instead of the sender.",
          flips: "A relay that genuinely cannot resolve recipients at the edge, such as a gateway in front of a directory it may only query asynchronously.",
        },
      },
    },
    {
      id: "p-data",
      label: "on_data_end",
      sub: "SPF, DKIM, DMARC, then 250",
      kind: "process",
      col: 0,
      row: 3,
      parent: "mx-fleet",
      detail: {
        what: "The third and last refusal point: with the whole message in hand, evaluate SPF, DKIM and DMARC. It refuses with 550 only on a DMARC failure against a published p=reject, defers with 451 if the classifier fleet is unhealthy, and otherwise returns 250.",
        why: "This is the only place a content-aware decision is possible and the only place we deliberately decline to make one. A 550 here is the sending domain instructing us to refuse mail that fails its own authentication, moving the false-positive risk to the party that can fix it.",
        numbers: [
          { value: "3 DMARC policies: none, quarantine, reject", explain: "The full set of policy outcomes a sending domain can publish, only one of which authorises a hard refusal here." },
          { value: "pct= stages enforcement, 10% then 50%", explain: "How a domain can ramp enforcement gradually rather than switching on a hard reject all at once." },
        ],
        breaks: {
          failure: "A stale or missing DMARC policy turns a would-be 5xx into an accept.",
          handled: "An outage in DNS resolution shows up as a spam wave rather than as an error, an accepted trade since failing open here is safer than failing closed.",
        },
        choice: {
          pick: "Act only on DMARC: alignment between the visible From and whichever of SPF or DKIM passed, then the domain's own published policy.",
          instead: "Act on SPF or DKIM directly, refusing anything that fails either check.",
          decider:
            "What each protocol actually authenticates. SPF authenticates only the Return-Path, not the visible From header, and fails on every one of a message's forwards. DKIM survives forwarding but breaks the moment a list appends a footer. Only DMARC yields an aligned verdict.",
          flips: "Inside a closed relay where every sender is yours and every path is known, an SPF failure really is conclusive.",
        },
      },
    },

    // --- acceptance: everything below here is revisable -------------------
    {
      id: "accept-writer",
      label: "Acceptance writer",
      sub: "SHA-256 body, convergent DEK",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "The post-250 write path: hash the body, derive a data key from that hash, put-if-absent into object storage, insert the metadata row with label UNSORTED, then publish the event.",
        why: "It is a separate service from the MX because the two sides of the 250 have opposite requirements. The MX is bounded by a connection it cannot hold open; this side has no deadline and is allowed to be slow.",
        numbers: [
          { value: "dek = hkdf(sha256(body))", explain: "How the per-message data key is derived, tying encryption to content rather than to a random value." },
          { value: "1 row inserted with labels=[UNSORTED]", explain: "The initial state every accepted message starts in, before classification assigns a real folder." },
        ],
        breaks: {
          failure: "The write spans two stores plus a stream, so a partial failure leaves a metadata row pointing at a body that was never stored.",
          handled: "The user sees a message that will not open, a known failure mode watched for directly rather than assumed impossible.",
        },
        choice: {
          pick: "Write bodies and metadata to two separate stores, joined by the content hash.",
          instead: "One row per message with the body and attachments inlined alongside the headers.",
          decider:
            "Read amplification on the inbox path. A metadata row is ~250B and is read on every inbox view; a body averages 50KB and is typically read once. Inlining makes a 100-row inbox listing pull ~5MB instead of 25KB.",
          flips: "Small mailboxes and small deployments, where a single store is one fewer thing to keep consistent.",
        },
      },
    },
    {
      id: "object-store",
      label: "Body + attachment store",
      sub: "content-addressed on SHA-256",
      kind: "blob",
      col: 2,
      row: 1,
      detail: {
        what: "The bytes, keyed by content hash, so identical content is stored once regardless of how many mailboxes reference it.",
        why: "This is where deduplication actually pays. One corporate newsletter PDF landing in ten thousand mailboxes is one object, and without that saving the storage arithmetic does not close at all.",
        numbers: [
          { value: "~7x dedup on the attachment slice", explain: "The measured deduplication ratio on the part of the corpus that benefits most." },
          { value: "50KB logical to ~10KB stored", explain: "The overall effect of deduplication on average message size on disk." },
          { value: "~2EB stored against 10EB logical", explain: "The scale of the saving across the entire corpus." },
        ],
        breaks: {
          failure: "The reference-counting collector can remove the last reference to a blob mid-read.",
          handled: "Deletes are two-phase with a grace period that aborts if read traffic touches the object, closing that race.",
        },
        choice: {
          pick: "Content-addressed object storage with convergent encryption: the data key is derived from the plaintext hash, then wrapped per recipient.",
          instead: "One encrypted copy per recipient, with each user's own key applied to their own bytes.",
          decider:
            "Stored bytes. Per-recipient encryption makes identical plaintext produce different ciphertext, killing dedup and taking stored volume from ~10KB to 50KB per message, turning 2EB into 10EB.",
          flips: "When equality leakage is unacceptable. Convergent encryption lets anyone who can write to the store test whether a given plaintext is already present.",
        },
      },
    },
    {
      id: "user-storage-zone",
      label: "Per-user storage, sharded by user_id",
      kind: "zone",
      detail: {
        what: "The two tiers keyed by user_id: the mailbox metadata rows and the user's logical search index. They deploy, scale and fail apart, which is why this is a boundary rather than one service.",
        why: "Sharding both on user_id makes list, search, label and delete single-partition operations. The body store is deliberately outside this frame: it is content-addressed and global, and one object is referenced by many users.",
        numbers: [
          { value: "~50MB metadata per user", explain: "The typical metadata footprint one user's mailbox occupies." },
          { value: "~250MB index per user", explain: "The typical search-index footprint the same user's mailbox occupies." },
        ],
        breaks: {
          failure: "The two tiers are only eventually consistent with each other.",
          handled: "A delete that completes in the metadata store and not in the index leaves mail gone from the mailbox but still findable by search, a known window this design accepts.",
        },
      },
    },
    {
      id: "metadata-store",
      label: "Mailbox metadata",
      sub: "wide-column, key user_id",
      kind: "database",
      col: 2,
      row: 3,
      parent: "user-storage-zone",
      detail: {
        what: "One ~250B row per recipient per message: msg id, subject, participants, timestamp, labels, thread id, body hash and the wrapped data key.",
        why: "Partitioning on user_id is what makes list, search, label and delete single-partition operations. Cross-user isolation is enforced here rather than in the application.",
        numbers: [
          { value: "~250B/row, ~200k messages/user", explain: "The typical row size and per-user message count this store is sized around." },
          { value: "~50MB per user, 50PB total, ~150PB at RF=3", explain: "The full scale of this store across the whole user base, replicated for durability." },
        ],
        breaks: {
          failure: "A 4M-message mailbox saturates its partition's IOPS.",
          handled: "p99 list latency climbs for that one user and their IMAP sync stalls while everyone else is fine, an isolated rather than fleet-wide degradation.",
        },
        choice: {
          pick: "Shard by user_id, one full row per recipient, with bodies deduplicated underneath by content hash.",
          instead: "One canonical record per delivered message with a thin per-user pointer row carrying only labels and read state.",
          decider:
            "Mean recipients per delivered message, which is 1.3 here. A shared record therefore removes at most 23% of metadata rows, which is 0.6% of the 2EB corpus, and buys nothing against giving up single-partition reads.",
          flips: "Enterprise tenancy, where mean internal fan-out above roughly 15 removes 93% of the row bytes.",
        },
      },
    },
    {
      id: "search-index",
      label: "Per-user search index",
      sub: "~50k users per shard",
      kind: "database",
      col: 2,
      row: 2,
      parent: "user-storage-zone",
      detail: {
        what: "One logical inverted index per user over extracted text, packed many to a physical shard with user_id as the leading sort key.",
        why: "Nobody searches another user's mail, so there is no global ranking model and no cross-corpus recall requirement. Every query is scoped to exactly one user and touches one shard and one contiguous run of postings.",
        numbers: [
          { value: "~4KB indexable per message, ~250MB/user", explain: "The typical extracted, indexable text volume per message and its accumulation per user." },
          { value: "250PB, ~500PB at RF=2 on SSD", explain: "250MB/user x ~1B users = 250PB raw, 5x metadata's 50PB; even at RF=2 vs metadata's RF=3, this is the fleet's largest store." },
          { value: "90d hot, 1y warm, then cold", explain: "The retention tiering this index applies as data ages." },
        ],
        breaks: {
          failure: "An index that outgrows affordable hot storage as a mailbox approaches its 5.5-year steady state.",
          handled: "Search p99 climbs for that one user and nobody else, an isolated degradation rather than a fleet-wide one.",
        },
        choice: {
          pick: "One logical index per user, ~50k users packed per physical shard, sorted on user_id.",
          instead: "One physical index per user, fully isolated, with no shared postings and no cross-user skip cost.",
          decider:
            "Per-shard floor cost against user count. A shard costs on the order of 100MB resident whether it holds 200k or 200M documents, and clusters get unmanageable past the low hundreds of thousands of shards.",
          flips: "Thousands of tenants rather than a billion users, where isolation is contractual: customer-managed keys, per-tenant residency and provable index purge.",
        },
      },
    },

    // --- the asynchronous side: three independent consumers ---------------
    {
      id: "change-stream",
      label: "Change stream",
      sub: "one log, three consumers",
      kind: "queue",
      col: 1,
      row: 2,
      detail: {
        what: "The durable log of accepted-message events that the classifier, the indexer and the notifier all consume independently, each at its own offset.",
        why: "Fanning out to three consumers off one log is what keeps the accept path short. The MX and the writer are done once the row is in, and everything slow hangs off here. It also gives the classifier replay, which is what retro-relabelling needs.",
        numbers: [
          { value: "1.16M events/s average", explain: "The steady rate this log carries, matching the accepted-message rate." },
          { value: "three independent consumer offsets", explain: "Each reads the full 1.16M/s stream independently, so the notifier firing before classification finishes never waits on the classifier's offset." },
          { value: "push notifier fires on accept, before the label exists, ~1s median", explain: "How quickly a device is notified, deliberately before classification has even run." },
        ],
        breaks: {
          failure: "A consumer falling behind is invisible from the ingest side: mail is still being accepted and stored.",
          handled: "The only symptom is that new messages sit unsorted, unsearchable or unannounced for longer, which is why each consumer's own lag is monitored directly.",
        },
        choice: {
          pick: "A log-structured bus with independent consumer offsets.",
          instead: "Direct RPC from the acceptance writer to each of classification, indexing and notification.",
          decider:
            "Consumer count and replay. Three consumers at 1.16M/s means an RPC fan-out puts three synchronous dependencies on the accept path, and any one being unhealthy propagates into the SMTP transaction.",
          flips: "A single-consumer deployment where classification, indexing and delivery are the same process.",
        },
      },
    },
    {
      id: "classifier",
      label: "Asynchronous classifier",
      sub: "labels only, canaried",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "Scores every accepted message on headers, body, URLs against a phishing corpus, attachment hashes, sender velocity and cross-mailbox campaign signals, then sets the label to INBOX or SPAM.",
        why: "Running it off the acceptance path buys features no per-connection decision can see. The same body hash in 40,000 mailboxes in 90 seconds is nearly free to detect and nearly impossible to fake.",
        numbers: [
          { value: "~30% of accepted mail foldered as spam", explain: "100B/day x 30% = 30B/day foldered; even the 0.1% FP budget on the 70B legit remainder is ~70M wrongly-hidden messages a day." },
          { value: "FP budget 0.1%, measured on 'not spam' clicks", explain: "The published false-positive target this classifier is held to, and how it is actually measured." },
        ],
        breaks: {
          failure: "A bad model build corrupts no data, it silently moves legitimate mail out of sight.",
          handled: "'Not spam' clicks only count the mistakes somebody happened to notice, which is why canary rollout with auto-revert plus human review of sampled spam is layered on top.",
        },
        choice: {
          pick: "Emit a revisable label off the change stream, never a refusal.",
          instead: "Score synchronously at end of DATA so the verdict is available while the connection is still open.",
          decider:
            "Which copy of a campaign you get to judge. A per-connection decision only ever sees copy 1; by copy 12,000 the same body hash in 40,000 mailboxes inside 90 seconds settles it for free.",
          flips: "When the classifier fleet is down rather than merely degraded, at which point the MX returns 451 and defers instead.",
        },
      },
    },

    // --- read and send: the side where the caller is ours ------------------
    {
      id: "mailbox-api",
      label: "Mailbox API + sync",
      sub: "cursor REST, IMAP/POP",
      kind: "service",
      col: 3,
      row: 1,
      detail: {
        what: "The read and send surface: cursor-paginated folder listings, full message fetch, search, label and read-state writes, and message submission. A look-aside cache of the most recent metadata rows sits in front of the listing path.",
        why: "It is the only tier that joins the three stores back together, and it is where the user_id on every query comes from. The cache is what turns the metadata/body storage split from an argument into a number: the hot set is people reading right now, not the corpus.",
        numbers: [
          { value: "list and search under 500ms p95", explain: "The latency target this whole read surface is held to." },
          { value: "never more than 100 rows per page", explain: "The bound this API enforces on every listing request, regardless of mailbox size." },
          { value: "cache: 5% of users active/hour x 100 rows x 250B = ~1.25TB, 0.0025% of the 50PB corpus", explain: "The derivation showing how small this hot cache actually is relative to the full corpus." },
        ],
        breaks: {
          failure: "IMAP and POP carry per-folder UID sequences and flag state, which constrain how freely a mailbox may be re-sharded underneath a live client session.",
          handled: "The cache holds exactly the fields the classifier rewrites. A retro-relabel that does not invalidate it leaves a spam campaign sitting visible on every device that already listed it.",
        },
        choice: {
          pick: "Cursor-based pagination over the metadata rows, with IMAP and POP served alongside an HTTP API.",
          instead: "Offset pagination, and an HTTP API only with no legacy protocol support.",
          decider:
            "Behaviour on the heaviest mailboxes. At 4M messages, an offset page deep into the mailbox scans everything before it, so latency grows with position in the hottest partition we own.",
          flips: "A consumer-only product with first-party clients, where dropping IMAP and POP removes the UID-sequence constraint entirely.",
        },
      },
    },
    {
      id: "clients",
      label: "Webmail, mobile, IMAP",
      sub: "authenticated, one user_id",
      kind: "client",
      col: 3,
      row: 0,
      detail: {
        what: "The devices a person is holding: the web client, the mobile apps and third-party IMAP or POP clients, plus the push channel they receive on.",
        why: "It is a client rather than an external because this is the side of the trust boundary where we know who is calling. Every request carries an authenticated user_id, the exact opposite of the inbound SMTP side where nothing about the caller is known.",
        numbers: [{ value: "10B sends/day, ~10 per user", explain: "The scale of outbound traffic this population generates." }],
        breaks: {
          failure: "A POP client that downloads and deletes, or an IMAP client holding UID sequences, pins mailbox layout decisions we would otherwise be free to change.",
          handled: "The push signal carries a message id rather than content, so a client that assumed otherwise would still not leak a phishing subject line before the classifier foldered it.",
        },
      },
    },

    // --- outbound: we are the untrusted stranger now -----------------------
    {
      id: "outbound-queue",
      label: "Outbound queue",
      sub: "durable before Sent, 72h backoff",
      kind: "queue",
      col: 3,
      row: 2,
      detail: {
        what: "The replicated queue a send lands in before the UI says Sent, holding retry state through growing backoff up to 72 hours.",
        why: "Delivery is never synchronous because the recipient's server is not our problem to make fast. The user's Sent is a promise about our queue, and pretending otherwise blocks a UI on a stranger's infrastructure.",
        numbers: [
          { value: "10B sends/day, 116k/s average, ~500k/s peak", explain: "The throughput this queue is sized to sustain." },
          { value: "backoff 1min, 5min, 15min, 1h, 4h and up", explain: "The retry schedule a deferred message follows before it either delivers or eventually bounces." },
          { value: "~50M messages in retry state at any moment", explain: "The realistic steady-state size of the in-flight retry backlog." },
        ],
        breaks: {
          failure: "A message that neither delivers nor bounces is the failure that matters, because the sender has no other way to learn.",
          handled: "At 72 hours the queue owes them a bounce into their own inbox, closing the loop rather than leaving the sender guessing indefinitely.",
        },
        choice: {
          pick: "A durable replicated queue acknowledged before the client is told anything.",
          instead: "Synchronous delivery, holding the client request open until the recipient's MX accepts.",
          decider:
            "In-flight volume. If 3% of sends transiently defer and the mean deferral is 4 hours, that is ~50M messages mid-retry at any moment, which is no version of a held connection.",
          flips: "An internal-only relay where every recipient MX is yours and reachable, so a failure is a real error the caller should see immediately.",
        },
      },
    },
    {
      id: "sending-workers",
      label: "Sending workers",
      sub: "gold / silver / quarantine",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "The workers that lease a queued message, do the MX lookup and open SMTP to the recipient's mail server, sending from addresses grouped by sender trust.",
        why: "Outbound reputation is a shared resource and it is the thing a compromised account destroys fastest. Tiering means the addresses a bad actor burns are ones we were prepared to lose.",
        numbers: [
          { value: "three pools: established, new, quarantine", explain: "The tiers sending addresses are split into by reputation." },
          { value: "per-account limits catch 10x the 7-day baseline", explain: "The threshold that flags an account sending far outside its own normal pattern." },
          { value: "new addresses warmed at ~1,000/day, doubling weekly", explain: "The ramp new sending addresses follow before reaching full volume." },
          { value: "4xx from the recipient means retry, 5xx means bounce", explain: "The two outcomes a recipient's own response can trigger." },
        ],
        breaks: {
          failure: "One compromised account on a shared address gets that address listed, and every other user sending from it starts bouncing before anyone notices.",
          handled: "A cold address emitting a million messages looks exactly like a botnet, which is why new addresses are warmed rather than sent at full volume immediately.",
        },
        choice: {
          pick: "Reputation-tiered sending pools with automatic demotion on anomalous send behaviour.",
          instead: "One shared pool for all outbound, sized purely for throughput.",
          decider:
            "Blast radius of a single listing. 1,000 compromised accounts blasting from a shared pool take down all 10B sends/day for everyone on it, and delisting is measured in days.",
          flips: "Low outbound volume from a single address, where you have one IP, one reputation, and tiering is a pool structure with nothing to put in it.",
        },
      },
    },
  ],
  edges: [
    // --- inbound, and the three refusals ---------------------------------
    {
      id: "e-arrive",
      from: "external-senders",
      to: "p-connect",
      tier: "hot",
      step: 1,
      label: "SMTP, 1.65M/s arrivals",
      detail: {
        what: "Inbound SMTP connections from anywhere on the internet, carrying EHLO, MAIL FROM, RCPT TO and DATA.",
        why: "This is the write path we did not design and cannot version. Every capacity number downstream is a function of what this edge is allowed to deliver, which is why the refusal policy is decided before the storage tier.",
        numbers: [
          { value: "143B arrivals/day", explain: "The full daily volume this edge is exposed to before any refusal." },
          { value: "~6.6M transactions/s at peak", explain: "The peak transaction rate this edge must accept connections for." },
        ],
        breaks: {
          failure: "Peak is 4x average and entirely externally driven.",
          handled: "There is no scheduling lever, only capacity and deferral, so the whole design is built to absorb bursts rather than smooth them.",
        },
      },
    },
    {
      id: "e-refuse-connect",
      from: "p-connect",
      to: "external-senders",
      tier: "control",
      label: "554 known-bad IP",
      offset: 30,
      detail: {
        what: "The cheapest refusal in the system: a 554 to a connection from known botnet space, issued before a byte of message has been read.",
        why: "It is deterministic and it is ours to be wrong about, which is why it is bounded to netblocks with observed behaviour rather than to anything inferred from content.",
        numbers: [{ value: "one memory read to decide", explain: "The full computational cost of this refusal." }],
        breaks: {
          failure: "A wrong entry is permanent and silent for the sender.",
          handled: "They get a hard refusal with no route to appeal it and no bounce anybody will read, which is why reputation feed accuracy is treated as a first-class operational concern.",
        },
      },
    },
    {
      id: "e-connect-rcpt",
      from: "p-connect",
      to: "p-rcpt",
      tier: "control",
      label: "connection accepted",
      detail: {
        what: "The same SMTP conversation continuing into MAIL FROM and RCPT TO, in the same process on the same socket.",
        why: "It is a stage boundary rather than a hop because that is exactly what it is. Each stage is more expensive than the one before it, and that only saves anything if the cheap one runs first.",
        numbers: [{ value: "0 network hops, 0 serialisation", explain: "A network hop per hook would be three orders of magnitude too slow for a microsecond budget; staying in-process is the requirement, not an optimisation." }],
        breaks: {
          failure: "Reordering the stages, or making one of them a remote call.",
          handled: "That silently converts the cheapest rejection in the system into the most expensive, which is why stage order is treated as an invariant, not an implementation detail.",
        },
      },
    },
    {
      id: "e-refuse-rcpt",
      from: "p-rcpt",
      to: "external-senders",
      tier: "control",
      label: "550 no such user",
      offset: 60,
      detail: {
        what: "A 550 for an address that does not resolve locally, and a 421 for a sender over its rate limit.",
        why: "Refusing here rather than accepting is what keeps us off the blocklists. The return path on spam is forged, so a bounce generated later would go to the forged victim.",
        numbers: [{ value: "550 for unknown user, 421 for rate limit", explain: "The two possible outcomes of this refusal point." }],
        breaks: {
          failure: "Never accept for an unknown user and bounce afterwards.",
          handled: "It is the most common self-inflicted wound in mail operations and it is invisible until the listings arrive, which is exactly why this check runs synchronously here.",
        },
      },
    },
    {
      id: "e-rcpt-data",
      from: "p-rcpt",
      to: "p-data",
      tier: "control",
      label: "recipient resolves",
      detail: {
        what: "The transaction proceeding to DATA now that the recipient is known to exist and the sender is within its limits.",
        why: "This is the point where reading the body becomes worth paying for. Everything before it was decided on the envelope, which costs nothing; everything after it needs the whole message in hand.",
        numbers: [{ value: "body read begins after 2 refusals already passed", explain: "How much cheap filtering has already happened before this more expensive step begins." }],
        breaks: {
          failure: "Message size limits belong here, not later.",
          handled: "Reading an unbounded body before deciding anything is how a single sender consumes an MX host's memory, which is why size limits are enforced at this exact boundary.",
        },
      },
    },
    {
      id: "e-refuse-data",
      from: "p-data",
      to: "external-senders",
      tier: "control",
      label: "550 DMARC, or 451 defer",
      offset: 90,
      detail: {
        what: "The last refusal: 550 on a DMARC failure against a published p=reject, or 451 when the classifier fleet is unhealthy and we would rather not guess.",
        why: "This arrow is the only irreversible thing in the whole design, and the only 5xx here is one the sending domain authorised. Anything probabilistic gets the 4xx instead.",
        numbers: [
          { value: "~1e-6 false positives on a p=reject refusal", explain: "The confidence level required before a refusal is allowed to be issued here." },
          { value: "1e-3 for a model score, which is why it never lands here", explain: "The much weaker confidence a spam model provides, disqualifying it from this hard-refusal path entirely." },
        ],
        breaks: {
          failure: "A 5xx on legitimate mail is permanent and invisible to the recipient.",
          handled: "There is no bounce they will see and no channel through which the mistake can be reported, which is why only DMARC-authorised refusals are permitted here.",
        },
      },
    },

    // --- acceptance and the write path ------------------------------------
    {
      id: "e-accept",
      from: "p-data",
      to: "accept-writer",
      tier: "hot",
      step: 2,
      label: "250 ok, ~70% accepted",
      detail: {
        what: "An accepted message crossing from the SMTP transaction into the storage path.",
        why: "This is the boundary the whole design is built around. Above it, decisions are permanent and must be near-certain; below it, everything is revisable and is allowed to be slow.",
        numbers: [{ value: "100B accepted/day, 1.16M/s", explain: "70% of the ~143B/day total arrivals; every downstream store is sized against this number, not the raw arrival rate." }],
        breaks: {
          failure: "If storage is slow, this edge backs up into the transaction.",
          handled: "The MX has to defer with 4xx rather than guess, which converges every sender's retry timer on our recovery, an accepted cost of never guessing at acceptance.",
        },
      },
    },
    {
      id: "e-body",
      from: "accept-writer",
      to: "object-store",
      tier: "data",
      label: "body by SHA-256",
      detail: {
        what: "A put-if-absent of the encrypted body and attachments under the hash of their content.",
        why: "Put-if-absent rather than put is what makes deduplication happen at write time with no separate reconciliation pass. The same newsletter PDF arriving in ten thousand mailboxes writes once and increments a reference count nine thousand nine hundred and ninety-nine times.",
        numbers: [
          { value: "~7x dedup on attachments", explain: "The deduplication ratio this write path achieves on the attachment slice." },
          { value: "1PB/day stored against 5PB/day logical", explain: "The daily saving this mechanism produces at full scale." },
        ],
        breaks: {
          failure: "The key is derived from the content, so a colliding or truncated hash silently serves one user another user's bytes.",
          handled: "That risk is why SHA-256, with negligible collision probability at this corpus size, is used rather than a weaker or truncated digest.",
        },
      },
    },
    {
      id: "e-row",
      from: "accept-writer",
      to: "metadata-store",
      fromSide: "right",
      toSide: "right",
      tier: "data",
      label: "250B row, user shard",
      detail: {
        what: "The metadata row insert on the recipient's partition, carrying headers, thread id, body hash, wrapped data key and labels=[UNSORTED].",
        why: "It lands on exactly one partition because the shard key is the recipient's user_id, so a delivery is a single-partition write no matter how many recipients the message had.",
        numbers: [
          { value: "~250B per row", explain: "The typical size of one delivered message's metadata row." },
          { value: "mean 1.3 of our recipients per delivered message", explain: "The average fan-out this system sees per delivered message." },
        ],
        breaks: {
          failure: "The row is inserted before classification.",
          handled: "Anything reading it in the window between insert and label sees a message with no folder, a brief, accepted transitional state rather than a bug.",
        },
      },
    },
    {
      id: "e-event",
      from: "accept-writer",
      to: "change-stream",
      tier: "hot",
      step: 3,
      label: "accepted message event",
      detail: {
        what: "The event published once the body and the row are both durable.",
        why: "Publishing after the write, never before, is what stops a consumer racing the data it is meant to process. Everything expensive hangs off this edge so the acceptance path stays short.",
        numbers: [{ value: "1.16M events/s average", explain: "The steady rate this fan-out point publishes at." }],
        breaks: {
          failure: "Publish-before-write leaves the classifier scoring a message whose body is not yet readable.",
          handled: "The retry looks like a transient store error rather than an ordering bug, which is exactly why the publish is strictly ordered after both writes complete.",
        },
      },
    },

    // --- three consumers, three independent offsets ------------------------
    {
      id: "e-cs-classifier",
      from: "change-stream",
      to: "classifier",
      tier: "hot",
      step: 4,
      label: "unsorted, needs a label",
      detail: {
        what: "Accepted messages delivered to the scoring fleet, which reads the body from object storage and the sender history alongside.",
        why: "Consuming from a log rather than being called synchronously is what gives the classifier unbounded time and, more usefully, the ability to rewind and re-score after a bad model deploy.",
        numbers: [{ value: "scored well after the 250, not before it", explain: "The timing guarantee this consumer relies on, decoupled entirely from the acceptance decision." }],
        breaks: {
          failure: "Consumer lag here means mail sits unsorted in the mailbox.",
          handled: "Users experience that as spam in the inbox rather than as an outage, a degraded but non-failing state.",
        },
      },
    },
    {
      id: "e-cs-search",
      from: "change-stream",
      to: "search-index",
      tier: "data",
      label: "extract + index postings",
      detail: {
        what: "The indexing consumer reading the same log at its own offset: extract subject, body text and participants, analyse them, and write postings into the user's logical index. Owns the purge that has to follow every delete.",
        why: "It is its own step rather than folded silently into the store, because it does work the store does not. That work is deciding what is indexable, and keeping cleanup in step with deletion.",
        numbers: [
          { value: "~4KB indexable per 50KB message, ~30% of source text", explain: "How much of a message actually becomes searchable text." },
          { value: "~250MB per user at steady state", explain: "The resulting index size per user once this extraction settles." },
          { value: "1.16M events/s", explain: "The rate this consumer processes off the same log as classification." },
        ],
        breaks: {
          failure: "The write is not transactional with the metadata row, so a crash between them leaves a message that lists but does not search, or the reverse.",
          handled: "Index cleanup is a separate job from message deletion, so a purge that completes in metadata but not here leaves deleted mail findable by search until somebody notices.",
        },
      },
    },
    {
      id: "e-label",
      from: "classifier",
      to: "metadata-store",
      tier: "data",
      label: "label: INBOX or SPAM",
      detail: {
        what: "A label update against the metadata row, and on a campaign hit a bulk update across every row sharing that body hash.",
        why: "The verdict is a label rather than a deletion precisely so it can be revised in both directions. When the campaign detector fires on copy 12,000, the 11,999 already delivered are moved by a bulk update with no bytes touched.",
        numbers: [{ value: "40,000 recipients in 90 seconds is the campaign signal", explain: "The specific pattern that triggers a bulk relabel across the whole affected campaign." }],
        breaks: {
          failure: "Bulk relabelling has to be rate limited and reversible by the same mechanism.",
          handled: "One false campaign hit could silently empty 40,000 inboxes of mail those users asked for, which is why the same reversible label mechanism is used both ways.",
        },
      },
    },

    // --- the read and send side --------------------------------------------
    {
      id: "e-client-api",
      from: "clients",
      to: "mailbox-api",
      tier: "hot",
      step: 5,
      label: "read, search, send",
      detail: {
        what: "Everything the user does: list a folder, open a message, search, mark read, relabel, and submit a new message.",
        why: "Every one of these carries an authenticated user_id, which is what makes single-partition routing possible. This is the side of the system where the caller is known.",
        numbers: [
          { value: "100 rows per page", explain: "The pagination bound applied to every listing request from this edge." },
          { value: "under 500ms p95 for list and search", explain: "The latency target this whole surface is held to." },
        ],
        breaks: {
          failure: "IMAP and POP sessions hold state across requests, so a client can be mid-sync when a mailbox is re-sharded underneath it.",
          handled: "That constraint is accepted and worked around, rather than eliminated, since dropping legacy protocol support is not an option for this product.",
        },
      },
    },
    {
      id: "e-feedback",
      from: "clients",
      to: "classifier",
      tier: "control",
      label: "'not spam' click",
      detail: {
        what: "User feedback: 'Report spam' and 'Not spam' clicks, written as a label change and captured as a training label, retrained nightly.",
        why: "This loop is the reason labelling beats refusing. A refused message generates no signal and teaches the system nothing, whereas a mis-filed one reaches a human who can correct it.",
        numbers: [{ value: "retrained every 24h", explain: "The cadence this feedback is folded back into the model." }],
        breaks: {
          failure: "It counts only the mistakes somebody noticed.",
          handled: "Most people never open the spam folder, so the 0.1% budget is a lower bound with an unknown multiplier, an honest limitation of this measurement.",
        },
      },
    },
    {
      id: "e-read-meta",
      from: "mailbox-api",
      to: "metadata-store",
      tier: "hot",
      step: 6,
      label: "cursor page, 100 rows",
      detail: {
        what: "An inbox listing: a bounded cursor read of the recipient's own partition, plus label and read-state writes.",
        why: "Single-partition by construction, because the shard key is the authenticated user_id. The storage client rejects any request whose partition key does not match the caller.",
        numbers: [
          { value: "under 500ms p95", explain: "The latency target this listing path is held to." },
          { value: "at most 100 rows per page", explain: "The bound this read is capped at regardless of mailbox size." },
        ],
        breaks: {
          failure: "Offset pagination on a 4M-message mailbox scans everything before the page.",
          handled: "Latency grows with depth on the hottest partition we own, which is exactly why cursor pagination is used instead of offset.",
        },
      },
    },
    {
      id: "e-read-body",
      from: "mailbox-api",
      to: "object-store",
      tier: "data",
      label: "body bytes on open",
      detail: {
        what: "Fetching and decrypting the body when a user actually opens a message, using the data key unwrapped from their metadata row.",
        why: "It is deliberately a second round trip. Bodies are read roughly once in their life and inbox listings never need them, so paying a fetch on open is far cheaper than carrying 50KB through every list request.",
        numbers: [{ value: "1 DEK unwrapped per open, using the per-user KEK", explain: "The key-management step this read performs on every message open." }],
        breaks: {
          failure: "A KMS regional issue makes bodies undecryptable while auth and metadata stay healthy.",
          handled: "The mailbox lists correctly and every message fails to open, an isolated failure mode distinct from a full outage.",
        },
      },
    },
    {
      id: "e-search",
      from: "mailbox-api",
      to: "search-index",
      tier: "data",
      label: "query scoped to user_id",
      detail: {
        what: "A search query routed by user_id to the one shard holding that user's postings, fanning to warm and cold tiers only when the hot tier returns sparse results.",
        why: "Routing on user_id is what turns a packed shard back into a private index. The postings for a common term span 50k users, so sorting on user_id makes skipping the rest a block-level seek rather than a scan.",
        numbers: [
          { value: "90d hot, 1y warm, archive beyond", explain: "The tiering this query path has to search across depending on message age." },
          { value: "under 500ms p95", explain: "The latency target this query path is held to." },
        ],
        breaks: {
          failure: "Common facets (sender, label, has-attachment) must be precomputed as columnar indexes.",
          handled: "Without that, every 'find that thing from Bob' query pays the full-text path it did not need, which is why those facets are precomputed rather than derived at query time.",
        },
      },
    },
    {
      id: "e-send",
      from: "mailbox-api",
      to: "outbound-queue",
      tier: "hot",
      step: 7,
      label: "durable before Sent",
      detail: {
        what: "A composed message enqueued durably, after which the UI is allowed to say Sent.",
        why: "The acknowledgement follows the queue write, never the delivery attempt, because the recipient's server is not ours to make fast. Sent is a promise about our durability.",
        numbers: [{ value: "10B sends/day, 116k/s average", explain: "The volume this hop carries into the outbound queue." }],
        breaks: {
          failure: "Acknowledging before the queue write loses the message with no trace.",
          handled: "The sender has no way to discover it was never sent, which is exactly why the write is strictly ordered before the acknowledgement.",
        },
      },
    },

    // --- outbound ----------------------------------------------------------
    {
      id: "e-lease",
      from: "outbound-queue",
      to: "sending-workers",
      tier: "hot",
      step: 8,
      label: "lease, then MX lookup",
      detail: {
        what: "A queued message leased to a sending worker, which resolves the recipient domain's MX record and picks a pool address by the sender's reputation tier.",
        why: "Pool selection happens here rather than at compose time because reputation is a property of recent behaviour, and an account can be demoted between composing and sending.",
        numbers: [
          { value: "~500k/s at peak", explain: "The peak lease rate this hop is provisioned for." },
          { value: "three pools by sender trust", explain: "The tiers a message can be routed into at this exact moment." },
        ],
        breaks: {
          failure: "If a worker dies holding a lease, that message stalls until the lease expires.",
          handled: "The timeout directly bounds worst-case send latency, so lease duration is tuned deliberately rather than left generous by default.",
        },
      },
    },
    {
      id: "e-defer",
      to: "outbound-queue",
      tier: "data",
      from: "sending-workers",
      label: "4xx defer, retry to 72h",
      offset: 60,
      detail: {
        what: "A temporary failure from the recipient sending the message back into the retry queue with a longer backoff.",
        why: "The recipient's server being busy is a normal condition, not an error, so the queue absorbs it. Growing backoff is what stops a struggling recipient being hammered by our whole fleet on an identical schedule.",
        numbers: [
          { value: "1min, 5min, 15min, 1h, 4h and up", explain: "The specific backoff ladder this retry path climbs." },
          { value: "~3% of sends defer at least once", explain: "The realistic share of traffic that takes this path at all." },
        ],
        breaks: {
          failure: "Sustained deferral to a large recipient inflates in-flight retry state.",
          handled: "That state is ~50M messages at steady state and grows without bound if the backoff ladder has no ceiling, which is why the ladder is capped.",
        },
      },
    },
    {
      id: "e-bounce",
      from: "outbound-queue",
      to: "metadata-store",
      tier: "control",
      label: "bounce at 72h",
      detail: {
        what: "After 72 hours of failed retries, a bounce message written into the sender's own mailbox and the original moved to a failed folder.",
        why: "Never a silent drop, because the sender has no other channel through which to learn. The bounce goes to our own authenticated user, which is exactly the case where a bounce is safe to generate at all.",
        numbers: [{ value: "99.9% delivered or bounced within 72h", explain: "The published reliability target this entire outbound path is held to." }],
        breaks: {
          failure: "Generating bounces to unauthenticated third parties is backscatter and gets you listed.",
          handled: "That is exactly why inbound refuses at RCPT TO rather than accepting and bouncing, the same principle applied symmetrically on the send side.",
        },
      },
    },
  ],
};
